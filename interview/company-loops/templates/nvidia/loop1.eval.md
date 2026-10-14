# NVIDIA · Loop 1 — evaluator notes (hidden from candidates)

## NVD-L1-01

**Reference solution** (PostgreSQL; `{{threshold}}` and `{{min_gpus}}` are the instance's values)

```sql reference
WITH readings AS (                      -- failed reads leave before the window pairs neighbours
  SELECT node_id, gpu_uuid, sample_ts, driver_load_id, ce_total,
         LAG(ce_total)       OVER w AS prev_total,
         LAG(driver_load_id) OVER w AS prev_load
  FROM gpu_error_samples
  WHERE ce_total IS NOT NULL
  WINDOW w AS (PARTITION BY gpu_uuid ORDER BY sample_ts)
), increases AS (
  SELECT node_id, gpu_uuid,
         (sample_ts AT TIME ZONE 'UTC')::date AS day,
         CASE WHEN driver_load_id <> prev_load THEN ce_total      -- reloaded: counter restarted at 0
              ELSE ce_total - prev_total END AS increase
  FROM readings
  WHERE prev_total IS NOT NULL                                  -- first reading: no increase
), daily AS (
  SELECT day, node_id, gpu_uuid, SUM(increase) AS increase
  FROM increases
  GROUP BY day, node_id, gpu_uuid
), flagged AS (
  SELECT day, node_id, gpu_uuid, increase,
         ROW_NUMBER() OVER (PARTITION BY day, node_id ORDER BY increase DESC, gpu_uuid) AS rn,
         COUNT(*)     OVER (PARTITION BY day, node_id) AS n
  FROM daily
  WHERE increase >= {{threshold}}
)
SELECT day, node_id, n AS flagged_gpus, gpu_uuid AS worst_gpu, increase AS worst_increase
FROM flagged
WHERE rn = 1 AND n >= {{min_gpus}}
ORDER BY day, node_id;
```

**Explanation.** The whole problem is pairing each reading with the right predecessor. NULL readings are removed in the `WHERE` of the windowed CTE, so the reading after a failed read is compared with the last successful one; filtering after the window would pair it with the NULL and lose its increase. The reset test is a change of `driver_load_id`, not a drop in value: after a reload the counter restarts from 0 and may climb past its old value before the next poll (the Very Hard data contains exactly that). The increase after a reset is the new value, because the counter counted up from 0. Increases are then summed per GPU and UTC date of the later reading, filtered by the inclusive threshold, and reduced to one row per node-day with a window, so the count and the worst GPU come from the same filtered set.

**Complexity.** One sort per GPU for the window (O(n log n) overall), then hash aggregates over a small number of GPU-days. In production the increase would be computed once at ingestion, keeping the last reading per GPU as state, so the daily job never re-reads history.

**Dialect notes** (described, not executed). BigQuery: `LAG(...) OVER (PARTITION BY gpu_uuid ORDER BY sample_ts)` is identical; `DATE(sample_ts)` is UTC; `QUALIFY rn = 1` replaces the outer filter. Snowflake: same windows, `QUALIFY`, `TO_DATE(CONVERT_TIMEZONE('UTC', sample_ts))`. Spark SQL: `lag()` over a window, `to_date(sample_ts)` with the session time zone set to UTC. MySQL 8: window functions are supported; no `WINDOW` clause reuse problems, but `QUALIFY` does not exist, so filter in an outer query. `IGNORE NULLS` on `LAG` (BigQuery, Snowflake, Spark) is an alternative to filtering NULLs first, but the reset test also needs the load id from the same non-NULL row.

**Edge cases built into the data.** A GPU exactly at the threshold, forced on a node-day; a reload inside that day (always visible as a drop below Very Hard); GPUs whose first reading is the only reading before an increase; noisy GPUs that cross the threshold on their own. Hard: failed reads stored as NULL, `sample_id` assigned in random order, readings in the last and first minutes of a day, a minimum of two flagged GPUs per node in some instances. Very Hard: on the same node and day, a GPU reloaded after a burst whose counter climbed past its old value, so a drop test misses the reset entirely and undercounts it.

**Common mistakes.** `MAX − MIN` per day; `GREATEST(ce_total − prev, 0)` (loses the errors since the reload); summing raw differences (negative after a reset); attributing increases to the earlier reading's date; ordering by `sample_id`; filtering NULLs after `LAG`; a strict `>` threshold; computing the worst GPU before applying the threshold, or counting all GPUs instead of flagged ones.

**Follow-up guidance.** (1) Pro-rating an increase across midnight by time is possible (split by the fraction of the interval on each side) but invents precision the poll does not have; with frequent polling the simple rule is fine, and the rule must be written down either way. (2) Keep the last reading per GPU as state in the ingestion job, emit one increase row per reading, and aggregate daily from those; late or out-of-order readings need a small reorder buffer or a correction pass. (3) A node-wide simultaneous jump suggests a shared cause: a driver or firmware change, a reload that replays counts, a polling bug, or a thermal or power event; compare against driver events and other nodes with the same software, and look at whether the errors are spread across memory or concentrated in one region. (4) Flag, then drain with an audit record; measure false positives by following drained GPUs through diagnostics and counting how many pass, and true positives by job failures avoided.

**Rubric anchors.** 2: increases right on simple cases but resets produce negatives or zeros, or failed reads break the pairing. 3: matches the expected result. 4: also explains why the load id, not the value, defines a reset, and how to compute this incrementally at fleet scale.

**Strong signals.** Asks how a reset is recorded before writing SQL; checks that increases are never negative; filters before the window deliberately. **Red flags.** Treating the counter as a gauge; presenting a threshold as a hardware specification rather than an operational choice.

## NVD-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH ev AS (                              -- every event gets its run number
  SELECT e.*,
         SUM(CASE WHEN event_type = 'start' THEN 1 ELSE 0 END)
           OVER (PARTITION BY job_id ORDER BY event_ts) AS run_no
  FROM job_events e
), runs AS (
  SELECT job_id, run_no,
         MAX(event_ts) FILTER (WHERE event_type = 'start')                         AS start_ts,
         MAX(step)     FILTER (WHERE event_type = 'start')                         AS start_step,
         MAX(gpus)     FILTER (WHERE event_type = 'start')                         AS gpus,
         MAX(event_ts) FILTER (WHERE event_type IN ('fail', 'preempt', 'complete')) AS end_ts,
         MAX(step)     FILTER (WHERE event_type IN ('fail', 'preempt', 'complete')) AS end_step,
         BOOL_OR(event_type IN ('fail', 'preempt'))                                AS interrupted,
         MAX(event_ts) FILTER (WHERE event_type = 'checkpoint')                    AS ck_ts,
         MAX(step)     FILTER (WHERE event_type = 'checkpoint')                    AS ck_step
  FROM ev
  GROUP BY job_id, run_no
), per_run AS (
  SELECT j.team, r.job_id,
         r.interrupted,
         CASE WHEN r.interrupted
              THEN r.end_step - GREATEST(r.start_step, COALESCE(r.ck_step, r.start_step)) ELSE 0 END AS steps,
         CASE WHEN r.interrupted
              THEN EXTRACT(EPOCH FROM r.end_ts - GREATEST(r.start_ts, COALESCE(r.ck_ts, r.start_ts))) * r.gpus
              ELSE 0 END AS lost_s,
         EXTRACT(EPOCH FROM r.end_ts - r.start_ts) * r.gpus AS total_s
  FROM runs r
  JOIN jobs j ON j.job_id = r.job_id
)
SELECT team, job_id,
       COUNT(*) FILTER (WHERE interrupted)           AS interruptions,
       SUM(steps)                                    AS recomputed_steps,
       ROUND(SUM(lost_s) / 3600, 2)                  AS lost_gpu_hours,
       ROUND(SUM(lost_s) / SUM(total_s), 4)          AS lost_share
