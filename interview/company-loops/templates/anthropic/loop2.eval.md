# Anthropic · Loop 2 — evaluator notes (hidden from candidates)

## ANT-L2-01

**Reference solution**

```python reference
import heapq


def run_jobs(jobs, slots, cancels):
    cancel_at = dict(cancels)
    out = {jid: [0, 0, 0, None] for jid, *_ in jobs}       # done, canceled, expired, last finish
    by_model = {}
    for idx, (jid, model, sub, dl, durs) in enumerate(jobs):
        by_model.setdefault(model, []).append((sub, idx, jid, dl, durs))
    for model, js in by_model.items():                     # models never share slots
        js.sort()
        cl = sorted((cancel_at[j[2]], j[2]) for j in js if j[2] in cancel_at)
        info = {jid: (dl, durs) for _, _, jid, dl, durs in js}
        pos = {jid: 0 for jid in info}
        free, running, ready = slots[model], [], []
        i = ci = 0
        while i < len(js) or running or ci < len(cl):
            t = min(x for x in (js[i][0] if i < len(js) else None,
                                running[0] if running else None,
                                cl[ci][0] if ci < len(cl) else None) if x is not None)
            while running and running[0] == t:             # 1. finished requests free slots
                heapq.heappop(running)
                free += 1
            while i < len(js) and js[i][0] == t:           # 2. submissions join the queue
                sub, idx, jid, dl, durs = js[i]
                heapq.heappush(ready, (dl, sub, idx, jid))
                i += 1
            while ci < len(cl) and cl[ci][0] == t:         # 3. cancels before any start at t
                c, jid = cl[ci]
                ci += 1
                dl, durs = info[jid]
                if c < dl and pos[jid] < len(durs):
                    out[jid][1] += len(durs) - pos[jid]
                    pos[jid] = len(durs)
            while free and ready:                          # 4. earliest deadline first
                dl, sub, idx, jid = ready[0]
                durs = info[jid][1]
                p = pos[jid]
                if p == len(durs):
                    heapq.heappop(ready)
                    continue
                if t >= dl:                                # too late to start: the rest expires
                    heapq.heappop(ready)
                    out[jid][2] += len(durs) - p
                    pos[jid] = len(durs)
                    continue
                end = t + durs[p]
                heapq.heappush(running, end)
                free -= 1
                pos[jid] = p + 1
                rec = out[jid]
                rec[0] += 1
                rec[3] = end if rec[3] is None or end > rec[3] else rec[3]
        for jid, (dl, durs) in info.items():               # whatever never started expired
            if pos[jid] < len(durs):
                out[jid][2] += len(durs) - pos[jid]
    return {jid: tuple(v) for jid, v in out.items()}
```

**Explanation.** A discrete-event simulation per model (models share nothing). The only moments that change state are submissions, finishes and cancels, so the loop jumps to the smallest of the next submission, the earliest running finish and the next cancel. Within one second the specification's order is applied literally: free slots, enqueue submissions, apply cancels, then fill slots. Running requests sit in a min-heap of finish times; waiting jobs sit in a min-heap keyed by `(deadline, submit, position)`, which is exactly the tie-break. A job stays at the top while it has requests to start, so consecutive slots go to the same job until it is exhausted. Deadlines need no events of their own: a job whose deadline has passed is expired lazily when it reaches the top with a free slot, and any job left with unstarted requests at the end has expired. Lazy expiry gives the same counts because a request can only start at an event time, and the check `t < deadline` is made at the moment of starting. Cancels after the deadline are ignored, so expired requests are never relabelled as canceled.

**Complexity.** O((R + J) log J + R log S) time for R requests, J jobs and S slots, O(R + J) memory. The timing test (8 000 jobs, about 205 000 requests, all submitted within 2 000 seconds) runs in about 0.2–0.3 s in CPython. The same loop with the waiting jobs kept in a plain list and scanned with `min()` at every start took about 12 s; simulating second by second is worse still, because deadlines are up to 90 000 seconds away.

**Dialect notes.** In Java the heaps are `PriorityQueue<long[]>` with a comparator over `(deadline, submit, index)`; in C++ `priority_queue` with `greater<>` on a tuple. In a SQL engine this kind of stateful scheduling does not express well (it is inherently sequential); a Spark version would group by model and run the simulation per group with `mapGroups`/`applyInPandas`. Not executed here.

