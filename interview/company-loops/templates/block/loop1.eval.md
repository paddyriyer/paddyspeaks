# Block · Loop 1 — evaluator notes

Reference solutions and guidance for interviewers. Simulated practice scenarios; every
number and rule is hypothetical, and money is integer cents.

## BLK-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH counted AS (                      -- one row per counted tender
  SELECT s.business_category,
         date_trunc('month', p.created_at AT TIME ZONE {{month_tz_sql}})::date AS month,
         t.method,
         t.tendered_cents - t.change_cents AS amount_cents
  FROM tenders t
  JOIN payments p ON p.payment_id = t.payment_id
  JOIN sellers  s ON s.seller_id  = p.seller_id
  WHERE t.status = 'COMPLETED'
), totals AS (
  SELECT business_category, month, COUNT(*) AS n, SUM(amount_cents) AS cents
  FROM counted
  GROUP BY business_category, month
)
SELECT g.business_category, g.month, m.method,
       COUNT(c.method)                                                     AS tenders,
       COALESCE(SUM(c.amount_cents), 0)                                    AS amount_cents,
       ROUND(COUNT(c.method)::numeric / g.n, 4)                            AS tender_share,
       ROUND(COALESCE(SUM(c.amount_cents), 0)::numeric / g.cents, 4)       AS amount_share
FROM totals g
CROSS JOIN tender_methods m
LEFT JOIN counted c
  ON c.business_category = g.business_category AND c.month = g.month AND c.method = m.method
GROUP BY g.business_category, g.month, m.method, g.n, g.cents
ORDER BY g.business_category, g.month, m.method;
```

`{{month_tz_sql}}` is `'UTC'` at Medium and `s.time_zone` at Hard and Very Hard (the instance's month rule). A candidate's query writes the zone directly.

**Explanation.** The grain of the report is the tender, so the first step produces exactly one row per counted tender with the category, the month and the amount the tender applied. The month comes from the payment's instant converted to the stated zone: `created_at AT TIME ZONE s.time_zone` turns a `timestamptz` into the seller's local wall-clock time, and `date_trunc('month', …)` takes its month. Totals per category-month are computed once; the grid is those category-months × the five methods, and a LEFT JOIN of the counted tenders onto it gives zeros where a method was not used. `COUNT(c.method)` (not `COUNT(*)`) is what makes an empty cell 0. Both shares are ratios of totals with numeric division.

**Complexity.** One pass over tenders with two hash joins and a hash aggregate, then a grid of 5 × category-months. At scale this is a daily pre-aggregate by (seller, local date, method) rolled up monthly.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(created_at, time_zone), MONTH)`; `SAFE_DIVIDE`; `ROUND(x, 4)`; a CROSS JOIN with `UNNEST(['cash', …])` can replace the methods table. Snowflake: `DATE_TRUNC('month', CONVERT_TIMEZONE(time_zone, created_at))`, `DIV0`. Spark SQL: `date_trunc('MONTH', from_utc_timestamp(created_at, time_zone))`. MySQL 8: `CONVERT_TZ` needs the time zone tables loaded; `DATE_FORMAT(…, '%Y-%m-01')`.

**Edge cases built into the data.** Split payments (cash plus a card) at every level; category-months missing some methods. Hard: sellers in Los Angeles and Sydney with payments a few hours either side of a UTC month end, so the local month differs from the UTC month; FAILED card attempts before the tender that went through (a failed chip read followed by a contactless retry). Very Hard: cash tenders with change given, including one where 20.00 was handed over for 13.50; three-way splits.

**Common mistakes.** Counting payments instead of tenders (or joining to payments and counting twice the other way round); dropping the zero rows by aggregating only what exists; `COUNT(*)` on the grid, which turns empty cells into 1; UTC months at Hard; counting FAILED tenders; summing `tendered_cents` for cash; integer division; averaging per-payment shares.

