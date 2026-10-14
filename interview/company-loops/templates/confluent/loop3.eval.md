# Confluent · Loop 3 — evaluator notes (hidden from candidates)

## CFL-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Registry mirror (append-only, fed by the registry).**
  - `subjects (subject_name, naming_strategy topic|record|topic_record, first_seen_at, deleted_at NULL, deletion_kind soft|hard NULL)`.
  - `subject_versions (subject_name, version, schema_id, schema_type avro|protobuf|json, registered_at, registered_by, change_request_id NULL)`; `schemas (schema_id, fingerprint, schema_text)`. Ids and version numbers are copied from the registry, never assigned here; the same schema_id under two subjects is two version rows pointing at one schema.
  - `compatibility_settings (subject_name NULL = global, mode, valid_from, valid_to, set_by, exception_id NULL)`: a new row per change, so "which mode was in force when version 7 was registered" is an interval lookup.
  - `topic_subjects (topic, subject_name, role key|value|event_type, valid_from, valid_to)`: explicit, because record-name strategies break the one-to-one mapping.
- **Governance (owned here).**
  - `teams`, `subject_owners (subject_name, team_id, valid_from, valid_to, assigned_by)`; a subject without a current owner is a finding.
  - `schema_fields (subject_name, version, field_path, type, has_default, is_optional)`, extracted when a version is registered.
  - `field_tags (subject_name, field_path, tag e.g. pii.email|pii.name|confidential, valid_from_version, valid_to_version NULL, tagged_by, reviewed_at)`. On a new version, tags carry forward for paths that still exist; a renamed path is matched by an explicit rename declaration in the change request (or a field alias in the schema) and carries its tag; a new path is `unclassified` until reviewed, and a policy blocks publishing an unclassified field to topics readable outside the owner.
  - `dependencies (subject_name, team_id, role producer|consumer, source declared|observed, client_id or consumer_group, first_seen_at, last_seen_at)`: observed from consumer groups reading the topic and from clients fetching schema ids, declared through the change process; observed wins for "who reads", declared for "who must sign".
  - `change_requests (request_id, subject_name, proposed_schema_fingerprint, kind compatible|breaking, check_result per mode, migration_plan, status, created_by, created_at)`, `approvals (request_id, approver, decision, decided_at)`, `acknowledgements (request_id, team_id, acked_at)`, `exceptions (exception_id, subject_name, mode, reason, approved_by, valid_from, expires_at)`.
- **Change flow.** CI on the producer's repository runs the registry's compatibility check against the subject's mode (and, for transitive modes, all versions) and the classification check (no unclassified fields) before merge; registration happens from the pipeline with a service identity, not from laptops; a breaking change goes to a new subject or topic (`orders.v2`) with a dual-write or migration plan unless an approved request with all acknowledgements exists; mode changes to none only through an exception that expires.
- **Sync.** The registry's own storage is an internal Kafka topic in the self-managed product; most teams read changes through the registry's REST API on a schedule or through audit logs where available. A reconciliation job compares the registry's subjects and versions with the mirror daily; anything registered outside the process becomes an `unowned` or `unapproved` finding, not a silent insert.
- **Queries.** Personal-data subjects read by other teams: `field_tags` (current) ⋈ `topic_subjects` ⋈ `dependencies` (observed consumers) where team ≠ current owner. Compatibility history: `compatibility_settings` ordered by valid_from with `exception_id`. Version current at time t: `subject_versions` with max registered_at ≤ t per subject (mapped from the topic through `topic_subjects` at t).

**Competing designs to accept.** Using the registry's own tags or metadata features (the public docs describe tags and data-contract metadata; check current docs) as the store for classification, with this model reading them, provided history and approvals are still append-only somewhere. A single event log of governance events with projections. Schema-level rather than field-level tags only at Medium, if the candidate states what is lost.

**Bottlenecks and failure modes.** Treating subject = topic; tags at subject level only (cannot say which field); tags lost on rename; compatibility history not captured (the "02:00 none" problem); consumers known only by declaration (stale); approvals in chat instead of records; reconciliation absent so out-of-process registrations go unnoticed; hard deletes of versions still referenced by retained messages.

