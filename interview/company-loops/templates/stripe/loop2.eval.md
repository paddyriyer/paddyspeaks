# Stripe · Loop 2 — evaluator notes (hidden from candidates)

## STR-L2-01

**Reference solution**

```python reference
DENOM = 10_000_000_000


def best_conversion(quotes, source, target, amount, max_hops):
    best = {source: amount}                 # most of each currency after <= i conversions
    for _ in range(max_hops):
        nxt = dict(best)                    # fewer conversions stay allowed
        changed = False
        for frm, to, rate, fee in quotes:
            have = best.get(frm)            # read the previous step only
            if have is None:
                continue
            got = have * rate * (10000 - fee) // DENOM
            if got > nxt.get(to, -1):
                nxt[to] = got
                changed = True
        best = nxt
        if not changed:                     # a fixed point: more steps change nothing
            break
    return best.get(target)
```

**Explanation.** A hop-limited Bellman-Ford over amounts. `best_i[c]` is the most of `c` reachable with at most `i` conversions. Step `i + 1` reads only step `i`, so no route exceeds `max_hops`; starting `nxt` as a copy of `best` keeps shorter routes. Keeping one number per currency is correct because each conversion `x → x·rate·(10000−fee) // 10¹⁰` is monotone non-decreasing in `x`: a larger holding never yields a smaller result downstream, even with the floor. The sentinel `-1` lets a route that floors to 0 still register, so `0` (reachable, worthless) stays distinct from `None` (unreachable). When a step changes nothing, every later step would be identical, so stopping early is safe.

**Complexity.** O(K · E) time and O(V) memory. At 400 currencies, 24 000 quotes and K = 6 this is about 144 000 integer multiplications, well under a second in CPython. Enumerating routes is exponential (60 quotes per currency, 6 hops ≈ 4.7·10¹⁰ routes).

**Dialect notes.** In Java, Scala or C++ the product `amount · rate · (10000 − fee)` reaches about 10¹⁹ and overflows a signed 64-bit integer; use `BigInteger`, Scala `BigInt` or `__int128`; splitting the division into two steps changes the floor in general. In a SQL engine the same DP is a recursive CTE with a hop counter and `MAX` per (currency, hop); BigQuery and Snowflake support recursive CTEs, Spark SQL historically did not. Not executed here.

**Edge cases built into the tests.** A better route that needs one hop too many, with quotes listed in chain order so in-place relaxation takes it; a target reachable only with max_hops + 1; max_hops = 0; source equal to target; a result that floors to 0; a two-hop route where flooring once at the end gives a different answer; (Hard) two quotes for one pair where the better rate beats the lower fee, and a fee applied on every hop; (Very Hard) a quote loop that gains value, used when three hops are allowed and not when two are.

**Common mistakes.** Relaxing in place (routes longer than K); floats or logarithms of rates (wrong floors, and log-sum shortest path ignores the floor entirely); Dijkstra on negative log weights (invalid with value-gaining loops and with a hop limit); a visited set that forbids revisiting a currency; returning `None` for a 0 result because of `if not best`; keeping only one quote per pair.

**Follow-up guidance.** (1) One run is O(K·E), so recomputing per request on each quote snapshot is affordable; batch requests by source currency. Because the floor makes conversions non-linear, a result for one amount cannot be scaled exactly to another, but the route found for a nearby amount is a strong candidate to re-evaluate first. (2) A fixed fee `x → max(0, f(x) − c)` is still monotone, so the DP still holds. (3) Size bands break monotonicity (more in can mean a quote becomes unavailable): the per-currency maximum is no longer sufficient; you need the amount as part of the state or a search. (4) Detect value-gaining loops with Bellman-Ford on `−log(rate·(1−fee))` (a negative cycle) for monitoring; operationally, such a loop usually means a stale or mistyped quote, so alert and quarantine the quote rather than trade on it.

**Rubric anchors.** 2: correct DP but floats, in-place relaxation or 0/None confusion fails edge tests. 3: all tests pass with integer arithmetic and a per-step copy. 4: also justifies the DP by monotonicity, explains why Dijkstra does not apply, and handles the size-band follow-up correctly.

**Strong signals.** Asks whether routes may revisit a currency and whether the limit is "at most"; notices the 64-bit overflow in typed languages. **Red flags.** "Use floats, the error is tiny" in a money path; enumerating all paths without noticing the blow-up.

## STR-L2-02

**Reference solution**

