# Command Center — Design Spec

**Date:** 2026-04-24
**Author:** Chaitanya + Claude (brainstorming session)
**Status:** Draft — awaiting user review before implementation plan
**Location (once built):** `C:\Users\chath\command-center\`

---

## 1. Vision

A local-first, web-based "mission control" for orchestrating Claude Code agents across all of Chaitanya's projects. Visually inspired by "The ROBO Group" video reference (skill tree graph, sprint board, backlog, crew of named agents). First registered project is the Expense Tracker; designed from day one to scale to multi-project usage (fluxgen_emerald, future projects).

**Core promise:** a stunning, game-like cockpit that makes working with 6 named crew members feel like running a team — while remaining semi-autonomous (you drive, agents execute, board reacts in real time).

---

## 2. Key Decisions (from brainstorming Q&A)

| # | Question | Decision |
|---|----------|----------|
| 1 | Project location | **D — Hybrid standalone:** `C:\Users\chath\command-center\`, first project is expense tracker, multi-project from day one |
| 2 | Autonomy level | **B — Semi-autonomous:** dashboard + slash commands + one-click spawn. No background daemon in v1. |
| 3 | Views included | **B — Video parity + multi-project essentials:** 11 views (Dashboard, Skill Tree, Sprint, Backlog, Timeline, Pipeline, Activity, Crew, Inbox, Docs, Projects) |
| 4 | Tech stack | **A — Next.js 15 + TypeScript + Tailwind + shadcn/ui** (exactly what the reference uses) |
| 5 | Agent model | **C — Branded crew, composite roles:** 6 named members, each composes multiple real agents |
| 6 | Visual style | **Hybrid — Linear/Notion premium base + pixel-art crew avatars.** Dark-first with light theme toggle. |
| Approach | How to build | **B — Build from scratch, reference MeisnerDan/mission-control patterns** (avoids AGPL) |

**Explicit v1 exclusions** (deferred to v2+):
- Background daemon that auto-dispatches tasks
- Decisions queue, Brain Dump, full Reports, Settings UI
- Multi-agent swarm (crew members talking autonomously to each other)
- Spend caps / token budget enforcement
- External integrations (GitHub Issues, Linear, Jira)
- Editing registered projects' memory from the command center UI

---

## 3. Architecture

### 3.1 Folder structure

```
command-center/
├── app/                                # Next.js 15 App Router
│   ├── layout.tsx                      # Global shell (sidebar, theme, ⌘K)
│   ├── page.tsx                        # Dashboard home (4-up)
│   ├── skill-tree/page.tsx             # Force-directed graph
│   ├── sprint/page.tsx                 # Kanban board (current week)
│   ├── backlog/page.tsx                # Sortable table
│   ├── timeline/page.tsx               # Gantt view
│   ├── pipeline/page.tsx               # Stage-flow view
│   ├── activity/page.tsx               # Live event feed
│   ├── crew/page.tsx                   # 6 crew member cards
│   ├── crew/[id]/page.tsx              # Crew member detail (incl. Memory tab)
│   ├── inbox/page.tsx                  # Delegations + questions
│   ├── docs/page.tsx                   # Markdown browser
│   ├── projects/page.tsx               # Multi-project management
│   ├── projects/[id]/page.tsx          # Project detail (Code Graph, Memory, Stats)
│   └── api/
│       ├── tasks/route.ts              # CRUD /api/tasks
│       ├── tasks/[id]/route.ts
│       ├── crew/route.ts
│       ├── projects/route.ts
│       ├── projects/scan/route.ts      # Re-scan .claude/ folders
│       ├── spawn/route.ts              # One-click "run task" endpoint
│       ├── messages/route.ts           # Inbox CRUD
│       └── events/route.ts             # SSE for live updates
├── data/                               # File-based state (source of truth)
│   ├── projects.json
│   ├── tasks.json
│   ├── crew.json
│   ├── skills-library.json
│   ├── inbox.json
│   ├── activity-log.json
│   ├── sprints.json
│   ├── brain-dump.json                 # optional / v1 minimal
│   └── crew-memory/
│       ├── fluxy.md                    # identity memory
│       ├── fluxy/                      # per-project memory
│       │   └── expense-tracker.md
│       ├── cass.md
│       ├── cass/
│       │   └── expense-tracker.md
│       └── ...                         # supa, bugsy, shield, scribe
├── lib/
│   ├── store.ts                        # Zod schemas + read/write with mutex
│   ├── spawn.ts                        # Launches `claude -p` in Windows Terminal
│   ├── project-scanner.ts              # Auto-discovers .claude/ folders
│   ├── events.ts                       # SSE event bus
│   └── memory.ts                       # Crew memory read/write/compact
├── components/
│   ├── ui/                             # shadcn components
│   ├── skill-tree/                     # React Flow graph + custom nodes
│   ├── kanban/                         # @dnd-kit board
│   ├── crew/                           # Avatars, status cards
│   ├── sidebar/
│   ├── command-palette/                # ⌘K
│   └── providers/                      # Theme, SSE context
├── public/
│   └── avatars/                        # 6 pixel-art PNGs (@1x + @2x)
│       ├── fluxy.png / fluxy@2x.png
│       ├── cass.png / cass@2x.png
│       └── ...
├── .claude/                            # Command center's OWN Claude config
│   ├── commands/                       # 12 slash commands
│   │   ├── standup.md
│   │   ├── orchestrate.md
│   │   ├── sprint-plan.md
│   │   ├── weekly-review.md
│   │   ├── pick-up-work.md
│   │   ├── brain-dump.md
│   │   ├── triage.md
│   │   ├── report.md
│   │   ├── crew-retro.md
│   │   ├── skill-scan.md
│   │   ├── register-project.md
│   │   └── activate.md
│   └── agents/                         # Crew-member role-agents
│       ├── fluxy.md
│       ├── cass.md
│       ├── supa.md
│       ├── bugsy.md
│       ├── shield.md
│       └── scribe.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── CLAUDE.md                           # Command center's own project memory
└── README.md
```

### 3.2 Data flow

```
                    ┌──────────────────────┐
                    │  Next.js Browser UI  │
                    │   (you + crew view)  │
                    └──────────┬───────────┘
                          HTTP + SSE
                               │
                    ┌──────────▼───────────┐
                    │  Next.js API routes  │
                    │  /api/tasks, /spawn  │
                    └──────┬────────┬──────┘
                           │        │
                 file I/O  │        │ spawn process
                           │        │
                ┌──────────▼──┐  ┌──▼──────────────────────┐
                │ data/*.json │  │ Windows Terminal tab    │
                │  (state)    │  │ running `claude -p`     │
                └──────▲──────┘  └──────────┬──────────────┘
                       │                    │
                       │ reads & writes     │ does work
                       │                    │
                ┌──────┴────────────────────▼─────────────┐
                │   Claude Code session in project dir    │
                │   Reads project's .claude/ + writes     │
                │   back to command-center/data/*.json    │
                └──────────────────────────────────────────┘
```

### 3.3 Key architectural choices

- **File-based state** (JSON + per-file mutex) — no database, git-friendly, survives reboots, matches Mission Control pattern
- **Projects are just paths** — registered project = `{id, name, path, claudeDir, color}`; we scan its `.claude/` folder for agents/skills
- **One-click spawn** — API endpoint runs `wt.exe -d <projectPath> -- claude -p "<prompt>"` (opens Windows Terminal tab, runs Claude Code)
- **Live updates** — Server-Sent Events stream state changes; when Claude writes back to `tasks.json`, UI updates without refresh
- **Isolation** — command center has its own `.claude/` so its commands (`/standup`, `/orchestrate`) don't pollute project-level command namespaces

---

## 4. Data Model

All files validated with Zod on read and write. Writes go through `lib/store.ts` (acquires per-file mutex, writes to temp file + atomic rename).

### 4.1 `projects.json`

```ts
{
  projects: Array<{
    id: string                     // slug (e.g., "expense-tracker")
    name: string
    path: string                   // absolute path
    claudeDir: string              // relative, default ".claude"
    color: string                  // hex, tints UI
    active: boolean
    addedAt: string                // ISO
    stats: {
      agents: number
      skills: number
      commands: number
    }
    detected: {
      hasClaudeMd: boolean
      hasMemory: boolean
      hasGraphify: boolean
      graphifyPath?: string        // relative, e.g. "SecondBrain/graphify-out/graph.json"
    }
    memoryPaths: {
      projectCLAUDE?: string       // e.g. "CLAUDE.md"
      projectMemory?: string       // e.g. "memory/"
    }
  }>
}
```

### 4.2 `crew.json`

```ts
{
  crew: Array<{
    id: "fluxy" | "cass" | "supa" | "bugsy" | "shield" | "scribe"
    name: string
    role: string
    tagline: string
    avatar: string                 // "/avatars/{id}.png"
    color: string                  // hex neon accent
    delegates: Array<{
      type: "base" | "project-agent" | "skill"
      pattern?: string             // e.g. "css-*", "supabase-*"
      weight?: number
    }>
    skills: string[]               // slash command names this crew can run
    stats: {
      tasksCompleted: number
      hoursActive: number
      lastActiveAt?: string
    }
  }>
}
```

Initial crew (6 members, fixed in v1):

| id | name | role | color | delegates to (per-project agents) |
|----|------|------|-------|------------------------------------|
| fluxy | Fluxy | Orchestrator | #8b5cf6 | (none — orchestrates others) |
| cass | Cass | Frontend / UI | #ec4899 | css-layout-debugger, design-review-agent, premium-ui-designer, responsive-tester, accessibility-auditor |
| supa | Supa | Backend / DB | #14b8a6 | supabase-specialist, api-debugger |
| bugsy | Bugsy | Debug / QA | #f59e0b | debugging-specialist, ux-flow-tester, investigate skill |
| shield | Shield | Security / Perf | #10b981 | security-scanner, performance-profiler, cso skill |
| scribe | Scribe | Docs / Memory | #60a5fa | graphify skill, /learn-and-remember, report-generator |

### 4.3 `tasks.json`

```ts
{
  tasks: Array<{
    id: string                     // "D-001", "D-002", ...
    projectId: string              // foreign key to projects
    title: string
    description: string            // markdown
    epic: "Business" | "Content" | "Platform" | "Product"
        | "Operations" | "Course" | "Personal"
    status: "todo" | "in_progress" | "review" | "done"
    assignee?: string              // crew id
    collaborators: string[]        // crew ids
    priority: "low" | "mid" | "high" | "crit"
    sprint?: string                // sprint id, null = backlog
    pipelineStage: "plan" | "build" | "test" | "ship"
    blockedBy: string[]            // task ids
    estimate?: number              // hours
    createdAt: string
    updatedAt: string
    completedAt?: string
    spawnHistory: Array<{
      spawnedAt: string
      terminalPid?: number
      exitCode?: number
      tokensUsed?: number
      durationMs?: number
    }>
  }>
}
```

### 4.4 `sprints.json`

```ts
{
  sprints: Array<{
    id: string                     // "Wk13"
    name: string                   // "Sprint — Wk13"
    subtitle: string
    startDate: string              // YYYY-MM-DD
    endDate: string
    status: "planning" | "active" | "completed"
    goal: string
    stats: { todo: number; inProgress: number; review: number; done: number }
  }>
}
```

### 4.5 `inbox.json`

```ts
{
  messages: Array<{
    id: string                     // "msg-001"
    from: string                   // crew id or "human"
    to: string                     // crew id or "human"
    type: "question" | "report" | "delegation" | "decision"
    taskId?: string                // linked task
    subject: string
    body: string                   // markdown
    status: "unread" | "read" | "resolved"
    createdAt: string
  }>
}
```

### 4.6 `skills-library.json`

```ts
{
  skills: Array<{
    id: string                     // slug
    name: string
    source: string                 // e.g. "project:expense-tracker"
    sourcePath: string             // relative to project
    ownedBy: string[]              // crew ids that delegate here
    tags: string[]
    description: string            // from SKILL.md frontmatter
    invokeCount: number
    lastInvokedAt?: string
  }>
}
```

### 4.7 `activity-log.json`

```ts
{
  events: Array<{
    id: string
    timestamp: string
    type: "task_created" | "task_updated" | "task_moved"
        | "spawn_started" | "spawn_completed" | "spawn_failed"
        | "message_sent" | "skill_invoked" | "command_ran"
        | "project_registered" | "project_scanned"
    actor: string                  // "human" | crew id
    payload: Record<string, unknown>
    projectId?: string
  }>
}
```

### 4.8 Design principles

- Every write through `lib/store.ts` (Zod validate → mutex acquire → atomic write)
- All IDs are human-readable slugs, not UUIDs
- Timestamps are ISO strings (readable in git diffs)
- No nested references — joins happen in memory
- Files stay under 500KB each (activity-log rolls to `.json.1`, `.json.2` when full)

---

## 5. The 11 Views

### 5.1 Dashboard (`/`)
4-up grid:
- **Active Sprint** — Wk13 progress bar, counts per column, link to sprint view
- **Inbox** — unread count, top 3 messages
- **Crew status** — 6 avatar pills (idle / busy / away), current task preview
- **Today's activity** — last 20 events, live-updating

Top bar: project switcher, ⌘K, theme toggle.

### 5.2 Skill Tree (`/skill-tree`)
- Force-directed graph (React Flow + d3-force layout)
- **Center nodes:** 6 crew members with pixel avatars (48px), glow aura in crew color
- **Outer nodes:** skills from `skills-library.json`, colored by project
- **Edges:** crew → skills they delegate to
- **Background:** pure `--bg-base` + radial gradient (8% crew accent)
- **Interactions:** hover crew → their skills pulse; click crew → zoom-in; click skill → right drawer with details
- **Filters:** project, skill type, crew member
- **Search:** 2px white ring on matching nodes
- **Performance budget:** 60fps @ ≤200 nodes / ≤500 edges; switch to WebGL if exceeded

### 5.3 Sprint (`/sprint`)
- 4 columns: TODO → IN PROGRESS → REVIEW → DONE
- Cards: ID badge, title, crew avatar, priority pill, epic tag
- Drag-drop between columns (@dnd-kit) → PATCH `/api/tasks/:id`
- Top-left sprint selector (Wk13, Wk12, ...)
- Sprint header: name, subtitle, date range, progress counts
- "+ New" button → task creation dialog
- Card click → right drawer with full task + spawn button + activity

### 5.4 Backlog (`/backlog`)
- Columns: ID · Epic · Task · Status · Assignee · Priority · Sprint
- Filter bar: All Epics / All Status / All Assignees / All Priorities + search
- Sort any column; drag to reorder within priority tier
- Inline edit: click cell to change status / assignee / priority
- Bulk select → bulk move to sprint
- "+ New" top-right

### 5.5 Timeline (`/timeline`)
- X-axis: dates (zoom: week / month / quarter)
- Y-axis: grouped by crew OR by epic (toggle)
- Bars: colored by status, spanning estimate × start date
- Today marker (vertical line)
- Dependency arcs between `blockedBy` tasks
- Drag bar edges to adjust dates

### 5.6 Pipeline (`/pipeline`)
- Stage-flow: PLAN → BUILD → TEST → SHIP
- Organized by `pipelineStage` (orthogonal to Sprint's `status`)
- Drag between stages updates `pipelineStage`
- Use case: "what's in BUILD right now across all sprints"

### 5.7 Activity (`/activity`)
- Left: scrolling event list, newest first
- Filters: actor, type, project, date
- Each row: timestamp · actor avatar · type icon · one-line description
- Click → right panel with full payload + linked task card
- Live-updating via SSE from `/api/events`

### 5.8 Crew (`/crew`)
- 6 cards in hero grid
- Each card: pixel avatar (large) · name · role · tagline · status pill · today's task count · owned skill count
- Hover: card lifts, shows week-to-date completion count
- Click → `/crew/[id]` detail:
  - Hero: avatar, name, bio, status
  - "Currently working on" (active task card)
  - "Skills" section (all delegated skills)
  - "Recent activity" (last 20 events by this crew)
  - "Memory" tab (identity + per-project memory, read-only display, editable via text)
  - "Delegates to" (which project agents — debugging-specialist, etc.)

### 5.9 Inbox (`/inbox`)
- Gmail-style 2-pane
- Left: message list (sender avatar, subject, preview, unread dot)
- Right: selected message (from / to / linked task, markdown body, Reply / Resolve / Escalate buttons)
- Compose dialog for sending to a crew member

### 5.10 Docs (`/docs`)
- Markdown browser for `docs/`, registered project CLAUDE.md files, and memory reports
- Tree view left, rendered markdown right
- Read-only (editing stays in your IDE)

### 5.11 Projects (`/projects`)
- List of registered projects, each row: name · path · color · stats · last activity
- Top: aggregate stats across all
- "+ Register Project" → file picker → scans `.claude/` → adds entry
- Row actions: toggle active, edit color, open in VS Code, unregister
- Click → `/projects/[id]` detail with tabs:
  - **Overview** (stats, recent tasks)
  - **Agents** (list of `.claude/agents/`)
  - **Skills** (list of `.claude/skills/`)
  - **Memory** (read-only display of project's CLAUDE.md + memory files)
  - **Code Graph** (renders `SecondBrain/graphify-out/graph.json` if present)

### 5.12 Sidebar (always visible)

```
[logo] Command Center

Dashboard
── Work ──
Skill Tree
Sprint
Backlog
Timeline
Pipeline
Activity
── Team ──
Crew
Inbox
── Config ──
Docs
Projects

[project switcher dropdown]
[theme toggle]
[⌘K hint pill]
```

---

## 6. Crew & Agent Delegation Model

### 6.1 Three-layer model

```
LAYER 1: Crew (UI-facing)
  6 branded personas — Fluxy, Cass, Supa, Bugsy, Shield, Scribe
        │ maps to
        ▼
LAYER 2: Role-agents (Claude Code subagents)
  command-center/.claude/agents/{id}.md
  6 subagent files with system prompts + toolboxes
        │ delegates via Task tool
        ▼
LAYER 3: Specialist agents (per-project)
  Your existing .claude/agents/debugging-specialist.md, etc.
  Called via project-level discovery at spawn time
```

### 6.2 Layer 2 role-agent skeleton (example: Cass)

```markdown
---
name: cass
description: Frontend/UI specialist — CSS layout, responsive design, premium aesthetic, accessibility. Delegates to per-project UI specialists.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#ec4899"
---

You are Cass — the Frontend & UI crew member for the Command Center.

Personality: meticulous, design-obsessed, fast at CSS debugging.
Cares about: hierarchy, spacing, motion timing, theme parity.

Memory (read on start):
- Identity: C:\Users\chath\command-center\data\crew-memory\cass.md
- Project: C:\Users\chath\command-center\data\crew-memory\cass\{projectId}.md

Workflow per task:
1. Read the task from tasks.json (id passed in prompt)
2. Read the project's CLAUDE.md + memory/
3. Check which project UI specialists exist in its .claude/agents/
4. Delegate to the right one via Task tool:
   - CSS cascade / layout bugs → css-layout-debugger
   - Design review → design-review-agent
   - Responsive issues → responsive-tester
   - A11y → accessibility-auditor
5. Return a consolidated report to inbox.json
6. Update task status in tasks.json
7. Append learnings to project memory (or identity memory if cross-project)

Domain boundaries:
- Never touch backend, DB, or security code — delegate to Supa/Shield
- Never edit the user's personal memory files (read-only reference)
```

One file per crew member. Each defines personality, domain boundaries, delegation rules, report format.

### 6.3 Spawn flow

Click "▶ Run" on task D-012 assigned to Cass:

1. API `POST /api/spawn` with `{ taskId: "D-012" }`
2. Handler reads task → looks up `crew.cass` → builds context prompt
3. Prompt includes: task details, assigned crew member, paths to identity + project memory, absolute paths to `tasks.json` and `inbox.json` for write-back
4. Launches: `wt -d <projectPath> -- claude -p "<prompt>"`
5. Windows Terminal opens new tab in the project directory
6. Claude Code starts with the expense tracker's context (its CLAUDE.md, hooks, agents all load automatically)
7. Cass subagent reads task → delegates to project specialists → does work
8. Cass writes to `C:\Users\chath\command-center\data\tasks.json` (absolute path) and appends to inbox / activity log
9. Command center SSE stream picks up file change → UI updates live

### 6.4 Agent memory (two layers)

**Layer A: Identity memory** — `command-center/data/crew-memory/<id>.md`
- Cross-project, persistent across all spawns
- Contains: personality, working style preferences, stable knowledge, cross-project learnings
- Write cadence: appended when something genuinely cross-project is learned
- Hard cap: 200 lines, auto-compacted weekly by Scribe via `/crew-retro`

**Layer B: Project-scoped memory** — `command-center/data/crew-memory/<id>/<projectId>.md`
- Specific to one crew member × one project
- Contains: last 10 task outcomes, decisions + rationale, project-specific patterns, open threads
- Write cadence: appended at end of every successful spawn

**Injection:** paths are passed in the spawn prompt; Cass reads both at session start.

**UI:** `/crew/[id]` has a "Memory" tab showing both layers, editable by the user.

**Hygiene:** append-only during spawn; compaction rewrites entire file but git history preserves everything.

**Non-conflict with existing memory:** your existing `C:\Users\chath\.claude\projects\...\memory\*` stays untouched — that's *user-level* memory. Crew memory is orthogonal.

### 6.5 Task routing

- **Manual:** assign via dropdown on task card
- **Auto:** leave blank + invoke `/orchestrate` → Fluxy reads unassigned tasks, uses epic + title to pick the best crew, assigns, posts routing report to inbox
- Tasks can have collaborators (lead + 1-N supports)

### 6.6 Explicitly out of scope in v1

- Crew members talking to each other autonomously (no swarm)
- Budget enforcement / spend caps
- Stateful agent memory *within* a spawn (each spawn is a fresh Claude session reading memory files at start)

---

## 7. Slash Commands & Automation

### 7.1 Slash commands (12 total, in `command-center/.claude/commands/`)

**Orchestration (Fluxy):**

| Command | Purpose |
|---------|---------|
| `/standup` | Generate per-crew standup report; post to inbox |
| `/orchestrate` | Auto-route unassigned tasks to crew; post routing report |
| `/sprint-plan` | Draft next sprint from top backlog tasks; balance crew load |
| `/weekly-review` | Week summary: tasks completed per member, blockers, spend. Save to docs/. |

**Task manipulation:**

| Command | Purpose |
|---------|---------|
| `/pick-up-work` | "I have X minutes" — returns 3 ranked task suggestions |
| `/brain-dump` | Capture raw idea → brain-dump.json |
| `/triage` | Convert brain-dump entries to tasks with epic/priority/assignee suggestions (user approves each) |
| `/report TASK_ID` | Crew member writes completion report to inbox |

**Crew & skills:**

| Command | Purpose |
|---------|---------|
| `/crew-retro` | Compact each crew member's project memory; export lessons to identity memory |
| `/skill-scan` | Scan all registered projects' `.claude/` → rebuild skills-library.json |

**Project management:**

| Command | Purpose |
|---------|---------|
| `/register-project PATH` | Add a project to projects.json, scan .claude/, pick color |
| `/activate PROJECT_ID` | Set default project context for subsequent commands |

### 7.2 UI-only API endpoints (no slash command)

| Button / event | Endpoint | Action |
|----------------|----------|--------|
| "▶ Run task" | `POST /api/spawn` | Open Windows Terminal tab → `claude -p` with full context |
| "💬 Ask Cass" | `POST /api/messages` | Create inbox message, spawn crew to answer |
| "↻ Refresh" on Skill Tree | `POST /api/projects/scan` | Re-scan all active projects |
| Card drag in Sprint | `PATCH /api/tasks/:id` | Update status, log activity |
| SSE stream | `GET /api/events` | Live state changes to UI |

### 7.3 Slash command file shape

```markdown
---
description: One-line purpose
argument-hint: [TASK_ID] [optional flags]
allowed-tools: Read, Write, Edit, Bash
---

# /command-name

You are invoked as `/command-name $ARGUMENTS`.

Steps:
1. Read command-center/data/tasks.json
2. ...
3. Append to activity-log.json with type "command_ran", actor "human"
4. Return a concise summary.
```

### 7.4 What's NOT a slash command

- Task CRUD (UI or direct file edit, live-updates via SSE)
- Spawning a crew on a task (UI button is faster than a command)
- Sending messages (UI inbox composer)

Slash commands exist only for LLM-reasoning-heavy operations (routing, reports, summaries, triage).

---

## 8. Visual Design System

### 8.1 Theme tokens

**Dark (default):**
```
--bg-base:        #0a0a0b
--bg-elevated:    #121215
--bg-glass:       rgba(18,18,21,0.72)     /* + backdrop-blur: 12px */
--bg-hover:       #1a1a1f
--border:         #27272a
--border-glow:    rgba(139,92,246,0.18)   /* accent-tinted */
--fg-primary:     #f4f4f5
--fg-secondary:   #a1a1aa
--fg-muted:       #52525b
```

**Light (via toggle):**
```
--bg-base:        #fafafa
--bg-elevated:    #ffffff
--bg-glass:       rgba(255,255,255,0.78)
--border:         #e4e4e7
--fg-primary:     #09090b
--fg-secondary:   #3f3f46
--fg-muted:       #71717a
```

### 8.2 Crew accent palette

| Crew | Hex | Purpose |
|------|-----|---------|
| Fluxy | #8b5cf6 (violet) | orchestrator |
| Cass | #ec4899 (pink) | UI |
| Supa | #14b8a6 (teal) | DB |
| Bugsy | #f59e0b (amber) | debug |
| Shield | #10b981 (emerald) | security |
| Scribe | #60a5fa (sky) | docs |

Semantic: `--success #22c55e`, `--warn #eab308`, `--error #ef4444`, `--critical #dc2626`.

