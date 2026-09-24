# PaddySpeaks Platform Plan: P0 → P2

_Built on `docs/PADDYSPEAKS-PLATFORM-AUDIT.md`. Order of priority:
**Trust → Consistency → Discoverability → Accessibility → Connectivity.**_

## Ground rules for every item

- **No framework, no bundler, no new runtime dependency.** The site is static
  HTML; the pipelines are stdlib Python. New build steps are stdlib Python
  (`scripts/platform_build/build.py`); new browser code is small vanilla JS in
  `lib/`, loaded only where it is used.
- **URLs do not change.** Navigation labels may change; routes do not.
- **`index.html` is hand-crafted.** It is edited by hand (and by the
  stamper, which rewrites only the text inside `data-ps-stat` spans). It is
  never regenerated.
- **Derived, not typed.** A number shown to readers is either computed at
  build time from the content, or it is not shown.
- **No invented content**: no sources, testimonials, jobs, corrections or
  changelog entries that did not happen.
- **Every generated artefact has a `--check` mode wired into Validate Content.**
  A PR that lets data and surfaces drift fails CI.

---

## P0: Foundation, trust and reliability

### P0.1 Single source of truth for site metadata
- **Problem:** Counts disagree: 1511 vs 1527 questions on one homepage;
  985/988/991 SQL; 22/23/24 design models; 129/149/160 articles; "22 sacred
  texts" with 23 on disk.
- **Existing:** `interview/scripts/update_counts.py` regex-rewrites the
  interview counts from `manifest.json`, but the manifest is itself stale
  (sql 988 vs 991) and the homepage "1511" pattern is not covered. Nothing
  covers articles, sacred texts or demos.
- **Proposed:**
  1. `data/platform/catalog.json` (hand-authored) lists *what exists*:
     journeys, sacred texts, tracks, demos, job products, pages.
  2. `scripts/platform_build/build.py registry` derives every count from the
     content (`questions.json`, evaluate pools, `data-modeling.html`
     scenarios, `article_metadata.json`, deck cards, catalog) and writes
     `data/site-registry.json`.
  3. `build.py stamp` rewrites the inner text of every
     `<… data-ps-stat="key">` element across the site. It is static, so
     no JS is needed, and it is SEO-visible.
  4. `update_counts.py` is fixed to recount `questions.json` itself (not
     trust the manifest), and it now also refreshes the manifest.
  5. Backfill `article_metadata.json` with the 20 published deck articles
     it is missing, reading title/date/category from each article's own
     `<head>` (nothing typed from memory).
  6. `build.py check` (in CI): the registry is current, every stamped span
     matches, every catalog path exists, the deck ⇄ metadata sets agree,
     and the homepage filter counts equal the deck counts.
  7. The question bots regenerate the registry in the same commit.
- **Files:** `data/platform/catalog.json`, `data/site-registry.json`,
  `scripts/platform_build/build.py`, `interview/scripts/update_counts.py`,
  `interview/data/manifest.json`, `index.html`, `about.html`,
  `interview.app/partials/nav.html` (+35 injected copies),
  `interview.app/design/index.html`, `interview.app/sql.html`,
  `interview.app/python.html`, `article_metadata.json`, workflows.
- **Risks:** The stamper edits `index.html`, which CLAUDE.md protects from
  generators. Mitigation: it only replaces text between the tags of an
  element carrying `data-ps-stat`, and it is tested for byte-identical output
  elsewhere. Bot commits must include the regenerated registry, or unrelated
  PRs go red.
- **Acceptance:** One value per statistic everywhere it appears;
  `python3 scripts/platform_build/build.py check` passes; changing
  `questions.json` and re-running changes every surface; CI fails if a
  stamped span is hand-edited.

### P0.2 Trust and provenance framework
- **Problem:** Sources for sacred texts exist only as code comments; readers
  never see them. There are no verified/reviewed dates.
