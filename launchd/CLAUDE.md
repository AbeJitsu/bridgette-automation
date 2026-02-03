# Launchd — Directory Notes

## What This Is

launchd plist files for scheduling automations. These curl the Next.js API routes on a schedule.

## Installation

```bash
# Symlink plists into LaunchAgents
ln -sf "$(pwd)"/launchd/*.plist ~/Library/LaunchAgents/

# Load them
launchctl load ~/Library/LaunchAgents/com.openclaw.*.plist

# Verify
launchctl list | grep openclaw
```

## Important Notes

- launchd plists only trigger `curl` commands — they don't run claude directly
- The Next.js server must be running for curl triggers to work
- The server runs in a terminal session (not launchd) for Keychain access

## Things Discovered

<!-- Add learnings about scheduling here -->

## Nightly Eval Scheduler

The nightly eval scheduler is different from launchd-triggered automations. Instead of using plists:

- **Server-side scheduling** — `app/server.ts` contains the nightly scheduler logic
- **No launchd plists needed** — Evals run at configured time if server is running
- **Configuration** — Set via Automations UI in dashboard (NightlyScheduleCard)
- **Persistence** — Config saved to `.nightly-eval-config` at project root

Unlike launchd automations (which curl the API), the nightly scheduler:
1. Is built into the server
2. Runs 4 evals sequentially (frontend → backend → functionality → memory)
3. Has configurable start time and interval
4. Coexists with idle-timer auto-eval (different system)

For details, see `CLAUDE.md` "Nightly eval schedule" section.
