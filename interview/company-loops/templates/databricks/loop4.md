# Databricks · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a data and AI
platform built around a lakehouse, Apache Spark and an open table format (data
files in cloud object storage plus a transaction log). Every workload, number
and schema is hypothetical, and nothing here describes how the company's own
systems are built. Where a public behaviour of the open format or of Spark is
used, it is this exercise's rule; check current docs.

## DBX-L4-01: Table-format transaction log at scale

| | |
|---|---|
| **Template ID** | DBX-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage systems / optimistic concurrency, conflict detection, checkpoints, log and file cleanup |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "tables": {"2": ["20,000", "80,000"], "3": ["400,000", "1.5 million"]},
  "commits": {"2": [6, 20], "3": [60, 120]},
  "checkpoint_every": [10, 50, 100],
  "retention_days": [7, 30]
}
```

**Business Scenario.** A lakehouse platform manages {{tables}} tables for its customers. Each table is a directory of immutable data files in cloud object storage plus a transaction log: an ordered sequence of numbered commits, each listing the files it adds and removes along with schema and table-property changes. A table's state at version N is the result of replaying commits 0 to N. Many writers act on one table at once: streaming appends, MERGE statements that rewrite the files holding matched rows, deletes for privacy requests, and maintenance jobs that compact small files. The busiest tables take up to {{commits}} commits a minute. Readers, including time-travel queries to older versions, must always see a consistent snapshot.

**Problem Statement.** Design the transaction log and its commit protocol. Cover how a writer commits atomically on object storage, how concurrent writers are detected and either reconciled or rejected, what a reader does to build a snapshot quickly (checkpoints every {{checkpoint_every}} commits in this exercise), how idempotent streaming writes avoid committing the same batch twice, how old log entries and unreferenced data files are cleaned up while time travel stays available for {{retention_days}} days, and how file compaction coexists with writers that never stop.

**Constraints.** No central database may sit in the read path for data files; readers find everything from storage (plus, if you choose, a commit service). Data files are never modified in place. A commit must be all or nothing, and a reader must never see half of one. Writers run in many different clusters and can crash at any point. Snapshot construction for a reader should take seconds, not minutes, even on the busiest tables.

**Assumptions.** All volumes and rates are hypothetical. The object store offers strongly consistent reads after writes and listing by prefix; whether it offers an atomic "create only if absent" write is a question you should ask.

**Clarifications.**
- Q: Does the object store support "put if absent"? | A: Assume one cloud does and one does not. Say what you do on each.
- Q: Which isolation level do writers need? | A: Writes must be serialisable; snapshot isolation is acceptable for reads. Tell me where the two differ in your design.
- Q: Can a compaction job change the data in a table? | A: No. It rewrites the same rows into fewer files; readers of a change stream must be able to tell that nothing changed.
- Q: How long must old versions stay readable? | A: {{retention_days}} days, for time travel and audits. Older versions may be unavailable.
- Q: Can a single commit be large? | A: Yes: a MERGE can remove and add hundreds of thousands of files in one commit.

**Hints.**
1. Writers do their expensive work (writing data files) before they try to commit; the commit itself only has to win one atomic step on the next version number.
2. When a writer loses that race, it does not have to start over. Read what the winners changed and ask whether it conflicts with what this writer read and wrote.
3. A checkpoint is the replayed state at one version, stored so readers can start there; a pointer to the latest checkpoint saves a listing. Think about what happens if a checkpoint is half-written.

**Follow-ups.**
1. Walk through two writers, a blind append and a MERGE, that both try to commit version 101 of the same table. Which succeeds, what does the other do, and when must the loser abort rather than retry?
2. How do you commit atomically on the cloud whose object store has no "create only if absent"? What fails if two clusters use different mechanisms for the same table?
3. A streaming job crashes after its commit succeeds but before it records its progress. How does the restarted job avoid writing the batch twice?
4. Which data files may cleanup delete, and how do you protect a reader that is still working on a snapshot from an hour ago?
5. On the busiest tables, compaction loses every conflict to the streaming MERGE and never finishes. How do you change the protocol or the scheduling so both make progress?

**Follow-up rules.**
- when: lock, locking, mutex, zookeeper → ask: Where is the lock held, and for how long? A MERGE that rewrites files for twenty minutes would block a writer committing {{commits}} times a minute.
- when: retry, retries, rebase → ask: A writer loses the race for the next version. What exactly does it check against the winners' commits before retrying, and when does it have to rewrite its data files instead of only re-committing?
- when: checkpoint → ask: The writer producing a checkpoint crashes halfway through writing it. How does a reader know not to trust the partial checkpoint, and what does it use instead?
- when: vacuum, cleanup, garbage collection → ask: Which files are safe to delete, judged by what? How do you protect a long query or a time-travel read that started before cleanup ran?
- when: compaction, optimize, small files → ask: Compaction and a streaming MERGE touch the same partition every minute. Which should win a conflict, and how do you stop the loser from starving?

**Production Reality Check.**
- A streaming MERGE commits into the busiest table up to {{commits}} times a minute. The nightly compaction of that table has failed with conflicts five nights in a row, the table now holds 900,000 files under 1 MB, and query planning on it takes over a minute.
- Checkpoint writing for one busy table has failed silently for three days after a permissions change on its log directory. The data is still correct, but every new reader replays every commit written in those three days instead of at most {{checkpoint_every}}, and snapshot construction takes several minutes.
- A cleanup job is run with a retention of one hour instead of {{retention_days}} days. A long-running report query and a time-travel audit query both fail with "file not found", and an auditor asks whether last week's version can still be reproduced.
- After a storage migration, two writers on different clusters both report that they committed version 51,204 of a table. One writer's rows are missing from every reader's view, and its job reported success.

**Evaluation Criteria.** Commit = atomic creation of the next numbered log entry, with data files written beforehand and invisible until referenced; a mutual-exclusion mechanism per storage (conditional put, or a commit coordinator where the store lacks one) used by every writer of a table; conflict detection based on what the losing writer read and wrote (blind appends rarely conflict; a MERGE conflicts when a concurrent commit removed files it read or added rows matching its predicate), with retry without rewriting data when there is no logical conflict; checkpoints at a fixed interval with a validity check and a latest-checkpoint pointer; idempotent streaming commits keyed by application id and batch version; cleanup bounded by retention and by live readers; compaction marked as not changing data and scheduled or scoped so it can make progress; adapts to each incident with diagnosis, recovery and prevention.

## DBX-L4-02: Cluster autoscaling and spot-capacity fallback for many tenants' jobs

| | |
|---|---|
| **Template ID** | DBX-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Control planes / autoscaling, spot instances, quotas, fairness across tenants |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, staff-data-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "tenants": {"2": ["2,000", "5,000"], "3": ["20,000", "60,000"]},
  "peak_nodes": {"2": ["15,000", "40,000"], "3": ["150,000", "400,000"]},
  "spot_share": ["50%", "70%", "85%"],
  "notice": ["30 seconds", "2 minutes"]
}
```

