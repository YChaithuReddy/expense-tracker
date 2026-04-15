import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'widgets/team_list.dart';
import 'widgets/team_stats_row.dart';

class AttendanceTeamTab extends ConsumerStatefulWidget {
  const AttendanceTeamTab({super.key, required this.isAdmin});
  final bool isAdmin;

  @override
  ConsumerState<AttendanceTeamTab> createState() => _AttendanceTeamTabState();
}

class _AttendanceTeamTabState extends ConsumerState<AttendanceTeamTab> {
  AttendanceStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(viewModeProvider);
    final isAdminMode = widget.isAdmin && mode == ViewMode.admin;
    final today = fluxgenTodayStr();
    final employeesAsync = ref.watch(employeesProvider);
    final statusAsync = ref.watch(todayStatusProvider(today));

    Future<void> refresh() async {
      ref.invalidate(employeesProvider);
      ref.invalidate(todayStatusProvider(today));
      await ref.read(todayStatusProvider(today).future);
    }

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Team today — $today',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          _content(employeesAsync, statusAsync, isAdminMode),
        ],
      ),
    );
  }

  Widget _content(
    AsyncValue<List<FluxgenEmployee>> employeesAsync,
    AsyncValue<List<StatusEntry>> statusAsync,
    bool isAdminMode,
  ) {
    if (employeesAsync.isLoading || statusAsync.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    if (employeesAsync.hasError) {
      return _errorBox(employeesAsync.error.toString());
    }
    if (statusAsync.hasError) {
      return _errorBox(statusAsync.error.toString());
    }
    final employees = employeesAsync.valueOrNull ?? const [];
    final entries = statusAsync.valueOrNull ?? const [];
    final statusByEmpId = <String, StatusEntry>{
      for (final e in entries) e.empId: e,
    };

    int countOf(AttendanceStatus s) =>
        statusByEmpId.values.where((e) => e.status == s).length;
    final onSite = countOf(AttendanceStatus.onSite);
    final inOffice = countOf(AttendanceStatus.inOffice) +
        countOf(AttendanceStatus.workFromHome);
    final onLeave = countOf(AttendanceStatus.onLeave) +
        countOf(AttendanceStatus.holiday) +
        countOf(AttendanceStatus.weekend);
    final available = (employees.length - statusByEmpId.length).clamp(0, 9999);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TeamStatsRow(
          onSiteCount: onSite,
          inOfficeCount: inOffice,
          onLeaveCount: onLeave,
          availableCount: available,
          activeFilter: _filter,
          onFilter: (s) => setState(() => _filter = s),
        ),
        const SizedBox(height: 16),
        TeamList(
          employees: employees,
          statusByEmpId: statusByEmpId,
          filter: _filter,
          isAdminMode: isAdminMode,
          onEdit: isAdminMode
              ? (emp, entry) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text(
                            'Edit flow coming in Phase 2 — switch to Update tab for now')),
                  );
                }
              : null,
        ),
      ],
    );
  }

  Widget _errorBox(String msg) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(Icons.error_outline, color: AppColors.error, size: 36),
          const SizedBox(height: 8),
          Text(msg,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
        ],
      ),
    );
  }
}
