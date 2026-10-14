# Airbnb · Loop 2 — evaluator notes (hidden from candidates)

## ABB-L2-01

**Reference solution**

```python reference
from bisect import bisect_left, bisect_right


def split_stays(calendars, queries, min_nights=None, capacity=None, no_single=False):
    rows = []
    for lid, cal in calendars.items():
        h = len(cal)
        fwd = [0] * (h + 1)              # fwd[t]: free nights starting at night t
        for t in range(h - 1, -1, -1):
            if cal[t] == ".":
                fwd[t] = fwd[t + 1] + 1
        back = [0] * (h + 1)             # back[t]: free nights ending just before night t
        for t in range(1, h + 1):
            if cal[t - 1] == ".":
                back[t] = back[t - 1] + 1
        m = min_nights.get(lid, 1) if min_nights else 1
        cap = capacity.get(lid) if capacity else None
        rows.append((fwd, back, max(1, m), cap))
    out = []
    for ci, co, guests in queries:
        d = co - ci
        if d < 2:
            out.append(0)
            continue
        firsts, seconds_lo, seconds_hi, both = [], [], [], 0
        for fwd, back, m, cap in rows:
            if cap is not None and cap < guests:
                continue
            p = min(fwd[ci], d)          # nights this listing can host from check-in
            s = min(back[co], d)         # nights it can host up to check-out
            if no_single and p == d and m <= d:
                continue                 # it could host the whole stay alone
            # k = nights in the first listing; the move happens after k nights
            lo1, hi1 = m, min(d - 1, p)
            lo2, hi2 = max(1, d - s), d - m
            ok1, ok2 = lo1 <= hi1, lo2 <= hi2
            if ok1:
                firsts.append((lo1, hi1))
            if ok2:
                seconds_lo.append(lo2)
                seconds_hi.append(hi2)
            if ok1 and ok2 and max(lo1, lo2) <= min(hi1, hi2):
                both += 1                # the same listing cannot be both halves
        seconds_lo.sort()
        seconds_hi.sort()
        ns = len(seconds_lo)
        total = 0
        for lo1, hi1 in firsts:
            disjoint = bisect_left(seconds_hi, lo1) + (ns - bisect_right(seconds_lo, hi1))
            total += ns - disjoint
        out.append(total - both)
    return out
```

**Explanation.** For one query of `d` nights, call `k` the number of nights in the first listing, so the move happens after `k` nights and `1 ≤ k ≤ d − 1`. A listing can be the first half for exactly the `k` with `k ≤ p` (it is free for `p` nights in a row from check-in, capped at `d`) and `k ≥` its minimum stay. It can be the second half for exactly the `k` with `d − k ≤ s` (free for `s` nights in a row up to check-out) and `d − k ≥` its minimum stay. Both sets are intervals of `k`, so each listing becomes at most two intervals per query, and a pair works if and only if the first's "first" interval meets the second's "second" interval. Counting intersecting pairs is all pairs minus disjoint pairs: a pair is disjoint when the second interval ends before the first begins, or begins after it ends, and these two cases cannot both hold. With the second-role endpoints sorted, each first listing needs two binary searches. A listing whose own two intervals intersect would be counted as a pair with itself, so it is subtracted once. The free runs come from two linear passes per calendar, one backwards (`fwd[t]`) and one forwards (`back[t]`), so every query reads them in O(1) per listing. Capacity removes listings before anything else. With `exclude_whole`, a listing that is free for all `d` nights, has a minimum stay no longer than `d` and has room for the guests is dropped for that query only.

**Complexity.** Preparation is O(n · h). Each query is O(n log n) for the sorts and binary searches; with move-night counts below a few dozen, counting sort makes it O(n + d). The timing test (3 000 listings, 180 nights, 200 searches) runs in about 0.5 s in CPython. All pairs is 9 million pairs per query, and checking each pair's move nights night by night multiplies that again, so it takes hours. Recomputing the runs per query in O(n · d) and then counting with sorted intervals is fine.

