/**
 * Identity normalization and permutation.
 *
 * Takes the raw seed answers from onboarding and expands them into every form
 * a data broker is plausibly storing them under: name orderings, initials,
 * nicknames, punctuation variants, phone formats, email aliases, address
 * abbreviations, username permutations.
 *
 * Every derived value carries a confidence, and confidence *decays* as we move
 * away from what the user actually told us. A phone number the user typed is
 * 1.0; the same number reformatted is 1.0 (it is the same number); a nickname
 * we guessed from a first name is 0.55, because plenty of Roberts have never
 * been called Bob. Downstream matching leans on these numbers, so an inflated
 * one here turns into a false positive there.
 *
 * Pure module — no I/O, no Node built-ins. Unit-tested in tests/run.mjs.
 */

import { norm, squash, titleCase, digits, uniq, clamp, round, fnv1a } from './text.js';

/** How much confidence a derivation keeps, relative to what it came from. */
export const DECAY = {
  exact: 1.0,        // same value, different formatting
  mechanical: 0.9,   // deterministic rewrite (initials, "Last, First")
  plausible: 0.7,    // likely but not guaranteed (email local part as username)
  speculative: 0.55, // a guess worth searching, never worth acting on alone
};

/**
 * Nicknames run both ways and are deliberately short. A bigger list mostly
 * adds noise: every extra alias is another search that costs time and can
 * surface a stranger. These are the ones that actually show up in US broker
 * records.
 */
const NICKNAMES = {
  robert: ['bob', 'rob', 'bobby', 'robbie'],
  richard: ['rick', 'dick', 'rich', 'ricky'],
  william: ['will', 'bill', 'billy', 'liam'],
  james: ['jim', 'jimmy', 'jamie'],
  john: ['jon', 'johnny', 'jack'],
  michael: ['mike', 'mikey', 'mick'],
  christopher: ['chris', 'topher'],
  matthew: ['matt'],
  joseph: ['joe', 'joey'],
  daniel: ['dan', 'danny'],
  thomas: ['tom', 'tommy'],
  charles: ['charlie', 'chuck'],
  anthony: ['tony'],
  edward: ['ed', 'eddie', 'ted'],
  steven: ['steve'], stephen: ['steve'],
  andrew: ['andy', 'drew'],
  benjamin: ['ben', 'benji'],
  nicholas: ['nick'],
  alexander: ['alex', 'xander'], alexandra: ['alex', 'sandra'],
  katherine: ['kate', 'kathy', 'katie'], catherine: ['cathy', 'kate', 'katie'],
  elizabeth: ['liz', 'beth', 'betty', 'eliza', 'lizzie'],
  jennifer: ['jen', 'jenny'],
  jessica: ['jess'],
  patricia: ['pat', 'patty', 'tricia'],
  margaret: ['maggie', 'peggy', 'meg'],
  deborah: ['deb', 'debbie'],
  rebecca: ['becky', 'becca'],
  susan: ['sue', 'susie'],
  barbara: ['barb'],
  victoria: ['vicky', 'tori'],
  samantha: ['sam'], samuel: ['sam'],
  timothy: ['tim'], theodore: ['ted', 'teddy'],
  gregory: ['greg'], jonathan: ['jon', 'john'],
  kenneth: ['ken', 'kenny'], ronald: ['ron', 'ronnie'],
  donald: ['don', 'donnie'], douglas: ['doug'],
  lawrence: ['larry'], raymond: ['ray'],
  vincent: ['vince'], francis: ['frank'], franklin: ['frank'],
  eugene: ['gene'], albert: ['al'], alfred: ['al', 'fred'],
  frederick: ['fred', 'freddie'], harold: ['harry'], henry: ['hank', 'harry'],
  peter: ['pete'], philip: ['phil'], phillip: ['phil'],
  zachary: ['zach'], jacob: ['jake'], joshua: ['josh'],
  nathaniel: ['nate', 'nathan'], gabriel: ['gabe'],
  cynthia: ['cindy'], dorothy: ['dot', 'dottie'],
  kimberly: ['kim'], michelle: ['shelly'], nancy: ['nan'],
  pamela: ['pam'], sandra: ['sandy'], stephanie: ['steph'],
  veronica: ['ronnie'], virginia: ['ginny'], amanda: ['mandy'],
  angela: ['angie'], christine: ['chris', 'christy'], danielle: ['dani'],
  gerald: ['jerry'], jeffrey: ['jeff'], melissa: ['mel'],
  natalie: ['nat'], olivia: ['liv'], theresa: ['terry', 'tess'],
  suresh: [], padmanabhan: ['paddy'], padma: ['paddy'],
};

