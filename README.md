# FluxGen Expense Tracker

A full-stack expense tracking web app and Android APK for Indian teams — scan bills with OCR, track UPI payments, manage multi-level approvals, and export to Tally, Google Sheets, Excel & PDF.

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20android-brightgreen.svg)

**Live**: https://expense-tracker-delta-ashy.vercel.app

---

## Features

### Core
- **Bill Scanning**: Tesseract.js OCR — Indian receipts, GST extraction (CGST, SGST, IGST), 20+ vendor patterns
- **Expense Management**: Add, edit, delete, filter, search expenses
- **UPI Launcher**: Open Google Pay, PhonePe, or Paytm directly from the app
- **Multi-Level Approvals**: Employee → Manager → Accountant workflow
- **Export**: Tally, Google Sheets, Excel (with formulas), PDF reports
- **Admin Dashboard**: User management, team-wide expense oversight
- **Accountant Panel**: Approval queue, reimbursement tracking

### Platform
- **PWA**: Installable, offline-capable via Service Worker
- **Android APK**: Native app via Capacitor — available at GitHub Releases
- **Responsive**: Mobile, tablet, desktop

### Auth
- Google OAuth (one-click login)
- Email + Password
- Supabase Auth with session persistence

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript + CSS (no framework) |
| Mobile | Capacitor (Android APK) |
| Auth | Supabase Auth (Google OAuth + Email) |
| Database | Supabase (PostgreSQL) |
| OCR | Tesseract.js (client-side, no server needed) |
| Image Storage | Cloudinary |
| Deployment | Vercel (web auto-deploy on push to main) |

---

## Architecture

```
expense-tracker/
├── frontend/
│   ├── index.html              # Main app (home + expense list)
│   ├── login.html              # Auth — sign in
│   ├── signup.html             # Auth — create account
│   ├── admin.html              # Admin dashboard
│   ├── accountant.html         # Accountant approval panel
│   ├── dashboard.html          # Analytics dashboard
│   ├── script.js               # Core app logic (ExpenseTracker class, ~5000 lines)
│   ├── supabase-api.js         # All Supabase CRUD (api object)
│   ├── supabase-auth.js        # Auth state management
│   ├── supabase-client.js      # Supabase client init (public anon key)
│   ├── upi-import.js           # UPI app launcher (Google Pay, PhonePe, Paytm)
│   ├── google-sheets-service.js # Google Sheets export
│   ├── deep-link-handler.js    # OAuth deep link (expensetracker://auth)
│   ├── sw.js                   # PWA service worker
│   ├── build.js                # Capacitor build script
│   └── android/                # Capacitor Android project
├── backend/
│   └── server.js               # Express (local dev reference only)
├── SecondBrain/                # Knowledge graph + architecture decisions (ADRs)
└── .claude/
    ├── agents/                 # Command Center crew (Marketing, Design, Dev, Debug)
    └── skills/                 # 12 specialized skills
```

---

## Quick Start

### Web (auto-deploys via Vercel)
```bash
git push origin main
```

### Local Development
```bash
# Frontend — serve from frontend/
cd frontend && npx http-server -p 3000

# No local backend needed — all data via Supabase
```

### Android APK Build
```bash
cd frontend
node build.js            # Copy files to www/
npx cap sync android     # Sync to Android project
# Then: Android Studio → Build → Generate Signed APK
```

---

## Download APK

**Latest release**: https://github.com/YChaithuReddy/expense-tracker/releases/latest/download/expense-tracker.apk

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `frontend/script.js` | `ExpenseTracker` class — all UI logic, expense CRUD, OCR flow |
| `frontend/supabase-api.js` | `api` object — all database operations |
| `frontend/supabase-auth.js` | Session management, auth state |
| `frontend/upi-import.js` | UPI app launcher via Android JS bridge |
| `frontend/sw.js` | PWA service worker — cache versioning |
| `frontend/build.js` | Copies frontend files to `www/` for Capacitor |

---

## Environment

### Frontend
Configured in `frontend/supabase-client.js` using the Supabase public anon key (safe to expose).

### Backend (local dev only — `.env`)
```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Important Patterns

### Mobile Build Workflow
Always run after frontend changes:
```bash
cd frontend && node build.js && npx cap sync android
```
Then rebuild in Android Studio (Build → Clean Project → Rebuild).

### OAuth Flow (Mobile)
- Custom URL scheme: `expensetracker://auth`
- Must be added to Supabase Dashboard → Auth → URL Configuration
- Handled by `frontend/deep-link-handler.js`

### Service Worker Cache
Bump the version in `sw.js` after every CSS/JS/HTML change:
```javascript
const CACHE_NAME = 'expense-tracker-v[N+1]';
```
Never add `supabase.co` URLs to the cache (they must always hit the network).

### Expense Add Flow
`handleSubmit` → `addExpense` / `processImages` → `loadExpenses` → `displayExpenses`

All async. Always `await`. Guard concurrent `loadExpenses` calls with `_loadingExpenses` flag.

---

## Command Center (AI Dev Team)

The project includes an AI crew in `.claude/agents/` — specialized agents for different roles:

