# Snowflake · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a cloud data
platform (virtual warehouses, storage, data sharing, a data marketplace and
ingestion). Every workload, number and schema is hypothetical, and nothing here
describes how any company's systems are actually built. Where a public product
rule is used, it is this exercise's rule; check current docs.

## SNO-L4-01: Secure data sharing across accounts and regions

| | |
|---|---|
| **Template ID** | SNO-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant data sharing / grants, entitlements, cross-region replication, revocation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "consumers": {"2": ["400", "1,500"], "3": ["9,000", "30,000"]},
  "regions": {"2": [3, 5], "3": [10, 16]},
  "refresh": ["10 minutes", "30 minutes", "1 hour"],
  "shared_tb": ["60 TB", "250 TB", "900 TB"]
}
```

**Business Scenario.** A cloud data platform lets a provider account give other accounts live, read-only access to some of its databases without copying them: within one region, a share is a set of grants on the provider's stored data, and consumers query it with their own compute and pay for that compute. A data provider sells {{shared_tb}} of market and reference data to {{consumers}} consumer accounts in {{regions}} regions across more than one cloud. Some consumers are entitled to every row; others only to some markets or tiers. Consumers in other regions must see the provider's updates within {{refresh}}. When a contract ends, access must stop everywhere.

**Problem Statement.** Design the sharing capability as the provider experiences it: the grant model (what a share contains and who may use it), how per-consumer row entitlements are enforced, how data reaches consumers in other regions, how revocation works in every region, and the audit trail of who could read what and who did. Say what is copied, where, and who pays for it.

**Constraints.** No copy of the data within a region. Remote regions see updates within {{refresh}}. Revocation takes effect within one minute in every region, including regions served from a replica. The provider never sees consumers' query text. A consumer can never see another consumer's rows, the provider's unshared objects, or the definition of the views that filter its rows. Every grant change and every access is auditable for two years.

**Assumptions.** All volumes, counts and timings are hypothetical. This exercise's rule: data does not cross regions at query time; to serve a consumer in another region, the provider replicates the shared database into an account it owns in that region and shares it from there (check current docs). The platform's storage is immutable files; any change writes new files.

**Clarifications.**
- Q: Can a consumer in another region query the provider's primary region directly? | A: Not in this exercise; data is replicated into the consumer's region first, and the transfer is the provider's cost.
- Q: Who pays for what? | A: Consumers pay for their query compute; the provider pays for storage, replication compute and data transfer.
- Q: What happens to a query that is running when access is revoked? | A: Your call; say what you choose and why.
- Q: Are entitlements per table or per row? | A: Both: some consumers get whole tables, others a subset of rows by market and tier, and the subset changes when a contract is amended.
- Q: Can consumers copy shared data into their own tables? | A: Yes, once they can read it. Revocation cannot claw copies back; contracts cover that.

**Hints.**
1. Separate the control plane (who may read what, decided centrally and checked at query time) from the data plane (where the bytes live). Revocation belongs to the control plane.
2. Per-consumer row subsets are easier to run as one secure view joined to an entitlement table keyed by the querying account than as hundreds of separate shares.
3. Replication ships changed immutable files. Estimate a day's changed bytes, not the size of the whole database, and ask what makes that number jump.

**Follow-ups.**
1. Walk through what happens, end to end, the first time a consumer in a remote region queries a table the provider added to the share an hour ago.
2. A contract ends at midnight. What exactly stops working, where, and how quickly, in the primary region and in each of the {{regions}} regions?
3. How do you enforce row entitlements so a consumer can neither see other consumers' rows nor learn the filter from the view?
4. Replicating {{shared_tb}} to {{regions}} regions is the provider's largest bill. How do you cut it without breaking the {{refresh}} promise?
5. An auditor asks which consumer accounts could read one table on one day last year, and which actually did. How do you answer, and how do you prove it?

**Follow-up rules.**
- when: export, extract, per-consumer copy, data dump → ask: You send some consumers an extract. Who owns that copy, how fresh is it, and what does a revocation do to it?
- when: replication, replicate, replica → ask: A revocation is made in the primary region one minute after the last replication refresh. What does the consumer in a replica region see until the next refresh?
- when: secure view, row access policy, row filter, entitlement → ask: Your entitlement table is keyed by the consumer's account name, and the consumer's account is renamed in a migration. What does that consumer see, and what would a new account with the old name see?
- when: audit, access history, access log → ask: The provider asks for the text of the queries a consumer ran against their data. What do you give them, and why?
- when: cache, cached → ask: A consumer's dashboard is answered from a cached result after its access was revoked. Is that a breach in your design?

**Production Reality Check.**
- A contract ends and the provider removes the consumer from the share. In the primary region the consumer's queries fail within seconds, but in one of the {{regions}} regions the consumer keeps reading for up to {{refresh}}, because the replicated database carried the grants with the data and the removal only arrived with the next refresh.
- The provider re-clusters its largest table, rewriting every file. The next replication refresh tries to send most of the {{shared_tb}} to every region; refreshes overrun {{refresh}} for two days and the week's data transfer bill triples.
- The entitlement table behind a secure view is keyed by consumer account name. After one consumer's account is renamed in an organisation migration, the consumer sees an empty table for a day and opens a support case; nobody had noticed that a new account created with the old name would have matched its rows.

**Evaluation Criteria.** Separates control plane (grants and entitlements checked at query time, revocation propagated independently of data refresh) from data plane (no in-region copies, replication of changed files to provider-owned accounts in remote regions); row entitlements through a secure view and an entitlement table keyed by an immutable account identifier, with the view definition hidden; a cost model for replication based on changed bytes, with a plan for rewrite-heavy operations; precise revocation semantics including running queries, caches and replicas; an audit trail of grant changes and object-level access without consumer query text; adapts to each incident with diagnosis, recovery and prevention.

## SNO-L4-02: Micro-partition metadata, pruning statistics and automatic reclustering

| | |
|---|---|
| **Template ID** | SNO-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Query execution / file statistics, partition pruning, clustering depth, background reclustering |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "table_size": {"2": ["50 TB", "200 TB"], "3": ["1 PB", "3 PB"]},
  "ingest": ["2 GB a minute", "10 GB a minute", "40 GB a minute"],
  "filter_col": ["event_time", "customer_id", "order_date"],
  "recluster_budget": ["5%", "10%", "20%"]
}
```

