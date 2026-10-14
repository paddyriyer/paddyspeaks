# Confluent · Loop 2 — evaluator notes (hidden from candidates)

## CFL-L2-01

**Reference solution**

```python reference
import heapq


def rebalance(partitions, members, owned):
    if not members:
        return {}
    exists = set(partitions)
    group = set(members)
    claim = {}                                   # partition -> (generation, member or None)
    for member, generation, parts in owned:
        if member not in group:
            continue                             # a member that left keeps nothing
        for p in parts:
            if p not in exists:
                continue                         # the partition was deleted
            cur = claim.get(p)
            if cur is None or generation > cur[0]:
                claim[p] = (generation, member)
            elif generation == cur[0] and cur[1] != member:
                claim[p] = (generation, None)    # a tie at the top generation: nobody keeps it
    retained = {m: [] for m in members}
    for p, (_g, m) in claim.items():
        if m is not None:
            retained[m].append(p)

    q, extra = divmod(len(partitions), len(members))
    by_load = sorted(members, key=lambda m: (-len(retained[m]), m))
    quota = {m: q + (1 if i < extra else 0) for i, m in enumerate(by_load)}

    result, kept = {}, set()
    for m in members:
        keep = sorted(retained[m])[:quota[m]]    # keep the lowest, release the highest
        result[m] = keep
        kept.update(keep)

    heap = [(len(result[m]), m) for m in members if len(result[m]) < quota[m]]
    heapq.heapify(heap)
    for p in sorted(p for p in partitions if p not in kept):
        load, m = heapq.heappop(heap)
        result[m].append(p)
        if load + 1 < quota[m]:
            heapq.heappush(heap, (load + 1, m))
    for m in members:
        result[m].sort()
    return result
```

**Explanation.** The answer is fixed by the four rules, so the work is to apply them in the right order and fast. Claims are resolved in one pass: each partition keeps the best `(generation, member)` seen so far, and a second claim at the same top generation from a different member marks it unowned. A claim from a member that left, or on a partition that no longer exists, is skipped. Quotas come from one sort of the members by `(-retained, id)`. Giving the P mod C extra places to the members that retain the most maximises Σ min(retainedᵢ, quotaᵢ), which is exactly the number of partitions that stay put, so no balanced assignment moves fewer. Each member keeps the lowest of its retained partitions up to its quota. The free partitions, sorted, are placed with a heap keyed by `(load, member)` that holds only members below quota. Popping gives the least-loaded member with room and the smaller id on ties, and the member goes back in only if it still has room. The heap never runs dry, because the quotas add up to P.

**Complexity.** O(P log P) for sorting partitions, O(C log C) for the quotas, and O(F log C) for placing F free partitions. The timing test (200 000 partitions, 3 900 members, about 150 000 free) runs in about 0.8 s in CPython. Scanning every member for each free partition is O(F·C), about 6·10⁸ steps, and did not finish in 60 s.

**Dialect notes.** In Java the same structure is a `PriorityQueue` of members with a comparator on (load, id), and partitions are compared on (topic, partition) with `Comparator.comparing(...).thenComparingInt(...)`. Kafka's own assignors live in the client library; real sticky assignors also aim at balance first and stickiness second, but their tie-breaking differs from this exercise's rules. A SQL formulation (row numbers per member for keeps, then a window over free partitions) is possible for the quota step but awkward for the heap step. Not executed here.

**Edge cases built into the tests.** A fresh group with no claims; one member leaving; one member joining, so members above quota release their highest partitions; more members than partitions; equal retained counts, where the extra place goes to the smaller id; claims from a member that left; a partition count that divides evenly; an empty group (`{}`); partition numbers 2 and 10, which must sort numerically; (Hard) a new partition and a claim on a deleted partition, and joins and leaves together; (Very Hard) a duplicate claim won by the newer generation, and one at the same generation that leaves the partition unowned.

**Common mistakes.** Assigning from scratch with round robin or ranges (balanced, but it moves most partitions); keeping every retained partition and only balancing the rest (an overloaded member stays overloaded); giving the extra places by member id instead of by retained count (balanced, but moves more and fails the tests); releasing the lowest partitions instead of the highest; sorting partitions as strings such as `"orders-10"`; letting a same-generation tie go to the first claimant in input order; counting a departed member's claims; scanning members per partition.

