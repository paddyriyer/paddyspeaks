# The Five-Round Loop: evaluator key (source)

The reference solutions and evaluator notes for `/interview.app/loop/`. The page loads them
only when a candidate reveals a solution or finishes an assessment. Built by
`interview/loop/build.py` into `interview.app/loop/data/solutions.json`.

**Verification.** Every coding reference was run against a brute-force oracle on thousands of random cases. Every SQL reference was run on PostgreSQL 16.15. The runnable files are in `interview/loop/verify/`: `algos.py`, `r1q3.sql`, `r1q4.sql`, `r1q5.sql`, `r3_models.sql` and `r3q5.sql`. The PySpark in R2-05 was **not** executed; no Spark runtime was available. Its claims rest on documented Spark 3.5 behaviour.

**Using the rubric.** Score each applicable competency 0–4 and mark the rest N/A. The per-question anchors below describe what a 2, 3 and 4 look like. A 0 is no meaningful attempt; a 1 is a major conceptual gap.

---

## R1-01: FareWindow

**Reference solution**

```python
from collections import deque, Counter

class FareWindow:
    def __init__(self, window_seconds):
        if not isinstance(window_seconds, int) or window_seconds <= 0:
            raise ValueError("window_seconds must be a positive int")
        self.w = window_seconds
        self.events = deque()      # (ts, rider, fare, seq), arrival order
        self.maxq = deque()        # (ts, seq, fare), fares strictly decreasing front→back
        self.total = 0
        self.riders = Counter()
        self.last_ts = None
        self.seq = 0

    def add(self, ts, rider_id, fare_cents):
        if fare_cents < 0:
            raise ValueError("fare must be >= 0")
        if self.last_ts is not None and ts < self.last_ts:
            raise ValueError("timestamps must be non-decreasing")
        self.last_ts = ts
        self.seq += 1
        self.events.append((ts, rider_id, fare_cents, self.seq))
        self.total += fare_cents
        self.riders[rider_id] += 1
        while self.maxq and self.maxq[-1][2] <= fare_cents:
            self.maxq.pop()
        self.maxq.append((ts, self.seq, fare_cents))
        cutoff = ts - self.w                       # window is (ts - W, ts]
        while self.events and self.events[0][0] <= cutoff:
            _, r, f, s = self.events.popleft()
            self.total -= f
            self.riders[r] -= 1
            if self.riders[r] == 0:
                del self.riders[r]
            if self.maxq and self.maxq[0][1] == s:
                self.maxq.popleft()
        return (self.maxq[0][2], round(self.total / len(self.events), 2), len(self.riders))
```

**Explanation.** There are three aggregates, each with its own incremental structure:
- **Max**: a monotonic deque. A new fare evicts every smaller-or-equal fare from the back, because those can never be the max again while the new one is in the window. The front is the max. It is evicted when the event it belongs to (matched by `seq`) leaves the window.
- **Average**: a running sum and a count.
- **Distinct riders**: a counted map. A rider leaves the map only when their count reaches 0.

The current event is never evicted, because `ts > ts - W`. So the window is never empty after `add`.

**Complexity.** Brute force is O(n) per call, O(n²) in total. The reference is amortised O(1) per call, since each event is pushed and popped at most once in each deque. Space is O(events in the window).

**Alternatives and trade-offs.** A heap with lazy deletion is O(log n). A segment tree only makes sense when the window is fixed by count. At 10⁸ events a day, Python's per-object overhead matters: a candidate might mention ring buffers with numpy arrays, or moving this into the stream processor.

**Edge cases.** Several events at the same `ts`; W = 1; a fare of 0; one rider repeating; an event exactly W seconds old (excluded); `ts` going backwards; a very large sum (Python ints are unbounded, but in Java or Scala a `long` sum overflows only above about 9.2 × 10¹⁸).

**Common mistakes.** Using a closed window `[ts-W, ts]`, which changes call 5 to include ts = 10 and gives `(1500, 975.0, 3)`. Removing a rider from the set when any of their events leaves. Popping the max deque by value instead of by identity, which breaks on duplicate fares. A strict `<` in the max deque, which keeps duplicates; that is harmless if the pop is by identity.

**Test cases.** The sample. W = 1 with equal timestamps. All fares equal. A strictly decreasing fare sequence, where the deque grows. A rider churn pattern. Randomised against brute force (done: 3,000 cases).

**Follow-up answers.**
1. *Out of order by ≤ 5 s*: buffer events in a small min-heap keyed by ts and release them when `ts ≤ max_seen − 5`. Answers are then delayed by 5 s but exact. To answer immediately, you need structures that support insertion in the middle: a sorted container or an order-statistic tree, which is O(log n). Both the latency and the exactness trade-off must be stated.
2. *Median*: two heaps with lazy deletion (O(log n)), or an order-statistic tree or SortedList. If an approximation is acceptable, use a t-digest or a KLL sketch per sub-window; fares are bounded, so a fixed-bucket histogram with interpolation also works.

**Rubric anchors.** **2**: correct but O(window) per call, or a boundary bug. **3**: correct amortised O(1), validation, clear explanation. **4**: adds the identity-based eviction argument, both follow-ups with honest trade-offs, and production notes on memory and where this should live.

**Red flags.** Recomputing the window on every call while claiming O(1). Hand-waving about "just use a heap" without deletion. **Strong-hire signals.** Asks about the window's boundaries first. Proves the amortised bound. Tests the boundary case explicitly.

---

## R1-02: shortest_burst

**Reference solution**

```python
from collections import deque

def shortest_burst(amounts, threshold):
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    prefix = [0]
    for a in amounts:
        prefix.append(prefix[-1] + a)
    best = None
    dq = deque()                       # indices into prefix, prefix values strictly increasing
    for j in range(len(prefix)):
        while dq and prefix[j] - prefix[dq[0]] >= threshold:
            i = dq.popleft()           # i can never give a shorter run with a later j
            if best is None or (j - i) < (best[1] - best[0] + 1):
                best = (i, j - 1)
        while dq and prefix[dq[-1]] >= prefix[j]:
            dq.pop()                   # j dominates: a later start that is at least as good
        dq.append(j)
    return best
```

**Explanation.** A run i..j−1 has sum `P[j] − P[i]`. For each j we want the **largest** i with `P[i] ≤ P[j] − T`.
- **Front pops**: once `i` satisfies some j, any later j' gives a longer run from i, so i is finished.
- **Back pops**: if `P[k] ≥ P[j]` with k < j, then j is a strictly better start than k for every future end, because it is later and has a smaller or equal prefix.

Updating only when the new run is **strictly** shorter, with j scanned in increasing order, gives the earliest start among equally short runs. The reference matched brute force on 5,000 random arrays with negative values.

**Complexity.** O(n) time, O(n) space for the prefix array and deque. Brute force is O(n²) with prefix sums.

**Why two pointers fails (follow-up 1).** A sliding window needs the sum to grow as the window grows. Refunds break that. Counterexample: `[5, -10, 8]` with T = 8. Two pointers grows from index 0 (5, −5, 3), never reaches 8 with the left edge at 0, and never shrinks. It returns None, but `[8]` (index 2) qualifies.

**Follow-up 2 (streaming, length ≤ L).** Keep the last L+1 prefix values. Two options:
- A monotonic deque whose front is also evicted when it falls outside the length bound. At each new j you need the minimum P[i] over i ∈ [j−L, j−1]; check whether `P[j] − min ≥ T` and alert.
- If you need the run itself, a monotonic deque of minimums (a sliding-window minimum) gives the min in O(1) amortised.

Memory is O(L). This is the sliding-window minimum, not the shortest-run deque, and seeing that is the insight.

**Edge cases.** An empty list; one element equal to T; all values negative; a huge T; ties of equal length; prefix sums above 64 bits in other languages (10⁶ × 10⁶ = 10¹² fits).

**Common mistakes.** Using two pointers; a `>` against `≥` confusion; returning a length instead of indices; a tie-break that picks the latest run; popping the back with `>` instead of `≥`, which is harmless, but they should say why.

**Rubric anchors.** **2**: O(n²) correct, or O(n) two pointers that fails on negatives. **3**: correct deque solution with a justification. **4**: a crisp proof of both pops, the counterexample, and the streaming variant that recognises sliding-window minimum.

---

## R1-03: Rising-earnings streaks (gaps and islands)

