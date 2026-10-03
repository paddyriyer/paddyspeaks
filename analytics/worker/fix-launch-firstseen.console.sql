UPDATE visitors SET first_seen = (SELECT MIN(created_at) FROM page_views WHERE page_views.visitor_id = visitors.anonymous_visitor_id) WHERE anonymous_visitor_id IN (SELECT visitor_id FROM page_views WHERE visitor_id != '');
DELETE FROM visitors WHERE anonymous_visitor_id NOT IN (SELECT visitor_id FROM page_views WHERE visitor_id != '');
SELECT COUNT(*) AS cohort_from_visitors FROM visitors WHERE first_seen >= '2026-09-14' AND first_seen < '2026-09-21';
SELECT COUNT(DISTINCT visitor_id) AS actually_active_that_week FROM page_views WHERE created_at >= '2026-09-14' AND created_at < '2026-09-21';
