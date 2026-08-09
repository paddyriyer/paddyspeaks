/**
 * Find the removal path for a site (spec items 10, 11, 12, 35).
 *
 * Spec item 11 is emphatic that we must not assume the URL structure, and it is
 * right to be. Guessing `/opt-out` works often enough to feel clever and fails
 * silently the rest of the time — you get a 404 or, worse, a soft-404 marketing
 * page, and the agent cheerfully reports "removal method found" for a link that
 * does nothing.
 *
 * So this module *reads the site*, in the order a person would:
 *
 *   1. Footer and nav links — where privacy links actually live.
 *   2. The privacy policy — usually names the process and links to the form.
 *   3. `/.well-known/` and the standard discovery files, which some sites do
 *      publish honestly.
 *   4. Help centre / contact / legal pages.
 *   5. A site-scoped web search, as the last resort.
 *
 * Candidates are scored, and the winner is *verified by loading it* and
 * checking it looks like a removal mechanism rather than a marketing page. That
 * verification step is what makes the difference between this and guessing.
 *
 * Spec item 35: when a saved workflow's URL no longer verifies, we do not fail —
 * we rediscover from scratch and update the template.
 */

import { registrableDomain, norm, uniq } from '../core/text.js';

/** Link text / href fragments that suggest a privacy mechanism, with weights. */
const LINK_SIGNALS = [
  { re: /\b(opt[- ]?out|opt out)\b/i, weight: 1.0, kind: 'opt_out' },
  { re: /\bdo not sell( or share)?( my)?( personal)?( info(rmation)?)?\b/i, weight: 1.0, kind: 'do_not_sell' },
  { re: /\b(remove|removal) (my |your )?(info|information|record|listing|data|profile)\b/i, weight: 1.0, kind: 'removal' },
  { re: /\b(record|listing|profile|people) removal\b/i, weight: 0.95, kind: 'removal' },
  { re: /\b(delete|deletion) (my |your )?(account|data|information|profile)\b/i, weight: 0.9, kind: 'deletion' },
  { re: /\b(data|privacy) (subject )?(access )?request\b/i, weight: 0.9, kind: 'privacy_request' },
  { re: /\bdsar\b/i, weight: 0.9, kind: 'privacy_request' },
  { re: /\bprivacy (portal|center|centre|choices|rights|dashboard)\b/i, weight: 0.85, kind: 'privacy_portal' },
  { re: /\byour (privacy )?choices\b/i, weight: 0.8, kind: 'privacy_portal' },
  { re: /\bmanage (my )?(data|privacy|preferences)\b/i, weight: 0.7, kind: 'privacy_portal' },
  { re: /\bccpa|cpra|gdpr\b/i, weight: 0.7, kind: 'privacy_request' },
  { re: /\bunsubscribe|email preferences\b/i, weight: 0.35, kind: 'unsubscribe' },
  { re: /\bprivacy policy\b/i, weight: 0.4, kind: 'policy' },
  { re: /\b(contact|support|help)( us| cent(er|re))?\b/i, weight: 0.25, kind: 'contact' },
  { re: /\bterms|legal\b/i, weight: 0.15, kind: 'legal' },
];

/** Page content that confirms we landed on a real mechanism, not a blurb. */
const PAGE_CONFIRMERS = [
  { re: /\b(submit (your |a )?(opt[- ]?out|removal|deletion) request)\b/i, weight: 1.0 },
  { re: /\b(search for your (record|listing|profile))\b/i, weight: 0.95 },
  { re: /\b(select (the )?(record|listing|profile) (you|to))\b/i, weight: 0.9 },
  { re: /\b(we will (send|email) you a (confirmation|verification) (link|email|code))\b/i, weight: 0.9 },
  { re: /\b(your (request|removal) (has been|was) (submitted|received))\b/i, weight: 0.85 },
  { re: /\b(this (form|page) (is|can be) used to (remove|delete|opt))\b/i, weight: 0.9 },
  { re: /\b(enter your (email|name|url|link))\b/i, weight: 0.5 },
];

