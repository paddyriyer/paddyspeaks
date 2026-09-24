# PaddySpeaks — Claude Code Instructions

## Session continuity — read first

Running state and "where we left off" between sessions lives in
**`docs/SESSION-HANDOFF.md`** — read it at the start of a session to resume.
Current headline: the **anonymous Community Leaderboard is LIVE** (Cloudflare
Worker + separate D1 `paddyspeaks-leaderboard`); the public board reveals at 5
real scores and shows a sample preview until then; the LinkedIn launch blurb is
parked until real scores flow. Update that file when meaningful state changes.

## Contact & Testimonials

Both features are documented in **`docs/CONTACT-AND-TESTIMONIALS.md`** — read it
before touching `/contact/`, `/testimonials/`, or the `FORMS` D1 database.

- Validation lives ONCE, in `analytics/lib/forms.js` (pure, unit-tested). The
  Worker imports it; `lib/ps-forms.js` mirrors it in the browser. Change both
  together or they drift.
- **Never publish a testimonial automatically.** Everything enters `pending`;
  only `approved` rows are public. Moderate at `/testimonials/admin.html`.
- **Never seed or invent testimonials.** Empty state shows an honest invitation.
- Recipient addresses and API keys are environment variables only — never in the
  repo, never in frontend code.

## JobSignal (`/jobs/`)

The job aggregator is documented in **`docs/JOBSIGNAL.md`** (architecture, D1
schema, verification algorithm, repost detection, cost) and
**`jobsignal/README.md`** (how to run it). Read both before touching `/jobs/`
or `jobsignal/`.

- **`first_seen_at` is written once per job id and never updated.** Every other
  rule here exists to protect that one. A rebuild that re-dates a role we
  already knew about defeats the product.
- **A reposted role is never labelled JUST POSTED.** It is labelled `REPOSTED`,
  and the detail page shows every previous run with dates.
- **No sample, seed or placeholder jobs, ever** — same rule as testimonials. A
  run that ingests nothing exits 1 and leaves the previous board alone. The
  board shipped empty on purpose and fills from the first CI run.
- **All judgement lives in Python** (`jobsignal/pipeline/`), computed once and
  shipped as data. `jobs/js/` only formats and filters. This deliberately
  avoids the `forms.js` / `ps-forms.js` drift trap described below. That
  includes `role_family`: `jobsignal/pipeline/taxonomy.py` classifies at
  ingest, and `jobs/js/search.js` classifies nothing.
- **Search gates on role family; it does not down-rank.** A job outside the
  query's family is not a candidate. Adjacency costs a score penalty AND must
  evidence both the named skills and the query's own role words — skills alone
  once let every backend engineer through on an `sre` query. Below threshold a
  result is excluded, never shown at the bottom.
- **Only `TARGET_FAMILIES` are published.** Out-of-scope roles stay in the
  history ledger — so their age survives if they come into scope — but never
  reach the board.
- **A posting can name several places.** The first is the card's; the rest ship
  as `locations_extra` and are searchable. Never show one place as though it
  were the only one, and never pair the first city with the last region — that
  is how "San Francisco, NY" reached 9% of the board.
- **Tier 1 sources only** — public, documented, keyless ATS JSON. No scraping,
  no auth, no CAPTCHA. LinkedIn/Indeed/Glassdoor/ZipRecruiter are never a
  source of truth and the Apply button never points at one.
- **Never phrase a signal as an accusation.** "Ghost job" and friends are
  banned by a test; signals state what was observed, with a date.
- Guardrails, both no-network and both wired into Validate Content and re-run
  before each ingest: `python3 -m jobsignal.tests.test_pipeline` (pipeline) and
  `node jobs/tests/relevance.mjs` (search relevance, run against the committed
  index using the shipped ranker).
- Ingestion: `.github/workflows/jobsignal-ingest.yml`, every 4 hours.

## DE Interview Handbook (`articles/data-engineering-interview-prep.html`)

The Senior/L5 handbook is edited **directly** — the article is the source of truth.
Audit, change log and rationale: **`docs/DE-L5-HANDBOOK-AUDIT.md`** and
**`docs/DE-L5-HANDBOOK-CHANGES.md`**.

