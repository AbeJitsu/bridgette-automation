# Moltbot: What It Is, What It Costs, and Whether It's Worth It

*A practical guide for developers considering Moltbot — January 30, 2026*

---

## Why This Document Exists

You've heard the buzz about Moltbot (formerly Clawdbot). You're wondering if it could help you work smarter — whether that's planning your own projects or automating workflows for clients. This guide cuts through the hype and gives you the real picture: what Moltbot actually does, what it costs, where it shines, and where it falls short.

By the end, you'll know exactly whether Moltbot makes sense for your situation.

---

## Quick Summary

**What Moltbot is:** An open-source agent framework that connects AI models (Claude Haiku 4.5, Sonnet 4.5, Opus 4.5) to your messaging apps, browser, and local machine. It runs 24/7 and maintains persistent memory across weeks of conversations.

**What Moltbot is NOT:** It's not an AI model itself. It's not a Claude Code replacement. It's not magic.

**The honest trade-offs:**

```
┌─────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ The Good                                        │ The Real Talk                                │
├─────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Persistent memory across weeks                  │ Security concerns are documented and real    │
│                                                 │                                              │
│ Multi-channel access (WhatsApp, Telegram, etc.) │ Costs $100-750/month for serious use         │
│                                                 │                                              │
│ 24/7 autonomous operation                       │ Claude-only for best results                 │
│                                                 │                                              │
│ Great for repetitive, criteria-based workflows  │ Requires deliberate setup and security care  │
└─────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

**Bottom line:** Moltbot is genuinely useful for specific use cases. Serious use costs $100-750/month, but you can kick the tires with Haiku 4.5 for $5-20/month. It requires deliberate setup and attention to security.

---

## Part 1: Understanding What Moltbot Actually Is

### The Name Change

On January 27, 2026, Anthropic asked creator Peter Steinberger to rename "Clawdbot" (and mascot "Clawd") due to trademark similarity with Claude. He rebranded to "Moltbot" — named after lobsters molting their shells.

Same tool. Same code. New name.

### The Core Concept

Think of Moltbot as a control plane that sits between you and an AI model. You bring your own Claude API key (Haiku 4.5, Sonnet 4.5, or Opus 4.5), and Moltbot adds:

```
┌─────────────────────────┬───────────────────────────────────────────────────────────────────┐
│ Feature                 │ Description                                                       │
├─────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ 24/7 operation          │ Runs as a background daemon on your machine                       │
│                         │                                                                   │
│ Multi-channel messaging │ Talk to it via WhatsApp, Telegram, Slack, Discord, iMessage, etc. │
│                         │                                                                   │
│ Persistent memory       │ Remembers conversations from weeks ago                            │
│                         │                                                                   │
│ Tool access             │ Can control your browser, run commands, manage files              │
│                         │                                                                   │
│ Scheduled automation    │ Proactive check-ins, cron jobs, webhooks                          │
└─────────────────────────┴───────────────────────────────────────────────────────────────────┘
```

### How It Compares to Claude Chat and Claude Code

All three use the same underlying AI. The difference is the wrapper — what sits around the model.

```
┌─────────────────────────┬─────────────────────────┬────────────────────────────┬────────────────────────────────┐
│ Capability              │ Claude Chat (claude.ai) │ Claude Code (CLI)          │ Moltbot                        │
├─────────────────────────┼─────────────────────────┼────────────────────────────┼────────────────────────────────┤
│ Agentic (takes actions) │ No — suggests only      │ Yes — runs commands, edits │ Yes — runs commands, browses   │
│                         │                         │                            │                                │
│ Memory across sessions  │ Projects (limited)      │ Session-based (resets)     │ Weeks/months (Markdown files)  │
│                         │                         │                            │                                │
│ Runs as                 │ Browser tab             │ On-demand CLI              │ 24/7 background daemon         │
│                         │                         │                            │                                │
│ Interface               │ Web browser             │ Terminal / IDE             │ Any messaging app              │
│                         │                         │                            │                                │
│ Proactive messages      │ No                      │ No                         │ Yes (scheduled check-ins)      │
│                         │                         │                            │                                │
│ Codebase understanding  │ Upload files only       │ Deep (agentic search, git) │ Basic                          │
│                         │                         │                            │                                │
│ Best for                │ One-off questions       │ Development work           │ Automation + persistent memory │
│                         │                         │                            │                                │
│ Cost                    │ $20/month subscription  │ Included with subscription │ $100-750/month (API)           │
└─────────────────────────┴─────────────────────────┴────────────────────────────┴────────────────────────────────┘
```

The key distinction: Claude Code is already agentic for development — it reads your codebase, runs tests, creates commits. Moltbot's advantage isn't "it can do things" (Claude Code can too), it's **persistent memory** and **always-on multi-channel access**.

### The Architecture (Simple Version)

```
Your Machine
├── Moltbot Gateway (always running)
│   ├── Connected to: WhatsApp, Telegram, Slack, etc.
│   ├── Tools: Browser control, file system, cron
│   └── Memory: Markdown files on disk
│
└── AI Provider: Anthropic (Claude)
    ├── Claude Haiku 4.5   ← budget
    ├── Claude Sonnet 4.5  ← balanced
    └── Claude Opus 4.5    ← max capability
