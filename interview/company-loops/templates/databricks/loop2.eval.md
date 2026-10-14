# Databricks · Loop 2 — evaluator notes (hidden from candidates)

## DBX-L2-01

**Reference solution**

```python reference
import heapq


def plan_tasks(key_rows, num_tasks, target_rows, max_salts=None, other_rows=None):
    other_rows = other_rows or {}
    pieces = []
    for key, rows in key_rows.items():
        s = 1 if rows <= target_rows else -(-rows // target_rows)   # integer ceiling
        if max_salts is not None and s > max_salts:
            s = max_salts
        base, extra = divmod(rows, s)
        copy = other_rows.get(key, 0)                 # the other side goes to every salt
        for salt in range(s):
            load = base + (1 if salt < extra else 0) + copy
            pieces.append((-load, key, salt))         # largest first, then key, then salt
    pieces.sort()
    heap = [(0, t) for t in range(num_tasks)]          # a sorted list is already a heap
    tasks = [[] for _ in range(num_tasks)]
    for neg, key, salt in pieces:
        load, t = heap[0]                              # least loaded, lowest index on a tie
        tasks[t].append((key, salt))
        heapq.heapreplace(heap, (load - neg, t))
    return (max(load for load, _ in heap), tasks)
```

**Explanation.** Build every piece first. The number of salts is the integer ceiling `-(-r // t)` once `r` exceeds `target_rows`, capped by `max_salts`. `divmod` gives the even split, with the remainder going to the lowest salts. With `other_rows`, each piece also carries the key's other-side rows, because salting copies that side to every salt. That copy is the real cost of salting a join, and it does not change `s`. One sort on `(-load, key, salt)` encodes every tie rule. Placement is longest-processing-time-first (LPT). The least-loaded task with the lowest index is the minimum of `(load, task)` pairs, so a heap gives it in O(log T), and `heapreplace` pops and pushes in one step. Tasks that receive nothing stay as empty lists. With no keys the heap still holds zeros, so the largest load is 0.

**Complexity.** O(K + P log P + P log T) for K keys, P pieces and T tasks. The timing test (up to 150 000 keys, about as many pieces, and 5 000 tasks) runs in about a second in CPython. Scanning all tasks for every piece, for example with `loads.index(min(loads))`, is O(P · T): about 7 × 10⁸ comparisons, which takes 15 s or more even though `min` runs in C.

**Dialect notes.** In Java or Scala use a `PriorityQueue` of `long[]{load, task}` with a comparator on both fields, and `Math.floorDiv` or `(r + t - 1) / t` for the ceiling. Watch for `int` overflow on loads. In Spark itself, salting is written as an extra column, for example `pmod(hash(other_col), s)` or a random integer in `[0, s)` on the large side, with the other side exploded into `s` copies through `explode(sequence(0, s - 1))`. Adaptive query execution can split skewed shuffle partitions at run time. Not executed here.

**Edge cases built into the tests.** Exactly `target_rows` (not split); one row over (two pieces, salt 0 gets the extra row); an uneven split over four salts; equal loads placed in key then salt order; task ties to the lowest index; more tasks than pieces; no keys; input order that differs from load order; (Hard) `max_salts` capping a hot key so that its pieces exceed `target_rows`, and `max_salts = 1`; (Very Hard) the other side copied to every salt, a copy that changes the placement order without changing `s`, and other-side keys with no rows on the large side.

**Common mistakes.** `r // target_rows` (one salt too few) or `ceil` computed on floats; splitting a key with exactly `target_rows` rows; giving the remainder to the last salt; adding the other side once per key instead of once per piece, or letting it change `s`; sorting by load only, so ties depend on dict order; a heap of loads without the task index, which loses the tie rule and the task identity; returning only non-empty tasks; a linear scan for the least-loaded task.

