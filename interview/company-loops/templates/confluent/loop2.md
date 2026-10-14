# Confluent · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of Apache Kafka
based data streaming: topics, partitions, consumer groups, schema registry,
connectors, replication, stream processing and tiered storage. These are not
questions from any company's interviews. Every workload, number, schema and
incident is hypothetical, and nothing here describes how any company's systems
are actually built. Where a product rule is used, it is stated as this exercise's
rule; check current docs. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CFL-L2-01: Sticky rebalance — a balanced assignment that moves the fewest partitions

| | |
|---|---|
| **Template ID** | CFL-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Greedy algorithms / heaps, balanced assignment with minimal movement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | CFL-L2-01.mjs |

**Business Scenario.** The `{{group}}` consumer group reads several topics, and each partition must be consumed by exactly one member of the group. When members join or leave, the group rebalances and an assignor decides who owns what. Every partition that changes owner costs something: the old owner stops, the new owner rebuilds local state and caches, and processing on that partition pauses while it moves. A sticky assignor therefore keeps the assignment balanced while moving as few partitions as possible. You are writing the assignment step.

**Problem Statement.** Implement `rebalance(partitions, members, owned)`. `partitions` lists every `(topic, partition)` the group subscribes to now, in any order. `members` lists the member ids in the group now. `owned` lists the last known ownership as `(member, generation, [(topic, partition), ...])`, one row per member; it can include members that have since left. Return a dict that maps every member in `members` to its sorted list of partitions. Partitions sort by topic, then by partition number. Member ids compare as strings. Apply these rules, which are this exercise's rules (real assignors differ in detail; check the client documentation):
1. **Valid claims.** A claim counts only if its member is still in the group and its partition still exists. If several members claim one partition, the claim with the highest generation wins. If two or more members share that highest generation, nobody keeps the partition. A member's valid claims are its *retained* partitions.
2. **Quotas.** With P partitions and C members, every member gets ⌊P/C⌋ partitions, and P mod C members get one more. The extra places go to the members with the most retained partitions, and ties go to the smaller member id.
3. **Keep.** Each member keeps its lowest retained partitions, up to its quota, and releases the rest.
4. **Place.** Every partition nobody kept is free. Free partitions are taken in ascending order. Each one goes to the member that holds the fewest partitions at that moment, among members still below their quota. Ties go to the smaller member id.
If `members` is empty, return `{}`. {{replay_rule}}

**Constraints.** Up to 200 000 partitions and 5 000 members. Up to 150 000 partitions can be free in one rebalance. Something close to O(P log P + P log C) is expected. Scanning every member for every free partition is O(P·C) and is too slow.

**Assumptions.** Group sizes, topics and generations are hypothetical. Every member subscribes to every topic in `partitions`. A partition appears at most once in `partitions` and at most once in one member's list. Each member appears at most once in `owned`.

**Clarifications.**
- Q: Does the result have to move the fewest partitions? | A: Yes, and these rules guarantee it. Giving the extra places to the members that retain the most, and keeping up to the quota, keeps as many partitions as any balanced assignment can. The rules also fix which of the many optimal answers you return.
- Q: Which retained partitions does an overloaded member release? | A: Its highest ones. It keeps the lowest, up to its quota.
- Q: Does `('orders', 10)` sort before `('orders', 2)`? | A: No. The partition number is an integer, so 2 comes before 10.
- Q: What happens to claims from a member that left? | A: They are ignored, and those partitions are free.
- Q: Can there be more members than partitions? | A: Yes. Then the quota is 0 or 1, and some members get an empty list.

**Hints.**
1. Work out the quota of every member before you place anything. Once quotas are fixed, every free partition just needs a member with room.
2. "The member with the fewest partitions, then the smallest id" is the minimum of the key `(count, member)`. A heap of members below quota gives that in O(log C), and a member goes back in only while it still has room.
3. Resolve claims in one pass over `owned`, keeping the best `(generation, member)` per partition and marking a tie at the top generation.

**Follow-ups.**
1. Your function runs for the whole group in one place. Which member or service computes it in a consumer group, and what does every member need to send so that it can?
2. With an eager protocol every member stops consuming all its partitions at the start of a rebalance. How would you use your output to stop only the partitions that actually move?
3. Members have different capacity: some run on larger machines. How would you change the quotas, and does "fewest moves" still have a clean definition?
4. Partitions differ in traffic by a factor of 100. How would you balance load instead of counts without moving many more partitions on every rebalance?

