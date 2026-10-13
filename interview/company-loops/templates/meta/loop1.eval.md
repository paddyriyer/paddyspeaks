# Meta · Loop 1 — evaluator notes (hidden from candidates)

## MET-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH imp AS (
  SELECT DISTINCT ON (impression_id) impression_id, user_id, campaign_id, served_at
  FROM ad_impressions
  WHERE is_valid
  ORDER BY impression_id, logged_at
), ranked AS (
  SELECT i.campaign_id, i.user_id, i.served_at, c.window_hours,
         LAG(i.served_at, c.frequency_cap) OVER (PARTITION BY i.user_id, i.campaign_id
                                                 ORDER BY i.served_at, i.impression_id) AS cap_back
  FROM imp i
  JOIN campaigns c USING (campaign_id)
), flagged AS (
  SELECT campaign_id, user_id,
         COALESCE(cap_back > served_at - make_interval(hours => window_hours), false) AS over_cap
  FROM ranked
)
SELECT c.campaign_id,
       COUNT(f.user_id)                                    AS impressions,
       COUNT(*) FILTER (WHERE f.over_cap)                  AS over_cap_impressions,
       COUNT(DISTINCT f.user_id) FILTER (WHERE f.over_cap) AS users_over_cap
FROM campaigns c
LEFT JOIN flagged f USING (campaign_id)
GROUP BY c.campaign_id
ORDER BY c.campaign_id;
```

**Explanation.** Clean first: keep valid rows and one row per `impression_id` (client and server copies are identical apart from who logged them). Within a (user, campaign), order by `(served_at, impression_id)`. The impressions in the window ending at impression *n* are a contiguous run ending at *n*, so their count exceeds the cap exactly when impression *n − cap* is still inside the window, that is when its `served_at > served_at(n) − window`. `LAG(served_at, frequency_cap)` reads that row directly (PostgreSQL evaluates the LAG offset per row, so a per-campaign cap works). When there is no such row the user has not reached the cap: `COALESCE(…, false)`. Start from `campaigns` with a LEFT JOIN so a campaign with no impressions reports zeros; `COUNT(f.user_id)` counts only matched rows.

An equally correct answer is a self-join: for each impression, count the same user's and campaign's impressions with `b.served_at > a.served_at − window` and `(b.served_at, b.impression_id) <= (a.served_at, a.impression_id)`, then compare with the cap. Accept it at full marks if the candidate names its cost.

**Complexity.** One sort per (user, campaign) partition and a linear window pass: O(n log n). The self-join is O(Σ k²) over the impressions per (user, campaign) in a window: harmless for a cap of 3, quadratic for a heavily served user over a 7-day window. A `COUNT(*) OVER (… RANGE BETWEEN INTERVAL '24 hours' PRECEDING AND CURRENT ROW)` is O(n log n) too, but PostgreSQL requires the offset to be a constant (no column reference), so per-campaign windows need one query per distinct window, and RANGE includes same-second peers, so a tie flags both rows.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `LAG(x, offset)` requires a constant offset in BigQuery, so per-campaign caps need a self-join or `ROW_NUMBER` joined back on `rn − cap`; Snowflake also expects a constant offset. Use `QUALIFY ROW_NUMBER() OVER (PARTITION BY impression_id ORDER BY logged_at) = 1` instead of `DISTINCT ON`; `TIMESTAMP_SUB(served_at, INTERVAL window_hours HOUR)` in BigQuery, `DATEADD(hour, -window_hours, served_at)` in Snowflake. Spark SQL: `lag` needs a literal offset; a range frame needs a numeric order key (epoch seconds). MySQL 8: `LAG` needs a constant offset, no `DISTINCT ON`, no `FILTER` (use `SUM(CASE …)`).

**Edge cases built into the data.** A burst of cap + 1 impressions within an hour (every level); cap impressions and one more exactly one window after the first, which is not over the cap (every level); two impressions in the same second where only the later id crosses the cap, and a campaign with no impressions (Hard and Very Hard); per-campaign windows, client and server copies of the same impression, and an invalid impression inside a burst that must not count (Very Hard).

**Common mistakes.** `>=` on the window start (keeps the impression exactly a window old); `n >= cap` instead of `n > cap`; RANGE frames or `<=` on `served_at` alone (ties counted as peers); counting only the impressions under the cap toward later windows; INNER JOIN from impressions (drops the zero campaign); deduplicating with `DISTINCT` across all columns (the copies differ in `logged_by` and `logged_at`); filtering invalid rows after computing the windows.

**Follow-up guidance.** (1) Per (user, campaign) a queue of the last `cap` served times: O(cap) memory; the number of active pairs (users × campaigns reaching them in a window) dominates, so expire state after the window. (2) Over-delivery ≈ impressions per user-campaign served during the replication lag after the cap is reached; bound it with a local reservation (deduct before serving) or by making the cap check region-local per user. (3) Partition by (user, advertiser) instead; the window and cap come from the advertiser; state grows with advertisers per user. (4) A late impression can only change flags for the same (user, campaign) within one window after it; recompute those partitions, and post refunds as adjustments, never by rewriting billed lines.

**Rubric anchors.** 2: right shape, but a boundary error (window start, cap comparison or ties) or the zero campaign dropped. 3: matches the expected result. 4: also justifies the LAG equivalence or the self-join's cost, and gives a credible streaming design with bounded state.

**Strong signals.** Asks whether over-cap impressions count toward later windows; notices that a RANGE frame cannot take a per-campaign interval; explains why ties need a key. **Red flags.** `GROUP BY user, campaign, date` (a calendar day is not a rolling window); `COUNT(*) > cap` per user and campaign over all time.

## MET-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH assigned AS (
  SELECT study_id, user_id, MIN(cell) AS cell, MIN(assigned_at) AS assigned_at
  FROM lift_assignments
  GROUP BY study_id, user_id
  HAVING COUNT(DISTINCT cell) = 1                      -- assigned to both cells: excluded
), conversions AS (
  SELECT event_name, event_id, MIN(user_id) AS user_id, MIN(event_ts) AS event_ts
  FROM conversion_events
  GROUP BY event_name, event_id                        -- pixel + server copies are one conversion
), per_user AS (
  SELECT a.study_id, a.user_id, a.cell, COUNT(cv.event_id) AS conversions
  FROM assigned a
  JOIN lift_studies s USING (study_id)
  LEFT JOIN conversions cv
         ON cv.user_id = a.user_id
        AND cv.event_name = s.event_name
        AND cv.event_ts >= a.assigned_at
        AND cv.event_ts >= s.starts_at
        AND cv.event_ts <  s.ends_at
  GROUP BY a.study_id, a.user_id, a.cell
), cells AS (
  SELECT study_id,
         COUNT(*) FILTER (WHERE cell = 'test')                        AS test_users,
         COUNT(*) FILTER (WHERE cell = 'test' AND conversions > 0)    AS test_converters,
         COALESCE(SUM(conversions) FILTER (WHERE cell = 'test'), 0)   AS test_conversions,
         COUNT(*) FILTER (WHERE cell = 'control')                     AS control_users,
         COUNT(*) FILTER (WHERE cell = 'control' AND conversions > 0) AS control_converters,
         COALESCE(SUM(conversions) FILTER (WHERE cell = 'control'), 0) AS control_conversions
  FROM per_user
  GROUP BY study_id
)
SELECT study_id, test_users, test_converters, test_conversions,
       control_users, control_converters, control_conversions,
       CASE WHEN control_converters = 0 THEN NULL
            ELSE (test_converters::float8 / test_users - control_converters::float8 / control_users)
                 / (control_converters::float8 / control_users)
       END AS lift
FROM cells
ORDER BY study_id;
```

