/**
 * Search query generation (spec items 4, 5, 8, 43).
 *
 * There is deliberately **no list of data brokers anywhere in this file**, or
 * anywhere else in the project. Hardcoding one is the standard shortcut and it
 * fails in exactly the way that matters: it finds the sites everybody already
 * knows about and misses the long tail — the regional directory, the church
 * newsletter PDF, the HOA roster, the forum profile — which is usually where
 * the genuinely surprising exposure lives.
 *
 * Instead we search for *the person*, from every angle we have an identifier
 * for, and let discovery tell us which sites exist. That is slower and it is
 * the whole point.
 *
 * Query kinds are prioritised because the request budget is finite. An
 * exact-phrase search on a full phone number is worth far more per request
 * than a bare name search, so it runs first.
 *
 * Pure module — no I/O. Unit-tested in tests/run.mjs.
 */

import { uniq, clamp, round, fnv1a, registrableDomain } from './text.js';
import { parseAddress } from './identity.js';

/**
 * Priority per query kind, 0..1. Higher runs first.
 *
 * The ordering encodes selectivity: identifiers that are close to unique to one
 * person (phone, email) beat identifiers thousands of people share (name).
 */
export const KIND_PRIORITY = {
  email_exact: 1.0,
  phone_exact: 0.98,
  name_address: 0.95,
  name_phone: 0.93,
  address_exact: 0.88,
  username_exact: 0.82,
  name_relative: 0.8,
  profile_url: 0.78,
  name_city_age: 0.75,
  name_employer: 0.7,
  name_city: 0.65,
  name_document: 0.6,
  domain_reverse: 0.55,
  name_bare: 0.4,
};

/** Sites whose results are pure noise for this purpose. */
const EXCLUDE_HOSTS = [
  'wikipedia.org', 'wiktionary.org', 'imdb.com', 'youtube.com',
  'amazon.com', 'ebay.com', 'pinterest.com', 'reddit.com/r/all',
];

/**
 * Build the full prioritised query set from the identity graph.
 *
 * `options.budget` caps the number of queries returned — the caller runs them
 * in order and comes back for more once new identifiers have been discovered.
 */
