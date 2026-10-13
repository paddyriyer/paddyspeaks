# Stripe · Loop 1 — evaluator notes (hidden from candidates)

## STR-L1-01

**Reference solution** (PostgreSQL; `{{min_auths}}` is the instance's minimum)

```sql reference
WITH captured AS (
  SELECT auth_id, SUM(amount) AS captured_amount
  FROM captures
  WHERE status = 'succeeded'
  GROUP BY auth_id
), per_auth AS (
  SELECT (a.authorized_at AT TIME ZONE 'UTC')::date AS auth_date,
         a.merchant_id, a.currency, a.amount,
         c.captured_amount,
         v.auth_id IS NOT NULL AS is_voided
  FROM authorizations a
  LEFT JOIN captured c ON c.auth_id = a.auth_id
  LEFT JOIN voids v    ON v.auth_id = a.auth_id
)
SELECT auth_date, merchant_id, currency,
       COUNT(*)                                   AS authorizations,
       COUNT(*) FILTER (WHERE is_voided)          AS voided,
       COUNT(captured_amount)                     AS captured_auths,
       SUM(amount)                                AS authorized_amount,
       COALESCE(SUM(captured_amount), 0)          AS captured_amount,
       ROUND(COUNT(captured_amount)::numeric / COUNT(*), 4)                AS capture_rate_count,
       ROUND(COALESCE(SUM(captured_amount), 0)::numeric / SUM(amount), 4)  AS capture_rate_amount
FROM per_auth
GROUP BY auth_date, merchant_id, currency
HAVING COUNT(*) >= {{min_auths}}
ORDER BY auth_date, merchant_id, currency;
```

**Explanation.** The grain of the report is the authorization, so everything is brought to one row per authorization before grouping. Captures are filtered to `succeeded` and summed per `auth_id` in their own CTE; joining raw capture rows would repeat an authorization once per partial capture and inflate both the count and the authorized amount. `voids` has at most one row per authorization (a unique key), so it can be joined directly. Captures inherit the authorization's date: the funnel is a cohort, and a capture that lands tomorrow improves yesterday's rate. Grouping by currency keeps amounts in one unit; nothing is ever added across currencies. Casting to numeric before dividing avoids integer truncation, and `ROUND(numeric, 4)` rounds half away from zero.

**Complexity.** One hash aggregate over captures, two hash joins and one hash aggregate over authorizations: linear in the input. At scale, maintain a per-authorization fact (amount, captured amount, voided flag, auth date) updated by upsert as captures and voids arrive, and roll that up.

**Dialect notes.** Not executed here. Snowflake and BigQuery have no `FILTER (WHERE …)`: use `COUNT_IF(is_voided)` (Snowflake), `COUNTIF(is_voided)` (BigQuery) or `SUM(CASE WHEN … THEN 1 ELSE 0 END)`. BigQuery: `DATE(authorized_at)` is UTC for a `TIMESTAMP`; integer `/` returns FLOAT64, so use `SAFE_DIVIDE` and `ROUND(x, 4)` (it rounds half away from zero). Snowflake: integer division returns a decimal, not a truncated integer. Spark SQL: `/` returns double; `round(…, 4)` is HALF_UP. MySQL 8: `/` returns a decimal; `COUNT(*) FILTER` is not supported.

**Edge cases built into the data.** A group with a single authorization (below the minimum) and a group with four; voided and pending authorizations; Hard: partial captures and multi-captures, two currencies per merchant; Very Hard: captures on the following UTC day, failed capture attempts (including on authorizations that were never captured), a zero-decimal currency.

**Common mistakes.** Joining `captures` directly and using `COUNT(*)`/`SUM(a.amount)` (fan-out); counting capture rows as captured authorizations; counting failed attempts; grouping captures by `captured_at`; excluding voids from the denominator; integer division; summing across currencies; forgetting the `HAVING`.

**Follow-up guidance.** (1) A per-authorization state table keyed by `auth_id`, upserted from capture and void events, partitioned by authorization date; late captures update an old partition, so the daily rollup is recomputed for touched dates only. (2) A company-wide rate needs an exchange-rate source and a declared conversion date; a strong answer offers a count-based rate (currency-free) first and refuses to add raw minor units. (3) Expired = neither captured nor voided and older than the network's authorization validity; it is derived from time, so it needs an "as of" date, and the bucket changes as the report ages. (4) `captured_amount ≤ amount` is assumed in the rate (it could exceed 1) and in any "uncaptured remainder" metric.

**Rubric anchors.** 2: right shape but fan-out or capture-date attribution. 3: matches the expected result. 4: also explains the cohort choice and an incremental design that handles late captures.

**Strong signals.** States the grain before writing SQL; asks whether captures can be partial or late; refuses to add currencies. **Red flags.** `SELECT DISTINCT` to "fix" a fan-out; converting with a made-up rate; treating voids as not-authorized.

## STR-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH counted AS (
  SELECT refund_id, charge_id, created_at, amount
  FROM refunds
  WHERE status NOT IN ('failed', 'canceled')
), running AS (
  SELECT k.charge_id, k.refund_id, k.created_at,
         SUM(k.amount) OVER (PARTITION BY k.charge_id
                             ORDER BY k.created_at, k.refund_id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS refunded_total
  FROM counted k
), first_breach AS (
  SELECT DISTINCT ON (r.charge_id)
         r.charge_id, c.merchant_id,
         r.refund_id                          AS breach_refund_id,
         r.created_at                         AS breached_at,
         r.refunded_total,
         c.amount_captured,
         r.refunded_total - c.amount_captured AS excess
  FROM running r
  JOIN charges c ON c.charge_id = r.charge_id
  WHERE r.refunded_total > c.amount_captured
  ORDER BY r.charge_id, r.created_at, r.refund_id
)
SELECT * FROM first_breach
ORDER BY breached_at, charge_id;
```

`DISTINCT ON` keeps the first breaching refund per charge (its own `ORDER BY` decides which); the outer query applies the order the question asks for.

**Explanation.** Filter the refunds that never moved or committed money first; a filter after the window would still let them feed other rows' running totals. The running total is ordered by `(created_at, refund_id)` with an explicit `ROWS` frame: with `ORDER BY created_at` alone the default `RANGE` frame treats refunds at the same second as peers and gives them all the same total, so the "first" breaching refund becomes ambiguous. Since running totals only grow (amounts are positive), the first row over the cap is the breach, and every later row is over too; keep only the first per charge. The cap is `amount_captured`. Strict `>`: a total equal to the cap is a full refund.

**Complexity.** One sort by `(charge_id, created_at, refund_id)` for the window and a hash join to charges: O(n log n). The audit can be incremental: carry each charge's running total forward and process only new refunds.

**Dialect notes.** Not executed here. Snowflake and BigQuery have no `DISTINCT ON`: use `QUALIFY ROW_NUMBER() OVER (PARTITION BY charge_id ORDER BY created_at, refund_id) = 1`. Spark SQL: `row_number()` in a subquery; a window with ORDER BY also defaults to a RANGE frame there. MySQL 8: window functions are supported with the same default-frame behaviour; no `DISTINCT ON`.

**Edge cases built into the data.** A charge refunded to exactly its cap; refunds after the breaching one (also over); Hard: failed refunds that would have breached if counted, partially captured charges where refunds exceed `amount_captured` but not `amount`; Very Hard: two refunds on one charge with the same `created_at` (the tie-break decides which refund crossed), pending refunds that count and canceled ones that do not.

**Common mistakes.** Reporting every refund over the cap; `>=`; filtering status after the window; using `amount` as the cap; `ORDER BY created_at` alone with the default frame; a correlated subquery per refund (quadratic on charges with many refunds).

**Follow-up guidance.** (1) Peers under RANGE share a total; with `ROWS` and a unique tie-break each refund gets its own. (2) A conditional update on a per-charge balance (`UPDATE … SET refunded = refunded + :amt WHERE refunded + :amt <= captured`) or a serialised ledger append; a strong answer explains why read-then-write under concurrency is wrong. (3) Treat refunds and dispute losses as debits against one per-charge balance, ordered by when they took effect. (4) A per-charge running-total table updated from new refunds since a watermark.

**Rubric anchors.** 2: running sum present but frame, filter order or cap wrong. 3: matches the expected result. 4: also explains the RANGE/ROWS difference unprompted and how the API should prevent the race.

**Strong signals.** Asks about ties before writing the window; names the default frame. **Red flags.** Answers that depend on table insertion order; "it can't happen because the API checks it" (the audit exists because checks fail).

## STR-L1-03

**Reference solution** (PostgreSQL; `{{min_streak}}` is the instance's threshold)

```sql reference
WITH per_event AS (
  SELECT e.event_id, e.endpoint_id, e.created_at,
         MIN(a.attempted_at) FILTER (WHERE a.status_code BETWEEN 200 AND 299) AS first_success_at
  FROM webhook_events e
  LEFT JOIN delivery_attempts a ON a.event_id = e.event_id
  GROUP BY e.event_id, e.endpoint_id, e.created_at
), numbered AS (
  SELECT p.*,
         first_success_at IS NULL AS failed,
         ROW_NUMBER() OVER (PARTITION BY endpoint_id ORDER BY created_at, event_id) AS rn_all,
         ROW_NUMBER() OVER (PARTITION BY endpoint_id, first_success_at IS NULL ORDER BY created_at, event_id) AS rn_state
  FROM per_event p
), runs AS (
  SELECT endpoint_id, rn_all - rn_state AS island,
         COUNT(*) AS len, MIN(rn_all) AS first_rn, MIN(created_at) AS started_at
  FROM numbered
  WHERE failed
  GROUP BY endpoint_id, rn_all - rn_state
), longest AS (
  SELECT DISTINCT ON (endpoint_id) endpoint_id, len, started_at
  FROM runs
  ORDER BY endpoint_id, len DESC, first_rn
), stats AS (
  SELECT endpoint_id,
         COUNT(*)                AS events,
         COUNT(first_success_at) AS delivered_events,
         ROUND(AVG(EXTRACT(EPOCH FROM first_success_at - created_at)), 1) AS avg_first_success_s
  FROM per_event
  GROUP BY endpoint_id
)
SELECT s.endpoint_id, s.events, s.delivered_events, s.avg_first_success_s,
       l.len        AS longest_failure_streak,
       l.started_at AS streak_started_at
FROM stats s
JOIN longest l ON l.endpoint_id = s.endpoint_id
WHERE l.len >= {{min_streak}}
ORDER BY longest_failure_streak DESC, s.endpoint_id;
```

**Explanation.** First collapse attempts to one row per event: the earliest 2xx attempt, or NULL if there is none. The LEFT JOIN keeps events that were never attempted, and `MIN … FILTER` ignores redirects, errors and timeouts (a NULL status code fails `BETWEEN`). Then gaps and islands: within an endpoint, the difference between the row number over all events and the row number within the same outcome is constant along a run of consecutive failures. Group the failed rows by that difference to get each run's length and start, keep the longest per endpoint (earliest on ties), and filter by the threshold. `AVG` ignores NULL latencies, so it averages delivered events only.

**Complexity.** One aggregate over attempts, two window sorts per endpoint and small aggregates: O(n log n). Incrementally, each endpoint needs only its current run length, its longest run and running latency sums.

**Dialect notes.** Not executed here. Snowflake and BigQuery: no `FILTER`; use `MIN(CASE WHEN status_code BETWEEN 200 AND 299 THEN attempted_at END)`; no `DISTINCT ON`, use `QUALIFY ROW_NUMBER() … = 1`. BigQuery: `TIMESTAMP_DIFF(first_success_at, created_at, SECOND)` instead of `EXTRACT(EPOCH …)`. Snowflake: `DATEDIFF('second', created_at, first_success_at)`. Spark SQL: `unix_timestamp` difference or `timestampdiff`. MySQL 8: `TIMESTAMPDIFF(SECOND, …)`; window functions supported.

**Edge cases built into the data.** One endpoint with two runs (the longer, or the earlier of two equal ones, wins); one with several runs of exactly one less than the threshold (many failures, never enough in a row); Hard: retries that end in a success (the event is delivered), 201/202/204 successes, 3xx redirects as failures; Very Hard: timeouts with NULL status, events with no attempts, events sharing a `created_at` (the `event_id` tie-break decides the order), re-sends after a success (latency uses the first success).

**Common mistakes.** Streaks over attempts rather than events; total failures instead of consecutive; `status_code = 200` or `< 400`; INNER JOIN dropping unattempted events; latency to the last success or to the first attempt; ordering by `created_at` only; reporting the latest of two equal runs.

**Follow-up guidance.** (1) Per endpoint: current run length and start, longest run, delivered count, latency sum; an event updates them once its outcome is final. (2) Outcome finality comes at the end of the retry schedule; "failing right now" is better measured on recent attempts (a rolling attempt failure rate) than on final event outcomes, and a strong answer keeps the two separate. (3) A sustained signal (failure rate over hours, consecutive failures over a minimum count and a minimum duration), notification before disabling, and an easy re-enable. (4) Split by status class and by event type: NULL/timeouts versus 5xx versus 4xx on one type.

**Rubric anchors.** 2: right idea, but attempt-level outcomes or the unattempted events lost. 3: matches the expected result. 4: also designs the streaming state and separates "final outcome" from "current health".

**Strong signals.** Asks what counts as success and what happens to never-attempted events before writing SQL. **Red flags.** A self-join per event to find neighbours; using `LAG` to compare only adjacent pairs and calling that a streak.

## STR-L1-04

**Reference solution**

```python reference
from collections import deque

TTL = 86400

def idempotency_outcomes(requests, max_keys=None):
    live = {}          # key -> (first_ts, params_hash)
    fifo = deque()     # (first_ts, key) in first-use order
    out = []
    for ts, key, params in requests:
        # Keys expire in first-use order, so expired keys are always at the front.
        while fifo and fifo[0][0] + TTL <= ts:
            first, k = fifo.popleft()
            entry = live.get(k)
            if entry is not None and entry[0] == first:
                del live[k]
        entry = live.get(key)
        if entry is not None:
            out.append("replay" if entry[1] == params else "conflict")
            continue
        if max_keys is not None and len(live) >= max_keys:
            while fifo:
                first, k = fifo.popleft()
                entry = live.get(k)
                if entry is not None and entry[0] == first:
                    del live[k]
                    break
        live[key] = (ts, params)
        fifo.append((ts, key))
        out.append("execute")
    return out
```

**Explanation.** A dict answers "is this key live, and with which parameters?" in O(1). Because timestamps never decrease, keys reach their expiry in exactly the order they were first used, so a FIFO of `(first_ts, key)` holds them in expiry order: before each request, pop from the front everything with `first_ts + 86400 <= ts`. The comparison is `<=` because a key is live only while `ts < first_ts + 86400`. Replays and conflicts touch nothing. Under a cap, the front of the same queue is the oldest live key, so eviction is a pop too. The `entry[0] == first` guard makes the queue robust to stale entries (a key re-executed after it left the store) even though this exact flow never creates them.

**Complexity.** Each execute pushes one queue entry, which is popped at most once: amortised O(1) per request, O(n) total. Memory is O(live keys). Scanning the whole store on every request is O(live keys) each; the timing test has tens of thousands of live keys.

**Common mistakes.** `<` instead of `<=` at the boundary (treats a request at exactly 24 hours as a replay); refreshing the expiry on a replay; overwriting the stored parameters on a conflict; lazily expiring only the key being looked up (correct answers, unbounded memory, and under a cap it holds slots for dead keys); a heap (correct, O(log n), unnecessary because arrival order is already expiry order).

**Follow-up guidance.** (1) An atomic insert-if-absent on a shared store (unique constraint, conditional put, `SET NX`) decides the winner; the loser waits for or polls the saved result. (2) Record an in-flight marker on first use; a retry that finds it gets a "request in progress" error and retries later, never a second execution. (3) 50 000 × 86 400 ≈ 4.3 billion keys a day; with ~100 bytes each that is ~430 GB, so it must be sharded, and only a fingerprint of the parameters and a pointer to the response should be stored. (4) Make the side effect itself idempotent downstream (pass the key to the processor), and write the in-flight marker before the charge and the result after; on recovery, reconcile in-flight markers against the processor.

**Rubric anchors.** 2: correct outputs but O(live keys) per request, or a boundary error. 3: correct and amortised O(1) with the arrival-order argument. 4: also a credible concurrent design with in-flight state and crash recovery.

**Strong signals.** Notices that arrival order equals expiry order without a hint; asks what a conflict should store. **Red flags.** "Use a database unique constraint" with no answer for the 24-hour expiry or in-flight requests.

## STR-L1-05

**Reference solution**

```python reference
from collections import deque

def first_flags(events, k, window_s, declined_only=False):
    flagged = {}
    windows = {}       # card -> (deque of (ts, merchant), {merchant: attempts in window})
    for ts, card, merchant, outcome in events:
        if card in flagged:
            continue
        if declined_only and outcome != "declined":
            continue
        state = windows.get(card)
        if state is None:
            state = windows[card] = (deque(), {})
        q, per_merchant = state
        while q and q[0][0] < ts - window_s:
            _, old = q.popleft()
            left = per_merchant[old] - 1
            if left:
                per_merchant[old] = left
            else:
                del per_merchant[old]
        q.append((ts, merchant))
        per_merchant[merchant] = per_merchant.get(merchant, 0) + 1
        if len(per_merchant) >= k:
            flagged[card] = ts
            del windows[card]
    return flagged
```

**Explanation.** Per card, a queue of the counted attempts still in the window and a count per merchant. An attempt leaves when its timestamp is strictly before `ts − window_s` (the window is closed). A merchant disappears only when its count reaches zero, so a merchant with a later attempt still inside stays counted. The distinct count is the dict's size. A flagged card's state is dropped, since only its first timestamp matters. Equal timestamps need no special handling: an attempt at the same second is inside every window that contains its peers, and the first qualifying timestamp is the same whether the check runs after each attempt or after the whole second.

**Complexity.** Each counted attempt is appended and popped at most once: amortised O(1) per event, O(n) total; memory is O(attempts in the window) per tracked card. Rebuilding the set of merchants from the window on every attempt is O(window) per event, which the timing test (a few cards with thousands of attempts in each window) punishes.

**Common mistakes.** A set of merchants with `discard` on eviction (drops a merchant still present later in the window); `<=` instead of `<` when evicting (an open window); counting approved attempts when `declined_only` is set, or filtering them only at the threshold check (they still evict and count); reporting every qualifying timestamp; a single global window for all cards.

**Follow-up guidance.** (1) Partition by card fingerprint: all of one card's attempts must reach one consumer; partitioning by merchant splits exactly the pattern being detected. (2) Buffer by event time with a watermark (allowed lateness 2 minutes) and evaluate windows when the watermark passes; the first timestamp is then exact for events within the lateness bound, and later events are reported as corrections. (3) Count distinct cards per merchant (or per merchant and BIN range); state grows with cards per merchant per window. (4) Per-card exact state for the active minority and approximate distinct counting (HyperLogLog) or count-min sketches for the long tail, with a stated error rate; a strong answer ties the error rate to the cost of blocking a good customer.

**Rubric anchors.** 2: correct on samples but the set-removal bug or O(window) per event. 3: correct and amortised O(1). 4: also the partitioning argument and a sound out-of-order design.

**Strong signals.** Asks whether the window is open or closed; spots the repeated-merchant eviction case unprompted. **Red flags.** Sorting the window per event; per-merchant partitioning without noticing the problem.
