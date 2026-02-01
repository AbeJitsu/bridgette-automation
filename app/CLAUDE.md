# Bridgette App — Directory Notes

## What This Is

**Bridgette** — a Next.js dashboard wrapping Claude Code in a polished chat UI. Custom server with WebSocket support. Chat powered by `claude --print --output-format=stream-json` with streaming responses, tool use cards, and cost tracking.

## Current State

### Built
- `server.ts` — Custom HTTP + WebSocket server on port 3000. Spawns `claude --print --stream-json` per message via `child_process.spawn`. Auto-iteration system with four-eval rotation (checks exit codes). WebSocket heartbeat (30s ping/pong). Process lifecycle management.
- `components/ChatSession.tsx` — Chat UI with streaming text, markdown, tool use cards, cost tracking, session resume, model switcher, click-outside dropdowns, working directory selector, chat export to Markdown.
- `components/TaskPanel.tsx` — Left/right task sidebars with add/advance/delete, inline rename (double-click), clear completed button, collapsible via chevron toggle.
- `components/MemoryEditor.tsx` — File sidebar grouped by directory, monospace editor, Cmd+S save, unsaved indicator.
- `components/Automations.tsx` — Lists automations with BJJ belt colors, view/copy prompts, curl examples.
- `components/EvalLogs.tsx` — Auto-eval run history with type filtering, expandable diffs, status indicators.
- `components/Status.tsx` — Server health, git info, memory timestamps, auto-eval config visualization, launchd job status.
- `app/page.tsx` — Dashboard with five-tab navigation (Chat, Memory, Automations, Eval Logs, Status). Cmd+1-5 tab shortcuts. WAI-ARIA compliant tab panels.
- `lib/auth.ts` — Authentication middleware for API routes.

### Polish Remaining
- Responsive layout refinements
- File diff viewer for edit tool results

## Key Architecture

- **Chat core:** `claude --print --output-format=stream-json --verbose --include-partial-messages` spawned per message. Session continuity via `--resume`. stdin set to `'ignore'` (hangs otherwise).
- **Auto-iteration:** Server-level idle timer, four-eval rotation (frontend → backend → functionality → memory), merges main into dev before each run. Validates exit codes — failed evals log as "error". Stop button in UI.
- **Process management:** Graceful shutdown, child process cleanup on server restart.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/ws/chat` | WebSocket | Chat streaming, auto-eval control |
| `/api/memory` | GET | List all memory .md files |
| `/api/memory/[...filepath]` | GET/PUT | Read/write memory file (path traversal guarded) |
| `/api/automations` | GET | List all automations |
| `/api/automations/[name]` | GET/POST | Read/trigger automation |
| `/api/health` | GET | Server uptime and status |
| `/api/tasks` | GET/POST | List/create tasks |
| `/api/tasks/[id]` | PUT/DELETE | Update/delete task |
| `/api/tasks/clear-completed` | POST | Remove all completed tasks |
| `/api/directories` | GET | List project directories |
| `/api/eval-logs` | GET | Auto-eval run history |
| `/api/status` | GET | Server health, git, eval config, launchd |

## Things Discovered

- `claude --print` hangs when stdin is a pipe — must use `'ignore'`
- `--include-partial-messages` gives `content_block_delta` for real-time streaming
- `--resume <session-id>` works for multi-turn conversations
- xterm CSS must be imported in globals.css (legacy terminal)
- node-pty needs `serverExternalPackages` in next.config.ts (legacy terminal)
- `@tailwindcss/typography` `@import` doesn't work with Next.js 15 + Tailwind v4
