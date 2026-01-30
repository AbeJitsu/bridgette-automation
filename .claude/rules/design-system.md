# Design System

Design standards, accessibility requirements, and component guidelines.

## Color System

**Location:** `app/lib/colors.ts`

All colors are centralized. Import from `@/lib/colors`:
- `accentColors` - Primary action colors
- `titleColors` - Typography emphasis
- `gradients` - Background gradients

**Rule:** Extend the existing palette, don't replace it.

### BJJ Belt Color Hierarchy

When using multiple colors together, follow the BJJ belt progression:

```
Green (1st) → Blue (2nd) → Purple (3rd) → Gold (4th)
```

**Note:** "Green" in the color system uses Tailwind's `emerald-*` palette for a refined, professional look.

**Avoid orange/amber for text.** Use gold for warm accents.

### Color-Specific Usage

| Color | Tailwind Palette | Use For |
|-------|------------------|---------|
| Green | `emerald-*` | Primary CTAs, success states, first in sequences |
| Blue | `blue-*` | Links, secondary buttons, professional elements |
| Purple | `purple-*` | Tertiary accents, creativity, special emphasis |
| Gold | `gold-*` | Warm highlights, links on dark backgrounds |
| Gray | `gray-*` | Neutral buttons, secondary actions |
| Stone | `stone-*` | Warm neutrals (used on /about, /resume) |
| Slate | `slate-*` | Cool neutrals (used sparingly) |

## Accessibility Standards (WCAG AA)

| Element | Minimum Ratio |
|---------|---------------|
| Normal text | 4.5:1 |
| Large text (18pt+) | 3:1 |
| UI components (borders, icons) | 3:1 |

We target **5:1 minimum** for all text.

### Minimum Compliant Shades (on white)

| Color | Min Text | Min Border |
|-------|----------|------------|
| Emerald | -600 | -500 |
| Blue | -600 | -500 |
| Purple | -600 | -500 |
| Gold | -700 | -500 |
| Gray | -600 | -400 |
| Stone | -600 | -500 |
| Slate | -600 | -400 |

**Critical:** `stone-400` (2.52:1) fails 3:1 - use `stone-500` minimum for borders.

**Reference:** `app/color-contrast-viewer.html` - Full palette with contrast ratios

**Verify with:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Visual Effects

### Glassmorphism Cards (on light backgrounds)

```tsx
<div className="p-6 rounded-2xl bg-gradient-to-r from-gray-100 to-white shadow-xl border border-gray-100">
```

### Backlight Glow (on dark backgrounds)

```tsx
style={{
  boxShadow: '0 0 40px rgba(255,255,255,0.18), 0 0 70px rgba(255,255,255,0.1)',
}}
```

### Floating Buttons (colored shadows)

```tsx
<Button variant="green" className="shadow-lg shadow-emerald-500/25">
<Button variant="blue" className="shadow-lg shadow-blue-500/25">
<Button variant="purple" className="shadow-lg shadow-purple-500/25">
```

## Component Patterns

### Existing Components

Check `app/components/` before building new ones:
- **Layout:** Card, PageHeader, CTASection
- **Content:** ServiceCard, PricingCard, StepCard, FeatureCard
- **UI:** Button, CircleBadge

### Building New Components

1. Check for similar existing components
2. Import colors from `@/lib/colors`
3. Follow BJJ belt color hierarchy for multi-color elements
4. Add `.a11y.test.tsx` file if interactive
5. Consider adding a Storybook story

## Running Tests

```bash
npm run test:a11y     # Accessibility tests only
npm run test:run      # All tests
```

## Note

Dark mode is currently disabled. Light mode only.
