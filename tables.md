# Stisla Rules (Mandatory)

## 1. Class Naming — BEM Only

- Block: `.button`, `.card`, `.dialog`, `.sidebar`, `.table`, `.input`
- Element: `.card__header`, `.dialog__panel`, `.sidebar__item`
- Modifier: `.button--primary`, `.button--sm`, `.card--seamless`
- Never nest modifiers. Compose flat: `.button.button--primary.button--lg.button--outline`
- Never invent new class names. If something is missing, use utilities or token overrides.

## 2. Tokens First

- Colors: `--color-primary`, `--color-danger`, `--color-surface`, `--color-foreground`, etc.
- Geometry: `--radius`, `--radius-sm|md|lg`, `--shadow-md`, `--spacing`
- Never hard-code `#hex`, `rgb()`, or pixel values for colors/spacing that should be themeable.
- Override via CSS custom properties on `:root`, a wrapper, or the element itself.

## 3. Intent Modifiers

Allowed intent set (use these, nothing else):

- `--primary` (brand / main CTA)
- `--success`
- `--warning`
- `--danger`
- `--info`
- `--neutral`
- `--tertiary`

Emphasis (orthogonal):

- (default) solid
- `--outline`
- `--soft`
- `--ghost`

## 4. Sizing Scale

Shared across components:

- `--sm`
- (default = md)
- `--lg`
- `--xl` (where supported)

## 5. Interactive States

Always support:

- Rest
- `:hover`
- `:active`
- `:focus-visible` (never plain `:focus` for visible ring)
- `:disabled` / `aria-disabled="true"`
- `aria-busy="true"` for loading

## 6. Accessibility

- Use native elements (`<button>`, `<a>`, `<input>`) whenever possible.
- Provide `aria-label` on icon-only controls.
- Use `aria-current="page"` for navigation current item.
- Use `data-state="open|closed|active"` where the library expects it.
- Respect `prefers-reduced-motion`.

## 7. Layout Philosophy

- Stisla does **not** ship a grid system. Use Tailwind utilities or plain CSS flex/grid.
- Sidebar is content-only; the page layout decides fixed/sticky/width.
- Cards, tables, forms should sit cleanly inside each other with `--seamless` when needed.

## 8. Dark Mode

- Toggle with `data-theme="dark"` or class `.dark` on `<html>`.
- Intents (primary, danger…) stay the same color; surfaces flip.
- Always test both themes.

## 9. No Bootstrap

Stisla v3 is **not** Bootstrap. Do not use Bootstrap classes (`.btn`, `.card-body`, `.modal-dialog`, etc.).

## 10. Output Style

When generating HTML:

- Clean, indented, semantic markup
- Complete examples (include `<!DOCTYPE html>` when full page)
- Prefer CDN for quick demos unless the user asks for npm
- Comment only when the structure is non-obvious
