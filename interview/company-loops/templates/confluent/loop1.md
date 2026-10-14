# Confluent · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of Apache Kafka
based data streaming: topics split into partitions, consumer groups that commit
offsets, replication with in-sync replicas, compacted topics and segment-based
retention. Every workload, number, name and schema is hypothetical, and nothing
here describes how any company's systems are actually built. Where a product
rule is used, it is stated as this exercise's rule; check current docs.

## CFL-L1-01: Consumer groups whose lag keeps growing

| | |
|---|---|
| **Template ID** | CFL-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / carry-forward lookups, LAG and gaps-and-islands streaks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, staff-data-engineer |
| **Generator** | CFL-L1-01.mjs |

**Business Scenario.** A streaming platform team watches consumer lag. For a consumer group and a partition, offset lag is how far the group's last committed offset is behind the partition's log-end offset (the offset the next record will receive), which is how public documentation describes it. One high reading is normal after a deploy or a rebalance; lag that rises at snapshot after snapshot means the group is not keeping up and someone should look. A collector snapshots log-end offsets and committed offsets every {{interval}}. You have {{snapshots}} snapshots covering {{groups}} groups, and the team wants every stretch where a group's total lag kept growing.

**Problem Statement.** Write one PostgreSQL query that returns `group_id, streak_start, streak_end, increases, lag_at_start, lag_at_end`. A partition's lag at a snapshot is `log_end_offset − committed_offset`, and a group's **total lag** at a snapshot is the sum of the lags of every partition it consumes, across topics. {{clamp_rule}} {{rows_rule}} A **streak** is a maximal run of consecutive snapshots of one group in which each snapshot's total lag is strictly greater than the previous snapshot's. Report every streak with at least {{streak}} increases: `streak_start` is the `taken_at` of the snapshot just before the first increase (the baseline), `streak_end` the `taken_at` of the last increase, `increases` the number of increases, and `lag_at_start` and `lag_at_end` the group's total lag at those two snapshots. Order by `group_id, streak_start`.

**Constraints.** One SQL statement (CTEs allowed). Snapshot ids increase with time but are not consecutive; order snapshots by `taken_at`. Every snapshot has a `log_end_offsets` row for every partition of every topic.

**Assumptions.** Groups, topics, offsets, the snapshot interval and the collector are hypothetical. Lag here is measured in records (offsets), not in time; a consumer that commits rarely looks laggier than it is, which is acceptable for this report.

**Clarifications.**
- Q: Does an equal total continue a streak? | A: No. An equal or lower total ends the streak; the next increase starts a new one.
- Q: Is `streak_start` the first snapshot that grew? | A: No, it is the snapshot just before it, the baseline the growth is measured from. A streak of N increases spans N + 1 snapshots.
- Q: Can I find the previous snapshot with `snapshot_id − 1`? | A: No. Ids have gaps; order by `taken_at`.
- Q: A group consumes two topics. Is that one total or two? | A: One total per group, over every partition it consumes in both topics.
- Q: Can a group have two separate streaks? | A: Yes. Report each one that has enough increases.

**Hints.**
1. Build one row per (group, snapshot) with its total lag first. The streak logic is much easier on that small table.
2. `LAG(total_lag) OVER (PARTITION BY group_id ORDER BY taken_at)` gives the previous total; mark each row as an increase or not.
3. Number the islands with a running `SUM` of "not an increase" flags: the increases of one streak share a number. Within a streak the totals only rise, so `MIN` and `MAX` give the start and end lag.
4. If a partition can be missing at a snapshot, its committed offset is the latest row at or before that snapshot: a correlated subquery with `ORDER BY taken_at DESC LIMIT 1`, or a `LATERAL` join.

**Follow-ups.**
1. Offset lag counts records. How would you report lag in time (the age of the oldest unconsumed record), and what extra data would the collector need?
2. Thousands of groups are snapshotted every minute. How would you detect these streaks continuously, as each snapshot arrives, instead of with a batch query?
3. During a planned backfill, lag grows on purpose for hours. How would you keep this alert from firing without hiding a real stall in the same group?
4. A group's committed offsets are reset to the latest offset and its lag drops to zero, skipping records. How would this report hide that, and what would you add to catch it?

