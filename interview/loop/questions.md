# The Five-Round Loop: question source (candidate-facing)

This file is the **source** for `/interview.app/loop/`. `python3 interview/loop/build.py`
turns it, `evaluator.md` and `runners.json` into `interview.app/loop/data/*.json`;
never edit the JSON. See `docs/FIVE-ROUND-LOOP.md`.

Rules for editing:
- These are **original practice problems**. Never call one real, verbatim, reported or
  asked by a named company, and never name a company as the "style" of a question.
  "RideCo" and "StreamCo" are invented; every scenario number is an assumption and is
  marked *scenario assumption* where it matters.
- Every sample output for a coding or SQL question is produced by running the reference
  solution (`verify/`). Change an example only by re-running it.
- Each question keeps the `## Rn-0k: Title` heading, the metadata table and the bold
  section labels the build reads (Business Scenario, Problem Statement, Sample Input /
  Schema, Expected Output, Constraints, Clarification questions to consider, Live
  challenges, Interviewer Follow-Up Questions, Evaluation Criteria).
- Text between a `# ROUND n:` heading and its first question is that round's note.

# ROUND 1: SQL & Data Structures and Algorithms

## R1-01: Rolling fare window over a time-based stream

| | |
|---|---|
| **Question ID** | R1-01 |
| **Interview Round** | 1: SQL & DSA |
| **Topic / Subtopic** | Sliding window / time-based streaming aggregates |
| **Difficulty** | Medium (Hard with the follow-ups) |
| **Estimated Time** | 25 min |
| **Skills evaluated** | Monotonic deque, incremental aggregates, boundary semantics, API design |
| **Technologies** | Python |
| **Competencies** | Correctness, Code quality, Algorithmic efficiency, Communication |

**Business Scenario.** RideCo's surge-monitoring service watches every completed trip in a city. For each trip as it arrives, the dashboard shows the highest fare, the average fare and the number of distinct riders over the **last W seconds**. The window is defined by time, not by a count of events.

**Problem Statement.** Implement:

```python
class FareWindow:
    def __init__(self, window_seconds: int) -> None: ...
    def add(self, ts: int, rider_id: str, fare_cents: int) -> tuple[int, float, int]:
        """Ingest one event and return (max_fare_cents, avg_fare_cents, distinct_riders)
        over all events with ts in the half-open window (ts - W, ts].
        avg is rounded to 2 decimal places."""
```

Give a brute-force approach, then an optimised one, then the code, its complexity, and how it handles edge cases.

**Sample Input / Schema.** `W = 60`

| call | ts | rider | fare_cents |
|---|---|---|---|
| 1 | 0 | r1 | 1200 |
| 2 | 10 | r2 | 900 |
| 3 | 30 | r1 | 1500 |
| 4 | 65 | r3 | 700 |
| 5 | 70 | r2 | 800 |
| 6 | 70 | r1 | 600 |
| 7 | 130 | r3 | 1000 |

**Expected Output**

```
(1200, 1200.0, 1)
(1200, 1050.0, 2)
(1500, 1200.0, 2)
(1500, 1033.33, 3)
(1500, 1000.0, 3)   # the event at ts=10 has left: 10 <= 70 - 60
(1500, 900.0, 3)
(1000, 1000.0, 1)
```

**Constraints**
- `1 ≤ W ≤ 86_400`; up to 10⁸ events per day per city; `0 ≤ fare_cents ≤ 10⁷`.
- `ts` is non-decreasing and several events can share one `ts`. A decreasing `ts` is an error.
- `add` must run in amortised O(1). Memory may be proportional to the number of events inside the window, and no more.

**Clarification questions to consider.** Is the window open or closed at each end? What happens to a `ts` that goes backwards: raise, drop, or buffer? Is a rider with two trips counted once? Do you round half-up or half-to-even?

**Interviewer Follow-Up Questions**
1. Events now arrive **up to 5 seconds out of order**. Keep the answers exact without giving up amortised O(1) for in-order events.
2. Product also wants the **median** fare in the window. Give the data structure and its complexity, then say what you would ship instead if the city has 50,000 events per window and an approximate median is acceptable.

**Evaluation Criteria.** Correct window boundaries; each aggregate maintained incrementally (deque for max, running sum, counted map for distinct); amortised analysis; input validation; clear naming.

---

## R1-02: Shortest burst of net wallet top-ups (refunds allowed)

| | |
|---|---|
| **Question ID** | R1-02 |
| **Interview Round** | 1: SQL & DSA |
| **Topic / Subtopic** | Sliding window / prefix sums with negative values |
| **Difficulty** | Hard |
| **Estimated Time** | 35 min |
| **Skills evaluated** | Seeing why two pointers fail, monotonic deque on prefix sums, proof of correctness, tie-breaking |
| **Technologies** | Python |
| **Competencies** | Correctness, Code quality, Algorithmic efficiency, Communication |

**Business Scenario.** RideCo Wallet lets riders add stored value. One fraud pattern is a fast burst of top-ups funded by stolen cards. The fraudster mixes in small refunds to break naive velocity rules. Risk wants the **shortest run of consecutive ledger entries** for an account whose net total reaches a threshold.

**Problem Statement**

```python
def shortest_burst(amounts: list[int], threshold: int) -> tuple[int, int] | None:
    """amounts[i] is a signed ledger entry in cents (top-up > 0, refund < 0), in time order.
    Return (start, end), inclusive indices of the SHORTEST contiguous run with
    sum >= threshold. If several runs are equally short, return the one that starts earliest.
    Return None if no run qualifies."""
```

**Sample Input / Schema and Expected Output**

| amounts | threshold | output |
|---|---|---|
| `[200, -150, 300, -50, 400, 100]` | 450 | `(4, 5)` |
| `[100, -300, 250, 250]` | 500 | `(2, 3)` |
| `[300, -100, 300, 400]` | 600 | `(2, 3)` |
| `[500]` | 500 | `(0, 0)` |
| `[50, 60]` | 200 | `None` |
| `[]` | 10 | `None` |

**Constraints.** `0 ≤ len(amounts) ≤ 10⁶`; `-10⁶ ≤ amounts[i] ≤ 10⁶`; `1 ≤ threshold ≤ 10¹²`. If `threshold ≤ 0`, raise `ValueError`. Target: O(n) time.

**Clarification questions to consider.** Must the run be contiguous in time or just in index order? Does "reaches" mean `≥` or `>`? Is the input one account's history or interleaved accounts?

**Interviewer Follow-Up Questions**
1. Explain why the standard shrinking two-pointer window is **wrong** when refunds exist. Then give a three-element counterexample.
2. Make it streaming. Entries arrive one at a time, and you must raise an alert the moment any run that **ends at the current entry** and is no longer than `L` entries reaches the threshold. Bound the memory you use.

**Evaluation Criteria.** Recognises that negatives break monotonicity; derives prefix sums with a monotonic deque; argues correctly why indices can be popped from each end; respects the tie-break; complexity; tests.

---

## R1-03: Drivers with three or more consecutive rising-earnings trips

| | |
|---|---|
| **Question ID** | R1-03 |
| **Interview Round** | 1: SQL & DSA |
| **Topic / Subtopic** | Advanced SQL / gaps-and-islands with `LAG` |
| **Difficulty** | Hard |
| **Estimated Time** | 25 min |
| **Skills evaluated** | Window functions, deterministic ordering, NULL semantics, island detection |
| **Technologies** | PostgreSQL 16 |
| **Competencies** | Correctness, SQL proficiency, Communication |

**Business Scenario.** An incentives team wants to study drivers on a "hot streak". A streak is three or more **consecutive completed trips** where each trip earned the driver strictly more than the one before. The `trips` table holds about 100 million rows (*scenario assumption*).

**Problem Statement.** Return every **maximal** streak of length ≥ 3: `driver_id, first_trip_id, last_trip_id, trips_in_run, earnings_gain` (last minus first earnings). Order the result by `driver_id, first_trip_id`. Consecutive means consecutive among that driver's **completed** trips, ordered by `completed_at` with ties broken by `trip_id`. Cancelled and no-show trips are ignored and do not break a streak. A completed trip with NULL earnings breaks any streak and cannot belong to one.

**Sample Input / Schema**

```sql
CREATE TABLE trips (
  trip_id          BIGINT PRIMARY KEY,
  driver_id        BIGINT NOT NULL,
  status           TEXT   NOT NULL CHECK (status IN ('completed','cancelled','no_show')),
  requested_at     TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,              -- NULL unless completed
  driver_earnings  NUMERIC(10,2)
);
```

