// Render every scene SVG in invisible-engine/scenes/ to a still PNG.
//   IE_DEPS=/path/with/node_modules node scripts/invisible_engine/render.mjs [s01 s02 …]
// Needs playwright (as in the accessibility workflow). The SVGs are the source;
// the PNGs in scenes/png/ are GENERATED — never edit them.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(process.env.IE_DEPS || process.cwd(), 'noop.js'));
const { chromium } = req('playwright');
const DIR = path.join(ROOT, 'invisible-engine', 'scenes');
const OUT = path.join(DIR, 'png');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
// --frames sNN …: render each frame state (frames 1..k shown) to os.tmpdir()/ie-frames
// for scripts/invisible_engine/gif.py to assemble into invisible-engine/scenes/gif/sNN.gif.
const FRAMES = args.includes('--frames');
const only = args.filter((a) => !a.startsWith('--'));
const files = fs.readdirSync(DIR).filter((f) => /^s\d\d\.svg$/.test(f) && (!only.length || only.includes(f.slice(0, 3))));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
if (args.includes('--synopsis')) {
  // the one-page synopsis → invisible-engine/synopsis.pdf (A4 landscape, one page)
  await page.goto('file://' + path.join(ROOT, 'invisible-engine', 'synopsis.html'));
  await page.pdf({ path: path.join(ROOT, 'invisible-engine', 'synopsis.pdf'), format: 'A4', landscape: true, printBackground: true });
  console.log('rendered synopsis.pdf');
  await browser.close();
  process.exit(0);
}
if (FRAMES) {
  const os = await import('node:os');
  const tmp = path.join(os.tmpdir(), 'ie-frames');
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of files) {
    const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
    const n = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('[data-f]')].map((g) => +g.getAttribute('data-f'))));
    for (let k = 1; k <= n; k++) {
      await page.evaluate((k) => document.querySelectorAll('[data-f]').forEach((g) => { g.style.visibility = +g.getAttribute('data-f') > k ? 'hidden' : 'visible'; }), k);
      await page.locator('svg').first().screenshot({ path: path.join(tmp, `${f.slice(0, 3)}-${k}.png`) });
    }
    console.log('frames', f, n);
  }
  await browser.close();
  process.exit(0);
}
for (const f of files) {
  const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
  await page.locator('svg').first().screenshot({ path: path.join(OUT, f.replace('.svg', '.png')) });
  console.log('rendered', f);
}
if (!only.length || only.includes('cover')) {
  // The Read page's cover: rendered to PNG here, then encoded to WebP by
  //   python3 -c "from PIL import Image; Image.open('invisible-engine/art/cover.png').save('invisible-engine/art/cover.webp', quality=86)"
  await page.setViewportSize({ width: 1600, height: 800 });
  const svg = fs.readFileSync(path.join(ROOT, 'invisible-engine', 'art', 'cover.svg'), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await page.locator('svg').first().screenshot({ path: path.join(ROOT, 'invisible-engine', 'art', 'cover.png') });
  console.log('rendered cover.svg');
}
await browser.close();
