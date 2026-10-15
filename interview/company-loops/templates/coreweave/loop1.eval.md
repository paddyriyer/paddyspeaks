# CoreWeave · Loop 1 — evaluator notes

Simulated practice scenarios; every price, capacity, power figure, SLA term and
volume is hypothetical and "this exercise's rule; check current docs". Every
expected result is computed by the template's generator and proven against the
reference below.

## CRW-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH live AS (
  SELECT request_id, region, gpu_type, nodes_requested, requested_at
  FROM cluster_requests
  WHERE cancelled_at IS NULL
), node_ready AS (
  SELECT e.request_id, e.node_name, MIN(e.event_ts) AS first_ready
  FROM node_events e
  WHERE e.state = 'ready'
  GROUP BY e.request_id, e.node_name
), ranked AS (
  SELECT request_id, first_ready,
         ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY first_ready, node_name) AS k
  FROM node_ready
), ready AS (
  SELECT l.request_id,
         EXTRACT(EPOCH FROM (r.first_ready - l.requested_at)) / 60 AS minutes
  FROM live l
  JOIN ranked r ON r.request_id = l.request_id AND r.k = l.nodes_requested
)
SELECT date_trunc('week', l.requested_at)::date                     AS week_start,
       l.region,
       l.gpu_type,
       COUNT(rd.request_id)                                          AS ready_clusters,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY rd.minutes)       AS median_minutes,
       MAX(rd.minutes)                                               AS max_minutes,
       COUNT(*) FILTER (WHERE rd.request_id IS NULL)                 AS partial_clusters
FROM live l
LEFT JOIN ready rd ON rd.request_id = l.request_id
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

**Explanation.** Reduce node events to one row per (request, node) with the first `ready` time, so a flapping node counts once and keeps its first time. Rank each request's nodes by that time; the cluster became ready at rank `nodes_requested`. That is the last node when exactly the requested number became ready, and earlier than the last when a replacement and the recovered node both became ready (Very Hard). A request with no row at that rank is partial. Starting from the non-cancelled requests and LEFT JOINing the ready times keeps groups where nothing became ready, and keeps partial requests countable with `FILTER (WHERE … IS NULL)`. The week comes from `requested_at`, never from the ready time.

**Complexity.** One aggregate over node events, one window sort per request (small partitions), a hash join and a hash aggregate: O(e log e) for e events. In production, maintain a per-request "ready at" table updated as node events arrive, keyed by request, and aggregate weekly from it.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `QUALIFY` can replace the ranked CTE; `MEDIAN(x)` (Snowflake) or `PERCENTILE_CONT(x, 0.5) OVER ()` (BigQuery, analytic only, so aggregate with `APPROX_QUANTILES` or a window plus `ANY_VALUE`); `DATE_TRUNC(…, WEEK(MONDAY))` in BigQuery, whose default week starts on Sunday; `COUNT_IF`/`COUNTIF` for the filtered count. Spark SQL: `percentile(x, 0.5)` is exact, `percentile_approx` is not; `date_trunc('week', …)` starts on Monday. MySQL 8: no `percentile_cont` and no `FILTER`; use `ROW_NUMBER` and a count to find the middle values, and `SUM(CASE …)`.

**Edge cases built into the data.** A cancelled request whose nodes all became ready before the cancellation; partial clusters with no ready node and with some; groups where only one GPU type has activity. Hard: a second week; the last node of a ready cluster flaps and reports `ready` again later; a node of a partial cluster flaps, so counting ready events would make it look ready; a cancelled partial request. Very Hard: a replacement node with the failed node never ready; a failed node that recovers after its replacement, so a cluster has `nodes_requested + 1` ready nodes; a request at 23:30 on a Sunday whose nodes become ready on Monday.

**Common mistakes.** `MAX(event_ts)` over ready events (moves flapping nodes later and uses the extra recovered node); `COUNT(*)` of ready events instead of distinct nodes; filtering cancelled requests after the join, or not at all; `AVG` instead of `percentile_cont`; INNER JOIN, which drops groups with only partial clusters and makes `partial_clusters` impossible; grouping by the ready week.

