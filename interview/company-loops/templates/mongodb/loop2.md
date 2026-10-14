# MongoDB · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a document
database offered as software and as a cloud service. Product behaviours are stated
generally, and where a specific rule is used it is this exercise's rule; check
current docs. Every workload, number, schema and incident is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## MDB-L2-01: Routing change events to thousands of change-stream subscriptions

| | |
|---|---|
| **Template ID** | MDB-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Inverted indexes / match counting over equality filters, null and $in semantics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | MDB-L2-01.mjs |

**Business Scenario.** An application built on a document database pushes live updates to its users: a customer's order page refreshes when that order changes, a warehouse screen shows new deletes in one collection, a support tool follows one SKU. Opening one change stream per screen would mean thousands of streams on the cluster, so one service reads a single change stream and fans each change event out to many lightweight subscriptions. Each subscription is a filter of equality clauses on fields of the event. The fan-out step must decide, for every event, which subscriptions it matches, fast enough to keep up with the stream.

**Problem Statement.** Implement `match_subscriptions(subscriptions, events)`. `subscriptions` is a list of `(sub_id, filter)` with distinct integer ids. A filter is a dict that maps a field path (for example `'fullDocument.status'`) to a clause. An event is a flat dict from field path to value; fields can be missing, for example a delete event has no `fullDocument` fields. A subscription matches an event when every clause of its filter holds. An empty filter matches every event. A plain clause value holds when the event has that field and its value equals the clause value; values are strings and integers, and the integer `7` is not the string `'7'`. {{in_rule}} {{null_rule}} Return a list with one entry per event, in event order: the ids of the matching subscriptions in ascending order (an empty list if none match).

**Constraints.** Up to 20 000 subscriptions and 3 000 events in the timing check, each subscription with up to three clauses. Most clauses name a selective field such as a customer or a document id. Testing every subscription against every event is too slow; aim to touch only the subscriptions that share at least one field value with the event.

**Assumptions.** Event fields, filters and volumes are hypothetical, and events are already flattened to dotted field paths. Values are scalars (no arrays, no nested documents, no booleans or floats). Subscriptions do not change while a batch of events is matched.

**Clarifications.**
- Q: Does the order of subscriptions in the input matter? | A: No. Each event's list is sorted by subscription id.
- Q: Is a clause on a field the event does not have false? | A: Yes for a plain value, and for `$in` unless the rules for `None` below say otherwise.
- Q: Can one filter name the same field twice? | A: No. A filter is a dict, so each field appears at most once.
- Q: What does a subscription with an empty filter match? | A: Every event, including deletes.
- Q: Do I need to handle range operators like `$gt`? | A: Not in this exercise. The follow-ups ask what would change if you did.

**Hints.**
1. Turn the question around: instead of asking each subscription about the event, ask the event which subscriptions have a clause on each of its `(field, value)` pairs.
2. A subscription matches when the number of its clauses that hold equals the number of clauses it has. Count hits per subscription for the current event.
3. Subscriptions with no clauses never get a hit, and clauses satisfied by a missing field have no `(field, value)` pair in the event. Both need their own small list.

**Follow-ups.**
1. Most subscriptions add `operationType` or the collection name as a clause. What happens to your hit counting, and how would you choose which clause to index a subscription under?
2. Subscriptions are added and removed thousands of times a minute. How do you update your index without rebuilding it, and what does an event see while a subscription is half-added?
3. A product team wants range clauses, such as `fullDocument.total > 100`. How would you index those alongside the equality clauses?
4. The fan-out service restarts. How does it resume the change stream without losing or repeating events for subscribers, and what happens if it was down longer than the oplog window?

