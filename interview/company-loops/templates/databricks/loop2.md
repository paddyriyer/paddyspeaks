# Databricks · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a data and AI
platform built around a lakehouse, Apache Spark and an open table format. These are
not questions from any company's interviews. Every workload, number, schema and
incident is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## DBX-L2-01: Salting hot join keys and balancing the tasks

| | |
|---|---|
| **Template ID** | DBX-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Greedy scheduling / skewed joins, salting, largest-first placement with a heap |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, ml-platform-engineer |
| **Generator** | DBX-L2-01.mjs |

**Business Scenario.** A nightly Spark job joins a large table of events with a smaller table on `{{key_name}}`. A shuffle sends every row of one key to one task, so a handful of very large keys keep a few tasks running for hours while the rest finish in minutes. A common remedy is salting: split a hot key's rows into several pieces with an extra salt column, copy the matching rows from the other side of the join to every salt, and join on the key and the salt together. Before the job starts, a planner reads row counts per key from table statistics, decides how many salts each key gets, and decides which task processes each piece.

**Problem Statement.** Implement `plan_tasks(key_rows, num_tasks, target_rows, max_salts=None, other_rows=None)`. `key_rows` maps each key to its number of rows on the large side, always at least 1.
1. **Salts.** A key with `r` rows gets `s = 1` piece when `r <= target_rows`, and `s = ceil(r / target_rows)` pieces when `r > target_rows`. {{salt_rule}}
2. **Shares.** The rows are split as evenly as possible. Salt `i`, counting from 0, gets `r // s` rows, plus one more row if `i < r % s`.
3. **Load.** A piece's load is its share of rows. {{other_rule}}
4. **Placement.** Take the pieces in order of load, largest first. Break ties by key, then by salt, both ascending. Put each piece on the task whose current load is smallest, and break a tie between tasks by the lowest task index.
5. **Result.** Return `(largest_load, tasks)`. `tasks` is a list of `num_tasks` lists, and list `t` holds the `(key, salt)` tuples placed on task `t`, in the order they were placed. A key that is not split appears as `(key, 0)`. With no keys, every task is empty and `largest_load` is 0.

**Constraints.** Up to 300 000 keys and 5 000 tasks. Row counts are integers below 10⁹, and `target_rows` is at least 1. The pieces must be placed in close to O(P log P) time for P pieces. Scanning every task for every piece is too slow at this size.

**Assumptions.** Row counts and sizes are hypothetical, and the statistics are taken as exact. A task's run time is proportional to its load, and all executors are identical. The salt itself is assigned to rows later, by the job, so only the counts matter here.

**Clarifications.**
- Q: Does the other side of the join change the number of salts? | A: No. Only the large side's row count decides `s`. The other side only adds to the load of each piece.
- Q: Is a key with exactly `target_rows` rows split? | A: No. It is split only when it has more rows than `target_rows`.
- Q: Is this the best possible schedule? | A: No. Largest first onto the least-loaded task is a greedy rule with a known worst case of 4/3 − 1/(3m) times the optimal makespan on m tasks. You must follow the rule exactly so that the answer is unique.
- Q: Does the order of keys in the dict matter? | A: No. The answer must not depend on it, which is why the tie rules exist.
- Q: Can there be more tasks than pieces? | A: Yes. The remaining tasks stay empty, as empty lists.

**Hints.**
1. Build every piece first, then sort once with a key that encodes all the tie rules: load descending, then key, then salt.
2. "The least-loaded task, lowest index on a tie" is the minimum of `(load, index)` pairs. A heap of those pairs gives it in O(log T).
3. With `other_rows`, a key split into `s` pieces carries its other-side rows `s` times. Add them to each piece's load before you sort.

**Follow-ups.**
1. The row counts come from statistics that can be 30% out of date. How would you make the plan robust, and what would you measure during the run to know it worked?
2. Spark's adaptive query execution can split skewed shuffle partitions at run time. When is a planner like this still worth having, and when would you leave skew to the engine?
3. For one hot key the other side is large too, so copying it to every salt is expensive. How would you choose the number of salts to minimise the largest task, and when would you broadcast the other side instead?
4. Half the executors are slower spot instances. How does the placement rule change, and what happens to the 4/3 guarantee?