**Explanation.** Reduce both inputs to their grain before joining. Assignments: one row per (study, user), the earliest `assigned_at`; a user seen in both cells is contaminated and dropped by `HAVING COUNT(DISTINCT cell) = 1`. Conversions: one row per (event_name, event_id), timed by the earliest copy, which is the time the conversion happened. Then a LEFT JOIN per (study, user) counts that user's qualifying conversions (study event, `[assigned_at, ends_at)`), keeping non-converters as users with 0. Conditional aggregation gives both cells in one row. Lift divides in double precision; when the control cell has no converters it is undefined, so NULL.

**Complexity.** Two hash aggregates to reach the grain, one hash join, one aggregate per study: linear in the inputs. At production scale the conversions table is the large one: prefilter it to the studies' event names and date range before aggregating.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `COUNT_IF(cell = 'test')` / `COUNTIF(...)` replace `FILTER`; BigQuery `SAFE_DIVIDE` returns NULL on a zero denominator; `IFF`/`IF` for the CASE. Spark SQL: `count_if`, and `/` already returns a double. MySQL 8: no `FILTER`; use `SUM(CASE WHEN … THEN 1 ELSE 0 END)`; `/` returns a decimal, not an integer, but be explicit.

**Edge cases built into the data.** Per study, a conversion exactly at a user's `assigned_at` (counts), one second before it (does not), and one exactly at `ends_at` (does not); other event names; users in several studies (every level); pixel and server copies of one conversion (Hard and Very Hard); duplicate assignment rows, users assigned to both cells, and a copy pair whose earliest copy is before `ends_at` and whose later copy is after it (Very Hard).