### 8.3 Typography

- **Display:** Geist Sans 600, 32/40, -0.02em
- **H1:** Geist Sans 600, 24/32
- **H2:** Geist Sans 600, 18/26
- **Body:** Geist Sans 400, 14/22
- **Small:** Geist Sans 400, 12/18, `--fg-muted`
- **Mono:** JetBrains Mono 500, 12/18 — task IDs, timestamps, shortcuts

### 8.4 Spacing & shape

- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 (strict; no other values)
- **Radius:** `sm 6` (pills), `md 10` (inputs/buttons), `lg 14` (cards), `xl 20` (modals)
- **Shadow (dark):** `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.45)`
- **Border:** always 1px, `--border`; hover/active switches to accent-tinted `--border-glow`

### 8.5 Components (shadcn + custom)

| Component | Source | Custom layer |
|-----------|--------|--------------|
| Card | shadcn | Hover glow (accent 18%, 24px blur) |
| Button | shadcn | Primary gradient, ghost = transparent + border |
| Dialog/Sheet | shadcn | Backdrop blur 12px + 40% black |
| Table | shadcn | Zebra off, row hover, accent 6% on selected |
| Tabs | shadcn | Pill indicator in accent |
| Badge | shadcn | Extended: priority (4), epic (7 colors), status (4) |
| Tooltip | shadcn | Small + mono + 8px offset |
| Command (⌘K) | shadcn | Recents + crew search + project switch |
| Kanban | custom (@dnd-kit) | Columns + drag preview ghost |
| Skill graph | custom (React Flow + d3-force) | See §5.2 + §8.7 |

