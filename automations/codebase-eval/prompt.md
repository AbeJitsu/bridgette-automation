# Codebase Evaluation

Analyze the Need_This_Done codebase at ~/Projects/Personal/Need_This_Done for:

1. **Dead code** — Unused exports, unreachable branches, orphaned files
2. **Bloat** — Oversized components (>500 lines), duplicated logic, unnecessary dependencies
3. **Unclear purpose** — Files or functions with vague names, missing context, no documentation
4. **Security concerns** — Exposed secrets, SQL injection vectors, XSS vulnerabilities
5. **Performance** — N+1 queries, unnecessary re-renders, missing memoization

Output a prioritized report:
- **Critical** — Must fix (security, data loss risk)
- **High** — Should fix soon (performance, major bloat)
- **Medium** — Fix when convenient (dead code, unclear naming)
- **Low** — Nice to have (style, minor cleanup)

Save to: `automations/codebase-eval/results/YYYY-MM-DD.md`

Compare with previous audit results in `memory/AUDIT_RESULTS.md` and note what's improved or worsened.