**Common mistakes.** INNER JOIN to conversions (non-converters vanish from `*_users`); counting conversions before assignment, at `ends_at`, or of other event types; deduplicating on `event_id` alone, or not at all; taking the latest copy's time; integer division (`1 / 4 = 0`); computing lift from conversions instead of converters; keeping contaminated users in one cell.

**Follow-up guidance.** (1) Per cell: n and converters; the difference of two proportions has variance p₁(1−p₁)/n₁ + p₂(1−p₂)/n₂; the normal approximation is poor with few converters (use an exact or bootstrap interval), and lift's interval needs the delta method or a bootstrap. (2) Keep a daily per-user state (assigned_at, cell, first conversion, count) updated from new events only; the readout aggregates that small table. (3) Late server events undercount both cells, but not equally if the campaign changes how conversions are reported; read out with a lag equal to the reporting delay, or report the readout's completeness. (4) Cross-device conversions not linked to the user are missed in both cells; that dilutes measured lift toward zero when it is symmetric; discuss logged-in identity, not fingerprinting.

**Rubric anchors.** 2: correct shape, but non-converters lost, or one window or dedup rule broken. 3: matches the expected result. 4: also handles the statistics honestly (interval, small samples) and proposes an incremental readout.

**Strong signals.** Asks what identifies one conversion and which copy's time counts; asks what to do with users in both cells before writing SQL. **Red flags.** Reporting lift as a percentage without saying so; treating the holdout as "everyone who did not see an ad".

## MET-L1-03