**Reference solution (PostgreSQL 16, verified on the sample)**

```sql
WITH completed AS (
  SELECT driver_id, trip_id, completed_at, driver_earnings,
         CASE WHEN driver_earnings > LAG(driver_earnings) OVER w THEN 0 ELSE 1 END AS starts_run
  FROM trips
  WHERE status = 'completed'
  WINDOW w AS (PARTITION BY driver_id ORDER BY completed_at, trip_id)
), runs AS (
  SELECT *, SUM(starts_run) OVER (PARTITION BY driver_id ORDER BY completed_at, trip_id
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run_id
  FROM completed
)
SELECT driver_id,
       (ARRAY_AGG(trip_id ORDER BY completed_at, trip_id))[1]           AS first_trip_id,
       (ARRAY_AGG(trip_id ORDER BY completed_at DESC, trip_id DESC))[1] AS last_trip_id,
       COUNT(*)                                                          AS trips_in_run,
       MAX(driver_earnings) - MIN(driver_earnings)                       AS earnings_gain
FROM runs
GROUP BY driver_id, run_id
HAVING COUNT(*) >= 3
ORDER BY driver_id, first_trip_id;
```

**Explanation.** `starts_run` is 1 unless this trip strictly beats the previous completed trip. NULL comparisons give NULL, which falls into `ELSE 1`. So a NULL row starts a new run, and the row after it starts one too. The running sum of `starts_run` labels the islands. Because a run is strictly increasing, MAX − MIN equals last − first.

**Traps built into the data.** Driver 1 has a cancelled trip in the middle, which must **not** break the run. Driver 2 has equal earnings: the run starts at 202, not 201. Driver 4 has a NULL in 403, and a tie on `completed_at` between 404 and 405, where `trip_id` decides the order.

**Complexity.** One sort per driver partition, O(n log n). At 100M rows, this is a spill-to-disk sort unless there is an index on `(driver_id, completed_at, trip_id) WHERE status = 'completed'`, which allows an ordered index scan.

**Alternatives.** Use `LAG(…, 1)` and `LAG(…, 2)` to find triples; that finds windows of 3, not maximal runs, and the follow-up breaks it. `MATCH_RECOGNIZE` exists in Oracle, Snowflake and Trino, but not in PostgreSQL.

**Follow-up answers.**
1. *Longest per driver*: wrap the query in `ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY trips_in_run DESC, first_trip_id)`. For the 2-hour gap, add `OR completed_at - LAG(completed_at) OVER w > INTERVAL '2 hours'` to the start condition.
2. *Incremental*: keep per-driver state `(last_trip_id, last_completed_at, last_earnings, current_run_start, current_run_len)`. Each hourly batch is processed per driver from that state, upserting open runs and emitting runs as they close. Late trips that land inside history force a recompute **only for the affected driver from the late trip onward**. Mention idempotency through a batch watermark and upserts keyed on `(driver_id, first_trip_id)`.

**Common mistakes.** Filtering `status = 'completed'` *after* the `LAG`, so cancelled trips break runs. Using `ROW_NUMBER` differences on earnings, which does not work for "increasing". Counting triples, which over-reports overlapping windows. A nondeterministic order on ties.

**Rubric anchors.** **2**: finds triples but not maximal runs, or mishandles cancelled trips or NULLs. **3**: correct output matching the expected result. **4**: also covers the index and plan at 100M rows and gives a sound incremental design.

---

## R1-04: Dedup, then sessionize

**Reference solution (verified)**

```sql
WITH dedup AS (
  SELECT DISTINCT ON (event_id) event_id, rider_id, event_type, event_ts
  FROM app_events
  ORDER BY event_id, ingested_at DESC
), flagged AS (
  SELECT *,
         CASE WHEN event_ts - LAG(event_ts) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id)
                   <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS new_session
  FROM dedup
), numbered AS (
  SELECT *, SUM(new_session) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id
                                   ROWS UNBOUNDED PRECEDING) AS session_no
  FROM flagged
), sessions AS (
  SELECT rider_id, session_no, MIN(event_ts) AS session_start, MAX(event_ts) AS session_end,
         COUNT(*) AS events, BOOL_OR(event_type = 'trip_requested') AS converted
  FROM numbered GROUP BY rider_id, session_no
)
-- Part A: SELECT * FROM sessions ORDER BY rider_id, session_no;
SELECT (session_start AT TIME ZONE 'UTC')::date AS session_date,
       COUNT(*) AS sessions,
       COUNT(*) FILTER (WHERE converted) AS converted_sessions,
       ROUND(100.0 * COUNT(*) FILTER (WHERE converted) / COUNT(*), 1) AS conversion_pct
FROM sessions GROUP BY 1 ORDER BY 1;
```

**Traps built into the data.**
- `e2` is duplicated. Without dedup, rider 7's first session has 4 events.
- `e8` has a corrected timestamp. Keeping the *first* ingested copy (12:40) creates a 40-minute gap, which splits rider 9 into **two** sessions. The rule says latest `ingested_at`, which gives 12:20 and one session.
- 08:02 → 08:32 is **exactly** 30 minutes, so it is the same session.
- Rider 7's third session crosses midnight and belongs to 09-14.

**Order of operations.** Dedup must come first. Duplicates create zero-length gaps that do not change session boundaries, but they inflate counts. Corrected timestamps **do** change boundaries.

**Complexity.** Two window passes over the sort by `(rider_id, event_ts)`, plus a sort by `event_id` for `DISTINCT ON`. At scale, use `ROW_NUMBER()` in engines without `DISTINCT ON`.

**Follow-up answers.**
1. *Local time zone*: define the session's tz as the tz of its **first** event, which needs a `rider_tz` or `city_tz` on each event, then use `(session_start AT TIME ZONE first_tz)::date`. Candidates must state a rule. Any defensible rule (first event, majority, home city) is acceptable if it is applied consistently and documented.
2. *Incremental with 48 h lateness*: a session can only change if a late event falls within 30 minutes of it, and a late event can **merge** two sessions. Recompute each affected rider over `[late_ts − 30 min − max_session_len, …]`. In practice: reprocess the rider-days touched by new events, together with the neighbouring day, and replace those riders' sessions with an atomic partition overwrite or a MERGE keyed on `(rider_id, session_start)`. For idempotency, use a deterministic session id (rider_id plus the first event_id) and overwrite rather than append.

**Rubric anchors.** **2**: sessions are right but dedup is wrong or missing, or the gap is off by one at the boundary. **3**: matches the expected output with a deterministic order. **4**: also explains the order of operations, merge-on-late-event, and a deterministic session id.

---

## R1-05: Slow "completed trips by city" query

**Diagnosis (all verified on PostgreSQL 16 with `EXPLAIN`)**
1. **No partition pruning.** `date_trunc('day', event_ts AT TIME ZONE 'UTC') = …` wraps the partition key in a function. The planner cannot map that to partition bounds, so the plan scans every partition (`tse_2026_08`, `_09`, `_10`).
2. **Correlated SubPlan executed per row.** PostgreSQL does not decorrelate a scalar aggregate subquery here. `SubPlan 1` runs once for each candidate row, and with no index on `trip_id` it seq-scans **every partition** each time. That is O(rows × table).
3. **Correctness: double counting.** Trip 4 has two identical `completed` rows at the max timestamp, and both satisfy `event_ts = max(...)`. So city 20 returns **3** instead of 2.
4. **Semantics.** The stated question is "the latest status overall is completed, and that event is on 09-14". The original gets this right for trip 2, because the max over all history is the refund. But a naive rewrite that filters to the day *before* ranking would wrongly count trip 2. Strong candidates point out this trap themselves.

**Reference rewrite (verified: `10 → 1`, `20 → 2`; the inner scan touches only `tse_2026_09`, and the anti-join prunes August)**

```sql
CREATE INDEX ON trip_status_events (trip_id, event_ts);   -- created on each partition

SELECT city_id, count(*) AS completed_trips
FROM (
  SELECT DISTINCT ON (e.trip_id) e.trip_id, e.city_id, e.status
  FROM trip_status_events e
  WHERE e.event_ts >= TIMESTAMPTZ '2026-09-14 00:00+00'
    AND e.event_ts <  TIMESTAMPTZ '2026-09-15 00:00+00'
  ORDER BY e.trip_id, e.event_ts DESC
) last_on_day
WHERE status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM trip_status_events later
                  WHERE later.trip_id = last_on_day.trip_id
                    AND later.event_ts >= TIMESTAMPTZ '2026-09-15 00:00+00')
GROUP BY city_id;
```

