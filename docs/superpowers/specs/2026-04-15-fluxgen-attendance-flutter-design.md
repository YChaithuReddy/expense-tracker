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

**Principle:** Phase 1 must match the *daily flow* of the website exactly — anything an employee or admin does on the website `mobile.html` Home/Update/Team tabs or the desktop Update Status / Weekly Overview / Team Overview tabs must work identically in the APK.

**Phase 1 (MVP — first PR) — matches website daily flow 1:1:**
- Models, service, providers
- Attendance pill on Home + Overview
- EmpID setup dialog
- AttendanceShell with internal tabbed nav: **Update Status · Weekly · Team** (mirrors website mobile bottom-nav exactly) — visible to everyone
- Additional **Employee↔Admin SegmentedButton** at top — visible only to admins (flips what's shown *inside* each tab)
- **Update Status tab** (everyone): 6-card status picker, conditional Site/Work reveal, submit. For admins in Admin mode: employee picker dropdown appears above (pick whose status to submit).
- **Weekly tab** (everyone): In Employee mode — your own week as horizontal chip scroll. In Admin mode — full team-vs-days grid matrix.
- **Team tab** (everyone): 4 stat cards (On Site / In Office / On Leave / Available — counts live). Tap stat → filters list below. Admin mode adds edit pencil per row (opens edit sheet for that person's status).
- Light + dark mode parity
- Pull-to-refresh on Weekly + Team tabs

**Phase 2:** work-done + completion % tracking (post-status entry modal), efficiency scoring, employee CSV export (using existing `excel` package). Matches website's "Work Done" and "Download Report" sections for employees.

**Phase 3:** Manage Employees CRUD, Manage Users CRUD, 3 additional CSV exports (site / work-type / efficiency). Admin-only. Matches website admin-only tabs.

**Phase 4:** CSR reports with signature pad (Flutter `signature` package), seal image upload, PDF generation (existing `pdf` + `printing` packages). Matches website's Service Report feature.

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

## 9a. Website flow parity (Phase 1 MUST match these)

The APK's Attendance feature must replicate the website's daily flows exactly. For every flow below: if the website behaves one way, the APK must behave the same way.

### Flow 1 — Submit today's status (website `mobile.html` Update tab)
1. User opens Update Status tab → today's date pre-filled.
2. User picks status (website uses dropdown, APK uses icon cards — same result).
3. If status = "On Site", Site Name + Work Type + Scope of Work fields appear (animated reveal in APK, instant in website).
4. Submit → POST to Apps Script with `submitStatus` action.
5. Server updates existing row if `empId+date` match, else appends new row.
6. Toast confirms success. User returns to Home.

Admin variant: before step 1, user sees a "Submit status for" employee picker dropdown (default = self).

### Flow 2 — Weekly overview (website "Weekly Overview" tab)
1. Loads current week by default (Mon–Sun).
2. Employee mode: shows only that user's 7 days.
3. Admin mode: shows all employees × 7 days as a grid.
4. Cells colored by status; empty cells = no submission.
5. Tap a past cell (both modes) → opens status edit sheet for that employee+date.
6. Pull-to-refresh re-fetches.

### Flow 3 — Team overview (website `mobile.html` Team tab + desktop "Team Overview")
1. Fetches today's status for all employees.
2. Top: 4 stat cards — On Site count, In Office count, On Leave count, Available count (= employees with no submission).
3. Tap a stat card → filters list below to that category.
4. List shows each employee with status badge, site name (if on site), work type.
5. Admin mode only: edit pencil on each row (opens edit sheet).
6. Pull-to-refresh re-fetches.

### Flow 4 — First-time EmpID mapping
1. User taps Attendance pill for the first time → blocking dialog.
2. Dialog fetches employees list (`action=getEmployees`).
3. User picks their name from the list.
4. `empId` stored in SharedPreferences as `fluxgen_emp_id`.
5. Admin-role users can skip (they can pick employees per-submission anyway).

### Flow 5 — Admin toggle Employee↔Admin
1. SegmentedButton at top of AttendanceShell (admin role only).
2. Default = Employee mode (so admin sees what employee sees by default).
3. Flip to Admin → tab contents change as described in Flows 1-3.
4. State persists only within session (not saved).

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