**Business Scenario.** A managed data platform runs Spark clusters on cloud virtual machines for {{tenants}} customer workspaces. Each cluster has a driver and a variable number of worker nodes; jobs range from five-minute SQL transformations to twelve-hour shuffle-heavy backfills. At peak the platform runs about {{peak_nodes}} nodes in a region. To lower customers' bills, about {{spot_share}} of worker capacity runs on spot (preemptible) instances, which the cloud can reclaim with {{notice}} of notice; the rest is on-demand. Customers choose a minimum and maximum number of workers per cluster and expect jobs to finish on time at the lowest cost.

**Problem Statement.** Design the autoscaling and capacity system: how each cluster decides to grow or shrink, how worker nodes are acquired across spot and on-demand capacity and across zones and instance types, what happens to a running job when spot nodes are reclaimed, how the platform shares cloud quotas and API rate limits fairly among tenants, and what you measure to show customers that autoscaling saved money without missing deadlines.

**Constraints.** Cloud APIs for launching instances are rate-limited per account and region, and instance quotas per type are finite. A lost worker loses the shuffle files and cached blocks it held unless they were moved first. Drivers must not be lost mid-job. One tenant's burst must not delay other tenants' scheduled jobs beyond their start-time targets. Launching a node takes one to four minutes.

**Assumptions.** All volumes, prices and timings are hypothetical. The reclaim notice of {{notice}} is this exercise's rule; real notice periods differ by cloud, so check current docs.