/** Reverse index so "bob" also expands to "robert". */
const NICKNAME_REVERSE = (() => {
  const m = new Map();
  for (const [full, nicks] of Object.entries(NICKNAMES)) {
    for (const n of nicks) {
      if (!m.has(n)) m.set(n, []);
      m.get(n).push(full);
    }
  }
  return m;
})();

/** Particles that belong to the surname, not the middle name. */
const SURNAME_PARTICLES = new Set([
  'de', 'del', 'della', 'der', 'di', 'da', 'dos', 'du', 'la', 'le', 'van',
  'von', 'ter', 'ten', 'bin', 'ibn', 'al', 'st', 'san', 'santa', 'mac', 'mc',
]);

const GENERATIONAL = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'jnr', 'snr']);
const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'rev', 'sir', 'hon',
]);

/** Street suffixes, both directions. USPS-style, trimmed to what brokers use. */
export const STREET_SUFFIXES = {
  street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', lane: 'ln',
  boulevard: 'blvd', court: 'ct', circle: 'cir', place: 'pl', terrace: 'ter',
  parkway: 'pkwy', highway: 'hwy', trail: 'trl', way: 'way', square: 'sq',
  loop: 'loop', pike: 'pike', crossing: 'xing', ridge: 'rdg', point: 'pt',
  heights: 'hts', valley: 'vly', creek: 'crk', run: 'run', path: 'path',
  plaza: 'plz', commons: 'cmns', extension: 'ext',
};

export const DIRECTIONALS = {
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
};

export const UNIT_DESIGNATORS = {
  apartment: 'apt', suite: 'ste', unit: 'unit', building: 'bldg',
  floor: 'fl', room: 'rm', department: 'dept',
};

export const US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL',
  georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN',
  iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
  nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
  utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};

/** A single normalized value plus where it came from and how sure we are. */
export function variant(value, confidence, source, kind) {
  return {
    value: typeof value === 'string' ? value.trim() : value,
    confidence: round(clamp(confidence), 3),
    source,
    kind,
  };
}

/* ------------------------------------------------------------------ names */

/**
 * Split a display name into parts. Handles "Last, First M.", generational
 * suffixes, titles, and multi-token surnames held together by particles
 * ("van der Berg", "de la Cruz").
 */
export function parseName(input) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) return { first: '', middle: [], last: '', suffix: '', raw: '' };

  let working = raw.replace(/\s+/g, ' ');
  let suffix = '';

  // "Doe, John M." -> "John M. Doe"
  if (working.includes(',')) {
    const [head, ...rest] = working.split(',');
    const tail = rest.join(' ').trim();
    const tailFirst = norm(tail).split(' ')[0];
    if (GENERATIONAL.has(tailFirst)) {
      suffix = tail;
      working = head.trim();
    } else if (tail) {
      working = `${tail} ${head.trim()}`;
    }
  }

  let tokens = working.split(' ').filter(Boolean);

  // Drop leading titles.
  while (tokens.length > 1 && TITLES.has(norm(tokens[0]).replace(/\./g, ''))) {
    tokens.shift();
  }
  // Pull a trailing generational suffix off the end.
  while (tokens.length > 1 && GENERATIONAL.has(norm(tokens[tokens.length - 1]))) {
    suffix = tokens.pop();
  }

  if (tokens.length === 0) return { first: '', middle: [], last: '', suffix, raw };
  if (tokens.length === 1) {
    return { first: tokens[0], middle: [], last: '', suffix, raw };
  }

  // Walk back from the end collecting surname particles.
  let lastStart = tokens.length - 1;
  while (lastStart > 1 && SURNAME_PARTICLES.has(norm(tokens[lastStart - 1]))) {
    lastStart--;
  }

  return {
    first: tokens[0],
    middle: tokens.slice(1, lastStart),
    last: tokens.slice(lastStart).join(' '),
    suffix,
    raw,
  };
}

