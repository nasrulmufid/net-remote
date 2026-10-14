# Stisla Frontend

Build production-ready SaaS / admin interfaces using **Stisla v3** — a modern,
framework-agnostic component library built on design tokens + BEM + Tailwind.

## Core Principles

1. **Token-first**: Every visual decision comes from CSS custom properties
   (`--color-*`, `--radius-*`, `--spacing`, etc.). Override tokens; never
   hard-code colors or spacing.
2. **BEM naming**: Block (`button`, `card`, `dialog`), Element (`__header`,
   `__body`), Modifier (`--primary`, `--sm`, `--outline`). Flat modifiers only —
   never nest.
3. **Intent over appearance**: Use semantic modifiers (`--primary`, `--danger`,
   `--success`) not color names.
4. **Framework-agnostic**: Vanilla CSS + small JS runtime first. Same markup
   works for React/Vue ports later.
5. **Accessibility built-in**: Focus rings, ARIA, keyboard contracts,
   reduced-motion respect.

## When to Use This Skill

- Creating any page that should look like a modern SaaS dashboard or admin panel
- Building forms, data tables, modals, sidebars, cards, buttons, badges
- Theming / dark mode / density changes
- Producing clean HTML examples that follow Stisla conventions

## Quick Start (CDN)

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/npm/@stisla/css@3/dist/stisla.css" />
<script src="https://cdn.jsdelivr.net/npm/@stisla/vanilla@3/dist/stisla.js"></script>
```

Or via packages:

```bash
npm install @stisla/css @stisla/vanilla
```

```js
import '@stisla/css';
import '@stisla/vanilla';
```

## File Structure of This Skill

- `references/rules.md` — Mandatory coding rules
- `references/components.md` — Component catalog & anatomy
- `references/layout.md` — App shell, sidebar, navbar patterns
- `references/forms.md` — Form controls, validation, field groups
- `references/tables.md` — Data tables, sorting, selection
- `references/modal.md` — Dialog / modal patterns
- `references/colors.md` — Token surface & theming
- `references/icons.md` — Icon usage conventions
- `assets/examples/` — Ready-to-use HTML templates (dashboard, form, table)

## How to Work

1. Read the relevant reference file before writing markup.
2. Always start from tokens and BEM classes — never invent new class names.
3. Prefer composition (card + table, sidebar + content) over custom CSS.
4. For interactive components (dialog, accordion, sidebar collapse, tabs…) use
   the `data-stisla-*` attributes + vanilla JS.
5. Provide complete, copy-pasteable HTML in examples.
6. Support both light and dark mode via `data-theme="dark"` or `.dark` on
   `<html>`.

## Key References

- Official docs: https://stisla.dev
- Specification: https://stisla.dev/docs/specification
- Theming: https://stisla.dev/docs/theming
- GitHub: https://github.com/stisla/stisla