**Incident guidance.**
- *Compatibility set to none for a hotfix*: contain by restoring the mode and registering a compatible version (re-adding the field with a default) so consumers can read new messages; identify messages produced with the incompatible schema by schema id and decide whether consumers skip, dead-letter or reprocess them. Guardrail: mode changes only through expiring exceptions, configuration changes mirrored with actor, and an alert on any change to none.
- *Tag did not follow a rename*: tag the new path, find every topic and sink that received it since the version was registered, and run the data-handling procedure for the copies. Guardrail: new fields are unclassified by default and block publication to broadly readable topics; renames must be declared in the change request.
- *Near-copy subjects to dodge review*: the review queue for {{breaking_requests}} requests a month is the root cause. Add a fast path (compatible changes auto-approve in CI), give breaking changes an SLA, and make subject creation require an owner; sweep unowned subjects to their producing team by observed producer.

**Follow-up guidance.** (1) One `subject_versions` row (version 7, schema id), `schema_fields` rows for the new version, tags carried forward, the new optional field `unclassified` unless declared, and the change request with its check result. (2) A declared rename or alias carries the tag; otherwise the field is new, untagged and blocked from broad topics. (3) The mirror shows the mode change, its actor, no exception and the version registered under it; an expiring-exception requirement and an alert on mode changes would have prevented it. (4) Observed consumers from consumer groups and schema-id fetches, freshness = last_seen_at; unknown consumers are listed and the owner signs for them. (5) Event feed or polling plus a daily reconciliation; out-of-process subjects become findings with an owner assigned by observed producer.

**Rubric anchors.** 2: an owners table and a list of subjects, no history, tags at subject level. 3: registry mirror with versions and compatibility history, explicit topic-subject mapping, field-path tags carried across versions, dependencies and a change flow with approval. 4: also renames, exceptions with expiry, observed versus declared consumers, reconciliation against the registry and deletions recorded with their effect on retained data.

**Strong signals.** Separates what the registry owns from what governance owns; knows which side upgrades first under backward and forward. **Red flags.** Re-numbering schema ids; letting anyone set compatibility to none; classification that requires reading payloads.

## CFL-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Topics.**
  - `orders.events` (delete policy, 30 days): typed events keyed by `order_id`, {{partitions}} partitions. Events: OrderCreated, ItemsChanged, PaymentAuthorised, OrderPacked, ShipmentDispatched (one per shipment), OrderDelivered, OrderCancelled, RefundIssued.
  - `orders.state` (compacted): key `order_id`, value the full current order (not a diff), written by a stream processor from `orders.events` or by the service itself in the same publish path. New services bootstrap here, then follow `orders.events` (or follow `orders.state` alone if they only need state).
