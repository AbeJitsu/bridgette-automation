# Color System Guidelines

## BJJ Belt Color Progression

The founder is a Brazilian Jiu-Jitsu purple belt. Use this color hierarchy:

| Order | Belt | Tailwind Palette | Usage |
|-------|------|------------------|-------|
| 1st | **Green** | `emerald-*` | Primary actions, success states, main CTAs |
| 2nd | **Blue** | `blue-*` | Secondary elements, links, professional tone |
| 3rd | **Purple** | `purple-*` | Tertiary accents, creativity, special emphasis |
| 4th | **Brown** | `gold-*` | Warm highlights, links on dark backgrounds |
| 5th | **Black** | `gray-800/900` | Final element, mastery, neutral anchor |

**How many elements?**
- **3 elements**: Green → Blue → Purple
- **4 elements**: Green → Blue → Purple → Brown (gold)
- **5 elements**: Green → Blue → Purple → Brown → Black (dark gray)

**Avoid**: Orange/amber for text. Use gold instead.

## Contrast Compliance (WCAG AA)

Minimum compliant shades on white backgrounds:

| Color | Min Text (4.5:1) | Min Border (3:1) |
|-------|------------------|------------------|
| Emerald | emerald-600 | emerald-500 |
| Blue | blue-600 | blue-500 |
| Purple | purple-600 | purple-500 |
| Gold | gold-700 | gold-500 |
| Gray | gray-600 | gray-400 |
| Red | red-600 | red-500 |

**Reference:** See `app/color-contrast-viewer.html` for full palette with ratios.

## Centralized Colors (Optional)

`lib/colors.ts` has pre-built color objects if you need them:

```typescript
import { accentColors, titleColors, formInputColors } from '@/lib/colors';

// Complex components with multiple color properties
<Card className={`${accentColors.blue.bg} ${accentColors.blue.text}`} />
```

For simple one-off colors, Tailwind classes are fine:

```typescript
// Simple usage - just use Tailwind directly
<h2 className="text-blue-600">Heading</h2>
<p className="text-gray-600">Body text</p>
```

## Note

Dark mode is currently disabled. Light mode only.
