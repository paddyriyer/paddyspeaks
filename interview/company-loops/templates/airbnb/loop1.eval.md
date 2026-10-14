# Airbnb · Loop 1 — evaluator notes (hidden from candidates)

## ABB-L1-01

**Reference solution** (PostgreSQL; `{{start_date}}` and `{{end_date}}` are the instance's window)

```sql reference
WITH nights AS (                      -- one row per listing per listed night inside the window
  SELECT l.listing_id, l.city, g.night::date AS night
  FROM listings l
  CROSS JOIN LATERAL generate_series(
         GREATEST(l.listed_from, DATE '{{start_date}}'),
         LEAST(COALESCE(l.listed_until, DATE '{{end_date}}'), DATE '{{end_date}}') - 1,
         interval '1 day') AS g(night)
), marked AS (
  SELECT n.city,
         date_trunc('month', n.night)::date AS month,
         EXISTS (SELECT 1 FROM reservations r
                 WHERE r.listing_id = n.listing_id AND r.status = 'confirmed'
                   AND r.check_in <= n.night AND n.night < r.check_out) AS booked,
         EXISTS (SELECT 1 FROM calendar_blocks b
                 WHERE b.listing_id = n.listing_id
                   AND b.start_date <= n.night AND n.night < b.end_date) AS blocked
  FROM nights n
)
SELECT city, month,
       COUNT(*) FILTER (WHERE booked)                AS booked_nights,
       COUNT(*) FILTER (WHERE booked OR NOT blocked) AS available_nights,
       ROUND(COUNT(*) FILTER (WHERE booked)::numeric
             / COUNT(*) FILTER (WHERE booked OR NOT blocked), 4) AS occupancy
FROM marked
GROUP BY city, month
HAVING COUNT(*) FILTER (WHERE booked OR NOT blocked) > 0
ORDER BY city, month;
```

**Explanation.** The unit of occupancy is a listing-night, so the query builds exactly those: each listing's listed range clipped to the window, one row per night. Stays that cross a month boundary or the window's edges then need no special handling: each night lands in its own month, and nights outside the window were never generated. Two `EXISTS` checks mark each night: booked by a confirmed reservation (half-open), blocked by any block (also half-open, and `EXISTS` counts a night once however many blocks cover it). The denominator is `booked OR NOT blocked`, which is the Very Hard rule (a booked night is available whatever blocks cover it) and is harmless below it. Grouping the night grid, rather than joining reservations to a list of months, keeps city-months with no bookings.

**Complexity.** O(listing-nights × (reservations + blocks per listing)) as written; with an index on `(listing_id, check_in)` each `EXISTS` is a short range probe. The grid is the cost: a year of a large market is tens of millions of rows. An interval formulation (`LEAST(check_out, month_end) − GREATEST(check_in, month_start)` per stay and month, minus the blocked-and-not-booked nights computed from merged blocks) avoids expanding nights and is what follow-up 1 is after.

**Dialect notes** (described, not executed). BigQuery: `GENERATE_DATE_ARRAY(start, end - 1)` with `UNNEST`, `DATE_TRUNC(night, MONTH)`, `COUNTIF`. Snowflake: no `generate_series`; join to a calendar table or `TABLE(GENERATOR(ROWCOUNT => n))` with `DATEADD`, `COUNT_IF`, `DATE_TRUNC('month', night)`. Spark SQL: `explode(sequence(start, end - 1, interval 1 day))`, `count_if`. MySQL 8: a recursive CTE or a calendar table; `SUM(CASE …)`.

**Edge cases built into the data.** A stay across the window's first edge (every level); stays across month boundaries and past the window's end; cancelled reservations overlapping confirmed ones; a city whose later months have availability and no bookings (occupancy 0). Hard: a listing that goes live inside the window and one that goes live after it; overlapping blocks; a window across a year boundary. Very Hard: listings unlisted inside the window (`listed_until` exclusive); blocks that cover booked nights.

**Common mistakes.** Crediting a whole stay to its check-in month; counting the check-out night; counting cancelled reservations; leaving blocked nights in the denominator, or subtracting overlapping blocks twice (summing block lengths); dropping zero-booking months with an inner join; ignoring `listed_from` / `listed_until`; removing blocked-but-booked nights from available (occupancy above the truth, can exceed 1 conceptually); integer division.

**Follow-up guidance.** (1) Per month, booked nights = Σ over confirmed stays of `max(0, LEAST(check_out, month_end, listed_end) − GREATEST(check_in, month_start, listed_start))`; available = listed nights − (merged block nights not covered by a booking), which needs interval merging per listing (a window function over sorted blocks) but no night grid. (2) Restating is right for an occupancy figure; publish with an "as of" date, keep the history of published numbers, and flag months that moved. (3) Name each definition explicitly (occupancy_available_nights vs occupancy_calendar_nights), keep definitions in one versioned metric layer, and show the definition next to the number. (4) Exclude 0 / 0 listing-months from the city average (they have no denominator) and report them separately; for small cities show the number of listings and consider a minimum.

**Rubric anchors.** 2: right for stays inside one month but whole stays credited to check-in months, or blocked nights in the denominator. 3: matches the expected result. 4: also gives the interval formulation and handles restatement and definitions credibly.

**Strong signals.** Says "night" and "half-open" before writing SQL; asks what a blocked-but-booked night means; checks a row with zero bookings exists. **Red flags.** `SUM(check_out - check_in)` grouped by check-in month; `BETWEEN check_in AND check_out` (closed on both ends).

## ABB-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH first_cancel AS (                -- the earliest cancellation event decides the notice
  SELECT booking_id, MIN(cancelled_at) AS cancelled_at
  FROM cancellations
  GROUP BY booking_id
), c AS (
  SELECT b.booking_id, b.policy, b.booked_at, b.check_in, b.nights,
         b.nightly_cents, b.cleaning_cents, b.service_fee_cents, f.cancelled_at,
         FLOOR(EXTRACT(EPOCH FROM b.check_in - f.cancelled_at) / 86400)::int AS days_before,
         f.cancelled_at < b.check_in AS before_check_in
  FROM bookings b
  JOIN first_cancel f ON f.booking_id = b.booking_id
), tier AS (                          -- the most generous tier that applies
  SELECT DISTINCT ON (c.booking_id)
         c.booking_id, t.nightly_refund_pct, t.service_fee_refunded
  FROM c
  JOIN policy_tiers t ON t.policy = c.policy
  WHERE CASE WHEN c.before_check_in
             THEN c.days_before >= t.min_notice_days
                  AND (t.max_hours_after_booking IS NULL
                       OR c.cancelled_at <= c.booked_at + make_interval(hours => t.max_hours_after_booking))
             ELSE t.min_notice_days = 0 AND t.max_hours_after_booking IS NULL
        END
  ORDER BY c.booking_id, t.nightly_refund_pct DESC
)
SELECT c.booking_id, c.policy, c.days_before, t.nightly_refund_pct,
       ( (CASE WHEN c.before_check_in THEN c.nights
               ELSE GREATEST(c.nights - (FLOOR(EXTRACT(EPOCH FROM c.cancelled_at - c.check_in) / 86400)::int + 1), 0)
          END)::bigint * c.nightly_cents * t.nightly_refund_pct + 50 ) / 100
       + CASE WHEN c.before_check_in
              THEN c.cleaning_cents + CASE WHEN t.service_fee_refunded THEN c.service_fee_cents ELSE 0 END
              ELSE 0 END AS refund_cents
