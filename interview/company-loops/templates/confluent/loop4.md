# Confluent · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of Apache Kafka
based data streaming: topics, partitions, consumer groups, schema registry,
connectors, replication, stream processing and tiered storage. Every workload,
number and schema is hypothetical, and nothing here describes how any company's
systems are actually built. Where a product rule is used, it is stated as this
exercise's rule; check current docs.

## CFL-L4-01: Tiered storage: old log segments in object storage, historical reads, retention and cost

| | |
|---|---|
| **Template ID** | CFL-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage architecture / tiered log storage, remote reads, retention, cost |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "brokers": {"2": [12, 24], "3": [90, 160]},
  "daily_ingest": {"2": ["30 TB", "80 TB"], "3": ["600 TB", "1.5 PB"]},
  "retention_days": [30, 90, 365],
  "local_hours": [6, 12, 24]
}
```

**Business Scenario.** A managed streaming service runs Kafka clusters for many customers. One cluster of {{brokers}} brokers takes in {{daily_ingest}} a day after replication is excluded. Customers want topics kept for {{retention_days}} days so that a new service can rebuild its state by replaying history, but broker disks are sized to hold only about {{local_hours}} hours of data. The plan is to keep the most recent data on broker disks and move older log segments to object storage, while every consumer keeps using the same topic, the same offsets and the same client API.

**Problem Statement.** Design tiered storage for this cluster. Cover which segments become eligible to move and when; who uploads them and how a leader change is handled; the metadata that records which offset ranges live where; the read path for a consumer asking for an old offset, and how those reads are kept from hurting producers and consumers near the head of the log; retention and deletion in both tiers; what happens when object storage is slow or unavailable; and the cost model (storage, requests, network). Say which kinds of topics you would not tier and why.

**Constraints.** A segment must never be deleted from broker disk until its copy in object storage is complete and recorded. Producer p99 latency and head-of-log consumer latency must not change while customers replay history. Offsets must stay identical whichever tier serves a read. Object storage charges per request as well as per byte stored, and has per-prefix request-rate limits (hypothetical figures are fine).

**Assumptions.** All volumes and limits are hypothetical. Topics are replicated three ways across availability zones on broker disks; the object store is durable on its own and is not replicated by the brokers. For this exercise, only closed (rolled) segments whose records are all below the high watermark may be uploaded, and compacted topics are not tiered; this exercise's rules, check current docs.

**Clarifications.**
- Q: Does every replica upload its own copy? | A: No. Only one copy per segment should exist in object storage; you decide which broker uploads it.
- Q: Do consumers need to know which tier they are reading? | A: No. The client API and offsets are unchanged; only latency differs.
- Q: How often do customers replay full history? | A: A few times a day across the cluster, often by dozens of consumers in parallel when a new service is launched.
- Q: Can retention be changed on a live topic? | A: Yes, up or down, at any time.
- Q: Is there a budget? | A: Yes. Show the main cost lines per day at the stated ingest and retention.

**Hints.**
1. Separate the log into an active part the brokers own and an immutable part described by metadata. Each remote segment needs its offset range, its time range and the leader epoch that wrote it.
2. Historical reads have very different I/O from tail reads. Give them their own threads, their own cache and their own quota.
3. Work out the request count, not just the bytes: segment size decides how many objects you create, list and fetch.

**Follow-ups.**
1. Walk through one segment's life from being rolled on the leader to being deleted from object storage, naming every state change and the record of it.
2. The leader changes while a segment upload is half done. What does the new leader do, and how do you avoid two different objects claiming the same offsets?
3. Fifty consumers start reading the same topic from offset 0. How do you keep producer latency flat, and how do you avoid fetching the same objects fifty times?
4. A customer cuts retention from {{retention_days}} days to 7. How is the remote data removed, how fast, and how do you know nothing is left behind?
5. Object storage is unavailable for an hour. What happens to producers, to local disks sized for {{local_hours}} hours, and to consumers reading history?

**Follow-up rules.**
- when: cache, caching, prefetch → ask: Fifty replaying consumers each read a different part of the topic. What is your cache hit rate now, and what bounds the memory and disk it takes on each broker?
- when: follower, followers, every replica → ask: If followers also upload, how many copies of each segment do you pay for, and which one is authoritative when they differ?
- when: compacted, compaction → ask: Why is a compacted topic harder to tier than a time-retained one? What would have to change to support it?
- when: segment size, segment.bytes, roll → ask: Halve the segment size. What happens to request costs, to the number of metadata entries, and to how stale the remote tier is?
- when: quota, throttle, rate limit → ask: Who gets throttled first when historical reads and tail reads compete on one broker, and what does the customer see?

**Production Reality Check.**
- A customer launches a new service that starts 80 consumers from the beginning of a {{retention_days}}-day topic. Within minutes, request-handler threads on six brokers are busy waiting on object-storage reads, and producer p99 on those brokers rises from 8 ms to 900 ms.
- Object storage in the cluster's region returns errors for 50 minutes. Uploads fail and back off, and broker disks, sized for about {{local_hours}} hours, keep filling; two brokers pass 90% disk.
- After a run of leader elections, the storage bill for one large topic is 1.7 times what its retention predicts: the object store holds several copies of the same offset ranges that the metadata no longer references.
- A topic's retention is cut from {{retention_days}} days to 7, and a week later the object store still holds almost all of the old data.

**Evaluation Criteria.** Clear eligibility rule (closed segments below the high watermark) and a single uploader per partition (the leader) with leader-epoch fencing; remote segment metadata with offset and time ranges, epochs and states (copy started, copy finished, delete started, deleted), so partial uploads and orphans are detectable; local deletion only after the remote copy is recorded; a separate, quota-limited historical read path with its own threads and cache so tail latency is protected; retention enforced from metadata in both tiers, with orphan clean-up; explicit behaviour when the object store fails (local retention extends, alerts on disk headroom, back-pressure as a last resort); a costed model including request counts; adapts to each incident with diagnosis, recovery and prevention.

## CFL-L4-02: Cross-region replication and failover: offsets, consumer groups, active-passive versus active-active

| | |
|---|---|
| **Template ID** | CFL-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Disaster recovery / cross-region replication, offset translation, failover and failback |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "groups": {"2": ["300", "900"], "3": ["6,000", "15,000"]},
  "rpo_seconds": [5, 30, 120],
  "rto_minutes": [5, 15, 30],
  "topics": {"2": ["400", "1,200"], "3": ["8,000", "20,000"]}
}
```