FROM per_run
GROUP BY GROUPING SETS ((team, job_id), (team))
ORDER BY team, job_id NULLS LAST;
```

**Explanation.** A running count of `start` events ordered by time assigns every event to its run (no other event of a job shares a second with a `start`, so the default `RANGE` frame is safe; a checkpoint and an interruption may share a second, and both land in the same run either way). One `GROUP BY` per run then collapses it into start, end, GPUs, how it ended, and its latest checkpoint. Only `event_type = 'checkpoint'` feeds the checkpoint columns, so failed attempts are ignored without extra work, and a checkpoint at the interruption's second is included because nothing in a run comes after its end. Lost work runs from the restore point (latest checkpoint, else the run's start) to the interruption, charged at the run's own GPU count. `GROUPING SETS` produce the job rows and the team rows from the same unrounded seconds, so the team share is a ratio of totals.

**Complexity.** One sort per job for the window and hash aggregates: O(n log n) over events. Fine for millions of events; in a pipeline, runs would be materialised once and appended to.

**Dialect notes** (described, not executed). BigQuery supports `GROUPING SETS`/`ROLLUP` (recent versions) and `COUNTIF`; `TIMESTAMP_DIFF(end_ts, start_ts, SECOND)` replaces `EXTRACT(EPOCH …)`; there is no `FILTER`, so use `MAX(IF(event_type = 'start', event_ts, NULL))`. Snowflake: `GROUPING SETS`, `DATEDIFF('second', …)`, `COUNT_IF`, `MAX(IFF(…))`. Spark SQL: `GROUPING SETS`, `unix_timestamp` differences, `max(CASE …)`. MySQL 8: `WITH ROLLUP` instead of grouping sets (it would add a grand-total row to filter out), `TIMESTAMPDIFF(SECOND, …)`, `SUM(CASE …)`.

**Edge cases built into the data.** Runs interrupted before their first checkpoint (restore point = start); several checkpoints in one run; jobs with one to four runs; `event_id` in random order. Hard: preemptions; an interruption in exactly the same second as a checkpoint (zero lost work); a job never interrupted (zeros, but its GPU time counts in the team denominator). Very Hard: failed checkpoint attempts, including one after the last good checkpoint before an interruption; restarts on a different number of GPUs.

**Common mistakes.** Measuring from the run's start and ignoring checkpoints; restoring from the latest checkpoint of the job rather than of the run (the steps come out right, because the run started at that checkpoint, but the lost time then includes the previous run and the gap between runs); counting only `fail`; a strict `<` against the interruption time; using `checkpoint_failed` as a restore point; the first run's GPU count for all runs; inner-joining away never-interrupted jobs; averaging shares or summing rounded hours for team rows; numbering runs by `event_id`.

**Follow-up guidance.** (1) The classic first-order answer (Young/Daly) is an interval near sqrt(2 × checkpoint cost × mean time between interruptions); a strong candidate can derive the trade-off (expected loss ≈ half an interval per interruption versus checkpoint overhead per interval) and say that this data supplies both inputs. (2) For each preemption, the saving would be the lost GPU-seconds minus the cost of one checkpoint, provided the notice was long enough to save; report it as an upper bound. (3) Recomputed steps still mean the same thing; GPU-seconds now depend on the run, so shares remain comparable but "steps per GPU-hour" does not. (4) Key the stream by job, keep the open run as state (start, GPUs, last checkpoint), emit a row per closed run, and tolerate late events with a watermark or a correction job.

**Rubric anchors.** 2: runs reconstructed but restore points wrong (start only, or failed checkpoints used), or team rows averaged. 3: matches the expected result. 4: also reasons about the checkpoint interval trade-off and a streaming version.

**Strong signals.** Draws the timeline of one job before writing SQL; asks whether a checkpoint at the failure second counts; computes shares from unrounded seconds. **Red flags.** Treating every gap between events as GPU time; presenting the simplified restart model as how any particular framework behaves.

## NVD-L1-03

**Reference solution** (PostgreSQL; `{{min_jobs}}` is the instance's floor)

```sql reference
WITH first_attempt AS (
  SELECT job_id, partition_name, gpus_requested, queued_at, started_at, cancelled_at
  FROM job_attempts
  WHERE attempt = 1
), bucketed AS (
  SELECT f.*, b.bucket_min, b.label
  FROM first_attempt f
  JOIN gpu_buckets b
    ON f.gpus_requested >= b.bucket_min
   AND (b.bucket_max IS NULL OR f.gpus_requested <= b.bucket_max)
)
SELECT partition_name, bucket_min, label AS gpu_bucket,
       COUNT(started_at)                                                     AS jobs_started,
       COUNT(*) FILTER (WHERE started_at IS NULL AND cancelled_at IS NOT NULL) AS cancelled_before_start,
       ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM started_at - queued_at) / 60))::numeric, 2) AS median_wait_min
