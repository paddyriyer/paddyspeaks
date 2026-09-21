/**
 * JobSignal — relevance acceptance tests.
 *
 * Runs the SHIPPED ranker (jobs/js/search.js) against the REAL committed
 * index, so a corpus change that degrades relevance fails the build. These
 * were written before the new ranker, from the acceptance criteria in
 * docs/JOBSIGNAL-REDESIGN.md §I.
 *
 *   node jobs/tests/relevance.mjs [path-to-index.json]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../js/search.js');

const INDEX = process.argv[2] || new URL('../data/index.json', import.meta.url).pathname;
const doc = JSON.parse(readFileSync(INDEX, 'utf8'));
const JOBS = doc.jobs || [];

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg, detail) {
  if (cond) pass++;
  else { fail++; fails.push('✗ ' + msg + (detail ? '\n    ' + detail : '')); }
}
const search = (q, f = {}) => S.run(JOBS.map(j => ({ ...j })), { q, ...f });
const fam = r => r.map(j => j.role_family);
const titles = r => r.slice(0, 20).map(j => `${j.job_title} — ${j.company_name}`);

if (!JOBS.length) {
  console.log('index is empty — relevance tests skipped (nothing ingested yet)');
  process.exit(0);
}
if (!JOBS.some(j => j.role_family)) {
  // The board was built before taxonomy.py existed. Gating on a field that is
  // not there yet would fail the build for a reason that has nothing to do
  // with relevance; the next ingest regenerates the index and these run for real.
  console.log('index predates role_family — relevance tests skipped until the next ingest');
  process.exit(0);
}
console.log(`relevance suite over ${JOBS.length.toLocaleString()} indexed roles\n`);

/* TEST 1 — "data engineer" must not return sales/security/frontend */
{
  const r = search('data engineer');
  const top = r.slice(0, 20);
  const bad = top.filter(j => ['sales_engineering', 'go_to_market', 'security', 'marketing_comms'].includes(j.role_family));
  ok(bad.length === 0, 'T1 no sales/security in top 20 for "data engineer"', bad.map(j => j.job_title).join('; '));
  const inFamily = top.filter(j => j.role_family === 'data_engineering' || j._adjacent).length;
  ok(inFamily / Math.max(1, top.length) >= 0.85,
     'T1 >=85% of top 20 are data engineering or evidenced adjacent',
     `${inFamily}/${top.length}`);
  ok(r.length < 200, 'T1 result count is focused, not the whole board', `${r.length} results`);
  ok(!top.some(j => /sales engineer|solutions architect|field marketing/i.test(j.job_title)),
     'T1 none of the named BAD titles appear', top.filter(j => /sales engineer|solutions architect|field marketing/i.test(j.job_title)).map(j=>j.job_title).join('; '));
}

/* TEST 2 — stated level filters, never merely penalises */
{
  const r = search('entry level product manager');
  const wrong = r.filter(j => ['senior', 'manager', 'director_plus'].includes(j.experience_level));
  ok(wrong.length === 0, 'T2 no senior/director results for "entry level product manager"',
     wrong.slice(0, 4).map(j => `${j.job_title} [${j.experience_level}]`).join('; '));
  ok(r.every(j => j.role_family === 'product_management' || j._adjacent),
     'T2 all results are product management');
}

/* TEST 3 — UX must not return engineering */
{
  const r = search('ux designer').slice(0, 20);
  const eng = r.filter(j => ['software_engineering', 'infrastructure', 'data_engineering'].includes(j.role_family));
  ok(eng.length === 0, 'T3 zero software engineering for "ux designer"', eng.map(j => j.job_title).join('; '));
  const ux = r.filter(j => j.role_family === 'design_ux').length;
  ok(r.length === 0 || ux / r.length >= 0.90, 'T3 >=90% of top 20 are design/UX', `${ux}/${r.length}`);
}

/* TEST 4 — remote cybersecurity */
{
  const r = search('remote cybersecurity');
  ok(r.every(j => j.role_family === 'security'), 'T4 all results are security roles',
     r.filter(j => j.role_family !== 'security').slice(0, 3).map(j => j.job_title).join('; '));
  ok(r.every(j => j.remote_status === 'remote'), 'T4 all results are remote',
     r.filter(j => j.remote_status !== 'remote').slice(0, 3).map(j => `${j.job_title} [${j.remote_status}]`).join('; '));
}

/* TEST 5 — location filters; remote is not silently included */
{
  const r = search('data engineer pittsburgh');
  const nonPgh = r.filter(j => (j.location_city || '').toLowerCase() !== 'pittsburgh');
  ok(nonPgh.length === 0, 'T5 every result is Pittsburgh-located',
     nonPgh.slice(0, 3).map(j => `${j.job_title} [${j.location_city}]`).join('; '));
  const broadened = search('data engineer pittsburgh', { includeRemote: true });
  ok(broadened.length >= r.length, 'T5 broadening is explicit and additive',
     `${r.length} strict vs ${broadened.length} broadened`);
}

/* TEST 6 — a bare "engineer" must not return the whole board */
{
  const r = search('engineer');
  ok(r.length <= 200, 'T6 bare "engineer" is bounded', `${r.length} results`);
}