- **Envelope.** Key: `order_id` only (stable, so hashing is stable). Headers: `event_id` (UUID), `event_type`, `schema_id` if not in the payload's wire format, `producer`, `correlation_id`, `causation_id`, `trace context`. Value: `order_id`, `seq` (per-order version, 1, 2, 3…), `occurred_at`, `merchant_id`, `customer_id`, the event body. The wire format carries the schema id prefix when a schema registry serializer is used.
- **Publishing.** Transactional outbox: the order row change and an outbox row (event_id, order_id, seq, payload) commit in one database transaction; a relay (polling or CDC on the outbox table) publishes in seq order per order with an idempotent producer; a crash after publish and before marking sent republishes, which consumers absorb by event_id or seq. CDC directly on the order tables is acceptable if the event semantics are reconstructed downstream.
- **Ordering guarantees.** Per order only (one key, one partition). The producer runs with idempotence enabled, which keeps order with up to five in-flight requests (check current docs), or with one in-flight request. Consumers keep the last applied `seq` per order: `seq ≤ last` is a duplicate or stale update and is dropped; `seq > last + 1` is a gap, parked and retried or fetched from the state topic.
- **Per-customer ordering.** Not provided by the order topic. The notifications team re-keys by customer_id in its own processor (a repartition topic) and orders by occurred_at within a customer; cost: an extra topic and cross-partition timing, so ordering is by event time with a small buffer, not a guarantee.
- **Partition growth.** Do not add partitions in place for a keyed topic whose consumers need per-key ordering. Create a new topic with the target count, dual-write or switch producers at a quiesce point per key, let consumers drain the old topic before reading the new one (or switch per order when its last event in the old topic is consumed). Size {{partitions}} up front with headroom.
- **Erasure.** Write a tombstone for the order key in `orders.state`; the old value is removed only after compaction has run past it and the tombstone itself is removed after `delete.retention.ms` (this exercise's rule; check current docs); a consumer that reads slower than that can miss the tombstone. The event topic ages out at 30 days, or personal data is kept out of events (reference ids only, or field-level encryption with per-customer keys that are destroyed: crypto-shredding). Consumers' copies need their own deletion path driven by an erasure event.

**Competing designs to accept.** Event sourcing with Kafka as the log of record (the service's state rebuilt from the event topic), if they handle the read-your-writes problem. State topic only, with consumers diffing states, for small consumer counts. Per-event-type topics, if they explain how per-order ordering across types is kept (usually it is lost, so a single topic per aggregate is preferred).

**Bottlenecks and failure modes.** Keying by merchant (hot partition), by customer (fine for ordering but uneven), or no key (ordering lost); diffs instead of full state in the compacted topic (bootstrap needs all history); dual writes without an outbox; adding partitions in place; tombstones that consumers miss; personal data in a 30-day event log; consumers that trust delivery order without seq.

**Incident guidance.**
- *Outbox relay republished a batch*: duplicates are expected under at-least-once relay. Contain by deduplicating notifications on event_id (a recent-ids store) or on (order_id, seq); fix the relay to mark rows sent in small batches. Guardrail: consumer idempotency is part of the contract, tested with replayed batches.
- *State topic re-keyed by merchant*: the hot partition is the merchant's {{hot_merchant_share}}. Roll back to order-id keys; serve merchant dashboards from an aggregate keyed by merchant and time bucket (pre-aggregated, so the hot merchant's volume is reduced) or from the warehouse. Guardrail: key changes on shared topics go through review with a partition-skew check.
- *Partitions doubled in place*: per-order ordering broke for in-flight orders. Contain: consumers use seq to park out-of-order events and request state; reconcile affected orders from `orders.state`. Guardrail: partition increases on keyed topics require a migration plan; restrict the permission.

**Follow-up guidance.** (1) Key order_id; headers event_id/type/trace; value with seq and occurred_at. (2) A customer-keyed derived topic, at the cost of a repartition and event-time ordering only. (3) New topic and switch-over, never in-place growth for ordered consumers. (4) Tombstone, compaction, `delete.retention.ms`, crypto-shredding or reference-only events, and downstream deletion. (5) Idempotence on (or one in-flight request); seq protects regardless.

**Rubric anchors.** 2: one topic keyed by merchant or unkeyed, no seq, dual writes. 3: order-id keys, event and compacted state topics, envelope with event_id and seq, outbox or CDC, per-order ordering only. 4: also safe partition growth, per-customer ordering as a derived stream, erasure with tombstones and copies, and the producer settings that preserve order.

**Strong signals.** States the ordering guarantee before choosing the key; keeps full state, not diffs, in the compacted topic. **Red flags.** "Kafka guarantees order" without "per partition"; adding partitions in place; personal data with no erasure path.

## CFL-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Identities.** `clusters (cluster_id, name, region)`, `brokers (cluster_id, broker_id, first_seen_at, decommissioned_at NULL)`, `topics (topic_id UUID, cluster_id, name, created_at, deleted_at NULL)`, `partitions (topic_id, partition_no, created_at)`. The topic is keyed by its topic id; the name is an attribute, and a recreated topic is a new row with the same name.
- **Facts with validity intervals.**
  - `broker_attrs (cluster_id, broker_id, rack, host, log_dirs, valid_from, valid_to)`.
  - `topic_configs (topic_id, key, value, valid_from, valid_to)`.
  - `assignments (topic_id, partition_no, replicas int[] in order, adding int[], removing int[], valid_from, valid_to)`: replica order kept, so `replicas[1]` is the preferred leader; a reassignment is the interval where `adding` or `removing` is non-empty, also summarised in `reassignments (topic_id, partition_no, started_at, ended_at, from_replicas, to_replicas)`.
  - `leadership (topic_id, partition_no, leader_broker, leader_epoch, valid_from, valid_to)` and `isr (topic_id, partition_no, isr int[], valid_from, valid_to)`: these change most; keep full precision for 30–90 days, then roll up (time under-replicated per partition per day).
  - `replica_size_daily (date, topic_id, partition_no, broker_id, log_dir, bytes_max, bytes_end, is_leader_share, rack)`: the capacity fact, one row per replica per day.
- **Capture.** The collector reads the admin interface every {{snapshot_minutes}} minutes, diffs against the last good snapshot and writes change rows (close the old interval at the observation time, open the new one). Each collection writes a `collections (cluster_id, collected_at, status ok|partial|failed)` row. If a collection fails or returns implausible data (empty replica lists, a broker count drop beyond a threshold), it is marked failed and no changes are written; intervals spanning a gap carry `confirmed_until` (last ok collection) so a change seen after a gap is known only to have happened within the gap. Consuming the metadata change log directly is a strong alternative where it is exposed.
- **Storage estimate.** {{replicas}} replicas × (1440 / {{snapshot_minutes}}) snapshots a day × 395 days: tens of billions to trillions of rows at the larger levels, almost all identical to the previous one. Change intervals are a tiny fraction (assignments change during reassignments; leadership and ISR during incidents and rolls), plus a daily checkpoint per partition to bound as-of lookups.
- **As-of queries.** `valid_from <= t AND (valid_to > t OR valid_to IS NULL)`, clustered by (cluster_id, topic_id, valid_from) and with a daily checkpoint table so a query reads at most one day of changes. Rack at the time comes from `broker_attrs` at t, never from today's broker table.

**Competing designs to accept.** Full snapshots at a coarse grain (hourly) plus change intervals for leadership and ISR. An event log of metadata changes with projections built on demand. Bitemporal intervals (valid time and recorded time) to show what the system knew when, at Very Hard.

**Bottlenecks and failure modes.** Name as key (recreated topics merged); snapshots every interval forever (storage); empty or partial collections recorded as changes; replica order lost (preferred leader unknown); today's dimensions joined to history; ISR at full precision forever; reassignments invisible (only before and after states).

**Incident guidance.**
- *Recreated topic summed under one key*: rebuild the affected days keyed by topic id and correct the capacity report; guardrail: a uniqueness test on (topic_id) in facts and a check that a name maps to one live topic id at a time.
- *Empty replica lists written during a timeout*: delete nothing; mark the collections failed, void the intervals they opened (close them as invalid) and re-derive from the next good snapshot. Guardrail: plausibility checks before diffing (no partition may lose all replicas between two snapshots; replica count drops beyond a threshold mark the collection partial), and alerts read only confirmed state.
- *Audit joined to today's racks*: rerun with `broker_attrs` as of each day; guardrail: placement checks only use interval joins, and the current-state view is not exposed to historical reports.

**Follow-up guidance.** (1) Interval join of `assignments` (unnest replicas) to `broker_attrs` at t, filtered by rack; clustered by topic and time with daily checkpoints. (2) Snapshot rows vs change rows with numbers; keep intervals and daily facts for 13 months, ISR detail for weeks. (3) Two topic ids, two sets of rows; dashboards group by topic id and label by name with the creation date. (4) A failed-collection record, intervals marked unconfirmed for the gap, the reassignment's start or end known only within the gap. (5) `leadership` intervals vs `assignments.replicas[1]`; preferred-leader elections show as leadership intervals returning to the first replica.

**Rubric anchors.** 2: one table of current metadata copied daily, keyed by topic name. 3: identities vs interval facts, topic id key, replica order, a daily capacity fact and a storage estimate. 4: also reassignments explicit, gap handling that never invents changes, rack-at-the-time joins, and ISR retention by grain.

**Strong signals.** Asks how a recreated topic is identified; treats a missed snapshot as unknown. **Red flags.** Storing every snapshot for 13 months without estimating it; joining history to current dimensions.

## CFL-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Topology.**
  1. Source `payments` (key payment_id, {{partitions}} partitions).
  2. Re-key: `selectKey(customer_id)`; guest payments (null customer id) are branched to a path that emits an enriched record with `profile_status = guest` and no lookup.
  3. Repartition topic `app-payments-by-customer-repartition` (delete policy, short retention; the library manages it): key customer id serialised exactly as in `customer-profiles`, partition count equal to `customer-profiles`, same partitioner.
  4. Table from `customer-profiles` (compacted) materialised in a local state store with a changelog topic (compacted). If the source topic is itself compacted and keyed the same way, the library can use it as the changelog instead of creating another copy (an optimisation in Kafka Streams; check current docs).
  5. Left join stream → table: each payment record triggers one output; a profile update does not emit anything. Output to `payments-enriched` keyed by payment_id again (a second repartition if downstream consumers need payment-id partitioning, or keyed by customer id if fraud scoring is fine with it).
- **Co-partitioning.** Same partition count, same key serialisation, same partitioner on both inputs. Different client libraries can use different default partitioners (for example, some non-Java clients default to a different hash; check current docs), so the producer of `customer-profiles` must be known.
- **Join semantics and missing profiles.** Left join with `profile_status` (found | missing | guest) and the profile's `updated_at` (or source offset) in the output. A payment arriving before its profile emits `missing`; optionally, a bounded wait (a small state store of payments without a profile, re-checked when the profile arrives or after N seconds) for fraud models that need the profile, at the cost of latency.
- **Timing.** Stream–table joins look up the table's state at processing time; the library aligns inputs by record timestamp on a best-effort basis (configurable idle time). Timestamp-exact lookups need a versioned store, which newer Kafka Streams versions provide (check current docs); without it, reprocessing joins to the table's state as replayed, which is only approximately the state at each payment's event time.
- **Table copied to every instance (GlobalKTable).** No repartition and no co-partitioning; but every instance stores all {{profiles}} profiles (tens to hundreds of GB at the larger levels), restores the whole table on start, and lookups are not time-aligned with the stream. Reasonable at Medium, costly at Very Hard.
- **State and restore.** Total {{state_gb}} GB spread over instances (for example, 12 instances); restore throughput is bounded by changelog read and local write speed (assume 50–150 MB/s per instance): 60 GB / 12 = 5 GB per instance ≈ 1 minute; 900 GB / 12 = 75 GB ≈ 10–25 minutes. Persistent volumes keep state across restarts (only the tail is restored); one standby replica per task (`num.standby.replicas`, check current docs) makes failover a promotion instead of a restore.

**Competing designs to accept.** Flink or ksqlDB with equivalent concepts (keyed state, a changelog or checkpoints, a temporal join against a versioned table). An external key-value store or cache in front of the customer database with a write-through from CDC, if they size the load ({{events_per_sec}} lookups a second), handle slowdowns with timeouts and a missing flag, and accept the loss of time-aligned replay.

**Bottlenecks and failure modes.** Joining without re-keying (wrong partitions, no matches); repartition topic with the wrong partition count or serialiser; inner join (guest and early payments lost); GlobalKTable at hundreds of GB per instance; state on ephemeral disks; no standbys; reprocessing against current profiles (look-ahead bias).

**Incident guidance.**
- *Key serialisation changed*: partition counts matched, so the co-partitioning check passed while keys hashed differently. Roll back the serde; re-emit the affected hour from the source offsets with the correct serde; flag the hour's enriched records as missing-profile in the fraud store. Guardrail: a contract test that serialises a sample key with both producers' serdes and compares bytes and partitions; alert on the missing-profile rate.
- *Full restore from the changelog*: move state directories to persistent volumes, add a standby per task, and alert on restore time; estimate restore for the instance's share of {{state_gb}} GB before scaling decisions.
- *Backtest joined to today's profiles*: discard the backtest; rebuild with a versioned table (profile as of each payment's event time) or with the profile snapshot recorded in each enriched record at the time, and make that recorded version the only source for training sets.

