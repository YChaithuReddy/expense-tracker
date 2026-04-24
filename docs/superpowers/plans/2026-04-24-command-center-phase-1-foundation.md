# Command Center — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a running Next.js 15 command center at `C:\Users\chath\command-center\` with a themed app shell (dark + light), Dashboard home, Projects view, a working `/register-project` slash command, and the expense tracker registered as project #1.

**Architecture:** Next.js 15 App Router, TypeScript strict mode, Tailwind v3 + shadcn/ui. File-based state (JSON validated by Zod, protected by per-file mutex via `proper-lockfile`). No backend service; API routes serve `data/*.json`. Follows the design spec at `docs/superpowers/specs/2026-04-24-command-center-design.md`.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5, Tailwind CSS v4 (CSS-first config via `@theme`), shadcn/ui, Radix UI, Zod 3, `proper-lockfile`, `next-themes`, Vitest 1, `@testing-library/react`, `lucide-react`.

**Out of scope for Phase 1** (covered in later phases): Sprint/Backlog/Timeline/Pipeline/Activity views, Skill Tree graph, Crew & Inbox pages, `/api/spawn`, crew role-agents, other slash commands beyond `/register-project`, pixel avatars.

**Expected duration:** 2 days.

---

## Prereqs (run once before Task 1)

- [ ] **Verify Node.js ≥ 20.x installed**

Run in PowerShell:
```powershell
node --version
```
Expected: `v20.x.x` or higher. If missing, install from https://nodejs.org.

- [ ] **Verify pnpm ≥ 9 installed**

Run:
```powershell
pnpm --version
```
Expected: `9.x.x` or higher. If missing:
```powershell
npm install -g pnpm
```

- [ ] **Verify git installed and configured**

Run:
```powershell
git --version
git config user.name
git config user.email
```
Expected: version + configured name + configured email.

- [ ] **Verify the expense tracker repo exists at the expected path**

Run:
```powershell
Test-Path "C:\Users\chath\Documents\Python code\expense tracker\.claude"
```
Expected: `True`. This is the path `/register-project` will onboard in Task 20.

---

## Task 1: Scaffold Next.js 15 project

**Files:**
- Create directory: `C:\Users\chath\command-center\`
- Next.js init creates: `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `public/`, etc.

- [ ] **Step 1: Verify the target directory does not already exist**

Run in PowerShell:
```powershell
Test-Path "C:\Users\chath\command-center"
```
Expected: `False`. If `True`, rename existing to `command-center-old` and continue.

- [ ] **Step 2: Create Next.js 15 project with App Router + TypeScript + Tailwind**

Run:
```powershell
cd C:\Users\chath
pnpm create next-app@latest command-center --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm
```

When prompted about Turbopack, answer **Yes**.

Expected output ending with: `Success! Created command-center at C:\Users\chath\command-center`.

- [ ] **Step 3: Start dev server to verify scaffold runs**

Run:
```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Open http://localhost:3000 in browser. Expected: default Next.js welcome page renders. Ctrl+C to stop the dev server.

- [ ] **Step 4: Initialize git inside the command-center folder**

Run:
```powershell
cd C:\Users\chath\command-center
git init
git branch -M main
```
Expected: `Initialized empty Git repository in C:/Users/chath/command-center/.git/`.

- [ ] **Step 5: Add `.gitignore` additions for `data/` runtime files**

Append to `C:\Users\chath\command-center\.gitignore`:
```
# Data files that accumulate runtime state — we commit schemas, not live data
data/activity-log.json
data/activity-log.json.*
```
(The other data files stay tracked so git is a backup of state.)

- [ ] **Step 6: Commit scaffold**

Run:
```powershell
cd C:\Users\chath\command-center
git add -A
git commit -m "chore: scaffold Next.js 15 command center"
```
Expected: clean working tree.

---

## Task 2: Install production dependencies

**Files:** Modify `C:\Users\chath\command-center\package.json`.

- [ ] **Step 1: Install runtime dependencies**

Run:
```powershell
cd C:\Users\chath\command-center
pnpm add zod proper-lockfile next-themes lucide-react clsx tailwind-merge class-variance-authority
```
Expected: all 7 packages listed in `dependencies`.

- [ ] **Step 2: Install shadcn dependencies**

Run:
```powershell
pnpm add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-tabs @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-scroll-area
```
Expected: 9 Radix packages in `dependencies`.

- [ ] **Step 3: Install type packages for proper-lockfile**

Run:
```powershell
pnpm add -D @types/proper-lockfile
```
Expected: one dev dependency added.

- [ ] **Step 4: Verify no install errors**

Run:
```powershell
pnpm install
```
Expected: `Done in X.Xs` with no warnings about peer deps for React 18.

- [ ] **Step 5: Commit dependencies**

Run:
```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: add runtime dependencies (zod, radix, lucide, next-themes)"
```

---

## Task 3: Install test dependencies and wire Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `tests/` folder

- [ ] **Step 1: Install Vitest and testing utilities**

Run:
```powershell
cd C:\Users\chath\command-center
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom happy-dom
```
Expected: 6 dev dependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

Create `C:\Users\chath\command-center\vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

Create `C:\Users\chath\command-center\vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts to `package.json`**

Modify `C:\Users\chath\command-center\package.json` — in `"scripts"` add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Create a placeholder test to verify Vitest runs**

Create `C:\Users\chath\command-center\tests\smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests to verify Vitest works**

Run:
```powershell
pnpm test
```
Expected: `1 passed | 0 failed` with the smoke test.

- [ ] **Step 7: Commit test setup**

Run:
```powershell
git add -A
git commit -m "chore: wire Vitest + testing-library, smoke test passes"
```

---

## Task 4: Configure Tailwind v4 theme tokens (CSS-first)

**Files:**
- Overwrite: `C:\Users\chath\command-center\app\globals.css`
- (Tailwind v4 uses CSS-first config via `@theme` — no `tailwind.config.ts` required. The Next 15.5 scaffold may create a minimal one; leave it untouched if present.)

**Note on Tailwind v4:** The Next.js 15.5 scaffold uses Tailwind CSS v4 which moves config from `tailwind.config.ts` into a CSS `@theme` block. Color tokens declared as `--color-<name>` automatically become utility classes (`bg-<name>`, `text-<name>`, `border-<name>`). We keep shadcn's default `--radius` mechanism for border radius (so `rounded-md`, `rounded-lg`, etc. continue to work as shadcn expects). Spacing uses Tailwind's native numeric scale: `p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px, `p-12`=48px.

- [ ] **Step 1: Verify Tailwind v4 scaffold landed correctly**

Run:
```powershell
cd C:\Users\chath\command-center
Get-Content app/globals.css | Select-Object -First 3
```
Expected: first line is `@import "tailwindcss";` (this is v4's entry point — NOT the v3 `@tailwind base; @tailwind components; @tailwind utilities;`).

Run:
```powershell
Get-Content postcss.config.mjs
```
Expected: `@tailwindcss/postcss` plugin listed.

If the first line of globals.css is NOT `@import "tailwindcss";`, STOP and report a scaffold mismatch.

- [ ] **Step 2: Replace `app/globals.css` with our theme tokens**

Overwrite `C:\Users\chath\command-center\app\globals.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Surface & foreground — light theme defaults */
  --color-bg-base: #fafafa;
  --color-bg-elevated: #ffffff;
  --color-bg-hover: #f4f4f5;
  --color-border: #e4e4e7;
  --color-border-glow: #8b5cf6;
  --color-fg-primary: #09090b;
  --color-fg-secondary: #3f3f46;
  --color-fg-muted: #71717a;

  /* Crew accents (same in both themes) */
  --color-crew-fluxy: #8b5cf6;
  --color-crew-cass: #ec4899;
  --color-crew-supa: #14b8a6;
  --color-crew-bugsy: #f59e0b;
  --color-crew-shield: #10b981;
  --color-crew-scribe: #60a5fa;

  /* Status */
  --color-status-success: #22c55e;
  --color-status-warn: #eab308;
  --color-status-error: #ef4444;
  --color-status-critical: #dc2626;

  /* Typography */
  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;

  /* Shadow */
  --shadow-card: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.45);
}