**Follow-up rules.**
- when: min(loads), loads.index, scan every task → ask: How many operations does finding the least-loaded task take for 200 000 pieces on 5 000 tasks, and how would you bring that down?
- when: heapq, heap, priority queue → ask: What exactly is in each heap entry, and how does the entry make a tie between two tasks go to the lower index?
- when: random salt, random → ask: A random salt makes the split differ every time the task runs. What happens when a failed task is retried, and how would a deterministic salt avoid that?
- when: round robin, round-robin → ask: Round-robin placement ignores loads. Build a small case where it makes the largest task twice as large as the greedy plan does.
- when: broadcast → ask: Broadcasting the smaller side avoids the shuffle and the salting. What size decides it, and what fails when that side grows past it?
- when: math.ceil, float → ask: Does `math.ceil(r / target_rows)` stay exact for every integer row count? Write the integer-only form.

**Evaluation Criteria.** Correct number of salts at the boundary (`r == target_rows` is not split); remainder rows given to the lowest salts; `max_salts` applied after the ceiling; other-side rows added to every piece without changing `s`; one sort with the full tie rule; least-loaded placement with the lowest-index tie, using a heap; empty tasks kept in the result; integer arithmetic; a clear complexity argument; sensible answers on stale statistics, adaptive execution and broadcast joins.

## DBX-L2-02: Small-file compaction plan for a partitioned table

| | |
|---|---|
| **Template ID** | DBX-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Bin packing / first-fit decreasing with a segment tree, table maintenance |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |
| **Generator** | DBX-L2-02.mjs |

**Business Scenario.** Streaming writers and frequent small appends leave a lakehouse table, partitioned by `{{partition_col}}`, with thousands of small files in each partition. Every query opens each file, so reads slow down and the table's metadata grows. A maintenance job rewrites the small files into larger ones of about {{target_mb}} MB, much as an OPTIMIZE-style compaction does. Before it runs, a planner decides which files are combined into which output file, partition by partition, so that the job is predictable and its plan can be reviewed. In the samples, a file is small when it is under {{small_mb}} MB.

**Problem Statement.** Implement `plan_compaction(files, target_mb, small_mb, min_input_files=2, purge_pct=None)`. `files` is a list of `(path, partition, size_mb, deleted_mb)`, where `deleted_mb` is the size of rows that are marked deleted but still stored in the file (`0 <= deleted_mb < size_mb`).
1. **Candidates.** A file is a candidate if `size_mb < small_mb`. {{purge_rule}} A candidate weighs its live size, `size_mb - deleted_mb`, because only live rows are written out.
2. **Partitions.** Each partition is planned on its own, and an output file never mixes partitions. {{partition_rule}}
3. **Packing.** Within a partition, take the candidates by weight, largest first, and break ties by path, ascending. Put each one into the earliest-opened output whose total weight plus this file's weight is at most `target_mb`. If there is none, open a new output. This is first-fit decreasing.
4. **Lone files.** An output that ends up with a single file is dropped from the plan, because rewriting one small file gains nothing. It is kept if that file is a purge candidate, because the rewrite removes its deleted rows.
5. **Result.** Return a list of `(partition, output_mb, paths)`, where `output_mb` is the output's total weight and `paths` lists its files in the order they were placed. Order the list by partition, ascending, then by the order in which outputs were opened. Return `[]` when there is nothing to do.

**Constraints.** Up to 200 000 files per table, and up to 100 000 in one partition. Sizes are integer MB below `2 * target_mb`, `small_mb <= target_mb`, and every candidate's weight is at most `target_mb`. Close to O(n log n) is expected. A partition can have tens of thousands of outputs, so scanning the open outputs for every file is too slow.

**Assumptions.** File sizes, thresholds and counts are hypothetical. An output's size is the sum of its inputs' live sizes; compression and file footers are ignored. The job replaces each output's inputs atomically, so readers see either the old files or the new one.

**Clarifications.**
- Q: Is first-fit decreasing the best packing? | A: No. Optimal bin packing is NP-hard. First-fit decreasing never uses more than 11/9 of the optimal number of outputs plus a small constant, which is good enough for maintenance. You must follow it exactly so that the plan is unique.
- Q: May an output be exactly `target_mb`? | A: Yes. The limit is "at most".
- Q: Can two partitions share an output file? | A: No. An output file belongs to exactly one partition.
- Q: What if every candidate in a partition ends up alone? | A: Then that partition contributes nothing to the plan.
- Q: A small file has some deleted rows. Does it count at its full size? | A: No. Every candidate weighs its live size.