### 8.6 Crew avatars

- 8-bit pixel art, 64×64 source → displayed at 32/48/96 px
- ~20×20 pixel grid, 4-color palette (crew hue + 2 shades + transparent)
- Front-facing, symmetric
- Idle: 2-frame breathing loop, 600ms
- Active: accent ring glow + subtle scale pulse
- Idle (no task): desaturated 40%, no ring
- Stored: `public/avatars/{id}.png` + `{id}@2x.png`
- Source: generated via build script OR existing 8-bit character pack + recolor — decided in implementation

### 8.7 Skill Tree visualization

- **Engine:** React Flow + d3-force layout plugin (fallback: Cytoscape if perf requires)
- **Background:** `--bg-base` + center radial gradient (8% crew accent, fades at 60% radius)
- **Crew nodes (center cluster):** 48×48 pixel avatar + name in mono below; radial glow aura (80px blur) in crew color
- **Skill nodes (outer):** 8px circle, colored by project; hover tooltip (name + invoke count)
- **Layout rule:** skills gravitate toward their owning crew; same-project skills loosely cluster
- **Edges:**
  - Idle: 1px, `rgba(accent, 0.25)`
  - Hover/selected: 2px, full accent, animated pulse
- **Interactions:**
  - Hover crew → their skills pulse; others fade to 15%
  - Click crew → 800ms ease-out zoom-in, rebalance
  - Click skill → right drawer with details
  - Search → 2px white ring on matches
