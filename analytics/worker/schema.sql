-- PaddySpeaks Analytics — D1 Database Schema
-- Run this once: wrangler d1 execute paddyspeaks-analytics --file=schema.sql

CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    country TEXT DEFAULT 'Unknown',
    city TEXT DEFAULT 'Unknown',
    region TEXT DEFAULT 'Unknown',
    browser TEXT DEFAULT 'Other',
    os TEXT DEFAULT 'Other',
    device_type TEXT DEFAULT 'Desktop',
    screen TEXT DEFAULT '',
    language TEXT DEFAULT '',
    session_id TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_pv_country ON page_views(country);
CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id);
