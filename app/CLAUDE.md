# App — Directory Notes

## What This Is

Next.js dashboard application. Custom server with WebSocket support for the terminal PTY connection.

## Key Architecture

- **Custom server (`server.ts` in root):** Handles HTTP + WebSocket upgrade on same port
- **Terminal component:** xterm.js connects via WebSocket to PTY
- **API routes:** REST endpoints for memory CRUD, automation triggers, health checks
- **One active claude session at a time** — reconnect on browser refresh

## Dependencies

- `node-pty` — PTY spawning
- `xterm.js` + `@xterm/addon-fit` + `@xterm/addon-web-links` — terminal rendering
- `ws` — WebSocket server
- `next` + `react` + `tailwindcss` — UI framework

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/memory` | GET | List all memory .md files |
| `/api/memory/[file]` | GET/PUT | Read/write memory file |
| `/api/automations/[name]` | POST | Trigger automation |
| `/api/health` | GET | Health check |

## Design System

Follow BJJ belt color progression (emerald → blue → purple → gold). See `.claude/rules/colors.md` and `.claude/rules/design-brief.md`.

## Things Discovered

<!-- Add learnings about the app here -->
