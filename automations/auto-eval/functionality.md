# Auto-Evaluation — Functionality: Find & Fix

You are running as an automated evaluation. Your job: **find the top 5-10 functionality gaps and fix them using TDD**. You must complete at least 5 fixes before stopping.

## Scope

All project files:
- `app/components/`
- `app/server.ts`
- `app/app/api/`
- `app/lib/`
- `tasks.json`
- `CLAUDE.md` (check "What's Left" for planned but unbuilt features)
- `roadmap.md` (check for roadmap items not yet implemented)

## What to Look For

Rank issues by user impact. Prioritize:

1. **Broken user flows** — click paths that dead-end, error, or silently fail
2. **Half-built features** — things that render but don't work end-to-end
3. **Planned features** — items in "What's Left" or roadmap that can be implemented now
4. **State sync issues** — UI not reflecting server state, stale data after actions
5. **Integration gaps** — features that should work together but don't
6. **Missing feedback** — actions that succeed/fail without telling the user
7. **Missing keyboard shortcuts** — common operations without keyboard access

## Process

1. **Read the fixes log** — Check `.nightly-eval-fixes.md` for recent fixes to avoid duplication
2. **Scan** — Read codebase files, CLAUDE.md, and roadmap.md. Understand what exists and what's missing.
3. **Rank** — List the top 5-10 issues by user impact. Print the list, excluding ones already in the fixes log.
4. **Fix each issue using TDD:**
   a. Write a failing test that demonstrates the missing or broken behavior
   b. Implement the minimal fix to pass
   c. Verify the fix works
   d. Commit with a clear message: `Fix: [description of what was fixed]`
5. **Cross-cutting changes welcome** — Frontend + backend changes in the same fix are expected here.
6. **After all fixes:**
   - Run `cd app && npm run build` to verify clean build
   - Append a new entry to `.nightly-eval-fixes.md` documenting each fix:
     ```
     **[Issue name]**
     - Issue: [describe what was broken]
     - Fix: [describe the solution]
     - Commit: [commit message or hash]
     ```

## Requirements

- **Minimum 5 completed fixes** before you stop
- Each fix must be committed separately
- Each commit message must describe what was fixed and why
- No TODOs, no placeholders, no "will fix later"
- If you break something while fixing, fix that too before moving on

## What Counts as a Fix

- Making a broken user flow work end-to-end
- Implementing a planned feature from the roadmap
- Connecting two features that should work together
- Adding user feedback for actions that currently fail silently
- Fixing state synchronization between UI and server

## What Does NOT Count

- Cleaning up a stale task entry
- Adding a comment or renaming a variable
- Cosmetic changes that don't fix behavior
- "Improvements" without a concrete user-facing outcome
