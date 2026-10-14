# Apple · Loop 1 — evaluator notes (hidden from candidates)

## APL-L1-01

**Reference solution** (PostgreSQL; `{{window_h}}` is the attribution window in hours, 0 when the round has none, and `{{min_viewers}}` the floor, 1 below Very Hard)

```sql reference
WITH ranked AS (
  SELECT d.*,
         ROW_NUMBER() OVER (PARTITION BY account_id, app_id
                            ORDER BY downloaded_at, download_id) AS n
  FROM downloads d
), first_dl AS (
  SELECT download_id, account_id, app_id, storefront, downloaded_at
  FROM ranked
  WHERE n = 1
), credited AS (
  SELECT f.app_id, f.storefront, v.source
  FROM first_dl f
  CROSS JOIN LATERAL (
    SELECT pv.source
    FROM page_views pv
    WHERE pv.account_id = f.account_id
      AND pv.app_id = f.app_id
      AND pv.storefront = f.storefront
      AND pv.viewed_at <= f.downloaded_at
      AND ({{window_h}} = 0
           OR pv.viewed_at >= f.downloaded_at - make_interval(hours => {{window_h}}))
    ORDER BY pv.viewed_at DESC, pv.view_id DESC
    LIMIT 1
  ) v
), viewers AS (
  SELECT app_id, storefront, source, COUNT(DISTINCT account_id) AS viewers
  FROM page_views
  GROUP BY app_id, storefront, source
), conv AS (
  SELECT app_id, storefront, source, COUNT(*) AS downloads
  FROM credited
  GROUP BY app_id, storefront, source
)
SELECT v.app_id, v.storefront, v.source, v.viewers,
       COALESCE(c.downloads, 0) AS downloads,
       ROUND(COALESCE(c.downloads, 0)::numeric / v.viewers, 4) AS conversion_rate
FROM viewers v
LEFT JOIN conv c
  ON c.app_id = v.app_id AND c.storefront = v.storefront AND c.source = v.source
WHERE v.viewers >= {{min_viewers}}
ORDER BY v.app_id, v.storefront, v.source;
```

**Explanation.** Decide first-time downloads before anything else: `ROW_NUMBER` per account and app over every storefront, with `download_id` as the tie-break, so a reinstall, a download in a second storefront and a row logged twice in one second are all re-downloads. Each first-time download then picks exactly one view: the latest at or before it, in its own storefront, inside the window when there is one, with `view_id` breaking a same-second tie. `CROSS JOIN LATERAL` drops downloads with no qualifying view, which is the "unattributed" rule. The denominator is computed independently as distinct accounts per page and source, and the credited downloads are LEFT JOINed onto it so sources without conversions stay in the report with 0.

**Complexity.** One sort for the download ranking, then one index-friendly probe per first-time download (an index on `page_views (account_id, app_id, storefront, viewed_at DESC, view_id DESC)` makes each probe a short range scan), plus a hash aggregate over views: O(V log V + D log V).

**Dialect notes** (described, not executed). BigQuery: no `LATERAL`; join first-time downloads to views on the keys and the time condition, then `QUALIFY ROW_NUMBER() OVER (PARTITION BY download_id ORDER BY viewed_at DESC, view_id DESC) = 1`; `TIMESTAMP_SUB(downloaded_at, INTERVAL {{window_h}} HOUR)`. Snowflake: `QUALIFY` the same way, or `LATERAL` with a correlated subquery (supported in limited forms); `DATEADD(hour, -{{window_h}}, downloaded_at)`. Spark SQL: a join plus `row_number()` in a subquery; `downloaded_at - INTERVAL {{window_h}} HOURS`. MySQL 8: `LATERAL` is supported from 8.0.14; otherwise the join-and-rank form; `DATE_SUB(downloaded_at, INTERVAL {{window_h}} HOUR)`.

