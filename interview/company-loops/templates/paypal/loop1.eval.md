# PayPal · Loop 1 — evaluator notes

Reference solutions and guidance for interviewers. Simulated practice scenarios; every
number and rule is hypothetical, and money is integer minor units.

## PYP-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH posted AS (                       -- payments that reached the feed
  SELECT payment_id, sender_id, created_at, audience_override
  FROM p2p_payments
  WHERE status = 'completed'
), resolved AS (                       -- one audience per payment
  SELECT po.payment_id, po.created_at,
         COALESCE(po.audience_override,
                  (SELECT s.default_audience
                   FROM feed_settings s
                   WHERE s.user_id = po.sender_id AND s.changed_at <= po.created_at
                   ORDER BY s.changed_at DESC, s.change_id DESC
                   LIMIT 1),
                  {{initial_sql}}) AS audience
  FROM posted po
)
SELECT date_trunc('month', created_at AT TIME ZONE 'UTC')::date                              AS month,
       COUNT(*)                                                                             AS payments,
       ROUND(COUNT(*) FILTER (WHERE audience = 'public')::numeric  / COUNT(*), 4)           AS public_share,
       ROUND(COUNT(*) FILTER (WHERE audience = 'friends')::numeric / COUNT(*), 4)           AS friends_share,
       ROUND(COUNT(*) FILTER (WHERE audience = 'private')::numeric / COUNT(*), 4)           AS private_share
FROM resolved
GROUP BY 1
ORDER BY 1;
```

`{{initial_sql}}` is `NULL` at Medium (every sender has an earlier row) and the instance's initial default, e.g. `'friends'`, at Hard and Very Hard; a candidate writes the literal. The `audience_edits` table of Very Hard is deliberately unused.

**Explanation.** The grain is the payment, so the query first resolves exactly one audience per payment and only then aggregates. Precedence is written once with `COALESCE`: the override chosen on the payment, else the sender's default in force at `created_at`, else this exercise's initial default. "In force" is an as-of lookup: the sender's latest setting row at or before the payment, with `change_id` breaking a tie between two rows at the same second. The initial default sits in the `COALESCE`, not in a join, so payments made before the sender's first setting row are kept. Declined payments never reached the feed and are filtered before anything else. Later edits change what a payment shows today, not what it was posted with, so they are ignored.

**Complexity.** One correlated lookup per payment; with an index on `feed_settings (user_id, changed_at DESC, change_id DESC)` each is a single index probe, O(p log s). A set-based alternative builds validity ranges with `LEAD(changed_at) OVER (PARTITION BY user_id ORDER BY changed_at, change_id)` and range-joins `valid_from <= created_at < valid_to`; at scale both become a sort-merge "as-of" join per user.

**Dialect notes** (described, not executed). Snowflake: `ASOF JOIN … MATCH_CONDITION (p.created_at >= s.changed_at)` expresses the lookup directly; `DIV0`; `COUNT_IF`. BigQuery: no as-of join; use the `LEAD` validity ranges or `ARRAY_AGG(… ORDER BY changed_at DESC LIMIT 1)[OFFSET(0)]` in a correlated subquery; `COUNTIF`; `DATE_TRUNC(DATE(created_at), MONTH)`. Spark SQL: validity ranges and a range join, or `max_by(default_audience, struct(changed_at, change_id))` over joined rows. MySQL 8: the correlated `ORDER BY … LIMIT 1` works; no `FILTER`, so `SUM(audience = 'public')`.

**Edge cases built into the data.** Every level: overrides that differ from the default; senders whose setting changed several times during the quarter; payments in the last seconds of July and the first seconds of August. Hard: declined payments; two senders whose first setting row comes after some of their payments (initial default); a setting changed at exactly a payment's `created_at` (in force). Very Hard: two rows of one user at the same `changed_at` followed by a payment (the higher `change_id` wins), and `audience_edits` rows that would change the answer if applied.

**Common mistakes.** Using the sender's current setting; `changed_at < created_at`; an inner join (or a join on validity ranges without an open-ended last range) that drops payments; ignoring the override, or applying the default over it; counting declined payments; applying later edits; integer division; ties resolved by whatever order the engine returns.

**Follow-up guidance.** (1) `valid_from = changed_at`, `valid_to = LEAD(changed_at)` ordered by `(changed_at, change_id)`, half-open `[valid_from, valid_to)`, NULL `valid_to` meaning open-ended; rows at the same second produce an empty range for the earlier one, which is correct and harmless with a half-open test. (2) The engine should sort payments and settings by `(user_id, time)` and merge; a daily snapshot of settings per user is cheaper still when settings change rarely. (3) Keep the posted audience on the payment (immutable) and model edits as an audience history per payment; "currently visible" is the latest edit or the posted value. (4) Join each public payment to the sender's setting changes to private within the 30 days before it; define whether a later switch back counts.

**Rubric anchors.** 2: shares per month correct only when nothing changed during the quarter (current setting, or no override). 3: matches the expected result. 4: also explains validity ranges, the as-of join at scale and the posted-versus-current distinction.

**Strong signals.** Asks whether the setting in force or the current setting is wanted before writing SQL; states the precedence as one rule. **Red flags.** Treating the report as a view of any individual's activity; "just use the latest setting".

## PYP-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH current_state AS (                -- one row per transfer: its latest status row
  SELECT DISTINCT ON (transfer_id) *
  FROM transfers
  ORDER BY transfer_id, updated_at DESC
), counted AS (
  SELECT * FROM current_state WHERE status <> 'cancelled'
)
SELECT date_trunc('week', c.sent_at AT TIME ZONE 'UTC')::date                         AS week_start,
       c.send_currency,
       c.receive_currency,
       COUNT(*)                                                                       AS transfers,
       COUNT(c.available_at)                                                          AS available,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM c.available_at - c.sent_at) / 60)
         FILTER (WHERE c.available_at IS NOT NULL)                                    AS median_minutes,
       ROUND(SUM(c.send_amount_minor)::numeric / power(10::numeric, cs.minor_exponent), cs.minor_exponent) AS sent_total,
       ROUND(COALESCE(SUM(c.receive_amount_minor) FILTER (WHERE c.available_at IS NOT NULL), 0)::numeric
             / power(10::numeric, cr.minor_exponent), cr.minor_exponent)              AS received_total
FROM counted c
JOIN currencies cs ON cs.currency = c.send_currency
JOIN currencies cr ON cr.currency = c.receive_currency
GROUP BY 1, c.send_currency, c.receive_currency, cs.minor_exponent, cr.minor_exponent
ORDER BY 1, 2, 3;
```

