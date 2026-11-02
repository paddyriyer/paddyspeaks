#!/usr/bin/env node
/**
 * The Upaniṣads — study editions build.
 *
 * Sources (never edit the pages; edit these and rebuild):
 *   upanishads/data/collection.json        which editions exist
 *   upanishads/data/glossary.json          the glossary (IAST generated here)
 *   upanishads/data/principal.json         the ten principal Upaniṣads (comparison table)
 *   upanishads/data/guide/*.json           Introduction, How to Study
 *   upanishads/<id>/edition/text.json      the verified Sanskrit
 *   upanishads/<id>/edition/corrections.json  every witness difference, classified
 *   upanishads/<id>/edition/edition.json   witness and commentary mapping
 *   upanishads/<id>/edition/witnesses/     witnesses, commentaries, parallels
 *   upanishads/<id>/edition/analysis/NN.json  one record per mantra (14 sections)
 *   upanishads/<id>/edition/studies/*.json the special studies
 *   upanishads/<id>/edition/landing.json   the edition's landing page
 *   upanishads/<id>/edition/map.json       the concept map
 *   upanishads/lib/edition.css, reader.js  styles and reader controls (?v=<hash>)
 *
 *   node scripts/upanishads/build.mjs          write every page
 *   node scripts/upanishads/build.mjs --check  CI: fail if a page is stale
 *
 * Run scripts/upanishads/check.py first: it proves the text, the collation,
 * every padaccheda, every quotation and every parallel (docs/UPANISHADS-EDITION.md).
 * IAST is generated from the Devanagari (scripts/lalitha/translit.mjs), never typed.
 * Everything on a mantra page is in the HTML; the reading paths only decide which
 * sections are open when the page loads (reader.js), so nothing is locked.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dev2iast } from '../lalitha/translit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (p) => path.join(ROOT, p);
const SITE = 'https://paddyspeaks.com';
const CHECK = process.argv.includes('--check');
const J = (p) => JSON.parse(fs.readFileSync(A(p), 'utf8'));
const has = (p) => fs.existsSync(A(p));
const COLL = J('upanishads/data/collection.json');
const GLOSS = J('upanishads/data/glossary.json');
const PRIN = J('upanishads/data/principal.json');
// an edition is linked from the comparison table only once it is published
const LIVE = new Set(COLL.editions.filter((e) => e.status === 'available').map((e) => e.path));
const hashOf = (p) => crypto.createHash('sha256').update(fs.readFileSync(A(p))).digest('hex').slice(0, 10);
const CSS = `/upanishads/lib/edition.css?v=${hashOf('upanishads/lib/edition.css')}`;
const JS = `/upanishads/lib/reader.js?v=${hashOf('upanishads/lib/reader.js')}`;

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIG = '०१२३४५६७८९';
const devNum = (n) => String(n).replace(/\d/g, (d) => DIG[d]);
const pad2 = (n) => String(n).padStart(2, '0');
const ACC = /[॒॑᳐-᳿꣠-꣱]/g;
const iast = (dev) => dev2iast(String(dev).replace(ACC, '').replace(/ॐ/g, 'ओम्').replace(/ओं/g, 'ओम्')).replace(/\s*\|\|\s*/g, ' \u2016 ').replace(/\s*\|\s*/g, ' | ').replace(/\u2016/g, '||').replace(/\s+/g, ' ').trim();
const DEVRUN = /([ऀ-ॿ᳐-᳿][ऀ-ॿ᳐-᳿\s'‘’ऽ।॥,\-–—()]*[ऀ-ॿ᳐-᳿।॥]|[ऀ-ॿ])/g;
/** Escape prose and mark Sanskrit: «quotation» becomes a quoted Devanagari span. */
function rich(s) {
  let t = esc(s);
  t = t.replace(/«([^»]+)»/g, (m, q) => `<q class="sq" lang="sa">${q}</q>`);
  // wrap remaining Devanagari runs that are not already in a quotation
  t = t.split(/(<q class="sq" lang="sa">[^<]*<\/q>)/).map((part) => part.startsWith('<q ') ? part : part.replace(DEVRUN, '<span lang="sa">$1</span>')).join('');
  return t;
}
const paras = (arr) => (arr || []).map((p) => `<p>${rich(p)}</p>`).join('\n');
const ORN = '<p class="orn" aria-hidden="true"><span>✲</span></p>';
const LABEL = {
  direct: 'Direct Textual Meaning', traditional: 'Traditional Interpretation', comparative: 'Comparative Vedānta',
  linguistic: 'Linguistic and Textual Analysis', reflection: 'Contemporary Reflection', historical: 'Academic History',
};
const chip = (l) => `<span class="lab lab-${esc(l)}">${esc(LABEL[l] || l)}</span>`;
const BASIS = { commentary: 'From the school’s commentary on this mantra', doctrine: 'A securely sourced doctrine of the school', inference: 'A modern comparative inference' };
const SCHOOL = { advaita: 'Advaita', visistadvaita: 'Viśiṣṭādvaita', dvaita: 'Dvaita' };
const PAR = { 'direct-parallel': 'Direct textual parallel', doctrinal: 'Doctrinal comparison', thematic: 'Modern thematic association' };
const VCLASS = { orthographic: 'Spelling only', variant: 'Variant reading', recension: 'Other recension', 'witness-error': 'Witness error', review: 'Verification required' };
const WORKNAME = { BG: 'Bhagavad Gītā', BU: 'Bṛhadāraṇyaka Upaniṣad', GBU: 'Bṛhadāraṇyaka Upaniṣad', KaU: 'Kaṭha Upaniṣad', MuU: 'Muṇḍaka Upaniṣad', ChU: 'Chāndogya Upaniṣad', KeU: 'Kena Upaniṣad', TU: 'Taittirīya Upaniṣad', BS: 'Brahmasūtra', BSBh: 'Śaṅkara on Brahmasūtra', RV: 'Ṛgveda', AiU: 'Aitareya Upaniṣad', PrU: 'Praśna Upaniṣad', GMaU: 'Māṇḍūkya Upaniṣad', MuktU: 'Muktikā Upaniṣad', KaUBh: 'Śaṅkara on the Kaṭha' };
const refName = (r) => { const [p, n] = r.split(' '); return `${WORKNAME[p] || p} ${n || ''}`.trim(); };

/* ---------------- page shell ---------------- */
const FONTS = 'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit:ital@0;1&family=Noto+Serif+Devanagari:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';
function shell({ title, desc, url, body, nav, crumbs = [], reader = false, ld = null, prov = 'upanishads' }) {
  const navHTML = nav.map(([href, label, cur]) => `<a href="${href}"${cur ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const crumb = crumbs.length ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([h, l], i) => i === crumbs.length - 1 ? `<li aria-current="page">${l}</li>` : `<li><a href="${h}">${l}</a></li>`).join('')}</ol></nav>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | PaddySpeaks</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="book">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:site_name" content="PaddySpeaks">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#34405e">
<meta name="author" content="Paddy Iyer">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="${CSS}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="ps:continue" content="sacred" data-title="${esc(title)}">
</head>
<body class="up">
<a class="skip-link" href="#main">Skip to the content</a>
<header class="site-bar">
<a class="brand" href="/upanishads/"><span class="brand-dev" lang="sa">उपनिषदः</span><span class="brand-en">The Upaniṣads</span></a>
<nav class="site-nav" aria-label="Upaniṣads">${navHTML}<a class="to-sacred" href="/sacred/">Sacred Library</a></nav>
</header>
${reader ? READER : ''}<main id="main">
${crumb}${body}
</main>
<footer class="site-foot">
${ORN}
<p><span lang="sa">ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते ।</span></p>
<p>The Upaniṣads · A study edition in the PaddySpeaks Sacred Library · Sanskrit verified against declared witnesses; analysis machine-checked and awaiting scholarly review</p>
<p><a href="/upanishads/">Collection</a> · <a href="/upanishads/introduction.html">Introduction</a> · <a href="/upanishads/how-to-study.html">How to Study</a> · <a href="/upanishads/glossary.html">Glossary</a> · <a href="/sacred/">Sacred Library</a> · <a href="${SITE}/">PaddySpeaks</a></p>
</footer>
<script defer src="${JS}"></script>
<script defer src="/lib/ps.js"></script>
<script defer src="/lib/ps-sources.js" data-provenance="${prov}"></script>
<script defer src="/lib/ps-platform.js"></script>
</body>
</html>
`;
}
const READER = `<div class="reader-bar" id="reader-bar" hidden>
<div class="rb-paths" role="radiogroup" aria-label="Reading path">
<button type="button" role="radio" data-path="1" aria-checked="false">Curious Reader</button><button type="button" role="radio" data-path="2" aria-checked="true">Serious Student</button><button type="button" role="radio" data-path="3" aria-checked="false">Scholar</button>
</div>
<button type="button" class="rb-btn rb-aa" aria-expanded="false" aria-controls="rb-panel" title="Script and text size">Aa</button>
<div class="rb-panel" id="rb-panel" hidden>
<div class="rp-row"><span class="rp-k" id="rp-script">Script</span><span class="rp-v" role="radiogroup" aria-labelledby="rp-script"><button type="button" role="radio" data-script="both" aria-checked="true">Both</button><button type="button" role="radio" data-script="dev" aria-checked="false" lang="sa">देवनागरी</button><button type="button" role="radio" data-script="iast" aria-checked="false">IAST</button></span></div>
<div class="rp-row"><span class="rp-k">Sanskrit size</span><span class="rp-v"><button type="button" data-sa="-1" aria-label="Smaller Sanskrit">A−</button><button type="button" data-sa="1" aria-label="Larger Sanskrit">A+</button></span></div>
<div class="rp-row"><span class="rp-k">English size</span><span class="rp-v"><button type="button" data-en="-1" aria-label="Smaller English">A−</button><button type="button" data-en="1" aria-label="Larger English">A+</button></span></div>
<div class="rp-row"><span class="rp-k">Sections</span><span class="rp-v"><button type="button" data-all="open">Open all</button><button type="button" data-all="path">As path</button></span></div>
</div>
<p class="sr" aria-live="polite" id="rb-live"></p>
</div>
`;

/* ---------------- output ---------------- */
const written = new Map();
function out(rel, html) { written.set(rel, html); }

/* ---------------- edition model ---------------- */
function loadEdition(id) {
  const base = `upanishads/${id}/edition`;
  const T = J(`${base}/text.json`);
  const C = J(`${base}/corrections.json`);
  const CFG = J(`${base}/edition.json`);
  const W = {};
  for (const f of fs.readdirSync(A(`${base}/witnesses`))) if (f.endsWith('.json')) W[f] = J(`${base}/witnesses/${f}`);
  // A record is one page: an Īśā mantra (one unit) or a Taittirīya anuvāka (its
  // units are Bhāskara/Sāyaṇa's ॥N॥ divisions, anchored on the page).
  const VALLI = !!T.vallis;
  const recs = VALLI
    ? T.vallis.flatMap((v) => v.anuvakas.map((a) => ({ key: a.id, n: a.n, valli: v, units: a.units, aid: `a${a.id.replace('.', '-')}`, file: `${v.n}-${pad2(a.n)}`, url: `/upanishads/${id}/anuvaka-${v.n}-${pad2(a.n)}.html`, label: `Anuvāka ${a.id}` })))
    : T.mantras.map((m) => ({ key: String(m.n), n: m.n, units: [{ id: String(m.n), n: m.n, lines: m.lines }], aid: `m${m.n}`, file: pad2(m.n), url: `/upanishads/${id}/mantra-${pad2(m.n)}.html`, label: `Mantra ${m.n}` }));
  recs.forEach((r, i) => { r.i = i; r.lines = r.units.flatMap((u) => u.lines); });
  const AN = new Map();
  for (const r of recs) { const p = `${base}/analysis/${r.file}.json`; if (has(p)) AN.set(r.key, J(p)); }
  const studies = has(`${base}/studies`) ? fs.readdirSync(A(`${base}/studies`)).filter((f) => f.endsWith('.json')).map((f) => J(`${base}/studies/${f}`)).sort((a, b) => a.n - b.n) : [];
  const landing = has(`${base}/landing.json`) ? J(`${base}/landing.json`) : null;
  const map = has(`${base}/map.json`) ? J(`${base}/map.json`) : null;
  const byKey = Object.fromEntries(recs.map((r) => [r.key, r]));
  const REC = VALLI ? 'anuvāka' : 'mantra';
  return { id, base, T, C, CFG, W, AN, studies, landing, map, recs, byKey, VALLI, REC, RECS: VALLI ? 'anuvākas' : 'mantras', short: CFG.short || T.title.en, dir: `/upanishads/${id}/`, PAR: W['parallels.json'].passages };
}
function witnessReading(ed, wid, n) {
  const spec = ed.CFG.witnesses[wid];
  const data = ed.W[spec.file].mantras;
  const keys = spec.map && spec.map[String(n)] !== undefined ? spec.map[String(n)] : [String(n)];
  if (!keys) return null;
  const parts = keys.filter((k) => data[k]).map((k) => data[k].join(' '));
  return parts.length ? { text: parts.join(' '), keys } : null;
}
const mUrl = (ed, n) => ed.byKey[String(n)].url;
// the record a variant belongs to (Madhva's Taittirīya readings are collated by vallī, `near` the anuvāka)
const vKey = (v) => String(v.near ?? v.at);
const recWord = (ed, k) => (ed.VALLI ? `Anuvāka ${k}` : `Mantra ${k}`);
const glossById = Object.fromEntries(GLOSS.terms.map((t) => [t.id, t]));

/* ---------------- mantra page ---------------- */
function details(id, lvl, n, title, inner, extraClass = '') {
  return `<details class="sec ${extraClass}" id="${id}" data-lvl="${lvl}"${lvl <= 2 ? ' open' : ''}><summary><span class="sec-n">${n}</span> <span class="sec-t">${title}</span></summary><div class="sec-b">${inner}</div></details>`;
}
function mantraLines(m, num = false) {
  const last = m.lines.length - 1;
  return m.lines.map((l, i) => `<span class="ln">${esc(l.replace(/\s*॥\s*[०-९]+\s*॥\s*$/, ''))}${i === last ? (num ? ` <span class="mn">॥ ${devNum(m.n)} ॥</span>` : ' ॥') : ''}</span>`).join('');
}
const NUMWORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const valliName = (v) => v.title.en;
function recordPage(ed, r) {
  const e = ed.AN.get(r.key);
  const N = ed.T.count;
  const id = r.aid;
  const REC = ed.REC;
  const prev = ed.recs[r.i - 1] || null;
  const next = ed.recs[r.i + 1] || null;
  const multi = r.units.length > 1;
  const sv = ed.CFG.svara || {};
  const variants = ed.C.variants.filter((v) => vKey(v) === r.key);
  const corr = ed.C.corrections.filter((c) => String(c.at) === r.key);
  const unitLine = (u, l) => esc(iast(l.replace(/\s*॥\s*[०-९]+\s*॥\s*$/, ed.VALLI ? ` ॥ ${devNum(u.n)} ॥` : ' ॥')));
  const where = ed.VALLI ? `${valliName(r.valli)} · Anuvāka ${r.n} of ${r.valli.anuvakas.length}` : `Mantra ${r.n} of ${N}`;
  const allHref = ed.VALLI ? `${ed.dir}#v${r.valli.n}` : `${ed.dir}#mantras`;
  const allN = ed.VALLI ? r.valli.anuvakas.length : N;
  let h = `<article class="mantra" id="${id}" aria-labelledby="${id}-h">
<header class="m-hero">
<p class="kicker">${esc(ed.T.title.en)} · ${where}</p>
<h1 id="${id}-h"><span class="h-en">${esc(e ? e.title : r.label)}</span></h1>
${e && e.theme ? `<p class="h-i">${rich(e.theme)}</p>` : ''}
<nav class="m-nav" aria-label="${ed.VALLI ? 'Anuvākas' : 'Mantras'}">${prev ? `<a href="${prev.url}" rel="prev">‹ ${prev.label}</a>` : '<span></span>'}<a href="${allHref}">All ${allN}</a>${next ? `<a href="${next.url}" rel="next">${next.label} ›</a>` : '<span></span>'}</nav>
</header>`;
  // 1. Original Sanskrit
  h += `<section class="s1" aria-labelledby="${id}-s1"><h2 class="sec-h" id="${id}-s1"><span class="sec-n">1</span> Original Sanskrit</h2>`;
  if (ed.VALLI && r.n === 1 && r.valli.shanti) h += `<div class="pre-shanti"><p class="note">Recited before the ${esc(valliName(r.valli))}; not part of the numbered text.</p><p class="v-sa" lang="sa">${r.valli.shanti.lines.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p></div>`;
  h += `
<div class="v-text">${r.units.map((u) => `<p class="v-sa" lang="sa"${ed.VALLI ? ` id="u${u.id.replace(/\./g, '-')}"` : ''}>${mantraLines({ lines: u.lines, n: u.n }, true)}</p>`).join('')}
<button type="button" class="copy" data-copy="${esc(r.lines.join('\n'))}">Copy</button></div>`;
  const svW = sv.witness && ed.CFG.witnesses[sv.witness] ? ed.W[ed.CFG.witnesses[sv.witness].file] : null;
  const accented = !svW ? [] : ed.VALLI
    ? r.units.map((u) => (svW.units || {})[u.id] ? { k: u.id, text: svW.units[u.id].join(' ') } : null).filter(Boolean)
    : (() => { const k = witnessReading(ed, sv.witness, r.key); return k ? [{ k: k.keys.join('+'), text: k.text }] : []; })();
  if (accented.length) {
    const differs = variants.some((v) => v.witness === sv.witness && v.class !== 'orthographic');
    h += `<details class="svara" data-lvl="3"><summary>Accented text <span>· ${ed.VALLI ? `${esc(sv.label)}, as the witness keys it` : `${esc(sv.prefix)}${esc(accented[0].k)}, as the witness keys it`}</span></summary>${accented.map((a) => `<p class="v-sa acc" lang="sa">${esc(a.text.replace(/॥\s*[०-९]+\s*॥\s*$/, '॥'))}</p>`).join('')}<p class="note">Svara is shown only from this witness and only as it is keyed; it is not proof-read or reconstructed. ${differs ? `<b>This witness reads differently at this ${REC}; see section 14.</b>` : 'Its letters agree with the edited text (spelling of nasals aside).'}</p></details>`;
  } else h += `<p class="note">No accented witness is available for this ${REC}.</p>`;
  h += `</section>`;
  // 2. IAST
  h += `<section class="s2" aria-labelledby="${id}-s2"><h2 class="sec-h" id="${id}-s2"><span class="sec-n">2</span> IAST transliteration</h2>${r.units.map((u) => `<p class="v-iast" lang="sa-Latn">${u.lines.map((l) => `<span class="ln">${unitLine(u, l)}</span>`).join('')}</p>`).join('')}</section>`;
  const pager = () => `<nav class="pager" aria-label="Previous and next ${REC}">${prev ? `<a href="${prev.url}" rel="prev"><span class="pg-k">Previous</span><span class="pg-sa" lang="sa">${esc(prev.lines[0])}</span><span class="pg-en">${prev.label}${ed.AN.get(prev.key) ? ` · ${esc(ed.AN.get(prev.key).title)}` : ''}</span></a>` : '<span></span>'}${next ? `<a class="pg-next" href="${next.url}" rel="next"><span class="pg-k">Next</span><span class="pg-sa" lang="sa">${esc(next.lines[0])}</span><span class="pg-en">${next.label}${ed.AN.get(next.key) ? ` · ${esc(ed.AN.get(next.key).title)}` : ''}</span></a>` : `<a class="pg-next" href="${ed.dir}studies/"><span class="pg-k">Continue</span><span class="pg-en">The ${NUMWORD[ed.studies.length] || ed.studies.length} special studies</span></a>`}</nav>`;
  const cite = `<p class="cite note">Cite this ${REC}: <i>${esc(ed.T.title.en)}</i> ${r.key}, PaddySpeaks study edition, ${SITE}${r.url}</p></article>`;
  if (!e) {
    h += `<p class="pending">The analysis of this ${REC} is in preparation.${ed.VALLI ? ` The Sanskrit above is the verified text: it equals the base witness apart from the logged corrections, and every difference of the other witnesses is classified on the <a href="${ed.dir}sources.html#variants">sources page</a>. The word-by-word analysis, translations and commentary follow vallī by vallī.` : ''}</p>`;
    if (!ed.VALLI) return h + `</article>`;
    return h + pager() + cite;
  }
  const U = e.units || [{ ...e, id: r.key }];
  const uh = (u) => (multi ? `<h3 class="unit-h"><a href="#u${u.id.replace(/\./g, '-')}">${esc(u.id)}</a></h3>` : '');
  const nWords = U.reduce((a, u) => a + u.padaccheda.flat().length, 0);
  const anyExc = U.some((u) => (u.sandhi_exceptions || []).length);
  // 3. Padaccheda
  h += details(`${id}-s3`, 2, 3, 'Padaccheda <span>· the words separated</span>',
    `${U.map((u) => `${uh(u)}<p class="pada-sa" lang="sa">${u.padaccheda.map((ln) => `<span class="ln">${ln.map((w) => `<span class="pw">${esc(w)}</span>`).join(' <span class="psep" aria-hidden="true">·</span> ')}</span>`).join('')}</p><p class="pada-iast" lang="sa-Latn">${u.padaccheda.map((ln) => `<span class="ln">${ln.map((w) => esc(iast(w))).join(' · ')}</span>`).join('')}</p>`).join('')}<p class="note">Proven: the checker rejoins these words by the rules of sandhi and they spell the ${REC} exactly${anyExc ? ', with the junctions listed in section 10 as exceptions' : ''}.</p>`);
  // 4. Word by word
  h += details(`${id}-s4`, 2, 4, `Word by word <span>· ${nWords} words</span>`,
    U.map((u) => `${uh(u)}<div class="tw" tabindex="0"><table class="words"><caption class="sr">Word-by-word analysis of ${REC} ${esc(u.id)}</caption><thead><tr><th scope="col">Word</th><th scope="col">Meaning in context</th><th scope="col">Role</th><th scope="col">Form</th></tr></thead><tbody>${u.words.map((w) => `<tr><th scope="row"><span class="w-d" lang="sa">${esc(w.w)}</span><span class="w-i" lang="sa-Latn">${esc(iast(w.w))}</span></th><td>${rich(w.meaning)}${w.context ? `<span class="w-c">${rich(w.context)}</span>` : ''}</td><td>${rich(w.role)}</td><td>${rich(w.gram)}<span class="w-b">${w.base ? `stem/root <span lang="sa">${esc(w.base)}</span>` : ''}</span></td></tr>`).join('')}</tbody></table></div>`).join(''));
  // 5. Faithful translation
  h += details(`${id}-s5`, 2, 5, 'Faithful English translation', `${U.map((u) => `${multi ? `<p class="tr-lit"><span class="un">${esc(u.id)}</span> ${rich(u.translation.literal)}</p>` : `<p class="tr-lit">${rich(u.translation.literal)}</p>`}`).join('')}<p class="note">Word for word; words supplied for English are in [brackets].</p>`);
  // 6. Readable
  h += `<section class="s6" aria-labelledby="${id}-s6"><h2 class="sec-h" id="${id}-s6"><span class="sec-n">6</span> Readable English <span class="interp">an interpretive rendering, not a literal translation</span></h2><blockquote class="tr-read">${U.map((u) => `<p>${multi ? `<span class="un">${esc(u.id)}</span> ` : ''}${rich(u.translation.readable)}</p>`).join('')}</blockquote>
${(e.key_concepts || []).length ? `<p class="concepts" data-lvl="2"><span class="lbl">Key concepts</span> ${e.key_concepts.map((c) => glossById[c] ? `<a class="kc" href="/upanishads/glossary.html#${c}"><span lang="sa">${esc(glossById[c].sa)}</span> ${esc(glossById[c].en)}</a>` : '').join(' ')}</p>` : ''}</section>`;
  // 7. Beginner
  h += details(`${id}-s7`, 1, 7, 'Explain it to a beginner', `<p class="beg">${rich(e.beginner)}</p><p class="analogy"><span class="lbl">An analogy</span> ${rich(e.analogy)}</p>`);
  // 8. Traditional commentary
  h += details(`${id}-s8`, 2, 8, 'Traditional philosophical commentary',
    (e.commentary || []).map((c) => `<div class="cm">${chip(c.label)}<h3 class="cm-q">${rich(c.q)}</h3>${paras([c.text])}</div>`).join(''));
  // 9. Comparative Vedānta
  const sch = e.schools || {};
  h += details(`${id}-s9`, 3, 9, 'Comparative Vedānta',
    `${chip('comparative')}${['advaita', 'visistadvaita', 'dvaita'].map((s) => sch[s] ? `<div class="school sch-${s}"><h3>${SCHOOL[s]} <span class="who">· ${esc(sch[s].who || '')}${sch[s].ref ? `, ${esc(sch[s].ref)}` : ''}</span></h3><p class="basis">${esc((BASIS[sch[s].basis] || sch[s].basis).replace('this mantra', `this ${REC}`))}</p>${paras([sch[s].text])}</div>` : `<div class="school sch-${s}"><h3>${SCHOOL[s]}</h3><p class="note">No position is given for this school here: the edition does not force one.</p></div>`).join('')}${sch.disagreement ? `<div class="disagree"><h3>Where they disagree</h3>${paras([sch.disagreement])}</div>` : ''}`);
  // 10. Advanced Sanskrit analysis
  const all = (f) => U.flatMap((u) => (u[f] || []).map((x) => ({ ...x, _u: u })));
  const sandhi = all('sandhi'), samasa = all('samasa'), morph = all('morphology');
  const ut = (x) => (multi ? `<span class="un">${esc(x._u.id)}</span> ` : '');
  let adv = chip('linguistic');
  adv += `<h3>Sandhi and sandhi-viccheda</h3>${sandhi.length ? `<ul class="cards">${sandhi.map((x) => `<li><p class="c-h">${ut(x)}<span class="c-sa" lang="sa">${esc(x.joined)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(x.joined))}</span> <span class="arr" aria-hidden="true">→</span> <span class="c-sa" lang="sa">${esc(x.split.join(' + '))}</span></p><p class="c-tag">${esc(x.type)}</p><p>${rich(x.rule)}</p></li>`).join('')}</ul>` : '<p class="none">No junction needs comment.</p>'}`;
  if (anyExc) adv += `<p class="c-tag">Junctions outside the general rules</p><ul class="plain">${U.flatMap((u) => { const flat = u.padaccheda.flat(); return (u.sandhi_exceptions || []).map((x) => `<li>${multi ? `<span class="un">${esc(u.id)}</span> ` : ''}<span lang="sa">${esc(flat[x.after])} · ${esc(flat[x.after + 1] || '')}</span> — <i>${esc(x.kind)}</i>: ${rich(x.note)}</li>`); }).join('')}</ul>`;
  adv += `<h3>Samāsa and samāsa-vigraha</h3>${samasa.length ? `<ul class="cards">${samasa.map((x) => `<li><p class="c-h">${ut(x)}<span class="c-sa" lang="sa">${esc(x.word)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(x.word))}</span></p><p class="c-tag">${esc(x.type)} · ${x.members.map((mm) => `<span lang="sa">${esc(mm)}</span>`).join(' + ')}</p><p><span class="lbl">Vigraha</span> <span lang="sa">${esc(x.vigraha)}</span></p><p>${rich(x.meaning)}</p></li>`).join('')}</ul>` : `<p class="none">No compound in this ${REC}.</p>`}`;
  adv += `<h3>Morphology</h3>${morph.length ? `<dl class="kv">${morph.map((x) => `<dt lang="sa">${ut(x)}${esc(x.word)}</dt><dd>${rich(x.note)}</dd>`).join('')}</dl>` : '<p class="none">—</p>'}`;
  adv += `<h3>Anvaya</h3>${e.anvaya ? `<div class="anvaya"><p class="anv-sa" lang="sa">${esc(e.anvaya)}</p><p class="anv-i" lang="sa-Latn">${esc(iast(e.anvaya.replace(/[\[\]]/g, '')))}</p><p class="note">Prose order; words in [brackets] are supplied.</p></div>` : '<p class="none">Prose already in prose order; no anvaya is given.</p>'}`;
  adv += `<h3>Syntax</h3>${paras([e.syntax])}`;
  adv += `<h3>Ambiguities</h3>${(e.ambiguities || []).length ? `<dl class="kv">${e.ambiguities.map((x) => `<dt>${rich(x.topic)}</dt><dd>${rich(x.note)}</dd>`).join('')}</dl>` : '<p class="none">None of substance.</p>'}`;
  const counts = r.lines.map((l) => (iast(l.replace(/[॥।०-९]/g, '')).match(/ai|au|ā|ī|ū|ṝ|ḹ|a|i|u|ṛ|ḷ|e|o/g) || []).length);
  adv += `<h3>Metre</h3><p><b>${esc(e.metre.name)}</b> · syllables counted as written: ${counts.join(' + ')}</p>${paras([e.metre.note])}`;
  const vv = variants.filter((v) => v.class !== 'orthographic');
  adv += `<h3>Textual variations between witnesses</h3>${vv.length ? `<ul class="plain">${vv.map((v) => `<li><span class="vc vc-${v.class}">${esc(VCLASS[v.class])}</span> <b>${esc(ed.CFG.witnesses[v.witness].name)}</b>: <span lang="sa">${esc(v.reading)}</span> — ${rich(v.note)}</li>`).join('')}</ul>` : '<p class="none">The witnesses differ here only in spelling (listed in section 14).</p>'}`;
  h += details(`${id}-s10`, 3, 10, 'Advanced Sanskrit analysis', adv);
  // 11. Connections
  h += details(`${id}-s11`, 2, 11, 'Connections with other scriptures',
    (e.parallels || []).length ? `<ul class="pars">${e.parallels.map((p) => `<li><p class="par-h"><b>${esc(refName(p.ref))}</b> <span class="pk pk-${esc(p.kind)}">${esc(PAR[p.kind])}</span></p><p class="par-q" lang="sa">${esc(p.quote)}</p><p class="par-i" lang="sa-Latn">${esc(iast(p.quote))}</p>${paras([p.note])}</li>`).join('')}</ul><p class="note">Every quoted phrase is checked against the text of the passage cited (sources in section 14).</p>` : '<p class="none">No parallel is cited.</p>');
  // 12. Contemporary
  h += details(`${id}-s12`, 2, 12, 'Contemporary relevance', `${chip('reflection')}<p class="theme"><span class="lbl">Theme</span> ${esc(e.contemporary.theme)}</p>${paras([e.contemporary.text])}`);
  // 13. Reflect
  h += details(`${id}-s13`, 1, 13, 'Reflect and contemplate',
    `<p class="rq"><span class="lbl">A question to begin</span> ${rich(e.reflect.beginner)}</p><details class="deeper" data-lvl="2" open><summary>Go deeper</summary><p class="rq"><span class="lbl">A philosophical inquiry</span> ${rich(e.reflect.deeper)}</p><p class="rq"><span class="lbl">A contemplation exercise</span> ${rich(e.reflect.practice)}</p><p class="note">An invitation to attend, not a treatment; no medical or psychological claim is made.</p></details>`);
  // 14. Sources
  let src = `<p class="status-line"><span class="status ${e.status === 'reviewed' ? 'ok' : 'ver'}">${e.status === 'reviewed' ? 'Reviewed' : 'Editorial review pending'}</span> The Sanskrit, the collation, the padaccheda, every quotation, every parallel and every Pāṇini citation on this page are machine-verified (scripts/upanishads/check.py). The translations, explanations and judgements have not yet been reviewed by a Sanskrit scholar.</p>`;
  src += `<h3>Textual witnesses for this ${REC}</h3><div class="tw" tabindex="0"><table class="wit"><thead><tr><th scope="col">Witness</th><th scope="col">Reading</th><th scope="col">Differences from the edited text</th></tr></thead><tbody>`;
  for (const [wid, spec] of Object.entries(ed.CFG.witnesses)) {
    const rd = witnessReading(ed, wid, r.key);
    const vs = variants.filter((v) => v.witness === wid);
    src += `<tr><th scope="row">${esc(spec.name)}${spec.role === 'base' ? ' <span class="status ok">base</span>' : ''}${rd && rd.keys.join(',') !== r.key ? `<br><span class="note">its ${rd.keys.join(' + ')}</span>` : ''}${spec.scope === 'valli' ? '<br><span class="note">divides the vallī differently; aligned here by the importer and collated vallī by vallī</span>' : ''}</th><td lang="sa">${rd ? esc(rd.text) : '<span class="none" lang="en">— not in this witness</span>'}</td><td>${vs.length ? vs.map((v) => `<span class="vc vc-${v.class}">${esc(VCLASS[v.class])}</span> <span lang="sa">${esc(v.reading)}</span>`).join('<br>') : (rd ? 'none' : '')}</td></tr>`;
  }
  src += `</tbody></table></div>`;
  if (corr.length) src += `<h3>Corrections to the base witness</h3><ul class="plain">${corr.map((c) => `<li><span lang="sa">${esc(c.from)}</span> → <span lang="sa">${esc(c.to)}</span> (${esc(c.kind)}) — ${rich(c.reason)}</li>`).join('')}</ul>`;
  const used = new Set();
  const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { for (const [kk, v] of Object.entries(x)) { if (kk === 'sources' && Array.isArray(v)) v.forEach((s) => used.add(s.split(':')[0])); else walk(v); } } };
  walk(e);
  const where2 = (cid, keys) => {
    const un = cid === 'shankara' && (ed.W['shankara.json'].mantras[r.key] || {}).units;
    if (un) return `Advaita Sharada units ${esc(un.join(', '))}`;
    if (cid === 'mahidhara') return `on VS 40.${keys.join(', 40.')}`;
    if (ed.VALLI) return `on ${keys.map((k) => (k === 'opening' ? 'the introduction' : `anuvāka ${k}`)).join(' and ')}`;
    return `on ${keys.length > 1 ? 'the passage ' : 'mantra '}${keys.join('–')}`;
  };
  src += `<h3>Commentaries consulted</h3><ul class="plain">${Object.entries(ed.CFG.commentaries).map(([cid, c]) => { const keys = (c.map && c.map[r.key]) || [r.key]; return `<li><b>${esc(c.name)}</b>, ${esc(c.work)} — ${where2(cid, keys)}${used.has(cid) ? '' : ' <span class="note">(consulted; not quoted on this page)</span>'}</li>`; }).join('')}</ul>`;
  if ((e.parallels || []).length) src += `<h3>Parallel passages</h3><ul class="plain">${e.parallels.map((p) => `<li>${esc(refName(p.ref))}: <span class="note">${esc(ed.PAR[p.ref]?.source || '')}</span></li>`).join('')}</ul>`;
  if ((e.references || []).length) src += `<h3>Further notes</h3><ul class="plain">${e.references.map((x) => `<li>${rich(x.text)}</li>`).join('')}</ul>`;
  if ((e.flags || []).length) src += `<h3>Uncertainties recorded</h3><ul class="plain">${e.flags.map((f) => `<li><span class="vc vc-review">${esc(f.kind)}</span> ${rich(f.note)}</li>`).join('')}</ul>`;
  src += `<p class="note">Full list of witnesses, their provenance and copyright status, and every variant: <a href="${ed.dir}sources.html">Sources, Variants and Corrections</a>.</p>`;
  h += details(`${id}-s14`, 3, 14, 'Scholarly sources and verification', src);
  h += pager();
  return h + cite;
}

/* ---------------- essays (studies, guide, landing sections) ---------------- */
function essayBody(d, { h = 'h2' } = {}) {
  return (d.sections || []).map((s, i) => `<section class="es" id="s${i + 1}" aria-labelledby="s${i + 1}-h"><${h} id="s${i + 1}-h">${rich(s.heading)}</${h}>${chip(s.label)}${paras(s.paras)}${(s.parallels || []).length ? `<ul class="pars mini">${s.parallels.map((p) => `<li><b>${esc(refName(p.ref))}</b>: <span lang="sa">${esc(p.quote)}</span> <span class="par-i" lang="sa-Latn">${esc(iast(p.quote))}</span></li>`).join('')}</ul>` : ''}</section>`).join('\n');
}
function toc(d) {
  return `<nav class="toc" aria-label="Contents"><p class="lbl">Contents</p><ol>${d.sections.map((s, i) => `<li><a href="#s${i + 1}">${rich(s.heading)}</a></li>`).join('')}</ol></nav>`;
}

/* ---------------- collection pages ---------------- */
const NAVC = (cur) => [['/upanishads/', 'Collection', cur === 'home'], ['/upanishads/introduction.html', 'Introduction', cur === 'intro'], ['/upanishads/how-to-study.html', 'How to Study', cur === 'how'], ['/upanishads/glossary.html', 'Glossary', cur === 'gloss']];
const NAVE = (ed, cur) => [['/upanishads/', 'Collection', false], [ed.dir, ed.T.title.en.replace(' Upaniṣad', ''), cur === 'home'], [`${ed.dir}read.html`, 'Read through', cur === 'read'], [`${ed.dir}studies/`, 'Studies', cur === 'studies'], ...(ed.map ? [[`${ed.dir}map.html`, 'Concept map', cur === 'map']] : []), [`${ed.dir}sources.html`, 'Sources', cur === 'sources'], ['/upanishads/glossary.html', 'Glossary', false]];

function comparisonTable() {
  return `<div class="tw" tabindex="0" role="region" aria-label="The ten principal Upaniṣads compared"><table class="cmp"><caption class="sr">The ten principal Upaniṣads: Veda, location, structure, subject, famous teachings and recommended level</caption><thead><tr><th scope="col">Upaniṣad</th><th scope="col">Veda · location</th><th scope="col">Structure</th><th scope="col">Broad subject</th><th scope="col">Famous teachings</th><th scope="col">Level</th></tr></thead><tbody>${PRIN.upanishads.map((u) => `<tr><th scope="row"><span lang="sa">${esc(u.sa)}</span><br>${u.edition && LIVE.has(u.edition) ? `<a href="${u.edition}">${esc(u.en)}</a> <span class="status ok">study edition</span>` : esc(u.en)}</th><td>${esc(u.veda)}<br><span class="note">${esc(u.location)}</span></td><td>${esc(u.structure)}</td><td>${esc(u.subject)}</td><td><ul class="fam">${u.famous.map((f) => `<li><span lang="sa">${esc(f.quote)}</span> <span class="note">(${esc(f.ref.startsWith('Isha') ? f.ref.replace('Isha', 'Īśā') : f.ref)})</span><br>${esc(f.en)}</li>`).join('')}</ul></td><td><span class="lvl lvl-${u.level}">${esc(u.level)}</span></td></tr>`).join('')}</tbody></table></div><p class="note">Levels: ${Object.entries(PRIN.levels).map(([k, v]) => `<b>${k}</b> — ${esc(v)}`).join(' ')} Every Sanskrit quotation in the table is checked against the text of the passage cited.</p>`;
}

function collectionHome(eds) {
  const ed = eds[0];
  let b = `<div class="page home"><header class="hero"><p class="invoc" lang="sa">॥ ॐ ॥</p><h1><span class="h-sa" lang="sa">उपनिषदः</span><span class="h-en">The Upaniṣads</span></h1><p class="tagline">From first questions to self-knowledge. A study edition for the curious beginner, the serious student and the scholar — the verified Sanskrit, its grammar, the traditional commentaries in their own words, and a modern voice that always says it is modern.</p>
<p class="cta"><a class="btn" href="${ed.dir}">Begin with the Īśāvāsya</a><a class="btn ghost" href="/upanishads/introduction.html">Read the introduction</a></p></header>
<section class="band" aria-labelledby="ed-h"><h2 id="ed-h">The editions</h2><ul class="eds">${eds.map((e) => `<li><a class="ed-card" href="${e.dir}"><span class="ed-sa" lang="sa">${esc(e.T.title.sa)}</span><span class="ed-en">${esc(e.T.title.en)}</span><span class="ed-meta">${esc(e.T.veda)} · ${e.VALLI ? `${e.T.vallis.length} vallīs, ${e.T.count} anuvākas` : `${e.T.count} mantras`} · ${e.studies.length} studies</span></a></li>`).join('')}</ul><p class="note">Further principal Upaniṣads will be added one at a time, each verified the same way before it is published. None is announced until it is ready.</p></section>
<section class="band" aria-labelledby="paths-h"><h2 id="paths-h">Three reading paths</h2><div class="paths"><div><h3>The Curious Reader</h3><p>The Sanskrit, a readable English rendering, a plain explanation with one analogy, and one question to think about.</p></div><div><h3>The Serious Student</h3><p>Adds the words separated and translated one by one, a literal translation, the traditional commentary and the connections with other scriptures.</p></div><div><h3>The Scholar</h3><p>Adds the full grammar, sandhi and compounds, the textual witnesses and their variants, and the schools compared with their disagreements.</p></div></div><p>The paths only decide what is open when a page loads; everything is on every page. <a href="/upanishads/how-to-study.html">How to study</a>.</p></section>
<section class="band" aria-labelledby="cmp-h"><h2 id="cmp-h">The ten principal Upaniṣads</h2><p>The ten on which the classical commentaries were written, named together in the Muktikā Upaniṣad. Why these ten, and how they relate to the hundred and eight and to the ‘early’ Upaniṣads of modern scholarship, is explained in the <a href="/upanishads/introduction.html#s7">introduction</a>.</p>${comparisonTable()}</section>
<section class="band" aria-labelledby="ref-h"><h2 id="ref-h">For every reader</h2><ul class="refs"><li><a href="/upanishads/introduction.html">Introduction to the Upaniṣads</a> — the word, śruti and smṛti, the layers of the Veda, Vedānta and its schools, revelation and chronology.</li><li><a href="/upanishads/how-to-study.html">How to Study</a> — the paths, the parts of a mantra page, the five labels, how the text was verified.</li><li><a href="/upanishads/glossary.html">Glossary</a> — ${GLOSS.terms.length} terms, searchable, each school’s sense where it differs.</li><li><a href="${ed.dir}sources.html">Sources, Variants and Corrections</a> — every witness and every difference.</li></ul></section></div>`;
  out('upanishads/index.html', shell({ title: 'The Upaniṣads — A Study Edition', desc: 'The principal Upaniṣads, verse by verse: verified Sanskrit, IAST, padaccheda, word-by-word grammar, translations, the commentaries of Śaṅkara, Vedānta Deśika and Madhva, and three reading paths. Beginning with the Īśāvāsya.', url: '/upanishads/', body: b, nav: NAVC('home'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads']],
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'The Upaniṣads — A Study Edition', url: `${SITE}/upanishads/`, isPartOf: { '@type': 'CollectionPage', name: 'The Sacred Library', url: `${SITE}/sacred/` }, inLanguage: ['en', 'sa'] } }));
}

function guidePage(file, slug, cur) {
  const d = J(`upanishads/data/guide/${file}`);
  const b = `<div class="page prose-page"><header class="ch-hero"><p class="kicker">The Upaniṣads</p><h1><span class="h-en">${esc(d.title)}</span></h1><p class="h-i">${rich(d.subtitle)}</p></header><p class="ov-lead">${rich(d.summary)}</p>${toc(d)}<div class="prose">${essayBody(d)}</div>${slug === 'introduction' ? `<section class="es" id="table" aria-labelledby="table-h"><h2 id="table-h">The ten principal Upaniṣads compared</h2>${comparisonTable()}</section>` : ''}<p class="note">Labels: ${Object.keys(LABEL).map(chip).join(' ')} — see <a href="/upanishads/how-to-study.html#s3">the five labels</a>.</p></div>`;
  out(`upanishads/${slug}.html`, shell({ title: `${d.title} — The Upaniṣads`, desc: d.summary.slice(0, 300), url: `/upanishads/${slug}.html`, body: b, nav: NAVC(cur), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], ['', d.title]] }));
}

