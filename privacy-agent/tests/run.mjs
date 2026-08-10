/**
 * Dependency-free test runner, in the house style (see analytics/tests/run.mjs).
 *
 *   node privacy-agent/tests/run.mjs
 *
 * Everything tested here is pure logic — the identity engine, matching, risk,
 * dedupe, state machine, redaction, jurisdiction, field classification and the
 * workflow-template PII guard. The browser and network layers are not mocked
 * out and re-tested; what matters about them (that they stop rather than guess)
 * lives in the pure helpers that ARE tested: parseConfirmation,
 * parseVerificationNeed, planFill, detectPaywall, assertNoPii.
 */

import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildProfile, parseName, nameVariants, phoneVariants, emailVariants,
  usernameVariants, parseAddress, addressVariants, addressKey, phoneKey,
  nicknamesFor, dedupeVariants,
} from '../src/core/identity.js';
import { norm, squash, similarity, registrableDomain, fnv1a } from '../src/core/text.js';
import { IdentityGraph, nodeKey } from '../src/core/graph.js';
import { scoreMatch, compareNames, classify, CLASSIFICATION, THRESHOLDS, maskEmail, maskPhone } from '../src/core/match.js';
import { riskOf, exposureScore, prioritize, bandOf } from '../src/core/risk.js';
import { recordFingerprint, sameRecord, groupDuplicates, detectReappearance } from '../src/core/dedupe.js';
import { STATE, canTransition, transition, summarize } from '../src/core/states.js';
import { createRedactor } from '../src/core/redact.js';
import { detectJurisdiction, preferredChoices } from '../src/core/jurisdiction.js';
import { classifyRemovability, CATEGORY, siteKindFor } from '../src/core/removability.js';
import { buildQueries, queriesForNode, hasConverged, phoneSearchForms } from '../src/core/queries.js';
import { classifyField, planFill, matchOption } from '../src/browser/fields.js';
import { extractFromPage, extractNames, isPlausibleName, splitPeopleList, detectPaywall, usernameFromProfileUrl } from '../src/discover/extract.js';
import { parseConfirmation, parseVerificationNeed } from '../src/removal/parse.js';
import { scoreConfirmationEmail, extractVerification, buildMailQueries } from '../src/removal/email.js';
import { sanitizeTemplate, templateStillFits, recordOutcome } from '../src/removal/workflows.js';
import { assertNoPii, Vault } from '../src/store/vault.js';
import { encrypt, decrypt, deriveKey, newSalt, verifyPassphrase, passphraseCheck } from '../src/store/crypto.js';
import { normalizeAnswers, assessCoverage, GROUPS } from '../src/onboarding/interview.js';
import { recheckDate } from '../src/agent.js';
import { explainExposure } from '../src/core/explain.js';
import { findOptOutLinks, optOutSearches, ROUTE } from '../src/core/optout.js';
import { bulkRemovalFor, coveredByBulk, PROGRAM } from '../src/core/bulk-removal.js';
import { readConsoleExport, mergeExposures, looksLikeConsoleExport } from '../src/core/handoff.js';
import {
  resumeFor, resumeQueue, resumeSummary, isBlocked, blockedAt, FRESHNESS_MS,
} from '../src/core/resume.js';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/* ===================================================== text primitives */

section('text primitives');

test('norm collapses punctuation and case', () => {
  assert.equal(norm("O'Brien-Smith"), 'o brien smith');
  assert.equal(norm('  Multiple   Spaces  '), 'multiple spaces');
});

test('deaccent handles diacritics', () => {
  assert.equal(norm('Ramírez'), 'ramirez');
  assert.equal(squash('de la Cruz'), 'delacruz');
});

test('similarity is 1 for identical, low for different', () => {
  assert.equal(similarity('smith', 'smith'), 1);
  assert.ok(similarity('smith', 'smyth') > 0.7);
  assert.ok(similarity('smith', 'johnson') < 0.4);
});

test('registrableDomain strips subdomains and handles multi-part TLDs', () => {
  assert.equal(registrableDomain('https://www.foo.example.com/path'), 'example.com');
  assert.equal(registrableDomain('https://a.b.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('example.com'), 'example.com');
});

test('registrableDomain leaves IP literals alone', () => {
  // "last two labels" would turn this into "0.1" and merge unrelated hosts
  // under one key in the graph, the dedupe groups and the workflow cache.
  assert.equal(registrableDomain('http://127.0.0.1:8080/x'), '127.0.0.1');
  assert.equal(registrableDomain('192.168.1.44'), '192.168.1.44');
});

test('fnv1a is stable and hex', () => {
  assert.equal(fnv1a('hello'), fnv1a('hello'));
  assert.match(fnv1a('hello'), /^[0-9a-f]{8}$/);
});

/* ========================================================= name parsing */

section('identity — names');

test('parseName splits simple names', () => {
  const p = parseName('John Michael Smith');
  assert.equal(p.first, 'John');
  assert.deepEqual(p.middle, ['Michael']);
  assert.equal(p.last, 'Smith');
});

test('parseName handles "Last, First"', () => {
  const p = parseName('Smith, John M.');
  assert.equal(p.first, 'John');
  assert.equal(p.last, 'Smith');
});

test('parseName keeps surname particles together', () => {
  assert.equal(parseName('Ludwig van der Berg').last, 'van der Berg');
  assert.equal(parseName('Maria de la Cruz').last, 'de la Cruz');
});

test('parseName strips titles and captures suffixes', () => {
  const p = parseName('Dr. Robert Smith Jr.');
  assert.equal(p.first, 'Robert');
  assert.equal(p.last, 'Smith');
  assert.match(p.suffix, /Jr/);
});

test('nameVariants generates initials and orderings', () => {
  const values = nameVariants('John Michael Smith').map((v) => v.value);
  assert.ok(values.includes('John Smith'));
  assert.ok(values.includes('Smith, John'));
  assert.ok(values.includes('J Smith'));
  assert.ok(values.some((v) => v === 'John M Smith' || v === 'John M. Smith'));
});

test('nicknames expand in both directions', () => {
  assert.ok(nicknamesFor('Robert').includes('Bob'));
  assert.ok(nicknamesFor('Bob').includes('Robert'));
});

test('derived variants carry lower confidence than the seed', () => {
  const vs = nameVariants('Robert Smith');
  const exact = vs.find((v) => v.value === 'Robert Smith');
  const nickname = vs.find((v) => v.value === 'Bob Smith');
  assert.equal(exact.confidence, 1);
  assert.ok(nickname.confidence < exact.confidence, 'a guessed nickname must not be as trusted as the real name');
});

/* ============================================== phones / emails / usernames */

section('identity — phones, emails, usernames');

test('phoneVariants produces the formats forms and indexes use', () => {
  const values = phoneVariants('4155550142').map((v) => v.value);
  assert.ok(values.includes('4155550142'));
  assert.ok(values.includes('(415) 555-0142'));
  assert.ok(values.includes('+14155550142'));
  assert.ok(values.includes('415-555-0142'), 'dashed format must survive dedupe');
});

test('phoneKey normalizes to the last 10 digits', () => {
  assert.equal(phoneKey('+1 (415) 555-0142'), '4155550142');
  assert.equal(phoneKey('415.555.0142'), '4155550142');
  assert.equal(phoneKey('14155550142'), '4155550142');
});

test('emailVariants strips plus-tags and handles gmail dots', () => {
  const values = emailVariants('bob.smith+news@gmail.com').map((v) => v.value);
  assert.ok(values.includes('bob.smith@gmail.com'));
  assert.ok(values.includes('bobsmith@gmail.com'));
  assert.ok(values.includes('bob.smith@googlemail.com'));
});

test('non-gmail dot-stripping is speculative, not exact', () => {
  const v = emailVariants('bob.smith@example.com').find((x) => x.value === 'bobsmith@example.com');
  assert.ok(v.confidence < 1, 'dot equivalence is a gmail-ism and must decay elsewhere');
});

test('usernameVariants builds handle permutations', () => {
  const values = usernameVariants('John Smith', 1985).map((v) => v.value);
  assert.ok(values.includes('johnsmith'));
  assert.ok(values.includes('jsmith'));
  assert.ok(values.includes('john.smith'));
  assert.ok(values.some((v) => v.endsWith('1985') || v.endsWith('85')));
});

test('all derived usernames are speculative', () => {
  for (const v of usernameVariants('John Smith')) {
    assert.ok(v.confidence <= 0.6, `"${v.value}" must not be trusted — thousands of people share it`);
  }
});

/* ============================================================= addresses */

section('identity — addresses');

test('parseAddress splits a full US address', () => {
  const a = parseAddress('123 North Main Street Apt 4B, Springfield, IL 62704');
  assert.equal(a.city, 'Springfield');
  assert.equal(a.state, 'IL');
  assert.equal(a.zip, '62704');
  assert.match(a.unit, /4B/);
  assert.match(a.line1, /123 North Main Street/);
});

test('parseAddress splits city from street WITHOUT commas', () => {
  // How people actually type an address. Getting this wrong glues the city
  // onto line1, so the exact-phrase search becomes "738 Bantry Ct Sunnyvale" —
  // a string no listing writes — and the highest-value searches silently
  // match nothing.
  const a = parseAddress('738 Example Ct Sunnyvale CA 94087');
  assert.equal(a.line1, '738 Example Ct');
  assert.equal(a.city, 'Sunnyvale');
  assert.equal(a.state, 'CA');
  assert.equal(a.zip, '94087');
});

test('comma-less parse handles multi-word cities and mid-string units', () => {
  assert.equal(parseAddress('1 Elm Rd San Jose CA').city, 'San Jose');
  const u = parseAddress('123 N Main St Apt 4B Springfield IL 62704');
  assert.equal(u.line1, '123 N Main St');
  assert.equal(u.unit, 'Apt 4B', 'the unit must not be swallowed into the city');
  assert.equal(u.city, 'Springfield');
});

test('a street suffix that is also a state code is not eaten', () => {
  // "Ct" is Connecticut. Reading it as a state leaves "738 Example", which
  // goes out as a search phrase matching nothing.
  const a = parseAddress('738 Example Ct');
  assert.equal(a.line1, '738 Example Ct');
  assert.equal(a.state, '', 'Ct here is Court, not Connecticut');

  // …but a genuine trailing state still parses, because a suffix remains.
  const b = parseAddress('1 Main St Hartford CT');
  assert.equal(b.state, 'CT');
  assert.equal(b.city, 'Hartford');
});

test('parseAddress accepts a spelled-out state', () => {
  const a = parseAddress('1 Elm Rd, Austin, Texas 78701');
  assert.equal(a.state, 'TX');
});

test('addressVariants abbreviates and expands', () => {
  const values = addressVariants('123 North Main Street, Springfield, IL 62704').map((v) => v.value);
  assert.ok(values.some((v) => v.includes('123 N Main St')));
  assert.ok(values.some((v) => v.includes('123 North Main Street')));
  assert.ok(values.includes('Springfield, IL'));
});

test('addressKey ignores suffix/directional disagreement', () => {
  const a = addressKey('123 North Main Street, Springfield, IL 62704');
  const b = addressKey('123 N Main St, Springfield IL 62704');
  assert.equal(a, b, 'the same address written two ways must produce one key');
});

test('addressKey separates different house numbers', () => {
  assert.notEqual(
    addressKey('123 Main St, Springfield, IL 62704'),
    addressKey('125 Main St, Springfield, IL 62704'),
  );
});

/* =============================================================== profile */

section('identity — profile assembly');

const SEED = {
  fullName: 'Robert James Smith',
  previousNames: ['Robert Jones'],
  primaryEmail: 'bob.smith@example.com',
  alternateEmails: ['rjsmith@work.example.org'],
  phone: '(415) 555-0142',
  previousPhones: ['415-555-0199'],
  address: '123 Main Street, Springfield, IL 62704',
  previousAddresses: ['45 Oak Avenue, Chicago, IL 60601'],
  approxAge: 40,
  relatives: ['Mary Smith', 'James Smith'],
  employers: ['Acme Corporation'],
  usernames: ['bobsmith415'],
};

const PROFILE = buildProfile(SEED);

test('buildProfile populates every attribute group', () => {
  assert.ok(PROFILE.names.length > 5);
  assert.ok(PROFILE.emails.length >= 2);
  assert.ok(PROFILE.phones.length >= 2);
  assert.ok(PROFILE.addresses.length > 2);
  assert.ok(PROFILE.relatives.length === 2);
  assert.equal(PROFILE.residence.state, 'IL');
});

test('approximate age becomes a range, not a point', () => {
  assert.ok(PROFILE.birthYear.min < PROFILE.birthYear.value);
  assert.ok(PROFILE.birthYear.max > PROFILE.birthYear.value);
  assert.ok(PROFILE.birthYear.confidence < 1);
});

test('skipped answers stay absent rather than empty', () => {
  const sparse = buildProfile({ fullName: 'Jane Doe' });
  assert.equal(sparse.emails.length, 0);
  assert.equal(sparse.birthYear, null);
});

/* ================================================================= graph */

section('identity graph');

test('nodeKey dedupes equivalent identifiers', () => {
  assert.equal(nodeKey('phone', '(415) 555-0142'), nodeKey('phone', '415.555.0142'));
  assert.equal(nodeKey('name', 'John Michael Smith'), nodeKey('name', 'John Smith'));
  assert.notEqual(nodeKey('name', 'John Smith'), nodeKey('name', 'Jane Smith'));
});

test('seeding populates the graph and links to the primary name', () => {
  const g = new IdentityGraph().seed(PROFILE);
  assert.ok(g.size() > 10);
  assert.ok(g.edges.length > 0);
  assert.ok(g.has('phone', '4155550142'));
});

test('ingested nodes never exceed the page confidence that produced them', () => {
  const g = new IdentityGraph().seed(PROFILE);
  const added = g.ingest(
    [{ type: 'phone', value: '415-555-0177' }],
    0.7,
    'https://example.com/x',
    0,
  );
  assert.equal(added.length, 1);
  assert.ok(added[0].confidence <= 0.7, 'a discovered identifier cannot be more certain than its source page');
});

test('low-confidence pages do not pollute the graph at all', () => {
  const g = new IdentityGraph().seed(PROFILE);
  const before = g.size();
  g.ingest([{ type: 'phone', value: '415-555-0188' }], 0.2, 'https://example.com/y', 0);
  assert.equal(g.size(), before, 'a page we barely believe must not inject facts');
});

test('corroboration raises confidence but is capped', () => {
  const g = new IdentityGraph().seed(PROFILE);
  for (let i = 0; i < 10; i++) {
    g.ingest([{ type: 'email', value: 'new@example.com' }], 0.6, `https://site${i}.com/p`, 0);
  }
  const node = g.get('email', 'new@example.com');
  assert.ok(node.confidence > 0.5);
  assert.ok(node.confidence <= 0.75, 'repetition must not manufacture certainty');
});

test('discovery terminates: depth and confidence both gate the queue', () => {
  const g = new IdentityGraph({ maxDepth: 1 }).seed(PROFILE);
  g.ingest([{ type: 'name', value: 'Deep Person' }], 0.9, 'https://a.com', 5);
  const pending = g.pendingSearchNodes();
  assert.ok(!pending.some((n) => n.value === 'Deep Person'), 'nodes past maxDepth must stop generating searches');
});

test('graph round-trips through JSON', () => {
  const g = new IdentityGraph().seed(PROFILE);
  const restored = IdentityGraph.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(restored.size(), g.size());
  assert.equal(restored.edges.length, g.edges.length);
});

/* ============================================================== matching */

section('match confidence');

test('compareNames handles middle names, initials and nicknames', () => {
  assert.ok(compareNames('John Smith', 'John Michael Smith') > 0.9);
  assert.ok(compareNames('J Smith', 'John Smith') > 0.6);
  assert.ok(compareNames('Bob Smith', 'Robert Smith') > 0.85);
});

test('a different surname is close to fatal', () => {
  assert.ok(compareNames('John Smith', 'John Johnson') < 0.35);
});

test('a different given name is heavily penalised', () => {
  assert.ok(compareNames('John Smith', 'Michael Smith') < 0.5);
});

test('NAME ALONE CANNOT CONFIRM — the core guard', () => {
  const result = scoreMatch({ names: ['Robert James Smith'] }, PROFILE);
  assert.notEqual(result.classification, CLASSIFICATION.CONFIRMED,
    'a page carrying only a matching name must never be auto-actioned');
  assert.ok(result.score < THRESHOLDS.confirmed);
});

test('name plus address plus phone confirms', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    addresses: ['123 Main St, Springfield, IL 62704'],
    phones: ['(415) 555-0142'],
    ages: ['40'],
  }, PROFILE);
  assert.equal(result.classification, CLASSIFICATION.CONFIRMED);
  assert.ok(result.score > 0.85);
});