**Dialect notes.** In Java or C++ the same structure uses `int[]` runs and `Arrays.binarySearch` or `lower_bound` / `upper_bound`; watch the inclusive and exclusive bounds, which are where most bugs are. In SQL, the per-listing runs are a gaps-and-islands query, and the pair count is a self-join on interval overlap (`a.lo1 <= b.hi2 AND b.lo2 <= a.hi1 AND a.id <> b.id`). That is correct but quadratic unless the engine can use a range join; counting disjoint pairs with window functions over sorted endpoints is the scalable form. Not executed here.

**Edge cases built into the tests.** A one-night stay; two halves that meet exactly on the move night; a gap night neither listing has; a listing that would pair with itself; two listings free for the whole stay (2 pairs, or 0 under `exclude_whole`); a stay that needs two moves; a stay from the first to the last night of the calendar; booked and blocked nights both unavailable; a query with no available listing. (Hard) A half of exactly the minimum stay and one night short; the minimum stay on the second listing; a pair whose latest move night breaks the second listing's minimum while an earlier one works; guests exactly at capacity and one more. (Very Hard) Whole-stay hosts excluded; a listing free for the whole stay but too small for the guests; one whose minimum stay is longer than the stay; whole-stay status decided per query.

**Common mistakes.** Counting unordered pairs; counting a pair once per move night; letting a listing pair with itself; not capping runs at the stay length, so a listing free for months gets an interval past `d − 1`; trying only the latest move night (fails with minimum stays); applying the minimum stay to one half only; treating `'x'` as free; excluding whole-stay hosts globally instead of per query; quadratic pair loops.

**Follow-up guidance.** (1) For a fixed pair the price is linear in `k`, so the best move night is an end of the intersection. For top 20 overall, bucket listings by their interval ends; for each first listing, the cheapest compatible second listings at each possible `k` come from a precomputed "cheapest second listing whose interval contains k" list, then merge with a heap. Good candidates notice the structure, not just "sort by price". (2) Add a spatial filter: geohash or grid cells, pairs only within neighbouring cells; counting becomes per cell neighbourhood, and the interval trick still applies within it. (3) Keep runs per listing and night; a booked night changes `fwd` for the free run ending there and `back` for the run starting after it, so the update is bounded by the run length. Searches read the runs from the index. (4) Two moves add a middle listing that must be fully free on its segment; the count is a sum over middle listings and segments, and the number of combinations grows by another factor of n, so top-k with pruning becomes necessary.

**Rubric anchors.** 2: all pairs with night-by-night checks, or ordered pairs or self-pairs wrong; small tests only. 3: all tests pass with free runs and interval counting. 4: also explains why each role is an interval, derives the disjoint-pair formula cleanly, handles minimum stays on both sides first time, and gives a credible answer to the cheapest-pairs or update follow-up.

**Strong signals.** Asks whether `(A, B)` and `(B, A)` are different; states the interval of move nights per role before coding; tests the self-pair case. **Red flags.** Counts move nights instead of pairs; "it is only 3 000 listings" without estimating 9 million pairs times the searches per second.

## ABB-L2-02

**Reference solution**

```python reference
def forward_occupancy(listings, bookings, start, end, window=30, blocked=None):
    lo, hi = start, end - 1 + window          # every night any window can touch
    span = hi - lo
    if span <= 0:
        return {lid: [] for lid in listings}
    book_diff = {lid: [0] * (span + 1) for lid in listings}
    for lid, ci, co, status in bookings:
        d = book_diff.get(lid)
        if d is None or status != "confirmed":
            continue
        a, b = max(ci, lo), min(co, hi)
        if a < b:
            d[a - lo] += 1
            d[b - lo] -= 1
    out = {}
    for lid in listings:
        d = book_diff[lid]
        blk = [0] * (span + 1)
        for a, b in (blocked or {}).get(lid, ()):
            a, b = max(a, lo), min(b, hi)
            if a < b:
                blk[a - lo] += 1
                blk[b - lo] -= 1
        pb = [0] * (span + 1)               # prefix: booked nights
        pu = [0] * (span + 1)               # prefix: unavailable (blocked, not booked) nights
        cb = ck = 0
        for i in range(span):
            cb += d[i]
            ck += blk[i]
            booked = cb > 0
            pb[i + 1] = pb[i] + booked
            pu[i + 1] = pu[i] + (ck > 0 and not booked)
        row = []
        for t in range(end - start):
            booked = pb[t + window] - pb[t]
            avail = window - (pu[t + window] - pu[t])
            row.append(round(booked / avail, 4) if avail else None)
        out[lid] = row
    return out
```

