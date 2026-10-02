INSERT INTO visitors (anonymous_visitor_id, first_seen, last_seen, sessions)
SELECT visitor_id, MIN(created_at), MAX(created_at), COUNT(DISTINCT session_id)
FROM page_views
WHERE visitor_id != ''
GROUP BY visitor_id
ON CONFLICT(anonymous_visitor_id) DO UPDATE SET
  first_seen = MIN(visitors.first_seen, excluded.first_seen),
  last_seen  = MAX(visitors.last_seen,  excluded.last_seen);
CREATE INDEX IF NOT EXISTS idx_vis_last ON visitors(last_seen);
