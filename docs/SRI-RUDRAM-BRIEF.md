# Śrī Rudram — the analysis brief

The fixed brief for writing `rudramchamakam/edition/analysis/`. Every anuvāka is
written to it and proven by `scripts/rudram/check.py` before it is accepted.
Read `docs/SRI-RUDRAM-EDITION.md` for the architecture and the sources.

**The model entries are in `rudramchamakam/edition/analysis/models.json`**
(Namakam 1.1–1.2, Chamakam 1.2). Match their depth, tone and format.

The order of work is fixed: **verify the Sanskrit first, explain it second,
interpret it third.** The Sanskrit is already verified (`text.json`); you never
change it. If you believe the text is wrong, add a `flags` entry
(`kind: "variant"`) and say why — never alter `text.json` or work around it.

## What you are given

- `rudramchamakam/edition/text.json` — the Saṃhitā, anuvāka → units. A unit's
  `samhita` is the accented text exactly as recited, Taittirīya orthography
  (doubled sibilants for visarga: `नम॑स्स॒स्पिञ्ज॑राय`; ᳵ ᳶ for visarga before k/p;
  nasals assimilated: `दि॒शाञ्च॒`, `सव्ँ॒वृध्व॑ने`). `[21]` is a pañcāśat mark (the
  traditional 50-word division): **sandhi does not apply across it**, nor across
  `।` / `॥`.
- `rudramchamakam/edition/witnesses/sayana.json` — Sāyaṇa's bhāṣya (and his
  viniyoga) for each anuvāka, in Sanskrit. **This is your authority for the
  traditional interpretation.** Read the whole bhāṣya on your anuvāka first.
- `rudramchamakam/edition/corrections.json` — the three corrections made to the
  base witness and the classified differences of the second witness. If a unit
  you write has an entry, mention it in `flags` (`kind: "variant"`).
- Reference only (never copy): Keith's 1914 translation of the Taittirīya
  Saṃhitā, and the Monier-Williams dictionary (a lookup script is given to you).
  Your translation follows the Sanskrit grammar and Sāyaṇa, in your own words.

## What you write: `analysis/N01.json` … `N11.json`, `C01.json` … `C11.json`

```json
{
 "id": "N3",
 "title": {"sa": "तृतीयोऽनुवाकः", "en": "a short English title"},
 "summary": "2–4 sentences: what the anuvāka does, grounded in Sāyaṇa.",
 "units": [ { one entry per unit of text.json, in order, "n" = the unit number } ]
}
```

A unit entry (see the models):

