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

## The Taittirīya: anuvāka records (see taittiriya/edition/analysis/1-01.json)

The Taittirīya is numbered vallī.anuvāka.unit (Bhāskara/Sāyaṇa's ॥N॥ units
inside each anuvāka). One record per anuvāka: `analysis/V-AA.json` (`1-07.json`),
`id` `"1.7"`. The per-unit fields — `padaccheda`, `words`, `sandhi`,
`sandhi_exceptions`, `samasa`, `morphology`, `translation` — sit inside
`units: [{id: "1.7.1", …}]`, one entry per unit of `text.json`, in order;
`sandhi_exceptions.after` counts words within that unit. Everything else
(`anvaya` may be `""` for prose too long to reorder usefully, `syntax`,
`ambiguities`, `metre`, `beginner` … `status`) is per anuvāka. `metre.name` may
also be `prose` or `mixed`.

- The commentaries are `shankara` (Advaita), `madhva` (Dvaita), and for
  Viśiṣṭādvaita `rangaramanuja`, `kuranarayana`, `govindaraja`; also
  `bharadvaja`, `ramananda`, `gopalananda` (see `edition.json`). Rāmānuja wrote
  no commentary on this Upaniṣad — never say he did. Śaṅkara's introduction is
  `shankara` key `opening` (cite it from 1.1 only).
- The six-commentary (Melkote) edition prints its commentators as running notes
  inside one another's sections, marked by sigla its colophons identify: ‘आ.भा.’
  Rāmānanda (*Ānandabhāṣya*), ‘तै. भा.’ Kauśika Govindarāja, ‘प्र.’ Raṅgarāmānuja
  (*Prakāśikā*). The importer has already filed each passage under its commentator,
  so quote a passage under the file it is in; never describe it as unattributed.
  Gopālānanda is modern — say so. The text is OCR: quote only clean runs.
- An anuvāka that only repeats an earlier one may map to it in `edition.json`
  (1.12 → 1.1, because every commentator says so); cite the commentator's own words
  for such a mapping.
- The śānti of vallīs 2–3 (*saha nāvavatu*) is not a numbered unit.
- Madhva's mūla is divided differently; its variants are collated by vallī (`near`).
  His comment follows a passage that can straddle anuvākas, and is filed under every
  anuvāka the passage covers — check that a quoted line is about your anuvāka.
- Parallels: add refs to a `parallel-refs-*.json` and re-run
  `python3 scripts/upanishads/import_taittiriya.py --yajuh … --raw …`.
- Studies: `studies/<id>.json` like the Īśā's, with `anuvakas: ["1.3", …]`
  instead of `mantras`, and each section's `mantra` an anuvāka id (`"1.3"`)
  or a range in `sources` (`shankara:1.1-1.12`).
- Check: `python3 scripts/upanishads/check.py --edition taittiriya --partial --mantra 1.7`.

## The Kaṭha: mantra records keyed adhyāya.vallī.mantra

The Kaṭha has 2 adhyāyas × 3 vallīs (119 mantras). Each record is ONE mantra,
`analysis/A-V-NN.json` (`1-2-23.json`), `id` `"1.2.23"`, with the per-unit fields
inside `units: [{id: "1.2.23", …}]` (exactly one unit, the mantra) as in the
Taittirīya records, and the rest per record. `edition.json` has `record: mantra`;
`analysed` lists vallīs ("1.1", "1.2", …). Most mantras are anuṣṭubh or triṣṭubh:
give the counts the checker prints when they differ from the norm.

- Commentaries: `shankara` (Advaita; his introduction is key `opening`, cite it
  from 1.1.1 only; each vallī's opening words are in `valli_intro`), `madhva`
  (Dvaita; filed under every mantra his passage covers — check a quoted line is
  about your mantra; where his bhāṣya has no comment, as at 1.2.22–25, 1.3.3–9,
  1.3.14–17, 2.1.9 and 2.1.12–13, there is no dvaita block with basis `commentary`;
  his 2.1.2–3 entry glosses 2.2.6–2.2.8 — cite it as `madhva:2.1.2` — and his 2.1.15
  entry opens with his colophon; his verse marks in 2.2 are a running count), `rangaramanuja` (Viśiṣṭādvaita, the Prakāśikā, 1948 edition,
  OCR; each of his entries ends with the next verse's mūla — never quote that as
  his). Rāmānuja wrote no commentary on the Kaṭha — never say he did.
- Witnesses: AS (base), G (GRETIL, after Olivelle 1998 — a modern critical text;
  cite its readings as GRETIL's, never as Olivelle's interpretation), V (vishvAsa
  mūla), Mv (Madhva's mūla, collated by vallī).
- Parallels: the Kaṭha shares verses with the Gītā (e.g. 1.2.18–19 ~ BG 2.19–20)
  and others; cite them as `BG 2.20` etc. after adding them to a
  `parallel-refs-*.json` and running `python3 scripts/upanishads/import_katha.py`.
- Check: `python3 scripts/upanishads/check.py --edition katha --partial --mantra 1.1.12`.

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
