# Salesforce · Loop 1 — evaluator notes

## SFC-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH pairs AS (                        -- every opportunity that existed at each cut-off
  SELECT m.month_end, (m.month_end + 1)::timestamptz AS cutoff,
         o.opportunity_id, o.stage, o.amount, o.owner_id
  FROM report_months m
  JOIN opportunities o ON o.created_at < (m.month_end + 1)::timestamptz
), h AS (
  SELECT * FROM opportunity_field_history
  WHERE field IN ('StageName', 'Amount', 'OwnerId')
), before_cut AS (                     -- last change strictly before the cut-off
  SELECT DISTINCT ON (p.month_end, p.opportunity_id, h.field)
         p.month_end, p.opportunity_id, h.field, h.new_value AS v
  FROM pairs p JOIN h ON h.opportunity_id = p.opportunity_id AND h.changed_at < p.cutoff
  ORDER BY p.month_end, p.opportunity_id, h.field, h.changed_at DESC, h.history_id DESC
), after_cut AS (                      -- first change at or after it: its old_value held before
  SELECT DISTINCT ON (p.month_end, p.opportunity_id, h.field)
         p.month_end, p.opportunity_id, h.field, h.old_value AS v
  FROM pairs p JOIN h ON h.opportunity_id = p.opportunity_id AND h.changed_at >= p.cutoff
  ORDER BY p.month_end, p.opportunity_id, h.field, h.changed_at, h.history_id
), asof AS (
  SELECT p.month_end, p.opportunity_id,
         COALESCE(MAX(b.v) FILTER (WHERE b.field = 'StageName'),
                  MAX(a.v) FILTER (WHERE a.field = 'StageName'), MAX(p.stage))            AS stage,
         COALESCE(MAX(b.v) FILTER (WHERE b.field = 'Amount')::numeric,
                  MAX(a.v) FILTER (WHERE a.field = 'Amount')::numeric, MAX(p.amount))     AS amount,
         COALESCE(MAX(b.v) FILTER (WHERE b.field = 'OwnerId'),
                  MAX(a.v) FILTER (WHERE a.field = 'OwnerId'), MAX(p.owner_id))           AS owner_id
  FROM pairs p
  LEFT JOIN before_cut b ON b.month_end = p.month_end AND b.opportunity_id = p.opportunity_id
  LEFT JOIN after_cut  a ON a.month_end = p.month_end AND a.opportunity_id = p.opportunity_id
  GROUP BY p.month_end, p.opportunity_id
)
SELECT month_end, stage, owner_id,
       COUNT(*)    AS open_opportunities,
       SUM(amount) AS open_amount