**Business Scenario.** A company runs its event streams on a Kafka cluster in one cloud region: {{topics}} topics, read by {{groups}} consumer groups, with orders, inventory and payment events among them. It wants a second region that can take over if the first is lost, with at most {{rpo_seconds}} seconds of committed records lost and service restored within {{rto_minutes}} minutes. Some teams also want to produce in both regions at once, so that users near each region get lower latency.

**Problem Statement.** Design cross-region replication and failover. Cover how records, topic configurations, schemas and access rules reach the second region; how consumer group positions are carried over (whether offsets are preserved or translated, and what a consumer does with each); the failover procedure for producers and consumers, and who decides to fail over; failback once the first region returns; and how you measure replication lag in records and in time. Then compare active-passive with active-active for these workloads: topic naming, loop prevention, per-key ordering, and which applications can safely use each.

**Constraints.** Recovery point at most {{rpo_seconds}} seconds and recovery time at most {{rto_minutes}} minutes for the critical topics. Consumers must not skip records on failover; reprocessing some records is acceptable only for consumers that can handle duplicates, and you must say which. Cross-region network is billed per byte.

**Assumptions.** All counts and objectives are hypothetical. For this exercise, there are two kinds of replication tool: one that keeps the same offsets on the destination topic, and one that writes records with new offsets and publishes periodic checkpoints that map a group's source offset to a destination offset. This exercise's rules; check current docs for any product's behaviour.