**Follow-up rules.**
- when: for each subscription, every subscription, nested loop, brute force → ask: How many filter checks is that for 20 000 subscriptions and 3 000 events, and how long would CPython take?
- when: set intersection, intersection, intersect → ask: You intersect the sets of subscriptions per clause. What does that cost when one clause is `operationType = 'update'`, shared by half of all subscriptions?
- when: counter, count hits, counting → ask: A subscription lists the same value twice in `$in`. Can your count go above its number of clauses, and what would it then return?
- when: null, is None, missing field, missing fields → ask: An event has no `fullDocument.status` field at all. Which subscriptions does it match, and how does your index find them without a `(field, value)` pair?
- when: resume token, resume, oplog → ask: The stream resumes from a token after a restart. Which events might a subscriber see twice, and how would the service tell?

**Evaluation Criteria.** Correct matches in ascending id order; every clause required, not one; strict value types (7 is not '7'); empty filters match everything; `$in` with duplicates and empty lists handled; `None` matching missing and null fields where the rules say so; an inverted index on `(field, value)` with per-event hit counting, or an equally selective scheme; a clear complexity argument in terms of postings touched, not subscriptions; credible answers on skewed clauses, live updates and resuming the stream.

## MDB-L2-02: Orphaned documents left behind by chunk migrations

| | |
|---|---|
| **Template ID** | MDB-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Sorting and binary search / range lookup over a routing table, replaying a migration log |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | MDB-L2-02.mjs |

**Business Scenario.** A sharded document database splits a collection's shard-key space into contiguous ranges called chunks, and each chunk is owned by one shard. A balancer moves chunks between shards to even out data. A migration copies the documents to the recipient shard, commits the new owner, and the donor deletes its copies later. If a migration aborts, or the donor's cleanup has not run yet, documents are left on a shard that does not own their range: orphaned documents. Queries routed through the router skip them, but a backup check, a count run directly on a shard, or a capacity report reads them. An operator wants an exact list of orphans per shard before running a cleanup.

**Problem Statement.** Implement `find_orphans(chunks, documents, migrations=None)`. `chunks` is a list of `(min_key, max_key, shard)` ranges, not sorted, that together cover every key exactly once. A range includes `min_key` and excludes `max_key`; `None` as `min_key` is the lowest possible key and `None` as `max_key` the highest. `documents` lists every document stored on every shard as `(shard, doc_id, shard_key)`; the same `doc_id` can appear on two shards when a copy was left behind. {{migration_rule}} {{key_rule}} A document is orphaned when the shard that stores it is not the owner of the chunk that contains its key. Return the orphaned documents as `(shard, doc_id)` tuples sorted by shard and then by `doc_id`, or an empty list if there are none.

**Constraints.** Up to 20 000 chunks, 200 000 documents and 5 000 migrations in the timing check. Checking every chunk for every document is too slow, and so is scanning the chunk list for every migration. Aim for O((c + n) log c) or better for c chunks and n documents.

**Assumptions.** The routing table, shard names, keys and migration log are hypothetical. Every migration names a chunk that exists. A shard may own no chunk at all, for example one that is being removed. Chunk merges and splits are out of scope for this exercise.

**Clarifications.**
- Q: Which chunk owns a key equal to a chunk boundary? | A: The chunk whose `min_key` equals it. Ranges include their lower bound and exclude their upper bound.
- Q: Are the chunks sorted? | A: No. They come in no particular order.
- Q: If a document is on its owner and also on another shard, what do I return? | A: Only the copy on the shard that does not own the chunk.
- Q: How do I compare `None` with a key? | A: As a `min_key` it is below every key, and as a `max_key` above every key. Python cannot compare `None` with a number, so handle it yourself.
- Q: Does an aborted migration change anything? | A: Not the owner. It is often how orphans appear, because documents were copied before the abort.

**Hints.**
1. Every chunk is named by its lower bound, and the bounds never change. A dict from lower bound to owner lets you apply each migration in constant time.
2. Sort the lower bounds once. The chunk that contains a key is the one with the largest lower bound that is at most the key: one binary search.
3. Keep the lowest chunk (`min_key` None) out of the sorted list, and use it when the binary search finds no bound at or below the key.

