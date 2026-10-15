# CoreWeave · Loop 2 — evaluator notes (hidden from candidates)

Simulated practice scenarios; every price, capacity, volume and rule is hypothetical
and "this exercise's rule; check current docs".

## CRW-L2-01

**Reference solution**

```python reference
def accept_reservations(horizon, capacity, ops):
    # Headroom per hour = capacity in force - GPUs booked. A request fits when the
    # minimum headroom over its hours is at least its size. Iterative lazy segment
    # tree: t[i] is the minimum of node i's range including adds stored at i and
    # below; d[i] is an add still owed to i's children.
    n = max(1, horizon)
    h = n.bit_length()
    INF = float("inf")
    t = [INF] * (2 * n)
    d = [0] * n
    steps = sorted(capacity)
    k, cap = 0, 0
    for hour in range(horizon):
        while k < len(steps) and steps[k][0] <= hour:
            cap = steps[k][1]
            k += 1
        t[n + hour] = cap
    for i in range(n - 1, 0, -1):
        a, b = t[2 * i], t[2 * i + 1]
        t[i] = a if a < b else b

    def push(p):                          # settle the owed adds on the path to leaf p
        for s in range(h, 0, -1):
            i = p >> s
            v = d[i]
            if v:
                c = 2 * i
                t[c] += v
                t[c + 1] += v
                if c < n:
                    d[c] += v
                    d[c + 1] += v
                d[i] = 0

    def pull(p):                          # recompute the ancestors of p
        while p > 1:
            p >>= 1
            a, b = t[2 * p], t[2 * p + 1]
            t[p] = (a if a < b else b) + d[p]

    def range_min(l, r):
        l += n
        r += n
        push(l)
        push(r - 1)
        res = INF
        while l < r:
            if l & 1:
                if t[l] < res:
                    res = t[l]
                l += 1
            if r & 1:
                r -= 1
                if t[r] < res:
                    res = t[r]
            l >>= 1
            r >>= 1
        return res

    def range_add(l, r, v):
        l += n
        r += n
        l0, r0 = l, r
        while l < r:
            if l & 1:
                t[l] += v
                if l < n:
                    d[l] += v
                l += 1
            if r & 1:
                r -= 1
                t[r] += v
                if r < n:
                    d[r] += v
            l >>= 1
            r >>= 1
        pull(l0)
        pull(r0 - 1)

    active = {}                           # rid -> (start, end, gpus) while accepted
    out = []
    for op in ops:
        if op[0] == "cancel":
            res = active.pop(op[1], None)
            if res is None:
                out.append(False)
            else:
                range_add(res[0], res[1], res[2])
                out.append(True)
            continue
        _, rid, start, end, gpus = op
        if not (0 <= start < end <= horizon) or gpus <= 0 or range_min(start, end) < gpus:
            out.append(False)
            continue
        range_add(start, end, -gpus)
        active[rid] = (start, end, gpus)
        out.append(True)
    return out
```

**Explanation.** Turn the question around: instead of GPUs booked, keep headroom per hour, the capacity in force minus the GPUs booked. A request for `g` GPUs over `[start, end)` fits exactly when the minimum headroom in that range is at least `g`. Accepting it subtracts `g` from every hour of the range, and cancelling adds it back. So the book needs two range operations, minimum and add, and a segment tree with lazy adds does both in O(log T). The leaves start at the capacity steps, which handles planned additions and reductions (including a step to 0) with no special case. Rejected requests touch nothing, and the `active` map makes a cancellation of anything that is not currently accepted a no-op that returns `False`. This version is the bottom-up tree: an add marks the O(log T) boundary nodes and recomputes their ancestors, and a query first pushes owed adds down the two boundary paths, then reads the covering nodes.

**Complexity.** O(T) setup and O(log T) per op, O(T) memory. The timing test (60 000 ops on a 52 560-hour book, requests 13 000 to 39 000 hours long) runs in about 0.8 to 0.9 s in CPython. A recursive lazy segment tree is about twice as slow and still passes. Checking and updating every hour in Python (`for h in range(start, end)`) takes about 37 to 47 s, 45 to 55 times the reference: it breaks early on a full hour when it rejects, but accepted requests and their updates walk tens of thousands of hours.

