/**
 * Pure parsers for what a page says back after a submission.
 *
 * Split out of execute.js so they carry no browser dependency: these are the
 * decisions that determine whether we tell the user "submitted", "verify your
 * email" or "needs you", and they deserve to be unit-tested directly rather
 * than behind a Playwright mock.
 */

/**
 * Did the site say the request went through, and what did it tell us?
 *
 * `confirmed` is deliberately strict. A page that merely stopped showing the
 * form is not a confirmation — the caller treats that as a weak result and
 * verifies by re-checking the listing instead, because "probably submitted" is
 * the kind of optimism that turns into a user believing they are removed when
 * they are not.
 */
export function parseConfirmation(text) {
  const t = String(text || '');
  const positives = [
    // The optional middle noun matters: sites write "your removal request has
    // been received" as often as "your request has been received", and a
    // pattern that only allows the short form silently misses half of them.
    /\byour (?:\w+\s+){0,2}?(?:request|removal|opt[- ]?out|submission) (?:has been|was|is) (?:received|submitted|accepted|processed|complete)\b/i,
    /\bwe (have )?received your (request|submission)\b/i,
    /\b(thank you|thanks)[^.]{0,40}\b(request|submission|opt[- ]?out)\b/i,
    /\b(request|removal) (id|number|reference|case)\b/i,
    /\byou(r| have) successfully (submitted|opted out|requested)\b/i,
    /\bsuccessfully (removed|submitted|processed)\b/i,
  ];
  const matched = positives.find((re) => re.test(t));

  const caseNumber = (t.match(
    /\b(?:case|request|reference|ticket|confirmation)\s*(?:#|no\.?|number|id)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{4,24})\b/i,
  ) || [])[1] || null;

  const expectedTimeframe = (t.match(
    /\b(?:within|takes?|up to|allow)\s+((?:\d{1,3}|a few|several)\s*(?:business\s+)?(?:hours?|days?|weeks?|months?))\b/i,
  ) || [])[1] || null;

  return {
    confirmed: Boolean(matched),
    caseNumber,
    expectedTimeframe,
    excerpt: matched ? (t.match(matched) || [])[0] : null,
  };
}

/**
 * Does the site want a verification step, and through which channel?
 *
 * The channel decides everything downstream: `email` can be completed
 * automatically with the user's permission, while `sms` and `mfa` must pause
 * and hand over the live browser (spec item 19). Getting this wrong in the
 * permissive direction would mean the agent sitting in a loop waiting for an
 * email that was never sent.
 */
export function parseVerificationNeed(text) {
  const t = String(text || '');

  if (/\b(text message|sms|code (sent )?to your phone|mobile (verification|code)|verify your phone)\b/i.test(t)) {
    return { needed: true, channel: 'sms', note: 'The site wants a code sent to your phone.' };
  }
  if (/\b(authenticator|two[- ]factor|2fa|mfa|multi[- ]factor)\b/i.test(t)) {
    return { needed: true, channel: 'mfa', note: 'The site wants a multi-factor confirmation.' };
  }
  if (/\b(check your (e-?mail|inbox)|verification (e-?mail|link) (has been )?sent|confirm your e-?mail|we('| ha)ve (sent|emailed) you)\b/i.test(t)) {
    return { needed: true, channel: 'email', note: 'The site has emailed a verification link or code.' };
  }
  if (/\b(enter the (verification |confirmation )?code)\b/i.test(t)) {
    return { needed: true, channel: 'email', note: 'The site is asking for a code it has sent.' };
  }
  return { needed: false };
}