**Hints.**
1. Group the candidates by partition and sort each group once by `(-weight, path)`.
2. You need the leftmost output whose free space is at least `w`. A max segment tree over the outputs' free space finds it in O(log n): go left whenever the left child has enough room.
3. Give outputs that are not opened yet full room in the tree. The leftmost of them is exactly the next output to open, so "no output fits" needs no special case.

**Follow-ups.**
1. Streaming writers keep appending to the newest partition while compaction runs. How do you avoid conflicting with them, and which partitions would you leave out?
2. Readers would also gain from rows clustered by a frequently filtered column. How would the plan change if outputs were also sorted by that column, and what does it cost?
3. The job fails halfway through a partition. What does the table look like, and how do you resume without rewriting the outputs that already committed?
4. The nightly budget allows rewriting 2 TB, and there are 20 TB of candidates. Which outputs would you choose first, and how would you measure the benefit afterwards?

**Follow-up rules.**
- when: best fit, tightest → ask: Best fit is a valid heuristic, but this plan is first fit. Where do the two differ for files of 74, 58, 56 and 13 MB with a target of 128 MB?
- when: bisect, sortedlist, sorted list → ask: A sorted list of free space finds the tightest output, not the earliest one. How would you keep first-fit order with that structure?
- when: segment tree → ask: How do you find the leftmost output with enough room, and what do outputs that are not opened yet hold in your tree?
- when: for each output, scan the outputs, linear scan → ask: How many outputs can one partition reach here, and what does a scan cost over the whole partition?
- when: concurrent, conflict, transaction log → ask: A writer appends to the partition while your rewrite runs. What does the table's commit protocol check, and which of the two commits fails?

**Evaluation Criteria.** Candidate rule with a strict `< small_mb` boundary; live size as the weight; partitions planned independently and listed in order; first fit, not best fit, with ties by path; the at-most boundary on `target_mb`; lone outputs dropped unless they purge deleted rows; `min_input_files` applied to all candidates; a segment tree (or another structure) that keeps first-fit order in O(log n); a clear complexity argument; credible answers on concurrent writers, clustering, resumption and a rewrite budget.

## DBX-L2-03: Debug the upsert (MERGE) into a customers table

| | |
|---|---|
| **Template ID** | DBX-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Change data / MERGE semantics, source deduplication, null keys, stale changes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | DBX-L2-03.mjs |

**Business Scenario.** A customers table in a lakehouse is kept current from the billing system's change feed. Each micro-batch of changes is merged into the table: new customers are inserted, plan changes update the row and closed accounts are deleted. A SQL `MERGE` fails when several source rows match one target row, and SQL never matches a NULL key, so the pipeline deduplicates and filters each batch in code before applying it. The support team has raised five complaints. Customer 0, the oldest account, never changes and is reported as a null key. When two plan changes for one customer carry the same timestamp, the table sometimes keeps the earlier one. Rows with an empty plan appear for customers who were never in the table. A customer who upgraded was then deleted by an older close event that was replayed. And the weekly backfill merge has started to run for hours. The code below is the suspect.

**Problem Statement.** Fix `merge_upsert(target, changes)` so that it meets this specification. `target` is a list of rows `{"id", "plan", "updated_at"}` with unique ids, none of them None. `changes` is a list of `{"id", "op", "plan", "updated_at", "seq"}`, where `op` is `"upsert"` or `"delete"`, `plan` is None for a delete, and `seq` is the change's position in the feed (unique, larger means later). {{batch_rule}}
1. **Null keys.** A change whose `id` is None is never matched or applied. It is counted in `null_keys`. Every other id, including 0, is a real key.
2. **One change per key.** For each key, only the change with the greatest `(updated_at, seq)` counts. The other changes for that key are ignored and not counted anywhere.
3. **Stale changes.** If the key is in the table and the change's `updated_at` is earlier than the row's, the change is stale: it is counted in `stale` and nothing changes. This applies to deletes as well as upserts. An equal `updated_at` is not stale.
4. **Apply.** An upsert of an existing key sets `plan` and `updated_at` from the change (`updated`). An upsert of a missing key inserts the row (`inserted`). A delete of an existing key removes the row (`deleted`). A delete of a missing key does nothing and is not counted.
5. **Output.** `{"rows": [[id, plan, updated_at], ...], "inserted", "updated", "deleted", "stale", "null_keys"}`, with `rows` sorted by id.

**Constraints.** Keep the function's name, arguments and output format. Up to 100 000 rows and 100 000 changes per batch, processed in O((n + m) log(n + m)) time or better.