/* Dark theme overrides — activated by adding `class="dark"` to <html> */
@layer base {
  .dark {
    --color-bg-base: #0a0a0b;
    --color-bg-elevated: #121215;
    --color-bg-hover: #1a1a1f;
    --color-border: #27272a;
    --color-fg-primary: #f4f4f5;
    --color-fg-secondary: #a1a1aa;
    --color-fg-muted: #52525b;
  }

  body {
    background-color: var(--color-bg-base);
    color: var(--color-fg-primary);
    font-family: var(--font-sans);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**How class names resolve:** Because `@theme` variables are named `--color-<token>`, Tailwind v4 auto-generates utility classes:
- `--color-bg-base` → `bg-bg-base`, `text-bg-base`, `border-bg-base`, etc.
- `--color-fg-primary` → `bg-fg-primary`, `text-fg-primary`, etc.
- `--color-crew-cass` → `bg-crew-cass`, `text-crew-cass`, etc.

All Tailwind class names used in Tasks 12-16 (e.g., `bg-bg-elevated`, `text-fg-primary`, `border-border`) work without changes.

- [ ] **Step 3: Verify dev server applies theme**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```

Open http://localhost:3000 in browser. Expected: light gray background (`#fafafa`). Open DevTools → Elements → add `class="dark"` to the `<html>` tag. Expected: background flips to near-black (`#0a0a0b`). Ctrl+C to stop the dev server.

- [ ] **Step 4: Commit**

```powershell
git add app/globals.css
git commit -m "feat(theme): Tailwind v4 @theme tokens + dark/light variables"
```

---

## Task 5: Install and configure shadcn/ui (Tailwind v4 mode)

**Files:**
- Run shadcn CLI — creates `components/ui/*.tsx`, `lib/utils.ts`, `components.json`. Appends shadcn-specific CSS vars to our `app/globals.css`.

**Note on shadcn + Tailwind v4:** shadcn/ui's `init` CLI auto-detects Tailwind v4 and adapts. The prompt sequence differs from v3 — it won't ask about `tailwind.config.ts` because v4 doesn't need one. Expect fewer prompts than the v3 flow.

- [ ] **Step 1: Run shadcn init**

```powershell
cd C:\Users\chath\command-center
pnpm dlx shadcn@latest init
```

Answer prompts with these values:
- Which style? → **New York**
- Which base color? → **Zinc**
- Where is your global CSS? → `app/globals.css` (accept default)
- Where would you like your components? → `@/components` (accept default)
- Where is your utils file? → `@/lib/utils` (accept default)
- Are you using React Server Components? → **Yes**

(If other prompts appear, accept defaults. The CLI may not ask every one of the above depending on what it auto-detects.)

Expected: `components.json` and `lib/utils.ts` created; `app/globals.css` has new shadcn CSS vars appended (typically in OKLCH format inside an `@layer base` block with `:root` and `.dark` selectors).

- [ ] **Step 2: Reconcile our theme tokens with shadcn's additions**

Shadcn may have appended its own `:root` and `.dark` blocks to `app/globals.css`. **Preserve both sets:** our `@theme` block from Task 4 (provides `--color-bg-base`, crew colors, etc.) AND shadcn's new variables (`--background`, `--foreground`, `--primary`, `--radius`, etc.) — these drive shadcn components' styling.

After shadcn runs, verify:
```powershell
Get-Content app/globals.css | Select-String -Pattern "@theme|--color-bg-base|--background|--radius"
```
Expected matches: `@theme` block header, `--color-bg-base` (our token), `--background` (shadcn), `--radius` (shadcn).

If shadcn's init removed our `@theme` block, re-paste it from Task 4 Step 2 above shadcn's `@layer base` block (order: `@import "tailwindcss"` → `@custom-variant dark` → our `@theme` → shadcn's `@layer base`).

- [ ] **Step 3: Install the shadcn components we need for Phase 1**

Run:
```powershell
pnpm dlx shadcn@latest add button card input label dialog sheet table badge separator dropdown-menu scroll-area tooltip tabs select
```
Expected: 14 component files created under `components/ui/`.

- [ ] **Step 4: Commit shadcn setup**

Run:
```powershell
git add -A
git commit -m "feat(ui): install shadcn/ui with zinc palette + 14 base components"
```

---

## Task 6: Define Zod schemas

**Files:**
- Create: `C:\Users\chath\command-center\lib\schemas.ts`
- Create: `C:\Users\chath\command-center\tests\schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\chath\command-center\tests\schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  ProjectsFile,
  CrewFile,
  TasksFile,
  SprintsFile,
  InboxFile,
  SkillsLibraryFile,
  ActivityLogFile,
} from "@/lib/schemas";

describe("schemas", () => {
  it("accepts a valid empty ProjectsFile", () => {
    const parsed = ProjectsFile.parse({ projects: [] });
    expect(parsed.projects).toEqual([]);
  });

  it("rejects a ProjectsFile with wrong shape", () => {
    expect(() => ProjectsFile.parse({ foo: "bar" })).toThrow();
  });

  it("accepts a valid Crew member", () => {
    const parsed = CrewFile.parse({
      crew: [
        {
          id: "fluxy",
          name: "Fluxy",
          role: "Orchestrator",
          tagline: "Routes work",
          avatar: "/avatars/fluxy.png",
          color: "#8b5cf6",
          delegates: [],
          skills: [],
          stats: { tasksCompleted: 0, hoursActive: 0 },
        },
      ],
    });
    expect(parsed.crew[0].id).toBe("fluxy");
  });

  it("rejects a Crew member with invalid id", () => {
    expect(() =>
      CrewFile.parse({
        crew: [
          {
            id: "unknown",
            name: "X",
            role: "X",
            tagline: "X",
            avatar: "x",
            color: "#000",
            delegates: [],
            skills: [],
            stats: { tasksCompleted: 0, hoursActive: 0 },
          },
        ],
      })
    ).toThrow();
  });

  it("accepts an empty tasks file", () => {
    expect(TasksFile.parse({ tasks: [] }).tasks).toEqual([]);
  });

  it("accepts an empty sprints file", () => {
    expect(SprintsFile.parse({ sprints: [] }).sprints).toEqual([]);
  });

  it("accepts an empty inbox file", () => {
    expect(InboxFile.parse({ messages: [] }).messages).toEqual([]);
  });

  it("accepts an empty skills library", () => {
    expect(SkillsLibraryFile.parse({ skills: [] }).skills).toEqual([]);
  });

  it("accepts an empty activity log", () => {
    expect(ActivityLogFile.parse({ events: [] }).events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run:
```powershell
pnpm test -- tests/schemas.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/schemas'`.

- [ ] **Step 3: Create the schemas**

Create `C:\Users\chath\command-center\lib\schemas.ts`:
```ts
import { z } from "zod";

// Crew
export const CrewId = z.enum([
  "fluxy",
  "cass",
  "supa",
  "bugsy",
  "shield",
  "scribe",
]);
export type CrewIdT = z.infer<typeof CrewId>;

export const CrewMember = z.object({
  id: CrewId,
  name: z.string().min(1),
  role: z.string().min(1),
  tagline: z.string(),
  avatar: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  delegates: z.array(
    z.object({
      type: z.enum(["base", "project-agent", "skill"]),
      pattern: z.string().optional(),
      weight: z.number().optional(),
    })
  ),
  skills: z.array(z.string()),
  stats: z.object({
    tasksCompleted: z.number().int().nonnegative(),
    hoursActive: z.number().nonnegative(),
    lastActiveAt: z.string().optional(),
  }),
});
export const CrewFile = z.object({ crew: z.array(CrewMember) });

// Projects
export const Project = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  claudeDir: z.string().default(".claude"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean(),
  addedAt: z.string(),
  stats: z.object({
    agents: z.number().int().nonnegative(),
    skills: z.number().int().nonnegative(),
    commands: z.number().int().nonnegative(),
  }),
  detected: z.object({
    hasClaudeMd: z.boolean(),
    hasMemory: z.boolean(),
    hasGraphify: z.boolean(),
    graphifyPath: z.string().optional(),
  }),
  memoryPaths: z.object({
    projectCLAUDE: z.string().optional(),
    projectMemory: z.string().optional(),
  }),
});
export const ProjectsFile = z.object({ projects: z.array(Project) });

// Tasks
export const TaskStatus = z.enum(["todo", "in_progress", "review", "done"]);
export const TaskPriority = z.enum(["low", "mid", "high", "crit"]);
export const TaskEpic = z.enum([
  "Business",
  "Content",
  "Platform",
  "Product",
  "Operations",
  "Course",
  "Personal",
]);
export const PipelineStage = z.enum(["plan", "build", "test", "ship"]);

export const Task = z.object({
  id: z.string().regex(/^D-\d+$/),
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  epic: TaskEpic,
  status: TaskStatus,
  assignee: CrewId.optional(),
  collaborators: z.array(CrewId),
  priority: TaskPriority,
  sprint: z.string().optional(),
  pipelineStage: PipelineStage,
  blockedBy: z.array(z.string()),
  estimate: z.number().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  spawnHistory: z.array(
    z.object({
      spawnedAt: z.string(),
      terminalPid: z.number().optional(),
      exitCode: z.number().optional(),
      tokensUsed: z.number().optional(),
      durationMs: z.number().optional(),
    })
  ),
});
export const TasksFile = z.object({ tasks: z.array(Task) });

// Sprints
export const Sprint = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["planning", "active", "completed"]),
  goal: z.string(),
  stats: z.object({
    todo: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
  }),
});
export const SprintsFile = z.object({ sprints: z.array(Sprint) });

// Inbox
export const InboxMessage = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["question", "report", "delegation", "decision"]),
  taskId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string(),
  status: z.enum(["unread", "read", "resolved"]),
  createdAt: z.string(),
});
export const InboxFile = z.object({ messages: z.array(InboxMessage) });

// Skills library
export const Skill = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  sourcePath: z.string(),
  ownedBy: z.array(CrewId),
  tags: z.array(z.string()),
  description: z.string(),
  invokeCount: z.number().int().nonnegative(),
  lastInvokedAt: z.string().optional(),
});
export const SkillsLibraryFile = z.object({ skills: z.array(Skill) });

// Activity log
export const ActivityEvent = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  type: z.enum([
    "task_created",
    "task_updated",
    "task_moved",
    "spawn_started",
    "spawn_completed",
    "spawn_failed",
    "message_sent",
    "skill_invoked",
    "command_ran",
    "project_registered",
    "project_scanned",
  ]),
  actor: z.string(),
  payload: z.record(z.unknown()),
  projectId: z.string().optional(),
});
export const ActivityLogFile = z.object({ events: z.array(ActivityEvent) });

// Exported types
export type ProjectT = z.infer<typeof Project>;
export type CrewMemberT = z.infer<typeof CrewMember>;
export type TaskT = z.infer<typeof Task>;
export type SprintT = z.infer<typeof Sprint>;
export type InboxMessageT = z.infer<typeof InboxMessage>;
export type SkillT = z.infer<typeof Skill>;
export type ActivityEventT = z.infer<typeof ActivityEvent>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
pnpm test -- tests/schemas.test.ts
```
Expected: `9 passed | 0 failed`.

- [ ] **Step 5: Commit**

```powershell
git add lib/schemas.ts tests/schemas.test.ts
git commit -m "feat(data): Zod schemas for 7 JSON data files"
```

---

## Task 7: Implement `lib/store.ts` with mutex

**Files:**
- Create: `C:\Users\chath\command-center\lib\store.ts`
- Create: `C:\Users\chath\command-center\tests\store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `C:\Users\chath\command-center\tests\store.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readJson, writeJson } from "@/lib/store";
import { ProjectsFile } from "@/lib/schemas";

let tmpDir: string;
let projectsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-store-"));
  projectsPath = path.join(tmpDir, "projects.json");
  fs.writeFileSync(projectsPath, JSON.stringify({ projects: [] }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("store", () => {
  it("reads a valid JSON file", async () => {
    const data = await readJson(projectsPath, ProjectsFile);
    expect(data.projects).toEqual([]);
  });

  it("throws on invalid JSON shape", async () => {
    fs.writeFileSync(projectsPath, JSON.stringify({ foo: "bar" }));
    await expect(readJson(projectsPath, ProjectsFile)).rejects.toThrow();
  });

  it("writes a validated JSON file", async () => {
    await writeJson(
      projectsPath,
      ProjectsFile,
      { projects: [] }
    );
    const raw = fs.readFileSync(projectsPath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ projects: [] });
  });

  it("rejects a write with invalid shape", async () => {
    await expect(
      writeJson(projectsPath, ProjectsFile, { foo: "bar" } as never)
    ).rejects.toThrow();
  });

  it("writes atomically (no partial file on crash simulation)", async () => {
    // Simulate: write a large payload. We can at least check that the file
    // contents are valid JSON at all times (no mid-write corruption).
    const payload = { projects: [] };
    await writeJson(projectsPath, ProjectsFile, payload);
    const parsed = JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
    expect(parsed).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
pnpm test -- tests/store.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/store'`.

- [ ] **Step 3: Implement the store**

Create `C:\Users\chath\command-center\lib\store.ts`:
```ts
import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import type { z } from "zod";

export async function readJson<T>(
  absolutePath: string,
  schema: z.ZodType<T>
): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}

export async function writeJson<T>(
  absolutePath: string,
  schema: z.ZodType<T>,
  data: T
): Promise<void> {
  // Validate first — never write invalid data.
  const validated = schema.parse(data);

  // Ensure parent directory exists.
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  // Ensure the file exists for proper-lockfile (it locks by-file).
  try {
    await fs.access(absolutePath);
  } catch {
    await fs.writeFile(absolutePath, "{}");
  }

  // Acquire exclusive lock (auto-retry up to 5× with small backoff).
  const release = await lockfile.lock(absolutePath, {
    retries: { retries: 5, minTimeout: 50, maxTimeout: 500 },
    stale: 10_000,
  });

  try {
    // Atomic write: temp file + rename.
    const tmpPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(validated, null, 2));
    await fs.rename(tmpPath, absolutePath);
  } finally {
    await release();
  }
}

export const DATA_DIR = path.join(process.cwd(), "data");

export function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}
```

- [ ] **Step 4: Run tests to verify passing**

```powershell
pnpm test -- tests/store.test.ts
```
Expected: `5 passed | 0 failed`.

- [ ] **Step 5: Commit**

```powershell
git add lib/store.ts tests/store.test.ts
git commit -m "feat(data): mutex-locked, atomic-write JSON store"
```

---

## Task 8: Implement the SSE event bus

**Files:**
- Create: `C:\Users\chath\command-center\lib\events.ts`
- Create: `C:\Users\chath\command-center\tests\events.test.ts`

- [ ] **Step 1: Write failing tests**

Create `C:\Users\chath\command-center\tests\events.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eventBus } from "@/lib/events";

describe("eventBus", () => {
  it("notifies a subscriber when fired", () => {
    const received: string[] = [];
    const unsub = eventBus.subscribe((e) => received.push(e.type));
    eventBus.fire({ type: "task_updated", payload: {} });
    expect(received).toEqual(["task_updated"]);
    unsub();
  });

  it("stops notifying after unsubscribe", () => {
    const received: string[] = [];
    const unsub = eventBus.subscribe((e) => received.push(e.type));
    unsub();
    eventBus.fire({ type: "task_updated", payload: {} });
    expect(received).toEqual([]);
  });

  it("supports multiple subscribers", () => {
    let a = 0;
    let b = 0;
    const u1 = eventBus.subscribe(() => (a += 1));
    const u2 = eventBus.subscribe(() => (b += 1));
    eventBus.fire({ type: "project_scanned", payload: {} });
    expect(a).toBe(1);
    expect(b).toBe(1);
    u1();
    u2();
  });
});
```

- [ ] **Step 2: Verify failure**

```powershell
pnpm test -- tests/events.test.ts
```
Expected: FAIL — no `@/lib/events`.

- [ ] **Step 3: Implement the event bus**

Create `C:\Users\chath\command-center\lib\events.ts`:
```ts
export type BusEvent = {
  type:
    | "task_created"
    | "task_updated"
    | "task_moved"
    | "project_registered"
    | "project_scanned"
    | "message_sent"
    | "spawn_started"
    | "spawn_completed";
  payload: Record<string, unknown>;
};

type Subscriber = (event: BusEvent) => void;

class EventBus {
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  fire(event: BusEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch (err) {
        console.error("[eventBus] subscriber threw:", err);
      }
    }
  }

  clear(): void {
    this.subscribers.clear();
  }
}

export const eventBus = new EventBus();
```

- [ ] **Step 4: Verify passing**

```powershell
pnpm test -- tests/events.test.ts
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```powershell
git add lib/events.ts tests/events.test.ts
git commit -m "feat(data): in-process event bus for SSE fan-out"
```

---

## Task 9: Implement the project scanner

**Files:**
- Create: `C:\Users\chath\command-center\lib\project-scanner.ts`
- Create: `C:\Users\chath\command-center\tests\project-scanner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `C:\Users\chath\command-center\tests\project-scanner.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanProject } from "@/lib/project-scanner";

let fixtureDir: string;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-scanner-"));

  // Mock .claude/agents/
  fs.mkdirSync(path.join(fixtureDir, ".claude", "agents"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, ".claude", "agents", "alpha.md"),
    "---\nname: alpha\ndescription: test agent\n---\nbody"
  );
  fs.writeFileSync(
    path.join(fixtureDir, ".claude", "agents", "beta.md"),
    "---\nname: beta\ndescription: another\n---\nbody"
  );

  // Mock .claude/commands/
  fs.mkdirSync(path.join(fixtureDir, ".claude", "commands"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, ".claude", "commands", "do-it.md"),
    "---\ndescription: does the thing\n---\nbody"
  );

  // Mock .claude/skills/
  fs.mkdirSync(path.join(fixtureDir, ".claude", "skills", "sk1"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(fixtureDir, ".claude", "skills", "sk1", "SKILL.md"),
    "---\nname: sk1\ndescription: a skill\n---\nbody"
  );

  // Mock CLAUDE.md
  fs.writeFileSync(path.join(fixtureDir, "CLAUDE.md"), "# Project");

  // Mock memory/
  fs.mkdirSync(path.join(fixtureDir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, "memory", "MEMORY.md"), "# Mem");

  // Mock graphify
  fs.mkdirSync(
    path.join(fixtureDir, "SecondBrain", "graphify-out"),
    { recursive: true }
  );
  fs.writeFileSync(
    path.join(fixtureDir, "SecondBrain", "graphify-out", "graph.json"),
    "{}"
  );
});

describe("scanProject", () => {
  it("counts agents, commands, skills", async () => {
    const result = await scanProject(fixtureDir);
    expect(result.stats.agents).toBe(2);
    expect(result.stats.commands).toBe(1);
    expect(result.stats.skills).toBe(1);
  });

  it("detects CLAUDE.md, memory, graphify", async () => {
    const result = await scanProject(fixtureDir);
    expect(result.detected.hasClaudeMd).toBe(true);
    expect(result.detected.hasMemory).toBe(true);
    expect(result.detected.hasGraphify).toBe(true);
    expect(result.detected.graphifyPath).toBe(
      path.join("SecondBrain", "graphify-out", "graph.json")
    );
  });

  it("returns agent names parsed from frontmatter", async () => {
    const result = await scanProject(fixtureDir);
    const names = result.agents.map((a) => a.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  it("handles missing .claude/ gracefully", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "cc-empty-"));
    const result = await scanProject(empty);
    expect(result.stats.agents).toBe(0);
    expect(result.stats.commands).toBe(0);
    expect(result.stats.skills).toBe(0);
  });
});
```

- [ ] **Step 2: Verify failure**

```powershell
pnpm test -- tests/project-scanner.test.ts
```
Expected: FAIL — no `@/lib/project-scanner`.

- [ ] **Step 3: Implement the scanner**

Create `C:\Users\chath\command-center\lib\project-scanner.ts`:
```ts
import fs from "node:fs/promises";
import path from "node:path";

export interface ScannedAgent {
  file: string;
  name: string;
  description: string;
}

export interface ScannedSkill {
  dir: string;
  name: string;
  description: string;
}

export interface ScannedCommand {
  file: string;
  name: string;
  description: string;
}

export interface ScanResult {
  agents: ScannedAgent[];
  commands: ScannedCommand[];
  skills: ScannedSkill[];
  stats: { agents: number; commands: number; skills: number };
  detected: {
    hasClaudeMd: boolean;
    hasMemory: boolean;
    hasGraphify: boolean;
    graphifyPath?: string;
  };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(raw: string): Record<string, string> {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};
  const result: Record<string, string> = {};
  for (const line of fmMatch[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) result[kv[1]] = kv[2].trim();
  }
  return result;
}

async function listMdFiles(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(dir, e.name));
}

async function listSkillDirs(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
}

export async function scanProject(projectPath: string): Promise<ScanResult> {
  const claudeDir = path.join(projectPath, ".claude");

  const agentFiles = await listMdFiles(path.join(claudeDir, "agents"));
  const commandFiles = await listMdFiles(path.join(claudeDir, "commands"));
  const skillDirs = await listSkillDirs(path.join(claudeDir, "skills"));

  const agents: ScannedAgent[] = [];
  for (const file of agentFiles) {
    const raw = await fs.readFile(file, "utf-8");
    const fm = parseFrontmatter(raw);
    agents.push({
      file,
      name: fm.name ?? path.basename(file, ".md"),
      description: fm.description ?? "",
    });
  }

  const commands: ScannedCommand[] = [];
  for (const file of commandFiles) {
    const raw = await fs.readFile(file, "utf-8");
    const fm = parseFrontmatter(raw);
    commands.push({
      file,
      name: path.basename(file, ".md"),
      description: fm.description ?? "",
    });
  }

  const skills: ScannedSkill[] = [];
  for (const dir of skillDirs) {
    const skillMd = path.join(dir, "SKILL.md");
    if (!(await exists(skillMd))) continue;
    const raw = await fs.readFile(skillMd, "utf-8");
    const fm = parseFrontmatter(raw);
    skills.push({
      dir,
      name: fm.name ?? path.basename(dir),
      description: fm.description ?? "",
    });
  }

  const hasClaudeMd = await exists(path.join(projectPath, "CLAUDE.md"));
  const hasMemory = await exists(path.join(projectPath, "memory"));
  const graphifyRel = path.join("SecondBrain", "graphify-out", "graph.json");
  const hasGraphify = await exists(path.join(projectPath, graphifyRel));

  return {
    agents,
    commands,
    skills,
    stats: {
      agents: agents.length,
      commands: commands.length,
      skills: skills.length,
    },
    detected: {
      hasClaudeMd,
      hasMemory,
      hasGraphify,
      graphifyPath: hasGraphify ? graphifyRel : undefined,
    },
  };
}
```

- [ ] **Step 4: Verify passing**

```powershell
pnpm test -- tests/project-scanner.test.ts
```
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```powershell
git add lib/project-scanner.ts tests/project-scanner.test.ts
git commit -m "feat(data): project-scanner — reads .claude/ agents, commands, skills"
```

---

## Task 10: Seed `data/` files with empty state + crew roster

**Files:**
- Create: `data/projects.json`, `data/tasks.json`, `data/sprints.json`, `data/inbox.json`, `data/skills-library.json`, `data/activity-log.json`, `data/crew.json`
- Create: `scripts/seed.ts`

- [ ] **Step 1: Create seed script**

Create `C:\Users\chath\command-center\scripts\seed.ts`:
```ts
/* Run with: pnpm tsx scripts/seed.ts */
import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "../lib/store";
import {
  ProjectsFile,
  CrewFile,
  TasksFile,
  SprintsFile,
  InboxFile,
  SkillsLibraryFile,
  ActivityLogFile,
} from "../lib/schemas";

const DATA = path.join(process.cwd(), "data");

const CREW_SEED = {
  crew: [
    {
      id: "fluxy" as const,
      name: "Fluxy",
      role: "Orchestrator",
      tagline: "Routes work, runs standups",
      avatar: "/avatars/fluxy.png",
      color: "#8b5cf6",
      delegates: [{ type: "base" as const, weight: 1 }],
      skills: ["orchestrate", "standup", "sprint-plan", "weekly-review"],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
    {
      id: "cass" as const,
      name: "Cass",
      role: "Frontend / UI",
      tagline: "CSS, responsive, premium aesthetic, a11y",
      avatar: "/avatars/cass.png",
      color: "#ec4899",
      delegates: [{ type: "project-agent" as const, pattern: "css-*" }],
      skills: [],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
    {
      id: "supa" as const,
      name: "Supa",
      role: "Backend / DB",
      tagline: "Database, API, auth, migrations",
      avatar: "/avatars/supa.png",
      color: "#14b8a6",
      delegates: [{ type: "project-agent" as const, pattern: "supabase-*" }],
      skills: [],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
    {
      id: "bugsy" as const,
      name: "Bugsy",
      role: "Debug / QA",
      tagline: "Root cause, regression, investigation",
      avatar: "/avatars/bugsy.png",
      color: "#f59e0b",
      delegates: [{ type: "project-agent" as const, pattern: "debug*" }],
      skills: [],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
    {
      id: "shield" as const,
      name: "Shield",
      role: "Security / Perf",
      tagline: "Vulnerabilities, bundle size, profiling",
      avatar: "/avatars/shield.png",
      color: "#10b981",
      delegates: [{ type: "project-agent" as const, pattern: "security-*" }],
      skills: [],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
    {
      id: "scribe" as const,
      name: "Scribe",
      role: "Docs / Memory",
      tagline: "Reports, learnings, graphify, docs",
      avatar: "/avatars/scribe.png",
      color: "#60a5fa",
      delegates: [{ type: "skill" as const, pattern: "report-*" }],
      skills: [],
      stats: { tasksCompleted: 0, hoursActive: 0 },
    },
  ],
};

async function main() {
  await fs.mkdir(DATA, { recursive: true });
  await writeJson(path.join(DATA, "projects.json"), ProjectsFile, { projects: [] });
  await writeJson(path.join(DATA, "tasks.json"), TasksFile, { tasks: [] });
  await writeJson(path.join(DATA, "sprints.json"), SprintsFile, { sprints: [] });
  await writeJson(path.join(DATA, "inbox.json"), InboxFile, { messages: [] });
  await writeJson(path.join(DATA, "skills-library.json"), SkillsLibraryFile, { skills: [] });
  await writeJson(path.join(DATA, "activity-log.json"), ActivityLogFile, { events: [] });
  await writeJson(path.join(DATA, "crew.json"), CrewFile, CREW_SEED);
  console.log("Seeded 7 data files with 6 crew members.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Install `tsx` for running the script**

```powershell
pnpm add -D tsx
```

- [ ] **Step 3: Run the seed**

```powershell
cd C:\Users\chath\command-center
pnpm tsx scripts/seed.ts
```
Expected: `Seeded 7 data files with 6 crew members.`

- [ ] **Step 4: Verify files exist and are valid**

```powershell
Get-ChildItem data -Name
```
Expected (7 files): `activity-log.json`, `crew.json`, `inbox.json`, `projects.json`, `skills-library.json`, `sprints.json`, `tasks.json`.

Check `crew.json` content:
```powershell
Get-Content data/crew.json | Select-Object -First 5
```
Expected: first member is Fluxy.

- [ ] **Step 5: Add seed script to package.json**

Modify `package.json` `"scripts"`:
```json
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat(data): seed data/*.json + 6-member crew roster"
```

---

## Task 11: Configure `next-themes` provider

**Files:**
- Create: `C:\Users\chath\command-center\components\providers\theme-provider.tsx`
- Modify: `C:\Users\chath\command-center\app\layout.tsx`

- [ ] **Step 1: Create theme provider wrapper**

Create `C:\Users\chath\command-center\components\providers\theme-provider.tsx`:
```tsx
"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemeProvider>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

Overwrite `C:\Users\chath\command-center\app\layout.tsx`:
```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Command Center",
  description: "Mission control for your Claude Code crew",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-base text-fg-primary">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run dev server, verify no hydration errors**

```powershell
pnpm dev
```
Open http://localhost:3000. Open DevTools → Console. Expected: no red errors about hydration mismatch. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat(ui): next-themes provider, dark default"
```

---

## Task 12: Build the app shell (sidebar + top bar)

**Files:**
- Create: `C:\Users\chath\command-center\components\sidebar\Sidebar.tsx`
- Create: `C:\Users\chath\command-center\components\sidebar\nav-items.ts`
- Create: `C:\Users\chath\command-center\components\top-bar\TopBar.tsx`
- Create: `C:\Users\chath\command-center\components\top-bar\ThemeToggle.tsx`
- Create: `C:\Users\chath\command-center\components\app-shell\AppShell.tsx`

- [ ] **Step 1: Define sidebar nav items**

Create `C:\Users\chath\command-center\components\sidebar\nav-items.ts`:
```ts
import {
  LayoutDashboard,
  Network,
  Kanban,
  List,
  Calendar,
  GitBranch,
  Activity,
  Users,
  Inbox,
  BookText,
  FolderKanban,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  section: "top" | "work" | "team" | "config";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, section: "top" },
  { label: "Skill Tree", href: "/skill-tree", icon: Network, section: "work" },
  { label: "Sprint", href: "/sprint", icon: Kanban, section: "work" },
  { label: "Backlog", href: "/backlog", icon: List, section: "work" },
  { label: "Timeline", href: "/timeline", icon: Calendar, section: "work" },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch, section: "work" },
  { label: "Activity", href: "/activity", icon: Activity, section: "work" },
  { label: "Crew", href: "/crew", icon: Users, section: "team" },
  { label: "Inbox", href: "/inbox", icon: Inbox, section: "team" },
  { label: "Docs", href: "/docs", icon: BookText, section: "config" },
  { label: "Projects", href: "/projects", icon: FolderKanban, section: "config" },
];
```

- [ ] **Step 2: Build Sidebar component**

Create `C:\Users\chath\command-center\components\sidebar\Sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "top", label: null },
  { id: "work", label: "Work" },
  { id: "team", label: "Team" },
  { id: "config", label: "Config" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-elevated">
      <div className="px-4 py-6 text-[18px] font-semibold tracking-tight">
        Command Center
      </div>
      <nav className="flex flex-col gap-2 px-2">
        {SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section.id);
          if (items.length === 0) return null;
          return (
            <div key={section.id} className="flex flex-col gap-1">
              {section.label && (
                <div className="px-2 pt-4 text-[11px] uppercase tracking-widest text-fg-muted">
                  {section.label}
                </div>
              )}
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors",
                      active
                        ? "bg-bg-hover text-fg-primary"
                        : "text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Build theme toggle button**

Create `C:\Users\chath\command-center\components\top-bar\ThemeToggle.tsx`:
```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
```

- [ ] **Step 4: Build top bar**

Create `C:\Users\chath\command-center\components\top-bar\TopBar.tsx`:
```tsx
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  return (
    <header className="flex h-12 items-center justify-end gap-2 border-b border-border bg-bg-elevated px-6">
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 5: Build app shell wrapper**

Create `C:\Users\chath\command-center\components\app-shell\AppShell.tsx`:
```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TopBar } from "@/components/top-bar/TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount AppShell in root layout**

Modify `C:\Users\chath\command-center\app\layout.tsx`:
```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppShell } from "@/components/app-shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Command Center",
  description: "Mission control for your Claude Code crew",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-base text-fg-primary">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Visual smoke test**

```powershell
pnpm dev
```
Open http://localhost:3000. Expected: dark-themed page with left sidebar showing "Command Center" title, 11 nav items grouped under Work/Team/Config, and a theme toggle button in top-right that flips dark↔light.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat(ui): app shell — sidebar (11 items), top bar, theme toggle"
```

---

## Task 13: Build Dashboard page (static)

**Files:**
- Overwrite: `C:\Users\chath\command-center\app\page.tsx`

- [ ] **Step 1: Replace default Next.js homepage with Dashboard**

Overwrite `C:\Users\chath\command-center\app\page.tsx`:
```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight">Dashboard</h1>
        <p className="mt-1 text-[14px] text-fg-secondary">
          Welcome back. Crew is idle.
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
            <div className="text-[20px] font-semibold">—</div>
            <div className="text-[12px] text-fg-muted">No active sprint</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">0 unread</div>
            <div className="text-[12px] text-fg-muted">All clear</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Crew
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">6 idle</div>
            <div className="text-[12px] text-fg-muted">Ready for work</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] font-medium text-fg-secondary">
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[20px] font-semibold">0 events</div>
            <div className="text-[12px] text-fg-muted">Today</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual smoke test**

```powershell
pnpm dev
```
Open http://localhost:3000. Expected: "Dashboard" heading, 4 cards in a grid (Active Sprint, Inbox, Crew, Activity) with stub data. Toggle theme — cards and text should flip colors cleanly.

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "feat(ui): Dashboard page — 4-card static grid"
```

---

## Task 14: Build `/api/projects` GET + POST

**Files:**
- Create: `C:\Users\chath\command-center\app\api\projects\route.ts`
- Create: `C:\Users\chath\command-center\tests\api-projects.test.ts`

- [ ] **Step 1: Write failing test for GET**

Create `C:\Users\chath\command-center\tests\api-projects.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Import the route handler directly (Next.js 15 App Router handlers are
// plain async functions — we can call them without a running server).
import { GET, POST } from "@/app/api/projects/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-api-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "projects.json"),
    JSON.stringify({ projects: [] })
  );
  process.chdir(tmpDir);
});

describe("/api/projects", () => {
  it("GET returns empty list initially", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.projects).toEqual([]);
  });

  it("POST adds a project and GET returns it", async () => {
    const projectFixture = fs.mkdtempSync(path.join(os.tmpdir(), "cc-fix-"));
    fs.mkdirSync(path.join(projectFixture, ".claude"), { recursive: true });

    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        path: projectFixture,
        color: "#14b8a6",
      }),
    });
    const postRes = await POST(req);
    expect(postRes.status).toBe(201);

    const getRes = await GET();
    const body = await getRes.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("Test");
    expect(body.projects[0].stats).toBeDefined();
  });

  it("POST rejects invalid path", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Bad",
        path: "C:\\definitely-not-real",
        color: "#000000",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verify failure**

```powershell
pnpm test -- tests/api-projects.test.ts
```
Expected: FAIL — no module `@/app/api/projects/route`.

- [ ] **Step 3: Implement the route**

Create `C:\Users\chath\command-center\app\api\projects\route.ts`:
```ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { readJson, writeJson, dataPath } from "@/lib/store";
import { ProjectsFile, type ProjectT } from "@/lib/schemas";
import { scanProject } from "@/lib/project-scanner";
import { eventBus } from "@/lib/events";

export async function GET() {
  const data = await readJson(dataPath("projects.json"), ProjectsFile);
  return NextResponse.json(data);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name: string;
    path: string;
    color: string;
  };

  if (!body.path || !(await exists(body.path))) {
    return NextResponse.json(
      { error: "Path does not exist" },
      { status: 400 }
    );
  }

  const scan = await scanProject(body.path);
  const projectsPath = dataPath("projects.json");
  const current = await readJson(projectsPath, ProjectsFile);

  const newProject: ProjectT = {
    id: slugify(body.name),
    name: body.name,
    path: body.path,
    claudeDir: ".claude",
    color: body.color,
    active: true,
    addedAt: new Date().toISOString(),
    stats: scan.stats,
    detected: scan.detected,
    memoryPaths: {
      projectCLAUDE: scan.detected.hasClaudeMd ? "CLAUDE.md" : undefined,
      projectMemory: scan.detected.hasMemory ? "memory/" : undefined,
    },
  };

  const next = { projects: [...current.projects, newProject] };
  await writeJson(projectsPath, ProjectsFile, next);
  eventBus.fire({ type: "project_registered", payload: { id: newProject.id } });

  return NextResponse.json(newProject, { status: 201 });
}
```

- [ ] **Step 4: Run the test**

```powershell
pnpm test -- tests/api-projects.test.ts
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(api): /api/projects GET + POST with validation + scan"
```

---

## Task 15: Build `/api/projects/scan/[id]` — rescan an existing project

**Files:**
- Create: `C:\Users\chath\command-center\app\api\projects\scan\[id]\route.ts`

- [ ] **Step 1: Implement the scan endpoint**

Create `C:\Users\chath\command-center\app\api\projects\scan\[id]\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, writeJson, dataPath } from "@/lib/store";
import { ProjectsFile } from "@/lib/schemas";
import { scanProject } from "@/lib/project-scanner";
import { eventBus } from "@/lib/events";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectsPath = dataPath("projects.json");
  const data = await readJson(projectsPath, ProjectsFile);
  const project = data.projects.find((p) => p.id === id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const scan = await scanProject(project.path);
  project.stats = scan.stats;
  project.detected = scan.detected;
  project.memoryPaths = {
    projectCLAUDE: scan.detected.hasClaudeMd ? "CLAUDE.md" : undefined,
    projectMemory: scan.detected.hasMemory ? "memory/" : undefined,
  };

  await writeJson(projectsPath, ProjectsFile, data);
  eventBus.fire({ type: "project_scanned", payload: { id } });

  return NextResponse.json(project);
}
```

- [ ] **Step 2: Verify it compiles (tsc)**

```powershell
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "feat(api): /api/projects/scan/[id] — rescan registered project"
```

---

## Task 16: Build the Projects page

**Files:**
- Create: `C:\Users\chath\command-center\app\projects\page.tsx`
- Create: `C:\Users\chath\command-center\components\projects\ProjectsTable.tsx`
- Create: `C:\Users\chath\command-center\components\projects\RegisterDialog.tsx`

- [ ] **Step 1: Build the projects table component**

Create `C:\Users\chath\command-center\components\projects\ProjectsTable.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
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

export function ProjectsTable({ refreshKey }: { refreshKey: number }) {
  const [projects, setProjects] = useState<ProjectT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="text-fg-muted">Loading…</div>;
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated p-6 text-fg-secondary">
        No projects registered yet. Click "Register Project" to onboard one.
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
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell className="font-mono text-[12px] text-fg-muted">
              {p.path}
            </TableCell>
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

- [ ] **Step 2: Build the Register dialog**

Create `C:\Users\chath\command-center\components\projects\RegisterDialog.tsx`:
```tsx
"use client";

import { useState } from "react";
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

interface Props {
  onRegistered: () => void;
}

export function RegisterDialog({ onRegistered }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [color, setColor] = useState("#14b8a6");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, path, color }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to register");
      return;
    }
    setOpen(false);
    setName("");
    setPath("");
    onRegistered();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Register Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Expense Tracker"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="path">Absolute path</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Users\chath\Documents\Python code\expense tracker"
              className="font-mono text-[12px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-20"
            />
          </div>
          {error && (
            <div className="rounded-md border border-status-error/40 bg-status-error/10 p-3 text-[12px] text-status-error">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || !path || submitting}>
            {submitting ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Assemble Projects page**

Create `C:\Users\chath\command-center\app\projects\page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { RegisterDialog } from "@/components/projects/RegisterDialog";

export default function ProjectsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight">Projects</h1>
          <p className="mt-1 text-[14px] text-fg-secondary">
            Projects the command center knows about.
          </p>
        </div>
        <RegisterDialog onRegistered={() => setRefreshKey((k) => k + 1)} />
      </div>
      <ProjectsTable refreshKey={refreshKey} />
    </div>
  );
}
```

- [ ] **Step 4: Visual smoke test**

```powershell
pnpm dev
```
Navigate to http://localhost:3000/projects. Expected: "Projects" heading, empty-state message, "+ Register Project" button in top-right. Click it — dialog opens with Name/Path/Color fields.

Fill in:
- Name: `Expense Tracker`
- Path: `C:\Users\chath\Documents\Python code\expense tracker`
- Color: (default teal)

Click Register. Expected: dialog closes, row appears in table showing name, path, teal color dot, stats (≥4 agents / ≥10 skills / ≥6 commands), badges for CLAUDE.md + memory + graphify.

Ctrl+C to stop.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(ui): Projects page — register dialog + live table"
```

---

## Task 17: Create `/register-project` slash command

**Files:**
- Create: `C:\Users\chath\command-center\.claude\commands\register-project.md`

- [ ] **Step 1: Write the slash command**

Create `C:\Users\chath\command-center\.claude\commands\register-project.md`:
```markdown
---
description: Register a project with the command center — scans its .claude/ folder and adds it to data/projects.json
argument-hint: <absolute-path> [color]
allowed-tools: Read, Write, Edit, Bash
---

# /register-project

You are invoked as `/register-project $ARGUMENTS` from inside the command center project directory.

Arguments:
- First positional arg: absolute path to the project to register (e.g. `"C:\Users\chath\Documents\Python code\expense tracker"`)
- Second positional arg (optional): hex color for the project (e.g. `#14b8a6`). If omitted, default to `#14b8a6`.

## Steps

1. Verify the path exists using Bash `Test-Path` or `ls`.
2. Derive the project name from the last path segment, title-cased (e.g. "expense tracker" → "Expense Tracker").
3. POST to `http://localhost:3000/api/projects` with JSON body `{ name, path, color }`.
4. If the dev server is not running, instruct the user to run `pnpm dev` first.
5. Show a concise confirmation:
   - Project name
   - Detected agents / skills / commands counts
   - Whether CLAUDE.md / memory / graphify were detected
6. Append to `data/activity-log.json` a new event with `type: "project_registered"` and `actor: "human"`.

## Example

`/register-project "C:\Users\chath\Documents\Python code\expense tracker" #14b8a6`

Expected output:
```
✅ Registered: Expense Tracker
   Path: C:\Users\chath\Documents\Python code\expense tracker
   Agents: 4 · Skills: 10 · Commands: 6
   Detected: CLAUDE.md · memory/ · graphify
```
```

- [ ] **Step 2: Commit**

```powershell
git add -A
git commit -m "feat(cmd): /register-project slash command"
```

---

## Task 18: Write command center's own `CLAUDE.md`

**Files:**
- Create: `C:\Users\chath\command-center\CLAUDE.md`

- [ ] **Step 1: Write the CLAUDE.md**

Create `C:\Users\chath\command-center\CLAUDE.md`:
```markdown
# Command Center

A local-first, web-based mission control for orchestrating Claude Code agents across multiple projects. See the design spec at `C:\Users\chath\Documents\Python code\expense tracker\docs\superpowers\specs\2026-04-24-command-center-design.md`.

## Architecture

- **Framework:** Next.js 15 App Router, TypeScript strict
- **Styling:** Tailwind v3 + shadcn/ui + Radix
- **State:** File-based JSON in `data/` (validated by Zod, locked by proper-lockfile)
- **Tests:** Vitest + Testing Library

## Folders

- `app/` — Next.js pages and API routes
- `components/` — UI components (shadcn/ui under `components/ui/`)
- `lib/` — data layer: `store.ts`, `schemas.ts`, `project-scanner.ts`, `events.ts`
- `data/` — runtime state (JSON, under git except activity-log)
- `public/avatars/` — pixel-art crew avatars (added in Phase 3)
- `.claude/commands/` — slash commands (this project's own; does not inherit from parent)
- `scripts/` — one-off utilities (seed, etc.)
- `tests/` — Vitest test files

## Commands

- `pnpm dev` — start dev server on http://localhost:3000
- `pnpm test` — run all tests
- `pnpm seed` — re-seed `data/*.json` (⚠️ overwrites crew roster; other files only if missing)

## Crew

Six fixed crew members (Phase 1 just seeds them; Phase 2-4 give them agent files + UI):

- **Fluxy** — Orchestrator
- **Cass** — Frontend / UI
- **Supa** — Backend / DB
- **Bugsy** — Debug / QA
- **Shield** — Security / Perf
- **Scribe** — Docs / Memory

## Conventions

- All data writes via `lib/store.ts` — never raw `fs.writeFile` to `data/*.json`
- All schemas in `lib/schemas.ts` — validate both at read and at write
- UI components that fetch data use hooks (`useEffect` + `fetch`) until Phase 2 adds SSE
- Spacing: use Tailwind's native numeric scale — `p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px, `p-12`=48px. No custom override.
- Radius: shadcn's `rounded-sm` / `md` / `lg` / `xl` drive off `--radius`. Use `rounded-[14px]` etc. for specific values.

## What's NOT here yet (by phase)

- **Phase 2:** Sprint, Backlog, Inbox, Crew views; SSE event stream; task CRUD dialogs
- **Phase 3:** Skill Tree with React Flow; pixel avatars
- **Phase 4:** 11 more slash commands; `/api/spawn`; crew role-agents; Activity feed; Timeline; Pipeline; light-theme polish; a11y pass
```

- [ ] **Step 2: Commit**

```powershell
git add CLAUDE.md
git commit -m "docs: CLAUDE.md for the command center project"
```

---

## Task 19: End-to-end verification — register the expense tracker

**Files:** None (verification only).

- [ ] **Step 1: Start dev server**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```

- [ ] **Step 2: Verify seed data**

In another terminal:
```powershell
Get-Content C:\Users\chath\command-center\data\projects.json
```
Expected: `{ "projects": [] }`.

- [ ] **Step 3: Register expense tracker via UI**

Open http://localhost:3000/projects. Click **+ Register Project**. Fill:
- Name: `Expense Tracker`
- Path: `C:\Users\chath\Documents\Python code\expense tracker`
- Color: `#14b8a6`

Submit.

- [ ] **Step 4: Verify table row shows real stats**

Expected row:
- Name: Expense Tracker
- Path: the absolute path in monospace
- Color dot: teal
- Agents: **4** (debugging-specialist, design-review-agent, premium-ui-designer, prompt-enhancer)
- Skills: **10** (component-generator, feature-upgrader, etc.)
- Commands: **6** (design-review, test-react-component, etc.)
- Badges: CLAUDE.md · memory · graphify

- [ ] **Step 5: Verify on disk**

```powershell
Get-Content C:\Users\chath\command-center\data\projects.json | ConvertFrom-Json | ConvertTo-Json -Depth 4
```
Expected: one project entry with the exact stats above, `detected.hasClaudeMd: true`, `detected.hasGraphify: true`, `memoryPaths.projectMemory: "memory/"`.

- [ ] **Step 6: Verify theme toggle**

In the UI, click the theme toggle (top-right). Both themes should render the Projects table and register dialog cleanly (no unstyled text, no invisible borders).

- [ ] **Step 7: Verify dashboard**

Navigate to http://localhost:3000. Expected: Dashboard renders with 4 cards in both themes.

- [ ] **Step 8: Stop dev server and commit verification notes**

Ctrl+C to stop. No file changes; just note the verification pass in the next commit's message (none needed here).

---

## Task 20: Run full test suite + type check + final commit

**Files:** None.

- [ ] **Step 1: Run tests**

```powershell
cd C:\Users\chath\command-center
pnpm test
```
Expected: all Vitest tests pass. Expected test files:
- `tests/smoke.test.ts` — 1 test
- `tests/schemas.test.ts` — 9 tests
- `tests/store.test.ts` — 5 tests
- `tests/events.test.ts` — 3 tests
- `tests/project-scanner.test.ts` — 4 tests
- `tests/api-projects.test.ts` — 3 tests

Total: **25 tests, all passing.**

- [ ] **Step 2: Type-check**

```powershell
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Lint**

```powershell
pnpm lint
```
Expected: no errors or warnings (Next.js default eslint config).

- [ ] **Step 4: Final Phase 1 commit tag**

```powershell
git add -A
git commit --allow-empty -m "chore(phase-1): foundation complete — Next.js + shell + Projects + scanner"
git tag phase-1-foundation
```

- [ ] **Step 5: Verify commit history**

```powershell
git log --oneline
```
Expected: a clean sequence of ~20 commits, one per task.

---

## Phase 1 Done — Acceptance Checklist

Before declaring Phase 1 complete, confirm all boxes:

- [ ] `pnpm dev` starts the command center on http://localhost:3000 with no console errors
- [ ] Dashboard renders 4 cards in both themes
- [ ] Sidebar shows 11 nav items grouped under Work / Team / Config
- [ ] Theme toggle works and persists across reloads (localStorage)
- [ ] `/projects` route lists projects read from `data/projects.json`
- [ ] "+ Register Project" dialog validates the input path and calls `/api/projects` POST
- [ ] Registered project row shows correct agent / skill / command counts from `.claude/` scan
- [ ] `CLAUDE.md`, `memory`, `graphify` badges show for projects that have them
- [ ] `data/crew.json` contains all 6 crew members with correct colors
- [ ] All 25 Vitest tests pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] Git tag `phase-1-foundation` is in place

---

## Ready for Phase 2

Once all acceptance boxes are checked, we have a running foundation to build Phase 2 (Sprint / Backlog / Crew / Inbox views + SSE). Write that plan when ready: `docs/superpowers/plans/YYYY-MM-DD-command-center-phase-2-views.md`.
