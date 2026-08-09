/**
 * Attack-surface intelligence.
 *
 * This module answers the question the whole product exists for, and it can
 * answer it *before a single search runs*: given what is known about this
 * person, what could someone actually do to them?
 *
 * That distinction matters. Every competitor starts by hunting for listings,
 * which means the user stares at a spinner before learning anything. But
 * impersonation risk is a property of the *attribute combination*, not of how
 * many websites happen to carry it. Someone who knows your address, your
 * phone and two relatives' names can already pass most bank identity checks —
 * whether they learned it from one site or forty.
 *
 * So this runs instantly on the identity profile, and sharpens as exposures
 * are confirmed.
 *
 * The honesty rule: every number here is derived from real attributes. Nothing
 * is seeded to look impressive. A dimension with no supporting data scores
 * zero and says so, rather than inventing a plausible-looking figure.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { clamp, round, uniq, registrableDomain } from './text.js';

/**
 * The dimensions. Each names a *concrete attack*, not a vague category —
 * "SIM swap" tells you something "medium risk" never will.
 *
 * `needs` are the attributes that enable the attack. `critical` attributes
 * are the ones without which the attack largely does not work, so their
 * absence caps the score rather than merely lowering it.
 */
export const DIMENSIONS = [
  {
    id: 'identity_theft',
    label: 'Identity theft',
    needs: ['name', 'address', 'birth_date', 'age', 'ssn_fragment', 'address_history'],
    critical: ['address'],
    weightBy: { ssn_fragment: 3.0, birth_date: 2.2, address: 1.6, address_history: 1.2, age: 0.9, name: 0.4 },
    attack: 'Open credit in your name.',
    explain: (has) => has('ssn_fragment')
      ? 'Any part of your Social Security number published next to your name and address is close to a complete application packet.'
      : has('birth_date')
        ? 'Your full date of birth alongside an address is the pair most lenders use to verify an applicant.'
        : 'Name and address alone rarely pass a credit check, but they are the foundation everything else is built on.',
  },
  {
    id: 'social_engineering',
    label: 'Social engineering',
    needs: ['relatives', 'age', 'address', 'employer', 'phone', 'neighbors'],
    critical: ['relatives', 'phone'],
    weightBy: { relatives: 2.0, phone: 1.6, address: 1.4, employer: 1.2, age: 1.0, neighbors: 0.7 },
    attack: 'Call you, or call someone about you, and sound legitimate.',
    explain: (has) => has('relatives') && has('phone')
      ? 'A caller who can name your relatives and reach you directly does not sound like a stranger — that is the entire mechanism of the "grandparent scam" and most successful pretexting.'
      : has('relatives')
        ? 'Relatives named publicly give a caller the specific detail that makes an approach believable.'
        : 'Little of what an impersonator needs to sound familiar is public.',
  },
  {
    id: 'sim_swap',
    label: 'SIM swap',
    needs: ['phone', 'address', 'birth_date', 'age', 'name'],
    critical: ['phone'],
    weightBy: { phone: 2.4, address: 1.8, birth_date: 1.6, age: 0.8, name: 0.4 },
    attack: 'Move your number to their SIM, then reset your accounts.',
    explain: (has) => has('phone') && has('address')
      ? 'Carriers verify a porting request with the account holder\'s name, address and number. All three being public is exactly the precondition for a SIM swap — and your number is the reset path for most of your accounts.'
      : has('phone')
        ? 'Your number is public, which is the starting point, but a carrier will also want an address to match.'
        : 'Your phone number does not appear in what we know so far.',
  },
  {
    id: 'account_recovery',
    label: 'Account takeover',
    needs: ['relatives', 'age', 'birth_date', 'address_history', 'school', 'email'],
    critical: ['email'],
    weightBy: { relatives: 1.8, address_history: 1.7, school: 1.5, birth_date: 1.4, email: 1.2, age: 0.8 },
    attack: 'Answer your security questions.',
    explain: (has) => (has('relatives') || has('school') || has('address_history'))
      ? 'Mother\'s maiden name, the street you grew up on, your first school — the standard recovery questions are answered by exactly the fields brokers publish.'
      : 'The classic security-question answers are not obviously public.',
  },
  {
    id: 'physical',
    label: 'Physical safety',
    needs: ['address', 'address_history', 'property', 'vehicle', 'neighbors', 'photo'],
    critical: ['address'],
    weightBy: { address: 2.6, property: 1.4, vehicle: 1.2, photo: 1.0, neighbors: 0.9, address_history: 0.8 },
    attack: 'Turn up where you live.',
    explain: (has) => has('address')
      ? 'Your home address is published. For most people this is an annoyance; for anyone being harassed or stalked it is the exposure that matters more than all the others combined.'
      : 'No home address found in what we know so far.',
  },
  {
    id: 'professional',
    label: 'Professional targeting',
    needs: ['employer', 'job_title', 'email', 'social_profile', 'name'],
    critical: ['employer'],
    weightBy: { employer: 1.8, email: 1.6, job_title: 1.2, social_profile: 1.0, name: 0.4 },
    attack: 'Spear-phish you, or your colleagues, using your role.',
    explain: (has) => has('employer') && has('email')
      ? 'Your employer and a contact address together let an attacker write the one email you would plausibly open — usually addressed from someone you actually report to.'
      : 'Limited work context is public.',
  },
  {
    id: 'financial',
    label: 'Financial profiling',
    needs: ['income', 'property', 'address', 'employer', 'court', 'bankruptcy'],
    critical: [],
    weightBy: { income: 1.8, property: 1.6, bankruptcy: 1.5, court: 1.3, employer: 0.9, address: 0.8 },
    attack: 'Judge whether you are worth targeting.',
    explain: (has) => (has('income') || has('property'))
      ? 'Income estimates and property records let someone sort targets by how much there is to take. This is how a scattergun scam becomes a directed one.'
      : 'Little financial signal is public.',
  },
  {
    id: 'family',
    label: 'Family exposure',
    needs: ['relatives', 'neighbors', 'address', 'marital'],
    critical: ['relatives'],
    weightBy: { relatives: 2.4, address: 1.2, marital: 0.9, neighbors: 0.8 },
    attack: 'Reach the people around you.',
    explain: (has) => has('relatives')
      ? 'Your relatives are named publicly. Their exposure is not yours to remove — they each have to opt out themselves — which is why family records are the hardest part of a footprint to clean.'
      : 'No relatives are publicly linked to you in what we know so far.',
  },
];

