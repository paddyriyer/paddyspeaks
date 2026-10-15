# DoorDash · Loop 2 — evaluator notes (hidden from candidates)

## DSH-L2-01

**Reference solution**

```python reference
def most_lines_filled(orders):
    out = []
    for order in orders:
        reserved = order.get("reserved", {})
        cap = {}                                   # spare units per item, after in-stock lines
        for item, n in order["units"].items():
            left = n - reserved.get(item, 0)
            if left > 0:
                cap[item] = left
        # Approved items the store can actually supply, each listed once.
        approved = [list(dict.fromkeys(a for a in items if a in cap)) for _line, items in order["lines"]]
        holders = {item: [] for item in cap}       # item -> lines currently filled by it

        def place(i, seen):
            """Fill line i, moving other lines along an augmenting path if needed."""
            for item in approved[i]:
                if item in seen:
                    continue
                seen.add(item)
                h = holders[item]
                if len(h) < cap[item]:             # a spare unit: take it
                    h.append(i)
                    return True
                for j, other in enumerate(h):      # full: can a holder move elsewhere?
                    if place(other, seen):
                        h[j] = i
                        return True
            return False

        filled = 0
        for i in range(len(approved)):
            if approved[i] and place(i, set()):
                filled += 1
        out.append(filled)
    return out
```

**Explanation.** Lines and items form a bipartite graph, with an item allowed as many lines as it has spare units. This is a maximum matching with capacities on one side (equivalently, a maximum flow from a source through lines, with capacity 1, and items, with capacity = spare units, to a sink). Kuhn's algorithm adds lines one at a time. For each line it searches depth first for an augmenting path: take an item with a spare unit, or take a full item and recursively move one of its current holders to another item that holder approves. The visited set of items makes each search O(E). A line that finds no path now never finds one later in the same order (Berge's theorem: the matching is maximum when no augmenting path exists, and a line that cannot be added cannot become addable by adding further lines). Spare units are units minus reserved units, floored at zero; repeated and unstocked items are dropped from approved lists before the search.

