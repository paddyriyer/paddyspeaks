# Stripe · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a payments
platform. Every workload, number, rate and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## STR-L2-01: Best currency conversion within K conversions

| | |
|---|---|
| **Template ID** | STR-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs and dynamic programming / hop-limited Bellman-Ford, integer money |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | STR-L2-01.mjs |

**Business Scenario.** A treasury team moves a merchant's balance between currencies before a payout. Liquidity providers publish quotes: convert from one currency to another at a rate, minus a fee in basis points. Every extra conversion adds settlement risk and operational work, so treasury allows at most a fixed number of conversions per route. You are writing the routine that finds the best route for a given amount over a snapshot of quotes.

**Problem Statement.** Implement `best_conversion(quotes, source, target, amount, max_hops)`. Each quote is `(from_ccy, to_ccy, rate_micros, fee_bps)`. Converting `x` minor units along one quote yields `x * rate_micros * (10000 - fee_bps) // 10_000_000_000` minor units of `to_ccy`: the integer result is floored after **every** conversion, never once at the end. Return the largest amount of `target` obtainable from `amount` minor units of `source` using **at most** `max_hops` conversions, or `None` if no route of at most `max_hops` conversions reaches `target`. With zero conversions, `source` itself holds `amount`. {{fee_rule}} {{hop_rule}}

**Constraints.** Up to 400 currencies and 25 000 quotes; 0 ≤ `max_hops` ≤ 8; amounts up to 10⁹ minor units. Use integer arithmetic only. O(`max_hops` · number of quotes) time is expected.

**Assumptions.** Hypothetical quotes and fees. `rate_micros` is the rate times 10⁶ and already accounts for each currency's minor unit (zero-decimal currencies such as JPY have no cents), so the formula above is all you need. A quote is directional: a quote from A to B says nothing about B to A.

**Clarifications.**
- Q: Is a route with fewer than max_hops conversions allowed? | A: Yes. At most max_hops; 0 conversions is allowed when source equals target.
- Q: Can a route pass through the same currency twice? | A: Yes. Each conversion counts toward max_hops.
- Q: What do I return if the best reachable amount floors to 0? | A: 0. None means the target is unreachable within max_hops, which is a different answer.
- Q: Can there be two quotes for the same pair? | A: Yes, from different providers with different rates and fees. Consider each.
- Q: May I use floats for the rate? | A: No. Money stays in integer minor units, and the floor after every hop is part of the specification.

**Hints.**
1. Let `best_i[c]` be the most of currency `c` you can hold after at most `i` conversions. `best_0` has only `source`.
2. Each conversion is monotone: more in means at least as much out. That is why keeping only the best amount per currency per step is safe.
3. Compute step `i + 1` from a copy of step `i`. Relaxing quotes in place can chain several conversions inside one step and exceed `max_hops`.

**Follow-ups.**
1. Quotes expire every few seconds. How would you recompute the best routes for many (source, target, amount) requests without starting from scratch each time?
2. Fees in reality include a fixed part per conversion as well as basis points. Does your dynamic programme still work, and why?
3. A provider's quote has a minimum and maximum size. How does that change the algorithm, and is it still optimal to keep one best amount per currency?
4. Without a hop limit, a loop of quotes that gains value makes the answer unbounded. How would you detect such a loop in a quote snapshot, and what should the system do about it?

**Follow-up rules.**
- when: float, decimal, math.log, log → ask: Your approach turns rates into floats or logs. Show a case where the floored integer answer differs, and how you would keep the result exact.
- when: dijkstra, priority queue, heap → ask: Dijkstra needs edge weights that never make a path better. Is that true here with quote loops and a hop limit?
- when: in place, single array, one dict → ask: If you relax quotes in place, how many conversions can one step chain? Walk through a three-quote chain with max_hops = 2.
- when: dfs, recursion, enumerate paths, all paths → ask: How many routes are there with 400 currencies and 6 hops, and what does that mean for your running time?

**Evaluation Criteria.** Integer arithmetic with a floor after every hop; at-most semantics with a copy per step; distinguishes 0 from unreachable; handles parallel quotes and revisits; O(K·E) with a justification from monotonicity; explains why quote loops need the hop limit.

## STR-L2-02: Linked-account groups from shared identifiers