**Follow-up guidance.** (1) Source → selectKey → repartition (count = profiles' count) → left join with table (changelog) → output; cleanup policies delete, compact. (2) The library refuses or produces wrong matches; re-key into a repartition topic with the profiles' count, or copy the profiles into a co-partitioned internal topic, or use a global table. (3) Size per instance ÷ restore throughput; standbys make it near zero. (4) Emits `missing`; fraud scoring sees `profile_status` and can apply a rule or re-score when the profile arrives. (5) Processing-time lookups and table updates interleave differently on replay; versioned stores or recorded profile versions make it reproducible.

**Rubric anchors.** 2: joins payments to profiles without re-keying, or calls the database per event with no sizing. 3: repartition topic matched to the table, left join with a missing flag, changelog-backed state, a restore estimate and standbys. 4: also serialiser and partitioner equality, GlobalKTable weighed with numbers, versioned lookups or recorded profile versions for reproducibility, and guest payments handled.

**Strong signals.** Checks partition count, serialiser and partitioner together; asks which profile a replay should see. **Red flags.** "The join just works" across different partition counts; inner join; ignoring restore time.

## CFL-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH m AS (                                    -- destination samples that are mirrors, with their source topic
  SELECT o.link_name,
         substr(o.mirror_topic, length(l.topic_prefix) + 1) AS topic,
         o.partition_id, o.sampled_at, o.log_end_offset AS mirror_offset
  FROM mirror_offsets o
  JOIN mirror_links l ON l.link_name = o.link_name
  WHERE left(o.mirror_topic, length(l.topic_prefix)) = l.topic_prefix
), lagged AS (
  SELECT m.link_name, m.topic, m.partition_id, m.sampled_at,
         GREATEST(s.log_end_offset - m.mirror_offset, 0) AS offset_lag,
         CASE WHEN s.log_end_offset > m.mirror_offset THEN
           (SELECT EXTRACT(EPOCH FROM m.sampled_at - MIN(f.sampled_at))::bigint
            FROM source_offsets f
            WHERE f.topic = m.topic AND f.partition_id = m.partition_id
              AND f.log_end_offset > m.mirror_offset)
         ELSE 0 END AS time_lag_s
  FROM m
  JOIN LATERAL (                               -- latest source sample at or before the destination sample
    SELECT log_end_offset
    FROM source_offsets s
    WHERE s.topic = m.topic AND s.partition_id = m.partition_id AND s.sampled_at <= m.sampled_at
    ORDER BY s.sampled_at DESC
    LIMIT 1
  ) s ON TRUE
), ranked AS (
  SELECT lagged.*,
         date_trunc('hour', sampled_at) AS hour_start,
         ROW_NUMBER() OVER (PARTITION BY link_name, topic, date_trunc('hour', sampled_at)
                            ORDER BY time_lag_s DESC, partition_id) AS rn
  FROM lagged
)
SELECT link_name, topic, hour_start,
       MAX(offset_lag) AS max_offset_lag,
       MAX(time_lag_s) AS max_time_lag_s,
       MAX(CASE WHEN rn = 1 AND time_lag_s > 0 THEN partition_id END) AS worst_partition
