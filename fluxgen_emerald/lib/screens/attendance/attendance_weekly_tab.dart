import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'widgets/weekly_grid.dart';

class AttendanceWeeklyTab extends ConsumerWidget {
  const AttendanceWeeklyTab({super.key, required this.isAdmin});
  final bool isAdmin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(viewModeProvider);
    final isAdminMode = isAdmin && mode == ViewMode.admin;
    final dates = currentWeekDates();
    final from = dates.first;
    final to = dates.last;

    final myEmpId = ref.watch(myEmpIdProvider);
    final employeesAsync = ref.watch(employeesProvider);

    final params = isAdminMode
        ? WeekRangeParams(from: from, to: to, empId: 'ALL')
        : WeekRangeParams(from: from, to: to, empId: myEmpId ?? '');
    final weekAsync = ref.watch(weekStatusProvider(params));

    Future<void> refresh() async {
      ref.invalidate(weekStatusProvider(params));
      if (isAdminMode) ref.invalidate(employeesProvider);
      await ref.read(weekStatusProvider(params).future);
    }

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            isAdminMode ? 'Team — this week' : 'My week',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$from  →  $to',
            style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          weekAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (e, _) => _error(context, e.toString(), refresh),
            data: (entries) {
              if (isAdminMode) {
                final employees = employeesAsync.valueOrNull ?? const [];
                if (employees.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('No employees found')),
                  );
                }
                return WeeklyGrid(
                  dates: dates,
                  entries: entries,
                  employees: employees,
                  todayStr: fluxgenTodayStr(),
                );
              }
              // Employee mode — find self
              final employees = employeesAsync.valueOrNull ?? const [];
              FluxgenEmployee? self;
              for (final e in employees) {
                if (e.id == myEmpId) { self = e; break; }
              }
              if (self == null) {
                return _noSelf(context);
              }
              return WeeklyGrid(
                dates: dates,
                entries: entries,
                employees: [self],
                todayStr: fluxgenTodayStr(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _error(BuildContext context, String msg, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(Icons.error_outline, color: AppColors.error, size: 36),
          const SizedBox(height: 8),
          Text('Could not load: $msg',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _noSelf(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Text(
          'Link your employee record on the Update tab first.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
        ),
      ),
    );
  }
}