**Explanation.** First fix the grain: at Very Hard the table is a status log, so `DISTINCT ON` keeps each transfer's latest row (at Medium and Hard it is already one row per transfer and the step is harmless). Cancelled transfers are removed after choosing the current state — a transfer that was pending and then cancelled is cancelled. Each measure then has its own population inside one `GROUP BY`: `transfers` and `sent_total` over counted transfers, `available`, the median and `received_total` over those with an `available_at`. Amounts are summed in minor units and scaled once by `10 ^ exponent` of their own currency, joined twice, in numeric; nothing is ever converted between currencies. `percentile_cont` interpolates, so an even count yields the mean of the two middle values, and an empty filtered set yields NULL.

**Complexity.** A sort for `DISTINCT ON` (O(r log r) over log rows), two tiny hash joins, and a sort per group for the percentile. Exact medians need the group's values; at scale use a daily pre-aggregate of counts and sums plus an approximate quantile sketch (t-digest, KLL) for speed.

**Dialect notes** (described, not executed). BigQuery: `QUALIFY ROW_NUMBER() OVER (PARTITION BY transfer_id ORDER BY updated_at DESC) = 1`; `DATE_TRUNC(DATE(sent_at), ISOWEEK)` for Monday weeks (`WEEK` alone starts on Sunday); `PERCENTILE_CONT(x, 0.5) OVER (…)` is analytic only, or `APPROX_QUANTILES`; `NUMERIC`/`BIGNUMERIC` with `POW(10, e)`. Snowflake: `QUALIFY`, `DATE_TRUNC('week', …)` depends on `WEEK_START`; `MEDIAN()`; `DIV0`. Spark SQL: `percentile(x, 0.5)` is exact and interpolates, `percentile_approx` does not; `date_trunc('week', …)` is Monday-based. MySQL 8: no percentile function; a `ROW_NUMBER`/`COUNT` window trick finds the middle rows.

