# Cloudflare · Loop 2 — evaluator notes (hidden from candidates)

## CFX-L2-01

**Reference solution**

```python reference
from bisect import bisect_left


def ring_hash(s):
    h = 2166136261
    for b in s.encode("utf-8"):
        h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def _build(origins, vnodes, skip=None):
    pts = []
    for name, weight in origins:
        if name == skip:
            continue
        for i in range(weight * vnodes):
            pts.append((ring_hash(name + "#" + str(i)), name, i))
    pts.sort()                                   # (position, name, index)
    return [p[0] for p in pts], [p[1] for p in pts]


def _route(pos, owner, hashes):
    n = len(pos)
    out = []
    for h in hashes:
        j = bisect_left(pos, h)                  # first position >= h
        out.append(owner[j] if j < n else owner[0])
    return out


def route_keys(origins, keys, vnodes, remove=None, detail=False):
    pos, owner = _build(origins, vnodes)
    if not pos:
        return None
    hashes = [ring_hash(k) for k in keys]
    names = _route(pos, owner, hashes)
    if remove is None:
        return names
    pos2, owner2 = _build(origins, vnodes, skip=remove)
    if not pos2:
        return None
    after = _route(pos2, owner2, hashes)
    moved, to = 0, {}
    for a, b in zip(names, after):
        if a != b:
            moved += 1
            to[b] = to.get(b, 0) + 1
    return (names, moved, to) if detail else (names, moved)
```

**Explanation.** Build every point once as `(position, name, index)` and sort; tuple order is exactly the ring order the statement defines, including the rare position tie. Keep the positions in their own list so `bisect_left` finds the first position greater than or equal to the key's hash; an index equal to the length wraps to the first point. Hash each key once and reuse the hash for the ring without the removed origin. Removing an origin deletes only its points, so a key on any other origin keeps its point and cannot move; the keys that move are exactly the removed origin's, and each goes to the next surviving point clockwise. A strong candidate may compute `moved` as the count of keys on the removed origin and still needs the second routing for `to`. A pool without points returns None before anything else; so does a removal that leaves no points.

**Complexity.** O(V log V) to build and sort V = Σ weight·vnodes points, and O(n log V) for n keys, plus hashing cost linear in the total string length. The timing test (40 origins, about 19 000 points, 60 000 keys, with a removal at Hard and Very Hard) runs in about 0.5 s in CPython, most of it in `ring_hash`. Scanning every point for every key is about 10⁹ comparisons and takes well over a minute; a sorted ring searched linearly is still about 6 × 10⁸ steps.

**Dialect notes.** In Java, `TreeMap<Long, String>.ceilingEntry(h)` (falling back to `firstEntry()`) is the idiomatic ring, or a sorted `long[]` with `Arrays.binarySearch`. Keep the hash in a `long` or mask an `int` to unsigned before comparing, or the ring order breaks for positions at or above 2³¹. In Go, `sort.Search`. In Scala, a sorted `Array[Long]` with `java.util.Arrays.binarySearch`. Not executed here.

**Edge cases built into the tests.** A key equal to `name#i` hashes exactly onto that point (inclusive comparison); a key above every point wraps; no keys; one origin; an empty pool and an all-zero-weight pool (None); a weight-0 origin beside live ones; (Hard) removal moving only the removed origin's keys, removal of a name not in the pool (0 moved), removal of the only origin with points (None), repeated keys counted per entry; (Very Hard) the `to` breakdown, an empty dict when nothing moves.

**Common mistakes.** `bisect_right` (exclusive comparison); forgetting the wrap; sorting by position only, so the tie order depends on input order; using Python's `hash()` or `hashlib`; rebuilding or re-hashing per key; returning `[]` instead of None for a pool without points; treating weight as the number of points regardless of `vnodes`; de-duplicating keys before counting moves; returning `moved` as the number of distinct keys.

**Follow-up guidance.** (1) With one point per origin the arcs between points vary wildly, so shares can differ by several times; with v points per origin the relative spread falls roughly as 1/√v. Measure the max/mean ratio of keys or of arc length per origin. (2) Keep the ring in a balanced tree or a sorted structure that supports insert and delete (or rebuild off the request path and swap atomically); a pool change then costs O(weight·vnodes·log V). (3) For a short outage, prefer skipping an unhealthy origin at lookup time (walk clockwise to the next healthy point) over removing it, and add hysteresis so keys do not flap; jump hashing or rendezvous hashing are fair alternatives to discuss. (4) Split the hot key: replicate it to k origins and spread its requests among them, or serve it from the edge cache; bounded-load consistent hashing caps any origin's share.

