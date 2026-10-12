# Devī Māhātmyam — the analysis brief

The fixed brief for writing `devi-mahatmyam/edition/analysis/`. Every batch is
written to it and proven by `scripts/devi_mahatmyam/check.py` before it is
accepted. Read `docs/DEVI-MAHATMYAM-EDITION.md` first for the architecture.

The model entries are **1.1–1.4** in `devi-mahatmyam/edition/analysis/01.json`
(written first, in `analysis/parts/01-a.json`). Match their depth, tone and
format.

## What you are given

- `devi-mahatmyam/edition/text.json` — the Sanskrit (Gita Press Durgāsaptaśatī),
  chapters → mantras. A mantra has `n` (and `to` for a range: the three-part
  *yā devī* mantras), `kind` (uvaca · ardha · sloka · tripada), `lines` (the
  printed lines, as recited), and sometimes `bija_open` / `bija_close` (the
  recitation's bījas — **not** words of the verse; never analyse them).
- `devi-mahatmyam/edition/corrections.json` — corrections made to the digital
  text, and variant readings. If your mantra has a variant, mention it in the
  commentary or in `flags.uncertain`; never silently "fix" the text.
- The mantra id is `"<chapter>.<n>"`, or `"<chapter>.<n>-<to>"` for a range.

## What you write: one entry per mantra, in text order

```json
{
 "id": "1.2",
 "pada": [["सावर्णिः", "सूर्यतनयः", "यः", "मनुः", "कथ्यते", "अष्टमः"], ["निशामय", "…"]],
 "sandhi_exceptions": [{"at": "शिरसी | तयोः", "reason": "…"}],
 "words": [{"w": "सावर्णिः", "en": "Sāvarṇi", "g": "m. nom. sg. …"}],
 "sandhi": [{"joined": "कथ्यतेऽष्टमः", "split": "कथ्यते + अष्टमः", "type": "vowel sandhi (pūrvarūpa)", "rule": "एङः पदान्तादति (6.1.109)", "note": "…"}],
 "samasa": [{"c": "सूर्यतनयः", "members": "सूर्य + तनय", "vigraha": "सूर्यस्य तनयः", "type": "ṣaṣṭhī tatpuruṣa", "literal": "…", "sense": "…", "alt": "(optional) another analysis and why the first fits better"}],
 "morph": [{"form": "कथ्यते", "note": "…"}],
 "anvaya": "यः सूर्यतनयः सावर्णिः …",
 "anvaya_en": "(optional) one or two sentences on the sentence structure",
 "lit": "faithful literal translation",
 "tr": "readable traditional translation",
 "tr_note": "(optional) where tr departs from lit, say how and why",
 "comm": [{"k": "direct", "t": "…"}, {"k": "traditional", "t": "…"}],
 "flags": {"uncertain": "(optional) a doubt about reading or interpretation"}
}
```

The seven sections of the edition come from these fields:

| Section | Field(s) | Notes |
|---|---|---|
| 1 Original śloka | `text.json` | never re-typed |
| 2 Padaccheda | `pada` | Devanagari, one list per printed line |
| 3 IAST (recited and separated) | generated | **never type IAST for a verse or a padaccheda** |
| 4 Word-by-word | `words` | exactly the padaccheda's words, same order |
| 5 Vyākaraṇa | `sandhi`, `samasa`, `morph`, `anvaya` | |
| 6 Translation | `lit`, `tr`, `tr_note` | |
| 7 Commentary | `comm` | labelled |

## Padaccheda (`pada`) — the rules, and how the checker proves them

1. Write every word in its **own (pausal) form**: visarga restored (`यः`, not
   `यो`), final `m` (`पूर्वम्`, not `पूर्वं`), final `t` (`विस्तरात्`, not
   `विस्तराद्`), elided vowels restored (`अष्टमः` after `कथ्यते`), fused vowels
   separated (`तथा इति`, `च आगमने`), `सः` for `स`.
2. **Keep compounds whole.** `सूर्यतनयः` is one word in the padaccheda; its parts
   go in `samasa`. Compound-internal sandhi stays as printed.
3. **Keep verbal prefixes on their verbs** (`समुपस्थितौ`, `अभ्यधावत्`).
4. A word broken across two printed lines with a hyphen (`तृप्तिहेतु-` /
   `रुच्चार्यसे`) belongs to the line where it **begins**; give it in full
   (`तृप्तिहेतुः` then `उच्चार्यसे` on the next line).
5. Repeated words are repeated (`नमः`, `तस्यै`, `नमः`, `तस्यै`, … in every
   *yā devī* mantra). Uvāca lines are analysed too: `[["ऋषिः", "उवाच"]]`.
6. Plain Devanagari only — no punctuation, numbers, hyphens or spaces inside a word.

`check.py` rejoins your words by the rules of external sandhi and fails unless
the result spells the recited text. If it says "stuck at word N", your form of
word N (or N−1) is wrong — fix the word, do not fight the checker. A vowel left
unjoined next to another vowel (a **pragṛhya** dual in -ī/-ū/-e, or a metrical
licence) must be declared in `sandhi_exceptions` with the reason; the checker
counts them. Visarga that stands for r (`पुनः`, `अन्तः`, `प्रातः`, vocatives
`मातः`, `पितः`) is known to the checker.

## Word table (`words`)

- `w` = the padaccheda word, exactly. `en` = its meaning **in this verse**
  (where the lexical and the contextual meaning differ, give both: "lit.
  ‘…’; here ‘…’"). `g` = grammar: for nouns/adjectives/pronouns gender, case,
  number and stem; for verbs root (with gaṇa), lakāra, puruṣa, vacana, pada
  (and prayoga when passive); for participles and absolutives the kṛt affix;
  for indeclinables "indeclinable" and what kind; for compounds "compound (see
  Samāsa)" plus case.
- Vocatives are marked "voc. sg." and translated with "O …".

## Vyākaraṇa

- **sandhi**: the meaningful junctions of this verse (typically 2–6). `joined` must
  be a substring of the verse as printed (the checker verifies this). Never
  invent a sandhi where the words simply stand side by side. Name the category
  (vowel / visarga / consonant / anusvāra) and give the rule.
- **Cite Pāṇini only from this list**, by name and number. If another rule is
  needed and you are not certain of its number, describe it in words without a
  number.

  | Rule | Sūtra |
  |---|---|
  | like vowels lengthen | अकः सवर्णे दीर्घः 6.1.101 |
  | a/ā + i/u/ṛ → e/o/ar | आद्गुणः 6.1.87 |
  | a/ā + e/ai/o/au → ai/au | वृद्धिरेचि 6.1.88 |
  | i/u/ṛ → y/v/r before a vowel | इको यणचि 6.1.77 |
  | e/o/ai/au → ay/av/āy/āv | एचोऽयवायावः 6.1.78 |
  | y/v dropped after a/ā (optional) | लोपः शाकल्यस्य 8.3.19 |
  | -e/-o + a → avagraha | एङः पदान्तादति 6.1.109 |
  | pragṛhya duals in ī/ū/e | ईदूदेद्द्विवचनं प्रगृह्यम् 1.1.11, प्लुतप्रगृह्या अचि नित्यम् 6.1.125 |
  | s/sajuṣ → ru | ससजुषो रुः 8.2.66 |
  | ru → u after a, before a | अतो रोरप्लुतादप्लुते 6.1.113 |
  | ru → u after a, before voiced | हशि च 6.1.114 |
  | ru → y after bho/bhago/agho/a/ā, before voiced | भोभगोअघोअपूर्वस्य योऽशि 8.3.17 |
  | ru before r dropped, vowel lengthened | रो रि 8.3.14, ढ्रलोपे पूर्वस्य दीर्घोऽणः 6.3.111 |
  | visarga at pause or before khar | खरवसानयोर्विसर्जनीयः 8.3.15 |
  | visarga → s before khar | विसर्जनीयस्य सः 8.3.34 |
  | s/t → ś/c next to ś/c | स्तोः श्चुना श्चुः 8.4.40 |
  | s/t → ṣ/ṭ next to ṣ/ṭ | ष्टुना ष्टुः 8.4.41 |
  | saḥ/eṣaḥ drop visarga before consonant | एतत्तदोः सुलोपोऽकोरनञ्समासे हलि 6.1.132 |
  | saḥ before vowel in verse | सोऽचि लोपे चेत्पादपूरणम् 6.1.134 |
  | final stop voiced at word end | झलां जशोऽन्ते 8.2.39 |
  | stop unvoiced before unvoiced | खरि च 8.4.55 |
  | stop → nasal before nasal (optional) | यरोऽनुनासिकेऽनुनासिको वा 8.4.45 |
  | t + l → l | तोर्लि 8.4.60 |
  | h → aspirate after stop | झयो होऽन्यतरस्याम् 8.4.62 |
  | ś → ch after stop | शश्छोऽटि 8.4.63 |
  | m → anusvāra before consonant | मोऽनुस्वारः 8.3.23 |
  | anusvāra → class nasal | अनुस्वारस्य ययि परसवर्णः 8.4.58, वा पदान्तस्य 8.4.59 |
  | n + c/ṭ/t → ṃś/ṃṣ/ṃs | नश्छव्यप्रशान् 8.3.7 |
  | nasal doubled after short vowel | ङमो ह्रस्वादचि ङमुण्नित्यम् 8.3.32 |
  | ch → cch | छे च 6.1.73, पदान्ताद्वा 6.1.76 |

- **samasa**: every significant compound of the verse. `c` must be a padaccheda
  word or a part of one. `vigraha` is grammatical Sanskrit (Devanagari). Type
  from: tatpuruṣa (say which: prathamā… saptamī, upapada, nañ), karmadhāraya
  (incl. upamāna-pūrvapada), bahuvrīhi, dvandva (itaretara / samāhāra), dvigu,
  avyayībhāva. Nested compounds: analyse outer then inner. Where two analyses
  are possible give the other in `alt` and say which fits.
- **morph**: the forms worth a learner's attention (verbs, participles,
  absolutives, irregular nominal forms), 1–4 per verse; `form` must be a
  padaccheda word. Don't force categories onto every word.