**Follow-up guidance.** (1) Plan with a safety margin, for example by taking an upper percentile of recent runs instead of the latest statistics. At run time, measure task duration and shuffle read per task, and the ratio of the largest task to the median. (2) Adaptive execution reacts after the shuffle, at the cost of the shuffle having happened. A planner is still useful when the skew is known and stable, when the other side must be replicated in a controlled way, or when the engine's thresholds do not trigger. Otherwise, prefer the engine: it adapts to the real sizes. (3) The largest piece of a key with `s` salts is about `r/s + o`, where `o` is the other side's rows. More salts shrink the first term and multiply the copied total `s · o`. Choose `s` by minimising the estimated makespan, or broadcast the other side when it is below the broadcast threshold, because then there is no shuffle of the large side at all. (4) Use speed-weighted completion time: place each piece on the task that would finish it earliest. The 4/3 bound for identical machines no longer holds; for machines of different speeds the greedy rule has weaker guarantees.

**Rubric anchors.** 2: a correct split but a linear scan per piece, or tie rules missing so the output depends on dict order. 3: all tests pass with a sort and a heap, and the complexity is stated. 4: also explains why the copy of the other side is the true cost of salting, compares salting with broadcast and adaptive execution, and handles stale statistics with run-time measurement.

**Strong signals.** Asks whether the other side's rows count; uses an integer ceiling without being told; notices that `max_salts` can leave pieces above `target_rows`. **Red flags.** "Just add more partitions" (a single key still lands in one partition); random salts with no thought about task retries.

## DBX-L2-02

**Reference solution**

```python reference
def plan_compaction(files, target_mb, small_mb, min_input_files=2, purge_pct=None):
    by_part = {}
    for path, part, size, deleted in files:
        purge = purge_pct is not None and deleted * 100 >= purge_pct * size
        if size < small_mb or purge:
            by_part.setdefault(part, []).append((deleted - size, path, purge))  # -live, path
    plan = []
    for part in sorted(by_part):
        cands = by_part[part]
        if len(cands) < min_input_files:
            continue
        cands.sort()
        width = 1
        while width < len(cands):
            width *= 2
        # max segment tree of free space; outputs not opened yet have full room,
        # so the leftmost leaf with room is either an open output or the next new one
        room = [target_mb] * (2 * width)
        outputs = []                                   # [total, paths, has_purge]
        for neg, path, purge in cands:
            w = -neg
            i = 1
            while i < width:
                i = 2 * i if room[2 * i] >= w else 2 * i + 1
            b = i - width
            if b == len(outputs):
                outputs.append([0, [], False])
            out = outputs[b]
            out[0] += w
            out[1].append(path)
            out[2] = out[2] or purge
            room[i] = target_mb - out[0]
            i //= 2
            while i:
                room[i] = room[2 * i] if room[2 * i] >= room[2 * i + 1] else room[2 * i + 1]
                i //= 2
        for total, paths, purge in outputs:
            if len(paths) > 1 or purge:
                plan.append((part, total, paths))
    return plan
```

**Explanation.** Select candidates (small, or purge candidates when `purge_pct` is set), weigh each by its live size, and group them by partition. Partitions are processed in sorted order, and a partition with fewer than `min_input_files` candidates is skipped. Inside a partition, one sort on `(-live, path)` gives the first-fit decreasing order with the path tie rule. First fit needs "the leftmost output with free space ≥ w". A max segment tree over the outputs' free space answers that by descending from the root, going left whenever the left child's maximum is enough. Leaves for outputs not opened yet start at `target_mb`. Every candidate weighs at most `target_mb`, so the search always succeeds. If it lands on the first unopened leaf, that output opens. After placing a file, update the leaf and its ancestors. Finally, drop outputs with a single file unless that file is a purge candidate.

**Complexity.** O(n log n) for the sorts plus O(n log n) for the tree walks. The timing test (up to 100 000 files in two partitions, about 18 000 outputs) runs in about a second in CPython. A linear scan over the open outputs for every file is O(n · outputs): 15 to 20 s for the same input, and about 50 s for 100 000 files in one partition.

