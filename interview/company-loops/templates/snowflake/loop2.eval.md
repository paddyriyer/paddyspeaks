# Snowflake · Loop 2 — evaluator notes (hidden from candidates)

## SNO-L2-01

**Reference solution**

```python reference
import heapq
from collections import deque


def simulate_warehouse(queries, policy):
    if not queries:
        return (0, 0, 0, 0, 0.0)
    slots = policy["slots"]
    lo, hi = policy["min_clusters"], policy["max_clusters"]
    startup, idle_s = policy["startup_s"], policy["idle_s"]

    t0 = queries[0][1]
    running = {}            # ready cluster id -> queries running on it
    idle_since = {}         # ready cluster id -> second it became idle (only while running == 0)
    started = {}            # cluster id -> second it started (billing)
    billed = 0
    for c in range(1, lo + 1):
        running[c] = 0
        idle_since[c] = t0
        started[c] = t0
    next_id = lo + 1
    starting = None         # (ready_at, id): at most one cluster starts at a time
    peak = lo

    finishes = []           # heap of (finish second, cluster id)
    queue = deque()
    i, n = 0, len(queries)
    max_wait = total_wait = 0
    t = t0
    while i < n or queue or finishes:
        # the next second at which anything can change
        cand = []
        if i < n:
            cand.append(queries[i][1])
        if finishes:
            cand.append(finishes[0][0])
        if starting:
            cand.append(starting[0])
        if len(running) + (1 if starting else 0) > lo:
            for c, s in idle_since.items():
                cand.append(max(s + idle_s, t))
        t = min(cand)

        # 1. finishes free their slots
        while finishes and finishes[0][0] == t:
            _, c = heapq.heappop(finishes)
            running[c] -= 1
            if running[c] == 0:
                idle_since[c] = t
        # 2. a starting cluster becomes ready
        if starting and starting[0] == t:
            c = starting[1]
            running[c] = 0
            idle_since[c] = t
            starting = None
        # 3. arrivals join the queue
        while i < n and queries[i][1] == t:
            queue.append(queries[i])
            i += 1
        # 4. dispatch to the lowest-numbered ready cluster with a free slot
        if queue:
            for c in sorted(running):
                while queue and running[c] < slots:
                    _qid, arrival, duration = queue.popleft()
                    w = t - arrival
                    total_wait += w
                    if w > max_wait:
                        max_wait = w
                    running[c] += 1
                    idle_since.pop(c, None)
                    heapq.heappush(finishes, (t + duration, c))
                if not queue:
                    break
        # 5. scale out, one starting cluster at a time
        if queue and starting is None and len(running) < hi:
            starting = (t + startup, next_id)
            started[next_id] = t
            next_id += 1
            peak = max(peak, len(running) + 1)
        # 6. scale in, highest number first, never below min_clusters
        if idle_since:
            for c in sorted(idle_since, reverse=True):
                if len(running) + (1 if starting else 0) <= lo:
                    break
                if t - idle_since[c] >= idle_s:
                    del idle_since[c]
                    del running[c]
                    billed += max(60, t - started.pop(c))
    for c, s in started.items():          # everything still on stops when the last query ends
        billed += max(60, t - s)
    credits = round(billed * policy["credits_per_hour"] / 3600, 3)
    return (max_wait, total_wait, peak, billed, credits)
```

**Explanation.** The rules are written per second, but state changes only at four kinds of second: an arrival, a finish, the starting cluster becoming ready, and an idle cluster reaching `idle_s`. The loop jumps to the smallest of those and applies the six steps in order. Finishes live in a min-heap. At most one cluster is starting, so it is one value. Idle deadlines are found by scanning the at most ten ready clusters, and only while there are more than `min_clusters` clusters, because otherwise none can shut down. Two facts keep this correct. First, a cluster is never idle while the queue is non-empty, because an idle ready cluster has a free slot and dispatch would give it the head. So a scale-out never happens while an idle cluster is waiting for its deadline, and a deadline that was blocked by `min_clusters` cannot become live again later. Second, the last iteration is the last finish, so every cluster still on stops then. Packing onto the lowest number is what makes high-numbered clusters drain and shut down, and billing is per cluster start with the 60-second floor.