```

---

## Part 2: How the Memory System Works

This is Moltbot's most distinctive feature, so it's worth understanding clearly.

### Memory = Plain Markdown Files

There's no magic database. Moltbot stores everything in human-readable Markdown files:

```
~/clawd/
├── SOUL.md          → Agent's personality and boundaries
├── AGENTS.md        → Operating instructions and rules
├── USER.md          → Facts about you
├── MEMORY.md        → Long-term decisions and context
├── HEARTBEAT.md     → Scheduled check-in prompts
└── memory/
    ├── 2026-01-29.md  → Today's conversation log
    └── 2026-01-28.md  → Yesterday's log
```

### What Gets Loaded When

Every session, Moltbot reads these files to "remember" context:

```
┌─────────────────┬───────────────────────────────────────┬───────────────────┐
│ File            │ Purpose                               │ When Loaded       │
├─────────────────┼───────────────────────────────────────┼───────────────────┤
│ `SOUL.md`       │ Who the agent is                      │ Every session     │
│                 │                                       │                   │
│ `USER.md`       │ Who you are                           │ Every session     │
│                 │                                       │                   │
│ `memory/` files │ Recent daily logs (today + yesterday) │ Every session     │
│                 │                                       │                   │
│ `MEMORY.md`     │ Long-term decisions and context       │ Direct chats only │
└─────────────────┴───────────────────────────────────────┴───────────────────┘
```

### Why This Matters

You can manually edit these files. Want the agent to know something? Add it to `USER.md`. Made a business decision? Log it in `MEMORY.md`. The agent will "remember" it next session.

You can also version control them with git — which means your agent's memory is backed up and recoverable.

---

## Part 3: The Cost Reality

Let's be direct about money. A Reddit post from this week put it plainly: *"Moltbot is an unaffordable novelty"* for many users. Here's the actual math.

### Why It Gets Expensive

Moltbot is "agentic" — it makes multiple API calls per interaction, re-sends context each time, and runs tool operations. Token usage adds up fast.

### Model Options and Monthly Costs

```
┌───────────────────┬─────────────────────────────┬──────────────────────────┬───────────────────────┬─────────────────────────────────────────┐
│ Model             │ API Pricing (per 1M tokens) │ Monthly Cost (Heavy Use) │ Moltbot Compatibility │ Best For                                │
├───────────────────┼─────────────────────────────┼──────────────────────────┼───────────────────────┼─────────────────────────────────────────┤
│ Claude Opus 4.5   │ $5 in / $25 out             │ $360-750                 │ Native (best)         │ Business workflows with budget          │
│                   │                             │                          │                       │                                         │
│ Claude Sonnet 4.5 │ $3 in / $15 out             │ $100-150                 │ Native (great)        │ Personal experimentation                │
│                   │                             │                          │                       │                                         │
│ Claude Haiku 4.5  │ $1 in / $5 out              │ $5-20                    │ Native (good)         │ Budget experimentation, light workflows │
└───────────────────┴─────────────────────────────┴──────────────────────────┴───────────────────────┴─────────────────────────────────────────┘
```

### Recommended Starting Point

**For budget experimentation:** Haiku 4.5 API at $5-20/month. Native compatibility, good enough to test workflows.

**For personal experimentation:** Sonnet 4.5 API at $100-150/month. Strong reasoning, great for most workflows.

**For business with budget:** Opus 4.5 API at $360-750/month. Best quality, highest reliability.

---

## Part 4: Where Moltbot Actually Shines

Moltbot isn't for everything. Here's where it genuinely adds value.

### Great Use Case: Repetitive, Criteria-Based Workflows

**Example: Influencer outreach automation**

A 5-step process a human does manually:
1. **Find** — Search for influencers matching criteria
2. **Qualify** — Check follower count, engagement, niche fit
3. **Research** — Review recent content, brand deals, audience
4. **Personalize** — Write custom outreach email
5. **Send** — Queue for approval or send

This is perfect for Moltbot because:
- It's repetitive (same steps, hundreds of times)
- It's criteria-based (clear rules for qualification)
- It's research-heavy (Moltbot can browse and summarize)
- It's writing-intensive (LLMs excel at personalized copy)
- Volume is the bottleneck, not judgment

**ROI math:** If a human does 20 outreach/day and Moltbot does 150, you get 7.5x volume. At $1000/month API cost with 5% conversion and $500/deal, that's potentially $50K+/month return.

### Great Use Case: Persistent Planning Context

**Example: SaaS product planning for needthisdone.com**

When you're early-stage and wearing all hats, context is scattered. Moltbot becomes the external brain that remembers:
- What you decided and why
- What experiments are running
- What users said in interviews
- What's blocked and what's next

Sample `HEARTBEAT.md` for weekly planning:
```markdown
## Monday 9am
- What are this week's top 3 priorities?
- Any decisions from last week that need follow-up?