**Follow-up rules.**
- when: snapshot_id - 1, snapshot_id-1, id - 1 → ask: Snapshot ids have gaps. What does a join on `snapshot_id − 1` return right after a gap, and how else can you find the previous snapshot?
- when: >=, greater than or equal → ask: Two snapshots in a row have the same total lag. Does your comparison continue the streak, and should it?
- when: row_number → ask: How do you turn ROW_NUMBER into island ids here, and what has to be true about the rows you number for the difference trick to work?
- when: inner join, join committed_offsets → ask: At a snapshot where a partition has no committed-offset row, what does your join do to that group's total, and is the group really caught up there?
- when: greatest, negative, clamp → ask: Why clamp each partition's lag at zero before summing, rather than clamping the group's total?

**Evaluation Criteria.** Total lag per group per snapshot over every consumed partition, across topics; snapshots ordered by time, not by id arithmetic; strictly greater comparison; streaks counted in increases with the baseline snapshot as the start; negative partition lag clamped to 0 before summing (Hard+); the latest committed offset carried forward and partitions counted from their first commit (Very Hard); deterministic order; can discuss time-based lag, streaming detection and offset resets.

## CFL-L1-02: Hot partitions: topic-hours where one partition takes far more than its share

| | |
|---|---|
| **Template ID** | CFL-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / two-level aggregation, top-1 per group, as-of lookups, exact ratio comparisons |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | CFL-L1-02.mjs |

**Business Scenario.** Producers choose a partition by hashing the record key, so a few very busy keys can send far more traffic to one partition than to the others. A hot partition overloads the broker that leads it and caps how fast its consumers can go, however many consumers the group has. The platform team samples bytes received per partition every 20 minutes and wants every topic-hour where the busiest partition took more than {{k}} times the topic's mean, as long as the topic carried at least {{min_mb}} MB that hour (skew on a nearly idle topic is noise).

