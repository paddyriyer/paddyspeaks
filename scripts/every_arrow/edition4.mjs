#!/usr/bin/env node
/**
 * Every Arrow Is a Decision, EDITION 4 — build and check.
 * (Edition 3, archived at articles/every-arrow/edition-3.html, is built by build.mjs,
 *  which also runs this file, so `node scripts/every_arrow/build.mjs [--check|--pdf]`
 *  covers both.)
 *
 *   node scripts/every_arrow/edition4.mjs            write
 *   node scripts/every_arrow/edition4.mjs --check    CI: fail if anything is stale or inconsistent
 *   EA_DEPS=/dir/with/node_modules node scripts/every_arrow/edition4.mjs --pdf
 *
 * From articles/every-arrow/compare.js (the ONLY place a claim is written) it generates,
 * into the essay's <div data-gen="…"></div><!-- /gen:… --> slots:
 *   overview           one table per lens: products × companies, headlines only
 *   product:<id>       the arrow, the four-lens table, the reading and the Command Center link
 *   sources            the source list, grouped by company
 * and then stamps every data-ea span (reading time, counts, edition, PDF pages), the
 * JSON-LD timeRequired, ?v= hashes on the essay's own assets, the reading time in
 * article_metadata.json / the /articles/ card / the homepage feature, the Markdown
 * download (four-lenses.md) and, with --pdf, the printable edition + pdf.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (p) => path.join(ROOT, p);
export const ESSAY4 = 'articles/every-arrow-is-a-decision.html';
const DIR = 'articles/every-arrow';
const SLUG = 'every-arrow-is-a-decision.html';
const PDF = `${DIR}/every-arrow-is-a-decision.pdf`;
const PDF_META = `${DIR}/pdf.json`;
const WPM = 230;
const EDITION = '4.0', REVISED = '3 October 2026';

export function loadCompare() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(A(`${DIR}/compare.js`), 'utf8'), ctx, { filename: 'compare.js' });
  return ctx.EA_CMP;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* typographic apostrophes and dashes are kept; only markup-significant characters are escaped */

