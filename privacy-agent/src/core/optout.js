/**
 * Finding the removal route (spec item 17: discover the method, do not assume
 * a URL shape).
 *
 * There is a tempting shortcut here — append `/opt-out` to the domain and hope.
 * It fails constantly: sites put the route at `/ccpa`, `/privacy-request`,
 * `/do-not-sell-my-info`, behind a support subdomain, on a third-party consent
 * platform, or nowhere at all. Guessing produces a confident 404, which is
 * worse than saying "I could not find it", because the user believes it.
 *
 * So the route is discovered from what the page itself publishes: its links.
 * Sites are legally obliged in several jurisdictions to link their opt-out from
 * every page, which makes the footer of a listing the single most reliable
 * place to look — far better than a search engine, which may never have indexed
 * the page at all.
 *
 * The scoring below is patterns of *language*, not a list of companies. Nothing
 * here knows the name of a single data broker, by design.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { registrableDomain } from './text.js';

/**
 * What kinds of route exist, best first.
 *
 * The order is the order to try them: a dedicated removal form beats a
 * do-not-sell form (which stops the resale but may leave the listing up),
 * which beats a general privacy request, which beats reading a policy to find
 * out where to write.
 */
export const ROUTE = {
  REMOVAL: 'removal',
  DO_NOT_SELL: 'do_not_sell',
  PRIVACY_REQUEST: 'privacy_request',
  PRIVACY_POLICY: 'privacy_policy',
  PRIVACY_CONTACT: 'privacy_contact',
};

const RANK = {
  [ROUTE.REMOVAL]: 100,
  [ROUTE.DO_NOT_SELL]: 84,
  [ROUTE.PRIVACY_REQUEST]: 72,
  [ROUTE.PRIVACY_CONTACT]: 46,
  [ROUTE.PRIVACY_POLICY]: 30,
};

const EXPLAIN = {
  [ROUTE.REMOVAL]: 'A dedicated removal or opt-out route — the fastest way out, and the one to try first.',
  [ROUTE.DO_NOT_SELL]: 'A "do not sell my information" route. It stops the resale, and on most sites the same form also delists you.',
  [ROUTE.PRIVACY_REQUEST]: 'A general privacy-rights request form. Ask for deletion explicitly; these forms often default to "access".',
  [ROUTE.PRIVACY_CONTACT]: 'A privacy contact address. Slower than a form, but it creates a written record you can point at later.',
  [ROUTE.PRIVACY_POLICY]: 'The privacy policy. It normally names the removal route in its last few paragraphs.',
};

/**
 * Language patterns, applied to the link text and to the URL path alike.
 * Ordered most specific first — `opt out` must be tested before `privacy`,
 * or every match collapses into the weakest category.
 */
const PATTERNS = [
  { route: ROUTE.REMOVAL, re: /\b(opt[\s._-]?out|optout)\b/ },
  { route: ROUTE.REMOVAL, re: /\b(remove|removal|delete|deletion|suppress(?:ion)?)\b[\s\S]{0,24}\b(me|my|your|info|information|record|data|listing|profile|name)\b/ },
  { route: ROUTE.REMOVAL, re: /\b(remove|delete)[\s._-]?(my|your)?[\s._-]?(info|information|data|listing|record)\b/ },
  { route: ROUTE.REMOVAL, re: /\bunlist\b|\bde[\s._-]?list\b/ },
  { route: ROUTE.DO_NOT_SELL, re: /\bdo[\s._-]?not[\s._-]?sell\b/ },
  { route: ROUTE.DO_NOT_SELL, re: /\bdnsmpi\b|\bdo[\s._-]?not[\s._-]?share\b/ },
  { route: ROUTE.PRIVACY_REQUEST, re: /\b(ccpa|cpra|gdpr|vcdpa|cpa|ctdpa|ucpa)\b/ },
  { route: ROUTE.PRIVACY_REQUEST, re: /\b(privacy|data|subject)[\s._-]?(request|rights|choices|portal|center|centre)\b/ },
  { route: ROUTE.PRIVACY_REQUEST, re: /\b(dsar|sar)\b/ },
  { route: ROUTE.PRIVACY_POLICY, re: /\bprivacy[\s._-]?(policy|notice|statement)\b/ },
  { route: ROUTE.PRIVACY_POLICY, re: /\bprivacy\b/ },
];

/**
 * Rank a page's links by how likely each is to be the removal route.
 *
 * @param links  [{ href, text }] as collected from the page
 * @param pageUrl the page they were collected from, for same-site scoring
 * @returns ranked candidates, best first
 */
export function findOptOutLinks(links = [], pageUrl = '') {
  const home = registrableDomain(pageUrl);
  const out = [];
  const seen = new Set();

  for (const link of links) {
    const href = String(link?.href || '').trim();
    if (!href) continue;

    const text = String(link?.text || '').trim();
    const isMail = /^mailto:/i.test(href);
    const hay = `${text} ${isMail ? href : pathAndQueryOf(href)}`.toLowerCase();

    let hit = PATTERNS.find((p) => p.re.test(hay));

    // A mailto: only counts when something about it says privacy — a support
    // address is not a removal route, and offering it as one wastes a week.
    if (isMail) {
      if (!hit || hit.route === ROUTE.PRIVACY_POLICY) {
        hit = /privacy|dpo|data[\s._-]?protection|compliance|legal/.test(hay)
          ? { route: ROUTE.PRIVACY_CONTACT } : null;
      } else {
        hit = { route: ROUTE.PRIVACY_CONTACT };
      }
    }
    if (!hit) continue;

    const key = isMail ? href.toLowerCase() : href.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Off-site routes are common and legitimate — plenty of brokers hand their
    // privacy requests to a consent platform — so they are ranked lower rather
    // than dropped. Confidence, not exclusion.
    const sameSite = isMail || !home || registrableDomain(href) === home;
    const score = RANK[hit.route] - (sameSite ? 0 : 14) + (text ? 4 : 0);

    out.push({
      url: href,
      text: text || href,
      route: hit.route,
      sameSite,
      score,
      why: EXPLAIN[hit.route],
    });
  }

  return out.sort((a, b) => b.score - a.score || a.url.length - b.url.length);
}

/** Path + query only. The hostname would match "privacy" in a brand name. */
function pathAndQueryOf(href) {
  try {
    const u = new URL(href);
    return `${u.pathname}${u.search}`;
  } catch {
    return String(href);
  }
}

/**
 * Fallback searches, for when the page cannot be read or publishes no route.
 *
 * Deliberately several small queries rather than one clever one. A single
 * `site:x.com opt out OR "do not sell" OR "remove my information"` looks
 * thorough and returns nothing on every engine that treats bare terms and
 * quoted OR groups differently — which is all of them. Each query here is
 * simple enough that any engine can answer it, and they are ordered so the
 * first one is the most likely to land.
 */
export function optOutSearches(domain) {
  const d = String(domain || '').trim();
  if (!d) return [];
  return [
    { text: `site:${d} "do not sell"`, why: 'The phrase US privacy law requires on the link itself.' },
    { text: `site:${d} opt-out`, why: 'The most common name for the removal page.' },
    { text: `site:${d} "remove my information"`, why: 'How these pages usually title themselves.' },
    { text: `site:${d} privacy policy`, why: 'The policy normally names the removal route even when the page is unindexed.' },
    { text: `${d} opt out remove my information`, why: 'Without site: — finds write-ups when the site itself is not indexed.' },
  ];
}
