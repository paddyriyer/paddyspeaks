/**
 * Form field classification.
 *
 * Given what the DOM tells us about an input — its label, name, id,
 * placeholder, autocomplete attribute and type — work out which identity
 * attribute belongs in it, so the user never types their address for the
 * thirtieth time (spec item 14).
 *
 * Signals are ranked by trustworthiness, and the order matters:
 *
 *   1. `autocomplete` — a standardised token the site author wrote on purpose.
 *      When present it is almost always right.
 *   2. The visible `<label>` — what a human reads to decide what goes in the box.
 *   3. `name` / `id` — usually meaningful, occasionally minified to nonsense.
 *   4. `placeholder` — helpful, but often an example value rather than a label.
 *
 * The **sensitive** classification is the important one. Any field asking for a
 * government ID, SSN, driver's licence, passport or payment instrument is
 * marked `sensitive: true`, and the executor is forbidden from filling it
 * without explicit per-request user approval (spec item 21). This is enforced
 * in `planFill` below rather than left to the caller to remember.
 *
 * Pure module — no DOM, no I/O. Unit-tested in tests/run.mjs.
 */

import { norm } from '../core/text.js';

/**
 * Field kinds. `source` is the path into the identity profile the executor
 * uses to find a value; `sensitive` gates auto-fill entirely.
 */
export const FIELD_KINDS = {
  full_name: { source: 'name.full', sensitive: false },
  first_name: { source: 'name.first', sensitive: false },
  middle_name: { source: 'name.middle', sensitive: false },
  last_name: { source: 'name.last', sensitive: false },
  email: { source: 'email.primary', sensitive: false },
  email_confirm: { source: 'email.primary', sensitive: false },
  phone: { source: 'phone.primary', sensitive: false },
  address_line1: { source: 'address.line1', sensitive: false },
  address_line2: { source: 'address.unit', sensitive: false },
  city: { source: 'address.city', sensitive: false },
  state: { source: 'address.state', sensitive: false },
  zip: { source: 'address.zip', sensitive: false },
  country: { source: 'address.country', sensitive: false },
  age: { source: 'age', sensitive: false },
  birth_year: { source: 'birthYear', sensitive: false },
  birth_date: { source: 'birthDate', sensitive: true },
  url: { source: 'record.url', sensitive: false },
  message: { source: 'request.message', sensitive: false },
  reason: { source: 'request.reason', sensitive: false },
  search_query: { source: 'name.full', sensitive: false },
  verification_code: { source: 'verification.code', sensitive: false },

  // Never auto-filled. Present so we can *recognise* and explain them.
  ssn: { source: null, sensitive: true },
  ssn_last4: { source: null, sensitive: true },
  drivers_license: { source: null, sensitive: true },
  passport: { source: null, sensitive: true },
  government_id: { source: null, sensitive: true },
  id_upload: { source: null, sensitive: true },
  payment_card: { source: null, sensitive: true },
  password: { source: null, sensitive: true },

  captcha: { source: null, sensitive: false },
  consent: { source: null, sensitive: false },
  unknown: { source: null, sensitive: false },
};

/**
 * Matchers, most specific first. Specificity matters a great deal here:
 * "email confirm" must be tested before "email", and "last 4 of SSN" before
 * both "ssn" and the generic numeric patterns.
 */