Why it is correct: the trip's latest event overall falls on 09-14 exactly when its latest event *on* 09-14 has no later event, and the `NOT EXISTS` checks that. `DISTINCT ON` picks one row, so ties no longer double count. If two different statuses can tie on `event_ts`, the order needs a tie-breaker such as an `event_seq`, and the candidate should ask for one.

**Follow-up answers.**
1. *10M → 10B; PostgreSQL → warehouse.* What stays the same: sargable predicates, pruning, and avoiding per-row subqueries. What changes:
   - The warehouse has no B-tree indexes. Use **clustering or sort keys** on `(event_date, trip_id)`, and partition or cluster by date.
   - The anti-join becomes a **shuffle** on `trip_id`, so broadcast the small side.
   - Window functions over 10B rows need a pre-filtered input.
   - The day's ~30M trips × 4 events is fine. The anti-join against the whole future is not, so bound it with a maximum status-change horizon (for example, refunds within 90 days) and state that assumption.
   - At 10B rows, a current-state table is the real answer.
2. *Physical design.* Maintain `trip_current_status(trip_id PK, city_id, status, status_ts)`. Update it by an upsert from the event stream (CDC or Kafka), with `WHERE excluded.status_ts > current.status_ts` to handle out-of-order events. Build a per-minute aggregate `(city_id, day, status) → count`, maintained incrementally: decrement the old status and increment the new one in the same transaction. For hot cities, the rows are tiny counters, so contention is the issue rather than volume. Shard the counter rows (`city_id, shard`) and sum on read, or aggregate in the stream processor and write once a minute.

**Rubric anchors.** **2**: finds pruning or the subquery, but the rewrite changes the semantics. **3**: finds all the performance problems, and the rewrite is correct and pruned. **4**: also finds the tie double count, the semantic trap, the honest limits of the anti-join, and a credible physical design.

---

## R2-01: The shared-van game

**Reference solution (verified against exhaustive game-tree search)**

```python
from functools import lru_cache

def first_player_wins(seats, capacity):
    n = len(seats)
    @lru_cache(maxsize=None)
    def wins(mask, remaining):                  # remaining is a function of mask; kept for clarity
        for i in range(n):
            if not (mask >> i) & 1 and seats[i] <= remaining:
                if not wins(mask | (1 << i), remaining - seats[i]):
                    return True
        return False                             # no move, or every move hands the opponent a win
    return wins(0, capacity)
```

**State, recurrence and base case.**
- **State**: the mask of assigned requests. Remaining capacity is `capacity − Σ seats[assigned]`, so the mask alone is a complete key. Carrying `remaining` is redundant but harmless.
- **Recurrence**: `win(m) = ∃ i ∉ m with seats[i] ≤ rem(m) such that ¬win(m ∪ {i})`.
- **Base case**: no legal move means a loss. That falls out of the loop.

**Complexity.** O(2ⁿ · n) time and O(2ⁿ) memo in the worst case. Reachable states are often far fewer, because capacity prunes them. In the test with seats 1..18 and capacity 60, the reference finished in 0.04 s.

**Verified sample answers.** `[1,2,3],4 → False`; `[2,2,3],6 → False`; `[1,2,3,4],6 → True` (the only winning first move is index 2, the 3-seat request); `[4,4,4,4],15 → True`; `[5],4 → False`; `[1,1,2,3,5],7 → False`.

**Follow-up answers.**
1. *Every winning move*: list the `i` where `¬win({i})`. *Repeated sizes*: requests of the same size are interchangeable. So the state becomes `(remaining, counts per distinct size)`, a multiset, and it can be memoised on a tuple of counts. That collapses the n! symmetric orderings. With n = 40 and sizes 1–8, it ran in 0.76 s in the reference. The state is valid because the future of the game depends only on how many requests of each size remain and the remaining capacity.
2. *Misère*: the base case flips. With no legal move, the player to move has **won**, because the opponent made the last move. So `win(m) = (no legal move) OR ∃ move to a losing state`. The memoisation structure is unchanged.

**Common mistakes.** Treating the game as "who reaches the capacity", which is LeetCode 464's win condition, not this one. Memoising on `remaining` alone, which is wrong because the same remaining capacity can come from different sets of requests. Forgetting that no legal move at the start means False. Recursion depth is fine (≤ n).

**Rubric anchors.** **2**: plain minimax without a memo, or a wrong state key. **3**: correct memoised bitmask with analysis. **4**: adds the multiset reduction with its justification and the misère change.

---

## R2-02: Compaction planner

**Reference solution (verified against brute force over every split)**

```python
def plan_compaction(sizes, max_size, file_overhead):
    n = len(sizes)
    INF = float("inf")
    dp, choice = [INF] * (n + 1), [-1] * (n + 1)
    dp[0] = 0
    for j in range(1, n + 1):
        if sizes[j - 1] > max_size:                 # oversized: its own file, no slack penalty
            dp[j], choice[j] = dp[j - 1] + file_overhead, j - 1
            continue
        s = 0
        for i in range(j - 1, -1, -1):              # candidate file = sizes[i:j]
            if sizes[i] > max_size:
                break
            s += sizes[i]
            if s > max_size:
                break
            c = dp[i] + file_overhead + (max_size - s) ** 2
            if c < dp[j]:
                dp[j], choice[j] = c, i
    plan, j = [], n
    while j > 0:
        plan.append((choice[j], j - 1)); j = choice[j]
    return dp[n], plan[::-1]
```

**Explanation.** `dp[j]` is the minimum cost to lay out the first j inputs. The inner loop walks back while the group still fits, and stops at an oversized input. Plan reconstruction follows `choice`.

**Verified sample.** `[300,200,600,100,900,50,1500,400], 1024, 10000 → 824404` with the plan `[(0,1),(2,3),(4,5),(6,6),(7,7)]`. The arithmetic: slack² = 524² + 324² + 74² + 624² = 774,404, plus 5 files × 10,000 = 50,000.

**Complexity.** O(n · k), where k is the most inputs that fit in one file. That is ≤ max_size when every size ≥ 1, and O(n²) in the worst case under the stated constraints, which is about 25M steps. That is fine in Python for n = 5,000.

**Follow-up answers.**
1. *n = 10⁶*: k ≤ max_size / min_size bounds the inner loop. With `max_size = 10⁴` and minimum size 1, that is up to 10¹⁰ steps, which is too many. Options:
   - Realistic sizes are about 10–500 MB, so k is around 100, which makes it about 10⁸ steps (vectorise it, or write it in a compiled language).
   - The cost `(M − s)²` is convex in the prefix sum, so the **convex hull trick** or a monotone queue gives O(n). Expand the square: `dp[i] + (M − (P[j] − P[i]))²` is linear in P[j] for each fixed i.
   - With zero-size inputs, k is unbounded. Drop empties first; they add nothing.
2. *Platform*: compaction in Iceberg or Delta writes new files and commits a new snapshot that replaces the old ones. Readers on older snapshots are unaffected (snapshot isolation). Old files stay until snapshots expire or `VACUUM` runs, so time travel still works within retention. Conflicts: a compaction commit fails, or is retried, if a concurrent commit changed the same files. Streaming appends usually don't conflict with compaction of *older* partitions, so schedule compaction on partitions behind the write watermark. Mention target file size, sort or Z-order during compaction, and the cost of rewriting.

**Rubric anchors.** **2**: greedy packing, which is not optimal, or a DP with oversized inputs wrong. **3**: correct DP with reconstruction. **4**: the k-bound or convex-hull optimisation, plus a sound account of table-format compaction.

---

## R2-03: Crash after write, before commit

**Why duplicates appear.** The consumer gives at-least-once delivery: it writes the output, then commits the offset. A crash between those two steps replays everything since the last commit. The sink is a plain `INSERT` with no natural key, so every replay inserts again. A rebalance does the same thing: partitions move before the commit. Producer retries can also duplicate events upstream.