- **Existing:** `data.js` header comments (e.g. "Source: Mahabharata,
  Anushasana Parva (Chapter 149) … Meanings: Based on Adi Shankaracharya's
  Bhashya"). Abhirami Andhadhi has a CI validator against sivaya.org.
- **Proposed:** A documented JSON schema (`docs/PROVENANCE.md`) and
  `data/provenance/<id>.json` per work, seeded **only** with what the code
  already states. Status is honest (`source-noted`, `verified` only where a
  validator exists), and verified dates are left empty where no verification
  happened. `lib/ps-sources.js` renders a compact, collapsed
  "Sources & Verification" `<details>` panel. It is mounted on every
  sacred-text app and supports work/chapter/verse citation and
  translation/commentary sources.
- **Files:** `data/provenance/*.json`, `lib/ps-sources.js`,
  `lib/ps-platform.css`, 23 sacred `index.html`, `docs/PROVENANCE.md`.
- **Risks:** Overstating verification. The schema forbids `verified`
  without `verifiedOn` + `method`, and CI enforces this.
- **Acceptance:** Every sacred-text app shows a collapsed panel whose content
  traces to its `data.js` comment; no source appears that the repo did not
  already cite; the schema check runs in CI.

### P0.3 Corrections and editorial history
- **Proposed:** `data/corrections.json` (schema in `docs/PROVENANCE.md`),
  a `/corrections/` page rendered at build time, and a per-page corrections
  note via `ps-sources.js` when an entry exists. Seeded only with real
  editorial corrections found in git history (e.g. the Abhirami Tamil text
  fix), each linked to its page.
- **Acceptance:** `/corrections/` lists only meaningful, dated corrections;
  the empty state is honest; no commit noise.

### P0.4 Privacy consistency
- **Problem:** See audit §12: contradicted claims on `/privacy/`,
  Interview Studio, leaderboard, CareerOS article, `ps.js`.
- **Proposed:** Rewrite each claim to match the code. Add a **Data flow**
  section on `/privacy/` (browser → `ps.paddyspeaks.com` → Brave/Google),
  and state what stays local. Remove the analytics pixel from `/privacy/`,
  self-host nothing new, and disclose Google Fonts. Fix the `ps.js`
  comments. Name Resend on contact/testimonials. A CI wording test
  (`scripts/platform_build/tests/test_privacy_claims.py`) fails if banned absolute
  phrases ("nothing is uploaded", "no tracking", "no server") reappear on
  pages that load the pixel or `ps.js`.
- **Acceptance:** Every claim in audit §12 is accurate or removed; the
  wording test is green and covers the whole repo.

### P0.5 Legal foundation
- **Proposed:** `/privacy-policy/`, `/terms/`, `/disclaimer/`,
  `/copyright/` (licence + takedown procedure), `/corrections/`, in plain
  language. They distinguish educational content, personal commentary,
  devotional interpretation, career information, AI-generated material
  (Skill Check questions, the AI mock with the user's own key), user
  submissions, and third-party links. Items needing counsel are marked
  `⚖ Needs legal review`. Footer links are added site-wide by
  `lib/ps-platform.js` (appended to any existing footer, else a minimal one)
  and statically on the homepage and the legal pages.
- **Risks:** Fabricated guarantees. Mitigation: the pages describe only
  implemented behaviour and cite the code.
- **Acceptance:** Four pages exist and are linked from the footer of every
  page that loads `ps-platform.js` and from the homepage; no promise exceeds
  the code.

### P0.6 Security baseline
- **Proposed (Worker):** CORS allowlist (paddyspeaks.com, www, localhost),
  no `Allow-Credentials`; constant-time admin compare with a login-failure
  throttle; origin check + per-IP rate limit on `/api/scan*`; do not follow
  redirects to private hosts in `/api/scan/read`; the rate limiter prefers
  `CF-Connecting-IP` only; fail closed for scan; rate-limit
  `/api/lb/report`.
  **(Static):** `_headers` (HSTS, nosniff, Referrer-Policy,
  Permissions-Policy, frame-ancestors, a report-only CSP), effective on
  Cloudflare Pages. If the host is GitHub Pages behind Cloudflare, the same
  values go into a Cloudflare Transform Rule (documented).
  **(Client):** `safeUrl()` for scan-result hrefs; https-only `apply_url`.
  **(CI):** `security.yml` with gitleaks-style secret scanning (pure
  Python pattern scan, no third-party action with write scope), `npm audit`
  for `privacy-agent`, and Worker unit tests for CORS/auth.
- **Risks:** Breaking analytics or forms in production. Mitigation: the
  allowlist includes every origin the site uses; unit tests cover the CORS
  function; CSP ships as **Report-Only**.
- **Acceptance:** Worker tests prove a foreign origin gets no ACAO; scan
  rejects foreign origins; CI fails on a planted fake secret.

### P0.7 Backup and recovery
- **Proposed:** `docs/BACKUP-RECOVERY.md` covering the 3 D1 databases, Git
  data (jobs history ledger, questions), the mirror repo, and Cloudflare
  secrets; D1 Time Travel (30-day point-in-time); an export script
  `scripts/platform_build/export_d1.sh`; retention; restore and test procedures;
  an optional scheduled export workflow (disabled until a token exists).
- **Acceptance:** Every persistent store in audit §4/§6/§7 has a row: what,
  how often, retention, restore, owner, test.

### P0.8 Accessibility baseline
- **Proposed:** Rebuild the homepage search as an accessible modal dialog
  (labelled, focus-trapped, focus-returning, listbox semantics, live result
  count); global `:focus-visible`; global `prefers-reduced-motion` guard;
  skip links on sacred-text apps, `/privacy/`, `/contact/`; a label for the
  Gita search input; `aria-pressed` on the sacred view toggle; a lakehouse
  synthetic-data notice. CI: `scripts/platform_build/tests/test_a11y_static.py`
  (lang, viewport, img alt, label-less inputs, dialog roles on new
  components) over public pages. `docs/ACCESSIBILITY.md` with a manual
  keyboard checklist.
- **Acceptance:** Keyboard-only walkthrough of the five journeys passes;
  the static a11y test is green.

## P1: Turn the site into a platform

### P1.1 Information architecture
- **Proposed:** The homepage nav groups into **Read · Learn · Prepare ·
  Find · Build** + About/Resume/Search. The existing anchors and URLs are
  kept (`#archive`, `#sacred-texts`, `/interview.app/`, `/jobs/`,
  `#data-lab`). The category filters move under Read as data-filter links
  so the existing filter JS keeps working. `lib/ps-platform.js` adds a slim
  "PaddySpeaks › Journey" context strip on product pages that opt in.
- **Risk:** The mobile nav collapses differently. `ps-nav.js` is unchanged;
  test at 390px.

### P1.2 Universal search
- **Proposed:** A document schema
  `{id,type,title,subtitle,text,tags,category,url,updated,source,keywords}`.
  `build.py search` writes `data/search/core.json` (articles, sacred texts,
  tracks, demos, pages, companies, design scenarios, interview topics) and
  lazily-loaded shards: `verses.json` (Gita verses with translation) and
  `questions.json` (question titles), plus jobs read from the existing
  `jobs/data/index.json`, loaded only for a job-type filter or query.
  `lib/ps-search.js` is loaded on open, keeps the article index from the
  deck as an offline fallback, and adds type chips and a type label on each
  result.
- **Performance:** The core shard is under 150 KB; nothing loads until
  search opens.

### P1.3 "What did you come here to do?"
- A five-path strip under the masthead in the site's editorial voice
  (serif, rule lines, no SaaS cards). Counts come from `data-ps-stat`.

### P1.4 Cross-product user state
- `lib/ps-state.js`: namespaced, try/catch-wrapped, versioned get/set, an
  in-memory fallback, a registry of known keys per product
  (`data/platform/state-keys.json`), `export()`, and `clear(product)`.
  Existing keys are **not migrated** (so nothing breaks); they are read
  through adapters. A `SyncAdapter` interface is documented for a future
  optional account.

### P1.5 Continue where you left off
- `lib/ps-continue.js` records the last N pages visited on opted-in pages
  (sacred text + chapter, article, Interview section) into `ps.recent.v1`.
  It reads saved jobs (`jsig_pipeline_v1`) and question sets
  (`qb.set.v1`), renders on the homepage only when there is something to
  continue, and has a visible **Clear history** control. Nothing leaves the
  browser.

### P1.6 Subscription and distribution
- `feed.xml` (all articles) + `feeds/<category>.xml` + `changelog.xml`,
  generated from `article_metadata.json`/`changelog.json`;
  `<link rel="alternate">` on the homepage; `/subscribe/` explains RSS,
  existing JobSignal alerts (browser-local), and email as a documented
  **future** channel (no provider signed up, no fake form).

### P1.7 Platform changelog
- `data/changelog.json` (curated, dated, typed entries from real merged
  work) → `/changelog/` + `changelog.xml`. `build.py changelog --suggest`
  lists candidate entries from git log for a human to curate. It never
  auto-publishes.

### P1.8 Shared design language
- `lib/ps-platform.css`: tokens (radius, spacing, focus ring, badge
  palette, type scale) and the new shared components (type badge, status
  badge, empty/loading/error states, disclosure panel). It is used by all
  new components; existing products keep their personalities.

## P2: Connect the knowledge

### P2.1 Knowledge graph
- `data/graph/edges.json` (hand-curated, typed edges:
  `relatedTo, explains, references, prerequisiteFor, preparesFor, appliesTo,
  verseOf, chapterOf, questionTests, jobRequires`) + derived edges (article
  series, verse→chapter→work, question→company, scenario→track) →
  `data/graph.json`. No graph database.

### P2.2 Related knowledge ("Explore further")
- `lib/ps-related.js` reads `graph.json` for the current URL and renders
  grouped links by relation. It renders nothing if there are no edges. No
  similarity guessing.

### P2.3 PaddySpeaks Atlas
- `/atlas/`: the same index + graph, full-page, with type facets and
  "connected knowledge" per result. Deterministic. The architecture for a
  later synthesis step is documented, not built.

### P2.4 Public feeds / API preparation
- `docs/PUBLIC-API.md`: conventions and candidate endpoints. Static
  `/api/v1/articles.json`, `/api/v1/sacred-texts.json`,
  `/api/v1/changelog.json` and `/api/v1/registry.json` are generated,
  because each is trivial and public.

## SEO, performance, mobile, testing

- **SEO:** Canonical, OG, Twitter and JSON-LD on every new page;
  BreadcrumbList on new pages; `WebSite`+`SearchAction` retargeted to
  `/atlas/?q=`; the sitemap gains the new URLs; no invisible schema.
- **Performance:** The homepage gains ~6 KB of deferred JS (platform) and
  loads search only on open; measured in the implementation doc.
- **Mobile:** Every new component is checked at 390px with a Playwright
  script for horizontal overflow.
- **Tests (all no-network, all in Validate Content):**
  - `build.py check`: registry drift, stamps, catalog paths, deck ⇄ metadata, filter counts, feeds, search index, graph integrity.
  - `scripts/platform_build/tests/test_platform.py`: schema, provenance honesty, privacy wording, static a11y, internal links for new pages.
  - `analytics/tests/run.mjs`: extended for CORS, auth compare, rate-limit IP choice.
  - `lib/tests/search.mjs`: ranking and type filtering.
