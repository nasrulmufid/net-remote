# Stisla Components Catalog

## Button

```html
<button class="button button--primary">Save</button>
<button class="button button--neutral">Cancel</button>
<button class="button button--danger button--outline">Delete</button>
<button class="button button--ghost button--sm">
  <svg>...</svg> Edit
</button>
<button class="button button--primary button--icon-only" aria-label="Add">
  <svg>...</svg>
</button>
<button class="button button--primary" aria-busy="true">Saving…</button>
```

Modifiers: `--primary|success|warning|danger|info|neutral|tertiary`, `--outline|soft|ghost`, `--sm|lg|xl`, `--icon-only`, `--pill`, `--block`

## Card

```html
<div class="card">
  <div class="card__header">
    <h3 class="card__title">Title</h3>
    <div class="card__action">…</div>
  </div>
  <div class="card__body">Content</div>
  <div class="card__footer">Footer</div>
</div>
```

Elements: `__header`, `__body`, `__footer`, `__title`, `__subtitle`, `__image`, `__overlay`, `__heading`, `__action`

Modifiers: `__header--alt`, `__header--sm`, `--seamless`

## Dialog (Modal)

See `references/modal.md`

## Input / Field

```html
<div class="field">
  <label class="field__label" for="email">Email</label>
  <input class="input" id="email" type="email" placeholder="you@example.com" />
  <p class="field__description">We'll never share your email.</p>
</div>
```

Also: `.select`, `.textarea`, `.checkbox`, `.radio`, `.switch`

Sizes: `--sm`, `--lg`

States: `aria-invalid="true"` + `.field__error`

## Table

See `references/tables.md`

## Sidebar

See `references/layout.md`

## Badge

```html
<span class="badge badge--primary">New</span>
<span class="badge badge--soft badge--success">Active</span>
<span class="badge badge--danger">Failed</span>
```

## Avatar

```html
<img class="avatar" src="..." alt="Name" />
<span class="avatar avatar--sm">SR</span>
```

## Alert / Toast patterns

Use intent tokens + card or dedicated alert component when available.

## Accordion

```html
<div class="accordion" data-stisla-accordion>
  <div class="accordion__item" data-state="open">
    <button class="accordion__trigger" data-stisla-accordion-trigger>…</button>
    <div class="accordion__body">…</div>
  </div>
</div>
```

## Other common components

- `.media` — avatar + content row
- `.list-group` / `.list-group__item`
- `.tabs` / `.tabs__list` / `.tabs__trigger` / `.tabs__panel`
- `.pagination`
- `.breadcrumb`
- `.progress`
- `.spinner` / loading indicators
- `.dropdown` / `.popover` / `.tooltip`
- `.navbar` (top bar)

Always check the official component page for exact slots and data attributes.