**Clarifications.**
- Q: What signal says a cluster needs more workers? | A: You decide. The engine exposes pending tasks per stage, task durations and executor utilisation.
- Q: Can the driver run on spot? | A: Customers may ask for it; the default you choose must be defensible.
- Q: Are tenants billed for the nodes their clusters use? | A: Yes, per node-time at a rate that depends on instance type and spot or on-demand.
- Q: Can jobs be moved to another zone after they start? | A: Not the running cluster, but new nodes can come from any zone in the region if the job's storage and network allow it.
- Q: Is there a pool of pre-started nodes? | A: You may propose one; say who pays for idle capacity.

**Hints.**
1. Separate the per-cluster decision (how many workers does this job need now) from the regional decision (where those nodes come from, and in what order tenants get them).
2. Removing a worker is not free in Spark: it may hold shuffle output that later stages will read. Scale down the workers whose loss costs least, or move their data first.
3. A reclaim notice is a short window to act in. Decide in advance what a worker does with it.

**Follow-ups.**
1. Walk through one cluster on a shuffle-heavy job: when does it add workers, when does it remove them, and what keeps it from oscillating?
2. Spot capacity for the cluster's instance type runs out in its zone. What does the system try next, in what order, and when does it fall back to on-demand?
3. A spot worker receives its reclaim notice mid-stage. What happens to its running tasks, its shuffle files and its cached data?
4. How do you share the region's instance quota and launch-rate limit among {{tenants}} workspaces so a large backfill cannot starve scheduled production jobs?
5. How do you show a customer, with numbers, that spot plus autoscaling saved money on their job, and what do you do when it did not?

**Follow-up rules.**
- when: cpu, utilisation, utilization → ask: CPU is low while a stage waits on a shuffle fetch, and high during a skewed stage running on one core. Is CPU the right signal for adding workers? What would you use instead?
- when: spot, preemptible → ask: A reclaim wave takes most of one zone's spot capacity in ten minutes. What do your running jobs lose, and what does it cost compared with running them on-demand?
- when: decommission, decommissioning, graceful → ask: With {{notice}} of notice, how much shuffle data can a worker actually move? What happens to the data that does not make it?
- when: queue, priority, fair share, fairness → ask: Which tenant waits when the quota is exhausted, and how does a scheduled job's start-time target enter that decision?
- when: warm pool, node pool, pre-started, prewarmed → ask: Who pays for the idle nodes in the pool, and how do you size it so the cost does not exceed the minutes it saves?

**Production Reality Check.**
- In one zone the cloud reclaims about 40% of spot capacity within ten minutes, with {{notice}} of notice per node. Long shuffle-heavy jobs lose map outputs, recompute stages repeatedly, and several run four times longer than usual while costing more than on-demand nodes would have.
- At midnight UTC thousands of scheduled jobs from different workspaces start together. The cloud's rate limit for launching instances is hit, launches fail, and the platform's own retries keep the limit saturated for 25 minutes.
- The autoscaler removes workers that look idle but hold shuffle files. The next stage fails to fetch them, recomputes, and the cluster scales up again; it oscillates every few minutes for hours.
- One workspace submits a backfill of 6,000 jobs that takes most of the region's quota for the most popular instance type. Other workspaces' scheduled jobs wait more than an hour to start.

**Evaluation Criteria.** Per-cluster scaling on workload signals (pending tasks and backlog, expected stage duration) with hysteresis, cooldowns and min/max bounds; scale-down that prefers workers without shuffle or cached data, or migrates it first; drivers on on-demand by default; a capacity broker that diversifies spot across instance types and zones, tracks reclaim rates, and falls back to on-demand by job deadline and cost; reclaim handling (stop scheduling on the node, migrate shuffle blocks within the notice, recompute what is lost, and checkpoint long lineages); fair sharing of quotas and launch rates with priorities for scheduled production jobs, jittered starts and retry budgets; cost and deadline reporting per job; adapts to each incident with diagnosis, recovery and prevention.

## DBX-L4-03: Column-level lineage and catalogue service built from query plans

