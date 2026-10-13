# Google · Loop 2 — evaluator notes (hidden from candidates)

## GOO-L2-01

**Reference solution**

```python reference
import heapq


def _leave_time(profile, t, bucket_min):
    """Earliest minute you can be at the far end of a segment, being at its start at minute t."""
    last = len(profile) - 1
    b = min(t // bucket_min, last)
    best = None if profile[b] is None else t + profile[b]   # enter now
    for j in range(b + 1, last + 1):                          # or wait for a later bucket
        start = j * bucket_min                                # earliest minute in bucket j
        if best is not None and start >= best:                # every later entry ends later
            break
        if profile[j] is not None and (best is None or start + profile[j] < best):
            best = start + profile[j]
    return best


def earliest_arrival(segments, source, target, depart, bucket_min):
    if source == target:
        return depart
    out = {}
    for a, b, profile in segments:
        out.setdefault(a, []).append((b, profile))
    arrival = {source: depart}
    heap = [(depart, source)]
    done = set()
    while heap:
        t, u = heapq.heappop(heap)
        if u in done:
            continue
        if u == target:
            return t
        done.add(u)
        for v, profile in out.get(u, ()):
            if v in done:
                continue
            got = _leave_time(profile, t, bucket_min)
            if got is not None and got < arrival.get(v, float("inf")):
                arrival[v] = got
                heapq.heappush(heap, (got, v))
    return None
```

**Explanation.** Without waiting, a time-dependent network can break the property Dijkstra relies on: entering a segment one minute later, after a jam clears, can get you out sooner, so the first label to reach a junction is not necessarily the one to extend. Waiting restores it. With waiting, the earliest exit from a segment for a car at its start at minute `t` is `leave(t) = min(t + profile[b], min over later buckets k of k·bucket_min + profile[k])`, the second term because inside bucket `k` the earliest entry minute is best. `leave` is non-decreasing in `t` (a later car can still do whatever an earlier one could do from that minute on) and `leave(t) > t`. Those two properties make a label-setting search ordered by arrival minute correct, a classical result for time-dependent networks with the FIFO property. The bucket scan stops as soon as a bucket starts at or after the best exit found, because every travel time is at least 1. A closed bucket (`None`) is skipped; a closure in the last bucket lasts for ever, so a route through it may be impossible and `None` is returned. `source == target` returns `depart` without touching the graph, which is different from an unreachable target.

**Complexity.** O((V + E) log V) for the heap plus the bucket scans. A scan is O(H) in the worst case but usually stops after one or two buckets because the next bucket starts after the best exit; with H ≤ 24 the bound is small anyway. The 60 000-junction, 180 000-segment timing test takes well under a second in CPython. A minute-by-minute simulation costs (minutes until arrival) × E, which is tens of millions of segment checks for a few hours of travel; Bellman-Ford is O(V·E).

**Dialect notes.** In Java, `PriorityQueue<long[]>` with lazy deletion, or C++ `std::priority_queue` with a `greater<>` comparator, gives the same algorithm; times fit in 32-bit integers here, but use 64-bit if seconds or long horizons are involved. A graph library's built-in shortest path assumes static weights and gives wrong answers on time-dependent profiles. In SQL or Spark this is not a natural fit; batch route evaluation over many origin–destination pairs would usually run the same search per pair inside a map task. Not executed here.

**Edge cases built into the tests.** Waiting for a jam to clear beats entering now; entering exactly at a bucket boundary uses the new bucket (catches `(t - 1) // bucket_min` and `<=` slips); `source == target`; departing after the last bucket; an unreachable target; a jammed direct road versus a longer free road; (Hard) reaching a jammed segment after it clears; (Very Hard) waiting out a closure, a closure in the last bucket that never reopens, and a direct road open only in the last bucket.

**Common mistakes.** Plain Dijkstra on `t + profile[bucket(t)]` with no waiting (wrong on jam-clearing cases and closures); treating `None` as zero or as "skip this bucket's minutes" without waiting; indexing past the end of the profile instead of clamping to the last bucket; a visited check on push instead of on pop; scanning every minute until the next bucket rather than only its first minute; returning `None` when `source == target`.