**Defensible designs (accept any of these, if the candidate is precise about it)**
1. **Idempotent sink keyed on a business key.** Add `UNIQUE (trip_id, line_type)`, or `UNIQUE (source_event_id)` if event_id is stable across producer retries; ask. Write with `INSERT … ON CONFLICT DO NOTHING`, or with a `DO UPDATE` that changes only when the version is newer. Offsets can stay at-least-once. The **result** is effectively exactly-once. This is cheapest and most robust.
2. **Offsets stored transactionally with the output.** Keep `consumer_offsets(topic, partition, offset)` in the same database and commit it in the same transaction as the payout lines. On partition assignment, seek to the stored offsets. This is atomic, but it couples the consumer to that database.
3. **A stream processor with a two-phase-commit sink.** Flink checkpoints plus a transactional or idempotent sink. Exactly-once covers state and the sink only if the sink takes part in the protocol.

**Kafka facts the candidate should get right.** The idempotent producer (`enable.idempotence`) de-duplicates *producer retries* per partition within a producer session. Transactions add atomic writes across partitions and, through `sendOffsetsToTransaction`, atomic **consume-transform-produce within Kafka**; downstream consumers must use `isolation.level=read_committed`. None of this makes writes to an **external** database exactly-once. If producers create a new event_id on each retry, dedup on event_id fails, so use the business key instead.

**Recovery and replay.** Deploy the unique constraint after cleaning up the existing duplicates; find them with `ROW_NUMBER` over `(trip_id, line_type)`. Replay from a saved offset or a timestamp (`offsetsForTimes`), safely, because the sink is idempotent. Add a daily **reconciliation**: count of distinct trips completed in the source against payout lines, and the sum of amounts.

**Follow-up answers.**
1. *Non-idempotent external API*:
   - Use a **transactional outbox** or **request ledger**: write `pending(request_key)` to your own database, call the API carrying the `request_key` (many payment APIs accept an idempotency key; ask), then mark it done.
   - After a crash, any `pending` row is *in doubt*. Query the API's status if it exists, otherwise reconcile.
   - The honest answer: with a truly non-idempotent API and no status lookup, you can only get at-most-once or at-least-once. Surface in-doubt items to a human or a reconciliation queue.
2. *Cost of a dedup store*: 50M/h × 24 × 7 ≈ **8.4B keys**. At about 50–100 bytes per key in a KV store, that is roughly **0.4–0.85 TB**, plus replication. Compare that with a unique index on the sink table, which you already pay for. Bloom filters cut memory, but they have false positives, which here means **dropped real events**. So a Bloom filter can only pre-screen before an exact check.

**Rubric anchors.** **2**: says "use exactly-once" or "commit first" without seeing the at-most-once risk that creates. **3**: an idempotent sink or transactional offsets, correctly explained. **4**: also states the precise limits of Kafka EOS, the in-doubt handling for external APIs, reconciliation, and a cost estimate.

**Red flags.** "Commit the offset before writing", which loses data. "Kafka exactly-once solves this". Dedup with a TTL shorter than the replay window.

---

## R2-04: CDC with schema evolution

**Reference architecture**
- **Capture**: PostgreSQL logical replication into a Debezium-style connector, then Kafka, with a topic keyed by `driver_id`. Per-key order comes from partitioning by key.
- **Bootstrap**: an **incremental, chunked snapshot** (Debezium supports signal-driven incremental snapshots) or a snapshot taken from a replica. The snapshot is interleaved with the stream, and the handoff is exact by LSN. This protects the source.
- **Apply**: every 1–5 minutes, a Spark job applies changes to:
  - `drivers_current`, the latest state, via MERGE;
  - `drivers_history`, which is insert-only with one row per change, keyed by `(driver_id, commit_lsn, event_seq)`.

**MERGE logic (Spark SQL, Iceberg or Delta)**

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY commit_lsn DESC, event_seq DESC) AS rn
  FROM changes_batch
)
MERGE INTO drivers_current t
USING (SELECT * FROM ranked WHERE rn = 1) s
ON t.driver_id = s.driver_id
WHEN MATCHED AND s.op = 'd' AND s.commit_lsn > t.commit_lsn THEN DELETE
WHEN MATCHED AND s.commit_lsn > t.commit_lsn THEN UPDATE SET *
WHEN NOT MATCHED AND s.op <> 'd' THEN INSERT *;
```

Collapsing to one row per key before the MERGE fixes "multiple source rows matched" (follow-up 1). The guard `s.commit_lsn > t.commit_lsn` makes the operation **idempotent and safe out of order**: a replayed older change is ignored. History uses `MERGE … WHEN NOT MATCHED THEN INSERT` on `(driver_id, commit_lsn, event_seq)`, so a replay does not duplicate rows.

**Schema changes**

| Change | Classification | Handling |
|---|---|---|
| Add `vehicle_type TEXT NULL` | Safe | Avro: add the field with a default; registry compatibility BACKWARD. Iceberg/Delta: add the column, which is metadata-only. |
| `rating` NUMERIC(3,2) → NUMERIC(4,3) | **Breaking**; this is the trap | Iceberg allows promoting decimal **precision** with the same scale. A **scale** change (2 → 3) is not an allowed promotion, and Avro decimal scale changes are also incompatible. Add a new column `rating_v2 DECIMAL(4,3)`, backfill it, and migrate consumers, or rewrite the table. |
| Rename `status` → `account_status` | Needs coordination | Iceberg tracks columns by ID, so a rename is metadata-only in the table. Delta needs column mapping mode. But the CDC stream shows a rename as a **new field name**, so the apply job must map the new name to the existing column, and downstream SQL breaks. Use a view alias during the transition. |

**Skew (follow-up 2).** Hot fleet keys concentrate in one MERGE task. Collapsing per key before the MERGE already removes most of it, because the 40% of updates become one row per key. Beyond that:
- Partition or bucket the target so that hot keys don't share files with everything else, which reduces how many files a MERGE rewrites.
- Use merge-on-read (positional or equality deletes) to cut write amplification at the cost of read-time merging, plus compaction.
- AQE skew handling helps joins.
- Salting doesn't help a key-based MERGE target, because a key must land in one place. Candidates who propose it should explain how.

**Rubric anchors.** **2**: "Debezium to Kafka to MERGE" with no ordering, delete or handoff story. **3**: correct ordering, idempotent MERGE, deletes, snapshot handoff. **4**: catches the decimal scale trap, the rename-as-new-field effect, and handles skew concretely.

---

## R2-05: PySpark debugging

**Defects, ranked by blast radius**

| # | Defect | Effect | Fix |
|---|---|---|---|
| 1 | `mode("overwrite")` with `partitionBy` under the default `spark.sql.sources.partitionOverwriteMode=static` | The whole output path is replaced: **every earlier day deleted** | Set `partitionOverwriteMode=dynamic`, or use a table format's partition replace (Delta `replaceWhere`, Iceberg `overwritePartitions()`) |
| 2 | `.join(payments, "trip_id")` | **Fan-out**: n payment rows per trip multiply `fare`. An inner join also **drops** trips with no payment rows | Pre-aggregate payments per trip, then left join |
| 3 | `F.sum("amount")` over all kinds | `charge` rows duplicate the fare (earnings = fare + tips + adjustments) | Filter `kind IN ('tip','adjustment')` |
| 4 | `.dropDuplicates(["trip_id"])` | Hides the fan-out from #2 and #5 by keeping an **arbitrary** row, so `extras` becomes one random payment and `tier` one random version. The result is **nondeterministic** across runs ("sometimes higher, sometimes lower") | Remove it; fix the joins |
| 5 | SCD2 `dim_driver` joined on `driver_id` alone | One row per driver **version**: fan-out and an arbitrary tier | Point-in-time join: `completed_at >= valid_from AND (valid_to IS NULL OR completed_at < valid_to)` |
| 6 | `F.col("status") != "cancelled"` | Keeps `no_show`. `NULL != 'cancelled'` is NULL, so NULL-status rows are silently dropped | `F.col("status") == "completed"` |
| 7 | `F.to_date("completed_at")` | Uses the session time zone (the JVM default unless set), not the city's: the **wrong local day** | `F.to_date(F.from_utc_timestamp("completed_at", F.col("timezone")))` with session tz = UTC |
| 8 | `Window.partitionBy("city_id").orderBy("earnings")` with `sum` | The default frame with ORDER BY is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`: a **running** total, so `share` is wrong, and ties share a value | No `orderBy` (whole-partition frame), or a `groupBy` total joined back |
| 9 | `F.broadcast(drivers)` on about 6 GB | The hint overrides `autoBroadcastJoinThreshold`, so it risks driver or executor OOM and broadcast timeouts. Spark refuses to broadcast tables over 8 GB | Filter dim versions to the run window first, then let the planner choose, or do a sort-merge join on `driver_id` |
| 10 | Date filter applied after the joins, on a derived column | No pruning: it reads all of `trips` history and joins it before filtering | Filter `completed_at` to the UTC range [D − 14 h, D + 36 h) **first**; that range covers UTC+14 to UTC−12. Then apply the exact local-date filter |

