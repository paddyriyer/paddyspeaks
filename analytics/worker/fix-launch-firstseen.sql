-- PaddySpeaks Analytics — one-time correction of launch-week `first_seen` stamps.
--
-- Incident 2026-10-03 (see docs/INCIDENTS.md): the 2026-09-14 retention cohort
-- showed 1,166 visitors but only 93 were actually active in page_views that week
-- (~0% retention). When the events/visitors system went live that week it stamped
-- `first_seen = datetime('now')` (≈ launch date) onto a backlog of visitor ids.
-- The `visitors` roll-up backfill could not fix them: it only moves first_seen
-- EARLIER using page_views, and these ids either have no page_views at all
-- (events-only traffic, or a bot hitting /e/i) or their real first page view is
-- LATER than the launch stamp.
--
-- Source of truth = page_views, the same table retention activity is measured on.
--
-- Run ONCE, AFTER the D1 read quota has reset (step 1 reads page_views). Paste
-- into the D1 Console for paddyspeaks-analytics, or:
--   wrangler d1 execute paddyspeaks-analytics --remote --file=analytics/worker/fix-launch-firstseen.sql
-- Idempotent: re-running re-derives the same values and deletes nothing new.
-- A durable code guard (cohortWeeks() in analytics/lib/metrics.js) already stops
-- any such row from inflating a cohort even before this is run.

-- Step 1 — visitors we actually observed browsing: re-anchor first_seen to their
-- true earliest page view, overwriting the launch-day stamp even when the real
-- first view is LATER than it (a plain backfill cannot, so it is corrected here).
UPDATE visitors
SET first_seen = (
  SELECT MIN(created_at) FROM page_views
  WHERE page_views.visitor_id = visitors.anonymous_visitor_id
)
WHERE anonymous_visitor_id IN (SELECT visitor_id FROM page_views WHERE visitor_id != '');

-- Step 2 — roll-up rows with NO page view ever: not real browsing visitors
-- (events-only / bot hits on /e/i / launch-day stamps). They cannot be "retained"
-- under a page-based cohort and only inflate it; first_seen is NOT NULL so the
-- phantom row is removed rather than blanked. The event path re-creates a correct
-- row with an honest first_seen if the id is ever seen browsing again.
DELETE FROM visitors
WHERE anonymous_visitor_id NOT IN (SELECT visitor_id FROM page_views WHERE visitor_id != '');

-- Verify (expect the two counts to match now, ~93 not ~1166):
--   SELECT COUNT(*) AS cohort_from_visitors
--     FROM visitors WHERE first_seen >= '2026-09-14' AND first_seen < '2026-09-21';
--   SELECT COUNT(DISTINCT visitor_id) AS actually_active_that_week
--     FROM page_views WHERE created_at >= '2026-09-14' AND created_at < '2026-09-21';