**Dialect notes.** In Java or C++ the same segment tree uses an `int[]`. A `TreeMap` keyed by free space gives best fit, not first fit. Table formats provide compaction as a maintenance command (OPTIMIZE-style rewrites, `rewrite_data_files` in Iceberg), and target file size is a table or session setting; check current docs. The plan computed here is the "which files go together" step those commands perform internally. Not executed here.

**Edge cases built into the tests.** A file of exactly `small_mb` (not a candidate); two files that fill an output exactly; one that would overflow by 1 MB; first fit against best fit (74, 58, 56, 13 MB into 128); a lone leftover file dropped; equal sizes placed by path; two partitions interleaved in the input; no candidates; (Hard) a partition below `min_input_files`, and one exactly at it where a file still ends up alone; (Very Hard) a large file with many deleted rows rewritten on its own, exactly `purge_pct`, just under it, live sizes that fit where full sizes would not, and `min_input_files` counting purge candidates.

**Common mistakes.** `<=` for the small threshold; packing by full size instead of live size; best fit (a sorted list with `bisect`) instead of first fit; sorting by size without the path tie; mixing partitions; keeping lone outputs, or dropping lone purge outputs; checking `min_input_files` after dropping lone outputs instead of on candidates; float percentages instead of the integer comparison; scanning all outputs for every file.

**Follow-up guidance.** (1) The table's commit protocol detects conflicts. A rewrite that removes files a concurrent writer also touched fails and retries. Appends usually do not conflict with a rewrite of other files, but the safest plan skips the partition still being written, for example the current hour or day, and compacts it once it is sealed. (2) Sorting or clustering outputs by a column makes data skipping effective. It costs a sort or a space-filling-curve ordering per partition and often a full rewrite, not only small files. Weigh it against how often queries filter on that column. (3) Each output commits atomically, so the table holds the outputs that committed plus the original files for the rest. Re-planning from the table's current state skips finished work naturally, because committed outputs are no longer small. (4) Rank outputs by expected benefit per rewritten byte: files removed, reads saved on partitions that are queried often, and deleted rows purged. Measure files per partition, scan time on representative queries, and the bytes rewritten.

**Rubric anchors.** 2: correct grouping and FFD on small inputs, but a linear scan, or boundary or tie rules wrong. 3: all tests pass with a structure that keeps first-fit order in O(log n). 4: also explains why first fit and best fit differ, handles concurrent writers through the commit protocol, and prioritises a limited rewrite budget with a measurable benefit.

**Strong signals.** Asks whether outputs may mix partitions; recognises that unopened outputs can live in the tree with full room; separates the lone-file rule from the purge rule. **Red flags.** "Rewrite the whole partition every night"; a plan that ignores rows marked deleted.

## DBX-L2-03

**Reference solution** (the fixed merge)

```python reference
def merge_upsert(target, changes):
    rows = {r["id"]: dict(r) for r in target}    # an index, not a list scan
    stats = {"inserted": 0, "updated": 0, "deleted": 0, "stale": 0, "null_keys": 0}

    # 1. one change per key: the latest wins
    latest = {}
    for ch in changes:
        if ch["id"] is None:                      # 0 is a real key
            stats["null_keys"] += 1
            continue
        cur = latest.get(ch["id"])
        if cur is None or (ch["updated_at"], ch["seq"]) > (cur["updated_at"], cur["seq"]):
            latest[ch["id"]] = ch

    # 2. apply the changes
    for key, ch in latest.items():
        match = rows.get(key)
        if match is None:
            if ch["op"] == "upsert":              # a delete for a missing key does nothing
                rows[key] = {"id": key, "plan": ch["plan"], "updated_at": ch["updated_at"]}
                stats["inserted"] += 1
        elif ch["updated_at"] < match["updated_at"]:   # stale, for deletes too
            stats["stale"] += 1
        elif ch["op"] == "delete":
            del rows[key]
            stats["deleted"] += 1
        else:
            match["plan"] = ch["plan"]
            match["updated_at"] = ch["updated_at"]
            stats["updated"] += 1

    out = sorted(rows.values(), key=lambda r: r["id"])
    return {"rows": [[r["id"], r["plan"], r["updated_at"]] for r in out], **stats}
```

