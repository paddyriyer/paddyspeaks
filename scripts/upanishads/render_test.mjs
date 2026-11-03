#!/usr/bin/env node
/**
 * Browser test of the Upaniṣads pages (needs playwright; run locally or in the
 * Accessibility workflow):
 *
 *   node scripts/upanishads/render_test.mjs
 *
 * - every generated page loads without a page error, and has no sideways scroll
 *   at 390 px;
 * - without JavaScript a mantra page reads in full: all fourteen sections are in
 *   the HTML, the Serious Student sections are open, nothing is hidden;
 * - the reading paths open exactly the sections of their level, and the choice
 *   survives a reload;
 * - the script switch hides IAST / Devanagari; the glossary search filters.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
let chromium;
try { ({ chromium } = req('playwright')); } catch { ({ chromium } = await import('playwright')); }

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(path.join(ROOT, d))) { const p = path.join(d, f); if (fs.statSync(path.join(ROOT, p)).isDirectory()) { if (!/edition|lib|data/.test(f)) walk(p); } else if (f.endsWith('.html')) pages.push('/' + p.replace(/index\.html$/, '')); } })('upanishads');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const block = (ctx) => ctx.route('**/*', (rt) => (rt.request().url().startsWith(base) ? rt.continue() : rt.abort()));

