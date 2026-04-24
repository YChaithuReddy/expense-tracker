# Command Center — Phase 4: Polish + Memory + Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Integrate claude-mem (persistent session memory) into the spawn flow, ship the remaining 4 views (Timeline, Pipeline, Activity, Docs), 4 high-value slash commands (`/standup`, `/orchestrate`, `/pick-up-work`, `/weekly-review`), and polish (light theme + a11y).

**Architecture:** Phase 4 adds ONE external dependency (claude-mem, an AGPL-3.0 plugin) that runs as a Bun worker on port 37777 and registers SessionStart/UserPromptSubmit/PostToolUse/Stop/SessionEnd hooks. The command center surfaces a link to claude-mem's UI but does not replicate its functionality. Also adds 4 new page routes, 4 slash commands, and polish passes on the existing 9 routes.

**Prereqs:**
- Phase 3 complete (tag `phase-3-skill-tree-spawn`, 51 commits, 42 tests)
- Bun installed or installable (claude-mem requires it)
- Windows Terminal available for spawn flow

**Out of scope** (deferred to a future Phase 5 if needed):
- `/sprint-plan`, `/brain-dump`, `/triage`, `/report`, `/crew-retro`, `/skill-scan`, `/activate` slash commands
- Editing claude-mem's database or UI
- Building our own semantic-search memory layer (we use claude-mem's)

**Expected duration:** 3-4 days.

---

## Task 1: Install and verify claude-mem

**Files:** none (external install).

- [ ] **Step 1: Verify Bun available**

```powershell
bun --version
```
If "command not found", install via PowerShell:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Then restart terminal / reload PATH and retry `bun --version`. Expect `1.x.x`.

- [ ] **Step 2: Install claude-mem**

```powershell
npx claude-mem install
```
This registers the plugin's hooks globally + starts the worker on port 37777 + creates `~/.claude-mem/` for SQLite DB + Chroma vectors.

Expected output ends with a success banner mentioning the worker URL `http://localhost:37777` and that hooks are registered.

- [ ] **Step 3: Verify worker running**

```powershell
curl -s -o /dev/null -w "%{http_code}" "http://localhost:37777"
```
Expected: 200 (claude-mem's web viewer UI).

- [ ] **Step 4: Verify basic memory capture**

Start a short `claude -p` session in a test directory to confirm hooks fire:
```powershell
cd $env:TEMP
mkdir claude-mem-smoke 2>$null
cd claude-mem-smoke
echo "test" | claude -p "Say hello" 2>&1 | Select-Object -First 10
```
Session should complete. Then check that a session row landed in the DB:
```powershell
curl -s "http://localhost:37777/api/sessions?limit=1"
```
Expected: JSON with at least one session entry. (If the API shape differs from `/api/sessions`, check claude-mem's README for the actual endpoint — but a non-empty response to a known endpoint is enough.)

- [ ] **Step 5: Commit a marker (no code change needed; we commit the addition of claude-mem to CLAUDE.md in Task 3)**

No commit yet — moves to Task 2.

**Report:**
- Bun version
- claude-mem version (from `npx claude-mem --version` if available)
- Worker status (200/other)
- Session capture verified: yes/no

Do NOT proceed to Task 2.

---

## Task 2: Surface claude-mem in Crew detail Memory tab

**Files:**
- Modify: `app/crew/[id]/page.tsx`
- Modify: `components/crew/CrewMemoryView.tsx` (add claude-mem link block)

- [ ] **Step 1: Augment CrewMemoryView with claude-mem link**

Overwrite `C:\Users\chath\command-center\components\crew\CrewMemoryView.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

export function CrewMemoryView({ crewId }: { crewId: string }) {
  const [identity, setIdentity] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [memWorkerUp, setMemWorkerUp] = useState<boolean | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/crew/${crewId}/memory`)
      .then((r) => r.ok ? r.text() : "")
      .then((text) => {
        setIdentity(text || "_No identity memory recorded yet. Crew member will populate this file after their first task._");
      })
      .finally(() => setLoading(false));

    // Probe claude-mem worker (port 37777)
    fetch("http://localhost:37777", { mode: "no-cors" })
      .then(() => setMemWorkerUp(true))
      .catch(() => setMemWorkerUp(false));
  }, [crewId]);

  if (loading) return <div className="text-fg-muted">Loading memory…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-widest text-fg-muted">
          Identity memory
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4 text-[13px] leading-6 text-fg-secondary whitespace-pre-wrap font-mono">
          {identity}
        </div>
        <div className="mt-1 text-[11px] text-fg-muted">
          Cross-project — auto-updated by {crewId} after spawned tasks.
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-widest text-fg-muted">
          Session memory (claude-mem)
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="text-[13px] text-fg-secondary">
            {memWorkerUp === null && "Checking claude-mem worker…"}
            {memWorkerUp === true && (
              <>
                claude-mem is running. Every spawned session writes observations, tool calls, and AI-compressed summaries that future sessions retrieve automatically.
              </>
            )}
            {memWorkerUp === false && (
              <>
                claude-mem worker is not responding on port 37777. Run <code className="font-mono text-[12px]">npx claude-mem install</code> to enable persistent session memory.
              </>
            )}
          </div>
          {memWorkerUp && (
            <a
              href="http://localhost:37777"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-md border border-border bg-bg-base px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-bg-hover"
            >
              Open claude-mem viewer →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Curl `/crew/cass` → 200. Kill server.

```powershell
pnpm tsc --noEmit
pnpm test
```
Expected: 0 errors, 42 tests pass.

```powershell
git add components/crew/CrewMemoryView.tsx
git commit -m "feat(memory): surface claude-mem in Crew detail Memory tab"
```
Expected: 52 commits.

---

## Task 3: Document claude-mem integration in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (command center's)

- [ ] **Step 1: Append a "Memory" section**

READ `C:\Users\chath\command-center\CLAUDE.md`. Append this section at the end (after the existing "What's NOT here yet" block):

```markdown

## Memory (two layers)

**Layer 1 — Crew identity memory** (owned by command center)
- Path: `data/crew-memory/<crewId>.md` + `data/crew-memory/<crewId>/<projectId>.md`
- Scope: each crew member's personality, preferences, and cross-project learnings
- Write cadence: crew member appends after every spawned task
- UI: Crew detail page → Memory tab (top block)

**Layer 2 — Session memory (claude-mem plugin, AGPL-3.0)**
- Worker: http://localhost:37777
- Storage: `~/.claude-mem/` (SQLite FTS5 + Chroma vector DB)
- Scope: every `claude -p` session automatically captures tool calls, observations, and AI-compressed summaries
- Hooks: SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd — register via `npx claude-mem install`
- Retrieval: spawned sessions pull relevant past context automatically; no manual action needed
- UI: Crew detail page → Memory tab (lower block with link-out)

**How they complement each other:**
- Layer 1 = who the crew member IS (voice, patterns, role)
- Layer 2 = what they've DONE (full session transcripts, searchable)

The command center owns Layer 1; claude-mem owns Layer 2. We do not replicate Layer 2 — we link out.

## Phase history

- **Phase 1** — Foundation (Next.js + shell + Projects view) — tag `phase-1-foundation`
- **Phase 2** — Views (Sprint + Backlog + Crew + Inbox + SSE) — tag `phase-2-views`
- **Phase 3** — Skill Tree + Spawn + pixel avatars — tag `phase-3-skill-tree-spawn`
- **Phase 4** — Memory + Timeline + Pipeline + Activity + Docs + slash commands + polish (in progress)
```

- [ ] **Step 2: Commit**

```powershell
cd C:\Users\chath\command-center
git add CLAUDE.md
git commit -m "docs: document claude-mem integration + memory layer model"
```
Expected: 53 commits.

---

## Task 4: Timeline view

**Files:**
- Create: `app/timeline/page.tsx`
- Create: `components/timeline/TimelineView.tsx`

The Timeline view is a simple Gantt-style horizontal chart: Y-axis = crew members, X-axis = calendar days, bars = tasks with estimates. Without estimates, we place a dot per task at its createdAt date.

- [ ] **Step 1: TimelineView component**

Create `C:\Users\chath\command-center\components\timeline\TimelineView.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CrewMemberT, TaskT } from "@/lib/schemas";
import { PixelAvatar } from "@/components/crew/PixelAvatar";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 48; // px per day

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const STATUS_COLOR: Record<string, string> = {
  todo: "#52525b",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

export function TimelineView() {
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [crew, setCrew] = useState<CrewMemberT[]>([]);

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks));
    fetch("/api/crew").then((r) => r.json()).then((d) => setCrew(d.crew));
  }, []);

  const { rangeStart, rangeDays, tasksByCrew } = useMemo(() => {
    if (tasks.length === 0) {
      return { rangeStart: startOfDay(new Date()), rangeDays: 14, tasksByCrew: new Map<string, TaskT[]>() };
    }
    const dates = tasks.map((t) => new Date(t.createdAt));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = startOfDay(minDate);
    const end = startOfDay(maxDate);
    const days = Math.max(14, daysBetween(start, end) + 7); // pad 1 week

    const byId = new Map<string, TaskT[]>();
    for (const t of tasks) {
      const key = t.assignee ?? "__unassigned";
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(t);
    }
    return { rangeStart: start, rangeDays: days, tasksByCrew: byId };
  }, [tasks]);

  const rows = useMemo(() => {
    const assignees = [...crew.map((c) => c.id), "__unassigned"];
    return assignees
      .map((id) => ({ id, tasks: tasksByCrew.get(id) ?? [] }))
      .filter((r) => r.tasks.length > 0);
  }, [crew, tasksByCrew]);

  const crewById = useMemo(() => new Map(crew.map((c) => [c.id, c])), [crew]);
  const today = startOfDay(new Date());
  const todayOffset = daysBetween(rangeStart, today);

  const dayHeaders = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(rangeStart.getTime() + i * DAY_MS);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });

  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 160 + rangeDays * DAY_WIDTH }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-bg-elevated">
            <div className="w-40 shrink-0 border-r border-border px-3 py-2 text-[11px] uppercase tracking-widest text-fg-muted">
              Crew
            </div>
            <div className="flex">
              {dayHeaders.map((label, i) => (
                <div
                  key={i}
                  className="shrink-0 border-r border-border/50 px-2 py-2 text-center text-[10px] text-fg-muted"
                  style={{ width: DAY_WIDTH }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="p-6 text-[13px] text-fg-muted">No tasks to chart.</div>
          ) : (
            rows.map((row) => {
              const member = row.id === "__unassigned" ? null : crewById.get(row.id);
              return (
                <div key={row.id} className="flex border-b border-border/50">
                  <div className="flex w-40 shrink-0 items-center gap-2 border-r border-border px-3 py-3">
                    {member ? (
                      <>
                        <PixelAvatar crewId={member.id} color={member.color} size={24} />
                        <span className="text-[13px]">{member.name}</span>
                      </>
                    ) : (
                      <span className="text-[13px] text-fg-muted">Unassigned</span>
                    )}
                  </div>
                  <div className="relative flex" style={{ width: rangeDays * DAY_WIDTH }}>
                    {todayOffset >= 0 && todayOffset < rangeDays && (
                      <div
                        className="pointer-events-none absolute top-0 z-0 h-full w-px bg-border-glow"
                        style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                        aria-label="Today"
                      />
                    )}
                    {row.tasks.map((t) => {
                      const created = new Date(t.createdAt);
                      const offset = daysBetween(rangeStart, created);
                      return (
                        <div
                          key={t.id}
                          className="absolute flex h-5 items-center rounded-sm px-1.5 text-[10px] font-mono text-white"
                          style={{
                            left: offset * DAY_WIDTH + 2,
                            top: 12,
                            width: DAY_WIDTH - 4,
                            backgroundColor: STATUS_COLOR[t.status] ?? "#52525b",
                          }}
                          title={`${t.id}: ${t.title}`}
                        >
                          {t.id}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Timeline page**

Create `C:\Users\chath\command-center\app\timeline\page.tsx`:
```tsx
import { TimelineView } from "@/components/timeline/TimelineView";

export default function TimelinePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Timeline</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Tasks over time, grouped by crew member.
        </p>
      </div>
      <TimelineView />
    </div>
  );
}
```

- [ ] **Step 3: Smoke test + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Curl `/timeline` → 200. Kill.

```powershell
pnpm tsc --noEmit
pnpm test
```
Expected: 0 errors, 42 pass.

```powershell
git add app/timeline/ components/timeline/
git commit -m "feat(ui): Timeline view — tasks over time by crew"
```
Expected: 54 commits.

---

## Task 5: Pipeline view

**Files:**
- Create: `app/pipeline/page.tsx`
- Create: `components/pipeline/PipelineBoard.tsx`

Pipeline is visually similar to Sprint Kanban but groups by `pipelineStage` (plan/build/test/ship) instead of `status`. Drag-drop updates `pipelineStage` via PATCH /api/tasks/:id.

- [ ] **Step 1: PipelineBoard component**

Create `C:\Users\chath\command-center\components\pipeline\PipelineBoard.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TaskT } from "@/lib/schemas";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useEvents } from "@/lib/use-events";
import { cn } from "@/lib/utils";

