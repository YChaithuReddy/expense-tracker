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
    // Responsive: all 7 days fit on one row. Each chip flexes to fill.
    return Row(
      children: [
        for (final date in dates)
          Expanded(child: _dayChip(context, emp.id, date)),
      ],
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
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          gradient: isToday
              ? LinearGradient(
                  colors: [
                    color.withValues(alpha: 0.25),
                    color.withValues(alpha: 0.10),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                )
              : null,
          color: isToday
              ? null
              : color.withValues(alpha: entry == null ? 0.05 : 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isToday ? color : Colors.transparent,
            width: 1.8,
          ),
          boxShadow: isToday
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              parsed == null
                  ? date
                  : DateFormat('E').format(parsed).substring(0, 1),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              parsed == null ? '' : DateFormat('d').format(parsed),
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
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
