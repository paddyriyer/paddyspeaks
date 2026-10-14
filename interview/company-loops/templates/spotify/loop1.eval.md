# Spotify · Loop 1 — evaluator notes (hidden from candidates)

## SPT-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH ev AS (                           -- a retried event is one event
  SELECT DISTINCT ON (playlist_id, user_id, track_id, action, event_ts)
         event_id, playlist_id, user_id, track_id, action, event_ts
  FROM playlist_events
  ORDER BY playlist_id, user_id, track_id, action, event_ts, event_id
), seq AS (                            -- every event with the one that follows it for the same track
  SELECT ev.*,
         LEAD(action)   OVER w AS next_action,
         LEAD(user_id)  OVER w AS next_user,
         LEAD(event_ts) OVER w AS next_ts
  FROM ev
  WINDOW w AS (PARTITION BY playlist_id, track_id ORDER BY event_ts, event_id)
), adds AS (
  SELECT s.playlist_id, s.user_id,
         (s.next_action = 'remove'
          AND s.next_user <> s.user_id
          AND s.next_ts - s.event_ts <= INTERVAL '24 hours') AS removed_by_other
  FROM seq s
  JOIN playlists p ON p.playlist_id = s.playlist_id
  WHERE s.action = 'add'
    AND p.is_collaborative
)
SELECT playlist_id, user_id,
       COUNT(*)                                    AS additions,
       COUNT(*) FILTER (WHERE removed_by_other)    AS removed_by_others,
       ROUND(COUNT(*) FILTER (WHERE removed_by_other)::numeric / COUNT(*), 4) AS removed_share
FROM adds
GROUP BY playlist_id, user_id
ORDER BY playlist_id, user_id;
```

**Explanation.** Collapse retried rows first (below Very Hard this is a no-op), then give every event the event that follows it for the same playlist and track. Because adds and removes of one track alternate, the event after an addition is either its removal or nothing; pairing by `LEAD` rather than by a join is what keeps a removal after a re-add from being credited to the first addition. The filter to additions comes after the window function, the collaborative-playlist filter with it. An addition with no next event has NULL `next_action`, so the boolean is NULL and `FILTER (WHERE …)` does not count it. The 24-hour test is inclusive; in a UTC session `next_ts - event_ts` is an exact elapsed interval, and `INTERVAL '1 day'` compares equal to `INTERVAL '24 hours'`.

**Complexity.** One sort for `DISTINCT ON`, one for the window by `(playlist_id, track_id, event_ts, event_id)`, then a hash aggregate: O(n log n). At scale the window partitions by playlist, which parallelises cleanly; a single huge playlist is a skewed partition but still small in absolute terms.

**Dialect notes** (described, not executed). BigQuery: no `DISTINCT ON` or named `WINDOW` in older code; dedupe with `QUALIFY ROW_NUMBER() OVER (PARTITION BY playlist_id, user_id, track_id, action, event_ts ORDER BY event_id) = 1`; `TIMESTAMP_DIFF(next_ts, event_ts, SECOND) <= 86400`; `COUNTIF`. Snowflake: `QUALIFY`, `DATEDIFF('second', …)` (counts boundaries crossed, so prefer `TIMESTAMPDIFF` on seconds or compare `next_ts <= DATEADD(hour, 24, event_ts)`), `COUNT_IF`. Spark SQL: `lead()`, `count_if`, `unix_timestamp` differences. MySQL 8: `LEAD` works; no `FILTER` or `DISTINCT ON`: `SUM(CASE …)` and `ROW_NUMBER()`; `TIMESTAMPDIFF(SECOND, …)`.

**Edge cases built into the data.** A removal by another member exactly 24 hours after the addition (counts) and one at 24 hours and one second (does not); a self-removal within minutes; additions never removed; removals after more than a day. Hard: a track removed by its adder, re-added by another member and removed by a third within 24 hours of the first addition; random re-adds; a non-collaborative playlist edited by its owner. Very Hard: retried rows, including a retried addition whose removal by another member counts.

**Common mistakes.** Joining each addition to any later removal of the track (credits the re-add's removal to the first addition); filtering to `add` before `LEAD`; partitioning by playlist only (the next event is another track's); `<` instead of `<=` at 24 hours; counting self-removals; deduplicating after `LEAD`, or by `event_id` (the retries have distinct ids); integer division in the share; keeping non-collaborative playlists.

**Follow-up guidance.** (1) Replay the log per (playlist, track) and keep tracks whose last event is an add; gaps in the log make "still there" uncertain, so reconcile against a periodic snapshot of contents. (2) Order by server receipt for pairing but keep device time for the 24-hour test, or define the window on server time and say so; offline edits can arrive after the window, so the metric needs a lateness bound before it is final. (3) Small denominators: require a minimum number of additions, show counts beside the share, or shrink toward the global rate. (4) Partition by event date and keep yesterday's open additions (no next event yet) as state; each day pairs today's events with that state, and a day's numbers are final 24 hours after its end.

**Rubric anchors.** 2: right shape but pairs additions with any later removal, or counts self-removals. 3: matches the expected result. 4: also handles offline edits, small samples and incremental computation credibly.

**Strong signals.** Asks how a re-added track is paired before writing SQL; dedupes on content rather than `event_id`; checks the 24-hour boundary. **Red flags.** A correlated subquery per addition scanning all later events; treating the current contents of a playlist as recoverable without a full log.

## SPT-L1-02

**Reference solution** (PostgreSQL; `{{min_streams}}` is the instance's floor, 1 at Medium)

```sql reference
WITH s AS (
  SELECT st.album_id, st.market,
         (st.stream_ts AT TIME ZONE m.tz)::date - a.release_date AS day_no
  FROM streams st
  JOIN markets m ON m.market = st.market
  JOIN albums a  ON a.album_id = st.album_id
)
SELECT album_id, market,
       COUNT(*)                                AS first_week_streams,
       COUNT(*) FILTER (WHERE day_no = 0)      AS release_day_streams,
       ROUND(COUNT(*) FILTER (WHERE day_no = 0)::numeric / COUNT(*), 4) AS release_day_share
