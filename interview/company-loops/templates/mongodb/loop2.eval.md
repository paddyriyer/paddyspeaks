# MongoDB · Loop 2 — evaluator notes (hidden from candidates)

## MDB-L2-01

**Reference solution**

```python reference
from collections import defaultdict


def match_subscriptions(subscriptions, events):
    postings = defaultdict(list)       # (field, value) -> subscriptions with a clause it satisfies
    missing_ok = defaultdict(list)     # field -> subscriptions whose clause accepts a missing field
    need = {}                          # sub_id -> number of clauses
    always = []                        # empty filters match every event
    for sid, flt in subscriptions:
        need[sid] = len(flt)
        if not flt:
            always.append(sid)
        for field, cond in flt.items():
            values = set(cond["$in"]) if isinstance(cond, dict) else {cond}
            for v in values:           # a set: a value listed twice counts once
                postings[(field, v)].append(sid)
            if None in values:
                missing_ok[field].append(sid)
    always.sort()
    out = []
    for ev in events:
        hits = defaultdict(int)
        for field, v in ev.items():
            for sid in postings.get((field, v), ()):
                hits[sid] += 1
        for field, sids in missing_ok.items():
            if field not in ev:
                for sid in sids:
                    hits[sid] += 1
        matched = [sid for sid, h in hits.items() if h == need[sid]]
        matched += always
        matched.sort()
        out.append(matched)
    return out
```

**Explanation.** This is the counting algorithm used for publish/subscribe matching. Each clause of each subscription is posted under every `(field, value)` pair that satisfies it, so a `$in` clause is posted once per distinct value. For an event, each of its `(field, value)` pairs looks up its posting list and adds one hit to every subscription on it. A field has one value in an event, so a clause can be hit at most once, provided `$in` values are deduplicated first. A subscription matches when its hits equal its number of clauses. Two kinds of match have no pair to look up: empty filters, which match everything and are appended directly, and clauses that accept a missing field (`None` at Very Hard), which are kept in a per-field list and credited when the event lacks that field. An explicit `None` value in the event is found through the ordinary posting `(field, None)`. Python's `(field, 7)` and `(field, '7')` are different dict keys, which gives the strict typing for free.

**Complexity.** Building the index is O(total clause values). Each event costs O(fields + postings touched + matches · log matches), plus one pass over the fields that have null-tolerant clauses. Testing every subscription is O(events · subscriptions · clauses): about 60 million filter checks in the timing test, which takes around 15 s in CPython against about 0.3 s for the reference.

**Dialect notes.** In Java or Go, use a hash map from a composite key (field plus a typed value) to an int array, and a reusable int array of hit counts indexed by a dense subscription number, reset only for the entries touched, which avoids a hash map per event. Watch value typing: a key built by string concatenation makes `7` equal `'7'`. In a stream processor, the index is broadcast state and events are matched locally. A SQL formulation (join event pairs to a clause table, group by subscription, `HAVING count(*) = clauses`) is correct and set-based but slow per event. Not executed here.

**Edge cases built into the tests.** An empty filter matching every event including deletes; a filter where only one of two clauses holds; a clause on a field the event lacks; the integer and the string `'7'`; several subscriptions sharing one pair, returned in ascending order; an event with no match; no events; no subscriptions; (Hard) `$in` with any listed value, a value listed twice, an empty `$in`; (Very Hard) `None` matching a missing field and an explicit null, not a present value, `$in` with `None`, and a null-tolerant clause that still needs its other clauses.

**Common mistakes.** Requiring one clause instead of all; forgetting empty filters (they never receive a hit); double counting a `$in` value listed twice, so a subscription with two clauses matches when only one holds; using `ev.get(field) == value`, which makes a missing field equal `None` at levels where `None` should never match, and conversely missing the missing-field case at Very Hard; returning ids in input order; intersecting Python sets of subscriptions per clause, which is correct but pays for the largest posting list every time.

