---
tags: [debugging, bugs, log, fluxgen]
created: 2026-04-21
source: memory/debugging-log.md
---

# Debugging Log

Chronological record of bugs fixed. Your "didn't we fix this before?" reference. Anti-pattern codes link to [[Anti-Patterns]].

## Format

```
### [Date] - [Title]
- Symptom / Root Cause / Fix / Pattern / Anti-Pattern
```

## Log

### Pre-2025 — Service Worker cached API responses
- **Symptom**: Data changes not appearing after add/edit
- **Root Cause**: `sw.js` only skipped `/api/` and `railway.app`; Supabase uses `supabase.co`
- **Fix**: Added `supabase.co` to skip list, bumped `CACHE_VERSION` to v14
- **Pattern**: SW caches everything by default — explicitly skip API domains
- **Anti-pattern**: AP-15

### Pre-2025 — `addExpense` fire-and-forget
- **Symptom**: Expense list didn't update after add
- **Root Cause**: `handleSubmit` not async; `addExpense()` never awaited
- **Fix**: Made `handleSubmit` async, added `await` to all calls
- **Anti-pattern**: AP-5

### Pre-2025 — Concurrent `loadExpenses()` calls
- **Symptom**: UI flicker, duplicate renders
- **Root Cause**: No guard against overlapping calls
- **Fix**: Added `_loadingExpenses` flag with `try/finally`
- **Anti-pattern**: AP-6

### Pre-2025 — `styles_images.css` missing from build
- **Symptom**: Image modal unstyled in APK
- **Root Cause**: File missing from `build.js` + `sw.js`
- **Fix**: Added to both
- **Anti-pattern**: AP-10

### Pre-2025 — `capacitor.config.ts` `server.url` removed
- **Symptom**: OAuth redirect broke in APK
- **Root Cause**: Commenting out `server.url` made APK load locally
- **Fix**: Restored pointing to Vercel URL
- **Anti-pattern**: AP-11

### Pre-2025 — Image Viewer Modal stuck on APK
- **Symptom**: Modal visible on load, can't dismiss
- **Root Cause**: CSS `display: none` overridden or loaded too late
- **Fix**: Added inline `style="display: none;"` on the element
- **Pattern**: For APK-critical visibility, inline styles are the fallback

### Pre-2025 — Modal scroll broken by `!important`
- **Symptom**: Modal squeezed, couldn't scroll
- **Root Cause**: `styles_dropdown.css` had `!important` on max-height, beating `styles.css` flex
- **Fix**: Removed `!important`, used proper specificity
- **Anti-pattern**: AP-1, AP-2

### Pre-2025 — Supabase RPC snake_case
- **Symptom**: Size stats showed `undefined`
- **Root Cause**: RPC returned `total_size_mb`; frontend expected `totalSizeMB`
- **Fix**: Added transform in `supabase-api.js`
- **Anti-pattern**: AP-7

### 2026-02-20 — Clear Data cards completely unstyled
- **Symptom**: Raw HTML appearance, no styling
- **Root Cause**: HTML used old class names (`clear-card`), active CSS used BEM (`clear-data-card`). Dead file `styles_clear_data_old.css` had old names but wasn't linked.
- **Fix**: Renamed all HTML classes to BEM, deleted the dead file, updated JS selectors
- **Anti-pattern**: AP-17

### 2026-02-20 — Confirm Modal delete-button SVG rendered at 196px
- **Symptom**: Enormous trash icon overlapping text; button wrapped to two lines
- **Root Cause**: SVG had no explicit `width`/`height`, browser used intrinsic 196px
- **Fix**: `.clear-data-confirm-btn-delete svg { width: 18px; height: 18px; flex-shrink: 0; }` + `white-space: nowrap` on button
- **Anti-pattern**: AP-18

### 2026-02-20 — Clear Data modal trapped inside action-buttons container
- **Symptom**: Modal opened inline within right column, not as full-screen overlay
- **Root Cause**: Modal HTML nested inside `.action-buttons` (`position: relative`), preventing `position: fixed` from being viewport-relative
- **Fix**: Moved both Stage 1 + Stage 2 modal divs to root DOM level (after `</main>`)
- **Anti-pattern**: AP-19

## See also

- [[Anti-Patterns]]
- [[Regression-Checklist]]
- [[File-Map]]
