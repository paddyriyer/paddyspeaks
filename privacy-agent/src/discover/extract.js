/**
 * Extract personal information from a page (spec item 6).
 *
 * Input is whatever the browser gave us — visible text, the page title, and
 * optionally some structured data. Output is a record in the shape match.js
 * expects, plus the list of *field kinds* present, which is what the risk model
 * scores.
 *
 * The extractor is deliberately label-driven where it can be, and pattern-driven
 * only where it must be. Broker pages are generated from templates and almost
 * always print a label next to the value ("Age: 41", "Lives in:", "Related to:").
 * Reading the label is far more reliable than guessing from the shape of the
 * value, and it is the only way to tell an age from a house number.
 *
 * A note on what this does *not* try to do: it makes no attempt to defeat
 * paywalls, obfuscation, or "unlock the full report" gates. If a site hides the
 * data behind a payment, that is recorded as a payment demand (spec item 22),
 * not worked around.
 *
 * Pure module — no I/O, no DOM. Unit-tested in tests/run.mjs.
 */

import { uniq, norm, registrableDomain } from '../core/text.js';
import { US_STATES } from '../core/identity.js';

/* Patterns. Kept narrow — a greedy regex here becomes a false match later. */

const RE = {
  email: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
  phone: /(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g,
  // Street address: number, street words, then a suffix. Requires the suffix so
  // "Suite 400" and "Box 12" don't come through as addresses.
  address: /\b(\d{1,6})\s+((?:[A-Z0-9][\w'.-]*\s+){0,4}?)(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|circle|cir|place|pl|terrace|ter|parkway|pkwy|highway|hwy|way|trail|trl|square|sq|loop|run|path|plaza|plz)\b\.?/gi,
  cityStateZip: /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}),\s*([A-Z]{2})\b(?:\s+(\d{5})(?:-\d{4})?)?/g,
  ssnFragment: /\b(?:xxx|\*{3}|•{3})[- ]?(?:xx|\*{2}|•{2})[- ]?(\d{4})\b|\bssn\b.{0,20}\b\d{4}\b/gi,
  // Four phrasings, because age is the sharpest discriminator brokers publish
  // and missing it is expensive: a same-named stranger 25 years older sails
  // through as "might be you" when the one field that would have rejected him
  // was sitting right there in the snippet.
  //   "Age: 34"  ·  "34 years old"  ·  "is 34 and lives in"  ·  "Jain, 34, Austin"
  age: /\bage[d]?\s*[:\-]?\s*(\d{1,3})\b|\b(\d{1,3})\s*years?\s*old\b|\b(?:is|was)\s+(\d{1,3})\s+(?:and\b|years?\b|yrs?\b|of\b)|,\s*(\d{1,3})\s*,\s*(?:of\s+)?[A-Z]/gi,
  birthYear: /\b(?:born|d\.?o\.?b\.?|date of birth|birth\s*year)\b[^\d]{0,20}((?:19|20)\d{2})\b/gi,
  fullDob: /\b(?:born|d\.?o\.?b\.?|date of birth)\b[^\d]{0,20}(\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)\d{2})/gi,
  money: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g,
};

/**
 * Labelled sections. The regex captures the run of text after the label; the
 * caller decides how to parse it. Ordering matters only in that more specific
 * labels come first ("previous address" before "address").
 */
const LABELS = [
  { field: 'relatives', re: /\b(?:relatives?|related to|possible relatives?|family members?|associated persons?|known relatives?)\b\s*[:\-–]?\s*([^\n]{0,300})/gi },
  { field: 'associates', re: /\b(?:associates?|known associates?|possible associates?|neighbou?rs?)\b\s*[:\-–]?\s*([^\n]{0,300})/gi },
  { field: 'address_history', re: /\b(?:previous addresses?|past addresses?|address history|prior addresses?|previously lived (?:in|at))\b\s*[:\-–]?\s*([^\n]{0,400})/gi },
  { field: 'address', re: /\b(?:current address|home address|lives? (?:in|at)|address|resides? (?:in|at)|location)\b\s*[:\-–]?\s*([^\n]{0,200})/gi },
  { field: 'phone', re: /\b(?:phone|telephone|mobile|cell|contact number|phone numbers?)\b\s*[:\-–]?\s*([^\n]{0,200})/gi },
  { field: 'email', re: /\b(?:e-?mail|email address(?:es)?)\b\s*[:\-–]?\s*([^\n]{0,200})/gi },
  { field: 'employer', re: /\b(?:employer|works? (?:at|for)|company|employment|occupation|job title|position)\b\s*[:\-–]?\s*([^\n]{0,150})/gi },
  { field: 'school', re: /\b(?:school|college|university|alma mater|education|graduated (?:from)?)\b\s*[:\-–]?\s*([^\n]{0,150})/gi },
  { field: 'marital', re: /\b(?:marital status|spouse|married to|husband|wife)\b\s*[:\-–]?\s*([^\n]{0,120})/gi },
  { field: 'property', re: /\b(?:property (?:record|value|owned)|home value|owns? property|real estate|assessed value)\b\s*[:\-–]?\s*([^\n]{0,150})/gi },
  { field: 'vehicle', re: /\b(?:vehicles?|cars? owned|licen[cs]e plate|vin)\b\s*[:\-–]?\s*([^\n]{0,150})/gi },
  { field: 'income', re: /\b(?:income|salary|net worth|estimated income)\b\s*[:\-–]?\s*([^\n]{0,120})/gi },
  { field: 'criminal', re: /\b(?:criminal record|arrest record|offen[cs]e|conviction|sex offender|felony|misdemeanou?r)\b\s*[:\-–]?\s*([^\n]{0,200})/gi },
  { field: 'court', re: /\b(?:court record|case (?:number|no)|docket|lien|judgment|bankruptc)\w*\b\s*[:\-–]?\s*([^\n]{0,200})/gi },
];

/** Words that are never a person's name, however capitalised they look. */
const NOT_NAMES = new Set([
  'privacy policy', 'terms of service', 'contact us', 'about us', 'sign in',
  'log in', 'search results', 'view full', 'read more', 'united states',
  'all rights', 'background check', 'people search', 'public records',
  'phone number', 'email address', 'home address', 'social media', 'opt out',
  'do not sell', 'cookie policy', 'related to', 'lives in',
]);

/**
 * Main entry point.
 *
 * @param page { url, title, text, links[] }
 * @returns { record, fields, signals, paywalled }
 */
export function extractFromPage(page = {}) {
  const url = String(page.url || '');
  const title = String(page.title || '');
  const text = normalizeWhitespace(String(page.text || ''));
  const haystack = `${title}\n${text}`;

  const fields = new Set();
  const record = {
    names: [], addresses: [], phones: [], emails: [], usernames: [],
    relatives: [], ages: [], birthYears: [], employers: [], schools: [],
    profileUrls: [],
  };

  /* ---- labelled sections first: highest precision ---- */

  const labelled = {};
  for (const { field, re } of LABELS) {
    const values = matchAll(haystack, re).map((m) => (m[1] || '').trim()).filter(Boolean);
    if (values.length) {
      labelled[field] = values;
      fields.add(field);
    }
  }

  if (labelled.relatives) {
    record.relatives.push(...labelled.relatives.flatMap(splitPeopleList));
  }
  if (labelled.associates) fields.add('associates');
  if (labelled.employer) {
    record.employers.push(...labelled.employer.map(cleanValue).filter(plausibleOrg));
  }
  if (labelled.school) {
    record.schools.push(...labelled.school.map(cleanValue).filter(plausibleOrg));
  }
  if (labelled.address_history) fields.add('address_history');

  /* ---- pattern extraction across the whole page ---- */

  const emails = uniq(matchAll(haystack, RE.email).map((m) => m[0].toLowerCase()))
    .filter((e) => !isBoilerplateEmail(e, url));
  if (emails.length) { record.emails.push(...emails); fields.add('email'); }

  const phones = uniq(matchAll(haystack, RE.phone).map((m) => `${m[1]}${m[2]}${m[3]}`));
  if (phones.length) { record.phones.push(...phones); fields.add('phone'); }

  const addresses = uniq(matchAll(haystack, RE.address).map((m) => m[0].trim()));
  if (addresses.length) { record.addresses.push(...addresses); fields.add('address'); }

  // City/state pairs are worth keeping even with no street — they corroborate.
  const cityStates = uniq(
    matchAll(haystack, RE.cityStateZip)
      .filter((m) => Object.values(US_STATES).includes(m[2]))
      .map((m) => [m[1], m[2], m[3]].filter(Boolean).join(', ').replace(/,\s*(\d{5})$/, ' $1')),
  );
  if (cityStates.length) {
    record.addresses.push(...cityStates);
    fields.add('city');
    fields.add('state');
  }

  const ages = uniq(
    matchAll(haystack, RE.age)
      .map((m) => m[1] || m[2] || m[3] || m[4])
      .filter((a) => Number(a) >= 16 && Number(a) <= 110),
  );
  if (ages.length) { record.ages.push(...ages); fields.add('age'); }

  const birthYears = uniq(matchAll(haystack, RE.birthYear).map((m) => m[1]));
  if (birthYears.length) { record.birthYears.push(...birthYears); fields.add('age'); }

  if (RE.fullDob.test(haystack)) fields.add('birth_date');
  RE.fullDob.lastIndex = 0;

  if (RE.ssnFragment.test(haystack)) fields.add('ssn_fragment');
  RE.ssnFragment.lastIndex = 0;

  /* ---- names ---- */

  record.names.push(...extractNames(title, text));
  if (record.names.length) fields.add('name');
  if (record.relatives.length) fields.add('relatives');

  /* ---- profile links ---- */

  const links = (page.links || []).map(String);
  record.profileUrls.push(...links.filter(isSocialProfile));
  record.usernames.push(...links.flatMap(usernameFromProfileUrl));
  if (record.profileUrls.length) fields.add('social_profile');
  if (record.usernames.length) fields.add('username');

  if (/\b(photo|image|picture|headshot)\b/i.test(haystack) && /<img|\.jpg|\.png/i.test(String(page.html || ''))) {
    fields.add('photo');
  }

  return {
    record: Object.fromEntries(Object.entries(record).map(([k, v]) => [k, uniq(v)])),
    fields: [...fields],
    paywalled: detectPaywall(haystack),
    signals: {
      labelledFields: Object.keys(labelled),
      domain: registrableDomain(url),
    },
  };
}

/**
 * Names are the hardest thing on the page to get right, because every broker
 * page is *full* of capitalised words that are not names. Strategy: trust the
 * title (broker pages put the subject's name there), take headings, and take
 * anything sitting immediately before a strong "this is a person page" label.
 */
export function extractNames(title, text) {
  const out = [];

  // "John Smith - Age 41, Springfield IL | SomeSite.com"
  const fromTitle = String(title || '')
    .split(/[|–—\-–—,]/)[0]
    .trim();
  if (isPlausibleName(fromTitle)) out.push(fromTitle);

  // Names introduced by a possessive or a summary line.
  const patterns = [
    /\b([A-Z][a-z'’-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'’-]+(?:\s+(?:Jr|Sr|II|III|IV)\.?)?)\b(?=\s*(?:,\s*)?(?:is|was|age|lives|resides|of\s+[A-Z]))/g,
    /\b(?:full name|name|legal name)\b\s*[:\-–]\s*([A-Z][\w'’-]+(?:\s+[A-Z][\w'’.-]+){1,3})/gi,
  ];
  for (const re of patterns) {
    for (const m of matchAll(text, re)) {
      const candidate = (m[1] || '').trim();
      if (isPlausibleName(candidate)) out.push(candidate);
    }
  }

  return uniq(out).slice(0, 8);
}

