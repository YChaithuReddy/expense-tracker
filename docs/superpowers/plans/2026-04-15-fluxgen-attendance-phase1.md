# Fluxgen Attendance — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the core daily flow of the Fluxgen Employee Status website (https://employee-status-one.vercel.app/) into the existing `fluxgen_emerald/` Flutter app as a new "Attendance" feature with a glassmorphic pill entry on Home, three inner tabs (Update Status / Weekly / Team), and an admin-only Employee↔Admin SegmentedButton that flips per-tab content.

**Architecture:** New code lives under `lib/screens/attendance/` with a matching service (`lib/services/fluxgen_api_service.dart`), provider module (`lib/providers/fluxgen_provider.dart`), and model (`lib/models/fluxgen_status.dart`). Reuses the existing Google Apps Script backend (no migration). Admin role detected via `userProfileProvider.valueOrNull?.isAdmin` from `auth_provider.dart`. EmpID-to-Supabase-user mapping persisted in `SharedPreferences`.

**Tech Stack:** Flutter 3.7+, Riverpod 2.6 (manual, no codegen), http 1.2, shared_preferences 2.3, flutter_animate 4.5, intl 0.19, shimmer 3.0 — all already in `pubspec.yaml`.

**Working directory:** `C:\Users\chath\Documents\Python code\expense tracker\fluxgen_emerald\` (all relative paths below are inside this directory unless prefixed with `docs/`).

**Spec:** `docs/superpowers/specs/2026-04-15-fluxgen-attendance-flutter-design.md`

---

## Prerequisites (do these first before any Task)

- [ ] **Prereq 1: Confirm Flutter tooling works**

Run from the `fluxgen_emerald/` directory:
```bash
flutter --version
flutter pub get
flutter analyze
```
Expected: Flutter 3.7+, `Got dependencies!`, no new analyzer errors (existing warnings OK). If `flutter` is not on PATH, install Flutter SDK first.

- [ ] **Prereq 2: Confirm branch**

```bash
git status
git checkout -b feat/attendance-phase-1
```
Expected: clean working tree (or only the new spec/plan files). A new branch is created for this feature.

---

## Task 1: API constants

**Files:**
- Create: `lib/core/constants/fluxgen_api.dart`

- [ ] **Step 1: Create the constants file**

Create `lib/core/constants/fluxgen_api.dart`:

```dart
/// Central constants for the Fluxgen Employee Status integration.
///
/// Endpoint is a Google Apps Script Web App that backs both the
/// existing website (https://employee-status-one.vercel.app/) and
/// this Flutter app.
abstract final class FluxgenApi {
  static const String scriptUrl =
      'https://script.google.com/macros/s/'
      'AKfycbzFHKifKgVF5bW56sTV4PX0I-4bJn1PoGg6fXE8oQfoI-reRSRq07tBVKM_B-n-FVfqcw/exec';

  // GET actions
  static const String actionGetEmployees   = 'getEmployees';
  static const String actionGetStatus      = 'getStatus';
  static const String actionGetStatusRange = 'getStatusRange';

  // POST actions
  static const String actionSubmitStatus = 'submitStatus';

  // SharedPreferences keys
  static const String prefEmpId   = 'fluxgen_emp_id';
  static const String prefEmpName = 'fluxgen_emp_name';

  // Work type dropdown values (mirror website `mobile.html:543-547`)
  static const List<String> workTypes = [
    'Project',
    'Service',
    'Office Work',
    'BMS Integration',
    'Site Survey',
  ];
}
```

- [ ] **Step 2: Run analyzer to verify**

```bash
flutter analyze lib/core/constants/fluxgen_api.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/core/constants/fluxgen_api.dart
git commit -m "feat(attendance): add FluxgenApi constants"
```

---

## Task 2: Status model

**Files:**
- Create: `lib/models/fluxgen_status.dart`

- [ ] **Step 1: Create the model file**

Create `lib/models/fluxgen_status.dart`:

```dart
/// Attendance status enum. `apiValue` is the exact string sent to /
/// received from the Apps Script — must match the website's dropdown
/// options in `mobile.html:525-532`.
enum AttendanceStatus {
  onSite,
  inOffice,
  workFromHome,
  onLeave,
  holiday,
  weekend,
  unknown;

  String get apiValue => switch (this) {
        AttendanceStatus.onSite       => 'On Site',
        AttendanceStatus.inOffice     => 'In Office',
        AttendanceStatus.workFromHome => 'Work From Home',
        AttendanceStatus.onLeave      => 'On Leave',
        AttendanceStatus.holiday      => 'Holiday',
        AttendanceStatus.weekend      => 'Weekend',
        AttendanceStatus.unknown      => '',
      };

  String get label => switch (this) {
        AttendanceStatus.onSite       => 'On Site',
        AttendanceStatus.inOffice     => 'In Office',
        AttendanceStatus.workFromHome => 'WFH',
        AttendanceStatus.onLeave      => 'Leave',
        AttendanceStatus.holiday      => 'Holiday',
        AttendanceStatus.weekend      => 'Weekend',
        AttendanceStatus.unknown      => 'Unknown',
      };

  static AttendanceStatus fromApiValue(String v) => switch (v.trim()) {
        'On Site'        => AttendanceStatus.onSite,
        'In Office'      => AttendanceStatus.inOffice,
        'Work From Home' => AttendanceStatus.workFromHome,
        'WFH'            => AttendanceStatus.workFromHome,
        'On Leave'       => AttendanceStatus.onLeave,
        'Leave'          => AttendanceStatus.onLeave,
        'Holiday'        => AttendanceStatus.holiday,
        'Weekend'        => AttendanceStatus.weekend,
        _                => AttendanceStatus.unknown,
      };
}

/// One employee from the Fluxgen `Employees` sheet.
class FluxgenEmployee {
  const FluxgenEmployee({
    required this.id,
    required this.name,
    required this.role,
  });
  final String id;
  final String name;
  final String role;

  factory FluxgenEmployee.fromJson(Map<String, dynamic> json) => FluxgenEmployee(
        id:   (json['id']   as String?) ?? '',
        name: (json['name'] as String?) ?? '',
        role: (json['role'] as String?) ?? '',
      );

  @override
  bool operator ==(Object other) =>
      other is FluxgenEmployee && id == other.id;
  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'FluxgenEmployee(id: $id, name: $name, role: $role)';
}

/// One row in the Fluxgen `StatusUpdates` sheet. All fields other than
/// [empId], [empName], [date], [status] are optional.
class StatusEntry {
  const StatusEntry({
    required this.empId,
    required this.empName,
    required this.date,
    required this.status,
    this.siteName    = '',
    this.workType    = '',
    this.scopeOfWork = '',
    this.role        = '',
  });
  final String empId;
  final String empName;
  final String date; // YYYY-MM-DD
  final AttendanceStatus status;
  final String siteName;
  final String workType;
  final String scopeOfWork;
  final String role;

