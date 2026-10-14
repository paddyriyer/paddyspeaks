# MongoDB · Loop 1 — evaluator notes (hidden from candidates)

## MDB-L1-01

**Reference solution** (PostgreSQL; `{{k}}` and `{{min_execs}}` are the instance's values)

```sql reference
WITH ops AS (                       -- one row per operation: a row shipped twice counts once
  SELECT DISTINCT ON (host, op_id) host, op_id, ns, op, query_hash, plan_summary,
         docs_examined, n_returned
  FROM profiled_ops
  ORDER BY host, op_id, entry_id
), shapes AS (
  SELECT ns, query_hash,
         COUNT(*) FILTER (WHERE op = 'query')                                AS executions,
         SUM(docs_examined)                                                  AS docs_examined,
         SUM(n_returned)                                                     AS n_returned,
         COUNT(*) FILTER (WHERE op = 'query' AND plan_summary = 'COLLSCAN')  AS collscan_executions
  FROM ops
  GROUP BY ns, query_hash
)
SELECT ns, query_hash, executions, docs_examined, n_returned,
       ROUND(docs_examined::numeric / NULLIF(n_returned, 0), 2) AS examined_per_returned,
       collscan_executions
FROM shapes
WHERE executions >= {{min_execs}}
  AND docs_examined > {{k}} * n_returned
ORDER BY ns, query_hash;
```

**Explanation.** A shape is `(ns, query_hash)`: the hash describes the query's form, and the same form against two collections is two different problems. Deduplicate first, on the operation's identity `(host, op_id)`, because a re-shipped row would add its work twice and could lift a shape over the floor. Then aggregate once: executions are query rows only, while the documents examined and returned include every getMore batch of the cursor, because that work was done to answer the query. The efficiency test is a ratio of totals, written as `docs > k × returned` so it is exact, strict, and needs no division; a shape that returned nothing but examined documents passes it, and its displayed ratio is NULL through `NULLIF`. Rounding happens only for display.

**Complexity.** One sort for `DISTINCT ON` and one hash aggregate: O(n log n). At production volume the profiler data would be pre-aggregated per shape per hour (counts and sums are additive), so this query would read the rollup instead.

**Dialect notes** (described, not executed). Snowflake: `COUNT_IF(op = 'query')`, `DIV0NULL` or `NULLIF` for the ratio, and `QUALIFY ROW_NUMBER() OVER (PARTITION BY host, op_id ORDER BY entry_id) = 1` instead of `DISTINCT ON`. BigQuery: `COUNTIF`, `SAFE_DIVIDE(docs, returned)` returns NULL on zero, `ROUND(x, 2)` rounds half away from zero on NUMERIC but a FLOAT64 ratio can round differently at .xx5, so cast to NUMERIC first; `QUALIFY` for dedup. Spark SQL: `count_if`, `try_divide`. MySQL 8: `SUM(op = 'query')` counts booleans; no `FILTER` clause and no `DISTINCT ON`.

**Edge cases built into the data.** A shape at exactly k documents per document returned (every level; not reported); a bad shape one execution below the floor and one exactly at it (every level); a shape whose average per-query ratio is above k while its ratio of totals is far below (every level); Hard: cursors whose first batch looks efficient while the getMore batches do the scanning, a bad shape whose getMore rows would lift it over the floor if counted as executions, a shape that returned nothing, a plan that flips between an index and a collection scan, and a collection-scan cursor with a getMore row; Very Hard: rows shipped twice (one of them lifts a shape to the floor if counted twice) and one query_hash used in two collections, bad in one and fine in the other.

**Common mistakes.** Averaging per-query ratios; `>=` for the ratio or `>` for the floor; dividing and comparing a rounded or floating ratio; dropping or erroring on a shape with zero returned; counting getMore rows as executions, or leaving their work out; counting getMore rows as COLLSCAN executions; grouping by `query_hash` alone; `SELECT DISTINCT *` for deduplication (the copies differ in `entry_id`); ordering by the ratio without a tie-break.

**Follow-up guidance.** (1) Keys examined far above documents examined means the index is scanned widely but filters well on the keys (a range on a leading field, or a multikey index); documents examined far above returned means the filter is applied after fetching. Add `keys_examined / n_returned` and a "fetched then filtered" flag. (2) A slow-operation sample over-represents expensive executions, so per-shape totals and the ratio skew toward bad runs; weight by the sampling rate or keep exact per-shape counters and use the sample only for plan details. (3) Compare the shape's totals before and after the change over the same weekday traffic, check the plan summary switched to the new index, and check write latency and index size on the collection; an index helps reads and costs every write. (4) Aggregate per tenant first, keep per-tenant data in that tenant's scope, and publish only the tenant's own top shapes; cross-tenant views show counts of shapes by plan type, never another tenant's shapes.

**Rubric anchors.** 2: correct grouping but averages ratios, counts getMores as executions, or breaks on zero returned. 3: matches the expected result. 4: also explains keys versus documents examined, sampling bias and how to verify an index change.

**Strong signals.** Writes the comparison without division before being asked; asks what a getMore row is and where its work belongs; asks how an operation is identified before deduplicating. **Red flags.** Filtering out rows with `n_returned = 0`; treating a COLLSCAN as automatically inefficient regardless of returned counts on a tiny collection without saying so.

## MDB-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH ev AS (                          -- every row with the member's previous state
  SELECT c.*,
         LAG(new_state) OVER (PARTITION BY replica_set, member ORDER BY changed_at, change_id) AS prev_state
  FROM member_state_changes c
), instants AS (                      -- the change in the number of primaries at each instant
  SELECT replica_set, changed_at,
         SUM(CASE WHEN new_state = 'PRIMARY' AND prev_state IS DISTINCT FROM 'PRIMARY' THEN 1
                  WHEN new_state <> 'PRIMARY' AND prev_state = 'PRIMARY' THEN -1
                  ELSE 0 END) AS delta
  FROM ev
  GROUP BY replica_set, changed_at
), counted AS (
  SELECT replica_set, changed_at,
         SUM(delta) OVER (PARTITION BY replica_set ORDER BY changed_at) AS primaries
  FROM instants
), edges AS (
  SELECT replica_set, changed_at, primaries,
         COALESCE(LAG(primaries) OVER (PARTITION BY replica_set ORDER BY changed_at), 0) AS before
  FROM counted
), losses AS (
  SELECT replica_set, changed_at AS lost_at FROM edges WHERE before > 0 AND primaries = 0
), gains AS (
  SELECT replica_set, changed_at AS elected_at FROM edges WHERE before = 0 AND primaries > 0
)
SELECT l.replica_set, l.lost_at, g.elected_at, np.member AS new_primary,
       EXTRACT(EPOCH FROM g.elected_at - l.lost_at) AS seconds_without_primary,
       CASE WHEN lv.reason <> 'stepdown' THEN 'failure'
            WHEN EXISTS (SELECT 1 FROM maintenance_windows w
                         WHERE w.replica_set = l.replica_set
                           AND l.lost_at >= w.starts_at AND l.lost_at < w.ends_at) THEN 'maintenance'
            ELSE 'stepdown' END AS cause
