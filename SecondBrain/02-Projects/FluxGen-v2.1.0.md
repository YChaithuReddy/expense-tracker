---
tags: [project, fluxgen, release]
status: shipped
shipped: 2026-04-21
---

# FluxGen v2.1.0 — Attendance + Asanify release

## Goal

Port the entire Fluxgen Employee Status website into the Flutter APK with full feature parity, integrate Asanify clock-in, and ship as in-app update.

## Status: SHIPPED

- **GitHub release:** [v2.1.0-flutter](https://github.com/YChaithuReddy/expense-tracker/releases/tag/v2.1.0-flutter)
- **APK:** `app-release.apk` (50 MB, debug-signed, R8-optimized)
- **Supabase `app_config`:** updated to advertise v2.1.0 build 24
- **Desktop copy:** `C:/Users/chath/OneDrive/Desktop/FluxGen-v2.1.0.apk`

## PRs merged (7 total)

1. [#1 Phase 1](https://github.com/YChaithuReddy/expense-tracker/pull/1) — Core attendance
2. [#2 Phase 1 fixes + redesign](https://github.com/YChaithuReddy/expense-tracker/pull/2) — 302 fix, overflows, UI polish
3. [#3 Phase 2](https://github.com/YChaithuReddy/expense-tracker/pull/3) — Work-done + efficiency + CSV
4. [#4 Phase 3](https://github.com/YChaithuReddy/expense-tracker/pull/4) — CRUD + CSV filter pickers
5. [#5 Phase 4](https://github.com/YChaithuReddy/expense-tracker/pull/5) — CSR + signature + PDF
6. [#6 Cleanup](https://github.com/YChaithuReddy/expense-tracker/pull/6) — 22 analyzer warnings fixed
7. [#7 Asanify](https://github.com/YChaithuReddy/expense-tracker/pull/7) — Auto clock-in prompt

## What's left (future phases)

- Migrate attendance data to Supabase (when website is ready)
- Proper Play Store release (requires signing key migration — see [[../20-Decisions/003-Debug-Signing-For-Updates]])
- Asanify API integration (needs API key from Asanify support)
- Morning clock-in reminder notifications (9 AM weekday push)

## See also
- [[../10-Code-Context/Attendance-Feature]]
- [[../10-Code-Context/FluxGen-Release-Workflow]]
- [[../20-Decisions/000-index]]