**Business Scenario.** An analytical engine stores every table as immutable columnar files, called micro-partitions here, each holding tens to a few hundred megabytes of rows; any insert, update or delete writes new files and retires old ones. Before a query runs, the compiler decides which files to read from statistics kept for every file and column. One tenant's largest table is {{table_size}}, grows by {{ingest}}, and most of its queries filter on {{filter_col}}, usually for a narrow range. The tenant may declare a clustering key; without one, files are in load order.

**Problem Statement.** Design the metadata layer: which statistics are captured per file and column, how they are written with each commit, where they are stored and how the compiler reads them at this scale, the pruning rules (which predicates can use which statistics), a clustering-quality metric (overlap and depth), and an automatic reclustering service that keeps pruning effective while spending no more than {{recluster_budget}} of the tenant's query compute.

**Constraints.** Pruning must never skip a file that holds a matching row: reading too many files is acceptable, missing a row is not. Metadata time at compile is under 500 ms at p95 even for a table with tens of millions of files. Statistics are committed atomically with the files they describe. Reclustering never blocks loads or queries, and its compute appears on the tenant's bill.

**Assumptions.** All sizes, rates and budgets are hypothetical. This exercise's rule: a micro-partition holds 50 to 500 MB of uncompressed data (check current docs). The metadata store is a separate service from file storage and can be scaled independently.

**Clarifications.**
- Q: Which statistics exist per column? | A: You choose. At least minimum, maximum and null count; say what else earns its space.
- Q: How are long strings handled? | A: Long strings are common (URLs, paths, JSON keys). You decide how much of each value the statistics keep, and must keep pruning correct.
- Q: Do queries filter with expressions, such as a cast to date or LIKE 'abc%'? | A: Yes, often. Say which predicates can use the statistics and which cannot.
- Q: Are loads ordered by the filter column? | A: Usually close to it, but some loading tools write in arbitrary order.
- Q: Can reclustering run while loads continue? | A: It must. A load and a recluster may touch the same files.

**Hints.**
1. Pruning is a containment test: a file can be skipped only if its [min, max] for the column cannot contain any value the predicate accepts. Work out what that requires for truncated strings and for NULLs.
2. Clustering depth: for a point in the key's range, how many files overlap it. Its average over the range tells you how much a narrow filter has to read.
3. Reclustering rewrites files, and everything that keeps files (time travel history, replicas, caches) pays for each rewrite. Spend the budget where benefit per byte rewritten is highest.

