# Dialog / Modal

## Basic Markup

```html
<!-- Trigger -->
<button class="button button--primary" data-stisla-dialog-trigger="confirm-delete">
  Delete
</button>

<!-- Dialog -->
<div class="dialog" id="confirm-delete" data-stisla-dialog>
  <div class="dialog__backdrop" data-stisla-dialog-dismiss></div>
  <div class="dialog__panel">
    <div class="dialog__content">
      <div class="dialog__header">
        <h2 class="dialog__title">Delete item?</h2>
        <button class="dialog__close" data-stisla-dialog-dismiss aria-label="Close">×</button>
      </div>
      <div class="dialog__body">
        This action cannot be undone.
      </div>
      <div class="dialog__footer">
        <button class="button button--neutral" data-stisla-dialog-dismiss>Cancel</button>
        <button class="button button--danger">Delete</button>
      </div>
    </div>
  </div>
</div>
```

## Required Data Attributes

| Attribute | Where | Purpose |
|-----------|-------|---------|
| `data-stisla-dialog` + `id` | root | Registers the dialog |
| `data-stisla-dialog-trigger="id"` | button / link | Opens it |
| `data-stisla-dialog-dismiss` | backdrop, close, cancel | Closes it |

## Size Modifiers

- `.dialog--sm`
- (default)
- `.dialog--lg`
- `.dialog--xl`
- `.dialog--almost-fullscreen`
- `.dialog--fullscreen`

## Position

- Default: centered
- `.dialog__panel--top`
- `.dialog__panel--bottom`

## Scrollable Body

```html
<div class="dialog__panel dialog__panel--scrollable">
```

## Static Backdrop (no dismiss on click / ESC)

```html
<div class="dialog" data-stisla-dialog data-stisla-dialog-backdrop="static" data-stisla-dialog-keyboard="false">
```

## Confirmation Pattern (Alert Dialog)

```html
<div class="dialog dialog--sm" role="alertdialog" …>
  <!-- icon box with tone -->
  <!-- centered title + description -->
  <!-- Cancel + Confirm buttons -->
</div>
```

## Events

Listen on the dialog root:

- `stisla:dialog:opening` (cancelable)
- `stisla:dialog:opened`
- `stisla:dialog:closing` (cancelable)
- `stisla:dialog:closed`

## Customization Tokens

`--dialog-width`, `--dialog-bg`, `--dialog-radius`, `--dialog-shadow`, `--dialog-backdrop-bg`, `--dialog-backdrop-blur`, etc.