**Explanation.** Only nights from `start` to `end − 2 + window` can appear in any window, so every booking and block is clamped to that span. Each confirmed booking adds +1 at its check-in and −1 at its check-out on its listing's difference array. A running sum over the span gives, per night, how many bookings cover it, and the night is booked when that count is above zero, so overlapping bookings count once. Blocks use their own difference array, and a night is unavailable when it is blocked and not booked. Two prefix sums (booked nights, unavailable nights) turn each window into two subtractions: booked = `pb[t + w] − pb[t]`, available = `w − (pu[t + w] − pu[t])`. A window with no available night is None, and a listing with no bookings still gets a full row of zeros. Bookings for unknown listings and cancelled bookings are skipped when the difference arrays are built.

**Complexity.** O(B + n · (D + w)) time and O(D + w) memory per listing, plus the output. The timing test (2 500 listings, 420 dates, a 150-night window, about 210 000 bookings) runs in about 1 s in CPython. Rescanning each window night by night, even with a set of booked nights per listing, is about 160 million checks and took about 16 s, well over the limit. A sliding window that adds the entering night and removes the leaving one is also linear and is accepted.

**Dialect notes.** In SQL, explode bookings into a nights table (`generate_series(check_in, check_out - 1)`), take `MAX(booked)` per listing and night to count overlaps once, left join to a listing × night spine, and use `SUM(...) OVER (PARTITION BY listing ORDER BY night ROWS BETWEEN CURRENT ROW AND w - 1 FOLLOWING)`. Snowflake, BigQuery and Spark SQL support the same frame; Spark needs care to avoid a full shuffle per window. In BigQuery, `GENERATE_DATE_ARRAY` and `UNNEST` explode the stays. Not executed here.

**Edge cases built into the tests.** The check-out night; a stay that began before the first date; one that runs past the last window; a listing with no bookings; a booking for an unknown listing; back-to-back stays; one date only; a 30-night window. (Hard) Blocked nights leaving the denominator; a window with every night blocked (None) followed by one with a free night (0); a booked night that is also blocked; overlapping blocks; a listing missing from `blocked`. (Very Hard) A cancelled booking; two confirmed bookings on the same nights; a cancelled and a confirmed booking on the same nights; overlaps, a cancellation and a block together.

**Common mistakes.** Counting the check-out night; dividing by `window` when blocks apply; reporting 0 instead of None when nothing is available, or raising ZeroDivisionError; summing booking lengths so overlapping bookings count twice; letting a cancelled booking's −1 cancel a confirmed booking's +1 (a sign of mixing statuses in one array); dropping listings with no bookings from the output; forgetting to clamp, so arrays sized by the furthest booking; O(n · D · w) loops.

**Follow-up guidance.** (1) Bookings need a created time and a cancelled time. The as-of curve is a sweep over observation dates: add a booking's nights when it is created and remove them when it is cancelled, with a Fenwick tree or segment tree over nights answering each window sum in O(log h). (2) Nights table plus window frame, as in the dialect notes; partition by market and listing, and avoid exploding stays of many months for every snapshot by keeping a nights table incrementally. (3) The ratio of sums is the market's real occupancy and weights big and small listings by their nights; the average of shares treats every listing equally and is what a "typical host" view wants. Pricing tools usually want the ratio of sums. (4) A booking for nights `[a, b)` changes the windows that start from `a − w + 1` to `b − 1`, only for its listing; update those values or the prefix arrays from `a` on.