**Problem Statement.** Write one PostgreSQL query that returns `topic, hour_start, busiest_partition, busiest_bytes, mean_bytes, skew_ratio`. For each topic and UTC hour (`date_trunc('hour', sample_ts)`), sum `bytes_in` per partition. The **mean** is the topic-hour's total bytes divided by the topic's partition count, `busiest_bytes` is the largest per-partition total (ties go to the lower `partition_id`), and `skew_ratio = busiest_bytes / mean`. Report a topic-hour when its total is at least `{{min_bytes}}` bytes and `busiest_bytes` is strictly greater than {{k}} times the mean. Round `mean_bytes` to 2 decimal places and `skew_ratio` to 3. Order by `topic, hour_start`. {{idle_rule}} {{count_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{samples}} rows. The partition count comes from `partition_count_changes`, never from the partitions that happen to have rows. Compare exactly: a ratio exactly {{k}} is not reported.

**Assumptions.** Topics, partition counts, byte volumes, the thresholds and the sampling interval are hypothetical. Bytes in is measured at the partition leader; replication traffic is out of scope.

**Clarifications.**
- Q: Is the mean over the partitions that had traffic? | A: No, over all of the topic's partitions. An idle partition is part of the imbalance.
- Q: Is the floor inclusive? | A: Yes: a topic-hour with total exactly `{{min_bytes}}` bytes qualifies.
- Q: Which hour does a sample belong to? | A: The UTC hour of `sample_ts`; each sample covers the 20 minutes after it.
- Q: Two partitions tie for busiest. Which one do I report? | A: The lower `partition_id`.
- Q: Should I compare the rounded ratio with the threshold? | A: No. Compare exact values; rounding is only for display.

**Hints.**
1. Aggregate twice: samples to (topic, hour, partition), then partitions to (topic, hour).
2. `DISTINCT ON (topic, hour_start) … ORDER BY topic, hour_start, bytes DESC, partition_id` picks the busiest partition with the tie-break.
3. `busiest > k × total / count` is the same as `busiest × count > k × total`, which avoids division entirely.
4. If the count can change, look it up as of the hour: the latest `partition_count_changes` row whose `effective_at` is before the right moment.

**Follow-ups.**
1. You find a hot partition. How would you tell whether it comes from one heavy key, many keys that hash together, or a producer that does not spread records across partitions?
2. The fix proposed is to add partitions. What happens to the ordering of records for existing keys, and to consumers of a compacted topic?
3. Bytes in is one signal. What other per-partition measures (messages, consumer lag, leader placement) would make the report more useful, and how would you combine them?
4. At thousands of topics with per-partition metrics every 10 seconds, how would you compute this continuously and keep a year of it cheaply?

**Follow-up rules.**
- when: avg, average → ask: Is your mean an average over partitions or over sample rows? How many partitions does an hour with an idle partition have in your query?
- when: count(distinct, count distinct → ask: If you count the partitions that appear in the samples, what happens in an hour where one partition received nothing at all?
- when: rank(), dense_rank → ask: Two partitions tie for busiest. How many rows does your query return for that topic-hour?
- when: round → ask: Do you round before or after comparing with the threshold? Show a value where the order changes the answer.
- when: rehash, more partitions, add partitions → ask: After adding partitions, where do existing keys go, and what does that do to per-key ordering?

**Evaluation Criteria.** Two-level aggregation with per-partition hourly totals; the mean divides by the topic's partition count, including idle partitions (Hard+), as of the end of the hour when partitions are added (Very Hard); duplicates removed (Very Hard); busiest partition with the lower-id tie-break; inclusive floor and strict exact ratio comparison; correct rounding; UTC hours; deterministic order; can explain hot keys, repartitioning trade-offs and how to run this at scale.

## CFL-L1-03: Under-replicated minutes and time below min in-sync replicas

| | |
|---|---|
| **Template ID** | CFL-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / state intervals from change events, clipping to a window, interval union |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, staff-data-engineer |
| **Generator** | CFL-L1-03.mjs |

**Business Scenario.** Each partition has a replication factor (how many brokers hold a copy) and an in-sync replica set (ISR): the replicas that are caught up with the leader. A partition whose ISR is smaller than its replication factor is under-replicated: it still works but has less redundancy. If the ISR falls below the topic's `min.insync.replicas`, producers that wait for all in-sync replicas (`acks=all`) have their writes rejected, so for them the topic is partly unavailable. The team logs every ISR size change and wants a daily report for the UTC day {{day}}.

**Problem Statement.** Write one PostgreSQL query over the window `[{{window_start}}, {{window_end}})` that returns `topic, under_replicated_partitions, urp_partition_minutes, below_min_isr_minutes`. Each `isr_changes` row gives a partition's ISR size from `changed_at` until that partition's next change. For each topic: `under_replicated_partitions` is the number of its partitions that spent any time in the window with `isr_size < replication_factor`; `urp_partition_minutes` is that time summed over its partitions; and `below_min_isr_minutes` is the time during which **at least one** of its partitions had `isr_size < min_insync_replicas` (overlapping partitions count once). Minutes are seconds / 60, rounded to 2 decimal places. Return only topics with some under-replicated time, ordered by `topic`. {{start_rule}} {{settings_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{changes}} change rows. Clip every interval to the window. No partition has two changes at the same second.

**Assumptions.** Topics, replication settings and ISR changes are hypothetical. ISR size is enough here; which replicas were in the set is out of scope. Below-min time is a proxy for "some `acks=all` writes would fail", whether or not anyone was writing.

**Clarifications.**
- Q: Is a partition with ISR exactly `min_insync_replicas` below the minimum? | A: No. At exactly the minimum, `acks=all` writes still succeed; only fewer is below.
- Q: Two partitions are below the minimum at the same time. Does that count twice? | A: Not in `below_min_isr_minutes`: it is the time the topic had at least one partition below. In `urp_partition_minutes` each partition's time counts.
- Q: Where does a partition's state at the window start come from? | A: From its latest change at or before the window start.
- Q: A partition's last change is in the afternoon. How long does that state last? | A: Until the window end, unless the partition changes again first.
- Q: What about a change exactly at `{{window_end}}`? | A: It belongs to the next day and adds nothing here.

**Hints.**
1. Turn change rows into intervals with `LEAD(changed_at) OVER (PARTITION BY topic, partition_id ORDER BY changed_at)`, before filtering to the window, so the interval in force at the window start is kept.
2. Clip with `GREATEST(start, window_start)` and `LEAST(COALESCE(next, window_end), window_end)`, then keep intervals with end > start.
3. The topic-level below-min time is the length of a union of intervals: sort by start, start a new island when an interval begins after the largest end seen so far, and add up the islands.
4. "The largest end so far" is `MAX(e) OVER (… ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`; the previous row's end alone is not enough.

**Follow-ups.**
1. The report says a topic spent 40 minutes below the minimum. How would you tell which producers actually had writes rejected, and what data would you need?
2. Replication factor and `min.insync.replicas` can change during the day. How would you model their history and use it here?
3. How would you turn this into an alert that fires when a partition has been under-replicated for more than ten minutes, without paging on every short ISR shrink during a rolling restart?
4. Across a large fleet, under-replicated partitions often share one broker. How would you attribute the minutes to brokers, and what extra data does that need?

**Follow-up rules.**
- when: lead → ask: Do you compute LEAD before or after filtering to the window? Which row gives a partition's state at the window start in each case?
- when: lag(, previous end, prev_end → ask: Three intervals: [1:00, 3:00), [1:10, 1:20) and [2:00, 4:00). If you compare each start with the previous row's end, what total do you get, and what is right?
- when: sum, add up → ask: Two partitions of the same topic are below the minimum at the same time. Does your below-min total count those minutes once or twice?
- when: <=, at or below → ask: A partition has exactly `min_insync_replicas` in sync. Can an `acks=all` producer still write to it?
- when: generate_series, every minute, per minute → ask: You expand the day into minutes. What happens to a change at 10:00:30, and how big does this get for a month of a large cluster?

**Evaluation Criteria.** Intervals from change rows with LEAD computed over all rows; the state at the window start carried in (Hard+); clipping at both window edges, including a change exactly at the end; strict comparisons with the replication factor and the minimum; distinct partition counts; below-min time as a union of intervals per topic, merged against the running maximum end (Very Hard has a nested interval); per-topic settings; correct rounding; can discuss attributing failures, settings history, alerting and broker attribution.

## CFL-L1-04: What a log-compaction pass leaves behind

| | |
|---|---|
| **Template ID** | CFL-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps / last occurrence per key in one pass, with range and time rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | CFL-L1-04.mjs |

**Business Scenario.** A compacted topic keeps at least the latest record for each key instead of deleting by age, which makes it a durable changelog of current state (account settings, customer profiles). A record with a null value is a tombstone: it marks the key as deleted and is itself removed some time later, so consumers that read from the beginning still have a chance to see the delete. The team wants to predict exactly which offsets a compaction pass will leave, to check a restored replica and to explain to a consumer why an old offset is gone. The rules below are this exercise's simplified model of compaction; check current docs for the product's actual behaviour.

**Problem Statement.** Implement `compact(records, active_start, now_ms, delete_retention_ms, min_lag_ms)`. Each record is `(partition, offset, key, value, ts_ms)`; `value` is `None` for a tombstone. Within each partition, records are listed in offset order (partitions may be interleaved). `active_start[p]` is the base offset of partition `p`'s active segment, which is never compacted. Per partition:
1. The **cleanable range** is every record with offset below `active_start[p]`. {{lag_rule}}
2. A record in the cleanable range is removed if a later record (higher offset) with the same key is also in the cleanable range. Records outside the range never remove anything.
3. A tombstone in the cleanable range that is not removed by rule 2 is still dropped when `ts_ms <= now_ms - delete_retention_ms` (its delete horizon has passed).
4. Every other record stays, including every record outside the cleanable range.

Return `{partition: [offsets that remain, ascending]}` with an entry for every partition in `active_start`. {{parts_rule}}

**Constraints.** Up to 300 000 records and 60 000 distinct keys. Expected: O(n) time with a dict. Rescanning the log for each key or for each record is O(n × keys) and too slow.

**Assumptions.** Keys, values, timestamps and settings are hypothetical. Offsets are never renumbered by compaction, which is why a consumer can see gaps. Real compaction works segment by segment and decides tombstone removal differently; this model keeps only the parts needed for the exercise.

**Clarifications.**
- Q: A key's newest record is in the active segment. Does it remove the key's older records? | A: No. Only records inside the cleanable range count when deciding what is superseded, so the older record stays until a later pass.
- Q: Is a tombstone exactly at the horizon kept? | A: No. `ts_ms <= now_ms - delete_retention_ms` is dropped; one millisecond newer is kept.
- Q: A key is deleted with a tombstone and then written again. What remains? | A: If the new value is in the cleanable range, it supersedes the old value and the tombstone, so only it remains.
- Q: Do keys interact across partitions? | A: No. Each partition is compacted on its own.
- Q: Can I sort the records? | A: You may, but they are already in offset order within each partition, and a single pass is enough.

**Hints.**
1. Group records by partition first; everything after that is per partition.
2. Find where the cleanable range ends, then make one pass that stores each key's last offset inside it.
3. A record in the range survives only if it is its key's last offset; then apply the tombstone horizon to the survivors.
4. Keep the comparisons exact: `>` for "too young to clean", `<=` for "past the horizon".

**Follow-ups.**
1. The offset map for 60 000 keys fits in memory. What changes when a partition has a billion distinct keys, and how could you bound the memory a pass needs?
2. A consumer reads the topic from the beginning but is slow, so it starts after a tombstone was dropped. What does it see for that key, and how should `delete_retention_ms` be chosen?
3. Compaction runs segment by segment, in the background. Which records can a consumer see that this model says are gone, and does that break any guarantee?
4. Why does a compacted topic still need a minimum compaction lag for some consumers, and what does it cost in disk?

**Follow-up rules.**
- when: for key in, for each key, .index(, count( → ask: How many times does your code scan the log, and how long will that take for 60 000 keys and 300 000 records?
- when: sorted(, sort → ask: The records are already in offset order per partition. What does sorting cost you, and do you need it at all?
- when: active segment, active_start → ask: A key's newest record is in the active segment. Which of its older records survive this pass, and why?
- when: horizon, delete_retention_ms → ask: A tombstone is the last record for its key and is exactly at the delete horizon. Is it kept, and what does a consumer that starts reading later miss?
- when: deque, heap → ask: Which part of this problem needs ordering at all, and could a plain dict do it?

**Evaluation Criteria.** Partitions handled independently; the cleanable range ends at the active segment (and at the first too-young record in Very Hard, even when later records look older); one pass that records each key's last offset inside the range; records outside the range kept and never used to supersede; the tombstone horizon applied with `<=` only to surviving tombstones; offsets returned ascending with an entry for every partition, including empty ones; O(n); can explain memory limits, tombstone retention and what consumers observe.

## CFL-L1-05: Which log segments retention deletes

| | |
|---|---|
| **Template ID** | CFL-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Arrays and running totals / prefix deletion under time, size and offset limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer |
| **Generator** | CFL-L1-05.mjs |

**Business Scenario.** A partition's log is stored as a sequence of segment files; the newest is the active segment, still being written. Retention deletes whole segments from the oldest end, by age (`retention.ms`) and by size (`retention.bytes`, per partition), and a delete-records request can move the log start offset forward. Before a disk-capacity change, the team wants to predict, per partition, how many segments and bytes the next retention check frees and where each log will start afterwards. The rules below are this exercise's simplified model; check current docs for the product's actual behaviour.

**Problem Statement.** Implement `apply_retention(partitions, configs, now_ms)`. Each partition is `(topic, partition_id, log_start_offset, segments)`; `segments` is a list of `(base_offset, size_bytes, max_ts_ms)`, oldest first, and the last one is the active segment. `configs[topic] = (retention_ms, retention_bytes)`, where -1 means no limit. For each partition, in this order, never deleting the active segment:
1. **Time:** from the oldest, delete each segment with `now_ms − max_ts_ms > retention_ms`; stop at the first segment that does not qualify.
2. **Size:** let `total` be the size of all remaining segments, the active one included. From the oldest remaining, delete a segment while `total − its size >= retention_bytes`, subtracting it from `total`; stop at the first that does not qualify.
3. **Log start:** {{start_rule}}

Return `{(topic, partition_id): (deleted_segments, deleted_bytes, new_log_start_offset)}`. {{limits_rule}}

**Constraints.** Up to 80 partitions with 10 000 segments each. Every partition has at least one segment. Expected: O(s) per partition with one running total. Recomputing the remaining size after every deletion is O(s²) and too slow.

**Assumptions.** Segment sizes, timestamps, limits and the request are hypothetical. `max_ts_ms` is the largest record timestamp in the segment. A real broker may roll the active segment so that it can be deleted, and it schedules deletions asynchronously; neither is modelled.

**Clarifications.**
- Q: Does the active segment count toward `total`? | A: Yes. It holds bytes on disk; it just cannot be deleted.
- Q: Is a segment exactly `retention_ms` old deleted? | A: No. It must be strictly older: `now_ms − max_ts_ms > retention_ms`.
- Q: After deleting a segment, can the rest be exactly `retention_bytes`? | A: Yes. Deletion continues while what is left would still be at least `retention_bytes`.
- Q: A segment further back has expired but an older one has not. Is it deleted by time? | A: No. Time deletion stops at the first segment that has not expired; size retention may still remove it.
- Q: Do the limits apply to the topic as a whole? | A: No, to each partition separately.

**Hints.**
1. Deletion only ever removes a prefix of the segment list, so keep one index of the first remaining segment.
2. Compute the remaining size once after the time step, then subtract as you delete.
3. The log-start step compares the next segment's base offset, because a segment is wholly below the log start offset only when the following segment begins at or before it.

**Follow-ups.**
1. Producers set record timestamps, and one sends timestamps a week in the future. What does that do to time retention, and how would you protect against it?
2. A topic keeps 30 days but its consumers only read the last hour. With tiered storage, how would you split retention between local disk and object storage, and what changes in this calculation?
3. How would you use this function to forecast disk usage a week ahead per broker, given producer byte rates per partition?
4. The size limit is per partition. A topic doubles its partition count. What happens to its total disk use, and how would you explain that to its owner?

**Follow-up rules.**
- when: sum(, recompute, re-sum → ask: How many times does your code add up a partition's segment sizes? What does that cost for 10 000 segments with 7 500 deleted?
- when: pop(0), del segments[0] → ask: What does removing from the front of a Python list cost, and how can you avoid moving any data at all?
- when: max_ts_ms, timestamp → ask: A segment in the middle carries a timestamp from the future. Which segments does time retention delete, and which does size retention delete?
- when: total size, retention_bytes → ask: Does your total include the active segment? What would change if it did not?
- when: log_start_offset, deleterecords, delete records → ask: The log start offset is in the middle of a segment. Is that segment deleted, and what is the new log start offset?

**Evaluation Criteria.** Time, then size, then log start, in that order; the active segment never deleted but counted in the size total; strict `>` for age and inclusive `>=` for size; time deletion stops at the first unexpired segment; -1 handled as no limit for each limit (Hard+); the log-start rule by the next segment's base offset, with the new start the larger of the request and the first remaining base (Very Hard); one running total, O(s); can discuss timestamp skew, tiered storage and capacity forecasting.
