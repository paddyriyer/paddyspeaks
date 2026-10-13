# Stripe · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a payments
infrastructure company. Every workload, number and schema is hypothetical, and
nothing here describes how any company's systems are actually built.

## STR-L4-01: Real-time payments analytics for merchants

| | |
|---|---|
| **Template ID** | STR-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time analytics / exact financial aggregation, multi-tenant serving |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_payments": {"1": ["5 million", "10 million"], "2": ["40 million", "120 million"], "3": ["400 million", "1 billion"]},
  "merchants": {"1": ["50,000", "200,000"], "2": ["500,000", "2 million"], "3": ["2 million", "6 million"]},
  "currencies": [25, 60, 135],
  "freshness": ["1 minute", "5 minutes"]
}
```

**Business Scenario.** A payments platform processes about {{daily_payments}} payments a day for {{merchants}} merchants, in {{currencies}} presentment currencies. Each payment moves through states (created, authorized, succeeded or failed, later perhaps refunded or disputed), and every movement of money creates a balance transaction with an amount, a fee and a net, all integers in the currency's minor unit. Merchants want a dashboard that shows gross volume, net volume, payment success rate, refunds, disputes and upcoming payouts, fresh within {{freshness}}. Their finance teams compare the same numbers with payout reports, so totals must agree to the minor unit.

**Problem Statement.** Design the analytics platform behind this dashboard. Cover the events or change stream you consume, how you aggregate exactly, how you compute success rate, how you handle currencies and merchant time zones, where the numbers are stored and served, how merchants (and platforms that manage connected accounts) are isolated from one another, and how the dashboard is reconciled with the ledger.

**Constraints.** Money totals are exact integers in minor units; floating point is not allowed anywhere on the money path. A merchant sees only its own data; a platform sees its connected accounts and nothing else. Dashboard queries p95 under 1 second, including for the largest merchants. Intraday numbers may lag by up to {{freshness}} but must never double count; once a day is final it must equal the ledger exactly.

**Assumptions.** All volumes, counts and SLOs are hypothetical. The ledger (balance transactions) is the financial source of truth and can be read as an ordered change stream. Payment-state events are a separate stream and may arrive out of order.

**Clarifications.**
- Q: Is success rate measured per attempt or per payment? | A: Both are useful; the dashboard's headline is per payment (did the customer eventually pay), with attempt-level detail for debugging declines. You must define both.
- Q: Which currency are totals shown in? | A: In each settlement currency, plus a converted total in the merchant's default currency that is labelled as converted.
- Q: Which day does a payment belong to? | A: The merchant's reporting time zone, which the merchant can change.
- Q: Do refunds and disputes reduce gross volume? | A: No. Gross volume counts successful payments; net volume subtracts refunds, dispute amounts and fees.
- Q: How late can a change arrive? | A: Most within seconds. A dispute or refund can arrive months after the payment, and it belongs to the day it happened, not the payment's day.

**Hints.**
1. Sums and counts are mergeable and can be exact; rates are not. Store numerator and denominator, and divide at read time.
2. Make every aggregation idempotent on the ledger's own identifier so a replayed change cannot count twice.
3. Hourly UTC buckets cannot be rolled up into a day in every time zone. Some offsets are not whole hours.

**Follow-ups.**
1. How do you compute success rate so that a customer who fails twice and then succeeds counts as one successful payment, and why can you not average per-hour success rates?
2. A merchant changes its reporting time zone. What has to be recomputed, and what does the merchant see while that happens?
3. A platform with 400,000 connected accounts opens its dashboard. How do you serve a total across all of them in under a second?
4. The finalised total for one merchant-day differs from the ledger by 312 minor units. Walk through how you find the cause.
5. Converted totals use FX rates. Which rate do you use, when is it fixed, and what changes if the rate for a past day is corrected?

**Follow-up rules.**
- when: float, double, decimal conversion, divide by 100 → ask: Where in your design does a money value stop being an integer of minor units, and what error does that introduce at a billion rows?
- when: partition by merchant, key by merchant, merchant_id → ask: One merchant runs a flash sale and sends 15% of all payments. What happens to the partition and to every other merchant on it?
- when: average, avg success, mean rate → ask: Why is the average of hourly success rates not the daily success rate?
- when: exactly once, exactly-once → ask: Exactly-once inside the stream processor does not cover the sink. What makes the write to your serving store idempotent?
- when: hourly, per hour, utc day → ask: A merchant reports in UTC+05:30. How does your hourly bucket give them a correct day?

**Production Reality Check.**
- A single merchant runs a flash sale and sends 15% of all payments for two hours. The stream partition holding that merchant falls 20 minutes behind, so every merchant on it sees a dashboard older than the {{freshness}} promise.
- A change-data-capture connector restarts from an old offset and re-emits the last 3 hours of balance transactions. Volume for the affected merchants doubles on the dashboard.
- A merchant whose reporting time zone is UTC+05:30 says yesterday's gross volume on the dashboard does not match the payout report they downloaded.
- The FX rate feed stalls for 90 minutes; converted totals across {{currencies}} currencies are still being computed with the last rate received.

**Evaluation Criteria.** Uses the ledger as the source of truth for money and keeps state events for rates; exact integer arithmetic in minor units; idempotent aggregation keyed by the ledger identifier; numerators and denominators stored, never rates; time-zone-safe buckets; explicit as-of labelling and a finalisation step reconciled with the ledger; tenant isolation including platforms; hot-merchant handling; adapts to each incident with diagnosis, recovery and prevention.

## STR-L4-02: Webhook delivery at scale

| | |
|---|---|
| **Template ID** | STR-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed delivery / retries, backpressure, tenant isolation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "events_per_sec": {"1": ["2,000", "5,000"], "2": ["20,000", "50,000"], "3": ["200,000", "400,000"]},
  "endpoints": {"1": ["100,000", "300,000"], "2": ["1 million", "2 million"], "3": ["5 million", "10 million"]},
  "retry_days": [3, 5],
  "down_share": ["1%", "3%", "6%"]
}
```

