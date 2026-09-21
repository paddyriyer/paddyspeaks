# PaddySpeaks JobSignal — architecture, schema and build plan

> **Promise:** _Jobs that still exist._
> JobSignal does not claim a job is real. It shows what was **checked**, **when**,
> and **against whom** — and lets the candidate decide.

This is the design document the build was made from. Read it before touching
`jobsignal/` (the pipeline) or `jobs/` (the public site).

---

## 1. Existing PaddySpeaks architecture — what is actually here

I inspected the repository before designing anything. The findings constrain
every decision below.

| Concern | Reality |
| --- | --- |
| Framework | **None.** Hand-written HTML5 files, one per page. No bundler, no npm build, no JSX. |
| Hosting | **GitHub Pages** from the repo root (`CNAME` → `paddyspeaks.com`, `.nojekyll`). Every file in the repo is a URL. |
| Routing | **Filesystem only.** There is no server to rewrite paths. `/jobs/search/` must be `jobs/search/index.html`; `/jobs/<job-id>` is impossible without a build step that emits a file per job. |
| Styling | One global `style.css` (135 KB) with `:root` design tokens — `--color-ink #1a2332`, `--color-paper #eef3f9`, `--color-gold #2563a8`, `--color-rust #c44b2b`, `--color-sage #2a7a4a`, `--color-border #c8d6e5`. Type is Playfair Display (display), Source Serif 4 (body), JetBrains Mono (mono). Sections add a scoped stylesheet on top (e.g. `interview.app/jobs/css/jobs.css`). |
| Shared chrome | `.top-bar` → `.masthead` → `.nav-bar` → `<main>` → `.site-footer`, plus `/lib/ps-nav.js` (mobile nav), `/lib/ps.js` (analytics), and a server-side pixel `<img src=".../api/px.gif?p=/path">`. |
| Backend | A single **Cloudflare Worker** (`ps.paddyspeaks.com`, `analytics/worker/worker.js`) that routes `/api/*` to per-feature modules (`leaderboard.js`, `contact.js`, `testimonials.js`, `scan.js`). Three **D1** databases, deliberately split so PII never shares a database with analytics: `DB` (analytics), `LB` (leaderboard), `FORMS` (contact/testimonials). |
| Worker conventions | Every feature is one module exporting `routeX(request, env, url, corsHeaders)` that returns `null` when the path is not its own. Every feature **returns 503 `not_configured`** until its binding/secret exists, so it can be merged before it is provisioned. Secrets are dashboard Secrets, never `[vars]` (a Git deploy wipes plaintext vars — this has already bitten this repo once). |
| Pure logic | Lives in `analytics/lib/*.js` (ESM, no deps), imported by both the Worker and the test runner `analytics/tests/run.mjs` (dependency-free, `node analytics/tests/run.mjs`). |
| Batch work | Python 3.12 stdlib-only scripts in `interview/scripts/` and `.github/scripts/`, driven by GitHub Actions cron. No third-party packages anywhere. |
| Guardrails | `.github/workflows/validate-content.yml` runs `validate_content.py` (JSON parses, articles well-formed) and `validate_abhirami.js` on every PR. |
| **Prior art that matters** | **`interview.app/jobs/` already exists** — a weekly board of data/AI roles built by `interview/scripts/fetch_jobs_feed.py` (Greenhouse/Lever/Ashby, keyless public APIs), `ats_boards.json` (27 verified employer slugs) and `build_jobs.py`. Crucially, `build_jobs.py` already implements **`first_seen` carry-forward**: it reads the board it shipped last week so a re-run cannot stamp today's date on a role it already knew about. That is JobSignal's §4 rule, already proven in production here. |

**Consequences for JobSignal**

1. There is no database the browser can query and no server-side rendering. The
   search index must be **static JSON fetched by the browser**, or a new Worker
   route. Phase 1 uses static JSON — it is free, cacheable at the edge by GitHub
   Pages' CDN, and has no cold start.
