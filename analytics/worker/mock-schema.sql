-- AI Mock Interview — rate-limit counter (NS-2)
-- Applied to the ANALYTICS D1 (binding `DB`, database paddyspeaks-analytics):
--   wrangler d1 execute paddyspeaks-analytics --file=analytics/worker/mock-schema.sql
-- Stores only an anonymised, daily-rotating IP hash + a per-day count. No PII,
-- no answers, no transcripts. The route fails OPEN if this table is absent, so
-- the tool still works before you run this — the daily cap just isn't enforced.

CREATE TABLE IF NOT EXISTS mock_usage (
  ip_hash TEXT NOT NULL,
  day     TEXT NOT NULL,           -- UTC YYYY-MM-DD
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);

-- Housekeeping: purge counters older than a few days (run occasionally, or via cron).
-- DELETE FROM mock_usage WHERE day < date('now', '-3 day');
