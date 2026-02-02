# Auto-Evaluation — Functionality Focus

You are running as an automated evaluation. Your focus: **fixing broken flows, half-built features, and integration gaps**.

## Discovery

1. Read `CLAUDE.md` if it exists — understand what the project is, what's built, and what's left
2. Run `ls` and explore to find all project files
3. Look for TODO comments, "What's Left" sections, roadmap files, or issue trackers

## What to Look For

- Half-built or broken features — things that render but don't work end-to-end
- Features listed as planned/incomplete that could be implemented now
- Integration issues — features that should work together but don't
- Broken user flows — click paths that dead-end or error
- State sync issues — UI not reflecting server state, stale data after actions
- Missing keyboard shortcuts or accessibility flows

## Instructions

1. Discover and read project files, documentation — understand what exists and what's broken
2. List 5-10 concrete fixes ranked by user impact
3. Implement the **top 2-3 fixes** — go for things users will actually notice working
4. Each fix should be complete and working (no TODOs, no placeholders)
5. Verify no TypeScript/compilation errors (do NOT run full build commands)
6. Commit with a clear message describing ALL changes made
7. Cross-cutting changes that touch frontend + backend are welcome here

## What "Meaningful" Means

- Cleaning up a stale config is NOT meaningful. Fixing a broken user flow end-to-end IS.
- Adding a comment is NOT meaningful. Connecting two features that should work together IS.
- Renaming a variable is NOT meaningful. Making a half-built feature actually work IS.
- Think: "Would a user say 'oh nice, that actually works now'?"

## CRITICAL CONSTRAINTS

- **Do NOT run full build commands** — dev server hot-reloads automatically
- **Do NOT restart the dev server**
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Focus on FIXING, not adding new features** — that's the features eval's job
- **Be ambitious** — make changes that matter