export function isPlausibleName(s) {
  const v = String(s || '').trim();
  if (v.length < 4 || v.length > 60) return false;
  if (NOT_NAMES.has(norm(v))) return false;
  if (/\d/.test(v)) return false;
  if (/[@/\\|]/.test(v)) return false;
  const words = v.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Every word should start with a capital (allowing particles like "van").
  const particles = new Set(['van', 'von', 'de', 'del', 'della', 'da', 'di', 'la', 'le', 'du', 'bin', 'al']);
  return words.every((w) => /^[A-Z]/.test(w) || particles.has(w.toLowerCase()));
}

/** "John Smith, Mary Smith and Bob Smith" -> three names. */
export function splitPeopleList(value) {
  return String(value || '')
    .split(/[,;|]|\band\b|&|•/i)
    .map((s) => s.replace(/\(.*?\)/g, '').replace(/\b\d{1,3}\b/g, '').trim())
    .filter(isPlausibleName)
    .slice(0, 12);
}

function cleanValue(v) {
  return String(v || '').replace(/\s+/g, ' ').replace(/[.;,]$/, '').trim().slice(0, 120);
}

function plausibleOrg(v) {
  return v.length >= 2 && v.length <= 120 && !/^(n\/?a|unknown|none|not (available|listed))$/i.test(v);
}

