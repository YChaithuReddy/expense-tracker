import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/network/supabase_client.dart';
import '../models/expense.dart';

/// Service for expense CRUD operations against the Supabase `expenses` table.
///
/// All methods require an authenticated session (enforced by Supabase RLS).
/// Errors are caught and re-thrown with descriptive messages.
class ExpenseService {
  ExpenseService();

  // ─── Read ──────────────────────────────────────────────────────────────

  /// Fetches expenses for [userId] with optional filtering and pagination.
  ///
  /// Results are ordered by date (newest first), then by created_at.
  Future<List<Expense>> getExpenses(
    String userId, {
    int limit = 50,
    int offset = 0,
    String? search,
    String? category,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      // Build filter chain FIRST (all .eq/.gte/.lte/.or calls),
      // then apply .order and .range LAST (transform calls).
      var query = supabase
          .from('expenses')
          .select('*, expense_images(id, storage_path, public_url, filename)')
          .eq('user_id', userId);

      // Category filter
      if (category != null && category.isNotEmpty && category != 'all') {
        query = query.eq('category', category);
      }

      // Date range filter
      if (dateFrom != null && dateFrom.isNotEmpty) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo != null && dateTo.isNotEmpty) {
        query = query.lte('date', dateTo);
      }

      // Search by vendor or description
      if (search != null && search.isNotEmpty) {
        query = query.or(
            'vendor.ilike.%$search%,description.ilike.%$search%');
      }

      // Transform: order + pagination (must come after all filters)
      final data = await query
          .order('date', ascending: false)
          .order('created_at', ascending: false)
          .range(offset, offset + limit - 1);

      return (data as List<dynamic>)
          .map((row) => Expense.fromJson(row as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getExpenses error: $e');
      throw Exception('Failed to load expenses: $e');
    }
  }

  /// Creates a new expense and returns the inserted row.
  Future<Expense> createExpense(Expense expense) async {
    try {
      final data = await supabase
          .from('expenses')
          .insert(expense.toInsertJson())
          .select()
          .single();

      return Expense.fromJson(data);
    } catch (e) {
      debugPrint('createExpense error: $e');
      throw Exception('Failed to create expense: $e');
    }
  }

  /// Updates an existing expense and returns the updated row.
  Future<Expense> updateExpense(Expense expense) async {
    try {
      final dateStr = expense.date.toIso8601String().split('T').first;

      final updateData = <String, dynamic>{
        'date': dateStr,
        'time': expense.time,
        'category': expense.category,
        'amount': expense.amount,
        'vendor': expense.vendor,
        'description': expense.description,
        'visit_type': expense.visitType,
        'payment_mode': expense.paymentMode,
        'bill_attached': expense.billAttached,
        'advance_id': expense.advanceId,
        'project_id': expense.projectId,
        'updated_at': DateTime.now().toIso8601String(),
      };

      final data = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', expense.id)
          .eq('user_id', expense.userId)
          .select('*, expense_images(id, storage_path, public_url, filename)')
          .single();

      return Expense.fromJson(data);
    } catch (e) {
      debugPrint('updateExpense error: $e');
      throw Exception('Failed to update expense: $e');
    }
  }

  /// Deletes the expense with [id]. Also removes associated images
  /// from Supabase Storage.
  Future<void> deleteExpense(String id, String userId) async {
    try {
      // Fetch image paths so we can clean up storage.
      final images = await supabase
          .from('expense_images')
          .select('storage_path')
          .eq('expense_id', id);

      final paths = (images as List<dynamic>)
          .map((row) => row['storage_path'] as String?)
          .where((p) => p != null && p.isNotEmpty)
          .cast<String>()
          .toList();

      // Delete from storage (best-effort).
      if (paths.isNotEmpty) {
        try {
          await supabase.storage.from('expense-bills').remove(paths);
        } catch (e) {
          debugPrint('Storage cleanup warning: $e');
        }
      }

      // Delete the expense row (cascade removes expense_images).
      await supabase
          .from('expenses')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
    } catch (e) {
      debugPrint('deleteExpense error: $e');
      throw Exception('Failed to delete expense: $e');
    }
  }

  // ─── Aggregates ────────────────────────────────────────────────────────

  /// Returns the total number of expenses for [userId].
  Future<int> getExpenseCount(String userId) async {
    try {
      // Use head:true + count:exact to avoid returning rows.
      final response = await supabase
          .from('expenses')
          .select()
          .eq('user_id', userId)
          .count(CountOption.exact);

      return response.count;
    } catch (e) {
      debugPrint('getExpenseCount error: $e');
      return 0;
    }
  }

  /// Returns the sum of all expense amounts for [userId] in the current
  /// calendar month.
  Future<double> getThisMonthTotal(String userId) async {
    try {
      final now = DateTime.now();
      final firstOfMonth =
          DateTime(now.year, now.month, 1).toIso8601String().split('T').first;
      // Last day of month
      final lastOfMonth = DateTime(now.year, now.month + 1, 0)
          .toIso8601String()
          .split('T')
          .first;

      final data = await supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', userId)
          .gte('date', firstOfMonth)
          .lte('date', lastOfMonth);

      final rows = data as List<dynamic>;
      double total = 0;
      for (final row in rows) {
        final amt = row['amount'];
        if (amt is num) {
          total += amt.toDouble();
        } else if (amt is String) {
          total += double.tryParse(amt) ?? 0;
        }
      }
      return total;
    } catch (e) {
      debugPrint('getThisMonthTotal error: $e');
      return 0;
    }
  }
}