**Follow-up guidance.** (1) Profile `[50, 5]` with 15-minute buckets, at minute 12: entering now exits at 62, entering at 15 exits at 20; without waiting the first label at the junction is the worse one. (2) Because arrival is non-decreasing in departure (with waiting), binary search on the departure minute using the forward search works; better is a backward search from the target with "latest departure" labels, the mirror image. (3) Only queries whose route enters that segment in the affected window can change; recompute those, or recompute all queries whose search reached the segment's start before their arrival time. (4) Turn restrictions need an edge-based state (the segment you arrived on), which multiplies states by the in-degree; turn costs become edge weights between segments. (5) Static speed-up techniques (contraction hierarchies, customisable route planning, landmarks for A*) precompute shortcuts; with time-dependence a shortcut's cost is itself a function of departure time, and composing profile functions grows them, so precomputation is heavier and usually approximated.

**Rubric anchors.** 2: Dijkstra without waiting, or boundary errors; fails jam or closure tests. 3: all tests pass with a correct `leave(t)` and Dijkstra. 4: also explains why waiting makes the search correct, why the scan can stop early, and gives credible answers on the latest-departure and precomputation follow-ups.

**Strong signals.** Asks whether waiting is allowed and how a boundary minute is bucketed before coding; tests with a tiny two-bucket profile. **Red flags.** Asserting Dijkstra is correct "because weights are positive" without noticing that the weights depend on time; simulating every minute.

## GOO-L2-02

**Reference solution**

```python reference
def best_plan_score(throughput, ladder, segment_ticks, max_buffer, switch_penalty, stall_penalty):
    # state: (rendition of the previous segment, buffer in ticks) -> best score so far
    states = {(-1, 0): 0}
    for thr in throughput:
        options = [(r, q, -(-kbps * segment_ticks // thr)) for r, (kbps, q) in enumerate(ladder)]
        nxt = {}
        for (prev, buf), score in states.items():
            prev_q = ladder[prev][1] if prev >= 0 else None
            for r, q, dl in options:
                stall = dl - buf if dl > buf else 0
                left = buf - dl if buf > dl else 0
                new_buf = min(left + segment_ticks, max_buffer)
                s = score + q - stall_penalty * stall
                if prev_q is not None:
                    s -= switch_penalty * abs(q - prev_q)
                key = (r, new_buf)
                if s > nxt.get(key, s - 1):
                    nxt[key] = s
        states = nxt
    return max(states.values())
```

**Explanation.** The future of a plan depends on the past only through two things: the buffer level (it decides future stalls) and the previous rendition (it decides the next switch penalty). So the dynamic programme keeps, after each segment, the best score for every reachable `(previous rendition, buffer)` pair. The buffer is an integer between 0 and `max_buffer` because every download time is a whole number of ticks and the buffer is capped, so the state space is bounded. Each transition applies the exact rules: integer ceiling for the download, stall `max(0, d − b)`, new buffer `min(max(b − d, 0) + segment_ticks, max_buffer)`, quality, and the switch penalty from the second segment on. The answer is the best score over the final states. Keeping only the best score per state is safe because two partial plans that reach the same state have identical futures.

**Complexity.** At most `R · (max_buffer + 1)` states per segment and `R` transitions each: O(N · R² · (B + 1)) time and O(R · (B + 1)) memory. In the timing tests (up to 180 segments, 5 renditions, a 300-tick cap) far fewer states are reachable, and the reference runs in well under a second in CPython. Exhaustive search is `R^N` (5¹⁵⁰ plans).

**Dialect notes.** In Java, Scala or C++, use two arrays `dp[R][B + 1]` initialised to a minimum sentinel and swap them per segment; scores fit in 64-bit integers. In Python, a dict keyed by `(rendition, buffer)` keeps only reachable states, which is usually faster than a full array. Not executed here.

**Edge cases built into the tests.** A single segment, where the first download is a stall; a download time that must round up (floor gives one tick less stall); a lower rendition that avoids a stall beating a higher one; a buffer cap that throws away excess; a steady trace; (Hard) the same oscillating trace with and without a switching penalty; (Very Hard) building buffer at a low rendition before a near-outage, and the same trace with a cap too tight to help.

**Common mistakes.** Greedy choice of the best rendition the current throughput allows; `math.ceil` on a float division (correct here only by luck of small values, and a habit that fails at scale); forgetting the cap; charging a switch on the first segment; dropping the previous rendition from the state (correct only when `switch_penalty` is 0, which is why Medium can hide it); keeping one state per buffer level with the best score, which mixes previous renditions; recursion with memoisation on the whole plan prefix.