- **Perf budget:** 60fps ≤200 nodes / ≤500 edges; WebGL renderer above that

### 8.8 Motion

- **Transition base:** 150-200ms, cubic-bezier `0.16, 1, 0.3, 1`
- **Page transitions:** 120ms fade + 8px Y translate
- **Card hover:** 100ms border/shadow
- **Drag card:** scale 1.02, shadow grows, grabbing cursor; target column tints 4%
- **Spawn button:** click → spinner (200ms) → "running" pill with terminal tab # label
- **Inbox bell:** new message = 300ms ring shake + accent dot
- **Scrollbars:** native, thin, transparent track, thumb `--border`

### 8.9 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Top bar — 48px — project switcher · ⌘K · theme · profile   │
├──────────┬───────────────────────────────────────────────────┤
│  Sidebar │  Main canvas                                       │
│  224px   │  padding 24px                                      │
│          │  max-width varies per view                         │
└──────────┴───────────────────────────────────────────────────┘
```

### 8.10 Accessibility

- WCAG 2.1 AA contrast throughout (4.5:1 text, 3:1 UI)
- Full keyboard navigation; Tab order matches visual
- Focus rings: 2px accent, 2px offset; never `outline: none`
- `prefers-reduced-motion` → disable avatar breathing, fade-only transitions, static Skill Tree
- Color never sole indicator — priority has pill shape, status has icon

### 8.11 Theme toggle
- Top-right of app shell
- `localStorage` persisted + CSS var swap on `<html>`
- 200ms cross-fade between token sets
- First load respects `prefers-color-scheme`; dark wins if ambiguous

---

## 9. Expense Tracker Integration (first project)

### 9.1 Zero changes to the expense tracker

Command center is **read-only** to registered projects.
- No new dependencies added
- No files added to the expense tracker repo
- No code modifications
- No new hooks

### 9.2 Registration flow (one-time)

```
/register-project "C:\Users\chath\Documents\Python code\expense tracker"
```

Handler:
1. Validate path exists + has `.claude/` folder
2. Scan `.claude/agents/*.md` → extract name, description, color from frontmatter → currently 4 agents
3. Scan `.claude/commands/*.md` → extract description → currently 6 commands
4. Scan `.claude/skills/*/SKILL.md` → extract metadata → currently 10 skills
5. Check for CLAUDE.md, `memory/`, `SecondBrain/graphify-out/graph.json`
6. Write entry to `projects.json`
7. Refresh Skill Tree data (skills become nodes in expense tracker cluster)

### 9.3 Discovered assets

**Agents** (project `.claude/agents/`):
- debugging-specialist, design-review-agent, premium-ui-designer, prompt-enhancer
- Displayed as specialist nodes; edged to the crew that delegates to them

**Skills** (project `.claude/skills/*/SKILL.md`):
- 10 skills — component-generator, feature-upgrader, indian-receipt-ocr, layout-fixer, mobile-build, mobile-debug, mobile-fix, performance-optimizer, report-generator, ui-redesigner
- Shown as skill nodes colored teal (expense tracker color)
- Hover tooltip uses `description` frontmatter

**Commands** (project `.claude/commands/`):
- Tracked; surfaced in command palette when active project context = expense tracker
- `/design-review` and `/bridge` etc. become "available tools"

**Memory integration:**
- `memory/` + feedback files from `C:\Users\chath\.claude\projects\...\memory\` render on `/projects/expense-tracker` → Memory tab
- Read-only display
- Scribe references them for context when working on expense tracker tasks

**Graphify integration:**
- `SecondBrain/graphify-out/graph.json` → loaded into Code Graph tab on project detail
- Uses your existing graph data: god nodes, communities, cluster layout
- Separate from the Skill Tree (which is crew ↔ skills; Code Graph is files/modules)
- Picks up regenerations automatically on next scan

### 9.4 Task seeding

Command center can optionally seed `tasks.json` from `memory/pending-fixes.md` (if present) — the user reviews and approves the seed before import. Nothing auto-imports without OK.

### 9.5 Spawning into expense tracker

Click "▶ Run" on a task:
1. API reads `projects[expense-tracker].path`
2. Opens Windows Terminal, `cd`s to that path
3. Runs `claude -p "<crew context + task brief + memory paths>"`
4. Claude loads expense tracker's CLAUDE.md, memory/, .claude/ automatically (Claude Code native behavior)
5. Crew member uses the expense tracker's own agents, hooks, skills
6. Crew writes back to `C:\Users\chath\command-center\data\tasks.json` + `inbox.json` (absolute paths in prompt)
7. Command center SSE picks up file changes → UI updates live

### 9.6 Hook coexistence

Expense tracker has 7 active hooks (workflow-enforcer, auto-cap-sync, block-env-edits, pre-commit-gate, pre-compact-save, stop-learning-reminder, session-start-context). When Cass spawns in that directory:
- All hooks fire as usual
- Crew's prompt runs after hooks inject context
- Workflow enforcer still reminds about 7-step process
- Auto-cap-sync still runs on frontend file edits

No conflict — command center is orthogonal.

### 9.7 Multi-project growth

Adding project #2 is 10 seconds:
```
/register-project "C:\Users\chath\Documents\Python code\fluxgen_emerald"
```
New color, new scan, new cluster in Skill Tree. Tasks gain a second `projectId`. Every view supports cross-project filter.

### 9.8 Scoped out of v1 for integration

- Editing expense tracker's CLAUDE.md or memory from command center UI (read-only)
- Parallel multi-crew spawns on a single task
- Task sync to GitHub Issues / Linear / Jira

---

## 10. Phased Delivery

Per the user's memory preference (`feedback_phased_delivery.md` — MVP first for 4+ feature work), the build is chunked:

### Phase 1 — Foundation (day 1-2)
- Next.js 15 project scaffold, TypeScript, Tailwind, shadcn install
- Data layer: Zod schemas for all 7 JSON files, `lib/store.ts` with mutex
- App shell: sidebar + top bar + theme toggle
- Dashboard view (static)
- Projects view with `/register-project` slash command + scanner

### Phase 2 — Core views (day 3-5)
- Crew view + crew detail page (with Memory tab)
- Sprint view (Kanban with @dnd-kit)
- Backlog view (sortable table)
- Inbox view
- Task creation / edit / delete dialogs
- SSE event stream + live UI updates

### Phase 3 — The hero view (day 6)
- Skill Tree page with React Flow + d3-force
- Project-scan-driven graph data
- Crew avatars (generate or acquire + recolor to crew palette)
- Hover / click / zoom interactions

### Phase 4 — Automation & polish (day 7-8)
- 12 slash commands wired up
- `/api/spawn` integration with Windows Terminal
- Crew role-agent files (6 subagents)
- Activity feed view
- Timeline + Pipeline views (lower-priority — can defer if running tight)
- Expense tracker registration + Code Graph tab on its detail page
- Light theme variant
- Accessibility pass

**Estimated total: 7-8 days** (matches Approach B estimate in brainstorming).

If time pressure surfaces, Phase 4's Timeline + Pipeline are the first things to cut — they can ship in a v1.1.

---

## 11. Implementation choices to finalize during planning

These are tactical decisions deferred to the implementation-plan phase. They do **not** block spec approval — each has a sensible default called out below, and all have low downside if revised mid-build.

1. **Pixel avatar sourcing** — generate procedurally in a build script, or license/use an existing 8-bit sprite pack and recolor? Default: use an existing open-license pack (e.g., Kenney's 1-Bit Pack) and recolor to the crew palette. Affects Phase 3 time by ~0.5 day.
2. **Terminal emulator for spawn** — `wt.exe` (Windows Terminal) assumed as default. Fallback chain: `wt.exe` → `pwsh.exe` new window → `cmd.exe /c start`. Confirmed during spawn implementation based on what's installed.
3. **Skill Tree engine** — React Flow + d3-force is the default. If perf fails at >200 nodes, swap to Cytoscape.js. Decision deferred until we have real node counts.
4. **Graphify integration rendering** — default to `iframe` embedding the existing `graph.html`. Upgrade to native re-render in v1.1 if the iframe breaks theming.
5. **SSE vs WebSocket** — SSE is the default (simpler, one-way push fits the use case). No blockers anticipated.

---

## 12. Out of scope (explicit non-goals)

- Autonomous agent swarm (crew chatting to each other without user trigger)
- Token/cost spend caps and enforcement
- Cloud hosting / SaaS distribution
- Mobile companion app
- GitHub Issues / Linear / Jira sync
- Editing user's existing memory files from command center
- Multi-user / team collaboration features
- Backup / cloud sync of `data/*.json`

---

## 13. Success criteria

v1 is done when:
- [ ] Command center runs on `http://localhost:3000`
- [ ] All 11 views render with real data from `data/*.json`
- [ ] Expense tracker registered; its 4 agents + 10 skills + 6 commands appear in Skill Tree
- [ ] Clicking "▶ Run" on a task spawns a Claude Code session in a Windows Terminal tab
- [ ] That session has access to the expense tracker's CLAUDE.md + crew member's memory
- [ ] Completion writes back; UI updates live without refresh
- [ ] 12 slash commands all work
- [ ] Dark + light themes both render correctly
- [ ] Skill Tree graph runs at 60fps with registered projects' assets
- [ ] WCAG 2.1 AA contrast throughout

---

## Appendix — Reference

- Video that inspired this: https://www.youtube.com/watch?v=W9igiY2JdHA&t=719s
- Architectural reference: https://github.com/MeisnerDan/mission-control (AGPL-3.0, pattern-only)
- Claude Code Agent Teams docs: https://code.claude.com/docs/en/agent-teams
- Brainstorming skill used: `superpowers:brainstorming` v5.0.7
