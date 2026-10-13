# OpenAI · Loop 1 — evaluator notes (hidden from candidates)

## OAI-L1-01

**Reference solution** (PostgreSQL; `{{threshold}}` is the instance's threshold)

```sql reference
WITH latest AS (
  SELECT DISTINCT ON (request_id) request_id, project_id, status, prompt_tokens, completion_tokens, event_ts
  FROM usage_events
  ORDER BY request_id, ingested_at DESC
), metered AS (
  SELECT (event_ts AT TIME ZONE 'UTC')::date AS usage_date, project_id,
         SUM(prompt_tokens + completion_tokens) AS metered_tokens
  FROM latest
  WHERE status = 'ok'
  GROUP BY 1, 2
)
SELECT COALESCE(m.usage_date, b.usage_date)          AS usage_date,
       COALESCE(m.project_id, b.project_id)          AS project_id,
       COALESCE(m.metered_tokens, 0)                 AS metered_tokens,
       COALESCE(b.billed_tokens, 0)                  AS billed_tokens,
       COALESCE(b.billed_tokens, 0) - COALESCE(m.metered_tokens, 0) AS diff
FROM metered m
FULL OUTER JOIN billing_lines b
  ON b.usage_date = m.usage_date AND b.project_id = m.project_id
WHERE ABS(COALESCE(b.billed_tokens, 0) - COALESCE(m.metered_tokens, 0)) > {{threshold}}
ORDER BY 1, 2;
```

**Explanation.** Deduplicate first: a retried request appears twice and only the latest copy is authoritative. Aggregate to the billing grain (UTC event date × project). The full outer join keeps project-days that exist on one side only; `COALESCE` turns the missing side into 0. The filter is strict, so a drift of exactly the threshold is not reported (every generated instance contains one).

**Complexity.** One sort for `DISTINCT ON` plus a hash aggregate and a hash join. At billions of rows the sort dominates: pre-aggregate a daily metered table incrementally, keyed by `(usage_date, project_id)`.

**Dialect notes.** Snowflake and BigQuery have no `DISTINCT ON`: use `QUALIFY ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY ingested_at DESC) = 1`. Spark SQL: `row_number()` in a subquery. MySQL 8: `ROW_NUMBER()` in a CTE; `FULL OUTER JOIN` is not supported, so union a left and a right anti-join. These variants are not executed here.

**Edge cases built into the data.** Errored requests; retries with corrected token counts (Hard); a request served at 23:59:xx and ingested after midnight, plus usage with no billing line and billing with no usage (Very Hard); a drift of exactly the threshold.

**Common mistakes.** Summing before deduplicating; inner or left join; attributing by `ingested_at`; `>=` instead of `>`; ordering only by date.

**Follow-up guidance.** (1) Late data: compute daily, mark a day final after the lateness bound, and post corrections as adjusting lines rather than rewriting billed history. (2) A daily metered table maintained by upsert from deduplicated events; partition by date, cluster by project. (3) Model credits and discounts as their own ledger lines so reconciliation compares gross metered tokens with gross billed tokens. (4) Row-count and token-sum checks between raw events and the metered table, and a block-on-fail rule for the finance export.

**Rubric anchors.** 2: right totals but loses one-sided rows or double counts retries. 3: matches the expected result. 4: also explains finality under late data and a correct incremental design.

**Red flags.** Filtering errors after the join; "just use DISTINCT" across all columns (does not collapse a retry with corrected tokens). **Strong signals.** Asks which timestamp decides the day before writing SQL; proposes a reconciliation check that would have caught the drift.

## OAI-L1-02

**Reference solution** (PostgreSQL; `{{start}}`, `{{end}}` and `{{pct}}` are the instance's values)

```sql reference
WITH hours AS (
  SELECT generate_series(TIMESTAMPTZ '{{start}}' - INTERVAL '1 hour',
                         TIMESTAMPTZ '{{end}}', INTERVAL '1 hour') AS hour_start
), grid AS (
  SELECT h.hour_start, f.model_family
  FROM hours h CROSS JOIN model_families f
), stats AS (
  SELECT date_trunc('hour', event_ts) AS hour_start, model_family,
         COUNT(*) AS requests,
         (COUNT(*) FILTER (WHERE status <> 'ok'))::float8 / COUNT(*) AS error_rate,
         percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
           FILTER (WHERE status = 'ok') AS p95_ms
  FROM inference_events
  WHERE event_ts >= TIMESTAMPTZ '{{start}}' - INTERVAL '1 hour'
    AND event_ts <  TIMESTAMPTZ '{{end}}' + INTERVAL '1 hour'
  GROUP BY 1, 2
), series AS (
  SELECT g.hour_start, g.model_family,
         COALESCE(s.requests, 0) AS requests, s.error_rate, s.p95_ms,
         LAG(s.p95_ms) OVER (PARTITION BY g.model_family ORDER BY g.hour_start) AS prev_p95_ms
  FROM grid g
  LEFT JOIN stats s ON s.hour_start = g.hour_start AND s.model_family = g.model_family
)
SELECT hour_start, model_family, requests, error_rate, p95_ms, prev_p95_ms,
       COALESCE(p95_ms > prev_p95_ms * (1 + {{pct}} / 100.0), false) AS regressed
FROM series
WHERE hour_start >= TIMESTAMPTZ '{{start}}'
ORDER BY hour_start, model_family;
```

**Explanation.** Aggregate once per (hour, family). Failed requests stay in the group so they count in `requests` and `error_rate`, and the `FILTER` clause keeps them out of the percentile: a timeout's 30 s is a client-visible failure, not a serving latency. The hour grid (the window plus the hour before it, × every family) gives every clock hour a row, so `LAG` over the grid really is "the previous clock hour"; an hour with no traffic contributes a NULL p95 and the next hour therefore has nothing to compare with. The window filter runs last, after LAG has read the hour before the window. `p95 > NULL` is NULL, so `COALESCE(…, false)` keeps `regressed` a boolean. Every instance plants an hour exactly {{pct}}% above the previous one, which must stay false.

**Complexity.** One scan of the window's events, a hash aggregate whose percentile sorts each group (O(n log n) over the events in the window), and a sort of the small grid for the window function. At billions of rows per hour the per-group sort is the cost: production systems keep latency histograms or sketches per (family, hour) instead of raw values.

**Dialect notes** (described, not executed). Snowflake: `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)` exists; the portable way to exclude failures is to order by an expression that is NULL for them, `IFF(status = 'ok', latency_ms, NULL)` (aggregates ignore NULLs), rather than an aggregate `FILTER` clause; build the grid with `GENERATOR` or a calendar table. BigQuery: `PERCENTILE_CONT(x, 0.95)` is an analytic function only (use it with `OVER (PARTITION BY …)` and then `ANY_VALUE`), or `APPROX_QUANTILES(x, 100)[OFFSET(95)]`, which is approximate; the grid via `GENERATE_TIMESTAMP_ARRAY` + `UNNEST`. Spark SQL: `percentile(x, 0.95)` is exact with interpolation, `percentile_approx` is not; `sequence()` + `explode` builds the grid. MySQL 8 has no percentile function: rank with `ROW_NUMBER()` and interpolate by hand, and build the grid with a recursive CTE.

**Edge cases built into the data.** Timeouts with very large latencies and fast-failing errors (every level); events at exactly hh:00:00 and hh:59:59; a rise of exactly {{pct}}% (every level); a family-hour with no traffic, followed by an hour whose p95 is far above the hour two before it (Hard and Very Hard); an hour in which every request failed, and traffic in the hour before the window that is the first report hour's baseline (Very Hard).

**Common mistakes.** Including failed requests in the percentile; removing them with `WHERE` (which corrupts `requests` and `error_rate` and drops an all-failure hour); `percentile_disc`; LAG over only the hours that had traffic, which silently compares with an earlier hour; filtering to the window before LAG; `>=`; returning NULL rather than false for `regressed`; integer division in `error_rate`.

**Follow-up guidance.** (1) Add `percentile_cont(0.99)` and `region` to the grouping (and to the grid); exact percentiles need every value per group, which is why large systems keep histograms. (2) Percentiles are not additive: the average of hourly p95s is not the daily p95. Store a mergeable summary per hour (a fixed-bucket histogram, t-digest, DDSketch, HDR histogram) and merge summaries for any longer range, accepting a stated relative error. (3) A minimum sample count per hour, comparison with a trailing baseline (same hour last week, or a 24-hour median), and requiring two consecutive breaches; name the cost in detection delay. (4) Recompute only the hours touched by new events (late events up to 10 minutes only reach the current and previous hour), keep hourly summaries in an upsertable table, and mark an hour final once the lateness bound has passed.

**Rubric anchors.** 2: right p95s and error rates, but LAG over existing rows only, or failures in the percentile. 3: matches the expected result. 4: also explains percentile non-additivity with a concrete storage design and a robust alert rule.

**Strong signals.** Asks whether failures belong in the latency percentile before writing SQL; builds the grid unprompted; says why the window filter must come after LAG. **Red flags.** "Just average the p95s"; treating an hour with no traffic as p95 = 0; a regressed flag that is NULL for the first hour.

## OAI-L1-03

**Reference solution** (PostgreSQL; `{{gap}}` is the instance's inactivity limit in minutes)

```sql reference
WITH ordered AS (
  SELECT m.conversation_id, m.message_id, m.sent_at, m.tokens,
         LAG(m.sent_at) OVER (PARTITION BY m.conversation_id
                              ORDER BY m.sent_at, m.message_id) AS prev_sent_at
  FROM messages m
), marked AS (
  SELECT o.*,
         CASE WHEN prev_sent_at IS NULL
                OR sent_at - prev_sent_at > INTERVAL '{{gap}} minutes' THEN 1 ELSE 0 END AS starts_session
  FROM ordered o
), sessioned AS (
  SELECT k.*,
         SUM(starts_session) OVER (PARTITION BY conversation_id ORDER BY sent_at, message_id
                                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_no
  FROM marked k
), running AS (
  SELECT s.conversation_id, s.session_no, s.message_id,
         ROW_NUMBER() OVER w AS turn_no,
         c.system_tokens + SUM(s.tokens) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS context_tokens,
         mo.context_window
  FROM sessioned s
  JOIN conversations c ON c.conversation_id = s.conversation_id
  JOIN models mo ON mo.model = c.model
  WINDOW w AS (PARTITION BY s.conversation_id, s.session_no ORDER BY s.sent_at, s.message_id)
)
SELECT DISTINCT ON (conversation_id, session_no)
       conversation_id, session_no, turn_no, message_id, context_tokens, context_window
FROM running
WHERE context_tokens > context_window
ORDER BY conversation_id, session_no, turn_no;
```

**Explanation.** Gaps and islands: `LAG` finds each message's predecessor in the same conversation, a gap of strictly more than {{gap}} minutes marks a session start, and a running SUM of those marks numbers the sessions. The context is a second running SUM, partitioned by session, with an explicit ROWS frame and the `message_id` tie-break: with the default RANGE frame (or ORDER BY `sent_at` alone) two messages with the same `sent_at` are peers and both receive the total including the later one, so the overflow is reported one message early. `system_tokens` is added once per session because the client re-sends the system prompt with every fresh session. `DISTINCT ON` keeps the first overflowing turn of each session.

**Complexity.** Two sorts by `(conversation_id, sent_at, message_id)` (the second partition key adds `session_no`, which is monotone in that order, so a planner can often reuse the order) and linear window passes: O(n log n). Incrementally, only the open session of each conversation changes.

**Dialect notes** (described, not executed). Snowflake and BigQuery: the same window functions; use `QUALIFY ROW_NUMBER() OVER (PARTITION BY conversation_id, session_no ORDER BY turn_no) = 1` instead of `DISTINCT ON`; the gap test is `TIMESTAMP_DIFF(sent_at, prev, SECOND) > {{gap}} * 60` in BigQuery or `DATEDIFF('second', prev, sent_at)` in Snowflake. Default frames with ORDER BY differ by engine and version (the SQL standard default is RANGE), so state ROWS explicitly everywhere. Spark SQL: `rowsBetween(Window.unboundedPreceding, Window.currentRow)`; no `DISTINCT ON`. MySQL 8: the window functions and frames work; no `DISTINCT ON`, use `ROW_NUMBER()`.

**Edge cases built into the data.** A gap of exactly {{gap}} minutes inside an overflowing session (same session); a session that reaches exactly its window and overflows on the next message; a session that ends at exactly its window and never overflows (when the instance has a non-overflowing session); a gap of {{gap}} minutes plus one second (new session, Hard and Very Hard); two messages with the same `sent_at` straddling the overflow (Hard and Very Hard); different windows per model (Hard and Very Hard); a system prompt counted at the start of every session (Very Hard).

**Common mistakes.** No sessionisation; `>=` on the gap or on the window; the default RANGE frame or ordering by `sent_at` alone; joining the model's window from the wrong table; adding `system_tokens` to every message instead of once per session, or once per conversation; returning every overflowing message instead of the first.

**Follow-up guidance.** (1) "Drop the oldest messages until it fits" is a sliding window whose start depends on the data, which a fixed frame cannot express; a recursive CTE or procedural code (two pointers per session) does it, or precompute it in the pipeline. (2) Keep the last message time and open session per conversation; a late message that closes a gap merges two sessions and renumbers everything after it in that conversation, so either recompute the conversation or use stable session ids (first message id) instead of ordinal numbers. (3) Sessions that never overflow are right-censored: report the share that overflow and use survival-style estimates (Kaplan–Meier) for turns-to-overflow. (4) Record model and token count per message, sum per message with its own model's count, and compare against the model active at that turn.

**Rubric anchors.** 2: sessionises correctly but uses the default frame, or misses one boundary rule. 3: matches the expected result. 4: also handles late messages incrementally and explains the censoring bias.

**Strong signals.** Asks about ties and boundary rules before writing SQL; explains RANGE versus ROWS precisely; numbers sessions with a running SUM rather than a self-join. **Red flags.** A correlated subquery per message (quadratic); "timestamps never tie"; `DISTINCT ON` without a tie-break in ORDER BY.

## OAI-L1-04

**Reference solution**

```python reference
from collections import deque

def admit(requests, tpm, rpm=None):
    windows = {}   # project -> [deque of (ts, tokens), running token total]
    out = []
    for ts, project, tokens in requests:
        limit = tpm.get(project)
        if limit is None:
            out.append(False)
            continue
        state = windows.get(project)
        if state is None:
            state = windows[project] = [deque(), 0]
        q = state[0]
        while q and q[0][0] <= ts - 60000:
            state[1] -= q.popleft()[1]
        ok = state[1] + tokens <= limit and (rpm is None or len(q) + 1 <= rpm)
        if ok:
            q.append((ts, tokens))
            state[1] += tokens
        out.append(ok)
    return out
```

**Explanation.** Per project, a deque of admitted requests still in the window and a running total. Evict from the front everything at or before `ts − 60000` (the window is half-open), then admit if both limits hold. Rejected requests are never appended, so they consume nothing.

**Complexity.** Each admitted request is appended and popped at most once: amortised O(1) per request, O(n) total. Memory is O(admitted requests in the window).

**Common mistakes.** Closed window (`< ts − 60000`), which keeps a request exactly 60 s old; counting rejected requests; one global deque for all projects; rescanning the window per request (fails the timing test).

**Follow-up guidance.** (1) Local limiters with a share of the limit each, re-balanced periodically, or a central counter with batched leases; an honest answer names the over-admission bound. (2) Fixed windows admit up to 2× the limit across a boundary. (3) Admit on an estimate (e.g. `max_tokens`), then debit actual usage asynchronously; public API docs describe estimating from the larger of `max_tokens` and request size. (4) Evict idle projects; approximate structures for the long tail.

**Rubric anchors.** 2: correct but O(window) per request, or a boundary error. 3: correct amortised O(1). 4: also a credible distributed design with stated error bounds.

## OAI-L1-05

**Reference solution**

```python reference
import heapq

def window_p95(logs, t0, width, n_windows, step=None, min_count=1):
    if step is None:
        step = width
    end = t0 + (n_windows - 1) * step + width          # end of the last window (exclusive)
    its = [iter(log) for log in logs]
    heap = []
    for k, it in enumerate(its):
        first = next(it, None)
        if first is not None:
            heap.append((first[0], k, first[1]))
    heapq.heapify(heap)
    buckets = [[] for _ in range(n_windows)]
    while heap and heap[0][0] < end:                    # nothing left in any log can be earlier
        ts, k, lat = heap[0]
        nxt = next(its[k], None)
        if nxt is None:
            heapq.heappop(heap)
        else:
            heapq.heapreplace(heap, (nxt[0], k, nxt[1]))
        if ts < t0:
            continue
        first_w = max(0, (ts - t0 - width) // step + 1)   # windows i with start_i <= ts < start_i + width
        last_w = min(n_windows - 1, (ts - t0) // step)
        for i in range(first_w, last_w + 1):
            buckets[i].append(lat)
    out = []
    for vals in buckets:
        n = len(vals)
        if n == 0 or n < min_count:
            out.append(None)
            continue
        rank = (95 * n + 99) // 100                       # ceil(0.95 * n) without floats
        vals.sort()
        out.append(vals[rank - 1])
    return out
```

**Explanation.** A min-heap holds the next unread event of each region keyed by `(ts, region)`, so popping gives the global time order (a k-way merge). Because every log is sorted, the loop stops as soon as the smallest pending timestamp reaches the end of the last window: at most one event per region past the report is ever read. Each event is assigned to its windows arithmetically: for tumbling windows exactly one, for hopping windows `width / step` of them. The nearest-rank p95 is the ⌈0.95·n⌉-th smallest value, computed in integers to avoid float rounding at exact multiples. `heapq.merge(*logs)` with the same stop condition is an equally good answer.

**Complexity.** O(M log K) for the merge over the M events the report needs, O(M · width/step) appends, and O(Σ nᵢ log nᵢ) for sorting the windows (a selection algorithm makes it linear per window). Memory O(K + M · width/step). Materialising the logs costs O(N) for the full streams, which is what the timing test punishes: N is about 80 times M.

**Common mistakes.** `list(log)` or `sorted(itertools.chain(*logs))`, which reads entire streams (fails the timing test); a stop condition on the first exhausted log instead of the heap minimum; closed windows; `int(0.95 * n)` or `round`, which gives rank 18 instead of 19 for n = 20 or misses the ceiling; interpolating; ignoring `min_count` or returning 0 for an empty window; for hopping windows, assigning an event only to the window that starts before it; heap entries `(ts, lat)` without the region index, which then cannot tell which iterator to advance.

**Follow-up guidance.** (1) Watermarks: window i is emitted when every region's watermark has passed its end (or after a bounded wait); late events go to a correction stream or are dropped and counted. (2) Mergeable sketches (t-digest, DDSketch with a relative-error guarantee, HDR histograms with fixed buckets) merge by adding buckets or centroids; p95 values do not merge because a quantile of the union depends on the whole distributions. (3) At K = 5 000 a heap is O(log K) per event, around 13 comparisons; batching per host (merging sorted blocks) or a tournament tree reduces overhead; or bucket by time first if exact order inside a window is not needed (it is not for a percentile). (4) A max-heap of the lower 95% and a min-heap of the rest, rebalanced as n changes, with a hash map counting pending deletions so expired items are discarded lazily when they reach a heap top: O(log n) amortised per event.

**Rubric anchors.** 2: correct results but materialises the logs, or a rank or boundary error. 3: lazy heap merge with the right stop condition and exact windows. 4: also gives a credible watermark and sketch design with stated error.

**Strong signals.** Notices that order inside a window does not matter for a percentile, so only the stop condition needs the merge order; asks how late a region can be. **Red flags.** Averaging per-region p95s; claiming a sort of all events is "the same complexity"; reading the whole stream "to be safe".