**Edge cases built into the data.** Several views from different sources before a download; downloads before any view (unattributed); downloads between two views; a view in the download's second; re-downloads days later after another look at the page; groups with no conversions. Hard: views exactly {{window_h}} hours before the download (credited) and one second older (unattributed); an earlier download in a second storefront. Very Hard: the same download logged twice in one second; two views in one second from different sources; groups below the floor.

**Common mistakes.** Counting every download; partitioning the first-download ranking by storefront; crediting the first view; `COUNT(*)` of views as the denominator; `<` instead of `<=` on the view time or the window; an INNER JOIN that loses zero rows; `NOT EXISTS (earlier download with downloaded_at <)` which keeps both copies of a duplicated download; tie-breaking views by the lowest `view_id`; integer division.

**Follow-up guidance.** (1) Either is defensible if stated: by download date the rate's numerator and denominator come from different days, so a daily rate should use views of the day and conversions within the window from them (a cohort by view date), and the latest days are immature. (2) Report models side by side with their definitions; first-touch credits discovery, last-touch credits the final nudge; disagreements are expected and not errors. (3) Aggregate counts only, with a minimum group size or added noise, no cross-session linking; report signed-out traffic as its own segment. (4) Partition both tables by account hash and day, keep only each account's last view per page in a rolling window (a small state table), and join downloads to that state rather than to raw views.

**Rubric anchors.** 2: right shape, but re-downloads counted or credit to the first view. 3: matches the expected result. 4: also discusses cohort dating, multiple attribution models and signed-out traffic with a privacy floor.

**Strong signals.** Asks what counts as a re-download and which view gets credit before writing SQL; builds the denominator separately; tests a same-second view. **Red flags.** Joining all views to all downloads and counting rows; dividing downloads by views across the whole app; presenting the exercise's attribution rule as how a real store attributes downloads.

## APL-L1-02

**Reference solution** (PostgreSQL; `{{n_days}}` is the recovery window and `{{as_of}}` the snapshot time)

```sql reference
WITH ev AS (
  SELECT e.*,
         SUM(CASE WHEN e.event_type IN ('renewed', 'expired') THEN 1 ELSE 0 END)
           OVER (PARTITION BY e.subscription_id ORDER BY e.event_ts, e.event_id
                 ROWS UNBOUNDED PRECEDING) AS grp
  FROM billing_events e
), opened AS (
  SELECT DISTINCT ON (subscription_id, grp)
         subscription_id, grp, plan_id, event_ts AS start_ts
  FROM ev
  WHERE event_type = 'renewal_failed'
  ORDER BY subscription_id, grp, event_ts, event_id
), episodes AS (
  SELECT o.plan_id, s.storefront, p.grace_days, o.start_ts,
         c.event_type AS closed_by, c.event_ts AS closed_ts
  FROM opened o
  JOIN subscriptions s ON s.subscription_id = o.subscription_id
  JOIN plans p ON p.plan_id = o.plan_id
  LEFT JOIN ev c
    ON c.subscription_id = o.subscription_id
   AND c.grp = o.grp + 1
   AND c.event_type IN ('renewed', 'expired')
  WHERE o.start_ts + make_interval(days => {{n_days}}) <= TIMESTAMPTZ '{{as_of}}'
), flagged AS (
  SELECT plan_id, storefront,
         COALESCE(closed_by = 'renewed'
                  AND closed_ts <= start_ts + make_interval(days => {{n_days}}), false) AS rec,
         COALESCE(closed_by = 'renewed' AND grace_days > 0
                  AND closed_ts <= start_ts + make_interval(days => grace_days), false) AS in_grace
  FROM episodes
)
SELECT plan_id, storefront,
       COUNT(*)                                   AS entered,
       COUNT(*) FILTER (WHERE rec)                AS recovered,
       COUNT(*) FILTER (WHERE rec AND in_grace)   AS recovered_in_grace,
       ROUND(COUNT(*) FILTER (WHERE rec)::numeric / COUNT(*), 4) AS recovery_rate
FROM flagged
GROUP BY plan_id, storefront
ORDER BY plan_id, storefront;
```

