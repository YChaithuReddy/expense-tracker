import 'package:flutter/foundation.dart';

import '../core/network/supabase_client.dart';
import '../models/advance.dart';
import '../models/user_profile.dart';

/// Service for advance CRUD and approval workflow against Supabase.
///
/// IMPORTANT: The `advances` table has NO foreign key to `profiles`.
/// When fetching advances with submitter info (e.g. for approval lists),
/// we perform TWO separate queries:
///   1. Fetch advances
///   2. Batch-fetch profiles by user_id and attach manually
///
/// This mirrors the pattern used by the web app.
class AdvanceService {
  AdvanceService();

  // ─── Read ──────────────────────────────────────────────────────────────

  /// Fetches advances owned by [userId], ordered newest first.
  ///
  /// Optionally filter by [status] (e.g. 'active', 'pending_manager').
  Future<List<Advance>> getAdvances(
    String userId, {
    String? status,
  }) async {
    try {
      var query = supabase
          .from('advances')
          .select()
          .eq('user_id', userId);

      if (status != null && status.isNotEmpty) {
        query = query.eq('status', status);
      }

      // Transform (order) must come AFTER all filter calls.
      final data = await query.order('created_at', ascending: false);

      return (data as List<dynamic>)
          .map((row) => Advance.fromJson(row as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getAdvances error: $e');
      throw Exception('Failed to load advances: $e');
    }
  }

  /// Fetches advances pending approval for the given [role] and [userId].
  ///
  /// This uses the 2-query pattern (NO FK join):
  ///   1. Fetch advances based on role-specific filters
  ///   2. Batch-fetch submitter profiles and attach to each advance
  ///
  /// [orgId] is required for accountant and admin roles.
  Future<List<Advance>> getAdvancesForApproval({
    required String role,
    required String userId,
    String? orgId,
  }) async {
    try {
      // ── Query 1: Fetch advances based on role ──

      var query = supabase.from('advances').select();

      switch (role) {
        case 'manager':
          query = query
              .eq('manager_id', userId)
              .inFilter('status', ['pending_manager']);
          break;

        case 'accountant':
          if (orgId != null) {
            query = query
                .eq('organization_id', orgId)
                .inFilter('status', ['pending_accountant']);
          }
          break;

        case 'admin':
          if (orgId != null) {
            query = query.eq('organization_id', orgId).inFilter(
                'status', ['pending_manager', 'pending_accountant']);
          }
          break;

        default:
          // Employee — show their own advances
          query = query.eq('user_id', userId);
          break;
      }

      // Order AFTER all filters
      final data = await query.order('created_at', ascending: false);

      final advances = (data as List<dynamic>)
          .map((row) => Advance.fromJson(row as Map<String, dynamic>))
          .toList();

      if (advances.isEmpty) return advances;

      // ── Query 2: Batch-fetch submitter profiles ──

      final userIds = advances
          .map((a) => a.userId)
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();

      if (userIds.isEmpty) return advances;

      final profilesData = await supabase
          .from('profiles')
          .select('id, name, employee_id, email')
          .inFilter('id', userIds);

      final profileMap = <String, UserProfile>{};
      for (final row in (profilesData as List<dynamic>)) {
        final profile =
            UserProfile.fromJson(row as Map<String, dynamic>);
        profileMap[profile.id] = profile;
      }

      // Attach submitter profiles to advances
      return advances
          .map((a) => a.copyWith(submitter: profileMap[a.userId]))
          .toList();
    } catch (e) {
      debugPrint('getAdvancesForApproval error: $e');
      throw Exception('Failed to load advances for approval: $e');
    }
  }

  // ─── Create ────────────────────────────────────────────────────────────

  /// Creates a new advance and returns the inserted row.
  ///
  /// Automatically adds an `advance_history` entry if in company approval
  /// mode (manager_id is set).
  Future<Advance> createAdvance(Advance advance) async {
    try {
      final data = await supabase
          .from('advances')
          .insert(advance.toInsertJson())
          .select()
          .single();

      final created = Advance.fromJson(data);

      // Add history entry for company-mode submissions
      if (advance.managerId != null) {
        try {
          await supabase.from('advance_history').insert({
            'advance_id': created.id,
            'action': 'submitted',
            'acted_by': advance.userId,
            'comments':
                'Advance of ${advance.amount.toStringAsFixed(0)} for ${advance.projectName}',
            'new_status': 'pending_manager',
            'created_at': DateTime.now().toIso8601String(),
          });
        } catch (e) {
          debugPrint('advance_history insert warning: $e');
        }
      }

      return created;
    } catch (e) {
      debugPrint('createAdvance error: $e');
      throw Exception('Failed to create advance: $e');
    }
  }

  // ─── Approve / Reject ──────────────────────────────────────────────────

  /// Approves the advance identified by [advanceId].
  ///
  /// The [actorId] is the user performing the approval. The next status
  /// is determined by the current status:
  ///   pending_manager  -> pending_accountant
  ///   pending_accountant -> active
  Future<void> approveAdvance(String advanceId, String actorId) async {
    try {
      // Get current advance to determine transition
      final advData = await supabase
          .from('advances')
          .select()
          .eq('id', advanceId)
          .single();

      final advance = Advance.fromJson(advData);

      // Get approver's role
      final profileData = await supabase
          .from('profiles')
          .select('role')
          .eq('id', actorId)
          .single();

      final role = profileData['role'] as String? ?? 'employee';
      final isAdmin = role == 'admin';
      final isAccountant = role == 'accountant';

      String newStatus;
      String action;

      if (advance.status == 'pending_manager' &&
          (advance.managerId == actorId || isAdmin)) {
        newStatus = 'pending_accountant';
        action = 'manager_approved';
      } else if (advance.status == 'pending_accountant' &&
          (advance.accountantId == actorId || isAdmin || isAccountant)) {
        newStatus = 'active';
        action = 'accountant_approved';
      } else {
        throw Exception(
            'You are not authorized to approve this advance');
      }

      final updateObj = <String, dynamic>{'status': newStatus};
      if (action == 'manager_approved') {
        updateObj['manager_action_at'] = DateTime.now().toIso8601String();
      }
      if (action == 'accountant_approved') {
        updateObj['accountant_action_at'] = DateTime.now().toIso8601String();
      }

      await supabase
          .from('advances')
          .update(updateObj)
          .eq('id', advanceId);

      // Add history
      await supabase.from('advance_history').insert({
        'advance_id': advanceId,
        'action': action,
        'acted_by': actorId,
        'previous_status': advance.status,
        'new_status': newStatus,
      });
    } catch (e) {
      debugPrint('approveAdvance error: $e');
      throw Exception('Failed to approve advance: $e');
    }
  }

  /// Rejects the advance identified by [advanceId].
  ///
  /// [reason] is stored as the rejection reason and shown to the submitter.
  Future<void> rejectAdvance(
    String advanceId,
    String actorId,
    String reason,
  ) async {
    try {
      final advData = await supabase
          .from('advances')
          .select()
          .eq('id', advanceId)
          .single();

      final advance = Advance.fromJson(advData);

      final action = advance.status == 'pending_manager'
          ? 'manager_rejected'
          : 'accountant_rejected';

      await supabase.from('advances').update({
        'status': 'rejected',
        'rejection_reason': reason.isNotEmpty ? reason : null,
        'rejected_by': actorId,
      }).eq('id', advanceId);

      // Add history
      await supabase.from('advance_history').insert({
        'advance_id': advanceId,
        'action': action,
        'acted_by': actorId,
        'comments': reason.isNotEmpty ? reason : null,
        'previous_status': advance.status,
        'new_status': 'rejected',
      });
    } catch (e) {
      debugPrint('rejectAdvance error: $e');
      throw Exception('Failed to reject advance: $e');
    }
  }
}
