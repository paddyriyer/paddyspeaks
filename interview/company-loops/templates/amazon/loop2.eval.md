# Amazon · Loop 2 — evaluator notes (hidden from candidates)

## AMZ-L2-01

**Reference solution**

```python reference
def plan_shipments(items, centres, max_items=None):
    n = len(items)
    pos = {sku: i for i, sku in enumerate(items)}
    INF = 1 << 62
    # one package: key = cost * 64 + packages, so integer order is (cost, packages)
    single = [INF] * (1 << n)
    stocked = 0
    for _cid, package_cost, units in centres:
        bits = [(pos[sku], c) for sku, c in units.items() if sku in pos]
        k = len(bits)
        mask_of = [0] * (1 << k)
        cost_of = [0] * (1 << k)
        for s in range(1, 1 << k):
            low = s & -s
            j = low.bit_length() - 1
            mask_of[s] = mask_of[s ^ low] | (1 << bits[j][0])
            cost_of[s] = cost_of[s ^ low] + bits[j][1]
            if max_items is not None and bin(s).count("1") > max_items:
                continue
            key = (package_cost + cost_of[s]) * 64 + 1
            g = mask_of[s]
            if key < single[g]:
                single[g] = key
        if k:
            stocked |= mask_of[(1 << k) - 1]
    full = (1 << n) - 1
    if stocked != full:
        return None
    best = [INF] * (1 << n)
    best[0] = 0
    for mask in range(1, full + 1):
        low = mask & -mask              # the lowest item must be in some package
        rest = mask ^ low
        sub = rest
        b = INF
        while True:
            s = sub | low
            v = single[s]
            if v < INF:
                w = v + best[mask ^ s]
                if w < b:
                    b = w
            if sub == 0:
                break
            sub = (sub - 1) & rest
        best[mask] = b
    total = best[full]
    return (total >> 6, total & 63)
```

**Explanation.** First compute, for every subset of the order's items, the cheapest single package that carries exactly that subset (`single`). For each centre, enumerate the subsets of the items it stocks, building each subset's mask and unit-cost sum from the subset without its lowest bit. A subset larger than `max_items` cannot be one package. Then `best[mask]` is the cheapest way to ship `mask`. The lowest item of `mask` must be in some package, so try every package `s` that contains it and add `best[mask ^ s]`. Fixing the lowest item means each partition is counted once. The pair (cost, packages) is packed as `cost * 64 + packages`. Packages never exceed 13, so integer order equals tuple order, and the sum of two packed values is the packed sum. That gives the "fewest packages on a cost tie" rule for free. An item that no centre stocks makes the order impossible, which is checked before the DP. An empty order returns `(0, 0)` because `best[0] = 0`.

**Complexity.** Precomputation is O(Σ 2^kᶠ) over centres, where kᶠ is the number of order items centre f stocks, so at most O(m · 2ⁿ). The DP is O(3ⁿ⁻¹) with the lowest-item trick, about 531 000 steps for n = 13. The timing test (13 items, 40 centres) runs in about 0.15 s in CPython. Trying every assignment is up to 40¹³. A DP that loops over centres inside the submask loop is O(m · 3ⁿ). That is about 40 times slower and close to the limit in a browser runtime.

**Dialect notes.** In Java, Scala or C++ the same bitmask DP uses `int` masks and `long` packed keys. Watch the sentinel: adding two "infinite" values must not overflow, so use a sentinel well below the type's maximum or test feasibility first. A SQL formulation over subsets is impractical. A planner in production would use a MIP solver or heuristics, not SQL. Not executed here.

**Edge cases built into the tests.** One centre stocks everything; splitting is cheaper because each centre is cheap for half the items; consolidating is cheaper because the package cost dominates; a cost tie broken by fewer packages; an item stocked by no centre (`None`); an empty order (`(0, 0)`); unit cost 0; (Very Hard) a box limit forcing three packages from one centre, exactly `max_items` items in one package, and a box limit that makes a second centre worthwhile.

**Common mistakes.** Greedy per item (ignores the package cost); choosing a set of centres and sending each item to its cheapest open centre, which is correct without a box limit but cannot model several packages from one centre and is exponential in m; assuming each centre sends at most one package when `max_items` is set; ignoring the tie rule; returning `None` for an empty order; `float('inf')` sentinels that turn the result into a float; iterating all submasks without fixing the lowest item (correct, about 3 times slower); exploring all assignments.