const STAGES = ["plan", "build", "test", "ship"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  plan: "PLAN",
  build: "BUILD",
  test: "TEST",
  ship: "SHIP",
};

function DraggableCard({ task }: { task: TaskT }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard task={task} compact />
    </div>
  );
}

function StageColumn({
  stage,
  count,
  children,
}: {
  stage: Stage;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] flex-col gap-2 rounded-lg border border-border bg-bg-elevated p-3 transition-colors",
        isOver && "border-border-glow bg-bg-hover"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-[11px] text-fg-muted">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function PipelineBoard() {
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [active, setActive] = useState<TaskT | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const reload = useCallback(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks));
  }, []);

  useEffect(() => reload(), [reload]);
  useEvents(
    ["task_created", "task_updated", "task_moved"],
    useCallback(() => reload(), [reload])
  );

  function onDragStart(e: DragStartEvent) {
    setActive(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const newStage = e.over?.id as Stage | undefined;
    if (!newStage || !STAGES.includes(newStage)) return;
    const taskId = e.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.pipelineStage === newStage) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, pipelineStage: newStage } : t
      )
    );

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineStage: newStage }),
    });
    if (!res.ok) reload();
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const column = tasks.filter((t) => t.pipelineStage === stage);
          return (
            <StageColumn key={stage} stage={stage} count={column.length}>
              {column.map((task) => (
                <DraggableCard key={task.id} task={task} />
              ))}
            </StageColumn>
          );
        })}
      </div>
      <DragOverlay>
        {active ? <TaskCard task={active} compact /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Pipeline page**

Create `C:\Users\chath\command-center\app\pipeline\page.tsx`:
```tsx
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Pipeline</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Tasks grouped by delivery stage, across all sprints.
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
```

- [ ] **Step 3: Smoke + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
# curl /pipeline
pnpm tsc --noEmit
pnpm test
git add app/pipeline/ components/pipeline/
git commit -m "feat(ui): Pipeline view — drag tasks across plan/build/test/ship stages"
```

Expected: 200, 0 errors, 42 tests, 55 commits.

---

## Task 6: Activity view

**Files:**
- Create: `app/activity/page.tsx`
- Create: `components/activity/ActivityFeed.tsx`

Simple chronological feed from `activity-log.json` + live SSE.

- [ ] **Step 1: ActivityFeed component**

Create `C:\Users\chath\command-center\components\activity\ActivityFeed.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityEventT } from "@/lib/schemas";
import { useEvents } from "@/lib/use-events";