**Complexity.** O(n log n) for the heap plus O(max_clusters) per event, so about O(n · max_clusters) in all, and O(n) memory for the queue in the worst burst. The timing test (100 000 queries over about 30 to 50 million seconds, up to ten clusters) runs in about 0.3 s in CPython. A second-by-second loop takes over 20 s on the smallest timing test (60 000 queries over about 32 million seconds), even with a dict of finishes per second.

**Dialect notes.** In Java or C++ the same loop uses a `PriorityQueue`/`priority_queue` of (finish, cluster) and an `ArrayDeque`/`deque` for the queue. Seconds fit in 64-bit integers, and billing should stay integral until the final division. A SQL replay is possible but awkward: queueing depends on earlier dispatch decisions, so it needs a recursive CTE or a procedural loop. In a warehouse, the analyst would usually read the platform's own query history (queued time, execution time, cluster number) rather than simulate it. Not executed here.

**Edge cases built into the tests.** No queries; an arrival in the same second as a finish; a single cluster with a queue; a queued query starting the second a new cluster is ready; a long queue adding one cluster per `startup_s` up to the maximum; packing so that the extra cluster drains and scales in; the 60-second minimum for a briefly used cluster; an arrival in exactly the second a cluster reaches `idle_s`; `min_clusters` clusters that never scale in; (Very Hard) a cluster that starts but is never used and is still starting at the end, and a finish, an arrival and readiness in one second.

**Common mistakes.** Stepping second by second; dispatching to the least-loaded cluster; starting several clusters at once for a long queue; not counting the starting cluster against `max_clusters` or `min_clusters`; running scale-in before dispatch, so a cluster shuts down in the second a query arrives for it; forgetting the 60-second minimum or applying it once per warehouse rather than per cluster start; billing the initial clusters from time 0 instead of the first arrival; stopping the loop at the last arrival instead of the last finish; floating-point credits summed per cluster and rounded each time.

**Follow-up guidance.** (1) Estimate the queue's remaining work (sum of expected durations of queued queries divided by slots) and start a cluster only if it would stay busy for the threshold. Compare policies on credits and on wait percentiles over the same traces, ideally several weeks, and report the trade-off curve rather than one winner. (2) Make a query's progress depend on concurrency (processor sharing). Finish times then change whenever a cluster's load changes, so either recompute the cluster's finish times on each change or track work remaining in virtual time per cluster. The event loop still works, but finishes are no longer fixed when queries start. (3) Attribute each cluster-second to the queries running in it, in proportion to their share, and spread idle seconds and minimums by a stated rule (for example to the queries that caused the cluster to start, or pro rata by usage that hour). Any rule is a policy choice; it must be documented and sum exactly to the bill. (4) Partition by warehouse and policy, run in parallel (a batch engine or many workers), and keep summary metrics plus a sample of per-query results, not every event.

**Rubric anchors.** 2: a tick-based simulation, or one that gets the step order wrong; several edge tests fail. 3: all tests pass with an event-driven loop and correct billing. 4: also argues why only event seconds matter and why a blocked idle deadline cannot come back, and gives a convincing answer on load-dependent durations or cost attribution.

**Strong signals.** Asks which comes first in a second: finishes, arrivals or readiness; notices that packing and the 60-second minimum interact; keeps billing in integer seconds. **Red flags.** "Simulate every second, computers are fast" without estimating the span; a scaling rule invented in place of the one given.

## SNO-L2-02

**Reference solution**

