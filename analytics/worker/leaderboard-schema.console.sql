-- Comment-free copy of leaderboard-schema.sql for pasting into the Cloudflare
-- D1 dashboard Console (the Console flattens newlines, so inline "-- comments"
-- in the main file would comment out the rest of a statement). Safe to re-run.
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  public_alias TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  raw_percentage INTEGER NOT NULL,
  normalized_score REAL NOT NULL,
  first_attempt INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER,
  period_key TEXT NOT NULL,
  integrity_status TEXT NOT NULL DEFAULT 'valid',
  deletion_token_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_day TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_nonce ON leaderboard_entries(nonce);
CREATE INDEX IF NOT EXISTS idx_lb_rank ON leaderboard_entries(category, period_key, integrity_status, normalized_score DESC);
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce TEXT PRIMARY KEY,
  used_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  metric_date TEXT NOT NULL,
  category TEXT NOT NULL,
  test_id TEXT NOT NULL DEFAULT '',
  starts INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  score_sum INTEGER NOT NULL DEFAULT 0,
  score_count INTEGER NOT NULL DEFAULT 0,
  duration_sum INTEGER NOT NULL DEFAULT 0,
  valid INTEGER NOT NULL DEFAULT 0,
  invalid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, category, test_id)
);