const TYPE_ICON: Record<string, string> = {
  task_created: "＋",
  task_updated: "✎",
  task_moved: "↔",
  spawn_started: "▶",
  spawn_completed: "✓",
  spawn_failed: "✗",
  message_sent: "✉",
  skill_invoked: "⚡",
  command_ran: "⌘",
  project_registered: "⊕",
  project_scanned: "↻",
};

function formatRelative(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEventT[]>([]);

  const reload = useCallback(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => setEvents([...d.events].reverse()));
  }, []);

  useEffect(() => reload(), [reload]);
  useEvents(
    ["task_created", "task_updated", "task_moved", "spawn_started", "message_sent", "project_registered", "project_scanned"],
    useCallback(() => reload(), [reload])
  );

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated p-6 text-fg-secondary">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-bg-base font-mono text-[12px] text-fg-muted">
            {TYPE_ICON[e.type] ?? "·"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-fg-muted">{e.type}</span>
              <span className="shrink-0 text-[10px] text-fg-muted">{formatRelative(e.timestamp)}</span>
            </div>
            <div className="truncate text-[13px]">
              <span className="text-fg-secondary">{e.actor}</span>
              {e.projectId && (
                <span className="ml-2 text-fg-muted">· {e.projectId}</span>
              )}
            </div>
            {Object.keys(e.payload).length > 0 && (
              <div className="mt-1 truncate font-mono text-[11px] text-fg-muted">
                {JSON.stringify(e.payload)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: /api/activity endpoint**

Create `C:\Users\chath\command-center\app\api\activity\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, dataPath } from "@/lib/store";
import { ActivityLogFile } from "@/lib/schemas";

export async function GET() {
  try {
    const data = await readJson(dataPath("activity-log.json"), ActivityLogFile);
    return NextResponse.json(data);
  } catch {
    // activity-log.json is in .gitignore; if missing return empty
    return NextResponse.json({ events: [] });
  }
}
```

- [ ] **Step 3: Activity page**

Create `C:\Users\chath\command-center\app\activity\page.tsx`:
```tsx
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Activity</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Every event across the command center, newest first.
        </p>
      </div>
      <ActivityFeed />
    </div>
  );
}
```

- [ ] **Step 4: Smoke + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
# curl /activity and /api/activity
pnpm tsc --noEmit
pnpm test
git add app/activity/ app/api/activity/ components/activity/
git commit -m "feat(ui): Activity view + /api/activity endpoint"
```
Expected: 200, 0 errors, 42 tests, 56 commits.

---

## Task 7: Docs browser

**Files:**
- Create: `app/docs/page.tsx`
- Create: `app/api/docs/route.ts`

Read-only markdown browser over the command center's own docs + registered projects' CLAUDE.md + memory files.

- [ ] **Step 1: /api/docs endpoint**

Create `C:\Users\chath\command-center\app\api\docs\route.ts`:
```ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, dataPath } from "@/lib/store";
import { ProjectsFile } from "@/lib/schemas";

interface DocEntry {
  id: string;
  label: string;
  content: string;
  source: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const docId = url.searchParams.get("id");

  const entries: DocEntry[] = [];

  // Command center's own CLAUDE.md
  try {
    const cc = await fs.readFile(
      path.join(process.cwd(), "CLAUDE.md"),
      "utf-8"
    );
    entries.push({
      id: "cc-claude",
      label: "Command Center — CLAUDE.md",
      content: cc,
      source: "self",
    });
  } catch {
    // ignore
  }

  // Each registered project's CLAUDE.md
  const projectsData = await readJson(dataPath("projects.json"), ProjectsFile);
  for (const p of projectsData.projects) {
    if (p.detected.hasClaudeMd) {
      try {
        const content = await fs.readFile(
          path.join(p.path, "CLAUDE.md"),
          "utf-8"
        );
        entries.push({
          id: `${p.id}-claude`,
          label: `${p.name} — CLAUDE.md`,
          content,
          source: p.id,
        });
      } catch {
        // skip on failure
      }
    }
  }

  if (docId) {
    const doc = entries.find((e) => e.id === docId);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  }

  // Return just the index (no content) for listing
  return NextResponse.json({
    docs: entries.map((e) => ({ id: e.id, label: e.label, source: e.source })),
  });
}
```

- [ ] **Step 2: Docs page**

Create `C:\Users\chath\command-center\app\docs\page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

interface DocRef {
  id: string;
  label: string;
  source: string;
}

interface DocFull {
  id: string;
  label: string;
  content: string;
  source: string;
}

export default function DocsPage() {
  const [docs, setDocs] = useState<DocRef[]>([]);
  const [selected, setSelected] = useState<DocFull | null>(null);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((d) => {
        setDocs(d.docs);
        if (d.docs[0]) {
          fetch(`/api/docs?id=${encodeURIComponent(d.docs[0].id)}`)
            .then((r) => r.json())
            .then((doc) => setSelected(doc));
        }
      });
  }, []);

  async function openDoc(id: string) {
    const r = await fetch(`/api/docs?id=${encodeURIComponent(id)}`);
    setSelected(await r.json());
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Docs</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Markdown browser — command center docs + each project&apos;s CLAUDE.md.
        </p>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-4">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg-elevated p-2">
          {docs.length === 0 ? (
            <div className="p-3 text-[13px] text-fg-muted">No docs found.</div>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => openDoc(d.id)}
                className={`rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-bg-hover ${
                  selected?.id === d.id ? "bg-bg-hover text-fg-primary" : "text-fg-secondary"
                }`}
              >
                {d.label}
              </button>
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-6">
          {!selected ? (
            <div className="text-[13px] text-fg-muted">Select a doc.</div>
          ) : (
            <div>
              <div className="mb-4 text-[18px] font-semibold">{selected.label}</div>
              <pre className="overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-6 text-fg-secondary">
                {selected.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: we render as plain `<pre>` without a full markdown parser — good enough for Phase 4. A rich renderer is Phase 5 polish.

- [ ] **Step 3: Smoke + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
# curl /docs and /api/docs
pnpm tsc --noEmit
pnpm test
git add app/docs/ app/api/docs/
git commit -m "feat(ui): Docs browser with command center + project CLAUDE.md files"
```
Expected: 200, 0 errors, 42 tests, 57 commits.

---

## Task 8: `/standup` slash command

**Files:**
- Create: `.claude/commands/standup.md`

- [ ] **Step 1: Create the command**

Create `C:\Users\chath\command-center\.claude\commands\standup.md`:
```markdown
---
description: Generate a standup report per crew member — what I did / what I'm doing / what's blocked
allowed-tools: Read, Write, Edit, Bash
---

# /standup

You are Fluxy, invoked from inside the command center project directory.

## Steps

1. Read `data/tasks.json` and `data/crew.json`.
2. For each crew member, categorize their tasks:
   - **Doing**: tasks with `status: "in_progress"` assigned to them
   - **Up next**: tasks with `status: "todo"` and assignee = them, sorted by priority (crit → high → mid → low)
   - **Done this week**: tasks with `status: "done"` and `completedAt` within the last 7 days
   - **Blocked**: tasks where `blockedBy` has unresolved task ids (not in status "done")
3. Print a markdown report grouped by crew, concise (1-2 lines per task).
4. Append an activity event to `data/activity-log.json` with type `command_ran`, actor `human`, payload `{ command: "standup" }`.
5. Return the full markdown to the caller.

## Output format

```
## Standup — <date>

### Fluxy
- Doing: —
- Up next: D-007 (Activity feed, low)
- Done this week: —
- Blocked: —

### Cass
- Doing: D-001 (Kanban drag-drop, high)
- Up next: D-002 (Backlog table, mid), D-003 (Inbox 2-pane, mid)
- Done this week: —
- Blocked: —

…
```

Keep it under 500 words total.
```

- [ ] **Step 2: Commit**

```powershell
cd C:\Users\chath\command-center
git add .claude/commands/standup.md
git commit -m "feat(cmd): /standup — per-crew standup report"
```
Expected: 58 commits.

---

## Task 9: `/orchestrate` slash command

**Files:**
- Create: `.claude/commands/orchestrate.md`

- [ ] **Step 1: Create the command**

Create `C:\Users\chath\command-center\.claude\commands\orchestrate.md`:
```markdown
---
description: Auto-assign unassigned tasks to the best crew member by epic + title pattern
allowed-tools: Read, Write, Edit, Bash
---

# /orchestrate

You are Fluxy.

## Steps

1. Read `data/tasks.json`.
2. Find tasks where `assignee` is null or missing.
3. For each unassigned task, choose a crew member based on:
   - **Cass** (frontend/UI): if `epic === "Platform"` and title mentions CSS, layout, responsive, a11y, design, component, UI
   - **Supa** (backend/DB): if title mentions Supabase, API, database, migration, auth, sheets
   - **Bugsy** (debug/QA): if title mentions debug, bug, fix, regression, investigate
   - **Shield** (security/perf): if title mentions security, vulnerability, performance, bundle, profiling, a11y audit
   - **Scribe** (docs): if title mentions docs, report, learn, graphify
   - **Fluxy** (orchestrator): if it's planning / coordination / sprint
   - Fallback: Cass (most projects are UI-heavy)
4. For each assignment, PATCH the task via: `curl -X PATCH http://localhost:3000/api/tasks/<id> -H "content-type: application/json" -d '{"assignee":"<crewId>"}'` (or equivalent) — OR directly edit `data/tasks.json` and respect the Zod schema.
5. Post one inbox message from Fluxy → human titled "Orchestrate run — N tasks routed" with the list.
6. Append activity event `command_ran` with `{ command: "orchestrate", routed: N }`.
7. Return a summary table.

Only route if you're confident; if a task doesn't fit any pattern, leave it unassigned and note that in the report.
```

- [ ] **Step 2: Commit**

```powershell
cd C:\Users\chath\command-center
git add .claude/commands/orchestrate.md
git commit -m "feat(cmd): /orchestrate — auto-route unassigned tasks to crew"
```
Expected: 59 commits.

---

## Task 10: `/pick-up-work` + `/weekly-review` slash commands

**Files:**
- Create: `.claude/commands/pick-up-work.md`
- Create: `.claude/commands/weekly-review.md`

- [ ] **Step 1: pick-up-work**

Create `C:\Users\chath\command-center\.claude\commands\pick-up-work.md`:
```markdown
---
description: "I have N minutes — recommend 3 tasks to work on next"
argument-hint: [minutes]
allowed-tools: Read, Bash
---

# /pick-up-work

You are Fluxy.

Arguments: `$1` = optional minutes available (default: 30).

## Steps

1. Read `data/tasks.json`.
2. Filter to tasks where `status === "todo"` and `blockedBy` has no unresolved tasks.
3. Rank by a score:
   - Priority weight: crit=40, high=20, mid=10, low=5
   - Age bonus: +0.5 per day since createdAt (caps at +10)
   - If the task has an assignee, and the caller is acting as that assignee (check environment), add +5
4. Take the top 3. For each, show: ID, title, priority, estimate (or "—"), assignee, 1-line why.
5. Return a markdown list.

Keep output under 200 words.
```

- [ ] **Step 2: weekly-review**

Create `C:\Users\chath\command-center\.claude\commands\weekly-review.md`:
```markdown
---
description: Summarize the past 7 days — completed, new, blocked, trends
allowed-tools: Read, Write, Bash
---

# /weekly-review

You are Fluxy, producing a retrospective.

## Steps

1. Read `data/tasks.json`, `data/activity-log.json`, `data/inbox.json`.
2. Compute:
   - Tasks completed this week (status=done AND completedAt within 7 days)
   - Tasks created this week
   - Blocked tasks (blockedBy non-empty)
   - Spawn count this week (from activity-log type=spawn_started)
   - Unread messages
3. Break down per crew member.
4. Identify any tasks still in_progress for > 3 days (stale).
5. Write the report to `docs/weekly/<YYYY-MM-DD>.md` (create parent dir if missing).
6. Append activity event `command_ran` with `{ command: "weekly-review", path: "<file>" }`.
7. Return the path to the saved report + a 150-word summary.
```

- [ ] **Step 3: Commit both**

```powershell
cd C:\Users\chath\command-center
git add .claude/commands/
git commit -m "feat(cmd): /pick-up-work + /weekly-review slash commands"
```
Expected: 60 commits.

---

## Task 11: Light theme polish + a11y pass

**Files:**
- Modify: `app/globals.css` (if needed for light theme contrast tweaks)
- Modify: various components that may have hard-coded dark colors

- [ ] **Step 1: Audit pass**

Run the dev server in light mode (click theme toggle) and verify each route renders with sufficient contrast:

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Visit each route and confirm text is readable in light mode:
- `/`, `/sprint`, `/backlog`, `/skill-tree`, `/timeline`, `/pipeline`, `/activity`, `/crew`, `/crew/cass`, `/inbox`, `/projects`, `/projects/expense-tracker`, `/docs`

Known hot spots that may need tweaks:
- `PriorityBadge` uses dark-specific opacity tints (e.g. `bg-zinc-800/40`) — these may disappear in light mode
- `DraggableTaskCard` ghost opacity
- Status color text (blue-400, orange-400) on light bg
- Activity feed icon backgrounds

For each issue you spot, patch inline. Run `pnpm lint` at the end to ensure no warnings introduced.

Kill server.

- [ ] **Step 2: Priority badge — add light variants**

If the PriorityBadge's tints don't work in light mode, overwrite `C:\Users\chath\command-center\components\tasks\PriorityBadge.tsx` with theme-aware colors:
```tsx
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  low: "bg-zinc-500/20 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300",
  mid: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  high: "bg-orange-500/20 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  crit: "bg-red-500/20 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        STYLES[priority] ?? STYLES.mid
      )}
    >
      {priority}
    </span>
  );
}
```

- [ ] **Step 3: Status colors in BacklogTable**

In `C:\Users\chath\command-center\components\backlog\BacklogTable.tsx`, find the `STATUS_STYLES` constant and update to include dark variants:
```tsx
const STATUS_STYLES: Record<string, string> = {
  todo: "text-fg-muted",
  in_progress: "text-blue-700 dark:text-blue-400",
  review: "text-orange-700 dark:text-orange-400",
  done: "text-emerald-700 dark:text-emerald-400",
};
```

- [ ] **Step 4: A11y quick pass**

Verify these quickly (they should already be OK from earlier work):
- Every button has aria-label when icon-only (theme toggle, drawer close, run button)
- Links have visible text (not just icons)
- Focus rings visible — shadcn handles this, just confirm by tabbing through `/projects` and `/sprint`
- No color-only status indicators (our status cells have text, priority has text)

No changes expected unless you find a missing aria-label — if so, fix inline.

- [ ] **Step 5: Smoke test + commit**

```powershell
pnpm tsc --noEmit
pnpm test
pnpm lint
```
Expected: 0 errors, 42 tests, 0 lint errors.

```powershell
git add -A
git commit -m "feat(ui): light theme contrast + a11y pass"
```
Expected: 61 commits.

---

## Task 12: Cleanup + final smoke test

**Files:** none (verification + optional seed cleanup)

- [ ] **Step 1: Re-run seed to ensure demo data is fresh**

```powershell
cd C:\Users\chath\command-center
pnpm seed:demo
```

- [ ] **Step 2: Kill stale dev servers**

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
```

- [ ] **Step 3: Full checks**

```powershell
cd C:\Users\chath\command-center
pnpm test
pnpm tsc --noEmit
pnpm lint
```
Expected: 42 tests, 0 errors, 0 lint issues.

- [ ] **Step 4: Smoke test ALL routes**

```powershell
pnpm dev
```
Background. $PORT = noted port.

```powershell
$routes = @("/", "/sprint", "/backlog", "/skill-tree", "/timeline", "/pipeline", "/activity", "/crew", "/crew/cass", "/inbox", "/projects", "/projects/expense-tracker", "/docs")
foreach ($route in $routes) {
  $code = curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$route"
  Write-Host "$route -> $code"
}
```
Expected: all 13 routes → 200.

```powershell
$apis = @("/api/tasks", "/api/sprints", "/api/crew", "/api/projects", "/api/messages", "/api/skills", "/api/activity", "/api/docs")
foreach ($api in $apis) {
  $code = curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$api"
  Write-Host "$api -> $code"
}
```
Expected: all 8 APIs → 200.

Kill server.

- [ ] **Step 5: Note which task was deferred (if any)**

If a task during Phase 4 hit a snag and was skipped, report it. Otherwise proceed to tag.

---

## Task 13: Phase 4 tag

- [ ] **Step 1: Tag**

```powershell
cd C:\Users\chath\command-center
git commit --allow-empty -m "chore(phase-4): polish + memory + commands complete"
git tag phase-4-polish-memory-commands
git log --oneline | Select-Object -First 5
git tag
```

Expected: 4 tags: `phase-1-foundation`, `phase-2-views`, `phase-3-skill-tree-spawn`, `phase-4-polish-memory-commands`.

- [ ] **Step 2: Final Phase 4 summary**

Report:
- Total commits (expect ~62)
- Test count, tsc, lint
- All 13 page routes status
- All 8 API routes status
- All 4 tags
- claude-mem worker status
- Slash command count (`.claude/commands/*.md`) — expect 5 (`register-project` + 4 new)
- Crew role-agent count — expect 6
- Phase 4 acceptance:
  - [ ] claude-mem installed + worker responds 200 on :37777
  - [ ] Crew memory tab shows the link + status
  - [ ] Timeline renders per-crew swim lanes
  - [ ] Pipeline has 4 columns with drag
  - [ ] Activity feed shows events
  - [ ] Docs browser lists CC + project CLAUDE.md
  - [ ] Light theme renders all routes with no invisible text
  - [ ] 4 new slash commands present
  - [ ] phase-4 tag set
- Any concerns

---

## Phase 4 Done — the command center ships

When Phase 4 is complete, the command center is feature-complete against the original spec. All 10 views exist (Dashboard + 9 specific views + crew detail + project detail), all 5 API routes, SSE live updates, pixel avatars, spawn system, two memory layers (crew identity + claude-mem sessions), 4 high-value slash commands, and a polished light theme.

Future work (not in any current plan):
- Full markdown rendering in Docs browser (with react-markdown)
- Editing crew-memory files from the UI
- More slash commands (`/sprint-plan`, `/triage`, `/crew-retro`, `/skill-scan`)
- Multi-user support
- Cloud sync of `data/`