- **anvaya**: Sanskrit prose order, Devanagari, every word of the verse
  (supplied words in parentheses).

## Translation

- `lit`: follows the grammar; every word accounted for; no embellishment.
- `tr`: natural, dignified English for devotees and students. Never add a
  theological idea the Sanskrit does not contain. If `tr` reorders or
  interprets, say so in `tr_note`.

## Commentary (`comm`) — labelled, and honest about its authority

Labels (`k`): `direct` (direct textual meaning — always first), `traditional`
(traditional commentarial interpretation), `comparative` (comparative Śākta or
Śrīvidyā interpretation), `reflection` (modern spiritual reflection).

- 1–3 items for a narrative verse, 2–4 for a hymn verse. Concise: 1–4 sentences each.
  Uvāca lines: one `direct` item (who speaks to whom, and where in the story).
- **Never invent a commentator, a quotation or a citation.** Do not attribute a
  reading to a named commentator (Nāgojībhaṭṭa, Bhāskararāya's Guptavatī,
  Śantanu, Caturdhara …) unless you are certain of it; otherwise write
  "traditionally" or "in the Śākta tradition". No page or verse numbers you
  cannot verify.
- Do not assume every verse has an esoteric or Śrīvidyā meaning. Use
  `comparative` only where a connection is real and specific. Cite Lalitā
  Sahasranāma names **by number and form exactly as in
  `lalitha-sahasranama/edition/text.json`** (look them up) and Soundarya Lahari
  verses only when you are sure of the number (`soundarya-Lahari/data.js` holds
  the text). Always keep the sources distinct: Devī Māhātmyam — Mārkaṇḍeya
  Purāṇa; Lalitā Sahasranāma — Brahmāṇḍa Purāṇa; Soundarya Lahari — a separate
  hymn.
