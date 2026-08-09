/**
 * Privacy jurisdiction detection (spec item 23).
 *
 * The hard rule here, and the reason this module is conservative to the point
 * of being boring: **we do not make legal claims we cannot support.**
 *
 * It is tempting to fire off "I am exercising my rights under CCPA §1798.105"
 * at every site, because it sounds forceful. It is also frequently wrong — the
 * CCPA only applies to businesses over certain thresholds, and a wrong
 * citation gives a site a clean reason to reject the request. Worse, it
 * teaches the user they have a right they may not have.
 *
 * So the order of preference is always:
 *   1. The site's own documented privacy process. Always available, never
 *      contestable, and usually faster.
 *   2. A statutory right, cited only where residency and the site's own policy
 *      both point at it.
 *
 * Everything returned here is phrased as "you may be able to", and every
 * statutory option carries `assertable: false` until the site's policy itself
 * mentions the law.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { norm } from './text.js';

/**
 * US state privacy laws with a consumer deletion or opt-out right, as of the
 * 2026 landscape. `rights` lists what the statute generally provides; it is not
 * legal advice and the module never asserts applicability on its own.
 */
export const US_STATE_LAWS = {
  CA: { name: 'CCPA/CPRA', full: 'California Consumer Privacy Act, as amended by the CPRA', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_sharing', 'limit_sensitive', 'access'] },
  VA: { name: 'VCDPA', full: 'Virginia Consumer Data Protection Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  CO: { name: 'CPA', full: 'Colorado Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  CT: { name: 'CTDPA', full: 'Connecticut Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  UT: { name: 'UCPA', full: 'Utah Consumer Privacy Act', rights: ['delete', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  TX: { name: 'TDPSA', full: 'Texas Data Privacy and Security Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  OR: { name: 'OCPA', full: 'Oregon Consumer Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  MT: { name: 'MCDPA', full: 'Montana Consumer Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  FL: { name: 'FDBR', full: 'Florida Digital Bill of Rights', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  DE: { name: 'DPDPA', full: 'Delaware Personal Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  IA: { name: 'ICDPA', full: 'Iowa Consumer Data Protection Act', rights: ['delete', 'opt_out_sale', 'access'] },
  NE: { name: 'NDPA', full: 'Nebraska Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  NH: { name: 'NHPA', full: 'New Hampshire Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  NJ: { name: 'NJDPA', full: 'New Jersey Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  TN: { name: 'TIPA', full: 'Tennessee Information Protection Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  MN: { name: 'MCDPA', full: 'Minnesota Consumer Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  MD: { name: 'MODPA', full: 'Maryland Online Data Privacy Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  IN: { name: 'INCDPA', full: 'Indiana Consumer Data Protection Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  KY: { name: 'KCDPA', full: 'Kentucky Consumer Data Protection Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
  RI: { name: 'RIDTPPA', full: 'Rhode Island Data Transparency and Privacy Protection Act', rights: ['delete', 'correct', 'opt_out_sale', 'opt_out_targeted_ads', 'access'] },
};

export const EU_EEA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO',
]);

export const NON_US_LAWS = {
  GB: { name: 'UK GDPR', full: 'UK GDPR and Data Protection Act 2018', rights: ['delete', 'correct', 'access', 'object', 'restrict'] },
  CA_COUNTRY: { name: 'PIPEDA', full: 'Personal Information Protection and Electronic Documents Act', rights: ['access', 'correct', 'withdraw_consent'] },
  BR: { name: 'LGPD', full: 'Lei Geral de Proteção de Dados', rights: ['delete', 'correct', 'access', 'object'] },
  AU: { name: 'Privacy Act', full: 'Privacy Act 1988 (Cth), Australian Privacy Principles', rights: ['access', 'correct'] },
  IN: { name: 'DPDP Act', full: 'Digital Personal Data Protection Act, 2023', rights: ['delete', 'correct', 'access'] },
  ZA: { name: 'POPIA', full: 'Protection of Personal Information Act', rights: ['delete', 'correct', 'access', 'object'] },
  JP: { name: 'APPI', full: 'Act on the Protection of Personal Information', rights: ['delete', 'correct', 'access'] },
};

/** Phrases in a site's own policy that show it acknowledges a given regime. */
const POLICY_MARKERS = [
  { law: 'CCPA/CPRA', re: /\b(ccpa|cpra|california consumer privacy|do not sell or share my personal information|california residents)\b/i },
  { law: 'GDPR', re: /\b(gdpr|general data protection regulation|right to erasure|data protection officer|lawful basis)\b/i },
  { law: 'UK GDPR', re: /\b(uk gdpr|data protection act 2018|information commissioner)\b/i },
  { law: 'VCDPA', re: /\b(vcdpa|virginia consumer data protection)\b/i },
  { law: 'CPA', re: /\b(colorado privacy act|universal opt-out)\b/i },
  { law: 'LGPD', re: /\b(lgpd|lei geral de prote)\b/i },
  { law: 'PIPEDA', re: /\b(pipeda|personal information protection and electronic documents)\b/i },
  { law: 'DPDP Act', re: /\b(dpdp act|digital personal data protection act)\b/i },
  { law: 'APPI', re: /\b(appi|act on the protection of personal information)\b/i },
];

/** Generic process markers — these are what we actually prefer to rely on. */
const PROCESS_MARKERS = [
  { kind: 'opt_out', re: /\b(opt[- ]?out|opt out of|suppress(ion)? request|remove my (info|information|record|listing))\b/i },
  { kind: 'delete', re: /\b(delete my (data|information|account)|data deletion|record removal|removal request)\b/i },
  { kind: 'do_not_sell', re: /\b(do not sell|do not share|dnsmpi)\b/i },
  { kind: 'privacy_request', re: /\b(privacy request|data subject request|dsar|submit a request)\b/i },
];

/**
 * Work out which regimes plausibly apply, and — more importantly — what the
 * agent should actually cite when it files the request.
 *
 * @param residence  { state, country } from the identity profile
 * @param policyText text scraped from the site's privacy policy (optional)
 * @param siteHints  { country } if the site declares an operating jurisdiction
 */
export function detectJurisdiction(residence = {}, policyText = '', siteHints = {}) {
  const state = String(residence.state || '').toUpperCase();
  const country = String(residence.country || '').toUpperCase();
  const text = String(policyText || '');

  const applicable = [];

  if (country === 'US' || (!country && state)) {
    const law = US_STATE_LAWS[state];
    if (law) {
      applicable.push({
        scope: 'user_residence',
        code: state,
        name: law.name,
        full: law.full,
        rights: law.rights,
        basis: `You gave your residence as ${state}, which has ${law.full}.`,
      });
    }
  }

  if (EU_EEA.has(country)) {
    applicable.push({
      scope: 'user_residence',
      code: country,
      name: 'GDPR',
      full: 'EU General Data Protection Regulation',
      rights: ['delete', 'correct', 'access', 'object', 'restrict', 'portability'],
      basis: `You gave your residence as ${country}, which is in the EU/EEA.`,
    });
  } else if (NON_US_LAWS[country]) {
    const law = NON_US_LAWS[country];
    applicable.push({
      scope: 'user_residence', code: country, name: law.name, full: law.full,
      rights: law.rights, basis: `You gave your residence as ${country}.`,
    });
  } else if (country === 'CA' && !US_STATE_LAWS.CA) {
    const law = NON_US_LAWS.CA_COUNTRY;
    applicable.push({
      scope: 'user_residence', code: 'CA', name: law.name, full: law.full,
      rights: law.rights, basis: 'You gave your residence as Canada.',
    });
  }

  // Which regimes the site itself says it honours. This is the part we can
  // actually rely on, because the site has published it.
  const acknowledged = POLICY_MARKERS
    .filter((m) => m.re.test(text))
    .map((m) => m.law);

  const documentedProcesses = PROCESS_MARKERS
    .filter((m) => m.re.test(text))
    .map((m) => m.kind);

  // A statutory right is only worth citing when both ends line up.
  const assertable = applicable.map((law) => ({
    ...law,
    assertable: acknowledged.some((a) => a === law.name || (law.name === 'GDPR' && a === 'GDPR')),
  }));

  return {
    applicable: assertable,
    acknowledgedBySite: acknowledged,
    documentedProcesses: [...new Set(documentedProcesses)],
    recommended: recommend(assertable, acknowledged, documentedProcesses),
  };
}

/**
 * What to actually do, in order. Site process first, always.
 */
function recommend(applicable, acknowledged, processes) {
  const steps = [];

  if (processes.length) {
    steps.push({
      approach: 'site_process',
      confidence: 'high',
      action: 'Use the site’s own documented removal process.',
      why: `The site publishes ${processes.length === 1 ? 'a' : ''} ${processes.map(humanProcess).join(' and ')} process. Using it needs no legal argument and is usually the fastest route.`,
    });
  }

  const citable = applicable.filter((l) => l.assertable);
  for (const law of citable) {
    steps.push({
      approach: 'statutory',
      confidence: 'medium',
      law: law.name,
      action: `Reference ${law.name} in the request.`,
      why: `The site's own privacy policy mentions ${law.name}, and you told us you live in ${law.code}. That is enough to reference it — it is not a guarantee the site is in scope of the statute.`,
      rights: law.rights,
    });
  }

  const uncitable = applicable.filter((l) => !l.assertable);
  for (const law of uncitable) {
    steps.push({
      approach: 'statutory_unverified',
      confidence: 'low',
      law: law.name,
      action: `Do not cite ${law.name} unless the site's policy mentions it.`,
      why: `${law.full} may cover you as a resident of ${law.code}, but this site's policy does not acknowledge it and we cannot confirm the site is within scope. Citing it could get the request rejected on a technicality.`,
    });
  }

  if (!steps.length) {
    steps.push({
      approach: 'contact',
      confidence: 'low',
      action: 'Send a plain, polite removal request to the site’s contact address.',
      why: 'No documented privacy process and no confirmable statutory route. A direct request still works surprisingly often, especially with smaller sites.',
    });
  }

  return steps;
}

function humanProcess(kind) {
  return {
    opt_out: 'opt-out',
    delete: 'deletion',
    do_not_sell: 'do-not-sell/share',
    privacy_request: 'privacy-request',
  }[kind] || kind;
}

/**
 * Spec item 24: when a site offers several choices, take deletion *and* the
 * sale/share opt-out. Deleting today does not stop them re-acquiring and
 * re-listing you next quarter; the opt-out is what makes it stick.
 */
export function preferredChoices(availableChoices = []) {
  const available = new Set(availableChoices.map((c) => norm(c).replace(/ /g, '_')));
  const chosen = [];

  if (available.has('delete') || available.has('deletion') || available.has('remove') || available.has('removal')) {
    chosen.push({ choice: 'delete', why: 'Removes the record that is public right now.' });
  }
  if (available.has('opt_out_sale') || available.has('do_not_sell') || available.has('do_not_sell_or_share') || available.has('opt_out')) {
    chosen.push({ choice: 'opt_out_sale', why: 'Stops them selling or sharing your data onward, so the record does not simply come back.' });
  }
  if (!chosen.length && available.has('suppress')) {
    chosen.push({ choice: 'suppress', why: 'Suppression is the only option offered here — it hides the record without deleting it.' });
  }

  return {
    choices: chosen.map((c) => c.choice),
    rationale: chosen.length > 1
      ? 'Taking both: deletion clears what is public now, and the opt-out stops it being re-listed later.'
      : chosen[0]?.why || 'No recognised privacy choice offered on this site.',
  };
}
