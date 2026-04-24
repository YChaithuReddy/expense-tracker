# Command Center — Phase 3: Skill Tree + Spawn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship the video's signature visual — the Skill Tree graph of crew ↔ skills ↔ agents — plus pixel-art crew avatars, and make the "▶ Run" button actually spawn a Claude Code session that works on a task.

**Architecture:** Phase 3 adds `@xyflow/react` (React Flow v12) + d3-force for the graph, hand-crafted pixel-art SVG avatars for the 6 crew, a skills-library populated by the project scanner, a `/api/spawn` endpoint that launches `claude -p` in a Windows Terminal tab, and 6 crew role-agent markdown files that define each crew member's personality + delegation rules.

**Tech Stack additions:** `@xyflow/react`, `d3-force`.

**Prereqs:**
- Phase 2 complete (tag `phase-2-views`, 38 commits, 38 tests, all 8 page routes responding 200)
- Windows Terminal (`wt.exe`) available on the user's `PATH` (ships by default on Windows 11)

**Out of scope for Phase 3** (covered in Phase 4):
- Timeline / Pipeline / Activity views
- Docs browser
- `/standup`, `/orchestrate`, `/sprint-plan`, and other orchestration slash commands beyond `/register-project`
- Light-theme polish / full a11y pass
- Crew-memory editing from UI

**Expected duration:** 2-3 days.

---

## Task 1: Install @xyflow/react + d3-force

**Files:** modify `package.json`

- [ ] **Step 1: Install deps**

```powershell
cd C:\Users\chath\command-center
pnpm add @xyflow/react d3-force
pnpm add -D @types/d3-force
```

Expected: 2 runtime packages + 1 dev type package added. Peer warnings about React 19 may appear — non-blocking.

- [ ] **Step 2: Commit**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: add @xyflow/react + d3-force for Phase 3"
```

Expected: 39 commits on main.

---

## Task 2: Pixel-art crew avatars

**Files:**
- Create: `components/crew/PixelAvatar.tsx`
- Create: `components/crew/pixel-patterns.ts`

Each crew member gets a hand-designed 10×10 pixel pattern, symmetric left/right, with a primary + accent color drawn from the crew's signature hue. Renders as SVG grid.

- [ ] **Step 1: Pattern definitions**

Create `C:\Users\chath\command-center\components\crew\pixel-patterns.ts`:
```ts
// Each string is 10 chars wide, 10 rows. Symmetric left/right by construction.
// "X" = primary color (crew color)
// "O" = accent (lighter shade of primary)
// "." = eye (white)
// " " = transparent
// The renderer will darken "X" by ~30% for border/outline if needed.

export interface PixelPattern {
  rows: string[];
}

export const PIXEL_PATTERNS: Record<string, PixelPattern> = {
  fluxy: {
    rows: [
      "  X    X  ",
      "   XXXX   ",
      "  XOOOOX  ",
      " XO..X..X ",
      "XXOXXXXOXX",
      "XOOOOOOOOX",
      " XOOOOOO X",
      "  X OO X  ",
      " XX    XX ",
      "X X    X X",
    ],
  },
  cass: {
    rows: [
      "   XXXX   ",
      "  XOXXOX  ",
      " XOOXXOOX ",
      "XO.OXXO.OX",
      "XOOXXXXOOX",
      "XXXXXXXXXX",
      " XOOOOOO  ",
      "  XOOXOX  ",
      "   X  X   ",
      "  XX  XX  ",
    ],
  },
  supa: {
    rows: [
      "    XX    ",
      "   XOOX   ",
      "  XOOOOX  ",
      " XO.OO.OX ",
      "XOOOOOOOOX",
      "XOXXXXXXOX",
      "XOOOOOOOOX",
      " XOOOOOOX ",
      "  XO  OX  ",
      " XX    XX ",
    ],
  },
  bugsy: {
    rows: [
      " X      X ",
      "  XXXXXX  ",
      " XOOXXOOX ",
      "X.XOOOO.X ",
      "XXOOOOOOXX",
      "XOXOXXOXOX",
      " XOOOOOO  ",
      " X      X ",
      "X        X",
      "X        X",
    ],
  },
  shield: {
    rows: [
      "   XXXX   ",
      "  XXOOXX  ",
      " XOO..OOX ",
      "XOOOXXOOOX",
      "XOXOOOOXOX",
      "XOOOOOOOOX",
      " XOOOOOO  ",
      "  XOOOOX  ",
      "   XOOX   ",
      "    XX    ",
    ],
  },
  scribe: {
    rows: [
      "  X XX X  ",
      " XOOXXOOX ",
      "XOOOXXOOOX",
      "XO..XXO..X",
      "XOOOOOOOOX",
      "XXOOOOOOXX",
      " XOOXXOO  ",
      "  XOXXOX  ",
      "  X    X  ",
      " XX    XX ",
    ],
  },
};
```

- [ ] **Step 2: PixelAvatar renderer**

Create `C:\Users\chath\command-center\components\crew\PixelAvatar.tsx`:
```tsx
"use client";

import { PIXEL_PATTERNS } from "./pixel-patterns";

function lighten(hex: string, amount = 0.25): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

export function PixelAvatar({
  crewId,
  color,
  size = 48,
}: {
  crewId: string;
  color: string;
  size?: number;
}) {
  const pattern = PIXEL_PATTERNS[crewId];
  if (!pattern) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ width: size, height: size, backgroundColor: color }}
      >
        {crewId[0]?.toUpperCase() ?? "?"}
      </div>
    );
  }

  const cols = pattern.rows[0].length;
  const rows = pattern.rows.length;
  const cellSize = size / Math.max(cols, rows);
  const accent = lighten(color, 0.3);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      style={{ display: "block" }}
      aria-label={`${crewId} avatar`}
    >
      {pattern.rows.map((row, y) =>
        row.split("").map((ch, x) => {
          let fill: string | null = null;
          if (ch === "X") fill = color;
          else if (ch === "O") fill = accent;
          else if (ch === ".") fill = "#ffffff";
          if (!fill) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        })
      )}
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add components/crew/
git commit -m "feat(ui): pixel-art PixelAvatar for 6 crew members"
```

Expected: 40 commits.

---

## Task 3: Update CrewAvatar, CrewCard, CrewDetail to use pixel avatars

**Files:**
- Modify: `components/tasks/CrewAvatar.tsx`
- Modify: `components/crew/CrewCard.tsx`
- Modify: `app/crew/[id]/page.tsx`

- [ ] **Step 1: Upgrade CrewAvatar to use PixelAvatar**

Overwrite `C:\Users\chath\command-center\components\tasks\CrewAvatar.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { CrewIdT } from "@/lib/schemas";
import { PixelAvatar } from "@/components/crew/PixelAvatar";

interface CachedCrew {
  color: string;
}
const CACHE: Map<string, CachedCrew> = new Map();