FROM bucketed
GROUP BY partition_name, bucket_min, label
HAVING COUNT(started_at) >= {{min_jobs}}
ORDER BY partition_name, bucket_min;
```

**Explanation.** Attempt 1 alone defines the wait from submission to start, so requeues never add samples. The bucket join treats a NULL `bucket_max` as unbounded; a plain `BETWEEN` would silently drop every large request. Jobs that never started have a NULL wait, which `PERCENTILE_CONT` ignores, so the median is over started jobs only, while `COUNT(*) FILTER` counts the cancelled-before-start ones and still-waiting jobs (neither timestamp) are counted nowhere. A job cancelled after it started has a `started_at` and is a normal sample. `HAVING` applies the floor to started jobs. `PERCENTILE_CONT` returns double precision, hence the cast before `ROUND`.

**Complexity.** One sort per group for the ordered-set aggregate: O(n log n). Exact medians need all values of a group in one place, which is what makes them expensive at scale (follow-up 3).

**Dialect notes** (described, not executed). BigQuery: no ordered-set aggregates; `APPROX_QUANTILES(x, 2)[OFFSET(1)]` is approximate, and an exact median needs `PERCENTILE_CONT(x, 0.5) OVER (PARTITION BY …)` (analytic only) plus `DISTINCT`/`ANY_VALUE`. Snowflake: `MEDIAN(x)` or `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)`, `COUNT_IF`. Spark SQL: `percentile(x, 0.5)` is exact, `percentile_approx` approximate; recent versions also accept `percentile_cont … WITHIN GROUP`. MySQL 8: no median function; rank rows with `ROW_NUMBER` and `COUNT` windows and average the middle one or two.

**Edge cases built into the data.** Jobs cancelled before start in most groups; a group one short of the floor; an even-sized reported group (median of two middles); buckets whose labels do not sort as text (`bucket_min` orders them); an open-ended top bucket. Hard: jobs cancelled after they started; jobs still waiting at the end of the sample; requests exactly on bucket bounds; a group exactly at the floor. Very Hard: requeued jobs with a second attempt and its own wait.

**Common mistakes.** `AVG` instead of a median; `PERCENTILE_DISC`; `BETWEEN` with a NULL upper bound; excluding every row with `cancelled_at`; counting cancelled jobs in the floor; using all attempts or `MIN(queued_at)`/`MAX(started_at)` across attempts; `ROUND` on double precision (an error in PostgreSQL); ordering by the label text.

**Follow-up guidance.** (1) Waiting jobs are right-censored: a Kaplan–Meier estimate of the wait distribution uses them correctly, or at least report the number still waiting and their current age next to the median. (2) Condition on the queue state at submission (jobs and GPUs ahead, time of day, partition) and give a range (e.g. 25th to 75th percentile of similar past jobs), with a note when there are few comparable jobs. (3) Mergeable sketches (t-digest, KLL, DDSketch) per group and hour, merged at query time, with a stated relative or rank error; they also make the report incremental. (4) Use scheduler decision logs if they exist: time when enough GPUs were free but the job was not chosen is priority wait; time when no fit existed is capacity wait. Without logs, reconstruct free capacity over time from the start and end of other jobs.

**Rubric anchors.** 2: groups and counts right but mean, `PERCENTILE_DISC`, or the open bucket dropped. 3: matches the expected result. 4: also discusses censoring and approximate quantiles credibly.

**Strong signals.** Asks which timestamps define a wait and how cancellations are recorded; notices the NULL upper bound; checks an even-sized group by hand. **Red flags.** Promising users a wait time from a median alone; treating this generic scheduler as how any specific product schedules.

## NVD-L1-04

**Reference solution**

```python reference
import heapq


