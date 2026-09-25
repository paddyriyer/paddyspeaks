-- Estimate sessions for the analytics outage of 2026-09-24/25.
--
-- WHAT HAPPENED: from 1a564d2 (deployed ~14:33 UTC 2026-09-24) until #861
-- (~18:15 UTC 2026-09-25) the Worker refused the credentialed CORS preflight
-- that navigator.sendBeacon needs, so no JS page views — and therefore no
-- sessions — were recorded. The no-JS pixel (server_hits) kept counting page
-- loads throughout, but it carries no session or visitor id.
--
-- METHOD: calibrate on the 14 days before the gap, when both sources were
-- healthy. "sessions per pixel hit" absorbs everything that differs between
-- the two (pages per session, ad-blockers, GPC, bots the pixel's filter
-- misses), so it is a better multiplier than raw pages-per-session.
-- Both are reported; the first is the recommended estimate.
--
-- CAVEATS: an ESTIMATE, not data. The pixel has no visitor id, so excluded
-- visitors (your own visits) cannot be removed from it; calibration therefore
-- uses unfiltered page_views too, to stay like-for-like. Never write these
-- numbers back into page_views.
--
-- Run in the D1 console for paddyspeaks-analytics (read-only).
-- Adjust the three timestamps if the deploy times differ (UTC, SQLite format).

WITH params AS (
  SELECT '2026-09-24 14:33:00' AS gap_start,
         '2026-09-25 18:15:00' AS gap_end,
         '2026-09-10 14:33:00' AS base_start      -- 14 days before the gap
),
base_js AS (
  SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS page_views
  FROM page_views, params
  WHERE created_at >= base_start AND created_at < gap_start AND session_id <> ''
),
base_px AS (
  SELECT COUNT(*) AS pixel_hits
  FROM server_hits, params
  WHERE created_at >= base_start AND created_at < gap_start
),
ratios AS (
  SELECT CAST(base_js.sessions AS REAL) / NULLIF(base_px.pixel_hits, 0) AS sessions_per_hit,
         CAST(base_js.page_views AS REAL) / NULLIF(base_js.sessions, 0) AS pages_per_session,
         base_js.sessions AS base_sessions, base_px.pixel_hits AS base_pixel_hits
  FROM base_js, base_px
),
gap_px AS (          -- pixel page loads inside the gap, per UTC day
  SELECT date(created_at) AS day, COUNT(*) AS pixel_hits
  FROM server_hits, params
  WHERE created_at >= gap_start AND created_at < gap_end
  GROUP BY day
),
gap_js AS (          -- whatever JS sessions still got through (should be ~0)
  SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS sessions
  FROM page_views, params
  WHERE created_at >= gap_start AND created_at < gap_end AND session_id <> ''
  GROUP BY day
),
outside_js AS (      -- real sessions on the gap days but outside the gap
  SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS sessions
  FROM page_views, params
  WHERE date(created_at) IN (SELECT day FROM gap_px)
    AND (created_at < gap_start OR created_at >= gap_end) AND session_id <> ''
  GROUP BY day
)
SELECT
  gap_px.day,
  gap_px.pixel_hits                                              AS pixel_hits_in_gap,
  COALESCE(gap_js.sessions, 0)                                   AS recorded_sessions_in_gap,
  ROUND(gap_px.pixel_hits * ratios.sessions_per_hit)             AS est_sessions_in_gap,          -- recommended
  ROUND(gap_px.pixel_hits / ratios.pages_per_session)            AS est_sessions_in_gap_alt,      -- pages-per-session method
  COALESCE(outside_js.sessions, 0)                               AS real_sessions_outside_gap,
  COALESCE(outside_js.sessions, 0)
    + ROUND(gap_px.pixel_hits * ratios.sessions_per_hit)         AS est_total_sessions_for_day,
  ROUND(ratios.sessions_per_hit, 3)                              AS calib_sessions_per_hit,
  ROUND(ratios.pages_per_session, 2)                             AS calib_pages_per_session,
  ratios.base_sessions                                           AS calib_base_sessions,
  ratios.base_pixel_hits                                         AS calib_base_pixel_hits
FROM gap_px
CROSS JOIN ratios
LEFT JOIN gap_js     ON gap_js.day = gap_px.day
LEFT JOIN outside_js ON outside_js.day = gap_px.day
ORDER BY gap_px.day;
