# Attendance Phase 2 — Work Done + Efficiency + CSV Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-status work-done tracking, efficiency scoring dashboard, and 4-type CSV export to the Fluxgen Attendance feature.

**Architecture:** Pure client-side efficiency scoring via a standalone calculator class. Work-done modal as a bottom sheet triggered from existing weekly/team widgets. CSV generation via Dart string building + `share_plus` for native sharing. All API calls go through the existing `FluxgenApiService` + Google Apps Script backend.

**Tech Stack:** Flutter/Dart, Riverpod, http, share_plus, path_provider, intl — all already in pubspec.

**Working directory:** `C:\Users\chath\Documents\Python code\expense tracker\fluxgen_emerald\`
**Flutter:** `/c/flutter/bin/flutter` (3.29.3). Always prefix commands: `export PATH="/c/flutter/bin:$PATH"`
**Git root:** `C:\Users\chath\Documents\Python code\expense tracker\`

**Spec:** `docs/superpowers/specs/2026-04-16-attendance-phase2-design.md`

---

## Task 1: Efficiency calculator (TDD — pure Dart)

**Files:**
- Create: `lib/core/utils/efficiency_calculator.dart`
- Create: `test/utils/efficiency_calculator_test.dart`

- [ ] **Step 1: Write failing tests**

Create `test/utils/efficiency_calculator_test.dart`:

```dart
import 'package:emerald/core/utils/efficiency_calculator.dart';
import 'package:emerald/models/fluxgen_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EfficiencyCalculator.score', () {
    test('On Site + Project = 100', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Project'), 100);
    });
    test('On Site + Service = 90', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Service'), 90);
    });
    test('On Site + Office Work = 85', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Office Work'), 85);
    });
    test('In Office + Project = 80', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.inOffice, 'Project'), 80);
    });
    test('In Office + Service = 75', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.inOffice, 'Service'), 75);
    });
    test('WFH + Project = 70', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.workFromHome, 'Project'), 70);
    });
    test('WFH + Office Work = 60', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.workFromHome, 'Office Work'), 60);
    });
    test('On Leave = 0', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onLeave, ''), 0);
    });
    test('Holiday = -1 (excluded)', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.holiday, ''), -1);
    });
    test('Weekend = -1 (excluded)', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.weekend, ''), -1);
    });
    test('Unknown default = 50', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.unknown, 'Other'), 50);
    });
  });

  group('EfficiencyCalculator.aggregate', () {
    test('computes per-employee averages', () {
      final entries = [
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
            status: AttendanceStatus.onSite, workType: 'Project'),
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-15',
            status: AttendanceStatus.inOffice, workType: 'Project'),
      ];
      final result = EfficiencyCalculator.aggregate(entries);
      expect(result.employees.length, 1);
      expect(result.employees.first.empName, 'Alice');
      expect(result.employees.first.daysWorked, 2);
      expect(result.employees.first.avgEfficiency, 90); // (100+80)/2
    });

    test('excludes holidays from average', () {
      final entries = [
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
            status: AttendanceStatus.onSite, workType: 'Project'),
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-15',
            status: AttendanceStatus.holiday),
      ];
      final result = EfficiencyCalculator.aggregate(entries);
      expect(result.employees.first.avgEfficiency, 100); // holiday excluded
      expect(result.employees.first.daysWorked, 1);
    });

    test('empty list returns zero summary', () {
      final result = EfficiencyCalculator.aggregate([]);
      expect(result.employees, isEmpty);
      expect(result.deployRate, 0);
    });
  });
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter test test/utils/efficiency_calculator_test.dart 2>&1 | tail -5
```

- [ ] **Step 3: Implement calculator**

Create `lib/core/utils/efficiency_calculator.dart`:

```dart
import '../../models/fluxgen_status.dart';

class EfficiencyCalculator {
  EfficiencyCalculator._();

