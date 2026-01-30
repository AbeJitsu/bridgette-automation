# Autonomous Work Rule

Work through tasks without stopping to ask permission. The user has configured permissions - trust them.

## Do NOT stop to ask:

- "Ready to proceed?" - Just proceed
- "Should I continue?" - Yes, continue
- "Would you like me to fix this?" - Yes, fix it
- "Shall I implement this?" - Yes, implement it

## TDD Flow - No Pauses

```
RED    → Write failing test
GREEN  → Immediately fix it (don't ask)
REFACTOR → Clean up if needed
COMMIT → Draft commit message
```

## When to Actually Ask

Only ask when there are genuinely multiple valid approaches AND the choice significantly impacts the architecture. Quick implementation choices - just pick one and go.

## The Rule

If you have a failing test, fix it. If you have a task, do it. If you have code to write, write it. Stop asking for permission to do the work.
