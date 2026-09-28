#!/usr/bin/env node
/**
 * Every Arrow Is a Decision — browser tests (headless Chromium).
 *
 *   EA_DEPS=/dir/with/node_modules node articles/every-arrow/tests/browser.mjs
 *   (EA_DEPS needs playwright, axe-core and pdfjs-dist; CHROMIUM_PATH optional)
 *
 * interaction  every figure changes state by mouse or keyboard, announces a reading,
 *              resets to its initial state, and round-trips through a deep link
 * keyboard     tablists/radiogroups move with the arrow keys and keep focus
 * no-JS        every figure shows its static fallback; the contents list is visible
 * motion       with reduced motion, "play" jumps to the end instead of animating
 * paths        ?path=exec hides scene bodies; "Read the full scene" opens one
 * responsive   no horizontal scroll at 320, 390, 768, 1280 and 1920 px
 * a11y         axe-core (WCAG 2.2 A/AA): no serious or critical violations, in
 *              full, executive and no-JS modes, at desktop and phone widths
 * print        print media hides every live figure and shows every fallback; the
 *              committed PDF has no blank or near-blank page, and page numbers
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

/* How to change each figure: [kind, selector]. click = mouse; key = focus + ArrowRight. */
const ACT = {
  person: ['click', '#asmModes button:nth-child(2)'], join: ['click', '#joinBtn'], crowd: ['click', '.crowd-ctl .tog[data-q="zip"]'],
  spectrum: ['key', '#specStops [aria-selected="true"]'], history: ['click', '#hhDays button:nth-child(4)'], wrong: ['click', '#wrongGuards button'],
  eight: ['key', '#dial .dq[aria-selected="true"]'], lifecycle: ['key', '#life [aria-selected="true"]'], flow: ['click', '#arrowList button'],
  purpose: ['click', '#driftRun'], harm: ['key', '#harmPick [aria-selected="true"]'], tradeoff: ['click', '#toAlts [data-alt="2"]'],
  burn: ['click', '#burnBtn'], ladder: ['key', '#rungs [aria-selected="true"]'], consent: ['click', '#cGrant'],
  rights: ['key', '#rightsPick [aria-selected="true"]'], retention: ['key', '#ret'], forget: ['click', '#forgetStores button'],
  vendor: ['key', '#vendorStages [aria-selected="true"]'], worst: ['key', '#designs [aria-selected="true"]'], pets: ['key', '#threats [aria-selected="true"]'],
  dp: ['click', '#lgHalf'], change: ['click', '#chgNext'], observe: ['click', '#monPick button'], incident: ['click', '#irSteps .ir-opts button']
};

async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  ok(v.length === 0, `axe ${label}: ${v.join('; ')}`);
}

