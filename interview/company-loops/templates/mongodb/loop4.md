# MongoDB · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a document
database and its managed cloud service: replica sets, sharded clusters, the
oplog, backups, encryption and cluster monitoring. Every workload, number, tier
and limit is hypothetical, and nothing here describes how any company's systems
are actually built or operated. Where a product rule is used, it is stated as
this exercise's rule; check current docs.

## MDB-L4-01: Cluster performance telemetry for many thousands of clusters

| | |
|---|---|
| **Template ID** | MDB-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Fleet telemetry / per-member metrics, rollups, replication-lag and disk alerts |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "clusters": {"2": ["8,000", "20,000"], "3": ["60,000", "150,000"]},
  "sample_seconds": [10, 30, 60],
  "alert_minutes": [2, 5],
  "retention_days": [30, 90, 400]
}
```

**Business Scenario.** A managed document-database service runs {{clusters}} customer clusters. Each is a replica set of three, five or seven members, or a sharded cluster made of several replica-set shards, config servers and query routers. An agent beside every member reports metrics every {{sample_seconds}} seconds: operation counters, read and write latencies, connections, cache usage, replication lag, the oplog window, disk used and free, and CPU. Customers see charts for their own clusters in the console and set alerts on them; the service's on-call engineers also need fleet-wide views. Clusters change shape all the time: members are replaced, tiers are resized by rolling restarts, shards are added.

**Problem Statement.** Design the telemetry platform: collection and ingestion, the storage layout for raw samples and rollups, the read paths for one cluster's charts and for fleet-wide questions ("which clusters have the largest replication lag right now?"), alert evaluation that notifies within {{alert_minutes}} minutes of a condition holding, retention for {{retention_days}} days, and isolation so one customer can never see another's metrics. Say how you handle counters that reset when a member restarts, members that come and go, and samples that arrive late.

**Constraints.** A chart of one cluster over the last week loads in under 2 seconds. An alert fires within {{alert_minutes}} minutes of its condition first holding, and a missing sample is never treated as a zero. Metrics are billed to no one, so storage cost per cluster must stay flat as the fleet grows. A member's metrics are shown under the cluster it belonged to at the time of the sample.

**Assumptions.** All counts, intervals and thresholds are hypothetical. For this exercise: operation counters are cumulative since the member process started and reset to zero on restart; replication lag of a secondary is the primary's latest operation time minus the secondary's latest applied operation time; an idle primary writes a no-op entry to the oplog every 10 seconds; the oplog window is the time span between the oldest and newest entries in a fixed-size oplog. These are this exercise's rules; check current docs.

**Clarifications.**
- Q: Do customers define their own alert thresholds? | A: Yes, per cluster, on any metric, with a duration ("lag above 30 s for 3 minutes"). The service also has its own fleet alerts.
- Q: Is per-second resolution needed? | A: No. Raw samples at {{sample_seconds}} seconds for recent data; coarser rollups beyond that are your choice.
- Q: Can an agent buffer when it cannot reach ingestion? | A: Yes, for about an hour on local disk, and then it drops the oldest samples.
- Q: Are clusters in many cloud regions? | A: Yes. Metrics may be stored centrally or per region; say which and why.
- Q: Do customers export metrics to their own tools? | A: Some do, through an API that reads the same store as the charts.

**Hints.**
1. Key everything by a stable member identity plus the cluster it belonged to at the time; topology changes are events, not overwrites.
2. Turn cumulative counters into rates at ingestion, detecting resets, rather than at query time.
3. Alerting and charting want different stores: one evaluates recent windows continuously, the other scans history.

**Follow-ups.**
1. Walk through one sample from the agent to a customer's chart and to an alert decision. Where is it stored, keyed how, and rolled up when?
2. A secondary is replaced by a new member during a tier change. What does the replication-lag chart for that cluster show across the change?
3. How do you evaluate tens of thousands of customer alert rules every {{sample_seconds}} seconds without scanning the raw store?
4. Disk alerts should warn before a disk fills, not when it is full. How do you project time to full, and what makes that projection lie?
5. How do you keep one noisy cluster, or one customer's export job, from slowing every other customer's charts?

**Follow-up rules.**
- when: time-series, time series, tsdb, prometheus → ask: How many distinct series is that across {{clusters}} clusters, and what happens to your store when a cluster with hundreds of shards is added?
- when: rate, derivative, delta → ask: A member restarts between two samples. What does your rate show for that interval, and how do you know it was a restart rather than a real drop?
- when: kafka, queue, stream, streaming → ask: Agents in one region reconnect after 40 minutes and flush their buffers at once. What does your alert evaluator see, and in what order?
- when: rollup, downsample, aggregate → ask: Which aggregate do you keep for latency in an hourly rollup, and can you still answer "p99 over the day" from it?
- when: tenant, isolation, multi-tenant → ask: Where is the customer id checked on a chart request, and what stops the fleet-wide view from leaking into a customer's API?

**Production Reality Check.**
- During a fleet-wide rolling upgrade every member restarts once. Operations-per-second charts show huge negative spikes, and the fleet view of "busiest clusters" is topped by clusters that were idle.
- A customer's idle cluster shows replication lag swinging between 0 and 10 seconds, and their alert at 5 seconds of lag for 1 minute pages them every few minutes all night.
- Agents in one region lose their connection to ingestion for 40 minutes and then flush their buffers. Their samples arrive late and out of order, and alerts that should have fired at {{alert_minutes}} minutes fire 40 minutes late or not at all.
- A disk projection based on the last hour's growth fires "disk full in 3 hours" for hundreds of clusters during a nightly index build that frees its temporary space when it finishes, and on-call starts ignoring the alert.

**Evaluation Criteria.** Stable member identity with topology as time-bounded events; counter-reset-aware rate computation at ingestion; a hot recent store for raw samples and alert evaluation, and a columnar or time-series history with rollups chosen per metric (sums and counts for rates, histograms or sketches for latency); alert evaluation as incremental state per rule and series, event-time windows with explicit no-data handling; lag semantics that account for idle primaries; tenant isolation enforced on every read path; per-tenant query quotas; cost per cluster kept flat; retention for {{retention_days}} days by tier; adapts to each incident with diagnosis, recovery and prevention.

## MDB-L4-02: Online resharding: changing a live collection's shard key

| | |
|---|---|
| **Template ID** | MDB-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed data movement / online resharding, catch-up, cutover, verification |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "collection_tb": {"2": ["2", "6"], "3": ["25", "60"]},
  "shards": {"2": [4, 8], "3": [16, 32]},
  "writes_per_s": ["5,000", "20,000", "60,000"],
  "block_seconds": [2, 5]
}
```