FROM losses l
JOIN ev lv
  ON lv.replica_set = l.replica_set AND lv.changed_at = l.lost_at
 AND lv.prev_state = 'PRIMARY' AND lv.new_state <> 'PRIMARY'
LEFT JOIN LATERAL (
  SELECT MIN(gn.elected_at) AS elected_at
  FROM gains gn
  WHERE gn.replica_set = l.replica_set AND gn.elected_at > l.lost_at
) g ON true
LEFT JOIN ev np
  ON np.replica_set = l.replica_set AND np.changed_at = g.elected_at
 AND np.new_state = 'PRIMARY' AND np.prev_state IS DISTINCT FROM 'PRIMARY'
ORDER BY l.replica_set, l.lost_at;
```

**Explanation.** The question is about the set, but the data is per member, so first turn rows into changes in the number of primaries: a row adds one when its member becomes PRIMARY from anything else, removes one when its member leaves PRIMARY, and does nothing otherwise, which is what makes a repeated PRIMARY report harmless (Very Hard) and a secondary's RECOVERING irrelevant. Summing the changes per instant applies a hand-over recorded in one millisecond as one event (Hard), and a running sum gives the number of primaries after every instant; it can reach 2 when a new primary is recorded before the old one steps down, and stepping down from 2 to 1 is not a gap. A gap starts where the count falls to 0 and ends at the first later instant where it is positive; the LATERAL `MIN` finds it and stays NULL for a gap still open when the log ends. The cause comes from the row that took the last primary away: only a step-down inside a half-open window is maintenance.

**Complexity.** Two window sorts (per member, then per set) and a grouping: O(n log n). The LATERAL lookup is a probe per gap; with an index on `(replica_set, changed_at)` or by pairing starts and ends with `LEAD` over their union, it stays linear in the number of gaps.

**Dialect notes** (described, not executed). Snowflake and BigQuery: the same window functions; there is no `LATERAL` join with `ON true` in BigQuery, so pair each loss with the next gain using `LEAD` over the union of losses and gains, or a correlated scalar subquery; the duration is `TIMESTAMP_DIFF(elected_at, lost_at, MILLISECOND) / 1000` in BigQuery and `DATEDIFF('millisecond', lost_at, elected_at) / 1000` in Snowflake. `IS DISTINCT FROM` exists in both (BigQuery since 2023); otherwise use `COALESCE(prev_state, '') <> 'PRIMARY'`. Spark SQL: `LATERAL` subqueries are limited, so use the `LEAD` pairing; `unix_millis` for the difference. MySQL 8: window functions and `LATERAL` exist; `TIMESTAMPDIFF(MICROSECOND, …) / 1e6`.

**Edge cases built into the data.** A secondary entering RECOVERING inside a failover gap (every level); a step-down inside a window, one outside every window, and failures (every level); Hard: a hand-over with both rows in the same millisecond, a new primary recorded before the old one steps down, the same member re-elected, step-downs exactly at a window's start (maintenance) and end (not), and a failure inside a window (failure); Very Hard: re-reported unchanged states, including a PRIMARY repeated just before that primary fails, and a gap still open at the end of the log.

**Common mistakes.** Ending the gap at the next row of any member (`LEAD` over the set's rows); pairing each lost primary with the next PRIMARY row, which invents a long gap when the new primary was recorded first; counting every PRIMARY row as a new primary; applying same-instant rows one at a time; `BETWEEN` or `<=` on the window's end; labelling every step-down maintenance; using `LAG` over the set instead of the member to find the previous state; dropping the open gap; returning whole seconds.

**Follow-up guidance.** (1) Polling turns each boundary into an interval: the true gap lies between (observed − interval) and (observed + interval), so report the measured value with that bound and prefer event-driven state changes. (2) Measure write availability for the write concern the application uses: the times when the primary could not acknowledge majority writes (too few voting data-bearing members reachable), from member health and replication lag, as its own series. (3) Sum gap durations per set per month, split a gap at the month boundary, count an open gap up to the report's end and flag it; availability is 1 − downtime / period, and the definition (planned windows excluded or not) must be stated. (4) Join driver-side errors and retry counts by time to the gaps; drivers that retry writes once hide short gaps from users, which is why measured client impact and set-level gaps differ.

**Rubric anchors.** 2: finds failover gaps but ends them at the next row, or invents gaps for overlapping primaries. 3: matches the expected result. 4: also explains polling error, majority write availability and month-level availability with open gaps.

**Strong signals.** Asks whether two primaries can coexist and what the monitor records; reasons about the count of primaries rather than pairs of rows; checks the window boundary. **Red flags.** Joining on `change_id + 1`; assuming one row per election; treating any DOWN member as a lost primary.

## MDB-L1-03

**Reference solution** (PostgreSQL; `{{window_start}}` is the instance's window start)

```sql reference
WITH s AS (
  SELECT cluster, member, ns, index_name, sampled_at, since, ops,
         LAG(since) OVER w AS prev_since,
         LAG(ops)   OVER w AS prev_ops
  FROM index_stats_samples
  WINDOW w AS (PARTITION BY cluster, member, ns, index_name ORDER BY sampled_at)
), used AS (
  SELECT DISTINCT cluster, ns, index_name
  FROM s
  WHERE prev_ops IS NOT NULL
    AND CASE WHEN since = prev_since THEN ops - prev_ops ELSE ops END > 0
)
SELECT i.cluster, i.ns, i.index_name, i.key_pattern,
       ROUND(i.size_bytes / 1048576.0, 1) AS size_mb
