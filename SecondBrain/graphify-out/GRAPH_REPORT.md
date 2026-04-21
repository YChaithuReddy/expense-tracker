# Graph Report - .  (2026-04-21)

## Corpus Check
- Corpus is ~7,570 words - fits in a single context window. You may not need a graph.

## Summary
- 76 nodes · 168 edges · 8 communities detected
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ADR-006 Mandatory 7-Step Workflow for...|ADR-006: Mandatory 7-Step Workflow for...]]
- [[_COMMUNITY_Attendance Feature - 4-Phase Port|Attendance Feature - 4-Phase Port]]
- [[_COMMUNITY_FluxGen Expense Tracker - Architecture|FluxGen Expense Tracker - Architecture]]
- [[_COMMUNITY_FluxGen Release Workflow|FluxGen Release Workflow]]
- [[_COMMUNITY_FluxGen v2.1.0 â€” Attendance + Asanif...|FluxGen v2.1.0 â€” Attendance + Asanif...]]
- [[_COMMUNITY_ADR-005 Asanify clock-in prompt|ADR-005: Asanify clock-in prompt]]
- [[_COMMUNITY_emp_id_setup_dialog.dart|emp_id_setup_dialog.dart]]
- [[_COMMUNITY_Fluxgen|Fluxgen]]

