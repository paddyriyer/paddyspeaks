CREATE TABLE IF NOT EXISTS testimonials (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL, role TEXT, organization TEXT, relationship TEXT NOT NULL, body TEXT NOT NULL, edited_body TEXT, verify_url TEXT, display_pref TEXT NOT NULL, display_name TEXT, status TEXT NOT NULL DEFAULT 'pending', featured INTEGER NOT NULL DEFAULT 0, ip_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status, featured, created_at DESC);
CREATE TABLE IF NOT EXISTS contact_log (id TEXT PRIMARY KEY, reason TEXT, ip_hash TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_contact_content ON contact_log(content_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_ip ON contact_log(ip_hash, created_at);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, window_start TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rl_expires ON rate_limits(expires_at);