/**
 * Compute the full attack surface.
 *
 * @param profile   the identity profile
 * @param exposures confirmed exposures (optional — the score is meaningful
 *                  from the profile alone, and sharpens as these arrive)
 */
export function attackSurface(profile, exposures = []) {
  const live = exposures.filter(
    (e) => e && e.status !== 'false_match' && e.status !== 'successfully_removed',
  );

  // Attributes we know are public, plus attributes the user told us about
  // themselves. Both matter: a phone number the user gave us is a phone number
  // that exists, and the search for it has not finished yet.
  const confirmed = new Set();
  for (const e of live) for (const f of e.fields || []) confirmed.add(f);

  const stated = statedAttributes(profile);
  const all = new Set([...confirmed, ...stated]);
  const has = (f) => all.has(f);
  const isConfirmed = (f) => confirmed.has(f);

  const dimensions = DIMENSIONS.map((d) => {
    const present = d.needs.filter((f) => has(f));
    const evidenced = d.needs.filter((f) => isConfirmed(f));

    let raw = 0;
    for (const f of present) raw += d.weightBy[f] ?? 1;
    const max = d.needs.reduce((s, f) => s + (d.weightBy[f] ?? 1), 0);

    let score = max ? raw / max : 0;

    // Without a critical attribute the attack mostly does not work, however
    // much peripheral data exists.
    if (d.critical.length && !d.critical.some((f) => has(f))) {
      score = Math.min(score, 0.25);
    }

    return {
      id: d.id,
      label: d.label,
      attack: d.attack,
      score: Math.round(clamp(score) * 100),
      stars: starsFor(clamp(score)),
      band: bandOf(Math.round(clamp(score) * 100)),
      contributing: present,
      confirmedPublic: evidenced,
      // Confirmed-public attributes make a dimension *actionable*; stated-only
      // ones make it *plausible*. Saying which is honest and useful.
      basis: evidenced.length ? 'confirmed_public' : 'stated_only',
      explanation: d.explain(has),
    };
  }).sort((a, b) => b.score - a.score);

  const overall = Math.round(
    // The worst dimension dominates: someone at high SIM-swap risk is at high
    // risk, regardless of how clean the other seven look. Averaging would
    // dilute exactly the signal that matters.
    clamp(dimensions[0].score / 100 * 0.6 + mean(dimensions.map((d) => d.score / 100)) * 0.4) * 100,
  );

  return {
    overall,
    band: bandOf(overall),
    dimensions,
    inventory: inventoryOf(profile, live),
    impersonation: impersonationNarrative(dimensions, has),
    basis: confirmed.size ? 'confirmed_public' : 'stated_only',
    caveat: confirmed.size
      ? null
      : 'Based on what you told us, before any searching. It describes what someone could do if they found all of it — the investigation determines how much of it is already out there.',
  };
}

