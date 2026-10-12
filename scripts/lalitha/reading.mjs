/**
 * Reader's lines for a half-śloka of the Sahasranāma.
 *
 *   canonical — the text exactly as recited, with a space wherever one name ends
 *               and the next begins WITHOUT any letter changing (bhadramūrtir
 *               bhaktasaubhāgyadāyinī; sarvāruṇā 'navadyāṅgī). Where two names
 *               fuse into one sound (sādhu + ī → sādhvī; triguṇā + ambā →
 *               triguṇāmbā) they stay together: splitting them would change the text.
 *   learning  — every name in its own dictionary (pausa) form, numbered, with
 *               reading hyphens at compound boundaries. A name whose form here
 *               differs from the recited one is marked `restored`.
 *
 * Everything is worked out in IAST, where a word boundary never changes a
 * letter, and converted to Devanagari word by word.
 */
import { iast2dev } from './translit.mjs';

const plainOf = (s) => s.replace(/[\s-]/g, '');

/* Endings a name may take in recitation without the boundary moving:
   ḥ → r s ś ṣ or dropped, m → ṃ, t/d → d n c j l, k → g ṅ, p → b m, n → ṃ ñ ṇ. */
function endingOk(pausa, surface) {
  // an elided initial a / ā is written with the avagraha (' or '')
  if (surface.startsWith("''") && pausa[0] === 'ā') surface = 'ā' + surface.slice(2);
  else if (surface.startsWith("'") && pausa[0] === 'a') surface = 'a' + surface.slice(1);
  if (surface === pausa) return true;
  const last = pausa.at(-1);
  const stem = pausa.slice(0, -1);
  if (!surface.startsWith(stem)) return false;
  const tail = surface.slice(stem.length);
  if (tail === '') return last === 'ḥ';      // visarga dropped (āḥ + vowel → ā)
  const alt = { 'ḥ': ['r', 's', 'ś', 'ṣ'], 'm': ['ṃ'], 't': ['d', 'n', 'c', 'j', 'l'], 'd': ['t', 'n'], 'k': ['g', 'ṅ'], 'p': ['b', 'm'], 'n': ['ṃ', 'ñ', 'ṇ'] }[last] || [];
  return alt.includes(tail);
}

const prefixOf = (name) => (name.length <= 1 ? name : name.slice(0, Math.min(5, name.length - 1)));

function matchAt(flat, p, name) {
  const pre = prefixOf(name);
  if (flat.startsWith(pre, p)) return true;
  const rest = pre.slice(1) || name.slice(1, 2);
  if (name[0] === 'a' && flat[p] === "'" && flat[p + 1] !== "'" && flat.startsWith(rest, p + 1)) return true;
  if (name[0] === 'ā' && flat.startsWith("''", p) && flat.startsWith(rest, p + 2)) return true;
  return false;
}

/**
 * half: {iast, names:[num]}; byNum: num -> {iast (hyphenated pausa form)}.
 * Returns {canonical: [{iast, dev, names:[num]}], learning: [{num, iast, dev, restored}]}
 */
export function readerLines(half, byNum) {
  const original = half.iast;                 // with the text's own spaces
  const flat = original.replace(/ /g, '');
  const map = [];                              // flat index -> original index
  for (let i = 0; i < original.length; i++) if (original[i] !== ' ') map.push(i);
  const nums = half.names;
  const starts = [0];                          // flat start of each name, or -1 if fused with the previous
  const plains = nums.map((n) => plainOf(byNum[n].iast));
  let lastIdx = 0;                             // index of the last name whose start was found
  for (let j = 1; j < nums.length; j++) {
    let est = starts[lastIdx];
    for (let i = lastIdx; i < j; i++) est += plains[i].length;
    const fusedSince = j - 1 - lastIdx;
    const from = Math.max(starts[lastIdx] + 1, est - 3 - fusedSince);
    const to = est + 2;
    let found = -1;
    for (let p = from; p <= to && p < flat.length; p++) if (matchAt(flat, p, plains[j])) { found = p; break; }
    // the previous name's recited form must be its own form with at most a sandhi ending
    if (found >= 0 && starts[j - 1] >= 0 && !endingOk(plains[j - 1], flat.slice(starts[j - 1], found))) found = -1;
    starts.push(found);
    if (found >= 0) lastIdx = j;
  }
  // group fused names together
  const groups = [];
  for (let j = 0; j < nums.length; j++) {
    if (starts[j] >= 0 || j === 0) groups.push({ start: j === 0 ? 0 : starts[j], names: [nums[j]] });
    else groups.at(-1).names.push(nums[j]);
  }
  const canonical = groups.map((g, k) => {
    const end = k + 1 < groups.length ? groups[k + 1].start : flat.length;
    // keep the text's own spaces inside a group (a name written as two words)
    const a = map[g.start];
    const b = end < flat.length ? map[end] : original.length;
    const iast = original.slice(a, b).trim();
    return { iast, dev: iast.split(' ').map(iast2dev).join(' '), names: g.names };
  });
  const surfaceOf = {};
  for (const g of canonical) if (g.names.length === 1) surfaceOf[g.names[0]] = plainOf(g.iast);
  const learning = nums.map((n) => {
    const iast = byNum[n].iast;
    const restored = surfaceOf[n] !== plainOf(iast);
    return { num: n, iast, dev: iast.split('-').map(iast2dev).join('-'), restored };
  });
  return { canonical, learning };
}