**Business Scenario.** A customer's orders collection of {{collection_tb}} TB is sharded across {{shards}} shards on a key of `{region: 1}`. It was a reasonable choice when the company had a few large regions; now one region holds most of the orders, its chunks cannot be split any further, and one shard takes most of the {{writes_per_s}} writes per second at peak. The customer wants to move to a compound key of the tenant id and a hashed order id, without taking the application offline.

**Problem Statement.** Design the online resharding process the database service runs for the customer. Cover how documents are copied into the layout of the new key while the application keeps writing; how changes made during the copy are captured and applied; how and when the cluster switches from the old layout to the new one, blocking writes to the collection for at most {{block_seconds}} seconds; how you verify the new layout before and after the switch; how the operation can be aborted at any point before the switch with the old layout intact; and what the customer sees and must do.

**Constraints.** Writes may be blocked for at most {{block_seconds}} seconds, once. Reads never fail because of the operation. No write acknowledged with majority write concern may be lost. The extra disk and I/O load must not push the cluster's ordinary p99 latency above twice its normal value. Unique indexes stay enforced throughout.

**Assumptions.** All sizes and rates are hypothetical. For this exercise: each shard's oplog is a fixed-size log, so it covers only a limited window of time; the copy is driven from a cluster time recorded at the start; resharding needs free disk space on the receiving shards roughly equal to the collection's size; routers learn the collection's layout from metadata held by the config servers. These are this exercise's rules; check current docs.

