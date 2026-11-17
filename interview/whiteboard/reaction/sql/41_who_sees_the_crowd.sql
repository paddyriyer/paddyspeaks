-- Who gets to see the crowd? A viewer D seconds behind live watches media
-- second 129 at starts_at + 129 + D. Shown with a 2-second hold-back, the mood
-- they can see is whatever had reached the edge by then. The viewers closest
-- to live can only ever see the reactions of viewers even closer: few or none.
WITH settled AS (
    SELECT count(*) AS voices
    FROM reaction_voice
    WHERE match_id = 1 AND media_sec BETWEEN 125 AND 129
), cohort AS (
    SELECT unnest(ARRAY[2, 5, 10, 20, 30]) AS behind_live_s
)
SELECT c.behind_live_s,
       count(v.session_id)                                       AS voices_visible,
       round(100.0 * count(v.session_id) / s.voices, 1)          AS pct_of_settled
FROM cohort c
CROSS JOIN settled s
CROSS JOIN dim_match m
LEFT JOIN reaction_voice v
       ON v.match_id = 1
      AND v.media_sec BETWEEN 125 AND 129
      AND v.edge_received_at <= m.starts_at
                                + make_interval(secs => 129 + c.behind_live_s + 2)
WHERE m.match_id = 1
GROUP BY c.behind_live_s, s.voices
ORDER BY c.behind_live_s;