| trip_id | driver | status | completed_at (UTC, 2026-09-01) | earnings |
|---|---|---|---|---|
| 101 | 1 | completed | 08:20 | 10.00 |
| 102 | 1 | completed | 09:25 | 12.00 |
| 103 | 1 | completed | 10:30 | 15.00 |
| 104 | 1 | cancelled | — | — |
| 105 | 1 | completed | 12:15 | 14.00 |
| 106 | 1 | completed | 13:20 | 16.00 |
| 107 | 1 | completed | 14:40 | 20.00 |
| 108 | 1 | completed | 15:30 | 25.00 |
| 201 | 2 | completed | 08:30 | 20.00 |
| 202 | 2 | completed | 09:30 | 20.00 |
| 203 | 2 | completed | 10:30 | 21.00 |
| 204 | 2 | no_show | — | — |
| 205 | 2 | completed | 11:30 | 22.00 |
| 301 | 3 | completed | 08:10 | 5.00 |
| 302 | 3 | completed | 09:10 | 8.00 |
| 401 | 4 | completed | 08:30 | 30.00 |
| 402 | 4 | completed | 09:30 | 31.00 |
| 403 | 4 | completed | 10:30 | NULL |
| 405 | 4 | completed | 11:30 | 33.00 |
| 404 | 4 | completed | 11:30 | 32.00 |
| 406 | 4 | completed | 12:30 | 34.00 |

**Expected Output**

```
 driver_id | first_trip_id | last_trip_id | trips_in_run | earnings_gain
-----------+---------------+--------------+--------------+---------------
         1 |           101 |          103 |            3 |          5.00
         1 |           105 |          108 |            4 |         11.00
         2 |           202 |          205 |            3 |          2.00
         4 |           404 |          406 |            3 |          2.00
```

**Constraints.** A single SQL statement; CTEs are allowed and procedural code is not. It must be valid PostgreSQL 16.

**Clarification questions to consider.** Strictly increasing, or non-decreasing? Do overlapping streaks count once (maximal runs) or as sliding triples? Which ordering is authoritative when `completed_at` ties?

**Interviewer Follow-Up Questions**
1. Change the output to **one row per driver**: their longest streak, with ties going to the earliest. Then add the constraint that the trips in a streak must be no more than 2 hours apart.
2. At 100M rows this query sorts every driver's history. Assume the table is partitioned by month and new trips arrive hourly. How would you maintain streaks **incrementally** without rescanning history? What state do you carry between runs?

**Evaluation Criteria.** Correct island key (running sum of "starts a run" flags); deterministic tie-break; NULL handling stated and implemented; no off-by-one in run length; awareness of the cost of the sort.

---

## R1-04: Deduplicate, then sessionize, rider app events

| | |
|---|---|
| **Question ID** | R1-04 |
| **Interview Round** | 1: SQL & DSA |
| **Topic / Subtopic** | Advanced SQL / deduplication, latest-record selection, sessionization |
| **Difficulty** | Hard |
| **Estimated Time** | 30 min |
| **Skills evaluated** | `DISTINCT ON` or `ROW_NUMBER`, choice of order of operations, inactivity-gap sessions, conversion metrics |
| **Technologies** | PostgreSQL 16 |
| **Competencies** | Correctness, SQL proficiency, Communication |

**Business Scenario.** The rider app sends events with at-least-once delivery. Retries create duplicate `event_id`s. Sometimes a retry carries a **corrected `event_ts`** after the device clock syncs. Growth wants session-level conversion: did a session contain a `trip_requested` event?

**Problem Statement**
- **Part A.** Deduplicate by `event_id`, keeping the copy with the **latest `ingested_at`**. Then build sessions per rider. A new session starts when the gap since the rider's previous event is **more than 30 minutes**; a gap of exactly 30 minutes stays in the same session. Return `rider_id, session_no (1-based per rider), session_start, session_end, events, converted`.
- **Part B.** Using Part A, report the daily conversion rate. Attribute each session to the **UTC date on which it started**. Return `session_date, sessions, converted_sessions, conversion_pct` (one decimal place).

**Sample Input / Schema**

```sql
CREATE TABLE app_events (
  event_id     TEXT        NOT NULL,   -- NOT unique in this table
  rider_id     BIGINT      NOT NULL,
  event_type   TEXT        NOT NULL,   -- app_open | search | price_view | trip_requested
  event_ts     TIMESTAMPTZ NOT NULL,
  ingested_at  TIMESTAMPTZ NOT NULL
);
```

| event_id | rider | type | event_ts (UTC) | ingested_at (UTC) |
|---|---|---|---|---|
| e1 | 7 | app_open | 09-14 08:00:00 | 09-14 08:00:05 |
| e2 | 7 | search | 09-14 08:02:00 | 09-14 08:02:03 |
| e2 | 7 | search | 09-14 08:02:00 | 09-14 08:09:41 |
| e3 | 7 | price_view | 09-14 08:32:00 | 09-14 08:32:02 |
| e4 | 7 | trip_requested | 09-14 09:10:00 | 09-14 09:10:01 |
| e5 | 7 | app_open | 09-14 23:50:00 | 09-14 23:50:02 |
| e6 | 7 | trip_requested | 09-15 00:05:00 | 09-15 00:05:04 |
| e7 | 9 | app_open | 09-14 12:00:00 | 09-14 12:00:01 |
| e8 | 9 | search | 09-14 12:40:00 | 09-14 12:40:02 |
| e8 | 9 | search | 09-14 12:20:00 | 09-14 12:55:00 |
| e9 | 9 | price_view | 09-14 12:45:00 | 09-14 12:45:01 |

**Expected Output** (session time `TimeZone = UTC`)

```
Part A
 rider_id | session_no |     session_start      |      session_end       | events | converted
----------+------------+------------------------+------------------------+--------+-----------
        7 |          1 | 2026-09-14 08:00:00+00 | 2026-09-14 08:32:00+00 |      3 | f
        7 |          2 | 2026-09-14 09:10:00+00 | 2026-09-14 09:10:00+00 |      1 | t
        7 |          3 | 2026-09-14 23:50:00+00 | 2026-09-15 00:05:00+00 |      2 | t
        9 |          1 | 2026-09-14 12:00:00+00 | 2026-09-14 12:45:00+00 |      3 | f

Part B
 session_date | sessions | converted_sessions | conversion_pct
--------------+----------+--------------------+----------------
 2026-09-14   |        4 |                  2 |           50.0
```

**Constraints.** Valid PostgreSQL 16. Your result must be deterministic even when two events share an `event_ts`.

**Clarification questions to consider.** Should the order of events come from device time or ingestion time? Which date owns a session that crosses midnight? Is a 30-minute gap inclusive? Do you deduplicate before sessionizing or after, and does it matter?

**Interviewer Follow-Up Questions**
1. Riders are in 400 cities. Product now wants the session date in the **rider's local time zone**, which can change mid-session when a rider travels. Define the rule and implement it.
2. This runs hourly over 3 billion events a day, and an event can arrive up to 48 hours late. Design the **incremental** version. Which sessions must be recomputed when a late event lands, and how do you make the rewrite idempotent?

**Evaluation Criteria.** Deduplicates **before** sessionizing, by the specified rule; gap logic matches the inclusive boundary; deterministic tie-break; correct midnight attribution; clean CTE structure.

---

## R1-05: Why is the "completed trips by city" query slow?

| | |
|---|---|
| **Question ID** | R1-05 |
| **Interview Round** | 1: SQL & DSA |
| **Topic / Subtopic** | SQL optimization / execution plans, partition pruning, correlated subqueries, indexing, skew |
| **Difficulty** | Very Hard |
| **Estimated Time** | 30 min |
| **Skills evaluated** | Plan reading, sargability, preserving semantics in a rewrite, physical design, scaling judgement |
| **Technologies** | PostgreSQL 16 (warehouse equivalents in the follow-ups) |
| **Competencies** | Correctness, SQL proficiency, Algorithmic efficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** `trip_status_events` records every status change of every trip: about 2 billion rows a year, range-partitioned by month on `event_ts` (*scenario assumption*). The ops dashboard query below takes 40+ minutes. It is meant to answer one question: **per city, how many trips have a current (latest) status of `completed`, where that latest event happened on 2026-09-14 UTC?**

**Problem Statement.** Diagnose every performance problem, and any correctness problem, in the query and its plan. Then write a faster query that answers the stated question correctly, and name the indexes or physical design it relies on.

**Sample Input / Schema**

```sql
CREATE TABLE trip_status_events (
  trip_id   BIGINT NOT NULL,
  city_id   INT    NOT NULL,
  status    TEXT   NOT NULL,     -- requested | accepted | completed | cancelled | refunded ...
  event_ts  TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (event_ts);  -- monthly partitions tse_2026_08, tse_2026_09, tse_2026_10, ...

-- The slow query
SELECT e.city_id, count(*) AS completed_trips
FROM trip_status_events e
WHERE date_trunc('day', e.event_ts AT TIME ZONE 'UTC') = DATE '2026-09-14'
  AND e.status = 'completed'
  AND e.event_ts = (SELECT max(e2.event_ts)
                    FROM trip_status_events e2
                    WHERE e2.trip_id = e.trip_id)
GROUP BY e.city_id;
```

Plan excerpt (`EXPLAIN (COSTS OFF)`, PostgreSQL 16, three partitions present):

```
GroupAggregate
  ->  Sort
        ->  Append
              ->  Seq Scan on tse_2026_08 e_1
                    Filter: ((status = 'completed') AND (date_trunc('day', (event_ts AT TIME ZONE 'UTC')) = '2026-09-14'::date)
                             AND (event_ts = (SubPlan 1)))
                    SubPlan 1
                      ->  Aggregate
                            ->  Append
                                  ->  Seq Scan on tse_2026_08 e2_1  Filter: (trip_id = e_1.trip_id)
                                  ->  Seq Scan on tse_2026_09 e2_2  Filter: (trip_id = e_1.trip_id)
                                  ->  Seq Scan on tse_2026_10 e2_3  Filter: (trip_id = e_1.trip_id)
              ->  Seq Scan on tse_2026_09 e_2   (same filter)
              ->  Seq Scan on tse_2026_10 e_3   (same filter)
```

