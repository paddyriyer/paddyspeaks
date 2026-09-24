# PaddySpeaks Platform Audit

_Audited 2026-09-24 against `main` @ `1a19d02`. Every claim here was checked
against the repository, not taken from the brief. Where something could not
be verified from inside the build container, it says so._

This is the "before" picture for the P0–P2 platform work. The plan built on it
is `docs/PADDYSPEAKS-PLATFORM-PLAN.md`; what was actually done is in
`docs/PADDYSPEAKS-PLATFORM-IMPLEMENTATION.md`.

---

## 1. Architecture at a glance

| Layer | What it is | Where |
|---|---|---|
| Static site | ~1,324 tracked HTML files, no framework, no bundler, no `package.json` at the root. Pages are self-contained HTML with inline CSS/JS, many sharing `/style.css`. | repo root |
| Hosting | Custom domain via `CNAME` (`paddyspeaks.com`). `privacy/app.js` records that **paddyspeaks.com is GitHub Pages** (a relative `/api/` 404'd there), while `docs/REPO-GUARDRAILS.md` says pushes "auto-deploy to Cloudflare". That fits GitHub Pages behind a Cloudflare-managed DNS zone. The live headers could not be checked from the container (the proxy blocks the domain). There is no `_headers` or `_redirects` file. | `CNAME` |
| API | **One** Cloudflare Worker (`paddyspeaks`) on the custom domain `ps.paddyspeaks.com`, deployed from Git. It serves analytics, contact, testimonials, leaderboard and the privacy scan. | `analytics/worker/` |
| Databases | Three Cloudflare D1 databases bound to the Worker (see §4). | `analytics/worker/wrangler.toml` |
| Batch jobs | GitHub Actions only (no Worker crons). | `.github/workflows/` |
| Data pipelines | Python (stdlib) for JobSignal; Python + Anthropic SDK for question generation. | `jobsignal/`, `.github/scripts/`, `interview/scripts/` |
| Local tool | `privacy-agent`: a Node CLI that runs on the user's machine, never deployed. | `privacy-agent/` |

### File population

| Area | HTML files | Notes |
|---|---:|---|
| `interview/` | 1,017 | 989 are `interview/data/enrichments/*` HTML fragments (robots-disallowed). The rest are legacy pages. |
| `articles/` | 160 | Includes `articles/index.html`. |
| `interview.app/` | 75 | Interview Studio. |
| Sacred-text apps | 23 dirs | Each is `index.html` + `app.js` + `data.js` (+ `style.css`). |
| Other products | ~40 | jobs, demos, privacy, contact, testimonials, analytics, careeros, etc. |

---

## 2. Routes (public products)

| Journey (proposed) | Route | Implementation |
|---|---|---|
| Read | `/`, `/articles/*.html`, 7 root-level visual essays | Hand-crafted `index.html` (4,600 lines); articles are self-contained HTML. |
| Learn | `/bhagavad-gita/` … 23 sacred-text dirs, `/devotional-music/` | Per-text `app.js` + `data.js`; data files carry their own source comments. |
| Prepare | `/interview.app/` + 33 sub-sections | Static app; question data in `interview/data/`; nav partial `interview.app/partials/nav.html` injected by `build_nav.py`. |
| Find | `/jobs/` (+ `search`, `job`, `company`, `saved`, `alerts`, `methodology`, `health`) | JS-rendered; data committed by the pipeline to `jobs/data/`. |
| Find (legacy) | `/interview.app/jobs/` | Separate Adzuna+ATS board refreshed weekly by `refresh-jobs.yml`. |
| Build | `/ai-command-center/`, `/revenue-intelligence/`, `/resilience-war-room/`, `/lakehouse/`, `/ic-flightdeck/`, `/careeros/` | Single-page demos, Chart.js from jsDelivr. |
| Tools | `/privacy/` | Privacy Console (browser app + Worker scan routes). |
| Utility | `/about.html`, `/resume.html`, `/visual-resume.html`, `/contact/`, `/testimonials/`, `/case-study-boundary-guard.html` | |
| Admin | `/analytics/`, `/testimonials/admin.html` | Password-gated in the browser, `noindex`. |
| Redirects | `/interview/` → `/interview.app/`, `/careeros-spec/` → article | Meta refresh + `location.replace`. |

**Missing routes the brief asks for:** `/privacy-policy/`, `/terms/`,
`/disclaimer/`, `/copyright/`, `/corrections/`, `/changelog/`, any RSS feed.

---

## 3. Content sources

| Content | Source of truth | Shape |
|---|---|---|
| Articles | `article_metadata.json` | Array of `{title, date, category, read_time, subtitle, slug, hero_image}` (5 carry `series`). **129 entries.** |
| Homepage archive | Hand-written `.deck-card` elements in `index.html` | **149 cards** (77 technology / 54 philosophy / 14 ai / 4 personality). |
| Interview question bank | `interview/data/questions.json` | **1,527** records (sql 991 · python 486 · shell 50), 107 companies. `manifest.json` carries totals. |
| Skill Check pools | `interview.app/evaluate/data/*.json` | Grow daily via `weekly-questions.yml`; 1,910 across the 7 headline sections. |
| Data-model scenarios | `interview.app/design/data-modeling.html` | **23** scenario ids (`h-sc-*`). |
| Sacred texts | `<dir>/data.js` per text | JS object literals; Gita split into per-chapter shards. |
| Homepage sacred index | Inline `var sacredTexts = [...]` in `index.html` | 22 entries. `subramanya-bhujangam/` (23rd) is in the sitemap but not on the homepage. |
| Jobs | `jobs/data/{index,stats,companies,health,history}.json` | Rewritten every 4 hours by the pipeline. |

### The article-count problem (three disagreeing numbers)

- `article_metadata.json` = **129**
- homepage deck = **149**
- `articles/*.html` = **160**

20 deck articles have no metadata entry (e.g. `the-new-language-of-data`,
`welcome-to-paddyspeaks`, `the-lotus-in-the-mud`). One metadata entry has no
deck card (`narayaneeyam-the-poem-that-healed-a-poet`). The deck also contains
`privacy/`, which is not an article. The remaining files are alternates,
`_extended` versions or unlisted drafts.

---

## 4. Databases (Cloudflare D1)

| Binding | Database | Tables | Personal data |
|---|---|---|---|
| `DB` | `paddyspeaks-analytics` | `page_views`, `events`, `visitors`, `server_hits`, `excluded_visitors`, `ingest_errors` | Pseudonymous visitor UUID, geo (country/city/region), ASN org, UA-derived browser/OS/device. No IP. |
| `LB` | `paddyspeaks-leaderboard` | `leaderboard_entries`, `used_nonces`, `daily_metrics` | Alias, score, SHA-256 of the deletion token. No IP/UA. `expires_at` is written but **nothing prunes it**. |
| `FORMS` | `paddyspeaks-forms` | `testimonials`, `contact_log`, `rate_limits` | **Testimonials hold PII** (name, email, role, org, body, salted IP hash). Contact bodies are *not* stored; only reason + hashes. |

Schema files: `analytics/worker/schema.sql` + `migrate-v2..v7`,
`leaderboard-schema.sql`, `forms-schema.sql`.

## 5. APIs (all on `ps.paddyspeaks.com`, one Worker)

| Route | Auth | Abuse controls |
|---|---|---|
| `POST /api/v`, `/collect`, `/api/e`, `GET /api/px.gif` | none | bot filters only; no rate limit |
| `GET /api/stats`, `/insights`, `/journeys`, `/realtime`, `/export`; `*/api/exclude` | admin bearer | none on login |
| `POST /api/contact` | none | honeypot, 5/h/IP, 10-min duplicate hash |
| `POST/GET /api/testimonials` | none | honeypot, 3/h/IP; public GET returns approved rows only, never email |
| `GET/POST /api/testimonials/admin` | admin bearer | — |
| `/api/lb/token`, `/submit`, `/`, `/stats`, `/entry`, `/report` | HMAC token / deletion token | single-use nonce; k-anonymity (<5 hidden); **`/report` unauthenticated**; no IP limit |
| `POST /api/scan`, `/api/scan/read`, `GET /api/scan/status` | none | **no rate limit, no origin check**; SSRF guard on host, redirects followed |

External services called by the Worker: Resend (email), Brave Search / Google
Custom Search (privacy scan), arbitrary broker URLs (`/api/scan/read`).

## 6. Scheduled jobs

| Workflow | Schedule | Writes |
|---|---|---|
| `jobsignal-ingest.yml` | every 4h (+ push to `jobsignal/**`) | `jobs/data/` |
| `weekly-questions.yml` | 06:23 Mon–Fri, 06:47 Mon, 07:11 on the 1st | `interview.app/evaluate/*` (Anthropic API, Haiku) |
| `ingest-submissions.yml` | every 6h | `interview.app/evaluate/*` from a published Google Sheet |
| `refresh-jobs.yml` | Mon 06:30 | `interview.app/jobs/data/jobs.json` (Adzuna + ATS) |
| `mirror.yml` | every push | force-mirrors to `paddyriyer/paddyspeaks-backup` |
| `validate-content.yml` | PRs into `main` | read-only checks |

The Worker has **no** cron triggers, so all retention is opportunistic or absent.

## 7. Browser storage (localStorage / sessionStorage)

Fragmented: 30+ keys, four naming conventions (`ps-*`, `qb.*`, `pg.*`,
`jsig_*`, `paddyspeaks.skillcheck.*`, bare names).

| Product | Keys |
|---|---|
| Interview Studio | `qb.set.v1`, `qb.filters.v1`, `pg.sql.lastQ`, `pg.sql.runtime`, `pg.sql.editor.<qid>`, `pg.py.lastQ`, `pg.py.editor.<qid>`, `ps-mock-key` (**user's own Anthropic API key**), `ps-mock-model`, `ps-lb-entries`, `ps-track-<section>`, `ps-votes`, `ps-favs`, `ps-history`, `ps-attempts`, `paddyspeaks.skillcheck.*`, `ps-activity-days`, `ps-cards`, `ps-plan`, `ps-plan-start`, `ps-theme`, `dm-studio-studied`, `dm-studio-theme`; `my-prep` also clears `ps-sim`, which nothing writes |
| JobSignal | `jsig_pipeline_v1` (saved/applied pipeline), `jsig_alerts_v1`; session `jsig_index_v1` |
| Analytics | `_ps_vid`, `_ps_first`; session `_ps_sid`, `_ps_seen`, `_ps_pc`, `_ps_utm_*` |
| Admin | session `_ps_auth` |
| Sacred texts | `narayaneeyam-visited` only |
| Others | `careeros-state-v1`, `ps-privacy-v1`, session `icfd-greeted` |
| Homepage | none |

No cross-product "continue where you left off"; no single place to clear data.

## 8. Search

- **Homepage** (`index.html:4402–4571`): scrapes the 149 `.deck-card`
  elements at load and does substring scoring. It covers articles only; no
  sacred texts, questions, jobs or demos. A `?q=` auto-open backs the
  `SearchAction` JSON-LD.
- **Interview Studio** (`interview.app/js/app.js`): facet + substring search
  over the question bank, synced to `?q=`.
- **JobSignal** (`jobs/js/search.js`): role-family-gated ranker with its own
  relevance test suite.
- **Sacred texts**: some apps have in-page search (e.g. `bhagavad-gita`),
  isolated from each other.

## 9. SEO

- `rel=canonical` on 294 files. Of the ones without it, 989 are
  robots-disallowed fragments; the rest are legacy `interview/html/*`,
  `interview/ads engineering/*`, both `Paddy_Iyer_Resume*.html`, and admin pages.
- JSON-LD in 223 files (Article 194, BreadcrumbList 58, FAQPage 7,
  WebSite 6, SearchAction 1 …). FAQPage use needs a check that each Q&A is
  visible on the page (see §12).
- `sitemap.xml`: 278 URLs, hand-maintained, `lastmod` refreshed by
  `.github/scripts/refresh_sitemap_lastmod.py`.
- `robots.txt` disallows `/*.json$`, which also blocks crawlers from JSON that
  pages fetch. This only matters for JS-rendered pages (`/jobs/`).
- **No RSS/Atom feed.**

## 10. Analytics

First-party only (`lib/ps.js`, on 262 pages) plus a server pixel
(`/api/px.gif`, on 320 pages, including pages without `ps.js`). No Google
Analytics or tag manager. Respects Global Privacy Control; ignores DNT
(documented choice). Persistent visitor UUID in localStorage. Dashboard at
`/analytics/`.

## 11. Authentication

No user accounts anywhere. The only authentication is the **shared admin
password**: the browser SHA-256s it and sends the hash as a bearer token; the
Worker compares it with `===` against the `ADMIN_PASSWORD_HASH` secret. The
hash is therefore the credential. It is unsalted, the comparison is not
constant-time, and login attempts are not rate-limited. It protects
`/analytics/` and `/testimonials/admin.html`.

## 12. Privacy and data handling: claims vs code

| Claim | Where | Verdict |
|---|---|---|
| "runs entirely in your browser … Nothing is uploaded" | `privacy/index.html:7,13` | **Contradicted.** "Scan for me" sends name/address/phone queries to the Worker, which forwards them to Brave or Google; "Find the opt-out" fetches broker URLs server-side; the page loads the analytics pixel and Google Fonts. |
| "no account, no server, nothing uploaded" | `privacy/index.html:295` | **Contradicted** (same reasons). |
| "everything else sends nothing" | `privacy/index.html:38–50` | **Contradicted** by pixel + fonts; omits Brave/Google. |
| "not logged / stored / cached" (scan) | `privacy/index.html:38–50` | **Accurate** for the Worker code (no logs, no D1, `no-store`). Cloudflare platform logs are outside code control. |
| "No tracking" (Interview Studio promo) | `index.html:1186` | **Contradicted**: `interview.app/` loads `ps.js`. |
| "no tracking" | `interview.app/leaderboard/index.html:7` | **Contradicted**: pixel + fonts. |
| "No backend, no telemetry" | `interview.app/README.md` | **Contradicted**: analytics, leaderboard, AI mock (BYO key to Anthropic). |
| "No backend, no tracking" | `interview.app/js/jobs.js:5` | **Overstated.** |
| "no backend, no analytics, and no network request after the fonts load" | `articles/careeros-professional-intelligence-network.html:859` | **Contradicted**: `careeros/` has the pixel. |
| "Cookie-free … No fingerprinting … stores no PII" | `lib/ps.js:3,26` | Cookie-free **accurate**. "No fingerprinting" **overstated**: persistent UUID + screen/viewport/city/ASN org is a pseudonymous identifier. |
| "no free text stored server-side" | `lib/ps.js:64` | **Contradicted**: the referrer search keyword (`sq`) is stored in `page_views.search_query`. |
| "Never shared or published" (contact) | `contact/index.html:118` | Mostly accurate; **Resend (email provider) undisclosed**. |
| Email "never displayed" (testimonials) | `testimonials/index.html:143` | Accurate; Resend undisclosed. |
| privacy-agent "never leaves that machine", encrypted vault | `privacy-agent/README.md` | **Accurate** as documented; README itself discloses the unencrypted `workflows.json` / browser profile. |

There is **no site-wide privacy policy**, terms, disclaimer or copyright page,
and no footer links to any.

## 13. Accessibility risks

| Risk | Where | Severity |
|---|---|---|
| Search overlay is not an accessible dialog: no `role=dialog`/`aria-modal`/label, no focus trap, no focus return, results not announced, input has placeholder only, `outline:none` | `index.html:220–231, 4402–4571`, `style.css:325` | **High**: the primary discovery control. |
| No global `:focus-visible` style; 50 `outline:none` occurrences outside `interview/` | `style.css`, demos, sacred-text CSS | High |
| `prefers-reduced-motion` in `style.css` covers only the nav; scroll-reveal and hover transitions ignore it | `style.css:4960`, `index.html` Deep Dives reveal | Medium |
| No skip link on sacred-text apps, `/privacy/`, `/contact/` | e.g. `bhagavad-gita/index.html` | Medium |
| Sacred-text search input has no label | `bhagavad-gita/index.html:140` | Medium |
| `/jobs/` skip link, nav and footer exist only after JS runs | `jobs/js/ui/header.js:63` | Low–Medium |
| Sacred view toggle buttons (Mandala/Timeline/Cards) are not exposed as a tab set or pressed buttons | `index.html:1030–1034` | Medium |
| `lang` missing on real pages | `Paddy_Iyer_Resume.html`, `tools/share-cards/*`, `scripts/ads_dashboard_blocks/*` | Low |

Good: homepage skip link and landmarks exist; `ps-nav.js` toggle is a
well-built disclosure; `interview.app/` has a skip link and live region;
JobSignal renders through `textContent` with a test enforcing it.

## 14. Security risks

| Risk | Where | Severity |
|---|---|---|
| **CORS reflects any `Origin` with `Allow-Credentials: true`** on every route | `analytics/worker/worker.js:22–30` | High (any site can drive the scan proxy and admin endpoints from a victim's browser; no cookies exist today, so credential theft is limited to what the page itself holds) |
| Admin auth: hash-as-password, `===` compare, no login throttling, token in `sessionStorage` | `worker.js:804–813`, `testimonials.js`, admin pages | High |
| `/api/scan` + `/api/scan/read`: unauthenticated, no rate limit, open fetch proxy (SSRF guard on host only; redirects followed) → cost (Brave/Google quota) and abuse | `analytics/worker/scan.js` | High |
| Rate limiter fails **open** and trusts `X-Forwarded-For` when `CF-Connecting-IP` is absent | `analytics/worker/forms-util.js:39–63` | Medium |
| `FORMS_SALT` falls back to a public constant | `forms-util.js:27–28` | Medium (only if the secret is unset) |
| `/api/lb/report` unauthenticated → anyone can flag any entry | `leaderboard.js` | Low–Medium |
| Analytics ingest has no rate limit | `worker.js` | Low–Medium (D1 write cost) |
| `javascript:` URLs not blocked in `href` built from scan results | `privacy/app.js:582,751,1169,1256,1337` | Medium |
| JobSignal `apply_url_ok` checks host only, not scheme | `jobsignal/pipeline/normalize.py:445` → `jobs/js/ui/card.js:116` | Low (ATS-sourced) |
| No CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options on the static site (no `_headers`) | site-wide | Medium |
| 392 inline event handlers and 299 inline `<script>` blocks → a strict CSP needs `'unsafe-inline'` for now | 102 / 256 pages | Constraint |
| No dependency or secret scanning in CI | `.github/workflows/` | Medium |
| **No committed secrets found** (searched `sk-`, `sk-ant-`, `AKIA`, `re_`, `ghp_`, `AIza`, bearer/token/password literals, plus history) | — | ✓ |

## 15. Hard-coded statistics

| Stat | True value (derived) | Hard-coded copies |
|---|---|---|
| Interview questions | 1,527 | "1511" `index.html:549,1157` (**stale**); "1437" `interview.app/design/index.html:760` (**stale**); "1,500+" `about.html:128`, resumes, `careeros/js/data/profiles.js`; "1400+" fallback `interview.app/js/app.js:225`; "1527" ~25 places incl. nav partial ×35 pages (kept current by `interview/scripts/update_counts.py`) |
| SQL questions | 991 | `sql.html` says 985 **and** 988; `manifest.json` says 988 (**stale manifest**) |
| Python questions | 486 | `python.html` says 476 **and** 486 |
| Data-model scenarios | 23 | "24" `index.html:551,1178`, `interview.app/design/index.html:554`, `about.html:128`, and the page's own heading; "23" `index.html:549`; "22" resumes |
| Articles | 129 / 149 / 160 (see §3) | Filter counts `index.html:1480–1484` hand-typed; resumes "128 articles" |
| Sacred texts | 23 dirs | "22 Sacred Texts" `index.html:1064` (homepage omits Subramanya Bhujangam) |
| Social proof | unverifiable | "1,472 data engineers · last 90 days", "~10 min average session" `interview.app/index.html:491` |
| Live jobs | runtime | none on pages (good); stale numbers only in comments/docs |

## 16. Duplicated metadata and content

- Article metadata is written in up to five places per article:
  `article_metadata.json`, the homepage sidebar card, the deck card,
  `sitemap.xml`, and the article's own `<head>` (title, OG, Twitter, JSON-LD).
- Seven root-level copies of articles (`the-new-language-of-data.html`,
  `skills-in-action-part2-paddyspeaks.html`,
  `the-connector-map-part3-paddyspeaks.html`,
  `what-are-skills-part1-with-files-paddyspeaks.html`,
  `the-skill-set-paddyspeaks-interactive.html`,
  `the-skill-set-part-2-paddyspeaks.html`,
  `claude-skills-article_extended.html`). They are already `noindex` +
  canonical and absent from the sitemap, so SEO is safe, but they drift.
- `interview/html/*` (11), `interview/ads engineering/*` (13),
  `interview/Data-Modeling-Interview-Prep.html` and
  `interview/streamco/arc_source.html` are indexable, have no canonical, and
  overlap `articles/data-engineering-interview-prep.html`.
- The homepage `sacredTexts` array duplicates names/links that each sacred
  app also declares.
- Main nav is hand-written in 121 files; footer in ~140 (`.site-footer`) plus
  ~110 other `<footer>` variants.

## 17. Inconsistent terminology

- The same product has several names: "Interview Studio" / "Interview Question
  Bank" / "Question Bank" / "Interview Prep"; "Skill Check" / "Evaluate";
  "JobSignal" / "Jobs"; "Data Lab" (homepage anchor) / "Enterprise demos".
- Categories: "AI & Future" (UI) vs `ai` (data); "Personality" (nav) vs
  "Personality Development" (filter).
- "System Designs" vs "Design Models" vs "industry data models" vs
  "scenarios" for the same 23 things.

## 18. Dead routes, broken links, orphaned components

21 broken internal references out of 8,052 checked:

- `articles/ai-buzzwords-decoded.html`: 8 images
  `../images/ai-buzzwords-{llm,assistant,rag,agent,mcp,a2a,lowcode,bigpicture}.png`
  do not exist (the hashed versions live in `images/articles/ai-buzzwords-decoded/`).
- `articles/index.html:149` → `../images/year2025-2028.png` (missing).
- `articles/part1.html:380` → a screenshot that was never committed.
- `articles/the-quiet-power-behind-f12.html:1702` → `ss-console-assert.png` (missing).
- `interview/html/0{0..8}-*.html` → `interview/md/*.md` (folder missing, 9 links).
- `Paddy_Iyer_Resume_Detailed.html:299` → `/cdn-cgi/l/email-protection` (leftover).

Orphans: `subramanya-bhujangam/` (not linked from the homepage), the `ps-sim`
storage key, `articles/index.html` (a stale listing page).

## 19. Trust gaps

- The lakehouse demo does not say its data is synthetic (the other five demos do).
- Sacred-text sources are recorded only as code comments in `data.js`. No
  reader-visible provenance, and no verified/reviewed dates. The exception is
  Abhirami Andhadhi, which has a CI validator against its source.
- No corrections mechanism; no updated dates on most articles beyond JSON-LD.
- The AI-generated Skill Check questions (Anthropic Haiku, daily) are not
  labelled as AI-generated anywhere a reader would see it.

## 20. Opportunities for shared components

| Component | Today | Opportunity |
|---|---|---|
| Footer | ~250 hand-coded variants | One legal/links row injected into existing footers + static links on key pages |
| Stats | Hand-typed numbers | `data-ps-stat` spans stamped from the registry |
| Provenance | Code comments | `data/provenance/*.json` + one `Sources & Verification` disclosure |
| Search | 4 isolated engines | One document schema and index; product engines stay for deep search |
| State | 30+ keys | `PSState` wrapper + a documented key registry; Continue module reads existing keys |
| Related content | Some hand-written "related" blocks | Graph-driven `Explore further` |
| Design tokens | `style.css` vars, per-app palettes | A small `ps-platform.css` with focus, badge, radius and spacing tokens shared by new components |

---

## Where each requested change lands (verified locations)

| Item | Real implementation location |
|---|---|
| P0.1 registry | New `data/platform/catalog.json` (hand) → `scripts/platform_build/build.py` → `data/site-registry.json`; stamped into `[data-ps-stat]` spans; extends `interview/scripts/update_counts.py` |
| P0.2 provenance | New `data/provenance/*.json`, `lib/ps-sources.js`; mounted on sacred-text apps |
| P0.3 corrections | New `data/corrections.json` → `/corrections/` |
| P0.4 privacy | `privacy/index.html`, `privacy/app.js`, `privacy/privacy.css`, `lib/ps.js`, `index.html:1186`, `interview.app/leaderboard/index.html`, `interview.app/README.md`, `interview.app/js/jobs.js`, `articles/careeros-professional-intelligence-network.html`, `contact/`, `testimonials/` |
| P0.5 legal | New `/privacy-policy/`, `/terms/`, `/disclaimer/`, `/copyright/`; footer links via `lib/ps-platform.js` + static links on key pages |
| P0.6 security | `analytics/worker/worker.js` (CORS, auth), `forms-util.js`, `scan.js`, `leaderboard.js`, `privacy/app.js`, `jobsignal/pipeline/normalize.py`, new `_headers`, new CI workflow |
| P0.7 backup | New `docs/BACKUP-RECOVERY.md`, `scripts/platform_build/export_d1.sh` |
| P0.8 accessibility | `index.html` search, `style.css` focus/reduced-motion, sacred-text skip links, new `docs/ACCESSIBILITY.md`, CI checks |
| P1.1 IA | `index.html` nav (labels only; URLs unchanged), `lib/ps-platform.js` |
| P1.2 search | `scripts/platform_build/build.py search` → `data/search/*.json`; `lib/ps-search.js` replaces the homepage IIFE |
| P1.3 pathways | `index.html`, new `.ps-paths` block after the masthead |
| P1.4/1.5 state + continue | `lib/ps-state.js`, `lib/ps-continue.js` |
| P1.6 subscribe | `scripts/platform_build/build.py feeds` → `feed.xml`, `feeds/*.xml`; `/subscribe/` |
| P1.7 changelog | `data/changelog.json` → `/changelog/` + `changelog.xml` |
| P1.8 design language | `lib/ps-platform.css` |
| P2.1 graph | `data/graph/edges.json` (hand) + derived `data/graph.json` |
| P2.2 related | `lib/ps-related.js` |
| P2.3 Atlas | `/atlas/` on the same index and graph |
| P2.4 API | `docs/PUBLIC-API.md`; static `/api/v1/*.json` |
