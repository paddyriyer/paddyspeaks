# Snowflake · Loop 1 — evaluator notes (hidden from candidates)

## SNO-L1-01

**Reference solution** (PostgreSQL; `{{report_date}}`, `{{baseline_days}}`, `{{min_runs}}`, `{{factor}}` and `{{min_excess_ms}}` are the instance's values; `{{min_excess_ms}}` is 0 below Very Hard)

```sql reference
WITH runs AS (
  SELECT query_id, query_hash, warehouse_size, start_time,
         total_elapsed_ms - queued_ms AS exec_ms
  FROM query_history
  WHERE execution_status = 'SUCCESS'
), baseline AS (
  SELECT query_hash, warehouse_size,
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY exec_ms) AS p90,
         COUNT(*) AS runs
  FROM runs
  WHERE start_time >= DATE '{{report_date}}' - {{baseline_days}}
    AND start_time <  DATE '{{report_date}}'
  GROUP BY query_hash, warehouse_size
  HAVING COUNT(*) >= {{min_runs}}
)
SELECT r.query_id, r.query_hash, r.warehouse_size, r.exec_ms,
       ROUND(b.p90::numeric, 1) AS baseline_p90_ms,
       b.runs AS baseline_runs
FROM runs r
JOIN baseline b ON b.query_hash = r.query_hash AND b.warehouse_size = r.warehouse_size
WHERE r.start_time >= DATE '{{report_date}}'
  AND r.start_time <  DATE '{{report_date}}' + 1
  AND r.exec_ms > {{factor}} * b.p90
  AND r.exec_ms - b.p90 >= {{min_excess_ms}}
ORDER BY r.query_hash, r.exec_ms DESC, r.query_id;
```

**Explanation.** One CTE defines a run once (successful, execution time without the queue), so the baseline and the report day cannot disagree about it. The baseline is a plain aggregate over a half-open window that ends where the report day starts, so a regression on the report day cannot raise its own threshold. `HAVING` drops fingerprints with too little history; the inner join then drops their report-day runs. The comparison uses the unrounded p90; only the output is rounded. Below Very Hard each fingerprint runs on one warehouse size, so grouping by `(query_hash, warehouse_size)` is the same as grouping by `query_hash`; at Very Hard the size is part of the baseline's key and the absolute-excess guard applies. A candidate who groups by `query_hash` only below Very Hard is correct.

**Complexity.** One scan, a sort per fingerprint for the percentile (the baseline window is small per fingerprint) and a hash join: O(n log n) in the window's rows. In production the baseline is a daily table (fingerprint, size, day) of pre-aggregated sketches, not a re-scan of N days.

**Dialect notes** (described, not executed). Snowflake: `PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY exec_ms)` exists and also works as a window function; `APPROX_PERCENTILE` uses a sketch and is not exact; `DATEADD(day, -7, '2026-09-24'::date)`; the account-usage query history reports times in milliseconds with queue components in separate columns (check current docs for the exact column set). BigQuery: `PERCENTILE_CONT(x, 0.9) OVER (PARTITION BY …)` is analytic only, so compute it in a subquery with `ANY_VALUE`, or use `APPROX_QUANTILES(x, 10)[OFFSET(9)]` (approximate). Spark SQL: `percentile(x, 0.9)` is exact with interpolation, `percentile_approx` is not. MySQL 8: no percentile function; emulate with `ROW_NUMBER()` and `COUNT(*)` per fingerprint and interpolate by hand.

**Edge cases built into the data.** Every level: a run that is slow only because it queued; a fingerprint with exactly `min_runs` baseline runs and a clear outlier. Hard: failed runs on the report day and failed baseline runs that would lift the p90; a fingerprint with 11 baseline runs, so the p90 is exactly the 10th value, with one run at exactly factor × p90 and one a millisecond above; a run exactly at the window start (needed to reach `min_runs`) and one a second before it; an outlier in the last second of the report day and a huge run at the next midnight; a fingerprint one run short of the minimum, with another run just before the window. Very Hard: one fingerprint on a large and an extra-small warehouse with a six-fold difference; a tiny fingerprint with a large ratio but a small absolute excess; runs at exactly the minimum excess and one millisecond below it.

**Common mistakes.** Comparing `total_elapsed_ms`; including the report day (or all history) in the baseline; a closed window (`BETWEEN`) or `start_time::date` comparisons that are right by accident; `>=` against factor × p90; comparing with the rounded p90; `PERCENTILE_DISC`, `AVG` or `MEDIAN` instead of `PERCENTILE_CONT(0.9)`; counting failed runs; `min_runs` off by one; mixing warehouse sizes (Very Hard); a window function `PERCENTILE_CONT … OVER (PARTITION BY query_hash)` over the whole table, which includes the report day.

**Follow-up guidance.** (1) A slow drift moves the baseline with it; compare the recent p90 with an older reference window (week over week, or a fixed release baseline) and alert on the ratio, or use a change-point test on daily p50/p90. (2) Execution time scales with data scanned; normalise by bytes scanned or partitions scanned, or compare within buckets of scanned size, and say that a "slow" query may simply have been asked a bigger question. (3) Keep a daily per-(fingerprint, size) summary — a t-digest/KLL sketch or a sorted sample — and merge N days of sketches; approximate percentiles are fine for alerting if the error is stated. (4) Page only on a repeated, material regression: several outliers within an hour, an absolute excess, and no warehouse resize or plan change that explains it; measure precision on past alerts before paging anyone.

**Rubric anchors.** 2: a plausible percentile baseline, but the report day leaks into it, or queue time is included, or the window edges are wrong. 3: matches the expected result. 4: also explains drift, normalisation by data scanned and an incremental, sketch-based baseline.

**Strong signals.** Asks what "slow" means before writing SQL; separates queueing (capacity) from execution (the query); keeps the baseline strictly before the report day. **Red flags.** One global threshold for every query; averaging percentiles of percentiles; treating approximate percentiles as exact.

## SNO-L1-02

**Reference solution** (PostgreSQL; `{{from_month}}` and `{{to_month}}` are the instance's first and last report months)

```sql reference
WITH counted AS (                      -- one row per covered query, paid if any paid entitlement covers it
  SELECT q.query_id, q.listing_id, q.consumer_account, q.query_ts,
         BOOL_OR(e.kind = 'paid') AS is_paid
  FROM listing_queries q
  JOIN listings l ON l.listing_id = q.listing_id
  JOIN entitlements e
    ON e.listing_id = q.listing_id
   AND e.consumer_account = q.consumer_account
   AND e.starts_at <= q.query_ts
   AND (e.ends_at IS NULL OR q.query_ts < e.ends_at)
  WHERE q.consumer_account <> l.provider_account
  GROUP BY q.query_id, q.listing_id, q.consumer_account, q.query_ts
), first_use AS (
  SELECT listing_id, consumer_account,
         date_trunc('month', MIN(query_ts))::date AS first_month
  FROM counted
  GROUP BY listing_id, consumer_account
), monthly AS (
  SELECT date_trunc('month', query_ts)::date AS month,
         listing_id, consumer_account, BOOL_OR(is_paid) AS paid
  FROM counted
  GROUP BY 1, 2, 3
)
SELECT m.month, m.listing_id,
       COUNT(*)                                       AS consumers,
       COUNT(*) FILTER (WHERE m.paid)                 AS paid_consumers,
       COUNT(*) FILTER (WHERE NOT m.paid)             AS trial_only_consumers,
       COUNT(*) FILTER (WHERE f.first_month = m.month) AS new_consumers
FROM monthly m
JOIN first_use f USING (listing_id, consumer_account)
WHERE m.month BETWEEN DATE '{{from_month}}' AND DATE '{{to_month}}'
GROUP BY m.month, m.listing_id
ORDER BY m.month, m.listing_id;
```

**Explanation.** The interval join keeps only queries an entitlement covers, half-open at `ends_at`. A query covered by an overlapping trial and paid entitlement appears twice after the join, so the first CTE groups back to one row per query and lets paid win with `BOOL_OR`. Every metric is then a count at the (month, listing, account) grain, which makes "distinct" structural rather than a `COUNT(DISTINCT …)` per column, and makes trial-only exactly "not paid". The first counted query per (listing, account) is computed over all history, before the report-month filter, so an account first seen before the window is never new inside it. The provider's own account is excluded before anything else.

**Complexity.** The interval join is the cost: with an index or clustering on `(listing_id, consumer_account)` it is a merge of each pair's few entitlements with its queries, O(n log n) overall. Two small aggregations follow.

**Dialect notes** (described, not executed). Snowflake: `BOOLOR_AGG`, `DATE_TRUNC('month', ts)` returns the same type as its input; `COUNT_IF`. BigQuery: `LOGICAL_OR`, `DATE_TRUNC(DATE(ts), MONTH)`, `COUNTIF`; range joins are fine at this size but large interval joins benefit from pre-bucketing. Spark SQL: `bool_or`, `trunc(ts, 'MM')`; a range join may need a bin column for performance. MySQL 8: `MAX(kind = 'paid')`, `DATE_FORMAT(ts, '%Y-%m-01')`, `SUM(CASE …)`.

**Edge cases built into the data.** Every level: an account that converts from trial to paid inside one month (paid, not trial-only). Hard: a query exactly at a trial's `starts_at` (counted) and one exactly at its `ends_at` in the next month (not counted); queries after a trial lapsed and before any entitlement; a trial and a paid entitlement overlapping with the account's only query of the month in the overlap; the last second of July and the first second of August. Very Hard: the provider's own account with an entitlement and queries in every month; an account first seen in May with queries in June and July (not new in June); an account whose first query is the first second of June (new in June).

**Common mistakes.** `trial_only` as "had a trial query" so the columns overlap; `BETWEEN starts_at AND ends_at`; ignoring NULL `ends_at` (so open-ended subscriptions vanish); counting the joined rows (an overlap counts the query twice, harmless only with `DISTINCT`); counting queries with no entitlement; computing "new" after filtering months; letting the provider count as a consumer; `COUNT(DISTINCT consumer_account) FILTER (WHERE is_paid)` combined with a trial count that is not exclusive.

**Follow-up guidance.** (1) Cohort by the trial's `starts_at` month; conversion = accounts with a paid query within 30 days of trial start ÷ cohort size; state that late conversions after 30 days are not counted and that the most recent cohort is incomplete. (2) Precompute daily (listing, account, day, paid) usage: the interval join then runs on a few rows per account per day; cluster by listing and date; months are rollups of days with distinct accounts recomputed (not summed). (3) Counting organisations needs a mapping the provider knows (billing entity) or one the platform exposes; without it, report accounts and say so. (4) Show counts, not query text or columns used; suppress or bucket counts below a threshold (for example fewer than 3 consumers), and never let a filter isolate one consumer.

**Rubric anchors.** 2: right grain but trial-only overlaps paid, or uncovered queries count, or open-ended entitlements are lost. 3: matches the expected result. 4: also designs the cohort conversion metric and the precomputation, and raises small-count privacy unprompted.

**Strong signals.** Declares the grain (month, listing, account) before writing; asks how overlapping entitlements resolve; checks that paid plus trial-only equals consumers. **Red flags.** Summing monthly distinct counts into a quarter; treating the consumption log as if it revealed consumers' queries to the provider.

## SNO-L1-03

**Reference solution** (PostgreSQL; `{{start_date}}` and `{{end_date}}` are the instance's first and last report days)

```sql reference
WITH spine AS (
  SELECT d::date AS day, d + INTERVAL '1 day' AS snap
  FROM generate_series(DATE '{{start_date}}'::timestamptz,
                       DATE '{{end_date}}'::timestamptz,
                       INTERVAL '1 day') AS d
), ev AS (
  SELECT e.table_name, e.event_ts, e.event_type, e.bytes,
         SUM(CASE e.event_type WHEN 'ADD' THEN e.bytes WHEN 'REMOVE' THEN -e.bytes ELSE 0 END)
           OVER (PARTITION BY e.table_name ORDER BY e.event_ts, e.event_id) AS active_running
  FROM storage_events e
), flows AS (                          -- signed change to active storage; removals as chunks
  SELECT ev.table_name, ev.event_ts,
         CASE WHEN ev.event_type = 'ADD' THEN ev.bytes ELSE 0 END AS added,
         CASE ev.event_type WHEN 'REMOVE' THEN ev.bytes
                            WHEN 'DROP'   THEN ev.active_running   -- everything active at the drop
                            ELSE 0 END AS removed,
         ev.event_ts + make_interval(days => s.retention_days) AS tt_end,
         ev.event_ts + make_interval(days => s.retention_days
                       + CASE WHEN s.table_kind = 'PERMANENT' THEN 7 ELSE 0 END) AS fs_end
  FROM ev
  JOIN table_settings s ON s.table_name = ev.table_name
)
SELECT sp.day, s.table_name,
       COALESCE(SUM(f.added - f.removed), 0)                                       AS active_bytes,
       COALESCE(SUM(f.removed) FILTER (WHERE sp.snap < f.tt_end), 0)               AS time_travel_bytes,
       COALESCE(SUM(f.removed) FILTER (WHERE sp.snap >= f.tt_end AND sp.snap < f.fs_end), 0) AS failsafe_bytes
FROM spine sp
CROSS JOIN table_settings s
LEFT JOIN flows f ON f.table_name = s.table_name AND f.event_ts < sp.snap
GROUP BY sp.day, s.table_name
ORDER BY sp.day, s.table_name;
```

**Explanation.** The spine gives every (day, table) pair, including days before a table's first event. Each event becomes a flow: bytes added to active storage, or a removed chunk with the two instants at which it leaves time travel and fail-safe. A chunk removed at `t` is in time travel while `snapshot < t + retention` and in fail-safe while `t + retention ≤ snapshot < t + retention + F`, with F = 0 for transient tables; a chunk past `fs_end` contributes nothing. The left join keeps only flows strictly before the snapshot. A `DROP` has no byte count in the log; the running sum of signed `ADD`/`REMOVE` bytes up to the drop (the window function) is exactly what was active, and because a dropped table has no later events, subtracting it leaves zero.

**Complexity.** The spine join is O(days × events) in this form, which is fine for a sample and a few weeks; at scale, compute per-table daily deltas (bytes entering and leaving each state per day) and take running sums over days, which is O(events + days × tables) with no join between them.

**Dialect notes** (described, not executed). Snowflake: build the spine with `GENERATOR(ROWCOUNT => n)` and `DATEADD`, `DATEADD(day, retention_days, event_ts)`; the platform's own storage metrics views already report active, time-travel and fail-safe bytes per table (check current docs) — this exercise rebuilds them from a log. BigQuery: `UNNEST(GENERATE_DATE_ARRAY(...))`, `TIMESTAMP_ADD(ts, INTERVAL n DAY)`. Spark SQL: `explode(sequence(start, end, interval 1 day))`, `ts + make_interval(0, 0, 0, n)`. MySQL 8: a recursive CTE for the spine, `DATE_ADD(ts, INTERVAL n DAY)`.

**Edge cases built into the data.** Every level: events weeks before the range whose bytes are still in fail-safe; tables with several retention values; a table may first appear during the range (zeros before). Hard: transient tables (retention 0 or 1, no fail-safe); a permanent table with retention 0 (straight to fail-safe); a removal at an exact midnight that reaches fail-safe exactly at a snapshot, another that is purged exactly at a snapshot, and an `ADD` exactly at a snapshot instant. Very Hard: one or two tables dropped during the range, with `bytes` NULL.

**Common mistakes.** Snapshot at the start of the day; `<=` at the end of a period; dropping fail-safe entirely or giving it to transient tables; only reporting days with events (no spine) or only tables with events; ignoring events before the range; treating NULL `bytes` on `DROP` as 0 (the `SUM` silently ignores it); computing active bytes with `SUM(bytes)` across all event types.

**Follow-up guidance.** (1) Under this model each chunk carries the retention in force when it was removed; a real platform documents how a change applies to data already in time travel (check current docs), so the log would need retention-change events and the rule for existing chunks. (2) Byte-days = sum of daily snapshots (or exact integration between events: bytes × seconds / 86 400); a daily sample misses data that lived less than a day; a bill is usually based on an average over the month. (3) Keep a daily state table per table and update it from yesterday's state plus today's events, plus the chunks whose periods end today (a calendar of `tt_end`/`fs_end` dates). (4) The 40 TB moved from active to time travel at the deletion, stays billed through retention and fail-safe, and leaves the bill only `retention + 7` days later; give the dates and the expected curve.

**Rubric anchors.** 2: right totals for days with events, but no spine, or the boundaries are off by a day, or fail-safe is missing. 3: matches the expected result. 4: also explains the byte-day integration, an incremental daily state and the delayed bill drop with dates.

**Strong signals.** Draws the timeline for one removed chunk before writing SQL; asks whether period ends are inclusive; notices that a NULL in `SUM` disappears silently. **Red flags.** Claiming storage is freed at delete time; hard-coding table names or dates in `CASE` expressions.

## SNO-L1-04

**Reference solution**

```python reference
import heapq
from collections import deque


def plan_warehouses(tasks, horizon):
    by_id = {t[0]: t for t in tasks}
    children = {}
    for t in tasks:
        for p in t[5]:
            children.setdefault(p, []).append(t[0])
    runs = []                                         # (start, task_id, size, end)
    for root, size, first, every, dur, after in tasks:
        if after:
            continue
        # The graph of this root in topological order (Kahn, within the graph).
        members, q = {root}, deque([root])
        while q:
            for c in children.get(q.popleft(), ()):
                if c not in members:
                    members.add(c)
                    q.append(c)
        indeg = {m: len(by_id[m][5]) for m in members}
        order, q = [], deque([root])
        while q:
            m = q.popleft()
            order.append(m)
            for c in children.get(m, ()):
                indeg[c] -= 1
                if indeg[c] == 0:
                    q.append(c)
        finish = None                                 # end of the last graph run that ran
        s = first
        while s < horizon:
            if finish is None or finish <= s:         # skip while the previous run is still going
                ends = {}
                for m in order:
                    t = by_id[m]
                    st = s if m == root else max(ends[p] for p in t[5])
                    ends[m] = st + t[4]
                    runs.append((st, m, t[1], ends[m]))
                finish = max(ends.values())
            s += every
    runs.sort(key=lambda x: (x[0], x[1]))
    busy, free, count, out = {}, {}, {}, []
    for st, tid, size, end in runs:
        b = busy.setdefault(size, [])
        f = free.setdefault(size, [])
        while b and b[0][0] <= st:                    # warehouses finished by now
            heapq.heappush(f, heapq.heappop(b)[1])
        if f:
            no = heapq.heappop(f)                     # lowest-numbered free warehouse
        else:
            no = count[size] = count.get(size, 0) + 1
        heapq.heappush(b, (end, no))
        out.append((tid, st, no))
    return count, out
```

**Explanation.** Two phases. Expansion: each root's schedule is walked minute by minute of its period (not minute by minute of the horizon); the skip rule needs only the end of the last graph run that ran, compared with `<=` because a run ending exactly at the next scheduled minute does not block it. For a standalone task the graph is just the root; for a graph, children are computed in a topological order of that graph so every predecessor's end is known, and the graph run's end is the maximum end of its members. Assignment: runs in `(start, task_id)` order; per size, a heap of busy `(end, number)` pairs releases every warehouse with `end ≤ start` into a heap of free numbers, and the smallest free number is taken, or a new one opened. This is classic interval partitioning: a new number is opened only when every open warehouse is busy at that start, so the count equals the peak number of simultaneous runs.

**Complexity.** O(R log R) time for R runs (the sort and the heap operations), O(R) memory for the output. The timing test (6 000 tasks over three days, about 85 000–140 000 runs, about 4 500 warehouses of one size busy at the peak) ran in 0.5–1.0 s in CPython; the same algorithm scanning warehouses 1, 2, 3, … for the first free one took 10–16 s.

**Dialect notes.** Java: `PriorityQueue<int[]>` for busy `(end, no)` and `PriorityQueue<Integer>` (or a `TreeSet`) for free numbers. C++: `priority_queue` with `greater<>`, or `std::set<int>` for free numbers. In SQL the count alone is a sweep (`SUM(+1/−1) OVER (ORDER BY t)` and its maximum); the lowest-free assignment is sequential and does not express well. Not executed here.

**Edge cases built into the tests.** A warehouse freed at `t` reused at `t`; equal start times decided by `task_id`; the lowest free number when two are free (not the most recently freed); a run scheduled exactly at the horizon (not run); (Hard) sizes as separate pools; a run longer than its period (later runs skipped until it finishes); a run ending exactly at the next scheduled minute (not skipped); a run that starts before the horizon and ends after it; (Very Hard) a child with two predecessors of different lengths; an unfinished graph run that skips the next graph run while another task carries on; a graph run ending exactly at the next scheduled minute.

**Common mistakes.** `<= horizon`; skipping when the previous run ends exactly at the scheduled minute; shifting the schedule after a skip; treating `[start, end]` as closed; reusing the most recently freed warehouse (a stack) instead of the lowest number; one pool for all sizes; computing child starts in input order before their predecessors; applying the skip rule to the root alone instead of the whole graph run; a loop over every minute of the horizon for every task; scanning warehouses linearly.

**Follow-up guidance.** (1) At the moment the k-th warehouse opens, k − 1 warehouses are busy with runs that started at or before this start and end after it, so k runs overlap at that instant; hence k ≤ peak, and any assignment needs at least the peak. (2) With a resume cost and a minimum billed minute, short gaps are cheaper to bridge than to suspend; the objective becomes billed minutes, not warehouse count, and packing several small runs on one multi-cluster or larger warehouse may be cheaper (measure queueing). (3) Offsets: a local search or a min-max load heuristic over period slots; finding offsets that minimise the peak is hard in general, so state a heuristic and measure it against the lower bound `ceil(Σ duration/every)` per size. (4) Consolidate tasks with low concurrency and small working sets onto a shared warehouse; check queue time, run time and credits for a week before and after.

**Rubric anchors.** 2: right counts on samples but a closed interval, a wrong skip boundary, or a linear scan. 3: all tests pass with the two heaps per size. 4: also proves the greedy optimal and reasons about resume cost and offsets.

**Strong signals.** Separates schedule expansion from assignment; asks what happens to an overlapping run before coding; tests the lowest-number rule with a small hand case. **Red flags.** Simulating every minute of a three-day horizon for every task; claiming the count is the number of tasks.

## SNO-L1-05

**Reference solution**

```python reference
import re

WINDOW = 64 * 86400                     # load metadata is remembered for 64 days


def _glob(p):
    out, i, n = [], 0, len(p)
    while i < n:
        c = p[i]
        if c == '*':
            if i + 1 < n and p[i + 1] == '*':  # ** crosses directories
                out.append('.*')
                i += 2
                continue
            out.append('[^/]*')
        elif c == '?':
            out.append('[^/]')
        elif c == '[':
            j = p.index(']', i + 1)
            body = p[i + 1:j]
            out.append('[^/' + body[1:] + ']' if body.startswith('!') else '[' + body + ']')
            i = j + 1
            continue
        else:
            out.append(re.escape(c))
        i += 1
    return re.compile(''.join(out))


def select_files(files, history, patterns, now, load_uncertain):
    inc = [_glob(p) for p in patterns if not p.startswith('!')]
    exc = [_glob(p[1:]) for p in patterns if p.startswith('!')]
    known = {}                          # path -> etags loaded, among remembered records
    for path, etag, loaded_at, status in history:
        if now - loaded_at < WINDOW:
            s = known.setdefault(path, set())
            if status == 'LOADED':
                s.add(etag)
    out = []
    for path, etag, modified in files:
        if not any(r.fullmatch(path) for r in inc) or any(r.fullmatch(path) for r in exc):
            continue
        if path in known:
            st = 'SKIP_LOADED' if etag in known[path] else 'LOAD'
        elif now - modified >= WINDOW and not load_uncertain:
            st = 'SKIP_UNCERTAIN'
        else:
            st = 'LOAD'
        out.append((path, st))
    out.sort()
    return out
```

**Explanation.** Each glob is translated once into a regular expression: `**` to `.*`, `*` to `[^/]*`, `?` to `[^/]`, a class to a regex class that also excludes `/` when negated (a positive class here never contains `/`), and every other character escaped, so `.` is literal. `fullmatch` anchors both ends. The history is reduced in one pass to a dict from path to the set of etags with a remembered `LOADED` record; a path with only remembered failed loads, or loads of other etags, is still a key, which is what "status known" means. Each file is then classified with dictionary lookups, applying the strict `<` for memory and the inclusive `>=` for uncertainty. Below Very Hard the history has no failed loads and `load_uncertain` is False, so those branches are inert.

**Complexity.** O(H) to index the history and O(F × P × L) for the matches (each compiled regex is linear here, since the patterns have no nested repetition), plus O(F log F) for the sort. The timing test (60 000 files, about 60 000 records) ran in 0.15–0.45 s in CPython; the same code scanning the history list for every file took over three minutes. A hand-written matcher with backtracking is acceptable if it is linear-ish per path; one that re-translates the pattern for every file is slower but usually still passes.

**Dialect notes.** Java: `Pattern.compile` once per glob and `matcher(path).matches()`; `HashMap<String, Set<String>>`. C++: `std::regex` is slow; a hand-written matcher with two indices and a backtrack point for `*` is common. In SQL the same dry run is an anti-join of the stage listing against a load-history table with a time filter and a pattern predicate (`RLIKE`/`REGEXP_LIKE`), described here, not executed. Snowflake's bulk-load `PATTERN` option takes a regular expression, not a glob, and its load-history views and `COPY` options (`FORCE`, `LOAD_UNCERTAIN_FILES`) are documented with more conditions than this exercise uses (check current docs).

**Edge cases built into the tests.** `*` within one directory level, including the empty match; `?` as exactly one character; a literal dot; same path and etag skipped, new etag loaded; a never-loaded file exactly 64 days old (uncertain) and one second younger (load); a record exactly 64 days old (forgotten) and one second younger (remembered); (Hard) `**` with literal slashes around it; exclusion beating inclusion; an old timestamp with a remembered load of another etag (load, not uncertain); (Very Hard) ranges, negated classes and a class that would have to match `/`; a remembered failed load (load again) next to a failed-then-loaded path (skip); `load_uncertain`.

**Common mistakes.** `fnmatch`/`glob` semantics where `*` crosses `/`; unescaped `.` in a hand-built regex; `re.match` without an end anchor; `<=` for memory or `>` for uncertainty; looking only at the latest record for a path; treating a failed load as loaded; treating any remembered record as "already loaded" regardless of etag; scanning `history` per file; translating patterns inside the file loop.

**Follow-up guidance.** (1) Two loads can both decide a file is new; the platform's own load metadata is updated transactionally with the load, so the second load skips it there, but a hand-rolled dry run is advisory only; serialise loads per table or rely on the platform's own deduplication. (2) Same name, new content means a new etag, so the file loads again and the table may get both versions; write immutable, uniquely named files (date/hour/uuid), or merge on a business key. (3) Partition paths by date/hour so each load lists one prefix; use event notifications or continuous ingestion instead of listing a huge stage. (4) Use the force option for the specific paths of that day, after deleting that day's rows in the table in the same transaction, or load into a staging table and merge on a key.

**Rubric anchors.** 2: right statuses for simple cases but `*` crosses `/`, or a boundary is off by one second, or the history is scanned per file. 3: all tests pass with compiled patterns and a path index. 4: also explains concurrent loads, immutable file naming and a safe reload procedure.

**Strong signals.** Asks what `*` means before coding; distinguishes "already loaded", "changed" and "unknown"; tests the 64-day boundaries both ways. **Red flags.** Forcing every load to avoid thinking about skipped files; deduplicating only on file name.