Test data (12 rows):

| trip | city | events (UTC) |
|---|---|---|
| 1 | 10 | requested 09-14 08:00 → completed 09-14 08:30 |
| 2 | 10 | requested 09-14 09:00 → completed 09-14 09:30 → **refunded 09-15 10:00** |
| 3 | 20 | requested 09-13 23:50 → completed 09-14 00:20 |
| 4 | 20 | requested 09-14 10:00 → completed 09-14 10:30 → completed 09-14 10:30 (**duplicate row**) |
| 5 | 10 | requested 09-14 11:00 → cancelled 09-14 11:05 |

**Expected Output** (for the stated question)

```
 city_id | completed_trips
---------+-----------------
      10 |               1
      20 |               2
```

The original query returns `20 → 3` on this data. Explain why.

**Constraints.** Keep the semantics exactly as stated. You may add indexes, but you may not change the partitioning key.

**Clarification questions to consider.** Is "latest" over the trip's whole history, or only that day? What happens when two events share the max timestamp? How late can a status change arrive?

**Interviewer Follow-Up Questions**
1. **What changes when the table grows from 10 million to 10 billion rows**, and when it moves from PostgreSQL to a columnar warehouse (BigQuery, Snowflake or Spark SQL on Iceberg)? Name what stays the same and what changes: indexes against clustering, pruning, and shuffle.
2. Your rewrite is fast, but the dashboard needs this every minute for every city, and three cities hold 40% of trips. Propose a **physical design** that makes the query trivial: a current-status table, incremental maintenance, or materialized aggregates. Say how it handles the hot cities.

**Evaluation Criteria.** Identifies that the function on the partition key defeats pruning; the per-row correlated SubPlan that scans every partition; the double count on tied max timestamps; and the semantic trap of "latest on that day" versus "latest overall". Produces a rewrite that preserves semantics and keeps pruning, and justifies its index.

---

# ROUND 2: DSA & Core Data Engineering

## R2-01: The shared-van game (bitmask game theory)

| | |
|---|---|
| **Question ID** | R2-01 |
| **Interview Round** | 2: DSA & Core DE |
| **Topic / Subtopic** | Dynamic programming / game theory, bitmask memoization |
| **Difficulty** | Hard |
| **Estimated Time** | 35 min |
| **Skills evaluated** | State definition, win/lose recurrence, memoization, state-space reduction |
| **Technologies** | Python |
| **Competencies** | Correctness, Code quality, Algorithmic efficiency, Communication |

**Business Scenario.** RideCo is testing an "assignment game" to train two dispatch agents against each other. The difficulty is in the spirit of LeetCode 464, *Can I Win*, but the rules are different. There are `n` pending ride requests, and request `i` needs `seats[i]` seats. A shared van has `capacity` seats. Two agents take turns. On each turn the agent must assign **one unassigned request that still fits** into the remaining capacity. **An agent who cannot make a legal move loses**: either every remaining request is too big, or none remain.

**Problem Statement**

```python
def first_player_wins(seats: list[int], capacity: int) -> bool:
    """True if the first agent can force a win, assuming both play optimally."""
```

Give the state definition, the recurrence, the base cases, an optimised implementation, the complexity, and edge-case tests.

**Sample Input / Schema and Expected Output**

| seats | capacity | output | note |
|---|---|---|---|
| `[1, 2, 3]` | 4 | `False` | |
| `[2, 2, 3]` | 6 | `False` | |
| `[1, 2, 3, 4]` | 6 | `True` | the only winning first move assigns the 3-seat request |
| `[4, 4, 4, 4]` | 15 | `True` | |
| `[5]` | 4 | `False` | no legal first move |
| `[1, 1, 2, 3, 5]` | 7 | `False` | |

**Constraints.** `0 ≤ n ≤ 20`; `1 ≤ seats[i] ≤ 50`; `0 ≤ capacity ≤ 1000`. Requests are distinct objects even when their seat counts repeat.

**Clarification questions to consider.** Is the remaining capacity determined by the mask? (It is, because remaining = capacity − sum of assigned seats.) Is passing allowed? What is the result for `n = 0`?

**Interviewer Follow-Up Questions**
1. Return **every** winning first move, not just a boolean. Then explain how to cut the state space when seat counts repeat heavily, say `n = 40` with seat sizes 1–8. What is the new state, and why is it valid?
2. Change the rule to **misère**: the agent who makes the **last legal move loses**. What changes in your recurrence, and what stays the same?

**Evaluation Criteria.** Correct normal-play recurrence ("I win if some move leads to a losing state for the opponent"); memo key carries all the state and nothing redundant; analysis of 2ⁿ·n; tests include no-move and all-fit cases.

---

## R2-02: Compaction planner for small files (interval DP)

| | |
|---|---|
| **Question ID** | R2-02 |
| **Interview Round** | 2: DSA & Core DE |
| **Topic / Subtopic** | Dynamic programming / contiguous partitioning with a cost function |
| **Difficulty** | Hard |
| **Estimated Time** | 35 min |
| **Skills evaluated** | DP formulation, reconstructing the solution, bounding the inner loop, translating DP to a data-lake problem |
| **Technologies** | Python; lakehouse table formats in the follow-ups |
| **Competencies** | Correctness, Code quality, Algorithmic efficiency, Trade-off analysis, Communication |

**Business Scenario.** A streaming job writes one file per hourly partition to the lake. The files vary wildly in size. A nightly compaction job merges **adjacent** hourly files, to keep time ordering and min/max pruning statistics, into files no larger than `max_size` MB. Small files hurt query planning more than proportionally, so a file of size `s` costs `file_overhead + (max_size − s)²`. An hourly file that is **already larger than `max_size`** is left alone as a file of its own and costs only `file_overhead`. *(The cost model is a scenario assumption.)*

**Problem Statement**

```python
def plan_compaction(sizes: list[int], max_size: int, file_overhead: int) -> tuple[int, list[tuple[int, int]]]:
    """Return (minimum total cost, plan), where plan is a list of inclusive (start, end)
    index ranges covering 0..n-1 in order. Merged groups must be contiguous and sum to
    <= max_size, and an oversized input must be a group of its own."""
```

**Sample Input / Schema and Expected Output**

| sizes (MB) | max_size | file_overhead | min cost | an optimal plan |
|---|---|---|---|---|
| `[300, 200, 600, 100, 900, 50, 1500, 400]` | 1024 | 10000 | `824404` | `[(0,1), (2,3), (4,5), (6,6), (7,7)]` |
| `[100, 100, 100, 100, 100]` | 512 | 0 | `144` | `[(0,4)]` |
| `[2000]` | 1024 | 7 | `7` | `[(0,0)]` |

Any plan that reaches the minimum cost is accepted.

**Constraints.** `1 ≤ n ≤ 5,000`; `1 ≤ sizes[i] ≤ 10⁵`; `1 ≤ max_size ≤ 10⁴`; `0 ≤ file_overhead ≤ 10⁹`.

**Clarification questions to consider.** Can an oversized file be split? (No.) Is an empty input valid? Does the last file get an exemption from slack, as in word-wrap? (No.)

**Interviewer Follow-Up Questions**
1. `n` becomes 10⁶ (one file per minute for two years) and every `sizes[i] ≥ 1`. How do you make the DP fast enough? Use the fact that a group sums to at most `max_size`, then say what changes if the minimum size is 0.
2. Move from algorithm to platform. In Iceberg or Delta, what does compaction actually do to readers and to concurrent writers, snapshots and time travel? How would you schedule it so it never conflicts with the streaming writer?

**Evaluation Criteria.** Correct `dp[j] = min over i of dp[i] + cost(i..j-1)`; handles oversized inputs; reconstructs the plan; O(n·k) bound reasoning; links the toy model to real compaction trade-offs.

---

## R2-03: Crash after write, before offset commit: guaranteeing no duplicate business records

| | |
|---|---|
| **Question ID** | R2-03 |
| **Interview Round** | 2: DSA & Core DE |
| **Topic / Subtopic** | Core DE / delivery semantics, idempotency, Kafka offsets |
| **Difficulty** | Very Hard |
| **Estimated Time** | 40 min |
| **Skills evaluated** | Precise semantics vocabulary, end-to-end reasoning, idempotent sink design, cost of guarantees |
| **Technologies** | Apache Kafka, a relational or lakehouse sink, Flink or Spark Structured Streaming |
| **Competencies** | Correctness, Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** The `trip-completed` topic carries about **50M events/hour** (*scenario assumption*). A consumer service reads each event, computes a driver-payout line, writes it to a payouts store, and then commits its Kafka offset. Last night a consumer was OOM-killed **after writing output but before committing the offset**. On restart it re-read about 400k events, and finance found duplicate payout lines.

