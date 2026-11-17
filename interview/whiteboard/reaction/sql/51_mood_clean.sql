-- The angry minute: media 60-119, a quiet passage of play. Raw versus cleaned.
-- Then a contribution cap: no network may exceed 1.5x its OWN normal share of
-- voices in any window. (A flat cap would punish the two ISPs that carry most
-- of a country; "normal" is measured, not assumed.)
WITH clean AS (
    SELECT r.*
    FROM reaction_voice r
    JOIN session_integrity i USING (session_id)
    WHERE r.match_id = 1 AND NOT i.excluded
), baseline AS (                         -- each network's share across the match
    SELECT asn, count(*)::numeric / sum(count(*)) OVER () AS normal_share
    FROM clean GROUP BY asn
), win AS (
    SELECT * FROM clean WHERE media_sec BETWEEN 60 AND 119
), weighted AS (
    SELECT w.emoji,
           LEAST(1.0, 1.5 * b.normal_share * (SELECT count(*) FROM win)
                      / count(*) OVER (PARTITION BY w.asn))  AS weight
    FROM win w JOIN baseline b USING (asn)
)
SELECT 'raw' AS view, emoji,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM reaction_voice
WHERE match_id = 1 AND media_sec BETWEEN 60 AND 119
GROUP BY emoji
UNION ALL
SELECT 'cleaned + capped', emoji,
       round(100.0 * sum(weight) / sum(sum(weight)) OVER (), 1)
FROM weighted GROUP BY emoji
ORDER BY view DESC, pct DESC;