/**
 * Expand one name into the forms a record might use.
 *
 * `baseConfidence` is how sure we are this name belongs to the user at all —
 * a previous/maiden name the user volunteered is still 1.0, because they told
 * us; it is the *derivations* that decay.
 */
export function nameVariants(input, baseConfidence = 1, source = 'seed') {
  const p = parseName(input);
  if (!p.first && !p.last) return [];

  const out = [];
  const push = (v, c, kind) => {
    if (!v) return;
    const cleaned = String(v).replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) return;
    out.push(variant(cleaned, baseConfidence * c, source, kind));
  };

  const { first, middle, last, suffix } = p;
  const mid = middle.join(' ');
  const fi = first ? first[0].toUpperCase() : '';
  const mi = middle.length ? middle.map((m) => m[0].toUpperCase()) : [];

  push(p.raw, DECAY.exact, 'name.full');

  if (first && last) {
    push(`${first} ${last}`, DECAY.exact, 'name.first_last');
    push(`${last}, ${first}`, DECAY.mechanical, 'name.last_first');
    push(`${first} ${fi === last[0].toUpperCase() ? '' : ''}${last}`.replace(/\s+/g, ' '), DECAY.exact, 'name.first_last');

    if (mid) {
      push(`${first} ${mid} ${last}`, DECAY.exact, 'name.full');
      push(`${last}, ${first} ${mid}`, DECAY.mechanical, 'name.last_first');
      for (const initial of mi) {
        push(`${first} ${initial} ${last}`, DECAY.mechanical, 'name.middle_initial');
        push(`${first} ${initial}. ${last}`, DECAY.mechanical, 'name.middle_initial');
      }
    }

    push(`${fi} ${last}`, DECAY.mechanical, 'name.initial_last');
    push(`${fi}. ${last}`, DECAY.mechanical, 'name.initial_last');
    if (mi.length) {
      push(`${fi}${mi.join('')} ${last}`, DECAY.mechanical, 'name.initials_last');
      push(`${fi}.${mi.map((i) => `${i}.`).join('')} ${last}`, DECAY.mechanical, 'name.initials_last');
    }

    if (suffix) {
      push(`${first} ${last} ${suffix}`, DECAY.exact, 'name.with_suffix');
      push(`${first} ${last}, ${suffix}`, DECAY.mechanical, 'name.with_suffix');
    }

    // Punctuation variants — brokers are wildly inconsistent about these.
    const hyphenated = last.includes('-') ? last.replace(/-/g, ' ') : null;
    if (hyphenated) push(`${first} ${hyphenated}`, DECAY.mechanical, 'name.punct');
    const spacedLast = /\s/.test(last) ? last.replace(/\s+/g, '') : null;
    if (spacedLast) push(`${first} ${spacedLast}`, DECAY.mechanical, 'name.punct');
    if (last.includes("'")) push(`${first} ${last.replace(/'/g, '')}`, DECAY.mechanical, 'name.punct');

    // Nicknames, in both directions.
    for (const nick of nicknamesFor(first)) {
      push(`${nick} ${last}`, DECAY.speculative, 'name.nickname');
      if (mid) push(`${nick} ${mi[0]} ${last}`, DECAY.speculative, 'name.nickname');
    }
  } else if (first) {
    push(first, DECAY.exact, 'name.mononym');
  }

  return dedupeVariants(out);
}

/** Both directions: robert -> bob, and bob -> robert. */
export function nicknamesFor(firstName) {
  const key = norm(firstName);
  if (!key) return [];
  const out = [];
  for (const n of NICKNAMES[key] || []) out.push(titleCase(n));
  for (const full of NICKNAME_REVERSE.get(key) || []) out.push(titleCase(full));
  return uniq(out);
}

/* ----------------------------------------------------------------- phones */

/**
 * Expand a phone number into the formats forms and listings use. Everything
 * derived here is the *same number*, so nothing decays — a reformat cannot be
 * less true than the original.
 */
