# Navagraha Sūktam — the verified study edition (`/navagraha/edition/`)

Read this and **`docs/SANDHYAVANDANAM-EDITION.md`** (the shared engine,
`scripts/prayoga/`) before touching `navagraha/edition/`. Built 2026-11-04 as the
"Navagraha mantras page" Paddy chose alongside the Sandhyāvandanam edition.
`/navagraha/` (the hand-made ślokas page, with the Pīḍāhara stotram) is untouched
apart from a link.

- **The order and the choice of mantras are witness S's** (stotrasamhita
  `NavagrahaSuktam.tex`): Sūrya, Aṅgāraka, Śukra, Soma, Budha, Bṛhaspati, Śanaiścara,
  Rāhu, Ketu; for each, its mantra (`<graha>`), two more (`<graha>-2`, `-3`) and the
  salutation (`refrain-<graha>`), then `closing` and `santi`.
- **S names the adhidevatā and pratyadhidevatā together** ("अधिदेवता प्रत्यधिदेवता
  सहिताय …"): the edition never says which extra mantra is which.
- **Each mantra is cut from its Vedic source** (`sources.json` → `import.py`): the TS
  pañcāśat text or the TB (Drāviḍa; `agniṃ dūtam` from muralīdhara's TB, which the
  Drāviḍa file lacks), collated with the vākya-krama TS / the muralīdhara or gaṇeśvara
  TB. `ketu-3` (RV 6.6.7) is marked a ṛk in S and its base is GRETIL (no svara).
  Aṅgāraka's second mantra, *syonā pṛthivi*, is Mahānārāyaṇa 10.1.10, shown from that
  edition.
- **Citations** are checked against the commentary files' anuvāka numbers; where the
  pañcāśat text's anuvāka markers drift (TS 1.1.14, 1.6.12, 4.2.11) the citation stops
  at the anuvāka.
- **No astrology and no invented reasons.** Records say what the verse's words are and
  what the commentators say of it in its Vedic setting; its use for a graha belongs to
  the later gṛhya tradition, and nothing is claimed about a graha's effects.
- The landing page compares the graha mantras with another tradition's, the
  Saṃskāraratnamālā (Hiraṇyakeśin): the same for eight grahas, *śukraṃ te anyat* for Śukra.

```bash
python3 scripts/prayoga/import.py navagraha --src <scratch>/src [--rite]
python3 scripts/prayoga/check.py navagraha [--partial] [--only <id>]
node scripts/prayoga/build.mjs navagraha [--check]
```