**Explanation.** The running count of closing events (`renewed` or `expired`) splits each subscription's history into stretches; a stretch's first `renewal_failed` opens an episode, and later failures in the same stretch are retry attempts. The closing event that ends the stretch carries the next count, which is how the episode finds its close without a correlated subquery; an open episode has no such row and stays unrecovered through the LEFT JOIN. A `renewed` before any failure is in a stretch with no failure and recovers nothing; after an `expired`, a new purchase's `renewed` sits in a stretch with no failure too. The window is measured from the opening failure, so the grace period is inside it; both comparisons are on timestamps with intervals, inclusive. The maturity filter (`start + {{n_days}} days <= as_of`) only removes episodes in Very Hard rounds. The plan is the one on the opening failure.

**Complexity.** One sort per subscription for the window function (O(E log E) overall), a `DISTINCT ON` sort and a hash join: near-linear in events. Partitioning by subscription parallelises cleanly.

**Dialect notes** (described, not executed). BigQuery: the same running `SUM` window; `QUALIFY ROW_NUMBER() OVER (PARTITION BY subscription_id, grp ORDER BY event_ts, event_id) = 1` for `DISTINCT ON`; `TIMESTAMP_ADD(start_ts, INTERVAL {{n_days}} DAY)` (and an `INTERVAL grace_days DAY` with a column is allowed); `COUNTIF`. Snowflake: `QUALIFY`, `DATEADD(day, {{n_days}}, start_ts)`, `COUNT_IF`; `CONDITIONAL_TRUE_EVENT(event_type IN ('renewed','expired'))` is a compact alternative to the running sum. Spark SQL: `sum(...) over (...)`, `row_number()` in a subquery, `start_ts + make_interval(0, 0, 0, grace_days)`. MySQL 8: window functions are available; `DATE_ADD(start_ts, INTERVAL grace_days DAY)`; `SUM(CASE …)` instead of `FILTER`.

**Edge cases built into the data.** Retry attempts inside an episode; recoveries inside the grace period, after it but inside the window, and after the window; expiries; episodes still open; a plan with no grace period; ordinary renewals before failures. Hard: several episodes per subscription; recoveries exactly at `grace_days` and exactly at {{n_days}} days (counted) and one second after; a purchase after an expiry. Very Hard: plan changes between episodes; an episode exactly {{n_days}} days old on as_of (counted) and one a day younger (left out).

**Common mistakes.** Counting every `renewal_failed` as an entry; taking the next event (`LEAD`) as the close when it is another failure; starting the window at the end of the grace period; any later `renewed` counted as a recovery, including after expiry or after the window; comparing dates instead of timestamps; `COUNT(DISTINCT subscription_id)` (a subscription can enter retry twice); the subscription's latest plan; including immature episodes.