  /// Returns efficiency % for a single status+workType combo.
  /// -1 = excluded from averaging (holidays, weekends).
  static int score(AttendanceStatus status, String workType) {
    if (status == AttendanceStatus.onLeave) return 0;
    if (status == AttendanceStatus.holiday ||
        status == AttendanceStatus.weekend) return -1;

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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter test test/utils/efficiency_calculator_test.dart 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/core/utils/efficiency_calculator.dart fluxgen_emerald/test/utils/efficiency_calculator_test.dart
git commit -m "feat(attendance): add EfficiencyCalculator with TDD tests"
```

---

## Task 2: Add updateWorkDone to API service + test

**Files:**
- Modify: `lib/services/fluxgen_api_service.dart` (add method after submitStatus, before Helpers)
- Modify: `test/services/fluxgen_api_service_test.dart` (add test group)

- [ ] **Step 1: Add test**

Append to `test/services/fluxgen_api_service_test.dart`, inside the `main()` block before the closing `}`:

```dart
  group('FluxgenApiService.updateWorkDone', () {
    test('sends all work-done fields as form-encoded POST', () async {
      String? capturedBody;
      final client = MockClient((req) async {
        capturedBody = req.body;
        return http.Response('{"status":"success"}', 200);
      });
      final svc = FluxgenApiService(client: client);
      await svc.updateWorkDone(
        empId: 'E1',
        date: '2026-04-15',
        workDone: 'Installed HVAC unit',
        completionPct: 75,
        workRemarks: 'Pending duct work',
        nextVisitRequired: true,
        nextVisitDate: '2026-04-20',
      );
      expect(capturedBody, contains('action=updateWorkDone'));
      expect(capturedBody, contains('empId=E1'));
      expect(capturedBody, contains('completionPct=75'));
      expect(capturedBody, contains('nextVisitRequired=Yes'));
      expect(capturedBody, contains('nextVisitDate=2026-04-20'));
    });

    test('accepts 302 as success', () async {
      final client = MockClient((_) async =>
          http.Response('Moved', 302, headers: {'location': 'https://x'}));
      final svc = FluxgenApiService(client: client);
      await svc.updateWorkDone(
          empId: 'E1', date: '2026-04-15', workDone: 'test');
    });
  });
```

- [ ] **Step 2: Add method to service**

In `lib/services/fluxgen_api_service.dart`, add this method between `submitStatus` (line ~105) and `// ── Helpers` (line ~107):

```dart
  Future<void> updateWorkDone({
    required String empId,
    required String date,
    required String workDone,
    int completionPct = 0,
    String workRemarks = '',
    bool nextVisitRequired = false,
    String nextVisitDate = '',
  }) async {
    final body = <String, String>{
      'action':             'updateWorkDone',
      'empId':              empId,
      'date':               date,
      'workDone':           workDone,
      'completionPct':      completionPct.toString(),
      'workRemarks':        workRemarks,
      'nextVisitRequired':  nextVisitRequired ? 'Yes' : 'No',
      'nextVisitDate':      nextVisitDate,
    };
    final resp = await _client
        .post(
          Uri.parse(FluxgenApi.scriptUrl),
          headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
          body: body,
        )
        .timeout(const Duration(seconds: 20));
    if (resp.statusCode < 200 || resp.statusCode >= 400) {
      throw Exception(
          'updateWorkDone failed with HTTP ${resp.statusCode}: ${resp.body}');
    }
  }
```

- [ ] **Step 3: Run all tests**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter test 2>&1 | tail -5
```
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/services/fluxgen_api_service.dart fluxgen_emerald/test/services/fluxgen_api_service_test.dart
git commit -m "feat(attendance): add updateWorkDone API method + tests"
```

---

## Task 3: Work Done bottom sheet widget

**Files:**
- Create: `lib/screens/attendance/widgets/work_done_sheet.dart`

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/work_done_sheet.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';
import '../../../providers/fluxgen_provider.dart';

/// Bottom sheet for editing work-done fields on a status entry.
class WorkDoneSheet extends ConsumerStatefulWidget {
  const WorkDoneSheet({
    super.key,
    required this.empId,
    required this.empName,
    required this.date,
    this.existing,
  });
  final String empId;
  final String empName;
  final String date;
  final StatusEntry? existing;