export function phoneVariants(input, baseConfidence = 1, source = 'seed') {
  const d = digits(input);
  if (d.length < 7) return [];

  // Normalize to a 10-digit US NANP number when we plausibly have one.
  let national = d;
  let country = '';
  if (d.length === 11 && d.startsWith('1')) { national = d.slice(1); country = '1'; }
  else if (d.length > 11) { national = d.slice(-10); country = d.slice(0, d.length - 10); }
  else if (d.length === 10) { country = '1'; }

  const out = [];
  const push = (v, c, kind) => out.push(variant(v, baseConfidence * c, source, kind));

  if (national.length === 10) {
    const a = national.slice(0, 3);
    const b = national.slice(3, 6);
    const c = national.slice(6);
    push(national, DECAY.exact, 'phone.digits');
    push(`(${a}) ${b}-${c}`, DECAY.exact, 'phone.formatted');
    push(`${a}-${b}-${c}`, DECAY.exact, 'phone.dashed');
    push(`${a}.${b}.${c}`, DECAY.exact, 'phone.dotted');
    push(`${a} ${b} ${c}`, DECAY.exact, 'phone.spaced');
    push(`+1${national}`, DECAY.exact, 'phone.e164');
    push(`+1 (${a}) ${b}-${c}`, DECAY.exact, 'phone.e164_formatted');
    push(`1-${a}-${b}-${c}`, DECAY.exact, 'phone.long_distance');
  } else {
    push(d, DECAY.exact, 'phone.digits');
    if (country) push(`+${d}`, DECAY.exact, 'phone.e164');
  }

  // Phones dedupe on the literal string, not the normalized one: "(415)
  // 555-0142" and "415-555-0142" normalize identically but are different
  // things to type into a form and different things to search for, so
  // collapsing them here would throw away formats we need later.
  return dedupeLiteral(out);
}

/** The canonical comparison key for a phone: last 10 digits (or all of them). */
export function phoneKey(input) {
  const d = digits(input);
  if (!d) return '';
  return d.length > 10 ? d.slice(-10) : d;
}

/* ----------------------------------------------------------------- emails */

/**
 * Expand an email into deliverable aliases and, separately, the username
 * candidates hiding in its local part. Gmail dot-and-plus equivalence is real
 * and worth searching; on other hosts it is a guess, so it decays.
 */
export function emailVariants(input, baseConfidence = 1, source = 'seed') {
  const raw = String(input == null ? '' : input).trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1 || at === raw.length - 1) return [];

  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const out = [];
  const push = (v, c, kind) => out.push(variant(v, baseConfidence * c, source, kind));

  push(raw, DECAY.exact, 'email.exact');

  const basePlus = local.split('+')[0];
  if (basePlus !== local) push(`${basePlus}@${domain}`, DECAY.exact, 'email.untagged');

  const gmailish = domain === 'gmail.com' || domain === 'googlemail.com';
  if (gmailish) {
    const undotted = basePlus.replace(/\./g, '');
    if (undotted !== basePlus) {
      push(`${undotted}@gmail.com`, DECAY.exact, 'email.gmail_undotted');
    }
    const other = domain === 'gmail.com' ? 'googlemail.com' : 'gmail.com';
    push(`${basePlus}@${other}`, DECAY.exact, 'email.gmail_alt_domain');
  } else if (basePlus.includes('.')) {
    push(`${basePlus.replace(/\./g, '')}@${domain}`, DECAY.speculative, 'email.undotted');
  }

  return dedupeVariants(out);
}

/** The username candidates implied by an email address. */
export function usernamesFromEmail(input, baseConfidence = 1, source = 'email') {
  const raw = String(input == null ? '' : input).trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return [];
  const local = raw.slice(0, at).split('+')[0];
  const out = [variant(local, baseConfidence * DECAY.plausible, source, 'username.email_local')];
  const stripped = local.replace(/[._-]/g, '');
  if (stripped !== local && stripped.length > 2) {
    out.push(variant(stripped, baseConfidence * DECAY.speculative, source, 'username.email_local'));
  }
  const noDigits = local.replace(/\d+$/, '');
  if (noDigits !== local && noDigits.length > 2) {
    out.push(variant(noDigits, baseConfidence * DECAY.speculative, source, 'username.email_local'));
  }
  return dedupeVariants(out);
}

/* --------------------------------------------------------------- usernames */

/**
 * Generate handle permutations from a name (+ optional birth year). These are
 * speculative by construction: "jsmith" belongs to a great many people. They
 * exist to be *searched*, and the match engine is expected to reject most of
 * what they turn up.
 */
