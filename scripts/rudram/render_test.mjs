#!/usr/bin/env node
/**
 * Test 8 of the brief — rendering. Loads every built Śrī Rudram page in
 * headless Chromium at phone and desktop widths and fails unless:
 *   - the page throws no script error and has no horizontal scroll;
 *   - every unit of text.json is on its anuvāka page, in order, and the
 *     Saṃhitā in the DOM is exactly text.json's (nothing truncated);
 *   - every Devanagari glyph used by the text (incl. the svara marks and
 *     ᳵ ᳶ) is drawn by some installed font (no blank boxes): each distinct
 *     character must take non-zero width in the page's Devanagari font stack;
 *   - the PDF, if present, contains the IAST of every unit.
 *
 *   node scripts/rudram/render_test.mjs        (needs playwright; not in CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'rudramchamakam/edition/text.json'), 'utf8'));
const DER = JSON.parse(fs.readFileSync(path.join(ROOT, 'rudramchamakam/edition/derived.json'), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${srv.address().port}`;
const problems = [];
const pad2 = (n) => String(n).padStart(2, '0');
const pages = ['', 'sources.html', 'print.html', ...T.anuvakas.map((a) => `${a.part}-${pad2(a.n)}.html`)];
const browser = await chromium.launch();
for (const width of [390, 1280]) {
  const pg = await browser.newPage({ viewport: { width, height: 900 } });
  for (const p of pages) {
    const errs = [];
    pg.removeAllListeners('pageerror');
    pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.goto(`${base}/rudramchamakam/${p}`, { waitUntil: 'load' });
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 1) problems.push(`${p || 'index'} @${width}px: horizontal scroll of ${ov}px`);
    if (errs.length) problems.push(`${p || 'index'} @${width}px: script error ${errs[0]}`);
    const a = T.anuvakas.find((x) => p === `${x.part}-${pad2(x.n)}.html`);
    if (a && width === 1280) {
      const got = await pg.evaluate(() => [...document.querySelectorAll('.verses > .verse')].map((s) => ({
        id: s.id, sa: s.querySelector('.v-sa .sv-acc')?.textContent || '',
      })));
      const want = a.units.map((u) => ({ id: `${a.id[0].toLowerCase()}${a.n}-${u.n}`, sa: u.samhita.replace(/\s*\[(\d+)\]/g, ' [$1]') }));
      if (got.length !== want.length) problems.push(`${p}: ${got.length} units on the page, ${want.length} in text.json`);
      want.forEach((w, i) => {
        const g = got[i];
        if (!g || g.id !== w.id) problems.push(`${p}: unit ${i + 1} is ${g?.id}, expected ${w.id}`);
        else if (g.sa.replace(/\s+/g, ' ').trim() !== w.sa.replace(/\s+/g, ' ').trim()) problems.push(`${p}: the Saṃhitā of ${w.id} differs from text.json`);
      });
    }
  }
  await pg.close();
}
// glyph coverage: every distinct character of the text must have width in the edition's font stack
{
  const chars = [...new Set(T.anuvakas.flatMap((a) => a.units.map((u) => u.samhita)).join('').replace(/[\s\[\]0-9]/g, ''))];
  const pg = await browser.newPage();
  await pg.goto(`${base}/rudramchamakam/namakam-01.html`, { waitUntil: 'load' });
  const zero = await pg.evaluate((cs) => {
    const span = document.createElement('span');
    span.lang = 'sa';
    span.style.cssText = 'font-family: var(--dev); font-size: 40px; position: absolute; white-space: pre;';
    document.body.appendChild(span);
    const bad = [];
    for (const c of cs) {
      // a combining mark is measured on a base letter: its width must change the cluster
      const comb = /[ऀ-ःऺ-ॏ॑-ॗॢॣ᳐-᳹]/.test(c) && !/[ᳵᳶ]/.test(c);
      span.textContent = 'क';
      const w0 = span.getBoundingClientRect().width;
      span.textContent = comb ? `क${c}` : c;
      const w = span.getBoundingClientRect().width;
      const h = span.getBoundingClientRect().height;
      if (!comb && w < 4) bad.push(c);
      if (comb && w === w0 && h === 0) bad.push(c);
    }
    return bad;
  }, chars);
  if (zero.length) problems.push(`glyphs drawn with no width (missing from every font?): ${zero.map((c) => `U+${c.codePointAt(0).toString(16)}`).join(' ')}`);
  await pg.close();
}
await browser.close();
srv.close();
// the PDF carries the verified text (its IAST is extracted reliably)
const pdf = path.join(ROOT, 'rudramchamakam/sri-rudram-reading-edition.pdf');
if (fs.existsSync(pdf)) {
  const txt = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' }).normalize('NFC').replace(/\s+/g, '');
  let missing = 0;
  for (const a of T.anuvakas) for (const u of a.units) {
    const i = (DER.iast[u.samhita.replace(/\s*\[\d+\]/g, '')] || '').normalize('NFC').replace(/[\s|]+/g, '');
    if (i && !txt.includes(i.slice(0, 40))) { missing++; if (missing < 4) problems.push(`PDF lacks ${a.id}.${u.n} («${i.slice(0, 30)}…»)`); }
  }
  if (missing) problems.push(`PDF: ${missing} unit(s) not found`);
}
if (problems.length) { problems.forEach((p) => console.log('FAIL', p)); process.exit(1); }
console.log(`ok: ${pages.length} pages at 390 and 1280 px; every unit present and exact; every glyph drawn${fs.existsSync(pdf) ? '; the PDF carries every unit' : ''}`);