| | |
|---|---|
| **Template ID** | DBX-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Metadata platforms / column lineage from plans, impact analysis, tag propagation, governed visibility |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "tables": {"2": ["50,000", "200,000"], "3": ["2 million", "8 million"]},
  "queries": {"2": ["1 million", "5 million"], "3": ["40 million", "150 million"]},
  "freshness": ["5 minutes", "1 hour"],
  "sources": ["SQL warehouses and notebooks", "SQL warehouses, notebooks, scheduled jobs and streaming pipelines"]
}
```

**Business Scenario.** A lakehouse platform's governance catalogue already lists catalogs, schemas, tables, columns and grants for {{tables}} tables. Customers want column-level lineage: for any column, which columns it was computed from and which columns, dashboards and models read it, captured automatically from the {{queries}} queries and job runs a day that execute in {{sources}}. They want impact analysis before changing a column, sensitivity tags (such as "contains personal data") that follow data downstream, and they want lineage to respect permissions: a user should not learn the names of tables they are not allowed to see.

**Problem Statement.** Design the lineage service: where lineage is captured (from the engine's resolved query plan), the model for nodes and edges (including the kind of dependency), how SQL, DataFrame code, views, MERGE, streaming queries and user-defined functions are handled, the storage and query path for upstream and downstream traversals, how tags propagate, how visibility is enforced, and how fresh lineage must be. New lineage should be queryable within {{freshness}} of the query that produced it.

**Constraints.** Capture must not slow down customer queries or fail them if the lineage service is down. Tables are renamed, dropped and recreated with the same name. Some transformations are opaque (Python and Scala functions, external tools writing files directly). Traversals over popular shared tables can fan out to tens of thousands of downstream columns. Lineage is kept for one year.

**Assumptions.** All volumes are hypothetical. The engine can emit, for each executed write or read, its resolved plan: the input tables and columns (with stable table identifiers), the output table and columns, and the expressions connecting them.

**Clarifications.**
- Q: Do read-only queries create lineage? | A: Reads matter for impact analysis (who reads this column), but they have no output table. Decide how you record them.
- Q: Is a column used only in a filter or a join key a dependency? | A: Customers want to know, but separately from columns whose values flow into the output.
- Q: What about `SELECT *`? | A: The resolved plan has already expanded it into specific columns.
- Q: Do tags propagate automatically, or only suggest? | A: Your call. Say what happens when propagation is wrong in either direction.
- Q: Who may see a lineage edge? | A: Anyone may see nodes they have access to; you must decide what they see for nodes they cannot access.

**Hints.**
1. Capture at the resolved plan, where names, `*` and views are already resolved, and ship the result asynchronously, so capture can never fail a query.
2. Key nodes by stable identifiers, not by names; a name is an attribute that changes over time.
3. Edges carry a kind (value flows from, filtered by, joined on, opaque) and a validity period, so the graph answers "what reads this column today" and "what read it last March".

**Follow-ups.**
1. Show the edges you would emit for a MERGE that updates three columns from a joined source with a filter on a fourth.
2. How do you represent a Python function that takes three columns and returns one, when you cannot see inside it?
3. A downstream traversal from a widely used customer dimension returns 40,000 columns. How do you make it fast and useful?
4. How do you show lineage to a user who can see the start and end of a path but not a table in the middle?
5. A tag propagates "personal data" to a column that does not contain any, and data owners start ignoring tags. How do you make propagation trustworthy?

**Follow-up rules.**
- when: graph database, neo4j, graph db → ask: Your downstream query from one popular table touches tens of thousands of nodes. How do you bound that traversal, and what do you precompute?
- when: parse, parser, regex, sql text → ask: Parsing SQL text misses views, `*`, DataFrame code and session settings. Why not capture the plan the engine has already resolved?
- when: rename, renamed, table name, by name → ask: A table is dropped and recreated with the same name and a new schema. Does its new lineage join the old table's history?
- when: udf, udfs, opaque → ask: An email column passes through that function into a shared table. What does your tag propagation do with it?
- when: permission, permissions, access control, redact → ask: A user cannot see a table in the middle of a path. What exactly do you show them, and what can they infer from it?

**Production Reality Check.**
- A team drops a gold table and recreates it with the same name and a different schema. The lineage graph now attaches the new table's columns to the old table's upstream history, and an impact report lists 40 downstream dashboards that no longer read it.
- An email column flows through a Python function into a derived table. The function is opaque to the plan, the personal-data tag never propagates, and the derived table is shared with an analytics group without masking.
- After a spike in query volume, the lineage event backlog reaches six hours against a {{freshness}} target. During that window an engineer renames a column, checks impact analysis, sees "no downstream readers", and breaks 30 dashboards.
- A user without access to a finance schema opens the lineage of a shared dimension and sees the names of finance tables and columns that read from it.

**Evaluation Criteria.** Capture from the resolved plan, asynchronous and fail-open with a durable buffer; nodes keyed by stable ids with names as time-versioned attributes; edges with kinds (value, filter/join, opaque) and validity intervals; explicit handling of MERGE, views, streaming and opaque functions (conservative all-inputs-to-output edges marked opaque); a storage model that serves bounded traversals (adjacency by node with pagination, precomputed table-level summaries, depth limits); tag propagation rules by edge kind with owner review for opaque edges; visibility enforced at query time with redacted placeholders; freshness measured and surfaced so "no readers" is never claimed from stale data; adapts to each incident with diagnosis, recovery and prevention.

## DBX-L4-04: Multi-task job orchestration with retries and repair runs

| | |
|---|---|
| **Template ID** | DBX-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Workflow orchestration / DAG scheduling, exactly-once runs, repair, shared compute |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "jobs": {"2": ["50,000", "200,000"], "3": ["1 million", "4 million"]},
  "tasks": [5, 20, 80],
  "peak_starts": {"2": ["3,000", "10,000"], "3": ["40,000", "120,000"]},
  "retries": [2, 3, 5]
}
```

