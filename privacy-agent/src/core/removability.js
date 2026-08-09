/**
 * Can this actually be removed? (spec item 39)
 *
 * The most damaging thing a privacy tool can do is promise deletion it cannot
 * deliver. A court docket, a newspaper article, a company's own staff page and
 * a broker's resold dossier all "contain your personal information", and they
 * are not remotely the same problem. Filing a deletion demand against a news
 * archive wastes the user's time, annoys a publisher that has no obligation to
 * comply, and — worst of all — leaves the user believing something is being
 * handled when it never will be.
 *
 * So every exposure gets classified before any removal is attempted, and the
 * classes that cannot be deleted are reported honestly, with the option that
 * *does* exist named instead (de-indexing, correction, a court-sealing
 * process, or simply "this one is yours to edit").
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { registrableDomain } from './text.js';

export const CATEGORY = {
  BROKER: 'data_broker',
  DIRECTORY: 'public_directory',
  SOCIAL: 'social_profile',
  USER_CONTROLLED: 'user_controlled',
  GOVERNMENT: 'government_record',
  COURT: 'court_record',
  JOURNALISM: 'journalism',
  ACADEMIC: 'academic',
  EMPLOYER: 'employer_page',
  ARCHIVE: 'archive_cache',
  SEARCH_INDEX: 'search_index',
  UNKNOWN: 'unknown',
};

/** What is realistically achievable per category. */
const OUTCOMES = {
  [CATEGORY.BROKER]: {
    removable: true,
    outcome: 'removable',
    action: 'Opt out / delete the record.',
    note: 'Data brokers resell public and purchased records. Nearly all of them run an opt-out, and most are legally required to honour it for residents of states with a privacy statute.',
  },
  [CATEGORY.DIRECTORY]: {
    removable: true,
    outcome: 'usually_removable',
    action: 'Request removal from the listing.',
    note: 'Public directories usually honour removal requests, though some only suppress the entry rather than deleting it.',
  },
  [CATEGORY.SOCIAL]: {
    removable: true,
    outcome: 'user_controlled',
    action: 'Tighten the privacy settings or delete the profile yourself.',
    note: 'This is your own account. No third party can remove it for you, and you should not hand over the credentials for anyone to try — change the visibility settings directly.',
  },
  [CATEGORY.USER_CONTROLLED]: {
    removable: true,
    outcome: 'user_controlled',
    action: 'Edit or take down the page yourself.',
    note: 'You control this page. It is listed here so you can decide what it exposes, not because anything needs to be filed.',
  },
  [CATEGORY.GOVERNMENT]: {
    removable: false,
    outcome: 'generally_not_removable',
    action: 'Check whether a statutory confidentiality programme applies.',
    note: 'Government records are published under law and are not deletable on request. Some states run address-confidentiality programmes for people at risk, and voter or property records sometimes allow redaction — those are separate processes with their own eligibility rules.',
  },
  [CATEGORY.COURT]: {
    removable: false,
    outcome: 'generally_not_removable',
    action: 'Sealing or expungement is a court process, not a web form.',
    note: 'Court records are public by default. Removing one means petitioning the court to seal or expunge, which is a legal matter — no opt-out form will do it, and any site promising otherwise is selling something.',
  },
  [CATEGORY.JOURNALISM]: {
    removable: false,
    outcome: 'not_removable',
    action: 'Only the publisher can decide; some run an "unpublishing" policy.',
    note: 'Editorial content is protected expression. Publishers are under no obligation to remove accurate reporting, and pressuring them is rarely productive. Where the article is inaccurate, a correction request is the appropriate route.',
  },
  [CATEGORY.ACADEMIC]: {
    removable: false,
    outcome: 'rarely_removable',
    action: 'Contact the institution or publisher.',
    note: 'Papers, theses and faculty listings are part of the scholarly record. Removal is unusual; author-name changes are increasingly supported.',
  },
  [CATEGORY.EMPLOYER]: {
    removable: true,
    outcome: 'negotiable',
    action: 'Ask the employer directly.',
    note: 'A staff page or press release is under your employer’s control. Usually a quick internal request, not a privacy filing.',
  },
  [CATEGORY.ARCHIVE]: {
    removable: true,
    outcome: 'partially_removable',
    action: 'Request cache removal after the original is gone.',
    note: 'Archives and caches usually only clear once the source page is removed or blocked. Do the source first, then come back — otherwise the archive re-crawls and the work is undone.',
  },
  [CATEGORY.SEARCH_INDEX]: {
    removable: true,
    outcome: 'partially_removable',
    action: 'Request de-indexing once the underlying page is handled.',
    note: 'De-indexing hides the result without deleting the page. It is worth doing, but the page itself stays live for anyone with the link.',
  },
  [CATEGORY.UNKNOWN]: {
    removable: true,
    outcome: 'unknown',
    action: 'Investigate the site to find out what it offers.',
    note: 'Not yet classified — the agent will inspect the site before deciding.',
  },
};

