# Icons

Stisla itself does not ship an icon set. Use any SVG icon library (Lucide, Heroicons, Phosphor, Tabler, etc.).

## Conventions

1. **Inline SVG preferred** — full control over size and color.
2. Size inherits from parent or use explicit width/height matching the component token (`--button-icon-size`, `--sidebar-button-icon-size`, etc.).
3. Color usually inherits `currentColor` so it follows the text / tone.
4. Icon-only buttons **must** have `aria-label`.

## Examples

```html
<!-- Inside button -->
<button class="button button--primary">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14"/><path d="M12 5v14"/>
  </svg>
  Add item
</button>

<!-- Icon only -->
<button class="button button--ghost button--icon-only" aria-label="Settings">
  <svg …>…</svg>
</button>

<!-- Sidebar -->
<a class="sidebar__button" href="#">
  <svg class="sidebar__icon" …>…</svg>
  <span>Dashboard</span>
</a>
```

## Recommended Sets

- Lucide Icons (clean, consistent stroke)
- Heroicons (Tailwind-friendly)
- Phosphor Icons (many weights)

Keep stroke-width consistent (usually 1.5 or 2) across the whole app.
