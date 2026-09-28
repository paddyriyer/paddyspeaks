/**
 * Render the essay's printable edition to PDF with headless Chromium, using
 * the page's own print stylesheet (the same one a reader gets from Print).
 * Page numbers, title, edition and date come from the CSS @page margin boxes.
 *
 * Needs `playwright` resolvable from $EA_DEPS (nothing is added to the repo):
 *   mkdir -p /tmp/ea && cd /tmp/ea && npm i playwright@1.56.1 pdfjs-dist@4
 *   EA_DEPS=/tmp/ea node scripts/every_arrow/build.mjs --pdf
 * Set CHROMIUM_PATH to use a pre-installed Chromium.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

export function serve(root) {
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found'); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

export function deps() {
  const req = createRequire(path.join(process.env.EA_DEPS || process.cwd(), 'noop.js'));
  return { chromium: req('playwright').chromium, req };
}

export async function launch() {
  const { chromium } = deps();
  const opts = {};
  const guess = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  else if (fs.existsSync(guess)) opts.executablePath = guess;
  return chromium.launch(opts);
}

export async function renderPdf(root, out) {
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  try {
    const page = await browser.newPage();
    /* first-party files and the Google Fonts the page names; nothing else */
    await page.route((u) => !(u.href.startsWith(base) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u.href)), (r) => r.abort());
    await page.emulateMedia({ media: 'print' });
    await page.goto(base + '/articles/every-arrow-is-a-decision.html?path=full', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
    await page.pdf({ path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  } finally {
    await browser.close();
    server.close();
  }
  return countPages(out);
}

export async function pdfText(file) {
  const { req } = deps();
  const pdfjs = await import(req.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const t = await (await doc.getPage(i)).getTextContent();
    pages.push(t.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  return pages;
}

export async function countPages(file) {
  const s = fs.readFileSync(file, 'latin1');
  const m = s.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}
