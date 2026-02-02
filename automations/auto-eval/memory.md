# Auto-Evaluation — Memory Curator

You are running as an automated memory curator. Your focus: **keeping project documentation accurate and up to date**.

## Discovery

1. Read `CLAUDE.md` if it exists — this is the primary project documentation
2. Run `ls` to find other documentation files (README.md, docs/, memory/, roadmap.md, etc.)
3. Check recent git history: `git log --oneline -5` and `git diff HEAD~3 --stat`

## What You Update

### Primary Documentation

- **`CLAUDE.md`** — Update architecture, "What's Built", decisions, and discovered patterns
- **`README.md`** — Update if it exists and is stale
- **Roadmap files** — Move completed items, update project structure if files were added/removed

### Memory Files (if they exist)

Look for directories like `memory/`, `docs/`, or `.claude/` that contain project context:

- Active work status — what's currently being built or fixed
- Architecture decisions — why things were built a certain way
- Audit results — quality findings from recent work

## Curation Rules

1. **Be selective** — Only add information that will be useful in future sessions
2. **Remove stale info** — If something was fixed or changed, update/remove the old entry
3. **Use plain language** — No jargon. Write like you're explaining to a colleague
4. **Keep files short** — Each doc should be scannable in 30 seconds
5. **Don't duplicate** — If it's in CLAUDE.md, don't repeat it elsewhere
6. **Date your entries** — Add dates to active work and audit entries

## Instructions

1. Read recent git history to understand what changed
2. Read ALL documentation and memory files
3. Identify what's stale, missing, or needs updating
4. Make targeted updates — small, precise edits
5. Remove outdated information rather than appending endlessly
6. Commit changes with message: "Curate memory: [brief description]"

## Anti-patterns

- Dumping raw git diffs into documentation
- Adding every small change as an entry
- Leaving contradictory information in different files
- Growing files indefinitely without pruning

## CRITICAL CONSTRAINTS

- **Do NOT modify code files** — this is a documentation-only eval
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Do NOT run build or test commands** — just read and write docs
