# Graph Report - .  (2026-04-21)

## Corpus Check
- Corpus is ~2,962 words - fits in a single context window. You may not need a graph.

## Summary
- 54 nodes · 93 edges · 13 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ADR-004 R8 + shrink resources|ADR-004: R8 + shrink resources]]
- [[_COMMUNITY_FluxGen v2.1.0 â€” Attendance + Asanify ...|FluxGen v2.1.0 â€” Attendance + Asanify ...]]
- [[_COMMUNITY_FluxGen Expense Tracker - Architecture|FluxGen Expense Tracker - Architecture]]
- [[_COMMUNITY_Attendance Feature - 4-Phase Port|Attendance Feature - 4-Phase Port]]
- [[_COMMUNITY_ADR-005 Asanify clock-in prompt|ADR-005: Asanify clock-in prompt]]
- [[_COMMUNITY_ADR-001 Reuse Google Apps Script backen...|ADR-001: Reuse Google Apps Script backen...]]
- [[_COMMUNITY_ADR-002 Three tabs + gear menu|ADR-002: Three tabs + gear menu]]
- [[_COMMUNITY_Capacitor|Capacitor]]
- [[_COMMUNITY_csr_form_screen.dart|csr_form_screen.dart]]
- [[_COMMUNITY_manage_employees_screen.dart|manage_employees_screen.dart]]
- [[_COMMUNITY_Asanify|Asanify]]
- [[_COMMUNITY_emp_id_setup_dialog.dart|emp_id_setup_dialog.dart]]
- [[_COMMUNITY_Fluxgen|Fluxgen]]

