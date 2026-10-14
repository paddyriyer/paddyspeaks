# Netflix · Loop 2 — evaluator notes (hidden from candidates)

## NFX-L2-01

**Reference solution**

```python reference
from collections import OrderedDict


def edge_cache(requests, capacity, admit_on_second=False):
    cache = OrderedDict()           # object_id -> (version, size); the first entry is the least recently used
    used = 0
    seen = set()
    hits = hit_bytes = total = 0
    for oid, ver, size in requests:
        total += size
        cur = cache.get(oid)
        if cur is not None and cur[0] == ver:
            hits += 1
            hit_bytes += size
            cache.move_to_end(oid)
        else:
            if cur is not None:                       # a stale version: drop it before anything else
                del cache[oid]
                used -= cur[1]
            if size <= capacity and (not admit_on_second or oid in seen):
                while used + size > capacity:
                    _, (_, s) = cache.popitem(last=False)
                    used -= s
                cache[oid] = (ver, size)
                used += size
        seen.add(oid)
    return (hits, hit_bytes, total)
```

**Explanation.** An ordered dictionary keyed by `object_id` keeps the segments in recency order: `move_to_end` on a hit, `popitem(last=False)` to evict the least recently used one. A running byte total replaces any summing. On a miss, a cached copy at another version is removed first. That has to happen before the admission decision, because the stale copy must go even when the new version is too large to store. Then the oversized check, then admission, then eviction until the new segment fits. The `seen` set records every request, so with `admit_on_second` the first request of a segment is served from upstream and not stored, and its second request is admitted even if it is a different version. The function returns integers, so the result is exact.

**Complexity.** O(1) amortised per request: each segment is inserted once per admission and evicted at most once, so the eviction loop is amortised over insertions. O(cached segments + distinct ids) memory. The timing test (300 000 requests, 60 000 segments, about 13 000 cached) runs in about 0.4 s in CPython. A Python list kept in recency order needs `list.remove` on every hit, which is O(cached) and took about 20 s. Scanning a dictionary of last-use stamps for the minimum on every eviction took more than a minute.

**Dialect notes.** In Java, a `LinkedHashMap` with access order gives the same structure; `removeEldestEntry` evicts at most one entry per insertion, so for bytes keep an explicit eviction loop. In C++, `std::list` plus an `unordered_map` from id to list iterator. In Scala, a `mutable.LinkedHashMap` with remove-and-reinsert on a hit. Byte totals need 64-bit integers. Not executed here.

**Edge cases built into the tests.** An empty trace; a segment of exactly `capacity` bytes stored and evicting everything; a segment one byte larger never stored and evicting nothing; a hit refreshing recency; one large segment evicting several small ones, oldest first; a segment fitting exactly after earlier ones without eviction; capacity 0; hits counted in requests and bytes. (Hard) the first request never stored with `admit_on_second`; a request that was not stored still counting as seen; a one-hit segment never evicting a cached one; an oversized segment not stored on its second request; the same trace with the flag off. (Very Hard) a new version replacing the old copy; the stale copy dropped even when the new version is too large; an older version after a newer one; a new version counting as a repeat for admission; a larger new version evicting others.

**Common mistakes.** `size < capacity` instead of `<=`; evicting before checking that the segment can fit at all, which empties the cache for an oversized segment; forgetting to refresh recency on a hit; recording `seen` only for admitted segments; keeping the stale version when the new one is not admitted; treating any cached copy as a hit regardless of version; returning a float ratio; an O(n) list or a min-scan for eviction.

**Follow-up guidance.** (1) For unit sizes, one pass computing each request's stack distance gives the hit ratio at every capacity at once (Mattson's algorithm). With variable sizes, the distance is the bytes of distinct segments requested since the last request of this one: in pure LRU by bytes, a request hits at capacity C when that distance plus its own size is at most C, apart from segments too large to store, which need care. The distances come from one pass with a Fenwick tree over request positions. Admission breaks the single-pass trick. (2) Second-request admission keeps one-hit segments from evicting useful ones. It lowers the ratio on traces where most segments are requested exactly twice and close together, because every second request is now a miss. (3) Windowed or segmented LRU, frequency with decay, or an admission filter such as a small sketch; compare policies on the same trace, including a warm-up period excluded from the ratio, and report bytes and requests. (4) Sharding by a consistent hash of the segment id, per-disk LRU, and a memory tier in front; the simulator models each shard as its own cache and the hashing as a router.

