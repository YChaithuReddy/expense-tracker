# Fluxgen Attendance — Flutter Integration Design

**Status:** Design approved, ready for implementation plan
**Date:** 2026-04-15
**Target app:** `fluxgen_emerald/` (existing Riverpod + go_router + Supabase Flutter app)
**Feature:** Port the Fluxgen Employee Status website (https://employee-status-one.vercel.app/) into the Flutter APK as a new "Attendance" feature with Employee↔Admin toggle for admins.

---

## 1. Decisions locked

| Decision | Choice |
|---|---|
| Backend | Reuse existing Google Apps Script endpoint (no migration) |
| Auth | Supabase login (existing) + one-time EmpID mapping stored in `SharedPreferences` |
| Toggle visibility | Only admins see Employee↔Admin toggle; employees see Employee view only |
| Scope delivery | Phase 1 MVP → Phase 2 → Phase 3 → Phase 4 (separate PRs) |
| Entry point | Glassmorphic floating pill on Home (Employee) and Overview (Admin) — same pattern as super-user toggle at `app.dart:448` |

## 2. Visual direction — "Linear-meets-Notion, not spreadsheet port"

- **Entry pill**: BackdropFilter-blurred, teal gradient border, status dot (green = submitted today, amber = pending), subtle pulse if not submitted by 10 AM.
- **Admin toggle**: Material 3 `SegmentedButton` with animated sliding thumb — `[My Status | Team View]`. Only rendered if role is admin.
- **Status selection**: 3×2 grid of icon cards (On Site / In Office / WFH / Leave / Holiday / Weekend) instead of a dropdown. Tapping On Site animates-reveals Site Name + Work Type fields below.
- **Weekly view**: horizontal scroll of day cards colored by status, today has a pulsing ring.
- **Admin Team view**: 4 big stat cards at top (On Site / In Office / On Leave / Absent) → tap a card to filter the team list below.
- **Hero transition**: pill morphs into the Attendance top app bar.
- **Haptic**: `HapticFeedback.lightImpact()` on status selection.
- **Dark mode**: inherited from existing theme — status colors stay, surfaces flip.

### Status color palette

| Status | Hex | Use |
|---|---|---|
| On Site | `#10B981` emerald | Active |
| In Office | `#006699` app teal | On-brand |
| WFH | `#8B5CF6` violet | Flexible |
| Leave | `#F59E0B` amber | Attention |
| Holiday | `#64748B` slate | Neutral |
| Weekend | `#94A3B8` light slate | Muted |

## 3. Architecture

```
lib/
├── core/constants/
│   └── fluxgen_api.dart              ← kFluxgenApiUrl constant
├── models/
│   └── fluxgen_status.dart           ← StatusEntry, FluxgenEmployee classes
├── services/
│   └── fluxgen_api_service.dart      ← wraps Apps Script GET/POST
├── providers/
│   └── fluxgen_provider.dart         ← Riverpod providers
└── screens/
    └── attendance/
        ├── attendance_shell.dart         ← host + Employee↔Admin toggle
        ├── employee_status_screen.dart   ← submit + my week
        ├── admin_status_screen.dart      ← team today + team week
        ├── widgets/
        │   ├── attendance_pill.dart       ← the floating entry pill
        │   ├── status_submit_form.dart    ← 6-card status picker + conditional fields
        │   ├── weekly_grid.dart           ← horizontal day chip scroll
        │   ├── team_stats_row.dart        ← 4 tap-to-filter stat cards
        │   └── team_list.dart             ← filterable employee list
        └── emp_id_setup_dialog.dart      ← one-time EmpID mapping
```

**Edits to existing files (2 only):**
1. `screens/employee/expenses/expenses_screen.dart` — embed `AttendancePill` via Stack overlay
2. `screens/admin/overview_screen.dart` — same

No edits to `employee_shell.dart` or `admin_shell.dart` (navigation untouched).

## 4. Data flow

```
Supabase login → AuthGate → RoleRouter → Shell
                                            │
                                            ▼
                                     Home / Overview
                                         [Attendance pill]
                                            │ hero transition
                                            ▼
                                     AttendanceShell
                                     (admin? SegmentedButton)
                                       ├─ EmployeeStatusScreen
                                       └─ AdminStatusScreen
                                            │
                                            ▼ http
                                  FluxgenApiService
                                            │
                                            ▼ GET/POST
                        script.google.com/macros/.../exec
                                            │
                                            ▼
                           Google Sheet (Users, Employees, StatusUpdates)
```

## 5. API contracts

Endpoint: `https://script.google.com/macros/s/AKfycbzFHKifKgVF5bW56sTV4PX0I-4bJn1PoGg6fXE8oQfoI-reRSRq07tBVKM_B-n-FVfqcw/exec`

| Call | HTTP | Params | Returns |
|---|---|---|---|
| `getEmployees` | GET | — | `{status, employees: [{id, name, role}]}` |
| `getStatus` | GET | `date=YYYY-MM-DD` | `{status, data: [StatusEntry[]]}` |
| `getStatusRange` | GET | `from, to, empId` (`empId='ALL'` for all) | Same shape, range |
| `submitStatus` | POST | `empId, empName, role, siteName, workType, scopeOfWork, status, date` | `{status}` |

**StatusEntry fields** returned from server:
`empId, empName, role, siteName, workType, scopeOfWork, status, date, workDone, completionPct, workRemarks, nextVisitRequired, nextVisitDate`

Phase 1 uses `empId, empName, siteName, workType, scopeOfWork, status, date` — others come in Phase 2.

## 6. State (Riverpod)

```dart
// providers/fluxgen_provider.dart
final fluxgenApiProvider = Provider((ref) => FluxgenApiService());

final employeesProvider = FutureProvider<List<FluxgenEmployee>>((ref) async {
  return ref.watch(fluxgenApiProvider).getEmployees();
});

final todayStatusProvider = FutureProvider.family<List<StatusEntry>, String>((ref, date) async {
  return ref.watch(fluxgenApiProvider).getStatus(date);
});

final myEmpIdProvider = StateNotifierProvider<MyEmpIdNotifier, String?>((ref) {
  return MyEmpIdNotifier(); // reads/writes SharedPreferences 'fluxgen_emp_id'
});

enum ViewMode { employee, admin }
final viewModeProvider = StateProvider<ViewMode>((_) => ViewMode.employee);
```

Cache strategy: FutureProviders have Riverpod's default caching; `employeesProvider` refreshed on pull-to-refresh only.

## 7. Phased rollout

**Phase 1 (MVP — first PR):**
- Models, service, providers
- Attendance pill on Home + Overview
- AttendanceShell with conditional SegmentedButton
- EmployeeStatusScreen: 6-card status picker, conditional Site/Work reveal, submit, my week (horizontal scroll)
- AdminStatusScreen: team today (stat cards + filterable list), team week (matrix)
- EmpID setup dialog
- Light + dark mode parity

**Phase 2:** work-done + completion % tracking, efficiency scoring, employee CSV export (using existing `excel` package).

**Phase 3:** Manage Employees CRUD, Manage Users CRUD, 3 additional CSV exports (site / work-type / efficiency).

**Phase 4:** CSR reports with signature pad (Flutter `signature` package), seal image upload, PDF generation (existing `pdf` + `printing` packages).

## 8. Error handling

| Scenario | Behavior |
|---|---|
| Apps Script slow (2–5s) | Shimmer loading on lists (existing `shimmer` package) |
| Network fail | Cached response + amber "Offline — showing last sync" banner |
| Submit fail | Toast + "Retry" button, input preserved |
| Employee tries to see admin view | Toggle not rendered — no backdoor |
| Malformed server row | Skip row, log, toast "1 entry skipped" |
| Duplicate submission same date | Server's `doPost` updates existing row (already handled) |
| No EmpID mapped | Blocking dialog on first Attendance open, "Skip" option for admins |
| Super-user global toggle + per-screen toggle | Per-screen view state wins inside Attendance |

## 9. Testing & quality gates

- **Widget tests:** status form renders 6 cards, conditional reveal works, SegmentedButton flips view
- **Integration test:** submit status → GET returns it
- **Manual pass:** Android emulator screenshots at 360/375/414 widths, light + dark mode
- **Code review agent** before shipping each phase
- **Final gate:** run existing `flutter analyze` + `flutter test`, fix all lints

## 10. Out of scope (explicit)

- Migrating Fluxgen data to Supabase (deferred to later project)
- Website updates (website keeps working unchanged)
- Push notifications / reminders (could come later)
- GPS / geo-fenced check-in (website doesn't have it either)
- Offline-first write queue (Phase 5+ if needed)

## 11. Success criteria

A user with the expense-tracker APK installed:
1. Logs in once with their existing Supabase account.
2. Sees a floating "Attendance" pill on Home.
3. Taps it, picks their name from the team list (one time only).
4. Submits today's status in ≤3 taps for most statuses.
5. (If admin) Flips a toggle to see the team today at a glance + who's where this week.
6. All data shows up in the same Google Sheet your website already writes to.

---

*Design approved. Next step: invoke `superpowers:writing-plans` skill to produce the implementation plan.*
