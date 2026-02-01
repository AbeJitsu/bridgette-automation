# Bridgette — Roadmap

*Last updated: February 1, 2026*

---

## What This Is

**Bridgette** is a Next.js dashboard on the Mac Mini that wraps Claude Code in a custom chat UI. No iTerm window, no raw terminal — a polished interface powered by `claude --print --output-format=stream-json` with streaming responses, tool use cards, and session continuity. Task management, memory editing, automation triggers, and scheduling built around it.

**Cost:** $0 beyond your existing Claude Max subscription.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Bridgette (localhost:3000) — Dark theme                     │
│                                                              │
│  ┌──────────┬──────────────────────┬──────────┐              │
│  │  Left    │  Center              │  Right   │              │
│  │  Panel   │  Chat UI             │  Panel   │              │
│  │  Pending │  claude --print      │  Active  │              │
│  │  Tasks   │  --stream-json       │  + Done  │              │
│  │          │  Streaming, tools,   │  Tasks   │              │
│  │  + Add   │  markdown, costs     │          │              │
│  └──────────┴──────────┬───────────┴──────────┘              │
│                        │                                      │
│  Tabs: Chat | Memory | Automations | Eval Logs | Status                            │
│                                                              │
│  Custom Server (Next.js + WebSocket)                         │
│  ├── WS /ws/chat ← child_process spawn claude               │
│  ├── REST: /api/memory/*                                     │
│  ├── REST: /api/automations/*                                │
│  ├── REST: /api/tasks, /api/tasks/[id]                       │
│  ├── REST: /api/eval-logs                                    │
│  └── REST: /api/health, /api/directories                     │
└──────────────────────────────────────────────────────────────┘
               │ stdio pipes (no PTY needed)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  claude --print --output-format=stream-json                  │
│  Keychain auth via Max subscription                          │
│  NDJSON event stream: text, tool_use, result, costs          │
└──────────────────────────────────────────────────────────────┘
               │ reads/writes
               ▼
┌──────────────────────────────────────────────────────────────┐
│  memory/  (personality, context, persistent facts)           │
│  tasks.json (task persistence)                               │
└──────────────────────────────────────────────────────────────┘
```

---

## What's Built

### Core
- **Chat UI** — Streaming text, markdown rendering, tool use cards, cost tracking, session continuity via `--resume`
- **Three-panel layout** — Pending tasks (left), chat (center), in-progress/completed tasks (right)
- **Task management** — Add/advance/delete tasks, persisted to `tasks.json`, REST API
- **Dark mode** — Full dark theme across all components and markdown
- **Working directory selector** — Browse and select project directories, works even when disconnected
- **Memory integration** — All memory files injected into Claude via `--append-system-prompt`, cached with 60s TTL
- **Session resume** — Browse and resume previous conversations via session history dropdown, localStorage persistence
- **Model switcher** — Opus 4.5, Sonnet 4, Haiku 3.5 with localStorage persistence
- **Task advance buttons** — Hover to reveal test/done actions on tasks
- **Task inline rename** — Double-click pending/in-progress tasks to rename
- **Clear completed tasks** — Button + `/api/tasks/clear-completed` endpoint
- **Chat export** — Download current conversation as Markdown file
- **Auto-purge tasks** — Oldest completed tasks auto-removed at 500 limit
- **WebSocket heartbeat** — 30s ping/pong detects and cleans up stale connections
- **Diff highlighting in eval logs** — Color-coded additions/removals/hunks
- **Button visibility** — Higher resting opacity for task actions and disabled buttons
- **Escape key + stop button** — Cancel streaming responses
- **Reconnection UX** — Disconnect banner, retry button, automatic reconnection with backoff
- **Tool card enhancements** — Copy-to-clipboard buttons on input/result, diff syntax highlighting (green/red/blue)
- **Code block copy** — Hover-to-copy on all code blocks in chat messages
- **Session management** — Delete individual sessions, clear all sessions, Cmd+K new chat shortcut
- **Keyboard shortcut hints** — Empty state and input footer show Enter, Shift+Enter, Esc shortcuts
- **Backend hardening v2** — Shell injection guard on status route, corruption recovery for tasks.json, graceful 400 on invalid memory PUT
- **ARIA accessibility** — Proper tabpanel roles with id/aria-labelledby on all five tabs
- **Shared formatters** — `lib/format.ts` with formatRelativeTime, formatBytes, formatUptime, formatInterval
- **TabEmptyState** — Reusable loading/error/empty state component across all tabs
- **Graceful shutdown** — SIGTERM/SIGINT handler kills all child processes, closes WebSocket connections, 8s forced-exit fallback
- **Atomic eval-log writes** — Mutex + temp-file-plus-rename prevents corruption from concurrent writes
- **Stop hook** — TypeScript check + server health verification (no longer kills running server)
- **Auto-iteration system** — Server-level idle detection (configurable 1min–2hr), four-eval rotation (frontend → backend → functionality → memory curator), merges main into dev before each run, persisted state, headless operation, manual trigger, change summaries
- **Auto-eval test suite** — Vitest unit tests (rotation math) + integration tests (WebSocket message flow)

### Dashboard
- **Memory editor** — Sidebar file browser, monospace editor, Cmd+S save, unsaved indicator
- **Automations panel** — View/copy prompt templates with BJJ belt color coding, Send to Chat executes prompts directly
- **Five-tab layout** — Chat, Memory, Automations, Eval Logs, Status

### Infrastructure
- **Custom server** — Next.js + WebSocket on port 3000
- **API routes** — Memory CRUD, automations list/trigger, tasks CRUD, health, directories
- **Memory system** — Markdown files in `memory/`
- **Prompt templates** — Content creation, job search, codebase evaluation
- **launchd plists** — Daily 5 AM, weekly Monday scheduling
- **Stop hook** — Blocks Claude from stopping if build is failing

---

## Roadmap

### Next Up: Polish & Operations
- ~~Log viewer for automation run history~~ — **Built** (Eval Logs tab)
- ~~Status page (launchd jobs, server health, memory timestamps)~~ — **Built** (Status tab)
- ~~Error states and reconnection UX~~ — **Built** (disconnect banner, retry button, auto-reconnect)
- Responsive layout refinements

### Enhanced Chat UX
- File diff viewer for edit tool results
- Approval buttons for tool use
- Code syntax highlighting in markdown
- Search/filter conversation history
- Multiple sessions support

### Auto-Iteration System (Built)
- Server-level idle timer (15 min) — works with or without browser
- **Four-eval rotation** — frontend → backend → functionality → memory curator, wraps around
- Rotation index persisted in `.auto-eval-index`, eval prompts in `automations/auto-eval/`
- **Merges main into dev** before each eval run (aborts cleanly on conflicts)
- Persisted to `.auto-eval-enabled` file, survives server restarts
- Headless operation — runs even when no browser connected
- Broadcasts `evalRunning` and `evalType` in state events to all clients
- Manual "Run Now" trigger button in UI
- Always-visible branch indicator (non-main branches)
- Change summary (`git diff --stat`) displayed after eval completes
- Branch safety — all work on `dev`, never touches main directly
- **Test suite** — `cd app && npm run test:run` (vitest, 9 tests)

### Advanced Features
- Task descriptions and priorities
- Task-to-chat linking (reference tasks in conversations)
- Automation scheduling from the UI
- Notification system for completed automations

---

## Project Structure

```
OpenClaw Research/
├── memory/                  ← shared memory (markdown files)
├── tasks.json               ← task persistence
├── app/                     ← Bridgette (Next.js dashboard)
│   ├── server.ts            ← custom HTTP + WebSocket server
│   ├── components/
│   │   ├── ChatSession.tsx  ← chat UI (dark mode, streaming)
│   │   ├── TaskPanel.tsx    ← left/right task sidebars + inline rename
│   │   ├── MemoryEditor.tsx
│   │   ├── Automations.tsx
│   │   ├── EvalLogs.tsx
│   │   ├── Status.tsx
│   │   └── TabEmptyState.tsx
│   ├── app/
│   │   ├── page.tsx         ← dashboard (three-panel + tabs)
│   │   └── api/             ← REST endpoints
│   ├── __tests__/           ← vitest tests
│   ├── lib/
│   │   └── format.ts          ← shared formatting utilities
│   ├── vitest.config.ts
│   └── package.json
├── automations/             ← prompt templates
│   └── auto-eval/           ← rotation prompts (frontend/backend/functionality/memory-curator)
├── launchd/                 ← scheduling plists
└── roadmap.md               ← this file
```

---

## Mac Mini Requirements

- Always on, never sleeps
- `npm run dev` running (from real terminal or launchd)
- `~/.local/bin` in PATH (where `claude` lives)
- Chrome open for browser automation tasks
