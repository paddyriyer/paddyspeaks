# PaddySpeaks Analytics — redesign docs

Decision-oriented, privacy-conscious analytics. Start here.

| Doc | What it is |
|---|---|
| [`AUDIT.md`](AUDIT.md) | Findings from the existing pipeline (ranked defects + what to preserve) |
| [`PLAN.md`](PLAN.md) | Prioritized 4-phase implementation plan (files, DB objects, validation) |
| [`EVENT-TAXONOMY.md`](EVENT-TAXONOMY.md) | Versioned event schema + full event registry |
| [`METRIC-DICTIONARY.md`](METRIC-DICTIONARY.md) | Exact formulas for every metric (configurable thresholds) |
| [`DATA-QUALITY-QUERIES.sql`](DATA-QUALITY-QUERIES.sql) | Validation queries for the Data Quality tab |
| [`ADDING-EVENTS.md`](ADDING-EVENTS.md) | Recipe for adding a new event |
| [`DECISION-GUIDE.md`](DECISION-GUIDE.md) | "How to use this dashboard to make decisions" |

## What shipped in Phase 1 (this PR)
Trust & foundations — **additive, backward-compatible, historical data preserved**:
- Corrected metric math (`analytics/lib/metrics.js`) + classification
  (`analytics/lib/classify.js`) + tunables (`analytics/lib/config.js`), with 44
  worked-example tests (`node analytics/tests/run.mjs`).
- Versioned event schema (`analytics/worker/migrate-v6-events.sql`) — new
  `events` + `visitors` tables and data-quality columns on `page_views`.
- Tracker v4 (`lib/ps.js`): honors DNT/GPC, active (visible+focused) engagement
  time, reliable `pagehide`/`visibilitychange` beacon flush, scroll milestone
  events, and a public `window.psTrack(name, props)` event API.
- Worker: `POST /api/e` event ingest (server-side bot/internal/referrer
  classification, `event_id` dedupe), and the exit-UPDATE bug fix (audit B).

## Deploy order (important)
1. Merge the PR — this deploys the Worker (git-integrated) **and** ships tracker v4.
2. Apply the migration in the D1 Console:
   paste `analytics/worker/migrate-v6-events.sql` line-by-line.

The order is safe either way: the `/api/e` insert is wrapped so it no-ops until
the migration exists, and the page-view path never touches the new tables.
Phases 2–4 (the 6-tab dashboard, Studio instrumentation, cohorts) build on this
foundation per `PLAN.md`.
