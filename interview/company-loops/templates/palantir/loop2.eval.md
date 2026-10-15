# Palantir · Loop 2 — evaluator notes (hidden from candidates)

## PLT-L2-01

**Reference solution**

```python reference
import heapq


class _Window:
    """The last w accepted readings of one machine: two heaps with lazy deletion.

    Every accepted reading gets a sequence number. Readings older than `start`
    have left the window; they are dropped from a heap only when they reach its top.
    """

    __slots__ = ("lo", "hi", "side", "nlo", "nhi", "seq", "start")

    def __init__(self):
        self.lo = []        # max-heap of (-value, seq): the lower half
        self.hi = []        # min-heap of (value, seq): the upper half
        self.side = {}      # seq -> 0 (lo) or 1 (hi), for live readings
        self.nlo = 0        # live readings in lo
        self.nhi = 0        # live readings in hi
        self.seq = 0        # next sequence number
        self.start = 0      # oldest live sequence number

    def _prune(self):
        lo, hi, start = self.lo, self.hi, self.start
        while lo and lo[0][1] < start:
            heapq.heappop(lo)
        while hi and hi[0][1] < start:
            heapq.heappop(hi)

    def _balance(self):
        # keep nlo == nhi or nlo == nhi + 1
        while self.nlo > self.nhi + 1:
            self._prune()
            v, s = heapq.heappop(self.lo)
            heapq.heappush(self.hi, (-v, s))
            self.side[s] = 1
            self.nlo -= 1
            self.nhi += 1
        while self.nhi > self.nlo:
            self._prune()
            v, s = heapq.heappop(self.hi)
            heapq.heappush(self.lo, (-v, s))
            self.side[s] = 0
            self.nhi -= 1
            self.nlo += 1
        self._prune()

    def add(self, value):
        s = self.seq
        self.seq += 1
        if self.nlo and value <= -self.lo[0][0]:
            heapq.heappush(self.lo, (-value, s))
            self.side[s] = 0
            self.nlo += 1
        else:
            heapq.heappush(self.hi, (value, s))
            self.side[s] = 1
            self.nhi += 1
        self._balance()

    def drop_oldest(self):
        s = self.start
        self.start += 1
        if self.side.pop(s) == 0:
            self.nlo -= 1
        else:
            self.nhi -= 1
        self._balance()

    def size(self):
        return self.nlo + self.nhi

    def twice_median(self):
        # tops are live after _balance(); the median doubled stays an integer
        if self.nlo > self.nhi:
            return -2 * self.lo[0][0]
        return -self.lo[0][0] + self.hi[0][0]


def sensor_outliers(readings, w, d, exclude_outliers=False):
    windows = {}
    flagged = []
    for i, (machine, value) in enumerate(readings):
        if value is None:
            continue                                  # a dropout: not checked, not added
        win = windows.get(machine)
        if win is None:
            win = windows[machine] = _Window()
        outlier = False
        if win.size() == w:
            outlier = abs(2 * value - win.twice_median()) > 2 * d
            if outlier:
                flagged.append(i)
        if outlier and exclude_outliers:
            continue
        win.add(value)
        if win.size() > w:
            win.drop_oldest()
    return flagged
```

**Explanation.** Each machine keeps its own window of the last `w` accepted readings. The window is split into a lower half (a max-heap, stored negated) and an upper half (a min-heap), with the lower half holding the extra reading when the count is odd, so the median is the lower top (odd `w`) or the mean of both tops (even `w`). Removing the reading that leaves the window is done lazily. Every accepted reading gets a sequence number, the window's start number moves forward by one, and any heap entry older than the start is stale and is popped only when it reaches a top. To rebalance correctly the code counts live entries per heap, which needs to know which heap the departing reading sits in, so it records each live reading's side and updates it when rebalancing moves an entry. Tops are pruned after every change, so they are always live. The comparison is done on doubled values, `|2·value − (a + b)| > 2·d`, so an even window's .5 median is compared exactly in integers. The order inside the loop is the rule: check against the current window, then (unless the reading was flagged and exclusion is on) add it, then drop the oldest if the window is over `w`. Dropouts (`None`) skip the whole step.