FROM asof
WHERE stage NOT IN ('Closed Won', 'Closed Lost')
GROUP BY month_end, stage, owner_id
ORDER BY month_end, stage, owner_id;
```

**Explanation.** The value of a field at a cut-off is the `new_value` of the last change strictly before it. When there is none, the field still had its original value, and the history says what that was: the `old_value` of the first change after the cut-off. Only when the field never changed is the current value right. The query pairs each month-end with the opportunities created before its cut-off (an opportunity created later would otherwise pick up its original values and appear in a month in which it did not exist), finds the two candidate changes per field with `DISTINCT ON`, and pivots the three fields with `FILTER`. The two `LEFT JOIN`s multiply rows per opportunity, but `MAX` per field is unaffected, because each (field, side) has at most one value. Closed stages are removed after reconstruction, so a deal that closes and reopens counts in exactly the months it was open. `history_id` breaks ties between changes in the same second.

**Complexity.** For M month-ends, O opportunities and H history rows, the joins are O(M · H) before `DISTINCT ON` sorts them; with an index on `(opportunity_id, field, changed_at)` each lookup is a short index range. In production one would compute validity intervals once (`valid_from = changed_at`, `valid_to = LEAD(changed_at)`) and join cut-offs to intervals.

**Dialect notes** (described, not executed). Snowflake and BigQuery have no `DISTINCT ON`: use `QUALIFY ROW_NUMBER() OVER (PARTITION BY month_end, opportunity_id, field ORDER BY changed_at DESC, history_id DESC) = 1`. Snowflake's `ASOF JOIN … MATCH_CONDITION (h.changed_at < p.cutoff)` expresses the "last change before" lookup directly. BigQuery: `DATE_ADD(month_end, INTERVAL 1 DAY)` cast to `TIMESTAMP` is UTC; `COUNTIF`. Spark SQL: `max_by(new_value, struct(changed_at, history_id))` over the filtered join. MySQL 8: `ROW_NUMBER()` in a CTE and `MAX(CASE WHEN field = … THEN v END)` for the pivot.

**Edge cases built into the data.** An opportunity whose first change comes after the first month-end (fallback to `old_value`); opportunities whose fields never change (current value); deals closed mid-window. Hard: owner changes, untracked fields (`CloseDate`, `NextStep`) in the same table, opportunities created during the window. Very Hard: a stage change at exactly 00:00:00 on the 1st, two stage changes in the same second, a deal closed in the first month and reopened in a later one.

**Common mistakes.** Using current values; taking only the history and dropping opportunities without an earlier change; using the `new_value` of the first later change instead of its `old_value`; `<=` at the cut-off; forgetting `created_at`; not filtering `field`, so a `CloseDate` change is read as a stage; filtering closed opportunities by their current stage; ties on `changed_at` without `history_id`; casting amount text after summing.

**Follow-up guidance.** (1) Reconstruction is exact as long as history is complete; snapshots are cheap to query and survive history retention, but freeze any errors and need a backfill that is itself a reconstruction. A strong answer does both: reconstruct to backfill and to audit, snapshot going forward. (2) A pipeline report usually converts at a stated rate (the month-end rate, or the planning rate) and says which; mixing the rate at close with the amount at month-end produces numbers nobody can reproduce. (3) Detect the gap: if the earliest retained change for an object is after the cut-off and the record existed before it, mark the value as "reconstructed from fallback" or unknown rather than trusting it. (4) Partition history by org and month of `changed_at`, cluster by `(opportunity_id, field, changed_at)`; precompute validity intervals so as-of becomes a range join.

**Rubric anchors.** 2: rebuilds the stage from history but uses current owner or amount, or drops opportunities with no earlier change. 3: matches the expected result. 4: also explains validity intervals, snapshot versus reconstruction, and how to notice history that no longer reaches back far enough.

**Strong signals.** Asks what the value was before the first recorded change; checks the chain property (old_value equals previous new_value); tests the midnight boundary deliberately. **Red flags.** Assumes the history contains a row for every opportunity at creation; groups by the current owner "because ownership rarely changes".

## SFC-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH RECURSIVE grp AS (                -- walk from each survivor out to everything merged into it
  SELECT l.lead_id, l.lead_id AS root
  FROM leads l
  WHERE NOT EXISTS (SELECT 1 FROM lead_merges m WHERE m.merged_lead_id = l.lead_id)
  UNION ALL
  SELECT m.merged_lead_id, g.root
  FROM lead_merges m
  JOIN grp g ON m.surviving_lead_id = g.lead_id
), starts AS (
  SELECT g.root, MIN(l.created_at) AS start_at
  FROM grp g JOIN leads l ON l.lead_id = g.lead_id
  GROUP BY g.root
), judged AS (
  SELECT COALESCE(s.lead_source, 'Unknown') AS lead_source,
         s.converted_at IS NOT NULL
           AND s.converted_at <= st.start_at + interval '30 days' AS converted
  FROM starts st
  JOIN leads s ON s.lead_id = st.root
  WHERE st.start_at + interval '30 days' <= timestamptz '{{as_of}}'
)
SELECT lead_source,
       COUNT(*)                                AS leads,
       COUNT(*) FILTER (WHERE converted)       AS converted_30d,
       ROUND(COUNT(*) FILTER (WHERE converted)::numeric / COUNT(*), 4) AS conversion_rate
FROM judged
GROUP BY lead_source
ORDER BY lead_source;
```

**Explanation.** Entity resolution comes first: the recursive CTE starts from survivors (leads never merged away) and follows the merge table backwards, so every lead, however many hops away, carries the id of its final survivor. Everything else is per group: the start is the minimum `created_at` across the group, the source and conversion are the survivor's. Maturity is judged on the group's start, so a group whose 30-day window is still open at the snapshot is not counted at all; counting it as unconverted biases recent cohorts downward. The rate is a numeric division rounded to 4 places.

