# DoorDash · Loop 1 — evaluator notes (hidden from candidates)

## DSH-L1-01

**Reference solution** (PostgreSQL; `{{window_h}}` is the instance's report window in hours, and `{{week_tz_sql}}` is `'UTC'` below Very Hard and `s.time_zone` at Very Hard)

```sql reference
WITH inaccurate AS (                         -- one row per inaccurate order, however many reports
  SELECT DISTINCT r.order_id
  FROM issue_reports r
  JOIN orders o ON o.order_id = r.order_id
  WHERE r.issue_type IN ('missing_item', 'incorrect_item')
    AND r.reported_at <= o.delivered_at + INTERVAL '{{window_h}} hours'
)
SELECT s.merchant_id,
       date_trunc('week', o.placed_at AT TIME ZONE {{week_tz_sql}})::date AS week_start,
       o.channel,
       COUNT(*)                                                     AS delivered_orders,
       COUNT(i.order_id)                                            AS inaccurate_orders,
       ROUND((COUNT(*) - COUNT(i.order_id))::numeric / COUNT(*), 4) AS accuracy_rate
FROM orders o
JOIN stores s ON s.store_id = o.store_id
LEFT JOIN inaccurate i ON i.order_id = o.order_id
WHERE o.status = 'delivered'
GROUP BY s.merchant_id, week_start, o.channel
ORDER BY s.merchant_id, week_start, o.channel;
```

**Explanation.** The inaccurate set is built once, with `DISTINCT`, so an order with three reports is one row. Only the two accuracy issue types count, and only inside the inclusive window after delivery; a cancelled order has a NULL `delivered_at`, so its reports fail the window test, and it is filtered out of the outer query anyway. The LEFT JOIN keeps every delivered order in the denominator and `COUNT(i.order_id)` counts only those that matched. `AT TIME ZONE` turns the instant into local wall-clock time before `date_trunc('week', …)`, which starts weeks on Monday. Stores are rolled up to the merchant through `stores`, and the channel stays in the grouping so the merchant's own channel is a separate row.

**Complexity.** One pass over reports (a hash join to orders), one hash join and one hash aggregate over orders: O(n) with hashing. At scale, partition orders by week and keep the inaccurate set per week, since reports arrive within the window.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(placed_at, time_zone), WEEK(MONDAY))` (plain `WEEK` starts on Sunday); `TIMESTAMP_ADD(delivered_at, INTERVAL 72 HOUR)`; `COUNTIF`. Snowflake: `DATE_TRUNC('week', CONVERT_TIMEZONE(time_zone, placed_at))` depends on the `WEEK_START` parameter, so say which; `DATEADD(hour, …)`. Spark SQL: `date_trunc('week', from_utc_timestamp(placed_at, time_zone))` (Monday weeks). MySQL 8: no `date_trunc`; use `DATE_SUB(d, INTERVAL WEEKDAY(d) DAY)` on `CONVERT_TZ(...)`, which needs the time zone tables loaded.

**Edge cases built into the data.** Every level: an order with three qualifying reports; a cancelled order with a `missing_item` report; a delivered order with only a non-accuracy report; an own-channel order with a report; delivered orders with no report. Hard: a report exactly `window_h` hours after delivery (counts) and one a second later (does not); orders at Sunday 23:59:59 and Monday 00:00:00 UTC. Very Hard: stores in several zones, an order early on Monday UTC that is Sunday evening in the Americas (previous week), and an order late on Sunday UTC that is Monday in Sydney (next week).

**Common mistakes.** Counting reports instead of orders; an inner join to reports, which loses every order without a report and makes accuracy 0; counting cancelled orders in the denominator; counting late-delivery or packaging reports; a strict `<` at the window; grouping by store instead of merchant; dropping the channel; integer division; weeks in UTC at Very Hard; `EXTRACT(WEEK …)` without the year.

**Follow-up guidance.** (1) Keep dispute outcomes as their own table and compute two numbers from the same orders, "as reported" and "after review"; publish a week's figure with a version and restate with a visible note rather than editing silently. (2) Show the counts next to the rate, suppress or grey the rate under a stated minimum of orders, or show an interval. (3) A week is final `window_h` hours after its last delivery; until then recompute only the open weeks (a watermark on `delivered_at`). (4) Reports need an item line id; a report about one line marks that line, and item accuracy is lines reported over lines delivered.

**Rubric anchors.** 2: right shape but counts reports, or loses orders without reports, or includes cancellations. 3: matches the expected result at the level. 4: also discusses disputes, small denominators and late reports credibly.

**Strong signals.** States the grain (order) before writing; asks whether a report can arrive before delivery or after the window; checks the result against a hand count for one merchant. **Red flags.** Presenting the metric as a judgement of whoever handled the order; averaging store rates to get a merchant rate without noticing the weighting.

## DSH-L1-02

**Reference solution** (PostgreSQL; `{{min_restaurant}}` and `{{min_grocery}}` are the instance's minimums in cents, equal below Very Hard)

```sql reference
WITH waived AS (                              -- waived orders per member-month
  SELECT o.consumer_id,
         m.month,
         COUNT(*)                  AS n_orders,
         SUM(o.delivery_fee_cents) AS cents
  FROM orders o
  JOIN stores s ON s.store_id = o.store_id
  JOIN member_months m
    ON m.consumer_id = o.consumer_id
   AND m.month = date_trunc('month', o.placed_at AT TIME ZONE 'UTC')::date
  WHERE o.status = 'delivered'
    AND o.subtotal_cents - o.promo_cents >=
        CASE WHEN s.vertical = 'restaurant' THEN {{min_restaurant}} ELSE {{min_grocery}} END
  GROUP BY o.consumer_id, m.month
), per_member AS (
  SELECT m.month,
         CASE WHEN m.is_trial THEN 'trial' ELSE 'paid' END AS plan_kind,
         m.price_cents,
         COALESCE(w.n_orders, 0) AS n_orders,
         COALESCE(w.cents, 0)    AS cents
  FROM member_months m
  LEFT JOIN waived w ON w.consumer_id = m.consumer_id AND w.month = m.month
)
SELECT month, plan_kind,
       COUNT(*)                                   AS members,
       SUM(n_orders)                              AS waived_orders,
       SUM(cents)                                 AS fees_waived_cents,
       COUNT(*) FILTER (WHERE cents > price_cents) AS members_ahead,
       ROUND(COUNT(*) FILTER (WHERE cents > price_cents)::numeric / COUNT(*), 4) AS share_ahead