**The middle approach.** The likely middle answer keeps a list of headroom per hour, checks with `min(head[start:end]) >= g`, and updates with a Python loop or a list comprehension over the slice. The minimum runs at C speed, but the slice copy and the minimum still touch every hour of the range, and requests here cover tens of thousands of hours, so the check alone is O(length) per request. Measured on the timing test, it takes about 26 to 31 s (30 to 40 times the reference), well over the 8 s limit, whether the update is a loop or a comprehension. A block decomposition (blocks of about 230 hours, each with a lazy add and a block minimum, partial blocks handled with slices) is O(√T) per op and passes: measured at about 0.9 s on the timing test, close to the tree, because the partial blocks run at C speed. It is another correct sublinear method and an acceptable answer; ask for its cost per op and how the block size was chosen. A sorted list of accepted intervals does not answer "busiest hour in this range" without a sweep and is O(active) per request.

**Dialect notes.** In Java or C++ the same tree is arrays of `long` (or `int` with a stated bound). In SQL a reservation check is `SELECT min(capacity - booked) FROM hours WHERE hour >= :start AND hour < :end` on an hourly table; it is correct with row locks or serialisable isolation, but it scans the whole range for every request and the update touches every hour row. A real service would keep the book in memory per pool, serialise decisions per pool, and persist an append-only log of accepted and cancelled reservations. Not executed here.

**Edge cases built into the tests.** An hour brought exactly to capacity (accepted); one GPU over in a single hour (rejected) while the next request just after it fits; half-open ranges on both sides; a rejected request that books nothing; a request covering the whole book; many small requests filling one hour until the last is rejected. Hard adds a cancellation that frees hours for a later request, cancelling a rejected id, an unknown id and the same id twice, and malformed requests (empty range, end past the book, start below 0, zero GPUs). Very Hard adds a planned reduction inside a request's range, a planned addition that only helps from its hour on, and a step to 0 for a decommissioned hall.

**Common mistakes.** Treating `end` as inclusive; booking a rejected request; cancelling by id without checking it is still active, so a second cancellation adds capacity that never existed; a lazy tree whose query forgets owed adds; a tree built over the hours with booked counts but compared against one capacity instead of the step in force; malformed ranges that crash the tree (`start == end`) instead of being rejected.

**Follow-up guidance.** (1) The largest size that fits is `range_min(start, end)`, already computed for the check, capped at 0. (2) Descend the tree for the first position at or after `start` where a window of the duration has minimum headroom at least `g`: with a min tree, find the first hour below `g` inside the window and jump past it; each jump costs O(log T) and the number of jumps is bounded by the blocking hours. Interviewers should accept a clear argument for the jump approach. (3) A stated rule (price first, then region with more headroom, then a fixed order), recorded with the decision and the headroom seen, so it can be explained later. (4) Serialise decisions per pool (one writer per pool, or optimistic concurrency with a version per pool), write each decision to a durable log before answering, and rebuild the tree from the log on restart; submission order needs a sequencer per pool.

**Rubric anchors.** 2: a per-hour loop or slice scan, or half-open ranges or cancellations wrong. 3: all tests pass with a lazy segment tree (or a measured block decomposition) and correct cancellation handling. 4: also explains why the owed adds must be pushed or accounted for, answers largest fit and earliest start with the same structure, and gives a credible concurrency design.

**Strong signals.** Rephrases the check as a minimum of headroom before choosing a structure; asks whether `end` is exclusive and whether partial acceptance is allowed. **Red flags.** "The minimum over a slice is fast because it is built in"; cancelling a rejected reservation and returning capacity.

## CRW-L2-02

**Reference solution**

```python reference
def interconnect_plan(clusters, links, existing=()):
    idx = {c: i for i, c in enumerate(clusters)}
    parent = list(range(len(clusters)))
    size = [1] * len(clusters)

    def find(v):
        while parent[v] != v:
            parent[v] = parent[parent[v]]          # path halving
            v = parent[v]
        return v

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return False
        if size[ra] < size[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        size[ra] += size[rb]
        return True

    groups = len(clusters)
    for a, b in existing:                          # links the customer already has: free
        if union(idx[a], idx[b]):
            groups -= 1
    usable = sorted((cost, lid, idx[a], idx[b]) for lid, a, b, cost in links
                    if a != b and a in idx and b in idx)
    chosen, total = [], 0
    for cost, lid, u, v in usable:                 # (cost, link id): a strict order
        if groups <= 1:
            break
        if union(u, v):
            groups -= 1
            chosen.append(lid)
            total += cost
    if groups > 1:
        return None
    return (total, sorted(chosen))
```