**Follow-up rules.**
- when: round robin, round-robin, modulo → ask: Round robin from scratch is balanced. How many partitions does it move when one member joins a group of 50 members that owns 3 000 partitions, and what does each move cost a consumer with local state?
- when: min(, scan every member, for each member → ask: You scan the members for every free partition. How many steps is that with 150 000 free partitions and 4 000 members?
- when: heapq, heap, priority queue → ask: What exactly is your heap key, and what goes wrong if the member id is not part of it?
- when: generation → ask: How can two members both report the same partition, and what would happen if both kept consuming it?
- when: cooperative, incremental, eager → ask: In a cooperative rebalance, partitions that move are revoked first and assigned in a second round. Using your output, which partitions are revoked from whom?

**Evaluation Criteria.** Valid claims only (members still in the group, partitions that still exist, highest generation, ties left unowned); quotas that give the extra places to the members retaining the most, with the id tie-break; overloaded members release their highest partitions; free partitions placed in ascending order to the least-loaded member with room; numeric partition order; `{}` for an empty group; a heap or another O(log C) placement; a clear argument that the result is balanced and moves the fewest partitions; sensible answers on cooperative rebalancing and weighted load.

## CFL-L2-02: Read-committed view of a partition — transactions, markers and the last stable offset

| | |
|---|---|
| **Template ID** | CFL-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Stream processing / transactions, single-pass state machines |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | CFL-L2-02.mjs |

**Business Scenario.** Producers write to the `{{topic}}` topic inside transactions, so that a batch of related records becomes visible to consumers all at once or not at all. In one partition's log, transactional records from many producers are interleaved. When a transaction ends, a commit or abort marker for that producer is written to the log. Consumers that use `read_committed` must never see aborted records, and must not read past the first record of a transaction that is still open, because that transaction could still commit. A test tool needs to compute exactly which records such a consumer would receive, and a partition can hold hundreds of thousands of entries.

**Problem Statement.** Implement `visible_records(log, high_watermark, start=0, isolation="read_committed")`. `log` is a list of `(offset, producer_id, kind)` in increasing offset order. `kind` is `"data"` (a non-transactional record), `"txn"` (a transactional record), or `"commit"` / `"abort"` (a marker for that producer). Return, in order, the offsets of the records a consumer receives when it reads from offset `start`. These are this exercise's rules, modelled on the publicly documented behaviour; check current docs:
1. Entries at or above `high_watermark` do not exist yet for consumers, and that includes markers.
2. A producer's transaction is its run of `"txn"` records after its previous marker (or from the start of the log). The producer's next marker below the high watermark ends it, as committed or aborted. A marker when the producer has no open transaction changes nothing.
3. **`read_uncommitted`** returns every `"data"` and `"txn"` record with `start ≤ offset < high_watermark`.
4. **`read_committed`** reads only below the *last stable offset*: the first offset of the earliest transaction that is still open, or `high_watermark` if none is open. Below it, it returns every `"data"` record and every `"txn"` record of a committed transaction, with `offset ≥ start`.
Markers are never returned. {{replay_rule}}

**Constraints.** Up to 300 000 log entries from up to 1 000 producers. Offsets increase but can have gaps. Something close to O(n) is expected. Checking every record against every aborted transaction, or scanning ahead from each record to its marker, is too slow.

**Assumptions.** Offsets, producer ids and volumes are hypothetical. One producer has at most one open transaction at a time. Non-transactional records never join a transaction, even when their producer has one open.

**Clarifications.**
- Q: A transaction's commit marker is at the high watermark. Is it committed? | A: Not yet. The marker is not visible, so the transaction is still open and it sets the last stable offset.
- Q: Is a non-transactional record after the last stable offset returned? | A: No. A `read_committed` consumer reads nothing at or after the last stable offset.
- Q: A committed transaction has records both below and above the last stable offset. Which are returned? | A: Only the ones below it. The others are returned later, once the open transaction ends.
- Q: Does a transaction that began before `start` matter? | A: Yes. If it is still open, the last stable offset is below `start` and nothing is returned.
- Q: What does `read_uncommitted` do with aborted records? | A: It returns them. It ignores transactions entirely, apart from never returning markers.

**Hints.**
1. Sweep the log once. For each producer, keep the offsets of its open transaction. On a marker, decide all of them at once, then forget the producer.
2. After the sweep, whatever is still open sets the last stable offset: take the smallest first offset among open transactions.
3. A second pass can then pick the visible offsets in order. There is no need to sort anything.

**Follow-ups.**
1. A producer opens a transaction and then hangs. What do `read_committed` consumers of this partition see until the transaction times out, and which metric would show it?
2. Real consumers do not get the whole log at once. They get a batch and a list of aborted transactions with their first offsets. How would you filter batch by batch with bounded memory?
3. Your consumer reads the topic and writes results to another topic in the same transaction. What does that give you end to end, and what does it not give a database sink?
4. Compaction runs on a transactional topic. Which records and markers can it remove, and when?

**Follow-up rules.**
- when: any(, for each aborted, aborted list → ask: You check every record against the list of aborted transactions. How many comparisons is that with 300 000 records and 7 000 aborted transactions?
- when: buffer, hold back, until the commit → ask: You hold records back until their marker. How much memory can one long transaction pin, and what bounds it?
- when: last stable offset, lso → ask: One producer opens a transaction and stops. What happens to the last stable offset, and to every `read_committed` consumer of this partition?
- when: high watermark → ask: Why can a consumer not read past the high watermark, even with `read_uncommitted`?
- when: sorted(, sort → ask: The log is already in offset order. What does your sort cost, and what would it hide if the log were not in order?

**Evaluation Criteria.** Entries at or above the high watermark ignored, markers included; transactions defined per producer between markers, with stray markers ignored; the last stable offset taken from the earliest open transaction, even one that began before `start`; committed records above the last stable offset held back; non-transactional records cut at the last stable offset too; `read_uncommitted` returning aborted records; markers never returned; one O(n) sweep with per-producer state; good answers on hung transactions and batch-by-batch filtering.

## CFL-L2-03: Debug the schema compatibility checker

| | |
|---|---|
| **Template ID** | CFL-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Schema evolution / compatibility modes, defaults, enums, optional fields |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |
| **Generator** | CFL-L2-03.mjs |

**Business Scenario.** Before a producer team registers a new version of the `{{subject}}` schema, a pre-merge check runs the new schema against the versions already registered, under the subject's compatibility mode. Several complaints point at the checker. Widening `amount` from `int` to `long` was rejected, but a change that narrowed a field was accepted and broke consumers. A new field with default `0` was rejected as having no default. Adding an enum symbol was rejected under `FORWARD` even though the old enum has a default symbol. A schema compatible with the latest version was rejected because of a version from two years ago. Making an optional field required passed the check, and old records with nulls then failed to read.

**Problem Statement.** Fix `check_compatibility(new_schema, previous, mode)` so that it meets this specification. These are this exercise's rules, a simplified model of the publicly documented Avro resolution rules and registry modes; check current docs. {{replay_rule}}
1. **Schemas.** `{"name": ..., "fields": [...]}`. A field is `{"name", "type"}` plus, optionally, `"default"` (any value, including `0`, `""`, `False` or `None`) and `"optional": True` (the field may hold null). A type is a primitive name (`"boolean"`, `"int"`, `"long"`, `"float"`, `"double"`, `"string"`, `"bytes"`) or an enum `{"enum": [symbols]}` with an optional `"default"` symbol.
2. **Reading.** A reader schema can read data written with a writer schema field by field. A reader field fails if the writer has no field of that name and the reader field has no `"default"` key. It also fails if the writer's field type cannot be read as the reader's type, or if the writer's field is optional and the reader's is not. Writer fields the reader does not have are ignored.
3. **Types.** Two primitives are readable if they are equal or the writer's type promotes to the reader's: `int` → `long`, `float`, `double`; `long` → `float`, `double`; `float` → `double`; `string` ↔ `bytes`. Two enums are readable if every writer symbol is a reader symbol, or the reader's enum has a default symbol. An enum and a primitive are never readable.
4. **Modes.** `BACKWARD`: the new schema must read data written with the latest version. `FORWARD`: the latest version must read data written with the new schema. `FULL`: both. The `_TRANSITIVE` forms check every registered version, not only the latest. `NONE` checks nothing.
5. **Output.** `previous` is oldest first, and version `v` is `previous[v - 1]`. Return a sorted list of `[version, direction, field]`, where `direction` is `"backward"` (the new schema cannot read that version's data) or `"forward"` (that version cannot read the new schema's data). Return `[]` when compatible, when the mode is `NONE`, or when nothing is registered.

**Constraints.** Keep the function's shape and output format. Up to 300 versions of 300 fields, in time linear in the fields checked.

**Assumptions.** Schemas are simplified and hypothetical: no nested records, unions other than optional, arrays, maps, aliases or logical types. Field names are unique within a schema.

**Clarifications.**
- Q: Is a default of `None` a default? | A: Yes. The rule is whether the `"default"` key is present, not what its value is.
- Q: Does an optional field without a default get null automatically when it is missing? | A: No. In this exercise, as in Avro, a field the reader never receives needs a declared default, optional or not.
- Q: Which way does a promotion go? | A: From the writer's type to the reader's. A reader declared `long` can read data written as `int`, not the other way round.
- Q: For `BACKWARD`, which schema is the reader? | A: The new one: consumers upgraded to it must read records already written with the old version.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. For each complaint, write the smallest pair of schemas that reproduces it, and decide which schema is the reader before you look at the code.
2. Read `PROMOTIONS` and its comment, then read how `_type_ok` uses it.
3. List the Python values that are falsy. Which of them are legitimate defaults?
4. `previous` is oldest first. Which element is the latest version?

**Follow-ups.**
1. A team wants to rename a field. Under `FULL_TRANSITIVE`, what sequence of versions and deployments gets them there, and how long does it take?
2. The subject is `BACKWARD`, but a consumer still running an old schema reads new records. What breaks, and which mode should the subject have had?
3. Your checker says compatible, yet a consumer fails in production after the change. Name two ways that can happen that this model does not cover.
4. Several topics share one record type through references to another subject. How do you check a change to the shared type without breaking any of them?

**Follow-up rules.**
- when: if not, falsy, truthy → ask: Which defaults does `if not rf.get("default")` wrongly treat as missing? Give one for every primitive type.
- when: transitive → ask: Why do consumers that replay a topic from the beginning need a transitive mode, and what does it cost producers who want to evolve the schema?
- when: promotion, widen, narrow → ask: Widening `int` to `long` passes `BACKWARD`. Does it pass `FORWARD`? Explain it with the reader and the writer.
- when: enum, symbol → ask: Adding an enum symbol: which mode does it break when the old enum has no default symbol, and what do old consumers do with the new symbol?
- when: optional, nullable, null → ask: Making a field optional is safe in one direction only. Which, and why?

**Evaluation Criteria.** Finds and explains every bug with its symptom; promotion checked from writer type to reader type; default presence tested by key, not truthiness; enum default symbol honoured; non-transitive modes check the latest version; optional rule applied when the writer may send null and the reader cannot hold it; the fixes stay minimal; a regression test per bug; credible answers on renames, mode choice and failures the model misses.

## CFL-L2-04: Consumer lag monitoring — offsets, time behind and alerts that do not flap

| | |
|---|---|
| **Template ID** | CFL-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Observability / consumer lag in offsets and time, alerting state machines |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "groups": {"2": ["1,500", "4,000"], "3": ["20,000", "60,000"]},
  "partitions": {"2": ["80,000", "200,000"], "3": ["1.5 million", "4 million"]},
  "sample_every": ["15 seconds", "30 seconds", "60 seconds"],
  "page_after": ["5 minutes behind", "15 minutes behind"]
}
```

**Business Scenario.** A streaming platform serves many teams, and each team runs consumer groups against shared clusters: about {{groups}} groups reading {{partitions}} partitions in total. Teams want to know when a group falls behind, but "lag" means different things to different groups. A batch-style sink that commits every ten minutes always shows a large offset lag and is fine. A payment consumer 2 000 records behind on a quiet topic may be hours late. Today one alert rule on offset lag pages people for healthy groups and misses stuck ones, and on-call has started to mute it. You are asked to design lag monitoring that teams trust, with a page when a group is {{page_after}}.

**Problem Statement.** Design the system that measures and alerts on consumer lag. Cover what you collect and from where (log-end offsets, committed offsets, record timestamps) every {{sample_every}}; how you compute lag in offsets and lag in time per partition and roll it up per group; how you tell "behind but catching up" from "stuck" and from "idle topic"; how alerts are evaluated without flapping; how teams set thresholds per group; and how you keep collection cheap at this scale.

**Constraints.** Collection must not load the brokers noticeably. A group that has stopped committing must be detected even if its lag is small. Rebalances, which briefly stop commits, must not page anyone. Groups that are deleted or renamed must not leave stale alerts. Every alert must say which partitions are behind and since when.

**Assumptions.** Group counts, partition counts and thresholds are hypothetical. Committed offsets and log-end offsets can be read through the cluster's admin interface. Records carry timestamps, which may be producer-set and occasionally wrong.

**Clarifications.**
- Q: How is lag in time defined? | A: You define it. Common choices are the age of the oldest unconsumed record (now minus the timestamp of the record at the committed offset), or offset lag divided by the recent consume rate. Say which and why.
- Q: Does a consumer that commits rarely count as lagging? | A: It should not page if it is keeping up. Your design has to tell that apart from one that is stuck.
- Q: Who sets thresholds? | A: Each owning team, per group, with defaults from the platform. Most teams will keep the default.
- Q: Can you add code to the consumers? | A: Not to all of them. Assume you see only what the cluster knows: offsets, commits, group membership and records.

**Hints.**
1. Lag in offsets is cheap and exact, but it means nothing without a rate. Lag in time is what people care about. Decide how you will get a timestamp for the committed position without reading too much.
2. Think in windows: over the last N samples, is the committed offset moving, and is lag shrinking, flat or growing?
3. Alert on a state that has held for a while, with separate thresholds to raise and to clear.

**Follow-ups.**
1. A group's committed offset stays still for 20 minutes during a rebalance storm, then jumps. What did your system show and page during those 20 minutes?
2. A producer writes records with timestamps a day in the future. What does your lag in time show, and how do you protect against it?
3. A topic gets no new records for a weekend. Its consumer group stopped committing on Friday. Is it lagging?
4. Collection at {{partitions}} partitions every {{sample_every}} costs too much. What do you sample less often, and what do you lose?
5. Teams ask for a forecast: "when will this group catch up?". How would you compute it, and when should you not show it?

**Follow-up rules.**
- when: offset lag, records behind, lag > → ask: A group is 2 000 records behind on a topic that gets one record a minute, and another is 2 million behind on a topic that gets 100 000 a second. Which is worse, and how does your alert know?
- when: timestamp, event time, record time → ask: Whose clock set that timestamp, and what does your time lag show when it is a day in the future or years in the past?
- when: threshold, static threshold → ask: One threshold for every group pages the batch sinks every ten minutes. How do teams set their own, and what is the default?
- when: flap, flapping, hysteresis → ask: Write down your raise and clear conditions. What does a group that hovers at the threshold do with them?
- when: prometheus, metrics per partition, cardinality → ask: How many time series is that at {{partitions}} partitions, and which of them do you actually need to keep?

**Production Reality Check.**
- After a client library upgrade, about a third of the {{groups}} groups rebalance every few minutes for an hour, and their commits stall while their lag grows and shrinks.
- One producer's clock is wrong, and a topic's records arrive stamped nine hours in the future.
- The collector falls behind: one pass over {{partitions}} partitions now takes longer than {{sample_every}}, so samples arrive late and unevenly spaced.

**Evaluation Criteria.** Both offset lag and time lag defined precisely, with the timestamp source and its failure modes; committed-offset progress tracked separately from lag, so stuck and idle groups are detected; window-based evaluation with hysteresis and minimum durations; rebalances and deleted groups handled; per-group thresholds with sane defaults; collection costed against broker load and series count; alerts that name partitions and onset; a clear answer for each follow-up.

## CFL-L2-05: Dead-letter handling for sink connectors — tolerance, context and replay

| | |
|---|---|
| **Template ID** | CFL-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / error handling, dead-letter topics, replay and idempotent sinks |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "connectors": {"2": ["40", "120"], "3": ["900", "2,500"]},
  "sink": ["a cloud data warehouse table", "an object store as Parquet files", "a search index", "a relational database"],
  "daily_records": {"2": ["50 million", "300 million"], "3": ["4 billion", "12 billion"]},
  "bad_rate": ["0.01%", "0.2%", "1%"]
}
```

**Business Scenario.** A platform team runs {{connectors}} sink connectors that copy topics into {{sink}}, about {{daily_records}} records a day. Sometimes records cannot be written: a producer ships a record whose schema the target does not accept, a field holds text where a number is expected, a value is too large for the target column, or the target briefly refuses writes. On a bad day about {{bad_rate}} of one topic's records fail. Today a connector either stops on the first bad record, which blocks every good record behind it, or is set to skip errors and silently drops data. Teams want bad records set aside with enough context to fix them, the good ones kept flowing, and a safe way to replay the fixed records.

**Problem Statement.** Design error handling for the sink connector fleet. Cover which errors are retried and which are dead-lettered (transient target errors, conversion errors, transformation errors, records the target rejects); the dead-letter topic: naming, partitioning, retention, and the context stored with each record (source topic, partition, offset, error stage and class, connector, time); how tolerance is configured and when a connector should still stop; monitoring and alerting on dead-letter volume; and the replay process after a fix, including ordering, duplicates and how you prove the gap is closed.

**Constraints.** Good records must keep flowing when a bad one is dead-lettered. Nothing may be dropped without a record of it. Replay must not create duplicates in the target or reorder updates to the same key. Dead-lettered records may contain personal data and must follow the source topic's access rules and retention. A connector restart must not dead-letter the same record twice.

**Assumptions.** Volumes, rates and targets are hypothetical. As this exercise's rule, the connector framework can be configured to tolerate errors, route failed records to a dead-letter topic and attach error context as record headers, with retries for transient errors; which failure stages that covers depends on the framework version, so check current docs.

**Clarifications.**
- Q: Should a target outage send records to the dead-letter topic? | A: No. That would dead-letter everything. You decide how transient errors are retried, and how long before the connector stops.
- Q: Who owns a dead-lettered record? | A: The team that produces the topic usually owns the fix, and the platform owns the mechanism. Say how each finds out.
- Q: Can the target take the same record twice? | A: Only if your writes are idempotent, for example an upsert by key. An append-only target cannot, unless you deduplicate.
- Q: Do updates to the same key need to stay in order? | A: Yes, for keyed topics. A replayed old value must not overwrite a newer one.

**Hints.**
1. Classify errors by where they happen (converting, transforming, writing) and whether retrying can help. Only deterministic failures belong in the dead-letter topic.
2. The source topic, partition and offset are the record's identity. Keep them with the dead-lettered record, and you can replay, deduplicate and prove completeness.
3. For keyed upserts, a replayed record is only safe if the target can tell it is older than what it already holds.

**Follow-ups.**
1. A producer deploys a bad change and {{bad_rate}} becomes 40% for an hour. What should happen, and what should stop?
2. The fix is in. Walk through replaying 2 million dead-lettered records into {{sink}} while the live connector keeps running.
3. A replayed record for key K is older than the value the target now holds for K. How do you stop it from overwriting newer data?
4. Legal asks you to delete one customer's records everywhere, including dead-letter topics and replay copies. What does your design make easy or hard?
5. How would you show each team, every morning, which of their records are not in the target and why?

**Follow-up rules.**
- when: errors.tolerance, tolerance all, skip → ask: With tolerance set to skip every error, what stops a bad deploy from dead-lettering half a topic without anyone noticing?
- when: retry, backoff → ask: Which errors do you retry, for how long, and what does the connector do with the records behind the one it is retrying?
- when: replay, reprocess, re-ingest → ask: Your replay writes old records while the live connector writes new ones for the same keys. How does the target keep the newest value?
- when: headers, context → ask: Which context do you store with each dead-lettered record, and which of it could leak personal data?
- when: one dead letter topic, single dlq, shared dlq → ask: One shared dead-letter topic for {{connectors}} connectors: how does a team find and replay only its records, and who may read the others?

**Production Reality Check.**
- A producer deploy changes a field's type. Within ten minutes, 40% of one topic's records go to the dead-letter topic instead of the usual {{bad_rate}}.
- The target, {{sink}}, refuses writes for 25 minutes during maintenance, and every connector writing to it starts to fail.
- A replay of fixed records is started twice by mistake, from two terminals, while the live connector is running.

**Evaluation Criteria.** Errors classified by stage and retryability, with transient errors retried and bounded; a dead-letter topic per connector or per source topic with clear ownership, access and retention; full context with every record (source coordinates, stage, error, time); tolerance with a rate guard that still stops a connector on a flood; alerts on dead-letter volume and age; replay that is idempotent, keeps per-key order and proves completeness by source offsets; personal data handled in dead-letter copies; good answers to the follow-ups.
