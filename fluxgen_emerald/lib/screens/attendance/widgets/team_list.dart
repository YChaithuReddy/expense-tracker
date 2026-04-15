import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

class TeamList extends StatelessWidget {
  const TeamList({
    super.key,
    required this.employees,
    required this.statusByEmpId,
    required this.filter,      // null = show all; .unknown = show Available
    required this.isAdminMode,
    this.onEdit,               // admin-only edit tap
  });

  final List<FluxgenEmployee> employees;
  final Map<String, StatusEntry> statusByEmpId;
  final AttendanceStatus? filter;
  final bool isAdminMode;
  final void Function(FluxgenEmployee, StatusEntry?)? onEdit;

  @override
  Widget build(BuildContext context) {
    final filtered = <FluxgenEmployee>[];
    for (final emp in employees) {
      final entry = statusByEmpId[emp.id];
      final effective = entry?.status ?? AttendanceStatus.unknown;
      if (filter == null || filter == effective) filtered.add(emp);
    }
    if (filtered.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Text(
            'No employees match this filter.',
            style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
          ),
        ),
      );
    }
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: filtered.length,
      separatorBuilder: (_, __) => const SizedBox(height: 6),
      itemBuilder: (context, i) {
        final emp = filtered[i];
        final entry = statusByEmpId[emp.id];
        return _row(context, emp, entry);
      },
    );
  }

  Widget _row(BuildContext context, FluxgenEmployee emp, StatusEntry? entry) {
    final status = entry?.status ?? AttendanceStatus.unknown;
    final color = AppColors.forAttendanceStatus(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.18),
            foregroundColor: color,
            radius: 18,
            child: Text(
              emp.name.isEmpty ? '?' : emp.name[0].toUpperCase(),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  emp.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                Text(
                  _detailLine(entry),
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.onSurfaceVariant,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              entry == null ? 'Not updated' : status.label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
          if (isAdminMode) ...[
            const SizedBox(width: 4),
            IconButton(
              tooltip: 'Edit',
              onPressed:
                  onEdit == null ? null : () => onEdit!(emp, entry),
              icon: Icon(Icons.edit_outlined,
                  size: 18, color: AppColors.onSurfaceVariant),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ],
      ),
    );
  }

  String _detailLine(StatusEntry? e) {
    if (e == null) return 'No status for today yet';
    if (e.status == AttendanceStatus.onSite && e.siteName.isNotEmpty) {
      return '${e.siteName} · ${e.workType.isEmpty ? "—" : e.workType}';
    }
    if (e.workType.isNotEmpty) return e.workType;
    return e.status.label;
  }
}
