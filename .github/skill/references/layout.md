# Layout Patterns (SaaS / Admin Shell)

Stisla does not force a fixed layout. You compose sidebar + main content yourself.

## Classic App Shell

```html
<div class="app">
  <!-- Sidebar -->
  <aside class="sidebar" data-stisla-sidebar id="app-sidebar" style="--sidebar-width: 16rem;">
    <div class="sidebar__header">
      <a class="sidebar__brand" href="#">
        <span class="sidebar__brand-icon">…</span>
        <span>Acme SaaS</span>
      </a>
    </div>

    <div class="sidebar__content">
      <div class="sidebar__group">
        <div class="sidebar__group-title">Main</div>
        <ul class="sidebar__list">
          <li class="sidebar__item">
            <a class="sidebar__button" href="#" aria-current="page">
              <svg class="sidebar__icon">…</svg>
              <span>Dashboard</span>
            </a>
          </li>
          <li class="sidebar__item">
            <a class="sidebar__button" href="#">
              <svg class="sidebar__icon">…</svg>
              <span>Customers</span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="sidebar__footer">
      <!-- user menu or collapse button -->
      <button data-stisla-sidebar-toggle="collapse" aria-controls="app-sidebar">
        Collapse
      </button>
    </div>
  </aside>

  <!-- Main -->
  <div class="app__main">
    <header class="navbar">…</header>
    <main class="app__content">
      <!-- page content -->
    </main>
  </div>
</div>
```

## Sidebar Features

- Collapse / rail mode: `data-collapsed` on the sidebar + `data-stisla-sidebar-toggle="collapse"`
- Nested menus: `.sidebar__submenu` + `data-state="open|closed"` + caret
- Active item: `aria-current="page"` or `data-state="active"`
- Sizes: `.sidebar--sm` | default | `.sidebar--lg`

## Navbar (Topbar)

Usually a flex row with:

- Page title / breadcrumb
- Search
- Notifications
- User avatar + dropdown

Use plain flex + Tailwind utilities or a thin `.navbar` wrapper.

## Content Area

Typical page structure:

```html
<main class="app__content p-6">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-semibold">Dashboard</h1>
    <button class="button button--primary">New item</button>
  </div>

  <!-- stats cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
    <div class="card">…</div>
  </div>

  <!-- main card with table or form -->
  <div class="card">
    <div class="card__header">…</div>
    <div class="card__body p-0"> <!-- often zero padding for tables -->
      …
    </div>
  </div>
</main>
```

## Density

Change global density by overriding `--spacing`:

```css
:root {
  --spacing: 0.2rem; /* compact admin */
}
```

## Responsive

- On small screens hide sidebar behind a drawer / off-canvas pattern (use dialog or custom).
- Tables get `.table-responsive` wrapper.
