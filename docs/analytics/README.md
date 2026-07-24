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

## What shipped in Phase 2 (decision dashboard) + Phase 3 start (Studio events)
- **6-tab dashboard** (`analytics/index.html`): Overview · Acquisition · Content ·
  Interview Studio · Journeys & Retention · Data Quality. Existing panels are
  preserved and assigned to tabs; new decision panels added on top. Verified in a
  headless-Chromium smoke test (KPIs, insights, funnel, source/content tables,
  tab switching all render).
- **Executive Summary KPIs** with previous-period Δ (percent + absolute),
  definition tooltips, small-sample warnings, and a sessions sparkline.
- **"What deserves attention?"** — deterministic, rule-based insights
  (`analytics/lib/insights.js`, pure + tested): observation → inference → action
  → priority → confidence. Never fires below the sample floor (no fabricated
  insights).
- **Acquisition** source-quality table with `high_volume_low_value` /
  `low_volume_high_value` classes; **Content** 2×2 (winner / hidden gem / click
  magnet / needs attention); **Interview Studio** learning funnel + per-track
  table + Learning Opportunities; **Data Quality** coverage/bot/internal/freshness.
- **Backend:** `GET /api/insights` computes engaged sessions, medians, correct
  session-grain new/returning, source & content classes, Studio funnels, and
  data quality — reusing the tested pure libs. Degrades gracefully (empty states)
  until `events` data flows.
- **Phase 3 instrumentation (started):** `psTrack()` wired into the Skill Check
  quiz engine (`quiz_started`, `answer_submitted`/`correct`/`incorrect`,
  `quiz_completed`, `code_run`, `track_selected`) and the track engine
  (`track_selected`, `question_completed`, `answer_*`, `search_performed`,
  `no_search_results`). Simulator/flashcards/study-plan surfaces remain to wire.

## Deploy order (important)
1. Merge the PR — this deploys the Worker (git-integrated) **and** ships tracker v4.
2. Apply the migration in the D1 Console:
   paste `analytics/worker/migrate-v6-events.sql` line-by-line.

The order is safe either way: the `/api/e` insert is wrapped so it no-ops until
the migration exists, and the page-view path never touches the new tables.
Phases 2–4 (the 6-tab dashboard, Studio instrumentation, cohorts) build on this
foundation per `PLAN.md`.
