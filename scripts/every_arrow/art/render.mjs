/**
 * The artwork for Every Arrow Is a Decision, edition 4, rendered from art.html
 * (typography and the essay's own tokens — no photographs, no logos).
 *
 *   cd scripts/every_arrow/art
 *   npm i --no-save @fontsource/inter @fontsource/inter-tight @fontsource/jetbrains-mono
 *   EA_DEPS=/dir/with/playwright node render.mjs
 *
 * writes feature.png (544×980), share.png (1200×630) and hero.png (1600×900) here.
 * Then convert (Pillow): feature (transparent: the homepage frame shows through) → images/home/feature-every-arrow.webp (q90, keep alpha),
 * share → images/articles/every-arrow-is-a-decision/share-card.png,
 * hero → images/articles/every-arrow-is-a-decision/hero.jpg (q88). Don't commit
 * node_modules or the PNGs.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../pdf.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const b = await launch();
const jobs = [['feature', 544, 980, 'feature.png'], ['share', 1200, 630, 'share.png'], ['hero', 1600, 900, 'hero.png']];
for (const [m, w, h, out] of jobs) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`file://${HERE}/art.html?m=${m}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(HERE, out), clip: { x: 0, y: 0, width: w, height: h }, omitBackground: m === 'feature' });
  await p.close();
}
await b.close();
