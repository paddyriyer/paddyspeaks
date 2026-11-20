# The Reaction Problem — sources

Systems at the Whiteboard Nº 41, `interview.app/design/the-reaction-problem.html`.
The page's code blocks and result tables are **copied in from these files**; never
edit them in the HTML.

| Path | What | Verified by |
|---|---|---|
| `sql/*.sql` | schema, ingest, mood, integrity, SLO, ledger (PostgreSQL 16) | `verify.py` |
| `py/*.py` | client batcher, admission, edge pre-aggregator, fan-out, guardrail | `py/test_reaction.py` |
| `py/seed.py` | deterministic **synthetic** data (no real match, platform or person) | `verify.py` |
| `flink/mood.sql` | the aggregation as a Flink SQL job | **not executed** (labelled on the page) |
| `results/*.txt` | the result tables the page quotes | written by `verify.py` |

```bash
# 1. run the SQL against PostgreSQL (needs psql and a superuser) and refresh results/
PGHOST=... PGPORT=... PGUSER=postgres python3 interview/whiteboard/reaction/verify.py
# 2. run the Python tests
(cd interview/whiteboard/reaction/py && python3 -m unittest -v test_reaction)
# 3. copy code and results into the page
python3 interview/whiteboard/build.py reaction   # --check in CI
```

`verify.py` asserts what the page claims: idempotent ingest (a second pass changes
nothing), one voice per person-second, revisions only grow, the integrity rule
excludes every scripted session and no genuine one, exactly one seeded spoiler,
totals that agree while two orders break, and the three refusals of `charge()`.
CI (Validate Content) runs step 2 and `interview/whiteboard/build.py --check`; it does not run
PostgreSQL. After changing any SQL, run step 1 before step 3.