**Complexity.** O(n log n) time in the worst case with lazy deletion (stale entries can accumulate up to the number of readings), O(n log w) in practice, and O(w) live entries per machine. The timing test is one machine, 240 000 readings, and a window of 75 000 to 90 000 readings (about a day at one reading a second). The reference runs in about 0.7 to 0.9 s in CPython. Measured alternatives on the same input: sorting a copy of the window per reading took 17 s for the first 3 600 checks alone (hours for the whole test). **The middle approach, `bisect.insort` into a sorted list plus `del` of the departing value, was measured at 18 to 21 s, so it fails the 8 s limit.** It is O(w) per reading, but with a small constant (C-level memory moves), so it would pass for windows of a few thousand readings. That is why the test uses a day-long window; say so if a candidate argues the sorted list is "fast enough". A balanced tree or `sortedcontainers.SortedList` (O(log w) per operation) is an acceptable answer if the candidate can explain it. So is a Fenwick tree over compressed values, O(n log V), when the values are known in advance.

**Dialect notes.** In Java, use two `PriorityQueue`s with the same lazy-deletion idea, or a `TreeMap<value, count>` (an order-statistic multiset), which removes by value in O(log w). In C++, `std::multiset` with an iterator to the median, moved on each insert and erase, is the classic O(log w) solution. In SQL, `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)` over a `ROWS BETWEEN w PRECEDING AND 1 PRECEDING` frame is not supported as a window function in PostgreSQL, and engines that do support median over a sliding frame recompute it per row. Spark's `percentile_approx` gives an approximate median. Not executed here.

**Edge cases built into the tests.** No readings; exactly `d` away (not flagged) and `d + 1` away (flagged), on both sides; warm-up readings never checked; two interleaved machines with different levels; `w = 1`; one spike not moving the median; a lasting level change that stops being flagged once it fills half the window; the window sliding past old readings; (Hard) an even window whose mean ends in .5, with one case that floor rounding misses and one that ceiling rounding misses, an even window with far-apart middle readings, dropouts never counted, and a machine that only drops out; (Very Hard) flagged readings kept out of the window so a lasting change stays flagged, a reading exactly `d` away entering the window, warm-up readings always entering, and an excluded spike not affecting the next reading.

**Common mistakes.** Including the current reading in its own window; checking during warm-up against a short window; `>=` instead of `>`; integer division for an even median (`(a + b) // 2`), which misses outliers at .5; one window shared by all machines; removing the departing value from the wrong heap, or by value with duplicates, so the halves drift; letting a stale top decide the median; counting dropouts in the window; with exclusion, still adding flagged readings, or excluding warm-up readings.

**Follow-up guidance.** (1) The median absolute deviation needs the median of |x − median|, which changes for every reading when the median moves. Keeping it exactly per reading is expensive. Accept an approximation (recompute every k readings, or a quantile sketch), or a second pair of order-statistic structures with a clear cost. (2) Out-of-order readings: define the window by timestamp, buffer a few seconds and release in order (a watermark), or accept that the window is by arrival and say what that means for the flag. (3) Partition the stream by machine id, keep per-machine window state in the stream processor's keyed state, checkpoint it, and on restart either restore the state or rebuild it by replaying the last `w` readings. (4) Correlated flags across many machines at one minute suggest a shared cause: a gateway, a clock, a power event. Group flags by shared upstream (gateway, line, site) before paging, and check sensor health signals.

**Rubric anchors.** 2: sorts the window per reading, or gets the boundary, warm-up or even-median rule wrong; several edge tests fail. 3: all tests pass with two heaps and lazy deletion (or an equivalent O(log w) structure), with exact integer comparison. 4: also explains why the sorted-list approach is O(w) per reading despite being fast for small windows, keeps the live counts right under lazy deletion without hand-waving, and gives credible answers on out-of-order data and streaming state.

**Strong signals.** Asks whether the window is per machine and whether it includes the current reading; doubles both sides to keep the comparison exact; tests with duplicate values. **Red flags.** "Just use the mean"; removing an element from the middle of a heap with `list.remove` and `heapify` per reading without noticing the cost.

## PLT-L2-02

**Reference solution**

