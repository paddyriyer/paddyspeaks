# Snowflake · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a cloud data
platform: virtual warehouses that run queries, storage, data sharing, a data
marketplace and ingestion from cloud storage. These are not questions from any
company's interviews. Every workload, number, rule and schema is hypothetical; where
a rule resembles public product behaviour it is this exercise's rule, so check
current docs. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SNO-L2-01: Multi-cluster warehouse simulation — queueing, scale-out and scale-in, wait times and credits

| | |
|---|---|
| **Template ID** | SNO-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Simulation / discrete events, queues and heaps, billing rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer |
| **Generator** | SNO-L2-01.mjs |

**Business Scenario.** A cloud data platform runs queries on virtual warehouses. A multi-cluster warehouse can add clusters of the same size when queries start to queue and shut them down when they sit idle, and each running cluster consumes credits by the second. The team that owns the warehouse `{{warehouse}}` wants to replay a day's query trace against a candidate scaling policy before changing it: how long did queries wait, how many clusters ran at the peak, and what would it cost? The policy below is this exercise's simplified version; real scaling policies differ, so check current docs.

**Problem Statement.** Implement `simulate_warehouse(queries, policy)`. `queries` is a list of `(query_id, arrival_s, duration_s)` in arrival order; queries that arrive in the same second queue in list order. `policy` has `slots` (queries one cluster runs at once), `min_clusters`, `max_clusters`, `startup_s`, `idle_s` and `credits_per_hour` (per cluster). The warehouse resumes at the first arrival with `min_clusters` clusters, numbered from 1 and ready at once; each later cluster gets the next number. At every second `t`, apply these steps in order:
1. Queries that finish at `t` (start + duration) free their slots. A cluster left with nothing running is idle from `t`.
2. A cluster whose startup ends at `t` becomes ready, idle from `t`.
3. Queries that arrive at `t` join the back of the queue.
4. While the queue is not empty and a ready cluster has a free slot, the query at the head starts on the **lowest-numbered** ready cluster with a free slot. Its wait is `t − arrival_s`.
5. **Scale out.** If the queue is still not empty, no cluster is starting, and there are fewer than `max_clusters` clusters (ready or starting), a new cluster starts; it becomes ready at `t + startup_s`.
6. **Scale in.** Every ready cluster that has been idle for at least `idle_s` seconds shuts down at `t`, highest number first, as long as more than `min_clusters` clusters (ready or starting) remain.

The replay ends at the second the last query finishes, and every cluster still on stops then. Each cluster is billed from the second it started until it stopped, with a minimum of 60 seconds per cluster start. Return `(max_wait, total_wait, peak_clusters, billed_seconds, credits)`: `peak_clusters` is the most clusters (ready or starting) at any second, `billed_seconds` is summed over clusters, and `credits = billed_seconds × credits_per_hour / 3600` rounded to 3 decimal places. With no queries, return `(0, 0, 0, 0, 0.0)`. {{size_rule}} {{level_rule}}

**Constraints.** Up to 100 000 queries; a trace can span months, with quiet gaps of hours or days between bursts. All times are non-negative integers in seconds; `duration_s ≥ 1`, `startup_s ≥ 1`, `idle_s ≥ 1`, `slots ≥ 1`, `1 ≤ min_clusters ≤ max_clusters ≤ 10`. Stepping through every second of the trace is far too slow; the intended solution is close to O(n log n + n · max_clusters).

**Assumptions.** The policy, sizes, credit rates and the trace are hypothetical. Every query takes the same time on any cluster and never fails. The warehouse does not suspend between the first arrival and the last finish. The 60-second minimum per cluster start and per-second billing are this exercise's rules; check current docs for the platform's billing.