test('an exact email confirms on its own — it is not a shared identifier', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    emails: ['bob.smith@example.com'],
  }, PROFILE);
  assert.equal(result.classification, CLASSIFICATION.CONFIRMED);
});

test('a same-name stranger with a wrong age is rejected', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    ages: ['72'],
    addresses: ['900 Elsewhere Rd, Miami, FL 33101'],
  }, PROFILE);
  assert.ok(result.score < THRESHOLDS.probable,
    'age off by 30 years plus a foreign address must not read as a match');
});

test('ABSENCE IS NOT EVIDENCE — a sparse page is not penalised', () => {
  const sparse = scoreMatch({
    names: ['Robert Smith'],
    addresses: ['123 Main St, Springfield, IL 62704'],
  }, PROFILE);
  const withWrongPhone = scoreMatch({
    names: ['Robert Smith'],
    addresses: ['123 Main St, Springfield, IL 62704'],
    phones: ['2125559999'],
  }, PROFILE);
  assert.ok(sparse.score > withWrongPhone.score,
    'a page that simply omits a phone must score better than one printing a wrong phone');
});

test('approximate age tolerates a couple of years', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    addresses: ['123 Main St, Springfield, IL 62704'],
    ages: [String(new Date().getUTCFullYear() - PROFILE.birthYear.value + 2)],
  }, PROFILE);
  assert.ok(result.attributes.age.score >= 0.75, '"about 40" must not conflict with 42');
});

test('two matching relatives is strong evidence', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    relatives: ['Mary Smith', 'James Smith'],
  }, PROFILE);
  assert.ok(result.attributes.relative.score >= 0.9);
});

test('explanation is human-readable and mentions the evidence', () => {
  const result = scoreMatch({
    names: ['Robert Smith'],
    phones: ['(415) 555-0142'],
  }, PROFILE);
  assert.match(result.explanation, /confidence/);
  assert.ok(result.explanation.length > 30);
});

test('classify respects the thresholds', () => {
  assert.equal(classify(0.95), CLASSIFICATION.CONFIRMED);
  assert.equal(classify(0.75), CLASSIFICATION.PROBABLE);
  assert.equal(classify(0.5), CLASSIFICATION.AMBIGUOUS);
  assert.equal(classify(0.1), CLASSIFICATION.FALSE);
});

test('masking never prints a full identifier', () => {
  assert.ok(!maskPhone('4155550142').includes('415555'));
  assert.ok(maskPhone('4155550142').includes('0142'));
  assert.ok(!maskEmail('bob.smith@example.com').includes('bob.smith'));
});

/* ================================================================== risk */

section('privacy risk');

test('a name-only page is near-zero risk', () => {
  const r = riskOf({ fields: ['name'], matchScore: 1 });
  assert.ok(r.score < 15, `expected low, got ${r.score}`);
});

test('a full dossier is critical', () => {
  const r = riskOf({
    fields: ['name', 'address', 'phone', 'relatives', 'age', 'address_history'],
    siteKind: 'aggregator',
    matchScore: 1,
  });
  assert.ok(r.score >= 75, `expected critical, got ${r.score}`);
  assert.equal(r.band, 'critical');
});

test('combinations beat the sum of their parts', () => {
  const separate = riskOf({ fields: ['address'], matchScore: 1 }).score;
  const combined = riskOf({ fields: ['address', 'phone'], matchScore: 1 }).score;
  assert.ok(combined > separate * 1.2, 'address+phone must be worth more than address alone');
});

test('an SSN fragment dominates everything', () => {
  const r = riskOf({ fields: ['name', 'ssn_fragment'], matchScore: 1 });
  assert.ok(r.score >= 75);
});

test('removed exposures drop to near zero', () => {
  const live = riskOf({ fields: ['address', 'phone'], matchScore: 1 }).score;
  const removed = riskOf({ fields: ['address', 'phone'], matchScore: 1, status: 'successfully_removed' }).score;
  assert.ok(removed < live * 0.2);
});