```python reference
def rollup_downtime(assets, events, queries, drill=False):
    parent = {}
    children = {}
    roots = []
    for a, p in assets:
        parent[a] = p
        if p is None:
            roots.append(a)
        else:
            children.setdefault(p, []).append(a)

    total = dict.fromkeys(parent, 0)
    for a, minutes, kind in events:
        if kind == "unplanned" and a in total:      # planned work and retired assets do not count
            total[a] += minutes

    # pre-order with an explicit stack; reversed, every asset comes after all its descendants
    order = []
    stack = roots[:]
    while stack:
        a = stack.pop()
        order.append(a)
        kids = children.get(a)
        if kids:
            stack.extend(kids)

    worst = {}                                      # asset -> (minutes, child id) of its worst child
    for a in reversed(order):
        p = parent[a]
        if p is None:
            continue
        t = total[a]
        total[p] += t
        if t > 0:
            w = worst.get(p)
            if w is None or t > w[0] or (t == w[0] and a < w[1]):
                worst[p] = (t, a)

    out = []
    for q in queries:
        if q not in total:
            out.append((-1, None) if drill else -1)
        elif drill:
            w = worst.get(q)
            out.append((total[q], w[1] if w else None))
        else:
            out.append(total[q])
    return out
```

**Explanation.** Build each asset's parent and children from the pairs, which may come in any order. Sum each asset's own unplanned minutes, skipping planned work and records for assets that are not in the hierarchy. Then produce a pre-order from the sites with an explicit stack. In that order every asset appears before all of its descendants, so read backwards, every asset appears after them. Walking the reversed order and adding each asset's (now final) total into its parent's gives every subtree total in one pass. The drill-down is computed in the same pass: when a child's total is final, it is compared with the parent's current worst child, ties going to the smaller id as a string. Children with no downtime never become the worst child, so a parent with none stays without one (None). Each query is then a dictionary lookup, with `-1` (or `(-1, None)`) for an unknown asset.

**Complexity.** O(n + e + q) time and O(n) memory. The timing test is a plant of about 63 000 to 81 000 assets in six sites, 150 000 records and 100 000 queries, 30% of them for sites and 35% for lines. The reference runs in about 0.3 s in CPython. Walking each queried asset's subtree took over 60 s (estimated more than two minutes), because a site query visits about 13 000 assets. Two middle approaches pass, and that is acceptable. Adding each record to every ancestor costs O(e · depth), which is fine at this depth (about 0.3 s) and is a correct, simple answer for shallow hierarchies. Caching each queried asset's subtree walk costs at most the sum of distinct queried subtrees, which is O(n · depth) (about 0.3 s here). Ask both kinds of candidate the deep-hierarchy follow-up: either approach becomes quadratic on a chain thousands of levels deep, and a recursive walk raises RecursionError there.

**Dialect notes.** In SQL, the same rollup is a recursive CTE that pairs each asset with all its ancestors (a closure), joined to the records and grouped by ancestor. That is O(n · depth) rows. Many warehouses store such a closure table or a materialised path (for example `S1/S1-L02/S1-L02-M07`) and group by prefix. In Java or C++, the bottom-up pass is the same, with an explicit stack instead of recursion. Not executed here.

**Edge cases built into the tests.** A component counting only its own records; a site adding everything below it and its own records; children listed before their parents; assets with no downtime (`0`); unknown assets (`-1`); two sites kept apart; repeated records on one asset; the same asset queried twice; (Hard) planned work excluded, records for retired assets ignored, an asset whose only records are planned; (Very Hard) a tie between worst children broken by the id that sorts first as a string (`M10` before `M3` before `M9`), no drill-down when no child has downtime, the worst child judged by its whole subtree, and a child with only planned work never chosen.

**Common mistakes.** Assuming parents are listed first; counting only leaves and dropping records on lines or sites; returning `0` for an unknown asset, or `-1` for an asset without downtime; counting planned work; raising KeyError on a retired asset; choosing the worst child by its own records instead of its subtree; numeric comparison of ids in the tie rule; recursion without thinking about depth.

