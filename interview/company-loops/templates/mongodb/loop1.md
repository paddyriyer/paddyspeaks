# MongoDB · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a document database
offered as software and as a cloud service: collections of documents, indexes, replica
sets that elect a primary, the database profiler, TTL indexes and full-text search
indexes. Every workload, number, name and schema is hypothetical, and nothing here
describes how any company's systems are actually built or operated. Where a product
rule is used, it is stated as this exercise's rule; check current docs.

## MDB-L1-01: Index efficiency: query shapes that examine far more documents than they return

| | |
|---|---|
| **Template ID** | MDB-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / conditional aggregation, ratio of sums, exact threshold comparison, deduplication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | MDB-L1-01.mjs |

**Business Scenario.** A team running a document database wants to know which queries need a better index. For a day they set the database profiler to record every read on a replica set, and they loaded the profiler entries into a warehouse table. Public documentation describes the fields such an entry carries in general terms: the plan the query used (`IXSCAN` with an index, or `COLLSCAN` for a full collection scan), the number of index keys and documents examined, the number of documents returned, and a hash that identifies the query's shape (the same filter, sort and projection with different literal values). A query that examines thousands of documents to return a handful is the first one to fix. You have {{rows}} profiler rows.

**Problem Statement.** Write one PostgreSQL query over `profiled_ops` that returns `ns, query_hash, executions, docs_examined, n_returned, examined_per_returned, collscan_executions`: one row per query shape, identified by `(ns, query_hash)`, that is inefficient. `executions` is the number of rows with `op = 'query'`; `docs_examined` and `n_returned` are the totals of those columns over the shape's rows. A shape is inefficient when it has at least {{min_execs}} executions and its total documents examined is strictly greater than {{k}} times its total documents returned. `examined_per_returned` is `docs_examined / n_returned` rounded to 2 decimal places, or NULL when the shape returned nothing. `collscan_executions` is the number of its executions whose `plan_summary` is `'COLLSCAN'`. Order by `ns, query_hash`. {{getmore_rule}} {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). The comparison with {{k}} is exact and strict: a shape that examined exactly {{k}} documents per document returned is not reported. The floor is inclusive. Compare totals, not rounded ratios.

**Assumptions.** The collections, query shapes, plans, counts and thresholds are hypothetical; profiling every operation is this exercise's setup (it adds load, and a real deployment would usually sample slow operations instead). The profiler field names are simplified; check current docs for the exact fields of a profiler entry.

**Clarifications.**
- Q: Is the ratio the average of each query's ratio? | A: No. It is the shape's total documents examined divided by its total documents returned. One query that returned a single document must not dominate.
- Q: What about a shape that returned no documents at all? | A: It still examined documents, so it is inefficient whenever it examined any; report it with a NULL ratio. Never divide by zero.
- Q: Is the same query_hash in two collections the same shape? | A: No. A shape is identified by `(ns, query_hash)`.
- Q: What is a getMore? | A: A request for the next batch of an open cursor. It belongs to the query that opened the cursor: its work counts, but it is not another execution.
- Q: Is the floor inclusive? | A: Yes: exactly {{min_execs}} executions qualifies.
- Q: Does a getMore row of a collection-scan cursor count as a COLLSCAN execution? | A: No. Only `op = 'query'` rows are executions.

**Hints.**
1. Aggregate once per `(ns, query_hash)`: `COUNT(*) FILTER (WHERE op = 'query')`, `SUM(docs_examined)`, `SUM(n_returned)`, and a filtered count for COLLSCAN.
2. `docs > k × returned` needs no division at all, and it works when `returned` is 0.
3. `NULLIF(SUM(n_returned), 0)` turns the zero denominator into NULL for the displayed ratio.
4. If rows can be delivered twice, deduplicate on the operation's identity before aggregating: `DISTINCT ON (host, op_id)`.

