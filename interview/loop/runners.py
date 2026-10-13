"""Run-and-check specs for the Five-Round Loop's executable questions.

The page runs a candidate's code in the browser (Python in Pyodide, SQL in
PGlite) and compares the result with the reference solution's result. This file
says WHAT is run; `verify/compute_expected.py` runs the reference solutions and
records their results in `expected.json`; `build.py` ships both to the page.
Never type an expected value here: change a test, then re-run compute_expected.

What ships to the browser: the setup SQL, the Python harness prelude, each
test's expression, and the RESULTS. What never ships: the reference SQL and the
reference Python (they live in evaluator.md and verify/).
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
VERIFY = HERE / "verify"


def setup_of(sql_file: str) -> str:
    text = (VERIFY / sql_file).read_text(encoding="utf-8")
    return text.split("-- @setup-end")[0].strip() + "\n"


def query_after_setup(sql_file: str, nth: int = 0) -> str:
    """The nth query after the setup marker (psql meta lines and EXPLAINs skipped)."""
    text = (VERIFY / sql_file).read_text(encoding="utf-8").split("-- @setup-end")[1]
    text = "\n".join(line for line in text.splitlines() if not line.startswith("\\"))
    chunks = [c.strip() for c in text.split(";\n") if c.strip() and not c.strip().startswith("EXPLAIN")]
    return chunks[nth]


# Helpers available to every Python test (shipped to the browser, so keep them
# free of any solution logic). The LCG keeps generated inputs identical in
# CPython and Pyodide.
PY_PRELUDE = '''
def _lcg_list(n, lo, hi, seed):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append(lo + (x >> 16) % (hi - lo + 1))
    return out

def _fw_run(w, events):
    fw = FareWindow(w)
    return [fw.add(*e) for e in events]

def _fw_digest(w, n, seed):
    ts_steps = _lcg_list(n, 0, 3, seed)
    riders = _lcg_list(n, 1, 500, seed + 1)
    fares = _lcg_list(n, 0, 20000, seed + 2)
    fw, ts, s_max, s_dist, last = FareWindow(w), 0, 0, 0, None
    for i in range(n):
        ts += ts_steps[i]
        last = fw.add(ts, "r%d" % riders[i], fares[i])
        s_max += last[0]
        s_dist += last[2]
    return (s_max, s_dist, last)
'''.strip() + "\n"

PY_FARE_SAMPLE = "[(0,'r1',1200),(10,'r2',900),(30,'r1',1500),(65,'r3',700),(70,'r2',800),(70,'r1',600),(130,'r3',1000)]"

RUNNERS = {
    "R1-01": {
        "lang": "python",
        "starter": "from collections import deque, Counter\n\nclass FareWindow:\n    def __init__(self, window_seconds: int) -> None:\n        ...\n\n    def add(self, ts: int, rider_id: str, fare_cents: int) -> tuple[int, float, int]:\n        ...\n",
        "tests": [
            {"name": "sample (W = 60)", "expr": f"_fw_run(60, {PY_FARE_SAMPLE})"},
            {"name": "same timestamp, W = 1", "expr": "_fw_run(1, [(5,'a',10),(5,'b',30),(5,'a',20),(6,'c',5)])"},
            {"name": "all fares equal", "expr": "_fw_run(10, [(0,'a',7),(3,'a',7),(9,'b',7),(10,'c',7),(19,'c',7)])"},
            {"name": "window_seconds = 0 raises ValueError", "expr": "FareWindow(0)", "raises": "ValueError"},
            {"name": "timestamp going backwards raises ValueError", "expr": "_fw_run(60, [(10,'a',1),(9,'b',1)])", "raises": "ValueError"},
            {"name": "200,000 events, ~2,000 in each window, in time (amortised O(1))", "expr": "_fw_digest(3000, 200000, 17)", "limit_s": 8},
        ],
    },
    "R1-02": {
        "lang": "python",
        "starter": "from collections import deque\n\ndef shortest_burst(amounts: list[int], threshold: int) -> tuple[int, int] | None:\n    ...\n",
        "tests": [
            {"name": "sample 1", "expr": "shortest_burst([200, -150, 300, -50, 400, 100], 450)"},
            {"name": "sample 2", "expr": "shortest_burst([100, -300, 250, 250], 500)"},
            {"name": "sample 3", "expr": "shortest_burst([300, -100, 300, 400], 600)"},
            {"name": "one element reaches it", "expr": "shortest_burst([500], 500)"},
            {"name": "never reached", "expr": "shortest_burst([50, 60], 200)"},
            {"name": "empty input", "expr": "shortest_burst([], 10)"},
            {"name": "refund breaks two pointers", "expr": "shortest_burst([5, -10, 8], 8)"},
            {"name": "tie goes to the earliest start", "expr": "shortest_burst([3, 3, -10, 3, 3], 6)"},
            {"name": "threshold 0 raises ValueError", "expr": "shortest_burst([1], 0)", "raises": "ValueError"},
            {"name": "200,000 entries, shortest run ~10,000 long, in time (O(n))", "expr": "shortest_burst(_lcg_list(200000, -990, 1010, 42), 200000)", "limit_s": 8},
        ],
    },
    "R2-01": {
        "lang": "python",
        "starter": "from functools import lru_cache\n\ndef first_player_wins(seats: list[int], capacity: int) -> bool:\n    ...\n",
        "tests": [
            {"name": "[1, 2, 3], capacity 4", "expr": "first_player_wins([1, 2, 3], 4)"},
            {"name": "[2, 2, 3], capacity 6", "expr": "first_player_wins([2, 2, 3], 6)"},
            {"name": "[1, 2, 3, 4], capacity 6", "expr": "first_player_wins([1, 2, 3, 4], 6)"},
            {"name": "[4, 4, 4, 4], capacity 15", "expr": "first_player_wins([4, 4, 4, 4], 15)"},
            {"name": "no legal first move", "expr": "first_player_wins([5], 4)"},
            {"name": "[1, 1, 2, 3, 5], capacity 7", "expr": "first_player_wins([1, 1, 2, 3, 5], 7)"},
            {"name": "no requests at all", "expr": "first_player_wins([], 10)"},
            {"name": "n = 20 in time (memoised)", "expr": "first_player_wins(_lcg_list(20, 1, 12, 5), 90)", "limit_s": 20},
        ],
    },
    "R2-02": {
        "lang": "python",
        "starter": "def plan_compaction(sizes: list[int], max_size: int, file_overhead: int) -> tuple[int, list[tuple[int, int]]]:\n    ...\n",
        # Several plans can tie, so the checks compare the cost and validate the plan.
        "prelude_extra": '''
def _plan_ok(sizes, max_size, overhead, result):
    cost, plan = result
    want = 0
    nxt = 0
    for a, b in plan:
        if a != nxt or b < a:
            return ("plan does not cover the inputs in order", plan)
        grp = sizes[a:b + 1]
        if any(s > max_size for s in grp):
            if len(grp) > 1:
                return ("an oversized input was merged", (a, b))
            want += overhead
        elif sum(grp) > max_size:
            return ("a group exceeds max_size", (a, b))
        else:
            want += overhead + (max_size - sum(grp)) ** 2
        nxt = b + 1
    if nxt != len(sizes):
        return ("plan does not cover every input", plan)
    if want != cost:
        return ("returned cost does not match the plan's cost", (cost, want))
    return cost
'''.strip() + "\n",
        "tests": [
            {"name": "sample 1", "expr": "_plan_ok([300, 200, 600, 100, 900, 50, 1500, 400], 1024, 10000, plan_compaction([300, 200, 600, 100, 900, 50, 1500, 400], 1024, 10000))"},
            {"name": "sample 2", "expr": "_plan_ok([100] * 5, 512, 0, plan_compaction([100] * 5, 512, 0))"},
            {"name": "oversized input alone", "expr": "_plan_ok([2000], 1024, 7, plan_compaction([2000], 1024, 7))"},
            {"name": "oversized in the middle", "expr": "_plan_ok([500, 2000, 500], 1024, 1, plan_compaction([500, 2000, 500], 1024, 1))"},
            {"name": "3,000 hourly files in time", "expr": "_plan_ok(_lcg_list(3000, 1, 400, 9), 1024, 5000, plan_compaction(_lcg_list(3000, 1, 400, 9), 1024, 5000))", "limit_s": 20},
        ],
    },
    "R1-03": {
        "lang": "sql",
        "setup": setup_of("r1q3.sql"),
        "starter": "-- trips(trip_id, driver_id, status, requested_at, completed_at, driver_earnings)\nSELECT driver_id, trip_id, completed_at, driver_earnings\nFROM trips\nWHERE status = 'completed'\nORDER BY driver_id, completed_at, trip_id;\n",
        "expect": [{"label": "maximal streaks", "sql": query_after_setup("r1q3.sql")}],
        "diagnostics": [
            {"message": "These are overlapping windows of three, not maximal runs: a four-trip streak (105 → 108) is reported twice. Group each run once (a running sum of 'starts a run' flags).",
             "sql": """SELECT driver_id, LAG(trip_id, 2) OVER w AS first_trip_id, trip_id AS last_trip_id, 3 AS trips_in_run,
       driver_earnings - LAG(driver_earnings, 2) OVER w AS earnings_gain
