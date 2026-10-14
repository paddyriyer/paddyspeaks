# Confluent · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of Apache Kafka
based data streaming: topics, partitions, consumer groups, schema registry,
connectors, replication, stream processing and tiered storage. Every workload,
number, schema and incident is hypothetical, and nothing here describes how any
company's systems are actually built. Where a product rule is used, it is stated
as this exercise's rule; check current docs. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CFL-L3-01: Schema governance — subjects, versions, compatibility, owners, tags and approved breaking changes

| | |
|---|---|
| **Template ID** | CFL-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / schema registry metadata, ownership, field classification, change approval |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "subjects": {"1": ["2,000"], "2": ["15,000", "40,000"], "3": ["120,000", "300,000"]},
  "teams": [40, 150, 600],
  "breaking_requests": [5, 20, 60],
  "pii_share": ["10%", "25%"]
}
```

**Business Scenario.** A company runs its event platform on Kafka with a schema registry in front of it, the kind of product Confluent documents publicly: producers register Avro, Protobuf or JSON Schema definitions under subjects, each subject keeps numbered versions, and each new version is checked against a compatibility mode (backward, forward, full, their transitive variants, or none; in this exercise backward is the default, as the public docs describe; check current docs). There are about {{subjects}} subjects, owned by {{teams}} teams, and about {{pii_share}} of all fields hold personal data. Today ownership lives in a spreadsheet, classification in nobody's head, and a team that needs a breaking change sets its subject's compatibility to none for an afternoon. Governance wants every subject owned, every personal-data field tagged, and every breaking change (about {{breaking_requests}} requests a month) approved with a migration plan before it can land.

**Problem Statement.** Design the governance data model that sits beside the registry, and the low-level flow of a schema change. Cover: the entities (subject, schema, subject version, compatibility setting and its history, owner team, field-level classification tags, known producers and consumers of a subject, change request, approval, exception) with their keys and how history is kept; how the model is fed from the registry and kept in sync; and how a change moves from proposal to registration, with which checks run where. Show how the model answers "which subjects with a personal-data field are read by teams other than the owner", "who changed the compatibility of subject X, when and under which approval", "which breaking changes were approved last quarter and which consumers have migrated", and "which schema version was current for topic T at time t".

**Constraints.** The registry stays the source of truth for schemas, ids and versions; the governance model never re-numbers or rewrites them. Configuration changes, approvals and tag changes are append-only and attributable to a person. A field's classification must follow the field from version to version. A subject deleted from the registry keeps its governance history. Nothing in the model requires reading message payloads.

**Assumptions.** Subject, team and request counts are hypothetical. Most subjects follow the default naming in which a topic's value schema is the subject `<topic>-value` and its key schema `<topic>-key`; some teams use record-name strategies. A schema id identifies a schema text and can appear under several subjects (this exercise's rule; check current docs).

**Clarifications.**
- Q: Is a subject the same thing as a topic? | A: No. With the default naming they line up one to one; with record-name strategies one topic can carry several subjects and one subject can serve several topics. Model the mapping explicitly.
- Q: Who may set compatibility to none? | A: In this exercise, only an approved exception with an expiry time, recorded in your model.
- Q: Do consumers register anywhere? | A: Not in the registry. Build the dependency list from what you can observe (consumer groups reading the topic, schema ids fetched by clients) and from declarations, and say which one you trust.
- Q: How is a field identified across versions? | A: Your choice. A path within the record (for example `customer.email`) is the simplest; say how a rename is handled.
- Q: Can a breaking change ever land on the same subject? | A: Only with an approved request, a migration plan and every known consumer's acknowledgement; otherwise it goes to a new subject or topic.

**Hints.**
1. Mirror the registry's facts (subject, version, schema id, compatibility setting) as append-only rows fed by the registry, and keep governance (owners, tags, requests, approvals) in your own tables keyed by them.
2. Tag fields by path within a subject version and carry the tags forward when the path still exists; a field that is new in a version arrives unclassified and blocks or flags the change until it is reviewed.
3. A breaking-change request references the subject, the proposed schema, the compatibility check result, the approvers and the consumers that must acknowledge.

**Follow-ups.**
1. Show the rows written when a team registers version 7 of `orders-value`, adding an optional field with a default, under backward compatibility.
2. A field tagged as personal data is renamed in a new version. How does the tag follow it, and what stops an untagged copy of the data from slipping through?
3. Someone sets the subject's compatibility to none at 02:00 and registers an incompatible schema. What does your model show the next morning, and what should have prevented it?
4. For a proposed change, produce the list of consumers that would break. Where does it come from, how stale can it be, and who signs off when a consumer is unknown?
5. Across {{subjects}} subjects, how do you keep governance and registry in sync, and what happens to a subject created directly in the registry, outside the process?

**Follow-up rules.**
- when: one subject per topic, topic name, topicnamestrategy → ask: A team uses a record-name strategy so one topic carries three event types. How does your model map topics to subjects, and which compatibility setting protects that topic's consumers?
- when: compatibility none, compatibility to none, set it to none → ask: Who may set compatibility to none, for how long, and how does your model show every schema registered while it was in force?
- when: tag, tags, classification → ask: Are your tags on the subject, the schema version or the field path? A new version adds a field holding an email address: what is its classification until someone reviews it?
- when: backward, forward → ask: Under the mode you chose, which side must upgrade first, producers or consumers, and where does your change flow record that order?
- when: delete, deleted, hard delete → ask: A version is deleted from the registry while retained messages still carry its schema id. What does your governance history keep, and how do you stop a deletion that would leave those messages unreadable?

**Production Reality Check.**
- A team set its subject's compatibility to none to ship a hotfix and registered a schema that removed a field without a default. Consumers in three other teams failed to deserialise for two hours, and governance showed nothing because configuration changes were never captured.
- A classification sweep reports that {{pii_share}} of fields are tagged, but a new version renamed `email` to `contact_email`, the tag did not follow, and the field reached an analytics topic that every team can read.
- With {{breaking_requests}} breaking-change requests a month waiting on review, teams start registering near-copies such as `orders-value-v2-tmp` to avoid the queue; within a quarter hundreds of subjects have no owner.

**Evaluation Criteria.** Registry facts mirrored append-only and never rewritten; subject-to-topic mapping explicit; compatibility history with actor and approval; field-path tags carried across versions with new fields unclassified by default; producer and consumer dependencies with a stated source of truth; a change flow that runs the compatibility check, classification check and approval before registration; exceptions with expiry; deletions recorded, not erased; each incident contained, corrected and guarded.

## CFL-L3-02: Orders as events — keys, partitions, compacted state topics versus event topics, and the ordering you can promise

| | |
|---|---|
| **Template ID** | CFL-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Event modeling / keys and partitioning, event versus state topics, envelopes, ordering and erasure |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "orders_per_day": {"1": ["2 million"], "2": ["20 million", "50 million"], "3": ["200 million", "500 million"]},
  "partitions": [12, 48, 192],
  "hot_merchant_share": ["5%", "20%", "35%"],
  "consumer_teams": [6, 15, 40]
}
```

