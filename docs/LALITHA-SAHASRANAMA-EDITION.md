# Śrī Lalitā Sahasranāma — the corrected study edition

Read this before touching `lalitha-sahasranama/` or `scripts/lalitha/`.

## What exists

| Path | What it is |
|---|---|
| `lalitha-sahasranama/edition/text.json` | **The Sanskrit.** Nyāsa, four dhyāna ślokas, 183 ślokas (Devanagari + IAST per half-line), 1,000 names each with its śloka and half-line, the colophon. Hand-maintained; every change is logged in `corrections.json`. |
| `lalitha-sahasranama/edition/analysis/NN.json` | **The analysis**, 19 batches of 10 ślokas: for every name, sandhi viccheda, samāsa (type, vigraha-vākya, explanation), the word-by-word table, the complete meaning, its significance, and flags (uncertain, variants, text concerns). Also the external sandhi between names in each śloka and a per-batch report. |
| `lalitha-sahasranama/edition/corrections.json` | The hand-written correction log (names, structure), textual variants, and the previous English of any meaning that was rewritten. |
| `lalitha-sahasranama/edition/edition.css` | Styles for the study edition (screen, print, PDF). |
| `lalitha-sahasranama/edition/index.html` | GENERATED — the study edition at `/lalitha-sahasranama/edition/`. |
| `lalitha-sahasranama/edition/CORRECTIONS.md` | GENERATED — the correction log, variants and unresolved questions as text. |
| `lalitha-sahasranama/edition/*.pdf`, `*.docx`, `pdf.json` | GENERATED with `--pdf --docx` — the print-ready PDF and the editable Word copy. |
| `lalitha-sahasranama/data.js`, `words.js` | GENERATED — what the chanting guide (`/lalitha-sahasranama/`) reads. The śloka-to-name table (`verse_names`) is generated too; `app.js` no longer types one. |

## Commands

```
python3 scripts/lalitha/check.py          # the guardrail (in Validate Content)
node scripts/lalitha/build.mjs            # regenerate data.js, words.js, the edition, the log
node scripts/lalitha/build.mjs --check    # CI: fail if any generated file is stale
EA_DEPS=/opt/node22/lib LALITHA_FONTS=/path/to/fontsource-packages \
  node scripts/lalitha/build.mjs --pdf --docx
```

`--pdf` needs playwright, `--docx` the `docx` package, both resolvable from
`$EA_DEPS` (as in `scripts/every_arrow/`). Where Google Fonts cannot be reached,
`LALITHA_FONTS` points at unpacked `@fontsource/tiro-devanagari-sanskrit` and
`@fontsource/source-serif-4` packages (see `scripts/lalitha/pdf.mjs`). `--check`
fails when the PDF or DOCX is older than the edition, so rebuild them whenever
the text or analysis changes.

## Rules

- **Never edit a generated file.** Change `text.json`, an analysis batch or
  `corrections.json`, then rebuild. CI fails on stale output.
- **Every change to the Sanskrit is logged** in `corrections.json` with its kind
  (typographical, orthographic, grammatical, numbering, encoding, structural,
  variant) and its reason. `check.py` fails if a logged correction does not
  match the text.
- **The text is proven, not trusted.** `check.py` fails unless the names are
  exactly 1–1000 in order, every name is found in order in the half-line that
  claims it, every half-line scans as 16 syllables (anuṣṭubh), and every IAST
  string is the exact transliteration of its Devanagari.
- **Bhāskararāya's division is the numbering.** tat · tvam · ayī (425–427),
  sādhu · ī (711–712), brahma · jananī (822–823), dharā · dharasutā (955–956)
  and amatiḥ (537) are his and stay. 454 is the single name
  lolākṣīkāmarūpiṇī.
- **Variants are recorded, not silently chosen.** Where the source's own śloka
  text and name list disagreed, the śloka text was adopted unless it was wrong,
  and the other reading is in Appendix B. Do not "fix" a recorded variant
  without a printed authority, and log it if you do.
- **A name stays whole.** The word cards show the intact name; the split is
  explanation (श्रीमाता is one name, explained as श्री + माता).
- **No invented attributions.** A reading is attributed to Bhāskararāya or a
  text only when the attribution is secure; otherwise it says "traditionally".
  Doubt is marked `uncertain` and listed for review, never hidden.
- **The old generators are retired and were removed** (`generate_words.py`,
  `split_compounds.py`, `fix_meanings.py`, `update_verses.py` at the repo root).
  They rebuilt `data.js` / `words.js` from a dictionary and would bring the
  errors back. Git history keeps them; do not restore them.
- The Abhirami page cites Lalitha names by number and IAST;
  `node .github/scripts/validate_abhirami.js` fails if a citation no longer
  matches `data.js`. Run it after changing a name.

## How the 2026-10 edition was made

1. **Source.** The site's own text (sanskritdocuments.org, Brahmāṇḍa Purāṇa),
   as `data.js` held it; its "Download PDF" is the "Complete Text" PDF.
2. **Independent check.** The Devanagari stotra and nāmāvalī in the npm package
   `hindu-devotional-texts` (0.8.0, same recension, Bhāskararāya's ordering).
   The two agree name for name on boundaries; every difference was examined
   and is either a correction (Appendix A) or a variant (Appendix B).
   sanskritdocuments.org and other reference sites were not reachable from the
   build environment, so a printed *Saubhāgyabhāskara* was **not** consulted;
   the variants flagged for review should be checked against one.
3. **Metre.** All 366 half-lines scan as 16 syllables.
4. **Alignment.** Every name was located in its half-line; this exposed the
   website's misplaced name cards (Appendix A.2).
5. **Analysis.** Written in 19 batches of ten ślokas to a fixed brief, each
   batch validated by `check.py --batch NN` before it was accepted, then
   reviewed for consistency across batches.
