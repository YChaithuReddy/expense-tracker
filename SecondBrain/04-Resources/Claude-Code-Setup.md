---
tags: [tooling, claude-code, workflow]
created: 2026-04-21
---

# Claude Code Setup Reference

## Installed skills

| Skill | Use for |
|---|---|
| `superpowers:brainstorming` | Required before any creative/feature work |
| `superpowers:writing-plans` | Turn a spec into a step-by-step plan |
| `superpowers:subagent-driven-development` | Execute a plan with fresh subagent per task |
| `superpowers:systematic-debugging` | 4-phase root-cause investigation |
| `superpowers:test-driven-development` | Write failing test first, then code |
| `graphify` | Build knowledge graph of any folder |
| `investigate` | Systematic debugging (gstack flavor) |
| `learn-and-remember` | Save learnings to CLAUDE.md after fixes |
| `codebase-decision-trees` | Debugging playbook for this codebase |

## Agents

| Agent | Use for |
|---|---|
| `debugging-specialist` | Codebase-aware bug investigation |
| `design-review-agent` | UI/UX review |
| `premium-ui-designer` | High-end UI design |
| `responsive-tester` | 5-viewport Playwright testing |
| `css-layout-debugger` | Multi-file cascade bugs |
| `supabase-specialist` | Schema, RLS, migrations |
| `accessibility-auditor` | WCAG 2.1 AA |
| `security-scanner` | OWASP Top 10 frontend |
| `performance-profiler` | Bundle size, API latency |

## Workflow (7-step, enforced by hooks)

1. **Understand & plan** — restate, classify, read files, check memory, create task list
2. **Research & design** — root cause / architecture review
3. **Implement** — activate skills + agents, verify both themes
4. **Verify visually** — screenshots at 1440/768/375px, design review
5. **Quality gate** — security + a11y + code review + perf
6. **Deploy & monitor** — cache bump → commit → push → deploy → screenshot
7. **Learn & evolve** — record learnings, update memory, update docs

## See also
- [[../10-Code-Context/FluxGen-Architecture]]
- [[../02-Projects/FluxGen-v2.1.0]]