**Follow-ups.**
1. A shape returns 20 documents and examines 20 000 keys but only 25 documents. What does that tell you about the index, and which ratio would you add to the report?
2. The profiler at 100% costs too much in production. If you only had a sample of slow operations, which of these numbers would become biased, and how would you correct for it?
3. You recommend an index for the worst shape. How would you prove from the same data, a week later, that it helped and did not slow down writes?
4. The same report runs across thousands of clusters. How would you aggregate it so that one tenant's shapes are never shown to another, and so that the top offenders are still easy to find?

**Follow-up rules.**
- when: avg, average → ask: You averaged per-query ratios. Construct three executions where the average is above {{k}} and the ratio of totals is below it. Which one describes the cost?
- when: nullif, divide by zero, division by zero → ask: A shape examined 5 000 documents and returned none. Is it reported, and how does your comparison treat it?
- when: getmore → ask: How do you attribute a getMore's work to the query that opened the cursor, and what would you do if a getMore row had no query row in the log?
- when: having → ask: Your HAVING clause holds two comparisons, the floor and the ratio. Which one is inclusive, which one is strict, and why compare totals rather than the rounded ratio?
- when: distinct on, distinct, dedup, row_number → ask: Which columns identify one operation, and what would your deduplication do if two copies differed only in entry_id and logged_at?

**Evaluation Criteria.** One row per `(ns, query_hash)`; executions counted from query rows only; totals include the cursor's getMore batches (Hard+); ratio of totals, not an average of ratios; strict comparison with k done on exact integers and correct for zero returned; inclusive floor; COLLSCAN executions counted from query rows; duplicates removed by `(host, op_id)` and shapes kept apart by namespace (Very Hard); deterministic order; can discuss keys versus documents examined, sampling bias and how to verify an index change.

## MDB-L1-02: Time without a primary: seconds from losing a primary to the next election

| | |
|---|---|
| **Template ID** | MDB-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-member LAG, running counts over instants, as-of range joins, LATERAL lookups |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, data-architect |
| **Generator** | MDB-L1-02.mjs |

**Business Scenario.** A replica set accepts writes only through its primary. When the primary steps down or becomes unreachable, the remaining members hold an election, and until a new primary is elected the set cannot take writes (public documentation describes this behaviour in general terms). A reliability team wants to know how long each of {{sets}} replica sets went without a primary, election by election, and to tell planned step-downs for maintenance apart from step-downs outside a window and from failures. A monitor recorded every member's state changes ({{changes}} rows); maintenance windows are in their own table.

**Problem Statement.** Write one PostgreSQL query that returns `replica_set, lost_at, elected_at, new_primary, seconds_without_primary, cause`: one row per gap. A replica set **has a primary** at an instant when at least one of its members' latest state at that instant is `'PRIMARY'`. A **gap** starts at an instant when the set goes from having a primary to having none (`lost_at`) and ends at the first later instant when it has one again (`elected_at`); `new_primary` is the member that became `'PRIMARY'` at that instant, and `seconds_without_primary` is `elected_at − lost_at` in seconds, with milliseconds. `cause` comes from the row at `lost_at` that took the primary out of that state: `'maintenance'` when its `reason` is `'stepdown'` and `lost_at` falls inside one of that set's maintenance windows `[starts_at, ends_at)`, `'stepdown'` for any other step-down, and `'failure'` otherwise. Order by `replica_set, lost_at`. {{same_instant_rule}} {{repeat_rule}}

**Constraints.** One SQL statement (CTEs allowed). A member's state changes only through its own rows; every member has a `'snapshot'` row at the start of the log. Order a member's rows by `changed_at, change_id`. A window's end is outside it.

**Assumptions.** Replica sets, members, timings and windows are hypothetical. The monitor's view stands in for the set's own view of itself, and its clocks are treated as exact; in a real set, members can briefly disagree about who is primary. Election timing depends on settings this exercise does not model; check current docs.

