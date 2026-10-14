# Uber · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a ride-hailing,
food-delivery and freight marketplace: riders, drivers and couriers, merchants
and cities. Every workload, number, rule, name and schema is hypothetical.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## UBR-L1-01: Lost trips after a match: who cancelled, and how long the rider had waited

| | |
|---|---|
| **Template ID** | UBR-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / one row per entity before grouping, last event per key, bucketing |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | UBR-L1-01.mjs |

**Business Scenario.** A ride-hailing marketplace matches each trip request to a driver. Sometimes the match falls apart after it was made: the driver cancels and dispatch looks for another driver (a re-match), the rider gives up, or dispatch gives up. The marketplace-health team wants to know, for trips lost after a match, who ended them and how long the rider had been waiting since they were first told a car was coming, without counting a request twice because it was re-matched.

**Problem Statement.** Write one PostgreSQL query that returns `city, cancelled_by, wait_bucket, lost_requests, rematched_requests, max_wait_s` for every `(city, cancelled_by, wait_bucket)` with at least one lost trip, ordered by `city`, `cancelled_by`, then bucket from the shortest wait to the longest. A request's events are its `dispatch_events` in `(event_ts, event_id)` order. A request is a **lost trip** when it has at least one `MATCHED` event, no `PICKED_UP` event, and at least one `CANCELLED` event. It counts once, under the `party` of its last `CANCELLED` event (`cancelled_by`). Its **wait** is the number of seconds from its first `MATCHED` event to that last cancellation. `wait_bucket` is `'{{bucket_a}}'` for a wait under {{b1_s}} seconds, `'{{bucket_b}}'` from {{b1_s}} up to but not including {{b2_s}} seconds, and `'{{bucket_c}}'` from {{b2_s}} seconds on. `lost_requests` counts lost trips; `rematched_requests` counts those that were matched to at least two distinct drivers; `max_wait_s` is the longest wait in the group. {{party_rule}} {{ingest_rule}}

**Constraints.** One SQL statement (CTEs allowed). A request counts once however many times it was matched or cancelled. A request cancelled before any match, and a request that was re-matched after a driver cancelled and then picked up, are not lost trips after a match. The sample has {{n_requests}} requests and {{n_events}} events; a large marketplace has many millions a day.

**Assumptions.** Hypothetical cities, identifiers, timings and bucket edges. Real dispatch has more states (driver arrived, rider no-show, cancellation fees); this exercise uses only the events shown. All timestamps are UTC instants.

**Clarifications.**
- Q: A driver cancels, a second driver is matched, then the rider cancels. Whose is it? | A: The rider's: the last cancellation ended the request. It is also a re-matched request.
- Q: Does a re-match reset the wait? | A: No. The wait runs from the first `MATCHED` event: the rider has been waiting since then.
- Q: Is a wait of exactly {{b1_s}} seconds in '{{bucket_a}}'? | A: No. A bucket includes its lower edge, so it is in '{{bucket_b}}'.
- Q: A driver cancelled, the request was re-matched and the rider was picked up. | A: Not a lost trip, so it is not in the report.
- Q: Two cancellations of one request have the same `event_ts`. | A: Order by `(event_ts, event_id)`: the higher `event_id` is the later one.

**Hints.**
1. Reduce to one row per request first: its first match time, the number of distinct drivers matched, and whether it was picked up.
2. `DISTINCT ON (request_id) … ORDER BY request_id, event_ts DESC, event_id DESC` picks each request's last cancellation.
3. Compute a bucket number with `CASE`, group and order by it, and derive the label from it.

**Follow-ups.**
1. Product asks for cancellation rates, not counts. What is the denominator for a driver-cancellation rate, and why is it different from the one for riders?
2. A rider who cancels within a short grace period after a match pays no fee in many marketplaces. How would you report cancellations inside and outside a grace period without counting any twice?
3. Events from phones can arrive a day late. How would you build this as a daily table that is correct after late data, and when would you call a day final?
4. At hundreds of millions of events a day across many cities, how would you partition `dispatch_events`, and what goes wrong when one request's events land in two daily partitions?