**Follow-ups.**
1. The cluster has 300 million documents across many shards. How would you find orphans without pulling every document's key to one machine?
2. A migration commits while your scan is running. Which documents could your report get wrong, and how would you make the scan safe?
3. Cleanup deletes orphans by range. Why delete whole ranges rather than individual documents, and what must be true before a range on the donor can be deleted?
4. Chunks are also split and merged during the window. What changes in your replay, and what identifies a chunk now?

**Follow-up rules.**
- when: linear scan, for each chunk, every chunk → ask: How many comparisons is that for 200 000 documents and 20 000 chunks?
- when: bisect, binary search, bisect_right → ask: A key equals a chunk's lower bound. Which side does your search land on, and which bisect function gives that?
- when: sort the documents, sorted documents, merge → ask: Sorting the documents first works. What does it cost compared with a binary search per document, and which would you use when documents arrive as a stream?
- when: minkey, maxkey, is None, -inf → ask: How does your code compare a key with the lowest and highest bounds without comparing an integer with None?
- when: tuple, compound, lexicographic → ask: Two keys share the region and differ in the number. Show which chunk each one lands in, and what a chunk boundary with only the region set would mean.

**Evaluation Criteria.** Correct orphans with the inclusive lower bound and exclusive upper bound; the lowest and highest chunks handled without comparing with `None`; copies on two shards reported only for the non-owner; a shard with no chunks treated as holding only orphans; committed migrations applied in order and aborted ones ignored; compound keys compared field by field; sorted bounds and binary search, or a sorted merge, with a correct complexity argument; credible answers on scale, concurrent migrations and range cleanup.

## MDB-L2-03: Debug the slow-query shape normaliser

| | |
|---|---|
| **Template ID** | MDB-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Log processing / recursive normalisation, canonical keys, units, malformed input |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | MDB-L2-03.mjs |

**Business Scenario.** A database team collects slow-query log entries from their clusters and groups them by query shape: the filter with every literal value replaced, so that `{status: "paid"}` and `{status: "shipped"}` count as one shape. The report ranks shapes by total time and drives which indexes get built. People have started to distrust it. Fast queries sometimes appear as the slowest in the report. The same query shows up as several shapes depending on how many values its `$in` list had, or on the order a driver wrote its range operators. Case-insensitive name searches are a different shape from case-sensitive ones. And a few shapes with oddly short filters appear that nobody can find in the application code. The normaliser below is the suspect.

**Problem Statement.** Fix `summarise_shapes(lines)` so that it meets this specification. `lines` is a list of log lines as strings. {{replay_rule}}
1. **Skipped lines.** A line that is not valid JSON (the log shipper cut it off) is skipped and counted in `skipped`. A line that parses but has a `"truncated"` key is also skipped and counted: in this exercise the server marks entries whose filter it shortened that way, so their shape cannot be trusted.
2. **Entries.** Every other line is an object with `"ns"` (the namespace), `"filter"` (a dict) and `"dur"` (a duration string: an integer followed by `us`, `ms` or `s`). Other keys are ignored. Durations are converted to integer microseconds.
3. **Shape.** Normalise the filter recursively. In a dict, every key is kept and its value normalised, except that in a dict containing `"$regex"` the `"$options"` key is dropped (options belong to the regex literal). The value of `"$and"`, `"$or"` or `"$nor"` is a list of filters: normalise each one and keep their order. Any other list, such as the argument of `$in` or `$nin`, is one literal and becomes `"?"` whatever its length. Every other value becomes `"?"`.
4. **Canonical form.** The shape is `json.dumps(normalised, sort_keys=True, separators=(",", ":"))`, so keys are sorted at every level.
5. **Output.** Group by `(ns, shape)`. Return `{"shapes": [{"ns", "shape", "count", "total_us", "max_us"}, ...], "skipped": n}`, with shapes sorted by `total_us` descending, then `ns`, then `shape`.

**Constraints.** Keep the function's shape and output format. Up to 60 000 lines in the timing check, processed in linear time.

**Assumptions.** The log format and its `"truncated"` marker are this exercise's simplification of structured database logs; check current docs for the real format. Filters contain only ASCII field names, operators and values. Durations are always one of the three units.