```python reference
def linked_groups(links, min_size, max_share=None):
    ignored = set()
    if max_share is not None:
        holders = {}
        for acct, kind, value in links:
            holders.setdefault((kind, value), set()).add(acct)
        ignored = {key for key, accts in holders.items() if len(accts) > max_share}

    index = {}            # account -> integer id
    parent = []
    size = []

    def node(acct):
        i = index.get(acct)
        if i is None:
            i = index[acct] = len(parent)
            parent.append(i)
            size.append(1)
        return i

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]       # path halving
            i = parent[i]
        return i

    first = {}            # identifier -> the first account seen holding it
    for acct, kind, value in links:
        a = node(acct)
        key = (kind, value)
        if key in ignored:
            continue
        b = first.setdefault(key, a)
        ra, rb = find(a), find(b)
        if ra != rb:
            if size[ra] < size[rb]:
                ra, rb = rb, ra
            parent[rb] = ra                     # union by size
            size[ra] += size[rb]

    sizes = [size[i] for i in range(len(parent)) if parent[i] == i and size[i] >= min_size]
    sizes.sort(reverse=True)
    return sizes
```

**Explanation.** Accounts are nodes; an identifier is the `(kind, value)` pair. Instead of an edge between every pair of holders, each holder is united with the first holder of that identifier, which gives the same groups with one union per row. Union by size plus path halving makes each operation effectively constant (inverse Ackermann). Repeated rows are harmless: a union of two nodes already together does nothing, and sizes count nodes, not rows. With `max_share`, distinct holders are counted first, because whether an identifier links anyone depends on all rows, not on the rows seen so far; its holders are still created as nodes.

**Complexity.** O(n · α(n)) time and O(accounts + identifiers) memory. The 300 000-row timing test runs in well under a second in CPython. Linking every pair of holders is quadratic in the largest identifier: the hot identifier in the timing test (2 500–4 000 holders) alone gives millions of pairs.