  factory StatusEntry.fromJson(Map<String, dynamic> json) => StatusEntry(
        empId:       (json['empId']       as String?) ?? '',
        empName:     (json['empName']     as String?) ?? '',
        date:        (json['date']        as String?) ?? '',
        status:      AttendanceStatus.fromApiValue(
                       (json['status'] as String?) ?? ''),
        siteName:    (json['siteName']    as String?) ?? '',
        workType:    (json['workType']    as String?) ?? '',
        scopeOfWork: (json['scopeOfWork'] as String?) ?? '',
        role:        (json['role']        as String?) ?? '',
      );

  @override
  bool operator ==(Object other) =>
      other is StatusEntry && empId == other.empId && date == other.date;
  @override
  int get hashCode => Object.hash(empId, date);

  @override
  String toString() =>
      'StatusEntry($empId, $date, ${status.apiValue}, $siteName)';
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/models/fluxgen_status.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/models/fluxgen_status.dart
git commit -m "feat(attendance): add AttendanceStatus, FluxgenEmployee, StatusEntry models"
```

---

## Task 3: API service + unit tests (TDD)

**Files:**
- Create: `lib/services/fluxgen_api_service.dart`
- Create: `test/services/fluxgen_api_service_test.dart`

- [ ] **Step 1: Write failing tests first**

Create `test/services/fluxgen_api_service_test.dart`:

```dart
import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/services/fluxgen_api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('FluxgenApiService.getEmployees', () {
    test('parses employee list', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","employees":['
            '{"id":"E1","name":"Alice","role":"Engineer"},'
            '{"id":"E2","name":"Bob","role":"Technician"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getEmployees();
      expect(result.length, 2);
      expect(result.first.id, 'E1');
      expect(result.first.name, 'Alice');
      expect(result.last.role, 'Technician');
    });

    test('returns empty list on empty response', () async {
      final client = MockClient(
          (_) async => http.Response('{"status":"success","employees":[]}', 200));
      final svc = FluxgenApiService(client: client);
      expect(await svc.getEmployees(), isEmpty);
    });

    test('skips malformed employee rows', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","employees":['
            '{"id":"E1","name":"Alice","role":"Engineer"},'
            'null,'
            '{"bogus":123}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getEmployees();
      expect(result.length, 1);
      expect(result.first.id, 'E1');
    });
  });

  group('FluxgenApiService.getStatus', () {
    test('parses each AttendanceStatus value', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","data":['
            '{"empId":"E1","empName":"Alice","status":"On Site","date":"2026-04-15","siteName":"BLR","workType":"Project","scopeOfWork":"HVAC","role":"Engineer"},'
            '{"empId":"E2","empName":"Bob","status":"In Office","date":"2026-04-15"},'
            '{"empId":"E3","empName":"Cara","status":"Work From Home","date":"2026-04-15"},'
            '{"empId":"E4","empName":"Dev","status":"On Leave","date":"2026-04-15"},'
            '{"empId":"E5","empName":"Eve","status":"Holiday","date":"2026-04-15"},'
            '{"empId":"E6","empName":"Fay","status":"Weekend","date":"2026-04-15"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getStatus('2026-04-15');
      expect(result.length, 6);
      expect(result[0].status, AttendanceStatus.onSite);
      expect(result[0].siteName, 'BLR');
      expect(result[1].status, AttendanceStatus.inOffice);
      expect(result[2].status, AttendanceStatus.workFromHome);
      expect(result[3].status, AttendanceStatus.onLeave);
      expect(result[4].status, AttendanceStatus.holiday);
      expect(result[5].status, AttendanceStatus.weekend);
    });

    test('unknown status string maps to AttendanceStatus.unknown', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","data":['
            '{"empId":"E1","empName":"Alice","status":"Garbage","date":"2026-04-15"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getStatus('2026-04-15');
      expect(result.first.status, AttendanceStatus.unknown);
    });

    test('empty data array returns empty list', () async {
      final client = MockClient(
          (_) async => http.Response('{"status":"success","data":[]}', 200));
      final svc = FluxgenApiService(client: client);
      expect(await svc.getStatus('2026-04-15'), isEmpty);
    });
  });

  group('FluxgenApiService.submitStatus', () {
    test('sends form-encoded POST body with all required fields', () async {
      String? capturedBody;
      final client = MockClient((req) async {
        capturedBody = req.body;
        return http.Response('{"status":"success"}', 200);
      });
      final svc = FluxgenApiService(client: client);
      await svc.submitStatus(
        empId: 'E1',
        empName: 'Alice',
        role: 'Engineer',
        status: AttendanceStatus.onSite,
        date: '2026-04-15',
        siteName: 'Bangalore',
        workType: 'Project',
        scopeOfWork: 'HVAC Commissioning',
      );
      expect(capturedBody, contains('empId=E1'));
      expect(capturedBody, contains('status=On+Site'));
      expect(capturedBody, contains('siteName=Bangalore'));
      expect(capturedBody, contains('action=submitStatus'));
    });
  });
}
```

- [ ] **Step 2: Run tests — expect them to FAIL**

```bash
flutter test test/services/fluxgen_api_service_test.dart
```
Expected: FAIL with "Target of URI doesn't exist: 'package:emerald/services/fluxgen_api_service.dart'". This is correct — we haven't written the service yet.

- [ ] **Step 3: Create the service**

Create `lib/services/fluxgen_api_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/constants/fluxgen_api.dart';
import '../models/fluxgen_status.dart';

/// Thin HTTP wrapper around the Fluxgen Google Apps Script.
///
/// Apps Script latency is typically 2–5s — callers should show shimmer
/// skeletons. Timeouts are conservative (15–20s) to accommodate cold starts.
class FluxgenApiService {
  FluxgenApiService({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  // ── GET ──────────────────────────────────────────────────────────────

  Future<List<FluxgenEmployee>> getEmployees() async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {'action': FluxgenApi.actionGetEmployees},
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    final body = _decodeBody(resp.body);
    final list = (body['employees'] as List?) ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map((e) {
          try {
            final emp = FluxgenEmployee.fromJson(e);
            return emp.id.isEmpty ? null : emp;
          } catch (_) {
            return null;
          }
        })
        .whereType<FluxgenEmployee>()
        .toList();
  }

  Future<List<StatusEntry>> getStatus(String date) async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {
        'action': FluxgenApi.actionGetStatus,
        'date': date,
      },
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    return _parseStatusRows(resp.body);
  }