**Edge cases built into the data.** Every level: one corridor with a zero-exponent currency and one with a three-exponent currency; transfers sent on Sunday 23:5x and Monday 00:0x UTC; even and odd counts per group (interpolated medians). Hard: pending transfers (counted, not available), cancelled ones (excluded), and a corridor-week in which nothing is available yet (NULL median, received 0). Very Hard: every transfer has a creation row and a final row; some available transfers are touched again later; cancelled transfers whose earlier row was pending.

**Common mistakes.** Dividing everything by 100; floating-point money; converting currencies; `AVG` instead of the median; medians including NULL-available transfers as 0; counting cancelled transfers; `received_total` over pending transfers; Sunday weeks; counting log rows instead of transfers, or taking the first row.

**Follow-up guidance.** (1) Convert each transfer once at a rate tied to a timestamp (the quote used, or a stated daily rate), round once with a stated rule in the target currency's exponent, then sum; converting summed totals hides rounding and mixes rates across the week. (2) A p90 or p95 of minutes and the count of transfers over a stated threshold; alert when a corridor-week's p90 exceeds its trailing baseline by a margin with a minimum volume. (3) Upsert a current-state table keyed by `transfer_id`, applying a row only if its `updated_at` is newer (a version check), so out-of-order arrivals cannot regress the state. (4) Recompute affected weeks and publish versioned snapshots; mark weeks provisional until late statuses have settled.

**Rubric anchors.** 2: right counts but money scaled by 100 or medians wrong, or log rows counted. 3: matches the expected result. 4: also handles reporting-currency conversion, tail metrics and out-of-order status rows credibly.

**Strong signals.** Reads `currencies` before writing arithmetic; names each column's population. **Red flags.** "Store amounts as floats in dollars"; converting all corridors into one currency without rates and timestamps.

## PYP-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH per_plan AS (                     -- one row per counted plan
  SELECT pl.plan_id, pl.purchase_cents, pl.final_due_date,
         COALESCE(SUM(po.amount_cents), 0)                                   AS paid,
         (MAX(po.paid_at) AT TIME ZONE {{tz_sql}})::date                     AS last_paid_date,
         COUNT(po.payment_id) FILTER (WHERE po.kind = 'extra')               AS extras,
         COALESCE(SUM(po.amount_cents) FILTER (WHERE po.kind = 'extra'), 0)  AS extra_cents
  FROM paylater_plans pl
  LEFT JOIN plan_payments po
    ON po.plan_id = pl.plan_id AND po.status = 'posted'
  WHERE pl.status = 'active'
  GROUP BY pl.plan_id
)
SELECT b.band_id, b.label,
       COUNT(p.plan_id)                                                          AS plans,
       COUNT(*) FILTER (WHERE p.paid >= p.purchase_cents)                        AS paid_off,
       COUNT(*) FILTER (WHERE p.paid >= p.purchase_cents
                          AND p.last_paid_date < p.final_due_date)               AS paid_off_early,
       ROUND(COUNT(*) FILTER (WHERE p.paid >= p.purchase_cents
                                AND p.last_paid_date < p.final_due_date)::numeric
             / NULLIF(COUNT(p.plan_id), 0), 4)                                   AS early_share,
       COALESCE(SUM(p.extras), 0)                                                AS extra_payments,
       COALESCE(SUM(p.extra_cents), 0)                                           AS extra_cents
FROM amount_bands b
LEFT JOIN per_plan p
  ON p.purchase_cents >= b.lower_cents
 AND (b.upper_cents IS NULL OR p.purchase_cents < b.upper_cents)