**Follow-up guidance.** (1) In the classic consumer group protocol the coordinator picks one member as the group leader, the leader runs the assignor with every member's subscription and owned partitions, and the coordinator distributes the result. Newer protocol versions move assignment to the broker; check current docs. Each member must send its subscription and what it owned, with its generation. (2) That is the cooperative (incremental) idea: compare old and new ownership, revoke only partitions that change owner, and assign them in a second round, so the rest keep consuming. (3) Weighted quotas: share P in proportion to capacity with a largest-remainder rule. "Fewest moves" is still Σ min(retained, quota), maximised the same way. (4) Balancing by load is a bin-packing problem. Good answers bound the movement per rebalance (move only while imbalance is above a threshold), use measured rates with smoothing, and accept a little imbalance to avoid churn.

**Rubric anchors.** 2: a balanced assignment that ignores stickiness, or a sticky one that is not balanced; several edge tests fail. 3: all tests pass, with a heap or an equivalent O(log C) placement. 4: also proves why the quota rule minimises moves, resolves claims in one pass, and gives a convincing account of cooperative rebalancing and weighted load.

**Strong signals.** Computes quotas before placing anything; asks how ties at the top generation are resolved; notices that sorting partition names as strings is wrong. **Red flags.** "Just reassign everything round robin, it's balanced"; no estimate of the cost of scanning members per partition.

## CFL-L2-02

**Reference solution**

```python reference
def visible_records(log, high_watermark, start=0, isolation="read_committed"):
    if isolation == "read_uncommitted":
        return [o for o, _p, kind in log
                if start <= o < high_watermark and kind in ("data", "txn")]
    open_txn = {}                  # producer -> offsets of its open transaction, in order
    committed = set()
    for o, p, kind in log:
        if o >= high_watermark:
            break                  # not replicated yet: neither records nor markers count
        if kind == "txn":
            open_txn.setdefault(p, []).append(o)
        elif kind == "commit" or kind == "abort":
            offsets = open_txn.pop(p, None)      # a marker with no open transaction does nothing
            if offsets and kind == "commit":
                committed.update(offsets)
    lso = min((offs[0] for offs in open_txn.values()), default=high_watermark)
    out = []
    for o, _p, kind in log:
        if o >= lso:
            break
        if o >= start and (kind == "data" or (kind == "txn" and o in committed)):
            out.append(o)
    return out
```

**Explanation.** One forward sweep up to the high watermark keeps, for each producer, the offsets of its open transaction. A `"txn"` record joins its producer's open transaction (creating one if needed). A marker pops that producer's open transaction: on commit its offsets become committed, on abort they are dropped, and a marker with nothing open does nothing. Entries at or above the high watermark are not visible, so the sweep stops there, and a marker beyond it leaves its transaction open. Whatever is still open sets the last stable offset: the smallest first offset among open transactions, which can be below `start`. A second pass returns offsets in `[start, lso)` that are non-transactional or committed. `read_uncommitted` needs no transaction state at all.

**Complexity.** O(n) time, O(n) memory in the worst case for open transactions and committed offsets. The timing test (300 000 entries, 200 producers, about 7 000 aborted transactions) runs in about 0.2 s in CPython. Checking each record against the list of aborted transactions did not finish in 40 s, and scanning ahead from each record to its producer's next marker took about 20 s.

**Dialect notes.** In Kafka's Java consumer the broker returns, with each fetch, the aborted transactions (producer id and first offset) that overlap the fetched range, and the client filters batch by batch: it adds a producer to an "aborted" set when it reaches that first offset and removes it at the producer's abort marker. That keeps memory bounded per fetch instead of per log. A SQL version is a window per producer that numbers transactions by counting earlier markers, then a join to each transaction's ending marker. Not executed here.

**Edge cases built into the tests.** Committed and aborted transactions interleaved with non-transactional records; an open transaction that stops the read at its first record, including non-transactional records after it; a committed transaction with records above the last stable offset; two transactions in a row from one producer; only non-transactional records; an empty log; (Hard) a commit marker exactly at the high watermark, a start offset part-way in, and `read_uncommitted` returning aborted records; (Very Hard) markers with no open transaction, an open transaction that began before `start` (nothing returned), and gaps in offsets.

**Common mistakes.** Returning non-transactional records past the last stable offset; reading markers at or above the high watermark; treating a stray marker as ending the producer's next transaction; returning a committed transaction's records above the last stable offset; computing the last stable offset only from records at or after `start`; returning marker offsets; for `read_uncommitted`, dropping aborted records; per-record scans of all aborted transactions.