2. Ingestion cannot run in the Worker on a visitor's request (§17). It runs in
   **GitHub Actions cron** and commits its output. A side effect is that
   `git log jobs/data/` becomes a permanent, auditable posting history for free.
3. `/jobs/[job-id]` becomes `/jobs/job/?id=<id>` — one static page that fetches
   the record. Real URLs, no per-job files in git, no rewrite rules.
4. New code is Python 3.12 stdlib (pipeline) and vanilla ES5-safe JS (browser),
   matching the repo. **No dependencies are added.**

### The drift trap, and how JobSignal avoids it

`CLAUDE.md` warns that form validation exists twice — `analytics/lib/forms.js`
(Worker) and `lib/ps-forms.js` (browser) — and that the two must be changed
together or they drift. JobSignal does **not** repeat that pattern. Every
derived value — confidence level, signal list, freshness label, repost count,
age in days — is computed **once, in the Python pipeline**, and written into the
JSON. The browser only formats and filters what it is handed. There is exactly
one implementation of every judgement, and it is the tested one.

---

## 2. Proposed JobSignal architecture

```
                     ┌──────────────────────────────────────────┐
  every 4 hours ───► │  GitHub Actions: jobsignal-ingest.yml     │
  (cron, free)       └──────────────────────────────────────────┘
                                      │
   jobsignal/sources.json ───────────►│  1. Source Registry (Tier 1 only in P1)
                                      │
                                      ▼
                        adapters.py   │  2. Adapters: Greenhouse, Lever, Ashby,
                        (stdlib HTTP) │     SmartRecruiters, Workable, Recruitee
                                      ▼
                        raw postings  │  3. Raw Job Store (in-memory per run;
                                      │     failures isolated per source)
                                      ▼
                        normalize.py  │  4. Normalizer: titles, locations, remote
                                      │     status, salary, seniority, skills
                                      ▼
                        identity.py   │  5. Dedup + lineage (canonical key,
                                      │     lineage key, repost detection)
                                      ▼
                        verify.py     │  6. Verification Engine (presence in the
                                      │     employer's own ATS API + sampled
                                      │     apply-endpoint probes)
                                      ▼
                        store.py      │  7. Job History (history.json carries age
                                      │     forward; archive/<YYYY>.json keeps
                                      │     closed roles forever)
                                      ▼
                        confidence.py │  8. Live confidence signals + freshness
                                      ▼
                        build.py      │  9. Search Index: jobs/data/index.json
                                      │     + detail shards + stats + health
                                      ▼
                        git commit    │ 10. GitHub Pages CDN
                                      ▼
                     ┌──────────────────────────────────────────┐
                     │  /jobs/ — static HTML + vanilla JS        │
                     └──────────────────────────────────────────┘
```

**Why static JSON rather than D1 in Phase 1.** At MVP scale (§20: ~500–1,000
employers, target ~10k live roles) the compact index is roughly 220 bytes per
role — about 2 MB uncompressed, ~400 KB gzipped, served from a CDN that already
fronts this site. A D1 round trip per search would be slower, would cost money,
and would need provisioning the site owner has to do by hand. The moment the
index outgrows the browser (documented threshold: **> 25,000 live roles or
> 1.5 MB gzipped**), Phase 4 moves search behind a Worker route backed by D1 —
the pipeline already emits exactly the rows that table needs, so the migration
is a loader script, not a rewrite. The schema in §3 is written for that day.

**Why GitHub Actions rather than Cloudflare Cron Triggers.** The Worker's cron
would need D1 from day one and gives no audit trail. Actions is free on this
repo, already the pattern for `refresh-jobs.yml`, and every ingestion run leaves
a signed commit — so "when did this job first appear?" is answerable from `git`
even if the JSON is later corrupted.

---

## 3. Database schema

