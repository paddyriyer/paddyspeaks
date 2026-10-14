# Databricks — Loop 1: SQL + DSA

Simulated practice scenarios set in the public product domain of a data and AI platform built
around a lakehouse, Apache Spark and an open table format. None of these is a question from
Databricks' interviews, and none describes its internal systems. All numbers are hypothetical.

## DBX-L1-01: Job SLA misses with retries and repair runs

| | |
|---|---|
| **Template ID** | DBX-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / date spines, latest-per-group, interval arithmetic, outer joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | DBX-L1-01.mjs |

**Business Scenario.** A platform team runs scheduled data jobs (ingestion, transformations, feature refreshes) on a lakehouse. Each job produces the output for one logical date, its `run_date`. A run can fail and be retried automatically, and an engineer can start a **repair run** later, sometimes the next day, sometimes after a run already succeeded because the output was wrong. Downstream teams want one honest daily report: did each job deliver each date's output by its SLA?

**Problem Statement.** Write one PostgreSQL query that returns `run_date, job_id, runs, deadline, delivered_at, status, minutes_late`: one row per job and per date from `{{first_day}}` to `{{last_day}}` on which the job has a schedule in effect, ordered by `run_date, job_id`. The **deadline** is `run_date` plus the schedule's `schedule_time` (UTC) plus `sla_minutes`; it can fall on the next day. `runs` counts every row in `job_runs` for that job and `run_date`, whatever its type or state. A later successful run replaces the output, so the date's output is final when its **latest successful run** ends (the largest `end_ts` among runs with `result_state = 'SUCCESS'`): that time is `delivered_at`, or NULL if no run succeeded. `status` is `MET` if `delivered_at` is at or before the deadline, `LATE` if after it, `MISSED` if NULL. `minutes_late` is 0 for `MET`, the number of minutes after the deadline rounded **up** to a whole minute for `LATE`, and NULL for `MISSED`. {{schedule_rule}}

**Constraints.** One SQL statement (CTEs allowed). A run belongs to its `run_date`, not to the date it started or ended. The sample has {{runs}} runs.

**Assumptions.** Job names, schedules, SLAs and durations are hypothetical. "The latest successful run defines delivery" is this exercise's rule for jobs whose outputs are overwritten by repairs; check your own platform's semantics before reusing it.

**Clarifications.**
- Q: A repair run for Monday starts on Tuesday. Which date does it count for? | A: Monday: its `run_date`.
- Q: A run succeeded on time and a repair run succeeded an hour after the deadline. Is the date MET? | A: No. The repair replaced the output, so the date was final only after the deadline: LATE.
- Q: And if the repair after an on-time success failed? | A: A failed run delivers nothing and replaces nothing, so the on-time success stands: MET.
- Q: Is a run that ends exactly at the deadline on time? | A: Yes, the deadline is inclusive.
- Q: How is `minutes_late` rounded? | A: Up: 61 seconds late is 2 minutes.
- Q: Which time zone? | A: UTC throughout; the session is set to UTC.

**Hints.**
1. Build the report grain first: the dates in the window crossed with the jobs whose schedule is in effect, then attach runs to it.
2. `MAX(end_ts) FILTER (WHERE result_state = 'SUCCESS')` and `COUNT(*)` grouped by `job_id, run_date` give `delivered_at` and `runs` in one pass.
3. In PostgreSQL, `date + time` is a timestamp; `AT TIME ZONE 'UTC'` makes it a `timestamptz`, and `sla_minutes * INTERVAL '1 minute'` adds the SLA.

**Follow-ups.**
1. A downstream dashboard should show "SLA met" the moment the first success lands and flip to "restated" if a repair replaces it. What extra columns would you report, and from which rows?
2. Jobs now run in each team's own time zone, with `schedule_time` local. What happens to the deadline on daylight-saving days?
3. The runs table holds five years of history for 40 000 jobs and the report runs every 15 minutes. How would you make it incremental, and which runs can still change an old date's status?
4. Product wants an SLA percentage per job per month. Should a date with a later repair count as met, late or both, and how do you keep the number from silently changing after it was published?