**Follow-up guidance.** (1) The last stable offset is stuck at the hung transaction's first record, so every `read_committed` consumer of that partition stops advancing, and their lag grows while producers keep writing. It clears when the transaction times out and is aborted. Watch the gap between high watermark and last stable offset, and open transaction age. (2) Use the aborted-transaction list with first offsets: walk batches in order, track aborted producers in a set, and drop their records until their abort marker. (3) Consume-transform-produce in one transaction, with offsets committed in the same transaction, gives exactly-once between topics. A database sink needs idempotent writes or offsets stored in the database's own transaction. (4) Compaction can remove aborted records and, after the transaction is fully cleaned, the markers too, but only after a retention period, so that consumers in the middle of a read still see a marker. Strong candidates say the exact rules are version-dependent and point to the docs.

**Rubric anchors.** 2: filters aborted records but ignores the last stable offset or the high watermark; several edge tests fail. 3: all tests pass with a linear sweep. 4: also explains why the last stable offset exists (a transaction could still commit, and ordering must hold), answers the hung-transaction and batch-by-batch questions with specifics.

**Strong signals.** Asks what happens to a marker beyond the high watermark; notices that non-transactional records are cut off by the last stable offset too. **Red flags.** "Just skip aborted records" with no notion of open transactions; sorting the log.

## CFL-L2-03

**Reference solution** (the fixed checker)

```python reference
# (writer type -> reader types that can read it)
PROMOTIONS = {
    "int": {"long", "float", "double"},
    "long": {"float", "double"},
    "float": {"double"},
    "string": {"bytes"},
    "bytes": {"string"},
}


def _type_ok(reader_type, writer_type):
    if isinstance(reader_type, dict) and isinstance(writer_type, dict):
        # enums: every symbol the writer can produce must exist in the reader,
        # unless the reader has a default symbol to fall back on
        return set(writer_type["enum"]) <= set(reader_type["enum"]) or "default" in reader_type
    if isinstance(reader_type, dict) or isinstance(writer_type, dict):
        return False                     # an enum and a primitive never match
    return reader_type == writer_type or reader_type in PROMOTIONS.get(writer_type, ())


def _unreadable_fields(reader, writer):
    """Names of the reader's fields it cannot fill from data written with writer."""
    written = {f["name"]: f for f in writer["fields"]}
    bad = []
    for rf in reader["fields"]:
        wf = written.get(rf["name"])
        if wf is None:
            if "default" not in rf:      # a default of 0, "", False or None is still a default
                bad.append(rf["name"])
        elif not _type_ok(rf["type"], wf["type"]):
            bad.append(rf["name"])
        elif wf.get("optional") and not rf.get("optional"):
            bad.append(rf["name"])       # the writer may send null; the reader cannot hold it
    return bad


def check_compatibility(new_schema, previous, mode):
    """previous: registered versions, oldest first (version 1 is previous[0]).
    Return sorted [version, "backward" | "forward", field] conflicts; [] if compatible."""
    if mode == "NONE" or not previous:
        return []
    versions = list(range(1, len(previous) + 1))
    if not mode.endswith("_TRANSITIVE"):
        versions = versions[-1:]         # only the latest version
    base = mode.replace("_TRANSITIVE", "")
    conflicts = []
    for v in versions:
        old = previous[v - 1]
        if base in ("BACKWARD", "FULL"):          # the new schema reads old data
            conflicts += [[v, "backward", f] for f in _unreadable_fields(new_schema, old)]
        if base in ("FORWARD", "FULL"):           # old schemas read new data
            conflicts += [[v, "forward", f] for f in _unreadable_fields(old, new_schema)]
    return sorted(conflicts)
```

**The planted bugs, their symptoms and their fixes.**
1. **Promotion checked in the wrong direction.** `PROMOTIONS` maps a writer type to the reader types that can read it, but `_type_ok` looks up the reader's type and tests the writer's. Symptom: widening `int` to `long` is rejected under `BACKWARD`, and narrowing `long` to `int` is accepted and breaks consumers. Fix: `reader_type in PROMOTIONS.get(writer_type, ())`.
2. **Falsy default treated as no default.** `if not rf.get("default")` treats `0`, `""`, `False` and `None` as missing. Symptom: a new field with default `0`, or an optional field with a null default, is rejected. Fix: `if "default" not in rf`.
3. **Reader enum default ignored.** The enum check requires every writer symbol to be a reader symbol even when the reader's enum has a default symbol. Symptom: adding a symbol is rejected under `FORWARD` although the old enum has a default. Fix: `... or "default" in reader_type`.
4. **The oldest version checked instead of the latest.** `previous` is oldest first, and `versions[:1]` takes version 1. Symptom: a schema compatible with the latest version is rejected because of an old one, and a breaking change against the latest can pass. Fix: `versions[-1:]`.
5. **Optional rule reversed.** The code flags a reader that is optional when the writer is required, which is safe, and misses a writer that may send null to a reader that cannot hold it. Symptom: making an optional field required passes `BACKWARD`, and old records with nulls fail to read. Fix: `elif wf.get("optional") and not rf.get("optional")`.

