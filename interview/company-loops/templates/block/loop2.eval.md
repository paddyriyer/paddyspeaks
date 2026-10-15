# Block · Loop 2 — evaluator notes (hidden from candidates)

## BLK-L2-01

**Reference solution**

```python reference
def book_appointments(horizon, busy, requests):
    size = 1
    while size < horizon:
        size *= 2
    # Per node: longest free run, free run at the left edge, free run at the right edge.
    best = [0] * (2 * size)
    pre = [0] * (2 * size)
    suf = [0] * (2 * size)
    width = [0] * (2 * size)
    lazy = [-1] * (2 * size)              # -1 nothing pending, 0 make busy, 1 make free
    for i in range(size):
        width[size + i] = 1
        if i < horizon:                   # padding beyond the horizon is never free
            best[size + i] = pre[size + i] = suf[size + i] = 1
    for v in range(size - 1, 0, -1):
        width[v] = 2 * width[2 * v]

    def pull(v):
        l, r = 2 * v, 2 * v + 1
        w = width[l]
        pre[v] = pre[l] if pre[l] < w else w + pre[r]
        suf[v] = suf[r] if suf[r] < w else w + suf[l]
        best[v] = max(best[l], best[r], suf[l] + pre[r])

    for v in range(size - 1, 0, -1):
        pull(v)

    def apply(v, val):
        x = width[v] if val else 0
        best[v] = pre[v] = suf[v] = x
        lazy[v] = val

    def push(v):
        if lazy[v] >= 0:
            apply(2 * v, lazy[v])
            apply(2 * v + 1, lazy[v])
            lazy[v] = -1

    def assign(v, lo, hi, a, b, val):     # make [a, b) busy (0) or free (1)
        if b <= lo or hi <= a:
            return
        if a <= lo and hi <= b:
            apply(v, val)
            return
        push(v)
        mid = (lo + hi) // 2
        assign(2 * v, lo, mid, a, b, val)
        assign(2 * v + 1, mid, hi, a, b, val)
        pull(v)

    def first_fit(need):
        if best[1] < need:                # nothing fits anywhere: one comparison
            return -1
        v, lo, hi = 1, 0, size
        while v < size:
            push(v)
            mid = (lo + hi) // 2
            if best[2 * v] >= need:       # the earliest fit lies wholly in the left half
                v, hi = 2 * v, mid
            elif suf[2 * v] + pre[2 * v + 1] >= need:
                return mid - suf[2 * v]   # it straddles the middle
            else:
                v, lo = 2 * v + 1, mid
        return lo

    for start, end in busy:
        assign(1, 0, size, start, end, 0)
    out, booked = [], {}
    for i, (kind, x) in enumerate(requests):
        if kind == "book":
            s = first_fit(x)
            if s >= 0:
                assign(1, 0, size, s, s + x, 0)
                booked[i] = (s, x)
            out.append(s)
        else:
            got = booked.pop(x, None)     # failed or already cancelled: nothing to free
            if got is None:
                out.append(-1)
            else:
                assign(1, 0, size, got[0], got[0] + got[1], 1)
                out.append(got[0])
    return out
```

**Explanation.** A segment tree over the minutes stores, for each node, its longest free run and the free runs touching its left and right edges. A parent's prefix is the left child's prefix, extended by the right child's prefix when the left child is entirely free; the suffix is symmetric; the longest run is the best of the two children and the run that crosses the middle (`left.suffix + right.prefix`). A request that does not fit anywhere is answered from the root alone. Otherwise the walk down prefers the left child if it holds a long enough run, then the crossing run, then the right child, which gives the earliest start because every run in the left half starts before the crossing run, and the crossing run starts before any run inside the right half. Booking and freeing are range assignments with lazy propagation. Padding leaves beyond the horizon are busy, so no booking can run past the end. A cancellation frees exactly the minutes the booking took. Those minutes were free before the booking, so freeing them never touches a busy range, and the pop from `booked` makes a second cancel return -1.