**Follow-up guidance.** (1) A per-package penalty just adds to `package_cost`. A hard limit on packages adds a dimension: `best[mask][k]`, or keep the pair and take the cheapest with packages ≤ K. (2) Shared stock couples orders. Planning orders in sequence is greedy and can starve later orders. Batch assignment with a min-cost flow or an integer programme over a short window, reserving stock as you go, is the usual direction. (3) Add the date as a constraint: drop packages whose centre cannot meet the promise, or carry the latest package date in the state. (4) Use heuristics, for example a greedy plan improved by local search that moves an item between packages, or a MIP with a time limit. Measure the gap against the DP on a sample of small orders, or against a lower bound such as the sum of each item's cheapest unit cost plus one package cost.

**Rubric anchors.** 2: a greedy or a brute force that is correct only on small inputs, or one that misses the tie rule or `None`. 3: all tests pass with a subset DP and a correct box limit. 4: also packs or compares the pair cleanly, explains why the lowest-item trick avoids counting a partition twice, and handles the shared-stock and delivery-date follow-ups convincingly.

**Strong signals.** Notices that one centre may need two packages under a box limit; asks whether costs are integers; states the 3ⁿ bound before coding. **Red flags.** Per-item greedy defended as "close enough" with no counterexample considered; enumerating assignments without estimating their number.

## AMZ-L2-02

**Reference solution**

```python reference
import heapq
from bisect import bisect_left

DAY = 1440


def earliest_arrival(lanes, handling, origin, dest, ready, daily=False):
    out = {}
    for u, v, deps in lanes:
        if not deps:
            continue
        deps = sorted(deps)
        times = [d for d, _ in deps]
        best_from = [0] * len(deps)          # earliest arrival using departure i or later
        m = None
        for i in range(len(deps) - 1, -1, -1):
            a = deps[i][0] + deps[i][1]
            if m is None or a < m:
                m = a
            best_from[i] = m
        out.setdefault(u, []).append((v, times, best_from))

    arrive = {origin: ready}
    heap = [(ready, origin)]
    while heap:
        t, u = heapq.heappop(heap)
        if t > arrive[u]:
            continue                          # a stale heap entry
        if u == dest:
            return t
        leave = t if u == origin else t + handling.get(u, 0)
        for v, times, best_from in out.get(u, ()):
            if daily:
                day, minute = divmod(leave, DAY)
                i = bisect_left(times, minute)
                at = (day + 1) * DAY + best_from[0]          # any departure tomorrow
                if i < len(times):
                    at = min(at, day * DAY + best_from[i])  # a later one today
            else:
                i = bisect_left(times, leave)
                if i == len(times):
                    continue
                at = best_from[i]
            if at < arrive.get(v, at + 1):
                arrive[v] = at
                heapq.heappush(heap, (at, v))
    return None
```

**Explanation.** Waiting is allowed, so for every lane the arrival as a function of the ready minute is non-decreasing. If you are ready later, the set of catchable departures can only shrink. Handling adds a constant, so it keeps the property. This "FIFO" property is what lets Dijkstra settle each node at its earliest arrival. Per lane, departures are sorted by minute, and `best_from[i]` holds the earliest arrival using departure `i` or any later one. One binary search then gives the best catchable departure. The best one need not be the next one: an express may leave later and arrive earlier. Handling is added when leaving an intermediate node, never at the origin, and the search stops when the destination is popped, so no handling is added there. With daily schedules, the earliest arrival is the better of a remaining departure today (`day·1440 + best_from[i]`) and any departure tomorrow (`(day+1)·1440 + best_from[0]`). A departure two or more days later is the same departure, later. Transits longer than a day need no special case, because arrival minutes are absolute.

**Complexity.** Sorting all departures costs O(D log D). Dijkstra costs O(L log N) heap work plus one binary search per lane relaxation. The timing test (3 000 nodes, 20 000 lanes, 200 000 departures) runs in about 0.15 s in CPython. Relaxing every lane until nothing changes needs about one pass per hop of the 3 000-hop main route. That is billions of departure checks, and it takes minutes.

**Dialect notes.** In Java or C++ use a priority queue of (arrival, node) with lazy deletion, as here, and `Collections.binarySearch` or `lower_bound` on the sorted minutes. Minutes fit easily in 32-bit integers over months. In a SQL engine, earliest arrival is a recursive CTE with a MIN per node. It is correct only if every node's minimum is propagated, and engines that do not support aggregation in the recursive step make this awkward. Not executed here.

