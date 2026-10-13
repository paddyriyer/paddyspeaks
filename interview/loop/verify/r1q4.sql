SET TIME ZONE 'UTC';
DROP TABLE IF EXISTS app_events;
CREATE TABLE app_events (
  event_id     TEXT        NOT NULL,   -- producer-assigned; NOT unique in this table (at-least-once delivery)
  rider_id     BIGINT      NOT NULL,
  event_type   TEXT        NOT NULL,   -- app_open | search | price_view | trip_requested
  event_ts     TIMESTAMPTZ NOT NULL,   -- device clock, may be corrected on re-send
  ingested_at  TIMESTAMPTZ NOT NULL
);
INSERT INTO app_events VALUES
 ('e1', 7, 'app_open',       '2026-09-14 08:00:00+00', '2026-09-14 08:00:05+00'),
 ('e2', 7, 'search',         '2026-09-14 08:02:00+00', '2026-09-14 08:02:03+00'),
 ('e2', 7, 'search',         '2026-09-14 08:02:00+00', '2026-09-14 08:09:41+00'),
 ('e3', 7, 'price_view',     '2026-09-14 08:32:00+00', '2026-09-14 08:32:02+00'),
 ('e4', 7, 'trip_requested', '2026-09-14 09:10:00+00', '2026-09-14 09:10:01+00'),
 ('e5', 7, 'app_open',       '2026-09-14 23:50:00+00', '2026-09-14 23:50:02+00'),
 ('e6', 7, 'trip_requested', '2026-09-15 00:05:00+00', '2026-09-15 00:05:04+00'),
 ('e7', 9, 'app_open',       '2026-09-14 12:00:00+00', '2026-09-14 12:00:01+00'),
 ('e8', 9, 'search',         '2026-09-14 12:40:00+00', '2026-09-14 12:40:02+00'),
 ('e8', 9, 'search',         '2026-09-14 12:20:00+00', '2026-09-14 12:55:00+00'),
 ('e9', 9, 'price_view',     '2026-09-14 12:45:00+00', '2026-09-14 12:45:01+00');

-- @setup-end

-- Part A: sessions
CREATE TEMP VIEW sessions AS
WITH dedup AS (
  SELECT DISTINCT ON (event_id) event_id, rider_id, event_type, event_ts
  FROM app_events
  ORDER BY event_id, ingested_at DESC
), flagged AS (
  SELECT *,
         CASE WHEN event_ts - LAG(event_ts) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id)
                   <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS new_session
  FROM dedup
), numbered AS (
  SELECT *, SUM(new_session) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id
                                   ROWS UNBOUNDED PRECEDING) AS session_no
  FROM flagged
)
SELECT rider_id, session_no,
       MIN(event_ts) AS session_start, MAX(event_ts) AS session_end,
       COUNT(*) AS events,
       BOOL_OR(event_type = 'trip_requested') AS converted
FROM numbered
GROUP BY rider_id, session_no;

SELECT * FROM sessions ORDER BY rider_id, session_no;

-- Part B: daily conversion (session attributed to the UTC day it started)
SELECT (session_start AT TIME ZONE 'UTC')::date AS session_date,
       COUNT(*) AS sessions,
       COUNT(*) FILTER (WHERE converted) AS converted_sessions,
       ROUND(100.0 * COUNT(*) FILTER (WHERE converted) / COUNT(*), 1) AS conversion_pct
FROM sessions
GROUP BY 1 ORDER BY 1;