def place_slices(num_gpus, slots, ops):
    sizes = [k for k in (1, 2, 4) if k <= slots]
    blocks = {k: [(((1 << k) - 1) << o, o) for o in range(0, slots, k)] for k in sizes}
    masks = [0] * num_gpus
    drained = [False] * num_gpus
    heaps = {k: list(range(num_gpus)) for k in sizes}          # GPUs that may fit size k
    queued = {k: [True] * num_gpus for k in sizes}
    live, out = {}, []

    def fits(m, k):
        for b, o in blocks[k]:
            if not m & b:
                return b, o
        return None

    def refresh(g):                                            # g may fit again: make sure it is queued
        m = masks[g]
        for k in sizes:
            if not queued[k][g] and fits(m, k):
                queued[k][g] = True
                heapq.heappush(heaps[k], g)

    for op in ops:
        kind = op[0]
        if kind == 'alloc':
            _, rid, k = op
            h, q = heaps[k], queued[k]
            placed = None
            while h:
                g = h[0]
                hit = None if drained[g] else fits(masks[g], k)
                if hit is None:                                # stale entry: drop it lazily
                    heapq.heappop(h)
                    q[g] = False
                    continue
                b, o = hit
                masks[g] |= b
                live[rid] = (g, b)
                placed = (g, o)
                break
            out.append(placed)
        elif kind == 'free':
            hit = live.pop(op[1], None)
            if hit:
                g, b = hit
                masks[g] &= ~b
                if not drained[g]:
                    refresh(g)
        elif kind == 'drain':
            drained[op[1]] = True
        elif kind == 'undrain':
            g = op[1]
            if drained[g]:
                drained[g] = False
                refresh(g)
    return out