**Edge cases built into the tests.** Origin equals destination; no lane reaches the destination; every departure already gone; a departure exactly at the ready minute; one a minute before; handling that misses a tight connection; handling defined at the origin and destination but not applied; (Hard) a later express that arrives earlier, a two-hop route beating the direct lane, and waiting for a faster later departure; (Very Hard, daily) ready after the last departure of the day, tomorrow's express beating tonight's slow truck, ready on day 3 with a transit longer than a day, and a departure exactly at the ready minute on a later day.

**Common mistakes.** Taking the next departure instead of the best catchable one; adding handling at the origin or destination; `>` instead of `>=` for catching a departure; BFS by hop count; a visited set that marks a node when it is first reached instead of when it is popped; for daily schedules, using `% 1440` on the arrival and losing the day, or considering only today's departures.

**Follow-up guidance.** (1) With capacity the FIFO property breaks for an individual package, because a full truck can make "earlier" worse. Promises need either reserved capacity per package, which is a booking system, or a buffer. Recompute as trucks fill. (2) Use distributions or percentiles per lane from historical scans. A 95% promise is not the sum of per-lane 95th percentiles, so simulate or convolve, and track whether promises are actually met. (3) Precompute a profile (earliest arrival as a function of ready time) per origin and destination region with a profile search such as connection scan, and refresh it on schedule changes. (4) Index packages by the planned departure they ride. On a cancellation, recompute only those packages and the ones behind them, and alert when a promise moves.

**Rubric anchors.** 2: BFS or next-departure logic, or the handling rules wrong; several edge tests fail. 3: all tests pass with Dijkstra and sorted departures. 4: also proves why Dijkstra applies here (the FIFO property from waiting), gets the daily arithmetic right first time, and gives a credible answer on capacity or uncertainty.

**Strong signals.** Asks whether the package can wait, and whether departures on one lane all take the same time. **Red flags.** "Dijkstra always works on graphs" with no mention of the property; ignoring transits that cross midnight.

## AMZ-L2-03

**Reference solution** (the fixed processor)

```python reference
def _stock(stock, fc, sku):
    return stock.setdefault((fc, sku), {"on_hand": 0, "reserved": 0})


def process_inventory(events):
    stock = {}          # (fc, sku) -> counters
    lines = {}          # (order, sku) -> reservation
    rejected = []
    for ev in events:
        t = ev["type"]
        if t in ("receive", "adjust"):
            _stock(stock, ev["fc"], ev["sku"])["on_hand"] += ev["qty"]
        elif t == "reserve":
            s = _stock(stock, ev["fc"], ev["sku"])
            if ev["qty"] <= s["on_hand"] - s["reserved"]:            # the last unit can be sold
                s["reserved"] += ev["qty"]
                lines[(ev["order"], ev["sku"])] = {"fc": ev["fc"], "sku": ev["sku"],
                                                   "qty": ev["qty"], "state": "reserved"}
            else:
                rejected.append([ev["order"], ev["sku"]])
        elif t == "cancel":
            line = lines.get((ev["order"], ev["sku"]))
            if line and line["state"] == "reserved":                  # only a live reservation
                _stock(stock, line["fc"], line["sku"])["reserved"] -= line["qty"]
                line["state"] = "cancelled"
        elif t == "ship":
            line = lines.get((ev["order"], ev["sku"]))
            if line and line["state"] == "reserved":
                s = _stock(stock, line["fc"], line["sku"])
                s["on_hand"] -= line["qty"]
                s["reserved"] -= line["qty"]                           # the reservation is consumed
                line["state"] = "shipped"
    return {
        "stock": {
            fc + "/" + sku: {
                "on_hand": s["on_hand"],
                "reserved": s["reserved"],
                "available": s["on_hand"] - s["reserved"],           # may be negative
            }
            for (fc, sku), s in stock.items()
        },
        "rejected": rejected,
    }
```

