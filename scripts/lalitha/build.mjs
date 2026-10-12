#!/usr/bin/env node
/**
 * Śrī Lalitā Sahasranāma — study edition build.
 *
 * ONE source, everything else generated from it:
 *   lalitha-sahasranama/edition/text.json        corrected Sanskrit: nyāsa, dhyāna, 183 ślokas,
 *                                                 1,000 names with their śloka and half-line
 *   lalitha-sahasranama/edition/analysis/NN.json per-name sandhi, samāsa, word table, meaning,
 *                                                 significance (19 batches of 10 ślokas)
 *   lalitha-sahasranama/edition/corrections.json the hand-written correction log and variants
 *
 *   node scripts/lalitha/build.mjs           write data.js, words.js, edition/index.html,
 *                                            edition/CORRECTIONS.md
 *   node scripts/lalitha/build.mjs --check   CI: fail if any of those (or the PDF) is stale
 *   EA_DEPS=/dir/with/node_modules LALITHA_FONTS=/dir/with/@fontsource-packages \
 *     node scripts/lalitha/build.mjs --pdf --docx
 *                                            also render the print PDF and the editable DOCX
 *
 * Never edit data.js, words.js or edition/index.html by hand — edit the JSON and rebuild.
 * Run `python3 scripts/lalitha/check.py` too: it proves the text (sequence, metre,
 * transliteration, name-to-śloka alignment).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { iast2dev } from './translit.mjs';
import { readerData, prelimProofs, slokaUnit, prelimUnit, lineDev, lineIast } from './book.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (p) => path.join(ROOT, p);
const DIR = 'lalitha-sahasranama';
const ED = `${DIR}/edition`;
const PDF = `${ED}/Sri-Lalitha-Sahasranama-Study-Edition.pdf`;
const DOCX = `${ED}/Sri-Lalitha-Sahasranama-Study-Edition.docx`;
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
/* LALITHA_PREVIEW=/some/dir: tolerate missing batches and write everything there
   instead of the repo (for looking at work in progress; never for committing). */
const PREVIEW = process.env.LALITHA_PREVIEW || '';

const readJSON = (p) => JSON.parse(fs.readFileSync(A(p), 'utf8'));
const T = readJSON(`${ED}/text.json`);
const LOG = readJSON(`${ED}/corrections.json`);
const batchFiles = fs.readdirSync(A(`${ED}/analysis`)).filter((f) => /^\d\d\.json$/.test(f)).sort();
const BATCHES = batchFiles.map((f) => readJSON(`${ED}/analysis/${f}`));
const problems = [];
if (BATCHES.length !== 19 && !PREVIEW) problems.push(`expected 19 analysis batches, found ${BATCHES.length}`);

const AN = new Map();          // name num -> analysis entry
const VNOTE = new Map();       // śloka num -> verse note
for (const b of BATCHES) {
  for (const e of b.names) AN.set(e.num, e);
  for (const v of b.verse_notes || []) VNOTE.set(v.verse, v);
}
if (!PREVIEW) for (const n of T.names) if (!AN.has(n.num)) problems.push(`name ${n.num} has no analysis`);
const NAMES = T.names.map((n) => ({ ...n, a: AN.get(n.num) || null }));
const byNum = new Map(NAMES.map((n) => [n.num, n]));
const PRELIM = readJSON(`${ED}/preliminaries.json`);
/* the reader's lines (canonical words spaced; names separated) for every half-śloka */
const R = readerData(T, Object.fromEntries(NAMES.map((n) => [n.num, { iast: n.a ? n.a.iast : n.iast }])), problems);
prelimProofs(T, PRELIM, problems);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const DEV_DIGITS = '०१२३४५६७८९';
const devNum = (n) => String(n).replace(/\d/g, (d) => DEV_DIGITS[d]);

/* A name's meaning as a clause for the śloka-level translation line:
   "She who is the auspicious Mother" -> "The auspicious Mother". */
