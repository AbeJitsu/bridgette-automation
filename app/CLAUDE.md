# Bridgette App — Directory Notes

## What This Is

**Bridgette** — a Next.js dashboard wrapping a live interactive Claude Code session in the browser. Custom server with WebSocket support for the terminal PTY connection.

## Current State

### Built
- `server.ts` — Custom HTTP + WebSocket server on port 3000. Spawns `claude` via node-pty. Handles reconnection (PTY stays alive when browser disconnects).
- `components/Terminal.tsx` — xterm.js terminal with fit addon, web links addon, Tokyo Night theme. Connects via WebSocket, sends keystrokes, renders output.
- `components/MemoryEditor.tsx` — File sidebar grouped by directory, monospace editor, Cmd+S save, unsaved change indicator, save status feedback.
- `components/Automations.tsx` — Lists automations with BJJ belt colors, view/copy prompts, curl examples for scheduling.
- `app/page.tsx` — Dashboard home with three-tab navigation (Terminal, Memory, Automations).
- `app/layout.tsx` — Root layout with metadata, Tailwind CSS.
- `app/globals.css` — Tailwind + xterm.js CSS imports.
- `app/api/memory/route.ts` — Lists all .md files with size and modified date.
- `app/api/memory/[...filepath]/route.ts` — Read/write individual files (with path traversal guard).
- `app/api/automations/route.ts` — Lists automations with titles from prompt.md headings.
- `app/api/automations/[name]/route.ts` — Read/trigger specific automation prompt.
- `app/api/health/route.ts` — Server uptime and status.

### Not Yet Built
- Log viewer — automation run history
- Status page — launchd jobs, server health
- Working directory selector for terminal
- New session button (kill/respawn PTY)

## Key Architecture

- **Custom server (`server.ts`):** Handles HTTP + WebSocket upgrade on same port. One active PTY session — reconnects on browser refresh rather than spawning new.
- **Terminal component:** Dynamic imports for xterm.js (browser-only). Sends resize events to server. Status indicator (connected/connecting/disconnected).
- **Session lifecycle:** PTY persists independently of WebSocket. Browser close doesn't kill the session. "New session" button (not yet built) will kill and respawn.

## Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| `node-pty` | PTY spawning | Installed, working |
| `@xterm/xterm` + addons | Terminal rendering | Installed, working |
| `ws` | WebSocket server | Installed, working |
| `next` + `react` + `tailwindcss` | UI framework | Installed, working |
| `tsx` | Run TypeScript server | Installed, working |

## API Routes (Planned)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/ws/terminal` | WebSocket | PTY ↔ browser | Built |
| `/api/memory` | GET | List all memory .md files | Built |
| `/api/memory/[...filepath]` | GET/PUT | Read/write memory file | Built |
| `/api/automations` | GET | List all automations | Built |
| `/api/automations/[name]` | GET/POST | Read/trigger automation | Built |
| `/api/health` | GET | Server uptime and status | Built |

## Design System

Follow BJJ belt color progression (emerald → blue → purple → gold). See `.claude/rules/colors.md` and `.claude/rules/design-brief.md`.

## Things Discovered

- xterm CSS must be imported in globals.css, not dynamically — Next.js build fails on dynamic CSS imports
- node-pty needs `serverExternalPackages` in next.config.ts to avoid webpack trying to bundle native modules
- @next/swc version mismatch warning (15.5.7 vs 15.5.11) is cosmetic
- tsx works well for running the custom TypeScript server in dev
- Catch-all route `[...filepath]` handles nested paths like `context/decisions.md` cleanly
- Path traversal guard in memory API prevents reading files outside memory/