**Clarifications.**
- Q: Is `{"$in": ["a"]}` the same shape as `{"$in": ["a", "b", "c"]}`? | A: Yes. The whole list is one literal.
- Q: Are `$or` branches in a different order the same shape? | A: No. Branches are kept in order; only keys are sorted.
- Q: Does `$options` matter when there is no `$regex` beside it? | A: That does not occur in this log. The rule applies to a dict that has `$regex`.
- Q: Are skipped lines part of any shape? | A: No. They only add to `skipped`.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Convert `850us`, `120ms` and `2s` by hand, then trace each one through the duration helper.
2. Normalise `{"status": {"$in": ["a", "b"]}}` and `{"status": {"$in": ["a", "b", "c"]}}` with the current code and compare the strings.
3. Write the canonical string for `{"total": {"$lt": 9, "$gte": 1}}`. Which level of the dict gets sorted?
4. Read rule 1 again, then look for the place in the code that applies it.

**Follow-ups.**
1. The report now merges shapes correctly, but two different queries with the same shape need different indexes because one sorts. What would you add to the shape key, and what would you leave out?
2. A filter compares a field with a date, written in the log as a typed literal object. What does your normaliser do with it, and what should it do?
3. Truncated entries are 3% of lines but 40% of the time spent. What would you report about them instead of dropping them silently?
4. Logs from 10 000 clusters arrive continuously. How would you compute the same report incrementally, and how would you keep a shape's identity stable when the normaliser's rules change?

**Follow-up rules.**
- when: sort_keys, sorted → ask: Sorting keys merges `{a, b}` with `{b, a}`. Should it also sort `$or` branches, and what would that do to shapes that differ only in branch order?
- when: re.match, re.fullmatch, re.compile, regular expression → ask: Your parser for durations uses a regular expression. What does it do with `1.5s` or `120 ms`, and what should the report do with such a line?
- when: except, exception, try/except → ask: Which exceptions do you catch, and around which statements? What would a broad except hide in this function?
- when: float, round → ask: Where could a fractional microsecond appear, and how do you keep the totals exact?
- when: hash, md5, sha → ask: You store a hash of the shape instead of the string. How would someone reading the report find the query behind it?

**Evaluation Criteria.** Finds and explains every bug with its symptom in the report; durations converted with the longer suffixes checked first; non-logical lists collapsed to one literal; keys sorted at every level; `$options` dropped beside `$regex`; entries marked truncated skipped and counted; the fix stays minimal and linear; adds a test per bug.

## MDB-L2-04: Heavy analytics on dedicated read members of an operational cluster

