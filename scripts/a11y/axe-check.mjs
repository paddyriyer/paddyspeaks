#!/usr/bin/env node
/**
 * Automated accessibility check (P0.8): axe-core in headless Chromium.
 *
 *   A11Y_DEPS=/path/with/node_modules node scripts/a11y/axe-check.mjs            # check
 *   A11Y_DEPS=… node scripts/a11y/axe-check.mjs --update-baseline                # record today
 *
 * Needs `playwright` and `axe-core` resolvable from $A11Y_DEPS (CI installs
 * them into a temp dir; nothing is added to the repo). Serves the repo root on
 * a local port, blocks every third-party request, and runs WCAG 2.0/2.1/2.2
 * A + AA rules on the pages in PAGES at desktop and phone widths.
 *
 * It is a RATCHET, not a gate on history: scripts/a11y/baseline.json records
 * the serious/critical violations each legacy page has today. The build fails
 * when a page gets WORSE (a new rule, or more nodes for a rule), and platform
 * pages (STRICT) must have none at all. Automated checks catch perhaps a third
 * of real barriers — docs/ACCESSIBILITY.md has the manual keyboard pass.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
const { chromium } = req('playwright');
const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const BASELINE = path.join(ROOT, 'scripts', 'a11y', 'baseline.json');

// Pages the platform owns outright: zero serious/critical violations allowed.
const STRICT = ['/corrections/', '/privacy-policy/', '/terms/', '/disclaimer/', '/copyright/',
  '/changelog/', '/subscribe/', '/atlas/', '/about.html'];
// One representative page per journey, ratcheted against the baseline.
const LEGACY = ['/', '/contact/', '/privacy/', '/bhagavad-gita/', '/abhirami-andhadhi/',
  '/interview.app/', '/interview.app/evaluate/', '/jobs/', '/jobs/search/?q=data%20engineer',
  '/articles/the-job-posting-is-not-the-job.html', '/ai-command-center/'];
const WIDTHS = [1280, 390];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.xml': 'application/xml', '.woff2': 'font/woff2' };
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found'); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

async function audit(browser, base, url, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route((u) => !u.href.startsWith(base), (r) => r.abort());
  await page.goto(base + url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
      sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
  }, TAGS);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
  return { violations: res.filter((v) => v.impact === 'serious' || v.impact === 'critical'), overflow };
}

const update = process.argv.includes('--update-baseline');
const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const next = {};
// A STRICT entry is a directory page (/atlas/ → atlas/index.html) or a file page (/about.html).
const pages = [...STRICT.filter((u) => fs.existsSync(path.join(ROOT, u.endsWith('.html') ? u : path.join(u, 'index.html')))), ...LEGACY];

for (const url of pages) {
  for (const w of WIDTHS) {
    const key = `${url} @${w}`;
    const { violations, overflow } = await audit(browser, base, url, w);
    const counts = Object.fromEntries(violations.map((v) => [v.id, v.nodes]));
    next[key] = counts;
    const strict = STRICT.includes(url);
    const was = baseline[key] || {};
    for (const v of violations) {
      if (strict || !(v.id in was) || v.nodes > was[v.id]) {
        problems.push(`${key}: ${v.impact} ${v.id} ×${v.nodes}${strict ? '' : ` (baseline ${was[v.id] || 0})`} — ${v.help} — e.g. ${v.sample.join(' | ')}`);
      }
    }
    if (w <= 400 && overflow > 1) {
      const wasOver = (baseline[key] || {})['horizontal-overflow'];
      next[key]['horizontal-overflow'] = overflow;
      if (strict || wasOver === undefined || overflow > wasOver + 2) problems.push(`${key}: horizontal overflow ${overflow}px`);
    }
    console.log(`${strict ? 'strict' : 'ratchet'}  ${key}: ${violations.length ? violations.map((v) => `${v.id}×${v.nodes}`).join(', ') : 'clean'}${overflow > 1 ? `  overflow ${overflow}px` : ''}`);
  }
}
await browser.close();
server.close();

if (update) {
  const legacyOnly = Object.fromEntries(Object.entries(next).filter(([k]) => !STRICT.some((s) => k.startsWith(s + ' '))));
  fs.writeFileSync(BASELINE, JSON.stringify(legacyOnly, null, 2) + '\n');
  console.log(`baseline written: ${BASELINE}`);
  process.exit(0);
}
if (problems.length) {
  console.log(`\n✗ ${problems.length} accessibility regression(s):`);
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('\n✓ no accessibility regressions');
