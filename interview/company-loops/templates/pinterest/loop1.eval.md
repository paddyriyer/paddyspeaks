# Pinterest · Loop 1 — evaluator notes (hidden from candidates)

## PIN-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH imp AS (                          -- the latest load of each pin-day
  SELECT DISTINCT ON (pin_id, impression_date) pin_id, impression_date, impressions
  FROM pin_daily_impressions
  ORDER BY pin_id, impression_date, loaded_at DESC
), imp_week AS (
  SELECT date_trunc('week', i.impression_date)::date AS week_start,
         p.pin_format,
         SUM(i.impressions) AS impressions
  FROM imp i
  JOIN pins p ON p.pin_id = i.pin_id
  GROUP BY 1, 2
), pairs AS (                          -- each (pin, pinner) once, at its first save
  SELECT pin_id, pinner_id, MIN(saved_at) AS first_saved_at
  FROM saves
  GROUP BY pin_id, pinner_id
), savers AS (
  SELECT date_trunc('week', s.first_saved_at)::date AS week_start,
         p.pin_format,
         COUNT(*) AS pin_savers
  FROM pairs s
  JOIN pins p ON p.pin_id = s.pin_id
  GROUP BY 1, 2
)
SELECT w.week_start, w.pin_format, w.impressions,
       COALESCE(s.pin_savers, 0) AS pin_savers,
       ROUND(1000 * COALESCE(s.pin_savers, 0)::numeric / w.impressions, 2) AS savers_per_1k
FROM imp_week w
LEFT JOIN savers s ON s.week_start = w.week_start AND s.pin_format = w.pin_format
ORDER BY w.week_start, w.pin_format;
```

**Explanation.** The two inputs live at different grains (pin-day counts and individual saves), so each is aggregated to (week, format) on its own and then joined; joining saves to daily impression rows first would multiply both sides. Savers are pairs: grouping saves by `(pin_id, pinner_id)` collapses a pinner's several boards into one row, and taking `MIN(saved_at)` makes the pair belong to the week of its first save, which is the Hard rule (below Hard every pair's saves fall in one week, so it changes nothing). The impression side starts from the format-weeks, and a LEFT JOIN keeps formats that earned no savers, with `COALESCE` to 0. `DISTINCT ON … ORDER BY loaded_at DESC` keeps one load per pin-day (a no-op below Very Hard). With the session in UTC, `date_trunc('week', …)` returns the Monday.

**Complexity.** One sort or hash aggregate over saves, one over impression rows, and a small join: O(n log n) at worst. At scale, the first-save state is a table keyed by (pin, pinner) updated incrementally, and the weekly counts come from it.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(saved_at), WEEK(MONDAY))` (plain `WEEK` starts on Sunday); `QUALIFY ROW_NUMBER() OVER (PARTITION BY pin_id, impression_date ORDER BY loaded_at DESC) = 1` instead of `DISTINCT ON`; `ROUND` on `NUMERIC` rounds half away from zero, on `FLOAT64` it is not guaranteed for binary halves. Snowflake: `DATE_TRUNC('week', …)` follows the `WEEK_START` session parameter (default Monday semantics only with 0 or 1), `QUALIFY` again. Spark SQL: `date_trunc('week', …)` is Monday-based; no `DISTINCT ON`. MySQL 8: no `DATE_TRUNC`; use `DATE_SUB(d, INTERVAL WEEKDAY(d) DAY)`.

**Edge cases built into the data.** A pinner who saves one pin to three boards on the same day; a pinner who saves two different pins of the same format in the same week; one format whose pins have impressions and no saves in a week (every level). Hard: two weeks; saves at Sunday 23:59:59 and Monday 00:00:00 UTC; pairs saved again in a later week; a second pinner whose first save is Monday 00:00:00. Very Hard: pin-days loaded two or three times with different counts.

**Common mistakes.** `COUNT(*)` of saves; `COUNT(DISTINCT pinner_id)` per format (undercounts pinners who save several pins); joining saves to daily impressions before aggregating (inflated impressions); an inner join that drops zero-saver formats; counting a pair in every week it was saved; summing every load; Sunday-based weeks; integer division (`1000 * savers / impressions` with integers truncates).