**Follow-up rules.**
- when: min(end_ts), first success, first successful → ask: A run succeeded on time and a repair succeeded two hours later. What does your query report, and what did the consumers actually read at the deadline?
- when: date(start_ts), start_ts::date, cast(start_ts → ask: A repair run for Monday starts on Tuesday at 01:00. Which row does your query put it on?
- when: inner join, join job_runs → ask: A job was scheduled on a date but never started. Does that date appear in your result at all?
- when: run_type, run_type = 'scheduled' → ask: Why does the run type matter here? Show a date where filtering on it changes the status.
- when: ceil, ceiling, extract(epoch → ask: The run ended 30 seconds after the deadline. What does your expression return, and why is that the right rounding for a lateness report?

**Evaluation Criteria.** Report grain built from the window and the schedules, not from runs alone (Very Hard); runs attached by `run_date`; latest success defines delivery while failed repairs do not; deadline arithmetic across midnight in UTC; inclusive deadline; rounding up; the schedule in effect on each date (Very Hard); deterministic order; can discuss restatements, local time zones and incremental refresh.

## DBX-L1-02: Table freshness against upstream tables along the lineage

| | |
|---|---|
| **Template ID** | DBX-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / recursive CTEs over a dependency graph, as-of filtering, top-1 per group |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | DBX-L1-02.mjs |

**Business Scenario.** A lakehouse holds bronze (raw), silver (cleaned) and gold (business-level) tables, plus feature tables for models. Every table in the open table format keeps a commit history: one row per version with its timestamp and operation. A catalogue records which table reads which. When a gold table looks stale, the first question is: has anything upstream changed since this table was last refreshed, and how far behind is it?

**Problem Statement.** Write one PostgreSQL query that describes every table as of `{{as_of}}` and returns `table_name, last_change, staleness_minutes, ancestors, newer_ancestors, lag_minutes, newest_ancestor`, one row per table, ordered by `table_name`. A table's `last_change` is the latest `commit_ts` at or before `{{as_of}}` among its commits that change data: every operation except `OPTIMIZE` and `VACUUM`, which only rewrite or delete files. `staleness_minutes` is the whole minutes (rounded down) from `last_change` to `{{as_of}}`. The `lineage` table lists direct dependencies (`downstream` reads `upstream`); a table's **ancestors** are everything it depends on directly or indirectly, each counted once. `newer_ancestors` counts the ancestors whose `last_change` is strictly later than the table's own. `newest_ancestor` is the one among those with the latest `last_change` (ties: the smallest name), or NULL if there is none; `lag_minutes` is the whole minutes (rounded down) from the table's `last_change` to that ancestor's, or 0 if there is none. {{view_rule}}

**Constraints.** One SQL statement (CTEs allowed). The lineage is acyclic. There are {{objects}} objects in `catalog_objects`.

**Assumptions.** Table names, timestamps and lineage are hypothetical. Treating `OPTIMIZE` and `VACUUM` as non-data operations is this exercise's rule (they compact or remove files without changing table contents); check the current docs of your table format for the full list of operations and their data-change flags.

**Clarifications.**
- Q: Does an `OPTIMIZE` after the last write make the table fresher? | A: No. It rewrites files with the same data.
- Q: Commits after `{{as_of}}`? | A: Ignore them: the report describes the tables at `{{as_of}}`.
- Q: A table reaches the same bronze table through two silver tables. How many ancestors is that? | A: One.
- Q: Does a table count as newer if it changed at exactly the same second? | A: No, newer means strictly later.
- Q: How is a fraction of a minute treated? | A: Rounded down, for both staleness and lag.

**Hints.**
1. Compute the transitive closure first: a recursive CTE that starts from `lineage` and keeps joining `lineage` on the ancestor it has reached so far.
2. Use `UNION`, not `UNION ALL`, in the recursion so a pair reached by two paths appears once.
3. Join the closure to the per-table `last_change` twice (once for the table, once for the ancestor) and aggregate with `FILTER`; pick the newest ancestor with `DISTINCT ON` or `ROW_NUMBER()`.

**Follow-ups.**
1. A gold table depends on a slowly changing reference table that is updated monthly. How would you stop it from dominating "newest ancestor" alerts, without hiding real staleness?
2. The catalogue has 200 000 tables and the lineage graph is deep. How would you compute this every five minutes without recomputing the whole closure?
3. A table can be correct even when an upstream changed after it (for example, the upstream change is a late partition the table does not read yet). What finer-grained signal would you use instead of table-level timestamps?
4. The lineage itself changes over time. How would you answer "was this table stale at 09:00 last Tuesday" correctly?

**Follow-up rules.**
- when: union all → ask: Your recursion uses UNION ALL. What happens to the ancestor counts when a table reaches the same source through two paths?
- when: optimize, vacuum → ask: Why should an OPTIMIZE commit not count as a change? Show a table whose answer changes if it does.
- when: recursive → ask: How does your recursive CTE terminate, and what would happen if the lineage had a cycle?
- when: inner join, join table_commits → ask: Where in your query does the walk pass through a node with no commits, such as a view?
- when: max(commit_ts) → ask: Which commits are inside that MAX? Name the two filters it needs.

**Evaluation Criteria.** Data-changing commits only, at or before the as-of time (Hard+); a recursive closure with distinct ancestors (diamonds, Hard+); strictly-newer comparison; the newest ancestor with a deterministic tie-break; minutes rounded down; views traversed but not reported or counted (Very Hard); deterministic order; can discuss incremental closure, partition-level freshness and lineage history.

## DBX-L1-03: Idle minutes on interactive clusters before auto-termination

| | |
|---|---|
| **Template ID** | DBX-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps and islands, interval merging with running MAX, LEAD, capped sums |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | DBX-L1-03.mjs |

**Business Scenario.** Teams share interactive (all-purpose) compute clusters for notebooks and ad-hoc jobs. An interactive cluster keeps running, and costing money, between pieces of work until it has been idle for its **auto-termination** time; job clusters, by contrast, exist only for the run they serve. A FinOps review wants, per owning team, how much interactive cluster time was busy, how much was idle while waiting to auto-terminate, and how often clusters had to be started again.

**Problem Statement.** Write one PostgreSQL query that returns `owner, clusters, runs, busy_minutes, idle_minutes, starts, idle_share` for activity up to `{{as_of}}`: one row per owner with at least one run on an `interactive` cluster, ordered by `idle_minutes` descending, then `owner`. Only interactive clusters count, and only those with at least one run. Runs on the same cluster can overlap; a cluster is **busy** whenever at least one run is executing (merge overlapping or touching runs into busy intervals). Between two busy intervals with a gap of `g` seconds, a cluster with auto-termination `T` minutes is idle for `min(g, T·60)` seconds; if `g ≥ T·60` it terminated and was **started again** by the next run. After its last busy interval it is idle for `min(T·60, seconds until {{as_of}})`. `starts` is 1 per cluster plus each restart. `busy_minutes` and `idle_minutes` are summed per owner and rounded to 2 decimals; `idle_share` is idle ÷ (idle + busy) per owner, rounded to 4 decimals. {{extra_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{runs}} runs. Cluster start-up time and pricing are out of scope.

**Assumptions.** Teams, clusters and times are hypothetical. Terminating after exactly `T` idle minutes, and treating a run that starts at that instant as a new start, is this exercise's simplified model; real auto-termination also depends on what counts as activity (check current docs).

**Clarifications.**
- Q: Two notebooks run on the same cluster at the same time. Is that double the busy time? | A: No. Busy time is the union of the run intervals.
- Q: One run ends at 10:00:00 and the next starts at 10:00:00. Is there a gap? | A: No: they form one busy interval.
- Q: A gap of exactly `T` minutes? | A: The cluster was idle for `T` minutes, had just terminated, and was started again: one restart.
- Q: Does an interactive cluster that never ran count? | A: No. Only clusters with at least one run.
- Q: What about job clusters? | A: Exclude them; they are not idle between runs.

**Hints.**
1. Order each cluster's runs by `start_ts` and compute the latest `end_ts` among all **earlier** runs with `MAX(end_ts) OVER (… ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`. A run that starts after it begins a new busy interval.
2. A running `SUM` of that "starts a new interval" flag numbers the islands; group by it to get each busy interval's start and end.
3. `LEAD(start)` over the islands gives each gap; the last island's gap runs to `{{as_of}}`. Cap with `LEAST`.

**Follow-ups.**
1. Recommend an auto-termination time per team from this data. What would you compute, and what does a shorter time cost the people using the cluster?
2. A cluster takes about five minutes to start. How would you account for start-up time in "idle" and in the recommendation?
3. This must run daily across every workspace with billions of run events. How would you partition the work so that a busy interval crossing midnight is still measured correctly?
4. Some interactive clusters keep a notebook attached that polls every minute, so they never look idle. How would you detect clusters that are "busy" but doing no useful work?

**Follow-up rules.**
- when: lag(end_ts), lag(end_ts) over, previous run → ask: A long run contains a short one, and the next run starts after the short one ends but before the long one ends. What gap does your query compute?
- when: sum(end_ts - start_ts), sum of durations, sum(duration → ask: Two runs overlap for half an hour. How much busy time does your query report for that half hour?
- when: least, min(gap → ask: Which comparison decides a restart, and what happens at a gap of exactly T minutes?
- when: cluster_type → ask: Why are job clusters excluded? What would including them do to idle_share?
- when: gaps and islands, island → ask: What starts a new island in your query: the previous run's end, or the latest end so far? Show a case where they differ.

**Evaluation Criteria.** Interactive clusters only, and only with runs; busy time as merged intervals (Hard+); gaps measured from the latest end so far, not the previous row (Hard+); idle capped at the auto-termination time with an inclusive restart rule; the trailing idle up to the as-of time; disabled auto-termination and still-running runs (Very Hard); correct rounding and order; can discuss choosing a termination time and detecting fake activity.

## DBX-L1-04: Stage DAG — critical path and makespan on a fixed number of slots

| | |
|---|---|
| **Template ID** | DBX-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Graphs / topological sort, longest path in a DAG, heaps, discrete-event simulation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | DBX-L1-04.mjs |

**Business Scenario.** A distributed query engine such as Apache Spark splits a job into stages connected by shuffles: a stage can start only when every stage it reads from has finished. A capacity planner for a lakehouse platform wants two numbers for a job before buying more executors: the **critical path** (the fastest the job could ever finish, with unlimited slots) and the **makespan** it actually gets on `slots` executor slots under a simple priority rule.

**Problem Statement.** Implement `schedule(stages, slots)`. Each stage is `(stage_id, tasks, task_seconds, deps)`: `deps` lists the stage ids it depends on. {{task_rule}} A stage's **bottom level** is its `task_seconds` plus the largest bottom level among the stages that depend on it (0 if none). Return `(critical_path_seconds, critical_path, makespan)`: `critical_path_seconds` is the largest bottom level; `critical_path` is the list of stage ids found by starting at the stage with the largest bottom level and repeatedly moving to the dependent stage with the largest bottom level, until a stage has no dependents (ties at every step: the smaller `stage_id`). `makespan` comes from simulating, from time 0: whenever slots are free, give them to the **ready** stage with the largest bottom level (ties: the smaller `stage_id`), starting as many of its remaining tasks as there are free slots, and continue with the next ready stage while slots remain. A stage is ready once all its dependencies have finished; tasks that finish at time `t` free their slots, and make their dependents ready, before anything starts at `t`. Started tasks run to completion. `makespan` is the time the last task finishes. {{invalid_rule}}

**Constraints.** Up to 30 000 stages and 120 000 dependencies; 1 ≤ `task_seconds` ≤ 10⁴; 1 ≤ `slots` ≤ 1 000; stage ids are unique integers. The list is in no particular order. O((n + E) log n) is expected.

**Assumptions.** Durations are hypothetical and fixed; a real scheduler has speculative execution, locality, retries and variable task times, none of which are modelled here.

**Clarifications.**
- Q: Does the critical path depend on `slots`? | A: No. It assumes unlimited slots: each stage takes `task_seconds`.
- Q: A dependency finishes at t = 10 and a slot is free. Can the dependent start at t = 10? | A: Yes. Finishes at a time are processed before starts at that time.
- Q: Is the priority fixed, or does it change during the run? | A: Fixed: each stage's bottom level, computed once.
- Q: The highest-priority ready stage needs fewer slots than are free. What happens to the rest? | A: They go to the next ready stage by priority, at the same instant.
- Q: Is the list order meaningful? | A: No. It is not a topological order.

**Hints.**
1. Build the dependents lists and in-degrees; Kahn's algorithm gives a topological order and detects a cycle at the same time (fewer stages come out than went in).
2. Bottom levels: walk the topological order backwards.
3. For the simulation keep two heaps: ready stages keyed by `(-bottom_level, stage_id)`, and running batches keyed by finish time. Jump from one finish time to the next; never step second by second.

**Follow-ups.**
1. Prove that the makespan is never below the critical path, and never below the total task-seconds divided by `slots`. When does list scheduling come close to the larger of the two?
2. One stage's tasks are skewed: one task takes 20× the median. How does that change both numbers, and what would you change in the model?
3. The planner asks: "how many slots until more stop helping?" How would you answer from this function without trying every value?
4. Stages now have a memory requirement and each slot has a memory limit, so some stages need two slots per task. How does the priority rule change, and what can go wrong?

**Follow-up rules.**
- when: recursion, recursive, dfs → ask: The longest dependency chain is 20 000 stages. What happens to your recursive version in CPython, and how would you make it iterative?
- when: sort by duration, longest task first, longest stage first, by duration → ask: Why is the priority the bottom level rather than the stage's own length? Give a three-stage example where they disagree.
- when: every second, time step, tick → ask: Task times go up to 10 000 seconds. How many iterations does a per-second loop make, and how do you jump between events instead?
- when: scan, for each stage, list of ready → ask: How many times does your loop look at each stage over the whole run? What does that cost with 30 000 stages?
- when: topological, kahn → ask: How does your topological sort tell you there was a cycle, and what do you return then?

**Evaluation Criteria.** Correct bottom levels and a deterministic critical path; finish-before-start ordering at equal times; a fixed priority with id tie-break; slots given to the next ready stage when the top one needs fewer; invalid input returns None (Hard+); multi-task stages occupy several slots and finish with their last task (Very Hard); O((n + E) log n) with heaps; can reason about lower bounds, skew and slot counts.

## DBX-L1-05: Table snapshots from a transaction log with checkpoints

| | |
|---|---|
| **Template ID** | DBX-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps / log replay, binary search, offline query batching |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, data-architect, ml-platform-engineer |
| **Generator** | DBX-L1-05.mjs |

**Business Scenario.** An open table format stores a table as data files plus a transaction log: each version is a commit listing files added and removed, and every so often a **checkpoint** records the complete list of active files so readers do not have to replay the whole log. Time travel ("read the table as of version 1 742") rebuilds the file list at that version. A storage audit wants the number of files and bytes for thousands of historical versions at once.

**Problem Statement.** Implement `snapshot_sizes(commits, checkpoints, versions)`. `commits` maps a version to its list of actions, each `("add", path, size)` or `("remove", path)`. `checkpoints` maps a version to the full list of `(path, size)` active **after** that version. To rebuild version `v`: start from the checkpoint with the largest version `c ≤ v` (or from an empty table before version 0 if there is none), then apply commits `c+1, …, v` in order, each commit's actions in list order. An `add` makes the path active with that size (replacing the size if it was already active); a `remove` makes it inactive (a `remove` of a path that is not active does nothing). For each entry of `versions`, return `(file_count, total_bytes)` of the rebuilt version, in the same order. The latest version is the largest version that has a commit or a checkpoint. {{log_rule}}

**Constraints.** Up to 3 000 versions, 30 000 queries, and checkpoints of up to 10 000 files; queries can repeat and come in any order. Rebuilding every query from scratch is too slow: aim for each commit to be replayed about once.

**Assumptions.** Paths, sizes and the checkpoint interval are hypothetical. This is a simplified model of a table-format log (no metadata, protocol or deletion-vector actions, single-file checkpoints); check the format's current specification for the real reconciliation rules.

**Clarifications.**
- Q: Is a checkpoint at version `c` the state before or after commit `c`? | A: After: it already includes commit `c`.
- Q: If the commit file for a checkpoint's own version is missing, can I still read that version? | A: Yes. The checkpoint is enough; commit `c` is never replayed when starting from checkpoint `c`.
- Q: A table whose files were all removed? | A: It exists: `(0, 0)`, not `None`.
- Q: Can I trust a checkpoint over replaying the log from an older checkpoint? | A: Always start from the latest checkpoint at or below the version, as specified.
- Q: Should I raise on a version I cannot rebuild? | A: No. Return `None` for it and carry on.

**Hints.**
1. Sort the checkpoint versions once; `bisect_right` finds the base checkpoint for any version in O(log K).
2. Group the queries by base checkpoint and sort each group by version: one forward replay per group answers every query in it.
3. Keep a running `total_bytes` as you apply actions, adjusting by the old size on a re-add, so a query never sums the whole file list.

**Follow-ups.**
1. Readers usually want the latest version. How does a reader find the newest checkpoint without listing the whole log directory, and what happens if that pointer is stale?
2. Two writers commit version 1 801 at the same moment. How does the log make exactly one of them win, and what must the loser do before retrying?
3. Checkpoints of a table with ten million files are huge. How would you make them cheaper to write and to read for a query that needs one partition?
4. Old log files are cleaned up after a retention period. What does that do to time travel, and how would you report which versions are still readable?

**Follow-up rules.**
- when: replay from 0, from version 0, from the beginning → ask: Commits below version 400 were cleaned up. What does your code return for version 1 000, and is that right?
- when: bisect, binary search → ask: Which bisect gives the checkpoint at or below v, and what happens when v is exactly a checkpoint version?
- when: sum(, sum of sizes → ask: How many times does your code add up the file sizes over 30 000 queries, and how would you avoid it?
- when: copy, deepcopy, dict( → ask: How many times do you copy a checkpoint's file list? Could you copy it once per checkpoint instead of once per query?
- when: put_if_absent, conflict, optimistic → ask: Two writers both read version 1 800 and both try to write 1 801. What exactly makes one fail, and what does it check before retrying?

**Evaluation Criteria.** Correct base checkpoint (after-commit semantics); actions in order with replace and ignore rules; empty table versus None; None for out-of-range and unrebuildable versions without raising (Hard+); a missing commit poisoning only the versions that need it (Very Hard); one replay per checkpoint group with a running total; can discuss checkpoint discovery, commit conflicts and retention.
