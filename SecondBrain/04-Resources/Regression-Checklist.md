---
tags: [checklist, regression, verification, fluxgen]
created: 2026-04-21
source: memory/regression-checklist.md
---

# Regression Checklist

Run after **every** code change, ordered by risk. Pair with [[Anti-Patterns]] and [[Debugging-Log]]. If any item fails, **do not commit**.

## Critical (always check)

- [ ] App loads without console errors
- [ ] Auth works — login/logout, session persists across refresh
- [ ] Expenses load — list populates, correct data
- [ ] Add expense works — form submits, appears in list
- [ ] Edit expense works — changes save, list updates
- [ ] Delete expense works — removed from list

## CSS changes

- [ ] Check all 3 CSS files — `styles.css`, `styles_images.css`, `styles_dropdown.css` (see [[File-Map]])
- [ ] No new `!important` (pre-commit gate enforces)
- [ ] Mobile responsive — test 375px, 768px, 1440px
- [ ] Modals scroll correctly — body scrolls, not overlay
- [ ] No nested scroll containers
- [ ] Dropdowns open/close/select correctly

## JavaScript changes

- [ ] No `console.log` left (pre-commit gate)
- [ ] All async calls awaited — no fire-and-forget
- [ ] No concurrent data loading — guard flags present
- [ ] snake_case → camelCase transforms in `supabase-api.js`
- [ ] Error handling with user feedback
- [ ] Loading states shown during async ops

## Build & deploy

- [ ] `build.js` `filesToCopy` includes all files
- [ ] `sw.js` static asset list includes all files
- [ ] `sw.js` `CACHE_VERSION` incremented if assets changed
- [ ] `sw.js` skips API domains (`supabase.co`)
- [ ] `node build.js && npx cap sync android` run after frontend changes
- [ ] `capacitor.config.ts` `server.url` still points to Vercel

## Supabase / API

- [ ] RLS policies intact
- [ ] API response shape unchanged — frontend callers not broken
- [ ] Migration tested — DDL applied + verified
- [ ] Auth — Google OAuth + email login both work

## Mobile / APK

- [ ] OAuth redirect works — `expensetracker://auth` in Supabase redirect URLs
- [ ] `AndroidManifest.xml` has deep-link intent filter
- [ ] `MainActivity.java` has `AppLauncher` bridge
- [ ] APK loads from remote URL (`server.url` not commented out)

## Images / Media

- [ ] Image upload (camera + gallery) works
- [ ] Image viewer opens/closes cleanly — modal not stuck
- [ ] Orphaned images cleanup still works
- [ ] Image modal has inline `style="display: none;"` (prevents flash)

## Google Sheets

- [ ] Export creates/updates sheet correctly
- [ ] No duplicate sheets (race-condition guard present)
- [ ] Formatting correct — columns, headers, data types

---

If any item fails, fix the regression first, then add an entry to [[Debugging-Log]].

## See also

- [[Workflow]] — the 7-step process
- [[Anti-Patterns]]
- [[FluxGen-Release-Workflow]]