**Follow-ups.**
1. A query filters {{filter_col}} to one day. Walk through how the compiler goes from the predicate to a list of files, and how many metadata rows it touches.
2. Statistics truncate strings to save space. How do you store minimum and maximum so pruning stays correct?
3. Define clustering depth precisely, and say how you maintain it incrementally as {{ingest}} of new files arrives.
4. Which files does the reclustering service choose each cycle, and how do you show the tenant it was worth {{recluster_budget}} of their compute?
5. The table is joined to a small dimension filtered on one region. How could pruning use the join, not only literal predicates?

**Follow-up rules.**
- when: index, b-tree, btree, secondary index → ask: Files are immutable and written by the thousand every minute. What does maintaining that index cost per load, and what does it buy over per-file minimum and maximum?
- when: bloom filter, bloom → ask: How large is each file's filter at this column's cardinality, and for which predicates does it help where minimum and maximum do not?
- when: truncate, prefix, truncation → ask: A file's largest URL shares its first 32 bytes with the value in the predicate. Show me the stored maximum and why that file is not wrongly skipped.
- when: sort, sorted, order by → ask: Loads arrive every minute. Do you re-sort the whole table? If not, what bounds the overlap between new files and old ones?
- when: cache, cached, in memory, in-memory → ask: The table has tens of millions of files and one column's statistics do not fit in one compiler's memory. What do you load, and when?

**Production Reality Check.**
- A tenant switches to a loading tool that writes rows in arbitrary order of {{filter_col}}. Within a week nearly every new file spans most of the column's range, pruning for one-day queries falls from 99% of files skipped to 3%, and their warehouses run ten times longer.
- A release truncates string statistics to 16 bytes and stores the truncated value as the maximum. Queries that filter on long string keys silently miss rows from some files; a customer's reconciliation finds 0.2% of rows missing before anyone suspects the engine.
- With a steady trickle of {{ingest}}, the reclustering service rewrites the same recent range over and over. It spends three times its {{recluster_budget}} budget, depth barely improves, and time-travel storage grows with every rewrite.

**Evaluation Criteria.** Per-file, per-column statistics (minimum, maximum, null count, optionally distinct estimates) committed atomically with the files; a metadata store organised so compile reads only the columns and ranges it needs (sorted or interval-indexed by the clustering key, tiered caching); conservative pruning rules that are provably correct for truncated strings, NULLs and expressions; a precise clustering depth or overlap metric maintained incrementally; a reclustering service with a cost model, a budget, and policies for hot recent ranges; awareness of rewrite costs on history and replicas; adapts to each incident with diagnosis, recovery and prevention.

## SNO-L4-03: Query result cache and materialised-view freshness service