**Complexity.** O(size) to build, O(log horizon) per busy range and per booking or cancellation (O(1) for a request that fits nowhere), O(horizon) memory. The timing tests (4, 6 or 8 weeks of minutes, 10 000 to 12 000 requests) take 0.04–0.13 s in CPython across runs. Scanning the minutes for every request (O(horizon) per request, and the full horizon for every request that fails once the calendar is full) took 20.7 s, 25.6 s and 15.8 s for the three levels, so it fails the 8 s limit by a wide margin and is more than 100 times slower than the tree. Checking `all(free[s:s + length])` for every start is O(horizon · length) and slower still.

**The likely middle approach, and why it passes.** A sorted list of free gaps, scanned from the start for the first gap that is long enough, with neighbours merged on a cancellation, runs the timing tests in 0.04–0.33 s. Its cost per request is O(G) for G free gaps, and in these calendars G stays in the low hundreds: a calendar's gaps are bounded by its bookings and busy ranges, which are few compared with its minutes. That is acceptable, and it is a reasonable production answer for one person's calendar. The tree wins when gaps are many: a calendar kept in seconds, a shared resource booked in tiny slots, or a long horizon fragmented by short holds. Ask the candidate to describe that calendar (follow-up 1). Another fast answer is a `bytearray` of the calendar searched with `find(bytes(length))`. It is O(horizon) per request, but the search runs in C and skips ahead, so it also passes. Accept it, and ask for its complexity and what happens with seconds (a follow-up rule fires on `bytearray`).

**Dialect notes.** In Java, Scala or C++ the same tree uses `int` arrays and an iterative or recursive implementation; a `TreeMap` of free gaps keyed by start is the natural gap-list version, but a first-fit query on it still walks gaps unless sizes are indexed. In SQL, "earliest gap that fits" is a gaps-and-islands query with `LEAD(start) OVER (ORDER BY start)` over bookings, which is fine for one read but not for booking as you go. Not executed here.

**Edge cases built into the tests.** A request exactly as long as a gap; one minute longer than every gap (-1); the earliest fit after a gap that is too short, then a short request that fills that gap; busy ranges out of order, overlapping and touching; a booking that ends exactly at the horizon; the calendar filling up; a free run that straddles the middle of the tree; no busy ranges at all; (Very Hard) a cancelled booking's minutes booked again, cancelling a failed booking, cancelling twice, and freed minutes merging with free neighbours on both sides.

**Common mistakes.** Treating ranges as closed and losing the minute at `end`; sorting busy ranges but not merging overlaps when building gaps; best fit (the smallest gap that fits) instead of the earliest; forgetting the run that crosses the middle of a node; a prefix that does not extend into the right child when the left child is entirely free; not pushing lazy values before walking down; letting padding beyond the horizon count as free; a cancel that frees minutes twice or frees a failed booking.

**Follow-up guidance.** (1) The gap list is O(G) per request and simple; it is the better choice when G is small, and it degrades on heavily fragmented calendars (many short gaps before the first fit). Indexing gaps by length and start (a tree keyed by start that also keeps the maximum gap length in each subtree) brings it back to O(log G). (2) Book `length + cleanup` minutes but allow the clean-up part to overlap closing time: either check two conditions (the service minutes free, the clean-up minutes free or closed), or keep a second layer for "closed" that clean-up may use. (3) Keep one tree per staff member and a small heap or tournament tree over them keyed by each staff member's earliest fit for common lengths, or query each tree's root first and only walk the ones that can fit. Ties go to the first listed staff member. (4) Serialise per staff calendar: one writer per calendar (a partitioned queue or a row lock), or an optimistic check that the minutes are still free when the booking is written. The losing client is offered the next earliest time, not an error.

**Rubric anchors.** 2: a minute scan or a gap list that is correct on the samples but mishandles overlaps, the horizon end or cancellations. 3: all checks pass with a gap list or a segment tree, with a correct complexity statement. 4: a segment tree of free runs with lazy assignment, explained clearly (why prefix and suffix are needed and why the walk gives the earliest start), plus a precise account of when the gap list is enough and when it is not.

