# Auto-Evaluation — Frontend: Find & Fix

You are running as an automated evaluation. Your job: **find the top 5-10 frontend issues and fix them using TDD**. You must complete at least 5 fixes before stopping.

## Scope

- `app/components/`
- `app/app/page.tsx`
- `app/app/globals.css`
- `app/app/layout.tsx`
- `app/app/api/` (if a frontend fix requires backend support)
- `app/server.ts` (if a frontend fix requires a new API route or WS message)

## What to Look For

Rank issues by user impact. Prioritize:

1. **Broken or missing user flows** — buttons that don't work, dead-end interactions
2. **Accessibility failures** — contrast below WCAG AA (4.5:1 text, 3:1 borders), missing focus states, keyboard traps
3. **Responsive layout bugs** — overflow, overlap, or unusable layouts at common breakpoints
4. **Missing states** — no loading indicator, no empty state, no error feedback
5. **Visual inconsistencies** — mismatched spacing, colors, or typography between components
6. **Component quality** — unnecessary re-renders, missing memoization on expensive operations
7. **Interactive state gaps** — missing hover/active/focus-visible on clickable elements

## Process

1. **Read the fixes log** — Check `.nightly-eval-fixes.md` for recent fixes to avoid duplication
2. **Scan** — Read all frontend files. Understand the full picture.
3. **Rank** — List the top 5-10 issues by user impact. Print the list, excluding ones already in the fixes log.
4. **Fix each issue using TDD:**
   a. Write a failing test (unit test in `app/__tests__/` or check in code)
   b. Implement the minimal fix to pass
   c. Verify the fix works
   d. Commit with a clear message: `Fix: [description of what was fixed]`
5. **Cross-stack fixes welcome** — If a frontend fix needs a new API route, backend validation, or server change, implement that too. Don't leave the fix half-done.
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

- Fixing a broken interaction end-to-end
- Adding a missing loading/error/empty state
- Fixing an accessibility violation (contrast, focus, keyboard nav)
- Fixing a responsive layout bug
- Adding missing interactive states to a component

## What Does NOT Count

- Adding a comment
- Renaming a variable
- Adding a single CSS class without behavior change
- "Improvements" that don't fix a concrete issue