function glossaryPage(eds) {
  const occ = {};
  for (const ed of eds) for (const [n, e] of ed.AN) for (const w of (e.units || [e]).flatMap((u) => u.words)) for (const t of GLOSS.terms) if ((t.stems || []).includes(w.base)) ((occ[t.id] ||= new Map()).set(`${ed.id}:${n}`, { ed, n }));
  const groups = [['texts', 'Texts and their parts'], ['schools', 'Schools of Vedānta'], ['concepts', 'Concepts'], ['method', 'Method of this edition']];
  let b = `<div class="page prose-page"><header class="ch-hero"><p class="kicker">The Upaniṣads</p><h1><span class="h-en">Glossary</span></h1><p class="h-i">${GLOSS.terms.length} Sanskrit terms. Where the schools differ, each one’s sense is given.</p></header>
<div class="gsearch" hidden><label for="gq">Search the glossary</label><input id="gq" type="search" autocomplete="off" placeholder="ātman, avidyā, renunciation…"><p class="note" id="gq-n" aria-live="polite"></p></div>
<nav class="toc" aria-label="Groups"><ol>${groups.map(([g, l]) => `<li><a href="#g-${g}">${l}</a></li>`).join('')}</ol></nav>`;
  for (const [g, l] of groups) {
    const terms = GLOSS.terms.filter((t) => t.group === g).sort((a, b2) => iast(a.sa).localeCompare(iast(b2.sa)));
    b += `<section class="gg" id="g-${g}" aria-labelledby="g-${g}-h"><h2 id="g-${g}-h">${l}</h2><dl class="gl">${terms.map((t) => `<div class="gt" id="${t.id}" data-q="${esc((t.sa + ' ' + iast(t.sa) + ' ' + t.en + ' ' + t.short + ' ' + t.long).toLowerCase())}"><dt><span class="g-sa" lang="sa">${esc(t.sa)}</span> <span class="g-i" lang="sa-Latn">${esc(iast(t.sa))}</span> <span class="g-en">${esc(t.en)}</span></dt><dd><p class="g-short">${rich(t.short)}</p><p>${rich(t.long)}</p>${occ[t.id] ? eds.filter((ed) => [...occ[t.id].values()].some((o) => o.ed === ed)).map((ed) => `<p class="g-occ"><span class="lbl">In the ${esc(ed.short)}</span> ${[...occ[t.id].values()].filter((o) => o.ed === ed).sort((x, y) => ed.byKey[x.n].i - ed.byKey[y.n].i).map(({ n }) => `<a href="${mUrl(ed, n)}">${n}</a>`).join(' · ')}</p>`).join('') : ''}${(t.see || []).length ? `<p class="g-see"><span class="lbl">See also</span> ${t.see.map((s) => `<a href="#${s}">${esc(glossById[s].en)}</a>`).join(' · ')}</p>` : ''}</dd></div>`).join('')}</dl></section>`;
  }
  b += `</div>`;
  out('upanishads/glossary.html', shell({ title: 'Glossary — The Upaniṣads', desc: 'A searchable glossary of Sanskrit philosophical terms in the Upaniṣads: Brahman, ātman, avidyā, vidyā, karma, mokṣa and more, with the senses of Advaita, Viśiṣṭādvaita and Dvaita where they differ.', url: '/upanishads/glossary.html', body: b, nav: NAVC('gloss'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], ['', 'Glossary']] }));
}