FROM per_member
GROUP BY month, plan_kind
ORDER BY month, plan_kind;
```

**Explanation.** The inner join to `member_months` on the order's UTC month keeps only orders placed while the consumer was a member; delivered status and the minimum (after promotions, per vertical) decide which fees were waived. Summing per member-month first is essential, because "ahead" compares a member's monthly total with that member's price. The LEFT JOIN back onto `member_months` keeps members with no waived order (`COALESCE` to 0), so the share's denominator is every member-month. `plan_kind` keeps trial months apart.

**Complexity.** Hash joins and two hash aggregates: O(n) in orders plus member-months. In production, member-months come from billing periods and the waived amount should come from the order's own fee record rather than be recomputed from a rule.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(placed_at), MONTH)`, `COUNTIF(cents > price_cents)`, `IF(is_trial, 'trial', 'paid')`. Snowflake: `DATE_TRUNC('month', placed_at)::date`, `COUNT_IF`, `IFF`. Spark SQL: `trunc(placed_at, 'MM')`, `count_if`. MySQL 8: `DATE_FORMAT(placed_at, '%Y-%m-01')`, `SUM(cents > price_cents)`.

**Edge cases built into the data.** Every level: member-months with no orders; a member-month whose waived fees equal the price exactly (not ahead), alongside a cancelled qualifying order and an order a cent below the minimum in that month; non-member months with orders; trial months. Hard: promotions on some orders, an order exactly at the minimum after its promotion (qualifies) and one a cent below after its promotion (does not); orders a second either side of a month boundary for a member who joined in the later month. Very Hard: grocery and convenience stores with a higher minimum, an order between the two minimums at a grocery store (not waived) and one exactly at the grocery minimum (waived).

**Common mistakes.** An inner join that drops members who saved nothing; `>=` for "ahead"; summing across all members before comparing with a price; testing the minimum before promotions; one minimum for every vertical; counting cancelled orders; counting non-member orders by joining on consumer only; integer division.

**Follow-up guidance.** (1) Spread an annual price over its months (state the rule), or compare annual waived fees with the annual price per member; a cancelled annual member needs the refund rule, so say which. (2) Compare cohorts that joined before and after the change, or the same members before and after; a rule change and a mix change move the share together. (3) The waiver is revenue forgone only on orders that would have happened anyway; members order more, so the true cost needs a comparison group. (4) Billing periods become rows with `period_start` and `period_end`; join on `placed_at` inside the period rather than on a calendar month.

**Rubric anchors.** 2: totals right but members without orders missing, or "ahead" decided per order. 3: matches the expected result. 4: also distinguishes waived fees from cost and handles annual plans and billing cycles sensibly.