**Business Scenario.** A payments API notifies merchants of events (a payment succeeded, a refund was created, a dispute was opened, a payout was paid) by sending an HTTPS POST to endpoints the merchants register. There are {{endpoints}} registered endpoints, each subscribed to some event types, and the platform produces about {{events_per_sec}} events per second at peak. A platform account can receive events for all of its connected accounts at one endpoint. At any moment about {{down_share}} of endpoints are failing; some are slow, some return errors, and some are down for days.

**Problem Statement.** Design the delivery system. Cover how an event becomes one delivery per subscribed endpoint, how deliveries are scheduled and retried with backoff for up to {{retry_days}} days, what delivery guarantee you give and what you tell merchants about ordering, how one slow or dead endpoint is kept from hurting everyone else, how you apply backpressure, and what a merchant can see and do (delivery logs, manual resend).

**Constraints.** Delivery is at least once. Healthy endpoints should receive events within a few seconds at p99, whatever other endpoints are doing. Endpoint URLs are supplied by merchants and are untrusted. Each payload is signed so the receiver can verify it and reject replays. After {{retry_days}} days of failure, an event is no longer retried automatically.

**Assumptions.** All rates and counts are hypothetical. Events are already durably written to an internal event log before delivery starts. Receivers are expected to respond quickly with a 2xx and do their work asynchronously.

**Clarifications.**
- Q: Do you guarantee ordering? | A: Not across events. Decide what you can offer, and what you tell merchants to do instead.
- Q: What counts as success? | A: Any 2xx within the timeout. Anything else, including a timeout or a redirect, is a failure.
- Q: Can a merchant replay old events? | A: Yes, for events in the last {{retry_days}} days, from the dashboard or the API.
- Q: What happens to an endpoint that fails for the whole retry window? | A: Product wants the merchant notified, and the endpoint eventually disabled. You decide the policy.
- Q: Can one event go to several endpoints? | A: Yes. Each subscribed endpoint gets its own delivery with its own retry state.

**Hints.**
1. Separate the fan-out (event → deliveries) from the delivery workers, and give every delivery an identity that survives retries.
2. One physical queue per endpoint does not scale to millions; one shared queue lets a dead endpoint block everyone. Find the middle.
3. Workers waiting on hung connections are the scarce resource. Timeouts and concurrency limits are per endpoint, not global.