**Corrected job**

```python
from pyspark.sql import SparkSession, functions as F, Window

spark = (SparkSession.builder.appName("driver_daily_earnings")
         .config("spark.sql.session.timeZone", "UTC")
         .config("spark.sql.sources.partitionOverwriteMode", "dynamic")
         .getOrCreate())
run_date = "2026-09-14"
day0 = F.to_timestamp(F.lit(run_date))

cities = spark.read.parquet("s3://lake/dim_city/").select("city_id", "timezone")

trips = (spark.read.parquet("s3://lake/trips/")
    .filter(F.col("status") == "completed")
    .filter((F.col("completed_at") >= day0 - F.expr("INTERVAL 14 HOURS")) &
            (F.col("completed_at") <  day0 + F.expr("INTERVAL 36 HOURS")))
    .join(F.broadcast(cities), "city_id")
    .withColumn("local_date", F.to_date(F.from_utc_timestamp("completed_at", F.col("timezone"))))
    .filter(F.col("local_date") == F.lit(run_date).cast("date"))
    .select("trip_id", "driver_id", "city_id", "completed_at", "local_date", "fare"))

extras = (spark.read.parquet("s3://lake/payments/")
    .filter(F.col("kind").isin("tip", "adjustment"))
    .groupBy("trip_id").agg(F.sum("amount").alias("extras")))

drv = (spark.read.parquet("s3://lake/dim_driver/")
    .filter((F.col("valid_from") < day0 + F.expr("INTERVAL 36 HOURS")) &
            (F.col("valid_to").isNull() | (F.col("valid_to") > day0 - F.expr("INTERVAL 14 HOURS"))))
    .select("driver_id", F.col("tier"), "valid_from", "valid_to"))

t = (trips.join(extras, "trip_id", "left")
     .join(drv, (trips.driver_id == drv.driver_id) &
                (trips.completed_at >= drv.valid_from) &
                (drv.valid_to.isNull() | (trips.completed_at < drv.valid_to)), "left")
     .drop(drv.driver_id))

daily = (t.groupBy("driver_id", "city_id", "local_date")
    .agg(F.sum("fare").alias("fares"),
         F.coalesce(F.sum("extras"), F.lit(0)).alias("extras"),
         F.max_by("tier", "completed_at").alias("tier"))      # tier in effect at the driver's last trip that day
    .withColumn("earnings", F.col("fares") + F.col("extras")))

city_tot = daily.groupBy("city_id", "local_date").agg(F.sum("earnings").alias("city_total"))
result = (daily.join(city_tot, ["city_id", "local_date"])
    .withColumn("share", F.col("earnings") / F.col("city_total")))

result.write.mode("overwrite").partitionBy("local_date").parquet("s3://lake/agg/driver_daily_earnings/")
```

Notes: the tier rule ("in effect at the last trip of the day") is a **business decision**, and the candidate should ask for it. `max_by` needs Spark ≥ 3.0. Dynamic overwrite replaces only the partitions present in the output, so an empty result for the day leaves the old data in place. Mention that, and guard it with a row-count check.

**Follow-up answers.**
1. *São Paulo skew*: the original window put all of a city's rows in one task. The fix computes city totals with `groupBy`, which does partial aggregation before the shuffle and then joins a tiny table. Remaining skew comes from the `driver_id` join for big cities; use AQE `skewJoin`, which splits skewed partitions, or salting.
2. *Byte-identical reruns*: read a pinned **snapshot**, either a table-format snapshot id or immutable dated inputs. Use no nondeterministic operations (`dropDuplicates` without an order, `first()`, unordered `collect_list`). Use a fixed output file count and sort within partitions. Use a commit protocol with atomic partition replacement, which a table format gives you. Add golden-file tests and a row-count and sum reconciliation against the ledger.

**Rubric anchors.** **2**: finds 3–4 defects, misses the fan-out masking or the overwrite. **3**: finds #1–#8 with correct fixes. **4**: all ten, a correct ranking, catches that `dropDuplicates` *hides* bugs, and gives sound skew and rerun answers.

---

## Round 3: reference models (all DDL and queries ran on PostgreSQL 16; see `verify/r3_models.sql`)

These are **one** defensible model per question. Score the candidate's own model on the criteria, not on resemblance to this one.

### R3-01: Seat booking

**OLTP core.**
- `event_seat(event_id, seat_id)` is the primary key, and is the **inventory row**: `status ∈ {available, held, sold}`, `hold_id`, `held_until`, `version`, with a CHECK that a held row has both hold columns.
- `booking` has `idempotency_key UNIQUE`.
- `booking_item` stores a seat change as `moved` plus a new row, with `valid_from` and `valid_to`.
- A **partial unique index** `(event_id, seat_id) WHERE status = 'active'` on `booking_item` is the backstop against double sale.
- `booking_audit` is append-only.

**Hold (atomic conditional update; exactly one racer wins, verified).**

```sql
UPDATE event_seat
SET status='held', hold_id=$hold, held_until=now()+interval '8 minutes', version=version+1
WHERE event_id=$e AND seat_id = ANY($seats)
  AND (status='available' OR (status='held' AND held_until < now()))
RETURNING seat_id;   -- if fewer rows than requested: ROLLBACK (all-or-nothing)
```

**Confirm.** In one transaction: `UPDATE … SET status='sold' WHERE hold_id=$hold AND held_until >= now()`, check the row count, insert the booking under its idempotency key, insert the items, insert the audit rows. **Payment ordering**: authorise, then confirm the seat, then capture. If the hold expired between authorise and confirm, void the authorisation.

**Concurrency options (follow-up 1).**
- (a) Conditional UPDATE or row lock. Simple, strongly consistent; per-seat contention is fine.
- (b) `SELECT … FOR UPDATE SKIP LOCKED` for "best available". It avoids convoys.
- (c) SERIALIZABLE with retries. Correct, but retry storms at on-sale.
- (d) A Redis or in-memory allocator in front, with the database as the source of truth. Fast, but needs reconciliation.

For an 80k-seat on-sale, the bottleneck is the **request rate, not the seats**. Use a **virtual waiting room** to admit at a controlled rate, plus (a) or (b), and section-level sharding.

**Analytics.**
- `fact_hold`: one row per hold, with its outcome.
- `fact_booking_item_change`: one row per item state change; this is the transaction fact.
- `fact_inventory_snapshot`: event × tier × snapshot time; this is the periodic snapshot.
- Dimensions: `dim_event`, `dim_seat` (venue, section, row), `dim_price_tier` (SCD2, since prices change), `dim_buyer`, `dim_date`.

**History (follow-up 2).** A seat change closes the old item (`moved`, `valid_to = t`) and opens a new one. A cancellation sets `cancelled`. To see a booking **as of date D**, select `valid_from ≤ D < COALESCE(valid_to, ∞)`.

**Validation SQL (verified).**

```sql
-- sell-through by event and tier, latest snapshot
SELECT e.name, t.tier_name, ROUND(100.0 * s.sold / NULLIF(s.capacity, 0), 1) AS sell_through_pct
FROM fact_inventory_snapshot s JOIN dim_event e USING (event_key) JOIN dim_price_tier t USING (tier_key)
WHERE s.snapshot_at = (SELECT MAX(snapshot_at) FROM fact_inventory_snapshot x WHERE x.event_key = s.event_key)
ORDER BY 1, 2;

-- hold abandonment in the first hour of on-sale (closed holds only)
SELECT e.name,
       ROUND(100.0 * COUNT(*) FILTER (WHERE h.outcome IN ('expired','released'))
             / NULLIF(COUNT(*) FILTER (WHERE h.outcome <> 'open'), 0), 1) AS abandonment_pct
FROM fact_hold h JOIN dim_event e USING (event_key)
WHERE h.created_at >= e.onsale_at AND h.created_at < e.onsale_at + INTERVAL '1 hour'
GROUP BY e.name;
```

