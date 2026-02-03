# Bridgette — Project Memory

## What This Project Is

**Bridgette** is a native replacement for OpenClaw. A Next.js dashboard with a real interactive terminal (xterm.js + node-pty) as the primary interface, plus a memory editor and automations panel. Authenticated through macOS Keychain with Max subscription. Runs on the Mac Mini at localhost:3000.

## Current State

### What's Built
- **Terminal** — Real interactive PTY terminal (xterm.js + node-pty) as the primary Chat tab. Full shell access — run `claude` interactively with colors, tool approvals, slash commands, or use as a regular terminal. Connected via `/ws/terminal` WebSocket. Auto-reconnects on disconnect.
- **Working directory selector** — Browse and select project directories from the UI. Sends `cd` command to the terminal PTY
- **Memory system** — All personality, identity, and context files merged from ~/claude-memory into `memory/`
- **Memory editor** — Sidebar file browser, monospace editor, Cmd+S save, unsaved indicator
- **Automations panel** — View/copy prompt templates, BJJ belt color coding, curl examples
- **API routes** — `/api/memory/*` CRUD, `/api/automations/*` list/trigger, `/api/health`, `/api/directories`, `/api/status`, `/api/eval-logs`
- **Prompt templates** — Content creation, job search, codebase eval in `automations/`
- **launchd plists** — Scheduled curl triggers (5 AM daily, weekly Monday) + install script
- **Three-panel terminal layout** — Pending tasks (left), terminal (center), in-progress/completed tasks (right)
- **Task management** — Add/advance/delete/rename tasks via sidebars, clear completed, auto-purge at 500, persisted to `tasks.json`, API at `/api/tasks`
- **Dark mode** — Full dark theme (gray-950 bg), dark terminal theme with emerald cursor
- **Dashboard** — Five-tab layout (Chat/Terminal, Memory, Automations, Eval Logs, Status) with BJJ belt colors
- **Stop hook** — Blocks Claude from stopping if build is failing; forces iteration until passing
- **Eval Logs tab** — View auto-eval run history with type filtering, expandable diffs, status indicators. Supports frontend/backend/functionality/memory eval types
- **Status tab** — Server health, git info, memory file timestamps, auto-eval config with rotation visualization, launchd job status. Auto-refreshes every 30s
- **Send to Terminal** — Automations inject prompt text directly into the PTY terminal
- **Code block copy** — Click-to-copy on curl examples
- **Backend hardening v2** — Shell injection guard, corruption recovery, rate limiting, temp file cleanup, graceful 400 on invalid memory PUT
- **Eval logs improvements** — Auto-refresh, reverse chronological order, type filtering
- **Text contrast fixes** — Improved contrast and input focus across all tabs
- **Direct task creation** — Server creates tasks internally without self-referencing HTTP API
- **Task descriptions** — Optional description field on tasks for additional context
- **execSync timeouts** — All shell commands have explicit timeouts to prevent event loop blocking
- **Eval-log pagination** — Backend filtering and pagination for eval-log API
- **Status bar grouping** — Grouped status indicators, keyboard accessible, reduced-motion support
- **Model name formatting** — Opus 4.5 selector fix, proper display names
- **Tab shortcuts** — Cmd+1-5 switches dashboard tabs
- **Stop auto-eval button** — "Run Now" becomes stop button while eval is running
- **Collapsible task panels** — Chevron toggle collapses sidebars, expands chat area
- **Auto-eval exit code checking** — Failed evals log as "error" instead of false "success"; no task creation or chaining on failure
- **Status route optimization** — Consolidated 3 sequential git commands into 1 (max blocking time 15s → 5s)
- **Frontend a11y** — WAI-ARIA tab panel pattern (hidden/tabIndex), aria-labels on icon buttons, aria-expanded on dropdowns, responsive status bar
- **Memory write cleanup** — Orphan .tmp files cleaned up when rename fails
- **Eval task pipeline** — Auto-evals create pending tasks, advance to needs_testing on completion for user review
- **Resizable panels** — Horizontal drag on task sidebars (180–500px), vertical drag between needs_testing/completed
- **Secure remote access** — Bearer token auth on all routes + WebSocket, token prompt for non-localhost, Tailscale-ready
- **Browser notifications** — Native OS notifications when auto-evals complete while tab is in background
- **Collapsed panel badges** — Task count badges on collapsed sidebar buttons (green pending, amber needs_testing)
- **Bulk task operations** — "Done all" button advances all needs_testing tasks at once, `/api/tasks/advance-all` endpoint
- **Process safety** — 5MB stdout buffer cap on eval processes, PTY cleanup on disconnect and graceful shutdown
- **Task priorities** — High/normal/low priority with red border highlights, sorting, click-to-cycle button
- **Responsive layout** — Auto-collapse sidebars under 1024px, icon-only tabs on mobile, wrapped navigation
- **Eval task deduplication** — Skips creating needs_testing task when duplicate exists; race condition fix in close handler
- **Memory editor empty state** — Placeholder when no files exist
- **Connection cleanup** — Rate limit counters cleaned on stale connections
- **Build passes** — `next build` clean, dev server runs on localhost:3000, all APIs tested
- **Task-to-terminal action** — "chat" button on tasks injects title + description as text into the PTY
- **Keyboard shortcuts overlay** — Cmd+/ toggles grouped shortcut reference panel, also linked from input footer
- **Working directory persistence** — Selection saved to localStorage, restored on page reload, session-aware
- **Automation execution** — Automation queue system for inter-process communication; POST /api/automations/{name} queues prompts, server executes on next WebSocket event; scheduled curl triggers work end-to-end
- **Responsive task polling** — Task list polls every 1s for snappy feedback when auto-eval creates tasks
- **Nightly eval schedule** — Configurable nightly cycle running all 4 eval types (frontend, backend, functionality, memory) sequentially with hourly intervals. Start time + interval configurable via UI. Runs independently from idle-timer auto-eval. Config persisted to `.nightly-eval-config`. All prompts rewritten to use TDD and fix minimum 5 issues per eval.

