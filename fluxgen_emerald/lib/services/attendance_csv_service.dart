import '../core/utils/efficiency_calculator.dart';
import '../models/fluxgen_status.dart';

class AttendanceCsvService {
  AttendanceCsvService._();

  static String employeeDailyCsv(List<StatusEntry> entries) {
    final headers = [
      'Employee ID', 'Name', 'Role', 'Site', 'Work Type', 'Scope',
      'Status', 'Efficiency %', 'Date', 'Work Done', 'Completion %', 'Remarks',
    ];
    final rows = <List<String>>[headers];
    for (final e in entries) {
      final eff = EfficiencyCalculator.score(e.status, e.workType);
      rows.add([
        e.empId, e.empName, e.role, e.siteName, e.workType, e.scopeOfWork,
        e.status.apiValue, eff >= 0 ? '$eff' : 'N/A', e.date,
        e.workDone, e.completionPct, e.workRemarks,
      ]);
    }
    return _toCsv(rows);
  }

  static String siteCsv(List<StatusEntry> entries, String site) {
    final filtered = entries.where((e) =>
        e.siteName.toLowerCase() == site.toLowerCase()).toList();
    return employeeDailyCsv(filtered);
  }

  static String workTypeCsv(List<StatusEntry> entries, String workType) {
    final filtered = entries.where((e) =>
        e.workType.toLowerCase() == workType.toLowerCase()).toList();
    return employeeDailyCsv(filtered);
  }

  static String efficiencyCsv(List<StatusEntry> entries) {
    final report = EfficiencyCalculator.aggregate(entries);
    final rows = <List<String>>[];

    // Detail section
    rows.add(['Employee ID', 'Name', 'Status', 'Work Type', 'Efficiency %', 'Date']);
    for (final e in entries) {
      final eff = EfficiencyCalculator.score(e.status, e.workType);
      rows.add([e.empId, e.empName, e.status.apiValue, e.workType,
          eff >= 0 ? '$eff' : 'N/A', e.date]);
    }

    // Blank separator
    rows.add([]);

    // Summary section
    rows.add(['Metric', 'Value']);
    rows.add(['Deploy Rate', '${report.deployRate}%']);
    rows.add(['On Site Rate', '${report.onSiteRate}%']);
    rows.add(['Leave Rate', '${report.leaveRate}%']);
    rows.add(['Utilization', '${report.utilRate}%']);

    // Blank separator
    rows.add([]);

    // Per-employee summary
    rows.add(['Name', 'Role', 'Days Worked', 'On Site', 'Leave', 'Avg Efficiency %']);
    for (final emp in report.employees) {
      rows.add([emp.empName, emp.role, '${emp.daysWorked}',
          '${emp.onSiteDays}', '${emp.leaveDays}', '${emp.avgEfficiency}']);
    }

    return _toCsv(rows);
  }

  static String _toCsv(List<List<String>> rows) {
    return rows.map((row) => row.map(_escapeField).join(',')).join('\n');
  }

  static String _escapeField(String field) {
    if (field.contains(',') || field.contains('"') || field.contains('\n')) {
      return '"${field.replaceAll('"', '""')}"';
    }
    return field;
  }
}