**Problem Statement.** Explain exactly why duplicates appear. Then design the pipeline so that **each source event produces exactly one payout line**, even under crashes, rebalances, producer retries and replays. Distinguish what Kafka guarantees from what your design must guarantee.

**Sample Input / Schema**

```
trip-completed (key = trip_id, 256 partitions)
{ "event_id": "uuid", "trip_id": 991, "driver_id": 42, "fare_cents": 1830,
  "completed_at": "2026-09-14T08:30:00Z", "schema_version": 3 }

payout_lines(payout_line_id, driver_id, trip_id, amount_cents, created_at)   -- current table, no unique keys
```

**Expected Output.** A design and an explanation that cover: the failure timeline; the guarantee you choose and why; the sink schema change and the write pattern; the recovery and replay procedure; how you prove the guarantee holds in production.

**Constraints.** p99 end-to-end latency ≤ 60 s. The payouts store must be queryable by finance. You cannot change producers this quarter.

**Clarification questions to consider.** Can the same trip legitimately emit two different completion events, for example a fare adjustment? Is `event_id` stable across producer retries? What is the source topic's retention, and how far back can we replay?

**Interviewer Follow-Up Questions**
1. Your sink is now an **external HTTP payments API** that is not idempotent, and you cannot change it. What can you still guarantee, and how? Consider an outbox, a dedup ledger, reconciliation, and what you surface when the guarantee cannot be met.
2. Someone proposes "just turn on Kafka exactly-once". State precisely what Kafka transactions and idempotent producers do and do not cover. Then estimate what a consumer-side dedup store costs at 50M events/hour with a 7-day replay window.

**Evaluation Criteria.** Separates at-least-once delivery from effectively-once results; puts idempotency in the sink via a natural key and upsert or `ON CONFLICT`, or via transactional offset storage; knows where Kafka EOS ends; has a recovery and replay story with a reconciliation check; talks about cost.

---

## R2-04: CDC into the lakehouse with schema evolution and out-of-order updates

| | |
|---|---|
| **Question ID** | R2-04 |
| **Interview Round** | 2: DSA & Core DE |
| **Topic / Subtopic** | Core DE / CDC, schema evolution, MERGE, partitioning and skew |
| **Difficulty** | Hard |
| **Estimated Time** | 40 min |
| **Skills evaluated** | Log-based CDC, ordering, deletes, snapshot + stream bootstrap, schema compatibility, MERGE cost |
| **Technologies** | PostgreSQL logical replication, Debezium-style CDC, Kafka, Spark, Iceberg or Delta |
| **Competencies** | Data modeling quality, Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** The `drivers` table (30M rows) in the operational PostgreSQL database must be mirrored into the lakehouse within 15 minutes. It must also keep **full history** for audits. Upstream teams change the schema without warning about twice a month (*scenario assumption*).

**Problem Statement.** Design the pipeline end to end: the initial load, continuous change capture, applying changes to a current-state table **and** a history table, deletes, schema changes, and the operational behaviour.

**Sample Input / Schema.** A simplified change event:

```json
{"op": "u", "source": {"lsn": 88123344, "txId": 5521, "ts_ms": 1789374000000},
 "before": {"driver_id": 42, "city_id": 7, "status": "active",    "rating": 4.91},
 "after":  {"driver_id": 42, "city_id": 9, "status": "suspended", "rating": 4.91}}
```

Upcoming schema changes: add `vehicle_type TEXT NULL`; widen `rating` from `NUMERIC(3,2)` to `NUMERIC(4,3)`; rename `status` to `account_status`.

**Expected Output.** An architecture with its data flow; the DDL for both target tables; the MERGE logic in Spark SQL or pseudocode, including ordering; and a classification of each schema change as safe, needs coordination, or breaking, with the handling for each.

**Constraints.** No double-counting in the history table on replay. The source database must not be overloaded during the initial snapshot.

**Clarification questions to consider.** Is ordering guaranteed per key, per partition, or globally? Are hard deletes possible, or only soft deletes? Do consumers need "as of" queries?

**Interviewer Follow-Up Questions**
1. A batch contains **three updates to the same `driver_id`**, and one of them arrived late from a replayed partition. MERGE fails with "multiple source rows matched". Fix it in a way that stays correct on replay.
2. Ten "fleet" accounts get 40% of all updates, and the MERGE stage now has one task running 30× longer than the median. Diagnose and fix it. Consider partitioning, bucketing, salting, and merge-on-read against copy-on-write.

**Evaluation Criteria.** Snapshot plus stream with an exact handoff (LSN or watermark); orders by the source log position, not arrival time; deletes as tombstones; idempotent history inserts; schema-registry compatibility modes; reasoning about MERGE cost.

---

## R2-05: Debug the daily driver-earnings PySpark job

| | |
|---|---|
| **Question ID** | R2-05 |
| **Interview Round** | 2: DSA & Core DE |
| **Topic / Subtopic** | Debugging / PySpark joins, windows, time zones, writes |
| **Difficulty** | Hard |
| **Estimated Time** | 35 min |
| **Skills evaluated** | Reading code for semantic bugs, Spark execution knowledge, prioritising defects |
| **Technologies** | PySpark 3.5, Parquet on object storage |
| **Competencies** | Correctness, Code quality, Algorithmic efficiency, Reliability and scalability, Communication |

**Business Scenario.** This job computes each driver's earnings per **city-local** calendar day, along with the driver's share of their city's total. Finance says totals are "sometimes higher, sometimes lower" than the ledger. Yesterday the job also **deleted every earlier day** of the output table.

**Problem Statement.** Find every defect: correctness, determinism, performance and operability. Rank them by impact and give corrected code.

**Sample Input / Schema**

```python
# trips:     trip_id, driver_id, city_id, status ('completed'|'cancelled'|'no_show'|NULL), completed_at TIMESTAMP (UTC), fare DECIMAL
# payments:  payment_id, trip_id, amount DECIMAL, kind ('charge'|'tip'|'adjustment')   -- 0..n rows per trip
# dim_city:  city_id, timezone (IANA, e.g. 'America/Sao_Paulo')                       -- 600 rows
# dim_driver: driver_id, tier, valid_from, valid_to (SCD2, valid_to NULL = current)   -- 40M rows, ~6 GB
# Business rule: only COMPLETED trips count; earnings = fare + tips + adjustments.
from pyspark.sql import SparkSession, functions as F, Window

spark = SparkSession.builder.appName("driver_daily_earnings").getOrCreate()
run_date = "2026-09-14"

trips    = spark.read.parquet("s3://lake/trips/")
payments = spark.read.parquet("s3://lake/payments/")
cities   = spark.read.parquet("s3://lake/dim_city/")
drivers  = spark.read.parquet("s3://lake/dim_driver/")

daily = (
    trips
    .filter(F.col("status") != "cancelled")
    .join(payments, "trip_id")
    .join(F.broadcast(drivers), "driver_id")
    .join(cities, "city_id")
    .withColumn("local_date", F.to_date("completed_at"))
    .filter(F.col("local_date") == run_date)
    .dropDuplicates(["trip_id"])
    .groupBy("driver_id", "city_id", "local_date", "tier")
    .agg(F.sum("fare").alias("fares"), F.sum("amount").alias("extras"))
    .withColumn("earnings", F.col("fares") + F.col("extras"))
)

w = Window.partitionBy("city_id").orderBy("earnings")
result = (daily
    .withColumn("city_total", F.sum("earnings").over(w))
    .withColumn("share", F.col("earnings") / F.col("city_total")))

(result.write.mode("overwrite")
       .partitionBy("local_date")
       .parquet("s3://lake/agg/driver_daily_earnings/"))
```

**Expected Output.** A ranked list of defects, each with what goes wrong, an input that triggers it, and the fix. Then a corrected job.

**Constraints.** Keep Spark 3.5 and Parquet. Assume default Spark configuration unless you say otherwise.

**Clarification questions to consider.** Which tier should a driver get on a day their tier changed? Does "adjustment" include negative amounts? Is `trips` partitioned on disk, and by what?

**Interviewer Follow-Up Questions**
1. After your fixes, one task for São Paulo runs for 50 minutes while the other 199 finish in 2. Explain why, then fix it without changing the output.
2. Finance wants the job to be **re-runnable for any past date** with byte-identical output. What else must change: deterministic inputs, snapshot reads, output commit protocol, and tests?

**Evaluation Criteria.** Catches the join fan-out, the SCD2 join without validity bounds, `dropDuplicates` masking bugs nondeterministically, `!=` dropping NULLs and keeping no-shows, the UTC/local date, the running-sum window frame, static partition overwrite, and the forced 6 GB broadcast. Ranks by blast radius; the fixes are minimal and correct.

---

# ROUND 3: Data Modeling & Low-Level Design

Every question in this round asks for the same four parts: **(A)** requirements, volumes, latency and reporting use cases; **(B)** a model: entities, keys, facts and dimensions with their grain, star or snowflake, SCD types, history, and OLTP vs OLAP forms; **(C)** system behaviour: creation, modification, cancellation, concurrency, duplicates, refund consistency and audit; **(D)** at least two SQL queries against your own model.

## R3-01: Concert and event seat booking

