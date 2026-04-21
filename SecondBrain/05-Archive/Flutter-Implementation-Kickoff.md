---
tags: [archive, flutter, kickoff, setup, superseded]
created: 2026-04-21
source: memory/flutter_implementation.md
status: superseded
---

# Flutter Implementation Kickoff (2026-04-04)

Original Flutter project setup. **Archived / superseded** — the kickoff `flutter_expense_tracker/` scaffold has been replaced by the production `fluxgen_emerald/` app documented in [[FluxGen-Architecture]]. Phases 1-4 of [[Attendance-Feature]] and [[02-Projects/FluxGen-v2.1.0]] build on that later codebase, not this one.

## Original milestone (2026-04-04)

### Completed
- Flutter SDK v3.41.6 stable installed (6.5 GB)
- Project `flutter_expense_tracker/` scaffolded with Dart/Flutter layout
- 3 responsive cards built: `HeroCard`, `UPIImportCard`, `TipsCard`
- Material 3 theme matching the Figma fintech palette (teal `#10B981`) — see [[Web-Index-Redesign]]
- `flutter build web --release` → ~2 MB bundle
- Committed to `main`

### Ready-to-deploy state
- Web: `frontend/flutter-web/` — Vercel-ready (just push)
- Mobile: configured for Android, docs included for APK build

### Why Android APK was deferred at kickoff
Android SDK cmdline-tools setup adds 45+ min:
- 142 MB cmdline-tools download
- `sdkmanager` configuration + SDK platform downloads
- `ANDROID_HOME` env var, license acceptance

Plan: user would run `flutter build apk --release` after installing Android Studio.

## Key files (historical)

| File | Purpose |
|---|---|
| `flutter_expense_tracker/lib/main.dart` | Home UI + widgets |
| `flutter_expense_tracker/lib/theme/theme.dart` | Material 3 theme |
| `frontend/flutter-web/` | Web build output |
| `FLUTTER_COMPLETION.md` | Setup guide |

## Planned architecture (mostly unused — `fluxgen_emerald/` reimplemented)

- State: Provider 6.0 (the production app uses **Riverpod** instead — see [[FluxGen-Architecture]])
- Networking: HTTP configured, no endpoints wired
- Storage: SharedPreferences
- Offline: SQLite prepared in pubspec
- Auth: Supabase Flutter SDK planned

Status at archive: 80% of scaffold complete, 0% of features wired — superseded before feature work began.

## See also

- [[FluxGen-Architecture]] — the actual production Flutter app
- [[Attendance-Feature]] — Phase 1-4 of the attendance port (built in `fluxgen_emerald/`)
- [[Web-Index-Redesign]] — the design that informed the Flutter theme