**Clarifications.**
- Q: Is replication synchronous? | A: No. It is asynchronous; a synchronous stretch cluster is out of scope because of the distance.
- Q: Do all topics need the same objectives? | A: No. About a tenth are critical; the rest can tolerate hours.
- Q: Are consumers idempotent? | A: Some are (they upsert by key); some are not (they send emails or move money). You must say how each kind fails over.
- Q: Who triggers failover? | A: Your design should say: automatic, a human with a runbook, or automatic with a human gate.
- Q: Does the schema registry need to be in both regions? | A: Yes, with the same schema ids, or consumers in the second region cannot read the records.

**Hints.**
1. Start from what a consumer needs after failover: a position in the destination topic that is not ahead of what it had processed.
2. Measure lag in time as well as offsets; your objective is stated in seconds.
3. In active-active, decide which region owns each key or each topic. Two writers for one key across regions give you no ordering.

**Follow-ups.**
1. A consumer group committed offset 1,000,000 in the first region. With each replication tool, where does it start in the second region, and what does it see again or miss?
2. Walk through a failover for one critical topic, minute by minute, against {{rto_minutes}} minutes.
3. The first region comes back after three hours. How do you fail back without losing what was written in the second region and without replaying everything twice?
4. Two teams want active-active for an inventory topic. What would have to be true of their keys and their consumers for that to be safe?
5. How do you prove, every week and without an outage, that you still meet {{rpo_seconds}} seconds and {{rto_minutes}} minutes?

**Follow-up rules.**
- when: translate, translation, checkpoint, checkpoints → ask: Checkpoints are emitted every so often. How far behind can a translated position be, and which consumers can afford that many duplicates?
- when: active-active, both regions, multi-writer → ask: The same key is updated in both regions within a second. Which update wins, and how does every consumer in both regions agree?
- when: dns, bootstrap, load balancer → ask: Some producers cache the old cluster's broker addresses. How long do they keep writing to a dead region, and what happens to those records?
- when: automatic, auto failover, automatically → ask: A network partition makes the first region look dead from the second, but it is still serving most users. What stops your automation from creating two primaries?
- when: prefix, prefixed, remote topic → ask: Consumers now have to read two topic names for one stream. How do they keep per-key order across both?

**Production Reality Check.**
- In a failover drill, consumers in the second region start from translated positions up to 90 seconds behind where they were, and a non-idempotent notification service sends about 40,000 duplicate messages to customers.
- A new replication flow is set up between the two regions with the same topic names on both sides and no check on where a record came from. Records start cycling between the regions and the topic's byte rate doubles every few minutes.
- The first region is lost and the second takes over. When the first returns, it holds records written in the last {{rpo_seconds}} seconds before the outage that never reached the second region, and some conflict with writes made since.
- Replication lag for the critical topics is reported as 2,000 records, which looks healthy, but at night that is 9 minutes of data on a low-volume payments topic, far beyond {{rpo_seconds}} seconds.

**Evaluation Criteria.** Replicates data, configurations, schemas (with the same ids) and access rules; explains offset preservation versus translation and their consequences for each kind of consumer; failover procedure with a decision owner, fencing of the old region and client redirection within {{rto_minutes}} minutes; failback that reconciles divergent writes rather than overwriting them; lag measured in time against {{rpo_seconds}} seconds; active-active only with per-key or per-topic ownership, origin tagging or prefixes to stop loops, and consumers that read both; regular drills that prove the objectives; adapts to each incident with diagnosis, recovery and prevention.

## CFL-L4-03: Exactly-once stream processing end to end, including sinks that are not transactional