**Follow-up guidance.** (1) Publish the clock definition with the number. Customer-facing time usually starts at the request; internal stages (quota approval, capacity found, imaging) are separate durations that add up, reported as a stage breakdown rather than overlapping totals. (2) `now() - requested_at` for the oldest partial cluster; the query needs an explicit as-of time, so reruns are reproducible. (3) Keep per-node first-ready and per-request ready-at in keyed tables; a late `ready` event can only move a node earlier, so updates are monotone; recompute only the affected week. (4) p90/p95 next to the median, with counts; below about 20 clusters a p95 is one or two clusters and should be shown as the maximum instead.

**Rubric anchors.** 2: right shape, but cancelled requests are counted, or flaps or replacements change times, or partial clusters vanish. 3: matches the expected result. 4: also explains the n-th node rule and the clock definition, and maintains the report incrementally.

**Strong signals.** Asks what "ready" means when nodes flap or are replaced before writing SQL; checks that `ready_clusters + partial_clusters` equals the non-cancelled requests. **Red flags.** Averages over partial clusters with their last ready node; treats the week of readiness as the week of the request.

## CRW-L1-02

**Reference solution** (PostgreSQL; `{{sla}}`, `{{notice_hours}}` and `{{last_month}}` come from the instance)

```sql reference
WITH report_months AS (
  SELECT m AS month_start, m + interval '1 month' AS month_end
  FROM generate_series(timestamptz '2026-09-01', timestamptz '{{last_month}}', interval '1 month') AS m
), advance AS (
  SELECT cluster_id, starts_at, ends_at
  FROM maintenance_windows
  WHERE announced_at <= starts_at - interval '{{notice_hours}} hours'
), down_minutes AS (
  SELECT DISTINCT o.cluster_id, o.node_name, g.minute_ts
  FROM node_outages o
  CROSS JOIN LATERAL generate_series(o.started_at, o.ended_at - interval '1 minute', interval '1 minute') AS g(minute_ts)
  WHERE NOT EXISTS (
    SELECT 1 FROM advance a
    WHERE a.cluster_id = o.cluster_id
      AND g.minute_ts >= a.starts_at AND g.minute_ts < a.ends_at
  )
), per_month AS (
  SELECT c.cluster_id, c.customer_id, rm.month_start,
         c.node_count * (EXTRACT(EPOCH FROM (rm.month_end - rm.month_start)) / 60)::bigint AS node_minutes,
         (SELECT COUNT(*) FROM down_minutes d
           WHERE d.cluster_id = c.cluster_id
             AND d.minute_ts >= rm.month_start AND d.minute_ts < rm.month_end) AS unavailable
  FROM clusters c CROSS JOIN report_months rm
)
SELECT month_start::date                                        AS month,
       cluster_id,
       customer_id,
       node_minutes,
       unavailable                                              AS unavailable_node_minutes,
       ROUND(100.0 * (node_minutes - unavailable) / node_minutes, 3) AS availability_pct,
       CASE WHEN 100.0 * (node_minutes - unavailable) >= {{sla}} * node_minutes THEN 0
            WHEN 100.0 * (node_minutes - unavailable) >= 99.0 * node_minutes THEN 10
            WHEN 100.0 * (node_minutes - unavailable) >= 95.0 * node_minutes THEN 25
            ELSE 50 END                                         AS credit_pct
FROM per_month
ORDER BY month, cluster_id;
```

**Explanation.** The minute grid makes the rules literal. Each outage expands to its minutes (`ended_at` exclusive). A minute is dropped when an advance-announced window of the same cluster covers it; announcement exactly the notice period ahead qualifies (`<=`). `DISTINCT` on (cluster, node, minute) counts a node-minute once when two monitors' records overlap. The cluster × month grid (with month ranges half-open) splits outages that cross a month boundary and drops minutes before the report. Tiers compare `100 × available ≥ target × node_minutes` in exact numerics, so availability exactly at the target is not a breach; `ROUND` is only for the displayed percentage.

**Complexity.** O(total outage minutes) rows in the grid, a hash anti-join against windows, and a distinct sort. Fine for the sample; at fleet scale the grid is the problem. The scalable version merges each node's outage intervals (sort by start, a running maximum of ends to find islands), clips them to month ranges, subtracts the overlap with merged qualifying windows, and sums durations: O(r log r) for r records, independent of their length.