### What's Left
- **Polish** — Design system refinements

## Architecture

```
Browser (xterm.js)  ←WebSocket /ws/terminal→  server.ts  ←node-pty→  /bin/zsh (user's shell)
Browser (auto-eval) ←WebSocket /ws/chat→      server.ts  ←stdio→     claude --print --stream-json
```

- **Terminal:** Real PTY via node-pty, connected to xterm.js in the browser over `/ws/terminal` WebSocket. User runs `claude` (or any command) interactively. Dynamically imported (`ssr: false`) to avoid xterm browser global issues.
- **Auto-eval:** Still uses `claude --print --stream-json` spawned headlessly for automated eval runs. Streams output to connected clients via `/ws/chat`.
- **Dashboard:** Next.js app with five tabs: Chat/Terminal, Memory, Automations, Eval Logs, Status
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
- Real PTY terminal over structured chat UI — interactive `claude` with full color, tool approvals, slash commands beats parsed stream-json. The old `claude --print --stream-json` chat UI is replaced.
- node-pty@1.0.0, not 1.1.0 — version 1.1.0 has a `posix_spawnp` bug on Node 22/macOS arm64
- Terminal component dynamically imported (`ssr: false`) — xterm.js references `self` which breaks Next.js SSR/prerendering
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
- `claude --print` hangs when spawned with `stdio: ['pipe', ...]` — stdin must be `'ignore'` (still used for auto-eval)
- node-pty@1.1.0 fails with `posix_spawnp` on Node 22 + macOS arm64 — downgrade to 1.0.0 fixes it
- xterm.js uses browser globals (`self`) — must use `dynamic(() => import(...), { ssr: false })` in Next.js
- PTY resize events must be sent as JSON `{ type: "resize", cols, rows }` — regular input is raw strings
- `@tailwindcss/typography` `@import` doesn't work with Next.js 15 + Tailwind v4 — use custom CSS classes instead
- Hook commands with `$CLAUDE_PROJECT_DIR` must be quoted (`"$CLAUDE_PROJECT_DIR/..."`) when the project path contains spaces
- `npm run dev` uses `server.ts` (custom server) — don't use `npx tsx server.ts` separately, the npm script handles it
- When restarting the dev server, always `kill -9` the process on port 3000 first, then wait for port to be free before restarting
- Task data stored in `tasks.json` at project root (not in `app/`)

## Task Management

`tasks.json` at the project root is the kanban board. **Always use it.**

### Status Flow
```
pending → needs_testing → completed
```

### Every Session — Do This
1. **Start of session:** `curl -s localhost:3000/api/tasks` — check for pending and needs_testing tasks
2. **Before starting work:** Create tasks for planned work (`POST /api/tasks`), or pick up existing pending tasks
3. **While working:** Move task to `needs_testing` once the code is written and basic verification done
4. **After testing:** Move to `completed` only after verifying the feature works in the browser or via API tests
5. **End of session:** Check for any tasks still in pending or needs_testing — flag them