## Friday 5pm
- What did we ship this week?
- What did we learn?
- What's blocked?
```

### Not a Great Use Case: Deep Coding Work

For actual development, Claude Code is better:
- Deep codebase understanding via agentic search
- Native git integration (commits, branches, PRs)
- IDE extensions (VS Code, JetBrains)
- Included with your Claude Max subscription (no extra cost)

**The right mental model:** Claude Code for coding. Moltbot for the planning, memory, and automation layer around your coding.

---

## Part 5: Moltbot vs Claude Code

Since you're already a Claude Code user, here's the direct comparison.

```
┌────────────────────────┬────────────────────────────────────┬────────────────────────────┐
│ Aspect                 │ Moltbot                            │ Claude Code                │
├────────────────────────┼────────────────────────────────────┼────────────────────────────┤
│ Primary purpose        │ Life automation, persistent memory │ Code development           │
│                        │                                    │                            │
│ AI model               │ Claude (Haiku/Sonnet/Opus 4.5)     │ Claude (built-in)          │
│                        │                                    │                            │
│ Runs as                │ 24/7 background daemon             │ On-demand CLI              │
│                        │                                    │                            │
│ Messaging              │ WhatsApp, Telegram, Slack, etc.    │ Terminal only              │
│                        │                                    │                            │
│ Memory                 │ Weeks/months (Markdown files)      │ Session-based (resets)     │
│                        │                                    │                            │
│ Codebase understanding │ Basic                              │ Deep (agentic search)      │
│                        │                                    │                            │
│ Git integration        │ Minimal                            │ Native                     │
│                        │                                    │                            │
│ Cost                   │ $100-750/month (API)               │ Included with subscription │
│                        │                                    │                            │
│ Security               │ Early-stage, concerns documented   │ Enterprise-grade           │
└────────────────────────┴────────────────────────────────────┴────────────────────────────┘
```

### When to Use Which

```
┌──────────────────────────────────────────┬─────────────┐
│ Task                                     │ Use This    │
├──────────────────────────────────────────┼─────────────┤
│ Write or refactor code                   │ Claude Code │
│                                          │             │
│ Understand a codebase                    │ Claude Code │
│                                          │             │
│ Create commits and PRs                   │ Claude Code │
│                                          │             │
│ Remember planning decisions across weeks │ Moltbot     │
│                                          │             │
│ Proactive morning summaries              │ Moltbot     │
│                                          │             │
│ Quick updates via phone                  │ Moltbot     │
│                                          │             │
│ Automated notifications                  │ Moltbot     │
│                                          │             │
│ Deep debugging                           │ Claude Code │
└──────────────────────────────────────────┴─────────────┘
```

---

## Part 5b: Multi-User Support — Can You and Your Boss Share One Moltbot?

**Short answer:** Yes, through multi-agent routing — not a shared conversation.

Moltbot supports multiple users on a single Gateway instance. Here are three ways to set it up.

### Option A: One Agent, Multiple Channels (Simplest)

Run one Moltbot instance backed by the Claude API. Both users message the same agent via different channels (e.g., you on Telegram, boss on WhatsApp) or even the same channel.

- Moltbot identifies users by **Peer ID** (phone number, username, etc.)
- **Shared memory**: All conversations merge into the same `MEMORY.md` and `memory/` files
- **Limitation**: No user-level memory isolation — what you tell it, your boss's sessions also see

### Option B: Separate Agents Per User (Better Isolation)

Run one Gateway with two agents, each getting its own workspace:

```
~/.clawdbot/agents.json  →  routing rules by Peer ID
~/clawd-abiezer/         →  your agent's workspace (USER.md, MEMORY.md, SOUL.md)
~/clawd-boss/            →  boss's agent's workspace
```

- Route DMs by phone number: your WhatsApp → your agent, boss's WhatsApp → boss's agent
- Both agents share the same Claude API key (one bill)
- Use the **shared-memory skill** (community plugin) if you want specific memories visible to both

### Option C: Shared Group + Individual DMs (Hybrid — Recommended)

- Create a **shared group chat** (Slack channel, Telegram group) bound to one agent for team topics
- Each person also has a **private DM** routed to their own agent for personal context
- Best of both worlds: shared planning context + individual privacy

### Multi-User Cost Impact

```
┌─────────────────────┬──────────────────────────┬───────────────────────────┬─────────────────────────┐
│ Setup               │ Monthly Cost (Haiku 4.5) │ Monthly Cost (Sonnet 4.5) │ Monthly Cost (Opus 4.5) │
├─────────────────────┼──────────────────────────┼───────────────────────────┼─────────────────────────┤
│ One shared agent    │ $5-20                    │ $100-150                  │ $360-750                │
│                     │                          │                           │                         │
│ Two separate agents │ $10-40                   │ $150-300                  │ $500-1500               │
└─────────────────────┴──────────────────────────┴───────────────────────────┴─────────────────────────┘
```

Multi-agent means more API calls since each agent maintains its own context window.

### Setup Steps (Claude API)

1. Get an Anthropic API key from console.anthropic.com
2. Install: `npm install -g moltbot@latest`
3. Onboard: `moltbot onboard --auth-choice anthropic-api-key`
4. Configure `agents.json` in `~/.clawdbot/` to define separate agents with routing rules based on Peer ID
5. Connect messaging channels for both users

### Relevant Docs

- [Multi-Agent Routing](https://docs.molt.bot/concepts/multi-agent)
- [Shared Memory Skill](https://github.com/VoltAgent/awesome-moltbot-skills)
- [Moltbot FAQ](https://docs.molt.bot/help/faq)

---

## Part 6: Security — What You Need to Know

The security concerns are real and documented. This isn't FUD — security researchers have published findings.

### The Main Issues

```
┌──────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────┬──────────┐
│ Issue                        │ Description                                                                             │ Severity │
├──────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ Plaintext credential storage │ API keys and secrets stored in readable Markdown/JSON files                             │ High     │
│                              │                                                                                         │          │
│ Exposed admin ports          │ Researchers found hundreds of instances with unauthenticated ports open to the internet │ Critical │
│                              │                                                                                         │          │
│ Supply chain attacks         │ A proof-of-concept malicious skill achieved RCE via the ClawdHub registry               │ Critical │
│                              │                                                                                         │          │
│ No default sandboxing        │ Moltbot has the same permissions as your user account                                   │ High     │
│                              │                                                                                         │          │
│ Prompt injection             │ Processing emails or web content can inject malicious instructions                      │ Medium   │
└──────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────┴──────────┘
```

### How to Mitigate

```
┌──────────────────────────┬────────────────────────────────────────────┐
│ Mitigation               │ Details                                    │
├──────────────────────────┼────────────────────────────────────────────┤
│ Run in a VM or container │ Not on your primary machine                │
│                          │                                            │
│ Use dedicated accounts   │ Separate email, calendar, etc. for Moltbot │
│                          │                                            │
│ Firewall admin ports     │ Don't expose to the internet               │
│                          │                                            │
│ Vet skills carefully     │ Don't install unverified plugins           │
│                          │                                            │
│ Treat it as experimental │ Not production infrastructure              │
└──────────────────────────┴────────────────────────────────────────────┘
```

---

## Part 7: Getting Started Tomorrow

If you want to try Moltbot, here's a practical path.

```
┌──────────────────┬────────────────────────────────┬─────────────────────────────────┬──────────────────────────────────┐
│                  │ Option A: Budget Experiment     │ Option B: Balanced Setup        │ Option C: Full Power             │
├──────────────────┼────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────┤
│ Cost             │ $5-20/month (Haiku 4.5 API)    │ $100-150/month (Sonnet 4.5 API) │ $360-750/month (Opus 4.5 API)    │
│                  │                                │                                 │                                  │
│ Model            │ Claude Haiku 4.5               │ Claude Sonnet 4.5               │ Claude Opus 4.5                  │
│                  │                                │                                 │                                  │
│ TOS Risk         │ None                           │ None                            │ None                             │
│                  │                                │                                 │                                  │
│ Setup Difficulty │ Easy                           │ Easy                            │ Easy                             │
│                  │                                │                                 │                                  │
│ Quality          │ Adequate for testing workflows │ Great (Sonnet 4.5)              │ Best available (max capability)  │
└──────────────────┴────────────────────────────────┴─────────────────────────────────┴──────────────────────────────────┘
```

### Option A: Budget Experiment with Haiku 4.5 ($5-20/month)

Use Claude Haiku 4.5 via the Anthropic API. Cheap enough to just try it.

```bash
# Install
npm install -g moltbot@latest