| | |
|---|---|
| **Template ID** | CFL-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Stream processing / transactions, read-committed consumers, idempotent sinks |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "events_per_sec": {"2": ["40,000", "120,000"], "3": ["800,000", "2 million"]},
  "commit_ms": [100, 1000, 5000],
  "sink": ["a relational database table", "a search index", "a partner's HTTP API that has no idempotency key"],
  "partitions": {"2": [48, 96], "3": [512, 1024]}
}
```

**Business Scenario.** An advertising platform bills advertisers per click. Click events arrive on a topic with {{partitions}} partitions at {{events_per_sec}} events per second. A stream processing application removes duplicate clicks, aggregates spend per advertiser per minute, and writes the results to an output topic. From there, results go to the billing ledger (another topic), and to {{sink}}. Finance says every click must be billed exactly once; a missed click is lost revenue and a double-billed one is a refund and a complaint.

**Problem Statement.** Design the pipeline so that each click affects billing exactly once, end to end. Cover the producer side (retries and duplicates), the processing side (reading input, updating state, writing output and committing input positions as one unit), how a crashed or paused instance is stopped from writing after it has been replaced, what downstream consumers of the output topic must do to see only committed results, and how {{sink}} receives each result exactly once in effect, even though it does not take part in the topic's transactions. Explain the latency cost of committing every {{commit_ms}} ms.

**Constraints.** Results must be visible to billing within 30 seconds. Instances crash, pause for garbage collection and are rescheduled. The output topic is also read by teams you do not control. Input producers are mobile and web clients that retry on timeout.

**Assumptions.** All rates are hypothetical. For this exercise: an idempotent producer lets the broker drop retried duplicates within one producer session per partition; a transactional producer can write to several partitions and commit consumer positions atomically; a consumer in `read_committed` mode reads only up to the last stable offset (the first offset of a transaction still open), and skips records of aborted transactions; a producer that starts with the same transactional id fences older instances. This exercise's rules; check current docs.

**Clarifications.**
- Q: Do clicks carry an id? | A: Yes, a client-generated click id; the same click retried keeps its id.
- Q: How long can a duplicate click arrive after the original? | A: Almost always within 10 minutes; rarely up to an hour.
- Q: Do the teams reading the output topic use read_committed? | A: Some do not, and you cannot force them on day one.
- Q: Can the sink be changed? | A: You can change how you write to it, not the sink itself.

**Hints.**
1. Separate three problems: duplicates in the input, duplicates caused by your own retries and restarts, and duplicates at the sink.
2. Commit the input positions in the same transaction as the outputs; otherwise a crash between them replays or skips.
3. A sink that cannot join the transaction needs an idempotent write: a deterministic key per result, or the input positions stored alongside the data.

**Follow-ups.**
1. Trace one click from the client retry to the billing ledger, naming each place a duplicate could be created and what removes it.
2. An instance pauses for longer than the transaction timeout and a replacement takes over its partitions. What happens when the paused instance wakes up and tries to commit?
3. What does a consumer of the output topic that does not use read_committed see, and what would you tell its team?
4. How do you deliver each result once in effect to {{sink}}? What breaks if the sink is down for 20 minutes?
5. Billing finds a 0.02% difference between clicks and billed clicks for one day. How do you find where it came from?

**Follow-up rules.**
- when: idempotent producer, enable.idempotence, sequence number → ask: The client app retries a click after its process restarted. Does the idempotent producer catch that duplicate? What does?
- when: commit interval, commit.interval, commit more often → ask: Commit every 10 ms instead. What happens to throughput, to the number of transaction markers, and to brokers?
- when: upsert, merge, on conflict, deterministic key → ask: What exactly is the key, and does it stay the same if a window is recomputed after a late click?
- when: outbox, two-phase, 2pc, distributed transaction → ask: Which component coordinates, what happens if it crashes between the two phases, and do you really need it here?
- when: dedup, deduplication, dedupe → ask: How big is your dedup state at {{events_per_sec}} events per second with a one-hour window, and where does it live when an instance moves?

**Production Reality Check.**
- A processing instance stops for 90 seconds in a garbage-collection pause, longer than the transaction timeout. Its partitions are reassigned; when it resumes, it tries to send its buffered results and commit.
- A bug leaves one producer's transaction open for 15 minutes. read_committed consumers of the output topic report growing lag on three partitions although records are arriving.
- The sink is unreachable for 20 minutes. When it comes back, results for those minutes are written twice because the writer inserts rows rather than writing by key.
- After a deploy that raised the commit interval from {{commit_ms}} ms to 60 seconds, the billing dashboard shows spend arriving in one-minute steps and an advertiser's budget cap is overshot before the pacing service sees it.

**Evaluation Criteria.** Separates input duplicates (dedup by click id within a bounded window, state in a changelog-backed store), retry duplicates (idempotent producer) and restart duplicates (consume-transform-produce in one transaction with input positions committed atomically); zombie fencing through a stable transactional id and epochs; consumers of the output in read_committed mode, with the cost of open transactions on the last stable offset explained; sink writes made idempotent (deterministic keys, upserts, or positions stored with the data) or an explicit dedup layer for an API with no idempotency key; commit interval chosen against latency and overhead; end-to-end reconciliation counts; adapts to each incident with diagnosis, recovery and prevention.

## CFL-L4-04: Managed connector fleet: scheduling thousands of tasks, isolation, status and restarts

| | |
|---|---|
| **Template ID** | CFL-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Platform design / multi-tenant scheduling, failure isolation, control plane |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "tasks": {"2": ["5,000", "12,000"], "3": ["80,000", "200,000"]},
  "tenants": {"2": ["600", "1,500"], "3": ["9,000", "25,000"]},
  "plugins": [40, 90, 150],
  "status_seconds": [10, 30, 60]
}
```

