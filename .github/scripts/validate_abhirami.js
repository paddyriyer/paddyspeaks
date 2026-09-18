#!/usr/bin/env node
/**
 * Guardrail for the Abhirami Anthadhi interpretation layer.
 *
 * Run locally:  node .github/scripts/validate_abhirami.js
 * Exit 0 = clean, 1 = at least one error.
 *
 * abhirami-andhadhi/data.js holds the VERIFIED Tamil text and is the only
 * source of truth for it. enrichment.js hangs interpretation off that text.
 * This script checks that the interpretation layer never drifts away from
 * the Tamil, and never cites a Lalitha Sahasranama name that does not exist.
 *
 *   1. Every interpreted verse number exists in data.js.
 *   2. Every WORD of the source Tamil survives into the word-by-word
 *      breakdown. The breakdown deliberately un-does sandhi, so it may ADD
 *      letters; dropping a word is an error.
 *   3. Every "word note" (lemma) entry really occurs in its verse.
 *   4. Required fields are present, tags are in the declared vocabulary,
 *      and confidence is one of high | medium | speculative.
 *   5. Every verse referenced by the life-challenge navigator, the featured
 *      module and the theme filters is a verse that has been interpreted.
 *   6. Every Lalitha Sahasranama cross-link resolves to a real name in
 *      lalitha-sahasranama/data.js, with matching transliteration.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];
const err = (m) => errors.push(m);

function loadGlobal(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
    .replace(new RegExp('^const ' + name + '\\b', 'm'), 'var ' + name);
  // eslint-disable-next-line no-eval
  return eval(src + '; ' + name);
}

const DATA = loadGlobal('abhirami-andhadhi/data.js', 'ABHIRAMI_ANDHADHI_DATA');
const LAL = loadGlobal('lalitha-sahasranama/data.js', 'LALITHA_DATA');
const E = require(path.join(ROOT, 'abhirami-andhadhi', 'enrichment.js'));

const byNum = {};
DATA.forEach((v) => { byNum[v.num] = v; });
const lalByNum = {};
LAL.names.forEach((n) => { lalByNum[n.num] = n; });

const tamilOnly = (s) => String(s).replace(/[^஀-௿]/g, '');

// longest common subsequence length
function lcs(a, b) {
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return prev[b.length];
}

const REQUIRED = ['theme', 'tags', 'english', 'words', 'textualBasis', 'association',
  'devotional', 'inner', 'lesson', 'lalitha', 'apply', 'parayana', 'sourceNotes', 'confidence'];
const CONFIDENCE = ['high', 'medium', 'speculative'];
const vocabulary = new Set(E.ABHIRAMI_THEMES.map((t) => t.key));
const interpreted = new Set(Object.keys(E.ABHIRAMI_ENRICHMENT).map(Number));

for (const [key, e] of Object.entries(E.ABHIRAMI_ENRICHMENT)) {
  const num = Number(key);
  const verse = byNum[num];
  if (!verse) { err(`verse ${num} is interpreted but absent from data.js`); continue; }

  REQUIRED.forEach((f) => { if (e[f] === undefined) err(`verse ${num}: missing field "${f}"`); });
  if (!CONFIDENCE.includes(e.confidence)) err(`verse ${num}: confidence "${e.confidence}" is not one of ${CONFIDENCE.join('|')}`);
  (e.tags || []).forEach((t) => { if (!vocabulary.has(t)) err(`verse ${num}: tag "${t}" is not in ABHIRAMI_THEMES`); });
  if (e.association && !['text', 'tradition', 'none'].includes(e.association.basis)) {
    err(`verse ${num}: association.basis "${e.association.basis}" is not text|tradition|none`);
  }

  const joined = tamilOnly((e.words || []).filter((w) => !w.lemma).map((w) => w.tamil).join(''));

  // 2 — no source word may be dropped
  verse.tamil.split(/\s+/).forEach((word) => {
    const w = tamilOnly(word);
    if (w.length < 2) return;
    const coverage = lcs(w, joined) / w.length;
    if (coverage < 0.6) {
      err(`verse ${num}: source word "${word}" is only ${Math.round(coverage * 100)}% covered by the word breakdown`);
    }
  });

  // 3 — lemma entries must be words of this verse
  const verseLetters = tamilOnly(verse.tamil);
  (e.words || []).filter((w) => w.lemma).forEach((w) => {
    const t = tamilOnly(w.tamil);
    if (lcs(t, verseLetters) / t.length < 0.8) err(`verse ${num}: word note "${w.tamil}" does not occur in the verse`);
  });

  (e.words || []).forEach((w) => {
    if (!w.translit) err(`verse ${num}: "${w.tamil}" has no transliteration`);
    if (!w.meanings || !w.meanings.length) err(`verse ${num}: "${w.tamil}" has no meaning`);
  });

  // 6 — Lalitha cross-links
  (e.lalitha || []).forEach((l) => {
    const src = lalByNum[l.num];
    if (!src) { err(`verse ${num}: Lalitha name ${l.num} does not exist`); return; }
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
    if (norm(src.name_iast) !== norm(l.iast)) {
      err(`verse ${num}: Lalitha ${l.num} cited as "${l.iast}" but the source has "${src.name_iast}"`);
    }
    if (!l.why) err(`verse ${num}: Lalitha ${l.num} has no explanation of the connection`);
  });
}

// 5 — navigator, featured and counts
E.ABHIRAMI_CHALLENGES.forEach((g) => {
  g.items.forEach((it) => {
    if (!it.verses.length) err(`challenge ${g.key}/${it.key} lists no verses`);
    it.verses.forEach((n) => {
      if (!byNum[n]) err(`challenge ${g.key}/${it.key} points at verse ${n}, which is not in data.js`);
      else if (!interpreted.has(n)) err(`challenge ${g.key}/${it.key} points at verse ${n}, which is not interpreted`);
    });
  });
});

E.ABHIRAMI_FEATURED.forEach((f) => {
  if (!interpreted.has(f.verse)) err(`featured entry "${f.label}" points at verse ${f.verse}, which is not interpreted`);
});

if (E.ABHIRAMI_META.enrichedCount !== interpreted.size) {
  err(`ABHIRAMI_META.enrichedCount is ${E.ABHIRAMI_META.enrichedCount} but ${interpreted.size} verses are interpreted`);
}

if (errors.length) {
  console.error('Abhirami Anthadhi validation FAILED:\n');
  errors.forEach((m) => console.error('  • ' + m));
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Abhirami Anthadhi: ${DATA.length} verses in source, ${interpreted.size} interpreted, ` +
  `${Object.values(E.ABHIRAMI_ENRICHMENT).reduce((n, e) => n + e.lalitha.length, 0)} Lalitha cross-links — all clean.`);
