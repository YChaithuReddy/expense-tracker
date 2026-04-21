---
tags: [anti-patterns, debugging, css, javascript, build, fluxgen]
created: 2026-04-21
source: memory/anti-patterns.md
---

# Anti-Pattern Library

Known bad patterns in the FluxGen codebase. **Check here BEFORE proposing any fix.** Cross-reference with [[Debugging-Log]] and [[File-Map]].

## CSS

### AP-1: `!important` to fix styles
Creates specificity wars. `styles_dropdown.css` already has `!important` that will collide. Use higher-specificity selectors or restructure the cascade instead.

### AP-2: Debugging CSS without checking all classes
Elements carry dual classes (e.g. `img-modal orphaned-images-modal`) with rules in **different** CSS files. Enumerate every class, search all CSS files, check computed styles.

### AP-3: Nested scroll containers
A scrollable modal inside a scrollable page = trapped scroll events, broken mobile touch. One scroll container per visual region. The modal body scrolls, not the overlay.

### AP-4: Fixed pixel values for responsive elements
`width: 400px; height: 600px;` breaks across screens. Use %, vh/vw, min/max, or `clamp()`.

### AP-17: Refactoring CSS names without updating HTML/JS
Renaming to BEM (`clear-card` → `clear-data-card`) without updating HTML selectors leaves elements unstyled. Rename CSS + HTML + JS simultaneously. Delete dead CSS files immediately.

### AP-18: SVG inside buttons without explicit size
SVGs render at intrinsic size (often 196px). Always add `.btn svg { width: 18px; height: 18px; flex-shrink: 0; }`.

### AP-19: Fixed-overlay modal nested in layout container
`position: fixed` inside `.action-buttons` renders inside the container, not fullscreen. Place overlay modals at root DOM level (direct child of `<body>` or `.container`).

## JavaScript

### AP-5: Fire-and-forget async
`handleSubmit() { addExpense(data); loadExpenses(); }` races. Use `async/await` throughout.

### AP-6: No concurrency guard on data loading
Duplicate `loadExpenses()` calls cause flicker and wasted bandwidth. Use a `_loadingExpenses` flag with `try/finally`.

### AP-7: Forgetting snake-to-camel transform
Postgres returns `total_size_mb`, frontend expects `totalSizeMB`. **Always transform in `supabase-api.js`** before returning to `script.js`.

### AP-8: `console.log` in production code
Pre-commit hook blocks it. Remove before commit.

## Build

### AP-9: Editing frontend without build sync
APK ships stale code. Always `node build.js && npx cap sync android`. See [[FluxGen-Release-Workflow]].

### AP-10: New file not added to build pipeline
A new CSS/JS file must go in **both** `build.js` `filesToCopy` **and** `sw.js` static asset list, else it's missing from APK + PWA.

### AP-11: Commenting out `server.url` in `capacitor.config.ts`
Breaks OAuth redirect in APK. Keep it pointing to Vercel production URL.

## Architecture

### AP-12: Page reload as a fix
`window.location.reload()` masks the real bug and loses state. Find why data is stale.

### AP-13: Duplicating logic between files
Same formatting in `script.js` and `supabase-api.js` drifts. Single source of truth.

### AP-14: Mixing modal and page layout paradigms
Scroll, z-index, and focus break. Commit upfront: modal (overlay) or page (route).

## Service Worker

### AP-15: Caching API responses
SW must skip `supabase.co`, `railway.app`, any API domain. Users see stale data otherwise.

### AP-16: Not incrementing SW version
Bump `CACHE_VERSION` in `sw.js` after any asset change. See [[FluxGen-Release-Workflow]].

## See also

- [[Debugging-Log]] — real bugs caused by these anti-patterns
- [[Regression-Checklist]] — post-change verification
- [[Workflow]] — 7-step process that prevents these
