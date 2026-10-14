# Microsoft · Loop 1 — evaluator notes (hidden from candidates)

## MSF-L1-01

**Reference solution** (PostgreSQL; `{{min_participants}}` is the instance's floor, 1 below Very Hard)

```sql reference
WITH counted AS (                     -- cancelled attempts do not exist for this report
  SELECT * FROM join_attempts WHERE outcome <> 'cancelled'
), marked AS (
  SELECT c.*,
         ROW_NUMBER() OVER w AS rn,
         CASE WHEN LAG(attempt_ts) OVER w IS NULL
                OR attempt_ts - LAG(attempt_ts) OVER w > INTERVAL '120 seconds'
              THEN 1 ELSE 0 END AS starts_try
  FROM counted c
  WINDOW w AS (PARTITION BY meeting_id, user_id ORDER BY attempt_ts, attempt_id)
), tries AS (
  SELECT m.*,
         SUM(starts_try) OVER (PARTITION BY meeting_id, user_id
                               ORDER BY attempt_ts, attempt_id) AS try_no
  FROM marked m
), per_participant AS (
  SELECT meeting_id, user_id,
         MIN(tenant_id)                                                   AS tenant_id,
         MIN(client_platform) FILTER (WHERE rn = 1)                       AS client_platform,
         COALESCE(BOOL_OR(outcome = 'succeeded') FILTER (WHERE try_no = 1), false) AS first_ok,
         COALESCE(BOOL_OR(outcome = 'succeeded') FILTER (WHERE try_no > 1), false) AS later_ok
  FROM tries
  GROUP BY meeting_id, user_id
)
SELECT tenant_id, client_platform,
       COUNT(*)                                             AS participants,
       COUNT(*) FILTER (WHERE NOT first_ok)                 AS failed_first_try,
       COUNT(*) FILTER (WHERE NOT first_ok AND later_ok)    AS recovered_later,
       ROUND(COUNT(*) FILTER (WHERE NOT first_ok)::numeric / COUNT(*), 4) AS failed_share
FROM per_participant
GROUP BY tenant_id, client_platform
HAVING COUNT(*) >= {{min_participants}}
ORDER BY tenant_id, client_platform;
```

**Explanation.** A gaps-and-islands problem at the participant grain. Cancelled attempts are removed first (a no-op below Very Hard), so they can neither start nor bridge a try. Within each `(meeting_id, user_id)`, ordered by `attempt_ts, attempt_id`, an attempt starts a new try when there is no previous attempt or the gap to the previous one is more than 120 seconds; a running `SUM` of that flag numbers the tries. One row per participant then carries the platform of row 1, whether try 1 contains a success and whether any later try does. `BOOL_OR … FILTER` returns NULL when no row matches, hence the `COALESCE`. The last step counts per tenant and platform and applies the floor in `HAVING`.

**Complexity.** One sort per participant partition for the two window functions (they share the window), then two hash aggregates: O(n log n) over attempts. In production the per-participant step would be computed once per meeting day and stored.

**Dialect notes** (described, not executed). Snowflake and BigQuery: the same `LAG` plus running `SUM`; booleans aggregate with `BOOLOR_AGG` (Snowflake) or `LOGICAL_OR` (BigQuery), and `COUNT_IF`/`COUNTIF` replace `FILTER`; timestamp differences use `DATEDIFF('second', …)` or `TIMESTAMP_DIFF(…, SECOND)`. Spark SQL: `lag`, `sum` over a window, `bool_or`, `count_if`. MySQL 8: window functions are available; `TIMESTAMPDIFF(SECOND, …)`, `SUM(CASE …)` instead of `FILTER`, and `MAX(outcome = 'succeeded')` as the boolean aggregate. SQL Server: `DATEDIFF(second, …)`, no `FILTER`, so `SUM(CASE …)`.

**Edge cases built into the data.** Every level: a failure with a success 20–90 seconds later (not failed), a failure with a success 200–600 seconds later (failed and recovered), a failure with only failed retries. Hard: gaps of exactly 120 s (same try) and 121 s (new try); a chain of three attempts 100 s apart (one try, 200 s end to end); a failure on one platform and a quick success on another (counted on the first); two attempts in the same second on different platforms (the lower `attempt_id` is first); the same user in two meetings of one tenant. Very Hard: a cancelled attempt between a failure and a success 200 s apart (two tries once it is removed), a participant with only a cancelled attempt (not counted), a cancelled first attempt on another platform (the platform comes from the first counted attempt), and a floor that drops small groups.

**Common mistakes.** Measuring the first raw attempt instead of the first try; fixed time buckets (`date_trunc`) instead of gaps; measuring 120 s from the first attempt of the try rather than the previous attempt; `<` instead of `<=` at 120; grouping per user instead of per meeting and user; taking the platform of the successful or last attempt; `MIN(client_platform)` over all attempts (alphabetical, not first); leaving cancelled attempts in so they bridge two tries; forgetting `COALESCE` so NULL comparisons drop participants; integer division.

**Follow-up guidance.** (1) Per participant whose first try failed, `MIN(attempt_ts) FILTER (WHERE outcome = 'succeeded')` minus the first attempt; then `PERCENTILE_CONT(0.5)` per group, with participants who never got in reported separately (censored), not dropped. (2) Order by a server receive time or bound the skew; late attempts mean the day must be recomputed for a few days (or tries built over a trailing window), and the report says which days are still provisional. (3) Show counts with the share, add an interval (Wilson) or suppress groups under a minimum; compare with the tenant's own history rather than the global mean. (4) Carry each participant's open try (last attempt time and status) across batches as state, or reprocess a 120-second overlap at the batch edge; a try is final only once 120 s pass without an attempt.

**Rubric anchors.** 2: counts per tenant and platform but uses raw first attempts or fixed buckets, or the wrong grain. 3: matches the expected result. 4: also explains chained gaps versus anchored windows, the tie-break on equal timestamps, and how to sessionise incrementally with late data.

**Strong signals.** Asks whether the two minutes chain from the previous attempt before writing SQL; names the participant grain explicitly; checks the 120 s boundary. **Red flags.** Treating every failed attempt as a failed join; presenting a share from a dozen participants as a regression without its count.

## MSF-L1-02

**Reference solution** (PostgreSQL; `{{update_id}}` and `{{days}}` are the instance's update and window)

```sql reference
WITH offered AS (                      -- the window starts at the device's FIRST offer
  SELECT device_id,
         MIN(offered_at)                              AS start_at,
         MIN(offered_at) + INTERVAL '{{days}} days'   AS end_at
  FROM update_offers
  WHERE update_id = '{{update_id}}'
  GROUP BY device_id
), status AS (
  SELECT o.device_id, d.ring,
         (SELECT b.os_build FROM device_builds b       -- build in effect at the first offer
           WHERE b.device_id = o.device_id AND b.effective_at <= o.start_at
           ORDER BY b.effective_at DESC LIMIT 1)      AS os_build,
         EXISTS (SELECT 1 FROM update_installs i
                  WHERE i.device_id = o.device_id AND i.update_id = '{{update_id}}'
                    AND i.installed_at BETWEEN o.start_at AND o.end_at) AS compliant,
         EXISTS (SELECT 1 FROM device_checkins c
                  WHERE c.device_id = o.device_id
                    AND c.checkin_at BETWEEN o.start_at AND o.end_at)   AS checked_in
  FROM offered o
  JOIN devices d ON d.device_id = o.device_id
)
SELECT ring, os_build,
       COUNT(*)                                               AS offered_devices,
       COUNT(*) FILTER (WHERE checked_in OR compliant)        AS online_devices,
       COUNT(*) FILTER (WHERE compliant)                      AS compliant_devices,
       ROUND(COUNT(*) FILTER (WHERE compliant)::numeric
             / NULLIF(COUNT(*) FILTER (WHERE checked_in OR compliant), 0), 4) AS compliance_rate
FROM status
GROUP BY ring, os_build
ORDER BY ring, os_build;
```

**Explanation.** First reduce offers to one row per device that was offered this update, with the window anchored on the **first** offer (`MIN`), so re-offers cannot move it. Two `EXISTS` tests with inclusive `BETWEEN` decide compliance (an install of this update in the window) and whether the device checked in; a device is online if it checked in **or** is compliant, since an install proves it was on. The build is looked up as of the first offer with a correlated `ORDER BY effective_at DESC LIMIT 1`, which reads the history rather than `devices.current_build`. The aggregation keeps every offered device in `offered_devices`, and `NULLIF` turns an all-offline group's rate into NULL instead of an error or a misleading 0.

**Complexity.** One aggregate over offers, then per offered device three index-friendly probes (installs, check-ins, builds by `device_id` and time): O(d log n) with indexes on `(device_id, time)`; without them, hash semi-joins over the three tables. Check-ins are by far the largest table in practice.

**Dialect notes** (described, not executed). BigQuery: no correlated `LIMIT 1` subqueries in the select list on large tables; use a join and `QUALIFY ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY effective_at DESC) = 1`, `TIMESTAMP_ADD(start_at, INTERVAL n DAY)`, `SAFE_DIVIDE`. Snowflake: an `ASOF JOIN … MATCH_CONDITION (o.start_at >= b.effective_at)` expresses the build lookup directly; `DATEADD(day, n, start_at)`, `DIV0NULL` or `NULLIF`. Spark SQL: a range join on device and time plus `row_number`, `date_add` works on dates only, so use `start_at + INTERVAL n DAYS`. MySQL 8: `LATERAL` derived tables (8.0.14+) or a `ROW_NUMBER` join, `DATE_ADD(start_at, INTERVAL n DAY)`.

**Edge cases built into the data.** Every level: an install exactly N days after the first offer (compliant), a device never online in the window (check-ins only before the offer or after the window), installs and offers of another update, devices never offered this update (some of which installed it anyway, and are not reported). Hard: re-offers, including an install inside the re-offer's window but after the first offer's; an install one second after the window; a compliant device with no check-in rows; a group whose only device was offline (NULL rate). Very Hard: build changes after the offer (current build differs) and a build change at exactly the offer time (it counts).

**Common mistakes.** Starting the window at the latest offer or at each offer; `<` instead of `<=` at the end of the window; counting installs of any update; dividing by offered devices (never-online devices count as failures); excluding a compliant device because it has no check-in; dropping the all-offline group or showing 0; grouping by `current_build`; joining check-ins and installs directly and counting rows.

**Follow-up guidance.** (1) Generate day offsets 0..N, and for each offered device take the day of its first in-window install; cumulative counts over online devices give the curve (the online denominator is fixed by the whole window, or by day, which must be stated). (2) Model check-in gaps from devices with frequent heartbeats, or use other signals (update scans, sign-ins) as additional evidence of being online; report "unknown" separately rather than guessing. (3) Store pauses as intervals per ring and stretch the window by the paused time, or report "active days since offer"; either way the definition is versioned. (4) Precompute per device per day an "online" flag (or first/last check-in per day) incrementally; the report then joins offers to a small daily table instead of raw heartbeats; partition by day and cluster by device.

**Rubric anchors.** 2: computes a rate per ring but with never-online devices in the denominator or the window from the wrong offer. 3: matches the expected result. 4: also handles curves, lost check-ins and pauses credibly and knows which table dominates cost.

**Strong signals.** Asks which offer starts the window and whether an install proves the device was online; uses `EXISTS` instead of joins that multiply rows. **Red flags.** Silently showing 0% for an offline group; reporting by today's build for a historical rollout.

## MSF-L1-03

**Reference solution** (PostgreSQL; `{{min_shown}}` is the instance's floor)

```sql reference
WITH last_accept AS (                  -- duplicates collapse; the clock runs from the last acceptance
  SELECT suggestion_id, MAX(event_ts) AS accepted_at
  FROM suggestion_events
  WHERE event_type = 'accepted'
  GROUP BY suggestion_id
), per_suggestion AS (
  SELECT s.app,
         COALESCE(s.language, 'und')     AS language,
         la.accepted_at IS NOT NULL      AS accepted,
         la.accepted_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM suggestion_events u
                            WHERE u.suggestion_id = s.suggestion_id
                              AND u.event_type = 'undone'
                              AND u.event_ts >  la.accepted_at
                              AND u.event_ts <= la.accepted_at + INTERVAL '5 minutes') AS kept
  FROM suggestions s
  LEFT JOIN last_accept la ON la.suggestion_id = s.suggestion_id
)
SELECT app, language,
       COUNT(*)                                  AS shown,
       COUNT(*) FILTER (WHERE accepted)          AS accepted,
       COUNT(*) FILTER (WHERE kept)              AS kept,
       ROUND(COUNT(*) FILTER (WHERE accepted)::numeric / COUNT(*), 4) AS accept_rate,
       ROUND(COUNT(*) FILTER (WHERE kept)::numeric
             / NULLIF(COUNT(*) FILTER (WHERE accepted), 0), 4)     AS keep_rate
FROM per_suggestion
GROUP BY app, language
HAVING COUNT(*) >= {{min_shown}}
ORDER BY app, language;
```

**Explanation.** The grain is the suggestion. All `accepted` events of a suggestion collapse to its last acceptance, which handles duplicate client events and re-acceptance after an undo at once. A suggestion is kept when no `undone` event falls in the half-open-on-the-left window `(accepted_at, accepted_at + 5 minutes]`: strictly after the last acceptance (an undo before it undid an earlier acceptance) and at most 300 seconds later. Starting from `suggestions` with a `LEFT JOIN` keeps suggestions with no events in `shown`; `COALESCE(language, 'und')` puts undetected languages in their own group; the floor is a `HAVING` on the per-suggestion count; `NULLIF` makes `keep_rate` NULL for a group with no acceptances.

**Complexity.** One aggregate over acceptance events, one anti-join probe per accepted suggestion (index on `(suggestion_id, event_type, event_ts)` or a hash semi-join), one aggregate: O(n log n) over events at worst.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_ADD(accepted_at, INTERVAL 5 MINUTE)`, `COUNTIF`, `SAFE_DIVIDE`; `NOT EXISTS` with correlated subqueries is supported but a `LEFT JOIN … WHERE u.suggestion_id IS NULL` is the safer rewrite. Snowflake: `DATEADD(minute, 5, accepted_at)`, `COUNT_IF`, `DIV0NULL`. Spark SQL: `accepted_at + INTERVAL 5 MINUTES`, a `LEFT ANTI JOIN` for the undo test, `count_if`. MySQL 8: `accepted_at + INTERVAL 5 MINUTE`, `SUM(CASE …)`.

**Edge cases built into the data.** Every level: an undo exactly 300 s after the acceptance (not kept), an undo much later (kept), suggestions with no events, a language that appears only once or twice (below the floor). Hard: duplicate acceptance events, including one where the undo is 302 s after the first acceptance but 299 s after the last (not kept); undos at 299, 300 and 301 s; dismissed suggestions. Very Hard: accepted, undone, accepted again (kept if the second acceptance is not undone, not kept if it is); suggestions with no language, reported as `'und'`.

**Common mistakes.** Counting acceptance events instead of suggestions; starting the clock at the first acceptance; an exclusive end (`< 300`); counting any undo, including one before the last acceptance; an inner join to events that drops suggestions with no events from `shown`; applying the floor to joined event rows or to accepted; dividing kept by shown; dropping or NULL-labelling suggestions without a language; integer division.

**Follow-up guidance.** (1) Compute, per suggestion, the first undo after the last acceptance (`MIN(event_ts) FILTER (WHERE …)`), then `COUNT(*) FILTER (WHERE first_undo IS NULL OR first_undo - accepted_at > INTERVAL 'k minutes')` for each k. (2) Report keep rate only for clients known to log undo, or show coverage beside it; mixing clients biases apps whose clients do not log undo upward. (3) A floor on `shown` is not enough when one person dominates a group: add a minimum of distinct users, suppress complementary cells, or add noise; never expose per-user rows. (4) Emit the day after the last acceptance window closes (a watermark of 5 minutes plus lateness), mark late corrections as restatements, and keep a version of each published number.

**Rubric anchors.** 2: correct for single acceptances but counts events or uses the first acceptance. 3: matches the expected result. 4: also designs multiple windows in one pass and discusses logging coverage and small-group privacy credibly.

**Strong signals.** Asks which acceptance starts the clock and whether 300 s is inside; starts from the suggestions table. **Red flags.** Joining events and counting rows without checking the grain; proposing to analyse suggestion or prompt text to measure usefulness.

## MSF-L1-04

**Reference solution**

```python reference
from collections import deque


def match_lobby(players, max_gap):
    queues = {}
    for p in players:
        queues.setdefault(p[1], []).append(p)
    pairs, left = 0, []
    for region, ps in queues.items():
        gap = max_gap[region]
        ps.sort(key=lambda p: p[2])                  # by skill
        n = len(ps)
        skill = [p[2] for p in ps]
        wait = [p[3] for p in ps]
        # best[i]: (pairs, total matched wait) over the first i players, nobody half-paired.
        # A matched set can always be paired as consecutive members in skill order, so
        # player i either stays, or plays an earlier j with everyone between them left.
        best = [(0, 0)] * (n + 1)
        partner = [-1] * n
        window = deque()                             # (best[j] + (1, wait[j]), j), values decreasing
        for i in range(n):
            if i:
                j = i - 1
                v = (best[j][0] + 1, best[j][1] + wait[j])
                while window and window[-1][0] <= v:
                    window.pop()
                window.append((v, j))
            while window and skill[i] - skill[window[0][1]] > gap:
                window.popleft()
            stay = best[i]
            if window:
                (k, w), j = window[0]
                play = (k, w + wait[i])
                if play > stay:
                    best[i + 1] = play
                    partner[i] = j
                    continue
            best[i + 1] = stay
        pairs += best[n][0]
        i = n
        while i:                                     # walk the choices back
            j = partner[i - 1]
            if j >= 0:                               # i - 1 played j; those between waited
                left.extend(p[0] for p in ps[j + 1:i - 1])
                i = j
            else:
                left.append(ps[i - 1][0])
                i -= 1
    left.sort()
    return pairs, left
```

**Explanation.** Regions are independent. Within a region, sort by skill. Any set of players that some pairing covers can be paired as consecutive members in skill order: if a ≤ b ≤ c ≤ d are paired as (a, c), (b, d) or (a, d), (b, c), then (a, b) and (c, d) are within the gap too. So, scanning in skill order, player i either stays or plays an earlier player j with everyone between them staying, and `best[i + 1] = max(best[i], best[j] + (1, wait[j] + wait[i]))` over the j with `skill[i] - skill[j] <= gap`. The value `best[j] + (1, wait[j])` of a candidate j is fixed once computed and the valid j form a window whose left edge only moves right, so a deque that keeps values decreasing gives the window maximum in O(1) amortised. Tuples compare as "pairs, then wait". Walking the recorded choices back from the end lists the players who stayed. The answer is unique because the player sets that some pairing covers form a matroid (the matching matroid); its bases all have the maximum number of pairs, and with distinct waits the maximum-weight basis is unique.

**Complexity.** O(n log n) for the sort and O(n) for the pass and the walk back; O(n) memory. The timing test (150 001 players, skills over 2 000 values, gap 25, so about 2 000 players inside each gap) runs in about 0.6–0.8 s in CPython. The same DP that scans every earlier player in the gap (O(n·w)) did not finish in 60 s; pair search over all pairs is O(n²) and worse.

**Dialect notes.** Java: sort an index array by skill, `ArrayDeque<int[]>` for the window, values as `long` pairs compared manually. C++: `std::deque` and `std::pair<int, long long>`, whose `operator<` is lexicographic. In SQL, a pairing like this is sequential and does not express well; a Spark job would group by region and run the DP per group. Not executed here.

**Edge cases built into the tests.** A gap of exactly `max_gap` (paired) and of `max_gap + 1` (not); an empty lobby; one player; four players where pairing the longest waiter with their closest opponent strands both ends (two pairs exist); three in a chain where either end can be left (the shorter waiter stays). Hard: a chain of five where pairing from the lowest skill leaves the wrong player; `max_gap` 0 with equal skills; three equal skills (the shortest waiter stays). Very Hard: equal skills in different regions (never paired), and regions with different gaps.

**Common mistakes.** Greedy pairing of neighbours from the lowest skill (right count, wrong players left); pairing the longest waiter first with their nearest opponent (loses pairs); maximising total wait without putting the pair count first (it happens to coincide here because waits are positive, but the candidate should say why); `<` instead of `<=` for the gap; forgetting to add the players skipped between j and i when walking back; mixing regions; an O(n·w) scan of the window per player.

**Follow-up guidance.** (1) Neighbour greedy is optimal for the count by an exchange argument (the lowest player can always be paired with the next one if with anyone), but it ignores waits, so among equally many pairs it may leave a long waiter; the DP fixes that. (2) With per-player gaps (`|a - b| <= max(g_a, g_b)` or `min`), compatibility is no longer an interval relation on one line, the uncrossing argument fails and the problem becomes general matching on an interval-like graph; practical systems widen gaps in steps and rerun the snapshot. (3) Pre-form groups, treat each group as one item with an average skill and pair groups the same way; mixing group sizes makes it a harder assignment. (4) Track how many snapshots each player has missed, include it in the wait, and alert on a long tail of waits per skill band; the extremes of the skill range are where starvation shows up first.

**Rubric anchors.** 2: right count but wrong players left, or an O(n·w) or O(n²) solution. 3: passes everything with the sorted DP and a window maximum. 4: also justifies the uncrossing step and the uniqueness of the answer, and discusses widening gaps and starvation.

**Strong signals.** Separates "how many pairs" from "who waits" before coding; proves the adjacency claim on a four-player example. **Red flags.** Claiming a greedy is optimal without an argument; general matching libraries for a one-dimensional problem.

## MSF-L1-05

**Reference solution**

```python reference
import re

MAX_ROW, MAX_COL = 1_048_576, 16_384
_END = re.compile(r'\$?([A-Z]*)\$?([0-9]*)')


def _column(letters):
    n = 0
    for ch in letters:                       # bijective base 26: A=1 … Z=26, AA=27 … XFD=16384
        n = n * 26 + ord(ch) - 64
    return n


def _area(ref):
    """'B2:D10', 'C3', 'C:E', '3:7' (with optional $) -> (c1, c2, r1, r2), or None if off the grid."""
    ends = []
    for part in ref.split(':'):
        letters, digits = _END.fullmatch(part.strip()).groups()
        ends.append((_column(letters) if letters else None, int(digits) if digits else None))
    (ca, ra), (cb, rb) = ends[0], ends[-1]
    c1, c2 = (1, MAX_COL) if ca is None else (min(ca, cb), max(ca, cb))
    r1, r2 = (1, MAX_ROW) if ra is None else (min(ra, rb), max(ra, rb))
    if c1 < 1 or c2 > MAX_COL or r1 < 1 or r2 > MAX_ROW:
        return None
    return c1, c2, r1, r2


def cells_selected(selections):
    rects = []
    for sel in selections:
        for ref in sel.split(','):
            a = _area(ref)
            if a is None:
                return -1
            rects.append(a)
    if not rects:
        return 0
    # Sweep the columns; a segment tree over compressed row boundaries holds, per node,
    # how many rectangles cover the whole node and how many rows of it are covered.
    ys = sorted({y for _, _, r1, r2 in rects for y in (r1, r2 + 1)})
    idx = {y: i for i, y in enumerate(ys)}
    m = len(ys) - 1
    cover = [0] * (4 * m)
    length = [0] * (4 * m)

    def update(node, lo, hi, a, b, d):       # rows ys[lo]..ys[hi] - 1, update [a, b)
        if b <= lo or hi <= a:
            return
        if a <= lo and hi <= b:
            cover[node] += d
        else:
            mid = (lo + hi) // 2
            update(2 * node, lo, mid, a, b, d)
            update(2 * node + 1, mid, hi, a, b, d)
        if cover[node]:
            length[node] = ys[hi] - ys[lo]
        elif hi - lo == 1:
            length[node] = 0
        else:
            length[node] = length[2 * node] + length[2 * node + 1]

    events = []
    for c1, c2, r1, r2 in rects:
        events.append((c1, 1, idx[r1], idx[r2 + 1]))
        events.append((c2 + 1, -1, idx[r1], idx[r2 + 1]))
    events.sort()
    total, prev = 0, events[0][0]
    for x, d, a, b in events:
        total += length[1] * (x - prev)      # covered rows times the columns since the last event
        prev = x
        update(1, 0, m, a, b, d)
    return total
```

**Explanation.** Parse first: each reference becomes an inclusive rectangle. A missing column part means whole rows (columns 1 to 16 384) and a missing row part means whole columns (rows 1 to 1 048 576); corners are normalised with `min`/`max`, `$` markers are skipped by the pattern, comma-separated areas are split, and any coordinate off the grid returns `-1` before any counting. Then a sweep over columns: each rectangle opens at `c1` and closes at `c2 + 1`. Between consecutive event columns the covered rows do not change, so the area added is covered rows × width. A segment tree over the compressed row boundaries keeps, per node, how many rectangles cover all of it and how many rows of it are covered (all of it if the count is positive, else the sum of its children). Columns use bijective base 26: there is no zero digit, so `AA` = 27 and `XFD` = 16 384.

**Complexity.** O(n log n) time and O(n) memory for n rectangles. The timing test (2 000 selections, about 2 600 areas at the hardest level, each up to 400 columns by 20 000 rows) takes about 0.1 s. Merging the active row intervals per column strip (O(n²)) took about 0.6–0.8 s and is acceptable; marking compressed grid cells took 2–5 s; visiting real cells would mean billions of steps.

**Dialect notes.** Java/C++: the same sweep with `long` totals (the full sheet exceeds 32 bits) and an iterative segment tree. In SQL the union area can be computed with compressed boundaries from `UNNEST`/`generate_series` and an `EXISTS` per compressed cell, which is O(n³); fine for dozens of ranges, not for thousands. Not executed here.

**Edge cases built into the tests.** No selections; one cell; the same range twice; two overlapping ranges; touching but not overlapping ranges; one range inside another; `Z` to `AA`, `AZ` to `BA`, `ZZ` to `AAA`; the last cell `XFD1048576`. Hard: a whole column (1 048 576 cells), a whole row crossing a whole column (one shared cell), corners written in any order, the full sheet `A:XFD` overlapped by other ranges, a column run written right to left. Very Hard: `$` markers, two overlapping areas in one selection, `XFE`, row 0 and row 1 048 577 (each `-1`), a bad area inside a multi-area selection (`-1`), and the valid extremes `XFD` and row 1 048 576.

**Common mistakes.** Treating columns as ordinary base 26 (`A` = 0 or `AA` = 26); exclusive ends (`c2 - c1` instead of `c2 - c1 + 1`); a set of cells; inclusion–exclusion over subsets; forgetting that `C:E` and `3:7` are full columns and rows; not normalising reversed corners; treating `$` as part of the name; counting overlaps twice inside a multi-area selection; returning a partial count when a later reference is invalid.

**Follow-up guidance.** (1) Keep two lengths per node, covered at least once and at least twice (the second from the children's first and second lengths when the node's own count is 1, all of it when it is 2 or more). (2) Iterate the non-empty cells (sparse, a few million) once and test each against the rectangles through the same compressed columns, or index the rectangles in an interval tree; each cell is added once however many ranges cover it. (3) The sweep is cheap enough to rerun at 2 000 ranges; for incremental updates, keep the other ranges' union per strip and adjust only the strips the moving corner crosses. (4) Each selection is small and per user; count per workbook on the server that already holds it, with the same sweep over everyone's rectangles, and send only the count.

**Rubric anchors.** 2: correct for small cases but per-cell or wrong column arithmetic. 3: passes everything with compression and a sweep. 4: also extends to double coverage or sparse sums cleanly and explains the segment tree's covered length.

**Strong signals.** Writes the column conversion and checks `AA` and `XFD` immediately; asks about whole rows and columns and invalid references. **Red flags.** Allocating anything proportional to rows × columns; assuming 32-bit counts.
