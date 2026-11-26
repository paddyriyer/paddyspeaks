# Health Intelligence Lab

Linked deliverables (the owner's "Personal Health Intelligence Lab" brief, 2026-11-26, and the
"Lab 3.0 — From Personal Data Ownership to Preventive Health Intelligence" brief, same day):

| | Where | What |
|---|---|---|
| **Explorer** | `/health-lab/` | A working dashboard on five synthetic people: Health Overview, Activity Effectiveness, Health Trends, Cohort Explorer, Health Signals, Goal Studio, Annual Health Review, Provider Connect (simulated), Data Sources, Coverage & Economics |
| **My Private Health Lab** | `/health-lab/private/` | Local-first import and analysis in the browser: Apple Health export.zip/xml, device CSVs, FHIR bundles. **Synthetic files only on the public site** |
| **Design** | `/interview.app/design/the-health-intelligence-problem.html` (Nº 43) | A Staff/Principal system-design interview in eight rounds, linking to the demo at every step |
| **Design** | `/interview.app/design/the-private-health-lab-problem.html` (Nº 44) | Privacy-first platform: HealthKit, clinical data, local analytics, interoperability; 15 topics, 11 hard questions, real code, the real-data readiness gate (`#gate`) |
| Essay | `/articles/apple-watch-actionable-health-intelligence.html` | The product argument both build on |

## The rules (read before changing anything)

- **Synthetic data only.** Five fictional personas from documented seeds. There is no upload; the Explorer reads only its own synthetic files (plus the site-wide anonymous page view). A real-data pilot waits for the readiness gate (Nº 44 `#gate`, Nº 43 Round 7).
- **My Private Health Lab never transmits a file.** It reads files in a Web Worker (`health-lab/private/worker.js` → `health-lab/engine.js`) and keeps everything in memory; "Delete everything now" terminates the worker. The page has a strict CSP (`connect-src 'self'`), no analytics pixel, no `ps-platform.js`, no web fonts. `health-lab/tests/browser.mjs` proves zero requests after a file is chosen. Never add a script, font, pixel or network call to `health-lab/private/`.
- **Real files are refused on the public site.** Every sample carries the marker `PADDYSPEAKS-SYNTHETIC-DATA` (`synth.SYNTHETIC_MARK`); the engine refuses a file without it. Real files are accepted only on localhost with `?allow-real=1`. Do not relax this until every item of the Nº 44 readiness gate has an owner and evidence.
- **The browser engine mirrors Python.** `engine.js` is driven by `meta.json`'s `import_spec` (metrics, ranges, unit factors, LOINC map, rules); `health-lab/tests/parity.json` is written by `healthlab.build` and `node health-lab/tests/engine.mjs` checks the engine against it. Change a rule in Python and the spec, never in the JS alone. The engine must contain no network API (the test scans for it).
- **Never invent an Apple service.** Apple sells no health-data API or analytics subscription (checked 26 Nov 2026; the feasibility table in the Import & Privacy view carries the sources). Never imply a browser can read HealthKit.
- **No promise of anonymity.** The anonymity view and Nº 44 distinguish confidentiality, encryption, pseudonymization, de-identification, aggregation and differential privacy. Cohort cells under `analyze.MIN_CELL` (100) are suppressed; it is a product setting, never presented as a legal threshold. The re-identification table comes from a synthetic population (`healthlab/anonymity.py`) and says so.
- **Medications are reconciled, never resolved.** `ingest.reconcile_medications` keeps prescribed, dispensed, listed and patient-reported apart; status is active · historical · discontinued · needs review; no advice.
- **Never type a number.** Every value the Explorer shows is computed by `healthlab/` and shipped in `health-lab/data/*.json` (CI `python3 -m healthlab.build --check`). The browser formats and filters; it does not judge. The two exceptions run on the *visitor's own assumptions*, not on health data: the Goal Studio's arithmetic projection and the economics simulator (`health-lab/econ.js`, tested by `health-lab/tests/econ.mjs`).
- **No health score.** Every label is Improving · Stable · Declining · Insufficient evidence (or "Changed" when weight is not a goal), with the metric, threshold, basis and coverage behind it.
- **Insufficient evidence is an answer.** A window with fewer than half its days (or too few readings for sparse metrics) is never compared. Gaps are never zeros.
- **Thresholds are labelled.** Most are product choices and say so (`analyze.CFG[...]["basis"]`). The only cited clinical basis is walking speed (Perera et al., 2006); sleep uses the adult consensus of 7 hours or more.
- **No diagnosis, prediction, medication advice or safety certification.** The explanation layer (`healthlab/explain.py`) refuses those before reading any data; the test suite holds the safe and unsafe questions.
- **Grounding.** Every number in an explanation must appear in a cited fact, or the answer is withheld.
- **Conditions are never inferred.** Cohort condition filters need a confirmed FHIR `Condition`; patient entries stay `patient_reported`.
- **Cohorts are illustrative.** The cohort tables are generated from seed 9090 and labelled "Not a published reference" everywhere. Published references are catalogued with their method mismatch and are not loaded.
- **Signals.** Four tiers: observed, requires context, worth discussing, potential urgency. A change must sit outside the person's own 10th–90th percentile *and* be at least the product threshold away, for 7+ days. Only travel and short illnesses count as context; other symptoms are shown as related records, never used to explain a change away. Urgent symptom terms escalate whatever the data say.
- **Provider Connect is simulated** and says "not monitored" on every summary. Revocation stops future sharing; a copy the clinic filed stays under the clinic's rules.
- **Economics never assumes savings.** Utilization change defaults to 0 and is labelled Hypothetical; evidence cards cite the null workplace-wellness trials and the DPP; never selling patient-level data.
- **Do not call anything HIPAA-compliant.** Applicability depends on the organizations and flows; a test bans the phrase in the shipped data.

