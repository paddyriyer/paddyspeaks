# Walmart Global Tech · Loop 1 — evaluator notes (hidden from candidates)

## WMT-L1-01

**Reference solution** (PostgreSQL; `{{target}}` is the instance's target in minutes)

```sql reference
WITH ci AS (                                   -- the first tap starts the wait
  SELECT order_id, MIN(event_ts) AS checkin_ts
  FROM pickup_events WHERE event_type = 'checkin'
  GROUP BY order_id
), ho AS (
  SELECT order_id, MIN(event_ts) AS handover_ts
  FROM pickup_events WHERE event_type = 'handover'
  GROUP BY order_id
), w AS (
  SELECT o.store_id, s.tz,
         GREATEST(ci.checkin_ts, o.slot_start) AS wait_start,
         ho.handover_ts
  FROM pickup_orders o
  JOIN stores s ON s.store_id = o.store_id
  JOIN ci ON ci.order_id = o.order_id
  JOIN ho ON ho.order_id = o.order_id
), m AS (
  SELECT store_id,
         EXTRACT(HOUR FROM wait_start AT TIME ZONE tz)::int              AS hour_of_day,
         GREATEST(EXTRACT(EPOCH FROM handover_ts - wait_start) / 60, 0)  AS wait_min
  FROM w
)
SELECT store_id, hour_of_day,
       COUNT(*)                                        AS handovers,
       ROUND(AVG(wait_min), 1)                         AS avg_wait_min,
       MAX(wait_min)                                   AS max_wait_min,
       COUNT(*) FILTER (WHERE wait_min > {{target}})   AS over_target
FROM m
GROUP BY store_id, hour_of_day
ORDER BY store_id, hour_of_day;
```

**Explanation.** Reduce the events to one row per order (first check-in, the handover); the inner joins drop orders missing either. The wait clock starts at `GREATEST(checkin, slot_start)`, so an early customer is measured from the slot start, and the clamp at 0 covers a handover made before the slot started. The hour is taken from the wait start, not the check-in, converted to the store's zone with `AT TIME ZONE tz` (a `timestamptz` at a zone name gives the local wall-clock time). Because times are whole minutes, every wait is an exact number of minutes and `ROUND(AVG(…), 1)` has no floating-point surprises.

**Complexity.** Two hash aggregates over the events, a hash join with orders and stores, and a final aggregate: O(n) apart from the small sort for the output. In production this is an incremental daily job keyed by order.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_DIFF(handover_ts, wait_start, SECOND) / 60`, `EXTRACT(HOUR FROM DATETIME(wait_start, tz))`, `COUNTIF`. Snowflake: `DATEDIFF('second', …) / 60`, `HOUR(CONVERT_TIMEZONE(tz, wait_start))`, `COUNT_IF`; `GREATEST` returns NULL if either argument is NULL in all three engines. Spark SQL: `unix_timestamp` differences, `hour(from_utc_timestamp(wait_start, tz))`. MySQL 8: `TIMESTAMPDIFF(SECOND, …)` and `CONVERT_TZ` (needs the time zone tables loaded).

**Edge cases built into the data.** Every level: an early check-in in the previous clock hour whose wait is exactly the target; a check-in at minute 59 of an hour. Hard: a second "I'm here" tap during the wait; an order checked in but never handed over; a handover with no check-in; a handover before the slot started (wait 0, otherwise negative); a check-in exactly at the slot start. Very Hard: stores in several US time zones and a slot at 8 pm local that falls on the next UTC day.

**Common mistakes.** Measuring from the check-in for early customers; grouping by the check-in hour; using the last check-in; a negative wait for an early handover; `>=` for "over the target"; extracting the hour in UTC; inner-joining the events in a way that multiplies rows when an order has two check-ins (the average and count both inflate); averaging per-hour averages.

**Follow-up guidance.** (1) `percentile_cont(0.9) WITHIN GROUP (ORDER BY wait_min)`; percentiles are not additive, so a regional p90 needs the raw waits or a mergeable sketch (t-digest, KLL). (2) Report the share of handovers with no check-in beside the wait metric, per store and hour; a store with many walk-ups has a less representative wait. (3) Compare like with like: the same hours before and after, with order counts shown, or a weighted average using a fixed hour mix. (4) Partition events by event date; keep an open-orders state keyed by order id, finalise an order when its handover arrives, and allow late handovers to update the hour bucket they belong to (the bucket is fixed by the wait start, which is known at check-in).

**Rubric anchors.** 2: right shape but measures early customers from the check-in, or counts duplicate taps. 3: matches the expected result. 4: also handles percentiles, walk-ups and incremental builds credibly.

**Strong signals.** Restates the wait rule and asks about early check-ins and double taps before writing; explains why the hour comes from the wait start. **Red flags.** Attributing waits to individual associates; treating the target as a promise to customers.

## WMT-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH latest AS (                              -- the latest offer per line decides
  SELECT DISTINCT ON (order_id, line_no) order_id, line_no, decision
  FROM sub_offers
  ORDER BY order_id, line_no, offered_ts DESC, offer_id DESC
), l AS (
  SELECT date_trunc('week', o.pickup_ts AT TIME ZONE 'UTC')::date AS week_start,
         i.category,
         ol.pick_status = 'short' AND lt.order_id IS NOT NULL                              AS substituted,
         ol.pick_status = 'short' AND lt.order_id IS NOT NULL AND lt.decision = 'rejected' AS rejected,
         ol.pick_status = 'short' AND lt.order_id IS NULL AND ol.allow_sub                 AS missed
  FROM order_lines ol
  JOIN orders o ON o.order_id = ol.order_id
  JOIN items i ON i.item_id = ol.item_id
  LEFT JOIN latest lt ON lt.order_id = ol.order_id AND lt.line_no = ol.line_no
  WHERE o.status = 'completed'
)
SELECT week_start, category,
       COUNT(*)                                   AS lines,
       COUNT(*) FILTER (WHERE substituted)        AS substituted,
       COUNT(*) FILTER (WHERE rejected)           AS rejected,
       ROUND(COUNT(*) FILTER (WHERE rejected)::numeric
             / NULLIF(COUNT(*) FILTER (WHERE substituted), 0), 4) AS reject_rate,
       COUNT(*) FILTER (WHERE missed)             AS short_no_offer
FROM l
GROUP BY week_start, category
ORDER BY week_start, category;
```

**Explanation.** One latest offer per line (`DISTINCT ON` with `offered_ts DESC, offer_id DESC`), left-joined to the lines of completed orders, so each line is classified once: substituted (short with an offer), rejected (its latest decision is `rejected`; a `NULL` decision is not), missed (short, no offer, substitutes allowed). An offer on a picked line exists in the data but cannot make the line substituted. The category comes from the ordered item. `date_trunc('week', …)` on the UTC timestamp returns the Monday, and `NULLIF` turns an empty denominator into a `NULL` rate.

**Complexity.** One sort of the offers for `DISTINCT ON`, hash joins and one hash aggregate: O(n log n) in the offers, O(n) in the lines.

**Dialect notes** (described, not executed). BigQuery: `QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id, line_no ORDER BY offered_ts DESC, offer_id DESC) = 1`, `DATE_TRUNC(DATE(pickup_ts), ISOWEEK)`, `COUNTIF`, `SAFE_DIVIDE`. Snowflake: `QUALIFY`, `DATE_TRUNC('week', …)` whose first day depends on `WEEK_START` (default Monday under the ISO-like default, but check the session), `COUNT_IF`, `DIV0NULL`-style handling. Spark SQL: `date_trunc('week', …)` starts on Monday; `max_by(decision, struct(offered_ts, offer_id))` picks the latest decision. MySQL 8: `ROW_NUMBER()` in a CTE and `SUM(CASE …)`; weeks via `DATE_SUB(d, INTERVAL WEEKDAY(d) DAY)`.

**Edge cases built into the data.** Every level: a rejected substitution on Sunday night and an accepted one on Monday morning (UTC) for the same item, one substitute from another category, and a short line with no offer. Hard: a line rejected then accepted on a second offer; a `NULL` decision (accepted by this exercise's rule); a cancelled order with a rejection and a missed offer. Very Hard: an offer on a line that was then picked; a short line with `allow_sub = false`.

**Common mistakes.** Dividing by all short lines; grouping by the substitute's category; Sunday-start weeks; the first offer instead of the latest; counting `NULL` as rejected or dropping it from the denominator; including cancelled orders; an inner join that loses missed offers; counting offers rather than lines (a line with two offers counted twice); a rate of 0 instead of `NULL`.

**Follow-up guidance.** (1) Grain becomes (week, ordered category, substitute item); the denominator is lines whose latest offer used that substitute; small counts need a minimum before ranking. (2) Local dates move evening pickups in western stores to the previous UTC day only rarely here, but at scale near midnight the weekly totals shift slightly; for a trend the rule matters less than keeping it fixed. (3) Rejected substitutions lose the ordered item's revenue (refund); missed offers lose it too; use the order-time price, not today's. (4) Partition by pickup date; recompute only weeks that received offers or decisions since the last run (a watermark on `offered_ts` and order updates), and close a week after the latest possible handover.

**Rubric anchors.** 2: shape right but the latest offer, the denominator or the category is wrong. 3: matches the expected result. 4: also handles per-substitute rates, local dates and incremental builds credibly.

**Strong signals.** Asks which offer decides and what a missing response means before writing; keeps the grain at the line. **Red flags.** Reporting results per customer; inventing a reason for rejections.

## WMT-L1-03

**Reference solution** (PostgreSQL; `{{as_of}}`, `{{first_day}}`, `{{baseline_days}}` and `{{min_days}}` are the instance's values)

```sql reference
WITH store_list AS (
  SELECT DISTINCT store_id FROM sales
), days AS (                                   -- each store's open days, newest first
  SELECT s.store_id, d::date AS biz_date,
         ROW_NUMBER() OVER (PARTITION BY s.store_id ORDER BY d DESC) AS rn
  FROM store_list s
  CROSS JOIN generate_series(DATE '{{first_day}}', DATE '{{as_of}}', interval '1 day') AS d
  WHERE NOT EXISTS (SELECT 1 FROM store_closures c
                    WHERE c.store_id = s.store_id AND c.biz_date = d::date)
), store_items AS (
  SELECT DISTINCT store_id, item_id FROM sales
), daily AS (                                  -- net units per store, item and day
  SELECT store_id, item_id, biz_date, SUM(units) AS net
  FROM sales
  GROUP BY store_id, item_id, biz_date
), grid AS (
  SELECT si.store_id, si.item_id, d.rn,
         COALESCE(dl.net, 0) AS net,
         sn.on_hand
  FROM store_items si
  JOIN days d ON d.store_id = si.store_id AND d.rn <= 3 + {{baseline_days}}
  LEFT JOIN daily dl ON dl.store_id = si.store_id AND dl.item_id = si.item_id AND dl.biz_date = d.biz_date
  LEFT JOIN inventory_snapshots sn ON sn.store_id = si.store_id AND sn.item_id = si.item_id AND sn.biz_date = d.biz_date
)
SELECT store_id, item_id,
       COUNT(*) FILTER (WHERE rn > 3 AND net > 0) AS baseline_days_sold,
       SUM(net) FILTER (WHERE rn > 3)            AS baseline_units,
       MAX(on_hand) FILTER (WHERE rn = 1)        AS on_hand
FROM grid
GROUP BY store_id, item_id
HAVING COUNT(*) FILTER (WHERE rn <= 3 AND on_hand > 0) = 3
   AND COUNT(*) FILTER (WHERE rn <= 3 AND net > 0) = 0
   AND COUNT(*) FILTER (WHERE rn > 3 AND net > 0) >= {{min_days}}
ORDER BY store_id, item_id;
```

**Explanation.** A spine of each store's open days, numbered back from the as-of date, turns both windows into ranges of `rn`: 1–3 is the check window, 4 to 3 + baseline the baseline. Sales are netted per day first and joined onto the spine, so a day with no row is 0 and a day with only a return is not a sale. A missing snapshot gives `NULL`, which fails `on_hand > 0`, so the store-item needs three positive snapshots. Everything else is conditional counting in one aggregate.

**Complexity.** The spine is stores × days; the grid is store-items × (3 + baseline) days; one aggregate over sales and one over the grid. Linear in the rows read. Daily in production, this reads only the last few weeks of a date-partitioned sales table.

**Dialect notes** (described, not executed). BigQuery: `UNNEST(GENERATE_DATE_ARRAY(first, as_of))` for the spine, `COUNTIF`, `QUALIFY` not needed. Snowflake: a spine from `TABLE(GENERATOR(ROWCOUNT => n))` with `DATEADD`, `COUNT_IF`. Spark SQL: `explode(sequence(first, as_of, interval 1 day))`, `count_if`. MySQL 8: a recursive CTE for the spine, `SUM(CASE …)`.

**Edge cases built into the data.** Every level: a suspect that sold on exactly the threshold of baseline days; an item that sold on one day too few in the baseline but also on the day just before the baseline (a window one day too long makes it a suspect); a store-item that sold out (0 on hand) during the check window; items that sold in the check window. Hard: a check day with only a return, a check day with a zero row, a missing snapshot on a check day. Very Hard: several rows per day to net (including a sale and a matching return), store closures inside the check window and the baseline.

**Common mistakes.** A baseline of baseline + 1 days, or one that overlaps the check window; `>` instead of `>=` for the threshold; counting a day as sold whenever a row exists; ignoring missing snapshots (`COALESCE(on_hand, 1)` or an inner join that silently drops the day and then checks only the days present); calendar windows when the store was closed; window frames over rows (`ROWS BETWEEN 2 PRECEDING`) on a sales table that has no row for quiet days.

**Follow-up guidance.** (1) With a daily rate λ from the baseline, the chance of three quiet days by luck is about e^(−3λ) under a Poisson assumption; flag when that falls below a chosen level. State it as a model, not a fact. (2) A delivery during the window that still did not sell is stronger evidence (more stock and no sales), unless the delivery is not yet on the shelf. (3) Precision: the share of checked suspects whose count was corrected downwards; track it per category, and cap the list per store so teams can act. (4) Keep a rolling per-store-item state (last sale date, baseline counts) updated daily from one day of sales, rather than rescanning a month.

**Rubric anchors.** 2: right idea but windows off by one, returns counted as sales, or missing snapshots treated as stock. 3: matches the expected result. 4: also proposes a rate-based rule, measures precision and computes incrementally.

**Strong signals.** Builds a date spine before anything else; asks about closures, returns and missing snapshots. **Red flags.** Calling the suspects shrink or theft; blaming store associates for counts.

## WMT-L1-04

**Reference solution**

```python reference
def range_sales(n_minutes, ops):
    n = n_minutes
    tree = [0] * (n + 1)                # Fenwick tree over minutes, 1-based

    def add(i, v):
        i += 1
        while i <= n:
            tree[i] += v
            i += i & -i

    def prefix(i):                      # total of minutes 0 .. i-1
        s = 0
        while i > 0:
            s += tree[i]
            i -= i & -i
        return s

    txns = {}                           # txn_id -> [minute, cents, counted]
    void_first = set()                  # voids that arrived before their sale
    out = []
    for op in ops:
        kind = op[0]
        if kind == 'query':
            lo, hi = op[1], op[2]
            out.append(prefix(hi + 1) - prefix(lo) if lo <= hi else 0)
        elif kind == 'sale':
            _, tid, minute, cents = op
            counted = tid not in void_first
            txns[tid] = [minute, cents, counted]
            if counted:
                add(minute, cents)
        elif kind == 'void':
            t = txns.get(op[1])
            if t is None:
                void_first.add(op[1])
            elif t[2]:
                t[2] = False
                add(t[0], -t[1])
        else:                           # move
            t = txns.get(op[1])
            if t is not None:
                if t[2]:
                    add(t[0], -t[1])
                    add(op[2], t[1])
                t[0] = op[2]
    return out
```

**Explanation.** Two pieces of state. A dict holds each transaction's current minute, amount and whether it still counts; it makes voids and moves O(1) to locate and makes repeated voids harmless. A Fenwick tree over minutes holds the counted total per minute and answers prefix totals in O(log n); a range is the difference of two prefixes. A sale adds its amount, a void subtracts it at the transaction's current minute, and a move subtracts at the old minute and adds at the new one, all only while the transaction counts. A void for a transaction not seen yet is remembered, so the sale arrives already voided; a move for an unknown transaction is ignored as specified.

**Complexity.** O(log n) per sale, void, move and query; O(n) memory for the tree plus O(T) for the transactions. The timing test (525 600 minutes, 120 000 sales with about 12 000 voids and 12 000 moves, 30 000 queries averaging a third of the year) ran in about 0.6–0.75 s in CPython at every level. Re-summing each range with `sum(per_minute[lo:hi + 1])` (C-speed summing) took about 90 s on the same input; rebuilding prefix sums with `itertools.accumulate` whenever an update came before a query (the likely "middle" approach) did not finish within 120 s, because almost every query follows an update. A square-root decomposition (blocks of about 725 minutes with block totals) is O(√n) per query and passes; accept it as a correct, slower alternative and ask for its costs.

**Dialect notes.** Java/C++: a `long[]` Fenwick tree and a `HashMap`; totals of a year of sales in cents need 64-bit integers. In a warehouse the same question is answered with a per-minute table and window sums or a pre-aggregated cube, recomputed when late data lands; the in-memory structure is for interactive answers over data that is still changing. Not executed here.

**Edge cases built into the tests.** A late sale into a minute inside a range already answered; both ends of a range included and a one-minute range; a void inside a range. Hard: a move between minutes; a repeated void; a voided transaction that is moved; `lo > hi` returning 0; the first and last minutes. Very Hard: a void that arrives before its sale (and is repeated after it), a move for a transaction not seen yet, and a transaction voided before arrival and then moved.

**Common mistakes.** Off-by-one in the 1-based tree (`prefix(hi)` instead of `prefix(hi + 1)`); subtracting a void at the original minute after a move; subtracting twice on a repeated void; moving a voided transaction's amount back into the totals; treating `lo > hi` as an error or as a swapped range; rebuilding prefix sums on every query.

**Follow-up guidance.** (1) A range maximum of 15-minute sums is a segment tree over 15-minute window sums; each point update changes up to 15 windows, so an update is O(15 log n) with a range-add segment tree with lazy propagation, or precompute window sums and use a segment tree storing max with range add. (2) Per store and department, keep one tree per key (memory grows with keys × minutes); a 2-D Fenwick tree suits a fixed small grid of dimensions; at larger cardinality pre-aggregate into hour blocks and correct within the edges. (3) Cheap updates and slower queries: buffer updates and apply in batches before each query, or use blocks; queries few per second can afford O(√n). (4) Load corrections as append-only adjustment rows, recompute affected minute and hour aggregates by partition, and keep the adjustment history for audit; you lose instant answers between loads.

**Rubric anchors.** 2: correct with per-minute totals and a sum per query, or a Fenwick tree with void/move bookkeeping errors. 3: all tests pass with log-time updates and queries. 4: also explains the alternatives (segment tree, blocks), the follow-up structures and warehouse trade-offs.

**Strong signals.** Separates transaction state from the minute structure; asks what a void of an unknown or voided transaction means. **Red flags.** Rebuilding everything on every operation; ignoring that moves and voids interact.

## WMT-L1-05

**Reference solution**

```python reference
from collections import deque


def expired_units(lots, sales, writeoffs, as_of):
    left = {lot_id: units for lot_id, _, _, units, _ in lots}
    expiry = {lot_id: exp for lot_id, _, _, _, exp in lots}
    shelf = {}                                   # item -> deque of lot ids, oldest first
    li = wi = 0
    for day, item, units in sales:
        while li < len(lots) and lots[li][2] <= day:            # deliveries up to today
            lot_id, it = lots[li][0], lots[li][1]
            shelf.setdefault(it, deque()).append(lot_id)
            li += 1
        while wi < len(writeoffs) and writeoffs[wi][0] <= day:  # write-offs up to today
            wday, lot_id, n = writeoffs[wi]
            if wday <= expiry[lot_id]:
                left[lot_id] -= min(n, left[lot_id])
            wi += 1
        q = shelf.get(item)
        while units and q:
            lot_id = q[0]
            if left[lot_id] == 0 or expiry[lot_id] < day:       # sold out or past its date
                q.popleft()
                continue
            take = min(units, left[lot_id])
            left[lot_id] -= take
            units -= take
    for wday, lot_id, n in writeoffs[wi:]:                      # write-offs after the last sale
        if wday <= expiry[lot_id]:
            left[lot_id] -= min(n, left[lot_id])
    return {lot_id: left[lot_id] for lot_id, *_ in lots if expiry[lot_id] < as_of}
```

**Explanation.** A deque of lot ids per item, in delivery order, is exactly the oldest-first order. A sale looks at the front: a lot that is sold out, or whose expiry day is before today, can never sell again (days only move forward), so it leaves the queue for good; otherwise the sale takes what it can and continues. A lot that expires while a still-sellable older lot is in front of it simply waits in the queue and is discarded when it reaches the front. Write-offs touch a named lot's count directly, before the sales of their day, and are ignored after the expiry day. After its expiry day nothing changes a lot's count, so the units left are its expired units.

**Complexity.** Each lot enters and leaves its queue once, and each step of a sale either removes a lot or finishes the sale: O(n + L + W) for n sales, L lots and W write-offs, amortised. The timing test (5 items, 50 000 lots, 125 000 sales over 3 000 days) ran in about 0.3 s in CPython. Scanning an item's lots from the oldest on every sale took about 80 s by extrapolation (1.8 s at 15% of the size, quadratic growth). The likely "middle" approach, a per-item pointer that skips sold-out lots but keeps re-scanning expired ones, did not finish within 200 s, because expired lots pile up in front of the pointer. A per-item list with `pop(0)` for removals is O(L) per removal in theory but passes here (the memmove is fast at these sizes); accept it and ask for its cost.

**Dialect notes.** Java: `ArrayDeque<Integer>` per item in a `HashMap`. C++: `std::deque`. In SQL, FIFO allocation of sales to lots is done with running totals: cumulative supply per item by delivery order against cumulative demand, joined on overlapping ranges; expiry makes it iterative, so a procedural pass (or a recursive CTE) is usually clearer. Not executed here.

**Edge cases built into the tests.** A sale on the expiry day; a lot sold on its delivery day; the `as_of` boundary (expiry on `as_of` is left out, one day earlier included); a sale that spans two lots. Hard: a newer lot that expires before an older one (oldest still sells first); a sale larger than the stock (the rest is lost, not taken from a later delivery); items that never share lots; lots delivered on the same day in list order. Very Hard: a write-off from a named lot that is not the oldest; a write-off larger than what is left; a write-off after the expiry day; a write-off on the day of a sale.

**Common mistakes.** First-expiring-first-out instead of the rule; `expiry_day > day` (refusing to sell on the expiry day); carrying unmet demand to the next delivery; including lots that expire on `as_of`; leaving out lots with 0 expired; writing off units after expiry (which would turn expired units into write-offs); scanning from the oldest lot on every sale.

**Follow-up guidance.** (1) First expiring, first out needs a min-heap per item keyed by `(expiry_day, delivered order)`; a sale is O(log L) per lot it touches; expired lots are popped lazily from the top. (2) Amortised argument: every `popleft` removes a lot that never returns, so there are at most L of them; every other loop step finishes the sale. (3) Replay the same sales against a changed delivery plan, holding demand fixed (with the caveat that real demand depends on what is on the shelf), and compare expired units and lost sales together. (4) Inferred lots ignore customers who take from the back and staff who rotate stock; compare inferred waste with counted waste per item and week, and calibrate before acting.

**Rubric anchors.** 2: correct for small cases but quadratic, or the expiry-day or `as_of` boundary wrong. 3: all tests pass with a queue per item. 4: also gives the amortised argument, the FEFO variant and a sound replay plan.

**Strong signals.** Notices that removal from the front is permanent because days only move forward; asks about same-day ordering. **Red flags.** Assuming expired units are a store team's fault; treating the inferred lots as counted facts.
