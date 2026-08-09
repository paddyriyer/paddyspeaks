/**
 * "Explain why you found me."
 *
 * Every exposure answers four questions in plain English:
 *
 *   1. How did this site get my information?
 *   2. Why does it think this record is me?
 *   3. What could someone do with this information?
 *   4. What is the fastest way to eliminate this exposure?
 *
 * This is the part that turns a removal service into something that teaches.
 * A user who understands *how* a broker acquired their address learns that
 * removing one downstream copy is pointless while the upstream feed still
 * sells it — which is the single most useful thing anyone can know about their
 * own footprint, and the thing every commercial service is quietly incentivised
 * not to explain.
 *
 * Everything here is derived from analysis already performed — the match
 * evidence, the removability classification, the risk combinations. Nothing is
 * generated speculatively, and where the answer is genuinely unknown it says
 * so rather than inventing a plausible story.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { registrableDomain } from './text.js';
import { COMBINATIONS, FIELD_RISK } from './risk.js';
import { CATEGORY } from './removability.js';

/**
 * Where a source of this kind gets its data. These are provenance patterns of
 * *categories*, not claims about named companies — the same reason discovery
 * carries no broker list.
 */
const PROVENANCE = {
  [CATEGORY.BROKER]: {
    how: 'It bought or scraped it. People-search sites assemble records from voter rolls, property deeds, court filings, marketing lists, warranty cards and loyalty-programme data, then resell the compiled profile.',
    upstream: true,
    note: 'You almost certainly never gave this site anything directly.',
  },
  [CATEGORY.DIRECTORY]: {
    how: 'Someone published it as part of a list — a membership roster, an alumni directory, a business listing. Often an organisation you belong to, rather than a company that bought your data.',
    upstream: false,
    note: 'The organisation that published it can usually take it down on request.',
  },
  [CATEGORY.GOVERNMENT]: {
    how: 'It is a public record. Property deeds, voter registrations and licence filings are published by law, and commercial sites harvest them at scale.',
    upstream: true,
    note: 'This is the origin point for a great deal of what brokers resell.',
  },
  [CATEGORY.COURT]: {
    how: 'It is a court filing. Case records are public by default in most jurisdictions and are bulk-downloaded by aggregators the day they appear.',
    upstream: true,
    note: 'Sealing is a legal process, not a web form.',
  },
  [CATEGORY.SOCIAL]: {
    how: 'You published it. This is an account you control, and its visibility is a setting rather than a removal request.',
    upstream: false,
    note: null,
  },
  [CATEGORY.USER_CONTROLLED]: {
    how: 'You published it — this is your own site or profile.',
    upstream: false,
    note: null,
  },
  [CATEGORY.EMPLOYER]: {
    how: 'Your employer published it — a staff page, a press release, a conference bio.',
    upstream: false,
    note: 'Usually an internal request rather than a privacy filing.',
  },
  [CATEGORY.JOURNALISM]: {
    how: 'A publication reported it. Editorial content is written, not harvested.',
    upstream: false,
    note: null,
  },
  [CATEGORY.ACADEMIC]: {
    how: 'An institution published it — a paper, a thesis, a faculty listing.',
    upstream: false,
    note: null,
  },
  [CATEGORY.ARCHIVE]: {
    how: 'It is a cached or archived copy of a page that existed somewhere else.',
    upstream: false,
    note: 'The archive will usually only clear once the original is gone.',
  },
};

/**
 * Produce the four answers for one exposure.
 *
 * @param exposure the exposure record
 * @param profile  the identity profile
 * @param context  { duplicateGroup } — the dedupe group, when known, so we can
 *                 explain resale rather than describing the page in isolation
 */
export function explainExposure(exposure, profile, context = {}) {
  const e = exposure || {};
  const domain = registrableDomain(e.url || '') || 'this site';
  const category = e.removability?.category || CATEGORY.UNKNOWN;
  const fields = e.fields || [];

  return {
    domain,
    howTheyGotIt: howTheyGotIt(category, domain, context),
    whyItsYou: whyItsYou(e),
    whatSomeoneCouldDo: whatSomeoneCouldDo(fields, e),
    fastestRemoval: fastestRemoval(e, category, context),
  };
}

/* ------------------------------------------- 1. how did they get it? */

function howTheyGotIt(category, domain, context) {
  const p = PROVENANCE[category];
  const group = context.duplicateGroup;

  const bits = [];
  if (p) {
    bits.push(p.how);
    if (p.note) bits.push(p.note);
  } else {
    bits.push(`We have not yet classified what kind of source ${domain} is, so we cannot say how it acquired your details.`);
  }

  // The genuinely useful insight: this record is one of many copies.
  if (group && group.acrossSites > 1) {
    bits.push(
      `The same record appears on ${group.acrossSites} different sites. That is not ${group.acrossSites} separate leaks — it is one underlying record being resold, which is why removing it here does not remove it elsewhere.`,
    );
  }

  return {
    text: bits.join(' '),
    hasUpstream: Boolean(p?.upstream),
    resoldAcross: group?.acrossSites || 1,
  };
}