| Field | What | Rules |
|---|---|---|
| `n` | unit number | as in text.json |
| `padaccheda` | the words, in order | see *Padaccheda* below |
| `words` | one entry per padaccheda word, same order | `w` (exactly the padaccheda word), `base` (prātipadika, or `√root` for a verb, in Devanagari), `gram` (brief: `m. dat. sg.`, `indecl., particle`, `verb, root as (2nd class, P.), imperative 3rd sg. active`), `meaning` (literal English), optional `context` (the meaning here, if different; Sāyaṇa's gloss) |
| `sandhi` | every meaningful junction | `joined` (as it stands in the unit, Devanagari, may span words), `split` (the padaccheda words it resolves to), `type`, `rule` (what changes and why; cite a Pāṇini sūtra only when you are certain of it) |
| `sandhi_exceptions` | junctions the rules do not produce | `after` (0-based index, within this unit, of the word before the junction), `kind`, `note`, and `left` / `right` (the surface spelling of that word / the next as the text shows it, when it differs from the padaccheda) |
| `samasa` | every genuine compound | `word` (a padaccheda word), `members` (Devanagari list), `type` (tatpuruṣa, karmadhāraya, bahuvrīhi, dvandva, dvigu, avyayībhāva, upapada-tatpuruṣa …), `vigraha` (Sanskrit vigraha-vākya), `meaning` |
| `vyakarana` | notes on words that need them | `word`, `note`: prātipadika, liṅga, vibhakti, vacana, dhātu, lakāra, puruṣa, Vedic forms (do not normalise Vedic to Classical) |
| `translation` | `literal` and `readable` | literal follows the grammar word by word; readable is fluent but adds nothing absent from the Sanskrit; supplied words in [square brackets] in the literal |
| `traditional` | the traditional interpretation | from Sāyaṇa; must name Sāyaṇa; see *Quoting* |
| `reflection` | optional | a modern contemplative reflection, clearly a reflection, one or two sentences, grounded in the mantra's own words |
| `flags` | optional list | `kind`: `uncertain` (a doubt about meaning or grammar), `variant` (a reading question), `svara`, `interpretation` (where Sāyaṇa and the dictionaries differ) — with a `note` |

## Padaccheda — the rules, and how the checker proves them

1. Every word in its **own (pausal) form**: visarga restored (`नमः` not `नमो`,
   `रुद्रेभ्यः`), final `m` (`शिवम्`), final `t` (`अवोचत्`), final `n`
   (`अहीन्`, `सर्वान्`, `जम्भयन्`), elided vowels restored (`अपानः` after
   `मे`), fused vowels separated (`च इमाम्` from `चेमाँ`, `उत उ` from `उतो`,
   `ते इषवे` from `त इषवे`, `मे आत्मा` from `म आत्मा`).
2. **Keep compounds whole** (`हिरण्यबाहवे`, `पशुपतये`, `कृष्टपच्यम्`); their parts go
   in `samasa`. Compound-internal sandhi stays as written.
3. **Keep verbal prefixes on their verbs** when written together (`अवसर्पति`);
   a preverb standing apart (`प्र … भरामहे`, `अव … तन्मसि`, `नि … धेहि`) is its own
   word. (Namakam 1.3 keeps `अभिचाकशीहि` whole with a note; either is proven.)
4. **Every particle is a word.** `च`, `मे`, `ते`, `नः`, `वः`, `उत`, `उ`, `नमः`
   — however often they repeat. In the Chamakam the refrain `च मे` follows every
   item and every one is listed (the model C1.2 has thirty words).
5. Plain Devanagari, no accents, no avagraha, no spaces or hyphens.
6. A final m is `म्`. Inside a word use the ordinary spelling: anusvāra `ं` where
   the text writes the Taittirīya `ँ` before a sibilant or h (`हिंसीः`,
   `एकविंशतिः`, `भूयांसः`, `अंशुः`); class nasals stay as written (`पञ्च`,
   `सस्पिञ्जराय`).

`check.py` rejoins the words of the **whole anuvāka** by external sandhi and
fails unless the result spells the Saṃhitā (accent and nasal spelling aside).
If it says the rejoining stops matching at some point, your form of a word
there is wrong (or a word is missing / extra) — fix the word; do not fight the
checker. What it knows: vowel sandhi (incl. the Vedic non-elision `नमो अस्तु`,
`ते अस्तु`), visarga sandhi (incl. the doubled sibilant, ᳵ ᳶ, `अन्धसस्पते`),
consonant sandhi (incl. `अहीँश्च`, `सर्वाञ्ज`, `जम्भयन्त्सर्वाः`, `बाणवाँ उत`,
`चेमाँ रुद्राः`), pauses at dandas and `[N]`.

Declare in `sandhi_exceptions` what the rules do not produce:
`pragṛhya` (a dual in -ī/-ū/-e, the particle `उ`, … left in hiatus),
`vedic-lengthening` (`मृडा नः`, `रक्षा च` — give `left: "मृडा"`),
`recitational-doubling` (`परि॑ ब्भुज` — give `right: "ब्भुज"`),
`vedic-sandhi` (another Vedic junction; say which), `prakṛtibhāva`.
The checker fails an exception that is not needed.

## Word meanings and grammar

- One entry per word, even for the hundredth `च`. Keep repeated entries
  consistent (copy them).
- `meaning` is the literal sense; Sāyaṇa's contextual gloss goes in `context`
  (e.g. `शिवतमा` — meaning "most auspicious", context "Sāyaṇa: शान्ततमा, most calm").
- Vedic forms stay Vedic: `वाजेभिः` (= classical वाजैः), `तनुवा`, `बाहुवोः`,
  `मीढुषे`, `कृधि`, `वदामसि`, `तन्मसि`, `हिँसीः` (injunctive with mā),
  `विश्वाह`. Explain them in `vyakarana`.
- Use the standard abbreviations: m. f. n.; nom. acc. instr. dat. abl. gen. loc.
  voc.; sg. du. pl.; indecl.; pron.; adj.; P./Ā. (parasmaipada/ātmanepada).
- Where you are not sure of a form or a sense, say so in `flags.uncertain`;
  never guess silently. Monier-Williams is available for the rarer words
  (`kūyava`, `vyaśniya`, `āntyāyana`, `dityavāh`, `āhananya`, …).

## Translation

- `literal` accounts for every word, in Sanskrit grammar; supplied words in
  [brackets] (e.g. the verb `कल्पताम्` that Sāyaṇa supplies to every Chamakam
  item from anuvāka 10: "[may] food [be ready] for me").
- `readable` is natural English, faithful, with nothing imported.
- Translate, do not interpret. No "energy", "vibration", "cosmic", "chakra",
  "consciousness-field" and the like anywhere outside `reflection` — the
  checker rejects them.

## Quoting (the checker enforces this)

- `traditional` must name **Sāyaṇa**. Report what he says, in English, and
  quote him in Devanagari where it helps (in « »). **Every Devanagari word or
  phrase you put in `traditional` must occur verbatim in Sāyaṇa's bhāṣya on that
  anuvāka** (accents, spaces and punctuation aside; a gloss may be cited with its
  final visarga) **or be a word of the mantra itself.** So copy his words; never
  reconstruct or paraphrase them in Sanskrit.
- If Sāyaṇa passes over a unit (he calls some yajus स्पष्टार्थ, "clear in meaning")
  say so: "Sāyaṇa treats this yajus as clear and adds only …".
- Never attribute anything to any other commentator, text or tradition unless
  it is in the bhāṣya you were given (Sāyaṇa himself quotes the Kalpa and the
  Brāhmaṇa — you may report those as quoted by him).
- `reflection` is optional and clearly modern ("A reflection: …" is not
  needed — the page labels it). It never claims to be what the mantra says.

## Style

English: plain, exact, unhurried. Sanskrit terms in IAST in English prose
(`namaḥ`, `ca me`), Devanagari only for words and quotations. No exclamation,
no devotional superlatives, no claims about effects of chanting.

## How to check your work

```
python3 scripts/rudram/check.py --file rudramchamakam/edition/analysis/N03.json
python3 scripts/rudram/check.py --file … --partial      # while only the first k units exist
```

The file is accepted only when this prints `ok`.