**Assumptions.** The table, plans, ids and timestamps are hypothetical and simplified. `updated_at` is an integer timestamp from the billing system. Changes may arrive in any order within a batch, because files are read in parallel.

**Clarifications.**
- Q: Is customer 0 a real customer? | A: Yes. Only None is a null key.
- Q: Two changes for one key have the same `updated_at`. Which wins? | A: The one with the larger `seq`, which was written to the feed later.
- Q: Does a delete need a timestamp check too? | A: Yes. An older delete must not remove a newer row.
- Q: What happens to a delete for a customer the table does not have? | A: Nothing. It is not an insert and it is not counted.
- Q: How many bugs are there? | A: Several, of different kinds, including one that only shows on a large batch. The checks point at each one.

**Hints.**
1. Read the null-key test aloud for the value 0.
2. Write down two changes for one key with the same `updated_at` and seq 4 then 7. Which one does the code keep?
3. Walk a delete through the code for a key that is not in the table, and then for a key whose row is newer than the delete.
4. Count how many rows the code looks at to find one match, and how many it moves when it removes one.

**Follow-ups.**
1. After a restart the same batch is merged twice. Is the result the same? Which counters change on the second run, and does anyone depend on them?
2. A delete arrives in an earlier batch than the insert it cancels. Under rule 4 the delete is lost and the insert wins. How would you keep tombstones, and for how long?
3. Write the same logic as one SQL `MERGE`: the deduplication, the matched clauses with their conditions, and the not-matched clause. Where do the null keys go?
4. Finance now wants every plan a customer has had, with dates (slowly changing dimension type 2). What changes in the merge?

**Follow-up rules.**
- when: is none, is not none → ask: Where else in a pipeline does a truthiness test drop a valid value such as 0, an empty string or False?
- when: row_number, qualify → ask: Your deduplication orders by `updated_at`. What makes the order total when two changes share it?
- when: dict, hash map, index → ask: Your index holds the whole table in memory. At 500 million rows, where would the merge run instead, and how would the engine find matching rows?
- when: tombstone → ask: How long do you keep a tombstone, and what happens to an insert that arrives after its tombstone has expired?
- when: idempotent, replay → ask: Merging the same batch twice leaves the same rows. Do the counters match too, and who reads them?

**Evaluation Criteria.** Finds and explains every bug with its symptom; `is None` for null keys, so 0 is a real key; deduplication by `(updated_at, seq)`; the stale check before both update and delete; no insert for a delete of a missing key; a hash index instead of a list scan and `list.remove`; minimal fixes that keep the output format; a test per bug; sound answers on replays, tombstones, SQL `MERGE` and history.

## DBX-L2-04: Incremental file ingestion with schema evolution and a rescued-data column

