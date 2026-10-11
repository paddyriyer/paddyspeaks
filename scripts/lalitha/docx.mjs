/**
 * The editable copy of the Lalitā study edition (Word .docx): the same Sanskrit,
 * transliteration, analysis and meanings as edition/index.html, from the same JSON.
 * Needs the `docx` package resolvable from $EA_DEPS (nothing is added to the repo).
 * Devanagari is set in the complex-script font (Nirmala UI, present on Windows and
 * Office for Mac; Word substitutes another Devanagari font elsewhere).
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

export async function renderDocx({ T, NAMES, LOG, BATCHES, out }) {
  const req = createRequire(path.join(process.env.EA_DEPS || process.cwd(), 'noop.js'));
  const d = req('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak, BorderStyle } = d;
  const FONT = { ascii: 'Cambria', hAnsi: 'Cambria', cs: 'Nirmala UI', eastAsia: 'Cambria' };
  const ACCENT = '7B1E1E';
  const SOFT = '6B5242';
  const byNum = new Map(NAMES.map((n) => [n.num, n]));

  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, ...o });
  const para = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [run(runs)], spacing: { after: 80 }, ...o });
  const label = (t) => run(t.toUpperCase() + '  ', { size: 16, color: SOFT, bold: true });
  const dev = (t, o = {}) => run(t, { size: 26, ...o });
  const it = (t, o = {}) => run(t, { italics: true, color: SOFT, ...o });
  const cell = (children, w) => new TableCell({ children: Array.isArray(children) ? children : [para(children)], width: { size: w, type: WidthType.PERCENTAGE } });
  const thin = { style: BorderStyle.SINGLE, size: 2, color: 'D9C7A6' };
  const table = (head, rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell([para([run(h, { bold: true, size: 18, color: SOFT })])], widths[i])) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) }))],
  });

  const body = [];
  body.push(para([dev('श्रीललितासहस्रनामस्तोत्रम्', { size: 44, color: ACCENT })], { alignment: AlignmentType.CENTER, spacing: { before: 1800, after: 200 } }));
  body.push(para([run('Śrī Lalitā Sahasranāma', { size: 40, bold: true, color: ACCENT })], { alignment: AlignmentType.CENTER }));
  body.push(para([run('A study edition: corrected text, word division, sandhi and samāsa analysis, and the meaning of every name', { size: 24 })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } }));
  body.push(para([it(T.source)], { alignment: AlignmentType.CENTER }));
  body.push(para([it(`Edition ${T.edition.version} · ${T.edition.date} · PaddySpeaks · editable copy (the PDF and web edition carry the same content)`)], { alignment: AlignmentType.CENTER }));
  body.push(new Paragraph({ children: [new PageBreak()] }));

  body.push(new Paragraph({ text: 'Nyāsa', heading: HeadingLevel.HEADING_1 }));
  body.push(para(T.nyasa.map((l, i) => dev(l.dev + (i < T.nyasa.length - 1 ? ' ।' : ' ॥'), { break: i ? 1 : 0 }))));
  body.push(para(T.nyasa.map((l, i) => it(l.iast, { break: i ? 1 : 0 }))));
  body.push(new Paragraph({ text: 'Dhyāna ślokas', heading: HeadingLevel.HEADING_1 }));
  for (const x of T.dhyana) {
    body.push(para([label(`Dhyāna ${x.num}`)]));
    body.push(para(x.lines.map((l, i) => dev(l.dev, { break: i ? 1 : 0 }))));
    body.push(para(x.lines.map((l, i) => it(l.iast, { break: i ? 1 : 0 }))));
    body.push(para(x.translation));
  }
  body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(new Paragraph({ text: 'Śrī Lalitā Sahasranāma Stotram — text for recitation', heading: HeadingLevel.HEADING_1 }));
  for (const v of T.verses) {
    body.push(para([run(`${v.num}  `, { bold: true, color: ACCENT }), ...v.halves.map((h, i) => dev(h.dev + (i === 0 ? ' ।' : ' ॥'), { break: i ? 1 : 0 }))], { keepLines: true }));
    body.push(para(v.halves.map((h, i) => it(h.iast, { break: i ? 1 : 0 })), { spacing: { after: 160 } }));
  }

  body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(new Paragraph({ text: 'Śloka-by-śloka analysis', heading: HeadingLevel.HEADING_1 }));
  for (const v of T.verses) {
    body.push(new Paragraph({ text: `Śloka ${v.num}`, heading: HeadingLevel.HEADING_2 }));
    body.push(para(v.halves.map((h, i) => dev(h.dev + (i === 0 ? ' ।' : ` ॥ ${v.num} ॥`), { break: i ? 1 : 0 }))));
    body.push(para(v.halves.map((h, i) => it(h.iast, { break: i ? 1 : 0 }))));
    body.push(para([label('Names'), run(v.names.map((k) => `${k} ${byNum.get(k).dev}`).join(' · '))]));
    for (const k of v.names) {
      const n = byNum.get(k); const a = n.a || {};
      body.push(new Paragraph({ children: [run(`${k}  `, { bold: true, color: ACCENT }), dev(n.dev, { color: ACCENT }), run('   '), it(a.iast || n.iast, { size: 24 })], heading: HeadingLevel.HEADING_3, keepNext: true }));
      const sandhi = (a.sandhi || []).length ? a.sandhi.map((s) => `${s.surface} → ${s.split}${s.split_iast ? ` (${s.split_iast})` : ''} — ${s.rule}`).join('\n') : 'No sound change inside the name.';
      body.push(para([label('Sandhi viccheda'), ...sandhi.split('\n').map((l, i) => run(l, { break: i ? 1 : 0 }))], { keepNext: true }));
      if (a.samasa) {
        body.push(para([label('Samāsa vigraha'), run(a.samasa.type, { bold: true }), run(' — '), run(a.samasa.vigraha), it(a.samasa.vigraha_iast ? ` (${a.samasa.vigraha_iast})` : '')], { keepNext: true }));
        body.push(para(a.samasa.explanation, { keepNext: true }));
      } else body.push(para([label('Samāsa vigraha'), it('Not a compound.')], { keepNext: true }));
      body.push(table(['Sanskrit component', 'IAST', 'Literal English meaning'], (a.components || []).map((c) => [[para([dev(c.dev)])], [para([it(c.iast)])], [para([run(c.meaning + (c.note ? ` — ${c.note}` : ''))])]]), [25, 25, 50]));
      body.push(para([label('Complete meaning'), run(a.meaning, { bold: true })], { spacing: { before: 100, after: 60 } }));
      body.push(para([label('Spiritual significance'), run(a.significance)]));
      if (a.uncertain) body.push(para([label('Uncertain'), run(a.uncertain, { color: '8A5A00' })]));
      if (a.variants) body.push(para([label('Variants'), run(a.variants, { color: '31546E' })]));
      const corr = LOG.names.find((c) => c.name === k);
      if (corr) body.push(para([label('Corrected in this edition'), run(`${corr.original_dev} → ${corr.corrected_dev}. ${corr.reason}`, { color: '3D6B35' })]));
    }
  }
  body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(new Paragraph({ text: 'Colophon', heading: HeadingLevel.HEADING_1 }));
  body.push(para([dev(T.closing[0].dev)])); body.push(para([it(T.closing[0].iast)])); body.push(para(T.closing[0].translation));

  body.push(new Paragraph({ text: 'Appendix A — Correction log', heading: HeadingLevel.HEADING_1 }));
  body.push(table(['Name', 'Original', 'Corrected', 'Kind', 'Reason'], LOG.names.map((c) => [String(c.name), `${c.original_dev} (${c.original_iast})`, `${c.corrected_dev} (${c.corrected_iast})`, c.kind, c.reason]), [7, 20, 20, 11, 42]));
  body.push(para(''));
  body.push(table(['Where', 'Original', 'Corrected', 'Kind', 'Reason'], LOG.structure.map((c) => [c.where, c.original, c.corrected, c.kind, c.reason]), [12, 20, 20, 11, 37]));
  body.push(new Paragraph({ text: 'Appendix B — Variants and open questions', heading: HeadingLevel.HEADING_1 }));
  body.push(table(['Name', 'Adopted', 'Variant', 'Note'], LOG.variants.map((v) => [String(v.name || v.where), v.adopted, v.variant, v.note]), [8, 22, 22, 48]));
  for (const n of NAMES.filter((x) => x.a && x.a.uncertain)) body.push(para([run(`${n.num} ${n.dev} — `, { bold: true }), run(n.a.uncertain)]));
  body.push(new Paragraph({ text: 'Appendix C — Batch consistency reports', heading: HeadingLevel.HEADING_1 }));
  for (const b of BATCHES) body.push(para([run(`Batch ${b.batch} (ślokas ${(b.slokas || []).join('–')}): `, { bold: true }), run(b.report?.summary || '')]));

  const doc = new Document({
    creator: 'PaddySpeaks', title: 'Śrī Lalitā Sahasranāma — Study Edition',
    styles: { default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 34, bold: true, color: ACCENT }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 28, bold: true, color: ACCENT }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true } },
      ] },
    sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1152, right: 1152 } } }, children: body }],
  });
  fs.writeFileSync(out, await Packer.toBuffer(doc));
}
