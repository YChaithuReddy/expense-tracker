---
tags: [architecture, dependencies, blast-radius, fluxgen]
created: 2026-04-21
source: memory/file-map.md
---

# File Dependency Map (legacy web / Capacitor frontend)

Blast radius for every file in the **`frontend/`** (vanilla JS) tree. For the Flutter app layout see [[FluxGen-Architecture]]. Before editing, check what depends on the file.

## Core Frontend JS

### `frontend/script.js` — `ExpenseTracker` class
- **Depends on**: `supabase-api.js`, `supabase-auth.js`, `google-sheets-service.js`, `upi-import.js`
- **Depended by**: `index.html`
- **Blast radius**: HIGH — ~5000+ lines, affects the entire app
- **Watch**: search before adding duplicate methods

### `frontend/supabase-api.js` — API layer
- **Depends on**: `supabase-client.js`
- **Depended by**: `script.js`, `supabase-auth.js`
- **Blast radius**: HIGH — all data flows through here
- **Watch**: snake_case → camelCase transforms happen here (see [[Anti-Patterns]] AP-7)

### `frontend/supabase-auth.js` — auth state
- **Depends on**: `supabase-client.js`, `supabase-api.js`
- **Depended by**: `script.js`, `login.html`, `signup.html`
- **Blast radius**: MEDIUM — all auth flows

### `frontend/supabase-client.js` — Supabase init
- **Depends on**: nothing
- **Depended by**: `supabase-api.js`, `supabase-auth.js`
- **Blast radius**: CRITICAL — changing this breaks everything

### `frontend/google-sheets-service.js`
- **Depends on**: `supabase-api.js`
- **Depended by**: `script.js`
- **Blast radius**: LOW — Sheets export only
- **Watch**: init race condition (locking in place)

### `frontend/upi-import.js`
- **Depends on**: Android `AppLauncher` JS bridge
- **Depended by**: `script.js`
- **Blast radius**: LOW — APK-only UPI flows

### `frontend/deep-link-handler.js`
- **Depends on**: `supabase-auth.js`
- **Blast radius**: MEDIUM — OAuth redirect (`expensetracker://auth`)

## CSS

| File | Purpose | Blast radius | Conflicts with |
|---|---|---|---|
| `styles.css` | Main styles, all pages | HIGH | `styles_images.css`, `styles_dropdown.css` |
| `styles_images.css` | Image modals, orphans | MEDIUM | `styles.css` (modal selectors) |
| `styles_dropdown.css` | Dropdowns, overlays | MEDIUM | `styles.css` (`!important` overrides) |
| `styles_clear_data.css` | Clear Data modal (BEM) | LOW | — |
| `styles_saved_images.css` | Saved Bill Images | LOW | — |

## HTML

| File | Depends on | Blast radius |
|---|---|---|
| `index.html` | All JS + all CSS | CRITICAL |
| `login.html` | `supabase-client.js`, `supabase-auth.js`, **inline styles only** | LOW |
| `signup.html` | same as login | LOW |

**Gotcha**: `login.html` / `signup.html` do **not** load `styles.css`. See [[User-Preferences]] pre-edit checklist.

## Build & Config

| File | Watch |
|---|---|
| `build.js` | Any new frontend file must be added to `filesToCopy` |
| `sw.js` | Must skip API domains; bump `CACHE_VERSION` on asset changes |
| `capacitor.config.ts` | `server.url` must stay pointing at Vercel |

## Backend

| File | Blast radius |
|---|---|
| `backend/server.js` | HIGH — entry point |
| `backend/routes/expenses.js` | MEDIUM — CRUD API |
| `backend/services/ocr.js` | LOW — OCR only |

## Android

`frontend/android/.../MainActivity.java` — HIGH. Contains `AppLauncher` bridge for UPI. Requires Clean + Rebuild for Java changes.

## Change Impact Matrix

| If you change... | Also check... |
|---|---|
| `supabase-api.js` | `script.js` callers, `supabase-auth.js` |
| Any CSS file | All 5 CSS files for conflicts |
| `script.js` | `index.html` template IDs, API shape |
| `build.js` | `sw.js` cache list must match |
| `sw.js` | Bump `CACHE_VERSION` |
| `capacitor.config.ts` | OAuth flow, APK behavior |
| Any frontend file | Run `build.js` + `cap sync` |
| `supabase-client.js` | **Everything** — critical dep |

## See also

- [[Anti-Patterns]]
- [[FluxGen-Architecture]] — Flutter layout
- [[FluxGen-Release-Workflow]]
