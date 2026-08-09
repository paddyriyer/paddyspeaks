/**
 * Privacy risk scoring.
 *
 * Two questions, deliberately kept apart:
 *
 *   riskOf(exposure)      how dangerous is this one page?
 *   exposureScore(list)   how exposed is this person overall?
 *
 * The core insight is that risk is not additive across fields — it is
 * *combinatorial*. A page showing only a name is noise. A page showing a name
 * and a city is close to noise. A page showing full address + phone + relatives
 * + age is a social-engineering kit: it is everything a caller needs to pass a
 * bank's identity check. So combinations get explicit multipliers rather than
 * the sum of their parts.
 *
 * The overall score uses diminishing returns. The tenth site publishing your
 * address does add risk, but far less than the first — the information is
 * already out. Summing linearly would put everyone at 100 and tell them
 * nothing.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { clamp, round, registrableDomain } from './text.js';

/**
 * Per-field sensitivity, 0..1. Calibrated by "what does this let an attacker
 * do", not by how private it feels. An email address feels private but is
 * mostly a contact channel; a date of birth feels innocuous and is a key to
 * financial accounts.
 */
export const FIELD_RISK = {
  name: 0.05,
  city: 0.1,
  state: 0.03,
  age: 0.25,
  birth_date: 0.55,
  address: 0.6,
  address_history: 0.5,
  phone: 0.45,
  email: 0.3,
  relatives: 0.4,
  associates: 0.25,
  employer: 0.25,
  job_title: 0.15,
  school: 0.15,
  income: 0.4,
  property: 0.4,
  vehicle: 0.35,
  criminal: 0.6,
  court: 0.5,
  bankruptcy: 0.5,
  license: 0.7,
  ssn_fragment: 0.95,
  photo: 0.2,
  username: 0.2,
  social_profile: 0.2,
  political: 0.35,
  religion: 0.35,
  health: 0.8,
  marital: 0.2,
  neighbors: 0.3,
};

/**
 * Combinations that are worth more than their parts. Each entry lists the
 * fields that must all be present, and the multiplier applied to the base.
 */
export const COMBINATIONS = [
  { fields: ['address', 'phone'], mult: 1.45, why: 'Full address together with a phone number — enough to locate and contact you directly.' },
  { fields: ['address', 'relatives'], mult: 1.4, why: 'Your address alongside family names — the classic pretext for impersonation calls.' },
  { fields: ['relatives', 'age'], mult: 1.3, why: 'Relatives plus your age — common answers to account-recovery questions.' },
  { fields: ['email', 'employer'], mult: 1.3, why: 'Work email context — a ready-made target for spear-phishing.' },
  { fields: ['address', 'age', 'name'], mult: 1.35, why: 'Name, age and address together identify you uniquely in most public records.' },
  { fields: ['birth_date', 'address'], mult: 1.6, why: 'Date of birth with a verified address is the standard identity-verification pair.' },
  { fields: ['phone', 'email'], mult: 1.2, why: 'Both contact channels — enables coordinated phishing and SIM-swap attempts.' },
  { fields: ['ssn_fragment', 'name'], mult: 2.0, why: 'Any part of an SSN attached to your name is severe.' },
  { fields: ['address_history', 'relatives'], mult: 1.35, why: 'Address history and family — reconstructs your whole timeline.' },
  { fields: ['property', 'address'], mult: 1.25, why: 'Property records tied to your address signal assets worth targeting.' },
];

/** How much reach the host has. A high-traffic aggregator hurts more. */
export const REACH = {
  aggregator: 1.25,   // people-search sites, indexed and scraped constantly
  marketing: 1.1,     // data brokers selling lists
  directory: 1.0,
  social: 0.95,
  forum: 0.8,
  archive: 0.7,       // cached/archived copies: real, but decaying
  government: 0.9,
  news: 0.85,
  unknown: 1.0,
};

/**
 * Risk for a single exposure.
 *
 * Returns 0..100 plus a plain-language explanation, because a number nobody
 * can interpret is not actionable. Spec item 38 asks for the explanation
 * explicitly and it is the part users actually read.
 */
export function riskOf(exposure) {
  const fields = uniqFields(exposure?.fields);
  if (!fields.length) {
    return {
      score: 0,
      band: 'none',
      drivers: [],
      combinations: [],
      explanation: 'Nothing personal was detected on this page.',
    };
  }

  // Base: the most sensitive field dominates, with the rest adding at a
  // decaying rate. Straight summing would let ten trivial fields outweigh one
  // driver's licence.
  const sorted = fields
    .map((f) => ({ field: f, weight: FIELD_RISK[f] ?? 0.15 }))
    .sort((a, b) => b.weight - a.weight);

  let base = 0;
  sorted.forEach((f, i) => { base += f.weight * (1 / (1 + i * 0.55)); });

  const present = new Set(fields);
  const hits = COMBINATIONS.filter((c) => c.fields.every((f) => present.has(f)));
  // Only the strongest combination multiplies; stacking every matching
  // multiplier double-counts the same underlying overlap.
  const mult = hits.reduce((m, c) => Math.max(m, c.mult), 1);

  const reach = REACH[exposure?.siteKind || 'unknown'] ?? 1;
  const confidence = clamp(exposure?.matchScore ?? 1, 0.3, 1);

  // Normalised so a "name + city" page lands near 10 and a full dossier near 90.
  let score = clamp((base * mult * reach) / 2.4) * 100 * confidence;

  // A page still live and indexed is worse than one already de-indexed.
  if (exposure?.status === 'successfully_removed') score *= 0.1;
  else if (exposure?.status === 'request_submitted' || exposure?.status === 'pending_removal') score *= 0.75;

  score = Math.round(clamp(score / 100) * 100);

  return {
    score,
    band: bandOf(score),
    drivers: sorted.slice(0, 5).map((f) => f.field),
    combinations: hits.map((c) => c.why),
    explanation: explainRisk(score, sorted, hits, exposure),
  };
}

