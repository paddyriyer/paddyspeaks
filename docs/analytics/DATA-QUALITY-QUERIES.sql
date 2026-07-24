-- PaddySpeaks Analytics — Data-Quality validation queries
-- Run in the D1 Console (paddyspeaks-analytics) or:
--   wrangler d1 execute paddyspeaks-analytics --command "<query>"
-- These power the Data Quality tab and let you verify the Phase 1 fixes.

-- ── 1. Engagement coverage: % of exits that recorded a duration (fix B/C) ──
-- Before the exit-UPDATE fix this trended toward 0 on mobile. Watch it rise.
SELECT
  ROUND(100.0 * SUM(CASE WHEN duration > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS duration_coverage_pct,
  ROUND(100.0 * SUM(CASE WHEN scroll_depth > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS scroll_coverage_pct,
  COUNT(*) AS page_views
FROM page_views
WHERE created_at >= datetime('now', '-7 day');

-- ── 2. new/returning invariant (fix A): returning visitors must be ≤ total ──
-- Correct source of truth = the visitors roll-up, NOT summed page-view flags.
SELECT
  (SELECT COUNT(*) FROM visitors) AS total_visitors,
  (SELECT COUNT(*) FROM visitors WHERE date(last_seen) > date(first_seen)) AS returning_visitors;
-- Assert: returning_visitors <= total_visitors. If not, investigate.

-- ── 3. Bot / suspected traffic rate (fix F) — kept visible, not deleted ──
SELECT bot_class, COUNT(*) AS events,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM events), 1) AS pct
FROM events GROUP BY bot_class ORDER BY events DESC;

-- ── 4. Internal traffic share (should be excluded from acquisition) ──
SELECT internal, COUNT(*) AS events FROM events GROUP BY internal;

-- ── 5. Duplicate-event rate: event_id collisions rejected by INSERT OR IGNORE ──
-- (events has PK event_id, so dupes never land; this confirms client uniqueness)
SELECT COUNT(*) AS total_events, COUNT(DISTINCT event_id) AS distinct_ids
FROM events WHERE occurred_at >= datetime('now', '-7 day');

-- ── 6. Unknown referrer rate ──
SELECT
  ROUND(100.0 * SUM(CASE WHEN referrer_domain = '' THEN 1 ELSE 0 END) / COUNT(*), 1) AS empty_referrer_pct
FROM events WHERE occurred_at >= datetime('now', '-7 day');

-- ── 7. Freshness: last event received + processing latency ──
SELECT MAX(occurred_at) AS last_event_at,
       CAST((julianday('now') - julianday(MAX(occurred_at))) * 24 * 60 AS INT) AS minutes_ago
FROM events;

-- ── 8. Referrer fragmentation BEFORE vs AFTER normalization (fix E) ──
-- Old (fragmented): distinct raw referrer strings. New: distinct domains.
SELECT
  (SELECT COUNT(DISTINCT referrer) FROM page_views WHERE referrer != '') AS raw_referrer_rows,
  (SELECT COUNT(DISTINCT referrer_domain) FROM events WHERE referrer_domain != '') AS normalized_domains;

-- ── 9. Path duplication check (fix I): same page under variant paths ──
SELECT LOWER(REPLACE(REPLACE(page, '/index.html', ''), '', '')) AS canon, COUNT(DISTINCT page) AS variants, SUM(1) AS views
FROM page_views WHERE created_at >= datetime('now', '-30 day')
GROUP BY canon HAVING variants > 1 ORDER BY views DESC LIMIT 20;

-- ── 10. Ingest errors log (failed submissions surfaced in Data Quality) ──
SELECT kind, COUNT(*) AS n, MAX(at) AS latest FROM ingest_errors
GROUP BY kind ORDER BY n DESC;

-- ── OPTIONAL one-time backfill: populate new page_views columns for history ──
-- Safe to run after migrate-v6. Derives normalized fields from existing data.
-- UPDATE page_views SET referrer_domain =
--   LOWER(REPLACE(REPLACE(SUBSTR(referrer, INSTR(referrer,'://')+3),
--   SUBSTR(referrer, INSTR(SUBSTR(referrer,'://')||'/','/')), ''), 'www.', ''))
--   WHERE referrer != '' AND referrer_domain = '';
-- (Prefer backfilling in code with classify.js normalizeReferrer for accuracy.)
