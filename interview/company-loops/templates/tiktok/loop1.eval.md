# TikTok · Loop 1 — evaluator notes (hidden from candidates)

## TTK-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH per_upload AS (
  SELECT upload_id,
         (ARRAY_AGG(app_version  ORDER BY started_at))[1] AS app_version,    -- the first attempt's
         (ARRAY_AGG(network_type ORDER BY started_at))[1] AS network_type,
         MIN(started_at)                                  AS first_started_at,
         MIN(ended_at) FILTER (WHERE outcome = 'published') AS published_at,
         BOOL_OR(outcome = 'saved_draft')                 AS drafted
  FROM upload_attempts
  GROUP BY upload_id
)
SELECT app_version, network_type,
       COUNT(*) AS uploads,
       COUNT(*) FILTER (WHERE published_at <= first_started_at + INTERVAL '1 hour') AS published_within_1h,
       ROUND((COUNT(*) FILTER (WHERE published_at <= first_started_at + INTERVAL '1 hour'))::numeric
             / COUNT(*), 4) AS success_rate
FROM per_upload
WHERE published_at IS NOT NULL OR NOT drafted          -- abandoned drafts are out
GROUP BY app_version, network_type
ORDER BY app_version, network_type;
```

**Explanation.** The unit is the upload, so the attempts are collapsed to one row per `upload_id` before anything is counted. `ARRAY_AGG(… ORDER BY started_at)[1]` takes the version and network of the earliest attempt (an ordered aggregate, not `MIN` of the text, which would pick the alphabetically first value). The publish time is the published attempt's `ended_at`, and the hour runs from the first attempt's `started_at`, so a late resume that publishes quickly is still slow. `<=` keeps exactly one hour. A row with no published attempt has `published_at` NULL, so the comparison is NULL and the `FILTER` does not count it. The draft rule is a per-upload filter: drafted and never published is out; drafted and later published stays (below Hard there are no drafts and the filter changes nothing). Ordering by `started_at` rather than `attempt_id` is what the Very Hard data tests.

**Complexity.** One hash or sort aggregate over the attempts and one small aggregate over uploads: O(n log n) at worst. At scale the per-upload row is a table merged incrementally as attempts arrive.

**Dialect notes** (described, not executed). BigQuery: `ARRAY_AGG(app_version ORDER BY started_at LIMIT 1)[OFFSET(0)]`, `COUNTIF`, `LOGICAL_OR`, `TIMESTAMP_ADD(…, INTERVAL 1 HOUR)`. Snowflake: `MIN_BY(app_version, started_at)`, `COUNT_IF`, `BOOLOR_AGG`. Spark SQL: `min_by`, `count_if`, `bool_or`. MySQL 8: no ordered aggregate; use `ROW_NUMBER() OVER (PARTITION BY upload_id ORDER BY started_at)` in a CTE and conditional `SUM(CASE …)`.

**Edge cases built into the data.** Every level: uploads resumed on another network; one published exactly 60:00 after the first attempt (counts) and one at 60:01 (does not); a resume that starts late and publishes within minutes of its own start but long after the first attempt; failed and interrupted uploads never published. Hard: uploads saved as drafts and never published (excluded) and a draft published later within the hour (a success). Very Hard: attempt ids follow log arrival, so an offline phone's first attempt has a higher id than its resume, which ran on another network after an app update.

**Common mistakes.** Counting attempts (`COUNT(*)` on the log); grouping by the publishing or last attempt's network; `MIN(network_type)`; measuring from the publishing attempt's start; `<` at one hour; keeping abandoned drafts, or dropping every upload that was ever a draft; `ORDER BY attempt_id` for the first attempt; integer division for the rate.

**Follow-up guidance.** (1) `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes)` over published uploads; it describes only uploads that made it, so a version that fails more can look faster (survivorship), hence next to the rate. (2) Market and network mix confound the comparison; compare within network type (already split here) and within market, or use the rollout's staged cohorts; report the number of uploads behind each rate. (3) Only judge uploads whose first attempt is older than one hour plus a grace period; mark recent buckets as provisional rather than counting in-progress uploads as failures. (4) Keep an upload state table keyed by `upload_id` (first attempt, published time, draft flag) merged from the attempt stream; an upload is final once published, abandoned, or older than a stated cut-off; restate buckets when late logs land.

**Rubric anchors.** 2: right shape but attempts counted, or the wrong attempt's attributes. 3: matches the expected result. 4: also handles in-progress uploads and confounding credibly.

**Strong signals.** Asks what an upload is before writing SQL; asks which attempt defines the version; checks the one-hour boundary. **Red flags.** Treating `attempt_id` as time without asking; presenting the one-hour rule as a product definition.

## TTK-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH originals AS (
  SELECT v.video_id, v.creator_id, v.published_at
  FROM videos v
  WHERE NOT EXISTS (SELECT 1 FROM remixes x WHERE x.remix_video_id = v.video_id)
), eligible AS (
  SELECT o.*
  FROM originals o
  WHERE (SELECT s.remix_allowed                         -- the setting in force at publish time
         FROM remix_settings s
         WHERE s.video_id = o.video_id AND s.changed_at <= o.published_at
         ORDER BY s.changed_at DESC
         LIMIT 1)
), reach AS (
  SELECT e.video_id,
         date_trunc('week', e.published_at)::date AS week_start,
         COUNT(DISTINCT rv.creator_id) AS creators
  FROM eligible e
  LEFT JOIN remixes x ON x.source_video_id = e.video_id
  LEFT JOIN videos rv ON rv.video_id = x.remix_video_id
                     AND rv.creator_id <> e.creator_id
                     AND rv.published_at <= e.published_at + INTERVAL '7 days'
  GROUP BY e.video_id, week_start
)
SELECT week_start,
       COUNT(*)                              AS originals,
       COUNT(*) FILTER (WHERE creators > 0)  AS remixed_originals,
       SUM(creators)                         AS remix_creators,
       ROUND(SUM(creators)::numeric / COUNT(*), 2) AS creators_per_original
FROM reach
GROUP BY week_start
ORDER BY week_start;
```

