# Snowflake · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a cloud data
platform: virtual warehouses that run queries and are billed for compute,
storage with time travel and fail-safe, data sharing and a marketplace of
listings, scheduled tasks and bulk loading from cloud storage. Every workload,
number, name and schema is hypothetical, and where an exercise uses a rule that
resembles public product behaviour it is stated as the exercise's rule (check
current docs). Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SNO-L1-01: Slow queries against their own fingerprint's p90

| | |
|---|---|
| **Template ID** | SNO-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-group percentile baseline (PERCENTILE_CONT), time windows, anti-noise thresholds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | SNO-L1-01.mjs |

**Business Scenario.** A platform team that runs dashboards and transformation jobs on a cloud data warehouse wants a daily list of queries that ran unusually long. A single threshold ("anything over 60 seconds") is useless: a nightly transformation always takes minutes, while a dashboard tile that suddenly takes ten seconds is a regression. So each query is compared with its own history: queries with the same normalised text share a **fingerprint** (`query_hash`), and a run is slow if it took far longer than that fingerprint's recent 90th percentile. The query log records the total elapsed time and how long each query waited in a queue for a busy warehouse.

**Problem Statement.** Using `query_history`, write one PostgreSQL query that returns `query_id, query_hash, warehouse_size, exec_ms, baseline_p90_ms, baseline_runs`: one row per **outlier** query that started on `{{report_date}}` (UTC), ordered by `query_hash`, then `exec_ms` descending, then `query_id`. A query's execution time is `exec_ms = total_elapsed_ms − queued_ms`. The **baseline** of a fingerprint is the set of its runs with `start_time` in `[{{report_date}} − {{baseline_days}} days, {{report_date}})`; `baseline_p90_ms` is `PERCENTILE_CONT(0.9)` of their `exec_ms`, rounded to 1 decimal place, and `baseline_runs` how many there are. A fingerprint with fewer than {{min_runs}} baseline runs is not evaluated. A query is an outlier if `exec_ms > {{factor}} × p90` (compare with the unrounded p90). {{status_rule}} {{size_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{queries}} rows; the production table has hundreds of millions, partitioned by day.

**Assumptions.** The table is a simplified, hypothetical query log; real query-history views carry many more columns (compilation time, bytes scanned, partitions pruned) with their own documented definitions. Fingerprints, times, the factor and the thresholds are hypothetical.

**Clarifications.**
- Q: Why subtract `queued_ms`? | A: A query that waited for a busy warehouse is a capacity problem, not a slower query. This report is about the query's own execution.
- Q: Does the report day's own run count in its baseline? | A: No. The baseline is the previous {{baseline_days}} days, ending at midnight UTC at the start of `{{report_date}}`.
- Q: Which percentile definition? | A: `PERCENTILE_CONT(0.9)`: linear interpolation between the two nearest ranks, as in PostgreSQL.
- Q: Is a run at exactly the window start in the baseline? | A: Yes. The window is half-open: the start is in, `{{report_date}} 00:00:00` is not.
- Q: Is exactly `{{factor}} × p90` an outlier? | A: No. It must be strictly greater.

**Hints.**
1. Compute `exec_ms` once in a CTE, with the status filter, so the baseline and the report day agree on what a run is.
2. Aggregate the baseline with `PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY exec_ms)` and `COUNT(*)`, and put the run minimum in `HAVING`.
3. Join the report day's runs to the baseline on the fingerprint; the inner join drops fingerprints that were not evaluated.

**Follow-ups.**
1. The dashboard team says a p90 over 7 days hides a slow drift: the baseline drifts up with the regression. How would you detect a gradual slowdown as well as a sudden one?
2. Two runs of a fingerprint scanned 10 MB and 40 GB because of different filter values. Is execution time the right thing to compare? What would you normalise by?
3. Run this daily over a table with hundreds of millions of rows a day. How do you avoid recomputing every fingerprint's percentile from scratch, and is an approximate percentile acceptable?
4. Product wants the list to page someone. What precision would you need, and which additional guards (absolute excess, repeated occurrences, warehouse changes) would you add before it pages?