| | |
|---|---|
| **Template ID** | MDB-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Workload isolation / analytics members, read preference, replication lag, materialised summaries |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "ops_rate": {"2": ["8,000 operations a second", "20,000 operations a second"], "3": ["90,000 operations a second", "250,000 operations a second"]},
  "data_size": ["2 TB", "9 TB", "30 TB"],
  "freshness": ["30 seconds", "5 minutes"],
  "report_window": ["the last 24 hours", "the last 90 days"]
}
```

**Business Scenario.** An online retailer runs its orders, carts and inventory on a document database cluster that holds about {{data_size}} and serves {{ops_rate}} at peak. The business wants dashboards and ad hoc aggregations over {{report_window}}: revenue by region and hour, conversion from cart to order, stock-outs by warehouse. Results must be no more than {{freshness}} behind the application. Last quarter an analyst's aggregation ran on the primary during a sale, scanned most of the orders collection, and doubled checkout latency for twenty minutes.

**Problem Statement.** Design how analytics runs against this operational data without hurting the primary workload. Cover where analytical reads run (dedicated read-only members, a separate copy, or both), how clients are routed to them, what replication lag means for freshness and how you measure it, which indexes and pre-aggregated summaries you need and where they are written, how you stop a single heavy query from hurting either the application or other analysts, and what happens to dashboards when a member fails or an election happens.

**Constraints.** Checkout latency must not change when analytics runs. Analytics members must never become primary. Results must be at most {{freshness}} stale, and a dashboard must say when it is not. The data stays in one cluster unless you justify a copy elsewhere.

**Assumptions.** Volumes, freshness targets and the retailer are hypothetical. The cluster is a replica set (or a sharded cluster whose shards are replica sets). Read preference with tag sets, priority-0 non-voting members and a maximum-staleness setting exist as general product features; their exact behaviour is this exercise's rule, so check current docs.

**Clarifications.**
- Q: Can I build indexes only on the analytics members? | A: In this exercise's rules, an index build replicates to every data-bearing member of the replica set, so an index you add for analytics also costs writes and memory on the primary. Check current docs.
- Q: Where do the writes of an aggregation that ends in `$merge` or `$out` go? | A: To the primary, even when the pipeline reads from a secondary, under this exercise's rules. Check current docs.
- Q: Are the analytics members voting members? | A: You decide, and you must say what it does to elections and to majority writes.
- Q: Do analysts write arbitrary pipelines, or only use dashboards? | A: Both: fixed dashboards for most people, and ad hoc pipelines for a dozen analysts.

**Hints.**
1. Separate the two questions: where analytical reads run, and where analytical results are stored. They have different costs on the primary.
2. Replication lag is a measurement, not a setting. Decide how a dashboard learns how stale its data is.
3. List what the analytics members still share with the primary: the replication stream, the index set, and anything written back.

**Follow-ups.**
1. An analyst needs an index the application never uses. What does it cost on the primary, and what would you do instead?
2. The analytics member falls 20 minutes behind during a bulk import. What do the dashboards show, and what do the routing rules do?
3. Dashboards over {{report_window}} still scan too much. Design the pre-aggregated summaries: grain, how they are updated, and where they live.
4. Leadership wants to join this data with marketing data from another system. When does a copy into an analytical store become the better design, and how do you keep it fresh?
5. With {{ops_rate}} at peak, which numbers would you watch to prove analytics is not hurting checkout?

**Follow-up rules.**
- when: hidden member, hidden → ask: Drivers do not route reads to a hidden member in this exercise's rules. How do your dashboards reach it, and what does a hidden member cost you?
- when: secondaryPreferred, secondary, nearest → ask: Your read preference allows any secondary. What happens to the electable secondaries, and to failover capacity, when a heavy aggregation lands on one of them?
- when: $merge, $out, materialized view → ask: The pipeline reads from an analytics member, but where do its writes go, and what does that add to the primary and the oplog?
- when: index, indexes → ask: Indexes replicate to every member. What does an analytics-only index cost the primary in write work and cache?
- when: change stream, etl, warehouse, copy → ask: Your copy is fed from a change stream. What happens if the consumer is down longer than the oplog window, and how do you rebuild?
- when: maxstalenessseconds, staleness → ask: If every analytics member is staler than your limit, where do the reads go, and is that what you want during a sale?

**Evaluation Criteria.** Analytical reads isolated on priority-0 (and justified voting or non-voting) members reached by tagged read preference; no fallback that silently sends heavy reads to the primary or the electable secondaries; freshness measured from replication lag and shown on dashboards; awareness that indexes and `$merge`/`$out` writes reach the primary; pre-aggregated summaries with a defined grain and update path; per-query limits (time limits, concurrency caps, a separate pool for ad hoc work); behaviour under member failure and elections; a reasoned threshold for moving analytics to a separate store.

## MDB-L2-05: Index suggestion analytics across many clusters

| | |
|---|---|
| **Template ID** | MDB-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / query-shape aggregation, recommendation lifecycle, measuring impact |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "clusters": {"2": ["3,000", "12,000"], "3": ["60,000", "200,000"]},
  "shape_events": {"2": ["40 million", "150 million"], "3": ["2 billion", "6 billion"]},
  "lookback": ["7 days", "30 days"],
  "accept_rate": ["4%", "15%"]
}
```