**Clarifications.**
- Q: A secondary goes into RECOVERING during a gap. Does that end the gap? | A: No. Only a member becoming PRIMARY ends it.
- Q: Can there be two primaries at once? | A: In this log, briefly: a new primary can be elected before the old one is recorded stepping down. The set had a primary throughout, so there is no gap.
- Q: Does a step-down during a maintenance window count as maintenance if it happens exactly at the window's end? | A: No. Windows are `[starts_at, ends_at)`.
- Q: The primary becomes unreachable during a maintenance window. Is that maintenance? | A: No. Only a step-down can be maintenance; an unreachable primary is a failure wherever it happens.
- Q: Can the same member be elected again? | A: Yes. `new_primary` is then the member that lost it.
- Q: What is the unit of `seconds_without_primary`? | A: Seconds, with the millisecond fraction, e.g. 4.217.

**Hints.**
1. Work out, for every row, the member's previous state with `LAG(new_state) OVER (PARTITION BY replica_set, member ORDER BY changed_at, change_id)`. A row changes the number of primaries by +1, −1 or 0.
2. Sum those changes per `(replica_set, changed_at)`, then take a running sum: the number of primaries after each instant. A gap starts where it falls to 0 and ends where it rises above 0.
3. For each gap start, the end is the first later instant with a primary: a `LATERAL` subquery with `MIN`, or `LEAD` over the starts and ends together.
4. The maintenance label is an `EXISTS` against the set's windows with a half-open range test.

**Follow-ups.**
1. The monitor polls every 10 seconds instead of recording changes as they happen. What does that do to the measured gaps, and how would you report the uncertainty?
2. Writes using majority write concern can also stall when a majority of voting members is unavailable, even while a primary exists. How would you measure that kind of unavailability from similar data?
3. The team wants a monthly availability figure per replica set. How do you turn these gaps into one, and how should gaps that cross a month boundary or are still open be counted?
4. A driver retries a write across an election. What would you join to these gaps to measure what applications actually saw, rather than what the set reported?

**Follow-up rules.**
- when: lead → ask: You used LEAD over the rows. What does it return right after a gap opens when a secondary changes state before the election?
- when: row_number, rank → ask: How do the row numbers help you find when the set had no primary, and what happens when two rows share a changed_at?
- when: between → ask: BETWEEN includes both ends. What does your query say about a step-down at exactly a window's ends_at?
- when: count(*), count primaries, number of primaries → ask: The monitor repeats an unchanged PRIMARY state. How does your count stay correct when the same member reports PRIMARY twice?
- when: epoch, extract → ask: Your gap is in seconds. How would you report availability over a month from it, and what do you do with a gap that is still open?

**Evaluation Criteria.** Per-member previous state with a deterministic order; the number of primaries tracked per set, so a secondary's state change neither starts nor ends a gap; changes at one instant applied together (Hard+); a new primary elected before the old one steps down gives no gap (Hard+); the first later election ends the gap and names the member; seconds with milliseconds; cause from the reason and a half-open window (boundaries at Hard+); unchanged re-reports ignored and an open gap reported with NULLs (Very Hard); deterministic order; can discuss polling error, majority availability and month-level availability.

## MDB-L1-03: Unused indexes: no recorded use on any replica-set member

| | |
|---|---|
| **Template ID** | MDB-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / counter deltas with resets, anti-joins, exclusion rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | MDB-L1-03.mjs |

**Business Scenario.** Every index speeds up some reads and slows down every write, and it takes memory and disk. A team wants to drop indexes nobody uses. Public documentation describes per-member index access statistics in general terms: each member of a replica set counts the operations that used each index since a point in time (usually when the member last started), and the count starts again from zero when the member restarts. The counts are per member, and reads sent to secondaries only show up on those secondaries. A collector sampled every member's counters once a day from {{window_start}} to {{window_end}} ({{n_samples}} samples, {{n_rows}} rows).

