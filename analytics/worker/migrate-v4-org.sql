-- V4 Migration: Add ASN/Organization columns
-- Run in D1 Console

ALTER TABLE page_views ADD COLUMN asn INTEGER DEFAULT 0;
ALTER TABLE page_views ADD COLUMN as_org TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pv_org ON page_views(as_org);