**Clarifications.**
- Q: Can we add shards for the duration? | A: Yes, at a cost the customer pays; say whether you would and why.
- Q: Does the application use multi-document transactions? | A: Some writes do, across orders and order lines in the same collection.
- Q: Do applications retry writes? | A: Yes; their drivers retry a failed write once, and they rely on a retried write not being applied twice.
- Q: Are there change-stream consumers on the collection? | A: Yes, an analytics pipeline that resumes from stored resume tokens.
- Q: Can the customer choose when the switch happens? | A: Your design should say whether it is automatic, scheduled or approved by the customer.

**Hints.**
1. Separate the operation into a bulk copy as of one cluster time, a catch-up that applies every change since that time, and a short, bounded switch.
2. The catch-up reads the source shards' oplogs. Compare the copy's duration with how much time those oplogs cover.
3. The switch is a metadata change on the config servers. Decide what must be true before it is allowed to commit.

**Follow-ups.**
1. Walk through a single order document that is updated twice during the copy and once during the switch. Where is each change applied, and what guarantees it is applied once?
2. How do you decide that the catch-up is close enough to start the {{block_seconds}}-second switch, and what happens if peak traffic arrives just then?
3. A write is retried by a driver after the switch, but the first attempt was applied on the old layout. How does the new owner know not to apply it again?
4. How do you verify, before committing, that the new layout holds exactly the documents of the old one, without reading {{collection_tb}} TB twice?
5. What happens to the analytics pipeline's change stream across the switch, and to a resume token issued before it?

**Follow-up rules.**
- when: oplog, tail, tailing → ask: The copy of {{collection_tb}} TB takes longer than one shard's oplog covers at peak. What does your process do when it finds the oplog entry it needs is gone?
- when: dual write, double write, write to both → ask: Who performs the dual writes, the routers or the application, and what happens to a transaction that touches documents mapped to two different new owners?
- when: checksum, hash, hashes → ask: Documents keep changing while you compute your hashes. At which cluster time are the old and new hashes taken, and how do you compare them?
- when: abort, rollback, roll back → ask: The operation aborts after the receiving shards have used most of their free disk. What is cleaned up, in what order, and what does the customer pay for?
- when: throttle, rate limit, backpressure → ask: Throttling the copy keeps latency safe but makes it take three days. What does that do to your catch-up and to the oplog window?

**Production Reality Check.**
- The copy of {{collection_tb}} TB takes 31 hours because of throttling, but one source shard's oplog covers only 26 hours at peak. At catch-up, that shard's oldest needed entry has been overwritten.
- When the switch is due, peak traffic of {{writes_per_s}} writes per second means the receivers fall further behind each minute, and the remaining changes cannot be applied within {{block_seconds}} seconds.
- Seconds before the switch, the order service increments an order's item count; the reply is lost and the driver retries after the switch. The retry is applied again on the new owner, and the customer is charged for one item more than they ordered.
- A nightly report that counts orders per tenant shows 0.03% more documents than the application's own totals for a day after the switch, until a cleanup removes leftover copies on shards that no longer own them.

**Evaluation Criteria.** Three clear phases (consistent copy at a cluster time, oplog-driven catch-up, a bounded commit); an oplog-window check before and during the copy, with resizing or faster copy as remedies; idempotent change application and correct handling of transactions and retried writes across the switch (session and retry history carried to the new owner); a commit gate based on measured catch-up rate against {{block_seconds}} seconds, with deferral at peak; atomic metadata switch with router refresh; verification by per-range counts and hashes at the same cluster time plus sampling; abort leaves the old layout untouched and cleans up; change-stream continuity explained; resource controls; adapts to each incident with diagnosis, recovery and prevention.

## MDB-L4-03: Multi-region replica sets: placement, write concern and regional failure