function clause(m) {
  let s = String(m || '').trim().replace(/[.;]+$/, '');
  s = s.replace(/^She who is\s+/, '').replace(/^She who\s+/, '').replace(/^She whose\s+/, 'Whose ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const CLOSING_HALF = 'Thus the Vāgdevatās sang the thousand names of Śrī Lalitā Devī.';

/* ------------------------------------------------------------------ data.js */
function buildDataJs() {
  const data = {
    edition: T.edition,
    nyasa: '.. nyāsaḥ ..\n' + T.nyasa.map((l) => l.iast + ' .').join('\n'),
    nyasa_dev: T.nyasa.map((l) => l.dev),
    dhyana: T.dhyana.map((d) => ({
      sanskrit: d.lines.map((l) => l.iast).join(' |\n') + ' ||',
      devanagari: d.lines.map((l) => l.dev).join(' ।\n') + ' ॥',
      translation: d.translation,
    })),
    verses: T.verses.map((v) => ({
      num: v.num,
      text: v.halves.map((h) => h.iast).join(' .\n'),
      halves: v.halves.map((h) => h.iast),
      halves_dev: v.halves.map((h) => h.dev),
      read_dev: R[v.num].map((r) => r.canonical.map((g) => g.dev).join(' ')),
      read_iast: R[v.num].map((r) => r.canonical.map((g) => g.iast).join(' ')),
      learn: R[v.num].map((r) => r.learning.map((l) => [l.num, l.dev, l.iast, l.restored ? 1 : 0])),
      ...(PRELIM.closing && v.num === PRELIM.closing.sloka ? { closing_words: PRELIM.closing.words.map((w) => ({ dev: iast2dev(w.surface), iast: w.surface, form_dev: w.pausa.split('-').map(iast2dev).join(''), form_iast: w.pausa, meaning: w.meaning, parts: w.parts.map((x) => [iast2dev(x.iast.replace(/-/g, '')), x.iast, x.meaning]) })) } : {}),
      translations: v.halves.map((h) => (h.closing ? CLOSING_HALF : h.names.map((k) => clause(byNum.get(k).a?.meaning)).join('; '))),
    })),
    names: NAMES.map((n) => ({
      num: n.num,
      name_devanagari: n.dev,
      meaning: n.a ? n.a.meaning : '',
      name_iast: n.a ? n.a.iast : n.iast,
      verse: n.verse,
    })),
    verse_names: Object.fromEntries(T.verses.map((v) => [v.num, v.names])),
  };
  return '// Lalitha Sahasranama — GENERATED by scripts/lalitha/build.mjs from\n'
    + '// lalitha-sahasranama/edition/text.json and edition/analysis/*.json. Do not edit by hand.\n'
    + '// Text: Brahmanda Purana (Hayagriva–Agastya), Bhaskararaya\'s 1,000-name division;\n'
    + '// corrections and variants: lalitha-sahasranama/edition/CORRECTIONS.md\n'
    + '// Transliteration: IAST\n\n'
    + 'const LALITHA_DATA = ' + JSON.stringify(data, null, 1) + ';\n';
}

/* ------------------------------------------------------------------ words.js */
function buildWordsJs() {
  const M = {};
  for (const n of NAMES) if (n.a && n.a.components && n.a.components.length) M[n.num] = n.a.components.map((c) => [c.dev, c.iast, c.meaning]);
  return '// Lalitha Sahasranama — word-by-word components of every name.\n'
    + '// GENERATED by scripts/lalitha/build.mjs from lalitha-sahasranama/edition/analysis/*.json.\n'
    + '// Each row is one grammatical unit in its underlying (pre-sandhi) form: [Devanagari, IAST, meaning].\n'
    + '(function () {\n  var M = ' + JSON.stringify(M) + ';\n'
    + '  if (typeof LALITHA_DATA === "undefined") return;\n'
    + '  LALITHA_DATA.names.forEach(function (name) {\n'
    + '    var m = M[name.num];\n'
    + '    if (m) name.morphemes = m.map(function (c) { return { devanagari: c[0], transliteration: c[1], meaning: c[2] }; });\n'
    + '  });\n})();\n';
}

/* ------------------------------------------------------- the study edition */
const LABEL = { typographical: 'Typographical', orthographic: 'Orthographic', grammatical: 'Grammatical', numbering: 'Numbering', encoding: 'Encoding', variant: 'Variant adopted', structural: 'Structural', interpretive: 'Interpretive' };

function correctionTables() {
  let h = '<h3>A.1 The Sanskrit of the names</h3><table class="log log-names"><thead><tr><th>Name</th><th>Original → corrected</th><th>Kind and reason</th></tr></thead><tbody>';
  for (const c of LOG.names) h += `<tr><td><a href="#n-${c.name}">${c.name}</a></td><td><span class="nw" lang="sa">${esc(c.original_dev)}</span><br><span class="iast">${esc(c.original_iast)}</span><br>→ <span class="nw" lang="sa">${esc(c.corrected_dev)}</span><br><span class="iast">${esc(c.corrected_iast)}</span></td><td><strong>${esc(LABEL[c.kind] || c.kind)}.</strong> ${esc(c.reason)}</td></tr>`;
  h += '</tbody></table>';
  h += '<h3>A.2 Structure, numbering and śloka text</h3><table class="log"><thead><tr><th>Where</th><th>Original</th><th>Corrected</th><th>Kind</th><th>Reason</th></tr></thead><tbody>';
  for (const c of LOG.structure) h += `<tr><td>${esc(c.where)}</td><td>${esc(c.original)}</td><td>${esc(c.corrected)}</td><td>${esc(LABEL[c.kind] || c.kind)}</td><td>${esc(c.reason)}</td></tr>`;
  h += '</tbody></table>';
  const changed = NAMES.filter((n) => n.a && n.a.meaning_check && n.a.meaning_check.status === 'replaced');
  h += `<h3>A.3 English meanings rewritten (${changed.length})</h3><p>Meanings that were wrong, belonged to another name, or did not follow the grammar. Meanings that were only tidied (spelling, IAST for ITRANS) are not listed; ${NAMES.filter((n) => n.a && n.a.meaning_check && n.a.meaning_check.status === 'edited').length} were tidied and ${NAMES.filter((n) => n.a && n.a.meaning_check && n.a.meaning_check.status === 'kept').length} kept as they were.</p>`;
  h += '<table class="log"><thead><tr><th>Name</th><th>Previous meaning</th><th>Now</th><th>Reason</th></tr></thead><tbody>';
  for (const n of changed) h += `<tr><td><a href="#n-${n.num}">${n.num}</a></td><td>${esc(LOG.previous_meanings?.[n.num] || '')}</td><td>${esc(n.a.meaning)}</td><td>${esc(n.a.meaning_check.note)}</td></tr>`;
  h += '</tbody></table>';
  return h;
}

function variantsSection() {
  let h = '<table class="log"><thead><tr><th>Name</th><th>Reading adopted</th><th>Variant</th><th>Note</th></tr></thead><tbody>';
  for (const v of LOG.variants) h += `<tr><td>${v.name ? `<a href="#n-${v.name}">${v.name}</a>` : esc(v.where)}</td><td>${esc(v.adopted)}</td><td>${esc(v.variant)}</td><td>${esc(v.note)}</td></tr>`;
  h += '</tbody></table>';
  const unc = NAMES.filter((n) => n.a && n.a.uncertain);
  h += `<h3>B.2 Interpretations marked uncertain (${unc.length})</h3><p>Each is flagged at the name itself. Listed here for scholarly review.</p><ul class="unc">`;
  for (const n of unc) h += `<li><a href="#n-${n.num}">${n.num} <span class="nw" lang="sa">${esc(n.dev)}</span></a> — ${esc(n.a.uncertain)}</li>`;
  h += '</ul>';
  const tc = NAMES.filter((n) => n.a && n.a.text_concern);
  if (tc.length) {
    h += `<h3>B.3 Text questions raised during analysis (${tc.length})</h3><ul class="unc">`;
    for (const n of tc) h += `<li><a href="#n-${n.num}">${n.num} <span lang="sa">${esc(n.dev)}</span></a> — ${esc(n.a.text_concern)}</li>`;
    h += '</ul>';
  }
  return h;
}

function batchReports() {
  let h = '<table class="log"><thead><tr><th>Batch</th><th>Ślokas</th><th>Names</th><th>Report</th></tr></thead><tbody>';
  for (const b of BATCHES) {
    const vs = T.verses.slice((b.batch - 1) * 10, (b.batch - 1) * 10 + 10);
    const ns = vs.flatMap((v) => v.names);
    h += `<tr><td>${b.batch}</td><td>${vs[0].num}–${vs.at(-1).num}</td><td>${ns[0]}–${ns.at(-1)}</td><td>${esc(b.report?.summary || '')}</td></tr>`;
  }
  h += '</tbody></table>';
  return h;
}

function buildEdition() {
  const E = T.edition;
  const nUnc = NAMES.filter((n) => n.a && n.a.uncertain).length;
  let b = '';
  b += `<section class="title-page"><p class="orn" aria-hidden="true">॥ श्रीः ॥</p>
<h1><span lang="sa" class="tdev">श्रीललितासहस्रनामस्तोत्रम्</span><span class="tlat">Śrī Lalitā Sahasranāma</span></h1>
<p class="sub">A chanting and learning edition: every śloka in readable Devanagari and IAST, every name separated and explained word by word</p>
<p class="src">${esc(T.source)}</p>
<p class="ver">Edition ${esc(E.version)} · ${esc(E.date)} · PaddySpeaks</p></section>`;

  b += `<nav class="toc" aria-label="Contents"><h2>Contents</h2><ol>
<li><a href="#about">How to read this book</a></li>
<li><a href="#nyasa">Nyāsa</a></li>
<li><a href="#dhyana">Dhyāna ślokas 1–4</a></li>
<li><a href="#stotra">The stotra for recitation (183 ślokas)</a></li>
<li><a href="#analysis">The 1,000 names, śloka by śloka</a><ol class="toc-b">${BATCHES.map((bt) => { const vs = T.verses.slice((bt.batch - 1) * 10, (bt.batch - 1) * 10 + 10); return `<li><a href="#s-${vs[0].num}">Ślokas ${vs[0].num}–${vs.at(-1).num} · names ${vs[0].names[0]}–${vs.at(-1).names.at(-1)}</a></li>`; }).join('')}</ol></li>
<li><a href="#closing">Colophon</a></li>
<li><a href="#log">Appendix A — Correction log</a></li>
<li><a href="#variants">Appendix B — Variants and open questions</a></li>
<li><a href="#reports">Appendix C — Batch consistency reports</a></li>
<li><a href="#namavali">Appendix D — The 1,000 names (nāmāvalī)</a></li></ol></nav>`;

  b += `<section id="about" class="prose"><h2>How to read this book</h2>
<p>Every śloka — the nyāsa, the four dhyāna ślokas and the 183 ślokas of the names — is set out the same way, top to bottom:</p>
<ol class="howto">
<li><strong>The Sanskrit</strong>, large, exactly as it is recited, with a space wherever one word or name ends and the next begins <em>without any letter changing</em>. When sandhi joins two names, the joining sound stays with the first (<span lang="sa">भद्रमूर्तिर् भक्तसौभाग्यदायिनी</span>), and an elided initial vowel is shown by the avagraha (<span lang="sa">सर्वारुणा ऽनवद्याङ्गी</span>). Four times in the hymn two names melt into one sound and cannot be parted without changing the text (<span lang="sa">साध्वी</span> = 711 sādhu + 712 ī, for example); there they stay together.</li>
<li><strong>The IAST</strong> transliteration, word for word the same.</li>
<li><strong>The names, separated</strong> — the learning view. Every name is shown on its own, numbered, in its own form, with light hyphens at the joints of a compound. A name marked <span class="deg">°</span> has a different form in the recitation because of sandhi (भद्रमूर्तिः on its own, भद्रमूर्तिर् before भक्त…). This view is for learning; the line above is the text.</li>
<li><strong>The translation</strong>, name by name, numbered.</li>
<li><strong>Word by word</strong>: every name broken into its grammatical parts, each with its English meaning. The parts are given in their underlying forms (चित् + अग्नि for चिदग्नि), so the table shows what the words are, not only how they sound.</li>
<li><strong>The names</strong>: for each name its meaning, the sandhi inside it, its compound and the traditional analysing sentence (vigraha-vākya), and a short note on its significance. Readings that are disputed are marked <span class="flag-inline">Uncertain</span> (${nUnc} of them, listed in Appendix B).</li>
</ol>
<p><strong>The text.</strong> The Lalitā Sahasranāma of the Brahmāṇḍa Purāṇa (Hayagrīva and Agastya), divided into 1,000 names as Bhāskararāya divides them: <em>tat · tvam · ayī</em> (425–427), <em>sādhu · ī</em> (711–712), <em>brahma · jananī</em> (822–823) and <em>dharā · dharasutā</em> (955–956) are his divisions. The text was corrected name by name, checked against an independent copy of the same recension, and proved against the metre (every half-śloka has its sixteen syllables). The names fill 182½ ślokas; the second half of śloka 183 closes the hymn. The nyāsa, dhyāna and colophon are not counted among the names. Every correction is in Appendix A.</p>
</section>`;

  const P = PRELIM;
  b += `<section id="nyasa" class="part"><h2>Nyāsa <span lang="sa" class="hdev">न्यासः</span></h2><p class="note">Recited before the hymn: its seers, metre, deity, seed, power, linchpin and purpose.</p>`;
  b += prelimUnit({ id: 'nyasa-text', title: 'Nyāsa', lines: P.nyasa.map((l, i) => ({ read: l.read, learn: l.learn, end: i === P.nyasa.length - 1 ? ' ॥' : ' ।', endI: i === P.nyasa.length - 1 ? ' ||' : ' |' })), translation: P.nyasa.map((l) => l.translation).join(' '), perLineWords: P.nyasa.map((l, i) => ({ head: `<span class="gn">${i + 1}</span> <span lang="sa">${lineDev(l.read)}</span>`, rows: l.words })) });
  b += '</section>';
  b += `<section id="dhyana" class="part"><h2>Dhyāna ślokas <span lang="sa" class="hdev">ध्यानम्</span></h2><p class="note">Verses of meditation on the form of the Goddess, recited before the names.</p>`;
  for (const d of P.dhyana) {
    b += prelimUnit({ id: `dhyana-${d.num}`, title: `<span class="ul">Dhyāna</span> ${d.num}`, sub: `metre: ${d.metre}`, lines: d.lines.map((l, i) => ({ read: l.read, learn: l.learn, end: i === d.lines.length - 1 ? ' ॥' : (i % 2 === 0 && d.lines.length === 4 ? '' : ' ।'), endI: i === d.lines.length - 1 ? ' ||' : (i % 2 === 0 && d.lines.length === 4 ? '' : ' |') })), translation: d.translation, words: d.words });
  }
  b += '</section>';

  b += `<section id="stotra" class="part"><h2>Śrī Lalitā Sahasranāma Stotram <span lang="sa" class="hdev">अथ श्रीललितासहस्रनामस्तोत्रम्</span></h2><p class="note">The text for recitation, words spaced as in the book. The number in the margin is the śloka; it links to the śloka's explanation.</p><div class="recite">`;
  for (const v of T.verses) {
    const rr = R[v.num];
    b += `<div class="rv" id="r-${v.num}"><span class="rn"><a href="#s-${v.num}">${v.num}</a></span><p class="dev" lang="sa">${rr.map((r, i) => r.canonical.map((g) => esc(g.dev)).join(' ') + (i === 0 ? ' ।' : ` ॥ ${devNum(v.num)} ॥`)).join('<br>')}</p><p class="ri" lang="sa-Latn">${rr.map((r) => r.canonical.map((g) => esc(g.iast)).join(' ')).join('<br>')}</p></div>`;
  }
  b += '</div></section>';

  b += '<section id="analysis" class="part"><h2>The 1,000 names, śloka by śloka</h2>';
  for (const v of (PREVIEW ? T.verses.filter((x) => x.names.every((k) => AN.has(k))) : T.verses)) b += slokaUnit(v, R, byNum, LOG, VNOTE, PRELIM.closing);
  b += '</section>';

  b += `<section id="closing" class="prose part"><h2>Colophon</h2><p class="cdev" lang="sa">${esc(T.closing[0].dev)}</p><p class="ciast" lang="sa-Latn">${esc(T.closing[0].iast)}</p><p>${esc(T.closing[0].translation)}</p></section>`;

  b += `<section id="log" class="appendix"><h2>Appendix A — Correction log</h2><p>Kinds: <em>Typographical</em> (a slip in writing), <em>Orthographic</em> (a permitted spelling made consistent), <em>Grammatical</em> (a form the grammar does not allow), <em>Numbering</em>, <em>Encoding</em> (invisible characters), <em>Structural</em> (what appears where), <em>Variant adopted</em>.</p>${correctionTables()}</section>`;
  b += `<section id="variants" class="appendix"><h2>Appendix B — Variants and open questions</h2><h3>B.1 Textual variants</h3>${variantsSection()}</section>`;
  b += `<section id="reports" class="appendix"><h2>Appendix C — Batch consistency reports</h2><p>The analysis was done in batches of ten ślokas. After each, a check proved that the batch lists exactly the names of its ślokas in order, that every IAST string is the exact transliteration of its Devanagari, and that every name has its sandhi, samāsa, word table, meaning and significance.</p>${batchReports()}</section>`;
  b += '<section id="namavali" class="appendix"><h2>Appendix D — The 1,000 names</h2><ol class="nav-list">';
  for (const n of NAMES) b += `<li value="${n.num}"><a href="#n-${n.num}"><span class="nw" lang="sa">${esc(n.dev)}</span></a> <span class="iast" lang="sa-Latn">${esc(n.a?.iast || n.iast)}</span></li>`;
  b += '</ol></section>';

  const css = fs.readFileSync(A(`${ED}/edition.css`), 'utf8');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Śrī Lalitā Sahasranāma — Study Edition | PaddySpeaks</title>
<meta name="description" content="A chanting and learning edition of the Lalitā Sahasranāma: every śloka in readable Devanagari and IAST, every one of the 1,000 names separated, translated and explained word by word.">
<link rel="canonical" href="https://paddyspeaks.com/lalitha-sahasranama/edition/">
<meta property="og:title" content="Śrī Lalitā Sahasranāma — Study Edition">
<meta property="og:type" content="book">
<meta property="og:url" content="https://paddyspeaks.com/lalitha-sahasranama/edition/">
<meta property="og:image" content="https://paddyspeaks.com/images/lalithasahasranamam.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="ps:continue" content="sacred" data-title="Lalitā Sahasranāma — Study Edition">
<style>
${css}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to the text</a>
<div class="topbar"><a href="/lalitha-sahasranama/">← Chanting guide</a><span lang="sa">श्रीललितासहस्रनाम</span><a href="${path.basename(PDF)}">PDF</a></div>
<main class="edition" id="main">
${b}
</main>
<footer class="foot"><p>Śrī Lalitā Sahasranāma — Study Edition ${esc(E.version)} · ${esc(E.date)} · <a href="https://paddyspeaks.com/">PaddySpeaks</a> · <a href="CORRECTIONS.md">Correction log (text)</a></p></footer>
<script defer src="/lib/ps.js"></script>
<script defer src="/lib/ps-sources.js" data-provenance="lalitha-sahasranama"></script>
<script defer src="/lib/ps-platform.js"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------- CORRECTIONS.md */
function buildLogMd() {
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  let m = `# Śrī Lalitā Sahasranāma — correction log\n\nGENERATED by \`scripts/lalitha/build.mjs\` from \`edition/corrections.json\` and \`edition/analysis/*.json\`. Edition ${T.edition.version}, ${T.edition.date}. The study edition (\`edition/index.html\`, and its PDF) carries the same log as Appendix A–C.\n\n`;
  m += '## 1. The Sanskrit of the names\n\n| Name | Original | Corrected | Kind | Reason |\n|---|---|---|---|---|\n';
  for (const c of LOG.names) m += `| ${c.name} | ${cell(c.original_dev)} (${cell(c.original_iast)}) | ${cell(c.corrected_dev)} (${cell(c.corrected_iast)}) | ${LABEL[c.kind] || c.kind} | ${cell(c.reason)} |\n`;
  m += '\n## 2. Structure, numbering and śloka text\n\n| Where | Original | Corrected | Kind | Reason |\n|---|---|---|---|---|\n';
  for (const c of LOG.structure) m += `| ${cell(c.where)} | ${cell(c.original)} | ${cell(c.corrected)} | ${LABEL[c.kind] || c.kind} | ${cell(c.reason)} |\n`;
  const changed = NAMES.filter((n) => n.a && n.a.meaning_check && n.a.meaning_check.status === 'replaced');
  m += `\n## 3. English meanings rewritten (${changed.length})\n\n| Name | Previous | Now | Reason |\n|---|---|---|---|\n`;
  for (const n of changed) m += `| ${n.num} ${cell(n.dev)} | ${cell(LOG.previous_meanings?.[n.num])} | ${cell(n.a.meaning)} | ${cell(n.a.meaning_check.note)} |\n`;
  const splits = NAMES.filter((n) => n.a && n.a.previous_split_issues);
  m += `\n## 4. Word-by-word tables corrected (${splits.length} names)\n\nThe old tables were generated from a dictionary. Every name now has a table written from its grammar; these are the cases where the old table was wrong, not merely thin.\n\n| Name | What was wrong |\n|---|---|\n`;
  for (const n of splits) m += `| ${n.num} ${cell(n.dev)} | ${cell(n.a.previous_split_issues)} |\n`;
  m += '\n## 5. Textual variants\n\n| Name | Adopted | Variant | Note |\n|---|---|---|---|\n';
  for (const v of LOG.variants) m += `| ${v.name || cell(v.where)} | ${cell(v.adopted)} | ${cell(v.variant)} | ${cell(v.note)} |\n`;
  const nv = NAMES.filter((n) => n.a && n.a.variants && !LOG.variants.some((v) => v.name === n.num));
  if (nv.length) {
    m += '\nOther variants noted at the names:\n\n';
    for (const n of nv) m += `- **${n.num} ${n.dev}** — ${n.a.variants}\n`;
  }
  const unc = NAMES.filter((n) => n.a && n.a.uncertain);
  m += `\n## 6. Unresolved — marked uncertain for scholarly review (${unc.length})\n\n`;
  for (const n of unc) m += `- **${n.num} ${n.dev}** (${n.a.iast}) — ${n.a.uncertain}\n`;
  const tc = NAMES.filter((n) => n.a && n.a.text_concern);
  if (tc.length) {
    m += `\n## 7. Text questions raised during analysis (${tc.length})\n\n`;
    for (const n of tc) m += `- **${n.num} ${n.dev}** — ${n.a.text_concern}\n`;
  }
  m += '\n## 8. Batch consistency reports\n\n';
  for (const b of BATCHES) m += `- **Batch ${b.batch}** (ślokas ${b.slokas?.join('–')}): ${b.report?.summary || ''}\n`;
  return m;
}

/* ------------------------------------------------------------------ write */
const outputs = [
  [`${DIR}/data.js`, buildDataJs()],
  [`${DIR}/words.js`, buildWordsJs()],
  [`${ED}/index.html`, buildEdition()],
  [`${ED}/CORRECTIONS.md`, buildLogMd()],
];
const pdfMetaPath = `${ED}/pdf.json`;
const pdfMeta = fs.existsSync(A(pdfMetaPath)) ? readJSON(pdfMetaPath) : null;
const editionHash = hash(outputs[2][1]);

if (CHECK) {
  for (const [f, content] of outputs) {
    const cur = fs.existsSync(A(f)) ? fs.readFileSync(A(f), 'utf8') : '';
    if (cur !== content) problems.push(`${f} is stale — run: node scripts/lalitha/build.mjs`);
  }
  if (!pdfMeta || pdfMeta.source !== editionHash) problems.push(`${PDF} is older than the edition — run the build with --pdf (see header)`);
  if (!pdfMeta || pdfMeta.docx_source !== editionHash) problems.push(`${DOCX} is older than the edition — run the build with --docx (see header)`);
} else if (PREVIEW) {
  /* mirror the repo layout under PREVIEW so the page still finds /lib and its PDF link */
  for (const [f, content] of outputs) { fs.mkdirSync(path.dirname(path.join(PREVIEW, f)), { recursive: true }); fs.writeFileSync(path.join(PREVIEW, f), content); }
  if (args.has('--pdf')) {
    const { renderPdf } = await import('./pdf.mjs');
    const pages = await renderPdf(PREVIEW, path.join(PREVIEW, PDF), `/${ED}/index.html`);
    console.log(`  preview PDF: ${pages} pages`);
  }
  if (args.has('--docx')) {
    const { renderDocx } = await import('./docx.mjs');
    await renderDocx({ T, NAMES, LOG, BATCHES, PRELIM, R, out: path.join(PREVIEW, DOCX) });
  }
  console.log('  preview written to', PREVIEW);
} else {
  if (problems.length) { console.error(problems.map((p) => '✗ ' + p).join('\n')); process.exit(1); }
  for (const [f, content] of outputs) {
    const cur = fs.existsSync(A(f)) ? fs.readFileSync(A(f), 'utf8') : '';
    if (cur !== content) { fs.writeFileSync(A(f), content); console.log('  wrote', f); }
  }
  const meta = pdfMeta || {};
  if (args.has('--pdf')) {
    const { renderPdf } = await import('./pdf.mjs');
    /* Chromium occasionally ends a long print job early (2026-10-12: 978 of 1,010
       pages, mid-appendix, with a footer that counted the short file). The book's
       last page must hold the last nāmāvalī entry; re-render, then refuse to ship. */
    const lastPageOk = () => {
      const r = spawnSync('pdftotext', ['-f', String(meta.pages), '-l', String(meta.pages), A(PDF), '-'], { encoding: 'utf8' });
      if (r.error) { console.warn('  (pdftotext not available — cannot prove the PDF is complete)'); return true; }
      return r.stdout.includes(NAMES.at(-1).dev);
    };
    for (let attempt = 1; ; attempt++) {
      meta.pages = await renderPdf(ROOT, A(PDF), `/${ED}/index.html`);
      if (lastPageOk()) break;
      if (attempt === 3) { console.error(`✗ ${PDF} ends early (${meta.pages} pages) three times — not written to pdf.json`); process.exit(1); }
      console.warn(`  PDF ended early at ${meta.pages} pages — rendering again`);
    }
    meta.source = editionHash;
    console.log(`  rendered ${PDF}: ${meta.pages} pages`);
  }
  if (args.has('--docx')) {
    const { renderDocx } = await import('./docx.mjs');
    await renderDocx({ T, NAMES, LOG, BATCHES, PRELIM, R, out: A(DOCX) });
    meta.docx_source = editionHash;
    console.log(`  wrote ${DOCX}`);
  }
  if (args.has('--pdf') || args.has('--docx')) {
    meta.note = 'Written by scripts/lalitha/build.mjs. source / docx_source = hash of edition/index.html the files were made from.';
    fs.writeFileSync(A(pdfMetaPath), JSON.stringify(meta, null, 2) + '\n');
  }
}
if (problems.length) { console.error(problems.map((p) => '✗ ' + p).join('\n')); process.exit(1); }
console.log(CHECK ? '✓ lalitha edition: up to date' : `✓ lalitha edition: built (${NAMES.length} names, ${T.verses.length} ślokas)`);
