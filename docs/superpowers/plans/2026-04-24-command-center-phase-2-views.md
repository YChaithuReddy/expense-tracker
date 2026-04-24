# Command Center — Phase 2: Core Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the command center to life — Sprint Kanban board, Backlog table, Crew roster + detail pages, Inbox, task CRUD dialogs, and SSE live-updates. At the end of Phase 2, you can create tasks, drag them between statuses on a Kanban board, read crew members' memory, and watch the board react in real time as state changes.

**Architecture:** Phase 2 adds 5 new API routes, 1 SSE endpoint, 4 page routes, task CRUD dialogs, and a Kanban board powered by `@dnd-kit`. All views fetch from `/api/*` routes and subscribe to SSE for live updates via a shared React context.

**Tech Stack additions:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `date-fns` for date formatting.

**Prereqs:**
- Phase 1 complete (git tag `phase-1-foundation` exists at `C:\Users\chath\command-center\`)
- Dev server runs at `pnpm dev`
- 25 Vitest tests pass
- Expense tracker registered in `data/projects.json`

**Out of scope for Phase 2** (covered in Phase 3+):
- Skill Tree graph view
- Pixel avatars (use initials + crew color for now)
- Timeline / Pipeline / Activity views (Pipeline is simple-enough we include it; Timeline/Activity deferred)
- `/api/spawn` and crew role-agent files
- Light theme polish / a11y pass / Docs view
- Crew-memory editing from UI (read-only display only)

**Expected duration:** 3 days.

---

## Task 1: Install Phase 2 dependencies

**Files:** modify `package.json`.

- [ ] **Step 1: Install @dnd-kit and date-fns**

```powershell
cd C:\Users\chath\command-center
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns
```

Expected: 4 packages added to `dependencies`. No peer dep errors.

- [ ] **Step 2: Verify no install errors**

```powershell
pnpm install
```
Expected: "Lockfile is up to date" or quick-finish.

- [ ] **Step 3: Commit**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: add @dnd-kit + date-fns for Phase 2"
```

---

## Task 2: Create `/api/crew` GET route

**Files:**
- Create: `app/api/crew/route.ts`
- Create: `tests/api-crew.test.ts`

- [ ] **Step 1: Write failing test**

Create `C:\Users\chath\command-center\tests\api-crew.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GET } from "@/app/api/crew/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-crew-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "crew.json"),
    JSON.stringify({
      crew: [
        {
          id: "fluxy",
          name: "Fluxy",
          role: "Orchestrator",
          tagline: "x",
          avatar: "/avatars/fluxy.png",
          color: "#8b5cf6",
          delegates: [],
          skills: [],
          stats: { tasksCompleted: 0, hoursActive: 0 },
        },
      ],
    })
  );
  process.chdir(tmpDir);
});

describe("/api/crew", () => {
  it("GET returns seeded crew", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].id).toBe("fluxy");
  });
});
```

- [ ] **Step 2: Verify failure**

```powershell
pnpm test -- tests/api-crew.test.ts
```
Expected: FAIL — no `@/app/api/crew/route`.

- [ ] **Step 3: Implement**

Create `C:\Users\chath\command-center\app\api\crew\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, dataPath } from "@/lib/store";
import { CrewFile } from "@/lib/schemas";

export async function GET() {
  const data = await readJson(dataPath("crew.json"), CrewFile);
  return NextResponse.json(data);
}
```

- [ ] **Step 4: Verify passing**

```powershell
pnpm test -- tests/api-crew.test.ts
```
Expected: 1 passed.

- [ ] **Step 5: Commit**

```powershell
git add app/api/crew/ tests/api-crew.test.ts
git commit -m "feat(api): /api/crew GET"
```

---

## Task 3: Create `/api/tasks` GET + POST

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `tests/api-tasks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `C:\Users\chath\command-center\tests\api-tasks.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GET, POST } from "@/app/api/tasks/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-tasks-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "tasks.json"),
    JSON.stringify({ tasks: [] })
  );
  process.chdir(tmpDir);
});

describe("/api/tasks", () => {
  it("GET returns empty list initially", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.tasks).toEqual([]);
  });

  it("POST creates a task with auto-generated D-XXX id", async () => {
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "expense-tracker",
        title: "Test task",
        description: "Body",
        epic: "Platform",
        priority: "mid",
        assignee: "cass",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.id).toMatch(/^D-\d+$/);
    expect(task.status).toBe("todo");
    expect(task.pipelineStage).toBe("plan");
    expect(task.collaborators).toEqual([]);
    expect(task.blockedBy).toEqual([]);
    expect(task.spawnHistory).toEqual([]);
  });

  it("POST assigns sequential D-001, D-002 ids", async () => {
    const makeReq = (title: string) =>
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "expense-tracker",
          title,
          description: "",
          epic: "Platform",
          priority: "mid",
        }),
      });
    const r1 = await POST(makeReq("First"));
    const r2 = await POST(makeReq("Second"));
    const t1 = await r1.json();
    const t2 = await r2.json();
    expect(t1.id).toBe("D-001");
    expect(t2.id).toBe("D-002");
  });

  it("POST rejects payload missing required fields", async () => {
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "incomplete" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verify failure**

```powershell
pnpm test -- tests/api-tasks.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `C:\Users\chath\command-center\app\api\tasks\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, writeJson, dataPath } from "@/lib/store";
import {
  TasksFile,
  Task,
  type TaskT,
  TaskEpic,
  TaskPriority,
  CrewId,
} from "@/lib/schemas";
import { eventBus } from "@/lib/events";
import { z } from "zod";

const CreateTaskBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  epic: TaskEpic,
  priority: TaskPriority,
  assignee: CrewId.optional(),
  collaborators: z.array(CrewId).default([]),
  sprint: z.string().optional(),
  estimate: z.number().nonnegative().optional(),
});

export async function GET() {
  const data = await readJson(dataPath("tasks.json"), TasksFile);
  return NextResponse.json(data);
}

function nextId(existing: TaskT[]): string {
  const maxNum = existing.reduce((acc, t) => {
    const m = t.id.match(/^D-(\d+)$/);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `D-${String(maxNum + 1).padStart(3, "0")}`;
}

export async function POST(req: Request) {
  let body: z.infer<typeof CreateTaskBody>;
  try {
    body = CreateTaskBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: String(err) },
      { status: 400 }
    );
  }

  const tasksPath = dataPath("tasks.json");
  const current = await readJson(tasksPath, TasksFile);
  const now = new Date().toISOString();

  const newTask: TaskT = Task.parse({
    id: nextId(current.tasks),
    projectId: body.projectId,
    title: body.title,
    description: body.description,
    epic: body.epic,
    status: "todo",
    assignee: body.assignee,
    collaborators: body.collaborators,
    priority: body.priority,
    sprint: body.sprint,
    pipelineStage: "plan",
    blockedBy: [],
    estimate: body.estimate,
    createdAt: now,
    updatedAt: now,
    spawnHistory: [],
  });

  const next = { tasks: [...current.tasks, newTask] };
  await writeJson(tasksPath, TasksFile, next);
  eventBus.fire({
    type: "task_created",
    payload: { id: newTask.id, projectId: newTask.projectId },
  });

  return NextResponse.json(newTask, { status: 201 });
}
```

- [ ] **Step 4: Verify passing**

```powershell
pnpm test -- tests/api-tasks.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```powershell
git add app/api/tasks/ tests/api-tasks.test.ts
git commit -m "feat(api): /api/tasks GET + POST with auto-incrementing D-XXX id"
```