FROM s
WHERE day_no BETWEEN 0 AND 6
GROUP BY album_id, market
HAVING COUNT(*) >= {{min_streams}}
ORDER BY album_id, market;
```

**Explanation.** `timestamptz AT TIME ZONE zone` gives the wall-clock time in that zone (a `timestamp` without zone), so its date is the local date, with daylight saving applied for that instant. Date minus date is an integer in PostgreSQL, so the day number is exact and the first week is days 0 to 6 whatever the clocks did. Release day and first week are then filters on one integer. The floor is "at least", applied to first-week streams after filtering.

**Complexity.** One pass over streams with two small hash joins and a hash aggregate: O(n). At scale the date conversion is per row and cheap; the cost is reading streams, so a pre-aggregate by (album, market, local date) is the natural serving table.

**Dialect notes** (described, not executed). BigQuery: `DATE(stream_ts, m.tz)` gives the local date; `DATE_DIFF(local_date, release_date, DAY)`; `COUNTIF`. Snowflake: `CONVERT_TIMEZONE(m.tz, stream_ts)::date`; `DATEDIFF('day', release_date, local_date)`; `COUNT_IF`. Spark SQL: `to_date(from_utc_timestamp(stream_ts, tz))` (its timestamps are session-zone instants, so check the session zone is UTC) and `datediff(local_date, release_date)`. MySQL 8: `CONVERT_TZ(stream_ts, '+00:00', tz)` needs the time zone tables loaded, otherwise it returns NULL; `DATEDIFF`.

**Edge cases built into the data.** Streams at local 00:00:00 on release day and at 23:59:59 on day 6 in every market; streams shortly after local midnight and shortly before it, which fall on another UTC date in markets far from UTC (including UTC+5:30). Hard: streams after the first week, including the first second of day 7; one pair exactly at the floor and one a stream short. Very Hard: release weeks containing the European or US clock change, with streams in the last local hour of day 6, which 168 hours from the release instant would miss.

**Common mistakes.** Taking the date in UTC (or in the session zone); `stream_ts::date` with a non-UTC session; `BETWEEN 0 AND 7`; the week as `release + INTERVAL '7 days'` built from a UTC midnight, or 168 hours from the local midnight; the floor as `>` instead of `>=`; applying the floor to all streams instead of first-week streams; integer division.

**Follow-up guidance.** (1) Bucket by local hour from the same local timestamp; on a fall-back day one local hour occurs twice (keep both, labelled with the offset) and on a spring-forward day one hour does not exist, so the axis has 23 or 25 buckets. (2) Per-listener zones match the listener's experience but make "release day" differ inside a market; per-market zones make the report comparable; whichever is chosen, store it in the definition. (3) Pre-aggregate by (album, market, local date) using each market's zone at write time, or by UTC hour with offsets that are multiples of 15 minutes (UTC hours alone cannot place a +5:30 or +5:45 market's midnight); partition streams by UTC date. (4) Keep a lateness bound (three days here), mark first-week numbers provisional until release + 7 days + the bound, and recompute affected days when late data lands.

**Rubric anchors.** 2: right aggregation but days in UTC, or the week boundary off by one. 3: matches the expected result. 4: also explains DST-safe boundaries and the pre-aggregation grain.

**Strong signals.** Asks which time zone defines release day before writing SQL; compares dates, not hours; mentions the half-hour zone. **Red flags.** Hard-coding offsets per market (wrong across DST); converting with string manipulation.

## SPT-L1-03

**Reference solution** (PostgreSQL; `{{year}}` and `{{next_year}}` are the instance's summary year and the year after)

```sql reference
WITH counted AS (                      -- this exercise's counting rules
  SELECT p.listener_id, t.artist_id, p.ms_played, p.played_at
  FROM plays p
  JOIN tracks t ON t.track_id = p.track_id
  WHERE p.ms_played >= 30000
    AND NOT p.private_session
    AND p.played_at >= TIMESTAMPTZ '{{year}}-01-01 00:00:00+00'
    AND p.played_at <  TIMESTAMPTZ '{{next_year}}-01-01 00:00:00+00'
), per_artist AS (
  SELECT listener_id, artist_id,
         SUM(ms_played)  AS total_ms,
         MIN(played_at)  AS first_play
  FROM counted
  GROUP BY listener_id, artist_id
), ranked AS (
  SELECT per_artist.*,
         ROW_NUMBER() OVER (PARTITION BY listener_id
                            ORDER BY total_ms DESC, first_play, artist_id) AS artist_rank
  FROM per_artist
)
SELECT listener_id, artist_rank, artist_id,
       ROUND(total_ms / 60000.0, 1) AS minutes
