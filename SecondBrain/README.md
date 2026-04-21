# Chaitanya's Second Brain

A personal knowledge vault for the FluxGen Expense Tracker and related projects, built with Obsidian + Graphify for Claude Code consumption.

## Structure (PARA + extensions)

| Folder | Purpose |
|---|---|
| `01-Inbox` | Scratchpad for unprocessed notes. Review weekly. |
| `02-Projects` | Active projects with defined outcomes (e.g. FluxGen Attendance port) |
| `03-Areas` | Ongoing responsibilities (work, health, etc.) |
| `04-Resources` | Reference material (Flutter docs, Supabase patterns) |
| `05-Archive` | Completed / abandoned projects |
| `06-Daily` | Daily journal entries — use Daily Notes plugin |
| `10-Code-Context` | Architecture, conventions, decisions for codebases |
| `20-Decisions` | ADRs (Architecture Decision Records) |
| `30-People` | Colleagues, collaborators, contact notes |
| `99-Attachments` | Images, PDFs, diagrams referenced by notes |

## How Claude Code uses this

1. Graphify runs on this vault + the expense-tracker codebase.
2. Every Claude Code session reads `graphify-out/GRAPH_REPORT.md` automatically.
3. When answering questions, Claude traverses the graph (code ↔ notes ↔ decisions) instead of grepping raw files.

## Key entry points

- [[10-Code-Context/FluxGen-Architecture]] — full stack overview
- [[10-Code-Context/Attendance-Feature]] — the 4-phase port spec
- [[20-Decisions/000-index]] — all architecture decisions
- [[02-Projects/FluxGen-v2.1.0]] — current release

## Conventions

- Every note starts with YAML frontmatter: `tags`, `created`, `updated`
- Link liberally with `[[double brackets]]`
- Keep notes under ~500 words — split if bigger
- Use `#todo` for action items