**Strong signals.** Asks whether ranges are half-open and whether they overlap; notices that once the calendar is full, every request should fail in O(1); states the earliest-start argument for the tree walk. **Red flags.** Sorting the whole calendar per request; claiming the minute scan is fine because "a week is only 10 080 minutes" without counting requests.

## BLK-L2-02

**Reference solution**

```python reference
def match_invoices(invoices, payment):
    half = len(invoices) // 2
    left_part, right_part = invoices[:half], invoices[half:]

    def subset_sums(part):
        sums = [0]                                   # bit j of the index <=> part[j] is in the set
        for _invoice, amount in part:
            sums += [s + amount for s in sums]
        return sums

    left = subset_sums(left_part)
    right = subset_sums(right_part)
    counts = {}
    for s in right:
        counts[s] = counts.get(s, 0) + 1
    total, hit = 0, -1
    for mask, s in enumerate(left):
        c = counts.get(payment - s)
        if c:
            total += c
            hit = mask
    if total != 1:
        return (total, [])
    right_mask = right.index(payment - left[hit])  # unique, because total == 1
    ids = [inv for j, (inv, _a) in enumerate(left_part) if hit >> j & 1]
    ids += [inv for j, (inv, _a) in enumerate(right_part) if right_mask >> j & 1]
    return (1, ids)
```

**Explanation.** Every set of open items is a set from the left half joined with a set from the right half. List all subset sums of each half; building them by doubling the list makes the index of a sum its subset mask. Count the right sums in a dictionary, and for each left sum `s` add the number of right sums equal to `payment - s`. That counts every pair, so every matching set exactly once, including sets that use invoices with equal amounts. The empty set (both masks 0) sums to 0 and never matches, since the payment is at least 1. When the total is 1, the matching left mask is the only one that contributed, and its right partner's sum occurs exactly once among right sums, so `index` finds it. Ids come out in input order because the left half precedes the right and each half is walked in order. Negative amounts (credit notes) need no special handling: nothing here assumes sums only grow.

**Complexity.** O(2^(n/2)) sums per half, built in O(2^(n/2)) list operations, and O(2^(n/2)) dictionary operations; memory O(2^(n/2)). The timing tests (34, 36 and 38 open items) take 0.06–0.14 s, 0.13–0.24 s and 0.31–0.43 s in CPython across runs. Every subset is 2³⁴ to 2³⁸ sets, which is hours. A DP over sums is impossible: the payment reaches hundreds of millions of cents, and a dictionary of reachable sums doubles with every invoice (about 15 million entries after 24 invoices of a 34-item test, 13 s in, and the full 34-item test did not finish in 120 s).

**The likely middle approach.** Backtracking over invoices sorted by amount, pruning when the running sum passes the payment or the remaining invoices cannot reach it. It needs every matching set, not one, and with the payment around half the total the pruning removes little: it took 5.7 s on 30 items and 100 s on the 34-item timing test (measured; see the run notes). With credit notes the "sum passes the payment" prune is wrong as well as slow. A candidate who stops at the first match also returns the wrong count.

**Dialect notes.** In Java, Scala or C++, generate the half sums into `long` arrays, sort one half, and count with two pointers or binary search for `payment - s` (equal-range counts handle duplicates); this uses less memory than a hash map. Amounts in cents can exceed 32-bit integers once summed. SQL is a poor fit beyond a handful of invoices; a recursive CTE over subsets is exponential. Not executed here.

**Edge cases built into the tests.** The payment equals one invoice; the payment equals every invoice together; no set matches; a payment one cent short; two invoices for the same amount (two sets, no ids); one invoice or two others (two sets); no open invoices; amounts in the hundreds of millions of cents; (Very Hard) a credit note netted against invoices, a payment that only adds up with a credit note, and an invoice and credit note that cancel out and double the matches.

**Common mistakes.** Stopping at the first match; counting amounts instead of invoices, so equal amounts collapse into one set; counting the empty set; returning ids when there are several sets; returning ids sorted by amount instead of input order; pruning that assumes positive amounts; a DP array indexed by sum; floats for money.