test('risk explanation is plain language', () => {
  const r = riskOf({ fields: ['address', 'phone'], matchScore: 1 });
  assert.match(r.explanation, /address/i);
  assert.ok(!/\bmult\b|\bweight\b/.test(r.explanation), 'no internal jargon in user-facing copy');
});

test('exposure score uses diminishing returns, not a sum', () => {
  const one = exposureScore([{ url: 'https://a.com', fields: ['address', 'phone'], matchScore: 1 }]);
  const twenty = exposureScore(
    Array.from({ length: 20 }, (_, i) => ({ url: `https://s${i}.com`, fields: ['address', 'phone'], matchScore: 1 })),
  );
  assert.ok(twenty.score > one.score);
  assert.ok(twenty.score <= 100);
  assert.ok(twenty.score < one.score * 5, 'twenty copies must not be twenty times the risk');
});

test('a fully cleaned-up user scores zero with an honest message', () => {
  const s = exposureScore([{ url: 'https://a.com', fields: ['address'], status: 'successfully_removed' }]);
  assert.equal(s.score, 0);
  assert.match(s.explanation, /removed/i);
});

test('prioritize puts confirmed high-risk first', () => {
  const list = [
    { url: 'https://a.com', fields: ['name'], classification: 'confirmed', matchScore: 0.9 },
    { url: 'https://b.com', fields: ['address', 'phone', 'relatives'], classification: 'confirmed', matchScore: 0.9 },
    { url: 'https://c.com', fields: ['address', 'phone', 'relatives'], classification: 'ambiguous', matchScore: 0.5 },
  ];
  const sorted = prioritize(list);
  assert.equal(sorted[0].url, 'https://b.com');
  assert.equal(sorted[2].url, 'https://c.com', 'ambiguous records go last');
});

test('bandOf covers the range', () => {
  assert.equal(bandOf(0), 'none');
  assert.equal(bandOf(10), 'low');
  assert.equal(bandOf(40), 'moderate');
  assert.equal(bandOf(60), 'high');
  assert.equal(bandOf(90), 'critical');
});

/* ============================================================ duplicates */

section('duplicate detection');

const RECORD_A = { names: ['Robert Smith'], phones: ['4155550142'], addresses: ['123 Main St, Springfield IL 62704'], ages: ['40'] };
const RECORD_B = { names: ['Robert J Smith'], phones: ['(415) 555-0142'], addresses: ['123 N Main Street, Springfield, IL'], ages: ['40'] };
const RECORD_C = { names: ['Robert Smith'], phones: ['2125559999'], addresses: ['9 Other Rd, Miami FL 33101'], ages: ['72'] };

test('the same record written two ways is recognised', () => {
  assert.ok(sameRecord(RECORD_A, RECORD_B));
});

test('a same-name stranger is NOT a duplicate', () => {
  assert.ok(!sameRecord(RECORD_A, RECORD_C),
    'name agreement alone must never merge two people');
});

test('fingerprints are stable', () => {
  assert.equal(recordFingerprint(RECORD_A).key, recordFingerprint({ ...RECORD_A }).key);
});

test('groupDuplicates separates within-site from across-site copies', () => {
  const groups = groupDuplicates([
    { url: 'https://broker1.com/a', record: RECORD_A, matchScore: 0.9 },
    { url: 'https://broker1.com/b', record: RECORD_B, matchScore: 0.9 },
    { url: 'https://broker2.com/x', record: RECORD_A, matchScore: 0.9 },
    { url: 'https://broker3.com/y', record: RECORD_C, matchScore: 0.5 },
  ]);
  const main = groups.find((g) => g.count === 3);
  assert.ok(main, 'the three copies of one record must group');
  assert.equal(main.acrossSites, 2);
  assert.equal(main.withinSite.length, 1);
  assert.match(main.summary, /resell|duplicate/i);
  assert.ok(groups.some((g) => g.count === 1), 'the stranger stays in its own group');
});

test('reappearance distinguishes relisting from republication', () => {
  const removed = [{ url: 'https://broker1.com/a', record: RECORD_A }];
  const relisted = detectReappearance(removed, [{ url: 'https://broker1.com/a', record: RECORD_A }]);
  assert.equal(relisted[0].kind, 'relisted');
  assert.equal(relisted[0].investigateUpstream, false);

  const republished = detectReappearance(removed, [{ url: 'https://broker9.com/z', record: RECORD_B }]);
  assert.equal(republished[0].kind, 'republished');
  assert.equal(republished[0].investigateUpstream, true);
  assert.match(republished[0].note, /upstream|feed/i);
});

/* ========================================================= state machine */

section('execution state machine');

test('the legal happy path is walkable', () => {
  const chain = [
    STATE.DISCOVERED, STATE.CONFIRMED_EXPOSURE, STATE.REMOVAL_METHOD_FOUND,
    STATE.FORM_IN_PROGRESS, STATE.REQUEST_SUBMITTED, STATE.PENDING_REMOVAL,
    STATE.SUCCESSFULLY_REMOVED,
  ];
  for (let i = 0; i < chain.length - 1; i++) {
    assert.ok(canTransition(chain[i], chain[i + 1]), `${chain[i]} -> ${chain[i + 1]} should be legal`);
  }
});

test('SUBMITTED CANNOT JUMP TO REMOVED without the pending step', () => {
  // Submitted -> removed is allowed only as an explicit verified outcome;
  // discovered -> removed is not, and that is the honesty guarantee.
  assert.ok(!canTransition(STATE.DISCOVERED, STATE.SUCCESSFULLY_REMOVED));
  assert.ok(!canTransition(STATE.CONFIRMED_EXPOSURE, STATE.SUCCESSFULLY_REMOVED));
});

test('a removed record is terminal — it cannot be reopened in place', () => {
  assert.equal(canTransition(STATE.SUCCESSFULLY_REMOVED, STATE.FORM_IN_PROGRESS), false);
});

test('payment can never transition by paying', () => {
  assert.ok(!canTransition(STATE.PAYMENT_DEMANDED, STATE.REQUEST_SUBMITTED));
  assert.ok(canTransition(STATE.PAYMENT_DEMANDED, STATE.NOT_REMOVABLE));
});

test('an in-flight request cannot loop back to the form (no duplicate filings)', () => {
  assert.ok(!canTransition(STATE.REQUEST_SUBMITTED, STATE.FORM_IN_PROGRESS));
});

test('transition records history and rejects illegal moves', () => {
  const e = { status: STATE.DISCOVERED, history: [] };
  transition(e, STATE.CONFIRMED_EXPOSURE, 'matched');
  assert.equal(e.status, STATE.CONFIRMED_EXPOSURE);
  assert.equal(e.history.length, 1);
  assert.equal(e.history[0].note, 'matched');
  assert.throws(() => transition(e, STATE.SUCCESSFULLY_REMOVED), /illegal transition/);
});

test('summarize produces the dashboard counters', () => {
  const s = summarize([
    { status: STATE.SUCCESSFULLY_REMOVED }, { status: STATE.PENDING_REMOVAL },
    { status: STATE.MANUAL_ACTION_REQUIRED }, { status: STATE.FALSE_MATCH },
    { status: STATE.DISCOVERED },
  ]);
  assert.equal(s.discovered, 5);
  assert.equal(s.completed, 1);
  assert.equal(s.manualRequired, 1);
  assert.equal(s.falseMatches, 1);
  assert.equal(s.investigating, 1);
});

/* ============================================================= redaction */

section('log redaction');

const redact = createRedactor(PROFILE);

test('known identity values are replaced with tokens', () => {
  const out = redact.string('User Robert James Smith at 123 Main Street, Springfield, IL 62704');
  assert.ok(!out.includes('Robert James Smith'));
  assert.ok(out.includes('«name»'));
});

test('a stranger’s email and phone are scrubbed too', () => {
  const out = redact.string('contact someone.else@other.com or 212-555-8888');
  assert.ok(!out.includes('someone.else@other.com'));
  assert.ok(!out.includes('212-555-8888'));
  assert.ok(out.includes('«email»'));
});

test('phone redaction keeps a debuggable suffix', () => {
  assert.match(redact.string('call 212-555-8888'), /8888/);
});

test('SSNs are removed entirely', () => {
  assert.equal(redact.string('ssn 123-45-6789').includes('123-45-6789'), false);
});

test('secret-named keys are redacted whatever they hold', () => {
  const out = redact({ password: 'hunter2', api_key: 'abc', safe: 'ok' });
  assert.equal(out.password, '«redacted»');
  assert.equal(out.api_key, '«redacted»');
  assert.equal(out.safe, 'ok');
});

test('nested structures and Errors are handled', () => {
  const out = redact({ a: { b: ['bob.smith@example.com'] } });
  assert.ok(!JSON.stringify(out).includes('bob.smith@example.com'));
  const err = redact(new Error('failed for bob.smith@example.com'));
  assert.ok(!err.message.includes('bob.smith@example.com'));
});

/* ========================================================== jurisdiction */

section('jurisdiction');

test('a California resident gets CCPA identified', () => {
  const j = detectJurisdiction({ state: 'CA', country: 'US' }, '');
  assert.ok(j.applicable.some((l) => l.name === 'CCPA/CPRA'));
});

test('a statute is NOT assertable unless the site acknowledges it', () => {
  const silent = detectJurisdiction({ state: 'CA', country: 'US' }, 'We value your privacy.');
  assert.equal(silent.applicable[0].assertable, false);

  const acknowledged = detectJurisdiction(
    { state: 'CA', country: 'US' },
    'California residents may exercise rights under the CCPA.',
  );
  assert.equal(acknowledged.applicable[0].assertable, true);
});

test('the site’s own process is always recommended first', () => {
  const j = detectJurisdiction(
    { state: 'CA', country: 'US' },
    'Submit a removal request. California residents: do not sell my personal information. CCPA applies.',
  );
  assert.equal(j.recommended[0].approach, 'site_process');
});

test('an unverifiable statute is explicitly marked "do not cite"', () => {
  const j = detectJurisdiction({ state: 'CO', country: 'US' }, 'Nothing relevant here.');
  const warning = j.recommended.find((r) => r.approach === 'statutory_unverified');
  assert.ok(warning);
  assert.match(warning.action, /do not cite/i);
});

test('EU residence maps to GDPR', () => {
  const j = detectJurisdiction({ country: 'DE' }, 'We comply with the GDPR.');
  assert.ok(j.applicable.some((l) => l.name === 'GDPR' && l.assertable));
});