| | |
|---|---|
| **Question ID** | R3-01 |
| **Interview Round** | 3: Modeling & LLD |
| **Topic / Subtopic** | Event booking / inventory, holds, concurrency |
| **Difficulty** | Very Hard |
| **Estimated Time** | 50 min |
| **Skills evaluated** | Inventory modeling, transactional isolation, hold expiry, booking history, analytical facts |
| **Technologies** | PostgreSQL (OLTP), any warehouse (OLAP) |
| **Competencies** | Data modeling quality, SQL proficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** A ticketing marketplace sells **reserved seats** for 20,000 events a month. Some venues have 80,000 seats. On-sale spikes reach 50,000 checkout attempts per second for one event (*scenario assumption*). A buyer **holds** seats for 8 minutes while paying. Bookings can be modified (a seat change) and cancelled, with partial refunds.

**Problem Statement.** Design the transactional model and the analytical model. Guarantee **no double-sold seat**. Preserve every historical change to a booking. Support reporting on sell-through, hold abandonment and cancellation rates.

**Sample Input / Schema.** Seed entities: `venue`, `section`, `seat`, `event`, `price_tier`, `buyer`, `hold`, `booking`, `booking_item`, `payment`, `refund`. You decide the keys, the constraints and which of these survive into the warehouse.

**Expected Output.** DDL for the OLTP core with its constraints; the hold, confirm, release and cancel flows written as transactions; a star schema with the grain of each fact stated; and SQL for (1) sell-through % by event and price tier, and (2) the hold-abandonment rate per event in the first hour of on-sale.

**Constraints.** Seat availability must be strongly consistent. Analytics may lag by up to 5 minutes. The audit trail is retained for 7 years.

**Clarification questions to consider.** General admission as well as reserved seating? Can a hold be extended? Are prices dynamic during the on-sale? Who owns a refund decision: the organiser or the platform?

**Interviewer Follow-Up Questions**
1. **Two buyers click "pay" on the last available seat in the same millisecond.** Walk through exactly what your schema and transactions do, compare at least two concurrency strategies, and say which you would choose for an 80,000-seat on-sale.
2. A buyer moves from seat A12 to B7 and later cancels one of two tickets. Show the rows that change in OLTP and in the warehouse. How does an analyst reconstruct the booking **as it stood on any past date**?

**Evaluation Criteria.** A uniqueness or locking guarantee enforced by the database, not by the application alone; holds that expire safely; a history model (immutable event rows or SCD2) with a clear grain; correct SQL against their own model; reasoning about scale for the on-sale hotspot.

---

## R3-02: Ride-hailing trip lifecycle and driver history

| | |
|---|---|
| **Question ID** | R3-02 |
| **Interview Round** | 3: Modeling & LLD |
| **Topic / Subtopic** | Ride-hailing / accumulating snapshot fact, SCD2, point-in-time joins |
| **Difficulty** | Hard |
| **Estimated Time** | 45 min |
| **Skills evaluated** | Choosing fact types, grain, SCD2 joins, metric definitions |
| **Technologies** | PostgreSQL, any warehouse |
| **Competencies** | Data modeling quality, SQL proficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** RideCo needs analytics on the trip funnel: requested → matched → driver arrived → started → completed or cancelled (by rider, driver or system). Drivers change vehicle, city and service tier over time. Pricing includes a surge multiplier. Volume is about 30M trips a day across 600 cities (*scenario assumption*).

**Problem Statement.** Model the trip lifecycle for funnel and duration analysis, the driver dimension with history, and pricing. Explain the choice between a transaction fact, a periodic snapshot and an accumulating snapshot, and choose one or a combination.

**Sample Input / Schema.** The operational source is `trip_events(trip_id, event_type, event_ts, actor, payload JSON)`, plus `drivers` and `vehicles` tables that are updated in place.

**Expected Output.** The model with the grain of every table; the SCD type and the tracked attributes for the driver; the late-data policy; and SQL for (1) weekly completion rate by city and **the driver's service tier at the time of the trip**, and (2) the median minutes from request to pickup by city and hour of day.

**Constraints.** A cancellation may arrive up to 2 hours after the trip was requested. A driver tier change may arrive up to 24 hours late.

**Clarification questions to consider.** Does "completion rate" exclude rider cancellations within 2 minutes? Which city owns a cross-city trip? Is surge a dimension attribute or a fact measure?

**Interviewer Follow-Up Questions**
1. A tier update for a driver arrives **24 hours late** and changes which tier owned yesterday's trips. Show how your SCD2 and fact tables are corrected, and what happens to dashboards that were already published.
2. **Real-time** cancellation rate per city is needed with under a minute of latency. Which part of your model serves it, and how do you keep the real-time number and the warehouse number from disagreeing?

**Evaluation Criteria.** A well-argued fact choice, usually an accumulating snapshot plus an event fact; correct SCD2 with an effective date range and a point-in-time join; precise metric definitions; a policy for late arrivals.

---

## R3-03: Food-delivery order lifecycle

| | |
|---|---|
| **Question ID** | R3-03 |
| **Interview Round** | 3: Modeling & LLD |
| **Topic / Subtopic** | Food delivery / multi-party state machine, order items, time-in-state |
| **Difficulty** | Hard |
| **Estimated Time** | 45 min |
| **Skills evaluated** | State machines, out-of-order events, handling multiple grains, bridge tables |
| **Technologies** | PostgreSQL, any warehouse, Kafka as the event source |
| **Competencies** | Data modeling quality, SQL proficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** An order involves a customer, a restaurant and one or more couriers. A large order can be split or reassigned. Items can be modified after the order is placed: substitutions, or out-of-stock removals. Status events come from three different apps with **unsynchronised clocks**, so they arrive out of order (*scenario assumption*).

**Problem Statement.** Design the operational state model and the analytical model so the business can measure prep time, courier wait, delivery time, item-level substitution rates, and refunds by cause.

**Sample Input / Schema.** Status events: `placed, accepted, prep_started, ready, courier_assigned, courier_arrived_restaurant, picked_up, delivered, cancelled, refunded`. Each event carries `order_id, status, source_app, device_ts, server_ts, courier_id?`.

**Expected Output.** A state machine of allowed transitions; the rule for building an authoritative timeline from out-of-order events; a model with an **order-level fact and an item-level fact** (or a reason for a different choice) and a courier-assignment bridge; and SQL for (1) P90 prep time per restaurant per week and (2) the time each order spent in each state.

**Constraints.** A courier reassignment must not lose the first courier's leg. Refunds can be partial and item-level.

**Clarification questions to consider.** Which clock is authoritative? Can an order go back from `ready` to `prep_started`? How do you attribute a refund that spans items and delivery fee?

**Interviewer Follow-Up Questions**
1. `picked_up` arrives **before** `courier_assigned` because of clock skew, and a duplicate `delivered` arrives 3 hours later. Show exactly what your pipeline stores and what the metrics show.
2. Finance needs revenue at **item grain** and ops needs time at **order grain**. A naive join double-counts the delivery fee. Show the double count, then the model or query that prevents it.

**Evaluation Criteria.** An explicit state machine and transition validation; ordering by server time with device time kept; grains that do not fan out; a bridge for many-to-many couriers; correct percentile SQL.

---

## R3-04: Payments, refunds and a double-entry ledger

| | |
|---|---|
| **Question ID** | R3-04 |
| **Interview Round** | 3: Modeling & LLD |
| **Topic / Subtopic** | Payments / idempotency, ledger, reconciliation, multi-currency |
| **Difficulty** | Very Hard |
| **Estimated Time** | 45 min |
| **Skills evaluated** | Financial correctness, immutability, idempotency keys, reconciliation, currency handling |
| **Technologies** | PostgreSQL, a warehouse, PSP settlement files |
| **Competencies** | Data modeling quality, SQL proficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** RideCo charges riders through two payment service providers (PSPs) in 40 currencies. It supports authorisation, capture, partial and multiple refunds, chargebacks, and driver payouts. Each PSP sends a daily settlement file. Finance must close the books each month, and auditors ask "why did this balance change?" (*scenario assumption*).

**Problem Statement.** Design the payment and refund model so that a retry **never double-charges or double-refunds**, refunds can never exceed the captured amount, and every balance can be explained from immutable entries. Include the analytical layer and reconciliation against PSP files.

**Sample Input / Schema.** Seed entities: `payment_intent`, `payment_attempt`, `capture`, `refund`, `chargeback`, `ledger_account`, `ledger_entry`, `psp_settlement_line`, `fx_rate`.

**Expected Output.** DDL with idempotency constraints; the flow for one refund request that is retried three times; the ledger postings (debits and credits) for a charge, a partial refund and a chargeback; and SQL for (1) daily net revenue by currency and in USD, and (2) a reconciliation report of internal captures against PSP settlement lines, with mismatch categories.

**Constraints.** Amounts are integer minor units. The ledger is append-only. Corrections are compensating entries, never updates.

**Clarification questions to consider.** Which FX rate applies: transaction time, settlement time, or month-end? Who is the source of truth for refund success: us or the PSP webhook? What are the rules for currencies with no minor unit, or three decimal places?

**Interviewer Follow-Up Questions**
1. Two refund requests for the same capture race, each for 60% of the amount. Show how the schema and transaction **guarantee** that at most 100% is refunded, and what each caller sees.
2. The PSP file shows a capture you never recorded, and you show a refund the PSP never settled. Define the reconciliation states, the time windows, and who is alerted. How do month-end close and late settlement interact?