**Follow-up guidance.** (1) Keep a parent pointer per state per segment (O(N · R · (B + 1)) memory) and backtrack; for a deterministic tie-break, prefer, say, the lower rendition at equal score, applied consistently during the forward pass. (2) More buffer never hurts: the stall `max(0, d − b)` does not increase with `b`, and the next buffer `min(max(b − d, 0) + s, cap)` does not decrease with `b`; by induction, from the same previous rendition a state with at least the buffer and at least the score dominates, so each previous rendition needs only a Pareto frontier of (buffer, score). (3) At 10 ms resolution the buffer range is 6 000 values per rendition; coarsen by rounding the buffer down to a grid (pessimistic, so the result is a lower bound) and up (optimistic, an upper bound), which brackets the true optimum, or use the Pareto frontier, which is usually small. (4) Report the heuristic's score as a fraction of the optimum per trace, with the distribution (median, low percentiles) by network type, plus stall ratio and switch count separately so a regression in one is not hidden by the others; gate releases on the low percentiles, not the mean.

**Rubric anchors.** 2: greedy or exhaustive; or a DP missing the previous rendition, the cap or the integer ceiling. 3: all tests pass with the `(previous rendition, buffer)` DP and a clear complexity bound. 4: also proves the dominance argument, explains plan reconstruction, and discusses how the optimum is used to judge online players.

**Strong signals.** Starts by asking what the future depends on; notices the buffer is bounded and integral. **Red flags.** Claims greedy is optimal because "higher quality is always better"; cannot state the size of the state space.

## GOO-L2-03

**Reference solution** (the fixed rollup)

