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
 *                                                   edition/chapter-NN.html, edition/notes.html
 *   node scripts/devi_mahatmyam/build.mjs --check   CI: fail if any of those is stale
 *
 * Never edit the HTML by hand. IAST is never typed: every transliteration on
 * the pages is dev2iast() of the Devanagari shown beside it. Run
 * `python3 scripts/devi_mahatmyam/check.py` too — it proves the text and the
 * padaccheda (docs/DEVI-MAHATMYAM-EDITION.md).
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
const CSS_HASH = crypto.createHash('sha256').update(fs.readFileSync(A(`${ED}/edition.css`))).digest('hex').slice(0, 10);

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIGITS = '०१२३४५६७८९';
const devNum = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
const iast = (dev) => dev2iast(dev).replace(/·/g, '');
const pad2 = (n) => String(n).padStart(2, '0');
const chFile = (ch) => `chapter-${pad2(ch)}.html`;
const mid = (ch, m) => `${ch}.${m.n}${m.to ? `-${m.to}` : ''}`;
const anchor = (ch, m) => `m-${ch}-${m.n}`;
const recited = (m) => m.lines.join(' ').replace(/-\s+/g, '');
const KIND = { uvaca: 'Uvāca · speaker', ardha: 'Half-śloka', sloka: 'Śloka', tripada: 'Three-part mantra' };
const CARITA = {
  prathama: { name: 'Prathama Carita', dev: 'प्रथमचरितम्', form: 'Mahākālī', chapters: '1' },
  madhyama: { name: 'Madhyama Carita', dev: 'मध्यमचरितम्', form: 'Mahālakṣmī', chapters: '2–4' },
  uttama: { name: 'Uttama Carita', dev: 'उत्तमचरितम्', form: 'Mahāsarasvatī', chapters: '5–13' },
};
const CLABEL = {
  direct: 'Direct textual meaning',
  traditional: 'Traditional interpretation',
  comparative: 'Comparative Śākta / Śrīvidyā',
  reflection: 'Modern reflection',
};
const LETTERS = '123456789';
const range = (c) => `${c.num}.1–${c.num}.${c.mantras.at(-1).to || c.mantras.at(-1).n}`;
const fmtNum = (n) => n.toLocaleString('en-US');

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
  if (counts.every((c) => c >= 15 && c <= 17)) return 'anuṣṭubh (śloka)';
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
function shell({ title, desc, url, body, top }) {
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/${ED}/edition.css?v=${CSS_HASH}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="ps:continue" content="sacred" data-title="${esc(title)}">
</head>
<body>
<a class="skip-link" href="#main">Skip to the text</a>
<header class="topbar"><a href="/${DIR}/"><span lang="sa">देवीमाहात्म्यम्</span> · Study Edition</a><nav class="nav" aria-label="Edition">${top || ''}<a href="/${ED}/notes.html">Source &amp; notes</a><a href="/sacred/">Sacred texts</a></nav></header>
<main id="main">
${body}
</main>
<footer class="foot"><p>Śrī Devī Māhātmyam — Study Edition · Sanskrit: Gita Press Durgāsaptaśatī · <a href="/${ED}/notes.html">Source, corrections and variants</a> · <a href="${SITE}/">PaddySpeaks</a></p></footer>
<script defer src="/lib/ps.js"></script>
<script defer src="/lib/ps-sources.js" data-provenance="devi-mahatmyam"></script>
<script defer src="/lib/ps-platform.js"></script>
</body>
</html>
`;
}

/* ---------- status of a chapter ---------- */
function chapterStatus(ch) {
  const a = AN.get(ch);
  const c = T.chapters[ch - 1];
  if (!a) return { cls: 'pend', text: 'Text only — analysis in preparation' };
  if (a.mantras.length < c.mantras.length) return { cls: 'pend', text: `Analysis ${a.mantras.length} of ${c.mantras.length}` };
  const s = a.report?.status || 'Complete';
  return { cls: s === 'Complete' ? 'ok' : s.startsWith('Complete') ? 'var' : 'ver', text: s };
}

/* ---------- one mantra ---------- */
function origHTML(m) {
  const last = m.to || m.n;
  const lines = m.lines.map((l, i) => {
    let t = esc(l);
    if (i === m.lines.length - 1) t = t.replace(/॥\s*$/, '') + ` <span class="mn">॥ ${devNum(last)} ॥</span>`;
    return t;
  });
  const bo = m.bija_open ? `<span class="bija" title="bīja of the recitation">${esc(m.bija_open)}</span> ` : '';
  const bc = m.bija_close ? ` <span class="bija" title="bīja of the recitation">${esc(m.bija_close)}</span>` : '';
  return `<div class="orig"><p class="dev" lang="sa">${bo}${lines.join('<br>')}${bc}</p></div>`;
}
const BAR = ' <span class="bar" aria-hidden="true">|</span> ';
const padaLine = (ws) => ws.map((w) => `<span class="w">${esc(w)}</span>`).join(BAR);
const padaLineI = (ws) => ws.map((w) => `<span class="w">${esc(iast(w))}</span>`).join(BAR);
const iastLine = (l) => esc(iast(l).replace(/\s*(\|\|?)\s*/g, ' $1 ').trim());
const both = (dev) => `<span lang="sa">${esc(dev)}</span><span class="il" lang="sa-Latn">${esc(iast(dev))}</span>`;

function mantraHTML(ch, m, e) {
  const id = mid(ch, m);
  const met = metre(m);
  let h = `<section class="mantra" id="${anchor(ch, m)}" aria-labelledby="${anchor(ch, m)}-h">
<div class="mh"><a class="id" id="${anchor(ch, m)}-h" href="#${anchor(ch, m)}">${id.replace('-', '–')}</a><span class="kind">${KIND[m.kind]}</span>${met ? `<span class="metre">${esc(met)}</span>` : ''}</div>
<div class="sec"><p class="lbl"><span class="n">1</span>Original śloka</p>${origHTML(m)}</div>`;
  const recIast = m.lines.map(iastLine).join('<br>');
  if (!e) {
    h += `<div class="sec"><p class="lbl"><span class="n">3</span>IAST</p><p class="iast" lang="sa-Latn">${recIast}</p></div>
<p class="pending">Padaccheda, word-by-word meaning, grammar, translation and commentary for this mantra are in preparation.</p></section>`;
    return h;
  }
  h += `<div class="sec"><p class="lbl"><span class="n">2</span>Padaccheda — the words separated</p><p class="pada" lang="sa">${e.pada.map((l) => `<span class="ln">${padaLine(l)}</span>`).join('')}</p></div>`;
  h += `<div class="sec"><p class="lbl"><span class="n">3</span>IAST</p>
<p class="iast" lang="sa-Latn"><span class="k">As recited</span>${recIast}</p>
<p class="iast" lang="sa-Latn"><span class="k">Separated</span>${e.pada.map((l) => padaLineI(l)).join('<br>')}</p></div>`;
  h += `<div class="sec"><p class="lbl"><span class="n">4</span>Word by word</p><div class="tw"><table class="wt">
<thead><tr><th scope="col">Sanskrit</th><th scope="col">IAST</th><th scope="col">Meaning</th><th scope="col">Grammar</th></tr></thead><tbody>
${e.words.map((w) => `<tr><td class="sa" lang="sa">${esc(w.w)}</td><td class="il" lang="sa-Latn">${esc(iast(w.w))}</td><td class="en">${esc(w.en)}</td><td class="g">${esc(w.g)}</td></tr>`).join('\n')}
</tbody></table></div></div>`;
  h += `<div class="sec"><p class="lbl"><span class="n">5</span>Vyākaraṇa</p>`;
  if (e.sandhi?.length) {
    h += `<p class="sub">A. Sandhi and sandhi-viccheda</p><ul class="cards">${e.sandhi.map((s) => `<li><span class="sa" lang="sa">${esc(s.joined)}</span> <span class="il" lang="sa-Latn">${esc(iast(s.joined))}</span> → <span class="sa" lang="sa">${esc(s.split)}</span><br><span class="tag">${esc(s.type)} · ${esc(s.rule)}</span><br>${esc(s.note)}</li>`).join('')}</ul>`;
  } else {
    h += `<p class="sub">A. Sandhi</p><p class="note">No sandhi joins the words of this mantra.</p>`;
  }
  if (e.samasa?.length) {
    h += `<p class="sub">B. Samāsa and samāsa-vigraha</p><ul class="cards">${e.samasa.map((s) => `<li><span class="sa" lang="sa">${esc(s.c)}</span> <span class="il" lang="sa-Latn">${esc(iast(s.c))}</span> — <span class="tag">${esc(s.type)}</span><br>Members: <span lang="sa">${esc(s.members)}</span> · Vigraha: <span class="sa" lang="sa">${esc(s.vigraha)}</span> <span class="il" lang="sa-Latn">${esc(iast(s.vigraha))}</span><br>Literally “${esc(s.literal)}”; in the verse: ${esc(s.sense)}${s.alt ? `<br><span class="tag">Alternative:</span> ${esc(s.alt)}` : ''}</li>`).join('')}</ul>`;
  }
  if (e.morph?.length) {
    h += `<p class="sub">C. Morphology</p><ul class="cards">${e.morph.map((f) => `<li><span class="sa" lang="sa">${esc(f.form)}</span> <span class="il" lang="sa-Latn">${esc(iast(f.form))}</span> — ${esc(f.note)}</li>`).join('')}</ul>`;
  }
  h += `<p class="sub">D. Anvaya — prose order</p><div class="anvaya"><p class="dev" lang="sa">${esc(e.anvaya)}</p><p class="iast" lang="sa-Latn">${esc(iast(e.anvaya))}</p>${e.anvaya_en ? `<p>${esc(e.anvaya_en)}</p>` : ''}</div>`;
  if (e.sandhi_exceptions?.length) {
    h += `<p class="note">Left unjoined: ${e.sandhi_exceptions.map((x) => `<span lang="sa">${esc(x.at)}</span> — ${esc(x.reason)}`).join('; ')}</p>`;
  }
  h += `</div>`;
  h += `<div class="sec tr"><p class="lbl"><span class="n">6</span>Translation</p><p><span class="k">Literal</span>${esc(e.lit)}</p><p class="readable"><span class="k">Readable</span>${esc(e.tr)}</p>${e.tr_note ? `<p class="note">${esc(e.tr_note)}</p>` : ''}</div>`;
  h += `<div class="sec comm"><p class="lbl"><span class="n">7</span>Commentary</p>${e.comm.map((c) => `<p><span class="cl ${c.k}">${CLABEL[c.k]}</span>${esc(c.t)}</p>`).join('')}</div>`;
  if (e.flags?.uncertain) h += `<p class="flag"><b>Textual Verification Required / uncertain:</b> ${esc(e.flags.uncertain)}</p>`;
  return h + `</section>`;
}

/* ---------- chapter page ---------- */
function chapterPage(c) {
  const ch = c.num;
  const a = AN.get(ch);
  const byId = new Map((a?.mantras || []).map((e) => [e.id, e]));
  const car = CARITA[c.carita];
  const st = chapterStatus(ch);
  const titleIast = iast(c.title.dev);
  const prev = ch > 1 ? T.chapters[ch - 2] : null;
  const next = ch < 13 ? T.chapters[ch] : null;
  let b = `<article class="edition">
<header class="ch-head"><p class="k">${car.name} · Chapter ${ch} of 13 · ${c.counts.total} mantras (${range(c)})</p>
<h1><span lang="sa">${esc(c.title.dev)}</span></h1>
<p class="iast" lang="sa-Latn">${esc(titleIast)}</p>
<p>${esc(c.title.en)} · <span class="status ${st.cls}">${esc(st.text)}</span></p></header>`;
  const intro = a?.intro;
  if (intro?.summary) {
    b += `<section class="intro" aria-labelledby="intro-h"><h2 id="intro-h">Introduction</h2><dl>
<dt>Summary</dt><dd>${esc(intro.summary)}</dd>
<dt>Forms of the Devī</dt><dd>${esc(intro.forms)}</dd>
<dt>Significance of the events</dt><dd>${esc(intro.significance)}</dd>
<dt>Sanskrit patterns to watch</dt><dd>${esc(intro.grammar)}</dd>
<dt>The teaching (as distinct from the narrative)</dt><dd>${esc(intro.teaching)}</dd></dl>
${intro.themes?.length ? `<p class="sub">Themes</p><ul class="themes">${intro.themes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  const pf = c.preface;
  const pfl = [];
  if (pf.viniyoga) pfl.push(['Viniyoga', [pf.viniyoga]]);
  if (pf.dhyana?.length) pfl.push(['Dhyāna', pf.dhyana]);
  if (pf.invocation) pfl.push(['Invocation', [pf.invocation]]);
  if (pfl.length) {
    b += `<details class="preface"><summary>Recited before the chapter (liturgical, from the Gita Press pāṭha)</summary>
<p class="note">These lines belong to the recitation, not to the Mārkaṇḍeya Purāṇa text, and are kept apart from the numbered mantras. They are given here in Sanskrit and IAST only.</p>
${pfl.map(([k, ls]) => `<p class="sub">${k}</p><p class="dev" lang="sa">${ls.map(esc).join('<br>')}</p><p class="iast" lang="sa-Latn">${ls.map((l) => esc(iast(l))).join('<br>')}</p>`).join('')}</details>`;
  }
  b += `<nav aria-label="Mantras of chapter ${ch}"><ul class="jump">${c.mantras.map((m) => `<li><a href="#${anchor(ch, m)}">${m.n}${m.to ? `–${m.to}` : ''}</a></li>`).join('')}</ul></nav>`;
  b += `<section aria-label="The mantras">${c.mantras.map((m) => mantraHTML(ch, m, byId.get(mid(ch, m)))).join('\n')}</section>`;
  b += `<section class="prose" aria-labelledby="col-h"><h2 id="col-h">Colophon</h2><p class="dev" lang="sa" style="font-size:1.25rem">${esc(c.colophon)}</p><p class="iast" lang="sa-Latn">${esc(iast(c.colophon))}</p></section>`;
  const cc = a?.conclusion;
  if (cc?.narrative) {
    b += `<section class="concl" aria-labelledby="concl-h"><h2 id="concl-h">Chapter conclusion</h2>
<p class="sub">Narrative summary</p><p>${esc(cc.narrative)}</p>
<p class="sub">Principal vocabulary</p><div class="tw"><table><thead><tr><th scope="col">Sanskrit</th><th scope="col">IAST</th><th scope="col">Meaning</th></tr></thead><tbody>${cc.vocabulary.map((v) => `<tr><td class="sa" lang="sa">${esc(v.w)}</td><td class="il" lang="sa-Latn">${esc(iast(v.w))}</td><td>${esc(v.en)}</td></tr>`).join('')}</tbody></table></div>
<p class="sub">Important grammatical constructions</p><ul>${cc.constructions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p class="sub">Śākta insights</p><ul>${cc.insights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${cc.srividya ? `<p class="sub">Śrīvidyā connections</p><p>${esc(cc.srividya)}</p>` : ''}
<p class="sub">Verses for study and memorisation</p><ul>${cc.key_verses.map((k) => `<li><a href="#m-${k.id.replace('.', '-').replace(/-(\d+)-\d+$/, '-$1')}">${esc(k.id)}</a> — ${esc(k.why)}</li>`).join('')}</ul></section>`;
  }
  b += reportHTML(c, a);
  b += `<nav class="pager" aria-label="Chapters">${prev ? `<a href="${chFile(prev.num)}">← ${prev.num}. ${esc(prev.title.en)}</a>` : `<a href="/${DIR}/">← Contents</a>`}${next ? `<a href="${chFile(next.num)}">${next.num}. ${esc(next.title.en)} →</a>` : `<a href="/${DIR}/">Contents →</a>`}</nav></article>`;
  const top = `${prev ? `<a href="${chFile(prev.num)}">← Ch. ${prev.num}</a>` : ''}<a href="/${DIR}/#contents">Contents</a>${next ? `<a href="${chFile(next.num)}">Ch. ${next.num} →</a>` : ''}`;
  return shell({
    title: `Devī Māhātmyam ${ch}: ${c.title.en}`,
    desc: `Chapter ${ch} of the Devī Māhātmyam (${titleIast}), ${c.counts.total} mantras: the Sanskrit, padaccheda, IAST, word-by-word meaning, sandhi and samāsa, translation and Śākta commentary.`,
    url: `/${ED}/${chFile(ch)}`, body: b, top,
  });
}

function reportHTML(c, a) {
  const ch = c.num;
  const cors = LOG.corrections.filter((x) => x.id.split('.')[0] === String(ch));
  const vars = LOG.variants.filter((x) => x.id.split('.')[0] === String(ch));
  const unc = (a?.mantras || []).filter((e) => e.flags?.uncertain);
  const r = a?.report || {};
  const done = a ? a.mantras.length : 0;
  const rows = [
    ['Chapter', `${ch} — ${esc(c.title.en)} (<span lang="sa">${esc(c.title.dev)}</span>)`],
    ['Source edition', esc(T.source.edition)],
    ['Verse range', `${range(c)} (Gita Press mantra numbers)`],
    ['Verse entries', `${c.mantras.length} entries for ${c.counts.total} mantras — uvāca ${c.counts.uvaca}, half-ślokas ${c.counts.ardha}, ślokas ${c.counts.sloka}${c.counts.tripada ? `, three-part mantras ${c.counts.tripada}` : ''}; the counts equal the chapter's colophon`],
    ['Analysed', `${done} of ${c.mantras.length} entries`],
    ['Numbering', `Gita Press counts every uvāca line and half-śloka as a mantra; the Mārkaṇḍeya Purāṇa (GRETIL, adhyāya ${80 + ch}) numbers by full ślokas and does not number uvāca lines, so its numbers differ.`],
    ['Corrections to the digital text', cors.length ? cors.map((x) => `${esc(x.id)}: <span lang="sa">${esc(x.from)}</span> → <span lang="sa">${esc(x.to)}</span>`).join('<br>') : 'None'],
    ['Variant readings (kept as printed)', vars.length ? vars.map((x) => `${esc(x.id)}: <span lang="sa">${esc(x.kept)}</span> / <span lang="sa">${esc(x.other)}</span> (${esc(x.status)})`).join('<br>') : 'None recorded'],
    ['Uncertain readings or interpretations', unc.length ? unc.map((e) => `<a href="#m-${e.id.replace('.', '-').replace(/-(\d+)-\d+$/, '-$1')}">${esc(e.id)}</a>`).join(', ') : 'None flagged'],
  ];
  const list = (k, label) => (r[k]?.length ? [[label, `<ul>${r[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`]] : []);
  rows.push(...list('sandhi_patterns', 'Sandhi patterns'), ...list('samasa', 'Samāsa constructions'), ...list('grammar_notes', 'Grammatical observations'), ...list('themes', 'Philosophical themes'), ...list('uncertain', 'Open questions'));
  rows.push(['Status', `<span class="status ${chapterStatus(ch).cls}">${esc(chapterStatus(ch).text)}</span>`]);
  return `<section class="report" aria-labelledby="rep-h"><h2 id="rep-h">Chapter completion report</h2><div class="tw"><table><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/* ---------- contents page ---------- */
function indexPage() {
  const analysed = [...AN.values()].reduce((n, a) => n + a.mantras.length, 0);
  const entries = T.chapters.reduce((n, c) => n + c.mantras.length, 0);
  let b = `<article class="edition">
<header class="title-page"><p class="orn" lang="sa">॥ श्रीदुर्गायै नमः ॥</p>
<h1><span class="tdev" lang="sa">श्रीदेवीमाहात्म्यम्</span><span class="tlat">Śrī Devī Māhātmyam</span></h1>
<p class="sub">Durgā Saptaśatī · Caṇḍī Pāṭha — the seven hundred mantras of the Mārkaṇḍeya Purāṇa, every verse in Sanskrit with its words separated, transliterated, translated word by word, analysed and explained.</p>
<p class="src">Sanskrit: ${esc(T.source.edition)}</p></header>
<ul class="facts"><li><b>13</b>chapters</li><li><b>700</b>mantras</li><li><b>${fmtNum(entries)}</b>verse entries</li><li><b>${fmtNum(analysed)}</b>entries analysed</li></ul>
<section class="prose" aria-labelledby="how-h"><h2 id="how-h">How to read this edition</h2>
<p>Every verse is set out in the same seven parts:</p>
<ol>
<li><strong>The original śloka</strong> in Devanagari, exactly as recited, with its Gita Press mantra number.</li>
<li><strong>Padaccheda</strong> — the verse again with every word separated (<span lang="sa">नमः | अस्तु</span> for <span lang="sa">नमोऽस्तु</span>). Compounds stay whole here; they are taken apart in part 5.</li>
<li><strong>IAST</strong> — the recited line, and the separated words.</li>
<li><strong>Word by word</strong> — each separated word with its meaning in the verse and its grammar.</li>
<li><strong>Vyākaraṇa</strong> — the sandhi of the verse with Pāṇini's rule, its compounds with their vigraha, notable forms, and the anvaya (prose order).</li>
<li><strong>Translation</strong> — a literal one that follows the grammar, and a readable one.</li>
<li><strong>Commentary</strong>, every paragraph labelled: <span class="cl direct" style="color:#fff">Direct textual meaning</span> <span class="cl traditional" style="color:#fff">Traditional interpretation</span> <span class="cl comparative" style="color:#fff">Comparative Śākta / Śrīvidyā</span> <span class="cl reflection" style="color:#fff">Modern reflection</span>.</li>
</ol>
<p><strong>Proven, not trusted.</strong> The separated words are not just typed: the build rejoins them by the rules of sandhi and fails unless they spell the recited verse exactly. The transliteration is generated from the Devanagari, so the two cannot differ. Each chapter's counts of uvāca lines, half-ślokas and ślokas match its own colophon. Where the digital text was wrong it was corrected and logged; where other witnesses read differently, the Gita Press reading is kept and the difference recorded (<a href="/${ED}/notes.html">Source &amp; notes</a>).</p>
</section>
<section id="contents" aria-labelledby="contents-h"><h2 id="contents-h">Contents</h2>`;
  for (const k of ['prathama', 'madhyama', 'uttama']) {
    const car = CARITA[k];
    const chs = T.chapters.filter((c) => c.carita === k);
    b += `<div class="carita"><h3>${car.name} <span class="hdev" lang="sa">${car.dev}</span></h3><p class="cnote">Chapter${chs.length > 1 ? 's' : ''} ${car.chapters}. In the recitation tradition its presiding form is ${car.form} (the viniyoga of the Gita Press pāṭha).</p><ol class="chlist">${chs.map((c) => {
      const st = chapterStatus(c.num);
      return `<li><span class="num">${c.num}</span><span class="t"><a href="/${ED}/${chFile(c.num)}">${esc(c.title.en)}</a><span class="d" lang="sa">${esc(c.title.dev)}</span></span><span class="meta">${c.counts.total} mantras · <span class="status ${st.cls}">${esc(st.text)}</span></span></li>`;
    }).join('')}</ol></div>`;
  }
  b += `</section></article>`;
  return shell({
    title: 'Śrī Devī Māhātmyam — Study Edition',
    desc: 'The Devī Māhātmyam (Durgā Saptaśatī) in 13 chapters and 700 mantras: Sanskrit, padaccheda, IAST, word-by-word meaning, sandhi, samāsa, translation and Śākta commentary for every verse.',
    url: `/${DIR}/`, body: b, top: '',
  });
}

/* ---------- notes page ---------- */
function notesPage() {
  let b = `<article class="edition prose"><header class="ch-head"><p class="k">Study edition</p><h1>Source, corrections and variants</h1></header>
<h2>The text</h2>
<p><strong>Edition.</strong> ${esc(T.source.edition)}. Digital text: ${esc(T.source.digital)}.</p>
<p><strong>Numbering.</strong> ${esc(T.source.numbering)}</p>
<p><strong>Witnesses compared.</strong> Every chapter was aligned letter by letter against two independent texts:</p><ul>${T.source.witnesses.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
<p>Where the Gita Press text differed from <em>both</em> witnesses, the difference was examined. Four were errors of the digital file and were corrected (below); the rest are genuine readings and are kept as printed, with the other reading recorded. Nothing was added from the other recensions and nothing was silently changed.</p>
<h2>Corrections to the digital text</h2><div class="tw"><table><thead><tr><th scope="col">Where</th><th scope="col">Kind</th><th scope="col">From → to</th><th scope="col">Why</th></tr></thead><tbody>
${LOG.corrections.map((x) => `<tr><td>${esc(x.id)}</td><td>${esc(x.kind)}</td><td><span lang="sa">${esc(x.from)}</span> → <span lang="sa">${esc(x.to)}</span></td><td>${esc(x.reason)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Variant readings</h2><p>The Gita Press reading is kept in every case. “Textual Verification Required” marks readings to check against the printed book.</p><div class="tw"><table><thead><tr><th scope="col">Mantra</th><th scope="col">Kept</th><th scope="col">Other reading</th><th scope="col">Status</th></tr></thead><tbody>
${LOG.variants.map((x) => `<tr><td><a href="/${ED}/${chFile(+x.id.split('.')[0])}#m-${x.id.replace('.', '-')}">${esc(x.id)}</a></td><td lang="sa">${esc(x.kept)}</td><td><span lang="sa">${esc(x.other)}</span> <span class="note">(${esc(x.witnesses)})</span>${x.note ? `<br><span class="note">${esc(x.note)}</span>` : ''}</td><td>${esc(x.status)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Recension and metre</h2><ul>${LOG.recension_notes.map((n) => `<li>${esc(n)}</li>`).join('')}${LOG.metre_notes.map((n) => `<li>${esc(n.id)}: ${esc(n.note)}</li>`).join('')}</ul>
<h2>Supplementary texts</h2><p>The Kavaca, Argalā, Kīlaka, the Rātri and Devī Sūktas and the Rahasyas that the Gita Press prints around the Saptaśatī are separate liturgical texts and are not part of this edition. Each chapter shows the viniyoga and dhyāna that the pāṭha recites before it, kept apart from the numbered mantras. The site's <a href="/durga-suktam/">Durgā Sūktam</a> is a separate Vedic hymn.</p>
<h2>How the analysis is checked</h2><p>For every mantra the separated words are rejoined by external sandhi (vowel, visarga and consonant rules, with Pāṇini's sūtras) and must spell the recited text; a vowel left unjoined must be declared and explained (a pragṛhya dual, a metrical licence). The word table must list exactly the separated words in order. Every sandhi example must occur in its verse, every compound and analysed form in its word list. Commentary is labelled by its authority, and no commentator or citation is invented. Doubtful readings and interpretations are flagged on the verse and listed in the chapter's report.</p>
</article>`;
  return shell({ title: 'Devī Māhātmyam — Source, corrections and variants', desc: 'The source edition, witnesses, corrections and variant readings of the PaddySpeaks Devī Māhātmyam study edition.', url: `/${ED}/notes.html`, body: b, top: `<a href="/${DIR}/#contents">Contents</a>` });
}

/* ---------- write / check ---------- */
const OUT = new Map();
OUT.set(`${DIR}/index.html`, indexPage());
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
