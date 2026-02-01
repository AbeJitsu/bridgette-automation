# Active Work

## Current Project
- **Project:** Bridgette (Native Claude Code Dashboard)
- **Path:** ~/Projects/Personal/OpenClaw Research
- **Branch:** dev (all work happens here, merged to main when stable)
- **Status:** Core features complete, polish phase

## What's Done (Recent)
- Bulk task operations — "Done all" button advances all needs_testing tasks at once, `/api/tasks/advance-all` endpoint
- Auto-scroll lock — Chat pauses auto-scroll when user scrolls up during streaming, "Scroll to bottom" pill to resume
- Process safety — 5MB stdout buffer cap on chat/eval processes, 10-min timeout on hung chat processes
- Frontend polish — Responsive automations layout, memory editor empty state, chat shortcut wrapping
- Browser notifications — native OS notifications when auto-evals complete while tab is in background
- Edit tool diff viewer — side-by-side old/new display for Edit tool results (red removed, green added)
- Collapsed panel badges — task count badges on collapsed sidebar buttons (green pending, amber needs_testing)

## Next Steps
- Code syntax highlighting in markdown
- Approval buttons for tool use
- Multiple sessions support