**Follow-up guidance.** (1) "Share of payments that used any contactless tender" counts each payment once, in the numerator if any tender was contactless; the denominator is payments with at least one completed tender, so the method shares no longer sum to 1. (2) Report a median or trimmed view across sellers, or each seller's mix averaged with equal weight; suppress cells with fewer than a stated number of sellers or tenders. (3) A daily aggregate keyed by (seller, local date, method) with counts and cents; a late status change re-emits the affected day, and the month is a sum of days, so corrections are cheap; mark months as provisional for a few days. (4) Store the zone on the payment (or the location's zone as of the payment) at write time; never re-derive old months from a seller's current zone.

**Rubric anchors.** 2: correct per-tender counts but the zero rows are missing or failed tenders are counted. 3: matches the expected result. 4: also gives a precise per-payment definition, handles seller dominance and describes incremental aggregation.

**Strong signals.** States the grain ("one row per tender") before writing SQL; checks that each category-month's shares sum to 1; asks which zone defines a month. **Red flags.** Counting a split payment once under one method; float money; treating keyed-in share as evidence of anything about a particular seller without context.

## BLK-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH first_decisive AS (               -- each payment's earliest APPROVED or DECLINED attempt
  SELECT DISTINCT ON (payment_id) payment_id, attempted_at, result
  FROM forward_attempts
  WHERE result IN ('APPROVED', 'DECLINED')
  ORDER BY payment_id, attempted_at, attempt_id
), settled AS (
  SELECT p.seller_id, p.taken_at, p.amount_cents, d.attempted_at, d.result
  FROM offline_payments p
  LEFT JOIN first_decisive d
    ON d.payment_id = p.payment_id
   AND ({{window_h}} = 0 OR d.attempted_at <= p.taken_at + make_interval(hours => {{window_h}}))
)
SELECT seller_id,
       date_trunc('month', taken_at AT TIME ZONE 'UTC')::date                  AS month,
       COUNT(*)                                                                AS offline_payments,
       COUNT(attempted_at)                                                     AS forwarded,
       ROUND(AVG(EXTRACT(EPOCH FROM attempted_at - taken_at)) / 3600, 2)       AS avg_hours_to_forward,
       ROUND(COUNT(*) FILTER (WHERE result = 'DECLINED')::numeric
             / NULLIF(COUNT(attempted_at), 0), 4)                              AS declined_share,
       COUNT(*) - COUNT(attempted_at)                                          AS never_forwarded,
       COALESCE(SUM(amount_cents) FILTER (WHERE attempted_at IS NULL), 0)      AS never_forwarded_cents
