-- The hot partition, measured. Same batches, two candidate keys, 64 partitions.
-- Keyed by match, one partition takes everything; keyed by session, load spreads.
WITH k AS (
    SELECT abs(hashtext(match_id::text))   % 64 AS by_match,
           abs(hashtext(session_id::text)) % 64 AS by_session
    FROM reaction_batch
), load AS (
    SELECT 'match_id' AS key, by_match AS p, count(*) AS n FROM k GROUP BY by_match
    UNION ALL
    SELECT 'session_id', by_session, count(*) FROM k GROUP BY by_session
)
SELECT key,
       count(*)                                  AS partitions_used,
       max(n)                                    AS hottest,
       round(max(n) / (sum(n) / 64.0), 1)        AS hottest_vs_fair_share
FROM load
GROUP BY key
ORDER BY key;