| | |
|---|---|
| **Template ID** | DBX-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / incremental file discovery, exactly-once loading, schema evolution |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "files_per_day": {"2": ["200,000", "1 million"], "3": ["20 million", "60 million"]},
  "sources": ["40", "300", "1,200"],
  "file_format": ["JSON", "CSV with a header row", "JSON and CSV"],
  "freshness": ["15 minutes", "1 hour"]
}
```

**Business Scenario.** Partner systems drop files into cloud object storage: about {{files_per_day}} new files a day from {{sources}} sources, as {{file_format}}. A bronze table on the lakehouse must receive every record of every file exactly once, within {{freshness}} of the file landing. Sources add fields without notice, change a field's type (an id that was a number arrives as a string), change the case of a field name, and send malformed records. Some lakehouse ingestion tools discover new files incrementally, infer and evolve a schema, and keep values that do not fit the schema in a rescued-data column instead of dropping them. This exercise assumes such a column; check current docs for any specific product's behaviour.

**Problem Statement.** Design the ingestion from object storage to the bronze table. Cover how new files are discovered (directory listing or storage event notifications) and how the pipeline remembers which files it has processed; how each file's records reach the table exactly once, including after a crash; the schema policy (new columns, type changes, case differences, nested fields) and who approves a change; what goes into the rescued-data column and how it is used; malformed records; reprocessing one source's history; small files; and what you monitor.

**Constraints.** No file may be skipped or loaded twice. A new field from one source must not stop ingestion for the other sources for more than a few minutes. No value may be silently dropped. Reprocessing one source's last 30 days must not duplicate records. A source occasionally overwrites a file at the same path with corrected content. Some files arrive days late, with old dates in their paths.

**Assumptions.** All volumes, source counts and latencies are hypothetical. Files are immutable once written, except for the overwrites described above. Each record carries a source id; most carry an event time. You may use common building blocks: object storage notifications and queues, a stream processor with checkpoints, and a table format with atomic commits.

**Clarifications.**
- Q: Is listing the bucket good enough? | A: At {{files_per_day}} files a day, listing a large prefix gets slower every day. You decide, and you explain what you use for backfills and for gaps.
- Q: What does "exactly once" mean when a file is overwritten? | A: The corrected content must replace the earlier load of that file, not add to it.
- Q: Can a field's type change permanently? | A: Yes. Some changes are mistakes that will be reverted, and some are deliberate. The pipeline cannot tell which on its own.
- Q: Who reads the bronze table? | A: Silver pipelines, which need a stable schema, and engineers investigating a source, who need every original value.
- Q: Is the rescued-data column one column per table? | A: Yes, a single semi-structured column holding the fields and values that did not fit, with enough context to trace them back to the file.

**Hints.**
1. Separate discovery from loading. Whatever discovers files must hand the loader a durable list that it can replay after a crash.
2. Record a file's identity as more than its path: path plus size, modification time or an etag tells an overwrite from a replay.
3. Decide per kind of change: a new column can be added automatically, a type change goes to the rescued-data column until someone decides, and a case difference is a rule you state once.

**Follow-ups.**
1. A source changes `amount` from a number to a string for two days, then back. Walk through what the bronze table holds, what silver sees, and how you repair it afterwards.
2. The storage notification service drops events for an hour. How do you find and load the files you never heard about?
3. A source re-sends 30 days of corrected files under the same paths. How do you replace the old records without duplicating them, and what do downstream tables see?
4. One source sends a 40 GB file while the others send 5 MB files. What happens to {{freshness}} for everyone else, and what would you change?
5. A compliance request requires removing one customer's records from bronze. Where are they, including inside the rescued-data column?

**Follow-up rules.**
- when: list the bucket, directory listing, list files → ask: How long does listing take when the prefix holds a year of files, and how do you avoid listing it all on every run?
- when: notification, queue, event grid, sqs → ask: Notifications can be delayed, duplicated or lost. What do you do with each, and what reconciles the gaps?
- when: mergeschema, merge schema, schema evolution → ask: Automatic evolution adds a column the moment a source sends it. What happens when a source sends a typo for an existing field?
- when: rescued, _rescued_data → ask: Who looks at the rescued-data column, how often, and what turns a value in it back into a proper column?
- when: drop malformed, dropmalformed, skip bad records → ask: Which records would you lose, and how would you know how many?

**Production Reality Check.**
- One of the {{sources}} sources renames `customer_id` to `customerId` on a Friday evening; by Monday a third of its records have a null `customer_id` in silver and the new field sits in the rescued-data column.
- The storage notifications are delayed by 90 minutes during a cloud provider incident, so the {{freshness}} target is missed for every source at once, and then a burst of a quarter of a day's files arrives together.
- A source overwrites 2 000 files with corrected content; the next morning the silver totals for those days are exactly double.

**Evaluation Criteria.** Incremental discovery with a durable record of processed files and a reconciliation listing for gaps; exactly-once loading through a checkpoint and an atomic table commit; file identity that tells an overwrite from a replay, with replacement of the earlier load; an explicit schema policy per kind of change with an approval path; a rescued-data column that keeps every unfit value with its source context; counted, never silent, handling of malformed records; isolation so one source cannot stall the others; reprocessing without duplicates; monitoring of lag, rescued volume and schema changes; a plan for each incident.

## DBX-L2-05: Streaming aggregation with watermarks and bounded state

| | |
|---|---|
| **Template ID** | DBX-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Streaming / event time, watermarks, state size, late data, restarts |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "events_per_sec": {"2": ["50,000", "200,000"], "3": ["2 million", "5 million"]},
  "window": ["1-minute tumbling windows", "5-minute windows that slide every minute", "session windows that close after 30 minutes of inactivity"],
  "lateness": ["10 minutes", "2 hours", "1 day"],
  "keys": ["20,000 workspaces", "5 million devices", "300 million users"]
}
```