FROM settled
GROUP BY seller_id, date_trunc('month', taken_at AT TIME ZONE 'UTC')::date
ORDER BY seller_id, month;
```

`{{window_h}}` is 0 (no window) at Medium and Hard, and the instance's window in hours at Very Hard; a candidate writes the window directly, e.g. `INTERVAL '48 hours'`.

**Explanation.** Settle each payment first: its first decisive attempt, chosen with a deterministic order (`attempted_at`, then `attempt_id`), with ERROR attempts filtered out before choosing. Only then join to the payments. The LEFT JOIN keeps unforwarded payments; at Very Hard the window condition sits in the ON clause, so a payment whose first decisive attempt is too late gets no match and falls into `never_forwarded`. Filtering the window before choosing the first attempt gives the same answer, because if the earliest decisive attempt is late, every later one is too. Aggregates ignore NULLs, so the average and the decline share cover forwarded payments only, and `NULLIF` turns an empty denominator into NULL rather than an error. The never-forwarded count and cents are computed from the same rows but kept in their own columns.

**Complexity.** A sort of attempts for `DISTINCT ON`, a hash join and a hash aggregate: O(a log a + p).

**Dialect notes** (described, not executed). BigQuery and Snowflake: `QUALIFY ROW_NUMBER() OVER (PARTITION BY payment_id ORDER BY attempted_at, attempt_id) = 1`; `TIMESTAMP_DIFF(…, SECOND)` / `DATEDIFF('second', …)`; `COUNTIF` / `COUNT_IF`; `SAFE_DIVIDE` / `DIV0NULL`. Spark SQL: `row_number()` in a subquery, `unix_timestamp` differences. MySQL 8: `ROW_NUMBER()` in a CTE and `TIMESTAMPDIFF(SECOND, …)`.

**Edge cases built into the data.** Payments taken late on 31 August and forwarded in September; a seller-month in which nothing was forwarded (NULL average and share). Hard: ERROR attempts before the decisive one; payments with only ERROR attempts; a decline followed by an approved retry (the decline settles it); two decisive attempts at the same second, broken by `attempt_id`. Very Hard: a window of 24, 48 or 72 hours, with one payment forwarded exactly at the window (in time) and one a second later (never forwarded).

**Common mistakes.** Grouping by the month of the forward; counting ERROR attempts as forwarding; using the latest attempt; an inner join that loses unforwarded payments; dividing the decline share by all payments; `COUNT(*)` for forwarded; averages in days or minutes; an exclusive window boundary; WHERE instead of ON for the window, which drops the payment entirely.

**Follow-up guidance.** (1) The device knows how long each stored payment has waited; flag payments approaching the window, and flag sellers with many stored payments, from device sync data rather than this monthly table. (2) A p90 or p95 of hours to forward per seller-month (`percentile_cont(0.9) WITHIN GROUP (ORDER BY hours)`), alongside the count, because the tail is what costs money. (3) Upsert attempts by `attempt_id` so duplicates are harmless; recompute the affected seller-months as late attempts arrive; call a month final after the window plus a margin. (4) Declines can reflect card mix, ticket size, connectivity patterns or one bad day; compare against the same sellers' online decline rate and check volume before any conclusion, and never treat it as a judgement about a seller on its own.

**Rubric anchors.** 2: correct for one attempt per payment but loses unforwarded payments or uses the wrong month. 3: matches the expected result. 4: also designs the live alert from device data and talks about percentiles and finality.

**Strong signals.** Separates "which attempt settles the payment" from the aggregation; keeps the never-forwarded money visible. **Red flags.** Treating ERROR as a decline; presenting this exercise's window as a product guarantee.

## BLK-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH due AS (                          -- running amount due through each instalment
  SELECT plan_id, instalment_no, due_date,
         SUM(amount_cents) OVER (PARTITION BY plan_id ORDER BY instalment_no) AS due_through
  FROM instalments
), paid AS (                           -- running amount paid through each payment
  SELECT plan_id, paid_at,
         SUM(amount_cents) OVER (PARTITION BY plan_id ORDER BY paid_at, payment_id) AS paid_through
  FROM plan_payments
), judged AS (
  SELECT d.plan_id, d.instalment_no, d.due_date,
         (SELECT MIN(p.paid_at) FROM paid p
          WHERE p.plan_id = d.plan_id AND p.paid_through >= d.due_through) AS fully_paid_at
  FROM due d
), per_plan AS (
  SELECT plan_id,
         BOOL_AND(fully_paid_at IS NOT NULL
                  AND (fully_paid_at AT TIME ZONE 'UTC')::date <= due_date)          AS all_on_time,
         COUNT(*) FILTER (WHERE instalment_no = 2 AND (fully_paid_at AT TIME ZONE 'UTC')::date > due_date) AS late_2,
         COUNT(*) FILTER (WHERE instalment_no = 3 AND (fully_paid_at AT TIME ZONE 'UTC')::date > due_date) AS late_3,
         COUNT(*) FILTER (WHERE instalment_no = 4 AND (fully_paid_at AT TIME ZONE 'UTC')::date > due_date) AS late_4,
         COUNT(*) FILTER (WHERE fully_paid_at IS NULL)                                AS unpaid
  FROM judged
  GROUP BY plan_id
)
SELECT date_trunc('month', pl.purchased_at AT TIME ZONE 'UTC')::date AS cohort_month,
       COUNT(*)                                        AS plans,
       COUNT(*) FILTER (WHERE pp.all_on_time)          AS on_time_plans,
       ROUND(COUNT(*) FILTER (WHERE pp.all_on_time)::numeric / COUNT(*), 4) AS on_time_share,
       SUM(pp.late_2)                                  AS late_2,
       SUM(pp.late_3)                                  AS late_3,
       SUM(pp.late_4)                                  AS late_4,
       SUM(pp.unpaid)                                  AS unpaid_instalments
FROM plans pl
JOIN per_plan pp ON pp.plan_id = pl.plan_id
GROUP BY 1
ORDER BY 1;
```