**Strong signals.** Names the grain (member-month) first; asks what a trial month's "price" is; checks that `members` equals the row count of `member_months` for the month. **Red flags.** Stating the minimum or the price as the real programme's terms; ignoring the trial split.

## DSH-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH lines AS (                               -- each order line with the item's state at order time
  SELECT o.order_id, o.store_id, o.placed_at,
         (SELECT t.is_available
          FROM availability_toggles t
          WHERE t.item_id = i.item_id
            AND t.toggled_at <= o.placed_at
            AND (t.store_id = o.store_id
                 OR (t.store_id IS NULL AND t.merchant_id = s.merchant_id))
          ORDER BY t.toggled_at DESC, t.toggle_id DESC
          LIMIT 1) AS is_available
  FROM orders o
  JOIN stores s      ON s.store_id = o.store_id
  JOIN order_items i ON i.order_id = o.order_id
), per_order AS (
  SELECT order_id, store_id, (placed_at AT TIME ZONE 'UTC')::date AS order_date,
         COUNT(*) FILTER (WHERE is_available = false) AS bad_lines
  FROM lines
  GROUP BY order_id, store_id, (placed_at AT TIME ZONE 'UTC')::date
)
SELECT store_id, order_date,
       COUNT(*)                               AS orders,
       COUNT(*) FILTER (WHERE bad_lines > 0)  AS flagged_orders,
       SUM(bad_lines)                         AS flagged_lines
FROM per_order
GROUP BY store_id, order_date
ORDER BY store_id, order_date;
```

**Explanation.** The correlated subquery is the as-of lookup: among the toggles for this item that apply to this store (its own, or its merchant's merchant-wide ones at Very Hard) and are at or before the order, take the latest, with `toggle_id` deciding ties. No row means NULL, and `is_available = false` is not true for NULL, so an item never toggled is available. Aggregating to one row per order before the store-day keeps orders and lines apart. Below Very Hard no toggle has a NULL `store_id`, so the merchant-wide branch never fires and the same query serves every level.

**Complexity.** One index probe per order line with an index on `(item_id, toggled_at)` (or `(store_id, item_id, toggled_at)`): O(L log T). Without an index, O(L·T). In a warehouse, an as-of join is a sort-merge: union lines and toggles, sort by (store, item, time, kind) and carry the last state forward with a window function.

**Dialect notes** (described, not executed). Snowflake: `ASOF JOIN … MATCH_CONDITION (o.placed_at >= t.toggled_at)` handles one scope; ties need care, and merchant-wide toggles need a second as-of join and a comparison. DuckDB also has `ASOF JOIN`. BigQuery: no as-of join; use the union-and-`LAST_VALUE(… IGNORE NULLS)` pattern, or `QUALIFY ROW_NUMBER()` over a join on item and time (expensive). Spark SQL: the union-and-window pattern; a range join hint can help. MySQL 8: a `LATERAL` derived table with `ORDER BY … LIMIT 1`.

**Edge cases built into the data.** Every level: an order before an "off" toggle and one after it; an "off" toggle after every order (ignored); off then back on before an order (available); an order with two unavailable lines; items never toggled. Hard: a toggle at exactly the order time (applies); two toggles at one instant, the higher `toggle_id` saying available; the same item off at another store only. Very Hard: merchant-wide off then a later store-level on (available); store-level off then a later merchant-wide on (available); a merchant-wide off applying to a second store of the merchant; another merchant's merchant-wide toggle (ignored).

**Common mistakes.** `EXISTS` an earlier off toggle (ignores switching back on); `MAX(toggled_at)` and then a join that returns two rows at a tie; `<` instead of `<=`; tie-breaking by the lower id; using toggles from other stores; ignoring merchant-wide toggles, or letting a merchant-wide toggle always beat a store toggle regardless of time; counting lines as orders; dropping store-days with no flagged order.

**Follow-up guidance.** (1) Classify orders within the delay of a toggle as "uncertain" and report them separately, or report a range; do not hide them in either bucket. (2) Partition both sides by store (or item) and date, and use the sort-merge pattern so the join is local; carry the state forward across date boundaries with a daily snapshot of the latest state. (3) Keep the off toggle's time in the as-of lookup and subtract; an item off since before the data starts needs a snapshot or "at least N minutes". (4) Join to fulfilment outcomes per line with one final outcome per line (substituted, refunded, found), chosen by a stated precedence.

**Rubric anchors.** 2: an earlier-off-exists test, or ties and later toggles mishandled. 3: matches the expected result at the level. 4: also explains how to do the as-of join at scale and how to treat toggle delays honestly.

**Strong signals.** Says "as-of join" and names the tie rule before writing; treats no toggle as available on purpose. **Red flags.** Blaming the store or the consumer for the flagged order; claiming the stale menu is the only cause without data.

## DSH-L1-04

**Reference solution**

```python reference
from bisect import bisect_right