```python reference
def best_join_order(tables, predicates, allow_cross=True):
    names = sorted(tables)
    n = len(names)
    if n == 0:
        return (0, [])
    pos = {t: i for i, t in enumerate(names)}
    pair = [[1] * n for _ in range(n)]       # product of the d's between two tables
    adj = [0] * n
    for a, b, d in predicates:
        i, j = pos[a], pos[b]
        pair[i][j] *= d
        pair[j][i] *= d
        adj[i] |= 1 << j
        adj[j] |= 1 << i
    full = (1 << n) - 1
    num = [1] * (full + 1)
    den = [1] * (full + 1)
    rows = [0] * (full + 1)
    for m in range(1, full + 1):
        low = m & -m
        j = low.bit_length() - 1
        rest = m ^ low
        num[m] = num[rest] * tables[names[j]]
        dd = den[rest]
        r = rest & adj[j]
        while r:
            lb = r & -r
            dd *= pair[j][lb.bit_length() - 1]
            r ^= lb
        den[m] = dd
        rows[m] = num[m] // dd                 # exact: multiply first, divide once
    single = [tables[t] for t in names]
    NONE = None
    best = [NONE] * (full + 1)                 # cheapest way to add the remaining tables to prefix set m
    best[full] = 0
    for m in range(full - 1, 0, -1):
        b = NONE
        rm = rows[m]
        free = full ^ m
        while free:
            lb = free & -free
            free ^= lb
            x = lb.bit_length() - 1
            if not allow_cross and not (adj[x] & m):
                continue
            nxt = best[m | lb]
            if nxt is NONE:
                continue
            c = rm + single[x] + rows[m | lb] + nxt
            if b is NONE or c < b:
                b = c
        best[m] = b
    first, cost = None, None
    for x in range(n):
        c = best[1 << x]
        if c is not None and (cost is None or c < cost):
            first, cost = x, c
    if first is None:
        return None
    order, m = [first], 1 << first
    while m != full:
        rm = rows[m]
        for x in range(n):                     # smallest name that stays optimal
            lb = 1 << x
            if m & lb or (not allow_cross and not (adj[x] & m)) or best[m | lb] is None:
                continue
            if rm + single[x] + rows[m | lb] + best[m | lb] == best[m]:
                order.append(x)
                m |= lb
                break
    return (cost, [names[i] for i in order])
```

**Explanation.** The cost of adding table `x` to a prefix set `P` is `rows(P) + rows({x}) + rows(P ∪ {x})`, and `rows` depends only on the set. So the cheapest way to finish a plan depends only on `P`: `best[P] = min over x ∉ P of rows(P) + rows({x}) + rows(P ∪ {x}) + best[P ∪ {x}]`, with `best[all] = 0`. Supersets have larger bitmasks, so filling masks from the full set downwards always has `best[P ∪ {x}]` ready. The answer is the best single-table start. Rebuilding the order from the front, taking the smallest name that keeps the total optimal at each step, gives the lexicographically smallest optimal order, because names are indexed in sorted order. The row estimate of every subset is computed once, from the subset without its lowest table: the numerator gains that table's rows, and the denominator gains the `d` of its predicates into the rest. Multiplying first and dividing once keeps the floor exact, and Python integers do not overflow. With cross products forbidden, a transition needs a predicate between `x` and `P`; if no start reaches the full set, the answer is `None`.

**Complexity.** O(2ⁿ · n) transitions plus O(2ⁿ · deg) to build the estimates, and O(2ⁿ) memory. For 16 tables that is about a million transitions, and the reference takes about 0.4 s in CPython (0.06 s for 14 tables). Trying every order is 16! ≈ 2·10¹³. A DP that recomputes `rows(S)` from scratch on each transition is O(2ⁿ · n · (n + E)) and runs out of time at 16 tables.

**Dialect notes.** In Java or C++ the estimates overflow 64 bits, so use `BigInteger` or 128-bit integers with care, or switch to logarithms only if exactness is not required; this question requires it. Real engines use doubles for estimates because estimates are approximate anyway, and they cap the DP with heuristics for many tables. In SQL, the plan the engine chose can be inspected with `EXPLAIN`, and the query profile shows estimated against actual rows per join. Not executed here.

**Edge cases built into the tests.** No tables; one table; two tables (a guaranteed tie broken by name); rounding down; two predicates on one pair; a selective dimension first; a cross product of two tiny dimensions as the cheapest start; the same query with cross products forbidden; a table no predicate reaches (`None` when forbidden, a plan when allowed); estimates near 10²⁷; (Very Hard) every sample with `allow_cross=False`, some disconnected.

**Common mistakes.** A greedy that adds the table giving the smallest next result; floats or `math.prod` with a true division, which changes the floor and breaks ties; rounding each multiplication step instead of once; counting the first scan; returning `None` for a disconnected query when cross products are allowed; a memo keyed by the order rather than the set; rebuilding from the end, which gives a different order on ties; iterating permutations.

