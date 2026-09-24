# PaddySpeaks platform upgrade: what was implemented

_Branch `claude/serene-noether-32rejy`, 2026-09-24. Before-state:
`docs/PADDYSPEAKS-PLATFORM-AUDIT.md`. Plan: `docs/PADDYSPEAKS-PLATFORM-PLAN.md`.
What is left: `docs/PADDYSPEAKS-PLATFORM-BACKLOG.md`._

The transformation is architectural rather than cosmetic. No page was
rebuilt, no URL moved, and no framework was added. The pieces:

- **one source of truth** for what exists and how much of it;
- **honest provenance and corrections**;
- privacy language that **matches the code**;
- a **five-journey navigation**;
- **one search** across every product;
- **explainable connections** between them;
- **CI guards** that keep all of this true.

## Architecture decisions

| Decision | Why |
|---|---|
| **Static generation in stdlib Python** (`scripts/platform_build/`), committed output, `check` mode in CI | Matches the existing stack (JobSignal is stdlib Python, the site is static HTML on GitHub Pages). No bundler, no runtime server, reproducible byte-for-byte. |
| **Hand-authored catalog, derived registry** | People decide *what exists*; code counts *how many*. Typed numbers are what drifted. |
| **Stamp numbers into `data-ps-stat` spans** rather than render them with JS | SEO-visible, works without JS, and touches only the digits, so it is safe on the hand-crafted `index.html`. |
| **Small vanilla modules in `lib/`**, loaded only where used, deferred, many lazily | Protects performance: the homepage gains ~15 KB of gzipped JS; the search index (~55 KB gz core) loads only when search opens. |
| **One `lib/ps-platform.js` added to ~280 pages** instead of editing every footer | 250 hand-coded footer variants exist. The script *appends* a legal row, a skip link and Continue recording, and removes nothing. No-JS readers still get static legal links on the homepage and on every new page. |
| **Existing storage keys registered, not migrated** | Renaming keys would wipe people's saved jobs and progress. `ps-state.js` reads them through adapters; a CI check requires every new key to be registered. |
| **Knowledge graph as a typed edge list with provenance** | No graph database. Every edge says where it came from (curated / link / series / tags / structure), so every suggestion can say why. |
| **Deterministic Atlas; no AI** | The brief asked for excellent deterministic search and structure first. The synthesis architecture is documented, with citation and cost rules (`docs/KNOWLEDGE-GRAPH.md`), and not built. |
| **Report-only CSP; `_headers` plus documented Cloudflare rule** | The code records GitHub Pages hosting, which ignores `_headers`. 256 pages carry inline scripts, so an enforcing CSP would need `'unsafe-inline'` anyway. |
| **Ratcheted a11y and relevance tests against real data** | Legacy debt cannot grow, new pages must be clean, and search quality is tested on the committed index with the shipped engine. |

## Changes by item

### P0.1 Registry
- `data/platform/catalog.json` (hand) → `data/site-registry.json` (derived) → `[data-ps-stat]` spans.
- Fixed drift: 1511 vs 1527 questions; 1437 on the design index; SQL 985/988 vs 991; Python 476 vs 486; design models 22/23/24 vs 23 real scenarios; 22 vs 23 sacred texts.
- `interview/scripts/update_counts.py` now recounts `questions.json`: the manifest had drifted to sql=988. It gained `--check`.
- `article_metadata.json` gained the **20 published articles** it was missing, read from each page's own head or card. The homepage gained the missing Narayaneeyam essay card and the orphaned **Subramanya Bhujangam** app.
- The question bots regenerate the registry in the same commit.

### P0.2 / P0.3 Provenance and corrections
- 23 provenance records written only from what the repo states: 13 *sources noted*, 9 honestly *source not recorded*, 1 *under review* (Abhirami, with its known translation-alignment issue).
- `lib/ps-sources.js` panel on every sacred-text app. A CI honesty rule refuses `verified` without a dated text-against-source check.
- `data/corrections.json`, seeded with **5 real, documented corrections**, is rendered to `/corrections/` and onto the affected pages.

