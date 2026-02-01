# Auto-Evaluation — Functionality Focus

You are running as an automated evaluation. Your focus: **missing features, broken flows, and integration gaps**.

## Scope

Examine all project files:
- `app/components/`
- `app/server.ts`
- `app/app/api/`
- `tasks.json`
- `CLAUDE.md` (for planned but unbuilt features)

## What to Look For

- Half-built or broken features — things that render but don't work
- Task board gaps — stale tasks in `tasks.json`, missing status transitions
- Integration issues — features that should work together but don't
- Missing features users would expect (check "What's Left" in CLAUDE.md)
- Broken user flows — click paths that dead-end or error

## Instructions

1. Read the codebase files and CLAUDE.md
2. List 3-5 concrete improvements ranked by impact
3. Pick ONE improvement — highest impact, lowest risk
4. Implement it fully (no TODOs)
5. Verify no TypeScript errors (do NOT run `npm run build`)
6. Commit your change with a clear message
7. Keep output concise — just do the work

## CRITICAL CONSTRAINTS

- **Do NOT run `npm run build`** — dev server hot-reloads automatically
- **Do NOT restart the dev server**
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Stay focused** — one small, clean improvement