**Complexity.** The recursion runs once per merge hop; with an index on `lead_merges(surviving_lead_id)` it is O(L + M) for L leads and M merges, then one hash aggregate. Real merge chains are short; the cost is dominated by the scan of leads.

**Dialect notes** (described, not executed). Snowflake and Spark SQL (3.4+ on Databricks) support recursive CTEs with similar syntax; BigQuery supports `WITH RECURSIVE` too. Without recursion (older Spark, some engines) resolve chains iteratively in the pipeline or with a fixed number of self-joins sized to the maximum chain length, and assert that no chain is longer. MySQL 8 has `WITH RECURSIVE` and `TIMESTAMPADD(DAY, 30, start_at)`; `SUM(converted)` replaces `FILTER`. BigQuery: `TIMESTAMP_ADD(start_at, INTERVAL 30 DAY)`, `COUNTIF`.

**Edge cases built into the data.** A person whose first lead came 10–20 days before the surviving lead, converting within 30 days of the survivor but not of the first lead (every level); duplicates from different sources; survivors that are not the earliest lead. Hard: groups younger than 30 days at the snapshot, a group that starts exactly 30 days before it (included), a conversion at exactly 30 days. Very Hard: a three-lead chain merged in two steps, survivors with no source.

**Common mistakes.** Counting lead records instead of groups; starting the clock at the survivor's own `created_at`; resolving merges one hop deep; counting immature groups as unconverted; strict `<` at the boundary; dropping NULL sources through an inner join on a source table; integer division; first-touch source when the specification says survivor.

**Follow-up guidance.** (1) Model merges as events with an `undone_at` (or a separate unmerge event) and resolve groups as of a date; reports for earlier dates must be recomputed or explicitly frozen, and a strong answer says which. (2) Compute groups once (a table of `lead_id → root`, with `start_at`, `first_source`, `survivor_source`) and let each report choose the attribution column; the logic lives in one place. (3) Estimate duplicates with a matching rule (normalised email, phone) and report the rate as a range between "records" and "probable people", stating the rule. (4) Maintain a union-find style mapping table updated from the day's merges only; a new merge re-roots one group, so only that group's rows change.

**Rubric anchors.** 2: folds duplicates one level deep but measures from the survivor, or counts young groups. 3: matches the expected result. 4: also discusses unmerges as of a date, attribution as a column rather than a fork, and incremental resolution.

**Strong signals.** Asks "is a merged lead still a lead?" before writing SQL; spots the maturity bias without prompting. **Red flags.** Deduplicates by email inside the report instead of using the merge log; treats the survivor's creation as the person's first contact.

## SFC-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH first_response AS (
  SELECT case_id, MIN(created_at) AS responded_at
  FROM case_comments
  WHERE author_type = 'agent' AND is_public
  GROUP BY case_id
), spans AS (
  SELECT c.case_id, c.priority, e.response_minutes * 60 AS target_s, e.calendar,
         c.created_at AS s,
         COALESCE(f.responded_at, timestamptz '{{as_of}}') AS t,   -- unanswered: measure to the snapshot
         f.responded_at IS NOT NULL AS answered
  FROM cases c
  JOIN entitlements e ON e.priority = c.priority
  LEFT JOIN first_response f ON f.case_id = c.case_id
), measured AS (
  SELECT sp.*,
         CASE WHEN sp.calendar = '24x7' THEN EXTRACT(EPOCH FROM sp.t - sp.s)
              ELSE COALESCE((
                SELECT SUM(EXTRACT(EPOCH FROM LEAST(sp.t, d + make_interval(hours => {{close}}))
                                            - GREATEST(sp.s, d + make_interval(hours => {{open}}))))
                FROM generate_series(date_trunc('day', sp.s), date_trunc('day', sp.t), interval '1 day') AS d
                WHERE EXTRACT(ISODOW FROM d) < 6
                  AND d::date NOT IN (SELECT holiday_date FROM holidays)
                  AND LEAST(sp.t, d + make_interval(hours => {{close}}))
                      > GREATEST(sp.s, d + make_interval(hours => {{open}}))
              ), 0)
         END AS business_s
  FROM spans sp
), judged AS (
  SELECT priority, answered AND business_s <= target_s AS met
  FROM measured
  WHERE answered OR business_s > target_s          -- unanswered and still within target: not judged
)
SELECT priority,
       COUNT(*)                          AS cases,
       COUNT(*) FILTER (WHERE met)       AS met,
       COUNT(*) FILTER (WHERE NOT met)   AS breached,
       ROUND(COUNT(*) FILTER (WHERE met)::numeric / COUNT(*), 4) AS met_rate
