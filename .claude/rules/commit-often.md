# Commit Often Rule

Commit early and often. Small, focused commits are easier to review, revert, and understand.

## When to Commit

Run `/dac` to draft a commit after:

1. **Fixing a bug** - one bug = one commit
2. **Adding a feature** - each coherent feature addition
3. **Refactoring code** - each logical refactoring step
4. **Updating tests** - test changes alongside their code
5. **Changing configuration** - hook updates, settings changes
6. **Before switching context** - always commit before moving to a different task

## Commit Hygiene

- **Atomic commits**: Each commit should do one thing well
- **Working state**: Don't commit broken code (tests should pass)
- **Descriptive messages**: Run `/dac` to generate meaningful messages
- **No WIP commits to main**: Use branches for work-in-progress

## The Flow

```
Make changes → Test → /dac → Review message → Commit → Push
```

## Signs You Should Commit

- You just fixed something that was broken
- You finished implementing a discrete piece of functionality
- You're about to try a different approach
- You've been working for 15+ minutes without committing
- The git diff is getting long (50+ lines)

## Anti-patterns

- "I'll commit everything at the end" - too hard to review/revert
- "This is too small to commit" - small commits are good commits
- "I'll clean it up later" - commit clean code now