FROM c
JOIN tier t ON t.booking_id = c.booking_id
ORDER BY c.booking_id;
```

**Explanation.** One cancellation per booking first: the earliest `cancelled_at`, because a retried request logged later does not change when the guest cancelled (event ids are not time order). Notice is computed from the instants, `floor(seconds / 86400)`, so "at least N days" is exactly `days_before >= N`, inclusive at the boundary second. The rules stay in the table: the booking joins every tier of its policy that applies and `DISTINCT ON … ORDER BY pct DESC` keeps the most generous; the grace tier simply has one more condition (`cancelled_at <= booked_at + max_hours`). Money is integer arithmetic: `(cents × pct + 50) / 100` is half-up rounding for non-negative amounts. Very Hard: at or after check-in, nights whose start (`check_in + k days`) is at or before `cancelled_at` are spent; the rest are refunded at the base tier, without fees.

**Complexity.** One aggregate over cancellations, a join to a handful of tiers per booking and one sort: O(n log n). Tiny in practice; the value is in the rules being data.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_DIFF(check_in, cancelled_at, SECOND)` and `DIV(…, 86400)` (careful: `DIV` truncates toward zero, so use `FLOOR(x / 86400)` for negative notice), `QUALIFY ROW_NUMBER() … = 1`, `TIMESTAMP_ADD(booked_at, INTERVAL h HOUR)`. Snowflake: `DATEDIFF('second', …)`, `QUALIFY`, `DATEADD(hour, h, booked_at)`; `DATEDIFF('day', …)` counts calendar-day boundaries, not 24-hour periods, so it gives the wrong notice. Spark SQL: `unix_timestamp` differences, `row_number()` in a subquery. MySQL 8: `TIMESTAMPDIFF(SECOND, …)`, `ROW_NUMBER()` in a CTE, `DIV` for integer division.