**Evaluation Criteria.** Append-only double entry that balances to zero; idempotency keys as unique constraints; refund caps enforced under concurrency; integer minor units; FX as data, not code; reconciliation with explicit categories.

---

## R3-05: Subscriptions, cancellations and the MRR bridge

| | |
|---|---|
| **Question ID** | R3-05 |
| **Interview Round** | 3: Modeling & LLD |
| **Topic / Subtopic** | Subscriptions / plan changes, proration, churn and reactivation, MRR movements |
| **Difficulty** | Hard |
| **Estimated Time** | 40 min |
| **Skills evaluated** | Temporal modeling, densification, metric taxonomy, real-time against batch |
| **Technologies** | PostgreSQL, any warehouse, a streaming source for real time |
| **Competencies** | Data modeling quality, SQL proficiency, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** RideCo Pass is a monthly subscription with three plans. Customers upgrade and downgrade mid-cycle with proration, pause, cancel at period end or immediately, and reactivate. Leadership reviews an **MRR bridge** every month: opening → new, reactivation, expansion, contraction, churn → closing.

**Problem Statement.** Model subscriptions so the business can compute the MRR bridge, churn and reactivation, and a **real-time cancellation rate**. Then write the bridge query against the snapshot fact below, which is one valid output of your model.

**Sample Input / Schema**

```sql
CREATE TABLE fact_subscription_month (   -- grain: one row per account per month with MRR > 0
  account_id  BIGINT        NOT NULL,
  month       DATE          NOT NULL,    -- first day of the month
  mrr         NUMERIC(12,2) NOT NULL CHECK (mrr > 0),
  PRIMARY KEY (account_id, month)
);
-- account: Jul, Aug, Sep 2026
-- 1: 100, 100, 150      2: 50, 50, —       3: —, 80, 60
-- 4: 40, —, 40          5: —, —, 200       6: 30, 30, 30
```

Definitions: **new** means MRR > 0 for the first time ever. **Reactivation** means MRR > 0 after at least one earlier active month and a previous month at 0. **Expansion** and **contraction** are changes between two active months. **Churn** means active last month and 0 this month (shown as a negative number).

**Expected Output**

```
   month    | opening_mrr | new_mrr | reactivation_mrr | expansion_mrr | contraction_mrr | churned_mrr | closing_mrr
------------+-------------+---------+------------------+---------------+-----------------+-------------+-------------
 2026-07-01 |           0 |  220.00 |                0 |             0 |               0 |           0 |      220.00
 2026-08-01 |      220.00 |   80.00 |                0 |             0 |               0 |      -40.00 |      260.00
 2026-09-01 |      260.00 |  200.00 |            40.00 |         50.00 |          -20.00 |      -50.00 |      480.00
```

Check: opening + new + reactivation + expansion + contraction + churned = closing.

**Constraints.** Valid PostgreSQL 16. Months with no row for an account mean MRR = 0, and **your query must make those zeros exist**.

**Clarification questions to consider.** Is a paused subscription churned? Is "cancel at period end" churn in the month of the request or the month it takes effect? How are annual plans normalised to MRR?

**Interviewer Follow-Up Questions**
1. Model the **source** of this snapshot: subscription periods, plan changes with proration, pauses and cancellations. Show how a mid-month upgrade from plan B to plan C appears in your tables, and where the snapshot's month-end MRR comes from.
2. Leadership wants the **cancellation rate in real time** (rolling 24 hours, per country). Define the numerator and denominator precisely, and design how it is computed from the event stream so that it reconciles with the monthly batch number.

**Evaluation Criteria.** Densifies the grid (a missing month is a zero); classification is mutually exclusive and exhaustive; the bridge balances; the source model handles proration and effective dating; real-time metric definitions are precise.

---

# ROUND 4: Distributed Systems & High-Level Design

Every question in this round expects: **(A)** ingestion: event schema, topics, partition keys, producer reliability, ordering; **(B)** stream processing: engine choice, event time against processing time, windows, watermarks, late data, state, exactly-once and its limits; **(C)** storage and serving; **(D)** reliability and scale: skew, failures, backpressure, checkpointing, replay, multi-region; **(E)** explicit trade-offs among latency, consistency, throughput, cost, availability and operational complexity. **No single architecture is "the" answer.** You are scored on whether your choices are defensible.

## R4-01: Global video streaming analytics platform (primary scenario)

| | |
|---|---|
| **Question ID** | R4-01 |
| **Interview Round** | 4: Distributed Systems & HLD |
| **Topic / Subtopic** | Real-time analytics / streaming architecture, windows, OLAP serving |
| **Difficulty** | Very Hard |
| **Estimated Time** | 60 min |
| **Skills evaluated** | End-to-end design, windowing and watermark semantics, distinct counting at scale, hot keys, multi-region, adapting under changing conditions |
| **Technologies** | Kafka (or Kinesis/Pub/Sub), Flink or Spark Structured Streaming, object storage plus Iceberg/Delta, a real-time OLAP store (Pinot, Druid or ClickHouse), Redis, a warehouse |
| **Competencies** | Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** StreamCo has 40M peak concurrent viewers across 6 regions. Players send a heartbeat every 10 s and events for play, pause, seek, buffer start and end, error, and stop (*scenario assumption*). Leadership wants live dashboards and an API that powers a "Trending now" row in the app.

**Problem Statement.** Design an architecture that tracks:
1. The **top 10 trending titles** over a rolling one-hour window, globally and per region.
2. Titles with the **highest abandonment rate**. You define abandonment.
3. **Concurrent active viewers**, globally, per region and per title.
4. **Regional popularity**.
5. **Real-time playback failures**: rate and spikes by title, CDN, device and ISP.

**Sample Input / Schema.** A starting event, which you should improve:

```json
{"event_id":"uuid","session_id":"uuid","user_id":"hash","title_id":"t_8812","event_type":"heartbeat",
 "position_s":1530,"device":"tv_os","region":"eu-west","cdn":"cdn-b","client_ts":"...","bitrate_kbps":5800}
```

**Expected Output.** An architecture diagram described in words or drawn; the topic and partition-key design; window and watermark definitions for each metric; state size estimates; the storage and serving tiers with freshness SLOs; and a trade-off table.

**Constraints** *(scenario assumptions)*. Trending freshness ≤ 30 s. Failure alerts ≤ 60 s. Concurrency error ≤ 1%. Dashboards p95 under 500 ms. The budget matters.

**Clarification questions to consider.** Does "trending" mean the most watched, or the fastest-growing? Is it weighted by watch time? Does a user count once per title? Is the "Trending now" row personalised? Must per-region results stay in their region for data residency?

**Live challenges.** The interviewer injects these one at a time; adapt your design for each.
1. Traffic rises **10×** during a major sports final.
2. Processing latency rises from **2 s to 2 minutes**.
3. A **regional processing cluster fails**.
4. One popular title creates a **hot partition**.
5. **Late events change** a Top 10 that has already been published.

**Interviewer Follow-Up Questions**
1. Your top-10 uses a sliding 1-hour window with a 1-minute slide. Compute the state that implies at your scale, then propose a cheaper design that gives the same answer within a stated tolerance.
2. Concurrent viewers must be exact for the live sports final, because it is contractually reported to a rights holder, but approximate everywhere else. How does that one requirement change your architecture?

**Evaluation Criteria.** Event-time correctness with an explicit lateness policy; an aggregation that is aware of hot keys; heartbeat-based concurrency with session timeouts; an honest account of the limits of exactly-once; a serving tier that matches each query; costed trade-offs; adapts sensibly to each challenge.

---

## R4-02: Real-time marketplace supply and demand features for surge pricing

| | |
|---|---|
| **Question ID** | R4-02 |
| **Interview Round** | 4: Distributed Systems & HLD |
| **Topic / Subtopic** | Streaming feature pipelines / geospatial aggregation, online-offline consistency |
| **Difficulty** | Very Hard |
| **Estimated Time** | 50 min |
| **Skills evaluated** | Geo partitioning, freshness SLOs, training-serving skew, feature store design, degradation strategy |
| **Technologies** | Kafka, Flink or Spark, H3 or S2 indexing, a key-value store (Redis or Cassandra), lakehouse, a feature store |
| **Competencies** | Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** A pricing model sets a surge multiplier for each hexagonal cell every 30 s. It needs features per hex: open requests, available drivers, ETA percentiles and a 5-minute demand trend. There are 5M driver location pings every 4 s at peak, and 200k requests a minute (*scenario assumption*).

**Problem Statement.** Design the pipeline that computes these features, serves them to the pricing service, and produces **the same features offline** for model training.

**Sample Input / Schema.** `driver_ping(driver_id, lat, lng, status, ts)`, `ride_request(request_id, rider_id, lat, lng, product, ts)`, `eta_estimate(request_id, eta_s, ts)`.

**Expected Output.** The data flow; how hexes and partitions are assigned; window definitions; the online store's schema and TTLs; how features are logged for training; and what the pricing service does when features are stale.

