# Development Workflow for Testing Nightly Auto-Eval Scheduler

## Problem

The server runs as a persistent background process via launchd (`com.bridgette.server`). During development and testing, this causes conflicts:

- New dev server instances fail because port 3000 is occupied
- Manual testing of nightly scheduler requires stopping/restarting
- Need clear steps to safely test without breaking production behavior

## Solution

Use `scripts/dev-control.sh` to manage server lifecycle during development.

## Workflow

### Phase 1: Prepare for Development (one-time)

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

The nightly scheduler will trigger automatically at the configured start time.

### Phase 4: Verify Execution

After the scheduled time passes, check these indicators that the eval ran:

**Server logs:**
```bash
tail -100 /tmp/bridgette-dev.log
```
Look for: `[nightly] Triggering frontend eval`

**Git commits:**
```bash
git log --oneline | head -5
```
Should show new commits from the eval (e.g., "Fix: ...")

**Eval log entry:**
```bash
cat eval-log.json | tail -1
```
Should show new entry with `"status": "success"`

**Tasks created:**
```bash
cat tasks.json | grep -A 2 '"title"' | tail -5
```
Should show new eval task marked `needs_testing`

### Phase 5: Restore Production Behavior

Restart the launchd service:

```bash
./scripts/dev-control.sh start
```

Verify it's running:

```bash
./scripts/dev-control.sh status
```

Expected output: "Service com.bridgette.server is running"

## Troubleshooting

### Port still in use after `dev-control stop`

If port 3000 remains in use:

```bash
# Kill any remaining processes
lsof -i:3000 | tail -1 | awk '{print $2}' | xargs kill -9

# Verify port is free
lsof -i:3000
# (should return empty)
```

### Nightly schedule never triggered

**Check 1: Server is running**
```bash
curl -s http://localhost:3000/api/health
```
Should return `{"status":"ok"}`

**Check 2: Schedule is configured**
```bash
cat .nightly-eval-config
```
Should show your start time and interval

**Check 3: WebSocket connection**
Open browser DevTools Console (Cmd+Option+J) and look for successful WebSocket connection messages. Should see `[ws] Connected` or similar.

**Check 4: Server logs**
```bash
tail -100 /tmp/bridgette-dev.log | grep -i 'nightly\|schedule'
```
Look for scheduler startup messages or timing logs

### Dev server won't start (port 3000 still occupied)

```bash
# Force kill anything on port 3000
pkill -f "npm run dev"
pkill -f "tsx server.ts"
sleep 2

# Verify port is free
lsof -i:3000

# Start dev server again
./scripts/dev-control.sh dev
```

### Want to manually trigger eval right now (without waiting for scheduled time)

Open the browser UI while dev server is running and click the **"Run Now"** button in the Status tab. This triggers an eval immediately without affecting the nightly schedule.

### Eval runs but shows status "error" instead of "success"

Check the eval log for details:
```bash
cat eval-log.json | jq '.[] | select(.status=="error")' | head -20
```

Look for the `errors` field which contains the failure message. Common issues:
- Git merge conflicts (check `git status`)
- Build failures (run `npm run build` manually to see errors)
- Memory file corruption (check `.tmp` files, run cleanup)

### Changes to server.ts don't take effect

When modifying `app/server.ts`, you must restart the dev server:

```bash
# Stop current dev server (Ctrl+C in terminal)
# Then restart:
./scripts/dev-control.sh dev
```

The dev server doesn't auto-reload for server-side changes.

## Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/dev-control.sh` | Lifecycle management (stop/start/dev/status) |
| `app/server.ts` | Nightly scheduler logic (lines 141-235) |
| `app/components/Automations.tsx` | Nightly schedule UI configuration |
| `.nightly-eval-config` | Current schedule (stored at project root) |
| `.auto-eval-index` | Tracks which eval type runs next (0-4 rotation) |
| `eval-log.json` | Complete history of all evals (success/error) |
| `tasks.json` | Tasks created by evals (needs_testing status) |
| `/tmp/bridgette-dev.log` | Dev server logs while running |

## Development Tips

### Quick Test Loop

For rapid testing of scheduler changes:

```bash
# 1. Stop production
./scripts/dev-control.sh stop

# 2. Start dev server
cd app && ../scripts/dev-control.sh dev
# (leaves terminal open for log watching)

# 3. In another terminal, configure UI
# Open http://localhost:3000/automations
# Set start time to now + 1 minute, interval = 1 minute

# 4. Watch logs in dev server terminal
# Should see [nightly] messages as schedule triggers

# 5. Restore production
./scripts/dev-control.sh start
```

### Resetting Nightly Config Between Tests

To clear configuration and start fresh:

```bash
rm .nightly-eval-config
rm eval-log.json
rm .auto-eval-index
```

(The server will recreate them with defaults when you open the UI)

### Checking Actual System Time vs Scheduled Time

If scheduler seems off:

```bash
# Check system time
date

# Check what the server thinks (from logs)
tail -20 /tmp/bridgette-dev.log | grep -i 'current\|time'
```

The scheduler uses system clock, so ensure your Mac's time is correct: System Preferences → Date & Time.

## When to Use This Workflow

| Scenario | Use this workflow? |
|----------|-------------------|
| Testing nightly scheduler trigger times | Yes |
| Testing eval cycle rotation (frontend → backend → functionality → memory) | Yes |
| Testing schedule UI and persistence | Yes |
| Testing git commits/tasks created by evals | Yes |
| Regular development (features, UI changes) | No - just run `npm run dev` normally |
| Quick API testing | No - dev server can run alongside launchd |
