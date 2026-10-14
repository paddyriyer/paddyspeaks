# Databricks — Loop 1 evaluator notes

## DBX-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH days AS (
  SELECT d::date AS run_date
  FROM generate_series(DATE '{{first_day}}', DATE '{{last_day}}', INTERVAL '1 day') AS g(d)
), sched AS (                          -- the schedule in effect on each date
  SELECT DISTINCT ON (s.job_id, d.run_date)
         d.run_date, s.job_id, s.schedule_time, s.sla_minutes
  FROM days d
  JOIN job_schedules s ON s.effective_from <= d.run_date
  ORDER BY s.job_id, d.run_date, s.effective_from DESC
), per_day AS (
  SELECT job_id, run_date,
         COUNT(*)                                             AS runs,
         MAX(end_ts) FILTER (WHERE result_state = 'SUCCESS')  AS delivered_at
  FROM job_runs
  GROUP BY job_id, run_date
), joined AS (
  SELECT s.run_date, s.job_id,
         COALESCE(p.runs, 0) AS runs,
         (s.run_date + s.schedule_time) AT TIME ZONE 'UTC'
           + s.sla_minutes * INTERVAL '1 minute'              AS deadline,
         p.delivered_at
  FROM sched s
  LEFT JOIN per_day p ON p.job_id = s.job_id AND p.run_date = s.run_date
)
SELECT run_date, job_id, runs, deadline, delivered_at,
       CASE WHEN delivered_at IS NULL      THEN 'MISSED'
            WHEN delivered_at <= deadline  THEN 'MET'
            ELSE 'LATE' END                                   AS status,
       CASE WHEN delivered_at IS NULL      THEN NULL
            WHEN delivered_at <= deadline  THEN 0
            ELSE CEIL(EXTRACT(EPOCH FROM delivered_at - deadline) / 60)::int END AS minutes_late