const MATCHERS = [
  // --- sensitive: checked first so nothing below can claim these fields ---
  { kind: 'ssn_last4', re: /\b(last ?4|last four).{0,12}(ssn|social)|ssn.{0,12}(last ?4|last four)\b/ },
  { kind: 'ssn', re: /\b(ssn|social security)\b/ },
  { kind: 'drivers_license', re: /\b(driver'?s? licen[cs]e|dl number|license number|licence no)\b/ },
  { kind: 'passport', re: /\bpassport\b/ },
  { kind: 'id_upload', re: /\b(upload|attach|photo of).{0,20}(id|identification|licen[cs]e|passport|document)|\b(id|identity) (document|verification) upload\b/ },
  { kind: 'government_id', re: /\b(government (issued )?id|photo id|state id|national id|identity document|id verification)\b/ },
  { kind: 'payment_card', re: /\b(card number|credit card|debit card|cvv|cvc|security code|expiry|expiration date|billing)\b/ },
  { kind: 'password', re: /\b(password|passphrase|pin)\b/ },
  { kind: 'birth_date', re: /\b(date of birth|birth ?date|dob|birthday)\b/ },

  // --- verification ---
  { kind: 'verification_code', re: /\b(verification code|confirmation code|security code|one[- ]?time (code|password)|otp|access code|pin code|enter the code)\b/ },
  { kind: 'captcha', re: /\b(captcha|recaptcha|hcaptcha|i'?m not a robot|human verification)\b/ },

  // --- name ---
  { kind: 'full_name', re: /\b(full name|your name|name on record|complete name|first and last)\b/ },
  { kind: 'first_name', re: /\b(first ?name|given ?name|forename|fname)\b/ },
  { kind: 'middle_name', re: /\b(middle ?(name|initial)|mname|mi)\b/ },
  { kind: 'last_name', re: /\b(last ?name|surname|family ?name|lname)\b/ },

  // --- contact ---
  { kind: 'email_confirm', re: /\b(confirm|verify|re-?enter|repeat).{0,12}e-?mail|e-?mail.{0,12}(confirm|again)\b/ },
  { kind: 'email', re: /\b(e-?mail|email address)\b/ },
  { kind: 'phone', re: /\b(phone|telephone|mobile|cell|contact number)\b/ },

  // --- address ---
  { kind: 'address_line2', re: /\b(address ?(line ?)?2|apt|apartment|suite|unit|floor)\b/ },
  { kind: 'address_line1', re: /\b(address ?(line ?)?1|street ?address|mailing address|home address|street)\b/ },
  { kind: 'city', re: /\b(city|town|locality|suburb)\b/ },
  { kind: 'state', re: /\b(state|province|region|county)\b/ },
  { kind: 'zip', re: /\b(zip|postal ?code|postcode)\b/ },
  { kind: 'country', re: /\b(country|nation)\b/ },

  // --- request context ---
  { kind: 'url', re: /\b(url|link|web ?address|profile link|listing (url|link)|page (url|address)|record url)\b/ },
  { kind: 'reason', re: /\b(reason|why|request type|nature of (the )?request|category)\b/ },
  { kind: 'message', re: /\b(message|comments?|details|description|additional info|tell us more|your request)\b/ },
  { kind: 'search_query', re: /\b(search|find|look ?up|query|who are you looking for)\b/ },

  { kind: 'age', re: /\bage\b/ },
  { kind: 'birth_year', re: /\b(year of birth|birth year)\b/ },
  { kind: 'consent', re: /\b(i (agree|confirm|certify|understand)|consent|terms|acknowledge|authorise|authorize|i am the person)\b/ },
];

/** `autocomplete` tokens map straight to kinds — no guessing needed. */
const AUTOCOMPLETE = {
  name: 'full_name', 'given-name': 'first_name', 'additional-name': 'middle_name',
  'family-name': 'last_name', email: 'email', tel: 'phone',
  'tel-national': 'phone', 'street-address': 'address_line1',
  'address-line1': 'address_line1', 'address-line2': 'address_line2',
  'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'zip',
  country: 'country', 'country-name': 'country', bday: 'birth_date',
  'bday-year': 'birth_year', 'cc-number': 'payment_card', 'cc-csc': 'payment_card',
  'cc-exp': 'payment_card', 'new-password': 'password', 'current-password': 'password',
  'one-time-code': 'verification_code', url: 'url', organization: 'unknown',
};

/**
 * Classify one field.
 *
 * @param field { label, name, id, placeholder, type, autocomplete, ariaLabel, tag, options[] }
 */
export function classifyField(field = {}) {
  const type = String(field.type || '').toLowerCase();

  // Input type carries hard information that overrides text heuristics.
  if (type === 'password') return decide('password', 1, 'input type=password');
  if (type === 'file') {
    const text = signalText(field);
    const looksLikeId = /\b(id|licen[cs]e|passport|document|photo)\b/.test(text);
    return decide(looksLikeId ? 'id_upload' : 'unknown', looksLikeId ? 0.9 : 0.3, 'file input');
  }

  const ac = norm(field.autocomplete || '').replace(/\s+/g, '-');
  if (ac && AUTOCOMPLETE[ac]) {
    return decide(AUTOCOMPLETE[ac], 0.98, `autocomplete="${ac}"`);
  }

  // Weighted signal text: the label is repeated so it outweighs a stray match
  // in a minified `name` attribute.
  const label = norm(field.label || field.ariaLabel || '');
  const nameId = norm(`${field.name || ''} ${field.id || ''}`);
  const placeholder = norm(field.placeholder || '');

  for (const m of MATCHERS) {
    if (label && m.re.test(label)) return decide(m.kind, 0.92, `label "${field.label || field.ariaLabel}"`);
  }
  for (const m of MATCHERS) {
    if (nameId && m.re.test(nameId)) return decide(m.kind, 0.8, `name/id "${field.name || field.id}"`);
  }
  for (const m of MATCHERS) {
    if (placeholder && m.re.test(placeholder)) return decide(m.kind, 0.7, `placeholder "${field.placeholder}"`);
  }

  if (type === 'email') return decide('email', 0.85, 'input type=email');
  if (type === 'tel') return decide('phone', 0.85, 'input type=tel');
  if (type === 'url') return decide('url', 0.8, 'input type=url');
  if (type === 'checkbox') return decide('consent', 0.4, 'unlabelled checkbox');

  return decide('unknown', 0.1, 'no recognisable signal');
}

function decide(kind, confidence, reason) {
  const spec = FIELD_KINDS[kind] || FIELD_KINDS.unknown;
  return {
    kind,
    confidence,
    reason,
    sensitive: spec.sensitive,
    source: spec.source,
  };
}

function signalText(field) {
  return norm([field.label, field.ariaLabel, field.name, field.id, field.placeholder].filter(Boolean).join(' '));
}

/**
 * Turn a set of classified fields plus the identity profile into a fill plan.
 *
 * Returns `fills` (safe to type), `blocked` (sensitive — needs explicit
 * approval, and never auto-filled), and `unfilled` (we have no value).
 *
 * The sensitive check happens *here*, not at the call site. Putting it in the
 * planner means every path that fills a form gets the guard, including future
 * ones written by someone who hasn't read spec item 21.
 */
export function planFill(fields, values, options = {}) {
  const approvedSensitive = new Set(options.approvedSensitiveKinds || []);
  const fills = [];
  const blocked = [];
  const unfilled = [];

  for (const field of fields) {
    const c = field.classification || classifyField(field);

    if (c.kind === 'captcha') {
      blocked.push({ field, classification: c, why: 'CAPTCHA — you will be asked to complete this yourself.' });
      continue;
    }

    if (c.sensitive) {
      // Explicit, per-kind, per-run approval only. There is no "approve all".
      if (!approvedSensitive.has(c.kind)) {
        blocked.push({
          field,
          classification: c,
          why: sensitiveExplanation(c.kind),
          requiresApproval: true,
        });
        continue;
      }
    }

    const value = resolveValue(c, values, field);
    if (value == null || value === '') {
      unfilled.push({ field, classification: c });
      continue;
    }
    fills.push({ field, classification: c, value, selector: field.selector });
  }

  return { fills, blocked, unfilled };
}

/** What we tell the user when a site asks for something sensitive. */
export function sensitiveExplanation(kind) {
  return {
    ssn: 'This site is asking for your full Social Security number. No legitimate opt-out needs it, and we will not send it. Consider whether to continue with this site at all.',
    ssn_last4: 'This site wants the last four digits of your SSN, usually to match you against a record. It is a real practice, but it is your call — we will not submit it without you saying so.',
    drivers_license: 'This site wants a driver’s licence number or image to verify identity before removing your record.',
    passport: 'This site wants passport details to verify your identity.',
    government_id: 'This site wants a government-issued ID to verify you are who you say you are.',
    id_upload: 'This site wants you to upload a photo of an identity document.',
    payment_card: 'This is a payment field. We never pay for removals — this site will be recorded as charging, and we will look for a free route instead.',
    password: 'This is a password field. The agent does not handle account credentials.',
    birth_date: 'This site wants your full date of birth. That is a strong identifier, so it needs your explicit go-ahead.',
  }[kind] || 'This field asks for sensitive personal information and needs your explicit approval.';
}

/**
 * Pull the right value out of the identity bundle for a classified field.
 * `values` is a flat object assembled by the executor from the profile plus
 * per-request context (the record URL, the message text, a verification code).
 */
function resolveValue(classification, values, field) {
  if (!classification.source) return null;
  const v = values || {};

  const direct = getPath(v, classification.source);
  if (direct != null && direct !== '') {
    // A <select> needs an option that actually exists, not a free-text value.
    if (field?.tag === 'select' && Array.isArray(field.options)) {
      return matchOption(String(direct), field.options);
    }
    return direct;
  }
  return null;
}

function getPath(obj, path) {
  return String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Match a value against a <select>'s options. Handles the state-name/abbrev
 * mismatch that breaks naive fillers ("California" vs "CA").
 */
export function matchOption(value, options) {
  const target = norm(value);
  if (!target) return null;

  const exact = options.find((o) => norm(o.value) === target || norm(o.label) === target);
  if (exact) return exact.value;

  const partial = options.find(
    (o) => norm(o.label).startsWith(target) || target.startsWith(norm(o.label)),
  );
  if (partial) return partial.value;

  const contains = options.find((o) => norm(o.label).includes(target) && target.length >= 3);
  return contains ? contains.value : null;
}