**Business Scenario.** A managed streaming service offers connectors: customers pick a plugin (one of {{plugins}} source and sink types, such as databases, object stores and SaaS APIs), give it a configuration and credentials, and the service runs it. Across {{tenants}} tenants there are {{tasks}} connector tasks running at once. Each task copies data between one external system and one or more topics. Customers see each connector's state (running, paused, failed) and want it within {{status_seconds}} seconds of a change.

**Problem Statement.** Design the connector fleet. Cover the control plane (connector configurations, desired state, secrets) and the data plane (workers that run tasks); how tasks are placed on workers, and whether tenants share workers; how one tenant's failing or misbehaving task is kept from affecting others; restarts with backoff and when to stop restarting; where each task's source or sink positions are stored; how plugin versions are rolled out; how status and errors reach customers; and capacity planning as tasks are added and removed.

**Constraints.** A failure in one tenant's connector must not stop or slow another tenant's. Credentials must never appear in logs or status messages. Changing one connector must not pause unrelated tasks. A plugin version must be rollable back within minutes.

**Assumptions.** All counts are hypothetical. For this exercise, a connector is split into tasks, each task's progress is stored as positions in a topic or store the service owns, and workers in one group rebalance tasks among themselves when members change. This exercise's model; check current docs for any product's behaviour.

**Clarifications.**
- Q: Are plugins written by the service? | A: Most are; some are from partners. Assume any of them can leak memory, hang or crash.
- Q: Can a task be moved between workers safely? | A: Yes, if its positions are stored outside the worker; a move costs a restart.
- Q: Do customers choose task counts? | A: They choose a maximum; you may run fewer.
- Q: What counts as failed? | A: Your design should define it: crashed, stuck with no progress, or erroring on every record.

**Hints.**
1. Separate desired state (what should run) from observed state (what is running); a reconciler moves one toward the other.
2. Decide the unit of isolation (process, container, worker group per tenant) by cost and blast radius, and say what a noisy neighbour can still do.
3. "Running" is not "making progress". Status needs a progress signal, not only a liveness one.

