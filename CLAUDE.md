# PaddySpeaks — Claude Code Instructions

## Session continuity — read first

Running state and "where we left off" between sessions lives in
**`docs/SESSION-HANDOFF.md`** — read it at the start of a session to resume.
Current headline: the **homepage is now a map** (`docs/HOMEPAGE-MAP-REDESIGN.md`)
and the catalogues moved to `/articles/`, `/sacred/`, `/explore/`. Before that:
the **anonymous Community Leaderboard is LIVE** (Cloudflare
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

## Interview Intelligence (`/interview.app/reported/`)

The interview question discovery engine is documented in
**`docs/INTERVIEW-INTEL.md`** — read it before touching `interviewintel/`,
`interview.app/reported/` or `admin/interview-discovery/`.

- **Existing infrastructure only, no new spend** (the owner's rule). Sources are
  free, keyless public APIs and feeds (Hacker News, Stack Exchange, DEV, Medium
  RSS) plus the existing community form's sheet; the model is the existing
  `ANTHROPIC_API_KEY` on Claude Haiku, capped per run; the run is weekly. The
  paid search adapters stay dormant — never wire one in without asking.
- **No crawling, no LinkedIn access, no login, no cookies.** `http.py` talks only
  to those API and feed endpoints; a source's web page is never fetched; a
  test enforces it.
- **Never invent a question or an attribution.** Every question, company, role
  and stage needs its own verbatim evidence span that `extract.py` finds in the
  source; a company also needs an interview cue. Otherwise it is UNKNOWN.
- **Transform, never copy; no personal data.** Practice questions are rewrites
  (long shared word runs are flagged); evidence is never published; emails,
  phones, handles and author names are scrubbed before the model sees text.
- **Auto-approval at 70+ (the owner's decision, 2026-10-07); everything else is
  reviewed.** Reports enter `pending`; unflagged, non-duplicate reports scoring
  ≥ 70 are approved automatically and listed on the review page, where they can
  be unpublished. Decisions are committed files in `interviewintel/decisions/`,
  written by the review page (with bulk select); only approved material reaches
  `interview.app/reported/data/`. Never lower the threshold below 50.
- **AI material is always labelled** and never claims to come from the
  interview. **No seeded questions, ever** — the board shipped empty.
- All judgement is Python (`interviewintel/pipeline/`), shipped as data; the
  JS formats and filters. Guardrail: `python3 -m interviewintel.tests.test_pipeline`
  (in Validate Content). Runs: `.github/workflows/interview-intel.yml`, weekly
  and on every pushed decision file.

## FlightDeck (`/ic-flightdeck/`)

Read **`docs/FLIGHTDECK.md`** before touching `ic-flightdeck/`. A self-contained
static demo (its own CSS; it does not use `style.css` and is not rendered by
`pages.py`). Five cockpits share one shell: IC, Team, Workforce, Agent Control
Tower, Executive.

- **Four personas, four different cockpits — never four copies of one
  dashboard.** Each deck is built around the decision its persona makes.
- **Seniority never widens what anyone can see.** Authority moves a viewer
  outward (aggregation), never inward (personal detail). No path exists from
  any deck into an employee's private cockpit. Every deck says what it does
  not contain.
- **No ranking, ever** — no leaderboards, no layoff prediction, no
  termination/salary/promotion recommendations, no productivity inferred from
  keystrokes, commits or hours online. Exposure is task change, never human
  worth.
- `index.html` is the shell + the IC deck; `p-team.js`, `p-workforce.js`,
  `p-tower.js`, `p-exec.js` are **classic** scripts injected on demand (ES
  modules are CORS-blocked under `file://`). Routing is `#persona/view`; a bare
  `#view` still means IC.
- **Text wears text tokens, never a chart's series colour** (`textInk()`), and
  dimming is never a state signal — both failed contrast audits before.
- All demo data is fictional. No real person's information belongs in it.

## Privacy Command Center (`/privacy-command-center/`) and the privacy essay

Read **`docs/PRIVACY-COMMAND-CENTER.md`** before touching `privacy-command-center/`
or `articles/every-arrow/edition-3.html`. Both come from Paddy's field guide
(`docs/Privacy_Engineering_Visual_Field_Guide.pdf`).

- **`/privacy-command-center/` is v1**: one privacy graph (`graph.js`), five
  selectors and one workspace (graph · findings · decision). Its reference is
  `privacy-command-center/README.md`. The earlier full explorer lives at
  **`v10/`** as "Northstar Privacy Explorer (v10)" (`noindex`); old `#/…` links
  are forwarded there. The product text carries no hiring or evaluation language
  (a test enforces this).
- **Northstar is fictional, and the data is synthetic.** Never add a real company as a
  Northstar vendor or system.
- **Connected Life** (v10: `#/life/*`, `data-life.js`, `views-life.js`) is the household
  as a data system: the household graph, who the home observes, the physical-action
  register, automation review, network context, the inference registry and
  offboarding. Household devices from real ecosystems are described by kind and are
  never Northstar vendors or systems.
- **Never type a number.** Every metric is computed from the data (`graph.js`; `v10/data.js`) and shows
  the rule that produced it. **UNKNOWN is a finding**, never a blank.
- The analyst is deterministic. Every statement is labelled FACT, INFERENCE,
  RECOMMENDATION or UNKNOWN and cites entities. Do not add text it cannot
  derive from the graph.
- **One privacy model, two experiences.** The essay explains the arrows; the
  Command Center lets you follow them. What both agree on (entities, the evidence
  labels Documented · Setting · Limit · Test · Unknown, the shared phrases, the 28
  review questions, the TLS table, deep links both ways, 20 sync questions) is
  written once in **`articles/every-arrow/shared.js`**; the views are in
  `privacy-command-center/modes.js` (Products, Everyday arrows, Every layer, Future,
  AI / agents, Reviews). Change a phrase, question or link there, never in one
  property only: `tests/sync.test.mjs` and `edition4.mjs` fail when they drift.
  Vendor content (from `compare.js`) and synthetic content never share a band, and
  a Test is never shown as run.
- **The data subject may not be the user.** `sensors.js` (the *Sensors & wearables*
  view, the ambient morning, *Whose data?*) is synthetic architecture reasoning:
  never claim a real device records continuously or performs an inference, and
  never label everything a sensor saw “collected” — use the explicit states
  (ephemeral on device, transmitted, stored, derived only, persisted, unknown).
  Awareness is tracked separately from consent, with no legal conclusions.
- **The Events layer** (`events.js`, now the *Everyday arrows* view) traces what a
  person did as EVENT → IDENTIFIER → SYSTEM → DERIVED DATA → INFERENCE. Its
  Apple-like / Google-like / Microsoft-like views only relabel one identical
  pattern with familiar product categories (always suffixed “-like”); never make
  the structure differ between ecosystems, never present it as how a real
  product works, and keep the wording plain (a test scans for jargon). The
  one thing that may change the shape is the person's device mix (*Your
  devices*: iPhone-like, Windows-like, Android-like, Mac-like, Linux…), and only
  in the *Devices across platforms* case.

## Every Arrow Is a Decision (`articles/every-arrow-is-a-decision.html`)

Edition 4 (2026-09-30): ten everyday products, as Apple, Google and one other company
each document them, through four lenses — security, privacy, QA and data governance.
The ninth, *Ambient & wearable* (2026-10-05), compares one company (Meta) and says why
in its `single` field; never add empty columns to make it look like three. The tenth,
*Item trackers* (2026-10-06), compares Apple, Google and Samsung: the person located
may not be the owner, and the alert on their own phone is the only notice.
Edition 3 (the 31-scene field guide, with scene 31 “One account. One life.”) is archived at
`articles/every-arrow/edition-3.html` (noindex). Read **`docs/EVERY-ARROW.md`** (§E4
for the live essay) before touching either or `articles/every-arrow/`.

- **Every claim is written once, in `articles/every-arrow/compare.js`**, and cites the
  company's OWN documentation (the only other sources are the labelled standards /
  regulator / press group). Tables, the overview, sources, counts, reading times, the
  `four-lenses.md` download and `?v=` are GENERATED by
  `node scripts/every_arrow/build.mjs` (which builds both editions); the PDFs by
  `… build.mjs --pdf` (playwright via `EA_DEPS`). CI (`build.mjs --check`) fails when
  any is stale. Never type a claim or a count into the HTML.
- Labels: Documented · Setting (default stated when documented) · Limit (the company's
  own stated limitation) · Test (ours, never cited). **No scores, ranks or winners**;
  the build fails on them. Claims that could not be confirmed stay out and are listed
  under “What could not be confirmed”.
- **Never imply that competing assistants share recordings** unless a documented
  integration does; both structure tests fail on it.
- Old links keep working: a hash, `?f=` or `?path=` that edition 4 does not have is
  forwarded to edition 3. So **never give an edition-4 element an id edition 3
  already uses** (the test enforces it). The Command Center v10 links to the archive.
- Both editions end on the five closing lines (“…Every arrow is still a decision.”);
  the structure tests check the order.
- The archive keeps edition 3's rules: Northstar numbers only via the GENERATED
  `northstar.js`, `data-src` citations from `sources.js`, the figure contract, and the
  legacy anchors (`#s01`…, `#cc-*`). No scroll-reveal or anything that hides content
  until an observer fires, in either edition.

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

The homepage (`index.html`) is **hand-crafted**. Since 2026-09-27 it is
**radically sparse** (`docs/HOMEPAGE-MAP-REDESIGN.md` §12): hero (one painting,
no wordmark — the header has it — the h1 "Ideas for a more thoughtful and
compassionate world.", "Explore ↓") → **five ways in** as typeset rows (Read · Learn ·
Prepare · Find · Explore — the centrepiece) → **one** featured story → three
registry-stamped numbers that prove the depth → a search field with About /
Mentoring / Contact under it → footer. That is the whole page. Nothing else
goes on it: no article grids, no product modules, no gateways for Technology,
Philosophy, Sacred, Prepare or Experiments — those are reached through the
five rows, the header and the footer. Before adding anything ask: "if I
remove this, does a visitor understand PaddySpeaks less?" If not, leave it out.

**One image on the whole page**: Paddy's sunrise painting in the hero. The
featured story carries its own artwork; nothing else has a picture. No cards,
no buttons (the hero's "Explore ↓" and the search field are links and a
field), no illustrations, no icons in the five rows.

Its styles live in `lib/ps-home.css` (homepage only, scoped to `body.ps-home`)
and its behaviour in `lib/ps-home.js`. Do not restyle it through `style.css`,
which ~190 other pages share. **The homepage does not link `style.css`** (135 KB,
render-blocking, 5% used): it links `lib/ps-home-base.css`, which
`build.py homecss` GENERATES from style.css through a selector allowlist in
`scripts/platform_build/homecss.py` — never edit the slice; if the homepage
needs another style.css rule, add its selector to the allowlist. The hero
painting is encoded by `python3 scripts/hero_images.py` (Pillow; AVIF + WebP,
desktop sizes plus a pre-cropped phone band) — re-run it when
`images/hero image.png` changes. The `<head>` carries a small script that
forwards old links (`/#archive`, `/#sacred-texts`, `/#data-lab`,
`index.html#technology` …, ~140 pages use them) to their new pages — keep it.

**NEVER run `generate_index.py`** (now deleted) or any script that overwrites `index.html`.

## The library pages: /articles/, /sacred/, /explore/

Rendered by `pages.py` from `content/pages/articles.html`, `sacred.html` and
`explore.html` (styles `lib/ps-library.css`, scoped to `body.ps-library`;
behaviour `lib/ps-articles.js` and `lib/ps-sacred.js`). Edit the sources,
never the output.

- **The archive of every essay is `content/pages/articles.html`.** Its deck
  cards keep the shape `<a href="/articles/…" class="deck-card" data-category="…">`
  (registry.py reads it; CI fails if the deck and `article_metadata.json`
  disagree). Filter counts there are `{{stat:deck.*}}` tokens — never typed.
- The sacred-text views (mandala / timeline / cards) and their data are in
  `lib/ps-sacred.js`; the text list itself is `data/platform/catalog.json`.

## About page and the shared header

`about.html` is GENERATED from **`content/pages/about.html`** by
`python3 scripts/platform_build/build.py pages` — edit the source, never the
output (CI fails if it is stale). Its audit, decisions and the facts still
awaiting Paddy's confirmation are in **`docs/ABOUT-PAGE-AUDIT.md`**. Career
facts come from the Resume, counts from `{{stat:…}}` tokens.

The homepage, About and every `pages.py` page share ONE header — a single
sticky row: wordmark · Read · Prepare · Sacred · Explore · Mentoring · About ·
a search field (the owner's design, 2026-09-26, with Mentoring restored at
the owner's request on 2026-09-27). Markup in `index.html` (by hand) and
`nav_html()` / `footer_html()` in `pages.py` (must agree), styles in
`lib/ps-chrome.css` (scoped to `body.ps-chrome`), sticky state and the phone
layout in `lib/ps-nav.js`. Do not fork the navigation. **Never remove or
demote an item the owner asked for (Mentoring was once dropped by a redesign
and had to be restored) — ask first.** JobSignal and the Atlas are reached
from the Prepare gateway, `/explore/`, search and the footer. The footer (the
owner's spec, 2026-09-27) is one primary row that mirrors the header, then ONE
quiet utility row (JobSignal · Atlas · Resume · Visual Résumé · Testimonials ·
Contact · Privacy · Terms · Disclaimer · Copyright); no link appears twice in it. Hand-crafted pages
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
3. Add a `deck-card` entry at the top of the `deck-grid` in
   `content/pages/articles.html` (root-relative `href="/articles/…"`,
   `src="/images/…"`)
4. Optionally make it the homepage's one featured story: replace the
   `<article class="ps-feature">` block in `index.html` (title, one line,
   reading time, its own artwork in `images/home/`). One story only — never a
   list or a grid.
5. Add a `<url>` entry to `sitemap.xml`
6. Run `python3 scripts/platform_build/build.py all`. This is NOT an index
   generator: it renders `/articles/`, restamps the filter counts and other
   `data-ps-stat` numbers, and refreshes the search index, feeds and graph.
   CI (`build.py check`) fails if the deck and `article_metadata.json` disagree.
7. Run NO index generation scripts

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
- `interviewintel/` — Interview Intelligence discovery pipeline + its ledger and review decisions
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
`CAT_LABEL` in `scripts/platform_build/search_index.py`; the deck filter button
in `content/pages/articles.html` (with a `{{stat:deck.<id>}}` count);
`FILTERS` in `lib/ps-articles.js`; and the legacy-hash map in the `<head>` of
`index.html`. Then run `python3 scripts/platform_build/build.py all`.

## Platform layer (read before touching nav, search, footers or counts)

`docs/PADDYSPEAKS-PLATFORM-IMPLEMENTATION.md` is the map. In short:
- Navigation is Read · Prepare · Sacred · Explore · Mentoring · About + a search field
  (`NAV` in `pages.py`; `index.html` by hand, same order). Journey ids are
  unchanged (`read`, `prepare`, `learn` = Sacred, `build` = Explore; `find` =
  JobSignal). **No URL moved**: old homepage anchors are forwarded.
- Search is `lib/ps-search.js` over `data/search/*.json` (built by
  `build.py search`). The homepage's old inline search engine was removed.
- `lib/ps-platform.js` (on ~280 pages) adds the legal footer row, a skip link
  where missing, and records "Continue" visits for pages with
  `<meta name="ps:continue">`. Nothing it does leaves the browser.
- Every browser-storage key must be listed in `data/platform/state-keys.json`.