FROM joined
ORDER BY run_date, job_id;
```

**Explanation.** The report grain is (date in window, job with a schedule in effect), so it is built from a date spine and `job_schedules`, not from the runs: a scheduled date with no run must still appear, as MISSED. `DISTINCT ON … ORDER BY effective_from DESC` picks the schedule in effect on each date (an as-of join); a date before a job's first `effective_from` joins nothing and produces no row. Runs are aggregated by their `run_date` (never the date they started), counting every attempt and taking the latest successful end. Because only successes enter the `MAX`, a failed repair after an on-time success changes nothing, while a successful late repair makes the date LATE. The deadline is the local wall-clock arithmetic done in UTC and may land on the next day.

**Complexity.** One aggregate over `job_runs` (hash or sort by `job_id, run_date`), a small date spine times schedules, and a hash join: O(R + D·J) for R runs, D days and J jobs. At scale the runs table is partitioned by `run_date`, so a window of days reads only its partitions; note that repair runs for an old date land in that old date's partition, which is exactly what an incremental refresh must watch.

**Dialect notes** (described, not executed). Spark SQL / Databricks SQL: `sequence(DATE'…', DATE'…', INTERVAL 1 DAY)` with `explode` for the spine; `max_by`/`max(...) FILTER (WHERE …)` is supported; build the deadline with `to_timestamp(concat(run_date, ' ', schedule_time)) + make_interval(0,0,0,0,0, sla_minutes, 0)` or `timestampadd(MINUTE, sla_minutes, …)`; use `ceil((unix_timestamp(delivered_at) - unix_timestamp(deadline)) / 60)`; replace `DISTINCT ON` with `row_number()` or `QUALIFY` (supported in recent Databricks SQL; check current docs). Snowflake: `GENERATOR`/`TABLE(FLATTEN(ARRAY_GENERATE_RANGE(...)))` for the spine, `QUALIFY`, `TIMESTAMPADD(minute, …)`, `CEIL(DATEDIFF(second, …) / 60)`. BigQuery: `GENERATE_DATE_ARRAY`, `QUALIFY`, `TIMESTAMP(DATETIME(run_date, schedule_time))`, `TIMESTAMP_DIFF(..., SECOND)`. MySQL 8: recursive CTE for the spine, `ROW_NUMBER()` instead of `DISTINCT ON`, `TIMESTAMPDIFF(SECOND, …)`.

**Edge cases built into the data.** Every level: a date delivered by an automatic retry, a LATE single run, a MISSED date (all attempts FAILED or CANCELED), schedules at 22:00 and 23:30 whose deadlines fall on the next day. Hard: an on-time success followed by a successful repair after the deadline (LATE); an on-time success followed by a failed repair (MET); a run ending exactly at the deadline (MET); a repair run that starts on the next UTC day. Very Hard: a schedule that changes inside the window, a job whose first schedule starts inside the window (no rows before it), a scheduled date with no run (MISSED, `runs = 0`), and runs still RUNNING with no `end_ts` (counted, never delivered).

**Common mistakes.** Taking the first success (or the scheduled attempt only); taking the latest run of any state; grouping by `start_ts::date`; an inner join from runs, which drops dates that never ran; using the job's current schedule for every date; `<` instead of `<=` at the deadline; `ROUND` or truncation instead of rounding up; computing the deadline as a `time` and comparing times (breaks across midnight).

**Follow-up guidance.** (1) Report `first_delivered_at` (MIN over successes), `final_delivered_at` (the MAX) and a `restated` flag; a consumer's SLA and the data's finality are two different facts, and both are honest. (2) Store a time zone per job and build the deadline as local date + local time converted to UTC; on a spring-forward day a 02:30 local schedule does not exist and on the fall-back day 01:30 happens twice, so the rule (e.g. the first occurrence, or shift forward) must be stated. (3) Recompute only dates touched since the last refresh: the set of `(job_id, run_date)` with a run that started or changed state since the watermark; repair runs can touch any old date, so the watermark is on the run's update time, not on `run_date`. (4) Publish a monthly figure from a frozen snapshot with a definition version, and show restated dates separately rather than rewriting a number people already used.

**Rubric anchors.** 2: right for simple dates but drops dates with no run, or uses the first success, or groups by start date. 3: matches the expected result. 4: also explains restatement reporting, DST-safe deadlines and an incremental refresh keyed on run updates.

**Strong signals.** Asks what "delivered" means when a repair overwrites output; builds the grain from the schedule before touching runs; tests the midnight-crossing deadline. **Red flags.** Treating any finished run as delivery; filtering runs by date range on `start_ts` and losing next-day repairs; presenting this exercise's "latest success" rule as a guarantee of any product.

## DBX-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH RECURSIVE closure(table_name, ancestor) AS (
  SELECT downstream, upstream FROM lineage
  UNION                                   -- distinct pairs: diamonds collapse here
  SELECT c.table_name, l.upstream
  FROM closure c
  JOIN lineage l ON l.downstream = c.ancestor
), last_change AS (
  SELECT table_name, MAX(commit_ts) AS last_change
  FROM table_commits
  WHERE commit_ts <= TIMESTAMPTZ '{{as_of}}'
    AND operation NOT IN ('OPTIMIZE', 'VACUUM')
  GROUP BY table_name
), t AS (
  SELECT o.object_name AS table_name, lc.last_change
  FROM catalog_objects o
  JOIN last_change lc ON lc.table_name = o.object_name
  WHERE o.object_type = 'TABLE'
), pairs AS (
  SELECT t.table_name, t.last_change, u.table_name AS ancestor, u.last_change AS ancestor_change
  FROM t
  JOIN closure c ON c.table_name = t.table_name
  JOIN t u       ON u.table_name = c.ancestor      -- views have no row in t, so they drop out here
), agg AS (
  SELECT table_name,
         COUNT(*)                                                   AS ancestors,
         COUNT(*) FILTER (WHERE ancestor_change > last_change)      AS newer_ancestors,
         MAX(ancestor_change) FILTER (WHERE ancestor_change > last_change) AS newest_change
  FROM pairs
  GROUP BY table_name
), newest AS (
  SELECT DISTINCT ON (table_name) table_name, ancestor
  FROM pairs
  WHERE ancestor_change > last_change
  ORDER BY table_name, ancestor_change DESC, ancestor
)
SELECT t.table_name,
       t.last_change,
       FLOOR(EXTRACT(EPOCH FROM TIMESTAMPTZ '{{as_of}}' - t.last_change) / 60)::int AS staleness_minutes,
       COALESCE(a.ancestors, 0)                                                  AS ancestors,
       COALESCE(a.newer_ancestors, 0)                                            AS newer_ancestors,
       COALESCE(FLOOR(EXTRACT(EPOCH FROM a.newest_change - t.last_change) / 60)::int, 0) AS lag_minutes,
       n.ancestor                                                                AS newest_ancestor
FROM t
LEFT JOIN agg a    ON a.table_name = t.table_name
LEFT JOIN newest n ON n.table_name = t.table_name
ORDER BY t.table_name;
```