**Follow-up guidance.** (1) A new record adds its minutes to the asset and its ancestors: O(depth) per record, which is fine for a shallow hierarchy. Keep totals per asset in a store keyed by asset, and accept late records the same way. (2) The hierarchy changes over time, so store parent links with validity intervals and attribute each record by the hierarchy in force at the record's time (or by today's hierarchy, which is a different question, and say which one the report answers). (3) Overlapping records need a union of intervals per asset, and at higher levels, a stoppage of a line is not the sum of its machines' stoppages. Merge intervals bottom-up, or define the metric per level. (4) Compute the rollup in a batch engine with a closure table or materialised paths, store totals per asset and period, and serve lookups from a key-value store or an indexed table. Recompute only the affected ancestors on change.

**Rubric anchors.** 2: per-query subtree walks, or wrong treatment of an asset's own records or of input order. 3: all tests pass with one bottom-up pass (or walking up from records, explained as O(e · depth)). 4: also gives the iterative order without prompting, computes the drill-down in the same pass, and answers the change-over-time and overlap follow-ups precisely.

**Strong signals.** Asks whether parents come first and how deep the hierarchy can be; states the cost of per-query walks before coding. **Red flags.** Walking every subtree per query and calling it "linear"; ignoring records on non-leaf assets.

## PLT-L2-03

**Reference solution** (the fixed sync)

```python reference
from datetime import datetime, timedelta


def _cast(kind, raw, source_offset):
    if kind == "int":
        return int(raw)
    if kind == "bool":
        return raw.strip().lower() == "true"                 # bool("false") is True
    if kind == "timestamp":
        text = raw.strip().replace("T", " ")
        offset = source_offset                                # no zone: the source's local time
        if text.endswith("Z"):
            offset = 0
            text = text[:-1]
        elif len(text) > 19 and text[19] in "+-":
            sign = 1 if text[19] == "+" else -1
            offset = sign * (int(text[20:22]) * 60 + int(text[23:25]))
            text = text[:19]
        t = datetime.strptime(text, "%Y-%m-%d %H:%M:%S") - timedelta(minutes=offset)
        return t.strftime("%Y-%m-%dT%H:%M:%SZ")
    return raw


def sync_objects(store, changes, schema, source_offset):
    for ch in changes:                                        # one pass, in commit order
        pk = ch["pk"]
        if ch["op"] == "delete":
            store.pop(pk, None)
            continue
        old = ch.get("old_pk")
        if old is not None and old != pk and old in store:
            obj = store.pop(old)                              # the object moves to its new key
        else:
            obj = dict(store.get(pk, {}))
        for name, raw in ch["props"].items():
            if name not in schema:
                continue
            obj[name] = None if raw is None else _cast(schema[name], raw, source_offset)
        store[pk] = obj
    return store
```

**The planted bugs, their symptoms and their fixes.**
1. **A changed primary key copies the object instead of moving it.** The code reads the object from `old_pk` and writes it under `pk`, but never removes `old_pk`. Symptom: objects appear twice after the source renumbers them, and links or counts double. Fix: pop the object from `old_pk` and store it under `pk`.
2. **Deletes are applied after all upserts.** The code splits the batch by operation type to "write each object once", which loses commit order. Symptom: a row deleted and re-created in the same batch vanishes, because the upsert is applied first and the delete removes it afterwards. Fix: one pass in commit order.
3. **`bool("false")` is True.** Any non-empty string is truthy in Python. Symptom: every "hazardous" or "safety critical" flag reads true. Fix: compare the lower-cased text with `"true"`.
4. **A timestamp without a zone is read as UTC.** The default offset is `0`, not `source_offset`. Symptom: due times from a site in another zone are hours off, while zoned timestamps (with `Z` or `±HH:MM`) are right. Fix: default the offset to `source_offset`.
5. **An explicit null is skipped.** `if raw is None: continue` treats "set to null" like "not sent". Symptom: a carrier or crew removed in the source stays on the object. Fix: set the property to `None` when the raw value is `None`, and keep a property only when it is missing from `props`.

Each bug has its own check, and each check fails on the original code and passes once that one bug is fixed, whatever the state of the others: a renumbered object, a delete then re-create, "false" in two letter cases, a timestamp with no zone (one that crosses midnight into the next month), and an explicit null next to a missing property. Checks that pass on the buggy code on purpose (a zoned timestamp, a delete after an upsert, an unknown delete, a property outside the schema, integers with leading zeros) show the candidate which behaviour was already right.