export function buildQueries(graph, profile, options = {}) {
  const budget = options.budget ?? 120;
  const includeDocuments = options.includeDocuments !== false;
  const includeArchives = options.includeArchives !== false;

  const names = topValues(graph, 'name', 6);
  const emails = topValues(graph, 'email', 6);
  const phones = topValues(graph, 'phone', 6);
  const addresses = topValues(graph, 'address', 6);
  const usernames = topValues(graph, 'username', 8);
  const relatives = topValues(graph, 'relative', 5);
  const employers = topValues(graph, 'employer', 3);
  const profiles = topValues(graph, 'profile', 5);
  const domains = topValues(graph, 'domain', 3);

  const city = profile?.residence?.city || '';
  const state = profile?.residence?.state || '';
  const cityState = [city, state].filter(Boolean).join(' ');
  const birthYear = profile?.birthYear?.value;

  const out = [];
  const add = (text, kind, sourceNode, extra = {}) => {
    if (!text || String(text).trim().length < 3) return;
    out.push(makeQuery(text, kind, sourceNode, extra));
  };

  /* --- identifier-only searches. These are the ones people forget to run, and
     they are the highest-yield queries in the whole set (spec item 5). --- */

  for (const e of emails) add(`"${e.value}"`, 'email_exact', e);

  for (const p of phones) {
    // Search several formats: engines index the punctuation as written, so a
    // digits-only query genuinely misses pages that print "(555) 123-4567".
    for (const form of phoneSearchForms(p.value)) {
      add(`"${form}"`, 'phone_exact', p);
    }
  }

  for (const a of addresses) {
    const parsed = parseAddress(a.value);
    if (parsed.line1 && /\d/.test(parsed.line1)) {
      add(`"${parsed.line1}" ${[parsed.city, parsed.state].filter(Boolean).join(' ')}`.trim(),
        'address_exact', a);
    }
  }

  for (const u of usernames) {
    if (String(u.value).length >= 4) add(`"${u.value}"`, 'username_exact', u);
  }

  for (const p of profiles) add(`"${p.value}"`, 'profile_url', p);

  /* --- contextual combinations --- */

  for (const n of names) {
    const name = `"${n.value}"`;

    for (const a of addresses.slice(0, 3)) {
      const parsed = parseAddress(a.value);
      if (parsed.line1) add(`${name} "${parsed.line1}"`, 'name_address', n);
      else if (parsed.city) add(`${name} "${parsed.city}"`, 'name_city', n);
    }

    for (const p of phones.slice(0, 3)) {
      add(`${name} "${formatPhoneForSearch(p.value)}"`, 'name_phone', n);
    }

    for (const r of relatives.slice(0, 4)) {
      add(`${name} "${r.value}"`, 'name_relative', n);
    }

    for (const emp of employers) {
      add(`${name} "${emp.value}"`, 'name_employer', n);
    }

    if (cityState) {
      add(`${name} ${cityState}`, 'name_city', n);
      if (birthYear) {
        const age = new Date().getUTCFullYear() - birthYear;
        if (age > 0 && age < 120) add(`${name} ${cityState} age ${age}`, 'name_city_age', n);
      }
    }

    // Documents and archives — spec item 5 calls these out explicitly, and
    // they are where stale rosters and membership lists surface.
    if (includeDocuments) {
      add(`${name} filetype:pdf`, 'name_document', n);
      add(`${name} ${cityState} filetype:pdf`.trim(), 'name_document', n);
      add(`${name} filetype:xlsx OR filetype:doc OR filetype:csv`, 'name_document', n);
    }
    if (includeArchives) {
      add(`${name} ${cityState} directory OR roster OR members`.trim(), 'name_document', n);
    }

    add(name, 'name_bare', n);
  }

  // Reverse lookups on a personal domain: who else does it point at.
  for (const d of domains) {
    add(`"${d.value}" contact OR whois OR registrant`, 'domain_reverse', d);
  }

  return rank(out).slice(0, budget);
}

/**
 * Incremental queries for a newly discovered identifier (spec item 8).
 *
 * Called every time the graph grows. This is what makes discovery recursive
 * rather than a single pass.
 */
export function queriesForNode(node, graph, profile, options = {}) {
  const budget = options.budget ?? 12;
  const out = [];
  const add = (text, kind, extra = {}) => {
    if (text && String(text).trim().length >= 3) out.push(makeQuery(text, kind, node, extra));
  };

  const primaryName = topValues(graph, 'name', 1)[0]?.value;
  const cityState = [profile?.residence?.city, profile?.residence?.state].filter(Boolean).join(' ');

  switch (node.type) {
    case 'phone':
      for (const form of phoneSearchForms(node.value)) add(`"${form}"`, 'phone_exact');
      if (primaryName) add(`"${primaryName}" "${formatPhoneForSearch(node.value)}"`, 'name_phone');
      break;
    case 'email':
      add(`"${node.value}"`, 'email_exact');
      if (primaryName) add(`"${primaryName}" "${node.value}"`, 'email_exact');
      break;
    case 'address': {
      const parsed = parseAddress(node.value);
      if (parsed.line1) {
        add(`"${parsed.line1}" ${[parsed.city, parsed.state].filter(Boolean).join(' ')}`.trim(), 'address_exact');
        if (primaryName) add(`"${primaryName}" "${parsed.line1}"`, 'name_address');
      }
      break;
    }
    case 'username':
      add(`"${node.value}"`, 'username_exact');
      add(`"${node.value}" profile`, 'username_exact');
      break;
    case 'name':
      add(`"${node.value}" ${cityState}`.trim(), 'name_city');
      add(`"${node.value}" filetype:pdf`, 'name_document');
      if (cityState) add(`"${node.value}" ${cityState} address phone`, 'name_address');
      break;
    case 'relative':
      if (primaryName) add(`"${primaryName}" "${node.value}"`, 'name_relative');
      add(`"${node.value}" ${cityState}`.trim(), 'name_city');
      break;
    case 'employer':
      if (primaryName) add(`"${primaryName}" "${node.value}"`, 'name_employer');
      break;
    case 'profile':
      add(`"${node.value}"`, 'profile_url');
      break;
    case 'domain':
      add(`"${node.value}" contact OR registrant`, 'domain_reverse');
      break;
    default:
      break;
  }

  return rank(out).slice(0, budget);
}

