/**
 * PaddySpeaks Search — relevance and integrity tests (no network, no browser).
 * Run: node lib/tests/search.mjs
 *
 * Runs the SHIPPED engine (lib/ps-search.js) against the COMMITTED index
 * (data/search/*.json), like jobs/tests/relevance.mjs does for JobSignal: a
 * change that degrades search fails the build rather than reaching the site.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const E = require(path.join(ROOT, 'lib/ps-search.js'));

const shards = ['core', 'verses', 'names', 'questions'];
const docs = shards.flatMap((n) => E.unpack(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/search', n + '.json'), 'utf8'))));

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push('✗ ' + m); } };
const top = (q, n = 10, opts) => E.rank(docs, q, opts).slice(0, n).map((r) => r.doc);
const ids = (q, n, opts) => top(q, n, opts).map((d) => d.id);

/* ── integrity ── */
const all = new Set();
let dup = 0;
docs.forEach((d) => { if (all.has(d.id)) dup++; all.add(d.id); });
ok(dup === 0, `document ids are unique (${dup} duplicates)`);
ok(docs.every((d) => typeof d.url === 'string' && /^\/(?!\/)/.test(d.url)), 'every url is site-relative');
ok(docs.every((d) => E.TYPE_LABEL[d.type]), 'every type has a label');
ok(docs.every((d) => d.title && d.title.trim()), 'every document has a title');
const types = new Set(docs.map((d) => d.type));
['article', 'sacred', 'verse', 'name', 'topic', 'question', 'company', 'demo', 'page'].forEach((t) =>
  ok(types.has(t), `index contains ${t} documents`));
ok(docs.filter((d) => d.type === 'verse').length >= 690, 'all Bhagavad Gita verses are indexed');
ok(docs.filter((d) => d.type === 'question').length >= 1500, 'all Interview Studio questions are indexed');

/* ── exact references resolve ── */
ok(ids('Bhagavad Gita 2.47', 1)[0] === 'gita:2.47', '"Bhagavad Gita 2.47" → that verse first');
ok(ids('gita 2:47', 1)[0] === 'gita:2.47', '"gita 2:47" → that verse');
ok(ids('bg 18.66', 1)[0] === 'gita:18.66', '"bg 18.66" → that verse');
ok(ids('2.47', 1)[0] === 'gita:2.47', 'a bare "2.47" → the verse');

/* ── the brief's example queries ── */
{
  const r = top('karma without attachment', 10);
  ok(r.slice(0, 5).every((d) => d.type === 'verse'), '"karma without attachment" → verses first');
  ok(r.some((d) => d.id === 'gita:3.7'), '"karma without attachment" finds Gita 3.7 (karma yoga without attachment)');
  ok(E.rank(docs, 'karma without attachment').some((r2) => r2.doc.id === 'gita:2.47'), '… and 2.47 is among the results');
}
{
  const r = top('spark skew', 3);
  ok(r[0] && r[0].type === 'topic' && /skew/i.test(r[0].title), '"spark skew" → a skew design topic first');
  ok(r.some((d) => /spark/i.test(d.title)), '"spark skew" → the Spark track in the top 3');
}
ok(ids('Meta', 1)[0] === 'company:meta', '"Meta" → the company, not "metadata"');
ok(ids('Meta data engineer', 8).includes('company:meta'), '"Meta data engineer" → Meta in the top 8');
{
  const cos = E.rank(docs, 'data engineer').filter((r) => r.doc.type === 'company');
  ok(cos.length < 10 && cos.every((r) => /\b(data|engineer)/i.test(r.doc.title)), 'a company appears only when the query names it (' + cos.map((r) => r.doc.title).join(', ') + ')');
}
ok(top('Senior Data Engineer', 5).some((d) => /senior/i.test(d.title)), '"Senior Data Engineer" → senior prep material');
ok(top('window functions', 3).some((d) => d.type === 'article'), '"window functions" → the article surfaces');

/* ── sacred language handling ── */
ok(top('govinda', 8).some((d) => d.type === 'name'), '"govinda" → divine names');
ok(ids('karmani', 30).includes('gita:2.47'), 'diacritic-free "karmani" matches karmaṇi (2.47)');
ok(top('lalitha', 1)[0].id === 'sacred:lalitha-sahasranama', '"lalitha" → the Lalitha Sahasranama app first');

/* ── filtering and shaping ── */
ok(top('meta', 50, { types: ['question'] }).every((d) => d.type === 'question'), 'type filter restricts results');
ok(E.rank(docs, 'zzqqxxv').length === 0, 'nonsense query → no results');
ok(E.rank(docs, '   ').length === 0, 'blank query → no results');
{
  const d = E.diversify(E.rank(docs, 'data'), 5, 24);
  const counts = {};
  d.forEach((r) => { counts[r.doc.type] = (counts[r.doc.type] || 0) + 1; });
  ok(Object.values(counts).every((c) => c <= 5), 'diversify caps each type at 5 when there is variety');
  const one = E.diversify(E.rank(docs, 'karma without attachment'), 5, 24);
  ok(one.length > 5, 'diversify backfills when every hit is one type');
}
ok(E.stem('attachment') === 'attach' && E.stem('meta') === 'meta' && E.stem('engineers') === 'engineer', 'stemming is light and safe');
ok(E.norm('Karmaṇy Evādhikāras') === 'karmany evadhikaras', 'norm strips diacritics and case');

console.log(fails.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
