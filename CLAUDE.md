# Bridgette — Project Documentation

**Bridgette** is a Next.js dashboard with a real interactive terminal (xterm.js + node-pty), memory editor, and automations panel. Runs on localhost:3000 via launchd.

## Documentation Structure

Each directory has its own `CLAUDE.md` with relevant context. **Load only what you need** — don't read everything to work on one part.

| Directory | Purpose | When to Read |
|-----------|---------|--------------|
| [`app/`](app/CLAUDE.md) | Next.js dashboard, components, API routes, dev workflow | Working on the app |
| [`memory/`](memory/CLAUDE.md) | Personality, identity, persistent facts | Updating memory files |
| [`launchd/`](launchd/CLAUDE.md) | Scheduled eval triggers, plist configuration | Working on scheduling |
| [`automations/`](automations/CLAUDE.md) | Prompt templates for evals | Adding/modifying automations |
| [`scripts/`](scripts/CLAUDE.md) | Utility scripts (dev-control.sh, etc.) | Using helper scripts |
| [`.claude/`](.claude/CLAUDE.md) | Project rules and coding standards | Learning conventions |

## Quick Navigation

- **First time?** → [`app/CLAUDE.md`](app/CLAUDE.md)
- **Testing nightly scheduler?** → [`app/CLAUDE.md`](app/CLAUDE.md) → Development Workflow
- **Working on scheduling?** → [`launchd/CLAUDE.md`](launchd/CLAUDE.md)
- **Updating personality/memory?** → [`memory/CLAUDE.md`](memory/CLAUDE.md)
- **Project standards?** → [`.claude/rules/`](.claude/rules/)
- **Using scripts?** → [`scripts/CLAUDE.md`](scripts/CLAUDE.md)

---

## Documentation Maintenance

**Keep documentation current.** When you learn something new about a subsystem, **update that subsystem's CLAUDE.md immediately**.

### When to Update

Update the appropriate CLAUDE.md when you:
- Discover how something actually works (docs may be wrong)
- Learn about a gotcha or limitation
- Change how something works
- Find a pattern worth documenting
- Realize documentation is missing

### How to Update

1. **Identify the subsystem** — What does this relate to? (app, memory, launchd, automations, scripts, or rules?)
2. **Edit that CLAUDE.md** — Add or update information in that directory's file
3. **Include context** — Explain "why" not just "what"
4. **Commit** — `git commit -m "docs: [what you updated] in [which]/CLAUDE.md"`

### Documentation Standards

- **Accuracy first** — Keep in sync with actual code
- **Complete examples** — Copy-paste ready commands
- **Clear sections** — Headers and tables
- **No duplication** — Link instead of repeat

---

## Current State

- **Running:** launchd service (`com.bridgette.server`) on localhost:3000
- **Features:** Terminal, Memory editor, Automations, 5-tab dashboard, Auto-eval (5-type rotation), Nightly scheduler
- **Dev tools:** `scripts/dev-control.sh` for lifecycle management

## Project Structure

```
bridgette-automation/
├── CLAUDE.md              ← You are here (navigation)
├── app/                   ← Next.js dashboard
│   └── CLAUDE.md
├── memory/                ← Persistent memory files
│   └── CLAUDE.md
├── launchd/               ← Scheduled tasks
│   └── CLAUDE.md
├── automations/           ← Prompt templates
│   └── CLAUDE.md
├── scripts/               ← Utility scripts
│   └── CLAUDE.md
└── .claude/               ← Project rules
    ├── CLAUDE.md
    └── rules/
```