**The planted bugs, their symptoms and their fixes.**
1. **Truthiness test for null keys.** `if not ch["id"]` is also true for id 0, so customer 0's changes are skipped and counted as null keys. Symptom: customer 0 never changes and appears in the null-key count. Fix: `if ch["id"] is None`.
2. **Deduplication ignores `seq` on a tie.** `ch["updated_at"] > cur["updated_at"]` keeps the first change seen when two share a timestamp, and the input order is arbitrary. Symptom: on a timestamp tie the table sometimes keeps the earlier change. Fix: compare `(updated_at, seq)`.
3. **A delete for a missing key inserts a row.** The not-matched branch inserts whatever the change is, so a delete creates a row with plan None. Symptom: rows with an empty plan for customers who were never in the table. Fix: insert only for an upsert.
4. **A late delete skips the stale check.** The delete branch comes before the timestamp comparison. Symptom: an older, replayed close event deletes a customer who has since upgraded. Fix: check staleness first, for both operations.
5. **Quadratic matching.** Every change scans the list of rows with `next(...)`, and `rows.remove` shifts the list. Symptom: a backfill of 80 000 changes runs for hours, while each small batch looks fine. Fix: a dict keyed by id, sorted once at the end.

Each bug has its own check: key 0, a timestamp tie with seq 4 before seq 7, a delete for an unknown key (and an insert followed by a delete in one batch), a delete older than its row, and the timing test. The other checks pass on the original code, so the candidate gets a separate signal for each bug.

**Explanation.** A merge is a join of a deduplicated source to the target, followed by one action per matched or unmatched key. The source must have at most one row per key, chosen by a total order (`updated_at`, then `seq`). Null keys never match in SQL, so they are counted and set aside, not treated as a value. Out-of-order delivery is handled by comparing the change's timestamp with the row's for every action, deletes included.

**Complexity.** O(n + m) to build the index and deduplicate, plus O(n log n) for the final sort. The timing test merges 80 000 changes into 80 000 rows in under a second. The original code takes about 30 s at 20 000 rows and 20 000 changes, and grows quadratically from there.

**Dialect notes.** As SQL, deduplicate with `ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, seq DESC) = 1` (or `QUALIFY` where supported) and `WHERE id IS NOT NULL`, then `MERGE INTO customers t USING dedup s ON t.id = s.id WHEN MATCHED AND s.updated_at >= t.updated_at AND s.op = 'delete' THEN DELETE WHEN MATCHED AND s.updated_at >= t.updated_at THEN UPDATE SET plan = s.plan, updated_at = s.updated_at WHEN NOT MATCHED AND s.op = 'upsert' THEN INSERT …`. Table formats such as Delta Lake fail a MERGE when several source rows match one target row, which is why the deduplication must come first. Counting stale rows needs a separate query, or the merge's operation metrics where the engine reports them. Not executed here.

**Edge cases built into the tests.** Key 0; null keys, upsert and delete; a timestamp tie broken by seq; the latest change listed first; a stale delete; a stale upsert; a delete for an unknown key; an insert then a delete in one batch; an equal timestamp (applied); a newer delete.

**Common mistakes.** Fixing the null test with `if ch["id"] == None` but leaving another truthiness check elsewhere; breaking ties by list position; fixing the stale check for deletes by duplicating it and getting the boundary wrong (`<=`), which makes equal timestamps stale; counting ignored deletes as stale; rewriting the function instead of fixing it; replacing the list scan with a dict but forgetting to sort the output.

