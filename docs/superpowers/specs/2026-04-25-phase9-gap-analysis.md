# Phase 9 Gap Analysis — What's missing vs the two reference builds

**Date:** 2026-04-25
**Sources analyzed:**
1. The "Build Your Own Claude Code Dashboard" master prompt (FastAPI + Python stack — Linear/Raycast/Vercel quality bar)
2. Mark Kashef's "I Replaced OpenClaw and Hermes With This Claude Code Setup" video (ClaudeClaw v2)

**Our current state:** 106 commits, tag `phase-8-mission-control`, 22 page routes, 15 API routes, 13 crew (7 primary + 6 engineering), in-dashboard chat with stream-json tool feed, autopilot daemon, Telegram outbound, persistent `claude --resume` sessions, Mission Control theme.

---

## TL;DR

Source 1 is a **dashboard product** built on top of Claude Code's native telemetry — its superpower is **OTEL ingestion** which gives it 8+ analytics panels for free. We have ZERO of those.

Source 2 (Mark Kashef) is more about **architecture and experience** — voice "war room", hive mind cross-agent memory, Obsidian auto-injection, Cloudflare tunnel for mobile, memory decay/pinning via Gemini classifier.

**The biggest single win we can get** = enable Claude Code's OTEL telemetry → add `/v1/logs` + `/v1/metrics` endpoints → unlock cache analytics, tool latency, hook tracking, edit acceptance, productivity counters, and pressure detection in one shot.

---

## What we ALREADY have (so we know the baseline)

- Multi-agent crew (7 primary + 6 engineering)
- In-dashboard chat with stream-json tool visibility
- Persistent sessions via `claude --resume`
- Mission Control dark theme + Premium alt skin
- `/missions` queue with state pills, retry, block
- `/cron` scheduler with persistence
- `/logs` filterable terminal feed
- `/analytics` KPIs + 14-day charts
- `/cost` token spend dashboard
- `/code-map` D3 graph of edited files
- `/skill-tree` 2D + `/skill-tree-3d` three.js
- `/workflows` visual builder + run engine
- `/inbox` with thread view
- `/memory` (claude-mem viewer iframe)
- Telegram bidirectional bridge with /commands + @mentions + webhook setup
- Multi-agent folder architecture (`agents/<id>/` × 7)
- Crew identity memory (editable per-member)
- Voice mode (Web Speech API STT + per-crew TTS)
- Plugin architecture (`+ Add crew member`)
- Autopilot daemon (browser-side)
- Top bar with clock/uptime/crew/missions/Telegram/EMRG
- Right Live Feed panel
- 12 slash commands

---

## Source 1 — FastAPI Dashboard prompt — Features we DON'T have

### Tier 1: OTEL telemetry ingestion (single biggest win)

Claude Code itself emits structured events when `CLAUDE_CODE_ENABLE_TELEMETRY=1`. This is gold:

| Feature | What it shows | Effort |
|---------|---------------|--------|
| `POST /v1/logs` + `POST /v1/metrics` ingest | Receives every tool_use, hook, decision, api_request from Claude itself | 0.5 day |
| **Cache efficiency panel** | Cache hit rate over time, target 70%+ | 0.25 day |
| **Tool latency panel** | Per-tool p50/p95/max + error rate | 0.5 day |
| **Session outcomes** | Daily errored / rate_limited / truncated / unfinished / ok stacked bars | 0.25 day |
| **Hook activity** | Pairs `hook_execution_start` ↔ `hook_execution_complete` for hook latency | 0.25 day |
| **Edit decisions** | Accept/reject rate for Edit/MultiEdit/Write/NotebookEdit | 0.25 day |
| **Productivity counters** | `claude_code.commit.count`, `pull_request.count`, `lines_of_code.count` | 0.25 day |
| **Pressure panel** | Retry exhaustion + compaction + recent api_errors | 0.25 day |
| **Agent fanout** | Sessions that dispatched Task tool calls (subagent usage) | 0.25 day |

**Total: ~2.5 days for the entire OTEL stack.** This is the single highest-leverage chunk.

### Tier 2: Native session ingestion + analytics

