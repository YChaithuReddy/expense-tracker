<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes � gives risk-scored analysis |
| `get_review_context` | Need source snippets for review � token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.


---

## Ops Agent

File: .claude/agents/ops-agent.md
Color: Orange
Role: Infrastructure, deployment, monitoring, automation

### When to Use
- Deploying to Vercel or building Android APK
- Bumping Service Worker cache versions after frontend changes
- Running post-deploy canary health checks
- Auditing build.js vs sw.js file parity gaps
- Setting up .vercelignore or security headers
- Investigating production incidents or stale cache issues

### Trigger Phrases
deploy, cache, service worker, build, vercel, production, monitor, canary, APK build, sw.js, infra, stale cache, ship, push to prod

### Tools Available
Glob, Grep, Read, Write, Edit, Bash, WebFetch

### Ops Skills
| Skill | Purpose |
|-------|---------|
| /cache-bump | Sync-bump all 3 SW cache versions in one shot |
| /deploy-verify | Full deploy + production verification workflow |
| /canary | Post-deploy health monitoring (PASS/WARN/FAIL) |
| /vercel-infra | Vercel config audit + .vercelignore creation |
| /mobile-build | Capacitor APK build and sync |

### Active Infrastructure Issues
1. CRITICAL: build.js missing styles_dashboard.css, dashboard.js, pdfs.html vs sw.js
2. HIGH: SW cache drift - CACHE_NAME=v115 but STATIC/DYNAMIC still at v96
3. MEDIUM: No .vercelignore - test HTML files accessible on production Vercel URL
