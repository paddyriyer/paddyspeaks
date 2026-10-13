# OpenAI · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an AI model
provider. Every workload, number and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## OAI-L2-01: Cost-optimal micro-batching for an inference server

| | |
|---|---|
| **Template ID** | OAI-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / sorting, exchange arguments, batching |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer |
| **Generator** | OAI-L2-01.mjs |

**Business Scenario.** An inference server groups queued requests into batches before running them on a GPU. Every request in a batch is padded to the longest sequence in that batch, so one long prompt makes the whole batch expensive, and every batch also pays a fixed launch overhead. The scheduler has a queue of requests and wants to know the cheapest way to batch all of them.

**Problem Statement.** Implement `min_batch_cost(lengths, max_batch, overhead, token_budget=None, shapes=None)`. `lengths` holds the sequence length of each queued request, in arrival order. Split the requests into batches of at most `max_batch` requests; any request may go in any batch. A batch of k requests whose longest sequence is m costs `m × k + overhead`. {{budget_rule}} {{shape_rule}} Return the minimum total cost of running every request exactly once.

**Constraints.** 0 ≤ len(lengths) ≤ 10 000; 1 ≤ length ≤ 4096; 1 ≤ max_batch ≤ 128; 0 ≤ overhead ≤ 10⁶. Every single request is runnable on its own. An O(n log n + n·B) solution, where B is `max_batch`, is expected.

**Assumptions.** The cost model is a hypothetical simplification: real attention cost is not linear in length, and real engines batch continuously. Lengths and overheads are invented. An empty queue costs 0.

**Clarifications.**
- Q: Do batches have to follow arrival order? | A: No. Any request may go in any batch; only the total cost matters.
- Q: Is the cost per batch the sum of lengths or the padded size? | A: The padded size: the longest length in the batch times the number of slots it occupies.
- Q: Can a batch be empty, or can a request run twice? | A: No. Every request runs exactly once, and a batch has at least one request.
- Q: Do I need to return the batches themselves? | A: Return only the cost. Being able to reconstruct the batches is a follow-up.
- Q: Is the budget check inclusive? | A: Yes. A batch whose padded tokens equal `token_budget` is allowed.

**Hints.**
1. Sort the lengths. Argue that some optimal answer only ever groups requests that are adjacent in sorted order.
2. Exchange argument: if a batch with maximum m holds a short request while a longer one (still ≤ m) sits in another batch, swapping them never raises either batch's maximum and keeps every batch size the same.
3. Let `dp[i]` be the cheapest cost for the i shortest requests. The last batch is `sorted[j:i]`, and its maximum is simply `sorted[i-1]`.
4. If padded size never shrinks as k grows, once one k breaks the budget every larger k does too, so you can stop the inner loop early.

**Follow-ups.**
1. Return the batches as well as the cost. What do you store, and how do you choose among equally cheap batchings?
2. `max_batch` grows to the size of the queue (10 000). The O(n·B) recurrence becomes quadratic. How can you speed it up? (The cost term `sorted[i-1] × (i − j)` is linear in j.)
3. Requests keep arriving, and each one has a latency deadline. How does the offline optimum change when you must decide now without knowing the rest of the queue?
4. Real attention cost grows faster than linearly with sequence length. Which parts of your argument still hold if the batch cost is `f(m) × k` for any increasing f?