/* ---------------- edition pages ---------------- */
function editionHome(ed) {
  const L = ed.landing;
  const N = ed.T.count;
  const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const card = (r) => `<li><a class="ml-card" href="${r.url}"><span class="ch-no" lang="sa">${devNum(r.n)}</span><span class="ch-txt"><span class="ch-sa" lang="sa">${esc(r.lines[0].replace(/\s*।\s*$/, ''))}</span><span class="ch-en">${esc(ed.AN.get(r.key)?.title || (ed.VALLI ? 'Verified text · analysis in preparation' : ''))}</span></span><span class="ch-go" aria-hidden="true">›</span></a></li>`;
  const first = ed.recs[0];
  const shanti = ed.T.shanti
    ? `<section class="band shanti" aria-labelledby="sh-h"><h2 id="sh-h">Before and after the recitation</h2><p class="v-sa" lang="sa">${ed.T.shanti.lines.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p><p class="v-iast" lang="sa-Latn">${ed.T.shanti.lines.map((l) => `<span class="ln">${esc(iast(l))}</span>`).join('')}</p><p class="note">${rich(ed.T.shanti.note)} Source: ${esc(ed.T.shanti.source)}.</p></section>`
    : '';
  const list = ed.VALLI
    ? `<section class="band" id="anuvakas" aria-labelledby="ml-h"><h2 id="ml-h">The three vallīs</h2>${ed.T.vallis.map((v) => { const rs = ed.recs.filter((r) => r.valli === v); const done = rs.filter((r) => ed.AN.has(r.key)).length; return `<section class="valli" id="v${v.n}" aria-labelledby="v${v.n}-h"><h3 id="v${v.n}-h"><span lang="sa">${esc(v.title.sa)}</span> ${esc(valliName(v))} <span class="note">· ${esc(v.title.gloss)} · ${rs.length} anuvākas · ${esc(v.location || '')}${done === rs.length ? '' : done ? ` · ${done} analysed` : ' · verified text; analysis in preparation'}</span></h3>${v.shanti ? `<details class="pre-shanti"><summary>The śānti recited before this vallī</summary><p class="v-sa" lang="sa">${v.shanti.lines.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p><p class="v-iast" lang="sa-Latn">${v.shanti.lines.map((l) => `<span class="ln">${esc(iast(l))}</span>`).join('')}</p><p class="note">${rich(v.shanti.note)}</p></details>` : ''}<ol class="ml">${rs.map(card).join('')}</ol></section>`; }).join('')}</section>`
    : `<section class="band" id="mantras" aria-labelledby="ml-h"><h2 id="ml-h">The ${N} mantras</h2><ol class="ml">${ed.recs.map(card).join('')}</ol></section>`;
  const qs = (q) => (q.mantras || q.anuvakas).map((n) => `<a href="${mUrl(ed, n)}">${n}</a>`).join(' · ');
  let b = `<div class="page home"><header class="hero"><p class="invoc" lang="sa">॥ ॐ ॥</p><h1><span class="h-sa" lang="sa">${esc(ed.CFG.hero_sa || ed.T.title.sa)}</span><span class="h-en">${esc(ed.T.title.en)}</span></h1><p class="tagline sub">${esc(L.subtitle)}</p><p class="opening">${rich(L.opening)}</p>
<p class="cta"><a class="btn" href="${first.url}">Begin with ${ed.REC} ${first.key}</a><a class="btn ghost" href="${ed.dir}read.html">Read straight through</a><a class="btn ghost" href="${ed.dir}studies/">The ${NUMWORD[ed.studies.length] || ed.studies.length} studies</a></p></header>
<dl class="facts">${L.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${rich(v)}</dd></div>`).join('')}</dl>
${shanti}
<div class="prose">${essayBody(L)}</div>
<section class="band" aria-labelledby="obj-h"><h2 id="obj-h">What you will learn</h2><ul class="objs">${L.objectives.map((o) => `<li>${rich(o)}</li>`).join('')}</ul></section>
<section class="band" aria-labelledby="rg-h"><h2 id="rg-h">A beginner’s reading guide</h2><ol class="rg">${L.reading_guide.map((r) => `<li><b>${rich(r.title)}</b> ${rich(r.text)}</li>`).join('')}</ol></section>
<section class="band" aria-labelledby="kq-h"><h2 id="kq-h">Questions the text answers</h2><ul class="kq">${L.key_questions.map((q) => `<li>${rich(q.q)} <span class="kq-m">${qs(q)}</span></li>`).join('')}</ul></section>
${list}
<section class="band" aria-labelledby="st-h"><h2 id="st-h">Special philosophical studies</h2><ol class="stl">${ed.studies.map((s) => `<li><a href="${ed.dir}studies/${s.id}.html"><b>${esc(R[s.n - 1])}. ${rich(s.title)}</b></a> — ${rich(s.subtitle)} <span class="note">(${ed.RECS} ${(s.mantras || s.anuvakas).join(', ')})</span></li>`).join('')}</ol></section>
<section class="band" aria-labelledby="more-h"><h2 id="more-h">Tools</h2><ul class="refs">${ed.map ? `<li><a href="${ed.dir}map.html">Concept map</a> — how the teachings of the ${ed.VALLI ? 'anuvākas' : 'eighteen mantras'} connect.</li>` : ''}<li><a href="${ed.dir}sources.html">Sources, Variants and Corrections</a> — the witnesses, every difference, and the verification report.</li><li><a href="/upanishads/glossary.html">Glossary</a> · <a href="/upanishads/how-to-study.html">How to Study</a></li></ul></section></div>`;
  const comms = Object.values(ed.CFG.commentaries).map((c) => c.name.replace(/ \(modern\)$/, ''));
  out(`upanishads/${ed.id}/index.html`, shell({ title: `${ed.T.title.en} — ${L.subtitle}`, desc: ed.VALLI ? `The ${ed.T.title.en}, ${ed.T.vallis.length} vallīs and ${N} anuvākas: verified Sanskrit with svara, IAST, padaccheda, word-by-word grammar, translations, plain explanations, and the commentaries of ${comms.slice(0, 3).join(', ')} and others.` : `The ${ed.T.title.en}, all ${N} mantras: verified Sanskrit, IAST, padaccheda, word-by-word grammar, faithful and readable translations, plain explanations, and the commentaries of Śaṅkara, Vedānta Deśika and Madhva.`, url: ed.dir, body: b, nav: NAVE(ed, 'home'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], ['', ed.T.title.en]],
    ld: { '@context': 'https://schema.org', '@type': 'Book', name: ed.T.title.en, alternateName: ed.T.title.sa, inLanguage: ['sa', 'en'], url: `${SITE}${ed.dir}`, isPartOf: { '@type': 'CollectionPage', name: 'The Upaniṣads', url: `${SITE}/upanishads/` } } }));
}
function editionMantras(ed) {
  for (const r of ed.recs) {
    const e = ed.AN.get(r.key);
    const b = `<div class="page chapter">${recordPage(ed, r)}</div>`;
    out(r.url.slice(1), shell({ title: `${ed.T.title.en} ${r.key}${e ? ` — ${e.title}` : ''}`, desc: `${ed.T.title.en}, ${ed.REC} ${r.key}: ${r.lines.join(' ')} ${e ? (e.units || [e]).map((u) => u.translation.readable).join(' ') : ''}`.slice(0, 300), url: r.url, body: b, nav: NAVE(ed, ''), reader: true, crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], ['', r.label]],
      ld: { '@context': 'https://schema.org', '@type': 'CreativeWork', name: `${ed.T.title.en} ${r.key}`, text: r.lines.join(' '), inLanguage: 'sa', isPartOf: { '@type': 'Book', name: ed.T.title.en, url: `${SITE}${ed.dir}` }, url: `${SITE}${r.url}` } }));
  }
}
function editionRead(ed) {
  const sec = (r) => { const e = ed.AN.get(r.key); const rid = ed.VALLI ? `r${r.key.replace('.', '-')}` : `r${r.n}`; return `<section class="rt-m" id="${rid}" aria-labelledby="${rid}-h"><h2 class="rt-h" id="${rid}-h"><a href="${r.url}">${r.key}</a></h2>${r.units.map((u) => `<p class="v-sa" lang="sa">${mantraLines({ lines: u.lines, n: u.n }, ed.VALLI)}</p><p class="v-iast" lang="sa-Latn">${u.lines.map((l) => `<span class="ln">${esc(iast(l.replace(/\s*॥\s*[०-९]+\s*॥\s*$/, ed.VALLI ? ` ॥ ${devNum(u.n)} ॥` : ' ॥')))}</span>`).join('')}</p>${e ? `<p class="tr-read">${rich((e.units ? e.units.find((x) => x.id === u.id) : e).translation.readable)}</p>` : ''}`).join('')}</section>`; };
  const body = ed.VALLI
    ? ed.T.vallis.map((v) => `<section class="rt-v" id="v${v.n}" aria-labelledby="v${v.n}-h"><h2 class="rt-vh" id="v${v.n}-h"><span lang="sa">${esc(v.title.sa)}</span> · ${esc(valliName(v))}</h2>${v.shanti ? `<p class="v-sa pre-shanti" lang="sa">${v.shanti.lines.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p>` : ''}${ed.recs.filter((r) => r.valli === v).map(sec).join('')}</section>`).join('')
    : ed.recs.map(sec).join('');
  const lead = ed.VALLI
    ? `All ${ed.recs.length} anuvākas in three vallīs: the Sanskrit and the transliteration throughout, and the readable English rendering where the analysis is published (${[...new Set([...ed.AN.keys()].map((k) => valliName(ed.byKey[k].valli)))].join(', ')}).`
    : `All ${ed.T.count} mantras: the Sanskrit, the transliteration and the readable English rendering. About ten minutes.`;
  const b = `<div class="page chapter"><header class="ch-hero"><p class="kicker">${esc(ed.T.title.en)}</p><h1><span class="h-en">Read straight through</span></h1><p class="h-i">${lead}</p></header>