**Dialect notes** (described, not executed). Snowflake: no `generate_series` over timestamps; use `TABLE(GENERATOR(ROWCOUNT => …))` with `DATEADD`, or better the interval-arithmetic version; `DATEDIFF('minute', …)`. BigQuery: `GENERATE_TIMESTAMP_ARRAY(start, end, INTERVAL 1 MINUTE)` with `UNNEST`, and `TIMESTAMP_DIFF`. Spark SQL: `explode(sequence(start, end, interval 1 minute))`. MySQL 8: a recursive CTE for the minutes, or interval arithmetic with `TIMESTAMPDIFF`; `generate_series` does not exist.

**Edge cases built into the data.** Outages partly inside an advance-announced window and partly outside; a window announced late that still counts; clusters in several credit tiers, and clusters with no outages in a month. Hard: an outage from August into September (only September minutes count); one from September into October (split); overlapping records of one failure on one node. Very Hard: a window announced exactly the notice period ahead (excluded); a cluster of 10 or 20 nodes exactly at the SLA target (credit 0); an advance window of one cluster during another cluster's outage (does not apply).

**Common mistakes.** Summing `ended_at - started_at` per record (double counts overlaps, ignores month boundaries); ignoring maintenance, or excluding every window; `<` instead of `<=` for the notice; joining windows without the cluster; choosing the tier from the rounded availability or with `>`; an INNER JOIN that drops clusters with no outages; floating-point percentages compared with the target.

**Follow-up guidance.** (1) Gaps-and-islands merge per node: `MAX(ended_at) OVER (PARTITION BY node ORDER BY started_at ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)` to start islands, then clip to months and subtract merged window overlaps with `GREATEST`/`LEAST`. (2) A cluster-level outage table; a node-minute is unavailable if the node or its cluster is down, so union the two at node level (or count cluster minutes × nodes minus the node-minutes already counted) to avoid double counting. (3) Never edit a closed month's invoice silently: post the credit difference as an adjustment in the next invoice, with the restated availability, and keep the outage's arrival time. (4) Per-cluster unavailable intervals with timestamps, excluded windows with their announcement time, and the tier rule; never another customer's data or internal incident detail.

**Rubric anchors.** 2: totals per cluster but double counts overlaps, misses month splitting, or handles maintenance wrongly. 3: matches the expected result. 4: also gives the interval-arithmetic version and a sound policy for late records and customer audits.

**Strong signals.** Asks whether ends are inclusive and whether the notice is inclusive; notices that the tier must be chosen before rounding. **Red flags.** Applies a window from another cluster; reports availability with a float compared to 99.9.

## CRW-L1-03

**Reference solution** (PostgreSQL; `{{first_day}}` and `{{last_day}}` come from the instance)

```sql reference
WITH latest AS (
  SELECT DISTINCT ON (hall_id, reading_ts) hall_id, reading_ts, draw_kw
  FROM power_readings
  ORDER BY hall_id, reading_ts, received_at DESC
), local_readings AS (
  SELECT l.hall_id, l.reading_ts AT TIME ZONE h.site_tz AS local_ts, l.draw_kw
  FROM latest l
  JOIN halls h ON h.hall_id = l.hall_id
), hall_days AS (
  SELECT h.hall_id, h.contracted_kw, d::date AS day
  FROM halls h
  CROSS JOIN generate_series(date '{{first_day}}', date '{{last_day}}', interval '1 day') AS d
), marks AS (                 -- reading starts, plus a sentinel half an hour before the day and one at its end
  SELECT hd.hall_id, hd.day, lr.local_ts AS t
  FROM hall_days hd
  JOIN local_readings lr ON lr.hall_id = hd.hall_id AND lr.local_ts::date = hd.day
  UNION ALL SELECT hall_id, day, day - interval '30 minutes' FROM hall_days
  UNION ALL SELECT hall_id, day, day + interval '1 day' FROM hall_days
), gaps AS (
  SELECT hall_id, day, COALESCE(BOOL_OR(t - prev_t >= interval '90 minutes'), false) AS data_gap
  FROM (SELECT hall_id, day, t, LAG(t) OVER (PARTITION BY hall_id, day ORDER BY t) AS prev_t FROM marks) x
  GROUP BY hall_id, day
)
SELECT hd.day,
       hd.hall_id,
       COUNT(lr.local_ts)                                                   AS readings,
       MAX(lr.draw_kw)                                                      AS peak_kw,
       ROUND(100 * MAX(lr.draw_kw) / hd.contracted_kw, 1)                   AS peak_pct,
       30 * COUNT(*) FILTER (WHERE lr.draw_kw > 0.9 * hd.contracted_kw)     AS minutes_above_90,
       g.data_gap
FROM hall_days hd
LEFT JOIN local_readings lr ON lr.hall_id = hd.hall_id AND lr.local_ts::date = hd.day
JOIN gaps g ON g.hall_id = hd.hall_id AND g.day = hd.day
GROUP BY hd.day, hd.hall_id, hd.contracted_kw, g.data_gap
ORDER BY hd.day, hd.hall_id;
```

