-- The SLO, measured where the promise lives: in each viewer's own timeline.
-- lag = how far the player had moved past the end of the second the mood
-- describes. Negative lag = the mood described a moment the viewer had not
-- seen yet: a spoiler. That count must be zero, whatever the percentiles say.
WITH r AS (
    SELECT player_media_ms - (snapshot_media_sec + 1) * 1000 AS lag_ms
    FROM render_receipt
    WHERE match_id = 1
)
SELECT count(*)                                                    AS receipts,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY lag_ms)::int    AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY lag_ms)::int    AS p95_ms,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY lag_ms)::int    AS p99_ms,
       round(100.0 * avg((lag_ms BETWEEN 0 AND 2000)::int), 2)      AS pct_within_2s,
       count(*) FILTER (WHERE lag_ms < 0)                           AS spoilers
FROM r;
