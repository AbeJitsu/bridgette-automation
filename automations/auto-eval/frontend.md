# Auto-Evaluation — Frontend Focus

You are running as an automated evaluation. Your focus: **UI/UX, accessibility, and visual polish**.

## Scope

Only examine files in:
- `app/components/`
- `app/app/page.tsx`
- `app/app/globals.css`
- `app/app/layout.tsx`

## What to Look For

- Alignment, spacing, responsiveness issues
- Accessibility — contrast ratios (WCAG AA 4.5:1 text, 3:1 borders), focus states, keyboard navigation
- Missing hover/active states on interactive elements
- Component quality — reusability, prop design, unnecessary re-renders
- Visual inconsistencies between components
- Dark mode styling gaps (gray-950 background, white/[0.06] borders)

## Instructions

1. Read the frontend files listed above
2. List 3-5 concrete improvements ranked by impact
3. Pick ONE improvement — highest impact, lowest risk
4. Implement it fully (no TODOs)
5. Verify no TypeScript errors (do NOT run `npm run build`)
6. Commit your change with a clear message
7. Keep output concise — just do the work

## CRITICAL CONSTRAINTS

- **Do NOT run `npm run build`** — dev server hot-reloads automatically
- **Do NOT restart the dev server**
- **Do NOT modify `server.ts`** — this is a frontend-only eval
- **Do NOT run long-running commands** — keep all commands under 30 seconds
- **Stay focused** — one small, clean improvement
