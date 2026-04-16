# Attendance Phase 3 — Manage Employees + Users CRUD + CSV Filters

> **For agentic workers:** Use superpowers:subagent-driven-development to implement.

**Goal:** Add admin-only employee/user management screens + enhance CSV export with filter pickers.

**Architecture:** Two new screens accessible from a gear icon in the Attendance hero header. CRUD operations via existing GAS POST actions. Enhanced export sheet adds site/workType/employee dropdown filters before generating CSV.

**Working directory:** `C:\Users\chath\Documents\Python code\expense tracker\fluxgen_emerald\`

---

## Task 1: Add CRUD methods to FluxgenApiService

**Files:** Modify `lib/services/fluxgen_api_service.dart`

Add 5 methods (after `updateWorkDone`, before `// ── Helpers`):

```dart
  // ── Employee CRUD ──────────────────────────────────────────────────

  Future<void> addEmployee({
    required String empId,
    required String empName,
    required String role,
  }) async {
    await _postAction('addEmployee', {
      'empId': empId, 'empName': empName, 'role': role,
    });
  }

  Future<void> editEmployee({
    required String empId,
    required String empName,
    required String role,
  }) async {
    await _postAction('editEmployee', {
      'empId': empId, 'empName': empName, 'role': role,
    });
  }

  Future<void> deleteEmployee({required String empId}) async {
    await _postAction('deleteEmployee', {'empId': empId});
  }

  // ── User CRUD ─────────────────────────────────────────────────────

  Future<void> addUser({
    required String username,
    required String password,
    required String role,
    required String displayName,
  }) async {
    await _postAction('addUser', {
      'username': username, 'password': password,
      'role': role, 'displayName': displayName,
    });
  }

  Future<void> deleteUser({required String username}) async {
    await _postAction('deleteUser', {'username': username});
  }
```

Also add a private helper `_postAction` to DRY the POST logic:

```dart
  Future<void> _postAction(String action, Map<String, String> params) async {
    final body = <String, String>{'action': action, ...params};
    final resp = await _client
        .post(
          Uri.parse(FluxgenApi.scriptUrl),
          headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
          body: body,
        )
        .timeout(const Duration(seconds: 20));
    if (resp.statusCode < 200 || resp.statusCode >= 400) {
      throw Exception('$action failed: HTTP ${resp.statusCode}');
    }
  }
```

Refactor `submitStatus` and `updateWorkDone` to use `_postAction` too (optional but cleaner).

Add `getUsers` GET method:

```dart
  Future<List<Map<String, dynamic>>> getUsers() async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {'action': 'getUsers'},
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    final body = _decodeBody(resp.body);
    final users = body['users'];
    if (users is Map<String, dynamic>) {
      return users.entries.map((e) {
        final v = e.value as Map<String, dynamic>;
        return {'username': e.key, ...v};
      }).toList();
    }
    return [];
  }
```

Commit after verify.

---

## Task 2: Manage Employees screen

**Files:** Create `lib/screens/attendance/manage_employees_screen.dart`

Full-screen pushed from the hero header gear icon. Shows:
- List of employees from `employeesProvider`
- FAB to add new employee → dialog with EmpID, Name, Role fields
- Swipe-to-delete on each row → confirmation dialog
- Tap row → edit dialog (pre-filled Name, Role — EmpID not editable)
- Pull to refresh

Uses `ref.read(fluxgenApiProvider).addEmployee(...)` etc. After each mutation, `ref.invalidate(employeesProvider)`.

Premium style: white card list rows with avatar initials, role chip, slide actions.

---

## Task 3: Manage Users screen

**Files:** Create `lib/screens/attendance/manage_users_screen.dart`

Similar to Manage Employees but for the Users sheet:
- List users from `getUsers()` (new provider needed)
- Add user dialog: username, password, role dropdown (admin/manager/user), displayName
- Delete user (swipe or button) — cannot delete super-admin "anil"
- No edit (website doesn't have edit either — add/delete only)

---

## Task 4: Wire management screens to hero header

**Files:** Modify `lib/screens/attendance/attendance_shell.dart`

Add a gear/settings `IconButton` in the hero header (next to back arrow or admin pill). Tap → shows a bottom sheet or pushes to a "Management" screen with two tiles: "Manage Employees" and "Manage Users". Only visible in admin mode.

---

## Task 5: Enhanced CSV export filters

**Files:** Modify `lib/screens/attendance/widgets/export_sheet.dart`

Current export sheet has 4 tiles but no filter pickers. Add:
- Site-Wise: show site dropdown (populated from entries' unique sites) before generating
- Work Type: show workType dropdown before generating
- Employee: show employee dropdown before generating

Use `showDialog` with a dropdown before calling the CSV generator.

---

## Task 6: Users provider

**Files:** Modify `lib/providers/fluxgen_provider.dart`

Add:
```dart
final usersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.watch(fluxgenApiProvider).getUsers();
});
```

---

## Task 7: Smoke test + ship

Run analyzer, tests, build APK, push, PR, merge.