  Future<List<StatusEntry>> getStatusRange({
    required String from,
    required String to,
    String empId = 'ALL',
  }) async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {
        'action': FluxgenApi.actionGetStatusRange,
        'from': from,
        'to': to,
        'empId': empId,
      },
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 20));
    return _parseStatusRows(resp.body);
  }

  // ── POST ─────────────────────────────────────────────────────────────

  Future<void> submitStatus({
    required String empId,
    required String empName,
    required String role,
    required AttendanceStatus status,
    required String date,
    String siteName    = '',
    String workType    = '',
    String scopeOfWork = '',
  }) async {
    final body = <String, String>{
      'action':      FluxgenApi.actionSubmitStatus,
      'empId':       empId,
      'empName':     empName,
      'role':        role,
      'status':      status.apiValue,
      'date':        date,
      'siteName':    siteName,
      'workType':    workType,
      'scopeOfWork': scopeOfWork,
    };
    final resp = await _client
        .post(
          Uri.parse(FluxgenApi.scriptUrl),
          headers: const {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body,
        )
        .timeout(const Duration(seconds: 20));
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception(
          'submitStatus failed with HTTP ${resp.statusCode}: ${resp.body}');
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  Map<String, dynamic> _decodeBody(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      return const {};
    } catch (_) {
      return const {};
    }
  }

  List<StatusEntry> _parseStatusRows(String raw) {
    final body = _decodeBody(raw);
    final list = (body['data'] as List?) ?? const [];
    final out = <StatusEntry>[];
    for (final row in list) {
      if (row is! Map<String, dynamic>) continue;
      try {
        final entry = StatusEntry.fromJson(row);
        if (entry.empId.isNotEmpty) out.add(entry);
      } catch (_) {
        // Skip malformed row — do not throw.
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run tests — expect them to PASS**

```bash
flutter test test/services/fluxgen_api_service_test.dart
```
Expected: All 9 tests PASS.

- [ ] **Step 5: Run analyzer**

```bash
flutter analyze lib/services/fluxgen_api_service.dart test/services/fluxgen_api_service_test.dart
```
Expected: No issues found!

- [ ] **Step 6: Commit**

```bash
git add lib/services/fluxgen_api_service.dart test/services/fluxgen_api_service_test.dart
git commit -m "feat(attendance): add FluxgenApiService with unit tests"
```

---

## Task 4: Riverpod providers

**Files:**
- Create: `lib/providers/fluxgen_provider.dart`

- [ ] **Step 1: Create the providers file**

Create `lib/providers/fluxgen_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/fluxgen_api.dart';
import '../models/fluxgen_status.dart';
import '../services/fluxgen_api_service.dart';

// ── Service singleton ──────────────────────────────────────────────────────

final fluxgenApiProvider =
    Provider<FluxgenApiService>((_) => FluxgenApiService());

// ── EmpID mapping (persisted via SharedPreferences) ────────────────────────

class MyEmpIdNotifier extends StateNotifier<String?> {
  MyEmpIdNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getString(FluxgenApi.prefEmpId);
  }

  Future<void> set(String empId, String empName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(FluxgenApi.prefEmpId, empId);
    await prefs.setString(FluxgenApi.prefEmpName, empName);
    state = empId;
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(FluxgenApi.prefEmpId);
    await prefs.remove(FluxgenApi.prefEmpName);
    state = null;
  }
}

final myEmpIdProvider =
    StateNotifierProvider<MyEmpIdNotifier, String?>((_) => MyEmpIdNotifier());

/// Cached lookup for the user's display name. Read-only convenience.
final myEmpNameProvider = FutureProvider<String?>((ref) async {
  // Watching myEmpIdProvider ensures this refreshes when EmpID changes.
  ref.watch(myEmpIdProvider);
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(FluxgenApi.prefEmpName);
});

// ── View mode (Employee↔Admin toggle, in-memory per session) ───────────────

enum ViewMode { employee, admin }

final viewModeProvider = StateProvider<ViewMode>((_) => ViewMode.employee);

// ── Data providers ─────────────────────────────────────────────────────────

final employeesProvider =
    FutureProvider<List<FluxgenEmployee>>((ref) async {
  return ref.watch(fluxgenApiProvider).getEmployees();
});

/// Today's status for all employees. Family key = YYYY-MM-DD.
final todayStatusProvider =
    FutureProvider.family<List<StatusEntry>, String>((ref, date) async {
  return ref.watch(fluxgenApiProvider).getStatus(date);
});

/// Parameters for weekly-range queries.
class WeekRangeParams {
  const WeekRangeParams({
    required this.from,
    required this.to,
    required this.empId,
  });
  final String from;  // YYYY-MM-DD
  final String to;    // YYYY-MM-DD
  final String empId; // 'ALL' for admin-mode full matrix

  @override
  bool operator ==(Object other) =>
      other is WeekRangeParams &&
      other.from == from &&
      other.to == to &&
      other.empId == empId;
  @override
  int get hashCode => Object.hash(from, to, empId);
}

final weekStatusProvider =
    FutureProvider.family<List<StatusEntry>, WeekRangeParams>((ref, p) async {
  return ref
      .watch(fluxgenApiProvider)
      .getStatusRange(from: p.from, to: p.to, empId: p.empId);
});

// ── Date helpers ───────────────────────────────────────────────────────────

String fluxgenDateFormat(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

String fluxgenTodayStr() => fluxgenDateFormat(DateTime.now());

/// Returns Monday of the current week (Monday-based ISO week).
DateTime currentWeekMonday([DateTime? now]) {
  final n = now ?? DateTime.now();
  return DateTime(n.year, n.month, n.day).subtract(Duration(days: n.weekday - 1));
}

/// Returns a list of 7 YYYY-MM-DD strings Mon..Sun for the current week.
List<String> currentWeekDates([DateTime? now]) {
  final mon = currentWeekMonday(now);
  return [for (int i = 0; i < 7; i++) fluxgenDateFormat(mon.add(Duration(days: i)))];
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/providers/fluxgen_provider.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/providers/fluxgen_provider.dart
git commit -m "feat(attendance): add Riverpod providers (service, empId, viewMode, data)"
```

---

## Task 5: Add attendance color helper to AppColors

**Files:**
- Modify: `lib/core/theme/app_colors.dart`

- [ ] **Step 1: Read current file head**

Open `lib/core/theme/app_colors.dart` and find the class body (add the imports if `AttendanceStatus` is not yet imported — this is a pure static helper, so we need to import the enum).

- [ ] **Step 2: Add import and method**

At the top of `lib/core/theme/app_colors.dart`, add this import below the existing `import 'package:flutter/material.dart';`:

```dart
import '../../models/fluxgen_status.dart';
```

Then at the END of the `AppColors` class body (just before the closing `}`), add:

```dart
  // ── Attendance (Fluxgen feature) ────────────────────────────────────────

  /// Brand color for each attendance status. Used by the status picker,
  /// weekly grid cells, team list chips, and the floating Attendance pill.
  static Color forAttendanceStatus(AttendanceStatus s) => switch (s) {
        AttendanceStatus.onSite       => const Color(0xFF10B981),
        AttendanceStatus.inOffice     => primary,
        AttendanceStatus.workFromHome => const Color(0xFF8B5CF6),
        AttendanceStatus.onLeave      => const Color(0xFFF59E0B),
        AttendanceStatus.holiday      => const Color(0xFF64748B),
        AttendanceStatus.weekend      => const Color(0xFF94A3B8),
        AttendanceStatus.unknown      => outlineVariant,
      };

  /// Background tint (12% alpha of the brand color). For list row backgrounds.
  static Color forAttendanceStatusBg(AttendanceStatus s) =>
      forAttendanceStatus(s).withValues(alpha: 0.12);
```

- [ ] **Step 3: Verify**

```bash
flutter analyze lib/core/theme/app_colors.dart
```
Expected: No issues found!

- [ ] **Step 4: Commit**

```bash
git add lib/core/theme/app_colors.dart
git commit -m "feat(attendance): add AppColors.forAttendanceStatus helper"
```

---

## Task 6: AttendancePill widget (glassmorphic floating entry)

**Files:**
- Create: `lib/screens/attendance/widgets/attendance_pill.dart`

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/attendance_pill.dart`:

```dart
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../providers/fluxgen_provider.dart';
import '../attendance_shell.dart';

/// Glassmorphic floating pill shown on Home (employee) and Overview (admin).
/// - Green dot: today's status submitted
/// - Amber dot: not submitted; pulses if before 10 AM
/// Tap → pushes AttendanceShell route.
class AttendancePill extends ConsumerWidget {
  const AttendancePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today      = fluxgenTodayStr();
    final statusAsync = ref.watch(todayStatusProvider(today));
    final myEmpId    = ref.watch(myEmpIdProvider);

    final submitted = statusAsync.valueOrNull?.any(
          (e) => myEmpId != null && e.empId == myEmpId,
        ) ??
        false;
    final shouldPulse = !submitted && DateTime.now().hour < 10;

    return Positioned(
      bottom: 88, // above the bottom nav (56px nav + 16px safe + 16px gap)
      right: 16,
      child: SafeArea(
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AttendanceShell()),
              );
            },
            borderRadius: BorderRadius.circular(28),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.4),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.18),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _StatusDot(submitted: submitted, pulse: shouldPulse),
                      const SizedBox(width: 10),
                      Text(
                        'Attendance',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.submitted, required this.pulse});
  final bool submitted;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    final color = submitted
        ? const Color(0xFF10B981)
        : const Color(0xFFF59E0B);
    Widget dot = Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    if (pulse) {
      dot = dot
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scaleXY(
              begin: 1.0, end: 1.5, duration: 900.ms, curve: Curves.easeInOut);
    }
    return dot;
  }
}
```

- [ ] **Step 2: Verify — will fail on AttendanceShell import**

```bash
flutter analyze lib/screens/attendance/widgets/attendance_pill.dart
```
Expected: FAIL with "Target of URI doesn't exist: '../attendance_shell.dart'". Ignore for now — we create `attendance_shell.dart` in Task 15. Do NOT commit yet.

Defer commit of this file to **after Task 15** when all imports resolve. For now, continue to Task 7.

---

## Task 7: EmpID setup dialog

**Files:**
- Create: `lib/screens/attendance/emp_id_setup_dialog.dart`

- [ ] **Step 1: Create the dialog**

Create `lib/screens/attendance/emp_id_setup_dialog.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';