# Set up with Anthropic API key
moltbot onboard --auth-choice anthropic-api-key

# Select Haiku 4.5 as your model during onboard
# Or edit ~/.clawdbot/config.json afterward:
#   "model": "claude-haiku-4-5-20250501"
```

Haiku won't match Sonnet's reasoning depth, but it's good enough to test whether Moltbot's memory system, messaging channels, and workflow automation fit your thinking style — all for the price of a coffee.

### Option B: Balanced Setup with Sonnet 4.5 ($100-150/month)

Use Anthropic API directly. Strong reasoning, great for most workflows.

```bash
# Install
npm install -g moltbot@latest

# Set up with Anthropic API key
moltbot onboard --auth-choice anthropic-api-key

# Select Sonnet 4.5 during onboard
```

### Option C: Full Power with Opus 4.5 ($360-750/month)

Maximum capability for business workflows with budget.

```bash
# Install
npm install -g moltbot@latest

# Set up with Anthropic API key
moltbot onboard --auth-choice anthropic-api-key

# Select Opus 4.5 during onboard
```

### After Installation

1. **Populate your workspace files:**
   - Edit `~/clawd/USER.md` with context about yourself and your projects
   - Add key decisions to `~/clawd/MEMORY.md`
   - Set up `HEARTBEAT.md` for proactive check-ins

2. **Connect a messaging channel:**
   - Telegram is easiest (just create a bot token)
   - WhatsApp requires more setup

3. **Test the memory:**
   - Tell it something about your project
   - Close the session
   - Start a new session and ask about it
   - Verify it remembered

---

## Part 8: Real-World Use Case — Influencer Outreach Agent

Here's a concrete example of configuring Moltbot for the influencer outreach workflow.

### Sample AGENTS.md

```markdown
# Influencer Outreach Agent

