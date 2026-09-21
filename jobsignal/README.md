# JobSignal pipeline

Ingestion for `/jobs/`. Python 3.12 **stdlib only** — no dependencies, matching
the rest of this repo. Design and rationale: [`../docs/JOBSIGNAL.md`](../docs/JOBSIGNAL.md).

```bash
python3 -m jobsignal.pipeline.build --dry-run          # fetch + compute, write nothing
python3 -m jobsignal.pipeline.build --only stripe      # one employer
python3 -m jobsignal.pipeline.build                    # full run, writes jobs/data/
python3 -m jobsignal.tests.test_pipeline               # unit tests, no network
```

Run from the repository root. In CI this is `.github/workflows/jobsignal-ingest.yml`,
every four hours.

## What it writes

| File | Contents |
| --- | --- |
| `jobs/data/index.json` | compact record per live role — everything a card or filter needs |
| `jobs/data/detail/<xx>.json` | 256 shards keyed by `id[1:3]`: description, requirements, posting history |
| `jobs/data/companies.json` | per-employer roll-up |
| `jobs/data/stats.json` | the homepage counters — computed, never hand-written |
| `jobs/data/health.json` | per-source outcome of the last run |
| `jobs/data/history.json` | the age ledger: `first_seen` per job id, spells per lineage |
| `jobs/data/archive/<YYYY>.json` | closed roles, kept permanently |

## Rules that are not negotiable

1. **`first_seen_at` is written once per job id and never updated.** A rebuild
   that re-dates a role we already knew about defeats the entire product.
2. **No sample, seed or placeholder jobs, ever.** If a run ingests nothing it
   exits 1 and leaves the previous board alone. An empty board is honest; an
   invented one is not.
3. **Nothing is derived in the browser.** Confidence, freshness, age and repost
   counts are computed here, tested here, and shipped as data. `jobs/js/` only
   formats and filters. This is deliberate — see the drift warning about
   `forms.js` / `ps-forms.js` in `CLAUDE.md`.
4. **Tier 1 only.** Public, documented, keyless ATS JSON. No HTML scraping, no
   auth, no CAPTCHA, no aggregator as a source of truth.
5. **The apply link goes to the employer or its ATS.** Anything else is dropped,
   not published with a caveat.

## Adding an employer

Append to `sources.json`:

```json
{
  "company_slug": "acme", "company_name": "Acme", "company_domain": "acme.com",
  "ats_provider": "greenhouse", "ats_slug": "acme", "careers_url": "",
  "industry": "Fintech", "company_size": "1k-5k",
  "is_staffing_firm": false, "enabled": true, "tier": 1, "verified": false
}
```

Then `python3 -m jobsignal.pipeline.build --only acme --dry-run`. A wrong slug
drops that one employer and shows up in `health.json`; it never breaks a run.
Set `verified: true` once a real run has returned postings for it.

> The 27 entries marked `verified: true` were already in production use via
> `interview/scripts/ats_boards.json`. The 12 candidates marked `verified: false`
> have **not** been probed — the container this was built in has no network route
> to ATS hosts — so the first CI run is what confirms or quarantines them.

## Adding an ATS provider

Write `fetch_<provider>(src, fetcher) -> list[raw]` in `adapters.py` and register
it in `ADAPTERS`. Raw records copy the employer's fields verbatim; normalisation
is `normalize.py`'s job. Absent data stays absent — an adapter never fills a
blank with a plausible guess.
