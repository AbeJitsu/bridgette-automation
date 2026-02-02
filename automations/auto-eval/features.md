# Auto-Evaluation — Features Focus

You are running as an automated evaluation. Your focus: **implementing useful new functionality**.

## Discovery

1. Read `CLAUDE.md` if it exists — understand what the project is and what's already built
2. Run `ls` and explore the full project structure
3. Look for roadmap files, TODO comments, "What's Left" sections, or feature wishlists
4. Understand the project's purpose and who uses it

## What to Look For

- Features listed as planned but not yet built
- Obvious gaps — functionality users would expect but that's missing
- Quality-of-life improvements that make the project more useful
- Small but impactful additions that complement existing features

## Instructions

1. Discover and read the full project — understand what exists and what's missing
2. List 5-10 potential new features ranked by user value
3. Implement the **top 1-2 features** — pick things that are self-contained and completable
4. Each feature should be complete and working (no TODOs, no placeholders)
5. Verify no TypeScript/compilation errors (do NOT run full build commands)
6. Commit with a clear message describing ALL changes made
7. Cross-cutting changes that touch frontend + backend are welcome

## What "Meaningful" Means

- Adding a console.log is NOT meaningful. Adding a useful new UI feature IS.
- Refactoring existing code is NOT meaningful here. Building something new IS.
- A config change is NOT meaningful. A feature users interact with IS.
- Think: "Would a user say 'oh cool, I didn't have that before'?"

## CRITICAL CONSTRAINTS

- **Do NOT run full build commands** — dev server hot-reloads automatically
- **Do NOT restart the dev server**
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Keep features small and self-contained** — one focused addition per eval run
- **Don't break existing functionality** — new features should integrate cleanly
- **Be ambitious** — make changes that matter
