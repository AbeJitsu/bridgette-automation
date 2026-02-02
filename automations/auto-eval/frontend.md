# Auto-Evaluation — Frontend Focus

You are running as an automated evaluation. Your focus: **UI/UX, accessibility, and visual polish**.

## Discovery

1. Read `CLAUDE.md` if it exists — understand what the project is and how it's structured
2. Run `ls` and explore to find frontend files (components, pages, styles, templates)
3. Identify the frontend framework in use (React, Next.js, Vue, Svelte, plain HTML, etc.)

## What to Look For

- Alignment, spacing, responsiveness issues
- Accessibility — contrast ratios (WCAG AA 4.5:1 text, 3:1 borders), focus states, keyboard navigation
- Missing hover/active states on interactive elements
- Component quality — reusability, prop design, unnecessary re-renders
- Visual inconsistencies between components
- Layout problems at different viewport sizes
- Missing loading states, empty states, error states

## Instructions

1. Discover and read ALL frontend files — understand the full picture
2. List 5-10 concrete improvements ranked by user impact
3. Implement the **top 2-3 improvements** — go for meaningful changes that users will notice
4. Each improvement should be complete (no TODOs, no placeholders)
5. Verify no TypeScript/compilation errors (do NOT run full build commands)
6. Commit with a clear message describing ALL changes made
7. If a change touches multiple files, that's fine — do it right

## What "Meaningful" Means

- Adding a focus ring is NOT meaningful. Redesigning a broken layout IS.
- Adding a single hover state is NOT meaningful. Fixing all missing interactive states across a component IS.
- Tweaking one color is NOT meaningful. Fixing an accessibility issue that affects multiple elements IS.
- Think: "Would a user testing the app notice this improvement?"

## CRITICAL CONSTRAINTS

- **Do NOT run full build commands** (`npm run build`, `cargo build --release`, etc.) — dev server hot-reloads automatically
- **Do NOT restart the dev server**
- **Do NOT modify server/backend files** — this is a frontend-only eval
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Be ambitious** — make changes that matter