**Explanation.** Originals are videos that are not remixes (an anti-join on `remix_video_id`). Eligibility is an as-of lookup: the latest setting at or before `published_at`, so a creator who turned remixing off later still counts and one who turned it on later does not; `<=` makes a change at exactly the publish time the one in force. Reach is computed per original with `COUNT(DISTINCT rv.creator_id)`; the remix-side conditions (not the original's creator, within 7 days inclusive) live in the second LEFT JOIN's `ON` clause, so an original with no qualifying remix keeps its row with a NULL creator and a count of 0. Summing per-original reaches is the intended measure: one creator who remixed three originals adds three. The week is the original's; a remix in the next week still counts there. Remixes of remixes never join to an original, because their `source_video_id` is a remix, which the anti-join excluded (below Very Hard there are none).

**Complexity.** One anti-join, an index lookup per original for the setting, two hash joins and a distinct aggregate per original: O(n log n). At scale, store each video's setting at publish time on the video row when it is published, which removes the as-of lookup.

**Dialect notes** (described, not executed). BigQuery: no `LIMIT` in a correlated scalar subquery in all positions; use `ARRAY_AGG(remix_allowed ORDER BY changed_at DESC LIMIT 1)[OFFSET(0)]` grouped by original, or a `QUALIFY ROW_NUMBER()` join; `DATE_TRUNC(DATE(published_at), WEEK(MONDAY))`. Snowflake: `ASOF JOIN … MATCH_CONDITION (o.published_at >= s.changed_at)` does the as-of lookup directly; `DATE_TRUNC('week', …)` depends on `WEEK_START`. Spark SQL: join and `max_by(remix_allowed, changed_at)` over changes at or before publish. MySQL 8: correlated subquery with `ORDER BY … LIMIT 1` works; no `FILTER`, use `SUM(CASE …)`.

**Edge cases built into the data.** Every level: one creator duets and stitches the same original; the original's creator duets it; remixes at exactly 7 days (counts) and 7 days and one second (does not); an original with no remixes; a first-week original remixed in the second week. Hard: an original turned off after its remixes (counts); an original off when published, turned on later and then remixed (excluded); originals at Sunday 23:59:59 and Monday 00:00:00 UTC. Very Hard: settings changed during the draft, one set back on exactly at publish time; stitches of duets, which reach no original.

**Common mistakes.** `COUNT(*)` of remix rows; `COUNT(DISTINCT creator_id)` per week (one creator across several originals counted once); counting the original's own creator; the latest setting instead of the one at publish; `<` instead of `<=` at 7 days; remix-side conditions in `WHERE` after the LEFT JOIN (drops zero-reach originals, and with them the denominator); grouping by the remix's week; treating every remix source as an original.

**Follow-up guidance.** (1) Two `COUNT(DISTINCT … ) FILTER (WHERE remix_type = …)` columns; a creator who did both appears in each, so duets + stitches ≥ the total; say so in the column notes. (2) A remix made while remixing was allowed stays valid after a later change; the rule here is about eligibility at publish, and the follow-up about the remix side would need the setting at each remix's time (a second as-of lookup). (3) Store `root_video_id` on each remix when it is created (one lookup of the source's root); otherwise a recursive CTE per day, which gets expensive as chains deepen and must guard against bad data. (4) Partition remixes by the original's publish day; each day only originals published in the last 7 days can change, so recompute those windows; keep per-original distinct creators as exact sets while open, then freeze.