**Follow-up guidance.** (1) `LAG(savers_per_1k) OVER (PARTITION BY pin_format ORDER BY week_start)`; the first week has no previous value (NULL, not 0), and a missing week for a format makes LAG compare non-adjacent weeks unless the weeks are densified first. (2) Formats are shown on different surfaces to different intents; compare within a surface, or report impressions by surface next to the ratio, and show the number of pins behind each rate so a small format is not over-read. (3) Keep a (pin, pinner) first-save table, insert-only on first appearance (a merge that ignores existing keys), and derive weekly counts from it; a pair whose first save was before the window must come from that state, not from the window's MIN. (4) Track which pin-days each load touched, recompute only the affected weeks, and keep a restatement log with the week, old and new value, shown as a footnote on the chart.

**Rubric anchors.** 2: right shape but save rows or distinct pinners counted, or zero-saver formats dropped. 3: matches the expected result. 4: also handles first saves outside the window and restatements credibly.

**Strong signals.** Asks what a "saver" is before writing SQL; aggregates the two inputs separately on purpose; checks the zero row. **Red flags.** Joining at the wrong grain and fixing totals with DISTINCT on impressions; describing the metric as a product's official definition.

## PIN-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH s AS (
  SELECT search_id, pinner_id, entry_point, source_pin_id, searched_at,
         LEAD(searched_at) OVER (PARTITION BY pinner_id ORDER BY searched_at) AS next_searched_at
  FROM visual_searches
), judged AS (
  SELECT s.entry_point,
         date_trunc('week', s.searched_at)::date AS week_start,
         EXISTS (
           SELECT 1
           FROM pin_actions a
           WHERE a.pinner_id = s.pinner_id
             AND a.action IN ('save', 'closeup')
             AND a.action_ts >= s.searched_at
             AND a.action_ts <= s.searched_at + INTERVAL '10 minutes'
             AND (s.next_searched_at IS NULL OR a.action_ts < s.next_searched_at)
             AND a.pin_id IS DISTINCT FROM s.source_pin_id
         ) AS ok
  FROM s
)
SELECT week_start, entry_point,
       COUNT(*)                     AS searches,
       COUNT(*) FILTER (WHERE ok)   AS successful_searches,
       ROUND((COUNT(*) FILTER (WHERE ok))::numeric / COUNT(*), 4) AS success_rate
