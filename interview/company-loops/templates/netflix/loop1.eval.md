## NFX-L1-01

**Reference solution** (PostgreSQL). `{{gap_s}}` is the session gap in seconds ({{gap_min}} minutes × 60) at Hard and Very Hard; at Medium the generator sets it to −1, so every play starts its own session, which is the Medium rule.

```sql reference
WITH p AS (                              -- previews are not plays (none at Medium)
  SELECT * FROM plays WHERE NOT is_preview
), gaps AS (
  SELECT p.*,
         LAG(stopped_at) OVER (PARTITION BY profile_id, title_id
                               ORDER BY started_at, play_id) AS prev_stop
  FROM p
), numbered AS (                         -- a new session unless it starts within the gap
  SELECT g.*,
         SUM(CASE WHEN prev_stop IS NULL
                    OR started_at > prev_stop + make_interval(secs => {{gap_s}})
                  THEN 1 ELSE 0 END)
           OVER (PARTITION BY profile_id, title_id
                 ORDER BY started_at, play_id) AS session_no
  FROM gaps g
), sessions AS (
  SELECT profile_id, title_id, session_no,
         (ARRAY_AGG(country ORDER BY started_at, play_id))[1]          AS country,
         (ARRAY_AGG(start_position_s ORDER BY started_at, play_id))[1] AS first_position_s,
         MAX(end_position_s)                                           AS furthest_s
  FROM numbered
  GROUP BY profile_id, title_id, session_no
)
SELECT title_id, country,
       COUNT(*)                                          AS plays,
       COUNT(*) FILTER (WHERE furthest_s < {{n_sec}})    AS early_stops,
       ROUND(COUNT(*) FILTER (WHERE furthest_s < {{n_sec}})::numeric / COUNT(*), 4) AS early_stop_rate
FROM sessions
WHERE first_position_s = 0               -- a resumed session is not a start (Very Hard)
GROUP BY title_id, country
HAVING COUNT(*) >= {{min_plays}}
ORDER BY early_stop_rate DESC, title_id, country;
```

**Explanation.** Previews are removed first, because a preview sitting just before a real play would otherwise join its session and change where that session starts. `LAG(stopped_at)` per profile and title gives the previous play's stop; a play opens a new session when there is no previous play or it starts more than the gap after that stop (exactly the gap still continues the session). A running `SUM` of those flags numbers the sessions: classic gaps and islands. Each session is then reduced to its country and starting position (from its first play) and its furthest position (`MAX(end_position_s)`, not the last play's end: a viewer who watched 40 minutes and then restarted the opening did not abandon). Resumed sessions (first position not 0) are excluded before counting, so they leave both the numerator and the denominator. The floor is a `HAVING COUNT(*) >= floor` on the counted sessions, and the rate is a numeric division rounded to 4 places.

**Complexity.** One sort per (profile, title) partition for the window functions, then two hash aggregates: O(n log n) over plays. In production, sessions are usually built once in a sessionisation job and stored; this query would read the session table.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `LAG` and windowed `SUM` are the same; use `TIMESTAMPADD(second, …)` / `TIMESTAMP_ADD(… INTERVAL n SECOND)`, `COUNT_IF` / `COUNTIF`, and `ARRAY_AGG(…)[OFFSET(0)]` (BigQuery) or `MIN_BY(start_position_s, started_at)` (Snowflake, Databricks SQL) for the first play. Spark SQL: `min_by`, `count_if`. MySQL 8: window functions exist; no `FILTER`, use `SUM(CASE …)`.