| Feature | What it shows | Effort |
|---------|---------------|--------|
| **JSONL session reader** | Scrape `~/.claude/projects/*.jsonl` for real session/token data | 0.5 day |
| **System health strip** | Server uptime, memory, OTEL last-event age, daemon tick age | 0.25 day |
| **Attention bar** | Red banner: stuck loops, failed tasks, dispatcher staleness | 0.25 day |
| **Heatmap grid** | 30-day GitHub-style daily activity tile | 0.25 day |
| **Firehose SSE feed** | Live stream of OTEL events with type filter | 0.25 day |
| **Project breakdown by cwd** | Sessions grouped by working directory | 0.25 day |

**Total: ~1.75 days.**

### Tier 3: HITL workflow polish

| Feature | What it does | Effort |
|---------|--------------|--------|
| **DECISION:/INBOX: marker parsing** | Agent emits `DECISION: should I X?` in output → dispatcher creates pending decision row → blocks until human answers | 0.75 day |
| **Live session follow-up box** | Stream-mode sessions get a textarea to inject mid-run messages | 0.5 day |
| **Telegram inline buttons** | `dash:approve:42`, `dash:rerun:17` callbacks with notification dedupe table | 0.5 day |
| **Command palette (⌘K)** | Fuzzy search pages + queue task quick action | 0.5 day |

**Total: ~2.25 days.**

### Tier 4: DevX + safety

| Feature | What it does | Effort |
|---------|--------------|--------|
| **`doctor.py` health check** | Deterministic green/red checks (no LLM): Python ver, OTEL keys, dashboard reachability, Telegram bot | 0.5 day |
| **PID-based emergency stop** | `os.kill(pid, 0)` verify alive + `ps argv` check before SIGTERM. Spares interactive sessions | 0.5 day |
| **Playwright e2e tests** | Main pages render, command palette opens, schedule composer creates schedule | 1 day |
| **`install.sh` wizard** | Single-command install with arg parsing + OTEL wizard + Telegram wizard | 0.75 day |

**Total: ~2.75 days.**

---

## Source 2 — Mark Kashef video — Features we DON'T have

### Tier 1: Memory architecture (the standout)

| Feature | What it does | Effort |
|---------|--------------|--------|
| **Hive Mind** — cross-agent shared task log | Every agent writes completed tasks to a global registry. Any agent can query "what has Ops been up to?" via the hive mind. | 0.75 day |
| **Memory washing machine** — Gemini-classified pin/decay | Cheap Gemini-3-flash classifies each chat message as fact / preference / context / discard, then SQL stores with importance score. Memories decay over time unless pinned. | 1 day |
| **Pinned memories** — manual + automatic | Some memories never decay (your name, address, business email). UI to pin/unpin. | 0.25 day |
| **Importance distribution view** | Histogram of memory importance scores. Ones at the bottom about to decay. | 0.25 day |
| **Obsidian vault auto-injection** | When invoking `Content` agent, auto-inject relevant Obsidian folder contents into CLAUDE.md preamble | 0.5 day |

**Total: ~2.75 days.** This is the highest-conceptual-value chunk. It would make our crew memory dramatically smarter.

### Tier 2: Voice War Room

| Feature | What it does | Effort |
|---------|--------------|--------|
| **Voice "War Room"** | Click → ambient music → speak to main agent → agent responds via TTS, can delegate to subagents mid-conversation | 1.5 days |
| **Daily.co/Pipecat integration (optional, expensive)** | Real Google-Meet-style room with avatar | 2 days + paid service |
| **Agent name-prefix routing** | "Comms, draft me a script" → automatically goes to Comms agent | 0.5 day |

We already have basic voice (Web Speech). The "War Room" is a unified UI mode + ambient audio + multi-agent routing. **Doable without Pipecat** — 1.5 days for a polished version.

### Tier 3: Mobile / Remote

| Feature | What it does | Effort |
|---------|--------------|--------|
| **Cloudflare tunnel auto-setup** | `cloudflared tunnel` script that publishes localhost:3005 to a stable public URL | 0.5 day |
| **`/dashboard` Telegram command returns tunnel URL** | Click link in Telegram → mobile dashboard | 0.25 day |
| **Telegram message queue** | Single ordered queue prevents race when scheduled task fires while user types | 0.5 day |
| **Pin gate + chat ID allow-list** | Multi-layer security: pin code on first interaction + only whitelisted chat IDs respond | 0.5 day |

**Total: ~1.75 days.**