FROM judged
GROUP BY priority
ORDER BY priority;
```

**Explanation.** Business time is the measure of the intersection between the case's interval and the calendar's windows. Because a window never crosses midnight here, the calendar decomposes into one window per business day, and the correlated subquery sums the positive overlaps of the days the interval touches. Creation and response outside business hours need no special casing: the overlap clips them to the window. Unanswered cases are measured to the snapshot; if they are already over target they are breaches, otherwise they are not judged yet. A 24x7 entitlement is plain elapsed seconds. The first response is filtered on both author type and visibility, because automated acknowledgements usually arrive first and internal notes are not seen by the customer.

**Complexity.** One generated row per case-day: O(Σ case durations in days). Fine for a report over weeks; for years of cases, precompute a calendar table with cumulative business seconds at each day's start (and the window bounds), so business time between two instants is `cum(t) − cum(s)` with clipping on the two end days: O(1) per case after two lookups.

**Dialect notes** (described, not executed). Snowflake: no `generate_series` over timestamps; join to a calendar table (or `TABLE(GENERATOR(ROWCOUNT => n))` with `DATEADD`), `DAYOFWEEKISO`, `DATEDIFF('second', a, b)`. BigQuery: `UNNEST(GENERATE_DATE_ARRAY(DATE(s), DATE(t)))`, `EXTRACT(DAYOFWEEK …)` is 1 = Sunday, `TIMESTAMP_DIFF(b, a, SECOND)`. Spark SQL: `explode(sequence(to_date(s), to_date(t)))`, `dayofweek` is 1 = Sunday. MySQL 8: a recursive CTE or a calendar table; `TIMESTAMPDIFF(SECOND, a, b)`. In every engine a persisted calendar table is the production answer.

**Edge cases built into the data.** A response at exactly the target (met) and one second later (breached), both from cases opened on a weekend, a holiday or outside the day's hours; replies sent outside business hours; customer comments before the agent's reply. Hard: automated acknowledgements within seconds of creation, internal notes before the first public reply, an old unanswered case (breached), a case opened minutes before the snapshot (not judged), a second holiday. Very Hard: P1 on a 24x7 calendar, including a case opened on Friday evening.

**Common mistakes.** Wall-clock subtraction; counting the customer's or the automated comment as the response; ignoring holidays; `<` at the target; dropping unanswered cases (hides the worst breaches) or counting all of them as breached (punishes cases that are not due); applying business hours to a 24x7 entitlement; clipping only the start or only the end of the interval; joining comments without aggregating first, which duplicates cases.

**Follow-up guidance.** (1) Store each calendar's windows as UTC intervals generated from its local rules (with DST), assign each case a calendar from its entitlement or region, and intersect with that calendar's intervals; never convert the case to local time and reuse a UTC rule. (2) A table `(calendar_id, day, window_start, window_end, cum_before)` makes elapsed time `cum(t) − cum(s)`, where `cum(x) = cum_before(day(x)) + clip(x − window_start, 0, window length)`. (3) Model status changes as intervals; the clock runs only on intervals where the status is "running", intersected with business windows: the same overlap sum, over more intervals. (4) Breach time for open cases is "created + target in business time", precomputed once per case; the minute-by-minute view is a comparison with now, while the compliance report stays batch.

**Rubric anchors.** 2: business time computed, but weekends handled and holidays ignored, or the first response wrongly defined, or unanswered cases mishandled. 3: matches the expected result. 4: also designs the cumulative calendar table and handles time zones and pauses correctly in discussion.

**Strong signals.** Draws the interval-on-calendar picture before writing SQL; asks what happens to unanswered cases; tests a weekend-spanning case by hand. **Red flags.** Converts business time with a fixed ratio (e.g. "8/24 of elapsed"); treats the snapshot time as the response for unanswered cases and calls them met.

## SFC-L1-04

**Reference solution**

```python reference
def visible_counts(roles, users, records, no_hierarchy):
    off = set(no_hierarchy)
    parent = dict(roles)
    children = {r: [] for r in parent}
    roots = []
    for r, p in roles:
        if p is None:
            roots.append(r)
        else:
            children[p].append(r)
    role_of = dict(users)
    own = {u: 0 for u, _ in users}
    here = {r: 0 for r in parent}            # shareable records owned by users in exactly this role
    for _, obj, owner in records:
        own[owner] += 1
        r = role_of[owner]
        if r is not None and obj not in off:
            here[r] += 1
    order, stack = [], roots[:]              # iterative pre-order: parents before children
    while stack:
        r = stack.pop()
        order.append(r)
        stack.extend(children[r])
    sub = dict(here)                         # shareable records owned at or below each role
    for r in reversed(order):                # every child is finished before its parent
        p = parent[r]
        if p is not None:
            sub[p] += sub[r]
    return {u: own[u] + (sub[r] - here[r] if r is not None else 0) for u, r in users}
