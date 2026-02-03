# Auto-Evaluation — Backend: Find & Fix

You are running as an automated evaluation. Your job: **find the top 5-10 backend issues and fix them using TDD**. You must complete at least 5 fixes before stopping.

## Scope

- `app/server.ts`
- `app/app/api/`
- `app/lib/`
- `tasks.json`
- `app/components/` (if a backend fix changes the API surface and the UI needs updating)

## What to Look For

Rank issues by reliability impact. Prioritize:

1. **Data corruption risks** — race conditions in file I/O, missing atomic writes, concurrent access
2. **Unhandled errors** — missing try/catch on async operations, unvalidated input, missing status codes
3. **Security gaps** — path traversal, injection, missing input sanitization, shell command safety
4. **WebSocket stability** — state cleanup on disconnect, reconnection edge cases, message validation
5. **Memory leaks** — uncleaned timers, event listeners, growing maps without cleanup
6. **Missing validation** — API routes accepting malformed data without checking
7. **Logging gaps** — errors that silently fail with no trace
8. **Process safety** — child processes that can hang, missing timeouts, unbounded buffers

## Process

1. **Read the fixes log** — Check `.nightly-eval-fixes.md` for recent fixes to avoid duplication
2. **Scan** — Read all backend files. Understand the full picture.
3. **Rank** — List the top 5-10 issues by reliability impact. Print the list, excluding ones already in the fixes log.
4. **Fix each issue using TDD:**
   a. Write a failing test that demonstrates the bug or missing behavior
   b. Implement the minimal fix to pass
   c. Verify the fix works
   d. Commit with a clear message: `Fix: [description of what was fixed]`
5. **Cross-stack fixes welcome** — If a backend fix changes an API response shape or adds a new field, update the frontend component that consumes it. Don't leave the fix half-done.
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

- Preventing a data corruption scenario
- Adding proper error handling to an entire API route
- Fixing a security vulnerability
- Adding input validation that prevents real bad input
- Fixing a memory leak or process cleanup issue
- Adding proper WebSocket state cleanup

## What Does NOT Count

- Adding a single try/catch without context
- A cosmetic log message change
- Renaming a variable
- Adding a comment
