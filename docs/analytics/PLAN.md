# PaddySpeaks Analytics — Prioritized Implementation Plan

Four phases, matching the brief. **Everything is additive and preserves the
live `page_views` history.** Each phase lists files/DB objects, tests, and how
to validate locally. This PR delivers **Phase 1 foundations + all planning
deliverables**; Phases 2–4 are specified here and staged behind them (the
6-tab dashboard is intentionally not shipped before the events that feed it
exist — that would be the "disconnected demo" the brief warns against).

## Phase 1 — Trust & foundations  _(this PR)_
**Goal:** correct, honest data + an event layer everything else builds on.

Files / DB objects:
- `analytics/worker/migrate-v6-events.sql` — **new** `events` table (versioned
  envelope + `properties` JSON), `visitors` roll-up (first_seen/last_seen),
  `bot_events` diagnostic view; **new columns on `page_views`**
  (`referrer_domain`, `referrer_path`, `content_group`, `active_ms`,
  `bot_class`, `internal`, `engaged`) — all `ADD COLUMN … DEFAULT`, no rewrite.
- `lib/ps.js` → **v4** (backward-compatible superset): honor DNT/GPC;
  active-engagement accumulator (visible+focused only); `pagehide` +
  `visibilitychange` flush via `sendBeacon`; scroll milestone events (once
  each); canonical path; `window.psTrack(name, props)` public API; still POSTs
  the same page-view fields the current Worker reads.
- `analytics/lib/classify.js` — pure functions: `botScore`, `sourceOf`,
  `normalizeReferrer`, `canonicalPath`, `contentGroup` (shared by Worker+tests).
- `analytics/lib/metrics.js` — pure sessionization + KPI math (median, engaged
  session, new/returning at session grain, retention with null windows).
- `analytics/lib/config.js` — `THRESHOLDS` (engaged seconds/scroll, session
  gap, small-sample floor, goals) — the single source of tunables.
- `analytics/worker/worker.js` — add `POST /api/e` (event ingest w/ `event_id`
  dedupe, server bot/internal classification, referrer normalization); **fix
  the exit UPDATE** (update by row id); keep `/api/v` and `/api/stats` working.
- `analytics/tests/*.mjs` — dependency-free node tests (repo convention) with
  worked example datasets.
- Delete dead `analytics/tracker.js`.

Validate locally: `node analytics/tests/run.mjs` (all pure logic + worked
examples). Tracker: open any page, DevTools → Application → Session/Local
Storage shows `_ps_sid`/`_ps_vid`; Network shows `/api/v` on load and `/api/e`
on scroll/exit; set `navigator.doNotTrack` and confirm **no** beacons.

## Phase 2 — Decision dashboard
Files: `analytics/index.html` → tabbed shell (Overview/Acquisition/Content/
Studio/Journeys/Data Quality); new Worker aggregations reading `events` for
engaged sessions, medians, source classes, content 2×2, goals; the
"What deserves attention?" rule engine (`analytics/lib/insights.js`, pure +
tested). Replace doughnuts with sorted bars where exact comparison matters;
1-point → KPI fallback; sample sizes beside every rate.
Validate: worked-dataset snapshot tests for each aggregation; insight rules
tested against fixtures so no insight fires below the sample floor.

## Phase 3 — Interview Studio intelligence
Files: `psTrack()` calls wired into `interview.app` (evaluate/quiz-engine.js,
track.js, simulator, flashcards, study-plan, search) per the taxonomy; Worker
funnel/track/question aggregations; search-gap (`no_search_results`) and
difficulty/abandonment reports; "Learning Opportunities" rules.
Validate: funnel math tests on synthetic event streams; a checklist mapping
each emitted event to its dashboard consumer.

## Phase 4 — Retention & optimization
Files: cohort + journey aggregations (paths, next-page, exits, cross-domain);
Day1/7/30 with null incomplete windows; anomaly flags (WoW z-score) feeding
insights; optional A/B bucket field in `properties`; configurable alerts.
Validate: retention window tests (null vs 0), cohort sum invariants.

## Cross-cutting guardrails
- Never regenerate `index.html` (site homepage) — the **analytics** dashboard
  is a different file (`analytics/index.html`) and is safe to edit.
- Keep collection backward-compatible during rollout: old Worker ignores new
  fields; new Worker still reads old payloads. Tracker + Worker ship together.
- No new PII, no fingerprinting, no login. DNT/GPC respected. No full IP stored.
- Preserve every existing dashboard feature and all historical rows.
