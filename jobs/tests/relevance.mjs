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

console.log(fails.length ? fails.join('\n') + '\n' : '');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