**Edge cases built into the data.** Cancellations exactly N days before check-in and one second later, for two policies (every level); an odd nightly price at a 50% tier, so the refund has half a cent; bookings never cancelled. Hard: the strict grace tier exactly 48 hours after booking (applies), one second later (does not), and within 48 hours but too close to check-in; two cancellation events per booking, the later-logged one earlier in time. Very Hard: mid-stay cancellations, one exactly at check-in (night 1 begun), one exactly when night 3 begins, one after check-out (nothing left).

**Common mistakes.** Calendar-date differences (`check_in::date - cancelled_at::date`) instead of 24-hour periods; `>` at the boundary; the latest or the lowest-`event_id` cancellation; a hand-written CASE that ignores the tier table; ignoring `max_hours_after_booking`, or applying the grace tier on notice alone; dropping the cleaning fee or always refunding the service fee; floating-point percentages and `ROUND` on a float; mid-stay refunds counting the night that begins exactly at the cancellation as unspent.

**Follow-up guidance.** (1) The policy in force at booking time must be snapshotted on the booking (policy id and version), not joined from the listing's current setting. (2) The amount owed is fixed in the currency the guest paid, at booking; any later conversion is a payout concern recorded with its own rate. (3) A refunds ledger with one row per refund event (type: policy, partial, goodwill; amount; currency; reference to the booking) reconciled against an "owed" view like this one. (4) Effective-dated tiers (`valid_from`, `valid_to`) or a policy version id referenced from the booking; never edit a tier in place.

**Rubric anchors.** 2: right for simple cases but calendar-date notice, a hard-coded CASE or the wrong cancellation event. 3: matches the expected result. 4: also snapshots policies on bookings, fixes the currency of the obligation and versions the rules.

**Strong signals.** Reads the boundary semantics back ("at least 7 days means 168 hours or more"); keeps the rules in the table; integer cents throughout. **Red flags.** Quoting a real marketplace's policy as fact; floats for money.

## ABB-L1-03

