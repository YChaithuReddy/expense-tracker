---
tags: [decision, adr, workflow, process, fluxgen]
created: 2026-04-21
source: memory/workflow.md, MEMORY.md
status: accepted
---

# ADR-006: Mandatory 7-Step Workflow for Every Request

## Status

Accepted

## Context

Earlier sessions on FluxGen repeatedly produced avoidable churn:

- Fixes applied without root-cause analysis (CSS `!important` wars, reload hacks — see [[Anti-Patterns]])
- Features ported silently with "future enhancements" silently deferred (see [[User-Preferences]] full-parity port)
- Visual regressions pushed to production because screenshot verification was skipped (btn-flux session, 4 back-to-back broken commits)
- Learnings never captured — same bugs reappearing months later (see [[Debugging-Log]])
- Multi-file edits without atomic tracking → half-done states, skipped validation

Ad-hoc diligence was not holding. The pattern was not "Claude forgot" — it was "no mandatory gate forcing each step."

## Decision

**Every request** — bug, feature, refactor, chore — follows the 7-step workflow with a live task list.

1. **Problem Understanding** — restate, clarify what/when/where/expected. If unclear, STOP and ask.
2. **Issue Classification** — categorize (UI/CSS/Logic/State/Backend/API/Async/Data/Build/Security) and explain why.
3. **Activate Agents** — only the relevant specialists; each declares what it inspects and what it must NOT change.
4. **Root Cause Analysis** — required before any fix, with specific code/line references.
5. **Fix Strategy** — global vs local, why correct, why safe, what stays unchanged. No code yet. Get approval.
6. **Implementation** — minimal, targeted, preserves existing behavior. Follows existing architecture.
7. **Validation & Learning** — runs [[Regression-Checklist]], records learnings via `/learn-and-remember`, updates [[Debugging-Log]].

**Task list is non-negotiable** — `TaskCreate` / `TaskUpdate` tracks every multi-step piece of work. Final task = invoke `/learn-and-remember`.

Detailed specification in [[Workflow]].

## Consequences

### Positive
- Real-time user visibility of progress (task list)
- Root-cause required before any edit — no more reload-as-a-fix (AP-12 in [[Anti-Patterns]])
- Learnings always captured — [[Debugging-Log]] stays current
- Agent team assembled per-task instead of per-habit
- Atomic commits fall out naturally from atomic tasks
- Approval gate at Step 5 catches scope misalignment early — aligns with [[User-Preferences]] "ask before editing"

### Negative / trade-offs
- Slower perceived start on trivial tasks — Step 1 restatement feels like friction
- Task-list discipline adds overhead — justified for multi-step, wasteful for one-liners
- Requires harness enforcement (hooks) to be reliable — see `workflow-enforcer.sh` and `stop-learning-reminder.sh`

### Execution modes
- **FULL** — all 7 steps (default)
- **STANDARD** — steps 1, 3, 4, 6, 7
- **QUICK** — steps 3, 6, 7 (only for genuinely trivial changes)

## Related decisions

- [[001-Reuse-GAS-backend]]
- [[002-Three-Tabs-Plus-Gear-Menu]]
- [[003-Debug-Signing-For-Updates]]
- [[004-Release-Optimizations]]
- [[005-Asanify-Auto-Prompt]]

## See also

- [[Workflow]] — the full specification
- [[Anti-Patterns]] — what Step 4 must catch
- [[Debugging-Log]] — what Step 7 populates
- [[Regression-Checklist]] — Step 7 verification gate
- [[User-Preferences]] — the human-side prefs this codifies