**Explanation.** The recursive CTE computes the transitive closure of the lineage over all nodes, views included, so a dependency that passes through a view is kept; `UNION` deduplicates `(table, ancestor)` pairs, which both collapses diamonds and guarantees termination on a DAG. `last_change` applies the two filters that define freshness at a point in time: data-changing operations only, and nothing after the as-of time. Joining the closure to `t` on both sides keeps tables only, so views are walked through but never reported or counted. The aggregate counts ancestors and strictly newer ones; `DISTINCT ON` picks the newest with the name tie-break.

**Complexity.** The closure is O(N·A) pairs for N tables with A ancestors on average (each pair produced once per incoming path, deduplicated by `UNION`); the commit aggregate is one scan. Fine for thousands of tables; at catalogue scale the closure is maintained incrementally (follow-up 2).

**Dialect notes** (described, not executed). Spark SQL / Databricks SQL: recursive CTEs are supported only in recent runtimes (check current docs); otherwise iterate the join in a driver loop or use a graph library, and read the commit history through the table format's history command or system tables. Replace `DISTINCT ON` with `QUALIFY ROW_NUMBER() …` or `max_by(ancestor, struct(ancestor_change, -…))`; use `floor((unix_timestamp(a) - unix_timestamp(b)) / 60)`. Snowflake: `WITH RECURSIVE` (or `CONNECT BY`), `QUALIFY`, `DATEDIFF(second, …)`. BigQuery: `WITH RECURSIVE` (with an iteration limit), `QUALIFY`, `TIMESTAMP_DIFF(…, SECOND)`. MySQL 8: `WITH RECURSIVE`, `ROW_NUMBER()`, `TIMESTAMPDIFF(SECOND, …)`.

**Edge cases built into the data.** Every level: `OPTIMIZE`/`VACUUM` commits after a table's last write; bronze tables with no ancestors (0, 0, 0, NULL); chains three deep, so a gold table's bronze ancestor is reachable only by recursion. Hard: tables with two upstreams, a diamond (a gold table reads a bronze table directly and through a silver table), commits after the as-of time, and two newer ancestors with identical `last_change` (the smaller name wins). Very Hard: two views in the lineage (one reading two gold tables), a feature table that depends on gold tables only through a view, and an ancestor whose `last_change` equals its descendant's to the second (not newer).

**Common mistakes.** Taking `MAX(commit_ts)` over all commits (maintenance and post-as-of commits included); comparing only direct upstreams; `UNION ALL` in the recursion (double-counted ancestors); `>=` for newer; joining commits inside the recursive step, which stops the walk at views; counting views as ancestors; rounding minutes to nearest; an arbitrary pick among tied newest ancestors.

**Follow-up guidance.** (1) Attach an expected refresh cadence per edge or per upstream table and alert on lag beyond that cadence, not on any newer timestamp; keep the raw lag visible. (2) Maintain the closure incrementally: when an edge is added, add `ancestors(upstream) ∪ {upstream}` to every descendant of the downstream table; deletions are harder (recompute the affected descendants, or keep path counts). Propagate freshness events along the graph instead of re-joining everything. (3) Partition- or watermark-level freshness: compare the data interval each table has processed (for example, the max event date it has read from each upstream) with what the upstream holds; a streaming checkpoint's source offsets are the precise version of this. (4) Make the lineage temporal (valid_from/valid_to per edge, or lineage captured per run) and evaluate the closure as of the asked time as well as the commits.

**Rubric anchors.** 2: right direct comparisons but no recursion, or maintenance/post-as-of commits counted. 3: matches the expected result. 4: also discusses incremental closure, cadence-aware alerting and a finer-grained freshness signal.

**Strong signals.** Separates "data changed" from "files changed"; uses `UNION` deliberately and can say why; asks how views and cycles are handled. **Red flags.** Hard-coding the depth with a fixed number of self-joins; treating a newer upstream as proof the table is wrong.