FROM trips WHERE status = 'completed'
WINDOW w AS (PARTITION BY driver_id ORDER BY completed_at, trip_id)
ORDER BY driver_id, first_trip_id"""},
        ],
    },
    "R1-04": {
        "lang": "sql",
        "setup": setup_of("r1q4.sql"),
        "starter": "-- app_events(event_id, rider_id, event_type, event_ts, ingested_at)\nSELECT *\nFROM app_events\nORDER BY rider_id, event_ts;\n",
        "expect": [
            {"label": "Part A (sessions)", "sql": "SELECT * FROM sessions ORDER BY rider_id, session_no"},
            {"label": "Part B (daily conversion)", "sql": query_after_setup("r1q4.sql", 2)},
        ],
        "reference_view": query_after_setup("r1q4.sql", 0),
        "diagnostics": [
            {"message": "Duplicates were not removed: rider 7's first session and rider 9's session each count a retried event twice. Deduplicate by event_id before sessionizing.",
             "sql": """WITH f AS (SELECT *, CASE WHEN event_ts - LAG(event_ts) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id) <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS ns FROM app_events),
n AS (SELECT *, SUM(ns) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id ROWS UNBOUNDED PRECEDING) AS sno FROM f)
SELECT rider_id, sno, MIN(event_ts), MAX(event_ts), COUNT(*), BOOL_OR(event_type = 'trip_requested') FROM n GROUP BY 1, 2 ORDER BY 1, 2"""},
            {"message": "You kept the FIRST copy of each event. The rule is the latest ingested_at: e8's corrected timestamp (12:20) keeps rider 9 in one session.",
             "sql": """WITH d AS (SELECT DISTINCT ON (event_id) * FROM app_events ORDER BY event_id, ingested_at ASC),
