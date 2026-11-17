-- How did the crowd answer each ball? Voices in the ten media seconds after
-- it was bowled — a range join on the media clock, never on wall time.
SELECT d.over_no || '.' || d.ball_no              AS ball,
       d.outcome,
       count(v.session_id)                         AS voices,
       mode() WITHIN GROUP (ORDER BY v.emoji)      AS top_emoji,
       round(avg(v.intensity), 1)                  AS avg_intensity
FROM dim_delivery d
LEFT JOIN counted_voice v
       ON v.match_id = d.match_id
      AND v.media_sec BETWEEN d.media_sec AND d.media_sec + 9
GROUP BY d.over_no, d.ball_no, d.outcome
ORDER BY d.over_no, d.ball_no;
