# Code Quality Rule (No Broken Windows)

Fix warnings and errors immediately. Don't ignore them.

## Standards

| Issue | Action |
|-------|--------|
| Build warnings | Fix before shipping |
| Test failures | Fix, don't skip |
| TypeScript errors | Resolve, don't `@ts-ignore` |
| Linting failures | Address, don't disable |
| Half-done features | Complete or remove |

## Zero Warnings Policy

Production code must have:
- Zero ESLint warnings
- Zero TypeScript errors
- All tests passing

## When You See a Warning

1. Stop and fix it immediately
2. Don't move on until it's resolved
3. If you can't fix it, ask for help

The "I'll fix it later" mindset leads to technical debt that compounds.