**Problem Statement.** Write one PostgreSQL query that returns `cluster, ns, index_name, key_pattern, size_mb` for every index that had **no recorded use** in the window, ordered by `cluster, ns, index_name`. For each member and index, compare each sample with the previous sample of the same member and index: if `since` is unchanged, the use in between is `ops − previous ops`; if `since` changed, the counter restarted after the previous sample and the use is `ops`. The first sample of each series is the baseline: what it counted happened before the window. An index was used in the window if any member shows use greater than 0 between any two consecutive samples. Exclude unique indexes (they enforce a constraint), TTL indexes (`ttl_seconds` is not NULL), and indexes built inside the window (`created_at` at or after {{window_start}}): they have not been observed for long enough. `size_mb` is `size_bytes / 1048576` rounded to 1 decimal place. {{restart_rule}} {{cluster_rule}}

**Constraints.** One SQL statement (CTEs allowed). The window starts at `{{window_start}}`; you may write that timestamp into the query. Every index has a sample on every member at every sample time after it was built.

**Assumptions.** Clusters, collections, indexes, sizes and counters are hypothetical. The sampling schedule and the rules for what counts as use are this exercise's; check current docs for what increments an index's access counter and when it resets.

**Clarifications.**
- Q: An index's counter is 80 000 at the first sample and never changes. Is it used? | A: No. That use happened before the window; only increases inside it count.
- Q: The primary never used an index but a secondary did. | A: It is used. Analytics reads routed to a secondary are real use, and dropping the index would hurt them.
- Q: How do I recognise a restart? | A: The sample's `since` differs from the previous sample's on that member.
- Q: Is an index built exactly at the window's start inside the window? | A: Yes: `created_at >= {{window_start}}` is inside, and it is excluded.
- Q: What about the `_id_` index? | A: It is unique, so it is excluded with the other unique indexes.

**Hints.**
1. `LAG(ops)` and `LAG(since)` over `PARTITION BY cluster, member, ns, index_name ORDER BY sampled_at` give the previous sample.
2. Build the set of `(cluster, ns, index_name)` that were used on any member, then anti-join the index list against it with `NOT EXISTS`.
3. A `CASE` turns the two counter situations into one "use since the previous sample" value; the baseline row has no previous sample and is skipped.

**Follow-ups.**
1. The team plans to drop the reported indexes next week. What would you do first to make the change reversible and to catch a monthly job that the window missed?
2. An index is used, but only by a query that another index would also serve. How would you find redundant indexes, not just unused ones?
3. Across thousands of clusters, the counters are collected every hour. How would you store them so that this report runs over any window cheaply, and how do you handle a sample that is missed?
4. An index is used rarely but each use is a critical, latency-sensitive read. How would you weigh the cost of keeping it against the cost of dropping it, with numbers you can collect?

**Follow-up rules.**
- when: member_state, primary → ask: Why is a primary's counter not enough to call an index unused, and which reads only ever reach a secondary?
- when: max(ops), min(ops), max - min, last - first → ask: A member restarted mid-window. What do max − min or last − first say about an index used only after the restart?
- when: ops > 0, ops <> 0 → ask: A counter is 80 000 at the first sample and never moves. Is that index in use during the window?
- when: hidden → ask: How would hiding the index before dropping it change your rollout, and what would you watch while it is hidden?

**Evaluation Criteria.** Consecutive samples per member and index; use as an increase, with a restart (`since` changed) counted from zero (Hard+); the baseline sample not counted; use on any member, not just the primary; unique, TTL and built-in-window indexes excluded with an inclusive start (Hard+); indexes identified with their cluster (Very Hard); size rounded correctly; deterministic order; can discuss reversible drops, redundant indexes and collection at scale.

## MDB-L1-04: TTL monitor passes: which documents each pass deletes

| | |
|---|---|
| **Template ID** | MDB-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / min-heap with lazy invalidation, event simulation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, data-architect |
| **Generator** | MDB-L1-04.mjs |