**Follow-up guidance.** (1) The rows are the same on a second run, because every change is now stale-or-equal and reapplies to the same values; the counters differ (updates are counted again). Anyone who sums those counters needs a batch id to make the metrics idempotent. (2) Keep deletes as tombstone rows, a soft-delete flag with the delete's timestamp, so that a later-arriving older insert is recognised as stale. Expire tombstones after the feed's maximum lateness, and say what happens after that. (3) See the dialect notes: deduplicate with a window function and a null filter, then conditional matched clauses and an insert only for upserts. (4) Type 2 history adds `valid_from`, `valid_to` and `is_current`: an update closes the current row and inserts a new one. A late change must be inserted into the middle of the history, which adjusts its neighbours' validity ranges.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail, often the timing test. 3: all five fixed with minimal changes, each explained with its symptom. 4: also writes the SQL `MERGE` correctly, explains tombstones for out-of-order deletes, and separates idempotent rows from non-idempotent counters.

**Strong signals.** Reproduces each complaint with a two-row case before changing code; notices the performance bug from the shape of the code before running the large test. **Red flags.** "Customer ids start at 1 anyway"; removing the stale check because "events are in order".

## DBX-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Discovery.** Object storage event notifications feed a durable queue, so new files are found without listing. Because notifications can be delayed, duplicated or lost, a scheduled reconciliation lists recent prefixes (for example the last two days, by path or modification time) and compares them with the processed-file log. Backfills of old data use a bounded listing of named prefixes, never the whole bucket.
- **Processed-file log.** A table or checkpoint keyed by file identity: path plus etag (or size and modification time), with the source, the commit version of the load, the record count and its status. A notification for an identity already loaded is a no-op. The same path with a new etag is an overwrite.
- **Exactly once.** The loader takes a batch of files from the queue, parses them, and writes records plus a per-file entry in the processed log in one atomic table commit (or records the batch in the stream checkpoint, as incremental file sources do). After a crash, files whose batch did not commit are reprocessed, and those that did are skipped. Each record carries `_source_file`, `_file_etag`, `_ingested_at` and `_source_id`.
- **Overwrites.** A file overwritten with new content replaces its earlier records: delete where `_source_file` matches and `_file_etag` is the old one, then insert, in one commit (or a MERGE keyed on file and row number). Downstream sees a change in the table's change feed, not a duplicate.
- **Schema policy.** Columns are typed explicitly for known fields. A new field is added automatically as a nullable column (or kept in the rescued column until approved, for strict sources). A type change never alters the column: values that fail the cast go to the rescued-data column with the field name, the original value and the file path. A case difference in a field name is resolved by one stated rule (case-insensitive match with the original kept in rescued data). Nested structs evolve the same way at each level. Schema changes raise an event for the source owner, and promoting a field from rescued data is a reviewed change.
- **Malformed records.** Records that do not parse are written whole to a quarantine table with file, offset and error, and counted per source. Nothing is dropped.
- **Isolation.** Ingestion runs per source group (or per source for large ones) with its own checkpoint, so a schema stop or a 40 GB file in one source does not hold the others. Large files are split for parsing where the format allows it.
- **Small files.** Bronze appends are compacted regularly (an OPTIMIZE-style rewrite), outside the partition that is being written.
- **Monitoring.** Discovery lag (file landed → loaded), queue depth, reconciliation finds (files the notifications missed), rescued-data rows per source and field, quarantine counts, schema-change events, and record counts per file against what the source reports.

**Competing designs to accept.** Listing-based discovery with a high-water mark on modification time, if the candidate addresses listing cost and late files; one stream per source; landing raw files into a raw zone first and loading bronze from there; strict schemas with every unknown field rescued and nothing added automatically. Accept them when exactly-once, overwrites and the no-silent-loss rule are handled.

