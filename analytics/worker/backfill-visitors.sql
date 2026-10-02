-- PaddySpeaks Analytics — backfill the `visitors` roll-up from page_views history.
--
-- Why: /api/insights and /api/journeys used to full-scan page_views to derive
-- each visitor's first-seen date on every dashboard load, which burned the D1
-- daily rows-read quota (incident 2026-10-02). Those queries now read the
-- `visitors` table (one indexed row per visitor) instead. `visitors` is already
-- maintained going forward by the event path, but visitors from BEFORE the
-- event schema existed are missing — this one-time backfill fills them in.
--
-- Run ONCE, AFTER the D1 read quota has reset (it does a single full scan of
-- page_views, which needs read budget). Paste into the D1 Console for
-- paddyspeaks-analytics, or:
--   wrangler d1 execute paddyspeaks-analytics --remote --file=analytics/worker/backfill-visitors.sql
-- Safe to re-run: it only ever moves first_seen earlier / last_seen later.

INSERT INTO visitors (anonymous_visitor_id, first_seen, last_seen, sessions)
SELECT visitor_id, MIN(created_at), MAX(created_at), COUNT(DISTINCT session_id)
FROM page_views
WHERE visitor_id != ''
GROUP BY visitor_id
ON CONFLICT(anonymous_visitor_id) DO UPDATE SET
  first_seen = MIN(visitors.first_seen, excluded.first_seen),
  last_seen  = MAX(visitors.last_seen,  excluded.last_seen);

-- Index for the insights "active visitors in range" lookup (WHERE last_seen >= ?).
CREATE INDEX IF NOT EXISTS idx_vis_last ON visitors(last_seen);