**Rubric anchors.** 2: an O(n) list-based LRU or wrong boundaries; several edge tests fail. 3: all tests pass with an ordered dictionary or linked list. 4: also states the amortised argument, explains the order of operations for stale versions, and answers the multi-capacity follow-up with stack distances.

**Strong signals.** Asks whether an oversized segment evicts anything before coding; notices that admission must count requests that were not stored. **Red flags.** "Use `functools.lru_cache`", which caches by count and cannot evict by bytes; returning a rounded ratio.

## NFX-L2-02

**Reference solution**

```python reference
def prune_ladder(encodes, max_rungs=None):
    by_title = {}
    for title, enc_id, kbps, quality in encodes:
        if quality is None:
            continue
        pts = by_title.setdefault(title, {})
        key = (kbps, quality)
        if key not in pts or enc_id < pts[key]:      # exact duplicates: the smallest id
            pts[key] = enc_id

    def cross(a, p, c):                               # > 0 when p is strictly above the line a-c
        return (c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0])

    out = {}
    for title, pts in by_title.items():
        # by bitrate, the best score first at each bitrate
        order = sorted(pts, key=lambda bq: (bq[0], -bq[1]))
        hull = []
        best_q = None
        for p in order:
            if best_q is not None and p[1] <= best_q:   # same or higher bitrate, no better score
                continue
            best_q = p[1]
            while len(hull) >= 2 and cross(hull[-2], hull[-1], p) <= 0:
                hull.pop()                              # on or below the new chord
            hull.append(p)
        if max_rungs is not None:
            while len(hull) > max_rungs:
                i = min(range(1, len(hull) - 1), key=lambda j: (cross(hull[j - 1], hull[j], hull[j + 1]), j))
                del hull[i]
        out[title] = [pts[p] for p in hull]
    return out
```

**Explanation.** One pass groups the scored encodes by title and resolves exact duplicates to the smallest id in a dictionary keyed by `(bitrate, quality)`. Each title's points are sorted by bitrate, highest score first at equal bitrates. Walking that order, any point whose score is not above the best so far is dominated, because something at an equal or lower bitrate already scored at least as much; that also stops the ladder at the lowest bitrate that reaches the best score. The remaining points rise in both coordinates, and a monotone stack keeps the upper hull: a point is popped while it lies on or below the chord from the rung under it to the new point. The test is an integer cross product, and `<= 0` drops collinear points. For a rung budget, the interior rung with the smallest triangle (twice its area is the same cross product) is removed, ties to the lower bitrate, and the neighbours' areas are recomputed after each removal.

**Complexity.** O(n log n) for the sorts, O(n) for the stacks. With a budget, the reference rescans the interior rungs after each removal, O(h²) per title for a ladder of h rungs, which is cheap because ladders are short. A heap with lazy invalidation and a linked list gives O(h log h) for long ladders. The timing test (360 000 encodes, 12 000 titles, interleaved) runs in about 1 s in CPython. Testing every chord for every encode (O(n³) per title) took about 17 s, and filtering the full input once per title is O(titles × n) and does not finish.

**Dialect notes.** In Java or C++ use 64-bit integers for the cross product: bitrate differences of 16 000 times score differences of 10 000 already reach 1.6 × 10⁸, and larger units would overflow 32 bits. A SQL version can do the dominance step with a window `MAX(quality) OVER (PARTITION BY title ORDER BY bitrate ROWS UNBOUNDED PRECEDING)`, but the hull itself needs a stack and is not natural in SQL; a Spark job would group by title and run the stack in a per-group function. Not executed here.

