# MongoDB · Loop 3 — evaluator notes (hidden from candidates)

## MDB-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **`products`** (one document per product, the product page's single read):
  `{ _id, title: {en, de, …}, brand, category_path: ["outdoor", "footwear", "hiking"], images: [...urls], attrs: [{k: "waterproof", v: true}, {k: "upper", v: "leather"}], variants: [{sku, size, colour, price: {amount_minor, currency}, attrs: [...]}], price_range: {min_minor, max_minor, currency}, rating: {avg, count}, recent_reviews: [ ≤ 5 ], schema_version, updated_at }`.
  - Variants embedded while bounded (a few hundred, small, no images per variant); above a stated cut-over (for example 200 variants or a document estimate of 1 MB) the product keeps `variant_summary` (sizes, colours, price range, in-stock flag) and variants move to `variants { _id: sku, product_id, … }`. With {{max_variants}} variants at ~500 bytes each, the candidate should estimate the document and decide.
  - Descriptions in many languages are the usual size driver; large ones (or rarely shown ones) can be referenced.
- **Attributes** use the attribute pattern: `attrs: [{k, v}]` with one compound index `{ "attrs.k": 1, "attrs.v": 1 }` (multikey). A filter on two attributes uses `$all` with two `$elemMatch` clauses, or one `$elemMatch` per attribute ANDed; the index serves one of them and the other is checked on fetched documents. Alternative: a wildcard index on `attrs.*` with attributes as a sub-document; it serves single-field filters well and has documented limits on compound use and sorting.
- **Type discipline.** A collection validator (`$jsonSchema`) for required fields and types, plus an attribute dictionary collection (`attribute_defs {k, type, unit, allowed_values, category_ids}`) that the merchandising tool enforces, so "15" and 15 never coexist. Index lookups match by type, so mixed types silently split results.
- **Stock** lives in `inventory { _id: sku, product_id, available, reserved, updated_at }`, updated by the order and warehouse services; the product document carries only a coarse `in_stock` flag (or per-variant flags) updated on transitions (in stock ↔ out of stock), not on every unit. Checkout reads inventory, never the product document.
- **Reviews and questions** in their own collections keyed by `product_id` and time (index `{product_id: 1, created_at: -1}`), with the subset pattern: the newest five and the rating summary maintained on the product by an asynchronous worker.
- **Price.** The price shown comes from the variant; checkout re-reads the price by SKU (and a price version) and refuses a stale cart line rather than silently charging differently.
- **Price history and analytics.** A change stream on `products`/`variants` (with full documents or pre-images where needed) written into the warehouse as SCD2 price rows per SKU; the operational document never accumulates history.
- **Indexes.** `_id` (product page); `{category_path: 1, "attrs.k": 1, "attrs.v": 1}` or the attribute index plus category; `{ "variants.size": 1, "variants.price.amount_minor": 1 }` for variant filters — but not combined with `attrs` in one compound index when both are arrays; the missing-attribute report runs in the warehouse or with `{category_path:1}` plus `$not: {$elemMatch: {k: "X"}}` at low priority.

**Competing designs to accept.** Variants always in their own collection with a summary on the product (more writes, simpler size control). Wildcard index on an attributes sub-document instead of the k/v pattern, with its limits stated. A separate search engine for faceted listings fed by change streams, with the document database as the system of record. Bucketing reviews into documents of N reviews each.

**Bottlenecks and failure modes.** Unbounded embedded arrays (reviews, price history) growing towards the size limit and making every write rewrite a large document; parallel-array compound indexes; attribute values of mixed types splitting index matches; stock embedded in a hot document; `$lookup` on the hottest page; analysts scanning the operational cluster.

