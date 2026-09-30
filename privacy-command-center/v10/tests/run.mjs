#!/usr/bin/env node
/**
 * Privacy Command Center — behaviour tests (headless Chromium).
 *
 *   A11Y_DEPS=/path/with/node_modules node privacy-command-center/v10/tests/run.mjs [filter]
 *
 * Serves the repo root on a random local port, blocks third-party requests,
 * and runs every tests/*.test.mjs. Each test file exports an array of
 * { name, run(ctx) } where ctx gives:
 *   ctx.page(path, { width })  a fresh page at /privacy-command-center/v10/#/<path>,
 *                              with page errors collected in page.errors
 *   ctx.assert(cond, msg)      throws with msg when cond is false
 *   ctx.NS / ctx.P             nothing: tests read state through page.evaluate
 * Uses the same Playwright the accessibility workflow installs.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
const { chromium } = req('playwright');
const filter = process.argv[2] || '';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = {
  base: BASE,
  async page(route, opts = {}) {
    const c = await browser.newContext({ viewport: { width: opts.width || 1280, height: opts.height || 900 }, reducedMotion: opts.reducedMotion || 'no-preference' });
    await c.route('**/*', (rt) => (rt.request().url().startsWith(BASE) ? rt.continue() : rt.abort()));
    const p = await c.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    if (opts.storage) await p.addInitScript((s) => { for (const k in s) localStorage.setItem(k, s[k]); }, opts.storage);
    await p.goto(`${BASE}/privacy-command-center/v10/#/${route || 'overview'}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelector('#view') && document.querySelector('#view').children.length > 0);
    p.go = async (r) => { await p.evaluate((h) => { location.hash = '#/' + h; }, r); await p.waitForTimeout(120); };
    p.closeAll = () => c.close();
    return p;
  },
  assert(cond, msg) { if (!cond) throw new Error(msg); },
};

const files = fs.readdirSync(HERE).filter((f) => f.endsWith('.test.mjs')).sort();
let pass = 0, fail = 0;
for (const f of files) {
  const tests = (await import(pathToFileURL(path.join(HERE, f)).href)).default;
  for (const t of tests) {
    const name = `${f.replace('.test.mjs', '')} › ${t.name}`;
    if (filter && !name.includes(filter)) continue;
    try { await t.run(ctx); pass++; console.log(`  ✓ ${name}`); }
    catch (e) { fail++; console.log(`  ✗ ${name}\n      ${String(e.message || e).split('\n').join('\n      ')}`); }
  }
}
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
