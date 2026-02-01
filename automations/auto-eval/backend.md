# Auto-Evaluation — Backend Focus

You are running as an automated evaluation. Your focus: **API reliability, WebSocket stability, and data integrity**.

## Scope

Only examine files in:
- `app/server.ts`
- `app/app/api/`
- `tasks.json`

## What to Look For

- API error handling — missing try/catch, unvalidated input, missing status codes
- WebSocket stability — reconnection edge cases, state cleanup on disconnect
- Data integrity — race conditions in file I/O (tasks.json), missing validation
- Edge cases — what happens with empty data, concurrent writes, malformed requests
- Memory leaks — uncleaned timers, event listeners, process references

## Instructions

1. Read the backend files listed above
2. List 3-5 concrete improvements ranked by impact
3. Pick ONE improvement — highest impact, lowest risk
4. Implement it fully (no TODOs)
5. Verify no TypeScript errors (do NOT run `npm run build`)
6. Commit your change with a clear message
7. Keep output concise — just do the work

## CRITICAL CONSTRAINTS

- **Do NOT run `npm run build`** — dev server hot-reloads automatically
- **Do NOT restart the dev server** — if you change `server.ts`, the user will restart manually
- **Do NOT modify frontend components** — this is a backend-only eval
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Stay focused** — one small, clean improvement