Phase 1 stores this as JSON (`jobs/data/`); Phase 4 loads the identical shape
into D1. The DDL below is the target and doubles as the field contract.

```sql
-- ── Employers we watch ────────────────────────────────────────────────
CREATE TABLE companies (
  company_slug     TEXT PRIMARY KEY,      -- 'stripe'
  company_name     TEXT NOT NULL,         -- 'Stripe'
  company_domain   TEXT NOT NULL,         -- 'stripe.com'  (identity anchor)
  ats_provider     TEXT NOT NULL,         -- 'greenhouse' | 'lever' | ...
  ats_slug         TEXT NOT NULL,
  careers_url      TEXT,
  industry         TEXT,
  company_size     TEXT,
  is_staffing_firm INTEGER NOT NULL DEFAULT 0,  -- powers "hide staffing agencies"
  enabled          INTEGER NOT NULL DEFAULT 1,
  quarantined_at   TEXT                   -- set when a slug 404s repeatedly
);

-- ── One row per live opening ──────────────────────────────────────────
CREATE TABLE jobs (
  id                     TEXT PRIMARY KEY,  -- sha1(company_domain|ats|requisition_id)[:16]
  canonical_key          TEXT NOT NULL,     -- dedup identity within a run
  lineage_key            TEXT NOT NULL,     -- semantic identity ACROSS reposts

  company_slug           TEXT NOT NULL REFERENCES companies(company_slug),
  company_name           TEXT NOT NULL,
  company_domain         TEXT NOT NULL,

  job_title              TEXT NOT NULL,
  title_normalized       TEXT NOT NULL,     -- 'product manager'
  department             TEXT,
  location               TEXT,              -- as published
  location_city          TEXT,
  location_region        TEXT,
  location_country       TEXT,
  remote_status          TEXT,              -- remote | hybrid | onsite | unknown
  employment_type        TEXT,              -- full_time | part_time | contract | internship | unknown

  salary_min             INTEGER,
  salary_max             INTEGER,
  currency               TEXT,
  salary_source          TEXT,              -- 'employer_field' | 'description' | NULL
  experience_level       TEXT,              -- internship|entry|mid|senior|manager|director_plus|unknown
  education_requirement  TEXT,

  description            TEXT,              -- plain text, source-derived, never generated
  requirements           TEXT,              -- JSON array of source sentences
  preferred_requirements TEXT,              -- JSON array of source sentences
  skills                 TEXT,              -- JSON array, extracted from description
  visa_sponsorship       TEXT,              -- mentioned | not_mentioned
  security_clearance     TEXT,              -- mentioned | not_mentioned

  requisition_id         TEXT,
  source_type            TEXT NOT NULL,     -- ats_api | employer_feed | trusted_api | discovery
  source_url             TEXT NOT NULL,     -- where WE read it
  apply_url              TEXT NOT NULL,     -- where the CANDIDATE goes (employer/ATS only)
  apply_url_host         TEXT NOT NULL,     -- shown verbatim on the card — no "Easy Apply"
  apply_hops             INTEGER DEFAULT 0, -- redirects through aggregators → caution signal
  ats_provider           TEXT,

  posted_at_original     TEXT,              -- employer's own date; NULL if not supplied
  first_seen_at          TEXT NOT NULL,     -- NEVER rewritten once set
  last_seen_at           TEXT NOT NULL,
  last_verified_at       TEXT,
  closed_at              TEXT,

  repost_count           INTEGER NOT NULL DEFAULT 0,
  description_hash       TEXT NOT NULL,     -- sha1 of normalized description
  status                 TEXT NOT NULL,     -- live | recent | unverified | closed
  confidence_level       TEXT NOT NULL,     -- high | medium | caution
  confidence_signals     TEXT NOT NULL      -- JSON array of {kind, text}
);
CREATE INDEX idx_jobs_search  ON jobs(status, last_verified_at DESC);
CREATE INDEX idx_jobs_company ON jobs(company_slug, status);
CREATE INDEX idx_jobs_lineage ON jobs(lineage_key);

-- ── Permanent posting history. Rows are NEVER deleted (§14). ──────────
CREATE TABLE posting_spells (
  spell_id     TEXT PRIMARY KEY,
  lineage_key  TEXT NOT NULL,
  job_id       TEXT NOT NULL,
  opened_at    TEXT NOT NULL,   -- first_seen of this spell
  closed_at    TEXT,            -- NULL while open
  requisition_id TEXT,
  description_hash TEXT
);
CREATE INDEX idx_spells_lineage ON posting_spells(lineage_key, opened_at);

-- ── Every verification attempt, so "last verified" is evidence, not a claim ──
CREATE TABLE verification_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      TEXT NOT NULL,
  checked_at  TEXT NOT NULL,
  method      TEXT NOT NULL,   -- ats_listing_presence | apply_endpoint_probe
  outcome     TEXT NOT NULL,   -- present | absent | http_ok | http_error | skipped
  detail      TEXT
);

-- ── Crawl health, per source per run (feeds the admin console, §18) ───
CREATE TABLE source_runs (
  run_id        TEXT NOT NULL,
  company_slug  TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ok            INTEGER NOT NULL,
  postings_seen INTEGER NOT NULL DEFAULT 0,
  kept          INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  PRIMARY KEY (run_id, company_slug)
);

-- ── Candidate reports (§19) — signals, never automatic proof ──────────
CREATE TABLE job_reports (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  note        TEXT,
  ip_hash     TEXT NOT NULL,   -- salted sha256, mirrors forms-util.js
  created_day TEXT NOT NULL,   -- day bucket, not an exact timestamp
  status      TEXT NOT NULL DEFAULT 'new'
);
```