## Your Role
Find, qualify, and reach out to influencers for [Company/Product].

## Qualification Criteria
- Followers: 10,000 - 100,000
- Engagement rate: 3%+
- Niche: [fitness / beauty / tech / etc.]
- Recent post frequency: at least 2x/week
- No competing brand deals in last 30 days
- Has email in bio OR findable via hunter.io

## Research Requirements
Before drafting outreach, gather:
- 3 recent posts (topics, tone, engagement)
- Bio summary
- Any brand collaborations visible
- Audience vibe (comments sentiment)

## Email Template Style
- Subject: Personal, not salesy
- Opening: Reference specific recent content
- Value prop: [what you're offering]
- CTA: Simple reply ask
- Length: Under 150 words

## Workflow
1. When given a search query or list, find candidates
2. Qualify against criteria above
3. Research each qualified candidate
4. Draft personalized email
5. Queue for human approval (never auto-send without explicit approval)

## Reporting
Log all outreach to memory/outreach-log.md:
- Date, influencer handle, email, status
- Response tracking when replies come in
```

### Cost Projection

```
┌─────────────────┬──────────────────────────┬───────────────────────────┬─────────────────────────┐
│ Daily Volume    │ Monthly Cost (Haiku 4.5) │ Monthly Cost (Sonnet 4.5) │ Monthly Cost (Opus 4.5) │
├─────────────────┼──────────────────────────┼───────────────────────────┼─────────────────────────┤
│ 50 influencers  │ $15-25                   │ $50-75                    │ $125-175                │
│                 │                          │                           │                         │
│ 100 influencers │ $30-50                   │ $100-150                  │ $250-350                │
│                 │                          │                           │                         │
│ 150 influencers │ $50-75                   │ $150-225                  │ $400-500                │
│                 │                          │                           │                         │
│ 200 influencers │ $65-100                  │ $200-300                  │ $500-700                │
└─────────────────┴──────────────────────────┴───────────────────────────┴─────────────────────────┘
```

At $1000/month, you can process 150-200 influencers daily — far more than a human.

---

## Part 10: First-Day Setup Checklist

A practical checklist for getting Moltbot running tomorrow morning.

```
┌───┬──────────────────────────────────────────────────────────────────────────────┬─────────┐
│ # │ Step                                                                         │ Time    │
├───┼──────────────────────────────────────────────────────────────────────────────┼─────────┤
│ 1 │ Verify Node.js 22+ installed: `node --version`                               │ 1 min   │
│   │                                                                              │         │
│ 2 │ Install: `npm install -g moltbot@latest`                                     │ 1 min   │
│   │                                                                              │         │
│ 3 │ Run QuickStart: `moltbot onboard`                                            │ 3 min   │
│   │ — Choose auth method (API key recommended)                                   │         │
│   │ — Select model (Haiku 4.5 for budget, Sonnet 4.5 for quality,                  │         │
│   │   Opus 4.5 for max capability)                                               │         │
│   │                                                                              │         │
│ 4 │ Connect Telegram as first channel                                            │ 2-3 min │
│   │ — Open Telegram, message @BotFather                                          │         │
│   │ — /newbot → name it → copy the token                                         │         │
│   │ — Paste token when moltbot prompts                                           │         │
│   │                                                                              │         │
│ 5 │ Firewall port 18789 (admin UI)                                               │ 1 min   │
│   │ — Don't expose to the internet                                               │         │
│   │                                                                              │         │
│ 6 │ Run health check: `moltbot doctor --fix`                                     │ 1 min   │
│   │ — Catches config issues and auto-repairs what it can                         │         │
│   │                                                                              │         │
│ 7 │ Edit ~/clawd/USER.md                                                         │ 5 min   │
│   │ — Add your name, projects, preferences                                       │         │
│   │ — This is what the agent "knows" about you                                   │         │
│   │                                                                              │         │
│ 8 │ Set up ~/clawd/HEARTBEAT.md                                                  │ 3 min   │
│   │ — Add at least one scheduled prompt (e.g., "Monday 9am: Weekly priorities?") │         │
│   │ — No HEARTBEAT.md = no proactive check-ins                                   │         │
│   │                                                                              │         │
│ 9 │ Test memory persistence                                                      │ 2 min   │
│   │ — Tell it a fact via `moltbot chat`                                          │         │
│   │ — Close session, reopen, ask about the fact                                  │         │
│   │ — Verify it remembered                                                       │         │
└───┴──────────────────────────────────────────────────────────────────────────────┴─────────┘
```

---

## Part 11: Common Gotchas

Things that trip people up on day one.

```
┌──────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
│ Gotcha                                   │ Fix                                                              │
├──────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Overpermissioning at setup               │ Start minimal — don't grant file system or shell access on day 1 │
│                                          │                                                                  │
│ No HEARTBEAT.md = no proactive check-ins │ Create one even if minimal; without it, agent never reaches out  │
│                                          │                                                                  │
│ WhatsApp/iMessage QR state lives in      │ Don't delete ~/.clawdbot/ — it stores channel auth state         │
│ ~/.clawdbot                              │ Deleting it means re-scanning QR codes for all channels          │
│                                          │                                                                  │
│ "Providers" renamed to "Channels"        │ Docs/config auto-migrates, but if you see old references,        │
│                                          │ run `moltbot doctor --fix` to clean up                           │
│                                          │                                                                  │
│ Config looks wrong after changes         │ `moltbot doctor --fix` catches invalid configs                   │
│                                          │                                                                  │
│ Not sure what's running                  │ `moltbot status --all` shows daemon, channels, model, memory     │
└──────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## Part 9: The Bottom Line

### Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┬─────────────────────────────┐
│ Scenario                                                                    │ Recommendation              │
├─────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
│ You have a clear, repetitive workflow to automate                           │ Consider Moltbot            │
│                                                                             │                             │
│ You're willing to spend $100-750/month on API costs                         │ Consider Moltbot            │
│                                                                             │                             │
│ You'll run it in a sandboxed environment                                    │ Consider Moltbot            │
│                                                                             │                             │
│ You want persistent memory across sessions that Claude Code doesn't provide │ Consider Moltbot            │
│                                                                             │                             │
│ You want a cheap experiment before committing                               │ Try Haiku 4.5 ($5-20/month) │
│                                                                             │                             │
│ Your main need is coding assistance                                         │ Use Claude Code instead     │
│                                                                             │                             │
│ You're not comfortable with the security trade-offs                         │ Skip Moltbot                │
│                                                                             │                             │
│ You need non-Claude model support                                          │ Skip Moltbot                │
└─────────────────────────────────────────────────────────────────────────────┴─────────────────────────────┘
```

### My Recommendation

**For your personal project (needthisdone.com):** Start with Claude Code for all development work. If you find yourself wanting persistent planning memory across sessions, try Moltbot with Sonnet 4.5 API ($100-150/month) in a sandbox.

**For the client with deep pockets:** If they have $1000/month budget and a clear workflow (like influencer outreach), Moltbot with Opus 4.5 can genuinely deliver 10x ROI on repetitive, criteria-based work. The key is defining the workflow precisely in AGENTS.md.

**For tomorrow morning:** Start with Haiku 4.5 via the Anthropic API ($5-20/month). Native Claude compatibility and cheap enough to just explore. Follow the First-Day Setup Checklist (Part 10) and see if the tool fits your thinking style before scaling up to Sonnet or Opus.

---

## Sources

### Moltbot
- [GitHub Repository](https://github.com/moltbot/moltbot)
- [Official Documentation](https://docs.molt.bot)
- [Model Providers Docs](https://docs.molt.bot/concepts/model-providers)
- [Memory Documentation](https://docs.molt.bot/concepts/memory)
- [TechCrunch Coverage](https://techcrunch.com/2026/01/27/everything-you-need-to-know-about-viral-personal-ai-assistant-clawdbot-now-moltbot/)
- [Security Analysis (AIMultiple)](https://research.aimultiple.com/moltbot/)
- [1Password Security Analysis](https://1password.com/blog/its-moltbot)
- [Reddit Discussion on Costs](https://reddit.com/r/ClaudeAI)

### Claude Code
- [Official Documentation](https://code.claude.com/docs/en/overview)
- [Best Practices (Anthropic)](https://www.anthropic.com/engineering/claude-code-best-practices)

### Pricing
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

---

*Last updated: January 30, 2026*
