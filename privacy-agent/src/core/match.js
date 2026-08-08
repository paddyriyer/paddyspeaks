/**
 * Match confidence: does this page describe *our* user, or someone else?
 *
 * The governing rule is that a name match is nearly worthless on its own.
 * There are thousands of people sharing most names, and data brokers publish
 * pages for all of them. So a name contributes a little evidence and mostly
 * acts as a gate; the score is carried by the corroborating attributes —
 * address, phone, email, relatives, age, employer.
 *
 * Contradictions are treated asymmetrically and deliberately so. Finding a
 * matching address is good evidence. Finding a *different* age by 20 years is
 * much stronger evidence *against*, because a record's age is a single value
 * that cannot be quietly true alongside ours. Absence, though, is never
 * evidence: a listing that simply doesn't print a phone number is not a
 * mismatch, and must not be scored as one. Most naive matchers get this wrong
 * and end up rejecting sparse pages that are genuinely about the user.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { norm, squash, similarity, uniq, clamp, round } from './text.js';
import { parseName, phoneKey, addressKey, parseAddress, nicknamesFor } from './identity.js';

export const CLASSIFICATION = {
  CONFIRMED: 'confirmed',
  PROBABLE: 'probable',
  AMBIGUOUS: 'ambiguous',
  FALSE: 'false_match',
};

/**
 * Thresholds. `confirmed` is set high on purpose: everything at or above it is
 * acted on without asking, so the cost of being wrong is a removal request
 * filed against a stranger's record. Better to drop a real hit into
 * `ambiguous` and spend one question than to auto-submit a mistake.
 */
export const THRESHOLDS = {
  confirmed: 0.86,
  probable: 0.68,
  ambiguous: 0.4,
};

/**
 * Evidence weights. These are *relative* — the score is a weighted mean over
 * the attributes that were actually observable, not a sum, so a page carrying
 * only two attributes is not penalised for its brevity.
 */
const WEIGHTS = {
  name: 1.6,
  address: 3.0,
  phone: 3.4,
  email: 3.6,
  username: 1.2,
  relative: 2.2,
  age: 1.4,
  employer: 1.1,
  school: 0.8,
  profile: 2.0,
};

/** How hard a direct conflict pushes the score down, per attribute. */
const CONTRADICTION = {
  age: 0.55,
  address: 0.15,
  phone: 0.2,
  email: 0.25,
  relative: 0.1,
  name: 0.7,
};

/**
 * Score one extracted record against the identity profile.
 *
 * `record` is whatever the extractor could pull off the page:
 *   { names[], addresses[], phones[], emails[], usernames[], relatives[],
 *     ages[], employers[], schools[], profileUrls[] }
 *
 * Returns a score in 0..1, a classification, and human-readable evidence — the
 * evidence lines are what the user sees when we ask "Is this you?", so they
 * have to stand on their own without the page open.
 */
export function scoreMatch(record, profile, options = {}) {
  const rec = normalizeRecord(record);
  const signals = [];
  const conflicts = [];

  const name = matchNames(rec.names, profile);
  const address = matchAddresses(rec.addresses, profile);
  const phone = matchPhones(rec.phones, profile);
  const email = matchEmails(rec.emails, profile);
  const username = matchUsernames(rec.usernames, profile);
  const relative = matchRelatives(rec.relatives, profile);
  const age = matchAge(rec.ages, rec.birthYears, profile);
  const employer = matchSimpleList(rec.employers, profile.employers, 'employer');
  const school = matchSimpleList(rec.schools, profile.schools, 'school');
  const profileUrl = matchProfiles(rec.profileUrls, profile);

  const parts = { name, address, phone, email, username, relative, age, employer, school, profile: profileUrl };

  let weighted = 0;
  let totalWeight = 0;
  let corroborating = 0;

  for (const [key, result] of Object.entries(parts)) {
    if (!result || result.observed !== true) continue; // absence is not evidence
    const w = WEIGHTS[key] ?? 1;
    weighted += result.score * w;
    totalWeight += w;
    if (result.score >= 0.75) {
      signals.push(result.evidence);
      if (key !== 'name') corroborating += 1;
    } else if (result.score <= 0.2) {
      conflicts.push(result.evidence);
    }
  }

  if (totalWeight === 0) {
    return verdict(0, CLASSIFICATION.FALSE, ['No identifying attributes found on the page.'], [], parts, 0);
  }

  let score = weighted / totalWeight;

  // A page that matched on name alone, with nothing else to go on, cannot be
  // confirmed. This is the single most important clamp in the module — without
  // it every namesake in the country ends up "confirmed".
  const nameOnly = name.observed && name.score >= 0.75 && corroborating === 0;
  if (nameOnly) score = Math.min(score, THRESHOLDS.probable - 0.05);

  // Conversely, if the name is clearly a different person, no amount of
  // city-level agreement rescues it.
  if (name.observed && name.score <= 0.25) {
    score = Math.min(score, 0.3);
  }

  // Apply contradiction penalties.
  for (const [key, result] of Object.entries(parts)) {
    if (result?.observed && result.contradicted) {
      score -= CONTRADICTION[key] ?? 0.1;
    }
  }

  // Independent strong corroboration compounds: address *and* phone *and*
  // relatives agreeing is qualitatively different from any one of them.
  if (corroborating >= 3) score += 0.06;
  else if (corroborating >= 2) score += 0.03;

  score = clamp(score);

  const classification = classify(score, {
    nameOnly,
    corroborating,
    hasStrongIdentifier: [phone, email, address].some((r) => r.observed && r.score >= 0.85),
    ...options,
  });

  return verdict(score, classification, signals, conflicts, parts, corroborating);
}

