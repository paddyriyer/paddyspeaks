# Session Handoff — where we left off

_Last updated: 2026-08-10. This file is the running memory between Claude Code
sessions (the web container clones fresh each time). CLAUDE.md points here._

## TL;DR of current state

- **NEW (2026-08-10, latest): the Privacy Console is LIVE at
  `paddyspeaks.com/privacy/`**, alongside the `privacy-agent/` CLI. Design
  notes: **`docs/PRIVACY-AGENT.md`**; user docs:
  **`privacy-agent/README.md`**. Read those before touching it.
  - **One engine, two front ends.** `privacy-agent/src/core/` is pure ES
    modules with zero Node dependencies, so `privacy/app.js` imports the *same*
    files the CLI does, straight from `../privacy-agent/src/core/`. That is the
    whole reason the browser scoring cannot drift from the CLI scoring — do not
    add a Node import (`fs`, `path`, `crypto`) to anything under `core/`, or
    the web app breaks instantly and silently.
  - Pure logic in `core/`: identity normalization, identity graph, match
    confidence, risk, dedupe, state machine, redaction, jurisdiction,
    removability, query generation, attack surface, `explain.js` (the four
    questions on every exposure card) and `optout.js` (ranks a page's own links
    to find the removal route). Tests:
    **`node privacy-agent/tests/run.mjs` — 175 pass**, dependency-free.
    The Worker side is covered by **`node analytics/tests/run.mjs` — 172 pass**.
  - **Invariants with tests named for them — do not "fix" these:** a name match
    alone can never confirm; absence is not evidence; `submitted` ≠ `removed`
    (the state machine forbids the shortcut); no hardcoded broker list; no
    guessed opt-out URLs (an invented `/opt-out` is a confident 404, which is
    worse than "not found"); sensitive fields (SSN/ID/licence/passport) never
    auto-fill; payment is never made; workflow templates carry no PII.
  - **The Worker DOES serve the console now** — this reverses an earlier note
    in this file that said never to wire it up. `analytics/worker/scan.js`
    provides `/api/scan` (search proxy), `/api/scan/read` (fetch one page,
    return text + links) and `/api/scan/status`. It exists because a browser
    page cannot fetch third-party sites: CORS forbids it.
    - **The identity-dossier rule is unchanged and still absolute.** The Worker
      logs nothing, stores nothing (it touches no D1 binding), and caches
      nothing (`no-store` on every response). Queries and URLs pass through and
      are discarded. No identity data is persisted server-side, ever.
    - Both transmissions are disclosed on the page itself, in the assurance
      box, in plain words — the search terms for *Scan for me*, and the listing
      URL for *Find the opt-out*. If you change what leaves the browser, change
      that copy in the same commit. A tool that quietly starts sending a home
      address while still promising "nothing leaves your browser" is doing
      exactly what the brokers do.
    - `/api/scan/read` is a fetch proxy, so `isFetchable()` is a security
      control, not a convenience check: allowlisted schemes plus a denylist of
      loopback/private/link-local/cloud-metadata hosts. Tested in
      `analytics/tests/run.mjs`. Do not relax it.
  - **`API_BASE` is `https://ps.paddyspeaks.com`, not `paddyspeaks.com/api/*`.**
    paddyspeaks.com is GitHub Pages, so a relative `/api/scan` resolves to a
    static 404 — which is exactly how the first live scan came back "0 found"
    with a row of green ticks. Same convention as `lib/ps-forms.js`.
  - Search keys are **Worker Secrets**: `BRAVE_SEARCH_API_KEY` (preferred — no
    daily cap) or `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` (100/day). With no key the
    console says so and falls back to the paste flow; it never scrapes result
    pages. See the warning in `wrangler.toml` — a plaintext var is wiped on the
    next Git-integrated deploy.
  - **The website never submits anything, and cannot.** A page may not fill in
    or submit a form on another origin — same-origin policy, the rule that stops
    any open tab posting from your bank. So the console stops at the submit
    button by law of the platform, not by choice, and the removal engine is the
    CLI. `privacy-agent import <export.json>` carries a console session into the
    vault (`core/handoff.js`), then `run --mission` files the requests. The
    bridge deliberately refuses to inherit a `pending_removal` or
    `successfully_removed` status from the browser: the agent must witness a
    submission itself, since those two states are exactly what this project
    will not take on trust. Rejected records never cross.
  - The CLI additionally drives real Chromium and submits forms, which a static
    page cannot. Verified end-to-end against a local fixture broker with a real
    opt-out form: real submission, case number + processing window parsed,
    encrypted evidence screenshots, and the SSN field correctly blocking
    submission. `npm install` needed in `privacy-agent/` (only dep is
    `playwright`).
  - Still open, raised with the user and unanswered: hero dashboard preview
    populated from the real profile, an exposure-over-time chart (needs
    per-scan history nothing records yet), an aggregate stats bar (**must use
    the user's real numbers — never seed figures**), and a possible rename.
- **2026-08-08: Polish Sprint Wednesday — PS-05, PS-07, PS-08**
  on branch `claude/weekly-action-plan-kjgt5b`. Two new shared modules under
  `interview.app/js/`:
  - **`pg-states.js`** — the engine boot skeleton (PS-05) and the empty-state
    renderer (PS-08) for both playgrounds. Boot progress is **by completed
    milestone, not a percentage**: neither sql.js/PGlite nor Pyodide reports
    byte progress, so a percentage would be invented. Three steps —
    download, open, seed. The skeleton never paints over results already on
    screen, and SQL retires it inside `activateEngine()` (after CSV seeding),
    which is the first moment the pane can actually take a query.
  - **`pg-shortcuts.js`** — PS-07. A page declares `window.PG_SHORTCUTS`; each
    entry names a **button id**, and the shortcut clicks that real button, so
    the keyboard and the toolbar can never disagree. `?` opens the cheatsheet,
    and a `? shortcuts` affordance is injected into `.pg-editor-toolbar`.
    Bare-letter shortcuts are suppressed while typing (`isTyping()` checks for
    INPUT/TEXTAREA/SELECT/contentEditable); modifier combos still fire inside
    the editor. **Note the toolbar class is `.pg-editor-toolbar`, not
    `.pg-toolbar`** — that cost a round.
  - PS-08 also fixed a genuinely blank state: filtering the company or topic
    picker in `evaluate/index.html` to zero matches rendered **nothing at
    all** (`.cp-empty` was styled but never used). It now names the term and
    notes that existing selections stay active while hidden by the filter.
  - Remaining sprint: **Thu PS-02** (CodeMirror 6, vendored locally under
    `vendor/`, NO runtime CDN, keep textarea as the no-JS fallback), **Fri
    PS-03/PS-13/PS-12/PS-14/PS-10 + QA**.
- **2026-08-06: CareerOS shipped** — `/careeros/`, an independent design
  prototype of an "AI-native professional network" (PR #756, branch
  `claude/careeros-prototype-design-eti35a`). 46 files, ~11.3k lines, vanilla
  ES modules with no build step: `js/store.js` + `js/dom.js` + per-view and
  per-component modules, persona-driven dashboards with user-rearrangeable
  panels, explainability drawer, recruiter trust metrics, philosophy page.
  **It already exists — check before building anything CareerOS-shaped.**
- **2026-07-28: Polish Sprint Mon + Tue merged** — PR #743 (PS-01 theme
  unification, PS-09 single focus ring, PS-11 blue purge) and PR #744 (PS-04
  value-first Skill Check, PS-06 toolbar hierarchy).
