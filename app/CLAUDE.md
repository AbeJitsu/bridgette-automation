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
- **Nightly eval scheduler** — Server-level scheduler in `server.ts` that runs all 4 eval types at configured time with hourly intervals. Schedules next night after current cycle completes. Config persisted to `.nightly-eval-config` JSON file. Coexists with idle-timer auto-eval (separate system). Handles graceful startup/shutdown with proper timeout cleanup.

### Polish Remaining
- Design system refinements

## Key Architecture

- **Terminal:** Real PTY via node-pty, connected to xterm.js in the browser over `/ws/terminal` WebSocket. User runs `claude` (or any command) interactively with full color and tool approvals.
- **Auto-eval:** Still uses `claude --print --stream-json` spawned headlessly. Streams output to connected clients via `/ws/chat`.
- **Nightly scheduler:** Separate from idle-timer auto-eval. Uses same `triggerServerAutoEval()` but overrides eval type rotation. Configured via Automations UI (NightlyScheduleCard component). Runs independently on schedule, doesn't reset timer.
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

## Development Workflow

### Problem

The server runs as a persistent background process via launchd (`com.bridgette.server`). During development and testing, this causes conflicts:

- New dev server instances fail because port 3000 is occupied
- Manual testing of nightly scheduler requires stopping/restarting
- Need clear steps to safely test without breaking production behavior

### Solution

Use `scripts/dev-control.sh` to manage server lifecycle during development.

### Phase 1: Prepare for Development

Stop the background service and free port 3000:

```bash
./scripts/dev-control.sh stop
```

Verify port is free:

```bash
./scripts/dev-control.sh status
```

Expected output: "Port 3000 is free"

### Phase 2: Run Dev Server for Testing

Start the development server:

```bash
cd app
../scripts/dev-control.sh dev
```

The server will start in the foreground. You can now:
- Test API endpoints
- Configure the nightly scheduler
- Observe logs in real-time
- Press `Ctrl+C` to stop when done

### Phase 3: Configure Nightly Schedule (via browser)

While dev server is running:

1. Open http://localhost:3000 in your browser
2. Navigate to the **Automations** tab
3. Scroll to the **Nightly Schedule** card
4. Configure:
   - **Start time:** Set to current time + 2 minutes (allows time for testing)
   - **Interval:** Set to 1 minute (short interval for rapid testing)
   - **Toggle:** Enable nightly eval (switch to "on")
5. Watch server logs as the scheduled time approaches

### Phase 4: Verify Execution

After the scheduled time passes, check these indicators:

**Server logs:**
```bash
tail -100 /tmp/bridgette-dev.log
```
Look for: `[nightly] Triggering frontend eval`

**Git commits:**
```bash
git log --oneline | head -5
```

**Eval log entry:**
```bash
cat eval-log.json | tail -1
```

**Tasks created:**
```bash
cat tasks.json | grep -A 2 '"title"' | tail -5
```

### Phase 5: Restore Production Behavior

Restart the launchd service:

```bash
./scripts/dev-control.sh start
```

Verify it's running:

```bash
./scripts/dev-control.sh status
```

### Troubleshooting

**Port still in use after `dev-control stop`:**
```bash
lsof -i:3000 | tail -1 | awk '{print $2}' | xargs kill -9
lsof -i:3000  # should return empty
```

**Nightly schedule never triggered:**
- Check server is running: `curl -s http://localhost:3000/api/health`
- Check schedule is configured: `cat .nightly-eval-config`
- Check WebSocket connection in browser DevTools
- Check server logs: `tail -100 /tmp/bridgette-dev.log | grep -i 'nightly\|schedule'`

**Dev server won't start:**
```bash
pkill -f "npm run dev"
pkill -f "tsx server.ts"
sleep 2
./scripts/dev-control.sh dev
```

**Want to manually trigger eval:**
Click the **"Run Now"** button in the Status tab.

### Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/dev-control.sh` | Lifecycle management (stop/start/dev/status) |
| `app/server.ts` | Nightly scheduler logic |
| `app/components/Automations.tsx` | Nightly schedule UI configuration |
| `.nightly-eval-config` | Current schedule (stored at project root) |
| `.auto-eval-index` | Tracks which eval type runs next (0-4 rotation) |
| `eval-log.json` | Complete history of all evals (success/error) |
| `tasks.json` | Tasks created by evals (needs_testing status) |
| `/tmp/bridgette-dev.log` | Dev server logs while running |

## Testing

### Nightly Auto-Eval Scheduler Testing Checklist

Use this checklist when testing the nightly auto-eval scheduler.

#### Pre-Test Setup

- [ ] Run `./scripts/dev-control.sh stop` to free port 3000
- [ ] Verify: `./scripts/dev-control.sh status` shows port is free
- [ ] Run dev server: `cd app && npm run dev`
- [ ] Wait for "Ready on http://localhost:3000" in server logs
- [ ] Verify: `curl http://localhost:3000/api/health` returns 200

#### Configuration

- [ ] Open http://localhost:3000 in browser
- [ ] Click on "Automations" tab
- [ ] Scroll to "Nightly Schedule" section
- [ ] Set start time to current time + 2 minutes
- [ ] Set interval to 1 minute (for faster testing)
- [ ] Toggle "Enabled" to ON
- [ ] Verify save: check server logs for `[nightly] Scheduled to start at` message

#### Execution Monitoring

**Server Logs:**
```bash
tail -f /tmp/bridgette-dev.log
```

Watch for:
- [ ] `[nightly] Triggering frontend eval (1/5)`
- [ ] `[auto-eval] Started frontend eval` with process ID
- [ ] `[auto-eval] Process exited with code 0`

**Browser Console:**
- [ ] WebSocket connection to `/ws/chat` is active
- [ ] Message: `WS: { type: 'evalRunning', running: true }`
- [ ] Message: `WS: { type: 'auto_eval_complete', status: 'success' }`

#### Results Verification

- [ ] Navigate to "Eval Logs" tab — new entry at top
- [ ] Entry shows type: "frontend" and status: "success"
- [ ] `git log --oneline | head -5` shows new commit
- [ ] `cat tasks.json | tail -50` shows new task with status "needs_testing"
- [ ] `.auto-eval-index` contains `1` (next eval type)

#### Cleanup

- [ ] Press Ctrl+C to stop dev server
- [ ] Run `./scripts/dev-control.sh start` to restore launchd service
- [ ] Verify: `./scripts/dev-control.sh status` shows service is running
- [ ] Optional: Disable nightly schedule in UI if not needed

#### If Something Fails

**Nightly scheduler doesn't trigger:**
- Verify time was set correctly: `cat .nightly-eval-config | grep startTime`
- Check toggle is ON: check `.nightly-eval-config` has `"enabled": true`
- Look for errors: `grep -i "error\|warn" /tmp/bridgette-dev.log`

**Eval hangs (stuck in execution):**
- Check Claude process: `ps aux | grep claude | grep -v grep`
- Kill if stuck: `pkill -f "claude --print"`

**Git commits not created:**
- Check git status: `git status`
- Check current branch: `git branch` (should be on `dev`)
- Check merge conflicts: `git status | grep -i "conflict"`

**Tasks not created:**
- Verify tasks API: `curl http://localhost:3000/api/tasks`
- Check if tasks.json is valid JSON: `jq . tasks.json`

**Wrong eval type triggers:**
- Check index file: `cat .auto-eval-index`
- Manually reset: `echo "0" > .auto-eval-index`
- Restart dev server

#### Final Verification

Before marking scheduler as tested and working:

- [ ] All eval types triggered successfully in correct order
- [ ] Each eval created a task with status "needs_testing"
- [ ] Each eval created a git commit with meaningful changes
- [ ] Browser UI shows eval running state correctly
- [ ] Eval Logs tab shows entries with correct types and status
- [ ] Config properly persisted
- [ ] No errors in server logs related to nightly scheduler
- [ ] Dev server remained stable