**Explanation.** The cheapest set of links that joins every cluster is a minimum spanning tree. Kruskal's algorithm takes links in increasing order and keeps a link exactly when it joins two groups that are not yet joined; union-find answers that in near-constant time. The tie rule makes the order strict: with `(cost, link_id)` as the key no two links compare equal, so the minimum spanning tree under that order is unique and is also one of the cheapest plans by cost. Kruskal with that key returns it. Existing links are unioned first at no cost, which is the same as giving them a key below every purchasable link; they never appear in the answer. Self-links and links naming unknown clusters are filtered before sorting. If more than one group remains after all links, no plan exists.

**Complexity.** O(E log E) for the sort and O(E α(V)) for the unions, O(V + E) memory. The timing test (8 000 clusters, 100 000 links) runs in about 0.2 s in CPython; at 20 000 clusters and 200 000 links it takes about 0.7 s. Adding links in order with a breadth-first search over the chosen links for every candidate takes about 5 s already at 2 000 clusters and 20 000 links and grows with V·E: at the test size it took about 116 s, some 500 times the reference.

**The middle approach.** Prim's algorithm with a heap keyed `(cost, link_id, neighbour)` is the likely alternative. It is also O(E log V), measured at about 0.25 s on the timing test (0.8 to 0.9 s at 20 000 clusters and 200 000 links), so it passes, and it returns exactly the same plan: under a strict order the minimum spanning tree is unique, so any correct algorithm comparing by the same key finds it. Accept it, but check the key: a heap keyed by cost alone breaks ties by whatever comes next in the tuple and can choose a different equal-cost plan. With existing links, Prim needs them keyed below every real link (or the clusters they join merged first). Kruskal with component labels relabelled smaller-into-larger, instead of union-find, is O(E log E + V log V) and also fine.

**Dialect notes.** In Java, sort an array of edges with a comparator on `(cost, id)` and use an `int[]` parent array; in C++ the same with `std::sort` and a DSU. A minimum spanning tree is not expressible as a single set-based SQL query; recursive CTEs can follow edges but cannot express "skip a link if its ends are already joined" without a procedural loop, and graph libraries (for example a graph extension or a Spark graph library) provide it as a built-in. Not executed here.

**Edge cases built into the tests.** Two parallel links of equal cost (the smaller id); a triangle of equal costs (the two smallest ids); a cheap link that closes a cycle; one cluster and no links (`(0, [])`); a graph where each cluster's cheapest link leaves two groups. Hard adds a self-link and a link to an unknown cluster that are cheapest of all and must be ignored, parallel links where the cheaper one wins and then the smaller id, two groups with no link between them (`None`), and a cluster whose only link is to itself (`None`). Very Hard adds an existing link that makes a purchase unnecessary, existing links that already join everything (`(0, [])`), and an existing link that changes which equal-cost links are bought.

**Common mistakes.** Sorting by cost only, so ties depend on input order; comparing ids as numbers after stripping a prefix, or as strings when they are not padded; returning ids in the order chosen; counting existing links in the total or returning them; crashing on a link to an unknown cluster; returning a partial plan instead of `None`; using a shortest-path tree from one cluster.

**Follow-up guidance.** (1) Survivable networks need every cluster pair joined by two link-disjoint paths: a minimum 2-edge-connected spanning subgraph, which is NP-hard in general. Good answers propose the tree plus the cheapest link that closes a cycle around each tree link (a heuristic), or an integer program for small cases, and say so plainly. (2) A cheaper link: add it to the tree, find the most expensive link on the cycle it closes (path in the tree between its ends), and drop that link if it is more expensive (or equal with a larger id). A more expensive link that is in the tree: remove it, and reconnect the two halves with the cheapest crossing link. (3) Capacities and demands make it a network design or multi-commodity flow problem; the spanning tree may concentrate traffic on one link. Approaches: start from the tree and add capacity where flows exceed it, or solve a mixed-integer program. (4) A diameter bound makes the problem NP-hard (bounded-diameter spanning tree); in practice, pick a hub cluster or two and build around them, and measure the cost of the constraint.