**Business Scenario.** An online marketplace is moving its order service onto Kafka. An order is created, items can be changed until payment, payment is authorised, the order is packed and shipped (possibly in several shipments), delivered, and may be cancelled or refunded. There are about {{orders_per_day}} orders a day, the planned orders topic has {{partitions}} partitions, and {{consumer_teams}} teams will consume it: fulfilment, notifications, fraud, finance and analytics among them. The largest merchant produces about {{hot_merchant_share}} of all order events. Some consumers want every change as it happened; others want the current state of each order, and a new service must be able to start without replaying years of history.

**Problem Statement.** Design the topics and the events. Decide between, or combine, an event topic of typed order events and a compacted state topic holding each order's latest full state; give each topic's key, partitioning and partition count; define the envelope (event id, order id, per-order sequence, event time, producer, schema reference, correlation and causation ids) and where each field lives (key, headers or value); explain how the order service publishes so that a database commit and its event never disagree; state exactly which ordering guarantees consumers get and how they detect gaps, duplicates and stale updates; and describe how an order's personal data is erased from the compacted topic and what remains elsewhere.

**Constraints.** Every consumer sees one order's events in the order they happened. A consumer can rebuild current state from the state topic alone. Event ids are unique and consumers are idempotent. Increasing the partition count must not reorder in-flight orders, or you say how the change is made safely. Personal data must be removable on request.

**Assumptions.** Volumes, shares and team counts are hypothetical. In this exercise the producer's default partitioner hashes the key bytes and takes the result modulo the partition count, and a compacted topic keeps at least the latest value per key, with a tombstone (a null value) kept for `delete.retention.ms` before it is removed (this exercise's rules; check current docs). An order's id, merchant and customer never change after creation.

