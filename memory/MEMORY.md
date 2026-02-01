# MEMORY.md - Curated Persistent Facts

*Things worth remembering. Actively maintained — remove what's stale, add what matters.*

## Project Decisions

- **Jan 31, 2026:** Decided to replace OpenClaw with native PTY-based dashboard. Reason: eliminates $30/mo API cost, gives full interactive Claude session instead of headless `claude -p`, removes Telegram dependency.
- **Jan 31, 2026:** Chose node-pty + xterm.js + WebSocket for terminal in browser. Industry standard, battle-tested. Custom Next.js server needed for WebSocket upgrade.
- **Jan 31, 2026:** Auth strategy: terminal session for Keychain access (Max subscription). LaunchAgents can't access Keychain. launchd only triggers curl commands to the running dashboard.

## Technical Learnings

- LaunchAgent daemons cannot access macOS Keychain — must run in interactive terminal session
- `claude --print` hangs when stdin is a pipe — must use `stdio: ['ignore', 'pipe', 'pipe']`
- `--include-partial-messages` gives real-time `content_block_delta` events for streaming UI
- Child processes from `child_process.spawn` need explicit cleanup on server restart to avoid leaks
- Memory API needs path traversal guards — `realpath` check against memory directory
- WebSocket message fields (sessionId, directory) must be validated before use in CLI args — injection vector
- Long-running `claude --print` processes need stdout buffer caps (5MB) and safety timeouts (10min) to prevent memory exhaustion

## About Abe

- BJJ purple belt — brand colors follow belt progression (green → blue → purple → gold)
- Prefers concise communication
- Timezone: America/New_York
- Main project: Need_This_Done (Next.js ecommerce, 388 source files)
