# Testing Flexibility Rule

Tests must be flexible and auto-discover content. Hardcoded lists go stale.

## The Problem

Hardcoded page lists in tests:
- Go stale when new pages are added
- Miss bugs on pages not in the list
- Require manual maintenance

## The Solution

Use the `page-discovery` utility instead of hardcoded lists:

```typescript
// BAD - hardcoded list
const pages = [
  { path: '/', name: 'Home' },
  { path: '/services', name: 'Services' },
  // ... goes stale when new pages added
];

// GOOD - dynamic discovery
import { discoverAllPages, discoverPublicPages } from './utils/page-discovery';

const pages = discoverAllPages();  // All pages
const publicPages = discoverPublicPages();  // Marketing pages only
```

## Available Functions

```typescript
import {
  discoverAllPages,      // All static pages
  discoverPublicPages,   // Marketing/public pages
  discoverAdminPages,    // Admin pages only
  discoverPagesByPattern // Custom pattern matching
} from './utils/page-discovery';
```

## When to Use Dynamic Discovery

| Test Type | Use Discovery? |
|-----------|----------------|
| Contrast/a11y scanning | Yes - scan ALL pages |
| Visual regression | Yes - capture ALL pages |
| Render stability | Yes - test ALL pages |
| Feature-specific tests | Maybe - if testing across multiple pages |
| Single page tests | No - hardcode is fine for one specific page |

## Migration

Tests with hardcoded page arrays should be migrated:

1. `screenshots.spec.ts` - Use `discoverAllPages()`
2. `page-render-stability.spec.ts` - Use `discoverPublicPages()`
3. `dark-mode-visual.spec.ts` - Use `discoverAllPages()`
4. `flow-capture.spec.ts` - Use `discoverAllPages()`

## Benefits

- New pages automatically included in tests
- No manual maintenance
- Bugs caught earlier
- Better coverage