**Clarifications.**
- Q: Must events of different orders be ordered relative to each other? | A: No. Only one order's events. The notifications team would like one customer's orders in order; decide whether you support it.
- Q: Can the service write to its database and to Kafka in one transaction? | A: Not across both systems. Choose an outbox, change data capture from the order tables, or Kafka as the log of record, and say what happens on a crash between the two writes.
- Q: Does the largest merchant need its own ordering? | A: No. Its orders are independent of one another.
- Q: How long are events kept? | A: The event topic keeps 30 days in this exercise; the state topic is compacted and kept indefinitely; longer history lives in the warehouse.
- Q: Can a consumer ask for a single order's history? | A: Not from Kafka efficiently. Say where that query is served.

**Hints.**
1. Per-order ordering comes from one order always landing on one partition, so key by order id. Keying by merchant puts the largest merchant's {{hot_merchant_share}} of events on one partition.
2. Separate "what happened" (typed events) from "what is true now" (full latest state per order, compacted). A stream processor can derive the second from the first.
3. A per-order sequence number in every event lets consumers detect gaps, duplicates and stale updates without trusting delivery alone.

**Follow-ups.**
1. Write the envelope and two events, OrderCreated and ShipmentDispatched, with their keys. What goes in the key, in headers and in the value?
2. The notifications team needs a customer's orders in order. With order-id keys, how do they get it, and what does it cost?
3. The topic must grow from {{partitions}} partitions to twice that. What happens to orders in flight, and how would you migrate without breaking per-order ordering?
4. A customer asks to be erased. What do you write to the state topic, when is the old value really gone, and what about the event topic and every consumer's copy?
5. Without idempotence, with retries and several requests in flight, two events of one order can be written out of order. Which producer settings prevent it, and how does the sequence number protect a consumer anyway?

**Follow-up rules.**
- when: merchant_id, merchant id, key by merchant → ask: The largest merchant produces {{hot_merchant_share}} of events. What does keying by merchant do to one partition and to every consumer's lag during its sale?
- when: round robin, null key, no key, random → ask: Without a key, two events of one order land on different partitions. What does a consumer do when it sees "shipped" before "created"?
- when: outbox → ask: Who reads the outbox table, and what happens if the relay crashes after publishing a batch but before marking those rows sent?
- when: compacted, compaction, log compaction → ask: A new service bootstraps from the compacted topic. What does it see for an erased order, and for an order whose last two updates are still in the uncompacted part of the log?
- when: total order, single partition, global order → ask: One partition gives a total order. What throughput ceiling and failure blast radius does that impose at {{orders_per_day}} orders a day?

**Production Reality Check.**
- After a deploy, the outbox relay republished a batch of order events. Consumers that did not deduplicate by event id sent customers a second "your order has shipped" message.
- A team re-keyed its copy of the state topic by merchant id to simplify merchant dashboards. During the largest merchant's sale one of the {{partitions}} partitions carried its {{hot_merchant_share}} of traffic, and that partition's consumers fell hours behind.
- An operator doubled the partition count in production without a migration plan. For a few thousand in-flight orders, later events hashed to a different partition, and fulfilment processed "delivered" before "shipped".

**Evaluation Criteria.** Order id as the key with the reason stated; event and state topics distinguished, with the state topic compacted and derivable; an envelope with event id, per-order sequence and schema reference; an atomic publish path (outbox or CDC) with the crash case handled; ordering promised per order only, with gap and duplicate handling in consumers; a safe plan for changing the partition count; tombstones and retention explained for erasure, including copies outside Kafka; each incident contained, corrected and guarded.

## CFL-L3-03: Cluster metadata as history — brokers, topics, partitions and replica assignments over time