```

**Explanation.** What a user sees through the hierarchy depends only on their role: the shareable records owned strictly below it. So the work is per role, and a subtree sum is a post-order fold: each role's total is its own count plus its children's totals. A pre-order built with an explicit stack lists every parent before its descendants; walking it in reverse finishes every child first, with no recursion (the test tree is thousands of levels deep). "Strictly below" is the subtree total minus the role's own count, which is how peers in one role are kept out of each other's counts. Each user adds their own records of every object, including objects that do not share through the hierarchy; users without a role get only their own.

**Complexity.** O(R + U + N) time and O(R + U) memory for R roles, U users, N records. The timing test (12 000 roles about 6 000 levels deep, 30 000 users, 120 000 records) runs in about 0.4 s in CPython. Walking each role's subtree with an explicit stack and memoising per role took about 12.5 s on the same input; a per-user walk without memoisation, or any recursive version, is worse (or raises `RecursionError`).

**Dialect notes.** In SQL this is a recursive CTE producing (ancestor, descendant) pairs, which is O(R × depth) rows on a deep tree; a closure table maintained on change, or a materialised path (`/ceo/vp/dir/`) with prefix matching, is the usual production shape. In Java or Go the same two passes apply; Java's default thread stack also overflows on deep recursion. Not executed here.

**Edge cases built into the tests.** Peers in one role; a grand-manager; an empty middle role; two separate trees; a user who owns nothing; (Hard) a user with no role, and roles listed child-first; (Very Hard) an object excluded from hierarchy sharing, including one nobody owns.

**Common mistakes.** Counting peers (using "at or below" for the user's own role); recursion that fails on the deep test; assuming `roles` is listed parents-first; counting the user's own records twice (once as owner, once as "in their role"); dropping excluded-object records from the owner's own count; building sets of record ids per role; forgetting users with zero visible records.

**Follow-up guidance.** (1) For one record, walk up from the owner's role to the root collecting users in each ancestor role: O(depth + users found); precompute nothing. (2) Expand each rule into (grantee role subtree) × (owner role subtree) and count distinct records per user with a bitmap or by deduplicating grants per (user, record); a strong answer notes that union of grants is not a sum. (3) Moving a subtree changes totals only on the old and new ancestor paths: subtract its total along the old path, add it along the new one, O(depth). (4) Partition by org, cap per-task work by role count, store per-role `here` and `sub` so one user's count is explainable as "own + sum below role X".

**Rubric anchors.** 2: correct on shallow trees but per-user walks, recursion, or peers counted. 3: passes all tests with an iterative post-order sum. 4: also explains per-record lookup, rule expansion without double counting and O(depth) updates for a move.

**Strong signals.** Notices that the answer is per role before writing code; asks about depth and recursion limits; checks the peer rule with a two-user example. **Red flags.** Raising the recursion limit as the fix; claiming this rule is how a particular product's sharing works in full.

## SFC-L1-05

**Reference solution**

```python reference
import heapq


