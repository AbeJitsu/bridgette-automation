# Native Claude Code Dashboard

*Replacing OpenClaw with a self-hosted PTY-based dashboard.*

*Last updated: January 31, 2026*

---

## What This Is

A Next.js app running on the Mac Mini that wraps a **live interactive Claude Code session** in the browser. No `claude -p`, no OpenClaw, no API key — just a real `claude` terminal session rendered via xterm.js, authenticated through macOS Keychain with your Max subscription.

The dashboard adds memory management, automation triggers, scheduling, and monitoring around the terminal.

**The cost:** $0 beyond your existing Claude Max subscription.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js App (localhost:3000)                            │
│                                                          │
│  ┌─────────────────────┐  ┌───────────────────────────┐  │
│  │  Dashboard UI        │  │  Terminal Panel           │  │
│  │  - Memory editor     │  │  xterm.js ← WebSocket    │  │
│  │  - Automation triggers│  │  Full interactive claude  │  │
│  │  - Log viewer        │  │  session in browser       │  │
│  │  - Status/health     │  │                           │  │
│  └─────────────────────┘  └────────────┬──────────────┘  │
│                                        │                  │
│  Custom Server (Next.js + WebSocket)   │                  │
│  ├── WS: node-pty spawns `claude`  ←───┘                  │
│  │   stdin/stdout piped over WebSocket                    │
│  ├── REST: /api/memory/* (read/write .md files)           │
│  ├── REST: /api/automations/* (trigger/status)            │
│  └── REST: /api/health                                    │
└──────────────────────────────────────────────────────────┘
               │ PTY process
               ▼
┌──────────────────────────────────────────────────────────┐
│  claude  (interactive session, Keychain auth, Max sub)   │
│  Full tool access, approvals visible in xterm.js         │
└──────────────────────────────────────────────────────────┘
               │ reads/writes
               ▼
┌──────────────────────────────────────────────────────────┐
│  memory/  (personality, context, persistent facts)       │
│  SOUL.md, IDENTITY.md, USER.md, AGENTS.md, ...          │
└──────────────────────────────────────────────────────────┘
```

---

## How It Works

**Terminal core:** `node-pty` spawns `claude` in a pseudo-terminal. A WebSocket server pipes PTY stdout to the browser and browser keystrokes back to PTY stdin. `xterm.js` renders the terminal in the browser. Claude authenticates via macOS Keychain — same as running `claude` in iTerm.

**Session management:** One active session at a time. Browser refresh reconnects to the existing PTY. "New session" button kills and respawns. Working directory selector chooses which project to open claude in.

**Automations:** Prompt templates that get pasted into the active terminal session, or spawned as separate `claude -p` calls for fire-and-forget background tasks. Triggered manually via dashboard buttons or on schedule via launchd `curl` commands.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `node-pty` | Spawn claude in pseudo-terminal |
| `xterm.js` + addons | Terminal renderer in browser |
| `ws` | WebSocket server for PTY ↔ browser |
| `next` + `react` + `tailwindcss` | Dashboard app |

---

## Project Structure

```
OpenClaw Research/
├── memory/              ← merged from ~/claude-memory
│   ├── SOUL.md          ← personality and tone
│   ├── IDENTITY.md      ← who the assistant is
│   ├── USER.md          ← context about Abe
│   ├── AGENTS.md        ← behavior rules
│   ├── HEARTBEAT.md     ← monitoring checklist
│   ├── MEMORY.md        ← curated persistent facts
│   ├── TOOLS.md         ← local environment notes
│   └── context/         ← active work, decisions, preferences
├── app/                 ← Next.js dashboard
│   ├── components/
│   │   └── Terminal.tsx
│   ├── lib/
│   │   └── pty-server.ts
│   ├── api/
│   │   ├── memory/
│   │   ├── automations/
│   │   └── health/
│   └── terminal/
│       └── page.tsx
├── automations/         ← prompt templates
│   ├── content-creation/
│   ├── job-search/
│   └── codebase-eval/
├── launchd/             ← plist templates
├── server.ts            ← custom Next.js server (WebSocket)
└── CLAUDE.md
```

---

## Memory System

### Philosophy

Curated over automated. Actively edit as understanding evolves. Remove dead ends. The doc is the memory, not a transcript.

### Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Personality, tone, core rules |
| `IDENTITY.md` | Name, role, vibe |
| `USER.md` | Context about Abe (timezone, preferences, background) |
| `AGENTS.md` | Behavior rules for Claude sessions |
| `HEARTBEAT.md` | Monitoring checklist for daily/weekly health checks |
| `MEMORY.md` | Curated persistent facts — things worth remembering |
| `TOOLS.md` | Local environment: what's installed, where things live |
| `context/active-work.md` | Current project and focus |
| `context/decisions.md` | Architecture decisions log |
| `context/preferences.md` | Coding style, tools, workflows |

### Dashboard Integration

The memory editor in the dashboard reads and writes these files directly. No database — markdown is the source of truth.

---

## Automation Use Cases

### 1. Daily Content Creation (5 AM)

- Trending AI topics research
- Three post options with different angles
- Gemini images via Claude in Chrome
- Staged for approval in dashboard

### 2. Daily Job Search (5 AM)

- Search job boards, filter last 24 hours
- Generate customized resume and cover letter per match
- Save to dated folders
- Review matches in dashboard

### 3. Codebase Evaluation (Weekly)

- Analyze needthisdone.com for bloat, dead code, unclear purpose
- Output prioritized report
- View in dashboard

---

## Scheduling

launchd plists trigger automations by curling the Next.js API:

```
com.openclaw.content-creation.plist  →  curl POST localhost:3000/api/automations/content-creation
com.openclaw.job-search.plist        →  curl POST localhost:3000/api/automations/job-search
com.openclaw.codebase-eval.plist     →  curl POST localhost:3000/api/automations/codebase-eval
```

Install: symlink plists from `launchd/` into `~/Library/LaunchAgents/`.

---

## Mac Mini Requirements

- Always on, screen locked, never sleeps
- Chrome open (for Claude in Chrome browser automation)
- Terminal session running `npm run dev` for the dashboard
- `~/.local/bin` in PATH (where `claude` lives)

---

## Remote Triggering (If Needed Later)

- Webhook endpoint on Mac Mini (already have API routes)
- iOS Shortcut that runs SSH command
- Pushover notification with action buttons
- No Telegram or iMessage integration needed

---

## What Changed From OpenClaw

| Before (OpenClaw) | After (Native) |
|--------------------|----------------|
| OpenClaw gateway + Haiku API (~$30/mo) | Next.js app + Max subscription ($0 extra) |
| `claude -p` headless mode | Live interactive `claude` session via PTY |
| Telegram for remote messaging | Dashboard in browser, webhook for remote |
| Bridgette personality in OpenClaw | Same personality files in `memory/` |
| OpenClaw bridge script | node-pty direct spawn |
| OpenClaw cron system | launchd + curl to API routes |

---

## Previous Setup (Archived)

The original OpenClaw bridge setup documentation is preserved in git history. Key components that existed:

- `~/.openclaw/` — OpenClaw config with Telegram, gateway on loopback:18789
- `~/claude-memory/scripts/claude-bridge.sh` — bridge script for `claude -p`
- Telegram bot via BotFather for remote messaging
- `PI_BASH_YIELD_MS=120000` env var for long-running commands

These are no longer needed with the native dashboard approach.
