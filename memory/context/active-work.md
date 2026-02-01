# Active Work

## Current Project
- **Project:** Bridgette (Native Claude Code Dashboard)
- **Path:** ~/Projects/Personal/OpenClaw Research
- **Branch:** dev (all work happens here, merged to main when stable)
- **Status:** Core features complete, polish phase

## What's Done (Recent)
- Chat UI with streaming, tool cards, markdown, cost tracking, session resume
- Three-panel task management with inline rename, clear completed, auto-purge at 500
- Five-tab dashboard: Chat, Memory, Automations, Eval Logs, Status
- Auto-iteration system with four-eval rotation (frontend → backend → functionality → memory)
- Backend hardening: shell injection guards, corruption recovery, graceful shutdown, atomic writes
- Send to Chat — automations execute prompt templates directly in chat via WebSocket
- Session management — delete individual sessions, clear all, Cmd+K new chat shortcut
- Copy buttons on code blocks (hover) and curl examples (click-to-copy)
- Chat empty state with keyboard shortcut hints (Enter, Shift+Enter, Esc)
- WebSocket heartbeat, reconnection UX, ARIA accessibility, shared formatters

## Next Steps
- Responsive layout refinements
- File diff viewer for edit tool results
- Code syntax highlighting in markdown
