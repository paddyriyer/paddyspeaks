/**
 * Tiny rendering + event-delegation helpers.
 *
 * The prototype is deliberately dependency-free: no build step, no CDN at
 * runtime. Components are plain functions that return HTML strings, and all
 * interaction is expressed declaratively through `data-action` attributes that
 * a single delegated listener in app.js dispatches.
 */

/** Escape untrusted-ish text before it enters an HTML string. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tagged template that escapes interpolated values by default.
 * Arrays are joined so `html`...${list.map(html`...`)}...`` works.
 * Values already produced by `html` (or wrapped in `raw`) pass through.
 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) out += flatten(values[i]);
  });
  return mark(out);
}

/** Mark a string as pre-escaped markup. */
export function raw(value) {
  return mark(String(value ?? ''));
}

const SAFE = new WeakSet();

function mark(str) {
  // Strings are primitives, so track safety through a boxed String object that
  // still concatenates and interpolates like a plain string.
  const boxed = new String(str);
  SAFE.add(boxed);
  return boxed;
}

function flatten(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (value instanceof String && SAFE.has(value)) return String(value);
  return esc(value);
}

/** Conditional class list: cx('card', isActive && 'is-active'). */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Build a data-action attribute payload. */
export function action(name, payload = {}) {
  const attrs = [`data-action="${esc(name)}"`];
  for (const [key, val] of Object.entries(payload)) {
    if (val === undefined || val === null) continue;
    attrs.push(`data-${esc(key)}="${esc(val)}"`);
  }
  return raw(attrs.join(' '));
}

/** Format a plural noun without a leading count. */
export function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm || `${singular}s`;
}
