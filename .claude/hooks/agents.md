# Hooks Folder

Two working hooks. Most Claude Code hook types are broken (Jan 2025).

## Active Hooks

| File | Purpose | Provides feedback to Claude? |
|------|---------|------------------------------|
| `session-start.sh` | Shows git branch and uncommitted files | YES - visible at session start |
| `pre-compact.sh` | Saves work state before compression | YES - same pattern |

## What's Broken (Tested)

| Hook Type | Status | Tested How |
|-----------|--------|------------|
| PreToolUse | Doesn't fire | Debug output never appeared |
| PostToolUse | Doesn't fire | GitHub issues #6403, #6305, #3148 |
| Stop | Doesn't fire | Log file never created |

## Rule

If Claude can't see the output, delete the hook. No point in broken code.