**Phase-1 JSON layout**

| File | Contents | Committed |
| --- | --- | --- |
| `jobs/data/index.json` | compact record per live role (everything the card and every filter needs — no description) | yes |
| `jobs/data/detail/<xx>.json` | 256 shards keyed by `id[:2]`, holding description/requirements/history | yes |
| `jobs/data/companies.json` | employer roll-up: live count, verified count, first seen | yes |
| `jobs/data/stats.json` | the homepage numbers, computed — **never hardcoded** (§15) | yes |
| `jobs/data/health.json` | per-source outcome of the last run (§18) | yes |
| `jobs/data/history.json` | lineage → spells; the age ledger | yes |
| `jobs/data/archive/<YYYY>.json` | closed roles, appended, never pruned (§14) | yes |

---

## 4. Data-source strategy

**Tier 1 — first-party, the only tier Phase 1 ships.** Public, documented,
keyless JSON endpoints published by the employer's own ATS. Presence in this
feed is the employer stating the requisition is open, which is exactly the
claim JobSignal repeats.

| ATS | Endpoint | Notes |
| --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true` | full description, `updated_at`, `requisition_id`, metadata |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | `createdAt` epoch ms, structured `lists` → requirements |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true` | `publishedAt`, compensation tiers |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/<slug>/postings` | paginated; detail fetched per posting |
| Workable | `apply.workable.com/api/v1/widget/accounts/<slug>` | `published_on` |
| Recruitee | `<slug>.recruitee.com/api/offers/` | `published_at` |

Workday, Jobvite, iCIMS and BambooHR are Phase 3: each needs a per-tenant host
and Workday in particular needs a POST with a tenant-specific payload, which is
more integration surface than Phase 1 should carry.

**Tier 2 — trusted APIs.** Himalayas remote jobs, USAJobs, and similar, added
only where licensing permits aggregation and attribution is rendered. The
adapter interface is already shaped for them (`source_type: trusted_api`);
none are enabled in Phase 1 because none has been licence-reviewed yet.

**Tier 3 — discovery.** LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google.
**Never a source of truth and never displayed as one.** A role discovered there
must be resolved to the employer's own requisition before it is publishable;
until it is, `status` stays `unverified` and it is excluded from default
results. Phase 1 ships **no** Tier-3 adapter, so the rule cannot be violated by
accident.

**Compliance rules the adapters enforce in code**

- Only documented public JSON endpoints. No HTML scraping, no headless browser.
- No authentication is presented, evaded, or stored. No CAPTCHA is touched.
- A descriptive `User-Agent` with a contact URL on every request.
- Per-host politeness delay and a hard per-run request budget.
- `robots.txt` is honoured; a source that disallows its API path is disabled in
  the registry rather than worked around.
- A source that fails repeatedly is **quarantined**, not retried forever.

---

## 5. Verification algorithm

A job is **verified** when the employer's own hiring system still lists it. That
is the strongest signal obtainable without pretending to be a candidate, and it
is what the badge literally says.

```
for each enabled source:
    listing = adapter.fetch()               # one request per employer, not per job
    for each posting in listing:
        mark(canonical_key, present_at = run_started_at)

