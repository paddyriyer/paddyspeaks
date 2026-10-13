# OpenAI · Loop 2 — evaluator notes (hidden from candidates)

## OAI-L2-01

**Reference solution**

```python reference
def min_batch_cost(lengths, max_batch, overhead, token_budget=None, shapes=None):
    a = sorted(lengths)
    n = len(a)
    # pad[k]: slots a batch of k requests occupies, or None if k cannot be launched.
    pad = [None] * (max_batch + 1)
    if shapes:
        options = sorted(shapes)
        for k in range(1, max_batch + 1):
            for s in options:
                if s >= k:
                    pad[k] = s
                    break
    else:
        for k in range(1, max_batch + 1):
            pad[k] = k
    INF = float("inf")
    dp = [0] + [INF] * n          # dp[i]: cheapest cost for the i shortest requests
    for i in range(1, n + 1):
        top = a[i - 1]            # the longest request of any batch ending at i
        best = INF
        for k in range(1, min(max_batch, i) + 1):
            p = pad[k]
            if p is None:
                break
            padded = top * p
            if token_budget is not None and padded > token_budget:
                break             # padded size never shrinks as k grows
            v = dp[i - k] + padded
            if v < best:
                best = v
        dp[i] = best + overhead
    return dp[n]
```

**Explanation.** Sort ascending. Some optimal batching uses only contiguous runs of the sorted list. Proof sketch: take the batch G holding the longest request; if a request outside G is longer than some non-maximal request inside G, swap them. G's maximum and every batch size are unchanged; the other batch's maximum can only fall. Neither the budget nor padded shapes depend on anything but size and maximum, so feasibility survives each swap. Repeating this gives G the |G| longest requests, then recurse on the rest. With contiguity, `dp[i] = overhead + min over k (dp[i−k] + sorted[i−1] × pad(k))`, and the batch maximum is always the last element. The generator's oracle enumerates every set partition without sorting, so it checks this argument independently.

**Complexity.** O(n log n) to sort plus O(n·B) for the DP; O(n + B) memory. The early `break` on the budget is valid because `pad(k)` does not decrease as k grows.

**Language notes.** Java/C++: use `long` (lengths × slots × n can pass 2³¹). Scala: a fold over a mutable `Array[Long]`. The recurrence is the same in every language; these variants are not executed here.

**Edge cases built into the tests.** Empty queue (0); one request; exactly `max_batch` equal requests (one batch) against one more (two); zero overhead (every request alone is optimal, because m × k ≥ the sum of lengths); one long request among short ones in arrival order; a batch exactly at the budget against one token over (Hard+); three requests padded to four and padding counted against the budget (Very Hard).