FROM ranked
GROUP BY link_name, topic, hour_start
ORDER BY link_name, topic, hour_start;
```

**Explanation.** The two samplers never line up, so each destination sample needs an as-of lookup: the latest source sample of the same partition at or before it (inclusive). The inner LATERAL join drops destination samples with no earlier source sample, which the problem excludes. Offset lag is the difference, floored at 0 because the source sample can be older than records that have already been mirrored. Time lag uses a second lookup, the earliest source sample showing an offset beyond the mirror's: because offsets never decrease, it is at or before the as-of sample whenever the lag is positive, so the time lag is never negative. `date_trunc('hour', …)` on the destination time (session time zone UTC) defines the group; ROW_NUMBER by time lag then partition picks the worst partition, and the `time_lag_s > 0` condition turns it NULL in an hour where nothing is behind. The prefix is stripped only when the destination topic starts with it, which handles the plain link (empty prefix), dotted topic names and destination-local topics.

**Complexity.** One index-friendly lookup per destination sample into `source_offsets` (primary key topic, partition_id, sampled_at) for the as-of value, and one more for the first crossing: O(D log S) with the index. In production the same logic runs as a stream: keep the last few source samples per partition in state and compute lag as destination samples arrive, or compare record timestamps directly.

**Dialect notes.** Snowflake has `ASOF JOIN … MATCH_CONDITION (m.sampled_at >= s.sampled_at)` for the as-of lookup, `DATEDIFF('second', a, b)` and `DATE_TRUNC('hour', ts)`. BigQuery has no LATERAL with LIMIT: use a window over the union of both samplers (`LAST_VALUE(source_offset IGNORE NULLS) OVER (PARTITION BY topic, partition_id ORDER BY sampled_at, source_first)`), `TIMESTAMP_DIFF(b, a, SECOND)` and `TIMESTAMP_TRUNC(ts, HOUR)`. Spark SQL uses the same union-and-window approach and `unix_timestamp` differences. MySQL 8.0.14+ supports `JOIN LATERAL`, `TIMESTAMPDIFF(SECOND, a, b)` and `DATE_FORMAT(ts, '%Y-%m-%d %H:00:00')`. With the union approach, give source rows priority at equal timestamps so the lookup stays inclusive. None of these variants is executed here.

**Edge cases built into the data.** A destination sample taken at exactly a source sample's time (inclusive as-of; an exclusive lookup lowers that hour's maximum); destination samples ahead of a stale source sample (floored to 0, an hour of zeros with NULL worst partition); destination samples before the first source sample of their partition (an hour with no row); a stuck mirror whose time lag reaches back to a source sample in the previous hour; a destination series starting exactly on an hour boundary. Hard adds a second link over the same source and frequent ties for the worst partition (all partitions of a topic are sampled at the same instants). Very Hard adds a link with a `topic_prefix`, a dotted topic name on the plain link, and a destination-local `heartbeats` topic whose name matches a source topic only if the prefix requirement is ignored.

**Common mistakes.** An exclusive as-of; no floor; comparing with the newest source sample in the table; measuring time lag from the last sample the mirror had caught up to; counting destination samples with no source sample as zero lag; choosing the worst partition by offset lag; a worst partition when nothing is behind; (Very Hard) taking everything after the first dot as the topic, using `replace()` without checking the prefix is at the start, or ignoring the prefix. Each has a diagnostic. Joining the two samplers on equal timestamps returns almost nothing.

**Follow-up guidance.** (1) Report the bracket [t − first sample showing the offset, t − last sample not showing it), or use the source record's timestamp at the mirror's offset (fetching one record per partition per check) for an exact append time. (2) A stream job keyed by partition holding the recent source samples, or the replication tool's own lag metrics; avoid per-sample lookups. (3) A window over hours per link and topic (`COUNT(*) FILTER (WHERE max_time_lag_s > 300) OVER (… ROWS 2 PRECEDING)` = 3, after filling missing hours) with an exclusion list for paused links. (4) Offset translation data (checkpoints mapping source to destination offsets) is needed for offset lag; time lag from record timestamps still means something.

**Rubric anchors.** 2: an equality join on time, or the newest source sample, or lag without a floor. 3: matches the expected result. 4: also explains why the time lag is a lower bound, how to compute this continuously, and the quiet-partition blind spot.

**Strong signals.** Asks how the two sampling clocks relate before writing the join; floors the lag unprompted and explains why it goes negative. **Red flags.** Averaging lag across partitions; stripping prefixes with string splits on dots; an inner join on `sampled_at`.
