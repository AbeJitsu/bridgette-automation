# OpenClaw Research — Project Memory

## What This Project Is

A native replacement for OpenClaw. Next.js dashboard that wraps a live interactive Claude Code session via PTY (node-pty + xterm.js + WebSocket). Authenticated through macOS Keychain with Max subscription. Runs on the Mac Mini.

## Architecture

- **Terminal core:** node-pty spawns `claude` in PTY, WebSocket pipes to xterm.js in browser
- **Dashboard:** Next.js app with memory editor, automation triggers, log viewer
- **Memory:** Markdown files in `memory/` — curated, not automated
- **Scheduling:** launchd plists curl API routes on schedule
- **Auth:** Keychain via PTY session (Max subscription, no API key)

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `memory/` | Personality, identity, persistent facts, context |
| `app/` | Next.js dashboard (terminal, memory editor, automations) |
| `automations/` | Prompt templates for scheduled tasks |
| `launchd/` | launchd plist files for scheduling |

## Decisions Made

- PTY + xterm.js over `claude -p` — need interactive session for Max auth via Keychain
- Terminal session over LaunchAgent — LaunchAgents can't access Keychain
- Next.js API routes for orchestration — automations trigger via REST
- Markdown as database — memory files are the source of truth, no DB
- Merged ~/claude-memory into this repo under `memory/`

## Things Discovered During Build

<!-- Add learnings here as we build -->

## Commands

```bash
npm run dev          # Start dashboard (includes WebSocket server)
# launchd handles scheduled automations via curl to API
```
