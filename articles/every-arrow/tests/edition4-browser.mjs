#!/usr/bin/env node
/**
 * Every Arrow Is a Decision, EDITION 4 — browser tests (headless Chromium).
 *
 *   EA_DEPS=/dir/with/node_modules node articles/every-arrow/tests/edition4-browser.mjs
 *   (EA_DEPS needs playwright, axe-core and pdfjs-dist; CHROMIUM_PATH optional)
 *
 * lenses      every figure switches lens by mouse and by arrow keys, hides the other
 *             rows, announces what is shown and writes ?f=<figure>:<lens>
 * deep links  ?f=<figure>:<lens> opens that view
 * forwarding  edition-3 anchors, ?f= states and ?path= links land on edition 3
 * no-JS       every lens of every figure is visible; the switches are not
 * a11y        axe-core (WCAG 2.2 A/AA): no serious or critical violations, with and
 *             without JavaScript, at desktop and phone widths
 * responsive  no horizontal scroll at 320, 390, 768, 1280 and 1920 px
 * print       print media shows every lens and hides every switch; the committed PDF
 *             has no near-blank page and carries the edition in its running header
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, deps, pdfText } from '../../../scripts/every_arrow/pdf.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const URL_ = '/articles/every-arrow-is-a-decision.html';
const fails = [];
let passed = 0;
const ok = (c, m) => { if (c) passed++; else fails.push(m); };
const { req } = deps();
const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const PRODUCTS = ['passkeys', 'browser', 'mail', 'messages', 'wallet', 'backup', 'assistant', 'voice'];

async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  ok(v.length === 0, `axe ${label}: ${v.join('; ')}`);
}
const visibleRows = (page, id) => page.$$eval(`#fig-${id} tbody tr[data-l]`, (rs) => rs.filter((r) => r.offsetParent !== null).map((r) => r.getAttribute('data-l')).join());

const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
const errors = [];
async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, javaScriptEnabled: opts.js !== false, reducedMotion: 'reduce' });
  await ctx.route((u) => !u.href.startsWith(base) || (opts.blockScripts && /\.js(\?|$)/.test(u.pathname + u.search)), (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
  await page.goto(base + url, { waitUntil: 'load' });
  return { ctx, page };
}

try {
  /* ── lenses, by mouse and keyboard ─────────────────────────────── */
  {
    const { ctx, page } = await open(URL_);
    ok(await page.$eval('.cmp-ctl', (c) => !c.hidden), 'the lens switches appear once JavaScript runs');
    ok((await page.$$eval('.ov-set', (s) => s.filter((x) => !x.hidden).map((x) => x.getAttribute('data-l')))).join() === 'sec', 'the whole picture opens on Security alone');
    await page.click('#compare .cmp-ctl [data-l="gov"]');
    ok((await page.$$eval('.ov-set', (s) => s.filter((x) => !x.hidden).map((x) => x.getAttribute('data-l')))).join() === 'gov', 'the whole picture switches to Data governance');
    ok(/Data governance<\/b> across 8 products/.test(await page.$eval('#fig-overview .cmp-read', (e) => e.innerHTML)), 'the whole picture announces its lens');
    ok(/[?&]f=overview:gov/.test(page.url()), 'the whole picture writes its lens to the URL');
    for (const id of PRODUCTS) {
      ok(await visibleRows(page, id) === 'sec,pri,qa,gov', `#${id}: opens on all four lenses`);
      await page.click(`#${id} .cmp-ctl [data-l="qa"]`);
      ok(await visibleRows(page, id) === 'qa', `#${id}: click QA shows only QA`);
      const cap = await page.$eval(`#fig-${id} .cmp-read`, (e) => e.textContent);
      ok(/^QA for .+ and .+: \d+ documented, \d+ settings?, \d+ limits?, [1-9]\d* tests?\.$/.test(cap), `#${id}: reading after QA: ${cap}`);
      ok(new RegExp(`[?&]f=${id}:qa`).test(page.url()), `#${id}: URL carries f=${id}:qa`);
      await page.focus(`#${id} .cmp-ctl [aria-checked="true"]`);
      await page.keyboard.press('ArrowRight');
      ok(await visibleRows(page, id) === 'gov', `#${id}: ArrowRight moves QA → Data governance`);
      ok(await page.evaluate((i) => document.activeElement === document.querySelector(`#${i} .cmp-ctl [data-l="gov"]`), id), `#${id}: focus follows the selection`);
      await page.keyboard.press('Home');
      ok(await visibleRows(page, id) === 'sec,pri,qa,gov', `#${id}: Home returns to all four lenses`);
    }
    await axe(page, 'desktop');
    await ctx.close();
  }

  /* ── deep links ────────────────────────────────────────────────── */
  {
    const { ctx, page } = await open(URL_ + '?f=mail:pri#mail');
    ok(await visibleRows(page, 'mail') === 'pri', '?f=mail:pri opens mail on Privacy');
    ok(await page.$eval('#mail .cmp-ctl [data-l="pri"]', (b) => b.getAttribute('aria-checked')) === 'true', '?f=mail:pri checks Privacy');
    ok(page.url().endsWith(URL_ + '?f=mail:pri#mail'), 'a valid edition-4 deep link is not forwarded');
    await ctx.close();
  }

  /* ── edition-3 links are forwarded ─────────────────────────────── */
  for (const u of ['#s01', '#cc-auth', '#door', '?f=person:1#person', '?path=exec#promise']) {
    const { ctx, page } = await open(URL_ + u);
    await page.waitForURL(/edition-3\.html/, { timeout: 5000 }).catch(() => {});
    ok(page.url() === base + '/articles/every-arrow/edition-3.html' + u, `${u} is forwarded to edition 3 (got ${page.url()})`);
    await ctx.close();
  }

  /* ── without JavaScript ────────────────────────────────────────── */
  {
    const { ctx, page } = await open(URL_, { js: false });
    ok(await page.$$eval('.cmp-ctl', (cs) => cs.every((c) => c.offsetParent === null)), 'no-JS: the switches are hidden');
    ok((await page.$$eval('.ov-set', (s) => s.filter((x) => x.offsetParent !== null).length)) === 4, 'no-JS: every lens of the whole picture shows');
    for (const id of PRODUCTS) ok(await visibleRows(page, id) === 'sec,pri,qa,gov', `no-JS: #${id} shows every lens`);
    await ctx.close();
  }
  { /* axe needs a script of its own, so "no JavaScript" here means the essay's script is blocked */
    const { ctx, page } = await open(URL_, { blockScripts: true });
    ok(await page.$$eval('.cmp-ctl', (cs) => cs.every((c) => c.offsetParent === null)), 'script blocked: the switches stay hidden');
    await axe(page, 'script blocked');
    await ctx.close();
  }

  /* ── phone, and no sideways scroll ─────────────────────────────── */
  for (const w of [320, 390, 768, 1280, 1920]) {
    const { ctx, page } = await open(URL_, { viewport: { width: w, height: 900 } });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, `${w}px: page scrolls sideways by ${over}px`);
    if (w === 390) await axe(page, 'phone');
    await ctx.close();
  }

  /* ── print ─────────────────────────────────────────────────────── */
  {
    const { ctx, page } = await open(URL_ + '?f=mail:pri');
    await page.emulateMedia({ media: 'print' });
    ok(await page.$$eval('.cmp-ctl', (cs) => cs.every((c) => getComputedStyle(c).display === 'none')), 'print: the switches are hidden');
    ok(await visibleRows(page, 'mail') === 'sec,pri,qa,gov', 'print: a filtered figure still prints every lens');
    ok((await page.$$eval('.ov-set', (s) => s.filter((x) => getComputedStyle(x).display !== 'none').length)) === 4, 'print: the whole picture prints every lens');
    ok(await page.$eval('.toc', (t) => getComputedStyle(t).display === 'none'), 'print: the contents bar is hidden');
    await ctx.close();
  }

  /* ── the committed PDF ─────────────────────────────────────────── */
  {
    const pages = await pdfText(path.join(ROOT, 'articles/every-arrow/every-arrow-is-a-decision.pdf'));
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'articles/every-arrow/pdf.json'), 'utf8'));
    ok(pages.length === meta.pages, `pdf.json says ${meta.pages} pages, the PDF has ${pages.length}`);
    pages.forEach((t, i) => ok(t.length >= 300, `PDF page ${i + 1} is nearly blank (${t.length} characters)`));
    const edition = /<meta name="ps:edition" content="([\d.]+)">/.exec(fs.readFileSync(path.join(ROOT, URL_.slice(1)), 'utf8'))[1];
    ok(pages.slice(1).every((t) => t.includes(`Edition ${edition}`)), `every PDF page after the first carries “Edition ${edition}” in its header`);
    for (const p of ['Who proves you are you?', 'Who hears the kitchen?', 'Twenty-eight questions for any product', 'What must still be possible', 'One morning, many arrows', 'Many devices, many companies', 'Every guarantee has a boundary', 'Every arrow is still a decision.']) ok(pages.some((t) => t.includes(p)), `the PDF contains “${p}”`);
  }
} finally {
  await browser.close();
  server.close();
}
ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); console.error(`\n${fails.length} failed, ${passed} passed`); process.exit(1); }
console.log(`✓ every-arrow edition 4 browser: ${passed} checks passed`);
