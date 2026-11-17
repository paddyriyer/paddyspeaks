-- The settled mood, for analytics: every voice, however late it arrived.
CREATE VIEW mood_by_second AS
WITH grid AS (
    SELECT m.match_id, s.media_sec, e.emoji
    FROM dim_match m
    CROSS JOIN generate_series(0, 194) AS s(media_sec)
    CROSS JOIN unnest(ARRAY['fire','clap','pray','shock','sad','angry']) AS e(emoji)
), per_sec AS (
    SELECT match_id, media_sec, emoji, count(*) AS voices
    FROM reaction_voice
    GROUP BY 1, 2, 3
), windowed AS (
    -- the dense grid makes ROWS BETWEEN mean "seconds", not "rows that exist"
    SELECT g.match_id, g.media_sec, g.emoji,
           sum(COALESCE(p.voices, 0)) OVER (
               PARTITION BY g.match_id, g.emoji
               ORDER BY g.media_sec
               ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS voices_5s
    FROM grid g
    LEFT JOIN per_sec p USING (match_id, media_sec, emoji)
)
SELECT match_id, media_sec, emoji, voices_5s,
       round(voices_5s::numeric / NULLIF(sum(voices_5s) OVER w, 0), 3) AS share
FROM windowed
WINDOW w AS (PARTITION BY match_id, media_sec);