Each bug has its own failing checks and passes the others: widening and narrowing (1), default `0` and null default (2), the enum with a default symbol (3), the two-version non-transitive case (4), and optional to required and back (5). The "new field without a default" and "enum without an old default" checks pass on the original code, which is worth noting: the buggy checker is not wrong everywhere.

**Explanation.** Every mode reduces to one question asked in one or both directions: can this reader schema read data written with that writer schema? Getting the reader and the writer right is the whole problem. `BACKWARD` makes the new schema the reader of old data. `FORWARD` makes the old schema the reader of new data. Promotions, optional fields and enum symbols all depend on which side is which. Defaults matter only on the reader's side, for fields the writer does not have, and their presence is what counts.

**Complexity.** O(V·F) for V versions checked and F fields, with a dict per writer schema. The timing test (300 versions of 300 fields, `FULL_TRANSITIVE`) runs in about 0.15 s in CPython.

**Dialect notes.** The registry's real checks use the Avro library's schema resolution, which also covers nested records, unions, arrays, maps, aliases, logical types and fixed sizes. Protobuf and JSON Schema have different rules: in Protobuf, renaming a field is wire-compatible but changing a field number is not. In Java, `SchemaCompatibility.checkReaderWriterCompatibility(reader, writer)` from the Avro library takes the reader first, which is the same trap as bug 1 at API level. Not executed here.

**Edge cases built into the tests.** Widening and narrowing; a new field with default `0`; a new optional field with a null default; new fields without a default, optional or not; removing a field the old schema needs under `FORWARD`; enum symbols added with and without an old default symbol; a two-version history under a non-transitive mode; optional to required and required to optional; `NONE`; an enum against a string; nothing registered; (Hard) `FULL` in both directions; (Very Hard) a transitive mode over every version and `FULL_TRANSITIVE` with enum defaults.

**Common mistakes.** Fixing the promotion bug by swapping the arguments at the call sites, which also swaps the default and optional logic; replacing `not rf.get("default")` with `rf.get("default") is None`, which still rejects a null default; making transitive mode check only the latest; letting optional imply a default; rewriting the checker instead of making minimal fixes.

