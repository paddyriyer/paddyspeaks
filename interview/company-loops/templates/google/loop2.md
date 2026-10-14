# Google · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domains of a company that
runs web search, a video platform, maps and an advertising business. Every
workload, number, rate and schema is hypothetical, and nothing here describes how
any production system works. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GOO-L2-01: Earliest arrival over time-dependent road segments

| | |
|---|---|
| **Template ID** | GOO-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / time-dependent shortest paths, waiting at junctions, closures |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | GOO-L2-01.mjs |

**Business Scenario.** A maps product estimates arrival times from typical traffic. Historical speeds give every road segment a travel-time profile: the time it takes depends on when you enter it, in fixed time-of-day buckets. A delivery-planning feature lets a driver wait at a junction (a loading bay, a car park) whenever waiting gets them to the destination sooner, for example when a jam ahead is about to clear. You are writing the routine that answers "what is the earliest I can be there?" over one snapshot of profiles.

**Problem Statement.** Implement `earliest_arrival(segments, source, target, depart, bucket_min)`. Each segment is `(from_junction, to_junction, profile)` and is one-way. Times are whole minutes from the start of the day. A car that enters a segment at minute `t` uses bucket `j = min(t // bucket_min, len(profile) - 1)` (the last bucket applies for ever once the profile ends) and reaches the far junction at minute `t + profile[j]`. You are at `source` at minute `depart` and may wait any whole number of minutes at any junction, but not on a segment. Return the earliest minute at which you can be at `target`, or `None` if no sequence of segments reaches it. If `source == target`, return `depart`. {{traffic_rule}} {{bucket_rule}}

**Constraints.** Up to 60 000 junctions and 180 000 segments; every profile in one call has the same number of buckets (at most 24); travel times are whole minutes ≥ 1. Expect roughly O(E log V) work with a small factor for scanning buckets. Simulating the network minute by minute, or relaxing every segment until nothing changes, is too slow at this size.

**Assumptions.** Hypothetical road graphs and profiles. The travel time is fixed by the minute you enter a segment; it does not change while you are on it. Real routing systems also model turn costs, live incidents and uncertainty; this exercise does not.

**Clarifications.**
- Q: Does a segment's travel time change while I am on it? | A: No. It is fixed by the bucket of the minute you enter.
- Q: Which bucket does a car entering exactly on a boundary use? | A: The new one. Minute `t` is in bucket `t // bucket_min`, so with 15-minute buckets minute 15 is in bucket 1.
- Q: What does `None` in a profile mean? | A: The segment cannot be entered during that bucket. A car that entered earlier still finishes. Only the hardest replays contain closures.
- Q: Can there be two segments between the same two junctions? | A: Yes, for example a road and a parallel express lane, with different profiles. Consider each.
- Q: Is waiting free? | A: Yes. You only minimise the arrival minute; there is no cost for waiting.
- Q: What if I depart after the last bucket ends? | A: The last bucket's travel times apply, for every later minute.

**Hints.**
1. Define `leave(t)`: the earliest minute you can reach the far end of one segment if you are at its start at minute `t`. Because you may wait, `leave(t)` never decreases as `t` grows. Why does that matter?
2. Entering now gives `t + profile[b]`. Waiting only helps if you enter at the first minute of a later bucket `k`, which gives `k * bucket_min + profile[k]`. Take the minimum, and stop scanning once a bucket starts after the best exit you already have.
3. With a non-decreasing `leave(t)` that never returns a time earlier than `t`, Dijkstra ordered by arrival minute is correct again.

**Follow-ups.**
1. Without waiting, show a two-bucket profile where entering later gets you out sooner. Why does plain Dijkstra fail on it?
2. A trip planner asks for the latest departure from `source` that still arrives at `target` by a deadline. How would you answer it?
3. A live incident replaces one segment's profile for the next hour. What do you recompute for queries already answered, and what do you keep?
4. Add turn restrictions and turn costs at junctions. How does your search state change, and what does that do to the graph size?
5. You serve millions of queries an hour over a continental network. Which precomputation speeds up static shortest paths, and what about time-dependence makes it harder?