FROM judged
GROUP BY week_start, entry_point
ORDER BY week_start, entry_point;
```

**Explanation.** Success is a property of a search, so it is decided once per search with a correlated `EXISTS`: same pinner, a save or closeup, at or after the search and at most ten minutes after it. `EXISTS` stops at the first qualifying action, so a search followed by several actions is still one search, which is the most common trap. `LEAD` gives each search the pinner's next search; an action at or after it belongs to that later search (Hard). `IS DISTINCT FROM` excludes actions on the crop's source pin and is NULL-safe for camera and upload searches, whose `source_pin_id` is NULL (Very Hard; below that level no action targets a source pin, so the condition changes nothing). The week comes from `searched_at`, so a Sunday-night search that succeeds after midnight stays in its own week.

**Complexity.** One window sort of searches by pinner and time, and for each search an index range lookup on `pin_actions (pinner_id, action_ts)`: O(s log a). Without that index the planner may hash-join on pinner and filter, still fine at this size.

**Dialect notes** (described, not executed). BigQuery: correlated `EXISTS` is supported but often rewritten as a join on pinner with a time filter and `LOGICAL_OR`; `TIMESTAMP_ADD(searched_at, INTERVAL 10 MINUTE)`; `DATE_TRUNC(DATE(searched_at), WEEK(MONDAY))`. Snowflake: `DATEADD(minute, 10, searched_at)`, `BOOLOR_AGG` over a left join; `IS DISTINCT FROM` exists. Spark SQL: `EXISTS` subqueries are supported in `WHERE` but not always in `SELECT`; use a left semi join on a precomputed set of successful search ids. MySQL 8: `LEAD`, `EXISTS` and `DATE_ADD(…, INTERVAL 10 MINUTE)`; no `IS DISTINCT FROM`, use `NOT (a.pin_id <=> s.source_pin_id)`.

**Edge cases built into the data.** Every level: a search with a closeup and a save; an action at exactly +10:00 and one at +10:01; an action before the search only; an outbound click only; a save by another pinner just after a search; searches with nothing after them. Hard: a pinner's second search a few minutes after the first, with the action after the second (it belongs to the second only); an action at exactly the second search's time; a Sunday 23:5x search whose save comes after Monday 00:00 UTC. Very Hard: crop searches whose only action is on the source pin, and one with an action on the source pin and a save of another pin.

**Common mistakes.** `COUNT(*)` after a join to actions (rates above 1); `BETWEEN` with a strict upper bound, or `<` at 10 minutes; `ABS(action_ts - searched_at) <= 10 minutes` (actions before the search); counting outbound clicks; not cutting at the next search, or cutting with `<=`; `source_pin_id <> pin_id`, which is NULL for camera and upload searches and silently drops all of them; the week of the action instead of the search.

**Follow-up guidance.** (1) Take the first qualifying action per search with `MIN(action_ts)` in a lateral or grouped join, then `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY seconds)`; searches with no save are censored, so report the median among successful searches together with the success rate, never instead of it. (2) Plot the share of first actions by minute after the search; choose the knee and test 5, 10 and 20 minutes; report whether the ranking of entry points is stable across them. (3) Stratify by device or platform (or compare the same pinners across entry points); the raw comparison mixes intent and device. (4) Keep per pinner the open searches of the last 10 minutes (at most a few), keyed by pinner in the stream; an action closes the latest open search; emit each search's outcome when its window closes, with event time and a lateness bound.

**Rubric anchors.** 2: right shape but join rows counted, or one boundary wrong. 3: matches the expected result. 4: also explains why the proxy is a proxy and how to compute it in a stream.

**Strong signals.** Asks which actions count and whether the bound is inclusive; uses EXISTS deliberately; mentions the NULL trap with source pins. **Red flags.** Proposing to store or analyse the searched image or infer anything about the pinner from it; treating the proxy as ground truth.

## PIN-L1-03

**Reference solution** (PostgreSQL; `{{fresh_days}}` is the instance's window)

```sql reference
WITH imp AS (                          -- a retried log is one impression
  SELECT DISTINCT ON (impression_id) impression_id, pin_id, country, impression_ts
  FROM home_feed_impressions
  ORDER BY impression_id, log_id
), aged AS (
  SELECT (i.impression_ts AT TIME ZONE 'UTC')::date AS impression_date,
         i.country,
         i.impression_ts < COALESCE(o.published_at, o.created_at)
                           + INTERVAL '{{fresh_days}} days' AS fresh
  FROM imp i
  JOIN pins p ON p.pin_id = i.pin_id
  JOIN pins o ON o.pin_id = COALESCE(p.original_pin_id, p.pin_id)   -- the original
)
SELECT impression_date, country,
       COUNT(*)                        AS impressions,
       COUNT(*) FILTER (WHERE fresh)   AS fresh_impressions,
       ROUND((COUNT(*) FILTER (WHERE fresh))::numeric / COUNT(*), 4) AS fresh_share
