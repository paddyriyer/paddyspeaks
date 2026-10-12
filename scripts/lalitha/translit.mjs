/**
 * IAST <-> Devanagari for the Lalitā edition (the JS twin of translit.py).
 * dev2iast is exact for the edition's text; iast2dev is its inverse, used to
 * write the reader's word-separated lines. build.mjs proves the round trip
 * (dev2iast(iast2dev(x)) === x) for every string it renders.
 */
const CONS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ', 'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
  'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'ḻ', 'व': 'v',
  'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h',
};
const VOWELS = { 'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū', 'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ', 'ॡ': 'ḹ', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au' };
const SIGNS = { 'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au' };
const OTHER = { 'ं': 'ṃ', 'ः': 'ḥ', 'ऽ': "'", '।': '|', '॥': '||' };
const VIRAMA = '्';

export function dev2iast(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (CONS[ch]) {
      out += CONS[ch];
      const nx = text[i + 1];
      if (nx === VIRAMA) { i++; continue; }
      if (SIGNS[nx]) { out += SIGNS[nx]; i++; continue; }
      out += 'a';
      continue;
    }
    if (VOWELS[ch]) out += VOWELS[ch];
    else if (OTHER[ch]) out += OTHER[ch];
    else if (ch === '‌' || ch === '‍') continue;
    else if (/[०-९]/.test(ch)) out += String(ch.charCodeAt(0) - 0x966);
    else out += ch;
  }
  return out;
}

const R_CONS = Object.fromEntries(Object.entries(CONS).map(([d, l]) => [l, d]));
const R_VOW = Object.fromEntries(Object.entries(VOWELS).map(([d, l]) => [l, d]));
const R_SIGN = Object.fromEntries(Object.entries(SIGNS).map(([d, l]) => [l, d]));
const R_OTHER = { 'ṃ': 'ं', 'ḥ': 'ः', "'": 'ऽ' };
const CONS_KEYS = Object.keys(R_CONS).sort((a, b) => b.length - a.length);
const VOW_KEYS = ['ai', 'au', 'ā', 'ī', 'ū', 'ṛ', 'ṝ', 'ḷ', 'ḹ', 'a', 'i', 'u', 'e', 'o'];

/** IAST (one word or a line; spaces, hyphens and | pass through) -> Devanagari. */
export function iast2dev(text) {
  let out = '';
  let i = 0;
  let pending = false; // a consonant written without its vowel yet
  const close = () => { if (pending) { out += VIRAMA; pending = false; } };
  while (i < text.length) {
    let m = null;
    for (const k of CONS_KEYS) if (text.startsWith(k, i)) { m = k; break; }
    if (m) {
      // 'kh' etc. are aspirates, but k + h across a hyphen never reaches here
      close();
      out += R_CONS[m];
      pending = true;
      i += m.length;
      continue;
    }
    let v = null;
    for (const k of VOW_KEYS) if (text.startsWith(k, i)) { v = k; break; }
    if (v) {
      if (pending) { if (v !== 'a') out += R_SIGN[v]; pending = false; }
      else out += R_VOW[v];
      i += v.length;
      continue;
    }
    const ch = text[i];
    if (R_OTHER[ch]) { close(); out += R_OTHER[ch]; i++; continue; }
    close();
    out += ch;
    i++;
  }
  close();
  return out;
}