**Clarifications.**
- Q: Can a query start in the same second another finishes? | A: Yes. Finishes free slots first (step 1), then arrivals queue (step 3), then dispatch runs (step 4).
- Q: Why the lowest-numbered cluster, not the least loaded one? | A: Packing work onto low numbers lets the high-numbered clusters go idle and shut down. It is part of the policy you are replaying.
- Q: Can several clusters start at once when the queue is long? | A: No. A new cluster starts only when no other cluster is starting, so a long queue adds one cluster per `startup_s`.
- Q: Is a cluster that is still starting counted against `max_clusters` and `min_clusters`? | A: Yes, in both. It is not ready, so it cannot run queries yet.
- Q: A query arrives in exactly the second an idle cluster reaches `idle_s`. Does the cluster shut down? | A: No. Dispatch (step 4) runs before scale-in (step 6), so the query starts on it and it is no longer idle.
- Q: What if a cluster is still starting when the last query finishes? | A: It stops then, and it is billed the 60-second minimum.

**Hints.**
1. Between two interesting seconds nothing changes. List the kinds of second that can change state: an arrival, a finish, a cluster becoming ready, and an idle cluster reaching `idle_s`.
2. Keep finishes in a min-heap of `(finish_second, cluster)`. The next second to process is the smallest of the next arrival, the heap's top, the starting cluster's ready time and the idle deadlines.
3. An idle cluster's deadline only matters while there are more than `min_clusters` clusters. When can a cluster be idle while the queue is non-empty?

**Follow-ups.**
1. Add a second policy that starts a cluster only when the queue is expected to keep it busy for several minutes. What would you need to estimate, and how would you compare the two policies on cost and on p95 wait?
2. Queries on a real warehouse slow down when more of them share a cluster. How would you change the model so that duration depends on the cluster's load, and what happens to your event loop?
3. Finance wants the cost of each query, not just the warehouse. How would you attribute the billed seconds, including the idle seconds and the 60-second minimums, to queries and to the teams that ran them?
4. The trace has 50 million queries across thousands of warehouses. How would you run the replay for every warehouse and every candidate policy, and what would you keep from each run?

