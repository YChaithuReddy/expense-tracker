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

  // ─── Matrix view (admin / team) — mirrors the website's weekly table ─────
  static const double _empColWidth  = 140;
  static const double _dayColWidth  = 120;
  static const double _rowHeight    = 68;
  static const double _headerHeight = 56;

  Widget _buildMatrix(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _matrixHeader(),
            for (int i = 0; i < employees.length; i++)
              _matrixRow(context, employees[i], isAlt: i.isOdd),
          ],
        ),
      ),
    );
  }

  Widget _matrixHeader() {
    return Container(
      height: _headerHeight,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, Color(0xFF00456B)],
        ),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: _empColWidth,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 14),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Employee',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ),
          ),
          for (final date in dates) _headerDateCell(date),
        ],
      ),
    );
  }

  Widget _headerDateCell(String date) {
    final parsed = DateTime.tryParse(date);
    final dow = parsed == null ? '' : DateFormat('E').format(parsed);
    final full = parsed == null ? date : DateFormat('d/M/yyyy').format(parsed);
    return SizedBox(
      width: _dayColWidth,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              dow,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              full,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.90),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _matrixRow(BuildContext context, FluxgenEmployee emp, {required bool isAlt}) {
    return Container(
      height: _rowHeight,
      decoration: BoxDecoration(
        color: isAlt ? const Color(0xFFFAFBFD) : Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFEEF1F5), width: 1),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: _empColWidth,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  emp.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1A1A2E),
                    height: 1.2,
                  ),
                ),
              ),
            ),
          ),
          for (final date in dates) _matrixCell(context, emp.id, date),
        ],
      ),
    );
  }

  Widget _matrixCell(BuildContext context, String empId, String date) {
    final entry = _find(empId, date);
    final status = entry?.status ?? AttendanceStatus.unknown;
    final color = AppColors.forAttendanceStatus(status);
    final isToday = date == todayStr;

    String? text;
    if (entry != null) {
      if (entry.siteName.isNotEmpty) {
        text = entry.siteName;
      } else {
        text = status.label;
      }
    }

    return SizedBox(
      width: _dayColWidth,
      height: _rowHeight,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: GestureDetector(
          onTap: onCellTap == null ? null : () => onCellTap!(empId, date, entry),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: entry == null
                  ? const Color(0xFFF3F5F8)
                  : color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(10),
              border: isToday
                  ? Border.all(color: color, width: 1.4)
                  : null,
            ),
            child: Text(
              text ?? '—',
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: entry == null
                    ? AppColors.onSurfaceVariant
                    : _darker(color),
                height: 1.2,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Color _darker(Color c) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness - 0.18).clamp(0.0, 1.0)).toColor();
  }
}
