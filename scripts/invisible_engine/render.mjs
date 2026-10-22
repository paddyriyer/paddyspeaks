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
const args = process.argv.slice(2);
// --v: the phone-vertical twins in scenes/v/ → scenes/v/png/ at 1080 px wide.
// --lint: print overlapping or clipped text instead of rendering (works with --v, where it
// also flags text under 19.5 px: too small on a phone).
const V = args.includes('--v');
const LINT = args.includes('--lint');
const DIR = path.join(ROOT, 'invisible-engine', 'scenes', ...(V ? ['v'] : []));
const OUT = path.join(DIR, 'png');
fs.mkdirSync(OUT, { recursive: true });
// --frames sNN …: render each frame state (frames 1..k shown) to os.tmpdir()/ie-frames
// for scripts/invisible_engine/gif.py to assemble into invisible-engine/scenes/gif/sNN.gif.
const FRAMES = args.includes('--frames');
const only = args.filter((a) => !a.startsWith('--'));
const files = fs.readdirSync(DIR).filter((f) => /^s\d\d\.svg$/.test(f) && (!only.length || only.includes(f.slice(0, 3))));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage(V ? { viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1.5 } : { viewport: { width: 1600, height: 900 } });
if (LINT) {
  let bad = 0;
  for (const f of files) {
    const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
    const issues = await page.evaluate(() => {
      const root = document.querySelector('svg');
      const vb = root.viewBox.baseVal, R = root.getBoundingClientRect(), k = vb.width / R.width;
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - R.left) * k, y: (r.top - R.top) * k, w: r.width * k, h: r.height * k }; };
      const texts = [...root.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({ t: t.textContent.trim().slice(0, 40), b: box(t) }));
      const out = [];
      if (vb.width === 720) for (const t of root.querySelectorAll('text')) {
        const fs = parseFloat(getComputedStyle(t).fontSize);
        const stepBadge = /^\d+$/.test(t.textContent.trim()) && getComputedStyle(t).fill === 'rgb(255, 255, 255)';
        if (t.textContent.trim() && !stepBadge && fs < 19.5) out.push(`small (${fs}px): "${t.textContent.trim().slice(0, 40)}"`);
      }
      for (const { t, b } of texts) if (b.x < 4 || b.y < 4 || b.x + b.w > vb.width - 4 || b.y + b.h > vb.height - 4) out.push(`clipped: "${t}"`);
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].b, c = texts[j].b;
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ox > 3 && oy > 4) out.push(`overlap: "${texts[i].t}" × "${texts[j].t}"`);
      }
      return out;
    });
    for (const i of issues) console.log(`${f}: ${i}`);
    bad += issues.length;
  }
  console.log(bad ? `${bad} text issue(s)` : `no text issues in ${files.length} scene(s)`);
  await browser.close();
  process.exit(0);
}
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
  if (V) {
    const vb = await page.evaluate(() => document.querySelector('svg').viewBox.baseVal.height);
    await page.setViewportSize({ width: 720, height: Math.ceil(vb) });
  }
  await page.locator('svg').first().screenshot({ path: path.join(OUT, f.replace('.svg', '.png')) });
  console.log('rendered', f);
}
if (!V && (!only.length || only.includes('cover'))) {
  // The Read page's cover: rendered to PNG here, then encoded to WebP by
  //   python3 -c "from PIL import Image; Image.open('invisible-engine/art/cover.png').save('invisible-engine/art/cover.webp', quality=86)"
  await page.setViewportSize({ width: 1600, height: 800 });
  const svg = fs.readFileSync(path.join(ROOT, 'invisible-engine', 'art', 'cover.svg'), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await page.locator('svg').first().screenshot({ path: path.join(ROOT, 'invisible-engine', 'art', 'cover.png') });
  console.log('rendered cover.svg');
}
await browser.close();