**Dialect notes.** In Spark, connected components run as iterative label propagation (GraphFrames' `connectedComponents` or a hand-written min-label loop); the number of iterations grows with the graph's diameter, so checkpoint between iterations. In SQL, a recursive CTE can propagate minimum labels but is slow on long chains; BigQuery and Snowflake users often loop in a script. In Java or C++, the same array-based union-find applies. Not executed here.

**Edge cases built into the tests.** A group of exactly min_size and one of min_size − 1; a transitive chain across two identifiers; repeated rows; singletons with min_size = 1; (Hard) the same value under two kinds, and a group joined through card, device and bank; (Very Hard) an identifier on exactly max_share accounts (links), on max_share + 1 (ignored), duplicated rows that must not inflate the holder count, and an ignored identifier that must not break other links among its holders.

**Common mistakes.** Keying by value only (cross-kind collisions); counting rows instead of accounts; dropping singletons or accounts whose only identifiers are ignored; deciding max_share on the fly before all rows are seen; recursive find (recursion limit on long chains); pairwise linking.

**Follow-up guidance.** (1) Union-find handles insertions incrementally; deletions do not undo unions, so either rebuild periodically or keep per-link history and recompute affected components. (2) Look at the identifier, not just the count: a shared office device or a platform's own bank account is noise; set thresholds from the distribution and review exceptions. (3) Distributed label propagation with checkpoints, or the "large-star/small-star" algorithm; pre-filter identifiers above max_share in a group-by first. (4) Store the spanning links (account, identifier, first holder) so a path can be shown; never present the group as proof of wrongdoing.

**Rubric anchors.** 2: correct but pairwise or keyed by value only. 3: all tests pass with a near-linear method. 4: also explains incremental and distributed versions and the limits of deletion.

**Strong signals.** Asks what an identifier is before coding; distinguishes rows from accounts. **Red flags.** Treating a group as a fraud verdict; O(n²) linking without noticing.

## STR-L2-03

**Reference solution** (the fixed handler)

```python reference
STATUS = {
    "payment.processing": "processing",
    "payment.succeeded": "succeeded",
    "payment.failed": "failed",
}


class UnknownPayment(Exception):
    pass


def _new_record(amount):
    return {"status": None, "seq": 0, "amount": amount, "refunded": 0, "applied": []}


def _apply(payments, ev):
    pid = ev["payment"]
    if ev["type"] in STATUS:
        rec = payments.get(pid)
        if rec is None:
            rec = payments[pid] = _new_record(ev["amount"])
        if ev["seq"] > rec["seq"]:                      # ignore stale status events
            rec["status"] = STATUS[ev["type"]]
            rec["seq"] = ev["seq"]
            rec["applied"].append(ev["id"])
    elif ev["type"] == "refund.succeeded":
        rec = payments.get(pid)
        if rec is None:
            raise UnknownPayment(pid)
        rec["refunded"] += ev["amount"]                 # integer minor units
        rec["applied"].append(ev["id"])


def process_events(events):
    payments, seen = {}, set()
    acked, retry = [], []
    for ev in events:
        if ev["id"] in seen:                            # one delivery = one event id
            acked.append(ev["id"])
            continue
        try:
            _apply(payments, ev)
        except UnknownPayment:
            retry.append(ev["id"])                      # not acknowledged, not marked seen
            continue
        seen.add(ev["id"])
        acked.append(ev["id"])
    return {
        "payments": {
            pid: {
                "status": rec["status"],
                "amount": rec["amount"],
                "amount_refunded": rec["refunded"],
                "fully_refunded": rec["refunded"] == rec["amount"],
                "applied": rec["applied"],
            }
            for pid, rec in payments.items()
        },
        "acked": acked,
        "retry": retry,
    }
```

**The planted bugs, their symptoms and their fixes.**
1. **Deduplication on the wrong key.** `(payment, type)` is not an event identity: the second partial refund on a payment has the same key and is dropped as a "duplicate". Symptom: refunds missing. Fix: deduplicate on the event `id`.
2. **No ordering.** Every status event overwrites the stored status in arrival order, so a late `payment.processing` (seq 1) overwrites `payment.succeeded` (seq 2). Symptom: payments stuck in "processing". Fix: apply only when `seq` is greater than the stored one.
3. **Float money.** Refunds are kept as `amount / 100` floats: 10 + 20 cents becomes `0.30000000000000004`, which is not equal to `0.3`, and `int(0.29 * 100)` is 28. Symptom: fully refunded payments shown as partly refunded, and off-by-one minor units. Fix: integer minor units throughout.
4. **Swallowed exception, then acknowledged.** A refund that arrives before its payment raises `KeyError`, which `except Exception: pass` hides, and the event is acknowledged; it was also marked seen before processing, so a redelivery would be skipped. Symptom: refunds lost forever. Fix: catch only the expected failure, do not acknowledge, put it in `retry`, and mark seen only after a successful apply.
5. **Mutable default argument.** `_new_record(amount, applied=[])` shares one list across every payment (and across calls). Symptom: every payment's history lists every event. Fix: create a new list per record.

**Explanation.** Webhook handlers must be idempotent (dedupe by event id), order-independent (compare a version or sequence rather than trusting arrival), exact (integer minor units) and honest about failure (only acknowledge what was durably applied). The fix is small; a rewrite is not needed.

**Complexity.** O(n) time, O(events + payments) memory. The timing test is 200 000 deliveries.

**Dialect notes.** The same bugs appear in any language: Java's `double`, JavaScript's `Number` and SQL `FLOAT` columns all misrepresent decimal money; mutable defaults are Python-specific, but a shared static collection is the Java equivalent. Not executed here.

**Edge cases built into the tests.** Two partial refunds; a redelivered status event; refunds of 10 + 20 on 30; a refund of 29; two payments (shared default); a stale status event; a refund before its payment; the same refund redelivered after the payment exists.

**Common mistakes.** Fixing the float bug with `round()` (works for these numbers, still wrong in principle); catching the exception but still acknowledging; acknowledging the redelivered refund without applying it because the id was marked seen; sorting the whole batch by seq (seq is per payment and refunds have none); rewriting the handler from scratch instead of fixing it.

**Follow-up guidance.** (1) Apply and record the event id in one transaction; a crash before acknowledging causes a redelivery that the stored id makes a no-op. (2) Persist processed ids with a TTL longer than the sender's retry period (public webhook docs describe retries over days); a unique constraint on event id is the simplest store. (3) Fetching the current object avoids ordering problems entirely at the cost of an API call per event and rate limits; good for low volume or for critical transitions. (4) Alert on retry age and count; operations owns a queue; the sender's dashboard of failed deliveries is a second signal.

**Rubric anchors.** 2: finds two or three bugs; tests still fail. 3: all five fixed, all tests pass, each explained. 4: also explains the transactional apply-and-record pattern, the retention window of the seen-set, and adds a regression test per bug.

**Strong signals.** Reproduces each bug with a tiny case before fixing it; names the business symptom of each bug. **Red flags.** Removing the try/except entirely so one bad event fails the whole batch; "just use Decimal" without mentioning minor units.

## STR-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Capture.** A log-based CDC connector per shard (Debezium-style, or a managed equivalent) reads the database's change log (WAL/logical replication or binlog) from a replica-safe slot. Each change carries `shard_id, table, primary key, op (c/u/d), before/after, commit log position (LSN), commit timestamp, transaction id, schema_version`. No triggers, no polling on `updated_at`.
- **Snapshot and handoff.** For the largest table, an incremental, chunked snapshot (watermark-based, as in the DBLog approach) or a snapshot taken from a consistent export at a recorded log position, reading from a replica so the primary is not loaded. Changes during the snapshot are streamed concurrently. Overlap is harmless because the merge keeps, per key, the version with the highest log position; snapshot rows are stamped with the position they are consistent at.
- **Transport.** One topic per table (or per table group), keyed by `(shard_id, primary key)` so all changes to a row are in one partition, in log order. Producers are idempotent; consumers commit offsets only after the lakehouse commit.
- **Lakehouse.** Two layers. (a) A raw, append-only change table per source table, partitioned by date and shard, holding every change with its log position: this is the audit history. (b) A current-state table maintained by `MERGE` from micro-batches: within each batch, keep the latest change per key by `(shard_id, log position)`; apply deletes as deletes (or soft deletes with a flag where history must be kept); ignore any change whose position is not newer than the stored one, which makes replays idempotent.
- **Schema evolution.** A schema registry with compatibility rules: added nullable columns flow automatically; renames, type narrowing and drops stop the table's pipeline and page the owning team, rather than writing wrong data. The source team's migrations are reviewed against a data contract.
- **Reconciliation.** Per table, shard and day: row counts by op and sums of amount, fee and net (minor units) computed at the source (from a replica, at a recorded log position) and in the lakehouse at the same position. A mismatch drills down by key range using hashed key buckets. Balance transactions are append-only, so a count and sum per day is a strong completeness proof. Finance closes only on reconciled days.
- **Freshness.** Micro-batches of a minute or two keep the current table within the freshness target; lag per shard is a first-class metric.

**Competing designs to accept.** Streaming merge with Flink or Spark Structured Streaming against scheduled micro-batch MERGE; a managed CDC service; Delta, Iceberg or Hudi (Hudi's record-level upserts suit this well); a warehouse-native ingest. A candidate who keeps only the current-state table must explain how audit history is recovered. Querying `updated_at` is acceptable only for a table where the candidate shows it cannot lose a committed change, which is rarely true.

**Bottlenecks and failure modes.** Snapshot load on the primary; replication slots that pin WAL and fill disks when the connector stops; ordering lost by keying on table only; MERGE cost on huge tables (cluster by key, compact small files); small-file explosion from frequent commits; schema changes that silently drop columns; log position reset on failover; hard deletes that never propagate; time-zone mistakes in daily reconciliation.

**Incident guidance.**
- *Shard failover with non-continuous positions*: positions are per shard and per timeline; the connector must detect the new primary and resume from a position the new primary still has (logical slots must exist on the promoted replica, or the shard is re-snapshotted). Because the merge is idempotent by key and position, a re-snapshot of one shard is safe. Reconcile that shard for the affected window afterwards.
- *About to fall out of log retention*: scale consumers, shed non-critical tables first, and if the gap is unavoidable, plan a re-snapshot of the affected shards rather than continuing with a hole. Alert on lag as a fraction of retention, not on absolute lag, so this is seen hours earlier.
- *Default-valued column rewrites every row*: a burst of updates for every key. Throughput, not correctness, is at risk: the merge is idempotent. Throttle or temporarily snapshot instead of streaming that table; check the schema registry accepted the column as additive; confirm reconciliation sums are unchanged because amounts did not change.

**Follow-up guidance.** (1) Rows seen in both snapshot and stream collapse by key and position. (2) Log position orders commits; `updated_at` reflects statement time, and two transactions can commit out of `updated_at` order or share a timestamp. (3) A rename is a breaking change: stop, alert, migrate with an explicit mapping. (4) Compare per key bucket; typical causes are a dropped delete, a time-zone boundary, or a missed change during a gap. (5) Re-snapshot the shard; prove completeness with counts and sums at a recorded position.

**Rubric anchors.** 2: polling on `updated_at` or nightly export with merges; no snapshot handoff plan. 3: log-based CDC, per-key ordering by log position, idempotent merge, deletes, and count/sum reconciliation. 4: also failover and retention-gap handling, schema contract with blocking for breaking changes, raw history plus current state, and a crisp drill-down method.

**Strong signals.** Asks which log position the snapshot is consistent at; insists finance close only on reconciled days. **Red flags.** "Exactly-once Kafka makes it correct" with no idempotent sink; ordering by arrival time.

## STR-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Creation.** A scheduler decides which balances are due and creates a `payout` row with a deterministic idempotency key, for example `(merchant_id, payout_schedule_date, currency, schedule_run)`, under a unique constraint, in the same transaction as the ledger entries that move funds from the merchant's available balance to a `payouts_in_transit` account. A retried scheduler run hits the constraint and returns the existing payout.
- **State machine.** `created → batched → submitted → (confirmed | rejected | in_doubt) → paid → (returned)`, plus `cancelled` before submission. Every transition is `UPDATE … SET state = :new WHERE id = :id AND state = :expected` (or a version column); zero rows updated means another worker already moved it. Every transition writes an event row for audit.
- **Submission.** A submission `attempt` row (attempt id, file id, bank reference, payload hash) is written before sending. The bank reference is deterministic from the payout id, so a re-sent instruction carries the same reference where the bank deduplicates. Files are built per bank per cutoff from `batched` payouts and recorded with a checksum. A transport timeout leaves the attempt `in_doubt`; it is never resent blindly.
- **Acknowledgement and return ingestion.** Every incoming file is stored raw, identified by a content hash and the bank's file id; each line is keyed by `(bank, file id, line reference)` and applied through the state machine, so a re-sent file is a no-op and a line for an unknown payout goes to an exceptions queue. A status that contradicts the current state (for example "rejected" after "paid") is not applied automatically; it opens a case.
- **Ledger.** Double entry in minor units. Creation: debit merchant available, credit payouts in transit. Confirmed/paid: debit payouts in transit, credit the bank settlement account. Return: reverse into merchant balance (or a returns account pending a new bank account), with the return reason. Balances are derived from the ledger, never stored independently.
- **In-doubt resolution.** An in-doubt payout is resolved only by evidence: a bank status query or portal where available, the next acknowledgement file, or the bank statement. If unresolved after a deadline, operations decides; the system never resubmits an in-doubt payout automatically unless the bank guarantees deduplication on the reference.
- **Reconciliation.** Daily per bank: our submitted and confirmed payouts against the bank's acknowledgement files and the bank statement (amount, count, reference). Three outcomes: matched, ours-only (missing at the bank), bank-only (unknown to us, always a page). An ageing report of in-doubt and unacknowledged payouts.

**Competing designs to accept.** An outbox table plus a queue for submission instead of direct calls; an event-sourced payout aggregate; a workflow engine (Temporal-style) holding the state machine, provided transitions stay idempotent and the ledger is still the source of balance truth. Per-bank adapters behind one interface.

**Bottlenecks and failure modes.** Double creation from a non-deterministic key; resubmission after an ambiguous timeout; acknowledgement files re-sent with new names; race between cancel and submit at a cutoff; returns days later after the merchant has been told "paid"; currency and cutoff-time zone mistakes; a bank that rejects a whole file for one bad line.

**Incident guidance.**
- *Timeout just before cutoff*: mark the attempt in_doubt; check the bank's transport receipt, file listing or status endpoint; if the bank deduplicates on reference, resubmitting the same file with the same references is safe; otherwise wait for the acknowledgement and escalate to the bank before the next cutoff. Tell affected merchants the payout is delayed, not failed.
- *Re-sent acknowledgement file with changed statuses*: content hash differs, so line-level keys catch the repeats; lines whose status conflicts with the applied one open cases instead of flipping state. Contact the bank about which file is authoritative.
- *Changed idempotency key derivation re-creates 1 200 payouts*: stop the scheduler and submissions for the affected batch before the cutoff; cancel the duplicates that have not been submitted; for any submitted, request recalls and record receivables; add a uniqueness constraint on the business key `(merchant, schedule date, currency)` independent of how the idempotency key is derived, and a pre-submission check that sums per merchant against the available balance.

**Follow-up guidance.** (1) The attempt row was written before sending; on restart, an attempt with no outcome becomes in_doubt and is resolved from bank evidence. (2) Duplicate file: no-op by keys; unknown payout: exceptions queue and a page. (3) A return reverses the ledger and moves the payout to returned; the merchant's balance is restored and they are asked for new bank details. (4) Expect the four entry pairs above, amounts in minor units, balances from sums. (5) Show "delayed" to merchants, escalate to the bank, and never auto-resend.

**Rubric anchors.** 2: retries without an in-doubt state; status column updated without conditions; no ledger. 3: deterministic idempotency key with a unique constraint, conditional transitions, idempotent ingestion, reconciliation. 4: also the attempt model, evidence-based in-doubt resolution, correct ledger entries for returns, and a credible answer to the key-derivation incident.

**Strong signals.** Says plainly that exactly-once stops at the bank boundary; designs the human queue. **Red flags.** "Retry until success" for submissions; balances stored as a mutable column separate from the ledger.