export function CrewAvatar({
  id,
  size = 24,
}: {
  id?: CrewIdT;
  size?: number;
}) {
  const [color, setColor] = useState<string>(CACHE.get(id ?? "")?.color ?? "#52525b");

  useEffect(() => {
    if (!id) return;
    if (CACHE.has(id)) {
      setColor(CACHE.get(id)!.color);
      return;
    }
    fetch("/api/crew")
      .then((r) => r.json())
      .then((data) => {
        const member = data.crew.find((c: { id: string; color: string }) => c.id === id);
        if (member) {
          CACHE.set(id, { color: member.color });
          setColor(member.color);
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

  return <PixelAvatar crewId={id} color={color} size={size} />;
}
```

- [ ] **Step 2: Upgrade CrewCard**

Overwrite `C:\Users\chath\command-center\components\crew\CrewCard.tsx`:
```tsx
import Link from "next/link";
import type { CrewMemberT } from "@/lib/schemas";
import { PixelAvatar } from "./PixelAvatar";

export function CrewCard({ crew }: { crew: CrewMemberT }) {
  return (
    <Link
      href={`/crew/${crew.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 transition-colors hover:bg-bg-hover"
    >
      <div className="flex items-center gap-3">
        <PixelAvatar crewId={crew.id} color={crew.color} size={48} />
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

- [ ] **Step 3: Upgrade crew detail page hero**

In `C:\Users\chath\command-center\app\crew\[id]\page.tsx`, replace the hero avatar div (the one that renders `initial` inside a colored circle with h-20 w-20) with a PixelAvatar. Add the import at the top, then swap:

**Add import** near the existing imports:
```tsx
import { PixelAvatar } from "@/components/crew/PixelAvatar";
```

**Replace** this block (the hero section):
```tsx
<div
  className="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-semibold text-white"
  style={{ backgroundColor: crew.color }}
>
  {initial}
</div>
```

**With** (and remove the now-unused `initial` variable):
```tsx
<PixelAvatar crewId={crew.id} color={crew.color} size={80} />
```

Also remove the line `const initial = crew.name[0].toUpperCase();` since it's no longer used.

- [ ] **Step 4: Verify + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Curl `/crew/cass` — 200 expected. Look at the BashOutput of dev server to confirm no React errors about PixelAvatar.

Kill server.

```powershell
pnpm tsc --noEmit
pnpm test
```
Expected: 0 tsc errors, 38 tests pass.

```powershell
git add components/tasks/CrewAvatar.tsx components/crew/CrewCard.tsx app/crew/[id]/page.tsx
git commit -m "feat(ui): wire PixelAvatar into CrewAvatar + CrewCard + crew detail hero"
```

Expected: 41 commits.

---

## Task 4: Populate skills-library.json on project scan

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/scan/[id]/route.ts`
- Create: `lib/skills-populate.ts`

When a project is registered or rescanned, we also upsert every `.claude/skills/*/SKILL.md` into `data/skills-library.json` so the Skill Tree has data.

- [ ] **Step 1: Skills populate module**

Create `C:\Users\chath\command-center\lib\skills-populate.ts`:
```ts
import { readJson, writeJson, dataPath } from "@/lib/store";
import { SkillsLibraryFile, type SkillT } from "@/lib/schemas";
import type { ScanResult } from "@/lib/project-scanner";

/**
 * Upserts scanned skills into skills-library.json for a given project.
 * Removes any previously-recorded skills whose `source` matches this project
 * but which no longer exist in the scan (handles deleted skills).
 */
export async function upsertProjectSkills(
  projectId: string,
  scan: ScanResult
): Promise<void> {
  const skillsPath = dataPath("skills-library.json");
  const current = await readJson(skillsPath, SkillsLibraryFile);
  const source = `project:${projectId}`;

  // Drop existing skills from this source so we can re-add a clean set.
  const kept = current.skills.filter((s) => s.source !== source);

  const now = new Date().toISOString();
  const incoming: SkillT[] = scan.skills.map((s) => {
    const existing = current.skills.find(
      (x) => x.source === source && x.id === slugify(s.name)
    );
    return {
      id: slugify(s.name),
      name: s.name,
      source,
      sourcePath: s.dir,
      ownedBy: existing?.ownedBy ?? [],
      tags: existing?.tags ?? [],
      description: s.description,
      invokeCount: existing?.invokeCount ?? 0,
      lastInvokedAt: existing?.lastInvokedAt,
    };
  });

  await writeJson(skillsPath, SkillsLibraryFile, {
    skills: [...kept, ...incoming],
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 2: Wire into POST /api/projects**

Modify `C:\Users\chath\command-center\app\api\projects\route.ts`. At the top, add:
```ts
import { upsertProjectSkills } from "@/lib/skills-populate";
```

Then inside the `POST` function, AFTER the line `await writeJson(projectsPath, ProjectsFile, next);` and BEFORE `eventBus.fire(...)`, add:
```ts
await upsertProjectSkills(newProject.id, scan);
```

- [ ] **Step 3: Wire into POST /api/projects/scan/[id]**

Modify `C:\Users\chath\command-center\app\api\projects\scan\[id]\route.ts`. At the top, add:
```ts
import { upsertProjectSkills } from "@/lib/skills-populate";
```

Then inside the `POST` function, AFTER `await writeJson(projectsPath, ProjectsFile, data);`, add:
```ts
await upsertProjectSkills(id, scan);
```

- [ ] **Step 4: Verify with a rescan**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Wait for Ready. Note port $PORT.

Trigger a rescan on expense-tracker:
```powershell
Invoke-RestMethod -Uri "http://localhost:$PORT/api/projects/scan/expense-tracker" -Method Post
```

Check skills-library.json:
```powershell
(Get-Content C:\Users\chath\command-center\data\skills-library.json | ConvertFrom-Json).skills.Count
```
Expected: 10 (matches the expense tracker's 10 skills).

```powershell
(Get-Content C:\Users\chath\command-center\data\skills-library.json | ConvertFrom-Json).skills | Select-Object -First 1
```
Expected: a skill with `source: project:expense-tracker`, populated `name`, `description`, `sourcePath`.

Kill server.

- [ ] **Step 5: Run tests + commit**

```powershell
pnpm test
```
Expected: 38 still pass (the existing api-projects.test.ts uses a tmpDir fixture that has 0 skills in its .claude/, so upsert runs but adds 0 skills — tests remain green).

```powershell
git add lib/skills-populate.ts app/api/projects/
git commit -m "feat(data): populate skills-library.json on project register + rescan"
```

Expected: 42 commits.

---

## Task 5: /api/skills GET endpoint + test

**Files:**
- Create: `app/api/skills/route.ts`
- Create: `tests/api-skills.test.ts`

- [ ] **Step 1: Write failing test**

Create `C:\Users\chath\command-center\tests\api-skills.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GET } from "@/app/api/skills/route";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-skills-"));
  fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "data", "skills-library.json"),
    JSON.stringify({
      skills: [
        {
          id: "layout-fixer",
          name: "Layout Fixer",
          source: "project:expense-tracker",
          sourcePath: "C:/x/.claude/skills/layout-fixer",
          ownedBy: ["cass"],
          tags: [],
          description: "Fix layout",
          invokeCount: 0,
        },
      ],
    })
  );
  process.chdir(tmpDir);
});

describe("/api/skills", () => {
  it("GET returns skills", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].id).toBe("layout-fixer");
  });
});
```

- [ ] **Step 2: Implement**

Create `C:\Users\chath\command-center\app\api\skills\route.ts`:
```ts
import { NextResponse } from "next/server";
import { readJson, dataPath } from "@/lib/store";
import { SkillsLibraryFile } from "@/lib/schemas";