**Follow-up guidance.** (1) Under `FULL_TRANSITIVE` a rename is add-new-field-with-default, migrate producers and consumers to write and read both, then remove the old field once every registered version and every consumer allows it. It takes several releases, and some teams use a new subject instead. (2) A consumer on an old schema reading new data is a forward problem: `BACKWARD` does not protect it. If consumers upgrade after producers, the subject needs `FORWARD` or `FULL`. (3) Semantic changes (a field's unit changes from cents to dollars), producers that bypass the registry, consumers using a different reader schema than assumed, or a mode changed on the subject after the fact. (4) Check the shared type against every subject that references it, under each subject's own mode, and block the change if any fails.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also states the reader/writer framing for every mode, adds a regression test per bug, and answers the rename and mode-choice follow-ups concretely.

**Strong signals.** Names the reader and the writer before reading any code; spots that `None` is a legitimate default; asks which order `previous` is in. **Red flags.** "Just make the mode NONE"; treating `BACKWARD` and `FORWARD` as the same check.

## CFL-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Collection.** A collector per cluster, sharded by group id across a few workers. Every {{sample_every}} it lists groups, reads committed offsets per group with batched admin calls, and reads log-end offsets once per partition, shared by every group that reads it, not once per group. Each sample is `(cluster, group, topic, partition, committed_offset, log_end_offset, sampled_at)`, with the group's state (stable, rebalancing, empty) and generation.
- **Time lag.** Two estimates, both kept. (a) Rate-based: offset lag divided by the partition's recent produce rate, from log-end deltas. It is cheap, but wrong on bursty or quiet topics. (b) Timestamp-based: for partitions with lag, look up the timestamp of the record at the committed offset (a single-record fetch or an offset-for-timestamp index, cached per partition and offset), so time lag = now − that timestamp. It is exact when timestamps are sane. Use (b) for paging where available, clamp negative values, and flag timestamps outside a sane window.
- **State per partition.** Over a sliding window of N samples: is the committed offset moving? Is lag shrinking, flat or growing? Classify as OK, catching up, stalled (committed offset still while log-end moves), stopped (no commit for longer than the group's commit interval allows, even with small lag), or idle (log-end not moving, lag zero or tiny). Roll up per group as the worst partition, plus the count of affected partitions.
- **Alerting.** Per group: raise when the time lag exceeds {{page_after}} for M consecutive samples, or the group is stalled for longer than its tolerance; clear only when lag is below a lower threshold for K samples (hysteresis). Suppress while the group is rebalancing, but escalate if rebalancing lasts longer than a bound. Thresholds live in a config store per group, owned by the team, with platform defaults. Alerts carry partitions, onset time and a link to the lag chart.
- **Storage and cost.** Keep raw per-partition samples for a short window (hours) in a store sized for it, and keep per-group rollups (max time lag, total offset lag, stalled partition count) as long-lived metrics. That avoids millions of long-lived series at {{partitions}} partitions. Deleted groups are detected by the listing and their alerts closed.

**Competing designs to accept.** Exporting per-partition lag as metrics to a time-series system with recording rules for group rollups (accept if cardinality is addressed); a streaming job that reads the internal offsets topic and log-end offsets and computes lag continuously; client-side lag metrics from consumers that publish them (accept as a complement, since not every consumer can be changed). Open-source lag checkers that evaluate a sliding window of offsets are a reasonable reference point.

**Bottlenecks and failure modes.** Fetching log-end offsets per group rather than per partition; one admin call per partition; timestamp lookups for every partition every cycle; series cardinality; alerts on instantaneous values; rebalances paging; stale alerts for deleted groups; producer clock skew; the collector itself lagging and producing gaps that look like stalls.

**Incident guidance.**
- *A third of the groups rebalance every few minutes for an hour*: alerts are suppressed while each group is rebalancing, but a group that spends most of a window rebalancing is a problem in itself, so raise one aggregated alert ("rebalance storm after client upgrade") rather than thousands of pages. Correlate with the deploy, and show time spent rebalancing per group.
- *Records stamped nine hours in the future*: timestamp-based time lag goes negative or tiny. Clamp, flag the topic's timestamps as untrusted, and fall back to the rate-based estimate for it. Tell the producer team, and record the skew as a data quality signal.
- *The collector falls behind*: samples arrive late and uneven, and a naive rule would read the gaps as stalls. Store `sampled_at` and compute rates from actual intervals. Mark windows with missing samples as unknown, never as stalled. Shard the collector further or reduce timestamp lookups to lagging partitions only, and alert on the collector's own cycle time.

**Follow-up guidance.** (1) With suppression during rebalancing and a bound on how long that can last, nothing pages for short rebalances, and a 20-minute storm raises one rebalancing alert, not a lag page. After the jump, lag recovers and no alert fires. (2) Time lag goes negative; clamp and flag it, and use the rate-based estimate. (3) No: lag is zero and log-end is not moving, so it is idle, not lagging. It becomes a problem only if new records arrive and the committed offset does not move, which the stalled rule catches. (4) Sample quiet or healthy groups less often, keep lagging ones at full rate, and compute timestamps only for partitions with lag. You lose resolution on how fast healthy groups recover. (5) Use the recent net consume rate (consume minus produce). Show it only when the rate has been stable over the window and the forecast horizon is short; never extrapolate across a rebalance or a burst.

**Rubric anchors.** 2: one offset-lag threshold for every group, evaluated on instantaneous values; no time lag; no stall detection. 3: offset and time lag defined, window-based states including stalled and idle, hysteresis, per-group thresholds, collection costed. 4: also timestamp failure modes handled, rebalances and collector gaps treated explicitly, cardinality controlled with rollups, and each incident answered concretely.

**Strong signals.** Separates "is the committed offset moving" from "how far behind is it"; asks whose clock sets the timestamp; reads log-end offsets once per partition. **Red flags.** "Page when lag > 10 000"; a design that cannot tell an idle topic from a stuck consumer.

## CFL-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Classify errors.** Conversion (deserialising or schema lookup failures), transformation (a single-message transform fails), and write errors. Write errors split into transient (timeouts, throttling, target unavailable: retried with backoff up to a bound, never dead-lettered) and deterministic per-record rejects (a value too large, a constraint violation: dead-lettered). Unknown errors are retried a few times, then treated as deterministic.
- **Dead-letter topic.** One per connector (or per source topic for shared connectors), named after it, with the same access control as the source topic and the same or shorter retention. Keyed like the source, so per-key order survives. Each record keeps the original key, value and headers, with context headers added: source topic, partition and offset, connector and task, failure stage, error class and message (truncated, scrubbed of values), first-failure time, and attempt count. Configure the framework to add context headers where it can, and add the rest in the connector's error path.
- **Tolerance with a guard.** Tolerate individual bad records, but stop the connector when the dead-letter rate exceeds a threshold over a window (for example 5% over 5 minutes) or a count per hour, because a flood means a deploy problem, not bad records. Stopping keeps the source offsets in place, so nothing is lost.
- **Restarts.** The connector commits source offsets only after a record is written or dead-lettered, so a restart reprocesses from the last commit. Dead-letter writes can repeat after a crash, so deduplicate by (source topic, partition, offset) at replay time, not at write time.
- **Monitoring.** Dead-letter records per minute per connector and per error class, age of the oldest unreplayed record, and the ratio to records processed. Alerts go to the owning team of the source topic, with a link to sample records (masked) and the error class.
- **Replay.** A replay tool reads the dead-letter topic for one connector and an error class or offset range, applies the fix (a new converter, a schema mapping, or corrected data from the producer), and writes to the target through the same idempotent path: upsert by key with a version check (source offset or record timestamp) so an older replayed value never overwrites a newer one. For append-only targets, deduplicate on (source topic, partition, offset) stored as a column. The tool records which dead-letter offsets it has replayed, and completeness is proven by reconciling the set of dead-lettered source offsets against those written to the target.
- **Personal data.** Dead-letter topics inherit the source's classification and retention, and erasure jobs cover them. Error messages must not copy field values into headers.

**Competing designs to accept.** Dead-lettering to object storage instead of a topic (accept if ordering, access and replay are addressed); a quarantine table in the target itself with a status column; a central dead-letter service shared by all connectors with per-team partitioning and access control. Each is fine if records keep their source coordinates and replay is idempotent.

**Bottlenecks and failure modes.** Dead-lettering transient errors (a target outage empties the topic into the dead-letter topic); tolerance without a rate guard; dead-letter topics with broader access than the source; context headers that copy personal data; replays that overwrite newer values; replays run twice; dead-letter retention shorter than the time teams need to fix things; no owner, so dead-lettered records sit forever.

**Incident guidance.**
- *40% of one topic's records are dead-lettered after a producer deploy*: the rate guard stops that connector within minutes, its source offsets stay put, and the alert names the error class and the producing team. The producer rolls back or fixes, and the connector restarts from its committed offsets. Records already dead-lettered are replayed with the fix, deduplicated by source offset.
- *The target refuses writes for 25 minutes*: these are transient errors, so they are retried with backoff and nothing is dead-lettered. When the retry bound is reached, the connector fails and is restarted by the platform once the target is back, from its committed offsets. Lag grows and recovers. A design that dead-letters here creates millions of replays.
- *A replay started twice*: the replay tool takes a lock per connector and error class, and both runs write through the idempotent path, so the target is unchanged by the second run. Append-only targets rely on the (topic, partition, offset) deduplication column. The replay ledger shows the double run.

**Follow-up guidance.** (1) The rate guard stops the connector; good records behind the flood wait instead of being mixed with 40% losses; one alert to the producer team; resume after the fix. (2) Read the dead-letter topic by connector and error class, apply the fix, write through the idempotent upsert path with version checks, throttle to protect the live connector, track replayed offsets, and reconcile at the end. (3) Compare versions: the source offset (or a record version or timestamp) is stored with each row, and the write is conditional on it being newer. (4) Easy if dead-letter topics are keyed and classified like the source and replay copies are tracked; hard if records were copied into tickets, logs or headers. (5) A daily report per team from the dead-letter topic and the replay ledger: unreplayed records by error class and age, with links.

**Rubric anchors.** 2: "set tolerance to all and send errors to a dead-letter topic", with no context, no guard and no replay plan. 3: errors classified with transient retries, dead-letter topics with full source context and access control, a rate guard, idempotent replay. 4: also per-key ordering on replay, completeness proven by source offsets, personal data handled in dead-letter copies, and each incident answered concretely.

**Strong signals.** Refuses to dead-letter transient errors; keeps source topic, partition and offset as the record's identity; asks how the target resolves an older value arriving late. **Red flags.** Skipping errors silently; replay by "just reset the connector's offsets" with no thought for duplicates.