**Business Scenario.** A data platform lets customers define jobs as graphs of up to {{tasks}} tasks: notebooks, SQL queries, Python packages and pipeline updates, with dependencies, conditions ("run only if the previous task's value is true"), per-task retries (up to {{retries}}), timeouts, and parameters passed from one task to the next. Tasks can share one job cluster or each use their own. The platform runs {{jobs}} scheduled jobs; at the top of each hour about {{peak_starts}} runs start within a minute. When a run fails, customers can launch a repair run that re-runs only the failed tasks and the tasks that depend on them, reusing the results of tasks that succeeded.

**Problem Statement.** Design the orchestrator: the job and run model, the scheduler that starts runs on time, the state machine for runs and tasks, dispatch to clusters, retries and timeouts, repair runs, shared job clusters, concurrency limits, and how the orchestrator itself stays available. Say what guarantee you give that a scheduled run starts exactly once, and what a task must do so a retry does no harm.

**Constraints.** The scheduler must survive the loss of any single machine without missing or duplicating a scheduled run. A run's history (every attempt, its parameters, cluster, start and end) is kept for 60 days. The orchestrator does not see inside tasks; it only knows start, success, failure, timeout and any values a task publishes. Starts may be at most one minute late at peak.

**Assumptions.** All volumes are hypothetical. Clusters take one to four minutes to start, and the cluster service has its own rate limits.

**Clarifications.**
- Q: Can two runs of the same job overlap? | A: The customer sets a maximum number of concurrent runs per job; the default is one.
- Q: What does a repair run reuse? | A: The successful tasks' recorded outcomes and published values from the original run. It cannot reuse anything a task wrote to a table; that data may have changed since.
- Q: Who makes a task idempotent? | A: The task's author, but the orchestrator can help by passing run and attempt identifiers. Say how.
- Q: If a scheduled time is missed during an outage, should the run still happen? | A: Customers want to choose: catch up every missed run, run only the latest, or skip.

**Hints.**
1. Make "this scheduled run exists" a durable, unique fact before anything starts. A run is identified by (job, scheduled time), not by the scheduler instance that noticed it.
2. Keep the run and task state machine in one durable store, with conditional transitions, so two schedulers or two workers can never both move a task from pending to running.
3. A repair run is a new attempt inside the same run, not a new run: it needs the original run's parameters and the outcomes of the tasks it skips.

