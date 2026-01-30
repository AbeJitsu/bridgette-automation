# ETC Principle - Easy To Change

Code should be easy to change. Every design decision should prioritize changeability.

## The Core Principle

When faced with a design choice, ask: **"Which option makes future changes easier?"**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ETC = Easy To Change                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Good code isn't about perfection - it's about adaptability.            │
│                                                                         │
│  If a change requires editing N files:                                  │
│    N = 1  →  Easy to change (good)                                      │
│    N = 5  →  Hard to change (bad)                                       │
│    N = 30 →  Nightmare (very bad)                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Red Flags (Code That's Hard to Change)

| Red Flag | Problem | Solution |
|----------|---------|----------|
| Same code in N files | One fix = N edits | Consolidate into one place |
| Hardcoded values scattered | Change requires grep + hope | Centralize configuration |
| Tightly coupled components | Can't change one without others | Decouple with interfaces |
| No abstraction layer | Implementation details everywhere | Create abstraction |
| Copy-paste patterns | Bug fix = hunt all copies | Create reusable function/hook |

## The ETC Test

Before committing code, ask:

1. **If this behavior needs to change, how many files do I edit?**
   - 1 file = pass
   - 2-3 files = acceptable if necessary
   - 4+ files = red flag, consider refactoring

2. **If I add a new instance (page, component, feature), what do I copy?**
   - Nothing = ideal (convention over configuration)
   - 1-2 lines = acceptable
   - 10+ lines = create abstraction

3. **Can someone unfamiliar with the code make this change?**
   - Yes, obviously = good
   - Needs tribal knowledge = document or simplify

## Practical Examples

### Bad: Repeated Boilerplate (20+ lines per file)

```tsx
// Same pattern in 5 files - fixing a bug means editing all 5
function mergeWithDefaults(content) { ... }  // 10 lines
const safeContent = useMemo(...);            // 3 lines
useEffect(() => { ... });                    // 5 lines
const content = mergeWithDefaults(...);      // 2 lines
```

### Good: Single Abstraction (1 line per file)

```tsx
// One hook handles everything - fix once, works everywhere
const { content } = useEditableContent('services', initialContent);
```

### Bad: Hardcoded Values

```tsx
// Scattered across codebase
<div className="text-blue-600 dark:text-blue-400">
<div className="bg-blue-100 dark:bg-blue-800">
```

### Good: Centralized Colors

```tsx
// One file defines all colors
import { accentColors } from '@/lib/colors';
<div className={accentColors.blue.text}>
```

## When Adding New Features

Before writing code, plan for change:

1. **Will there be more of these?** → Design for N, not 1
2. **What's likely to change?** → Make that part configurable
3. **What's stable?** → Can be more rigid

## The Goal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BEFORE: "I need to change X"                                           │
│    → Edit 15 files                                                      │
│    → Hope I found them all                                              │
│    → Pray nothing breaks                                                │
│                                                                         │
│  AFTER: "I need to change X"                                            │
│    → Edit 1 file                                                        │
│    → Done                                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Related Principles

- **DRY** (Don't Repeat Yourself) - ETC applied to duplication
- **Single Source of Truth** - ETC applied to data/configuration
- **Separation of Concerns** - ETC applied to responsibilities
- **YAGNI** - Don't add complexity until needed, but when adding, make it ETC

---

*"Make the change easy, then make the easy change." — Kent Beck*