const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
async function open(opts = {}, q = '') {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 1280, height: 900 }, reducedMotion: opts.rm ? 'reduce' : 'no-preference', javaScriptEnabled: opts.js !== false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route((u) => !u.href.startsWith(base) || (opts.blockScripts && /\/articles\/every-arrow\/[\w-]+\.js/.test(u.href)), (r) => r.abort());
  await page.goto(base + URL_ + q, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const state = (page, id) => page.evaluate((i) => window.EA.figs[i].api.get(), id);

try {
  /* ── interaction, keyboard, reset, deep links ─────────────────── */
  {
    const { ctx, page, errors } = await open({ rm: true });
    const figs = await page.evaluate(() => Object.keys(window.EA.figs));
    const inHtml = await page.evaluate(() => [...document.querySelectorAll('figure.fig[id^="fig-"]')].map((f) => f.id.slice(4)));
    ok(inHtml.every((id) => figs.includes(id)), `figures that never registered: ${inHtml.filter((id) => !figs.includes(id))}`);
    const links = [];
    for (const id of inHtml) {
      const init = await state(page, id);
      const read0 = await page.$eval(`#fig-${id} .fig-read`, (e) => e.textContent.trim());
      ok(read0.length > 20, `fig-${id}: no written interpretation on load`);
      const trail = id.startsWith('trail-');
      const [kind, sel] = trail ? ['key', `#fig-${id} .tl-stop[aria-selected="true"]`] : ACT[id] || [];
      if (!kind) { fails.push(`fig-${id}: no test action defined`); continue; }
      const el = await page.$(sel);
      if (!el) { fails.push(`fig-${id}: control ${sel} not found`); continue; }
      if (!(await el.isVisible())) { fails.push(`fig-${id}: control ${sel} is not visible`); continue; }
      await el.scrollIntoViewIfNeeded({ timeout: 5000 });
      if (kind === 'click') await el.click();
      else { await el.focus(); await page.keyboard.press('ArrowRight'); }
      await page.waitForTimeout(120);
      const after = await state(page, id);
      ok(after !== init, `fig-${id}: ${kind === 'key' ? 'the arrow key' : 'a click'} did not change its state (${init})`);
      if (kind === 'key') ok(await page.evaluate((i) => document.getElementById('fig-' + i).contains(document.activeElement), id), `fig-${id}: keyboard focus left the figure`);
      const read1 = await page.$eval(`#fig-${id} .fig-read`, (e) => e.textContent.trim());
      ok(read1.length > 20 && read1 !== read0, `fig-${id}: the written interpretation did not update`);
      if (trail) { await page.click(`#fig-${id} .tl-rule`); ok((await state(page, id)).split('.')[1].includes('1'), `fig-${id}: a habit switch did not change the state`); }
      links.push([id, await state(page, id)]);
      ok(await page.$eval(`#fig-${id} [data-fig-reset]`, (b) => !b.disabled), `fig-${id}: Reset stays disabled after a change`);
      if (await page.$eval(`#fig-${id} [data-fig-reset]`, (b) => !b.disabled)) await page.click(`#fig-${id} [data-fig-reset]`);
      await page.waitForTimeout(80);
      ok((await state(page, id)) === init, `fig-${id}: Reset did not return to the initial state`);
      const url = await page.evaluate((i) => window.EA.link(i), id);
      ok(url.includes('#fig-' + id), `fig-${id}: its link has no anchor`);
    }
    ok(errors.length === 0, `page errors during interaction: ${errors.join(' | ')}`);
    await ctx.close();
    /* every state round-trips through one deep link */
    const q = '?f=' + encodeURIComponent(links.map(([i, s]) => `${i}:${s}`).join(','));
    const d = await open({ rm: true }, q);
    for (const [id, s] of links) ok((await state(d.page, id)) === s, `fig-${id}: deep link ?f=${id}:${s} restored ${await state(d.page, id)}`);
    ok(d.errors.length === 0, `page errors on deep link: ${d.errors.join(' | ')}`);
    await d.ctx.close();
  }

  /* ── reduced motion: "play" jumps to the end ───────────────────── */
  {
    const { ctx, page } = await open({ rm: true });
    await page.click('#fig-trail-forget [data-a="play"]');
    ok((await state(page, 'trail-forget')).startsWith('5.'), 'reduced motion: playing a trail should jump to its last moment');
    await page.click('#climb');
    ok((await state(page, 'ladder')) === '5', 'reduced motion: climbing the ladder should jump to the top rung');
    await ctx.close();
  }

  /* ── no JavaScript, or the essay's scripts fail to load: static fallbacks carry the page ── */
  for (const [width, mode] of [[1280, 'off'], [390, 'off'], [1280, 'blocked'], [390, 'blocked']]) {
    const { ctx, page } = await open(mode === 'off' ? { js: false, width } : { blockScripts: true, width });
    const r = await page.evaluate(() => {
      const figs = [...document.querySelectorAll('figure.fig')];
      return { figs: figs.length, hidden: figs.filter((f) => { const s = f.querySelector('.fig-static'); return !s || s.offsetHeight < 40; }).map((f) => f.id), live: figs.filter((f) => f.querySelector('.fig-live').offsetHeight > 0).map((f) => f.id), toc: document.querySelector('.toc-list').offsetHeight, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    const L = `JS ${mode} ${width}`;
    ok(r.hidden.length === 0, `${L}: static fallback missing for ${r.hidden}`);
    ok(r.live.length === 0, `${L}: empty interactive shells visible for ${r.live}`);
    ok(r.toc > 100, `${L}: contents list not visible`);
    ok(r.overflow <= 0, `${L}: horizontal overflow ${r.overflow}px`);
    if (mode === 'blocked') await axe(page, L);
    await ctx.close();
  }

  /* ── reading paths ─────────────────────────────────────────────── */
  {
    const { ctx, page } = await open({}, '?path=exec');
    const r = await page.evaluate(() => ({ bodies: [...document.querySelectorAll('.scene-body')].filter((b) => b.offsetHeight > 0).length, briefs: [...document.querySelectorAll('.brief')].filter((b) => b.offsetHeight > 0).length }));
    ok(r.bodies === 0 && r.briefs === 23, `exec path: expected 23 briefs and no scene bodies, got ${r.briefs} briefs, ${r.bodies} bodies`);
    await page.click('#consent [data-open-scene]');
    ok(await page.$eval('#consent .scene-body', (e) => e.offsetHeight > 0), 'exec path: "Read the full scene" did not open the scene');
    await axe(page, 'exec 1280');
    await page.click('#tocToggle');
    await page.click('.toc-modes [data-set-path="full"]');
    ok(await page.evaluate(() => document.documentElement.getAttribute('data-path') === 'full' && [...document.querySelectorAll('.scene-body')].every((b) => b.offsetHeight > 0)), 'switching to the full path did not show every scene');
    await ctx.close();
  }

  /* ── responsive + axe on the full page ─────────────────────────── */
  for (const width of [320, 390, 768, 1280, 1920]) {
    const { ctx, page, errors } = await open({ width });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 0, `${width}px: horizontal overflow of ${over}px`);
    const wide = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.tbl-scroll,.tl-people,.fig-static,.flow-fig')).slice(0, 3).map((e) => e.tagName + '.' + e.className));
    ok(wide.length === 0, `${width}px: elements wider than the viewport: ${wide}`);
    ok(errors.length === 0, `${width}px: page errors ${errors}`);
    if (width === 1280 || width === 390) await axe(page, `full ${width}`);
    if (width === 390) {
      await page.click('#tocToggle');
      ok(await page.$eval('#tocList', (e) => e.offsetHeight > 200), '390px: the contents sheet does not open');
      await page.keyboard.press('Escape');
      ok(await page.$eval('#tocToggle', (e) => e.getAttribute('aria-expanded') === 'false'), '390px: Escape does not close the contents sheet');
    }
    await ctx.close();
  }

  /* ── print media ───────────────────────────────────────────────── */
  {
    const { ctx, page } = await open();
    await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => ({
      live: [...document.querySelectorAll('.fig-live')].filter((e) => e.offsetHeight > 0).length,
      stat: [...document.querySelectorAll('figure.fig .fig-static')].filter((e) => e.offsetHeight > 0).length,
      figs: document.querySelectorAll('figure.fig').length,
      invisible: [...document.querySelectorAll('main p, main h2, main h3, main li')].filter((e) => e.offsetHeight > 0 && getComputedStyle(e).opacity === '0').length
    }));
    ok(r.live === 0, `print: ${r.live} interactive figures still printing`);
    ok(r.stat === r.figs, `print: ${r.figs - r.stat} figures print without their static version`);
    ok(r.invisible === 0, `print: ${r.invisible} text elements would print invisible`);
    await ctx.close();
  }

  /* ── the committed PDF ─────────────────────────────────────────── */
  {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'articles/every-arrow/pdf.json'), 'utf8'));
    const pages = await pdfText(path.join(ROOT, 'articles/every-arrow/every-arrow-is-a-decision.pdf'));
    ok(pages.length === meta.pages, `PDF has ${pages.length} pages; pdf.json says ${meta.pages}`);
    const thin = pages.map((t, i) => [i + 1, t.replace(/\s+/g, '').length]).filter(([, n]) => n < 300);
    ok(thin.length === 0, `PDF pages that are blank or nearly blank: ${thin.map(([p, n]) => `p${p} (${n} chars)`).join(', ')}`);
    ok(/Every arrow/i.test(pages[0]), 'PDF page 1 is not the title page');
    ok(pages.every((t, i) => t.includes(`Page ${i + 1} of ${pages.length}`)), 'PDF pages lack “Page N of M” numbering');
    ok(pages.slice(1).every((t) => /Edition 2\.0/.test(t)), 'PDF running header lacks the edition');
    const text = pages.join(' ').replace(/\s+/g, '').toLowerCase();
    for (const w of ['Chapter 1 of 5', 'Chapter 5 of 5', 'Sources', 'The evidence', 'Golle']) ok(text.includes(w.replace(/\s+/g, '').toLowerCase()), `PDF lacks “${w}”`);
  }
} finally {
  await browser.close();
  server.close();
}

if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); console.error(`\n${fails.length} failed, ${passed} passed`); process.exit(1); }
console.log(`✓ every-arrow browser: ${passed} checks passed`);