### API
```bash
curl -s localhost:3000/api/tasks                    # List all
curl -s -X POST localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Task name"}'                        # Create
curl -s -X PUT localhost:3000/api/tasks/ID \
  -H "Content-Type: application/json" \
  -d '{"status":"needs_testing"}'                    # Advance
curl -s -X DELETE localhost:3000/api/tasks/ID        # Delete
curl -s -X POST localhost:3000/api/tasks/advance-all \
  -H "Content-Type: application/json" \
  -d '{"from":"needs_testing","to":"completed"}'     # Bulk advance
```

Direct file edit of `tasks.json` also works if the server isn't running.

### Task Schema
```json
{ "id": "uuid", "title": "...", "status": "pending|needs_testing|completed", "createdAt": "ISO" }
```

## Auto-Iteration System

Auto-eval runs at the **server level** — works with or without a browser connected.

- **Server-level idle timer** — resets on any chat message, triggers after 15 min idle
- **Persisted state** — `.auto-eval-enabled` file at project root, survives server restarts
- **Headless operation** — if no browser is connected, eval runs and logs to console
- **Broadcast** — if browsers are connected, eval output streams to all clients
- **Always works on `dev` branch**, never main
- Switches to `dev` (creates from main if it doesn't exist), merges `main` into `dev` before running, then commits there
- If merge conflicts occur, aborts merge and skips the eval
- After eval completes, broadcasts `auto_eval_complete` with `git diff --stat` summary
- Don't chain evals back-to-back — timer resets after each run
- **Manual trigger** — UI "Run Now" button or send `{ type: "trigger_auto_eval" }` via WS

### Four-Eval Rotation

Evals rotate through four focus areas, one per trigger:

| Index | Type | Prompt File |
|-------|------|-------------|
| 0 | **frontend** | `automations/auto-eval/frontend.md` |
| 1 | **backend** | `automations/auto-eval/backend.md` |
| 2 | **functionality** | `automations/auto-eval/functionality.md` |
| 3 | **memory** | `automations/auto-eval/memory.md` |

- Current index persisted in `.auto-eval-index` at project root
- After each eval, index advances and wraps (0 → 1 → 2 → 3 → 0)
- Failed evals (non-zero exit code) log as "error" — no task creation or chaining on failure
- Server broadcasts `evalType` in `auto_eval_start` and state messages
- Connected clients see `evalRunning` and `evalType` in the initial `state` event
- "Run Now" button becomes a stop button while an eval is running

### Eval Fixes Log

All fixes from nightly evals are documented in `.nightly-eval-fixes.md`:

- **Purpose** — Track what issues were fixed to avoid duplication and understand codebase state
- **Format** — Markdown log with issue name, description, solution, and commit reference
- **Maintenance** — Each eval appends its fixes to this log after completing
- **Usage** — Future evals read this at the start to focus on remaining high-impact issues

### Testing

```bash
cd app && npm run test:run   # Unit + integration tests (vitest)
```

Tests cover rotation math (unit) and WebSocket message flow (integration, requires dev server on :3000).

## Commands

```bash
cd app && npm run dev    # Start Bridgette (includes WebSocket server)
cd app && npm run build  # Production build
```

## Dev Server

Always ensure the dev server is running on port 3000 so the user can test changes in the browser.

### Proper Restart Sequence

When restarting after code changes (especially `server.ts`):

```bash
# 1. Kill the existing process(es)
pkill -f "npm run dev" || true
pkill -f "tsx server.ts" || true
sleep 1

# 2. Verify port is free
lsof -i :3000 && echo "Port still in use!" || echo "Port is free"

# 3. Start with nohup (proper backgrounding)
nohup npm run dev > /tmp/bridgette-dev.log 2>&1 &
sleep 4

# 4. Verify it's responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expect: 200
```

### Checklist

- **Before making UI changes:** Check `lsof -ti:3000` — start the server if it's not running
- **After changes that affect server.ts or API routes:** Follow the restart sequence above (kill + wait + start + verify)
- **After build or any code changes:** Restart dev server and verify with curl (expect 200)
- **After build failures:** Fix the issue, restart the server, verify it returns 200
- **Never leave the server down** after finishing work
- **Verification sequence:** Kill old → Verify port free → Start with nohup → Confirm 200 → Done

### Why nohup?

`npm run dev &` doesn't truly background the process. Use `nohup` to properly detach from the parent shell. The `&` alone can leave zombie/stale processes behind that block port 3000.

## Documentation

Keep these docs updated when features change:

- **`CLAUDE.md`** — Architecture, decisions, task management, auto-eval docs
- **`roadmap.md`** — What's built, what's next, project structure

When completing a feature or significant change, update both files before committing.