**Edge cases built into the tests.** A single encode; an encode exactly on a chord (dropped); one point above it (kept); an encode below a chord; a dominated encode; two encodes at one bitrate; the best score reached at two bitrates; interleaved titles. (Hard) exact duplicates resolved by string comparison (`"e1032" < "e417"`); an encode with no score; a title with no scored encodes left out; three collinear encodes in a longer ladder. (Very Hard) a budget at least the ladder's length; the smallest triangle removed first; neighbours changing after each removal; a budget of 2; equal areas removing the lower bitrate; the budget applied per title.

**Common mistakes.** Comparing slopes with floating-point division, which can keep a collinear point; keeping collinear points with `< 0`; sorting by bitrate only, so a lower score at the same bitrate enters the stack first; not stopping at the lowest bitrate with the best score, which adds a flat or falling tail; resolving duplicates numerically instead of as strings; scanning the full list per title; for the budget, computing every rung's area once and removing the k smallest without updating neighbours.

**Follow-up guidance.** (1) A point below the hull is beaten by switching between its neighbours over time, which averages to a point on the chord with the same bitrate and better quality. A product may still want a specific resolution for a device class or a minimum-bandwidth rung, as a constraint added after pruning. (2) A minimum ratio between neighbours makes the choice a constrained selection; greedy from the top can be suboptimal, and a DP over the hull points sorted by bitrate (best area with i rungs ending at j) is exact. (3) Prune per codec and keep ladders separate per codec family, so a device gets a complete ladder for the codec it supports; during migration, publish both and switch per device capability. (4) Noise can promote or demote rungs near the hull. Use repeated measurements or confidence bands, require a margin above the chord, and keep ladders stable across runs unless the change is material.

**Rubric anchors.** 2: a correct idea with floating-point slopes or a missing tie rule; several edge tests fail. 3: all tests pass with a sort and a monotone stack and exact integer tests. 4: also explains why dominance and the stack together give exactly the definition, handles the budget with updated neighbours, and answers the noise or codec follow-up concretely.

**Strong signals.** Asks how collinear points and equal scores are treated before coding; reaches for the cross product immediately. **Red flags.** Rounding scores to make ties go away; a quadratic or cubic algorithm defended as "titles are small" without looking at the input size.

## NFX-L2-03

**Reference solution** (the fixed ranker)

```python reference
from fractions import Fraction


def top10(rows, titles, day, country=None, k=10):
    # the latest delivery of the day's viewing, per country
    latest = {}
    for r in rows:
        if r["day"] == day:
            latest[r["country"]] = max(latest.get(r["country"], 0), r["batch"])

    seconds = {}
    for r in rows:
        if r["day"] != day or r["kind"] != "play":
            continue
        if country is not None and r["country"] != country:
            continue
        if r["batch"] != latest[r["country"]]:
            continue
        seconds[r["title"]] = seconds.get(r["title"], 0) + r["seconds"]

    ranked = []
    for title, secs in seconds.items():
        info = titles.get(title)
        if info is None or info.get("runtime_min") is None:
            continue
        exact = Fraction(secs, info["runtime_min"] * 60)      # views, compared exactly
        ranked.append((exact, title, secs / 3600, secs / (info["runtime_min"] * 60)))

    ranked.sort(key=lambda x: (-x[0], x[1]))
    out = []
    rank = 0
    for i, (exact, title, hours, views) in enumerate(ranked[:k]):
        if i == 0 or exact != ranked[i - 1][0]:
            rank = i + 1                                       # 1, 2, 2, 4
        out.append((rank, title, hours, views))
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **The latest batch is chosen per day, not per day and country.** `latest` is keyed by `r["day"]`, so a restatement in one country (batch 2) makes every other country's batch-1 rows look stale. Symptom: a country's list is empty, or the global list loses most countries, on a day another country was restated. Fix: key by country (the day is already fixed), as `latest[r["country"]]`, and look it up the same way.
2. **The preview filter compares with `"previews"`.** The data says `"preview"`, so previews are counted as viewing. Symptom: titles whose trailers autoplay on the home page climb the list. Fix: count only `kind == "play"` (or compare with `"preview"`); counting only the allowed kind is safer than excluding a known one.
3. **Runtime hours use integer division.** `runtime_min // 60` turns 90 minutes into 1 hour, so views are 1.5 times too high, and a runtime under an hour would divide by zero. Symptom: a 90-minute film's views come out too high. Fix: `runtime_min / 60`.
4. **The list is ordered by hours, not views.** The sort key is `x[1]`, the hours. Symptom: long seasons with many hours rank above short films with more views. Fix: sort by views, then title id.
5. **Ranks are positions.** `i + 1` gives 1, 2, 3, 4 for tied views. Symptom: two titles with identical views get different ranks. Fix: a competition rank, which keeps the previous rank while views are equal, comparing exactly.