**Rubric anchors.** 2: nested loops or a set of nights per listing with rescans; the half-open rule or the None rule wrong. 3: all tests pass with difference arrays and prefix sums or a sliding window. 4: also explains the clamped span, why overlaps need "count above zero", and answers the as-of follow-up with a sweep over creation and cancellation times.

**Strong signals.** Asks whether bookings can overlap and whether blocked nights can be booked before coding; separates booked and unavailable counts cleanly. **Red flags.** Silently returns 0 for an all-blocked window; "the database never has overlapping bookings" with no check.

## ABB-L2-03

**Reference solution** (the fixed calculator)

```python reference
LONG_STAY_NIGHTS = 28      # this exercise's threshold for monthly payouts
PERIOD_NIGHTS = 30         # nights covered by each monthly payout


def _host_fee(gross, fee_bps):
    """The host service fee in cents: to the nearest cent, halves rounded up."""
    return (gross * fee_bps + 5000) // 10000                 # integers only


def host_payouts(bookings, fee_bps):
    lines = []                                    # (day, host, amount) per payout
    for b in bookings:
        nights = b["nights"]
        refunded = b.get("refund_nights", 0)
        paid = nights - refunded
        if paid <= 0:
            continue                              # fully refunded: nothing to pay
        cleaning = b["cleaning"]                  # kept unless every night is refunded
        if nights >= LONG_STAY_NIGHTS:
            for p in range(nights // PERIOD_NIGHTS + 1):
                first = p * PERIOD_NIGHTS
                last = min(first + PERIOD_NIGHTS, nights)
                paid_here = max(0, min(last, paid) - first)   # refunded nights are the last ones
                if paid_here == 0:
                    continue                      # no paid night, no payout
                gross = paid_here * b["rate"] + (cleaning if p == 0 else 0)
                lines.append((b["check_in"] + first + 1, b["host"],
                              gross - _host_fee(gross, fee_bps)))
        else:
            gross = paid * b["rate"] + cleaning
            lines.append((b["check_in"] + 1, b["host"], gross - _host_fee(gross, fee_bps)))
    transfers = {}
    for day, host, amount in lines:
        t = transfers.setdefault((day, host), [day, host, 0])
        t[2] += amount
    return sorted(transfers.values())
```

**The planted bugs, their symptoms and their fixes.**
1. **Transfers keyed by day only.** `transfers.setdefault(day, …)` merges every host paid on the same day into the first host's transfer. Symptom: of two hosts whose guests checked in on the same day, one receives both payouts and the other none. Fix: key by `(day, host)`.
2. **Half-to-even rounding.** `round(gross * fee_bps / 10000)` uses Python's round, which rounds an exact half to the even cent, and divides in floating point first. Symptom: about half of the payouts whose fee ends in exactly half a cent are a cent off from the rule. Fix: `(gross * fee_bps + 5000) // 10000` in integers (or `Decimal` with `ROUND_HALF_UP` on an exact quotient).
3. **Refunded nights taken from the start of a long stay.** `last - max(first, refunded)` treats nights `0 … refunded − 1` as refunded. Symptom: after a guest leaves early, the first monthly payout is too small and a later one too large. Fix: the paid nights are `0 … paid − 1`, so `max(0, min(last, paid) - first)`.
4. **Cleaning fee dropped on a partial refund.** `cleaning = … if refunded == 0 else 0`. Symptom: hosts lose the cleaning fee whenever any night is refunded. Fix: keep the cleaning fee unless every night is refunded, which the `paid <= 0` check already handles.
5. **An empty period paid as a zero transfer.** The loop creates `nights // 30 + 1` periods, one too many when the stay is a multiple of 30 nights, and never skips a period with no paid night, which a refund at the end of a long stay also creates. Symptom: a $0.00 transfer a month after the last real payout. Fix: skip a period with no paid night (and optionally loop over `ceil(nights / 30)` periods).

Each bug has its own check: two hosts paid on the same day; a fee of exactly half a cent above an even number of cents; a 40-night stay with 5 nights refunded and no cleaning fee; a 6-night stay with a partial refund; a 60-night stay with no refund. Rates in those checks are chosen so that no other bug changes their result. The checks for a refund that empties a whole period and one that ends on a period boundary fail under both bugs 3 and 5; that is worth discussing once the candidate has fixed one of them and sees the check still failing.