**Rubric anchors.** 2: a scan per key, or a bisect with the wrong inclusivity or no wrap; several edge tests fail. 3: all tests pass with a sorted ring and binary search. 4: also explains why only the removed origin's keys move, states the complexity including hashing, and answers the virtual-node spread and hot-key follow-ups with numbers.

**Strong signals.** Asks whether the comparison is inclusive and what happens past the last point; hashes each key once. **Red flags.** `hash(key) % len(origins)` defended as equivalent; using Python's process-randomised `hash()`.

## CFX-L2-02

**Reference solution**

```python reference
def range_peaks(samples, ranges, with_time=False):
    if not samples:
        return [None] * len(ranges)
    lo = min(s for s, _ in samples)
    hi = max(s for s, _ in samples)
    n = hi - lo + 1
    vals = [0] * n
    for s, c in samples:                      # sums repeated seconds; missing seconds stay 0
        vals[s - lo] += c
    # One integer per second: a larger value wins, then the earlier second.
    level = [v * n + (n - 1 - i) for i, v in enumerate(vals)]
    table = [level]
    k = 1
    while (1 << k) <= n:
        prev, half = table[-1], 1 << (k - 1)
        table.append([a if a > b else b for a, b in zip(prev, prev[half:])])
        k += 1
    out = []
    for a, b in ranges:
        a, b = max(a, lo), min(b, hi)
        if a > b:
            out.append(None)
            continue
        i, j = a - lo, b - lo
        k = (j - i + 1).bit_length() - 1
        row = table[k]
        x, y = row[i], row[j - (1 << k) + 1]
        best = x if x > y else y
        out.append((best // n, lo + n - 1 - best % n) if with_time else best // n)
    return out
```

**Explanation.** Turn the rows into a dense array over every second from the first to the last (summing repeated seconds, zero for missing ones). Encode each second as `value · n + (n − 1 − index)`: a larger value always wins, and among equal values the smaller index has the larger code, so the maximum code is the earliest peak. Level k of the sparse table holds the maximum of each window of 2ᵏ seconds, built from two windows of level k − 1. A range of length L is covered by two windows of length 2^⌊log₂ L⌋ that start at its first second and end at its last; they overlap, which is harmless for a maximum. Clipping happens before the lookup, and a range with nothing left is None. A tuple `(value, -second)` is an equally correct encoding and only somewhat slower.

**Complexity.** O(n log n) time and memory to build, O(1) per range. The timing test (150 000 seconds, 100 000 ranges averaging tens of thousands of seconds) runs in about 0.6 s in CPython. `max(vals[a:b+1])` per range reads about 5 × 10⁹ values and takes well over a minute even though `max` runs in C. A segment tree (O(log n) per range) also passes, in a few seconds; √n blocks are borderline.

**Dialect notes.** In SQL the dense series is a `generate_series` left-joined to the rows, and an arbitrary-range maximum is a join on `second BETWEEN a AND b` with `MAX`, or a window `MAX(...) OVER (ORDER BY second ROWS BETWEEN ...)` when every range has the same length. Analytical engines answer a dashboard by pre-aggregating to coarser resolutions instead. In Java or C++ the sparse table is an `int[K][n]` (or `long` for the encoded value) with `Integer.numberOfLeadingZeros` for the level. Not executed here.

**Edge cases built into the tests.** A one-second range; the whole series; ranges clipped at both ends; ranges entirely outside the series and a reversed range (None); the same peak twice, earliest second reported; ranges of 8 and 9 seconds, where the two halves overlap; a repeated range; no rows (all None); no ranges (`[]`); (Very Hard) a range inside a stretch of missing seconds (peak 0 at its first second), several rows for one second added together, rows in any order.

**Common mistakes.** Off-by-one in the level (`bit_length()` rather than `bit_length() − 1`) or in the second window's start; forgetting to clip; returning 0 for an empty range; on ties, keeping the later second because the comparison prefers the right-hand window; at Very Hard, keeping the last row for a second instead of summing, or indexing by row position so missing seconds shift the series; building the table with Python loops of loops so that the build itself is slow.