**Follow-up rules.**
- when: avg, average, mean, stddev → ask: A fingerprint has a few runs that take 20 times longer than the rest. What does that do to a mean-and-standard-deviation baseline, and why does the problem use a percentile?
- when: percentile_disc, approx_percentile, approx → ask: Your percentile function differs from PERCENTILE_CONT. On 11 runs, which value does each return, and when could it change the answer here?
- when: total_elapsed_ms → ask: A query waited 40 seconds in the queue and executed in 2. Is it a slow query in your result, and should it be?
- when: rows between, preceding, window frame → ask: Your baseline is a moving window. Does it include the report day's own runs, and what does that do to a sudden regression?
- when: warehouse_size, warehouse size → ask: The same fingerprint runs on an extra-small and a large warehouse. What happens to the baseline if you mix them?

**Evaluation Criteria.** `exec_ms` excludes queue time; the baseline is exactly the previous N days, half-open, without the report day; `PERCENTILE_CONT(0.9)` per fingerprint with the run minimum inclusive; strictly greater than factor × p90; UTC days with the last second of the report day in and the next midnight out; failed runs excluded everywhere (Hard+); per-size baselines and the absolute excess (Very Hard); deterministic order; can discuss drift, normalisation, incremental percentiles and alert precision.

## SNO-L1-02: Listing consumers per month, trial versus paid

| | |
|---|---|
| **Template ID** | SNO-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / range (interval) joins, precedence within a group, first-ever events, COUNT DISTINCT by month |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | analytics-engineer, data-engineer, senior-data-engineer, data-architect |
| **Generator** | SNO-L1-02.mjs |

**Business Scenario.** On a data marketplace, providers publish **listings** (shared datasets) that consumer accounts can query directly, without copying the data. A consumer gets access through an **entitlement**: a free trial for a limited period, or a paid subscription. Providers want a monthly report per listing: how many distinct consumer accounts actually used it, how many of them were paying, how many were still only trying it, and how many were new. You have the provider-side consumption log, one row per query a consumer account ran against a listing.

