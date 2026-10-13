#!/usr/bin/env node
/**
 * Śrī Devī Māhātmyam — study edition build.
 *
 * ONE source, everything else generated from it:
 *   devi-mahatmyam/edition/text.json         the Sanskrit (Gita Press Durgāsaptaśatī, 700 mantras)
 *   devi-mahatmyam/edition/corrections.json  corrections to the digital text, variants, notes
 *   devi-mahatmyam/edition/analysis/CC.json  per-mantra padaccheda, word table, vyākaraṇa,
 *                                            translations, commentary; chapter intro,
 *                                            conclusion and report
 *
 *   node scripts/devi_mahatmyam/build.mjs           write devi-mahatmyam/index.html,
 *                                                   edition/chapter-NN.html, edition/how-to-study.html,
 *                                                   edition/notes.html
 *   node scripts/devi_mahatmyam/build.mjs --check   CI: fail if any of those is stale
 *
 * Never edit the HTML by hand. IAST is never typed: every transliteration on
 * the pages is dev2iast() of the Devanagari shown beside it. Run
 * `python3 scripts/devi_mahatmyam/check.py` too — it proves the text and the
 * padaccheda (docs/DEVI-MAHATMYAM-EDITION.md).
 *
 * The design (2026-10-13): a reading companion, not a report. Every field of
 * the analysis is still rendered — the Sanskrit, IAST, padaccheda, word table
 * and translation are always visible; sandhi, samāsa, morphology/anvaya and
 * commentary sit in collapsible sections. Verse anchors (#m-C-N) never change:
 * search and the notes page link to them. Styles: edition/edition.css;
 * behaviour (reader controls, progress, copy): edition/reader.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dev2iast } from '../lalitha/translit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (p) => path.join(ROOT, p);
const DIR = 'devi-mahatmyam';
const ED = `${DIR}/edition`;
const SITE = 'https://paddyspeaks.com';
const CHECK = process.argv.includes('--check');
const readJSON = (p) => JSON.parse(fs.readFileSync(A(p), 'utf8'));

const T = readJSON(`${ED}/text.json`);
const LOG = readJSON(`${ED}/corrections.json`);
const AN = new Map();
for (let ch = 1; ch <= 13; ch++) {
  const p = `${ED}/analysis/${String(ch).padStart(2, '0')}.json`;
  if (fs.existsSync(A(p))) AN.set(ch, readJSON(p));
}
const hashOf = (p) => crypto.createHash('sha256').update(fs.readFileSync(A(p))).digest('hex').slice(0, 10);
const CSS_HASH = hashOf(`${ED}/edition.css`);
const JS_HASH = hashOf(`${ED}/reader.js`);

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIGITS = '०१२३४५६७८९';
const devNum = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
const iast = (dev) => dev2iast(dev).replace(/·/g, '');
const pad2 = (n) => String(n).padStart(2, '0');
const chFile = (ch) => `chapter-${pad2(ch)}.html`;
const chURL = (ch) => `/${ED}/${chFile(ch)}`;
const mid = (ch, m) => `${ch}.${m.n}${m.to ? `-${m.to}` : ''}`;
const midShow = (ch, m) => mid(ch, m).replace('-', '–');
const anchor = (ch, m) => `m-${ch}-${m.n}`;
const idAnchor = (id) => `m-${id.split('-')[0].replace('.', '-')}`;
const KIND = { uvaca: 'Speaker', ardha: 'Half-śloka', sloka: 'Śloka', tripada: 'Three-part mantra' };
const CARITA = {
  prathama: { name: 'Prathama Carita', en: 'The First Episode', dev: 'प्रथमचरितम्', form: 'Mahākālī', formDev: 'महाकाली', chapters: 'Chapter 1' },
  madhyama: { name: 'Madhyama Carita', en: 'The Middle Episode', dev: 'मध्यमचरितम्', form: 'Mahālakṣmī', formDev: 'महालक्ष्मी', chapters: 'Chapters 2–4' },
  uttama: { name: 'Uttama Carita', en: 'The Final Episode', dev: 'उत्तमचरितम्', form: 'Mahāsarasvatī', formDev: 'महासरस्वती', chapters: 'Chapters 5–13' },
};
const CLABEL = {
  direct: 'Direct textual meaning',
  traditional: 'Traditional interpretation',
  comparative: 'Comparative Śākta / Śrīvidyā',
  reflection: 'Modern reflection',
};
const range = (c) => `${c.num}.1–${c.num}.${c.mantras.at(-1).to || c.mantras.at(-1).n}`;
const iastLine = (l) => esc(iast(l).replace(/\s*(\|\|?)\s*/g, '\u00a0$1 ').trim()); // a daṇḍa never starts a line
const ORN = '<p class="orn" aria-hidden="true"><span>❁</span></p>';