**Edge cases built into the tests.** A slot freed at `t` reused at `t`; a later submission with an earlier deadline served first; a request started before the deadline that finishes after it, together with a request that cannot start exactly at its deadline; the same with the deadline one second later; equal deadlines broken by submission time and then input order; a deadline equal to the submission time; (Hard) models that do not share slots, a job with no requests (`(0, 0, 0, None)`), a busy model whose waiting job expires while another model is idle; (Very Hard) a cancel at the same second as a start, a cancel after the deadline, a cancel while every request is running, and a cancel that frees the queue for another job.

**Common mistakes.** FIFO by submission instead of earliest deadline; `t <= deadline` for starting; refusing to start a request that would finish after the deadline (the specification allows it); filling slots before freeing the ones that finish at the same second; counting requests that were running at cancel time as canceled; labelling requests canceled after the deadline; sharing one pool of slots across models; a global second-by-second loop; re-sorting the queue at every start.

**Follow-up guidance.** (1) FIFO loses when an early job with a distant deadline blocks a short urgent one (the second test is the minimal case). EDF minimises the maximum lateness on one machine and is optimal for feasibility of preemptive single-machine schedules, but with non-preemptive requests and several slots it is a heuristic: a long request started for an early-deadline job can block several short jobs that would otherwise all have met their deadlines. (2) Add a per-job running count; a job at its cap is popped into a "parked" list and pushed back when one of its requests finishes, which needs the finish heap to carry the job id. (3) The replay is a what-if tool: run it with candidate slot limits per model and pick the smallest limits that keep expirations and the organization's rate-limit headroom acceptable; online, the runner uses the same heaps without lookahead. (4) Estimate the start of a new job's last request from the work queued ahead of it (sum of durations of jobs with earlier deadlines divided by slots), then calibrate with replays; the estimate is optimistic when later jobs with earlier deadlines arrive, so report it as a range.

**Rubric anchors.** 2: correct small cases but FIFO, a second-by-second loop or a scan per start, or one same-second ordering rule wrong. 3: all tests pass with an event-driven simulation and the two heaps. 4: also explains lazy expiry, where EDF is and is not optimal, and how the replay supports choosing slot limits.

**Strong signals.** Asks for the order of events within one second before coding; notices that models are independent; separates "expired" from "canceled" by time. **Red flags.** Simulating every second up to the largest deadline; treating EDF as provably optimal for this non-preemptive multi-slot case.

## ANT-L2-02

**Reference solution**

```python reference
def plan_evals(suites, budget, required):
    parent = {sid: p for sid, p, _, _ in suites}
    kids = {sid: [] for sid in parent}
    kids[None] = []
    for sid, p, _, _ in suites:
        kids[p].append(sid)
    cost = {sid: c for sid, _, c, _ in suites}
    value = {sid: v for sid, _, _, v in suites}
    cost[None] = value[None] = 0
    scale = sum(cost.values()) + 1               # score = coverage * scale - hours
    must = {None}                                # required suites and all their ancestors
    for sid in required:
        while sid not in must:
            must.add(sid)
            sid = parent[sid]
    NEG = float("-inf")

    def take(g, sid):                            # g with sid run on top of it
        c, s = cost[sid], value[sid] * scale - cost[sid]
        if c > budget:
            return [NEG] * (budget + 1)
        return [NEG] * c + [x + s for x in g[: budget + 1 - c]]

    # g[b]: best score of the decisions made so far using at most b hours.
    # A frame is [suite, g before its subtree, g with it run, next child index].
    start = [0] * (budget + 1)
    stack = [[None, start, take(start, None), 0]]
    while True:
        frame = stack[-1]
        sid, before, taken, i = frame
        if i < len(kids[sid]):
            frame[3] += 1
            child = kids[sid][i]
            stack.append([child, taken, take(taken, child), 0])
            continue
        result = taken if sid in must else list(map(max, before, taken))
        stack.pop()
        if not stack:
            break
        stack[-1][2] = result                    # the parent continues from here
    best = result[budget]
    if best == NEG:
        return None
    v = -(-best // scale)
    return (v, v * scale - best)
```

**Explanation.** This is a knapsack with precedence constraints that form a forest (a virtual root holds the base suites). The reference passes a budget array down the tree: `g[b]` is the best score of all decisions made before reaching a suite, using at most `b` hours. Taking the suite shifts the array by its hours and adds its score; its children then make their own decisions starting from that array; the suite's result is the element-wise maximum of "skipped" (the array it received) and "taken" (the array after its subtree), except that a suite that is required or has a required descendant cannot be skipped. Each suite costs O(budget) work, so the whole run is O(n · budget). The tie rule is folded into one integer: `score = coverage × scale − hours` with `scale` larger than any hour total, so a larger score means more coverage, then fewer hours. The traversal uses an explicit stack because families can be thousands of suites deep. An equivalent method lists suites in depth-first order and fills `f[i][b] = max(take: f[i+1][b − h_i] + v_i, skip: f[i + size_i][b])` from the end.

