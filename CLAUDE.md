# PaddySpeaks — Claude Code Instructions

## Session continuity — read first

Running state and "where we left off" between sessions lives in
**`docs/SESSION-HANDOFF.md`** — read it at the start of a session to resume.
Current headline: the **anonymous Community Leaderboard is LIVE** (Cloudflare
Worker + separate D1 `paddyspeaks-leaderboard`); the public board reveals at 5
real scores and shows a sample preview until then; the LinkedIn launch blurb is
parked until real scores flow. Update that file when meaningful state changes.

## Incidents — the controlling document

**`docs/INCIDENTS.md`** is the runbook and log for production incidents. Read it
before touching anything that deploys, and immediately if the live site or
analytics looks wrong. Its standing rules bind every session: merging is
deploying; production-behaviour changes go in their own small PR; a green test
that asserts a platform rule must match the platform, not our assumption; verify
in production after merge; revert first, diagnose second; every incident gets a
log entry and a merged guardrail before it is closed; record plainly who made
the change, including Claude sessions. Check its open follow-ups at the start of
a session and close any that are yours.

## Change safety — read before any major rework

**Merging to `main` deploys**: the site through GitHub Pages, and the analytics
Worker (`ps.paddyspeaks.com`) through Cloudflare Workers Builds. There is no
staging. Before any change to `analytics/worker/`, `lib/ps.js`, headers or
hosting, or any multi-system rework, follow **`docs/CHANGE-SAFETY.md`**: split
the PR; run `node analytics/tests/run.mjs` (it includes the browser CORS
contract); if the Worker changed, run `scripts/analytics_smoke.py` against the
PR's branch preview URL; and confirm the **Analytics Health** workflow is green
after merge. Never remove `Access-Control-Allow-Credentials` for the site's
origins: `sendBeacon` is always credentialed, and without that header every page
view is dropped silently (the 2026-09-24 outage).

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
- Five-path directory (01 Read … 05 Build) and catalogue search entry
- Front page: one feature (`.ps-feature`) and the five latest (`.ps-latest-list`)
- Five numbered chapters; LEARN keeps the Mandala, Timeline and Cards views
- Hand-tuned deck ordering (rendered as a dated archive list)

Its layout and the reasons behind it are in **`docs/HOMEPAGE-UI-AUDIT.md`**;
its styles live in `lib/ps-home.css` (homepage only, scoped to `body.ps-home`)
and its behaviour in `lib/ps-home.js`. Do not restyle it through `style.css`,
which ~190 other pages share.

**NEVER run `generate_index.py`** (now deleted) or any script that overwrites `index.html`.
When adding a new article, manually edit `index.html`:
1. Add an `<li>` at the top of `.ps-latest-list` and remove the fifth. Only the
   first item carries an image; move it (or drop it) so exactly one does.
2. Add a `deck-card` entry at the top of the `deck-grid` section, keeping the
   shape `<a href="…" class="deck-card" data-category="…">` (registry.py reads it)
3. Filter counts are `data-ps-stat` stamps — never type them

## About page and the shared header

`about.html` is GENERATED from **`content/pages/about.html`** by
`python3 scripts/platform_build/build.py pages` — edit the source, never the
output (CI fails if it is stale). Its audit, decisions and the facts still
awaiting Paddy's confirmation are in **`docs/ABOUT-PAGE-AUDIT.md`**. Career
facts come from the Resume, counts from `{{stat:…}}` tokens.

The homepage, About and every `pages.py` page share ONE header: markup in
`index.html` (by hand) and `nav_html()` / `header_html()` in `pages.py` (must
agree), styles in `lib/ps-chrome.css` (scoped to `body.ps-chrome`), sticky
state in `lib/ps-nav.js`. Do not fork the navigation. Hand-crafted pages
that are not rendered by `pages.py` (today `resume.html` and
`visual-resume.html`) get the same header and footer written between
`<!-- ps:header -->` / `<!-- ps:footer -->` markers by `build.py chrome` —
never edit inside the markers; add a page to `FILES` in
`scripts/platform_build/chrome.py` (and `assets.py`) to adopt the header.

Links to `style.css` and `lib/ps-*.css|js` in `index.html` and every
`pages.py` page carry `?v=<content hash>` (`build.py assets`), so new HTML
never meets a cached old stylesheet. After editing any of those files run
`python3 scripts/platform_build/build.py all`; `build.py check` fails on a
stale version. Scripts that look each other up must match with `*=`, not `$=`.

## Adding a New Article

1. Create the HTML file in `articles/` using an existing article as template
2. Add metadata to `article_metadata.json` (newest article first)
3. Manually add it to `index.html` (Latest list + deck grid)
4. Add a `<url>` entry to `sitemap.xml`
5. Run `python3 scripts/platform_build/build.py all`. This is NOT an index
   generator: it restamps the filter counts and other `data-ps-stat` numbers,
   and refreshes the search index, feeds and graph. CI (`build.py check`)
   fails if the deck and `article_metadata.json` disagree.
6. Run NO index generation scripts

## Public statistics: never type a number

Every public count comes from `data/site-registry.json`, which is derived
from the content (see **`docs/PLATFORM-DATA.md`**). Put numbers in pages as
`<span data-ps-stat="interview.questions">1527</span>` and let
`build.py stamp` keep them true. The catalog of what exists
(`data/platform/catalog.json`) is hand-authored and holds no counts.

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

Adding a category means touching these places: `KNOWN_CATEGORIES` in
`.github/scripts/validate_content.py`; `article_categories` in
`data/platform/catalog.json` (the registry and filter counts read it);
`CAT_LABEL` in `scripts/platform_build/search_index.py`; and in `index.html`
the Read row's links in the directory (`.ps-dir`), the deck filter button (with a
`data-ps-stat="deck.<id>"` count), and the hash allow-list. Then run
`python3 scripts/platform_build/build.py all`.

## Platform layer (read before touching nav, search, footers or counts)

`docs/PADDYSPEAKS-PLATFORM-IMPLEMENTATION.md` is the map. In short:
- Navigation is five journeys (Read · Learn · Prepare · Find · Build) + Atlas
  + Mentoring + About (`NAV` in `pages.py`; `index.html` by hand, same order). Labels changed; **no URL moved**.
- Search is `lib/ps-search.js` over `data/search/*.json` (built by
  `build.py search`). The homepage's old inline search engine was removed.
- `lib/ps-platform.js` (on ~280 pages) adds the legal footer row, a skip link
  where missing, and records "Continue" visits for pages with
  `<meta name="ps:continue">`. Nothing it does leaves the browser.
- Every browser-storage key must be listed in `data/platform/state-keys.json`.