---

## Task 4: Create `/api/tasks/[id]` PATCH + DELETE

**Files:**
- Create: `app/api/tasks/[id]/route.ts`
- Append tests to: `tests/api-tasks.test.ts`

- [ ] **Step 1: Implement route**

Create `C:\Users\chath\command-center\app\api\tasks\[id]\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, writeJson, dataPath } from "@/lib/store";
import { TasksFile, TaskStatus, TaskPriority, CrewId, PipelineStage } from "@/lib/schemas";
import { eventBus } from "@/lib/events";
import { z } from "zod";

const PatchTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: TaskStatus.optional(),
  assignee: CrewId.optional().nullable(),
  collaborators: z.array(CrewId).optional(),
  priority: TaskPriority.optional(),
  sprint: z.string().optional().nullable(),
  pipelineStage: PipelineStage.optional(),
  estimate: z.number().nonnegative().optional().nullable(),
  blockedBy: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await readJson(dataPath("tasks.json"), TasksFile);
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let patch: z.infer<typeof PatchTaskBody>;
  try {
    patch = PatchTaskBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: String(err) },
      { status: 400 }
    );
  }

  const tasksPath = dataPath("tasks.json");
  const data = await readJson(tasksPath, TasksFile);
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = data.tasks[idx];
  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== null)
    ),
    updatedAt: now,
    completedAt:
      patch.status === "done" && existing.status !== "done"
        ? now
        : existing.completedAt,
  };

  data.tasks[idx] = updated as typeof existing;
  await writeJson(tasksPath, TasksFile, data);

  const eventType =
    patch.status && patch.status !== existing.status
      ? "task_moved"
      : "task_updated";
  eventBus.fire({
    type: eventType,
    payload: { id, changes: patch },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasksPath = dataPath("tasks.json");
  const data = await readJson(tasksPath, TasksFile);
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await writeJson(tasksPath, TasksFile, data);
  eventBus.fire({ type: "task_updated", payload: { id, deleted: true } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Append tests**

Add these test cases at the end of `C:\Users\chath\command-center\tests\api-tasks.test.ts` (inside the existing `describe` block):

```ts
import { GET as getOne, PATCH, DELETE } from "@/app/api/tasks/[id]/route";

describe("/api/tasks/[id]", () => {
  async function createOne() {
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "p",
        title: "T",
        description: "",
        epic: "Platform",
        priority: "mid",
      }),
    });
    return (await POST(req).then((r) => r.json())).id as string;
  }

  it("GET returns existing task", async () => {
    const id = await createOne();
    const res = await getOne(new Request("http://x"), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
  });

  it("PATCH updates status and sets completedAt when done", async () => {
    const id = await createOne();
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id }) }
    );
    const task = await res.json();
    expect(task.status).toBe("done");
    expect(task.completedAt).toBeDefined();
  });

  it("DELETE removes the task", async () => {
    const id = await createOne();
    await DELETE(new Request("http://x"), {
      params: Promise.resolve({ id }),
    });
    const after = await GET();
    const body = await after.json();
    expect(body.tasks.find((t: { id: string }) => t.id === id)).toBeUndefined();
  });

  it("PATCH 404 on missing id", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "D-999" }) }
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Verify passing**

```powershell
pnpm test -- tests/api-tasks.test.ts
```
Expected: 8 passed (4 original + 4 new).

- [ ] **Step 4: Commit**

```powershell
git add app/api/tasks/[id]/ tests/api-tasks.test.ts
git commit -m "feat(api): /api/tasks/[id] GET/PATCH/DELETE with task_moved events"
```

---

## Task 5: Create `/api/sprints` GET + POST

**Files:**
- Create: `app/api/sprints/route.ts`
- Create: `tests/api-sprints.test.ts`

- [ ] **Step 1: Write test**

Create `C:\Users\chath\command-center\tests\api-sprints.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GET, POST } from "@/app/api/sprints/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-sprints-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "sprints.json"),
    JSON.stringify({ sprints: [] })
  );
  process.chdir(tmpDir);
});

describe("/api/sprints", () => {
  it("GET returns empty initially", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.sprints).toEqual([]);
  });

  it("POST creates a sprint", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "Wk13",
        name: "Sprint — Wk13",
        subtitle: "Agent deployments",
        startDate: "2026-04-21",
        endDate: "2026-04-27",
        goal: "Ship the thing",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const sprint = await res.json();
    expect(sprint.status).toBe("planning");
  });
});
```

- [ ] **Step 2: Implement**

Create `C:\Users\chath\command-center\app\api\sprints\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, writeJson, dataPath } from "@/lib/store";
import { SprintsFile, Sprint, type SprintT } from "@/lib/schemas";
import { z } from "zod";

const CreateSprintBody = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().default(""),
  startDate: z.string(),
  endDate: z.string(),
  goal: z.string().default(""),
});

export async function GET() {
  const data = await readJson(dataPath("sprints.json"), SprintsFile);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  let body: z.infer<typeof CreateSprintBody>;
  try {
    body = CreateSprintBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: String(err) },
      { status: 400 }
    );
  }

  const sprintsPath = dataPath("sprints.json");
  const current = await readJson(sprintsPath, SprintsFile);

  if (current.sprints.some((s) => s.id === body.id)) {
    return NextResponse.json(
      { error: "Sprint id already exists" },
      { status: 409 }
    );
  }

  const newSprint: SprintT = Sprint.parse({
    id: body.id,
    name: body.name,
    subtitle: body.subtitle,
    startDate: body.startDate,
    endDate: body.endDate,
    status: "planning",
    goal: body.goal,
    stats: { todo: 0, inProgress: 0, review: 0, done: 0 },
  });

  const next = { sprints: [...current.sprints, newSprint] };
  await writeJson(sprintsPath, SprintsFile, next);

  return NextResponse.json(newSprint, { status: 201 });
}
```

- [ ] **Step 3: Verify + Commit**