**Business Scenario.** A TTL index deletes documents automatically once a date field in them is older than the index's `expireAfterSeconds`. Public documentation describes the mechanism in general terms: a background task wakes up periodically and removes the documents that are due, so a document can outlive its expiry by up to one period, and applications that update or remove the date field change when, or whether, the document expires. A team is debugging "documents that disappeared too early" and "documents that never expired", and wants to replay a write log against this exercise's model of the passes to see exactly what each pass removed.

**Problem Statement.** Implement `ttl_passes(events, expire_after, period, n_passes, cap=None)`. `events` is a list of `(t, op, doc_id, value)` sorted by `t` (integer seconds). `'insert'` creates the document with its TTL field set to `value` (an insert never reuses the id of a live document); `'update'` sets the field of a live document to `value`; `'delete'` removes a live document. An update or delete of a document that is not live (never inserted, deleted by the application, or already removed by a pass) does nothing. A document with a date `v` **expires** at `v + expire_after`. Passes run at times `period, 2·period, …, n_passes·period`; before the pass at time T, every event with `t ≤ T` has been applied, and the pass deletes every live document whose expiry is at or before T. {{value_rule}} {{cap_rule}} Return a list of `n_passes` lists: the doc_ids each pass deleted, ascending.

**Constraints.** Up to 200 000 events and about 5 000 passes, with tens of thousands of live documents at a time. Work per write should be O(log n); a pass must not look at documents that are not due.

**Assumptions.** The period, the expiry rule, the cap and the handling of non-date values are this exercise's model; check current docs for how a TTL index treats missing fields, non-date values, arrays and deletion batches. Clocks are exact and every pass finishes before the next event.

**Clarifications.**
- Q: Is a document whose expiry equals the pass time deleted? | A: Yes. Due means expiry ≤ T.
- Q: An update arrives at exactly a pass time. Before or after the pass? | A: Before: every event with t ≤ T is applied first.
- Q: An update targets a document the previous pass removed. | A: Nothing happens. It does not recreate the document.
- Q: What does an update to None mean? | A: The field is removed, so the document no longer expires, until a later update sets a date again.
- Q: Can an id come back? | A: Yes, an insert after the old document is gone creates a new document with that id.

**Hints.**
1. A min-heap of `(expiry, doc_id)` gives the next document due without scanning. Push a new entry on every insert or update that sets a date.
2. Do not search the heap when a document changes. Keep each live document's current expiry in a dict; when an entry is popped, it is valid only if the document is live and its current expiry equals the entry's.
3. Each pass pops while the smallest expiry is ≤ T; stale entries are discarded as they surface.

**Follow-ups.**
1. Your heap keeps stale entries. How large can it grow, and when would you rebuild it?
2. A team bulk-loads 50 million documents with dates already in the past. What does the first pass do to the database, and how would you spread the deletions?
3. Product wants documents removed within one second of expiry instead of within a period. What does that cost, and what would you suggest instead for reads that must not see expired data?
4. Each replica-set member could run its own passes. Why does it matter that only one member decides deletions, and how do the other members learn about them?

**Follow-up rules.**
- when: sort, sorted → ask: You sort documents on every pass. How much work is that per pass with 50 000 live documents and 5 000 passes?
- when: remove from heap, heap.remove, decrease key → ask: Removing an arbitrary entry from a binary heap is O(n). What does lazy invalidation do instead, and what does it cost in memory?
- when: version, counter, generation → ask: When is a popped entry stale, and does an id that is deleted and inserted again break your check?
- when: scan, iterate over all, every document → ask: How many documents does each pass touch in your design, and how does that grow with the number of live documents?

**Evaluation Criteria.** Writes applied in order with t ≤ T before each pass; updates and deletes to non-live documents ignored; expiry at or before T is due; the field removed or set to a non-date stops expiry (Hard+); a heap with lazy invalidation, O(log n) per write; cap with earliest-expiry-first and doc_id ties, and arrays by their earliest date (Very Hard); results sorted per pass; can discuss heap growth, bulk expiry and replication of deletions.

## MDB-L1-05: Search postings: documents containing every query term, scored by term frequency

