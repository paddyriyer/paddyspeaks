-- Server-side page load counter
-- Captures ALL traffic: incognito, ad-blocked, no-JS browsers
-- Run in D1 Console

CREATE TABLE IF NOT EXISTS server_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    country TEXT DEFAULT 'Unknown',
    city TEXT DEFAULT 'Unknown',
    as_org TEXT DEFAULT '',
    browser TEXT DEFAULT 'Other',
    os TEXT DEFAULT 'Other',
    device_type TEXT DEFAULT 'Desktop',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sh_created ON server_hits(created_at);
CREATE INDEX IF NOT EXISTS idx_sh_page ON server_hits(page);
