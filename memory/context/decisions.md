# Decisions Log

## 2026-01-31: Replace OpenClaw with native dashboard
- **Decision:** Build a Next.js dashboard with PTY terminal instead of using OpenClaw
- **Reason:** Eliminates API cost, gives interactive session, removes third-party dependency
- **Trade-off:** No mobile messaging (Telegram) — acceptable, can add webhooks later

## 2026-01-31: PTY + xterm.js for terminal
- **Decision:** Use node-pty to spawn claude, WebSocket to pipe to xterm.js in browser
- **Reason:** Full interactive session with Keychain auth, industry standard approach
- **Trade-off:** Requires custom Next.js server for WebSocket upgrade

## 2026-01-31: Terminal session for auth
- **Decision:** Run dashboard in terminal session, not as LaunchAgent
- **Reason:** LaunchAgents can't access macOS Keychain needed for Max subscription
- **Trade-off:** Must manually start in terminal (or use tmux/screen for persistence)

## 2026-01-31: Chat UI over PTY terminal
- **Decision:** Replaced PTY terminal with `claude --print --stream-json` chat UI
- **Reason:** Structured JSON events give rich UI (tool cards, costs, streaming) without PTY complexity
- **Trade-off:** PTY terminal kept as legacy fallback tab

## 2026-02-01: Backend hardening
- **Decision:** Added auth middleware, path traversal guards, process lifecycle management
- **Reason:** Memory API was exposed without validation; child processes could leak on crashes
- **Trade-off:** Slightly more complex API route code

## 2026-02-01: Consolidated formatting utilities
- **Decision:** Extracted duplicated formatRelativeTime/formatBytes/formatUptime/formatInterval into shared `lib/format.ts`
- **Reason:** Same formatting logic was copy-pasted across 3+ components (Status, EvalLogs, ChatSession)
- **Trade-off:** None — pure DRY improvement

## 2026-02-01: Task store auto-purge at 500 limit
- **Decision:** Auto-purge oldest completed tasks when hitting 500 total to prevent `tasks.json` from blocking new task creation
- **Reason:** Continuous auto-eval runs create many tasks; without a cap, the file grows indefinitely
- **Trade-off:** Oldest completed tasks lost silently — acceptable since completed tasks are historical

## 2026-02-01: WebSocket heartbeat for stale connection cleanup
- **Decision:** Added 30s ping/pong heartbeat to WebSocket server
- **Reason:** Stale connections leaked child processes and map entries when browsers disconnected without close frames
- **Trade-off:** Minor network overhead (negligible)

## 2026-02-01: Send to Chat for automations
- **Decision:** Automations panel sends prompt templates directly to chat via WebSocket instead of showing "paste into terminal"
- **Reason:** Terminal tab is legacy; the old flow told users to paste into a terminal that doesn't exist in the chat-first UI
- **Trade-off:** None — strictly better UX

## 2026-02-01: Backend hardening batch
- **Decisions:** Shell injection guards (regex validation on plist labels, session IDs), rate limiting, temp file cleanup, execSync timeouts (5-10s), direct task creation from server (bypasses HTTP self-call)
- **Reason:** Security hardening and reliability — prevent injection, resource leaks, and event loop blocking
- **Trade-off:** Two code paths for task creation (API + direct); commands >10s will timeout

## 2026-02-01: Collapsible task panels
- **Decision:** Task sidebars collapse via chevron toggle, expanding chat area to full width
- **Reason:** Task panels take significant horizontal space; users need more chat area when not managing tasks
- **Trade-off:** None — panels remember collapsed state per session

## 2026-02-01: Auto-eval exit code validation
- **Decision:** Check process exit code before logging eval as "success"; failed evals now log as "error"
- **Reason:** Every eval was logged as "success" regardless of outcome, making eval-log unreliable
- **Trade-off:** None — pure correctness fix

## 2026-02-01: SessionId injection prevention
- **Decision:** Validate session IDs against safe character regex before passing to CLI arguments
- **Reason:** Unsanitized sessionId from WebSocket messages could inject arbitrary CLI flags
- **Trade-off:** Rejects session IDs with special characters (acceptable — IDs are UUIDs)

## 2026-02-01: Stdout buffer caps and process timeouts
- **Decision:** 5MB stdout buffer cap per process, 10-min safety timeout on chat processes
- **Reason:** Runaway processes could grow memory unboundedly; hung processes leaked file handles
- **Trade-off:** Very long responses truncated at 5MB, long chats timeout at 10min (both generous)

## 2026-02-01: Bulk task advance
- **Decision:** "Done all" button + `/api/tasks/advance-all` for batch status transitions
- **Reason:** Auto-eval creates many tasks; advancing one-by-one was tedious
- **Trade-off:** None — optional bulk action alongside individual controls

## 2026-02-01: Task priorities
- **Decision:** Added high/normal/low priority to tasks with visual indicators and sorting
- **Reason:** Not all tasks are equal; needed a way to flag what matters most
- **Trade-off:** Slightly more complex task schema and UI

## 2026-02-01: Eval task deduplication
- **Decision:** Server checks for existing needs_testing task of same eval type before creating a new one
- **Reason:** Auto-eval cycles were creating duplicate tasks when previous ones weren't reviewed yet
- **Trade-off:** None — pure correctness fix

## 2026-02-01: Backend hardening v3
- **Decision:** Added directory validation (realpath checks), symlink protection, stale task cleanup on startup
- **Reason:** Working directory selector could be exploited with symlinks; stale tasks accumulate over time
- **Trade-off:** Symlinks to valid directories are now rejected — acceptable security tradeoff

## 2026-02-01: Task-to-chat action
- **Decision:** Added "Chat" button on tasks that sends title + description to Claude as a message
- **Reason:** Users need to discuss tasks with Claude without manually copying task details
- **Trade-off:** None — optional action alongside existing task controls