| | |
|---|---|
| **Template ID** | MDB-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | High availability / multi-region replica sets, elections, write concern, read preference |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "regions": ["two regions on one continent, about 15 ms apart", "three regions on one continent, up to 40 ms apart", "two continents with two regions each, about 80 ms apart across the ocean"],
  "loss_rule": ["no acknowledged order may ever be lost", "no acknowledged order may be lost; activity-feed writes may lose a few seconds"],
  "read_mix": ["90% reads", "60% reads"]
}
```

**Business Scenario.** A retailer runs its order and activity-feed data in one replica set and serves customers from {{regions}} in round-trip time. The workload is {{read_mix}}, mostly customers viewing their own orders and feeds. The business rule is that {{loss_rule}}. Last year a cloud region was unavailable for six hours, and the retailer now wants the database to survive the loss of any one region with automatic failover.

**Problem Statement.** Design the deployment. Cover how many members go in which regions and why, member priorities and votes, any members that should not become primary or should not serve reads, the write concern per kind of write, the read preference and read concern per kind of read, and how a customer always sees an order they just placed. Then walk through, step by step, what the application sees when the region holding the primary is lost, and when that region is only cut off from the others.

**Constraints.** Survive the loss of any one region with a new primary within one minute and no manual step. Honour the loss rule above. Order placement p99 under 300 ms from any customer location. Customers must see their own new order on their next page view.

**Assumptions.** All latencies and workloads are hypothetical. For this exercise: a replica set has at most 7 voting members; a primary needs to see a majority of voting members or it steps down; an election starts after the primary has been unreachable for about 10 seconds; a write acknowledged by only the primary can be rolled back if that primary fails before the write reaches a majority; an arbiter votes but holds no data. These are this exercise's rules; check current docs.

**Clarifications.**
- Q: Is a third site available for a tie-breaking member? | A: Yes, in any region, at a cost; say what you would put there.
- Q: Can the application be in all regions? | A: Yes; application servers run in every serving region, and each talks to the whole replica set.
- Q: Do drivers retry writes? | A: Yes, once, on errors that are safe to retry.
- Q: Is the activity feed in the same collections as orders? | A: Separate collections in the same replica set.
- Q: Would sharding by region be acceptable? | A: Not in this round. One replica set; you can mention when you would change that.

**Hints.**
1. Count votes per region first: after losing any one region, do the survivors hold a majority?
2. A write is safe from rollback only once a majority holds it. Work out where that majority is and what it costs in round trips.
3. Reading your own write needs either the primary or a session that carries the time of the write.

**Follow-ups.**
1. Show the member layout and the vote count left after losing each region in turn.
2. What does an order placement cost in round trips with your write concern, and how does it change after a failover moves the primary?
3. The primary's region is cut off but still running, with application servers that customers can reach. What happens to writes and reads there, minute by minute?
4. How does a customer in a far region see their own order immediately while most reads go to a nearby secondary?
5. Where would you use an arbiter, a hidden member or a delayed member here, and where would each one hurt you?

**Follow-up rules.**
- when: arbiter, arbiters → ask: One data-bearing secondary goes down for maintenance while the arbiter is up. What happens to your majority writes and to the primary's memory?
- when: w:1, w 1, acknowledged by the primary → ask: Which writes use that, and what happens to them if the primary fails one second after acknowledging?
- when: nearest, secondarypreferred, secondary → ask: A secondary is 20 seconds behind. Which customers see stale data, and what bounds it?
- when: priority, priorities → ask: The highest-priority member's region comes back after the failover. Does it take the primary back, and what does the application feel when it does?
- when: causal, session, sessions, read your own → ask: The customer's next page view lands on a different application server in another region. Does the session's time travel with it?

**Production Reality Check.**
- A configuration change sets the default write concern to acknowledgement by the primary alone, to cut order latency. A month later the primary fails; on its return about 4 seconds of acknowledged orders are rolled back and set aside, against the rule that {{loss_rule}}.
- A three-member layout with an arbiter in the cheapest region is chosen to save cost. While the one data-bearing secondary is down for an upgrade, majority writes time out, the application's retries pile up, and the primary's cache fills with changes it cannot yet consider committed.
- The primary's region is cut off from the others for 12 minutes but stays reachable from customers there. The old primary steps down; customers in that region can still read from local secondaries and see orders that stop updating, while a new primary is elected in another region.
- After the failover, every write from the application servers in the original region, and each retry, now crosses an inter-region link before it is even sent to a majority, and order placement p99 there rises by several of those round trips until traffic is moved.

**Evaluation Criteria.** Member placement where losing any region leaves a voting majority (a third site for a tie-breaker when only two serving regions exist); priorities that prefer the serving regions and avoid electing a far member; majority write concern for orders, with any weaker concern limited to data the loss rule allows to lose; read preferences per read with bounded staleness, and read-your-own-writes through the primary or causally consistent sessions carrying the operation time across servers; clear accounting of inter-region round trips per write; correct election and step-down behaviour under loss and partition; arbiters and hidden or delayed members used knowingly; adapts to each incident with diagnosis, recovery and prevention.

## MDB-L4-04: Customer-managed encryption keys: rotation, revocation, backups and replicas

| | |
|---|---|
| **Template ID** | MDB-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Security architecture / envelope encryption, key rotation and revocation, backups |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "clusters": ["300", "2,500", "12,000"],
  "rotation_days": [30, 90, 365],
  "backup_days": [7, 35, 365],
  "revoke_hours": [1, 4]
}
```

