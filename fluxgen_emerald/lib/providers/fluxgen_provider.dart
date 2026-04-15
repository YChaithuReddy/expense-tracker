import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/fluxgen_api.dart';
import '../models/fluxgen_status.dart';
import '../services/fluxgen_api_service.dart';

// ── Service singleton ──────────────────────────────────────────────────────

final fluxgenApiProvider =
    Provider<FluxgenApiService>((_) => FluxgenApiService());

// ── EmpID mapping (persisted via SharedPreferences) ────────────────────────

class MyEmpIdNotifier extends StateNotifier<String?> {
  MyEmpIdNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getString(FluxgenApi.prefEmpId);
  }

  Future<void> set(String empId, String empName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(FluxgenApi.prefEmpId, empId);
    await prefs.setString(FluxgenApi.prefEmpName, empName);
    state = empId;
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(FluxgenApi.prefEmpId);
    await prefs.remove(FluxgenApi.prefEmpName);
    state = null;
  }
}

final myEmpIdProvider =
    StateNotifierProvider<MyEmpIdNotifier, String?>((_) => MyEmpIdNotifier());

/// Cached lookup for the user's display name. Read-only convenience.
final myEmpNameProvider = FutureProvider<String?>((ref) async {
  // Watching myEmpIdProvider ensures this refreshes when EmpID changes.
  ref.watch(myEmpIdProvider);
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(FluxgenApi.prefEmpName);
});

// ── View mode (Employee↔Admin toggle, in-memory per session) ───────────────

enum ViewMode { employee, admin }

final viewModeProvider = StateProvider<ViewMode>((_) => ViewMode.employee);

// ── Data providers ─────────────────────────────────────────────────────────

final employeesProvider =
    FutureProvider<List<FluxgenEmployee>>((ref) async {
  return ref.watch(fluxgenApiProvider).getEmployees();
});

/// Today's status for all employees. Family key = YYYY-MM-DD.
final todayStatusProvider =
    FutureProvider.family<List<StatusEntry>, String>((ref, date) async {
  return ref.watch(fluxgenApiProvider).getStatus(date);
});

/// Parameters for weekly-range queries.
class WeekRangeParams {
  const WeekRangeParams({
    required this.from,
    required this.to,
    required this.empId,
  });
  final String from;  // YYYY-MM-DD
  final String to;    // YYYY-MM-DD
  final String empId; // 'ALL' for admin-mode full matrix

  @override
  bool operator ==(Object other) =>
      other is WeekRangeParams &&
      other.from == from &&
      other.to == to &&
      other.empId == empId;
  @override
  int get hashCode => Object.hash(from, to, empId);
}

final weekStatusProvider =
    FutureProvider.family<List<StatusEntry>, WeekRangeParams>((ref, p) async {
  return ref
      .watch(fluxgenApiProvider)
      .getStatusRange(from: p.from, to: p.to, empId: p.empId);
});

// ── Date helpers ───────────────────────────────────────────────────────────

String fluxgenDateFormat(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

String fluxgenTodayStr() => fluxgenDateFormat(DateTime.now());

/// Returns Monday of the current week (Monday-based ISO week).
DateTime currentWeekMonday([DateTime? now]) {
  final n = now ?? DateTime.now();
  return DateTime(n.year, n.month, n.day).subtract(Duration(days: n.weekday - 1));
}

/// Returns a list of 7 YYYY-MM-DD strings Mon..Sun for the current week.
List<String> currentWeekDates([DateTime? now]) {
  final mon = currentWeekMonday(now);
  return [for (int i = 0; i < 7; i++) fluxgenDateFormat(mon.add(Duration(days: i)))];
}
