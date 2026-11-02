# The Upaniṣads — the analysis brief

The fixed brief for writing `upanishads/<id>/edition/analysis/NN.json` and the
studies. Every file is proven by `scripts/upanishads/check.py` before it is
accepted. Read `docs/UPANISHADS-EDITION.md` for the architecture and sources.

**The model entry is `upanishads/isha/edition/analysis/01.json`.** Match its
depth, tone, field set and labelling.

The order of work is fixed: **verify the Sanskrit first, explain it second,
interpret it third.** The Sanskrit is already verified (`text.json`); you never
change it. If you believe the text is wrong, add a `flags` entry
(`kind: "variant"` or `"review"`) — never alter `text.json` or work around it.

## What you are given

- `edition/text.json` — the 18 mantras (Kāṇva recension; base witness G).
- `edition/corrections.json` — every witness difference, classified. If your
  mantra has entries of class `variant`, `recension` or `review`, discuss them in
  `ambiguities` (linguistic) or `flags`.
- `edition/witnesses/` — the witnesses and **the four commentaries, which are
  your only authorities for traditional interpretation**: `shankara.json`
  (Advaita), `desika.json` (Viśiṣṭādvaita — Vedānta Deśika; Rāmānuja wrote no
  commentary on this Upaniṣad, never say he did), `madhva.json` (Dvaita),
  `mahidhara.json` (on the Mādhyandina VS 40, keyed by VS numbers — see
  `edition.json` for the mapping). `M-madhyandina.json` has the pada-pāṭha.
- `edition/witnesses/parallels.json` — the only passages you may cite as
  parallels. To cite another, add its ref to `parallel-refs.json` and re-run
  `scripts/upanishads/import_witnesses.py` (the parser must find it).
- `upanishads/data/sutras.json` — Pāṇini by number. Cite a sūtra **only** as
  `P. 1.3.66 (भुजोऽनवने)`, number and text; the checker compares both. Never cite
  a sūtra you are not sure applies; a commentator's own citation may be reported
  as his ("Mahīdhara cites P. 3.1.124 (ऋहलोर्ण्यत्)").
- `upanishads/data/glossary.json` — `key_concepts` must use its ids.

## The record (see 01.json)

| Field | What | Rules |
|---|---|---|
| `title`, `theme` | short English title; one-line theme | |
| `padaccheda` | one word list per printed line | pausal forms; visarga, final m/t/n restored; compounds whole; preverbs written with their verb stay on it; every particle is a word; ॐ is `ओम्` |
| `words` | one per padaccheda word, same order | `w`, `base` (stem, or `√root`), `gram`, `meaning` (literal), `role` (grammatical role in the sentence), optional `context` (a commentator's gloss, the sense here) |
| `sandhi` | the junctions worth explaining | `joined` (as it stands in the mantra), `split`, `type`, `rule` |
| `sandhi_exceptions` | unjoined vowel hiatus the rules do not produce | `after` (0-based word index across the mantra), `kind` (`vedic-prakṛtibhāva`, `pragṛhya`, …), `note`; the checker fails a missing or an unneeded one |
| `samasa` | every genuine compound | `word`, `members`, `type`, `vigraha` (Sanskrit), `meaning` |
| `morphology` | notes on forms that need them | `word` (a padaccheda word), `note` |
| `anvaya` | prose order in Devanagari | only padaccheda words; supplied words in `[ ]` |
| `syntax` | English, how the sentence is built | |
| `ambiguities` | real semantic/textual ambiguities | `topic`, `note` |
| `metre` | `name` (`anuṣṭubh`, `triṣṭubh`, `irregular`, `prose`), `note` | if the counted syllables (the checker counts them) differ from the norm, the note must give the counts and why |
| `translation` | `literal`, `readable` | literal accounts for every word, supplied words in [ ]; readable is labelled interpretive on the page and adds no doctrine |
| `beginner` | 100–150 words (checker: 90–170), no Devanagari, no unexplained Sanskrit | everyday language |
| `analogy` | one concrete analogy, one or two sentences | |
| `key_concepts` | glossary ids | |
| `commentary` | blocks `{q, label, text, sources}` | `label` ∈ direct · traditional · comparative · linguistic · reflection; only questions the mantra raises; `sources` lists the commentaries whose words you quote |
| `schools` | `advaita`, `visistadvaita`, `dvaita`, `disagreement` | each `{basis, who, ref, sources, text}`; `basis`: `commentary` (from that school's commentary on this mantra — must quote it), `doctrine` (a securely sourced broader position — say whose), `inference` (a modern comparative inference — say so in the text). Omit a school rather than force it |
| `parallels` | `{ref, kind, quote, note}` | `kind`: `direct-parallel` (same words), `doctrinal`, `thematic`; `quote` must occur in the passage |
| `contemporary` | `{theme, text}` | one theme from the brief's list; it illuminates, never replaces; end by marking it as a reflection |
| `reflect` | `beginner`, `deeper`, `practice` | never a medical or therapeutic claim |
| `references` | extra notes `{kind, text}` | the page lists witnesses, variants and commentary sources automatically |
| `flags` | `{kind, note}` | `uncertain`, `variant`, `interpretation`, `review` |
| `status` | `machine-verified` | (`reviewed` only after a scholar has read it) |

## Quoting (the checker enforces this)

- **Every Devanagari phrase in « » must occur verbatim** (spaces, punctuation and
  svara aside; a gloss may drop its final visarga) in the commentaries named in
  that block's `sources` — or in the mantra or its witnesses. So copy; never
  reconstruct a commentator's Sanskrit.
- Attribute only what the file says. Madhva cites Purāṇic texts by name ("इति
  ब्राह्मे", "इति ब्रह्माण्डे"): report them as *cited by Madhva*, never as
  verified quotations of those works.
- No other commentator, scholar, date or page may be cited unless it is in the
  edition's sources (`docs/UPANISHADS-EDITION.md` §Sources).

## Labels

`direct` — what the Sanskrit states. `traditional` — what a named commentary
concludes. `comparative` — school against school. `linguistic` — grammar, sandhi,
witnesses, metre. `reflection` — modern. Every block has exactly one.

## Style

Plain, exact, unhurried English. IAST in English prose (*tena tyaktena*),
Devanagari only for words and quotations. No exclamations, no devotional
superlatives, no claims about effects of chanting or meditation, no "vibration",
"cosmic energy", "quantum". Never present one school's reading as the meaning of
the text.

## Check

```
python3 scripts/upanishads/check.py --partial --mantra 4
python3 scripts/upanishads/check.py            # everything (CI)
```