**Business Scenario.** A managed database service lets customers encrypt their clusters at rest with a key they hold in their own cloud provider's key management service. {{clusters}} clusters use the feature, some spread across regions. Customers rotate their key every {{rotation_days}} days, keep backups for {{backup_days}} days, and expect that if they revoke the service's access to their key, their data stops being readable by anyone within {{revoke_hours}} hours. Auditors ask every customer to prove both: rotations happen, and revocation works.

**Problem Statement.** Design how customer-managed keys are used. Cover the key hierarchy (what the customer's key encrypts, and what encrypts the data files); how a cluster member gets the keys it needs when it starts, restarts or is replaced; key rotation, and whether it rewrites data; how backups and snapshots are encrypted and what a restore needs; what happens to replicas in other regions; how the service detects that access has been revoked and what it does then; and the audit trail a customer can show their auditors.

**Constraints.** The service never holds the customer's key material in plaintext outside the key management service. Rotation must not take a cluster offline. A restore of any backup within {{backup_days}} days must work, or fail with a clear reason the customer can act on. After revocation, no member, backup or restore can decrypt data within {{revoke_hours}} hours.

**Assumptions.** All counts and periods are hypothetical. For this exercise: the key management service lets an authorised caller ask it to encrypt or decrypt a small key with the customer's key, logs every such call in the customer's account, and keeps previous key versions until the customer deletes them; the database's storage engine encrypts data files with its own data keys, which can be wrapped by a master key. These are this exercise's rules; check current docs.

**Clarifications.**
- Q: Is the customer's key regional? | A: By default yes, one key per region; some customers create linked keys usable in several regions.
- Q: Who triggers rotation? | A: The customer, in their key management service. The service must notice and act.
- Q: Does revocation mean the customer deleted the key? | A: Usually they remove the service's permission to use it; sometimes they delete it, which cannot be undone.
- Q: Are logical exports covered? | A: Customers can export data to their own object storage; say whether and how exports are protected.
- Q: Can the service's support engineers read customer data? | A: Not in this design; access to plaintext data is the customer's.

**Hints.**
1. Envelope encryption: the customer's key wraps a small number of data keys; rotation can rewrap those without touching the data files.
2. A backup taken before a rotation was wrapped by an earlier key version. Write down which key versions every retained backup depends on.
3. A running member holds unwrapped data keys in memory. Decide how revocation reaches a member that never restarts.

**Follow-ups.**
1. Draw the key hierarchy and show which calls to the key management service happen at member start, at rotation, at backup and at restore.
2. The customer rotates their key. What changes in the cluster, in its replicas in other regions, and in the backups?
3. How does the service learn that access has been revoked, and what does it do in each of the first {{revoke_hours}} hours?
4. A restore is requested of a snapshot taken just before the customer's last two rotations. What must still exist for it to work, and how do you warn a customer before they break it?
5. How does a customer prove to an auditor that a revocation drill worked, using records the service cannot alter?

**Follow-up rules.**
- when: re-encrypt, reencrypt, rewrite → ask: Re-encrypting every data file at each rotation costs I/O on {{clusters}} clusters every {{rotation_days}} days. What does rewrapping give up compared with that, and when would you still re-encrypt?
- when: cache, cached, in memory → ask: How long may a member keep using a data key it unwrapped before revocation, and how do you enforce that bound?
- when: shut down, shutdown, stop the cluster → ask: Stopping members makes the data unreadable, but a member that is down cannot be told to start again later. What is the customer's path back if the revocation was a mistake?
- when: kms outage, unavailable, outage → ask: The key service is down for 30 minutes in one region. Is that a revocation? What do members there do, and what do you tell the customer?
- when: snapshot, snapshots, backup → ask: A snapshot copied to a second region for disaster recovery: which key wraps it there, and what happens to it when the customer revokes the key in the first region only?

**Production Reality Check.**
- A customer changes a permission policy on their key by mistake. Running members keep serving, but a member restarted for a routine patch cannot unwrap its keys and stays down; the rolling patch stalls with one member out of three.
- A customer rotates their key and deletes the previous key version the same day. The next day a restore of a snapshot taken two days earlier fails, although the snapshot is well inside the {{backup_days}}-day retention.
- A customer revokes access during a security incident and expects their data unreadable within {{revoke_hours}} hours. Members in a second region are still serving reads after the {{revoke_hours}}-hour deadline has passed, and a logical export in object storage was never encrypted with their key.
- A regional outage of the key management service lasts 35 minutes. An automated check treats every failed call as revocation and starts stopping members across hundreds of healthy clusters.

**Evaluation Criteria.** A clear envelope hierarchy (customer key wraps per-cluster or per-member data keys; data keys encrypt files) with plaintext customer key never leaving the key service; member start and replacement paths with least-privilege access; rotation by rewrapping, propagated to every member and region, with optional re-encryption as a separate, scheduled operation; a per-backup record of the key versions it depends on, with warnings and blocks before a customer deletes a version a retained backup needs; revocation detected by periodic and event-driven checks, distinguished from outages, with a bounded in-memory key lifetime and a defined shutdown sequence within {{revoke_hours}} hours; replicas and exports covered; auditable evidence from the key service's own logs; adapts to each incident with diagnosis, recovery and prevention.

## MDB-L4-05: Point-in-time restore from snapshots plus the oplog

| | |
|---|---|
| **Template ID** | MDB-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Backup and recovery / snapshots, continuous oplog capture, restore verification, retention |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "data_tb": {"2": ["1", "4"], "3": ["20", "50"]},
  "snapshot_hours": [6, 12, 24],
  "window": ["24 hours", "3 days", "7 days"],
  "rto_hours": [2, 4, 8],
  "oplog_gb_hour": {"2": ["5", "20"], "3": ["80", "200"]}
}
```

**Business Scenario.** A managed database service offers point-in-time restore: a customer can restore a cluster to any second within the last {{window}}. A typical large cluster holds {{data_tb}} TB and is sharded; its shards together write about {{oplog_gb_hour}} GB of oplog per hour. Snapshots are taken every {{snapshot_hours}} hours and kept under a retention policy the customer chooses (hourly, daily, weekly and monthly copies). The usual request comes in a hurry: someone dropped a collection, or ran an update without a filter, and the customer wants the data as it was one second before, in a new cluster, within {{rto_hours}} hours.

**Problem Statement.** Design the backup and restore system. Cover how snapshots are taken without stopping the cluster and kept consistent across shards; how the oplog of every shard is captured continuously and checked for gaps; how a restore to a chosen second works, from choosing the snapshot to replaying the oplog to a single point across all shards; how a restored cluster is verified before it is handed to the customer; how retention is applied and storage is reclaimed; and how you prove, continuously, that restores work.

**Constraints.** Any second in the last {{window}} is restorable, or the console says plainly which periods are not and why. A restore of a {{data_tb}} TB cluster completes within {{rto_hours}} hours. A multi-document transaction is either fully present in a restored cluster or fully absent. Backups never add more than a few percent to the cluster's own load.

**Assumptions.** All sizes, rates and periods are hypothetical. For this exercise: each shard's oplog is a fixed-size log whose window can be shorter than an hour during heavy writes; oplog entries carry a timestamp of seconds plus an increment, and applying an entry twice leaves the same result; a transaction that spans shards commits at one cluster time on every shard it touched. These are this exercise's rules; check current docs.

**Clarifications.**
- Q: Restore in place or into a new cluster? | A: Both are offered; most urgent restores go into a new cluster so the live one can keep running.
- Q: Does "to a second" include writes in that second? | A: Your design must define it and show the definition to the customer; inclusive up to the end of the chosen second is common.
- Q: Are snapshots from storage volumes or from the database? | A: Your choice; say what each costs in consistency and speed.
- Q: Can a customer restore one collection only? | A: Not in this round; mention how you would add it.
- Q: Who pays for backup storage? | A: The customer, per GB per month, so retention changes must reclaim storage promptly.

**Hints.**
1. A restore is a base snapshot plus a replay. Its time is dominated by the bytes copied and the hours of oplog replayed since that snapshot.
2. Oplog capture is only useful if it never falls behind further than the oplog covers. Measure the gap between capture and the oldest entry still on the shard.
3. Shards must be restored to the same cluster time, not the same wall-clock second on each shard's clock.

**Follow-ups.**
1. Walk through a restore to 14:03:26 for a sharded cluster: which snapshot, which oplog slices, what is replayed where, and how the shards agree on the stopping point.
2. What is the worst-case restore time with snapshots every {{snapshot_hours}} hours and {{oplog_gb_hour}} GB of oplog per hour, and what would you change to stay within {{rto_hours}} hours?
3. How do you detect a gap in captured oplog, and what does the customer see for a period you cannot restore?
4. How do you verify a restored cluster before handing it over, without comparing it to a source that no longer exists?
5. A customer shortens retention from a year to a month. What is deleted, in what order, and how do you avoid deleting a snapshot that a restore in progress is using?

**Follow-up rules.**
- when: incremental, incrementals, block-level → ask: An incremental chain is only as good as its oldest link. What happens to restores if one block in the base snapshot is corrupt?
- when: checksum, hash, hashes, validate → ask: What exactly do you compare a restored cluster against, given that the source cluster has changed since the restore point?
- when: clock, wall-clock, timestamp → ask: One shard's clock is 3 seconds ahead. Whose second is 14:03:26, and how do you keep a cross-shard transaction whole?
- when: retention, lifecycle, expire → ask: The policy keeps monthly snapshots for a year, but your captured oplog is kept for {{window}}. What can a customer restore to from eleven months ago, exactly?
- when: drill, drills, test restore, restore test → ask: How many restores a day do you run across the fleet, chosen how, and what fails the drill?

**Production Reality Check.**
- A customer's bulk import fills one shard's oplog in 40 minutes while oplog capture for that shard is throttled. The oldest needed entry is overwritten before capture reaches it, leaving a 25-minute period that cannot be restored to.
- A collection is dropped at 14:03:27 just before the next snapshot was due, {{snapshot_hours}} hours after the last one. Replaying the oplog written since that snapshot, at {{oplog_gb_hour}} GB per hour, takes longer than copying the snapshot itself, and the restore finishes after the {{rto_hours}}-hour promise.
- In a restore drill, document counts match, but an order and its inventory reservation, written in one transaction across two shards, appear on one shard only because each shard was stopped at its own wall-clock second.
- After a customer shortens retention, their storage bill does not fall for two months: snapshots are still referenced by a long-running restore and by incremental chains whose base was supposed to be deleted.

**Evaluation Criteria.** Consistent snapshots per shard plus a cluster-wide restore point defined by cluster time; continuous, idempotent oplog capture per shard with gap detection against the oplog window and alerts that leave headroom; a restore plan that estimates its own duration against {{rto_hours}} hours (bytes to copy, hours of oplog to replay) and keeps it bounded by snapshot frequency or by pre-staged incrementals; transactions kept whole across shards; verification by startup checks, index and collection validation, counts against oplog-derived expectations and regular automated drills; retention as reference-counted deletion with incremental chains understood; non-restorable periods shown honestly; adapts to each incident with diagnosis, recovery and prevention.