| | |
|---|---|
| **Template ID** | CFL-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / interval history of brokers, topics, assignments, leaders and ISR for capacity and placement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "clusters": {"1": [3, 5], "2": [20, 40], "3": [120, 250]},
  "brokers": {"1": ["24"], "2": ["300", "600"], "3": ["3,000", "6,000"]},
  "replicas": {"1": ["30,000"], "2": ["600,000", "1.5 million"], "3": ["8 million", "20 million"]},
  "snapshot_minutes": [1, 5, 15]
}
```

**Business Scenario.** A platform team runs a fleet of Kafka clusters: {{clusters}} clusters, {{brokers}} brokers and about {{replicas}} partition replicas in total. The metadata keeps changing: brokers are added, decommissioned and rebuilt in another rack; topics are created, deleted and sometimes recreated under the same name; partition counts grow; configurations such as retention and minimum in-sync replicas change; reassignments move replicas between brokers; leaders move and in-sync replica sets shrink and expand. Capacity planners and on-call engineers ask questions about the past: which brokers held replicas of a topic on a date, disk per broker per day against what was assigned to it, how many partitions had every replica in one rack last month, how leadership was spread across brokers over time, and which reassignments were running when produce latency rose. A collector can read the metadata through the admin interface every {{snapshot_minutes}} minutes.

**Problem Statement.** Design the history model and how it is captured. Cover: stable identities (cluster, broker, topic, partition) versus the facts that change about them (rack, configuration, replica assignment with its order, leader, in-sync replicas, replica size per log directory); how a topic recreated under the same name stays distinct from its predecessor; how history is stored (validity intervals, a change log, periodic snapshots, or a mix) and why; how a reassignment in progress is represented; the daily capacity fact and its grain; how as-of questions are answered efficiently; and what the model records when the collector misses snapshots.

**Constraints.** Any as-of question for the last 13 months is answerable at the snapshot interval's precision. A topic deleted and recreated under the same name is never merged with its predecessor. Replica order is kept, because the first replica is the preferred leader. Storage is bounded: estimate a full snapshot every {{snapshot_minutes}} minutes for 13 months and justify what you keep instead. A gap in collection is never recorded as a change that did not happen.

**Assumptions.** Fleet sizes are hypothetical. Clusters run without ZooKeeper (KRaft mode) and give each topic a unique topic id in addition to its name (this exercise's rule; check current docs). Each broker reports the size of each replica it hosts. Collector clocks are synchronised.

**Clarifications.**
- Q: Can I key topics by name? | A: Not safely. A topic can be deleted and recreated under the same name with a different partition count. Decide how you key it.
- Q: How do I recognise a reassignment in the data? | A: While it runs, a partition lists replicas being added and replicas being removed next to its target assignment; it ends when the target replicas are in sync and the removed ones are gone.
- Q: Do we need in-sync replica history at full precision? | A: It changes often during incidents. Keep it, and say at what grain and for how long.
- Q: Are racks fixed? | A: No. A broker can come back in another rack after a rebuild; placement questions use the rack at the time.
- Q: Will snapshots be missed? | A: Yes. The collector restarts, and a cluster can be unreachable for an hour.

**Hints.**
1. Separate identities from changing facts, and give each fact a valid_from and valid_to; most questions become "intervals that overlap time t".
2. Diff consecutive snapshots into change rows instead of storing every snapshot; a missed snapshot leaves an interval's end uncertain rather than inventing a change.
3. Capacity questions want one cheap daily fact (replica × day with bytes, leader flag and rack) that aggregates to broker, rack and topic.

**Follow-ups.**
1. Sketch the as-of query for "replicas of topic T on brokers in rack R at time t". Which clustering or index makes it fast?
2. Estimate a year of full snapshots of {{replicas}} replicas every {{snapshot_minutes}} minutes against change intervals. What do you keep for 13 months, and at which grain?
3. A topic is deleted and recreated under the same name with more partitions. Show the rows, and how "bytes per topic per day" avoids mixing them.
4. The collector missed 50 minutes on one cluster while a reassignment ran. What does your model record for that gap, and what does it refuse to claim?
5. A planner asks which brokers have led more than their fair share of partitions, and since when. Which tables answer it, and how do preferred-leader elections show up?

**Follow-up rules.**
- when: topic name, topic_name, by name → ask: The topic was deleted and recreated under the same name an hour later. Which rows does your key merge, and what does the capacity chart show for that day?
- when: snapshot, snapshots, full snapshot → ask: At {{replicas}} replicas every {{snapshot_minutes}} minutes, how many rows is that in a year, and what do you keep at that grain?
- when: scd, type 2, valid_from, valid_to → ask: How do you close an interval when the collector misses snapshots, and what does valid_to say while a change is unconfirmed?
- when: leader, leaders, leadership → ask: Is the leader part of the assignment row or a separate fact? How do you show preferred versus actual leader over time?
- when: rack, racks → ask: A broker came back in a different rack after a rebuild. Does last month's placement check use today's rack or the rack at the time, and where does that come from in your model?

**Production Reality Check.**
- The day after a topic was recreated under the same name, a capacity report showed one broker at 140% of its disk: the old and new topics' replica sizes were summed under one key.
- During a reassignment on the largest cluster, the collector's metadata call timed out and it wrote empty replica lists. History showed thousands of partitions with no replicas for {{snapshot_minutes}} minutes at a time, and the rack-spread alert paged.
- A quarterly placement audit flagged partitions with every replica in one rack, but those brokers had been re-racked since; the audit joined history to today's broker table.

**Evaluation Criteria.** Identities separated from changing facts, with topics keyed by topic id and the name kept as an attribute; validity intervals (or change log plus periodic checkpoints) with a storage estimate; replica order and preferred leader kept; reassignments represented explicitly; a daily capacity fact at a stated grain; as-of queries with suitable clustering; collection gaps recorded as unknown, never as change; each incident contained, corrected and guarded.

## CFL-L3-04: Enriching payments with customer profiles — co-partitioning, repartition topics, changelog state and restore

| | |
|---|---|
| **Template ID** | CFL-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Low-level design / stream–table join, co-partitioning, repartition and changelog topics, state restore |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, ml-platform-engineer |

```params
{
  "events_per_sec": {"1": ["5,000"], "2": ["50,000", "120,000"], "3": ["500,000", "1 million"]},
  "profiles": {"1": ["5 million"], "2": ["40 million"], "3": ["200 million", "500 million"]},
  "state_gb": {"1": [10], "2": [60, 120], "3": [400, 900]},
  "partitions": [12, 32, 64]
}
```

**Business Scenario.** A payments company scores every payment for fraud. A stream processing application (in the style of Kafka Streams, the open-source library) reads the `payments` topic, keyed by payment id, with {{partitions}} partitions and about {{events_per_sec}} events a second, and joins each payment to its customer's profile. Profiles come from change data capture of the customer database into a compacted `customer-profiles` topic keyed by customer id, about {{profiles}} customers, with a different partition count. The joined result, `payments-enriched`, feeds the fraud model. The table's local state is about {{state_gb}} GB across all instances, backed by a changelog topic. Fraud scoring tolerates a few minutes of delay at most.

**Problem Statement.** Design the topology at a low level. Cover: re-keying payments by customer id and the repartition topic it needs (key, serialisation, partition count); the co-partitioning requirements of a stream–table join and how you meet them; the join's semantics (which side triggers output, which profile a payment sees, what happens when the profile does not exist yet, and guest payments with no customer id); a partitioned table versus a table copied to every instance; the state store, its changelog topic and how long a restore takes; standby replicas; and what you put in each enriched record so fraud scoring knows which profile version, if any, was used. Say how close a reprocessing from an earlier offset comes to the first run's result.

**Constraints.** Every payment yields exactly one enriched record, with or without a profile. The `payments` topic's key cannot change, because other consumers rely on it. One instance failing must not stall scoring beyond your stated target. Keys on both sides of the join must be serialised identically.

**Assumptions.** Rates, sizes and partition counts are hypothetical. In this exercise the default partitioner hashes the serialised key bytes, so the same key serialised differently can land on a different partition (this exercise's rule; check current docs). A few percent of profiles change each day, in bursts after batch updates, and some profiles are created seconds before the customer's first payment.

**Clarifications.**
- Q: Can the profiles topic be re-partitioned? | A: Not quickly; other applications read it. You may copy it inside your application.
- Q: What should happen if the profile arrives after the payment? | A: Your choice: emit with empty profile fields and a flag, or wait a bounded time. State the cost for fraud scoring.
- Q: Which profile should a payment see on reprocessing? | A: Ideally the one current at the payment's event time. Say whether your design achieves that or only approximates it.
- Q: Can a payment have no customer id? | A: Yes, guest checkouts. They still need an enriched record.
- Q: Can I call the customer database for each payment instead? | A: You may propose it; size the load and say what happens when the database slows down.

**Hints.**
1. A stream–table join runs locally per partition, so both inputs must be keyed by the join key, with the same partition count and the same partitioner. Re-keying the stream writes it through a repartition topic.
2. The table's state store is restored from a compacted changelog; a large store takes minutes to restore on a fresh instance, and standby replicas or a persistent state directory shorten that.
3. A table copied to every instance removes the co-partitioning requirement, at the cost of holding all {{profiles}} profiles on each instance.

**Follow-ups.**
1. Draw the topology with every internal topic (repartition and changelog), its key, partition count and cleanup policy.
2. The profiles topic has a different partition count from your repartition topic. What happens if you join them directly, and what are your options?
3. One instance dies. Estimate the restore time for its share of {{state_gb}} GB, and how standby replicas change that.
4. A payment arrives two seconds before its customer's profile. What does your join emit, and how does fraud scoring know the enrichment was incomplete?
5. Reprocessing last week's payments from an earlier offset gives different enrichment from the first run. Why, and what would make it reproducible?

**Follow-up rules.**
- when: globalktable, global table, global ktable, broadcast → ask: At {{profiles}} customers, every instance holds the whole table. What does that cost per instance, and how long does a restart take to rebuild it?
- when: repartition, re-key, rekey, selectkey → ask: How many partitions does your repartition topic have, which key serialiser does it use, and what happens to the order of one customer's payments?
- when: inner join → ask: Guest checkouts and payments that arrive before their profile disappear with an inner join. What does fraud scoring then never see?
- when: standby, standbys, standby replicas → ask: How many standbys, on which instances, and what happens to restore time when a standby is far behind?
- when: external lookup, database call, call the database, query the database, cache → ask: At {{events_per_sec}} events a second, what load does a per-payment lookup put on the customer database, and what happens to the stream when the database slows down?

**Production Reality Check.**
- A deploy changed how the customer id was serialised in the repartition topic (a string became a typed key). Partition counts still matched, but the same customer now hashed to a different partition, and enrichment returned no profile for most payments for an hour.
- An instance restart restored its share of {{state_gb}} GB from the changelog because the state directory was on an ephemeral disk and no standby existed; fraud scoring on those partitions fell 40 minutes behind.
- A reprocessing job rebuilt last month's enriched payments for a fraud-model backtest. It joined them to today's profiles, and the model learned from information it would not have had at the time of each payment.

**Evaluation Criteria.** Re-keying through a repartition topic sized and serialised to match the table; co-partitioning stated precisely (key, serialisation, partitioner, partition count); join semantics correct (stream side triggers, table looked up, left join with a flag for missing profiles and guests); partitioned versus copied table weighed with numbers; changelog-backed state with a restore estimate, standbys and persistent state; profile version recorded in the output; reprocessing reproducibility discussed honestly; each incident contained, corrected and guarded.

## CFL-L3-05: Mirror lag by the hour — offset lag and time lag per mirrored partition from two samplers

| | |
|---|---|
| **Template ID** | CFL-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of lookups between two sampled series, first-crossing time, arg-max per group |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | CFL-L3-05.mjs |

**Business Scenario.** A platform team replicates topics from a source Kafka cluster to other clusters with cluster links. {{links_rule}} In this exercise a link keeps offsets: a mirrored record has the same offset in the mirror partition as in its source partition (this exercise's rule; check current docs), so the two log-end offsets can be compared directly. Two samplers run independently between {{window_start}} and {{window_end}}: `source_offsets` records each source partition's log-end offset, and `mirror_offsets` records, per link, the log-end offset of every partition on that link's destination cluster. Their clocks agree, but their sampling times do not. {{naming_rule}} The on-call team wants, for every hour, how far each link's mirrors are behind, in records and in time.

**Problem Statement.** Write one PostgreSQL query that returns `link_name, topic, hour_start, max_offset_lag, max_time_lag_s, worst_partition`. Evaluate every destination sample that is the mirror of a source topic; its source partition has that source `topic` and the same `partition_id`. Let L be the `log_end_offset` of the latest source sample of that partition taken at or before the destination sample's `sampled_at`; a destination sample with no such source sample is not evaluated. `offset_lag` is L minus the destination sample's `log_end_offset`, floored at 0. `time_lag_s` is 0 when `offset_lag` is 0; otherwise it is the whole number of seconds from the earliest source sample of that partition whose `log_end_offset` is greater than the destination sample's `log_end_offset`, to the destination sample's `sampled_at`. Group the evaluated samples by link, source topic and the UTC hour of the destination sample's `sampled_at` (`hour_start` is the start of that hour). `max_offset_lag` and `max_time_lag_s` are the maxima over the group; `worst_partition` is the `partition_id` of the sample with the largest time lag (ties go to the smaller `partition_id`), or NULL when `max_time_lag_s` is 0. Order by `link_name, topic, hour_start`.

**Constraints.** One SQL statement (CTEs allowed). "At or before" is inclusive, and a sample taken at exactly hh:00:00 belongs to the hour that starts then. Offsets in a partition never decrease. The sample has {{source_rows}} source samples and {{mirror_rows}} destination samples; production samples tens of thousands of partitions every few seconds.

**Assumptions.** Hypothetical clusters, topics, offsets and times. Both samplers' clocks are synchronised. The time lag is a sampled estimate: the record at the mirror's log-end offset was appended at or before the first source sample that showed it, so the true lag is at least this value and less than the time since the source sample before that one.

**Clarifications.**
- Q: Does a source sample taken at exactly the destination sample's time count as at or before it? | A: Yes. It is the latest one at or before.
- Q: The destination is sometimes ahead of the latest source sample. Is that an error? | A: No. The source was sampled earlier and more records were produced and mirrored since. The offset lag is floored at 0 and the time lag is 0.
- Q: Can the earliest source sample with a higher offset be in an earlier hour? | A: Yes. The time lag can span hours; only the destination sample's time decides its group.
- Q: Should an hour with samples but no lag appear? | A: Yes, with 0, 0 and NULL. An hour whose destination samples all predate the first source sample of their partitions does not appear.
- Q: What is `mirror_links` for? | A: It holds each link's `topic_prefix`, which maps a destination topic name to its source topic.

**Hints.**
1. For each destination sample, fetch the latest source sample of its partition at or before it with a LATERAL subquery (`ORDER BY sampled_at DESC LIMIT 1`); an inner lateral join drops the samples with nothing to compare against.
2. The earliest source sample with a higher log-end offset is a second lookup: `MIN(sampled_at)` over that partition's source samples whose `log_end_offset` exceeds the mirror's.
3. Number the samples in each group by time lag descending, then `partition_id`, to find the worst partition, then aggregate.

**Follow-ups.**
1. The true time lag lies between your value and the time since the previous source sample. How would you report that uncertainty, and how would record timestamps change the approach?
2. At tens of thousands of partitions sampled every few seconds, how would you compute this continuously instead of with a lookup per destination sample?
3. Write an alert that fires when `max_time_lag_s` stays above 300 for three consecutive hours. What does it do for a link that was paused on purpose?
4. A link that does not keep offsets (a replication tool that translates them) is added. What extra data do you need, and which of these numbers still mean anything?

**Follow-up rules.**
- when: on sampled_at, using (sampled_at), equal timestamps → ask: The two samplers almost never fire at the same instant. How many destination samples does an equality join on sampled_at keep, and what should the join condition be?
- when: max(sampled_at), latest sample, most recent sample → ask: Is that the latest source sample before this destination sample, or the latest in the whole table? Show where your query compares the two times.
- when: lag(, lead(, last_value( → ask: A window function orders one table. How do you get the source offset in force at each destination sample from a window over both samplers, and what happens when two samples share a timestamp?
- when: split_part, replace(, position( → ask: The plain link has no prefix and some topic names contain dots. What does your expression return for a dotted topic name on that link, and for a destination-local topic that shares a name with a source topic?
- when: avg(, average → ask: One partition is 40 minutes behind while seven are current. What does an average across partitions show the on-call engineer, and why does this report use the maximum?

**Production Reality Check.**
- The source sampler stalled for 20 minutes during a broker restart while the links kept mirroring. Destination samples ran ahead of the last source sample, and a dashboard that averaged unfloored lag across partitions showed a link as healthy while one partition was far behind.
- A link stopped replicating one partition during a quiet hour on its topic. Nothing new was produced, so offset lag and time lag both stayed 0 for that hour; the alert fired only once traffic resumed, and the on-call team asked why the report had looked healthy.

**Evaluation Criteria.** An as-of lookup (latest source sample at or before each destination sample) instead of an equality join or the newest sample; offset lag floored at 0; time lag from the earliest source sample with a higher offset, 0 when caught up; destination samples with no earlier source sample left out; hours bucketed with date_trunc on the destination time; worst partition by time lag with the tie rule and NULL when nothing is behind; at the hardest level, the link prefix stripped exactly and only from the start, so dotted names and destination-local topics are handled; can explain the sampling uncertainty and how to run this continuously.