### Tier 4: Auto-assign + main agent pattern

| Feature | What it does | Effort |
|---------|--------------|--------|
| **Auto-assign quadrant via cheap LLM** | Task created → Gemini-3-flash decides best crew + Eisenhower quadrant | 0.5 day |
| **"Main agent" delegation pattern** | One agent (CEO/Fluxy) refuses to do work itself, only routes. Forces delegation. | 0.5 day |

---

## What I'd SKIP and why

| Feature | Why skip |
|---------|----------|
| Pipecat + Daily.co + Pika | Eye-watering expensive (Mark says so himself). $$$+ infra complexity for marginal gain over Web Speech |
| macOS launchd plists | You're on Windows. Equivalent = Task Scheduler XML, but `start-cc.bat` already covers this for solo use |
| Posture panel | Source 1 explicitly excludes this from the free build |
| Cowork audit ingest | Optional second source, low marginal value |
| Vector DB for memory (Supabase/Pinecone) | We use claude-mem already — overengineering |

---

## Recommended Phase 9 build order

**Wave A — OTEL pipeline (5 days, biggest payoff):**
1. OTEL ingestion endpoints (`/v1/logs`, `/v1/metrics`) + Zod schemas
2. JSONL session reader + token rollup
3. 8 analytics panels (cache, tool latency, session outcomes, hook activity, edit decisions, productivity, pressure, agent fanout)
4. Heatmap grid + firehose feed
5. System health strip + attention bar

**Wave B — Memory upgrade (3 days, conceptually transformative):**
6. Hive mind cross-agent task log
7. Memory washing machine (Gemini classifier + decay/pin scoring)
8. Pinned memories UI
9. Importance distribution view
10. Obsidian vault auto-injection (optional, only if you use Obsidian)

**Wave C — HITL + UX polish (2.5 days):**
11. DECISION:/INBOX: marker parsing in chat stream
12. Live session follow-up box
13. Telegram inline buttons with dedupe table
14. Command palette (⌘K)
15. War Room voice mode (unified)

**Wave D — Mobile + safety (2 days):**
16. Cloudflare tunnel script + `/dashboard` Telegram command
17. Telegram message queue
18. Pin gate security
19. PID-based emergency stop with verification
20. doctor.ts health check (Windows port — no PowerShell ps -p, use Get-Process)

**Wave E — Tests + polish (2 days):**
21. Playwright e2e suite (5-7 specs)
22. Auto-assign quadrant via Haiku
23. Main-agent delegation pattern (CEO refuses work, only routes)

**Total: ~14 days** for full parity with both reference builds.

---

## Decision matrix

| Want to | Build (in priority order) |
|---------|---------------------------|
| **Get the most analytics power fastest** | Wave A only — 5 days, unlocks 8+ panels |
| **Make the crew genuinely smarter** | Wave A + Wave B — 8 days |
| **Match the FastAPI prompt's quality bar** | Wave A + Wave C + Wave E — 9.5 days |
| **Match Mark Kashef's UX** | Wave B + Wave C (war room) + Wave D — 7.5 days |
| **Full parity with both** | All of Wave A-E — 14 days |
| **Just the killer features** | OTEL ingest + Hive Mind + War Room + Command Palette — ~5 days |

---

## My honest recommendation

**Build Wave A first (5 days).** Reasons:

1. OTEL ingestion is the single most valuable upgrade — it's how Claude Code itself reports what it's doing. Without it we're guessing; with it we have ground truth.
2. The 8 panels it unlocks are EXACTLY the panels the FastAPI prompt obsesses over (cache, tool latency, hook activity, edit decisions, etc.). They're in that prompt because they're the most useful daily metrics.
3. After Wave A you can run Claude Code with telemetry and immediately see which tools are slow, which hooks are choking, where you're hitting rate limits, your true cache hit rate. No other wave gives that ROI per day.

**Then Wave B.** Hive mind + memory washing machine fundamentally upgrades how crew remember. Every other crew interaction gets sharper.

**Wave C-E are polish/parity.** Important if you want to demo it, less critical if you're solo using.

---

## Concrete next step

Tell me which wave(s) to build, and in what order. Or say "all 14 days" and I'll execute the whole sequence end-to-end via subagents (rate limits permitting), tag as `phase-9-otel-hive-warroom`, and push to GitHub.
