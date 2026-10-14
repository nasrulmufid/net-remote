# Colors & Tokens

## Core Intent Tokens

| Token | Use |
|-------|-----|
| `--color-primary` / `--color-primary-foreground` | Brand |
| `--color-success` / `--color-success-foreground` | Positive |
| `--color-warning` / `--color-warning-foreground` | Caution |
| `--color-danger` / `--color-danger-foreground` | Destructive |
| `--color-info` / `--color-info-foreground` | Informational |

## Surface Tokens

| Token | Use |
|-------|-----|
| `--color-background` | Page bg |
| `--color-foreground` | Primary text |
| `--color-surface` | Cards, dialogs |
| `--color-surface-2` | Nested / footer |
| `--color-surface-3` | Deepest stack |
| `--color-border` | Default borders |
| `--color-border-strong` | Emphasized |
| `--color-muted-foreground` | Secondary text |
| `--color-neutral` / `--color-neutral-foreground` | Neutral fills |
| `--color-accent` / `--color-accent-foreground` | Hover on neutral |
| `--color-highlight` / `--color-highlight-foreground` | Selected state |
| `--color-ring` | Focus ring (defaults to primary) |

## Geometry

- `--radius` (base) → `--radius-sm`, `--radius-md`, `--radius-lg`
- `--shadow-sm|md|lg|xl`
- `--spacing` (base unit for all padding/gap/height)

## Theming (Override)

```css
/* Global brand change */
:root {
  --color-primary: oklch(0.58 0.22 285); /* violet */
  --color-primary-foreground: oklch(1 0 0);
}

/* Dark mode already shipped; toggle with */
html[data-theme="dark"] { /* or .dark */ }
```

Or scoped:

```css
.my-brand-section {
  --color-primary: oklch(0.65 0.13 195);
}
```

## Density

```css
:root {
  --spacing: 0.2rem; /* compact */
  /* 0.25rem = default, 0.28rem = comfortable */
}
```

## Per-component Knobs

Almost every component exposes `--button-radius`, `--card-bg`, `--dialog-width`, etc. They fall back to the global tokens, so you can retune one component without affecting the system.

## Rules

1. Always change both a color and its `-foreground` pair.
2. Prefer OKLCH for new brand colors (better mixing).
3. Never hard-code colors in component markup; use tokens or modifiers.