**Bottlenecks and failure modes.** Full listings that grow with history; notification gaps; checkpoints that track paths only, so overwrites are missed or double-loaded; automatic schema evolution adding a typo as a new column; type changes altering a column and breaking silver; one large file holding a shared stream; tiny files in bronze.

**Incident guidance.**
- *A source renames `customer_id` to `customerId`*: the new field lands in rescued data (or as a new column), so nothing is lost. Detect it from the rescued-volume alert per field and the null rate of `customer_id` in silver. Add a mapping for that source (`customerId` → `customer_id`) from the change date, backfill silver for those days from bronze and rescued data, and agree a schema contract with the source.
- *Notifications delayed by 90 minutes*: freshness is missed everywhere at once. Reconciliation listing of recent prefixes picks up files without waiting for the queue, and the burst is absorbed by scaling the loaders, with per-source limits so the largest sources do not starve the others. Duplicated notifications later are no-ops because identity is checked.
- *Overwritten files double the silver totals*: the loader treated the new etag as a new file and appended. Fix the identity logic to replace by path, delete the earlier records for those 2 000 files (they are traceable through `_source_file` and `_file_etag`), rerun silver for the affected days, and add a test that an overwrite keeps the record count stable.

**Follow-up guidance.** (1) Bronze holds the string values in rescued data for two days, with the column null; silver sees nulls (or flags them). Repair by re-casting the rescued values once the decision is made and re-deriving silver for those days. (2) The reconciliation listing compares recent prefixes with the processed log; files never loaded are queued. (3) Treat each file as an overwrite keyed by path and etag: replace its records atomically, and let downstream consume the change feed or recompute the affected dates. (4) Isolate large sources or files in their own stream, split files for parsing, and give small sources a separate pool so their freshness holds. (5) Records are found by customer key in typed columns, and in rescued data by searching the semi-structured column. Deletion must also reach older table versions (vacuum after the retention period) and any quarantine tables.

**Rubric anchors.** 2: a scheduled job that lists the bucket and appends everything; schema changes break the pipeline or drop fields. 3: incremental discovery, a processed-file log, atomic loads, a rescued-data column, an explicit schema policy, quarantine for malformed records. 4: also file identity that handles overwrites, reconciliation for notification gaps, per-source isolation, reprocessing without duplicates, and a convincing plan for each incident.

**Strong signals.** Asks how an overwrite can be told from a replay; keeps the source file and etag on every record. **Red flags.** "Use schema inference on every file"; dropping malformed records to keep the pipeline green.

