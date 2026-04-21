---
tags: [fluxgen, attendance, phases]
created: 2026-04-21
updated: 2026-04-21
---

# Attendance Feature — 4-Phase Port

Ported the Fluxgen Employee Status website (https://employee-status-one.vercel.app/) into the Flutter APK with full parity + modern UI + Asanify integration.

## Source spec
- Website: `C:\Users\chath\Downloads\employee-status--main\employee-status--main\`
- Backend: Google Apps Script (reused, no migration)
- Design spec: `docs/superpowers/specs/2026-04-15-fluxgen-attendance-flutter-design.md`

## Phases (all shipped)

| Phase | PR | Files | Ships |
|---|---|---|---|
| **Phase 1** | [#1](https://github.com/YChaithuReddy/expense-tracker/pull/1) + [#2](https://github.com/YChaithuReddy/expense-tracker/pull/2) | shell + tabs + pill | Status submit, weekly grid, team view, admin toggle, EmpID mapping, glassmorphic pill |
| **Phase 2** | [#3](https://github.com/YChaithuReddy/expense-tracker/pull/3) | work-done + efficiency + CSV | Work-done modal, efficiency scoring, 4 CSV exports |
| **Phase 3** | [#4](https://github.com/YChaithuReddy/expense-tracker/pull/4) | CRUD + filters | Manage Employees CRUD, Manage Users CRUD, CSV filter pickers |
| **Phase 4** | [#5](https://github.com/YChaithuReddy/expense-tracker/pull/5) | CSR + signature + PDF | CSR form (27 fields), signature pad, seal upload, PDF generation |
| **Cleanup** | [#6](https://github.com/YChaithuReddy/expense-tracker/pull/6) | analyzer | All 22 pre-existing warnings fixed |
| **Asanify** | [#7](https://github.com/YChaithuReddy/expense-tracker/pull/7) | integration | Auto-prompt to clock in after status submit |

## Architecture

```
lib/screens/attendance/
├── attendance_shell.dart           ← 3 tabs + admin gear menu + [Me/Admin] pill
├── attendance_update_tab.dart      ← 6 status icon cards + submit + Asanify prompt
├── attendance_weekly_tab.dart      ← 7-day chips / admin matrix
├── attendance_team_tab.dart        ← 4 stat cards + filterable list + efficiency + share FAB
├── manage_employees_screen.dart    ← admin-only CRUD
├── manage_users_screen.dart        ← admin-only CRUD, super-admin protected
├── emp_id_setup_dialog.dart        ← first-time mapping
├── csr/
│   ├── csr_form_screen.dart        ← 9 sections, 27 fields
│   └── signature_pad.dart          ← custom Canvas-based widget
└── widgets/
    ├── attendance_pill.dart        ← glassmorphic entry on Home/Overview
    ├── status_submit_form.dart     ← 6 icon cards with gradient selection
    ├── weekly_grid.dart            ← chip scroll or matrix
    ├── team_stats_row.dart         ← 4 tappable stat cards
    ├── team_list.dart              ← filterable list
    ├── efficiency_section.dart     ← metric cards + color-coded table
    ├── export_sheet.dart           ← 4 CSV exports with filter pickers
    └── work_done_sheet.dart        ← bottom sheet editor
```

## Key patterns

- **Admin detection**: `userProfileProvider.valueOrNull?.isAdmin` — `role == 'admin'` in Supabase `profiles` table
- **GAS 302 handling**: All POSTs accept 2xx-3xx as success. GAS always 302-redirects after executing the script.
- **EmpID mapping**: Stored in `SharedPreferences` key `fluxgen_emp_id`. First-time dialog blocks non-admin users.
- **Role refetch**: `AttendanceShell.initState` invalidates `userProfileProvider` to pick up Supabase role changes without app restart.

## See also
- [[FluxGen-Architecture]]
- [[20-Decisions/002-Three-Tabs-Plus-Gear-Menu]]
- [[20-Decisions/003-Debug-Signing-For-Updates]]
- [[FluxGen-Release-Workflow]]