**Follow-up guidance.** (1) Appending invalidates nothing in a sparse table built over the past, but adding one second updates log n entries at the end; a segment tree or a Fenwick-style max for appends, or blocks of fixed size with per-block maxima, are fine answers. (2) Prefix sums: totals subtract, maxima do not, which is why the maximum needs a different structure. (3) Use the coarsest resolution whose bucket fits several times in the range; the peak then means the busiest minute or hour, and the dashboard must say so. (4) Precompute per zone at ingestion as part of the rollup, keep only recent seconds hot, and answer older ranges from coarser rollups.

**Rubric anchors.** 2: a scan per range, or a structure with off-by-one errors that fail several edge tests. 3: all tests pass with a sparse table or a segment tree. 4: also explains the overlap argument and the tie encoding, handles the Very Hard rows cleanly, and discusses resolution and streaming credibly.

**Strong signals.** Notes that maximum is idempotent, so overlapping halves are fine; asks what a missing second means. **Red flags.** Averaging per-minute peaks to get a range peak; no complexity estimate before choosing.

## CFX-L2-03

**Reference solution** (the fixed rollup)

```python reference
import ipaddress

CACHED = {"hit", "revalidated", "updating"}
NS_PER_HOUR = 3_600_000_000_000


def _network(ip, memo):
    net = memo.get(ip)
    if net is None:
        addr = ipaddress.ip_address(ip)
        if addr.version == 6:
            net = "6|" + format(int(addr) >> 64, "016x")        # the /64 prefix
        else:
            net = "4|" + str(addr)
        memo[ip] = net
    return net


def zone_rollup(lines):
    seen = set()
    memo = {}
    rows = {}
    for ln in lines:
        if ln["ray"] in seen:                                    # a retried delivery repeats the line
            continue
        seen.add(ln["ray"])
        hour = ln["ts_ns"] // NS_PER_HOUR * 3600                 # integers only
        w = ln["sample_interval"]
        r = rows.get((ln["zone"], hour))
        if r is None:
            r = rows[(ln["zone"], hour)] = [0, 0, 0, set()]
        r[0] += w
        r[1] += ln["bytes"] * w
        if ln["cache_status"] in CACHED:
            r[2] += ln["bytes"] * w
        r[3].add(_network(ln["client_ip"], memo))
    return [[z, h, r[0], r[1], r[2], len(r[3])] for (z, h), r in sorted(rows.items())]
```