FROM aged
GROUP BY impression_date, country
ORDER BY impression_date, country;
```

**Explanation.** Each impression is joined twice to `pins`: once for the shown pin, once for its original, chosen with `COALESCE(original_pin_id, pin_id)` so originals join to themselves. The age is measured from the original's start (its publish time if scheduled, otherwise its creation; below Very Hard `published_at` is always NULL), and the comparison is written as `impression_ts < start + interval`, so the boundary is exclusive by construction. `DISTINCT ON (impression_id)` removes the client's retried logs before anything is counted (below Hard it is a no-op). With the session in UTC, adding `'N days'` is exactly N × 24 hours, and `AT TIME ZONE 'UTC'` gives the UTC date.

**Complexity.** A sort or hash for the dedupe, two hash joins to pins and a hash aggregate: O(n log n) at worst over the log. At scale, storing each pin's original start on the pin row (denormalised at write time) removes the second join.

**Dialect notes** (described, not executed). BigQuery: `QUALIFY ROW_NUMBER() OVER (PARTITION BY impression_id ORDER BY log_id) = 1`; `TIMESTAMP_ADD(start, INTERVAL n DAY)` (always 24-hour days on `TIMESTAMP`); `COUNTIF`. Snowflake: `DATEADD(day, n, start)` on `TIMESTAMP_TZ` keeps the offset; `QUALIFY`; `COUNT_IF`. Spark SQL: `start + make_interval(0, 0, 0, n)` or `timestampadd(DAY, n, start)`; `count_if`. MySQL 8: `DATE_ADD(start, INTERVAL n DAY)` on `DATETIME` (no zone, so store UTC); no `DISTINCT ON`, use `ROW_NUMBER` in a CTE.

**Edge cases built into the data.** Repins created minutes or hours before the day of old originals (every level, each shown at least once); originals a few days too old and long ago; an impression exactly N days after an original's creation (not fresh) and one of its repin a second earlier (fresh). Hard: two UTC days with impressions at 23:59:59 and 00:00:00; some impressions logged twice. Very Hard: a scheduled pin created long before the window and published inside it, a repin of it, and one published just before the window that ages out during the data.

**Common mistakes.** Using the shown pin's `created_at` (the repin trap); `<=` or `BETWEEN` at the boundary; `impression_ts::date - created_at::date < N` (whole calendar days, not 24-hour periods); counting log rows instead of impressions, or deduping the total but not the fresh count; `created_at` instead of the publish time for scheduled pins; dates in a non-UTC session zone.

**Follow-up guidance.** (1) `COUNT(*) FILTER (WHERE p.original_pin_id IS NOT NULL)`; a repin share measures how much of the feed is re-circulation, which overlaps with but is not the same as staleness (a fresh original can be repinned within the hour). (2) A chain needs the root: a recursive CTE per query is expensive at scale; better to store `root_pin_id` on each pin when the repin is created (a write-time lookup of one row). (3) Define relevance by aggregate signals (saves of the pin in the last weeks across all pinners, season-over-season interest) rather than by any individual's history; report both "fresh by creation" and "recently resurging" as separate aggregates. (4) Denormalise the original's start onto the impression at logging or in a daily enrichment that reads only the pins seen that day (a semi-join on the day's distinct pin ids), partition the log by date, and keep the result as a per-day, per-country aggregate.

**Rubric anchors.** 2: right shape but repins dated by themselves, or the boundary inclusive. 3: matches the expected result. 4: also handles chains and scale with a stored root, and keeps the measure aggregate.

**Strong signals.** Restates the repin rule before writing SQL; writes the window as an exclusive upper bound; checks for duplicate impression ids unprompted. **Red flags.** Treating the measure as an input to ranking individuals; inferring anything about viewers from what they were shown.

## PIN-L1-04

**Reference solution**

```python reference
from bisect import bisect_left


def distinct_savers(saves, queries):
    by_pin = {}
    for pin, day, who in saves:
        by_pin.setdefault(pin, []).append((day, who))
    asks = {}
    for qi, (pin, first, last) in enumerate(queries):
        if first <= last and pin in by_pin:              # everything else stays 0
            asks.setdefault(pin, []).append((last, first, qi))
    out = [0] * len(queries)
    for pin, qs in asks.items():
        ev = by_pin[pin]
        ev.sort(key=lambda e: e[0])                      # saves by day
        days = sorted({d for d, _ in ev})
        pos = {d: i + 1 for i, d in enumerate(days)}     # Fenwick index of each distinct day
        n = len(days)
        tree = [0] * (n + 1)
        latest = {}                                      # pinner -> latest save day swept so far
        qs.sort()                                        # by last_day
        j, m = 0, len(ev)
        for last, first, qi in qs:
            while j < m and ev[j][0] <= last:
                d, who = ev[j]
                j += 1
                prev = latest.get(who)
                if prev == d:
                    continue
                if prev is not None:                     # move the pinner's mark to day d
                    i = pos[prev]
                    while i <= n:
                        tree[i] -= 1
                        i += i & -i
                i = pos[d]
                while i <= n:
                    tree[i] += 1
                    i += i & -i
                latest[who] = d
            i, before = bisect_left(days, first), 0      # marks on days < first
            while i > 0:
                before += tree[i]
                i -= i & -i
            out[qi] = len(latest) - before
    return out