FROM ranked
WHERE artist_rank <= 5
ORDER BY listener_id, artist_rank;
```

**Explanation.** Every rule about which plays count is applied once, before aggregation, so the minutes and the tie-break see the same plays: a short or private play neither adds minutes nor counts as a "first play". Aggregating per listener and artist gives the total and the first counted play; `ROW_NUMBER` over `total_ms DESC, first_play, artist_id` is fully deterministic and returns exactly five rows. Ranking uses milliseconds; rounding happens only in the output.

**Complexity.** A scan of plays, a hash join to tracks, a hash aggregate per (listener, artist), and a window sort within each listener's handful of artists: O(n + A log A) for A listener–artist pairs. At hundreds of millions of listeners this parallelises by listener with no global sort.

**Dialect notes** (described, not executed). BigQuery: `QUALIFY ROW_NUMBER() OVER (…) <= 5`; `ROUND(total_ms / 60000, 1)` returns FLOAT64 (half away from zero, but binary floats can surprise at .x5; use `NUMERIC` if it matters); `TIMESTAMP('{{year}}-01-01')` is UTC. Snowflake: `QUALIFY`; `ROUND` on a NUMBER is half away from zero. Spark SQL: `row_number()` in a subquery; `round` is HALF_UP. MySQL 8: `ROW_NUMBER()` in a CTE; booleans as `private_session = 0`.

**Edge cases built into the data.** Plays of exactly 30 000 ms (count) and 29 999 ms (do not); two artists tied on counted milliseconds for fifth place, where the one played first has the larger `artist_id`; a short play for the tie loser that would break the tie if counted. Hard: plays at the first and last second of the year (count) and one second either side (do not), large enough to change ranks; private-session plays long enough to enter the top five; a listener with only three artists, plus one artist they only played briefly. Very Hard: the tie loser's very first plays are short and come before the winner's first counted play.

**Common mistakes.** Filtering short plays after computing the first play; `RANK()`/`DENSE_RANK()` (six rows on a tie); breaking ties by `artist_id` only; ranking on rounded minutes; `EXTRACT(YEAR FROM played_at)` in a non-UTC session, or `BETWEEN` including midnight of the next year; `ms_played > 30000`; `LIMIT 5` on the whole result; counting private sessions.

**Follow-up guidance.** (1) Aggregate per (listener, artist) in a job partitioned by listener hash, keep a bounded top five per listener (a heap or `ROW_NUMBER` within a partition), validate a sample against an independent computation, and publish atomically before the reveal date. (2) Recompute that listener's card from the remaining history (deletion must propagate to derived data), or hide the card if a recomputation is impossible before display; document the rule. (3) Convert each play to the listener's zone for the year boundary; plays in the first or last hours of the year move between years, so the cut-off must be recorded with the listener's zone at the time. (4) Credit full minutes to each credited artist (artists' totals then exceed the listener's time) or split them; either is defensible if the card's wording matches it.

**Rubric anchors.** 2: right top five in simple cases but ties or short plays mishandled. 3: matches the expected result. 4: also designs the yearly computation at scale and handles deletions.

**Strong signals.** Asks whether short plays count for the tie-break; chooses `ROW_NUMBER` and explains why; uses half-open ranges. **Red flags.** Non-deterministic order inside ties; treating the summary as a public ranking of listeners.

## SPT-L1-04

**Reference solution**

```python reference
from bisect import bisect_left


