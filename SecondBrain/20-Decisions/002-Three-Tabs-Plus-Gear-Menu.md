---
tags: [adr, attendance, ux]
date: 2026-04-15
status: accepted
---

# ADR-002: Attendance shell has 3 tabs + gear menu for admin extras

## Context

Website has many admin-only sections: Manage Employees, Manage Users, Service Report generator, Download Reports, etc. Porting each as a separate tab would crowd the bottom nav and hurt discoverability for employees.

## Decision

**Three tabs for everyone** (Update, Weekly, Team) + a **gear icon** in the gradient hero header that only admins see. Gear opens a bottom sheet with:
- Manage Employees
- Manage Users
- Service Report (CSR)

Plus a **[Me / Admin] toggle pill** next to the gear lets admins flip the "view mode" — admin mode adds extra UI in each tab (employee picker on Update, matrix on Weekly, efficiency + share FAB on Team).

## Consequences

**Pros:**
- Clean 3-tab nav for employees (matches website's mobile flow)
- Admin features stay hidden until needed
- Toggle pill lets admins "try the employee view" for testing

**Cons:**
- Users initially confused, expecting more tabs (reported during QA)
- Gear icon needs to re-fetch profile on open (Riverpod caching issue — fixed with `ref.invalidate(userProfileProvider)` in `initState`)

## See also
- [[../10-Code-Context/Attendance-Feature]]
