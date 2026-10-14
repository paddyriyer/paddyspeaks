# Adobe · Loop 1 — evaluator notes (hidden from candidates)

## ADB-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH charged AS (                      -- only succeeded generations use credits
  SELECT gen_id, account_id, created_ts, credits,
         date_trunc('month', created_ts AT TIME ZONE 'UTC')::date AS month
  FROM generations
  WHERE status = 'succeeded'
), running AS (
  SELECT c.*,
         SUM(credits) OVER (PARTITION BY account_id, month
                            ORDER BY created_ts, gen_id
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS used_so_far
  FROM charged c
), account_months AS (
  SELECT DISTINCT account_id, month FROM charged
), allowance AS (                      -- the plan in effect at the month's first instant
  SELECT am.account_id, am.month, p.monthly_credits AS allowance
  FROM account_months am
  CROSS JOIN LATERAL (
    SELECT pc.plan
    FROM plan_changes pc
    WHERE pc.account_id = am.account_id
      AND pc.effective_ts < (am.month + INTERVAL '1 month') AT TIME ZONE 'UTC'
    ORDER BY (pc.effective_ts <= am.month::timestamp AT TIME ZONE 'UTC') DESC,  -- at or before the start first
             CASE WHEN pc.effective_ts <= am.month::timestamp AT TIME ZONE 'UTC'
                  THEN pc.effective_ts END DESC,                                -- the latest of those
             pc.effective_ts                                                    -- else the first in the month
    LIMIT 1
  ) pl
  JOIN plans p ON p.plan = pl.plan
)
SELECT r.account_id, r.month, a.allowance,
       COUNT(*)            AS charged_generations,
       SUM(r.credits)      AS credits_used,
       (ARRAY_AGG(r.gen_id ORDER BY r.created_ts, r.gen_id)
          FILTER (WHERE r.used_so_far >= a.allowance))[1] AS ran_out_gen,
       MIN(r.created_ts) FILTER (WHERE r.used_so_far >= a.allowance) AS ran_out_at
FROM running r
JOIN allowance a ON a.account_id = r.account_id AND a.month = r.month
GROUP BY r.account_id, r.month, a.allowance
ORDER BY r.month, r.account_id;
```

**Explanation.** Failed generations are removed first, so they neither add credits nor create rows. The running total is per account and UTC month, ordered by `(created_ts, gen_id)` with an explicit `ROWS` frame: with the default `RANGE` frame two generations at the same second get the same total, and the first of them would be reported as the one that ran out even when it alone did not reach the allowance. The allowance is an as-of lookup: the latest plan change at or before the month's first instant, or, for an account created during the month, its first plan. Because the running total only grows, the generation that ran out is the first row whose total is at least the allowance; `ARRAY_AGG(… ORDER BY …)[1]` picks it by time, not by id (ids are not in time order in the data).

**Complexity.** One sort of the charged generations by `(account_id, month, created_ts, gen_id)` for the window, a hash aggregate, and one small index-friendly lookup per account-month for the plan: O(n log n). An index on `plan_changes (account_id, effective_ts)` makes the lateral lookup a seek.

**Dialect notes** (described, not executed). BigQuery: `DATE_TRUNC(DATE(created_ts), MONTH)`; `ARRAY_AGG(gen_id IGNORE NULLS ORDER BY created_ts, gen_id LIMIT 1)[OFFSET(0)]` with `IF(...)` instead of `FILTER`; no `LATERAL`, so rank plan changes with `ROW_NUMBER()` in a join. Snowflake: `MIN_BY(gen_id, created_ts)` does not break ties by `gen_id`, so use `QUALIFY ROW_NUMBER()` over qualifying rows; `ASOF JOIN` exists for the plan lookup. Spark SQL: `min_by` on a struct `(created_ts, gen_id)`; window frames are `ROWS` only when written. MySQL 8: no `FILTER` (use `CASE`), no arrays; take the first qualifying row with `ROW_NUMBER()`.

**Edge cases built into the data.** An account whose running total reaches the allowance exactly; one that never reaches it; an account-month with only failed generations (no row); failed generations interleaved with charged ones; gen_ids not in time order. Hard: two months with generations in the last minute of September and the first minute of October; two generations of one account at the same second where neither alone reaches the allowance but together they do. Very Hard: a plan upgrade mid-September (September keeps the old allowance), a change exactly at `2026-10-01 00:00:00` (October uses it), an account created mid-September, and `accounts.plan` holding only the current plan.

**Common mistakes.** Counting failed generations; `>` instead of `>=`; the default `RANGE` frame or ordering by `created_ts` alone; `MIN(gen_id)` for the generation; months in the session's or a local time zone; joining `accounts.plan` for every month; an inner join to a plan lookup that drops the account created mid-month.

**Follow-up guidance.** (1) A per-account counter updated transactionally with each charge serves the page; this query is the nightly reconciliation that proves the counter, and differences are alerts, not silent fixes. (2) Retries create two rows; ask for a client request id and charge once per id with the latest status. (3) Late events can move "ran out" earlier; publish the report as of a cutoff, restate with a visible revision, and never re-time a charge already shown to the customer without saying so. (4) With mid-month packs the allowance is a step function of time; compare the running total to the allowance in effect at each generation, and an account can run out, buy a pack, and run out again: report each episode.

**Rubric anchors.** 2: right totals but failed generations charged, ties broken by a `RANGE` frame, or `>` instead of `>=`. 3: matches the expected result at the chosen level. 4: also explains the frame default, the as-of plan rule, and how a live balance is reconciled with this report.

**Strong signals.** Asks whether failures are charged and whether reaching exactly counts before writing SQL; writes `ROWS` deliberately; notices ids are not time-ordered. **Red flags.** Inferring anything from prompts or images; presenting this exercise's allowance rules as a real plan's.

## ADB-L1-02

**Reference solution** (PostgreSQL; `{{as_of}}` is the instance's report time)

```sql reference
WITH new_users AS (                    -- a user is new to an app once: at their first install
  SELECT user_id, app, MIN(installed_ts) AS first_ts
  FROM installs
  GROUP BY user_id, app
), flagged AS (
  SELECT n.app,
         date_trunc('month', n.first_ts AT TIME ZONE 'UTC')::date AS cohort_month,
         n.first_ts + INTERVAL '7 days' <= TIMESTAMPTZ '{{as_of}}' AS measurable,
         EXISTS (
           SELECT 1 FROM saves s
           WHERE s.user_id = n.user_id AND s.app = n.app
             AND s.location = 'cloud'
             AND s.saved_ts >= n.first_ts
             AND s.saved_ts <  n.first_ts + INTERVAL '7 days'
         ) AS saved_in_week
  FROM new_users n
)
SELECT app, cohort_month,
       COUNT(*)                                            AS new_users,
       COUNT(*) FILTER (WHERE measurable)                  AS measurable_users,
       COUNT(*) FILTER (WHERE measurable AND saved_in_week) AS activated,
       ROUND(COUNT(*) FILTER (WHERE measurable AND saved_in_week)::numeric
             / NULLIF(COUNT(*) FILTER (WHERE measurable), 0), 4) AS activation_rate
FROM flagged
GROUP BY app, cohort_month
ORDER BY app, cohort_month;
```

**Explanation.** `MIN(installed_ts)` per user and app defines the cohort and removes reinstalls in one step. The activation test is a semi-join (`EXISTS`) to cloud saves of the same app in the half-open window `[first, first + 7 days)`, so several saves cannot multiply rows. Measurability is a right-censoring rule: a user whose seven days are not over by `as_of` cannot yet be classified, so they are kept out of both numerator and denominator; counting them as "not activated" biases the most recent cohort down, and counting only the ones who already saved biases it up. `NULLIF` makes a cohort with nobody measurable report NULL rather than fail.

**Complexity.** One aggregate over `installs` and an indexed probe per new user into `saves (user_id, app, saved_ts)`: O(n log n) with that index, a hash semi-join otherwise.

**Dialect notes** (described, not executed). BigQuery: `TIMESTAMP_ADD(first_ts, INTERVAL 7 DAY)`, `COUNTIF`, `SAFE_DIVIDE`, `DATE_TRUNC(DATE(first_ts), MONTH)`. Snowflake: `DATEADD(day, 7, first_ts)`, `COUNT_IF`, `DIV0NULL` is not the same as NULL (it returns 0), so keep `NULLIF`. Spark SQL: `first_ts + INTERVAL 7 DAYS`, `count_if`, `EXISTS` subqueries are supported; `trunc(first_ts, 'MM')`. MySQL 8: `DATE_ADD`, `SUM(CASE …)`, `DATE_FORMAT(first_ts, '%Y-%m-01')`.

**Edge cases built into the data.** A reinstall more than a week after the first install followed by a cloud save (not activated, not a new user again); a save exactly 7 days after the first install; a save in another app; users with several saves; a user with no saves. Hard: local saves inside the window; a save at the install instant; a first install in the last minute of September; a user new to two apps. Very Hard: `as_of` a few days into November, a user whose window ends exactly at `as_of` (measurable), users installed within the last 7 days (some already saved), and a November cohort with nobody measurable (rate NULL).

**Common mistakes.** Treating each install as a new user; measuring the window from the latest install; `BETWEEN` (inclusive end); counting local saves; a plain join to saves before counting; ignoring `as_of` or excluding only the not-yet-activated unmeasurable users; integer division.

**Follow-up guidance.** (1) Look back further for a sample of users or use account creation dates; label early cohorts as inflated by returning users rather than silently mixing them. (2) Report a binomial confidence interval (Wilson) or hide rates below a minimum cohort size; trend lines need the interval too. (3) Use the signed-in account, not the device; device-based counting makes every new laptop a new user and inflates acquisition. (4) Keep one row per user and app with first install and first cloud save time; late saves update that row; the cohort report is then a cheap aggregate, recomputed for the cohorts whose windows are still open.

**Rubric anchors.** 2: computes a rate per cohort but counts reinstalls, uses an inclusive window or counts local saves. 3: matches the expected result. 4: also explains censoring by `as_of`, identity choices and how uncertainty would be shown.

**Strong signals.** Asks what makes a user "new" and whether the window end is inclusive; recognises the censoring problem without prompting. **Red flags.** Reading document contents to decide activation; device ids as users without comment.

## ADB-L1-03

**Reference solution** (PostgreSQL; `{{min_exports}}` is the instance's floor)

```sql reference
WITH img AS (                          -- exports with a normalised format
  SELECT export_id, app,
         date_trunc('month', exported_ts AT TIME ZONE 'UTC')::date AS month,
         CASE lower(format) WHEN 'jpg' THEN 'jpeg' ELSE lower(format) END AS fmt
  FROM exports
), state AS (                          -- one state per export: its latest non-failed event
  SELECT DISTINCT ON (export_id) export_id, outcome
  FROM manifests
  WHERE outcome <> 'failed'
  ORDER BY export_id, event_ts DESC, manifest_id DESC
), x AS (
  SELECT i.app, i.month, i.fmt, COALESCE(s.outcome = 'embedded', false) AS has_credentials
  FROM img i
  LEFT JOIN state s ON s.export_id = i.export_id
  WHERE i.fmt IN ('jpeg', 'png', 'tiff', 'webp')
)
SELECT app, month, COALESCE(fmt, 'all') AS format,
       COUNT(*)                                  AS image_exports,
       COUNT(*) FILTER (WHERE has_credentials)   AS with_credentials,
       ROUND(COUNT(*) FILTER (WHERE has_credentials)::numeric / COUNT(*), 4) AS coverage
FROM x
GROUP BY GROUPING SETS ((app, month, fmt), (app, month))
HAVING COUNT(*) >= {{min_exports}}
ORDER BY app, month, format;
```

**Explanation.** The grain of the report is the export, so the manifest events are reduced to one state per export before the join: the latest event that is not `failed` (below Very Hard this is simply "has an embedded event"). Formats are normalised once, then filtered to images. `GROUPING SETS` produces the per-format rows and the `'all'` row in one pass; the `'all'` row is a real aggregate over every image export of the app and month, not a sum of the rows that survived the floor, and `HAVING` then applies the floor to every row on its own.

**Complexity.** A sort for `DISTINCT ON` over the manifests, a hash join to exports, and a hash aggregate with two grouping sets: O(n log n).

**Dialect notes** (described, not executed). BigQuery: `GROUPING SETS` and `COUNTIF`; no `DISTINCT ON`, so `QUALIFY ROW_NUMBER() OVER (PARTITION BY export_id ORDER BY event_ts DESC, manifest_id DESC) = 1`; `DATE_TRUNC(DATE(exported_ts), MONTH)`. Snowflake: `GROUPING SETS`, `QUALIFY`, `COUNT_IF`. Spark SQL: `GROUPING SETS` and `count_if`; `row_number` in a subquery. MySQL 8: no `GROUPING SETS` (only `WITH ROLLUP`, which adds a grand total too), so `UNION ALL` two aggregates; `SUM(CASE …)`.

**Edge cases built into the data.** A row exactly at the floor; formats just below it (still in the `'all'` row); non-image exports with manifests; exports with no events or only a failed event. Hard: `JPG`, `jpg`, `Jpeg` and other spellings; several events per export (failed then embedded, embedded twice); exports in the last minute of September. Very Hard: an export embedded then stripped (not covered) and one embedded, stripped and embedded again (covered).

**Common mistakes.** Joining manifests directly (exports counted once per event); counting failed events; `lower()` without mapping `jpg`; `'all'` computed from the surviving format rows or left out; `>` for the floor; ignoring `stripped`; `COUNT(DISTINCT export_id)` for the total but `COUNT(*)` of embedded rows for the numerator.

**Follow-up guidance.** (1) Check whether the export volume or mix changed (a new export path, a new format), whether manifest events are late, and whether the drop is in one app version; only then call it a regression. (2) It is a different metric: "attached at export" versus "still present downstream"; model credential state as events per asset with a separate as-of view. (3) Per-user coverage turns a quality metric into surveillance; answer with per export path, app version and setting, with a minimum group size. (4) Partition by export month, upsert export state from late events, and recompute only the touched app-month-format cells and their `'all'` row.

**Rubric anchors.** 2: plausible coverage but join inflation, unnormalised formats or a wrong `'all'` row. 3: matches the expected result. 4: also discusses what coverage does and does not mean, and builds it incrementally.

**Strong signals.** Says that credentials record provenance and do not prove authenticity; reduces to the export grain before joining; asks whether the floor applies to the `'all'` row. **Red flags.** Proposing to inspect image contents; describing credentials as a guarantee that a file is genuine.

## ADB-L1-04

**Reference solution**

```python reference
def split_pdf(page_bytes, k, overhead, chapter_starts):
    n = len(page_bytes)
    forced = [False] * n
    forced[0] = True                       # page 1 always starts a part
    for p in chapter_starts:
        forced[p - 1] = True
    if sum(forced) > k:                    # more chapters than parts allowed
        return None

    def parts_needed(cap):                 # greedy: fill each part as far as cap allows
        parts, size = 0, 0
        for b, f in zip(page_bytes, forced):
            if f or size + b > cap:
                parts += 1
                size = overhead + b
            else:
                size += b
        return parts

    lo, hi = overhead + max(page_bytes), overhead + sum(page_bytes)
    while lo < hi:                         # smallest cap that needs at most k parts
        mid = (lo + hi) // 2
        if parts_needed(mid) <= k:
            hi = mid
        else:
            lo = mid + 1
    starts, size = [], 0
    for i, (b, f) in enumerate(zip(page_bytes, forced)):
        if f or size + b > lo:
            starts.append(i + 1)
            size = overhead + b
        else:
            size += b
    return lo, starts
```

**Explanation.** The feasibility of a size limit `C` is monotone: if every part can be kept within `C` using at most `k` parts, the same split works for any larger `C`. So binary-search the smallest feasible `C` between `overhead + max page` (no part can be smaller) and `overhead + total` (one part, which is feasible whenever the chapter count fits). The check fills parts greedily from the front; filling as much as possible never uses more parts than any other split within `C` (an exchange argument: the greedy part always ends at or after the corresponding part of any other valid split). Chapter starts are forced breaks; the greedy stays optimal with them, and if the chapters alone need more than `k` parts nothing is feasible. The same greedy at the optimum gives the canonical `starts`.

**Complexity.** O(n log S) time for n pages and total size S (about 40 passes of an O(n) loop), O(n) memory. The 60 000-page timing test runs in about 0.2–0.3 s in CPython. A partition DP is O(k·n²): the straightforward version took 3.4 s for only 1 000 pages and k = 40, so 60 000 pages is out of reach.

**Dialect notes.** Java/C++: use `long` for sizes (a scanned archive passes 2³¹ bytes easily), and `lo + (hi - lo) / 2`. Python integers do not overflow. Not executed here.

**Edge cases built into the tests.** `k = 1`; a single page; `k` larger than the page count (the largest page decides, small pages still merge); equal pages that divide evenly; one heavy page that must stand alone; a part exactly at the optimum keeps the page. Hard: an overhead large enough that every page is its own part; an overhead with `k = 2`. Very Hard: a chapter start that forces a split, as many chapters as parts, more chapters than parts (`None`), `chapter_starts` containing page 1 and unsorted, a heavy chapter split further inside.

**Common mistakes.** Starting the search below the largest page plus overhead with a check that does not reject a page larger than the limit (it then accepts sizes no split can meet); `size + b >= cap` (off by one at the limit); forgetting the overhead for each new part; counting chapter breaks but not the greedy breaks inside chapters; returning the split from the last binary-search probe instead of re-running at the optimum; a DP.

**Follow-up guidance.** (1) Exchange argument: take an optimal split; move each of its boundaries right until it matches the greedy's; no part exceeds `C` and the count does not grow. (2) A lexicographic objective (size first, then page-count spread) or a weighted sum; binary search still finds the size, and a second pass balances page counts within it, but a weighted sum needs DP or parametric search. (3) One pass cannot know the optimum; a streaming split with a fixed target (total size known from the file's metadata divided by `k`, with headroom) is near-optimal and can be corrected at the end. (4) Cap pages per request, compute prefix sums of page sizes at upload, and serve each feasibility check with binary searches on the prefix sums (O(k log n) per check).

**Rubric anchors.** 2: correct small cases with a DP or a linear search over sizes. 3: all tests pass with binary search and a greedy check. 4: also proves the greedy check and handles chapters and the streaming variant thoughtfully.

**Strong signals.** States the monotone predicate before coding; picks bounds from the problem; re-runs the greedy for `starts`. **Red flags.** Splitting a page; assuming exactly `k` parts are required.

## ADB-L1-05

**Reference solution**

```python reference
def sync_plan(local, cloud, base):
    here = dict(local)                     # a later entry for a path replaces an earlier one
    there = dict(cloud)
    synced = dict(base)
    plan = {}
    for path in here.keys() | there.keys() | synced.keys():
        l, c, b = here.get(path), there.get(path), synced.get(path)   # None: absent or deleted
        if l == c:                         # same state on both sides (or both gone)
            plan[path] = 'none'
        elif l == b:                       # only the cloud changed
            plan[path] = 'delete_local' if c is None else 'download'
        elif c == b:                       # only this device changed
            plan[path] = 'delete_cloud' if l is None else 'upload'
        else:                              # both changed, differently
            plan[path] = 'conflict'
    return plan
```

**Explanation.** A three-way comparison against the common base, the same idea as a three-way merge. One dictionary per list makes each path's three states O(1) lookups; `dict()` over a list of pairs keeps the last entry for a path, which is exactly the journal rule, and a `None` hash or a missing path both read as "does not exist". The four ordered rules then cover every case: agreement, a change on one side only (an edit or a deletion), and a change on both sides.

**Complexity.** O(n) time and memory for n entries. The 100 000-path timing test runs in about 0.25–0.35 s in CPython. Looking each path up by scanning the three lists took about 2–3 s for only 5 000 paths, so it is hundreds of times too slow at 100 000.

**Dialect notes.** Java: three `HashMap<String, String>`s and a `HashSet` of keys; `Objects.equals` for null-safe comparison. C++: `unordered_map<string, optional<string>>`. In SQL this is a `FULL OUTER JOIN` of three tables on path with the same `CASE`. Not executed here.

**Edge cases built into the tests.** Unchanged; local-only and cloud-only edits; different edits on both sides; the same edit on both sides; new on one side; new on both sides with different contents. Hard: deletion on either side with the other unchanged; deletion against an edit (conflict); deleted on both sides. Very Hard: an edit reverted later in the journal; a `None` tombstone; deleted then re-created; created and deleted before any sync.

**Common mistakes.** Comparing local with cloud only (no base), which cannot tell a download from an upload; treating the same edit on both sides as a conflict; forgetting paths that appear only in `base`; keeping the first journal entry; treating a `None` hash as a value that differs from "absent"; an O(n²) lookup.

**Follow-up guidance.** (1) Rules 2 and 3 only fire when one side equals the base, so a change is never overwritten without being the only change; rule 1 hides that both sides changed when they made the same change, which is harmless for contents but loses the fact for audit. (2) A rename looks like a delete plus a new file; a new path whose hash equals a deleted base path's hash is a rename candidate, and an edit on the other side then needs the rename applied first. (3) Derive the copy's name deterministically from the conflicting version (for example its hash or version id and the device), so two devices produce the same name and the second is a no-op. (4) Send a cursor or a per-folder tree of hashes (a Merkle tree) and exchange only changed subtrees.

**Rubric anchors.** 2: right for edits but wrong for deletions or same-edit cases, or quadratic lookups. 3: all tests pass in O(n). 4: also reasons about renames, conflict copies and incremental sync.

**Strong signals.** Asks why the base is needed and answers it; checks the both-deleted case; uses a set union of keys. **Red flags.** "Newest timestamp wins" without discussing clocks; comparing file contents instead of hashes.