**Constraints.** Feature freshness p99 under 5 s. Pricing must **never** use a feature older than 60 s; it falls back instead.

**Clarification questions to consider.** Which hex resolution, and is it the same in dense and sparse areas? How should a driver near a cell boundary be counted? Is the model per-city or global?

**Interviewer Follow-Up Questions**
1. A stadium empties and **one hex** receives 30× normal requests. Partitioning by hex now gives one hot task. Fix it without making the feature wrong.
2. Model accuracy offline is much better than online. Diagnose likely sources of **training-serving skew** in your design and show how point-in-time-correct feature logging fixes them.

**Evaluation Criteria.** Sensible geo partitioning and handling of hot cells; event time with bounded lateness; the online store matches the access pattern; one feature definition shared by online and offline; explicit staleness behaviour.

---

## R4-03: Courier location tracking and geofence events at scale

| | |
|---|---|
| **Question ID** | R4-03 |
| **Interview Round** | 4: Distributed Systems & HLD |
| **Topic / Subtopic** | Logistics / high-write telemetry, latest-state serving, stateful CEP, storage tiering |
| **Difficulty** | Hard |
| **Estimated Time** | 45 min |
| **Skills evaluated** | Write amplification, latest-value stores, stateful detection, retention and cost |
| **Technologies** | Kafka, Flink (or a similar stateful engine), Redis or another key-value store, object storage plus Iceberg/Delta, a geospatial index |
| **Competencies** | Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication |

**Business Scenario.** A delivery network has 2M active couriers, each sending GPS every 4 s (*scenario assumption*). Customers see the live courier on a map. Ops needs geofence events such as "arrived at restaurant" and "left the delivery zone". Data science wants a year of raw traces for ETA modelling.

**Problem Statement.** Design ingestion, latest-location serving, geofence detection with debouncing for noisy GPS, and historical storage. Estimate the throughput and storage, and design for cost.

**Sample Input / Schema.** `ping(courier_id, lat, lng, accuracy_m, speed_mps, heading, device_ts, seq_no)`.

**Expected Output.** Throughput and storage arithmetic; the topic and key design; the latest-state store with its update and read paths; the state machine for geofence entry and exit; the raw-trace layout (partitioning, file sizes, retention tiers).

**Constraints.** The map update reaches the customer within 2 s. A false "arrived" event costs real money because it triggers restaurant handoff timers.

**Clarification questions to consider.** How many customers watch each courier? How dense are geofences? Is per-courier ordering guaranteed? Should GPS accuracy filter pings?

**Interviewer Follow-Up Questions**
1. Pings arrive out of order and in bursts after a courier leaves a tunnel. How does your geofence detector avoid emitting arrived → left → arrived flapping?
2. Storage for raw traces grows to 1 PB a year. Cut the cost by 70% without hurting the ETA team. Consider downsampling, compression, partitioning, tiering, and what you must keep raw.

**Evaluation Criteria.** Correct order-of-magnitude arithmetic; keyed by courier for ordering; a last-write-wins latest store using a sequence number or timestamp; debounced, hysteresis-based geofencing; a tiered, cost-aware history.

---

## R4-04: Petabyte event lake with right-to-be-forgotten deletion

| | |
|---|---|
| **Question ID** | R4-04 |
| **Interview Round** | 4: Distributed Systems & HLD |
| **Topic / Subtopic** | Lakehouse at scale / deletes, compaction, time travel, backfill, governance |
| **Difficulty** | Very Hard |
| **Estimated Time** | 50 min |
| **Skills evaluated** | Table-format internals, cost of deletes, layout design, compliance as an engineering requirement |
| **Technologies** | Iceberg, Delta or Hudi; Spark or Trino; object storage; a catalog; Kafka |
| **Competencies** | Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication, Data modeling quality |

**Business Scenario.** The company's event lake holds 4 PB across 3,000 tables. 9,000 erasure requests arrive each month, and each must be completed within 30 days across **every** table, its copies and its derivatives (*the 30-day window is a scenario assumption; check the actual legal obligation in each jurisdiction*). Today each request is handled with a manual SQL `DELETE`, which rewrites terabytes.

**Problem Statement.** Design a system that discovers where a user's data lives, deletes or anonymises it on time, proves it was done, and keeps cost under control. Consider snapshots and time travel, backups, streaming topics, and downstream aggregates.

**Sample Input / Schema.** `erasure_request(request_id, user_id, received_at, scope)`. Tables vary: some have `user_id`, some have only `device_id` or `email_hash`, some carry user data nested in JSON.

**Expected Output.** A lineage or PII-tagging approach for discovery; a batched deletion strategy; the choice between copy-on-write and merge-on-read deletes; snapshot expiry; an approach for Kafka topics (retention against compacted tombstones, or crypto-shredding); the evidence of completion; the cost model.

**Constraints.** No more than 10% added to monthly lake compute. Analytics queries must not slow down by more than 15%.

**Clarification questions to consider.** Is anonymisation acceptable, or must the rows be deleted? Do aggregates that cannot be re-identified need recomputation? What about data in backups and in the logs of external vendors?

**Interviewer Follow-Up Questions**
1. Compare **crypto-shredding** (per-user encryption keys) with physical deletes. Where does each fail, and what does each cost at 4 PB?
2. A backfill of a two-year table is running when a deletion batch commits. What happens to correctness and to the commit, and how do you prevent a deleted user from reappearing?

**Evaluation Criteria.** Discovery through tagging and lineage, not hope; batched deletes aligned with the table layout; awareness that snapshot expiry is part of a delete; streams and backups covered; verifiable evidence; deletes costed against query performance.

---

## R4-05: Experimentation metrics platform

| | |
|---|---|
| **Question ID** | R4-05 |
| **Interview Round** | 4: Distributed Systems & HLD |
| **Topic / Subtopic** | Batch and streaming analytics / exposure joins, metric definitions, recomputation |
| **Difficulty** | Very Hard |
| **Estimated Time** | 50 min |
| **Skills evaluated** | Large joins, metric semantics, incremental against full recompute, statistical data requirements, governance |
| **Technologies** | Spark or Trino, Iceberg/Delta, a warehouse, Kafka, an orchestrator |
| **Competencies** | Distributed-system reasoning, Reliability and scalability, Trade-off analysis, Communication, Data modeling quality |

**Business Scenario.** 1,000 experiments run at the same time. There are 2B events and 300M exposure records a day (*scenario assumption*). Each experiment uses 20–50 metrics, including ratio metrics such as trips per active rider and revenue per session, plus variance-reduction covariates. Scientists need daily results with confidence intervals, and an early-warning guardrail for crashes and payment failures within 1 hour.

**Problem Statement.** Design the platform that computes per-experiment, per-variant metrics and the inputs to variance estimation. It must handle late data and metric-definition changes, and stay explainable.

**Sample Input / Schema.** `exposure(user_id, experiment_id, variant, first_exposed_at)`, `events(user_id, event_type, ts, value)`, `metric_definition(metric_id, numerator_sql, denominator_sql, window, version)`.

**Expected Output.** The computation graph (exposure dedup → user-level aggregates → variant-level sufficient statistics); the storage layout; the incremental strategy; how metric versions are handled; the guardrail stream path.

**Constraints.** Results must be reproducible for a stated `(metric_version, data_snapshot)`. Changing a metric definition must not silently rewrite the history of finished experiments.

**Clarification questions to consider.** Is the analysis unit the user, the session or the city? What about users exposed to several variants? How long is the attribution window after exposure?

**Interviewer Follow-Up Questions**
1. Computing user × experiment × metric every day is the expensive step. Show which sufficient statistics (n, Σx, Σx², Σy, Σxy, …) you store so a ratio metric's variance can be computed **without** going back to raw data.
2. Ten experiments target one huge city and one power user generates 10⁶ events a day. What does that do to your joins, and what does it do to your statistics?

**Evaluation Criteria.** A layered, cache-friendly computation; correct exposure semantics; storing sufficient statistics; definitions that are versioned and reproducible; a separate fast path for guardrails; awareness of skew and outliers.

---

# ROUND 5: Leadership & Architectural Deep Dive

**How to answer.** For experience questions, use **STAR** (Situation, Task, Action, Result) with measurable evidence. **Use a real experience, or say plainly that you have not faced this and reason through it.** Do not invent one: interviewers probe, and an honest "I haven't, but here is how I would approach it" scores better than a story that collapses under follow-up. Every question can be answered either way.

Standard probes for every question in this round: *What alternatives did you consider? Which metrics supported the decision? What failed? What did **you** personally contribute? What would you do differently? What was the business impact?*

## R5-01: When the better architecture is the wrong decision

| | |
|---|---|
| **Question ID** | R5-01 |
| **Interview Round** | 5: Leadership |
| **Topic / Subtopic** | Architecture trade-offs / business alignment |
| **Difficulty** | Hard |
| **Estimated Time** | 25 min |
| **Skills evaluated** | Judgement, quantifying trade-offs, influencing, reversibility |
| **Technologies** | Any |
| **Competencies** | Technical leadership, Trade-off analysis, Communication |

**Business Scenario (case).** Your team proposes moving the driver-incentives pipeline from nightly Spark batch to Flink streaming with Iceberg. It would be "more modern" and fresher. Today incentives are paid weekly, and the business has asked for nothing faster. The migration is estimated at 2 engineers for 2 quarters and +$180k a year in run cost (*scenario assumption*).

