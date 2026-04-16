import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/efficiency_calculator.dart';
import '../../../models/fluxgen_status.dart';

class EfficiencySection extends StatelessWidget {
  const EfficiencySection({super.key, required this.entries});
  final List<StatusEntry> entries;

  @override
  Widget build(BuildContext context) {
    final report = EfficiencyCalculator.aggregate(entries);
    if (report.employees.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        Row(
          children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.insights_rounded,
                  color: Color(0xFF8B5CF6), size: 16),
            ),
            const SizedBox(width: 10),
            const Text('Efficiency',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
          ],
        ),
        const SizedBox(height: 12),
        _MetricRow(report: report),
        const SizedBox(height: 12),
        _EmployeeTable(employees: report.employees),
      ],
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.report});
  final EfficiencyReport report;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      _MetricCard(label: 'Deploy', value: '${report.deployRate}%',
          color: AppColors.primary),
      const SizedBox(width: 8),
      _MetricCard(label: 'On Site', value: '${report.onSiteRate}%',
          color: const Color(0xFF10B981)),
      const SizedBox(width: 8),
      _MetricCard(label: 'Leave', value: '${report.leaveRate}%',
          color: const Color(0xFFF59E0B)),
      const SizedBox(width: 8),
      _MetricCard(label: 'Util', value: '${report.utilRate}%',
          color: const Color(0xFF8B5CF6)),
    ]);
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _EmployeeTable extends StatelessWidget {
  const _EmployeeTable({required this.employees});
  final List<EmployeeEfficiency> employees;

  Color _effColor(int eff) {
    if (eff >= 80) return const Color(0xFF10B981);
    if (eff >= 60) return const Color(0xFFF59E0B);
    return AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10, offset: const Offset(0, 3)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columnSpacing: 16,
            headingRowHeight: 38,
            dataRowMinHeight: 38,
            dataRowMaxHeight: 42,
            columns: const [
              DataColumn(label: Text('Employee', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
              DataColumn(label: Text('Days', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)), numeric: true),
              DataColumn(label: Text('Site', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)), numeric: true),
              DataColumn(label: Text('Leave', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)), numeric: true),
              DataColumn(label: Text('Eff %', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)), numeric: true),
            ],
            rows: [
              for (final emp in employees)
                DataRow(cells: [
                  DataCell(Text(emp.empName, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                  DataCell(Text('${emp.daysWorked}', style: const TextStyle(fontSize: 12))),
                  DataCell(Text('${emp.onSiteDays}', style: const TextStyle(fontSize: 12))),
                  DataCell(Text('${emp.leaveDays}', style: const TextStyle(fontSize: 12))),
                  DataCell(Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _effColor(emp.avgEfficiency).withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('${emp.avgEfficiency}%',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                            color: _effColor(emp.avgEfficiency))),
                  )),
                ]),
            ],
          ),
        ),
      ),
    );
  }
}
