/**
 * Delete from everyone at once, where the law provides for it.
 *
 * The per-exposure workflow in this tool is honest but brutal: find a listing,
 * find its opt-out, file, wait, re-check, watch it come back. Multiply that by
 * the several hundred registered data brokers in the US and it is not work a
 * person can finish. Any tool that only offers that loop is quietly asking the
 * user to do something impossible, and dressing it up as empowerment.
 *
 * So this module answers a different question first: **is there a single
 * request that covers all of them?** Where one exists it is worth vastly more
 * than anything else in this product, and it belongs at the top of the screen,
 * not buried under a queue of individual sites.
 *
 * Today exactly one such mechanism exists: California's DROP, built under the
 * Delete Act (SB 362). Nowhere else has an equivalent. This module says so
 * plainly rather than implying broader coverage — a user in Ohio being led to
 * believe one form will clear them is worse off than one who knows they face
 * the manual route.
 *
 * ── What this module will never do ───────────────────────────────────────────
 * DROP requires identity verification, and via Login.gov that can mean
 * uploading a passport or driving licence. **The tool hands the user the link
 * and stops.** It does not automate the submission and it never touches a
 * government ID — the same invariant the form-filling engine enforces. That is
 * not a limitation to engineer around later; it is the point.
 *
 * Pure module — no I/O, no network. Unit-tested in tests/run.mjs.
 */

import { EU_EEA, US_STATE_LAWS } from './jurisdiction.js';

export const PROGRAM = {
  CA_DROP: 'ca_drop',
  GDPR_ERASURE: 'gdpr_erasure',
  UK_ERASURE: 'uk_erasure',
  STATE_INDIVIDUAL: 'state_individual',
  NONE: 'none',
};

/**
 * California's Delete Request and Opt-out Platform.
 *
 * One request, propagated to every data broker registered with the CPPA.
 * Brokers must poll it at least every 45 days and delete on a match — which
 * makes it continuous suppression rather than a one-off opt-out, and that is
 * the part worth understanding. A per-site opt-out clears you today; DROP keeps
 * clearing you.
 */
const CA_DROP = {
  id: PROGRAM.CA_DROP,
  kind: 'one_request_covers_all',
  name: 'DROP — California\'s one-request deletion platform',
  authority: 'California Privacy Protection Agency',
  law: 'the Delete Act (SB 362)',
  url: 'https://consumer.drop.privacy.ca.gov/',
  helpUrl: 'https://privacy.ca.gov/drop/how-drop-works',
  cost: 'Free.',
  headline:
    'One request, and every data broker registered in California has to delete you — and keep deleting you.',
  how: [
    'You submit a single request naming yourself. It is free.',
    'Every broker on the state register must check the platform at least once every 45 days, match your details against their records, and delete what they hold — including inferences they built about you.',
    'They must report back what they did within 45 days of picking the request up.',
    'A broker that cannot verify the match has to treat it as an opt-out of sale instead, so the fallback still helps you.',
  ],
  // Everything below is the honest half. A user who files this and believes
  // they are finished will stop checking, which is the failure mode that
  // matters most.
  doesNotCover: [
    'Companies that are not registered data brokers — an employer page, a news article, a university listing, a social profile you control.',
    'Public records at their source: courts, property deeds, voter files. Those are published by law, and DROP does not reach them.',
    'A broker that has failed to register. The register is the boundary of the programme.',
    'Anything outside the US, and any site that simply ignores the law until it is enforced against them.',
  ],
  timing: 'Not instant. Brokers pull requests on a 45-day cycle, so allow a couple of months before judging it, and re-check rather than assume.',
  identityNote:
    'The platform verifies who you are, which can mean uploading a passport or state ID to Login.gov. Do that yourself, on the state\'s own site. This tool will never fill that in for you and never asks for the document.',
  needs: [
    { key: 'name', label: 'Your full legal name', required: true },
    { key: 'birthDate', label: 'Your date of birth', required: true },
    { key: 'zip', label: 'Your ZIP code', required: true },
    { key: 'email', label: 'Email addresses', required: false, why: 'Optional, but each one you add is another way a broker\'s record can be matched to you.' },
    { key: 'phone', label: 'Phone numbers', required: false, why: 'Same — more identifiers means more matches, and a broker only deletes what it can match.' },
  ],
};

/**
 * What bulk route, if any, is open to this person.
 *
 * @param profile the identity profile (may be null)
 * @returns { program, available, ...details, readiness }
 */
export function bulkRemovalFor(profile) {
  const residence = profile?.residence || {};
  const state = String(residence.state || '').toUpperCase();
  const country = String(residence.country || '').toUpperCase()
    || (state ? 'US' : '');

  if (state === 'CA') {
    return { ...CA_DROP, available: true, program: PROGRAM.CA_DROP, readiness: readinessFor(CA_DROP, profile) };
  }

  if (country === 'GB' || country === 'UK') {
    return erasureRoute(PROGRAM.UK_ERASURE, 'the UK GDPR and Data Protection Act 2018');
  }
  if (EU_EEA.has(country)) {
    return erasureRoute(PROGRAM.GDPR_ERASURE, 'Article 17 of the GDPR');
  }

  if (country === 'US' && US_STATE_LAWS[state]) {
    const law = US_STATE_LAWS[state];
    return {
      program: PROGRAM.STATE_INDIVIDUAL,
      available: false,
      kind: 'individual_requests_only',
      name: `${law.name} — but one site at a time`,
      law: law.full,
      headline: `${law.full} gives you a deletion right, but there is no single form that reaches every broker at once. California is currently the only state with one.`,
      how: [
        `Each broker has to honour a deletion request from you under ${law.name}, and most run a free opt-out to handle it.`,
        'Work the list below in priority order rather than alphabetically — the duplicate groups tell you which records are the same data resold, and clearing the source matters more than clearing the copies.',
      ],
      doesNotCover: [],
      note: 'If you also spend part of the year in California, check whether you qualify as a California resident — the one-request platform there is worth far more than any amount of individual filing.',
      readiness: null,
    };
  }

  return {
    program: PROGRAM.NONE,
    available: false,
    kind: 'individual_requests_only',
    name: 'No one-request platform covers you',
    headline: 'Nowhere you have told us about runs a single-request deletion platform, so removal here is site by site.',
    how: [
      'Each exposure below carries its own route and the fastest way to use it.',
      'Start with the duplicate groups: when one record has been resold to nine sites, the copies keep reappearing until the source stops selling it.',
    ],
    doesNotCover: [],
    note: 'Tell the console where you live in step 1 if you have not — the answer changes completely by jurisdiction, and California in particular has a platform that does all of this in one request.',
    readiness: null,
  };
}

