-- V5 Migration: page count, search query, 404 detection, load time
-- Run each line separately in D1 Console

ALTER TABLE page_views ADD COLUMN page_num INTEGER DEFAULT 1;
ALTER TABLE page_views ADD COLUMN search_query TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN is_404 INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN load_time INTEGER DEFAULT 0;