  static Future<void> show(
    BuildContext context, {
    required String empId,
    required String empName,
    required String date,
    StatusEntry? existing,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WorkDoneSheet(
        empId: empId,
        empName: empName,
        date: date,
        existing: existing,
      ),
    );
  }

  @override
  ConsumerState<WorkDoneSheet> createState() => _WorkDoneSheetState();
}

class _WorkDoneSheetState extends ConsumerState<WorkDoneSheet> {
  late final TextEditingController _descCtrl;
  late final TextEditingController _remarksCtrl;
  double _pct = 0;
  bool _nextVisit = false;
  String _nextDate = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descCtrl = TextEditingController(text: e?.workDone ?? '');
    _remarksCtrl = TextEditingController(text: e?.workRemarks ?? '');
    _pct = double.tryParse(e?.completionPct ?? '0') ?? 0;
    _nextVisit = e?.nextVisitRequired == 'Yes';
    _nextDate = e?.nextVisitDate ?? '';
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final desc = _descCtrl.text.trim();
    if (desc.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Work done description is required'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(fluxgenApiProvider).updateWorkDone(
            empId: widget.empId,
            date: widget.date,
            workDone: desc,
            completionPct: _pct.round(),
            workRemarks: _remarksCtrl.text.trim(),
            nextVisitRequired: _nextVisit,
            nextVisitDate: _nextDate,
          );
      ref.invalidate(todayStatusProvider(widget.date));
      ref.invalidate(weekStatusProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: const Text('Work done saved'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text('Save failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: EdgeInsets.only(bottom: bottom),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              widget.empName,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            Text(
              widget.date,
              style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Work Done Description *',
                hintText: 'What was accomplished?',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Completion', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const Spacer(),
                Text(
                  '${_pct.round()}%',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: _pct >= 80
                        ? const Color(0xFF10B981)
                        : _pct >= 50
                            ? const Color(0xFFF59E0B)
                            : AppColors.error,
                  ),
                ),
              ],
            ),
            Slider(
              value: _pct,
              min: 0,
              max: 100,
              divisions: 20,
              activeColor: AppColors.primary,
              onChanged: (v) => setState(() => _pct = v),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _remarksCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Remarks',
                hintText: 'Any notes for the team',
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(
                  child: Text('Next visit required?',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                Switch.adaptive(
                  value: _nextVisit,
                  activeColor: AppColors.primary,
                  onChanged: (v) => setState(() => _nextVisit = v),
                ),
              ],
            ),
            if (_nextVisit) ...[
              const SizedBox(height: 6),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.tryParse(_nextDate) ??
                        DateTime.now().add(const Duration(days: 1)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    setState(() => _nextDate = fluxgenDateFormat(picked));
                  }
                },
                borderRadius: BorderRadius.circular(12),
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Next Visit Date',
                    suffixIcon: Icon(Icons.calendar_today, size: 18),
                  ),
                  child: Text(
                    _nextDate.isEmpty ? 'Pick a date' : _nextDate,
                    style: TextStyle(
                      color: _nextDate.isEmpty
                          ? AppColors.onSurfaceVariant
                          : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [AppColors.primary, Color(0xFF00456B)],
                ),
              ),
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_rounded, size: 18),
                label: Text(_saving ? 'Saving…' : 'Save work done'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  shadowColor: Colors.transparent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter analyze lib/screens/attendance/widgets/work_done_sheet.dart
```

Note: The `ref.invalidate(weekStatusProvider)` call invalidates ALL family variants. This is intentional — we want both employee and admin weekly views to refresh.

However, `weekStatusProvider` is a `FutureProvider.family` which means `ref.invalidate(weekStatusProvider)` might not work as expected since you need to invalidate specific family instances. The workaround: just `ref.invalidate(todayStatusProvider(widget.date))` is sufficient since the weekly tab re-fetches on tab focus anyway.

Fix: change `ref.invalidate(weekStatusProvider);` to just be removed (keep only `todayStatusProvider` invalidation). The weekly tab already has pull-to-refresh.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/screens/attendance/widgets/work_done_sheet.dart
git commit -m "feat(attendance): add WorkDoneSheet bottom sheet"
```

---

## Task 4: Wire onCellTap + onEdit to open WorkDoneSheet

**Files:**
- Modify: `lib/screens/attendance/attendance_weekly_tab.dart`
- Modify: `lib/screens/attendance/attendance_team_tab.dart`

- [ ] **Step 1: In `attendance_weekly_tab.dart`**

Add import at top:
```dart
import 'widgets/work_done_sheet.dart';
```

In both `WeeklyGrid(...)` invocations (employee mode ~line 89 and admin mode ~line 73), add `onCellTap`:

```dart
onCellTap: (empId, date, existing) {
  final emps = employeesAsync.valueOrNull ?? [];
  final emp = emps.firstWhere(
    (e) => e.empId == empId,
    orElse: () => FluxgenEmployee(id: empId, name: empId, role: ''),
  );
  WorkDoneSheet.show(
    context,
    empId: empId,
    empName: emp.name,
    date: date,
    existing: existing,
  );
},
```

Note: `FluxgenEmployee` uses field `id` not `empId`. So the `firstWhere` should be `e.id == empId`.

- [ ] **Step 2: In `attendance_team_tab.dart`**

Add import at top:
```dart
import 'widgets/work_done_sheet.dart';
```

Replace the existing `onEdit` callback (which showed a SnackBar placeholder) with:
```dart
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
```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter analyze lib/screens/attendance/ 2>&1 | tail -5
```

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/screens/attendance/attendance_weekly_tab.dart fluxgen_emerald/lib/screens/attendance/attendance_team_tab.dart
git commit -m "feat(attendance): wire WorkDoneSheet to weekly + team taps"
```

---

## Task 5: Efficiency section widget (admin Team tab)

**Files:**
- Create: `lib/screens/attendance/widgets/efficiency_section.dart`
- Modify: `lib/screens/attendance/attendance_team_tab.dart` (embed section)

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/efficiency_section.dart`:

```dart
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
```

- [ ] **Step 2: Embed in team tab**

In `attendance_team_tab.dart`, add import:
```dart
import 'widgets/efficiency_section.dart';
```

In the `_content` method, after the `TeamList` container, add (only when `isAdminMode`):
```dart
if (isAdminMode)
  EfficiencySection(entries: entries),
```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter analyze lib/screens/attendance/ lib/core/utils/efficiency_calculator.dart 2>&1 | tail -5
```

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/screens/attendance/widgets/efficiency_section.dart fluxgen_emerald/lib/screens/attendance/attendance_team_tab.dart
git commit -m "feat(attendance): add Efficiency section to admin Team tab"
```

---

## Task 6: CSV export service + tests

**Files:**
- Create: `lib/services/attendance_csv_service.dart`
- Create: `test/services/attendance_csv_service_test.dart`

- [ ] **Step 1: Write tests first**

Create `test/services/attendance_csv_service_test.dart`:

```dart
import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/services/attendance_csv_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final entries = [
    StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
        status: AttendanceStatus.onSite, workType: 'Project',
        siteName: 'BLR', scopeOfWork: 'HVAC'),
    StatusEntry(empId: 'E2', empName: 'Bob', date: '2026-04-14',
        status: AttendanceStatus.inOffice, workType: 'Service'),
  ];