export function usernameVariants(name, birthYear, baseConfidence = 1, source = 'derived') {
  const p = parseName(name);
  if (!p.first) return [];
  const f = squash(p.first);
  const l = squash(p.last);
  const mi = p.middle.length ? squash(p.middle[0])[0] : '';
  if (!f) return [];

  const stems = [];
  if (l) {
    stems.push(`${f}${l}`, `${f}.${l}`, `${f}_${l}`, `${f}-${l}`,
      `${f[0]}${l}`, `${l}${f[0]}`, `${f}${l[0]}`, `${l}${f}`, `${l}.${f}`);
    if (mi) stems.push(`${f}${mi}${l}`, `${f[0]}${mi}${l}`);
  } else {
    stems.push(f);
  }

  const out = [];
  for (const s of stems) {
    if (s.length < 3) continue;
    out.push(variant(s, baseConfidence * DECAY.speculative, source, 'username.derived'));
  }

  // Year suffixes are extremely common and cheap to try.
  const yr = Number(birthYear);
  if (Number.isFinite(yr) && yr > 1900 && yr < 2100 && l) {
    const two = String(yr).slice(-2);
    for (const s of [`${f}${l}`, `${f[0]}${l}`]) {
      out.push(variant(`${s}${yr}`, baseConfidence * DECAY.speculative * 0.9, source, 'username.derived_year'));
      out.push(variant(`${s}${two}`, baseConfidence * DECAY.speculative * 0.9, source, 'username.derived_year'));
    }
  }

  return dedupeVariants(out);
}

/* -------------------------------------------------------------- addresses */

/**
 * Parse a free-text US address into components. Deliberately forgiving: the
 * user typed this into a chat prompt, not a validated form, and a partial
 * parse still gives us something to search on.
 */