**Explanation.** An object sync is a fold of change rows over the object store, in commit order. A key change is a move, not an insert. Casting is where text becomes typed data, and both booleans and zone-less timestamps need an explicit rule. Patch semantics need a three-way distinction between a value, an explicit null and an absent property.

**Complexity.** O(n) time over the change rows, O(objects) memory. The timing test is 100 000 rows (Medium) or 200 000 rows, and the reference runs in about 0.5 to 0.9 s in CPython, most of it in `strptime`.

**Dialect notes.** In SQL, the same sync is a `MERGE` in commit order, which most engines cannot do in one statement for several rows per key, so the batch is first reduced to the last row per key. A key change becomes an `UPDATE … SET pk = :new WHERE pk = :old`. Casting `'false'::boolean` works in PostgreSQL, but `CAST('false' AS BOOLEAN)` differs in other engines. A `TIMESTAMP` without a zone is interpreted in the session zone in PostgreSQL and Snowflake (`TIMESTAMP_NTZ` stores it as is). Spark uses the session time zone. Not executed here.

**Edge cases built into the tests.** A renumbered object; a key change for an object the store never had; a delete then a re-create; an upsert then a delete; a delete for an unknown key; "false" and "FALSE" and "True"; integers with leading zeros and a minus sign; zone-less timestamps, one crossing into the next day and month; timestamps with `Z`, `+05:30` and `-05:00`; an explicit null with a missing property on another object; a property outside the schema.

**Common mistakes.** Fixing the key move but leaving the old key; "fixing" deletes by checking whether a later upsert exists, instead of restoring commit order; `raw.lower() in ("true", "1", "yes")` (fine) but forgetting case; applying `source_offset` to zoned timestamps too, or with the wrong sign; clearing a property when it is missing from `props`; rewriting the whole function instead of five small fixes.

**Follow-up guidance.** (1) Diff two snapshots by key: keys only in the old snapshot are deletes, keys only in the new are inserts, and keys in both with different values are updates. A renumbered row looks like a delete and an insert unless there is a stable surrogate (a source row id or a content match), so the object's links and user edits are lost unless you detect it. (2) Keep user edits as a separate layer on top of the source values, with a stated precedence (user edit wins until the source changes that property, or always), and show where each value came from. (3) Every zone-less timestamp from that site after the change is off by an hour. Prevent it by making the source send offsets, or by storing a named time zone per source instead of a fixed offset. (4) Quarantine the failed row with the error and the raw value, apply the rest of the batch, and alert. Failing the whole batch blocks every other update. Silently writing `None` hides the problem.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also explains why commit order matters with a concrete sequence, states patch semantics (value, null, absent) precisely, adds a regression test per bug, and gives a good answer on snapshots and user edits.

**Strong signals.** Reproduces each bug with a two-row example before fixing; asks where a zone-less timestamp's zone comes from. **Red flags.** Converting every timestamp with the server's local zone; treating "deletes after upserts" as an optimisation worth keeping.

## PLT-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Action log.** Each action is written first to a transactional action log: action id, user, object type and key, action type, parameters, the version (or last-modified time) of each source record the user saw, the target system, the time, and the stated reason where the workflow asks for one. The log row and an outbox entry are written in one transaction. The action id is the identity of the write for its whole life.
- **Object view.** The application shows the object with the pending change marked as pending, overlaid on the last synced source values. It becomes "applied" only when the write succeeds and the next sync confirms it, and "rejected" or "in conflict" with the reason otherwise. The source remains the system of record.
- **Writeback workers.** One queue per target system (and, inside it, ordering per record key), so actions on one record are applied in order and a slow system does not hold up the others. Workers honour each system's rate limits and run a connector per system.
- **Conflict detection.** Where the source supports it, a conditional write ("update if version = v" or an ETag). Where it has only a last-modified time, read the record and compare it with the time seen before writing, accepting a small race window. Where it has nothing, read and compare the fields the action changes, or route such actions to a review step. A conflict is never overwritten. It goes to the user (or a queue) with both values and a choice.
- **Retries.** Transient errors are retried with backoff and a cap. A write that timed out is ambiguous, so before retrying, the worker checks whether it was applied (a reference to the action id stored on the record, or a read of the fields and version). Where the source accepts a client reference, the action id is sent with every attempt. Permanent errors (validation, permissions) fail the action with the message.
- **Multi-record actions.** Applied as a sequence with a compensating action for each step (a saga). If step two fails, step one is compensated, and the action is marked failed with both outcomes recorded. Where the source offers a single API call for the pair, it is used instead.
- **Confirmation.** The next sync from the source is matched to pending actions by record key and version (or by the action reference), and the action is marked confirmed. A sync that shows a different value for an "applied" action raises a discrepancy, because the source changed it again, or the write did not stick.
- **Audit trail.** The action log is append-only, with every state transition (created, sent, applied, confirmed, conflict, rejected, compensated) as a row with time and detail. It is partitioned by time and indexed by object key and user, so "every change to this record and why" is a key lookup. It is retained under the customer's policy.