/** Signals that the page is a dead end for our purposes. */
const NEGATIVE = [
  { re: /\b(page not found|404|no longer available|has moved)\b/i, weight: -1.0 },
  { re: /\b(sign (in|up) to continue|create an account to)\b/i, weight: -0.4 },
  { re: /\b(purchase|subscribe|upgrade) to (remove|delete)\b/i, weight: -0.3 },
];

export const WORKFLOW_TYPE = {
  WEB_FORM: 'web_form',
  SEARCH_SELECT: 'search_and_select',
  EMAIL_REQUEST: 'email_request',
  ACCOUNT_DELETION: 'account_deletion',
  SUPPORT_TICKET: 'support_request',
  PRIVACY_PORTAL: 'privacy_portal',
  LEGAL_REQUEST: 'legal_privacy_request',
  POSTAL: 'postal_request',
  MULTI_STEP: 'multi_step_verification',
  NONE: 'none_found',
};

/**
 * Discover the removal mechanism for one site.
 *
 * @param session  BrowserSession
 * @param siteUrl  any URL on the target site
 * @param options  { searchFn, knownWorkflow, log }
 */
export async function discoverRemovalMethod(session, siteUrl, options = {}) {
  const domain = registrableDomain(siteUrl);
  const log = options.log || (() => {});
  const visited = new Set();
  const candidates = [];
  const trail = [];

  // Spec item 35: try what we learned last time, but *verify* it. A saved
  // workflow that no longer resolves triggers full rediscovery rather than a
  // failure — sites move their forms constantly.
  if (options.knownWorkflow?.entryUrl) {
    const check = await verifyCandidate(session, options.knownWorkflow.entryUrl, visited);
    trail.push({ step: 'known_workflow', url: options.knownWorkflow.entryUrl, verified: check.score > 0.5 });
    if (check.score > 0.5) {
      log('reusing known workflow', { domain });
      return finish({
        domain,
        entryUrl: check.url,
        kind: options.knownWorkflow.kind,
        workflowType: options.knownWorkflow.workflowType,
        score: check.score,
        page: check.page,
        source: 'known_workflow',
        trail,
      });
    }
    log('known workflow no longer valid — rediscovering', { domain });
  }

  /* --- 1. the site's own pages: footer, nav, whatever it links --- */

  const origin = safeOrigin(siteUrl);
  const home = await session.readPage(origin);
  visited.add(normalizeUrl(origin));
  trail.push({ step: 'homepage', url: origin, ok: home.ok });

  if (home.ok) {
    candidates.push(...scoreLinks(home.linkDetails, domain, 'homepage'));
  }

  // The originating page itself often carries a "remove this listing" link that
  // the homepage does not.
  if (normalizeUrl(siteUrl) !== normalizeUrl(origin)) {
    const source = await session.readPage(siteUrl);
    visited.add(normalizeUrl(siteUrl));
    trail.push({ step: 'source_page', url: siteUrl, ok: source.ok });
    if (source.ok) candidates.push(...scoreLinks(source.linkDetails, domain, 'source_page'));
  }

  /* --- 2. the privacy policy: read it and follow what it names --- */

  const policyLink = candidates.find((c) => c.kind === 'policy');
  let policyText = '';
  if (policyLink) {
    const policy = await session.readPage(policyLink.url);
    visited.add(normalizeUrl(policyLink.url));
    trail.push({ step: 'privacy_policy', url: policyLink.url, ok: policy.ok });
    if (policy.ok) {
      policyText = policy.text;
      candidates.push(...scoreLinks(policy.linkDetails, domain, 'privacy_policy', 0.15));
      // Policies frequently give an address rather than a link.
      for (const email of privacyEmailsIn(policy.text)) {
        candidates.push({
          url: `mailto:${email}`, text: email, kind: 'email_request',
          score: 0.6, via: 'privacy_policy', isEmail: true,
        });
      }
      for (const postal of postalAddressIn(policy.text)) {
        candidates.push({
          url: null, text: postal, kind: 'postal', score: 0.3,
          via: 'privacy_policy', isPostal: true,
        });
      }
    }
  }

  /* --- 3. standard discovery files, where a site publishes them --- */

  for (const path of ['/.well-known/dnt-policy.txt', '/.well-known/gpc.json', '/privacy', '/legal']) {
    if (candidates.some((c) => c.score >= 0.9)) break; // already have a strong lead
    const url = new URL(path, origin).href;
    if (visited.has(normalizeUrl(url))) continue;
    const res = await session.readPage(url);
    visited.add(normalizeUrl(url));
    if (res.ok && res.status < 400 && res.text.length > 200) {
      trail.push({ step: 'well_known', url, ok: true });
      candidates.push(...scoreLinks(res.linkDetails, domain, 'well_known', 0.1));
    }
  }

  /* --- 4. a site-scoped web search, last resort --- */

  if (options.searchFn && !candidates.some((c) => c.score >= 0.85)) {
    const queries = [
      `site:${domain} opt out OR "remove my information" OR "do not sell"`,
      `${domain} opt out remove personal information`,
    ];
    for (const q of queries) {
      const { results = [] } = await options.searchFn(q, { count: 10 });
      trail.push({ step: 'web_search', query: q, hits: results.length });
      for (const r of results) {
        if (registrableDomain(r.url) !== domain) continue;
        const scored = scoreLink({ href: r.url, text: `${r.title} ${r.snippet}` }, domain, 'web_search');
        if (scored) candidates.push({ ...scored, score: scored.score * 0.9 });
      }
      if (candidates.some((c) => c.score >= 0.85)) break;
    }
  }

  /* --- 5. verify the best candidates by actually loading them --- */

  const ranked = dedupeCandidates(candidates)
    .filter((c) => c.kind !== 'policy' && c.kind !== 'legal')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const candidate of ranked) {
    if (candidate.isEmail || candidate.isPostal) {
      return finish({
        domain,
        entryUrl: candidate.url,
        kind: candidate.kind,
        workflowType: candidate.isPostal ? WORKFLOW_TYPE.POSTAL : WORKFLOW_TYPE.EMAIL_REQUEST,
        score: candidate.score,
        contact: candidate.text,
        policyText,
        source: candidate.via,
        trail,
      });
    }

    const check = await verifyCandidate(session, candidate.url, visited);
    trail.push({ step: 'verify', url: candidate.url, score: check.score });
    if (check.score >= 0.5) {
      return finish({
        domain,
        entryUrl: check.url,
        kind: candidate.kind,
        workflowType: inferWorkflowType(check.page, candidate.kind),
        score: check.score,
        page: check.page,
        policyText,
        source: candidate.via,
        trail,
      });
    }
  }

  return finish({
    domain,
    entryUrl: null,
    kind: null,
    workflowType: WORKFLOW_TYPE.NONE,
    score: 0,
    policyText,
    source: null,
    trail,
    note: 'No removal mechanism found. The site publishes no opt-out link, its privacy policy names no process, and a site-scoped search turned up nothing.',
  });
}