**Follow-up rules.**
- when: bellman, bellman-ford, relax all, until nothing changes → ask: How many rounds can your relaxation need on 60 000 junctions, and what does each round cost?
- when: every minute, minute by minute, simulate, time-expanded → ask: How many minutes does your loop cover for a long trip, multiplied by 180 000 segments? What would you change?
- when: dijkstra, heapq, priority queue → ask: Dijkstra assumes that reaching a junction later never lets you leave earlier. What in your code guarantees that here, and what would break it?
- when: waiting, wait at, later bucket → ask: How many later buckets do you scan per segment, and exactly when can you stop scanning?
- when: a*, a-star, heuristic, landmarks → ask: What admissible estimate would you use when travel times depend on the time of day?

**Evaluation Criteria.** Correct bucket arithmetic at boundaries and after the last bucket; waiting handled by considering the first minute of each later bucket, with an early stop; closures and unreachable targets return the right value (`None` versus `depart`); argues why waiting restores the property Dijkstra needs; near-linear complexity; recognises why minute-by-minute simulation and Bellman-Ford do not scale.

## GOO-L2-02: Best bitrate plan for a recorded network trace

| | |
|---|---|
| **Template ID** | GOO-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / state design over buffer levels, adaptive video streaming |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | GOO-L2-02.mjs |

**Business Scenario.** A video platform's playback team evaluates its adaptive-bitrate logic offline. Each video is encoded at several renditions (a bitrate ladder), and the player picks one rendition per segment as it streams. The team replays recorded network traces and wants a yardstick: the best possible plan for a trace when the whole trace is known in advance, the "offline optimum" commonly used to judge adaptive-bitrate heuristics. Higher quality scores more; stalls (rebuffering) and quality switches cost.

**Problem Statement.** Implement `best_plan_score(throughput, ladder, segment_ticks, max_buffer, switch_penalty, stall_penalty)`. The video has `len(throughput)` segments of `segment_ticks` ticks each (1 tick = 100 ms). For every segment choose one rendition from `ladder`, a list of `(kbps, quality)`. Downloading segment `i` at a rendition of `kbps` takes `ceil(kbps * segment_ticks / throughput[i])` ticks. The buffer starts at 0 ticks, and segments download one after another: a download of `d` ticks with `b` ticks buffered stalls playback for `max(0, d - b)` ticks, after which the buffer holds `min(max(b - d, 0) + segment_ticks, max_buffer)` ticks (a full buffer makes the player wait before its next request; that wait costs nothing). The score of a plan is the sum of its qualities, minus `switch_penalty` times the sum of `|quality change|` between consecutive segments, minus `stall_penalty` times the total stall ticks. Return the best score over all plans. {{trace_rule}}

**Constraints.** Up to 200 segments, up to 6 renditions, `segment_ticks ≤ max_buffer ≤ 300`, throughput ≥ 1 kbps. Integer arithmetic throughout. Trying every plan is `len(ladder) ** len(throughput)`; expect at most O(segments × renditions² × (max_buffer + 1)).

**Assumptions.** Hypothetical ladders, quality scores and traces. The offline optimum ignores throughput prediction on purpose: it is an upper bound to compare real players against, not a player. There is no special case for startup: the buffer starts empty, so the first download is a stall.

**Clarifications.**
- Q: Does the first segment's download count as a stall? | A: Yes. Startup delay is charged at the same rate as any other stall.
- Q: Is the switch penalty per switch or per quality point? | A: Per quality point: going from quality 22 to 44 costs `22 * switch_penalty`. The first segment has no switch.
- Q: Does waiting with a full buffer change the next download? | A: No. `throughput[i]` holds for the whole download of segment `i`, whenever it starts.
- Q: Do I return the plan? | A: No, only the best score. Several plans can tie.
- Q: Is quality always increasing with kbps? | A: In these ladders, yes, but do not rely on it.

**Hints.**
1. To score the rest of the video you do not need the whole history: the previous rendition and the buffer level are enough.
2. The buffer is an integer from 0 to `max_buffer`, so there are at most `len(ladder) * (max_buffer + 1)` states after each segment. Keep the best score per state.
3. Integer ceiling: `-(-a // b)`.