FROM indexes i
WHERE NOT i.is_unique
  AND i.ttl_seconds IS NULL
  AND i.created_at < TIMESTAMPTZ '{{window_start}}'
  AND NOT EXISTS (SELECT 1 FROM used u
                  WHERE u.cluster = i.cluster AND u.ns = i.ns AND u.index_name = i.index_name)
ORDER BY i.cluster, i.ns, i.index_name;
```

**Explanation.** The counters are cumulative and per member, so use is a difference between consecutive samples of one member's series, never a raw value: an index whose counter is high at the baseline and flat afterwards was used before the window and not in it. When `since` changes the member restarted after the previous sample and the counter began again at zero, so the whole `ops` value is new use; subtracting would give a negative number and hide it. An index counts as used if any member shows use, because reads routed to secondaries never touch the primary's counter. The anti-join keeps everything else, minus the exclusions: unique indexes enforce constraints, TTL indexes exist for deletion, and an index built at or after the window's start has not been watched for the whole window.

**Complexity.** One window sort over the samples and a hash anti-join: O(n log n). At scale, store per-interval use (the delta, already reset-corrected) rather than raw counters, so any window is a sum.

**Dialect notes** (described, not executed). Snowflake and BigQuery: the same `LAG` window and `NOT EXISTS`; `QUALIFY` is not needed. BigQuery's `ROUND` on FLOAT64 is fine here because sizes never land exactly on a half; cast to NUMERIC for money-like values. Spark SQL: `left_anti` join for the anti-join. MySQL 8: window functions exist; `NOT EXISTS` works; the timestamp literal is `TIMESTAMP '…'` without a zone.

**Edge cases built into the data.** An index with a large baseline count and no increase (unused); one used only on a secondary (used); unique (including `_id_`), TTL and built-in-window indexes that look unused (excluded); Hard: a member restart, including an index whose only use came after the restart and is smaller than the old count, and an index built exactly at the window start (excluded); Very Hard: two clusters with the same collections and index names, where an index is used in one and not the other.

**Common mistakes.** Treating any non-zero counter as use; reading only the primary; `last − first` or `max − min` per member, which a restart breaks; `>` instead of `>=` for the build time; forgetting one of the exclusions; matching usage without the cluster; `NOT IN` against a subquery that can contain NULLs (safe here, a habit to avoid); rounding by truncation.

**Follow-up guidance.** (1) Hide the index first (the database can keep a hidden index maintained but unused by the planner, so unhiding is instant), watch the query shapes and latency that used similar fields for a full business cycle, and record the index definition so it can be rebuilt; then drop. (2) An index is redundant when another index has it as a prefix of its keys with compatible sort directions, or when the planner always chooses another index for the same shapes; compare key patterns and plan summaries from the profiler. (3) Store reset-corrected deltas per member per interval in a table partitioned by time; a missed sample merges two intervals, which is harmless for "any use" if the next sample's delta is computed against the last one that arrived. (4) Measure the write overhead (index updates per write, write latency with and without it on a test copy), its memory and disk, and the latency of the rare queries without it; keep it if those reads are critical and the cost is small.

**Rubric anchors.** 2: anti-join right but use taken from raw counters or from the primary only. 3: matches the expected result. 4: also explains a safe drop procedure, redundant indexes and scalable collection.

**Strong signals.** Asks what resets a counter and whether reads go to secondaries before writing SQL; treats the first sample as a baseline. **Red flags.** "Drop everything with a zero counter today"; ignoring the exclusions because "they look unused too".

## MDB-L1-04

**Reference solution**

```python reference
import heapq