```

**Explanation.** Each GPU is a bitmask, so "can this GPU take a size-k slice, and where" is at most `slots / k` mask tests. For each size there is a min-heap of GPU numbers with one invariant: every GPU that is eligible for size k (not drained, has an aligned free block) is in heap k. The heap may also hold GPUs that are no longer eligible; they are popped lazily when they reach the top, and a `queued` flag prevents duplicates. An allocation leaves its GPU at the top (it may still fit more). Only two events can make a GPU eligible again, a release on an active GPU and an undrain, and both call `refresh`, which pushes the GPU into every heap it now fits and is not already in. Draining needs no work at all: the drained GPU is discarded when it reaches a heap's top. Each pop is paid for by an earlier push, and each push by a state change, so every operation is O(log G) amortised.

**Complexity.** O((G + n) log G) time for G GPUs and n operations, O(G + n) memory. The timing test (3 000 GPUs, 150 000 operations, about 80 000 of them allocations on a nearly full cluster) runs in about 0.35–0.45 s in CPython. Scanning GPUs from 0 for each request gave the same answers and took about 98 s with 8 slots (over 60 s with 4), because the free slots left by releases are spread across the whole cluster and rejected requests scan every GPU.

**Dialect notes.** Java: `PriorityQueue<Integer>` per size plus a `boolean[][] queued`, or a `TreeSet<Integer>` per size with exact (non-lazy) removal. C++: `std::set<int>` per size keeps exact membership and gives `begin()` as the first fit. A segment tree over GPUs storing, per node, whether any GPU below fits size k answers "leftmost fitting GPU" in O(log G) without laziness. Not executed here.

**Edge cases built into the tests.** A 2-slot slice skipping an odd free slot; a 4-slot slice failing although four slots are free but unaligned; a release that makes GPU 0 the first fit again; a whole-GPU slice on 4-slot GPUs; the lowest free offset inside a partly used GPU; (Hard) releasing a rejected id, a double release and an unknown id, a full cluster that rejects even a 1-slot slice and then accepts after a release; (Very Hard) a drained GPU with free slots skipped, a release on a drained GPU that must not make it eligible until undrain, a double drain and an undrain of an active GPU.

**Common mistakes.** Any contiguous free run instead of aligned offsets; next fit instead of first fit; a GPU never re-entering a heap after it filled up; pushing duplicates without a guard (correct but the heap grows without bound); releasing a rejected id and freeing someone else's slots; removing drained GPUs from the heaps eagerly but forgetting to re-add them; a sorted list with O(n) inserts; scanning all GPUs.

**Follow-up guidance.** (1) Two 4-slot GPUs, GPU 0 empty and GPU 1 with slots 2–3 free: a 2-slot request then a 4-slot request. First fit splits GPU 0 and rejects the 4-slot request; best fit fills GPU 1 and accepts both. Counterexamples the other way exist as well (best fit can leave many GPUs with one stranded slot); a strong candidate builds one by hand or says they would search for one by replay, and concludes that neither policy dominates, so the choice should be judged on recorded traces. (2) Try sizes from largest to smallest, each with its own heap, and return the first hit; the answer is "the lowest GPU that fits the largest acceptable size", which should be stated, since "lowest GPU with any acceptable size" is a different policy. (3) Rank GPUs by how few slices they hold (or how soon those are expected to finish), drain the cheapest, and use the replay to count rejections during the drain. (4) Heaps per (size, interconnect group) work while slices stay inside a group; requests that span groups need a different search, and first fit per group no longer means first fit overall.

**Rubric anchors.** 2: correct offsets and first fit on small tests, but a scan per request, or GPUs never re-entering after a release. 3: all tests pass with per-size heaps (or an ordered set / segment tree). 4: also argues the invariant behind lazy invalidation and compares policies with counterexamples.

**Strong signals.** States the heap invariant aloud; notices that only releases and undrains make a GPU eligible; asks what a release of a rejected id means. **Red flags.** Moving existing slices to make room; presenting this layout as how a specific GPU product partitions itself.

## NVD-L1-05

**Reference solution**

```python reference
def self_times(events, end_ts):
    stacks, out = {}, {}

    def close(st, t):
        name, start, child = st.pop()
        dur = t - start
        calls, own = out.get(name, (0, 0))
        out[name] = (calls + 1, own + dur - child)
        if st:
            st[-1][2] += dur                      # the parent's children time

    for ev in events:
        if ev[0] == 'push':
            stacks.setdefault(ev[1], []).append([ev[3], ev[2], 0])
        else:
            st = stacks.get(ev[1])
            if st:
                close(st, ev[2])                  # a pop with nothing open is ignored
    for st in stacks.values():                    # truncated trace: close innermost first
        while st:
            close(st, end_ts)
    return out
