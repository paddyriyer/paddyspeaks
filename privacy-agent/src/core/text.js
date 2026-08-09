/**
 * Shared string primitives for the identity engine.
 *
 * Pure, dependency-free, no DOM and no Node built-ins — every other core
 * module builds on these, and the test runner imports them directly.
 */

/** Strip diacritics: "Ramírez" -> "Ramirez". NFD + combining-mark removal. */
export function deaccent(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Aggressive comparison form: lowercase, de-accented, punctuation collapsed to
 * single spaces. This is what equality checks run on — never what we display.
 */
export function norm(s) {
  return deaccent(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Comparison form with all separators removed: "de la cruz" -> "delacruz". */
export function squash(s) {
  return norm(s).replace(/ /g, '');
}

/** Title-case a token, preserving interior capitals in McX / O'X / hyphenates. */
export function titleCase(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Digits only. Used by every phone comparison. */
export function digits(s) {
  return String(s == null ? '' : s).replace(/\D+/g, '');
}

/** Unique, order-preserving, drops empty/nullish entries. */
export function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const v of list || []) {
    if (v == null) continue;
    const s = typeof v === 'string' ? v.trim() : v;
    if (s === '') continue;
    const k = typeof s === 'string' ? s.toLowerCase() : JSON.stringify(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * Damerau-Levenshtein distance, capped. The cap lets us bail out early on
 * obviously-different strings instead of filling a full matrix.
 */
export function editDistance(a, b, cap = 8) {
  a = String(a || '');
  b = String(b || '');
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
    cur = new Array(b.length + 1);
  }
  return prev[b.length];
}

/** 0..1 similarity derived from edit distance over the longer string. */
export function similarity(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x && !y) return 0;
  if (x === y) return 1;
  const longest = Math.max(x.length, y.length);
  const d = editDistance(x, y, Math.min(8, longest));
  if (d > longest) return 0;
  return Math.max(0, 1 - d / longest);
}

/** Clamp to [lo, hi]. */
export function clamp(n, lo = 0, hi = 1) {
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

/** Round to `p` decimal places without float noise ("0.7000000000001"). */
export function round(n, p = 3) {
  const f = 10 ** p;
  return Math.round((Number(n) || 0) * f) / f;
}

/**
 * FNV-1a 32-bit, hex. Not a security hash — used only for stable local ids and
 * dedupe fingerprints, where collisions are cheap and speed matters.
 */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Registrable-ish domain for grouping: "www.a.example.co.uk" -> "example.co.uk". */
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.jp', 'co.in', 'co.nz', 'co.za',
  'com.au', 'com.br', 'com.mx', 'com.sg', 'com.tr', 'net.au', 'org.au',
]);

export function registrableDomain(input) {
  let host = String(input == null ? '' : input).trim().toLowerCase();
  if (!host) return '';
  if (host.includes('://')) {
    try { host = new URL(host).hostname; } catch { /* fall through to raw parse */ }
  }
  host = host.replace(/^www\d?\./, '').replace(/[/:?#].*$/, '');

  // An IP literal has no registrable domain — returning its "last two labels"
  // would turn 127.0.0.1 into "0.1" and silently merge unrelated hosts under
  // one key in the graph, the dedupe groups and the workflow cache.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;

  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}