**Follow-ups.**
1. Walk through the scheduler at the top of the hour. How do {{peak_starts}} runs start within a minute, and what stops two scheduler instances from starting the same one?
2. A task fails on its last retry. What does the run look like, and what exactly does a repair run do with the tasks before it, after it and beside it?
3. Several tasks share one job cluster. One of them crashes the cluster's driver. What happens to the others, and how should retries behave?
4. How does a task that appends to a table make its retries and repairs harmless, and what does the orchestrator give it to help?
5. A region is down for two hours. When it returns, what runs, in what order, and how do you avoid a thundering herd?

**Follow-up rules.**
- when: cron, leader, leader election, single scheduler → ask: Two scheduler instances both believe they own 01:00. What makes exactly one run exist for each job at that time?
- when: retry, retries, backoff → ask: The task already wrote half its output before failing. What does the retry find, and whose job is it to make that safe?
- when: repair, rerun, re-run → ask: The repair runs two days later. The task before it succeeded, but its output table has been overwritten by later runs since. Which data does the repaired task read?
- when: shared cluster, job cluster, cluster reuse → ask: One task's memory blow-up takes down the shared cluster. How do you contain the damage, and do the other tasks' retries count against their limit?
- when: timeout, timeouts, hung → ask: What is the default timeout when the customer sets none, and who notices a task that has been running for fourteen hours?

**Production Reality Check.**
- The scheduler leader fails twenty seconds into the top-of-hour burst of {{peak_starts}} run starts. The standby takes over and starts again about a quarter of the runs the old leader had already started; jobs that append to tables load the same hour twice.
- On Thursday a customer launches a repair for Tuesday's failed run. It re-runs the failed task and its dependents, but they read the upstream table as it is on Thursday, so Tuesday's report contains Wednesday's rows.
- On a shared job cluster used by all {{tasks}} tasks of one job, a single task exhausts the driver's memory. Every running task fails at the same moment; their retries start together, on a new cluster, and fail the same way until all {{retries}} retries are spent.
- A task waits forever on an external API and has no timeout. It holds the job's cluster for fourteen hours; the job's downstream deadline is missed, and the cost appears on the customer's bill before anyone notices.

**Evaluation Criteria.** Runs identified by (job, scheduled time) and created with a unique constraint or conditional write before any side effect; a partitioned scheduler (jobs sharded across instances with leases and fencing) that spreads the top-of-hour burst and survives failover without duplicates; a durable run/task state machine with conditional transitions; dispatch decoupled through queues with rate limits toward the cluster service; retries with backoff and jitter, timeouts with sensible defaults, and run and attempt ids passed to tasks for idempotent writes; repair runs as new attempts that reuse recorded outcomes, with a clear statement of what data a repaired task reads (or a parameter pinning the original logical date and table versions); containment for shared clusters; catch-up policies after outages with throttling; adapts to each incident with diagnosis, recovery and prevention.

## DBX-L4-05: Vector search index kept in sync with lakehouse tables

| | |
|---|---|
| **Template ID** | DBX-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | AI infrastructure / incremental embeddings from a change feed, deletes, model versions, index health |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, senior-data-engineer, staff-data-engineer, software-engineer |

```params
{
  "rows": {"2": ["20 million", "80 million"], "3": ["500 million", "2 billion"]},
  "changes": ["0.5%", "2%", "5%"],
  "freshness": ["1 minute", "15 minutes", "1 hour"],
  "dims": [384, 768, 1024]
}
```

**Business Scenario.** Customers of a lakehouse platform build retrieval-augmented applications over their own tables: support articles, product descriptions, contract clauses. They want a vector search index that stays in sync with a source table of {{rows}} rows without writing their own pipeline. About {{changes}} of the rows are inserted, updated or deleted each day. Each indexed row stores a {{dims}}-dimension embedding computed by an embedding model endpoint, plus the row's key and a few filterable columns. Applications expect search results to reflect a change in the table within {{freshness}}, and a deleted row must stop appearing in results.

**Problem Statement.** Design the sync and serving system: how changes are read from the source table, how embeddings are computed and paid for, how inserts, updates and deletes reach the index, how the index records which table version it reflects, how an embedding model upgrade is rolled out, how access control on the source table applies to search results, and how you measure freshness, recall and cost.