```

**Explanation.** Each thread has a stack of open ranges `[name, start, children]`. A pop closes the top: its self time is its duration minus the accumulated durations of its direct children, and its own duration is added to the children total of the range below it. That single addition is what makes grandchildren drop out automatically: a grandchild's duration is added to its parent, never to the grandparent. Recursion needs no special case because each instance is its own stack entry. A pop on an empty stack is ignored, and at the end any open ranges are closed at `end_ts` from the innermost outwards, so each parent still receives its children's durations.

**Complexity.** O(n) time, O(maximum depth) memory per thread plus one entry per name. The timing test (300 000 events, 4 threads, depth up to 400) runs in about 0.15 s in CPython. Building the ranges and then, for each range, scanning forward for its direct children gave the same answers and took about 29 s, because the scan for a range costs as many events as it encloses, and with deep nesting that is roughly n × average depth.

**Dialect notes.** Java and C++: an `ArrayDeque`/`std::vector` per thread in a hash map; use 64-bit integers for nanosecond sums. In SQL, self time can be computed from materialised ranges with a parent id (`duration − SUM(child durations)` via a self-join on the parent), but recovering the parent from push/pop events needs a running depth per thread (`SUM(±1) OVER (PARTITION BY thread ORDER BY seq)`) and matching each pop to its push, which is awkward; a Spark job would group by thread and run the stack pass per group. Not executed here.

**Edge cases built into the tests.** A parent with two children; a grandchild that must not be subtracted from the grandparent; a name nested in itself three deep; a leaf range; (Hard) a pop on one thread while another thread has a deeper stack, zero-length ranges at one timestamp where list order decides the nesting, recursion of one name on two threads at once; (Very Hard) pops with nothing open (on a known and an unknown thread), ranges still open at the end closed at `end_ts`, and `end_ts` equal to the last event.

**Common mistakes.** Subtracting all descendants; one global stack for all threads; reporting inclusive time; double counting recursive instances when computing anything per name; sorting events by timestamp and breaking the order of equal timestamps; crashing on a pop with an empty stack; dropping ranges still open at the end, or closing them outermost first so parents miss their children; a forward scan per range.

**Follow-up guidance.** (1) Inclusive time per name with recursion: count a range's duration only if no ancestor on the stack has the same name (keep a per-name depth counter per thread); otherwise nested instances double count. (2) Aggregate per call path (the stack of names, possibly with loop indices collapsed) rather than per name, then compare distributions per path between runs, and normalise by step count; report the paths whose share changed, not just the slowest. (3) Correlate each kernel launch with the range open on the launching thread at launch time, then attribute the kernel's GPU duration to that range on a separate GPU timeline; CPU self time and GPU time answer different questions and should not be added. (4) Split by thread and time; each chunk emits closed ranges plus its unmatched pushes and pops at the edges, and a second pass stitches the edges in order, which is associative enough to do as a tree reduction.

**Rubric anchors.** 2: right on simple nesting but subtracts grandchildren, mixes threads, or scans per range. 3: all tests pass with a stack per thread. 4: also handles inclusive time with recursion correctly and explains asynchronous GPU attribution.

**Strong signals.** Explains why adding a child's duration to its parent alone makes grandchildren disappear; asks how equal timestamps and truncated traces behave. **Red flags.** Presenting CPU range time as GPU time; claiming this is the output format of a specific profiler.
