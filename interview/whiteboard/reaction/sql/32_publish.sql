-- Publish three revisions of the second right after the six (media 125),
-- at 3, 10 and 30 seconds of wall time after it was first broadcast.
INSERT INTO mood_snapshot (match_id, region, media_sec, revision, published_at,
                           voices, is_partial, shares)
SELECT 1, 'ALL', 129, r.revision, r.as_of,
       COALESCE(sum(m.voices), 0)::int, false,
       COALESCE(jsonb_object_agg(m.emoji, m.share) FILTER (WHERE m.emoji IS NOT NULL), '{}')
FROM (VALUES (1, 3), (2, 10), (3, 30)) AS r0(revision, lag_s)
CROSS JOIN LATERAL (
    SELECT r0.revision,
           d.starts_at + make_interval(secs => 129 + r0.lag_s) AS as_of
    FROM dim_match d WHERE d.match_id = 1) AS r
LEFT JOIN LATERAL mood_as_of(1, 129, r.as_of) AS m ON true
GROUP BY r.revision, r.as_of;