### P0.4 Privacy
- Corrected: `/privacy/` "runs entirely in your browser / nothing uploaded / no server" (the scan sends name, address and phone via the Worker to Brave or Google). Also corrected "no tracking" and "no telemetry" on Interview Studio (including its FAQ JSON-LD), the leaderboard, jobs, CareerOS, About, the resume and the README, and `ps.js`'s own "no fingerprinting" and "no free text" comments.
- Added a **Data flow** section to `/privacy/`, and removed the pixel from that page.
- The Worker honours **Sec-GPC** for the pixel and every collector.
- The submit page no longer promises human review or name credit (submissions are formatted by Claude and published automatically).
- Resend is disclosed on contact and testimonials.
- CI `check_privacy_claims()` bans absolute claims on pages that load analytics.

### P0.5 Legal
- `/privacy-policy/` (every flow, with the implementing file), `/terms/`, `/disclaimer/` (educational / commentary / devotional / career / financial / health / AI-generated / user-submitted / third-party), `/copyright/` (with a takedown procedure). ⚖ marks the parts that need counsel.
- Footer row site-wide.

### P0.6 Security
- **Worker:** CORS allowlist (it previously reflected any Origin with credentials allowed); constant-time admin compare and failed-login throttle; scan proxy requires an Origin, has fail-closed per-IP limits, and re-checks every redirect hop against the SSRF guard; the rate limiter ignores spoofable `X-Forwarded-For`; `/api/lb/report` is metered; a daily retention cron.
- **Client:** JobSignal `apply_url` must be https at ingest, and an href guard runs in `jobs/js/dom.js`; `safeUrl()` guards Privacy Console links.
- **CI:** `security.yml` (secret scan of the tree and history, Worker tests, `npm audit`), Dependabot.
- `_headers` with report-only CSP; `docs/SECURITY.md`.

### P0.7 Backup and recovery
- `docs/BACKUP-RECOVERY.md` covers every store: Time Travel, export, restore, and a quarterly recovery test.
- `export_d1.sh`, plus an **off-by-default encrypted** weekly export workflow (the repo is public; the forms database has PII).

### P0.8 Accessibility
- Accessible search dialog; site-wide `:focus-visible` and reduced motion; injected skip links; labelled sacred-text searches with announced counts; `aria-pressed` toggles; 24px targets; 390px reflow fixed.
- The dead "Subscribe" email box was replaced with real follow links.
- The lakehouse demo now says its data is illustrative.
- Axe (WCAG 2.2 AA) CI with a ratcheted baseline; `docs/ACCESSIBILITY.md`.

### P1
- **IA:** Read · Learn · Prepare · Find · Build · Atlas · About. No URL changed; category and section links moved into the pathways strip.
- **Search:** `lib/ps-search.js` plus a sharded index covering 12 content types, including all 697 Gita verses, 2,007 divine names and 1,527 questions. It has type filters and typed results, and hands off to JobSignal and the Atlas. 41 relevance and integrity tests.
- **Pathways:** "What did you come here to do?", in the site's own editorial register, with stamped counts.
- **State:** `lib/ps-state.js` (safe storage, inventory, clear, export, and a sync-adapter seam for a future optional account) and `data/platform/state-keys.json`. The privacy policy shows and clears what is stored.
- **Continue:** `lib/ps-continue.js`, local only, with Clear history. It records sacred-text position via hash (e.g. "Chapter 2, verse 47").
- **Distribution:** `feed.xml`, 4 category feeds, `changelog.xml`, `/subscribe/`. Email is honestly listed as not offered yet.
- **Changelog:** `data/changelog.json` (curated from documented history) → `/changelog/`; `build.py changelog-suggest`.
- **Design language:** `lib/ps-platform.css` tokens and components (see `docs/PLATFORM-DATA.md`).

