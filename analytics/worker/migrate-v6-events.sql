-- PaddySpeaks Analytics — V6 Migration (event schema + data-quality columns)
-- ADDITIVE ONLY. Preserves every existing page_views row.
-- Apply in the D1 Console line-by-line (the console flattens newlines).

-- 1) Versioned event table (envelope + properties JSON). page_views stays as-is.
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,                 -- client uuid, idempotency/dedupe
  event_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  anonymous_visitor_id TEXT DEFAULT '',
  session_id TEXT DEFAULT '',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  client_ts TEXT DEFAULT '',
  page_path TEXT DEFAULT '',
  page_title TEXT DEFAULT '',
  content_group TEXT DEFAULT '',
  referrer_domain TEXT DEFAULT '',
  referrer_path TEXT DEFAULT '',
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  utm_term TEXT DEFAULT '',
  utm_content TEXT DEFAULT '',
  device_category TEXT DEFAULT '',
  browser TEXT DEFAULT '',
  operating_system TEXT DEFAULT '',
  locale TEXT DEFAULT '',
  timezone TEXT DEFAULT '',
  country TEXT DEFAULT 'Unknown',
  city TEXT DEFAULT 'Unknown',
  viewport TEXT DEFAULT '',
  properties TEXT DEFAULT '{}',
  collection_status TEXT DEFAULT 'full',
  bot_class TEXT DEFAULT 'human',            -- human | suspected | bot (never dropped)
  internal INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ev_occurred ON events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ev_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_ev_visitor ON events(anonymous_visitor_id);
CREATE INDEX IF NOT EXISTS idx_ev_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_ev_group ON events(content_group);
CREATE INDEX IF NOT EXISTS idx_ev_bot ON events(bot_class);

-- 2) Visitor roll-up for correct new/returning + retention cohorts (fix A).
CREATE TABLE IF NOT EXISTS visitors (
  anonymous_visitor_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  sessions INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_vis_first ON visitors(first_seen);

-- 3) Data-quality / classification columns on the existing table (additive).
ALTER TABLE page_views ADD COLUMN referrer_domain TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN referrer_path TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN content_group TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN active_ms INTEGER DEFAULT 0;   -- active (visible+focused) time
ALTER TABLE page_views ADD COLUMN bot_class TEXT DEFAULT 'human';
ALTER TABLE page_views ADD COLUMN internal INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN engaged INTEGER DEFAULT 0;

-- 4) Diagnostic view: suspected/bot traffic kept VISIBLE, not destroyed (brief).
CREATE VIEW IF NOT EXISTS bot_events AS
  SELECT * FROM events WHERE bot_class IN ('suspected', 'bot');

-- 5) Ingest failure log (for the Data Quality tab's "failed submissions").
CREATE TABLE IF NOT EXISTS ingest_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT DEFAULT '',
  detail TEXT DEFAULT ''
);
