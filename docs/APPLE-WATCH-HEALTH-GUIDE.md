# Apple Watch health guide — how it is built, and the rules

`articles/your-apple-watch-knows-more-about-your-health.html` (the guide, technology,
16 min) and its companion folder `articles/apple-watch-health/`. Edition 1 published
2026-11-23; Edition 2 (the owner's "Editorial Enhancement Prompt, Version 2.0")
2026-11-24.

## What is where

| Path | What | Edited by hand? |
|---|---|---|
| `articles/your-apple-watch-knows-more-about-your-health.html` | The guide: core path for everyone, `details.lvl-b` (data-minded) and `details.lvl-c` (clinically curious) layers | Yes, except between `<!-- awh:* -->` markers |
| `articles/apple-watch-health/reference.html` | Feature status, inventory, validation evidence, audit method, synthetic audit, scripts, apps, source audit, change log | Yes, except between markers |
| `articles/apple-watch-health/guide.css`, `guide.js` | Shared styles and behaviour (copy, print-one-section, contents marker) | Yes; `?v=` is stamped by the build |
| `articles/apple-watch-health/health-analyst-prompt.txt` | **The single source of the AI prompt**; embedded into the guide by the build | Yes |
| `articles/apple-watch-health/clinician-summary.md` / `.html` | The clinician template (editable / printable) | Yes; keep the ten sections identical (tested) |
| `articles/apple-watch-health/code/*.py` | Teaching scripts (stdlib only) | Yes; tests must pass |
| `articles/apple-watch-health/code/sample/export.xml` | Synthetic sample export with the hard cases | Yes |
| `code/sample/expected-*.csv`, `data/synthetic-year.csv` | **GENERATED** | Never |
| `scripts/apple_watch_health/build.py` | Generates the synthetic year, the audit, the charts, the 1,000-person example, the sample output, the embedded prompt | — |
| `scripts/apple_watch_health/test_scripts.py` | Tests the scripts, prompt and template | — |

```
python3 scripts/apple_watch_health/build.py          # after any change to the above
python3 scripts/apple_watch_health/build.py --check  # CI (Validate Content)
python3 scripts/apple_watch_health/test_scripts.py   # CI (Validate Content)
```

## Rules

1. **Never type a number into the audit, charts, the 1,000-person example or the sample
   output.** They are generated from seeded synthetic data and the real script output.
2. **Synthetic is always labelled.** No real person's data, ever. The invented year and
   its events are listed in `build.py` (ILLNESS, TRAVEL, NO_WEAR, NEW_JOB, DEVICE_CHANGE).
3. **The watch measures neither blood pressure nor glucose.** Never imply otherwise.
4. **No diagnosis, no medication advice.** Clinical layers are informational; "a clinician
   might consider…" never becomes "ask for…".
5. **Absent data is "not assessed", never "normal".**
6. **Comparison windows:** non-overlapping periods inside one year; a same-season
   comparison needs ≥ 730 days. Overlapping windows are never independent comparisons.
7. **HRV:** never compare devices or SDNN with RMSSD; a watch change is a break.
8. **Images.** Schematic cards are captioned "schematic, not data". Mock-ups of phone or
   watch screens are captioned "not a real Apple screen; every value is invented", and any
   factual error in them is corrected in the caption (walking steadiness is OK / Low /
   Very Low; mobility measures come from the iPhone). The owner's "Insights Grid" image is
   not used: it contains the typo "Walkiing".
9. **Feature status is dated.** Re-check the R1 table, the Series 12 / Ultra 4 hypertension
   clearance, Health Age (beta in iOS 27.3 on 2026-11-24) and app prices on every edit.
10. **American English** in all prose (the owner's brief).
11. Labels: Docs · Guideline · Research · Inference · Unknown · Synthetic.

## Edition 2 change log (2026-11-24)

- **Retained:** the Vikram opening, observability and portfolio lines, the thesis, the
  Collect → Verify → Interpret → Act ladder, the privacy core, the closing, the HRV and
  measure-verify-decide cards, the share card.
- **Condensed:** scenarios (cards), the 30/60/90 plan, privacy, the export walkthrough.
- **Moved to the reference:** the seven-field inventory, the app comparison, the full audit
  method, the scripts.
- **Corrected:** comparison windows (Edition 1 compared "the same 90 days a year ago",
  impossible in one year); the converter's memory (emptied elements and workouts stayed
  attached to the root) and missing input checks; the daily script ignored sleep, partial
  days and units; the prompt *looked* truncated (it had 12 steps, but a 640 px scroll box
  hid everything after Step 2); image captions; labels.
- **Expanded:** clinical and data layers; validation evidence; the prompt (15 steps, two
  outputs); guideline and FDA sources.
- **New:** Start here (15 minutes); reliability legend; What your watch cannot tell you;
  decision tree; sensitivity in 1,000 people; the synthetic audited year with charts;
  clinician template; printable checklist; feature status; sticky contents; the owner's
  2026-11-24 image set (nine of ten used); seven Edition 1 cards retired.

## Source audit notes

Apple's support pages could not be fetched from the cloud container (network policy);
their wording was verified through search results quoting them. Not verified and therefore
not quoted: BASEL's Apple-specific sensitivity/specificity; a "30-second single lead"
criterion in the 2023 AF guideline. The 2025 BP guideline's position on cuffless devices
is verified through AMA, AAFP and UT Southwestern summaries, not the guideline text; the
2026 JAMA hypertension-notification analysis through the University of Utah summary.