**Follow-up guidance.** (1) Recent cohorts have not had their full window, so their recovery is right-censored; show only mature cohorts, or show recent ones with "so far" and a survival curve. (2) Compare cohorts entering just before and after the change (with seasonality controls such as last year's same period), or an experiment where the setting differs by app or storefront; state the confounders. (3) Key notifications by a unique notification or transaction id, upsert raw events, and rebuild episodes for affected subscriptions from the ordered raw events, so arrival order never matters. (4) Keep per-subscription state (open episode start, plan) and apply each day's events in order; only subscriptions with new events are touched, and closed episodes are immutable.

**Rubric anchors.** 2: right structure, but every failure counted, or the window measured from the end of grace. 3: matches the expected result. 4: also handles cohort maturity, the measurement of a grace-period change and idempotent ingestion credibly.

**Strong signals.** Draws the state machine (not in retry → in retry → closed) before writing SQL; asks whether grace is inside the window; tests the exact boundary. **Red flags.** A self-join of every failure with every later renewal; treating the episode count as subscriptions; stating the exercise's retry or grace lengths as a store's actual policy.

## APL-L1-03

**Reference solution** (PostgreSQL; `{{min_ms}}` is the listen threshold, 0 when every play counts, and `{{min_listeners}}` the floor)

```sql reference
WITH listens AS (
  SELECT listener_id, track_id, MIN(played_at) AS first_listen
  FROM plays
  WHERE ms_played >= {{min_ms}}
  GROUP BY listener_id, track_id
), first_add AS (
  SELECT listener_id, track_id, MIN(added_at) AS added_at
  FROM library_adds
  GROUP BY listener_id, track_id
), pairs AS (
  SELECT l.listener_id, l.track_id,
         (a.added_at IS NOT NULL
          AND a.added_at <= l.first_listen + INTERVAL '7 days') AS added
  FROM listens l
  LEFT JOIN first_add a
    ON a.listener_id = l.listener_id AND a.track_id = l.track_id
  WHERE a.added_at IS NULL OR a.added_at >= l.first_listen
)
SELECT g.genre,
       COUNT(DISTINCT p.listener_id)          AS listeners,
       COUNT(*)                               AS pairs,
       COUNT(*) FILTER (WHERE p.added)        AS added,
       ROUND(COUNT(*) FILTER (WHERE p.added)::numeric / COUNT(*), 4) AS add_rate
FROM pairs p
JOIN track_genres g ON g.track_id = p.track_id
GROUP BY g.genre
HAVING COUNT(DISTINCT p.listener_id) >= {{min_listeners}}
ORDER BY add_rate DESC, g.genre;
```

**Explanation.** Everything is decided at the pair grain. The first listen ignores previews (below the threshold), so a preview neither starts the clock nor makes an add "after listening". The earliest add is the only add that matters: before the first listen means the track was already saved, and the pair leaves both the numerator and the denominator (the `WHERE` runs before aggregation); otherwise the add counts if it is within seven days, inclusive at both ends. Pairs join to genres last, so a track in two genres contributes to both, and the floor counts distinct listeners, not pairs.

**Complexity.** Two hash aggregates (plays and adds) and a hash join at the pair grain, then a small aggregate per genre: O(P + A). At scale, the pair table is the one to keep incrementally.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_ADD(first_listen, INTERVAL 7 DAY)`, `COUNTIF(added)`, `COUNT(DISTINCT …)` is exact (use `APPROX_COUNT_DISTINCT` only if approximate is acceptable, which it is not for a floor). Snowflake: `DATEADD(day, 7, first_listen)`, `COUNT_IF`. Spark SQL: `first_listen + INTERVAL 7 DAYS`, `count_if`. MySQL 8: `DATE_ADD(first_listen, INTERVAL 7 DAY)`, `SUM(added)` with booleans as integers.

**Edge cases built into the data.** Adds in the same second as the first listen and exactly seven days later (both count) and one second after (does not); adds before the first listen, some followed by another add later; pairs never added; adds of tracks never played; a small genre whose pair count reaches the floor while its listener count does not. Hard: previews before the first listen, previews of exactly `min_ms - 1` ms and listens of exactly `min_ms` ms; adds after a preview but before the first listen (excluded); tracks only previewed (no pair); a track re-added weeks later. Very Hard: tracks in two genres.

**Common mistakes.** Keeping pre-added pairs as "not added"; using the latest or any add; an exclusive window; starting the clock at a preview; flooring on pairs; counting a two-genre track once; an INNER JOIN to adds that drops pairs never added; ordering by the unrounded value with a different tie-break; integer division.

**Follow-up guidance.** (1) Album: the pair is listener × album, the first listen is the first qualifying play of any of its tracks; the add is the album or any of its tracks, which must be defined. (2) Use play time for the clock but process by arrival, recompute pairs touched by late plays, and freeze published numbers after a stated lateness bound (or publish revisions). (3) A listener floor limits re-identification of individuals but not of small cohorts in small storefronts; add storefront-level minimums, suppression of complementary cells and, if needed, noise. (4) Keep a pair table with first listen and earliest add, update it from each day's new plays and adds with `LEAST`, and recompute only genres touched.

**Rubric anchors.** 2: right shape, but pre-added pairs kept or the floor on pairs. 3: matches the expected result. 4: also discusses late plays, privacy floors beyond a count, and the incremental pair table.

**Strong signals.** Asks what happens to tracks saved before the first listen; reduces to the pair grain before joining genres. **Red flags.** Joining every play to every add; averaging per-listener rates without saying so; claiming the listen threshold is a real service's rule.

## APL-L1-04

**Reference solution**

```python reference
from bisect import bisect_right


def current_lines(lines, positions, duration_ms=None):
    shown = {}                          # start -> index of the line listed last with that start
    for i, (start, _end) in enumerate(lines):
        shown[start] = i
    starts = sorted(shown)
    index = [shown[s] for s in starts]
    ends = [lines[i][1] for i in index]
    out = []
    for p in positions:
        if duration_ms:
            p %= duration_ms
        k = bisect_right(starts, p) - 1     # the last start at or before p
        out.append(index[k] if k >= 0 and p < ends[k] else -1)
    return out
```

**Explanation.** Lines (after corrections) do not overlap, so at any position the only line that can be on screen is the one with the largest start at or before it. A dict filled in input order resolves corrections (the later listing overwrites the earlier one), sorting the surviving starts once gives a searchable array, and `bisect_right(starts, p) - 1` finds the candidate in O(log n): `bisect_right` puts a position equal to a start on that line. The half-open end check turns a gap or a line's exact end into -1. Repeat-one positions are reduced modulo the duration first, so a position equal to `duration_ms` is the start of the song.

**Complexity.** O(n log n) to sort, O(log n) per position: O((n + q) log n) time, O(n) memory. The timing test (50 000 lines, 200 000 positions with a seek about every 8 samples) runs in well under a second; checking every line per position is 10¹⁰ steps, and a forward-moving pointer that resets on each backward seek still walks about 6 × 10⁸ lines (over 40 s in CPython).

**Common mistakes.** `bisect_left` (a position exactly at a start gets the previous line); closed intervals (a line still shown at its end); returning the index into the sorted list; keeping the first of two lines with the same start; forgetting that a correction can be shorter and leave a gap; a pointer that assumes positions only move forward; wrapping with `p % duration_ms` only when `p > duration_ms` (misses `p == duration_ms`).

**Follow-up guidance.** (1) Keep the current index and check `starts[k] <= p < starts[k+1]` first (the usual case during playback), falling back to a binary search on a seek. (2) An interval tree or a sorted list of starts with a max-end augmentation returns all k covering intervals in O(log n + k); for a handful of overlapping singers, one sorted list per singer is simpler. (3) Shift positions by the offset rather than every line (`p - offset`), keeping integer milliseconds so boundaries stay exact. (4) Per-song jobs are embarrassingly parallel; compare line starts with detected vocal onsets and report the median and spread of the offset, flagging files beyond a threshold.

**Rubric anchors.** 2: correct output with a scan per position, or an off-by-one at the boundaries. 3: correct with one sort and binary search, with a clear complexity argument. 4: also discusses the playback fast path, overlapping lines and batch timing quality credibly.

**Strong signals.** Asks whether intervals are half-open and whether positions can go backwards; mentions `bisect_right` versus `bisect_left` deliberately. **Red flags.** Sorting the positions and returning them in sorted order; mutating `lines` and losing the original indexes.

## APL-L1-05

**Reference solution**

```python reference
import calendar
from datetime import date


def renewals(plans, subs, as_of):
    end = date.fromisoformat(as_of)

    def on(month_index, day):                 # the anchor day, clamped to the month's last day
        y, m = divmod(month_index, 12)
        return date(y, m + 1, min(day, calendar.monthrange(y, m + 1)[1]))

    def first_after(start, day, months, t):   # first renewal strictly after t, in O(1)
        k = max(1, (t.year * 12 + t.month - 1 - start) // months)
        d = on(start + k * months, day)
        if d <= t:
            d = on(start + (k + 1) * months, day)
        return d

    out = []
    for purchase, plan, changes in subs:
        p = date.fromisoformat(purchase)
        if p > end:
            out.append(None)
            continue
        start, day = p.year * 12 + p.month - 1, p.day
        pending = pending_at = None
        for when, new in changes:
            c = date.fromisoformat(when)
            if c > end:
                break
            if pending is not None and pending_at <= c:          # that renewal came first
                start = pending_at.year * 12 + pending_at.month - 1
                plan, pending = pending, None
            if plans[new][0] > plans[plan][0]:                   # upgrade: a new period today
                plan, pending = new, None
                start, day = c.year * 12 + c.month - 1, c.day
            elif plans[new][0] < plans[plan][0]:                 # downgrade: at the next renewal
                pending = new
                pending_at = first_after(start, day, plans[plan][1], c)
            else:                                                # kept the plan in effect
                pending = None
        if pending is not None and pending_at <= end:
            start = pending_at.year * 12 + pending_at.month - 1
            plan, pending = pending, None
        if pending is not None:
            out.append((pending_at.isoformat(), pending))
        else:
            out.append((first_after(start, day, plans[plan][1], end).isoformat(), plan))
    return out
```

**Explanation.** A schedule is three numbers: the period start as a month index, the anchor day and the period length. Renewal k is in month `start + k × months` on the clamped anchor day, so renewals never drift (31 January → 28 February → 31 March), and the first renewal after any date is found directly: `(month_index(t) - start) // months` lands on the renewal in or before t's month, and at most one step forward fixes the same-month case. Changes are applied in date order; a pending downgrade is resolved first if its renewal falls on or before the change date (renewals come before same-day changes), then the change is compared with the plan really in effect. An upgrade resets the schedule to the change date; a downgrade records its effective renewal (which cannot move, because no renewal falls between the request and it); re-choosing the plan in effect cancels it. Whatever is still pending at `as_of` is exactly the next renewal, with the new plan.

**Complexity.** O(1) per subscription plus O(1) per change, O(n + c) overall; memory O(n) for the output. The timing test (150 000 subscriptions with synthetic purchases since 1980, mostly monthly) runs in about a second; stepping renewal by renewal is around 5 × 10⁷ date computations (close to a minute in CPython).

**Common mistakes.** Adding 30 days, or one month to the previous renewal (the anchor drifts to the 28th); `<=` instead of `<` for "after as_of"; an upgrade that keeps the old anchor or period start; a downgrade applied immediately, or at a renewal on the same day as the request; comparing a change with the pending plan instead of the plan in effect; forgetting that an upgrade or re-choosing cancels a pending downgrade; applying changes dated after `as_of`; returning a date for a subscription bought after `as_of`; `calendar.monthrange` called with a zero-based month.

**Follow-up guidance.** (1) For each subscription compute the first renewal in the window directly, then step only within the 90 days (at most three monthly steps); or generate month indexes with a numbers table and clamp in SQL. (2) Prorate by days remaining over days in the old period (actual/actual), credit that fraction of the old price against the new one, and agree rounding to minor units with finance; state that real stores have their own rules. (3) "Previous plus one month" drifts permanently after the first short month (31 → 28 → 28); store the anchor day or the original date, never only the last renewal. (4) Keep the anchor as a date in the storefront's or account's chosen time zone (or a UTC instant with a stated zone); the function stays date-only, but the conversion to a local date at purchase decides the anchor.

**Rubric anchors.** 2: correct for simple monthly cases but drifting anchors, or a period-by-period loop. 3: correct on all rules with O(1) per subscription and a clear argument. 4: also credible on proration, materialising future renewals and time zones.

**Strong signals.** Asks about the 31st and 29 February before coding; represents the schedule as (start, anchor day, length) rather than a last date; tests a downgrade requested on a renewal day. **Red flags.** `relativedelta` from the previous renewal without noticing the drift; presenting the exercise's upgrade and downgrade rules as a real store's guarantee.
