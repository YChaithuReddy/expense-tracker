import '../../models/fluxgen_status.dart';

class EfficiencyCalculator {
  EfficiencyCalculator._();

  /// Returns efficiency % for a single status+workType combo.
  /// -1 = excluded from averaging (holidays, weekends).
  static int score(AttendanceStatus status, String workType) {
    if (status == AttendanceStatus.onLeave) return 0;
    if (status == AttendanceStatus.holiday ||
        status == AttendanceStatus.weekend) {
      return -1;
    }

    final wt = workType.trim();
    return switch (status) {
      AttendanceStatus.onSite => switch (wt) {
          'Project' => 100,
          'Service' => 90,
          'Office Work' => 85,
          _ => 85,
        },
      AttendanceStatus.inOffice => switch (wt) {
          'Project' => 80,
          'Service' => 75,
          _ => 75,
        },
      AttendanceStatus.workFromHome => switch (wt) {
          'Project' => 70,
          'Service' => 65,
          'Office Work' => 60,
          _ => 60,
        },
      _ => 50,
    };
  }

  /// Aggregate efficiency across a list of status entries.
  static EfficiencyReport aggregate(List<StatusEntry> entries) {
    if (entries.isEmpty) {
      return const EfficiencyReport(
          employees: [], deployRate: 0, onSiteRate: 0, leaveRate: 0, utilRate: 0);
    }

    // Deduplicate by empId+date (latest wins)
    final dedup = <String, StatusEntry>{};
    for (final e in entries) {
      dedup['${e.empId}_${e.date}'] = e;
    }
    final unique = dedup.values.toList();

    // Group by employee
    final byEmp = <String, List<StatusEntry>>{};
    for (final e in unique) {
      (byEmp[e.empId] ??= []).add(e);
    }

    int totalOnSite = 0, totalLeave = 0, totalWorked = 0;

    final empResults = <EmployeeEfficiency>[];
    for (final entry in byEmp.entries) {
      final rows = entry.value;
      int effSum = 0, counted = 0, onSite = 0, leave = 0;
      for (final r in rows) {
        final s = score(r.status, r.workType);
        if (s >= 0) {
          effSum += s;
          counted++;
        }
        if (r.status == AttendanceStatus.onSite) onSite++;
        if (r.status == AttendanceStatus.onLeave) leave++;
      }
      totalOnSite += onSite;
      totalLeave += leave;
      totalWorked += counted;

      empResults.add(EmployeeEfficiency(
        empId: entry.key,
        empName: rows.first.empName,
        role: rows.first.role,
        daysWorked: counted,
        onSiteDays: onSite,
        leaveDays: leave,
        avgEfficiency: counted > 0 ? (effSum / counted).round().clamp(0, 100) : 0,
      ));
    }

    final totalEntries = unique.length;
    return EfficiencyReport(
      employees: empResults,
      deployRate: totalEntries > 0
          ? ((totalWorked / totalEntries) * 100).round()
          : 0,
      onSiteRate: totalEntries > 0
          ? ((totalOnSite / totalEntries) * 100).round()
          : 0,
      leaveRate: totalEntries > 0
          ? ((totalLeave / totalEntries) * 100).round()
          : 0,
      utilRate: empResults.isEmpty
          ? 0
          : (empResults.map((e) => e.avgEfficiency).reduce((a, b) => a + b) /
                  empResults.length)
              .round(),
    );
  }
}

class EfficiencyReport {
  const EfficiencyReport({
    required this.employees,
    required this.deployRate,
    required this.onSiteRate,
    required this.leaveRate,
    required this.utilRate,
  });
  final List<EmployeeEfficiency> employees;
  final int deployRate;  // % of entries that were working days (not holiday/weekend)
  final int onSiteRate;  // % on site
  final int leaveRate;   // % on leave
  final int utilRate;    // avg efficiency across team
}

class EmployeeEfficiency {
  const EmployeeEfficiency({
    required this.empId,
    required this.empName,
    required this.role,
    required this.daysWorked,
    required this.onSiteDays,
    required this.leaveDays,
    required this.avgEfficiency,
  });
  final String empId;
  final String empName;
  final String role;
  final int daysWorked;
  final int onSiteDays;
  final int leaveDays;
  final int avgEfficiency;
}
