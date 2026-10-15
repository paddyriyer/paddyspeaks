# Palantir · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of enterprise data
integration and operational analytics platforms: data connections and pipelines, an
ontology of objects, links and actions, lineage, access markings, operational
applications and decision workflows. Every customer, workload, number, schema and
incident is hypothetical and commercial, and describes no real deployment. Access
controls and object models are this exercise's model, not a description of how any
product works inside. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PLT-L2-01: Sensor outliers against a rolling median per machine

| | |
|---|---|
| **Template ID** | PLT-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Heaps / sliding-window median with lazy deletion, per-key windows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | PLT-L2-01.mjs |

**Business Scenario.** A manufacturer streams readings from sensors on its presses, pumps and kilns into an integrated data platform, where each machine is an object that maintenance planners watch. A reading that is far from the machine's recent normal behaviour should raise a flag on the machine. Averages are pulled about by the very spikes the planners want to find, so the plant's rule uses the median: a reading is an outlier when it is more than `d` units from the median of the same machine's previous `w` readings. The check runs on every reading, for every machine, as the data arrives.

**Problem Statement.** Implement `sensor_outliers(readings, w, d, exclude_outliers=False)`. `readings` is a list of `(machine_id, value)` in time order, with the machines interleaved, and values are integers. For each reading, look at the previous `w` readings of the same machine (its window). If the machine does not yet have `w` earlier readings, the reading is not checked. Otherwise it is an outlier when `|value − median(window)| > d`. Return the positions in `readings` (0-based, ascending) of every outlier. {{window_rule}} {{exclude_rule}}

**Constraints.** Up to 300 000 readings and up to 100 000 readings in a window, which is about a day at one reading a second. `w ≥ 1`, `d ≥ 0`, and values are integers below 10⁶ in absolute value. Something close to O(n log w) is expected. Work that grows with `w` on every reading is too slow when the window is a day long.

**Assumptions.** Machines, units, rates and thresholds are hypothetical. Readings arrive in time order with no ties to break. Machines are independent: one machine's readings never enter another machine's window.

**Clarifications.**
- Q: Is "more than d" strict? | A: Yes. A reading exactly `d` from the median is not an outlier.
- Q: Are the first readings of a machine checked against a shorter window? | A: No. A reading is checked only when the machine already has `w` earlier readings in its window. The warm-up readings are never flagged.
- Q: Does the window include the reading being checked? | A: No. It is the previous `w` readings of that machine, before this one.
- Q: What if the median is not a whole number? | A: It can be only when `w` is even. Compare exactly. Doubling both sides keeps everything in integers.
- Q: Can I return a list of machine ids? | A: No. Return positions in `readings`, so the platform can mark those exact readings.

**Hints.**
1. Keep one window per machine. The question is how to get the median of a window that loses its oldest reading and gains a new one each step.
2. Two heaps (a max-heap for the lower half and a min-heap for the upper half) give the median from their tops. Removing an arbitrary reading from a heap is the hard part: you do not have to remove it at once, only before it reaches a top.
3. Give each reading in a machine's window a sequence number. A heap entry whose number is older than the window's start is stale, and you discard it when it reaches the top. Track how many live entries each heap holds so you can rebalance.

**Follow-ups.**
1. Planners want the flag to say how unusual the reading is, not just yes or no. How would you add a robust spread, such as the median absolute deviation, and what does it cost to keep it up to date?
2. Readings for one machine arrive out of order by a few seconds after a network blip. What does your window mean then, and what would you change?
3. The plant has 40 000 sensors. How would you run this as a stream, how is state partitioned and checkpointed, and what happens to a machine's window on a restart?
4. Twelve machines start flagging at the same minute. How would you tell a real process change from a sensor or gateway fault before anyone is paged?