WEEK = 7 * 1440


def open_store_counts(hours, orders):
    starts, ends = [], []
    for _store, day, open_min, close_min in hours:
        s = day * 1440 + open_min
        e = day * 1440 + close_min if close_min > open_min else (day + 1) * 1440 + close_min
        if e > WEEK:                       # Sunday night into Monday: split at the week's end
            starts += (s, 0)
            ends += (WEEK, e - WEEK)
        else:
            starts.append(s)
            ends.append(e)
    starts.sort()
    ends.sort()
    out = []
    for t in orders:
        t %= WEEK
        # opened at or before t, minus closed at or before t
        out.append(bisect_right(starts, t) - bisect_right(ends, t))
    return out
```

**Explanation.** Every interval becomes a half-open range `[s, e)` on a line of 10 080 week minutes. An interval that closes before it opens ends on the next day, and if that runs past Sunday midnight the piece after it wraps to Monday morning. At minute `t`, the intervals that contain `t` are exactly those that started at or before `t` minus those that also ended at or before `t` (every interval that has ended has also started). With the starts and the ends sorted separately, both counts are `bisect_right`. Reducing `t` modulo the week handles orders in later weeks. Because a store's own intervals never overlap, open intervals equal open stores, and an all-day store written as seven `(day, 0, 1440)` intervals contributes exactly one at midnight: one interval ends at `t` while the next starts there.

**Complexity.** O(n log n) to sort and O(log n) per order: O((n + q) log n). The timing test (about 22 000 intervals, 20 000 orders) runs in about 0.03 s in CPython. Checking every interval for every order is about 40 s.

**The middle approach.** The most likely middle solution sorts the intervals by start and, per order, scans from the beginning until the starts pass `t`, counting those that have not ended. It is still O(n) per order (half the list on average) and takes about 14 to 17 s on the timing test, so it fails the 8 s limit. A precomputed count for every minute of the week (a difference array of +1 at each start and −1 at each end, then a prefix sum over 10 080 minutes) is O(n + W + q), passes easily and is an excellent answer if the candidate states that it depends on the week having a small, fixed number of minutes. An interval tree also passes but is more than the problem needs.

**Dialect notes.** In Java, two `int[]` arrays with `Arrays.sort` and a hand-written upper-bound binary search. In SQL, the same count is a range join of orders to intervals (`ON t >= s AND t < e`) with a GROUP BY, which is O(n·q) unless the engine has an interval or range-join optimisation; the scalable SQL version is a running sum over a union of +1/−1 events joined back by time. Not executed here.

**Edge cases built into the tests.** An order at the opening minute (open) and at the closing minute (closed); the gap between lunch and dinner; hours on one day not applying to the next; minutes 0 and 10 079; several stores open at once with one closing on the order's minute. Hard: an interval across midnight at 23:59, 00:00, its last minute and its close; Sunday night into Monday morning of the same week; a close of 0 and a close of 1440 on the same day. Very Hard: orders in later weeks; a 24-hour store as adjacent days at midnight; Sunday night into Monday of a later week.

**Common mistakes.** Closed intervals (`t <= e`), which count a store at its closing minute and twice at midnight for an all-day store; treating `close < open` as a mistake or as same-day; forgetting the wrap from Sunday into Monday; `bisect_left` on the ends; not reducing later-week orders modulo the week; checking every interval per order.

**Follow-up guidance.** (1) Keep intervals sorted by start with their ends, or a per-minute list of open store ids for a small W; listing k open stores costs at least O(k). (2) Holiday hours replace a date's weekly hours: put intervals on a calendar line for the period instead of the repeating week, built from weekly hours minus replaced dates plus holiday intervals; the two-bisect query stays the same. (3) Pauses are subtractions: count pauses that contain `t` with the same two-bisect trick and subtract, provided a pause lies inside open hours (state the assumption, otherwise clip pauses to hours first). (4) For a stream, keep the sorted starts and ends (or the per-minute counts) and rebuild only for the store whose hours changed: remove its old intervals and add the new ones (O(n) with lists, O(log n) with a balanced tree or a Fenwick tree over minutes).

**Rubric anchors.** 2: a scan per order, or the closing-minute and midnight rules wrong. 3: all tests pass with two bisects or a per-minute count array. 4: also explains why starts minus ends counts open intervals and handles holiday hours and pauses credibly.

**Strong signals.** Asks whether the interval is half-open and how midnight is written; draws the week line before coding. **Red flags.** Parsing times into `datetime` objects per comparison; assuming the hours are sorted.

## DSH-L1-05

**Reference solution**

```python reference
def repeat_carts(orders):
    last = {}                      # (account, canonical cart) -> most recent order_id
    out = []
    for order_id, account, lines in orders:
        qty = {}
        for line in lines:
            item, q = line[0], line[1]
            opts = tuple(sorted(line[2])) if len(line) > 2 else ()
            qty[(item, opts)] = qty.get((item, opts), 0) + q
        cart = tuple(sorted((k, q) for k, q in qty.items() if q > 0))
        if not cart:
            out.append(None)
            continue
        key = (account, cart)
        out.append(last.get(key))
        last[key] = order_id
    return out
