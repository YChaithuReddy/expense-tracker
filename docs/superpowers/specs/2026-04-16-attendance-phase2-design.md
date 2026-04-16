# Fluxgen Attendance — Phase 2 Design Spec

**Date:** 2026-04-16
**Status:** Approved, ready for implementation
**Depends on:** Phase 1 (merged as PR #1 + PR #2)
**Target app:** `fluxgen_emerald/`

---

## Scope

Three features ported 1:1 from the Fluxgen Employee Status website:

1. **Work Done / Completion % tracking** — post-status entry modal
2. **Efficiency scoring** — client-side scoring matrix + dashboard cards
3. **CSV export** — 4 report types shared via native share sheet

## Feature 1: Work Done modal

### Trigger
- Tap a day chip in Weekly tab → opens bottom sheet for that employee+date
- Tap the edit pencil in Team list (admin mode) → same bottom sheet

### Bottom sheet UI
- Header: employee name · site · date
- "Work Done Description" — multiline TextField (required)
- Completion % — Slider (0–100) with live percentage label
- "Remarks" — multiline TextField (optional)
- "Next Visit Required?" — SegmentedButton Yes/No (default No)
- If Yes → DatePicker for next visit date
- Save button (gradient, matches Phase 1 style)

### Pre-fill
If the status entry already has workDone data (from a prior save), pre-fill all fields. User can edit and re-save.

### API
POST `action=updateWorkDone` with: `empId, date, workDone, completionPct, workRemarks, nextVisitRequired, nextVisitDate`

Accept 2xx–3xx as success (same 302 pattern as submitStatus).

### Files
- **Create:** `lib/screens/attendance/widgets/work_done_sheet.dart`
- **Modify:** `lib/services/fluxgen_api_service.dart` — add `updateWorkDone()` method
- **Modify:** `lib/screens/attendance/widgets/weekly_grid.dart` — wire `onCellTap` callback
- **Modify:** `lib/screens/attendance/widgets/team_list.dart` — wire `onEdit` callback
- **Modify:** `lib/screens/attendance/attendance_weekly_tab.dart` — pass callback through
- **Modify:** `lib/screens/attendance/attendance_team_tab.dart` — pass callback through

## Feature 2: Efficiency scoring

### Visibility
Admin mode only. Appears as a section inside the Team tab, below the team list.

### Calculation (pure Dart, client-side — matches website exactly)

```
getEfficiency(status, workType):
  On Leave       → 0%
  Holiday        → -1 (excluded from average)
  On Site + Project      → 100%
  On Site + Service      → 90%
  On Site + Office Work  → 85%
  In Office + Project    → 80%
  In Office + Service    → 75%
  In Office + Office Work → 75%
  WFH + Project          → 70%
  WFH + Service          → 65%
  WFH + Office Work      → 60%
  Default                → 50%
```

### Aggregation
- Fetch all entries for date range via `getStatusRange`
- Deduplicate by empId+date (latest wins)
- Separate weekday vs weekend entries
- Per employee: daysWorked, onSiteDays, leaveDays, weekendWorked, avgEfficiency
- Team summary: deployRate, onSiteRate, leaveRate, utilizationRate

### UI
- Date range picker row (defaults to current week)
- 4 metric cards: Deployed % | On Site % | Leave % | Utilization %
- Expandable table: Employee | Days | On Site | Leave | Avg Eff (color-coded: green ≥80, orange ≥60, red <60)

### Files
- **Create:** `lib/core/utils/efficiency_calculator.dart` (pure Dart, no Flutter — unit-testable)
- **Create:** `lib/screens/attendance/widgets/efficiency_section.dart`
- **Modify:** `lib/screens/attendance/attendance_team_tab.dart` — embed efficiency section (admin mode)

## Feature 3: CSV export (4 reports)

### Trigger
Share icon FAB on Team tab (admin mode) → bottom sheet with 4 export buttons + date range picker.

### Reports
1. **Employee Daily** — columns: EmpID, Name, Role, Site, Work Type, Scope, Status, Efficiency %, Date, Work Done, Completion %, Remarks
2. **Site-Wise** — same columns, filtered by site
3. **Work Type** — same columns, filtered by work type
4. **Team Efficiency** — 3 sections: detail rows, overall stats, per-employee summary

### Mechanism
- Generate CSV string in Dart (proper escaping: quote fields with commas/newlines)
- Write to temp file via `path_provider` (`getTemporaryDirectory()`)
- Share via `share_plus` (`Share.shareXFiles([XFile(path)])`)
- Both packages already in pubspec

### Files
- **Create:** `lib/services/attendance_csv_service.dart`
- **Create:** `lib/screens/attendance/widgets/export_sheet.dart`
- **Modify:** `lib/screens/attendance/attendance_team_tab.dart` — add FAB

## Architecture

```
NEW files (5):
  lib/core/utils/efficiency_calculator.dart
  lib/services/attendance_csv_service.dart
  lib/screens/attendance/widgets/work_done_sheet.dart
  lib/screens/attendance/widgets/efficiency_section.dart
  lib/screens/attendance/widgets/export_sheet.dart

MODIFIED files (5):
  lib/services/fluxgen_api_service.dart         (+updateWorkDone)
  lib/screens/attendance/widgets/weekly_grid.dart (+onCellTap wiring)
  lib/screens/attendance/widgets/team_list.dart   (+onEdit wiring)
  lib/screens/attendance/attendance_weekly_tab.dart (+callback passthrough)
  lib/screens/attendance/attendance_team_tab.dart  (+efficiency section + export FAB)

TEST files (3):
  test/utils/efficiency_calculator_test.dart
  test/services/attendance_csv_service_test.dart
  test/widgets/work_done_sheet_test.dart
```

## Tests
- `efficiency_calculator_test.dart` — every status×workType combo, edge cases (Holiday exclusion, empty list, cap at 100%)
- `attendance_csv_service_test.dart` — valid CSV output, proper escaping, correct headers per report type
- `work_done_sheet_test.dart` — slider updates %, conditional date picker visibility, required field validation