**Follow-up guidance.** (1) Counting pays for every posting on a common pair, such as `operationType = 'update'`. Index each subscription under only its most selective clause (fewest subscriptions, or a value-frequency estimate) and verify the rest on a hit; subscriptions with only common clauses form a small group checked per event. (2) Add and remove postings incrementally, keep a version per subscription, and publish changes atomically per batch (copy-on-write of the affected posting lists, or apply changes between events). (3) Ranges need an interval structure per field: a sorted list of thresholds with binary search for `>`/`<`, or an interval tree, then feed the hits into the same counter. (4) Store the resume token with the last fully fanned-out event; after a restart, resume from it and deduplicate by token. If the token has left the oplog, the stream cannot resume; subscribers must re-read current state, and the service needs an alert on oplog window versus downtime (this exercise's rule; check current docs).

**Rubric anchors.** 2: a nested loop that is correct on small inputs, or an index that misses empty filters or double-counts `$in`. 3: all tests pass with an inverted index and counting, with a complexity argument in postings touched. 4: also handles the null rule cleanly, explains the cost of skewed clauses and how to anchor on the most selective clause, and gives a sound resume-token answer.

**Strong signals.** Asks whether `7` and `'7'` are equal and whether missing fields can match; notices that empty filters receive no hits. **Red flags.** "Just loop over the subscriptions, it is only 20 000"; converting every value to a string for the key.

## MDB-L2-02

**Reference solution**

```python reference
from bisect import bisect_right


def find_orphans(chunks, documents, migrations=None):
    owner = {lo: shard for lo, _hi, shard in chunks}      # a chunk is named by its lower bound
    for lo, to_shard, outcome in migrations or ():
        if outcome == "committed":
            owner[lo] = to_shard
    lows = sorted(lo for lo in owner if lo is not None)
    owners = [owner[lo] for lo in lows]
    lowest = owner[None]                                  # the chunk that starts at the lowest key
    out = []
    for shard, doc_id, key in documents:
        i = bisect_right(lows, key)                       # chunks whose lower bound is <= key
        if (owners[i - 1] if i else lowest) != shard:
            out.append((shard, doc_id))
    out.sort()
    return out
```

**Explanation.** The chunks partition the key space, so a chunk is identified by its lower bound and the upper bounds are redundant for lookup. Ownership is a dict from lower bound to shard; committed migrations overwrite it in log order, and aborted ones are skipped. The lower bounds other than the lowest chunk's `None` are sorted once. For a key, `bisect_right` counts the bounds that are at most the key, so a key equal to a bound lands in the chunk that starts there (the inclusive lower bound) and a key equal to a chunk's upper bound lands in the next chunk. A count of zero means the lowest chunk. Python compares integers and tuples natively, so compound keys need no extra code, and `None` is never compared with a key. Copies on two shards are separate document rows, and only the one on the non-owner differs from the owner.

**Complexity.** O(c log c) to sort the bounds, O(m) for m migrations, O(n log c) for the documents and O(k log k) to sort k orphans. The timing test (20 000 chunks, 200 000 documents, 5 000 migrations) runs in about 0.1–0.3 s in CPython. Checking every chunk per document is about 2 billion comparisons and does not finish within the limit; scanning the chunk list per migration adds another 100 million.

**Dialect notes.** In Java, a `TreeMap` keyed by the lower bound with `floorEntry(key)` does the lookup, with a comparator for compound keys and a sentinel for the lowest bound. In SQL, the same lookup is a range join (`doc.key >= chunk.min AND (chunk.max IS NULL OR doc.key < chunk.max)`), which needs a range-aware join or an index on the bounds to avoid a nested loop; in Spark, sort both sides by key and use a sorted merge or broadcast the bounds and binary-search in a UDF. Not executed here.

**Edge cases built into the tests.** A key equal to a lower bound and to an upper bound; keys in the lowest and highest chunks, including negative keys; one document on two shards; a shard with no chunks; a single chunk covering everything; no orphans; chunks out of order with the output sorted by shard then id; (Hard) a committed and an aborted migration, a chunk moved away and back, a migration of the lowest chunk, an empty log; (Very Hard) compound keys where the region decides and where the number decides at an equal region.

**Common mistakes.** `bisect_left`, which puts a key equal to a bound in the previous chunk; comparing `None` with an int (a `TypeError` in Python 3) or replacing it with 0, which breaks negative keys; applying aborted migrations; looking up migrations by scanning chunks; reporting a document id once even though it is orphaned on one shard and owned on another; sorting by id only; comparing compound keys as strings.

**Follow-up guidance.** (1) Do it per shard: each shard knows the routing table (small) and scans its own documents by shard-key index, emitting orphan ranges rather than documents; only counts and ranges travel. (2) A migration committing mid-scan changes ownership for one range; snapshot the routing table version at the start, re-check orphan ranges against the newest version before cleanup, and never delete a range the shard currently owns. (3) Range deletes match how documents arrived (a whole chunk at a time) and are cheap with a shard-key index; the donor must not delete until the migration has committed and queries that may still read the old ownership have finished (this exercise's rule; check current docs). (4) Replay splits and merges as events too; a chunk is then identified by its range and a version, and ownership is computed as of a point in the log.

**Rubric anchors.** 2: linear scans per document, or wrong boundary handling. 3: all tests pass with sorted bounds and binary search (or a sorted merge), migrations applied through a dict. 4: also explains why the upper bounds are redundant, handles `None` without hacks, and gives credible answers on concurrent migrations and safe cleanup.

**Strong signals.** Asks whether ranges are half-open before coding; notices that the lowest chunk needs special handling. **Red flags.** Using 0 or a large constant as the lowest bound; ignoring the aborted outcome.

## MDB-L2-03

**Reference solution** (the fixed normaliser)

```python reference
import json

LOGICAL = ("$and", "$or", "$nor")
UNITS = (("us", 1), ("ms", 1000), ("s", 1000000))     # "us" and "ms" before "s"


def _micros(dur):
    for unit, factor in UNITS:
        if dur.endswith(unit):
            return int(dur[:-len(unit)]) * factor
    raise ValueError("unknown duration unit: " + dur)


def _shape(v, logical=False):
    if isinstance(v, dict):
        return {k: _shape(x, k in LOGICAL) for k, x in v.items()
                if not (k == "$options" and "$regex" in v)}        # options belong to the regex literal
    if isinstance(v, list) and logical:
        return [_shape(x) for x in v]                              # one filter per branch, in order
    return "?"                                                     # any other list is one literal


def summarise_shapes(lines):
    groups = {}         # (ns, shape) -> totals
    skipped = 0
    for line in lines:
        try:
            entry = json.loads(line)
        except ValueError:
            skipped += 1
            continue
        if "truncated" in entry:                                   # the server shortened this entry
            skipped += 1
            continue
        shape = _shape(entry["filter"])
        key = (entry["ns"], json.dumps(shape, sort_keys=True, separators=(",", ":")))
        us = _micros(entry["dur"])
        g = groups.setdefault(key, {"count": 0, "total_us": 0, "max_us": 0})
        g["count"] += 1
        g["total_us"] += us
        g["max_us"] = max(g["max_us"], us)
    shapes = [{"ns": ns, "shape": shape, **g} for (ns, shape), g in groups.items()]
    shapes.sort(key=lambda s: (-s["total_us"], s["ns"], s["shape"]))
    return {"shapes": shapes, "skipped": skipped}
```

**The planted bugs, their symptoms and their fixes.**
1. **Microseconds read as seconds.** `_micros` checks `endswith("ms")`, then `endswith("s")`, and `"850us"` ends with `"s"`, so it becomes 850 000 000 µs. Symptom: the fastest queries appear as the slowest in the report. Fix: check `us` and `ms` before `s`, or parse the number and unit explicitly.
2. **Every list normalised element by element.** `$in: ["a", "b"]` becomes `["?","?"]` and `$in: ["a", "b", "c"]` becomes `["?","?","?"]`. Symptom: one query split into a shape per list length. Fix: only `$and`/`$or`/`$nor` values are lists of filters; any other list is one literal, `"?"`.
3. **Keys sorted only at the top level.** `dict(sorted(shape.items()))` orders the top-level fields, but `{"$gte", "$lt"}` and `{"$lt", "$gte"}` inside a field stay in driver order. Symptom: the same range query appears twice. Fix: `json.dumps(shape, sort_keys=True, …)`.
4. **`$options` kept beside `$regex`.** Symptom: case-insensitive and case-sensitive searches are separate shapes. Fix: drop `$options` in a dict that has `$regex`.
5. **Entries marked truncated are not skipped.** The code only skips lines that fail to parse. Symptom: shapes with oddly short filters that match nothing in the code, and a `skipped` count that is too low. Fix: skip and count entries with a `"truncated"` key.

Each bug has its own check (microseconds, `$in` lengths, operator order inside a field, regex options, a truncated entry), and each of those checks passes once its own bug is fixed, whatever the state of the others. The checks for seconds, top-level order, cut-off lines, namespaces, `$or` order, tie ordering and an empty log pass on the original code; they guard against over-correcting, for example sorting `$or` branches or merging namespaces.

**Explanation.** A query shape is a canonical form: the structure of the filter with literals removed. Two decisions make it canonical. What is a literal (scalars, and every list except the branch lists of logical operators, plus regex options), and what order things are written in (keys sorted at every level, branches kept in order because their order is part of how the query was written in this exercise). Entries the server shortened cannot be shaped reliably, so they are counted, not guessed at.

**Complexity.** O(total size of the lines). The timing test (60 000 lines) runs in under a second in CPython, dominated by `json.loads` and `json.dumps`.

**Dialect notes.** In SQL engines with JSON functions, the same normalisation is awkward to write recursively; it usually runs in a UDF or in the ingestion job, and the shape string (or a hash of it) is stored as a column. A database's own query statistics feature may compute shapes server-side with its own rules (for example typed placeholders), so a hand-built normaliser must say which rules it follows; check current docs. Not executed here.

**Edge cases built into the tests.** Microseconds and seconds; `$in` lists of two and three values; range operators in both orders; top-level fields in both orders; `$regex` with and without `$options`; an entry marked truncated; a line cut off mid-way; one filter on two namespaces; `$or` branches in both orders (two shapes); a tie on total time; an empty log.

**Common mistakes.** Fixing the duration by `rstrip` tricks that break `ms`; sorting `$or` branches too; collapsing every list including `$and` branches; dropping `$options` everywhere rather than beside `$regex`; catching every exception so that a bad duration silently becomes a skipped line; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Add the sort specification and projection shape (field names, not values) to the key, and the hinted index if any; leave out limits and literal values. (2) A typed literal object such as an extended-JSON date is a dict, and these rules would walk into it; treat known typed-literal wrappers as literals (`"?"`), or a date comparison splits by how the driver wrote it. (3) Report truncated entries per namespace with their count and total time, so the 40% is visible, and ask for a higher log size limit or the server's own statistics. (4) Aggregate per window and shape in a stream, keyed by a hash of the canonical string plus a normaliser version; when the rules change, keep both versions for a transition period and map old to new.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed with each one explained by its symptom. 4: also states the canonical-form rules explicitly, adds a regression test per bug, and has sound answers on typed literals and normaliser versioning.

**Strong signals.** Reproduces the microsecond bug with one line before touching code; notices that the `$or` order check is a guard against over-fixing. **Red flags.** A broad `except Exception` added "to be safe"; sorting every list.

## MDB-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Where reads run.** Add one or two dedicated analytics members to each replica set (each shard, if sharded): priority 0 so they can never become primary, tagged (for example `workload: analytics`), and normally non-voting, so their lag or failure never affects elections or the majority needed for `w: "majority"` writes. Sized for scans (more memory, separate disks), since their cache holds different data from the primary's.
- **Routing.** Dashboards and analysts use a separate connection string or client with read preference `secondary` and the analytics tag set, with no fallback to untagged members: if no analytics member is available, analytics fails or waits rather than landing on the electable secondaries or the primary. The application keeps `primary` (or its own preferences) and never carries the analytics tag.
- **Freshness.** Replication lag per analytics member is measured from the replica set status (the last applied operation time against the primary's), exported as a metric, and shown on every dashboard as "data as of". A maximum-staleness setting can stop reads from a member that is too far behind; the dashboard then shows stale or unavailable explicitly. The {{freshness}} target is an alert threshold, not a promise the database makes (this exercise's rule; check current docs).
- **Indexes.** Indexes replicate to every member, so each analytics index costs write work and cache on the primary. Prefer a few compound indexes that serve dashboards and are cheap to maintain; for ad hoc questions, scan on the analytics member under time limits rather than adding indexes.
- **Summaries.** Pre-aggregate the dashboards: hourly rollups by region, warehouse and product written by a scheduled pipeline. Writes from `$merge` go to the primary, so the summaries are small, written in batches off-peak or incrementally by time bucket, and kept in their own collection. For {{report_window}} at {{data_size}}, the scan of raw orders happens once per bucket, not once per dashboard view.
- **Protection.** Time limits on every analytical operation, a concurrency cap for ad hoc pipelines (a small pool or queue), `allowDiskUse` only where approved, and killing runaway operations by tag or comment. Monitoring: primary latency, cache eviction and replication lag of the electable secondaries, which must not move when analytics runs.
- **Failure.** If an analytics member fails, dashboards show stale or unavailable; nothing falls back to the primary. An election does not affect analytics members' role; they keep replicating from the new primary. Long-running pipelines may be interrupted and must be safe to rerun (summaries keyed by bucket, overwritten).
- **When to copy out.** When analytics needs joins with other systems, many indexes the application does not need, or retention beyond the operational window, feed an analytical store from a change stream or a scheduled export, with a full resync path.

**Competing designs to accept.** Hidden members for analytics (strong isolation, but drivers do not route to them, so a separate direct connection is needed, and they cannot serve as normal secondaries); a separate analytical copy fed by change streams from day one (accept with a sound resync and freshness story); a sharded cluster's own analytics members per shard. Each needs a clear routing rule and freshness measure.

**Bottlenecks and failure modes.** Read preferences that fall back to the primary; analytics on electable secondaries that become primary in a failover; voting analytics members whose lag slows majority writes when another member is down; analytics-only indexes slowing the primary's writes; `$merge` output written to the primary at peak; unbounded ad hoc pipelines; dashboards that hide staleness; a change-stream consumer that falls off the oplog window.

**Incident guidance.** (This template has no Production Reality Check; use these if the candidate is strong.) A bulk import lags the analytics member by 20 minutes: dashboards show "as of" and a stale banner; staleness limits stop reads instead of rerouting them; consider pausing summary refreshes until lag recovers. An analyst's pipeline exhausts the analytics member's disk with a spill: time limits and disk-use approval, then a summary or a copy for that question.

**Follow-up guidance.** (1) The index costs write work and cache on every member, including the primary; prefer a summary collection, a scan on the analytics member under a time limit, or the question in an analytical copy. (2) Show "as of" and a staleness banner; with a staleness limit, reads fail rather than move; do not reroute to the primary. (3) Hourly or daily buckets by the dimensions dashboards filter on, updated incrementally for the newest bucket and recomputed for late data within a window, stored in a separate collection or the analytical store. (4) When joins across systems, history and many analytical indexes dominate; feed it from a change stream with a resume token, an alert on oplog window versus consumer lag, and a full resync procedure. (5) Primary p99 latency, cache eviction rate, queued operations, replication lag of electable members, and the analytics pool's running operations.

**Rubric anchors.** 2: "send analytics to a secondary" with no tags, fallback rules or lag measure; indexes added freely. 3: tagged priority-0 analytics members, no fallback to the primary, lag measured and shown, summaries with a defined grain, limits on ad hoc queries. 4: also explains voting and majority-write effects, the replication of indexes and `$merge` writes to the primary, and a reasoned trigger for an analytical copy with resync.

**Strong signals.** Asks what the analytics members share with the primary; insists that failure modes degrade analytics, never the application. **Red flags.** `secondaryPreferred` for heavy scans; "add the indexes only on the analytics node".

## MDB-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Collection.** Each cluster's agent or the service's own profiler pipeline emits slow-operation records already normalised to shapes; literals are replaced at the source, and a validation stage rejects any record whose shape contains a literal (tested with planted values, including inside `$in` and regexes). Records carry cluster, namespace, shape hash and text, plan summary, keys and documents examined, documents returned, duration, in-memory sort flag and time.
- **Aggregation.** A stream or micro-batch job builds an hourly table keyed by `(cluster, namespace, shape, hour)`: executions, sums and percentiles (sketches) of duration, examined/returned ratios, in-memory sort count. At {{shape_events}} records a day from {{clusters}} clusters this table is far smaller than the raw stream; raw records are kept briefly for debugging only.
- **Index metadata.** A daily (and on-change) snapshot of each cluster's indexes, with build and drop events, as a slowly changing table.
- **Candidates.** For each `(cluster, namespace)`, shapes over the last {{lookback}} with a high examined/returned ratio, collection scans or in-memory sorts are turned into candidate indexes using a stated rule (equality fields, then sort fields, then range fields). Candidates are merged when one is a prefix of another, and dropped when an existing index has the same leading fields. Each candidate is scored by the time it would save (executions × excess examined work) against its estimated write cost (the collection's write rate and index size).
- **Suggestion entity.** A suggestion has a stable id (cluster, namespace, normalised key pattern), a state history (proposed, shown, dismissed, accepted, built, dropped, superseded), the shapes it serves and the evidence at the time it was shown. A dismissed suggestion is only shown again if its evidence grows past a stated threshold, for example twice the time saved.
- **Acceptance and impact.** An index build event whose key pattern matches a suggestion marks it built, whether or not the customer clicked. Impact compares the served shapes over equal windows before and after (skipping the build period), per execution: documents examined per returned, duration percentiles, in-memory sorts, plus the collection's write latency and index size. Shapes on other collections of the same cluster act as a control for cluster-wide changes such as a tier upgrade (difference in differences). An index that is never used after a week is flagged.
- **Outputs.** Product: acceptance rate by suggestion type, measured benefit distributions, false positives (built and unused, or built and harmful to writes). Customer: their own suggestions with evidence and, after a build, a before/after card. Every query is filtered by the customer's own clusters, enforced in the serving layer.

**Competing designs to accept.** Batch-only daily jobs over a lakehouse (fine if the hourly table exists); computing suggestions on the cluster side and only shipping suggestions and aggregates (strong for privacy and volume, harder for global analysis); a what-if evaluation using the database's plan explainer on a sample of shapes (accept with its cost and limits).

**Bottlenecks and failure modes.** Raw record volume at {{shape_events}} a day; shape strings that are large or unbounded (hash plus a sample); literals leaking through unusual operators; duplicate suggestions for overlapping key patterns; judging impact on latency alone when volume changed; attributing a tier upgrade or a code release to the index; customers who build the index by hand with a different field order; never-used indexes that only add write cost.

**Incident guidance.** (This template has no Production Reality Check; use these if the candidate is strong.) A release of the shape normaliser changes shape hashes: every suggestion's evidence resets and dismissed suggestions reappear; version the normaliser and map old to new hashes. A literal is found in stored shapes from one driver's encoding: stop the stream for that source, purge affected records, add a test for the encoding, and report it as a privacy incident.

**Follow-up guidance.** (1) `{status}` is a prefix of `{status, createdAt}`, so the compound one serves both shapes; show one suggestion with both shapes as evidence, and mark the other superseded. (2) Use the control shapes on the same cluster and the change in executions; a tier upgrade improves everything, an index only its shapes. (3) The collection's write latency and the index's size and use after the build; feed a write-cost penalty back into scoring for similar collections. (4) The raw stream and the shape aggregation; pre-aggregate per cluster per hour on the cluster side, with sketches for percentiles.

**Rubric anchors.** 2: a dashboard of slow queries with suggestions recomputed daily and "accepted" counted as success. 3: shape-only collection, hourly aggregates, a candidate rule checked against existing indexes, suggestions with a lifecycle, impact measured per execution before and after. 4: also a control for workload changes, write-cost accounting, dismissal memory with a re-show rule, normaliser versioning and tested literal exclusion.

**Strong signals.** Separates "accepted" from "built" from "helped"; asks how the index was built and whether its field order matches. **Red flags.** Collecting raw queries "to improve suggestions"; measuring success by acceptance rate.