### P2
- **Graph:** 12 curated concepts, plus edges from real content links, series, shared explicit tags and structure, each with provenance. The hash-picked "You Might Also Enjoy" cards are excluded as arbitrary.
- **Explore further:** on content pages, lazily loaded, up to 8 items, each with a reason.
- **Atlas:** `/atlas/` with search, concept views and a "Preparing for \<Company\>" panel. Deterministic.
- **Public API:** `/api/v1/{articles,sacred-texts,changelog,corrections,interview-categories,registry,index}.json` with a versioned envelope; `docs/PUBLIC-API.md`.

## New files (main ones)

```
data/platform/catalog.json  data/platform/state-keys.json  data/site-registry.json
data/provenance/*.json (+schema.json)  data/corrections.json  data/changelog.json
data/graph/concepts.json  data/graph.json  data/related/*.json  data/search/*.json
api/v1/*.json  feed.xml  feeds/*.xml  changelog.xml  _headers
content/pages/*.html → corrections/ privacy-policy/ terms/ disclaimer/ copyright/ changelog/ subscribe/ atlas/
lib/ps-platform.{js,css} ps-state.js ps-search.js ps-continue.js ps-related.js ps-sources.js ps-atlas.js
lib/tests/search.mjs
scripts/platform_build/{build,common,registry,stamp,checks,pages,search_index,graph,feeds,api,secret_scan}.py
scripts/platform_build/extract_sacred.mjs  scripts/platform_build/export_d1.sh
scripts/a11y/axe-check.mjs  scripts/a11y/baseline.json
analytics/worker/{security,retention}.js
.github/workflows/{security,accessibility,d1-backup}.yml  .github/dependabot.yml
docs/{PADDYSPEAKS-PLATFORM-AUDIT,PADDYSPEAKS-PLATFORM-PLAN,PADDYSPEAKS-PLATFORM-IMPLEMENTATION,PADDYSPEAKS-PLATFORM-BACKLOG,PLATFORM-DATA,PROVENANCE,SECURITY,BACKUP-RECOVERY,ACCESSIBILITY,KNOWLEDGE-GRAPH,PUBLIC-API}.md
```

## Modified major files

- `index.html`: nav, pathways, Continue, search swap, stamped counts, sacred toggle ARIA, Subramanya, Narayaneeyam card, honest follow links, footer row, feeds. **Hand-edited; never regenerated.**
- `analytics/worker/{worker,scan,forms-util,testimonials,leaderboard}.js`, `wrangler.toml` (cron).
- `privacy/{index.html,app.js}`, `lib/ps.js` (comments only), `interview/scripts/update_counts.py`, `jobsignal/pipeline/normalize.py`, `jobs/js/{dom.js,ui/header.js}`.
- ~280 public pages: one `<script defer src="/lib/ps-platform.js">`. ~260 content pages: one `<meta name="ps:continue">`. 23 sacred apps: the sources script and search labels.
- Workflows: `validate-content.yml` (+ platform check and search tests), the two question bots (regenerate the registry).
- `CLAUDE.md`: the new rules (never type a number; the platform layer; adding a category).

## Migrations and deployment notes

- **Worker:** deploys from Git like before. The new cron (`17 3 * * *`) appears on deploy. No new secrets are required. `FORMS` must stay bound (it is used for the new throttles; without it the scan proxy fails closed).
- **Nothing to migrate** in D1 or in browsers.
- **Optional, outside the repo** (see the backlog): the Cloudflare header Transform Rule; Cloudflare Access for the admin pages; GitHub secret scanning and push protection; the D1 backup secrets.

## Performance (measured)