**Competing designs to accept.** Immediate optimistic update of the object (show the new value at once, revert on failure) if the candidate explains the revert and what others see meanwhile; synchronous writes for low-volume actions with clear timeouts and the same log; change-data-capture from the source used for confirmation instead of the periodic sync; routing all conflicts to a human queue rather than to the acting user.

**Bottlenecks and failure modes.** A shared queue where one down system blocks all; retries without an applied check, which double-apply; last-write-wins overwrites of source changes; pending actions never confirmed because the sync lags or keys differ; an audit trail that is only application logs; per-record ordering lost when workers scale out.

**Incident guidance.**
- *The ERP is down for {{outage}}*: its queue grows while the others keep moving. Users see their actions as pending with a clear "the ERP is unavailable" status. Workers back off with a cap and resume in per-record order when it returns. Every write is conditional, so actions on records changed meanwhile become conflicts, not overwrites. Alert on queue age per system, and stop accepting new actions for that system if the backlog exceeds what the business can wait for.
- *A connector retries without checking*: the double-applied quantity changes are found by comparing the action log with the source's change history (or with the synced values). Correct them through compensating actions, logged as such, roll back the connector, and add a test that a timed-out write is checked before it is retried. Notify the owners of the affected purchase orders.
- *The slowest sync overwrites users' changes in the platform's view*: the sync is {{sync_delay}} behind, so it shows values from before the users' actions. Pending or recently applied actions must stay overlaid until a sync that is newer than the write confirms them. Compare sync data versions with write versions, not wall clock times. Reprocess the affected records' view and add a guard.

**Follow-up guidance.** (1) Pending status, per-system queue, backoff, ordered replay, conditional writes turning stale actions into conflicts. (2) Application first: the conditional write succeeds, and the later ERP edit is a normal source change synced back. ERP first: the application's write is conditional on the old version, so it becomes a conflict shown to the planner. (3) Compensate the first write, mark the action failed with both outcomes, and alert. Never leave it half-applied silently. (4) The sync data predates the write. Keep the overlay until a newer sync, and investigate if a newer sync still shows the old value. (5) An append-only, time-partitioned log with indexes on record key and user, or a dedicated audit store. Summaries for dashboards, the raw log for investigations.

**Rubric anchors.** 2: direct synchronous writes with last-write-wins, no conflict detection, logs as the audit trail. 3: a durable action log, per-system queues, conditional writes or a fallback per source capability, explicit action states, safe retries, confirmation by sync. 4: also handles ambiguous timeouts precisely, multi-record compensation, ordering per record, sync lag versus overlay, and a credible plan for each incident.

**Strong signals.** Asks which source systems support versions before choosing a conflict strategy; treats a timeout as "unknown", not "failed". **Red flags.** "Retry until it succeeds"; "the platform is the source of truth now".

