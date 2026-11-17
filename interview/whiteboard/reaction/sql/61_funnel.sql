-- Conservation: every batch that reached the edge is accounted for, and no
-- stage may report more than the stage before it.
SELECT stage, n FROM (
    SELECT 1 AS step, 'batches stored (after dedup)' AS stage, count(*) AS n FROM reaction_batch
    UNION ALL SELECT 2, '  rejected: throttled',       count(*) FROM reaction_batch WHERE admission = 'throttled'
    UNION ALL SELECT 3, '  rejected: unauthenticated', count(*) FROM reaction_batch WHERE admission = 'unauthenticated'
    UNION ALL SELECT 4, 'admitted',                    count(*) FROM reaction_batch WHERE admission = 'admitted'
    UNION ALL SELECT 5, 'voices (one per person-second)', count(*) FROM reaction_voice
    UNION ALL SELECT 6, '  excluded by integrity',     count(*) FROM reaction_voice v
                                                       JOIN session_integrity i USING (session_id)
                                                       WHERE i.excluded
    UNION ALL SELECT 7, 'voices counted',              count(*) FROM counted_voice
) f
ORDER BY step;
