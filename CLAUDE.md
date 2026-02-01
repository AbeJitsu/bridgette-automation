# Bridgette — Project Memory

## What This Project Is

**Bridgette** is a native replacement for OpenClaw. A Next.js dashboard with a chat UI powered by `claude --print --stream-json`, plus a legacy PTY terminal, memory editor, and automations panel. Authenticated through macOS Keychain with Max subscription. Runs on the Mac Mini at localhost:3000.

## Current State

### What's Built
- **Chat UI** — Polished chat interface powered by `claude --print --output-format=stream-json`. Real-time streaming text, markdown rendering, tool use cards, cost tracking, session continuity via `--resume`
- **Working directory selector** — Browse and select project directories from the UI. Claude runs in the chosen directory context
- **New chat button** — Clear conversation and start fresh
- **Terminal (legacy)** — PTY-based terminal via node-pty + xterm.js. Kept as fallback tab
- **Memory system** — All personality, identity, and context files merged from ~/claude-memory into `memory/`
- **Memory editor** — Sidebar file browser, monospace editor, Cmd+S save, unsaved indicator
- **Automations panel** — View/copy prompt templates, BJJ belt color coding, curl examples
- **API routes** — `/api/memory/*` CRUD, `/api/automations/*` list/trigger, `/api/health`, `/api/directories`
- **Prompt templates** — Content creation, job search, codebase eval in `automations/`
- **launchd plists** — Scheduled curl triggers (5 AM daily, weekly Monday) + install script
- **Three-panel chat layout** — Pending tasks (left), chat (center), in-progress/completed tasks (right)
- **Task management** — Add/advance/delete tasks via sidebars, persisted to `tasks.json`, API at `/api/tasks`
- **Dark mode** — Full dark theme (gray-950 bg), dark markdown styles, dark tool cards
- **Dashboard** — Four-tab layout (Chat, Terminal, Memory, Automations) with BJJ belt colors
- **Stop hook** — Blocks Claude from stopping if build is failing; forces iteration until passing
- **Build passes** — `next build` clean, dev server runs on localhost:3000, all APIs tested

### What's Left
- **Log viewer** — View automation run history
- **Status page** — launchd job status, memory file timestamps, server health
- **Polish** — Design system refinements, responsive layout

## Architecture

```
Browser (Chat UI)  ←WebSocket /ws/chat→  server.ts  ←stdio pipes→  claude --print --stream-json
Browser (Terminal)  ←WebSocket /ws/terminal→  server.ts  ←node-pty→  claude (interactive PTY)
```

- **Chat core:** `claude --print --output-format=stream-json --verbose --include-partial-messages` spawned per message via `child_process.spawn`. Session continuity via `--resume <session-id>`. Working directory configurable per connection.
- **Terminal (legacy):** node-pty spawns `claude` in PTY, WebSocket pipes to xterm.js in browser
- **Dashboard:** Next.js app with chat, memory editor, automation triggers
- **Memory:** Markdown files in `memory/` — curated, not automated
- **Scheduling:** launchd plists curl API routes on schedule
- **Auth:** Keychain via Max subscription (no API key needed)

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `memory/` | Personality, identity, persistent facts, context |
| `app/` | Next.js dashboard (Bridgette) |
| `automations/` | Prompt templates for scheduled tasks |
| `launchd/` | launchd plist files for scheduling |

## Decisions Made

- Named the dashboard **Bridgette** after the assistant personality
- Chat UI over PTY terminal — `claude --print --stream-json` gives structured events, no PTY needed in sandbox
- PTY terminal kept as fallback — useful when running from real terminal (not sandbox)
- `stdio: ['ignore', 'pipe', 'pipe']` — claude hangs when stdin is a pipe; must be `'ignore'`
- Next.js API routes for orchestration — automations trigger via REST
- Markdown as database — memory files are the source of truth, no DB
- Merged ~/claude-memory into this repo under `memory/`
- Custom server.ts required — Next.js API routes can't do raw WebSocket upgrade

## Things Discovered During Build

- `create-next-app` interactive prompts block in non-TTY — had to scaffold manually
- xterm CSS can't be dynamically imported in Next.js — must go in globals.css
- @next/swc version mismatch warning is cosmetic, doesn't affect functionality
- node-pty must be in `serverExternalPackages` in next.config.ts to avoid webpack bundling
- Next.js catch-all routes (`[...filepath]`) work well for nested file paths in the memory API
- launchd plists should stagger times (5:00, 5:15) to avoid overlapping curl calls
- `claude --print` hangs when spawned with `stdio: ['pipe', ...]` — stdin must be `'ignore'`
- `--include-partial-messages` gives `stream_event` with `content_block_delta` for real-time streaming
- `--resume <session-id>` works for multi-turn conversations via `--print` mode
- `@tailwindcss/typography` `@import` doesn't work with Next.js 15 + Tailwind v4 — use custom CSS classes instead
- Hook commands with `$CLAUDE_PROJECT_DIR` must be quoted (`"$CLAUDE_PROJECT_DIR/..."`) when the project path contains spaces
- `npm run dev` uses `server.ts` (custom server) — don't use `npx tsx server.ts` separately, the npm script handles it
- When restarting the dev server, always `kill -9` the process on port 3000 first, then wait for port to be free before restarting
- Task data stored in `tasks.json` at project root (not in `app/`)

## Task Management

`tasks.json` at the project root is the kanban board. Follow these rules:

- **Before starting work:** Read `tasks.json`, create tasks for planned work, move relevant task to `in_progress`
- **Before building:** Check tasks — any `in_progress` tasks should reflect what you're about to build
- **Before testing:** Update task status if tests relate to a task
- **Before documenting:** Check if documentation tasks exist, create if needed
- **After completing work:** Move task to `completed`
- **API (if server running):** `curl localhost:3000/api/tasks` to read, POST to create, PUT to update
- **Direct file edit also fine:** Can read/write `tasks.json` directly if the server isn't running

Task schema:
```json
{ "id": "uuid", "title": "...", "status": "pending|needs_testing|completed", "createdAt": "ISO" }
```

## Commands

```bash
cd app && npm run dev    # Start Bridgette (includes WebSocket server)
cd app && npm run build  # Production build
```

## Dev Server

Always ensure the dev server is running on port 3000 so the user can test changes in the browser.

- **Before making UI changes:** Check `lsof -ti:3000` — start the server if it's not running
- **After changes that affect server.ts or API routes:** Kill and restart (`kill -9 $(lsof -ti:3000) && cd app && npm run dev`)
- **After build failures:** Fix the issue, then verify the server is still running
- **Never leave the server down** after finishing work