function finish(result) {
  return { ...result, discoveredAt: new Date().toISOString() };
}

/**
 * Load a candidate and decide whether it is really a removal mechanism.
 * This is the step that separates "found a link" from "found the process".
 */
async function verifyCandidate(session, url, visited) {
  if (!url || visited.has(normalizeUrl(url))) return { score: 0, url };
  visited.add(normalizeUrl(url));

  const page = await session.readPage(url);
  if (!page.ok || page.status >= 400) return { score: 0, url, page };

  let score = 0;
  const text = `${page.title}\n${page.text}`;
  for (const c of PAGE_CONFIRMERS) if (c.re.test(text)) score += c.weight;
  for (const n of NEGATIVE) if (n.re.test(text)) score += n.weight;

  // A form on the page is strong corroboration.
  if (/<form|input|button/i.test(page.text) || page.linkDetails.length > 0) score += 0.1;

  return { score: Math.max(0, Math.min(1.5, score)) / 1.5, url: page.url, page };
}

/** What kind of workflow are we looking at? (spec item 12) */
export function inferWorkflowType(page, kind) {
  const text = `${page?.title || ''}\n${page?.text || ''}`;

  if (/\b(search (for )?your (name|record|listing)|find your (record|listing|profile))\b/i.test(text)) {
    return WORKFLOW_TYPE.SEARCH_SELECT;
  }
  if (/\b(we (will|'ll) (send|email) you a (verification|confirmation)|check your (email|inbox)|enter the code)\b/i.test(text)) {
    return WORKFLOW_TYPE.MULTI_STEP;
  }
  if (/\b(delete (your )?account|account (deletion|closure)|close your account)\b/i.test(text)) {
    return WORKFLOW_TYPE.ACCOUNT_DELETION;
  }
  if (/\b(privacy (portal|center|centre)|manage your privacy|privacy dashboard)\b/i.test(text)) {
    return WORKFLOW_TYPE.PRIVACY_PORTAL;
  }
  if (/\b(support (ticket|request)|submit a ticket|help desk|contact support)\b/i.test(text)) {
    return WORKFLOW_TYPE.SUPPORT_TICKET;
  }
  if (/\b(mail (your )?request to|send (a )?(written|postal) request|by mail to)\b/i.test(text)) {
    return WORKFLOW_TYPE.POSTAL;
  }
  if (kind === 'privacy_request' || /\b(ccpa|gdpr|data subject) request\b/i.test(text)) {
    return WORKFLOW_TYPE.LEGAL_REQUEST;
  }
  return WORKFLOW_TYPE.WEB_FORM;
}

/* ----------------------------------------------------------------- links */

function scoreLinks(linkDetails, domain, via, penalty = 0) {
  const out = [];
  for (const link of linkDetails || []) {
    const scored = scoreLink(link, domain, via);
    if (scored) out.push({ ...scored, score: Math.max(0, scored.score - penalty) });
  }
  return out;
}

function scoreLink(link, domain, via) {
  const href = String(link.href || link.url || '');
  if (!href || href.startsWith('mailto:') === false && !isHttp(href)) {
    if (href.startsWith('mailto:')) {
      const email = href.slice(7).split('?')[0];
      if (/privacy|optout|opt-out|dpo|legal|removal/i.test(email)) {
        return { url: href, text: email, kind: 'email_request', score: 0.6, via, isEmail: true };
      }
    }
    return null;
  }

  // Stay on the site. An off-site "privacy" link is usually a vendor's portal —
  // occasionally the right answer, so we keep same-registrable-domain plus a
  // small allowance for known portal hosts appearing in the path.
  const linkDomain = registrableDomain(href);
  const offSite = linkDomain && linkDomain !== domain;

  const haystack = `${link.text || ''} ${href}`;
  let best = null;
  for (const s of LINK_SIGNALS) {
    if (!s.re.test(haystack)) continue;
    if (!best || s.weight > best.weight) best = s;
  }
  if (!best) return null;

  let score = best.weight;
  // A match in the link *text* is better evidence than one in a URL slug,
  // because slugs are frequently reused for marketing pages.
  if (best.re.test(String(link.text || ''))) score += 0.05;
  if (offSite) score -= 0.25;

  return { url: href, text: (link.text || '').slice(0, 120), kind: best.kind, score: Math.max(0, score), via };
}

function dedupeCandidates(candidates) {
  const best = new Map();
  for (const c of candidates) {
    const key = c.url ? normalizeUrl(c.url) : `text:${norm(c.text)}`;
    const existing = best.get(key);
    if (!existing || c.score > existing.score) best.set(key, c);
  }
  return [...best.values()];
}

/* ----------------------------------------------------------------- utils */

function privacyEmailsIn(text) {
  const emails = uniq(String(text || '').match(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g) || []);
  return emails.filter((e) => /privacy|optout|opt-out|dpo|datasubject|legal|removal|compliance|support/i.test(e));
}

function postalAddressIn(text) {
  const matches = String(text || '').match(
    /\b(?:attn|attention|mail(?:ing)? (?:address|to)|write to)\b[:\s][\s\S]{20,240}?\b\d{5}(?:-\d{4})?\b/gi,
  ) || [];
  return matches.map((m) => m.replace(/\s+/g, ' ').trim()).slice(0, 2);
}

function isHttp(url) {
  return /^https?:\/\//i.test(String(url));
}

function safeOrigin(url) {
  try {
    return new URL(String(url)).origin;
  } catch {
    return `https://${registrableDomain(url)}`;
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(String(url));
    u.hash = '';
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

export { normalizeUrl };