**Rubric anchors.** 2: a search per link, or the tie rule ignored so equal-cost inputs give different answers. 3: all tests pass with Kruskal and union-find (or Prim with the right key), existing links and `None` handled. 4: also argues the cut property for why the greedy choice is safe, explains why the strict order makes the plan unique, and handles cost updates and redundancy concretely.

**Strong signals.** Notes immediately that a cheapest plan has no cycles; asks how ties are broken before coding. **Red flags.** "Run Dijkstra from the first cluster"; returning a plan whose cost depends on the input order.

## CRW-L2-03

**Reference solution** (the fixed calculator)

```python reference
from datetime import datetime


def _parse(ts):
    return datetime.fromisoformat(ts)


def _next_month(dt):
    """The first instant of the calendar month after dt (UTC)."""
    if dt.month == 12:
        return dt.replace(year=dt.year + 1, month=1, day=1, hour=0, minute=0, second=0)
    return dt.replace(month=dt.month + 1, day=1, hour=0, minute=0, second=0)


def _price_rows(prices):
    by_type = {}
    for p in prices:
        by_type.setdefault(p["gpu_type"], []).append((_parse(p["from"]), p["cents_per_hour"]))
    for rows in by_type.values():
        rows.sort()
    return by_type


def _rate_at(rows, when):
    """(start of the price period, on-demand cents per GPU-hour) in force at when."""
    found = None
    for since, cents in rows:
        if since <= when:
            found = (since, cents)
    return found


def monthly_invoice_lines(runs, prices, reservations):
    rows_by_type = _price_rows(prices)
    usage = {}                    # line key -> {price period start: [gpu_seconds, cents_per_hour]}
    for run in runs:
        start, end = _parse(run["start"]), _parse(run["end"])
        rows = rows_by_type[run["gpu_type"]]
        cuts = [since for since, _ in rows if start < since < end]      # price amendments
        m = _next_month(start)
        while m < end:                                                  # month boundaries
            cuts.append(m)
            m = _next_month(m)
        cuts.sort()
        a = start
        for b in cuts + [end]:
            seconds = int((b - a).total_seconds()) * run["gpus"]        # every second, days included
            month = a.strftime("%Y-%m")                                 # the piece's month
            since, rate = _rate_at(rows, a)                             # the piece's price
            key = run["customer"] + "|" + month + "|" + run["gpu_type"]
            cell = usage.setdefault(key, {}).setdefault(since, [0, rate])
            cell[0] += seconds
            a = b

    lines = {}
    for key in sorted(usage):
        customer, month, gpu_type = key.split("|")
        res = reservations.get(customer + "|" + gpu_type, {"hours": 0, "cents_per_hour": 0})
        remaining = res["hours"] * 3600                                 # every month starts full
        line = {"gpu_seconds": 0, "reserved_seconds": 0, "on_demand_seconds": 0, "amount_cents": 0}
        exact = 0                                                       # cent-seconds per hour, exact
        for since in sorted(usage[key]):                                # earliest price period first
            seconds, rate = usage[key][since]
            covered = min(seconds, remaining)
            remaining -= covered
            line["gpu_seconds"] += seconds
            line["reserved_seconds"] += covered
            line["on_demand_seconds"] += seconds - covered
            exact += covered * res["cents_per_hour"] + (seconds - covered) * rate
        line["amount_cents"] = (exact + 1800) // 3600                   # once, half up
        if line["gpu_seconds"]:
            lines[key] = line
    return lines
```