```

**Explanation.** A cart is a multiset of lines, so its canonical form is: add up quantities per line key (the item, with its options sorted so their order does not matter), drop zero quantities, and sort. The sorted tuple is hashable, so `(account, cart)` keys a dictionary whose value is the most recent order with that cart; looking it up before storing the current order gives "the most recent earlier match". An order with no positive line has an empty cart, returns `None` and is never stored, so it can never match. Below Very Hard, `opts` is always `()`, and below Hard there are no repeated items or zero lines, so the same code serves every level.

**Complexity.** O(m log m) per order for its own m lines plus O(m) hashing: O(Σ m log m) overall, independent of how many orders an account has. O(distinct carts) memory. The timing test (two accounts with 25 000 orders each, or 18 000 at Very Hard) runs in about 0.2 to 0.35 s in CPython. Comparing each order with every earlier one of the account, rebuilding the earlier carts each time, takes minutes.

**The middle approach.** The most likely middle solution builds the same canonical tuple but keeps a per-account list of earlier carts and tests `cart in earlier`, then walks back to find the most recent match. Although `in` runs in C and tuple comparison stops early on a length mismatch, it is still O(k) per order, O(k²) per account: on the timing test it takes about 25 to 50 s depending on the level, so it fails the 8 s limit. The test is sized for that: the heavy accounts have tens of thousands of orders, and carts repeat about one time in ten, so most `in` tests scan the whole list. Keying a dict on a sorted string or a `frozenset` of `(item, quantity)` pairs (with quantities summed first) is also O(1) per lookup and accepted.

**Dialect notes.** In Java, build a canonical `String` (or a `List<Map.Entry>` with proper `equals`/`hashCode`) after sorting; a `HashMap<String, Integer>` per line key first. In SQL, the canonical cart is `STRING_AGG(item_id || ':' || qty, ',' ORDER BY item_id)` per order after summing quantities, and the most recent earlier match is `LAG(order_id) OVER (PARTITION BY account_id, cart ORDER BY placed_at)`. Not executed here.

**Edge cases built into the tests.** The same lines in another order (a repeat); a different quantity (not); another account's identical cart (not); two earlier matches (the most recent is returned); a subset of an earlier cart (not). Hard: the same item on two lines adding up to an earlier single line; a zero-quantity line ignored; empty carts returning `None` and never matching. Very Hard: options in another order (same line); the same item with different options (different lines), including a split that adds up to the same cart; an empty options tuple equal to no options.

**Common mistakes.** Comparing raw line lists; a `set` of items, which loses quantities; a `frozenset` of lines before summing repeated items; returning the first earlier match rather than the most recent; storing the order before looking up, which makes every order match itself; matching across accounts; treating an empty cart as a cart that can match; `Counter` objects used as dictionary keys (they are unhashable), or zero quantities kept in the key.

**Follow-up guidance.** (1) Near repeats: index each cart under each of its "one line removed" variants (O(m) keys per cart) and look up the current cart and its own variants; or use MinHash for similarity, stated as approximate. (2) Key on a stable catalogue identifier (a master item behind the menu item), with a mapping table versioned by date; risks are wrong merges and lost matches across the rebuild. (3) Keep the dictionary of the latest order per `(account, cart)` as state, or a table of it; it grows with distinct carts, so expire carts not seen for a stated period. (4) See the dialect notes: a canonical string per order, then `LAG` within `(account, cart)`.

**Rubric anchors.** 2: compares against every earlier order, or ignores quantities or line order. 3: all tests pass with a canonical key in a dictionary. 4: also explains why `in` on a list is quadratic despite running in C, and gives good answers on near repeats and changing ids.

**Strong signals.** Defines cart equality before coding (order, quantities, duplicates, options); looks up before storing. **Red flags.** Hashing to a short digest and trusting it without equality checks; scanning history per order and calling it fast because it is "C speed".
