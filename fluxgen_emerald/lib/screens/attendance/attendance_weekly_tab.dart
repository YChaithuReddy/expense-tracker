import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

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

    final fromLabel =
        DateFormat('d MMM').format(DateTime.parse(from));
    final toLabel = DateFormat('d MMM').format(DateTime.parse(to));

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          _WeekHeader(
            title: isAdminMode ? 'Team · this week' : 'My week',
            range: '$fromLabel – $toLabel',
          ),
          const SizedBox(height: 14),
          weekAsync.when(
            loading: () => _loadingBox(),
            error: (e, _) => _error(context, e.toString(), refresh),
            data: (entries) {
              if (isAdminMode) {
                final employees = employeesAsync.valueOrNull ?? const [];
                if (employees.isEmpty) return _emptyBox('No employees found');
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _WeekSummaryCard(entries: entries),
                    const SizedBox(height: 14),
                    _CardContainer(
                      child: WeeklyGrid(
                        dates: dates,
                        entries: entries,
                        employees: employees,
                        todayStr: fluxgenTodayStr(),
                      ),
                    ),
                  ],
                );
              }
              // Employee mode — find self
              final employees = employeesAsync.valueOrNull ?? const [];
              FluxgenEmployee? self;
              for (final e in employees) {
                if (e.id == myEmpId) { self = e; break; }
              }
              if (self == null) return _noSelf(context);

              final myEntries = [
                for (final e in entries) if (e.empId == self.id) e,
              ];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _WeekSummaryCard(entries: myEntries),
                  const SizedBox(height: 14),
                  _CardContainer(
                    child: WeeklyGrid(
                      dates: dates,
                      entries: myEntries,
                      employees: [self],
                      todayStr: fluxgenTodayStr(),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _loadingBox() => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );

  Widget _emptyBox(String msg) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Center(
          child: Text(msg,
              style:
                  TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13)),
        ),
      );

  Widget _error(BuildContext context, String msg, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(Icons.error_outline, color: AppColors.error, size: 36),
          const SizedBox(height: 8),
          Text('Could not load: $msg',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12, color: AppColors.onSurfaceVariant)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _noSelf(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text(
          'Link your employee record on the Update tab first.',
          textAlign: TextAlign.center,
          style:
              TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
        ),
      ),
    );
  }
}

class _WeekHeader extends StatelessWidget {
  const _WeekHeader({required this.title, required this.range});
  final String title;
  final String range;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.calendar_today_rounded,
              color: AppColors.primary, size: 18),
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
                range,
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

class _WeekSummaryCard extends StatelessWidget {
  const _WeekSummaryCard({required this.entries});
  final List<StatusEntry> entries;

  @override
  Widget build(BuildContext context) {
    int c(AttendanceStatus s) =>
        entries.where((e) => e.status == s).length;
    final items = <(String, AttendanceStatus, int)>[
      ('On Site', AttendanceStatus.onSite, c(AttendanceStatus.onSite)),
      ('In Office', AttendanceStatus.inOffice, c(AttendanceStatus.inOffice)),
      ('WFH', AttendanceStatus.workFromHome, c(AttendanceStatus.workFromHome)),
      ('Leave', AttendanceStatus.onLeave,
          c(AttendanceStatus.onLeave) + c(AttendanceStatus.holiday)),
    ];
    return _CardContainer(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      child: Row(
        children: [
          for (final (label, s, count) in items)
            Expanded(child: _SummaryPill(label: label, status: s, count: count)),
        ],
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill(
      {required this.label, required this.status, required this.count});
  final String label;
  final AttendanceStatus status;
  final int count;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forAttendanceStatus(status);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text(
            '$count',
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: color),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _CardContainer extends StatelessWidget {
  const _CardContainer({required this.child, this.padding});
  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(14),
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
      child: child,
    );
  }
}