**Complexity.** O(L · E) per order in the worst case for L lines and E approved pairs, usually far less; O(L + E) memory. The timing test (1 500 orders of 20 to 40 lines, or 30 to 60 lines at Hard and Very Hard) takes 0.08–0.13 s in CPython. Trying every assignment (backtracking over each line's approved items, with the bound "filled + lines left cannot beat the best") took more than a second on 34 of the first 60 orders of a 40-line test and on all of the first 60 orders of a 60-line test; one 40-line order ran for over a minute. The whole test would take far longer than the 8 s limit.

**The likely middle approach, and why the timing test is not what catches it.** Greedy first fit (lines in order, each takes its first approved item with a unit left) is O(E) and very fast, and it is wrong: it can use up the only item another line accepts. Every seeded sample contains at least one order where first fit fills fewer lines than the maximum, and the checks include a two-line counterexample, an order where "fewest options first" also fails (every line has two options), and a six-line chain where every line must move to its second choice. Greedy therefore fails the samples and checks, and the timing test only confirms it (the timing test compares with the reference, and first fit fills fewer lines on two thirds or more of its orders). A max-flow implementation (Edmonds–Karp or Dinic) is a correct alternative and passes comfortably at these sizes; Hopcroft–Karp is faster in theory and unnecessary here.

**Dialect notes.** In Java, Scala or C++ the same DFS uses arrays indexed by line and item number (map ids to integers first) and an int array per item for holders; recursion depth is at most the number of lines, which is small. In SQL there is no practical formulation of augmenting paths; a set-based greedy is the best SQL offers and it has the same flaw. Not executed here.

**Edge cases built into the tests.** First fit blocking a line with one choice; a tie where fewest-options-first still fails; a long chain of moves; an item with two units filling two lines; approved items with zero units or no entry; empty approved lists (refunds); an item repeated in one approved list; more units than lines; several orders whose units must not be shared, including an order with no lines; (Very Hard) reserved units taken off first, more reserved than on hand (zero, never negative), and a reservation for an item no line approves.

**Common mistakes.** Greedy in any order; counting an item with three units as one; letting units leak between orders; counting a repeated item twice in the visited logic or the capacity; a negative spare count after reservations, which breaks `len(h) < cap` comparisons; forgetting the visited set, which makes the search exponential or infinite; returning the assignment instead of the count, or the count of filled items instead of lines.

**Follow-up guidance.** (1) First fit: `[[a, b], [a]]` with one unit each. Fewest first: four lines `[c, d], [a, d], [b, d], [b, c]` with one unit each; all have two options, input order breaks the tie, and greedy fills three of four. (2) This becomes a minimum-cost maximum flow (or the Hungarian method with ranks as costs and a large reward per filled line); a cheaper approximation is to try first choices first in each DFS, which is a heuristic, not a guarantee. (3) A budget per order makes it a constrained problem: maximise lines subject to total extra cost, which is no longer a plain matching (it is a min-cost flow with a budget, or an integer program); with tiny orders, search is fine. (4) Show "up to N lines" rather than a promise, re-run the matching whenever a shelf turns out empty (only that item's holders need to move), and record what was found, substituted or refunded per line.

**Rubric anchors.** 2: greedy or every-assignment search, correct on some samples only. 3: all checks pass with augmenting paths or max flow, capacities and reservations right. 4: also gives a small counterexample to greedy unprompted, argues why a line that fails once never needs retrying, states the complexity, and answers the preference follow-up with min-cost flow.

**Strong signals.** Recognises bipartite matching quickly; asks whether units are per item and shared across lines; builds a counterexample before coding. **Red flags.** "Sort by fewest options and it's always optimal"; trying every assignment with no estimate of its cost.

## DSH-L2-02

**Reference solution**

```python reference
import heapq


def price_timeline(base, promotions, horizon):
    starts = {item: [] for item in base}
    for created, (pid, item, start, end, price) in enumerate(promotions):
        start, end = max(start, 0), min(end, horizon)     # only the part inside the period
        if start < end:
            starts[item].append((start, price, created, end, pid))
    out = {}
    for item, rows in base.items():
        promos = sorted(starts[item])
        changes = sorted(rows)
        times = sorted({0} | {p[0] for p in promos} | {p[3] for p in promos if p[3] < horizon}
                       | {t for t, _ in changes if 0 <= t < horizon})
        heap, segs = [], []
        pi = ci = 0
        cur_base = None
        for t in times:
            while ci < len(changes) and changes[ci][0] <= t:
                cur_base = changes[ci][1]
                ci += 1
            while pi < len(promos) and promos[pi][0] == t:
                _s, price, created, end, pid = promos[pi]
                heapq.heappush(heap, (price, created, end, pid))   # cheapest, then oldest
                pi += 1
            while heap and heap[0][2] <= t:                         # lazy deletion of ended ones
                heapq.heappop(heap)
            if heap and heap[0][0] < cur_base:
                state = (heap[0][0], heap[0][3])
            else:
                state = (cur_base, None)
            if segs and (segs[-1][2], segs[-1][3]) == state:
                continue                                            # nothing visible changed
            if segs:
                segs[-1][1] = t
            segs.append([t, horizon, state[0], state[1]])
        out[item] = [tuple(s) for s in segs]
    return out
```

**Explanation.** The winner can only change at a promotion's start or end, or at a base price change, so the sweep visits those times in order. Active promotions sit in a min-heap keyed by `(price, creation index)`, so the top is the cheapest and, among equal prices, the oldest. Ended promotions are not removed when they end; each one stays in the heap until it reaches the top, and is popped then (lazy deletion). Only the top matters, so a stale entry lower down is harmless. The top wins only if it is strictly below the base price in force; otherwise the base price shows with no promotion. A segment is opened only when `(price, promotion)` changes, which merges pieces where the same promotion keeps winning across a base change or across another promotion's start or end. Clipping to `[0, horizon)` happens before anything else, and a promotion entirely outside the period disappears.

**Complexity.** O(n log n) per item for n promotions (sorting plus one push and at most one pop each) and O(n) memory. The timing test (80 000 promotions on four items over four weeks of minutes, thousands active at once) takes 0.31–0.49 s in CPython. Evaluating every promotion at every boundary (O(n²) per item) extrapolates to 160–210 s.

**The middle approach.** A sweep that keeps a plain list of active promotions, removes ended ones with `list.remove` and takes `min()` of the list at each boundary is O(n · a) for a active. With thousands active it took 18.6–24.3 s on the timing test, so it fails the 8 s limit. A sorted list maintained with `bisect.insort` and deleting by bisect does O(log a) comparisons per update but moves O(a) pointers in C; it took 1.05 s and passes. Accept it as a correct O(n log n)-comparison method, and ask about memory moves (a follow-up rule fires on `insort`). A balanced tree or `SortedList` is equivalent.

**Dialect notes.** In Java use a `PriorityQueue` with a comparator on price then creation index, and the same lazy pop; a `TreeSet` supports removal directly. In SQL, segments come from cutting at every start, end and base change (a `UNION` of boundary times, `LEAD` for the next boundary), then a lateral join that picks `ORDER BY price, created LIMIT 1` per piece, and finally gaps-and-islands to merge pieces with the same winner. That is correct and set-based but O(pieces × active) without a suitable index. Not executed here.

**Edge cases built into the tests.** Overlapping promotions; equal prices where the older promotion started later (and the change of winner at equal price opens a new segment); a promotion ending exactly when another starts; the next best returning when the cheapest ends; a dearer promotion inside the winner (no split); an item with no promotions next to an item with one; clipping at both ends and a promotion starting at the horizon; a promotion at the base price; (Very Hard) a lower new base that beats a running promotion, a winner that survives a base change as one segment, a base row with an unchanged price, and a base rise that lets a promotion win from that moment.

**Common mistakes.** Breaking ties by start time instead of creation order; merging adjacent segments by price only; letting a promotion at the base price win; closed ranges; forgetting to clip; removing ended promotions eagerly from a list; re-sorting the active set at every boundary; producing per-minute output.

**Follow-up guidance.** (1) Keep each item's segment starts in a sorted array and bisect per lookup (O(log s)), or join orders to segments in a warehouse on `start <= t < end`. (2) A percentage promotion's price depends on the base, so its heap key changes at base changes; recompute the active keys at each base change (they are few), or key by percentage within a base period. (3) Version the promotion set: store the timeline "as shown" with the promotions known at the time, and a recomputed "as now" timeline, each with a computed-at stamp; never rewrite what was shown. (4) Only the item's segments overlapping `[start, end)` of the new promotion can change; recompute that window from the active set at its start.

**Rubric anchors.** 2: per-minute evaluation or a list rescan, or tie and merge rules wrong. 3: all checks pass with a heap sweep or sorted structure, ties by creation order. 4: also explains lazy deletion and why only the top matters, gives the costs of the middle approaches, and answers the percentage and incremental follow-ups concretely.

**Strong signals.** Asks what "older" means before sorting; notices that a change of winner at equal price is still a change. **Red flags.** Output per minute "to be safe"; dropping the promotion id from the output.

## DSH-L2-03

**Reference solution** (the fixed calculator)

```python reference
import math
from fractions import Fraction


def _half_up(x):
    """An exact amount in cents -> whole cents, halves rounded up."""
    return math.floor(x + Fraction(1, 2))


def price_carts(carts, fees):
    out = []
    for cart in carts:
        subtotal = 0
        item_discount = Fraction(0)
        for line in cart["lines"]:
            mods = sum(m["price"] for m in line.get("modifiers", []))
            line_total = (line["price"] + mods) * line["qty"]                       # modifiers per unit
            subtotal += line_total
            item_discount += Fraction(line_total * line.get("promo_pct", 0), 100)   # exact, no rounding yet
        order_discount = Fraction(0)
        promo = cart.get("order_promo")
        if promo:
            after_items = subtotal - item_discount                                  # item promotions first
            order_discount = min(Fraction(promo["max_off"]), after_items * promo["pct"] / 100)
        discounted = _half_up(subtotal - item_discount - order_discount)            # the one rounding
        delivery = fees["delivery"]
        if cart["member"] and subtotal >= fees["member_min"]:                       # before promotions
            delivery = 0
        tax = _half_up(Fraction(discounted * fees["tax_bps"], 10000))               # on the discounted subtotal
        out.append({"subtotal": subtotal, "discount": subtotal - discounted, "delivery_fee": delivery,
                    "tax": tax, "total": discounted + delivery + tax})
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **Modifiers are charged once per line.** `price * qty + mods`. Symptom: two burgers with extra cheese pay for the cheese once. Fix: `(price + mods) * qty`.
2. **The order promotion is taken from the subtotal before item promotions.** Symptom: an item on promotion plus a 20% code gives 20% of the undiscounted subtotal, more than the code allows. Fix: take `pct` of `subtotal - item_discount`, then apply the cap.
3. **The membership waiver tests the discounted subtotal.** Symptom: a member whose items are above the minimum is charged delivery after a code brings the total below it. Fix: test `subtotal` (before promotions), this exercise's rule.
4. **Tax is charged on the subtotal before promotions.** Symptom: tax too high on every discounted order. Fix: tax the rounded discounted subtotal.
5. **Each line's discount is rounded down on its own.** `line_total * pct // 100`. Symptom: carts with several discounted lines are a cent or more too high. Fix: keep each discount exact (a `Fraction`) and round once.

Each bug has its own check in which the others do not show: a modifier on a quantity of two with no promotions (bug 1); an item promotion plus an order code with tax at 0 and whole-cent discounts (bug 2); a member at 1 500 with a 25% code and a 1 200 minimum, no item promotions, tax 0 (bug 3); a 10% item promotion with 8% tax and a whole-cent discount (bug 4); two lines of 1 005 at 10%, tax 0 (bug 5). Three checks pass on the original code and guard the fixes: half a cent rounds up (904.5 → 905, so a fix with Python's `round()`, which gives 904, fails), the order promotion's cap, and a member exactly at the minimum next to a non-member.

**Explanation.** Pricing is a fixed order of operations on exact amounts: line totals with per-unit modifiers, item promotions, the capped order promotion on what remains, one rounding to cents, then the fee rule (on the cart before promotions) and tax (on the discounted subtotal). Rounding once means discounts are carried as exact fractions until the discounted subtotal is stated.

**Complexity.** O(total lines) time and O(carts) output. The timing test is 30 000 carts; the fixed code takes about 0.42–0.44 s in CPython with `Fraction`. An integer version (amounts scaled by 100 and 10 000) takes about a quarter of that and is equally correct.

**Dialect notes.** In SQL, compute line totals and exact discounts in `NUMERIC`, sum per cart, apply `LEAST(max_off, after_items * pct / 100)`, and round once with `ROUND(x)` in PostgreSQL (`NUMERIC` rounds halves away from zero, which is "halves up" for positive amounts); BigQuery's `ROUND` on `NUMERIC` behaves the same, while `FLOAT64` does not. In Java use `BigDecimal` with `RoundingMode.HALF_UP`, never `double`. Not executed here.

**Edge cases built into the tests.** A modifier on quantity two; an item promotion plus an order code; a member above the minimum before promotions and below it after; tax on a discounted cart; fractional discounts on two lines; a half cent; the order promotion's cap; a member exactly at the minimum and a non-member.

**Common mistakes.** Fixing rounding with `round()` (banker's rounding) or floats; rounding the tax on the unrounded subtotal and getting a different cent; applying the order promotion's cap before computing its percentage; moving the waiver test but keeping the discounted subtotal; rewriting the function instead of fixing it.

**Follow-up guidance.** (1) Say which subtotal it tests and keep both rules in one place, with the consumer shown why a code or the waiver applied. (2) Allocate the order discount and tax to lines in proportion to line amounts, with the rounding remainder assigned by a stated rule (largest remainder) so line refunds sum to what was charged. (3) Tax per line by tax category, then round per tax rate or per line as the rule requires; the output gains a tax breakdown. (4) One pricing library (or service) used by both, versioned rules, and a stored price breakdown at checkout that the charge reuses rather than recomputes.

**Rubric anchors.** 2: finds two or three bugs, some checks still fail. 3: all five fixed, all checks pass, each explained. 4: also explains each symptom from the consumer's side, keeps exact arithmetic with a single rounding, and answers the refund-allocation follow-up concretely.

**Strong signals.** Works the hint by hand; asks which subtotal the waiver uses before changing it. **Red flags.** Converting to floats "to simplify"; rounding each line "because receipts show lines".

## DSH-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Intake.** One endpoint (or poller) per point-of-sale kind writes raw payloads unchanged to object storage and a log keyed by store, with `received_at`, the integration's own sequence or timestamp, and a payload hash. Adapters map each format to a canonical model: `menu (store_id, version)`, `category`, `item (store_id, item_key, external_id, name, price_minor, tax_category)`, `modifier_group (min, max)`, `modifier_option`, `menu_hours`, plus `availability (store_id, item_key, available, as_of)`.
- **Two paths.** Full menus and structural changes go through validation and versioned publishing; price and availability updates take a fast path that patches the current published version within {{freshness}}. Each update carries the source's sequence or timestamp; an update older than what is applied for that field is ignored (per-field last-applied stamps), so a late full menu cannot undo a newer sold-out flag.
- **Dedup.** A normalised full menu (sorted keys, canonical ordering) is hashed; an unchanged resend is acknowledged and dropped.
- **Validation.** Schema checks, price sanity (zero, negative, a hundredfold change), modifier groups whose minimum exceeds their options, orphan items, and a size guard (a menu that drops more than a stated share of items is held). Failing menus go to quarantine; the last good version stays live; the merchant sees the reason in their own tools.
- **Publishing.** A new menu version is written completely and then made current with one pointer switch; caches and the search index are updated from a change event; rollback is a pointer switch back.
- **Identity.** A stable `item_key` per store, mapped from external ids, with a matching step (name, price, category) when a rebuild changes every external id; history, ratings and reports use `item_key`.
- **Observability.** Per integration and per store: last update received, time from receipt to publish, validation failure rate, quarantine count, and stores with no update in an expected interval. Merchants see only their own stores.
- **History.** Every published version is kept (or stored as SCD type 2 rows), so "the menu at 18:30 last Friday" is the version current then, plus availability changes as of that time.

**Competing designs to accept.** Event-sourcing every menu change; documents per store menu in a document store with versions; separate services for structure and availability. All fine if ordering, validation with last-good fallback and atomic publishing are explicit.

**Bottlenecks and failure modes.** Full-menu resends flooding search reindexing (fixed by hashing and diffs); one slow adapter blocking others (separate queues per integration); out-of-order updates without per-field stamps; non-atomic publishes showing half a menu; caches invalidated by TTL only.

**Incident guidance.**
- *Prices arrive in dollars instead of cents from one point-of-sale kind*: a price sanity check comparing to the last published price (a hundredfold drop) should have quarantined them. Roll the affected stores back to the last good version, block orders at the wrong prices, fix the adapter, and add the ratio check to validation for every integration. Report affected orders to merchants.
- *A full menu with every modifier group missing is published*: validation should hold a menu that loses required modifier groups (items with required groups now without them). Roll back by pointer switch; add a structural diff guard (share of items losing groups) and alert the integration's owner.

**Follow-up guidance.** (1) Hash and drop unchanged resends; index only the diff. (2) Map new external ids to stable item keys by matching and confirm uncertain matches with the merchant. (3) Hold, notify the merchant and publish on confirmation; a size guard is the evidence. (4) Keep it as a pending availability fact with its timestamp, applied when the item appears if still newer. (5) Keep every version with its validity interval and availability changes with timestamps.

**Rubric anchors.** 2: overwrite the menu on every payload; no validation or versions. 3: canonical model, validation with quarantine, versioned atomic publishing, a fast path for availability. 4: also per-field ordering against late full menus, hashing for resends, stable identity across rebuilds, and concrete incident fixes tied to validation rules.

**Strong signals.** Separates availability from structure; asks how merchants learn about rejected menus. **Red flags.** Publishing whatever arrives; deleting the previous version.

## DSH-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Quotes.** `POST /quotes` with the merchant's order reference, addresses, items summary and channel returns a stored quote `(quote_id, merchant_id, fee_minor, eta, expires_at = now + {{quote_ttl}}, channel)`.
- **Acceptance.** `POST /deliveries` with `quote_id` and an idempotency key. The first request creates `delivery (delivery_id, quote_id, merchant_id, external_ref, state, version)`; a retry with the same key returns the same response; the same key with a different body returns a conflict; an expired quote returns a clear error and asks for a new quote. A unique constraint on `quote_id` stops two deliveries for one quote.
- **State.** States ranked created < courier assigned < picked up < delivered, with cancelled as a terminal state from any non-terminal state. Events from the delivery service are applied only if they move the state forward; out-of-order events are recorded but do not move it back. Every change increments `version`.
- **Webhooks.** A transactional outbox writes one row per state change; a sender delivers with retries and exponential backoff per merchant endpoint, with `delivery_id`, `state`, `version` and `occurred_at`, so merchants can drop older versions. After a stated retry period, updates are marked undelivered and the merchant is alerted. `GET /deliveries/{id}` is the source of truth for recovery.
- **Cancellations and charges.** Rules by state (this exercise's rules): free before courier assignment, a fee after pickup; each cancellation records who cancelled and why.
- **Reporting.** `fct_delivery (merchant_id, channel, day, state, fee_minor, times between states)` in a warehouse, refreshed often; merchants query only their own rows (row-level security by merchant). Courier details shown during a delivery are minimal and expire; reports show only aggregates such as median pickup-to-delivery time.

**Competing designs to accept.** Polling-only for small merchants; a streaming state store instead of a relational table; server-sent events instead of webhooks. Fine if idempotent acceptance, ordered state and recovery are explicit.

**Bottlenecks and failure modes.** Webhook senders blocked by one slow endpoint (isolate per endpoint); retries without backoff overwhelming a recovering merchant; out-of-order events regressing state; quotes stored forever ({{daily_requests}} a day, most never accepted: keep briefly, aggregate for conversion reporting).

**Incident guidance.**
- *A retry bug accepts every quote twice*: idempotency keys and a unique constraint on `quote_id` make the second acceptance return the first delivery; without them, cancel the duplicates before assignment, refund, and add the constraint. Alert on deliveries per external reference above one.
- *The webhook sender falls six hours behind*: the outbox keeps every update; drain it with per-endpoint parallelism, and send only the latest version per delivery when far behind. Tell merchants to reconcile with the query endpoint; add a lag monitor and alert before it reaches minutes.

**Follow-up guidance.** (1) Same key: one delivery, the same response twice. (2) Outbox retries with backoff; after recovery, the merchant receives the latest state per delivery (or all versions, marked) and can query to reconcile. (3) A cancellation event after pickup, the fee by this exercise's rule, a report row in cancelled state with the reason. (4) Delivery durations per channel from your timestamps; the merchant's own pickup times stay on their side; no individual courier data. (5) Keep quotes for days, aggregate quote-to-acceptance by channel for the merchant, then delete.

**Rubric anchors.** 2: synchronous calls with no idempotency, fire-and-forget webhooks. 3: stored quotes with expiry, idempotent acceptance, a forward-only state machine, an outbox with retries and a query endpoint, per-merchant reports. 4: also cancellation and charge rules by state, per-endpoint isolation, minimal and expiring courier data, and concrete incident plans.

**Strong signals.** Asks what identifies a retry; designs recovery around a query endpoint. **Red flags.** Exposing courier history to merchants; webhooks as the only source of truth.
