/**
 * Duplicate detection (spec item 9).
 *
 * The same underlying record shows up two ways, and they need different
 * handling:
 *
 *   Within one site — a broker will publish /john-smith/CA/12345 and
 *   /john-smith-2 and /people/john-smith?id=99 for one person. Opting out once
 *   usually clears all of them, so treating these as three exposures inflates
 *   the numbers and triples the work.
 *
 *   Across sites — most people-search sites resell the same upstream feed, so
 *   the identical record appears on a dozen domains. These are *not* redundant:
 *   each needs its own removal. But the user should be told they are copies of
 *   one record, because that reframes "47 exposures" into "one record, resold
 *   47 times", which is both truer and less alarming.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { norm, uniq, fnv1a, registrableDomain } from './text.js';
import { phoneKey, addressKey, parseName } from './identity.js';

/**
 * A content fingerprint for one extracted record. Built from the stable,
 * high-signal parts only — deliberately ignoring page title, layout and the
 * order fields happen to appear in, all of which vary between resellers of the
 * same data.
 */
export function recordFingerprint(record) {
  const r = record || {};
  const name = (r.names || []).map((n) => {
    const p = parseName(n);
    return norm(`${p.first} ${p.last}`);
  }).filter(Boolean).sort()[0] || '';

  const phones = uniq((r.phones || []).map(phoneKey)).sort().slice(0, 3);
  const addresses = uniq((r.addresses || []).map(addressKey)).filter(Boolean).sort().slice(0, 3);
  const age = (r.ages || [])[0] || (r.birthYears || [])[0] || '';

  const material = [name, phones.join(','), addresses.join(','), String(age)].join('|');
  return { key: fnv1a(material), material, name, phones, addresses, age: String(age) };
}

/**
 * Do two records describe the same underlying entry?
 *
 * Requires agreement on identity *and* at least one hard identifier. Name-only
 * agreement is not enough — that is how you merge two different people into one
 * "duplicate group" and then file a removal against the wrong one.
 */
export function sameRecord(a, b) {
  const fa = recordFingerprint(a);
  const fb = recordFingerprint(b);
  if (fa.key === fb.key) return true;
  if (!fa.name || !fb.name || fa.name !== fb.name) return false;

  const phoneOverlap = fa.phones.some((p) => p && fb.phones.includes(p));
  const addressOverlap = fa.addresses.some((x) => x && fb.addresses.includes(x));
  const ageAgrees = fa.age && fb.age && Math.abs(Number(fa.age) - Number(fb.age)) <= 1;

  return phoneOverlap || addressOverlap || (ageAgrees && (fa.addresses.length === 0 || fb.addresses.length === 0));
}

/**
 * Group exposures into clusters that refer to one underlying record.
 *
 * Each group is annotated with `withinSite` (same domain — usually one opt-out
 * clears them all) and `acrossSites` (separate removals required).
 */
export function groupDuplicates(exposures = []) {
  const groups = [];

  for (const exposure of exposures) {
    const target = groups.find((g) => g.members.some((m) => sameRecord(m.record, exposure.record)));
    if (target) {
      target.members.push(exposure);
    } else {
      groups.push({ members: [exposure] });
    }
  }

  return groups.map((g, i) => {
    const domains = uniq(g.members.map((m) => registrableDomain(m.url || '')));
    const byDomain = new Map();
    for (const m of g.members) {
      const d = registrableDomain(m.url || '');
      if (!byDomain.has(d)) byDomain.set(d, []);
      byDomain.get(d).push(m);
    }

    const withinSite = [...byDomain.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([domain, list]) => ({ domain, urls: list.map((m) => m.url), count: list.length }));

    const fp = recordFingerprint(g.members[0]?.record);
    const primary = pickPrimary(g.members);

    return {
      id: `grp_${fnv1a(`${fp.key}:${i}`)}`,
      fingerprint: fp.key,
      label: fp.name || '(unidentified record)',
      members: g.members,
      count: g.members.length,
      domains,
      withinSite,
      acrossSites: domains.length,
      primaryUrl: primary?.url || null,
      summary: summarize(g.members.length, domains.length, withinSite),
    };
  });
}

/** The member we act on first: richest record on the highest-confidence page. */
function pickPrimary(members) {
  return [...members].sort((a, b) => {
    const fa = Object.values(a.record || {}).flat().filter(Boolean).length;
    const fb = Object.values(b.record || {}).flat().filter(Boolean).length;
    if (fb !== fa) return fb - fa;
    return (b.matchScore || 0) - (a.matchScore || 0);
  })[0];
}

function summarize(count, domainCount, withinSite) {
  if (count === 1) return 'A single listing.';
  const bits = [];
  if (domainCount > 1) {
    bits.push(`The same record appears on ${domainCount} different sites — they resell the same underlying data, so each one needs its own removal.`);
  }
  const dupPages = withinSite.reduce((n, w) => n + w.count, 0);
  if (dupPages > 0) {
    bits.push(`${dupPages} of these are duplicate pages on ${withinSite.length === 1 ? withinSite[0].domain : `${withinSite.length} sites`}; one opt-out there usually clears all of them.`);
  }
  return bits.join(' ') || `${count} related listings.`;
}

/**
 * Reappearance check (spec items 32–33).
 *
 * After a removal, a record that shows up again is either the *same* site
 * re-listing (the removal failed or was reversed) or a *different* site that
 * picked it up from an upstream feed. The second case is a new exposure with a
 * lead attached — the upstream source is worth chasing, because killing it
 * stops the record coming back.
 */
export function detectReappearance(removed, current) {
  const out = [];
  for (const now of current || []) {
    for (const before of removed || []) {
      if (!sameRecord(before.record, now.record)) continue;
      const sameDomain = registrableDomain(before.url || '') === registrableDomain(now.url || '');
      out.push({
        kind: sameDomain ? 'relisted' : 'republished',
        original: before,
        reappeared: now,
        note: sameDomain
          ? `${registrableDomain(now.url)} has re-listed a record you already had removed. This usually means the opt-out expired or the record was re-imported — refile and check for a permanent suppression option.`
          : `A record removed from ${registrableDomain(before.url)} has resurfaced on ${registrableDomain(now.url)}. These sites share an upstream feed; removing it here without finding the source means it will keep coming back.`,
        investigateUpstream: !sameDomain,
      });
      break;
    }
  }
  return out;
}
