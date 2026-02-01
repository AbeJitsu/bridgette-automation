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

## 2026-02-01: Shell injection guard on status route
- **Decision:** Validate launchd plist labels against safe character regex before passing to execSync
- **Reason:** Status route was passing user-controllable filenames to shell commands without sanitization
- **Trade-off:** Rejects plist labels with unusual characters (acceptable)