**Follow-ups.**
1. Walk through creating a connector with 8 tasks, from the API call to the first record written.
2. One tenant's source database goes down and its 400 tasks start crash-looping. What happens to the workers they share and to other tenants?
3. How do you roll out a new plugin version to {{tasks}} tasks, and how do you notice that it is worse before it reaches all of them?
4. How do you detect a task that reports running but has copied nothing for two hours?
5. How do you size and bin-pack workers, and when do you split a tenant onto dedicated workers?

**Follow-up rules.**
- when: rebalance, rebalancing, group membership → ask: One worker restarts every minute. How many unrelated tasks stop each time in your design, and how do you make that number small?
- when: kubernetes, container, pod → ask: Is one task one container? What does that cost at {{tasks}} tasks, and what do you lose if many tasks share one?
- when: retry, backoff, restart → ask: After how many restarts do you stop, what state do you show, and who is told?
- when: dedicated, per tenant, isolated → ask: What does dedicating workers per tenant cost at {{tenants}} tenants, and which tenants actually need it?
- when: canary, staged rollout, gradual → ask: Which metric tells you the canary is worse, and how long do you wait before widening?

**Production Reality Check.**
- One tenant's source database is down. Its 400 tasks crash and restart every few seconds; each restart changes worker group membership and pauses tasks of about 200 other tenants on the same workers.
- A new version of a popular sink plugin leaks memory. Workers run out of memory after about six hours, and the tasks they held move together to other workers, which then run out of memory too.
- A customer's sink connector shows running for two hours while it has written nothing; it is blocked on a lock in the destination database, and the customer finds out from their own users.
- A task's error message, shown in the console and sent to logs, contains the full connection string with a password.

**Evaluation Criteria.** Desired-state control plane with a reconciler and an assignment service; tasks with externally stored positions so they can move; isolation designed by blast radius (per-tenant worker groups or process-level isolation for risky plugins, resource limits) with its cost stated; restarts with exponential backoff, a failure budget and a terminal failed state that is shown to the customer; incremental, membership-change-tolerant assignment so unrelated tasks keep running; progress-based health (records and positions advancing) as well as liveness; staged plugin rollout with canaries and fast rollback; secrets redacted from every error path; status latency within {{status_seconds}} seconds; adapts to each incident with diagnosis, recovery and prevention.

## CFL-L4-05: Partition reassignment planner: evening out broker load under replication throttles

