/**
 * The Lalitā study edition as a chanting and learning book (edition/index.html,
 * and through it the PDF). One vertical layout for every unit — nyāsa, each
 * dhyāna śloka, each of the 183 ślokas:
 *
 *   ŚLOKA n
 *   Sanskrit, large, words spaced where no letter changes      (canonical)
 *   IAST, the same words
 *   The names separated, numbered, in their own forms           (learning; ° = restored from sandhi)
 *   Translation
 *   Word by word: Sanskrit | English
 *   The names: meaning, sandhi, samāsa, significance
 */
import { iast2dev, dev2iast } from './translit.mjs';
import { readerLines } from './reading.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DEV_DIGITS = '०१२३४५६७८९';
export const devNum = (n) => String(n).replace(/\d/g, (d) => DEV_DIGITS[d]);

/* a hyphenated IAST form -> Devanagari with soft reading hyphens */
const hyDev = (iast) => iast.split('-').map((p) => esc(iast2dev(p))).join('<span class="j">-</span>');
const hyIast = (iast) => iast.split('-').map(esc).join('<span class="j">-</span>');
/* a reading line: spaces between words, hyphens inside them */
const lineDev = (iast) => iast.split(' ').map(hyDev).join(' ');
const lineIast = (iast) => iast.split(' ').map(hyIast).join(' ');

/** Reader's lines for every half-śloka, with proofs collected in `problems`. */
export function readerData(T, byNumAnalysis, problems) {
  const out = {};
  for (const v of T.verses) {
    out[v.num] = v.halves.map((h) => {
      if (!h.names.length) {
        const words = h.iast.split(' ');
        return { canonical: words.map((w) => ({ iast: w, dev: iast2dev(w), names: [] })), learning: [], closing: true };
      }
      const r = readerLines(h, byNumAnalysis);
      const joined = r.canonical.map((g) => g.iast).join('');
      if (joined.replace(/ /g, '') !== h.iast.replace(/ /g, '')) problems.push(`śloka ${v.num}: reader line does not spell the text`);
      for (const g of r.canonical) if (dev2iast(g.dev) !== g.iast) problems.push(`śloka ${v.num}: ${g.dev} is not ${g.iast}`);
      return r;
    });
  }
  return out;
}

export function prelimProofs(T, P, problems) {
  const sq = (s) => s.replace(/[\s-]/g, '');
  T.nyasa.forEach((l, i) => {
    const p = P.nyasa[i];
    for (const k of ['read', 'learn']) if (sq(p[k]) !== sq(l.iast)) problems.push(`nyāsa line ${i + 1}: ${k} does not spell the text`);
  });
  T.dhyana.forEach((d, i) => d.lines.forEach((l, j) => {
    const p = P.dhyana[i].lines[j];
    for (const k of ['read', 'learn']) if (sq(p[k]) !== sq(l.iast)) problems.push(`dhyāna ${d.num} line ${j + 1}: ${k} does not spell the text`);
  }));
}

function wordTable(groups) {
  // groups: [{head: html|null, rows: [{iast, meaning, note}]}]
  let h = '<table class="wbw"><thead><tr><th scope="col">Sanskrit</th><th scope="col">English</th></tr></thead><tbody>';
  for (const g of groups) {
    if (g.head) h += `<tr class="grp"><th colspan="2" scope="rowgroup">${g.head}</th></tr>`;
    for (const r of g.rows) {
      const dev = r.dev || iast2dev(r.iast.replace(/-/g, ''));
      h += `<tr><td class="sk"><span class="d nw" lang="sa">${esc(dev)}</span><span class="i" lang="sa-Latn">${esc(r.iast)}</span></td>`
        + `<td class="en">${esc(r.meaning)}${r.note ? `<span class="note">${esc(r.note)}</span>` : ''}</td></tr>`;
    }
  }
  return h + '</tbody></table>';
}