**Incident guidance.**
- *Product with {{max_variants}} variants fails on the size limit and the import retries forever*: quarantine the failing document so the feed continues (a dead-letter collection with the error), and stop retrying a non-retryable error. Fix the model: move variants out above the cut-over with a summary on the product. Guardrail: a size estimate check in the import (reject or route large products before insert) and an alert on documents above a fraction of the limit.
- *Compound index on two array fields fails to build*: the index cannot be built because some documents have both fields as arrays. Contain by shipping the feature on an index that has one array field plus a post-filter, or restructure (per-variant documents, or `tags` moved into `attrs`). Guardrail: an index plan reviewed against the schema (which fields are arrays) before the release that depends on it, and index builds run in staging on a production-shaped copy.
- *Hot product document updated hundreds of times a second for stock*: move stock to `inventory` keyed by SKU; update the product's in-stock flag only on transitions; cache product pages for seconds. Guardrail: a design rule that counters with high write rates never live in documents with high read rates, and monitoring of write conflicts per collection.

**Follow-up guidance.** (1) e.g. {{max_variants}} × ~0.5 KB plus translations; state the cut-over and that the page then reads product + variants by `product_id` (two reads, both indexed) or a summary only. (2) `{ attrs: {$elemMatch: {k: "waterproof", v: true}}, variants: {$elemMatch: {size: 44, "price.amount_minor": {$lt: 12000}}} }`; one multikey index can serve one of the two conditions; the strongest answers note which and why. (3) Stock in `inventory`; the listing filters on the coarse flag and the product page reads exact stock by SKU. (4) A background job in batches with an `updateMany` per range, writing both keys during the transition and the reader accepting both, then removing the old key. (5) History downstream from a change stream (SCD2 in the warehouse); the operational document stays small.

**Rubric anchors.** 2: everything embedded including reviews and stock, no index for attribute filters, or a column per attribute. 3: bounded embedding with a size estimate, attribute pattern with one compound index, reviews and stock separated, a validator. 4: also the parallel-array constraint, a variant cut-over with a summary, type discipline through an attribute dictionary, price consistency with checkout and history through change streams.

**Strong signals.** Starts from access patterns and sizes before drawing documents; names the multikey limitation unprompted. **Red flags.** "Documents are schemaless, so no validation"; embedding unbounded arrays; one collection per category.

## MDB-L3-02

**Reference architecture (one defensible design).**
- **Write rate.** {{devices}} devices every {{interval}}: at 1 million devices every 10 seconds that is 100,000 readings a second; the candidate should do this arithmetic for the instance's values and size the cluster (and decide on sharding) from it.
- **Collection.** `readings` as a time-series collection: `timeField: "ts"`, `metaField: "meta"` with `meta: {device_id, model}` only. Site and firmware are not in the metaField: they change, and a change would start new buckets and split one device's series; they live in a `devices` dimension (with history) and are joined in rollups by validity interval. Measurements (`temp`, `vib`, `power`) are top-level fields.
- **Granularity.** Chosen from the interval: `seconds` for 1-second readings, `minutes` for 1-minute readings (or custom `bucketMaxSpanSeconds` / `bucketRoundingSeconds` for the exact span). Readings per bucket = bucket span ÷ interval, capped by the bucket's count and size limits; the candidate should state an estimate and why a bucket of 1 reading or of a whole day is bad (compression and index size versus bucket size limits).
- **Indexes.** The time-series collection's default/created index on `{ "meta.device_id": 1, ts: -1 }` (per-device dashboard); a secondary on `{ "meta.model": 1, ts: 1 }` if model queries are common.
- **Latest reading.** `device_latest { _id: device_id, ts, values }`, updated by the ingest service with a conditional update (only if the new `ts` is newer), so late readings never overwrite a newer value.
- **Rollups.** `readings_hourly` and `readings_daily` (regular collections or time-series collections with coarser granularity), keyed by `(device_id, hour)`, computed by an aggregation with `$merge` (replace on key), so re-running an hour is idempotent. Late readings: the ingest records the touched (device, hour) in a `dirty_hours` collection; a recompute job re-aggregates those hours and their days. Site-level rollups join devices by validity interval of the site assignment.
- **Retention.** `expireAfterSeconds` = {{retention_days}} days on raw; hourly for 2 years, daily indefinitely (or archived to object storage); a reading that arrives older than the raw retention is dropped and counted, but (if desired) still applied to rollups before being dropped.
- **Bad clocks.** Readings with `ts` far in the past or future (before device activation, or more than a tolerance ahead) go to a quarantine collection with the arrival time; a device that reboots with an epoch clock is corrected using the device's monotonic counter if available, otherwise kept in quarantine.
- **Sharding.** If the write rate needs it, shard on `meta.device_id` (hashed or ranged by a device prefix) so per-device queries are targeted; site-wide queries scatter but run against rollups.