GROUP BY b.band_id, b.label
ORDER BY b.band_id;
```

`{{tz_sql}}` is `'UTC'` at Medium and Hard and `pl.time_zone` at Very Hard (grouping by the primary key `pl.plan_id` makes the plan's other columns usable). A candidate writes it directly.

**Explanation.** Two grains, two steps. Per plan: the posted total, the last posted payment's date in the right zone, and the extra payments — with the `status = 'posted'` condition inside the LEFT JOIN so a plan whose only payments were reversed still appears (with 0 paid). Per band: a range join with an inclusive lower and exclusive upper bound, an open top band, and `amount_bands` on the left so empty bands survive; `COUNT(p.plan_id)` counts 0 for them and `NULLIF` turns the share into NULL. Because the sample never overpays, "paid off" is `paid >= purchase_cents` and its moment is the last posted payment; early means that payment's date is strictly before the final due date, a local date at Very Hard.

**Complexity.** One pass over payments with a hash aggregate per plan, then a small range join against a handful of bands: O(p + n·b) with b bands, effectively linear. With many bands, sort plans by amount and bands by lower bound and merge.

**Dialect notes** (described, not executed). BigQuery: `DATE(paid_at, time_zone)`; `COUNTIF`; `SAFE_DIVIDE`; LEFT JOIN with a non-equality condition is allowed. Snowflake: `CONVERT_TIMEZONE(time_zone, paid_at)::date`; `COUNT_IF`; `DIV0NULL`. Spark SQL: `to_date(from_utc_timestamp(paid_at, time_zone))`; a non-equi LEFT JOIN against a small broadcast band table. MySQL 8: no `FILTER`, so `SUM(CASE …)`; `CONVERT_TZ` needs the zone tables loaded; GROUP BY on a primary key also allows the plan's other columns.

**Edge cases built into the data.** Every level: plans paid on schedule (last payment on the final due date, not early), plans paid off early with an extra payment, plans with small extra payments that still finish on the due date, plans that stopped paying, and an empty top band. Hard: cancelled plans with extra payments; a reversed extra payment that would otherwise have paid a plan off; a reversed duplicate of a scheduled payment; purchases exactly on band lower bounds; last payments at 23:59:xx the day before the due date (early) and 00:00:xx on it (not early). Very Hard: plans in Los Angeles paid at 03:00 UTC on the due date (the day before locally: early) and in Tokyo paid at 22:00 UTC the day before (the due date locally: not early).

**Common mistakes.** An inner join (or a WHERE on plan columns after the LEFT JOIN) that drops empty bands; `BETWEEN` bounds; `<=` against the due date; counting reversed payments or cancelled plans; filtering reversed payments in WHERE after the plan-payment LEFT JOIN, losing plans; aggregating payments straight to bands, which counts plans once per payment; UTC dates at Very Hard; `COUNT(*)` for plans in a band with none.

**Follow-up guidance.** (1) Only judge plans whose final due date has passed by the report date (a mature cohort), and show immature plans separately as "paid off so far"; mixing them understates early payoff for recent months. (2) Bands are data: keep band sets versioned (`band_set_id`, valid dates) and parameterise the report by set; old reports name their set. (3) Model a refund as an adjustment that lowers the amount owed (a schedule version) and define "paid off" against the adjusted amount as of each payment. (4) Keep per-plan state (paid total, last posted payment, extras) updated from each day's payments and reversals; band totals are sums of plan states.

**Rubric anchors.** 2: correct for paid-off counts but empty bands missing, inclusive due date, or reversed payments counted. 3: matches the expected result. 4: also discusses mature cohorts and versioned bands and keeps the analysis about the product, not about people.

**Strong signals.** States both grains (plan, band) before writing; asks which time zone a due date is in. **Red flags.** Interpreting early payoff as a judgement of a consumer's means; presenting the schedule as a real product's terms.

## PYP-L1-04

**Reference solution**

```python reference
def mutual_payers(payments, window_days, aliases=None):
    aliases = aliases or {}
    W = window_days * 86400
    counted = []
    for pid, sender, recipient, ts, status in payments:
        if status != 'completed':
            continue
        if recipient not in aliases and ':' in recipient:
            continue                       # an identifier nobody has claimed
        recipient = aliases.get(recipient, recipient)
        if recipient == sender:
            continue
        counted.append((ts, pid, sender, recipient))
    counted.sort()
    last = {}                              # (sender, recipient) -> latest ts so far
    out = {}
    for ts, pid, s, r in counted:
        prev = last.get((r, s))
        if prev is not None and ts - prev <= W:
            key = (s, r) if s < r else (r, s)
            got = out.get(key)
            if got is None:
                out[key] = (pid, ts - prev, 1)
            else:
                out[key] = (got[0], got[1], got[2] + 1)
        last[(s, r)] = ts
    return out