function erasureRoute(program, law) {
  return {
    program,
    available: false,
    kind: 'individual_requests_only',
    name: `Right to erasure under ${law}`,
    law,
    headline: `${law} gives you a strong erasure right, but it is exercised against each controller separately — there is no central platform.`,
    how: [
      'A request has to be answered within one month, and it is free.',
      'Name the right explicitly and ask for confirmation in writing; the response deadline is what gives the request its teeth.',
      'Where a site refuses, the supervisory authority in your country takes complaints — that route costs you nothing but time.',
    ],
    doesNotCover: [
      'Records a controller must keep for a legal obligation, and journalism, which has its own exemption.',
    ],
    note: 'The removal request the console drafts already cites this where the site\'s own policy acknowledges it.',
    readiness: null,
  };
}

/**
 * What the user already has for this programme, and what they will have to
 * supply themselves.
 *
 * Date of birth is the interesting case. Onboarding deliberately asks for birth
 * *year* only, because a full date is one of the most damaging things to hold
 * and the matching engine does not need it. DROP does need it — so the honest
 * answer is "you will type this on the state's site, and this tool still will
 * not store it", not "give it to us first".
 */
export function readinessFor(program, profile) {
  const p = profile || {};
  const residence = p.residence || {};
  const have = [];
  const supply = [];

  for (const need of program.needs || []) {
    const value = valueFor(need.key, p, residence);
    if (value.known) have.push({ ...need, sample: value.sample, count: value.count });
    else supply.push({ ...need, note: value.note });
  }

  const missingRequired = supply.filter((s) => s.required);
  return {
    have,
    supply,
    ready: missingRequired.length === 0,
    summary: missingRequired.length
      ? `You will need ${listOf(missingRequired.map((s) => s.label.toLowerCase()))} to hand — the console does not hold ${missingRequired.length === 1 ? 'it' : 'them'}.`
      : 'You already have everything the form asks for.',
  };
}

function valueFor(key, p, residence) {
  switch (key) {
    case 'name': {
      const n = p.names?.[0]?.value;
      return n ? { known: true, sample: n } : { known: false, note: 'Add your name in step 1.' };
    }
    case 'zip':
      return residence.zip
        ? { known: true, sample: residence.zip }
        : { known: false, note: 'Add your address in step 1, or just read it off a letter.' };
    case 'birthDate':
      // Never "known": the console holds a year at most, and deliberately so.
      return {
        known: false,
        note: p.birthYear?.value
          ? `You told the console ${p.birthYear.value}, which is the year only — it never asks for the full date, and does not need it. Type the full date on the state's form.`
          : 'The console does not ask for this and does not store it. Type it on the state\'s form.',
      };
    case 'email': {
      const list = p.emails || [];
      return list.length
        ? { known: true, sample: list[0].value, count: list.length }
        : { known: false, note: 'Optional — but each address you give the platform is another way a broker\'s record can be matched.' };
    }
    case 'phone': {
      const list = p.phones || [];
      return list.length
        ? { known: true, sample: list[0].value, count: list.length }
        : { known: false, note: 'Optional, and worth adding on the form even if you skipped it here.' };
    }
    default:
      return { known: false };
  }
}

/**
 * Does a bulk programme plausibly cover this particular exposure?
 *
 * Deliberately conservative, and it is a *category* judgement, not a lookup of
 * named companies — nothing in this repo holds a broker list. A site classified
 * as a broker is the kind of thing DROP reaches; a court record, a news story
 * or a page the user controls is not, whatever the law says about brokers.
 *
 * Note the wording everywhere this surfaces: "expected to be covered", never
 * "covered". Only the register says who is registered, and a broker that never
 * registered is exactly the one that will still be publishing you next year.
 */
export function coveredByBulk(exposure, bulk) {
  if (!bulk?.available) return { covered: false, why: '' };

  const category = exposure?.removability?.category;
  if (category === 'data_broker') {
    return {
      covered: true,
      why: 'This is a people-search listing, so a registered broker behind it has to act on your single request — you do not need to file here individually.',
    };
  }
  if (category === 'government_record' || category === 'court_record') {
    return {
      covered: false,
      why: 'A public record at its source. The one-request platform does not reach these, and no opt-out will — this one needs the court or agency itself.',
    };
  }
  if (category === 'social_profile' || category === 'user_controlled') {
    return { covered: false, why: 'This one is yours. Change the setting or delete the page; no filing needed.' };
  }
  return {
    covered: false,
    why: 'Not a data broker, so the one-request platform will not touch it — handle this one directly.',
  };
}

function listOf(items) {
  const a = (items || []).filter(Boolean);
  if (!a.length) return 'nothing';
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
