/**
 * Log redaction (spec item 27).
 *
 * A privacy tool that writes the user's home address into a debug log has
 * defeated itself. Every log line, error message and captured page snippet
 * goes through here first.
 *
 * Two layers, because either alone leaks:
 *
 *   1. Known values — everything in the identity profile is replaced with a
 *      typed token. This catches the user's actual data.
 *   2. Pattern scrubbing — emails, phone numbers, SSNs, card numbers and
 *      postal addresses found in text we scraped. This catches *other people's*
 *      data that happened to be on a page we visited, which we have no business
 *      logging either.
 *
 * Redaction keeps a short suffix on phones and card numbers on purpose. A log
 * saying `«phone ···4821»` is still debuggable; one saying `«phone»` when three
 * numbers are in play is not.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { norm } from './text.js';
import { allSensitiveValues } from './identity.js';

const PATTERNS = [
  // Order matters: SSN before generic digit runs, email before URL fragments.
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: () => '«ssn»' },
  {
    name: 'card',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    replace: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 ? `«card ···${d.slice(-4)}»` : m;
    },
  },
  { name: 'email', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, replace: () => '«email»' },
  {
    name: 'phone',
    re: /(?:\+?1[ .-]?)?\(?\b\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g,
    replace: (m) => {
      const d = m.replace(/\D/g, '');
      return `«phone ···${d.slice(-4)}»`;
    },
  },
  {
    name: 'address',
    re: /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|circle|cir|place|pl|terrace|ter|parkway|pkwy|highway|hwy|way|trail|trl)\b\.?/gi,
    replace: () => '«address»',
  },
  { name: 'dob', re: /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, replace: () => '«date»' },
];

/**
 * Build a redactor bound to one profile.
 *
 * Returns a function that is safe to call on anything — strings, errors,
 * nested objects — and always returns the same shape it was given.
 */
export function createRedactor(profile, options = {}) {
  const keepPatterns = options.patterns !== false;

  // Longest first, so "123 Main Street, Springfield" is replaced whole rather
  // than leaving "…, Springfield" behind after the street part goes.
  const known = allSensitiveValues(profile)
    .filter((v) => v.value && String(v.value).length >= 4)
    .sort((a, b) => String(b.value).length - String(a.value).length);

  const tokens = known.map((v) => ({
    token: `«${tokenFor(v.kind)}»`,
    re: new RegExp(escapeRe(String(v.value)), 'gi'),
  }));

  function redactString(input) {
    let s = String(input);
    for (const t of tokens) s = s.replace(t.re, t.token);
    if (keepPatterns) {
      for (const p of PATTERNS) s = s.replace(p.re, p.replace);
    }
    return s;
  }

  function redact(value, depth = 0) {
    if (value == null) return value;
    if (depth > 6) return '«deep»';
    if (typeof value === 'string') return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Error) {
      const e = new Error(redactString(value.message));
      e.name = value.name;
      if (value.stack) e.stack = redactString(value.stack);
      return e;
    }
    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        // Never log a field whose *name* says it is a secret, whatever it holds.
        out[k] = SECRET_KEYS.has(norm(k).replace(/ /g, '_')) ? '«redacted»' : redact(v, depth + 1);
      }
      return out;
    }
    return value;
  }

  redact.string = redactString;
  return redact;
}

const SECRET_KEYS = new Set([
  'password', 'passphrase', 'secret', 'token', 'access_token', 'refresh_token',
  'api_key', 'apikey', 'authorization', 'auth', 'cookie', 'cookies', 'session',
  'ssn', 'social_security_number', 'card_number', 'cvv', 'pin', 'dob',
  'date_of_birth', 'drivers_license', 'passport', 'id_number',
]);

function tokenFor(kind) {
  return {
    names: 'name', emails: 'email', phones: 'phone',
    addresses: 'address', usernames: 'username', relatives: 'relative',
  }[kind] || 'pii';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A no-op redactor, for the pre-onboarding phase where there is no profile
 * yet. Still runs the pattern layer — the point is that we never log raw PII,
 * including PII belonging to someone we haven't met.
 */
export function patternOnlyRedactor() {
  return createRedactor(null, { patterns: true });
}