**Follow-up rules.**
- when: greedy, fill each batch, largest first → ask: Give a small input where filling every batch to max_batch is not optimal, and say what your greedy misses.
- when: itertools, combinations, permutations, all partitions, brute force → ask: How many partitions does a queue of 30 requests have, and what property lets you avoid enumerating them?
- when: max(, max of slice, recompute max → ask: After sorting, what is the maximum of `sorted[j:i]`? What does recomputing it cost you overall?
- when: recursion, lru_cache, memo → ask: With 10 000 queued requests, what happens to Python's recursion depth, and how would you write it bottom-up?
- when: convex hull, monotone queue, li chao → ask: The batch size is capped at B, so old lines expire. How does your structure remove them, and why is that still amortised O(1)?

**Evaluation Criteria.** Sorts and justifies contiguity with an exchange argument; correct DP base case and transitions; uses the sorted order to get each batch's maximum in O(1); handles the budget (inclusive) and padded shapes; O(n log n + n·B) time and O(n) space; empty queue and single request handled; can discuss reconstruction and online batching.

## OAI-L2-02: Staged model rollout — earliest finish time

| | |
|---|---|
| **Template ID** | OAI-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / topological sort, longest path in a DAG, cycle detection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | OAI-L2-02.mjs |

**Business Scenario.** A new model version is rolled out in stages: weights are uploaded, evaluations gate the release, serving shards are updated, traffic is ramped and dashboards are switched. Some steps depend on others and the rest run in parallel. The release manager wants the earliest time the whole rollout can finish, and needs the plan rejected if someone has introduced a circular dependency.

**Problem Statement.** Implement `rollout_finish(durations, deps, with_path=False)`. `durations` maps each step to its duration in minutes. {{dep_rule}} A step with no dependencies starts at minute 0, and every step starts as early as its dependencies allow; any number of steps can run at once. {{return_rule}}

**Constraints.** Up to 50 000 steps and 200 000 dependencies. Durations and soak times are non-negative integers. Chains can be tens of thousands of steps long. O(V + E) time is expected.

**Assumptions.** Step names, durations and soak periods are invented. There is no limit on parallelism. An empty plan finishes at minute 0.

**Clarifications.**
- Q: What if the dependencies contain a cycle? | A: The rollout can never finish: return None. A step that depends on itself is a cycle.
- Q: Are there limits on how many steps run at once? | A: No. Only the dependencies constrain the schedule.
- Q: What is the finish time of the whole rollout? | A: The latest finish time of any step, including steps with no dependencies at all.
- Q: Can a step depend on several others? | A: Yes. It starts when the last of them allows it to.
- Q: Will the input be small enough for recursion? | A: No. Expect a chain of 30 000 steps; Python's default recursion limit is about 1 000.

**Hints.**
1. A step's earliest start is the maximum, over its dependencies, of that dependency's finish time (plus any soak). That is a longest-path problem, which is easy on a DAG and meaningless with a cycle.
2. Kahn's algorithm: count incoming edges, start from the steps with none, and release a step when its count reaches zero. If you process fewer steps than exist, there is a cycle.
3. Relax each edge once, in topological order: `start[b] = max(start[b], finish[a] + soak)`.
4. For the critical path, record for each step which successor (or predecessor) achieves the maximum, and apply the tie rule when two do.

**Follow-ups.**
1. Which steps have slack, and how much? Compute the latest start time of every step that does not delay the rollout.
2. Only 4 GPU pools can be updated at the same time. Does your algorithm still give the finish time? What kind of problem is it now?
3. The plan changes while the rollout is running: a step takes twice as long as planned. How do you recompute the finish time incrementally instead of from scratch?
4. The plan lives in a database and is edited by several teams. How would you reject a cyclic edit at write time, cheaply?

**Follow-up rules.**
- when: recursion, recursive, dfs( → ask: The input contains a 30 000-step chain. What does Python do, and how do you make the traversal iterative?
- when: bellman, relax all edges, repeat until → ask: How many passes does repeated relaxation need in the worst case, and what is its total cost at 200 000 edges?
- when: dijkstra, heap, priority queue → ask: Dijkstra finds shortest paths with non-negative weights. Why is it not the right tool for the longest path here, and what does a DAG give you instead?
- when: visited set, visited, seen → ask: A step reachable along two paths is visited twice. How do you tell a harmless revisit from a cycle?
- when: sort the names, sorted(, alphabetical → ask: Where exactly does alphabetical order enter your algorithm, and does it change the finish time?

**Evaluation Criteria.** Recognises a longest path in a DAG; Kahn's algorithm or an iterative DFS with three-state cycle detection; every edge relaxed once; handles isolated steps, an empty plan, self-dependencies and duplicate edges; no recursion-depth failure; O(V + E); at Very Hard, reconstructs the critical path with the stated tie rule.

## OAI-L2-03: Debug the hourly token usage rollup

| | |
|---|---|
| **Template ID** | OAI-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Debugging / deduplication, time bucketing, Python pitfalls |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, ml-platform-engineer |
| **Generator** | OAI-L2-03.mjs |

**Business Scenario.** A usage service turns raw API usage events into per-project hourly token totals that feed the usage dashboard. On {{day}}, projects {{projects}} reported that the dashboard disagrees with their own request logs: some hours are too high, some requests appear in the wrong hour, and the totals drift upwards the longer the service runs. You are handed the function below.

**Problem Statement.** The starter code is `hourly_tokens(events)`, and it has several bugs. Fix it so that it meets this specification. Each event is a dict with `request_id`, `project_id`, `attempt`, `ts_ms` (epoch milliseconds, UTC), `status`, `prompt_tokens` and `completion_tokens`. A request can be retried; each retry is a new event with a higher `attempt`, and events arrive in any order. (1) For each `request_id`, only the event with the highest `attempt` counts. (2) The request is billed only if that event's status is `"ok"`; other statuses (`"error"`, `"timeout"`, `"cancelled"`) bill nothing. (3) Its tokens (`prompt_tokens + completion_tokens`) go to the UTC hour containing `ts_ms`: the hour `[h, h + 1 hour)`, where an event exactly on the hour belongs to the hour that starts then. (4) Return `[(project_id, hour_start_epoch_seconds, tokens)]` sorted by project, then hour, with no rows for hours that bill nothing. (5) Each call depends only on its own input. Explain each bug you find.

**Constraints.** Up to 200 000 events per call; one pass plus a sort is expected. An exact duplicate delivery of the same attempt can occur; `(request_id, attempt)` otherwise identifies one event.

**Assumptions.** The event shape and every value are hypothetical. Token counts are non-negative integers. All timestamps are UTC; there is no local time anywhere in the specification.

**Clarifications.**
- Q: If attempt 1 succeeded and attempt 2 failed, is anything billed? | A: No. The highest attempt decides; attempt 2 failed, so the request bills nothing.
- Q: Which events count as billable? | A: Only status "ok" on the request's latest attempt.
- Q: Which hour does an event at exactly 10:00:00.000 belong to? | A: The 10:00 hour. Hours are half-open, [h, h + 1 hour).
- Q: Is the function called more than once in the same process? | A: Yes, many times; it runs inside a long-lived service.
- Q: Can the same attempt be delivered twice? | A: Yes, as an exact duplicate. Count it once.

**Hints.**
1. Read the deduplication loop and ask: when two events share a request_id, which one survives, and does that depend on arrival order?
2. Should the status filter run before deduplication or after it? Try a request whose latest attempt failed.
3. Work out the bucket for `ts_ms = 10 × 3 600 000` by hand.
4. Look at the function's signature. What is shared between calls?

**Follow-ups.**
1. Write the smallest set of unit tests that would have caught every one of these bugs before they shipped.
2. Events now arrive as a stream, and an attempt can show up hours after the request. How do you keep the hourly totals correct without holding every event in memory?
3. The dashboard must show the project's local time zone. Where do you convert, and what happens to hours on days when clocks change?
4. Finance wants these totals to reconcile with billing to the token. Which of these bugs would also have broken billing, and how would a reconciliation job have detected each one?

**Follow-up rules.**
- when: last one wins, overwrite, latest[rid] = e → ask: Events arrive in any order. What does "last seen wins" do when attempt 3 arrives before attempt 2?
- when: != "ok", == "ok", status filter → ask: Does your status check run before or after you pick the latest attempt, and which test case tells the two apart?
- when: floor, // 3_600_000, // hour_ms → ask: An event at exactly midnight UTC: which day and hour does your code give it, and which does the old code give it?
- when: totals=None, mutable default, default argument → ask: Why does this bug only appear in a long-running service and never in a unit test that calls the function once?
- when: datetime, fromtimestamp, strftime → ask: Which time zone does that call use when you do not pass one, and would your tests catch it on a machine set to UTC?

**Evaluation Criteria.** Finds and explains all five bugs (first-seen deduplication, incomplete status filter, filtering before deduplication, the hour-boundary off-by-one, the mutable default argument); fixes them without new bugs; keeps a single pass; handles out-of-order attempts and exact duplicates; proposes tests that would have caught each bug.

## OAI-L2-04: Exactly-once usage metering from inference events to billing

| | |
|---|---|
| **Template ID** | OAI-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Streaming pipelines / exactly-once, idempotent sinks, reconciliation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer |

```params
{
  "peak_rate": {"1": ["20 000", "50 000"], "2": ["200 000", "400 000"], "3": ["1 million", "2 million"]},
  "partitions": [64, 256, 512],
  "lateness": ["6 hours", "24 hours", "3 days"],
  "retry_share": ["1%", "5%"]
}
```

**Business Scenario.** Every completed API request emits a usage event: request_id, project_id, model, prompt and completion tokens, and a timestamp. Usage is billed per token, so each event must reach the billing ledger exactly once. Inference servers retry delivery when the log does not acknowledge, so about {{retry_share}} of events arrive more than once. Peak traffic is {{peak_rate}} events per second, the log topic has {{partitions}} partitions, and events can arrive up to {{lateness}} late after a regional outage.

**Problem Statement.** Design the pipeline from the usage-event log to the billing ledger. Cover: the event contract and key; how the consumer processes events and commits offsets; what happens when a consumer crashes after writing to the ledger but before committing its offset; how the sink stays idempotent; how you replay a time range safely; how you reconcile the ledger against the raw log; and the cost of the deduplication state.

**Constraints.** The billing ledger must count every request exactly once, to the token. The usage dashboard may lag by a few minutes; the invoice may not be wrong. The ledger is an append-friendly store that supports conditional writes (insert if absent) or transactions. Consumers can be restarted, rescheduled or rebalanced at any time.

**Assumptions.** All rates, partition counts and lateness bounds are hypothetical. The log is Kafka-style: partitioned, ordered within a partition, at-least-once delivery to consumers, with consumer-group offsets.

**Clarifications.**
- Q: Is request_id unique across all regions and retries? | A: Yes. A retry reuses the same request_id; a new request gets a new one.
- Q: Can token counts for a request change after it is first reported? | A: Rarely: a correction event with the same request_id and a higher version supersedes the earlier one.
- Q: Does billing need per-request rows or only totals? | A: Invoices use daily totals per project and model, but support must be able to explain any total down to its requests.
- Q: Can I rely on the log's exactly-once (transactional) mode? | A: Only between the log and itself. The ledger is an external store.
- Q: How long must you be able to replay? | A: At least the {{lateness}} lateness window, plus time to notice and fix a bug.

**Hints.**
1. Exactly-once end to end is at-least-once delivery plus an idempotent effect. Decide where the idempotence lives.
2. If the ledger write and the offset commit cannot be atomic, make the write safe to repeat: a write keyed by request_id that is a no-op the second time.
3. Deduplication state is a set of keys you have seen. How long must you keep a key, and how large is that set at {{peak_rate}} events per second?

**Follow-ups.**
1. A consumer writes 5 000 rows to the ledger and crashes before committing its offset. Walk through exactly what happens after restart.
2. Why does keying the topic by request_id (or project_id) matter, and what does each choice cost you?
3. A bug double-counted completion tokens for two hours last week, and invoices already went out. How do you correct the ledger, and how do you replay without double billing?
4. Size the deduplication state for the {{lateness}} window at peak, and propose a cheaper design that is still exact.
5. Design the reconciliation job that proves the ledger matches the raw log every day. What does it compare, at which grain, and what happens when it fails?

**Follow-up rules.**
- when: exactly once, exactly-once, transactional → ask: Your log's transactions cover the log. Where does that guarantee end, and what makes the write to the external ledger safe beyond that point?
- when: bloom filter, bloom → ask: A Bloom filter has false positives. What does a false positive do to an invoice, and is that acceptable here?
- when: partition by project, key by project, project_id → ask: One project produces 20% of all usage. What happens to its partition at peak, and does that change your deduplication?
- when: upsert, merge, insert if absent, on conflict → ask: Two consumers race to write the same request_id after a rebalance. Show that your write is still correct.
- when: commit offset first, auto commit, enable.auto.commit → ask: If the offset is committed before the write and the consumer then crashes, which events are lost and who notices?

**Evaluation Criteria.** States precisely where exactly-once holds; idempotent ledger writes keyed by request_id (with a version for corrections); safe ordering of write and offset commit and a clear crash walk-through; bounded, sized deduplication state with a retention rule tied to lateness; replay and correction as new ledger entries, never silent rewrites; a reconciliation job at the request grain with alerting; aware of hot keys and rebalances.

## OAI-L2-05: Evaluation results ingestion pipeline

| | |
|---|---|
| **Template ID** | OAI-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Batch and CDC pipelines / versioning, schema evolution, reproducibility |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, analytics-engineer |

```params
{
  "runs_per_day": {"1": [200, 500], "2": [2000, 5000], "3": [20000, 50000]},
  "examples_per_run": ["2 000", "50 000", "500 000"],
  "metric_versions": [3, 6, 11],
  "rerun_window": ["7 days", "30 days"]
}
```

**Business Scenario.** Researchers evaluate model checkpoints against benchmark datasets. Each evaluation run scores every example in a dataset and writes per-example results; about {{runs_per_day}} runs a day, each over up to {{examples_per_run}} examples. Run metadata (checkpoint, dataset version, grader, configuration, status) lives in an experiment-tracking database; per-example scores are written as files to object storage. The metric payload has changed shape {{metric_versions}} times as graders evolved, and runs are often rerun up to {{rerun_window}} later after a grader fix.

**Problem Statement.** Design the pipeline that ingests evaluation results into an analytics store, so that researchers can compare checkpoints on the same dataset version and slice results by example attributes. Cover: change data capture from the experiment-tracking database; joining run metadata with per-example files; dataset and model versioning; schema evolution of the metric payload; late reruns and how they replace or sit beside earlier results; and how any number on a leaderboard can be reproduced later.

**Constraints.** A comparison between two checkpoints must only use results on the same dataset version with the same grader version. A run's results become visible only once the run is complete. Any published comparison must be reproducible exactly, months later. The tracking database is a production OLTP system and must not be loaded by analytics queries.

**Assumptions.** All volumes and version counts are hypothetical. The tracking database supports logical replication (a change log). Per-example files may arrive before or after the run's status changes to complete.

**Clarifications.**
- Q: Is a rerun a new run or an update to the old one? | A: A new run_id that points to the run it replaces. Both must remain queryable.
- Q: Can a dataset change after it is published? | A: Never in place. A fix creates a new dataset version with its own id and content hash.
- Q: Do metric payloads share one schema? | A: No. Each grader declares a schema version; fields are added, renamed and occasionally change type.
- Q: Who reads the results? | A: Researchers in notebooks and dashboards, and an automated leaderboard that must be reproducible.
- Q: Can a run be deleted? | A: It can be marked invalid (for example a broken grader); its data stays for audit.

**Hints.**
1. Separate immutable facts (per-example scores of one run) from mutable state (a run's status, whether it is the current result for its checkpoint and dataset).
2. CDC gives you every change to run metadata in commit order. Think about what a "run completed" event should trigger, and what to do when files are not there yet.
3. Reproducibility means pinning everything a number depends on: checkpoint, dataset version and hash, grader version, configuration and the code that aggregated it.

**Follow-ups.**
1. A grader bug inflated one metric for a week. How do you find every affected leaderboard number, and what do readers see after the rerun?
2. A grader renames `pass` to `passed` and changes `score` from integer to float. How does ingestion behave, and how do queries across versions keep working?
3. The per-example table reaches tens of billions of rows. How do you lay it out so a two-checkpoint comparison on one dataset reads only what it needs?
4. A CDC connector falls behind by six hours and then replays. What can go wrong with run status, and how do you make the consumer safe to replay?
5. Researchers want a leaderboard number from three months ago reproduced exactly, but the aggregation code has changed since. What did your design store to make that possible?

**Follow-up rules.**
- when: overwrite, replace the run, delete old results → ask: A published comparison used the old results. After your overwrite, how would anyone reproduce it?
- when: debezium, logical replication, cdc, binlog, wal → ask: The connector restarts and redelivers changes. How does your consumer stay correct when it sees the same run update twice, or out of order?
- when: json column, variant, schemaless, map column → ask: Keeping payloads schemaless defers the problem. Where are types finally enforced, and who learns when a grader breaks a field?
- when: partition by date, partition by day → ask: Most queries filter by dataset version and checkpoint, not by date. What does your partitioning cost those queries?
- when: poll the database, query the tracking db, select * from runs → ask: The tracking database is production OLTP. What load does polling put on it, and what does polling miss that CDC would not?

**Evaluation Criteria.** Uses CDC (not polling) for run metadata and handles redelivery and ordering; gates visibility on run completion and on file arrival; immutable per-example facts keyed by run_id with explicit supersession for reruns; dataset and grader versions as first-class keys; a schema-evolution strategy with a registry and typed projections; a layout that serves checkpoint comparisons; a reproducibility record for every published number.