**Competing designs to accept.** Ordinary collections with a manual bucket pattern (one document per device per hour with an array of readings), if they explain why time-series collections do this for them and what they would lose. Rollups in the warehouse instead of the operational cluster, if the dashboard's freshness is met. Firmware in the metaField if they show what happens at a firmware change and accept it.

**Bottlenecks and failure modes.** High-cardinality values in the metaField (a bucket per reading); granularity too coarse or too fine for the interval; late readings landing in rollups that are never recomputed; TTL expiring buckets that late data was still extending; bad clocks writing readings that expire on arrival; "latest" overwritten by a late reading; queries by site scanning raw data.

**Incident guidance.**
- *Per-reading message id copied into the metaField*: contain by fixing the ingest mapping (meta is a fixed allowlist of fields) and, for the affected window, re-insert the readings into a corrected collection (or let the bad buckets expire if the window is short and the data is duplicated elsewhere). Guardrail: a schema contract on meta at ingest, and an alert on buckets per device per hour above the expected value.
- *Six days of buffered readings from one site*: accept them (they are within retention); mark the touched hours dirty and recompute hourly and daily rollups for that site; suppress alerts computed on readings older than the alert's own window, or evaluate alerts only on readings near real time. With {{late_share}} late on a normal day, the recompute must be routine, not exceptional. Guardrail: alerts keyed on arrival lag, and a rollup "last recomputed" timestamp shown on dashboards.
- *1970 clocks expired immediately with a calibration record*: quarantine readings with impossible timestamps before they reach the TTL collection; keep calibration records in their own regular collection, never in an expiring one. Guardrail: a lower bound on accepted timestamps (device activation date) and a counter of quarantined readings per firmware version.

