# Nightly Scheduler Testing Checklist

Use this checklist when testing the nightly auto-eval scheduler. All five eval types (frontend, backend, functionality, features, memory) should cycle through in sequence.

## Pre-Test Setup

- [ ] Run `./scripts/dev-control.sh stop` to free port 3000
- [ ] Verify: `./scripts/dev-control.sh status` shows port is free
- [ ] Run dev server: `cd app && npm run dev` (or `../scripts/dev-control.sh dev`)
- [ ] Wait for "Ready on http://localhost:3000" in server logs
- [ ] Verify: `curl http://localhost:3000/api/health` returns 200

## Configuration

- [ ] Open http://localhost:3000 in browser
- [ ] Click on "Automations" tab (5th tab in navigation)
- [ ] Scroll to "Nightly Schedule" section
- [ ] Set start time to current time + 2 minutes (e.g., if 3:15 PM now, set to 3:17 PM)
- [ ] Set interval to 1 minute (for faster testing, normally hourly)
- [ ] Toggle "Enabled" to ON
- [ ] Verify save: check server logs for `[nightly] Scheduled to start at` message

## Execution Monitoring

### Server Logs

In terminal, watch server logs:
```bash
tail -f /tmp/bridgette-dev.log
```

Watch for (within 2-3 minutes):
- [ ] `[nightly] Triggering frontend eval (1/5)` (first eval of the cycle)
- [ ] `[auto-eval] Starting frontend eval` with process ID
- [ ] `[auto-eval] Process exited with code 0` (success) or non-zero code
- [ ] Log shows eval duration in milliseconds

### Browser Console

Open browser DevTools (Cmd+Option+I) and watch:

Network tab:
- [ ] WebSocket connection to `/ws/chat` is active (blue "101 Switching Protocols")

Console tab (filter for "eval" or "WS") — search DevTools console for messages starting with "WS:":
- [ ] Message: `WS: { type: 'evalRunning', running: true }`
- [ ] Message: `WS: { type: 'auto_eval_complete', status: 'success', evalType: 'frontend' }`
- [ ] Message shows `evalType: frontend` (or whatever eval is running)

## Results Verification

After eval completes (watch logs for "Process exited with code 0"):

### Eval Logs

- [ ] Navigate to "Eval Logs" tab in browser
- [ ] See new entry at top with today's date and current time
- [ ] Entry shows type: "frontend" (or whichever eval ran)
- [ ] Entry shows status: "success" (green indicator)
- [ ] Expand entry to see diff showing code changes

### Git Commits

```bash
git log --oneline | head -5
```

- [ ] Latest commit message starts with `eval: frontend eval changes`
- [ ] Commit is on `dev` branch (check with `git branch`)
- [ ] Commit includes meaningful changes (not empty or whitespace-only)

### Task Creation

Check `tasks.json`:
```bash
cat tasks.json | tail -50
```

- [ ] New task created with title like "Frontend eval results"
- [ ] Task status is "needs_testing"
- [ ] Task includes summary field with summary of changes
- [ ] Task has correct `createdAt` timestamp (recent)

Or check via API:
```bash
curl http://localhost:3000/api/tasks | jq '.[] | select(.status == "needs_testing")'
```

### Config State Files

- [ ] `.auto-eval-index` now contains `1` (next eval type index, which is "backend")
- [ ] Check: `cat .auto-eval-index` returns `1`
- [ ] `.nightly-eval-config` still has your settings (unchanged by eval)

## Next Eval Cycle

The scheduler automatically triggers the next eval after the interval:

- [ ] Wait 1 minute (or however long you set the interval)
- [ ] Watch server logs for `[nightly] Triggering backend eval (2/5)`
- [ ] Backend eval should start and show same logs as above
- [ ] After success, `.auto-eval-index` should show `2`
- [ ] Continue monitoring for all five cycles: frontend → backend → functionality → features → memory

## Cleanup

- [ ] Press Ctrl+C to stop dev server
- [ ] Run `./scripts/dev-control.sh start` to restore launchd service
- [ ] Verify: `./scripts/dev-control.sh status` shows service is loaded and scheduled
- [ ] Optional: Disable nightly schedule in UI (toggle OFF) if you don't want it running in background

## If Something Fails

### Nightly scheduler doesn't trigger at all

**Symptoms:** No `[nightly]` messages in logs after scheduled time passes

**Checklist:**
- [ ] Verify time was set correctly: `cat .nightly-eval-config | grep startTime`
- [ ] Check if scheduled time has actually passed (compare with system time)
- [ ] Verify toggle is ON: check `.nightly-eval-config` has `"enabled": true`
- [ ] Check server logs at startup for `[nightly] Initializing scheduler` message
- [ ] Look for errors: `grep -i "error\|warn" /tmp/bridgette-dev.log`
- [ ] If still stuck, restart dev server: `./scripts/dev-control.sh stop && ./scripts/dev-control.sh dev`