function verdict(score, classification, signals, conflicts, parts, corroborating) {
  return {
    score: round(score, 3),
    classification,
    signals,
    conflicts,
    corroborating,
    attributes: Object.fromEntries(
      Object.entries(parts).map(([k, v]) => [k, v && v.observed ? { score: round(v.score, 3), evidence: v.evidence } : null]),
    ),
    explanation: explain(score, classification, signals, conflicts),
  };
}

/**
 * Turn a score into a bucket. A strong unique identifier (exact email or
 * phone) can confirm on its own — those are not shared between people the way
 * names are.
 */
export function classify(score, ctx = {}) {
  if (ctx.hasStrongIdentifier && score >= THRESHOLDS.probable) return CLASSIFICATION.CONFIRMED;
  if (score >= THRESHOLDS.confirmed) return CLASSIFICATION.CONFIRMED;
  if (score >= THRESHOLDS.probable) return CLASSIFICATION.PROBABLE;
  if (score >= THRESHOLDS.ambiguous) return CLASSIFICATION.AMBIGUOUS;
  return CLASSIFICATION.FALSE;
}

/** Plain-language summary — this is what the "Is this you?" prompt shows. */
export function explain(score, classification, signals, conflicts) {
  const pct = Math.round(score * 100);
  const lead = {
    [CLASSIFICATION.CONFIRMED]: `Almost certainly you (${pct}% confidence).`,
    [CLASSIFICATION.PROBABLE]: `Probably you (${pct}% confidence).`,
    [CLASSIFICATION.AMBIGUOUS]: `Might be you (${pct}% confidence) — worth a human look.`,
    [CLASSIFICATION.FALSE]: `Probably someone else (${pct}% confidence).`,
  }[classification];

  const bits = [lead];
  if (signals.length) bits.push(`Matches: ${signals.join('; ')}.`);
  if (conflicts.length) bits.push(`Doesn't match: ${conflicts.join('; ')}.`);
  if (!signals.length && !conflicts.length) bits.push('Too little information on the page to tell.');
  return bits.join(' ');
}

/* ------------------------------------------------------- per-attribute */

function result(observed, score, evidence, contradicted = false) {
  return { observed, score: clamp(score), evidence, contradicted };
}

const NONE = result(false, 0, '');

function matchNames(found, profile) {
  if (!found.length || !profile.names?.length) return NONE;
  let best = 0;
  let bestPair = null;

  for (const f of found) {
    for (const known of profile.names) {
      const s = compareNames(f, known.value);
      // A low-confidence known alias (a guessed nickname) can't fully vouch.
      const effective = s * (0.7 + 0.3 * known.confidence);
      if (effective > best) { best = effective; bestPair = [f, known.value]; }
    }
  }

  if (best >= 0.75) {
    return result(true, best, `name "${bestPair[0]}"`);
  }
  return result(true, best, `page name "${found[0]}" differs from yours`, best <= 0.25);
}

/**
 * Name comparison that understands the ways records legitimately differ:
 * middle names dropped, initials substituted, nicknames, reordering.
 */