- **2026-07-28: Skill Check empty-pool dead end fixed** (PR #745). A saved
  refinement of Hard + Code empties three of the six sections outright —
  **2026 Hot Topics, AI Engineering and Communication have no code-format
  questions at all** (52 / 152 / 119 questions, every one `single` or
  `multi`). Section cards with a filtered pool of 0 now drop their `href`
  entirely, and the quiz dead end offers "Clear the filter & start
  <section>", which removes the offending localStorage key. **The content gap
  itself is still open** — authoring code questions for those three sections
  is a content decision nobody has taken.
- **2026-07-28: Testimonials + Contact moved into the Studio nav** (PR #746).
  They now live in a fifth `Connect` hub in `interview.app/partials/nav.html`
  (run `python3 interview.app/build_nav.py` after editing it — 33 pages), and
  were removed from the main-site top nav on `index.html`, `about.html` and
  `resume.html`. **Footers on all three still carry both links**, as does
  About's "Send a message" CTA — nothing became unreachable.

- **NEW (2026-07-25, latest): Contact + Testimonials shipped** on branch
  `claude/paddyspeaks-contact-testimonials-4zne28`. Full write-up:
  **`docs/CONTACT-AND-TESTIMONIALS.md`** (read that first for anything here).
  - New pages: `/contact/`, `/testimonials/` (public list + share form), and
    `/testimonials/admin.html` (owner moderation console — noindex, robots-blocked,
    reuses the analytics `ADMIN_PASSWORD_HASH`).
  - Backend follows the leaderboard pattern: new route modules
    `analytics/worker/{contact,testimonials}.js` + `forms-util.js`, mounted in
    `worker.js`, on a **third D1 db `paddyspeaks-forms`** (binding `FORMS`).
    Separate because it HOLDS PII (the leaderboard db is separate because it
    must hold none).
  - Validation is a single pure module `analytics/lib/forms.js`, imported by the
    Worker and mirrored in `lib/ps-forms.js`. Tests: **138 pass** (was 57).
  - Email = **Resend** (one `fetch()`, no SDK — nothing was configured before).
  - Homepage gained a testimonial strip before the subscribe CTA; footers on
    index/about/resume gained Contact + Testimonials; Interview Studio home has a
    contextual invite at the very end (never inside a practice flow).
  - **Provisioned (2026-07-25).** D1 `paddyspeaks-forms` created
    (`d43111c5-5834-4791-b18d-b892643787c6`), schema applied, `FORMS` binding
    enabled in `wrangler.toml`, Resend domain verified (Sending on, **Receiving
    deliberately off** — it would add root MX records and could hijack existing
    mail to `@paddyspeaks.com`). Remaining: the four Worker Secrets/Vars
    (`RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` / `FORMS_SALT`)
    and an end-to-end smoke test. Routes return `503 not_configured` whenever
    `env.FORMS` is missing, so they always degrade safely.
  - Gotcha for future edits: a non-UUID `database_id` fails `wrangler deploy` for
    the WHOLE Worker (analytics + leaderboard too) — that is what broke CI on PR
    #736 and why the binding shipped commented out first.
  - **No testimonials are seeded.** Both the homepage and `/testimonials/` show an
    honest "be one of the first" invitation until real ones are approved — same
    principle as the leaderboard's no-seeding rule.
- **NEW (2026-07-24): Analytics redesign — Phase 3 (complete) + Phase 4
  (Journeys & Retention)** on the same branch, restarted from main after #734
  merged. Wired `psTrack()` into simulator/flashcards/study-plan and added
  `question_started`/`answer_submitted`/`explanation_viewed` to the track engine;
  fixed a latent bug (track results are `"wrong"`, code checked `"incorrect"`).
  Added Worker **`GET /api/journeys`** (weekly retention cohorts with null
  incomplete windows + path analysis: landings/exits/transitions/cross-domain)
  and an **anomaly-detection** insight rule (≥2σ daily move). New Journeys tab
  panels in `analytics/index.html`. Tests **57 pass**; dashboard re-verified via
  headless smoke test (all 6 tabs). **All four phases of the redesign are now
  implemented.** Remaining backlog is optional: A/B bucket field, configurable
  alerts UI, deeper per-question skip/abandon analytics once those UI
  affordances exist.
- **NEW (2026-07-24, earlier): Analytics redesign — Phase 2 (decision dashboard)
  + Phase 3 start (Studio events)** on the same branch, restarted from main
  after #733 merged. Added the **6-tab dashboard** (Overview/Acquisition/Content/
  Interview Studio/Journeys/Data Quality) in `analytics/index.html` — existing
  panels preserved and tab-assigned in JS, new decision panels on top;
  **`analytics/lib/insights.js`** deterministic insight engine (pure, tested,
  never fires below sample floor); Worker **`GET /api/insights`** computing
  engaged sessions/medians/correct new-returning/source+content classes/Studio
  funnels/data-quality via the pure libs. Wired **`psTrack()`** into the quiz
  engine (`interview.app/evaluate/js/quiz-engine.js`) and track engine
  (`interview.app/js/track.js`). Tests now **55 pass** (`node
  analytics/tests/run.mjs`); dashboard verified via headless-Chromium smoke test.
  **Still TODO (Phase 3 rest + Phase 4):** wire simulator/flashcards/study-plan/
  study-day events; `question_started`/`hint_requested`/`explanation_viewed`;
  cohort tables + journey/path analysis + Day1/7/30 retention UI; anomaly
  detection. See `docs/analytics/PLAN.md`.
- **Analytics redesign — Phase 1 (Trust & foundations) on
  branch `claude/paddyspeaks-analytics-audit-refpf4`.** Additive + backward-
  compatible; historical `page_views` preserved. Full write-up in
  `docs/analytics/` (AUDIT, PLAN, EVENT-TAXONOMY, METRIC-DICTIONARY,
  DATA-QUALITY-QUERIES, DECISION-GUIDE). Key changes: tracker upgraded to v4
  (`lib/ps.js` — DNT/GPC respect, active engagement time, reliable pagehide
  beacon, scroll milestones, `window.psTrack()` event API); new versioned
  `events`/`visitors` tables + DQ columns (`analytics/worker/migrate-v6-events.sql`);
  Worker gains `POST /api/e` ingest + fixes the exit-UPDATE bug that was silently
  losing time/scroll on D1 (audit finding B). Pure logic in `analytics/lib/*`
  with 44 tests (`node analytics/tests/run.mjs`). **Deploy order:** merge PR
  (auto-deploys Worker + ships tracker), THEN paste migrate-v6 into the D1
  Console. `/api/e` no-ops safely until the migration is applied. Dead
  `analytics/tracker.js` removed. Phases 2–4 (6-tab dashboard, Studio event
  instrumentation, cohorts/journeys) are specified in `docs/analytics/PLAN.md`,
  NOT yet built — do them next, in order.
- **NEW (2026-07-23): Two learning tracks shipped — Communication and AI
  Engineering.** Both are branch `claude/interview-studio-learning-tracks-w17fey`.
  - Content is authored in re-runnable builders: `scripts/build_communication.py`
    (119 exercises, 13 modules — incl. a "Global Workplace Language" module
    decoding corporate jargon, sports metaphors and regional English) and
    `scripts/build_ai.py` (152 questions, 20
    modules). They emit `interview.app/evaluate/data/{communication,ai}.json`
    (same schema as the Skill Check) and `interview/data/questions-ai.json` (the
    Question Bank subset). `build_ai.py` also keeps `interview/data/languages.json`
    + `topics.json` in sync so **AI is a first-class Question Bank category**
    (language chip `ai`, 20 AI type facets).
  - Both tracks appear in **Skill Check** (`evaluate/` — new sections `ai`,
    `communication`), **Flashcards** (same data files), and the **Learn nav hub**
    (`partials/nav.html` → run `build_nav.py`).
  - New interactive **track pages**: `interview.app/communication/` and an added
    "Practise" section on `interview.app/ai-engineering/`, both powered by the
    shared **`js/track.js` + `css/track.css`** engine (module progress, filters
    by topic/level/role/type, bookmarks, mixed/daily practice, continue-where-
    left-off, interview-readiness score — all localStorage, `ps-track-<section>`).
  - Tests: `node interview.app/tests/track-tests.mjs` (dependency-free, 2000+
    checks). To edit content, change the builder and re-run it — never hand-edit
    the generated JSON.
- **Anonymous Community Leaderboard is LIVE** end-to-end (submit, alias, rank,
  delete all working). Backend = Cloudflare Worker + a **separate D1 database**.
- Public board is **hidden by k-anonymity until 5 real scores** exist
  (`suppressBelow: 5`). Until then the page shows a labelled **sample preview**.
- **LinkedIn launch blurb is intentionally parked** until real scores are
  flowing — the user wants organic entries first, no seeding. Write it then.

## Leaderboard — provisioning facts (already done)

- D1 database: **`paddyspeaks-leaderboard`**, id `d49bd1fd-0460-4339-b46d-94f00981a4ad`
  (bound as `LB` in `analytics/worker/wrangler.toml`).
- Schema applied from `analytics/worker/leaderboard-schema.sql`
  (comment-free copy for the D1 dashboard Console:
  `analytics/worker/leaderboard-schema.console.sql`).
- Secret **`LB_SIGNING_KEY`** is set in the Cloudflare dashboard (Worker → Settings
  → Variables and Secrets, type Secret). **Not stored in the repo.** To rotate,
  set a new random value in the same place.
- Deploys are **Git-integrated**: pushing to `main` auto-deploys the Worker
  (the "Workers Builds: paddyspeaks" check + the cloudflare bot on PRs).
- The Worker returns `503 "not configured"` unless BOTH the `LB` binding and
  `LB_SIGNING_KEY` are present — so the board degrades safely.

## Leaderboard — how it works (key files)

- `analytics/worker/leaderboard.js` — routes on `/api/lb/*`. Config in `CFG`:
  `tokenTtlMs 3h`, `minDurationS 10`, `suppressBelow 5`, `retentionMonths 12`,
  `diffMult`, `firstAttemptMult`. Aliases via `makeAlias()` (ADJ×NOUN×#NNN, CSPRNG).
  HMAC single-use attempt tokens; server measures duration; integrity states
  (valid/suspicious/under_review); k-anon suppression; per-entry deletion-token hash.
- `analytics/worker/worker.js` — mounts `routeLeaderboard()`; CORS allows
  `GET, POST, DELETE, OPTIONS` (DELETE was added to fix entry deletion).
- `interview.app/js/lb-client.js` — browser client. Deletion tokens live ONLY in
  `localStorage` (`ps-lb-entries`); sent nowhere except to delete your own entry.
- `interview.app/leaderboard/index.html` + `leaderboard.js` — the board page
  (tabs, states, sample preview, "your entries" + delete, "how your alias works").
- `interview.app/evaluate/js/quiz-engine.js` — issues the attempt token at quiz
  start; renders the consent-gated opt-in on the results screen. Guarded: no card
  appears if the backend is dormant. Only SQL/Python sections map to a category.
- `analytics/worker/LEADERBOARD_DEPLOY.md` — full deploy + rollback checklist.

## Open / deferred items (nothing blocking)

- **▶ IN PROGRESS — Interview Studio "Polish Sprint" (execute, do not re-plan).**
  Running on branch **`claude/weekly-action-plan-kjgt5b`** (the session was
  pinned to that branch, not the `claude/interview-studio-polish-zhfaet` the
  plan named; same work, different branch name). Polish only, **no feature
  creep**.
  - **Mon 2026-07-27 — PS-01, PS-09, PS-11 all DONE and committed.** Notes that
    matter for the rest of the week:
    - PS-01 was bigger than "add a stylesheet": the 21 pages consumed **zero**
      `--color-*` tokens, so loading `studio.css` alone would have changed
      nothing in light mode and put a dark background under light-mode tints in
      dark mode. The real fix was **505 hex→token substitutions** (slate ramp →
      ink/muted/light-muted/border/cream/paper, blue accents → gold family).
    - All 21 pages are pinned **`<html data-theme="light">`**. They carry ~100
      bespoke status tints (green "done" cards, red warnings, amber highlights)
      with no dark variant. `style.css` ships no dark rules, so they were
      already light-only in practice — the pin just stops `studio.css`'s
      `prefers-color-scheme` rules from half-applying. **Follow-up (not
      scheduled):** convert those tints to the dark-aware `note/trap/warn`
      tokens, then drop the pin.
    - White card backgrounds were left as `#fff` on purpose — white-on-warm-
      paper is the Studio convention (`studio.css --surface #fff` on
      `--bg #faf8f4`).
    - PS-09 canonical ring, **match this exactly** if you add a focus rule:
      `outline: 3px solid var(--color-gold-dark); outline-offset: 2px;`.
      Greppable invariant — nothing else should match `outline:.*px solid`.
    - PS-11 found two sources of blue beyond the two the ticket named: the
      **nav template's whole light-mode block** (its dark block was already
      warm) and **`css/track.css`'s `--tk-*` palette** (raw slate + teal, which
      is why the Communication / AI Engineering track pages read blue inside an
      otherwise warm page). Both now derive from `--color-*`.
    - Left blue on purpose (categorical colour-coding, not chrome):
      `.chip-vedic/devotional/hymn/ritual`, `.rmc-1..6`, and the SVG diagrams in
      `design/data-modeling.html`.
    - The 29 `design/the-*-problem.html` deep-dives are **not** part of the
      theme fracture — they are a deliberate separate system (`whiteboard.css`,
      Cormorant Garamond / Newsreader / DM Mono). Leave them alone.
  - **Tue 2026-07-28 — PS-04, PS-06 DONE and committed.**
    - PS-04: the six section cards now sit directly under the hero; both config
      panels live in one `<details class="eval-config">` closed by default. Its
      summary shows a live state line (`#ecfg-state`, updated inside the
      existing `refresh()`), which matters because filters persist in
      localStorage — a returning visitor sees a saved refinement without
      opening the panel. Hero lede cut to two sentences; everything it shed was
      already in the "How it works" list.
    - **Gotcha:** `evaluate/index.html` has a bare `<body>` (no `studio-skin`),
      so it gets **no global link colour** — a plain `<a>` renders browser-blue.
      Style any new link explicitly. Same trap on the other bespoke pages.
    - PS-06: both playground toolbars lead with the primary Run; secondary and
      destructive actions moved behind a "⋯ More" menu driven by the new shared
      **`interview.app/js/pg-overflow.js`** (nav dropdown pattern: aria-expanded,
      click-outside, Escape restores focus). Buttons kept their ids, so the
      bindings in `sql.js`/`python.js` were untouched — do the same if you move
      any more.
    - PS-11 finished off in `playground.css` (navy `#243042` schema block → the
      warm `--code-bg`/`--code-fg`, plus two slate values). That file was
      outside Monday's "shared chrome" scope.
    - Pre-existing, NOT ours: `interview/data/enrichments/co_sql_305-0108.html`
      404s on the SQL playground. Reproduces on a clean tree.
  - **Wed 2026-08-08 — PS-05, PS-07, PS-08 DONE.** See the top of this file
    for the detail. Remaining: Thu PS-02, Fri PS-03/PS-13/PS-12/PS-14/PS-10
    + QA.
  Full ranked plan + before/after mockups (artifact):
  https://claude.ai/code/artifact/0a2933e5-e69a-4dfb-a3be-7c1efef534af
  Audit was grounded in real renders (Playwright screenshots) + code. Headline
  findings: (1) **theme fracture** — ~20 nav pages (leaderboard, simulator,
  stories, flashcards, mock, behavioral, career, companies, elevator-pitch,
  incidents, interviewer, mistakes, red-flags, resume, study-plan, submit,
  whats-new, ai-engineering, my-prep …) DON'T load `studio.css`, so they render
  on the legacy cool-blue palette; flagship pages (home, evaluate, sql/python)
  do. (2) playground editors are bare `<textarea>` (no syntax/line numbers).
  (3) loading = text-only `setStatus()`; empty states = one italic line;
  toolbars = 8–11 equal-weight buttons; Skill Check buries Start below config.
  Execution order (Mon→Fri): 
    - Mon: PS-01 unify theme (add studio.css + `body.studio-skin` + Inter to the
      ~20 pages), PS-09 single focus ring (app.css teal `#0e7490` vs studio gold),
      PS-11 purge blue leftovers (`rgba(26,79,138,.08)` card shadow, `#93c5fd`/
      `#1e40af` tag hovers).
    - Tue: PS-04 value-first Skill Check (start-first, collapse company/pool config),
      PS-06 toolbar hierarchy (one primary Run + overflow for Clear/Reset).
    - Wed: PS-05 skeleton/progress loading, PS-08 intentful empty states,
      PS-07 shortcuts + `?` cheatsheet.
    - Thu: PS-02 CodeMirror 6 (vendor locally under `vendor/`, NO runtime CDN;
      keep textarea as no-JS fallback; sql+python+quiz).
    - Fri: PS-03 first-run onboarding, PS-13 mobile pass, PS-12 motion tokens,
      PS-14 prefetch, PS-10 home hero single-CTA. QA + draft PR.
  Guardrails: never regenerate index.html (hand-edit PS-10); nav stays templated;
  quiz/playground stay `data-theme="light"`; ship as draft PR, one commit per ticket.
  Screenshot script used: `interview.app` via `python3 -m http.server` +
  Playwright at `/opt/node22/lib/node_modules/playwright` (chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- **LinkedIn blurb** — write once real scores are coming in (drafts existed in
  chat; drop the "coming soon" framing).
- Optional product tweaks the user declined for now (leaving organic):
  - Lower `suppressBelow` to 3 for launch, then raise later.
  - Guard the opt-in so a 0% / near-empty attempt can't be published.
- Hardening backlog (all additive): IP-hash rate limiting with a daily-rotating
  salt (privacy review first), suspicious-entry quarantine/admin view,
  percentiles/badges, retention cron jobs, owner analytics dashboard.

## Gotchas / house rules (don't relearn these)

- **NEVER regenerate `index.html`** or run any index-generation script — the
  homepage is hand-crafted (see CLAUDE.md).
- **Nav is templated**: edit `interview.app/partials/nav.html`, then run
  `python3 interview.app/build_nav.py`. Do not hand-edit nav inside pages.
- **Playground/quiz pages are light-only** (`data-theme="light"` hardcoded) — a
  fix for an iPad auto-dark bug. Keep them light; WCAG-AA contrast.
- **D1 dashboard Console flattens newlines** — paste the comment-free
  `.console.sql`, not the commented schema.
- After a PR merges, **restart this branch from latest `main`** for the next
  change (branch: `claude/paddyspeaks-expert-review-0c0gcf`).

## What shipped this session (high level)

Rebrand to "Interview Studio"; nav overhaul (26 flat links → 4 dropdown hubs via
templating); homepage redesign + Community Challenge Board promo; de-essayed
design pages; dark-mode playground fix; mobile playground overflow fix; heuristic
Hint system; JSON load-error fix; SEO long-tail retitle of 27 design pages +
sitemap; and the full anonymous leaderboard (backend + frontend + go-live).