def reorder_moves(old, new):
    # Match copies in order: the k-th copy of a track in old is the k-th copy in new.
    where = {}
    copies = {}
    for i, t in enumerate(old):
        k = copies.get(t, 0)
        copies[t] = k + 1
        where[(t, k)] = i
    copies = {}
    seq, added = [], 0
    for t in new:
        k = copies.get(t, 0)
        copies[t] = k + 1
        i = where.get((t, k))
        if i is None:
            added += 1
        else:
            seq.append(i)
    removed = len(old) - len(seq)
    # Longest increasing subsequence of old positions, by patience sorting.
    tails = []
    for p in seq:
        j = bisect_left(tails, p)
        if j == len(tails):
            tails.append(p)
        else:
            tails[j] = p
    return (removed, added, len(seq) - len(tails))
```

**Explanation.** Kept entries that are not moved keep their relative order, so they form an increasing subsequence of their old positions read in new order; every other kept entry must be moved, and moving each of them once is enough (place each in turn next to an entry already in its final relative order). So the fewest moves is kept − LIS. Removals and additions are separate operations and do not affect which kept entries can stay. Copies of one track are matched in order (`(track, k)` keys), which turns duplicates into distinct labels. Patience sorting: `tails[k]` is the smallest last element of an increasing subsequence of length k + 1; `bisect_left` because positions are distinct and the subsequence must be strictly increasing.

**Complexity.** O(n) for the maps, O(n log n) for the LIS; memory O(n). The timing test has 200 000 entries with half of them swapped: the reference takes about half a second, while the quadratic DP is ~2 × 10¹⁰ steps (the DP alone takes about a second at n = 5 000 in CPython).

**Common mistakes.** Counting positions that changed; LCS by the O(n²) table; `list.index` inside a loop (O(n²)); counting additions or removals as moves; `bisect_right` (harmless here because positions are distinct, but wrong for a non-strict variant; ask them why); matching copies by a dict from track to one position (the second copy overwrites the first); returning a list instead of a tuple is fine, a wrong order of the three numbers is not.

**Follow-up guidance.** (1) Keep a predecessor array alongside `tails` to recover one LIS; the entries outside it are the moves; apply them in new order, each placed right after its predecessor in the new list (or at the top). (2) Three-way merge: compute both diffs against the base, apply non-overlapping operations from both, and treat the same track moved to two places, or moved by one and removed by the other, as conflicts resolved by a rule (last writer by server time, or keep both positions out); version vectors per playlist detect concurrency. (3) Most edits touch few entries: sync sends the client's operations instead of recomputing a diff, and the server recomputes a full diff only when clients diverge; or diff in blocks with hashes to find the changed region first.

**Rubric anchors.** 2: correct answer with O(n²) LIS or LCS. 3: correct O(n log n) with a clear reduction. 4: also recovers the moves and discusses concurrent edits.

**Strong signals.** Reduces to LIS quickly and proves why n − LIS suffices; tests the reversed and single-move cases. **Red flags.** Counting changed positions; sorting the new list (destroys the order being measured).

## SPT-L1-05

**Reference solution**

```python reference
def shortest_completion(plays, album):
    need = set(album)
    seqs = {}
    if plays and len(plays[0]) == 2:                       # (listener, track), in time order
        for listener, track in plays:
            seqs.setdefault(listener, []).append(track)
    else:                                                  # (ts, listener, track[, ms_played])
        kept = [p for p in plays if len(p) < 4 or p[3] >= 30000]
        kept.sort(key=lambda p: p[0])                      # stable: equal ts keep arrival order
        for p in kept:
            seqs.setdefault(p[1], []).append(p[2])
    out = {}
    for listener, seq in seqs.items():
        counts, have, left, best = {}, 0, 0, None
        for right, t in enumerate(seq):
            if t in need:
                counts[t] = counts.get(t, 0) + 1
                if counts[t] == 1:
                    have += 1
            while have == len(need):
                if best is None or right - left + 1 < best[0]:
                    best = (right - left + 1, left)
                u = seq[left]
                if u in need:
                    counts[u] -= 1
                    if counts[u] == 0:
                        have -= 1
                left += 1
        if best is not None:
            out[listener] = best
    return out
