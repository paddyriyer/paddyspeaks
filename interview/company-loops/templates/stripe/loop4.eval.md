# Stripe · Loop 4 — evaluator notes (hidden from candidates)

These are reference designs for simulated scenarios, not descriptions of any
company's systems. Score the candidate's reasoning against the criteria; a
different design that meets the constraints scores as well as this one.

## STR-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Two inputs, two roles.** Money comes only from the ledger's change stream (balance transactions: `id, account_id, type, amount, fee, net, currency, created, available_on, source_id`), read through change-data capture or an outbox. Payment-state events (`payment_id, attempt_id, account_id, status, decline_code, event_ts`) feed success rates and funnels, never money totals. This keeps every money number traceable to the ledger.
- **Exact aggregation.** A stream job upserts per `(account_id, settlement_currency, bucket_start, type)` the sums of `amount`, `fee`, `net` (64-bit integers in minor units) and a count. Idempotency comes from the ledger id: either keep a dedup set of applied ids with a TTL longer than the maximum replay (cheap because ids arrive roughly in order per partition), or write each transaction once to a keyed fact table and recompute the touched buckets from it. Sums are mergeable, so the exact path can also be fresh.
- **Buckets that survive time zones.** Use 15-minute UTC buckets (every real offset is a multiple of 15 minutes; UTC+05:30 and UTC+05:45 break hourly buckets). A merchant's day is the sum of 96 buckets shifted by its offset, with DST transitions handled by computing the day's UTC range per date. Changing the reporting zone then needs no recompute of buckets, only a different range.
- **Success rate.** Per payment: the latest state of each `payment_id` in the period (succeeded or not), numerator and denominator stored separately; per attempt: attempts and successful attempts. Rates are divided at read time; never average rates across hours or merchants.
- **Late changes.** Refunds and disputes are dated by their own ledger time, not the original payment's, so a late refund lands in today's bucket; no closed bucket is rewritten. Payment-state events arriving late update the payment's latest state, which can move a past day's success rate; label those days "may still change" until a lateness horizon passes.
- **Serving.** A real-time OLAP store (or a key-value store of pre-aggregated rows) partitioned by `account_id`, with rollups per day for the long range. For platforms, a second rollup keyed by `platform_id` maintained in the same job (connected-account membership is a slowly changing dimension, so record membership by time). Every response carries an `as_of` watermark.
- **Finalisation.** After the lateness horizon, a batch job recomputes each merchant-day from the ledger fact table and compares it with the streamed rows; equal rows are marked final, differences page the owner and the batch value wins. Payout figures come from the ledger's payout records, not from the analytics rollups.
- **Currencies.** Totals are kept per settlement currency. Converted totals use a rate fixed per transaction at a defined point (for example the rate at the transaction's time) and stored with the converted value, labelled as converted; they are never summed into "exact" totals.
- **Isolation.** Tenant id on every row and a mandatory filter enforced in the serving layer (row-level policy), tested with cross-tenant probes.

**Competing designs to accept.** Lambda-style batch plus speed layer if the candidate explains which wins and when. Warehouse-only with micro-batches every minute if freshness is "5 minutes" and the cost is priced. Pure event-sourced recomputation from the ledger table with incremental materialised views. Any of these is fine if money stays integer and idempotent.

**Bottlenecks and failure modes.** Hot merchant partitions; dedup state growth; timezone-offset errors; success rate averaged; converted totals mixed with exact totals; refunds attributed to the payment's original day (makes closed days change); platform rollups that miss accounts that joined or left mid-period.

**Incident guidance.**
- *Flash sale hot partition*: the key is account_id, so one partition is overloaded. Short term: add consumers only helps if partitions split; use a two-stage aggregation (salt the key into N sub-keys for the merchant, pre-aggregate, then merge) for known heavy accounts; label the affected merchants' dashboards with the real `as_of`. Prevention: per-partition lag alerts, automatic salting above a throughput threshold, capacity tests at 15% skew.
- *CDC replay of 3 hours*: idempotent upserts keyed by ledger id mean nothing doubles. If the design used plain increments, the fix is to recompute the affected buckets from the ledger fact table and republish; prevention is to make the sink idempotent and alert on a jump in duplicate ids.
- *UTC+05:30 mismatch*: likely hourly buckets rolled up in UTC or in a whole-hour offset, or the payout report covers funds by `available_on` while the dashboard counts by `created`. Diagnose by comparing at transaction level for that day; fix with 15-minute buckets and clear definitions on both reports.
- *FX feed stall*: converted totals are flagged stale with the rate's timestamp; settlement-currency totals are unaffected. When the feed returns, recompute converted values for the window if the policy is "rate at transaction time"; never let this touch exact totals.

**Follow-up guidance.** Push on success-rate definitions (retries, 3-D Secure abandonment), time-zone changes, and the 312-minor-unit diff (expect: compare at ledger id, check late refunds, dedup misses, zone boundaries, currency exponent errors).

**Rubric anchors.** 2: sums from payment events with floats, no dedup, rates averaged. 3: ledger-sourced integer sums, idempotent writes, numerator/denominator, as-of labels, some tenant isolation. 4: also time-zone-safe buckets, finalisation against the ledger, platform rollups with membership history, hot-merchant handling, and clean answers to every incident.

**Strong signals.** Asks which numbers must match payouts before drawing; separates money from state; names the minor-unit and currency-exponent issue unprompted. **Red flags.** "Divide by 100" in the pipeline; recomputing everything from scratch on every dashboard load; one shared table without tenant enforcement.

## STR-L4-02

**Reference architecture.**
- **Fan-out.** A fan-out service reads the event log, looks up subscriptions for the event's account (and the platform's endpoints for connected-account events) from a cached subscription index, and writes one delivery record per endpoint: `delivery_id, event_id, endpoint_id, attempt, next_attempt_at, state`. The event log stays the single durable copy of the payload; deliveries reference it.
- **Scheduling.** Deliveries are sharded by `endpoint_id` into a moderate number of partitions. Within each shard, a scheduler keeps a timer structure (a time-bucketed delay queue or a hierarchical timing wheel backed by a store ordered by `next_attempt_at`) and hands due deliveries to workers. Logical per-endpoint queues live in the store, not as broker topics.
- **Workers and isolation.** Workers use non-blocking I/O with short connect and response timeouts. Each endpoint has a concurrency cap and a circuit breaker; endpoints classified as slow or failing move to a separate, smaller worker pool (a "slow lane"), so they cannot take workers from healthy endpoints. Scheduling across accounts is fair (weighted round robin), so one huge platform cannot starve small merchants.
- **Retries.** Capped exponential backoff with jitter, for up to the retry window; once an endpoint has been failing for hours, attempts drop to a slow probe (one canary delivery), and the rest wait until the probe succeeds. After the window, deliveries stop, the merchant is notified, and the endpoint may be disabled per policy; events remain fetchable and resendable within the event retention period.
- **Recovery ramp.** When a dead endpoint's probe succeeds, release its backlog with a ramp (slow start on concurrency, as TCP does), not all at once.
- **Guarantees.** At least once. Each payload carries the event id and created time; receivers dedupe on event id. No ordering is guaranteed; the recommended pattern is to treat the event as a signal and fetch the current object state. If offered at all, per-object ordering costs head-of-line blocking and should be opt-in.
- **Security.** Payloads signed with an HMAC over timestamp and body using a per-endpoint secret; receivers reject old timestamps to resist replay; secrets rotate with an overlap. SSRF: resolve DNS at connect time, block private, loopback, link-local and metadata address ranges, pin the resolved IP for the connection (defeats DNS rebinding), send from egress proxies with no internal network access.
- **Observability.** Every attempt is recorded (status, latency, response code, truncated body) and visible to the merchant; metrics per endpoint and per shard; delivery-age SLO for healthy endpoints.