/** Addresses and emails belonging to the *site*, not the person. */
function isBoilerplateEmail(email, url) {
  const local = email.split('@')[0];
  const domain = email.split('@')[1] || '';
  if (/^(info|support|contact|help|admin|webmaster|privacy|legal|sales|noreply|no-reply|abuse|postmaster|hello|team)$/i.test(local)) {
    return true;
  }
  // An address on the site's own domain is almost always the site's.
  return registrableDomain(domain) === registrableDomain(url || '');
}

const SOCIAL_HOSTS = /(?:linkedin\.com\/in|twitter\.com|x\.com|facebook\.com|instagram\.com|github\.com|reddit\.com\/user|tiktok\.com|medium\.com|pinterest\.com|youtube\.com\/(?:@|c\/|user\/)|about\.me|behance\.net|dribbble\.com|stackoverflow\.com\/users|gitlab\.com|mastodon)/i;

export function isSocialProfile(url) {
  const u = String(url || '');
  if (!SOCIAL_HOSTS.test(u)) return false;
  // Require a path segment beyond the host — bare "facebook.com" is a footer link.
  try {
    return new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

export function usernameFromProfileUrl(url) {
  if (!isSocialProfile(url)) return [];
  try {
    const parts = new URL(String(url)).pathname.split('/').filter(Boolean);
    const skip = new Set(['in', 'user', 'users', 'c', 'channel', 'profile', 'people']);
    const handle = parts.find((p) => !skip.has(p.toLowerCase()));
    if (!handle) return [];
    const cleaned = handle.replace(/^@/, '').split('?')[0];
    return cleaned.length >= 3 && cleaned.length <= 40 && !/\.(html?|php|aspx)$/i.test(cleaned)
      ? [cleaned]
      : [];
  } catch {
    return [];
  }
}

/**
 * Pull candidate exposures out of a pasted *search results* page.
 *
 * This exists because of a workflow failure worth naming: the console asked
 * users to open a search, then copy each result page individually. In practice
 * people run the search, see eight obvious broker listings, and stop — so the
 * board stays empty and the tool looks broken while the user is staring at
 * their own exposure.
 *
 * Pasting the results page turns that into one action. It is also better
 * evidence than it sounds: broker snippets are unusually informative, because
 * the snippet *is* the record ("Anjan Jain, 59, lives in Sunnyvale CA, related
 * to…"). That is frequently enough to score a match without opening the page
 * at all.
 *
 * Deliberately format-agnostic. Google, Bing and DuckDuckGo all paste
 * differently and all change their markup regularly, so rather than parse any
 * one of them we look for the shape every result has: a line carrying a
 * domain, with text around it.
 */
export function extractSearchResults(text, options = {}) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const results = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const domain = domainInLine(line);
    if (domain && !isSearchEngineChrome(domain)) {
      // A new result starts here. The title is usually the line above.
      if (current) results.push(current);
      const title = findTitle(lines, i);
      current = {
        domain,
        url: urlInLine(line) || `https://${domain}`,
        title,
        snippetLines: [],
      };
      continue;
    }

    if (current && !isChrome(line)) current.snippetLines.push(line);
  }
  if (current) results.push(current);

  const seen = new Set();
  return results
    .map((r) => ({
      domain: r.domain,
      url: r.url,
      title: r.title,
      snippet: r.snippetLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1200),
    }))
    // One entry per domain: a results page lists several pages from the same
    // broker, and they are the same underlying record.
    .filter((r) => {
      if (seen.has(r.domain)) return false;
      seen.add(r.domain);
      return true;
    })
    .filter((r) => (r.snippet + r.title).length > 20)
    .slice(0, options.limit ?? 30);
}

