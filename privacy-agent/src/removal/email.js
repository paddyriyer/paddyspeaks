/**
 * Confirmation email handling (spec items 16, 17, 18).
 *
 * Most removal workflows end with "check your email". Making the user go and
 * find that message, open it, click the link and come back is exactly the chore
 * this tool exists to eliminate — so when a mail connector is available and the
 * user has granted access, the agent does it.
 *
 * The hard part is spec item 17: **subject lines and sender names vary wildly.**
 * A confirmation from a broker might arrive as "Verify your request",
 * "[Ticket 88213] Received", "Action required", or just "Confirm". Searching for
 * a fixed subject finds nothing. So matching is scored across several weak
 * signals — sender domain, company name, keywords, recency, and proximity to the
 * moment we submitted — and the *domain* signal is weighted highest because it
 * is the one thing a confirmation almost always gets right.
 *
 * Consent: nothing here runs unless the user explicitly connected a mailbox and
 * approved email access for this run. The agent reads only messages that score
 * as plausible confirmations, and it never sends mail from the account.
 */

import { registrableDomain, norm, clamp, round } from '../core/text.js';
import { parseConfirmation } from './parse.js';

/** Keyword groups, weighted. Spec item 17 names most of these explicitly. */
const KEYWORDS = [
  { weight: 0.30, words: ['verify', 'verification', 'confirm', 'confirmation'] },
  { weight: 0.25, words: ['opt out', 'opt-out', 'optout', 'do not sell', 'suppression'] },
  { weight: 0.25, words: ['remove', 'removal', 'delete', 'deletion', 'erase'] },
  { weight: 0.20, words: ['privacy', 'personal information', 'data request', 'dsar'] },
  { weight: 0.15, words: ['request', 'case', 'ticket', 'reference'] },
  { weight: 0.10, words: ['action required', 'complete your', 'one more step'] },
];

/**
 * Score one message as "is this the confirmation we are waiting for".
 *
 * @param message { from, subject, snippet, receivedAt, body }
 * @param context { domain, companyName, submittedAt }
 */
export function scoreConfirmationEmail(message, context = {}) {
  const from = String(message?.from || '');
  const subject = String(message?.subject || '');
  const body = String(message?.body || message?.snippet || '');
  const haystack = norm(`${subject} ${body}`);

  let score = 0;
  const reasons = [];

  /* --- sender domain: the strongest single signal --- */
  const fromDomain = registrableDomain(from.match(/@([^\s>]+)/)?.[1] || '');
  const targetDomain = registrableDomain(context.domain || '');
  if (fromDomain && targetDomain) {
    if (fromDomain === targetDomain) {
      score += 0.5;
      reasons.push(`sent from ${fromDomain}`);
    } else if (fromDomain.includes(targetDomain.split('.')[0]) || targetDomain.includes(fromDomain.split('.')[0])) {
      // Brokers frequently send from a sibling domain or an ESP subdomain.
      score += 0.3;
      reasons.push(`sent from ${fromDomain}, related to ${targetDomain}`);
    }
  }

  /* --- company name anywhere in the message --- */
  const company = norm(context.companyName || targetDomain.split('.')[0] || '');
  if (company && company.length >= 3 && haystack.includes(company)) {
    score += 0.2;
    reasons.push(`mentions ${context.companyName || company}`);
  }

  /* --- keyword groups --- */
  for (const group of KEYWORDS) {
    if (group.words.some((w) => haystack.includes(w))) {
      score += group.weight;
      reasons.push(`mentions "${group.words.find((w) => haystack.includes(w))}"`);
    }
  }

  /* --- timing: a confirmation arrives within minutes of submitting --- */
  if (context.submittedAt && message?.receivedAt) {
    const delta = Date.parse(message.receivedAt) - Date.parse(context.submittedAt);
    if (delta < -60_000) {
      // A hard veto, not a penalty. A message that arrived before we submitted
      // cannot be the confirmation of that submission, however perfectly its
      // wording matches — and an older thread from the same sender is exactly
      // the kind of near-miss that scores well on every other signal.
      return {
        score: 0,
        reasons: ['arrived before the request was submitted, so it cannot be its confirmation'],
        likely: false,
      };
    }
    if (delta <= 30 * 60_000) {
      score += 0.25;
      reasons.push('arrived right after we submitted');
    } else if (delta <= 48 * 3600_000) {
      score += 0.1;
    }
  }

  /* --- negative signals: marketing that also says "privacy" --- */
  if (/\b(unsubscribe from our newsletter|special offer|% off|sale ends|webinar|invoice)\b/i.test(`${subject} ${body}`)) {
    score -= 0.35;
    reasons.push('reads like marketing');
  }

  return {
    score: round(clamp(score), 3),
    reasons,
    likely: score >= 0.6,
  };
}