**The planted bugs, their symptoms and their fixes.**
1. **De-duplication keyed by `(batch, ray)`.** A retried delivery resends the line in a new batch, so the copy is counted again. Symptom: request counts jump after a delivery is retried. Fix: key by `ray` alone.
2. **Hour from a float division.** `int(ts_ns / 1e9)` rounds: today's epoch in nanoseconds is about 1.76 × 10¹⁸, far beyond 2⁵³, so a float can only represent multiples of 256 ns there, and a line in the last nanoseconds of an hour rounds up into the next one. Symptom: requests near the end of an hour appear in the next hour. Fix: `ts_ns // 3_600_000_000_000 * 3600`.
3. **Bytes not weighted.** Requests and cached bytes are multiplied by the sample interval but total bytes are not. Symptom: cached bytes exceed total bytes on sampled zones. Fix: `bytes * w`.
4. **Cached statuses incomplete.** Only `hit` counts, so `revalidated` and `updating` (served from cache under this exercise's rule) do not. Symptom: the cache ratio by bytes is lower than the customer's own measurements. Fix: the full set.
5. **IPv6 grouped by text.** The first four colon-separated groups are not the /64 when the address is compressed (`2001:db8::5`) or in upper case. Symptom: far more distinct client networks for IPv6-heavy zones. Fix: parse the address (`ipaddress`) and take the top 64 bits.

Each bug has its own check: a line delivered in two batches, a line at the last nanosecond of an hour, two sampled lines, a set of cache statuses, and one /64 written several ways. Each check passes on the original code except for its own bug.

**Explanation.** The rollup is a pure function from a multiset of lines to rows, and every column has a rule: identity by request id; time by integer arithmetic; additive totals weighted by the sampling interval; a fixed status set; a canonical network key. A memo of parsed addresses keeps `ipaddress` affordable.

**Complexity.** O(n) time and O(n) memory for the seen-set and networks. The timing test is 100 000 lines and runs in about 0.6 s, most of it parsing distinct addresses.

**Dialect notes.** In SQL: `SELECT DISTINCT ON (ray)` or `ROW_NUMBER() OVER (PARTITION BY ray)` for de-duplication; `date_trunc('hour', to_timestamp(ts_ns / 1e9))` has the same float problem, so use `ts_ns / 3600000000000` in integer arithmetic (`DIV` in MySQL, integer `/` on `BIGINT` in PostgreSQL); PostgreSQL's `inet` type with `set_masklen(ip::cidr, 64)` (or `network(set_masklen(ip, 64))`) canonicalises IPv6 prefixes, and ClickHouse has `IPv6CIDRToRange`. Spark: `ts_ns div 3600000000000`. Not executed here.

**Edge cases built into the tests.** A repeated line in another batch; the last nanosecond of an hour and the first of the next; sample intervals 10 and 100; every cache status class; one /64 in compressed, full and upper-case forms plus `2001:db8::5` beside `2001:db8:0:0:1::5` (same /64); two IPv4 clients and two zones.

**Common mistakes.** Fixing the float with `round()` (still wrong near the boundary) or `Decimal` (correct but slow); weighting distinct networks by the sample interval; lower-casing IPv6 but still splitting text; de-duplicating by `(zone, ray)` without asking (equivalent here, but the candidate should say why); rewriting the whole function instead of making minimal fixes.

**Follow-up guidance.** (1) Distinct counts do not scale linearly with sampling; estimators exist (for example from how many networks were seen once), but the honest answer is a range or a label that the number is from a sample. (2) Keep ray ids for the retry horizon, partitioned by zone and hour, or a Bloom filter per hour with a stated false-positive rate; a retry after the horizon is counted twice, and the delivery system should bound its retries accordingly. (3) Recompute the affected zone-hour, publish a new version, and show "updated" on the chart; never append a correction row. (4) One pass that emits several group-by keys, or a cube over a few dimensions; sums add across breakdowns, distinct counts do not unless kept as mergeable sketches.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also explains the 2⁵³ limit with numbers, adds a regression test per bug, and answers the sampling and late-data follow-ups convincingly.

**Strong signals.** Reproduces the float problem with a concrete timestamp before fixing it; asks whether distinct counts are weighted. **Red flags.** "Use float64, it is precise enough"; normalising IPv6 with string replacements.

## CFX-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Collection.** Each edge location writes its log lines to a local durable buffer, then ships them to regional collectors that append to a partitioned log keyed by `(job, window)` or by account. Collection never depends on any customer destination. Lines are filtered and field-selected per job as early as possible, so only what the customer asked for travels.
- **Windowing.** Batches are by event time in windows of about {{batch_window}}. A window closes after a grace period; lines later than the grace go to a late file for that window with the next sequence number, not into a silently rewritten file.
- **Files.** Name each file deterministically: `job / date / window-start _ window-end _ seq . gz`. Content is newline-delimited records with the job's fields. A retry re-uploads the same name with the same content, so a duplicate is either an overwrite or visibly the same object. The customer can de-duplicate by request id.
- **Manifests.** For every window, write a manifest (after the data files) listing files, line counts per file, sample rate, configuration version and checksums. The customer can check that the files they have add up to the manifest; a later manifest version records late files.
- **Delivery.** A per-job queue of ready files, and per-destination workers with exponential back-off and jitter, respecting the destination's throttling signals. Concurrency limits per destination stop one slow sink from consuming shared workers. Credentials live in a secrets store and are fetched at upload time.
- **Long outages.** Staged files are kept in the provider's object storage for a bounded period (in this exercise, enough to cover {{outage}} plus margin, or a stated cap). Past the cap, the oldest windows are dropped with a recorded reason, the job's status shows the gap, and the customer is notified. A job failing continuously for a stated period is disabled and the owner told.
- **Customer view.** Job health: last successful delivery, backlog age, error class (auth, not found, throttled), and per-window delivered/expected counts.

**Competing designs to accept.** Streaming per-line push to HTTP destinations with micro-batching (accept with an argument for acknowledgements and back-pressure); a pull model where customers read from a provider-hosted bucket (simpler completeness, different trust model); per-account partitioning instead of per-job (accept if isolation between jobs of one account is addressed).

**Bottlenecks and failure modes.** One dead destination filling a shared buffer; small-file explosion for tiny jobs (make the window adaptive or set a minimum size); late lines rewriting already-delivered files; configuration changes applied mid-window without a recorded boundary; credentials appearing in error logs; retries without jitter synchronising into bursts against a recovering destination.

**Follow-up guidance.** (1) Keep staged files up to the cap, retry with back-off, show the backlog age; afterwards deliver in order with manifests; beyond the cap, record dropped windows and offer a re-pull if the data still exists elsewhere. (2) Compare the manifest counts with what they received; compare with the zone's analytics request totals for that hour (after sampling); a gap in both is traffic, a gap only in delivery is ours. (3) Record the configuration version per window or switch at the next window boundary; the manifest says which version applied. (4) Per-destination concurrency and rate limits, per-job queues, and shedding to staging rather than blocking shared workers. (5) Sizing from {{volume}} at the average line size after field selection and compression; egress and request counts to destinations often dominate.

**Rubric anchors.** 2: a single shared queue to destinations, overwrite-in-place files, no completeness story. 3: decoupled collection, per-job batching with deterministic names, retries with back-off, bounded staging and notification, some way to check completeness. 4: also per-window manifests with late-file versions, configuration boundaries, isolation per destination, a sizing and cost argument, and a clear customer-visible job status.

**Strong signals.** Treats "did I get everything?" as a requirement with a count, not a promise; names the event-time versus arrival-time choice. **Red flags.** "Exactly once end to end" to an external bucket; buffering without a bound for dead destinations.

## CFX-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Definitions.** Write-to-visible time for location L: the time from acceptance of version v until a read at L first returns v or newer. A stale read: a read that returned a version older than the newest one accepted at least {{target}} before the read. Both are stated on the dashboard.
- **Synthetic probes.** Probe namespaces owned by the provider. Each location writes probe keys at {{probe_rate}}, and probers at every location poll recent probe keys with a schedule (for example 0.5 s, 1 s, 2 s, … up to a cap). Each observation records `(writer location, reader location, version, accepted_at, first_seen_at by the reader's clock, poll interval)`; the poll interval bounds the measurement's resolution.
- **Clocks.** Durations are cross-location, so estimate skew: each location reports its offset from a reference (NTP statistics) with every batch; exclude or flag observations when the offset or its uncertainty is above a threshold, and show a coverage figure. Round trips on one clock (write and read back via a remote location) give skew-free upper bounds to cross-check.
- **Censoring.** A probe not yet seen at a location stays open. At the cap it becomes "not visible within cap", counted separately and as ≥ cap in percentiles, never dropped.
- **Customer-traffic signal.** For customer namespaces, without reading values: at read time record the version metadata served and its write timestamp; the newest accepted version per key (hashed) is known at the write path. Join on hashed key and version in the pipeline to estimate stale-read rates per namespace. Values are never logged.
- **Aggregation.** Mergeable histograms (fixed log buckets or a t-digest/DDSketch-style sketch) per (writer region, reader location, minute), merged to regions, days and namespaces. Percentiles are computed from merged histograms, never by averaging percentiles.
- **Dashboard.** Global and per-region p50/p95/p99 of write-to-visible time, share beyond the target, stale-read rate for the customer's namespaces, data coverage and the definitions. It states what it does not show (individual reads and values).

**Competing designs to accept.** Probes only (accept if the candidate is clear that they show the platform's propagation, not what customers' reads returned); customer-traffic only with version metadata (accept with a plan for low-traffic namespaces); a vector-clock or hybrid-logical-clock version that makes ordering independent of wall-clock skew.

**Bottlenecks and failure modes.** Skewed clocks producing negative or inflated durations; dropping censored probes, which makes things look better; averaging percentiles; probes themselves load the store (bound their rate and key count); cache layers at locations making a probe see an old value longer than a real reader would (or shorter), so probes must read the same path customers read.

**Follow-up guidance.** (1) The offset report shows the jump; flag that location's observations, show reduced coverage, and correct with the measured offset or exclude. (2) Check probe health (probe write success, poller lag, clock offsets) and compare with the customer-traffic stale-read rate for the same region; if both moved, it is propagation. (3) Look up their namespace's stale-read aggregates and per-location metadata for the period, plus probe data for their region; explain with metadata only. (4) With few writes, show per-write outcomes ("your 3 writes yesterday were visible everywhere within X s") and the global probe distribution, with an honest note on sample size. (5) Per namespace: daily counts and a small histogram; per location and minute only for global probes.

**Rubric anchors.** 2: one average latency from customer traffic, no skew handling, no definition. 3: clear definitions, probes with polling, skew acknowledged, mergeable histograms, censored probes kept. 4: also combines probe and customer signals with what each proves, quantifies resolution and skew effects, makes the dashboard state coverage and definitions, and bounds measurement cost.

**Strong signals.** Starts by defining the metric precisely; spots that measured time includes the poll interval. **Red flags.** Reading stored values to compare; "NTP makes clocks accurate, so skew is not an issue".
