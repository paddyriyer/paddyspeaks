/**
 * The editable copy of the Lalitā chanting and learning book (Word .docx): the
 * same units, in the same order and layout as edition/index.html —
 * Sanskrit (large, words spaced) · IAST · the names separated · translation ·
 * word by word · the names. Built from the same JSON.
 * Needs the `docx` package resolvable from $EA_DEPS (nothing is added to the repo).
 * Devanagari is set in the complex-script font (Nirmala UI on Windows and Office
 * for Mac; Word substitutes another Devanagari font elsewhere).
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { iast2dev } from './translit.mjs';

export async function renderDocx({ T, NAMES, LOG, BATCHES, PRELIM, R, out }) {
  const req = createRequire(path.join(process.env.EA_DEPS || process.cwd(), 'noop.js'));
  const d = req('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak, BorderStyle, ShadingType } = d;
  const FONT = { ascii: 'Cambria', hAnsi: 'Cambria', cs: 'Nirmala UI', eastAsia: 'Cambria' };
  const MAROON = '7B1E1E', GOLD = 'A87A2E', SOFT = '6A5242';
  const byNum = new Map(NAMES.map((n) => [n.num, n]));
  const devNum = (n) => String(n).replace(/\d/g, (x) => '०१२३४५६७८९'[x]);

  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, ...o });
  const P = (children, o = {}) => new Paragraph({ children, spacing: { after: 80 }, ...o });
  const dev = (t, size = 34, o = {}) => run(t, { size, ...o });          // half-points
  const iast = (t, o = {}) => run(t, { italics: true, color: SOFT, size: 25, ...o });
  const label = (t) => P([run(t.toUpperCase(), { size: 16, bold: true, color: GOLD, characterSpacing: 20 })], { spacing: { before: 260, after: 80 }, keepNext: true });
  const lines = (arr, mk) => arr.flatMap((t, i) => (i ? [run('', { break: 1 }), mk(t)] : [mk(t)]));
  const thin = { style: BorderStyle.SINGLE, size: 2, color: 'E3D3B4' };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  function wordTable(groups) {
    const rows = [new TableRow({ tableHeader: true, children: ['Sanskrit', 'English'].map((h, i) => new TableCell({ width: { size: i ? 64 : 36, type: WidthType.PERCENTAGE }, children: [P([run(h.toUpperCase(), { size: 15, bold: true, color: SOFT })])] })) })];
    for (const g of groups) {
      if (g.head) rows.push(new TableRow({ cantSplit: true, children: [new TableCell({ columnSpan: 2, children: [P(g.head, { spacing: { before: 120, after: 40 } })] })] }));
      for (const r of g.rows) {
        rows.push(new TableRow({ cantSplit: true, children: [
          new TableCell({ width: { size: 36, type: WidthType.PERCENTAGE }, children: [P([dev(r.dev || iast2dev(r.iast.replace(/-/g, '')), 30), run('', { break: 1 }), iast(r.iast, { size: 21 })], { spacing: { after: 40 } })] }),
          new TableCell({ width: { size: 64, type: WidthType.PERCENTAGE }, children: [P([run(r.meaning, { size: 23 }), ...(r.note ? [run('', { break: 1 }), run(r.note, { size: 19, color: SOFT })] : [])], { spacing: { after: 40 } })] }),
        ] }));
      }
    }
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin, insideHorizontal: thin, insideVertical: noBorder }, rows });
  }
  const canonBox = (devLines, iastLines) => [
    P(lines(devLines, (t) => dev(t, 38)), { shading: { type: ShadingType.CLEAR, fill: 'FAF4E8', color: 'auto' }, spacing: { before: 120, after: 60, line: 360 }, keepNext: true, keepLines: true, border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 8 } } }),
    P(lines(iastLines, (t) => iast(t)), { shading: { type: ShadingType.CLEAR, fill: 'FAF4E8', color: 'auto' }, spacing: { after: 160 }, keepLines: true, border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 8 } } }),
  ];
  const unitHead = (lab, num, right) => P([run(lab.toUpperCase() + '  ', { size: 16, color: SOFT, characterSpacing: 30 }), run(String(num), { size: 34, bold: true, color: MAROON }), ...(right ? [run('    ' + right, { size: 18, color: SOFT })] : [])], { spacing: { before: 200, after: 160 }, keepNext: true, border: { top: { style: BorderStyle.SINGLE, size: 12, color: MAROON, space: 6 } }, pageBreakBefore: true });

  const body = [];
  body.push(P([dev('॥ श्रीः ॥', 28, { color: GOLD })], { alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 } }));
  body.push(P([dev('श्रीललितासहस्रनामस्तोत्रम्', 48, { color: MAROON, bold: true })], { alignment: AlignmentType.CENTER }));
  body.push(P([run('Śrī Lalitā Sahasranāma', { size: 40, bold: true, color: MAROON })], { alignment: AlignmentType.CENTER }));
  body.push(P([run('A chanting and learning edition: every śloka in readable Devanagari and IAST, every name separated and explained word by word', { size: 24 })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } }));
  body.push(P([iast(T.source, { size: 21 })], { alignment: AlignmentType.CENTER }));
  body.push(P([iast(`Edition ${T.edition.version} · ${T.edition.date} · PaddySpeaks · editable copy of the PDF`, { size: 21 })], { alignment: AlignmentType.CENTER }));

  body.push(new Paragraph({ text: 'How to read this book', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  for (const t of [
    'Every unit — the nyāsa, each dhyāna śloka and each of the 183 ślokas — is set out the same way: the Sanskrit as recited, with a space wherever one word or name ends and the next begins without any letter changing; its IAST; the names (or words) separated, numbered, with light hyphens at the joints of a compound; the translation; a word-by-word table; and, for the names, their meaning, sandhi, compound and significance.',
    'A name marked ° has a different form in the recitation because of sandhi (भद्रमूर्तिः on its own, भद्रमूर्तिर् before भक्त…). Four times two names melt into one sound and stay joined in the recitation: 270/271, 593/594, 711/712 (साध्वी) and 984/985.',
    'The names are counted as Bhāskararāya counts them (tat · tvam · ayī, sādhu · ī, brahma · jananī, dharā · dharasutā). Every correction to the text is listed in Appendix A.',
  ]) body.push(P([run(t, { size: 23 })], { spacing: { after: 140 } }));

  // nyāsa
  body.push(new Paragraph({ text: 'Nyāsa', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  const N = PRELIM.nyasa;
  body.push(...canonBox(N.map((l, i) => l.read.split(' ').map((w) => iast2dev(w)).join(' ') + (i === N.length - 1 ? ' ॥' : ' ।')), N.map((l, i) => l.read + (i === N.length - 1 ? ' ||' : ' |'))));
  body.push(label('Words separated, compounds hyphenated'));
  body.push(P(lines(N.map((l) => l.learn.split(' ').map((w) => w.split('-').map(iast2dev).join('-')).join(' ')), (t) => dev(t, 34)), { spacing: { after: 60, line: 340 } }));
  body.push(P(lines(N.map((l) => l.learn), (t) => iast(t))));
  body.push(label('Translation'));
  body.push(P([run(N.map((l) => l.translation).join(' '), { size: 23 })]));
  body.push(label('Word by word'));
  body.push(wordTable(N.map((l, i) => ({ head: [run(`${i + 1}  `, { bold: true, color: MAROON, size: 20 }), dev(l.read.split(' ').map((w) => iast2dev(w)).join(' '), 30, { color: MAROON })], rows: l.words }))));

  // dhyāna
  body.push(new Paragraph({ text: 'Dhyāna ślokas', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  for (const dh of PRELIM.dhyana) {
    const ends = dh.lines.map((_, i) => (i === dh.lines.length - 1 ? ' ॥' : (dh.lines.length === 4 && i % 2 === 0 ? '' : ' ।')));
    const endsI = ends.map((e) => e.replace('॥', '||').replace('।', '|'));
    body.push(unitHead('Dhyāna', dh.num, `metre: ${dh.metre}`));
    body.push(...canonBox(dh.lines.map((l, i) => l.read.split(' ').map((w) => iast2dev(w.replace(/-$/, '')) + (w.endsWith('-') ? '-' : '')).join(' ') + ends[i]), dh.lines.map((l, i) => l.read + endsI[i])));
    body.push(label('Words separated, compounds hyphenated'));
    body.push(P(lines(dh.lines.map((l) => l.learn.split(' ').map((w) => w.split('-').map((x) => (x ? iast2dev(x) : '')).join('-')).join(' ')), (t) => dev(t, 34)), { spacing: { after: 60, line: 340 } }));
    body.push(P(lines(dh.lines.map((l) => l.learn), (t) => iast(t))));
    body.push(label('Translation'));
    body.push(P([run(dh.translation, { size: 23 })]));
    body.push(label('Word by word'));
    body.push(wordTable([{ head: null, rows: dh.words }]));
  }

  // recitation
  body.push(new Paragraph({ text: 'Śrī Lalitā Sahasranāma Stotram — for recitation', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  for (const v of T.verses) {
    const rr = R[v.num];
    body.push(P([run(`${v.num}   `, { bold: true, color: MAROON, size: 20 }), ...lines(rr.map((r, i) => r.canonical.map((g) => g.dev).join(' ') + (i === 0 ? ' ।' : ` ॥ ${devNum(v.num)} ॥`)), (t) => dev(t, 32))], { keepNext: true, keepLines: true, spacing: { after: 40, line: 330 } }));
    body.push(P(lines(rr.map((r) => r.canonical.map((g) => g.iast).join(' ')), (t) => iast(t, { size: 22 })), { spacing: { after: 200 }, keepLines: true }));
  }

  // the names
  body.push(new Paragraph({ text: 'The 1,000 names, śloka by śloka', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  for (const v of T.verses) {
    const rr = R[v.num];
    body.push(unitHead('Śloka', v.num, `names ${v.names[0]}${v.names.length > 1 ? '–' + v.names.at(-1) : ''}`));
    body.push(...canonBox(rr.map((r, i) => r.canonical.map((g) => g.dev).join(' ') + (i === 0 ? ' ।' : ` ॥ ${devNum(v.num)} ॥`)), rr.map((r, i) => r.canonical.map((g) => g.iast).join(' ') + (i === 0 ? ' |' : ` || ${v.num} ||`))));
    body.push(label('The names, separated' + (rr.some((r) => r.learning.some((l) => l.restored)) ? '   (° form as a name on its own)' : '')));
    for (const r of rr) {
      if (r.closing) { body.push(P([dev(r.canonical.map((g) => g.dev).join(' '), 30, { color: SOFT }), run('   — the closing line; no name', { size: 19, color: SOFT })])); continue; }
      body.push(P(r.learning.flatMap((l, i) => [...(i ? [run('     ')] : []), run(`${l.num} `, { bold: true, color: MAROON, size: 18 }), dev(l.iast.split('-').map(iast2dev).join('-') + (l.restored ? '°' : ''), 34)]), { spacing: { after: 20, line: 340 }, keepNext: true }));
      body.push(P(r.learning.flatMap((l, i) => [...(i ? [run('     ')] : []), run(`${l.num} `, { size: 16, color: SOFT }), iast(l.iast)]), { spacing: { after: 120 } }));
    }
    body.push(label('Translation'));
    v.halves.forEach((half, i) => {
      if (half.closing) { body.push(P([run('Thus the goddesses of speech sang the thousand names of Śrī Lalitā Devī.', { size: 23 })])); return; }
      body.push(P(half.names.flatMap((k, j) => [...(j ? [run('; ', { size: 23 })] : []), run(String(k), { superScript: true, bold: true, color: MAROON, size: 23 }), run(byNum.get(k).a?.meaning || '', { size: 23 })]).concat([run(i === v.halves.length - 1 ? '.' : ';', { size: 23 })])));
    });
    body.push(label('Word by word'));
    body.push(wordTable(v.names.map((k) => { const n = byNum.get(k); return { head: [run(`${k}  `, { bold: true, color: MAROON, size: 20 }), dev(n.dev, 30, { color: MAROON }), run('  '), iast(n.a?.iast || n.iast, { size: 21 })], rows: (n.a?.components || []).map((c) => ({ dev: c.dev, iast: c.iast, meaning: c.meaning, note: c.note })) }; })));
    body.push(label('The names'));
    for (const k of v.names) {
      const n = byNum.get(k); const a = n.a || {};
      body.push(P([run(`${k}  `, { bold: true, color: 'FFFFFF', shading: { type: ShadingType.CLEAR, fill: MAROON, color: 'auto' }, size: 20 }), run('  '), dev(n.dev, 32, { color: MAROON }), run('   '), iast(a.iast || n.iast)], { spacing: { before: 200, after: 60 }, keepNext: true, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DCC9A6', space: 6 } } }));
      body.push(P([run(a.meaning, { bold: true, size: 24 })], { keepNext: true }));
      const sandhi = (a.sandhi || []).length ? a.sandhi.map((s) => `${s.surface} = ${s.split}${s.split_iast ? ` (${s.split_iast})` : ''} — ${s.rule}`).join('; ') : 'none inside the name; the parts stand as written';
      body.push(P([run('SANDHI  ', { size: 16, bold: true, color: SOFT }), run(sandhi, { size: 22 })]));
      if (a.samasa) {
        body.push(P([run('COMPOUND  ', { size: 16, bold: true, color: SOFT }), run(a.samasa.type + '. ', { bold: true, size: 22 }), run(a.samasa.explanation, { size: 22 })]));
        body.push(P([run('ANALYSIS  ', { size: 16, bold: true, color: SOFT }), dev(a.samasa.vigraha, 26), ...(a.samasa.vigraha_iast ? [run('', { break: 1 }), iast(a.samasa.vigraha_iast, { size: 21 })] : [])]));
      } else body.push(P([run('COMPOUND  ', { size: 16, bold: true, color: SOFT }), run('not a compound', { italics: true, size: 22, color: SOFT })]));
      body.push(P([run('SIGNIFICANCE  ', { size: 16, bold: true, color: SOFT }), run(a.significance, { size: 22 })]));
      if (a.uncertain) body.push(P([run('UNCERTAIN  ', { size: 16, bold: true, color: '8A5A00' }), run(a.uncertain, { size: 21, color: '8A5A00' })]));
      if (a.variants) body.push(P([run('VARIANTS  ', { size: 16, bold: true, color: '31546E' }), run(a.variants, { size: 21, color: '31546E' })]));
      const corr = LOG.names.find((c) => c.name === k);
      if (corr) body.push(P([run('CORRECTED  ', { size: 16, bold: true, color: '3D6B35' }), run(`${corr.original_dev} → ${corr.corrected_dev}. ${corr.reason}`, { size: 21, color: '3D6B35' })]));
    }
  }

  body.push(new Paragraph({ text: 'Colophon', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(P([dev(T.closing[0].dev, 30)])); body.push(P([iast(T.closing[0].iast)])); body.push(P([run(T.closing[0].translation, { size: 23 })]));

  const plainTable = (head, rows, widths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: thin, bottom: thin, left: noBorder, right: noBorder, insideHorizontal: thin, insideVertical: noBorder },
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => new TableCell({ width: { size: widths[i], type: WidthType.PERCENTAGE }, children: [P([run(h, { bold: true, size: 17, color: SOFT })])] })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.PERCENTAGE }, children: [P([run(c, { size: 19 })])] })) }))] });
  body.push(new Paragraph({ text: 'Appendix A — Correction log', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(plainTable(['Name', 'Original → corrected', 'Kind and reason'], LOG.names.map((c) => [String(c.name), `${c.original_dev} (${c.original_iast}) → ${c.corrected_dev} (${c.corrected_iast})`, `${c.kind}. ${c.reason}`]), [8, 40, 52]));
  body.push(P([run('')]));
  body.push(plainTable(['Where', 'Original', 'Corrected', 'Reason'], LOG.structure.map((c) => [c.where, c.original, c.corrected, c.reason]), [14, 24, 24, 38]));
  body.push(new Paragraph({ text: 'Appendix B — Variants and open questions', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(plainTable(['Name', 'Adopted', 'Variant', 'Note'], LOG.variants.map((v) => [String(v.name || v.where), v.adopted, v.variant, v.note]), [9, 22, 22, 47]));
  for (const n of NAMES.filter((x) => x.a && x.a.uncertain)) body.push(P([run(`${n.num} ${n.dev} — `, { bold: true, size: 20 }), run(n.a.uncertain, { size: 20 })]));
  body.push(new Paragraph({ text: 'Appendix C — Batch consistency reports', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  for (const b of BATCHES) body.push(P([run(`Batch ${b.batch} (ślokas ${(b.slokas || []).join('–')}): `, { bold: true, size: 20 }), run(b.report?.summary || '', { size: 20 })]));

  const doc = new Document({
    creator: 'PaddySpeaks', title: 'Śrī Lalitā Sahasranāma — a chanting and learning edition',
    styles: { default: { document: { run: { font: FONT, size: 23 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 36, bold: true, color: MAROON }, paragraph: { spacing: { before: 240, after: 200 }, keepNext: true } },
      ] },
    sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1152, right: 1152 } } }, children: body }],
  });
  fs.writeFileSync(out, await Packer.toBuffer(doc));
}