**The planted bugs, their symptoms and their fixes.**
1. **Ship does not release the reservation.** `on_hand` drops but `reserved` stays, so every shipped line is counted against availability for ever. Symptom: units "reserved" for orders that shipped weeks ago, and availability far below the shelf count. Fix: `reserved -= qty` on ship.
2. **Strict comparison at the boundary.** `qty < available` refuses an order for exactly the units left. Symptom: the last unit of an item is never sold. Fix: `<=`.
3. **Availability clamped at zero.** `max(0, on_hand - reserved)` hides an oversold centre after a negative adjustment. Symptom: the dashboard says 0 where operations needs to see −1 and re-source an order. Fix: report the signed value.
4. **Lines keyed by order id only.** A multi-line order's second line overwrites the first in `lines`, so a cancel or ship for one SKU acts on the other line's record. Symptom: cancelling one line releases the other line's units, and the cancelled line stays reserved. Fix: key lines by `(order, sku)`.
5. **Cancel without a state check.** A second cancel, or a cancel after shipping, releases the units again, so `reserved` can go negative and availability creeps up. Symptom: availability drifts upward after double cancels. Fix: release only when the line is `reserved`.

Each bug has its own check: shipping, an exact-boundary reservation, a negative adjustment, a two-line order with one cancel, and a double cancel. The cancel-after-ship check passes on the original code by accident, because bugs 1 and 5 cancel out: the ship leaves the units reserved and the cancel releases them. It fails once bug 1 alone is fixed, and passes again when bug 5 is fixed too. Two bugs that hide each other are worth discussing with the candidate.

**Explanation.** Inventory reservation is a small state machine per order line (reserved → shipped or cancelled; rejected lines never enter it) on top of two counters per centre and SKU. Every transition must be guarded by the line's current state and must keep `available = on_hand − reserved` meaningful, including when it is negative.

**Complexity.** O(n) time, O(lines + centre-SKU pairs) memory. The timing test is 200 000 events.

**Dialect notes.** In SQL the same rules are conditional updates: `UPDATE stock SET reserved = reserved + :q WHERE fc = :fc AND sku = :sku AND on_hand - reserved >= :q`, and `UPDATE lines SET state = 'cancelled' WHERE order_id = :o AND sku = :s AND state = 'reserved'` followed by the stock update only if a row changed. A clamp written as `GREATEST(0, …)` in a reporting view hides the oversell the same way. Not executed here.

**Edge cases built into the tests.** Ship then report; reserve exactly the available units; one unit too many; a negative adjustment below reserved; a two-line order with one line cancelled; a double cancel; stock at another centre; a cancel and a ship for rejected or unknown lines; a cancel after shipping.

**Common mistakes.** Fixing the boundary but keeping the clamp because "negative stock is impossible" (it is not impossible for availability); fixing the key for `reserve` but not for `cancel` and `ship`; adding the state check to cancel but releasing on ship twice; rewriting the processor instead of making minimal fixes; changing the output to omit rejected lines' stock entries.

**Follow-up guidance.** (1) Serialise per (centre, SKU): partition the event stream by that key, or use a conditional update in the database so that the second reservation sees the first. A process-local lock is not enough across hosts. (2) Ship and cancel are already idempotent with the state check. Receive and adjust are not, so give each event an id and record applied ids in the same transaction as the counter change. (3) Expire holds with a TTL and an explicit expiry event that goes through the same state check. Expiring too early oversells when the customer completes checkout. (4) Re-source the newest or least time-critical orders to other centres first. Operations decides with a clear rule. The customer sees a revised date only if no centre can meet the promise.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each one explained. 4: also states the state machine and invariant explicitly, adds a regression test per bug, and answers the concurrency and replay follow-ups with a concrete key and conditional update.

**Strong signals.** Reproduces each bug with a three-event case before fixing it; names the business symptom of each bug. **Red flags.** "Clamp to zero to be safe"; a global lock around the whole processor.

