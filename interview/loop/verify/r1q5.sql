DROP TABLE IF EXISTS trip_status_events;
CREATE TABLE trip_status_events (
  trip_id   BIGINT NOT NULL,
  city_id   INT    NOT NULL,
  status    TEXT   NOT NULL,
  event_ts  TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (event_ts);
CREATE TABLE tse_2026_08 PARTITION OF trip_status_events FOR VALUES FROM ('2026-08-01+00') TO ('2026-09-01+00');
CREATE TABLE tse_2026_09 PARTITION OF trip_status_events FOR VALUES FROM ('2026-09-01+00') TO ('2026-10-01+00');
CREATE TABLE tse_2026_10 PARTITION OF trip_status_events FOR VALUES FROM ('2026-10-01+00') TO ('2026-11-01+00');
INSERT INTO trip_status_events VALUES
 (1, 10, 'requested', '2026-09-14 08:00+00'), (1, 10, 'completed', '2026-09-14 08:30+00'),
 (2, 10, 'requested', '2026-09-14 09:00+00'), (2, 10, 'completed', '2026-09-14 09:30+00'), (2, 10, 'refunded', '2026-09-15 10:00+00'),
 (3, 20, 'requested', '2026-09-13 23:50+00'), (3, 20, 'completed', '2026-09-14 00:20+00'),
 (4, 20, 'requested', '2026-09-14 10:00+00'), (4, 20, 'completed', '2026-09-14 10:30+00'), (4, 20, 'completed', '2026-09-14 10:30+00'),
 (5, 10, 'requested', '2026-09-14 11:00+00'), (5, 10, 'cancelled', '2026-09-14 11:05+00');
CREATE INDEX ON trip_status_events (trip_id, event_ts);
ANALYZE trip_status_events;
SET TIME ZONE 'UTC';

-- @setup-end
\echo '--- original'
SELECT e.city_id, count(*) AS completed_trips
FROM trip_status_events e
WHERE date_trunc('day', e.event_ts AT TIME ZONE 'UTC') = DATE '2026-09-14'
  AND e.status = 'completed'
  AND e.event_ts = (SELECT max(e2.event_ts) FROM trip_status_events e2 WHERE e2.trip_id = e.trip_id)
GROUP BY e.city_id ORDER BY 1;
EXPLAIN (COSTS OFF)
SELECT e.city_id, count(*) FROM trip_status_events e
WHERE date_trunc('day', e.event_ts AT TIME ZONE 'UTC') = DATE '2026-09-14' AND e.status = 'completed'
  AND e.event_ts = (SELECT max(e2.event_ts) FROM trip_status_events e2 WHERE e2.trip_id = e.trip_id)
GROUP BY e.city_id;
\echo '--- rewrite'
SELECT city_id, count(*) AS completed_trips
FROM (
  SELECT DISTINCT ON (e.trip_id) e.trip_id, e.city_id, e.status
  FROM trip_status_events e
  WHERE e.event_ts >= TIMESTAMPTZ '2026-09-14 00:00+00'
    AND e.event_ts <  TIMESTAMPTZ '2026-09-15 00:00+00'
  ORDER BY e.trip_id, e.event_ts DESC
) last_on_day
WHERE status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM trip_status_events later
                  WHERE later.trip_id = last_on_day.trip_id
                    AND later.event_ts >= TIMESTAMPTZ '2026-09-15 00:00+00')
GROUP BY city_id ORDER BY 1;
EXPLAIN (COSTS OFF)
SELECT city_id, count(*) FROM (
  SELECT DISTINCT ON (e.trip_id) e.trip_id, e.city_id, e.status FROM trip_status_events e
  WHERE e.event_ts >= TIMESTAMPTZ '2026-09-14 00:00+00' AND e.event_ts < TIMESTAMPTZ '2026-09-15 00:00+00'
  ORDER BY e.trip_id, e.event_ts DESC) l
WHERE status = 'completed' AND NOT EXISTS (SELECT 1 FROM trip_status_events later
  WHERE later.trip_id = l.trip_id AND later.event_ts >= TIMESTAMPTZ '2026-09-15 00:00+00')
GROUP BY city_id;