**Reference solution** (PostgreSQL; the window and floor are the instance's values)

```sql reference
WITH scope AS (                       -- inquiries in the reporting window, with their host
  SELECT i.inquiry_id, i.listing_id, i.created_at, l.host_id
  FROM inquiries i
  JOIN listings l ON l.listing_id = i.listing_id
  WHERE i.created_at >= TIMESTAMPTZ '{{window_start}}'
    AND i.created_at <  TIMESTAMPTZ '{{window_end}}'
), host_side AS (                     -- who may answer for a listing
  SELECT listing_id, host_id AS user_id FROM listings
  UNION
  SELECT listing_id, user_id FROM listing_cohosts
), first_reply AS (
  SELECT m.inquiry_id, MIN(m.sent_at) AS replied_at
  FROM messages m
  JOIN inquiries i ON i.inquiry_id = m.inquiry_id
  JOIN host_side h ON h.listing_id = i.listing_id AND h.user_id = m.sender_id
  WHERE NOT m.is_automated
  GROUP BY m.inquiry_id
), resp AS (
  SELECT s.host_id,
         EXTRACT(EPOCH FROM f.replied_at - s.created_at) / 60 AS minutes   -- NULL if unanswered
  FROM scope s
  LEFT JOIN first_reply f ON f.inquiry_id = s.inquiry_id
)
SELECT host_id,
       COUNT(*)                                   AS inquiries,
       COUNT(minutes)                             AS answered,
       COUNT(*) FILTER (WHERE minutes <= 1440)    AS within_24h,
       ROUND(COUNT(*) FILTER (WHERE minutes <= 1440)::numeric / COUNT(*), 4) AS share_within_24h,
       ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes))::numeric, 1) AS median_response_minutes
FROM resp
GROUP BY host_id
HAVING COUNT(*) >= {{min_inquiries}}
ORDER BY host_id;
```

**Explanation.** The grain is the inquiry: each gets its host and the time of its first qualifying reply, or NULL. The qualifying filter (host side, not automated) is applied before `MIN`, so a guest's follow-up or an instant automated message can never be the "first reply". The `LEFT JOIN` keeps unanswered inquiries, which belong in `inquiries` and in the share's denominator but not in the median; `COUNT(minutes)` and `PERCENTILE_CONT` both skip NULLs, which is exactly that. `PERCENTILE_CONT(0.5)` interpolates, so an even count gives the average of the two middle values. The window filters on `created_at` only; replies are searched without a time bound, so a late reply to an in-window inquiry still counts. At Medium the window spans every inquiry and the floor is 1; below Very Hard `listing_cohosts` is empty, so the host side is the host.

**Complexity.** One pass over messages with a hash join to the host side, one aggregate per inquiry and one per host: O(m + n log n) for the median's sort per host. At scale the per-inquiry first-reply table is the reusable intermediate.

**Dialect notes** (described, not executed). BigQuery: `PERCENTILE_CONT(minutes, 0.5) OVER (PARTITION BY host_id)` is analytic only, so take it in a subquery (or `APPROX_QUANTILES` for an approximation); `TIMESTAMP_DIFF(…, MINUTE)`; `COUNTIF`. Snowflake: `MEDIAN(minutes)` or `PERCENTILE_CONT(0.5) WITHIN GROUP`, `DATEDIFF('minute', …)` (counts minute boundaries; exact here because times are whole minutes). Spark SQL: `percentile(minutes, 0.5)` interpolates like `PERCENTILE_CONT`; `percentile_approx` does not. MySQL 8: no median aggregate; rank rows with `ROW_NUMBER()` and `COUNT(*) OVER` and average the middle one or two.

**Edge cases built into the data.** Automated replies within a minute (sometimes the only host-side messages); guest follow-ups before the reply; a reply at exactly 1440 minutes and one at 1441; an inquiry with an automated reply, a guest follow-up and a real reply hours later; unanswered inquiries. Hard: support messages; inquiries created exactly at the window start (in) and end (out) and just before it; an in-window inquiry answered after the window; a host with only automated replies (median NULL, share 0); a host below the floor. Very Hard: co-hosts answering for the listing's host, including one who answers in minutes before the host does, and co-hosts' automated messages.

**Common mistakes.** Taking the first message after the inquiry from anyone; counting automated replies; filtering after `MIN` instead of before; an inner join that drops unanswered inquiries from the denominator; `< 1440`; the mean, or `PERCENTILE_DISC`, instead of the median; filtering replies by the window; ignoring co-hosts, or crediting the co-host as a separate host.

**Follow-up guidance.** (1) Business-hours clocks pause outside a schedule in the host's time zone; computing them needs the host's time zone history and a working-time function; the meaning changes ("minutes of working time"), so name it differently. (2) Prefer the server receipt time for ordering and fairness; keep the client time for display; restate the inquiry's first reply when an earlier message arrives late, and recompute affected host aggregates. (3) Keep, per inquiry, `created_at` and `first_reply_at` (nullable), updated by message events; host aggregates are then recomputed from that small table, or maintained with mergeable sketches for medians. (4) Decide whether an inquiry that converts within N minutes is excluded from the denominator, encode that as a status on the inquiry, and document it next to the metric.

**Rubric anchors.** 2: plausible per-host numbers but automated or guest messages counted, or unanswered inquiries dropped. 3: matches the expected result. 4: also handles time zones, late messages and incremental refresh credibly.

**Strong signals.** Defines the inquiry grain first; asks how automated replies are flagged; names `PERCENTILE_CONT` vs `PERCENTILE_DISC`. **Red flags.** Average response time presented as "typical"; a median computed as the middle row without handling the even case.

## ABB-L1-04

**Reference solution**

```python reference
def orphan_gaps(min_stay, bookings, blocks):
    occupied = {lid: [] for lid in min_stay}
    for lid, start, end, status in bookings:
        if status == 'confirmed' and lid in occupied:
            occupied[lid].append((start, end))
    for lid, start, end in blocks:
        if lid in occupied:
            occupied[lid].append((start, end))
    out = {}
    for lid, spans in occupied.items():
        spans.sort()
        need = min_stay[lid]
        gaps = []
        run_end = None                        # end of the occupied run so far
        for start, end in spans:
            if run_end is not None and start > run_end and start - run_end < need:
                gaps.append((run_end, start))
            if run_end is None or end > run_end:
                run_end = end
        out[lid] = gaps
    return out
```

**Explanation.** Group the occupied intervals (confirmed bookings and blocks) by listing, sort each group by start, and sweep with the end of the current occupied run. An interval that starts after the run's end closes a gap `(run_end, start)`; the gap is orphan when its length is positive and below the listing's minimum. The run's end only ever grows (`max`), which is what merges overlapping and touching intervals and keeps a short booking nested inside a long block from moving it backwards. Free nights before the first interval and after the last are never reported because a gap needs a run on both sides. Every listing in `min_stay` gets an entry, `[]` when it has nothing.

**Complexity.** O(n log n) for n bookings and blocks (the sorts), O(n) extra memory. The timing test (4 000 listings × 100 bookings, about 700 nights each, plus cancelled bookings and blocks at the higher levels) runs in about 0.7 s in CPython. A night-by-night scan that checks every booking of the listing for each night took about 0.5 s for 100 listings, so about 20 s for the full test; marking nights in a set is O(total nights) and passes here, but grows with calendar length rather than with bookings.

**Dialect notes.** In SQL this is the "gaps and islands" pattern: per listing, `MAX(end) OVER (PARTITION BY listing ORDER BY start ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)` gives the run's end before each interval, and a gap exists where `start > that`. In Spark, the same window function, or `groupBy(listing).applyInPandas` with this sweep. In Java, sort an `int[][]` per listing with a comparator on start. Not executed here.

**Edge cases built into the tests.** A gap one night shorter than the minimum (orphan) and exactly the minimum (not); back-to-back bookings; free nights before the first and after the last booking; a minimum stay of 1. Hard: cancelled bookings that would otherwise fill or bound a gap; unsorted input; a listing with no bookings. Very Hard: a block that bounds a gap; a block overlapping a booking and another block; a booking nested inside a long block; rows for a listing not in `min_stay`.

**Common mistakes.** `<=` instead of `<` against the minimum; reporting the edges of the calendar as gaps; using the previous interval's end rather than the running maximum (nested intervals); forgetting to filter cancelled bookings; leaving listings without gaps out of the result; a `KeyError` on unknown listings; per-night loops over every booking.

**Follow-up guidance.** (1) Use the minimum that applies to a stay starting on the gap's first night (check-in rules) or the strictest across it, and say which; the sweep is the same, the threshold becomes a lookup per gap. (2) A listing's calendar changes locally: re-sweep only that listing (its intervals are already sorted, so an insert is O(log n) with a sorted container, and only the neighbouring gaps change). (3) Partition by listing id hash; a listing never spans partitions, and per-listing work is tiny, so skew is not a concern unless one key holds many calendars (bucket by listing, not by host). (4) Compare orphan nights that were discounted with comparable ones that were not (a holdout of listings or dates), measuring sold nights and revenue, not just the discount uptake.

**Rubric anchors.** 2: correct for sorted, non-overlapping bookings but fails nested or touching intervals, or uses per-night rescans. 3: all tests pass in O(n log n). 4: also handles date-dependent minimums and incremental updates credibly, and proposes a sound measurement.

**Strong signals.** Asks whether a gap at the calendar's edge counts; names the "running max end" invariant; tests a nested interval unprompted. **Red flags.** Sorting the whole input once per listing (O(L · n log n)); treating `check_out` as an occupied night.

## ABB-L1-05

**Reference solution**

```python reference
import math
from collections import defaultdict

CELL = 0.1                                    # degrees per grid cell
FIRST_COL, LAST_COL = math.floor(-180 / CELL), math.floor(180 / CELL) - 1


def _cell(x):
    return math.floor(x / CELL)


def search_map(listings, queries):
    grid = defaultdict(list)                  # (lat cell, lng cell) -> listings
    for item in listings:
        grid[(_cell(item[1]), _cell(item[2]))].append(item)
    out = []
    for south, west, north, east, page, size, max_price in queries:
        if south > north or page < 0 or size < 1:
            out.append((0, []))
            continue
        crosses = west > east
        if crosses:                           # [west, 180) and [-180, east]
            col_ranges = [(_cell(west), LAST_COL), (FIRST_COL, _cell(east))]
        else:
            col_ranges = [(_cell(west), min(_cell(east), LAST_COL))]
        r0, r1 = _cell(south), _cell(north)
        n_cells = (r1 - r0 + 1) * sum(c1 - c0 + 1 for c0, c1 in col_ranges)
        if n_cells <= len(grid):
            cells = [(r, c) for r in range(r0, r1 + 1) for c0, c1 in col_ranges for c in range(c0, c1 + 1)]
        else:                                 # a huge viewport: visit the occupied cells instead
            cells = [k for k in grid if r0 <= k[0] <= r1 and any(c0 <= k[1] <= c1 for c0, c1 in col_ranges)]
        hits = []
        for key in cells:
            for lid, lat, lng, price in grid.get(key, ()):
                if lat < south or lat > north:
                    continue
                if crosses:
                    if east < lng < west:
                        continue
                elif lng < west or lng > east:
                    continue
                if max_price is not None and price > max_price:
                    continue
                hits.append((price, lid))
        hits.sort()
        out.append((len(hits), [lid for _, lid in hits[page * size:(page + 1) * size]]))
    return out
```

**Explanation.** Listings are bucketed once into 0.1° cells. A viewport maps to a rectangle of cells, or to two column ranges when it crosses the antimeridian (`west > east`): from `west`'s column to the last column before +180, and from the column of −180 to `east`'s. Cells only narrow the candidates; every candidate is tested exactly against the viewport, so cell boundaries never decide membership and inclusive edges stay exact. Hits are sorted by `(price, listing_id)`, which is the required order, then sliced for the 0-based page, with the total reported separately. A viewport that would touch more cells than are occupied (a whole-world view) iterates the occupied cells instead, so its cost is bounded by the index, not by the area. Invalid queries return the sentinel `(0, [])` before any work.

**Complexity.** Building the grid is O(N). A query costs O(cells touched + candidates + k log k) for k matches. The timing test (60 000 listings in 15 metros, 6 000 viewports of a few hundredths of a degree) runs in about 0.6 s in CPython. Scanning all listings per query took about 1.5 s per 300 queries, so about 30 s for the test.

**Dialect notes.** In PostgreSQL the same query is a GiST index on a `point` or PostGIS geometry with `&&` against a box; an antimeridian-crossing box is split into two boxes combined with `UNION ALL` (or handled with geography types). In BigQuery, `ST_INTERSECTSBOX(geo, west, south, east, north)` accepts `west > east` for boxes crossing the antimeridian. In Java, a `HashMap<Long, List<Listing>>` keyed by a packed cell id. Not executed here.

**Edge cases built into the tests.** A viewport crossing the antimeridian; listings exactly on all four edges; equal prices ordered by id, and a second page. Hard: invalid queries (south above north, negative page, page size 0) and a valid page size of 1; a page past the end with the total; a crossing viewport that includes −180 and a listing on its east edge but not one just east of it. Very Hard: `max_price` inclusive and None; a viewport one meridian wide; a whole-world viewport.

**Common mistakes.** `west <= lng <= east` for a crossing viewport (finds nothing); treating `west > east` as invalid; deciding membership by cell instead of by coordinates (edge listings lost or added); 1-based pages; returning the page size instead of the total; sorting by price only (unstable order across pages); rebuilding the index per query.

**Follow-up guidance.** (1) Adaptive structures (quadtrees, geohash or hierarchical cell prefixes, or a k-d tree) split dense areas finely and keep sparse ones coarse; uniform cells are simple and fine when the cell size matches typical viewports. (2) A small pan shares most cells with the previous viewport: cache per-cell candidate lists (sorted by price) and merge them; cache whole results by a quantized viewport. (3) A date-dependent total cannot be precomputed per listing for all date ranges; filter by availability first, then compute totals for the candidates, and page over that computed order. (4) Cursor paging (`price > last_price OR (price = last_price AND id > last_id)`) is stable under inserts and cheap for deep pages; page numbers shift items between pages when data changes.

**Rubric anchors.** 2: correct small cases but a full scan per query, or the antimeridian handled wrongly. 3: all tests pass with an index built once. 4: also discusses adaptive indexing, caching and cursor paging credibly.

**Strong signals.** Asks how a crossing viewport is represented before coding; tests the −180 / +180 seam; keeps exact filtering separate from bucketing. **Red flags.** Normalising longitudes by adding 360 to some listings and not others; distance from the viewport's centre in place of the rectangle.