- `reflection` is clearly modern; never phrase it as an ancient teaching.
- The three caritas' presiding forms (Mahākālī, Mahālakṣmī, Mahāsarasvatī) and
  their viniyoga are liturgical tradition (the Gita Press pāṭha); say so when
  you use them.

## Repeated mantras

Give the full padaccheda and word table every time. Where the grammar is
identical to an earlier verse, `sandhi`/`samasa`/`morph` may be short and point
back ("as in 5.14-16"), but the word table is never abbreviated.

## Chapter introduction, conclusion and report

`analysis/CC.json` also has:

```json
"intro": {"heading_en": "", "carita": "", "summary": "", "forms": "", "significance": "", "grammar": "", "teaching": "", "themes": [""]},
"conclusion": {"narrative": "", "vocabulary": [{"w": "", "en": ""}], "constructions": [""], "insights": [""], "srividya": "", "key_verses": [{"id": "", "why": ""}]},
"report": {"sandhi_patterns": [""], "samasa": [""], "grammar_notes": [""], "themes": [""], "uncertain": [""], "status": "Complete | Complete with Noted Variants | Requires Verification"}
```

`teaching` keeps the spiritual teaching distinct from the literal narrative.
The report's counts (verses, ranges, variants) are generated by the build; write
only the observations. Status is "Complete with Noted Variants" when the chapter
has entries in `corrections.json` variants, "Requires Verification" when any
entry carries `flags.uncertain` about the reading itself.

## Checking a batch

```
python3 scripts/devi_mahatmyam/check.py --part devi-mahatmyam/edition/analysis/parts/CC-x.json
python3 scripts/devi_mahatmyam/check.py --chapter C      # after merging
```

A batch is accepted only with zero problems.
