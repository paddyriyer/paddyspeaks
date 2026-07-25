-- ════════════════════════════════════════════════════════════════════
-- PaddySpeaks — Contact + Testimonials store (Cloudflare D1)
-- SEPARATE database from analytics — this one holds PII (names, emails),
-- so it is deliberately isolated from the PII-free analytics DB, exactly
-- like the leaderboard DB is isolated for the opposite reason.
--
-- Provision (you run these; I can't touch your Cloudflare account):
--   wrangler d1 create paddyspeaks-forms
--   # copy the database_id into wrangler.toml under [[d1_databases]] binding = "FORMS"
--   wrangler d1 execute paddyspeaks-forms --file=forms-schema.sql
--   # (or paste forms-schema.console.sql into the D1 Console in the dashboard)
--
-- Privacy notes:
--   • Contact messages are NEVER stored — they are emailed and discarded.
--     contact_log keeps only non-identifying rows (reason + salted hashes)
--     for rate-limiting and duplicate-click suppression.
--   • Testimonial emails are stored (needed to reply / verify) but are NEVER
--     returned by the public API and NEVER displayed.
-- ════════════════════════════════════════════════════════════════════

-- ── Testimonials (moderated; only 'approved' rows are ever public) ──
CREATE TABLE IF NOT EXISTS testimonials (
  id            TEXT PRIMARY KEY,             -- random uuid (crypto)
  full_name     TEXT NOT NULL,               -- private unless display_pref='full'
  email         TEXT NOT NULL,               -- ALWAYS private, never returned publicly
  role          TEXT,                        -- optional professional title
  organization  TEXT,                        -- optional
  relationship  TEXT NOT NULL,               -- reader | studio_user | collaborator | attendee | community | other
  body          TEXT NOT NULL,               -- as-submitted (60..700 chars)
  edited_body   TEXT,                        -- owner's light edit; published in preference to body
  verify_url    TEXT,                        -- optional LinkedIn/profile URL — private verification only
  display_pref  TEXT NOT NULL,               -- full | first_initial | anonymous
  display_name  TEXT,                        -- owner override; else derived from full_name + display_pref
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  featured      INTEGER NOT NULL DEFAULT 0,  -- 1 = eligible for the homepage strip
  ip_hash       TEXT,                        -- salted hash, abuse triage only (never an IP)
  created_at    TEXT NOT NULL,               -- ISO timestamp
  updated_at    TEXT NOT NULL                -- ISO timestamp (moderation actions bump this)
);
CREATE INDEX IF NOT EXISTS idx_testimonials_status
  ON testimonials(status, featured, created_at DESC);

-- ── Contact log: NON-identifying. No name, email, subject, or message body. ──
-- Exists only to power rate-limiting and duplicate-submission suppression.
CREATE TABLE IF NOT EXISTS contact_log (
  id            TEXT PRIMARY KEY,
  reason        TEXT,                        -- the dropdown category only (no free text)
  ip_hash       TEXT NOT NULL,               -- salted one-way hash
  content_hash  TEXT NOT NULL,               -- salted hash of (ip+subject+message) for dedup
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_content ON contact_log(content_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_ip ON contact_log(ip_hash, created_at);

-- ── Fixed-window rate-limit counters (shared by both forms) ──
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT PRIMARY KEY,            -- sha256(salt + ip + endpoint + windowStart)
  hits          INTEGER NOT NULL DEFAULT 0,
  window_start  TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rl_expires ON rate_limits(expires_at);
