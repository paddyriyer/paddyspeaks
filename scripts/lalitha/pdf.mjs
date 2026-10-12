/**
 * Render the Lalitā study edition (edition/index.html) to a print-ready PDF with
 * headless Chromium, using the page's own print stylesheet.
 *
 * Needs `playwright` resolvable from $EA_DEPS (the same convention as
 * scripts/every_arrow/pdf.mjs; nothing is added to the repo).
 *
 * Fonts: the page names Google Fonts (Noto Serif Devanagari, Source Serif 4).
 * Where Google Fonts cannot be reached, set LALITHA_FONTS to a directory holding
 * the Fontsource packages, unpacked:
 *   npm pack @fontsource/noto-serif-devanagari @fontsource/source-serif-4
 *   (untar each; LALITHA_FONTS is the directory that contains them)
 * and the renderer serves those files in place of the Google ones.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { serve, launch } from '../every_arrow/pdf.mjs';

function localFontCss(dir) {
  const css = [];
  const files = new Map();
  for (const pkg of fs.readdirSync(dir)) {
    const base = path.join(dir, pkg, 'package');
    if (!fs.existsSync(base)) continue;
    for (const sheet of ['400.css', '600.css', '400-italic.css']) {
      const p = path.join(base, sheet);
      if (!fs.existsSync(p)) continue;
      css.push(fs.readFileSync(p, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, (m, f) => {
        files.set(f, path.join(base, 'files', f));
        return `url(https://fonts.gstatic.com/local/${f})`;
      }));
    }
  }
  return { css: css.join('\n'), files };
}

export async function renderPdf(root, out, url) {
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const fonts = process.env.LALITHA_FONTS ? localFontCss(process.env.LALITHA_FONTS) : null;
  try {
    const page = await browser.newPage();
    await page.route((u) => !(u.href.startsWith(base) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u.href)), (r) => r.abort());
    if (fonts) {
      await page.route(/^https:\/\/fonts\.googleapis\.com\//, (r) => r.fulfill({ contentType: 'text/css', body: fonts.css }));
      await page.route(/^https:\/\/fonts\.gstatic\.com\/local\//, (r) => {
        const f = fonts.files.get(r.request().url().split('/local/')[1]);
        if (!f) return r.abort();
        return r.fulfill({ contentType: f.endsWith('.woff2') ? 'font/woff2' : 'font/woff', body: fs.readFileSync(f) });
      });
    }
    await page.emulateMedia({ media: 'print' });
    await page.goto(base + url, { waitUntil: 'networkidle', timeout: 180000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const ok = await page.evaluate(() => document.fonts.check('16px "Noto Serif Devanagari"', 'श्री') && document.fonts.check('16px "Source Serif 4"', 'ṛṣṭ'));
    if (!ok) throw new Error('fonts did not load — set LALITHA_FONTS (see scripts/lalitha/pdf.mjs)');
    await page.pdf({
      path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font-size:8px;color:#7a5c48;text-align:center;font-family:serif">Śrī Lalitā Sahasranāma — Study Edition · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '0.7in', bottom: '0.75in', left: '0.8in', right: '0.8in' },
      timeout: 0,
    });
  } finally {
    await browser.close();
    server.close();
  }
  /* Chromium writes every object uncompressed-in-place; packing them into object
     streams halves the file. Optional: needs `pip install pikepdf`. */
  const py = 'import pikepdf,sys\np=pikepdf.open(sys.argv[1],allow_overwriting_input=True)\n'
    + 'p.save(sys.argv[1],object_stream_mode=pikepdf.ObjectStreamMode.generate,compress_streams=True,recompress_flate=True)';
  const r = spawnSync('python3', ['-c', py, out], { encoding: 'utf8' });
  if (r.status !== 0) console.warn('  (pikepdf not available — PDF left uncompacted)');
  const buf = fs.readFileSync(out).toString('latin1');
  const pages = (buf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return pages || Number((spawnSync('pdfinfo', [out], { encoding: 'utf8' }).stdout.match(/Pages:\s+(\d+)/) || [])[1] || 0);
}