**Follow-up rules.**
- when: count(*), count(event_id), count(e.event_id) → ask: A request was matched three times and cancelled three times. How many times does it appear in your counts?
- when: max(event_ts), last match, latest match → ask: The first driver cancelled after four minutes and a second driver was matched. When did the rider's wait start?
- when: order by event_id, max(event_id) → ask: A phone uploads its events an hour late. Which cancellation does ordering by `event_id` pick as the last one?
- when: requested_at → ask: This report measures the wait from the first match. What would measuring from the request add, and which team would want that instead?
- when: count(driver_id), count(*) filter (where event_type = 'matched') → ask: A client retry wrote the same match twice. Is that request re-matched in your query?

**Evaluation Criteria.** One row per request before grouping; lost trip defined by a match, no pickup and a cancellation; the last cancellation by `(event_ts, event_id)` decides the party; the wait from the first match, not the latest; buckets that include their lower edge; re-matches by distinct drivers (duplicated rows at Very Hard); deterministic ordering by bucket rank rather than label text; can discuss rates, grace periods and late data.

## UBR-L1-02: Driver utilisation by hour from status changes

| | |
|---|---|
| **Template ID** | UBR-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LEAD to turn changes into spans, clipping to a window, splitting at hour boundaries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | UBR-L1-02.mjs |

**Business Scenario.** A driver's app reports status changes: `OPEN` (online and waiting for a request), `EN_ROUTE` (accepted, driving to the pickup), `ON_TRIP` (rider on board) and `OFFLINE`. Utilisation, the share of online time spent with a rider on board, is a core measure of marketplace health per city and hour. The table stores only the changes, so the time in each status has to be reconstructed, and a status that crosses an hour boundary belongs partly to each hour.

**Problem Statement.** Write one PostgreSQL query that returns `city, hour_start, drivers, open_min, en_route_min, on_trip_min, utilisation` for every city and UTC hour of the report window `[{{from_ts}}, {{to_ts}})` ({{hours}} hours) in which some driver of that city was online, ordered by `city, hour_start`. Each `driver_status` row starts a status that lasts until the same driver's next row in `(changed_at, event_id)` order or, if there is none, until `{{to_ts}}`. {{cap_rule}} Only the part of a status inside the window counts, split at UTC hour boundaries. `OPEN`, `EN_ROUTE` and `ON_TRIP` are online; `OFFLINE` is not. `drivers` is the number of distinct drivers with online time in the hour. Each `_min` column is the seconds spent in that status divided by 60, rounded to 2 places; `utilisation = on_trip / (open + en_route + on_trip)` computed from seconds and rounded to 4 places. {{window_rule}}

**Constraints.** One SQL statement (CTEs allowed). `hour_start` is the timestamp at which the UTC hour starts. A status that lasts zero seconds contributes nothing. The sample has {{n_drivers}} drivers and {{n_rows}} status rows; a large city has tens of thousands of drivers.

**Assumptions.** Hypothetical cities, drivers, statuses and window. Real driver apps have more states (arrived at pickup, paused, multiple products); this exercise uses four. The city of a driver is fixed for the day.

**Clarifications.**
- Q: A driver went `OPEN` at 09:50 and `ON_TRIP` at 10:20. | A: Ten minutes of `OPEN` belong to the 09:00 hour and twenty to the 10:00 hour.
- Q: A driver's last row is `OPEN` and nothing follows. | A: It lasts until the window ends at `{{to_ts}}`, unless the problem states a cap.
- Q: Two rows of one driver have the same `changed_at`. | A: Order by `event_id`: the lower one lasts zero seconds and the higher one holds from then.
- Q: A status started before `{{from_ts}}`. | A: It counts from `{{from_ts}}` on.
- Q: An hour in which nobody in a city was online? | A: Leave it out.

