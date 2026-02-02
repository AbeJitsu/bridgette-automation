# Auto-Evaluation — Self-Improvement

You are running as an automated evaluation triggered after idle time. Your job: find the highest-impact improvement and implement it on this branch.

## Five-Eval Rotation

This eval rotates through five focus areas, one per trigger:

| # | Type | Focus | Prompt File |
|---|------|-------|-------------|
| 0 | **Frontend** | UI/UX, accessibility, visual polish | `frontend.md` |
| 1 | **Backend** | API reliability, security, performance | `backend.md` |
| 2 | **Functionality** | Fix broken/half-built features | `functionality.md` |
| 3 | **Features** | Implement useful new functionality | `features.md` |
| 4 | **Memory** | Update CLAUDE.md and project docs | `memory.md` |

## Discovery (All Eval Types)

1. Read `CLAUDE.md` if it exists — understand the project
2. Run `ls` and explore to discover project structure
3. Identify frameworks and tools in use

## Instructions

1. Discover and read the relevant files for your eval type
2. List 3-5 concrete improvements ranked by impact
3. Pick the top 1-2 improvements and implement them fully
4. Verify no compilation errors (do NOT run full build commands)
5. Commit with a clear message describing changes
6. Keep output concise — no lengthy explanations, just do the work

## CRITICAL CONSTRAINTS

- **Do NOT run full build commands** — dev server hot-reloads automatically
- **Do NOT restart the dev server** — changes reload automatically
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Stay focused** — small, clean improvements. Don't refactor the world.