  test('employeeDailyCsv has correct headers', () {
    final csv = AttendanceCsvService.employeeDailyCsv(entries);
    final firstLine = csv.split('\n').first;
    expect(firstLine, contains('Employee ID'));
    expect(firstLine, contains('Efficiency'));
  });

  test('employeeDailyCsv has correct row count', () {
    final csv = AttendanceCsvService.employeeDailyCsv(entries);
    final lines = csv.split('\n').where((l) => l.trim().isNotEmpty).toList();
    expect(lines.length, 3); // header + 2 rows
  });

  test('siteCsv filters by site', () {
    final csv = AttendanceCsvService.siteCsv(entries, 'BLR');
    final lines = csv.split('\n').where((l) => l.trim().isNotEmpty).toList();
    expect(lines.length, 2); // header + 1 match
  });

  test('efficiencyCsv includes summary section', () {
    final csv = AttendanceCsvService.efficiencyCsv(entries);
    expect(csv, contains('Deploy'));
    expect(csv, contains('Alice'));
  });

  test('escapes fields with commas', () {
    final tricky = [
      StatusEntry(empId: 'E1', empName: 'Alice, Jr.', date: '2026-04-14',
          status: AttendanceStatus.onSite, workType: 'Project'),
    ];
    final csv = AttendanceCsvService.employeeDailyCsv(tricky);
    expect(csv, contains('"Alice, Jr."'));
  });
}
```

- [ ] **Step 2: Implement service**

Create `lib/services/attendance_csv_service.dart`:

```dart
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
```

Note: `StatusEntry` currently doesn't have `workDone`, `completionPct`, `workRemarks`, `nextVisitRequired`, `nextVisitDate` fields from the GAS response. These fields ARE returned by the API (spec section 5 of Phase 1 spec lists them) but the Phase 1 model only stores the Phase 1 subset. We need to add them.

**IMPORTANT**: Before this task compiles, add the missing fields to `StatusEntry` in `lib/models/fluxgen_status.dart`:

```dart
// Add to StatusEntry constructor (after `this.role = ''`):
this.workDone = '',
this.completionPct = '0',
this.workRemarks = '',
this.nextVisitRequired = 'No',
this.nextVisitDate = '',
```

And add the corresponding finals + fromJson mappings:
```dart
final String workDone;
final String completionPct;
final String workRemarks;
final String nextVisitRequired;
final String nextVisitDate;
```

In `fromJson`, add:
```dart
workDone:           (json['workDone']           as String?) ?? '',
completionPct:      (json['completionPct']      as String?) ?? '0',
workRemarks:        (json['workRemarks']        as String?) ?? '',
nextVisitRequired:  (json['nextVisitRequired']  as String?) ?? 'No',
nextVisitDate:      (json['nextVisitDate']      as String?) ?? '',
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter test test/services/attendance_csv_service_test.dart 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/models/fluxgen_status.dart fluxgen_emerald/lib/services/attendance_csv_service.dart fluxgen_emerald/test/services/attendance_csv_service_test.dart
git commit -m "feat(attendance): add CSV export service + extend StatusEntry model