**Follow-up guidance.** (1) With small amounts the count DP over sums is O(n · payment) and beats meet in the middle, and a dictionary keyed by reachable sums stays small; the choice depends on the range of amounts, not just n. (2) A tolerance turns exact lookups into range lookups: sort one half and, for each left sum, count right sums in `[payment - s, payment - s + allowance]`, where the allowance depends on which invoices are in the set, so either bound it by the largest allowed discount or use a looser search and verify. Ambiguity rises sharply, so automatic matching should become rarer. (3) Score each matching set (for example, the sum of invoice ages) and show sets in score order to the reviewer; never auto-apply a set because it is "most likely". (4) Run the match per transfer as a stateless function with a cap on n; above the cap, or when the count is not 1, route to review. Never auto-match across customers, when a transfer reference names invoices that contradict the match, or when the customer has queried an invoice or paid part of one.

**Rubric anchors.** 2: brute force or a DP over sums that only works on the samples, or the first match returned as the answer. 3: all checks pass with meet in the middle, with the count by invoice and ids only when the count is 1. 4: also explains why both every-subset and DP over sums fail at these sizes, handles credit notes without positive-only pruning, and gives a careful answer on when to match automatically.

**Strong signals.** Asks what to do when several sets match before coding; estimates 2^(n/2) memory; notes that negative amounts break pruning. **Red flags.** "Pick any matching set"; ignoring equal amounts; "use floats, the amounts are dollars".

**Run notes for interviewers.** Measured in CPython on the timing tests: meet in the middle at most 0.14 s (34 items), 0.24 s (36) and 0.43 s (38, with credit notes). Pruned backtracking: 5.7 s on 30 items and 100 s on 34. A dictionary DP over reachable sums: 13 s to reach the 24th item of 34, and no answer within 120 s.

## BLK-L2-03

**Reference solution** (the fixed summary)

```python reference
from datetime import datetime, timedelta


def _local_day(ts, offset_minutes):
    """An ISO timestamp in UTC -> the location's local calendar date, 'YYYY-MM-DD'."""
    return (datetime.fromisoformat(ts) + timedelta(minutes=offset_minutes)).date().isoformat()


def daily_summary(payments, refunds, locations):
    days = {}

    def row(location, day):
        return days.setdefault(location + "/" + day,
                               {"payments": 0, "gross": 0, "tips": 0, "refunds": 0, "net": 0})

    sales = {}                                   # payment id -> completed payment
    for p in payments:
        if p["status"] != "completed":
            continue
        day = _local_day(p["taken_at"], locations[p["location"]])     # when it was taken
        r = row(p["location"], day)
        r["payments"] += 1
        r["gross"] += p["amount"]                                      # tips are not sales
        r["tips"] += p["tip"]
        sales[p["id"]] = p
    for f in refunds:
        p = sales.get(f["payment"])
        if p is None:
            continue
        day = _local_day(f["refunded_at"], locations[p["location"]])  # when it was made
        row(p["location"], day)["refunds"] += f["amount"]              # its own amount
    for r in days.values():
        r["net"] = r["gross"] - r["refunds"]
    return days
```

**The planted bugs, their symptoms and their fixes.**
1. **The offset is applied with the wrong sign.** `_local_day` subtracts the offset. For a location at −300, 02:00 UTC becomes 07:00 instead of 21:00 the day before. Symptom: a west-coast bar's late sales appear on the next day's report, and an Auckland café's early sales on the previous day's. Fix: add the offset, since it is defined as positive east of UTC.
2. **Offline payments are dated by `forwarded_at`.** `p["forwarded_at"] or p["taken_at"]` uses the reconnect time. Symptom: after an outage, yesterday's sales land on today's report. Fix: always use `taken_at`.
3. **Tips are added into gross sales.** `gross += amount + tip`. Symptom: gross sales do not match the items rung up, and tips are counted twice across the two columns. Fix: `gross += amount`.
4. **Refunds are booked on the sale's day.** The refund loop uses the stored sale day. Symptom: a closed day changes when a refund is made later, and today's report misses today's refunds. Fix: use the refund's own local date, at the payment's location.
5. **A refund subtracts the whole payment.** `refunds += p["amount"]`. Symptom: a $5 partial refund on a $60 sale removes $60, and two partial refunds remove $120. Fix: `refunds += f["amount"]`.

