# Amazon · Loop 1 — evaluator notes (hidden from candidates)

## AMZ-L1-01

**Reference solution** (PostgreSQL; `{{group_col}}` is the instance's grouping column, `ship_method` or `fc_id`)

```sql reference
WITH first_delivered AS (
  SELECT package_id, MIN(scanned_at) AS delivered_at
  FROM package_scans
  WHERE scan_type = 'DELIVERED'
  GROUP BY package_id
), per_order AS (
  SELECT o.order_id, o.{{group_col}} AS grp, o.promised_date,
         COUNT(p.package_id)   AS packages,
         COUNT(f.delivered_at) AS delivered_packages,
         MAX((f.delivered_at AT TIME ZONE o.dest_tz)::date) AS delivered_local_date
  FROM orders o
  LEFT JOIN packages p        ON p.order_id = o.order_id
  LEFT JOIN first_delivered f ON f.package_id = p.package_id
  GROUP BY o.order_id, o.{{group_col}}, o.promised_date
), judged AS (
  SELECT grp, promised_date, delivered_local_date,
         CASE WHEN packages = 0 OR delivered_packages < packages THEN 'undelivered'
              WHEN delivered_local_date <= promised_date        THEN 'on_time'
              ELSE 'late' END AS outcome
  FROM per_order
)
SELECT promised_date,
       grp AS {{group_col}},
       COUNT(*)                                       AS orders,
       COUNT(*) FILTER (WHERE outcome = 'on_time')    AS on_time,
       COUNT(*) FILTER (WHERE outcome = 'late')       AS late,
       COUNT(*) FILTER (WHERE outcome = 'undelivered') AS undelivered,
       ROUND(100.0 * COUNT(*) FILTER (WHERE outcome = 'on_time') / COUNT(*), 1) AS on_time_pct,
       MAX(delivered_local_date - promised_date) FILTER (WHERE outcome = 'late') AS max_days_late
FROM judged
GROUP BY promised_date, grp
ORDER BY promised_date, grp;
```

**Explanation.** The grain of the scorecard is the order, so scans are reduced to one delivery instant per package (the first `DELIVERED` scan; attempts and re-synced repeats do not count), and packages to one row per order: how many packages, how many delivered, and the latest local delivery date. LEFT JOINs from `orders` keep orders that have no packages yet and packages that have no delivery. Each delivery is converted to the destination's local date with `AT TIME ZONE dest_tz` before taking the date: on a `timestamptz` that yields the local wall-clock time, DST included. An order is undelivered unless every package is delivered; otherwise its last package decides on time versus late. `100.0 *` forces numeric division; `ROUND(numeric, 1)` rounds half away from zero. `max_days_late` is a date difference in whole days and is NULL when the filter matches no row.

**Complexity.** One aggregate over scans (filtered to `DELIVERED`), two hash joins and two hash aggregates: linear in the input. At scale, keep a per-package delivery fact (first delivered instant) maintained as scans arrive, and an order-level fact keyed by `order_id`.

**Dialect notes.** Not executed here. Snowflake: `CONVERT_TIMEZONE(dest_tz, delivered_at)::date`; no `FILTER`, use `COUNT_IF(...)`; `DATEDIFF('day', promised_date, local_date)`. BigQuery: `DATE(delivered_at, dest_tz)` gives the local date directly; `COUNTIF`; `DATE_DIFF(local_date, promised_date, DAY)`; `ROUND` rounds half away from zero. Spark SQL: `to_date(from_utc_timestamp(delivered_at, dest_tz))`; `count_if`; `datediff`. MySQL 8: `CONVERT_TZ(delivered_at, '+00:00', dest_tz)` needs the time-zone tables loaded, otherwise it returns NULL; no `FILTER`.

**Edge cases built into the data.** Evening deliveries that are the next UTC day but on time locally (all levels); late orders by one to three days; Hard: multi-package orders with one late package, orders with a package that never arrived, multi-package orders all on time; Very Hard: a `DELIVERY_ATTEMPTED` scan on the promised date followed by a late delivery, a repeated `DELIVERED` scan days later, orders with no packages, zones without DST (Phoenix, Honolulu) and promise dates across a DST change.

**Common mistakes.** `delivered_at::date` (the session's UTC date); judging an order by its first package; counting an order as on time when the delivered packages were on time and one is missing; counting attempts as deliveries; `MAX(scanned_at)` over DELIVERED scans; an INNER JOIN that drops unshipped orders; integer division in the percentage; counting packages instead of orders.

**Follow-up guidance.** (1) Only score promises whose date has passed in the destination's zone (or label future promises "open"); keep "undelivered, promise not yet due" out of the denominator. (2) Quarantine and count them visibly; never default to UTC silently, because the bias concentrates in evening deliveries in western zones. A strong answer reports the share excluded next to the metric. (3) A per-package delivery fact upserted from scans, then an order fact; late uploads correct the package row and the order's promised-date partition is recomputed. (4) A package-grain fact with the order key, plus an order-grain fact; per-package metrics weight split orders more, so name the grain in the metric definition.

**Rubric anchors.** 2: right shape but UTC dates or package-level judgement. 3: matches the expected result. 4: also explains why the local date is the business definition and how to keep future promises out of the denominator.

**Strong signals.** Asks which calendar the promise uses before writing SQL; states the order grain; asks what an attempt means. **Red flags.** Converting with a fixed offset per zone (wrong across DST); `DISTINCT` to hide fan-out; dropping undelivered orders "because they are not late yet".

## AMZ-L1-02

**Reference solution** (PostgreSQL; `{{min_hours}}` and `{{as_of}}` are the instance's values)

```sql reference
WITH ordered AS (
  SELECT s.*,
         ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY scanned_at, scan_id) AS rn
  FROM package_scans s
), bounds AS (
  SELECT package_id,
         MIN(rn) FILTER (WHERE scan_type <> 'LABEL_CREATED') AS first_rn,
         MIN(rn) FILTER (WHERE scan_type = 'DELIVERED')      AS delivered_rn
  FROM ordered
  GROUP BY package_id
), kept AS (
  SELECT o.package_id, o.rn, o.facility_id, o.scanned_at,
         b.delivered_rn IS NOT NULL AS delivered
  FROM ordered o
  JOIN bounds b ON b.package_id = o.package_id
  WHERE b.first_rn IS NOT NULL
    AND o.rn >= b.first_rn
    AND (b.delivered_rn IS NULL OR o.rn <= b.delivered_rn)
), gaps AS (
  SELECT package_id, delivered, rn, facility_id,
         scanned_at AS gap_started_at,
         COALESCE(LEAD(scanned_at) OVER (PARTITION BY package_id ORDER BY rn),
                  CASE WHEN NOT delivered THEN TIMESTAMPTZ '{{as_of}}' END) - scanned_at AS gap
  FROM kept
), longest AS (
  SELECT DISTINCT ON (package_id) package_id, delivered, gap_started_at, facility_id, gap
  FROM gaps
  WHERE gap IS NOT NULL
  ORDER BY package_id, gap DESC, rn
)
SELECT package_id, delivered, gap_started_at, facility_id,
       ROUND(EXTRACT(EPOCH FROM gap) / 3600, 2) AS gap_hours
FROM longest
WHERE gap >= INTERVAL '{{min_hours}} hours'
ORDER BY gap DESC, package_id;
```

**Explanation.** A deterministic row number per package (`scanned_at`, then `scan_id`) turns "the first carrier scan" and "the first DELIVERED scan" into two integers, and the counted scans are the rows between them. `LEAD` over those rows gives the end of each silence; for an undelivered package the last row has no next scan, so its silence runs to `as_of`, while for a delivered package the DELIVERED row's NULL gap is dropped. A package with only `LABEL_CREATED` has no first carrier scan and is excluded. `DISTINCT ON` keeps the longest silence per package, the earliest on ties (by row number). Interval comparison is exact; `EXTRACT(EPOCH …)` returns numeric seconds in PostgreSQL 14 and later, so the rounding is exact too.

**Complexity.** One sort per package for the row numbers and the LEAD (they share the order), a small aggregate and a DISTINCT ON sort: O(n log n). Incrementally, each package needs only its last counted scan, its longest silence so far and whether it has been delivered.

**Dialect notes.** Not executed here. Snowflake and BigQuery: no `DISTINCT ON` (use `QUALIFY ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY gap DESC, rn) = 1`) and no `FILTER` (`MIN(IFF(...))` / `MIN(IF(...))`); gaps as `DATEDIFF('second', a, b)` or `TIMESTAMP_DIFF(b, a, SECOND)` integers instead of intervals. Spark SQL: `lead` and `row_number` as here; `unix_timestamp(b) - unix_timestamp(a)`. MySQL 8: window functions supported; `TIMESTAMPDIFF(SECOND, a, b)`; no `DISTINCT ON`.

**Edge cases built into the data.** Label-to-pickup waits longer than the threshold (must not count); a silence of exactly the threshold (reported) and one just under (not reported); Hard: return pickups days after delivery, two equal longest silences at different facilities (the earlier wins), duplicate scans at the same second; Very Hard: undelivered packages whose open silence to `as_of` is the longest, undelivered packages scanned recently, and packages with only a label.

**Common mistakes.** Including `LABEL_CREATED`; running LEAD over every scan (so the return pickup or the label wait becomes the longest silence); reporting the facility of the scan after the silence; `ORDER BY scanned_at` without the `scan_id` tie-break; reporting the later of two equal silences; forgetting the open silence of undelivered parcels; `max - min` of the whole journey instead of consecutive gaps; a strict `>` threshold.

**Follow-up guidance.** (1) Per package: last counted scan time and facility, delivered flag; a timer (or a periodic scan of a "last seen" index) fires when `now - last_scan ≥ threshold`. (2) Compare against the facility's own scan heartbeat: if the facility has uploaded nothing either, the parcel's silence is the facility's, not the parcel's; batch-upload delay should be measured as `ingested_at - scanned_at`. (3) Expected silence per leg type (from history, e.g. a high percentile per origin, destination and leg) and alert on the ratio, not a global threshold. (4) Partition by scan date, cluster by package id; restrict to packages with a scan in the last N days and not yet delivered.

**Rubric anchors.** 2: consecutive gaps computed but over the wrong range of scans or with the wrong facility. 3: matches the expected result. 4: also designs the streaming state and separates facility outages from stuck parcels.

**Strong signals.** Asks who owns the parcel before the first carrier scan and what happens after delivery; asks about same-second scans. **Red flags.** A self-join that matches every later scan (quadratic and ambiguous on ties); treating the whole journey time as the silence.

## AMZ-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH items AS (
  SELECT account_id, usage_date, cost_cents,
         NULLIF(LOWER(TRIM(team)), '') AS team
  FROM cur_line_items
  WHERE line_item_type = 'Usage'
), tagged AS (
  SELECT account_id, usage_date, team, SUM(cost_cents)::bigint AS direct
  FROM items
  WHERE team IS NOT NULL
  GROUP BY account_id, usage_date, team
), pool AS (
  SELECT account_id, usage_date, SUM(cost_cents)::bigint AS pool
  FROM items
  WHERE team IS NULL
  GROUP BY account_id, usage_date
), shares AS (
  SELECT t.account_id, t.usage_date, t.team, t.direct,
         COALESCE(p.pool, 0) AS pool,
         SUM(t.direct) OVER (PARTITION BY t.account_id, t.usage_date)::bigint AS day_tagged
  FROM tagged t
  LEFT JOIN pool p ON p.account_id = t.account_id AND p.usage_date = t.usage_date
), floored AS (
  SELECT *, (pool * direct) / day_tagged AS base,
            (pool * direct) % day_tagged AS remainder
  FROM shares
), ranked AS (
  SELECT *,
         pool - SUM(base) OVER (PARTITION BY account_id, usage_date) AS leftover,
         ROW_NUMBER() OVER (PARTITION BY account_id, usage_date ORDER BY remainder DESC, team) AS rk
  FROM floored
), allocated AS (
  SELECT account_id, team, direct,
         base + CASE WHEN rk <= leftover THEN 1 ELSE 0 END AS allocated
  FROM ranked
  UNION ALL
  SELECT p.account_id, 'unallocated', 0, p.pool
  FROM pool p
  WHERE NOT EXISTS (SELECT 1 FROM tagged t
                    WHERE t.account_id = p.account_id AND t.usage_date = p.usage_date)
)
SELECT account_id, team,
       SUM(direct)             AS direct_cents,
       SUM(allocated)          AS allocated_cents,
       SUM(direct + allocated) AS total_cents
FROM allocated
GROUP BY account_id, team
ORDER BY account_id, team;
```

**Explanation.** Normalise first: usage lines only, tag `LOWER(TRIM(…))`, empty string as NULL. Then two aggregates per `(account, day)`: tagged cost per team and the untagged pool. For each team, `pool * direct / day_tagged` on BIGINTs is floor division (all values are non-negative) and `%` the remainder. The casts matter: in PostgreSQL `SUM(bigint)` returns `numeric`, and numeric `/` does not truncate, so without `::bigint` every share silently becomes a fraction of a cent. The pool minus the sum of the floors is the number of leftover cents (always less than the number of teams); `ROW_NUMBER()` over `(remainder DESC, team)` hands them out one each, so every pool is allocated exactly. A pool with no tagged usage that day has nobody to follow and is reported as `'unallocated'` (the UNION ALL branch). Finally add each team's days up. Integers throughout: no floating point ever touches money.

**Complexity.** Two aggregates over the line items, a join on `(account, day)` and two window sorts over (teams × days): linear in the line items plus O(k log k) per pool. At scale, materialise the daily `(account, day, team)` tagged cost and the daily pool; the allocation runs on that small table.

**Dialect notes.** Not executed here. Integer division differs: BigQuery `/` returns FLOAT64 (use `DIV(pool * direct, day_tagged)` and `MOD`); Snowflake `/` returns a decimal (use `FLOOR(pool * direct / day_tagged)` or `TRUNC`, and `MOD`); Spark SQL `/` returns double (use `div` and `%`); MySQL uses `DIV` and `MOD`. `ROW_NUMBER()` and window sums are the same everywhere. `NULLIF(LOWER(TRIM(team)), '')` is portable.

**Edge cases built into the data.** Pools that leave one or more cents over (all levels); Hard: several days per account (daily pools differ from a monthly split), a pool with three equal teams and one or two leftover cents (the tie-break decides), credit and tax lines; Very Hard: tag values with stray spaces and capitals, empty-string tags (untagged), and a day on which an account has only untagged usage (`'unallocated'`).

**Common mistakes.** Forgetting that `SUM(bigint)` is `numeric` in PostgreSQL, so `/` stops being floor division; `ROUND(pool * direct / tagged)` per team (does not sum to the pool); floating-point division; dropping the leftover cents; `RANK()` (ties share a rank and both get a cent, over-allocating); splitting the whole period at once; including credits or tax; comparing raw tag strings; losing pools with no tagged usage; forgetting that the pool's own account bounds its teams.

**Follow-up guidance.** (1) Late line items (and restated ones) change a past day's pool or weights; keep the allocation per day and per report version, recompute changed days only, and publish month-close numbers from a frozen version. (2) Drivers such as bytes transferred, request counts or vCPU-hours need usage metrics joined at the same grain; a strong answer names the data each needs and the gaming risk. (3) Daily `(account, day, team)` tagged cost and `(account, day)` pool tables, partitioned by day; the allocation is a small job over those. (4) Allocate in stages over a DAG (shared → platform teams → product teams); a cycle means the stage order is undefined, so the model must forbid it or solve it as a linear system.

**Rubric anchors.** 2: proportional split with rounding errors (totals do not match the pool). 3: matches the expected result. 4: also explains why largest remainder is fair and how to make the allocation reproducible after late data.

**Strong signals.** Asks whether the allocation is per day or per month and what to do with pools nobody can follow; checks that allocations sum to the pool. **Red flags.** "Off by a cent doesn't matter" (finance reconciles to the cent); allocating across accounts.

## AMZ-L1-04

**Reference solution**

```python reference
from collections import defaultdict

def on_demand_unit_seconds(usages, commitments):
    deltas = defaultdict(lambda: defaultdict(int))   # family -> time -> change in (used - committed)
    result = {}
    for start, end, family, units in usages:
        result[family] = 0
        if end > start:
            deltas[family][start] += units
            deltas[family][end] -= units
    for start, end, family, units in commitments:
        if family in result and end > start:
            deltas[family][start] -= units
            deltas[family][end] += units
    for family, changes in deltas.items():
        level, prev, total = 0, None, 0     # level = used(t) - committed(t) on the current stretch
        for t in sorted(changes):
            if prev is not None and level > 0:
                total += level * (t - prev)
            level += changes[t]
            prev = t
        result[family] = total
    return result
```

**Explanation.** On-demand usage is the positive part of `used − committed`, and that difference only changes at interval endpoints. Each usage contributes `+units` at its start and `−units` at its end; a commitment the opposite. Summing changes per (family, time) applies every change at a time at once, so the order of a stop and a start at the same second is irrelevant and half-open intervals come out right. Walking the sorted times, the difference is constant between consecutive times; its positive part times the gap is that stretch's on-demand amount. Families are independent; families with only commitments never enter `result`; a zero-length usage enters `result` with no change.

**Complexity.** O((n + c) log(n + c)) for the sort, O(n + c) memory. A per-second loop is O(horizon) per family (about 126 million seconds in the timing test, and an array that large); rescanning every usage for every elementary interval is O(n²).

**Common mistakes.** Closed intervals (a back-to-back pair counted as overlapping for one second); clamping per interval instead of per moment (`max(0, units − commitment)` for each usage separately); allowing negative contributions (banking spare commitment); processing a start before a stop at the same second and integrating in between; dropping zero-length usages' families; reporting commitment-only families; mixing families in one sweep.

**Follow-up guidance.** (1) The sweep yields, for each value of `used`, the total time it held; cost(C) = commitment price × C × period + on-demand price × Σ time × max(0, used − C). It is convex in C, so evaluate it at the distinct `used` levels (or ternary search). (2) Partition by family (and time bucket); each worker emits per-bucket change events; one reducer per family sorts and sweeps, with intervals split at bucket boundaries. (3) Normalise usage into the commitment's units with a ratio per family; the state becomes one shared pool consumed by several families, which needs an allocation order. (4) SQL can produce the change events and even the running sum (`SUM(delta) OVER (ORDER BY t)`) and the integral with `LEAD(t)`; what it cannot do cheaply is anything that depends on the order of allocation across families.

**Rubric anchors.** 2: correct on samples but per-second or quadratic, or a boundary error. 3: correct and O(n log n) with all same-time changes applied before integrating. 4: also derives the optimal commitment level from the sweep.

**Strong signals.** Asks whether intervals are half-open and whether spare commitment carries over before coding. **Red flags.** A per-second array without noticing the horizon; claiming the answer is `total usage − total commitment`.

## AMZ-L1-05

**Reference solution**

```python reference
import heapq

def assign_doors(trailers, doors):
    arrivals = sorted(trailers)                  # by arrival minute; the yard heap decides ties
    free = list(range(1, doors + 1))             # heap of free door numbers (already a heap)
    busy = []                                    # heap of (end_min, door)
    yard = []                                    # heap of (priority, arrival_min, trailer_id, unload_min)
    out = {}
    i, n, now = 0, len(arrivals), None
    while i < n or yard:
        if not yard:
            now = arrivals[i][0] if now is None else max(now, arrivals[i][0])
        elif not free:
            now = busy[0][0]
        while busy and busy[0][0] <= now:
            heapq.heappush(free, heapq.heappop(busy)[1])
        while i < n and arrivals[i][0] <= now:
            arrival, tid, unload, prio = arrivals[i]
            heapq.heappush(yard, (prio, arrival, tid, unload))
            i += 1
        while free and yard:
            _, _, tid, unload = heapq.heappop(yard)
            door = heapq.heappop(free)
            out[tid] = (door, now)
            heapq.heappush(busy, (now + unload, door))
    return out
```

**Explanation.** Time jumps between the only moments that matter. After every assignment round, either no door is free or the yard is empty. If the yard is empty, the next decision is at the next arrival; if it is not, the next decision is when the next door frees up (arrivals before then simply join the yard). At each moment the code first frees every door whose unload has ended (so a door freed at `t` is usable at `t`), then admits every trailer that has arrived by `t` (so an urgent trailer arriving at `t` competes), then assigns while a door and a trailer are both available: the yard heap gives the first trailer by `(priority, arrival, trailer_id)` and the free-door heap gives the lowest door number. Trailer ids are unique, so heap tuples never compare the unload field.

**Complexity.** Each trailer is pushed and popped once from the yard, and each assignment pushes and pops one door from each door heap: O(n log n + n log d), O(n + d) memory. Scanning the yard for the next trailer is O(yard) per assignment; the timing test's yard reaches tens of thousands of trailers. Scanning all doors per assignment is O(d) each.

**Common mistakes.** Freeing doors after admitting or assigning (a door freed at `t` sits idle until the next event); admitting only the trailers that arrived strictly before `t`; first-come-first-served ignoring priority, or priority without the arrival tie-break; taking any free door instead of the lowest number; relying on the input being sorted; stepping minute by minute; preempting an unload in progress.

**Follow-up guidance.** (1) Record `start − arrival` per trailer; the mean is a running sum; an exact 95th percentile needs the waits (or a sort per priority at the end), and a streaming answer accepts an approximate quantile sketch with a stated error. (2) One free-door heap per door type; a trailer that fits several types takes the earliest/lowest across the heaps it fits. (3) Aging: effective priority improves with waiting time; in a heap that means either periodic re-keying or a key such as `arrival + weight × priority` that does not change over time. (4) Sites are independent: one task per site (embarrassingly parallel), store per-trailer assignments partitioned by site and season for analysis.

**Rubric anchors.** 2: right outputs on samples but stepping minutes or scanning the yard. 3: correct and O(n log n) with all three heaps. 4: also a sound answer on door types or aging.

**Strong signals.** Asks what happens when a door frees and a trailer arrives at the same minute, and whether urgent trailers preempt. **Red flags.** A single sorted list re-sorted after every arrival; "just add more doors" when asked about starvation.