**Follow-ups.**
1. A merchant receives the same event twice and charges their customer's order twice in their own system. What did you promise, and what do you give them to prevent it?
2. An endpoint receives "refund created" before "payment succeeded" for the same payment. Is that a bug? What would you do if a large merchant insists on order?
3. An endpoint has been failing for two days. How often do you retry now, where do its pending deliveries live, and what does it cost you?
4. How do you stop a merchant from registering an endpoint that points at an address inside your own network?
5. The delivery fleet itself must be deployed without losing or doubling deliveries in flight. How?

**Follow-up rules.**
- when: exactly once, exactly-once → ask: The receiver can time out after processing your POST. How can a delivery over HTTP be exactly once, and what do you promise instead?
- when: fifo, ordered, in order, sequence → ask: Strict ordering means one failing event blocks every later event for that merchant. Is that what the merchant wants?
- when: queue per endpoint, topic per merchant, one queue each → ask: With {{endpoints}} endpoints, what does a physical queue per endpoint cost in brokers, file handles and rebalancing?
- when: exponential backoff, backoff → ask: After a regional network blip, a million endpoints recover at the same moment. What does your retry schedule do to them?
- when: thread pool, workers, connection pool → ask: Fifteen percent of endpoints start hanging until the timeout. What fraction of your workers are waiting, and what happens to healthy endpoints?

**Production Reality Check.**
- A hosting provider used by about 15% of endpoints starts accepting connections and then hanging until the timeout. Delivery workers spend their time waiting, and delivery latency for healthy endpoints rises from seconds to 40 minutes.
- A large platform's endpoint, which receives events for all of its connected accounts, has been down for two of the {{retry_days}} retry days and holds a backlog equal to two days of its traffic.
- When that endpoint comes back, the whole backlog is released at once and the platform's servers fall over again within a minute.
- A merchant says a payment-succeeded event never arrived and their logs show nothing. Your delivery record says it was delivered with a 200.

**Evaluation Criteria.** Durable event log → per-endpoint delivery records with stable identity; at-least-once with event ids for receiver dedup, and an honest ordering story (object state can be fetched, events carry created times); retries with capped exponential backoff and jitter, slowing for long-dead endpoints, within {{retry_days}} days; per-endpoint concurrency, timeouts and circuit breakers; fair scheduling and isolation of slow endpoints; controlled ramp-up on recovery; SSRF protection and signed payloads with timestamps; delivery logs and replay; adapts to each incident with diagnosis, recovery and prevention.

## STR-L4-03: Settlement reconciliation platform

