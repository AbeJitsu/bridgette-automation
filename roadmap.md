# Bridgette — Roadmap

*Last updated: January 31, 2026*

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
│  Tabs: Chat | Terminal | Memory | Automations                │
│                                                              │
│  Custom Server (Next.js + WebSocket)                         │
│  ├── WS /ws/chat ← child_process spawn claude               │
│  ├── REST: /api/memory/*                                     │
│  ├── REST: /api/automations/*                                │
│  ├── REST: /api/tasks, /api/tasks/[id]                       │
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
- **Terminal (legacy)** — PTY-based terminal kept as fallback tab
- **Session resume** — Browse and resume previous conversations via session history dropdown, localStorage persistence
- **Model switcher** — Opus 4.5, Sonnet 4, Haiku 3.5 with localStorage persistence
- **Task advance buttons** — Hover to reveal test/done actions on tasks
- **Escape key + stop button** — Cancel streaming responses
- **Stop hook** — TypeScript check + server health verification (no longer kills running server)
- **Auto-iteration system** — Idle detection (15 min) triggers auto-eval on a new branch

### Dashboard
- **Memory editor** — Sidebar file browser, monospace editor, Cmd+S save, unsaved indicator
- **Automations panel** — View/copy prompt templates with BJJ belt color coding
- **Four-tab layout** — Chat, Terminal, Memory, Automations

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
- Log viewer for automation run history
- Status page (launchd jobs, server health, memory timestamps)
- Responsive layout refinements
- Error states and reconnection UX

### Enhanced Chat UX
- File diff viewer for edit tool results
- Approval buttons for tool use
- Code syntax highlighting in markdown
- Search/filter conversation history
- Multiple sessions support

### Auto-Iteration System
- Idle detection (15 min) triggers auto-eval on `dev` branch
- Frontend + backend + functionality evaluation prompt
- Auto-implements one improvement per cycle
- Branch safety — all work on `dev`, never touches main directly
- Toggle in status bar, persisted to localStorage

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
│   │   ├── TaskPanel.tsx    ← left/right task sidebars
│   │   ├── MemoryEditor.tsx
│   │   └── Automations.tsx
│   ├── app/
│   │   ├── page.tsx         ← dashboard (three-panel + tabs)
│   │   └── api/             ← REST endpoints
│   └── package.json
├── automations/             ← prompt templates
├── launchd/                 ← scheduling plists
└── roadmap.md               ← this file
```

---

## Mac Mini Requirements

- Always on, never sleeps
- `npm run dev` running (from real terminal or launchd)
- `~/.local/bin` in PATH (where `claude` lives)
- Chrome open for browser automation tasks