| | |
|---|---|
| **Template ID** | STR-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / union-find with path compression, risk signals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | STR-L2-02.mjs |

**Business Scenario.** A risk team reviews connected merchant accounts. Accounts that share a card fingerprint, a device id or a bank account may be run by the same people, and a large connected group is worth a human look. The team gets a daily extract of `(account_id, kind, value)` rows and wants the sizes of the connected groups so it can prioritise review.

**Problem Statement.** Implement `linked_groups(links, min_size, max_share=None)`. `links` is a list of `(account_id, kind, value)`. Two accounts are directly linked when they share the same identifier, meaning the same `(kind, value)` pair. Linking is transitive: if A shares an identifier with B and B with C, all three are one group. Every account that appears in `links` belongs to exactly one group (possibly of size 1). Return the sizes of all groups with at least `min_size` accounts, largest first. {{kind_rule}} {{share_rule}}

**Constraints.** Up to 300 000 link rows and 150 000 accounts; rows may repeat. Near-linear time is expected.

**Assumptions.** Hypothetical accounts and identifiers. A group is a signal for review, not a finding about anyone; the output is sizes only.

**Clarifications.**
- Q: Do a card value and a device value that happen to be the same string link two accounts? | A: No. An identifier is the (kind, value) pair.
- Q: If a row appears twice, does it count twice? | A: No. Group sizes count distinct accounts.
- Q: Should accounts with no shared identifier appear? | A: Yes, as groups of size 1, if min_size allows.
- Q: Is min_size inclusive? | A: Yes. A group of exactly min_size accounts is reported.
- Q: Does the output need account ids? | A: No. Sizes only, sorted descending.

**Hints.**
1. You do not need an edge between every pair of accounts that share an identifier. Linking each holder to the first holder you saw is enough.
2. Union-find with path compression (or path halving) and union by size keeps each operation almost constant.
3. If identifiers can be ignored for being too common, you need their distinct-holder counts before you link anything.

**Follow-ups.**
1. The extract arrives daily. How do you maintain the groups incrementally as new links appear, and what is hard about links that disappear?
2. One identifier links 40 000 accounts. Is that a ring or noise, and how would you decide the threshold for ignoring an identifier?
3. How would you compute this in Spark or SQL over billions of rows, where you cannot hold a union-find in one process?
4. The review team wants to know why two accounts are in one group. What would you store so that you can show the chain of shared identifiers?

**Follow-up rules.**
- when: pairs, every pair, combinations, nested loop → ask: An identifier shared by 5 000 accounts produces how many pairs? What does that do to your running time?
- when: bfs, dfs, adjacency, graph traversal → ask: A traversal works. What does union-find give you that a traversal does not when links arrive one batch at a time?
- when: recursion, recursive find → ask: What happens to a recursive find on a chain of 150 000 accounts in CPython, and how do you avoid it?
- when: connected components, spark, graphframes, sql → ask: How many iterations does label propagation need on a long chain, and how would you bound them?

**Evaluation Criteria.** Identifier keyed by (kind, value); distinct accounts; transitive groups including singletons; inclusive min_size; correct max_share by distinct holders; union-find with compression and union by size or an equivalent near-linear traversal; avoids pairwise linking; discusses incremental and distributed versions honestly.

## STR-L2-03: Debug a payment-status webhook processor

| | |
|---|---|
| **Template ID** | STR-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / idempotency, ordering, integer money, error handling |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | STR-L2-03.mjs |

**Business Scenario.** A merchant's backend keeps its own copy of payment state, updated from webhook events sent by its payment provider. Public webhook documentation from payment providers warns that an event can be delivered more than once and that delivery order is not guaranteed, so the handler must be idempotent and must not trust arrival order. Finance reports that some refunds never appear, some payments show "processing" long after they succeeded, and a few fully refunded payments are shown as partly refunded. The handler below is the suspect.