**Edge cases built into the data.** One title and country with exactly the floor of plays, one of which stops at exactly N minutes (every level); pairs below the floor; a profile restarting a title exactly G minutes and 1 second after stopping (two sessions). Hard: previews; sessions of two or three plays with gaps of exactly G minutes; a rewind (furthest position earlier than the last play's end). Very Hard: resumed sessions that would be early stops and others that would not; a preview immediately followed by a resumed play.

**Common mistakes.** Wall-clock duration instead of position; `<=` at N minutes; a strict floor (`>`); integer division; filtering previews after sessionising; a gap test with `>=` (splitting at exactly G minutes); the last play's end instead of the maximum; excluding resumed plays rather than resumed sessions; ordering only by the rate.

**Follow-up guidance.** (1) Parameterise N, add device type to the grouping, and show the floor's effect openly ("hidden: fewer than k plays"); a 30-second threshold mostly measures previews and accidental clicks. (2) Treat "skip intro/recap" and "next episode" actions as their own outcome; per-episode thresholds or position relative to the end of the recap. (3) Sessionise per (profile, title) with state carried across the partition boundary: process day D with the open sessions of D−1, or allow a late window and restate. (4) Compare against a holdout or the same title in countries without the change, check novelty effects, and keep the definition fixed during the test.

**Rubric anchors.** 2: correct Medium aggregation but wall-clock time, an off-by-one boundary, or sessions built by grouping on date. 3: matches the expected result at the level attempted. 4: also explains session design trade-offs, the floor's purpose and the causal caveat.

**Strong signals.** Asks what a "play" is before writing SQL; states the boundary rules back; sanity-checks one session by hand. **Red flags.** Dividing integers; dropping the floor because "the sample is small"; treating previews as viewing.

## NFX-L1-02

**Reference solution** (PostgreSQL). `{{min_view_minutes}}` is 1 below Very Hard (every session has at least one minute, so every viewer counts).

```sql reference
WITH tagged AS (                          -- half-open weeks: [Monday 00:00, next Monday 00:00)
  SELECT s.*,
         CASE WHEN started_at >= TIMESTAMPTZ '{{prev_week_start}} 00:00:00+00'
               AND started_at <  TIMESTAMPTZ '{{week_start}} 00:00:00+00'      THEN 'prev'
              WHEN started_at >= TIMESTAMPTZ '{{week_start}} 00:00:00+00'
               AND started_at <  TIMESTAMPTZ '{{next_week_start}} 00:00:00+00' THEN 'curr'
         END AS wk
  FROM viewing_sessions s
), title_week AS (
  SELECT country, title_id, wk, SUM(minutes_viewed) AS minutes
  FROM tagged WHERE wk IS NOT NULL
  GROUP BY country, title_id, wk
), shares AS (                            -- denominator: every title in the country that week
  SELECT country, title_id, wk,
         ROUND(100.0 * minutes / SUM(minutes) OVER (PARTITION BY country, wk), 2) AS pct
  FROM title_week
), viewers AS (                           -- distinct profiles with enough minutes this week
  SELECT country, title_id, COUNT(*) AS n
  FROM (SELECT country, title_id, profile_id
        FROM tagged WHERE wk = 'curr'
        GROUP BY country, title_id, profile_id
        HAVING SUM(minutes_viewed) >= {{min_view_minutes}}) v
  GROUP BY country, title_id
), candidates AS (
  SELECT c.country, c.title_id,
         COALESCE(p.pct, 0)         AS prev_share_pct,
         c.pct                      AS curr_share_pct,
         c.pct - COALESCE(p.pct, 0) AS gain_pts
  FROM shares c
  JOIN viewers v ON v.country = c.country AND v.title_id = c.title_id
  LEFT JOIN shares p ON p.country = c.country AND p.title_id = c.title_id AND p.wk = 'prev'
  WHERE c.wk = 'curr' AND v.n >= {{min_viewers}} AND c.pct - COALESCE(p.pct, 0) > 0
), ranked AS (
  SELECT candidates.*, RANK() OVER (PARTITION BY country ORDER BY gain_pts DESC) AS gain_rank
  FROM candidates
)
SELECT country, title_id, prev_share_pct, curr_share_pct, gain_pts, gain_rank
FROM ranked
WHERE gain_rank <= {{top_k}}
ORDER BY country, gain_rank, title_id;
```

**Explanation.** Each session is tagged with its week using half-open ranges, so a session at exactly Monday 00:00:00 belongs only to the week that starts then and sessions outside the two weeks drop out. Minutes are summed per (country, title, week); a window `SUM` over (country, week) gives the denominator from all titles, which is why the share is computed before any candidate filter. Viewers come from the raw current-week sessions grouped by profile, so a profile counts once and, at Very Hard, only if its minutes summed over sessions reach the minimum. The current week is LEFT-joined to the previous one with `COALESCE(…, 0)`, so titles that are new this week keep their whole share as gain. Candidates must meet the threshold and have a strictly positive gain; `RANK()` keeps ties and skips the following rank, and the filter `gain_rank <= K` keeps everyone tied at the cut-off.

**Complexity.** A scan and hash aggregate of the sessions, a small window over (country, title, week) rows, and a sort per country for the rank: O(n) plus O(t log t) for t titles. The distinct-viewer count is the expensive part at scale.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(started_at), WEEK(MONDAY))` — its default week starts on Sunday; `COUNT(DISTINCT …)` is exact, `APPROX_COUNT_DISTINCT` is HyperLogLog-based. Snowflake: `DATE_TRUNC('week', …)` depends on the `WEEK_START` session parameter; `QUALIFY RANK() … <= K`. Spark SQL: `date_trunc('week', …)` starts on Monday; `approx_count_distinct`. MySQL 8: `RANK()` in a derived table; `WEEKDAY()` arithmetic for Monday weeks.

**Edge cases built into the data.** Two titles with identical minutes in both weeks (an exact tie); a title not viewed last week; a title with exactly the threshold of viewers; a title with a big rise but one viewer short, one of whose viewers came back twice more (sessions are not viewers). Hard: sessions at Monday 00:00:00 and Sunday 23:59:59, and sessions in the weeks before and after, including the next Monday 00:00:00. Very Hard: light viewers below the minute minimum, a viewer reaching exactly the minimum over two sessions, and a title that qualifies only if light viewers count.

**Common mistakes.** Ranking raw minutes or the ratio of shares; computing shares over candidates only; an inner join that drops new titles; `ROW_NUMBER` or `DENSE_RANK`; `COUNT(*)` of sessions for viewers; `BETWEEN` week bounds; comparing `started_at::date` to a Sunday without considering the time zone; applying the minute minimum per session instead of per viewer.

**Follow-up guidance.** (1) Convert to each country's local time before deciding the week (countries with several time zones need a rule); sessions near local midnight between Sunday and Monday move weeks, and the cut-off differs by country. (2) Approximate counts are fine for ranking well above the threshold but not for the threshold itself; count exactly for titles near it, or publish with a margin. (3) Compare a launch against a baseline that accounts for days available (minutes per day since launch) or wait for a full week; state the rule. (4) Freeze a week's result at a defined cut-off, record late data separately, and publish restatements explicitly with a version.

**Rubric anchors.** 2: shares and gains right, but ties handled with ROW_NUMBER, new titles dropped, or the denominator filtered. 3: matches the expected result. 4: also handles local weeks, approximate distinct counts and restatements convincingly.

**Strong signals.** Asks whether the denominator includes non-candidates; checks the tie rule before choosing a ranking function. **Red flags.** Averaging daily shares into a weekly share; "the top K is always K rows".

## NFX-L1-03

**Reference solution** (PostgreSQL). `{{as_of}}` is the snapshot time; below Very Hard no stream is open and no device overlaps itself, so the `COALESCE` and `COUNT(DISTINCT device_id)` change nothing.

```sql reference
WITH s AS (                               -- an open stream runs until the snapshot
  SELECT account_id, device_id, started_at,
         COALESCE(ended_at, TIMESTAMPTZ '{{as_of}}') AS ended_at
  FROM streams
), pieces AS (                            -- one piece per UTC day the stream covers, [start, end)
  SELECT s.account_id, s.device_id, d::date AS stream_date,
         GREATEST(s.started_at, d)                AS p_start,
         LEAST(s.ended_at, d + INTERVAL '1 day')  AS p_end
  FROM s
  CROSS JOIN LATERAL generate_series(date_trunc('day', s.started_at),
                                     s.ended_at - INTERVAL '1 microsecond',
                                     INTERVAL '1 day') AS d
), concurrency AS (                       -- devices playing at each piece's start
  SELECT a.account_id, a.stream_date, a.p_start,
         COUNT(DISTINCT b.device_id) AS playing
  FROM pieces a
  JOIN pieces b
    ON b.account_id = a.account_id
   AND b.stream_date = a.stream_date
   AND b.p_start <= a.p_start AND a.p_start < b.p_end
  GROUP BY a.account_id, a.stream_date, a.p_start
), peaks AS (
  SELECT account_id, stream_date, MAX(playing) AS peak
  FROM concurrency
  GROUP BY account_id, stream_date
)
SELECT pk.stream_date, pl.plan_name,
       COUNT(*)     AS accounts_over_limit,
       MAX(pk.peak) AS peak_streams