export function parseAddress(input) {
  const raw = String(input == null ? '' : input).trim().replace(/\s+/g, ' ');
  if (!raw) return { raw: '', line1: '', unit: '', city: '', state: '', zip: '' };

  let rest = raw;
  let zip = '';
  const zipMatch = rest.match(/\b(\d{5})(?:-\d{4})?\b\s*(?:USA?|United States)?\s*$/i);
  if (zipMatch) {
    zip = zipMatch[1];
    rest = rest.slice(0, zipMatch.index).trim().replace(/,\s*$/, '');
  }

  let state = '';
  const stateAbbrMatch = rest.match(/,?\s*\b([A-Za-z]{2})\b\s*$/);
  const stateNameMatch = rest.match(/,\s*([A-Za-z][A-Za-z\s]+)\s*$/);
  if (stateAbbrMatch && Object.values(US_STATES).includes(stateAbbrMatch[1].toUpperCase())) {
    state = stateAbbrMatch[1].toUpperCase();
    rest = rest.slice(0, stateAbbrMatch.index).trim().replace(/,\s*$/, '');
  } else if (stateNameMatch && US_STATES[norm(stateNameMatch[1])]) {
    state = US_STATES[norm(stateNameMatch[1])];
    rest = rest.slice(0, stateNameMatch.index).trim().replace(/,\s*$/, '');
  }

  const parts = rest.split(',').map((s) => s.trim()).filter(Boolean);
  let city = '';
  let streetPart = rest;
  if (parts.length >= 2) {
    city = parts[parts.length - 1];
    streetPart = parts.slice(0, -1).join(', ');
  }

  let unit = '';
  const unitMatch = streetPart.match(
    /\s(?:#|apt\.?|apartment|unit|ste\.?|suite|bldg\.?|building|fl\.?|floor|rm\.?|room)\s*([\w-]+)\s*$/i,
  );
  if (unitMatch) {
    unit = unitMatch[0].trim();
    streetPart = streetPart.slice(0, unitMatch.index).trim().replace(/,\s*$/, '');
  }

  return { raw, line1: streetPart, unit, city, state, zip };
}

/** Swap street suffixes / directionals / unit words between long and short. */
function rewriteAddressWords(line, direction) {
  const map = direction === 'abbrev'
    ? { ...STREET_SUFFIXES, ...DIRECTIONALS, ...UNIT_DESIGNATORS }
    : Object.fromEntries(
      Object.entries({ ...STREET_SUFFIXES, ...DIRECTIONALS, ...UNIT_DESIGNATORS })
        .map(([long, short]) => [short, long]),
    );
  return line
    .split(/(\s+)/)
    .map((tok) => {
      const bare = norm(tok);
      if (!bare || !(bare in map)) return tok;
      const replacement = map[bare];
      return /^[A-Z]/.test(tok.trim()) ? titleCase(replacement) : replacement;
    })
    .join('');
}

/**
 * Expand an address into the forms records use. Note that the *street-only*
 * and *city/state-only* variants are emitted too — brokers routinely list a
 * partial address, and a match on "1 Main St, Springfield" against a record
 * that only prints the street is still evidence.
 */
export function addressVariants(input, baseConfidence = 1, source = 'seed') {
  const a = parseAddress(input);
  if (!a.line1 && !a.city) return [];

  const out = [];
  const push = (v, c, kind) => {
    if (!v) return;
    out.push(variant(String(v).replace(/\s+/g, ' ').trim(), baseConfidence * c, source, kind));
  };

  const abbrev = rewriteAddressWords(a.line1, 'abbrev');
  const expanded = rewriteAddressWords(a.line1, 'expand');
  const cityState = [a.city, a.state].filter(Boolean).join(', ');

  push(a.raw, DECAY.exact, 'address.full');
  for (const l1 of uniq([a.line1, abbrev, expanded])) {
    push(l1, DECAY.exact, 'address.street');
    if (cityState) {
      push(`${l1}, ${cityState}`, DECAY.exact, 'address.street_city');
      if (a.zip) push(`${l1}, ${cityState} ${a.zip}`, DECAY.exact, 'address.full');
    }
    if (a.unit) push(`${l1} ${a.unit}`, DECAY.exact, 'address.street_unit');
  }
  if (cityState) push(cityState, DECAY.mechanical, 'address.city_state');
  if (a.city) push(a.city, DECAY.mechanical, 'address.city');
  if (a.zip) push(a.zip, DECAY.mechanical, 'address.zip');

  return dedupeVariants(out);
}

/**
 * Comparison key for an address: house number + first significant street word
 * + zip (or city). Suffix and directional words are dropped because that is
 * exactly where broker records disagree with each other.
 */
export function addressKey(input) {
  const a = parseAddress(input);
  const words = norm(a.line1).split(' ').filter(Boolean);
  const houseNumber = words.find((w) => /^\d+$/.test(w)) || '';
  const suffixWords = new Set([
    ...Object.keys(STREET_SUFFIXES), ...Object.values(STREET_SUFFIXES),
    ...Object.keys(DIRECTIONALS), ...Object.values(DIRECTIONALS),
  ]);
  const street = words.find((w) => !/^\d+$/.test(w) && !suffixWords.has(w)) || '';
  const locality = a.zip || norm(a.city);
  if (!houseNumber && !street) return '';
  return [houseNumber, street, locality].filter(Boolean).join('|');
}

/* ------------------------------------------------------------------ utils */

/** Collapse only byte-identical values. Used where formatting is meaningful. */
export function dedupeLiteral(list) {
  const best = new Map();
  for (const v of list || []) {
    if (!v || v.value == null || v.value === '') continue;
    const key = String(v.value);
    const existing = best.get(key);
    if (!existing || v.confidence > existing.confidence) best.set(key, v);
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Collapse duplicate values, keeping the highest confidence for each. */
export function dedupeVariants(list) {
  const best = new Map();
  for (const v of list || []) {
    if (!v || v.value == null || v.value === '') continue;
    const key = norm(String(v.value)) || String(v.value).toLowerCase();
    const existing = best.get(key);
    if (!existing || v.confidence > existing.confidence) best.set(key, v);
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build the full structured identity profile from raw onboarding answers.
 *
 * Anything the user skipped is simply absent — we never invent a value to fill
 * a gap. `approxAge` is honoured as a year range rather than a point, because
 * "about 40" against a listing that says 42 should corroborate, not conflict.
 */
export function buildProfile(seed = {}) {
  const s = seed || {};
  const names = [];
  const primaryName = s.fullName || '';

  if (primaryName) names.push(...nameVariants(primaryName, 1.0, 'seed.full_name'));
  for (const n of s.nameVariations || []) names.push(...nameVariants(n, 0.9, 'seed.name_variation'));
  for (const n of s.previousNames || []) names.push(...nameVariants(n, 0.95, 'seed.previous_name'));

  const emails = [];
  if (s.primaryEmail) emails.push(...emailVariants(s.primaryEmail, 1.0, 'seed.primary_email'));
  for (const e of s.alternateEmails || []) emails.push(...emailVariants(e, 0.95, 'seed.alt_email'));

  const phones = [];
  if (s.phone) phones.push(...phoneVariants(s.phone, 1.0, 'seed.phone'));
  for (const p of s.previousPhones || []) phones.push(...phoneVariants(p, 0.9, 'seed.previous_phone'));

  const addresses = [];
  if (s.address) addresses.push(...addressVariants(s.address, 1.0, 'seed.address'));
  for (const a of s.previousAddresses || []) {
    addresses.push(...addressVariants(a, 0.9, 'seed.previous_address'));
  }
  if (s.cityState) addresses.push(...addressVariants(s.cityState, 0.85, 'seed.city_state'));

  const usernames = [];
  for (const u of s.usernames || []) {
    usernames.push(variant(u, 1.0, 'seed.username', 'username.stated'));
  }
  if (s.primaryEmail) usernames.push(...usernamesFromEmail(s.primaryEmail, 1.0));
  for (const e of s.alternateEmails || []) usernames.push(...usernamesFromEmail(e, 0.9));
  if (primaryName) usernames.push(...usernameVariants(primaryName, s.birthYear, 1.0));

  const birthYear = deriveBirthYear(s);

  return {
    id: fnv1a(`${norm(primaryName)}|${norm(s.primaryEmail || '')}|${phoneKey(s.phone || '')}`),
    createdAt: new Date().toISOString(),
    display: { name: primaryName || '(unnamed)' },
    names: dedupeVariants(names),
    emails: dedupeVariants(emails),
    phones: dedupeLiteral(phones),
    addresses: dedupeVariants(addresses),
    usernames: dedupeVariants(usernames),
    employers: dedupeVariants((s.employers || []).map((e) => variant(e, 0.95, 'seed.employer', 'employer'))),
    schools: dedupeVariants((s.schools || []).map((e) => variant(e, 0.9, 'seed.school', 'school'))),
    relatives: dedupeVariants((s.relatives || []).map((r) => variant(r, 0.95, 'seed.relative', 'relative'))),
    profiles: dedupeVariants((s.profiles || []).map((p) => variant(p, 1.0, 'seed.profile', 'profile'))),
    birthYear,
    residence: residenceOf(s),
    keys: {
      phones: uniq((s.previousPhones || []).concat(s.phone || []).map(phoneKey)),
      addresses: uniq((s.previousAddresses || []).concat(s.address || []).map(addressKey)),
      emails: uniq([s.primaryEmail, ...(s.alternateEmails || [])].map((e) => norm(e))),
    },
  };
}

/** Birth year as a range, from an explicit year or an approximate age. */
function deriveBirthYear(s) {
  const now = new Date().getUTCFullYear();
  if (s.birthYear && Number(s.birthYear) > 1900) {
    const y = Number(s.birthYear);
    return { value: y, min: y, max: y, confidence: 1.0, source: 'seed.birth_year' };
  }
  if (s.approxAge && Number(s.approxAge) > 0) {
    const age = Number(s.approxAge);
    // "About 40" realistically covers a few years either way.
    return {
      value: now - age,
      min: now - age - 3,
      max: now - age + 3,
      confidence: 0.7,
      source: 'seed.approx_age',
    };
  }
  return null;
}

function residenceOf(s) {
  const a = parseAddress(s.address || s.cityState || '');
  return {
    city: a.city || '',
    state: a.state || '',
    zip: a.zip || '',
    country: s.country || (a.state ? 'US' : ''),
  };
}

/** Every value in the profile, flattened — used by the log redactor. */
export function allSensitiveValues(profile) {
  if (!profile) return [];
  const groups = ['names', 'emails', 'phones', 'addresses', 'usernames', 'relatives'];
  const out = [];
  for (const g of groups) {
    for (const v of profile[g] || []) {
      if (typeof v.value === 'string' && v.value.length >= 4) out.push({ kind: g, value: v.value });
    }
  }
  return out;
}
