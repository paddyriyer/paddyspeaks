#!/usr/bin/env node
/**
 * Emit verse- and name-level records from the sacred-text data files as JSON
 * on stdout, for the universal search index (scripts/platform_build/search_index.py).
 *
 * The data files are plain browser scripts (`const X_DATA = {...}`), so they
 * are evaluated in an empty vm sandbox — no DOM, no network — rather than
 * parsed with regexes that would break on the first nested quote.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function load(file, name) {
  const ctx = { window: {}, console: { log() {}, warn() {}, error() {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\s*const\s+([A-Za-z_]+)\s*=/gm, 'var $1 =');
  vm.runInContext(src, ctx, { timeout: 5000 });
  return ctx[name];
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

const gita = load('bhagavad-gita/data.js', 'BHAGAVAD_GITA_DATA');
const vishnu = load('vishnu-sahasranama/data.js', 'VISHNU_DATA');
const lalitha = load('lalitha-sahasranama/data.js', 'LALITHA_DATA');

const out = {
  gita: {
    chapters: gita.chapters.map((c) => ({ chapter: c.chapter, title: c.titleEnglish, sanskrit: c.titleSanskrit, meaning: clip(c.titleMeaning, 120) })),
    verses: gita.chapters.flatMap((c) => c.slokas.map((s) => ({
      chapter: s.chapter, verse: s.sloka,
      translit: clip(s.transliteration, 220),
      translation: clip(s.translation, 420),
      words: (s.words || []).map((w) => w.transliteration).filter(Boolean).slice(0, 24).join(' '),
    }))),
  },
  vishnu: vishnu.names.map((n) => ({ num: n.num, iast: n.name_iast, deva: n.name_devanagari, meaning: clip(n.meaning, 160) })),
  lalitha: lalitha.names.map((n) => ({ num: n.num, iast: n.name_iast, deva: n.name_devanagari, meaning: clip(n.meaning, 160) })),
};
process.stdout.write(JSON.stringify(out));