/* ---------- metre: laghu/guru from the IAST of each printed line ---------- */
const LONGV = new Set(['ā', 'ī', 'ū', 'ṝ', 'e', 'ai', 'o', 'au']);
const VRE = /ai|au|[aāiīuūṛṝḷḹeo]/g;
function weights(line) {
  const t = iast(line).replace(/[|'’\-0-9 ]/g, '').replace(/oṃ/g, '');
  const vs = [...t.matchAll(VRE)];
  return vs.map((v, i) => {
    const end = v.index + v[0].length;
    const next = i + 1 < vs.length ? vs[i + 1].index : t.length;
    const coda = t.slice(end, next).replace(/([kgcjṭḍtdpb])h/g, '$1'); // an aspirate is one consonant
    const long = LONGV.has(v[0]) || /^[ṃḥ]/.test(t.slice(end)) || coda.length >= 2;
    return long ? 'G' : 'L';
  });
}
const PATTERNS = {
  11: [['GGLGGLLGLGG', 'indravajrā'], ['LGLGGLLGLGG', 'upendravajrā']],
  12: [['LGLGGLLGLGLG', 'vaṃśastha'], ['GGLGGLLGLGLG', 'indravaṃśā']],
  14: [['GGLGLLLGLLGLGG', 'vasantatilakā']],
};
function metre(m) {
  if (m.kind === 'uvaca') return '';
  if (m.kind === 'tripada') return 'anuṣṭubh line + refrain';
  const counts = m.lines.map((l) => weights(l.replace(/[।॥]/g, '')).length);
  if (counts.every((c) => c >= 15 && c <= 17)) return 'anuṣṭubh';
  if (m.lines.length === 4) {
    const names = m.lines.map((l) => {
      const w = weights(l.replace(/[।॥]/g, ''));
      const cand = PATTERNS[w.length] || [];
      const hit = cand.find(([p]) => p.slice(0, -1) === w.join('').slice(0, -1));
      return hit ? hit[1] : `${w.length}`;
    });
    if (names.every((n) => n === 'vasantatilakā')) return 'vasantatilakā';
    if (names.every((n) => n === 'indravajrā' || n === 'upendravajrā')) return new Set(names).size === 1 ? names[0] : 'upajāti (triṣṭubh)';
    if (names.every((n) => n === 'vaṃśastha' || n === 'indravaṃśā')) return new Set(names).size === 1 ? names[0] : 'upajāti (jagatī)';
    const syl = new Set(counts);
    if (syl.size === 1) return `${counts[0]} syllables a quarter`;
  }
  return '';
}

/* ---------- page shell ---------- */
const FONTS = 'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit:ital@0;1&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';
function shell({ title, desc, url, body, page, reader }) {
  const nav = [
    ['home', `/${DIR}/`, 'Chapters'],
    ['study', `/${ED}/how-to-study.html`, 'How to Study'],
    ['notes', `/${ED}/notes.html`, 'Sources'],
  ].map(([k, href, label]) => `<a href="${href}"${k === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
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
<meta name="theme-color" content="#7b1e1e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/${ED}/edition.css?v=${CSS_HASH}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="ps:continue" content="sacred" data-title="${esc(title)}">
</head>
<body class="dm dm-${page}">
<a class="skip-link" href="#main">Skip to the text</a>
<header class="site-bar">
<a class="brand" href="/${DIR}/"><span class="brand-dev" lang="sa">देवीमाहात्म्यम्</span><span class="brand-en">Devī Māhātmyam</span></a>
<nav class="site-nav" aria-label="Edition">${nav}<a class="to-sacred" href="/sacred/">All sacred texts</a></nav>
</header>
${reader || ''}<main id="main">
${body}
</main>
<footer class="site-foot">
${ORN}
<p><span lang="sa">॥ इति श्रीदेवीमाहात्म्यम् ॥</span></p>
<p>Śrī Devī Māhātmyam · Study Edition · Sanskrit text: Gita Press, Gorakhpur (<i>Śrīdurgāsaptaśatī</i>)</p>
<p><a href="/${DIR}/">Chapters</a> · <a href="/${ED}/how-to-study.html">How to Study</a> · <a href="/${ED}/notes.html">Sources, corrections &amp; verification</a> · <a href="/sacred/">Sacred texts</a> · <a href="${SITE}/">PaddySpeaks</a></p>
</footer>
<script defer src="/${ED}/reader.js?v=${JS_HASH}"></script>
<script defer src="/lib/ps.js"></script>
<script defer src="/lib/ps-sources.js" data-provenance="devi-mahatmyam"></script>
<script defer src="/lib/ps-platform.js"></script>
</body>
</html>
`;
}

/* ---------- status of a chapter (shown on the Sources page and in each chapter's report only) ---------- */
function chapterStatus(ch) {
  const a = AN.get(ch);
  const c = T.chapters[ch - 1];
  if (!a) return { cls: 'pend', text: 'Text only — analysis in preparation' };
  if (a.mantras.length < c.mantras.length) return { cls: 'pend', text: `Analysis ${a.mantras.length} of ${c.mantras.length}` };
  const s = a.report?.status || 'Complete';
  return { cls: s === 'Complete' ? 'ok' : s.startsWith('Complete') ? 'var' : 'ver', text: s };
}

/* ---------- one verse ---------- */
const copyText = (m) => m.lines.join('\n').replace(/-\n/g, '').replace(/॥\s*$/, `॥${devNum(m.to || m.n)}॥`);
function verseSanskrit(m) {
  const last = m.to || m.n;
  const lines = m.lines.map((l, i) => {
    let t = esc(l);
    if (i === m.lines.length - 1) t = t.replace(/॥\s*$/, '') + `<span class="mn">॥&#8288;${devNum(last)}&#8288;॥</span>`;
    return `<span class="ln">${t}</span>`;
  });
  const bo = m.bija_open ? `<span class="bija" title="bīja of the recitation, not part of the verse">${esc(m.bija_open)}</span>` : '';
  const bc = m.bija_close ? `<span class="bija" title="bīja of the recitation, not part of the verse">${esc(m.bija_close)}</span>` : '';
  return `<p class="v-sa" lang="sa">${bo}${lines.join('')}${bc}</p>`;
}
const padaWords = (ws) => ws.map((w) => `<span class="pw">${esc(w)}</span>`).join('&#160;<span class="psep" aria-hidden="true">·</span> ');
const padaWordsI = (ws) => ws.map((w) => `<span class="pw">${esc(iast(w))}</span>`).join('&#160;<span class="psep" aria-hidden="true">·</span> ');

function section(cls, title, inner, opts = '') {
  return `<details class="an ${cls}"${opts}><summary><span class="an-t">${title}</span></summary><div class="an-b">${inner}</div></details>`;
}

function verseHTML(ch, m, e, prev, next, i, total) {
  const id = mid(ch, m);
  const met = metre(m);
  const a = anchor(ch, m);
  const meta = [KIND[m.kind], met].filter(Boolean).join(' · ');
  const nav = `<nav class="v-nav" aria-label="Verse ${esc(midShow(ch, m))}">${prev ? `<a href="#${anchor(ch, prev)}" rel="prev" aria-label="Previous verse, ${esc(midShow(ch, prev))}">‹</a>` : '<span aria-hidden="true">‹</span>'}${next ? `<a href="#${anchor(ch, next)}" rel="next" aria-label="Next verse, ${esc(midShow(ch, next))}">›</a>` : '<span aria-hidden="true">›</span>'}</nav>`;
  let h = `<section class="verse${m.kind === 'uvaca' ? ' uvaca' : ''}" id="${a}" data-id="${esc(midShow(ch, m))}" data-i="${i}" aria-labelledby="${a}-h">
<header class="v-head"><h3 class="v-num" id="${a}-h"><a href="#${a}"><span class="vn-l">Verse</span> ${esc(midShow(ch, m))}</a></h3><span class="v-meta">${esc(meta)}</span><span class="v-tools"><button type="button" class="copy" data-copy="${esc(copyText(m))}" aria-label="Copy the Sanskrit of verse ${esc(midShow(ch, m))}">Copy</button>${nav}</span></header>
<div class="v-text">${verseSanskrit(m)}
<p class="v-iast" lang="sa-Latn">${m.lines.map((l) => `<span class="ln">${iastLine(l)}</span>`).join('')}</p></div>`;
  if (!e) {
    return h + `<p class="pending">Padaccheda, word meanings, grammar, translation and commentary for this verse are in preparation.</p></section>`;
  }
  // C. padaccheda
  h += `<div class="v-pada"><p class="lbl">Padaccheda <span>· the words separated</span></p>
<p class="pada-sa" lang="sa">${e.pada.map((l) => `<span class="ln">${padaWords(l)}</span>`).join('')}</p>
<p class="pada-iast" lang="sa-Latn">${e.pada.map((l) => `<span class="ln">${padaWordsI(l)}</span>`).join('')}</p></div>`;
  // D. word by word
  h += `<div class="v-words"><p class="lbl">Word by word</p><ol class="wl">${e.words.map((w) => `<li><span class="w-sa"><span class="w-d" lang="sa">${esc(w.w)}</span><span class="w-i" lang="sa-Latn">${esc(iast(w.w))}</span></span><span class="w-en">${esc(w.en)}</span><span class="w-g">${esc(w.g)}</span></li>`).join('')}</ol></div>`;
  // E. translation
  h += `<div class="v-tr"><p class="lbl">Translation</p><p class="tr-lit">${esc(e.lit)}</p><p class="tr-read"><span class="tr-k">In readable English</span>${esc(e.tr)}</p>${e.tr_note ? `<p class="tr-note">${esc(e.tr_note)}</p>` : ''}</div>`;
  if (e.flags?.uncertain) h += `<p class="flag"><b>Textual verification / uncertain:</b> ${esc(e.flags.uncertain)}</p>`;
  // F. analysis
  let an = '';
  {
    let s = '';
    if (e.sandhi?.length) {
      s += `<ul class="cards">${e.sandhi.map((x) => `<li><p class="c-h"><span class="c-sa" lang="sa">${esc(x.joined)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(x.joined))}</span> <span class="arr" aria-hidden="true">→</span> <span class="c-sa" lang="sa">${esc(x.split)}</span></p><p class="c-tag">${esc(x.type)} · <span lang="sa">${esc(x.rule)}</span></p><p>${esc(x.note)}</p></li>`).join('')}</ul>`;
    } else {
      s += `<p class="none">No sandhi joins the words of this verse.</p>`;
    }
    if (e.sandhi_exceptions?.length) {
      s += `<p class="c-tag">Left unjoined</p><ul class="plain">${e.sandhi_exceptions.map((x) => `<li><span lang="sa">${esc(x.at)}</span> — ${esc(x.reason)}</li>`).join('')}</ul>`;
    }
    an += section('an-sandhi', 'Sandhi &amp; sandhi-viccheda', s);
  }
  if (e.samasa?.length) {
    an += section('an-samasa', 'Samāsa &amp; samāsa-vigraha', `<ul class="cards">${e.samasa.map((x) => `<li><p class="c-h"><span class="c-sa" lang="sa">${esc(x.c)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(x.c))}</span></p><p class="c-tag">${esc(x.type)}</p><dl class="kv"><dt>Members</dt><dd lang="sa">${esc(x.members)}</dd><dt>Vigraha</dt><dd><span lang="sa">${esc(x.vigraha)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(x.vigraha))}</span></dd><dt>Literally</dt><dd>“${esc(x.literal)}”</dd><dt>In the verse</dt><dd>${esc(x.sense)}</dd>${x.alt ? `<dt>Alternative</dt><dd>${esc(x.alt)}</dd>` : ''}</dl></li>`).join('')}</ul>`);
  } else {
    an += section('an-samasa', 'Samāsa &amp; samāsa-vigraha', `<p class="none">No compound in this verse needs analysis.</p>`);
  }
  {
    let s = '';
    if (e.morph?.length) s += `<ul class="cards">${e.morph.map((f) => `<li><p class="c-h"><span class="c-sa" lang="sa">${esc(f.form)}</span> <span class="c-i" lang="sa-Latn">${esc(iast(f.form))}</span></p><p>${esc(f.note)}</p></li>`).join('')}</ul>`;
    s += `<div class="anvaya"><p class="c-tag">Anvaya · prose order</p><p class="anv-sa" lang="sa">${esc(e.anvaya)}</p><p class="anv-i" lang="sa-Latn">${iastLine(e.anvaya)}</p>${e.anvaya_en ? `<p>${esc(e.anvaya_en)}</p>` : ''}</div>`;
    an += section('an-morph', 'Morphology &amp; anvaya', s);
  }
  const main = e.comm.filter((c) => c.k !== 'comparative');
  const cmp = e.comm.filter((c) => c.k === 'comparative');
  const commHTML = (cs) => cs.map((c) => `<div class="cm"><p class="cm-k ${c.k}">${CLABEL[c.k]}</p><p>${esc(c.t)}</p></div>`).join('');
  an += section('an-comm', 'Śākta commentary', commHTML(main));
  if (cmp.length) an += section('an-cmp', 'Comparative Śrīvidyā notes', commHTML(cmp));
  h += `<div class="v-an" aria-label="Analysis of verse ${esc(midShow(ch, m))}">${an}</div>`;
  return h + `</section>`;
}