## AMZ-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing.** Each source lands raw and immutable in object storage, with a manifest row per file: source, business date or period, version, content hash, received time and row count. A re-sent file with the same hash is a no-op. A different file for the same day or period is a new version and is never an overwrite. Order and shipment events arrive by CDC or event export. Payment files arrive daily. Settlement reports arrive per seller and period with a version number.
- **Normalised layers.** `shipment_charges (shipment_id, order_id, order_line_id, amount_minor, currency, charged_at)`. `refunds (refund_id, order_line_id, amount_minor, currency, refunded_at)`. `settlement_rows (seller_id, period, version, order_line_id, row_type sale|fee|refund|adjustment, amount_minor, currency, settlement_currency, fx_rate)`. Order lines and shipments come from the marketplace with `order_line_id → shipment_id` mapping, and quantities split across shipments.
- **Matching grain.** The order line within a shipment (`order_line_id`, `shipment_id`) is the finest grain all sources share: charges are per shipment and allocated to lines, settlements are per line, and refunds are per returned line. Results roll up to order, seller, period and currency.
- **Match states.** `matched`; `timing` (one side expected later, with an expected-by date such as the next settlement after shipment, or payment within a day); `amount_mismatch` with a classified reason (fx, fee rounding, partial refund, unknown); `missing_payment`, `missing_settlement`, `unexpected_settlement`; `refund_unsettled` while within the refund window. Each state has an owner and an age.
- **Determinism.** A run for business date D reads explicitly pinned versions of every input (recorded in a run manifest), recomputes D's partition and overwrites it atomically. A newer version triggers a rerun of affected dates and periods. Results carry `run_id` and input versions.
- **Currency.** Match in the transaction currency first. A settlement in another currency is compared through the rate that the settlement report states, so conversion differences are explained, not broken. Rounding is per line, as the report rounds. A residual difference within a documented tolerance is classified as rounding and summed separately, never silently absorbed.
- **Outputs.** Finance: a daily break summary by state, currency and age, period close status, and a change log when a closed period is re-issued. Seller support: a per-seller statement view that explains each settlement row against order lines, with version history.

**Competing designs to accept.** A warehouse-native SQL pipeline (dbt-style models) with snapshot tables for versions; a Spark job over a lakehouse with MERGE into a results table keyed by line; a streaming pre-match for payments with a daily batch for settlements. Any is fine if reruns are deterministic and versions are kept. Event-sourcing the match state (each state change as a row) is a strong option for audit.

**Bottlenecks and failure modes.** Ever-growing open items rescanned every day (partition open items by expected-by date, and age them out to a manual queue); matching on order id only, which hides partial shipments; floats; latest-version-only storage, which makes old statements impossible to explain; time-zone boundaries for the business date; a reference format change breaking joins silently.

**Incident guidance.**
- *A closed period's settlement report is re-issued with corrected fees*: land it as a new version, rerun matching for that seller, period and the affected lines, and diff the old results against the new. Post the differences into the current open period as adjustments rather than reopening a closed period, unless finance policy says otherwise. Tell seller support what changed and why.
- *Refund file arrives twice, the second copy larger*: the second copy is a new version (different hash). Rows are deduplicated by `refund_id`, so the extra 2% are new refunds and are matched, while repeats change nothing. Rerun the day. Alert if any `refund_id` changes amount between versions.
- *Shipment reference format change*: break counts jump by two orders of magnitude. That is a pipeline failure, not a finance problem. Detect it with a match-rate monitor per source and day, hold publication of the day's results, normalise both formats in the join (or add a mapping), and rerun. Add a data contract test on the reference format.

**Follow-up guidance.** (1) New version, recompute affected keys, a diff with reasons, adjustments in the open period, and history kept for the seller statement. (2) Two shipments give two charges allocated to the line. Two partial refunds match two refund rows. Settlement rows reference the line, so match at line-and-shipment grain and sum per line for refunds. (3) Use the rate stated by the settlement for conversion, and classify the residual. Never revalue history with today's rate. (4) Immutable inputs, run manifests with input versions, code version, and results by run id. (5) Index open items by expected-by date, close or escalate items past the window, and do not rescan matched history.

**Rubric anchors.** 2: a join on order id with appended daily results; no versioning; no timing state. 3: immutable versioned landing, line-level matching, explicit states including timing, deterministic reruns by partition overwrite. 4: also currency and rounding handled as classified differences, a re-issue process with diffs and seller-facing explanations, monitors that tell a pipeline failure from a finance break, and bounded open-item work.

**Strong signals.** Asks which grain each source produces before choosing a key; treats "timing" as a first-class state. **Red flags.** "Overwrite the old report with the new one"; tolerance thresholds that silently hide differences.