for each job already in the store:
    if present in this run:
        last_seen_at     = run_time
        last_verified_at = run_time         # ← the badge's "checked N min ago"
        status           = 'live'
        record verification_event(ats_listing_presence, 'present')
    elif absent for >= 2 consecutive runs:  # one missed run is not a closure
        closed_at = run_time
        status    = 'closed'
        close the open posting_spell
        move the record to archive/<YYYY>.json
        record verification_event(ats_listing_presence, 'absent')
    else:
        status = 'recent'                   # 🟡 due for another check
```

Two consecutive absences, not one, because a single ATS timeout would otherwise
close an employer's entire board.

**Sampled apply-endpoint probe.** Listing presence proves the requisition
exists; it does not prove the application page loads. Each run additionally
probes the `apply_url` of a bounded sample (default 150, oldest-checked first),
recording `http_ok` / `http_error`. This produces the "✓ Direct application"
signal and costs a few hundred requests a day rather than tens of thousands.

**Status mapping (§3 of the brief)**

| Badge | Condition | Shown in default search |
| --- | --- | --- |
| 🟢 VERIFIED LIVE | present in the employer's ATS within the last 6 h | yes |
| 🟡 RECENTLY VERIFIED | verified before, older than 6 h, not yet absent twice | yes |
| ⚪ UNVERIFIED | never confirmed at the employer | **no** |
| 🔴 CLOSED | absent twice | no — archived |

Verification runs every 4 hours (`cron: 0 */4 * * *`), inside the 4–6 h window
the brief asks for and comfortably inside GitHub's free Actions minutes.

---

## 6. Duplicate and repost detection

Two different identities, and conflating them is what makes other boards lie.

**`canonical_key` — "is this the same posting?"** Used to collapse one opening
appearing in several places within a single run:

```
canonical_key = sha1(company_domain | requisition_id)                if requisition_id
              = sha1(company_domain | title_normalized | location_normalized)  otherwise