| | |
|---|---|
| **Template ID** | STR-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Batch data platforms / reconciliation, late and corrected data, auditability |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_lines": {"2": ["20 million", "60 million"], "3": ["300 million", "800 million"]},
  "sources": [5, 12, 30],
  "late_days": [2, 4, 7],
  "close_days": [3, 5]
}
```

**Business Scenario.** A payments company records every movement of money in its own double-entry ledger. Each day {{sources}} external parties (card processors, acquirers and banks) send settlement files that say what they actually settled: gross amounts, fees, chargebacks, adjustments and the net transfer. Together the files hold about {{daily_lines}} lines a day. Most arrive the next morning; some arrive {{late_days}} days late; some are later reissued with corrections. Finance must close each month within {{close_days}} business days, and every unmatched difference needs an owner and an age.

**Problem Statement.** Design the reconciliation platform. Cover file ingestion and versioning, normalising very different formats, generating expectations from the ledger, the matching rules (one to one, one to many, many to one, tolerances), the states a record can be in, the exceptions queue with ownership and aging, how late and corrected files are handled without rewriting history, and what finance sees at month-end.

**Constraints.** Amounts are exact, in minor units, and currencies have different exponents (some have none, some have three). Nothing that was reported in a closed month may change silently; a correction after close is a visible adjustment. Every match must be explainable: which rule, which records, which file version. The platform must show what it knew on any past date.

**Assumptions.** All volumes, counts and timings are hypothetical. The internal ledger is immutable: corrections are new entries, never edits. External files are trusted only after validation (checksums, row counts, totals in the trailer where present).

**Clarifications.**
- Q: Do external lines carry our identifiers? | A: Some do (a reference we sent with the transaction); some only carry amount, date, card fragment and the network's own reference. Expect both.
- Q: Does every source settle per transaction? | A: No. Some send one net line per batch, with fees deducted, which must match many ledger entries.
- Q: When is a record an exception? | A: When it is not matched by its expected settlement date plus a grace period that differs by source.
- Q: Who works the exceptions? | A: A finance operations team of a few dozen people, who need assignments, reason codes and a history.
- Q: Is a missing file an exception? | A: Yes. The platform must notice a file that never arrived, not just lines that do not match.

**Hints.**
1. Reconcile against expectations: derive from the ledger what each source should send and when, so silence is detectable.
2. Treat each file version as immutable and make matches point at record versions. A correction then becomes "supersede and re-match", not "update".
3. Order the rules from strict to loose, and record which rule made each match.

**Follow-ups.**
1. A processor settles one net line per day per currency, after fees and chargebacks. How do you match it to tens of thousands of ledger entries, and what do you do when it is off by a small amount?
2. A corrected file arrives for a settlement date in a month that is already closed. What changes, what does not, and what does finance see?
3. How do you define aging so that a file arriving {{late_days}} days late does not flood the queue with false exceptions, but a truly missing settlement still surfaces?
4. An auditor asks: "Show me the reconciliation state as of the close of March, and every change since." How does your model answer?
5. Matching is now 6 hours for a day's files and close is at risk. Where does the time go and how do you parallelise it safely?

**Follow-up rules.**
- when: update the record, overwrite, upsert the line → ask: Finance closed last month on the old values. After your update, how do you show what they closed on?
- when: fuzzy, amount and date, tolerance → ask: Two ledger entries have the same amount and date. How do you avoid matching the wrong one, and how would anyone know?
- when: join on, inner join, full outer join → ask: A full outer join tells you what did not match today. How do you tell a record that will match tomorrow from one that never will?
- when: float, round, decimal → ask: One source rounds fees per batch and another per transaction. How does your matching treat a one-minor-unit difference, and who signs off on it?
- when: daily batch, cron, nightly → ask: The file for the last day of the month arrives after close has started. Does your nightly job see it, and what decides whether that day is re-matched?

**Production Reality Check.**
- One of the {{sources}} sources delivers the same settlement file twice under different file names. Unmatched external lines jump by exactly that file's line count.
- A bank's settlement file for the last day of the month arrives {{late_days}} days late. Until it does, the exceptions queue fills with ledger entries that look unmatched, and finance must decide whether to close within {{close_days}} business days without it.
- A processor reissues a corrected file for a settlement date that was in last month's close; 3% of its lines change amount.
- A processor starts reporting fees once per batch instead of per transaction, and thousands of matches now differ by one minor unit.

**Evaluation Criteria.** Immutable raw landing with file identity (hash, source, date, version) and validation; normalised record model with exact minor-unit amounts and currency exponents; expectations from the ledger so missing files surface; ordered, explainable matching rules including one-to-many and many-to-one with tolerances that are explicit and approved; supersede-and-rematch for corrections with bitemporal history; aging from expected date with per-source grace; exceptions workflow with owners and reason codes; month-end view and post-close adjustments; adapts to each incident with diagnosis, recovery and prevention.

## STR-L4-04: Fraud feature platform for authorization

| | |
|---|---|
| **Template ID** | STR-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Feature platforms / online-offline consistency, point-in-time correctness, low latency |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, ai-infra-engineer |

```params
{
  "auth_tps": {"2": ["5,000", "15,000"], "3": ["50,000", "100,000"]},
  "budget_ms": [10, 20, 30],
  "windows": ["1 minute, 1 hour and 24 hours", "10 minutes, 6 hours and 7 days"],
  "entities": ["card, email address and IP address", "card, IP address and device"]
}
```

**Business Scenario.** A payments platform scores every payment attempt for fraud before it is sent for authorization, at up to {{auth_tps}} attempts per second. The model uses velocity features: for each of {{entities}}, counts and amounts of attempts, declines and distinct counterparts (for example distinct cards seen on one IP address) over windows of {{windows}}. The fraud team trains new models every week on historical attempts. Fraud labels arrive late: a cardholder dispute can come weeks after the payment.

**Problem Statement.** Design the feature platform. The online path must return the feature vector within {{budget_ms}} ms at p99 inside the authorization path. The offline path must produce training rows whose features equal what the model would have seen at decision time. Cover feature definitions, the streaming computation, the online store, how the current attempt is treated, point-in-time correct training data, label handling, monitoring of online-offline skew, and what happens when part of the system is slow or down.

**Constraints.** A feature fetch slower than {{budget_ms}} ms at p99 is a failure; the payment must still be decided. A feature must have one definition used by both paths. Training data must never contain information from after the decision. Raw card numbers never enter the feature platform; cards are identified by a fingerprint or token.

**Assumptions.** All rates, budgets and windows are hypothetical. Attempts arrive on an event log with an event time and an attempt id. Declined and blocked attempts are logged as well as successful ones.

**Clarifications.**
- Q: Does a velocity count include the attempt being scored? | A: You decide, but online and offline must make the same choice.
- Q: Do declined attempts count? | A: Yes. Repeated declines are among the strongest signals, for example in card testing.
- Q: Can distinct counts be approximate? | A: Yes, within a stated error, if training uses the same approximation.
- Q: How late are labels? | A: Most disputes arrive within a few weeks; some take months. Training must account for that.
- Q: What if the feature store is unavailable? | A: The payment is still scored, with whatever features are present, and the response says which were missing.

**Hints.**
1. The simplest way to make training match serving is to log the exact feature vector that was served, keyed by attempt id, and train on that.
2. For new features there is no log yet, so you still need a point-in-time backfill: an as-of join on event time that uses only events strictly before the decision.
3. Sliding windows over long periods are expensive per event. Bucketed counters (per minute for an hour, per hour for days) bound the cost.

**Follow-ups.**
1. Precisely which events are counted in "attempts on this card in the last hour" at decision time, online and offline? Include the attempt itself, concurrent attempts, and events still in flight in the stream.
2. A new feature needs two years of history before it can be trained. How do you backfill it so it equals what the online path will compute from now on?
3. During a card-testing attack one IP address has 40,000 attempts in ten minutes. What happens to its counters, its distinct-card set and your read latency?
4. How do you build labels for a weekly training run when disputes for the last month are still arriving?
5. How do you detect, in production, that an online feature has drifted from its offline definition, and what do you page on?

**Follow-up rules.**
- when: recompute offline, batch recompute, spark job → ask: Your offline job sees events that were still in the stream when the online decision was made. How do you make offline see only what online saw?
- when: redis, cache, key-value → ask: The hot key for one IP address now takes 80% of one shard's traffic. What do you do within the {{budget_ms}} ms budget?
- when: hyperloglog, approximate, sketch → ask: Training used exact distinct counts but serving uses a sketch. What does that mismatch do to the model?
- when: compute at request time, on the fly, query the database → ask: Counting a week of attempts at request time inside {{budget_ms}} ms at {{auth_tps}} per second: show the arithmetic.
- when: timeout, default value, fallback → ask: When features are missing, what does the model receive, and was it trained to see that?

**Production Reality Check.**
- A card-testing attack sends 40,000 small attempts in ten minutes from a handful of IP addresses, each with a different card. The shard holding those keys pushes p99 feature latency past {{budget_ms}} ms for every payment on it.
- A deploy of the streaming job stalls it for 15 minutes, longer than the shortest of its windows ({{windows}}). Velocity features read stale counts while it catches up.
- A backfill of last quarter's training set disagrees with the logged decision-time values on 6% of rows.
- The online store in one region fails over to a replica that is 20 seconds behind, and every counter on it loses its last 20 seconds of updates.

**Evaluation Criteria.** One declarative feature definition compiled for stream and batch; bucketed window counters in a low-latency store with bounded reads; an explicit rule for the current attempt and in-flight events, shared by both paths; logging of served features and training on them; point-in-time as-of joins for backfills; label maturity handling; hot-key protection and graceful degradation with missingness the model was trained on; skew monitoring; adapts to each incident with diagnosis, recovery and prevention.

## STR-L4-05: Multi-region available-balance service

| | |
|---|---|
| **Template ID** | STR-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed consistency / multi-region, ledgers, availability trade-offs |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 55 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "regions": [2, 3, 5],
  "accounts": {"2": ["10 million", "30 million"], "3": ["100 million", "250 million"]},
  "debits_per_sec": {"2": ["3,000", "10,000"], "3": ["50,000", "150,000"]},
  "outage": ["45 minutes", "6 hours"]
}
```