**Problem Statement.** (a) Tell me about a time when a technically superior architecture was **not** the right business decision (STAR), or reason through it if you have not. (b) For the case above, what do you recommend, and what would change your mind?

**Expected Output.** A decision with explicit criteria (value, cost, risk, reversibility, team capacity, opportunity cost), the evidence you would gather, and how you would communicate a "no" or a "not now".

**Constraints.** Do not invent experience (see the round note).

**Clarification questions to consider.** Is a real-time incentive product on the roadmap? What does the current pipeline's incident history look like?

**Interviewer Follow-Up Questions**
1. The staff engineer who proposed it is your strongest engineer and will be demotivated by a "no". How do you handle that?
2. Six months later, product **does** ask for real-time incentives. Was your earlier call wrong? What did you do to keep the option cheap?

**Evaluation Criteria.** Trade-offs framed in business terms, quantified; reversible decisions separated from irreversible ones; respect for people as well as architecture; honest about uncertainty.

---

## R5-02: Cutting a $2M-a-year data platform bill

| | |
|---|---|
| **Question ID** | R5-02 |
| **Interview Round** | 5: Leadership |
| **Topic / Subtopic** | Cost optimization / FinOps for data platforms |
| **Difficulty** | Hard |
| **Estimated Time** | 30 min |
| **Skills evaluated** | Attributing cost, prioritising, protecting SLOs, building incentives |
| **Technologies** | Cloud warehouse, Spark, object storage, Kafka |
| **Competencies** | Technical leadership, Trade-off analysis, Reliability and scalability, Communication |

**Business Scenario (case).** The platform costs **$2.0M a year** *(scenario assumption)*: warehouse compute $760k, Spark clusters $520k, object storage $300k, streaming (Kafka and Flink) $240k, data egress $110k, other $70k. The CFO asks for 25% less with no SLO regressions.

**Problem Statement.** How do you investigate, choose and deliver the savings, and keep them from coming back? STAR for a related experience, if you have one.

**Expected Output.** An investigation plan (attribution, top-N spenders, unit costs); a ranked list of candidate optimisations with estimated savings, effort and risk; SLO guardrails; a governance mechanism.

**Constraints.** No SLO regressions. Changes must be reversible, or staged so they can be stopped.

**Clarification questions to consider.** Is there a commitment or reserved capacity in place? Which workloads carry SLOs, and which are best-effort? Who consumes the data that leaves the platform as egress?

**Interviewer Follow-Up Questions**
1. The single biggest cost is a dashboard refreshed every 5 minutes that, according to the logs, is viewed **twice a day**. The owner is a VP. What do you do?
2. Six months after a 30% cut, costs are back at 95% of the original. Why does this happen, and what would you have built to prevent it?

**Evaluation Criteria.** Measures before cutting; reasons in unit economics; a balanced portfolio of quick wins and structural fixes; SLO protection; durable governance through tags, budgets and showback.

---

## R5-03: A legacy pipeline that is unreliable and business-critical

| | |
|---|---|
| **Question ID** | R5-03 |
| **Interview Round** | 5: Leadership |
| **Topic / Subtopic** | Technical debt / modernization strategy |
| **Difficulty** | Hard |
| **Estimated Time** | 25 min |
| **Skills evaluated** | Risk-based prioritisation, incremental migration, verification, stakeholder management |
| **Technologies** | Any (the case uses cron, shell, Hive and a warehouse) |
| **Competencies** | Technical leadership, Trade-off analysis, Reliability and scalability, Communication |

**Business Scenario (case).** A seven-year-old chain of 140 cron jobs, shell scripts and Hive SQL produces the monthly **driver tax summaries**. It fails about twice a month and needs a "hero" to restart steps by hand. The two engineers who understood it have left. Tax season is 4 months away (*scenario assumption*).

**Problem Statement.** How do you prioritise and carry out the modernization without missing tax season? STAR for a related experience, if you have one.

**Expected Output.** A stabilise → observe → strangle → verify plan; how to choose the order; a parallel-run and reconciliation design; criteria for cutover and rollback.

**Constraints.** No missed or incorrect tax documents.

**Clarification questions to consider.** Are there regulatory audit requirements on lineage? Which outputs are legally binding? Is any part of the logic undocumented business rules?

**Interviewer Follow-Up Questions**
1. The parallel run shows a 0.3% difference in 1,200 drivers' totals, and the old system cannot be proven correct. Which one is right, and how do you decide?
2. Leadership asks you to pause the migration for a higher-priority launch. How do you argue, and what is the minimum you keep doing?

**Evaluation Criteria.** Stabilises before rewriting; incremental migration with verification; a reconciliation-driven cutover; clear risk communication; protects the deadline.

---

## R5-04: Wrong financial metrics in production: the response plan

| | |
|---|---|
| **Question ID** | R5-04 |
| **Interview Round** | 5: Leadership |
| **Topic / Subtopic** | Incident management / data incidents |
| **Difficulty** | Very Hard |
| **Estimated Time** | 30 min |
| **Skills evaluated** | Triage, containment, communication, root cause, prevention, accountability |
| **Technologies** | Any |
| **Competencies** | Technical leadership, Trade-off analysis, Reliability and scalability, Communication |

**Business Scenario (case).** On Monday you learn that the "net driver payouts" metric has been **4% too high for 6 days**. A deploy changed a join. The number has already gone into a weekly finance report to executives, and into payout-forecasting jobs (*scenario assumption*).

**Problem Statement.** Walk through the first hour, the first day and the first two weeks. STAR for a real data incident you handled, if you have one.

**Expected Output.** Severity and roles; containment (stop the bleeding, flag the data, freeze consumers); scoping the blast radius through lineage; communication (who, when, what); the fix and backfill; validation; a blameless postmortem with prevention guardrails.

**Constraints.** Actual payouts to drivers were computed by a different system and are correct. You must confirm that, not assume it.

**Clarification questions to consider.** Which consumers took action on the number? Are there regulatory reporting implications? Is the deploy revertible?

**Interviewer Follow-Up Questions**
1. The engineer who made the change is junior and very upset. Finance wants a name. What do you do?
2. Which **two guardrails** would have caught this before it reached finance? Be specific about checks, thresholds, where they run, and who owns them.

**Evaluation Criteria.** Contains first and diagnoses second; verifies before asserting; reaches downstream consumers with lineage; communicates proactively; a blameless culture with real accountability; concrete prevention.

---

## R5-05: Data engineering vs product vs platform architecture

| | |
|---|---|
| **Question ID** | R5-05 |
| **Interview Round** | 5: Leadership |
| **Topic / Subtopic** | Leadership and conflict / delivery timelines, complexity, reliability |
| **Difficulty** | Hard |
| **Estimated Time** | 30 min |
| **Skills evaluated** | Facilitation, making disagreement concrete, decision records, delivery under constraints |
| **Technologies** | Any |
| **Competencies** | Technical leadership, Trade-off analysis, Communication |

**Business Scenario (case).** A launch needs a new "rider lifetime value" feature in 6 weeks. The **PM** wants it in 6 weeks, at any cost. The **platform architect** insists that it be built on the new streaming feature platform, which is not GA for 10 weeks. Your **data engineers** say the only safe 6-week path is a batch job with a known 24-hour staleness, and they worry about on-call load (*scenario assumption*).

**Problem Statement.** How do you get the three groups to a decision, and what do you deliver? STAR for a real cross-functional conflict you navigated, if you have one.

**Expected Output.** How you surface each party's real constraint; the options with their costs and risks; a decision framework and owner; the decision record; a delivery plan with checkpoints; what you do if you are overruled.

**Constraints.** Nobody may be "steamrolled". The decision must be documented with its reversibility.

**Clarification questions to consider.** Does the launch truly need sub-day freshness? What is the cost of slipping 4 weeks? Who is the final decision-maker?

**Interviewer Follow-Up Questions**
1. You chose the batch interim path. Eight weeks later the platform is late again, and the "interim" job is now critical. What now?
2. The architect escalates over your head. How do you respond, and what does that say about how the decision was made?

**Evaluation Criteria.** Real constraints separated from stated positions; options backed by data; clear decision rights; a written record; protects reliability and on-call health; disagrees and commits without resentment.

---

# SCORING

Each applicable competency is scored **0–4**; competencies that do not apply are **N/A**, never 0.

| Score | Meaning |
|---|---|
| 0 | No meaningful solution |
| 1 | Major conceptual gaps |
| 2 | Partially correct, significant weaknesses |
| 3 | Correct and well-reasoned |
| 4 | Strong, optimized, production-aware answer |

Competencies: correctness · code quality · algorithmic efficiency · SQL proficiency · data modeling quality · distributed-system reasoning · reliability and scalability · trade-off analysis · communication · technical leadership.

**One missed algorithm question never fails a candidate on its own.** The final assessment weighs evidence across rounds and states the impact of each weakness. After you submit, the report covers: round-by-round performance, strengths and weaknesses, incorrect or incomplete solutions, topics to revisit, three targeted follow-up practice questions, and specific recommendations.