**Explanation.** Because payments do not name an instalment, the question "which payment completed instalment *k*" is answered with two running totals: the amount due through instalment *k*, and the amount paid through each payment in `paid_at, payment_id` order. Instalment *k* is fully paid by the first payment whose running paid total reaches its running due total; since the paid total only grows, that is the payment with the smallest `paid_at` meeting the condition. This one rule handles exact payments, part payments (the completing part decides) and payments that pay ahead (one payment can reach several thresholds). Compare the UTC date of that payment with `due_date` — a `date` — not the timestamp with midnight. Aggregate to the plan, where `BOOL_AND` over "fully paid and on time" is false for any unpaid instalment, then to the cohort.

**Complexity.** Two window sorts over instalments and payments and a lookup per instalment; with an index on `(plan_id, paid_through)` or a range join it is O((i + p) log p). In a warehouse, an equivalent is a join on `plan_id` with `paid_through >= due_through` and `MIN` per instalment.

**Dialect notes** (described, not executed). BigQuery and Snowflake: the correlated `MIN` is better written as a join plus `GROUP BY` (or `QUALIFY ROW_NUMBER() … = 1`); `LOGICAL_AND` / `BOOLAND_AGG`; `COUNTIF` / `COUNT_IF`; `DATE(paid_at)` is UTC in BigQuery. Spark SQL: `bool_and`, `count_if`, and a range join on the running totals. MySQL 8: window `SUM` works; no `FILTER`, so `SUM(CASE …)`; no `BOOL_AND`, so `MIN(condition) = 1`.

**Edge cases built into the data.** Every level: a payment at 23:59 UTC on the due date (on time) and one just after midnight the next day (late); plans that stop paying (unpaid instalments, not on time); some cohorts with no on-time plans. Hard: instalments paid in two or three parts, with the completing part after the due date and the first part before it. Very Hard: payments that pay ahead into the next instalment, a late payment that also covers the next instalment early, and one payment a week after checkout that clears the rest of the plan.

**Common mistakes.** Matching the *n*-th payment to the *n*-th instalment; judging an instalment by its first part; comparing `paid_at <= due_date` as timestamps (late by up to a day); counting a plan with an unpaid instalment as on time because nothing was late; forgetting `payment_id` in the running order; averaging per-plan shares instead of a ratio of counts.

**Follow-up guidance.** (1) Either restrict each cohort to instalments already due ("on time so far", with the due-so-far count shown), or wait until the last instalment of the cohort is due; never mix them silently. (2) Compare `paid_date <= due_date + grace` in one place; show the curve of on-time share against grace days so the choice is visible. (3) Model a refund as an adjustment that reduces remaining instalments (a new schedule version) and apply payments against the schedule as of each payment; the running-total rule still applies to the current amounts. (4) Keep per-plan state (paid total and next unpaid instalment) and update it from the day's payments; only plans with new payments or instalments falling due that day change.

**Rubric anchors.** 2: right for one exact payment per instalment, wrong for parts or pay-ahead, or compares timestamps. 3: matches the expected result. 4: also handles incomplete cohorts and grace periods credibly and keeps the analysis about the schedule, not about people.

**Strong signals.** Notices that payments carry no instalment number and reaches for running totals; checks the due-date comparison type. **Red flags.** Drawing conclusions about individual customers' creditworthiness from the report; presenting the schedule as the product's actual terms.

## BLK-L1-04

**Reference solution**

```python reference
def discrepancy_runs(txns, shortfalls):
    by_shift = {s: [] for s in shortfalls}
    for pos, (shift, cents, voided) in enumerate(txns):
        if not voided and shift in by_shift:
            by_shift[shift].append((pos, cents))
    out = {}
    for shift, rows in by_shift.items():
        target = shortfalls[shift]
        seen = {0: 1}        # prefix net -> how many times it has occurred
        latest = {0: 0}      # prefix net -> latest number of transactions at which it occurred
        net, count, best = 0, 0, None
        for k, (pos, cents) in enumerate(rows, 1):
            net += cents
            want = net - target
            c = seen.get(want)
            if c:
                count += c
                start = latest[want]               # run = rows[start .. k-1]
                if best is None or k - start < best[0]:
                    best = (k - start, rows[start][0], pos)
            seen[net] = seen.get(net, 0) + 1
            latest[net] = k
        out[shift] = (count, None if best is None else (best[1], best[2]))
    return out
```

