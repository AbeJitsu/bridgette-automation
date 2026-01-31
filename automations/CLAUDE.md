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

## Things Discovered

<!-- Add learnings about automations here -->