```

**Explanation.** Distinct counts are not additive, so prefix counts cannot be subtracted. The offline trick: answer queries in order of `last_day` while sweeping saves in day order, and keep exactly one mark per pinner, on the day of their latest save so far. After sweeping every save up to `last_day`, a pinner saved within `[first_day, last_day]` if and only if their latest save so far is on a day ≥ `first_day`: if they saved in the range, their latest save is at least that day; if their latest save up to `last_day` is before `first_day`, they did not save in the range. So the answer is the number of marks on days ≥ `first_day`, which is the number of pinners seen minus the marks before `first_day`. Marks move, so the count needs point updates and prefix sums: a Fenwick tree over the distinct days, with `bisect_left` turning `first_day` into a prefix length (it works for days with no saves). Queries are grouped per pin, so pins never mix, and empty, reversed or unknown-pin queries stay 0.

**Complexity.** O(n log n + q log q + (n + q) log D) time for n saves, q queries and D distinct days, O(n + D) memory. The timing test (200 000 saves, 50 000 ranges, 3 000 days) runs in about 0.6–0.9 s in CPython. A set built per range took about 10 s for only 2 000 of the 50 000 ranges (several minutes in all). The most likely middle approach, unions of per-day pinner sets, is no better (each range still touches every day in it). Mo's algorithm, O((n + q)·√n), is a legitimate sublinear answer but took 11–15 s here, so it fails the test; credit the idea in discussion, not as a pass.

**Dialect notes.** In Java or C++ the Fenwick tree is an `int[]` and the queries an array of indices sorted by right end; pinner ids should be interned to ints first. In SQL the same question is `COUNT(DISTINCT pinner_id)` with a range join of queries to saves (O(q·len) again), or a precomputed table of each pinner's first save per day for fixed ranges only. Spark: approximate per-day sketches (`approx_count_distinct` on HLL++ states) merged per range. Not executed here.

**Edge cases built into the tests.** Repeat saves by one pinner in a range; both bounds inclusive; a one-day range; a range between saves (0); a pinner whose earlier save is in the range and later one is not; the same range asked twice and queries out of order. Hard: unsorted saves, many saves by one pinner on one day, `first_day > last_day` (0), ranges before or after all data (0). Very Hard: one pinner saving two pins (counted per pin), a pin with no saves (0), interleaved queries across pins.

**Common mistakes.** `prefix(b) − prefix(a − 1)` with distinct counts; marking a pinner's first save instead of the latest (then the sweep must be by left end, mirrored); forgetting to remove the previous mark; indexing the tree by raw day numbers without compression and off by one at day 0; returning answers in sorted order; mixing pins in one tree.

**Follow-up guidance.** (1) Invariant: after the sweep reaches `last_day`, each pinner seen has exactly one mark, on their latest save ≤ `last_day`; they saved in the range iff that mark is ≥ `first_day`. (2) Online: a persistent segment tree keeps one version per day (O(log D) new nodes per mark move); a query reads version `last_day` and counts marks ≥ `first_day`, O(log D) per query and O(n log D) memory. (3) Store an HLL sketch per pin per day; a range merges up to D sketches (or uses a sparse table of merged sketches for O(1) merges per query); relative error about 1.04/√m for m registers, and for small counts use exact sets (sparse representation). (4) A deletion removes a save; if it was the pinner's latest in a version, the mark moves back to their previous save; offline, recompute with the deleted rows filtered; decide with product whether "savers" means current or historical savers, and say so on the chart.

**Rubric anchors.** 2: correct small cases with a set per range, or a prefix-difference idea that fails on repeat savers. 3: all tests pass with the offline sweep and a Fenwick or segment tree. 4: also proves the invariant and handles online queries or sketches credibly.

**Strong signals.** Says early that distinct counts do not subtract; asks whether queries are offline; compresses the days. **Red flags.** Presenting an approximate count as exact; exposing who saved to the creator.

## PIN-L1-05

**Reference solution**

```python reference
def busier_lookback(rows):
    per = {}
    for pin, day, saves in rows:                 # a day split over rows adds up
        d = per.setdefault(pin, {})
        d[day] = d.get(day, 0) + saves
    out = {}
    for pin, d in per.items():
        stack, res = [], []                      # (day, saves) with strictly decreasing saves
        for day in sorted(d):
            s = d[day]
            while stack and stack[-1][1] <= s:   # never busier than today, nor than any later day that beats today
                stack.pop()
            res.append(day - stack[-1][0] if stack else 0)
            stack.append((day, s))
        out[pin] = res
    return out