Each bug has its own check in which the others do not show: an evening sale west of UTC and an early sale east of UTC (bug 1, no tips or refunds); an offline payment forwarded the next day at a UTC location (bug 2); a sale with a tip (bug 3); a whole refund two days later (bug 4, and bug 5 does not change a whole refund); a partial refund on the same day and two partial refunds (bug 5, and bug 4 does not move a same-day refund). The declined-payment check passes on the original code; it guards against a fix that drops the status test.

**Explanation.** A seller's daily summary is two event streams (payments and refunds) placed on the location's calendar. Each event is dated by when it happened, in the location's local time, and each adds only its own amount. Nothing about a later event restates an earlier day. Everything stays in integer cents.

**Complexity.** O(P + R) time and O(P) memory for the payment index. The timing test is 100 000 or 200 000 payments with about 30% refunded, and the fixed code takes about 0.75 s in CPython, most of it parsing timestamps.

**Dialect notes.** In SQL the same report is two aggregations unioned on `(location, local_date)`: payments by `(taken_at AT TIME ZONE 'UTC' + offset)::date` and refunds by the refund time at the payment's location. With named time zones, PostgreSQL's `AT TIME ZONE location.tz`, Snowflake's `CONVERT_TIMEZONE` and BigQuery's `DATE(ts, tz)` do this; the sign of a numeric offset is the most common bug in hand-written versions. Not executed here.

**Edge cases built into the tests.** Sales west and east of UTC near midnight; an offline payment forwarded the next day; a declined offline payment; a tip; a refund two days later on a day with no sales (a row with zero payments and negative net); a partial refund; two partial refunds of one payment.

**Common mistakes.** Fixing the sign in one place but reading `[:10]` from the UTC string somewhere else; moving refunds to their own day but still subtracting the payment's amount; dropping the row for a day that has only refunds; excluding declined payments only when they are offline; converting to dollars with floats "to make it readable"; rewriting the function instead of fixing it.