test('with no route at all we still suggest a plain request', () => {
  const j = detectJurisdiction({ state: 'XX', country: 'ZZ' }, '');
  assert.equal(j.recommended[0].approach, 'contact');
});

test('preferredChoices takes deletion AND the sale opt-out', () => {
  const c = preferredChoices(['delete', 'do_not_sell']);
  assert.ok(c.choices.includes('delete'));
  assert.ok(c.choices.includes('opt_out_sale'));
  assert.match(c.rationale, /re-listed|both/i);
});

/* =========================================================== removability */

section('removability');

test('a government domain is not removable, and says why', () => {
  const r = classifyRemovability({ url: 'https://records.ca.gov/x', text: 'Property record' });
  assert.equal(r.category, CATEGORY.GOVERNMENT);
  assert.equal(r.removable, false);
  assert.match(r.userMessage, /cannot/i);
});

test('court records point at sealing, not a web form', () => {
  const r = classifyRemovability({
    url: 'https://example.com/case',
    text: 'Case Number: 2019-CV-1234. Plaintiff: Acme. Defendant: Smith.',
  });
  assert.equal(r.category, CATEGORY.COURT);
  assert.match(r.note, /seal|expunge/i);
});

test('journalism is honestly reported as not removable', () => {
  const r = classifyRemovability({
    url: 'https://dailynews.example/story',
    text: 'By Jane Doe, staff reporter. Published 14:32. Corrections policy.',
  });
  assert.equal(r.category, CATEGORY.JOURNALISM);
  assert.equal(r.removable, false);
});

test('a dossier-shaped page is treated as a broker even unbranded', () => {
  const r = classifyRemovability({
    url: 'https://unknown-site.example/p/1',
    text: 'Some listing',
    fields: ['address', 'phone', 'relatives', 'age'],
  });
  assert.equal(r.category, CATEGORY.BROKER);
  assert.equal(r.removable, true);
});

test('the user’s own site is never targeted', () => {
  const r = classifyRemovability({ url: 'https://work.example.org/about', text: 'hi' }, PROFILE);
  assert.equal(r.category, CATEGORY.USER_CONTROLLED);
  assert.match(r.userMessage, /yours/i);
});

test('siteKindFor feeds the risk reach multiplier', () => {
  assert.equal(siteKindFor(CATEGORY.BROKER), 'aggregator');
  assert.equal(siteKindFor(CATEGORY.ARCHIVE), 'archive');
});

/* =============================================================== queries */

section('query generation');

const GRAPH = new IdentityGraph().seed(PROFILE);

test('queries cover identifier-only searches, not just names', () => {
  const qs = buildQueries(GRAPH, PROFILE, { budget: 200 });
  const kinds = new Set(qs.map((q) => q.kind));
  for (const k of ['email_exact', 'phone_exact', 'address_exact', 'username_exact', 'name_relative', 'name_document']) {
    assert.ok(kinds.has(k), `missing query kind: ${k}`);
  }
});

test('document and archive searches are included', () => {
  const qs = buildQueries(GRAPH, PROFILE, { budget: 300 });
  assert.ok(qs.some((q) => q.text.includes('filetype:pdf')));
});

test('selective identifiers outrank bare name searches', () => {
  const qs = buildQueries(GRAPH, PROFILE, { budget: 300 });
  const email = qs.find((q) => q.kind === 'email_exact');
  const bare = qs.find((q) => q.kind === 'name_bare');
  assert.ok(email.priority > bare.priority);
});

test('NO HARDCODED BROKER LIST anywhere in the query builder', () => {
  const qs = buildQueries(GRAPH, PROFILE, { budget: 300 });
  const banned = /whitepages|spokeo|beenverified|intelius|truepeoplesearch|radaris|mylife|peoplefinder/i;
  assert.ok(!qs.some((q) => banned.test(q.text)),
    'discovery must find sites dynamically, never from a baked-in list');
});

test('phone searches are compact, not four near-identical variants', () => {
  const g2 = new IdentityGraph().seed(PROFILE);
  const qs = buildQueries(g2, PROFILE, { budget: 300 });
  const phoneQs = qs.filter((q) => q.kind === 'phone_exact');
  // One number should not burn four of the user's search slots on formats
  // engines already normalise.
  assert.ok(phoneQs.length <= 4, `expected at most 2 per number, got ${phoneQs.length}`);
});

test('gmail alt-domain aliases do not earn their own search', () => {
  const p = buildProfile({ fullName: 'Jane Doe', primaryEmail: 'jane.doe@gmail.com' });
  const g2 = new IdentityGraph().seed(p);
  const qs = buildQueries(g2, p, { budget: 300 });
  assert.ok(
    !qs.some((q) => q.text.includes('googlemail.com')),
    'nobody publishes a googlemail.com address — searching it wastes a slot',
  );
});

test('phoneSearchForms covers the written formats indexes carry', () => {
  const forms = phoneSearchForms('4155550142');
  assert.ok(forms.includes('(415) 555-0142'));
  assert.ok(forms.includes('415-555-0142'));
  assert.ok(forms.includes('4155550142'));
});

test('a newly discovered node generates its own follow-up searches', () => {
  const node = { type: 'phone', value: '415-555-0177', confidence: 0.8, depth: 1, key: 'phone:4155550177' };
  const qs = queriesForNode(node, GRAPH, PROFILE);
  assert.ok(qs.length > 0);
  assert.ok(qs.some((q) => q.text.includes('555-0177')));
});

test('convergence needs several quiet rounds, not one', () => {
  assert.equal(hasConverged([{ newExposures: 0, newIdentifiers: 0 }]).converged, false);
  const quiet = [
    { newExposures: 5, newIdentifiers: 2 },
    { newExposures: 0, newIdentifiers: 0 },
    { newExposures: 0, newIdentifiers: 0 },
    { newExposures: 0, newIdentifiers: 0 },
  ];
  assert.equal(hasConverged(quiet).converged, true);
});

test('convergence does not fire while things are still being found', () => {
  const busy = [
    { newExposures: 3, newIdentifiers: 1 },
    { newExposures: 0, newIdentifiers: 0 },
    { newExposures: 2, newIdentifiers: 0 },
  ];
  assert.equal(hasConverged(busy).converged, false);
});

/* ====================================================== field classifier */

section('form field classification');

test('autocomplete wins when present', () => {
  assert.equal(classifyField({ autocomplete: 'family-name', name: 'x1' }).kind, 'last_name');
  assert.equal(classifyField({ autocomplete: 'postal-code' }).kind, 'zip');
});

test('labels beat minified name attributes', () => {
  const c = classifyField({ label: 'Email address', name: 'f_2a9', type: 'text' });
  assert.equal(c.kind, 'email');
});

test('confirm-email is distinguished from email', () => {
  assert.equal(classifyField({ label: 'Confirm your email' }).kind, 'email_confirm');
});

test('address line 2 is not mistaken for line 1', () => {
  assert.equal(classifyField({ label: 'Apartment, suite, unit' }).kind, 'address_line2');
  assert.equal(classifyField({ label: 'Street address' }).kind, 'address_line1');
});

test('SENSITIVE FIELDS ARE FLAGGED — SSN, licence, passport, ID upload', () => {
  for (const [label, kind] of [
    ['Social Security Number', 'ssn'],
    ['Driver\'s License Number', 'drivers_license'],
    ['Passport number', 'passport'],
    ['Upload a photo of your ID', 'id_upload'],
    ['Card number', 'payment_card'],
  ]) {
    const c = classifyField({ label, type: label.includes('Upload') ? 'file' : 'text' });
    assert.equal(c.kind, kind, `"${label}" should classify as ${kind}`);
    assert.equal(c.sensitive, true, `"${label}" must be marked sensitive`);
  }
});

test('last-4-of-SSN is distinguished from a full SSN', () => {
  assert.equal(classifyField({ label: 'Last 4 of SSN' }).kind, 'ssn_last4');
});

test('planFill NEVER auto-fills a sensitive field', () => {
  const fields = [
    { label: 'Email', selector: '#e', tag: 'input', type: 'text' },
    { label: 'Social Security Number', selector: '#s', tag: 'input', type: 'text' },
  ];
  const plan = planFill(fields, { email: { primary: 'a@b.com' } });
  assert.equal(plan.fills.length, 1);
  assert.equal(plan.fills[0].value, 'a@b.com');
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].classification.kind, 'ssn');
  assert.equal(plan.blocked[0].requiresApproval, true);
  assert.match(plan.blocked[0].why, /will not send it/i);
});

test('a sensitive field fills only after explicit per-kind approval', () => {
  const fields = [{ label: 'Date of birth', selector: '#d', tag: 'input', type: 'text' }];
  const values = { birthDate: '1985-01-01' };
  assert.equal(planFill(fields, values).fills.length, 0);
  assert.equal(planFill(fields, values, { approvedSensitiveKinds: ['birth_date'] }).fills.length, 1);
});

test('CAPTCHA fields are always blocked, never approved away', () => {
  const plan = planFill(
    [{ label: 'Enter the captcha', selector: '#c', tag: 'input', type: 'text' }],
    {},
    { approvedSensitiveKinds: ['captcha'] },
  );
  assert.equal(plan.fills.length, 0);
  assert.equal(plan.blocked[0].classification.kind, 'captcha');
});

test('matchOption resolves state name against abbreviation options', () => {
  const options = [{ value: 'CA', label: 'California' }, { value: 'IL', label: 'Illinois' }];
  assert.equal(matchOption('IL', options), 'IL');
  assert.equal(matchOption('Illinois', options), 'IL');
});

/* ============================================================ extraction */

section('page extraction');

// The broker's domain must differ from the subject's email domain, otherwise
// the boilerplate filter correctly treats the address as the site's own.
const BROKER_PAGE = {
  url: 'https://recordsfinder.test/p/robert-smith',
  title: 'Robert Smith - Age 40 - Springfield, IL | Records Finder',
  text: `
    Robert James Smith, 40, lives in Springfield, IL.
    Current Address: 123 Main Street, Springfield, IL 62704
    Phone: (415) 555-0142
    Email: bob.smith@example.com
    Relatives: Mary Smith, James Smith and Susan Smith
    Previous Addresses: 45 Oak Avenue, Chicago, IL 60601
    Employer: Acme Corporation
    View full report - unlock the full report for $9.99
  `,
  links: ['https://linkedin.com/in/bobsmith415', 'https://records.example.com/privacy'],
};