```

**Explanation.** For each day the answer is the previous strictly greater element. Once day `j` is followed by a day `k` with at least as many saves, `j` can never be the answer for any day after `k`: any later day that `j` beats, `k` beats too, and `k` is closer. So the candidates form a stack of strictly decreasing saves; each day pops the candidates it ties or beats (`<=`, because an equal day is not busier), reads the busier day from the top, and pushes itself. Each day is pushed and popped at most once. Grouping into a per-pin dict sums split days and makes row order irrelevant; sorting the days gives day order, and the difference of day numbers gives calendar days across gaps (a missing day had no saves, so it is never a candidate).

**Complexity.** O(n log n) for sorting each pin's days plus O(n) for the stack (O(n) overall if rows arrive sorted), O(n) memory. The timing test (100 pins × 3 000 days, 300 000 values) runs in about 0.1–0.6 s in CPython (the upper end with unordered rows to group and sort). Scanning back from each day took about 21–22 s on the same data, because most pins open with a launch spike and then climb with long plateaus, so the scan runs to day 1. The most likely middle approach, a scan back that first checks the running maximum (and returns 0 for a record), still took about 16 s: the slow climb sits below the spike, so few days are records and most scans are still long. Following earlier answers as jump pointers (`j = i − 1; while vals[j] <= vals[i]: j -= jump[j]`) is amortised linear and passes; it is the stack in disguise. A sparse table with binary search is O(n log n) and also passes.

**Dialect notes.** Java: `ArrayDeque<int[]>` as the stack; C++: `vector<pair<int,int>>`. In SQL, "previous greater" has no direct window function; a correlated `MAX(day) … WHERE saves > current` subquery is O(n²) per pin, and a recursive approach is worse, so this belongs in a UDF or a per-pin `applyInPandas` in Spark. Not executed here.

**Edge cases built into the tests.** A single day; equal days that must be skipped; a falling series (all 1s); a rising series (all 0s); a launch spike far back past a climb; a dip and recovery. Hard: gaps where the lookback is in calendar days; listed days with 0 saves; two pins that must not see each other. Very Hard: rows in any order; a day split over two rows whose sum makes it the busier day; interleaved rows of two pins with a split day.

**Common mistakes.** Popping with `<` (an equal day is reported as busier); returning the list-position difference instead of the day difference with gaps; returning `i + 1` or `None` for "none" instead of 0; keeping the last row of a split day instead of summing; sorting the whole input by saves; mixing pins; scanning back from every day.

**Follow-up guidance.** (1) If `j` is popped by `k` (saves[j] ≤ saves[k], j < k), then for any later day `i` with saves[i] < saves[j], also saves[i] < saves[k] and `k` is nearer, so `j` is never the latest busier day. (2) Run the same stack from the right for the next busier day (or record, when a day is popped, that the popping day is its next greater-or-equal); "held the record for N days" is the next strictly greater day minus today. (3) Store each pin's stack after the nightly run (it is short for most pins: strictly decreasing saves); a new day pops and pushes against the stored stack, O(1) amortised per day; recompute only when a late correction changes an old day. (4) A board's daily total is a new series; summing pins per day is a group-by first. If a pin is added to a board later, decide whether its history before joining counts and version the definition; restating history changes old annotations.

**Rubric anchors.** 2: correct with a scan back, or one rule wrong (equal days, gaps, split days). 3: all tests pass with a monotonic stack or jump pointers. 4: also proves the invariant and handles the forward and incremental variants.

**Strong signals.** Asks whether equal counts are busier; notices the adversarial shape (launch spike then slow climb); names the previous-greater-element pattern. **Red flags.** Presenting the annotation as a judgement about the creator; looking at who saved.