```powershell
pnpm test -- tests/api-sprints.test.ts
git add app/api/sprints/ tests/api-sprints.test.ts
git commit -m "feat(api): /api/sprints GET + POST"
```

---

## Task 6: Create `/api/messages` GET + POST (inbox)

**Files:**
- Create: `app/api/messages/route.ts`
- Create: `tests/api-messages.test.ts`

- [ ] **Step 1: Write test**

Create `C:\Users\chath\command-center\tests\api-messages.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GET, POST } from "@/app/api/messages/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-msg-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "inbox.json"),
    JSON.stringify({ messages: [] })
  );
  process.chdir(tmpDir);
});

describe("/api/messages", () => {
  it("GET returns empty initially", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toEqual([]);
  });

  it("POST creates a message with auto-id + unread status", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "cass",
        to: "human",
        type: "question",
        subject: "Need direction",
        body: "What should I do?",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const msg = await res.json();
    expect(msg.id).toMatch(/^msg-/);
    expect(msg.status).toBe("unread");
  });
});
```

- [ ] **Step 2: Implement**

Create `C:\Users\chath\command-center\app\api\messages\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, writeJson, dataPath } from "@/lib/store";
import { InboxFile, InboxMessage } from "@/lib/schemas";
import { eventBus } from "@/lib/events";
import { z } from "zod";

const CreateMessageBody = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["question", "report", "delegation", "decision"]),
  taskId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().default(""),
});

export async function GET() {
  const data = await readJson(dataPath("inbox.json"), InboxFile);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  let body: z.infer<typeof CreateMessageBody>;
  try {
    body = CreateMessageBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: String(err) },
      { status: 400 }
    );
  }

  const inboxPath = dataPath("inbox.json");
  const current = await readJson(inboxPath, InboxFile);

  const newMessage = InboxMessage.parse({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: body.from,
    to: body.to,
    type: body.type,
    taskId: body.taskId,
    subject: body.subject,
    body: body.body,
    status: "unread",
    createdAt: new Date().toISOString(),
  });

  const next = { messages: [...current.messages, newMessage] };
  await writeJson(inboxPath, InboxFile, next);
  eventBus.fire({ type: "message_sent", payload: { id: newMessage.id } });

  return NextResponse.json(newMessage, { status: 201 });
}
```

- [ ] **Step 3: Verify + Commit**

```powershell
pnpm test -- tests/api-messages.test.ts
git add app/api/messages/ tests/api-messages.test.ts
git commit -m "feat(api): /api/messages GET + POST for inbox"
```

---

## Task 7: SSE endpoint `/api/events`

**Files:**
- Create: `app/api/events/route.ts`

**Note:** SSE (Server-Sent Events) is a one-way stream from server to client. We expose a `GET /api/events` endpoint that keeps the connection open and pushes an event every time `eventBus.fire()` is called server-side. In dev mode Turbopack may hot-reload server modules — expect the stream to occasionally disconnect during development; the client will reconnect automatically.

- [ ] **Step 1: Implement SSE route**

Create `C:\Users\chath\command-center\app\api\events\route.ts`:
```ts
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream may be closed — ignore.
        }
      };

      // Send a hello ping so clients know the connection is open
      send({ type: "connected", payload: {} });

      const unsubscribe = eventBus.subscribe((event) => send(event));

      // Heartbeat every 15s to keep the connection alive through proxies
      const heartbeat = setInterval(() => send({ type: "heartbeat", payload: {} }), 15_000);

      // The Request's signal abort fires when client disconnects
      return () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server in background. Then:
```powershell
curl -N "http://localhost:3000/api/events"
```

Expected: within 1 second you see `data: {"type":"connected","payload":{}}`. Leave for 15-20 seconds — a `data: {"type":"heartbeat","payload":{}}` should appear. Cancel with Ctrl+C.

If the route doesn't stream (e.g., buffers and only flushes at the end), the `X-Accel-Buffering: no` header and `dynamic = "force-dynamic"` may need a Next.js 15.5 adjustment — report what you see.

Kill dev server.

- [ ] **Step 3: Commit**

```powershell
git add app/api/events/
git commit -m "feat(api): /api/events SSE stream via eventBus"
```

---

## Task 8: `useEvents` React hook for SSE subscription

**Files:**
- Create: `components/providers/EventsProvider.tsx`
- Create: `lib/use-events.ts`

- [ ] **Step 1: Build the events provider**

Create `C:\Users\chath\command-center\components\providers\EventsProvider.tsx`:
```tsx
"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

export interface ClientEvent {
  type: string;
  payload: Record<string, unknown>;
}

type Listener = (event: ClientEvent) => void;

interface EventsContextT {
  subscribe: (fn: Listener) => () => void;
}

const EventsContext = createContext<EventsContextT | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      try {
        const parsed: ClientEvent = JSON.parse(ev.data);
        for (const fn of listeners.current) fn(parsed);
      } catch {
        // ignore malformed payloads
      }
    };
    es.onerror = () => {
      // EventSource reconnects automatically
    };
    return () => es.close();
  }, []);

  const subscribe: EventsContextT["subscribe"] = (fn) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  };

  return (
    <EventsContext.Provider value={{ subscribe }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEventsContext() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEventsContext must be used within EventsProvider");
  return ctx;
}
```

- [ ] **Step 2: Build the hook**

Create `C:\Users\chath\command-center\lib\use-events.ts`:
```ts
"use client";

import { useEffect } from "react";
import { useEventsContext, type ClientEvent } from "@/components/providers/EventsProvider";

export function useEvents(
  eventTypes: string[],
  onEvent: (event: ClientEvent) => void
) {
  const { subscribe } = useEventsContext();
  useEffect(() => {
    return subscribe((e) => {
      if (eventTypes.includes(e.type)) onEvent(e);
    });
  }, [subscribe, eventTypes, onEvent]);
}
```

- [ ] **Step 3: Wire EventsProvider into the root layout**

Modify `C:\Users\chath\command-center\app\layout.tsx` to wrap everything in EventsProvider:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { EventsProvider } from "@/components/providers/EventsProvider";
import { AppShell } from "@/components/app-shell/AppShell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Command Center",
  description: "Mission control for your Claude Code crew",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-bg-base text-fg-primary antialiased`}>
        <ThemeProvider>
          <EventsProvider>
            <AppShell>{children}</AppShell>
          </EventsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Preserve the existing imports for Geist fonts etc.

- [ ] **Step 4: Smoke test**

```powershell
pnpm dev
```
Background. Navigate to http://localhost:3000 via curl and check status 200. Watch BashOutput for any client-side errors about `EventSource` (Node's dev server renders client components differently). No errors expected because EventsProvider is marked `"use client"`.

Kill server.

- [ ] **Step 5: Commit**

