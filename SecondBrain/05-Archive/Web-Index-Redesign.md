---
tags: [archive, redesign, web, fintech, css, completed]
created: 2026-04-21
source: memory/redesign_index_page.md
status: completed
---

# Web Index Page Redesign — Modern Fintech Theme

Completed redesign of the legacy web `index.html` with a teal-accented fintech aesthetic. Archived because the initiative is shipped; ongoing work moved to the Flutter app ([[FluxGen-Architecture]]).

## What was done

### Phase 1 — Figma design
- File: `Expense Tracker - Index Page Redesign` (key `ZgzVsOnmZ7DKZPeI1Z53ap`)
- Two layouts:
  - **Desktop (1440px)** — Hero with Camera/Gallery buttons, OR divider, Manual entry, UPI Import card, Tips card
  - **Mobile (375px)** — Stacked, touch-optimized

### Design system
- **Colors**: bg `#F8F9FA`, cards `#FFFFFF`, accent `#10B981` (teal), text `#1F2937` / `#6B7280`, border `#E5E7EB`
- **Typography**: Inter
- **Spacing**: 16 / 24 / 32 / 40 px
- **Radius**: 8–16 px
- **Shadows**: subtle, layered

### Phase 2 — CSS updates
File: `frontend/styles.css`. Applied to `[data-theme="light"]` only:
- Teal palette (`#10B981` primary)
- `.btn-secondary` → teal with white text (Camera, Gallery)
- Background `#FAFAFA` → `#F8F9FA`
- 16px rounded corners, subtle borders, light shadows
- Input focus → teal ring (not black)
- Header h1 → teal

Commit: `a4c3ef7` — "Update light theme to modern fintech design with teal accents and improved spacing"

## Design references

Pulled from 8 modern fintech/dashboard templates:
- Clean white cards on light backgrounds
- Sidebar navigation (not yet implemented)
- Card layouts with clear hierarchy
- Teal/green accents
- Simple modern typography
- Transaction lists with icons
- Hero sections for key actions

## Status at archive

- Figma design complete (desktop + mobile)
- CSS shipped to light theme, dark theme preserved
- Committed, Vercel auto-deployed
- Visual + responsive verification was pending at time of archive

## Why it's archived

The web surface is in maintenance mode — active product work shifted to the Flutter app (`fluxgen_emerald/`). See [[FluxGen-Architecture]] and [[02-Projects/FluxGen-v2.1.0]].

## See also

- [[Flutter-Implementation-Kickoff]] — design moved into the Flutter port
- [[User-Preferences]] — UI style preferences informing the aesthetic
