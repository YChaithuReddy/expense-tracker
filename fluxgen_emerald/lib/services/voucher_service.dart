import 'package:flutter/foundation.dart';

import '../core/network/supabase_client.dart';
import '../models/voucher.dart';

/// Service for voucher workflow against the Supabase `vouchers` table.
///
/// Voucher lifecycle:
///   pending_manager -> manager_approved/pending_accountant -> approved -> reimbursed
///
/// Vouchers bundle multiple expenses (linked via `voucher_expenses` junction
/// table) into a single approval request.
class VoucherService {
  VoucherService();

  /// The select clause used for voucher queries with FK-joined profiles.
  static const _voucherSelect = '''
    *,
    submitter:submitted_by(id, name, email, employee_id, profile_picture),
    manager:manager_id(id, name, email),
    accountant:accountant_id(id, name, email),
    project:project_id(id, project_code, project_name)
  ''';

  // ─── Read ──────────────────────────────────────────────────────────────

  /// Fetches vouchers awaiting approval based on the viewer's [role].
  ///
  /// Uses Supabase FK joins on `submitted_by`, `manager_id`, `accountant_id`,
  /// and `project_id` to include nested profile / project data.
  Future<List<Voucher>> getVouchersForApproval({
    required String role,
    required String userId,
    String? orgId,
  }) async {
    try {
      // Build filter chain FIRST, then order LAST.
      var query = supabase.from('vouchers').select(_voucherSelect);

      switch (role) {
        case 'manager':
          query = query
              .eq('manager_id', userId)
              .inFilter('status', ['pending_manager']);
          break;

        case 'accountant':
          query = query.eq('accountant_id', userId).inFilter(
              'status', ['manager_approved', 'pending_accountant']);
          break;

        case 'admin':
          if (orgId != null) {
            query = query.eq('organization_id', orgId).inFilter('status', [
              'pending_manager',
              'pending_accountant',
              'manager_approved',
            ]);
          }
          break;

        default:
          // Employee — show their own vouchers
          query = query.eq('submitted_by', userId);
          break;
      }

      // Order AFTER all filters
      final data = await query.order('submitted_at', ascending: false);

      return (data as List<dynamic>)
          .map((row) => Voucher.fromJson(row as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getVouchersForApproval error: $e');
      throw Exception('Failed to load vouchers: $e');
    }
  }

  // ─── Create ────────────────────────────────────────────────────────────

  /// Creates a new voucher linking the given [expenseIds].
  ///
  /// Steps:
  ///   1. Calculate total amount from the selected expenses
  ///   2. Generate a voucher number via RPC (falls back to timestamp)
  ///   3. Insert the voucher row
  ///   4. Link expenses via `voucher_expenses` junction table
  ///   5. Update expense `voucher_status` to 'submitted'
  ///   6. Add history entry
  Future<Voucher> createVoucher(
    Voucher voucher,
    List<String> expenseIds,
  ) async {
    try {
      // 1. Calculate total from expenses
      final expensesData = await supabase
          .from('expenses')
          .select('amount')
          .inFilter('id', expenseIds);

      double totalAmount = 0;
      for (final row in (expensesData as List<dynamic>)) {
        final amt = row['amount'];
        if (amt is num) {
          totalAmount += amt.toDouble();
        }
      }

      // 2. Generate voucher number
      String voucherNumber;
      try {
        final numResult = await supabase.rpc(
          'generate_voucher_number',
          params: {'p_org_id': voucher.organizationId},
        );
        voucherNumber =
            (numResult as String?) ?? 'VCH-${DateTime.now().millisecondsSinceEpoch}';
      } catch (_) {
        voucherNumber = 'VCH-${DateTime.now().millisecondsSinceEpoch}';
      }

      // 3. Insert voucher
      final insertData = <String, dynamic>{
        'organization_id': voucher.organizationId,
        'submitted_by': voucher.submittedBy,
        'manager_id': voucher.managerId,
        'accountant_id': voucher.accountantId,
        'status': 'pending_manager',
        'voucher_number': voucherNumber,
        'total_amount': totalAmount,
        'expense_count': expenseIds.length,
        'submitted_at': DateTime.now().toIso8601String(),
      };
      if (voucher.purpose != null) insertData['purpose'] = voucher.purpose;
      if (voucher.advanceId != null) insertData['advance_id'] = voucher.advanceId;
      if (voucher.projectId != null) insertData['project_id'] = voucher.projectId;
      if (voucher.googleSheetUrl != null) {
        insertData['google_sheet_url'] = voucher.googleSheetUrl;
      }
      if (voucher.pdfUrl != null) insertData['pdf_url'] = voucher.pdfUrl;
      if (voucher.pdfFilename != null) {
        insertData['pdf_filename'] = voucher.pdfFilename;
      }

      final data = await supabase
          .from('vouchers')
          .insert(insertData)
          .select()
          .single();

      final created = Voucher.fromJson(data);
      final voucherId = created.id;

      // 4. Link expenses via junction table
      final links = expenseIds
          .map((eid) => {'voucher_id': voucherId, 'expense_id': eid})
          .toList();

      try {
        await supabase.from('voucher_expenses').insert(links);
      } catch (e) {
        debugPrint('voucher_expenses link error (non-fatal): $e');
      }

      // 5. Update expense voucher_status
      try {
        await supabase
            .from('expenses')
            .update({'voucher_status': 'submitted'})
            .inFilter('id', expenseIds)
            .eq('user_id', voucher.submittedBy);
      } catch (e) {
        debugPrint('expense voucher_status update warning: $e');
      }

      // 6. Add history entry
      try {
        await supabase.from('voucher_history').insert({
          'voucher_id': voucherId,
          'action': 'submitted',
          'acted_by': voucher.submittedBy,
          'previous_status': 'draft',
          'new_status': 'pending_manager',
          'comments': voucher.purpose ?? 'Voucher submitted for approval',
        });
      } catch (e) {
        debugPrint('voucher_history insert warning: $e');
      }

      return created;
    } catch (e) {
      debugPrint('createVoucher error: $e');
      throw Exception('Failed to create voucher: $e');
    }
  }

  // ─── Approve / Reject ──────────────────────────────────────────────────

  /// Approves the voucher identified by [voucherId].
  ///
  /// Transition:
  ///   pending_manager (by manager) -> pending_accountant
  ///   pending_accountant / manager_approved (by accountant) -> approved
  ///
  /// When fully approved, linked expense statuses are updated to 'approved'.
  Future<void> approveVoucher(String voucherId, String actorId) async {
    try {
      final vData = await supabase
          .from('vouchers')
          .select('status, manager_id, accountant_id')
          .eq('id', voucherId)
          .single();

      final currentStatus = vData['status'] as String;
      final managerId = vData['manager_id'] as String?;
      final accountantId = vData['accountant_id'] as String?;

      String newStatus;
      String action;
      final timestamp = <String, dynamic>{};

      if (currentStatus == 'pending_manager' && managerId == actorId) {
        newStatus = 'pending_accountant';
        action = 'manager_approved';
        timestamp['manager_action_at'] = DateTime.now().toIso8601String();
      } else if ((currentStatus == 'manager_approved' ||
              currentStatus == 'pending_accountant') &&
          accountantId == actorId) {
        newStatus = 'approved';
        action = 'accountant_approved';
        timestamp['accountant_action_at'] = DateTime.now().toIso8601String();
      } else {
        throw Exception(
            'You are not authorized to approve this voucher in its current state');
      }

      // Update voucher
      await supabase
          .from('vouchers')
          .update({'status': newStatus, ...timestamp})
          .eq('id', voucherId);

      // If fully approved, update expense statuses
      if (newStatus == 'approved') {
        final links = await supabase
            .from('voucher_expenses')
            .select('expense_id')
            .eq('voucher_id', voucherId);

        final expenseIds = (links as List<dynamic>)
            .map((l) => l['expense_id'] as String)
            .toList();

        if (expenseIds.isNotEmpty) {
          await supabase
              .from('expenses')
              .update({'voucher_status': 'approved'})
              .inFilter('id', expenseIds);
        }
      }

      // Add history
      await supabase.from('voucher_history').insert({
        'voucher_id': voucherId,
        'action': action,
        'acted_by': actorId,
        'previous_status': currentStatus,
        'new_status': newStatus,
      });
    } catch (e) {
      debugPrint('approveVoucher error: $e');
      throw Exception('Failed to approve voucher: $e');
    }
  }

  /// Rejects the voucher identified by [voucherId].
  ///
  /// [reason] is required and stored for display to the submitter.
  /// Linked expense voucher_status is reverted to 'rejected'.
  Future<void> rejectVoucher(
    String voucherId,
    String actorId,
    String reason,
  ) async {
    if (reason.trim().isEmpty) {
      throw ArgumentError('Rejection reason is required');
    }

    try {
      final vData = await supabase
          .from('vouchers')
          .select('status, manager_id, accountant_id')
          .eq('id', voucherId)
          .single();

      final currentStatus = vData['status'] as String;
      final managerId = vData['manager_id'] as String?;
      final accountantId = vData['accountant_id'] as String?;

      String action;
      if (currentStatus == 'pending_manager' && managerId == actorId) {
        action = 'manager_rejected';
      } else if ((currentStatus == 'manager_approved' ||
              currentStatus == 'pending_accountant') &&
          accountantId == actorId) {
        action = 'accountant_rejected';
      } else {
        throw Exception(
            'You are not authorized to reject this voucher in its current state');
      }

      // Update voucher
      await supabase.from('vouchers').update({
        'status': 'rejected',
        'rejection_reason': reason,
        'rejected_by': actorId,
      }).eq('id', voucherId);

      // Revert expense statuses
      final links = await supabase
          .from('voucher_expenses')
          .select('expense_id')
          .eq('voucher_id', voucherId);

      final expenseIds = (links as List<dynamic>)
          .map((l) => l['expense_id'] as String)
          .toList();

      if (expenseIds.isNotEmpty) {
        await supabase
            .from('expenses')
            .update({'voucher_status': 'rejected'})
            .inFilter('id', expenseIds);
      }

      // Add history
      await supabase.from('voucher_history').insert({
        'voucher_id': voucherId,
        'action': action,
        'acted_by': actorId,
        'comments': reason,
        'previous_status': currentStatus,
        'new_status': 'rejected',
      });
    } catch (e) {
      debugPrint('rejectVoucher error: $e');
      throw Exception('Failed to reject voucher: $e');
    }
  }

  // ─── Payment ───────────────────────────────────────────────────────────

  /// Marks the voucher as reimbursed with payment details.
  Future<void> markVoucherPaid(
    String voucherId, {
    required String paymentMethod,
    String? paymentReference,
    required String paidBy,
  }) async {
    try {
      await supabase.from('vouchers').update({
        'status': 'reimbursed',
        'payment_date': DateTime.now().toIso8601String().split('T').first,
        'payment_method': paymentMethod,
        'payment_reference': paymentReference,
        'paid_by': paidBy,
      }).eq('id', voucherId);

      // Add history
      await supabase.from('voucher_history').insert({
        'voucher_id': voucherId,
        'action': 'reimbursed',
        'acted_by': paidBy,
        'comments':
            'Paid via $paymentMethod${paymentReference != null && paymentReference.isNotEmpty ? ' (Ref: $paymentReference)' : ''}',
        'previous_status': 'approved',
        'new_status': 'reimbursed',
      });
    } catch (e) {
      debugPrint('markVoucherPaid error: $e');
      throw Exception('Failed to mark voucher as paid: $e');
    }
  }
}