**Hints.**
1. `LEAD(changed_at) OVER (PARTITION BY driver_id ORDER BY changed_at, event_id)` gives every status its end; `COALESCE` the last one to the window end.
2. Clip each span with `GREATEST` and `LEAST`, join it to `generate_series` over the window's hours wherever the span overlaps the hour, and keep the overlap.
3. Sum seconds per status with `FILTER`, then divide and round only at the end.

**Follow-ups.**
1. Utilisation is 0.6 in one city and 0.4 in another. What else would you need to know before calling the second city oversupplied?
2. A driver is online for rides and for deliveries at the same time. How would you attribute online time without counting it twice?
3. At millions of drivers, the hour-split join is a large fan-out. How would you compute this incrementally every hour, and what state carries over from one hour to the next?
4. Phones report status changes late after losing signal. How long would you wait before publishing an hour, and how would you restate it?

**Follow-up rules.**
- when: lead( → ask: What does `LEAD` return for a driver's last row, and how long does that status last in your query?
- when: date_trunc → ask: You truncate each status's start to the hour. Where does the part after the next hour boundary go?
- when: changed_at >=, changed_at between, where changed_at → ask: A driver went `OPEN` before the window started and stayed online. What does your filter give the window's first hour?
- when: count(*), count(driver_id) → ask: Is `drivers` a count of rows or of people? Think of a driver with five status changes in one hour.
- when: heartbeat, stale, cap → ask: Why should time beyond the cap count as offline rather than as the last known status, and what does each choice do to utilisation?

**Evaluation Criteria.** Spans from `LEAD` in a deterministic order; the last status extended to the window end; statuses carried in from before the window and clipped at both ends; correct splitting at hour boundaries; distinct drivers per hour; rounding only at the end; the staleness cap at Very Hard; can discuss what utilisation does and does not tell you, and incremental computation.

## UBR-L1-03: Courier waits at restaurants, per merchant and daypart

| | |
|---|---|
| **Template ID** | UBR-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / picking the right event per order, local time zones, dayparts that wrap midnight |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | UBR-L1-03.mjs |

**Business Scenario.** In food delivery, a courier who arrives before the food is ready waits at the counter. Long waits waste courier time, and couriers start declining that merchant's orders. Merchants want a report per daypart in their own local time. The courier app logs `ARRIVED` when the courier enters the restaurant's geofence, `PICKED_UP` when the courier confirms the pickup, and `UNASSIGNED` when an order is taken away from a courier.

**Problem Statement.** Write one PostgreSQL query that returns `merchant_id, daypart, orders, long_waits, long_wait_pct, max_wait_s` for every merchant and daypart with at least {{min_orders}} measured orders, ordered by `merchant_id`, then daypart in the order breakfast, lunch, afternoon, dinner, late_night. An order is **measured** when it has a `PICKED_UP` event. Its pickup is its first `PICKED_UP` event in `(event_ts, event_id)` order, and the courier who picked up is that row's `courier_id`. The **wait** runs from that courier's first `ARRIVED` event for the order at or before the pickup, to the pickup, in seconds. The **daypart** comes from the local time of that arrival in the merchant's `time_zone`: `breakfast` 06:00 to before 11:00, `lunch` 11:00 to before 15:00, `afternoon` 15:00 to before 17:00, `dinner` 17:00 to before 22:00, and `late_night` 22:00 to before 06:00. A **long wait** is strictly more than {{n_min}} minutes ({{n_s}} seconds); `long_wait_pct = ROUND(100.0 * long_waits / orders, 1)`. {{courier_rule}} {{data_rule}}

**Constraints.** One SQL statement (CTEs allowed). Orders without a pickup (cancelled) are not measured. `orders` counts measured orders in the group. The sample has {{n_orders}} orders and {{n_events}} courier events.

**Assumptions.** Hypothetical merchants, couriers, time zones, dayparts and threshold. Geofence arrival is a proxy for walking in; real delivery apps have more signals (order ready, handed over). Timestamps are UTC instants at whole seconds.

**Clarifications.**
- Q: Which clock decides the daypart? | A: The merchant's. Convert the arrival with `AT TIME ZONE time_zone` and use the local hour.
- Q: The courier arrives at 10:55 local time and picks up at 11:10. | A: Breakfast: the daypart comes from the arrival, when the wait began.
- Q: Is a wait of exactly {{n_min}} minutes long? | A: No. Long is strictly more than {{n_min}} minutes.
- Q: An order was cancelled after the courier arrived. | A: It has no pickup, so it is not measured at all.
- Q: Does an order below the {{min_orders}}-order floor still count somewhere? | A: No. A merchant's daypart with fewer measured orders is left out.

**Hints.**
1. Pick each order's pickup row first (`DISTINCT ON (order_id)`), then join back to `ARRIVED` events of the same courier at or before it and take the earliest.
2. `EXTRACT(HOUR FROM arrived_at AT TIME ZONE time_zone)` is the local hour. Late night wraps midnight, so test the other dayparts first and let late night take the rest.
3. Number the dayparts 1 to 5 for ordering and label them from the number.

**Follow-ups.**
1. A long wait might be the merchant's slow kitchen or a courier who arrived too early. Which other events would tell them apart, and how would you change the metric?
2. A merchant's city changes to daylight saving time next week. Which dayparts are an hour longer or shorter that day, and does your query handle it?
3. Dispatch wants to use this to time courier arrivals per merchant. Which statistic would you give it (a mean, a percentile, something conditional on order size), and why?
4. A courier carries two batched orders from the same merchant: one arrival, two pickups. How does that change the wait and the count?

**Follow-up rules.**
- when: at time zone 'utc', utc hour, extract(hour from event_ts) → ask: Which clock does your daypart use? A courier arriving at 12:30 in Sydney arrives at what UTC hour?
- when: min(event_ts), first arrival, earliest arrival → ask: Is that the first arrival of the courier who picked up, or of anyone? What happens on a reassigned order?
- when: max(event_ts), last arrival, latest arrival → ask: The courier left and re-entered the geofence before the pickup. When did their wait start?
- when: avg, average wait, mean → ask: The average hides the tail merchants complain about. What does the share over {{n_min}} minutes tell you that the mean does not?
- when: picked_at, pickup time → ask: Which timestamp decides the daypart in your query, the arrival or the pickup, and why does it matter at 10:55?

**Evaluation Criteria.** The first pickup per order and its courier; that courier's first arrival at or before the pickup; local time from the merchant's zone; dayparts that wrap midnight; strict threshold; the floor applied after measurement; reassignment and geofence re-entry handled (Hard); arrivals after pickup, duplicate pickups and pickups with no arrival handled (Very Hard); deterministic ordering by daypart rank.

## UBR-L1-04: Nearest available drivers on a hexagonal grid

| | |
|---|---|
| **Template ID** | UBR-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Spatial indexing / hex grids in axial coordinates, ring search, k nearest with ties |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | UBR-L1-04.mjs |

**Business Scenario.** A marketplace indexes the city with a grid of hexagons: every location maps to a cell, and the distance between two cells is the number of steps between neighbouring hexagons, its ring. Hexagons are convenient because all six neighbours of a cell are equally far away. Dispatch wants, for each incoming request, the nearest available drivers in rings, as the candidate list for the matching step, while location and status updates keep streaming in.

**Problem Statement.** Implement `nearest_drivers(updates, requests, k, max_ring, claim=False)`. Cells use axial coordinates `(q, r)`; the distance between `(q1, r1)` and `(q2, r2)` is `(|q1 − q2| + |r1 − r2| + |q1 + r1 − q2 − r2|) / 2`. `updates` is a list of `(driver_id, q, r, status)` with `status` in `'open'`, `'on_trip'`, `'offline'`. {{update_rule}} For each request `(q, r)`, in order, return the available drivers at distance at most `max_ring`, nearest first, ties broken by `driver_id` (string comparison), at most `k` of them. Return a list with one list per request; a request with nobody in range gets `[]`. {{claim_rule}}

**Constraints.** Up to 100 000 updates for 60 000 drivers, 15 000 requests, `k ≤ 10`, `max_ring ≤ 10`. Checking every driver for every request is too slow: the work per request should depend on the cells near it, not on the size of the fleet.

**Assumptions.** Hypothetical grid, identifiers and fleet. Production hexagonal indexes (such as the open-source H3 library) add resolutions, a global coordinate system and pentagons; this exercise uses plain axial coordinates on a flat grid. Ring distance stands in for travel time, which real dispatch estimates on the road network.

**Clarifications.**
- Q: Is a driver exactly `max_ring` rings away included? | A: Yes. At most `max_ring`.
- Q: What is the distance from (0, 0) to (2, 2)? | A: 4, that is (2 + 2 + 4) / 2. `max(|dq|, |dr|)` is not the distance in axial coordinates.
- Q: How are driver ids compared on a tie? | A: As Python strings, so `'drv_100'` comes before `'drv_99'`.
- Q: Can several drivers be in one cell? | A: Yes, many.
- Q: What if fewer than `k` drivers are in range? | A: Return the ones there are.

**Hints.**
1. Build a dict from cell to the sorted ids of the available drivers in it, once.
2. Walk rings outward from the request's cell: ring 0 is the cell itself, and ring d has 6·d cells, which you reach by stepping d cells in one direction and then walking d steps along each of the six sides.
3. Once a finished ring brings you to `k` drivers, every remaining driver is farther away: stop. Only the drivers within one ring need sorting.

**Follow-ups.**
1. Ring distance ignores rivers and one-way streets. How would you combine this candidate list with road-network ETAs without computing an ETA for every driver in the city?
2. A city sends 100 000 location updates a second. What does each update cost in your index, and how would you shard it?
3. With `claim`, each request greedily takes its nearest driver. Show a case where greedy matching gives a worse total pickup distance than matching a small batch of requests together, and how you would batch.
4. Downtown cells hold 50 drivers each; suburbs have none for 20 rings. How would a hierarchical grid, with coarse cells containing fine ones, change the search?

**Follow-up rules.**
- when: chebyshev, euclidean, sqrt, max(abs → ask: Work out your distance from (0, 0) to (2, 2) and to (3, −3). Which driver is nearer?
- when: for driver in, every driver, all drivers → ask: How many distance checks is that for 15 000 requests over 50 000 available drivers?
- when: bfs, breadth-first, visited → ask: A BFS over neighbours works. What does the visited set cost per request compared with walking each ring directly?
- when: remove, discard → ask: In claim mode, what does removing a driver cost in your index, and does each cell's list stay sorted?
- when: heapq, nsmallest → ask: Do you need a heap across all candidates, or can you stop after the ring that reaches `k`?

**Evaluation Criteria.** Correct axial distance; the last update per driver decides position and status; `max_ring` inclusive; ties by string id; ring-by-ring search that stops early; a cell index built once; claims removed from the index (Very Hard); a clear complexity argument; credible discussion of ETAs, update throughput and batch matching.

## UBR-L1-05: Fares from a trip's pings: surge windows, minimum fare and tolls

| | |
|---|---|
| **Template ID** | UBR-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Exact arithmetic / integer money, interval lookup with bisect, rounding once |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | UBR-L1-05.mjs |

**Business Scenario.** In this exercise's hypothetical pricing, a ride costs a base fare plus a per-minute and a per-kilometre charge, multiplied during surge windows when demand outstrips supply, and never less than a minimum fare; tolls are passed through to the rider at cost and a booking fee is added. After a pricing incident, the finance team needs to recompute a day of fares from each trip's GPS pings, exactly to the cent.

**Problem Statement.** Implement `fares(trips, rates, surges)`. Each trip is `(trip_id, pings, tolls)`: `pings` are `(t_s, odometer_m)` with strictly increasing times, and `tolls` are `(toll_id, t_s, cents)`. `rates` holds `base`, `per_minute`, `per_km`, `minimum` and `booking_fee`, all in cents. `surges` are `(start_s, end_s, multiplier_pct)`: half-open windows `[start_s, end_s)` that never overlap, with `150` meaning 1.5×. Each interval between consecutive pings, of `dt` seconds and `dm` metres, is charged `multiplier_pct / 100 × (dt × per_minute / 60 + dm × per_km / 1000)` cents, using the window that contains the interval's **start** time (100 if none). `metered` is `base` plus the exact sum of the charges, rounded once to the nearest cent with halves rounded up; `fare = max(metered, minimum)`. A trip's tolls are the toll events from its first ping's time to its last ping's time (inclusive), each `toll_id` charged once, with the cents of its first row. Return `{trip_id: (fare, tolls, total)}` with `total = fare + booking_fee + tolls`. {{window_rule}} {{odo_rule}}

**Constraints.** Up to 5 000 trips of 100 pings each and a few thousand surge windows. Every trip has at least one ping; all inputs are integers. The result must be exact: no floating point. Searching all windows for every interval is too slow.

**Assumptions.** The formula, rates, multipliers and windows are hypothetical and much simpler than any real pricing; real marketplaces often quote an upfront price before the trip. Here the surge multiplies time and distance only, never the base fare, the booking fee or tolls.

**Clarifications.**
- Q: An interval starts exactly when a surge window ends. | A: It is not surged: windows are half-open, and the interval takes the multiplier in effect at its start.
- Q: When do I round? | A: Once per trip, after adding the base and every charge. Halves round up: 202.5 cents is 203.
- Q: Do tolls or the booking fee count towards the minimum fare? | A: No. The minimum applies to the metered fare; the booking fee and tolls are added after it.
- Q: Is the base fare surged? | A: No.
- Q: A trip has a single ping. | A: It has no intervals: `metered = base`, then the minimum applies.

**Hints.**
1. Keep money in integers. Multiply every charge by a common denominator (for example `multiplier_pct × (50·dt·per_minute + 3·dm·per_km)` is the charge in units of 1/300 000 of a cent) and divide once at the end. Python's `round()` rounds halves to even, and floats are not exact.
2. Sort the windows once by start; `bisect` finds the only window that can contain a time.
3. A dict keyed by `toll_id` charges each toll once.

**Follow-ups.**
1. Riders are quoted a price before the trip. How would you compare the quote with this metered fare, and which differences would you investigate first?
2. A pricing bug applied the wrong multiplier for two hours yesterday. How would you recompute, compare, and issue adjustments to riders and drivers in a way an auditor can follow?
3. Pings are missing for five minutes in a tunnel. How would you estimate the time and distance there, and how would you show that on the receipt?
4. Surge windows are per hex cell, not per city. What changes in the lookup, and what happens to an interval that crosses into another cell?

**Follow-up rules.**
- when: round( → ask: What does Python's `round(202.5)` return, and what does this fare rule require?
- when: float, decimal → ask: Where could floating point enter your fare, and can two trips with the same charges differ by a cent?
- when: for s, e, m in surges, every window, each window → ask: How many window checks is that for 500 000 intervals and 2 000 windows?
- when: bisect, bisect_left, bisect_right → ask: Which bisect finds the window for a ping exactly at a window's start, and which one for a ping exactly at its end?
- when: set(, seen, toll_id → ask: The same `toll_id` appears twice. When is that a retry, and when could a trip really cross the same toll twice?

**Evaluation Criteria.** Exact integer arithmetic with one rounding, halves up; the multiplier from the interval's start in half-open windows; base fare, booking fee and tolls never surged; the minimum applied before the booking fee and tolls; tolls charged once per `toll_id` (Hard) and only within the trip (Very Hard); odometer glitches handled with a high-water mark (Very Hard); sorted windows with bisect; a clear complexity argument.