```

**Explanation.** Each listener's sequence is independent, so group first (sorting by timestamp with Python's stable sort keeps arrival order for equal timestamps; short plays are dropped before grouping so they take no index). Then the classic minimum window: the right pointer adds plays, a count per album track and a counter of distinct album tracks present tell when the window holds the whole album, and the left pointer shrinks it while it still does. Every minimal window is visited at its right end, and recording only strictly shorter windows keeps the earliest start for a length, because right ends are visited in increasing order.

**Complexity.** O(n log n) for the sort (O(n) at Medium), then O(n) for the windows: each play enters and leaves the window once. Memory O(n). The timing test has 300 000 plays over three listeners with one album track every few thousand plays: the reference runs in about 0.1–0.2 s; scanning forward from every start takes over 3 s on a tenth of the input and is quadratic in the gap between rare plays.

**Common mistakes.** One sequence for all listeners; a set per window (O(window) per step); recording `<=` (gives the latest start on ties); sorting by `(ts, track)`, which reorders a listener's equal-ts plays (`(ts, listener)` is harmless because Python's sort is stable); keeping short plays and skipping them only when counting (they still take indices); returning listeners who never complete with a sentinel instead of leaving them out.

**Follow-up guidance.** (1) Medians over completers only are biased toward fast completions; report the completion rate alongside, or a survival-style view (share completed within N plays). (2) Streaming: per (listener, album), keep the last position of each album track; when a play arrives, the current shortest window ending now starts at the minimum of those positions, so state is O(album size) per listener–album, and only albums the listener has touched need state. (3) Index album membership track → albums, process each listener's sequence once, and update per-album last-seen positions for the albums of each play; cost is proportional to plays times albums per track, not plays times all albums.

**Rubric anchors.** 2: correct with a scan per start, or a window with a tie error. 3: correct O(n) window with grouping and the level's ordering and filtering rules. 4: also the streaming formulation and the many-albums restructuring.

**Strong signals.** Groups per listener first; explains why strictly-shorter updates give the earliest start; drops short plays before indexing. **Red flags.** Producing per-listener output for a report rather than aggregates; sorting the whole input by track.