**Complexity.** O(n · budget) time; O(budget · depth) memory for the stack of arrays (O(n · budget) for the depth-first-order table). The 3 000-suite, 2 000-hour timing test runs in well under a second in CPython. The classic child-merge tree knapsack is O(n · budget²) — about 10¹⁰ steps here; a naive version took about 40 seconds at only 200 suites. Subset enumeration is 2ⁿ.

**Dialect notes.** In Java or C++ the same arrays are `long[]` and the "take" is a shifted loop; a recursion of depth 2 500 is usually fine in C++ but not on the default JVM thread stack for much deeper trees, and CPython's default limit is about 1 000. Scaling the tie-break into one integer needs 64-bit arithmetic in typed languages. Not executed here.

**Edge cases built into the tests.** A high-coverage extension whose base is expensive (one hour short of affording both), the same with the budget exactly enough, equal coverage with different hours, an extension listed before its base, budget 0, nothing fits; (Hard) a required extension that forces its base even though that lowers coverage, required suites that do not fit (`None`), required suites that exactly fill the budget, an empty gate; (Very Hard) zero-hour suites under a zero-hour base, a required suite at the bottom of a 3 000-suite chain, and the same chain without the gate and one hour short.

**Common mistakes.** Greedy by coverage per hour; letting an extension run without its parent; forgetting the hours tie-break; `budget` treated as strict; recursion on deep families; required suites enforced without their ancestors; returning `(0, 0)` instead of `None` when the gate cannot fit; merging children with a full budget × budget convolution.

**Follow-up guidance.** (1) Keep, per suite and budget, whether it was taken (a bit per cell in the depth-first-order table), then walk forward from position 0; memory O(n · budget) bits. (2) With multiple prerequisites the constraint graph is a DAG and the problem becomes precedence-constrained knapsack, which is NP-hard in general; in practice, merge co-dependent suites into one unit, use an ILP solver, or relax to a tree by choosing one "owning" parent. (3) Submodular coverage (a union of behaviours or categories covered) breaks the additive DP; greedy with the cost-benefit ratio plus the best single item has approximation guarantees, or solve exactly with an ILP for modest sizes. (4) Run required suites and their ancestors first, keep a reserve, use estimates with an upper quantile, and re-plan when actual hours come in.

**Rubric anchors.** 2: a correct recursive or quadratic-in-budget solution that fails the timing or depth tests, or a greedy. 3: all tests pass with an O(n · budget) iterative DP and the right tie-break and gate. 4: also discusses reconstruction, DAG prerequisites and non-additive coverage credibly.

**Strong signals.** Says "knapsack with precedence" quickly; asks whether the budget is inclusive and how ties break; designs for depth before being told. **Red flags.** Ratio greedy defended as optimal; treating coverage numbers as objective truth rather than the team's weights.

## ANT-L2-03

**Reference solution** (the fixed report)

```python reference
POINTS = {"win": 2, "tie": 1, "loss": 0}


def _candidate_outcome(order, verdict):
    if verdict == "tie":
        return "tie"
    shown_first = "candidate" if order == "BA" else "baseline"
    winner = shown_first if verdict == "first" else ("baseline" if shown_first == "candidate" else "candidate")
    return "win" if winner == "candidate" else "loss"


def win_rates(judgments):
    latest = {}
    for j in judgments:
        key = (j["item"], j["order"])
        if key not in latest or j["attempt"] > latest[key]["attempt"]:   # highest attempt
            latest[key] = j
    items = {}
    for (item, order), j in latest.items():
        rec = items.setdefault(item, {"category": j["category"], "points": 0, "orders": 0})
        if j["verdict"] == "invalid":
            continue
        rec["orders"] += 1
        rec["points"] += POINTS[_candidate_outcome(order, j["verdict"])]
    cats, unpaired = {}, 0
    for rec in items.values():
        if rec["orders"] < 2:                                          # both orders needed
            unpaired += 1
            continue
        c = cats.setdefault(rec["category"], {"items": 0, "points": 0})
        c["items"] += 1
        c["points"] += rec["points"]
    rates = [c["points"] / (4 * c["items"]) for c in cats.values()]
    macro = sum(rates) / len(rates) if rates else None                 # mean of category rates
    return {"categories": cats, "unpaired": unpaired, "macro_win_rate": macro}
```

