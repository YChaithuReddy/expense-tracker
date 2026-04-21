---
tags: [project, pending, todo, bugs, fluxgen]
created: 2026-04-21
source: memory/pending-fixes.md
status: open
---

# Pending Fixes (reported 2026-04-03)

Active TODO list of issues reported by user, not yet addressed at time of this note. Cross-check status before starting work — some may have shipped in recent commits.

## Issues

### 1. Approval modal design parity
User likes the white/black **Submit for Approval** design. Make the **Request New Advance** modal match that white/black design (not the other way around). Also **revert** the light-theme override removal on the approval modal.

### 2. Submit-for-Approval button inside reimbursement modal
Already added — needs verification. Also:
- Hide the Kodo button
- Allow uploading **external files** for approval

### 3. Website lag
Too many CSS files + heavy animations + resource loading causing slow page load. See [[File-Map]] for the 5-CSS-file layout (`styles.css`, `styles_images.css`, `styles_dropdown.css`, `styles_clear_data.css`, `styles_saved_images.css`).

### 4. Advances API error
```
Could not find relationship between 'advances' and 'user_id'
```
The `advances` table uses `user_id` (not a submitter join). The query attempts `submitter:user_id(...)` but the FK relationship name is likely wrong. Verify the Supabase schema + PostgREST resource embedding syntax.

### 5. Email notifications not working
Check:
- `send-notification-email` Edge Function deployed?
- `BREVO_API_KEY` env var set?

### 6. Activity log not recording all events
Verify every action is being logged — audit the event-emission sites.

## Working notes

- Issues 1-3 are UI / performance; follow [[User-Preferences]] pre-edit checklist
- Issue 4 is a Supabase / PostgREST issue — use `supabase:supabase` skill or `/api-debugger`
- Issues 5-6 are backend / observability — check Edge Function logs first

## See also

- [[FluxGen-v2.1.0]] — current release
- [[Workflow]] — 7-step process for each fix
- [[Regression-Checklist]] — verify each fix doesn't regress
- [[User-Preferences]] — confirm scope with user before editing