| Agent | Role | Key Skills |
|-------|------|-----------|
| `marketing-agent` | Copy, SEO, launches | copy-writer, seo-optimizer, launch-announcer |
| `design-review-agent` | Visual QA | layout-fixer, mobile-debug |
| `premium-ui-designer` | UI polish | ui-redesigner, component-generator |
| `debugging-specialist` | Root cause analysis | codebase-decision-trees, investigate |
| `dev-engineering` | Build & ship | mobile-build, performance-optimizer, supabase |

Skills live in `.claude/skills/` — invoke with `/skill-name` in Claude Code.

---

## Common Issues

### "Mobile App Required" popup
- The Android JS bridge isn't connecting
- Check `MainActivity.java` has the `AppLauncher` interface
- Run `node build.js && npx cap sync android` and rebuild in Android Studio

### Google OAuth not returning to app
- Check `expensetracker://auth` is listed in Supabase → Auth → URL Configuration → Redirect URLs
- Verify `AndroidManifest.xml` has the intent filter for the custom scheme

### UI looks stale after deployment
- Service worker is caching old assets
- Bump the `CACHE_NAME` version in `sw.js` and redeploy

### Expenses not loading
- Check `_loadingExpenses` flag — concurrent calls are guarded
- Verify `supabase.co` URLs are excluded from the SW cache

---

## Deployment

Vercel auto-deploys from `main` branch. No build command needed — it serves static files from `frontend/`.

**Deployment settings** (Vercel):
- Root Directory: `frontend`
- Build Command: *(empty)*
- Output Directory: `.`

---

## License

MIT © 2026 FluxGen Technologies Pvt Ltd

---

**Built by Y Chaithu Reddy — FluxGen Technologies**

---

## Command Center Crew

The Expense Tracker is managed by an AI crew through the Command Center. Each crew member is a specialized Claude agent with a defined role, personality, and skill set.

---

### Dev (Engineering)

**Agent**: `.claude/agents/dev-engineering.md`
**Soul**: `soul-dev.md`
**Color**: Green

Ships features, debugs root causes, reviews code, optimizes performance, builds the Android APK. Follows the 7-step workflow on every task. Never guesses.

**Skill Arsenal**:

| Category | Skills |
|----------|--------|
| Debugging | `/investigate`, `/codebase-decision-trees`, `debug-issue.md`, `debugging-specialist` agent |
| Code Quality | `/review`, `/health`, `review-changes.md`, `refactor-safely.md` |
| Features | `/feature-dev:feature-dev`, `feature-upgrader`, `component-generator`, `/senior-frontend` |
| Performance | `performance-optimizer`, `/performance`, `/benchmark` |
| Mobile/APK | `mobile-build`, `mobile-debug`, `mobile-fix` |
| OCR & Reports | `indian-receipt-ocr`, `report-generator` |
| Database | `/supabase:supabase`, `/supabase:supabase-postgres-best-practices` |
| Security | `/cso` |
| Deploy | `/ship`, `/land-and-deploy`, `/deploy-verify`, `/cache-bump` |
| Planning | `/superpowers:brainstorming`, `/superpowers:writing-plans` |

---

### Design Review

**Agent**: `.claude/agents/design-review-agent.md`
**Color**: Pink

Conducts world-class UI/UX reviews: all viewports (375/768/1440px), WCAG 2.1 AA accessibility, interactive state testing, triage-categorized reports (Blocker / High / Medium / Nitpick).

**Skills**: Playwright MCP, `/layout-fixer`, `/qa`, `/qa-only`, `/design-review`, `/web-design-guidelines`

---

### Premium UI Designer

**Agent**: `.claude/agents/premium-ui-designer.md`
**Color**: Blue

Masters premium visual design: glassmorphism, animations, micro-interactions, typography systems, design tokens. Transforms ordinary interfaces into high-end experiences.

**Skills**: `ui-redesigner`, `/frontend-design`, `/design-shotgun`, `/design-consultation`

---

### Marketing

**Agent**: marketing crew member
**Soul**: `soul.md`

Owns all content, copy, launch, and go-to-market work. Headlines, SEO, Play Store listings, release notes, brand voice across all surfaces.

---

### Skill to Agent Ownership

| Skill | Primary Owner |
|-------|--------------|
| `debug-issue.md` | Dev (Engineering) |
| `explore-codebase.md` | Dev (Engineering) |
| `refactor-safely.md` | Dev (Engineering) |
| `review-changes.md` | Dev (Engineering) |
| `feature-upgrader/` | Dev (Engineering) |
| `component-generator/` | Dev (Engineering) |
| `performance-optimizer/` | Dev (Engineering) |
| `mobile-build/` | Dev (Engineering) |
| `mobile-debug/` | Dev (Engineering) |
| `mobile-fix/` | Dev (Engineering) |
| `indian-receipt-ocr/` | Dev (Engineering) |
| `report-generator/` | Dev (Engineering) |
| `ui-redesigner/` | Premium UI Designer |
| `layout-fixer/` | Design Review |

For the full skill reference, see `.claude/skills/README.md`.

---

### How to Work with the Crew

- **Tag a specific agent** when you know who should handle it: Dev for engineering, Design Review for UI audits, Premium UI Designer for visual work, Marketing for copy.
- **@all** broadcasts to the full crew.
- **Soul documents** describe each crew member's identity, working style, and non-negotiables. Read them before assigning work.
