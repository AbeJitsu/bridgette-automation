# Need This Done - Design Brief

## Brand Identity

**Purpose**: Professional project services platform that helps people get work done right

**Target Audience**: Professionals and businesses needing reliable project execution

**Brand Personality**:
- Professional and trustworthy (foundation)
- Warm and approachable (not corporate or cold)
- Creative and energetic (not boring or generic)
- Supportive and capable (inspires confidence)

## Color Philosophy - BJJ Belt Progression

The founder is a Brazilian Jiu-Jitsu purple belt. The brand colors follow the BJJ belt progression:

| Priority | Color | Tailwind Palette | Meaning | Usage |
|----------|-------|------------------|---------|-------|
| 1st | **Green** | `emerald-*` | Growth, action | Primary CTAs, success states, main buttons |
| 2nd | **Blue** | `blue-*` | Trust, professionalism | Links, secondary buttons, professional tone |
| 3rd | **Purple** | `purple-*` | Creativity, mastery | Special emphasis, tertiary accents |
| 4th | **Gold** | `gold-*` | Achievement, warmth | Warm highlights, links on dark backgrounds |

**Avoid**: Orange/amber for text (use gold instead). Gray for neutral elements only.

When arranging multiple colored elements, follow this progression top-to-bottom or left-to-right.

## Current Design Language

**Color Palette**:
- **Primary progression**: Green → Blue → Purple → Gold (BJJ belt order)
- **Neutral**: Gray (foundation, secondary buttons)
- **Approach**: Soft gradients, warm grayscale undertones

**Typography**:
- **Font**: Inter (clean, readable, modern sans-serif)
- **Scale**: Currently standard, open to more dramatic heading sizes

**Visual Style**:
- Clean, spacious layouts
- Card-based interfaces with glassmorphism effects
- Floating elements with soft shadows/glows
- Subtle animations on interactions

## Visual Effects

**Glassmorphism Cards** (light backgrounds):
```css
bg-gradient-to-r from-gray-100 to-white shadow-xl border border-gray-100
```

**Backlight Glow** (dark backgrounds):
```css
box-shadow: 0 0 40px rgba(255,255,255,0.18), 0 0 70px rgba(255,255,255,0.1)
```

**Floating Buttons** (colored shadows matching button):
```css
shadow-lg shadow-emerald-500/25  /* for green buttons */
shadow-lg shadow-blue-500/25     /* for blue buttons */
shadow-lg shadow-purple-500/25   /* for purple buttons */
```

## Design Constraints (Non-Negotiable)

See [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md) for complete technical standards.

Summary:
- **Accessibility**: 5:1 contrast minimum (WCAG AA)
- **Dark Mode**: Currently disabled, light mode only
- **Color System**: Extend `app/lib/colors.ts` (don't replace)
- **Testing**: New components need `.a11y.test.tsx` files

## Opportunities for Enhancement

**Encouraged**:
- Subtle animations and micro-interactions
- More dramatic typography scales for key pages
- Creative layouts (asymmetry, grid-breaking, overlapping elements)
- Visual interest (textures, patterns, gradient overlays)
- Distinctive hover states and focus indicators
- Glassmorphism and floating effects

**Preserve**:
- Professional, trustworthy tone (avoid overly playful aesthetics)
- BJJ belt color progression
- Existing component APIs and patterns
- Accessibility standards

## Plugin Guidance Philosophy

Let the frontend-design plugin suggest aesthetic directions that:
- Add warmth and energy to the professional foundation
- Create distinctive, memorable interfaces
- Respect the BJJ belt color hierarchy
- Avoid generic "AI slop" design patterns
- Maintain accessibility and usability standards