**Problem Statement.** Write one PostgreSQL query that returns `month, listing_id, consumers, paid_consumers, trial_only_consumers, new_consumers`: one row per month (the first day of the UTC calendar month of `query_ts`, as a date) and listing with at least one counted consumer, for months `{{from_month}}` through `{{to_month}}`, ordered by `month, listing_id`. A query **counts** only if an entitlement of the same `listing_id` and `consumer_account` covers it: `starts_at ≤ query_ts < ends_at`, where a NULL `ends_at` means open-ended. A query is **paid** if a paid entitlement covers it, otherwise trial. In a month, `consumers` is the number of distinct accounts with a counted query, `paid_consumers` those with at least one paid query, and `trial_only_consumers` the rest (so the two add up to `consumers`). `new_consumers` counts the accounts whose first counted query on that listing, ever, falls in that month. {{coverage_rule}} {{history_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{queries}} queries and {{entitlements}} entitlements; the production log has billions of rows across thousands of listings.

**Assumptions.** The entitlement model, account names and listings are hypothetical and simpler than any real marketplace's (no usage-based pricing, no regions, no organisation hierarchy). The consumption log here is the provider's own derived table, not a product view.

**Clarifications.**
- Q: A consumer's trial ended on the 12th and their paid subscription started the same moment. Which do they count as for that month? | A: Paid. Any paid query in the month makes the account a paid consumer for that month, and it is not also trial-only.
- Q: Is a query exactly at `ends_at` covered? | A: No. Entitlements are half-open: `starts_at` is covered, `ends_at` is not.
- Q: Does an uncovered query make an account "new"? | A: No. Only counted queries exist for this report, including for "new".
- Q: Which time zone defines the month? | A: UTC, the session time zone.
- Q: Should a month with no counted consumers appear with zeros? | A: No. Only month-listing pairs with at least one counted consumer.

**Hints.**
1. Start from queries joined to the entitlements that cover them. One query may match two entitlements, so collapse back to one row per query with `BOOL_OR(kind = 'paid')`.
2. Then reduce to one row per (month, listing, account) with `BOOL_OR(paid)`; every column is a count over that grain.
3. Compute each account's first counted query per listing before filtering to the report months.

**Follow-ups.**
1. The provider asks for trial-to-paid conversion: of the accounts whose trial started in a month, how many had a paid query within 30 days? Sketch the query and the cohort definition.
2. The consumption log is billions of rows. The interval join to entitlements is the expensive part: how would you make it cheap, and where would you precompute?
3. The same consumer organisation uses several accounts in different regions. How would you count organisations, and what would you need from the provider's own data to do it?
4. Providers must not learn what consumers queried, only that they used the listing. Which fields of this report are safe to show a provider, and how would you protect a listing with only two consumers?

**Follow-up rules.**
- when: count(distinct, distinct → ask: You count distinct accounts per month. If the provider asks for a quarterly figure, can it be the sum of the three monthly numbers?
- when: between → ask: Is your coverage check inclusive at `ends_at`? Which query in the sample would it wrongly count?
- when: row_number, rank() → ask: You used a ranking to pick one entitlement per query. Which one wins when a trial and a paid entitlement both cover it, and is the choice deterministic?
- when: min(query_ts), first_value → ask: Is the first query computed before or after you filter to the report months, and which account would be wrongly new if it were after?
- when: left join → ask: A query has no covering entitlement. Where does your left join drop it, or does it still count?

**Evaluation Criteria.** A half-open interval join from queries to covering entitlements; one row per query with paid precedence; consumers counted once per month and listing; paid plus trial-only equals consumers; new consumers from the first counted query over all history (Very Hard) computed before the month filter; uncovered queries and the provider's own queries excluded; UTC months with boundary seconds correct; deterministic order; can discuss cohorts, the cost of the interval join, organisations and small-count privacy.

## SNO-L1-03: Active, time-travel and fail-safe bytes per table per day

| | |
|---|---|
| **Template ID** | SNO-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / date spine (generate_series), interval states as of a snapshot, running totals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | SNO-L1-03.mjs |

**Business Scenario.** On a cloud data platform, deleting or overwriting data does not free storage at once. Removed data stays recoverable for the table's **time travel** retention period and then, for permanent tables, spends a further period in **fail-safe**, a recovery window that only the platform operator can use; both are billed as storage. A finance team that keeps seeing storage bills grow after large clean-ups wants a day-by-day view per table of how many bytes are active, in time travel and in fail-safe, rebuilt from a log of storage changes.

**Problem Statement.** Using `table_settings` and `storage_events`, write one PostgreSQL query that returns `day, table_name, active_bytes, time_travel_bytes, failsafe_bytes`: one row for **every** table and every day from `{{start_date}}` to `{{end_date}}` inclusive, ordered by `day, table_name`. Each row is the state at the **end** of the day: the snapshot instant is the next midnight UTC, and an event counts if `event_ts` is before it. `ADD` adds `bytes` to active storage. `REMOVE` takes `bytes` out of active storage at `event_ts = t`; those bytes are then in time travel during `[t, t + retention_days days)`, in fail-safe during `[t + retention_days days, t + retention_days days + F)`, and gone afterwards, where F is 7 days for a `PERMANENT` table and 0 for a `TRANSIENT` one (this exercise's rule; check current docs). A table with no events yet has zeros. {{kind_rule}} {{drop_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{events}} events; production has millions of tables, so the answer must not depend on a fixed list of names.

**Assumptions.** Table names, sizes and retention values are hypothetical. Real platforms track storage per micro-partition and can share partitions between clones; this exercise uses one simplified lifecycle per removed chunk, and the 7-day fail-safe and the zero for transient tables are stated as this exercise's rule. Retention is constant for each table.

**Clarifications.**
- Q: Is a removal at exactly midnight in the previous day's row? | A: No. The snapshot for a day is the next midnight, and an event counts only if it is strictly before it, so an event at midnight belongs to the day that starts then.
- Q: Bytes removed with 1 day of retention at 2026-09-10 00:00 — where are they at the snapshot 2026-09-11 00:00? | A: In fail-safe (permanent) or gone (transient). Time travel is `[t, t + 1 day)`, so it has just ended.
- Q: Do I need a row for a table on days before its first event? | A: Yes, with zeros. Every table, every day.
- Q: Are events before `{{start_date}}` relevant? | A: Yes. They set the active total, and data removed earlier may still be in time travel or fail-safe.

**Hints.**
1. Build a spine of days with `generate_series` and their snapshot instants, and cross join it with the tables.
2. Turn every `REMOVE` into one "removed chunk" `(table, t, bytes)`; then each state is a conditional sum over chunks with `t < snapshot`, using `t + retention` and `t + retention + F` as the boundaries.
3. Active bytes at a snapshot are the `ADD`s before it minus the chunks before it.

**Follow-ups.**
1. A table's retention is raised from 1 to 30 days halfway through the month. What happens to data already in time travel under your model, and what would you need to know to model it properly?
2. Finance wants the report in byte-days (or GB-months) to match a monthly bill. How do you integrate the daily snapshots, and what is lost by sampling once a day?
3. Over millions of tables, the cross join of days and tables is large and mostly unchanged. How would you compute this incrementally each day?
4. A clean-up job deleted 40 TB yesterday and the team expected the bill to drop. Using this model, write the explanation you would send them, with dates.

**Follow-up rules.**
- when: lag, lead → ask: You walk events with LAG/LEAD. How does a removal from twelve days ago still affect today's fail-safe bytes in your query?
- when: transient → ask: Why does a transient table never show fail-safe bytes, and when would you choose one for a staging table?
- when: retention_days, interval → ask: Is the end of time travel inclusive or exclusive in your query, and what does a removal at exactly midnight do on the snapshot one retention period later?
- when: generate_series, date spine, calendar → ask: Your spine has one row per day. What does it cost for a million tables, and what would you materialise instead?
- when: drop, undrop → ask: A table is dropped and then restored within its retention. What happens to the bytes in your model, and what would the log need to record?

**Evaluation Criteria.** A spine of every day and every table; end-of-day snapshots with strict `event_ts < snapshot`; removed chunks classified by half-open intervals `[t, t + retention)` and `[t + retention, t + retention + F)`; fail-safe only for permanent tables, retention 0 handled (Hard+); events before the range included; DROP converted to the active amount with a running total (Very Hard); deterministic order; can discuss retention changes, byte-day billing, incremental computation and how to explain a delayed storage drop.

## SNO-L1-04: The fewest warehouses for a day of scheduled tasks

| | |
|---|---|
| **Template ID** | SNO-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / interval partitioning (minimum resources, lowest-free assignment), schedule expansion, DAG start times |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, data-architect |
| **Generator** | SNO-L1-04.mjs |

**Business Scenario.** A data team runs its scheduled transformation tasks on dedicated virtual warehouses, and wants each task run to have a warehouse to itself so that runs never compete for compute. Warehouses cost money while they run, so before reorganising the schedule the team wants to know the fewest warehouses that would carry every run in a period, and a concrete, reproducible assignment of runs to warehouses that it can compare with today's. As on many schedulers, a task whose previous run is still going does not start a second overlapping run; that scheduled run is simply skipped (this exercise's rule; check current docs for a real scheduler's options).

**Problem Statement.** Implement `plan_warehouses(tasks, horizon)`. Each task is `(task_id, size, first_start, every, duration, after)`, times in whole minutes. A **root** task has `after == ()` and is scheduled at `first_start + k × every` for `k = 0, 1, 2, …` while the scheduled minute is `< horizon`. A run occupies one warehouse of the task's `size` during the half-open interval `[start, start + duration)`; a run that starts before `horizon` runs to the end even if it ends after it. A scheduled run is **skipped** if the task's previous run that actually ran is still running at that minute (its end is after the scheduled minute). Then take all runs in order of `(start, task_id)` and give each one the **lowest-numbered** warehouse of its size that is free at its start (warehouses are numbered from 1 per size; one freed at minute `t` is free at `t`), opening the next number if none is free. Return `(needed, assignment)`: `needed` maps each size that has at least one run to the number of warehouses opened, and `assignment` lists `(task_id, start, warehouse_no)` in `(start, task_id)` order. {{size_rule}} {{graph_rule}}

**Constraints.** Up to 6 000 tasks and about 150 000 runs; thousands of warehouses can be busy at once. `every ≥ 1` and `duration ≥ 1`. Expected: O(R log R) for R runs. Scanning warehouses 1, 2, 3, … for a free one at every run is too slow.

**Assumptions.** Task names, sizes, periods and durations are hypothetical. The model ignores warehouse start-up time, auto-suspend and per-second billing, and gives each run a warehouse to itself; it measures the schedule's concurrency, not a recommendation to run one task per warehouse.

**Clarifications.**
- Q: A run ends at minute 30 and another starts at 30. Can they share a warehouse? | A: Yes. Intervals are half-open.
- Q: Two runs of the same size start at the same minute. Which gets the lower number? | A: The one with the smaller `task_id`, because runs are assigned in `(start, task_id)` order.
- Q: Is the number of warehouses the peak number of overlapping runs? | A: Yes, per size: assigning the lowest free warehouse in start order never opens more than the peak. The assignment must still follow the stated rule exactly.
- Q: After a skipped run, when is the next attempt? | A: At the next scheduled minute, `first_start + (k + 1) × every`; skipping does not shift the schedule.
- Q: Are tasks given in any particular order? | A: No.

**Hints.**
1. First expand every root's schedule into runs, applying the skip rule as you go (you only need the end of the last run that ran).
2. Sort the runs by `(start, task_id)`. Keep, per size, a min-heap of `(end, warehouse_no)` for busy warehouses and a min-heap of free numbers.
3. Before assigning a run starting at `t`, move every busy warehouse with `end ≤ t` to the free heap; then pop the smallest free number, or open a new one.
4. (Graphs) Inside one graph run, a child's start is the maximum end of its predecessors: compute it in topological order.

**Follow-ups.**
1. Prove that the lowest-free greedy in start order opens exactly the peak number of simultaneous runs, per size.
2. Warehouses take a minute to resume and are billed for at least a minute each time they resume. How does that change the objective, and would you still give every run its own warehouse?
3. The team may shift each task's `first_start` within its period. How would you search for offsets that lower the peak, and how good can a greedy be?
4. Some tasks could run on a larger shared warehouse instead. Sketch how you would decide which tasks to consolidate, and what you would measure to check the decision.

**Follow-up rules.**
- when: sort by end, earliest end, end time → ask: The specification assigns in order of start time. What goes wrong if you process runs by end time instead?
- when: for w in range, scan, first free, linear → ask: Thousands of warehouses are busy at once. What does finding the lowest free one cost per run, and which structure makes it O(log w)?
- when: max overlap, peak, sweep → ask: The sweep gives the count. How do you also produce the exact assignment, and why does the lowest free number matter?
- when: allow overlap, overlapping, skip → ask: A run takes 25 minutes and the period is 10. How many runs happen in an hour under the skip rule, and when does the next run start after a skip?
- when: topological, toposort, dag → ask: A child has two predecessors that finish at different times. When does it start, and how do you know its predecessors have been computed?

**Evaluation Criteria.** Correct schedule expansion with the strict `< horizon` and the skip rule tied to the last run that ran; half-open intervals with freed warehouses reusable at the same minute; `(start, task_id)` order; lowest-numbered free warehouse via a heap of free numbers and a heap of busy ends; sizes as separate pools (Hard+); graph runs with children after all predecessors and the skip rule over the whole graph run (Very Hard); O(R log R); can prove the greedy is optimal and discuss resume costs and offset search.

## SNO-L1-05: Which staged files will the next bulk load pick up?

| | |
|---|---|
| **Template ID** | SNO-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and pattern matching / glob-to-regex translation, indexing history by key, retention-window boundaries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, analytics-engineer |
| **Generator** | SNO-L1-05.mjs |

**Business Scenario.** A pipeline loads files that upstream systems drop into a cloud storage stage into warehouse tables with a bulk-load command. The load is idempotent because the platform remembers, for a limited time, which files it has already loaded into each table and skips them. Files whose history has been forgotten are a known trap: if a file is old and there is no remembered load for it, the loader cannot tell whether it was loaded, and by default it skips the file rather than risk a duplicate. Public bulk-loading documentation describes load metadata kept for 64 days; this exercise uses that number as its own rule (check current docs). The on-call engineer wants a dry run: for the files in the stage now, which would be loaded and which skipped, and why.

**Problem Statement.** Implement `select_files(files, history, patterns, now, load_uncertain)`. `files` lists `(path, etag, last_modified)`; `history` lists load records `(path, etag, loaded_at, status)` for the target table; times are Unix seconds. A file is **selected** if its path matches at least one include pattern in full. Patterns are globs: `*` matches any run of characters except `/` (including none), `?` exactly one character except `/`, and every other character matches itself (`.` is a literal dot). {{glob_rule}} A history record is **remembered** if `now − loaded_at < 64 × 86 400`; older records are forgotten. For each selected file: if a remembered record has the same path, the same etag and status `LOADED`, the file is `SKIP_LOADED`; otherwise, if any remembered record has the same path, it is `LOAD` (the file changed, so its status is known); otherwise, if `now − last_modified ≥ 64 × 86 400` it is `SKIP_UNCERTAIN`, and if not, `LOAD`. Return `[(path, status)]` for the selected files, sorted by path. {{history_rule}}

**Constraints.** Up to 60 000 files and 60 000 history records per call, and a handful of patterns. Expected: O(F × P × L + H) for F files, P patterns of length L and H records. Scanning the history for every file is too slow.

**Assumptions.** Paths, etags, times and the 64-day window are hypothetical exercise values. Real bulk-load commands document their own pattern syntax (often a regular expression rather than a glob), options to force a reload or to load files whose status is unknown, and more detailed conditions for "unknown"; this exercise keeps one simplified rule. Paths in a call are unique.

**Clarifications.**
- Q: Does `landing/*.csv.gz` match `landing/2026/a.csv.gz`? | A: No. `*` never crosses a `/`.
- Q: A load record is exactly 64 days old. Is it remembered? | A: No. Remembered means strictly less than 64 days old.
- Q: A file was last modified exactly 64 days ago and was never loaded. Load or skip? | A: Skip as uncertain. Uncertain starts at exactly 64 days.
- Q: The same path was loaded twice with different etags. Which record matters? | A: Any remembered `LOADED` record whose etag equals the file's current etag means the file is already loaded.
- Q: Can I use `fnmatch`? | A: Check its rules first: its `*` matches `/`, which this loader's does not.

**Hints.**
1. Translate each glob once into a regular expression (`*` → `[^/]*`, `?` → `[^/]`, other characters escaped) and use a full match.
2. Build a dict from path to the set of etags of remembered `LOADED` records, and remember separately which paths have any remembered record.
3. Then each file is a constant number of lookups plus the pattern matches.

**Follow-ups.**
1. Two loads run concurrently against the same stage and table. What could go wrong with this dry run's answer, and how does a real loader avoid loading a file twice?
2. An upstream system rewrites files in place with new content but keeps the same name. What does the loader do, and what should the pipeline do instead?
3. The stage has 50 million files and the listing itself takes an hour. How would you restructure the paths and the patterns so each load lists only what it needs?
4. The team wants to reload a day of files after fixing a bug in the target table. Which options would you use, and how do you prevent duplicates in the table?

**Follow-up rules.**
- when: fnmatch, glob.glob, pathlib → ask: Does that library's `*` match `/`? Show a path where it gives a different answer from the loader's rule.
- when: for h in history, any(, scan the history → ask: There are 60 000 files and 60 000 records. How many comparisons does your loop make, and what would you index by?
- when: <=, 64 days → ask: Is a record exactly 64 days old remembered in your code, and is a file exactly 64 days old uncertain? Point to the comparisons.
- when: etag, checksum → ask: Why compare the etag and not only the path, and what does a matching path with a different etag tell you?
- when: force → ask: If you force the load, what happens to files that were already loaded, and how would you keep the table free of duplicates?

**Evaluation Criteria.** Correct glob semantics (`*` and `?` never cross `/`, literal dots, full-path matches; `**`, exclusion and classes at Hard and Very Hard); the strict 64-day memory and the inclusive 64-day uncertainty boundary; same-path same-etag `LOADED` skipped, changed or failed files loaded (Very Hard); uncertain files skipped unless the switch is on; an index by path instead of a scan; patterns compiled once; sorted output; can discuss concurrent loads, in-place rewrites, listing cost and safe reloads.