## God Nodes (most connected - your core abstractions)
1. `Attendance Feature - 4-Phase Port` - 26 edges
2. `FluxGen Expense Tracker - Architecture` - 18 edges
3. `FluxGen v2.1.0 â€” Attendance + Asanify release` - 11 edges
4. `ADR-004: R8 + shrink resources` - 11 edges
5. `FluxGen Release Workflow` - 8 edges
6. `ADR-005: Asanify clock-in prompt` - 8 edges
7. `Architecture Decisions Index` - 7 edges
8. `ADR-003: Debug keystore for updates` - 7 edges
9. `Asanify` - 5 edges
10. `Second Brain README` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Claude Code Setup Reference` --references--> `FluxGen Expense Tracker - Architecture`  [EXTRACTED]
  04-Resources/Claude-Code-Setup.md → 10-Code-Context/FluxGen-Architecture.md
- `ADR-005: Asanify clock-in prompt` --rationale_for--> `Attendance Feature - 4-Phase Port`  [INFERRED]
  20-Decisions/000-index.md → 10-Code-Context/Attendance-Feature.md
- `ADR-005: Asanify clock-in prompt` --rationale_for--> `Asanify`  [INFERRED]
  20-Decisions/000-index.md → 10-Code-Context/FluxGen-Architecture.md
- `Second Brain README` --references--> `FluxGen Expense Tracker - Architecture`  [EXTRACTED]
  README.md → 10-Code-Context/FluxGen-Architecture.md
- `Second Brain README` --references--> `Attendance Feature - 4-Phase Port`  [EXTRACTED]
  README.md → 10-Code-Context/Attendance-Feature.md

## Communities

### Community 0 - "ADR-004: R8 + shrink resources"
Cohesion: 0.31
Nodes (11): ADR-003: Debug keystore for updates, ADR-004: R8 + shrink resources, Debug keystore signing, Flutter build modes (debug/profile/release), In-app update mechanism, mapping.txt deobfuscation, Per-ABI split APK, R8 code shrinking (+3 more)

### Community 1 - "FluxGen v2.1.0 â€” Attendance + Asanify ..."
Cohesion: 0.39
Nodes (8): Architecture Decisions Index, Claude Code Setup Reference, Phase 1 - Core attendance, Phase 2 - Work-done + efficiency + CSV, Phase 3 - CRUD + CSV filters, Phase 4 - CSR + signature + PDF, FluxGen v2.1.0 â€” Attendance + Asanify release, Second Brain README

### Community 2 - "FluxGen Expense Tracker - Architecture"
Cohesion: 0.29
Nodes (7): FluxGen Expense Tracker - Architecture, YChaithuReddy/expense-tracker, OCR.space, Riverpod 2.6, Sentry, Supabase, Vercel

### Community 3 - "Attendance Feature - 4-Phase Port"
Cohesion: 0.29
Nodes (7): Attendance Feature - 4-Phase Port, EmpID mapping via SharedPreferences, GAS 302 response handling, attendance_pill.dart, attendance_team_tab.dart, attendance_weekly_tab.dart, signature_pad.dart

### Community 4 - "ADR-005: Asanify clock-in prompt"
Cohesion: 0.4
Nodes (5): ADR-005: Asanify clock-in prompt, Asanify has no public API, Once-per-day prompt dedupe pattern, Status-submit prompt trigger, Flutter url_launcher package

### Community 5 - "ADR-001: Reuse Google Apps Script backen..."
Cohesion: 0.67
Nodes (3): ADR-001: Reuse Google Apps Script backend, FluxgenApiService, Google Apps Script

### Community 6 - "ADR-002: Three tabs + gear menu"
Cohesion: 0.67
Nodes (3): ADR-002: Three tabs + gear menu, Admin role detection, AttendanceShell

### Community 7 - "Capacitor"
Cohesion: 1.0
Nodes (2): Capacitor, Flutter

### Community 8 - "csr_form_screen.dart"
Cohesion: 1.0
Nodes (2): csr_form_screen.dart, CsrPdfService

### Community 9 - "manage_employees_screen.dart"
Cohesion: 1.0
Nodes (2): manage_employees_screen.dart, manage_users_screen.dart

### Community 10 - "Asanify"
Cohesion: 1.0
Nodes (2): attendance_update_tab.dart, Asanify

### Community 11 - "emp_id_setup_dialog.dart"
Cohesion: 1.0
Nodes (1): emp_id_setup_dialog.dart

### Community 12 - "Fluxgen"
Cohesion: 1.0
Nodes (1): Fluxgen

## Knowledge Gaps
- **22 isolated node(s):** `Riverpod 2.6`, `Sentry`, `OCR.space`, `Vercel`, `attendance_weekly_tab.dart` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Capacitor`** (2 nodes): `Capacitor`, `Flutter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `csr_form_screen.dart`** (2 nodes): `csr_form_screen.dart`, `CsrPdfService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `manage_employees_screen.dart`** (2 nodes): `manage_employees_screen.dart`, `manage_users_screen.dart`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Asanify`** (2 nodes): `attendance_update_tab.dart`, `Asanify`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `emp_id_setup_dialog.dart`** (1 nodes): `emp_id_setup_dialog.dart`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Fluxgen`** (1 nodes): `Fluxgen`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Attendance Feature - 4-Phase Port` connect `Attendance Feature - 4-Phase Port` to `ADR-004: R8 + shrink resources`, `FluxGen v2.1.0 â€” Attendance + Asanify ...`, `FluxGen Expense Tracker - Architecture`, `ADR-005: Asanify clock-in prompt`, `ADR-001: Reuse Google Apps Script backen...`, `ADR-002: Three tabs + gear menu`, `csr_form_screen.dart`, `manage_employees_screen.dart`, `Asanify`?**
  _High betweenness centrality (0.490) - this node is a cross-community bridge._
- **Why does `FluxGen Expense Tracker - Architecture` connect `FluxGen Expense Tracker - Architecture` to `ADR-004: R8 + shrink resources`, `FluxGen v2.1.0 â€” Attendance + Asanify ...`, `Attendance Feature - 4-Phase Port`, `ADR-005: Asanify clock-in prompt`, `ADR-001: Reuse Google Apps Script backen...`, `Capacitor`, `csr_form_screen.dart`, `Asanify`?**
  _High betweenness centrality (0.337) - this node is a cross-community bridge._
- **Why does `ADR-004: R8 + shrink resources` connect `ADR-004: R8 + shrink resources` to `FluxGen v2.1.0 â€” Attendance + Asanify ...`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `ADR-004: R8 + shrink resources` (e.g. with `R8 code shrinking` and `Android resource shrinking`) actually correct?**
  _`ADR-004: R8 + shrink resources` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Riverpod 2.6`, `Sentry`, `OCR.space` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._