**Follow-up guidance.** (1) Bushy: `best[S] = min over splits S = A ∪ B of best[A] + best[B] + cost(A, B)`, enumerating submasks, O(3ⁿ). (2) Prefer plans whose cost is flat across a range of estimates, use run-time statistics or adaptive joins, choose the join strategy at run time (for example broadcast versus partitioned once the build side's size is known), and feed observed cardinalities back. (3) Greedy or randomised search (iterative improvement, simulated annealing), or the DP on connected components and limited window sizes. Bound the gap with a lower bound, such as the sum of the cheapest possible joins, or by comparing against the exact DP on smaller sub-queries. (4) Measure actual rows on the build side and at each join; re-plan when the actual count differs from the estimate by a large factor and enough of the query is left to benefit.

**Rubric anchors.** 2: a greedy or a permutation search, or estimates in floating point that fail the exactness checks. 3: all tests pass with a subset DP and the tie rule. 4: also explains why the set function makes the DP valid, computes estimates incrementally and exactly, and handles the bushy and estimate-error follow-ups well.

**Strong signals.** Asks whether `rows(S)` depends on the order; notices the first-two-tables tie before coding. **Red flags.** "The smallest table always goes first"; no estimate of n!.

## SNO-L2-03

**Reference solution** (the fixed flattener)

```python reference
import re

_IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_SEGMENTS = {}


def _segment(key):
    if key not in _SEGMENTS:                       # keys repeat across records: decide once per key
        if _IDENT.fullmatch(key):                  # plain identifiers only; case is kept
            _SEGMENTS[key] = None
        else:
            _SEGMENTS[key] = '["' + key.replace("\\", "\\\\").replace('"', '\\"') + '"]'
    return _SEGMENTS[key]


def _walk(value, path, depth, max_depth, out):
    expand = max_depth is None or depth < max_depth          # a container at max_depth stays whole
    if isinstance(value, dict) and value and expand:
        for key, child in value.items():
            seg = _segment(key)
            if seg is not None:
                child_path = path + seg
            elif not path:
                child_path = key
            else:
                child_path = path + "." + key
            _walk(child, child_path, depth + 1, max_depth, out)
    elif isinstance(value, list) and value and expand:
        for i, child in enumerate(value):
            _walk(child, path + "[" + str(i) + "]", depth + 1, max_depth, out)
    else:
        out[path] = value                          # scalars, nulls, empty containers, depth-limited values


def flatten_records(records, max_depth=None):
    rows = []
    for record in records:
        out = {}
        for key, child in record.items():          # the record itself is never a leaf
            seg = _segment(key)
            _walk(child, key if seg is None else seg, 1, max_depth, out)
        rows.append(out)
    return rows
```

**The planted bugs, their symptoms and their fixes.**
1. **Nulls are dropped.** `elif value is not None:` skips JSON nulls, so a null field looks exactly like a missing one. Symptom: the data-quality rule "no orders have a null coupon" passes on data full of null coupons. Fix: keep `None` as a leaf.
2. **Empty objects and arrays vanish.** An empty dict or list is expanded into zero children, so its path disappears. Symptom: customers with `tags: []` drop out of the count by number of tags. Fix: treat an empty container as a leaf (`{}` or `[]`). If the fix is applied inside `_walk` as written, an empty record becomes `{"": {}}`; the specification says the record itself is never a leaf, so the record must be handled by its own loop, as in the reference. The empty-record check catches exactly this.
3. **Keys are lower-cased.** `key = key.lower()` with the comment "column names are case-insensitive". JSON keys are case-sensitive, so `id` and `ID` collide and the last one wins, and `userId` is reported as `userid`. Fix: keep the key as is. Case-folding is a decision for the column-discovery step, made with a collision rule, never silently here.
4. **Quoting only catches dots.** `_segment` quotes a key only if it contains a dot, so `ip address`, `x-ray` and `2fa` are written as if they were plain names, and a `"` inside a key is not escaped. Symptom: `geo.ip address` and `["x-ray"].on` reported as `x-ray.on`, which the discovery job reads as nested fields. Fix: quote every key that is not an ASCII identifier, and escape `\` and `"`.
5. **The depth limit is off by one.** `depth <= max_depth` expands a container at exactly `max_depth`. Symptom: one extra level of columns with a depth limit set. Fix: `depth < max_depth`.

Each bug has its own check: a null, empty containers, `id` with `ID`, keys with a space, hyphen, leading digit or quote, and two depth-limit checks. A key with a dot passes on the original code, so a candidate who tests only that case will believe quoting works.

**Explanation.** Flattening is a walk over a tree, where each node's path is its parent's path plus one segment. The specification fixes what a leaf is (scalars, nulls, empty containers, and containers at the depth limit) and how a key becomes a segment. Everything else follows from applying those two rules consistently.

**Complexity.** O(total size of the documents) time and O(size of the output) memory. Path strings are built once per node. The timing test (15 000 documents, several hundred thousand leaves) runs in about half a second in CPython. Caching each key's segment avoids repeating the identifier check for keys that occur in every record.

**Dialect notes.** In a cloud warehouse the same flattening is usually done in SQL with a lateral flatten over the semi-structured column in recursive mode, which returns a path, key, index and value per element, and the platform's own path syntax uses `:` and dots or brackets with quoted keys. Its rules for nulls (a JSON null versus SQL NULL), empty arrays (an outer flatten keeps the parent row) and case are documented per product; check current docs. In Spark, `explode` and `explode_outer` differ in the same way for empty arrays. Not executed here.

**Edge cases built into the tests.** Nested objects and arrays; nulls next to missing fields; empty objects and arrays; `id` with `ID`; a dotted key next to a nested key with the same letters; keys with a space, a hyphen and a leading digit; a quote inside a key; arrays of arrays; an empty record; a container at exactly `max_depth`; `max_depth=1`.

**Common mistakes.** Fixing nulls by keeping only `None` but still dropping `False`, `0` or `""` with an `if value:`; fixing empty containers in a way that turns an empty record into `{"": {}}`; replacing the dot check with `str.isidentifier()`, which accepts non-ASCII letters; escaping quotes but not backslashes; changing the depth rule for arrays but not objects; rewriting the function from scratch instead of making minimal fixes.

**Follow-up guidance.** (1) Infer a type per path from all values seen (the narrowest type that fits every value, with a variant or string fallback), keep the raw document, and route values that do not fit to a rejects column rather than dropping them. (2) Flatten an array into rows when consumers aggregate over its elements (line items); carry the parent's key and the array index onto each row so that it can be joined back and deduplicated. (3) Track the set of paths per source per day; a path that disappears while a similar one appears (same values, different case or separator) is a probable rename. Announce it, map both names during a transition window, and add a data contract. (4) Push the flatten into SQL over the semi-structured column for scale and pruning, and keep in code only the rules SQL cannot express well (quoting policy, collision rules, type inference), or express them as views.

**Rubric anchors.** 2: fixes two or three bugs; quoting or depth checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also notices that fixing empty containers must not make an empty record a leaf, rejects case-folding with a reason, and adds a regression test per bug.

**Strong signals.** Writes the expected paths for a small document before touching the code; asks whether `id` and `ID` can both occur. **Red flags.** "Lower-case everything to be safe"; serialising nested values to strings so the tests pass.

## SNO-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Discovery.** Bucket event notifications feed a queue for low latency. A scheduled listing of each partner's prefix (for example hourly, by the bucket's own last-modified time) is reconciled against the manifest to catch lost or delayed notifications. Both write to the same manifest, so a file found twice is recorded once.
- **Manifest (your own load history).** A table keyed by `(path, checksum)` with partner, size, first seen, load batch, status (`discovered`, `loading`, `loaded`, `rejected`, `superseded`), rows loaded and rows rejected. It never expires. It answers partner support and finance long after the platform's {{history_days}}-day history is gone.
- **Loading.** Files are batched per partner and table into loads sized for the warehouse (for example tens to hundreds of megabytes of compressed data per file, and many files per load statement) rather than one load per tiny file. Small files are merged upstream where partners allow it, or loaded through a continuous ingestion service whose cost model suits small files. Each load is a transaction on a landing table that records the file name and row number per row. A failed load is retried; the platform's load history skips files already committed, and the manifest marks the rest.
- **Row-level idempotency.** Landing is append-only with lineage. The modelled table is maintained by a `MERGE` on the partner's business key, keeping the row with the latest extract time, with the file name and row number as the deterministic tie-break. A re-sent file therefore changes nothing, a corrected file replaces exactly the rows it corrects, and a full re-send under new names is absorbed by the business key.
- **Older than the history.** The pipeline never relies on the platform's history alone: before a forced or uncertain load, the manifest decides whether the `(path, checksum)` was already loaded. A file older than the history with an unknown status is loaded into landing and deduplicated by the merge.
- **Schema drift and bad rows.** Per-partner schemas are versioned. New columns land in a semi-structured overflow column (or a rescue column) until mapped. Rows that fail parsing go to a rejects table with the file and line. One partner's drift never blocks another partner's loads.
- **Metrics and alerts.** Files discovered versus loaded per partner and hour; discovery lag (listing finds a file notifications never reported); rows rejected; duplicates suppressed by the merge; files stuck in `loading`; daily row counts per partner against a baseline; credits per loaded gigabyte.

**Competing designs to accept.** Continuous ingestion driven by notifications plus a periodic listing sweep; scheduled bulk loads by prefix and date; an external orchestrator writing the manifest; a staging area outside the warehouse that compacts small files first. Any of them is fine if file-level and row-level idempotency are separate and the manifest outlives the platform's history.

**Bottlenecks and failure modes.** Relying on the platform's load history as the only deduplication (it expires and is per table); forcing reloads; tiny files loaded one by one; notifications as the only discovery; merges without a deterministic tie rule; one partner's malformed file blocking a shared load; the manifest written outside the load's transaction, so a crash leaves it wrong.

**Incident guidance.**
- *A file from {{history_days}} days and one hour ago is re-uploaded unchanged*: the platform can no longer tell, and may skip it or load it again depending on settings. The manifest knows the `(path, checksum)` was loaded, so the pipeline records the re-upload and skips it. If it is loaded by mistake, the merge on business key keeps the table correct. Partner support is told the file was already received on its original date.
- *A re-send and revenue up 9%*: the re-sent rows reached the table additively, so the merge key or tie rule is wrong, or a downstream model reads landing rather than the merged table. Stop publication, compare the table's business keys against landing by file, fix the key (or the model that bypassed it), rebuild the affected days from landing, and add a monitor on duplicates per business key and on day-over-day totals per partner.
- *Notifications stop for six hours*: there are no errors, so the alert must be on the listing sweep finding files the notifications did not report, and on row counts per partner against baseline. The sweep loads the missing files through the same path, and the manifest shows when each file was discovered and by which route.

**Follow-up guidance.** (1) A corrected file under the same name has a new checksum, so it is a new manifest entry and loads; the merge replaces the corrected rows. A full re-send under new names loads into landing and the merge absorbs it. Prove it with business-key counts and totals per day before and after. (2) List the affected prefixes for the window, diff against the manifest, and load the difference. Completeness comes from the listing, not from the notifications. (3) The partner's loads go to rejects or the overflow column while its schema is updated. Other partners are unaffected because loads and schemas are per partner. (4) From the manifest and landing lineage, which have no expiry. (5) Batch more files per load, ask partners to send fewer, larger files, compact before loading, and size the warehouse for the load and let it suspend between loads.

**Rubric anchors.** 2: relies on the platform's load history or file names alone; appends without a merge; no plan for files older than the history. 3: a durable manifest, landing with lineage, a merge on business key, listing behind notifications. 4: also a deterministic tie rule, a stated policy for uncertain files, per-partner isolation of drift, cost-aware batching, and monitors that detect silent failures.

**Strong signals.** Separates "was this file loaded" from "is this row present" in the first minutes; asks what identifies a partner's row. **Red flags.** "Use force and dedupe later" with no deduplication key; "notifications are reliable".

## SNO-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Inventory and lineage.** Catalogue every table, pipeline, query and consumer from the legacy system's query logs and job scheduler, with owners and usage. Unused tables are retired, not migrated. Group the rest into domains (for example sales reporting, finance extracts, a product team's application) with their full lineage.
- **Order.** Start with a low-risk domain that exercises the hard parts (types, incremental loads, a few dashboards), then the high-value domains, and the most coupled ones last. Each domain moves through the same gates: copied, catching up, translated, reconciled, cut over, legacy read-only, legacy retired.
- **Copy and catch-up.** An initial bulk export to object storage and load into the cloud platform, then incremental catch-up. For append-only tables, by load date. For tables updated in place, by change capture or a modified-timestamp column where trustworthy, or by periodic snapshot comparison of partitions. Extraction runs off-peak, rate-limited, on the legacy system.
- **Translation.** An automated translator for most SQL, plus tests per query: run both sides on the same snapshot and compare results. A list of known dialect traps (NULL versus empty string, integer division, decimal scale and rounding, timestamp types and time zones, case sensitivity of identifiers and comparisons, string collation) gets its own tests.
- **Dual running and reconciliation.** While legacy is the source of truth, the cloud pipelines run on the same inputs. Reconciliation runs per table and per business date at three grains: row counts; aggregates of key measures by partition and key dimensions; and, where those disagree, a row-level hash over a canonical form (normalised decimals, timestamps in UTC, an explicit NULL token). Every difference is classified (translation, data movement, a known rule, or a legacy defect) and tracked to closure. Tolerances are per measure, documented and signed off by its owner.
- **Cutover and rollback.** Consumers read through a switchable layer (a connection profile, a DNS name, or views in a semantic layer), so a cutover is a configuration change. Each consumer is cut over after its own acceptance check, with its owner, and can be switched back within minutes while legacy stays read-only and current.
- **Switch-off.** When every consumer is cut over and stable for an agreed period, legacy stops loading, a final reconciliation runs, the data needed for audit is archived to object storage in an open format with its schema, and the system is decommissioned.
- **Reporting.** Weekly numbers: tables and consumers by gate, reconciliation pass rate and open differences by class and age, query translation coverage, parallel-running cost to date, and the forecast date per domain against {{deadline}}.

**Competing designs to accept.** A big-bang cutover for a small estate with a strong rollback plan; replicating the legacy data continuously with a CDC tool; re-platforming pipelines first and backfilling history later; rebuilding the model rather than lifting and shifting, if the candidate prices the extra risk. Each has trade-offs in risk, cost and calendar time.

**Bottlenecks and failure modes.** Extraction load on legacy; in-place updates missed by incremental copies; translations that run without errors but return different answers; reconciliation that compares row counts only; consumers owned by other teams that never test; open-ended parallel running that doubles the cost; switching off before archiving.

**Incident guidance.**
- *A 0.02% revenue difference where legacy was wrong*: classify it as a legacy defect, get finance to agree which number is right, document it, and decide whether to restate past reports. Add a reconciliation rule that expects the difference, so it is not re-raised. The lesson is that reconciliation finds differences, and people decide which side is right.
- *A reconciliation query slows the morning reports*: stop it, move reconciliation to an off-peak window with a resource limit or workload class on legacy, and run heavy comparisons from exported snapshots instead of live queries.
- *4% of consumers not cut over ten days before the deadline*: escalate with the list, owners and the consequences. Offer cutover with rollback in the remaining days, temporarily repoint untested consumers with their owners' sign-off, or agree a short, priced extension of legacy for named consumers. Never switch off silently.

**Follow-up guidance.** (1) Narrow by grain: which dates, which keys. Then compare the translated SQL against the original for rounding, filters and time zones, compare the copied source rows, and check whether legacy itself has a known defect. (2) Use change capture or an updated-at column. If neither is reliable, reconcile partitions by hash and recopy those that differ, and freeze in-place updates during the final cutover window. (3) Cut scope (retire more tables, move low-use consumers as-is), add people to translation and testing, and keep the reconciliation and rollback gates; never skip reconciliation to save time. (4) All consumers cut over and stable, no open unexplained differences, archives verified by restoring a sample, and sign-off from owners and audit. (5) The weekly numbers above, with trends.

**Rubric anchors.** 2: copy everything and switch over a weekend; reconciliation by row counts; no rollback. 3: domain-by-domain plan with lineage, catch-up, multi-grain reconciliation and reversible cutovers. 4: also classified differences with owners, dialect traps tested on purpose, cost and capacity of parallel running managed, and honest, measurable reporting.

**Strong signals.** Asks how consumers connect before planning cutover; insists that legacy can be wrong too. **Red flags.** "The translator handles it"; turning legacy off on the deadline regardless of what is left.