## DBX-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH r AS (
  SELECT cr.run_id, cr.cluster_id, c.owner,
         c.autotermination_minutes * 60                          AS t_sec,
         cr.start_ts,
         COALESCE(cr.end_ts, TIMESTAMPTZ '{{as_of}}')            AS end_ts   -- still running: busy until as_of
  FROM cluster_runs cr
  JOIN clusters c ON c.cluster_id = cr.cluster_id
  WHERE c.cluster_type = 'interactive'
), marked AS (
  SELECT r.*,
         MAX(end_ts) OVER (PARTITION BY cluster_id ORDER BY start_ts, run_id
                           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end
  FROM r
), islands AS (
  SELECT marked.*,
         SUM(CASE WHEN prev_max_end IS NULL OR start_ts > prev_max_end THEN 1 ELSE 0 END)
           OVER (PARTITION BY cluster_id ORDER BY start_ts, run_id) AS island
  FROM marked
), busy AS (
  SELECT cluster_id, owner, t_sec, island,
         MIN(start_ts) AS s, MAX(end_ts) AS e, COUNT(*) AS n
  FROM islands
  GROUP BY cluster_id, owner, t_sec, island
), gaps AS (
  SELECT busy.*,
         LEAD(s) OVER (PARTITION BY cluster_id ORDER BY island) IS NULL AS is_tail,
         EXTRACT(EPOCH FROM COALESCE(LEAD(s) OVER (PARTITION BY cluster_id ORDER BY island),
                                     TIMESTAMPTZ '{{as_of}}') - e) AS gap_sec
  FROM busy
), per_cluster AS (
  SELECT cluster_id, owner,
         SUM(n)                                                         AS runs,
         SUM(EXTRACT(EPOCH FROM e - s))                                 AS busy_sec,
         SUM(CASE WHEN t_sec = 0 THEN gap_sec ELSE LEAST(gap_sec, t_sec) END) AS idle_sec,
         1 + COUNT(*) FILTER (WHERE NOT is_tail AND t_sec > 0 AND gap_sec >= t_sec) AS starts
  FROM gaps
  GROUP BY cluster_id, owner
)
SELECT owner,
       COUNT(*)                                                AS clusters,
       SUM(runs)::int                                          AS runs,
       ROUND(SUM(busy_sec) / 60, 2)                            AS busy_minutes,
       ROUND(SUM(idle_sec) / 60, 2)                            AS idle_minutes,
       SUM(starts)::int                                        AS starts,
       ROUND(SUM(idle_sec) / (SUM(idle_sec) + SUM(busy_sec)), 4) AS idle_share
FROM per_cluster
GROUP BY owner
ORDER BY idle_minutes DESC, owner;
```

**Explanation.** Classic gaps and islands, with the one detail that matters for intervals: a run starts a new busy interval only if it starts after the **latest end of all earlier runs**, not after the previous row's end; a contained run would otherwise open a false gap. A run that starts exactly at that latest end joins the island (touching runs leave no gap). Each island contributes its length to busy time, and the gap to the next island (or to the as-of time for the last one) contributes idle time capped at the auto-termination time; a gap at or beyond it is a restart. A running run is treated as ending at the as-of time, so its cluster has no trailing idle. With auto-termination disabled (`0`), idle is uncapped and there are no restarts.

**Complexity.** One sort per cluster for the window functions and two small aggregations: O(R log R) for R runs. Partitioned by cluster, so it parallelises cleanly.

**Dialect notes** (described, not executed). Spark SQL / Databricks SQL: the same window frames work (`max(end_ts) OVER (PARTITION BY … ORDER BY … ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`); compute seconds with `unix_timestamp(e) - unix_timestamp(s)` or `timestampdiff(SECOND, s, e)`, use `count_if` for restarts. Snowflake: same windows, `DATEDIFF(second, s, e)`, `COUNT_IF`. BigQuery: same windows, `TIMESTAMP_DIFF(e, s, SECOND)`, `COUNTIF`; `LEAST` exists in all three. MySQL 8: window functions and `TIMESTAMPDIFF(SECOND, …)`; no `FILTER`, use `SUM(CASE …)`.

**Edge cases built into the data.** Every level: gaps shorter and longer than the auto-termination time, different `T` per cluster, job clusters (excluded), a trailing idle cut short by the as-of time on the most recent cluster. Hard: a gap of exactly `T` minutes (a restart), a run contained in a longer one followed by a run after the long one ends (exposes a `LAG(end_ts)` gap), overlapping runs, back-to-back runs, an interactive cluster with no runs, and an owner with only job clusters (no row). Very Hard: a cluster with auto-termination disabled (`0`: all idle counts, one start) and a run still running at the as-of time.

**Common mistakes.** Summing run durations as busy time; measuring gaps from `LAG(end_ts)`; leaving idle uncapped (or capping but still counting the time after termination); `>` instead of `>=` for restarts; forgetting the trailing idle, or not capping it at the as-of time; counting job clusters or clusters with no runs; reading `0` as "terminate immediately"; dropping running runs; sorting by unrounded values in one place and rounded in another.

**Follow-up guidance.** (1) For candidate values of `T`, recompute idle minutes and the number of restarts (each restart costs the user a start-up wait); present the curve and let the team choose, rather than a single "optimal" value. (2) Add start-up time as a separate bucket: after a restart, the cluster is billed while starting but not busy; a shorter `T` trades idle cost for start-up cost and user waiting. (3) Partition by cluster (all of a cluster's runs together) and process a day with a lookback for runs that started earlier and are still running; never cut intervals at a partition boundary without carrying state. (4) Use richer activity signals (commands executed, CPU utilisation, rows read) and flag clusters whose "runs" are periodic, tiny and never produce output; report them as observations, not accusations.

**Rubric anchors.** 2: correct for sequential runs but sums overlapping durations or uses `LAG(end_ts)`. 3: matches the expected result. 4: also reasons about choosing `T` with the start-up trade-off and about partitioning without breaking intervals.

**Strong signals.** Draws the timeline before writing SQL; asks whether runs can overlap and what happens exactly at `T`. **Red flags.** Treating idle time as waste without considering start-up cost; describing this simplified rule as how a product bills or terminates clusters.

## DBX-L1-04

**Reference solution**

```python reference
import heapq
from collections import deque


def schedule(stages, slots):
    info = {sid: (tasks, secs, deps) for sid, tasks, secs, deps in stages}
    children = {sid: [] for sid in info}
    indeg = {}
    for sid, (_, _, deps) in info.items():
        for d in deps:
            if d not in info:
                return None                       # unknown stage
            children[d].append(sid)
        indeg[sid] = len(deps)

    # Kahn's algorithm: a topological order, or proof of a cycle.
    order, left = [], dict(indeg)
    q = deque(s for s, k in left.items() if k == 0)
    while q:
        s = q.popleft()
        order.append(s)
        for c in children[s]:
            left[c] -= 1
            if left[c] == 0:
                q.append(c)
    if len(order) != len(info):
        return None                               # a cycle (a self-dependency included)
    if not info:
        return (0, [], 0)

    # Bottom levels, iteratively in reverse topological order.
    bl = {}
    for s in reversed(order):
        bl[s] = info[s][1] + max((bl[c] for c in children[s]), default=0)
    key = lambda s: (-bl[s], s)
    cur = min(info, key=key)
    cp, path = bl[cur], [cur]
    while children[cur]:
        cur = min(children[cur], key=key)
        path.append(cur)

    # List scheduling: ready stages by (-bottom level, id); running batches by finish time.
    waiting = dict(indeg)
    to_start = {s: info[s][0] for s in info}
    to_finish = dict(to_start)
    ready = [(-bl[s], s) for s in info if indeg[s] == 0]
    heapq.heapify(ready)
    running = []                                  # (finish_time, stage, tasks in this batch)
    free, t = slots, 0
    while True:
        while free and ready:
            _, s = ready[0]
            k = min(free, to_start[s])
            to_start[s] -= k
            free -= k
            heapq.heappush(running, (t + info[s][1], s, k))
            if to_start[s] == 0:
                heapq.heappop(ready)
        if not running:
            break
        t = running[0][0]
        while running and running[0][0] == t:     # all finishes at t before any start at t
            _, s, k = heapq.heappop(running)
            free += k
            to_finish[s] -= k
            if to_finish[s] == 0:
                for c in children[s]:
                    waiting[c] -= 1
                    if waiting[c] == 0:
                        heapq.heappush(ready, (-bl[c], c))
    return (cp, path, t)
```

**Explanation.** Kahn's algorithm validates the graph and orders it; bottom levels are a longest-path computation over that order, iterative so a 20 000-deep chain cannot overflow the stack. With positive durations the stage with the largest bottom level is always a source, and following the child with the largest bottom level walks one longest path; the `(−bl, id)` key makes every tie deterministic. The simulation is event-driven: start what fits, jump to the earliest finish, release every batch that finishes then (which may make dependents ready), and repeat. Tasks of one stage started together finish together, so they are pushed as one batch with a count, which keeps a wide stage at O(1) heap entries per start rather than one per task. The stage at the top of the ready heap stays there until all its tasks have started, which is exactly "as many of its remaining tasks as there are free slots, then the next stage".

**Complexity.** O((n + E) log n + B log B) time, where B is the number of task batches started (at most one per stage per event); O(n + E) memory. The timing test (30 000 stages; 20 000 stages of up to 40 tasks at Very Hard) takes about 0.2–0.5 s in CPython. A version that rescans every stage for readiness each time it gives out a slot is quadratic: about 7 s already at 3 000 stages, so the timing test is out of reach.

**Dialect notes.** In Java, `PriorityQueue<long[]>` with a comparator for both heaps and `ArrayDeque` for Kahn; in Scala the same with `mutable.PriorityQueue` (a max-heap: invert the key); in C++ `priority_queue` with `greater<>` over tuples. Spark's own scheduler works at the level of task sets and executors with locality and fair or FIFO pools; this exercise is a planning model, not a description of it. Not executed here.

**Edge cases built into the tests.** One stage; a chain on more slots than needed (makespan equals the critical path); two sources tied on bottom level (the smaller id wins, both for the path and for the first slot); a stage that becomes ready exactly when a slot frees; a short stage with long dependents outranking a long leaf (priority is the bottom level). Hard: no stages (`(0, [], 0)`), a three-stage cycle, a self-dependency and an unknown dependency (`None`), more slots than stages. Very Hard: one stage with more tasks than slots (several rounds), a wide stage holding every slot while a higher-level stage waits for it, and a stage that finishes only when its last task finishes.

**Common mistakes.** Prioritising by the stage's own duration; starting a dependent before processing all finishes at the same instant (or the reverse, letting it start a tick late); stepping one second at a time; rescanning all stages on every event; recursive bottom levels that hit the recursion limit; returning a path that is a longest path but not the tie-broken one; treating a multi-task stage as one slot, or as finished when its first task finishes; raising instead of returning `None`.

**Follow-up guidance.** (1) Every task needs a slot, so makespan ≥ Σ tasks·seconds / slots; every chain runs sequentially, so makespan ≥ critical path. Graham's bound for list scheduling gives makespan ≤ (total work)/slots + critical path for unit-slot tasks, so it is within a factor of about 2 of optimal; it is close to the larger bound when the graph is wide and well balanced. (2) Equal task times are the model's strongest assumption: with skew, the stage's length becomes its slowest task, the critical path grows, and slots sit idle at the end of the stage; model a distribution per stage, or split hot partitions (adaptive execution does this in practice). (3) Makespan is non-increasing in slots only under conditions (list scheduling has known anomalies where more slots make it slower); compute both lower bounds, then binary-search or sample slot counts and stop when the makespan is within a few percent of the critical-path bound. (4) A task needing two slots must wait for two free slots at once, so a strict priority order can block (head-of-line) or fragment capacity; backfilling smaller tasks without delaying the head task is the usual fix.

**Rubric anchors.** 2: right critical path but the simulation scans or ticks, or gets the same-instant order wrong. 3: all tests pass with Kahn plus two heaps. 4: also derives the two lower bounds, explains Graham's bound or anomalies, and how skew breaks the model.

**Strong signals.** Separates the static analysis (validity, bottom levels) from the dynamic simulation; asks about the order of events at equal times; batches multi-task starts. **Red flags.** Calling the list-scheduling makespan optimal; a recursive DFS without considering depth.

## DBX-L1-05

**Reference solution**

```python reference
from bisect import bisect_right


def snapshot_sizes(commits, checkpoints, versions):
    known = set(commits) | set(checkpoints)
    latest = max(known) if known else -1
    cps = sorted(checkpoints)
    # Group the queries by the checkpoint they start from (-1: no checkpoint, start empty).
    groups = {}
    out = [None] * len(versions)
    for i, v in enumerate(versions):
        if 0 <= v <= latest:
            k = bisect_right(cps, v)
            base = cps[k - 1] if k else -1
            groups.setdefault(base, []).append((v, i))
    for base, qs in groups.items():
        qs.sort()
        files = dict(checkpoints[base]) if base >= 0 else {}
        total = sum(files.values())
        at = base                                  # the version 'files' describes
        for v, i in qs:
            while at < v:
                acts = commits.get(at + 1)
                if acts is None:
                    break                          # a missing commit: nothing later in this group
                for a in acts:
                    if a[0] == "add":
                        total += a[2] - files.get(a[1], 0)
                        files[a[1]] = a[2]
                    else:
                        total -= files.pop(a[1], 0)
                at += 1
            if at < v:
                break                              # the rest of the group stays None
            out[i] = (len(files), total)
    return out
```

**Explanation.** Every answerable query has exactly one base: the largest checkpoint at or below it (`bisect_right` returns the insertion point after an equal key, so a query at a checkpoint version uses that checkpoint). Queries with the same base share a prefix of the same replay, so sorting each group by version and walking forward once answers all of them; a running byte total avoids summing the file map per query. A missing commit stops the walk: every later version in that group needs it, so they stay `None`, while versions in the next group start from their own checkpoint and are unaffected. Out-of-range versions are rejected before grouping.

**Complexity.** O(Q log Q + Q log K) for Q queries and K checkpoints, plus O(size of each used checkpoint + actions replayed), with each commit replayed at most once per group, so about once in total; O(largest checkpoint) memory at a time. The timing test (3 000 versions, a checkpoint every 100, about 8 000 active files, 30 000 queries) runs in about 0.1 s in CPython. Rebuilding each query from its checkpoint took about 2.8 s for 3 000 queries, so about 28 s for the full test.

**Dialect notes.** In Java or Scala the same with a `TreeMap` (`floorKey(v)`) for checkpoints and a `HashMap<String, Long>` per group. In SQL (Spark SQL over the log stored as a table) this is a join of each query version to its floor checkpoint plus a windowed aggregation over add/remove actions per path, keeping the last action per path with `version <= v`; that is O(Q × actions) unless the queries are few. Not executed here.

**Edge cases built into the tests.** No checkpoint at all (replay from version 0); a query exactly at a checkpoint; an older checkpoint ignored in favour of the latest one at or below the version; a table emptied to `(0, 0)`. Hard: removes of paths that are not active (including a double remove in one commit), versions `-1` and above the latest, cleaned-up history (commits and checkpoints below the oldest retained checkpoint are gone). Very Hard: a checkpoint whose own commit file is missing, a missing commit that makes every version up to the next checkpoint unreadable, a re-add that replaces a size, and a commit that removes and re-adds one path and adds and removes another.

**Common mistakes.** Treating the checkpoint as the state before its commit (replaying commit `c` twice); always replaying from version 0; `bisect_left` (skips a checkpoint at exactly `v`); raising `KeyError` on a missing commit instead of returning `None`; returning `None` for an empty table; adding a re-added file's size twice; sorting the queries and returning answers in sorted order; copying a checkpoint per query (fails the timing test).

**Follow-up guidance.** (1) Formats keep a small "last checkpoint" pointer file; a reader reads it, then lists only log entries after that version. A stale pointer is safe if readers still list forward from it; a missing or corrupt one falls back to listing. (2) Each version is a file created with put-if-absent (or an atomic rename / a coordinating service on stores that lack it), so exactly one writer creates version 1 801; the loser re-reads what changed and checks for logical conflicts (did the winner touch the files or partitions it read?) before retrying at 1 802. (3) Multi-part or incremental checkpoints, columnar checkpoint files with per-partition statistics so a reader can skip, and compacting the log of small commits. (4) Time travel to a version needs its log entries (or a checkpoint at or below it plus the entries after), and its data files, which vacuum may have deleted; report readable versions as "from the oldest retained checkpoint to latest", and keep vacuum retention at least as long as log retention for the versions you promise.

**Rubric anchors.** 2: correct per-query rebuild but too slow, or wrong at checkpoint boundaries. 3: all tests pass with grouping and a single forward replay. 4: also explains put-if-absent commits with conflict checks, checkpoint discovery and how retention limits time travel.

**Strong signals.** Asks whether a checkpoint is before or after its commit; notices that a missing commit only affects one group; keeps answers in input order. **Red flags.** Assuming the log is always complete; describing this simplified model as the format's full protocol.