**Business Scenario.** A payments platform keeps a balance for each of {{accounts}} merchant accounts. Incoming payments add pending funds that become available after settlement; payouts, refunds and transfers debit the available balance. Debit requests arrive at up to {{debits_per_sec}} per second across {{regions}} regions. A double-entry ledger is the source of truth for money; the balance is what the system checks before it lets a debit through. An account must not be overdrawn by a debit the platform approved, and the platform must keep working when one region is lost for {{outage}}.

**Problem Statement.** Design the balance service. Cover the relation between the ledger and the balance, how a debit is checked and applied atomically, where each account's authoritative state lives, how writes are replicated, what happens to debits and credits for an account when a region is unreachable, how idempotency survives failover, and how you prove the balances are right. Be explicit about which guarantees you give up, when, and why.

**Constraints.** No approved debit may take available balance below zero (a small, explicitly bounded exception is allowed only if you justify it and the business accepts it). Every balance change corresponds to balanced ledger entries. Debit requests carry an idempotency key; a retried request must never apply twice, even if the retry lands in a different region. Debit p99 latency under 300 ms.

**Assumptions.** All volumes, latencies and outage durations are hypothetical. Inter-region round trips are tens of milliseconds. Credits from settlement arrive in batches; debits arrive one at a time from the API.