FROM peaks pk
JOIN accounts a ON a.account_id = pk.account_id
JOIN plans pl   ON pl.plan_id = a.plan_id
WHERE pk.peak > pl.max_streams
GROUP BY pk.stream_date, pl.plan_name
ORDER BY pk.stream_date, pl.plan_name;
```

**Explanation.** An open stream is closed at the snapshot time. Every stream is cut into one piece per UTC day it covers, clipped to that day; ending the series at `ended_at − 1 µs` keeps a stream that ends at exactly midnight off the next day. Concurrency only rises when a piece starts, and a piece of a stream already playing at midnight starts at 00:00:00, so evaluating each piece's start covers every instant where a peak can occur, including the carry-over into the new day. At each such instant the self join counts the devices whose piece covers it, with the half-open test `start <= t < end`. The peak per (account, day) is compared strictly with the plan's limit, and the over-limit accounts are counted and their peaks maximised per (day, plan).

**Complexity.** The day split multiplies rows by the days covered (about 1). The self join is O(k²) per (account, day) for k pieces; with k small it is fine. A sweep (`SUM(+1/−1) OVER (PARTITION BY account, day ORDER BY t, delta)` with −1 before +1 at equal t) is O(k log k) and the better answer at scale.

**Dialect notes** (described, not executed). BigQuery: `GENERATE_TIMESTAMP_ARRAY` or `GENERATE_DATE_ARRAY` with `UNNEST` for the day split; `TIMESTAMP_TRUNC(…, DAY)`. Snowflake: no `generate_series`; join to a calendar table or `TABLE(GENERATOR(…))` with `DATEADD`. Spark SQL: `explode(sequence(to_date(started_at), to_date(ended_at - INTERVAL 1 MICROSECOND)))`. MySQL 8: a recursive CTE or a calendar table; `GREATEST`/`LEAST` exist.

**Edge cases built into the data.** For every level: two accounts on different plans over the limit; an account whose (limit + 1)-th stream starts exactly when another ends (not over); plans whose limits vary by seed. Hard: an account over the limit on both sides of midnight with every stream started before midnight; one whose crossing stream only becomes a problem after midnight; one whose streams all end at exactly 00:00:00. Very Hard: a device that reconnected while its old row was still open (one stream); a stream with `ended_at` NULL that pushes an account over the limit before the snapshot.

**Common mistakes.** Inclusive ends (`<=` or `BETWEEN`); `>=` against the limit; assigning a stream only to the day it started; evaluating only at stream starts without the midnight pieces; `ended_at::date` making a midnight end count on the next day; counting rows instead of devices; dropping open streams; computing peaks per plan without going through accounts.

**Follow-up guidance.** (1) Replace the self join with an event sweep per account and day; at scale, partition by account. (2) Per-account state of active devices with heartbeats and a lease (a device that stops sending heartbeats for n seconds is released); start requests check and reserve atomically; decide the behaviour when the state store is unavailable (fail open or closed, and say why). (3) Use server-side timestamps for start and stop, or correct with the measured skew; treat device times as untrusted. (4) Re-run the same computation with the lower limit; it shows how often accounts reached a level, not whether people would have changed behaviour under a different plan.

**Rubric anchors.** 2: right structure but closed intervals, `>=`, or start-day attribution. 3: matches the expected result at the level attempted. 4: also proposes the sweep, a sound real-time design and clock handling.

**Strong signals.** Draws two intervals touching end to start and asks what counts; explains why the peak is reached at a start. **Red flags.** Sampling the timeline every minute; claiming the result describes how a real service enforces its plans.

## NFX-L1-04

**Reference solution**

```python reference
def fill_rows(rows, cap, min_fill, genres=None, row_genre_cap=None, page_genre_cap=None):
    order = sorted(range(len(rows)), key=lambda i: (-rows[i][1], rows[i][0]))
    on_page = set()                    # titles in rows kept so far
    page_genre = {}                    # genre -> titles of it in kept rows
    kept = {}
    for i in order:
        got, in_row, row_genre = [], set(), {}
        for t in rows[i][2]:
            if len(got) == cap:
                break
            if t in on_page or t in in_row:
                continue
            if genres is not None:
                g = genres[t]
                if row_genre_cap is not None and row_genre.get(g, 0) >= row_genre_cap:
                    continue           # skipped for this row only
                if page_genre_cap is not None and page_genre.get(g, 0) + row_genre.get(g, 0) >= page_genre_cap:
                    continue
                row_genre[g] = row_genre.get(g, 0) + 1
            got.append(t)
            in_row.add(t)
        if len(got) >= min_fill:       # commit only kept rows: a dropped row releases everything
            kept[i] = got
            on_page |= in_row
            for g, n in row_genre.items():
                page_genre[g] = page_genre.get(g, 0) + n
    return [(rows[i][0], kept[i]) for i in range(len(rows)) if i in kept]
