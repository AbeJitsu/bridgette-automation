# Auto-Evaluation — Backend Focus

You are running as an automated evaluation. Your focus: **API reliability, security, and performance**.

## Discovery

1. Read `CLAUDE.md` if it exists — understand what the project is and how it's structured
2. Run `ls` and explore to find backend files (server, API routes, database, middleware)
3. Identify the backend framework in use (Express, Next.js API, FastAPI, etc.)

## What to Look For

- API error handling — missing try/catch, unvalidated input, missing status codes
- WebSocket/realtime stability — reconnection edge cases, state cleanup on disconnect
- Data integrity — race conditions in file I/O, missing validation
- Edge cases — what happens with empty data, concurrent writes, malformed requests
- Memory leaks — uncleaned timers, event listeners, process references
- Security — path traversal, injection, missing input sanitization
- Logging gaps — errors that silently fail with no trace

## Instructions

1. Discover and read ALL backend files — understand the full picture
2. List 5-10 concrete improvements ranked by reliability impact
3. Implement the **top 2-3 improvements** — go for changes that prevent real bugs or data loss
4. Each improvement should be complete (no TODOs, no placeholders)
5. Verify no TypeScript/compilation errors (do NOT run full build commands)
6. Commit with a clear message describing ALL changes made
7. If a fix spans multiple files, that's fine — do it right

## What "Meaningful" Means

- Adding a single try/catch is NOT meaningful. Fixing a whole class of unhandled errors IS.
- Validating one field is NOT meaningful. Adding proper input validation to an entire API route IS.
- A cosmetic log message is NOT meaningful. Adding error recovery that prevents data corruption IS.
- Think: "Would this change prevent a real bug that could happen in production?"

## CRITICAL CONSTRAINTS

- **Do NOT run full build commands** — dev server hot-reloads automatically
- **Do NOT restart the dev server** — if you change server files, the user will restart manually
- **Do NOT modify frontend components** — this is a backend-only eval
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Be ambitious** — make changes that matter