export async function GET() {
  const data = await readJson(dataPath("skills-library.json"), SkillsLibraryFile);
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Verify + commit**

```powershell
cd C:\Users\chath\command-center
pnpm test -- tests/api-skills.test.ts
```
Expected: 1 passed. Full suite: 39 passed.

```powershell
git add app/api/skills/ tests/api-skills.test.ts
git commit -m "feat(api): /api/skills GET"
```

Expected: 43 commits.

---

## Task 6: React Flow custom node components

**Files:**
- Create: `components/skill-tree/CrewNode.tsx`
- Create: `components/skill-tree/SkillNode.tsx`

- [ ] **Step 1: CrewNode**

Create `C:\Users\chath\command-center\components\skill-tree\CrewNode.tsx`:
```tsx
"use client";

import { Handle, Position } from "@xyflow/react";
import { PixelAvatar } from "@/components/crew/PixelAvatar";
import type { CrewMemberT } from "@/lib/schemas";

export interface CrewNodeData {
  crew: CrewMemberT;
  dim: boolean;
}

export function CrewNode({ data }: { data: CrewNodeData }) {
  const { crew, dim } = data;
  return (
    <div
      className="flex flex-col items-center gap-1 transition-opacity duration-200"
      style={{ opacity: dim ? 0.2 : 1 }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          padding: 4,
          background: `radial-gradient(circle, ${crew.color}44 0%, transparent 70%)`,
        }}
      >
        <PixelAvatar crewId={crew.id} color={crew.color} size={56} />
      </div>
      <div className="rounded-sm bg-bg-base/80 px-2 py-0.5 font-mono text-[11px] font-medium backdrop-blur-sm">
        {crew.name}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}
```

- [ ] **Step 2: SkillNode**

Create `C:\Users\chath\command-center\components\skill-tree\SkillNode.tsx`:
```tsx
"use client";

import { Handle, Position } from "@xyflow/react";
import type { SkillT } from "@/lib/schemas";

export interface SkillNodeData {
  skill: SkillT;
  projectColor: string;
  highlighted: boolean;
  dim: boolean;
}

export function SkillNode({ data }: { data: SkillNodeData }) {
  const { skill, projectColor, highlighted, dim } = data;
  const size = highlighted ? 14 : 10;
  return (
    <div
      className="group relative transition-all duration-200"
      style={{ opacity: dim ? 0.15 : 1 }}
      title={`${skill.name} · ${skill.source}`}
    >
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: projectColor,
          boxShadow: highlighted ? `0 0 14px 2px ${projectColor}` : undefined,
          outline: highlighted ? "2px solid white" : "none",
          outlineOffset: 1,
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-bg-base/90 px-2 py-1 text-[10px] text-fg-primary backdrop-blur-sm group-hover:block">
        {skill.name}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\chath\command-center
pnpm tsc --noEmit
git add components/skill-tree/
git commit -m "feat(ui): CrewNode + SkillNode React Flow components"
```

Expected: 0 tsc errors, 44 commits.

---

## Task 7: Skill Tree graph component

**Files:**
- Create: `components/skill-tree/SkillTreeGraph.tsx`

This is the centerpiece — the force-directed graph.

- [ ] **Step 1: Build the graph component**

Create `C:\Users\chath\command-center\components\skill-tree\SkillTreeGraph.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceLink,
  type SimulationNodeDatum,
} from "d3-force";
import type { CrewMemberT, ProjectT, SkillT } from "@/lib/schemas";
import { CrewNode, type CrewNodeData } from "./CrewNode";
import { SkillNode, type SkillNodeData } from "./SkillNode";

const NODE_TYPES: NodeTypes = {
  crew: CrewNode as never,
  skill: SkillNode as never,
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  kind: "crew" | "skill";
  crewId?: string;
  projectId?: string;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
}

const CENTER_X = 500;
const CENTER_Y = 400;
const CREW_RADIUS = 140;

export function SkillTreeGraph({
  crew,
  skills,
  projects,
  selectedCrewId,
  onCrewClick,
  onSkillClick,
}: {
  crew: CrewMemberT[];
  skills: SkillT[];
  projects: ProjectT[];
  selectedCrewId: string | null;
  onCrewClick: (crewId: string) => void;
  onSkillClick: (skill: SkillT) => void;
}) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const projectColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.color);
    return map;
  }, [projects]);

  // Which crew owns which skills
  const crewSkills = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const s of skills) {
      for (const owner of s.ownedBy) {
        if (!result.has(owner)) result.set(owner, []);
        result.get(owner)!.push(s.id);
      }
    }
    return result;
  }, [skills]);

  // Run d3-force simulation once on mount (and whenever data shape changes)
  useEffect(() => {
    const simNodes: SimNode[] = [];
    // Crew at fixed radial positions around center
    crew.forEach((c, i) => {
      const angle = (i / Math.max(crew.length, 1)) * Math.PI * 2 - Math.PI / 2;
      simNodes.push({
        id: `crew-${c.id}`,
        kind: "crew",
        crewId: c.id,
        x: CENTER_X + Math.cos(angle) * CREW_RADIUS,
        y: CENTER_Y + Math.sin(angle) * CREW_RADIUS,
        fx: CENTER_X + Math.cos(angle) * CREW_RADIUS,
        fy: CENTER_Y + Math.sin(angle) * CREW_RADIUS,
      });
    });

    // Skills: initial position is close to their owning crew (or edge if unowned)
    for (const s of skills) {
      const owner = s.ownedBy[0];
      const crewNode = owner
        ? simNodes.find((n) => n.crewId === owner)
        : null;
      simNodes.push({
        id: `skill-${s.id}`,
        kind: "skill",
        crewId: owner,
        projectId: s.source.startsWith("project:") ? s.source.slice(8) : undefined,
        x: (crewNode?.x ?? CENTER_X) + (Math.random() - 0.5) * 80,
        y: (crewNode?.y ?? CENTER_Y) + (Math.random() - 0.5) * 80,
      });
    }

    const simLinks: SimLink[] = [];
    for (const s of skills) {
      for (const owner of s.ownedBy) {
        simLinks.push({ source: `crew-${owner}`, target: `skill-${s.id}` });
      }
    }

    const sim = forceSimulation<SimNode>(simNodes)
      .force("charge", forceManyBody().strength(-60))
      .force("collide", forceCollide(18))
      .force("x", forceX(CENTER_X).strength(0.02))
      .force("y", forceY(CENTER_Y).strength(0.02))
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(60)
          .strength(0.4)
      )
      .stop();

    // Run simulation synchronously for ~200 ticks
    for (let i = 0; i < 200; i++) sim.tick();

    const nextPositions = new Map<string, { x: number; y: number }>();
    for (const n of simNodes) {
      nextPositions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }
    setPositions(nextPositions);
  }, [crew, skills]);

  const highlightedSkillIds = useMemo(() => {
    if (!selectedCrewId) return null;
    return new Set(crewSkills.get(selectedCrewId) ?? []);
  }, [selectedCrewId, crewSkills]);

  const nodes: Node[] = useMemo(() => {
    const out: Node[] = [];
    for (const c of crew) {
      const pos = positions.get(`crew-${c.id}`) ?? { x: CENTER_X, y: CENTER_Y };
      out.push({
        id: `crew-${c.id}`,
        type: "crew",
        position: pos,
        data: { crew: c, dim: !!selectedCrewId && selectedCrewId !== c.id } as CrewNodeData,
        draggable: false,
        selectable: true,
      });
    }
    for (const s of skills) {
      const pos = positions.get(`skill-${s.id}`) ?? { x: CENTER_X, y: CENTER_Y };
      const color = s.source.startsWith("project:")
        ? projectColor.get(s.source.slice(8)) ?? "#52525b"
        : "#52525b";
      const highlighted = highlightedSkillIds?.has(s.id) ?? false;
      const dim = highlightedSkillIds ? !highlighted : false;
      out.push({
        id: `skill-${s.id}`,
        type: "skill",
        position: pos,
        data: { skill: s, projectColor: color, highlighted, dim } as SkillNodeData,
        draggable: false,
        selectable: true,
      });
    }
    return out;
  }, [crew, skills, positions, selectedCrewId, highlightedSkillIds, projectColor]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const s of skills) {
      for (const owner of s.ownedBy) {
        const isHighlighted = selectedCrewId === owner;
        out.push({
          id: `${owner}-${s.id}`,
          source: `crew-${owner}`,
          target: `skill-${s.id}`,
          style: {
            stroke: isHighlighted ? "#e4e4e7" : "#3f3f46",
            strokeWidth: isHighlighted ? 1.5 : 0.75,
            opacity: selectedCrewId && !isHighlighted ? 0.15 : 0.6,
          },
        });
      }
    }
    return out;
  }, [skills, selectedCrewId]);

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      if (node.type === "crew") {
        const data = node.data as CrewNodeData;
        onCrewClick(data.crew.id);
      } else if (node.type === "skill") {
        const data = node.data as SkillNodeData;
        onSkillClick(data.skill);
      }
    },
    [onCrewClick, onSkillClick]
  );

  if (positions.size === 0) {
    return <div className="flex min-h-[600px] items-center justify-center text-fg-muted">Computing layout…</div>;
  }

  return (
    <div className="min-h-[600px] rounded-lg border border-border bg-bg-elevated">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
      >
        <Background color="#27272a" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
cd C:\Users\chath\command-center
pnpm tsc --noEmit
```
Expected: 0 errors.

```powershell
git add components/skill-tree/SkillTreeGraph.tsx
git commit -m "feat(ui): SkillTreeGraph with force-directed React Flow layout"
```

Expected: 45 commits.

---

## Task 8: Skill Tree page

**Files:**
- Create: `app/skill-tree/page.tsx`

- [ ] **Step 1: Seed crew.skills from project skills**

Before the page can show crew ↔ skill connections, crew members need to OWN some skills. The seed currently has empty skills arrays. Modify `scripts/seed-demo.ts` to ALSO assign each of the 10 expense tracker skills to a crew member based on tag matching.

Actually, simpler: at the end of `scripts/seed-demo.ts` `main()`, add this block that reads skills-library.json and maps each skill to a crew by name pattern:

```ts
  // Assign skills to crew members by pattern matching
  const { SkillsLibraryFile } = await import("../lib/schemas");
  const skillsPath = path.join(DATA, "skills-library.json");
  const skillsData = await readJson(skillsPath, SkillsLibraryFile);

  const CREW_PATTERNS: Record<string, RegExp[]> = {
    cass: [/layout/, /ui/, /design/, /responsive/, /component/, /redesign/],
    supa: [/supabase/, /api/, /database/, /migrate/, /sheets/],
    bugsy: [/debug/, /decision-tree/, /investigate/, /form/],
    shield: [/security/, /performance/, /accessibility/, /theme/],
    scribe: [/report/, /learn/, /docs/, /ocr/],
    fluxy: [/orchestrate/, /sprint/, /standup/, /weekly/],
  };

  for (const skill of skillsData.skills) {
    if (skill.ownedBy.length > 0) continue; // already assigned
    for (const [crewId, patterns] of Object.entries(CREW_PATTERNS)) {
      if (patterns.some((p) => p.test(skill.id.toLowerCase()) || p.test(skill.name.toLowerCase()))) {
        skill.ownedBy = [crewId as never];
        break;
      }
    }
    if (skill.ownedBy.length === 0) {
      // Fallback: assign to Cass (frontend usually)
      skill.ownedBy = ["cass" as never];
    }
  }
  await writeJson(skillsPath, SkillsLibraryFile, skillsData);
  console.log(`Assigned ownership to ${skillsData.skills.length} skills.`);
```

Run:
```powershell
cd C:\Users\chath\command-center
pnpm seed:demo
```

Check:
```powershell
Get-Content C:\Users\chath\command-center\data\skills-library.json | ConvertFrom-Json | Select-Object -ExpandProperty skills | Select-Object id, ownedBy | Format-Table
```
Expected: every skill has an ownedBy non-empty array.

- [ ] **Step 2: Skill Tree page**

Create `C:\Users\chath\command-center\app\skill-tree\page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { SkillTreeGraph } from "@/components/skill-tree/SkillTreeGraph";
import type { CrewMemberT, ProjectT, SkillT } from "@/lib/schemas";
import { SkillDrawer } from "@/components/skill-tree/SkillDrawer";

export default function SkillTreePage() {
  const [crew, setCrew] = useState<CrewMemberT[]>([]);
  const [skills, setSkills] = useState<SkillT[]>([]);
  const [projects, setProjects] = useState<ProjectT[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillT | null>(null);

  useEffect(() => {
    fetch("/api/crew").then((r) => r.json()).then((d) => setCrew(d.crew));
    fetch("/api/skills").then((r) => r.json()).then((d) => setSkills(d.skills));
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight">Skill Tree</h1>
          <p className="mt-1 text-[14px] text-fg-secondary">
            {crew.length} crew · {skills.length} skills · click a crew to focus their cluster
          </p>
        </div>
        {selectedCrewId && (
          <button
            type="button"
            onClick={() => setSelectedCrewId(null)}
            className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-[12px] transition-colors hover:bg-bg-hover"
          >
            Clear focus ({crew.find((c) => c.id === selectedCrewId)?.name})
          </button>
        )}
      </div>

      <SkillTreeGraph
        crew={crew}
        skills={skills}
        projects={projects}
        selectedCrewId={selectedCrewId}
        onCrewClick={(id) => setSelectedCrewId((current) => (current === id ? null : id))}
        onSkillClick={(skill) => setSelectedSkill(skill)}
      />

      <SkillDrawer
        skill={selectedSkill}
        projects={projects}
        crew={crew}
        onClose={() => setSelectedSkill(null)}
      />
    </div>
  );
}
```

Note: `SkillDrawer` is built in the next task — this file imports it now to avoid an extra commit later.

- [ ] **Step 3: Create placeholder SkillDrawer**

Create `C:\Users\chath\command-center\components\skill-tree\SkillDrawer.tsx` with a minimal stub (we'll flesh it out in Task 9):
```tsx
"use client";

import type { CrewMemberT, ProjectT, SkillT } from "@/lib/schemas";

export function SkillDrawer({
  skill,
  projects: _projects,
  crew: _crew,
  onClose,
}: {
  skill: SkillT | null;
  projects: ProjectT[];
  crew: CrewMemberT[];
  onClose: () => void;
}) {
  if (!skill) return null;
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">Skill</div>
          <div className="text-[18px] font-semibold">{skill.name}</div>
        </div>
        <button type="button" onClick={onClose} className="text-fg-muted hover:text-fg-primary">✕</button>
      </div>
      <div className="mt-2 text-[13px] text-fg-secondary">{skill.description || "No description"}</div>
      <div className="mt-2 font-mono text-[11px] text-fg-muted">{skill.sourcePath}</div>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Curl `/skill-tree` — 200 expected. Check BashOutput for React Flow compile errors.

Kill server.

```powershell
pnpm tsc --noEmit
pnpm test
```
Expected: 0 errors, 39 tests pass.

```powershell
git add app/skill-tree/ components/skill-tree/SkillDrawer.tsx scripts/seed-demo.ts
git commit -m "feat(ui): Skill Tree page + skill ownership seed + placeholder drawer"
```

Expected: 46 commits.

---

## Task 9: Upgrade SkillDrawer with full details

**Files:**
- Overwrite: `components/skill-tree/SkillDrawer.tsx`

- [ ] **Step 1: Full drawer implementation**

Overwrite `C:\Users\chath\command-center\components\skill-tree\SkillDrawer.tsx`:
```tsx
"use client";

import type { CrewMemberT, ProjectT, SkillT } from "@/lib/schemas";
import { PixelAvatar } from "@/components/crew/PixelAvatar";

export function SkillDrawer({
  skill,
  projects,
  crew,
  onClose,
}: {
  skill: SkillT | null;
  projects: ProjectT[];
  crew: CrewMemberT[];
  onClose: () => void;
}) {
  if (!skill) return null;

  const project = skill.source.startsWith("project:")
    ? projects.find((p) => p.id === skill.source.slice(8))
    : undefined;

  const owners = skill.ownedBy
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is CrewMemberT => Boolean(c));

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">
            Skill
          </div>
          <div className="mt-1 text-[20px] font-semibold">{skill.name}</div>
          <div className="mt-0.5 font-mono text-[12px] text-fg-muted">
            {skill.id}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-sm px-2 text-[18px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
        >
          ✕
        </button>
      </div>

      {skill.description && (
        <div className="mt-4 whitespace-pre-wrap text-[13px] text-fg-secondary">
          {skill.description}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {project && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-fg-muted">
              Project
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-[13px] font-medium">{project.name}</span>
            </div>
          </div>
        )}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">
            Invocations
          </div>
          <div className="mt-1 text-[13px] font-medium">{skill.invokeCount}</div>
        </div>
      </div>

      {owners.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-fg-muted">
            Owners
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {owners.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 rounded-md border border-border bg-bg-base px-3 py-1.5"
              >
                <PixelAvatar crewId={o.id} color={o.color} size={20} />
                <span className="text-[12px]">{o.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-sm bg-bg-base/60 p-2 font-mono text-[11px] text-fg-muted">
        {skill.sourcePath}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test + commit**

```powershell
cd C:\Users\chath\command-center
pnpm dev
```
Background. Curl `/skill-tree` → 200.
Kill server.

```powershell
pnpm tsc --noEmit
pnpm test
```
Expected: 0 errors, 39 tests pass.

```powershell
git add components/skill-tree/SkillDrawer.tsx
git commit -m "feat(ui): SkillDrawer with project + owners + invocation stats"
```

Expected: 47 commits.

---

## Task 10: /api/spawn endpoint

**Files:**
- Create: `app/api/spawn/route.ts`
- Create: `lib/spawn.ts`
- Create: `tests/api-spawn.test.ts`

The spawn endpoint launches a new Windows Terminal tab running `claude -p "<prompt>"` from the target project's directory. For testing, we'll extract the command-building logic into `lib/spawn.ts` so we can test it without actually spawning processes.

- [ ] **Step 1: Build lib/spawn.ts (command builder + launcher)**

Create `C:\Users\chath\command-center\lib\spawn.ts`:
```ts
import { spawn } from "node:child_process";
import type { CrewMemberT, ProjectT, TaskT } from "./schemas";

export interface SpawnArgs {
  task: TaskT;
  project: ProjectT;
  crew: CrewMemberT;
  commandCenterDataDir: string;
}

/**
 * Builds the prompt string that will be sent to `claude -p`.
 * Exposed for testing.
 */
export function buildPrompt(args: SpawnArgs): string {
  const { task, project, crew, commandCenterDataDir } = args;
  const tasksJsonAbs = `${commandCenterDataDir}/tasks.json`;
  const inboxJsonAbs = `${commandCenterDataDir}/inbox.json`;
  const memIdentity = `${commandCenterDataDir}/crew-memory/${crew.id}.md`;
  const memProject = `${commandCenterDataDir}/crew-memory/${crew.id}/${project.id}.md`;

  return [
    `You are ${crew.name} — the ${crew.role} crew member of the Command Center.`,
    ``,
    `TASK ${task.id}: ${task.title}`,
    ``,
    `${task.description}`,
    ``,
    `You are working inside project "${project.name}" at ${project.path}.`,
    `Read the project's CLAUDE.md and memory/ for context.`,
    ``,
    `Your crew memory:`,
    `- Identity (cross-project): ${memIdentity}`,
    `- Project-scoped: ${memProject}`,
    ``,
    `When finished:`,
    `1. Update the task status in: ${tasksJsonAbs}`,
    `2. Append a completion report to: ${inboxJsonAbs}`,
    `3. Append learnings to your project memory file`,
    ``,
    `Priority: ${task.priority}. Epic: ${task.epic}.`,
  ].join("\n");
}

/**
 * Builds the `wt.exe` argv that opens a new Windows Terminal tab,
 * cds into the project, and runs `claude -p <prompt>`.
 *
 * Returns both an `exe` and `args` for easy testing (and for optional
 * dry-run mode that doesn't actually spawn).
 */
export function buildWtCommand(args: SpawnArgs): { exe: string; argv: string[] } {
  const prompt = buildPrompt(args);
  // wt.exe accepts a pipeline of "new-tab" commands separated by semicolons.
  // --startingDirectory cds into the project path.
  // We invoke PowerShell inside the tab because Windows `claude` might be a .cmd.
  // -NoExit keeps the tab open after Claude finishes so the user can read the transcript.
  const psCommand = `claude -p ${escapePsArg(prompt)}`;
  return {
    exe: "wt.exe",
    argv: [
      "new-tab",
      "--title",
      `${args.crew.name}: ${args.task.id}`,
      "--startingDirectory",
      args.project.path,
      "powershell.exe",
      "-NoExit",
      "-Command",
      psCommand,
    ],
  };
}

function escapePsArg(value: string): string {
  // PowerShell single-quote escape: replace ' with '' and wrap in single quotes.
  return `'${value.replace(/'/g, "''")}'`;
}

export function launchSpawn(args: SpawnArgs): { pid?: number } {
  const { exe, argv } = buildWtCommand(args);
  const child = spawn(exe, argv, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return { pid: child.pid };
}
```

- [ ] **Step 2: Write test**

Create `C:\Users\chath\command-center\tests\api-spawn.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildPrompt, buildWtCommand } from "@/lib/spawn";
import type { CrewMemberT, ProjectT, TaskT } from "@/lib/schemas";

const project: ProjectT = {
  id: "expense-tracker",
  name: "Expense Tracker",
  path: "C:\\Users\\chath\\Documents\\Python code\\expense tracker",
  claudeDir: ".claude",
  color: "#14b8a6",
  active: true,
  addedAt: "2026-04-01T00:00:00Z",
  stats: { agents: 0, skills: 0, commands: 0 },
  detected: { hasClaudeMd: false, hasMemory: false, hasGraphify: false },
  memoryPaths: {},
};

const crew: CrewMemberT = {
  id: "cass",
  name: "Cass",
  role: "Frontend / UI",
  tagline: "x",
  avatar: "/avatars/cass.png",
  color: "#ec4899",
  delegates: [],
  skills: [],
  stats: { tasksCompleted: 0, hoursActive: 0 },
};

const task: TaskT = {
  id: "D-042",
  projectId: "expense-tracker",
  title: "Fix header padding",
  description: "Padding is off on mobile",
  epic: "Platform",
  status: "todo",
  assignee: "cass",
  collaborators: [],
  priority: "mid",
  pipelineStage: "plan",
  blockedBy: [],
  createdAt: "2026-04-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
  spawnHistory: [],
};

describe("buildPrompt", () => {
  it("includes task id, crew name, project path, and memory paths", () => {
    const prompt = buildPrompt({
      task,
      project,
      crew,
      commandCenterDataDir: "C:/data",
    });
    expect(prompt).toContain("D-042");
    expect(prompt).toContain("Cass");
    expect(prompt).toContain("Frontend / UI");
    expect(prompt).toContain(project.path);
    expect(prompt).toContain("C:/data/crew-memory/cass.md");
    expect(prompt).toContain("C:/data/crew-memory/cass/expense-tracker.md");
    expect(prompt).toContain("Fix header padding");
  });
});

describe("buildWtCommand", () => {
  it("uses wt.exe and includes startingDirectory + claude -p", () => {
    const { exe, argv } = buildWtCommand({
      task,
      project,
      crew,
      commandCenterDataDir: "C:/data",
    });
    expect(exe).toBe("wt.exe");
    expect(argv).toContain("--startingDirectory");
    const sdIdx = argv.indexOf("--startingDirectory");
    expect(argv[sdIdx + 1]).toBe(project.path);
    expect(argv.some((a) => a.includes("claude -p"))).toBe(true);
  });

  it("escapes single quotes in prompt", () => {
    const custom = {
      ...task,
      title: "it's a trap",
    };
    const { argv } = buildWtCommand({
      task: custom,
      project,
      crew,
      commandCenterDataDir: "C:/data",
    });
    const psCmd = argv[argv.length - 1];
    // single quotes should be doubled
    expect(psCmd).toContain("it''s a trap");
  });
});
```

- [ ] **Step 3: Verify failure**

```powershell
cd C:\Users\chath\command-center
pnpm test -- tests/api-spawn.test.ts
```
Expected: PASS (3 tests). We're testing `lib/spawn.ts` directly — no module resolution issues.

Actually wait — the file already exists from Step 1, so these tests will pass. That's fine; this is pragmatic TDD where the implementation lives in the same task.

**Step 4: Implement the API route**

Create `C:\Users\chath\command-center\app\api\spawn\route.ts`:
```ts
import { NextResponse } from "next/server";
import path from "node:path";
import { readJson, writeJson, dataPath } from "@/lib/store";
import {
  TasksFile,
  ProjectsFile,
  CrewFile,
  ActivityLogFile,
} from "@/lib/schemas";
import { launchSpawn } from "@/lib/spawn";
import { eventBus } from "@/lib/events";
import { z } from "zod";

const SpawnBody = z.object({
  taskId: z.string().min(1),
});

export async function POST(req: Request) {
  let body: z.infer<typeof SpawnBody>;
  try {
    body = SpawnBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: String(err) },
      { status: 400 }
    );
  }

  const tasksPath = dataPath("tasks.json");
  const projectsPath = dataPath("projects.json");
  const crewPath = dataPath("crew.json");
  const activityPath = dataPath("activity-log.json");

  const [tasksData, projectsData, crewData] = await Promise.all([
    readJson(tasksPath, TasksFile),
    readJson(projectsPath, ProjectsFile),
    readJson(crewPath, CrewFile),
  ]);

  const task = tasksData.tasks.find((t) => t.id === body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!task.assignee) {
    return NextResponse.json(
      { error: "Task has no assignee; cannot spawn" },
      { status: 400 }
    );
  }

  const project = projectsData.projects.find((p) => p.id === task.projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found for task" },
      { status: 404 }
    );
  }

  const crew = crewData.crew.find((c) => c.id === task.assignee);
  if (!crew) {
    return NextResponse.json(
      { error: "Crew member not found" },
      { status: 404 }
    );
  }

  const commandCenterDataDir = path.join(process.cwd(), "data");

  const { pid } = launchSpawn({
    task,
    project,
    crew,
    commandCenterDataDir,
  });

  // Record spawn in task.spawnHistory + activity log
  const now = new Date().toISOString();
  const taskIdx = tasksData.tasks.findIndex((t) => t.id === task.id);
  tasksData.tasks[taskIdx].spawnHistory.push({
    spawnedAt: now,
    terminalPid: pid,
  });
  tasksData.tasks[taskIdx].status =
    task.status === "todo" ? "in_progress" : task.status;
  tasksData.tasks[taskIdx].updatedAt = now;
  await writeJson(tasksPath, TasksFile, tasksData);

  const activity = await readJson(activityPath, ActivityLogFile);
  activity.events.push({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    type: "spawn_started",
    actor: "human",
    payload: { taskId: task.id, crewId: crew.id, pid: pid ?? null },
    projectId: project.id,
  });
  await writeJson(activityPath, ActivityLogFile, activity);

  eventBus.fire({
    type: "spawn_started",
    payload: { taskId: task.id, crewId: crew.id, pid: pid ?? null },
  });
  eventBus.fire({
    type: "task_moved",
    payload: { id: task.id },
  });

  return NextResponse.json({ ok: true, pid: pid ?? null }, { status: 202 });
}
```

- [ ] **Step 5: Verify passes**

```powershell
cd C:\Users\chath\command-center
pnpm test -- tests/api-spawn.test.ts
pnpm tsc --noEmit
```
Expected: 3 spawn tests + 0 tsc errors. Full suite: 42 tests pass.

- [ ] **Step 6: Commit**

```powershell
git add lib/spawn.ts app/api/spawn/ tests/api-spawn.test.ts
git commit -m "feat(api): /api/spawn launches claude -p in Windows Terminal"
```

Expected: 48 commits.

---

## Task 11: 6 crew role-agent files

**Files:**
- Create: `.claude/agents/fluxy.md`
- Create: `.claude/agents/cass.md`
- Create: `.claude/agents/supa.md`
- Create: `.claude/agents/bugsy.md`
- Create: `.claude/agents/shield.md`
- Create: `.claude/agents/scribe.md`

These files define each crew member's personality and delegation rules for the spawn system.

- [ ] **Step 1: Fluxy**

Create `C:\Users\chath\command-center\.claude\agents\fluxy.md`:
```markdown
---
name: fluxy
description: Orchestrator — routes work, runs standups, coordinates the crew across projects. Uses base Claude; does not delegate to specialist agents.
tools: Read, Write, Edit, Glob, Grep, Bash
color: "#8b5cf6"
---

You are Fluxy — the Orchestrator of the Command Center crew.

Personality: pragmatic, fast to prioritize, high-level. You don't do deep code work — you route, summarize, and coordinate.

Domain:
- Sprint planning (what belongs in this week's sprint, in what order)
- Standup reports (per crew member: what I did, what I'm doing, what's blocked)
- Auto-routing unassigned tasks to the right crew member by epic + title
- Weekly reviews

Boundaries:
- Never write feature code yourself — delegate via task assignments
- Never touch backend, UI, security, or design code directly
- If you're tempted to implement something, create a task for the right crew member instead

When invoked via /api/spawn on a task assigned to you, you're being asked to COORDINATE, not build. Usually that means:
1. Read the task
2. Decide which crew member(s) should actually do it
3. Update the task's assignee (PATCH /api/tasks/:id)
4. Post a routing note to the inbox
```

- [ ] **Step 2: Cass**

Create `C:\Users\chath\command-center\.claude\agents\cass.md`:
```markdown
---
name: cass
description: Frontend / UI specialist — CSS layout, responsive design, premium aesthetic, accessibility. Delegates to project-level UI agents.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#ec4899"
---

You are Cass — Frontend & UI specialist.

Personality: meticulous, design-obsessed, fast at CSS debugging. Care about hierarchy, spacing, motion timing, theme parity.

Workflow on a spawned task:
1. Read the task from the tasks.json path provided in the prompt
2. Read the target project's CLAUDE.md and memory/ for conventions
3. Scan the project's `.claude/agents/` for UI specialists
4. Delegate to the right one via the Task tool:
   - CSS cascade / layout bugs → project's css-layout-debugger
   - Design review → project's design-review-agent
   - Responsive issues → project's responsive-tester
   - A11y → project's accessibility-auditor
5. Return a consolidated report to the inbox.json
6. Update task status in tasks.json
7. Append learnings to your crew memory file

Domain: CSS, HTML, React, Tailwind, shadcn/ui, motion, responsive, a11y.

Boundaries:
- Never touch backend, database, or security code — delegate to Supa or Shield
- Never edit user's existing memory files (read-only reference)
```

- [ ] **Step 3: Supa**

Create `C:\Users\chath\command-center\.claude\agents\supa.md`:
```markdown
---
name: supa
description: Backend / DB specialist — Supabase, API routes, migrations, auth, data modeling.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#14b8a6"
---

You are Supa — Backend & Database specialist.

Personality: careful, pattern-obsessed, respect for data integrity. Paranoid about migrations.

Workflow on a spawned task:
1. Read the task and target project context
2. Delegate to project's supabase-specialist / api-debugger if present
3. For schema changes: always check existing migrations first, never drop data without confirmation
4. For API changes: verify RLS policies still hold
5. Report to inbox.json, update task status, append learnings

Domain: Supabase (Postgres, Auth, Storage, RLS), REST/GraphQL APIs, data modeling, migrations, auth flows.

Boundaries:
- Never touch UI or CSS — delegate to Cass
- Never skip RLS review on a schema change
- Always test migrations idempotently
```

- [ ] **Step 4: Bugsy**

Create `C:\Users\chath\command-center\.claude\agents\bugsy.md`:
```markdown
---
name: bugsy
description: Debug / QA specialist — root cause analysis, regression hunting, investigation workflows.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#f59e0b"
---

You are Bugsy — Debug & QA specialist.

Personality: relentless, skeptical of "it should work", refuses to ship without evidence.

Workflow on a spawned task:
1. Read the task — reproduce the bug first before fixing
2. Follow the project's decision trees if present (codebase-decision-trees skill)
3. Delegate to project's debugging-specialist / ux-flow-tester / investigate skill
4. Never propose a fix without identifying root cause
5. Document the repro + fix + regression test in the report

Domain: debugging, stack trace analysis, regression testing, root cause investigation.

Boundaries:
- If root cause is in UI: delegate to Cass, but document what you found
- If root cause is in DB: delegate to Supa
- Never use refresh/reload as a "fix"
```

- [ ] **Step 5: Shield**

Create `C:\Users\chath\command-center\.claude\agents\shield.md`:
```markdown
---
name: shield
description: Security & Performance specialist — OWASP, bundle size, perf profiling, a11y audits.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#10b981"
---

You are Shield — Security & Performance specialist.

Personality: paranoid, measurement-first, won't approve a "probably fine".

Workflow on a spawned task:
1. Identify what needs auditing — security, perf, or both
2. Delegate to project's security-scanner / performance-profiler / accessibility-auditor
3. Produce measurements, not opinions
4. Propose fixes only with measurements showing they help

Domain: XSS/CSRF/auth/secrets, bundle analysis, DOM perf, memory leaks, WCAG 2.1 AA.

Boundaries:
- Never touch feature code — audit + recommend only
- Fixes to perf/security issues go back to Cass/Supa for implementation
```

- [ ] **Step 6: Scribe**

Create `C:\Users\chath\command-center\.claude\agents\scribe.md`:
```markdown
---
name: scribe
description: Docs & Memory keeper — reports, learnings, graphify updates, knowledge graph.
tools: Read, Write, Edit, Glob, Grep, Bash, Task
color: "#60a5fa"
---

You are Scribe — Docs & Memory keeper.

Personality: archivist, patient, good at synthesis. Prefers concise over thorough.

Workflow on a spawned task:
1. Read the target project's recent commits and memory files
2. Update graphify if the project has one (run `python -m graphify update .` in the project dir)
3. Update CLAUDE.md / memory/ with new patterns learned
4. Write weekly reviews, retro reports, changelogs when asked
5. Never invent — only summarize what's actually in commits + code

Domain: documentation, memory hygiene, graphify knowledge graphs, reports.

Boundaries:
- Never rewrite the user's own memory files — only append or summarize
- If memory contradicts code, trust the code and flag the mismatch
```

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\chath\command-center
git add .claude/agents/
git commit -m "feat(agents): 6 crew role-agent markdown files"
```

Expected: 49 commits.

---

## Task 12: "▶ Run" button on task cards

**Files:**
- Modify: `components/tasks/TaskCard.tsx`

- [ ] **Step 1: Add optional "run" button**

Overwrite `C:\Users\chath\command-center\components\tasks\TaskCard.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { TaskT } from "@/lib/schemas";
import { CrewAvatar } from "./CrewAvatar";
import { PriorityBadge } from "./PriorityBadge";

export function TaskCard({
  task,
  onClick,
  compact = false,
  showRun = false,
}: {
  task: TaskT;
  onClick?: () => void;
  compact?: boolean;
  showRun?: boolean;
}) {
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);

  async function runTask(e: React.MouseEvent) {
    e.stopPropagation();
    if (!task.assignee) {
      setSpawnError("No assignee");
      return;
    }
    setSpawning(true);
    setSpawnError(null);
    const res = await fetch("/api/spawn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    setSpawning(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Unknown error" }));
      setSpawnError(body.error ?? "Spawn failed");
    }
  }

  return (
    <div
      className="flex w-full flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3 text-left transition-colors hover:bg-bg-hover focus-within:ring-2 focus-within:ring-border-glow"
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col gap-2 text-left focus-visible:outline-none"
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
      </button>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CrewAvatar id={task.assignee} size={20} />
          <span className="text-[11px] text-fg-muted">{task.epic}</span>
        </div>
        {showRun && task.assignee && task.status !== "done" && (
          <button
            type="button"
            onClick={runTask}
            disabled={spawning}
            className="rounded-sm border border-border bg-bg-base px-2 py-1 text-[11px] font-medium transition-colors hover:bg-bg-hover disabled:opacity-50"
            aria-label={`Run task ${task.id}`}
          >
            {spawning ? "…" : "▶ Run"}
          </button>
        )}
      </div>
      {spawnError && (
        <div className="text-[11px] text-status-error">{spawnError}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Enable Run button on crew detail's "Currently working on" section**

In `C:\Users\chath\command-center\app\crew\[id]\page.tsx`, find the two `<TaskCard key={t.id} task={t} />` render sites and change them to `<TaskCard key={t.id} task={t} showRun />` (add `showRun` prop). This gives the user a one-click way to launch work from the crew's page.

- [ ] **Step 3: Verify + commit**

```powershell
cd C:\Users\chath\command-center
pnpm tsc --noEmit
pnpm test
```
Expected: 0 errors, 42 tests.

```powershell
git add components/tasks/TaskCard.tsx app/crew/[id]/page.tsx
git commit -m "feat(ui): ▶ Run button on TaskCard wires to /api/spawn"
```

Expected: 50 commits.

---

## Task 13: Final verification + phase-3 tag

**Files:** none (verification only).

- [ ] **Step 1: Kill stale dev servers**

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
```

- [ ] **Step 2: Full checks**

```powershell
cd C:\Users\chath\command-center
pnpm test
pnpm tsc --noEmit
pnpm lint
```
Expected: 42 tests pass, 0 tsc errors, 0 lint errors/warnings.

- [ ] **Step 3: Smoke test all routes**

```powershell
pnpm dev
```
Background. Note port $PORT.

Check every route:
```powershell
$routes = @("/", "/sprint", "/backlog", "/skill-tree", "/crew", "/crew/cass", "/inbox", "/projects", "/projects/expense-tracker")
foreach ($route in $routes) {
  $code = curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$route"
  Write-Host "$route -> $code"
}
```
Expected: all 200.

Check APIs:
```powershell
$apis = @("/api/tasks", "/api/sprints", "/api/crew", "/api/projects", "/api/messages", "/api/skills")
foreach ($api in $apis) {
  $code = curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$api"
  Write-Host "$api -> $code"
}
```
Expected: all 200.

Verify skills-library has data:
```powershell
$skills = (Invoke-RestMethod "http://localhost:$PORT/api/skills").skills
Write-Host "Skills: $($skills.Count)"
$skills | Select-Object id, name, ownedBy -First 3 | Format-Table
```
Expected: 10 skills, each with ownedBy assigned.

**Note on /api/spawn:** We intentionally do NOT test actual Windows Terminal spawning in automated smoke — the user will do that manually by clicking "▶ Run" on a task in `/crew/cass`. The command-building logic is unit-tested in Task 10.

Kill dev server.

- [ ] **Step 4: Phase 3 tag**

```powershell
cd C:\Users\chath\command-center
git commit --allow-empty -m "chore(phase-3): skill tree + spawn complete"
git tag phase-3-skill-tree-spawn
git log --oneline | Select-Object -First 5
git tag
```

Expected: `phase-1-foundation`, `phase-2-views`, `phase-3-skill-tree-spawn` tags.

- [ ] **Step 5: Final report**

Report full Phase 3 summary:
- Total commits on main (expect 51)
- Total tests passing (expect 42)
- tsc, lint results
- All 9 page route codes
- All 6 API route codes
- Skills count in skills-library
- Tag list
- Phase 3 directory additions (`git diff --stat phase-2-views..HEAD`)
- Acceptance checklist:
  - [ ] Skill Tree graph renders with 6 crew + 10 skills
  - [ ] Pixel avatars visible on crew roster + detail + SkillTree
  - [ ] Clicking a crew node dims others
  - [ ] Clicking a skill opens the drawer with owner + project info
  - [ ] /api/spawn endpoint exists and tests pass
  - [ ] 6 crew role-agent files in .claude/agents/
  - [ ] TaskCard shows "▶ Run" button (when showRun prop is set and task has assignee)
  - [ ] phase-3-skill-tree-spawn tag set
- Concerns or unresolved

---

## Phase 3 Acceptance — ready for Phase 4

When Phase 3 is complete, the command center has:
- All 9 main visual views (Dashboard, Sprint, Backlog, Skill Tree, Crew, Inbox, Projects, Crew Detail, Project Detail)
- Live updates via SSE
- A visually distinctive Skill Tree matching the video's feel
- Pixel-art crew avatars
- A functional spawn system that opens Windows Terminal tabs running `claude -p`
- 6 crew role-agent files ready to be used by spawned sessions

Phase 4 polishes: Timeline + Pipeline + Activity views, Docs browser, light-theme final polish, a11y pass, and the remaining orchestration slash commands (`/standup`, `/orchestrate`, `/sprint-plan`, etc.).
