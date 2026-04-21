---
tags: [fluxgen, architecture, stack]
created: 2026-04-21
updated: 2026-04-21
---

# FluxGen Expense Tracker — Architecture

## Top-level map

FluxGen is a **corporate expense + attendance tracker** with two surfaces:

| Surface | Tech | Purpose |
|---|---|---|
| **Web app** | Vanilla JS + Supabase | Primary interface, deployed on Vercel |
| **Flutter APK** | `fluxgen_emerald/` | Mobile app, Android-first, same Supabase backend |
| **Capacitor APK (legacy)** | `frontend/` wrapped | Older approach, being phased out |

Repo: [YChaithuReddy/expense-tracker](https://github.com/YChaithuReddy/expense-tracker)

## Flutter app layers

```
fluxgen_emerald/
├── lib/
│   ├── main.dart            ← app entry
│   ├── app.dart             ← MaterialApp + AuthGate + RoleRouter
│   ├── core/
│   │   ├── constants/       ← AppConstants (Supabase URL, keys), FluxgenApi
│   │   ├── theme/           ← AppColors (teal #006699), AppTheme
│   │   └── utils/           ← date/currency formatters, validators
│   ├── models/              ← UserProfile, Expense, Voucher, Advance, StatusEntry
│   ├── services/            ← AuthService, ExpenseService, FluxgenApiService, CsrPdfService
│   ├── providers/           ← Riverpod: authProvider, fluxgenProvider
│   ├── screens/
│   │   ├── auth/            ← LoginScreen
│   │   ├── employee/        ← bottom-nav tabs (Home/Advance/Camera/History/Profile)
│   │   ├── admin/           ← bottom-nav tabs (Overview/Approvals/Vouchers/Payments/More)
│   │   ├── shared/          ← notifications, activity log
│   │   └── attendance/      ← Fluxgen attendance port (Phases 1-4)
│   └── widgets/             ← NotificationBell, AttendancePill
```

## Key integrations

- **Supabase** — auth + database + realtime. Project URL: `https://ynpquqlxafdvoealmfye.supabase.co`
- **Google Apps Script** — Fluxgen attendance backend (website + app share same sheet). URL baked in `FluxgenApi.scriptUrl`
- **Sentry** — crash reporting
- **OCR.space** — receipt scanning (web only)
- **Asanify** — external clock-in/out system. App prompts user to open Asanify after attendance submit (no official API available)

## State management

- Riverpod 2.6 throughout
- Auth state: `userProfileProvider` (FutureProvider) → re-fetched on Attendance open to catch role changes
- Attendance state: `todayStatusProvider`, `weekStatusProvider`, `employeesProvider`, `myEmpIdProvider`

## See also

- [[Attendance-Feature]] — the attendance port spec
- [[FluxGen-Release-Workflow]] — how updates are shipped
- [[20-Decisions/001-Reuse-GAS-backend]] — why we kept Google Apps Script vs Supabase for attendance
