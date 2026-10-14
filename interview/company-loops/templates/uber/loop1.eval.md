# Uber · Loop 1 — evaluator notes (hidden from candidates)

## UBR-L1-01

**Reference solution** (PostgreSQL; `{{b1_s}}`, `{{b2_s}}` and the bucket labels are the instance's values)

```sql reference
WITH per_req AS (
  SELECT r.request_id, r.city,
         MIN(e.event_ts) FILTER (WHERE e.event_type = 'MATCHED')              AS first_match,
         COUNT(DISTINCT e.driver_id) FILTER (WHERE e.event_type = 'MATCHED')  AS drivers,
         COALESCE(BOOL_OR(e.event_type = 'PICKED_UP'), false)                 AS picked_up
  FROM trip_requests r
  JOIN dispatch_events e ON e.request_id = r.request_id
  GROUP BY r.request_id, r.city
), last_cancel AS (
  SELECT DISTINCT ON (request_id) request_id, party, event_ts
  FROM dispatch_events
  WHERE event_type = 'CANCELLED'
  ORDER BY request_id, event_ts DESC, event_id DESC
), lost AS (
  SELECT p.city, c.party,
         EXTRACT(EPOCH FROM c.event_ts - p.first_match)::bigint AS wait_s,
         p.drivers >= 2                                          AS rematched
  FROM per_req p
  JOIN last_cancel c ON c.request_id = p.request_id
  WHERE p.first_match IS NOT NULL
    AND NOT p.picked_up
), bucketed AS (
  SELECT l.*,
         CASE WHEN wait_s < {{b1_s}} THEN 1
              WHEN wait_s < {{b2_s}} THEN 2
              ELSE 3 END AS bucket_no
  FROM lost l
)
SELECT city,
       party AS cancelled_by,
       CASE bucket_no WHEN 1 THEN '{{bucket_a}}' WHEN 2 THEN '{{bucket_b}}' ELSE '{{bucket_c}}' END AS wait_bucket,
       COUNT(*)                            AS lost_requests,
       COUNT(*) FILTER (WHERE rematched)   AS rematched_requests,
       MAX(wait_s)                         AS max_wait_s
FROM bucketed
GROUP BY city, party, bucket_no
ORDER BY city, cancelled_by, bucket_no;
```

**Explanation.** Everything hinges on the grain. First reduce the events to one row per request: the first match time (`MIN … FILTER (WHERE event_type = 'MATCHED')`), the number of distinct drivers matched, and whether the rider was ever picked up. Separately, `DISTINCT ON` with `event_ts DESC, event_id DESC` picks each request's last cancellation, which decides the party. The inner join between the two keeps only requests that were cancelled; the `WHERE` keeps those that were matched and never picked up, which removes both cancellations before a match and driver cancellations that were rescued by a re-match. The wait is measured from the first match, so a re-match does not reset the rider's clock. The bucket is a number for grouping and ordering, and the label is derived from it, so `'10m+'` can never sort before `'2-5m'`.

**Complexity.** One aggregate pass and one sort for `DISTINCT ON`, both by request: O(n log n) over events. At marketplace scale both steps are local to a request, so partitioning events by request (or by request date with a small spill-over) keeps it a single shuffle.

**Dialect notes** (described, not executed). BigQuery: no `DISTINCT ON`; use `QUALIFY ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY event_ts DESC, event_id DESC) = 1`, `COUNTIF`, `MIN(IF(event_type = 'MATCHED', event_ts, NULL))`, `LOGICAL_OR`, and `TIMESTAMP_DIFF(…, SECOND)`. Snowflake: `QUALIFY`, `COUNT_IF`, `BOOLOR_AGG`, `DATEDIFF('second', …)`; `COUNT(DISTINCT IFF(event_type = 'MATCHED', driver_id, NULL))`. Spark SQL: `max_by(party, struct(event_ts, event_id))` picks the last cancellation in one aggregate; `count(DISTINCT CASE …)`. MySQL 8: no `FILTER` or `DISTINCT ON`; use `CASE` inside aggregates and `ROW_NUMBER()` in a CTE, `TIMESTAMPDIFF(SECOND, …)`.

**Edge cases built into the data.** Waits of exactly {{b1_s}} and {{b2_s}} seconds; requests cancelled before any match; driver cancellations rescued by a re-match and completed; lost trips with a re-match. Hard: `system` cancellations after a driver cancelled and nobody accepted; riders cancelling while dispatch was re-matching; a driver and a rider cancellation in the same second (the higher `event_id` is last). Very Hard: late uploads, so `event_id` order differs from time order (one request's last cancellation was ingested before an earlier one); a `MATCHED` row and a `CANCELLED` row duplicated by client retries.

**Common mistakes.** Counting events instead of requests; measuring from the latest match; including cancellations before a match or rescued driver cancellations; ordering by `event_id` alone; counting re-matches from `MATCHED` rows instead of distinct drivers; `<=` at a bucket edge; ordering by the label text; an `INNER JOIN` that is fine here but a `LEFT JOIN` that leaves pre-match cancellations with a NULL wait in some bucket.

**Follow-up guidance.** (1) A rider-cancellation rate divides by matched requests (every matched rider could cancel); a driver-cancellation rate is best per match (every match is a chance for that driver), so a re-matched request contributes several driver denominators. (2) Classify each lost trip by whether its last cancellation fell within the grace period from the match that was current then (or from the first match, stated explicitly); one bucket per request still. (3) Key the daily table by request and recompute any request touched by a late event (a merge on request_id); declare a day final after a lateness bound, and publish restatements with a version. (4) Partition by event date and cluster by request; a request spanning midnight needs its events from both days, so compute from a two-day read or partition by request date instead of event date.

**Rubric anchors.** 2: right shape but events counted instead of requests, or the clock reset on re-match. 3: matches the expected result. 4: also gives the right rate denominators and a credible late-data design.

**Strong signals.** States the grain ("one row per request") before writing SQL; asks whether a re-match resets the wait; orders buckets by rank. **Red flags.** `COUNT(*)` over joined events; treating `event_id` as time.

## UBR-L1-02

**Reference solution** (PostgreSQL; `{{from_ts}}`, `{{to_ts}}` are the window and `{{cap_s}}` the staleness cap in seconds, a week below Very Hard, so it never binds)

```sql reference
WITH spans AS (
  SELECT d.city, s.driver_id, s.status, s.changed_at AS started,
         LEAST(COALESCE(LEAD(s.changed_at) OVER (PARTITION BY s.driver_id ORDER BY s.changed_at, s.event_id),
                        TIMESTAMPTZ '{{to_ts}}'),
               s.changed_at + make_interval(secs => {{cap_s}})) AS ended
  FROM driver_status s
  JOIN drivers d ON d.driver_id = s.driver_id
), online AS (
  SELECT city, driver_id, status,
         GREATEST(started, TIMESTAMPTZ '{{from_ts}}') AS a,
         LEAST(ended, TIMESTAMPTZ '{{to_ts}}')        AS b
  FROM spans
  WHERE status IN ('OPEN', 'EN_ROUTE', 'ON_TRIP')
), hours AS (
  SELECT h FROM generate_series(TIMESTAMPTZ '{{from_ts}}', TIMESTAMPTZ '{{to_ts}}' - INTERVAL '1 hour', INTERVAL '1 hour') AS g(h)
), pieces AS (
  SELECT o.city, h.h AS hour_start, o.driver_id, o.status,
         EXTRACT(EPOCH FROM LEAST(o.b, h.h + INTERVAL '1 hour') - GREATEST(o.a, h.h)) AS secs
  FROM online o
  JOIN hours h ON o.a < h.h + INTERVAL '1 hour' AND o.b > h.h
  WHERE o.a < o.b
), per_hour AS (
  SELECT city, hour_start,
         COUNT(DISTINCT driver_id)                                  AS drivers,
         COALESCE(SUM(secs) FILTER (WHERE status = 'OPEN'), 0)      AS open_s,
         COALESCE(SUM(secs) FILTER (WHERE status = 'EN_ROUTE'), 0)  AS en_route_s,
         COALESCE(SUM(secs) FILTER (WHERE status = 'ON_TRIP'), 0)   AS on_trip_s
  FROM pieces
  GROUP BY city, hour_start
)
SELECT city, hour_start, drivers,
       ROUND(open_s / 60.0, 2)     AS open_min,
       ROUND(en_route_s / 60.0, 2) AS en_route_min,
       ROUND(on_trip_s / 60.0, 2)  AS on_trip_min,
       ROUND(on_trip_s / (open_s + en_route_s + on_trip_s), 4) AS utilisation
FROM per_hour
ORDER BY city, hour_start;
```

**Explanation.** A change table becomes spans with `LEAD` over the driver's rows in `(changed_at, event_id)` order; the last row has no successor, so it runs to the window end (and, at Very Hard, no longer than the cap after its own row). Rows from before the window are kept on purpose: the last of them is the status in effect when the window opens, and clipping with `GREATEST`/`LEAST` turns it into the window's first minutes. Rows after the window produce spans that clip to nothing. The hour split is an interval join between each clipped span and the window's hours from `generate_series`, keeping `LEAST(end, hour end) − GREATEST(start, hour start)`. Seconds are summed per status with `FILTER`, and only the final columns are divided and rounded.

**Complexity.** One sort by driver for the window function, then a join whose output is about (spans × hours each span touches), which is close to the number of spans: O(n log n). The `WHERE o.a < o.b` filter matters: without it, spans clipped to nothing still satisfy the overlap test and produce negative seconds.

**Dialect notes** (described, not executed). BigQuery: `GENERATE_TIMESTAMP_ARRAY(from, to, INTERVAL 1 HOUR)` with `UNNEST`; `TIMESTAMP_DIFF(…, SECOND)`; `COUNTIF`/`SUM(IF(…))`; `TIMESTAMP_ADD(changed_at, INTERVAL cap SECOND)`. Snowflake: a generator or calendar table for hours, `DATEDIFF('second', …)`, `DATEADD`, `IFF`. Spark SQL: `sequence(from, to, interval 1 hour)` + `explode`, `unix_timestamp` differences. MySQL 8: a recursive CTE for the hours, `TIMESTAMPDIFF(SECOND, …)`, `SUM(CASE …)`.

**Edge cases built into the data.** Statuses crossing hour boundaries; a change exactly on an hour boundary (no sliver on the other side). Hard: drivers online before the window opens; drivers still online when it closes, one of them with no later row at all; `OFFLINE` rows after the window; two rows of one driver in the same second (the lower `event_id` lasts zero seconds). Very Hard: repeated same-status rows while the app runs, silences longer than the cap whose remainder must not count, and late uploads so `event_id` is not time order.

**Common mistakes.** Crediting a whole span to the hour it started; filtering `changed_at` to the window and so losing the status in effect at the start; giving the last status no duration, or extending it past the window; ordering by `changed_at` alone; counting status rows as drivers; rounding minutes before computing utilisation; dividing by all time including `OFFLINE`; ignoring the cap at Very Hard.

**Follow-up guidance.** (1) Utilisation alone does not show oversupply: look at request wait times (ETAs), unfulfilled requests, `EN_ROUTE` share (long pickups), and earnings per online hour; a city with short trips and long pickups can show low utilisation and still be undersupplied. (2) Decide a product-neutral definition (online if online for any product) and attribute trips to the product that was on board; never sum per-product online time. (3) Keep each driver's current status and its start time as state; every hour, close the hour for each online driver and emit their seconds, plus spans from the hour's changes. (4) Publish provisionally after a short delay, finalise after a lateness bound (for example 24 hours), and restate by recomputing the drivers touched by late rows.

**Rubric anchors.** 2: right spans but no hour split, or the carried-in status lost. 3: matches the expected result. 4: also reasons well about what utilisation means and about incremental computation.

**Strong signals.** Draws a timeline for one driver across an hour boundary and the window edges before coding; filters spans that clip to nothing. **Red flags.** `SUM(EXTRACT(EPOCH FROM …))` over rows grouped by `date_trunc('hour', changed_at)`; assuming every driver starts the window offline.

## UBR-L1-03

**Reference solution** (PostgreSQL; `{{n_s}}` is the long-wait threshold in seconds and `{{min_orders}}` the floor)

```sql reference
WITH first_pickup AS (
  SELECT DISTINCT ON (order_id) order_id, courier_id, event_ts AS picked_at
  FROM courier_events
  WHERE event_type = 'PICKED_UP'
  ORDER BY order_id, event_ts, event_id
), measured AS (
  SELECT p.order_id, o.merchant_id, m.time_zone, p.picked_at,
         MIN(a.event_ts) AS arrived_at
  FROM first_pickup p
  JOIN delivery_orders o ON o.order_id = p.order_id
  JOIN merchants m       ON m.merchant_id = o.merchant_id
  JOIN courier_events a  ON a.order_id = p.order_id
                        AND a.courier_id = p.courier_id
                        AND a.event_type = 'ARRIVED'
                        AND a.event_ts <= p.picked_at
  GROUP BY p.order_id, o.merchant_id, m.time_zone, p.picked_at
), labelled AS (
  SELECT merchant_id,
         EXTRACT(EPOCH FROM picked_at - arrived_at) AS wait_s,
         CASE
           WHEN EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) >= 6
            AND EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) < 11 THEN 1
           WHEN EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) < 6  THEN 5
           WHEN EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) < 15 THEN 2
           WHEN EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) < 17 THEN 3
           WHEN EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone) < 22 THEN 4
           ELSE 5
         END AS part_no
  FROM measured
)
SELECT merchant_id,
       (ARRAY['breakfast', 'lunch', 'afternoon', 'dinner', 'late_night'])[part_no] AS daypart,
       COUNT(*)                                     AS orders,
       COUNT(*) FILTER (WHERE wait_s > {{n_s}})     AS long_waits,
       ROUND(100.0 * COUNT(*) FILTER (WHERE wait_s > {{n_s}}) / COUNT(*), 1) AS long_wait_pct,
       MAX(wait_s)                                  AS max_wait_s
FROM labelled
GROUP BY merchant_id, part_no
HAVING COUNT(*) >= {{min_orders}}
ORDER BY merchant_id, part_no;
```

**Explanation.** The pickup decides everything, so pick it first: the earliest `PICKED_UP` row per order (a retried row comes later and is ignored), and its courier. Only that courier waited, so the arrival join is restricted to the same `courier_id`, to `ARRIVED` events, and to times at or before the pickup (a geofence re-entry on the way out is not a wait); `MIN` takes the first of possibly several arrivals. An order whose courier never logged an arrival drops out of the inner join: it has no measurable wait. The daypart is computed from the arrival converted to the merchant's zone; late night wraps midnight, so the `CASE` tests the hours before 06:00 explicitly and gives late night everything from 22:00. Orders cancelled before pickup never appear because the query starts from pickups.

**Complexity.** One sort for `DISTINCT ON`, one join on `(order_id, courier_id)` and a hash aggregate: O(n log n) over events. At scale, events are partitioned by order (or by date with the order's events co-located) so the whole computation is local per order before the final aggregate.

**Dialect notes** (described, not executed). BigQuery: `EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone)` works as written for `TIMESTAMP`; no `DISTINCT ON` (use `QUALIFY ROW_NUMBER() …`); `COUNTIF`. Snowflake: `CONVERT_TIMEZONE(time_zone, arrived_at)` then `HOUR(…)`; `QUALIFY`, `COUNT_IF`. Spark SQL: `from_utc_timestamp(arrived_at, time_zone)` then `hour(…)`. MySQL 8: `CONVERT_TZ(arrived_at, '+00:00', time_zone)` needs the time-zone tables loaded, otherwise it returns NULL; `ROW_NUMBER()` in a CTE, `SUM(CASE …)`.

**Edge cases built into the data.** A wait of exactly {{n_min}} minutes (not long) and one second over; an arrival at exactly 11:00 and at 17:00 local; an arrival in breakfast with the pickup in lunch; late-night arrivals after local midnight; a cancelled order with an arrival but no pickup; merchants in two time zones (one may be a half-hour offset). Hard: reassigned orders where another courier arrived earlier; a courier with two arrivals before the pickup. Very Hard: arrivals after the pickup; duplicated `PICKED_UP` rows; a pickup whose courier never logged an arrival while another courier did.

**Common mistakes.** Using the UTC hour; daypart from the pickup; the earliest arrival of any courier; the last arrival; `>=` for a long wait; `BETWEEN 22 AND 6` (empty); the last `PICKED_UP` row; counting cancelled orders in `orders`; applying the floor before removing unmeasured orders; ordering dayparts alphabetically.

**Follow-up guidance.** (1) Log the merchant's "order ready" time and the dispatch's planned arrival time; split each wait into "arrived before ready" (dispatch) and "ready but not handed over" (merchant). (2) A spring-forward day has a 23-hour local day: the daypart containing the jump (usually late night) is an hour shorter; `AT TIME ZONE` with a zone name handles it, a fixed offset does not. (3) A high percentile per merchant and daypart, conditioned on basket size, with a minimum sample and shrinkage towards the city's value; the mean is pulled by rare extreme waits and hides the routine ones. (4) One arrival serves both orders: the wait belongs to the courier trip, not to each order; count it once per arrival (or split it) and keep orders as a separate count.

**Rubric anchors.** 2: plausible structure but wrong clock or wrong courier. 3: matches the expected result. 4: also separates merchant from dispatch causes and handles DST and batching credibly.

**Strong signals.** Asks which courier's wait counts and which clock the merchant uses before writing SQL; builds the daypart from the arrival on purpose. **Red flags.** Hard-coding a UTC offset; joining every arrival to every pickup and taking `MAX − MIN`.

## UBR-L1-04

**Reference solution**

```python reference
def nearest_drivers(updates, requests, k, max_ring, claim=False):
    current = {}                                   # driver -> (q, r, status), last row wins
    for driver, q, r, status in updates:
        current[driver] = (q, r, status)
    cells = {}                                     # (q, r) -> sorted ids of open drivers there
    for driver, (q, r, status) in current.items():
        if status == 'open':
            cells.setdefault((q, r), []).append(driver)
    for ids in cells.values():
        ids.sort()

    directions = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))
    get = cells.get
    out = []
    for q0, r0 in requests:
        found = list(get((q0, r0), ()))
        ring = 1
        while len(found) < k and ring <= max_ring:
            ring_ids = []
            q, r = q0 - ring, r0 + ring            # ring * direction 4, then walk the six sides
            for dq, dr in directions:
                for _ in range(ring):
                    ids = get((q, r))
                    if ids:
                        ring_ids.extend(ids)
                    q += dq
                    r += dr
            ring_ids.sort()
            found.extend(ring_ids)
            ring += 1
        found = found[:k]
        if claim and found:
            q, r, _ = current[found[0]]
            cell = cells[(q, r)]
            cell.remove(found[0])
            if not cell:
                del cells[(q, r)]
        out.append(found)
    return out
```

**Explanation.** Only each driver's last update matters, so the stream collapses into a dict first; the available drivers are then indexed by cell, each cell's ids sorted once. For a request, ring 0 is its own cell; ring d is the set of cells at exactly distance d, which the walk reaches by starting d steps along one direction (here `(−1, +1)`) and taking d steps along each of the six directions in turn. Every driver found in ring d is at distance exactly d, so sorting each ring's ids and appending rings in order produces the list in `(distance, driver_id)` order. As soon as a finished ring brings the list to `k`, no later ring can contribute, so the search stops. In claim mode the first driver of each non-empty list is removed from its cell's list (which stays sorted).

**Complexity.** Building the index is O(U + D log D). A request costs O(R² + c log c) for the R rings it needs (3R(R + 1) + 1 cells at most) and c drivers found, independent of the fleet size; at the timing test's density (about one available driver per five to ten cells) that is a few dozen cells per request. A scan of every available driver per request is O(Q × D), about 7 × 10⁸ distance computations in the timing test, which took over 100 seconds in CPython when checked (the reference: about half a second).

**Common mistakes.** `max(|dq|, |dr|)` or a Euclidean distance on axial coordinates; using the first update of a driver instead of the last; including `on_trip` or `offline` drivers; `<` instead of `<=` for `max_ring`; ties by numeric id or by insertion order; stopping in the middle of a ring once `k` are found (a later cell of the same ring can hold a smaller id); a BFS with a visited set that revisits cells or misses ring boundaries; forgetting to remove a claimed driver, or removing it only from the current request's list.

**Follow-up guidance.** (1) Use rings to get a few dozen candidates, then compute road ETAs for those only (a candidate-generation then re-ranking pattern), widening the rings when ETAs are poor. (2) An update is a remove from the old cell and an insert into the new one, O(cell size); shard by coarse cell with overlap (or route each request to the shards its rings touch), and keep each shard's index in memory. (3) Two riders and two drivers on a line: greedy gives the first rider the driver that the second needed and sends the second far away; batching requests over a short window and solving an assignment (Hungarian or min-cost flow) minimises total pickup distance at the cost of a little latency. (4) Search coarse cells first to find non-empty regions, then descend; or keep per-coarse-cell counts so empty areas are skipped in one step.

**Rubric anchors.** 2: correct output but a scan over all drivers, or a distance or tie-break error. 3: correct and ring-bounded with a clear argument. 4: also credible on ETAs, update throughput and batch matching.

**Strong signals.** Checks the distance formula on (2, 2) and (3, −3) before coding; explains why a whole ring must be finished before stopping. **Red flags.** Sorting all drivers by distance for every request; a square bounding box in axial coordinates treated as a ring.

## UBR-L1-05

**Reference solution**

```python reference
from bisect import bisect_right


def fares(trips, rates, surges):
    windows = sorted(surges)                     # half-open, never overlapping
    starts = [w[0] for w in windows]
    per_min, per_km = rates['per_minute'], rates['per_km']
    out = {}
    for trip_id, pings, tolls in trips:
        # Work in units of 1/300000 cent so every charge is an exact integer:
        # m/100 * (dt*per_min/60 + dm*per_km/1000) cents = m*(50*dt*per_min + 3*dm*per_km) units.
        units = rates['base'] * 300000
        high = pings[0][1]                       # odometer high-water mark
        for (t0, _), (t1, odo) in zip(pings, pings[1:]):
            i = bisect_right(starts, t0) - 1
            m = windows[i][2] if i >= 0 and t0 < windows[i][1] else 100
            dm = 0
            if odo > high:
                dm, high = odo - high, odo
            units += m * (50 * (t1 - t0) * per_min + 3 * dm * per_km)
        metered = (units + 150000) // 300000      # one rounding, half up (units >= 0)
        fare = max(metered, rates['minimum'])
        first, last = pings[0][0], pings[-1][0]
        charged = {}
        for toll_id, t, cents in tolls:
            if first <= t <= last and toll_id not in charged:
                charged[toll_id] = cents
        toll_cents = sum(charged.values())
        out[trip_id] = (fare, toll_cents, fare + rates['booking_fee'] + toll_cents)
    return out
```

**Explanation.** Money is kept in integers: `multiplier_pct / 100 × (dt × per_minute / 60 + dm × per_km / 1000)` cents equals `multiplier_pct × (50·dt·per_minute + 3·dm·per_km)` units of 1/300 000 cent, so every charge is an exact integer and the trip's total can be rounded once, halves up, with integer division. Windows are sorted once; `bisect_right(starts, t) − 1` is the only window whose start is at or before `t`, and it contains `t` only if `t` is before its end (half-open). The odometer high-water mark makes a glitch that reads lower add nothing, and resumes distance from the highest reading so far (below Very Hard readings never decrease, so it is the plain difference). The minimum applies to the metered fare; the booking fee and tolls are added afterwards and never surged. Tolls are charged once per `toll_id`, only within the trip's first and last ping.

**Complexity.** O(W log W) to sort the windows, then O(P log W) for P intervals, plus O(T) for tolls. The timing test has about 500 000 intervals and 1 900 windows: the reference runs in well under a second; scanning the windows for every interval (even stopping at the first match) is hundreds of millions of comparisons and took about 30 seconds in CPython when checked, against a limit of 8.

**Common mistakes.** Floats and `round()` (half to even, and binary fractions: `round(202.5) == 202`); rounding each interval; the multiplier from the interval's end, or windows closed at both ends; surging the base fare; adding tolls or the booking fee before the minimum; charging a retried toll twice; charging a toll crossed after the trip ended; negative distance from a glitch; measuring after a glitch from the glitch reading instead of the high-water mark (that charges the same metres twice); assuming `surges` is sorted.

**Follow-up guidance.** (1) Store the quote with its inputs (route, estimated time and distance, multiplier) and compare per component; investigate large deviations by cause (route change, traffic, waiting time) and keep the rider's quoted price as the contract where the product promises it. (2) Recompute with the corrected multiplier from the same inputs, diff per trip and component, issue adjustments as new ledger entries (never overwrite the original fare), and keep the run id, code version and inputs so each adjustment is reproducible. (3) Interpolate on the road network between the last ping before and the first after the gap, flag the estimate, and cap the charge for the gap. (4) The lookup becomes per (cell, time); an interval that crosses cells needs a rule (start cell, or a split at the crossing), and the rule must be stated and versioned like any pricing rule.

**Rubric anchors.** 2: right structure but floats, per-interval rounding, or a boundary error. 3: exact results and bisect-based lookup with a clear argument. 4: also credible on recomputation, auditability and gaps.

**Strong signals.** Chooses integers before writing any arithmetic; asks whether windows are half-open and which end of an interval decides. **Red flags.** `Decimal` with the default context and `quantize` without stating the rounding mode; treating tolls as part of the fare.