export function bandOf(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  if (score > 0) return 'low';
  return 'none';
}

function explainRisk(score, sorted, hits, exposure) {
  const band = bandOf(score);
  const top = sorted.slice(0, 3).map((f) => humanField(f.field));
  const lead = {
    critical: 'Critical.',
    high: 'High risk.',
    moderate: 'Moderate risk.',
    low: 'Low risk.',
    none: 'No risk detected.',
  }[band];

  const bits = [`${lead} This page exposes ${listify(top)}.`];
  if (hits.length) bits.push(hits[0].why);
  else if (band === 'low') bits.push('On its own this is close to public-directory information.');

  if (exposure?.siteKind === 'aggregator') {
    bits.push('It sits on a people-search aggregator, so the same record tends to get copied onto other sites.');
  } else if (exposure?.siteKind === 'archive') {
    bits.push('It is an archived copy — the original may already be gone, but the cache persists.');
  }
  return bits.join(' ');
}

/**
 * Overall digital-exposure score for the user.
 *
 * Deliberately *not* an average and *not* a sum. It asks: how much unique
 * sensitive information about this person is publicly reachable, and how
 * widely is it replicated?
 */
export function exposureScore(exposures = []) {
  const live = exposures.filter(
    (e) => e && e.status !== 'successfully_removed' && e.status !== 'false_match',
  );

  if (!live.length) {
    return {
      score: 0,
      band: 'none',
      liveExposures: 0,
      uniqueFields: [],
      topSites: [],
      explanation: exposures.length
        ? 'Every exposure found has been removed. Nothing is currently public that we can see.'
        : 'No exposures found yet.',
    };
  }

  // Breadth: how many distinct sensitive attributes are public anywhere.
  const fieldSet = new Set();
  for (const e of live) for (const f of uniqFields(e.fields)) fieldSet.add(f);
  const breadth = [...fieldSet].reduce((sum, f) => sum + (FIELD_RISK[f] ?? 0.15), 0);

  // Depth: replication, with diminishing returns per additional site.
  const perSite = live
    .map((e) => riskOf(e).score)
    .sort((a, b) => b - a);
  let depth = 0;
  perSite.forEach((s, i) => { depth += s * (1 / (1 + i * 0.35)); });

  const raw = (breadth / 6) * 55 + (depth / 260) * 45;
  const score = Math.round(clamp(raw / 100) * 100);

  const bySite = new Map();
  for (const e of live) {
    const d = registrableDomain(e.url || '');
    if (!d) continue;
    bySite.set(d, Math.max(bySite.get(d) || 0, riskOf(e).score));
  }
  const topSites = [...bySite.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, s]) => ({ domain, score: s }));

  return {
    score,
    band: bandOf(score),
    liveExposures: live.length,
    uniqueFields: [...fieldSet],
    topSites,
    explanation: explainExposure(score, live.length, fieldSet, topSites),
  };
}

function explainExposure(score, count, fieldSet, topSites) {
  const band = bandOf(score);
  const lead = {
    critical: 'Your information is very widely exposed.',
    high: 'You have significant public exposure.',
    moderate: 'You have moderate public exposure.',
    low: 'Your public exposure is limited.',
    none: 'You have no detected public exposure.',
  }[band];

  const sensitive = [...fieldSet]
    .filter((f) => (FIELD_RISK[f] ?? 0) >= 0.4)
    .map(humanField);

  const bits = [
    `${lead} We can currently see ${count} live ${count === 1 ? 'page' : 'pages'} carrying your details.`,
  ];
  if (sensitive.length) {
    bits.push(`The sensitive items in circulation are ${listify(sensitive.slice(0, 5))}.`);
  }
  if (topSites.length) {
    bits.push(`The highest-risk source right now is ${topSites[0].domain}.`);
  }
  bits.push(
    band === 'none' || band === 'low'
      ? 'Keep the periodic recheck running — brokers routinely re-list records they have removed.'
      : 'Removing the top few sources usually drops this score sharply, because the rest are copies.',
  );
  return bits.join(' ');
}

/**
 * Ranking for the work queue (spec 37). Highest privacy risk first, but a
 * confirmed match outranks a speculative one at similar risk — there is no
 * point burning the first hour of a run on maybes.
 */
export function prioritize(exposures = []) {
  return [...exposures].sort((a, b) => {
    const ra = riskOf(a).score;
    const rb = riskOf(b).score;
    const ca = a.classification === 'confirmed' ? 1 : 0;
    const cb = b.classification === 'confirmed' ? 1 : 0;
    if (cb !== ca) return cb - ca;
    if (rb !== ra) return rb - ra;
    return (b.matchScore || 0) - (a.matchScore || 0);
  });
}

function uniqFields(fields) {
  return [...new Set((fields || []).filter(Boolean).map(String))];
}

function humanField(f) {
  return {
    address: 'your home address',
    address_history: 'your past addresses',
    phone: 'your phone number',
    email: 'your email address',
    relatives: 'names of your relatives',
    age: 'your age',
    birth_date: 'your date of birth',
    employer: 'your employer',
    ssn_fragment: 'part of your Social Security number',
    license: 'a licence number',
    property: 'property you own',
    income: 'income estimates',
    criminal: 'criminal-record references',
    court: 'court records',
    neighbors: 'your neighbours',
    vehicle: 'vehicle records',
    health: 'health information',
    name: 'your name',
    city: 'your city',
  }[f] || f.replace(/_/g, ' ');
}

function listify(items) {
  const a = items.filter(Boolean);
  if (!a.length) return 'nothing';
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

export { round };
