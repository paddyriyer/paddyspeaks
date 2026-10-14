# LinkedIn · Loop 1 — evaluator notes (hidden from candidates)

## LNK-L1-01

**Reference solution** (PostgreSQL; `{{resend_days}}` and `{{min_invites}}` are the instance's resend limit and floor)

```sql reference
WITH ordered AS (                      -- each pair's sends in time order
  SELECT invitation_id, sender_id, recipient_id, sent_at, status, status_at,
         LAG(sent_at) OVER (PARTITION BY sender_id, recipient_id
                            ORDER BY sent_at, invitation_id) AS prev_sent
  FROM invitations
), numbered AS (                       -- a running count of "this send starts a new invitation"
  SELECT *,
         SUM(CASE WHEN prev_sent IS NULL
                    OR sent_at > prev_sent + INTERVAL '{{resend_days}} days' THEN 1 ELSE 0 END)
           OVER (PARTITION BY sender_id, recipient_id
                 ORDER BY sent_at, invitation_id) AS invite_no
  FROM ordered
), invites AS (                        -- one row per invitation: first send, latest send's outcome
  SELECT sender_id, recipient_id, invite_no,
         MIN(sent_at) AS first_sent,
         (ARRAY_AGG(status    ORDER BY sent_at DESC, invitation_id DESC))[1] AS outcome,
         (ARRAY_AGG(status_at ORDER BY sent_at DESC, invitation_id DESC))[1] AS outcome_at
  FROM numbered
  GROUP BY sender_id, recipient_id, invite_no
), placed AS (
  SELECT i.*,
         (SELECT mr.region
          FROM member_regions mr
          WHERE mr.member_id = i.sender_id AND mr.valid_from <= i.first_sent
          ORDER BY mr.valid_from DESC
          LIMIT 1) AS region
  FROM invites i
  WHERE i.outcome <> 'withdrawn'
)
SELECT DATE_TRUNC('month', first_sent)::date AS month,
       region,
       COUNT(*) AS invitations,
       COUNT(*) FILTER (WHERE outcome = 'accepted'
                          AND outcome_at <= first_sent + INTERVAL '14 days') AS accepted_14d,
       ROUND(COUNT(*) FILTER (WHERE outcome = 'accepted'
                                AND outcome_at <= first_sent + INTERVAL '14 days')::numeric
             / COUNT(*), 4) AS acceptance_rate
FROM placed
GROUP BY 1, 2
HAVING COUNT(*) >= {{min_invites}}
ORDER BY month, region;
```

**Explanation.** The grain the team wants is the invitation a member saw, not the send. `LAG` finds each pair's previous send; a send that is the pair's first, or more than the resend limit after the previous one, starts a new invitation, and a running `SUM` of that flag numbers them (classic gaps-and-islands). Each invitation keeps its first send (for the month and the start of the 14-day window) and the latest send's outcome. Withdrawn invitations are removed before anything is counted, so they affect neither the rate nor the floor. The region is looked up as of the first send. At Medium every row is its own invitation and the region table has one row per member, so the same query reduces to a filter and a grouped count.

**Complexity.** One sort by (sender, recipient, sent_at) for both window functions, a hash aggregate per invitation and one per (month, region); the correlated region lookup is an index probe per invitation with a `(member_id, valid_from)` key. O(n log n) overall.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `QUALIFY` is not needed here, but `ARRAY_AGG(... ORDER BY ...)[1]` becomes `MAX_BY(status, sent_at)` (Snowflake, Spark) or `ARRAY_AGG(status ORDER BY sent_at DESC LIMIT 1)[OFFSET(0)]` (BigQuery); `COUNT_IF` / `COUNTIF` replace `FILTER`; `DATE_TRUNC(first_sent, MONTH)` in BigQuery. An as-of region join can use Snowflake's `ASOF JOIN … MATCH_CONDITION (first_sent >= valid_from)`. MySQL 8: window functions work; replace `FILTER` with `SUM(CASE …)` and the array trick with a `ROW_NUMBER()` subquery.

**Edge cases built into the data.** Every level: an invitation sent in the last minute of August and accepted in September (August); acceptances exactly 14 days after the send (counted) and 14 days plus one second (not); ignored, pending and withdrawn outcomes. Hard: resends after a withdrawal, including one sent exactly at the resend limit (same invitation) and later invitations to the same member one second past the limit (a new invitation); a resend crossing into September whose acceptance is late if measured from the resend; a lone sender in a small region exactly at the floor in August and one short in September. Very Hard: chains of three sends; two senders who move region, with an invitation starting exactly at the move (new region) and one started before the move and resent after it (old region).

**Common mistakes.** Counting withdrawn invitations in the denominator; `<` instead of `<=` on the window; collapsing every send of a pair into one invitation regardless of the gap (or not collapsing at all); timing the window from the resend; using the first send's status instead of the latest send's; the sender's current region; applying the floor before removing withdrawals; integer division; `DATE_TRUNC` in a non-UTC session.

**Follow-up guidance.** (1) Join the recipient's region history instead, as of the first send; withdrawn invitations still leave the denominator. (2) Report only months whose window has closed, or show a "maturing" rate over invitations at least 14 days old with the cutoff stated. (3) Show the count beside the rate, suppress or flag groups below a minimum, or show an interval; never a bare four-decimal rate on 40 invitations. (4) Recompute a trailing window of first-send dates (resend limit plus 14 days) each day, merge by invitation key, and keep the earlier months frozen once their windows close.

**Rubric anchors.** 2: right grouping and rate, but withdrawn invitations kept or an exclusive bound. 3: matches the expected result at the level attempted. 4: also explains the island logic cleanly and handles the maturing-window and small-group follow-ups.

**Strong signals.** Asks what an "invitation" is before writing SQL; states the outcome rule for a chain; checks the floor against the post-withdrawal count. **Red flags.** Outputting per-member lists as the deliverable; inferring anything about members beyond what the report needs.

## LNK-L1-02

**Reference solution** (PostgreSQL; `{{first_week}}`, `{{weeks}}` and `{{min_followers}}` are the instance's window and floor)

```sql reference
WITH ev AS (                           -- duplicate deliveries collapse to one event
  SELECT DISTINCT page_id, member_id, event_type, event_at
  FROM follow_events
), seq AS (
  SELECT *,
         LEAD(event_type) OVER w AS next_type, LEAD(event_at) OVER w AS next_at,
         LAG(event_type)  OVER w AS prev_type, LAG(event_at)  OVER w AS prev_at
  FROM ev
  WINDOW w AS (PARTITION BY page_id, member_id ORDER BY event_at)
), counted AS (                        -- drop both halves of a quick unfollow-then-refollow
  SELECT page_id, event_type, event_at
  FROM seq
  WHERE NOT COALESCE(event_type = 'unfollow' AND next_type = 'follow'
                    AND next_at <= event_at + INTERVAL '7 days', false)
    AND NOT COALESCE(event_type = 'follow' AND prev_type = 'unfollow'
                    AND event_at <= prev_at + INTERVAL '7 days', false)
), eligible AS (                       -- the floor, on the count at the end of the window
  SELECT p.page_id
  FROM pages p
  LEFT JOIN ev e ON e.page_id = p.page_id
  GROUP BY p.page_id, p.followers_at_start
  HAVING p.followers_at_start
         + COUNT(*) FILTER (WHERE e.event_type = 'follow')
         - COUNT(*) FILTER (WHERE e.event_type = 'unfollow') >= {{min_followers}}
), weeks AS (
  SELECT (DATE '{{first_week}}' + 7 * g)::date AS week_start
  FROM generate_series(0, {{weeks}} - 1) AS g
)
SELECT e.page_id, w.week_start,
       COUNT(c.event_type) FILTER (WHERE c.event_type = 'follow')   AS follows,
       COUNT(c.event_type) FILTER (WHERE c.event_type = 'unfollow') AS unfollows,
       COUNT(c.event_type) FILTER (WHERE c.event_type = 'follow')
         - COUNT(c.event_type) FILTER (WHERE c.event_type = 'unfollow') AS net_new
FROM eligible e
CROSS JOIN weeks w
LEFT JOIN counted c
  ON c.page_id = e.page_id
 AND DATE_TRUNC('week', c.event_at)::date = w.week_start
GROUP BY e.page_id, w.week_start
ORDER BY e.page_id, w.week_start;
```

**Explanation.** Duplicates go first: the pairing below relies on each member's events alternating, and a duplicated follow breaks that. For each (page, member), an unfollow whose next event is a follow within 7 days is half of a round trip, and the follow whose previous event is such an unfollow is the other half; both are filtered out, so a round trip spanning a week boundary changes neither week. Because events alternate, each follow can only pair with the unfollow just before it, so two quick round trips in a row drop all four events. The floor uses the end-of-window count, which round trips do not change. The week spine is crossed with the eligible pages before the `LEFT JOIN`, and `COUNT(c.event_type)` counts only matched rows, so empty weeks come out as zeros.

**Complexity.** One sort per (page, member) for the window functions, a hash aggregate for the floor, and a join of the counted events to a tiny spine: O(n log n). In production the page-week counts would be maintained incrementally; see the follow-ups.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(event_at), WEEK(MONDAY))` (its default `WEEK` starts on Sunday), `GENERATE_DATE_ARRAY(first_week, …, INTERVAL 7 DAY)` with `UNNEST`, `COUNTIF`. Snowflake: `DATE_TRUNC('week', …)` follows the `WEEK_START` parameter (default Monday, ISO), a spine from `GENERATOR(ROWCOUNT => n)` with `SEQ4()`, `COUNT_IF`. Spark SQL: `date_trunc('week', …)` is Monday-based; `sequence()` + `explode` for the spine. MySQL 8: a recursive CTE for the spine and `SUM(CASE …)` for the filters.

**Edge cases built into the data.** Every level: a quick round trip collapsed; pages above and below the floor; members whose first event is an unfollow (they followed before the window). Hard: refollows exactly 7 days after the unfollow (collapsed) and 7 days plus one second (both count); a round trip from late Sunday to Monday; follows at 23:59:59 on Sunday and 00:00:00 on Monday; a page that starts at or above the floor and ends below it. Very Hard: the same event delivered twice; two round trips in a row by one member; a page ending exactly at the floor (included).

**Common mistakes.** `WHERE NOT (… AND next_type = 'follow' …)` without `COALESCE`: for a member's last event `next_type` is NULL, the condition is NULL, and `NOT NULL` silently drops the row; not collapsing, or dropping only the unfollow; an exclusive 7-day bound; a self-join that pairs an unfollow with any later follow rather than the next event; omitting empty weeks; applying the floor at the start of the window; counting duplicates; Sunday-based weeks (a BigQuery habit).

**Follow-up guidance.** (1) Convert to the page's zone before truncating to the week; a Sunday 23:30 UTC event is Monday morning in Tokyo and moves weeks; the spine is then in local dates. (2) Publish with a "provisional" marker and restate the last two weeks when late events arrive; or publish weeks only after the lateness bound. (3) A longer window can collapse pairs whose halves fall in already published weeks; recompute the affected weeks, version the definition, and annotate the change. (4) Keep per (page, week) counters plus a small state of each member's last unfollow within the last 7 days; an arriving refollow inside the window decrements the unfollow's week instead of incrementing its own.

**Rubric anchors.** 2: weekly counts right but round trips not collapsed, or empty weeks missing. 3: matches the expected result at the level attempted. 4: also handles time zones, late data and incremental maintenance credibly.

**Strong signals.** Asks whether the floor applies at the start or end; states the alternation assumption and dedupes before relying on it. **Red flags.** Reporting which members unfollowed; treating every follow after an unfollow as part of a round trip regardless of time.

## LNK-L1-03

**Reference solution** (PostgreSQL; `{{dup_hours}}` and `{{as_of}}` are the instance's duplicate limit and as-of time)

```sql reference
WITH ordered AS (
  SELECT message_id, seat_id, member_id, sent_at,
         LAG(sent_at) OVER (PARTITION BY seat_id, member_id
                            ORDER BY sent_at, message_id) AS prev_sent
  FROM messages
), grouped AS (                        -- a copy within the limit of the previous one joins its group
  SELECT *,
         SUM(CASE WHEN prev_sent IS NULL
                    OR sent_at > prev_sent + INTERVAL '{{dup_hours}} hours' THEN 1 ELSE 0 END)
           OVER (PARTITION BY seat_id, member_id ORDER BY sent_at, message_id) AS grp
  FROM ordered
), kept AS (
  SELECT seat_id, member_id, grp, MIN(sent_at) AS kept_sent
  FROM grouped
  GROUP BY seat_id, member_id, grp
), first_response AS (                 -- the first response to any copy in the group
  SELECT g.seat_id, g.member_id, g.grp, MIN(e.event_at) AS responded_at
  FROM grouped g
  JOIN message_events e ON e.message_id = g.message_id
  WHERE e.event_type IN ('accepted', 'declined', 'replied')
  GROUP BY g.seat_id, g.member_id, g.grp
)
SELECT k.seat_id,
       COUNT(*) AS messages,
       COUNT(*) FILTER (WHERE f.responded_at <= k.kept_sent + INTERVAL '7 days') AS responses_7d,
       ROUND(COUNT(*) FILTER (WHERE f.responded_at <= k.kept_sent + INTERVAL '7 days')::numeric
             / COUNT(*), 4) AS response_rate
FROM kept k
LEFT JOIN first_response f
  ON f.seat_id = k.seat_id AND f.member_id = k.member_id AND f.grp = k.grp
WHERE k.kept_sent + INTERVAL '7 days' <= TIMESTAMPTZ '{{as_of}}'
GROUP BY k.seat_id
ORDER BY k.seat_id;
```

**Explanation.** The unit is the message a member received once, so copies are grouped first: per (seat, member) in time order, a copy more than the limit after the previous copy starts a new group, and a running `SUM` numbers the groups (chained, so three copies 5 hours apart under a 6-hour limit are one group). The group's earliest `sent_at` is the kept message. Response events are attached through every copy of the group and reduced to their `MIN`, so a decline on the first copy followed by a reply on the second is a response at the decline time. Messages whose 7-day window has not ended by the stated as-of time are left out, because they could still be answered. At Medium the copy and as-of rules are inert in the data, and the same query applies.

**Complexity.** One sort of messages by (seat, member, sent_at), a hash join of events to messages, two hash aggregates: O(n log n + e).

**Dialect notes** (described, not executed). Snowflake / BigQuery: `COUNT_IF` / `COUNTIF`; `TIMESTAMPADD(HOUR, …)` / `TIMESTAMP_ADD(prev_sent, INTERVAL 6 HOUR)`; the gaps-and-islands pattern is the same. Spark SQL: `sum(case …) over (…)` and `count_if`; `INTERVAL 6 HOURS`. MySQL 8: `prev_sent + INTERVAL 6 HOUR`, `SUM(CASE …)` for the filtered counts.

**Edge cases built into the data.** Every level: duplicate pairs within the limit; reads without a response; a decline on the kept copy. Hard: a copy exactly at the limit (same group) answered on the copy; a copy one second past the limit (its own message); responses exactly 7 days after the send (counts) and 7 days plus one second (does not); a message sent exactly 7 days before the as-of time (counted) and later ones (left out). Very Hard: a chain of three copies spanning more than the limit from the first, answered on the third; a decline inside the window followed by a late reply on another copy.

**Common mistakes.** Counting `read` as a response or leaving out `declined`; deduplicating with `DISTINCT member_id` per seat (merges messages months apart); measuring duplicates from the first copy rather than the previous one; joining responses only to the kept copy; timing from the responding copy; using the latest response; filtering the as-of cutoff with `NOW()`; integer division.

**Follow-up guidance.** (1) Add a new response type behind a versioned definition and backfill or annotate; keep the old definition reproducible. (2) Keep a seat-assignment history with validity intervals and attribute each kept message to the recruiter holding the seat at `kept_sent`. (3) Compare response-time distributions by region and day of week; consider business-day windows, but state the definition change. (4) Maintain per-group state for the last 7 days (kept time, responded yet) and finalize a group once its window closes; daily aggregates are then append-only.

**Rubric anchors.** 2: plausible per-seat rate, but duplicates counted twice or declines left out. 3: matches the expected result at the level attempted. 4: also handles attribution across seat transfers and incremental computation credibly.

**Strong signals.** Asks what counts as a response and as a duplicate before writing SQL; states why open windows are excluded. **Red flags.** Selecting message text or listing members; using wall-clock time in a reproducible report.

## LNK-L1-04

**Reference solution**

```python reference
def skills_coverage(profiles, jobs, opted_out=None, min_count=None):
    off = opted_out or set()
    # Hard and above compare trimmed, case-insensitive names. At Medium every name is
    # already distinct and canonical, so normalising there changes nothing.
    norm = lambda s: s.strip().lower()

    n = len(profiles)
    nbytes = (n + 7) // 8
    rows = {}                                  # skill -> bytearray bitset of members
    counted = 0
    for i, skills in enumerate(profiles):
        if i in off:
            continue                           # opted-out members never enter the index
        counted += 1
        for s in {norm(x) for x in skills}:    # a skill listed twice is one skill
            buf = rows.get(s)
            if buf is None:
                buf = rows[s] = bytearray(nbytes)
            buf[i >> 3] |= 1 << (i & 7)
    bits = {s: int.from_bytes(buf, "little") for s, buf in rows.items()}
    size = {s: bin(b).count("1") for s, b in bits.items()}

    out = []
    for req in jobs:
        need = {norm(x) for x in req}
        if not need:
            c = counted                        # no requirements: every counted member
        else:
            acc = None
            for s in sorted(need, key=lambda s: size.get(s, 0)):   # rarest first
                b = bits.get(s, 0)
                acc = b if acc is None else acc & b
                if not acc:
                    break                      # nobody left
            c = bin(acc).count("1")
        if min_count is not None and c < min_count:
            c = -1                             # too few to show
        out.append(c)
    return out
```

**Explanation.** An inverted index from skill to members, built once, turns each job into an intersection of a few sets instead of a scan over every member. Bitsets make the intersection a handful of big-integer ANDs (each ~3 KB at 25 000 members) and the count a popcount. Building each bitset in a `bytearray` and converting once avoids the trap of `bits |= 1 << i` per member, which copies the whole integer every time. Opted-out members are skipped while building the index, so no later step can count them by mistake. Profile and job skills go through the same normalisation; requirements are a set. The minimum is applied to the final count, and 0 is below any positive minimum, so it is suppressed too.

At Medium the generated names are already canonical, so normalising is harmless; a candidate who compares exactly is equally correct there.

**Complexity.** Building: O(total listed skills) bit sets plus O(skills × members / 8) bytes. Each job: O(k × members / 64) word operations for k required skills, with an early exit. In the timing check the reference takes about 0.35 s in CPython; checking every member for every job (30 million subset tests) takes about 30 s.

**Dialect notes.** In Java, `java.util.BitSet` with `and()` and `cardinality()`; in production, compressed bitmaps (Roaring) keep sparse skills small and are what search and analytics engines use for this. In SQL the same count is a relational division: `GROUP BY member HAVING COUNT(DISTINCT skill) = k` over the required skills, per job. Not executed here.

**Edge cases built into the tests.** No members; a required skill nobody lists; the empty job (every member) and the empty profile (only the empty job); a skill repeated in a profile and in a job; all versus any. Hard: names differing in case and surrounding spaces; an opted-out member who would match; every member opted out. Very Hard: exactly `min_count` members (shown), one fewer (−1), a count of 0 (−1), and an opt-out that pushes a job below the minimum.

**Common mistakes.** Any-of instead of all-of; counting a member twice for a duplicate skill; requiring a repeated job skill twice; normalising only one side; subtracting opted-out members from a count that never included them, or counting them; building bitsets with `x |= 1 << i` per member (quadratic); returning 0 instead of −1 under the minimum.

**Follow-up guidance.** (1) Dense bitsets are 900M / 8 ≈ 112 MB per skill; use compressed bitmaps, shard members, and keep the dense form only for the most common skills. (2) Count per member how many of the job's skills they have (sum over posting lists in a counter, or bit-sliced addition across bitsets) and threshold. (3) Map free text to a canonical skill id at ingest, apply implication edges by expanding the profile's skills, and version the taxonomy so counts can be recomputed under one version. (4) Round or add noise to counts, rate-limit near-duplicate queries per account, and consider differential privacy for published aggregates.

**Rubric anchors.** 2: correct brute force that fails the timing check, or an index with all/any or duplicate errors. 3: correct and fast at the level attempted, with the sentinel. 4: also handles scale, threshold queries and differencing risks credibly.

**Strong signals.** Asks whether requirements are all-of; notices the cost of building bitsets naively; excludes opted-out members at the source. **Red flags.** Returning member ids; inferring skills a member did not list.

## LNK-L1-05

**Reference solution**

```python reference
import heapq


def salary_medians(events, k, lo=None, hi=None):
    # Hard and above compare trimmed, case-insensitive keys; at Medium every key is already
    # canonical, so normalising there changes nothing.
    key_of = lambda title, city: (title.strip().lower(), city.strip().lower())
    groups = {}   # key -> [low max-heap of (-salary, -idx), high min-heap of (salary, idx), n_low, n_high, gone]
    live = {}     # add index -> salary, for accepted reports not yet removed
    out = []

    def prune(g):
        low, high, gone = g[0], g[1], g[4]
        while low and -low[0][1] in gone:
            gone.discard(-heapq.heappop(low)[1])
        while high and high[0][1] in gone:
            gone.discard(heapq.heappop(high)[1])

    def balance(g):
        prune(g)
        if g[2] > g[3] + 1:                      # lower half too big: move its max up
            v, i = heapq.heappop(g[0])
            heapq.heappush(g[1], (-v, -i))
            g[2] -= 1; g[3] += 1
        elif g[3] > g[2]:                        # upper half bigger: move its min down
            v, i = heapq.heappop(g[1])
            heapq.heappush(g[0], (-v, -i))
            g[3] -= 1; g[2] += 1
        prune(g)

    def median(g):
        if g is None or g[2] + g[3] < k:
            return None
        if g[2] > g[3]:
            return -g[0][0][0]
        return (-g[0][0][0] + g[1][0][0] + 1) // 2

    for idx, ev in enumerate(events):
        if ev[0] == "add":
            _, title, city, v = ev
            key = key_of(title, city)
            g = groups.get(key)
            if (lo is None or v >= lo) and (hi is None or v <= hi):
                if g is None:
                    g = groups[key] = [[], [], 0, 0, set()]
                if g[2] and (v, idx) < (-g[0][0][0], -g[0][0][1]):
                    heapq.heappush(g[0], (-v, -idx)); g[2] += 1
                else:
                    heapq.heappush(g[1], (v, idx)); g[3] += 1
                balance(g)
                live[idx] = v
            out.append(median(g))
        else:
            j = ev[1]
            g = groups.get(key_of(events[j][1], events[j][2]))
            if j in live:                        # a rejected or already removed report is a no-op
                v = live.pop(j)
                g[4].add(j)
                # (salary, index) pairs split strictly: everything in low is below everything in high.
                if g[2] and (v, j) <= (-g[0][0][0], -g[0][0][1]):
                    g[2] -= 1
                else:
                    g[3] -= 1
                balance(g)
            out.append(median(g))
    return out
```

**Explanation.** Each group keeps its lower half in a max-heap (negated) and its upper half in a min-heap, with the lower half equal in size or one larger; the median is the lower top (odd) or the rounded mean of both tops (even). Elements are `(salary, index)` pairs, so equal salaries are distinct and the two halves are split strictly, which is what lets a removal tell which half its report is in by comparing with the lower top. Removals are lazy: the report is marked gone and the live count of its half is decremented; gone entries are dropped only when they surface at a top, and `prune` runs before any top is read or moved, so the tops are always live. Balancing uses the live counts, never `len(heap)`. Rejected reports never enter a group, and their removal is a no-op because they were never live.

**Complexity.** O(log n) amortised per event (each report is pushed and popped a bounded number of times), O(n) memory. In the timing check the reference takes about 0.6 s in CPython. Re-sorting the group after every report is O(n² log n): at this size well over a minute. Note for the interviewer: `bisect.insort` into one sorted list per group is O(n) per insert but the shift is a fast memory move, so it passes this check in about 1 s; accept it as correct, and ask how it grows (follow-up rule).

**Dialect notes.** Java: `PriorityQueue` with a reversed comparator, or a `TreeMap<Integer, Integer>` multiset with two cursors; C++: two `std::priority_queue`s or a `std::multiset` with an iterator to the median, which also supports true deletion. In SQL, `PERCENTILE_CONT(0.5)` / `PERCENTILE_DISC` per group recomputes from scratch (Snowflake and BigQuery have `MEDIAN` / `APPROX_QUANTILES`). Not executed here.

**Edge cases built into the tests.** Below `k` until the k-th report; `k = 1`; even counts rounded half up (including a mean ending in .5); equal salaries; the same title in two cities; reports arriving in descending order. Hard: keys differing in case and spaces; salaries exactly at `lo` and `hi` (accepted) and one outside each (rejected, group unchanged); a rejected report in an otherwise empty group (`None`). Very Hard: a removal taking a group below `k`; removing the median; removing a rejected report; removing the same report twice; removing one of two equal salaries; emptying a group and filling it again.

**Common mistakes.** Rounding the even median down or returning a float; showing a median below `k`; balancing on `len(heap)` with lazy deletion; comparing only salaries so equal values are removed from the wrong half; adding rejected reports and then "removing" them; letting a no-op removal change counts; re-sorting on every event.

**Follow-up guidance.** (1) Four heaps around the two quartile points, or an order-statistic tree / two `SortedList`s, each event O(log n); exact percentiles at scale are often replaced by sketches (t-digest, KLL) with a stated error. (2) Two heaps per group cost dozens of bytes per report plus per-group overhead; keep small groups as plain sorted lists, spill cold groups to storage, and compute on read for rarely viewed groups. (3) Show a value only on a delay or batch, round or bucket the median, and require changes of several reports before an update is published. (4) `PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY salary)` per group with `HAVING COUNT(*) >= k`; streaming is worth it when freshness after each report matters.

**Rubric anchors.** 2: correct brute force that fails the timing check, or heaps with a rounding or `k` error. 3: correct two heaps at the level attempted (with removals at Very Hard). 4: also discusses percentiles, memory at many small groups and differencing risks credibly.

**Strong signals.** Asks how an even count is rounded; uses (salary, index) pairs before being prompted; explains why balancing uses live counts. **Red flags.** Returning individual salaries; showing a value for a group below `k`.
