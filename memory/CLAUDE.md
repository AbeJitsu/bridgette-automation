# Memory — Directory Notes

## What This Is

Shared memory system for the Claude Code dashboard. These markdown files are the persistent memory layer — read by Claude sessions, editable through the dashboard UI.

## Philosophy

Curated over automated. Actively edit as understanding evolves. Remove dead ends. The doc is the memory, not a transcript.

## File Purposes

| File | Purpose | Edit Frequency |
|------|---------|----------------|
| SOUL.md | Personality and tone | Rarely — once established |
| IDENTITY.md | Who the assistant is | Rarely |
| USER.md | Context about Abe | Occasionally — as preferences change |
| AGENTS.md | Behavior rules for sessions | Occasionally |
| HEARTBEAT.md | Monitoring checklist | As monitoring needs evolve |
| MEMORY.md | Curated persistent facts | Frequently — living document |
| TOOLS.md | Local environment notes | When setup changes |

## Merging Notes

Originally lived at `~/claude-memory/`. Merged into this repo January 31, 2026. The original repo had git history — preserved at `~/claude-memory/.git/` if needed.

Files adapted during merge:
- SOUL.md — removed OpenClaw-specific bridge instructions, kept personality and routing
- IDENTITY.md — updated role to reflect dashboard instead of OpenClaw relay
- USER.md — updated context to reflect dashboard project
- AGENTS.md — simplified, removed OpenClaw-specific sections (heartbeat polling, group chat, cron vs heartbeat)
- AUDIT_RESULTS.md — condensed to summary (full report in git history)
- context/active-work.md — updated to reflect current project
- context/decisions.md — populated with architecture decisions
- context/preferences.md — populated with coding/design preferences
- scripts/claude-bridge.sh — archived with note, kept for reference

New files:
- MEMORY.md — curated persistent facts (didn't exist before)

## Things Discovered

- The original AGENTS.md had extensive OpenClaw-specific content (heartbeat polling, group chat etiquette, cron vs heartbeat decisions) that doesn't apply to the native dashboard. Simplified to core principles.
- HEARTBEAT.md was empty — added example tasks for the dashboard monitoring use case.
- The prompts/ directory in ~/claude-memory was empty (with an empty refined/ subdir) — not migrated.

## Integration with Nightly Eval System

The memory eval (4th of 4 nightly evals) updates documentation:

- Runs daily at ~6 AM EST (default: starts 3 AM with 60-minute intervals between 4 sequential evals)
- Configurable start time and interval via Automations UI; separate from idle-timer auto-eval system
- Updates `CLAUDE.md`, memory files, and `roadmap.md` based on recent code changes
- Runs 4th (after frontend → backend → functionality); part of nightly eval rotation
- Reads `.nightly-eval-fixes.md` at startup to avoid duplication, then appends fixes
- Appends fixes to the log for tracking

### Things to Know

1. **Memory eval updates are automatic** — No user input needed, happens during nightly cycle
2. **Can conflict with manual edits** — If you update CLAUDE.md overnight, memory eval might conflict
3. **Updates are committed** — Each fix gets its own commit with message starting "Docs:"
4. **No notification** — Check Status tab (or `/api/eval-logs` endpoint) to see updates

For the full nightly eval system, see root `CLAUDE.md`.
