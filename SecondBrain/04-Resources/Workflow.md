---
tags: [workflow, process, task-list, fluxgen]
created: 2026-04-21
source: memory/workflow.md
---

# Mandatory 7-Step Workflow

> Core rule: never jump to solutions. Every task follows Understanding → Classification → Root-cause → Strategy → Implementation → Validation → Learning.

See [[20-Decisions/006-Mandatory-7-Step-Workflow]] for the decision record.

## Task List Rule (NON-NEGOTIABLE)

Every multi-step task must be tracked with `TaskCreate` / `TaskUpdate`.

1. **Before starting** — break work into atomic tasks (`TaskCreate` with `subject`, `description`, `activeForm`)
2. **When starting** — `TaskUpdate` status → `in_progress`
3. **When done** — `TaskUpdate` status → `completed`
4. **After all** — final task = invoke `/learn-and-remember`
5. **Dependencies** — `addBlockedBy` / `addBlocks` when order matters

### Why mandatory
- Real-time user visibility
- Prevents skipping steps
- Audit trail
- Forces atomic, focused changes
- Ensures Step 7 (learning) is never forgotten

## 7 Steps

### 1. Problem Understanding
Restate, clarify what / when / where / expected. Universal or conditional? If unclear, **STOP and ask**. Create tasks after understanding.

### 2. Issue Classification
Category: UI/UX, CSS/Layout, Frontend Logic, State, Backend, API, Async/Perf, Data/Cache, Conditional Rendering, Assets, Browser/Platform, Responsive, Architecture, Build, Security. Explain why each applies.

### 3. Activate Relevant Agents
Only the ones that apply. Each agent states what it inspects, what it finds, what it must NOT change.
- UI/UX, CSS & Layout, Structure, State & Data, Async & Performance, Backend, Integration, Architecture, Responsive

### 4. Root Cause Analysis (REQUIRED before any fix)
Exact cause with code/line reference. Why the issue occurs. Why previous fixes didn't work (if applicable). If uncertain, STOP.

### 5. Fix Strategy (no code yet)
Global vs local. Why correct. Why safe. What stays unchanged. Risks. No hardcoded values / reload hacks / duplicates. Get approval before coding.

### 6. Implementation (after approval)
Minimal, targeted. Follow existing architecture. Preserve behavior + data. Mark tasks `in_progress` → `completed`.

### 7. Validation & Learning
Resolved, no regressions. Runs [[Regression-Checklist]]. Record learnings — see protocol below. Final task = `/learn-and-remember`.

## Non-Negotiable Rules

- Never assume backend failure without evidence
- Never suggest refresh/reload as a solution
- Never mix layout paradigms unintentionally
- Never create nested scroll containers unless intentional
- Never hide bugs with CSS tricks
- Prefer single source of truth
- If unsure → STOP and ask
- **Always** use `TaskCreate` / `TaskUpdate` for multi-step work

## Learning Protocol (after every fix)

Evaluate and record:

1. What broke and why? (root cause)
2. What was the fix?
3. What pattern caused it? (reusable lesson)
4. Could this happen elsewhere?
5. How to prevent it?

Update (as a tracked task):
- [[Debugging-Log]] / `MEMORY.md` — Past Bugs & Fixes
- This file — process improvements
- `CLAUDE.md` — Common Issues if user-facing
- Invoke `/learn-and-remember`

## Task List Template

```
Task 1: Investigate / understand the issue
Task 2: Root cause analysis
Task 3: Implement fix for <specific thing>
Task 4: Implement fix for <another thing>  (if multi-file)
Task 5: Validate fix — test across scenarios
Task 6: Record learnings — update MD files
```

## See also

- [[Anti-Patterns]] — check BEFORE fixing
- [[Debugging-Log]] — check for repeats
- [[Regression-Checklist]] — post-change verification
- [[User-Preferences]] — user workflow expectations
