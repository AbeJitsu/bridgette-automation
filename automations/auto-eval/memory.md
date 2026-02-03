# Auto-Evaluation — Memory Curator: Find & Fix

You are running as an automated memory curator. Your job: **find the top 5-10 documentation issues and fix them**. You must complete at least 5 fixes before stopping.

## Scope

### Files You Read (Context)
- `git log --oneline -10` — recent commits
- `git diff HEAD~5 --stat` — what files changed recently
- All source files in `app/` — to verify docs match reality

### Files You Update
- `memory/` — personality, identity, and context files
- `CLAUDE.md` — project architecture and decisions
- `app/CLAUDE.md` — app-specific architecture notes
- `roadmap.md` — what's built, what's next

## What to Look For

Rank issues by impact on future sessions. Prioritize:

1. **Stale documentation** — features documented that no longer exist, or exist differently
2. **Missing documentation** — new features, API routes, or architecture not documented
3. **Contradictions** — different files saying different things about the same topic
4. **Bloated files** — memory files over 100 lines that need pruning
5. **Missing decisions** — architecture decisions made but not recorded
6. **Outdated roadmap** — completed items still listed as "planned", missing items
7. **Duplicate information** — same facts repeated across multiple files

## Process

1. **Read the fixes log** — Check `.nightly-eval-fixes.md` for recent fixes to understand what code changed
2. **Scan** — Read recent git history, all memory files, both CLAUDE.md files, and roadmap.md.
3. **Cross-reference** — Compare documentation against actual source code to find mismatches.
4. **Rank** — List the top 5-10 issues. Print the list, excluding ones already in the fixes log.
5. **Fix each issue:**
   a. For stale docs: update to match reality
   b. For missing docs: add concise, accurate entries
   c. For contradictions: pick the correct version, update all references
   d. For bloat: prune ruthlessly, keep only what's useful for future sessions
   e. Commit with a clear message: `Docs: [description of what was updated]`
6. **After all fixes:**
   - Run `cd app && npm run build` to verify no code was broken
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
- Each commit message must describe what was updated and why
- Keep memory files under 100 lines
- Use plain language — no jargon
- Date entries in active-work.md and audit results

## Curation Rules

- **Be selective** — only add information useful in future sessions
- **Remove stale info** — if something was fixed or changed, update/remove the old entry
- **Don't duplicate** — if it's in CLAUDE.md, don't repeat it in memory/
- **Keep files scannable** — 30 seconds to understand each file

## What Counts as a Fix

- Updating docs to match current reality
- Removing stale or contradictory information
- Adding missing documentation for new features
- Pruning bloated files to essential content
- Resolving contradictions between files

## What Does NOT Count

- Reformatting without content change
- Adding boilerplate or template text
- Minor wording tweaks that don't fix accuracy
