---
tags: [preferences, user-profile, working-style, ui, fluxgen]
created: 2026-04-21
source: memory/feedback_*.md
---

# User Preferences — Working with Chaitanya

Synthesized "user profile" for any AI or collaborator working with Chaitanya on FluxGen. Source: 7 feedback memory files.

## How to work with me

### Ask before editing — always
Before **every** code change:
1. Restate what you understood
2. Ask if the understanding is correct
3. Call out any ambiguity explicitly
4. Only code after explicit "yes"

Applies to **everything** — CSS, JS, HTML, config. No exceptions for "obvious" fixes.

**Why**: Past assumption-driven edits (white vs blue buttons, falling vs floating droplets) wasted time in reverts.

### Confirm scope for vague prompts
If the prompt names specific elements ("the Camera and Gallery buttons in the scan card") → do it. If vague ("change buttons") → list exactly what will change **and what won't**, then ask "correct?". A 10-second confirmation saves 30 minutes of wrong edits.

- Screenshots with arrows/circles = gold; trust them over text
- "All X" → find every instance first, list, confirm

### Pre-edit checklist (UI/CSS)
1. Read the target HTML
2. Grep CSS for conflicts on classes already on the element
3. Check CSS loading — Grep for `<link rel="stylesheet"` in the target HTML (login.html / signup.html use inline `<style>` only, no `styles.css`)
4. List changes + confirm if scope is ambiguous
5. Add conflict overrides if element keeps legacy classes for JS selectors
6. Screenshot with Playwright **before** committing, not after

### Verify before commit
- Check which CSS files a page loads before adding rules
- Spans in flex containers need `display: block` for `overflow: hidden` / `clip-path` / `height` to work
- SVGs need explicit `width`/`height` attributes **and** CSS constraints
- Screenshot with Playwright before the first commit — don't push and then check

## What NOT to do

- Don't say "install from desktop" — we use in-app updates. Every APK build must end with: build → copy to desktop → upload to GitHub → **bump Supabase `app_config` version + build_number**. The Supabase version must be HIGHER than the APK code's version so the prompt fires. APK filename on GitHub must exactly match `apk_url` in Supabase — verify with `gh release view`. See [[FluxGen-Release-Workflow]].
- Don't tag features as "future enhancement" on a parity port. When porting platforms (web → APK), port 100% up-front. If a feature is genuinely infeasible, surface it and ask before deferring. MVP-first applies only to **new** features.
- Don't skip the pre-edit checklist — every btn-flux session bug came from skipping a step.

## UI style preferences

"Linear-meets-Notion" / premium feel, not literal web port or utilitarian Material defaults.

- **SegmentedButton** (M3) over `Switch` / `ToggleButtons` for 2-3 choices
- **Tap-cards with icons** over dropdowns for status/category pickers
- **Stat cards + filterable list** over tables
- **Haptic feedback** on selection changes — `HapticFeedback.lightImpact()`
- **BackdropFilter** for floating overlays (glassmorphic pills)
- **AnimatedSwitcher** for conditional-field reveals
- Respect light + dark theme — `Theme.of(context).colorScheme` for surfaces; hardcode only status brand colors

**Don't over-apply** — premium treatment is for hero screens, not every dialog.

## Delivery style

### Phased over big-bang
For tasks with 4+ distinct features:
- Propose phased delivery as the **default** option
- Phase 1 = core 80% use case, shippable alone
- Each phase = its own PR / commit series
- Confirm Phase N shipped before starting N+1
- Keep a phase-outline section at the top of any design spec

Exception: if user says "everything at once" or "just do it all now" — honor that.

### Parity ports = not phased
A port (web → APK) is not a new feature; port everything in the first pass. See [[20-Decisions/000-index]] for related decisions.

## See also

- [[Workflow]] — the 7-step process
- [[Regression-Checklist]]
- [[FluxGen-Release-Workflow]]
- [[20-Decisions/006-Mandatory-7-Step-Workflow]]
