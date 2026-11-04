# Sandhyāvandanam — the verified study edition (`/sandhyavandanam/edition/`)

Read this before touching `sandhyavandanam/edition/` or `scripts/prayoga/`.
Started 2026-11-04 at Paddy's request ("cover all important verses" of the
Upaniṣads that carry the Sandhyāvandanam and the Navagrahas; he chose a
Sandhyāvandanam edition built around the Mahānārāyaṇa plus the Saṃhitā mantras
it uses, and a separate Navagraha mantras page, each verified against sources).

The rite is the Kṛṣṇa Yajurveda Sandhyāvandanam of the Āpastamba sūtra, in the
Smārta form used in Tamil Nadu, for the three services (morning, midday,
evening). `/sandhyavandanam/` (the hand-made 50 questions & answers page) is
untouched apart from a link to the edition.

## Files

| file | what |
|---|---|
| `edition/rite.json` | **The order of the rite**: 29 steps, each with `sa`, `en`, `what` (the editor's description) and `items`. An item is a text of the rite `{t}`, a Vedic mantra `{v}`, or a Mahānārāyaṇa unit `{mnu}` (optionally the recited part `from`…`to`); `only` limits it to some services; `title` names a Mahānārāyaṇa part whose anuvāka title does not fit it. A record may also mark a pause the witness keeps but writes no danda for (`lines` + `pause_note`, checked letter for letter). Hand-authored from witness M, checked against S. |
| `edition/edition.json` | The edition's names, the witnesses of its rite texts (path, label, commit; `tex` for the stotrasamhita LaTeX) and the words its pages use. The engine serves `/navagraha/edition/` from the same code (`docs/NAVAGRAHA-EDITION.md`). |
| `edition/sources.json` | Where each Vedic mantra not in the Mahānārāyaṇa is cut from: work (TS/TA/TB), file, the unit's incipit/explicit (compared by sound), its citation, its Ṛgveda parallel, the commentary file. `w2inc`/`w2exp` where the second witness reads differently. |
| `edition/rite-texts.json` | The non-Vedic texts of the rite (names, saṅkalpas, viniyogas, nyāsas, verses): kind, title, and where each is cut from M and S. |
| `edition/text.json` | **The Sanskrit.** `mantras[].units[]`: `samhita` (the base witness's Taittirīya spelling with svara, plus logged corrections) and `plain` (the standard spelling the word division is proven against; same sounds, checked). `texts{}`: each text of the rite and its base witness (`S` where S has it, else `M`). Hand-maintained after the import; `import.py` refuses to overwrite the texts. |
| `edition/corrections.json` | `text`: every change to a base witness, with its reason. `collation`: every difference of the other witness (W2 for Vedic units, M or S for the texts), classified orthographic / variant / witness-error / recension / review. |
| `edition/witnesses/` | `W1`, `W2` (the Vedic units as each witness has them), `RV` (Ṛgveda parallels, GRETIL), `M`, `S` (the texts of the rite as each prayoga has them), `comm.json` (the commentaries on each source anuvāka, block by block). Written by `import.py`. |
| `edition/analysis/<id>.json` | One record per recited item (Vedic mantra or text of the rite): `units[]` (padaccheda, words, sandhi, samasa, morphology, translation), `meaning`, `in_the_rite`, `commentary` (Vedic only), `notes`, `flags`. Model: `a-satyena.json`; the brief for writing them is in the session scratch (`work/sv-brief.md`) and summarised below. |
| `edition/landing.json` | The landing page's prose. |
| `edition/rite.css` | What the shared `/upanishads/lib/edition.css` lacks. |
| `edition/*.html` | **GENERATED** by `node scripts/prayoga/build.mjs sandhyavandanam`. Never edit. |

## Witnesses

- **W1** — the Taittirīya Saṃhitā in pañcāśat divisions (vishvAsa `saMhitA/mUlam/panchAti-kramaH`), the muralīdhara Āraṇyaka, the Drāviḍa Brāhmaṇa; svara as keyed. The base of every Vedic unit.
- **W2** — the vākya-krama Saṃhitā (Weber's orthography), the gaṇeśvara Āraṇyaka (OCR, noisy), the muralīdhara Brāhmaṇa.
- **RV** — GRETIL's Ṛgveda (Aufrecht 1877). A parallel in another recension, printed beside the Taittirīya text, never collated into it. GRETIL keys RV 5.85.8 as `05.085.00.81/82`; `GRETIL_FIX` in `import.py` records it.
- **M** — the Sandhyāvandana prayoga of the Mylapore Veda Adhyayana Sabhā (A. Subbaraman), as transcribed in vishvAsa (`…/paddhatiH/mailApura-vedAdhyayana-sabhA/sandhyAvandanam.md`). Base for the order and for the texts only M has (viniyogas, nyāsas, the seat, the time-specific dhyānas). Its transcription writes words unjoined and has typos; they are classified, not silently fixed.
- **S** — `Sandhyavandanam.tex`, github.com/stotrasamhita/vedamantra-book (commit in `witnesses/S.json`). Base for the texts both prayogas have (it writes the sandhi joined). The repository is "for personal study"; it is used as a witness and the edition's text is its own.
- **Commentaries** — Sāyaṇa and Bhaṭṭa Bhāskara on the TS (vishvAsa `sarva-prastutiH`, blocks labelled सायण-टीका, भट्टभास्कर-टीका, the viniyogas, and Sāyaṇa on the RV where included); Sāyaṇa on the TB (`brAhmaNam/sarva-prastutiH`); Sāyaṇa on TA 2 and Bhaṭṭa Bhāskara on the Drāviḍa TA 7 (= TA 4.42; the corpus's Sāyaṇa file for TA 4 is empty).

The Mahānārāyaṇa mantras (prāṇāyāma, the prāśanas, āyātu, ojo 'si, uttame
śikhare, ṛtaṃ ca satyaṃ ca, ṛtaṃ satyam, adyā no deva) are NOT re-edited here:
`rite.json` points at the units of `/upanishads/mahanarayana/`, whose checker
proves them, and the pages show that edition's text and translation with a link.

## Rules

- **Never type Sanskrit into a page or a record's text.** Vedic units come from
  W1 by `import.py`; texts of the rite from M/S. Every change to a base witness
  is a `corrections.text` entry; every difference of the other witness a
  `collation` entry. `check.py` fails on an unlisted difference and on a stale entry.
- **Never attribute a traditional verse to a work** (a purāṇa, the Mahābhārata, a
  smṛti) unless a witness names it or a checked source is imported — neither
  prayoga names one, so the edition names none.
- **Never call the anonymous Mahānārāyaṇa commentary Sāyaṇa's.**
- Every «quotation» in a record's `commentary` must occur in that commentator's
  text on the source anuvāka (`witnesses/comm.json`); an ellipsis inside « » fails.
- The Saṃhitā's jihvāmūlīya/upadhmānīya (ᳵ ᳶ) have no glyph in the fonts; pages
  show them as a visarga in `<abbr class="jm">` titled with the witness's sign.
- Svara is shown as W1 keys it; it is not reconstructed.

## Commands

```bash
python3 scripts/prayoga/import.py sandhyavandanam --src <scratch>/src          # re-cut the witnesses (W1 W2 RV comm)
python3 scripts/prayoga/import.py sandhyavandanam --src <scratch>/src --rite   # re-cut M and S
python3 scripts/prayoga/check.py sandhyavandanam [--partial] [--only <id>]
node scripts/prayoga/build.mjs sandhyavandanam [--check]
```

`--src` is a directory with sparse clones of github.com/vishvAsa/vedAH_yajuH
(`yajuH/`: the TS mūla and sarva-prastutiH, the TA, the TB, the Āpastamba
paddhati) and github.com/sanskrit/raw_etexts (`raw/`: GRETIL's Ṛgveda), plus
`ext/svm/Sandhyavandanam.tex` from stotrasamhita. Both checks run in Validate
Content; the pages' phone-width check runs in the Accessibility workflow
(`scripts/upanishads/render_test.mjs`), and four pages are in axe's strict list.

## The analysis records

Every recited item has one. Vedic records quote Sāyaṇa / Bhaṭṭa Bhāskara; texts
of the rite have no commentary and name no source work. `meaning` is 30–220
words; `in_the_rite` says where and how the item is used, from `rite.json` and
the viniyogas, never inventing a gesture. The unit checker is the Upaniṣad
editions' (`scripts/upanishads/check.py` `check_unit`): padaccheda must rejoin by
sandhi into the unit (Vedic units: into `plain`), the word table must list exactly
the padaccheda words.

## Next

- The Navagraha mantras page (`/navagraha/edition/`) on the same engine.
- TA 2.2 (the Sandhyā brāhmaṇa, `sandhya-brahmana`) is imported with Sāyaṇa's
  commentary and shown on the landing page with an editor's summary; its full
  analysis is not yet written.
- Scholarly review of every record (all are `draft`).
