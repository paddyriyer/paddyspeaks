# Session Handoff — where we left off

_Last updated: 2026-07-22. This file is the running memory between Claude Code
sessions (the web container clones fresh each time). CLAUDE.md points here._

## TL;DR of current state

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
