# Forms

## Basic Field

```html
<div class="field">
  <label class="field__label" for="name">Full name</label>
  <input class="input" id="name" type="text" placeholder="Jane Doe" required />
  <p class="field__description">As it appears on your ID.</p>
</div>
```

## Sizes

```html
<input class="input input--sm" />
<input class="input" /> <!-- default = md -->
<input class="input input--lg" />
```

## Validation

**Client-side (native):**

```html
<input class="input" type="email" required />
<!-- browser applies :user-invalid -->
```

**Server-side / library:**

```html
<input class="input" aria-invalid="true" aria-describedby="email-error" />
<p class="field__error" id="email-error">This email is already registered.</p>
```

## Select & Textarea

```html
<select class="select">
  <option>Choose…</option>
</select>

<textarea class="textarea" rows="4"></textarea>
```

They share the same height / radius tokens as `.input` so they align in a row.

## Checkbox / Radio / Switch

```html
<label class="checkbox">
  <input type="checkbox" />
  <span>Remember me</span>
</label>

<label class="radio">
  <input type="radio" name="plan" />
  <span>Pro</span>
</label>

<label class="switch">
  <input type="checkbox" role="switch" />
  <span>Enable notifications</span>
</label>
```

## Form Layout Patterns

**Stacked (default):**

```html
<form class="space-y-4">
  <div class="field">…</div>
  <div class="field">…</div>
  <div class="flex gap-2 justify-end">
    <button type="button" class="button button--neutral">Cancel</button>
    <button type="submit" class="button button--primary">Save</button>
  </div>
</form>
```

**Two-column:**

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div class="field">…</div>
  <div class="field">…</div>
</div>
```

**Inside a card:**

```html
<div class="card">
  <div class="card__header">
    <h2 class="card__title">Profile</h2>
  </div>
  <div class="card__body">
    <form>…</form>
  </div>
  <div class="card__footer flex justify-end gap-2">
    <button class="button button--neutral">Cancel</button>
    <button class="button button--primary">Save changes</button>
  </div>
</div>
```

## Seamless / Plain Text

```html
<input class="input input--seamless" readonly value="Read-only value" />
```
