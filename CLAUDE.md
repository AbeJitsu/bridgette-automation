# Bridgette — Project Memory

## What This Project Is

**Bridgette** is a native replacement for OpenClaw. A Next.js dashboard that wraps a live interactive Claude Code session via PTY (node-pty + xterm.js + WebSocket). Authenticated through macOS Keychain with Max subscription. Runs on the Mac Mini at localhost:3000.

## Current State

### What's Built
- **Memory system** — All personality, identity, and context files merged from ~/claude-memory into `memory/`
- **Terminal core** — Custom Next.js server with WebSocket, node-pty spawns `claude` in a PTY, xterm.js renders it in the browser. Session persists across browser refreshes.
- **Memory editor** — Sidebar file browser, monospace editor, Cmd+S save, unsaved indicator
- **Automations panel** — View/copy prompt templates, BJJ belt color coding, curl examples
- **API routes** — `/api/memory/*` CRUD, `/api/automations/*` list/trigger, `/api/health`
- **Prompt templates** — Content creation, job search, codebase eval in `automations/`
- **launchd plists** — Scheduled curl triggers (5 AM daily, weekly Monday) + install script
- **Dashboard** — Three-tab layout (Terminal, Memory, Automations) with BJJ belt color progression
- **Build passes** — `next build` clean, dev server runs on localhost:3000, all APIs tested

### What's Left
- **Log viewer** — View automation run history
- **Status page** — launchd job status, memory file timestamps, server health
- **Working directory selector** — Choose which project to open claude in
- **New session button** — Kill and respawn the PTY
- **Polish** — Design system refinements, responsive layout

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
| `app/` | Next.js dashboard (Bridgette) |
| `automations/` | Prompt templates for scheduled tasks |
| `launchd/` | launchd plist files for scheduling |

## Decisions Made

- Named the dashboard **Bridgette** after the assistant personality
- PTY + xterm.js over `claude -p` — need interactive session for Max auth via Keychain
- Terminal session over LaunchAgent — LaunchAgents can't access Keychain
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

## Commands

```bash
cd app && npm run dev    # Start Bridgette (includes WebSocket server)
cd app && npm run build  # Production build
```