def route_cases(agents, events):
    n = len(agents)
    index = {a: i for i, (a, _, _) in enumerate(agents)}
    skills = [s for _, s, _ in agents]
    cap = [c for _, _, c in agents]
    load = [0] * n
    last = [-1] * n                 # time of the latest assignment; -1 = never (times are >= 0)
    online = [True] * n
    ver = [0] * n                   # bumped on every change; older heap entries are stale
    heaps = {}

    def publish(i):
        ver[i] += 1
        if online[i]:
            entry = (load[i] - cap[i], last[i], i, ver[i])     # most spare, longest idle, input order
            for s in skills[i]:
                heapq.heappush(heaps.setdefault(s, []), entry)

    for i in range(n):
        publish(i)
    held, out = {}, {}
    for ev in events:
        kind = ev[0]
        if kind == 'case':
            _, t, cid, skill, units = ev
            h = heaps.get(skill, [])
            chosen = None
            while h:
                neg_spare, _, i, v = h[0]
                if v != ver[i]:                                # stale (or offline): drop lazily
                    heapq.heappop(h)
                    continue
                if -neg_spare >= units:                        # the top has the most spare capacity
                    chosen = i
                break
            out[cid] = None if chosen is None else agents[chosen][0]
            if chosen is not None:
                load[chosen] += units
                last[chosen] = t
                held[cid] = (chosen, units)
                publish(chosen)
        elif kind == 'done':
            got = held.pop(ev[2], None)
            if got is not None:
                load[got[0]] -= got[1]
                publish(got[0])
        else:
            i = index[ev[2]]
            online[i] = kind == 'online'
            publish(i)
    return out
```

**Explanation.** The routing rule is a lexicographic maximum: most spare capacity, then oldest latest assignment, then input position, which as a min-heap key is `(load − capacity, last, position)`. Every event changes at most one agent, but that agent may sit in several skill heaps, and Python's heap has no decrease-key. So each change bumps the agent's version and pushes a fresh entry into every heap the agent belongs to; an entry whose version is old is discarded when it surfaces. Going offline is just a version bump without a push, and coming online pushes again. Once the top valid entry cannot fit the case, no agent can, because it has the most spare capacity; the case gets `None`. Completions free capacity only for routed cases.

**Complexity.** Each event pushes at most k entries (k skills per agent) and every entry is popped at most once: O(E · k · log(E · k)) time, O(E · k) memory in the worst case. The timing test (2 000 agents, 60 000 cases, about 120 000 events) runs in about 0.4–0.7 s in CPython. Scanning the agents with the skill for every case took about 15–19 s on the same input.

**Dialect notes.** Java: `PriorityQueue<long[]>` per skill with a version array, or a `TreeSet` per skill keyed by `(−spare, last, idx)` with remove-and-reinsert (O(log n) without stale entries). C++: `std::set` per skill for the same. Go: `container/heap` with an index field supports `heap.Fix` for true decrease-key. In SQL this is sequential state and does not belong in a query. Not executed here.

**Edge cases built into the tests.** Most spare beats input order; a never-assigned agent beats one assigned earlier; equal spare broken by oldest assignment, then input order; no agent with the skill; everyone full until a completion; (Hard) a free agent without the skill, a completion for an unrouted case; (Very Hard) units exactly equal to spare, spare capacity spread over agents that does not add up, an agent offline while a case completes and back online.

**Common mistakes.** Choosing the first agent with room; least-recently-*completed* instead of latest assignment; ties broken by agent id instead of input position; updating only one skill heap; trusting a stale top entry; scanning past the top to find one that "fits" (the top has the most room, so nothing below fits either); freeing capacity for a `done` of an unrouted case (a `KeyError`, or worse, negative load); keeping offline agents eligible.

**Follow-up guidance.** (1) Keep a FIFO per skill; on every capacity increase, for each of the agent's skills, offer the head of that queue if it fits; a strong answer notices starvation of large cases behind small ones and names a policy (strict FIFO or skip-ahead). (2) Least-active ignores capacity: an agent with capacity 5 and 2 in progress loses to one with capacity 1 and 1 in progress; most-available spreads by headroom, least-active by count. (3) A heap per (skill, level) with a query over levels ≥ L, or a segment tree over levels whose leaves are heaps; with ten levels, ten heap tops is enough. (4) Make capacity a reservation with compare-and-set (or one owner per agent's state), and retry with the next candidate when the reservation fails.

**Rubric anchors.** 2: correct rule but a scan per case, or one heap that ignores multiple skills. 3: passes every test with per-skill heaps and lazy invalidation. 4: also explains why the top test is enough, waiting queues without starvation, and how concurrency changes the design.

**Strong signals.** Writes the comparison key before any code; asks whether an unroutable case waits; tests an agent with two skills. **Red flags.** Re-sorting all agents on every event; presenting this rule as how a specific product's routing works.