| | Before | After |
|---|---|---|
| Homepage HTML (gz) | 54.6 KB | 54.6 KB (the inline search was removed and the pathways added) |
| Homepage extra JS (gz, deferred) | — | ps-platform 2.3 + ps-state 3.6 + ps-search 7.5 + ps-continue 1.8 = **15.2 KB** |
| Platform CSS (gz) | — | 5.8 KB |
| Search data | none (scraped the DOM) | 54 KB gz on open; +254 KB gz of shards on the first keystroke, cached |
| Article pages | — | ps-platform 2.3 KB; ps-related 1.6 KB + one shard (≤ 47 KB raw) at idle |

No render-blocking script was added. Every new script is `defer` or loaded at idle.

## Testing

| Suite | Result |
|---|---|
| `python3 scripts/platform_build/build.py check` | ✓ registry, stamps, catalog, deck ⇄ metadata, filter counts, update_counts, provenance honesty, corrections, privacy claims, storage keys, pages, search, graph, feeds, API |
| `node lib/tests/search.mjs` | 41 passed |
| `node analytics/tests/run.mjs` | 222 passed (+36 security, privacy and retention) |
| `python3 -m jobsignal.tests.test_pipeline` | OK (+1 scheme test) |
| `node jobs/tests/relevance.mjs` | 35 passed |
| `node interview.app/tests/track-tests.mjs` | 2205 passed |
| `python3 .github/scripts/validate_content.py` | ✓ |
| `python3 scripts/platform_build/secret_scan.py --history` | ✓ none |
| `scripts/a11y/axe-check.mjs` | 8 platform pages clean at 1280 and 390; no regressions on 12 legacy pages |
| Five-persona walkthrough (Playwright, 1280 + 390) | see below |

### Five visitors

1. **Reading an essay** (`/articles/from-frankl-to-the-gita…`): skip link, a way home, *Explore further* → the Karma yoga concept, Gita 2.47/2.48/3.19, Chapter 3; footer to corrections and the privacy policy. An essay with no real connections shows no section rather than a filler one.
2. **Studying a sacred text** (`/bhagavad-gita/#chapter-2-sloka-47`): *Sources & Verification* (what is recorded, what is not); *Explore further* → the Karma yoga concept and the two essays that apply it. The homepage then offers "Continue Srimad Bhagavad Gita, Chapter 2, verse 47".
3. **Preparing for a data-engineering interview**: the homepage *Prepare* pathway; search "spark skew" → the Data skew concept, the Hot Shards design problem, the Spark track; each of those pages links onward to the others with reasons. `/atlas/?q=Meta data engineer` → a "Preparing for Meta" panel (27 questions, live-role search, research, STAR, resume, design).
4. **Searching for a job**: *Find* → JobSignal (legal links in its own footer); "Search live roles" hand-off from site search and the Atlas; saved jobs appear in *Continue* ("Review N saved jobs").
5. **A technology executive**: *Build* → the AI Command Center (synthetic data stated) → *Explore further* → Enterprise AI adoption, "Your AI Is Brilliant. Then the Bill Arrives", AI-native development; Lakehouse → MDM essays; About.

No horizontal overflow at 390px on any page tested.

## Remaining limitations

- Legacy pages carry known contrast and target-size debt (baseline in `docs/ACCESSIBILITY.md`).
- Nine sacred texts record no text source, and none is verified against a source yet.
- Only 44 of 149 essays have explainable connections. The rest need concepts, or authored links.
- Security headers are not live until the Cloudflare rule is added.
- The analytics collectors are not rate-limited, and have no retention period.
- Vishnu Sahasranama names cannot be deep-linked (the app has no hash routing).

## Recommended next steps

In priority order:

1. Unpublish the community-questions Google Sheet.
2. Add Cloudflare Access to the admin pages.
3. Apply the header Transform Rule.
4. Decide the analytics retention period.
5. Source the 9 unrecorded sacred texts.
6. Replace the hash-picked "You Might Also Enjoy" blocks with the graph.
7. Grow the concept set.
8. Fix the Gita and Abhirami palette contrast.