Each bug has its own check that the others pass: a restatement in another country, a preview row, a 90-minute runtime, a 60-minute title against a 180-minute one, and three-way views with a tie. The samples usually fail on several bugs at once. The checks for a full replacement by a restated delivery, a tie at the cut, the global list, titles missing from the catalogue and other days pass on the original code: they guard against fixes that break those rules.

**Explanation.** Views are a ratio of two integers: seconds over runtime seconds. The reference compares them exactly as fractions, which is what the specification means by "compare exactly". Computing them as `seconds / (runtime_min * 60)` in floating point also keeps ties for the sizes here, because equal fractions of exactly representable integers round to the same float; computing `(seconds / 3600) / (runtime_min / 60)` rounds twice and can split a tie of fractions written differently, so a strong candidate notices that and either cross-multiplies or uses the single division.

**Complexity.** O(n) over rows plus O(t log t) to sort t titles. The timing test is 200 000 rows and 3 000 titles, about 0.1 s.

**Dialect notes.** In SQL the restatement rule is `batch = MAX(batch) OVER (PARTITION BY day, country)` (partitioning by day only is bug 1 in SQL form), and the rank is `RANK() OVER (ORDER BY views DESC)`; `DENSE_RANK` gives 1, 2, 2, 3 and `ROW_NUMBER` gives positions (bug 5). Integer division is the default for `integer / integer` in PostgreSQL and SQL Server, so bug 3 appears in SQL as `runtime_min / 60`; Snowflake, BigQuery and Spark SQL return a decimal or float there. Not executed here.

**Edge cases built into the tests.** A restatement in another country; a restated delivery that drops a title; previews; a 90-minute runtime; views against hours; a three-way tie in views; a tie at the cut; the global list; a title missing from the catalogue and one with no runtime; viewing on other days; a 200 000-row timing check.

**Common mistakes.** Fixing bug 1 by taking the latest batch per row or per title, which keeps a title that a restatement removed; normalising strings to hide the preview typo instead of filtering on the allowed kind; switching to `DENSE_RANK`-style ranks; rounding views before comparing; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Publish a version and a timestamp with every list; a correction is a new version with a change note, and partners get the diff. (2) In this exercise a season's runtime is the sum of its episodes as of the day; adding an episode lowers views for the same hours, so the rule must say which runtime applies (as of the viewing day is the defensible choice). (3) Keep a per-day, per-country, per-title aggregate; a restated delivery replaces one country-day partition and the lists are re-ranked from aggregates. (4) Either show both titles and let the list run to eleven, or break the tie by a published rule; the decision belongs to whoever owns the published methodology, not to the pipeline.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also writes a minimal reproduction for each bug, explains the exact comparison of views, and answers the republication and runtime follow-ups with a clear rule.

**Strong signals.** Reproduces the empty-country symptom with a three-row case; notices that the preview filter should allow known kinds rather than exclude one. **Red flags.** Wrapping the batch lookup in a `try` to avoid the empty list; "round to one decimal so ties work".

