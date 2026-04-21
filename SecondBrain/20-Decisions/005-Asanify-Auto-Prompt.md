---
tags: [adr, attendance, asanify, integration]
date: 2026-04-21
status: accepted
---

# ADR-005: Prompt for Asanify clock-in after status submit

## Context

Employees already mark their work status in our attendance tab (On Site / In Office / WFH / etc). They also need to clock in on Asanify (company HR system) separately. Two redundant actions on the same event.

Asanify has **no public API** for clock-in/out (confirmed with their support). So we can't automate the clock-in from our app. Three options:

1. Do nothing — employees remember to do both
2. Web scraping / headless browser — fragile, violates Asanify ToS
3. Native prompt + deep link — tap one button to launch Asanify dashboard in Chrome

## Decision

After a successful status submit (`onSite`, `inOffice`, `workFromHome` only — not leave/holiday/weekend), show a dialog:

> "Clock in on Asanify? Open Asanify in your browser to clock in for today."
>
> [Skip]  [Open Asanify]

"Open Asanify" launches `https://secure.asanify.com/Home/Dashboard` via `url_launcher`.

**Once-per-day:** user's choice (skip or open) is remembered via SharedPreferences key `asanify_prompt_YYYY-MM-DD` so afternoon status updates don't re-prompt.

**Skipped for:**
- Leave / Holiday / Weekend (no work = no clock-in)
- Admins submitting for someone else (they're not the one clocking in)

## Consequences

**Pros:**
- Zero new infrastructure needed
- Works with Asanify's existing auth (user is already signed in on Chrome)
- Once-per-day UX doesn't nag
- Easy to turn off per user (just tap Skip — remembered)

**Cons:**
- Still requires manual tap in Asanify (can't fully automate)
- If user clears Chrome cookies, they have to re-login on Asanify
- No confirmation loop back to our app (we don't know if they actually clocked in)

## Future work

If Asanify ever exposes an API, replace the manual prompt with a native clock-in button that actually hits their endpoint. Track this in `05-Archive/` once shipped.

## See also

- [[../10-Code-Context/Attendance-Feature]]
- [[../10-Code-Context/FluxGen-Architecture]]