export function compareNames(a, b) {
  const pa = parseName(a);
  const pb = parseName(b);
  if (!pa.first && !pa.last) return 0;
  if (!pb.first && !pb.last) return 0;

  const lastA = squash(pa.last) || squash(pa.first);
  const lastB = squash(pb.last) || squash(pb.first);
  const lastSim = lastA && lastB ? similarity(lastA, lastB) : 0;

  // Surname disagreement is close to fatal — it is the most stable part of a
  // record. We allow for typos and transliteration, not for a different name.
  if (lastSim < 0.7) return lastSim * 0.3;

  const firstA = squash(pa.first);
  const firstB = squash(pb.first);
  let firstScore;

  if (!firstA || !firstB) {
    firstScore = 0.5; // only a surname to go on
  } else if (firstA === firstB) {
    firstScore = 1;
  } else if (firstA.length === 1 || firstB.length === 1) {
    // Initial vs full name: "J Smith" vs "John Smith" is weak but consistent.
    firstScore = firstA[0] === firstB[0] ? 0.72 : 0.05;
  } else if (nicknamesFor(pa.first).some((n) => squash(n) === firstB)
          || nicknamesFor(pb.first).some((n) => squash(n) === firstA)) {
    firstScore = 0.92;
  } else {
    firstScore = similarity(firstA, firstB);
    if (firstScore < 0.8) firstScore *= 0.4; // different given name
  }

  // A middle initial that agrees is a small bonus; one that disagrees is a
  // small penalty. Never decisive — records drop middle names constantly.
  let middleAdj = 0;
  const miA = pa.middle.length ? squash(pa.middle[0])[0] : '';
  const miB = pb.middle.length ? squash(pb.middle[0])[0] : '';
  if (miA && miB) middleAdj = miA === miB ? 0.05 : -0.12;

  return clamp(lastSim * 0.45 + firstScore * 0.55 + middleAdj);
}

function matchAddresses(found, profile) {
  if (!found.length || !profile.addresses?.length) return NONE;
  const knownKeys = new Set(uniq((profile.keys?.addresses || []).filter(Boolean)));
  for (const a of profile.addresses || []) {
    const k = addressKey(a.value);
    if (k) knownKeys.add(k);
  }

  let best = 0;
  let bestValue = null;
  let sawCityOnly = false;

  for (const f of found) {
    const k = addressKey(f);
    if (k && knownKeys.has(k)) {
      best = 1;
      bestValue = f;
      break;
    }
    // Fall back to a looser comparison — city/state agreement is real but weak
    // evidence, so it is capped well below a street-level hit.
    const parsed = parseAddress(f);
    for (const known of profile.addresses) {
      const kp = parseAddress(known.value);
      if (parsed.city && kp.city && norm(parsed.city) === norm(kp.city)
        && (!parsed.state || !kp.state || parsed.state === kp.state)) {
        sawCityOnly = true;
        if (0.45 > best) { best = 0.45; bestValue = f; }
      }
      const s = similarity(f, known.value);
      if (s > best && s > 0.8) { best = s * 0.9; bestValue = f; }
    }
  }

  if (best >= 0.9) return result(true, best, `address "${bestValue}"`);
  if (sawCityOnly) return result(true, best, `same city (${bestValue})`);
  if (best > 0) return result(true, best, `similar address "${bestValue}"`);
  // Addresses were printed and none of them are ours. Weak contradiction only:
  // brokers list stale and partial addresses all the time.
  return result(true, 0.18, `listed address doesn't match any you gave`, false);
}

function matchPhones(found, profile) {
  if (!found.length) return NONE;
  const known = new Set(uniq((profile.phones || []).map((p) => phoneKey(p.value)).filter(Boolean)));
  if (!known.size) return NONE;

  for (const f of found) {
    if (known.has(phoneKey(f))) return result(true, 1, `phone ${maskPhone(f)}`);
  }
  // A different phone is genuinely mild evidence against — people have many.
  return result(true, 0.22, 'listed phone number is not one of yours');
}

function matchEmails(found, profile) {
  if (!found.length) return NONE;
  const known = new Set(uniq((profile.emails || []).map((e) => norm(e.value).replace(/\s/g, ''))));
  if (!known.size) return NONE;

  for (const f of found) {
    if (known.has(norm(f).replace(/\s/g, ''))) return result(true, 1, `email ${maskEmail(f)}`);
  }
  return result(true, 0.25, 'listed email is not one of yours');
}

