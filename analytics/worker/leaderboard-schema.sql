-- ════════════════════════════════════════════════════════════════════
-- PaddySpeaks — Anonymous Leaderboard (Cloudflare D1)
-- SEPARATE database from analytics — deliberately NO PII crossover.
--
-- Provision (you run these; I can't touch your Cloudflare account):
--   wrangler d1 create paddyspeaks-leaderboard
--   # copy the database_id into wrangler.toml under [[d1_databases]] binding = "LB"
--   wrangler d1 execute paddyspeaks-leaderboard --file=leaderboard-schema.sql
--   wrangler secret put LB_SIGNING_KEY     # 32+ random bytes (HMAC key)
--
-- Privacy notes:
--   • No name/email/phone, no IP, no user-agent, no session id, no exact
--     timestamp (day bucket only), no submitted code.
--   • duration_s is stored for plausibility checks only and is never displayed
--     exactly on a small board (see k-anonymity suppression in leaderboard.js).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id                  TEXT PRIMARY KEY,        -- random uuid (crypto)
  public_alias        TEXT NOT NULL,           -- generated, e.g. "Query Falcon #238"
  category            TEXT NOT NULL,           -- 'sql' | 'python'
  difficulty          TEXT NOT NULL,           -- 'easy' | 'medium' | 'hard' | 'expert'
  raw_percentage      INTEGER NOT NULL,        -- 0..100 (client-graded — see integrity note)
  normalized_score    REAL NOT NULL,           -- server-computed ranking score
  first_attempt       INTEGER NOT NULL DEFAULT 0,
  duration_s          INTEGER,                 -- server-measured (submit − token issue); plausibility only
  period_key          TEXT NOT NULL,           -- reset bucket, e.g. '2026-W29' (week) / '2026-07' (month)
  integrity_status    TEXT NOT NULL DEFAULT 'valid',  -- valid | suspicious | rejected | under_review
  deletion_token_hash TEXT NOT NULL,           -- sha256(deletion token); token itself lives ONLY in the browser
  nonce               TEXT NOT NULL,           -- attempt-token nonce (single-use)
  created_day         TEXT NOT NULL,           -- 'YYYY-MM-DD' day bucket, NOT an exact timestamp
  expires_at          TEXT NOT NULL            -- retention horizon (default +12 months)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_nonce ON leaderboard_entries(nonce);
CREATE INDEX IF NOT EXISTS idx_lb_rank
  ON leaderboard_entries(category, period_key, integrity_status, normalized_score DESC);

-- Single-use nonce ledger (replay/duplicate protection). Short TTL, pruned by cron.
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce   TEXT PRIMARY KEY,
  used_at TEXT NOT NULL
);

-- Pre-aggregated, non-identifying usage metrics (kept longer — no individual rows).
CREATE TABLE IF NOT EXISTS daily_metrics (
  metric_date  TEXT NOT NULL,
  category     TEXT NOT NULL,
  test_id      TEXT NOT NULL DEFAULT '',
  starts       INTEGER NOT NULL DEFAULT 0,
  completions  INTEGER NOT NULL DEFAULT 0,
  score_sum    INTEGER NOT NULL DEFAULT 0,
  score_count  INTEGER NOT NULL DEFAULT 0,
  duration_sum INTEGER NOT NULL DEFAULT 0,
  valid        INTEGER NOT NULL DEFAULT 0,
  invalid      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, category, test_id)
);