```powershell
git add components/providers/EventsProvider.tsx lib/use-events.ts app/layout.tsx
git commit -m "feat(ui): EventsProvider + useEvents hook subscribes to SSE"
```

---

## Task 9: Shared TaskCard component

**Files:**
- Create: `components/tasks/TaskCard.tsx`
- Create: `components/tasks/PriorityBadge.tsx`
- Create: `components/tasks/CrewAvatar.tsx`

**Note:** These components are shared between Sprint, Backlog, and Pipeline views.

- [ ] **Step 1: CrewAvatar component**

Create `C:\Users\chath\command-center\components\tasks\CrewAvatar.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { CrewIdT } from "@/lib/schemas";

const CACHE: Map<string, string> = new Map();

export function CrewAvatar({
  id,
  size = 24,
}: {
  id?: CrewIdT;
  size?: number;
}) {
  const [color, setColor] = useState<string>(CACHE.get(id ?? "") ?? "#52525b");
  const [initial, setInitial] = useState<string>(id ? id[0].toUpperCase() : "?");

  useEffect(() => {
    if (!id) return;
    if (CACHE.has(id)) {
      setColor(CACHE.get(id)!);
      return;
    }
    fetch("/api/crew")
      .then((r) => r.json())
      .then((data) => {
        const member = data.crew.find((c: { id: string; color: string; name: string }) => c.id === id);
        if (member) {
          CACHE.set(id, member.color);
          setColor(member.color);
          setInitial(member.name[0].toUpperCase());
        }
      });
  }, [id]);

  if (!id) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-fg-muted"
        style={{ width: size, height: size }}
        aria-label="Unassigned"
      >
        —
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-label={`Crew: ${id}`}
    >
      {initial}
    </div>
  );
}
```

- [ ] **Step 2: PriorityBadge component**

Create `C:\Users\chath\command-center\components\tasks\PriorityBadge.tsx`:
```tsx
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  low: "bg-zinc-800/40 text-zinc-300",
  mid: "bg-blue-500/10 text-blue-300",
  high: "bg-orange-500/15 text-orange-300",
  crit: "bg-red-500/15 text-red-300",
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

- [ ] **Step 3: TaskCard component**

Create `C:\Users\chath\command-center\components\tasks\TaskCard.tsx`:
```tsx
"use client";

import type { TaskT } from "@/lib/schemas";
import { CrewAvatar } from "./CrewAvatar";
import { PriorityBadge } from "./PriorityBadge";