## DBX-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Time.** Aggregate by event time. Clamp client times into a sane range: an event more than a few minutes in the future is assigned the arrival time (and flagged), so one bad clock cannot move the watermark.
- **Watermark.** Delay chosen from the observed lateness distribution: for example, cover 99.5% of events within the dashboard's latency budget, not the full {{lateness}}. State size ≈ keys with traffic × open windows per key × bytes per window state (counts plus a distinct sketch). For sliding windows, open windows per key = window length ÷ slide; for session windows, one open session per active key.
- **Emission.** Two outputs. The alerting stream uses append semantics: one final result per window once the watermark passes its end, so alerts never fire twice. The dashboard uses update semantics, or an early-firing table keyed by (key, window) with a version, and it is corrected when the window closes.
- **Late beyond the watermark.** Events older than the watermark are written to a late-events table instead of being dropped (filter them before the aggregation, by comparing event time with the current watermark or a conservative estimate of it). The daily batch job, which reads all events, produces the authoritative totals and the reconciliation report against the stream.
- **Deduplication.** Deduplicate by event id within a bounded window (the retry horizon, for example 15 minutes), with the watermark bounding that state.
- **Distinct users.** Mergeable sketches (HyperLogLog) per window. Their standard error at common precisions is around 1–2%, within the dashboard target, and windows merge into hours and days. The daily batch counts exactly.
- **State and checkpoints.** A disk-backed state store (RocksDB-style) for large state, state TTL through the watermark, incremental checkpoints, and trigger intervals sized so that a checkpoint completes well within one interval. Monitor state rows, state memory, checkpoint duration and watermark lag.
- **Sink.** Write each micro-batch with an idempotent operation: a MERGE keyed by (key, window) where the batch id is recorded, or the table format's transactional writes with an application id and batch version, so a replayed batch changes nothing.
- **Query changes.** Changes that alter the state schema (new grouping keys) cannot reuse the checkpoint. Run the new query from a new checkpoint, started from an input offset far enough back to fill its windows (within the log's seven days), in parallel with the old one. Switch readers when it has caught up, and backfill any window gap from the batch path.
- **Skew.** Pre-aggregate a very large key in two stages (salted partial aggregates, then a merge), or give it a dedicated partition.

**Competing designs to accept.** A single update-mode stream with the dashboard and alerts both reading a versioned results table (if alerts deduplicate by window); a lambda-style design where the stream is approximate and the batch is the truth; Flink-style allowed lateness with retractions. Accept them when the trade-off between latency, completeness and state is explicit.

**Bottlenecks and failure modes.** Watermark too generous (state explosion) or too tight (most events late); processing-time windows that put offline events in the wrong window; complete output mode at large key counts; deduplication with no time bound; a non-idempotent sink that double counts after a restart; clock skew moving the watermark; checkpoint incompatibility after a query change; a hot key on one task.

**Incident guidance.**
- *Clock set a year ahead*: the maximum event time jumps, the watermark leaps forward, and every window closes, so all later on-time events are late. Prevention: clamp future timestamps to the arrival time on input. Recovery: restart from the last checkpoint taken before the jump, with the clamp in place (the input log still holds the data), and reconcile the affected period from the batch path. Alert when the watermark moves faster than wall-clock time.
- *Checkpoint incompatible after adding a grouping column*: roll back the deploy so that the old query resumes from its checkpoint and the dashboard recovers, then run the new query from a fresh checkpoint started from an earlier offset, in parallel, and switch when it has caught up. The seven-day log bounds how far back it can start. Add a pre-deploy check that flags state-schema changes.
- *State reaches the disk limit at peak*: the state is open windows × keys at {{lateness}} of allowed lateness, plus deduplication state. Short term: add capacity or shorten the watermark delay, sending the extra late events to the late table. Longer term: size the delay from the lateness distribution, bound deduplication by time, and use sketches instead of exact distinct sets.

**Follow-up guidance.** (1) See the first incident: clamp, monitor watermark speed, and replay. (2) A state-schema change needs a new checkpoint. Run in parallel from an earlier offset, switch over, and reconcile the overlap by window. (3) Look at open windows (delay too long), deduplication state with no bound, distinct sets held exactly, and keys that never expire; fix with TTL, a shorter delay and sketches. Check that state cleanup actually runs. (4) The task holding the key falls behind and holds back the whole micro-batch; use two-stage aggregation with salting, or isolate the key. (5) Compare per-window counts between the stream and the batch; look at the late-events table, deduplication differences and time-zone boundaries. A difference concentrated in a few windows usually points to late data or a restart.

**Rubric anchors.** 2: processing-time windows, or a watermark chosen without considering state; late events dropped silently; complete mode for everything. 3: event-time windows, a justified watermark, append for alerts and updates for the dashboard, late events kept, an idempotent sink, bounded deduplication. 4: also sizes the state, handles clock skew and checkpoint-incompatible changes with a concrete switch-over, uses mergeable sketches within the error target, and reconciles with the batch totals.

**Strong signals.** Writes the state-size formula before choosing the delay; asks how alerts and the dashboard differ in what they need. **Red flags.** "Set the watermark to a day to be safe"; trusting client clocks without bounds.