**Explanation.** A payout run is a pure function from bookings to transfers. Each booking's paid nights are a prefix of its stay. For a monthly stay that prefix is cut into 30-night periods, each period's gross pays its own rounded fee, and transfers add payouts by host and day. Every money operation stays in integer cents.

**Complexity.** O(B + P log P) for B bookings and P payouts (the sort); a long stay contributes a handful of periods. The timing test is 100 000 bookings.

**Dialect notes.** In SQL, `ROUND(numeric)` in PostgreSQL rounds half away from zero, which equals half up for positive amounts; Snowflake's `ROUND` also rounds half away from zero by default, and BigQuery's `ROUND` does the same for `NUMERIC` (with `ROUND(x, 0, 'ROUND_HALF_EVEN')` available). Spark's `round` is half up and `bround` is half even. Rounding a `FLOAT` or `DOUBLE` in any engine can give a different cent from the exact value. Java's `Math.round` rounds half up for positives, and `BigDecimal` with `RoundingMode.HALF_UP` is the safe form. Not executed here.

**Edge cases built into the tests.** Two hosts paid on the same day; one host's two stays released on the same day (one transfer); a fee of exactly half a cent; a partial refund on a long stay; a partial refund on a short stay with a cleaning fee; exactly 60 nights; 27 and 28 nights; 31 nights; a fully refunded stay next to a paid one; a refund that empties a whole period; a refund that ends on a period boundary.

**Common mistakes.** Switching to `Decimal` but still building it from a float; computing the fee once per booking instead of per payout; deciding the monthly schedule from paid nights; keying transfers by booking id, which breaks "one transfer per host and day"; fixing the period count but not the empty-period skip, so refunds still create zero transfers; rewriting the calculator instead of making minimal fixes.

**Follow-up guidance.** (1) Record the refund as a negative adjustment against the booking and period, net it from the host's next transfer (or invoice it if none is due), and keep the original payout unchanged for audit. (2) Give every payout an idempotency key such as `(booking id, period)` and record sent keys in the same transaction as the transfer; a restarted run skips keys already sent. Keying by transfer alone is not enough, because a restart can regroup payouts. (3) A payout day is a calendar date, so state whose calendar it is. With the host's time zone, a run must process each zone's day when it ends there, and "the same day" for merging transfers is the host's day. (4) Per-transfer rounding changes a host's fee by at most half a cent per payout merged into the transfer, in either direction; show the distribution over a month of payouts, not a single example.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also states the money rules (integers, one rounding per payout, the rounding mode), adds a regression test per bug, and answers the idempotency follow-up with a concrete key.

**Strong signals.** Reproduces each complaint with a one-booking case before fixing; names the rounding mode precisely; notices that bugs 3 and 5 overlap on the boundary check. **Red flags.** "Use floats and round at the end"; fixing symptoms by special-casing 60-night stays.