**The planted bugs, their symptoms and their fixes.**
1. **`timedelta.seconds` drops whole days.** `(b - a).seconds` is only the seconds part of the difference, between 0 and 86 399. Symptom: a three-day training job is billed for a few hours. Fix: `int((b - a).total_seconds())`.
2. **Reserved hours carried across months.** The remaining allowance lives in `left`, keyed by customer and GPU type only, so a month starts with whatever the previous month left. Symptom: a customer's reserved hours run out in their second month and the rest is billed on demand. Fix: start each line (which is one month) with `hours × 3600`.
3. **A piece priced at the run's start.** `_rate_at(rows, start)` uses the run's start for every piece. Symptom: a run across a mid-month amendment is billed entirely at the old price. Fix: use the piece's start `a`.
4. **A piece billed to the run's month.** `start.strftime("%Y-%m")` puts every piece in the month the run started. Symptom: the first hours of a month appear on the previous month's invoice. Fix: `a.strftime("%Y-%m")`.
5. **Rounding per part, half to even.** Each period's reserved and on-demand amounts are rounded separately with `round()` on a float, which also rounds 2.5 to 2. Symptom: totals a cent off from the customer's own calculation, in either direction. Fix: keep the exact integer `Σ seconds × rate` for the line and round once with `(exact + 1800) // 3600`.

Each bug has its own check in which the others do not show: a run of two days and three hours inside one month with no reservation (bug 1); the same customer using 8 of 10 reserved hours in two consecutive months, short runs, no amendment (bug 2); a run across an amendment, no reservation (bug 3); a run across a month end at one price (bug 4); a 36-second run at 250 cents per hour, which is exactly 2.5 cents, and two runs on either side of an amendment worth 0.4 cents each (bug 5). Three checks pass on the original code and stay as regression checks: reserved hours covering the earliest price period first, separate reservations per GPU type, and a zero-length run. Random samples can hit several bugs at once.

**Explanation.** An invoice line is three decisions applied to each piece of a run: how long it was (every second), which month and which price it belongs to (both decided by when the piece happened, so the run is cut at month ends and amendments), and how the month's reserved hours are applied (full every month, earliest price period first). The amount is then one exact integer divided once. Each bug breaks exactly one of those decisions.

**Complexity.** O(R · (P + M)) for R runs, P price rows per type and M months spanned, then O(lines · periods) to price. The timing test (50 000 or 100 000 runs over six months) runs in about 0.5 s in CPython, most of it parsing timestamps. A bisect into the price rows makes `_rate_at` O(log P) if a type has many amendments.

**Dialect notes.** In SQL, split runs at month starts and amendment times with a join to a calendar of boundaries (or `generate_series` in PostgreSQL), compute `extract(epoch from least(end, next) - greatest(start, prev))` per piece, and allocate reserved hours with a running sum per line ordered by period (`sum(...) over (partition by line order by period_start)`). PostgreSQL's `round(numeric)` rounds half away from zero, which matches half up for positive amounts; BigQuery's `ROUND` does too, while Python's `round` and Spark's `bround` round half to even. Snowflake's `DATEDIFF('second', …)` counts boundaries crossed, which is right for whole-second timestamps. Not executed here.

**Edge cases built into the tests.** A run longer than a day; two months of reserved usage; a run across an amendment; a run across a month end (December into January in some seeds); exactly half a cent; two fractional parts that only round up together; reserved hours covering the earlier price period; reservations per GPU type and none for another type; a zero-length run.

**Common mistakes.** Fixing bug 1 with `.days * 86400 + .seconds` but forgetting microseconds in other data; resetting the allowance per run instead of per month; fixing the price lookup but still keying the month by the run's start; replacing `round` with `math.ceil` or with `Decimal` but still rounding each part; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Every line of the affected type in that month changes; reissue the month's lines as a correction with the old and new amounts, and keep the amendment's announcement time so finance can explain it. (2) Store the pieces: run id, piece start and end, price row, reserved or on-demand, GPU-seconds, and the exact amount before rounding. Support can then sum them to the cent. (3) Call a month final after the stated lateness plus a margin; after that, late usage goes on the next invoice as a dated adjustment, never by silently changing an issued one. (4) Convert usage of each type to a common unit at stated rates and apply the pool in a stated order (earliest usage first, or the most expensive type first); the order changes the bill, so it must be written down and shown on the invoice.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also names the decision each bug breaks, keeps the amount as an exact integer, adds a regression test per bug, and answers the backdated-amendment and dispute follow-ups concretely.

**Strong signals.** Runs the two-day run by hand before reading the loop; asks how half a cent is rounded and whether reserved hours roll over. **Red flags.** "Round each line item, that is what customers see"; using floats for the amount "because the rates are per hour".

