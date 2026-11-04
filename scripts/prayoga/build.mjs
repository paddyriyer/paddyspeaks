#!/usr/bin/env node
/**
 * The rite editions — page build (/sandhyavandanam/edition/).
 *
 * Sources (never edit the pages; edit these and rebuild):
 *   <id>/edition/rite.json         the order of the rite, step by step, three services
 *   <id>/edition/text.json         the verified Sanskrit: Vedic units and texts of the rite
 *   <id>/edition/rite-texts.json   what each text is (kind, title)
 *   <id>/edition/sources.json      where each Vedic unit was cut from
 *   <id>/edition/corrections.json  every correction and every witness difference
 *   <id>/edition/witnesses/        the witnesses and the commentaries
 *   <id>/edition/analysis/*.json   one record per recited item
 *   <id>/edition/landing.json      the landing page's prose
 *   upanishads/mahanarayana/edition/{text.json,analysis/}  the Mahānārāyaṇa units the rite recites
 *
 *   node scripts/prayoga/build.mjs sandhyavandanam          write every page
 *   node scripts/prayoga/build.mjs sandhyavandanam --check  CI: fail if a page is stale
 *
 * Run scripts/prayoga/check.py first: it proves the text, the collation, the rite
 * and every analysis record. IAST is generated from the Devanagari, never typed.
 * Everything is in the HTML; the reading paths only open or close sections.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dev2iast } from '../lalitha/translit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (p) => path.join(ROOT, p);
const SITE = 'https://paddyspeaks.com';
const EID = process.argv[2] || 'sandhyavandanam';
const CHECK = process.argv.includes('--check');
const J = (p) => JSON.parse(fs.readFileSync(A(p), 'utf8'));
const has = (p) => fs.existsSync(A(p));
const hashOf = (p) => crypto.createHash('sha256').update(fs.readFileSync(A(p))).digest('hex').slice(0, 10);
const CSS = `/upanishads/lib/edition.css?v=${hashOf('upanishads/lib/edition.css')}`;
const JS = `/upanishads/lib/reader.js?v=${hashOf('upanishads/lib/reader.js')}`;
const RCSS = `/${EID}/edition/rite.css?v=${hashOf(`${EID}/edition/rite.css`)}`;

const ED = `${EID}/edition`;
const DIR = `/${ED}/`;
const R = J(`${ED}/rite.json`);
const T = J(`${ED}/text.json`);
const RT = Object.fromEntries(J(`${ED}/rite-texts.json`).texts.map((x) => [x.id, x]));
const SRC = J(`${ED}/sources.json`);
const C = has(`${ED}/corrections.json`) ? J(`${ED}/corrections.json`) : { text: [], collation: [] };
const W = Object.fromEntries(['W1', 'W2', 'RV', 'M', 'S'].map((w) => [w, J(`${ED}/witnesses/${w}.json`)]));
const L = J(`${ED}/landing.json`);
const AN = (id) => (has(`${ED}/analysis/${id}.json`) ? J(`${ED}/analysis/${id}.json`) : null);
const MANTRA = Object.fromEntries(T.mantras.map((m) => [m.id, m]));
const SRCM = Object.fromEntries(SRC.mantras.map((m) => [m.id, m]));
const SV = Object.fromEntries(R.services.map((s) => [s.id, s]));

/* the Mahānārāyaṇa units the rite recites */
const MN = J('upanishads/mahanarayana/edition/text.json');
const MNU = {};
(function walk(o) {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') { if (o.lines && o.id) MNU[o.id] = o; Object.values(o).forEach(walk); }
})(MN);
const mnuRec = (uid) => { const [, a] = uid.split('.'); const p = `upanishads/mahanarayana/edition/analysis/10-${a.padStart(2, '0')}.json`; return has(p) ? J(p) : null; };
const mnuUrl = (uid) => { const [, a] = uid.split('.'); return `/upanishads/mahanarayana/anuvaka-10-${a.padStart(2, '0')}.html#u${uid.replace(/\./g, '-')}`; };

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ACC = /[॒॑᳐-᳿꣠-꣱]/g;
const iast = (dev) => dev2iast(String(dev).replace(ACC, '').replace(/ॐ/g, 'ओम्').replace(/ओं/g, 'ओम्')).replace(/\s*\|\|\s*/g, ' ‖ ').replace(/\s*\|\s*/g, ' | ').replace(/‖/g, '||').replace(/\s+/g, ' ').trim();
const DEVRUN = /([ऀ-ॿ᳐-᳿][ऀ-ॿ᳐-᳿\s'‘’ऽ।॥,\-–—()]*[ऀ-ॿ᳐-᳿।॥]|[ऀ-ॿ])/g;
function rich(s) {
  let t = esc(s);
  t = t.replace(/«([^»]+)»/g, (m, q) => `<q class="sq" lang="sa">${q}</q>`);
  return t.split(/(<q class="sq" lang="sa">[^<]*<\/q>)/).map((p) => (p.startsWith('<q ') ? p : p.replace(DEVRUN, '<span lang="sa">$1</span>'))).join('');
}
const LABEL = { direct: 'Direct Textual Meaning', traditional: 'Traditional Interpretation', linguistic: 'Linguistic and Textual Analysis', historical: 'Academic History', reflection: 'Contemporary Reflection' };
const chip = (l) => `<span class="lab lab-${esc(l)}">${esc(LABEL[l] || l)}</span>`;
const WHO = { sayana: 'Sāyaṇa', bhaskara: 'Bhaṭṭa Bhāskara', 'sayana-rv': 'Sāyaṇa on the Ṛgveda', 'sayana-viniyoga': 'Sāyaṇa’s viniyoga', 'bhaskara-viniyoga': 'Bhaṭṭa Bhāskara’s viniyoga' };
const KIND = { formula: 'Formula', verse: 'Verse of the prayoga', viniyoga: 'Viniyoga', nyasa: 'Nyāsa', 'vedic-composite': 'Vedic (composite)' };
const VCLASS = { orthographic: 'Spelling only', variant: 'Variant reading', recension: 'Other recension', 'witness-error': 'Witness error', review: 'Verification required' };
const lines = (t) => String(t).split(/\s*[।॥]+\s*/).map((x) => x.trim()).filter((x) => x && !/^[०-९\d\s]+$/.test(x));
const pad2 = (n) => String(n).padStart(2, '0');
const stepUrl = (st) => `${DIR}${st.id}.html`;
const svcUrl = (s) => `${DIR}${s}.html`;
const ORN = '<p class="orn" aria-hidden="true"><span>✲</span></p>';
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;

/* ---------------- shell ---------------- */
const FONTS = 'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit:ital@0;1&family=Noto+Serif+Devanagari:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';
const NAV = (cur) => [[DIR, 'The edition', cur === 'home'], ...R.services.map((s) => [svcUrl(s.id), s.en, cur === s.id]), [`${DIR}sources.html`, 'Sources', cur === 'sources'], [`/${EID}/`, 'Questions & answers', false]];
function shell({ title, desc, url, body, cur = '', crumbs = [], reader = false, ld = null }) {
  const navHTML = NAV(cur).map(([h, l, c]) => `<a href="${h}"${c ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  const crumb = crumbs.length ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([h, l], i) => (i === crumbs.length - 1 ? `<li aria-current="page">${l}</li>` : `<li><a href="${h}">${l}</a></li>`)).join('')}</ol></nav>` : '';
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
<link rel="stylesheet" href="${RCSS}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="ps:continue" content="sacred" data-title="${esc(title)}">
</head>
<body class="up">
<a class="skip-link" href="#main">Skip to the content</a>
<header class="site-bar">
<a class="brand" href="${DIR}"><span class="brand-dev" lang="sa">सन्ध्यावन्दनम्</span><span class="brand-en">Sandhyāvandanam</span></a>
<nav class="site-nav" aria-label="Sandhyāvandanam">${navHTML}<a class="to-sacred" href="/sacred/">Sacred Library</a></nav>
</header>
${reader ? READER : ''}<main id="main">
${crumb}${body}
</main>
<footer class="site-foot">
${ORN}
<p><span lang="sa">तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि । धियो यो नः प्रचोदयात् ॥</span></p>
<p>Sandhyāvandanam · A study edition in the PaddySpeaks Sacred Library · Sanskrit verified against declared witnesses; analysis machine-checked and awaiting scholarly review</p>
<p><a href="${DIR}">The edition</a> · <a href="${DIR}sources.html">Sources</a> · <a href="/upanishads/mahanarayana/">The Mahānārāyaṇa</a> · <a href="/sacred/">Sacred Library</a> · <a href="${SITE}/">PaddySpeaks</a></p>
</footer>
<script defer src="${JS}"></script>
<script defer src="/lib/ps.js"></script>
<script defer src="/lib/ps-sources.js" data-provenance="${EID}"></script>
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
const written = new Map();
const LEAK = /(?:>|="|Step |Item )(?:undefined|NaN)\b/;
function out(rel, html) {
  const m = LEAK.exec(html);
  if (m) throw new Error(`${rel}: a missing value reached the page (“…${html.slice(Math.max(0, m.index - 60), m.index + 30)}…”)`);
  written.set(rel, html);
}

/* ---------------- items ---------------- */
/** Everything a page needs to show one item of the rite. */
function item(it) {
  if (it.v) {
    const m = MANTRA[it.v];
    const e = AN(it.v);
    const cites = [...new Set(m.units.map((u) => u.cite))].join('; ');
    return { kind: 'vedic', id: it.v, key: it.v, e, title: e ? e.title : it.v, tag: `Vedic · ${cites}`,
      units: m.units.map((u) => ({ id: u.id, sa: u.samhita, plain: u.plain, rv: u.rv })), cite: cites };
  }
  if (it.t) {
    const t = T.texts[it.t];
    const e = AN(it.t);
    return { kind: RT[it.t].kind, id: it.t, key: it.t, e, title: e ? e.title : RT[it.t].title, tag: KIND[RT[it.t].kind] || RT[it.t].kind,
      units: [{ id: it.t, sa: t.text, plain: t.text }], base: t.base, note: RT[it.t].note, mnuRef: it.mnu_ref };
  }
  const u = MNU[it.mnu];
  let text = u.lines.join(' ');
  let part = false;
  if (it.from) {
    // the recited part of the unit, cut by its first and last words
    const a = text.indexOf(it.from.split(' ')[0]);
    const lastw = it.to.split(' ').pop();
    const b = text.indexOf(lastw, a);
    if (a >= 0 && b >= 0) { text = text.slice(a, b + lastw.length); part = true; }
  }
  const rec = mnuRec(it.mnu);
  const ui = rec ? rec.units.findIndex((x) => x.id === it.mnu) : -1;
  const ue = ui >= 0 ? rec.units[ui] : null;
  return { kind: 'mnu', id: `mnu-${it.mnu.replace(/\./g, '-')}`, key: it.mnu, title: rec ? rec.title : `Mahānārāyaṇa ${it.mnu}`, tag: `Vedic · Mahānārāyaṇa ${it.mnu} (TA 10)`,
    units: [{ id: it.mnu, sa: text, plain: text }], part, mnu: it.mnu, mnuE: ue, mnuRec: rec, url: mnuUrl(it.mnu) };
}
const only = (it) => (it.only ? it.only : R.services.map((s) => s.id));
const svcTags = (it) => (it.only ? `<span class="svc">${it.only.map((s) => esc(SV[s].en)).join(' · ')}</span>` : '');

// The fonts have no glyph for the jihvāmūlīya ᳵ and upadhmānīya ᳶ the Saṃhitā writes
// before k/p; they are shown as the visarga they stand for, marked and titled.
const jm = (s) => esc(s).replace(/[ᳵᳶ]/g, (c) => `<abbr class="jm" title="${c === 'ᳵ' ? 'jihvāmūlīya' : 'upadhmānīya'} (the witness writes ${c})">ः</abbr>`);
function saBlock(x) {
  return x.units.map((u) => `<p class="v-sa" lang="sa">${lines(u.sa).map((l) => `<span class="ln">${jm(l)}</span>`).join('')}</p>`).join('');
}
function iastBlock(x) {
  return x.units.map((u) => `<p class="v-iast" lang="sa-Latn">${lines(u.plain).map((l) => `<span class="ln">${esc(iast(l))}</span>`).join('')}</p>`).join('');
}
function readable(x) {
  if (x.kind === 'mnu') return x.mnuE ? `${x.part ? '<p class="note">The rite recites part of this unit; the translation is of the whole unit.</p>' : ''}<blockquote class="tr-read"><p>${rich(x.mnuE.translation.readable)}</p></blockquote>` : '';
  if (!x.e) return '<p class="pending">The analysis of this text is in preparation.</p>';
  const multi = x.units.length > 1;
  return `<blockquote class="tr-read">${x.e.units.map((u, i) => `<p>${multi ? `<span class="un">${esc(x.units[i].id)}</span> ` : ''}${rich(u.translation.readable)}</p>`).join('')}</blockquote>`;
}
function details(id, lvl, title, inner) {
  return `<details class="sec" id="${id}" data-lvl="${lvl}"${lvl <= 2 ? ' open' : ''}><summary><span class="sec-t">${title}</span></summary><div class="sec-b">${inner}</div></details>`;
}
function analysis(x) {
  if (x.kind === 'mnu') {
    return `<p class="note">This is a mantra of the Mahānārāyaṇa Upaniṣad (Taittirīya Āraṇyaka 10), where its text is proven and analysed in full: padaccheda, word by word, translation, the three commentaries. <a href="${x.url}">Mahānārāyaṇa ${esc(x.mnu)} in the Upaniṣad edition</a>.</p>`;
  }
  const e = x.e;
  if (!e) return '';
  const multi = x.units.length > 1;
  const uh = (i) => (multi ? `<h4 class="unit-h">${esc(x.units[i].id)}${x.units[i].rv ? '' : ''}</h4>` : '');
  const id = x.id;
  let h = '';
  h += details(`${id}-pada`, 2, 'Padaccheda <span>· the words separated</span>', `${e.units.map((u, i) => `${uh(i)}<p class="pada-sa" lang="sa">${u.padaccheda.map((ln) => `<span class="ln">${ln.map((w) => `<span class="pw">${esc(w)}</span>`).join(' <span class="psep" aria-hidden="true">·</span> ')}</span>`).join('')}</p><p class="pada-iast" lang="sa-Latn">${u.padaccheda.map((ln) => `<span class="ln">${ln.map((w) => esc(iast(w))).join(' · ')}</span>`).join('')}</p>`).join('')}<p class="note">Proven: the checker rejoins these words by the rules of sandhi and they spell the text exactly.</p>`);
  const nw = e.units.reduce((a, u) => a + u.words.length, 0);
  h += details(`${id}-words`, 2, `Word by word <span>· ${nw} words</span>`, e.units.map((u, i) => `${uh(i)}<div class="tw" tabindex="0"><table class="words"><caption class="sr">Word-by-word analysis of ${esc(x.units[i].id)}</caption><thead><tr><th scope="col">Word</th><th scope="col">Meaning in context</th><th scope="col">Role</th><th scope="col">Form</th></tr></thead><tbody>${u.words.map((w) => `<tr><th scope="row"><span class="w-d" lang="sa">${esc(w.w)}</span><span class="w-i" lang="sa-Latn">${esc(iast(w.w))}</span></th><td>${rich(w.meaning)}${w.context ? `<span class="w-c">${rich(w.context)}</span>` : ''}</td><td>${rich(w.role)}</td><td>${rich(w.gram)}<span class="w-b">${w.base ? `stem/root <span lang="sa">${esc(w.base)}</span>` : ''}</span></td></tr>`).join('')}</tbody></table></div>`).join(''));
  h += details(`${id}-lit`, 2, 'Faithful English translation', `${e.units.map((u, i) => `<p class="tr-lit">${multi ? `<span class="un">${esc(x.units[i].id)}</span> ` : ''}${rich(u.translation.literal)}</p>`).join('')}<p class="note">Word for word; words supplied for English are in [brackets].</p>`);
  h += details(`${id}-mean`, 1, 'What it says and does', `<p>${rich(e.meaning)}</p><p><span class="lbl">In the rite</span> ${rich(e.in_the_rite)}</p>`);
  if ((e.commentary || []).length) h += details(`${id}-comm`, 2, 'The commentators', e.commentary.map((c) => `<div class="cm">${chip(c.label)}<h4 class="cm-q">${esc(WHO[c.who] || c.who)}</h4><p>${rich(c.text)}</p></div>`).join(''));
  const all = (f) => e.units.flatMap((u, i) => (u[f] || []).map((y) => ({ ...y, _i: i })));
  const sandhi = all('sandhi'), samasa = all('samasa'), morph = all('morphology');
  const ut = (y) => (multi ? `<span class="un">${esc(x.units[y._i].id)}</span> ` : '');
  const split = (s) => (Array.isArray(s) ? s.join(' + ') : s);
  let adv = chip('linguistic');
  adv += `<h4>Sandhi</h4>${sandhi.length ? `<ul class="cards">${sandhi.map((y) => `<li><p class="c-h">${ut(y)}<span class="c-sa" lang="sa">${esc(y.joined)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(y.joined))}</span> <span class="arr" aria-hidden="true">→</span> <span class="c-sa" lang="sa">${esc(split(y.split))}</span></p><p class="c-tag">${esc(y.type)}</p><p>${rich(y.rule)}</p></li>`).join('')}</ul>` : '<p class="none">No junction needs comment.</p>'}`;
  adv += `<h4>Compounds</h4>${samasa.length ? `<ul class="cards">${samasa.map((y) => `<li><p class="c-h">${ut(y)}<span class="c-sa" lang="sa">${esc(y.word)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(y.word))}</span></p><p class="c-tag">${esc(y.type)} · ${(Array.isArray(y.members) ? y.members : String(y.members || '').split(/\s*\+\s*/)).map((mm) => `<span lang="sa">${esc(mm)}</span>`).join(' + ')}</p><p><span class="lbl">Vigraha</span> <span lang="sa">${esc(y.vigraha)}</span></p><p>${rich(y.meaning)}</p></li>`).join('')}</ul>` : '<p class="none">No compound.</p>'}`;
  if (morph.length) adv += `<h4>Forms</h4><ul class="plain">${morph.map((y) => `<li>${ut(y)}<span lang="sa">${esc(y.word)}</span> — ${rich(y.note)}</li>`).join('')}</ul>`;
  h += details(`${id}-adv`, 3, 'Sanskrit analysis', adv);
  if ((e.notes || []).length || (e.flags || []).length) h += details(`${id}-notes`, 3, 'Notes', `${(e.notes || []).map((n) => `<div class="cm">${chip(n.label)}<p>${rich(n.text)}</p></div>`).join('')}${(e.flags || []).map((f) => `<p class="flag"><b>${esc(f.kind === 'review' ? 'Verification required' : 'Variant')}</b> ${rich(f.text)}</p>`).join('')}`);
  return h;
}
function sourceBlock(x) {
  let h = '';
  if (x.kind === 'vedic') {
    h += `<p>Cut from <b>${esc(x.cite)}</b> (base witness W1; collated with W2) by <code>scripts/prayoga/import.py</code>.</p>`;
    const rv = x.units.filter((u) => u.rv && W.RV.units[u.id]);
    if (rv.length) h += `<p class="c-tag">The Ṛgveda (Śākala recension, GRETIL, no svara)</p>${rv.map((u) => `<p class="v-sa acc" lang="sa">${esc(W.RV.units[u.id].text)} <span class="note">— ${esc(u.rv)}</span></p>`).join('')}`;
  } else if (x.kind !== 'mnu') {
    h += `<p>Base witness: <b>${x.base === 'S' ? 'S (stotrasamhita)' : 'M (the Mylapore prayoga)'}</b>${W[x.base === 'S' ? 'M' : 'S'].texts[x.key] ? `; collated with ${x.base === 'S' ? 'M' : 'S'}` : '; the other witness does not have this text'}.</p>`;
    if (x.note) h += `<p>${rich(x.note)}</p>`;
    if (x.mnuRef) h += `<p>See ${x.mnuRef.map((u) => `<a href="${mnuUrl(u)}">Mahānārāyaṇa ${esc(u)}</a>`).join(' and ')}.</p>`;
  }
  const ids = new Set(x.units.map((u) => u.id));
  const corr = C.text.filter((c) => ids.has(c.at));
  const coll = C.collation.filter((c) => ids.has(c.at));
  if (corr.length) h += `<p class="c-tag">Corrections to the base witness</p><ul class="plain">${corr.map((c) => `<li><span lang="sa">${esc(c.base)}</span> → <span lang="sa">${esc(c.edition)}</span>: ${rich(c.why)}</li>`).join('')}</ul>`;
  if (coll.length) h += `<p class="c-tag">The other witness</p><ul class="plain">${coll.map((c) => `<li><span class="vc vc-${esc(c.class)}">${esc(VCLASS[c.class])}</span> ${esc(c.wit)}: ${rich(c.note)}</li>`).join('')}</ul>`;
  return h;
}
function itemBlock(x, it, n) {
  return `<section class="item" id="${esc(x.id)}" aria-labelledby="${esc(x.id)}-h">
<h3 id="${esc(x.id)}-h" class="item-h"><span class="sec-n">${n}</span> ${rich(x.title)} <span class="item-tag">${esc(x.tag)}</span> ${svcTags(it)}</h3>
<div class="v-text">${saBlock(x)}</div>
${iastBlock(x)}
${readable(x)}
${analysis(x)}
${details(`${x.id}-src`, 3, 'Source and witnesses', sourceBlock(x))}
</section>`;
}

/* ---------------- pages ---------------- */
function stepPage(st, i) {
  const prev = R.steps[i - 1], next = R.steps[i + 1];
  let h = `<article class="mantra rite" aria-labelledby="st-h">
<header class="m-hero"><p class="kicker">Sandhyāvandanam · Step ${i + 1} of ${R.steps.length}</p>
<h1 id="st-h"><span class="h-en">${esc(st.en)}</span> <span class="h-sa" lang="sa">${esc(st.sa)}</span></h1>
<p class="h-i">${rich(st.what)}</p>
<nav class="m-nav" aria-label="Steps">${prev ? `<a href="${stepUrl(prev)}" rel="prev">‹ ${esc(prev.en)}</a>` : '<span></span>'}<a href="${DIR}#steps">All ${R.steps.length} steps</a>${next ? `<a href="${stepUrl(next)}" rel="next">${esc(next.en)} ›</a>` : '<span></span>'}</nav></header>`;
  h += st.items.map((it, k) => itemBlock(item(it), it, k + 1)).join('\n');
  h += `<nav class="pager" aria-label="Previous and next step">${prev ? `<a href="${stepUrl(prev)}" rel="prev"><span class="pg-k">Previous</span><span class="pg-sa" lang="sa">${esc(prev.sa)}</span><span class="pg-en">${esc(prev.en)}</span></a>` : '<span></span>'}${next ? `<a class="pg-next" href="${stepUrl(next)}" rel="next"><span class="pg-k">Next</span><span class="pg-sa" lang="sa">${esc(next.sa)}</span><span class="pg-en">${esc(next.en)}</span></a>` : `<a class="pg-next" href="${DIR}sources.html"><span class="pg-k">Continue</span><span class="pg-en">Sources, variants and corrections</span></a>`}</nav>`;
  h += `<p class="cite note">Cite this step: <i>Sandhyāvandanam</i>, ${esc(st.en)}, PaddySpeaks study edition, ${SITE}${stepUrl(st)}</p></article>`;
  out(stepUrl(st).slice(1), shell({ title: `${st.en} (${iast(st.sa)}) — Sandhyāvandanam`, desc: `${st.what} The Sanskrit verified against its sources, with IAST, word-by-word analysis and English.`, url: stepUrl(st), body: h, reader: true, crumbs: [['/sacred/', 'Sacred Library'], [DIR, 'Sandhyāvandanam'], ['', esc(st.en)]] }));
}
function servicePage(s) {
  let h = `<div class="page"><header class="ch-hero"><p class="kicker">Sandhyāvandanam · read straight through</p><h1><span class="h-en">The ${esc(s.en.toLowerCase())} Sandhyā</span> <span class="h-sa" lang="sa">${esc(s.sa)}</span></h1><p class="h-i">Every text of the ${esc(s.en.toLowerCase())} service in order: Sanskrit, IAST and readable English. Each step links to its full analysis.</p></header>`;
  R.steps.forEach((st, i) => {
    const its = st.items.filter((it) => only(it).includes(s.id));
    if (!its.length) return;
    h += `<section class="band" aria-labelledby="r-${st.id}"><h2 id="r-${st.id}"><a href="${stepUrl(st)}">${i + 1}. ${esc(st.en)}</a> <span lang="sa">${esc(st.sa)}</span></h2><p class="note">${rich(st.what)}</p>`;
    h += its.map((it) => { const x = item(it); return `<div class="read-item"><p class="read-t">${rich(x.title)} <span class="item-tag">${esc(x.tag)}</span></p><div class="v-text">${saBlock(x)}</div>${iastBlock(x)}${readable(x)}</div>`; }).join('');
    h += `</section>`;
  });
  h += `</div>`;
  out(svcUrl(s.id).slice(1), shell({ title: `The ${s.en.toLowerCase()} Sandhyāvandanam — read straight through`, desc: `The whole ${s.en.toLowerCase()} Sandhyāvandanam (Kṛṣṇa Yajurveda, Āpastamba) on one page: verified Sanskrit, IAST and readable English.`, url: svcUrl(s.id), body: h, cur: s.id, reader: true, crumbs: [['/sacred/', 'Sacred Library'], [DIR, 'Sandhyāvandanam'], ['', `${esc(s.en)} service`]] }));
}
function landing() {
  const basis = MANTRA[R.basis];
  const cell = (st, s) => { const its = st.items.filter((it) => only(it).includes(s)); return its.length ? its.map((it) => esc(item(it).title)).join('<br>') : '—'; };
  const vedic = R.steps.flatMap((st) => st.items.filter((it) => it.v || it.mnu)).length;
  let h = `<div class="page"><header class="ch-hero"><p class="kicker">A study edition · Kṛṣṇa Yajurveda · Āpastamba</p><h1><span class="h-sa" lang="sa">सन्ध्यावन्दनम्</span><span class="h-en">Sandhyāvandanam</span></h1><p class="h-i">${rich(L.subtitle)}</p></header>
<p class="ov-lead">${rich(L.lead)}</p>
<section class="band" aria-labelledby="read-h"><h2 id="read-h">Read the rite</h2><ul class="refs">${R.services.map((s) => `<li><a href="${svcUrl(s.id)}">The ${esc(s.en.toLowerCase())} Sandhyā</a> <span lang="sa">${esc(s.sa)}</span> — every text in order, Sanskrit, IAST and English on one page.</li>`).join('')}</ul></section>
<section class="band" aria-labelledby="basis-h"><h2 id="basis-h">${esc(L.basis.title)}</h2>${(L.basis.paras || []).map((p) => `<p>${rich(p)}</p>`).join('')}<div class="v-text"><p class="v-sa" lang="sa">${jm(basis.units[0].samhita)}</p></div><p class="v-iast" lang="sa-Latn">${esc(iast(basis.units[0].plain))}</p><p class="note">${esc(basis.units[0].cite)}, cut from the muralīdhara Āraṇyaka with svara as it keys it. ${esc(L.basis.note || '')}</p></section>
<section class="band" aria-labelledby="steps-h" id="steps"><h2 id="steps-h">The ${R.steps.length} steps</h2><p>${rich(L.steps)}</p><div class="tw" tabindex="0"><table class="cmp"><caption class="sr">The steps of the rite and what each service recites at them</caption><thead><tr><th scope="col">Step</th>${R.services.map((s) => `<th scope="col">${esc(s.en)}</th>`).join('')}</tr></thead><tbody>${R.steps.map((st, i) => `<tr><th scope="row"><a href="${stepUrl(st)}">${i + 1}. ${esc(st.en)}</a> <span lang="sa">${esc(st.sa)}</span></th>${R.services.map((s) => `<td>${cell(st, s.id)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
<section class="band" aria-labelledby="how-h"><h2 id="how-h">How the text was established</h2>${(L.method || []).map((p) => `<p>${rich(p)}</p>`).join('')}<p><a href="${DIR}sources.html">Sources, variants and corrections</a> — every witness and every difference.</p></section>
<section class="band" aria-labelledby="more-h"><h2 id="more-h">Elsewhere on PaddySpeaks</h2><ul class="refs"><li><a href="/upanishads/mahanarayana/">The Mahānārāyaṇa Upaniṣad</a> — the Āraṇyaka that holds ${vedic ? 'many of' : ''} the Sandhyā mantras, analysed in full.</li><li><a href="/${EID}/">Sandhyāvandanam: questions and answers</a> — fifty questions on the practice.</li></ul></section></div>`;
  out(DIR.slice(1) + 'index.html', shell({ title: 'Sandhyāvandanam — A Study Edition', desc: L.desc, url: DIR, body: h, cur: 'home', crumbs: [['/sacred/', 'Sacred Library'], ['', 'Sandhyāvandanam']],
    ld: { '@context': 'https://schema.org', '@type': 'Book', name: 'Sandhyāvandanam — A Study Edition', alternateName: 'सन्ध्यावन्दनम्', inLanguage: ['sa', 'en'], url: `${SITE}${DIR}`, isPartOf: { '@type': 'CollectionPage', name: 'The Sacred Library', url: `${SITE}/sacred/` } } }));
}
function sourcesPage() {
  const wit = (k, d) => `<li><b>${k}</b> — ${rich(d.label)}${d.commit ? ` <span class="note">(commit ${esc(String(d.commit).slice(0, 10))})</span>` : ''}</li>`;
  let h = `<div class="page"><header class="ch-hero"><p class="kicker">Sandhyāvandanam</p><h1><span class="h-en">Sources, Variants and Corrections</span></h1></header>
<section class="band" aria-labelledby="w-h"><h2 id="w-h">The witnesses</h2><ul class="refs">${wit('W1', W.W1)}${wit('W2', W.W2)}${wit('RV', W.RV)}${wit('M', W.M)}${wit('S', W.S)}<li><b>Commentaries</b> — Sāyaṇa and Bhaṭṭa Bhāskara on the Taittirīya Saṃhitā, Brāhmaṇa and Āraṇyaka, as the vishvAsa corpus labels them (witnesses/comm.json).</li><li><b>The Mahānārāyaṇa</b> — its units are proven in <a href="/upanishads/mahanarayana/sources.html">its own edition</a>.</li></ul>${(L.sources || []).map((p) => `<p>${rich(p)}</p>`).join('')}</section>
<section class="band" aria-labelledby="c-h"><h2 id="c-h">Corrections to a base witness</h2>${C.text.length ? `<ul class="plain">${C.text.map((c) => `<li><b>${esc(c.at)}</b> <span lang="sa">${esc(c.base)}</span> → <span lang="sa">${esc(c.edition)}</span>: ${rich(c.why)}</li>`).join('')}</ul>` : '<p class="none">None.</p>'}</section>
<section class="band" aria-labelledby="v-h" id="variants"><h2 id="v-h">Every difference of the other witness (${C.collation.length})</h2><div class="tw" tabindex="0"><table class="cmp"><thead><tr><th scope="col">At</th><th scope="col">Witness</th><th scope="col">Class</th><th scope="col">Note</th></tr></thead><tbody>${C.collation.map((c) => `<tr><th scope="row">${esc(c.at)}</th><td>${esc(c.wit)}</td><td>${esc(VCLASS[c.class])}</td><td>${rich(c.note)}</td></tr>`).join('')}</tbody></table></div></section>
<section class="band" aria-labelledby="ver-h"><h2 id="ver-h">Verification</h2><p>Run on every pull request by <code>scripts/prayoga/check.py</code> (Validate Content). It proves that every Vedic unit equals its source in the Taittirīya Saṃhitā, Brāhmaṇa or Āraṇyaka apart from the logged corrections; that every text of the rite equals its base witness; that every difference of the other witness is listed and classified here; that every item of the rite exists, including the Mahānārāyaṇa units it recites; that every padaccheda rejoins by sandhi into the text and every word table lists exactly those words; and that every Sanskrit phrase quoted from a commentator occurs in that commentator’s text on the passage.</p></section></div>`;
  out(DIR.slice(1) + 'sources.html', shell({ title: 'Sandhyāvandanam — Sources, Variants and Corrections', desc: 'The witnesses of the Sandhyāvandanam study edition, every correction and every variant classified, and the verification report.', url: `${DIR}sources.html`, body: h, cur: 'sources', crumbs: [['/sacred/', 'Sacred Library'], [DIR, 'Sandhyāvandanam'], ['', 'Sources']] }));
}

landing();
R.services.forEach(servicePage);
R.steps.forEach(stepPage);
sourcesPage();

/* ---------------- write / check ---------------- */
let stale = 0;
for (const [rel, html] of written) {
  const p = A(rel);
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (cur === html) continue;
  if (CHECK) { console.error(`stale: ${rel}`); stale++; continue; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}
// no generated page may be left behind once its step is gone
const mine = new Set([...written.keys()].map((r) => path.basename(r)));
for (const f of fs.readdirSync(A(ED))) {
  if (f.endsWith('.html') && !mine.has(f)) {
    if (CHECK) { console.error(`orphan page: ${ED}/${f}`); stale++; } else fs.unlinkSync(A(`${ED}/${f}`));
  }
}
if (CHECK && stale) { console.error(`\n${stale} page(s) stale — run node scripts/prayoga/build.mjs ${EID}`); process.exit(1); }
console.log(`${EID}: ${written.size} pages ${CHECK ? 'current' : 'written'}`);