```

The winner is chosen by source tier (Tier 1 beats Tier 2 beats Tier 3), then by
the shortest apply-URL redirect chain. Losing appearances are stored as
`also_seen_at` for diagnostics and **never rendered as extra results** (§11).

**`lineage_key` — "have we seen this role before?"** Deliberately coarser, so it
survives a requisition being deleted and recreated:

```
lineage_key = sha1(company_domain | title_normalized | location_normalized | department)
```

Plus a similarity fallback: a new posting with no lineage match is compared
against that company's closed spells from the last 365 days on normalized
description tokens (Jaccard ≥ 0.82) and title equality. A match adopts the
existing lineage.

**The age rule (§4), stated as an invariant the tests enforce**

> `first_seen_at` is written exactly once per job id and is never updated.
> `posted_at_original` is copied from the employer and is never synthesised.
> A repost creates a **new spell on an existing lineage** — never a reset.

So the card can say `First seen: Aug 7 · Live for 44 days` and the detail page
can say `Reposted 3 times since May`, both from stored evidence. Where evidence
is missing the UI says "original posting date not supplied by the employer" —
it does not guess, and it never shows "Posted today" for a role we have watched
for months.

---

## 7. Page map

Filesystem routing, because GitHub Pages has no rewrites.

| URL | File | Purpose |
| --- | --- | --- |
| `/jobs/` | `jobs/index.html` | Hero, search, live counters, trust bar |
| `/jobs/search/` | `jobs/search/index.html` | Results, filters, toggles, sorting |
| `/jobs/job/?id=<id>` | `jobs/job/index.html` | Detail: status, source transparency, posting history, report |
| `/jobs/company/?c=<slug>` | `jobs/company/index.html` | All live roles at one employer + hiring activity |
| `/jobs/saved/` | `jobs/saved/index.html` | Personal pipeline (Saved / Applied / Interviewing / Offer / Closed) |
| `/jobs/alerts/` | `jobs/alerts/index.html` | Alert builder |
| `/jobs/health/` | `jobs/health/index.html` | Read-only pipeline console (`noindex`) |
| `/jobs/methodology/` | `jobs/methodology/index.html` | What "verified" means, in plain words |

`/jobs/[job-id]` as a bare path segment would require one committed HTML file
per job — tens of thousands of files, rewritten every four hours. `?id=` keeps
the URL real, shareable and stable while the data stays in one place.

---

## 8. Component and wireframe plan

Vanilla JS, no framework, matching the site. Shared modules under `jobs/js/`:

| Module | Responsibility |
| --- | --- |
| `data.js` | fetch + in-memory cache of `index.json`, shards, stats, health; `sessionStorage` warm cache |
| `format.js` | every display string: badge, freshness label, age, salary, apply host. **Formats only — decides nothing.** |
| `query.js` | parse/serialise filter state to and from the query string |
| `search.js` | tokeniser, synonym expansion (`PM` → product manager / product owner / technical product manager), typo tolerance, scoring, ranking |
| `card.js` | the job card, one DOM builder |
| `tracker.js` | `localStorage` pipeline state (saved/applied/interview/rejected/offer/hidden), export to JSON |
| `alerts.js` | alert definitions in `localStorage`; matches on visit and reports what is new |

Card, per §7 — six lines, nothing more:

```
PRODUCT MANAGER                                   🟢 VERIFIED LIVE · 21 min ago
Stripe · San Francisco · Hybrid · $165K–$230K
First seen Sep 19 · Age 1 day · JUST POSTED
Product · 3–5 yrs · Requisition 82715
⚠ Reposted twice in the last 90 days            [ View job ]  [ Apply at stripe.com → ]
```

The apply button always names the host it goes to. The string "Easy Apply"
appears nowhere in the codebase, and a test asserts that.

---

## 9. MVP implementation phases

| Phase | Scope | State |
| --- | --- | --- |
| **1** | Tier-1 ATS ingestion (6 adapters), normalizer, dedup + lineage, verification, history, confidence, static search index, all eight pages, health console, CI cron | **this change** |
| 2 | `/api/jobs/report` Worker route + D1 `job_reports`; alert delivery by email through the existing Resend wiring; admin actions (disable source, rerun verification, merge duplicates) | next |
| 3 | Workday / Jobvite / iCIMS / BambooHR adapters; Tier-2 licensed APIs with attribution; employer roster to ~1,000 | later |
| 4 | Search behind a Worker route on D1 once the index passes 25k roles or 1.5 MB gzipped; saved searches synced across devices | when the threshold trips |

**Phase 1 ships with an empty board, on purpose.** The brief says no mock jobs
in production, and `CLAUDE.md` already forbids seeding testimonials. The data
files are committed empty with an honest empty state; the first cron run fills
them from real employer APIs. Nothing fabricated ever enters `jobs/data/`.

---

## 10. Security, privacy and compliance risks

| Risk | Mitigation |
| --- | --- |
| Terms-of-service breach by scraping | Tier-1 documented JSON APIs only. No HTML parsing, no headless browser, no auth, no CAPTCHA. Identifying User-Agent, politeness delay, per-run request budget. |
| Being a nuisance to an employer | One request per employer per run, not one per job. Sampled apply probes capped at 150/run. Failing sources quarantined, not retried in a loop. |
| Defaming an employer ("ghost job") | The product never asserts intent. It renders counts and dates it can evidence. Caution signals are phrased as observations ("first seen 126 days ago"), never accusations. §5 of the brief is enforced in `confidence.py`, and the wording lives in one place. |
| Stale data presented as fresh | Every card shows `last_verified_at`, not just "posted". Absence twice closes the role. Age is carried forward and cannot be reset. |
| Sending a candidate somewhere unexpected | `apply_url` is only ever the employer or its ATS host, and the host is printed on the button. Redirect hops are counted and surfaced as a caution signal. |
| Scam / fake employer | Domain must match the registry entry for that company; postings whose apply host does not match a known ATS or the employer domain are dropped. Block-list hook in the registry. |
| XSS from third-party job text | Descriptions are stripped to plain text in Python at ingest, then inserted with `textContent` in the browser. No `innerHTML` for any source-derived string. |
| Candidate privacy | Saved jobs, applications and alerts are `localStorage` only — no account, no server copy, no email collected in Phase 1. The existing cookie-free tracker and its GPC opt-out apply unchanged. |
| Secret leakage | Phase 1 needs no API keys at all. Phase 2 keys follow the existing rule: Cloudflare **Secrets**, never `[vars]`, never in the repo, never in frontend code. |
| Repo bloat | Archive sharded by year; detail sharded 256 ways; index carries no descriptions. |
| Trust for sale | There is no ranking input a payment could touch. `confidence.py` takes no sponsorship parameter — the absence is structural, not a policy note. |

## 11. Crawling and API cost estimate

Phase 1 (60 employers, every 4 h → 6 runs/day):

| Item | Volume | Cost |
| --- | --- | --- |
| ATS listing requests | 60 employers × 6 runs = 360/day | $0 — public keyless endpoints |
| Detail fetches (SmartRecruiters only) | ≤ 300/day | $0 |
| Sampled apply probes | 150/run × 6 = 900/day | $0 |
| GitHub Actions | ~3 min/run × 6 = ~18 min/day (~550 min/month) | $0 — public repo, unlimited |
| Storage / bandwidth | index ≈ 400 KB gz; repo growth ≈ 15 MB/year | $0 — GitHub Pages |
| **Phase 1 total** | ~1,600 requests/day | **$0/month** |

At Phase 3 scale (1,000 employers): ~6,000 listing requests/day, ~40 min/day of
Actions (still free on a public repo), index ≈ 2.5 MB gzipped — which is the
trigger to move search to D1. Cloudflare D1 free tier covers 5 M reads/day, so
Phase 4 is projected at **$0–5/month** unless traffic grows by orders of
magnitude. Optional Tier-2 licensed APIs are the only line item that could
carry a real price, and none is enabled.

---

## Invariants

These are asserted by `jobsignal/tests/test_pipeline.py`. Breaking one should
fail CI, not ship.

1. `first_seen_at` is never rewritten for an existing job id.
2. A repost adds a spell to an existing lineage; it never resets age.
3. A job absent from its employer's ATS twice in a row is closed and archived,
   never silently kept.
4. Nothing with `status = unverified` appears in default search results.
5. `apply_url` host is the employer domain or a known ATS host — never an
   aggregator.
6. No statistic rendered anywhere is hardcoded; all come from `stats.json`.
7. The string "Easy Apply" does not exist in the codebase.
8. No confidence signal is phrased as an accusation.
9. A query's role family gates results; an unrelated family is excluded, never
   merely down-ranked.
10. A role open in several places is findable by any of them, and the card never
    shows one place as though it were the only one.
11. One city has one spelling.

---

## 12. Search relevance and the role taxonomy

Added with the 2026-09-21 redesign. The full design record — the measurements
that justified each decision — is in **`docs/JOBSIGNAL-REDESIGN.md`**. This
section is the part that constrains future changes.

### Classification happens once, in Python

`jobsignal/pipeline/taxonomy.py` assigns every posting a `role_family` at
ingest, from its title, cleaned department and description. The browser
classifies nothing: `jobs/js/search.js` parses the query and ranks candidates
against the family the pipeline already decided. This is the same rule as
confidence and freshness, and for the same reason — the `forms.js` /
`ps-forms.js` drift trap in §1.

`role_family_confidence` records *where* the family came from — `head`,
`title`, `context` or `none` — and the ranker weights it accordingly. A family
inferred from description context never outranks one stated in the title.

### The gate, not the weights

A query resolves to at most one family. A job outside it is **not a candidate**,
not a down-ranked one. The old engine scored shared tokens, so "data engineer"
returned 3,139 results at 3.6% precision — every Sales Engineer and Director of
Field Engineering matched "engineer" just as strongly as a Senior Data Engineer.

Adjacency is the one crossing, and it costs twice: a penalty on the score, plus
two pieces of evidence the job must supply — the skills named in
`ADJACENCY[family]`, **and** the query's own role words somewhere in the title.
Skills alone are not enough: shared tooling let every backend engineer through
on an infrastructure query, so `sre` returned 1,253 roles for a family of 258 —
the identical count to `software engineer`. `design_ux`, `security` and
`product_management` have no adjacency at all, deliberately.

Below `THRESHOLD`, a result is excluded rather than shown at the bottom. Zero
results with a named, counted broadening beats five hundred junk ones.

### Curation

Only `taxonomy.TARGET_FAMILIES` are published. A role outside them still enters
the history ledger — so its age survives if it ever comes into scope — but it
never reaches the board. That is brief §20, quality over quantity: 2,237 roles
published from a 6,058-role corpus.

### Locations

A posting's location string may name several places. Reading it as one produced
"San Francisco, NY" — a place that does not exist — on 9% of the board, by
pairing the first city with the last region.

- `normalize.place_fragments()` splits on `|`, `;` and `or`, then drops
  fragments that name only a way of working. "Remote-Friendly
  (Travel-Required)" is an arrangement, not an office; counting it as one put a
  city called "Friendly Travel-Required" in the primary slot on 58 roles.
- `parse_locations()` parses every remaining fragment. The first is the card's
  location; the rest ship as `locations_extra` and are matched by search, so a
  role open in San Francisco *and* New York is findable by either. The card
  names the count it cannot show ("+1 other location"); the detail page lists
  them all.
- `canonical_city()` gives one city one spelling. The board carried Bengaluru
  and Bangalore as two cities, so a search for either found two-thirds of the
  roles and silently missed the rest.

### The gazetteer is learned, not written

`PLACES` in `search.js` is a short hand-written list of *aliases* — the
disambiguation a corpus scan cannot supply ("nyc", "bay area", "bangalore" →
Bengaluru). Every other place is read off the loaded index at query time by
`learnPlaces()`. The hand-written list knew 14 of the 146 cities employers
actually post in; a search for Mountain View, Toronto or Menlo Park resolved to
no location and quietly ignored the word. A learned place can only ever name
somewhere we hold jobs, and a single-word city that is also a role or skill word
is skipped, so "Mobile, Alabama" cannot turn "mobile engineer" into a search for
Alabama.

### Acceptance tests

`node jobs/tests/relevance.mjs` — 35 assertions, run against the committed
index, no network. Wired into Validate Content and run again before each
ingest. It loads the shipped `search.js` through a UMD wrapper, so the ranker
under test is the one that ships.

