# Session Handoff — where we left off

_Last updated: 2026-07-22. This file is the running memory between Claude Code
sessions (the web container clones fresh each time). CLAUDE.md points here._

## TL;DR of current state

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

- **▶ SCHEDULED NEXT WEEK — Interview Studio "Polish Sprint" (execute, do not re-plan).**
  User approved the plan; wants it built next week on branch
  `claude/interview-studio-polish-zhfaet`. Polish only, **no feature creep**.
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