**Business Scenario.** A product-telemetry stream carries about {{events_per_sec}} events a second from client applications. A dashboard and an alerting job need counts and distinct users per key, over {{window}}, for {{keys}}. Mobile and desktop clients buffer events while offline, so events can arrive up to {{lateness}} after they happened, and occasionally later. The aggregation runs on a stream processor with checkpointed state, such as Spark Structured Streaming, and writes its results to a lakehouse table.

**Problem Statement.** Design the streaming aggregation. Cover event time against processing time; the watermark you choose and what it does to latency, completeness and state size; when a window's result is emitted and whether it can change afterwards; what happens to events that arrive after the watermark; how big the state gets and how you bound it; exact or approximate distinct counts; restarts, checkpoints and changes to the query; an exactly-once write to the results table; skew from very large keys; and how a backfill fits with the live stream.

**Constraints.** The dashboard needs a first result within a few minutes of a window closing. Alerts must not fire twice for the same window. State must fit the cluster's memory and disk with headroom, and checkpoints must finish well within the trigger interval. Finance-grade daily totals are produced by a separate batch job, but they must agree with the stream within a documented tolerance.

**Assumptions.** All rates, key counts and lateness figures are hypothetical. Each event has an event id, a key, a user id and an event time set by the client. Client clocks can be wrong. The input is a partitioned log that keeps seven days of data.

**Clarifications.**
- Q: How does the watermark move? | A: Assume the common rule: the largest event time seen so far, minus the delay you configure. State for windows that end before the watermark can be dropped.
- Q: Can a result change after it was shown? | A: You decide, and the dashboard and the alerting job may need different answers.
- Q: Are events ever duplicated? | A: Yes. Clients retry, so the same event id can arrive twice, minutes apart.
- Q: Do distinct users have to be exact? | A: On the dashboard, within 2%. In the daily batch totals, exact.
- Q: What happens to an event older than {{lateness}}? | A: It must not change the stream's results, but it must not disappear either.

**Hints.**
1. A longer watermark delay buys completeness with latency and state. Write the state size as keys × open windows × bytes per window before you choose it.
2. Separate the two consumers: alerts want one final answer per window, and the dashboard can take early results that are corrected later.
3. Make the sink idempotent: a batch that is written twice after a restart must leave the table unchanged.

**Follow-ups.**
1. A client release ships with its clock a year in the future. What does that do to your watermark and to every on-time event after it, and how do you guard against it?
2. You must add a new grouping column to the aggregation. Can the job restart from its checkpoint, and if not, how do you switch over without a gap or double counting?
3. State grows by 5% a day and checkpoints now take longer than the trigger interval. Where does the state come from, and what do you change?
4. One key produces 30% of all events. What happens to the task that owns it, and what would you change?
5. The daily batch total and the stream disagree by 4% for one day. How do you find out whether the stream or the batch is wrong?

**Follow-up rules.**
- when: processing time, arrival time, ingestion time → ask: A client comes back online after six hours and sends its buffer. Which window do those events land in with your choice, and what does the dashboard show?
- when: complete mode, output mode complete → ask: Complete mode rewrites the whole result every trigger. How big is that result for {{keys}}, and how long does each trigger take?
- when: hyperloglog, hll, approx_count_distinct, sketch → ask: Can two windows' sketches be merged into a daily figure, and what error does the 2% target allow?
- when: dropduplicates, dedup, deduplicate → ask: How long must you remember an event id to catch a retry, and what does that add to the state?
- when: foreachbatch, batch id, idempotent → ask: After a crash the same micro-batch is written again. What key makes the second write a no-op?

**Production Reality Check.**
- A client build with a clock set a year ahead sends a few hundred events; the maximum event time jumps, the watermark moves past every open window, and every on-time event after that is treated as late.
- After a deploy adds a grouping column, the job refuses to restart from its checkpoint; the dashboard has had no data for 40 minutes and the input log keeps only seven days.
- At {{events_per_sec}} events a second with {{lateness}} of allowed lateness, state reaches the cluster's disk limit during a holiday traffic peak.

**Evaluation Criteria.** Event-time windows with a watermark whose delay is justified against {{lateness}} and sized in state; a clear emission policy per consumer (final for alerts, corrected early results for the dashboard); late events beyond the watermark kept in a side table and reconciled by batch; bounded state through watermarks, deduplication windows and state TTL; approximate distinct counts with mergeable sketches where the target allows; an idempotent sink keyed by batch; a plan for query changes that cannot reuse the checkpoint; skew handling for very large keys; guards against clock skew; a plan for each incident.
