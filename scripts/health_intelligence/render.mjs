// Render the ten slides in slides.html into
//   images/articles/apple-watch-actionable-health-intelligence/slide-NN.jpg      (1920x1080, 16:9)
//   images/articles/apple-watch-actionable-health-intelligence/slide-NN-4x5.jpg  (1080x1350, LinkedIn)
//   images/articles/apple-watch-actionable-health-intelligence/share-card.png    (1200x630)
//   images/articles/apple-watch-actionable-health-intelligence/slide-NN-{1280,800}.webp (article)
//   articles/apple-watch-actionable-health-intelligence/deck.pdf                              (16:9 deck)
// Needs Playwright (preinstalled in the cloud container) and network access to
// Google Fonts. Usage: node scripts/health_intelligence/render.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = 'file://' + path.join(here, 'slides.html');
const img = path.join(root, 'images/articles/apple-watch-actionable-health-intelligence');
const deck = path.join(root, 'articles/apple-watch-actionable-health-intelligence/deck.pdf');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slides-'));

// CommonJS resolution honours NODE_PATH, where the container keeps Playwright.
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
for (const [mode, w, h] of [['16x9', 1920, 1080], ['4x5', 1080, 1350]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(src, { waitUntil: 'networkidle' });
  if (mode === '4x5') await page.evaluate(() => document.body.classList.add('portrait'));
  await page.evaluate(() => document.fonts.ready);
  for (let i = 1; i <= 10; i++) {
    const n = String(i).padStart(2, '0');
    const out = path.join(tmp, mode === '16x9' ? `slide-${n}.png` : `slide-${n}-4x5.png`);
    await page.locator(`#s${i}`).screenshot({ path: out });
  }
  if (mode === '16x9') await page.pdf({ path: deck, width: '1920px', height: '1080px', printBackground: true });
  await page.close();
}
await browser.close();
// JPEG exports, WebP for the article and the share card (Pillow)
execFileSync('python3', ['-I', '-c', `
import sys, os
from PIL import Image
t, d = sys.argv[1], sys.argv[2]
for i in range(1, 11):
    n = f"{i:02d}"
    im = Image.open(os.path.join(t, f"slide-{n}.png")).convert("RGB")
    im.save(os.path.join(d, f"slide-{n}.jpg"), "JPEG", quality=92, subsampling=0, optimize=True)
    Image.open(os.path.join(t, f"slide-{n}-4x5.png")).convert("RGB").save(os.path.join(d, f"slide-{n}-4x5.jpg"), "JPEG", quality=92, subsampling=0, optimize=True)
    for w in (1280, 800):
        im.resize((w, round(w * im.height / im.width)), Image.LANCZOS).save(os.path.join(d, f"slide-{n}-{w}.webp"), "WEBP", quality=86, method=6)
    if i == 1:
        card = Image.new("RGB", (1200, 630), (7, 12, 26))
        card.paste(im.resize((1120, 630), Image.LANCZOS), (40, 0))
        card.save(os.path.join(d, "share-card.png"), optimize=True)
`, tmp, img]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('rendered 10 slides (16:9 and 4:5 JPEG, WebP), share card and deck.pdf');
