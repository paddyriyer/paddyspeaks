SET TIME ZONE 'UTC';
DROP TABLE IF EXISTS trips;
CREATE TABLE trips (
  trip_id          BIGINT PRIMARY KEY,
  driver_id        BIGINT NOT NULL,
  status           TEXT   NOT NULL CHECK (status IN ('completed','cancelled','no_show')),
  requested_at     TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  driver_earnings  NUMERIC(10,2)
);
INSERT INTO trips VALUES
 (101, 1, 'completed', '2026-09-01 08:00+00', '2026-09-01 08:20+00', 10.00),
 (102, 1, 'completed', '2026-09-01 09:00+00', '2026-09-01 09:25+00', 12.00),
 (103, 1, 'completed', '2026-09-01 10:00+00', '2026-09-01 10:30+00', 15.00),
 (104, 1, 'cancelled', '2026-09-01 11:00+00', NULL,                  NULL),
 (105, 1, 'completed', '2026-09-01 12:00+00', '2026-09-01 12:15+00', 14.00),
 (106, 1, 'completed', '2026-09-01 13:00+00', '2026-09-01 13:20+00', 16.00),
 (107, 1, 'completed', '2026-09-01 14:00+00', '2026-09-01 14:40+00', 20.00),
 (108, 1, 'completed', '2026-09-01 15:00+00', '2026-09-01 15:30+00', 25.00),
 (201, 2, 'completed', '2026-09-01 08:00+00', '2026-09-01 08:30+00', 20.00),
 (202, 2, 'completed', '2026-09-01 09:00+00', '2026-09-01 09:30+00', 20.00),
 (203, 2, 'completed', '2026-09-01 10:00+00', '2026-09-01 10:30+00', 21.00),
 (204, 2, 'no_show',   '2026-09-01 10:45+00', NULL,                  NULL),
 (205, 2, 'completed', '2026-09-01 11:00+00', '2026-09-01 11:30+00', 22.00),
 (301, 3, 'completed', '2026-09-01 08:00+00', '2026-09-01 08:10+00',  5.00),
 (302, 3, 'completed', '2026-09-01 09:00+00', '2026-09-01 09:10+00',  8.00),
 (401, 4, 'completed', '2026-09-01 08:00+00', '2026-09-01 08:30+00', 30.00),
 (402, 4, 'completed', '2026-09-01 09:00+00', '2026-09-01 09:30+00', 31.00),
 (403, 4, 'completed', '2026-09-01 10:00+00', '2026-09-01 10:30+00',  NULL),
 (405, 4, 'completed', '2026-09-01 11:00+00', '2026-09-01 11:30+00', 33.00),
 (404, 4, 'completed', '2026-09-01 11:05+00', '2026-09-01 11:30+00', 32.00),
 (406, 4, 'completed', '2026-09-01 12:00+00', '2026-09-01 12:30+00', 34.00);

-- @setup-end

-- reference solution
WITH completed AS (
  SELECT driver_id, trip_id, completed_at, driver_earnings,
         CASE WHEN driver_earnings > LAG(driver_earnings) OVER w THEN 0 ELSE 1 END AS starts_run
  FROM trips
  WHERE status = 'completed'
  WINDOW w AS (PARTITION BY driver_id ORDER BY completed_at, trip_id)
), runs AS (
  SELECT *, SUM(starts_run) OVER (PARTITION BY driver_id ORDER BY completed_at, trip_id
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run_id
  FROM completed
)
SELECT driver_id,
       (ARRAY_AGG(trip_id ORDER BY completed_at, trip_id))[1]                        AS first_trip_id,
       (ARRAY_AGG(trip_id ORDER BY completed_at DESC, trip_id DESC))[1]              AS last_trip_id,
       COUNT(*)                                                                       AS trips_in_run,
       MAX(driver_earnings) - MIN(driver_earnings)                                    AS earnings_gain
FROM runs
GROUP BY driver_id, run_id
HAVING COUNT(*) >= 3
ORDER BY driver_id, first_trip_id;