/** Domain-shape signals. Deliberately structural, not a list of named sites. */
const DOMAIN_RULES = [
  { category: CATEGORY.GOVERNMENT, test: (d) => /(^|\.)gov(\.[a-z]{2})?$/.test(d) || /(^|\.)mil$/.test(d) || /(^|\.)gov\.[a-z]{2}$/.test(d) },
  { category: CATEGORY.ACADEMIC, test: (d) => /(^|\.)edu$/.test(d) || /(^|\.)ac\.[a-z]{2}$/.test(d) },
  { category: CATEGORY.COURT, test: (d) => /\b(court|judicial|docket|pacer|justice)\b/.test(d) },
  { category: CATEGORY.ARCHIVE, test: (d) => /\b(archive|wayback|cache|cachedview)\b/.test(d) },
];

/** Content signals from the page itself. Ordered most-specific first. */
const CONTENT_RULES = [
  {
    category: CATEGORY.BROKER,
    weight: 0.9,
    re: /\b(background (check|report)|people search|reverse phone lookup|find (people|anyone)|public records search|unlock (full|complete) report|view full report|our records show|opt[- ]?out of our database)\b/i,
  },
  {
    category: CATEGORY.COURT,
    weight: 0.95,
    re: /\b(case (number|no\.?)|docket (number|no\.?)|plaintiff|defendant|vs\.?\s|court of (common pleas|appeals)|filed in the .{0,30}court)\b/i,
  },
  {
    category: CATEGORY.JOURNALISM,
    weight: 0.85,
    re: /\b(by [A-Z][a-z]+ [A-Z][a-z]+,? (staff|correspondent|reporter)|published \d{1,2}:\d{2}|editorial (board|policy)|corrections policy|newsroom)\b/i,
  },
  {
    category: CATEGORY.DIRECTORY,
    weight: 0.7,
    re: /\b(member directory|staff directory|alumni directory|business listing|yellow pages|white pages|roster)\b/i,
  },
  {
    category: CATEGORY.SOCIAL,
    weight: 0.8,
    re: /\b(followers|following|posts|joined [A-Z][a-z]+ \d{4}|profile picture|send (a )?(message|friend request))\b/i,
  },
  {
    category: CATEGORY.EMPLOYER,
    weight: 0.6,
    re: /\b(our team|meet the team|leadership team|press release|joins (us|the company) as)\b/i,
  },
];

/**
 * Classify an exposure.
 *
 * @param exposure  { url, title, text, record, ... }
 * @param profile   the identity profile — used to spot user-controlled pages
 */