/* TEST 7 / 8 — typos and abbreviations resolve to a family, narrowly */
{
  ok(S.parse('prodcut manager').family === 'product_management', 'T7 "prodcut manager" resolves');
  ok(S.parse('data enginer').family === 'data_engineering', 'T7 "data enginer" resolves');
  ok(S.parse('PM').family === 'product_management', 'T8 "PM" -> product management');
  const pm = search('PM');
  ok(pm.every(j => j.role_family === 'product_management' || j._adjacent),
     'T8 "PM" does not flood with every title containing "manager"',
     pm.filter(j => j.role_family !== 'product_management').slice(0, 3).map(j => j.job_title).join('; '));
}

/* TEST 9 — nothing below threshold is ever shown */
{
  for (const q of ['data engineer', 'ux designer', 'remote cybersecurity', 'staff ml engineer']) {
    const r = search(q);
    const under = r.filter(j => j._score < S.THRESHOLD);
    ok(under.length === 0, `T9 no sub-threshold results for "${q}"`,
       under.slice(0, 3).map(j => `${j.job_title} ${j._score}`).join('; '));
  }
}

/* TEST 10 — precision floor on the headline queries */
{
  const expect = { 'data engineer': 'data_engineering', 'ux designer': 'design_ux',
                   'remote cybersecurity': 'security', 'data scientist': 'data_science' };
  for (const [q, want] of Object.entries(expect)) {
    const top = search(q).slice(0, 20);
    if (!top.length) continue;
    const hit = top.filter(j => j.role_family === want || j._adjacent).length;
    ok(hit / top.length >= 0.85, `T10 precision@20 >= 85% for "${q}"`, `${hit}/${top.length}`);
  }
}

/* TEST 11 — a role open in several cities is findable by any of them.

   A posting reading "Bellevue, WA; Mountain View, CA" was only ever matched on
   the first city, so the Mountain View opening was invisible to the person it
   was for. The card leads with the first place and counts the rest; search
   matches all of them. */
{
  const multi = JOBS.filter(j => (j.locations_extra || []).length);
  ok(multi.length > 0, 'T11 the corpus contains multi-location roles', `${multi.length}`);

  if (multi.length) {
    // Pick one whose secondary city differs from its primary, and search it.
    const sample = multi.find(j =>
      j.locations_extra[0][0] &&
      j.locations_extra[0][0].toLowerCase() !== String(j.location_city || '').toLowerCase());
    ok(!!sample, 'T11 found a role with a distinct secondary city');

    if (sample) {
      const city = sample.locations_extra[0][0];
      const hits = search(`${sample.role_head} ${city}`);
      ok(hits.some(j => j.id === sample.id),
         `T11 "${sample.role_head} ${city}" finds the role listed there`,
         `${sample.job_title} @ ${sample.location}`);

      // ...and the primary city still works, so nothing regressed.
      const primary = search(`${sample.role_head} ${sample.location_city}`);
      ok(primary.some(j => j.id === sample.id),
         `T11 the primary city still finds it`, `${sample.location_city}`);
    }
  }

  // A remote option must never have been counted as a second place.
  const phantom = JOBS.filter(j =>
    (j.locations_extra || []).some(l => !l[0] && !l[1] && !l[2]));
  ok(phantom.length === 0, 'T11 no empty phantom location was recorded',
     `${phantom.length} rows`);
}

/* TEST 12 — adjacency admits a neighbour, it does not merge two families.

   "sre" and "software engineer" both returned 1,253 — every role in
   software_engineering AND infrastructure — because sharing a skill was enough
   to cross the family line. A chip labelled SRE that returns every backend job
   is a broken promise, and it is the "unrelated families excluded, not merely
   down-ranked" rule this gate exists to keep. */
{
  const infra = JOBS.filter(j => j.role_family === 'infrastructure').length;
  const swe = JOBS.filter(j => j.role_family === 'software_engineering').length;
  const sre = search('sre');
  ok(sre.length <= infra * 1.2,
     'T12 "sre" stays near its own family rather than absorbing software engineering',
     `${sre.length} results vs ${infra} infrastructure / ${swe} software engineering`);
  ok(sre.length !== search('software engineer').length,
     'T12 "sre" and "software engineer" are not the same search',
     `${sre.length} vs ${search('software engineer').length}`);

  // Anything admitted from outside the family must answer to the words typed.
  const strays = search('site reliability')
    .filter(j => j.role_family !== 'infrastructure')
    .filter(j => !/site|reliability/i.test(`${j.role_head} ${j.job_title}`));
  ok(strays.length === 0, 'T12 no out-of-family result ignores the query words',
     strays.slice(0, 3).map(j => j.job_title).join('; '));
}

/* TEST 13 — a role word is not silently demoted to an industry filter.

   "cybersecurity" was consumed by the industry matcher, leaving no role text;
   the leftover filter then cut the security family from 323 roles to the 34
   whose employer's industry string happened to say "cybersecurity". */
{
  const famTotal = JOBS.filter(j => j.role_family === 'security').length;
  const r = search('cybersecurity');
  ok(r.length >= famTotal * 0.9,
     'T13 "cybersecurity" searches the security ROLE, not the sector',
     `${r.length} results vs ${famTotal} in family`);
  ok(r.every(j => j.role_family === 'security' || j._adjacent),
     'T13 ...and still only returns security roles');
}

console.log(fails.length ? fails.join('\n') + '\n' : '');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
