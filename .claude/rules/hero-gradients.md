# Hero Gradient Pattern Rule

Hero sections use a "centered" gradient pattern where colorful orbs are constrained to a max-width container, leaving white margins on the sides. This creates visual framing around the content.

## The Pattern (ASCII)

```
CORRECT - Centered with white margins:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  white    ┌─────────────────────────────────────────────────────┐   white   │
│  ~25%     │                                                     │   ~25%    │
│           │   ╭──────╮                              ╭──────╮    │           │
│           │  ( color1 )       CONTENT HERE        ( color2 )    │           │
│           │   ╰──────╯                              ╰──────╯    │           │
│           │                                                     │           │
│           └─────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

WRONG - Edge-to-edge:
┌─────────────────────────────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  CONTENT  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Required Structure

The gradient orbs MUST be inside the max-width container, not the full-width section:

```tsx
{/* CORRECT - Orbs inside max-w container with overflow-hidden */}
<section className="py-16 md:py-20">
  <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
    <div className="relative overflow-hidden py-8">
      {/* Gradient orbs - full saturation colors with standard blur */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-{color}-100 to-{shade}-100 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-tr from-{accent}-100 to-{shade}-100 blur-2xl" />
      <div className="absolute top-20 left-1/4 w-32 h-32 rounded-full bg-{color}-100 blur-xl" />

      {/* Content with z-10 to stay above gradients */}
      <div className="relative z-10">
        {/* Page content here */}
      </div>
    </div>
  </div>
</section>
```

## What NOT To Do

```tsx
{/* WRONG - Full-width section with orbs at viewport edges */}
<section className="relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-{color}-50 via-white to-{accent}-50/50" />
  <div className="absolute -top-32 -right-32 ..." />  {/* These are relative to full viewport! */}
  <div className="absolute -bottom-20 -left-20 ..." />

  <div className="relative max-w-6xl mx-auto px-4">
    {/* Content */}
  </div>
</section>
```

## Critical Rules

| Rule | Correct | Wrong |
|------|---------|-------|
| Container | Orbs inside `max-w-6xl` | Orbs in full-width section |
| Overflow | `overflow-hidden` on inner `py-8` div | `overflow-hidden` on section |
| Base gradient | None needed | `absolute inset-0 bg-gradient-to-br...` |
| Positioning | `-top-32 -right-32` | `top-0 right-0` |
| Blur values | `blur-3xl`, `blur-2xl`, `blur-xl` | Too large: `blur-[100px]` |
| Colors | Full saturation `-100` | Muted with opacity `/80` |
| Content wrapper | `relative z-10` | No z-index |

## Color Themes by Page

| Page | Theme | Primary Colors |
|------|-------|----------------|
| Homepage | Blue/Purple | `blue-100`, `purple-100` |
| Services | Teal/Cyan | `teal-100`, `cyan-100` |
| Shop/Pricing | Purple/Blue | `purple-100`, `violet-100` |
| About | Amber/Blue | `amber-100`, `gold-100` |
| Blog | Purple/Gold | `purple-100`, `amber-100` |
| Legal pages | Slate/Gray | `slate-100`, `gray-100` |

## Why This Works

The homepage wraps everything in `max-w-6xl mx-auto`. The gradient orbs are positioned with negative margins (`-top-32 -right-32`) which pulls them slightly outside their container, but since the container is centered with margins, the orbs create color in the center area while leaving white space at the viewport edges.

When orbs are in a full-width section, those same negative margins just push them to the viewport edges, making the entire background colored with no white margins.