**Follow-ups.**
1. Return the plan as well, with a deterministic tie-break. How much extra memory does that need?
2. With the same previous rendition, is a state with more buffer and a higher score ever worse than one with less of both? How would you use that to prune states?
3. A two-hour film in 2-second segments at 10 ms resolution with a 60-second cap: what happens to your state space, and how would you coarsen time while bounding the error you introduce?
4. Production players do not know future throughput. How would you use this optimum to evaluate a new heuristic across thousands of traces, and which numbers would you report?

**Follow-up rules.**
- when: greedy, highest rendition, best quality the network allows → ask: Show a three-segment trace where taking the best rendition the current throughput allows loses to a lower one.
- when: itertools.product, all plans, brute force, every combination → ask: How many plans are there for 150 segments and 5 renditions?
- when: lru_cache, memo, memoization, recursion → ask: What is your memo key, how many distinct keys can there be, and how deep does the recursion go for 200 segments?
- when: math.ceil, float → ask: `math.ceil(kbps * segment_ticks / throughput)` divides in floating point. When can that differ from an integer ceiling, and how do you avoid the question entirely?
- when: dominate, dominance, prune, pareto → ask: Prove that more buffer never hurts. Which two parts of the buffer formula does the proof rely on?

**Evaluation Criteria.** Chooses the state (previous rendition, buffer) and explains why it is sufficient; exact integer ceiling; correct stall, cap and switch-penalty rules including the first segment; complexity bounded by the integer buffer range; distinguishes the offline optimum from an online player; discusses pruning and plan reconstruction.

## GOO-L2-03: Debug a rebuffering-ratio rollup from player heartbeats

| | |
|---|---|
| **Template ID** | GOO-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / deduplication keys, ordering, metric definitions, ratio of totals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | GOO-L2-03.mjs |

**Business Scenario.** A video player sends heartbeats to a quality-of-experience pipeline. Each heartbeat says how long one viewing session spent in one state (playing, buffering, paused or seeking) during one interval. A daily job rolls them up per video: watch time, join time (the wait before playback starts), rebuffering time and the rebuffering ratio, which dashboards use to compare encodings and delivery networks. Since a player update, watch time is far below the player's own counters, the rebuffering ratio jumps around for videos with few views, and the job has crashed twice. The rollup below is the suspect.

**Problem Statement.** Fix `playback_quality(heartbeats)` so that it meets this specification. Each heartbeat is `{"session", "video", "seq", "state", "ms"}`: during interval `seq` (1, 2, 3, … within the session) the session spent `ms` milliseconds in `state`. {{delivery_rule}}
1. **Retries.** A heartbeat whose `(session, seq)` was already counted is a retry and is ignored. Two intervals of one session with the same state and the same `ms` are different intervals.
2. **Order.** Each session's intervals are read in `seq` order, whatever order they arrived in.
3. **Classification.** `playing` is watch time. `buffering` before the session's first `playing` interval is join time. `buffering` after it is rebuffering, except buffering that follows a `seeking` interval before playback resumes (a seek wait), which counts as neither. A seek before the first `playing` interval changes nothing. `paused` and `seeking` count as nothing.
4. **Output.** `{video: {"sessions", "watch_ms", "join_ms", "rebuffer_ms", "rebuffer_bp"}}`. `sessions` counts distinct sessions, including sessions that never started playing. `rebuffer_bp` is `rebuffer_ms * 10000 // (watch_ms + rebuffer_ms)` from the video's totals, and 0 when that denominator is 0.

**Constraints.** Keep the function's name and output format. Up to 200 000 heartbeats; O(n log n) time.

**Assumptions.** Hypothetical heartbeat format and numbers, simplified. Definitions of join time and rebuffering differ between players and analytics vendors; this specification fixes one of them for the exercise. A session's heartbeats always name the same video.

**Clarifications.**
- Q: Does a session that never started playing count? | A: Yes. It adds one to `sessions` and its buffering to `join_ms`, and contributes nothing to the ratio.
- Q: Does a pause end a seek wait? | A: No. Only a `playing` interval ends it.
- Q: Why basis points? | A: An integer avoids comparing floats: 125 bp is 1.25 %.
- Q: Is a retry always identical to the original? | A: In this exercise, yes. Identify it by `(session, seq)` all the same.
- Q: How many bugs are there? | A: Several, of different kinds. The tests point at each one.

