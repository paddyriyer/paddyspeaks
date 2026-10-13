# Google · Loop 1 — evaluator notes (hidden from candidates)

## GOO-L1-01

**Reference solution** (PostgreSQL; `{{long_s}}` and `{{min_pages}}` are the instance's values)

```sql reference
WITH ev AS (
  SELECT DISTINCT ON (e.page_id, e.event_type, e.event_ts, e.position)
         e.event_id, e.page_id, e.event_ts, e.event_type, p.user_id
  FROM page_events e
  JOIN results_pages p ON p.page_id = e.page_id
  ORDER BY e.page_id, e.event_type, e.event_ts, e.position, e.event_id
), nxt AS (
  SELECT ev.*,
         LEAD(event_ts) OVER (PARTITION BY user_id ORDER BY event_ts, event_id) AS next_ts
  FROM ev
), clicks AS (
  SELECT page_id,
         (next_ts IS NULL OR next_ts - event_ts >= INTERVAL '{{long_s}} seconds') AS is_long
  FROM nxt
  WHERE event_type = 'click'
), per_page AS (
  SELECT p.page_id, p.query,
         COUNT(c.page_id)                      AS clicks,
         COUNT(*) FILTER (WHERE NOT c.is_long) AS short_clicks,
         COALESCE(BOOL_OR(c.is_long), false)   AS has_long
  FROM results_pages p
  LEFT JOIN clicks c ON c.page_id = p.page_id
  GROUP BY p.page_id, p.query
)
SELECT query,
       COUNT(*)                                AS pages,
       SUM(clicks)                             AS clicks,
       SUM(short_clicks)                       AS short_clicks,
       COUNT(*) FILTER (WHERE has_long)        AS long_click_pages,
       ROUND(COUNT(*) FILTER (WHERE has_long)::numeric / COUNT(*), 4) AS long_click_rate
FROM per_page
GROUP BY query
HAVING COUNT(*) >= {{min_pages}}
ORDER BY long_click_rate, query;
```

**Explanation.** Deduplicate first (a doubled click would end its own dwell a moment later and look short), then attach the user to every event and take `LEAD` over the user's whole stream in `(event_ts, event_id)` order: a dwell ends at the user's next event wherever it happens, including the serve of a new results page. A click with no next event is long by definition, so the test is `next_ts IS NULL OR gap >= threshold`. Pages are the unit of the rate, so the page step keeps pages with no clicks (LEFT JOIN from `results_pages`) and reduces their clicks to "has a long click"; the query step counts pages and rounds the ratio of integers.

**Complexity.** One sort for `DISTINCT ON` and one for the window by `(user_id, event_ts, event_id)`, then hash aggregates: O(n log n). At search scale the window step parallelises by user.

**Dialect notes** (described, not executed). BigQuery: `LEAD` is the same; dedupe with `QUALIFY ROW_NUMBER() OVER (PARTITION BY page_id, event_type, event_ts, position ORDER BY event_id) = 1`; `TIMESTAMP_DIFF(next_ts, event_ts, SECOND) >= {{long_s}}`; `LOGICAL_OR` for `BOOL_OR`; `COUNTIF`. Snowflake: `QUALIFY`, `DATEDIFF('second', …)`, `BOOLOR_AGG`, `COUNT_IF`. Spark SQL: `lead()`, `bool_or` (or `max(cast(… as int))`), `count_if`. MySQL 8: no `FILTER`, `BOOL_OR` or `DISTINCT ON`: use `SUM(CASE …)`, `MAX(is_long)` and `ROW_NUMBER()`. Note that `DISTINCT ON` treats NULL `position`s as equal; a `PARTITION BY` does too.

**Edge cases built into the data.** A dwell of exactly {{long_s}} seconds (every instance); clicks that are the user's last event; pages with no clicks; pages with several clicks. Hard: a click left without returning, followed by a new search within {{long_s}} seconds (short) or after it (long); a return and the next click in the same second. Very Hard: duplicated click rows.

**Common mistakes.** Partitioning LEAD by page (a new search then never ends a dwell); `>` instead of `>=`; treating the last click as short or dropping it; an INNER JOIN that loses pages without clicks; counting long clicks instead of pages with one; deduplicating after LEAD; ordering by `event_ts` alone; integer division.

**Follow-up guidance.** (1) Plot the dwell distribution (often bimodal), pick the threshold at the valley or by agreement with human-rated satisfaction, and report the metric at two or three thresholds. (2) Multiple tabs break the "next event" proxy; ask for tab or visibility events from the client, or treat overlapping clicks specially. (3) Minimum page counts, confidence intervals, or a shrunk rate (for example a Beta prior from the query's category). (4) Partition by date and user hash, carry each user's last event across midnight, recompute users touched by late events, and finalise after the lateness bound.

**Rubric anchors.** 2: right structure but dwell per page, or the last click handled wrongly. 3: matches the expected result. 4: also discusses threshold choice, multi-tab behaviour and small-sample ranking.

**Strong signals.** Asks what ends a dwell and what happens to the last click before writing SQL; keeps the zero-click pages unprompted. **Red flags.** A correlated subquery per click to find the next event; `AVG(dwell)` as the metric; treating NULL dwell as 0.

## GOO-L1-02

**Reference solution** (PostgreSQL; `{{step}}` is the checkpoint step and `{{min_play}}` the engaged-view minimum, 0 below Very Hard)

```sql reference
WITH r AS (
  SELECT p.view_id, v.video_id,
         GREATEST(p.start_s, 0)          AS s,
         LEAST(p.end_s, d.duration_s)    AS e
  FROM played_ranges p
  JOIN views v  ON v.view_id = p.view_id
  JOIN videos d ON d.video_id = v.video_id
), clipped AS (
  SELECT * FROM r WHERE e > s
), ordered AS (
  SELECT c.*,
         MAX(e) OVER (PARTITION BY view_id ORDER BY s, e
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_end
  FROM clipped c
), islands AS (
  SELECT o.*,
         SUM(CASE WHEN prev_end IS NULL OR s > prev_end THEN 1 ELSE 0 END)
           OVER (PARTITION BY view_id ORDER BY s, e ROWS UNBOUNDED PRECEDING) AS island
  FROM ordered o
), played AS (
  SELECT view_id, SUM(len) AS played_s
  FROM (SELECT view_id, island, MAX(e) - MIN(s) AS len FROM islands GROUP BY view_id, island) x
  GROUP BY view_id
), counted AS (
  SELECT v.view_id, v.video_id
  FROM views v
  JOIN played pl ON pl.view_id = v.view_id
  WHERE pl.played_s >= {{min_play}}
), denom AS (
  SELECT video_id, COUNT(*) AS n_views FROM counted GROUP BY video_id
), grid AS (
  SELECT d.video_id, g.pct, (d.duration_s * g.pct) / 100 AS pos
  FROM videos d
  CROSS JOIN generate_series(0, 99, {{step}}) AS g(pct)
), hits AS (
  SELECT g.video_id, g.pct, COUNT(DISTINCT c.view_id) AS viewers
  FROM grid g
  JOIN counted c ON c.video_id = g.video_id
  JOIN clipped k ON k.view_id = c.view_id AND k.s <= g.pos AND g.pos < k.e
  GROUP BY g.video_id, g.pct
)
SELECT g.video_id, g.pct,
       COALESCE(h.viewers, 0) AS viewers,
       ROUND(COALESCE(h.viewers, 0)::numeric / n.n_views, 4) AS retention
FROM grid g
JOIN denom n ON n.video_id = g.video_id
LEFT JOIN hits h ON h.video_id = g.video_id AND h.pct = g.pct
ORDER BY g.video_id, g.pct;
```

**Explanation.** Clip every range to the video, then compute each view's distinct seconds played by merging overlaps: ordered by start, a range whose start is past the largest end seen so far opens a new island, and the played time is the sum of island lengths. Views below the minimum are dropped from both numerator and denominator (below Very Hard the minimum is 0 and every view counts). The grid of video × checkpoint uses integer arithmetic for positions; a half-open stabbing join finds the views covering each position, `COUNT(DISTINCT view_id)` counts a rewinding view once, and the LEFT JOIN back onto the grid keeps checkpoints nobody reached.

**Complexity.** The island step sorts ranges per view: O(R log R). The stabbing join is O(checkpoints × ranges per video) without an index, which is fine for coarse checkpoints and wasteful per second; the scalable form turns each merged range into +1 at its start and −1 at its end and takes a running sum over positions (O(R log R) per video, independent of resolution).

**Dialect notes** (described, not executed). BigQuery: `GENERATE_ARRAY(0, 99, {{step}})` with `UNNEST`; window frames as in PostgreSQL; integer division needs `DIV(duration_s * pct, 100)` because `/` returns FLOAT64. Snowflake: `/` on integers returns a decimal, so use `FLOOR(duration_s * pct / 100)`; build the grid with `GENERATOR` or a small numbers table. Spark SQL: `sequence(0, 99, {{step}})` + `explode`; `div` for integer division. MySQL 8: a recursive CTE for the grid and `DIV` for integer division.

**Edge cases built into the data.** A range ending exactly at a checkpoint (not covered) and one starting there (covered); a video whose last checkpoint nobody reaches. Hard: skips that leave gaps, rewinds that overlap a checkpoint, views that start mid-video. Very Hard: views whose summed range lengths reach the minimum but whose distinct seconds do not; a range that runs past the end of the video; very short views.

**Common mistakes.** `BETWEEN` (closed at both ends); `COUNT(*)` over ranges instead of distinct views; no grid, so zero rows vanish; floating-point positions; played time as the sum of lengths; not clipping; filtering short views from the numerator only; dividing by all views of the platform instead of the video's.

**Follow-up guidance.** (1) Boundary events (+1/−1) per merged range and a running sum give retention at every second in one pass; store a per-video histogram rather than raw ranges. (2) Precompute curves normalised to relative position for videos bucketed by length and category, and compare at fixed checkpoints. (3) Key ranges by (view_id, batch sequence) so a re-sent batch replaces rather than adds, recompute the affected videos, and publish with a freshness marker. (4) Position coverage is unchanged by speed; watch time (wall-clock) reports would change, so keep both measures distinct.

**Rubric anchors.** 2: right coverage logic but missing zero rows, or ranges counted instead of views. 3: matches the expected result. 4: also gives the boundary-event formulation and handles late and duplicate batches.

**Strong signals.** Asks whether ranges are half-open and whether a rewatch counts twice before writing SQL; merges intervals with a running max rather than a self-join. **Red flags.** Expanding every range to one row per second as the production design; averaging per-view percentages.

## GOO-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH cand AS (                         -- one entrant per (auction, campaign): its best ad
  SELECT DISTINCT ON (auction_id, campaign_id)
         auction_id, campaign_id, ad_rank, budget_limited
  FROM bids
  ORDER BY auction_id, campaign_id, ad_rank DESC, bid_id
), entered AS (
  SELECT c.auction_id, c.campaign_id,
         ROW_NUMBER() OVER (PARTITION BY c.auction_id
                            ORDER BY c.ad_rank DESC, c.campaign_id) AS pos
  FROM cand c
  JOIN auctions a ON a.auction_id = c.auction_id
  WHERE NOT c.budget_limited
    AND c.ad_rank >= a.min_rank
), outcome AS (
  SELECT (a.auction_ts AT TIME ZONE 'UTC')::date AS auction_date,
         c.campaign_id,
         c.budget_limited                                     AS lost_budget,
         COALESCE(e.pos <= a.slots, false)                    AS shown,
         COALESCE(e.pos = 1, false)                           AS top,
         NOT c.budget_limited AND COALESCE(e.pos > a.slots, true) AS lost_rank
  FROM cand c
  JOIN auctions a ON a.auction_id = c.auction_id
  LEFT JOIN entered e ON e.auction_id = c.auction_id AND e.campaign_id = c.campaign_id
)
SELECT auction_date, campaign_id,
       COUNT(*)                                   AS eligible,
       COUNT(*) FILTER (WHERE shown)              AS impressions,
       COUNT(*) FILTER (WHERE top)                AS top_impressions,
       ROUND(COUNT(*) FILTER (WHERE shown)::numeric       / COUNT(*), 4) AS impression_share,
       ROUND(COUNT(*) FILTER (WHERE lost_budget)::numeric / COUNT(*), 4) AS lost_budget_share,
       ROUND(COUNT(*) FILTER (WHERE lost_rank)::numeric   / COUNT(*), 4) AS lost_rank_share
FROM outcome
GROUP BY auction_date, campaign_id
ORDER BY auction_date, campaign_id;
```

**Explanation.** First reduce bids to one entrant per campaign per auction (its best ad; below Very Hard this is a no-op), which is also the eligibility grain. Rank only the campaigns that enter: not budget-limited and at or above the auction's minimum rank. Filtering before `ROW_NUMBER` is the point: a budget-limited campaign must not occupy a position. `ROW_NUMBER` (not `RANK`) with `campaign_id` as the tie-break gives distinct positions, so no auction shows more ads than it has slots. Joining the positions back onto every eligible pair classifies each pair exactly once: shown, lost to budget, or lost to rank (entered but unplaced, or below the minimum).

**Complexity.** A sort for `DISTINCT ON`, one window sort per auction (small partitions), and a hash aggregate: O(n log n) over bids. In production, outcomes are logged by the auction itself; reconstructing them is a validation job.

**Dialect notes** (described, not executed). BigQuery: no `DISTINCT ON`; use `QUALIFY ROW_NUMBER() OVER (PARTITION BY auction_id, campaign_id ORDER BY ad_rank DESC, bid_id) = 1`; `COUNTIF`; `DATE(auction_ts)` is UTC by default. Snowflake: `QUALIFY`, `COUNT_IF`, `TO_DATE(CONVERT_TIMEZONE('UTC', auction_ts))`. Spark SQL: `row_number()` in a subquery, `count_if`. MySQL 8: `ROW_NUMBER()` in CTEs and `SUM(CASE …)`; booleans are integers.

**Edge cases built into the data.** A budget-limited campaign with the highest rank in a one-slot auction (every level); auctions with 1 to 3 slots. Hard: a minimum rank per auction, including a campaign exactly at it; equal `ad_rank`s; two UTC days with auctions in the first and last minute. Very Hard: several ads of one campaign in an auction, including one where two strong ads would take both slots if counted separately.

**Common mistakes.** Ranking before removing budget-limited campaigns; `RANK()`/`DENSE_RANK()` with ties (more shown than slots); ignoring or misreading the minimum rank; counting eligibility per bid; dividing by all auctions of the day rather than eligible ones; integer division; grouping by timestamp instead of date.

**Follow-up guidance.** (1) Convert `auction_ts` to the advertiser's zone before taking date and hour; auctions near local midnight move days, and DST days have 23 or 25 hours. (2) Report the denominator as an estimate with its method, show "—" or a range when it is small, and keep definitions versioned. (3) Partition bids by auction date and cluster by `auction_id`, so ranking is a local sort; aggregation by campaign needs one shuffle of small per-auction outcomes. (4) Lost-to-budget auctions are the upper bound of extra traffic; their timing and the shown rate in comparable auctions give a rough estimate, stated as such.

**Rubric anchors.** 2: right shares for simple cases but budget-limited campaigns still take positions, or ties produce extra impressions. 3: matches the expected result. 4: also handles time zones, estimated eligibility and scale credibly.

**Strong signals.** States the auction model back before writing SQL; filters before ranking deliberately; checks that shares sum to 1. **Red flags.** Inferring "shown" from ad_rank thresholds alone without slots; presenting the simplified model as how a real ad auction works.

## GOO-L1-04

**Reference solution**

```python reference
import heapq


def trending(events, width, lateness, k, distinct_users=False):
    windows = {}      # window_start -> {query: count, or set of user_ids}
    starts = []       # min-heap of open window starts
    max_ts = None
    out, dropped = [], 0

    def emit(start):
        counts = windows.pop(start)
        if distinct_users:
            items = [(q, len(users)) for q, users in counts.items()]
        else:
            items = list(counts.items())
        out.append((start, heapq.nsmallest(k, items, key=lambda qc: (-qc[1], qc[0]))))

    for ts, user, query in events:
        start = ts - ts % width
        if max_ts is not None and start + width <= max_ts - lateness:
            dropped += 1          # its window has already closed
            continue
        w = windows.get(start)
        if w is None:
            w = windows[start] = {}
            heapq.heappush(starts, start)
        if distinct_users:
            w.setdefault(query, set()).add(user)
        else:
            w[query] = w.get(query, 0) + 1
        if max_ts is None or ts > max_ts:
            max_ts = ts
            watermark = max_ts - lateness
            while starts and starts[0] + width <= watermark:
                emit(heapq.heappop(starts))
    while starts:
        emit(heapq.heappop(starts))
    return out, dropped
```

**Explanation.** The watermark is a function of the maximum event time, so it only moves when an event raises that maximum, and only then can windows close. Open windows live in a dict plus a min-heap of their starts; closing pops from the heap while the smallest start's end is at or below the watermark. A start enters the heap once, when its window opens; a window that has closed cannot reopen, because any later event for it is dropped by the same comparison. Closed windows therefore come out in ascending start order. The top-k uses `nsmallest` on `(-count, query)`, which is the required order including the tie-break.

**Complexity.** O(log W) per event for the heap (W open windows), plus O(d log k) per window for d distinct queries: O(n log W + Σd log k) overall. Memory O(open windows × distinct queries) (× users with `distinct_users`). The timing test keeps about 2 500 windows open; a loop that scans every open window per event is around 5 × 10⁸ steps (over 11 s in CPython) and fails, while the reference runs well under a second.

**Common mistakes.** Using arrival order or processing time instead of event time; a watermark that moves back with an old event; `<` instead of `<=` at the close/drop boundary (keeping an event whose window end equals the watermark); refusing a late event that opens a not-yet-closed window; `Counter.most_common(k)` (ties by insertion order, not by query); counting searches instead of distinct users at Very Hard; rescanning all windows on every event.

**Follow-up guidance.** (1) Keep counts in a dict plus a sorted structure keyed by (−count, query) for the open window, or recompute top-k only every few hundred milliseconds; incrementing a key is a delete and an insert, O(log d). (2) Misra–Gries with k′ counters guarantees every query above n/(k′+1) is kept and undercounts by at most n/(k′+1); Count-Min gives overestimates with ε·n error at probability 1 − δ; say which error the panel can accept and show "approximate". (3) The combined watermark is the minimum of the partition watermarks; an idle partition stalls everything, so use idleness timeouts that exclude a quiet partition from the minimum. (4) Publish corrections as new versions of a window (retractions plus updates) with a version number, so consumers can choose final-only or updating views.

**Rubric anchors.** 2: correct output but scans open windows per event, or one boundary rule wrong. 3: correct and O(log W) per event with a clear argument. 4: also a credible heavy-hitters error bound and multi-partition watermark design.

**Strong signals.** Distinguishes event time from arrival time unprompted; explains why windows close in order; handles the "late but opens a new window" case deliberately. **Red flags.** Sorting the whole input by event time first (that changes which events are late); emitting a window and then mutating it.

## GOO-L1-05

**Reference solution**

```python reference
def suggest(entries, prefixes, k, blocked=None):
    totals = {}
    for text, searches in entries:
        q = ' '.join(text.lower().split())        # lowercase, trim, collapse runs of spaces
        totals[q] = totals.get(q, 0) + searches
    if blocked:
        totals = {q: n for q, n in totals.items()
                  if not any(w in blocked for w in q.split(' '))}
    # Only the prefixes someone asked for get a list; only their lengths are worth slicing.
    best = {p: [] for p in prefixes}
    lengths = sorted({len(p) for p in best})
    for q in sorted(totals, key=lambda q: (-totals[q], q)):
        for n in lengths:
            if n > len(q):
                break
            lst = best.get(q[:n])
            if lst is not None and len(lst) < k:
                lst.append(q)
    return [list(best[p]) for p in prefixes]
```

**Explanation.** Normalise, then sum: variants of one query are one query and shards add up. Blocking works on whole words, so the check splits on spaces (a substring test would remove `doughnut shop` for `dough`). Sorting the distinct queries once by `(-total, query)` puts them in suggestion order; walking that order, each requested prefix collects the first k queries that start with it, which are exactly its top k with the tie-break. A query `q` starts with a prefix of length n exactly when `q[:n]` equals it, so each query only needs one dict lookup per distinct requested length (the empty prefix is length 0 and matches everything).

**Complexity.** O(E) to sum E rows, O(Q log Q) to sort Q distinct queries, O(Q · L) slices for L distinct prefix lengths (L ≤ 9 here), O(P) to answer P prefixes. Memory O(Q + P·k). The timing test has about 200 000 rows, 115 000 distinct queries and 50 000 prefixes: the reference runs in well under a second; scanning every query per prefix is about 5 × 10⁹ checks, and even a bisected range per prefix without caching spends tens of seconds re-ranking the thousands of queries under each one-letter prefix.

**Common mistakes.** Summing before normalising; `strip()` without collapsing inner spaces; blocking by substring; ties ordered by insertion or by count only; dropping the query equal to the prefix; a scan per prefix; `heapq.nlargest(k, …, key=total)` (ties come out in the wrong order); mutating and returning the same list object for a repeated prefix (harmless here, a bug if the caller edits one answer).

**Follow-up guidance.** (1) Keep the daily table plus a small fresh-counts table merged at query time (or rebuilt every few minutes for the prefixes whose top k could change); decay old counts so news rises and falls. (2) A trie with top-k at each node costs nodes × k pointers (tens of bytes per node); compress with a radix tree, store top-k only above a depth, shard by first characters, and replicate the hot short prefixes. (3) Distinct users cannot be summed across shards (a user may appear in several); use a mergeable sketch such as HyperLogLog per query, merge sketches, and apply the threshold to the merged estimate with a safety margin. (4) Fuzzy matching with a bounded edit distance over the trie, or a separate spelling-correction step before lookup; both cost more per keystroke and need caching for short prefixes.

**Rubric anchors.** 2: correct output but a scan per prefix, or a normalisation or tie-break error. 3: correct and near-linear with a clear argument. 4: also credible on freshness, trie memory and the distinct-user privacy floor.

**Strong signals.** Notices that only the requested prefixes matter; explains why one ranked pass gives each prefix's top k; tests the empty and trailing-space prefixes. **Red flags.** Rebuilding and sorting the candidate list for every prefix; normalising prefixes differently from queries without saying so.