**The planted bugs, their symptoms and their fixes.** Each has one named test in which the other four bugs change nothing.
1. **First-logged judgment wins.** `if key not in latest` keeps whichever attempt arrives first, usually the original that was retried because it timed out or did not parse. Symptom: numbers move between runs with identical inputs, depending on log order. Fix: keep the highest `attempt`, comparing explicitly so that a retry logged before the original still wins (a "last seen wins" fix fails the Hard test for that).
2. **Position swap ignored.** `verdict == "second"` is read as a candidate win in both orders, but in `BA` the candidate is shown first. Symptom: the BA half of every comparison is inverted, so the swap that was meant to cancel position bias amplifies it. Fix: map position to model per order.
3. **Ties earn nothing.** There is no branch for `"tie"`. Symptom: the candidate is penalised whenever the judge cannot separate the two, which is common for close snapshots. Fix: one point per tied order.
4. **Half-judged items counted.** `orders == 0` treats an item with one valid order as paired. Symptom: items whose other order timed out or was invalid enter the rate with at most 2 of 4 points, dragging it down, and `unpaired` is undercounted. Fix: require both orders.
5. **Pooled instead of macro.** The summary divides total points by all items, so a large category dominates and the "macro" label is false. Fix: average the per-category rates.

**Explanation.** A pairwise judge report must deduplicate retries deterministically, translate positions into models per order, score ties, compare like with like (only items judged in both orders), and aggregate the way it says it does. The fix is small; a rewrite is not needed.

**Complexity.** O(n) time and O(items) memory; the timing test is about 180 000 judgments over 80 000 items.

**Dialect notes.** In SQL the dedupe is `ROW_NUMBER() OVER (PARTITION BY item, ord ORDER BY attempt DESC) = 1` (or `QUALIFY` in Snowflake and BigQuery, `DISTINCT ON` in PostgreSQL); the swap is a `CASE` on `(ord, verdict)`; pairing is `HAVING COUNT(*) FILTER (WHERE verdict <> 'invalid') = 2`; macro is `AVG` over a per-category subquery. Integer division (`points / (4 * items)`) truncates to 0 in PostgreSQL, SQL Server and Spark with integer types; cast first. Not executed here.

**Edge cases built into the tests.** A retry with a different verdict; a single item where the candidate wins in both orders; a tie; an item with one order only; two categories of different sizes; nothing paired at all (`None`); (Hard) a retry logged before its original, an invalid order; (Very Hard) an invalid latest attempt after a valid earlier one, and three attempts in shuffled order.

**Common mistakes.** "Last seen wins" (fails when retries are logged early); skipping invalid judgments before choosing the latest attempt (resurrects an earlier answer, contrary to rule 1); fixing the swap by flipping every BA verdict including ties; counting ties as 0.5 out of 1 but forgetting the 4-point maximum; leaving a category with no paired items in the output; integer division in the rate.

**Follow-up guidance.** (1) One test per bug, each keeping the others neutral, plus one for a retry logged first and one for an invalid latest attempt. (2) Bootstrap over items (the unit that was sampled), stratified by category so the macro weights stay fixed, or a paired sign test per category; resampling judgments breaks the pairing. (3) A large AB/BA gap is position bias in the judge; report it alongside the win rate, and treat the two-order average as the estimate rather than either half. (4) Store judgments with grader model, grader prompt version and prompt-set version, and refuse to compare reports whose versions differ.

**Rubric anchors.** 2: fixes two or three bugs; tests still fail. 3: all five fixed and explained, all tests pass. 4: also proposes a correct uncertainty estimate and the version guard, and adds a regression test per bug.

**Strong signals.** Writes the AB/BA truth table before touching code; asks what "macro" is meant to weight. **Red flags.** Removing retries by keeping only attempt 1; "the judge is unbiased so the swap does not matter".

