import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/expense.dart';
import '../providers/auth_provider.dart';
import '../services/expense_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────

/// Provides a singleton [ExpenseService] instance.
final expenseServiceProvider = Provider<ExpenseService>((ref) {
  return ExpenseService();
});

// ─── Expense List (Async) ────────────────────────────────────────────────

/// Parameters for the expense list query.
@immutable
class ExpenseFilter {
  const ExpenseFilter({
    this.limit = 50,
    this.offset = 0,
    this.search,
    this.category,
    this.dateFrom,
    this.dateTo,
  });

  final int limit;
  final int offset;
  final String? search;
  final String? category;
  final String? dateFrom;
  final String? dateTo;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExpenseFilter &&
          limit == other.limit &&
          offset == other.offset &&
          search == other.search &&
          category == other.category &&
          dateFrom == other.dateFrom &&
          dateTo == other.dateTo;

  @override
  int get hashCode => Object.hash(limit, offset, search, category, dateFrom, dateTo);
}

/// Holds the current expense filter parameters.
///
/// Modify this to trigger a re-fetch of [expensesProvider].
final expenseFilterProvider = StateProvider<ExpenseFilter>((ref) {
  return const ExpenseFilter();
});

/// Fetches the current user's expenses based on [expenseFilterProvider].
///
/// Re-fetches automatically when:
///   - The user changes (auth state)
///   - The filter parameters change
final expensesProvider = FutureProvider<List<Expense>>((ref) async {
  final userAsync = ref.watch(currentUserProvider);
  final filter = ref.watch(expenseFilterProvider);

  final user = userAsync.valueOrNull;
  if (user == null) return [];

  final service = ref.read(expenseServiceProvider);

  return service.getExpenses(
    user.id,
    limit: filter.limit,
    offset: filter.offset,
    search: filter.search,
    category: filter.category,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
  );
});

// ─── Expense Stats ───────────────────────────────────────────────────────

/// Simple stats for the dashboard.
@immutable
class ExpenseStats {
  const ExpenseStats({
    this.totalCount = 0,
    this.thisMonthTotal = 0,
  });

  final int totalCount;
  final double thisMonthTotal;
}

/// Fetches aggregate stats (total count + this month's spending) for the
/// current user.
final expenseStatsProvider = FutureProvider<ExpenseStats>((ref) async {
  final userAsync = ref.watch(currentUserProvider);
  final user = userAsync.valueOrNull;
  if (user == null) return const ExpenseStats();

  final service = ref.read(expenseServiceProvider);

  final results = await Future.wait([
    service.getExpenseCount(user.id),
    service.getThisMonthTotal(user.id),
  ]);

  return ExpenseStats(
    totalCount: results[0] as int,
    thisMonthTotal: results[1] as double,
  );
});

// ─── Expense Mutation Notifier ───────────────────────────────────────────

/// [StateNotifier] for performing expense mutations (create, update, delete)
/// and automatically invalidating the relevant providers afterwards.
class ExpenseMutationNotifier extends StateNotifier<AsyncValue<void>> {
  ExpenseMutationNotifier(this._ref, this._service)
      : super(const AsyncData(null));

  final Ref _ref;
  final ExpenseService _service;

  /// Creates a new expense and refreshes the list + stats.
  Future<Expense?> createExpense(Expense expense) async {
    state = const AsyncLoading();
    try {
      final created = await _service.createExpense(expense);
      _invalidate();
      state = const AsyncData(null);
      return created;
    } catch (e, st) {
      state = AsyncError(e, st);
      return null;
    }
  }

  /// Updates an expense and refreshes the list + stats.
  Future<Expense?> updateExpense(Expense expense) async {
    state = const AsyncLoading();
    try {
      final updated = await _service.updateExpense(expense);
      _invalidate();
      state = const AsyncData(null);
      return updated;
    } catch (e, st) {
      state = AsyncError(e, st);
      return null;
    }
  }

  /// Deletes an expense and refreshes the list + stats.
  Future<bool> deleteExpense(String id, String userId) async {
    state = const AsyncLoading();
    try {
      await _service.deleteExpense(id, userId);
      _invalidate();
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e, st);
      return false;
    }
  }

  /// Invalidates all expense-related providers so they re-fetch.
  void _invalidate() {
    _ref.invalidate(expensesProvider);
    _ref.invalidate(expenseStatsProvider);
  }
}

/// Provider for the [ExpenseMutationNotifier].
final expenseMutationProvider =
    StateNotifierProvider<ExpenseMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.watch(expenseServiceProvider);
  return ExpenseMutationNotifier(ref, service);
});