**Common mistakes.** Batching in arrival order; greedily filling batches to `max_batch` (wrong when overhead is small and lengths vary); recomputing `max(a[j:i])` for every candidate batch (O(n·B²): it passes here only because `max` over a slice runs in C, so ask about it); enumerating partitions (fails the timing test); `<` instead of `≤` for the budget; using the request count instead of the padded shape; recursion with `lru_cache` over 6 000–8 000 states (RecursionError at Python's default limit of about 1 000).

**Follow-up guidance.** (1) Keep `choice[i] = k` and walk back from n; ties need a stated rule (for example the fewest batches). (2) `dp[j] − top·j` is a line in `top` with slope −j; since `top` is non-decreasing and j increases, a monotone-deque convex hull trick gives amortised O(1) per i, and expiring the front handles the B cap. (3) Online: no exact optimum; discuss a wait-or-launch policy bounded by the deadline, continuous batching, and the cost of idling the GPU. (4) The exchange argument holds for any cost `f(max) × slots + overhead` with f non-decreasing; the DP is unchanged.

**Rubric anchors.** 2: correct on small inputs but in arrival order, or O(n·B²). 3: sorted DP, correct budget and shapes, O(n·B), with an argument for contiguity. 4: also a crisp exchange-argument proof, reconstruction, and the convex hull trick or a principled online policy.

**Strong signals.** Asks whether batches must follow arrival order before coding; proves contiguity instead of asserting it; notices the inner loop can stop at the budget. **Red flags.** Claims the greedy is optimal without a proof; ignores padding in the cost.

## OAI-L2-02

**Reference solution**

```python reference
from collections import deque

def rollout_finish(durations, deps, with_path=False):
    dur = dict(durations)
    succ = {v: {} for v in dur}
    indeg = {v: 0 for v in dur}
    for e in deps:
        a, b = e[0], e[1]
        soak = e[2] if len(e) > 2 else 0
        for v in (a, b):
            if v not in dur:              # an external gate: 0 minutes
                dur[v] = 0
                succ[v] = {}
                indeg[v] = 0
        if b in succ[a]:
            succ[a][b] = max(succ[a][b], soak)   # duplicate dependency: longest soak
        else:
            succ[a][b] = soak
            indeg[b] += 1
    start = {v: 0 for v in dur}
    queue = deque(v for v in dur if indeg[v] == 0)
    order = []
    while queue:                           # Kahn's algorithm, forward
        v = queue.popleft()
        order.append(v)
        done = start[v] + dur[v]
        for w, soak in succ[v].items():
            if done + soak > start[w]:
                start[w] = done + soak
            indeg[w] -= 1
            if indeg[w] == 0:
                queue.append(w)
    if len(order) < len(dur):
        return None                        # some step never became free: a cycle
    finish = max((start[v] + dur[v] for v in dur), default=0)
    if not with_path:
        return finish
    # tail[v]: from v's start to the end of the longest path through it.
    tail = {}
    for v in reversed(order):
        tail[v] = dur[v] + max((s + tail[w] for w, s in succ[v].items()), default=0)
    if not dur:
        return (0, [])
    v = min(k for k in dur if tail[k] == finish)
    path = [v]
    while tail[v] > dur[v]:
        need = tail[v] - dur[v]
        v = min(w for w, s in succ[v].items() if s + tail[w] == need)
        path.append(v)
    return (finish, path)
```

**Explanation.** The earliest start of a step is the latest moment any dependency allows it, so the finish time is the longest path in the dependency DAG weighted by durations and soak times. Kahn's algorithm gives a topological order and detects cycles at the same time: if fewer steps come out than exist, the remainder lie on or behind a cycle. Each edge is relaxed once. For the critical path, a backward pass computes `tail`, then the tie rule picks the smallest-named start and the smallest-named successor at each step. The generator's oracle is an iterative DFS over successors with three-colour cycle detection, so the two approaches check each other.

**Complexity.** O(V + E) time and memory. No recursion, so the 30 000-step chain is fine.

**Language notes.** Java: `ArrayDeque` and `HashMap<String, Integer>`; Scala: mutable maps in a while loop; C++: intern names to ints first, then vectors. A JVM recursive DFS also overflows on long chains unless the thread stack is enlarged. Not executed here.

**Edge cases built into the tests.** Empty plan; independent steps; a self-dependency; a two-step cycle hidden among valid edges; a diamond; soak delays (Hard+); an external gate not in `durations` (Hard); duplicate dependencies with different soaks and a tied critical path (Very Hard); a 30 000-step chain; about 200 000 random edges.

**Common mistakes.** Recursive DFS (RecursionError on the chain); detecting cycles with one visited set (flags diamonds as cycles); forgetting isolated steps when taking the maximum; counting a duplicate edge twice in the in-degree (still terminates correctly with Kahn, but not if the duplicate is deduplicated inconsistently); using Dijkstra or BFS levels instead of longest paths; returning 0 for a cycle.

**Follow-up guidance.** (1) Backward pass from the finish: latest start = min over successors (their latest start − soak) − duration; slack = latest − earliest; zero-slack steps form the critical paths. (2) With a cap on parallelism it becomes resource-constrained scheduling (NP-hard in general); list scheduling by longest remaining tail is the usual heuristic. (3) Only descendants of the changed step can move: re-relax in topological order from there. (4) Keep the plan's topological order and reject an edge (u, v) if v reaches u; incremental cycle detection or a reachability check bounded by the order.

**Rubric anchors.** 2: right idea but recursion fails, or cycles misdetected on diamonds. 3: Kahn or iterative DFS, correct on every test, O(V + E). 4: also slack, a clear argument for correctness, and a sensible answer on resource limits.

**Strong signals.** Names the problem (longest path in a DAG) at once; asks what happens on a cycle before coding. **Red flags.** "Use Dijkstra with negative weights"; ignores steps that appear only in `deps`.

## OAI-L2-03

**Reference solution (the fixed function)**

```python reference
HOUR_MS = 3_600_000


def hourly_tokens(events):
    latest = {}
    for e in events:
        cur = latest.get(e["request_id"])
        if cur is None or e["attempt"] > cur["attempt"]:     # fix 1: highest attempt wins
            latest[e["request_id"]] = e

    totals = {}                                               # fix 5: fresh state per call
    for e in latest.values():
        if e["status"] != "ok":                               # fixes 2 and 3: after dedup, ok only
            continue
        hour = e["ts_ms"] // HOUR_MS * 3600                   # fix 4: floor, [h, h + 1h)
        key = (e["project_id"], hour)
        totals[key] = totals.get(key, 0) + e["prompt_tokens"] + e["completion_tokens"]

    return sorted((p, h, t) for (p, h), t in totals.items())
```

**The bugs, their symptoms and fixes.**
1. *First attempt kept* (`if rid not in latest`). Symptom: a retry with corrected token counts is ignored when the first attempt arrived first. Fix: keep the event with the highest `attempt`. "Last seen wins" is not a fix: attempts arrive in any order (a dedicated test).
2. *Incomplete status filter* (`== "error"`). Symptom: timed-out and cancelled requests are billed. Fix: allow-list `"ok"` instead of deny-listing one failure status.
3. *Filter before deduplication.* Symptom: a request whose latest attempt failed bills its earlier successful attempt. Fix: deduplicate first, then filter on the surviving event's status.
4. *Hour-boundary off-by-one* (`ceil(ts / hour) − 1`). Symptom: an event at exactly 10:00:00.000 (or midnight) lands in the previous hour (or day); everything else is correct, which is why it survived. Fix: integer floor division, `ts_ms // 3_600_000 * 3600`.
5. *Mutable default argument* (`totals={}`). Symptom: totals grow with every call in a long-running service, the "drift upwards" in the scenario; a single-call unit test never sees it. Fix: create the dict inside the function (or `totals=None`).

**Explanation.** The fixed version is one pass to pick each request's authoritative event, one pass to aggregate, and a sort of the output keys. The generator's oracle implements the specification directly in JavaScript, and each named test isolates one bug: the second-call test first runs the function on other data through `_after_other_call`.

**Complexity.** O(n + k log k) for n events and k output rows; O(r) memory for r distinct request_ids.

**Language notes.** Java has no default arguments, but a static or instance-level map shared across calls is the same bug. Spark: deduplicate with `row_number()` over `request_id` ordered by `attempt desc`, then filter, then group by `window(ts, '1 hour')`, which is half-open. Not executed here.

**Edge cases built into the tests.** Retries in and out of order; timeout and cancelled; latest attempt failed; exactly on the hour and one millisecond before; midnight UTC (Hard+); an exact duplicate delivery (Very Hard); a second call; 100 000–200 000 events in one pass.

**Common mistakes.** Fixing only the bugs the first failing test shows; "last seen wins"; summing every attempt; replacing `ceil − 1` with `round`; local-time conversion with `datetime.fromtimestamp` (passes on a UTC machine, wrong in production); scanning the list per request (O(n²)).

**Follow-up guidance.** (1) One test per bug, named after the rule it protects; a test that calls the function twice. (2) Keyed state per request_id with a TTL longer than the lateness bound, emitting corrections (retractions) to the hourly totals when a later attempt arrives. (3) Store UTC; convert at the presentation layer with a time-zone database; on DST days an hour can repeat or vanish, so keep UTC keys and label local time. (4) Bugs 1–4 would also break billing; a daily reconciliation at the request grain (count and token sums by request_id) catches them, and bug 5 shows up as totals that exceed the raw log.

**Rubric anchors.** 2: finds two or three bugs. 3: finds and fixes all five with clear explanations. 4: also proposes the tests that would have caught each and explains why bugs 4 and 5 escaped testing.

**Strong signals.** Reproduces a bug with a tiny example before changing code; explains why each bug survived. **Red flags.** Rewrites everything without being able to name what was wrong; introduces local time.

## OAI-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Contract.** `request_id` (globally unique, reused by retries), `version` (for corrections), `project_id`, `model`, `prompt_tokens`, `completion_tokens`, `event_ts`, `region`, `schema_version`. Producers retry with the same request_id.
- **Log.** Key by `request_id`: duplicates of one request land in one partition, which keeps deduplication local, and hot projects spread across all partitions. Retention at least the lateness window plus a recovery margin, with an archive of raw events in object storage for longer replays.
- **Consumer.** Read a batch; write it to the ledger with a conditional insert keyed by `(request_id, version)` (for example `INSERT … ON CONFLICT DO NOTHING`, or a transaction); only then commit offsets. A crash between write and commit replays the batch, and every write is a no-op the second time. Alternatively store the consumer's offsets in the same ledger transaction as the rows, so write and offset commit are atomic.
- **Ledger.** An append-only table of per-request usage with a unique key; daily totals per project and model are derived from it. Corrections are new versions or adjusting entries, never in-place edits of invoiced rows.
- **Dedup state.** The ledger's unique index is the exact dedup state. If an in-stream dedup cache is added for cost, it holds keys for the lateness window: at the peak event rate for the whole lateness window that is rate × seconds keys of about 16–32 bytes each (for example, 400 000 events per second for 24 hours is about 35 billion keys, roughly 1 TB at 32 bytes), so size it explicitly and keep the ledger's unique key as the backstop.
- **Reconciliation.** Daily: count and token sums by `(day, project, model)` from the raw archive (deduplicated by request_id) versus the ledger; drill down to request_id on mismatch; block the invoice export on failure.

**Competing designs to accept.** Log transactions (read-process-write within the log) with a downstream idempotent sink; a stream processor with checkpointed state and a two-phase-commit sink; a lakehouse `MERGE` keyed by request_id in micro-batches. All are fine if the candidate states where exactly-once ends and why the external write is safe.

**Bottlenecks and failure modes.** Committing offsets before writing (loss); auto-commit; Bloom filters on the billing path (false positives drop real usage); dedup state with no TTL; keying by project (hot partition); rebalance races (two consumers writing the same key, safe only with a conditional write); late events after the day was invoiced.

**Incident guidance (for follow-ups 1 and 3).** Crash after write, before commit: the batch replays; the unique key turns the 5 000 rewrites into no-ops; offsets advance. Double-counted completion tokens: identify the affected requests from the raw log, post adjusting entries for the difference, reissue or credit invoices through the billing process, and add a reconciliation check on token sums that would have caught it.

**Follow-up guidance.** (2) request_id keying localises duplicates; project keying helps per-project ordering but creates hot partitions. (4) State = rate × window × key size; cheaper exact options are the ledger's own unique index, partitioning dedup state by day, or deduplicating only within the lateness window and relying on the ledger key beyond it. (5) Compare at the request grain, alert on any non-zero difference for billing, tolerate none.

**Rubric anchors.** 2: "use exactly-once mode" with no account of the external sink. 3: idempotent keyed writes, correct ordering of write and commit, a crash walk-through, bounded dedup state. 4: also corrections without rewriting history, a sized state estimate, reconciliation at the request grain, and rebalance races handled.

**Strong signals.** Says "exactly-once is at-least-once plus idempotence" and shows where the idempotence lives. **Red flags.** Probabilistic dedup on billing; "the log guarantees it" with no sink story.

## OAI-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Run metadata by CDC.** Logical replication from the tracking database into a log; a consumer keeps a `runs` table (run_id, checkpoint_id, dataset_id, dataset_version, dataset_hash, grader_id, grader_version, config_hash, status, supersedes_run_id, valid). Apply changes idempotently using the source's commit position (LSN) so redelivery and out-of-order replays are safe. No analytics queries touch the OLTP database.
- **Per-example facts.** Files land in object storage under `run_id/`; a manifest written last (or the run's completion event plus a file-count check) marks them complete. Ingest into an immutable `example_results` table keyed by `(run_id, example_id)`, partitioned by `dataset_version` and clustered by `checkpoint_id` (or bucketed by run_id), since comparisons filter on those.
- **Visibility.** A run becomes visible when status = complete **and** its manifest is ingested. Files that arrive first wait in staging; a completion with missing files raises an alert after a timeout.
- **Reruns.** A rerun is a new run_id with `supersedes_run_id`; a `current_results` view picks the latest valid run per (checkpoint, dataset_version, grader_version). Old runs stay queryable for audit and reproduction.
- **Schema evolution.** Payloads are stored raw (for example JSON or a variant type) alongside typed projections per grader schema version, driven by a schema registry with declared renames and type changes. Every payload version is mapped into one canonical view; unknown fields land in the raw column and raise a contract alert, never a silent drop.
- **Reproducibility.** Every published number stores a record: run_ids used, dataset hash, grader version, config hash, aggregation code version (commit), and the table snapshot or version id. Reproduction re-runs that code against that snapshot.

**Competing designs to accept.** Batch snapshots of the tracking database every few minutes instead of CDC, if the candidate prices the OLTP load and the missed intermediate states; a warehouse instead of a lakehouse; storing results directly in a columnar format written by the eval harness, with only metadata via CDC.

**Bottlenecks and failure modes.** Polling the OLTP database; overwriting results on rerun (breaks reproducibility); comparing across dataset or grader versions; visible half-written runs; schemaless payloads with no enforcement; partitioning only by date; the CDC consumer applying a stale status after a replay.

**Incident guidance (for follow-ups 1 and 4).** Grader bug: mark affected runs invalid by grader version and date range, find every published number whose reproducibility record cites them, rerun, publish corrected numbers with a visible note. CDC lag and replay: apply only changes with a higher source position than stored; never move a run from complete back to running because of an older event.

**Follow-up guidance.** (2) Registry records the rename and the int → float widening; the canonical view coalesces `pass`/`passed` and casts; a breaking change gets a new metric name. (3) Partition by dataset_version, cluster by checkpoint and example_id; pre-aggregate per run. (5) Store the aggregation code version and a table snapshot id with every published number; retain snapshots for at least the rerun window plus the publication's lifetime.

**Rubric anchors.** 2: one mutable results table, overwritten on rerun. 3: CDC with idempotent apply, immutable facts plus supersession, versioned keys, completion gating. 4: also a schema-evolution plan with a registry, a layout matched to the queries, and a full reproducibility record.

**Strong signals.** Asks what "the same dataset" means before designing; keeps both old and new results after a rerun. **Red flags.** Joins results across dataset versions; treats the tracking database as the analytics store.