```

**Explanation.** Rows are filled in `(-priority, row_id)` order but returned in their input order, so the function needs both orderings. Each row is built in local structures (`got`, `in_row`, `row_genre`) and committed to the page-level set and genre counter only if it is kept; a dropped row therefore releases its titles and its genre budget without any undo logic. A title skipped because of a genre limit is only skipped for that row, since nothing about it is recorded. Membership and counting are O(1) with a set and dictionaries.

**Complexity.** O(R log R) to order the rows plus O(total candidates) to scan them; memory O(titles on the page). In the timing check (3 000 rows × 150 candidates) the reference takes well under a second in CPython; a version that checks "already on the page" by scanning a list of placed titles takes minutes.

**Dialect notes.** In Java or Go, a `HashSet<Integer>`/`map[int]struct{}` and a per-genre `int` array if genres are small integers; sort row indices with a comparator on (priority desc, row id). In SQL this greedy, order-dependent fill is awkward (each row depends on all earlier rows); it belongs in application code. Not executed here.

**Edge cases built into the tests.** A title already in a higher-priority row; repeats within a row; fill order differing from display order; equal priorities; a dropped row whose titles go to a later row; exactly `min_fill`; a row stopping at `cap` with later candidates left for others; no row kept (`[]`); an empty candidate list. Hard: a title skipped for the genre cap and taken by a later row; a genre cap that drops a row below `min_fill`. Very Hard: the page genre cap counted across kept rows, released by a dropped row, and reached exactly.

**Common mistakes.** Returning rows in fill order; marking titles as used before knowing the row is kept; marking genre-skipped titles as used; a list for membership; forgetting duplicates within a row; `>` instead of `>=` for `min_fill`; sorting by priority ascending or breaking ties by display position.

**Follow-up guidance.** (1) A page-level assignment (titles to slots, maximising total relevance with one-title-per-page constraints) is a matching or integer programme; usually not worth it per request, but useful offline to measure how much greedy loses. (2) Precompute candidate lists per profile or segment, keep a per-row timeout with a fallback row, and assemble with whatever arrived. (3) Deduplicate on the visible prefix only, or weight positions; state the rule and test it. (4) Replay a sample of profiles through old and new assemblers and alert on distribution changes in rows kept and titles per row.

**Rubric anchors.** 2: correct for simple pages but returns fill order or leaks dropped rows' titles; or correct but list-based and too slow. 3: passes all tests at the level attempted within the time limit. 4: also discusses the optimum, latency and offline testing well.

**Strong signals.** Asks whether output is in display or fill order; builds the row before committing. **Red flags.** Removing titles from other rows' candidate lists in place (mutating the input); quadratic scans "because pages are small" without checking the stated sizes.

## NFX-L1-05

**Reference solution**

```python reference
def repair_cues(cues, num, den, offset_ms, min_gap_ms, dedupe=False):
    def rescale(t):
        return (2 * t * num + den) // (2 * den)       # round half up, integers only

    moved = []
    for i, (s, e, text) in enumerate(cues):
        ns, ne = rescale(s) + offset_ms, rescale(e) + offset_ms
        if ne <= 0:
            continue                                  # entirely before the programme starts
        moved.append((max(ns, 0), i, ne, text))
    moved.sort()                                      # by new start, then input position

    merged = []                                       # [start, end, lines, seen]
    for s, _, e, text in moved:
        if merged and s < merged[-1][1]:              # strict overlap: touching is not merging
            cur = merged[-1]
            cur[1] = max(cur[1], e)
            if dedupe and text in cur[3]:
                continue
            cur[2].append(text)
            cur[3].add(text)
        else:
            merged.append([s, e, [text], {text}])

    for a, b in zip(merged, merged[1:]):              # close gaps shorter than min_gap_ms
        if 0 < b[0] - a[1] < min_gap_ms:
            a[1] = b[0]
    return [(s, e, "\n".join(lines)) for s, e, lines, _ in merged]