| | |
|---|---|
| **Template ID** | SNO-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Query serving / result caching, cache keys and invalidation, incremental view maintenance |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "dashboards": {"2": ["2,000", "8,000"], "3": ["40,000", "120,000"]},
  "qps": {"2": ["150", "600"], "3": ["4,000", "12,000"]},
  "load_interval": ["minute", "5 minutes", "hour"],
  "staleness": ["always current, with no staleness", "at most 5 minutes stale", "at most 15 minutes stale"]
}
```

**Business Scenario.** Business intelligence dashboards across many tenants of a cloud data platform send the same aggregate queries again and again: {{dashboards}} dashboards produce {{qps}} queries per second at peak, and most are identical to a query that ran minutes earlier. Base tables receive loads every {{load_interval}}. Tenants also define materialised views over their largest tables, maintained in the background at their cost, and expect queries on the base table to be answered from a view when that is faster. A view-answered result must be {{staleness}}.

**Problem Statement.** Design two things that work together. First, a query result cache that returns a stored result without running the query, whenever that result is still exactly what the query would return now for this user. Second, a freshness service for materialised views: how views are kept current, how a query against a base table is rewritten to use a view, and how the engine decides per query whether the view is fresh enough. Cover keys, invalidation, security, storage limits and cost.

**Constraints.** A cached result must never reach a user who could not see exactly that result now (privileges, row access policies, masking policies). Results from the cache must equal a fresh execution; queries with non-deterministic functions are never served from it. View-answered results must be {{staleness}}. Cache storage is bounded per tenant, and one tenant's results are never visible to another.

**Assumptions.** All volumes and rates are hypothetical. This exercise's rule: a stored result is kept for 24 hours after its last use, each reuse extends that, up to 31 days after the first run (check current docs). Every commit to a table produces a new table version.

**Clarifications.**
- Q: Must the query text match exactly? | A: You decide how much normalisation to do; say what could go wrong with each step.
- Q: Are queries using the current timestamp or random sampling cacheable? | A: Say which functions make a query uncacheable and how the engine detects them.
- Q: Can two users share one cached result? | A: Only when both may see exactly that result. You define what that takes.
- Q: Do session settings such as time zone vary? | A: Yes, per session, and some change query results.
- Q: Who pays for view maintenance? | A: The tenant, as background compute shown separately on the bill.

**Hints.**
1. A cache key is everything the result depends on: the normalised query, the version of every table read, the effective security policies, and the session settings that change semantics.
2. If every commit makes a new table version, a cached entry is valid exactly while the versions it read are still current; no invalidation messages are needed.
3. A view can answer an "always current" query by combining the view with the base table's changes since its last refresh, when the aggregate allows it.

**Follow-ups.**
1. Two analysts with different roles run the same dashboard query. Walk through the cache lookup for each.
2. Base tables change every {{load_interval}}. What hit rate do you expect, and what could product or engine change to raise it?
3. How does the freshness service decide when to refresh a view, and what happens to a query that arrives when the view is behind?
4. Which aggregates can be maintained incrementally and which force a recompute? Treat COUNT(DISTINCT), MIN and MAX, and deletes.
5. How do you show a tenant that the cache and their views save more compute than the views cost?

**Follow-up rules.**
- when: hash, query hash, normalize, normalise → ask: Two queries differ only in a comment, or in the case of a string literal. Which normalisations are safe, and which change the result?
- when: ttl, expire, expiration → ask: A load lands one second after a result is cached with a 10-minute expiry. What does the next user get?
- when: invalidate, invalidation → ask: The table is shared from another account, and the provider changes it there. How does the consumer's cache learn about it?
- when: role, privilege, permission → ask: A masking policy on an email column changes, but no table data changes. Does your cache key notice?
- when: incremental, delta → ask: A delete removes rows from the base table. How does the view's MAX(amount) per day stay correct?

**Production Reality Check.**
- A row access policy is tightened for one region's analysts. For the next several hours some of them still see rows they may no longer read, served from results cached before the change; the policy's version was not part of the cache key.
- Analysts in a time zone ahead of UTC see yesterday's totals on a dashboard at 00:30 local time: the cache key ignored the session time zone and served a result that a user in another zone had computed with a different "today".
- A bulk correction updates 30% of a large base table. Its view falls behind, every dashboard query that used the view now runs on the base table at {{qps}} queries per second, and the warehouse queue grows for an hour.

**Evaluation Criteria.** A cache key that includes normalised text, table versions, effective security policy versions and semantic session settings; detection of non-deterministic functions; version-based validity instead of timed expiry; tenant isolation and bounded storage with an eviction policy; incremental view maintenance with clear rules for which aggregates allow it and how deletes are handled; a per-query decision to use the view, the view plus base deltas, or the base table, honouring the staleness bound; cost accounting that compares maintenance with savings; adapts to each incident with diagnosis, recovery and prevention.

## SNO-L4-04: Time travel and fail-safe retention architecture

| | |
|---|---|
| **Template ID** | SNO-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage lifecycle / table versions, undrop and clones, garbage collection, retention cost |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "retention_days": [1, 7, 30, 90],
  "tables": {"2": ["50,000", "200,000"], "3": ["2 million", "8 million"]},
  "storage": {"2": ["400 TB", "1.5 PB"], "3": ["12 PB", "40 PB"]},
  "churn": ["a fifth", "half", "all"]
}
```

**Business Scenario.** A cloud data platform stores every table as immutable files and a sequence of table versions. Users can query a table as it was at an earlier time or before a given statement, restore dropped tables, schemas and databases with UNDROP, and clone a table, schema or database at a point in time without copying files. Time-travel retention is set per object, here {{retention_days}} days. After it ends, data passes into a fail-safe period that users cannot query and only the platform's operators can recover from. One customer account holds {{tables}} tables and {{storage}} of active data; on a typical day {{churn}} of the rows in its busiest tables are rewritten by updates, deletes, or truncate-and-reload jobs.

**Problem Statement.** Design the retention architecture: table-version metadata, how a time-travel query resolves a timestamp or statement to files, how UNDROP and clones work, garbage collection that deletes a file only when nothing can need it again, storage accounting per table per day split into active, time-travel and fail-safe bytes, and how the customer sees and controls the cost.