/* ------------------------------------------ 2. why does it think it's me? */

function whyItsYou(e) {
  const pct = Math.round((e.matchScore || 0) * 100);
  const signals = e.evidenceOfMatch || [];
  const conflicts = e.conflicts || [];

  const bits = [];
  if (signals.length) {
    bits.push(`We matched on ${listify(signals)}.`);
  }
  if (conflicts.length) {
    bits.push(`Against that: ${listify(conflicts)}.`);
  }

  // The point users most need to understand about matching.
  const nameOnly = signals.length === 1 && /name/i.test(signals[0]);
  if (nameOnly) {
    bits.push('A name on its own is weak evidence — plenty of people share yours — which is why this is not treated as confirmed.');
  } else if (signals.length >= 3) {
    bits.push('Several independent details agreeing is much stronger than any one of them alone.');
  }

  return {
    text: bits.join(' ') || 'Too little on the page to judge.',
    confidence: pct,
    signals,
    conflicts,
  };
}

/* ------------------------------------ 3. what could someone do with it? */

function whatSomeoneCouldDo(fields, e) {
  const present = new Set(fields);
  const hits = COMBINATIONS.filter((c) => c.fields.every((f) => present.has(f)));

  if (hits.length) {
    // Strongest combination first — that is the realistic attack, and listing
    // every overlapping one dilutes it.
    const top = [...hits].sort((a, b) => b.mult - a.mult)[0];
    return {
      text: top.why,
      combinations: hits.map((h) => h.why),
      severity: top.mult >= 1.5 ? 'severe' : top.mult >= 1.3 ? 'serious' : 'moderate',
    };
  }

  const sensitive = fields
    .filter((f) => (FIELD_RISK[f] ?? 0) >= 0.4)
    .map(humanField);

  if (sensitive.length) {
    return {
      text: `On its own this exposes ${listify(sensitive)} — not enough to impersonate you, but it is one of the pieces someone would collect.`,
      combinations: [],
      severity: 'moderate',
    };
  }

  return {
    text: 'Little here is useful on its own. It matters mainly as one more copy making the rest easier to find.',
    combinations: [],
    severity: 'low',
  };
}

/* -------------------------------------------- 4. fastest way to kill it */

function fastestRemoval(e, category, context) {
  const group = context.duplicateGroup;
  const r = e.removability || {};

  if (!r.removable) {
    return {
      text: r.note || 'This cannot be removed on request.',
      action: r.recommendedAction || 'No removal route exists.',
      realistic: false,
    };
  }

  if (category === CATEGORY.USER_CONTROLLED || category === CATEGORY.SOCIAL) {
    return {
      text: 'This one is yours — change the visibility setting or delete the page. Nobody needs to file anything, and no service should be asking you for the password.',
      action: r.recommendedAction,
      realistic: true,
    };
  }

  const bits = [];

  // The highest-leverage advice in the product.
  if (group && group.acrossSites > 1) {
    bits.push(
      `Do not start here. ${group.acrossSites} sites carry this same record, so removing this copy alone changes very little — several of the others will still be publishing it tomorrow, and some will re-import it.`,
    );
    bits.push('Work through the whole group, and prioritise whichever source the others appear to be copying from.');
  } else {
    bits.push(`Use ${registrableDomain(e.url || '') || 'the site'}'s own opt-out process — it needs no legal argument and is almost always the fastest route.`);
  }

  const rec = (e.jurisdiction?.recommended || [])[0];
  if (rec && rec.approach === 'statutory') {
    bits.push(`Their policy acknowledges ${rec.law}, so referencing it is fair game here.`);
  }

  if (e.paywalled) {
    bits.push('This site charges for removal. Do not pay — there is usually a separate free opt-out that the law requires them to offer, and paying marks you as a responsive target.');
  }

  const choices = e.privacyChoices?.choices || [];
  if (choices.includes('delete') && choices.includes('opt_out_sale')) {
    bits.push('Take deletion *and* the do-not-sell option. Deleting alone lets them re-acquire and re-list you next quarter.');
  }

  return { text: bits.join(' '), action: r.recommendedAction, realistic: true };
}

/* ----------------------------------------------------------------- utils */

function humanField(f) {
  return {
    address: 'your home address',
    address_history: 'your past addresses',
    phone: 'your phone number',
    email: 'your email address',
    relatives: 'the names of your relatives',
    age: 'your age',
    birth_date: 'your date of birth',
    employer: 'your employer',
    ssn_fragment: 'part of your Social Security number',
    property: 'property you own',
    income: 'income estimates',
    court: 'court records',
    criminal: 'criminal-record references',
    license: 'a licence number',
    vehicle: 'vehicle records',
    neighbors: 'your neighbours',
  }[f] || f.replace(/_/g, ' ');
}

function listify(items) {
  const a = (items || []).filter(Boolean);
  if (!a.length) return 'nothing';
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