**Explanation.** Each shift is solved on its own list of counted transactions (voided ones skipped), remembering each transaction's position in `txns`. With prefix nets `P0 = 0, P1, …`, the run of transactions *i+1..k* has net `Pk − Pi`, so the runs ending at *k* are exactly the earlier prefixes equal to `Pk − discrepancy`: the count of such prefixes is added, and the latest one gives the shortest run ending at *k*. Ends are visited in order and the best is replaced only by a strictly shorter run, so among runs of equal length the one that starts first wins. The seeded `{0: 1}` is the empty prefix that lets a run start at the shift's first transaction. Two pointers cannot work: refunds make nets non-monotonic.

**Complexity.** O(n) time and O(n) memory. The timing test (200 000 transactions) runs in about 0.3–0.5 s in CPython; checking every (start, end) pair took about 1.7 s for 6 000 transactions and grows with the square, so at 200 000 it would take over half an hour. The middle approach — prefix sums, then for each end `prefix[:k].count(target)` or a scan back — is still O(n²) and fails the same test.

**Dialect notes.** Java: `HashMap<Long, int[]>` holding count and latest index; C++: `unordered_map<long long, pair<int,int>>`. In SQL, a self-join of prefix sums on `p2.prefix - p1.prefix = discrepancy` per shift expresses the count, but at 200 000 rows per shift it needs an equality join on the computed key (hash join), not a range join.

**Edge cases built into the tests.** A one-transaction run; no run; the whole shift as the only run; a refund inside a run; an overage (negative discrepancy); equal-length runs (the earlier wins); zero-net stretches so that several runs end at the same transaction. Hard: interleaved shifts, a shift under review with no transactions, a shift not under review left out. Very Hard: a voided transaction inside a run, a voided transaction equal to the discrepancy, and a shortest run whose span of positions is wider than a longer run's.

**Common mistakes.** Sliding window with negatives; forgetting the empty prefix; storing only the first occurrence of a prefix (gives the longest run, not the shortest); positions within the shift instead of `txns`; letting runs cross shifts; reporting shifts outside `shortfalls`; counting voided transactions in the length.

**Follow-up guidance.** (1) Up to O(n²) runs in a pathological shift (many zero-net stretches); present them grouped by end, shortest first, capped, with the count. (2) Rank by length, by whether the run contains repeated identical amounts (a possible double ring), and by time span; label it as a heuristic. (3) In SQL, window prefix sums per shift and a self-join on `prefix_end - prefix_start = discrepancy` with `start < end`; Spark needs a group-by-shift and a per-group function; skewed busy shifts need care. (4) Pairs of non-overlapping runs: the set of all runs can be quadratic, so this becomes a search over candidate run nets; discuss pruning and why it is usually not worth it.

**Rubric anchors.** 2: correct counts with an O(n²) loop, or O(n) but missing the empty prefix or the shortest-run rule. 3: all tests pass with a prefix-sum hash map. 4: also explains why two pointers fail with refunds and discusses output size and warehouse execution.

**Strong signals.** Asks whether amounts can be negative before choosing an approach; keeps positions in the original list. **Red flags.** Presenting a matching run as proof of theft or naming a person; float money.

## BLK-L1-05

**Reference solution**