**Rubric anchors.** **2**: an application-level check-then-insert, which races. **3**: a guarantee enforced by the database, safe hold expiry, stated grains. **4**: compares the concurrency strategies against on-sale load, gets the payment ordering right, and gives as-of reconstruction.

### R3-02: Trip lifecycle

**Model.**
- `fact_trip` is an **accumulating snapshot** (one row per trip): milestone timestamps, `cancelled_by`, surge, fare, and `last_event_lsn` for idempotent updates.
- `fact_trip_event` is the transaction fact, one row per event, kept for funnel replays.
- `dim_driver` is **SCD2** (`valid_from`, `valid_to`, `is_current`). An `EXCLUDE USING gist` constraint prevents overlapping versions; it needs `CREATE EXTENSION btree_gist` for a BIGINT key, which the verification caught.
- Surge is a **measure** on the fact, since it is per-trip; a surge-zone dimension is optional.

**Validation SQL (verified).**

```sql
-- weekly completion rate by city and the driver's tier AT THE TIME OF THE TRIP
SELECT date_trunc('week', t.requested_at AT TIME ZONE c.tz)::date AS local_week, c.city_name, d.service_tier,
       COUNT(*) AS trips, COUNT(t.completed_at) AS completed,
       ROUND(100.0 * COUNT(t.completed_at) / COUNT(*), 1) AS completion_pct
FROM fact_trip t JOIN dim_city c USING (city_key)
LEFT JOIN dim_driver d ON d.driver_id = t.driver_id AND t.requested_at >= d.valid_from AND t.requested_at < d.valid_to
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

-- median minutes from request to pickup, by city and local hour
SELECT c.city_name, EXTRACT(HOUR FROM t.requested_at AT TIME ZONE c.tz)::int AS local_hour,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM t.started_at - t.requested_at) / 60) AS median_min_to_pickup
FROM fact_trip t JOIN dim_city c USING (city_key)
WHERE t.started_at IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2;
```

**Follow-ups.**
1. A late tier change is a **retroactive SCD2 split**: close the old version at the true effective time and insert the new one. Facts that join by point-in-time need no rewrite. Facts that stored a `driver_sk` must be re-keyed for the affected window. Published dashboards are restated with an annotation, or frozen, by policy.
2. For real time, a streaming aggregate over the event stream (per city, per minute) feeds an OLAP store. It reconciles with the warehouse by using the **same metric definition** (shared code or a semantic layer) and the same event-time attribution, plus a daily diff check.

**Rubric anchors.** **3** needs the correct point-in-time join and a stated grain. **4** adds retroactive SCD2 handling and the real-time reconciliation plan.

### R3-03: Food delivery

**Model.**
- `fact_order_status_event` keeps every event, with `device_ts` and `server_ts`.
- The authoritative timeline is **server time**, with transitions validated against the state machine. Out-of-order but valid events are kept; transitions that are not allowed are flagged, never silently dropped. Duplicates are de-duplicated on `event_id`.
- `fact_order` is the accumulating snapshot at order grain.
- `fact_order_item` is at item grain, with substitution and refund lines.
- `bridge_order_courier_leg(order_id, leg_no, courier_id, assigned_at, unassigned_at)` keeps the first courier's leg (constraint).
- The **delivery fee lives only at order grain**. That prevents the double count in follow-up 2: joining items to the order and summing `delivery_fee` multiplies it by the item count.

**Validation SQL (verified).**

```sql
SELECT restaurant_id, date_trunc('week', placed_at)::date AS week,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ready_at - prep_started_at) / 60) AS p90_prep_min
FROM fact_order WHERE ready_at IS NOT NULL AND prep_started_at IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;

SELECT order_id, status, server_ts AS entered_at,
       LEAD(server_ts) OVER (PARTITION BY order_id ORDER BY server_ts, event_id) - server_ts AS time_in_state
FROM fact_order_status_event ORDER BY order_id, entered_at;
```

**Rubric anchors.** **3** needs no fan-out and an explicit timeline rule. **4** adds transition validation, the courier bridge, and an honest treatment of clock skew.

### R3-04: Payments and ledger

**Model.**
- `capture` has `UNIQUE (psp, psp_reference)`.
- `refund` has `idempotency_key UNIQUE` and an amount in **integer minor units**.
- `ledger_entry` is an append-only double entry: every `journal_id` sums to 0 per currency.
- `fx_rate(rate_date, currency, usd_per_unit, minor_units)` stores exchange rates and currency exponents as data. JPY has 0 minor units; three-decimal currencies exist.
- `psp_settlement_line` holds the PSP files.

**Refund cap under concurrency (verified: the second 60% refund is rejected).**

```sql
BEGIN;
SELECT capture_id FROM capture WHERE capture_id = $c FOR UPDATE;          -- serialises refunds per capture
INSERT INTO refund (capture_id, idempotency_key, amount_minor, status)
SELECT $c, $key, $amt, 'pending'
WHERE (SELECT COALESCE(SUM(amount_minor), 0) FROM refund WHERE capture_id = $c AND status <> 'failed') + $amt
      <= (SELECT amount_minor FROM capture WHERE capture_id = $c)
ON CONFLICT (idempotency_key) DO NOTHING;                                  -- a retried request is a no-op
COMMIT;   -- caller distinguishes "inserted", "already exists (return original)", "cap exceeded"
```

**Postings.** For a charge: Dr `psp_receivable` / Cr `rider_revenue`. For a partial refund: the reverse, for the refund amount. For a chargeback: Dr `chargeback_loss` (or `dispute_receivable`) / Cr `psp_receivable`, plus fee entries. Corrections are always compensating journals.

**Validation SQL (verified).**

```sql
-- daily net revenue by currency and in USD; a missing rate is flagged, never dropped
WITH moves AS (
  SELECT (c.captured_at AT TIME ZONE 'UTC')::date AS day, c.currency, c.amount_minor FROM capture c
  UNION ALL
  SELECT (r.created_at AT TIME ZONE 'UTC')::date, c.currency, -r.amount_minor
  FROM refund r JOIN capture c USING (capture_id) WHERE r.status = 'succeeded'
)
SELECT m.day, m.currency, SUM(m.amount_minor) AS net_minor,
       ROUND(SUM(m.amount_minor) / POWER(10::numeric, f.minor_units) * f.usd_per_unit, 2) AS net_usd,
       f.currency IS NULL AS fx_rate_missing
FROM moves m LEFT JOIN fx_rate f ON f.rate_date = m.day AND f.currency = m.currency
GROUP BY m.day, m.currency, f.currency, f.minor_units, f.usd_per_unit ORDER BY 1, 2;

-- reconciliation: internal captures vs PSP settlement
SELECT COALESCE(c.psp, s.psp) AS psp, COALESCE(c.psp_reference, s.psp_reference) AS psp_reference,
       c.amount_minor AS ours, s.amount_minor AS theirs,
       CASE WHEN s.psp_reference IS NULL AND c.captured_at > $as_of - INTERVAL '2 days' THEN 'pending_settlement'
            WHEN s.psp_reference IS NULL THEN 'missing_at_psp'
            WHEN c.capture_id IS NULL     THEN 'missing_internally'
            WHEN c.amount_minor <> s.amount_minor OR c.currency <> s.currency THEN 'amount_mismatch'
            ELSE 'matched' END AS recon_state
FROM capture c
FULL OUTER JOIN (SELECT * FROM psp_settlement_line WHERE kind = 'capture') s
  ON s.psp = c.psp AND s.psp_reference = c.psp_reference;
```

Two PostgreSQL gotchas came up during verification:
- `POWER(10, n)` returns `double precision`, so `ROUND(double, 2)` does not exist. Cast to numeric.
- An inner join to `fx_rate` silently **drops** days with no rate. Good candidates guard against this.

**Rubric anchors.** **2**: mutable balances, floats, no idempotency. **3**: a ledger that balances, idempotency keys, a cap enforced with a lock or SERIALIZABLE. **4**: adds currency exponents, an explicit FX policy, a reconciliation state machine with time windows, and the interaction with month-end close (adjust in the open period, never edit a closed one).

### R3-05: Subscriptions and the MRR bridge

**Reference bridge (verified; balances every month).**

