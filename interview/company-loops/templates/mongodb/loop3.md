# MongoDB · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a document database
offered as software and as a cloud service. Every workload, number, schema, threshold
and incident is hypothetical. Where a product behaviour is used, it is this exercise's
rule; check current docs. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MDB-L3-01: A product catalogue as documents — embed or reference, variants, attributes and arrays that never stop growing

| | |
|---|---|
| **Template ID** | MDB-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Document modeling / embed versus reference, attribute pattern, bounded arrays, multikey indexes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "products": {"1": ["2 million"], "2": ["20 million", "40 million"], "3": ["150 million", "300 million"]},
  "max_variants": ["60", "400", "2,500"],
  "attribute_names": ["300", "4,000", "25,000"],
  "peak_reads": {"1": ["3,000"], "2": ["40,000"], "3": ["250,000", "600,000"]}
}
```

**Business Scenario.** An online retailer is moving its catalogue of about {{products}} products into a document database. A product has a title, brand, category path, images and descriptions in several languages, and variants (size, colour, material), each with its own SKU, price and stock; the largest products have up to {{max_variants}} variants. Categories carry very different attributes (a laptop has screen size and RAM, a shoe has width and heel height), and across the catalogue there are about {{attribute_names}} distinct attribute names, added by merchandisers every week. Customers write reviews and questions without limit. The storefront reads the catalogue at about {{peak_reads}} reads per second at peak, mostly product pages and filtered category listings ("waterproof hiking boots, size 44, under 120"). Stock changes every few seconds on popular items. Analysts want price history and the share of products missing key attributes per category.

**Problem Statement.** Design the collections and documents: what is embedded in a product document and what is referenced, how variants are stored, how the open-ended attributes are represented so that category filters can use indexes, where reviews and stock live, and how price changes keep their history. Give the indexes for the product page, the filtered listing and the merchandiser's "products missing attribute X" report. Say what you validate at write time, and how the catalogue reaches the analytics store.

**Constraints.** One document stays well below the document size limit (16 MB in this exercise; check current docs) for the largest product. A product page needs one read in the common case. A filter on any attribute name and value is served by an index, not a collection scan. A price shown on the product page must match the price charged at checkout. Stock updates on a popular item must not rewrite the whole product document.

**Assumptions.** Catalogue size, variant counts, attribute counts and read rates are hypothetical. Prices are integers in minor units with a currency. A merchandiser can add an attribute name without a deployment. Search ranking is out of scope; filtering and the product page are in scope.

**Clarifications.**
- Q: How many reviews does a popular product get? | A: Tens of thousands, and they keep coming. The product page shows a rating summary and the newest five.
- Q: Do variants share attributes? | A: Most attributes belong to the product; size, colour and material vary per variant, and a few categories have more variant-level attributes.
- Q: Can one attribute have values of different types? | A: Yes, merchandisers have entered "15" and 15 for the same attribute in different products. Say what you enforce.
- Q: How fresh must stock be on the product page? | A: Within a few seconds. "In stock" shown for an item that sold out a minute ago is a complaint.
- Q: Do analysts query the operational cluster? | A: Not for heavy work. They have a warehouse; say how data gets there.

**Hints.**
1. Embed what is read together and bounded in size; reference what grows without limit or changes at a different rate.
2. Open-ended attributes become an array of name/value pairs, and one compound index on the pair serves every attribute filter.
3. Look at which index fields are arrays. A compound index can have at most one field that is an array in any one document (this exercise's rule; check current docs).

**Follow-ups.**
1. Estimate the size of your largest product document with {{max_variants}} variants. At what point do you move variants out, and what does the product page read then?
2. Write the index and the query for "waterproof = true, size = 44, price below 120" when waterproof is a product attribute and size and price are per variant.
3. Stock changes every few seconds on popular items. Where does stock live, and how does the listing filter "in stock only" stay correct without hot updates on the product document?
4. A merchandiser renames attribute "colour" to "color" across 3 million products. How does that run, and what do filters return during it?
5. Prices change and the warehouse needs price history per SKU. Do you keep history in the operational document, in a separate collection, or only downstream from a change stream? Defend it at {{peak_reads}} reads per second.

**Follow-up rules.**
- when: embed reviews, reviews array, embedded reviews → ask: A product collects tens of thousands of reviews. What happens to the document, its size and every write to it after a year? Which reviews would you keep in the product, if any?
- when: attribute pattern, k and v, name/value, key-value → ask: Show the compound index on the pairs. How does it treat "15" and 15, and how do you filter on two attributes at once?
- when: wildcard index, wildcard → ask: When is a wildcard index the better choice than the attribute pattern, and what do you lose in a query that filters on two attributes?
- when: $lookup, lookup → ask: The product page is the hottest read. How many collections does it touch now, and what do you denormalise to make it one read?
- when: separate collection for variants, variants collection → ask: The product page now needs every variant. How many reads is that, and how do you keep the product's price range and "in stock" flag consistent with the variants?

**Production Reality Check.**
- A supplier feed creates a product with {{max_variants}} variants, each embedding images and translations; inserts start failing on the document size limit, and the import job retries forever, blocking the feed for every other supplier.
- After variant-level `size` and product-level `tags` were both stored as arrays, building a compound index on them fails, because some documents have both as arrays; the release that needed the index had already shipped.
- During a sale, one popular product's document is updated hundreds of times a second for stock; writes on it conflict and retry, and product page reads for it see latency spikes.

**Evaluation Criteria.** Embedding chosen by read pattern, size bound and change rate, with an estimate for the largest product; variants embedded with a stated cut-over, or referenced with a summary kept on the product; attributes as name/value pairs (or a wildcard index, with its limits stated) with one compound index; reviews and questions referenced, with a small embedded subset for the page; stock separated from slowly changing product data; price consistency with checkout; schema validation for types and required fields; price history and analytics through change streams or exports; each incident contained and guarded.

## MDB-L3-02: Time-series collections for device readings — metadata, granularity, buckets, late data and retention

| | |
|---|---|
| **Template ID** | MDB-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Time-series modeling / metaField, granularity and bucket sizing, late arrivals, downsampling, retention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer |

```params
{
  "devices": {"1": ["50,000"], "2": ["1 million", "3 million"], "3": ["20 million", "60 million"]},
  "interval": ["1 second", "10 seconds", "1 minute"],
  "retention_days": [30, 90, 400],
  "late_share": ["0.5%", "3%", "8%"]
}
```

**Business Scenario.** A company makes connected industrial sensors and stores their readings in time-series collections of a document database. About {{devices}} devices each send a reading every {{interval}}: a timestamp, the device id, a few measurements (temperature, vibration, power) and some metadata that rarely changes (site, device model, firmware version). Devices on poor networks buffer readings and upload them later; about {{late_share}} of readings arrive more than an hour after they were taken, some a few days late. Customers look at a device's last hour in a dashboard, compare sites over months, and receive alerts. Raw readings are kept for {{retention_days}} days; customers want trends for years.

**Problem Statement.** Design the storage: the time field, what goes into the metaField and what stays a measurement, the granularity or bucket settings for this reading rate, the secondary indexes, and how the collection is sharded if it needs to be. Then design the rest of the read path: the "latest reading per device" lookup, hourly and daily rollups, how late readings reach rollups that were already computed, and retention for raw data and for each rollup. Estimate readings per bucket and the write rate.

**Constraints.** The dashboard's last-hour query for one device returns in under 100 ms. Readings older than {{retention_days}} days are deleted automatically. A late reading is never dropped while it is younger than the retention period, and the rollups that cover it are corrected. Metadata changes (a device moved to another site) must not rewrite historical readings.

**Assumptions.** Device counts, rates, shares and the retention are hypothetical. In this exercise, a time-series collection groups readings into buckets by metaField value and time span, granularity or custom bucket settings bound a bucket's span, and expireAfterSeconds deletes whole buckets once all their readings are old enough (this exercise's rules; check current docs for the current behaviour and limits).

**Clarifications.**
- Q: Does the firmware version belong in the metaField? | A: Your call. It changes a few times a year per device; say what that does to the buckets.
- Q: Can a reading be corrected after it is written? | A: Rarely, by a calibration job. Say how, given that updates to time-series data are restricted in this exercise.
- Q: How late is too late? | A: A reading older than the retention period on arrival is dropped and counted. Anything younger must be stored.
- Q: Do customers query across devices? | A: Yes, by site and model: "average vibration per site per day for the last quarter".
- Q: Is the clock on the device trustworthy? | A: Mostly. Some devices reboot with a clock in 1970 until they sync; say what you do with those.

**Hints.**
1. The metaField decides which readings share a bucket. Put there what identifies the series and rarely changes; a value that differs per reading creates a bucket per reading.
2. Choose granularity from the interval: a bucket should hold many readings from one series, not one reading or a whole year.
3. The "latest reading" and long-term trends are different access patterns; serve them from their own small collections, kept up to date as readings arrive.

**Follow-ups.**
1. At {{devices}} devices every {{interval}}, how many readings a second do you insert, and roughly how many readings land in one bucket with your settings?
2. A reading arrives three days late. Which bucket does it go to, what does it cost, and how does the daily rollup for that day get corrected?
3. Devices move between sites. Your rollup per site per day was computed with the old site. What should "average per site" mean for last month, and how do you produce it?
4. Raw data expires after {{retention_days}} days. What prevents a rollup from losing late readings that arrive just before their raw data expires?
5. Would you shard this collection, and on what? Show what a site-wide query and the per-device dashboard each touch.

**Follow-up rules.**
- when: device_id in the metafield, metafield device, meta: device → ask: Firmware version is also in your metaField. What happens to the bucket for a device on the day its firmware changes, and to a query across firmware versions?
- when: reading_id, sequence number, request id → ask: If that identifier is in the metaField, how many readings share a bucket? What does that do to storage and compression?
- when: granularity seconds, granularity: seconds, bucketmaxspanseconds → ask: With readings every {{interval}}, how many readings fit in one bucket with that setting, and why does that number matter?
- when: ttl index, expireafterseconds, ttl → ask: Expiry removes a whole bucket only when its newest reading is old enough. How late can a reading be deleted, and does a late reading extend its bucket's life?
- when: $merge, materialized view, rollup → ask: The hourly rollup already ran when a late reading arrives. Which run picks it up, and how do you make re-running an hour idempotent?

**Production Reality Check.**
- A firmware release starts sending a per-reading message id inside the device metadata; the ingest service copies it into the metaField, every reading becomes its own bucket, and storage for those devices grows tens of times within a day.
- A cellular outage at a large site ends and its devices upload six days of buffered readings at once; with {{late_share}} of readings already late on a normal day, the hourly rollups for the past week are now wrong and an alert threshold fires on stale data.
- Devices that rebooted with their clock at 1970 wrote readings that are already older than {{retention_days}} days; they were expired almost immediately, and with them a calibration record the customer needed.

**Evaluation Criteria.** metaField limited to stable series identity, measurements as fields, granularity matched to {{interval}} with a readings-per-bucket estimate; indexes for per-device and per-site queries; a "latest reading" collection updated on write; rollups recomputed for the time ranges that late readings touch, idempotently; retention per tier with the expiry semantics of buckets explained; site and firmware handled as time-varying attributes; bad clocks quarantined; sharding justified by write rate with a key that keeps per-device queries targeted; each incident contained and guarded.

## MDB-L3-03: Shard key choice for a multi-tenant application — tenant prefixes, hashing, jumbo chunks and zones for residency

| | |
|---|---|
| **Template ID** | MDB-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Sharding design / shard key, targeted versus scatter-gather queries, jumbo chunks, zones for data residency |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "tenants": {"1": ["2,000"], "2": ["30,000"], "3": ["150,000", "400,000"]},
  "largest_tenant_share": ["3%", "12%", "30%"],
  "regions": [2, 3, 4],
  "writes_per_second": {"1": ["5,000"], "2": ["60,000"], "3": ["400,000"]}
}
```