// 1. every page, phone width
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await block(ctx);
  const p = await ctx.newPage();
  let err = null;
  p.on('pageerror', (e) => { err = String(e); });
  for (const u of pages) {
    err = null;
    await p.goto(base + u, { waitUntil: 'load' });
    ok(!err, `${u}: page error ${err}`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 391, `${u}: sideways scroll at 390px (${sw}px)`);
    ok(await p.$('main h1'), `${u}: no h1 in main`);
  }
  await ctx.close();
}
// 2. no JavaScript
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  await block(ctx);
  const p = await ctx.newPage();
  await p.goto(base + '/upanishads/isha/mantra-06.html');
  const s = await p.evaluate(() => ({
    secs: [...document.querySelectorAll('[id^="m6-s"]')].map((x) => x.id),
    open: [...document.querySelectorAll('details.sec')].filter((d) => d.open).map((d) => +d.dataset.lvl),
    closed: [...document.querySelectorAll('details.sec')].filter((d) => !d.open).map((d) => +d.dataset.lvl),
    bar: document.getElementById('reader-bar').hidden,
  }));
  ok(s.secs.length === 14, `no-JS: ${s.secs.length} of 14 sections`);
  ok(s.open.every((l) => l <= 2) && s.closed.every((l) => l === 3), 'no-JS: Serious Student sections should be open, Scholar sections closed');
  ok(s.bar === true, 'no-JS: the reader bar should stay hidden');
  // Taittirīya: an analysed anuvāka has its units anchored and all fourteen sections
  // (2.8 has five units);
  // an anuvāka of a vallī still in preparation shows its verified text and says so.
  await p.goto(base + '/upanishads/taittiriya/anuvaka-1-01.html');
  const t = await p.evaluate(() => ({ secs: document.querySelectorAll('[id^="a1-1-s"]').length, unit: !!document.getElementById('u1-1-1') }));
  ok(t.secs === 14 && t.unit, `no-JS Taittirīya 1.1: ${t.secs} of 14 sections, unit anchor ${t.unit}`);
  await p.goto(base + '/upanishads/taittiriya/anuvaka-1-03.html');
  ok(await p.$('#u1-3-4'), 'Taittirīya 1.3: unit 1.3.4 should be anchored');
  await p.goto(base + '/upanishads/taittiriya/anuvaka-2-08.html');
  const t8 = await p.evaluate(() => ({ secs: document.querySelectorAll('[id^="a2-8-s"]').length, unit: !!document.getElementById('u2-8-5') }));
  ok(t8.secs === 14 && t8.unit, `no-JS Taittirīya 2.8: ${t8.secs} of 14 sections, unit 2.8.5 ${t8.unit}`);
  // 3.1 opens a vallī: the śānti is shown before the numbered text, and every
  // anuvāka is analysed now, so no page says "in preparation"
  await p.goto(base + '/upanishads/taittiriya/anuvaka-3-01.html');
  const t31 = await p.evaluate(() => ({ shanti: !!document.querySelector('.pre-shanti'), pending: !!document.querySelector('.pending'), secs: document.querySelectorAll('[id^="a3-1-s"]').length }));
  ok(t31.shanti && !t31.pending && t31.secs === 14, `Taittirīya 3.1: śānti ${t31.shanti}, pending note ${t31.pending}, ${t31.secs} of 14 sections`);
  await p.goto(base + '/upanishads/taittiriya/anuvaka-3-10.html');
  ok(await p.$('#u3-10-6'), 'Taittirīya 3.10: unit 3.10.6 should be anchored');
  await p.goto(base + '/upanishads/taittiriya/map.html');
  const map = await p.evaluate(() => ({ nodes: document.querySelectorAll('.cmap .cn').length, list: document.querySelectorAll('.clist .cl').length }));
  ok(map.nodes > 0 && map.nodes === map.list, `Taittirīya concept map: ${map.nodes} nodes, ${map.list} described`);
  // Kaṭha: records are single mantras keyed adhyāya.vallī.mantra
  await p.goto(base + '/upanishads/katha/mantra-1-1-01.html');
  const k1 = await p.evaluate(() => document.querySelectorAll('[id^="a1-1-1-s"]').length);
  ok(k1 === 14, `no-JS Kaṭha 1.1.1: ${k1} of 14 sections`);
  await p.goto(base + '/upanishads/katha/mantra-1-2-23.html');
  const k23 = await p.evaluate(() => ({ secs: document.querySelectorAll('[id^="a1-2-23-s"]').length, pending: !!document.querySelector('.pending') }));
  ok(k23.secs === 14 && !k23.pending, `no-JS Kaṭha 1.2.23: ${k23.secs} of 14 sections, pending note ${k23.pending}`);
  await p.goto(base + '/upanishads/katha/mantra-1-3-01.html');
  const k3 = await p.evaluate(() => ({ text: !!document.querySelector('.s1 .v-sa'), pending: !!document.querySelector('.pending') }));
  ok(k3.text && k3.pending, `Kaṭha 1.3.1 (in preparation): text ${k3.text}, pending note ${k3.pending}`);
  await ctx.close();
}
// 3. reading paths, script switch, persistence
{
  const ctx = await browser.newContext();
  await block(ctx);
  const p = await ctx.newPage();
  await p.goto(base + '/upanishads/isha/mantra-09.html');
  const state = () => p.evaluate(() => [...document.querySelectorAll('details.sec')].map((d) => [+d.dataset.lvl, d.open]));
  for (const [path_, name] of [[1, 'Curious Reader'], [3, 'Scholar'], [2, 'Serious Student']]) {
    await p.click(`.rb-paths [data-path="${path_}"]`);
    const st = await state();
    ok(st.every(([l, o]) => o === (l <= path_)), `path ${name}: sections not opened to level ${path_}`);
  }
  await p.click('.rb-paths [data-path="3"]');
  await p.reload();
  ok((await state()).every(([, o]) => o), 'the Scholar path did not survive a reload');
  await p.click('.rb-aa');
  await p.click('[data-script="dev"]');
  ok(!(await p.isVisible('.v-iast')), 'Devanagari-only should hide the IAST');
  await p.click('[data-script="iast"]');
  ok(!(await p.isVisible('.s1 .v-sa')), 'IAST-only should hide the Devanagari');
  await p.goto(base + '/upanishads/glossary.html');
  await p.fill('#gq', 'avidya');
  const vis = await p.evaluate(() => [...document.querySelectorAll('.gt')].filter((x) => !x.hidden).map((x) => x.id));
  ok(vis.includes('avidya') && vis.length < 10, `glossary search for "avidya" shows ${vis.length} terms`);
  await ctx.close();
}
await browser.close();
server.close();
if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); process.exit(1); }
console.log(`✓ Upaniṣads pages: ${pages.length} pages load cleanly at 390px; no-JS, reading paths, script switch and glossary search work`);