```sql
WITH bounds AS (SELECT MIN(month) AS first_month, MAX(month) AS last_month FROM fact_subscription_month),
months AS (SELECT generate_series(first_month, last_month, INTERVAL '1 month')::date AS month FROM bounds),
accounts AS (SELECT DISTINCT account_id FROM fact_subscription_month),
grid AS (
  SELECT a.account_id, m.month, COALESCE(f.mrr, 0) AS mrr
  FROM accounts a CROSS JOIN months m
  LEFT JOIN fact_subscription_month f ON f.account_id = a.account_id AND f.month = m.month
), moves AS (
  SELECT account_id, month, mrr,
         LAG(mrr, 1, 0::numeric) OVER (PARTITION BY account_id ORDER BY month) AS prev_mrr,
         BOOL_OR(mrr > 0) OVER (PARTITION BY account_id ORDER BY month
                                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS active_before
  FROM grid
)
SELECT month,
       COALESCE(SUM(prev_mrr), 0) AS opening_mrr,
       COALESCE(SUM(mrr) FILTER (WHERE prev_mrr = 0 AND mrr > 0 AND NOT COALESCE(active_before, false)), 0) AS new_mrr,
       COALESCE(SUM(mrr) FILTER (WHERE prev_mrr = 0 AND mrr > 0 AND active_before), 0) AS reactivation_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr > prev_mrr), 0) AS expansion_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr > 0 AND mrr < prev_mrr), 0) AS contraction_mrr,
       -COALESCE(SUM(prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr = 0), 0) AS churned_mrr,
       COALESCE(SUM(mrr), 0) AS closing_mrr
FROM moves GROUP BY month ORDER BY month;
```

**Traps.**
- Account 4 (Jul, a gap, Sep) is **reactivation**, not new. Without the dense grid, `LAG` sees Jul → Sep as an unchanged 40 and reports nothing.
- Account 2's churn in September only exists as a zero row in the grid.
- July's opening is 0 because there is no June. A production query would take the opening from the prior month's closing.

**Source model (follow-up 1).**
- `subscription(subscription_id, account_id, …)`.
- `subscription_period(subscription_id, plan_id, price, valid_from, valid_to, change_reason)`: SCD2-style effective dating. An upgrade from B to C on day 15 closes the B period and opens a C period.
- `invoice_line` carries the **proration** (credit for unused B, charge for the remaining C). That is billing; MRR is **not** prorated revenue.
- Month-end MRR is the normalised recurring price of the period active at month end: annual ÷ 12; a pause gives 0 with status `paused`, and the business decides whether that counts as churn.

**Real-time cancellation rate (follow-up 2).** Use a precise definition, for example: numerator = cancellations *effective or requested* (pick one and name it) in the last 24 h for a country; denominator = active subscriptions at the start of the window, or the average active count. Compute it with a keyed stream aggregate and a maintained active-count state. It reconciles with batch when both use the same definition, the same event-time attribution, and a daily diff.

**Rubric anchors.** **2**: no dense grid, or overlapping categories. **3**: a correct, balanced bridge. **4**: also gives effective-dated source tables with proration separate from MRR, and precise real-time definitions.

---

## Round 4: evaluation guides (no single answer is correct)

Score each design on: **requirements clarified** → **back-of-envelope numbers** → **ingestion** → **processing semantics** → **storage and serving matched to the queries** → **failure handling** → **trade-offs stated with costs** → **adaptation under the injected challenges**.

### R4-01: Global video streaming analytics

**Arithmetic a strong candidate produces.** 40M viewers × one heartbeat every 10 s = **4M events/s** from heartbeats alone. At about 300–500 B each, that is roughly 1.2–2 GB/s, or about 100–170 TB/day raw before compression. Kafka partitions therefore number in the hundreds to low thousands across regions. Per-partition throughput depends on the hardware, so the candidate should state an assumption.

**Competing defensible designs.**

| Concern | Option A | Option B | What to look for |
|---|---|---|---|
| Engine | Flink (per-event, rich state and timers, event time) | Spark Structured Streaming (micro-batch, simpler operations if the team already runs Spark) | A choice tied to latency targets and team skills, not fashion |
| Top-10, rolling 1 h | Tumbling **1-minute** pre-aggregates per title, a ring buffer of 60 buckets, top-K on each slide | A native sliding window (1 h / 1 min) | Flink's sliding assigner puts each element into **size/slide = 60 windows**, so per-element work and window state grow about 60×, even with incremental aggregation (60 accumulators per key). Bucketed pre-aggregation is the cheaper answer to follow-up 1 |
| Distinct viewers | HyperLogLog per (title, minute), merged over 60 | Exact sets in keyed state | HLL with 2¹⁴ registers has about 0.81% standard error (1.04/√m) and merges losslessly |
| Concurrency | Per-session keyed state with a timeout timer (for example 3 missed heartbeats = 30 s) | Count of distinct sessions with a heartbeat in the last 30 s | Defines "active", handles clean stops against silent drops |
| Abandonment | Session ends below X% of runtime or within N minutes, excluding the credits | — | A definition stated before any design |
| Serving | Real-time OLAP (Pinot, Druid or ClickHouse) for dashboards; Redis or a KV store for the "Trending now" API; lakehouse plus warehouse for history | — | The serving store matches the query shape and freshness |

**Partitioning.** For ingestion, key by `session_id`. That gives even load and per-session order, which is what concurrency needs. Never key by `title_id` at ingestion. Aggregate by title with **two-phase aggregation**: local pre-aggregation, or salting the title into N sub-keys, then a final merge. That is the hot-partition answer (challenge 4).

**Exactly-once, honestly.** Flink checkpoints give exactly-once *state*. A Kafka sink is end-to-end exactly-once with transactions and `read_committed` consumers. Redis and OLAP writes are exactly-once only if they are **idempotent upserts** (key = window + title). Aggregates are naturally replayable.

**Challenges (what good adaptation looks like).**
1. **10× traffic**:
   - Pre-provision partitions. Kafka partitions can be added but never removed, and adding them **changes the key→partition mapping**.
   - Autoscale the processors and pre-warm before known events.
   - Shed load by down-sampling heartbeats with weights (keeping every play, stop and error).
   - Run a separate topic or pipeline for the event.
2. **Latency 2 s → 2 min**:
   - Diagnose first: backpressure metrics, checkpoint duration and alignment, state backend (RocksDB) compaction, GC, a skewed subtask, a slow sink.
   - Then mitigate: scale out or rebalance, use unaligned checkpoints, decouple the slow sink, and degrade non-critical metrics.
3. **Regional cluster fails**:
   - Run per-region pipelines whose outputs are **mergeable aggregates** (counts, HLL), with global merges.
   - Replicate topics cross-region (MirrorMaker 2 or cluster linking). Offsets need translation.
   - Fail over to another region or replay from replicated data.
   - Say what the user sees meanwhile: stale, but labelled.
4. **Hot partition**: two-phase aggregation, salting, and keying ingestion by session.
5. **Late events change a published Top 10**:
   - Set an allowed-lateness policy and publish results **versioned "as of"**.
   - Upsert corrections in the OLAP store.
   - Decide whether the in-app row is ever corrected after publication (a product decision), and mark the results final after watermark + lateness.

**Follow-up 2 (exact concurrency for the final).** A dedicated exact pipeline for one event: per-session keyed state and exact counts, audited by reconciliation against the CDN or player logs, with the cost isolated. Approximate everywhere else.

**Rubric anchors.** **2**: boxes and arrows, no event time, no numbers. **3**: correct semantics and serving, handles 2–3 challenges well. **4**: quantified state and cost, the sliding-window state insight, an honest exactly-once story, and all five challenges handled coherently.

### R4-02: Surge features

**Look for:**
- H3 or S2 cells. Count a driver in their current cell, with documented boundary rules; a k-ring smoothing feature is optional.
- Key by cell at aggregation, with **two-phase** aggregation for hot cells (follow-up 1): pre-aggregate by `(cell, salt)`, then merge.
- Event time with bounded lateness, and features computed every 10–30 s.
- An online KV store keyed by `(cell, feature_set)`, with TTL above 60 s and a `computed_at` timestamp. Pricing reads it, checks freshness, and **falls back**: a city default, a neighbouring-cell average, or the last good multiplier with a cap.
- To avoid skew: **one feature definition** compiled to both streaming and batch, or log the served feature vectors at request time (point-in-time correct) and train on those logs (follow-up 2).
- Skew sources: different window boundaries, timezone or rounding differences, late data counted offline but not online, and leakage of future data in batch joins.