**Competing designs to accept.** A broker topic per shard with a separate retry topic per backoff tier (good if they handle tiers' head-of-line blocking). A database-backed scheduler with `next_attempt_at` index, if they show it scales by sharding. A managed queue per delivery with visibility timeouts, if they address cost and fairness.

**Bottlenecks and failure modes.** Worker exhaustion by hung endpoints; physical queue per endpoint; synchronized retries (thundering herd); backlog storage for long-dead endpoints; fan-out amplification for platform accounts; subscription index staleness; SSRF; duplicate deliveries during worker crashes (expected and acceptable under at-least-once).

**Incident guidance.**
- *15% of endpoints hanging*: diagnose by worker time spent waiting per endpoint group. Shorten timeouts, trip breakers per endpoint, move them to the slow lane, cap concurrency per destination host or IP block; healthy-endpoint latency is the SLO to protect. Prevention: classification by recent latency, and a test that injects hangs.
- *Platform endpoint down for two days*: deliveries back off to a probe; the backlog lives in the store (cost: per-delivery record of tens of bytes plus the event payload already stored once). Notify the platform; offer a resend after recovery; make sure their volume does not dominate the shard (fairness).
- *Backlog released at once*: ramp the release; respect concurrency caps and any rate-limit responses from the endpoint; deliver newest-first or oldest-first per policy and tell the merchant. Prevention: slow start on recovery.
- *"Never arrived" with a 200 on record*: show the attempt log (time, response code, latency, the receiver's response body). The receiver acknowledged before processing, or a proxy answered. Offer a resend; recommend verifying signatures and processing asynchronously after recording the event. The audit trail is the product here.

**Follow-up guidance.** For ordering, accept "no global ordering; fetch the latest state" with a clear rationale. For deploys, expect lease-based ownership of shards and that in-flight attempts may repeat (at least once).

**Rubric anchors.** 2: one queue, fixed retries, no isolation, claims exactly once. 3: per-endpoint state, backoff with jitter, at-least-once with event ids, timeouts and per-endpoint limits. 4: also slow-lane isolation and fairness, recovery ramp, SSRF and signing details, honest ordering story, attempt logs, and incident handling that protects healthy endpoints first.

**Strong signals.** Treats worker-seconds as the scarce resource; asks about receiver behaviour; designs for the merchant's view of failures. **Red flags.** Promising exactly-once over HTTP; global FIFO; retrying every few seconds for days; delivering to any URL without network controls.

## STR-L4-03

**Reference architecture.**
- **Landing.** Each file lands immutably with `(source, file_name, received_at, sha256, settlement_date, version)`. Duplicate detection is by content hash and by `(source, settlement_date, file sequence)` from headers, not by file name. Validation checks row counts and trailer totals; a failed file is quarantined, not partially loaded.
- **Normalisation.** Per-source parsers produce `external_record(record_id, file_version_id, source, type, currency, amount_minor, fee_minor, network_ref, our_ref, card_fragment, txn_date, settlement_date)`, with minor units derived using the currency's exponent (0, 2 or 3). Parsers are versioned and tested against sample files.
- **Expectations.** From the immutable ledger, generate `expected_settlement(ledger_entry_id, source, expected_date, amount_minor, currency, refs)` using each source's settlement calendar (business days, holidays, cut-offs). Also expect one file per source per settlement date. Silence then becomes a finding.
- **Matching.** Ordered rules, each recorded on the match: (1) exact reference match; (2) network reference plus amount; (3) amount, currency, date window and card fragment, accepted only when unique; (4) batch rules: a net settlement line equals the sum of a set of expected entries minus fees and chargebacks for that source, date and currency; (5) tolerance rules (for example within 1 minor unit for per-batch fee rounding) that require an approval and create an explicit rounding adjustment. Matches are records `(match_id, rule, ledger_entry_ids, external_record_ids, difference_minor, created_at, superseded_at)`.
- **Corrections and bitemporality.** A reissued file is a new version. Records from the superseded version are retired (`valid_to` set), their matches superseded, and matching re-runs for the affected keys. Nothing is deleted; any past state is a query on `created_at`/`superseded_at`. After close, the difference from a correction is booked as a visible post-close adjustment in the current period.
- **Exceptions.** Unmatched or differing items after expected date plus per-source grace become exceptions with owner, reason code, notes and age buckets (for example 0–2, 3–7, 8–30, over 30 days), with escalation by age and amount. A late file auto-resolves exceptions it matches, keeping the history.
- **Scale.** Partition matching by `(source, settlement_date, currency)`; most matches are hash joins on references; only the unresolved remainder goes to costlier rules. Re-match only partitions touched by new or corrected files.
- **Month-end.** A close snapshot: matched totals, open exceptions by age and amount, adjustments, signed off and frozen as a version.

**Competing designs to accept.** A warehouse-SQL implementation (staged rules as incremental models) if versioning and explainability are kept. A stream-based matcher with state per reference if they handle late files and corrections. Buying a reconciliation product is a legitimate answer if they still design expectations and the data model.

**Bottlenecks and failure modes.** File-name-based dedup; parsers that assume two decimals; greedy fuzzy matching that steals the wrong pair; batch lines matched without fee and chargeback netting; updates in place that destroy the close; aging from receipt date instead of expected date; full re-match of history on every file.

**Incident guidance.**
- *Duplicate file under new name*: detect by hash and header sequence; quarantine the second copy, retract any records loaded from it, alert the source owner. The tell-tale is unmatched externals equal to one file's line count.
- *Last-day file days late*: expectations show the file as missing (one exception, not thousands); ledger entries stay "awaiting settlement" inside grace. Finance can close with a documented open item; when the file arrives, matches resolve and any difference becomes a post-close adjustment.
- *Corrected file for a closed month*: new version, supersede and re-match, post-close adjustment with references; the closed snapshot remains reproducible.
- *Per-batch fee rounding*: a source-specific tolerance rule with approval, booking the rounding difference to a named account; monitor its cumulative size so tolerance does not hide a real error.

**Follow-up guidance.** For one-to-many, look for sum constraints scoped by source, date and currency, and a plan when the subset-sum is ambiguous (stop and raise an exception rather than guess). For performance, partition and incremental re-matching.

**Rubric anchors.** 2: a nightly full outer join on amount and date. 3: versioned landing, normalised minor units, ordered rules, exceptions with aging. 4: also expectations from the ledger, batch netting, bitemporal supersede-and-rematch, post-close adjustments, approvals for tolerance, and crisp incident handling.

**Strong signals.** Starts from "what should have arrived"; insists every match explain itself; treats close as a versioned snapshot. **Red flags.** Updating records in place; tolerance applied silently; fuzzy matching without uniqueness checks.

## STR-L4-04

**Reference architecture.**
- **Definitions.** One declarative definition per feature: entity, event filter, aggregation (count, sum, distinct), window and whether the current attempt is included. A compiler produces the streaming job and the batch backfill query from the same definition, with shared tests on fixture event logs.
- **Online computation.** A stream processor keyed by entity maintains bucketed counters (for example 60 one-minute buckets for an hour, 24 one-hour buckets for a day, 7 one-day buckets for a week) and writes them to a low-latency key-value store. A read fetches a few rows per entity and sums buckets, so latency is bounded regardless of activity. The partial current bucket makes the window slightly coarse; document the granularity and use the same buckets offline.
- **The current attempt and in-flight events.** Choose a rule such as "all attempts with event time strictly before this attempt that had been applied to the store when it was read". Because stream lag makes "applied" non-deterministic, the robust approach is to log the served vector and its store watermark per attempt id. Optionally, the scoring service adds the current attempt in memory so the feature is "including this attempt" deterministically.
- **Training data.** Primary: the served-feature log joined to labels by attempt id. For new features: a point-in-time as-of join that uses events with `event_time < decision_time` (minus the typical ingestion lag, if you want to mimic online staleness), bucketed the same way.
- **Labels.** Labels mature over time; train on attempts old enough that most disputes have arrived, or weight by label maturity; never treat "no dispute yet" as "not fraud" for recent rows.
- **Hot keys.** Card-testing creates hot IPs. Cap per-key update rate with in-memory pre-aggregation (combine updates per key per second before writing), replicate hot keys for reads, and cap distinct-set sizes (switch to a sketch such as HyperLogLog above a threshold, used identically offline).
- **Degradation.** A hard client-side timeout under the budget; on timeout, features are marked missing; the model has been trained with missingness indicators; a rules layer remains as a backstop.
- **Monitoring.** Daily recompute of a sample of served vectors from the event log through the batch path; alert on disagreement rate per feature; freshness (watermark lag) per partition as an SLO.

**Competing designs to accept.** A feature-store product with streaming ingestion, if they still handle point-in-time and the current-attempt rule. Computing short windows at request time from a per-entity recent-events list (bounded length) if latency is shown to fit. Kappa-style backfill by replaying the event log through the streaming job instead of a separate batch implementation.

**Bottlenecks and failure modes.** Request-time scans of long windows; true sliding windows per event; label leakage from future events; current-attempt inconsistency; unbounded distinct sets; hot shards; stale counters after failover; missing features the model never saw in training.

**Incident guidance.**
- *Card-testing hot keys*: pre-aggregate writes, split hot keys, cap set sizes, protect the read path with timeouts so the payment is still scored; the attack itself is a fraud signal (rapid declines), so features must keep counting rather than drop updates.
- *15-minute stall*: watermark lag exceeds the shortest window, so short-window counts are understated. Serve with a staleness flag, fall back to rules for the affected entities, and make sure the served-feature log records the staleness so training does not learn from corrupted rows unknowingly.
- *6% backfill disagreement*: compare per feature; typical causes are the current-attempt rule, bucket boundaries, time-zone or clock skew, late events included offline, and differing dedup of retries. Fix the definition so both paths derive from it; prefer logged features for training.
- *Replica 20 seconds behind*: counters lose recent increments. Rebuild state for the gap by replaying the event log from the replica's watermark; idempotent bucket writes keyed by event id avoid double counts.

**Follow-up guidance.** For follow-up 1, a strong answer defines the rule precisely and admits that in-flight events make online values non-deterministic unless the served vector is logged. For labels, look for maturity windows.

**Rubric anchors.** 2: compute features in a nightly batch and look them up; no point-in-time thinking. 3: streaming bucketed counters, a shared definition, as-of joins, timeouts with fallbacks. 4: also logged served features, the current-attempt rule, label maturity, hot-key strategy, skew monitoring and strong incident answers.

**Strong signals.** Asks what "last hour" means at decision time; counts declines; plans for training on what was served. **Red flags.** Training on features recomputed with future data; counting at request time with database scans; dropping events under load.

## STR-L4-05

**Reference architecture.**
- **Ledger and balance.** The ledger is append-only, double-entry: each journal entry has lines that sum to zero per currency. An account's available balance is a projection updated in the same transaction as the ledger write (or derived from it in a strictly ordered way), so balance and ledger cannot diverge silently.
- **Home region per account.** Accounts are sharded; each shard has a home (leader) in one region with synchronous replication to a quorum across regions (a consensus group). A debit runs in one transaction on the leader: check idempotency key, check `available - holds >= amount`, write ledger entries, update balance, store the idempotency record with the response, commit to a quorum. Debit latency includes one cross-region quorum round trip (tens of ms), within the 300 ms budget.
- **Quorum and region count.** With 3 or 5 regions a majority survives losing one region, so leaders fail over and debits keep working with consistency. With 2 regions, a majority of 2 is both; losing either stops commits, so you need a third witness site (a tie-breaker that holds votes or log entries) or you accept that debits for one region's accounts pause during an outage. Strong candidates notice this from the region count in their instance.
- **Partitions and the minority side.** If a region is cut off, shards whose leader was there fail over to the majority; the isolated region cannot commit debits. Options for availability: (a) refuse debits there (consistency first), (b) pre-allocate per-region allowances (escrow) so each region can approve debits up to its share without coordination, rebalanced when connected, giving a hard cap on overdraft equal to zero if allowances sum to the balance; (c) allow a bounded overdraft per account, with business sign-off. Credits are commutative and can be accepted anywhere and applied later; they must not be made available before the ledger has them durably.
- **Idempotency across failover.** The idempotency record is part of the same replicated transaction as the debit, so a retry in another region finds it after failover. Keys stored only in a regional cache cause double debits.
- **Holds.** A hold is a ledger-backed reservation reducing available balance; capture converts it, release returns it; holds expire.
- **Hot accounts.** Split a hot account into N sub-balances (escrow slices) each on its own serialisation point, routing debits to a slice with enough funds and rebalancing in the background; or batch debits per account per few milliseconds into one transaction (group commit).
- **Proof.** Continuous invariants: per account, balance equals the sum of ledger lines; per journal entry, lines sum to zero; idempotency keys unique. Run on a consistent snapshot (MVCC read at a timestamp) so writes continue. A consistent cross-account midnight balance comes from a snapshot at a single commit timestamp, or by summing ledger lines with `created < midnight`.

**Competing designs to accept.** A globally distributed SQL database with externally consistent transactions, if the candidate explains the latency and quorum costs. Single-region active with a warm standby if they quantify the outage impact and the replication-lag risk (async standby can lose committed debits). Escrow-based multi-master with documented caps.

**Bottlenecks and failure modes.** Async replication plus failover losing committed debits (then re-approving against stale balances); 2PC coordinators lost in the failed region; checks against read replicas; idempotency keys in a regional cache; single-row hot spots; projection updated outside the ledger transaction.

**Incident guidance.**
- *Region unreachable for hours*: majority-side leaders take over the shards (consistent, brief unavailability during election); in the isolated region debits are refused or limited to escrow allowances; credits queue. Communicate which accounts saw declined payouts. If only 2 regions and no witness, debits for affected shards pause; the design should have said so up front.
- *Double debits with one key in each region*: the idempotency record was not in the replicated transaction, or it was keyed by region. Reverse duplicates through compensating ledger entries (never deletion), notify affected accounts, and make the key part of the committed transaction with a uniqueness constraint.
- *37 accounts where balance differs from ledger*: freeze debits on those accounts or mark them for manual review, find the shared code path (a write that updated the projection outside the ledger transaction, a failed partial retry), rebuild balances from the ledger, and add the invariant as a blocking check in the write path or as a continuous monitor with paging.
- *Hot marketplace account*: one lock gives roughly the inverse of the transaction time in debits per second; split into escrow slices or group-commit; payouts to many sellers can also be batched into one journal entry.

**Follow-up guidance.** For "provable cap", expect escrow allowances with the sum equal to the balance, and a rebalancing protocol. For the midnight snapshot, a single-timestamp read or ledger summation by commit time.

**Rubric anchors.** 2: cache the balance, async replication, check-then-write without serialisation. 3: ledger as truth, one serialisation point per account, idempotency stored with the debit, a clear statement of what happens in an outage. 4: also correct quorum reasoning for the region count, escrow or bounded-overdraft options with caps, hot-account sharding, continuous invariants, and strong incident handling.

**Strong signals.** States the trade-off per operation (credits vs debits) rather than one global CAP choice; checks the quorum arithmetic. **Red flags.** "Last write wins" on balances; claims both full availability and no overdraft during a partition without escrow; deleting ledger rows to fix errors.