**Constraints.** A file is deleted only when no version inside any retention or fail-safe window and no clone references it. Garbage collection is safe under concurrent commits, clones and crashes. Time travel adds little compile overhead. Retention changes take effect predictably and are explained to the customer. The storage report is available per table per day.

**Assumptions.** All sizes and counts are hypothetical. This exercise's rules: time-travel retention can be 0 to 90 days depending on the object and the account's edition, and fail-safe is 7 days after retention for permanent tables, with none for transient and temporary tables (check current docs).

**Clarifications.**
- Q: What happens to history when retention is shortened? | A: You decide whether it is deleted now or ages out; say what the customer is told.
- Q: Does a clone copy files? | A: No. A clone references the source's files, and the two diverge as either changes.
- Q: Can a user drop a table, create a new one with the same name, then UNDROP the old one? | A: Users will try; say what happens.
- Q: Who pays for fail-safe bytes? | A: The customer; they appear on the bill as fail-safe storage.
- Q: Are row deletes physically applied? | A: Files are immutable. A delete writes new files without the rows and retires the old ones.

**Hints.**
1. A table version is a list of files and a commit time; time travel is a lookup of the newest version at or before the requested point.
2. A file lives from the version that adds it until the version that retires it, plus retention, plus fail-safe, but clones can extend that. Think about reference counts or reachability across tables.
3. Attribute bytes by state: active while the current version uses a file, time travel while only history inside retention does, fail-safe after that. Decide who is charged for a file a clone still uses.

**Follow-ups.**
1. Walk through a query AT a timestamp three days ago: which metadata is read and which files are scanned.
2. Show how garbage collection decides a file can go when the table has been cloned twice and the source then dropped.
3. A table is truncated and reloaded daily with {{retention_days}}-day retention. Estimate its time-travel and fail-safe bytes relative to its active bytes, and say what you would tell the customer.
4. How does UNDROP of a whole schema with thousands of tables work, including name conflicts?
5. A data subject's rows must be gone within 30 days of a request. How does that interact with time travel and fail-safe, and what do you offer?

**Follow-up rules.**
- when: snapshot, snapshots → ask: Is each of your snapshots a copy of the data or a list of files? What would a daily snapshot of {{storage}} cost in your design?
- when: reference count, refcount, reference counting → ask: Garbage collection crashes after decrementing a count and before deleting the file. What happens on restart, and can it ever delete a live file?
- when: vacuum, compaction, compact → ask: Compaction rewrites small files into large ones. What does it do to time-travel storage for the next {{retention_days}} days?
- when: soft delete, tombstone → ask: How long does the tombstone live, and what reclaims the space of a dropped table that is never undropped?
- when: gdpr, erasure, right to be forgotten, deletion request → ask: The rows are gone from the current version but still inside time travel and fail-safe. What do you tell the requester, and when are they really gone?

**Production Reality Check.**
- A customer's jobs truncate and reload its biggest tables every day. With {{retention_days}}-day retention, the time-travel and fail-safe bytes of those tables reach many times their active bytes and the month's storage bill jumps. The customer asks why nothing warned them.
- A release changes garbage collection to compute reachability per table. Files still used by a clone whose source table was dropped are deleted when the source's retention ends, and queries on the clone fail with missing-file errors.
- A user drops a production schema by mistake. UNDROP fails for 40 of its tables because an automated job had already created new tables with the same names a few minutes later.

**Evaluation Criteria.** Versions as immutable file lists with commit times and statement ids; time-travel resolution by version lookup; UNDROP as restoring a dropped object's version chain with a clear name-conflict rule; clones as shared file references; garbage collection by reachability across all tables and clones (or crash-safe reference counts), with a grace period and an audit of deletions; storage accounting by state with attribution for shared files; customer-facing controls (transient tables, shorter retention for staging data, alerts on history-to-active ratio); an honest account of deletion requests versus retention; adapts to each incident with diagnosis, recovery and prevention.

## SNO-L4-05: Marketplace listing analytics without exposing consumers' queries