```python reference
from math import lcm


def tip_pool(shifts, tips, adjustments):
    tip = {pid: cents for pid, _, cents in tips}
    for pid, cents in adjustments:                 # the last adjustment wins
        tip[pid] = cents
    events = []
    for i, (_, start, end) in enumerate(shifts):
        events.append((start, 1, i))               # equal times: clock-out (0), clock-in (1), tip (2)
        events.append((end, 0, i))
    for j, (_, at, _) in enumerate(tips):
        events.append((at, 2, j))
    events.sort()
    heads, on = [], 0                              # pass 1: people on the clock at each tip
    for _, kind, _ in events:
        if kind == 2:
            heads.append(on)
        else:
            on += 1 if kind == 1 else -1
    scale = lcm(*{h for h in heads if h}) if any(heads) else 1
    unit = {h: scale // h for h in set(heads) if h}   # exact: every head count divides scale
    run, opened, unassigned, h = 0, {}, 0, 0      # pass 2: running per-head total, scaled
    total = {m: 0 for m, _, _ in shifts}
    for _, kind, i in events:
        if kind == 2:
            cents = tip[tips[i][0]]
            if heads[h]:
                run += cents * unit[heads[h]]
            else:
                unassigned += cents
            h += 1
        elif kind == 1:
            opened[i] = run
        else:
            total[shifts[i][0]] += run - opened.pop(i)
    payouts = {m: (2 * s + scale) // (2 * scale) for m, s in total.items()}   # half a cent up
    return payouts, unassigned
```

**Explanation.** The running total `run` is what one person continuously on the clock would have earned so far; each tip raises it by `tip / heads`. A shift's share is `run` at clock-out minus `run` at clock-in, so a tip costs O(1) no matter how many people share it. Sorting events by `(time, kind)` with clock-out = 0, clock-in = 1, tip = 2 implements the half-open shifts: someone clocking out at `t` is gone before a tip at `t`, someone clocking in is already there. Exactness: the first pass collects the head counts, and everything is scaled by their least common multiple, so every share is an integer and nothing is rounded until each member's total is turned into cents with half up (`(2s + L) // 2L`). A member's shifts add into one total before that single rounding. Adjustments simply replace the tip amount before the sweep; the split still uses the heads at the payment's `paid_at`.

**Complexity.** O((n + m) log(n + m)) for the sort and O(n + m) big-integer additions (the scale is a few hundred digits at most here). The timing test (200 000 tips, about 36 000 shifts, a few hundred on the clock at busy times) runs in about 0.7–1.0 s in CPython. Scanning every shift for every tip is O(n·m), about 7·10⁹ checks. The likely middle approach — the same sweep but keeping a set of who is on the clock and adding each tip to each of them — is O(n·k) and took about 13–15 s even with scaled integers (longer with `Fraction`), so it fails the 8-second limit.

**Dialect notes.** Java: `BigInteger` or `long` with a known bound on head counts, events sorted with a comparator on `(time, kind)`; C++ similar with `__int128` if the scale fits. In SQL the same idea is a window running sum of `tip / heads` over events, read at each shift's clock-in and clock-out; exactness needs `NUMERIC`.

**Edge cases built into the tests.** A tip at a clock-in second (shared) and at a clock-out second (not); three 1.00 tips among three people (exactly 1.00 each, not 0.99); half a cent rounding up; a tip with nobody on the clock; a member with nothing. Hard: a member's two shifts summed before rounding; clock-out and clock-in at the same second. Very Hard: two adjustments to one payment (the last wins), and a tip adjusted to 0 that would otherwise have been unassigned.

**Common mistakes.** Rounding each tip; floats; inclusive clock-out; processing tips before clock-ins at the same time; rounding per shift instead of per member; dropping members with no tips; applying the first adjustment; visiting everyone on the clock per tip.

**Follow-up guidance.** (1) Largest remainder: floor every member's exact total, then give the leftover cents one by one to the largest fractional parts (ties by a stated rule), so the sum matches the pool exactly; publish the rule. (2) Weighted shares: raise the running total by `tip / total_points` and multiply a shift's difference by its points. (3) Store the running total at every event (or per hour) so an edited shift only needs the totals at its old and new boundaries; tips in the changed window change their head counts, so those windows are recomputed. (4) Validate that a member's shifts never overlap at clock-in time; in the model, a constraint per member on time ranges (an exclusion constraint in PostgreSQL).

**Rubric anchors.** 2: correct small cases with per-tip scans or per-tip rounding errors. 3: all tests pass with a sweep and exact arithmetic. 4: also reconciles cents with largest remainder and handles weighted pools and late edits.

**Strong signals.** Asks how shares are rounded before coding; spots the equal-time ordering. **Red flags.** Float money; treating this exercise's pooling rule as legal or payroll advice.