**Explanation.** De-duplicate re-sent readings first (latest `received_at` wins), so a stale spike cannot set the peak. Convert each reading to its hall's local wall-clock time with `AT TIME ZONE site_tz`; the local date is the hall's day (at Medium and Hard every hall is on UTC, so the same query works at every level). The hall × day grid keeps hall-days with no readings. Gaps: within a hall-day, the reading starts plus two sentinels (30 minutes before local midnight and the next local midnight) are ordered; consecutive marks 90 minutes or more apart leave at least 60 uncovered minutes, because each reading covers 30. The sentinels make "an hour without readings at the start or end of the day" and "no readings at all" fall out of the same rule. `minutes_above_90` counts strictly-above readings × 30.

**Complexity.** One sort for `DISTINCT ON`, one window sort per hall-day, and a grouped aggregate: O(n log n) for n readings. In production readings are partitioned by day and clustered by hall; the daily report is a small aggregate on top.

**Dialect notes** (described, not executed). Snowflake: `QUALIFY ROW_NUMBER() OVER (PARTITION BY hall_id, reading_ts ORDER BY received_at DESC) = 1`; `CONVERT_TIMEZONE(site_tz, reading_ts)`; `BOOLOR_AGG`; `COUNT_IF`. BigQuery: `QUALIFY` too; `DATETIME(reading_ts, site_tz)`; `LOGICAL_OR`; `GENERATE_DATE_ARRAY` for the grid. Spark SQL: `from_utc_timestamp(reading_ts, site_tz)`, `bool_or`, `sequence` + `explode`. MySQL 8: `CONVERT_TZ` needs the zone tables loaded; no `DISTINCT ON`, no `FILTER`, no `BOOL_OR` (use `MAX(condition)`).

**Edge cases built into the data.** A reading of exactly 90% of the contract (not above); a short spike above 90% on every hall-day; one missing reading (not a gap); two or three missing at the start of a day (a gap); two to four missing in the middle (a gap); sometimes one missing at an edge (not a gap). Hard: a second day; re-sent readings, one with a false spike above the real peak; a hall-day with no readings at all; sometimes a gap at the end of the day. Very Hard: halls in zones 1 to 7 hours from UTC, so a local day spans two UTC dates.

