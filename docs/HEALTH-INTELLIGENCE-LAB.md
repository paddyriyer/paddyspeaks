# Health Intelligence Lab

Two linked deliverables (the owner's "Personal Health Intelligence Lab" brief, 2026-11-26):

| | Where | What |
|---|---|---|
| **Explorer** | `/health-lab/` | A working dashboard on five synthetic people: Health Overview, Activity Effectiveness, Health Trends, Cohort Explorer, Health Signals, Goal Studio, Annual Health Review, Provider Connect (simulated), Data Sources, Coverage & Economics |
| **Design** | `/interview.app/design/the-health-intelligence-problem.html` (Nº 43) | A Staff/Principal system-design interview in eight rounds, linking to the demo at every step |
| Essay | `/articles/apple-watch-actionable-health-intelligence.html` | The product argument both build on |

## The rules (read before changing anything)

- **Synthetic data only.** Five fictional personas from documented seeds. There is no upload, no real-data path, and nothing is sent anywhere. A real-data pilot waits for the production readiness gate in Round 7 of the design page.
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
  design.py     writes the design page from design/page.html + sql/ + data   (--check in CI)
  sql/          schema.sql, exercises.sql, exercises.out (captured), verify.sh (runs both on PostgreSQL)
  tests/        test_pipeline.py — the acceptance criteria below
health-lab/                   the Explorer (self-contained; does not use style.css)
  index.html lab.css core.js views-a.js views-b.js views-c.js econ.js data/ tests/econ.mjs
```

## Run it

```
python3 -m healthlab.build                 # regenerate data
python3 -m healthlab.design                # regenerate the design page
python3 -m healthlab.tests.test_pipeline   # 39 tests
node health-lab/tests/econ.mjs
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
| Accessibility | `/health-lab/` and the design page are in the axe STRICT list (zero serious/critical) |

## Adding things

- **A persona:** add it to `synth.PERSONAS` and its trajectories in `synth.generate`; rebuild; add a test for what it is meant to demonstrate.
- **A metric:** register it in `ingest.METRICS` (unit, kind, LOINC only if certain, plausible range) and `analyze.CFG` (aggregation, cadence, direction, threshold with its basis); map the source type in the adapter.
- **A published cohort reference:** only with its method, population, n and date, and a method-match statement; set `loaded: true` and change the label logic, which today assumes every cohort is illustrative.
