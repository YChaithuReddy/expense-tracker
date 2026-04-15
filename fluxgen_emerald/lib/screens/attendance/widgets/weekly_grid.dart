import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

/// Renders the weekly view. Two modes:
/// - Single-employee (`employees.length == 1`): horizontal day-chip scroll.
/// - Multi-employee matrix: rows = employees, cols = days.
class WeeklyGrid extends StatelessWidget {
  const WeeklyGrid({
    super.key,
    required this.dates,      // 7 strings YYYY-MM-DD (Mon..Sun)
    required this.entries,    // All status entries covering the week
    required this.employees,  // Employees to render rows for
    this.todayStr,
    this.onCellTap,           // (empId, date, existing?) → callback
  });

  final List<String> dates;
  final List<StatusEntry> entries;
  final List<FluxgenEmployee> employees;
  final String? todayStr;
  final void Function(String empId, String date, StatusEntry? existing)?
      onCellTap;

  StatusEntry? _find(String empId, String date) {
    for (final e in entries) {
      if (e.empId == empId && e.date == date) return e;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (employees.length == 1) {
      return _buildSingleEmployeeChips(context, employees.first);
    }
    return _buildMatrix(context);
  }

  Widget _buildSingleEmployeeChips(
      BuildContext context, FluxgenEmployee emp) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          for (final date in dates) _dayChip(context, emp.id, date),
        ],
      ),
    );
  }

  Widget _dayChip(BuildContext context, String empId, String date) {
    final entry = _find(empId, date);
    final status = entry?.status ?? AttendanceStatus.unknown;
    final isToday = date == todayStr;
    final color = AppColors.forAttendanceStatus(status);
    final parsed = DateTime.tryParse(date);

    return GestureDetector(
      onTap: onCellTap == null ? null : () => onCellTap!(empId, date, entry),
      child: Container(
        width: 72,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: entry == null ? 0.06 : 0.14),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isToday ? color : Colors.transparent,
            width: 2,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              parsed == null ? date : DateFormat('EEE').format(parsed),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              parsed == null ? '' : DateFormat('d').format(parsed),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(height: 4),
            Text(
              status.label,
              style: TextStyle(
                fontSize: 10,
                color: color,
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMatrix(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columnSpacing: 12,
        headingRowHeight: 40,
        dataRowMinHeight: 44,
        dataRowMaxHeight: 44,
        columns: [
          const DataColumn(label: Text('Employee')),
          for (final date in dates)
            DataColumn(
              label: Text(
                DateFormat('E\nd').format(DateTime.parse(date)),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
        ],
        rows: [
          for (final emp in employees)
            DataRow(cells: [
              DataCell(
                Text(
                  emp.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              for (final date in dates) _matrixCell(context, emp.id, date),
            ]),
        ],
      ),
    );
  }

  DataCell _matrixCell(BuildContext context, String empId, String date) {
    final entry = _find(empId, date);
    final status = entry?.status ?? AttendanceStatus.unknown;
    final color = AppColors.forAttendanceStatus(status);
    return DataCell(
      GestureDetector(
        onTap: onCellTap == null ? null : () => onCellTap!(empId, date, entry),
        child: Container(
          width: 36,
          height: 28,
          decoration: BoxDecoration(
            color: entry == null
                ? Colors.grey.withValues(alpha: 0.12)
                : color.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: entry == null ? Colors.transparent : color,
              width: 1,
            ),
          ),
          alignment: Alignment.center,
          child: entry == null
              ? Text('–',
                  style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 12))
              : Text(
                  status.label.substring(
                      0, status.label.length > 3 ? 3 : status.label.length),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
        ),
      ),
    );
  }
}
