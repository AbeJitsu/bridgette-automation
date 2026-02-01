# Active Work

## Current Project
- **Project:** Bridgette (Native Claude Code Dashboard)
- **Path:** ~/Projects/Personal/OpenClaw Research
- **Branch:** dev (all work happens here, merged to main when stable)
- **Status:** Core features complete, polish phase

## What's Done (Recent)
- Chat UI with streaming, tool cards, markdown, cost tracking, session resume
- Three-panel task management with inline rename (double-click), clear completed button
- Chat export — download current conversation as Markdown file
- Five-tab dashboard: Chat, Memory, Automations, Eval Logs, Status
- Auto-iteration system with three-eval rotation (frontend → backend → functionality)
- Backend hardening: graceful shutdown, atomic eval-log writes, auto-purge completed tasks at 500 limit
- WebSocket heartbeat — 30s ping/pong to detect and clean up stale connections
- Reconnection UX: disconnect banner, retry button, auto-reconnect
- Tool card copy buttons (input + result sections)
- Diff syntax highlighting in eval logs and tool results (green/red/blue)
- ARIA tab accessibility fixes (proper tabpanel roles)
- Shared `lib/format.ts` and reusable `TabEmptyState` component

## Next Steps
- Responsive layout refinements
- File diff viewer for edit tool results
- Code syntax highlighting in markdown