```

**Explanation.** Normalise first: keep completed payments, resolve identifiers through `aliases` (dropping unclaimed ones), and drop payments to oneself. Sort once by `(ts, payment_id)`, which is exactly the "earlier" order of the spec. Walking in that order, the dict `last` holds, for each directed pair, the time of its latest payment so far — so for a payment `u → v`, `last[(v, u)]` is the latest earlier payment the other way. If it is within the window the payment reciprocates, and its gap is measured from exactly that payment. The first reciprocating payment of a pair is the first time this fires; later ones only increase the count. Keys are the sorted pair so both directions land on one entry.

**Complexity.** O(n log n) for the sort and O(n) for the walk, O(n) memory. The timing test (250 000 random payments plus three pairs with 8 000 payments each way, one direction for months and then the other) runs in about 0.5–0.75 s in CPython. Comparing every pair of payments is O(n²) — hours at this size.

**The middle approach.** The most likely middle solution groups payments by directed pair and, for each pair, compares every payment of one direction with every payment of the other: O(a·b) per pair. On the busy pairs that is 2 × 8 000 × 8 000 comparisons each; it took about 45 s in CPython in our timing, well over the 8 s limit. A per-pair solution that sorts both directions and uses `bisect` (or two pointers) to find the latest earlier opposite payment is O(n log n) and passes; so does a backward scan from each payment that stops as soon as it leaves the window, because it never looks past the window. Both are acceptable answers.

**Dialect notes.** Java: `HashMap<String, Long>` keyed by `sender + '\u0000' + recipient`, a `record` for the result, `Long.compare` sort keys. In SQL the rule is a self-join on `(sender, recipient) = (recipient, sender)` with `p2.ts - p1.ts BETWEEN 0 AND W` plus a tie rule on `payment_id`; for the gap use a correlated `MAX`. It is correct but the join is O(a·b) for busy pairs unless the engine does a range (interval) join; a window function over the union of both directions ordered by time — `LAST_VALUE(CASE WHEN direction = 'back' THEN ts END IGNORE NULLS)` — is linear after the sort. Not executed here.

**Edge cases built into the tests.** Exactly `window_days` apart (reciprocates) and one second more (does not); one direction only; the gap from the latest earlier opposite payment; the same second in opposite directions (the higher `payment_id` reciprocates, gap 0); back and forth counting every reciprocating payment, with one outside the window; the key sorted whoever paid first; three users with two pairs; no payments. Hard: unsorted input where list order differs from time order; failed and refunded payments; payments to oneself. Very Hard: an email identifier resolved to its owner, an unclaimed identifier ignored, and a payment to one's own phone identifier ignored.

**Common mistakes.** Measuring the gap from the first opposite payment instead of the latest; exclusive window; picking the first reciprocating payment by list position; ordered keys (two entries per pair); counting the pair's first payment; resolving identifiers after the self-payment check; treating an unclaimed identifier as a user; per-pair nested loops.

**Follow-up guidance.** (1) Keep, per directed pair, the amount (or recent amounts) of the latest payment, and define "roughly" as within a stated number of cents or a stated per-mille of the first amount, in integers. (2) Carry `last` forward, but only entries newer than the window — older ones can never reciprocate again — so the state is bounded by the pairs active in the last `window_days`. (3) Self-join or window over the union of directions as above; the self-join is the explosive one for busy pairs. (4) Build a graph of reciprocating pairs and look at connected groups or a household-like cluster, reported in aggregate only.

**Rubric anchors.** 2: correct with per-pair nested loops, or fast but wrong on ties, the gap or unsorted input. 3: all tests pass with one sort and a dict. 4: also explains bounded incremental state, the SQL formulation and keeps pair data private.

**Strong signals.** Asks what "earlier" means at equal timestamps; normalises before sorting. **Red flags.** Labelling pairs as relationships or exposing pair data to third parties; inferring anything about people from who pays whom.

## PYP-L1-05

**Reference solution**

```python reference
from bisect import bisect_left