**Rubric anchors.** **3**: correct streaming semantics plus a fallback. **4**: adds served-feature logging for training and a quantitative hot-cell fix.

### R4-03: Courier tracking

**Arithmetic.**
- 2M / 4 s = **500k pings/s**. At about 100 B that is ~50 MB/s raw, about 4.3 TB/day, and about 1.6 PB/year raw. Columnar compression cuts this hugely; GPS columns often compress 5–10×, but candidates should present that as an estimate.
- Latest store: 2M keys, overwritten 500k times a second. That calls for an in-memory KV store with a last-write-wins guard on `seq_no`.
- Customer fan-out goes through a push gateway (WebSocket) that subscribes per courier.

**Geofencing.** A state machine per courier, keyed by courier:
- Enter after N consecutive pings inside the geofence with acceptable accuracy, or dwell for at least T seconds.
- Exit with **hysteresis**: an outer radius larger than the inner one.
- Order by `seq_no`/`device_ts`, and buffer briefly for tunnel bursts. Emit events idempotently.

**Cost (follow-up 2).**
- Keep the raw data hot for N days.
- Downsample older traces: keep trip-relevant segments at full rate and decimate idle time, or use map-matched polylines.
- Use Parquet or ORC with ZSTD and sort by `(courier_id, ts)`, which helps delta encoding.
- Lifecycle tiering moves cold data to cheaper storage classes.
- **Confirm with the ETA team which resolution the models actually use.**

### R4-04: Right to be forgotten

**Look for:**
- **Discovery**: column-level PII tags in the catalog, lineage to derived tables, and an identity map (`user_id` ↔ `device_id`/`email_hash`).
- **Batching**: accumulate requests and run one delete per table per cycle (weekly, say), aligned to the layout. Bucketing or clustering by user id keeps rewrites to few files.
- **Copy-on-write against merge-on-read**: MOR writes delete files cheaply and pays at read time until compaction, so it fits the read-SLO constraint only if compaction follows.
- **Snapshot expiry is part of the delete**: old snapshots and time travel still hold the data until they expire and orphan files are removed.
- **Kafka**: short retention, or compacted topics with tombstones, or crypto-shredding.
- **Backups**: say what the policy is and get legal sign-off on it.
- **Evidence**: per-request, per-table completion records and a verification query.

**Crypto-shredding (follow-up 1).** Per-user keys, with the key deleted to erase. It fails when:
- data was copied out in plaintext (exports, ML features, logs);
- the KMS sits on the hot path with high cardinality, which costs latency and money;
- aggregates or joins need the plaintext;
- the legal view is unsettled on whether encrypted-but-undecryptable data counts as erased. The candidate should say "check with counsel".

**Backfill race (follow-up 2).** The backfill reads an old snapshot and writes back rows that were deleted. Prevent it with optimistic concurrency (the commit fails or retries on a conflict), by checking a deny-list or erasure ledger during backfills, and by re-applying pending deletions after any backfill.

### R4-05: Experimentation metrics

**Look for:**
- Exposure dedup: the first exposure per (user, experiment), with users who saw several variants flagged or excluded under a stated policy.
- User-level aggregates per day, partitioned by date and bucketed by user.
- Variant-level **sufficient statistics**: n, Σx, Σx², Σy, Σy², Σxy. With these, the delta-method variance of a ratio metric needs no raw data (follow-up 1), and CUPED needs Σx_pre and Σx·x_pre.
- Incremental daily computation that recomputes the last N days for late data.
- `metric_version` stored with each result, and reproducibility as (version, snapshot id).
- A guardrail fast path: streaming counts of crashes and payment failures per variant with sequential-testing-aware alerting.

**Skew (follow-up 2).**
- Bots or power users dominate the sums, so cap or winsorise per user and detect bots.
- Huge-city joins skew, so use AQE or salting.
- The statistics are mostly hurt by the **variance** the outliers add, not by compute.

---

## Round 5: evaluation guides

**Applies to all leadership questions.**
- Score **evidence**: measurable outcomes, a personal contribution separated from the team's, alternatives considered, what failed, what they would change.
- **Do not reward invented-sounding stories.** If details collapse under probing, score lower than an honest "I haven't done this; here is how I'd approach it".
- STAR completeness is necessary but not sufficient. Judgement is the signal.

| Question | Strong-hire signals | Red flags |
|---|---|---|
| **R5-01** better arch ≠ right decision | Quantifies value against cost and opportunity cost (2 engineers × 2 quarters + $180k/yr against zero stated business need). Separates reversible from irreversible. Keeps the option cheap (event-ready schemas, a streaming PoC behind a flag). Handles the staff engineer with respect: a real problem to own, and the proposal kept for when the trigger condition hits. | "Newer is better". Steamrolling the engineer. No criteria for revisiting. |
| **R5-02** $2M cost | Attribution first (tags, query-level cost, top-N), then **unit costs** (cost per query, per TB, per pipeline). The portfolio: idle and over-provisioned clusters, spot or preemptible capacity for batch, warehouse auto-suspend and right-sizing, killing unused tables and dashboards, partition pruning and clustering, storage lifecycle and compression, egress (co-location, caching). SLO guardrails. **Showback or chargeback plus budgets** so savings stick (follow-up 2: costs creep back without ownership). The VP dashboard: show the data, offer a cheaper refresh (hourly, or on demand), let the owner decide with the cost visible. | Cutting without measuring. Ignoring SLOs. A one-off clean-up with no governance. |
| **R5-03** legacy pipeline | **Stabilise** first (monitoring, runbooks, retries, idempotent restarts) → **observe** (lineage, golden outputs) → **strangle** (replace step by step) → **verify** (parallel runs with reconciliation at driver level). Protects tax season, for example with a freeze 6 weeks before. On a 0.3% mismatch: neither system is presumed right. Trace sample drivers by hand against the source records and the tax rules, then involve the domain owner. Pausing: argue with risk numbers and keep the stabilisation work. | A big-bang rewrite. Cutover without a parallel run. "The new one is right because it's new." |
| **R5-04** wrong financial metric | Hour 1: declare the incident and assign roles. **Contain**: revert or flag, mark the data suspect, notify finance *before* they act. **Verify** the claim that payouts are unaffected. Lineage to find every consumer, including the forecasts. Day 1: corrected numbers with a backfill and a validation diff. Weeks 1–2: a blameless postmortem. **Guardrails** (follow-up 2): (a) a reconciliation check of the metric against the source-of-truth payout ledger, with a 0.5% threshold that blocks publication; (b) a join-cardinality or row-count assertion in CI or the pipeline (fan-out detection), plus a diff against production on a sample before deploy. Junior engineer: the system failed, not the person. Finance gets the causes and fixes, not a name. | Diagnosing while the bad number spreads. Blame. No prevention. Assuming payouts are fine. |
| **R5-05** conflict | Turns positions into constraints: the PM's real need (does the launch truly need sub-day freshness?), the architect's (avoid another orphaned pipeline), the DEs' (on-call load). Options with costs. A named decision-maker. A written decision record **with an exit plan for the interim batch path** (sunset date, migration owner, interface compatible with the platform). If the platform slips (follow-up 1): re-decide explicitly; never let "interim" become permanent by default. On escalation: welcome it, share the record, and ask what was missed. | Picking a side by seniority. Undocumented decisions. Resentment. "Interim" with no exit. |

---

## End-of-session report template (filled in after the candidate's answers)

> These sections can only be completed from real responses. **Never generate a performance report without candidate answers.**

1. **Round-by-round performance**: a table of round × competency (0–4 or N/A), with one line of evidence per score.
2. **Strengths and weaknesses**: evidence-based, citing question IDs.
3. **Incorrect or incomplete solutions**: what was wrong, why it matters, and the corrected approach (link to the section above).
4. **Recommended topics to revisit**, mapped from the gaps. For example: weak on R1-02 → prefix sums and monotonic deques; weak on R2-03 → delivery semantics and idempotent sinks.
5. **Three targeted follow-up practice questions**, generated for the specific weak areas: new problems, not variants of the same one.
6. **Specific improvement recommendations**, including how to practise them.

**Overall assessment rule.** Weigh the evidence across rounds. A single missed algorithm problem is never disqualifying on its own. State the impact of each weakness on the target role: for example, a weak DP result matters less for a Senior DE than weak idempotency reasoning.