## CRW-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Log records.** Each gateway writes request records `(request_id, gateway_id, ts, bucket_id, request_kind GET|PUT|LIST|DELETE|COPY…, storage_class, bytes_in, bytes_out, object_size_after, status)` in batches named `(gateway_id, epoch, sequence)`. The epoch changes whenever a gateway restarts, so a sequence reset never collides with an old batch. Object keys are not logged in the billing stream; if operations need them, they go to a separate, access-controlled log with its own retention.
- **Ingestion.** Batches land in object storage and are registered in a batch ledger keyed by `(gateway_id, epoch, sequence)` with a content hash. A batch already in the ledger with the same hash is a no-op; with a different hash it is quarantined and alerts. Gaps in sequence numbers are visible per gateway, which is how lateness is measured.
- **Daily request and egress totals.** Additive per `(customer, bucket, storage_class, request_kind, status_class, day)`, where the day comes from `ts` in UTC. A late batch triggers a rebuild of that day's partition from all batches for the day (idempotent), never an increment.
- **Stored bytes.** A per-object size ledger keyed by `(bucket_id, object_id)` holds `(size, class, valid_from, valid_to)`; PUTs, overwrites, class changes and deletes close the old interval and open a new one. Byte-hours per day come from the intervals, so a lifecycle move overnight counts each class only for the hours the bytes were in it. A daily bucket inventory reconciles the ledger; differences above a threshold alert and are investigated before the month closes.
- **Finality and corrections.** A day is provisional until {{late_hours}} hours plus a margin have passed and every gateway's sequence is gap-free (or the gap is explained). Final days are versioned; a later batch produces a correction record against the day, which flows to the invoice as an adjustment.
- **Customer view.** Usage tables are partitioned by customer and served through an API scoped to the caller's customer id; customers see the same numbers the invoice uses, marked provisional or final.

**Competing designs to accept.** Stored bytes from daily inventories only (accept with a clear rule such as end-of-day snapshot and its known blind spots); a streaming pipeline with exactly-once sinks keyed by batch id; billing directly from the storage service's metadata database instead of logs. All are fine if duplicates cannot bill twice, late data lands on its day and the stored-bytes definition is explicit.

**Bottlenecks and failure modes.** Sequence numbers that reset on restart; counters incremented per batch instead of rebuilt partitions; stored bytes computed from PUT sizes without the overwritten size; days keyed by arrival time; huge buckets with hot partitions in the size ledger; object keys leaking into analytics.

**Incident guidance.**
- *A gateway's sequence reset to 1*: the ledger keyed only by sequence drops new batches as duplicates. With content hashes the mismatch is caught; recover the quarantined batches, add the epoch to the batch identity, rebuild the affected days, and alert on hash mismatches and on a gateway whose sequence goes backwards.
- *{{late_hours}} hours of batches at once after an outage*: the batches land on their own days and those partitions are rebuilt. Customers who looked earlier see changed numbers, so the view must show provisional days, and the change is logged. Check that the rebuild capacity handles one site's backlog without delaying everyone else's day.
- *A lifecycle move counted in both classes all day*: byte-hours from the size ledger split the day at the move time; if the design used end-of-day snapshots plus a start-of-day snapshot, fix the definition, rebuild the day and issue corrections for affected customers before the invoice.

**Follow-up guidance.** (1) Compare each gateway's timestamps with batch arrival and with other gateways; flag drift, correct with the measured offset, and rebuild the two affected days (the drifted and the next). (2) With byte-hours, the move day counts the bytes in each class for the hours they were there; with snapshots, say which snapshot wins and why. (3) Never change an issued invoice; add a dated adjustment to the next one and show the original day. (4) Ingestion parallelises per gateway; the size ledger is usually the bottleneck (partition by bucket and object hash, compact daily), and daily rebuilds should be per customer partition.

**Rubric anchors.** 2: counters incremented as batches arrive, no batch identity, or stored bytes from PUT sizes only. 3: idempotent batch ingestion, event-time days with partition rebuilds, a stated stored-bytes definition, finality and corrections. 4: also the restart-safe batch identity, byte-hours from a size ledger reconciled with inventories, provisional versus final days in the customer view, and no object keys in billing data.

**Strong signals.** Asks what "stored bytes per day" means before designing; treats overwrites and class changes as state changes. **Red flags.** "Count the PUT bytes"; "deduplicate by timestamp".