## ABB-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Source of truth.** An availability store keyed by listing, with a row per listing and night (or per listing with a compact range map) and a version per listing. Night states: free, held (request pending, with an expiry), booked (booking id), host-blocked, import-blocked (feed id and event id). Bookings made here live in the bookings database; availability is written in the same transaction, or the booking's nights are protected by a constraint on the bookings table itself (for example an exclusion constraint on `(listing_id, daterange(check_in, check_out))` for active bookings and holds).
- **Booking path.** A booking request does a conditional write over its whole range: every night must be free (and not import-blocked) or the write fails. Instant-book confirms in the same transaction; a request-to-book creates a hold with an expiry. Expiry is a state transition with the same conditional check, not a cron job deleting rows.
- **Host app.** Host blocks are conditional writes that refuse nights already booked or held, with a clear message.
- **Channel managers.** An API that accepts snapshots of a date range or individual changes, each with a per-listing sequence number or the version it was based on. The write applies only if its sequence is newer than the last applied one; a retry with the same request id is a no-op. Snapshots replace only host-blocks and prices in their range, never bookings made here; a snapshot that says "free" over a booked night is recorded as a conflict.
- **Imported feeds.** A fetcher schedules each feed by its refresh interval, with priority for listings in high demand and with conditional requests (`ETag` / `If-Modified-Since`) to keep fetches cheap. Each fetch is parsed and diffed against the previous fetch by event id: new ranges become import-blocks, removed ones are released. An import-block over a night booked here is a conflict, not an overwrite.
- **Change events.** Every committed availability change emits an event (outbox pattern) keyed by listing with the new version. Search indexing and the exported feed consume it; the exported feed is regenerated per listing on change and served with caching headers, so other sites' polls see it quickly.
- **Conflict handling.** A conflict record holds the listing, nights, both sides, the route that wrote each side and the detection time. Hosts are alerted at once; the workflow depends on which side is confirmed first (help the guest rebook, cancellation without penalty to the guest, and so on). Conflicts feed metrics by route and by connected tool.
- **Metrics.** Double bookings per 10 000 bookings by route; import freshness distribution per feed; channel-manager write rejections by reason; time from a booking here to its appearance in the exported feed; search staleness (index version lag per listing).

**Competing designs to accept.** A single relational table with an exclusion constraint for bookings and holds, plus separate tables for host and import blocks; a per-listing actor or partition (all writes for a listing go through one ordered log) that serialises writes without database locks; an event-sourced availability log with a materialised calendar. Each is fine if overlapping confirmed stays are impossible and external writes are ordered and idempotent.