- **Never run `scripts/combine_interview.py`** (retired; it rebuilds from the stale
  `interview/html/` sources and would delete Parts 10–20).
- After editing, run `python scripts/handbook_build.py` (regenerates contents, section
  numbering, per-part time estimates and prev/next — idempotent) then
  `python scripts/check_handbook.py` (also in Validate Content).
- Component CSS lives in `scripts/handbook/handbook.css` and is inlined by the build.
- Never rename or delete an existing `id` — they are deep-link targets. Merge with a
  `<span id="old-id"></span>` anchor instead. Visible numbers may change; ids may not.
- Every technical part ends with an L5 Interview Card (eleven sections, fixed order);
  every code block carries an Engine / Dialect / Executable label.
- Never call a scenario "real", "verbatim", or attribute questions to named companies.
  Vendor defaults and prices are labelled as such, with "check current docs".

## CRITICAL: Do NOT regenerate index.html

The homepage (`index.html`) is **hand-crafted** with custom sections that no script can reproduce:
- Scrollbar sidebar with featured articles
- Sacred texts section with Mandala, Timeline, and Cards views
- Custom featured hero with visual design
- Hand-tuned deck grid ordering

**NEVER run `generate_index.py`** (now deleted) or any script that overwrites `index.html`.
When adding a new article, manually insert a card into `index.html`:
1. Add a `featured-sidebar-card` entry in the sidebar section
2. Add a `deck-card` entry in the `deck-grid` section
3. Update filter counts if needed

## Adding a New Article

1. Create the HTML file in `articles/` using an existing article as template
2. Add metadata to `article_metadata.json` (newest article first)
3. Manually add cards to `index.html` (sidebar + deck grid)
4. Add a `<url>` entry to `sitemap.xml`
5. Run NO index generation scripts

## Sitemap

`sitemap.xml` is hand-maintained — add and remove `<url>` entries by hand, as
above. The one thing that is automated is the `<lastmod>` date, which otherwise
goes stale the moment a page is edited:

```
python .github/scripts/refresh_sitemap_lastmod.py          # report stale dates
python .github/scripts/refresh_sitemap_lastmod.py --write  # set them from git
```

It rewrites `<lastmod>` values only — URLs, order, `<priority>`, `<changefreq>`
and whitespace are untouched — so the diff is dates and nothing else. Worth
running before any push that changes published pages: Google uses `lastmod` as a
recrawl hint and learns to ignore a feed whose dates are reliably wrong.

## Site Structure

- `jobs/` — JobSignal: static pages + the board data the pipeline commits
- `jobsignal/` — JobSignal ingestion pipeline (Python, stdlib only)
- `articles/` — Blog post HTML files (self-contained)
- `article_metadata.json` — Article metadata (title, date, category, slug, hero_image, read_time)
- `index.html` — Hand-crafted homepage (DO NOT auto-generate)
- `style.css` — Global styles with CSS variables
- `images/articles/<slug>/` — Per-article hero images
- Sacred text apps each have their own directory (e.g., `bhagavad-gita/`, `vishnu-sahasranama/`)

## Article HTML Template

Use existing articles as reference. Key elements:
- Full HTML5 with SEO meta tags (Open Graph, Twitter Card, Schema.org)
- Linked to `../style.css`
- Visual essay elements: `.lesson-card`, `.shloka`, `.callout`, `.manifesto-statement`, `.domain-header`, `.versus-grid`, `.feature-grid`, `.phase-timeline`, `.pull-quote-divider`, `.ornament-divider`, `.manifesto-list`

## Categories

- `philosophy` — Spiritual, sacred texts, Vedanta
- `technology` — Data, software, enterprise
- `ai` — Artificial intelligence
- `personality` — Personality development: leadership, boundaries, self-worth

Adding a category means touching five places: `KNOWN_CATEGORIES` in
`.github/scripts/validate_content.py`, and in `index.html` the nav-bar link, the
deck filter button, the hash allow-list, and `catLabels` in the search engine.