```

**Explanation.** Every time is rescaled with integer arithmetic: `(2·t·num + den) // (2·den)` is `t·num/den` rounded half up, with no float that could land just below .5 (and no banker's rounding from `round()`). The offset is added after rescaling; a cue whose new end is at or before 0 is dropped, and a negative start is clamped to 0. Sorting by `(new_start, input_position)` makes equal starts keep input order. One sweep merges: a cue joins the current merged cue when it starts strictly before that cue's end (the maximum end so far, which handles chains and a cue nested inside another); otherwise it starts a new merged cue. With `dedupe`, a line already in the merged cue is skipped (a set beside the list). A final pass closes gaps strictly between 0 and `min_gap_ms`; touching cues stay separate because the merge test is strict.

**Complexity.** O(n log n) for the sort and O(n) for the sweep and gap pass. In the timing check (100 000 cues) the reference takes well under a second in CPython; merging by repeatedly searching for an overlapping pair is quadratic or worse and does not finish.

**Dialect notes.** In JavaScript, `t * num` stays exact below 2^53, but avoid `Math.round` on a float division for the same half-way reason; use integer arithmetic or BigInt. In Java, use `long` for `2·t·num`. Subtitle formats differ in time resolution (some use centiseconds or frames), so rounding to milliseconds is this exercise's rule. Not executed here.