```python reference
def playback_quality(heartbeats):
    seen = set()
    sessions = {}
    for hb in heartbeats:
        key = (hb["session"], hb["seq"])                 # one interval = one (session, seq)
        if key in seen:                                  # a retried heartbeat
            continue
        seen.add(key)
        sessions.setdefault((hb["video"], hb["session"]), []).append(hb)

    per_video = {}
    for (video, session), beats in sessions.items():
        watch = join = rebuffer = 0
        played = after_seek = False
        for hb in sorted(beats, key=lambda h: h["seq"]):  # seq order, not arrival order
            if hb["state"] == "playing":
                watch += hb["ms"]
                played = True
                after_seek = False                       # playback resumed: the seek wait is over
            elif hb["state"] == "seeking":
                after_seek = True
            elif hb["state"] == "buffering":
                if not played:
                    join += hb["ms"]                     # startup, not rebuffering
                elif not after_seek:
                    rebuffer += hb["ms"]
        v = per_video.setdefault(video, {"sessions": 0, "watch_ms": 0, "join_ms": 0, "rebuffer_ms": 0})
        v["sessions"] += 1
        v["watch_ms"] += watch
        v["join_ms"] += join
        v["rebuffer_ms"] += rebuffer

    out = {}
    for video, v in per_video.items():
        den = v["watch_ms"] + v["rebuffer_ms"]           # ratio of the video's totals
        out[video] = dict(v, rebuffer_bp=v["rebuffer_ms"] * 10000 // den if den else 0)
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **Deduplication on the payload.** The key `(session, state, ms)` treats two consecutive 10-second playing heartbeats as one, so most playing intervals are dropped as "retries". Symptom: watch time far below the player's own counters. Fix: deduplicate on `(session, seq)`, which identifies one interval.
2. **Arrival order.** Intervals are read in delivery order. When the first playing heartbeat arrives before the startup buffering one, the startup wait is counted as rebuffering (and the reverse also happens). Symptom: join time and rebuffering both wrong, worse on flaky networks. Fix: sort each session's intervals by `seq`.
3. **A seek flag that is never cleared.** `after_seek` is set on a seek and never reset when playback resumes, so after a viewer's first seek every later stall is ignored. Symptom: rebuffering under-reported for sessions where viewers seek. Fix: clear it on every `playing` interval.
4. **Average of session ratios.** The video's ratio is the mean of per-session ratios, so a 7-second session with a 3-second stall weighs as much as a long one. Symptom: ratios jump around for videos with few sessions. Fix: compute the ratio from the video's totals.
5. **Division by zero.** A viewer who gave up during startup has no watch time and no rebuffering, so the per-session ratio divides by zero and the job crashes. Symptom: the crashes. Fix: compute the ratio from totals and return 0 when the denominator is 0. Bugs 4 and 5 sit on one line of the original; the test "a video nobody managed to play" isolates the guard.

**Explanation.** Quality-of-experience metrics are only as good as their identities and definitions: one interval is one `(session, seq)`, order comes from `seq` and not from arrival, state machines (startup, normal, seek wait) must be reset at the right event, and a ratio across sessions is a ratio of totals unless the product explicitly wants a per-session average. The fix is small; a rewrite is not needed.

**Complexity.** O(n log n) time for the per-session sorts and O(n) memory. The timing test is 200 000 heartbeats, including a burst delivered out of order; the fixed function runs in well under a second. A seen-list instead of a seen-set, or rescanning all heartbeats per session, is quadratic and fails it.

**Dialect notes.** In SQL the same rollup is `ROW_NUMBER() OVER (PARTITION BY session, seq ORDER BY received_at) = 1` for retries, then a window ordered by `seq` to find the first playing interval and the seek waits (`SUM(...) OVER` running flags), then `SUM` per video and the ratio with `NULLIF` or `SAFE_DIVIDE` (BigQuery) to avoid division by zero. Snowflake and Spark SQL have the same windows; MySQL needs 8.0 or later for window functions. Not executed here.

**Edge cases built into the tests.** Regular identical 10-second heartbeats; a true retry; a session delivered out of order; play, seek, buffer, play, buffer; two sessions whose average ratio differs from the ratio of totals; two videos; a session abandoned during startup next to one that played; a video nobody managed to play.

**Common mistakes.** Fixing the key to `seq` alone (seq restarts in every session); sorting the whole input by `seq` instead of per session; resetting the seek flag on pause; fixing the crash with `try/except` and skipping the session, so it disappears from `sessions` and `join_ms`; computing the ratio from totals but forgetting the zero guard; rounding with floats instead of integer basis points.

**Follow-up guidance.** (1) Ratio of totals answers "what share of viewing time was spent stalled" and is dominated by long sessions; the session average answers "how bad was a typical session" and is dominated by many short ones. Product teams often show both, with session counts, and percentiles of session ratios. (2) Partition by event date, accept late heartbeats into a restatement window (for example 48 hours), recompute affected days by overwrite, and publish when a day is final. (3) Deduplicate in the streaming job's keyed state on `(session, seq)` with a TTL a little longer than the player's retry horizon, or upstream with an idempotent sink keyed the same way. (4) Watch time and rebuffering totals should not move; heartbeat counts double. Run both clients side by side on a small cohort and compare totals per session.

**Rubric anchors.** 2: finds two or three bugs; tests still fail. 3: all five fixed and explained, all tests pass. 4: also names the business symptom of each bug, argues the ratio definition, and adds a regression test per bug.

**Strong signals.** Reproduces each bug with a three-heartbeat case before fixing it; asks what identifies an interval. **Red flags.** `except: continue` around the division; a full rewrite that changes the output format.

## GOO-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Click store.** Clicks land from the serving logs in micro-batches into a key-value store (a wide-column store or a large keyed state) keyed by click id, holding click time, account, campaign, ad group, account time zone and a validity flag, with a TTL of the longest conversion window plus the upload lag plus a margin. The same clicks also land in partitioned warehouse tables by click date for reporting and audit. Size it: clicks per day × (window + lag) days × bytes per record; for example 5 billion × 97 days × ~150 bytes is about 70 TB, which rules out keeping it all in one streaming job's local state without a durable backend.
- **Conversion intake.** Tag conversions arrive on a stream; uploads arrive as files or API batches, validated (known click id format, conversion time not before click time, within the window) with rejected rows reported back to the advertiser with a reason. Every conversion gets a deterministic dedup key: (advertiser, conversion action, order id) when an order id exists, else (click id, conversion action, conversion time).
- **Join.** A keyed lookup of the conversion's click id in the click store, plus the window check `click_time ≤ conversion_time ≤ click_time + window`. Conversions whose click is not found go to a pending table and are retried on a schedule (the click logs may simply be late); after a deadline they are reported as unmatched with a reason. Matched conversions are written as facts carrying both the click day and the conversion day.
- **Counting.** Deduplicated conversion facts are the single source; "every conversion" counts them, "one per click" counts distinct (click id, action) from the same facts. Both are derived at aggregation time, so changing the setting does not require reprocessing raw data.
- **Reports and restatement.** Aggregates by (account, campaign, ad group, action, click day in the account time zone). A conversion for an old click updates an old day: aggregation runs per affected day and replaces that day's partition atomically (write, then swap), with a version number readers can see. Freshness comes from a fast path (recent days, incremental) plus a periodic full recompute of the window, which also repairs drift.
- **Invalid-click corrections.** A correction stream (click id, invalid since) flips the flag in the click store and enqueues the click's day for recompute; conversion facts for invalid clicks are retained but excluded from reports, so the retraction is auditable.
- **Completeness.** Per day: clicks in serving logs versus click store versus report; conversions received versus matched, pending, rejected and duplicate, which must sum to received. Alerts on pending growth.

**Competing designs to accept.** A stream-stream join with event-time windows and state equal to the window (Flink, Beam/Dataflow), if the candidate sizes the state and handles uploads beyond the watermark as a batch path; a pure batch design (hourly jobs joining partitions) if it meets the freshness target; a lambda-style fast path plus nightly recompute. Reporting by conversion day instead of click day is acceptable if the candidate explains what advertisers lose (cost and conversions no longer line up per click day).

**Bottlenecks and failure modes.** Click state too large for in-memory state; hot advertisers creating hot keys in a store partitioned by account (key by click id instead); conversions arriving before clicks land; late uploads past the watermark silently dropped; duplicates from re-uploads with changed ids; double counting when tag and upload both report the same order; time-zone day boundaries; restatements that readers see half-written; invalid-click corrections that never reach conversions.

**Incident guidance.**
- *Re-upload with changed order-id format*: the dedup key no longer matches, so the re-upload doubles conversions for those days. Detect it from a spike in conversions per order value and per upload batch versus history; normalise the id format at intake; quarantine the batch, replace the advertiser's previous upload for the same period (treat an upload as a versioned snapshot of a period when the advertiser says so), and restate the affected days.
- *Click logs six hours late*: conversions for those clicks pile up in pending; that is the design working. Make sure pending retries continue past the outage, alert on pending growth by region, and restate the affected click days once the clicks land. Do not drop or mark unmatched before the deadline.
- *Daylight-saving boundary*: compute the report day from the click timestamp in UTC converted with the account's time zone rules at that instant, never from a fixed offset; the day containing the change has 23 or 25 hours, which explains differences of exactly one hour of traffic. Verify against the advertiser's own day definition and document it.

**Follow-up guidance.** (1) Use the sizing formula above; the access pattern is a point lookup per conversion by click id, so a key-value store fits. (2) Pending with retries and a deadline; never drop. (3) Correction → click store flag → recompute the click days affected → reports restated with a version; advertisers see a "data updated" note. (4) Compare counts by conversion action, day and time zone; check rejected rows and their reasons, duplicates by order id, conversions outside the window, and invalid-click retractions; most gaps are window, time zone or deduplication. (5) The fact table of deduplicated, matched conversions survives; data-driven attribution needs the path of all ad interactions before a conversion, which means joining on a user-level or cookie-level path within privacy constraints, a different and much larger join.

**Rubric anchors.** 2: a stream join with no plan for uploads beyond the watermark, no deduplication key, and no restatement. 3: keyed click store with the right retention, pending conversions, deduplication on a business key, reports by click day with idempotent restatement. 4: also sizes the state, handles invalid-click retractions and time zones, and has completeness accounting where received = matched + pending + rejected + duplicate.

**Strong signals.** Asks which day a conversion is reported under before drawing anything; sizes the click store. **Red flags.** "Drop conversions that arrive late"; counting the same order twice because it came from two channels; assuming exactly-once delivery makes duplicates impossible.

## GOO-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Raw layout.** Search logs partitioned by event date (UTC) and clustered by country; one row per search with search id, pseudonymous user id, timestamp, country, raw query, and a nested list of result clicks; click logs joined on search id upstream, so click-through needs no join on query.
- **Normalisation.** A versioned, deterministic function (Unicode NFKC, case folding, whitespace and punctuation rules) applied once into a cleaned table that records the normalisation version; changing the rules bumps the version and triggers a backfill decision, never a silent mid-month change.
- **Bot and abuse filtering.** Drop or cap traffic from clients with implausible rates before anything else; this also removes the worst skew in the sessionisation stage.
- **Sessionisation and refinements.** Shuffle by user id; within a user, order by time and split sessions on gaps over 30 minutes (a window `LAG` over the user's searches, then a running sum of "new session" flags). Emit consecutive pairs (query, next query) with the user id. Users with extreme volumes are capped so one user cannot dominate a task or the pair counts.
- **Aggregation.** By (country, normalised query): `COUNT(*)` searches and clicks combine on the map side (partial aggregation), so the hot query becomes one partial row per input task before the shuffle. Distinct users use a HyperLogLog sketch per (country, query) built with partial aggregation as well (sketches merge), so there is no shuffle on (query, user). Refinement pairs aggregate by (country, query, next query) with partial aggregation and a top-k per query afterwards.
- **Skew.** Partial aggregation handles combinable aggregates. For anything not combinable (exact distinct, collecting lists), salt the key with a hash of the user id into N buckets, aggregate, then merge the N partials; or rely on the engine's adaptive skew handling where it exists, checking the plan.
- **Privacy floor.** Approximate counts near the floor are unsafe in one direction. Either (a) compute exact distinct users only for the band of keys whose estimate falls within a few standard errors of the floor (a small second pass), or (b) publish only when the estimate exceeds the floor by a stated margin (for example three standard errors). Apply the floor to every published row, including refinement pairs and rollups, and do not publish totals that let a suppressed row be recovered by subtraction (publish an explicit "other" bucket only if it also clears the floor). Differential privacy, as used in some public data releases, is the stronger alternative.
- **Outputs.** A daily table partitioned by date with counts, CTR, the serialized sketch and the top refinements; weekly and monthly distinct users come from merging daily sketches, never from adding daily estimates. Reruns overwrite the whole day atomically with a run id and normalisation version.
- **Lateness and deadline.** Start the job when the day's ingestion is complete (a watermark from the log pipeline), not at a fixed time; logs that arrive later trigger a restatement of that day, recorded in a run log readers can check.

**Competing designs to accept.** A streaming pipeline producing hourly partials merged daily; warehouse-native SQL with sketch functions (public warehouses offer HLL functions to build, merge and extract sketches) versus Spark or Beam jobs; exact distinct counts for everything if the candidate prices the shuffle; theta sketches instead of HLL where set operations (intersections across segments) are needed.

**Bottlenecks and failure modes.** Shuffling raw rows for a hot key; exact `COUNT(DISTINCT user)` by query on the hot day; refinement lists collected per query without partial aggregation; sessionisation of bot users; small-file explosion in the output; reruns that append; monthly numbers built by adding daily distinct counts (overcounts returning users); the privacy floor applied to queries but not to refinements; normalisation changes splitting a query across two forms.

**Incident guidance.**
- *Hot query, one task runs for hours*: confirm from the stage's task-duration skew and rows per task which aggregate is not combining (usually an exact distinct or a collected list); switch it to sketches or partial aggregation, or salt the key; as a stopgap, raise parallelism for that stage only. Add a skew alarm on the ratio of maximum to median task time.
- *Automated client under a handful of user ids*: filter or cap by per-user rate before sessionisation; the out-of-memory error is the visible symptom, but the larger harm is that those users would dominate refinement pairs and could push a query over the privacy floor with fake "users".
- *Normalisation change mid-month*: monthly rollups must group by one normalisation version; re-normalise the earlier days (cheap from the cleaned table plus raw query) or publish the month with the version change documented. Merge sketches only across the same normalised key.

**Follow-up guidance.** (1) The hot query's rows meet only at the shuffle after partial aggregation, so each task sends one row per aggregate; the sessionisation stage is unaffected because it is keyed by user. (2) A sketch with ~1.6 % standard error at 103 is within about two standard errors of 100: do not publish; either compute exactly for the borderline band or require a margin; coverage loss is the small set of queries in the band. (3) Merge daily sketches; adding daily estimates counts a returning user once per day. (4) Overwrite the day, bump its version, record the restatement; weekly and monthly jobs re-merge affected periods. (5) Bytes scanned and shuffled per stage, by date: likely causes are a dropped partition filter, a lost clustering key, the exact distinct creeping back in, or growth in bot traffic.

**Rubric anchors.** 2: a single group-by with exact distinct counts and no skew plan; privacy floor ignored or applied with no thought about approximation. 3: partial aggregation and sketches, separate sessionisation shuffle, idempotent daily overwrite, privacy floor with a conservative rule. 4: also applies the floor to refinements and rollups, handles bots and normalisation versions, merges sketches for longer periods, and reasons about cost in bytes.

**Strong signals.** Identifies which aggregates combine and which do not before talking about salting; treats the privacy floor as a hard constraint with approximate inputs. **Red flags.** "Just add more workers" for skew; adding daily distinct counts to get monthly ones; publishing a refinement list for a query that is itself above the floor without checking the pairs.