**Reference solution** (PostgreSQL; `{{start}}`, `{{end}}` and `{{sla}}` are the instance's values)

```sql reference
WITH win AS (
  SELECT message_id, chat_id, sender_id, sent_at
  FROM messages
  WHERE sent_at >= TIMESTAMPTZ '{{start}}' AND sent_at < TIMESTAMPTZ '{{end}}'
), recipients AS (
  SELECT DISTINCT m.message_id, cm.user_id
  FROM win m
  JOIN chat_members cm
    ON cm.chat_id = m.chat_id
   AND cm.joined_at <= m.sent_at
   AND (cm.left_at IS NULL OR cm.left_at > m.sent_at)
  WHERE cm.user_id <> m.sender_id
), first_receipt AS (
  SELECT message_id, recipient_id, MIN(receipt_ts) AS delivered_at
  FROM receipts
  GROUP BY message_id, recipient_id
), per_message AS (
  SELECT m.message_id, m.chat_id, m.sent_at,
         COUNT(*)            AS recipients,
         COUNT(f.delivered_at) AS delivered_recipients,
         MAX(f.delivered_at) AS last_delivered
  FROM win m
  JOIN recipients r ON r.message_id = m.message_id
  LEFT JOIN first_receipt f ON f.message_id = r.message_id AND f.recipient_id = r.user_id
  GROUP BY m.message_id, m.chat_id, m.sent_at
)
SELECT message_id, chat_id, recipients, delivered_recipients,
       CASE WHEN delivered_recipients = recipients
            THEN EXTRACT(EPOCH FROM last_delivered - sent_at) END AS delivery_seconds
FROM per_message
WHERE delivered_recipients < recipients
   OR last_delivered - sent_at > INTERVAL '{{sla}} seconds'
ORDER BY message_id;
```

**Explanation.** Three grains. Recipients: one row per (message, member at `sent_at`), with `joined_at <= sent_at < left_at` (NULL `left_at` = still a member) and the sender removed; `DISTINCT` guards against overlapping membership rows. Receipts: one earliest time per (message, recipient), regardless of type, because a read proves delivery. Then a LEFT JOIN from recipients to receipts: a recipient with no receipt survives as NULL, so `COUNT(delivered_at) < COUNT(*)` detects incomplete delivery. Starting from recipients (not receipts) is also what ignores receipts from the sender's devices and from non-members. The inner join from `win` to `recipients` drops messages with no recipients. `MAX` of the earliest times is the moment the last recipient got it.

**Complexity.** One aggregate over receipts, an interval join of messages to memberships (hash on `chat_id`, filter on times), and one aggregate per message: near-linear. In production the receipt aggregate is the cost: restrict it to the window's message ids first (semi-join), or maintain the earliest receipt per (message, recipient) incrementally.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_DIFF(last_delivered, sent_at, SECOND)`; Snowflake: `DATEDIFF('second', sent_at, last_delivered)`; both count whole seconds, which is exact here because every timestamp is a whole second. Spark SQL: `unix_timestamp(a) - unix_timestamp(b)`. MySQL 8: `TIMESTAMPDIFF(SECOND, sent_at, last_delivered)`; `INTERVAL n SECOND` syntax differs.

**Edge cases built into the data.** Duplicate delivered receipts from several devices; a message exactly `{{sla}}` seconds (not reported); a message exactly at the window end and one before it, both slow (excluded); a recipient with no receipt (every level); members who joined after, joined exactly at, or left exactly at a send, recipients whose only receipt is a read, and a read earlier than the delivered receipt (Hard and Very Hard); receipts from the sender's own devices and from a member who joined later, a member who left and rejoined around a send, and a message whose chat had no other member (Very Hard).

**Common mistakes.** Taking recipients from current membership; including the sender; ignoring read receipts; using the latest receipt; INNER JOIN to receipts (incomplete messages disappear or look complete); counting distinct receipt senders as recipients; `>=` on the SLA; `<=` on the window end; integer division or `date_part('second', …)` (which returns only the seconds field of the interval, not the total).

**Follow-up guidance.** (1) Bucket group size, then `percentile_cont` per hour and bucket; at scale keep a histogram or sketch per (hour, bucket) rather than raw times. (2) Per-recipient delivery percentiles, or "delivered to 95% of recipients within N seconds", are less dominated by a phone that is off. (3) Treat each day's numbers as provisional for a stated horizon (say 7 days), recompute the affected messages when late receipts arrive, and show completeness next to the metric. (4) Keep aggregates by (hour, group-size bucket, platform) and drop per-recipient rows; per-person questions ("was my message delivered to X last month?") can then no longer be answered, which is the point.

**Rubric anchors.** 2: recipients right, but reads ignored, or incomplete messages lost to an inner join. 3: matches the expected result. 4: also a sound finality and privacy argument for delivery metadata at scale.

**Strong signals.** Starts from the recipient set rather than from receipts; asks who counts as a recipient when membership changes; states that content is not needed and not available. **Red flags.** Proposing to inspect message content to diagnose delivery; NOT IN against a subquery that can contain NULLs.

## MET-L1-04

**Reference solution**

```python reference
from collections import defaultdict
import heapq


def suggest(edges, queries, k, blocked=(), hidden=frozenset(), min_mutual=1):
    adj = defaultdict(set)
    for a, b in edges:
        if a != b:                      # a self edge is not a friendship
            adj[a].add(b)               # sets absorb duplicate and reversed edges
            adj[b].add(a)
    no_pair = set()
    for a, b in blocked:
        no_pair.add((a, b))
        no_pair.add((b, a))
    out = []
    for u in queries:
        friends = adj.get(u)
        if not friends:
            out.append([])
            continue
        mutual = defaultdict(int)
        for f in friends:               # two hops: friends of friends
            if f in hidden:
                continue
            for v in adj[f]:
                mutual[v] += 1
        cands = [(-m, v) for v, m in mutual.items()
                 if m >= min_mutual and v != u and v not in friends and (u, v) not in no_pair]
        out.append([(v, -m) for m, v in heapq.nsmallest(k, cands)])
    return out
```

**Explanation.** Build an adjacency map of sets once: sets make duplicate and reversed edges a single friendship, and the self-edge check keeps users out of their own neighbourhood. For a query user, every path u → f → v adds one to v's count, and the number of such paths is exactly the number of mutual friends, because each f is a distinct friend of u. Skipping hidden f removes them as connectors only; they can still be counted as candidates via other paths. Filter self, existing friends, blocked pairs (stored in both orders) and the minimum, then take the best k with `heapq.nsmallest` on `(-mutual, v)`, which also gives the smaller id first on ties.

**Complexity.** Building the graph is O(E). Each query costs O(Σ deg(f)) over u's friends plus O(c log k) for the top k of c candidates. Memory O(E) for the graph and O(c) per query. Scanning all users per query is O(V · deg) each; with 40 000 users and 2 500 queries that is 10⁸ set intersections and does not finish in time.

**Common mistakes.** Counting a duplicate edge twice; suggesting existing friends or the user; checking blocked in one direction only; applying min_mutual as `>`; sorting by id descending on ties; treating hidden users as non-candidates instead of non-connectors; re-building the adjacency per query.

**Follow-up guidance.** (1) Two hops through a 5 000-friend user touch 25 million paths; cap the friends expanded (sample or take the strongest ties), or precompute for high-degree users. (2) A self-join of the edge table on the middle vertex, grouped by (u, v): the middle vertex with the largest degree is the hot key (deg² pairs); split it by salting or handle high-degree vertices separately, and prune with a per-u top-k. (3) Add 1 / log(deg(f)) instead of 1 per connector; the walk is the same, the increment changes, and ties become floats. (4) Removing (a, b) changes counts for a's friends' candidates through b and b's friends through a, plus a and b themselves; recompute those users, not everyone.

**Rubric anchors.** 2: correct output but per-query work proportional to all users, or one exclusion rule wrong. 3: correct with two-hop counting and a heap or partial sort. 4: also a credible distributed or incremental design with a skew answer.

**Strong signals.** Explains why path count equals mutual count; asks whether blocked is symmetric and whether hidden users can be suggested. **Red flags.** Recursion or BFS to unbounded depth; ignoring the cost of high-degree users.

## MET-L1-05

**Reference solution**

```python reference
def peak_viewers(sessions, min_ms=0):
    by_viewer = {}
    for viewer, start, end in sessions:
        by_viewer.setdefault(viewer, []).append((start, end))
    events = []
    for spans in by_viewer.values():
        spans.sort()
        merged = []
        for start, end in spans:
            if merged and start <= merged[-1][1]:      # overlaps or touches: one view
                if end > merged[-1][1]:
                    merged[-1][1] = end
            else:
                merged.append([start, end])
        for start, end in merged:
            if end - start >= min_ms:
                events.append((start, 1))
                events.append((end, -1))
    events.sort()
    peak, first, at_peak, count, i, n = 0, -1, 0, 0, 0, len(events)
    while i < n:
        t = events[i][0]
        while i < n and events[i][0] == t:              # apply every change at t first
            count += events[i][1]
            i += 1
        if i < n:                                       # count holds on [t, next t)
            length = events[i][0] - t
            if count > peak:
                peak, first, at_peak = count, t, length
            elif count == peak and count > 0:
                at_peak += length
    return (peak, first, at_peak) if peak else (0, -1, 0)
```

**Explanation.** Two stages. First, make each viewer a set of disjoint continuous views: group by viewer, sort, and merge sessions whose start is at or before the current end (overlap or touch). Apply `min_ms` to the merged views, so two short touching sessions can qualify together. Second, a sweep: +1 at each view's start, −1 at its end, sorted by time. All events at one time are applied before the count is read, which makes the half-open rule automatic (a leave and a join at the same instant never overlap). The count then holds until the next event time, so each stretch has a length; the first stretch at a new maximum sets `first`, and later stretches at the same maximum add to `ms_at_peak`.

**Complexity.** O(n log n) for the sorts, O(n) memory. Counting coverage at every boundary is O(n²); marking a millisecond array costs the total watched time (hundreds of billions of steps for the timing test). A difference array over the 2-hour span (7.2 million cells) is O(n + T) and also passes; accept it if the candidate states the dependence on the time span.

**Common mistakes.** Sorting events with +1 before −1 at the same time and reading the count between them (inflates the peak at a hand-over); counting sessions instead of viewers; applying `min_ms` to raw sessions; treating touching sessions of one viewer as two views (harmless for the count, wrong with `min_ms`); returning `ms_at_peak` for the first stretch only; forgetting the empty case.

**Follow-up guidance.** (1) Keep the open sessions per viewer and a running count; expire a device after a heartbeat timeout, and decide whether to publish it as having left at its last heartbeat. (2) Publish with a watermark (e.g. now − 30 s) and only finalised seconds, or smooth with a short window; never decrement for data that has not arrived. (3) A hash map broadcast → count plus a heap or an order-statistics structure; with updates every second, recomputing the top 100 from a hash map of 10 000 is also fine (O(n) selection per second). (4) A HyperLogLog sketch per broadcast (a few KB for ~1% error); it answers distinct totals and merges across shards, but not concurrency, which needs time-aligned counts.

**Rubric anchors.** 2: correct for one session per viewer, but devices double-counted or the hand-over instant wrong. 3: correct at the level, O(n log n). 4: also a credible live design with late data and an honest answer on sketches.

**Strong signals.** Asks what happens when one viewer leaves at the instant another joins; merges per viewer without being told to. **Red flags.** A per-millisecond loop presented as O(n); "assume sessions never overlap for one viewer".
