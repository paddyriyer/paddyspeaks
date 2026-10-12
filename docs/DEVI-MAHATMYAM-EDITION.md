# Śrī Devī Māhātmyam — the study edition

Read this before touching `devi-mahatmyam/` or `scripts/devi_mahatmyam/`. The
brief every analysis batch is written to is `docs/DEVI-MAHATMYAM-BRIEF.md`.

## What exists

| Path | What it is |
|---|---|
| `devi-mahatmyam/edition/text.json` | **The Sanskrit.** 13 chapters, 700 mantras, Gita Press numbering. Per chapter: title, carita, colophon, the colophon's own counts (uvāca / half-ślokas / ślokas / three-part mantras, running total), the liturgical preface (viniyoga, dhyāna, invocation). Per mantra: `n` (`to` for a range), `kind`, the printed `lines`, and the recitation's bījas apart from the text (`bija_open`, `bija_close`). Hand-maintained; every change is logged. |
| `devi-mahatmyam/edition/corrections.json` | Corrections made to the digital text, the variant readings kept as printed, recension and metre notes. |
| `devi-mahatmyam/edition/analysis/CC.json` | **The analysis**, one file per chapter: for every mantra the padaccheda, word table, sandhi, samāsa, morphology, anvaya, literal and readable translations, labelled commentary, flags; the chapter's introduction, conclusion and completion report. |
| `devi-mahatmyam/edition/analysis/parts/` | Workspace for batches in progress (`CC-x-NN.json`, `CC-frame.json`). Empty once a chapter is merged. |
| `devi-mahatmyam/edition/edition.css` | Styles for every page (linked with `?v=<hash>`). |
| `devi-mahatmyam/index.html`, `edition/chapter-NN.html`, `edition/notes.html` | GENERATED — the contents page, the 13 chapters, and source/corrections/variants. |
| `scripts/devi_mahatmyam/check.py` | The guardrail (in Validate Content). |
| `scripts/devi_mahatmyam/sandhi.py` | External-sandhi rejoining, used by the checker to prove every padaccheda. |
| `scripts/devi_mahatmyam/build.mjs` | Renders the pages; `--check` fails on stale output. |
| `scripts/devi_mahatmyam/merge_parts.py` | Assembles a chapter's batches into `analysis/CC.json`. |
| `data/provenance/devi-mahatmyam.json` | Sources & verification record. |

## Commands

```
python3 scripts/devi_mahatmyam/check.py                 # the guardrail (Validate Content)
python3 scripts/devi_mahatmyam/check.py --chapter 5     # one chapter
python3 scripts/devi_mahatmyam/check.py --part <file>   # a batch in progress
python3 scripts/devi_mahatmyam/merge_parts.py 5 --clean # batches → analysis/05.json
node scripts/devi_mahatmyam/build.mjs                   # regenerate the pages
node scripts/devi_mahatmyam/build.mjs --check           # CI: fail if a page is stale
python3 scripts/platform_build/build.py all             # search index (verses shard), counts
```

## Rules

- **Never edit a generated page.** Change `text.json`, `corrections.json` or an
  analysis file, then rebuild. CI fails on stale output.
- **The text is proven, not trusted.** `check.py` fails unless every chapter is
  numbered 1..N without a gap, its uvāca / half-śloka / śloka / three-part counts
  equal its Gita Press colophon, the running total reaches 700, and every logged
  correction is in the text (and its old reading is not).
- **The padaccheda is proven.** For every mantra the separated words are rejoined
  by the rules of external sandhi (`sandhi.py`: vowel, visarga and consonant
  sandhi, with the n/m/t assimilations, ch → cch, saḥ/eṣaḥ, r-visarga words) and
  must spell the recited text exactly (spacing, dandas, avagraha and nasal
  spelling aside). A vowel hiatus left unjoined must be declared in
  `sandhi_exceptions` with a reason. The word table must list exactly the
  padaccheda's words, in order. Sandhi examples must occur in the verse, compounds
  and analysed forms must be words of the verse.
- **IAST is never typed.** Every transliteration on the pages is generated from
  the Devanagari beside it (`scripts/lalitha/translit.mjs`, shared with the Lalitā
  edition), so the two cannot differ.
- **Every change to the Sanskrit is logged** in `corrections.json` with its kind
  and reason. Variants are recorded, not silently chosen: the Gita Press reading is
  kept and the other reading listed with its witnesses.
- **The bījas are not the text.** ॐ ऐं / ॐ ह्रीं / ॐ क्लीं … at the chapter
  edges belong to the Gita Press pāṭha; they are stored and shown apart and never
  analysed. So are the viniyoga and dhyāna before each chapter.
- **No invented authority.** Commentary is labelled `direct`, `traditional`,
  `comparative` or `reflection`; no commentator, quotation or citation is
  invented; Lalitā Sahasranāma names are cited by number and form from
  `lalitha-sahasranama/edition/text.json`; Śrīvidyā connections only where real.
  The Devī Māhātmyam (Mārkaṇḍeya Purāṇa), the Lalitā Sahasranāma (Brahmāṇḍa
  Purāṇa) and the Soundarya Lahari stay distinct.
- **Supplementary texts** (Kavaca, Argalā, Kīlaka, Rātri/Devī Sūkta, Rahasyas)
  are not part of the 13 chapters. If they are ever added, they get their own
  section and file, never a place among the numbered mantras.

## How the 2026-10 edition was made

1. **Source.** sanskritdocuments.org, GRETIL and Wikisource were not reachable
   from the build environment; the GitHub corpus `sanskrit/raw_etexts` was. It
   holds the Gita Press *Śrīdurgāsaptaśatī* (with Hindi translation) as HTML
   (`purANam/durgA-saptashatI/goraxapura-pAThaH/raw/source.html`). The Sanskrit
   was parsed out of it, mantra by mantra, by the Gita Press markers `(अ०N। M)`
   and the numbered uvāca lines.
2. **Counts.** Every chapter's colophon states its uvāca, half-śloka and śloka
   counts and the running total (एवमादितः … ७००). The parse matches all of them;
   the first parse did not (a heuristic had dropped six Sanskrit lines containing
   लोके as "Hindi"), which is why the counts are now a permanent check.
3. **Witnesses.** The whole text was aligned letter by letter with GRETIL's
   Mārkaṇḍeyapurāṇa (adhyāyas 81–93, not proof-read) and Peter Freund's
   Saptaśatī. 29 places where the Gita Press text differed from *both* were
   examined: four were errors of the digital file (1.77 twice, two footnote
   asterisks, and a duplicated block at the end of chapter 13) and were corrected;
   the rest are genuine readings, kept and recorded as variants.
4. **Metre.** 1,084 half-lines scan as anuṣṭubh; the hymns are vasantatilakā
   (chapter 4), indravajrā / upajāti (chapter 11, the Nārāyaṇī stuti) and
   vaṃśastha / indravaṃśā; 1.92 and 2.2 have the hypermetric pāda every witness has.
   The build names each verse's metre from its laghu-guru pattern.
5. **Analysis.** Written to `docs/DEVI-MAHATMYAM-BRIEF.md` from four model
   entries (1.1–1.4), in batches of 20–30 mantras, each proven by
   `check.py --part` before it was merged, chapter by chapter, each chapter closed
   with its introduction, conclusion and completion report.

## Open for Paddy

- The variants marked *Textual Verification Required* in `corrections.json`
  should be checked against a printed Gita Press book (or another printed
  edition); the build environment had none.
- Verses flagged `uncertain` are listed in each chapter's completion report.