def balance_targets(opening_cents, events, targets, end_of_day=False):
    dates, peaks = [], []                  # each new running maximum and the date it was set
    bal = opening_cents
    best = opening_cents
    n = len(events)
    for i, (day, cents) in enumerate(events):
        bal += cents
        if end_of_day and i + 1 < n and events[i + 1][0] == day:
            continue                       # only the day's closing balance counts
        if bal > best:
            best = bal
            dates.append(day)
            peaks.append(bal)
    out = []
    for t in targets:
        if t <= opening_cents:
            out.append('opening')
            continue
        k = bisect_left(peaks, t)
        out.append(dates[k] if k < len(peaks) else None)
    return out
```

**Explanation.** The balance first reaches `t` exactly when the running maximum first reaches `t`, and the running maximum never decreases. Recording only the moments it strictly rises gives a strictly increasing list of values with their dates; `bisect_left` returns the first value at least `t`, whose date is the answer. Targets at or below the opening balance were met before the history began (`'opening'`); targets above every recorded peak are `None`. With `end_of_day`, a balance counts only after the last event of its date, so intraday peaks are skipped before the running maximum sees them.

**Complexity.** O(n) to build the list and O(log n) per target: O(n + q log n), O(n) memory. The timing test (200 000 events, 20 000 targets, about 40% never reached) runs in about 0.02–0.03 s in CPython, plus building the input.

**The middle approach.** The most likely middle solution replays the history per target and breaks at the first hit. It is fast for targets reached early, but each of the roughly 8 000 unreached targets reads all 200 000 events: about 145 s in CPython in our timing, far over the 8 s limit. Sorting the targets and sweeping the history once (answering targets in increasing order as the balance passes them, then restoring input order) is O(n + q log q) and passes; it is an acceptable answer.

**Dialect notes.** Java: `long[]` peaks and `Arrays.binarySearch` (adjust its negative insertion point) or a hand-written lower bound. In SQL: `MAX(balance) OVER (ORDER BY seq)` gives the running maximum; for each target, `MIN(date)` where the running maximum is at least the target — a range join that a warehouse handles by sorting both sides; end-of-day uses the last row per date (`ROW_NUMBER() … DESC = 1`) first. Not executed here.

**Edge cases built into the tests.** A balance exactly equal to the target and one cent short; a peak that falls back (still reached on its date); the first date rather than a later, higher one; a target above every balance; no events; targets out of order. Hard: a target equal to the opening balance (`'opening'`), a dip below the opening balance, repeated targets. Very Hard: an intraday peak spent the same day (reaches nothing), a closing balance that reaches a target after a dip during the day, and several events on the last date.

**Common mistakes.** Bisecting the raw balances (not sorted); appending equal peaks so `bisect_left` returns a later date; strict comparison; returning `None` or the first date for targets met by the opening balance; checking intraday balances in end-of-day mode; answering targets in sorted order rather than input order; a per-target replay.

**Follow-up guidance.** (1) Appending events only appends peaks; answers already given never change, and a cached `None` can become a date. (2) A reversal before the end changes every balance after it: rebuild the peak list from the restated event onwards (everything before is unchanged); a segment tree of (sum, maximum prefix) supports point updates in O(log n) if restatements are frequent. (3) "At least t for 30 consecutive days" is a run-length question over daily closing balances; for many targets, process targets in decreasing order with a structure of maximal runs (or offline with a union of days as the threshold falls). (4) Balances in different currencies cannot be added without a stated conversion; refuse a single "500" across currencies or define the reporting currency, rate and rounding explicitly.

**Rubric anchors.** 2: a per-target replay, or fast but wrong on equality, sentinels or input order. 3: all tests pass with a running maximum and binary search (or a sorted-targets sweep). 4: also explains why the maximum list is sorted and answers the incremental and restatement follow-ups credibly.

**Strong signals.** Notices that "first reached" depends only on the running maximum; asks about equality and the opening balance. **Red flags.** Floats for money; presenting a milestone as financial advice or showing it to anyone but the user.