**Hints.**
1. Write down what identifies one interval, then compare it with the key the code deduplicates on. How often does a player send two consecutive 10-second playing heartbeats?
2. Print one session's heartbeats in the order the job reads them.
3. Trace `after_seek` through play, seek, buffer, play, buffer.
4. One session watched 60 s with a 0.65 s stall, another 4 s with a 3 s stall. Work out the video's ratio from the totals, then see what the code reports.
5. What happens for a viewer who gave up during startup?

**Follow-ups.**
1. A dashboard compares two delivery networks by rebuffering ratio. Why is "ratio of totals" versus "average of session ratios" a product decision, and when would you show both?
2. Heartbeats from offline or flaky sessions arrive hours late. How does the daily job handle them, and when is a day's number final?
3. In a distributed streaming job, where do you deduplicate on `(session, seq)`, and how long do you keep the keys?
4. A player release changes the heartbeat interval from 10 to 5 seconds. Which metrics must not move, and how would you check that before the release reaches everyone?

**Follow-up rules.**
- when: seen-set, seen set, dedupe, dedup → ask: What exactly goes into your seen-set, and how much memory does it need for a day of heartbeats?
- when: sorted(, .sort(, seq order → ask: You sort per session. In a streaming version, what do you do with seq 7 arriving after you already emitted that session?
- when: average, mean of, per-session ratio → ask: A 4-second clip with a 3-second stall and a two-hour film with none: what is the video's ratio under each definition, and which would you put on a dashboard?
- when: zerodivision, division by zero, denominator, if den → ask: Where do you guard the division, and what should a video that nobody managed to play show?

**Evaluation Criteria.** Finds and explains every bug with its symptom; deduplicates on `(session, seq)`; orders by `seq` within a session; resets the seek wait when playback resumes; computes the ratio from totals and guards the zero denominator; counts abandoned sessions; keeps the fix minimal; adds a test per bug.

## GOO-L2-04: Click-to-conversion attribution pipeline with late conversions

| | |
|---|---|
| **Template ID** | GOO-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Streaming pipelines / keyed joins, attribution windows, late data, restatement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_clicks": {"2": ["400 million", "1 billion"], "3": ["5 billion", "12 billion"]},
  "window": ["30 days", "60 days", "90 days"],
  "upload_lag": ["2 days", "7 days"],
  "freshness": ["15 minutes", "1 hour", "3 hours"]
}
```

**Business Scenario.** An advertising platform reports conversions to advertisers: a purchase or sign-up is credited to the ad click that led to it, if it happens within the advertiser's conversion window (up to {{window}} after the click). There are about {{daily_clicks}} ad clicks a day. Conversions arrive two ways: from a tag on the advertiser's site within seconds, and from advertiser uploads of offline conversions (a sale closed in a CRM, for instance) up to {{upload_lag}} after the conversion. Both carry the click identifier the platform attached to the landing-page URL. Advertisers see conversions by the day of the click, in their account's time zone, within {{freshness}}.

**Problem Statement.** Design the pipeline that joins conversions to clicks and produces the conversion reports. Cover where click state lives and for how long, the join key and the window check, duplicate conversions (a tag that fires twice, an upload that is re-sent), the advertiser's choice to count every conversion or one per click, late and out-of-order data, restating past days as late conversions and click corrections arrive, how outputs stay idempotent, and how you prove the numbers are complete.

**Constraints.** Conversions never change what advertisers are charged for clicks, but a click later found to be invalid (automated traffic, accidental double clicks) is removed from reports and from charges, up to a few days later; its conversions must disappear with it. A report for a past day can change only by restatement, never silently. The click identifier is opaque; the pipeline must not rely on user identities.

**Assumptions.** All volumes, windows and lags are hypothetical. Conversion windows, counting options and offline conversion imports are described in general terms from public advertising documentation; the design is yours. Each conversion carries an advertiser-supplied order id or transaction id when one exists.

**Clarifications.**
- Q: Can a conversion arrive before its click is in the click store? | A: Yes: the tag can fire within a second of the click, while click logs land in batches.
- Q: Can one conversion match several clicks? | A: Not by identifier: a conversion carries one click id. Several conversions can match one click.
- Q: How late can an upload be? | A: Usually within {{upload_lag}}; advertisers sometimes re-upload months later. Anything outside the window is rejected with a reason.
- Q: What is the reporting grain? | A: Campaign, ad group and conversion action, by the click's day in the account's time zone.
- Q: Who corrects invalid clicks? | A: A separate filtering system emits a correction (click id, invalid since) after the fact. You consume it.

**Hints.**
1. With a click identifier on every conversion, the join is a keyed lookup, not a search. What decides how long a click must stay joinable?
2. Report by click day means a conversion today can change a number from {{window}} ago. Plan for restatement from day one.
3. Deduplicate conversions on a business key (advertiser, conversion action, order id), falling back to (click id, action, conversion time) when there is no order id.

**Follow-ups.**
1. Size the click state you must keep joinable for {{window}} plus {{upload_lag}}. Where does it live, and what is its access pattern?
2. A conversion arrives for a click id you have never seen. What do you do with it now, and what do you do in an hour?
3. A batch of clicks from four days ago is marked invalid. Walk through every table and report that changes, and how advertisers find out.
4. An advertiser complains their CRM shows 1 240 conversions for last week and the report shows 1 180. How do you investigate?
5. Advertisers ask for a data-driven attribution model instead of last click. What in your pipeline survives, and what has to change?

**Follow-up rules.**
- when: window join, stream-stream join, flink, dataflow, beam → ask: Your join keeps state for {{window}}. What is the state size, and what happens when a worker holding it restarts?
- when: watermark, allowed lateness → ask: An upload arrives {{upload_lag}} late. Is it past your watermark, and what does your pipeline do with it?
- when: bigtable, key-value, lookup, cache → ask: What is the read pattern on your click store at peak conversion rate, and how do you keep a hot advertiser from creating a hot key?
- when: dedupe, dedup, order id, transaction id → ask: The same order id arrives from the tag and from an upload with different values. Which wins, and how do you record it?
- when: overwrite, restate, backfill → ask: How far back can a restatement reach, and how do you keep an advertiser's export from seeing a half-written day?

**Production Reality Check.**
- An advertiser fixes a bug in their CRM export and re-uploads the last {{upload_lag}} of offline conversions; a tenth of the order ids changed format, so the re-upload looks like new conversions.
- One hour of click logs from one region lands six hours late; during that time conversions arrive for click ids the join cannot find.
- A daylight-saving change moves the account-time-zone day boundary, and two advertisers' daily totals no longer match their own systems for that day.

**Evaluation Criteria.** Click store keyed by click id with retention of window plus upload lag; a pending buffer for conversions whose click has not landed, with a deadline and a reason when it expires; conversion deduplication on a business key; every and one-per-click counting derived from the same deduplicated facts; reports by click day in the account time zone; restatement by idempotent partition overwrite with versioning; invalid-click corrections that retract conversions; completeness checks against click and conversion counts; capacity and hot-key awareness.

## GOO-L2-05: Search query-log rollup with hot queries and mergeable sketches

| | |
|---|---|
| **Template ID** | GOO-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Distributed batch processing / partitioning, shuffle skew, approximate distinct counts, privacy floors |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "daily_queries": {"2": ["3 billion", "8 billion"], "3": ["30 billion", "80 billion"]},
  "hot_share": ["0.5%", "2%", "6%"],
  "min_users": [50, 100, 500],
  "countries": [60, 150, 220],
  "deadline": ["4 hours", "6 hours"]
}
```

**Business Scenario.** A search analytics team publishes a daily dataset for product and research teams: for every country and normalised query, the number of searches, the approximate number of distinct users, the click-through rate on results, and the most common refinements (the next query the same user typed within the same search session). The logs hold about {{daily_queries}} searches a day across {{countries}} countries. A query appears in the dataset only if at least {{min_users}} distinct users searched it, a privacy floor. On the day of a major news event a single query made up {{hot_share}} of all searches; the daily job ran six times longer than usual, one stage spent hours on a handful of tasks, and the dataset missed its deadline of {{deadline}} after midnight.

**Problem Statement.** Design the daily batch pipeline on a distributed SQL or dataflow engine. Cover how the raw logs are laid out, query normalisation, sessionisation for refinements, the aggregation and how it survives a hot query, how you count distinct users approximately and merge counts across partitions and days, how the privacy floor is applied when counts are approximate, late-arriving logs and reruns, the output layout, and what the job costs.

**Constraints.** Raw logs carry a pseudonymous user id that must not appear in the output. The privacy floor is a hard rule: a query below {{min_users}} distinct users must never be published, even by way of a refinement list or a rollup that could be subtracted from another. Logs for a day can arrive up to a few hours after midnight. Downstream teams also want weekly and monthly distinct users per query without rescanning raw logs.

**Assumptions.** Volumes, shares, thresholds and deadlines are hypothetical. Sessions here are a user's searches with gaps of at most 30 minutes; the exact definition is yours to state. Approximate distinct counts such as HyperLogLog are available in public cloud warehouses and dataflow engines.

**Clarifications.**
- Q: How exact must distinct users be? | A: Within a few percent for published numbers, except at the privacy floor, where you decide how to be safe.
- Q: Are refinements counted per user or per search? | A: Per pair of consecutive queries in a session; publish a refinement only if the pair itself clears the floor.
- Q: What does normalisation include? | A: Case folding, whitespace and punctuation, Unicode normalisation; not spelling correction.
- Q: Can the job rerun a day? | A: Yes, and it must replace that day's output exactly, never append to it.
- Q: Is the hot query known in advance? | A: No. A different query is hot every time.

**Hints.**
1. A group-by on query sends every row of the hot query to one task. Partial aggregation before the shuffle (combiners, two-phase aggregation, salting the key) spreads it.
2. Distinct counts do not add up, but sketches merge: keep one per (country, query, day) and merge them for weeks and months.
3. Sessionisation needs every search of one user together, ordered by time; refinements then come from consecutive pairs. That is a different shuffle key from the aggregation.

**Follow-ups.**
1. Walk through the hot query in your plan: which stages see all of its rows, and how many tasks share the work?
2. A HyperLogLog sketch with about 1.6 % standard error says 103 users for a query; the floor is 100. Do you publish it? What rule would you adopt, and what does it cost in coverage?
3. Monthly distinct users per query: how do you build it from daily outputs, and what would go wrong if you stored only the daily estimates?
4. Logs for the last two hours of a day arrive after your job ran. What do you do, and how do downstream readers know the day was restated?
5. Finance asks why this job's compute cost doubled this quarter. How would you find out, and which design choices would you revisit first?

**Follow-up rules.**
- when: salt, salting, random prefix → ask: How many salt buckets do you choose for a query you did not know would be hot, and what does the second aggregation cost?
- when: count distinct, count(distinct → ask: An exact distinct count per (country, query) needs which shuffle, and how big is it on the hot day?
- when: hll, hyperloglog, sketch, approx_count_distinct → ask: What precision do you choose, how many bytes per sketch, and how many sketches do you store per day?
- when: sessionize, sessionise, sessionization, lag(, window function → ask: Sessionisation shuffles by user. What happens to a user with a million searches a day, and is that user a person?
- when: overwrite, partition, rerun → ask: Your rerun overwrites a day while a weekly job reads it. What does the weekly job see?

**Production Reality Check.**
- The hot query makes up {{hot_share}} of a day's searches; one aggregation task runs for hours while the rest finish in minutes.
- An automated client sends tens of millions of searches under a handful of user ids; the sessionisation stage fails on memory, and those users would dominate refinement pairs.
- A change to query normalisation ships mid-month, so the same query appears under two normalised forms in the monthly rollup.

**Evaluation Criteria.** Raw logs partitioned by date and clustered sensibly; normalisation versioned; separate shuffles for sessionisation (by user) and aggregation (by country and query) with partial aggregation and skew handling; mergeable distinct-count sketches stored per day and merged for longer periods; a conservative, stated rule for the privacy floor with approximate counts, applied to refinements and rollups too; idempotent partition overwrite for reruns with versioned outputs; bot traffic filtered or capped; cost reasoning in terms of bytes scanned and shuffled.