## AMZ-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Ingestion API.** Authenticated per account. Each batch carries `(account, log_group, stream, sequence)` and a payload hash. The front end validates size and timestamps, applies per-account rate quotas (reject or throttle with a retry-after), and writes to the buffer before acknowledging. A deduplication store keyed by batch identity with a TTL longer than the agents' retry horizon (hours) makes retries harmless. The key is checked before the write and recorded atomically with it, or deduplicated downstream on the same key.
- **Buffer.** A partitioned durable log keyed by `(account, log_group, stream)`. Large accounts are spread across several partitions by stream, and small accounts share partitions. Per-account quotas at the API keep a single tenant from filling a shared partition. A very large account can be moved to dedicated partitions.
- **Processing.** Stream processors parse known formats, extract fields (request id, status, latency), redact configured patterns, attach arrival time, and keep the line's own timestamp. Lines with timestamps far in the future or past beyond a window (for example 14 days back, 2 hours ahead) are kept but flagged, and written to the arrival-time partition with a pointer, so they are not lost.
- **Hot tier.** The last hour or day of each account, in an index (inverted index on selected fields such as request id and trace id, plus time) for the interactive target. It is sized by retention of the hot window only.
- **Cold tier.** Compressed columnar files in object storage, laid out as `account / log_group / event_date / hour`. Per-file min/max timestamps and bloom filters on request id let a scan skip files. A streaming writer produces small files every minute. Compaction merges them per hour once the hour is sealed (watermark plus a grace period) and swaps them atomically with a table format (Iceberg/Delta style) or a manifest, so readers see either the old files or the new ones.
- **Late data.** Lines go to their event-time partition. A late write reopens that hour for compaction, and a sealed hour that receives late lines gets a delta file and is compacted again later. Search covers the event time asked for, so late lines are found.
- **Retention.** Account first in the path makes deletion a prefix or partition drop per account and day, with no rewrite of other tenants' data. A shortened retention runs a deletion job for the newly expired range within a day, verifies by listing, and records evidence. The hot tier expires by time.
- **Isolation and billing.** Account id is part of every path and query predicate, enforced by the query service, never by the client. Ingested bytes are counted at the API after deduplication and validation, from the accepted batch record, so retries do not double-bill. Malformed lines are counted and reported separately.
- **Health metrics.** Buffer lag per partition and per large account, deduplication hits, rejected and throttled batches per account, files per partition and compaction backlog, late-line ratio, deletion backlog, query latency percentiles by tier.

**Competing designs to accept.** Index-everything search clusters for the hot tier (accept if the candidate prices it); scan-only designs with heavy partition pruning and bloom filters (accept if the latency target is met for the last hour); a managed stream plus a lakehouse table format; per-account log groups as the unit of isolation. Each has trade-offs in cost against latency.

**Bottlenecks and failure modes.** Hot partitions from a single large account; small-file explosion; compaction racing with readers; a deduplication store that grows without bound or expires too soon; late data invisible after compaction; retention deletes that rewrite shared files; billing double-counted on retries.

**Incident guidance.**
- *Debug logging sends 40% of {{ingest}}*: per-account quotas throttle at the API, so other tenants' latency is unaffected. Alert the customer, and offer a temporary raise that is billed. The buffer partitions of that account fall behind and the others do not. If the quota was too generous, the shared partitions show lag, so move the account to dedicated partitions.
- *Twenty minutes of batches arrive twice*: batch identity is within the deduplication TTL, so the duplicates are acknowledged and dropped. Watch the deduplication hit rate spike, and confirm billed bytes did not move. If the outage exceeded the TTL, deduplicate downstream on the same key during compaction.
- *Lines two days late are missing*: check where they were written. If the processor put them in the arrival-time partition, or the late window was shorter than two days, they are stored but not where search looks. Fix by writing by event time within the window, reopen and re-compact the affected hours, and backfill the misplaced lines. Document the window for customers.

**Follow-up guidance.** (1) Throttling at the API with retry-after; the account's lag grows; others see nothing; alert and possible re-partitioning. (2) Event-time partition plus delta files and a later compaction; the hot tier may not hold them; search uses event time. (3) Partition drops for the newly expired range, a deletion job with verification, and the hot tier purged; prove it with listings and a deletion log. (4) Count once at acceptance, after deduplication; malformed lines counted but not billed, or billed by a documented rule. (5) Bloom filters or a secondary index on request id per hour; compaction sorted by request id; extra write cost compared with scan cost saved.

**Rubric anchors.** 2: a single shared index or bucket with time-only partitions; no batch identity; no compaction plan. 3: batch deduplication, account-first layout, quotas, compaction with atomic swaps, retention by partition drop. 4: also late and future timestamps handled explicitly, exact billing under retries, credible per-incident responses, and a cost argument for hot versus cold.

**Strong signals.** Puts the account first in the layout because of retention and isolation, and says why; sizes the deduplication window from the agents' retry behaviour. **Red flags.** Isolation enforced by client-side filters; "just keep everything in the search index".