| | |
|---|---|
| **Template ID** | CFL-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Cluster operations / replica placement, throttled data movement, leader balance |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "brokers": {"2": [12, 30], "3": [90, 200]},
  "partitions": {"2": ["20,000", "45,000"], "3": ["250,000", "600,000"]},
  "throttle_mb": [40, 100, 250],
  "new_brokers": [3, 6, 12]
}
```

**Business Scenario.** A Kafka cluster of {{brokers}} brokers holds {{partitions}} partition replicas across three racks. Load has drifted: a few brokers carry far more disk, network and leader traffic than others, and {{new_brokers}} new, empty brokers have just been added. Moving a replica means copying its whole log to the new broker, which competes with producers and consumers for disk and network, so movement is limited by a replication throttle of about {{throttle_mb}} MB/s per broker.

**Problem Statement.** Design a planner and executor that move replicas and leaders to even out load. Cover the inputs (per-partition size, bytes in and out, leader and follower placement, racks, broker capacity); the objective and hard constraints (rack-aware placement, disk headroom, keeping each partition's in-sync replicas at or above its minimum); how a plan is broken into batches and executed under the throttle; how progress is monitored and a plan paused or aborted; when leaders are moved instead of data; and how you estimate how long the plan takes before you start.

**Constraints.** Producer p99 latency must not rise by more than 20% during movement. A partition must never have fewer in-sync replicas than its minimum because of the plan. The plan must survive a broker failure mid-run. Operators must be able to say how much data is left to move and when it will finish.

**Assumptions.** All sizes and rates are hypothetical. For this exercise, a reassignment adds the new replicas first, lets them copy and catch up, and removes the old replicas only once the new ones are in sync, so a partition's replica set is temporarily larger; leaders can be moved among in-sync replicas without copying data. This exercise's model; check current docs.

**Clarifications.**
- Q: Do all partitions need moving? | A: No. Choose what to move; moving less data for most of the benefit is better.
- Q: Is the throttle per broker or per partition? | A: Per broker, inbound and outbound, as stated.
- Q: Can I move leaders only? | A: Yes; it is cheap, but it balances only leader traffic, not disk.
- Q: What does producer latency depend on here? | A: Producers wait for all in-sync replicas to acknowledge; slow followers on busy brokers raise it.

**Hints.**
1. Score a plan by load evenness gained per byte moved; moving a huge, quiet partition is rarely worth it.
2. A new replica can only join the in-sync set if it copies faster than the partition receives new data. Check that against the throttle.
3. Execute in small batches with a budget of concurrent moves per broker, so a failure or an abort leaves little half done.

**Follow-ups.**
1. Estimate the duration of a plan that moves 14 TB onto {{new_brokers}} new brokers at {{throttle_mb}} MB/s each. What makes the real run slower than the estimate?
2. One partition receives data faster than its share of the throttle. What happens to its new replica, and what do you do?
3. A broker fails halfway through a batch. What state are the affected partitions in, and how does the executor resume?
4. How do you choose between moving data and moving only leaders for a broker that is hot on network but not on disk?
5. How would you run this continuously, as a background balancer, without it fighting operators or flapping?

**Follow-up rules.**
- when: greedy, heuristic → ask: Your greedy step picks the most loaded broker's biggest partition. Show a case where that moves far more data than needed.
- when: throttle, throttled, throttling → ask: Raise the throttle to finish faster. Which brokers' producers feel it first, and how do you know before they complain?
- when: batch, batches, concurrent moves → ask: How do you choose the batch size, and does it change as the plan runs?
- when: leader, leadership, preferred leader → ask: Moving leaders to the new brokers shifts consumer fetch traffic too. What happens to their network?
- when: optimal, optimisation, solver, linear programming → ask: At {{partitions}} replicas, how long does your solver take, and what do you do when the cluster changes while it runs?

**Production Reality Check.**
- A plan that moves 14 TB onto the {{new_brokers}} new brokers at {{throttle_mb}} MB/s each has run for twice its estimated time and is 40% done: three hot partitions receive data faster than their throttled copy rate, so their new replicas never join the in-sync set, and their old replicas cannot be removed.
- A source broker fails mid-batch. For several partitions the replica set now contains the half-copied new replica and one surviving old one; with a minimum of two in-sync replicas, producers to those partitions start receiving not-enough-replicas errors.
- Leaders are moved to the {{new_brokers}} new brokers in one step. Consumers follow the leaders, and one new broker's outbound network saturates within minutes.
- The throttle was raised from {{throttle_mb}} MB/s to three times that to finish overnight. Producer p99 on two old brokers rises fourfold, because their disks are serving both the copies and consumers reading old data.

**Evaluation Criteria.** Inputs and capacity model per broker (disk, network in and out, leaders) and per partition; an objective that trades load evenness against bytes moved, with rack-aware and minimum-in-sync hard constraints; a duration estimate from bytes, throttle and concurrency, plus the catch-up condition (copy rate above the partition's incoming rate); small batches with a concurrency budget per broker, monitoring of in-sync state, latency and progress, and safe pause, resume and abort; leader moves as a separate, cheap step applied gradually; recovery from a broker failure mid-plan; continuous balancing with hysteresis so it does not flap; adapts to each incident with diagnosis, recovery and prevention.