## ANT-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Change detection.** A change log from the document store (CDC or an event per write) produces `(doc_id, content_hash, changed_at)`. A `enrichment_state` table keyed by `(doc_id)` holds the current `content_hash` and the `(content_hash, prompt_version, model_snapshot)` of the last valid enrichment. Work is due when the current tuple has no valid result. Hashing content (not `updated_at`) makes no-op saves free and catches edits within one second.
- **Work units and ids.** A work unit is `(doc_id, content_hash, prompt_version, model_snapshot)`. Its custom id is a deterministic short hash of that tuple (custom ids have length limits), with a `work_unit` table mapping id → tuple. Units are written with status `queued` before any submission, so a crash never loses track of what was sent.
- **Submission.** A scheduler packs queued units into batches below the documented size limits, records `batch_id` against each unit (`queued → submitted`) in the same transaction that stores the provider's batch id, and submits under a per-pipeline token budget so the organization's shared limits keep headroom for interactive products. If the process crashes between the API call and the commit, the next run lists recent batches and reconciles by custom id before resubmitting anything.
- **Polling and retrieval.** Poll batches with backoff; when a batch ends, download results promptly (well inside the retention period) into raw object storage, keyed by batch id, then parse. Results are matched by custom id, never by position.
- **Validation and outcomes.** Succeeded responses are validated against the output schema (structured output via a JSON schema or a tool definition); invalid output is a failure class of its own. Errored requests are classified as retryable (overload, rate limit) or not (invalid request); expired and canceled requests are re-queued; invalid outputs are retried at most once with the same prompt, then routed to a review queue, because repeating a deterministic failure only costs money.
- **Writes.** The enriched table is a `MERGE` keyed by `doc_id` with a version guard: apply only if the result's `content_hash` equals the document's current hash (or the result is newer by change sequence). A stale result is stored in history but never overwrites the current row. Every row carries `prompt_version`, `model_snapshot`, `schema_version`, `batch_id`, `custom_id` and `enriched_at`.
- **Backfills.** A prompt or model change creates a new `(prompt_version, model_snapshot)` target; a backfill queue enumerates documents lazily and feeds the same scheduler at a lower priority with its own daily budget. Readers see one consistent version per row; a `target_version` view shows backfill progress, and consumers that need homogeneity can filter on the version.
- **Privacy and observability.** Logs carry ids, hashes and counts, never document text. Metrics: queue age, units per state, batch durations, outcome mix per batch, validation failure rate by prompt version, cost per day from usage fields.

**Competing designs to accept.** Workflow engines (Airflow, Dagster, Temporal) owning the state machine; a stream processor feeding a queue of work units; storing state in the lakehouse instead of an OLTP table if updates are transactional; synchronous calls for a small urgent slice (with a clear reason). A candidate who keys work by `doc_id` only must explain how a stale result is prevented from overwriting a newer one.

**Bottlenecks and failure modes.** Duplicate submission after a crash; results discarded because they were matched by position; the result retention period passing before download; a backfill consuming the organization's limits; schema drift in model output; very long documents exceeding the context window (chunk or skip with a flag); hot customers whose imports dwarf the daily change rate; cost overruns from retrying deterministic failures.

**Incident guidance.**
- *Backfill throttles interactive products*: pause the backfill queue immediately (it is a separate queue for this reason), confirm interactive error rates recover, then resume with a lower per-pipeline budget derived from the limits headroom; add an alert on the organization's limit utilisation and make backfills yield automatically above a threshold.
- *30% expired on a heavy day*: the work units are still queued for retry, so nothing is lost; resubmit expired units first (they are the oldest), split into smaller batches, and check whether the volume (daily change plus the import) simply exceeded what the processing window absorbs; for imports, admit them through the backfill queue rather than the daily one so they cannot cause the daily deadline to slip.

**Follow-up guidance.** (1) Units were recorded as queued before submission and the batch id is recorded on return; on restart, list recent batches, map their custom ids back to units, and only resubmit units with no batch. (2) Both results are stored; only the one whose `content_hash` matches the current document is applied, so arrival order does not matter. (3) Lower-priority queue, a budget per day, oldest or most-read documents first; the table shows mixed versions with explicit columns, and dashboards can filter. (4) Group failures by prompt version, model snapshot, document type and length; one prompt version failing across types is a prompt problem; failures concentrated in long or unusual documents are data problems; retry only the retryable classes. (5) Daily units ≈ documents × change rate; tokens per unit × batch price; the largest levers are change detection (hashing avoids no-op work), prompt length (and caching of a shared prefix where the batch interface supports it), and how often prompt changes trigger full backfills.

**Rubric anchors.** 2: re-enriches everything nightly or keys only by document; retries blindly; no version guard. 3: hash-based change detection, deterministic ids, idempotent merge with a version guard, outcome classes, separate backfill. 4: also crash-safe submission reconciliation, limits headroom for other users, validation-aware retry policy, cost estimate and lineage that makes any field traceable to its prompt and model.