**Common mistakes.** No de-duplication (doubles minutes, keeps the false peak); `>=` 0.9; gaps only between readings (misses the day's edges and the empty day); flagging a single missing reading; grouping by the UTC date; an INNER JOIN that drops hall-days with no readings; `ROUND` on a float division.

**Follow-up guidance.** (1) With 1-minute readings, a 15-minute average is a rolling window (`AVG … OVER (ROWS BETWEEN 14 PRECEDING AND CURRENT ROW)`) that must check it has 15 readings; a peak from 30-minute averages understates short peaks, so say what the data can and cannot show. (2) Sum the feeds per interval only when both reported; otherwise mark the interval incomplete rather than reporting half the draw. (3) A streaming job keyed by hall with a 30-minute window, firing only when the window is complete and above the threshold, plus a staleness alert when a meter goes quiet. (4) A local day with 23 or 25 hours has 46 or 50 half-hours; the grid must be generated in local time and converted, the sentinel must use the actual next midnight, and the share of time above 90% is better than raw minutes.

**Rubric anchors.** 2: peaks per hall-day but misses de-duplication, local days or edge gaps. 3: matches the expected result. 4: also explains the sentinel trick, and reasons well about averaging windows, dual feeds and DST.

**Strong signals.** Asks what interval a reading covers before defining a gap; separates "no data" from "low draw". **Red flags.** Treats a missing reading as zero draw; reports a peak from a stale duplicate.

## CRW-L1-04

**Reference solution**

```python reference
from bisect import bisect_right


def maintenance_moments(windows, freezes=()):
    if any(s > e for s, e in windows):
        return None
    # Merge freezes that overlap or touch, so the minute before a merged run is free.
    merged = []
    for a, b in sorted(freezes):
        if merged and a <= merged[-1][1] + 1:
            if b > merged[-1][1]:
                merged[-1][1] = b
        else:
            merged.append([a, b])
    starts = [a for a, _ in merged]
    out = []
    last = None
    for s, e in sorted(windows, key=lambda w: w[1]):
        if last is not None and s <= last:      # last <= e: windows come by end, last <= an earlier end
            continue
        p = e
        i = bisect_right(starts, p) - 1
        if i >= 0 and merged[i][1] >= p:        # e is frozen: step to the minute before that freeze
            p = merged[i][0] - 1
        if p < s:
            return None
        out.append(p)
        last = p
    return out
```

**Explanation.** Sort windows by end. Keep the last moment placed. A window whose start is at or before that moment contains it: the moment is at most the end of an earlier window, which is at most this window's end. Otherwise place a new moment at this window's end. Why it is optimal: some moment must lie in the window that ends first, and moving it to that end keeps every window it served (they start before it and end no earlier), so a greedy moment never loses. Why it is the latest: any valid schedule's first moment is at most the earliest end, and by induction its i-th moment is at most the greedy's i-th. With freezes (Very Hard) the same argument holds with "the latest allowed minute at or before the end": merge overlapping and touching freezes once, bisect into their starts, and step to the minute before the covering freeze; if that is before the window's start, no schedule exists. An invalid window (Hard) returns `None` before anything else.

**Complexity.** O(n log n) for the sort plus O(log f) per moment for the bisect, O(f log f) to merge freezes; O(n + f) memory. The timing test (100 000 windows over a year, about 7 300 moments; 2 000 freezes at Very Hard) runs in about 0.08 s in CPython.

**The middle approach.** The most likely middle solution sorts by end, picks the first window's end, then rebuilds the list without the windows that contain it (`[w for w in ws if not (w[0] <= m <= w[1])]`), and repeats. It is correct, and the comprehension runs at C speed, but each rebuild scans every remaining window: about n·k/2 = 3.7 × 10⁸ checks on the timing test, which took about 57 s in CPython when timed for this template, so it fails the 8 s limit clearly. A pure-Python check of every window against every chosen moment is slower still. A heap keyed by end that pops covered windows is O(n log n) and passes; it is an acceptable answer.

**Dialect notes.** In Java or C++ sort an array of pairs by end, and use `TreeMap.floorEntry` (or `std::upper_bound`) over merged freezes. In SQL this is not a natural set operation; a recursive CTE can express the greedy, but it is sequential and only sensible for small inputs. Not executed here.

**Edge cases built into the tests.** No windows (`[]`); one window; windows touching at one minute; windows one minute apart; a long window that starts first (a start-ordered greedy fails); two overlapping windows (the latest moment, not the earliest); unsorted input. Hard: a zero-length window; identical windows; nested windows; an invalid window (`None`). Very Hard: a freeze over a window's end; a freeze starting one minute after a window starts; a freeze covering a whole window (`None`); overlapping and touching freezes; a moment moved by a freeze that no longer serves the next window; a freeze between windows.

**Common mistakes.** Sorting by start; testing coverage with `<` instead of `<=`; placing the moment at the start of the window (fewest, but not the latest schedule); not merging touching freezes, so the stepped-to minute is itself frozen; skipping a window because the previous moment is in its range without checking the moment is still allowed; raising instead of returning `None`.

**Follow-up guidance.** (1) Exchange argument as above, and "greedy stays ahead" for the latest schedule. (2) Several windows per customer, any one of which suffices, is hitting set over groups of intervals, which is NP-hard in general; in practice use the greedy on each customer's tightest window, then local improvement, or an ILP for small regions. (3) With capacity `c` per moment, earliest-end greedy that fills each moment with the `c` covered windows that end first (by a heap of active windows) is optimal for this "c-stabbing" variant; a strong candidate argues it, not just asserts it. (4) Keep windows in a sorted structure by end and recompute the greedy from the first changed window onwards; earlier moments are unaffected.

**Rubric anchors.** 2: correct count on simple cases but wrong order or wrong tie rule, or the list-removal version. 3: all tests pass with an O(n log n) greedy. 4: also proves optimality and latestness, and reasons well about multiple windows and capacity.

**Strong signals.** Picks the earliest-end window as the starting point and explains why; asks whether ends are inclusive. **Red flags.** Brute force over subsets; "pick the most popular minute" (a greedy that is not optimal).

## CRW-L1-05

**Reference solution**

```python reference
def burst_stretch(usage, reservation):
    best = None                  # (start, end, net)
    cur, start = 0, 0
    k, reserved = -1, 0          # index of the reservation step in force
    for h, used in enumerate(usage):
        while k + 1 < len(reservation) and reservation[k + 1][0] <= h:
            k += 1
            reserved = reservation[k][1]
        if used < 0:             # no reading: no run may cross this hour
            cur, start = 0, h + 1
            continue
        if cur <= 0:             # restart on zero too: the shortest run ending here
            cur, start = 0, h
        cur += used - reserved
        if best is None or cur > best[2] or (cur == best[2] and h - start < best[1] - best[0]):
            best = (start, h, cur)
    if best is None or best[2] <= 0:
        return None
    return best
```

**Explanation.** Kadane's scan. `cur` is the best total of a run ending at the current hour, and `start` where that run begins. Restarting when `cur <= 0` (not only when negative) means that among runs with the best total ending here, the latest start, i.e. the shortest run, is kept: a run with a zero-total prefix is never extended. Updating the answer only on a strictly larger total, or an equal total with a shorter run, keeps the earliest among equals because hours are visited in order. The reservation step in force advances with a pointer, 0 before the first step. A missing hour (Very Hard) resets the scan to start after it, so no run crosses it. If the best total is not positive, no hour burst and the answer is `None`.

**Complexity.** O(n + s) time for n hours and s reservation steps, O(1) extra memory. The timing test (52 560 hours) runs in about 0.02 s in CPython.

**The middle approach.** The most likely middle solution builds prefix sums and, for each start, takes `max(P[i + 1:]) - P[i]` (or a double loop over start and end). The slice-and-max version runs its inner loop in C but is still O(n²): about 1.4 × 10⁹ element visits, which took about 19 s in CPython on the timing test when timed for this template; the pure-Python double loop takes over a minute. Both fail the 8 s limit. A divide-and-conquer O(n log n) maximum subarray passes and is acceptable if the tie rule is handled, which is fiddly.

**Dialect notes.** In Java use `long` for totals (six years of hours times hundreds of GPUs is far from overflow, but say so). In SQL the classic answer is a running sum and a running minimum of earlier prefix sums: `SUM(net) OVER (ORDER BY hour)` minus `MIN(prefix) OVER (ORDER BY hour ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`, which gives the best total per end hour; the tie rule and missing hours need extra columns. Not executed here.

**Edge cases built into the tests.** No hour above the reservation and usage exactly at it (`None`); every hour above (the whole range); a single hour; a dip worth bridging; a dip too deep (two equal single-hour runs: the earlier); equal totals of different lengths (the shorter); zero-net hours around a burst (left out); a burst at the end. Hard: hours before the first step (all usage is on demand); a step up that ends a burst; a step down that starts one. Very Hard: a missing hour splitting a run; a missing hour that must not be read as zero; only missing and quiet hours (`None`).

**Common mistakes.** Restarting only on a negative total (returns the longer run on ties); `>=` when updating the answer (returns the latest of equal runs); returning `(0, -1, 0)` or a zero-total run instead of `None`; looking up the reservation with a scan per hour (O(n·s), fine here but worth noticing); treating `-1` as usage or as zero; off-by-one inclusive end.

**Follow-up guidance.** (1) For a fixed end, the best total ending there is the total minus the smallest earlier prefix; restarting on a non-positive total chooses the latest prefix achieving that minimum, hence the shortest run. (2) At most L hours: best total per end = prefix minus the minimum prefix in the last L positions, a monotonic deque, O(n). (3) Per customer: the current run's total and start, and the best so far, a few integers each, updated per hour. (4) Repeatedly take the best run and exclude it, or a DP over (hour, runs used); a strong candidate notes that greedy removal is not always optimal for k > 1.

**Rubric anchors.** 2: an O(n²) scan, or Kadane with the wrong tie behaviour or no `None`. 3: all tests pass in O(n). 4: also proves the tie rule and handles the bounded-length and streaming follow-ups well.

**Strong signals.** Asks what to return when nothing bursts and how ties break before coding; tests with zero-net hours. **Red flags.** Sorting the hours; "the hours above the reservation, added up", which is not consecutive.
