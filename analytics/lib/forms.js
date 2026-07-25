/**
 * PaddySpeaks — Contact + Testimonials pure logic.
 *
 * No Worker/DOM/crypto dependencies here so it is unit-testable with plain
 * `node` (see analytics/tests/run.mjs). Validation and sanitization live here
 * and are shared verbatim by the client (imported as an ES module) and the
 * Worker (imported server-side) — same rules on both ends, no drift.
 */

export const LIMITS = {
  name:        { min: 1,  max: 120 },
  email:       { min: 5,  max: 200 },
  subject:     { min: 3,  max: 160 },
  message:     { min: 20, max: 4000 },
  role:        { min: 0,  max: 120 },
  organization:{ min: 0,  max: 120 },
  testimonial: { min: 60, max: 700 },
  url:         { min: 0,  max: 300 },
};

export const CONTACT_REASONS = [
  'article_feedback', 'interview_studio', 'technical_consulting',
  'collaboration', 'spiritual_cultural', 'website_issue', 'other',
];

export const RELATIONSHIPS = [
  'reader', 'studio_user', 'collaborator', 'attendee', 'community', 'other',
];

export const DISPLAY_PREFS = ['full', 'first_initial', 'anonymous'];

/** Collapse control chars / excess whitespace; trim. Never throws. */
export function cleanText(v) {
  return String(v == null ? '' : v)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars (keep tab/newline/cr)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/** HTML-escape for safe interpolation into email HTML and rendered testimonials. */
export function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Conservative email shape check (server still relies on delivery to confirm). */
export function isEmail(v) {
  const s = String(v || '').trim();
  if (s.length < LIMITS.email.min || s.length > LIMITS.email.max) return false;
  // single @, no spaces, a dot in the domain, no consecutive dots
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/\.\./.test(s);
}

/** Optional http(s) URL check. Empty is allowed. */
export function isOptionalUrl(v) {
  const s = String(v || '').trim();
  if (!s) return true;
  if (s.length > LIMITS.url.max) return false;
  return /^https?:\/\/[^\s.]+\.[^\s]+$/.test(s);
}

function lenOk(v, limit) {
  const n = [...String(v || '').trim()].length; // count code points, not UTF-16 units
  return n >= limit.min && n <= limit.max;
}
export function textLen(v) { return [...String(v || '').trim()].length; }

/**
 * Validate a contact submission. Returns { valid, errors:{field:msg}, data }.
 * `data` holds cleaned values (safe to store/email). Honeypot handled by caller.
 */
export function validateContact(raw) {
  const data = {
    name:    cleanText(raw.name),
    email:   String(raw.email || '').trim(),
    reason:  String(raw.reason || '').trim(),
    subject: cleanText(raw.subject),
    message: cleanText(raw.message),
    sendCopy: raw.sendCopy === true || raw.sendCopy === 'on' || raw.sendCopy === 1,
  };
  const errors = {};
  if (!lenOk(data.name, LIMITS.name)) errors.name = 'Please enter your name.';
  if (!isEmail(data.email)) errors.email = 'Please enter a valid email address.';
  if (!CONTACT_REASONS.includes(data.reason)) errors.reason = 'Please choose a reason.';
  if (!lenOk(data.subject, LIMITS.subject)) errors.subject = `Subject must be ${LIMITS.subject.min}–${LIMITS.subject.max} characters.`;
  if (!lenOk(data.message, LIMITS.message)) errors.message = `Message must be ${LIMITS.message.min}–${LIMITS.message.max} characters.`;
  return { valid: Object.keys(errors).length === 0, errors, data };
}

/**
 * Validate a testimonial submission. Returns { valid, errors, data }.
 */
export function validateTestimonial(raw) {
  const data = {
    name:         cleanText(raw.name),
    email:        String(raw.email || '').trim(),
    role:         cleanText(raw.role),
    organization: cleanText(raw.organization),
    relationship: String(raw.relationship || '').trim(),
    body:         cleanText(raw.body),
    verifyUrl:    String(raw.verifyUrl || '').trim(),
    displayPref:  String(raw.displayPref || '').trim(),
    consent:      raw.consent === true || raw.consent === 'on' || raw.consent === 1,
  };
  const errors = {};
  if (!lenOk(data.name, LIMITS.name)) errors.name = 'Please enter your name.';
  if (!isEmail(data.email)) errors.email = 'Please enter a valid email address.';
  if (data.role && !lenOk(data.role, LIMITS.role)) errors.role = 'Role is too long.';
  if (data.organization && !lenOk(data.organization, LIMITS.organization)) errors.organization = 'Organization is too long.';
  if (!RELATIONSHIPS.includes(data.relationship)) errors.relationship = 'Please choose your relationship to PaddySpeaks.';
  if (!lenOk(data.body, LIMITS.testimonial)) errors.body = `Testimonial must be ${LIMITS.testimonial.min}–${LIMITS.testimonial.max} characters.`;
  if (!isOptionalUrl(data.verifyUrl)) errors.verifyUrl = 'Please enter a valid http(s) URL, or leave it blank.';
  if (!DISPLAY_PREFS.includes(data.displayPref)) errors.displayPref = 'Please choose how your name should appear.';
  if (!data.consent) errors.consent = 'Consent is required to publish your testimonial.';
  return { valid: Object.keys(errors).length === 0, errors, data };
}

/**
 * Public display name honoring the contributor's preference. Never leaks more
 * than they allowed. `override` (owner-set) wins when present and non-empty.
 */
export function deriveDisplayName(fullName, displayPref, override) {
  if (override && String(override).trim()) return String(override).trim();
  const name = cleanText(fullName);
  if (displayPref === 'anonymous' || !name) return 'Anonymous';
  if (displayPref === 'first_initial') {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1] : '';
    return last ? `${first} ${last[0].toUpperCase()}.` : first;
  }
  return name; // 'full'
}

/**
 * Shape a stored testimonial row into the PUBLIC object. Strips email and any
 * detail the display preference does not permit. Pass edited_body-aware row.
 */
export function toPublicTestimonial(row) {
  const pref = row.display_pref;
  const showDetails = pref === 'full';
  return {
    id: row.id,
    name: deriveDisplayName(row.full_name, pref, row.display_name),
    role: showDetails ? (row.role || '') : '',
    organization: showDetails ? (row.organization || '') : '',
    relationship: row.relationship,
    body: row.edited_body && String(row.edited_body).trim() ? row.edited_body : row.body,
    featured: !!row.featured,
    date: (row.created_at || '').slice(0, 10),
  };
}