## Files

```
healthlab/                    Python, stdlib only
  synth.py      personas → source files in native formats (Apple export.xml, ring/cuff/scale/CGM CSV,
                FHIR R4 bundle, user entries), with deliberate data problems
  ingest.py     adapters → canonical observations with provenance; units (exact factors), time zones,
                duplicates, rejections, conflicts, medication-status conflicts, stale labs
  analyze.py    windows, signals, workouts and the same-speed regression, goals, cohorts, annual review,
                provider summaries, overview
  explain.py    the refusal policy and grounding check
  build.py      writes health-lab/data/{meta,profile-a..e}.json   (--check in CI)
  anonymity.py  synthetic population (20,000) for the re-identification table
  design.py     writes Nº 43 (design/page.html + sql/ + data) and Nº 44 (design/private-lab.html +
                engine.js and ingest.py excerpts + data)   (--check in CI)
  sql/          schema.sql, exercises.sql, exercises.out (captured), verify.sh (runs both on PostgreSQL)
  tests/        test_pipeline.py — the acceptance criteria below
health-lab/                   the Explorer (self-contained; does not use style.css)
  index.html lab.css core.js views-a.js views-b.js views-c.js views-d.js econ.js data/
  engine.js     the local import/analysis engine (UMD; browser worker and Node)
  private/      My Private Health Lab: index.html (CSP), private.js, private.css, worker.js
  samples/      synthetic sample files, GENERATED by healthlab.build (marked)
  tests/        econ.mjs, engine.mjs (parity + no network code), browser.mjs (Playwright), parity.json
```

## Run it

```
python3 -m healthlab.build                 # regenerate data
python3 -m healthlab.design                # regenerate the design page
python3 -m healthlab.tests.test_pipeline
node health-lab/tests/econ.mjs
node health-lab/tests/engine.mjs
A11Y_DEPS=/path/with/playwright node health-lab/tests/browser.mjs   # Accessibility workflow
bash healthlab/sql/verify.sh --write       # needs a local PostgreSQL 16; refreshes exercises.out
```

The design page's SQL is embedded from `healthlab/sql/`; its query results come from `exercises.out`. If you change the SQL, run `verify.sh --write`, then `python3 -m healthlab.design`.

## Testing — acceptance criteria

| Area | Test |
|---|---|
| Import correctness, duplicates | Alex's re-imported February is dropped; importing the same file twice adds nothing |
| Unit conversion | lb→kg exact; IFCC mmol/mol→NGSP % by the master equation; km/h→m/s; unknown units rejected with a reason |
| Time zones | A 23:30 Tokyo reading stays on Tokyo's day; away days flagged |
| Missing data | Eli's windows are all insufficient; the annual narrative says "Absence is not a normal result" |
| Conflicting sources | Ring readings kept; resting-HR trend uses the watch; conflict days noted |
| Medication status | Record never overwritten by a patient report; conflict surfaced |
| Calculations | percentiles, Theil–Sen, OLS, every classification rule |
| Cohort eligibility | Conditions only when confirmed; illustrative label; monotonic percentiles |
| Signals | Ben's blood-pressure rise is worth discussing with related records; Alex's cold is context; a headache never explains a change; urgent symptoms escalate |
| AI grounding | Unsafe questions refused by category; invented numbers withheld; shipped answers grounded |
| Language | No "health score", "HIPAA-compliant", "cure", "you have …" in shipped data |
| Determinism | Same seed, same bytes; data and design page current |
| Local import | Parity of the browser engine with Python on five sample bundles; malformed records rejected one by one; cancel rejects |
| No transmission | Browser test: CSP present and blocks another origin; nothing loaded from another site; zero requests after choosing files; Delete clears |
| Real-data gate | An unmarked file is refused before parsing |
| Medication reconciliation | Ben: needs review with two reasons and four source kinds; Carmen's atorvastatin historical |
| Coverage | Statuses computed (available, partial, stale, requires external source, …); stale lipids flagged |
| Suppression | Cohort strata under 100 have no statistics; the Explorer says so |
| Accessibility | `/health-lab/`, `/health-lab/private/` and both design pages are in the axe STRICT list (zero serious/critical) |

## Adding things

- **A persona:** add it to `synth.PERSONAS` and its trajectories in `synth.generate`; rebuild; add a test for what it is meant to demonstrate.
- **A metric:** register it in `ingest.METRICS` (unit, kind, LOINC only if certain, plausible range) and `analyze.CFG` (aggregation, cadence, direction, threshold with its basis); map the source type in the adapter.
- **A published cohort reference:** only with its method, population, n and date, and a method-match statement; set `loaded: true` and change the label logic, which today assumes every cohort is illustrative.

## Existing versus proposed (Lab 3.0)

| Capability | Status |
|---|---|
| Synthetic Explorer, new views Import & Privacy · Can It Be Anonymous? · My Data Rights; coverage panel; five-question strip; signal kinds; cohort suppression; provider stepper and medication list; processing economics | Live |
| Local import of synthetic Apple export, device CSV, FHIR; inventory; findings; medications; clinician summary (.md) | Live prototype, synthetic files only |
| Real-file import | Localhost only (`?allow-real=1`) |
| HealthKit companion app, SMART on FHIR connection, managed service (Mode 3), provider delivery, payer programs | Design only (Nº 44); simulated in the Explorer |