**Follow-up rules.**
- when: every second, for t in range, tick, ticks → ask: The trace spans months. How many iterations is that, and which seconds can you skip without changing the answer?
- when: heapq, heap, priority queue → ask: What exactly is in your heap, and how do you make sure the idle deadlines and the starting cluster's ready time are not missed?
- when: least loaded, fewest running, round robin → ask: Your dispatch spreads queries across clusters. What does that do to scale-in and to the bill, compared with packing onto the lowest number?
- when: float, round( → ask: Where does your billing first become a float, and would rounding each cluster's credits separately change the total?
- when: sort the queue, sorted queue, re-sort → ask: The queue is first in, first out. What does sorting it each second cost when a burst leaves 5 000 queries waiting?

**Evaluation Criteria.** Correct replay of all six steps in order, including same-second finishes, arrivals and readiness; one starting cluster at a time; `min_clusters` and `max_clusters` counted with starting clusters; packing onto the lowest number; billing per cluster start with the 60-second minimum and the stop at the last finish; the empty trace; an event-driven loop that jumps between interesting seconds with a heap, not a second-by-second loop; a clear complexity argument; credible answers on load-dependent durations and cost attribution.

## SNO-L2-02: Join ordering — the cheapest left-deep order by dynamic programming over subsets

| | |
|---|---|
| **Template ID** | SNO-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / subset DP, query optimisation, exact integer arithmetic |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |
| **Generator** | SNO-L2-02.mjs |

**Business Scenario.** A cloud data warehouse compiles every SQL query into a plan before a virtual warehouse runs it, and the order of the joins can change the work by orders of magnitude. The compiler estimates rows from table metadata. Analysts' dashboards join large fact tables to filtered dimensions, and you are asked to write the part of a simplified, teaching-sized compiler that picks the cheapest left-deep join order from given row estimates. The cost model here is this exercise's model, not any engine's.

**Problem Statement.** Implement `best_join_order(tables, predicates, allow_cross=True)`. `tables` maps each table name to its estimated rows after filters. `predicates` is a list of `(a, b, d)`: a join predicate between tables `a` and `b` that keeps one of every `d` row pairs; several predicates on one pair multiply. The estimated rows of a set of tables `S` is `rows(S) = floor(∏ rows of the tables in S / ∏ d of the predicates with both tables in S)`, computed exactly with integers. A left-deep order `t1, t2, …, tn` joins the result so far with one base table at a time; joining prefix `P = {t1 … tk−1}` with `tk` costs `rows(P) + rows({tk}) + rows(P ∪ {tk})`. The plan's cost is the sum over its joins; the first scan is free. Return `(cost, order)` for the cheapest order. If several orders cost the same, return the lexicographically smallest list of names. With `allow_cross=False`, every table after the first must share a predicate with a table already joined; if no order does, return `None`. With no tables, return `(0, [])`; with one, `(0, [name])`. {{level_rule}}

**Constraints.** Up to 16 tables and 40 predicates. Rows and `d` are positive integers; estimates can far exceed 2⁶³. Trying every order is n! (over 10¹³ for 16 tables); something close to O(2ⁿ · n) is expected, with the row estimate of each subset computed once.

**Assumptions.** Row estimates and selectivities are hypothetical; a real compiler also uses histograms, distinct counts, pruning statistics and run-time feedback. Only left-deep orders are considered here. Every predicate names two different tables in `tables`.

**Clarifications.**
- Q: Is the cost symmetric in the first two tables? | A: Yes, `rows({a}) + rows({b}) + rows({a, b})` either way, which is why ties are common and the lexicographic rule matters.
- Q: Do I round each join's estimate, or the final cost? | A: Each `rows(S)` is rounded down on its own, from the exact product: multiply first, divide once. The cost is a sum of those integers.
- Q: Does `rows(S)` depend on the order the tables were joined in? | A: No. It depends only on the set, which is what makes a dynamic programme possible.
- Q: What does lexicographically smallest mean for lists of names? | A: Compare the first names; if equal, the second; and so on, using ordinary string comparison.
- Q: With `allow_cross=True`, may I start with two tables that share no predicate? | A: Yes. A cross product of two tiny filtered dimensions is sometimes the cheapest start.

**Hints.**
1. The cost of the next join depends only on the set already joined and the table added. Let `best[P]` be the cheapest cost to finish the plan when the tables in `P` are already joined.
2. Precompute `rows(S)` for every subset from a smaller subset: add one table, multiply its rows into the numerator and the `d` of its predicates into `S` into the denominator.
3. For the lexicographic rule, first compute `best` for every set, then rebuild the order from the front: at each step pick the smallest name that keeps the total optimal.

**Follow-ups.**
1. Bushy plans can join two intermediate results. Extend the DP to bushy trees for this cost model. What is the new complexity?
2. The row estimate for one dimension was off by 1 000× because its filter is on a correlated column. How would you make the chosen plan robust to estimate errors?
3. Twenty-five tables appear in a generated query. What do you do when the exact DP is out of reach, and how do you bound how far from optimal you are?
4. The engine can change join order at run time when it sees actual row counts. What would you measure during execution, and when is it worth re-planning?

**Follow-up rules.**
- when: greedy, smallest first, smallest table first → ask: Build a three-table query where joining the smallest result next is not optimal. What does your greedy miss?
- when: permutations, itertools.permutations, every order → ask: How many orders are there for 16 tables, and how long would costing each one take?
- when: float, math.prod, division → ask: The estimates exceed 2⁶³. Where could floating point change your answer, and how do you keep it exact?
- when: lru_cache, memo, recursion → ask: What is the key of your memo, how many states does it hold, and is the recursion depth a concern?
- when: bushy → ask: For this cost model, is a bushy plan ever cheaper than every left-deep one? Give an example or an argument.

**Evaluation Criteria.** A DP over subsets with each subset's estimate computed once and exactly; correct costs including the free first scan; the lexicographic tie rule; `None` only when cross products are forbidden and the graph is disconnected; the empty and single-table cases; integer arithmetic for estimates beyond 64 bits; a clear complexity argument; sensible answers on bushy plans, estimate errors and very large joins.

## SNO-L2-03: Debug a semi-structured JSON flattener — nested arrays, nulls, key collisions and paths

| | |
|---|---|
| **Template ID** | SNO-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Semi-structured data / recursive flattening, paths, nulls, depth limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, staff-data-engineer |
| **Generator** | SNO-L2-03.mjs |

**Business Scenario.** Raw `{{source}}` events land in a cloud warehouse as JSON documents in a semi-structured column. A helper flattens each document into one row of `path → value` pairs, and those pairs feed a column-discovery job and a data-quality check. Several complaints arrive. A data-quality rule says that no orders ever have a null coupon, which is not true. Customers with no tags vanish from a count of customers by number of tags. Two fields, `id` and `ID`, are reported as one. A field named `ip address` is reported as if it were nested. With a depth limit set, one level too many is expanded. The helper below is the suspect. Its path syntax is this exercise's, close to but not the same as the platform's own path notation.

**Problem Statement.** Fix `flatten_records(records, max_depth=None)` so that it meets this specification. `records` is a list of JSON objects (Python dicts); return one dict per record, in order. {{replay_rule}}
1. **Paths.** A top-level key `k` has path `k`. A key `k` inside an object at path `p` has path `p.k`. An array element at index `i` has path `p[i]`. Indexes start at 0.
2. **Quoting.** A key that is not a plain identifier (letters A–Z or a–z, digits and `_`, not starting with a digit) is written as `["k"]` instead, with no dot before it, and any `\` or `"` inside it is escaped with a backslash: `geo["ip address"]`, `["x-ray"].on`. Keys are case-sensitive: `id` and `ID` are different paths.
3. **Leaves.** Strings, numbers, booleans and JSON nulls (`None`) are leaves: the row maps the path to the value, and a null is kept. An empty object or empty array is also a leaf, kept as `{}` or `[]`.
4. **Depth.** A value's depth is the number of path segments to it, so a top-level value has depth 1. When `max_depth` is set, an object or array at depth `max_depth` is not expanded: it is a leaf, kept whole. With `None`, there is no limit.
5. **Records.** The record itself is never a leaf: an empty record gives an empty row `{}`.

**Constraints.** Keep the function's name, arguments and output format. Up to 15 000 documents and a million leaves, processed in linear time. Keys can be any string.

**Assumptions.** Documents and field names are hypothetical. Every record is a dict; JSON has already been parsed. Duplicate keys inside one JSON object were resolved by the parser before this step.

**Clarifications.**
- Q: Should a null field appear in the row? | A: Yes, as `None`. A null field and a missing field mean different things to the data-quality check.
- Q: Why keep `{}` and `[]`? | A: So that "has no tags" stays visible. A row without the path cannot be told apart from a document that never had the field.
- Q: Is `user_id` an identifier? Is `2fa`? Is `café`? | A: `user_id` is. `2fa` starts with a digit, so it is quoted. `café` has a letter outside A–Z, so it is quoted too.
- Q: With `max_depth=2`, what happens to `{"a": {"b": {"c": 1}}}`? | A: `a` is at depth 1 and is expanded; `a.b` is at depth 2, so it is kept whole: `{"a.b": {"c": 1}}`.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Flatten `{"coupon": null, "tags": []}` by hand, then run it through the code.
2. Read the comment next to the line that changes keys. Is it true of JSON keys?
3. Write down the depth of `a`, `a.b` and `a.b.c`, then read the condition that decides whether to expand.
4. List keys that need quoting: a dot, a space, a hyphen, a leading digit, a quote. Which of them does `_segment` catch?

**Follow-ups.**
1. A column-discovery job turns paths into typed columns. One document has `price` as a number and another as a string. What should the column's type be, and what happens to the values that do not fit?
2. Arrays of line items make one row per record very wide. When would you flatten an array into one row per element instead, and what keys do you carry onto each row?
3. A producer renames `userId` to `user_id` mid-month. How would you detect it from the flattened output, and what would you tell the consumers?
4. The flattener runs inside the warehouse's ingestion, on billions of documents a day. What would you push into SQL (a flatten function over the semi-structured column) and what would you keep in code?

**Follow-up rules.**
- when: lower(), lower, casefold, case-insensitive → ask: Two fields, `id` and `ID`, are both present. What does your version return, and who decides whether they are the same field?
- when: isidentifier → ask: `str.isidentifier()` accepts `café` and other non-ASCII letters. Does that match the specification, and what would you use instead?
- when: recursion, recursive, recursionerror → ask: A malicious document is nested 5 000 levels deep. What happens to your recursion, and how would you avoid it?
- when: json.dumps, str(value), repr → ask: Why would turning a nested value into a string be a problem for the column-discovery job that reads these rows?
- when: is not none, if value → ask: Which values does that condition drop, and which of them should be kept?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; nulls kept; empty objects and arrays kept as values while an empty record stays an empty row; case-sensitive keys; complete quoting with escapes; the depth boundary at exactly `max_depth`; minimal, linear fixes; a regression test per bug.

## SNO-L2-04: Bulk loading from cloud storage with load history and deduplication

| | |
|---|---|
| **Template ID** | SNO-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / file ingestion, load metadata, idempotency, deduplication |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_files": {"2": ["40,000", "120,000"], "3": ["1.5 million", "4 million"]},
  "partners": ["35", "180", "900"],
  "file_size": ["2 KB to 50 MB", "100 MB to 4 GB"],
  "history_days": [64, 14],
  "redelivery": ["the same file name with corrected contents", "a full re-send of the last 30 days under new file names"]
}
```

**Business Scenario.** A cloud data platform loads files from cloud object storage into tables. Each table remembers which files it has already loaded for a limited time, so a repeated load skips them; in this exercise that load history is kept for {{history_days}} days (this exercise's rule; check current docs for the platform's actual retention, which differs between bulk and continuous loading). A retail data team receives about {{daily_files}} files a day, sized {{file_size}}, from {{partners}} partners who drop sales, inventory and returns files into one bucket. Partners sometimes re-send data as {{redelivery}}. The team needs every row loaded once, nothing lost, and an answer to "was this file loaded, when, and with how many rows?"

**Problem Statement.** Design the ingestion from the bucket to the warehouse tables. Cover how new files are discovered (listing versus event notifications), how loads are batched and sized, what makes a retried or repeated load harmless at the file level and at the row level, what happens once a file is older than the load history, how corrected re-sends and full re-sends are handled, schema drift and bad rows, your own audit table of loads, and the metrics and alerts that show the pipeline is healthy.

**Constraints.** A partner's late or corrected file must replace the rows it corrects, never add to them. A load can fail half-way and be retried. Event notifications can be delayed, duplicated or lost. Some files arrive weeks late. The warehouse is billed by compute time, so loading many tiny files one at a time is expensive.

**Assumptions.** All volumes, partner counts, retention periods and formats are hypothetical. Files are CSV or JSON with a header or a schema per partner. Each row carries the partner's own business key (for example store, SKU and business date) and the partner's extract time.

**Clarifications.**
- Q: How does the platform decide a file was already loaded? | A: In this exercise, by its path and a checksum of its contents, for as long as the load history lasts. A changed file under the same name is treated as new.
- Q: What happens to a file older than the history? | A: The platform can no longer tell whether it was loaded. In this exercise it skips it by default and can be told to load it anyway. Decide what your pipeline does.
- Q: Are rows unique across files? | A: Not necessarily. A re-send repeats rows, and a correction changes some of them. Rows are unique per partner business key and extract time.
- Q: Who needs the audit? | A: Partner support ("did you get our file?") and finance, who reconcile partner totals monthly.

**Hints.**
1. Separate "was this file loaded" (file level) from "is this row already in the table" (row level). The load history only answers the first, and only for a while.
2. Keep your own manifest of files and their outcomes, keyed by path and checksum, with no expiry.
3. Load raw files into a landing table with the file name and row number, then merge into the modelled table by business key, keeping the latest extract.

**Follow-ups.**
1. A partner re-sends {{redelivery}}. Walk through what each layer does, and how you prove no row was double counted.
2. Event notifications were lost for six hours. How do you find the missing files, and how do you know you found all of them?
3. One partner adds a column and changes a date format on the same day. What happens to that day's loads, and what do the other partners see?
4. Finance asks for the load history of a file from 200 days ago. Where does that answer come from?
5. At {{daily_files}} files a day, most under a megabyte, compute cost doubles. What do you change in batching and file sizes?

**Follow-up rules.**
- when: force, force=true, reload everything → ask: Forcing a reload skips the platform's duplicate check. What stops that from loading a file twice into the final table?
- when: file name, filename, file path, same name → ask: A partner sends a corrected file under the same name. Does your design load it, and what happens to the rows it corrected?
- when: merge, upsert → ask: What is your merge key, and what happens when two files in one batch carry the same key with different extract times?
- when: notification, notifications, event-driven, queue → ask: Notifications can be lost. What runs alongside them so that a lost notification is noticed?
- when: exactly once, exactly-once → ask: Which part of your design gives exactly-once at the row level: the platform's load history, your manifest, or the merge? Why?

**Production Reality Check.**
- Load history is kept for {{history_days}} days in this exercise. A partner re-uploads a file from {{history_days}} days and one hour ago under its original name and unchanged contents.
- A partner's export job is fixed and re-sends {{redelivery}}. That morning the sales table's revenue for the period rises by 9%.
- Event notifications from the bucket stop for six hours during a cloud-provider incident. Dashboards show no errors, only lower row counts.

**Evaluation Criteria.** Clear split between file-level and row-level idempotency; a durable manifest beyond the platform's load history; a landing table with file lineage and a merge by business key with a deterministic tie rule; a stated policy for files older than the history; corrected and full re-sends replacing rows, never adding; listing reconciliation behind notifications; schema drift and bad rows isolated per partner; batching sized for compute cost; health metrics (files discovered versus loaded, lag, rejected rows, duplicates suppressed); a plan for each incident.

## SNO-L2-05: Zero-downtime migration from a legacy warehouse — dual running and reconciliation

| | |
|---|---|
| **Template ID** | SNO-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / migration, parallel runs, reconciliation, cutover and rollback |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-architect, staff-data-engineer, senior-data-engineer, data-engineer, analytics-engineer |

```params
{
  "legacy": ["an on-premises MPP appliance", "a Hadoop cluster with Hive tables", "a self-managed PostgreSQL warehouse"],
  "tables": {"2": ["600", "1,500"], "3": ["8,000", "20,000"]},
  "data_size": {"2": ["40 TB", "120 TB"], "3": ["900 TB", "2.5 PB"]},
  "consumers": ["300 dashboards and 40 scheduled extracts", "2,000 dashboards, 150 extracts and 30 downstream applications"],
  "deadline": ["9 months, when the hardware support contract ends", "6 months, before the data centre closes"]
}
```

**Business Scenario.** A company runs its reporting on {{legacy}} with about {{tables}} tables and {{data_size}} of data, feeding {{consumers}}. It is moving to a cloud data platform, and the hardware must be gone in {{deadline}}. Leadership's condition is that no report is wrong and no consumer is down on the day it moves. Nightly loads keep changing the data during the whole migration, and the two systems' SQL dialects differ in data types, NULL and empty-string handling, time zones, rounding and case sensitivity.

**Problem Statement.** Design the migration. Cover the inventory and the order in which tables, pipelines and consumers move; the initial copy and how the cloud copy keeps up while the legacy system is still the source of truth; how SQL and pipelines are translated and tested; dual running and the reconciliation that proves the two systems agree (what you compare, at what grain, with which tolerances); how each consumer is cut over and rolled back; when the legacy system is finally switched off; and how you report progress to leadership.

**Constraints.** No consumer may be offline during its cutover. The legacy system has little spare capacity, so extraction and reconciliation queries cannot run at peak hours. Some tables are updated in place by nightly jobs. The budget allows both systems to run in parallel for a limited time only. Some consumers are owned by other teams.

**Assumptions.** All sizes, counts, deadlines and system types are hypothetical. Network transfer and storage costs are known. Both systems can export data to object storage. The cloud platform's SQL dialect is documented, and an automated translator handles most but not all of the SQL.

**Clarifications.**
- Q: Do we move everything at once? | A: That is your decision. Leadership wants to know the risk of each option.
- Q: Are differences ever acceptable? | A: Only explained ones, such as a documented rounding or time-zone rule. Every difference must be classified.
- Q: Who owns the consumers? | A: Analytics owns most dashboards. Finance owns the extracts, and three product teams own applications that read tables directly.
- Q: Can consumers switch back after cutover? | A: They must be able to, until the legacy system is turned off.

**Hints.**
1. Migrate by consumer-facing domain with its whole lineage (sources, pipelines, tables and consumers), not table by table at random.
2. Reconcile at several grains: row counts, aggregates by partition and key columns, then row-level hashes where aggregates disagree.
3. Make a cutover a configuration change (a connection or a view) that can be reversed in minutes.

**Follow-ups.**
1. Reconciliation shows a 0.02% revenue difference on one table. Walk through how you find whether it is translation, data movement or a legacy bug.
2. A nightly job updates rows in place on the legacy side during your copy. How do you keep the cloud copy consistent?
3. Halfway through, the deadline moves three months earlier. What do you change, and what do you refuse to change?
4. How do you know it is safe to switch off the legacy system, and what do you archive first?
5. How would you show leadership, every week, that the migration is on track, with numbers rather than status colours?

**Follow-up rules.**
- when: big bang, all at once, single cutover → ask: What happens on the morning after a big-bang cutover when 3% of the dashboards are wrong, and how do you roll back only those?
- when: row count, row counts, count(*) → ask: Row counts match but revenue does not. What else do you compare, and at what grain?
- when: hash, checksum, md5 → ask: The two systems format decimals, timestamps and NULLs differently. How do you make a row hash comparable across them?
- when: dual write, dual-write → ask: If a pipeline writes to both systems and one write fails, which one is right, and how do you repair the other?
- when: translator, translate, transpile → ask: The translator converts 92% of the SQL. How do you find the queries that translate without errors but give different answers?

**Production Reality Check.**
- Two weeks after a domain cuts over, finance finds that month-end revenue in the cloud system differs from the legacy figure by 0.02%, and the legacy system is the one that was wrong.
- A reconciliation query on {{legacy}} runs at 9 a.m. by mistake and slows the morning reports that are still served from it.
- Ten days before the deadline, 4% of the consumers have not cut over because their owners have not tested them, and the legacy system cannot be kept on.

**Evaluation Criteria.** An inventory with lineage and a domain-by-domain plan; an initial copy plus incremental catch-up while legacy remains the source of truth; tested translation with known dialect traps (types, NULLs, time zones, rounding, case); multi-grain reconciliation with classified, explained differences; reversible per-consumer cutovers; a clear rule for switching off and archiving; cost of parallel running managed; honest, measurable progress reporting; a plan for each incident.