**Rubric anchors.** 2: right shape but rows or per-week distinct creators counted, or the current setting used. 3: matches the expected result. 4: also handles lineage roots and incremental computation credibly.

**Strong signals.** Asks whether reach is per original or per week; asks which setting applies; keeps zero-reach originals deliberately. **Red flags.** Using reach to rank or judge individual creators; inferring anything about remixers from their videos.

## TTK-L1-03

**Reference solution** (PostgreSQL; `{{cutoff}}` is the instance's report time in UTC)

```sql reference
WITH s AS (                                    -- each session in the creator's local wall-clock time
  SELECT ls.creator_id,
         ls.started_at AT TIME ZONE c.time_zone AS local_start,
         COALESCE(ls.ended_at, TIMESTAMPTZ '{{cutoff}}+00') AT TIME ZONE c.time_zone AS local_end
  FROM live_sessions ls
  JOIN creators c USING (creator_id)
), pieces AS (                                 -- one piece per local date the session touches
  SELECT s.creator_id, d::date AS local_date,
         EXTRACT(EPOCH FROM LEAST(s.local_end, d + INTERVAL '1 day') - GREATEST(s.local_start, d)) / 60 AS minutes
  FROM s
  CROSS JOIN LATERAL generate_series(date_trunc('day', s.local_start), s.local_end, INTERVAL '1 day') AS d
), live AS (
  SELECT creator_id, local_date, SUM(minutes)::int AS live_minutes
  FROM pieces
  WHERE minutes > 0
  GROUP BY creator_id, local_date
), kept AS (
  SELECT ls.creator_id, (g.sent_at AT TIME ZONE c.time_zone)::date AS local_date,
         COUNT(*) AS gifts, SUM(g.coins) AS coins
  FROM gifts g
  JOIN live_sessions ls USING (session_id)
  JOIN creators c USING (creator_id)
  WHERE NOT EXISTS (SELECT 1 FROM gift_reversals r WHERE r.gift_id = g.gift_id)
  GROUP BY 1, 2
)
SELECT l.creator_id, l.local_date, l.live_minutes,
       COALESCE(k.gifts, 0) AS gifts,
       COALESCE(k.coins, 0) AS coins
FROM live l
LEFT JOIN kept k USING (creator_id, local_date)
ORDER BY l.creator_id, l.local_date;
```

**Explanation.** `AT TIME ZONE` on a `timestamptz` gives the creator's local wall-clock time as a plain timestamp, so local dates and local midnights are ordinary date arithmetic. `generate_series` from the local start's midnight to the local end lists every local date a session touches; each piece is the overlap of the session with that date, and a session ending exactly at midnight yields a zero-minute piece for the next date, which `minutes > 0` drops. Gifts are dated by their own send time, so a session across midnight contributes gifts to both dates. Reversals are excluded with `NOT EXISTS`, which is unaffected by a reversal logged twice. Minutes and gifts are aggregated separately and joined, so a live day with no kept gifts shows 0. Sessions still live (`ended_at` NULL, Very Hard) end at the cutoff. Because no daylight-saving change falls in the data, wall-clock differences equal elapsed minutes.

**Complexity.** One pass over sessions (each expands to one or two pieces), one over gifts with an anti-join to reversals, and a hash join: O(n log n) at worst.

**Dialect notes** (described, not executed). BigQuery: `DATETIME(ts, tz)` for local time, `GENERATE_DATE_ARRAY` with `UNNEST` for the dates, `DATETIME_DIFF(…, MINUTE)`. Snowflake: `CONVERT_TIMEZONE(tz, ts)`, a generator or a calendar table joined on overlap, `DATEDIFF('minute', …)`. Spark SQL: `from_utc_timestamp(ts, tz)` and `explode(sequence(to_date(start), to_date(end)))`. MySQL 8: `CONVERT_TZ(ts, '+00:00', tz)` needs the time-zone tables loaded; a recursive CTE or calendar table for the dates. Across a daylight-saving change, wall-clock subtraction is wrong in every engine; subtract the UTC instants instead.

**Edge cases built into the data.** Every level: a session crossing local midnight with gifts at 23:59:59 and 00:00:00 local (the second reversed); creators west and east of UTC, so local dates differ from UTC dates; random reversals. Hard: a half-hour zone (Asia/Kolkata); a session ending exactly at local midnight whose gifts were all reversed (a row with 0 and 0, and no row for the next date); one reversal logged twice. Very Hard: a session still live at the cutoff that crossed local midnight, and one that started within the hour before the cutoff.

**Common mistakes.** UTC dates; `started_at::date` in a session that is not UTC; the whole session on its start date; gifts dated by the session start; a LEFT JOIN to reversals with `SUM(coins) - SUM(reversed coins)` (double subtraction on a duplicate reversal); a join that multiplies gifts by reversal rows; dropping open sessions with an inner filter on `ended_at`; joining gifts to session pieces (each gift counted on both dates).

**Follow-up guidance.** (1) Keep a time-zone history (`creator_id, time_zone, valid_from`) and date each event by the zone in force at the event; reproducible restatements need that history, not the current profile. (2) Across a change, the local day is 23 or 25 hours; compute piece lengths from UTC instants (convert the local midnight back with `AT TIME ZONE`) rather than wall-clock differences. (3) Keep sessions whole in one fact table and the day split as a derived view; per-session totals are not sums of daily rows when a gift is reversed later, so derive both from the gift facts. (4) Streaming aggregates keyed by creator and local date with event-time windows; reversals as retractions that update the original day; a daily restatement job reconciles totals and marks changed days on the creator's statement.

**Rubric anchors.** 2: right shape but UTC dates, or no split at midnight. 3: matches the expected result. 4: also handles daylight saving, time-zone moves and late reversals credibly.

**Strong signals.** Asks whose time zone defines the day; checks the exact-midnight end; uses `NOT EXISTS` for reversals unprompted. **Red flags.** Reporting gift senders or anything about viewers; presenting coin values or reversal rules as a product's actual terms.

## TTK-L1-04

**Reference solution**

```python reference
def assemble_upload(file_size, ranges):
    usable = sorted((first, last, seq) for seq, first, last, ok in ranges if ok)
    chosen, pos, i, n = [], 0, 0, len(usable)
    while pos < file_size:
        best_last, best_seq = -1, None
        while i < n and usable[i][0] <= pos:          # every range starting at or before pos
            first, last, seq = usable[i]
            if last > best_last or (last == best_last and seq < best_seq):
                best_last, best_seq = last, seq
            i += 1
        if best_last < pos:                           # nothing contains byte pos
            return ("missing", pos)
        chosen.append(best_seq)
        pos = best_last + 1
    return ("complete", chosen)
```

**Explanation.** This is the classic minimum interval cover. Sorted by first byte, the pointer advances over every range that starts at or before the first uncovered byte `pos`; among them the best is the one ending furthest (ties by lowest `seq`). A range the pointer passes and does not choose can never help later: it starts at or before `pos` and ends no further than the chosen one, so it lies inside what is already covered. If the best end is before `pos`, no usable range contains `pos`, and because every byte before `pos` is covered, `pos` is the first missing byte. Failed checksums are filtered before sorting, so they can neither be chosen nor hide a gap. Inclusive bounds make the next step start at `last + 1`, so ranges that meet leave no gap.

**Complexity.** O(n log n) for the sort and O(n) for the sweep; O(n) memory. The timing test (12 000 parts plus 120 000 retried ranges, a cover of about 11 000) runs in about 0.2–0.3 s in CPython. The most likely middle approach, the same greedy that rescans every range at each step, is O(n·k): about 145 s on the ordered input and 330–390 s shuffled (estimated from 100 timed steps), so it fails. A DP over ranges (fewest ranges to reach each range's end) is O(n²) and fails by more. A heap of candidate ends keyed by start is a correct O(n log n) alternative and passes.

**Dialect notes.** Java or C++: sort an index array by first byte; the sweep is identical. In SQL, minimal covers are awkward (a recursive CTE over steps, one row per step); in Spark, sort within the upload's partition and run the sweep in `mapPartitions`. Not executed here.

**Edge cases built into the tests.** One range covering the file; adjacent ranges; byte 0 missing; a one-byte gap; the last byte missing; a range overlapping both neighbours (skipped); the first listed range is not the furthest. Hard: unordered input; a part resent twice (lower `seq`); two ranges ending on the same byte with different starts (lower `seq` wins); contained ranges. Very Hard: a failed range that reaches furthest; bytes only a failed range holds (missing); a one-byte file; one-byte ranges bridging a gap; no usable range at all (missing at 0).

**Common mistakes.** Treating ranges as half-open (a false gap between `[0, 199]` and `[200, …]`, or overlapping by one); choosing the first range that contains `pos` instead of the furthest; breaking ties by start or by position in the list; returning the end of the cover instead of the first missing byte, or `None` instead of the stated tuple; using failed ranges; rescanning everything each step; resetting the pointer each step.

**Follow-up guidance.** (1) Exchange argument: any optimal cover's first range contains byte 0; replacing it with the furthest-reaching such range covers at least as much, and induction on the remaining suffix gives the same count. (2) Keep the union of received ranges as a sorted set of disjoint intervals (merge on insert, O(log n) amortised with a balanced tree or `sortedcontainers`); the file is complete when the union is one interval `[0, size − 1]`; the minimal read plan is computed once at the end. (3) Minimising bytes read twice is a weighted problem (shortest path over range ends with overlap as cost); greedy is no longer optimal, but a DP over sorted ranges with a monotone structure works. (4) Each server reports its own merged intervals (small); a coordinator merges them, finds gaps, and assigns reads to the server holding each chosen range.

**Rubric anchors.** 2: correct small cases with a rescan per step, or one boundary rule wrong. 3: all tests pass with a single sort and sweep. 4: also proves the greedy and makes it incremental.

**Strong signals.** Asks whether bounds are inclusive; names minimum interval cover; notices that passed ranges never matter again. **Red flags.** Reading video content to "fill" gaps; treating a failed checksum as good enough.

## TTK-L1-05

**Reference solution**

```python reference
def thread_order(comments):
    info = {cid: (score, deleted) for cid, _, score, deleted in comments}
    roots, replies = [], {}
    for cid, parent, _, _ in comments:
        if parent is None or parent not in info:      # top level, or its parent was purged
            roots.append(cid)
        else:
            replies.setdefault(parent, []).append(cid)
    rank = lambda c: (-info[c][0], c)
    roots.sort(key=rank)
    for kids in replies.values():
        kids.sort(key=rank)
    order, stack = [], [(c, 0) for c in reversed(roots)]
    while stack:                                      # pre-order walk with an explicit stack
        c, depth = stack.pop()
        order.append((c, depth))
        for k in reversed(replies.get(c, ())):
            stack.append((k, depth + 1))
    shown = {}
    for c, _ in reversed(order):                      # every reply is decided before its parent
        shown[c] = not info[c][1] or any(shown[k] for k in replies.get(c, ()))
    return [(c, depth, info[c][1]) for c, depth in order if shown[c]]
```

**Explanation.** One pass builds the children index (a reply whose parent is not in the input becomes a root, Very Hard), and each sibling list is sorted once by `(-score, id)`. The walk is a pre-order DFS with an explicit stack; pushing replies in reverse means the best-ranked reply is popped first, and every subtree is finished before the next sibling is popped. Whether a deleted comment is shown depends on its subtree, a post-order fact; in the reversed pre-order every comment comes after all of its descendants, so one backward pass computes `shown` without recursion. A comment not shown has an entirely hidden subtree, so filtering the pre-order keeps exactly the shown comments, still in display order, with their depths unchanged.

**Complexity.** O(n log n) for the sibling sorts and O(n) for the walk and the backward pass; O(n) memory. The timing test (100 000 comments, one reply chain 20 000 deep) runs in about 0.5–0.8 s in CPython. Scanning every comment for each comment's replies is O(n²), estimated at 740–2 300 s on the same data. The most likely middle approach is a recursive DFS: it raises `RecursionError` at Python's default limit of 1 000 frames, on the timing test and on the 1 200–1 500-deep chain in the checked edge cases at every level, so it fails. Raising the limit with `sys.setrecursionlimit` makes a recursive walk pass here (about 0.2–0.5 s in CPython 3.13, where Python-to-Python calls do not use the C stack), but it is not an acceptable final answer: on older interpreters and in browser runtimes with a smaller stack, deep recursion can crash the process rather than raise. Ask for the iterative version; credit the candidate who names the risk. A recursive version that returns and concatenates lists per node is also O(depth²) on the chain (about 12 s here).

**Dialect notes.** Java: deep recursion overflows the thread stack similarly; use an `ArrayDeque`. C++: same, with a `vector` as the stack. In SQL, a recursive CTE can build a sort path (array of `(−score, id)` per level) and order by it, but the path is O(depth) per row, O(n·depth) overall on a deep chain; PostgreSQL's `SEARCH DEPTH FIRST BY` gives the order. Not executed here.

**Edge cases built into the tests.** A single comment; siblings by score; a subtree completed before the next sibling; a deleted reply with no replies (gone); a deleted comment with a live reply (placeholder); top-level ordering with negative scores; a chain 1 200–1 500 deep. Hard: a deleted chain above a live reply (both placeholders); a deleted subtree all the way down (gone); equal scores ordered by id; a deleted top-level comment whose replies were all deleted. Very Hard: replies listed before their parents (and the deep chain shuffled); a reply whose parent was purged shown at the top level; a deleted reply of a purged parent with a live reply below it.

**Common mistakes.** Recursion; scanning for children each time; sorting ascending by score or breaking ties by score only; deciding placeholders from direct replies only (a live grandchild under a deleted child is missed); dropping a deleted comment's live replies along with it; depth computed from list position; treating purged parents' replies as errors or dropping them; sorting siblings inside the walk on every visit.

**Follow-up guidance.** (1) Store per comment its sorted reply list (or top-k by score) and counts; page top-level comments by `(score, id)` keyset, fetch 3 replies each, and lay out lazily; placeholders need a precomputed "has live descendant" flag maintained on delete. (2) Snapshot the order when the reader opens the thread (or a version timestamp) and page within it; re-sort on refresh or on a schedule, never under the reader. (3) Read a consistent snapshot (one version of the thread table); state that deletions after the snapshot appear on the next export. (4) Partition by thread id rather than comment id so a thread lives together; for a thread too large for one machine, compute each subtree's layout locally and stitch by the parent's order, or emit sort paths and sort globally.

**Rubric anchors.** 2: correct small cases recursively or with a scan, or one rule wrong (ties, deep placeholders). 3: all tests pass with an index and an explicit stack. 4: also explains why raising the recursion limit is fragile and designs paging and partitioning.

**Strong signals.** Asks how deep threads get before choosing recursion; separates pre-order layout from the post-order placeholder decision; names the reversed pre-order trick. **Red flags.** Inspecting or reasoning about what comments say; ordering by anything other than the given score and id.
