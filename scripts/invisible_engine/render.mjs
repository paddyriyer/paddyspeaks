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
const only = process.argv.slice(2);
const files = fs.readdirSync(DIR).filter((f) => /^s\d\d\.svg$/.test(f) && (!only.length || only.includes(f.slice(0, 3))));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const f of files) {
  const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
  await page.locator('svg').first().screenshot({ path: path.join(OUT, f.replace('.svg', '.png')) });
  console.log('rendered', f);
}
await browser.close();
