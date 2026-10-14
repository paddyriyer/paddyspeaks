# Confluent · Loop 1 — evaluator notes (hidden from candidates)

## CFL-L1-01

**Reference solution** (PostgreSQL; `{{streak}}` is the instance's minimum number of increases)

```sql reference
WITH consumed AS (                    -- each partition a group consumes, from its first commit
  SELECT c.group_id, c.topic, c.partition_id, MIN(s.taken_at) AS first_at
  FROM committed_offsets c
  JOIN snapshots s USING (snapshot_id)
  GROUP BY c.group_id, c.topic, c.partition_id
), grid AS (                          -- every snapshot from that first commit on
  SELECT g.group_id, g.topic, g.partition_id, s.snapshot_id, s.taken_at
  FROM consumed g
  JOIN snapshots s ON s.taken_at >= g.first_at
), lags AS (
  SELECT gr.group_id, gr.taken_at,
         GREATEST(l.log_end_offset - (
           SELECT c.committed_offset            -- latest commit at or before this snapshot
           FROM committed_offsets c
           JOIN snapshots s2 USING (snapshot_id)
           WHERE c.group_id = gr.group_id AND c.topic = gr.topic
             AND c.partition_id = gr.partition_id AND s2.taken_at <= gr.taken_at
           ORDER BY s2.taken_at DESC
           LIMIT 1), 0) AS lag
  FROM grid gr
  JOIN log_end_offsets l
    ON l.snapshot_id = gr.snapshot_id AND l.topic = gr.topic AND l.partition_id = gr.partition_id
), totals AS (
  SELECT group_id, taken_at, SUM(lag) AS total_lag
  FROM lags
  GROUP BY group_id, taken_at
), steps AS (
  SELECT group_id, taken_at, total_lag,
         LAG(total_lag) OVER w AS prev_lag,
         LAG(taken_at)  OVER w AS prev_at
  FROM totals
  WINDOW w AS (PARTITION BY group_id ORDER BY taken_at)
), islands AS (                       -- a new island starts at every step that is not an increase
  SELECT *, COALESCE(total_lag > prev_lag, false) AS up,
         SUM(CASE WHEN total_lag > prev_lag THEN 0 ELSE 1 END)
           OVER (PARTITION BY group_id ORDER BY taken_at) AS island
  FROM steps
)
SELECT group_id,
       MIN(prev_at)   AS streak_start,
       MAX(taken_at)  AS streak_end,
       COUNT(*)       AS increases,
       MIN(prev_lag)  AS lag_at_start,
       MAX(total_lag) AS lag_at_end
FROM islands
WHERE up
GROUP BY group_id, island
HAVING COUNT(*) >= {{streak}}
ORDER BY group_id, streak_start;
```

**Explanation.** First make the lag table dense: every partition a group consumes, at every snapshot from its first commit on. The committed offset at a snapshot is the latest commit at or before it (a carry-forward); below Very Hard every snapshot has a row, so the lookup returns that row. Each partition's lag is clamped at 0 before summing, so a committed offset read a moment after its log-end offset cannot cancel another partition's real lag. Summing gives one total per (group, snapshot). `LAG` over `taken_at` (never `snapshot_id − 1`, because ids have gaps) gives the previous total; a step is an increase only when strictly greater. A running `SUM` of the non-increase flags numbers the islands, and the increase rows of one island are one streak. Because totals rise strictly within a streak, `MIN(prev_lag)` is the baseline lag and `MAX(total_lag)` the final one; `MIN(prev_at)` is the baseline snapshot.

**Complexity.** The correlated lookup is an index probe per (group, partition, snapshot) with the primary key; one window sort per group; O(n log n) overall. In production the collector would store the carried-forward offset itself, and streaks would be detected incrementally.

**Dialect notes** (described, not executed). BigQuery and Snowflake: `LAST_VALUE(committed_offset IGNORE NULLS) OVER (PARTITION BY group_id, topic, partition_id ORDER BY taken_at)` over a dense grid replaces the correlated subquery; `GREATEST` exists in both; `COUNTIF`/`COUNT_IF` for flags. Spark SQL: `last(committed_offset, true) OVER (…)`, and window frames for the islands are the same. MySQL 8: window functions and `LATERAL` exist; `GREATEST` is fine, but `LAG` over a CTE is the usual way.

**Edge cases built into the data.** Snapshot ids with gaps; an equal total between two growth runs (Medium: N − 1 increases, an equal step, then more growth: `>=` merges them into a false streak); two streaks in one group; Hard: groups consuming two topics, a committed offset above its log-end offset (raw lag negative), a streak of exactly N; Very Hard: rows only when the committed offset changed, a stalled partition with no rows while its lag grows, a partition whose first commit arrives part-way through (its lag joins the total then), and a group whose series starts late.

**Common mistakes.** Joining on `snapshot_id − 1`; `>=` for growth; counting snapshots instead of increases (off by one); reporting the first increased snapshot as the start; clamping the group total instead of each partition (or not clamping); an inner join on `snapshot_id` that drops partitions without a row, so a stalled partition looks caught up; dense-ranking snapshots per group, which breaks when a group starts late.

**Follow-up guidance.** (1) Time lag needs the timestamp of the record at the committed offset (or a sample of offset → time from the log); the age of the oldest unconsumed record is the clearer number for people. (2) Keep per-group state (previous total, current run length and baseline) in a stream processor keyed by group; emit when the run reaches N. (3) Annotate known backfills with an expected end and suppress only while lag is draining at the expected rate; a stall (no committed offset change) should still alert. (4) Lag drops to zero with a jump in committed offset larger than the records produced since: detect committed-offset jumps against log-end growth, and alert on offset resets separately.

**Rubric anchors.** 2: totals per group right but streaks off by one, `>=`, or id arithmetic. 3: matches the expected result. 4: also handles time lag, incremental detection and offset resets credibly.

**Strong signals.** Builds the per-group total table first and checks it by hand; asks whether the collector writes a row per snapshot; treats a negative raw lag as a measurement artefact. **Red flags.** Treating missing rows as zero lag; deriving the previous snapshot from ids.

## CFL-L1-02

**Reference solution** (PostgreSQL; `{{min_bytes}}` and `{{k}}` are the instance's floor and multiple)

```sql reference
WITH samples AS (                     -- a sample delivered twice counts once
  SELECT DISTINCT topic, partition_id, sample_ts, bytes_in
  FROM bytes_in_samples
), hourly AS (                        -- bytes per partition per hour
  SELECT topic, date_trunc('hour', sample_ts) AS hour_start, partition_id, SUM(bytes_in) AS bytes
  FROM samples
  GROUP BY topic, date_trunc('hour', sample_ts), partition_id
), topic_hours AS (
  SELECT h.topic, h.hour_start, SUM(h.bytes) AS total_bytes,
         (SELECT c.partition_count              -- the count in force at the end of the hour
          FROM partition_count_changes c
          WHERE c.topic = h.topic AND c.effective_at < h.hour_start + INTERVAL '1 hour'
          ORDER BY c.effective_at DESC
          LIMIT 1) AS partitions
  FROM hourly h
  GROUP BY h.topic, h.hour_start
), busiest AS (
  SELECT DISTINCT ON (topic, hour_start) topic, hour_start, partition_id, bytes
  FROM hourly
  ORDER BY topic, hour_start, bytes DESC, partition_id
)
SELECT t.topic, t.hour_start,
       b.partition_id                                         AS busiest_partition,
       b.bytes                                                AS busiest_bytes,
       ROUND(t.total_bytes::numeric / t.partitions, 2)        AS mean_bytes,
       ROUND(b.bytes::numeric * t.partitions / t.total_bytes, 3) AS skew_ratio
FROM topic_hours t
JOIN busiest b USING (topic, hour_start)
WHERE t.total_bytes >= {{min_bytes}}
  AND b.bytes * t.partitions > {{k}} * t.total_bytes        -- no division: exact at the boundary
ORDER BY t.topic, t.hour_start;
```

**Explanation.** Aggregate twice: 20-minute samples to per-partition hourly totals, then partitions to topic-hours. `DISTINCT` first removes samples delivered twice (only present in Very Hard; elsewhere it changes nothing). The partition count is looked up as of the end of the hour (the latest change strictly before the next hour starts), so a partition added at 10:25 counts for the whole 10:00 hour and a change at exactly 11:00 belongs to 11:00. Dividing by the count, not by the number of partitions with rows, keeps idle partitions in the mean. `DISTINCT ON` with `bytes DESC, partition_id` picks the busiest partition with the tie-break. The threshold is compared without division (`busiest × count > k × total`), so a ratio exactly k is never reported because of a rounding artefact; rounding is applied only to the displayed columns.

**Complexity.** Two hash aggregates and one sort for `DISTINCT ON`, O(n log n) in the number of samples; the count lookup is one index probe per topic-hour.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_TRUNC(sample_ts, HOUR)`, `QUALIFY ROW_NUMBER() OVER (PARTITION BY topic, hour_start ORDER BY bytes DESC, partition_id) = 1`, and an as-of lookup with a correlated subquery or `ARRAY_AGG(… ORDER BY effective_at DESC LIMIT 1)[OFFSET(0)]`; `ROUND` on `NUMERIC` keeps exactness. Snowflake: `DATE_TRUNC('hour', …)`, `QUALIFY`, and `ASOF JOIN` for the count. Spark SQL: `date_trunc('hour', …)`, `row_number()` in a subquery, decimals for exact comparison. MySQL 8: no `DISTINCT ON`; use `ROW_NUMBER()` in a CTE.

**Edge cases built into the data.** Balanced topic-hours; a skewed topic-hour below the floor; Hard: idle partitions with no rows that make an hour skewed only when they count; a ratio of exactly k (not reported); a total exactly at the floor (reported); two partitions tied for busiest; Very Hard: partitions added mid-hour (the count at the hour's end applies) and exactly on an hour boundary, and samples delivered twice.

**Common mistakes.** Mean over sample rows (`AVG(bytes_in)`); dividing by the number of partitions that had traffic; comparing the rounded ratio; `>=` at the boundary; `>` for the floor; `RANK` returning two busiest rows on a tie; counting duplicate samples; taking the partition count at the start of the hour or the current count for every hour.

**Follow-up guidance.** (1) Per-key byte counts from a sample of records (or producer metrics by key hash) separate one heavy key from a hash collision; a producer that sends everything to one partition shows a single partition even with uniform keys. (2) The default hash changes the target partition of existing keys when the count changes, so per-key order across the change is not guaranteed and a compacted topic can hold a key in two partitions; plan a migration or a new topic. (3) Messages per second, consumer lag per partition and leader placement per broker; flag when the hot partition's leader is also the most loaded broker. (4) Pre-aggregate per partition per minute in the stream, keep hourly rollups for a year, and compute the report from rollups.

**Rubric anchors.** 2: right shape but mean over traffic-bearing partitions or sample rows, or boundary errors. 3: matches the expected result. 4: also explains hot-key diagnosis, repartitioning consequences and continuous computation.

**Strong signals.** Asks where the partition count comes from; avoids division in the threshold; checks the tie-break. **Red flags.** "Just add partitions" without considering key ordering; treating idle partitions as nonexistent.

## CFL-L1-03

**Reference solution** (PostgreSQL; `{{window_start}}` and `{{window_end}}` are the instance's day)

```sql reference
WITH bounds AS (
  SELECT TIMESTAMPTZ '{{window_start}}' AS ws, TIMESTAMPTZ '{{window_end}}' AS we
), spans AS (                          -- each row holds until the partition's next change
  SELECT c.topic, c.partition_id, c.isr_size,
         GREATEST(c.changed_at, b.ws) AS s,
         LEAST(COALESCE(LEAD(c.changed_at) OVER (PARTITION BY c.topic, c.partition_id
                                                 ORDER BY c.changed_at), b.we), b.we) AS e
  FROM isr_changes c CROSS JOIN bounds b
), clipped AS (
  SELECT sp.*, t.replication_factor AS rf, t.min_insync_replicas AS min_isr
  FROM spans sp JOIN topics t USING (topic)
  WHERE sp.e > sp.s
), urp AS (
  SELECT topic,
         COUNT(DISTINCT partition_id)          AS under_replicated_partitions,
         SUM(EXTRACT(EPOCH FROM e - s))        AS urp_seconds
  FROM clipped
  WHERE isr_size < rf
  GROUP BY topic
), below AS (                          -- below-min intervals of every partition of a topic
  SELECT topic, s, e,
         MAX(e) OVER (PARTITION BY topic ORDER BY s, e
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS reach
  FROM clipped
  WHERE isr_size < min_isr
), islands AS (                        -- a new island when an interval starts after everything so far
  SELECT topic, s, e,
         SUM(CASE WHEN reach >= s THEN 0 ELSE 1 END)
           OVER (PARTITION BY topic ORDER BY s, e ROWS UNBOUNDED PRECEDING) AS island
  FROM below
), merged AS (
  SELECT topic, SUM(EXTRACT(EPOCH FROM island_end - island_start)) AS below_seconds
  FROM (SELECT topic, island, MIN(s) AS island_start, MAX(e) AS island_end
        FROM islands GROUP BY topic, island) m
  GROUP BY topic
)
SELECT u.topic,
       u.under_replicated_partitions,
       ROUND(u.urp_seconds / 60, 2)                     AS urp_partition_minutes,
       ROUND(COALESCE(m.below_seconds, 0) / 60, 2)      AS below_min_isr_minutes
FROM urp u
LEFT JOIN merged m USING (topic)
ORDER BY u.topic;
```

**Explanation.** Each change row starts an interval that lasts until the partition's next change. `LEAD` must run over all rows, before any window filter, so the last change before the window (yesterday's) still produces the interval in force at midnight. Clipping with `GREATEST`/`LEAST` and keeping only intervals with end > start drops rows from before and after the window and the change at exactly the window end. Under-replicated time is a plain sum over partitions with `isr_size < replication_factor`, and `COUNT(DISTINCT partition_id)` counts partitions, not intervals. Below-min time is per topic, as a union: intervals with `isr_size < min_insync_replicas` from all partitions are sorted by start, and a new island begins only when an interval starts after the largest end seen so far (`MAX(e)` over the preceding rows), which handles nested intervals; touching intervals merge, which does not change the total. Topics with no under-replicated time are omitted; a topic with under-replicated time but nothing below the minimum shows 0.

**Complexity.** One sort per partition for `LEAD`, one per topic for the island window; O(n log n).

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_DIFF(e, s, SECOND)`, the same window functions; `COUNTIF`. Snowflake: `DATEDIFF('second', s, e)`, `CONDITIONAL_TRUE_EVENT` can number islands. Spark SQL: `unix_timestamp(e) - unix_timestamp(s)`, window frames as here. MySQL 8: `TIMESTAMPDIFF(SECOND, s, e)`; `LEAD` and running `MAX` are supported.

**Edge cases built into the data.** Medium: every partition has a row at the window start; a partition that is under-replicated twice (counted once); at most one partition per topic below the minimum. Hard: state carried in from the previous day, rows after the window and exactly at its end, repeated sizes, overlapping below-min intervals in one topic. Very Hard: per-topic settings including `min_insync_replicas` equal to the replication factor, a partition whose only row is from the day before, and a nested interval followed by one that starts inside the outer one (a merge against the previous row's end double counts).

**Common mistakes.** Filtering to the window before `LEAD`; not clipping at the window end; `<=` against the minimum; summing below-min time across partitions; merging against the previous row's end; `COUNT(*)` of intervals as partitions; minute buckets that lose seconds.

**Follow-up guidance.** (1) Correlate with producer error metrics (`NOT_ENOUGH_REPLICAS` responses) per client and topic; the ISR log only says writes would fail. (2) Keep settings as effective-dated rows and split each interval at setting changes before comparing. (3) Alert on a partition's current run length, not on each shrink, with a grace period that covers a rolling restart; page when below-min time starts, not when it ends. (4) Log which replicas left the ISR (or the leader's broker per interval) and attribute minutes to the missing broker; most incidents are one broker.

**Rubric anchors.** 2: per-partition intervals right but no carry-in, no clipping, or a summed below-min total. 3: matches the expected result. 4: also discusses rejected writes, settings history, alerting and broker attribution.

**Strong signals.** Asks how the state at midnight is known; draws the overlapping intervals; distinguishes partition-minutes from topic-minutes. **Red flags.** Expanding the day into minutes and joining (loses seconds, explodes at scale); treating ISR equal to the minimum as unavailable.

## CFL-L1-04

**Reference solution**

```python reference
def compact(records, active_start, now_ms, delete_retention_ms, min_lag_ms):
    by_part = {p: [] for p in active_start}
    for rec in records:
        by_part[rec[0]].append(rec)
    young = now_ms - min_lag_ms            # a record with ts_ms above this is too young to clean
    horizon = now_ms - delete_retention_ms # a tombstone at or before this is dropped
    out = {}
    for p, recs in by_part.items():
        end = active_start[p]              # first offset that is not cleanable
        for _, off, _, _, ts in recs:
            if off >= end:
                break
            if ts > young:
                end = off
                break
        last = {}                          # key -> its last offset inside the cleanable range
        for _, off, key, _, _ in recs:
            if off >= end:
                break
            last[key] = off
        kept = []
        for _, off, key, value, ts in recs:
            if off >= end:
                kept.append(off)
            elif last[key] == off and not (value is None and ts <= horizon):
                kept.append(off)
        out[p] = kept
    return out
```

**Explanation.** Partitions never interact, so the records are grouped by partition (in input order, which is offset order). The cleanable range ends at the active segment, or earlier, at the first record in offset order that is younger than the minimum lag (Very Hard): later records are not cleanable even if their timestamps are older, because the range is a prefix of offsets. One pass over the range stores each key's last offset in it; records outside the range are never added, so a newer record in the active segment does not supersede older ones. A third pass keeps everything outside the range and, inside it, only each key's last record, dropping it when it is a tombstone at or past the horizon. Offsets are preserved, so the result is ascending.

**Complexity.** O(n) time and O(keys) memory per partition. The timing test (300 000 records over 60 000 keys) runs in about 0.4 s in CPython; a version that rescans the cleaned records once per key did not finish in 60 s.

**Dialect notes.** Java: a `HashMap<String, Long>` from key to last offset; C++: `unordered_map`. In SQL the same answer is `ROW_NUMBER() OVER (PARTITION BY partition, key ORDER BY offset DESC) = 1` within the cleanable range, plus the rows outside it. Not executed here.

**Edge cases built into the tests.** Several versions of one key; a newer record in the active segment that must not remove older ones; a tombstone exactly at the horizon (dropped) and one millisecond newer (kept); a tombstone followed by a re-insert; Hard: the same key in two partitions, offset gaps, an empty active segment and a partition with no records (empty list); Very Hard: the first too-young record ends the range even though later records are older, and a record exactly at the lag boundary is still cleanable.

**Common mistakes.** Letting active-segment records supersede older ones; compacting the active segment; one dictionary across partitions; `<` instead of `<=` at the horizon; dropping every tombstone or keeping every tombstone; ending the cleanable range at any too-young record found anywhere instead of the first in offset order; returning offsets renumbered from 0; omitting a partition with no records.

**Follow-up guidance.** (1) Bound the offset map: process the dirty part of the log in chunks that fit the map (several passes), or store key hashes rather than keys and accept rare collisions by verifying against the record. (2) A consumer that starts after the tombstone is dropped sees neither the value nor the delete, so its state keeps the old value: `delete_retention_ms` should exceed the longest time a consumer can take to read from the beginning. (3) Superseded records remain until their segment is cleaned, so consumers can see several versions of a key; that is allowed, since compaction only promises the last value is kept. (4) A minimum lag gives consumers a window to see every change (not just the latest), at the cost of keeping that much uncompacted data on disk.

**Rubric anchors.** 2: last-value-per-key right but active segment or horizon rules wrong, or quadratic. 3: all tests pass in O(n). 4: also discusses memory bounds, tombstone retention and what consumers observe.

**Strong signals.** Asks what the active segment is and why it is excluded; states the boundary comparisons before coding. **Red flags.** Sorting by timestamp to find the latest record per key (offset order defines "latest" here); treating compaction as deleting old records by age.

## CFL-L1-05

**Reference solution**

```python reference
def apply_retention(partitions, configs, now_ms):
    out = {}
    for topic, pid, log_start, segs in partitions:
        retention_ms, retention_bytes = configs[topic]
        active = len(segs) - 1                 # index of the active segment: never deleted
        i = 0                                  # segments[:i] are deleted
        if retention_ms != -1:                 # 1. time: stop at the first one not expired
            while i < active and now_ms - segs[i][2] > retention_ms:
                i += 1
        if retention_bytes != -1:              # 2. size: one running total of what is left
            remaining = sum(size for _, size, _ in segs[i:])
            while i < active and remaining - segs[i][1] >= retention_bytes:
                remaining -= segs[i][1]
                i += 1
        while i < active and segs[i + 1][0] <= log_start:   # 3. below the log start offset
            i += 1
        deleted_bytes = sum(size for _, size, _ in segs[:i])
        out[(topic, pid)] = (i, deleted_bytes, max(log_start, segs[i][0]))
    return out
```

**Explanation.** Every rule deletes from the oldest end, so the state is one index `i`: segments before it are deleted. Time deletion advances while the oldest remaining segment has expired (strictly older than `retention_ms`) and stops at the first that has not, even if later ones have. The size step computes the remaining total once, including the active segment, and advances while removing the next segment would leave at least `retention_bytes`, subtracting as it goes. The log-start step deletes a segment when the next one begins at or before the log start offset, which means the whole segment is below it. The active segment is excluded by the `i < active` guard in every loop. The new log start is the larger of the requested start and the first remaining base offset.

**Complexity.** O(s) per partition with O(1) extra memory beyond the input. The timing test (80 partitions × 10 000 segments, about 75 % deleted by size) runs in about 0.2 s in CPython; re-summing the remaining sizes after each deletion did not finish in 30 s, even with a C-level `sum` over list slices.

**Dialect notes.** Java/C++: the same index loop over an array of segment records. In SQL, size retention is a running sum from the newest end: a segment is deleted when the bytes of everything newer than it are at least `retention_bytes`, restricted to the prefix after time deletion. Not executed here.

**Edge cases built into the tests.** An expired active segment (kept); time deletion stopping at an unexpired segment with expired ones behind it; size equality (deleted) and one byte more (kept); time then size on the remainder; Hard: a segment exactly `retention_ms` old (kept), -1 for each limit and both; Very Hard: a log start offset inside a segment, on a segment's base offset, inside the active segment, and one already behind after time and size.

**Common mistakes.** Deleting the active segment; excluding the active segment from the size total; `>=` for age or `>` for size; continuing time deletion past an unexpired segment; treating -1 as a real limit; deleting the segment that contains the log start offset; new start equal to the first remaining base even when the request is beyond it; `pop(0)` in a loop (O(s²) on its own).

**Follow-up guidance.** (1) A future timestamp keeps its segment (and every newer one behind it) from expiring by time; size retention still bounds disk; brokers can reject or rewrite timestamps too far from the broker's clock, and monitoring the max timestamp skew per producer helps. (2) Keep a short local retention for hot reads and the full retention in object storage; the calculation runs twice, once per tier, and local deletion requires the segment to be uploaded first. (3) Project each partition's size forward with its byte rate, roll segments at the configured size, apply this function day by day and sum per broker by replica placement. (4) Size retention is per partition, so doubling partitions can double the topic's retained bytes; time retention is unaffected.

**Rubric anchors.** 2: right on simple cases but recomputes totals, or one boundary or the active-segment rule wrong. 3: all tests pass in O(s). 4: also discusses timestamp skew, tiered storage and forecasting.

**Strong signals.** Notices deletion is always a prefix and keeps one index; asks whether the active segment counts in the size. **Red flags.** Sorting segments by timestamp (deletion follows offset order); deleting segments in the middle of the log.
