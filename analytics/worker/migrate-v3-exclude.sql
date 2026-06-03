-- Excluded visitors table
-- Run in D1 Console

CREATE TABLE IF NOT EXISTS excluded_visitors (
    visitor_id TEXT PRIMARY KEY,
    label TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