const EXTRACTED = extractFromPage(BROKER_PAGE);

test('extracts the whole record from a broker page', () => {
  assert.ok(EXTRACTED.record.names.some((n) => /Robert/.test(n)));
  assert.ok(EXTRACTED.record.phones.includes('4155550142'));
  assert.ok(EXTRACTED.record.emails.includes('bob.smith@example.com'));
  assert.ok(EXTRACTED.record.addresses.some((a) => /123 Main Street/.test(a)));
  assert.ok(EXTRACTED.record.relatives.length >= 2);
  assert.ok(EXTRACTED.record.employers.some((e) => /Acme/.test(e)));
});

test('reports which field kinds are exposed', () => {
  for (const f of ['name', 'address', 'phone', 'email', 'relatives', 'age']) {
    assert.ok(EXTRACTED.fields.includes(f), `missing field kind: ${f}`);
  }
});

test('the extracted record scores as a confirmed match', () => {
  const m = scoreMatch(EXTRACTED.record, PROFILE);
  assert.equal(m.classification, CLASSIFICATION.CONFIRMED);
});

test('paywall demands are detected, not worked around', () => {
  assert.ok(EXTRACTED.paywalled);
  assert.equal(EXTRACTED.paywalled.price, '$9.99');
});

test('site boilerplate emails are not mistaken for the subject’s', () => {
  const e = extractFromPage({
    url: 'https://site.example/p',
    text: 'Contact support@site.example or privacy@site.example',
  });
  assert.equal(e.record.emails.length, 0);
});

test('social profile links yield usernames', () => {
  assert.deepEqual(usernameFromProfileUrl('https://linkedin.com/in/bobsmith415'), ['bobsmith415']);
  assert.deepEqual(usernameFromProfileUrl('https://example.com/about'), []);
});

test('isPlausibleName rejects UI chrome', () => {
  assert.ok(isPlausibleName('Robert Smith'));
  assert.ok(!isPlausibleName('Privacy Policy'));
  assert.ok(!isPlausibleName('View Full'));
  assert.ok(!isPlausibleName('Smith'));
  assert.ok(!isPlausibleName('Robert Smith 40'));
});

test('splitPeopleList handles commas and "and"', () => {
  const people = splitPeopleList('Mary Smith, James Smith and Susan Smith');
  assert.equal(people.length, 3);
});

test('extractNames prefers the page title', () => {
  const names = extractNames('Robert Smith - Age 40 | Site', '');
  assert.ok(names.includes('Robert Smith'));
});

test('detectPaywall ignores ordinary pages', () => {
  assert.equal(detectPaywall('This is a normal page about nothing.'), null);
});

/* ================================================ confirmation detection */

section('confirmation & verification parsing');

test('parseConfirmation recognises a success page and case number', () => {
  const c = parseConfirmation('Thank you. Your removal request has been received. Case Number: ABC-12345. Please allow 14 business days.');
  assert.equal(c.confirmed, true);
  assert.equal(c.caseNumber, 'ABC-12345');
  assert.match(c.expectedTimeframe, /14 business days/);
});

test('parseConfirmation does not claim success on an ordinary page', () => {
  assert.equal(parseConfirmation('Welcome to our website. Learn more about privacy.').confirmed, false);
});

test('parseVerificationNeed separates sms, mfa and email channels', () => {
  assert.equal(parseVerificationNeed('We sent a code to your phone by text message').channel, 'sms');
  assert.equal(parseVerificationNeed('Open your authenticator app for two-factor').channel, 'mfa');
  assert.equal(parseVerificationNeed('Please check your email to confirm').channel, 'email');
  assert.equal(parseVerificationNeed('Nothing to see').needed, false);
});

/* ============================================================ mail match */

section('confirmation email matching');

const MAIL_CONTEXT = {
  domain: 'recordsfinder.test',
  companyName: 'recordsfinder',
  submittedAt: '2026-08-08T10:00:00Z',
};

test('a confirmation from the right domain scores high despite an odd subject', () => {
  const s = scoreConfirmationEmail({
    from: 'no-reply@recordsfinder.test',
    subject: '[#88213] Action required',
    body: 'Please confirm your opt-out request by clicking below.',
    receivedAt: '2026-08-08T10:03:00Z',
  }, MAIL_CONTEXT);
  assert.ok(s.likely, `expected a match, scored ${s.score}`);
});

test('marketing mail mentioning privacy is rejected', () => {
  const s = scoreConfirmationEmail({
    from: 'deals@unrelated.com',
    subject: '50% off — sale ends today!',
    body: 'See our privacy policy. Unsubscribe from our newsletter.',
    receivedAt: '2026-08-08T10:03:00Z',
  }, MAIL_CONTEXT);
  assert.ok(!s.likely);
});

test('mail that predates the request cannot be its confirmation', () => {
  const s = scoreConfirmationEmail({
    from: 'no-reply@recordsfinder.test',
    subject: 'Confirm your removal request',
    body: 'Verify here',
    receivedAt: '2026-08-01T10:00:00Z',
  }, MAIL_CONTEXT);
  assert.ok(!s.likely, 'timing must veto an otherwise plausible match');
});

test('extractVerification picks the verification link over social links', () => {
  const v = extractVerification({
    subject: 'Confirm',
    body: 'Click https://recordsfinder.test/verify?t=abc123 to confirm. Follow us at https://twitter.com/recordsfinder',
  }, MAIL_CONTEXT);
  assert.match(v.link, /recordsfinder\.test\/verify/);
});

test('extractVerification pulls a numeric code', () => {
  const v = extractVerification({ subject: 'Your code', body: 'Your verification code is 483921.' }, MAIL_CONTEXT);
  assert.equal(v.code, '483921');
});

test('mail queries search by domain, company and keywords', () => {
  const qs = buildMailQueries(MAIL_CONTEXT);
  assert.ok(qs.some((q) => q.q.includes('from:recordsfinder.test')));
  assert.ok(qs.some((q) => /verify|confirm/i.test(q.q)));
});

/* ============================================================= workflows */

section('workflow templates');

test('sanitizeTemplate keeps structure and drops everything else', () => {
  const t = sanitizeTemplate({
    domain: 'example.com',
    entryUrl: 'https://example.com/opt-out?session=abc&name=Robert+Smith',
    fields: [{ kind: 'email', selector: '#e', value: 'bob@example.com', required: true }],
  });
  const json = JSON.stringify(t);
  assert.ok(!json.includes('bob@example.com'), 'values must never be stored');
  assert.ok(!json.includes('Robert'), 'query strings must be stripped');
  assert.equal(t.entryUrl, 'https://example.com/opt-out');
  assert.equal(t.fields[0].selector, '#e');
});

test('THE PII GUARD BLOCKS a template carrying personal data', () => {
  assert.throws(
    () => assertNoPii({ sites: { 'a.com': { note: 'used bob.smith@example.com' } } }),
    /email address/i,
  );
  assert.throws(
    () => assertNoPii({ sites: { 'a.com': { note: '123 Main Street' } } }),
    /street address/i,
  );
  assert.throws(
    () => assertNoPii({ sites: { 'a.com': { note: 'call 415-555-0142' } } }),
    /phone/i,
  );
});

test('a clean template passes the guard', () => {
  assert.equal(assertNoPii({ sites: { 'a.com': { fields: [{ kind: 'email', selector: '#e' }] } } }), true);
});

test('a repeatedly failing template is demoted so the path is rediscovered', () => {
  let wf = { version: 1, sites: {} };
  const method = { domain: 'bad.example', entryUrl: 'https://bad.example/opt-out', workflowType: 'web_form' };
  for (let i = 0; i < 4; i++) {
    wf = recordOutcome(wf, method, { outcome: 'failed' });
  }
  assert.equal(wf.sites['bad.example'].entryUrl, null, 'a broken template must stop being trusted');
  assert.ok(wf.sites['bad.example'].failureModes.includes('template_demoted_after_repeated_failures'));
});

test('a successful template is retained with its stats', () => {
  let wf = { version: 1, sites: {} };
  const method = { domain: 'good.example', entryUrl: 'https://good.example/opt-out', workflowType: 'web_form' };
  wf = recordOutcome(wf, method, { outcome: 'submitted', confirmation: { confirmed: true, caseNumber: 'X1' } });
  assert.equal(wf.sites['good.example'].stats.successes, 1);
  assert.equal(wf.sites['good.example'].confirmation.providesCaseNumber, true);
});

test('templateStillFits notices a changed form', () => {
  const template = { fields: [{ selector: '#email', required: true, kind: 'email' }] };
  assert.equal(templateStillFits(template, [{ selector: '#email' }]).fits, true);
  const changed = templateStillFits(template, [{ selector: '#new_email' }]);
  assert.equal(changed.fits, false);
  assert.match(changed.reason, /changed/);
});

/* ================================================================ crypto */

section('vault crypto');

test('encrypt/decrypt round-trips', () => {
  const key = deriveKey('correct horse battery', newSalt());
  const env = encrypt({ secret: 'value', n: 42 }, key);
  assert.deepEqual(decrypt(env, key), { secret: 'value', n: 42 });
});

test('ciphertext does not contain the plaintext', () => {
  const key = deriveKey('correct horse battery', newSalt());
  const env = encrypt({ address: '123 Main Street' }, key);
  assert.ok(!JSON.stringify(env).includes('Main Street'));
});

test('a wrong key fails loudly rather than returning garbage', () => {
  const salt = newSalt();
  const env = encrypt({ a: 1 }, deriveKey('passphrase one', salt));
  assert.throws(() => decrypt(env, deriveKey('passphrase two', salt)), /could not decrypt/);
});

test('tampering is detected by the auth tag', () => {
  const key = deriveKey('correct horse battery', newSalt());
  const env = encrypt({ a: 1 }, key);
  const tampered = { ...env, data: Buffer.from('junkjunkjunk').toString('base64') };
  assert.throws(() => decrypt(tampered, key), /could not decrypt/);
});

test('a fresh IV is used per encryption', () => {
  const key = deriveKey('correct horse battery', newSalt());
  assert.notEqual(encrypt({ a: 1 }, key).iv, encrypt({ a: 1 }, key).iv);
});

test('passphrase verification works without decrypting', () => {
  const salt = newSalt();
  const key = deriveKey('the right one', salt);
  const check = passphraseCheck(key);
  assert.equal(verifyPassphrase(key, check), true);
  assert.equal(verifyPassphrase(deriveKey('the wrong one', salt), check), false);
});

