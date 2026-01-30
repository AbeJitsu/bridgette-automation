# Skills & Commands Reference

Tested Jan 8-9, 2025. Consolidated for autonomous workflow.

## Quick Reference

| Name | Type | Trigger | Status |
|------|------|---------|--------|
| dac | Command | `/dac` | **WORKS** |
| pragmatic-audit | Skill | "pragmatic audit" | **WORKS** |
| think-ahead | Skill | "think ahead" | **WORKS** |
| launch-a-swarm | Skill | "launch a swarm" | **WORKS** |
| frontend-design | Skill | Describe UI task | **WORKS** |
| worktree-swarm | Skill | Parallelize task | **WORKS** |

---

## Command

### /dac - Draft a Commit
**Trigger:** `/dac`
**What it does:** Analyzes git changes, drafts commit message using IFCSI tone, auto-commits small changes.

---

## Skills (in `.claude/skills/`)

### pragmatic-audit
**Trigger:** "pragmatic audit"
**What it does:** Scans for Pragmatic Programmer anti-patterns: DRY, SOLID, KISS, hardcoded values, broken windows.

### think-ahead
**Trigger:** "think ahead"
**What it does:** Strategic planning partner - reads work state, spots dependencies, plans next moves.

### launch-a-swarm
**Trigger:** "launch a swarm"
**What it does:** Spawns 5 parallel agents checking Structure, Protection, Correctness, Evolution, Value.

### frontend-design
**Trigger:** Ask to build UI/frontend
**What it does:** Guides creation of distinctive, production-grade frontend code with bold aesthetic direction.

### worktree-swarm
**Trigger:** Ask to parallelize across agents
**What it does:** Orchestrates parallel Claude Code agents using git worktrees.

---

## Removed (Jan 9, 2025)

| Item | Reason |
|------|--------|
| /check-work | Redundant with session-start hook |
| /document | Referenced broken hooks and removed screenshot workflow |
| /page-audit | 40% was dark mode checks (dark mode disabled) |
| screenshot-workflow | Missing 5 sub-commands |

---

## Rules for Skills

1. Test before deploying
2. If it references sub-commands, ensure they exist
3. If it doesn't work, delete or fix it
4. Document what each skill does clearly