## PLT-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **What a branch is.** A branch is a named pointer set: the code version of each transform (from a code branch) and, for each dataset, either a branch-owned version or a fall-back to main's version. When the branch is created, it records main's dataset versions at that point (a base), so its inputs are known.
- **Reading unchanged datasets.** An unchanged dataset is read from main's version at the branch's base (pinned) by default, so comparisons are against the same inputs. A "refresh from main" operation moves the base forward and marks downstream branch outputs stale.
- **Affected datasets.** From the dependency graph, the affected set is the outputs of changed transforms and all their descendants. Only those run on the branch, in topological order, reading branch versions where they exist and the base versions otherwise. Nothing upstream runs.
- **Storage.** Datasets are versioned file sets in object storage with manifests. A branch version is a new manifest. Unchanged data is never copied, and even a rebuilt dataset can share unchanged files (copy-on-write by partition when a transform is incremental).
- **Comparison.** For each affected dataset, compare the branch's version with main's version built from the same base inputs: schema differences, row counts, key-level differences (only in main, only in branch, changed), and per-column value differences with examples and distributions. Run main's version at the base if it does not exist, or compare against the base and label the input difference. Non-deterministic transforms (current time, sampling) are flagged, and are compared on stable columns or with tolerances.
- **Merge.** Merging the code is a normal code merge with review. For data, the guarantee is reproducibility: after the merge, main's affected datasets are rebuilt from main's code and current inputs, or the branch's outputs are promoted only if the branch's base equals main's current inputs for those datasets. Concurrent branches that change the same transform conflict at the code level. The second to merge must rebase, rebuild its affected set and compare again.
- **Access controls.** Every branch output inherits the restrictions (markings, in this exercise's model) of its inputs, computed from lineage exactly as on main, and the branch cannot loosen them. Branch visibility is limited to the branch's members as well, never wider than the data's own restrictions.
- **Compute and lifecycle.** Branch builds run in a lower-priority pool with quotas per branch, so main's builds are protected. Branches expire after inactivity, and their unreferenced versions are garbage-collected while main's history is retained under its own policy.

**Competing designs to accept.** Branches that always read main's latest data (simpler, but comparisons drift, so the candidate must say how to label that); zero-copy clones per branch at the storage layer; environment-per-branch with sampled data for very large graphs (accept if the candidate explains what sampling cannot show); table-format branching (snapshot references in a table format) if the candidate covers the graph-level affected set and comparisons.

**Bottlenecks and failure modes.** Branch builds starving main's compute; a change near the top of the graph that makes "only affected datasets" most of the graph; comparisons against moving inputs; branch outputs created without inherited restrictions; storage growth from abandoned branches; merges that promote branch data built from stale inputs.

**Incident guidance.**
- *A branch build near the top of the graph competes with main's nightly build*: branch builds run in a separate, capped pool with lower priority, so main's build proceeds. Before the build starts, show the affected set's size and estimated cost against {{rebuild_cost}}, and offer to run a sampled or partition-limited build first. Pause the branch build if main's SLA is at risk.
- *A merged branch's numbers differ on main*: the branch compared against a two-week-old base. Show the base age on every comparison, block (or warn on) merges whose base is older than a set limit, and require a refresh from main and a re-comparison. Main's rebuild after the merge is the source of truth, so explain the difference to stakeholders as an input change, not a code change.
- *A branch output from a restricted dataset is widely readable*: restrict it at once, find everyone who accessed it from the access log, and inform the data owner under the incident process. Fix the cause: branch outputs must compute restrictions from lineage at creation, with no default. Add a test that every new dataset version carries its inputs' restrictions.

**Follow-up guidance.** (1) The comparison mixes input changes and code changes. Refresh the base, rebuild the affected set, and compare against main's version of the same base. (2) The second merge conflicts in code. After the first merge, the second branch rebases onto main, rebuilds its affected set, and is compared again before it merges. (3) Show the estimated cost first. Build on a sample or a subset of partitions, compare there, and run the full build only before the merge, in the low-priority pool. (4) Keep branch versions while the branch is open and for a short time after merge or close, collect unreferenced files by manifest reference counting, and keep main's history under its own retention. (5) Restrictions computed from lineage at the moment the output is written, enforced on read, and covered by a test; a review shares a link, never an export.

**Rubric anchors.** 2: copy the whole graph per branch, or rebuild everything; counts-only comparison; no plan for main moving on. 3: pointer-based branches with fall-back to main, affected-set builds from the graph, key-level comparisons, a merge that rebuilds main. 4: also pins a base and labels comparisons by it, handles concurrent merges and non-deterministic transforms, enforces inherited restrictions on branch outputs, isolates compute, and has a credible plan for each incident.

**Strong signals.** Asks whether the branch reads frozen or live inputs before designing the comparison; separates the code merge from the data rebuild. **Red flags.** "Merge the branch's data into main's tables"; branch outputs that are "temporary, so restrictions do not matter".