function nameDetail(n, LOG) {
  const a = n.a || {};
  let h = `<article class="name" id="n-${n.num}"><h4 class="nh"><span class="nn">${n.num}</span> <span class="nd nw" lang="sa">${esc(n.dev)}</span> <span class="ni" lang="sa-Latn">${hyIast(a.iast || n.iast)}</span></h4>`;
  h += `<p class="mean">${esc(a.meaning)}</p>`;
  const s = a.sandhi || [];
  h += '<p class="row"><span class="k">Sandhi</span> ';
  h += s.length
    ? s.map((x) => `<span class="nw" lang="sa">${esc(x.surface)}</span> = <span class="nw" lang="sa">${esc(x.split)}</span>${x.split_iast ? ` <span class="i">(${esc(x.split_iast)})</span>` : ''} — ${esc(x.rule)}`).join('; ')
    : '<span class="none">none inside the name; the parts stand as written</span>';
  h += '</p>';
  if (a.samasa) {
    h += `<p class="row"><span class="k">Compound</span> <strong>${esc(a.samasa.type)}</strong>. ${esc(a.samasa.explanation)}</p>`;
    h += `<p class="row vig"><span class="k">Analysis</span> <span lang="sa">${esc(a.samasa.vigraha)}</span>${a.samasa.vigraha_iast ? `<br><span class="i" lang="sa-Latn">${esc(a.samasa.vigraha_iast)}</span>` : ''}</p>`;
  } else h += '<p class="row"><span class="k">Compound</span> <span class="none">not a compound</span></p>';
  h += `<p class="row"><span class="k">Significance</span> ${esc(a.significance)}</p>`;
  if (a.uncertain) h += `<p class="flag unc"><span class="k">Uncertain</span> ${esc(a.uncertain)}</p>`;
  if (a.variants) h += `<p class="flag var"><span class="k">Variants</span> ${esc(a.variants)}</p>`;
  const corr = (LOG.names || []).find((c) => c.name === n.num);
  if (corr) h += `<p class="flag cor"><span class="k">Corrected</span> <span lang="sa">${esc(corr.original_dev)}</span> → <span lang="sa">${esc(corr.corrected_dev)}</span>. ${esc(corr.reason)}</p>`;
  return h + '</article>';
}

const isClosing = (v, C) => !!C && v.num === C.sloka;

/* word-table groups for the closing line of śloka 183: one group per word */
function closingGroups(v, C) {
  if (!isClosing(v, C)) return [];
  return C.words.map((w, i) => ({
    head: `${i === 0 ? '<span class="cl-tag">Closing line</span> ' : ''}<span class="gn">·</span> <span class="nw" lang="sa">${esc(iast2dev(w.surface))}</span> <span class="i" lang="sa-Latn">${esc(w.surface)}</span> — ${esc(w.meaning)}${w.compound ? ` <span class="i">(${esc(w.compound)})</span>` : ''}`,
    rows: w.parts,
  }));
}