**Problem Statement.** Fix `process_events(events)` so that it meets this specification. `events` is a list of dicts in delivery order: `{"id", "type", "payment", "amount"}` plus `"seq"` on status events. {{delivery_rule}}
1. **Duplicates.** An event whose `id` was already processed is acknowledged again and changes nothing.
2. **Status events** (`payment.processing`, `payment.succeeded`, `payment.failed`) create the payment record on first sight, with that event's `amount`. A status event is applied only if its `seq` is greater than the `seq` of the status currently stored; an older one is acknowledged and ignored.
3. **Refunds** (`refund.succeeded`) add `amount` (integer minor units) to the payment's refunded total. A refund for a payment that has no record yet cannot be applied: it is **not** acknowledged, goes to `retry`, and is not treated as processed, so a later redelivery is applied.
4. **Output.** `{"payments": {payment_id: {"status", "amount", "amount_refunded", "fully_refunded", "applied"}}, "acked": [...], "retry": [...]}`. `amount_refunded` is an integer in minor units; `fully_refunded` is `amount_refunded == amount`; `applied` lists, in order, the ids of the events that changed that payment; `acked` and `retry` list delivery ids in delivery order.

**Constraints.** Keep the function's shape and output format. Up to 200 000 deliveries; linear time.

**Assumptions.** Hypothetical event types and amounts, simplified from what public webhook documentation describes. `seq` increases with every status change at the source. Unknown event types do not occur in this exercise.

**Clarifications.**
- Q: Is a redelivered event acknowledged? | A: Yes. Acknowledge it again so the sender stops retrying, but apply nothing.
- Q: What does acknowledging mean here? | A: Its id goes into acked, which stands for answering the webhook with a success status. retry stands for answering with an error so the sender tries again later.
- Q: Does a stale status event count as processed? | A: Yes. It is acknowledged and marked seen, but it does not change the payment and is not in applied.
- Q: Can a refund exceed the amount? | A: Not in this exercise; do not add validation for it.
- Q: How many bugs are there? | A: Several, of different kinds. The tests point at each one.

**Hints.**
1. Read the deduplication key carefully: what identifies one delivery, and what identifies one change?
2. Print `0.1 + 0.2 == 0.3` and `int(0.29 * 100)` in Python.
3. Look at every place an exception could be swallowed, and at what gets acknowledged or marked seen before you know the event was applied.
4. Call `_new_record` twice and compare the two `applied` lists with `is`.

**Follow-ups.**
1. Your process crashes after applying an event but before acknowledging it. What happens on redelivery, and what makes that safe?
2. The seen-set lives in memory. How do you persist it, how long do you keep each id, and what does that window have to do with the sender's retry schedule?
3. Instead of trusting the event payload, some teams fetch the current object from the provider's API when an event arrives. When is that better, and what does it cost?
4. A refund in retry never gets a matching payment event. How do you find out, and who should?

**Follow-up rules.**
- when: lock, mutex, threading, concurrent → ask: Two workers receive two events for the same payment at the same moment. Where exactly do you serialise, and what is the key?
- when: timestamp, created, time → ask: Two status events for one payment share the same created second. What breaks ties, and why does this exercise use seq instead?
- when: decimal, Decimal → ask: Decimal fixes the arithmetic. Why do payment systems still prefer integer minor units end to end?
- when: retry, queue, dead letter → ask: How many times will the sender retry, over what period, and what do you do when the retries run out?

**Evaluation Criteria.** Finds and explains every bug with its symptom; deduplicates by event id; orders by seq, not arrival; keeps money in integer minor units; never acknowledges an event that was not applied, and does not mark it seen; removes the shared mutable default; keeps the fix minimal and linear; adds a test per bug.

## STR-L2-04: Change data capture from the payments database to the lakehouse