export async function buildEdition4({ check = false, pdf = false } = {}) {
  const problems = [];
  const C = loadCompare();
  const L = C.lenses, K = C.kinds, CO = C.companies, SRC = C.sources;
  const used = new Set();
  const label = (k) => SRC[k].c.split(',')[0];
  const cites = (keys) => keys.split(/\s+/).filter(Boolean).map((k) => {
    if (!SRC[k]) { problems.push(`compare.js: unknown source "${k}"`); return ''; }
    used.add(k);
    return `<a class="src" data-src="${k}" href="${esc(SRC[k].u)}">${esc(label(k))}</a>`;
  }).join(' · ');
  const kindTag = (k) => `<span class="k${k === 'doc' ? '' : ' k--' + k}">${K[k]}</span>`;
  const item = (it) => {
    const [k, h, x, s] = it;
    return `<div class="it" data-k="${k}"><p class="h">${kindTag(k)}${esc(h)}</p><p>${esc(x)}</p>${k === 'test' ? '' : `<p class="meta">${cites(s)}</p>`}</div>`;
  };
  const counts = (items) => { const n = { doc: 0, set: 0, lim: 0, test: 0 }; items.forEach((i) => n[i[0]]++); return n; };
  const countText = (n) => [[n.doc, 'documented'], [n.set, n.set === 1 ? 'setting' : 'settings'], [n.lim, n.lim === 1 ? 'limit' : 'limits'], [n.test, n.test === 1 ? 'test' : 'tests']].map(([v, w]) => `${v} ${w}`).join(', ');
  const radios = (label, opts, cur) => `<div class="cmp-ctl" role="radiogroup" aria-label="${esc(label)}" hidden>${opts.map(([id, t, l]) => `<button type="button" class="tog" role="radio" data-l="${id}" aria-checked="${id === cur}" tabindex="${id === cur ? 0 : -1}">${l ? `<span class="dot" style="background:var(--l-${l})" aria-hidden="true"></span>` : ''}${esc(t)}</button>`).join('')}</div>`;

  /* ── data checks: every cell filled, every claim cited, no scoring ── */
  const ids = new Set();
  for (const p of C.products) {
    if (ids.has(p.id)) problems.push(`compare.js: duplicate product ${p.id}`); ids.add(p.id);
    if (p.cos.length !== 3) problems.push(`${p.id}: compares ${p.cos.length} companies, expected 3`);
    for (const co of p.cos) {
      if (!CO[co]) problems.push(`${p.id}: unknown company ${co}`);
      if (!p.names[co]) problems.push(`${p.id}: no product name for ${co}`);
      for (const l of L) {
        const items = (p.cells[co] || {})[l.id];
        if (!items || !items.length) { problems.push(`${p.id} · ${co} · ${l.id}: empty cell`); continue; }
        for (const it of items) {
          if (!K[it[0]]) problems.push(`${p.id} · ${co} · ${l.id}: unknown kind ${it[0]}`);
          if (it[0] === 'test' && it[3]) problems.push(`${p.id} · ${co}: a Test is our recommendation and must not cite a source`);
          if (it[0] !== 'test' && !it[3]) problems.push(`${p.id} · ${co} · ${l.id}: “${it[1]}” has no source`);
          if (it[0] === 'test' && l.id !== 'qa') problems.push(`${p.id} · ${co}: Test items belong in the QA lens`);
        }
      }
      if (!(p.cells[co].qa || []).some((i) => i[0] === 'test')) problems.push(`${p.id} · ${co}: the QA lens needs a Test`);
    }
    for (const k of ['agree', 'differ', 'watch']) if (!p.read || !p.read[k]) problems.push(`${p.id}: reading has no “${k}”`);
  }
  const allText = JSON.stringify(C.products);
  for (const bad of [/\bscore[sd]?\b/i, /\bwinners?\b/i, /\branked?\b/i, /\bbest\b/i, /\bworst\b/i, /\bghost\b/i])
    if (bad.test(allText)) problems.push(`compare.js: “${bad.source}” — the comparison states what is documented; it does not score or rank`);
  for (const [k, s] of Object.entries(SRC)) if (!/^https:\/\//.test(s.u)) problems.push(`sources: ${k} is not an https URL`);

  /* ── renderers ─────────────────────────────────────────────── */
  const R = {};
  R.overview = () => {
    const opts = L.map((l) => [l.id, l.t, l.id]);
    const sets = L.map((l, li) => `<div class="ov-set" data-l="${l.id}"><table class="cmp-t ov-t"><caption><span class="lz lz--${l.id}">${esc(l.t)}</span> ${esc(l.q)}</caption>` +
      `<thead><tr><th scope="col">Product</th><th scope="col">Apple</th><th scope="col">Google</th><th scope="col">And one more</th></tr></thead><tbody>` +
      C.products.map((p) => `<tr><th scope="row"><a href="#${p.id}">${esc(p.n)}</a></th>${p.cos.map((co, i) => `<td data-h="${esc(CO[co])}">${i === 2 ? `<span class="co">${esc(CO[co])}</span>` : ''}${p.cells[co][l.id].map((it) => `<p class="h">${kindTag(it[0])}${esc(it[1])}</p>`).join('')}</td>`).join('')}</tr>`).join('') +
      `</tbody></table></div>`).join('');
    /* the static caption describes what shows without JavaScript and in print: every lens */
    const n = counts(C.products.flatMap((p) => p.cos.flatMap((co) => L.flatMap((l) => p.cells[co][l.id]))));
    return `${radios('Lens for the whole picture', opts, 'sec')}<figure class="cmp no-count" id="fig-overview" data-fig="overview">${sets}<figcaption class="cmp-read" aria-live="polite"><b>All four lenses</b> across ${C.products.length} products: ${countText(n)}.</figcaption></figure>`;
  };
  for (const p of C.products) {
    if (p.cos[0] !== 'apple' || p.cos[1] !== 'google') problems.push(`${p.id}: columns must be Apple, Google, then the third company`);
    R['product:' + p.id] = () => {
      const opts = [['all', 'All four lenses']].concat(L.map((l) => [l.id, l.t, l.id]));
      const rows = L.map((l) => `<tr data-l="${l.id}"><th scope="row"><span class="lz lz--${l.id}">${esc(l.t)}</span><span class="q">${esc(l.q)}</span></th>${p.cos.map((co) => `<td data-h="${esc(CO[co])}">${p.cells[co][l.id].map(item).join('')}</td>`).join('')}</tr>`).join('');
      const n = counts(p.cos.flatMap((co) => L.flatMap((l) => p.cells[co][l.id])));
      const pccHref = p.pcc.h.startsWith('#') ? '/privacy-command-center/' + p.pcc.h : p.pcc.h;
      return `<div class="lede"><p>${esc(p.lede)}</p></div>` +
        `<ol class="arrow" aria-label="The arrow in ${esc(p.n.toLowerCase())}">${p.arrow.map((a, i) => `<li${i === p.hot ? ' class="hot"' : ''}><span>${esc(a)}</span></li>`).join('')}</ol>` +
        `<p class="arrow-cap">The highlighted hop is the arrow to watch. Compared: ${p.cos.map((co) => `<b>${esc(CO[co])}</b> ${esc(p.names[co])}`).join(' · ')}.</p>` +
        `${radios('Lens for ' + p.n, opts, 'all')}<figure class="cmp" id="fig-${p.id}" data-fig="${p.id}"><table class="cmp-t"><caption>${esc(p.n)}: what each company documents, through four lenses</caption>` +
        `<thead><tr><th scope="col">Lens</th>${p.cos.map((co) => `<th scope="col">${esc(CO[co])}<small>${esc(p.names[co])}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` +
        `<figcaption class="cmp-read" aria-live="polite"><b>All four lenses</b> for ${esc(p.cos.map((c) => CO[c]).join(', ').replace(/, ([^,]+)$/, ' and $1'))}: ${countText(n)}.</figcaption></figure>` +
        `<dl class="reading"><div><dt>Where they agree</dt><dd>${esc(p.read.agree)}</dd></div><div><dt>Where they differ</dt><dd>${esc(p.read.differ)}</dd></div><div class="watch"><dt>The arrow to watch</dt><dd>${esc(p.read.watch)}</dd></div></dl>` +
        `<p class="pcc-link"><a href="${esc(pccHref)}">See it on synthetic data in the Privacy Command Center: <b>${esc(p.pcc.t)}</b> &rarr;</a></p>`;
    };
  }
  const GROUPS = ['Apple', 'Google', 'Microsoft', 'Mozilla', 'Proton', 'Meta', 'Samsung', 'Amazon', 'Standards, regulators and press'];
  R.sources = () => GROUPS.map((g) => {
    const list = Object.entries(SRC).filter(([k, s]) => s.g === g && used.has(k));
    return list.length ? `<h3>${esc(g)}</h3><ol class="src-list">${list.map(([k, s]) => `<li id="src-${k}">${esc(s.c)} <a href="${esc(s.u)}">${esc(s.u.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a></li>`).join('')}</ol>` : '';
  }).join('');
  for (const g of new Set(Object.values(SRC).map((s) => s.g))) if (!GROUPS.includes(g)) problems.push(`sources: unknown group “${g}”`);

  /* ── apply ─────────────────────────────────────────────────── */
  const original = fs.readFileSync(A(ESSAY4), 'utf8');
  let html = original;
  const GEN = /(<div data-gen="([\w:-]+)">)([\s\S]*?)(<\/div><!-- \/gen:\2 -->)/g;
  const seen = new Set();
  const fill = (name) => { seen.add(name); if (!R[name]) { problems.push(`${ESSAY4}: no renderer for data-gen="${name}"`); return null; } return R[name](); };
  html = html.replace(GEN, (m, o, name, body, c) => { if (name === 'sources') return m; const r = fill(name); return r === null ? m : o + r + c; });
  html = html.replace(/(<div data-gen="sources">)([\s\S]*?)(<\/div><!-- \/gen:sources -->)/, (m, o, b, c) => { seen.add('sources'); return o + R.sources() + c; });
  for (const name of Object.keys(R)) if (!seen.has(name)) problems.push(`renderer “${name}” has no data-gen slot in the essay`);
  for (const k of Object.keys(SRC)) if (!used.has(k)) problems.push(`compare.js: source “${k}” is never cited`);
  for (const p of C.products) if (!new RegExp(`<section class="scene[^"]*" id="${p.id}"`).test(html)) problems.push(`${ESSAY4}: no section #${p.id}`);

  /* reading time: everything in <main> except the overview (its headlines repeat the product tables) */
  const main = html.slice(html.indexOf('<main id="main">'), html.indexOf('</main>'));
  const text = main.replace(/<figure class="cmp no-count"[\s\S]*?<\/figure>/g, ' ').replace(/<(script|style|button)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  const count = (x) => (x.match(/[A-Za-z0-9À-ɏ’'-]+/g) || []).length;
  const words = count(text);
  /* two honest numbers: the essay (prose, readings, patterns, review) and the essay with every table read in full */
  const tableWords = [...main.replace(/<figure class="cmp no-count"[\s\S]*?<\/figure>/g, ' ').matchAll(/<table class="cmp-t">[\s\S]*?<\/table>/g)].reduce((n, m) => n + count(m[0].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')), 0);
  const readEssay = Math.round((words - tableWords) / WPM);
  const read = Math.round(words / WPM);
  const claims = C.products.reduce((n, p) => n + p.cos.reduce((m, co) => m + L.reduce((q, l) => q + p.cells[co][l.id].filter((i) => i[0] !== 'test').length, 0), 0), 0);
  const pdfMeta = fs.existsSync(A(PDF_META)) ? JSON.parse(fs.readFileSync(A(PDF_META), 'utf8')) : { pages: 0 };
  const STAMP = {
    edition: EDITION, revised: REVISED, asof: C.asOf, read, 'read.essay': readEssay,
    products: C.products.length,
    companies: new Set(C.products.flatMap((p) => p.cos)).size,
    claims, sources: used.size,
    'pdf.pages': pdfMeta.pages
  };
  html = html.replace(/(<span data-ea="([\w.]+)">)([^<]*)(<\/span>)/g, (m, o, k, v, c) => {
    if (!(k in STAMP)) { problems.push(`${ESSAY4}: data-ea="${k}" has no value`); return m; }
    return o + STAMP[k] + c;
  });
  html = html.replace(/"timeRequired": "PT\d+M"/, `"timeRequired": "PT${read}M"`);
  html = html.replace(/((?:href|src)="\/articles\/every-arrow\/((?:lenses|compare)\.(?:css|js)))(?:\?v=[0-9a-f]+)?"/g, (m, pre, file) =>
    `${pre}?v=${crypto.createHash('sha256').update(fs.readFileSync(A(`${DIR}/${file}`))).digest('hex').slice(0, 10)}"`);
  { const css = fs.readFileSync(A(`${DIR}/lenses.css`), 'utf8');
    if (!css.includes(`Edition ${EDITION} \\00B7 ${REVISED}`)) problems.push(`${DIR}/lenses.css: the @page header must read “Edition ${EDITION} · ${REVISED}”`); }

  /* reading time elsewhere on the site */
  const other = [];
  const meta = JSON.parse(fs.readFileSync(A('article_metadata.json'), 'utf8'));
  const me = meta.find((x) => x.slug === SLUG);
  if (me.read_time !== read) other.push(['article_metadata.json', () => { me.read_time = read; return JSON.stringify(meta, null, 2) + '\n'; }]);
  const fixMinutes = (file, anchorRe) => {
    const s = fs.readFileSync(A(file), 'utf8');
    const i = s.search(anchorRe); if (i < 0) { problems.push(`${file}: cannot find the Every Arrow block`); return; }
    const tail = s.slice(i), j = tail.search(/\d+ min</);
    if (j < 0) { problems.push(`${file}: no "N min" near the Every Arrow block`); return; }
    const cur = parseInt(tail.slice(j), 10);
    if (cur !== read) other.push([file, () => s.slice(0, i) + tail.slice(0, j) + read + tail.slice(j + String(cur).length)]);
  };
  fixMinutes('content/pages/articles.html', /href="\/articles\/every-arrow-is-a-decision\.html" class="deck-card"/);
  fixMinutes('index.html', /<p class="ps-meta"><span>Privacy<\/span>/);

  /* the Markdown download, from the same data and the same review questions */
  const plain = (x) => x.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const kitHtml = html.slice(html.indexOf('id="kit-questions"'), html.indexOf('class="btn"', html.indexOf('id="kit-questions"')));
  const kit = [...kitHtml.matchAll(/<span class="lz lz--\w+">([^<]+)<\/span><\/h3><ul>([\s\S]*?)<\/ul>/g)].map((m) => `### ${plain(m[1])}\n\n` + [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => `- [ ] ${plain(x[1])}`).join('\n'));
  const md = `# Every Arrow Is a Decision — the four-lens review\n\nFrom *Every Arrow Is a Decision*, edition ${EDITION} (${REVISED}), by Paddy Iyer.\nhttps://paddyspeaks.com/articles/every-arrow-is-a-decision.html\n\n` +
    `Four questions for every arrow a product draws:\n\n${L.map((l) => `- **${l.t}.** ${l.q}`).join('\n')}\n\n## Twenty-eight questions for any product\n\n${kit.join('\n\n')}\n\nA question nobody can answer is a finding.\n\n` +
    `## The arrow to watch, product by product\n\n| Product | Compared | The arrow to watch |\n|---|---|---|\n${C.products.map((p) => `| ${p.n} | ${p.cos.map((c) => CO[c]).join(', ')} | ${p.read.watch.replace(/\|/g, '/')} |`).join('\n')}\n\n` +
    `Claims in the essay describe what each company documents, as reviewed on ${C.asOf}, with citations. The tests are recommendations. Nothing here is a score or legal advice.\n`;

  /* PDF freshness */
  const sourceHash = (h) => crypto.createHash('sha256').update(h.replace(/(<span data-ea="pdf\.pages">)\d+(<\/span>)/g, '$1#$2')).update(fs.readFileSync(A(`${DIR}/lenses.css`))).digest('hex').slice(0, 16);

  const outputs = [[ESSAY4, html], [`${DIR}/four-lenses.md`, md], ...other.map(([f, fn]) => [f, fn()])];
  const log = [];
  if (check) {
    for (const [f, content] of outputs) if ((fs.existsSync(A(f)) ? fs.readFileSync(A(f), 'utf8') : '') !== content) problems.push(`${f} is stale — run: node scripts/every_arrow/build.mjs`);
    if (!pdfMeta.pages) problems.push(`${PDF_META} missing — run the build with --pdf`);
    else if (pdfMeta.source !== sourceHash(html)) problems.push(`${PDF} is older than the essay — run: EA_DEPS=… node scripts/every_arrow/build.mjs --pdf`);
  } else {
    for (const [f, content] of outputs) if ((fs.existsSync(A(f)) ? fs.readFileSync(A(f), 'utf8') : '') !== content) { fs.writeFileSync(A(f), content); log.push('  wrote ' + f); }
    if (pdf && !problems.length) {
      const { renderPdf } = await import('./pdf.mjs');
      let pages = await renderPdf(ROOT, A(PDF), '/' + ESSAY4);
      if (pages !== pdfMeta.pages) {
        fs.writeFileSync(A(ESSAY4), fs.readFileSync(A(ESSAY4), 'utf8').replace(/(<span data-ea="pdf\.pages">)\d+(<\/span>)/g, `$1${pages}$2`));
        pages = await renderPdf(ROOT, A(PDF), '/' + ESSAY4);
      }
      fs.writeFileSync(A(PDF_META), JSON.stringify({ pages, source: sourceHash(fs.readFileSync(A(ESSAY4), 'utf8')), note: 'Written by scripts/every_arrow/edition4.mjs --pdf. source = hash of the essay HTML (page count masked) + lenses.css.' }, null, 2) + '\n');
      log.push(`  rendered edition 4 PDF: ${pages} pages`);
    }
  }
  log.push(`  edition 4: ${STAMP.products} products · ${STAMP.companies} companies · ${claims} cited claims · ${used.size} sources · essay ${readEssay} min · with every table ${read} min (${words} words, ${tableWords} in tables)`);
  return { problems, log };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = new Set(process.argv.slice(2));
  const { problems, log } = await buildEdition4({ check: args.has('--check'), pdf: args.has('--pdf') });
  console.log(log.join('\n'));
  if (problems.length) { console.error(problems.map((p) => '✗ ' + p).join('\n')); process.exit(1); }
  console.log(args.has('--check') ? '✓ every-arrow edition 4: up to date' : '✓ every-arrow edition 4: built');
}
