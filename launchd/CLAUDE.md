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