**Business Scenario.** A business software company runs a multi-tenant application on a sharded document database. Each of its {{tenants}} customer tenants has users, projects and an activity feed; the `activity` collection takes about {{writes_per_second}} inserts a second and is read as "the latest activity in this project" and "all activity for this tenant last week". Tenants vary enormously: the largest holds about {{largest_tenant_share}} of all activity. Contracts require some tenants' data to stay in a chosen region; the cluster has shards in {{regions}} regions. Tenants occasionally move to another region, and large tenants occasionally ask for an export of everything.

**Problem Statement.** Choose the shard key for `activity` (and say whether `projects` and `users` need to be sharded at all). Compare at least three candidates — the tenant id alone, the tenant id plus a hashed or time-ordered suffix, and a hashed id — on write distribution, targeted reads, chunk splitting for the largest tenant, and data residency. Show how zones pin residency tenants to their region's shards, what happens when a tenant changes region, and what you monitor to know the key is still right a year from now.

**Constraints.** No single shard takes more than a fair share of inserts at peak. "Latest activity in a project" is a targeted query (one shard), not scatter-gather. A residency tenant's documents never sit on a shard outside its region, including during a move. The shard key cannot be changed casually: changing it means resharding the collection (this exercise's rule; check current docs).

**Assumptions.** Tenant counts, shares, regions and rates are hypothetical. Document `_id`s are time-ordered identifiers generated by the application. In this exercise the balancer moves chunks between shards, cannot split a chunk whose documents all share one shard key value (a jumbo chunk), and zones map shard key ranges to sets of shards (this exercise's rules; check current docs).

**Clarifications.**
- Q: Do queries always include the tenant id? | A: Every application query does. Internal support tools sometimes search by user email across tenants.
- Q: Can a tenant's region change? | A: Yes, a few times a month across all tenants, on request, with a deadline.
- Q: Is hashed `_id` alone acceptable? | A: It spreads writes perfectly. Tell me what it does to "latest activity in a project".
- Q: How big can one tenant's data get? | A: The largest is about {{largest_tenant_share}} of the collection and growing.
- Q: Are cross-tenant analytics run here? | A: No, they run on a warehouse copy. The cluster serves the application.

**Hints.**
1. A shard key should give enough distinct values, an even write spread and targeted reads for the main queries. A key whose leading field is the tenant gives targeting; a suffix gives the largest tenant room to split.
2. A monotonically increasing key sends every insert to the chunk holding the maximum; hashing that part spreads inserts, at the cost of range reads on it.
3. Zones work on ranges of the shard key, so a residency rule must be expressible as a key prefix: put what decides residency at the front of the key, or map tenants to ranges.

**Follow-ups.**
1. With {tenant_id} alone, what happens to the largest tenant's chunks, and to the shard that holds them?
2. Compare {tenant_id, project_id, _id} with {tenant_id, hashed _id} for "latest activity in this project" and for insert distribution.
3. A residency tenant moves from one region to another with a deadline in two weeks. Walk through the zone change, the data movement, and what the tenant's users see during it.
4. Support searches by user email across tenants. How do you serve that without scatter-gather on `activity` at {{writes_per_second}} inserts a second?
5. A year later, the largest tenant is twice its size and a quarter of all chunks are on one region's shards. What signals told you, and do you refine the key, reshard, or move the tenant to its own cluster?

**Follow-up rules.**
- when: hashed _id, hash of _id, hashed id → ask: Every query now goes to every shard unless it carries the exact _id. What does "latest activity in a project" cost at your shard count?
- when: tenant_id only, shard on tenant, {tenant_id} → ask: The largest tenant holds {{largest_tenant_share}} of the data, all with one key value. Can its chunks split, and where do its writes go?
- when: timestamp, created_at, objectid, monotonic → ask: A time-ordered suffix keeps new documents together. Which chunk gets every new insert for the largest tenant, and how does that shard cope?
- when: zone, zones, residency → ask: Zones map key ranges to shards. What exactly is the range for one residency tenant, and what happens to its documents while the zone is being changed?
- when: separate cluster, dedicated cluster → ask: Which tenants get their own cluster, decided by what rule, and what does that do to the application's routing and to cross-tenant support tools?

**Production Reality Check.**
- With the key on the tenant id alone, the largest tenant (about {{largest_tenant_share}} of the data) ends up in chunks that cannot be split; the balancer cannot move them, and one shard runs out of disk while the others have plenty.
- A key of {tenant_id, _id} with time-ordered ids sends every new activity of the largest tenant to the last chunk of its range; at peak that shard's write latency climbs while the rest of the cluster is idle.
- A residency tenant's region change is applied by editing the zone ranges during peak hours; migrations of its chunks compete with application writes, and for a while the tenant's documents exist in two regions at once.

**Evaluation Criteria.** Explicit criteria for a shard key (cardinality, frequency, monotonicity, targeting) applied to each candidate; a tenant-prefixed compound key with a suffix that splits large tenants, or a hashed design with its read cost stated; jumbo chunks and hot chunks explained; unsharded small collections where appropriate; zones expressed as key ranges with a region-change runbook; email lookup through a small index collection; monitoring of chunk and data distribution, scatter-gather share and per-shard write load; refine, reshard or dedicated cluster chosen by stated thresholds; each incident contained and guarded.

## MDB-L3-04: Documents at several schema versions — migrate on read, backfill in place, and analytics over mixed versions

| | |
|---|---|
| **Template ID** | MDB-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Schema evolution / schema version field, lazy and background migration, throttled backfills, versioned analytics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "documents": {"1": ["40 million"], "2": ["600 million"], "3": ["5 billion", "12 billion"]},
  "versions_live": [2, 3, 4],
  "daily_touched": ["1%", "8%", "25%"],
  "backfill_days": [7, 30]
}
```

**Business Scenario.** A subscription business keeps its `accounts` collection in a document database: about {{documents}} documents, each holding a customer's profile, plan, billing settings and addresses. Over the years the shape changed several times: prices moved from a decimal amount in dollars to integer cents with a currency, a single address became a list of addresses with types, and plan fields moved into a nested document. Today {{versions_live}} versions of the document live side by side, because older ones were never rewritten. About {{daily_touched}} of documents are written on a normal day. A change stream feeds the warehouse, where analysts compute revenue and plan mix. The team wants to stop carrying old versions in application code within {{backfill_days}} days.

**Problem Statement.** Design schema versioning for this collection: how a document records its version, how the application reads and writes every live version, and how old documents are upgraded — on read, on write, by a background backfill, or a combination. Design the backfill so it does not hurt the production workload or replication. Then design the analytics side: how the warehouse turns mixed versions into one model, how it learns that a new version exists, and how a release that needs to be rolled back is made safe for documents already written in the new shape.

**Constraints.** No document is lost or silently truncated by an upgrade. The application can be rolled back one release at any time. The backfill keeps replication lag on secondaries under a stated budget and never makes a secondary fall off the end of the oplog (a capped log of a fixed size in this exercise; check current docs). Revenue in the warehouse is correct for every day, whichever version the documents were in.

**Assumptions.** Document counts, versions, touch rates and the deadline are hypothetical. Each document has an immutable `_id`. In this exercise, a change stream delivers every insert, update and replace with a resume token, and an update to one field is delivered as an update description unless the full document is requested (this exercise's rules; check current docs).

**Clarifications.**
- Q: Is there a version field today? | A: Only on the newest version. Older documents must be recognised by their shape; say how reliably.
- Q: Can the backfill run at full speed at night? | A: Traffic is global, so there is no quiet night. Say what you throttle on.
- Q: Does the warehouse see full documents? | A: It sees change events; ask for what you need and say what it costs.
- Q: What happens if two writers update a document while it is being upgraded? | A: That is your problem to prevent: the upgrade must not overwrite a concurrent change.
- Q: How do we know when old versions are gone? | A: Your design should be able to prove it.

**Hints.**
1. Make the version explicit and indexed. Detect shapes once, write the version number, and never rely on detection afterwards.
2. Upgrade on write is free for touched documents; the backfill is only for the untouched tail. Make each upgrade a conditional update on the version it read, so a concurrent writer wins and the backfill retries.
3. In the warehouse, normalise every version into one model with an explicit mapping per version, and fail loudly on an unknown version instead of guessing.

**Follow-ups.**
1. With {{daily_touched}} of documents written a day, how many remain at old versions after {{backfill_days}} days without a backfill? What does that say about the backfill's size?
2. Write the upgrade of one document from dollars to cents as a conditional update. What happens if the customer changes plan at the same moment?
3. The backfill runs in batches. What do you throttle on, how do you resume after a crash, and how do you prove at the end that no old version remains?
4. A release that writes a new version is rolled back after two hours. What does the previous release do with documents in the new shape, and how do you avoid losing their new fields?
5. Analysts report revenue doubled on one day. Walk through how mixed versions in the change stream could cause that, and the guard that would have caught it.

**Follow-up rules.**
- when: migrate on read, lazy migration, upgrade on read → ask: Reads now write. What does that do to read latency, to secondaries serving reads, and to documents that are never read?
- when: backfill, batch job, updatemany → ask: How big is each batch, what do you throttle on, and what happens to replication lag and the oplog window while it runs?
- when: $jsonschema, schema validation, validator → ask: With {{versions_live}} versions live, what does your validator accept today, and when do you tighten it to the newest version only?
- when: change stream, fulldocument, full document → ask: An update event carries only the changed fields. How does the warehouse know which version the document is in, and what does requesting the full document cost?
- when: rollback, roll back → ask: The old release reads a document in the new shape and writes it back. Which fields survive, and how do you design the release so that this is safe?

**Production Reality Check.**
- An unthrottled backfill rewrites documents as fast as the primary allows; replication lag on one secondary grows past the oplog window, the secondary stops replicating and needs a full resync, and the replica set runs for a day with less redundancy.
- After the move from dollars to cents, the warehouse's revenue for one day is 100 times too high for part of the accounts: the mapping was keyed on a field that both versions have, and {{versions_live}} versions were live that day.
- A release writing a new address shape is rolled back; the previous release reads those documents, does not recognise the new field and writes the documents back without it, and customers' new addresses disappear.

**Evaluation Criteria.** An explicit, indexed schema version; read and write paths that handle every live version; upgrade on write plus a resumable, throttled backfill with conditional updates; lag and oplog-window guardrails; a proof of completion (count by version reaching zero); forward-compatible releases (preserve unknown fields, expand then contract) so rollback is safe; a versioned mapping into one warehouse model with unknown versions rejected; reconciliation of totals across versions; each incident contained and guarded.

## MDB-L3-05: Chunk ownership by hour — reconstructing a sharded collection's layout from split and migration events

| | |
|---|---|
| **Template ID** | MDB-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / state reconstruction from an event log, hours with no events, empty shards, boundaries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | MDB-L3-05.mjs |

**Business Scenario.** A sharded cluster spreads the collection {{ns}} across shards in chunks: contiguous ranges of the shard key. A chunk that grows is split into smaller chunks, and the balancer migrates chunks between shards to even them out. Every split and migration is written to a changelog, which is exported to the warehouse as `chunk_events`; the cluster's shards ({{shard_list}}) are listed in `shards` with the time each was added. {{late_note}} The platform team wants to see, hour by hour, how the chunks of {{ns}} were spread and whether the spread crossed the exercise's balancing threshold.

**Problem Statement.** Write one PostgreSQL query that returns one row for every hour from `{{window_start}}` up to, but not including, `{{window_end}}` ({{hours}} rows, ordered by `hour_start`), describing the layout at the end of that hour: `hour_start, active_shards, total_chunks, max_chunks, min_chunks, imbalance, most_loaded_shard, needs_balancing`. The layout at the end of an hour applies every event with `occurred_at` strictly before the next hour starts; an event exactly on the boundary belongs to the next hour. {{kinds_rule}} A chunk exists from the event that creates it until a later event names it as `source_chunk_id`; its owner is the `shard_id` of its latest `create`, `split`, `merge` or `move_commit` event. Active shards are those with `added_at` strictly before the end of the hour, and an active shard with no chunks counts with 0. `total_chunks` counts each chunk of the collection once; `max_chunks` and `min_chunks` are over the active shards; `imbalance` is `max_chunks − min_chunks`; `most_loaded_shard` is the active shard with the most chunks, ties going to the smallest `shard_id`. {{threshold_rule}} {{ns_rule}}

**Constraints.** One SQL statement (CTEs allowed). Every hour of the window appears, including hours in which nothing happened. The sample has {{events}} event rows; production keeps months of changelog for thousands of collections.

**Assumptions.** Hypothetical schema, shard names, collections and times. The threshold rule is this exercise's own: this exercise measures balance in chunk counts, as older balancer versions did, while current versions balance by data size (check current docs). A split's `shard_id` is the shard that owned the chunk when it was split, so no ownership has to be inherited recursively.

**Clarifications.**
- Q: Does a migration committed at exactly 10:00:00 count in the 09:00 hour? | A: No. The 09:00 row shows the layout just before 10:00:00; that migration first appears in the 10:00 row.
- Q: Does a shard with no chunks count in min_chunks? | A: Yes, once it has been added. A new shard at 0 chunks is exactly what the team wants to see.
- Q: What owns a chunk that was created by a split? | A: The `shard_id` on the split row, until a committed migration moves it.
- Q: Do I need the chunk key ranges? | A: No. Ownership and existence are enough for this report.
- Q: What if an hour has no events at all? | A: It still gets a row; the layout carries over from the previous hour.

**Hints.**
1. Build the hours first (`generate_series`), then compute each chunk's state as of each hour's end. A cross join of hours and chunks is small here.
2. For each chunk: when it was created, when (if ever) it was split or merged away, and its owner as of a time — the latest ownership event before that time.
3. Count per active shard with a LEFT JOIN from shards, so empty shards stay in, then aggregate per hour. `DISTINCT ON` picks one shard per hour for the tie rule.

**Follow-ups.**
1. At months of changelog for thousands of collections, a cross join of hours and chunks gets expensive. How would you compute ownership intervals once (with `LEAD`) and join hours to intervals instead?
2. The changelog is capped and its oldest events have rolled off. How do you get a starting layout so that the reconstruction still works?
3. Change `imbalance` to data size per shard instead of chunk counts. What would you need in the changelog, and why can a shard with fewer chunks still be the fullest?
4. Write the follow-on query that lists, for the latest hour, the chunks that would have to move to bring every shard within the threshold.

**Follow-up rules.**
- when: date_trunc, group by hour → ask: Grouping events by the hour they happened in counts what changed in that hour. The report needs the whole layout at the end of each hour, including quiet hours. How do you carry state forward?
- when: inner join → ask: Which shard disappears from your counts when it has no chunks yet, and what does that do to min_chunks for a shard that was just added?
- when: count(*), count(chunk_id) → ask: How many rows does one merge write for its new chunk? Is your count of chunks or of rows?
- when: move_start, move_abort → ask: The latest migration row for a chunk is an abort. Who owns the chunk now?
- when: lead, lag → ask: Your interval for an ownership ends at the next event. Is that end inclusive or exclusive, and which hour does an event at exactly hh:00:00 land in?
- when: recursive → ask: Does any owner here have to be inherited from a parent chunk? Look at what the split row already tells you.

**Production Reality Check.**
- The changelog is a capped collection in this exercise (check current docs); on a day of heavy splitting the oldest `create` and `split` rows for {{ns}} rolled off before the export ran, and the reconstruction found migrations of chunks it had never seen created.
- A dashboard built on this query paged on-call every hour after a new shard was added, because `min_chunks` stayed at 0 while the balancer was still filling it; nobody had decided whether a shard that is filling counts towards the alert.
- During a config server failover, a migration's `move_start` was exported but its outcome row arrived an hour later; a version of this report that took the latest migration row as the owner showed the chunk on its destination shard, and an operator drained the wrong shard.

**Evaluation Criteria.** Hours generated rather than taken from events; chunk existence from creating and source events, with split and merge sources retired; owner from create, split, merge and committed migrations only; strict boundary at the hour's end; empty active shards counted through a LEFT JOIN, and shards counted only once added; at Hard and above, only the named collection and only committed migrations; at Very Hard, a merged chunk counted once; deterministic tie rule and threshold; can explain interval-based scaling, a baseline snapshot for a capped changelog, and data-size balance.