/* ---------- chapter page ---------- */
function chapterPage(c) {
  const ch = c.num;
  const a = AN.get(ch);
  const byId = new Map((a?.mantras || []).map((e) => [e.id, e]));
  const car = CARITA[c.carita];
  const titleIast = iast(c.title.dev);
  const prevC = ch > 1 ? T.chapters[ch - 2] : null;
  const nextC = ch < 13 ? T.chapters[ch] : null;
  const ms = c.mantras;
  const intro = a?.intro || {};
  let b = `<article class="chapter" data-chapter="${ch}">
<header class="ch-hero">
<p class="kicker">${car.name} · <span lang="sa">${car.dev}</span> · Chapter ${ch} of 13</p>
<h1><span class="h-sa" lang="sa">${esc(c.title.dev)}</span><span class="h-en">${esc(intro.heading_en || c.title.en)}</span></h1>
<p class="h-i" lang="sa-Latn">${esc(titleIast)}</p>
<p class="h-meta">${c.counts.total} mantras · ${range(c)}</p>
${ORN}
</header>`;
  if (intro.summary) {
    b += `<section class="overview" aria-labelledby="ov-h"><h2 id="ov-h" class="sr">Overview</h2><p class="ov-lead">${esc(intro.summary)}</p>
${intro.themes?.length ? `<ul class="themes" aria-label="Themes">${intro.themes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
<details class="more"><summary>About this chapter</summary><div class="more-b"><dl class="about">
<dt>Forms of the Devī</dt><dd>${esc(intro.forms)}</dd>
<dt>Significance of the events</dt><dd>${esc(intro.significance)}</dd>
<dt>Sanskrit patterns to watch</dt><dd>${esc(intro.grammar)}</dd>
<dt>The teaching, as distinct from the narrative</dt><dd>${esc(intro.teaching)}</dd>
${intro.heading_en || intro.carita ? `<dt>Carita</dt><dd>${esc(intro.carita || '')}</dd>` : ''}</dl></div></details>`;
  } else {
    b += `<section class="overview">`;
  }
  const pf = c.preface;
  const pfl = [];
  if (pf.viniyoga) pfl.push(['Viniyoga', [pf.viniyoga]]);
  if (pf.dhyana?.length) pfl.push(['Dhyāna', pf.dhyana]);
  if (pf.invocation) pfl.push(['Invocation', [pf.invocation]]);
  if (pfl.length) {
    b += `<details class="more"><summary>Recited before the chapter</summary><div class="more-b">
<p class="note">These lines belong to the recitation (the Gita Press pāṭha), not to the Mārkaṇḍeya Purāṇa text, and are kept apart from the numbered mantras.</p>
${pfl.map(([k, ls]) => `<p class="c-tag">${k}</p><p class="pre-sa" lang="sa">${ls.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p><p class="pre-i" lang="sa-Latn">${ls.map((l) => `<span class="ln">${iastLine(l)}</span>`).join('')}</p>`).join('')}</div></details>`;
  }
  b += `</section>`;
  b += `<div class="verses">${ms.map((m, i) => verseHTML(ch, m, byId.get(mid(ch, m)), ms[i - 1], ms[i + 1], i, ms.length)).join('\n')}</div>`;
  b += `<section class="colophon" aria-label="Colophon">${ORN}<p class="col-sa" lang="sa">${esc(c.colophon)}</p><p class="col-i" lang="sa-Latn">${iastLine(c.colophon)}</p></section>`;
  const cc = a?.conclusion;
  if (cc?.narrative) {
    b += `<section class="concl" aria-labelledby="concl-h"><h2 id="concl-h">Reflecting on the chapter</h2><p class="ov-lead">${esc(cc.narrative)}</p>
<h3>Verses for study and memorisation</h3><ul class="keyv">${cc.key_verses.map((k) => `<li><a href="#${idAnchor(k.id)}">${esc(k.id.replace('-', '–'))}</a><span>${esc(k.why)}</span></li>`).join('')}</ul>
<details class="more"><summary>Vocabulary, constructions and insights</summary><div class="more-b">
<h3>Principal vocabulary</h3><ul class="vocab">${cc.vocabulary.map((v) => `<li><span class="w-d" lang="sa">${esc(v.w)}</span><span class="w-i" lang="sa-Latn">${esc(iast(v.w))}</span><span class="w-en">${esc(v.en)}</span></li>`).join('')}</ul>
<h3>Important grammatical constructions</h3><ul class="plain">${cc.constructions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h3>Śākta insights</h3><ul class="plain">${cc.insights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${cc.srividya ? `<h3>Śrīvidyā connections</h3><p>${esc(cc.srividya)}</p>` : ''}</div></details></section>`;
  }
  b += reportHTML(c, a);
  b += `<nav class="pager" aria-label="Chapters">${prevC ? `<a class="pg-prev" href="${chURL(prevC.num)}"><span class="pg-k">Previous chapter</span><span class="pg-sa" lang="sa">${esc(prevC.title.dev)}</span><span class="pg-en">${prevC.num}. ${esc(prevC.title.en)}</span></a>` : `<a class="pg-prev" href="/${DIR}/"><span class="pg-k">Back to</span><span class="pg-en">All chapters</span></a>`}${nextC ? `<a class="pg-next" href="${chURL(nextC.num)}"><span class="pg-k">Next chapter</span><span class="pg-sa" lang="sa">${esc(nextC.title.dev)}</span><span class="pg-en">${nextC.num}. ${esc(nextC.title.en)}</span></a>` : `<a class="pg-next" href="/${DIR}/"><span class="pg-k">Complete</span><span class="pg-en">All chapters</span></a>`}</nav></article>`;
  const reader = `<div class="reader-bar" role="region" aria-label="Reader">
<a class="rb-back" href="/${DIR}/#chapters" aria-label="All chapters">‹ Chapters</a>
<span class="rb-title"><span class="rb-n">${ch}</span> <span lang="sa">${esc(c.title.dev)}</span></span>
<span class="rb-prog" hidden><span class="rb-cur">Verse <b data-cur>${esc(midShow(ch, ms[0]))}</b> <span class="rb-of">of ${ms.length}</span></span><span class="rb-track" aria-hidden="true"><span class="rb-fill"></span></span></span>
<span class="rb-tools" hidden>
<button type="button" class="rb-btn" data-go="prev" aria-label="Previous verse">‹</button>
<label class="sr" for="rb-jump">Go to verse</label><select id="rb-jump" class="rb-jump">${ms.map((m) => `<option value="${anchor(ch, m)}">${esc(midShow(ch, m))}</option>`).join('')}</select>
<button type="button" class="rb-btn" data-go="next" aria-label="Next verse">›</button>
<button type="button" class="rb-btn rb-aa" aria-expanded="false" aria-controls="rb-panel" aria-label="Reading settings">Aa</button>
</span>
<div class="rb-panel" id="rb-panel" hidden>
<div class="rp-row"><span class="rp-k" id="rp-size">Sanskrit size</span><span class="rp-v" role="group" aria-labelledby="rp-size"><button type="button" data-size="-1" aria-label="Smaller Sanskrit">A−</button><button type="button" data-size="0" aria-label="Default Sanskrit size">A</button><button type="button" data-size="1" aria-label="Larger Sanskrit">A+</button></span></div>
<div class="rp-row"><span class="rp-k" id="rp-script">Show the verse in</span><span class="rp-v" role="radiogroup" aria-labelledby="rp-script"><button type="button" role="radio" data-script="both" aria-checked="true">Both</button><button type="button" role="radio" data-script="dev" aria-checked="false" lang="sa">देवनागरी</button><button type="button" role="radio" data-script="iast" aria-checked="false">IAST</button></span></div>
<div class="rp-row"><span class="rp-k" id="rp-an">Grammar &amp; commentary</span><span class="rp-v" role="group" aria-labelledby="rp-an"><button type="button" data-expand="1">Expand all</button><button type="button" data-expand="0">Collapse all</button></span></div>
</div>
<p class="rb-live sr" aria-live="polite"></p>
</div>
`;
  return shell({
    title: `Devī Māhātmyam ${ch}: ${c.title.en}`,
    desc: `Chapter ${ch} of the Devī Māhātmyam (${titleIast}), ${c.counts.total} mantras: the Sanskrit, IAST, padaccheda, word-by-word meaning, sandhi, samāsa, translation and Śākta commentary for every verse.`,
    url: chURL(ch), body: b, page: 'chapter', reader,
  });
}

function reportHTML(c, a) {
  const ch = c.num;
  const cors = LOG.corrections.filter((x) => x.id.split('.')[0] === String(ch));
  const vars = LOG.variants.filter((x) => x.id.split('.')[0] === String(ch));
  const unc = (a?.mantras || []).filter((e) => e.flags?.uncertain);
  const r = a?.report || {};
  const done = a ? a.mantras.length : 0;
  const st = chapterStatus(ch);
  const rows = [
    ['Chapter', `${ch} — ${esc(c.title.en)} (<span lang="sa">${esc(c.title.dev)}</span>)`],
    ['Source edition', esc(T.source.edition)],
    ['Verse range', `${range(c)} (Gita Press mantra numbers)`],
    ['Verse entries', `${c.mantras.length} entries for ${c.counts.total} mantras — uvāca ${c.counts.uvaca}, half-ślokas ${c.counts.ardha}, ślokas ${c.counts.sloka}${c.counts.tripada ? `, three-part mantras ${c.counts.tripada}` : ''}; the counts equal the chapter's colophon`],
    ['Analysed', `${done} of ${c.mantras.length} entries`],
    ['Numbering', `Gita Press counts every uvāca line and half-śloka as a mantra; the Mārkaṇḍeya Purāṇa (GRETIL, adhyāya ${80 + ch}) numbers by full ślokas and does not number uvāca lines, so its numbers differ.`],
    ['Corrections to the digital text', cors.length ? cors.map((x) => `${esc(x.id)}: <span lang="sa">${esc(x.from)}</span> → <span lang="sa">${esc(x.to)}</span>`).join('<br>') : 'None'],
    ['Variant readings (kept as printed)', vars.length ? vars.map((x) => `${esc(x.id)}: <span lang="sa">${esc(x.kept)}</span> / <span lang="sa">${esc(x.other)}</span> (${esc(x.status)})`).join('<br>') : 'None recorded'],
    ['Uncertain readings or interpretations', unc.length ? unc.map((e) => `<a href="#${idAnchor(e.id)}">${esc(e.id)}</a>`).join(', ') : 'None flagged'],
  ];
  const list = (k, label) => (r[k]?.length ? [[label, `<ul class="plain">${r[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`]] : []);
  rows.push(...list('sandhi_patterns', 'Sandhi patterns'), ...list('samasa', 'Samāsa constructions'), ...list('grammar_notes', 'Grammatical observations'), ...list('themes', 'Philosophical themes'), ...list('uncertain', 'Open questions'));
  rows.push(['Status', esc(st.text)]);
  return `<details class="more report" id="report"><summary>Chapter report &amp; verification</summary><div class="more-b"><dl class="rep">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div></details>`;
}

/* ---------- home ---------- */
function homePage() {
  let b = `<article class="home">
<header class="hero">
<p class="invoc" lang="sa">॥ श्रीदुर्गायै नमः ॥</p>
<h1><span class="h-sa" lang="sa">श्रीदेवीमाहात्म्यम्</span><span class="h-en">Śrī Devī Māhātmyam</span></h1>
<p class="tagline">The Glory of the Goddess — the seven hundred verses of the Durgā Saptaśatī, read word by word.</p>
<p class="cta"><a class="btn" href="${chURL(1)}">Begin reading</a><a class="btn ghost" href="/${ED}/how-to-study.html">How to study</a></p>
${ORN}
</header>
<section id="chapters" class="caritas" aria-label="The thirteen chapters">`;
  for (const k of ['prathama', 'madhyama', 'uttama']) {
    const car = CARITA[k];
    const chs = T.chapters.filter((c) => c.carita === k);
    b += `<section class="carita" aria-labelledby="car-${k}">
<header class="car-h"><p class="car-form"><span lang="sa">${car.formDev}</span> · ${car.form}</p><h2 id="car-${k}"><span lang="sa">${car.dev}</span><span class="car-en">${car.name} · ${car.en}</span></h2><p class="car-note">${car.chapters} · presided over by ${car.form} in the recitation tradition</p></header>
<ol class="ch-list">${chs.map((c) => `<li><a class="ch-card" href="${chURL(c.num)}"><span class="ch-no" aria-hidden="true"><span lang="sa">${devNum(c.num)}</span></span><span class="ch-txt"><span class="ch-sa" lang="sa">${esc(c.title.dev)}</span><span class="ch-en"><span class="sr">Chapter ${c.num}: </span>${esc(c.title.en)}</span></span><span class="ch-go" aria-hidden="true">›</span></a></li>`).join('')}</ol>
</section>`;
  }
  b += `</section>
<section class="home-foot">${ORN}<p>Each verse is given in Devanagari and IAST, with its words separated and translated one by one, its grammar explained, and a labelled commentary. <a href="/${ED}/how-to-study.html">How to study with this edition</a> · <a href="/${ED}/notes.html">Sources &amp; verification</a></p></section>
</article>`;
  return shell({
    title: 'Śrī Devī Māhātmyam — Study Edition',
    desc: 'The Devī Māhātmyam (Durgā Saptaśatī): 13 chapters and 700 mantras with Sanskrit, IAST, padaccheda, word-by-word meaning, grammar, translation and Śākta commentary for every verse.',
    url: `/${DIR}/`, body: b, page: 'home',
  });
}

/* ---------- how to study ---------- */
function studyPage() {
  const ex = T.chapters[0].mantras.find((m) => m.n === 2);
  const exE = AN.get(1)?.mantras.find((e) => e.id === '1.2');
  const b = `<article class="prose-page">
<header class="ch-hero"><p class="kicker">Study edition</p><h1><span class="h-en">How to Study</span></h1>${ORN}</header>
<section class="prose">
<p class="ov-lead">Every verse of the Devī Māhātmyam is laid out the same way, from the words you recite to the grammar that explains them. Read as much or as little as you need: the verse, its words and its meaning are always in view, and the deeper analysis opens when you want it.</p>
<h2>The order of each verse</h2>
<ol class="steps">
<li><b>The Sanskrit</b> in large Devanagari, exactly as it is recited, with its Gita Press mantra number (<span lang="sa">॥२॥</span>). Bījas that belong to the recitation, not to the verse, are shown faintly.</li>
<li><b>The transliteration</b> (IAST) directly beneath it, line for line. It is generated from the Devanagari, so the two always agree.</li>
<li><b>Padaccheda</b> — the verse again with every word separated, as in <span lang="sa">नमः · अस्तु</span> for <span lang="sa">नमोऽस्तु</span>. Compounds stay whole here; they are opened in the samāsa section.</li>
<li><b>Word by word</b> — each separated word with its meaning in this verse and its grammar (case, number and gender; root, tense and person).</li>
<li><b>Translation</b> — a faithful translation that follows the Sanskrit, and a rendering in readable English.</li>
<li><b>Analysis</b>, in sections you can open: sandhi and sandhi-viccheda with Pāṇini's rules; samāsa and samāsa-vigraha; morphology and the anvaya (prose order); the Śākta commentary; and, where a real connection exists, comparative Śrīvidyā notes.</li>
</ol>
${ex && exE ? `<figure class="sample"><p class="v-sa" lang="sa">${ex.lines.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</p><p class="pada-sa" lang="sa">${exE.pada.map((l) => `<span class="ln">${padaWords(l)}</span>`).join('')}</p><figcaption>${esc(exE.tr)} — <a href="${chURL(1)}#m-1-2">see verse 1.2 in full</a></figcaption></figure>` : ''}
<h2>The commentary and its labels</h2>
<p>Every paragraph of commentary says what kind of statement it is, so that what the text says is never confused with what has been read into it:</p>
<ul class="labels"><li><span class="cm-k direct">${CLABEL.direct}</span> what the verse itself says in its story.</li><li><span class="cm-k traditional">${CLABEL.traditional}</span> how the tradition reads it; no commentator is named unless the attribution is secure.</li><li><span class="cm-k comparative">${CLABEL.comparative}</span> real, specific links with the Lalitā Sahasranāma (Brahmāṇḍa Purāṇa) and the Soundarya Lahari, which remain separate works.</li><li><span class="cm-k reflection">${CLABEL.reflection}</span> a present-day reading, marked as such.</li></ul>
<h2>Reading controls</h2>
<p>On each chapter page the bar at the top shows where you are (“Verse 12 of 104”), moves to the previous or next verse, and jumps to any verse by number. Its <b>Aa</b> menu sets the size of the Sanskrit, shows the verse in Devanagari, IAST or both, and opens or closes all the grammar sections at once. Every verse has a <b>Copy</b> button for its Sanskrit. Your settings are remembered on this device only.</p>
<h2>The three caritas</h2>
<p>The thirteen chapters fall into three episodes: the Prathama Carita (chapter 1, the slaying of Madhu and Kaiṭabha), the Madhyama Carita (chapters 2–4, Mahiṣāsura) and the Uttama Carita (chapters 5–13, Śumbha and Niśumbha). In the recitation tradition they are presided over by Mahākālī, Mahālakṣmī and Mahāsarasvatī; that assignment comes from the liturgy (the Gita Press viniyoga), not from the Purāṇa itself.</p>
<h2>Text and verification</h2>
<p>The Sanskrit is the Gita Press <i>Śrīdurgāsaptaśatī</i>, compared letter by letter with two independent witnesses. The separated words are proven by rejoining them by the rules of sandhi, and every chapter's verse counts match its own colophon. The corrections, variant readings and the verification of each chapter are on the <a href="/${ED}/notes.html">Sources</a> page.</p>
<p class="cta"><a class="btn" href="${chURL(1)}">Begin with chapter 1</a></p>
</section></article>`;
  return shell({ title: 'How to Study — Devī Māhātmyam', desc: 'How each verse of the PaddySpeaks Devī Māhātmyam study edition is set out: Sanskrit, IAST, padaccheda, word meanings, translation and analysis.', url: `/${ED}/how-to-study.html`, body: b, page: 'study' });
}

/* ---------- sources & verification ---------- */
function notesPage() {
  let b = `<article class="prose-page">
<header class="ch-hero"><p class="kicker">Study edition</p><h1><span class="h-en">Sources, corrections &amp; verification</span></h1>${ORN}</header>
<section class="prose">
<h2>The text</h2>
<p><strong>Edition.</strong> ${esc(T.source.edition)}. Digital text: ${esc(T.source.digital)}.</p>
<p><strong>Numbering.</strong> ${esc(T.source.numbering)}</p>
<p><strong>Witnesses compared.</strong> Every chapter was aligned letter by letter against two independent texts:</p><ul class="plain">${T.source.witnesses.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
<p>Where the Gita Press text differed from <em>both</em> witnesses, the difference was examined. The errors of the digital file were corrected (below); the rest are genuine readings and are kept as printed, with the other reading recorded. Nothing was added from the other recensions and nothing was silently changed.</p>
<h2>Verification by chapter</h2>
<p>Each chapter's counts of uvāca lines, half-ślokas, ślokas and three-part mantras equal the counts in its own Gita Press colophon, and every padaccheda is proven by rejoining it into the recited verse. Each chapter page ends with its full report.</p>
<div class="tw" tabindex="0" role="region" aria-label="Verification by chapter (scrolls sideways)"><table><thead><tr><th scope="col">Chapter</th><th scope="col">Mantras</th><th scope="col">Uvāca · half · śloka · three-part</th><th scope="col">Analysed</th><th scope="col">Status</th></tr></thead><tbody>
${T.chapters.map((c) => { const st = chapterStatus(c.num); const a = AN.get(c.num); return `<tr><td><a href="${chURL(c.num)}#report">${c.num}. ${esc(c.title.en)}</a></td><td>${c.counts.total} (${range(c)})</td><td>${c.counts.uvaca} · ${c.counts.ardha} · ${c.counts.sloka} · ${c.counts.tripada}</td><td>${a ? a.mantras.length : 0} / ${c.mantras.length}</td><td><span class="status ${st.cls}">${esc(st.text)}</span></td></tr>`; }).join('\n')}
</tbody></table></div>
<h2>Corrections to the digital text</h2><div class="tw" tabindex="0" role="region" aria-label="Corrections (scrolls sideways)"><table><thead><tr><th scope="col">Where</th><th scope="col">Kind</th><th scope="col">From → to</th><th scope="col">Why</th></tr></thead><tbody>
${LOG.corrections.map((x) => `<tr><td>${esc(x.id)}</td><td>${esc(x.kind)}</td><td><span lang="sa">${esc(x.from)}</span> → <span lang="sa">${esc(x.to)}</span></td><td>${esc(x.reason)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Variant readings</h2><p>The Gita Press reading is kept in every case. “Textual Verification Required” marks readings to check against the printed book.</p><div class="tw" tabindex="0" role="region" aria-label="Variant readings (scrolls sideways)"><table><thead><tr><th scope="col">Mantra</th><th scope="col">Kept</th><th scope="col">Other reading</th><th scope="col">Status</th></tr></thead><tbody>
${LOG.variants.map((x) => `<tr><td><a href="${chURL(+x.id.split('.')[0])}#m-${x.id.replace('.', '-')}">${esc(x.id)}</a></td><td lang="sa">${esc(x.kept)}</td><td><span lang="sa">${esc(x.other)}</span> <span class="note">(${esc(x.witnesses)})</span>${x.note ? `<br><span class="note">${esc(x.note)}</span>` : ''}</td><td>${esc(x.status)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Recension and metre</h2><ul class="plain">${LOG.recension_notes.map((n) => `<li>${esc(n)}</li>`).join('')}${LOG.metre_notes.map((n) => `<li>${esc(n.id)}: ${esc(n.note)}</li>`).join('')}</ul>
<h2>Supplementary texts</h2><p>The Kavaca, Argalā, Kīlaka, the Rātri and Devī Sūktas and the Rahasyas that the Gita Press prints around the Saptaśatī are separate liturgical texts and are not part of this edition. Each chapter shows the viniyoga and dhyāna that the pāṭha recites before it, kept apart from the numbered mantras. The site's <a href="/durga-suktam/">Durgā Sūktam</a> is a separate Vedic hymn.</p>
<h2>How the analysis is checked</h2><p>For every mantra the separated words are rejoined by external sandhi (vowel, visarga and consonant rules, with Pāṇini's sūtras) and must spell the recited text; a vowel left unjoined must be declared and explained (a pragṛhya dual, a metrical licence). The word table must list exactly the separated words in order. Every sandhi example must occur in its verse, every compound and analysed form in its word list. Commentary is labelled by its authority, and no commentator or citation is invented. Doubtful readings and interpretations are flagged on the verse and listed in the chapter's report.</p>
</section></article>`;
  return shell({ title: 'Devī Māhātmyam — Sources, corrections and verification', desc: 'The source edition, witnesses, corrections, variant readings and chapter-by-chapter verification of the PaddySpeaks Devī Māhātmyam study edition.', url: `/${ED}/notes.html`, body: b, page: 'notes' });
}

/* ---------- write / check ---------- */
const OUT = new Map();
OUT.set(`${DIR}/index.html`, homePage());
OUT.set(`${ED}/how-to-study.html`, studyPage());
OUT.set(`${ED}/notes.html`, notesPage());
for (const c of T.chapters) OUT.set(`${ED}/${chFile(c.num)}`, chapterPage(c));
let stale = 0;
for (const [p, html] of OUT) {
  const cur = fs.existsSync(A(p)) ? fs.readFileSync(A(p), 'utf8') : null;
  if (cur === html) continue;
  if (CHECK) { console.error(`stale: ${p}`); stale++; continue; }
  fs.writeFileSync(A(p), html);
  console.log(`wrote ${p}`);
}
if (CHECK) {
  if (stale) { console.error(`${stale} generated file(s) are stale — run node scripts/devi_mahatmyam/build.mjs`); process.exit(1); }
  console.log(`ok — ${OUT.size} pages current`);
}