<div class="rt">${body}</div><p class="note">The English here is the edition’s readable, interpretive rendering; each ${ed.REC}’s page has the literal translation and the analysis.</p></div>`;
  out(`upanishads/${ed.id}/read.html`, shell({ title: `${ed.T.title.en} — Read straight through`, desc: `The whole ${ed.T.title.en} in Sanskrit, IAST and readable English on one page.`, url: `${ed.dir}read.html`, body: b, nav: NAVE(ed, 'read'), reader: true, crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], ['', 'Read straight through']] }));
}
function editionStudies(ed) {
  const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let idx = `<div class="page prose-page"><header class="ch-hero"><p class="kicker">${esc(ed.T.title.en)}</p><h1><span class="h-en">Special philosophical studies</span></h1><p class="h-i">The central interpretive problems of the Upaniṣad, each with the Sanskrit, the commentators in their own words, and the open questions.</p></header><ol class="stl big">${ed.studies.map((s) => `<li><a href="${ed.dir}studies/${s.id}.html"><b>${R[s.n - 1]}. ${rich(s.title)}</b></a><p>${rich(s.subtitle)}</p><p class="note">${rich(s.summary)}</p></li>`).join('')}</ol></div>`;
  out(`upanishads/${ed.id}/studies/index.html`, shell({ title: `${ed.T.title.en} — Special studies`, desc: `${cap(NUMWORD[ed.studies.length] || String(ed.studies.length))} studies of the central problems of the ${ed.T.title.en}.`, url: `${ed.dir}studies/`, body: idx, nav: NAVE(ed, 'studies'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], ['', 'Studies']] }));
  ed.studies.forEach((s, i) => {
    const prev = ed.studies[i - 1], next = ed.studies[i + 1];
    const b = `<div class="page prose-page"><header class="ch-hero"><p class="kicker">Study ${R[s.n - 1]} · ${esc(ed.T.title.en)}</p><h1><span class="h-en">${rich(s.title)}</span></h1><p class="h-i">${rich(s.subtitle)}</p><p class="h-meta">${ed.VALLI ? 'Anuvākas' : 'Mantras'} ${(s.mantras || s.anuvakas).map((n) => `<a href="${mUrl(ed, n)}">${n}</a>`).join(', ')}</p></header><p class="ov-lead">${rich(s.summary)}</p>${toc(s)}<div class="prose">${essayBody(s)}</div>${(s.open_questions || []).length ? `<section class="es oq" aria-labelledby="oq-h"><h2 id="oq-h">Open questions</h2><ul>${s.open_questions.map((q) => `<li>${rich(q)}</li>`).join('')}</ul></section>` : ''}<nav class="pager" aria-label="Studies">${prev ? `<a href="${ed.dir}studies/${prev.id}.html" rel="prev"><span class="pg-k">Previous study</span><span class="pg-en">${rich(prev.title)}</span></a>` : '<span></span>'}${next ? `<a class="pg-next" href="${ed.dir}studies/${next.id}.html" rel="next"><span class="pg-k">Next study</span><span class="pg-en">${rich(next.title)}</span></a>` : '<span></span>'}</nav></div>`;
    out(`upanishads/${ed.id}/studies/${s.id}.html`, shell({ title: `${s.title} — ${ed.T.title.en}`, desc: s.summary.slice(0, 300), url: `${ed.dir}studies/${s.id}.html`, body: b, nav: NAVE(ed, 'studies'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], [`${ed.dir}studies/`, 'Studies'], ['', s.title]] }));
  });
}
function editionMap(ed) {
  const M = ed.map;
  if (!M) return;
  const byId = Object.fromEntries(M.nodes.map((n) => [n.id, n]));
  const W = M.width, H = M.height;
  const box = (n) => ({ x: n.x - 100, y: n.y - 30, w: 200, h: 60 });
  let svg = `<svg class="cmap" viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="cmap-t" aria-describedby="cmap-d"><title id="cmap-t">Concept map of the ${esc(ed.T.title.en)}</title><desc id="cmap-d">${esc(M.desc)}</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah"/></marker></defs>`;
  // clip each edge at the borders of its two boxes, so arrows end at the box
  const clip = (p, q) => { const b = box(p); const dx = q.x - p.x, dy = q.y - p.y; const tx = dx ? (b.w / 2 + 4) / Math.abs(dx) : Infinity, ty = dy ? (b.h / 2 + 4) / Math.abs(dy) : Infinity; const t = Math.min(tx, ty); return { x: +(p.x + dx * t).toFixed(1), y: +(p.y + dy * t).toFixed(1) }; };
  for (const e of M.edges) {
    const a = byId[e.from], c = byId[e.to];
    const s = clip(a, c), t = clip(c, a);
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    svg += `<g class="ce ce-${esc(e.kind)}" data-from="${e.from}" data-to="${e.to}"><line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" marker-end="url(#ah)"/><text x="${mx}" y="${my - 5}" text-anchor="middle">${esc(e.label)}</text></g>`;
  }
  for (const n of M.nodes) {
    const b = box(n);
    svg += `<a class="cn cn-${esc(n.kind)}" href="#n-${n.id}" data-id="${n.id}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/><text x="${n.x}" y="${n.y - 6}" text-anchor="middle" class="cn-t">${esc(n.label)}</text><text x="${n.x}" y="${n.y + 14}" text-anchor="middle" class="cn-m">${esc(n.mantras.length > 1 ? `${ed.RECS} ${n.mantras[0]}–${n.mantras[n.mantras.length - 1]}` : `${ed.REC} ${n.mantras[0]}`)}</text></a>`;
  }
  svg += `</svg>`;
  const list = M.nodes.map((n) => `<div class="cl" id="n-${n.id}"><h3>${esc(n.label)} <span class="note">· ${n.mantras.map((x) => `<a href="${mUrl(ed, x)}">${x}</a>`).join(', ')}</span></h3><p>${rich(n.text)}</p><ul class="plain">${M.edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => `<li>${e.from === n.id ? `<b>${esc(e.label)}</b> → <a href="#n-${e.to}">${esc(byId[e.to].label)}</a>` : `<a href="#n-${e.from}">${esc(byId[e.from].label)}</a> → <b>${esc(e.label)}</b>`}${e.note ? ` — ${rich(e.note)}` : ''}</li>`).join('')}</ul>${n.study ? `<p class="note">Study: <a href="${ed.dir}studies/${n.study}.html">${esc(ed.studies.find((s) => s.id === n.study)?.title || n.study)}</a></p>` : ''}</div>`).join('');
  const b = `<div class="page wide"><header class="ch-hero"><p class="kicker">${esc(ed.T.title.en)}</p><h1><span class="h-en">Concept map</span></h1><p class="h-i">${rich(M.intro)}</p></header><div class="cmap-wrap">${svg}</div><p class="note">Select a teaching to see what it connects to. The connections marked as interpretive are the commentators’ or the editor’s, not statements of the text; each says whose it is.</p><div class="clist">${list}</div></div>`;
  out(`upanishads/${ed.id}/map.html`, shell({ title: `${ed.T.title.en} — Concept map`, desc: `An interactive map of how the teachings of the ${ed.T.title.en}'s ${ed.VALLI ? 'anuvākas' : 'eighteen mantras'} connect.`, url: `${ed.dir}map.html`, body: b, nav: NAVE(ed, 'map'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], ['', 'Concept map']] }));
}
function editionSources(ed) {
  const C = ed.C;
  const byClass = {};
  for (const v of C.variants) byClass[v.class] = (byClass[v.class] || 0) + 1;
  const flags = [];
  for (const [n, e] of ed.AN) for (const f of e.flags || []) flags.push({ n, ...f });
  const statuses = [...ed.AN.values()].map((e) => e.status);
  let b = `<div class="page prose-page"><header class="ch-hero"><p class="kicker">${esc(ed.T.title.en)}</p><h1><span class="h-en">Sources, Variants and Corrections</span></h1><p class="h-i">What the text was made from, what was checked, and what remains open.</p></header>
<nav class="toc" aria-label="Contents"><ol><li><a href="#report">Verification report</a></li><li><a href="#witnesses">Textual witnesses</a></li><li><a href="#commentaries">Commentaries</a></li><li><a href="#parallels">Parallel passages and other sources</a></li><li><a href="#corrections">Corrections</a></li><li><a href="#variants">Every variant</a></li><li><a href="#open">Unresolved issues</a></li><li><a href="#rights">Provenance and copyright</a></li></ol></nav><div class="prose">
<section id="report" aria-labelledby="report-h"><h2 id="report-h">Verification report</h2>
<div class="stat-grid"><div><b>${ed.T.count}</b>${ed.VALLI ? `anuvākas in ${ed.T.vallis.length} vallīs (${ed.recs.reduce((a, r) => a + r.units.length, 0)} units), numbered without a gap` : `mantras, numbered 1–${ed.T.count} without a gap`}</div><div><b>${Object.keys(ed.CFG.witnesses).length}</b>witnesses collated letter by letter</div><div><b>${C.variants.length}</b>witness differences, every one classified</div><div><b>${ed.AN.size}</b>${ed.REC} records, each proven by the checker</div><div><b>${Object.keys(ed.PAR).length}</b>parallel passages, cut from their sources</div><div><b>${ed.studies.length}</b>special studies</div></div>
<p>Run on every pull request by <code>scripts/upanishads/check.py</code> (Validate Content). It proves that: the text equals the base witness apart from the logged corrections; every letter difference of every other witness is listed and classified below, and no entry is stale; every padaccheda rejoins by the rules of external sandhi into the ${ed.REC}, and every word table lists exactly its words; every Sanskrit phrase quoted from a commentator occurs in that commentator’s text on that ${ed.REC}; every parallel quotes a phrase found in the passage cited; every citation of Pāṇini names a real sūtra and quotes it correctly; every commentary block carries one of the labels; and every ${ed.REC} has all fourteen sections.${ed.VALLI && ed.CFG.analysed ? ` The analysis is published vallī by vallī; so far: ${ed.CFG.analysed.map((v) => valliName(ed.T.vallis[+v - 1])).join(', ')}. The text and collation of all three vallīs are proven now.` : ''}</p>
<p>Not machine-verifiable, and therefore <b>awaiting review by a Sanskrit scholar</b>: the translations, the beginner explanations, the commentary prose and the judgements in the studies. Status of the ${ed.AN.size} records: ${[...new Set(statuses)].map((s) => `${statuses.filter((x) => x === s).length} ${s === 'machine-verified' ? 'machine-verified, editorial review pending' : s}`).join('; ')}.</p></section>
<section id="witnesses" aria-labelledby="w-h"><h2 id="w-h">Textual witnesses</h2><p>The edited text is the base witness with the corrections logged below. ${esc(ed.CFG.svara?.sources || '')}</p><dl class="about">${Object.entries(ed.CFG.witnesses).map(([wid, spec]) => { const w = ed.W[spec.file]; return `<dt>${esc(wid)} · ${esc(spec.name)}${spec.role === 'base' ? ' — base text' : ''}</dt><dd>${esc(w.label)}. ${rich(w.note)}<br><span class="note">${esc(w.repo)} · ${esc(w.path)} · commit ${esc((w.commit || '').slice(0, 10))}</span></dd>`; }).join('')}</dl></section>
<section id="commentaries" aria-labelledby="c-h"><h2 id="c-h">Commentaries</h2><dl class="about">${Object.entries(ed.CFG.commentaries).map(([cid, c]) => { const w = ed.W[c.file]; return `<dt>${esc(c.name)} — ${esc(c.work)}</dt><dd>${esc(w.label)}. ${rich(w.note)}<br><span class="note">${esc(w.repo)} · ${esc(w.path)} · commit ${esc((w.commit || '').slice(0, 10))}</span></dd>`; }).join('')}</dl><p class="note">${rich(ed.CFG.notes?.commentaries || '')}</p></section>
<section id="parallels" aria-labelledby="p-h"><h2 id="p-h">Parallel passages and other sources</h2><p>Each cited passage was cut from its source by <code>scripts/upanishads/${ed.VALLI ? `import_${ed.id}` : 'import_witnesses'}.py</code> and is stored with it; the checker requires every quoted phrase to occur in it.</p><div class="tw" tabindex="0"><table><thead><tr><th scope="col">Passage</th><th scope="col">Text</th><th scope="col">Source file</th></tr></thead><tbody>${Object.entries(ed.PAR).map(([r, p]) => `<tr><th scope="row">${esc(refName(r))}</th><td lang="sa">${esc(p.text.length > 260 ? p.text.slice(0, 260) + ' …' : p.text)}</td><td><span class="note">${esc(p.source)}</span>${p.note ? `<br><span class="note">${esc(p.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div><p>Pāṇini’s sūtras are checked against <code>upanishads/data/sutras.json</code> (github.com/sanskrit/ashtadhyayi, data/sutrANi.tsv).</p></section>
<section id="corrections" aria-labelledby="co-h"><h2 id="co-h">Corrections to the base witness</h2><ul class="plain">${C.corrections.map((c) => `<li><a href="${mUrl(ed, c.at)}">${recWord(ed, c.at)}</a>: <span lang="sa">${esc(c.from)}</span> → <span lang="sa">${esc(c.to)}</span> (${esc(c.kind)}) — ${rich(c.reason)}</li>`).join('')}</ul><p class="note">${rich(ed.CFG.notes?.corrections || '')}</p></section>
<section id="variants" aria-labelledby="v-h"><h2 id="v-h">Every variant</h2><p>${Object.entries(byClass).map(([k, v]) => `${v} ${esc(VCLASS[k].toLowerCase())}`).join(' · ')}.</p><div class="tw" tabindex="0"><table><thead><tr><th scope="col">${ed.VALLI ? 'Anuvāka' : 'Mantra'}</th><th scope="col">Witness</th><th scope="col">Class</th><th scope="col">Reading</th><th scope="col">Note</th></tr></thead><tbody>${C.variants.map((v) => `<tr><td><a href="${mUrl(ed, vKey(v))}">${vKey(v)}</a>${v.near ? `<br><span class="note">vallī ${v.at}</span>` : ''}</td><td>${esc(v.witness)}</td><td><span class="vc vc-${v.class}">${esc(VCLASS[v.class])}</span></td><td lang="sa">${esc(v.reading)}</td><td>${rich(v.note)}</td></tr>`).join('')}</tbody></table></div></section>
<section id="open" aria-labelledby="o-h"><h2 id="o-h">Unresolved issues</h2><h3>Textual verification required</h3><ul class="plain">${C.variants.filter((v) => v.class === 'review').map((v) => `<li><a href="${mUrl(ed, vKey(v))}">${recWord(ed, vKey(v))}</a>, ${esc(ed.CFG.witnesses[v.witness].name)}: ${rich(v.note)}</li>`).join('')}</ul><h3>Uncertainties recorded in the analysis</h3><ul class="plain">${flags.map((f) => `<li><a href="${mUrl(ed, f.n)}">${recWord(ed, f.n)}</a> <span class="vc vc-review">${esc(f.kind)}</span> ${rich(f.note)}</li>`).join('')}</ul><h3>Open questions of the studies</h3><ul class="plain">${ed.studies.flatMap((s) => (s.open_questions || []).map((q) => `<li><a href="${ed.dir}studies/${s.id}.html">${rich(s.title)}</a>: ${rich(q)}</li>`)).join('')}</ul></section>
<section id="rights" aria-labelledby="r-h"><h2 id="r-h">Provenance and copyright</h2><p>The Sanskrit text of the Upaniṣad, the Saṃhitās and the classical commentaries is ancient and in the public domain; the digital transcriptions used are published openly by their projects (GRETIL via sanskrit/raw_etexts; the vishvAsa corpus; Advaita Sharada of the Śṛṅgeri Śāradā Pīṭham, mirrored in both), whose terms of use apply to the files themselves. GRETIL marks its files ‘for reference purposes only’. Only short quotations of the commentaries appear on the pages, with their locations.</p><p>${rich(ed.CFG.notes?.rights || '')}</p></section>
</div></div>`;
  out(`upanishads/${ed.id}/sources.html`, shell({ title: `${ed.T.title.en} — Sources, Variants and Corrections`, desc: `The witnesses, commentaries and parallel passages of the ${ed.T.title.en} study edition, every variant classified, and the verification report.`, url: `${ed.dir}sources.html`, body: b, nav: NAVE(ed, 'sources'), crumbs: [['/sacred/', 'Sacred Library'], ['/upanishads/', 'The Upaniṣads'], [ed.dir, ed.T.title.en], ['', 'Sources']] }));
}

/* ---------------- run ---------------- */
const eds = COLL.editions.filter((e) => e.status === 'available').map((e) => loadEdition(e.id));
collectionHome(eds);
guidePage('introduction.json', 'introduction', 'intro');
guidePage('how-to-study.json', 'how-to-study', 'how');
glossaryPage(eds);
for (const ed of eds) {
  editionHome(ed); editionMantras(ed); editionRead(ed); editionStudies(ed); editionMap(ed); editionSources(ed);
}

/* every internal link on the generated pages must resolve: the file exists and,
   for a #fragment, an element with that id exists in it (verse navigation,
   glossary links, study and source links, the concept map). */
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let broken = 0;
for (const [rel, html] of written) {
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|data:)/.test(href) || href.startsWith('/lib/') || href.endsWith('.svg') || href.endsWith('.png') || href.includes('fonts.')) continue;
    const [p0, frag] = href.split('#');
    let target;
    if (!p0) target = rel;
    else {
      let t = p0.split('?')[0];
      t = t.startsWith('/') ? t.slice(1) : path.join(path.dirname(rel), t);
      if (t === '' || t.endsWith('/')) t += 'index.html';
      target = t;
    }
    const html2 = written.get(target) ?? (fs.existsSync(A(target)) ? fs.readFileSync(A(target), 'utf8') : null);
    if (html2 === null) { console.error(`broken link in ${rel}: ${href}`); broken++; continue; }
    if (frag && written.has(target) && !ids(html2).has(frag)) { console.error(`missing anchor in ${rel}: ${href}`); broken++; }
  }
}
if (broken) { console.error(`\n${broken} broken link(s)`); process.exit(1); }

let stale = 0;
for (const [rel, html] of written) {
  const p = A(rel);
  if (CHECK) {
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== html) { console.error(`stale: ${rel}`); stale++; }
  } else {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== html) fs.writeFileSync(p, html);
  }
}
if (CHECK && stale) { console.error(`\n${stale} page(s) stale — run node scripts/upanishads/build.mjs`); process.exit(1); }
console.log(`${CHECK ? 'checked' : 'wrote'} ${written.size} pages`);