export function classifyRemovability(exposure = {}, profile = null) {
  const url = String(exposure.url || '');
  const domain = registrableDomain(url);
  const text = `${exposure.title || ''}\n${exposure.text || ''}`;
  const reasons = [];

  // 1. Pages on the user's own domain, or profiles they told us about, are
  //    theirs to edit. Never file a removal against a user's own site.
  if (profile) {
    const ownDomains = new Set(
      (profile.profiles || []).map((p) => registrableDomain(p.value)).filter(Boolean),
    );
    for (const e of profile.emails || []) {
      const d = String(e.value).split('@')[1];
      if (d) ownDomains.add(registrableDomain(d));
    }
    if (domain && ownDomains.has(domain)) {
      reasons.push(`${domain} is a site you told us about, so it is yours to change.`);
      return decide(CATEGORY.USER_CONTROLLED, 0.95, reasons, exposure);
    }
  }

  // 2. Structural domain signals are strong and cheap.
  for (const rule of DOMAIN_RULES) {
    if (domain && rule.test(domain)) {
      reasons.push(`The domain ${domain} identifies it as ${humanCategory(rule.category)}.`);
      return decide(rule.category, 0.9, reasons, exposure);
    }
  }

  // 3. Content signals, scored.
  const hits = CONTENT_RULES.filter((r) => r.re.test(text));
  if (hits.length) {
    const best = hits.sort((a, b) => b.weight - a.weight)[0];
    reasons.push(`The page reads like ${humanCategory(best.category)}.`);
    // Multiple categories firing means we are less sure, not more.
    const confidence = hits.length > 1 ? best.weight * 0.8 : best.weight;
    return decide(best.category, confidence, reasons, exposure);
  }

  // 4. A page carrying a dense dossier with no editorial context is, in
  //    practice, a broker — this is the shape that matters, not the brand.
  const fields = new Set(exposure.fields || []);
  const dossierish = ['address', 'phone', 'relatives', 'age', 'address_history']
    .filter((f) => fields.has(f)).length;
  if (dossierish >= 3) {
    reasons.push('The page aggregates address, phone, age and relatives together — the shape of a resold public-records dossier.');
    return decide(CATEGORY.BROKER, 0.7, reasons, exposure);
  }

  reasons.push('Not enough signal yet to classify this source.');
  return decide(CATEGORY.UNKNOWN, 0.3, reasons, exposure);
}

function decide(category, confidence, reasons, exposure) {
  const outcome = OUTCOMES[category] || OUTCOMES[CATEGORY.UNKNOWN];
  return {
    category,
    confidence,
    removable: outcome.removable,
    outcome: outcome.outcome,
    recommendedAction: outcome.action,
    note: outcome.note,
    reasons,
    // The honest sentence the dashboard shows. Written so it never over-promises.
    userMessage: userMessage(category, outcome, exposure),
  };
}

function userMessage(category, outcome, exposure) {
  const where = registrableDomain(exposure.url || '') || 'this site';
  switch (outcome.outcome) {
    case 'removable':
      return `We can file a removal request with ${where}.`;
    case 'usually_removable':
      return `${where} normally honours removal requests — we will file one and verify it afterwards.`;
    case 'user_controlled':
      return `This one is yours. We will not touch it — ${outcome.action.toLowerCase()}`;
    case 'partially_removable':
      return `We can ask ${where} to drop its copy, but only after the original source is dealt with.`;
    case 'negotiable':
      return `${where} is under your employer's control. A direct request is more likely to work than a privacy filing.`;
    case 'generally_not_removable':
    case 'rarely_removable':
    case 'not_removable':
      return `We cannot get this removed. ${outcome.note}`;
    default:
      return `Still working out what ${where} allows.`;
  }
}

function humanCategory(c) {
  return {
    [CATEGORY.BROKER]: 'a data broker or people-search site',
    [CATEGORY.DIRECTORY]: 'a public directory',
    [CATEGORY.SOCIAL]: 'a social media profile',
    [CATEGORY.USER_CONTROLLED]: 'a page you control',
    [CATEGORY.GOVERNMENT]: 'a government record',
    [CATEGORY.COURT]: 'a court record',
    [CATEGORY.JOURNALISM]: 'journalism',
    [CATEGORY.ACADEMIC]: 'an academic or institutional page',
    [CATEGORY.EMPLOYER]: 'an employer page',
    [CATEGORY.ARCHIVE]: 'an archive or cached copy',
    [CATEGORY.SEARCH_INDEX]: 'a search index',
    [CATEGORY.UNKNOWN]: 'an unclassified source',
  }[c] || c;
}

/** Site kind for the risk model's reach multiplier. */
export function siteKindFor(category) {
  return {
    [CATEGORY.BROKER]: 'aggregator',
    [CATEGORY.DIRECTORY]: 'directory',
    [CATEGORY.SOCIAL]: 'social',
    [CATEGORY.GOVERNMENT]: 'government',
    [CATEGORY.COURT]: 'government',
    [CATEGORY.JOURNALISM]: 'news',
    [CATEGORY.ACADEMIC]: 'directory',
    [CATEGORY.EMPLOYER]: 'directory',
    [CATEGORY.ARCHIVE]: 'archive',
    [CATEGORY.SEARCH_INDEX]: 'aggregator',
  }[category] || 'unknown';
}