## God Nodes (most connected - your core abstractions)
1. `Attendance Feature - 4-Phase Port` - 28 edges
2. `FluxGen Expense Tracker - Architecture` - 21 edges
3. `FluxGen v2.1.0 â€” Attendance + Asanify release` - 14 edges
4. `ADR-006: Mandatory 7-Step Workflow for Every Request` - 14 edges
5. `FluxGen Release Workflow` - 13 edges
6. `ADR-004: R8 + shrink resources` - 12 edges
7. `User Preferences â€” Working with Chaitanya` - 12 edges
8. `Anti-Pattern Library` - 10 edges
9. `Debugging Log` - 10 edges
10. `Architecture Decisions Index` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Full-Parity Port (no deferred features)` --conceptually_related_to--> `Attendance Feature - 4-Phase Port`  [INFERRED]
  03-Areas/User-Preferences.md → 10-Code-Context/Attendance-Feature.md
- `Pending Fixes (reported 2026-04-03)` --semantically_similar_to--> `Debugging Log`  [INFERRED] [semantically similar]
  02-Projects/Pending-Fixes.md → 04-Resources/Debugging-Log.md
- `Mandatory 7-Step Workflow` --semantically_similar_to--> `User Preferences â€” Working with Chaitanya`  [INFERRED] [semantically similar]
  04-Resources/Workflow.md → 03-Areas/User-Preferences.md
- `FluxGen v2.1.0 â€” Attendance + Asanify release` --references--> `Claude Code Setup Reference`  [EXTRACTED]
  02-Projects/FluxGen-v2.1.0.md → 04-Resources/Claude-Code-Setup.md
- `Attendance Feature - 4-Phase Port` --rationale_for--> `ADR-005: Asanify clock-in prompt`  [INFERRED]
  10-Code-Context/Attendance-Feature.md → 20-Decisions/000-index.md

## Communities

### Community 0 - "ADR-006: Mandatory 7-Step Workflow for..."
Cohesion: 0.27
Nodes (18): ADR-006: Mandatory 7-Step Workflow for Every Request, 7-Step Workflow (Understanding â†’ Learning), Ask Before Editing (always), Async/Await Discipline (no fire-and-forget), Multi-Class CSS Override Trap, Full-Parity Port (no deferred features), Linear-meets-Notion Premium UI Style, Scan Button Disabled After Re-Upload Bug (+10 more)

### Community 1 - "Attendance Feature - 4-Phase Port"
Cohesion: 0.16
Nodes (16): ADR-002: Three tabs + gear menu, Attendance Feature - 4-Phase Port, EmpID mapping via SharedPreferences, GAS 302 response handling, Admin role detection, attendance_pill.dart, AttendanceShell, attendance_team_tab.dart (+8 more)

### Community 2 - "FluxGen Expense Tracker - Architecture"
Cohesion: 0.19
Nodes (15): ADR-001: Reuse Google Apps Script backend, Flutter Implementation Kickoff (2026-04-04), Web Index Page Redesign â€” Modern Fintech Theme, Claude Code Setup Reference, Fintech Teal Palette (#10B981), FluxGen Expense Tracker - Architecture, FluxgenApiService, YChaithuReddy/expense-tracker (+7 more)

### Community 3 - "FluxGen Release Workflow"
Cohesion: 0.27
Nodes (12): ADR-003: Debug keystore for updates, ADR-004: R8 + shrink resources, Debug keystore signing, Flutter build modes (debug/profile/release), In-app update mechanism, mapping.txt deobfuscation, Per-ABI split APK, R8 code shrinking (+4 more)

### Community 4 - "FluxGen v2.1.0 â€” Attendance + Asanif..."
Cohesion: 0.5
Nodes (8): Architecture Decisions Index, Phase 1 - Core attendance, Phase 2 - Work-done + efficiency + CSV, Phase 3 - CRUD + CSV filters, Phase 4 - CSR + signature + PDF, Phased Delivery over Big-Bang, FluxGen v2.1.0 â€” Attendance + Asanify release, Second Brain README

### Community 5 - "ADR-005: Asanify clock-in prompt"
Cohesion: 0.4
Nodes (5): ADR-005: Asanify clock-in prompt, Asanify has no public API, Once-per-day prompt dedupe pattern, Status-submit prompt trigger, Flutter url_launcher package

### Community 6 - "emp_id_setup_dialog.dart"
Cohesion: 1.0
Nodes (1): emp_id_setup_dialog.dart

### Community 7 - "Fluxgen"
Cohesion: 1.0
Nodes (1): Fluxgen

## Knowledge Gaps
- **22 isolated node(s):** `Riverpod 2.6`, `Sentry`, `OCR.space`, `Vercel`, `attendance_weekly_tab.dart` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `emp_id_setup_dialog.dart`** (1 nodes): `emp_id_setup_dialog.dart`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Fluxgen`** (1 nodes): `Fluxgen`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Attendance Feature - 4-Phase Port` connect `Attendance Feature - 4-Phase Port` to `ADR-006: Mandatory 7-Step Workflow for...`, `FluxGen Expense Tracker - Architecture`, `FluxGen Release Workflow`, `FluxGen v2.1.0 â€” Attendance + Asanif...`, `ADR-005: Asanify clock-in prompt`?**
  _High betweenness centrality (0.362) - this node is a cross-community bridge._
- **Why does `FluxGen Expense Tracker - Architecture` connect `FluxGen Expense Tracker - Architecture` to `ADR-006: Mandatory 7-Step Workflow for...`, `Attendance Feature - 4-Phase Port`, `FluxGen Release Workflow`, `FluxGen v2.1.0 â€” Attendance + Asanif...`, `ADR-005: Asanify clock-in prompt`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `FluxGen Release Workflow` connect `FluxGen Release Workflow` to `ADR-006: Mandatory 7-Step Workflow for...`, `Attendance Feature - 4-Phase Port`, `FluxGen Expense Tracker - Architecture`, `FluxGen v2.1.0 â€” Attendance + Asanif...`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Attendance Feature - 4-Phase Port` (e.g. with `ADR-005: Asanify clock-in prompt` and `Full-Parity Port (no deferred features)`) actually correct?**
  _`Attendance Feature - 4-Phase Port` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `ADR-006: Mandatory 7-Step Workflow for Every Request` (e.g. with `7-Step Workflow (Understanding â†’ Learning)` and `Mandatory TaskCreate/TaskUpdate Discipline`) actually correct?**
  _`ADR-006: Mandatory 7-Step Workflow for Every Request` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Riverpod 2.6`, `Sentry`, `OCR.space` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._