StatusEntry now includes workDone, completionPct, workRemarks,
nextVisitRequired, nextVisitDate — matching the full API response.
AttendanceCsvService generates 4 report types with proper escaping."
```

---

## Task 7: Export bottom sheet + FAB

**Files:**
- Create: `lib/screens/attendance/widgets/export_sheet.dart`
- Modify: `lib/screens/attendance/attendance_team_tab.dart` (add FAB)

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/export_sheet.dart`:

```dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';
import '../../../services/attendance_csv_service.dart';

class ExportSheet extends StatelessWidget {
  const ExportSheet({super.key, required this.entries});
  final List<StatusEntry> entries;

  static Future<void> show(BuildContext context,
      {required List<StatusEntry> entries}) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => ExportSheet(entries: entries),
    );
  }

  Future<void> _export(BuildContext context, String csv, String filename) async {
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$filename');
      await file.writeAsString(csv);
      await Share.shareXFiles([XFile(file.path)],
          subject: filename.replaceAll('.csv', ''));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'),
              backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(child: Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2)),
          )),
          const Text('Export Reports',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          _ExportTile(
            icon: Icons.person,
            label: 'Employee Daily Report',
            color: AppColors.primary,
            onTap: () => _export(context,
                AttendanceCsvService.employeeDailyCsv(entries),
                'employee_report.csv'),
          ),
          _ExportTile(
            icon: Icons.location_on,
            label: 'Site-Wise Report',
            color: const Color(0xFF10B981),
            onTap: () {
              final sites = entries.map((e) => e.siteName)
                  .where((s) => s.isNotEmpty).toSet();
              if (sites.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('No site data to export')));
                return;
              }
              // Export all sites in one CSV
              _export(context,
                  AttendanceCsvService.employeeDailyCsv(
                      entries.where((e) => e.siteName.isNotEmpty).toList()),
                  'site_report.csv');
            },
          ),
          _ExportTile(
            icon: Icons.work,
            label: 'Work Type Report',
            color: const Color(0xFF8B5CF6),
            onTap: () => _export(context,
                AttendanceCsvService.employeeDailyCsv(entries),
                'worktype_report.csv'),
          ),
          _ExportTile(
            icon: Icons.insights,
            label: 'Team Efficiency Report',
            color: const Color(0xFFF59E0B),
            onTap: () => _export(context,
                AttendanceCsvService.efficiencyCsv(entries),
                'efficiency_report.csv'),
          ),
        ],
      ),
    );
  }
}

class _ExportTile extends StatelessWidget {
  const _ExportTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(label,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700))),
                Icon(Icons.share_rounded, color: AppColors.onSurfaceVariant, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Add FAB to team tab**

In `attendance_team_tab.dart`, add import:
```dart
import 'widgets/export_sheet.dart';
```

The `AttendanceTeamTab`'s parent is inside a `TabBarView` in `AttendanceShell`. To add a FAB, the simplest approach is to wrap the `RefreshIndicator` in a `Scaffold` with a `floatingActionButton`:

Replace the `return RefreshIndicator(...)` in `build` with:
```dart
return Scaffold(
  backgroundColor: Colors.transparent,
  floatingActionButton: isAdminMode
      ? FloatingActionButton.small(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          onPressed: () {
            final entries = statusAsync.valueOrNull ?? [];
            ExportSheet.show(context, entries: entries);
          },
          child: const Icon(Icons.share_rounded, size: 20),
        )
      : null,
  body: RefreshIndicator(
    onRefresh: refresh,
    child: ListView(
      // ... rest stays the same
```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter analyze lib/screens/attendance/ lib/services/attendance_csv_service.dart 2>&1 | tail -5
```

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git add fluxgen_emerald/lib/screens/attendance/widgets/export_sheet.dart fluxgen_emerald/lib/screens/attendance/attendance_team_tab.dart
git commit -m "feat(attendance): add CSV export sheet + share FAB on Team tab"
```

---

## Task 8: Full smoke test + ship

- [ ] **Step 1: Run full analyzer**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter analyze 2>&1 | tail -10
```

- [ ] **Step 2: Run full test suite**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter test 2>&1 | tail -10
```

- [ ] **Step 3: Build APK**

```bash
export PATH="/c/flutter/bin:$PATH" && cd "C:/Users/chath/Documents/Python code/expense tracker/fluxgen_emerald" && flutter build apk --debug 2>&1 | tail -5
```

- [ ] **Step 4: Push + PR**

```bash
cd "C:/Users/chath/Documents/Python code/expense tracker"
git push -u origin feat/attendance-phase-2
gh pr create --title "feat: Attendance Phase 2 — work-done + efficiency + CSV export" --body "..."
```

---

## File tree after Phase 2

```
fluxgen_emerald/lib/
├── core/utils/
│   └── efficiency_calculator.dart          ← NEW
├── models/
│   └── fluxgen_status.dart                 ← MODIFIED (added 5 work-done fields)
├── services/
│   ├── fluxgen_api_service.dart            ← MODIFIED (+updateWorkDone)
│   └── attendance_csv_service.dart         ← NEW
└── screens/attendance/
    ├── attendance_weekly_tab.dart           ← MODIFIED (+onCellTap wiring)
    ├── attendance_team_tab.dart             ← MODIFIED (+efficiency +FAB +export)
    └── widgets/
        ├── work_done_sheet.dart             ← NEW
        ├── efficiency_section.dart          ← NEW
        └── export_sheet.dart                ← NEW

test/
├── utils/
│   └── efficiency_calculator_test.dart     ← NEW
└── services/
    ├── fluxgen_api_service_test.dart       ← MODIFIED (+updateWorkDone tests)
    └── attendance_csv_service_test.dart    ← NEW
```

**Total:** 5 new files + 5 modified + 3 test files. ~1200 new lines.