const DOMAIN_RE = /\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|co|us|info|biz|me|app|xyz|site|online|directory|search|records|report|uk|ca|au|in))\b/i;

function domainInLine(line) {
  // A full URL wins; otherwise a breadcrumb like "www.site.com › name › CA".
  const url = urlInLine(line);
  if (url) return registrableDomain(url);
  // Avoid matching prose that happens to contain a word with a dot.
  if (line.length > 160) return null;
  const m = line.match(DOMAIN_RE);
  if (!m) return null;
  // Breadcrumbs and bare domains sit near the start of their line.
  return m.index <= 60 ? registrableDomain(m[1]) : null;
}

function urlInLine(line) {
  const m = line.match(/https?:\/\/[^\s)>"']+/i);
  return m ? m[0] : null;
}

/** The search engine's own furniture, not a result. */
function isSearchEngineChrome(domain) {
  return /^(google|bing|duckduckgo|yahoo|ecosia|startpage|brave|youtube|gstatic|googleusercontent)\./i.test(`${domain}.`)
    || /^(google|bing|duckduckgo|yahoo)\b/i.test(domain);
}

function isChrome(line) {
  return /^(about \d|images|videos|news|maps|shopping|all|settings|tools|next|previous|page \d|people also ask|related searches|feedback|sign in|filters)$/i.test(line)
    || /^\d+ results?/i.test(line);
}

function findTitle(lines, domainIndex) {
  for (let i = domainIndex - 1; i >= Math.max(0, domainIndex - 3); i--) {
    const l = lines[i];
    if (l && l.length > 8 && l.length < 160 && !domainInLine(l) && !isChrome(l)) return l;
  }
  // Some engines put the title *below* the URL line.
  for (let i = domainIndex + 1; i < Math.min(lines.length, domainIndex + 3); i++) {
    const l = lines[i];
    if (l && l.length > 8 && l.length < 160 && !domainInLine(l) && !isChrome(l)) return l;
  }
  return '';
}

/** Spec item 22 — a page that wants money is flagged, never paid. */
export function detectPaywall(text) {
  const t = String(text || '');
  const signals = [
    /\bunlock (?:the )?(?:full|complete) report\b/i,
    /\b(?:start|begin) (?:your )?(?:\$?\d+(?:\.\d{2})?)?\s*(?:1|7|14)[- ]day trial\b/i,
    /\bsubscribe to (?:view|see|access)\b/i,
    /\bpremium (?:membership|removal|opt.?out)\b/i,
    /\b(?:expedited|priority|fast[- ]track) removal for \$/i,
    /\bpay(?:ment)? (?:is )?required to (?:remove|delete|opt.?out)\b/i,
  ];
  const hit = signals.find((re) => re.test(t));
  if (!hit) return null;
  const price = (t.match(RE.money) || [])[0] || null;
  return {
    detected: true,
    price,
    excerpt: (t.match(hit) || [])[0] || null,
  };
}

/* ----------------------------------------------------------------- utils */

function matchAll(text, re) {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const rx = new RegExp(re.source, flags);
  return [...String(text || '').matchAll(rx)];
}

function normalizeWhitespace(s) {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}