/// Blocking modal shown the first time a user opens Attendance with no
/// EmpID mapping stored. Admins may skip (barrierDismissible); employees
/// cannot.
class EmpIdSetupDialog extends ConsumerStatefulWidget {
  const EmpIdSetupDialog({super.key, required this.isAdmin});
  final bool isAdmin;

  static Future<void> show(
    BuildContext context, {
    required bool isAdmin,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: isAdmin,
      builder: (_) => EmpIdSetupDialog(isAdmin: isAdmin),
    );
  }

  @override
  ConsumerState<EmpIdSetupDialog> createState() => _EmpIdSetupDialogState();
}

class _EmpIdSetupDialogState extends ConsumerState<EmpIdSetupDialog> {
  FluxgenEmployee? _selected;

  @override
  Widget build(BuildContext context) {
    final employeesAsync = ref.watch(employeesProvider);

    return AlertDialog(
      title: const Text('Who are you?'),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Pick your name from the team list — one time only.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            employeesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primary, strokeWidth: 2.5)),
              ),
              error: (e, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Could not load team list: $e',
                      style: TextStyle(color: AppColors.error, fontSize: 12)),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => ref.invalidate(employeesProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
              data: (list) => DropdownButtonFormField<FluxgenEmployee>(
                value: _selected,
                hint: const Text('Select your name'),
                isExpanded: true,
                items: [
                  for (final emp in list)
                    DropdownMenuItem(
                      value: emp,
                      child: Text(
                        emp.role.isEmpty
                            ? emp.name
                            : '${emp.name} · ${emp.role}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _selected = v),
              ),
            ),
          ],
        ),
      ),
      actions: [
        if (widget.isAdmin)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Skip'),
          ),
        FilledButton(
          onPressed: _selected == null
              ? null
              : () async {
                  await ref
                      .read(myEmpIdProvider.notifier)
                      .set(_selected!.id, _selected!.name);
                  if (context.mounted) Navigator.of(context).pop();
                },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/emp_id_setup_dialog.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/emp_id_setup_dialog.dart
git commit -m "feat(attendance): add EmpIdSetupDialog first-time mapping"
```

---

## Task 8: StatusSubmitForm widget + widget tests

**Files:**
- Create: `lib/screens/attendance/widgets/status_submit_form.dart`
- Create: `test/widgets/status_submit_form_test.dart`

- [ ] **Step 1: Write the payload class and widget**

Create `lib/screens/attendance/widgets/status_submit_form.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/fluxgen_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

class StatusSubmitPayload {
  const StatusSubmitPayload({
    required this.status,
    required this.date,
    required this.siteName,
    required this.workType,
    required this.scopeOfWork,
  });
  final AttendanceStatus status;
  final String date;
  final String siteName;
  final String workType;
  final String scopeOfWork;
}

class StatusSubmitForm extends StatefulWidget {
  const StatusSubmitForm({
    super.key,
    required this.empName,
    required this.onSubmit,
    this.isSubmitting = false,
  });
  final String empName;
  final Future<void> Function(StatusSubmitPayload) onSubmit;
  final bool isSubmitting;

  @override
  State<StatusSubmitForm> createState() => _StatusSubmitFormState();
}

class _StatusSubmitFormState extends State<StatusSubmitForm> {
  AttendanceStatus? _status;
  final _siteCtrl  = TextEditingController();
  final _scopeCtrl = TextEditingController();
  String? _workType;
  String? _validationMsg;

  @override
  void dispose() {
    _siteCtrl.dispose();
    _scopeCtrl.dispose();
    super.dispose();
  }

  bool get _needsSiteFields =>
      _status == AttendanceStatus.onSite;
  bool get _needsWorkFields =>
      _status == AttendanceStatus.onSite ||
      _status == AttendanceStatus.inOffice ||
      _status == AttendanceStatus.workFromHome;

  String _today() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  void _onSelectStatus(AttendanceStatus s) {
    HapticFeedback.lightImpact();
    setState(() {
      _status = s;
      _validationMsg = null;
    });
  }

  Future<void> _onTapSubmit() async {
    if (_status == null) {
      setState(() => _validationMsg = 'Pick a status first');
      return;
    }
    if (_needsSiteFields && _siteCtrl.text.trim().isEmpty) {
      setState(() => _validationMsg = 'Site Name is required for On Site');
      return;
    }
    if (_needsWorkFields) {
      if (_workType == null) {
        setState(() => _validationMsg = 'Pick a Work Type');
        return;
      }
      if (_scopeCtrl.text.trim().isEmpty) {
        setState(() => _validationMsg = 'Scope of Work is required');
        return;
      }
    }
    setState(() => _validationMsg = null);
    await widget.onSubmit(StatusSubmitPayload(
      status: _status!,
      date: _today(),
      siteName: _siteCtrl.text.trim(),
      workType: _workType ?? '',
      scopeOfWork: _scopeCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    const statuses = [
      (AttendanceStatus.onSite,       Icons.construction,        'On Site'),
      (AttendanceStatus.inOffice,     Icons.business,            'In Office'),
      (AttendanceStatus.workFromHome, Icons.home_work_outlined,  'WFH'),
      (AttendanceStatus.onLeave,      Icons.beach_access,        'Leave'),
      (AttendanceStatus.holiday,      Icons.celebration_outlined,'Holiday'),
      (AttendanceStatus.weekend,      Icons.weekend_outlined,    'Weekend'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Submitting as ${widget.empName}',
          style: TextStyle(
            fontSize: 13,
            color: AppColors.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.0,
          children: [
            for (final (status, icon, label) in statuses)
              _StatusCard(
                key: Key('status_card_${status.name}'),
                status: status,
                icon: icon,
                label: label,
                selected: _status == status,
                onTap: () => _onSelectStatus(status),
              ),
          ],
        ),
        const SizedBox(height: 20),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_needsSiteFields) ...[
                TextField(
                  key: const Key('site_name_field'),
                  controller: _siteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Site Name',
                    hintText: 'e.g. Biocon Bangalore',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_needsWorkFields) ...[
                DropdownButtonFormField<String>(
                  key: const Key('work_type_field'),
                  value: _workType,
                  decoration: const InputDecoration(labelText: 'Work Type'),
                  items: [
                    for (final wt in FluxgenApi.workTypes)
                      DropdownMenuItem(value: wt, child: Text(wt)),
                  ],
                  onChanged: (v) => setState(() => _workType = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('scope_field'),
                  controller: _scopeCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Scope of Work',
                    hintText: 'What are you working on?',
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        if (_validationMsg != null) ...[
          Text(_validationMsg!,
              style: TextStyle(color: AppColors.error, fontSize: 12)),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 4),
        FilledButton.icon(
          key: const Key('submit_btn'),
          onPressed: widget.isSubmitting ? null : _onTapSubmit,
          icon: widget.isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.check),
          label: Text(widget.isSubmitting ? 'Submitting…' : 'Submit Status'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            backgroundColor: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    super.key,
    required this.status,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final AttendanceStatus status;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forAttendanceStatus(status);
    return Material(
      color: selected
          ? color.withValues(alpha: 0.16)
          : Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? color : Colors.transparent,
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Write widget tests**

Create `test/widgets/status_submit_form_test.dart`:

```dart
import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/screens/attendance/widgets/status_submit_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host({required StatusSubmitForm child}) =>
    MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  testWidgets('renders 6 status cards', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    expect(find.byKey(const Key('status_card_onSite')),       findsOneWidget);
    expect(find.byKey(const Key('status_card_inOffice')),     findsOneWidget);
    expect(find.byKey(const Key('status_card_workFromHome')), findsOneWidget);
    expect(find.byKey(const Key('status_card_onLeave')),      findsOneWidget);
    expect(find.byKey(const Key('status_card_holiday')),      findsOneWidget);
    expect(find.byKey(const Key('status_card_weekend')),      findsOneWidget);
  });

  testWidgets('tap On Site reveals site + work fields', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    expect(find.byKey(const Key('site_name_field')), findsNothing);
    await tester.tap(find.byKey(const Key('status_card_onSite')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('site_name_field')), findsOneWidget);
    expect(find.byKey(const Key('work_type_field')), findsOneWidget);
    expect(find.byKey(const Key('scope_field')),     findsOneWidget);
  });

  testWidgets('tap On Leave hides all conditional fields', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    await tester.tap(find.byKey(const Key('status_card_onLeave')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('site_name_field')), findsNothing);
    expect(find.byKey(const Key('work_type_field')), findsNothing);
    expect(find.byKey(const Key('scope_field')),     findsNothing);
  });

  testWidgets('submit without status shows validation message', (tester) async {
    StatusSubmitPayload? captured;
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(
        empName: 'Alice',
        onSubmit: (p) async => captured = p,
      ),
    ));
    await tester.tap(find.byKey(const Key('submit_btn')));
    await tester.pumpAndSettle();
    expect(find.text('Pick a status first'), findsOneWidget);
    expect(captured, isNull);
  });

  testWidgets('on-site submit with all fields calls onSubmit', (tester) async {
    StatusSubmitPayload? captured;
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(
        empName: 'Alice',
        onSubmit: (p) async => captured = p,
      ),
    ));
    await tester.tap(find.byKey(const Key('status_card_onSite')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('site_name_field')), 'BLR');
    await tester.tap(find.byKey(const Key('work_type_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Project').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('scope_field')), 'HVAC');
    await tester.tap(find.byKey(const Key('submit_btn')));
    await tester.pumpAndSettle();

    expect(captured, isNotNull);
    expect(captured!.status, AttendanceStatus.onSite);
    expect(captured!.siteName, 'BLR');
    expect(captured!.workType, 'Project');
    expect(captured!.scopeOfWork, 'HVAC');
  });
}
```

- [ ] **Step 3: Run tests**

```bash
flutter test test/widgets/status_submit_form_test.dart
```
Expected: All 5 tests PASS.

- [ ] **Step 4: Run analyzer**

```bash
flutter analyze lib/screens/attendance/widgets/status_submit_form.dart test/widgets/status_submit_form_test.dart
```
Expected: No issues found!

- [ ] **Step 5: Commit**

```bash
git add lib/screens/attendance/widgets/status_submit_form.dart test/widgets/status_submit_form_test.dart
git commit -m "feat(attendance): add StatusSubmitForm with icon-card picker + widget tests"
```

---

## Task 9: WeeklyGrid widget

**Files:**
- Create: `lib/screens/attendance/widgets/weekly_grid.dart`

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/weekly_grid.dart`:

```dart
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
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/widgets/weekly_grid.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/widgets/weekly_grid.dart
git commit -m "feat(attendance): add WeeklyGrid (chip scroll + admin matrix)"
```

---

## Task 10: TeamStatsRow widget

**Files:**
- Create: `lib/screens/attendance/widgets/team_stats_row.dart`

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/team_stats_row.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

/// Tappable 2×2 grid of stat cards. Tapping a card sets the filter;
/// tapping the already-selected card clears it (null).
class TeamStatsRow extends StatelessWidget {
  const TeamStatsRow({
    super.key,
    required this.onSiteCount,
    required this.inOfficeCount,
    required this.onLeaveCount,
    required this.availableCount,
    required this.activeFilter,
    required this.onFilter,
  });

  final int onSiteCount;
  final int inOfficeCount;
  final int onLeaveCount;
  final int availableCount;

  /// When non-null, that stat is considered selected. `available` is
  /// represented by `AttendanceStatus.unknown`.
  final AttendanceStatus? activeFilter;
  final void Function(AttendanceStatus? status) onFilter;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 2.4,
      children: [
        _card(context, AttendanceStatus.onSite,       'On Site',    onSiteCount),
        _card(context, AttendanceStatus.inOffice,     'In Office',  inOfficeCount),
        _card(context, AttendanceStatus.onLeave,      'On Leave',   onLeaveCount),
        _card(context, AttendanceStatus.unknown,      'Available',  availableCount),
      ],
    );
  }

  Widget _card(BuildContext context, AttendanceStatus status, String label, int count) {
    final color = AppColors.forAttendanceStatus(status);
    final isActive = activeFilter == status;
    return Material(
      color: isActive
          ? color.withValues(alpha: 0.18)
          : Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onFilter(isActive ? null : status);
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isActive ? color : Colors.transparent,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 32,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$count',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/widgets/team_stats_row.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/widgets/team_stats_row.dart
git commit -m "feat(attendance): add TeamStatsRow tappable stat cards"
```

---

## Task 11: TeamList widget

**Files:**
- Create: `lib/screens/attendance/widgets/team_list.dart`

- [ ] **Step 1: Create the widget**

Create `lib/screens/attendance/widgets/team_list.dart`:

```dart
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
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/widgets/team_list.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/widgets/team_list.dart
git commit -m "feat(attendance): add TeamList filterable employee list"
```

---

## Task 12: Update Status tab

**Files:**
- Create: `lib/screens/attendance/attendance_update_tab.dart`

- [ ] **Step 1: Create the tab**

Create `lib/screens/attendance/attendance_update_tab.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'emp_id_setup_dialog.dart';
import 'widgets/status_submit_form.dart';

class AttendanceUpdateTab extends ConsumerStatefulWidget {
  const AttendanceUpdateTab({super.key, required this.isAdmin});
  final bool isAdmin;

  @override
  ConsumerState<AttendanceUpdateTab> createState() =>
      _AttendanceUpdateTabState();
}

class _AttendanceUpdateTabState extends ConsumerState<AttendanceUpdateTab> {
  FluxgenEmployee? _adminSelectedEmployee;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowEmpIdDialog());
  }

  Future<void> _maybeShowEmpIdDialog() async {
    final current = ref.read(myEmpIdProvider);
    if (current != null) return;
    // StateNotifier loads async — give it a moment.
    await Future.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    final again = ref.read(myEmpIdProvider);
    if (again != null) return;
    if (!mounted) return;
    await EmpIdSetupDialog.show(context, isAdmin: widget.isAdmin);
  }

  Future<void> _submit(
    StatusSubmitPayload payload,
    FluxgenEmployee target,
  ) async {
    setState(() => _isSubmitting = true);
    try {
      await ref.read(fluxgenApiProvider).submitStatus(
            empId: target.id,
            empName: target.name,
            role: target.role,
            status: payload.status,
            date: payload.date,
            siteName: payload.siteName,
            workType: payload.workType,
            scopeOfWork: payload.scopeOfWork,
          );
      ref.invalidate(todayStatusProvider(fluxgenTodayStr()));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Status submitted for ${target.name}'),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Submit failed: $e'),
          backgroundColor: AppColors.error,
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () => _submit(payload, target),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(viewModeProvider);
    final isAdminSubmit = widget.isAdmin && mode == ViewMode.admin;

    final employeesAsync = ref.watch(employeesProvider);
    final myEmpId = ref.watch(myEmpIdProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(employeesProvider);
        await ref.read(employeesProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (isAdminSubmit) ...[
            Text(
              'Submitting status for:',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            employeesAsync.when(
              loading: () => const LinearProgressIndicator(minHeight: 2),
              error: (e, _) => Text('Load error: $e'),
              data: (list) {
                _adminSelectedEmployee ??= list.isNotEmpty ? list.first : null;
                return DropdownButtonFormField<FluxgenEmployee>(
                  value: _adminSelectedEmployee,
                  isExpanded: true,
                  items: [
                    for (final e in list)
                      DropdownMenuItem(value: e, child: Text('${e.name} (${e.id})')),
                  ],
                  onChanged: (v) => setState(() => _adminSelectedEmployee = v),
                );
              },
            ),
            const SizedBox(height: 16),
          ],
          _buildForm(employeesAsync, myEmpId, isAdminSubmit),
        ],
      ),
    );
  }

  Widget _buildForm(
    AsyncValue<List<FluxgenEmployee>> employeesAsync,
    String? myEmpId,
    bool isAdminSubmit,
  ) {
    FluxgenEmployee? target;
    final list = employeesAsync.valueOrNull ?? const [];
    if (isAdminSubmit) {
      target = _adminSelectedEmployee ?? (list.isNotEmpty ? list.first : null);
    } else if (myEmpId != null) {
      for (final e in list) {
        if (e.id == myEmpId) { target = e; break; }
      }
    }
    if (target == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            Icon(Icons.person_off, size: 48, color: AppColors.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(
              myEmpId == null
                  ? 'Tap below to link your employee record'
                  : 'Your employee record could not be found',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _maybeShowEmpIdDialog,
              child: const Text('Link employee'),
            ),
          ],
        ),
      );
    }
    return StatusSubmitForm(
      empName: target.name,
      isSubmitting: _isSubmitting,
      onSubmit: (p) => _submit(p, target!),
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/attendance_update_tab.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/attendance_update_tab.dart
git commit -m "feat(attendance): add AttendanceUpdateTab with admin picker + submit"
```

---

## Task 13: Weekly tab

**Files:**
- Create: `lib/screens/attendance/attendance_weekly_tab.dart`

- [ ] **Step 1: Create the tab**

Create `lib/screens/attendance/attendance_weekly_tab.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            isAdminMode ? 'Team — this week' : 'My week',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$from  →  $to',
            style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          weekAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (e, _) => _error(context, e.toString(), refresh),
            data: (entries) {
              if (isAdminMode) {
                final employees = employeesAsync.valueOrNull ?? const [];
                if (employees.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('No employees found')),
                  );
                }
                return WeeklyGrid(
                  dates: dates,
                  entries: entries,
                  employees: employees,
                  todayStr: fluxgenTodayStr(),
                );
              }
              // Employee mode — find self
              final employees = employeesAsync.valueOrNull ?? const [];
              FluxgenEmployee? self;
              for (final e in employees) {
                if (e.id == myEmpId) { self = e; break; }
              }
              if (self == null) {
                return _noSelf(context);
              }
              return WeeklyGrid(
                dates: dates,
                entries: entries,
                employees: [self],
                todayStr: fluxgenTodayStr(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _error(BuildContext context, String msg, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(Icons.error_outline, color: AppColors.error, size: 36),
          const SizedBox(height: 8),
          Text('Could not load: $msg',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _noSelf(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Text(
          'Link your employee record on the Update tab first.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/attendance_weekly_tab.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/attendance_weekly_tab.dart
git commit -m "feat(attendance): add AttendanceWeeklyTab (self chips + admin matrix)"
```

---

## Task 14: Team tab

**Files:**
- Create: `lib/screens/attendance/attendance_team_tab.dart`

- [ ] **Step 1: Create the tab**

Create `lib/screens/attendance/attendance_team_tab.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'widgets/team_list.dart';
import 'widgets/team_stats_row.dart';

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

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Team today — $today',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 12),
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
        child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
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
    final available = (employees.length - statusByEmpId.length).clamp(0, 9999);

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
        const SizedBox(height: 16),
        TeamList(
          employees: employees,
          statusByEmpId: statusByEmpId,
          filter: _filter,
          isAdminMode: isAdminMode,
          onEdit: isAdminMode
              ? (emp, entry) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text(
                            'Edit flow coming in Phase 2 — switch to Update tab for now')),
                  );
                }
              : null,
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
              style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
flutter analyze lib/screens/attendance/attendance_team_tab.dart
```
Expected: No issues found!

- [ ] **Step 3: Commit**

```bash
git add lib/screens/attendance/attendance_team_tab.dart
git commit -m "feat(attendance): add AttendanceTeamTab with stat filter + list"
```

---

## Task 15: AttendanceShell (hosts the 3 tabs + admin toggle)

**Files:**
- Create: `lib/screens/attendance/attendance_shell.dart`

- [ ] **Step 1: Create the shell**

Create `lib/screens/attendance/attendance_shell.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/fluxgen_provider.dart';
import 'attendance_team_tab.dart';
import 'attendance_update_tab.dart';
import 'attendance_weekly_tab.dart';

class AttendanceShell extends ConsumerStatefulWidget {
  const AttendanceShell({super.key});
  @override
  ConsumerState<AttendanceShell> createState() => _AttendanceShellState();
}

class _AttendanceShellState extends ConsumerState<AttendanceShell>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final isAdmin = profileAsync.valueOrNull?.isAdmin ?? false;
    final mode = ref.watch(viewModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        bottom: TabBar(
          controller: _tab,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.onSurfaceVariant,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Update'),
            Tab(text: 'Weekly'),
            Tab(text: 'Team'),
          ],
        ),
      ),
      body: Column(
        children: [
          if (isAdmin)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: SegmentedButton<ViewMode>(
                      segments: const [
                        ButtonSegment(
                          value: ViewMode.employee,
                          icon: Icon(Icons.person_outline, size: 18),
                          label: Text('My view'),
                        ),
                        ButtonSegment(
                          value: ViewMode.admin,
                          icon: Icon(Icons.groups_outlined, size: 18),
                          label: Text('Admin'),
                        ),
                      ],
                      selected: {mode},
                      onSelectionChanged: (s) => ref
                          .read(viewModeProvider.notifier)
                          .state = s.first,
                      style: SegmentedButton.styleFrom(
                        selectedBackgroundColor: AppColors.primary,
                        selectedForegroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tab,
              children: [
                AttendanceUpdateTab(isAdmin: isAdmin),
                AttendanceWeeklyTab(isAdmin: isAdmin),
                AttendanceTeamTab(isAdmin: isAdmin),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Verify the shell + the previously-deferred pill compile together**

```bash
flutter analyze lib/screens/attendance/
```
Expected: No issues found! across ALL attendance files (including `attendance_pill.dart` from Task 6).

- [ ] **Step 3: Commit the shell AND the deferred pill together**

```bash
git add lib/screens/attendance/attendance_shell.dart lib/screens/attendance/widgets/attendance_pill.dart
git commit -m "feat(attendance): add AttendanceShell with tabs + admin SegmentedButton

Also commits the glassmorphic AttendancePill whose commit was deferred
until AttendanceShell existed to import."
```

---

## Task 16: Overlay AttendancePill on Home + Overview

**Files:**
- Modify: `lib/screens/employee/expenses/expenses_screen.dart`
- Modify: `lib/screens/admin/overview_screen.dart`

- [ ] **Step 1: Read `expenses_screen.dart` build method**

Open `lib/screens/employee/expenses/expenses_screen.dart`. Find the `Widget build(BuildContext context)` method and locate the `Scaffold(body: ...)` return statement.

- [ ] **Step 2: Modify `expenses_screen.dart`**

Add this import near the top of `expenses_screen.dart`, next to the other screen imports:

```dart
import 'package:emerald/screens/attendance/widgets/attendance_pill.dart';
```

Inside the `build` method, find the current `body:` value (probably a `RefreshIndicator(...)` or `SafeArea(...)`). Wrap it in a `Stack`:

```dart
body: Stack(
  children: [
    /* existing body widget, unchanged */,
    const AttendancePill(),
  ],
),
```

Concretely, if the current code reads:

```dart
return Scaffold(
  body: RefreshIndicator(
    onRefresh: _loadData,
    child: CustomScrollView(...),
  ),
);
```

change it to:

```dart
return Scaffold(
  body: Stack(
    children: [
      RefreshIndicator(
        onRefresh: _loadData,
        child: CustomScrollView(...),
      ),
      const AttendancePill(),
    ],
  ),
);
```

- [ ] **Step 3: Modify `overview_screen.dart`**

Open `lib/screens/admin/overview_screen.dart`. Add the same import:

```dart
import 'package:emerald/screens/attendance/widgets/attendance_pill.dart';
```

Apply the same `Stack` wrapping pattern to the `Scaffold.body`. Keep all existing loading/error/shimmer logic exactly as-is — only wrap the final body widget in a `Stack(children: [existingBody, const AttendancePill()])`.

- [ ] **Step 4: Verify**

```bash
flutter analyze lib/screens/employee/expenses/expenses_screen.dart lib/screens/admin/overview_screen.dart
```
Expected: No new issues. Any pre-existing analyzer warnings stay unchanged — do NOT fix them in this PR.

- [ ] **Step 5: Commit**

```bash
git add lib/screens/employee/expenses/expenses_screen.dart lib/screens/admin/overview_screen.dart
git commit -m "feat(attendance): overlay AttendancePill on Home + Overview screens"
```

---

## Task 17: Full project smoke test

**Files:** none

- [ ] **Step 1: Run the full analyzer**

```bash
flutter analyze
```
Expected: No NEW issues introduced by this PR. Compare against the pre-existing count from Prereq 1.

- [ ] **Step 2: Run the full test suite**

```bash
flutter test
```
Expected: All tests PASS, including the 9 service tests + 5 widget tests added in this PR.

- [ ] **Step 3: Launch on emulator or device**

```bash
flutter run
```

Manually verify the following flows (check each one):

- [ ] App launches without crash
- [ ] Logged-in employee user sees the glassmorphic Attendance pill at bottom-right of Home
- [ ] Pill status dot is amber if status not submitted today
- [ ] Tap pill → AttendanceShell opens (slide transition)
- [ ] **First open** triggers the "Who are you?" dialog → pick a name → dialog closes
- [ ] Update tab → tap "On Site" card → Site Name + Work Type + Scope fields animate in
- [ ] Fill fields → tap Submit → success snackbar appears
- [ ] Close app → reopen → pill dot is now GREEN (submitted)
- [ ] Weekly tab → shows 7 day chips with today highlighted
- [ ] Team tab → 4 stat cards + employee list
- [ ] Tap "On Site" stat card → list filters to only On Site employees
- [ ] Tap "On Site" stat card again → filter clears
- [ ] Log out, log in as admin user
- [ ] Admin sees `SegmentedButton` at top of Attendance screen (My view / Admin)
- [ ] Flip to Admin → Update tab shows employee picker dropdown
- [ ] Admin Weekly tab → shows full team matrix (horizontal scroll)
- [ ] Admin Team tab → rows have edit pencil icons
- [ ] Toggle light/dark mode — all attendance screens render correctly in both

- [ ] **Step 4: Document any manual-test findings**

If any flow above fails, open an issue or add a TODO comment where the bug is. DO NOT fix Phase 2/3/4 features — only fix regressions specific to Phase 1 scope.

---

## Task 18: Ship

- [ ] **Step 1: Review the diff**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```
Expected: ~16 commits, ~18 files changed, roughly +2500/-10 lines.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/attendance-phase-1
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat: Fluxgen Attendance (Phase 1 — status submit + weekly + team)" --body "$(cat <<'EOF'
## Summary
- Ports the daily flow of the Fluxgen Employee Status website into the fluxgen_emerald APK
- Floating glassmorphic Attendance pill on Home (employee) and Overview (admin)
- Three inner tabs: Update Status · Weekly · Team
- Admin-only Employee↔Admin SegmentedButton flips per-tab content
- Reuses existing Google Apps Script backend — no data migration
- Supabase auth + one-time EmpID mapping (SharedPreferences)

## Files
- **New:** 14 files under `lib/screens/attendance/`, `lib/models/fluxgen_status.dart`, `lib/services/fluxgen_api_service.dart`, `lib/providers/fluxgen_provider.dart`, `lib/core/constants/fluxgen_api.dart`
- **Modified:** `lib/core/theme/app_colors.dart` (added `forAttendanceStatus`), `lib/screens/employee/expenses/expenses_screen.dart` (overlay pill), `lib/screens/admin/overview_screen.dart` (overlay pill)
- **Tests:** 9 service unit tests, 5 widget tests for StatusSubmitForm

## Phases deferred (out of scope for this PR)
- **Phase 2:** work-done tracking + efficiency scoring + CSV exports
- **Phase 3:** Manage Employees / Users CRUD
- **Phase 4:** CSR reports + signature pad + PDF generation

## Test plan
- [x] `flutter test` passes
- [x] `flutter analyze` — no new warnings
- [x] Manual emulator pass: 375px light, 375px dark, 414px light — Update/Weekly/Team flows
- [x] Admin + Employee user flows verified
- [x] First-open EmpID dialog works

Design spec: `docs/superpowers/specs/2026-04-15-fluxgen-attendance-flutter-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-15-fluxgen-attendance-phase1.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Done with Phase 1.

---

## Appendix: File tree after this PR

```
fluxgen_emerald/lib/
├── core/
│   ├── constants/
│   │   └── fluxgen_api.dart                     ← NEW
│   └── theme/
│       └── app_colors.dart                      ← modified
├── models/
│   └── fluxgen_status.dart                      ← NEW
├── services/
│   └── fluxgen_api_service.dart                 ← NEW
├── providers/
│   └── fluxgen_provider.dart                    ← NEW
├── screens/
│   ├── attendance/                              ← NEW directory
│   │   ├── attendance_shell.dart
│   │   ├── attendance_update_tab.dart
│   │   ├── attendance_weekly_tab.dart
│   │   ├── attendance_team_tab.dart
│   │   ├── emp_id_setup_dialog.dart
│   │   └── widgets/
│   │       ├── attendance_pill.dart
│   │       ├── status_submit_form.dart
│   │       ├── weekly_grid.dart
│   │       ├── team_stats_row.dart
│   │       └── team_list.dart
│   ├── admin/
│   │   └── overview_screen.dart                 ← modified
│   └── employee/
│       └── expenses/
│           └── expenses_screen.dart             ← modified

fluxgen_emerald/test/
├── services/
│   └── fluxgen_api_service_test.dart            ← NEW (9 tests)
└── widgets/
    └── status_submit_form_test.dart             ← NEW (5 tests)
```

**Total:** 14 new code files + 2 test files + 3 modified files. ~2500 lines added.