**Constraints.** The embedding endpoint has a throughput limit and a cost per token. The table format provides a change feed: row-level inserts, updates (with before and after images) and deletes, each tagged with the commit version that made it. Some customers apply row filters to the source table, and search must never return a row the caller could not read from the table. Approximate nearest-neighbour indexes degrade as rows are updated and deleted in place.

**Assumptions.** All volumes, rates and costs are hypothetical. The change feed is enabled on the source table, and its retention is long enough for normal sync but not unlimited.

**Clarifications.**
- Q: Does every update need a new embedding? | A: Only if a column that feeds the embedding changed. Updates to other columns may change only filter columns.
- Q: How are deletes handled in the index? | A: Your choice. Say how quickly a deleted row disappears from results and how.
- Q: Can the whole index be rebuilt? | A: Yes, but at {{rows}} rows a full re-embedding costs real money and takes time; say when you would do it.
- Q: What if the change feed for a version range has expired before the sync reads it? | A: Then incremental sync is impossible for that range; say what you do.

**Hints.**
1. Treat the sync like any incremental pipeline: a checkpoint of the last source version applied, idempotent upserts keyed by the row's primary key, and a record of which version the index reflects.
2. Separate what needs the embedding model (new or changed text) from what does not (deletes, filter-column updates). Deletes should never wait behind the embedding queue.
3. A model upgrade changes the vector space. Vectors from two models must never be compared with each other.

**Follow-ups.**
1. Walk through one update to a row's text column: what the change feed shows, what you embed, and what the index holds at each step.
2. A deletion request removes a row from the source table. How quickly does it disappear from search, even when the embedding queue is a day behind?
3. How do you roll out a new embedding model over {{rows}} rows without a period where results mix two vector spaces?
4. A customer applies a row filter to the source table so each region sees only its own rows. How does search respect it?
5. Recall slowly drops as the index ages. How do you detect it, and what maintenance keeps it up without downtime?

**Follow-up rules.**
- when: full refresh, rebuild, re-embed → ask: At {{rows}} rows and {{dims}} dimensions, what does a full re-embedding cost in time and endpoint capacity, and what do applications see while it runs?
- when: tombstone, soft delete, deletion → ask: How long can a tombstoned row stay in the index, and what guarantees it never appears in a result in the meantime?
- when: hnsw, ivf, ann, approximate nearest neighbour → ask: Updates and deletes accumulate in that index for months. What happens to recall and latency, and how would you know?
- when: batch, batching, micro-batch → ask: How large are your embedding batches, and how do you keep a backlog from breaking the {{freshness}} target without overrunning the endpoint's limit?
- when: row filter, acl, permission, permissions → ask: Do you filter before or after the nearest-neighbour search? What happens to the top ten when the filter removes nine of them?

**Production Reality Check.**
- The embedding endpoint is throttled to half its usual rate for a day. The backlog grows far past the {{freshness}} target, and a row removed from the source table for a customer's deletion request is still returned by search 30 hours later.
- An engineer rewrites the source table with a full overwrite to fix one column. The change feed reports every one of the {{rows}} rows as deleted and re-inserted, and the sync starts re-embedding all of them at full cost.
- An embedding model upgrade is rolled out by re-embedding rows only as they change. Three weeks later the index holds vectors from two models, and relevance has dropped for every query.
- After months of updates and deletes, recall at 10 measured against exact search on a sample has fallen from 0.95 to 0.80, and p99 query latency has doubled.

**Evaluation Criteria.** Incremental sync from the change feed with a durable checkpoint of source versions and idempotent upserts by primary key; the index records the source version it reflects and exposes freshness; embedding only when embedded columns change (content hash), with batching, rate limiting and cost tracking; deletes on a fast path (tombstone plus query-time exclusion) independent of the embedding backlog; model upgrades as a new index built side by side and switched atomically, never mixing spaces; row-level access applied at query time with over-fetching or pre-filtered search; recall and latency monitored against exact search on samples, with compaction or rebuild of index segments; protection against accidental full rewrites (detect unchanged content by hash before embedding); adapts to each incident with diagnosis, recovery and prevention.
