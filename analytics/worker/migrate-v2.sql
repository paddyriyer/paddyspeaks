-- PaddySpeaks Analytics — V2 Migration
-- Run in Cloudflare D1 Console: paste and execute

ALTER TABLE page_views ADD COLUMN visitor_id TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN is_new INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN viewport TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN utm_source TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN utm_medium TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN utm_campaign TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN dark_mode INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN timezone TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN duration INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN scroll_depth INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pv_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_pv_utm ON page_views(utm_source);
