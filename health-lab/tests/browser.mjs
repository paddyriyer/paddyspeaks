#!/usr/bin/env node
/**
 * Health Intelligence Lab — browser tests (headless Chromium).
 *
 *   A11Y_DEPS=/path/with/node_modules node health-lab/tests/browser.mjs
 *
 * Serves the repo root on a local port and checks, in a real browser:
 *   1. My Private Health Lab (/health-lab/private/):
 *      - the Content-Security-Policy is present and actually blocks a request to another site
 *      - the page loads nothing from another site
 *      - a file without the synthetic marker is refused before analysis
 *      - synthetic files chosen from disk are read and analyzed with ZERO network requests
 *        after the first file is chosen (counted by the browser, not by the page)
 *      - "Delete everything now" clears the results
 *   2. The Explorer (/health-lab/): every view renders for every persona without errors.
 * Uses the same Playwright the accessibility workflow installs.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
const { chromium } = req('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip', '.csv': 'text/csv', '.xml': 'text/xml', '.webp': 'image/webp' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
await new Promise(res => server.listen(0, res));
const BASE = `http://127.0.0.1:${server.address().port}`;
let failures = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failures++; console.error('✗ ' + msg); } };

const browser = await chromium.launch();
try {
  // ------------------------------------------------------------ 1. private lab
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const reqs = [], errors = [];
  page.on('request', r => reqs.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/health-lab/private/', { waitUntil: 'networkidle' });
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  ok(csp && /default-src 'none'/.test(csp) && /connect-src 'self'/.test(csp), 'private page declares a strict CSP');
  ok(reqs.every(u => u.startsWith(BASE)), 'private page loads nothing from another site: ' + reqs.filter(u => !u.startsWith(BASE)).join(', '));
  const blocked = await page.evaluate(async () => {
    let violated = false;
    document.addEventListener('securitypolicyviolation', () => { violated = true; });
    try { await fetch('https://example.com/should-be-blocked'); return 'fetched'; } catch (e) { await new Promise(r => setTimeout(r, 100)); return violated ? 'blocked' : 'failed-without-violation'; }
  });
  ok(blocked === 'blocked', 'CSP blocks a request to another site (got ' + blocked + ')');
  await page.click('text=Delete everything now');   // reset the network counter after that deliberate probe

  // an unmarked, real-looking export is refused
  await page.setInputFiles('#pick', { name: 'export.xml', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-11-12 08:00:00 -0800" endDate="2026-11-12 09:00:00 -0800" value="100"/></HealthData>') });
  await page.click('#go');
  await page.waitForSelector('.err', { timeout: 20000 });
  ok(/was refused/.test(await page.locator('.err').first().innerText()), 'unmarked file refused');
  ok(!(await page.locator('#codes input').count()), 'nothing parsed from a refused file');
  await page.click('text=Delete everything now');

  // synthetic files from disk: read and analyzed with zero requests afterwards
  const files = ['ben-apple-health-export.zip', 'ben-blood-pressure-cuff.csv', 'ben-clinical-records.json'].map(f => path.join(ROOT, 'health-lab/samples', f));
  await page.setInputFiles('#pick', files);
  const mark = reqs.length;
  await page.click('#go');
  await page.waitForSelector('text=What was found', { timeout: 60000 });
  await page.click('text=Analyze on this device');
  await page.waitForSelector('text=Data inventory and confidence', { timeout: 60000 });
  await page.waitForTimeout(300);
  const after = reqs.slice(mark);
  ok(after.length === 0, 'zero network requests after choosing files (got ' + after.join(', ') + ')');
  ok((await page.locator('#netcount').innerText()) === '0', 'page counter shows 0');
  ok(/processed on this device/.test(await page.locator('#st-mode').innerText()), 'status says processed on this device');
  ok(await page.locator('text=Worth discussing').count() > 0, 'Ben\'s blood-pressure signal shown');
  ok(await page.locator('text=needs review').count() > 0, 'medication needs review shown');
  await page.click('text=Delete everything now');
  ok(!(await page.locator('text=Data inventory and confidence').count()), 'Delete clears the results');
  ok(errors.length === 0, 'private page: no JS errors: ' + errors.join('; '));
  await ctx.close();

  // ------------------------------------------------------------ 2. Explorer views
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c2.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p2 = await c2.newPage();
  const e2 = [];
  p2.on('pageerror', e => e2.push(e.message));
  const views = await (async () => { await p2.goto(BASE + '/health-lab/', { waitUntil: 'load' }); await p2.waitForFunction(() => window.HL && HL.meta); return p2.evaluate(() => HL.VIEWS.map(v => v[0])); })();
  for (const pid of 'abcde') {
    for (const v of views) {
      await p2.evaluate(([v, pid]) => { location.hash = '#/' + v + '/' + pid; }, [v, pid]);
      await p2.waitForTimeout(120);
      const t = await p2.locator('#view').innerText();
      ok(!/went wrong/.test(t) && t.length > 40, `view ${v} for ${pid} renders`);
    }
  }
  ok(e2.length === 0, 'Explorer: no JS errors: ' + e2.join('; '));
  await c2.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`${failures ? '✗' : '✓'} health-lab browser tests: ${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
