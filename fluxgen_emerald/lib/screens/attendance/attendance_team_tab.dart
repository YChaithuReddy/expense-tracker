import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'widgets/team_list.dart';
import 'widgets/team_stats_row.dart';
import 'widgets/work_done_sheet.dart';

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

    final parsed = DateTime.tryParse(today);
    final niceDate =
        parsed == null ? today : DateFormat('EEEE, d MMM').format(parsed);

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          _TeamHeader(title: 'Team today', subtitle: niceDate),
          const SizedBox(height: 14),
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
        child: Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
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
    final available =
        (employees.length - statusByEmpId.length).clamp(0, 9999);

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
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: TeamList(
            employees: employees,
            statusByEmpId: statusByEmpId,
            filter: _filter,
            isAdminMode: isAdminMode,
            onEdit: isAdminMode
                ? (emp, entry) {
                    WorkDoneSheet.show(
                      context,
                      empId: emp.id,
                      empName: emp.name,
                      date: fluxgenTodayStr(),
                      existing: entry,
                    );
                  }
                : null,
          ),
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
              style: TextStyle(
                  fontSize: 12, color: AppColors.onSurfaceVariant)),
        ],
      ),
    );
  }
}

class _TeamHeader extends StatelessWidget {
  const _TeamHeader({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.groups_rounded,
              color: Color(0xFF10B981), size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