**Edge cases built into the tests.** No cues; one cue; cues that touch end to start (not merged); a nested cue; a gap of exactly `min_gap_ms` (kept) and one millisecond shorter (closed); rescaling creating an overlap that was not in the input; a time whose rescaled value is exactly half a millisecond, when the rate has one. Hard: negative offsets that drop and clamp cues, unsorted input with equal starts, a chain, and a merged end that is not the last cue's end. Very Hard: a line repeated within one merged cue (kept once), the same line in two separate cues (kept in both), and a repeat after a different line.

**Common mistakes.** Float arithmetic or `round()`; applying the offset before rescaling; dropping cues that end at 1 ms or keeping ones that end at 0; `<=` in the overlap test (merging touching cues); using the last cue's end as the merged end; closing a gap of exactly `min_gap_ms`; unstable ordering of equal starts; deduplicating across separate cues.

**Follow-up guidance.** (1) Load the shot-change list for the picture and snap or flag cue starts within two frames of a cut; frame duration comes from the picture's rate. (2) Keep speakers as separate events on separate lines and check reading speed (characters per second) and line length; merge only when the limits allow, otherwise shift timing. (3) Fit start times against a reference track with a robust linear regression (slope gives num/den, intercept the offset) on matched cues, and check the residuals. (4) Golden files with exact expected milliseconds, plus property tests (no overlaps after repair, order preserved, idempotence for num = den and offset 0).

**Rubric anchors.** 2: merges correctly but rounds with floats or `round()`, or merges touching cues. 3: passes all tests at the level attempted in time. 4: also handles the style-guide, drift-detection and testing follow-ups convincingly.

**Strong signals.** Asks how to round before writing code; checks the strict versus inclusive boundaries one by one. **Red flags.** "Floats are fine for milliseconds"; mutating the input list while iterating over it.