**Bottlenecks and failure modes.** Hot listings with many concurrent requests (per-listing serialisation is fine because a listing's write rate is low; the danger is a global lock); long holds blocking nights; stale imports that the marketplace cannot fix by itself; snapshot writes that overwrite bookings; a search index that drops events; an exported feed cached for too long.

**Incident guidance.**
- *Imports fall an hour behind for a region*: monitor feed freshness per provider and region; when lag exceeds a threshold, raise fetch priority for listings with upcoming demand, and, for listings whose only other channel is an import, consider asking hosts to confirm requests rather than instant-book until freshness recovers. Expect the conflict rate to rise and staff the support queue for it.
- *A channel manager sends all-free snapshots*: snapshots never free a night booked here, so bookings are safe; the conflicts are logged. Detect the burst (free-night writes per tool far above normal), pause that tool's writes, and ask the provider; restore host blocks from the availability history, which is why it must be kept.
- *The search index misses changes after a restart*: the index stores the last applied version per listing; a reconciler compares versions with the availability store and re-indexes listings that are behind. Bookings stay safe because the booking path never trusts the index.

**Follow-up guidance.** (1) The marketplace does not learn about the other booking until the next fetch or channel-manager update, so the exposure is the refresh interval; detection is at that fetch, followed by host notification and the conflict workflow. Good answers also shorten exposure by updating the exported feed immediately. (2) Version or sequence per listing: the late older snapshot is rejected, the retried batch is a no-op by request id. (3) Adaptive fetch frequency by demand and by how often the feed changes, conditional requests, and pushing hosts to connections that send changes instead of polled feeds. (4) Conflicts per route per 10 000 bookings, shown to hosts per connection with examples.

**Rubric anchors.** 2: a calendar table updated by every route with last write wins; no protection against overlapping bookings. 3: conditional booking writes or a constraint, separate import layer, idempotent channel-manager writes, change events to search. 4: also states the exposure window from polling and how to shrink it, models holds and conflicts explicitly, keeps availability history for recovery, and measures conflicts by route.

**Strong signals.** Separates what the marketplace can guarantee (its own bookings) from what it cannot (other sites' bookings); asks how channel managers identify their writes. **Red flags.** "Use a distributed lock" with no scope; trusting the search index or a cache at booking time.

## ABB-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing.** Booking lifecycle events (created, altered, cancelled by guest or host, refund issued) land in an append-only table keyed by event id; duplicates are dropped on the event id. Each event keeps its event time and its arrival time, and the booking's currency and amounts in minor units.
- **Booking state history.** A versioned table built from the events: one row per booking version with `valid_from` / `valid_to` (event time), check-in, check-out, guests, price, status, the cancellation policy recorded at booking time, and the version's source event. Late events are inserted in event-time order, and the versions after them are recomputed for that booking only.
- **Night-level fact.** One row per booking and stay night with the night's amount, status (booked, cancelled, stayed), booking date, the version that created it and the version that ended it. An alteration from 7 nights to 4 ends three rows and keeps four (or ends and restarts them if the price changes). A cancellation marks the remaining future nights cancelled; a cancellation after check-in marks only the nights not stayed.
- **Refund fact.** One row per refund event attached to booking and cancellation, with amount, currency, the rate used and the refund date. Partial and late refunds are simply more rows. An allocation of each refund to nights (pro rata, or by the policy's rule) lets the stay-date view carry refunded amounts per night.
- **Policy dimension.** Policies are versioned with an id that never changes when a name does; bookings reference the id and the version in force at booking time.
- **Two views.** By booking date: cohorts of bookings made in a period, with cancellations and refunds that happened at any later time, so last month's numbers keep moving until the cohort's last stay date has passed. By stay date: nights per stay date with their status and refunded amounts. Both read the same facts. A reconciliation report checks that, over all bookings made in a range whose stays have ended, total cancelled amounts and refunds agree in the two views.
- **Restatement.** Reports for closed periods are published as versioned snapshots. When late events change a closed period, a new version is produced with a difference summary, and the published one is kept.
- **Currency.** Store both the original currency and a reporting currency converted at a documented rule: the booking-date rate for booking value and the refund-date rate for refunds, with the conversion difference reported separately rather than hidden.

**Competing designs to accept.** Daily snapshots of booking state plus an event table (accept if the candidate shows what is lost between snapshots and why it does or does not matter); a fully event-sourced model where both views are computed from events on demand; a dbt-style layered model with incremental night facts. Any is fine if history is rebuildable and the two views reconcile.

**Bottlenecks and failure modes.** The night fact grows with bookings made far ahead (partition by stay month, cluster by listing); late events that force wide recomputation (recompute per booking, not per partition); renamed policies breaking joins; refunds without a cancellation (host-initiated goodwill refunds) that need their own reason; double-counting when an alteration is sent twice.

**Incident guidance.**
- *Refunds in 3 of the {{currencies}} currencies delayed four days*: the by-booking-date refund amounts drop for recent cohorts, then recover. Show data completeness per currency and day on the report, hold publication of affected periods, and avoid alerting on a business drop that is really a pipeline delay.
- *Alterations sent twice with different event ids*: the second copy must not move nights twice. Deduplicate on a business key (booking id, alteration content and a short time window) or make the alteration state-based (the new dates) rather than a delta, so applying it twice changes nothing.
- *A renamed policy*: bookings reference a stable policy id, so the fact is unaffected; if the model joined on name, rebuild the affected rows, and add a test that every booking resolves to a policy.

**Follow-up guidance.** (1) The by-booking-date cohort of six weeks ago changes (its refunded amount), and the stay-date view changes for the cancelled nights' dates; closed periods change only through a recorded restatement. (2) Seven night rows; shortening ends three; cancellation marks the remaining four; the refund is attached to the cancellation and allocated to those nights. (3) State the rule; converting refunds at the refund date and bookings at the booking date makes money-based rates drift with exchange rates, so report rates in counts and in original currency too. (4) Training rows must use only the booking's state as of the prediction time: no later versions, no refund or cancellation fields, and features built from the versioned table with valid times.

**Rubric anchors.** 2: one booking table updated in place with a status column; no history; one view only. 3: event log, versioned booking state, night fact, refunds attached by event, both views defined. 4: also explicit metric grains and a reconciliation between views, restatement of closed periods, a currency rule, idempotency against duplicate alterations, and leakage protection for modelling.

**Strong signals.** Asks which date each team means before modelling; defines denominators for both views. **Red flags.** "Just overwrite the booking row"; a cancellation rate computed by stay date with a booking-date denominator.