f AS (SELECT *, CASE WHEN event_ts - LAG(event_ts) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id) <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS ns FROM d),
n AS (SELECT *, SUM(ns) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id ROWS UNBOUNDED PRECEDING) AS sno FROM f)
SELECT rider_id, sno, MIN(event_ts), MAX(event_ts), COUNT(*), BOOL_OR(event_type = 'trip_requested') FROM n GROUP BY 1, 2 ORDER BY 1, 2"""},
            {"message": "A gap of exactly 30 minutes (08:02 → 08:32) must stay in the same session; only a gap of MORE than 30 minutes starts a new one.",
             "sql": """WITH d AS (SELECT DISTINCT ON (event_id) * FROM app_events ORDER BY event_id, ingested_at DESC),
f AS (SELECT *, CASE WHEN event_ts - LAG(event_ts) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id) < INTERVAL '30 minutes' THEN 0 ELSE 1 END AS ns FROM d),
n AS (SELECT *, SUM(ns) OVER (PARTITION BY rider_id ORDER BY event_ts, event_id ROWS UNBOUNDED PRECEDING) AS sno FROM f)
SELECT rider_id, sno, MIN(event_ts), MAX(event_ts), COUNT(*), BOOL_OR(event_type = 'trip_requested') FROM n GROUP BY 1, 2 ORDER BY 1, 2"""},
        ],
    },
    "R1-05": {
        "lang": "sql",
        "setup": setup_of("r1q5.sql"),
        "starter": "-- trip_status_events(trip_id, city_id, status, event_ts), partitioned by month on event_ts\n-- Write your faster, correct query. Prefix it with EXPLAIN to see the plan.\nSELECT *\nFROM trip_status_events\nORDER BY trip_id, event_ts;\n",
        "expect": [{"label": "completed trips by city", "sql": query_after_setup("r1q5.sql", 1)}],
        "diagnostics": [
            {"message": "This is what the ORIGINAL query returns: trip 4 has two identical rows at its latest timestamp, and both match max(event_ts), so city 20 is counted three times.",
             "sql": query_after_setup("r1q5.sql", 0)},
            {"message": "You ranked each trip's events within 09-14 only, so trip 2 counts even though its latest status overall is the refund on 09-15.",
             "sql": """SELECT city_id, count(*) AS completed_trips FROM (
  SELECT DISTINCT ON (trip_id) trip_id, city_id, status FROM trip_status_events
  WHERE event_ts >= TIMESTAMPTZ '2026-09-14 00:00+00' AND event_ts < TIMESTAMPTZ '2026-09-15 00:00+00'
  ORDER BY trip_id, event_ts DESC) d
WHERE status = 'completed' GROUP BY city_id ORDER BY 1"""},
        ],
    },
    "R3-05": {
        "lang": "sql",
        "setup": setup_of("r3q5.sql"),
        "starter": "-- fact_subscription_month(account_id, month, mrr): one row per account per month with MRR > 0\nSELECT *\nFROM fact_subscription_month\nORDER BY account_id, month;\n",
        "expect": [{"label": "MRR bridge", "sql": query_after_setup("r3q5.sql")}],
        "diagnostics": [
            {"message": "Missing months were never turned into zeros, so LAG compares July with September: account 4's reactivation and account 2's churn disappear. Build a dense account × month grid first.",
             "sql": """WITH m AS (
  SELECT account_id, month, mrr, LAG(mrr, 1, 0::numeric) OVER (PARTITION BY account_id ORDER BY month) AS prev_mrr,
         ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY month) AS k
  FROM fact_subscription_month)
SELECT month,
       COALESCE(SUM(prev_mrr), 0) AS opening_mrr,
       COALESCE(SUM(mrr) FILTER (WHERE k = 1), 0) AS new_mrr,
       0 AS reactivation_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE k > 1 AND mrr > prev_mrr), 0) AS expansion_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE k > 1 AND mrr < prev_mrr), 0) AS contraction_mrr,
       0 AS churned_mrr,
       COALESCE(SUM(mrr), 0) AS closing_mrr
FROM m GROUP BY month ORDER BY month"""},
        ],
    },
}