## CRW-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** Request events `(request_id, customer_id, region, gpu_type, nodes_requested, event, ts, seq)` for created, capacity-wait started and ended, cancelled, partially accepted and ready; node events `(request_id, node_id, stage allocated|imaging|imaged|health_checking|healthy|joined|failed|replaced, attempt, ts, reason)`. Each component stamps events with a per-node attempt number and a monotonic sequence, so retries and replays are recognisable.
- **State model.** A node's state machine allows forward moves and explicit retries (a failed health check moves the node back to imaging with `attempt + 1`). An event is applied only if its `(attempt, stage order)` is ahead of the stored state; replays and stale events are dropped and counted. The request's state is derived from per-stage node counts plus request-level events, never stored as a separate truth.
- **Current state.** A table keyed by `request_id` holds the counts per stage, the time of the last forward progress, the deliberate-wait flag and any failure reasons; it is updated by a stream job partitioned by `request_id`, so one request's events are processed in order. The status page reads one row per request, whatever its node count.
- **Stuck detection.** A scheduled scan (every minute) finds requests where `now − last_progress > {{stuck_minutes}} minutes`, not in a deliberate wait and not cancelled; per-node stuck detection finds nodes in one stage beyond that stage's expected time. Alerts group by region and stage, so one regional problem is one page.
- **Customer status.** Counts per stage, the time of last progress, an expected-time range from history, and a plain reason for failed nodes, scoped to the customer's own requests through the API.
- **Reports.** An append-only event log in the warehouse, and a request fact table `(request_id, region, gpu_type, nodes, created_at, ready_at, outcome ready|partial|cancelled|failed, time_in_wait, time_per_stage)`. Weekly time-to-ready percentiles are computed for ready requests, with partial and cancelled counted alongside, and with deliberate waiting time reported separately.

**Competing designs to accept.** Event sourcing with periodic snapshots; a workflow engine whose history is the source of truth, exported for analytics; status computed on read from node rows (accept if it is bounded and cached for large pools). All are fine if transitions are idempotent, state never goes backwards on stale events, and stuck detection is progress-based.

**Bottlenecks and failure modes.** Per-node lookups to render a status page; ordering by arrival time; deriving "stuck" from "no events" so heartbeats hide stalls; alerts on deliberate waits; percentiles that silently drop cancelled requests; events for one node split across partitions.

**Incident guidance.**
- *Nodes marked imaged twice, status jumping back*: the second "imaged" event for the same attempt is stale and must be dropped; status jumped back because state was taken from the latest event by arrival. Fix the apply rule, rebuild current state from the log, and add a monitor for dropped stale events and for any request whose derived stage decreases.
- *Stuck alerts on correct capacity waits, muted overnight*: the detector did not know about deliberate waits. Add the capacity-wait events to the state, exclude them from stuck detection (with their own long-wait alert), and replace the blanket mute with the corrected rule so real stalls still page.
- *One node of {{max_nodes}} never passes health checks; 99% for {{stuck_minutes}} minutes*: per-node stuck detection should have fired; the status page should name the failing node's stage and reason, offer replacement or partial acceptance, and the replacement policy should start automatically after a stated number of attempts.

**Follow-up guidance.** (1) Replayed results have attempt numbers and sequences already applied, so they are dropped and counted; nothing changes for customers. (2) Use historical stage durations per region, GPU type and pool size to give a range (p50 to p90), say which stage the request is in, and widen the range when capacity is constrained. (3) Break time to ready into time per stage from the fact table, compare with the previous week by region, and drill into the stage that grew (for example imaging queue time). (4) The stream job and the current-state store scale by partitioning on `request_id`; large pools generate bursts of node events, so batch updates per request; the warehouse log is append-only and partitioned by day.

**Rubric anchors.** 2: state from the latest event by arrival, or stuck detection by "no events". 3: per-node state machines with idempotent transitions, derived request state, progress-based stuck detection, a status page with one lookup per request, report tables. 4: also deliberate waits modelled, attempts and retries explicit, percentiles that state how cancelled and partial requests are treated, and a plan for each incident.

**Strong signals.** Defines the state machine and its allowed backward moves before choosing technology; asks how a customer-accepted partial cluster is recorded. **Red flags.** "The status page queries every node"; "alert if no event for N minutes".