| | |
|---|---|
| **Template ID** | SNO-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy-preserving analytics / access records, aggregation thresholds, differencing, restatement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "providers": {"2": ["800", "2,500"], "3": ["15,000", "40,000"]},
  "listings": {"2": ["3,000", "10,000"], "3": ["60,000", "150,000"]},
  "min_group": [5, 10, 20],
  "freshness": ["1 hour", "6 hours", "24 hours"]
}
```

**Business Scenario.** A data marketplace lets {{providers}} providers publish {{listings}} listings: free, trial and paid datasets that consumers in other accounts obtain through data sharing and query with their own compute. Providers want analytics: how many accounts viewed a listing, requested it or obtained it, how many trials converted to paid, which shared objects and columns consumers use and how often, and which consumer accounts are active. Consumers expect that a provider never sees their query text, the values they filter on, or what they do with data they copied, and that browsing by accounts that never obtained the listing is shown only in aggregate. Providers expect numbers no older than {{freshness}}.

**Problem Statement.** Design the analytics pipeline, the provider-facing data model, the privacy rules and how providers access the results. Say which raw records you use, how they become daily facts, what each provider can and cannot see, how small groups are protected, and how late or replayed records change published numbers.

**Constraints.** Query text and literal values never reach provider-facing data. Browsing activity is published only in aggregate, and any group of fewer than {{min_group}} distinct accounts is suppressed. Consumers who obtained a listing are identified to its provider by account and organisation (this exercise's rule: the provider already has a contract or request from them). A provider sees only its own listings. Restatements are allowed but announced.

**Assumptions.** All counts and timings are hypothetical. Each consumer query against shared data produces an access record listing the shared objects and columns it read, separate from the query's text, which stays in the consumer's own history.

**Clarifications.**
- Q: Can the provider see which columns a consumer read? | A: In this exercise, at object and column level, counted per day; never the query text, its predicates or the consumer's own tables it joined.
- Q: Are individual user names shown? | A: No, account and organisation level only.
- Q: What about consumers who copy shared data into their own tables? | A: The copy is theirs; activity on it is not visible to the provider.
- Q: How do providers get the analytics? | A: As tables shared into their own account, queried with their own compute.
- Q: Is the minimum group size a legal requirement? | A: It is this product's policy; you may propose a different number with reasons.

**Hints.**
1. Build provider-facing facts from object-access records (which shared objects and columns a query touched), never from query text.
2. A minimum group size alone does not stop a provider subtracting one aggregate from another. Think about differencing across filters, listings and days.
3. Identified usage (accounts that obtained the listing) and anonymous browsing need different rules; keep them in different tables.

**Follow-ups.**
1. Define the daily fact tables providers query: grain, keys, and which columns come from which raw source.
2. A provider narrows the browsing view to one region and one industry where only a handful of accounts viewed the listing. What do they learn, and what stops it?
3. How do you count trial-to-paid conversion when consumer accounts merge or move between organisations?
4. Access records from one region arrive two days late. How do published numbers change, and how do providers find out?
5. A provider asks for the most common filter values used against their table, to improve the product. What can you safely offer?

**Follow-up rules.**
- when: query text, query history, sql text → ask: Even with literals stripped, the shape of a query can reveal intent. Which fields of a query ever reach provider-facing data in your design?
- when: k-anonymity, threshold, suppress, suppression → ask: The provider changes a filter so two groups that both clear the threshold differ by exactly one account. How does your design stop the subtraction?
- when: differential privacy, noise, laplace → ask: Providers reconcile billing against some of these numbers. Which metrics get noise, and which must be exact?
- when: dedup, deduplicate, duplicate, idempotent → ask: What is the key of one access record, and what happens when a region replays a day of records?
- when: dashboard, dashboards → ask: Does the provider's dashboard run on the provider's compute or the platform's, and who can see the provider's own queries against it?

**Production Reality Check.**
- A provider compares listing views for "financial services, all regions" with "financial services, all regions except one". Both groups clear the {{min_group}}-account threshold, but they differ by one account, and the provider learns that a specific competitor browsed its listing.
- A logging change starts attaching the first 200 characters of query text to access records for debugging. The text reaches provider-facing tables for several providers and stays there for three {{freshness}} refresh cycles before anyone notices.
- Access records from one region are replayed after a pipeline fault and one day's usage counts double for listings in that region. Providers who bill their own consumers by usage send invoices on the inflated numbers.

**Evaluation Criteria.** Facts derived from object-access records with no query text or literals; separate identified-usage and anonymous-browsing models with different rules; minimum group size applied to distinct accounts plus protection against differencing (fixed published cuts, coarse dimensions, suppression of complementary cells, or noise where exactness is not needed, with exact metrics kept for billing); idempotent ingestion keyed by access-record id; a stated restatement policy with versioned daily partitions and notices; delivery to providers as shared tables scoped to their listings; a data-minimisation review gate on any new field; adapts to each incident with diagnosis, recovery and prevention.