def _expiry(value, expire_after):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value + expire_after
    if isinstance(value, list):
        dates = [v for v in value if isinstance(v, int) and not isinstance(v, bool)]
        return min(dates) + expire_after if dates else None
    return None                        # absent (None) or not a date


def ttl_passes(events, expire_after, period, n_passes, cap=None):
    live = {}                          # doc_id -> current expiry (None: never expires)
    heap = []                          # (expiry, doc_id); entries may be stale
    out = []
    i, n = 0, len(events)
    for p in range(1, n_passes + 1):
        now = p * period
        while i < n and events[i][0] <= now:
            _, op, doc, value = events[i]
            i += 1
            if op == 'insert' or (op == 'update' and doc in live):
                exp = _expiry(value, expire_after)
                live[doc] = exp
                if exp is not None:
                    heapq.heappush(heap, (exp, doc))
            elif op == 'delete':
                live.pop(doc, None)
        gone = []
        while heap and heap[0][0] <= now and (cap is None or len(gone) < cap):
            exp, doc = heapq.heappop(heap)
            if doc in live and live[doc] == exp:      # otherwise a later write replaced this entry
                del live[doc]
                gone.append(doc)
        gone.sort()
        out.append(gone)
    return out
```

**Explanation.** The simulation is a merge of two ordered streams, writes and passes. A dict holds every live document's current expiry; a min-heap holds candidate `(expiry, doc_id)` entries. Updates never search the heap: they push a new entry, and the old one becomes stale. When a pass pops an entry, it is acted on only if the document is still live with exactly that expiry, which covers updates, removed fields, application deletes and documents already removed; an id inserted again after removal is a new dict entry, and an old entry that happens to carry the same expiry would be due at the same time anyway. Because the heap is ordered by `(expiry, doc_id)`, the cap (Very Hard) takes the earliest expiries first with the doc_id tie-break for free, and documents left behind stay in the heap for the next pass. Stale entries popped do not count against the cap.

**Complexity.** O((E + D) log H): each write pushes at most one entry and each entry is popped at most once; passes cost nothing beyond their pops. Memory is O(entries pushed) in the worst case. The timing test (200 000 writes, about 5 000 passes, tens of thousands of live documents) runs in about 0.7 s in CPython; rescanning the live documents at every pass took about 35 s.

**Dialect notes** (described, not executed). Java: `PriorityQueue<long[]>` with a comparator on (expiry, id) and a `HashMap<Long, Long>`; C++: `priority_queue` with `greater<>` over pairs. In SQL the same question is a set query per pass (`WHERE expiry <= pass_time`) over the documents' state as of that pass, which is how a batch replay would be written; the heap is what makes the online version cheap.

**Edge cases built into the tests.** Expiry exactly at a pass time (deleted) and one second later (next pass); an update moving the date later or earlier; a field removed and set again; writes to a document a pass already removed; an application delete; empty passes; Hard: a write at exactly a pass time (applied first), non-date values, an id inserted again after removal; Very Hard: the cap with tied expiries, arrays of dates and an empty array, and a document waiting behind the cap that an update rescues.

**Common mistakes.** Scanning every live document per pass (fails the timing test); removing entries from the heap with `list.remove` (O(n)); trusting a popped entry without checking it is current; letting an update recreate a document that is gone; applying a write at exactly T after the pass; `<` instead of `<=`; counting stale pops against the cap; returning unsorted ids.

**Follow-up guidance.** (1) In the worst case one entry per write; rebuild (re-heapify from the dict) when stale entries exceed, say, twice the live count, which keeps memory O(live) amortised. (2) Everything due at once means one huge pass: deletions compete with the application's writes and replicate to every member; real systems delete in batches with limits per pass, so spread the load by staggering the dates on load, or by deleting in throttled batches yourself. (3) A shorter period means more frequent index scans and more, smaller deletion batches; for correctness, reads should filter on the date (`expireAt > now`) rather than rely on deletion timing. (4) If each member deleted on its own, members would diverge; in the model public documentation describes, the primary performs the deletes and they replicate through the oplog like any other write, so secondaries apply them in order.

**Rubric anchors.** 2: correct rules but a scan per pass, or misses stale entries after updates. 3: all tests pass with a lazily invalidated heap. 4: also bounds heap growth and discusses bulk expiry and replication.

**Strong signals.** Asks what happens to writes aimed at already-removed documents and at exactly T; explains why stale entries are safe. **Red flags.** Sorting all documents every pass; mutating a heap entry in place.

## MDB-L1-05

**Reference solution**

```python reference
import heapq
from bisect import bisect_left