/**
 * Follow-up queries used after a removal (spec item 32) — re-run the
 * highest-selectivity originals to catch mirrors, caches and republication.
 */
export function recheckQueries(graph, profile, options = {}) {
  const all = buildQueries(graph, profile, { ...options, budget: 400 });
  const wanted = new Set(['email_exact', 'phone_exact', 'address_exact', 'name_address', 'username_exact']);
  return all.filter((q) => wanted.has(q.kind)).slice(0, options.budget ?? 40);
}

/* ----------------------------------------------------------------- utils */

function makeQuery(text, kind, sourceNode, extra = {}) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  // Confidence of the identifier feeds the priority: searching a guessed
  // nickname should not outrank searching a phone number the user gave us.
  const nodeConfidence = sourceNode?.confidence ?? 1;
  const priority = clamp((KIND_PRIORITY[kind] ?? 0.5) * (0.5 + 0.5 * nodeConfidence));
  return {
    id: `q_${fnv1a(`${kind}:${cleaned.toLowerCase()}`)}`,
    text: cleaned,
    kind,
    priority: round(priority, 3),
    sourceNodeKey: sourceNode?.key || null,
    sourceDepth: sourceNode?.depth ?? 0,
    exclude: EXCLUDE_HOSTS,
    ...extra,
  };
}

function rank(queries) {
  const seen = new Set();
  const out = [];
  for (const q of [...queries].sort((a, b) => b.priority - a.priority || a.text.localeCompare(b.text))) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

function topValues(graph, type, n) {
  if (!graph) return [];
  return graph.byType(type)
    .filter((node) => node.confidence >= (graph.minConfidence ?? 0.45))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/** The written forms of a phone number that search engines actually index. */
export function phoneSearchForms(value) {
  const d = String(value).replace(/\D/g, '');
  const national = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (national.length !== 10) return uniq([d]);
  const a = national.slice(0, 3);
  const b = national.slice(3, 6);
  const c = national.slice(6);
  return [`(${a}) ${b}-${c}`, `${a}-${b}-${c}`, `${a}.${b}.${c}`, national];
}

export function formatPhoneForSearch(value) {
  return phoneSearchForms(value)[0];
}

/**
 * Has discovery converged? (spec item 43)
 *
 * The rule: stop when recent rounds stop producing *new* exposures and *new*
 * identifiers. Not when a page count is hit, and not when a fixed site list is
 * exhausted — those both stop early on exactly the users who need it most.
 */
export function hasConverged(rounds, options = {}) {
  const window = options.window ?? 3;
  const minRounds = options.minRounds ?? 3;
  if (rounds.length < minRounds) return { converged: false, reason: 'too few rounds so far' };

  const recent = rounds.slice(-window);
  const newExposures = recent.reduce((n, r) => n + (r.newExposures || 0), 0);
  const newIdentifiers = recent.reduce((n, r) => n + (r.newIdentifiers || 0), 0);

  if (newExposures === 0 && newIdentifiers === 0) {
    return {
      converged: true,
      reason: `the last ${recent.length} rounds of searching turned up no new exposures and no new identifiers`,
    };
  }
  return {
    converged: false,
    reason: `still finding things — ${newExposures} new exposures and ${newIdentifiers} new identifiers in the last ${recent.length} rounds`,
  };
}

export { registrableDomain };