**Strong signals.** Asks what happens to results that come back after the document changed; designs the custom id deliberately. **Red flags.** Matching results by position; logging prompts and outputs with document text for debugging.

## ANT-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Ingest.** A scheduled job pulls usage and cost reports at the finest grain needed (hour or day × workspace × API key × model × token type × processing mode) with a lookback equal to the revision window plus a margin. Each pulled bucket replaces the stored bucket (`MERGE` or partition overwrite keyed by the report grain), so revisions update rather than duplicate. Raw responses are kept with the pull time, which allows "as reported at" questions and audits. Pulls are paginated and rate-limit aware; a run is idempotent and can be re-run for any range.
- **Facts.** `fct_usage_hourly(hour, workspace_id, api_key_id, model, token_type, processing_mode, tokens, reported_cost, pulled_at)`. Token types: uncached input, cache write, cache read, output; processing mode: standard or batch. Additive measures only; rates are computed in the semantic layer.
- **Cost.** Prefer the provider's reported cost per bucket where available, because it already applies the right price for token type and mode; keep a versioned price table (effective-dated by model, token type and mode) to compute an expected cost as a check and to estimate savings from caching and batch. The difference between computed and reported cost is a monitored metric, not a silent fix.
- **Ownership.** `dim_key_owner` and `dim_workspace_owner` as SCD type 2 (valid_from, valid_to) from the registry, plus allocation rules for shared keys (tag-based shares, fixed percentages) with their own validity. The join uses the owner valid at the usage hour, so a mid-month reorganisation moves only later days. Unknown owners map to an explicit `UNALLOCATED` unit with an alert and an owner-assignment workflow.
- **Allocation.** Split shared-key cost by the rule's weights with largest-remainder rounding so parts add exactly to the cent amount of each bucket (or of each month line, decided once and documented).
- **Month close.** Provisional close a few days after month end from the facts; final close when the invoice arrives: compare totals, book the difference to an `INVOICE_ADJUSTMENT` line allocated pro rata (or to a central cost centre), freeze the month (snapshot tables keyed by close version). Revisions after close create adjustment lines in the next open month; the closed snapshot is never rewritten.
- **Access and serving.** Row-level security by business unit on the detail; finance sees all; daily dashboards read the open month and show "provisional" until close. Key ids are shown but no request content ever enters this pipeline.
- **Quality checks.** Freshness per pull, completeness per hour (no missing buckets), totals per day stable outside the revision window, unallocated share below a threshold, computed vs reported cost within a tolerance.

**Competing designs to accept.** Taking only daily data if hourly is not needed; snapshotting the whole report every run and selecting the latest per bucket (simple and auditable, more storage); allocating by workspace rather than key when keys move between workspaces, provided the choice is stated; computing cost entirely from a price table if reconciled to the invoice with an explicit adjustment.

**Bottlenecks and failure modes.** Append-only ingestion double counting revised buckets; joining to the current owner and rewriting history; rounding that leaves cents unassigned; silently re-opening closed months; price tables that drift from the provider's; rate-limited pulls that fall behind and leave gaps; very high key cardinality at the largest scale (aggregate early to the grain finance needs).

**Follow-up guidance.** (1) The closed month stays as sent; the correction becomes an adjustment line in the current month with a reference to the original period, visible to the affected units. (2) Compare by day, model, token type and mode to localise it: a missing token type (often cache writes or batch), a price change mid-month, hours outside the pull window, currency or rounding; book any unexplained remainder to the adjustment line and track it. (3) Attribute by the key's owner at usage time if keys are the unit of accountability, or by workspace if budgets and limits are managed per workspace; either way, the history table makes the move explicit. (4) Applications must send their own end-customer identifier (for example as request metadata or by using separate keys or workspaces per tenant); never infer customers from prompt content, and keep end-customer identifiers pseudonymous in this pipeline.

**Rubric anchors.** 2: nightly append of reports, current-owner joins, no reconciliation. 3: idempotent overlap pulls at the report grain, SCD ownership joined at usage time, explicit unallocated bucket, reconciliation with the invoice. 4: also a two-step close with frozen snapshots and adjustment lines, exact rounding, versioned prices used as a check, and clear access control.

**Strong signals.** Asks how late revisions arrive before designing the pull; insists the month total equals the invoice exactly. **Red flags.** "Re-pull everything each night and overwrite" without considering closed months; allocating unowned cost proportionally and hiding it.
