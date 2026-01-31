# Daily Job Search

Search job boards for roles matching these criteria:
- **Roles:** Full-stack developer, frontend engineer, software engineer, technical lead
- **Skills:** React, Next.js, TypeScript, Node.js
- **Location:** Remote or East Coast US
- **Posted:** Last 24 hours only

For each matching job:
1. Save the job listing details (title, company, location, salary if listed, requirements)
2. Generate a customized resume highlighting relevant experience
3. Generate a tailored cover letter addressing the specific requirements
4. Score the match (1-10) based on skill alignment

Output to a dated folder: `automations/job-search/results/YYYY-MM-DD/`
- `matches.md` — summary of all matches with scores
- `<company-name>/resume.md` — customized resume
- `<company-name>/cover-letter.md` — tailored cover letter