**Business Scenario.** A cloud database service offers a performance advisor: it looks at the slow operations on a customer's cluster and suggests indexes that would help. The product team wants an analytics pipeline behind that feature across {{clusters}} customer clusters, which report about {{shape_events}} slow-operation records a day, grouped into query shapes with literal values removed. Suggestions are computed from the last {{lookback}}. About {{accept_rate}} of suggestions are accepted. The team wants to know which suggestions are worth showing, and whether an accepted one actually helped.

**Problem Statement.** Design the pipeline from slow-operation records to suggestions and their measured outcome. Cover what is collected per cluster and what is never collected, how records are aggregated by cluster, namespace and shape, how candidate indexes are derived and compared with existing indexes, how suggestions are stored with a lifecycle (shown, dismissed, accepted, built, dropped), how you measure the effect of an accepted suggestion on its shapes and on the cluster's writes, and the reports the product team and a customer see.

**Constraints.** Literal values from customer queries must never be stored. Each customer sees only their own clusters. A suggestion must not be shown again after it was dismissed unless the workload changed materially. "Helped" must be measured, not assumed, and must account for workload changes between the before and after periods.

**Assumptions.** Cluster counts, volumes, acceptance rates and the record format are hypothetical. Each record carries a cluster, a namespace, a query shape, a plan summary, keys examined, documents examined, documents returned, a duration and whether the query sorted in memory. Index build and drop events are available from the cluster's metadata. Guidance such as ordering index fields by equality, then sort, then range is a public rule of thumb; treat it as this exercise's rule.

**Clarifications.**
- Q: Do we see the actual filter values? | A: No. Shapes only, with literals replaced; the pipeline must keep it that way.
- Q: Who builds the index? | A: The customer, from the suggestion or on their own. You learn about it from the index metadata, not from the click.
- Q: What counts as an existing index covering a suggestion? | A: You define it. For example, an existing index whose leading fields equal the suggestion's fields in order.
- Q: Is a suggestion per shape or per collection? | A: You decide. Several shapes on one collection may be served by one index.
- Q: How soon after a build can we judge it? | A: Builds take time and workloads are weekly, so state the window you would use and why.

**Hints.**
1. Aggregate by `(cluster, namespace, shape)` per hour first; almost every later question is a join against that table.
2. Treat a suggestion as an entity with a stable id and a history of states, not as a row that is recomputed every day.
3. For impact, compare the same shapes before and after the build, normalised per execution, and use shapes the index cannot affect as a control.

**Follow-ups.**
1. Two suggestions on one collection overlap: one on `{status, createdAt}`, one on `{status}`. How do you deduplicate, and what does the customer see?
2. Accepted suggestions show lower latency, but the customer also upgraded their cluster tier that week. How do you separate the effects?
3. An accepted index slowed writes on a hot collection. Where does that show up in your data, and how does it change what you suggest next time?
4. At {{shape_events}} records a day from {{clusters}} clusters, which stage is your bottleneck, and what would you pre-aggregate on the cluster side?

**Follow-up rules.**
- when: literal, literals, raw query, parameter values → ask: Where in your pipeline could a literal value slip through, for example inside a regex or an `$in` list, and how would you test that it never does?
- when: latency, duration, p95 → ask: Latency fell after the build, but so did the query volume. Which per-execution measure would you use instead, and why?
- when: a/b, experiment, control group → ask: You cannot randomly build indexes on customers' clusters. What comparison would you use instead, and what bias does it carry?
- when: dismissed, dismiss → ask: How do you decide that the workload changed enough to show a dismissed suggestion again?
- when: unused index, index usage → ask: A suggested index was built and then never used. What does your report say, and what would you suggest to the customer?

**Evaluation Criteria.** Shape-only collection with literals excluded by design and tested; hourly aggregates by cluster, namespace and shape; candidate indexes derived with a stated rule and checked against existing indexes by prefix; suggestions as entities with a lifecycle and dismissal memory; acceptance learned from index metadata; impact measured per execution with a before/after window and a control, including write cost; tenant isolation; a credible scaling plan.
