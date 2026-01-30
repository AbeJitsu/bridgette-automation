# PR Verification Rule

Never merge a PR without local verification. Fetch it, test it, review it.

## The Workflow

```
Browser Claude creates PR → Fetch locally → Test → Review → Merge or Fix
```

## Fetching a PR

```bash
# Fetch and checkout the PR (easiest method)
gh pr checkout <PR-number>

# Example
gh pr checkout 42
```

This automatically:
- Fetches the branch from origin
- Creates a local branch
- Checks it out for you

## Verification Checklist

Run these before merging:

| Step | Command | What to Check |
|------|---------|---------------|
| 1. Dev server | `cd app && npm run dev` | App loads without errors |
| 2. E2E tests | `cd app && npm run test:e2e` | All tests pass |
| 3. A11y tests | `cd app && npm run test:a11y` | No accessibility regressions |
| 4. Review diff | `git diff main...HEAD` | Changes match intent |
| 5. Build check | `cd app && npm run build` | No build errors |

## Quick Verification (minimum)

For small, low-risk changes:

```bash
gh pr checkout <PR#>
cd app && npm run dev          # Check it runs
cd app && npm run test:e2e     # Tests pass
```

## Full Verification (recommended)

For larger changes or anything touching critical paths:

```bash
gh pr checkout <PR#>
cd app && npm run dev          # Check it runs
cd app && npm run test:e2e     # E2E tests
cd app && npm run test:a11y    # Accessibility
cd app && npm run build        # Production build
git diff main...HEAD           # Review all changes
```

## What to Look For in Review

- **Does the change match what you asked for?**
- **Any files changed that shouldn't be?**
- **Are there console errors or warnings?**
- **Does the UI look right?**

## After Verification

**If everything passes:**
```bash
# Merge on GitHub (keeps PR history clean)
gh pr merge <PR#> --merge

# Or merge locally
git checkout main
git merge <branch-name>
git push
```

**If issues found:**
1. Note the specific problems
2. Either fix locally and push, or
3. Comment on PR and have browser Claude fix it

## Anti-patterns

- Merging PRs directly on GitHub without local testing
- Assuming tests passed in CI (CI might not exist or be comprehensive)
- Skipping verification because "it's a small change"
- Reviewing only the files you expected to change (check ALL changed files)