/** Pull the actionable bit out of a confirmation email. */
export function extractVerification(message, context = {}) {
  const body = `${message?.subject || ''}\n${message?.body || message?.snippet || ''}`;
  const targetDomain = registrableDomain(context.domain || '');

  /* --- a numeric/alphanumeric code (spec item 18) --- */
  //
  // Every candidate must contain a digit. Without that check the
  // case-insensitive character class happily matches the next ordinary word
  // ("Your", "code", "here") and we end up typing a word into a code box.
  // The gap is a short, lazy any-character run rather than a "non-alphanumeric"
  // class: real emails write "your code is 483921" and put the code on its own
  // line just as often, and a punctuation-only gap matches neither.
  const code = [
    ...body.matchAll(/\b(?:code|pin|otp)\b[\s\S]{0,24}?\b([A-Za-z0-9]{4,10})\b/gi),
    ...body.matchAll(/\b(\d{4,8})\b(?=[^\n]{0,40}\b(?:code|verification|confirm)\b)/gi),
  ]
    .map((m) => m[1])
    .find((c) => /\d/.test(c)) || null;

  /* --- a verification link --- */
  const urls = [...body.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((m) => m[0].replace(/[.,;]$/, ''));
  const scoredLinks = urls.map((url) => {
    let s = 0;
    if (/\b(verify|confirm|validation|activate|optout|opt-out|removal|unsubscribe-confirm)\b/i.test(url)) s += 1;
    if (targetDomain && registrableDomain(url) === targetDomain) s += 0.8;
    // Tracking wrappers and social links are noise.
    if (/\b(facebook|twitter|linkedin|instagram|youtube)\.com/i.test(url)) s -= 1;
    if (/\b(unsubscribe|preferences)\b/i.test(url) && !/confirm/i.test(url)) s -= 0.5;
    return { url, score: s };
  }).sort((a, b) => b.score - a.score);

  const link = scoredLinks[0]?.score > 0.5 ? scoredLinks[0].url : null;

  const caseNumber = (body.match(
    /\b(?:case|request|reference|ticket|confirmation)\s*(?:#|no\.?|number|id)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{4,24})\b/i,
  ) || [])[1] || null;

  const timeframe = (body.match(
    /\b(?:within|takes?|up to|allow)\s+((?:\d{1,3}|a few|several)\s*(?:business\s+)?(?:hours?|days?|weeks?|months?))\b/i,
  ) || [])[1] || null;

  return { code, link, caseNumber, expectedTimeframe: timeframe, allLinks: scoredLinks.slice(0, 5) };
}

/**
 * Build the search queries to hand a mail connector.
 *
 * Several deliberately-broad queries beat one precise query here, because we do
 * not know which of the signals the sender used. The caller runs them in order
 * and stops once `scoreConfirmationEmail` finds something convincing.
 */
export function buildMailQueries(context = {}) {
  const domain = registrableDomain(context.domain || '');
  const company = context.companyName || (domain ? domain.split('.')[0] : '');
  const since = context.submittedAt
    ? new Date(Date.parse(context.submittedAt) - 3600_000).toISOString().slice(0, 10)
    : undefined;

  const queries = [];
  if (domain) {
    queries.push({ q: `from:${domain}`, why: 'anything from the site itself' });
    queries.push({ q: `"${domain}"`, why: 'the domain mentioned anywhere' });
  }
  if (company && company.length >= 3) {
    queries.push({ q: `"${company}" (verify OR confirm OR removal OR "opt out")`, why: 'company name plus an action word' });
  }
  queries.push({
    q: '(verify OR confirm OR verification) (removal OR "opt out" OR delete OR privacy OR request)',
    why: 'generic confirmation language',
  });
  queries.push({ q: 'subject:(action required OR confirm your request)', why: 'common confirmation subjects' });

  return queries.map((query) => ({ ...query, after: since }));
}

/**
 * A mail provider interface.
 *
 * Deliberately minimal so any backend can satisfy it — a Gmail API token, an
 * IMAP bridge, an MCP connector, or a manual "paste the email" shim. The agent
 * never holds mailbox credentials itself; it is handed something that can
 * already read.
 */
export class MailConnector {
  constructor({ search, getMessage, label = 'mail' } = {}) {
    this._search = search;
    this._getMessage = getMessage;
    this.label = label;
  }

  get available() {
    return typeof this._search === 'function';
  }

  /**
   * Find the confirmation for one submitted request.
   *
   * Returns the best-scoring message above the threshold, or null. Never
   * returns "the most recent email" as a fallback — a wrong match here means
   * clicking a link in an unrelated message.
   */
  async findConfirmation(context, options = {}) {
    if (!this.available) return null;
    const threshold = options.threshold ?? 0.6;
    const queries = buildMailQueries(context);
    const seen = new Set();
    let best = null;

    for (const query of queries) {
      let messages = [];
      try {
        messages = await this._search(query.q, { after: query.after, limit: options.limit ?? 20 });
      } catch {
        continue;
      }

      for (const message of messages || []) {
        const id = message.id || `${message.from}|${message.subject}|${message.receivedAt}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const scored = scoreConfirmationEmail(message, context);
        if (!best || scored.score > best.scored.score) best = { message, scored, viaQuery: query.q };
      }

      if (best && best.scored.score >= 0.85) break; // convincing enough, stop searching
    }

    if (!best || best.scored.score < threshold) return null;

    // Fetch the full body if the search only gave us a snippet.
    if (this._getMessage && best.message.id && !best.message.body) {
      try {
        best.message = { ...best.message, ...(await this._getMessage(best.message.id)) };
      } catch { /* snippet will have to do */ }
    }

    return {
      message: best.message,
      confidence: best.scored.score,
      why: best.scored.reasons,
      verification: extractVerification(best.message, context),
    };
  }
}

/**
 * Complete an email verification by opening the link in the agent's browser
 * (spec item 16) — same session, so any cookie the workflow set still applies.
 */
export async function followVerificationLink(session, link, options = {}) {
  if (!link) return { ok: false, reason: 'no verification link in the email' };

  const page = await session.newPage();
  try {
    await page.goto(link, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const text = await page.innerText('body').catch(() => '');
    const confirmation = parseConfirmation(text);

    let screenshot = null;
    if (options.vault && options.exposureId) {
      const bytes = await session.screenshotBuffer(page);
      if (bytes) screenshot = options.vault.saveEvidence(bytes, options.exposureId, 'email-verified');
    }

    return {
      ok: true,
      confirmed: confirmation.confirmed,
      caseNumber: confirmation.caseNumber,
      expectedTimeframe: confirmation.expectedTimeframe,
      finalUrl: page.url(),
      screenshot,
      excerpt: text.slice(0, 400),
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    await page.close().catch(() => {});
  }
}