| | |
|---|---|
| **Template ID** | STR-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / CDC, snapshot handoff, ordering, schema evolution, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "shards": {"2": [8, 16], "3": [64, 256]},
  "change_rate": {"2": ["5,000 row changes per second", "12,000 row changes per second"], "3": ["40,000 row changes per second", "90,000 row changes per second"]},
  "largest_table": ["3 TB", "9 TB", "20 TB"],
  "freshness": ["5 minutes", "15 minutes", "1 hour"],
  "log_retention": ["24 hours", "72 hours"]
}
```

**Business Scenario.** A payments platform runs its transactional database as {{shards}} relational shards: charges, refunds, disputes, balance transactions (each with amount, fee and net in integer minor units) and payouts. Analytics, finance and risk teams query a lakehouse copy of these tables. Today a nightly full export feeds the lakehouse; it takes longer every month and finance cannot close the books from data that is a day old. You are asked to replace it with change data capture at about {{change_rate}} at peak, with lakehouse tables no more than {{freshness}} behind.

**Problem Statement.** Design CDC from the OLTP shards into the lakehouse with ledger-grade correctness: no lost row, no duplicated row and no row in the wrong version. Cover the initial snapshot of the largest table ({{largest_table}}) and its handoff to the stream, ordering and the log position you trust, updates and deletes, schema changes made by product teams, how tables are laid out and merged in the lakehouse, and the reconciliation that proves the copy is complete.

**Constraints.** The shards are production databases: the snapshot must not lock tables or hurt payment latency. The database keeps its change log for {{log_retention}}. Balance-transaction rows are append-only at the source; charges, refunds and disputes are updated in place; a few tables are hard-deleted under retention policies. Finance needs a daily figure that matches the source to the minor unit.

**Assumptions.** All volumes, shard counts and retention periods are hypothetical. Each shard has a primary and replicas; the change log exposes a monotonically increasing position per shard (an LSN or binlog position, depending on the engine).

**Clarifications.**
- Q: Do downstream users need every intermediate version of a row, or only the latest? | A: Both: a current-state table for most users, and the full change history for audit.
- Q: Is ordering needed across shards? | A: No. Ordering per primary key within a shard is required; there is no global order across shards.
- Q: Can we add columns or triggers to the source tables? | A: No triggers. A product team may add columns, but you cannot ask them to change their write path.
- Q: What happens on a shard failover? | A: A replica is promoted. Your connector must survive it.
- Q: Who consumes deletes? | A: Retention deletes must propagate so the lakehouse does not keep data the source has removed.

**Hints.**
1. A snapshot and a stream overlap. Decide which log position the snapshot is consistent at, and what happens to changes made while it runs.
2. Order by the source's log position per shard, not by an `updated_at` column or by arrival time in the lakehouse.
3. Reconcile at a grain both sides can compute cheaply: counts and sums of amounts per table, shard and day, then drill down to keys.

**Follow-ups.**
1. Walk through the snapshot-to-stream handoff for the {{largest_table}} table. Which rows can be seen twice, and why is that harmless in your design?
2. A row is updated twice within the same second. How does your merge pick the right version, and what breaks if you used `updated_at` instead?
3. A product team renames a column. What does each stage of your pipeline do, and who is alerted?
4. Finance's daily sum of net amounts differs from the source by 42 minor units for one shard. How do you find the cause?
5. The connector is down for longer than the {{log_retention}} log retention. What do you do, and how do you prove nothing was lost afterwards?

**Follow-up rules.**
- when: updated_at, timestamp, modified time → ask: Two transactions commit in a different order from their updated_at values. Which version does your pipeline keep, and is it the committed one?
- when: kafka, topic, partition → ask: What is your partition key, and does it keep every change to one row in order through a shard failover?
- when: merge, upsert, merge into → ask: Your MERGE sees a delete and an update for the same key in one batch. Which wins, and how do you know?
- when: nightly, batch, full export → ask: What does a full export cost at {{largest_table}}, and how fresh can it ever be?
- when: exactly once, exactly-once → ask: Where does your exactly-once guarantee end, and what makes the lakehouse table correct beyond that point?

**Production Reality Check.**
- One of the {{shards}} shards fails over to a replica during peak, and for 4 minutes the connector reads a change log whose positions do not continue from the ones it checkpointed.
- The connector falls behind and its oldest unread change is about to fall out of the {{log_retention}} log retention window.
- A deploy adds a column to the refunds table with a default value, and the source rewrites every existing row.

**Evaluation Criteria.** Consistent snapshot at a known log position with an idempotent overlap; per-key ordering by log position; deletes as tombstones that propagate; schema evolution under a contract with additive changes automatic and breaking changes blocked; a raw change table plus a merged current table; reconciliation with counts and sums per shard and day and a drill-down to keys; a plan for failover and log-retention gaps; protects the source.

## STR-L2-05: Idempotent payout pipeline

| | |
|---|---|
| **Template ID** | STR-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / idempotency keys, state machines, bank files, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "daily_payouts": {"2": ["150,000", "400,000"], "3": ["2 million", "5 million"]},
  "banks": [6, 18, 40],
  "ack_delay": ["a few hours", "up to 2 business days"],
  "cutoffs": [2, 4, 6]
}
```