/** One śloka of the Sahasranāma. */
export function slokaUnit(v, R, byNum, LOG, VNOTE, CLOSING) {
  const halves = R[v.num];
  const first = v.names[0], last = v.names.at(-1);
  let h = `<section class="unit sloka" id="s-${v.num}">`;
  h += `<h3 class="uh"><span class="ul">Śloka</span> ${v.num}<span class="ur">names ${first}${last !== first ? `–${last}` : ''}</span></h3>`;
  // canonical
  h += '<div class="canon">';
  h += `<p class="dev" lang="sa">${halves.map((r, i) => r.canonical.map((g) => `<span class="w">${esc(g.dev)}</span>`).join(' ') + (i === 0 ? ' ।' : ` ॥ ${devNum(v.num)} ॥`)).join('<br>')}</p>`;
  h += `<p class="iast" lang="sa-Latn">${halves.map((r, i) => r.canonical.map((g) => esc(g.iast)).join(' ') + (i === 0 ? ' |' : ` || ${v.num} ||`)).join('<br>')}</p>`;
  h += '</div>';
  // learning
  const anyRestored = halves.some((r) => r.learning.some((l) => l.restored));
  h += `<div class="learn"><p class="lbl">The names, separated${anyRestored ? ' <span class="hint">° form as a name on its own; in the recitation above it joins its neighbour</span>' : ''}</p>`;
  for (const r of halves) {
    if (r.closing) {
      // the closing line: no names, but every word shown on its own (° = its form on its own)
      h += '<p class="cl-cap">The closing line — no name; its words, separated:</p>';
      h += '<p class="ln closing-words">' + (CLOSING ? CLOSING.words : []).map((w) => { const rs = w.pausa.replace(/-/g, '') !== w.surface; return `<span class="nm cw${rs ? ' rs' : ''}"><sup>·</sup><span class="dev nw" lang="sa">${hyDev(w.pausa)}${rs ? '<span class="deg">°</span>' : ''}</span><span class="iast nw" lang="sa-Latn">${hyIast(w.pausa)}</span></span>`; }).join('') + '</p>';
      continue;
    }
    h += '<p class="ln">' + r.learning.map((l) => `<span class="nm w${String(l.num).length}${l.restored ? ' rs' : ''}"><sup>${l.num}</sup><span class="dev nw" lang="sa">${hyDev(l.iast)}${l.restored ? '<span class="deg">°</span>' : ''}</span><span class="iast nw" lang="sa-Latn">${hyIast(l.iast)}</span></span>`).join('') + '</p>';
  }
  h += '</div>';
  // translation
  h += '<div class="trans"><p class="lbl">Translation</p>';
  v.halves.forEach((half, i) => {
    if (half.closing) h += '<p>Thus the goddesses of speech sang the thousand names of Śrī Lalitā Devī.</p>';
    else h += '<p>' + half.names.map((k) => `<sup>${k}</sup>${esc(byNum.get(k).a?.meaning || '')}`).join('; ') + (i === v.halves.length - 1 ? '.' : ';') + '</p>';
  });
  h += '</div>';
  // word by word
  h += '<div class="words"><p class="lbl">Word by word</p>';
  h += wordTable(v.names.map((k) => {
    const n = byNum.get(k);
    return { head: `<span class="gn">${k}</span> <span class="nw" lang="sa">${esc(n.dev)}</span> <span class="i" lang="sa-Latn">${esc(n.a?.iast || n.iast)}</span>`, rows: (n.a?.components || []).map((c) => ({ dev: c.dev, iast: c.iast, meaning: c.meaning, note: c.note })) };
  }).concat(closingGroups(v, CLOSING)));
  h += '</div>';
  const vn = VNOTE.get(v.num);
  const closingSandhi = isClosing(v, CLOSING) ? CLOSING.words.filter((w) => w.sandhi) : [];
  if (vn && ((vn.external_sandhi || []).length || vn.note) || closingSandhi.length) {
    h += `<div class="vnote"><p class="lbl">Where the ${closingSandhi.length ? 'words' : 'names'} meet</p>`;
    for (const s of (vn && vn.external_sandhi) || []) h += `<p><span class="nw" lang="sa">${esc(s.surface)}</span> = <span class="nw" lang="sa">${esc(s.split)}</span>${s.split_iast ? ` <span class="i">(${esc(s.split_iast)})</span>` : ''} — ${esc(s.rule)}</p>`;
    for (const w of closingSandhi) h += `<p><span class="nw" lang="sa">${esc(iast2dev(w.surface))}</span> = <span class="nw" lang="sa">${esc(iast2dev(w.pausa.replace(/-/g, '')))}</span> <span class="i">(${esc(w.surface)} = ${esc(w.pausa.replace(/-/g, ''))})</span> — ${esc(w.sandhi)}</p>`;
    if (vn && vn.note) h += `<p>${esc(vn.note)}</p>`;
    h += '</div>';
  }
  // the names
  h += '<div class="names"><p class="lbl">The names</p>';
  for (const k of v.names) h += nameDetail(byNum.get(k), LOG);
  h += '</div></section>';
  return h;
}

/** The nyāsa, or one dhyāna śloka, from preliminaries.json. */
export function prelimUnit({ id, title, sub, lines, words, translation, perLineWords }) {
  let h = `<section class="unit prelim" id="${id}"><h3 class="uh">${title}${sub ? `<span class="ur">${esc(sub)}</span>` : ''}</h3>`;
  h += '<div class="canon">';
  h += `<p class="dev" lang="sa">${lines.map((l, i) => l.read.split(' ').map((w) => `<span class="w">${esc(iast2dev(w.replace(/-$/, '')))}${w.endsWith('-') ? '-' : ''}</span>`).join(' ') + (l.end || '')).join('<br>')}</p>`;
  h += `<p class="iast" lang="sa-Latn">${lines.map((l) => esc(l.read) + (l.endI || '')).join('<br>')}</p>`;
  h += '</div>';
  h += '<div class="learn"><p class="lbl">Words separated, compounds hyphenated</p>';
  h += `<p class="ln plain"><span class="dev" lang="sa">${lines.map((l) => lineDev(l.learn)).join('<br>')}</span><span class="iast" lang="sa-Latn">${lines.map((l) => lineIast(l.learn)).join('<br>')}</span></p>`;
  h += '</div>';
  h += `<div class="trans"><p class="lbl">Translation</p>${(Array.isArray(translation) ? translation : [translation]).map((t) => `<p>${esc(t)}</p>`).join('')}</div>`;
  h += '<div class="words"><p class="lbl">Word by word</p>';
  h += wordTable(perLineWords || [{ head: null, rows: words }]);
  h += '</div></section>';
  return h;
}

export { wordTable, lineDev, lineIast, hyDev, hyIast, esc };