**Follow-up guidance.** (1) Arithmetic from the instance; readings per bucket = span ÷ interval for one device. (2) Goes to (or creates) a bucket for that device and time; it costs an extra bucket write and may reduce compression; recompute the dirty hour and day. (3) Define "per site" as the site the device was in at reading time (join on the assignment's validity interval); recompute last month after the history is right. (4) Recompute rollups from dirty hours before raw data is deleted, with a margin; or apply late readings to rollups at ingest. (5) Shard on device id if writes need it; per-device queries targeted, site queries served by rollups.

**Rubric anchors.** 2: one document per reading in a regular collection, or everything (including site and firmware) in the metaField, no plan for late data. 3: correct metaField and granularity with an estimate, latest-reading collection, rollups with `$merge`, TTL retention. 4: also dirty-hour recomputation, time-varying device attributes handled by validity interval, bucket-level expiry semantics, bad-clock quarantine and a targeted shard key.

**Strong signals.** Computes the write rate and readings per bucket before naming settings. **Red flags.** Sequence numbers or request ids in the metaField; rollups computed once and never corrected; "late data is rare, ignore it".

## MDB-L3-03

**Reference architecture (one defensible design).**
- **Criteria first.** Cardinality (enough distinct values to split), frequency (no value that holds a large share), monotonicity (no "always the newest chunk"), and query targeting (the main queries carry the key's prefix).
- **Candidates for `activity`.**
  - `{tenant_id: 1}`: targeted by tenant, but the largest tenant ({{largest_tenant_share}} of the data) is one key value: its chunk cannot be split (jumbo), cannot be moved, and fills one shard.
  - `{tenant_id: 1, _id: 1}` with time-ordered ids: splittable, targeted; but each tenant's inserts go to the last chunk of its range, so the largest tenant's writes hit one shard (a hot chunk).
  - `{tenant_id: 1, project_id: 1, _id: 1}`: targeted for "latest activity in a project" (index scan in order); inserts for a large tenant spread across its projects' chunks, if projects are many and similar in size.
  - `{tenant_id: 1, _id: "hashed"}`: tenant-targeted, inserts for a tenant spread over its range; "latest in project" becomes a tenant-targeted query with a secondary index `{tenant_id, project_id, _id: -1}` on each shard holding the tenant.
  - `{_id: "hashed"}`: perfect spread, but every query without `_id` is scatter-gather, and residency zones become impossible because ranges no longer map to tenants.
  - Recommended: `{tenant_id, project_id, _id}` or `{tenant_id, hashed _id}`, with the trade-off stated.
- **Small collections.** `users` and `projects` may stay unsharded (or sharded on `tenant_id`) if they fit; sharding them adds routing cost without benefit.
- **Residency.** Prefix ranges per residency tenant: zone `eu` covers `[{tenant_id: T, …: MinKey}, {tenant_id: T, …: MaxKey})` for each EU tenant, or tenant ids allocated from region-specific ranges so one zone range covers a region. Non-residency tenants unconstrained.
- **Region change.** Plan: add the new zone range for the tenant (the old one removed in the same change), let the balancer move the chunks, monitor progress; the application keeps working because routing follows chunk ownership; the residency rule is met only when every chunk has moved, so the move starts early enough to finish before the deadline, off-peak, with migration throttling. For contractual strictness, copy-then-switch to a new tenant id range is an alternative.
- **Email lookup.** A small `user_directory {email, tenant_id, user_id}` collection (unsharded or sharded on email), then a targeted query.
- **Monitoring.** Data size and chunk count per shard, jumbo chunk count, share of queries that are scatter-gather, insert rate per shard, top tenants by data size and growth; thresholds for action: refine the key (add a suffix), reshard, or move a whale tenant to a dedicated cluster with application routing.

**Competing designs to accept.** Dedicated clusters for the largest tenants and a shared sharded cluster for the long tail. One collection per tenant (only for small tenant counts; at {{tenants}} it strains metadata). A region-first key `{region, tenant_id, …}` for residency, if they handle region changes as key changes (which are document rewrites).

**Bottlenecks and failure modes.** Jumbo chunks for large tenants, hot last chunks with monotonic suffixes, scatter-gather from hashed `_id`, zones defined on fields that are not a key prefix, region moves started too late or at peak, metadata growth from per-tenant collections.

**Incident guidance.**
- *Jumbo chunks for the largest tenant fill one shard*: contain by adding disk or moving other chunks off that shard; plan a key change: refine the shard key with a suffix so chunks can split, or reshard to a compound key, or move the tenant to a dedicated cluster. Guardrail: alert on jumbo chunks and on any single key value above a share of a shard's data.
- *Hot last chunk for the largest tenant*: a monotonic suffix within a tenant concentrates inserts. Switch to a hashed suffix or a project-based middle field (refine or reshard); short-term, pre-split and distribute that tenant's future range. Guardrail: per-shard insert rate in the dashboard, and a load test of the key with a production-shaped tenant distribution.
- *Region change during peak, documents in two regions*: pause the balancer for that collection outside a window or throttle migrations; schedule zone changes off-peak with a runbook; for strict residency, track the move as incomplete until every chunk is on the target zone, and inform the tenant of the window. Guardrail: zone changes only through a change process with a migration-time estimate, and a residency check that lists any chunk of a residency tenant outside its zone.

**Follow-up guidance.** (1) One key value: unsplittable, unmovable, one shard. (2) Project-prefixed key gives ordered reads per project; hashed suffix spreads inserts but needs a secondary index for ordered reads. (3) The zone runbook above. (4) A directory collection. (5) Signals: jumbo chunks, per-shard size skew, per-shard insert rate, scatter-gather share; decide by thresholds.

**Rubric anchors.** 2: picks hashed `_id` or `tenant_id` alone without seeing the consequences. 3: compares candidates on the four criteria, picks a compound tenant-prefixed key, explains jumbo and hot chunks, defines zones as key ranges. 4: also region-change runbook with residency during moves, email lookup without scatter-gather, monitoring with thresholds, and a reasoned choice between refine, reshard and dedicated clusters.

**Strong signals.** States the key criteria before candidates; asks for the tenant size distribution. **Red flags.** "Hashed keys solve everything"; ignoring residency during migrations; sharding every collection.

## MDB-L3-04

**Reference architecture (one defensible design).**
- **Version field.** `schema_version` (int) on every document, indexed. Step 0: a one-off classification job (shape detection) stamps a version on unversioned documents, with a report of documents it could not classify; after that, the version field is the only truth.
- **Application.** A reader per version that maps to the current in-memory model; writes always in the newest version (upgrade on write). Releases are forward compatible: the release before a new shape learns to read it and to preserve unknown fields (no full-document replace from a model that drops fields), so rolling back never loses data. Expand → migrate → contract: add the new field and read both, then backfill, then stop writing/reading the old field.
- **Backfill.** Iterate by `_id` range in batches (for example 500–1,000 documents) over `{schema_version: {$lt: N}}`, each document upgraded with a conditional update: `updateOne({_id, schema_version: v, updated_at: t}, {$set: {...new}, $unset: {...old}, $set: {schema_version: N}})`; if it matches nothing, a concurrent writer won: re-read and retry. Checkpoint the last `_id` processed for resumption. Throttle on replication lag (pause when lag on any secondary passes a budget well inside the oplog window), on primary write latency and on oplog churn per hour versus oplog size. Write concern `majority` per batch so the backfill cannot outrun replication.
- **Completion proof.** Count per `schema_version` (from the index) reaching zero for old versions; then tighten the `$jsonSchema` validator to the newest version and remove old readers.
- **Warehouse.** Change stream with `fullDocument: "updateLookup"` (or pre/post images where available), or periodic snapshots plus change events. A staging layer maps each version explicitly to one model: v1 dollars (decimal) → cents (`round(amount*100)`), v2 cents; v1 single address → list with one entry of type "primary"; unknown versions go to a quarantine table and fail the load. A reconciliation compares revenue totals by day across versions against the billing system.

**Competing designs to accept.** Migrate on read only (lazy), with a final backfill for the untouched tail. A copy-and-swap migration into a new collection with dual writes and a cut-over, if they handle reads during it and the cost at {{documents}}. A view per version in the warehouse instead of a staging model, if unknown versions still fail loudly.

**Bottlenecks and failure modes.** Shape detection used forever instead of a version field; unthrottled backfill causing lag and an oplog that rolls past a secondary; backfill overwriting concurrent updates; rollbacks that drop unknown fields; warehouse mapping keyed on a field both versions share; no proof that old versions are gone.

**Incident guidance.**
- *Unthrottled backfill, secondary fell off the oplog*: stop the backfill; resync the stale secondary (initial sync) and keep the set's write concern achievable meanwhile; resume the backfill with throttling on replication lag and a batch size that keeps oplog churn well inside the window, possibly with a temporarily larger oplog. Guardrail: the backfill tool refuses to run without a lag budget and pauses automatically; alert on lag approaching the oplog window.
- *Revenue 100 times too high after cents*: the mapping chose by a field both versions have, so cents were multiplied again. Fix the mapping to switch on `schema_version`; recompute affected days; reconcile with billing before publishing. With {{versions_live}} versions live, a test per version with a known document is required. Guardrail: daily reconciliation of revenue against the billing system, and load failure on unknown or ambiguous versions.
- *Rollback dropped new address fields*: restore the lost fields from the change stream history or backups for the affected documents; fix the old release to preserve unknown fields (partial `$set` updates instead of replacing the document). Guardrail: the expand-then-contract rule and a rollback test that runs the previous release against documents in the new shape before any release that changes the shape.

**Follow-up guidance.** (1) Untouched after D days ≈ (1 − {{daily_touched}})^D for uniform touches (real touches are skewed: many accounts are never written), so the backfill covers most documents at low touch rates. (2) Conditional update on version and `updated_at`; the plan change wins, the backfill retries on the new state. (3) Throttle on lag and latency; checkpoint by `_id`; prove by counts per version. (4) Forward-compatible release; partial updates preserve fields; the rollback is safe because the previous release already understood the shape. (5) Mapping keyed on version; reconciliation catches the jump.

**Rubric anchors.** 2: "just run an updateMany" or "the application handles all versions forever". 3: explicit version, upgrade on write plus a throttled resumable backfill, versioned warehouse mapping. 4: also conditional updates against concurrent writers, oplog-window reasoning, forward-compatible releases for rollback, completion proof and reconciliation.

**Strong signals.** Separates the read path, the write path and the backfill; asks how big the oplog is. **Red flags.** A single `updateMany` over billions of documents; full-document replace from a model that does not know new fields; analytics that guess versions.

## MDB-L3-05

**Reference solution** (PostgreSQL; `{{ns_raw}}`, `{{window_start}}`, `{{window_end}}`, `{{t1}}`, `{{t2}}`, `{{t3}}`, `{{tier_a}}` and `{{tier_b}}` come from the instance; at Medium the three thresholds are equal and the tiers are 0)

```sql reference
WITH ev AS (
  SELECT * FROM chunk_events WHERE ns = '{{ns_raw}}'
), hours AS (
  SELECT h AS hour_start, h + INTERVAL '1 hour' AS hour_end
  FROM generate_series(TIMESTAMPTZ '{{window_start}}',
                       TIMESTAMPTZ '{{window_end}}' - INTERVAL '1 hour',
                       INTERVAL '1 hour') AS g(h)
), born AS (                                   -- one row per chunk, however many rows created it
  SELECT chunk_id, MIN(occurred_at) AS born_at
  FROM ev
  WHERE kind IN ('create', 'split', 'merge')
  GROUP BY chunk_id
), retired AS (
  SELECT source_chunk_id AS chunk_id, MIN(occurred_at) AS retired_at
  FROM ev
  WHERE kind IN ('split', 'merge')
  GROUP BY source_chunk_id
), owner_change AS (                           -- move_start and move_abort never change the owner
  SELECT chunk_id, shard_id, occurred_at, event_id
  FROM ev
  WHERE kind IN ('create', 'split', 'merge', 'move_commit')
), layout AS (
  SELECT h.hour_start, b.chunk_id,
         (SELECT o.shard_id
            FROM owner_change o
           WHERE o.chunk_id = b.chunk_id AND o.occurred_at < h.hour_end
           ORDER BY o.occurred_at DESC, o.event_id DESC
           LIMIT 1) AS shard_id
  FROM hours h
  JOIN born b ON b.born_at < h.hour_end
  LEFT JOIN retired x ON x.chunk_id = b.chunk_id
  WHERE x.retired_at IS NULL OR x.retired_at >= h.hour_end
), per_shard AS (                              -- every active shard, empty ones with 0
  SELECT h.hour_start, s.shard_id, COUNT(l.chunk_id) AS chunks
  FROM hours h
  JOIN shards s ON s.added_at < h.hour_end
  LEFT JOIN layout l ON l.hour_start = h.hour_start AND l.shard_id = s.shard_id
  GROUP BY h.hour_start, s.shard_id
), per_hour AS (
  SELECT hour_start, COUNT(*) AS active_shards, SUM(chunks) AS total_chunks,
         MAX(chunks) AS max_chunks, MIN(chunks) AS min_chunks
  FROM per_shard
  GROUP BY hour_start
), top_shard AS (
  SELECT DISTINCT ON (hour_start) hour_start, shard_id
  FROM per_shard
  ORDER BY hour_start, chunks DESC, shard_id
)
SELECT p.hour_start, p.active_shards, p.total_chunks, p.max_chunks, p.min_chunks,
       p.max_chunks - p.min_chunks AS imbalance,
       t.shard_id AS most_loaded_shard,
       p.max_chunks - p.min_chunks >= CASE WHEN p.total_chunks < {{tier_a}} THEN {{t1}}
                                           WHEN p.total_chunks < {{tier_b}} THEN {{t2}}
                                           ELSE {{t3}} END AS needs_balancing
FROM per_hour p
JOIN top_shard t USING (hour_start)
ORDER BY p.hour_start;
```

**Explanation.** The report is a state reconstruction, not an aggregation of events: each hour needs the whole layout as it stood at the end of the hour, so the hours are generated first and quiet hours carry the layout forward. A chunk exists from its first creating row (create, split child, merge result) until the first row that names it as a source; its owner as of a time is the latest ownership row before that time, where only committed migrations move a chunk. Because a split row already carries the owning shard, nothing has to be inherited recursively. Counts start from the active shards (added strictly before the hour's end) and LEFT JOIN the layout, so an empty shard counts as 0; one `DISTINCT ON` row per hour applies the tie rule. Every boundary is strict: an event or shard addition at exactly hh:00:00 belongs to the hour that starts then.

**Complexity.** The correlated owner lookup runs once per (hour, live chunk) with an index on `(chunk_id, occurred_at)`; the cross product of hours and chunks is small here. At production scale, compute ownership intervals once — `LEAD(occurred_at) OVER (PARTITION BY chunk_id ORDER BY occurred_at, event_id)` over ownership rows, clipped by the retirement time — and join hours to intervals with `start < hour_end AND (end IS NULL OR end >= hour_end)`; or keep a daily snapshot of the layout and replay only the day's events.

**Dialect notes.** `generate_series` over timestamps and `DISTINCT ON` are PostgreSQL. Snowflake builds hours with `GENERATOR` / `ROW_NUMBER()` and `DATEADD`, BigQuery with `GENERATE_TIMESTAMP_ARRAY` and `UNNEST`, Spark SQL with `sequence(start, stop, INTERVAL 1 HOUR)` and `explode`. The tie rule becomes `QUALIFY ROW_NUMBER() OVER (PARTITION BY hour_start ORDER BY chunks DESC, shard_id) = 1` (Snowflake, BigQuery) or a row-number subquery (Spark, MySQL 8). Correlated `ORDER BY … LIMIT 1` subqueries are not supported in every engine (BigQuery and Spark restrict them); use the `LEAD` interval form there. MySQL 8 has no `generate_series`: a recursive CTE builds the hours. None of these variants is executed here.

**Edge cases built into the data.** A shard that is active but empty for the first hours (Medium: added before the window; Hard: added during it; Very Hard: added exactly on an hour boundary); a migration committed exactly on an hour boundary; an hour with no events at all; events after the window end; chunks split several times in a chain. Hard adds `move_start` and `move_abort` rows (including at least one abandoned migration in the window, whose destination never owns the chunk) and a second collection in the export. Very Hard adds merges (two or three rows for one new chunk, every source retired) and three-way splits. Ties for the most loaded shard occur often.

**Common mistakes.** Grouping events by `date_trunc('hour', occurred_at)` (counts changes, not the layout, and drops quiet hours); `<=` at the hour end; keeping split parents alive; an inner join that drops empty shards; (Hard+) taking the latest migration row of any kind as the owner, forgetting the `ns` filter, counting a shard before it was added; (Very Hard) counting merge rows instead of distinct chunks, or not retiring merge sources. Each has a diagnostic.

**Follow-up guidance.** (1) Ownership intervals with `LEAD`, retirement as an interval end, an interval join to hours; or daily snapshots plus replay. (2) Export a snapshot of the current chunk metadata (each chunk with its owner) on a schedule and replay only changelog rows after the snapshot; alert when the oldest changelog row is newer than the last snapshot. (3) Needs data size per chunk (from split and migration details, or periodic size statistics); a shard with few chunks can hold a jumbo chunk, so counts and sizes disagree. (4) Rank chunks per shard on the most loaded shards and take the excess over (min + threshold − 1); a window function over the latest hour's layout.

**Rubric anchors.** 2: groups events by hour or drops quiet hours; split parents still counted. 3: matches the expected result. 4: also explains interval-based scaling, the capped-changelog baseline, and why chunk counts differ from data balance.

**Strong signals.** Says "this is a state as of a time" and generates the hours first; asks what changes an owner. **Red flags.** `SELECT DISTINCT` to fix double counts without knowing why; treating `move_start` as ownership; an inner join from chunks to shards.