| | |
|---|---|
| **Template ID** | MDB-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Inverted indexes / sorted posting-list intersection, top-k selection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | MDB-L1-05.mjs |

**Business Scenario.** A full-text search index over a collection is, at its core, an inverted index: for every term, a posting list of the documents that contain it, sorted by document id, each with the term's frequency in that document. Public documentation of search products built on such indexes describes the idea in general terms; real scoring is far richer. A team is building a small matcher for an internal tool and wants the core right first: find the documents that contain every term of a query and rank them by a simple score, fast enough for hundreds of queries over hundreds of thousands of documents.

**Problem Statement.** Implement `search(postings, queries, k, deleted=None)`. `postings` maps each term to a list of `(doc_id, tf)` sorted by `doc_id` (each doc_id at most once per list, `tf ≥ 1`). For each query in `queries` (a list of terms), the matching documents are those that appear in the posting list of every required term. A document's **score** is the sum of its `tf` over the query's distinct required terms. Return one list per query: up to `k` pairs `(doc_id, score)`, highest score first, ties by smaller `doc_id`. A required term with no posting list matches nothing, so its query returns an empty list. {{term_rule}} {{deleted_rule}}

**Constraints.** Up to 300 000 documents, about 1.3 million postings and 400 queries; a query's terms can have posting lists from a few dozen to 40 000 entries. The work for a query should depend on its own posting lists, not on the number of documents in the collection.

**Assumptions.** The vocabulary, frequencies, queries and deletions are hypothetical; the score is this exercise's, not the relevance scoring of any real search product. Terms are already normalised (lower case, no punctuation).

**Clarifications.**
- Q: What is returned for a query with fewer than k matches? | A: All of its matches, in order. No padding.
- Q: Can the same term appear twice in a query? | A: Yes; it counts once, both for matching and for the score.
- Q: Two documents have the same score. | A: The smaller doc_id comes first.
- Q: Are the posting lists sorted? | A: Yes, by doc_id, and you may rely on it.
- Q: Should I return the doc_ids of deleted documents? | A: Never. Deleted documents can still sit in posting lists until the index is rewritten.

**Hints.**
1. Start from the shortest posting list among the required terms: no answer can be outside it.
2. For each further list, keep only the candidates that also appear in it: a two-pointer merge over the sorted lists, or a binary search per candidate when the other list is much longer.
3. Pick the top k with `heapq.nsmallest(k, ..., key=lambda e: (-score, doc_id))` or a sort of the (usually short) survivors.

**Follow-ups.**
1. One query term appears in 40 000 documents and another in 30. Compare a linear merge with binary searches (or galloping) for this pair, and say when each wins.
2. The index must also support phrase queries ("replica set" as adjacent words). What would you add to each posting, and how does the intersection change?
3. Deleted documents pile up in posting lists. When would you rewrite the lists, and what does deletion cost a query in the meantime?
4. The collection is split across shards, each with its own index. How do you compute a global top k, and what must each shard return so the result is exact?

**Follow-up rules.**
- when: set(, set intersection, intersection → ask: Building a set from each posting list costs the full list on every query. When is that fine, and when does the shortest-first approach win?
- when: for doc in, every document, all documents → ask: How does your query cost grow with the number of documents in the collection, and what does that mean at 300 000 documents and 400 queries?
- when: bisect, binary search, gallop → ask: Binary searching each candidate in a long list costs O(m log n). When does a linear merge beat it?
- when: sort → ask: You sort all matches to take the top k. What does that cost when a query matches 40 000 documents, and what would you use instead?

**Evaluation Criteria.** Intersection that starts from the shortest required list and never scans the whole collection; correct score over distinct required terms; top k with the doc_id tie-break; absent terms handled; deleted documents filtered (Hard+); excluded terms and queries without a required term (Very Hard); a clear complexity argument in terms of posting-list lengths; can discuss galloping, phrase positions, deletes and distributed top k.