def _tf_in(plist, doc):
    i = bisect_left(plist, (doc, 0))
    if i < len(plist) and plist[i][0] == doc:
        return plist[i][1]
    return 0


def search(postings, queries, k, deleted=None):
    gone = deleted or set()
    results = []
    for query in queries:
        required = {t for t in query if not t.startswith('-')}
        excluded = {t[1:] for t in query if t.startswith('-')}
        if not required or any(t not in postings for t in required):
            results.append([])
            continue
        lists = sorted((postings[t] for t in required), key=len)
        scores = {doc: tf for doc, tf in lists[0] if doc not in gone}
        for plist in lists[1:]:
            nxt = {}
            for doc, score in scores.items():
                tf = _tf_in(plist, doc)
                if tf:
                    nxt[doc] = score + tf
            scores = nxt
            if not scores:
                break
        for t in excluded:
            plist = postings.get(t)
            if plist:
                scores = {d: s for d, s in scores.items() if not _tf_in(plist, d)}
        top = heapq.nsmallest(k, scores.items(), key=lambda e: (-e[1], e[0]))
        results.append([(doc, score) for doc, score in top])
    return results
```

**Explanation.** Every match is in the shortest required list, so it seeds the candidates (minus deleted documents); each longer list then filters them. Because each list is sorted, membership is a binary search, so a query costs O(s · Σ log Lᵢ) where s is the shortest list's length; a two-pointer merge, O(Σ Lᵢ), is equally acceptable and is what the topic names. Distinct required terms come from a set, so a repeated term counts once; a required term with no list ends the query at once. Excluded terms (Very Hard) remove candidates afterwards, and a query with no required term returns nothing rather than "everything". `nsmallest` with the key `(-score, doc_id)` gives the top k with the tie-break without sorting every match.

**Complexity.** Per query O(s · t · log L) for the bisect version, or O(Σ Lᵢ) for a linear merge, plus O(m log k) for the top k over m matches. The timing test (300 000 documents, 1.3 million postings, 400 queries) runs in about 0.25 s in CPython; checking every document for every query took about 80 s.

**Dialect notes** (described, not executed). Java: posting lists as `int[]` pairs with `Arrays.binarySearch`; C++: `std::lower_bound`; both make galloping (exponential then binary search) easy. In SQL this is a self-join of a `postings(term, doc_id, tf)` table: `GROUP BY doc_id HAVING COUNT(DISTINCT term) = <number of required terms>` with `SUM(tf)`, which an engine evaluates by hashing rather than by merging sorted lists.

**Edge cases built into the tests.** Ties on score broken by doc_id; k larger than the number of matches; a term absent from the index; terms that never co-occur; an empty list of queries; Hard: a deleted document that would otherwise be first, and a repeated term; Very Hard: excluded terms, a query of excluded terms only, an excluded term absent from the index, and a term both required and excluded.

**Common mistakes.** Scanning every document per query (fails the timing test); starting from the first term instead of the shortest; summing tf twice for a repeated term; returning deleted documents; treating an absent required term as "no constraint"; a query of only excluded terms returning the whole collection; sorting by score only, without the doc_id tie-break; returning more than k.

**Follow-up guidance.** (1) A linear merge costs O(m + n); binary search per candidate costs O(m log n); galloping costs O(m log(n/m)) and is the usual choice for very unequal lengths. (2) Store positions in each posting and, after intersecting documents, check that the positions line up (position of the second word = position of the first + 1). (3) Deleted entries cost every query that walks them; rewrite (merge) a list or segment when its deleted fraction passes a threshold, trading write amplification for query speed. (4) Each shard returns its own top k with scores (exact here because the score is per document and needs no global statistics); a coordinator merges them with a heap; with collection-wide statistics such as document frequency, shards need those statistics too or the scores are only approximately comparable.

**Rubric anchors.** 2: correct results but scans every document, or misses the tie-break or deletions. 3: all tests pass with an intersection that starts from the shortest list. 4: also explains galloping versus merging, phrase positions and distributed top k.

**Strong signals.** Starts from the shortest list without prompting; asks how deleted documents are represented; states complexity in posting-list lengths. **Red flags.** Converting every posting list in the index to a set per query; "just use a database".