**Clarifications.**
- Q: Can the balance be eventually consistent? | A: For display, yes. For the overdraft check, you must explain exactly what consistency the check reads.
- Q: Must a debit succeed during a regional outage? | A: The business wants as many as possible to succeed, but not at the cost of unbounded overdrafts. Propose the trade.
- Q: Are holds supported? | A: Yes. Some flows reserve funds first and then capture or release them.
- Q: Is the ledger in one region? | A: That is part of your design. It must not lose a committed entry if a region is lost.
- Q: How hot can one account be? | A: Most are quiet; a marketplace's platform account can carry a large share of all debits at peak.

**Hints.**
1. A check-then-debit is a read-modify-write. It needs one serialisation point per account, or a way to split the balance so that each part has one.
2. Credits commute and can be applied late; debits do not. Treat them differently during a partition.
3. With {{regions}} regions, ask what a majority is, and whether a majority survives losing one region.

**Follow-ups.**
1. Walk through one debit end to end: request with idempotency key, check, ledger write, balance update, response. Where can it fail, and what does the client see each time?
2. The region that is home to 30% of accounts is lost for {{outage}}. What happens to their debits, credits and balance reads?
3. How would you let a hot account keep accepting debits in every region during a partition, with a provable cap on overdraft?
4. How do you show, every day, that each served balance equals the sum of its ledger entries, without stopping writes?
5. Finance asks for the balance of every account as of midnight UTC, consistent across all accounts. How do you produce it?

**Follow-up rules.**
- when: eventual consistency, eventually consistent, async replication, asynchronous → ask: Region A approves a debit, then fails before replicating it. Region B approves another debit on the same balance. What prevents the overdraft?
- when: two-phase commit, 2pc, distributed transaction → ask: Your coordinator's region is the one that just went down. What state are the in-flight debits in, and who resolves them?
- when: raft, paxos, consensus, quorum → ask: With {{regions}} regions, how many must answer to commit, and what happens when one is lost?
- when: cache, read replica, replica → ask: The overdraft check reads a replica 2 seconds behind. Show a sequence of requests that overdraws the account.
- when: single row, lock, select for update → ask: One marketplace account takes a fifth of all debits. What throughput does one lock give you, and what do you do about it?

**Production Reality Check.**
- One of the {{regions}} regions is unreachable for {{outage}}. Accounts whose home is that region keep receiving payout and refund requests, which now arrive elsewhere.
- During the failover, clients retry debits. After recovery you find a small number of debits applied twice, each pair with the same idempotency key, one in each region.
- A nightly invariant check finds 37 accounts whose served available balance differs from the sum of their ledger entries.
- One marketplace account takes a fifth of all debits at peak, and every one of them contends on the same balance record.

**Evaluation Criteria.** Ledger as the source of truth with balanced entries; the balance as a derived, transactionally maintained projection; one serialisation point per account (home region with synchronous replication or consensus) or explicit escrow splits; idempotency records committed atomically with the debit and replicated with it; a clear CAP position per operation (credits accepted and applied later, debits refused or capped by pre-allocated allowances during a partition); correct quorum reasoning for {{regions}} regions; hot-account sharding; continuous invariant checks; adapts to each incident with diagnosis, recovery and prevention.