**Follow-up rules.**
- when: insort, bisect, sorted list → ask: Inserting into and deleting from a Python list moves the entries after that position. With a window of 86 400 readings, how many entries move per reading, and how long does a day of readings take?
- when: sorted(, sort each window, statistics.median → ask: What does sorting the window cost per reading at w = 86 400, and for 240 000 readings?
- when: heapq, two heaps, heap → ask: The reading leaving the window is somewhere inside one of your heaps. How do you remove it, and how do you know which heap it is in?
- when: float, / 2, average of the two → ask: The median of an even window can end in .5. Show that your comparison is exact at the boundary, or rewrite it in integers.
- when: sortedcontainers, SortedList, balanced tree → ask: That is a fine structure if you can use it. Without a library, what would you build, and what does each operation cost?

**Evaluation Criteria.** Per-machine windows of exactly the previous `w` readings; warm-up readings never checked; a strict `> d` boundary; exact comparison for even windows; dropouts skipped and never counted; flagged readings kept out of the window when asked; a structure that gives the median in O(log w) per reading (two heaps with lazy deletion, or an equivalent); a clear complexity argument against sorting or a sorted list; sensible answers on spread, ordering and streaming state.

## PLT-L2-02: Downtime rolled up an asset hierarchy

| | |
|---|---|
| **Template ID** | PLT-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Trees / bottom-up aggregation in one pass, iterative traversal |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | PLT-L2-02.mjs |

**Business Scenario.** A manufacturer models its plants as linked objects: a site has production lines, a line has machines, a machine has components, and some components hold sub-assemblies. Downtime is recorded against whichever asset failed, from a whole line stopped for a power dip to a single worn bearing. Operations leaders ask the same question at every level of the hierarchy: how much downtime is there in this site, this line, this machine, counting everything below it? A dashboard sends thousands of such questions at once, most of them for sites, lines and machines.

**Problem Statement.** Implement `rollup_downtime(assets, events, queries, drill=False)`. `assets` is a list of `(asset_id, parent_id)`, with `parent_id` None for a site, listed in any order. `events` is a list of `(asset_id, minutes, kind)` downtime records. `queries` is a list of asset ids. For each query, return the total minutes of downtime recorded on that asset and on every asset below it, in query order. An asset id that is not in `assets` returns `-1`. {{event_rule}} {{drill_rule}}

**Constraints.** Up to 200 000 assets, 300 000 records and 200 000 queries. Every parent named in `assets` is itself listed, there are no cycles, and the hierarchy is a few levels deep. Minutes are positive integers. Something close to O(n + e + q) is expected. Walking each queried asset's subtree is too slow when most queries name a site or a line.

**Assumptions.** Plants, assets and minutes are hypothetical. Downtime records do not overlap in any way that matters here: the rollup is a plain sum, not a union of time intervals.

**Clarifications.**
- Q: Does a site's own record count for the site? | A: Yes. A record on an asset counts for that asset and for every asset above it.
- Q: Are assets listed parents first? | A: No. A component can appear before its machine and its site.
- Q: What do I return for an asset with no downtime? | A: `0`. Only an asset that is not in `assets` returns `-1`.
- Q: Can the same asset be queried twice? | A: Yes, and each query gets its own answer in the output.
- Q: Can I use recursion? | A: Yes for this depth, but say what happens if a source system ever sends a hierarchy thousands of levels deep.

**Hints.**
1. Every query asks about a subtree. If you knew every asset's subtree total, each query would be one dictionary lookup.
2. A child's total is finished before its parent's. Find an order in which every asset comes after all of its descendants, then add each asset's total into its parent's.
3. A pre-order from the sites with an explicit stack, read backwards, is such an order. No recursion is needed.

**Follow-ups.**
1. Records arrive all day. How would you keep the totals current without recomputing the whole plant for each new record?
2. A machine is moved from one line to another at noon. Which totals change, and how would you answer "downtime by line for yesterday" both before and after the move?
3. Leaders want hours of downtime, not the sum of records: two overlapping records on one machine are one stoppage. What changes, and what does it cost?
4. The same question is asked of a hierarchy with 50 million assets across many customers' plants. Where would you compute the rollup, and how would you serve the queries?

**Follow-up rules.**
- when: lru_cache, recursion, recursive → ask: What is Python's default recursion limit, and what happens if one sub-assembly chain is 5 000 levels deep?
- when: walk up, ancestors, parent chain → ask: Adding each record to every ancestor costs records × depth. When is that fine, and when would you switch to one bottom-up pass?
- when: bfs, dfs, each query, per query → ask: A query for a site visits every asset below it. With 30 000 site queries, how many visits is that?
- when: cache, memo → ask: Your cache helps repeated queries. What does the first query for each line still cost, and what does the whole run cost in the worst case?
- when: tie, ties, sorts first → ask: Why should a drill-down choose the same child every time when two children are tied, and who would notice if it did not?

**Evaluation Criteria.** Correct subtree totals including an asset's own records; assets accepted in any order; `-1` for unknown assets and `0` for assets without downtime; planned work and retired assets excluded; the drill-down tie rule and None when no child has downtime; one bottom-up pass in O(n + e + q) with an iterative order; a clear argument against per-query walks; credible answers on incremental updates, moves over time and interval overlap.

## PLT-L2-03: Debug the ontology object sync

| | |
|---|---|
| **Template ID** | PLT-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Data pipelines / object sync from a backing dataset, keys, deletes, casts, time zones, nulls |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | PLT-L2-03.mjs |

**Business Scenario.** In this exercise's model, an operational application shows objects (work orders, shipments, hospital beds) that are kept in sync with a backing dataset from a source system. A sync step applies the source's change rows to the object store: upserts and deletes, with every property value arriving as text and cast to the type the object type declares. Users have reported several problems. Some objects appear twice after the source system renumbered them. An object that was deleted and re-created in the source has vanished. Every "hazardous" flag reads true. Due times are hours off for one site. A carrier that was removed in the source still shows on the object. The sync function below is the suspect.

**Problem Statement.** Fix `sync_objects(store, changes, schema, source_offset)` so that it meets this specification. `store` maps primary key to the object's properties, already typed. `changes` is a list of change rows in commit order. You may update `store` in place, and you return it. {{replay_rule}}
1. **`delete`** `{"op", "pk"}` removes the object with that key. A delete for a key that is not in the store changes nothing.
2. **`upsert`** `{"op", "pk", "props"}` creates the object if it does not exist, or updates it. Rows are applied strictly in commit order, so an upsert after a delete of the same key creates a new object from that row alone.
3. **Changed primary keys.** An upsert may carry `"old_pk"`: the source changed the row's key from `old_pk` to `pk`. If `old_pk` is in the store, the object moves: it is removed from `old_pk` and stored under `pk` with its properties, and then the row's `props` are applied. If `old_pk` is not in the store, the row is a plain upsert of `pk`. The new key is never already in the store.
4. **Null versus missing.** A property missing from `props` keeps its current value. A property present with the value `None` is set to `None`. A property not named in `schema` is ignored.
5. **Casts.** Raw values are text. `"int"`: an integer, possibly with leading zeros or a sign. `"bool"`: `"true"` or `"false"` in any letter case. `"str"`: as is. `"timestamp"`: `YYYY-MM-DD HH:MM:SS` (or with `T` between date and time), optionally followed by `Z` or an offset `±HH:MM`. Convert to UTC and store as `YYYY-MM-DDTHH:MM:SSZ`. A timestamp with no zone is in the source system's local time, which is `source_offset` minutes east of UTC.

**Constraints.** Keep the function's shape and output format. Up to 200 000 change rows, processed in linear time.

**Assumptions.** Object types, keys and values are hypothetical and simplified. Change rows are delivered once and in commit order. Source offsets are fixed for the exercise: daylight-saving changes are out of scope.

**Clarifications.**
- Q: Should deletes be applied after upserts to save work? | A: No. Rows are applied in commit order. The order is what makes a delete followed by a re-insert mean what it says.
- Q: If a property is missing from an upsert, should it be cleared? | A: No. Missing means unchanged. Only an explicit `None` clears it.
- Q: What is `source_offset` for a timestamp that has its own offset? | A: Unused. Its own `Z` or `±HH:MM` decides. `source_offset` applies only to timestamps with no zone.
- Q: After a key change, do I keep anything under the old key? | A: No. The object now lives only under the new key.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Run a renumbered object through the code: which keys exist in the store afterwards?
2. Write down a delete and a re-create of the same key, in that order. What does the code do with them, and in which order?
3. In Python, what is `bool("false")`?
4. Read the timestamp branch for an input with no zone: which offset does it use?
5. What does the loop over `props` do with a value of `None`?

**Follow-ups.**
1. The source system sends a full snapshot each night instead of change rows. How do you find deletes and key changes from two snapshots, and what can you no longer tell apart?
2. Users also edit some of these properties in the application. How do you merge their edits with the source's updates, and who wins?
3. The source switches one site to daylight saving time. Which stored timestamps are now wrong, and how would you have prevented it?
4. A cast fails on one row of 200 000 (the text "n/a" for an integer). What should the sync do with that row and with the rest of the batch?

**Follow-up rules.**
- when: snapshot, full refresh, full reload → ask: With full snapshots, a renumbered row looks like a delete and an insert. What do you lose on the object, such as links and user edits, and how would you detect the renumbering instead?
- when: dict.update, update(, merge → ask: How does your merge tell a property set to None from one that was not sent at all?
- when: fromisoformat, strptime, timezone, tzinfo → ask: What does your parser return for a timestamp with no zone, and where does the source's offset come from?
- when: two passes, batch deletes, group by op → ask: Show a sequence of rows where applying all upserts before all deletes gives a different object store.
- when: "false", bool(, truthy → ask: Which other text values would you expect from a source system for a boolean, and what should happen to one you do not recognise?

**Evaluation Criteria.** Finds and explains every bug with its user-visible symptom; rows applied in commit order; a changed key moves the object; "false" casts to False in any case; zone-less timestamps use the source offset, zoned ones their own; explicit null clears and missing keeps; properties outside the schema ignored; minimal, linear fixes with a test per bug.

## PLT-L2-04: Writeback from operational apps to source systems

| | |
|---|---|
| **Template ID** | PLT-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / writeback, optimistic concurrency, retries, audit trail |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "actions_per_day": {"2": ["40,000", "150,000"], "3": ["2 million", "6 million"]},
  "systems": [3, 6, 11],
  "sync_delay": ["15 minutes", "an hour", "a nightly batch"],
  "outage": ["20 minutes", "4 hours"]
}
```

**Business Scenario.** A distributor's planners work in operational applications built on an integrated data platform. In this exercise's model, they act on objects (they reassign a work order, change a purchase order's quantity, put a shipment on hold) about {{actions_per_day}} times a day. Each action must be written back to the system of record it came from, and there are {{systems}} of them: an ERP, a warehouse system, a maintenance system and others, each with its own API and limits. Data flows the other way too: each source is synced back into the platform, and the slowest sync lags by {{sync_delay}}. Meanwhile, people keep editing the same records directly in the source systems.

**Problem Statement.** Design how an action taken in the application reaches the source system and how the platform knows what happened to it. Cover the action record and what it captures, how an action becomes a write to a source system, how you detect that the source record changed since the user saw it, what the user sees while a write is pending, applied, rejected or in conflict, retries and failures (including a source system that is down for {{outage}}), the order of several actions on the same record, how the next sync from the source confirms or contradicts the action, and the audit trail.

**Constraints.** A retried write must never apply an action twice in the source. An action must never silently overwrite a newer change made in the source. Every action, its outcome and the user who took it must be answerable a year later. One slow or failing source system must not hold up actions bound for the others. The application must not show a value as current that the source has rejected.

**Assumptions.** Volumes, systems and delays are hypothetical. Each source system offers a write API that returns the record's new version or an error, and most of them can read a record's current version. You may use common building blocks: a transactional database, a durable queue or log, workers and a scheduler.

**Clarifications.**
- Q: Does the action change the object in the platform immediately? | A: Your choice, and you must explain it. Users want to see their change. The source remains the system of record.
- Q: Do all source systems support versions or ETags? | A: Most do. Plan for one that has only a last-modified timestamp, and one that has nothing.
- Q: What should happen on a conflict? | A: Never overwrite silently. Who resolves it, and how, is part of your design.
- Q: Are actions on different records independent? | A: Mostly. Some actions change two records, such as moving stock between two locations, and both must happen or neither.
- Q: Who reads the audit trail? | A: Operations leads investigating a bad decision, and auditors checking who changed what.

**Hints.**
1. Record the action first, durably, with the version of the record the user saw. Everything else (the write, the retries, the confirmation) is processing of that record.
2. A conditional write ("apply only if the record is still at version v") turns a lost update into a detectable conflict.
3. The next sync from the source is your ground truth. Plan how a pending action is matched to the change it caused.

**Follow-ups.**
1. A source system is down for {{outage}}. Walk through what the user sees, what queues up, and what happens when it comes back.
2. Two planners act on the same purchase order within a minute, one in the application and one directly in the ERP. Walk through both orders of arrival.
3. An action that moves stock changes two records in the warehouse system, and the second write fails. What do you do?
4. With {{sync_delay}} of sync lag, a user sees their action applied, and an hour later the synced data shows the old value. What happened, and what does the user see?
5. At {{actions_per_day}} actions a day, the audit trail has to answer "every change to this record and why" in seconds. How do you store it?

**Follow-up rules.**
- when: retry, retries, backoff → ask: The write timed out, so you do not know whether it was applied. What does your retry send, and how does the source system know it is the same action?
- when: last write wins, overwrite → ask: The source changed the quantity after the user loaded the page. Under last write wins, whose change survives, and who finds out?
- when: optimistic, etag, version → ask: One source system has no versions at all. How do you detect a conflict there, and what does it cost?
- when: two-phase, distributed transaction, saga → ask: The source systems do not share transactions. How do you undo the first write when the second fails, and what does the user see meanwhile?
- when: event sourcing, append-only, outbox → ask: How does the action log relate to the object the user sees, and what does a user see after a rejected action?

**Production Reality Check.**
- The ERP is down for {{outage}} during the morning planning window, and planners keep acting on objects bound for it.
- A deploy of one connector retries timed-out writes without checking whether they were applied, and some purchase-order quantity changes are applied twice.
- The slowest source's sync, {{sync_delay}} behind, overwrites the platform's view of 3% of records that users changed that afternoon.

**Evaluation Criteria.** A durable action log written before any external call, with the user, purpose, inputs and the version seen; conditional writes or an equivalent conflict check per source capability; explicit action states visible to the user; retries that are safe because each write carries a stable action identity the source can recognise or that can be verified before retrying; per-system queues and limits for isolation; ordering per record; compensation for multi-record actions; confirmation by matching the next sync; an audit trail that can answer who, what, when and outcome; a plan for each incident.

## PLT-L2-05: Branching a data pipeline and merging it back

| | |
|---|---|
| **Template ID** | PLT-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / branches, incremental rebuilds of affected datasets, output comparison, merge |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "datasets": {"2": ["400", "1,200"], "3": ["8,000", "20,000"]},
  "branches": [5, 30, 120],
  "rebuild_cost": ["6 hours", "a day"],
  "largest": ["2 TB", "40 TB"]
}
```

**Business Scenario.** A utility's data team maintains a pipeline graph of about {{datasets}} datasets: meter readings, outages, customer accounts, asset records and the reports built on them. Engineers want to change a transform the way they change code: on a branch, with their own outputs, compared with production before anyone relies on them, and then merged. About {{branches}} branches are open at any time. Rebuilding the whole graph takes {{rebuild_cost}}, and the largest dataset holds {{largest}}, so a branch cannot copy everything.

**Problem Statement.** Design branching for the pipeline. Cover what a branch is (code, data or both), how a branch reads datasets it has not changed, how you find and rebuild only the datasets affected by a change, how branch outputs are stored without copying unchanged data, how a branch's outputs are compared with main's (schema, row counts, keys, values), what happens when main moves on while a branch is open, what merging does to code and data, and how access controls carry over to branch outputs.

**Constraints.** A branch must never change what main's users see. Unchanged datasets must not be copied. A branch's comparison must be against the same inputs main used, or say clearly that it is not. A merge must leave main in a state that a fresh build from main's code would also produce. Every branch output must carry the same access restrictions as the data it was derived from.

**Assumptions.** Sizes, counts and costs are hypothetical. Every transform declares its inputs and outputs, and datasets are stored as versioned files in object storage. Transforms are deterministic given the same inputs, except where noted. This is this exercise's model, not any product's.

**Clarifications.**
- Q: Does a branch see main's latest data or a frozen copy? | A: Your choice, and you must explain it. Both have costs.
- Q: Can a branch change a dataset's schema? | A: Yes, and the comparison must show it.
- Q: What does "affected" mean? | A: A dataset whose transform changed on the branch, and everything downstream of one.
- Q: What happens to branch data after a merge? | A: Your choice. Say whether main reuses it or rebuilds.
- Q: Are some transforms non-deterministic? | A: A few use the current time or sample rows. Plan for them in the comparison.

**Hints.**
1. A branch can be a pointer: for each dataset, either the branch's own version or a fall-back to main's version at a recorded point.
2. The datasets to rebuild are the changed transforms' outputs and their descendants in the graph. Nothing upstream needs to run.
3. Compare on keys, not just counts: rows only in main, rows only in the branch, and rows whose values changed, per column.

**Follow-ups.**
1. Main has rebuilt a source dataset twice since the branch was opened. What does the branch's comparison mean now, and how would you make it fair?
2. Two branches change the same transform in different ways and both want to merge. What happens?
3. A changed transform near the top of the graph affects 70% of the datasets. What does a branch build cost, and how would you make it affordable?
4. With {{branches}} branches open, storage keeps growing. What do you keep, for how long, and what do you garbage-collect?
5. A branch output derived from a restricted dataset is shared in a review. How do you ensure the restriction travelled with it?

**Follow-up rules.**
- when: copy, clone, duplicate → ask: Copying {{largest}} per branch with {{branches}} branches open costs how much storage, and what do you do instead?
- when: rebuild everything, full rebuild → ask: A full rebuild takes {{rebuild_cost}}. Which datasets actually need to run for a one-line change in one transform?
- when: row count, row counts, counts match → ask: Counts can match while every value in a column is wrong. What comparison would catch that?
- when: rebase, merge conflict, three-way → ask: For data, not code, what does a conflict look like, and when must main rebuild after the merge?
- when: snapshot, pin, frozen → ask: A pinned snapshot makes the comparison fair. How old can it get before the comparison stops being useful?

**Production Reality Check.**
- A branch build of a changed transform near the top of the graph starts rebuilding datasets whose total rebuild time is most of {{rebuild_cost}}, and it competes with main's nightly build for compute.
- A merged branch passes its comparison, but main's next build produces different numbers because the branch had compared against main as it was two weeks earlier.
- A branch output derived from a restricted customer-account dataset is readable by everyone on the branch's project because the branch's dataset was created without the inherited restriction.

**Evaluation Criteria.** A branch defined over code and dataset versions with fall-back to main for unchanged datasets; affected-set computation from the dependency graph; copy-free storage of unchanged data; comparisons by key with schema, row and value differences against recorded inputs; a clear policy for main moving on and for concurrent merges; a merge that leaves main reproducible; inherited access restrictions on every branch output; compute isolation and garbage collection; a plan for each incident.