function matchUsernames(found, profile) {
  if (!found.length || !profile.usernames?.length) return NONE;
  let best = 0;
  let bestValue = null;
  for (const f of found) {
    for (const known of profile.usernames) {
      if (squash(f) === squash(known.value)) {
        // A stated handle matching exactly is strong; a *derived* one matching
        // is not — we generated "jsmith" ourselves, so finding a "jsmith" out
        // there proves very little.
        const s = known.kind === 'username.stated' ? 1 : 0.55;
        if (s > best) { best = s; bestValue = f; }
      }
    }
  }
  if (best > 0) return result(true, best, `username "${bestValue}"`);
  return NONE; // unknown handles are not a contradiction
}

function matchRelatives(found, profile) {
  if (!found.length || !profile.relatives?.length) return NONE;
  const hits = [];
  for (const f of found) {
    for (const known of profile.relatives) {
      if (compareNames(f, known.value) >= 0.8) { hits.push(f); break; }
    }
  }
  if (hits.length >= 2) return result(true, 1, `relatives ${hits.slice(0, 3).join(', ')}`);
  if (hits.length === 1) return result(true, 0.82, `relative ${hits[0]}`);
  return result(true, 0.3, 'none of the listed relatives are ones you named');
}

/**
 * Age is the sharpest discriminator brokers publish, because it is a single
 * value. We compare against a *range* when the user only gave an approximate
 * age — otherwise "about 40" would conflict with a record that says 42.
 */
function matchAge(ages, birthYears, profile) {
  const by = profile.birthYear;
  if (!by) return NONE;
  const now = new Date().getUTCFullYear();

  const candidateYears = [
    ...birthYears.map(Number),
    ...ages.map((a) => now - Number(a)),
  ].filter((y) => Number.isFinite(y) && y > 1900 && y <= now);

  if (!candidateYears.length) return NONE;

  const min = by.min ?? by.value;
  const max = by.max ?? by.value;
  let bestDelta = Infinity;
  for (const y of candidateYears) {
    const delta = y < min ? min - y : y > max ? y - max : 0;
    if (delta < bestDelta) bestDelta = delta;
  }

  if (bestDelta === 0) return result(true, 1, `age matches (born ~${by.value})`);
  if (bestDelta <= 2) return result(true, 0.8, `age within ${bestDelta} year(s)`);
  if (bestDelta <= 5) return result(true, 0.45, `age off by ${bestDelta} years`);
  return result(true, 0.05, `age off by ${bestDelta} years`, true);
}

function matchSimpleList(found, known, label) {
  if (!found.length || !known?.length) return NONE;
  for (const f of found) {
    for (const k of known) {
      if (similarity(f, k.value) >= 0.85) return result(true, 1, `${label} "${f}"`);
    }
  }
  return result(true, 0.35, `different ${label} listed`);
}

function matchProfiles(found, profile) {
  if (!found.length || !profile.profiles?.length) return NONE;
  const known = new Set((profile.profiles || []).map((p) => norm(p.value)));
  for (const f of found) {
    if (known.has(norm(f))) return result(true, 1, `known profile ${f}`);
  }
  return NONE;
}

/* ----------------------------------------------------------------- utils */

/** Accept loose input from the extractor and give every field a real array. */
export function normalizeRecord(record) {
  const r = record || {};
  const arr = (v) => uniq(Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
  return {
    names: arr(r.names ?? r.name),
    addresses: arr(r.addresses ?? r.address),
    phones: arr(r.phones ?? r.phone),
    emails: arr(r.emails ?? r.email),
    usernames: arr(r.usernames ?? r.username),
    relatives: arr(r.relatives ?? r.relative),
    ages: arr(r.ages ?? r.age),
    birthYears: arr(r.birthYears ?? r.birthYear),
    employers: arr(r.employers ?? r.employer),
    schools: arr(r.schools ?? r.school),
    profileUrls: arr(r.profileUrls ?? r.profileUrl),
  };
}

/** Never print a full phone number in evidence shown on screen or in logs. */
export function maskPhone(p) {
  const d = String(p).replace(/\D/g, '');
  return d.length >= 4 ? `•••-•••-${d.slice(-4)}` : '••••';
}

export function maskEmail(e) {
  const s = String(e);
  const at = s.lastIndexOf('@');
  if (at < 1) return '•••';
  const local = s.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}${s.slice(at)}`;
}