**Follow-up guidance.** (1) Store an IANA time-zone name per location and convert each timestamp with it; days around a change have 23 or 25 hours, and only those days change. Keep the offset used with each row so the report can be explained later. (2) Recompute the rows for every local date that an arriving event touches (the payment's `taken_at` date), keep a changed-at stamp per row, and show the seller that a past day changed and why. (3) Either each location in its own local time (best for "what happened in my shops") or one reference zone chosen by the seller; label it, and make the change day visible. (4) Deposits net fees, refunds and holds, settle on a schedule, may group several days, and exclude cash; tips, timing (late offline payments) and declined offline payments differ too.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each explained. 4: also explains the seller-facing symptom of each bug, names which day an event belongs to as a rule, and answers the daylight-saving and recomputation follow-ups concretely.

**Strong signals.** Works the hint's timestamp by hand before touching the code; asks which day a refund belongs to before fixing it. **Red flags.** "Restating the sale's day is more accurate"; floats for money; converting everything to UTC dates "for consistency".

## BLK-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Model.** `items (seller_id, item_id, name, category_id, version, deleted)`, `variations (item_id, variation_id, sku, base_price_minor, track_stock, version)`, `location_overrides (variation_id, location_id, price_minor, visible, tax_id, version)`, `modifiers` and `categories`. A resolved view per location (library value unless overridden) is what devices read. Every write increments a per-seller library version.
- **Stock.** An append-only `stock_changes (seller_id, location_id, variation_id, change_id, kind sale|return|receive|count|adjust|transfer, qty_delta or counted_qty, occurred_at, recorded_at, device_id, reference)`. `stock_on_hand (location_id, variation_id, qty, as_of_change)` is derived and updated in the same transaction as the change. A `count` event sets the quantity as of `occurred_at`; deltas that occurred before the count are absorbed by it, and deltas after it apply on top.
- **Sync to devices.** Devices hold a local copy of the library and pull "changes since version N" (or receive a push nudge and then pull). Bulk imports are written as one batch with one version, so a register sees all or none. Registers record sales locally with `occurred_at` and a device-generated change id, and upload when connected; the server dedupes by change id.
- **Conflicts.** The library uses per-field versions: an edit carries the version it was based on; a stale edit to the same field is rejected and shown to the seller (or applied with "last writer by server receipt" and an audit row, if the product prefers silent resolution). Stock never conflicts: deltas commute, and counts are ordered by `occurred_at`.
- **Online store.** It sells from one location's stock. An online order holds stock at that location (a reservation row) until picked or cancelled; in-person sales do not check reservations, so overselling between channels is possible while a register is offline. It is visible as negative stock plus a flagged online order, never hidden.
- **Analytics.** Change streams of the library and stock into the warehouse: `dim_item_version` (SCD type 2 for prices and names), `fct_sale_line` with the price actually charged, `fct_stock_change`, and a daily `stock_snapshot` per location and variation, with "stock at time T" computed as the latest snapshot before T plus the changes between. Late offline changes rebuild the affected snapshots.

**Competing designs to accept.** Event-sourcing the library as well as stock; a document per item with embedded variations and overrides; CRDT counters for stock with a separate "count" register (fine if they explain how a count overrides earlier deltas only); push-based sync over a persistent connection. Any is fine if offline sales, counts and conflicts are explicit.

**Bottlenecks and failure modes.** A version-less sync that re-sends the whole library to every device; snapshots that silently miss late offline changes; clocks on devices used to order library edits; a bulk import applied row by row, so registers see half-updated price lists; stock clamped at zero; hot sellers with {{max_locations}} locations and very large libraries making "changes since N" queries scan too much (index by seller and version).

**Incident guidance.**
- *Bulk price import at 08:55 shows mixed prices at 09:00*: the import was applied as many versions, and registers pulled mid-way. Apply bulk imports as one atomic version (stage, then publish), and let registers switch versions atomically. For sales already made at old prices, the sale records the price charged, so reports stay correct; tell the seller which sales used the old price.
- *Offline register oversold eight units against the online store*: accept the negative count, flag the online orders for the seller (fulfil from another location, refund or delay), and record the cause. Longer term: reserve a buffer of stock for online at locations that go offline often, and stop online sales of an item when the location's register has been offline past a threshold.

**Follow-up guidance.** (1) The 300 sales arrive with their `occurred_at`; they are deduped by change id and applied as deltas; on-hand may go negative; the online store's availability updates; snapshots for that afternoon are rebuilt; the dashboard shows the late upload. (2) The count at 09:00 sets 12 as of 09:00; the 08:55 sale happened before the count, so it is absorbed; on hand stays 12 minus anything after 09:00. A design that subtracts it again is wrong. (3) Publish one version; registers fetch it in the background and switch between sales; a sale in progress keeps the price it was rung up with. (4) Daily snapshots plus replay of the day's changes; full replay from the start is too slow at {{max_items}} items, and snapshots alone cannot answer 18:00.

**Rubric anchors.** 2: one table of items with a quantity column updated in place; no offline story; last write wins on device clocks. 3: library separated from stock, a stock change log with counts as set events, versioned sync, a conflict rule, analytics tables. 4: also handles count-versus-late-delta ordering correctly, atomic bulk publishes, visible overselling between channels, and point-in-time stock with rebuilds for late data.

**Strong signals.** Asks how a physical count interacts with sales that happened before it; separates "occurred" from "recorded". **Red flags.** Clamping stock at zero; trusting device clocks to order edits from different devices.

## BLK-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Event contract.** Every event: `event_id` (unique per fact, stable on retry), `payment_id`, `producer`, `type`, `occurred_at` (producer clock), `received_at` (pipeline clock), `amount_minor`, `currency`, `state` for authoritative events, and a schema version. Client events carry context (surface, app version, region bucket) and never a state that overrides the money-movement service.
- **Landing.** A partitioned log keyed by `payment_id`, so all events of one payment are ordered by arrival in one partition. Raw events land immutably in object storage by `received_at` hour.
- **Dedup.** By `event_id`, with a memory window (for example 7 days in a keyed state store), plus a daily batch dedup over the raw table for anything later. Duplicates with different ids from a buggy client are caught by a content key (payment, type, state, occurred minute) and a monitor on events per payment.
- **State.** A `payment_state (payment_id, state, sent_at, completed_at, cancelled_at, reversed_at, amount_minor, currency, region, last_event_id, updated_at)` table derived only from authoritative events. Transitions are ranked (sent < pending < completed or cancelled; completed < reversed), so applying events in any order gives the same final state: a lower-rank event never moves a payment back, and an invalid transition (cancelled to completed) is written to a data-quality table, not applied. The full event history is kept to explain any state.
- **Published tables.** `agg_payments_daily (day, region, currency, state, payments, amount_minor)` by the day of the relevant timestamp, with explicit definitions (completed on day D, reversed on day D, sent on day D), plus `agg_payments_daily_as_published` snapshots with a publish time. Small groups are suppressed or merged. No published table has a person's id; the state table with ids is restricted.
- **Corrections.** A late reversal updates the state table and the aggregate for its own day, and, for "completed and not reversed" views, the completion day. Each change to a past day is logged with the reason and visible as current versus first published.
- **Proof.** Daily reconciliation of counts and amounts by state against the money-movement service's own daily totals, with alerts on any difference outside a stated tolerance of zero for amounts.

**Competing designs to accept.** A streaming state store with periodic batch correction (lambda-style); pure batch every {{freshness}} from the raw log with MERGE into the state table; a lakehouse table with change data feed driving the aggregates. All fine if order-independence, late reversals and reconciliation are explicit.

**Bottlenecks and failure modes.** Latest-event-wins by producer clock; trusting client events for state; unbounded dedup memory; aggregates recomputed for all history every run; hot partitions are rare when keying by payment id, but a backfill can flood one hour's partitions; privacy leaks through small groups or through a restricted table copied into a dashboard source.

**Incident guidance.**
- *Phone release sends `cancelled` for completed payments*: the authoritative state is unaffected because client events never set state; the monitor on client-versus-authority disagreement (3% for six hours) pages the owning team; client-derived metrics (funnel by screen) for the window are marked and recomputed after the fix. If client events did set state, every affected payment's state and every aggregate must be rebuilt from the authoritative events.
- *Late batch of reversals drops the published completed amount for past days by 0.4%*: the change is real and must show. Publish it as a restatement with the reason, keep the first-published figures, alert finance before the dashboards move, and check that each reversal's own day received it. Investigate why the batch was late, and add a lag monitor on reversals.

**Follow-up guidance.** (1) After `completed`: the state is completed with `completed_at`; `sent` and `pending` arriving later only fill `sent_at` and do not change the state. (2) The completion day's "completed and not reversed" amount and the reversal day's "reversed" amount both change; finance sees the restatement in the change log and the as-published table. (3) Detect it with events-per-payment and duplicate content keys by app version; fix by content-key dedup for that version, recompute the affected client metrics; state is safe because it is authoritative-only. (4) Use the money-movement service's timestamps for both ends; phone clocks drift and can be set by the user. (5) Keep the state table incrementally (MERGE by payment id per micro-batch) and aggregates incrementally by touched day; a day rerun rebuilds from the raw log for payments with any event on that day and overwrites that day's partitions.

**Rubric anchors.** 2: one table of events with "latest timestamp wins", no dedup, totals that silently change. 3: event contract, dedup with a window, an order-independent state machine from the authoritative source, late reversals applied, aggregate tables with privacy thresholds. 4: also as-published versus current totals, reconciliation as proof, clear day definitions, and a credible incremental and rerun story at {{daily_payments}} payments a day.

**Strong signals.** Asks which producer is authoritative before designing; separates "which day" by question. **Red flags.** Per-person payment tables exposed to dashboards; trusting phone clocks for latency metrics; treating a reversal as a deletion of the original payment.