## NFX-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Event identity and schema.** Every event carries `device_id`, `profile_id`, `session_id` (chosen by the app at playback start), a per-session `seq` that increases by one, the event type, the playback position, the device's wall-clock time, the device's monotonic time since boot and a `boot_id`. The identity of an event is `(device_id, session_id, seq)`. Heartbeats carry the cumulative seconds played in the session, so a missing heartbeat loses no viewing.
- **Edge ingestion.** Regional endpoints authenticate the device, validate the schema, stamp the server receive time and write the batch to the regional durable log before acknowledging. The device deletes events from its buffer only after the acknowledgement. Per-device and per-region rate limits return a retry-after, and replays from offline buffers are marked so they can be throttled separately from live traffic.
- **Durable log.** Partitioned by `device_id` (or `session_id`), so a session stays in order within one partition and load spreads evenly; no partition key based on title or country, which would be hot. Live and replay traffic can go to separate topics with separate consumer quotas.
- **Deduplication.** A stream processor keyed by session keeps the highest contiguous `seq` and a small set of seen sequence numbers per open session in a state store, with a retention longer than the offline window ({{offline_window}} plus margin). Events for sessions older than that are checked against the historical store by key in the batch layer. Identity is assigned by the device, so retries are exact duplicates.
- **Time correction.** When a device is online, `offset = receive_time - device_time` is estimated from recent requests (the minimum over a window approximates network delay). For buffered events, the time is reconstructed from the monotonic clock: `event_time = upload_receive_time - (upload_monotonic - event_monotonic)` within the same `boot_id`. If the boot changed or the clock is implausible (before the device's first registration, in the future), the event keeps its order within the session and is placed using the session's other events, flagged as estimated.
- **Consumers.** Resume points read the live stream with a seconds-level SLA and last-writer-wins by `(session, seq)`, ignoring replayed events older than the current resume point unless they are newer by sequence. Viewing history is an upsert by session. Popularity counts are computed in batch by event day from the deduplicated table, with a lateness policy and restatements. Quality monitoring uses receive time windows and tolerates loss.
- **Storage.** The deduplicated events land in an append-only table partitioned by event date and region, with a late-arrival partition column so that late data for a past day is visible and countable.
- **Health metrics.** Ingest rate by region and platform, acknowledgement latency, duplicate rate per app version, share of events with corrected or estimated time, late-event volume by days late, consumer lag, rejected events by reason.

**Competing designs to accept.** Deduplicating in the batch layer only (simpler; resume points then need their own idempotent upsert); a session-windowed stream job that emits one record per session (strong for counts, weaker for resume points); using server receive time only and accepting distortion for offline viewing (acceptable only if the candidate quantifies it and keeps device time for later correction).

**Bottlenecks and failure modes.** Reconnect storms after outages; hot partitions keyed by title; unbounded dedup state; clock resets producing events decades in the past; deleted history items reappearing from replay; acknowledgement before the durable write losing events in a regional failure.

**Incident guidance.**
- *Reconnect storm*: the replay topic absorbs the burst while live traffic keeps its quota; per-device retry-after spreads the uploads; consumers of the replay topic scale out; resume points ignore replayed events older than the current position. Watch replay lag, not just ingest rate.
- *Clock reset to 2000*: implausible timestamps are detected (before registration, before the app version existed); events are re-timed from the monotonic clock and the receive time within the boot; popularity counts are not polluted with a day in 2000. Report the affected device family to the device team.
- *Retry bug, 30% duplicates*: deduplication by `(device, session, seq)` removes them; the duplicate-rate monitor per app version alerts; the ingestion cost rises, so throttle that app version and fix the client.

**Follow-up guidance.** (1) As in the storm incident: throttling with retry-after, a separate replay path, per-stage lag, and nothing acknowledged before it is durable. (2) Events after the jump within one boot keep the monotonic clock, so their spacing is right; re-anchor them to the last good offset. (3) Count them into the event day by a published rule: recompute the day with a restatement, or count them into a late bucket; never into the arrival day silently. (4) Per-device sequence numbers allow a gap audit: compare the acknowledged high-water marks the devices report against the stored maximum contiguous sequence per session. (5) Cost per event per platform and app version on a dashboard with a budget alert; server-side sampling or an adaptive heartbeat interval.

**Rubric anchors.** 2: events identified by a random id or not at all, only server time, a single path for all consumers. 3: device-assigned identity with dedup, a durable acknowledgement, a session-preserving partition key, device and server time with a correction rule, separate lateness handling per consumer. 4: also monotonic-clock reconstruction across offline periods, reconnect-storm controls, an auditable no-loss argument, and credible incident handling.

**Strong signals.** Asks how long devices buffer before choosing the dedup window; separates live and replay traffic. **Red flags.** "Use the device timestamp" with no correction; acknowledging before the write is durable.

## NFX-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Inputs.** Deduplicated playback sessions (from the ingestion pipeline), versioned by delivery: each daily delivery per country carries a version, and a re-delivery is a new version, never an overwrite. The catalogue's runtimes and season structure are a slowly changing table with effective dates (SCD type 2). The definition of what counts as viewing (title playback; not previews or trailers) is applied at this boundary.
- **Daily aggregate.** `title_day_country (event_day, country, title_id, seconds_played, sessions, input_versions, run_id)`, rebuilt per `(event_day, country)` partition by overwrite. Views are computed in a separate step: `views = seconds / runtime_seconds_as_of(event_day)`, with runtime joined as of the viewing day. Seasons use the sum of their episodes' runtimes as of that day. A runtime of zero or null fails the check, it does not divide.
- **Lateness and restatements.** Every day is recomputed each night for {{late_window}} after it ends, cheaply, from the late partitions only. Viewing arriving after {{late_window}} is counted into its event day in a monthly reconciliation run, not into the published daily list, and the difference is reported.
- **Publication.** A `published_list (list_date, country, version, published_at, rank, title_id, hours, views, run_id)` table. The first version is published at {{publish_at}}. A later version is published only when a rule says so (for example, a change in membership of the list or more than a set percentage in a published number), with a change note. Ranks use competition ranking; ties at the cut are shown by a published rule.
- **Small numbers.** Country-title figures below a minimum audience are suppressed, and the global figure is published only rounded or only for titles above a threshold in enough countries, so suppressed values cannot be recovered by subtraction.
- **Checks before publication.** Completeness per country (delivery arrived, row count within band), runtime sanity (no zero, no sudden change), day-over-day change limits per title, sum of country hours against the global total, and a diff against the previous version. A failed check holds that country's list, not every list.
- **Reproducibility.** Each run records input versions, catalogue snapshot and code version; a backfill for a past day with the same inputs gives the same output.

**Competing designs to accept.** A streaming aggregation with daily snapshots (fine if snapshots are immutable and restatements are explicit); publishing provisional numbers and a final version after {{late_window}} (fine with clear labels); a warehouse-native pipeline with snapshot tables. Any is fine with versioned inputs, explicit publication and a late-data policy.

**Bottlenecks and failure modes.** Appending a re-delivered day; runtime joined as of today instead of the viewing day; a zero runtime; global lists computed by summing country ranks instead of aggregates; late data silently shifting published numbers; suppressed cells recoverable from totals.

**Incident guidance.**
- *Re-delivery of two published days*: land as new versions; recompute both days for that country; diff against the published versions; republish only if the rule is met, with a change note; tell partners which numbers changed.
- *Runtime set to 0*: the runtime check fails for that title; hold that title (or the country lists containing it) and use the last valid runtime only if the methodology allows it; fix the catalogue; rerun. Never publish an infinite or missing view count.
- *Late holiday viewing understates by 12%*: expected for offline-heavy periods; the provisional label or the republication rule handles it; measure the late share by day of week and holiday, and consider a later first publication for those days.

**Follow-up guidance.** (1) Recompute every day in the affected week with the corrected runtime; republish under the rule with a change note; partners receive the diff. (2) Each choice is defensible with a policy: publish once with a known understatement, publish provisional then final, or delay; the strong answer uses measured late shares. (3) Competition rank with a rule for ties at the cut; the same rule everywhere unless the methodology says otherwise. (4) Time goes to the joins with sessions and the per-country ranking; make the aggregate incremental by partition and re-rank from aggregates. (5) The global list is ranked on global views, not on the sum of country ranks; it equals the sum of country hours unless suppression or late data differ between them, which is the bug to look for.

**Rubric anchors.** 2: a daily append of aggregates; runtime from the current catalogue; no publication versioning. 3: versioned inputs, partition overwrite, runtime as of the day, publication separate from computation with versions, a late-data policy. 4: also suppression that resists subtraction, pre-publication checks per country, reproducible backfills, and incident handling with partner communication.

**Strong signals.** Separates "computed" from "published"; asks which runtime applies to a season with new episodes. **Red flags.** "We fix the numbers in place"; dividing by runtime with no guard.