export function TaskCard({
  task,
  onClick,
  compact = false,
}: {
  task: TaskT;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3 text-left transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-glow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-fg-muted">{task.id}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="text-[14px] font-medium leading-tight">{task.title}</div>
      {!compact && task.description && (
        <div className="line-clamp-2 text-[12px] text-fg-muted">
          {task.description}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-fg-muted">{task.epic}</span>
        <CrewAvatar id={task.assignee} />
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add components/tasks/
git commit -m "feat(ui): shared TaskCard + CrewAvatar + PriorityBadge"
```

---

## Task 10: Task creation dialog

**Files:**
- Create: `components/tasks/CreateTaskDialog.tsx`

- [ ] **Step 1: Build the dialog**

Create `C:\Users\chath\command-center\components\tasks\CreateTaskDialog.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrewMemberT, ProjectT } from "@/lib/schemas";

const EPICS = ["Business", "Content", "Platform", "Product", "Operations", "Course", "Personal"] as const;
const PRIORITIES = ["low", "mid", "high", "crit"] as const;

export function CreateTaskDialog({
  sprint,
  onCreated,
  triggerLabel = "+ New",
}: {
  sprint?: string;
  onCreated?: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [crew, setCrew] = useState<CrewMemberT[]>([]);
  const [projects, setProjects] = useState<ProjectT[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epic, setEpic] = useState<(typeof EPICS)[number]>("Platform");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("mid");
  const [assignee, setAssignee] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/crew").then((r) => r.json()).then((d) => setCrew(d.crew));
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      setProjects(d.projects);
      if (!projectId && d.projects[0]) setProjectId(d.projects[0].id);
    });
  }, [open, projectId]);

  async function submit() {
    if (!projectId) {
      setError("Select a project first");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description,
        epic,
        priority,
        assignee,
        sprint,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to create");
      return;
    }
    setOpen(false);
    setTitle("");
    setDescription("");
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fix CSS cascade for expense card hover"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-[14px] outline-none focus:border-border-glow"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Assignee</Label>
              <Select value={assignee ?? "__unassigned"} onValueChange={(v) => setAssignee(v === "__unassigned" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
                  {crew.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Epic</Label>
              <Select value={epic} onValueChange={(v) => setEpic(v as typeof epic)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EPICS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-status-error/40 bg-status-error/10 p-3 text-[12px] text-status-error">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title || submitting}>
            {submitting ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add components/tasks/CreateTaskDialog.tsx
git commit -m "feat(ui): CreateTaskDialog with project + crew + epic + priority selectors"
```

---

## Task 11: Sprint Kanban board

**Files:**
- Create: `app/sprint/page.tsx`
- Create: `components/sprint/KanbanBoard.tsx`
- Create: `components/sprint/KanbanColumn.tsx`
- Create: `components/sprint/DraggableTaskCard.tsx`
- Create: `scripts/seed-demo.ts`

- [ ] **Step 1: Seed a demo sprint + 8 demo tasks**

Create `C:\Users\chath\command-center\scripts\seed-demo.ts`:
```ts
/* Seeds demo sprint (Wk13) and 8 example tasks so the Kanban has content.
 * Run: pnpm tsx scripts/seed-demo.ts
 */
import path from "node:path";
import { readJson, writeJson } from "../lib/store";
import { SprintsFile, TasksFile } from "../lib/schemas";

const DATA = path.join(process.cwd(), "data");

async function main() {
  const sprintsPath = path.join(DATA, "sprints.json");
  const sprints = await readJson(sprintsPath, SprintsFile);
  if (!sprints.sprints.some((s) => s.id === "Wk13")) {
    sprints.sprints.push({
      id: "Wk13",
      name: "Sprint — Wk13",
      subtitle: "Boot the command center",
      startDate: "2026-04-21",
      endDate: "2026-04-27",
      status: "active",
      goal: "Ship Phase 2 core views",
      stats: { todo: 0, inProgress: 0, review: 0, done: 0 },
    });
    await writeJson(sprintsPath, SprintsFile, sprints);
  }

  const tasksPath = path.join(DATA, "tasks.json");
  const tasks = await readJson(tasksPath, TasksFile);
  if (tasks.tasks.length > 0) {
    console.log("Tasks already seeded, skipping.");
    return;
  }
  const now = new Date().toISOString();
  const demo: TasksFile["_type"] extends never ? never : Parameters<typeof TasksFile.parse>[0]["tasks"] = [
    { id: "D-001", projectId: "expense-tracker", title: "Kanban board drag-drop", description: "", epic: "Platform" as const, status: "in_progress" as const, assignee: "cass" as const, collaborators: [], priority: "high" as const, sprint: "Wk13", pipelineStage: "build" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-002", projectId: "expense-tracker", title: "Backlog sortable table", description: "", epic: "Platform" as const, status: "todo" as const, assignee: "cass" as const, collaborators: [], priority: "mid" as const, sprint: "Wk13", pipelineStage: "plan" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-003", projectId: "expense-tracker", title: "Inbox 2-pane view", description: "", epic: "Platform" as const, status: "todo" as const, assignee: "cass" as const, collaborators: [], priority: "mid" as const, sprint: "Wk13", pipelineStage: "plan" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-004", projectId: "expense-tracker", title: "Crew roster cards", description: "", epic: "Platform" as const, status: "review" as const, assignee: "cass" as const, collaborators: [], priority: "mid" as const, sprint: "Wk13", pipelineStage: "test" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-005", projectId: "expense-tracker", title: "SSE live updates", description: "", epic: "Platform" as const, status: "done" as const, assignee: "supa" as const, collaborators: [], priority: "high" as const, sprint: "Wk13", pipelineStage: "ship" as const, blockedBy: [], completedAt: now, createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-006", projectId: "expense-tracker", title: "Task CRUD dialogs", description: "", epic: "Platform" as const, status: "done" as const, assignee: "supa" as const, collaborators: [], priority: "mid" as const, sprint: "Wk13", pipelineStage: "ship" as const, blockedBy: [], completedAt: now, createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-007", projectId: "expense-tracker", title: "Activity live feed", description: "", epic: "Content" as const, status: "todo" as const, collaborators: [], priority: "low" as const, sprint: "Wk13", pipelineStage: "plan" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
    { id: "D-008", projectId: "expense-tracker", title: "Pipeline stage view", description: "", epic: "Platform" as const, status: "in_progress" as const, assignee: "bugsy" as const, collaborators: [], priority: "low" as const, sprint: "Wk13", pipelineStage: "build" as const, blockedBy: [], createdAt: now, updatedAt: now, spawnHistory: [] },
  ] as unknown as Parameters<typeof TasksFile.parse>[0]["tasks"];

  await writeJson(tasksPath, TasksFile, { tasks: demo });
  console.log(`Seeded Wk13 sprint + ${demo.length} demo tasks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add script to `package.json`:
```json
"seed:demo": "tsx scripts/seed-demo.ts"
```

Run:
```powershell
cd C:\Users\chath\command-center
pnpm seed:demo
```

Expected: `Seeded Wk13 sprint + 8 demo tasks`.

- [ ] **Step 2: DraggableTaskCard component**

Create `C:\Users\chath\command-center\components\sprint\DraggableTaskCard.tsx`:
```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TaskT } from "@/lib/schemas";
import { TaskCard } from "@/components/tasks/TaskCard";

export function DraggableTaskCard({
  task,
  onClick,
}: {
  task: TaskT;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard task={task} onClick={onClick} compact />
    </div>
  );
}
```

- [ ] **Step 3: KanbanColumn component**

Create `C:\Users\chath\command-center\components\sprint\KanbanColumn.tsx`:
```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  todo: "TODO",
  in_progress: "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

export function KanbanColumn({
  status,
  count,
  children,
}: {
  status: "todo" | "in_progress" | "review" | "done";
  count: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
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
          {LABEL[status]}
        </span>
        <span className="text-[11px] text-fg-muted">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: KanbanBoard component**

Create `C:\Users\chath\command-center\components\sprint\KanbanBoard.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { TaskT } from "@/lib/schemas";
import { KanbanColumn } from "./KanbanColumn";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useEvents } from "@/lib/use-events";

const STATUSES = ["todo", "in_progress", "review", "done"] as const;
type Status = (typeof STATUSES)[number];

export function KanbanBoard({ sprint }: { sprint?: string }) {
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [active, setActive] = useState<TaskT | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const reload = useCallback(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        const filtered = sprint
          ? d.tasks.filter((t: TaskT) => t.sprint === sprint)
          : d.tasks;
        setTasks(filtered);
      });
  }, [sprint]);

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
    const newStatus = e.over?.id as Status | undefined;
    if (!newStatus || !STATUSES.includes(newStatus)) return;
    const taskId = e.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) reload();
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <KanbanColumn key={status} status={status} count={column.length}>
              {column.map((task) => (
                <DraggableTaskCard key={task.id} task={task} />
              ))}
            </KanbanColumn>
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

- [ ] **Step 5: Sprint page**

Create `C:\Users\chath\command-center\app\sprint\page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/sprint/KanbanBoard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import type { SprintT } from "@/lib/schemas";

export default function SprintPage() {
  const [sprints, setSprints] = useState<SprintT[]>([]);
  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/sprints")
      .then((r) => r.json())
      .then((d) => {
        setSprints(d.sprints);
        const active = d.sprints.find((s: SprintT) => s.status === "active");
        setSelected(active?.id ?? d.sprints[0]?.id);
      });
  }, []);

  const current = sprints.find((s) => s.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold leading-tight">
              {current?.name ?? "Sprint"}
            </h1>
            {sprints.length > 1 && (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-[12px]"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
            )}
          </div>
          {current && (
            <p className="mt-1 text-[14px] text-fg-secondary">{current.subtitle}</p>
          )}
        </div>
        <CreateTaskDialog sprint={selected} />
      </div>
      <KanbanBoard sprint={selected} />
    </div>
  );
}
```

- [ ] **Step 6: Smoke test**

```powershell
pnpm dev
```
Background. Navigate to `http://localhost:3000/sprint`. Expected: 200. Check BashOutput for compile errors. If the board renders blank, check browser console via curl that /api/tasks returns the seed data.

Kill server.

- [ ] **Step 7: Commit**

```powershell
git add app/sprint/ components/sprint/ scripts/seed-demo.ts package.json
git commit -m "feat(ui): Sprint Kanban board with @dnd-kit drag-drop"
```

---

## Task 12: Backlog sortable table

**Files:**
- Create: `app/backlog/page.tsx`
- Create: `components/backlog/BacklogTable.tsx`

- [ ] **Step 1: BacklogTable component**

Create `C:\Users\chath\command-center\components\backlog\BacklogTable.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { CrewAvatar } from "@/components/tasks/CrewAvatar";
import { useEvents } from "@/lib/use-events";
import type { CrewIdT, TaskT } from "@/lib/schemas";

const STATUS_STYLES: Record<string, string> = {
  todo: "text-fg-muted",
  in_progress: "text-blue-400",
  review: "text-orange-400",
  done: "text-emerald-400",
};

export function BacklogTable() {
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [search, setSearch] = useState("");
  const [epic, setEpic] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const reload = useCallback(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks));
  }, []);

  useEffect(() => reload(), [reload]);

  useEvents(
    ["task_created", "task_updated", "task_moved"],
    useCallback(() => reload(), [reload])
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (epic !== "all" && t.epic !== epic) return false;
      if (status !== "all" && t.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, search, epic, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search id or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={epic}
          onChange={(e) => setEpic(e.target.value)}
          className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
        >
          <option value="all">All epics</option>
          {["Business", "Content", "Platform", "Product", "Operations", "Course", "Personal"].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
        >
          <option value="all">All statuses</option>
          <option value="todo">TODO</option>
          <option value="in_progress">IN PROGRESS</option>
          <option value="review">REVIEW</option>
          <option value="done">DONE</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-6 text-fg-secondary">
          No tasks match your filters.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead className="w-24">Epic</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Assignee</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-24">Sprint</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-[12px] text-fg-muted">{t.id}</TableCell>
                <TableCell className="text-[12px]">{t.epic}</TableCell>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell className={`text-[11px] uppercase tracking-widest ${STATUS_STYLES[t.status]}`}>
                  {t.status.replace("_", " ")}
                </TableCell>
                <TableCell>
                  <CrewAvatar id={t.assignee as CrewIdT | undefined} size={20} />
                </TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className="text-[12px] text-fg-muted">{t.sprint ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Backlog page**

Create `C:\Users\chath\command-center\app\backlog\page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { BacklogTable } from "@/components/backlog/BacklogTable";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

export default function BacklogPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight">Backlog</h1>
          <p className="mt-1 text-[14px] text-fg-secondary">
            Every task across every project.
          </p>
        </div>
        <CreateTaskDialog onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <BacklogTable key={refreshKey} />
    </div>
  );
}
```

- [ ] **Step 3: Smoke test + commit**

```powershell
pnpm dev
# navigate to /backlog, verify 200
git add app/backlog/ components/backlog/
git commit -m "feat(ui): Backlog page with filter + search + live updates"
```

---

## Task 13: Crew roster + detail page

**Files:**
- Create: `app/crew/page.tsx`
- Create: `app/crew/[id]/page.tsx`
- Create: `components/crew/CrewCard.tsx`
- Create: `components/crew/CrewMemoryView.tsx`

- [ ] **Step 1: CrewCard component**

Create `C:\Users\chath\command-center\components\crew\CrewCard.tsx`:
```tsx
import Link from "next/link";
import type { CrewMemberT } from "@/lib/schemas";

export function CrewCard({ crew }: { crew: CrewMemberT }) {
  const initial = crew.name[0].toUpperCase();
  return (
    <Link
      href={`/crew/${crew.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 transition-colors hover:bg-bg-hover"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-semibold text-white"
          style={{ backgroundColor: crew.color }}
        >
          {initial}
        </div>
        <div>
          <div className="text-[16px] font-semibold">{crew.name}</div>
          <div className="text-[12px] text-fg-muted">{crew.role}</div>
        </div>
      </div>
      <div className="text-[12px] text-fg-secondary">{crew.tagline}</div>
      <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-fg-muted">
        <span>{crew.stats.tasksCompleted} done</span>
        <span>{crew.skills.length} skills</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Crew list page**

Create `C:\Users\chath\command-center\app\crew\page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { CrewCard } from "@/components/crew/CrewCard";
import type { CrewMemberT } from "@/lib/schemas";

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMemberT[]>([]);

  useEffect(() => {
    fetch("/api/crew").then((r) => r.json()).then((d) => setCrew(d.crew));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Crew</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Six specialists across all registered projects.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {crew.map((c) => <CrewCard key={c.id} crew={c} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CrewMemoryView component**

Create `C:\Users\chath\command-center\components\crew\CrewMemoryView.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

export function CrewMemoryView({ crewId }: { crewId: string }) {
  const [identity, setIdentity] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/crew/${crewId}/memory`)
      .then((r) => r.ok ? r.text() : "")
      .then((text) => {
        setIdentity(text || "_No identity memory recorded yet. Crew member will populate this file after their first task._");
      })
      .finally(() => setLoading(false));
  }, [crewId]);

  if (loading) return <div className="text-fg-muted">Loading memory…</div>;
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 text-[13px] leading-6 text-fg-secondary whitespace-pre-wrap font-mono">
      {identity}
    </div>
  );
}
```

- [ ] **Step 4: Add `/api/crew/[id]/memory` endpoint**

Create `C:\Users\chath\command-center\app\api\crew\[id]\memory\route.ts`:
```ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memPath = path.join(
    process.cwd(),
    "data",
    "crew-memory",
    `${id}.md`
  );
  try {
    const content = await fs.readFile(memPath, "utf-8");
    return new NextResponse(content, { headers: { "content-type": "text/markdown" } });
  } catch {
    return new NextResponse("", { status: 404 });
  }
}
```

- [ ] **Step 5: Crew detail page**

Create `C:\Users\chath\command-center\app\crew\[id]\page.tsx`:
```tsx
"use client";

import { use, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewMemoryView } from "@/components/crew/CrewMemoryView";
import type { CrewMemberT, TaskT } from "@/lib/schemas";
import { TaskCard } from "@/components/tasks/TaskCard";

export default function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [crew, setCrew] = useState<CrewMemberT | null>(null);
  const [tasks, setTasks] = useState<TaskT[]>([]);

  useEffect(() => {
    fetch("/api/crew")
      .then((r) => r.json())
      .then((d) => setCrew(d.crew.find((c: CrewMemberT) => c.id === id) ?? null));
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks.filter((t: TaskT) => t.assignee === id)));
  }, [id]);

  if (!crew) return <div className="text-fg-muted">Loading…</div>;

  const initial = crew.name[0].toUpperCase();
  const active = tasks.filter((t) => t.status === "in_progress");
  const open = tasks.filter((t) => t.status !== "done");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-semibold text-white"
          style={{ backgroundColor: crew.color }}
        >
          {initial}
        </div>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight">{crew.name}</h1>
          <div className="text-[14px] text-fg-muted">{crew.role}</div>
          <p className="mt-1 text-[13px] text-fg-secondary">{crew.tagline}</p>
        </div>
      </div>

      <Tabs defaultValue="work">
        <TabsList>
          <TabsTrigger value="work">Work ({open.length})</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="skills">Skills ({crew.skills.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="work" className="flex flex-col gap-3 pt-4">
          {active.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-widest text-fg-muted">
                Currently working on
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {active.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-widest text-fg-muted">
              All open tasks
            </div>
            {open.length === 0 ? (
              <div className="text-[13px] text-fg-muted">Nothing on the plate.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {open.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="memory" className="pt-4">
          <CrewMemoryView crewId={crew.id} />
        </TabsContent>
        <TabsContent value="skills" className="pt-4">
          {crew.skills.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No skills seeded yet. Phase 4 populates this from project agents.</div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {crew.skills.map((s) => (
                <li key={s} className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-[12px]">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 6: Smoke test + commit**

```powershell
pnpm dev
# navigate to /crew, then /crew/cass
git add app/crew/ app/api/crew/[id]/ components/crew/
git commit -m "feat(ui): Crew roster + detail page with Memory tab"
```

---

## Task 14: Inbox 2-pane view

**Files:**
- Create: `app/inbox/page.tsx`
- Create: `components/inbox/InboxPane.tsx`

- [ ] **Step 1: InboxPane component**

Create `C:\Users\chath\command-center\components\inbox\InboxPane.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InboxMessageT } from "@/lib/schemas";
import { CrewAvatar } from "@/components/tasks/CrewAvatar";
import { cn } from "@/lib/utils";
import { useEvents } from "@/lib/use-events";

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function InboxPane() {
  const [messages, setMessages] = useState<InboxMessageT[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch("/api/messages").then((r) => r.json()).then((d) => setMessages(d.messages));
  }, []);

  useEffect(() => reload(), [reload]);
  useEvents(["message_sent"], useCallback(() => reload(), [reload]));

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  const ordered = useMemo(
    () => [...messages].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
    [messages]
  );

  return (
    <div className="grid min-h-[500px] grid-cols-[320px_1fr] gap-0 overflow-hidden rounded-lg border border-border bg-bg-elevated">
      <div className="border-r border-border">
        {ordered.length === 0 ? (
          <div className="p-6 text-[13px] text-fg-muted">No messages yet.</div>
        ) : (
          ordered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg-hover",
                selected?.id === m.id && "bg-bg-hover",
                m.status === "unread" && "font-medium"
              )}
            >
              <CrewAvatar id={m.from === "human" ? undefined : (m.from as never)} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px]">{m.from}</span>
                  <span className="shrink-0 text-[10px] text-fg-muted">{formatRelative(m.createdAt)}</span>
                </div>
                <div className="truncate text-[13px]">{m.subject}</div>
                <div className="truncate text-[12px] text-fg-muted">{m.body.slice(0, 80)}</div>
              </div>
              {m.status === "unread" && (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-border-glow" />
              )}
            </button>
          ))
        )}
      </div>
      <div className="p-6">
        {!selected ? (
          <div className="text-[13px] text-fg-muted">Select a message to read.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-fg-muted">From</div>
              <div className="text-[14px]">{selected.from} → {selected.to}</div>
            </div>
            <div className="text-[18px] font-semibold">{selected.subject}</div>
            {selected.taskId && (
              <div className="text-[12px] text-fg-muted">
                Linked task: <span className="font-mono">{selected.taskId}</span>
              </div>
            )}
            <div className="whitespace-pre-wrap text-[14px] text-fg-primary">{selected.body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Inbox page**

Create `C:\Users\chath\command-center\app\inbox\page.tsx`:
```tsx
import { InboxPane } from "@/components/inbox/InboxPane";

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Inbox</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Messages between you and the crew.
        </p>
      </div>
      <InboxPane />
    </div>
  );
}
```

- [ ] **Step 3: Seed a demo message to have content**

Extend `C:\Users\chath\command-center\scripts\seed-demo.ts` by adding to the end of `main()`:
```ts
  const inboxPath = path.join(DATA, "inbox.json");
  const { InboxFile } = await import("../lib/schemas");
  const inbox = await readJson(inboxPath, InboxFile);
  if (inbox.messages.length === 0) {
    inbox.messages.push({
      id: "msg-demo-1",
      from: "cass",
      to: "human",
      type: "question",
      taskId: "D-001",
      subject: "Kanban card width on mobile",
      body: "Cards overflow on 360px screens. Want me to swap to a vertical scroll in each column, or shrink the card width?",
      status: "unread",
      createdAt: new Date().toISOString(),
    });
    await writeJson(inboxPath, InboxFile, inbox);
  }
```

Run:
```powershell
pnpm seed:demo
```

- [ ] **Step 4: Smoke test + commit**

```powershell
pnpm dev
# navigate to /inbox
git add app/inbox/ components/inbox/ scripts/seed-demo.ts
git commit -m "feat(ui): Inbox 2-pane with message list + detail view"
```

---

## Task 15: Projects page — wire SSE live updates + project detail page

**Files:**
- Modify: `components/projects/ProjectsTable.tsx` (subscribe to project events)
- Create: `app/projects/[id]/page.tsx`

- [ ] **Step 1: Patch ProjectsTable for live updates**

Modify `C:\Users\chath\command-center\components\projects\ProjectsTable.tsx` — add SSE subscription. Replace the file with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectT } from "@/lib/schemas";
import { useEvents } from "@/lib/use-events";

export function ProjectsTable({ refreshKey }: { refreshKey: number }) {
  const [projects, setProjects] = useState<ProjectT[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [refreshKey, reload]);

  useEvents(["project_registered", "project_scanned"], useCallback(() => reload(), [reload]));

  if (loading) return <div className="text-fg-muted">Loading…</div>;
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated p-6 text-fg-secondary">
        No projects registered yet. Click &ldquo;Register Project&rdquo; to onboard one.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Path</TableHead>
          <TableHead className="w-4"></TableHead>
          <TableHead>Agents</TableHead>
          <TableHead>Skills</TableHead>
          <TableHead>Commands</TableHead>
          <TableHead>Detected</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">
              <Link href={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
            </TableCell>
            <TableCell className="font-mono text-[12px] text-fg-muted">{p.path}</TableCell>
            <TableCell>
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: p.color }}
                aria-label={`Project color ${p.color}`}
              />
            </TableCell>
            <TableCell>{p.stats.agents}</TableCell>
            <TableCell>{p.stats.skills}</TableCell>
            <TableCell>{p.stats.commands}</TableCell>
            <TableCell className="flex gap-1">
              {p.detected.hasClaudeMd && <Badge variant="secondary">CLAUDE.md</Badge>}
              {p.detected.hasMemory && <Badge variant="secondary">memory</Badge>}
              {p.detected.hasGraphify && <Badge variant="secondary">graphify</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Project detail page**

Create `C:\Users\chath\command-center\app\projects\[id]\page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { ProjectT, TaskT } from "@/lib/schemas";
import { TaskCard } from "@/components/tasks/TaskCard";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectT | null>(null);
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProject(d.projects.find((p: ProjectT) => p.id === id) ?? null));
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks.filter((t: TaskT) => t.projectId === id)));
  }, [id]);

  async function rescan() {
    setRescanning(true);
    const res = await fetch(`/api/projects/scan/${id}`, { method: "POST" });
    setRescanning(false);
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
  }

  if (!project) return <div className="text-fg-muted">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-sm" style={{ backgroundColor: project.color }} />
          <div>
            <h1 className="text-[24px] font-semibold leading-tight">{project.name}</h1>
            <div className="mt-1 font-mono text-[12px] text-fg-muted">{project.path}</div>
          </div>
        </div>
        <Button variant="ghost" onClick={rescan} disabled={rescanning}>
          {rescanning ? "Rescanning…" : "↻ Rescan"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">Agents</div>
          <div className="mt-1 text-[24px] font-semibold">{project.stats.agents}</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">Skills</div>
          <div className="mt-1 text-[24px] font-semibold">{project.stats.skills}</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">Commands</div>
          <div className="mt-1 text-[24px] font-semibold">{project.stats.commands}</div>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="detected">Detected</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="pt-4">
          {tasks.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No tasks for this project yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="detected" className="pt-4">
          <div className="flex flex-col gap-2 text-[13px]">
            <div>CLAUDE.md: {project.detected.hasClaudeMd ? "✓ detected" : "— not found"}</div>
            <div>memory/: {project.detected.hasMemory ? "✓ detected" : "— not found"}</div>
            <div>graphify: {project.detected.hasGraphify ? `✓ ${project.detected.graphifyPath}` : "— not found"}</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add app/projects/ components/projects/
git commit -m "feat(ui): project detail page + live-updating projects table"
```

---

## Task 16: Update Dashboard with real live data

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite Dashboard to fetch real data + subscribe to SSE**

Overwrite `C:\Users\chath\command-center\app\page.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboxMessageT, SprintT, TaskT } from "@/lib/schemas";
import { useEvents } from "@/lib/use-events";

export default function DashboardPage() {
  const [sprints, setSprints] = useState<SprintT[]>([]);
  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [messages, setMessages] = useState<InboxMessageT[]>([]);
  const [crewCount, setCrewCount] = useState(0);

  const reload = useCallback(() => {
    fetch("/api/sprints").then((r) => r.json()).then((d) => setSprints(d.sprints));
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks));
    fetch("/api/messages").then((r) => r.json()).then((d) => setMessages(d.messages));
    fetch("/api/crew").then((r) => r.json()).then((d) => setCrewCount(d.crew.length));
  }, []);

  useEffect(() => reload(), [reload]);
  useEvents(
    ["task_created", "task_updated", "task_moved", "message_sent", "project_registered"],
    useCallback(() => reload(), [reload])
  );

  const active = sprints.find((s) => s.status === "active");
  const sprintTasks = active ? tasks.filter((t) => t.sprint === active.id) : [];
  const unread = messages.filter((m) => m.status === "unread").length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const completedToday = tasks.filter(
    (t) => t.completedAt && t.completedAt.startsWith(todayIso)
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Dashboard</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Welcome back. {tasks.filter((t) => t.status === "in_progress").length} in progress.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Active Sprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">{active?.id ?? "—"}</div>
            <div className="text-[12px] text-fg-muted">
              {active ? `${sprintTasks.length} tasks · ${sprintTasks.filter((t) => t.status === "done").length} done` : "No active sprint"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">{unread} unread</div>
            <div className="text-[12px] text-fg-muted">
              {messages.length} total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Crew
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">{crewCount}</div>
            <div className="text-[12px] text-fg-muted">Ready</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Done today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">{completedToday}</div>
            <div className="text-[12px] text-fg-muted">Tasks completed</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/page.tsx
git commit -m "feat(ui): Dashboard shows live sprint + inbox + crew + completion stats"
```

---

## Task 17: Final tests + lint + type check + phase-2 tag

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite**

```powershell
cd C:\Users\chath\command-center
pnpm test
pnpm tsc --noEmit
pnpm lint
```

Expected totals:
- Tests: at least 32 passing (25 from Phase 1 + 7 new for api-crew, api-tasks x4, api-sprints x2, api-messages x2)
- TypeScript: 0 errors
- Lint: 0 errors (warnings ok to note)

If any of these fail, STOP and report BLOCKED with specific output. The subagent should fix straightforward issues (e.g., unused imports, missing React key warnings) and re-verify. For type errors that need architectural decisions, escalate.

- [ ] **Step 2: Full manual smoke test — all views return 200**

Start dev server. For whatever port it binds to (`$PORT`), check:
```powershell
foreach ($route in @("/", "/sprint", "/backlog", "/crew", "/crew/cass", "/inbox", "/projects", "/projects/expense-tracker")) {
  $code = curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$route"
  Write-Host "$route → $code"
}
```
Expected: all 200.

Check SSE is working:
```powershell
$job = Start-Job -ScriptBlock { curl -N "http://localhost:$using:PORT/api/events" | Select-Object -First 3 }
Start-Sleep -Seconds 2
Receive-Job $job
Stop-Job $job
```
Expected: first line is `data: {"type":"connected","payload":{}}`.

Kill dev server.

- [ ] **Step 3: Phase 2 tag**

```powershell
git commit --allow-empty -m "chore(phase-2): views complete — Sprint + Backlog + Crew + Inbox + SSE"
git tag phase-2-views
```

Verify:
```powershell
git log --oneline | Select-Object -First 5
git tag
```

Expected: phase-2-views tag present.

- [ ] **Step 4: Report out**

Report full Phase 2 stats:
- total commit count
- tag list
- test count
- tsc + lint results
- All 11 views that now exist and their purpose
- Any concerns or unresolved issues

---

## Phase 2 Acceptance Checklist

- [ ] `pnpm dev` starts successfully
- [ ] Dashboard shows live stats that update via SSE when tasks are created/moved
- [ ] Sprint page renders Kanban board with 4 columns, 8 demo tasks distributed by status
- [ ] Dragging a task between columns PATCHes the status (verify via curl GET /api/tasks after a drag, or just trust the TDD coverage for the PATCH endpoint)
- [ ] Backlog page has filter + search working
- [ ] Crew page shows 6 cards; each /crew/[id] has Work / Memory / Skills tabs
- [ ] Inbox page shows seeded demo message + selection reveals detail
- [ ] Projects page links to /projects/expense-tracker
- [ ] Project detail page shows stats + Rescan button works
- [ ] All tests pass, tsc clean, lint clean
- [ ] `phase-2-views` tag set

---

## Ready for Phase 3

Phase 3 adds the Skill Tree graph (the visual headline feature from the video), pixel-art crew avatars, and the `/api/spawn` endpoint + crew role-agent subagent files that actually dispatch work to Claude Code sessions.