test('short passphrases are rejected', () => {
  assert.throws(() => deriveKey('short', newSalt()), /at least 8/);
});

test('EVIDENCE SCREENSHOTS ARE ENCRYPTED AND 0600, not world-readable PNGs', () => {
  // A full-page capture of a broker listing *is* the user's address, phone and
  // relatives, rendered. Playwright's `path:` option writes through the umask,
  // which on a default 022 system leaves them mode 644 — the one artefact that
  // shows everything, unprotected. The vault must own the write.
  const home = mkdtempSync(join(tmpdir(), 'pa-evidence-'));
  try {
    const vault = new Vault(home);
    vault.create('a-good-test-passphrase');

    const png = Buffer.from('89504e470d0a1a0a-pretend-image-bytes', 'utf8');
    const path = vault.saveEvidence(png, 'exp_test', 'before-removal');

    assert.ok(path, 'evidence should be stored');
    assert.equal(statSync(path).mode & 0o777, 0o600, 'evidence must not be world-readable');

    const onDisk = readFileSync(path, 'utf8');
    assert.ok(!onDisk.includes('pretend-image-bytes'), 'raw image bytes must not sit in the clear');
    assert.match(onDisk, /aes-256-gcm/);

    assert.deepEqual(vault.readEvidence(path), png, 'and it must decrypt back byte-for-byte');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

/* ============================================================ onboarding */

section('onboarding');

test('every question explains why it is asked', () => {
  for (const g of GROUPS) {
    for (const q of g.questions) {
      assert.ok(q.why && q.why.length > 20, `${q.key} needs a real "why"`);
    }
  }
});

test('groups are small enough not to be a giant form', () => {
  for (const g of GROUPS) {
    assert.ok(g.questions.length <= 4, `group "${g.id}" has too many questions at once`);
  }
});

test('normalizeAnswers splits lists and drops blanks', () => {
  const a = normalizeAnswers({ fullName: ' John Smith ', usernames: 'jsmith, js2000', primaryEmail: '  ' });
  assert.equal(a.fullName, 'John Smith');
  assert.deepEqual(a.usernames, ['jsmith', 'js2000']);
  assert.ok(!('primaryEmail' in a), 'a skipped answer must be absent, not empty');
});

test('assessCoverage is honest about what is missing', () => {
  const thin = assessCoverage({ fullName: 'John Smith' });
  assert.ok(thin.ok);
  assert.ok(thin.strength < 50);
  assert.ok(thin.gaps.some((g) => /location|address/i.test(g)));

  const rich = assessCoverage(SEED);
  assert.ok(rich.strength >= 75);
});

test('coverage refuses to start with no name', () => {
  assert.equal(assessCoverage({}).ok, false);
});

/* ============================================================== recheck */

section('recheck scheduling');

test('a stated timeframe drives the recheck date', () => {
  const base = Date.parse('2026-01-01T00:00:00Z');
  const days = (iso) => Math.round((Date.parse(iso) - base) / 86400_000);
  assert.equal(days(recheckDate('7 days', base)), 7);
  assert.equal(days(recheckDate('2 weeks', base)), 14);
  assert.equal(days(recheckDate('1 month', base)), 30);
});

test('business days get grace before we refile', () => {
  const base = Date.parse('2026-01-01T00:00:00Z');
  const plain = Date.parse(recheckDate('10 days', base));
  const business = Date.parse(recheckDate('10 business days', base));
  assert.ok(business > plain);
});

test('recheck is never sooner than 2 days', () => {
  const base = Date.parse('2026-01-01T00:00:00Z');
  const d = (Date.parse(recheckDate('1 hour', base)) - base) / 86400_000;
  assert.ok(d >= 2, 'checking the next morning just produces a false "still listed"');
});

/* ============================================================== explain */

const brokerExposure = {
  url: 'https://records-finder.test/p/paddy-iyer',
  matchScore: 0.91,
  fields: ['address', 'phone', 'relatives', 'age'],
  evidenceOfMatch: ['exact phone match', 'address matches', 'age within 1 year'],
  conflicts: [],
  removability: {
    category: CATEGORY.BROKER,
    removable: true,
    recommendedAction: 'Opt out / delete the record.',
  },
};

test('explain answers all four questions', () => {
  const x = explainExposure(brokerExposure, null);
  for (const key of ['howTheyGotIt', 'whyItsYou', 'whatSomeoneCouldDo', 'fastestRemoval']) {
    assert.ok(x[key], `missing ${key}`);
    assert.ok(x[key].text.length > 20, `${key} answered with nothing useful`);
  }
  assert.equal(x.domain, 'records-finder.test');
});

test('explain never invents a provenance story it does not have', () => {
  const x = explainExposure(
    { url: 'https://mystery.test/x', removability: { category: 'unknown' } }, null,
  );
  assert.match(x.howTheyGotIt.text, /not yet classified|cannot say/i);
  assert.equal(x.howTheyGotIt.hasUpstream, false);
});

test('explain says a name alone is weak evidence', () => {
  const x = explainExposure(
    { ...brokerExposure, matchScore: 0.42, evidenceOfMatch: ['name matches exactly'] }, null,
  );
  assert.match(x.whyItsYou.text, /name on its own is weak/i);
  assert.equal(x.whyItsYou.confidence, 42);
});

test('explain reports conflicts alongside the evidence', () => {
  const x = explainExposure(
    { ...brokerExposure, conflicts: ['age differs by 25 years'] }, null,
  );
  assert.match(x.whyItsYou.text, /Against that/);
  assert.match(x.whyItsYou.text, /25 years/);
});

test('explain names the strongest attack, not every overlapping one', () => {
  const x = explainExposure(brokerExposure, null);
  // address+phone (1.45) outranks relatives+age (1.3), and only it is headlined.
  assert.equal(x.whatSomeoneCouldDo.severity, 'serious');
  assert.ok(x.whatSomeoneCouldDo.combinations.length > 1, 'several combinations apply here');
  assert.match(x.whatSomeoneCouldDo.text, /locate and contact you directly/);
  assert.ok(x.whatSomeoneCouldDo.combinations.includes(x.whatSomeoneCouldDo.text));

  // Date of birth with an address is the identity-verification pair — severe.
  const worse = explainExposure(
    { ...brokerExposure, fields: ['birth_date', 'address'] }, null,
  );
  assert.equal(worse.whatSomeoneCouldDo.severity, 'severe');
});

test('explain does not overstate a lone low-risk field', () => {
  const x = explainExposure({ ...brokerExposure, fields: ['neighbors'] }, null);
  assert.equal(x.whatSomeoneCouldDo.severity, 'low');
});

test('a resold record is explained as one record, not many leaks', () => {
  const x = explainExposure(brokerExposure, null, { duplicateGroup: { acrossSites: 9 } });
  assert.match(x.howTheyGotIt.text, /one underlying record being resold/i);
  assert.equal(x.howTheyGotIt.resoldAcross, 9);
  // And the advice changes: do not start with this copy.
  assert.match(x.fastestRemoval.text, /Do not start here/i);
  assert.match(x.fastestRemoval.text, /prioritise/i);
});

test('a single listing is pointed at the site\'s own opt-out', () => {
  const x = explainExposure(brokerExposure, null);
  assert.match(x.fastestRemoval.text, /records-finder\.test's own opt-out/);
  assert.equal(x.fastestRemoval.realistic, true);
});

test('explain never tells anyone to pay a broker', () => {
  const x = explainExposure({ ...brokerExposure, paywalled: { price: '$27' } }, null);
  assert.match(x.fastestRemoval.text, /Do not pay/i);
});

test('explain does not promise removal where none exists', () => {
  const x = explainExposure({
    ...brokerExposure,
    removability: { category: CATEGORY.COURT, removable: false, note: 'Court records are public by default.' },
  }, null);
  assert.equal(x.fastestRemoval.realistic, false);
  assert.match(x.fastestRemoval.text, /public by default/i);
});

test('a page you control is not treated as a removal request', () => {
  const x = explainExposure({
    ...brokerExposure,
    removability: { category: CATEGORY.SOCIAL, removable: true, recommendedAction: 'Change the visibility setting.' },
  }, null);
  assert.match(x.fastestRemoval.text, /visibility setting/i);
  assert.match(x.fastestRemoval.text, /no service should be asking you for the password/i);
});

test('deletion is paired with do-not-sell so the record cannot be re-listed', () => {
  const x = explainExposure({
    ...brokerExposure,
    privacyChoices: { choices: ['delete', 'opt_out_sale'] },
  }, null);
  assert.match(x.fastestRemoval.text, /re-acquire and re-list/i);
});

/* ========================================================= opt-out routes */

const PAGE = 'https://records-finder.test/p/padmanabhan-iyer';
const footer = [
  { href: 'https://records-finder.test/', text: 'Home' },
  { href: 'https://records-finder.test/about', text: 'About us' },
  { href: 'https://records-finder.test/privacy-policy', text: 'Privacy Policy' },
  { href: 'https://records-finder.test/ccpa-request', text: 'California Privacy Rights' },
  { href: 'https://records-finder.test/opt-out', text: 'Do Not Sell My Personal Information' },
  { href: 'https://records-finder.test/contact', text: 'Contact' },
];

test('the removal route outranks the privacy policy', () => {
  const found = findOptOutLinks(footer, PAGE);
  assert.equal(found[0].url, 'https://records-finder.test/opt-out');
  assert.equal(found[0].route, ROUTE.REMOVAL);
  const policy = found.find((f) => /privacy-policy/.test(f.url));
  assert.ok(found[0].score > policy.score, 'the policy must never be offered first');
});

test('navigation links are not mistaken for removal routes', () => {
  const found = findOptOutLinks(footer, PAGE);
  const urls = found.map((f) => f.url);
  assert.ok(!urls.includes('https://records-finder.test/about'));
  assert.ok(!urls.includes('https://records-finder.test/'));
  assert.ok(!urls.includes('https://records-finder.test/contact'), 'a support page is not a removal route');
});

test('a URL path alone is enough when the link text is unhelpful', () => {
  const found = findOptOutLinks(
    [{ href: 'https://records-finder.test/do-not-sell-my-info', text: 'Click here' }], PAGE,
  );
  assert.equal(found[0].route, ROUTE.DO_NOT_SELL);
});

test('link text alone is enough when the URL is opaque', () => {
  const found = findOptOutLinks(
    [{ href: 'https://records-finder.test/x/9f2a', text: 'Remove my information' }], PAGE,
  );
  assert.equal(found[0].route, ROUTE.REMOVAL);
});

test('a brand containing "privacy" is not treated as a privacy route', () => {
  const found = findOptOutLinks(
    [{ href: 'https://privacyshieldhosting.test/pricing', text: 'Hosting' }], PAGE,
  );
  assert.equal(found.length, 0, 'the hostname must not be searched for these words');
});

test('an off-site privacy portal is ranked lower, not discarded', () => {
  const found = findOptOutLinks([
    { href: 'https://privacyportal.onetrust.test/webform/dsar', text: 'Submit a privacy request' },
    { href: 'https://records-finder.test/privacy-policy', text: 'Privacy Policy' },
  ], PAGE);
  const portal = found.find((f) => /onetrust/.test(f.url));
  assert.ok(portal, 'third-party consent platforms are a legitimate route');
  assert.equal(portal.sameSite, false);
  assert.ok(portal.score > found.find((f) => /privacy-policy/.test(f.url)).score);
});

test('a privacy mailbox counts; a support mailbox does not', () => {
  const found = findOptOutLinks([
    { href: 'mailto:support@records-finder.test', text: 'Email us' },
    { href: 'mailto:privacy@records-finder.test', text: 'Privacy team' },
  ], PAGE);
  assert.equal(found.length, 1);
  assert.equal(found[0].route, ROUTE.PRIVACY_CONTACT);
  assert.match(found[0].url, /privacy@/);
});

test('the same route linked twice is offered once', () => {
  const found = findOptOutLinks([
    { href: 'https://records-finder.test/opt-out', text: 'Opt out' },
    { href: 'https://records-finder.test/opt-out/', text: 'Opt Out' },
  ], PAGE);
  assert.equal(found.length, 1);
});

test('no links means no route, not a guessed one', () => {
  const found = findOptOutLinks([], PAGE);
  assert.equal(found.length, 0, 'inventing /opt-out here is how a confident 404 happens');
});

test('fallback searches are separately answerable, never one OR-soup', () => {
  const qs = optOutSearches('xome.com');
  assert.ok(qs.length >= 4);
  for (const q of qs) {
    assert.ok(!/\bOR\b/.test(q.text), `"${q.text}" mixes OR groups — engines return nothing for these`);
    assert.ok(q.why, 'every query says why it is worth running');
  }
  assert.match(qs[0].text, /^site:xome\.com/);
  // At least one must not use site:, for the common case of an unindexed page.
  assert.ok(qs.some((q) => !q.text.startsWith('site:')));
});

test('no fallback searches without a domain', () => {
  assert.deepEqual(optOutSearches(''), []);
});

/* =========================================================== bulk removal */

const inCA = buildProfile({
  fullName: 'Padmanabhan Iyer',
  address: '738 Bantry Ct Sunnyvale CA 94087',
  primaryEmail: 'paddy@example.com',
  phone: '(415) 555-0142',
  birthYear: '1984',
});
const inTX = buildProfile({ fullName: 'Padmanabhan Iyer', address: '1 Congress Ave Austin TX 78701' });
const inOH = buildProfile({ fullName: 'Padmanabhan Iyer', address: '1 Main St Columbus OH 43215' });

test('a Californian is offered the one-request platform', () => {
  const b = bulkRemovalFor(inCA);
  assert.equal(b.program, PROGRAM.CA_DROP);
  assert.equal(b.available, true);
  assert.match(b.url, /^https:\/\/consumer\.drop\.privacy\.ca\.gov/);
  assert.match(b.cost, /free/i);
});

test('the bulk route always states what it does not cover', () => {
  const b = bulkRemovalFor(inCA);
  assert.ok(b.doesNotCover.length >= 3);
  assert.ok(b.doesNotCover.some((x) => /public record|court|deed|voter/i.test(x)));
  assert.ok(b.doesNotCover.some((x) => /not registered|failed to register/i.test(x)));
  assert.match(b.timing, /not instant/i);
});

test('a state with a privacy law but no platform is told so plainly', () => {
  const b = bulkRemovalFor(inTX);
  assert.equal(b.available, false);
  assert.equal(b.program, PROGRAM.STATE_INDIVIDUAL);
  assert.match(b.headline, /no single form|one site at a time|only state/i);
});

test('a state with no deletion law still gets an honest answer, not silence', () => {
  const b = bulkRemovalFor(inOH);
  assert.equal(b.available, false);
  assert.equal(b.program, PROGRAM.NONE);
  assert.ok(b.how.length, 'the fallback still has to tell them what to do');
});

test('the EU and UK get erasure, and are not told a platform exists', () => {
  for (const [country, program] of [['DE', PROGRAM.GDPR_ERASURE], ['GB', PROGRAM.UK_ERASURE]]) {
    const b = bulkRemovalFor({ residence: { country } });
    assert.equal(b.program, program);
    assert.equal(b.available, false, 'there is no central erasure platform anywhere in Europe');
  }
});

test('no profile does not crash and claims nothing', () => {
  const b = bulkRemovalFor(null);
  assert.equal(b.available, false);
  assert.ok(b.note);
});

test('date of birth is never treated as something the console holds', () => {
  const r = bulkRemovalFor(inCA).readiness;
  assert.ok(r.supply.some((s) => s.key === 'birthDate'), 'birth date must always be user-supplied');
  const dob = r.supply.find((s) => s.key === 'birthDate');
  assert.match(dob.note, /1984/, 'it should acknowledge the year it does hold');
  assert.match(dob.note, /year only|full date/i);
  assert.equal(r.ready, false, 'a profile without a full DOB is not "ready"');
});

test('readiness reports what the user already has', () => {
  const r = bulkRemovalFor(inCA).readiness;
  const keys = r.have.map((h) => h.key);
  assert.ok(keys.includes('name'));
  assert.ok(keys.includes('zip'));
  assert.ok(keys.includes('email'));
});

test('the platform is never offered as something to automate', () => {
  const b = bulkRemovalFor(inCA);
  assert.match(b.identityNote, /never fill that in for you|never asks for the document/i);
});

test('broker listings are expected to be covered; public records are not', () => {
  const b = bulkRemovalFor(inCA);
  const broker = coveredByBulk({ removability: { category: CATEGORY.BROKER } }, b);
  assert.equal(broker.covered, true);

  for (const category of [CATEGORY.COURT, CATEGORY.GOVERNMENT, CATEGORY.JOURNALISM, CATEGORY.EMPLOYER]) {
    const c = coveredByBulk({ removability: { category } }, b);
    assert.equal(c.covered, false, `${category} must not be claimed as covered`);
    assert.ok(c.why, 'and it must say why, not just refuse');
  }
});

test('nothing is claimed as covered when no bulk route exists', () => {
  const b = bulkRemovalFor(inOH);
  const c = coveredByBulk({ removability: { category: CATEGORY.BROKER } }, b);
  assert.equal(c.covered, false, 'a Texan or Ohioan must never be told a platform handled it');
});

test('coverage is worded as an expectation, never a guarantee', () => {
  const c = coveredByBulk({ removability: { category: CATEGORY.BROKER } }, bulkRemovalFor(inCA));
  assert.ok(!/\bis covered\b|\bwill be deleted\b|\bguarantee/i.test(c.why),
    'only the register says who is registered — an unregistered broker is exactly the one still publishing you');
});

/* ======================================== console → agent handoff */

const consoleExport = {
  answers: { fullName: 'Padmanabhan Iyer', address: '738 Bantry Ct Sunnyvale CA 94087', phone: '(415) 555-0142' },
  profile: { names: [{ value: 'STALE NAME FROM AN OLD BUILD' }] },
  exposures: [
    { url: 'https://records-finder.test/a', matchScore: 0.93, status: STATE.CONFIRMED_EXPOSURE, fields: ['address'] },
    { url: 'https://other-broker.test/b', matchScore: 0.88, status: STATE.PENDING_REMOVAL, history: [{ to: STATE.CONFIRMED_EXPOSURE, at: '2026-08-01T00:00:00Z' }] },
    { url: 'https://not-me.test/c', matchScore: 0.2, status: STATE.FALSE_MATCH },
    { url: 'https://court.test/d', matchScore: 0.9, status: STATE.NOT_REMOVABLE },
    { url: 'not-a-url', matchScore: 0.9, status: STATE.CONFIRMED_EXPOSURE },
    { url: 'https://unscored.test/e', status: STATE.CONFIRMED_EXPOSURE },
  ],
};

test('a console export is recognised, and other JSON is not', () => {
  assert.equal(looksLikeConsoleExport(consoleExport), true);
  for (const junk of [null, 'text', 42, [], { unrelated: true }]) {
    assert.equal(looksLikeConsoleExport(junk), false, `${JSON.stringify(junk)} must be rejected`);
  }
  const bad = readConsoleExport({ unrelated: true });
  assert.equal(bad.ok, false);
  assert.match(bad.warnings[0], /does not look like a Privacy Console export/);
});

test('records the user rejected are never imported', () => {
  const r = readConsoleExport(consoleExport);
  assert.ok(!r.exposures.some((e) => /not-me\.test/.test(e.url)),
    'importing a known false match would file a removal against a stranger');
  assert.ok(r.skipped.some((s) => /not-me\.test/.test(s.url)));
  assert.ok(r.warnings.some((w) => /somebody else/.test(w)));
});

test('unusable records are skipped with a reason, not silently dropped', () => {
  const r = readConsoleExport(consoleExport);
  const reasons = Object.fromEntries(r.skipped.map((s) => [s.url, s.why]));
  assert.match(reasons['not-a-url'], /no usable URL/);
  assert.match(reasons['https://unscored.test/e'], /unscored/);
});

test('"submitted" is never inherited from the browser', () => {
  const r = readConsoleExport(consoleExport);
  const pending = r.exposures.find((e) => /other-broker/.test(e.url));
  assert.equal(pending.status, STATE.CONFIRMED_EXPOSURE,
    'the agent must witness a submission itself, not take the browser\'s word');
  assert.deepEqual(pending.history, consoleExport.exposures[1].history, 'but the history is kept');
});

test('"not removable" survives, because it is a finding rather than a claim', () => {
  const r = readConsoleExport(consoleExport);
  assert.equal(r.exposures.find((e) => /court\.test/.test(e.url)).status, STATE.NOT_REMOVABLE);
});

test('imported records are flagged as leads to verify, not pages the agent read', () => {
  const r = readConsoleExport(consoleExport);
  for (const e of r.exposures) {
    assert.equal(e.fromSnippet, true);
    assert.equal(e.importedFrom, 'web-console');
  }
});

test('the profile is rebuilt from answers, never trusted from the file', () => {
  const r = readConsoleExport(consoleExport);
  assert.deepEqual(r.answers, consoleExport.answers);
  assert.ok(!('profile' in r), 'a stale serialized profile must not cross the bridge');
});

test('an export with no answers says so instead of wiping the vault profile', () => {
  const r = readConsoleExport({ exposures: [] });
  assert.equal(r.ok, true);
  assert.equal(r.answers, null);
  assert.ok(r.warnings.some((w) => /keep the profile it already has/.test(w)));
});

test('an import never resets a removal the agent already filed', () => {
  const existing = [{ url: 'https://records-finder.test/a', status: STATE.PENDING_REMOVAL, caseNumber: 'AB-1' }];
  const { exposures, added, kept } = mergeExposures(existing, readConsoleExport(consoleExport).exposures);
  const same = exposures.find((e) => /records-finder\.test/.test(e.url));
  assert.equal(same.status, STATE.PENDING_REMOVAL, 'filing twice because of an import is a real harm');
  assert.equal(same.caseNumber, 'AB-1');
  assert.equal(kept, 1);
  assert.ok(added >= 2);
});

test('merging is case-insensitive on the URL', () => {
  const { added } = mergeExposures(
    [{ url: 'https://Records-Finder.test/a', status: STATE.PENDING_REMOVAL }],
    [{ url: 'https://records-finder.test/a', status: STATE.CONFIRMED_EXPOSURE }],
  );
  assert.equal(added, 0);
});

test('an exposure with no risk score gets one, rather than sinking the queue', () => {
  const r = readConsoleExport(consoleExport);
  for (const e of r.exposures) {
    assert.equal(typeof e.risk?.score, 'number', `${e.url} arrived without a usable risk score`);
    assert.ok(e.risk.band);
  }
});

test('a risk score already computed in the browser is kept', () => {
  const r = readConsoleExport({
    answers: { fullName: 'X' },
    exposures: [{ url: 'https://a.test/1', matchScore: 0.9, status: STATE.CONFIRMED_EXPOSURE, risk: { score: 77, band: 'high', explanation: 'from the console' } }],
  });
  assert.equal(r.exposures[0].risk.score, 77);
  assert.equal(r.exposures[0].risk.explanation, 'from the console');
});

test('the summary counts what the agent can actually act on', () => {
  const r = readConsoleExport(consoleExport);
  assert.match(r.summary, /3 exposures imported, 2 ready/);
});

/* ============================================== resuming a blocked step */

section('resume — handing the step back to the user');

const T0 = Date.parse('2026-08-10T12:00:00.000Z');

/** A blocked exposure, `agoMs` milliseconds ago. */
function blocked(needs, agoMs, extra = {}) {
  const at = new Date(T0 - agoMs).toISOString();
  return {
    id: 'e1',
    domain: 'example-broker.com',
    url: 'https://example-broker.com/p/someone',
    status: STATE.MANUAL_ACTION_REQUIRED,
    manualAction: { needs, note: 'blocked at the time', url: 'https://example-broker.com/opt-out' },
    history: [
      { from: STATE.FORM_IN_PROGRESS, to: STATE.MANUAL_ACTION_REQUIRED, at },
    ],
    updatedAt: at,
    ...extra,
  };
}

test('an unblocked exposure asks nothing of the user', () => {
  assert.equal(resumeFor({ status: STATE.PENDING_REMOVAL }), null);
  assert.equal(isBlocked({ status: STATE.PENDING_REMOVAL }), false);
});

test('payment demanded counts as waiting on the user', () => {
  assert.equal(isBlocked({ status: STATE.PAYMENT_DEMANDED }), true);
});

test('a fresh CAPTCHA block points at the open window', () => {
  const r = resumeFor(blocked('captcha', 60_000), T0);
  assert.equal(r.stale, false);
  assert.match(r.steps.join(' '), /window the agent opened/i);
});

test('the same CAPTCHA block tomorrow does not point at a window that closed', () => {
  const r = resumeFor(blocked('captcha', 26 * 60 * 60 * 1000), T0);
  assert.equal(r.stale, true);
  assert.doesNotMatch(r.steps.join(' '), /waiting/i);
  assert.match(r.steps.join(' '), /closed|again/i);
});

test('a one-time code goes stale far sooner than a browser session', () => {
  assert.ok(FRESHNESS_MS.code < FRESHNESS_MS.live_session);
  const fresh = resumeFor(blocked('verification_code', 2 * 60 * 1000), T0);
  const old = resumeFor(blocked('verification_code', 30 * 60 * 1000), T0);
  assert.equal(fresh.stale, false);
  assert.equal(old.stale, true);
  assert.match(old.steps.join(' '), /expired/i);
});

test('an emailed link survives overnight where a code does not', () => {
  const twelveHours = 12 * 60 * 60 * 1000;
  assert.equal(resumeFor(blocked('email_confirmation', twelveHours), T0).stale, false);
  assert.equal(resumeFor(blocked('verification_code', twelveHours), T0).stale, true);
});

test('a postal request never goes stale — the letter is still the letter', () => {
  const r = resumeFor(blocked('postal_request', 40 * 24 * 60 * 60 * 1000), T0);
  assert.equal(r.stale, false);
  assert.match(r.steps.join(' '), /print/i);
});

test('unknown age is treated as stale rather than assumed live', () => {
  const e = blocked('captcha', 0);
  e.history = [];
  delete e.updatedAt;
  const r = resumeFor(e, T0);
  assert.equal(r.ageMs, null);
  assert.equal(r.stale, true);
});

test('staleness reads the blocking transition, not a later unrelated edit', () => {
  const e = blocked('verification_code', 60 * 60 * 1000);
  // Something touched the record a moment ago without unblocking it.
  e.updatedAt = new Date(T0 - 1000).toISOString();
  const r = resumeFor(e, T0);
  assert.equal(r.stale, true, 'a re-score should not make an hour-old code look fresh');
});

test('blockedAt finds the most recent block when there were several', () => {
  const e = blocked('captcha', 60_000);
  e.history = [
    { from: STATE.FORM_IN_PROGRESS, to: STATE.MANUAL_ACTION_REQUIRED, at: new Date(T0 - 90_000_000).toISOString() },
    { from: STATE.MANUAL_ACTION_REQUIRED, to: STATE.FORM_IN_PROGRESS, at: new Date(T0 - 80_000_000).toISOString() },
    { from: STATE.FORM_IN_PROGRESS, to: STATE.MANUAL_ACTION_REQUIRED, at: new Date(T0 - 60_000).toISOString() },
  ];
  assert.equal(blockedAt(e), T0 - 60_000);
});

test('the agent’s original note is kept as context but never as the instruction', () => {
  const r = resumeFor(blocked('captcha', 26 * 60 * 60 * 1000), T0);
  assert.equal(r.agentNote, 'blocked at the time');
  assert.ok(!r.steps.includes('blocked at the time'));
});

test('a payment demand never tells the user to pay', () => {
  const e = blocked(null, 60_000, { status: STATE.PAYMENT_DEMANDED, manualAction: null });
  e.history = [{ from: STATE.REMOVAL_METHOD_FOUND, to: STATE.PAYMENT_DEMANDED, at: e.updatedAt }];
  const r = resumeFor(e, T0);
  const text = `${r.why} ${r.steps.join(' ')} ${r.thenWhat}`;
  assert.match(text, /never pays/i);
  assert.doesNotMatch(text, /pay the (site|fee)|enter your card/i);
});

test('sensitive-data blocks leave the decision with the user', () => {
  const r = resumeFor(blocked('sensitive_data', 60_000), T0);
  assert.match(r.thenWhat, /reasonable to stop/i);
});

test('record selection refuses to choose on the user’s behalf', () => {
  const r = resumeFor(blocked('record_selection', 60_000), T0);
  assert.match(r.why, /will not choose/i);
});

test('an unrecognised need still produces a usable instruction', () => {
  const r = resumeFor(blocked('something_new', 60_000), T0);
  assert.equal(r.needs, 'something_new');
  assert.ok(r.steps.length > 0);
  assert.equal(r.stale, false, 'the generic playbook has no stale variant to fall into');
});

test('a case number is surfaced separately, not buried in prose', () => {
  const e = blocked('email_confirmation', 60_000, {
    submission: { caseNumber: 'REQ-4471', submittedAt: '2026-08-09T10:00:00.000Z' },
  });
  assert.equal(resumeFor(e, T0).reference.caseNumber, 'REQ-4471');
  assert.equal(resumeFor(blocked('captcha', 60_000), T0).reference, null);
});

test('the queue is ordered by risk, not by which blocked first', () => {
  const low = blocked('captcha', 90_000, { id: 'low', risk: { score: 10 } });
  const high = blocked('captcha', 30_000, { id: 'high', risk: { score: 90 } });
  const order = resumeQueue([low, high], T0).map((r) => r.exposureId);
  assert.deepEqual(order, ['high', 'low']);
});

test('the queue leaves out everything that is not waiting on the user', () => {
  const q = resumeQueue([
    blocked('captcha', 60_000),
    { status: STATE.PENDING_REMOVAL },
    { status: STATE.SUCCESSFULLY_REMOVED },
  ], T0);
  assert.equal(q.length, 1);
});

test('the summary is honest about a backlog and silent when there is none', () => {
  assert.match(resumeSummary([], T0), /Nothing is waiting/);
  assert.match(resumeSummary([blocked('captcha', 60_000)], T0), /1 exposure needs/);
  const stale = resumeSummary([blocked('verification_code', 60 * 60 * 1000)], T0);
  assert.match(stale, /start that step again/);
});

/* ================================================================ report */

console.log('');
if (failures.length) {
  console.log('\x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`\n  \x1b[31m✗\x1b[0m ${f.name}`);
    console.log(`    ${f.err.message.split('\n').slice(0, 6).join('\n    ')}`);
  }
}
console.log(
  `\n${failed ? '\x1b[31m' : '\x1b[32m'}${passed} passed, ${failed} failed\x1b[0m\n`,
);
process.exit(failed ? 1 : 0);