**Business Scenario.** A payments platform pays merchants their available balance by bank transfer: about {{daily_payouts}} payouts a day through {{banks}} partner banks. Most banks take instructions as files with {{cutoffs}} submission cutoffs a day and send back acknowledgement and return files {{ack_delay}} later; some files arrive late, some twice, and some never. A payout sent twice is money lost to the platform; a payout never sent is a merchant who cannot make payroll.

**Problem Statement.** Design the payout pipeline from "this merchant's balance is due" to "the bank confirmed or returned the money". Cover how a payout is created exactly once, its states and transitions, how instructions are built and submitted with retries, how acknowledgement and return files are ingested idempotently, the ledger entries at each step, reconciliation with the banks, and what you do with payouts whose outcome you do not know.

**Constraints.** A payout must never be sent twice and never silently dropped. Retries are certain: workers crash, submissions time out, files are re-sent. Merchant balances must stay consistent with the ledger at every step. Banks differ in file formats and in whether they accept a reference you provide.

**Assumptions.** All volumes, bank counts and delays are hypothetical. Public payments APIs document idempotency keys on create requests (a retried request with the same key returns the first result instead of creating a second object); you may use the same idea inside your own system.

**Clarifications.**
- Q: Can a bank deduplicate on our reference? | A: Some can, within a window; some cannot. Assume you cannot rely on it everywhere.
- Q: Can a payout be cancelled after submission? | A: Only until the bank's cutoff, and only with some banks.
- Q: What is a return? | A: The bank accepted the instruction but could not credit the account, for example a closed account, and sends the money back days later.
- Q: How late can an acknowledgement be? | A: Usually {{ack_delay}}; occasionally much later, and occasionally never.
- Q: Who resolves a payout nobody can classify? | A: An operations team, through a queue you design.

**Hints.**
1. Separate deciding to pay (one payout row, created under an idempotency key) from submitting (an attempt, which may happen more than once and must be recognisable).
2. Make every transition a conditional update from an expected state. A second worker that loses the race changes nothing.
3. "Submitted, and we do not know whether the bank has it" is a real state. Give it a name and a process.

**Follow-ups.**
1. A worker submits a file and crashes before recording it. Walk through restart: how do you know whether that file reached the bank?
2. The same acknowledgement file arrives twice, and a different file acknowledges a payout you never sent. What does ingestion do with each?
3. A payout was confirmed, then returned five days later. What happens to the payout's state, the merchant's balance and the ledger?
4. Show the ledger entries for a payout that is created, submitted, confirmed and later returned, with amounts in minor units.
5. One bank's acknowledgements stop for a whole day across all {{cutoffs}} cutoffs. What do merchants see, what does operations do, and what must the system never do automatically?

**Follow-up rules.**
- when: retry, resubmit, resend → ask: Your retry fires after a timeout. How do you know the first attempt did not reach the bank, and what stops the retry from paying twice?
- when: exactly once, exactly-once → ask: Inside your system you can be exactly once. What about the bank boundary, and what do you do when you cannot know?
- when: queue, kafka, message → ask: The message is processed twice after a consumer rebalance. Which database write makes the second one harmless?
- when: status column, state machine, transition → ask: Two workers try to move the same payout from submitted to paid and to failed at the same time. What does the database see?
- when: cron, nightly reconciliation, batch reconciliation → ask: Nightly reconciliation finds a duplicate payout 20 hours after it was sent. What could you have caught earlier, and how?

**Production Reality Check.**
- A submission to one of the {{banks}} banks times out at the transport layer just before a cutoff; the file may or may not have arrived.
- A bank re-sends the previous day's acknowledgement file with a new file name, and some lines now carry different statuses.
- A deploy changes how the idempotency key is derived, and the scheduler re-creates payouts for 1 200 merchants that were already paid that morning.

**Evaluation Criteria.** Payout created once under a deterministic idempotency key with a uniqueness constraint; explicit state machine with conditional transitions; attempts separate from payouts; an in-doubt state resolved by evidence, never by blind retry; idempotent file ingestion keyed by file and line identity; double-entry ledger entries that keep balances consistent through returns; daily reconciliation per bank with a human queue; honest about the bank boundary.
