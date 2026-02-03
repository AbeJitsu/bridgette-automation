# Bridgette App — Directory Notes

## What This Is

**Bridgette** — a Next.js dashboard with a real interactive terminal (xterm.js + node-pty) as the primary interface. Custom server with WebSocket support. Terminal connects via `/ws/terminal` to a PTY shell — run `claude` interactively or use as a regular terminal.

## Current State

### Built
- `server.ts` — Custom HTTP + WebSocket server on port 3000. `/ws/terminal` spawns a PTY via node-pty for interactive shell access. `/ws/chat` handles auto-eval streaming via `claude --print --stream-json`. Auto-iteration system with four-eval rotation (checks exit codes). WebSocket heartbeat (30s ping/pong). Process lifecycle management.
- `components/Terminal.tsx` — Real interactive terminal (xterm.js + node-pty). Connects to `/ws/terminal`, auto-fits to container, handles resize events, auto-reconnects. Listens for `bridgette-send-to-chat` and `bridgette-set-cwd` events from automations and task panels. Dynamically imported (`ssr: false`).
- `components/TaskPanel.tsx` — Left/right task sidebars with add/advance/delete, inline rename (double-click), clear completed button, collapsible via chevron toggle.
- `components/MemoryEditor.tsx` — File sidebar grouped by directory, monospace editor, Cmd+S save, unsaved indicator.
- `components/Automations.tsx` — Lists automations with BJJ belt colors, view/copy prompts, curl examples.
- `components/EvalLogs.tsx` — Auto-eval run history with type filtering, expandable diffs, status indicators.
- `components/Status.tsx` — Server health, git info, memory timestamps, auto-eval config visualization, launchd job status.
- `app/page.tsx` — Dashboard with five-tab navigation (Chat/Terminal, Memory, Automations, Eval Logs, Status). Cmd+1-5 tab shortcuts. WAI-ARIA compliant tab panels.
- `lib/auth.ts` — Authentication middleware for API routes.

### Polish Remaining
- Design system refinements

## Key Architecture

- **Terminal:** Real PTY via node-pty, connected to xterm.js in the browser over `/ws/terminal` WebSocket. User runs `claude` (or any command) interactively with full color and tool approvals.
- **Auto-eval:** Still uses `claude --print --stream-json` spawned headlessly. Streams output to connected clients via `/ws/chat`.
- **Auto-iteration:** Server-level idle timer, four-eval rotation (frontend → backend → functionality → memory), merges main into dev before each run. Validates exit codes — failed evals log as "error". Stop button in UI.
- **Process management:** Graceful shutdown, PTY and child process cleanup on server restart.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/ws/terminal` | WebSocket | Interactive PTY terminal (xterm.js) |
| `/ws/chat` | WebSocket | Auto-eval streaming, eval control |
| `/api/memory` | GET | List all memory .md files |
| `/api/memory/[...filepath]` | GET/PUT | Read/write memory file (path traversal guarded) |
| `/api/automations` | GET | List all automations |
| `/api/automations/[name]` | GET/POST | Read/trigger automation |
| `/api/health` | GET | Server uptime and status |
| `/api/tasks` | GET/POST | List/create tasks |
| `/api/tasks/[id]` | PUT/DELETE | Update/delete task |
| `/api/tasks/clear-completed` | POST | Remove all completed tasks |
| `/api/tasks/advance-all` | POST | Bulk advance tasks between statuses |
| `/api/directories` | GET | List project directories |
| `/api/eval-logs` | GET | Auto-eval run history |
| `/api/status` | GET | Server health, git, eval config, launchd |

## Things Discovered

- `claude --print` hangs when stdin is a pipe — must use `'ignore'` (still used for auto-eval)
- xterm CSS must be imported in globals.css (`@import "@xterm/xterm/css/xterm.css"`)
- node-pty needs `serverExternalPackages` in next.config.ts to avoid webpack bundling
- node-pty@1.1.0 fails with `posix_spawnp` on Node 22 + macOS arm64 — use 1.0.0
- xterm.js uses browser globals (`self`) — must dynamically import with `ssr: false`
- PTY resize events sent as JSON `{ type: "resize", cols, rows }` — regular input is raw strings
- `@tailwindcss/typography` `@import` doesn't work with Next.js 15 + Tailwind v4
