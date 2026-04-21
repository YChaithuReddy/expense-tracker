---
tags: [adr, attendance, backend]
date: 2026-04-15
status: accepted
---

# ADR-001: Reuse Google Apps Script backend for attendance

## Context

The Fluxgen Employee Status website uses a Google Apps Script Web App backed by Google Sheets. When porting to Flutter, we had three options:

1. Reuse existing GAS endpoint (fastest)
2. Migrate to Supabase (consistent with rest of app)
3. Hybrid: Supabase primary + nightly sync to sheets

## Decision

**Reuse GAS.** The Flutter app talks to the same `https://script.google.com/macros/s/.../exec` endpoint as the website.

## Consequences

**Pros:**
- Zero migration effort
- Website and Flutter app share data instantly
- No changes needed to existing reports, scripts, or sheet consumers

**Cons:**
- GAS is slow (2–5s per call)
- 20k calls/day free tier limit
- `doPost` always 302-redirects (client must accept 2xx–3xx as success)
- URL baked into client code (exposed in view-source on website, trivially extractable from APK)

## Mitigations

- `FluxgenApiService` has conservative 15–20s timeouts
- UI shows shimmer skeletons during API waits
- All POSTs treat 2xx and 3xx as success
- Future: migrate to Supabase when team grows past 50 people or hits rate limits

## See also
- [[../10-Code-Context/Attendance-Feature]]
- [[../10-Code-Context/FluxGen-Architecture]]