### Eval starts but subprocess hangs (stuck in execution)

**Symptoms:** `[auto-eval] Starting` log appears but never reaches "Process exited"

**Checklist:**
- [ ] Check Claude process: `ps aux | grep claude | grep -v grep`
- [ ] If Claude is running, it may be stuck waiting for input — kill it: `pkill -f "claude --print"`
- [ ] Check if terminal is still responsive: Ctrl+C to interrupt the dev server
- [ ] Review Claude's recent errors: check `~/.local/state/cursor/logs/` for crash reports
- [ ] Try running eval manually in terminal: `claude < automations/auto-eval/frontend.md` (timeout after 30s)
- [ ] If manual eval works, restart dev server

### Git commits not created

**Symptoms:** Eval log shows "success" but `git log` shows no new commits

**Checklist:**
- [ ] Check if eval exited with error: look for `code: non-zero` in logs (contradicts "success" — may be a logging bug)
- [ ] Check git status: `git status` (look for uncommitted changes)
- [ ] Check current branch: `git branch` (verify on `dev`, not main)
- [ ] Check merge conflicts: `git status | grep -i "conflict"`
  - If conflicts exist, manually resolve and commit: `git add . && git commit -m "resolve: merge conflict from nightly eval"`
- [ ] Verify eval actually made changes: `git diff HEAD~1 HEAD` (should show code modifications)

### Tasks not created

**Symptoms:** Eval log shows success, but no new task in Eval Logs tab or tasks.json

**Checklist:**
- [ ] Verify tasks API is responding: `curl http://localhost:3000/api/tasks`
- [ ] Check for 500 errors in server logs (grep for "createEvalTask")
- [ ] Verify `.auto-eval-enabled` file exists: `cat .auto-eval-enabled`
- [ ] Check if tasks.json is valid JSON: `jq . tasks.json` (should not error)
- [ ] If tasks.json is corrupted, restore from backup and restart server
- [ ] Try creating task manually via API: `curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"title":"Manual test task"}'`

### Wrong eval type triggers (not rotating correctly)

**Symptoms:** Same eval type runs twice in a row, or out of order

**Checklist:**
- [ ] Check index file: `cat .auto-eval-index` (should be 0, 1, 2, or 3)
- [ ] Manually reset index: `echo "0" > .auto-eval-index`
- [ ] Restart dev server
- [ ] Trigger next eval and verify it runs type at index 0 (frontend)
- [ ] Watch index increment correctly: `cat .auto-eval-index` after each eval completes

### Eval runs but makes no code changes

**Symptoms:** Eval shows "success" in logs and creates task, but `git diff` shows only whitespace changes or is empty

**Checklist:**
- [ ] Check eval output: expand entry in Eval Logs tab to see detailed diff
- [ ] Verify eval prompt is correct: `cat automations/auto-eval/frontend.md | head -20` (should describe what to fix)
- [ ] Check if codebase is already in perfect state (all issues fixed)
- [ ] If not, review Claude's changes: sometimes Claude makes small, correct improvements
- [ ] Run eval manually to see full output: `cd app && claude < ../automations/auto-eval/frontend.md 2>&1 | head -100`

## Testing Across Multiple Cycles

To fully test the scheduler, let evals run through 2-5 cycles:

```
Time 0:00   Eval 1 starts (frontend)
Time 1:00   Eval 1 completes, Eval 2 starts (backend)
Time 2:00   Eval 2 completes, Eval 3 starts (functionality)
Time 3:00   Eval 3 completes, Eval 4 starts (features)
Time 4:00   Eval 4 completes, Eval 5 starts (memory)
Time 5:00   Eval 5 completes, cycle repeats back to frontend
```

- [ ] Verify index rotates: 0 → 1 → 2 → 3 → 4 → 0 (check `.auto-eval-index` after each)
- [ ] Verify all five eval types run in correct order
- [ ] Verify each creates a task with correct type
- [ ] Verify git commits accumulate (5 new commits by time 5:00)

## Final Verification Checklist

Before marking scheduler as tested and working:

- [ ] All five eval types triggered successfully in correct order
- [ ] Each eval created a task with status "needs_testing"
- [ ] Each eval created a git commit with meaningful changes
- [ ] Browser UI shows eval running state correctly (evalRunning: true, then false)
- [ ] Eval Logs tab shows all five entries with correct types and success status
- [ ] Config properly persisted: `cat .nightly-eval-config` matches what was set
- [ ] No "error" or "warn" messages in server logs related to nightly scheduler
- [ ] Dev server remained stable (no crashes or restarts)

Once all checks pass, the nightly scheduler is working correctly.