/**
 * What we actually know about, counted. Real numbers only — this is the panel
 * most tempting to seed with impressive-looking figures, and seeding it would
 * be the same lie as reporting a submitted request as a completed removal.
 */
function inventoryOf(profile, live) {
  const p = profile || {};
  return {
    names: (p.names || []).length,
    emails: (p.emails || []).length,
    phones: uniq((p.phones || []).map((x) => String(x.value).replace(/\D/g, '').slice(-10))).length,
    addresses: uniq((p.addresses || []).map((x) => x.value)).length,
    usernames: (p.usernames || []).length,
    relatives: (p.relatives || []).length,
    exposuresFound: live.length,
    sitesFound: uniq(live.map((e) => registrableDomain(e.url || ''))).filter(Boolean).length,
  };
}

/**
 * The plain-language "how someone would impersonate you" narrative.
 *
 * Written as a chain of steps rather than a list of risks, because that is how
 * the attack actually runs — and reading it as a sequence is what makes the
 * abstract danger land.
 */
export function impersonationNarrative(dimensions, has) {
  const steps = [];

  if (has('name') && (has('address') || has('age'))) {
    steps.push('Start with your name and narrow to the right person using your age and the city you live in.');
  }
  if (has('address')) {
    steps.push('Take your home address from a people-search listing — no payment or account needed on most of them.');
  }
  if (has('phone')) {
    steps.push('Pick up your phone number from the same record, or from a reverse-lookup directory indexed by number.');
  }
  if (has('relatives')) {
    steps.push('Note your relatives, which supplies both a pretext for a call and the answer to a security question.');
  }
  if (has('employer')) {
    steps.push('Add your employer, which makes an approach sound official and gives a plausible reason to be contacting you.');
  }

  const top = dimensions[0];
  const payoff = top && top.score >= 40
    ? `With that assembled, the most realistic move against you is: ${top.attack.toLowerCase().replace(/\.$/, '')}.`
    : 'There is not enough public material here to assemble a convincing impersonation.';

  return {
    steps,
    payoff,
    feasible: steps.length >= 3,
    summary: steps.length >= 3
      ? `Someone could do this in an afternoon, for free, without any technical skill. ${payoff}`
      : payoff,
  };
}

/* ----------------------------------------------------------------- utils */

/**
 * The attribute kinds implied by what the user told us. Mapped onto the same
 * vocabulary the page extractor emits, so stated and discovered attributes are
 * directly comparable.
 */
export function statedAttributes(profile) {
  const p = profile || {};
  const out = new Set();
  if (p.names?.length) out.add('name');
  if (p.emails?.length) out.add('email');
  if (p.phones?.length) out.add('phone');
  if (p.relatives?.length) out.add('relatives');
  if (p.employers?.length) out.add('employer');
  if (p.schools?.length) out.add('school');
  if (p.usernames?.length) out.add('username');
  if (p.profiles?.length) out.add('social_profile');
  if (p.birthYear) out.add('age');
  if (p.residence?.city) out.add('city');

  const streets = (p.addresses || []).filter((a) => /\d/.test(String(a.value)));
  if (streets.length) out.add('address');
  if (streets.length > 1) out.add('address_history');

  return out;
}

function starsFor(score) {
  return Math.max(1, Math.min(5, Math.round(score * 5))) * (score > 0.02 ? 1 : 0);
}

export function bandOf(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  if (score > 0) return 'low';
  return 'none';
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export { round };
