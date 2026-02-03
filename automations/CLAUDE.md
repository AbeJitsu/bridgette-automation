# Automations — Directory Notes

## What This Is

Prompt templates and configuration for scheduled automations. Each subdirectory is one automation.

## Automations

| Name | Schedule | Description |
|------|----------|-------------|
| `content-creation/` | Daily 5 AM | Trending AI topics → 3 post options with Gemini images |
| `job-search/` | Daily 5 AM | Job boards → filtered matches → resume + cover letter |
| `codebase-eval/` | Weekly | Analyze needthisdone.com → prioritized report |

## How They Execute

1. launchd fires at scheduled time
2. Curls `POST localhost:3000/api/automations/<name>`
3. API route reads prompt template from this directory
4. Sends prompt to PTY session (or spawns claude -p for background)
5. Results saved to `results/` subdirectory with date

## Prompt Template Convention

Each automation has a `prompt.md` that defines what Claude should do. The API route reads this file and sends it as the prompt.

## Auto-Eval Prompts

The `auto-eval/` subdirectory contains prompts for the nightly eval system:

| Prompt | Eval Type | Purpose |
|--------|-----------|---------|
| `frontend.md` | Frontend | Find & fix 5-10 UI/UX issues with TDD |
| `backend.md` | Backend | Find & fix 5-10 API/reliability issues with TDD |
| `functionality.md` | Functionality | Find & fix 5-10 broken flows and missing features |
| `memory.md` | Memory | Find & fix 5-10 documentation issues |

### How They Work

1. Nightly scheduler triggers at configured time (default 3 AM EST)
2. Each eval type runs sequentially with configurable interval (default 1 hour)
3. Prompt instructs Claude to:
   - Read `.nightly-eval-fixes.md` to avoid duplication
   - Find top 5-10 issues by impact
   - Fix each using TDD (test → implement → commit)
   - Append fixes to `.nightly-eval-fixes.md` log
   - Run `npm run build` to verify clean state

### Maintenance

- **Fixes log** (`.nightly-eval-fixes.md`) — Auto-appended by evals, tracks what's been fixed to prevent duplication
- **Prompt updates** — Edit files here to change eval behavior; changes apply to next scheduled run

## Things Discovered

<!-- Add learnings about automations here -->
