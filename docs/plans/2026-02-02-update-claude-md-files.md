# Update CLAUDE.md Files Across Project Folders

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Document the nightly eval system in all relevant folder-specific CLAUDE.md files so future developers understand what each folder does and how it integrates with nightly scheduling.

**Architecture:** Each folder has its own CLAUDE.md that documents:
1. What the folder contains (purpose)
2. Key files and their roles
3. How it integrates with the nightly eval system
4. Setup/running instructions if applicable

**Tech Stack:** Markdown documentation

---

## Task 1: Update app/CLAUDE.md with Nightly Eval Information

**Files:**
- Modify: `app/CLAUDE.md`

**Step 1: Read the current file**

Run: `cat app/CLAUDE.md | head -50`

Expected: See current app-specific docs (Terminal, Auto-eval, API routes, etc.)

**Step 2: Read the root CLAUDE.md to see what we added about nightly**

Run: `grep -A 10 "Nightly eval schedule" CLAUDE.md`

Expected: See description of nightly config structure and purpose

**Step 3: Add nightly scheduler section to app/CLAUDE.md**

Find the "Built" section and add this after existing auto-eval documentation:

```markdown
- **Nightly eval scheduler** — Server-level scheduler in `server.ts` that runs all 4 eval types at configured time with hourly intervals. Schedules next night after current cycle completes. Config persisted to `.nightly-eval-config` JSON file. Coexists with idle-timer auto-eval (separate system). Handles graceful startup/shutdown with proper timeout cleanup.
```

**Step 4: Add nightly integration note to architecture section**

Add after "Auto-eval:" section:

```markdown
- **Nightly scheduler:** Separate from idle-timer auto-eval. Uses same `triggerServerAutoEval()` but overrides eval type rotation. Configured via Automations UI (NightlyScheduleCard component). Runs independently on schedule, doesn't reset timer.
```

**Step 5: Verify the edits**

Run: `grep -A 2 "Nightly" app/CLAUDE.md`

Expected: See both the new bullet points

**Step 6: Commit**

```bash
git add app/CLAUDE.md
git commit -m "Docs: Document nightly eval scheduler in app/CLAUDE.md"
```

---

## Task 2: Update automations/CLAUDE.md with Nightly Eval Reference

**Files:**
- Modify: `automations/CLAUDE.md`

**Step 1: Read current automations docs**

Run: `cat automations/CLAUDE.md`

Expected: See info about content-creation, job-search, codebase-eval automations

**Step 2: Add nightly eval prompts section**

Add at the end before "Things Discovered":

```markdown
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
```

**Step 3: Verify the edits**

Run: `grep -A 5 "Auto-Eval Prompts" automations/CLAUDE.md`

Expected: See the new section

**Step 4: Commit**

```bash
git add automations/CLAUDE.md
git commit -m "Docs: Document nightly eval prompts in automations/CLAUDE.md"
```

---

## Task 3: Update launchd/CLAUDE.md with Nightly Scheduler Note

**Files:**
- Modify: `launchd/CLAUDE.md`

**Step 1: Read current launchd docs**

Run: `cat launchd/CLAUDE.md`

Expected: See info about scheduled tasks and plists

**Step 2: Add nightly scheduler section**

Add at the end:

```markdown
## Nightly Eval Scheduler

The nightly eval scheduler is different from launchd-triggered automations. Instead of using plists:

- **Server-side scheduling** — `app/server.ts` contains the nightly scheduler logic
- **No launchd plists needed** — Evals run at configured time if server is running
- **Configuration** — Set via Automations UI in dashboard (NightlyScheduleCard)
- **Persistence** — Config saved to `.nightly-eval-config` at project root

Unlike launchd automations (which curl the API), the nightly scheduler:
1. Is built into the server
2. Runs 4 evals sequentially (frontend → backend → functionality → memory)
3. Has configurable start time and interval
4. Coexists with idle-timer auto-eval (different system)

For details, see `CLAUDE.md` "Nightly eval schedule" section.
```

**Step 3: Verify the edits**

Run: `grep -A 3 "Nightly Eval Scheduler" launchd/CLAUDE.md`

Expected: See the new section

**Step 4: Commit**

```bash
git add launchd/CLAUDE.md
git commit -m "Docs: Document nightly scheduler distinction in launchd/CLAUDE.md"
```

---

## Task 4: Update memory/CLAUDE.md with Nightly Eval Interaction

**Files:**
- Modify: `memory/CLAUDE.md`

**Step 1: Read current memory docs**

Run: `cat memory/CLAUDE.md`

Expected: See notes about memory system and curation

**Step 2: Add nightly eval interaction section**

Add at the end:

```markdown
## Integration with Nightly Eval System

The memory eval (4th of 4 nightly evals) updates documentation:

- Runs daily at ~6 AM EST (default schedule: 3 AM + 3-hour intervals)
- Updates `CLAUDE.md`, memory files, and `roadmap.md` based on recent code changes
- Reads `.nightly-eval-fixes.md` to understand what was fixed
- Appends fixes to the log for tracking

### Things to Know

1. **Memory eval updates are automatic** — No user input needed, happens during nightly cycle
2. **Can conflict with manual edits** — If you update CLAUDE.md overnight, memory eval might conflict
3. **Updates are committed** — Each fix gets its own commit with message starting "Docs:"
4. **No user notification** — Check Status tab or eval-log.json to see what was updated

For the full nightly eval system, see root `CLAUDE.md`.
```

**Step 3: Verify the edits**

Run: `grep -A 3 "Integration with Nightly" memory/CLAUDE.md`

Expected: See the new section

**Step 4: Commit**

```bash
git add memory/CLAUDE.md
git commit -m "Docs: Document memory eval interaction in memory/CLAUDE.md"
```

---

## Task 5: Verify All CLAUDE.md Files Are Consistent

**Files:**
- Read: All CLAUDE.md files for cross-references

**Step 1: Check that all files exist and have content**

Run: `for f in CLAUDE.md app/CLAUDE.md automations/CLAUDE.md launchd/CLAUDE.md memory/CLAUDE.md; do echo "=== $f ==="; wc -l $f; done`

Expected: All files show line counts > 0

**Step 2: Verify no conflicting info**

Run: `grep -h "nightly\|Nightly" CLAUDE.md app/CLAUDE.md automations/CLAUDE.md launchd/CLAUDE.md memory/CLAUDE.md 2>/dev/null | head -20`

Expected: See consistent descriptions of nightly system across all files

**Step 3: Final commit**

Run: `git status`

Expected: No uncommitted changes (all tasks committed)

**Step 4: Verify with git log**

Run: `git log --oneline -5`

Expected: See 4 new commits about CLAUDE.md updates

---

## Summary

After completing all tasks:

✅ Root `CLAUDE.md` — Documents nightly eval architecture and dev server setup
✅ `app/CLAUDE.md` — Explains nightly scheduler in server context
✅ `automations/CLAUDE.md` — Documents the 4 eval prompt files and how they work
✅ `launchd/CLAUDE.md` — Clarifies nightly scheduler is NOT launchd-based
✅ `memory/CLAUDE.md` — Explains memory eval's role and integration

All files cross-reference each other, so a developer can start in any folder and understand the nightly eval system.

---

**Plan complete and ready for execution. Ready to proceed?**
