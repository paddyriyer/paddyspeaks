# Microsoft · Loop 2 — evaluator notes (hidden from candidates)

## MSF-L2-01

**Reference solution**

```python reference
from collections import deque


def scan(signatures, chunks):
    # Build the trie: goto[s] maps a byte to the next state, out[s] lists
    # (length, sig_id) for every signature that ends in state s.
    goto, fail, out = [{}], [0], [()]
    for sig_id, pattern in signatures:
        s = 0
        for b in pattern:
            nxt = goto[s].get(b)
            if nxt is None:
                nxt = len(goto)
                goto[s][b] = nxt
                goto.append({})
                fail.append(0)
                out.append(())
            s = nxt
        out[s] = out[s] + ((len(pattern), sig_id),)
    # Failure links breadth-first; merge each node's outputs with its failure
    # node's, so a state reports every signature that is a suffix of its string.
    queue = deque(goto[0].values())
    while queue:
        s = queue.popleft()
        for b, t in goto[s].items():
            queue.append(t)
            f = fail[s]
            while f and b not in goto[f]:
                f = fail[f]
            g = goto[f].get(b, 0)
            fail[t] = g if g != t else 0
            if out[fail[t]]:
                out[t] = out[t] + out[fail[t]]
    # One pass over the file; the state carries across chunk boundaries.
    found = []
    s = 0
    pos = 0
    for chunk in chunks:
        for b in chunk:
            while s and b not in goto[s]:
                s = fail[s]
            s = goto[s].get(b, 0)
            if out[s]:
                for length, sig_id in out[s]:
                    found.append((pos - length + 1, sig_id))
            pos += 1
    found.sort()
    return found
```

**Explanation.** All signatures go into one trie. A failure link from a node points to the node for the longest proper suffix of that node's string that is also a prefix in the trie. On a mismatch the scan follows failure links instead of moving back in the file, so each byte is read once. The links are built breadth-first, because a node's link depends on its parent's. A state can complete several signatures at once: its own, and every signature that is a suffix of its string, such as `cd` inside `abcd`. Merging each node's output list with its failure node's output list during the build means every occurrence is reported without walking a chain on every byte. The automaton state is the only thing that crosses a chunk boundary, so occurrences that span chunks are found without joining the chunks. The offset is the absolute position minus the signature length plus one. A final sort gives the order by offset and then id.

**Complexity.** Building is O(m) trie steps over m total signature bytes, plus the failure computation, which is amortised linear with dict transitions. Scanning is O(n + z): each byte moves forward once, and the failure steps are paid for by earlier forward steps. Sorting adds O(z log z). The merged output lists cost memory proportional to the total output size, which is bounded by m times the nesting depth. The timing test (20 000 signatures of 8–16 bytes over 500 000 bytes from a four-value alphabet, about 66 000 occurrences) runs in about 1 s in CPython. One `bytes.find` loop per signature is 20 000 passes and takes about 20 s, even though each pass runs in C.

**Dialect notes.** In Java or C++ a dense 256-wide transition table per node, filled in completely during the build (a deterministic automaton with no failure steps at scan time), is the classic fast layout. Its memory is 256 × states × 4 bytes, so compressed layouts such as a double-array trie are used for large sets. Several open-source libraries implement Aho–Corasick, and `grep -F` with many patterns uses a related multi-pattern search. A SQL formulation over a byte table is impractical. Not executed here.

**Edge cases built into the tests.** Overlapping occurrences of one signature; occurrences at the first and the last byte; a partial match that fails and must resume inside itself (`aab` in `aaab`); no occurrence; a signature longer than the file; an empty file; (Hard) a signature that is a suffix of a longer one, a signature in the middle of a longer one, identical patterns under two ids, and several signatures at one offset ordered by id; (Very Hard) occurrences that span two chunks, one that spans three chunks with a one-byte chunk in the middle, empty chunks, and offsets counted from the start of the file.

**Common mistakes.** Restarting the walk at the next byte after a mismatch, which is quadratic; forgetting outputs reachable through failure links, so `cd` is missed when `abcd` is in the set; storing one output per node, so identical patterns under two ids lose one; computing failure links depth-first; resetting the state at each chunk; offsets relative to the chunk; `re.finditer` with an alternation, which reports neither overlaps nor two signatures at one offset; joining the chunks, which works on the tests but fails the stated constraint.

**Accepted alternative.** Grouping signatures by length and hashing every window of each length (Rabin–Karp per length) is correct and passes this timing test with nine distinct lengths, at about the same speed. It is O(n · L) for L distinct lengths, and it needs care with collisions if a rolling hash replaces slicing. Give full marks for correctness, and probe how it scales when signature lengths range from 4 to 64.

**Follow-up guidance.** (1) Rebuild the automaton off the scan path, which takes about a second for 20 000 signatures in Python and milliseconds in a compiled language, then swap a reference atomically. Scans in progress finish on the old set. Version the set so a detection can say which set found it. (2) Split each wildcard signature into its exact fragments, match the fragments with the automaton, and verify the gaps and the remaining fragments when an anchor fragment hits. Choose the rarest fragment as the anchor. (3) A prefilter, for example a bitmap of possible two-byte or four-byte prefixes, can reject most positions cheaply. It must be a superset test (no false negatives), and it can be checked by comparing results with and without it on a corpus. (4) Dicts per node are flexible and large. A dense 256-wide table is fastest and largest. Compressed forms (a default transition plus a few exceptions, or a double-array trie) trade a little speed for a lot of memory.

**Rubric anchors.** 2: a per-signature search or a per-position check of every signature; correct on small inputs but too slow, or nested signatures missed. 3: Aho–Corasick with failure links and merged outputs; all tests pass. 4: also carries the state across chunks without joining, explains the amortised O(n + m + z) bound, and answers the update, wildcard and memory follow-ups concretely.

**Strong signals.** Asks whether overlaps and identical patterns count before coding; draws the trie for three signatures and walks a mismatch by hand. **Red flags.** "Use a regex"; joining the file into memory after being told it can be huge; failure links without output merging.

## MSF-L2-02

**Reference solution**

```python reference
def cheapest_tiering(reads, tiers):
    SHIFT = 20                       # key = cost << SHIFT | changes: one comparison orders both
    INF = 1 << 200
    spec = []
    for name in tiers:
        t = tiers[name]
        cap = max(t["min_days"], 1)  # days in the tier, counted up to the minimum
        early = [max(0, t["min_days"] - k) * t["store"] << SHIFT for k in range(1, cap + 1)]
        spec.append((t["store"], t["read"], cap, early, t["enter"] << SHIFT, t["leave"] << SHIFT))
    # cur[i][k - 1]: cheapest key for the days so far, ending in tier i after k days there
    cur = []
    for store, read, cap, early, enter, leave in spec:
        row = [INF] * cap
        if read is not None or reads[0] == 0:
            row[0] = (store + reads[0] * (read or 0)) << SHIFT
        cur.append(row)
    for r in reads[1:]:
        # the cheapest way to end a stay in each tier yesterday: shortfall plus leave fee
        out = [min(map(int.__add__, row, sp[3])) + sp[5] for row, sp in zip(cur, spec)]
        nxt = []
        for i, (store, read, cap, early, enter, leave) in enumerate(spec):
            if read is None and r > 0:          # offline tier on a day with reads
                nxt.append([INF] * cap)
                continue
            day = (store + r * (read or 0)) << SHIFT
            move_in = min(o for j, o in enumerate(out) if j != i) + enter + 1
            row = cur[i]
            if cap == 1:
                new = [min(row[0], move_in) + day]
            else:
                new = [move_in + day]
                new.extend(v + day for v in row[:-2])
                new.append(min(row[-2], row[-1]) + day)   # at or past the minimum
            nxt.append(new)
        cur = nxt
    # deletion after the last day: the final stay's shortfall, no leave fee
    best = min(min(map(int.__add__, row, sp[3])) for row, sp in zip(cur, spec))
    return (best >> SHIFT, best & ((1 << SHIFT) - 1))
```

**Explanation.** A schedule's cost is a sum of daily costs, plus a charge each time a stay ends: the early-deletion shortfall always, and the `leave` and `enter` fees for a move. To price the end of a stay you need only its tier and its length, and the length matters only up to the tier's minimum. So the state is `(tier, min(days in tier, min_days))`, and staying moves `k` to `min(k + 1, cap)`. A move into tier `t` on day `d` needs, for every other tier, the cheapest way to end a stay there on day `d − 1`. That is the minimum over its states of the key plus the shortfall, plus the leave fee, computed once per tier per day. The pair `(cost, changes)` is packed into one integer (`cost << 20 | changes`), so the lexicographic tie rule is a plain `min`, and each move adds 1 to the low bits. Day 0 is free placement. Offline tiers are infeasible on days with reads. After the last day, each state pays its shortfall and no leave fee.

**Complexity.** O(D · (Σ caps + T²)) time and O(Σ caps) memory, where caps are the minimums. For 3 650 days with minimums 30, 90 and 180 that is about 1.1 million state updates, and the timing test runs in about 0.2 s in CPython. Enumerating sequences is Tᴰ. A programme over stays, which tries every start day of the last stay (O(D² · T²)), is correct and is what the generator's oracle uses on small traces. It takes about 14 s at 3 650 days with two tiers, and more with four.

**Dialect notes.** In Java, Scala or C++ use `long` costs and a separate small integer for changes, or pack them, keeping the sentinel far from overflow when fees are added. The per-tier rows are ring buffers if you want to avoid shifting arrays. In SQL this is impractical as a recursive CTE over a ten-year trace. A lifecycle simulator would run it in a batch job over sampled blobs. Not executed here.

**Edge cases built into the tests.** A stay of exactly `min_days` days (no charge); one day short (one day's storage); deletion that charges the shortfall but not the leave fee; a single-day trace; a cost tie broken by fewer changes; a stay longer than the minimum; (Hard) an offline tier around a day with reads, a read after a long quiet stretch (rehydrate or stay online), a rehydration fee larger than the savings, and a move to a cooler tier before the warmer tier's minimum; (Very Hard) four tiers with a read in the middle of a long quiet stretch, and minimums longer than the whole trace.

**Common mistakes.** A per-day greedy choice; charging the shortfall only on moves and not at deletion, or charging the leave fee at deletion; an off-by-one that charges a stay of exactly `min_days`; tracking the days in the tier without a cap, which makes the state space D² · T; charging an enter fee on day 0; forgetting the tie rule; recursion with `lru_cache` that hits the recursion limit on 3 650 days; float infinity that turns the result into a float.

**Follow-up guidance.** (1) For example: move to cool after N days without a read, and to archive after M. Replay sampled traces under each candidate (N, M), compare the cost with this function's lower bound, and pick the rule with the smallest regret, checked on a holdout sample. (2) Sample blobs stratified by size and access pattern, weight by size, and replay. The bias comes from blobs that are new (short traces) and from survivorship (deleted blobs dropped from the sample). (3) A read on day `d` forbids the offline tier on day `d − 1` as well. That is the same feasibility rule shifted by a day, and a rehydration started early pays for an extra online day. (4) Add the price period to the state or split the trace at the change day. Charging the shortfall at the price in force when the stay began, or when it ended, are both defensible. The candidate should pick one and apply it consistently.

**Rubric anchors.** 2: a greedy or an enumeration, or a DP that gets the deletion or tie rules wrong. 3: a correct day-by-day DP with capped counters; all tests pass. 4: also computes the move cost once per tier per day, explains why the cap makes the state space small, and gives a convincing method for choosing a lifecycle rule from replays.

**Strong signals.** Asks whether deletion at the end pays the leave fee and whether day 0 is free; states the state space before coding. **Red flags.** "Always move to the cheapest storage tier when there are no reads"; ignoring the minimum stay.

## MSF-L2-03

**Reference solution** (the fixed generator)

```python reference
from datetime import datetime, timezone


def _fmt(ts, offset_min):
    return datetime.fromtimestamp(ts + offset_min * 60, timezone.utc).strftime("%Y-%m-%d %H:%M")


def attendance_report(meeting, events):
    first, sessions, open_at = {}, {}, {}
    for ev in events:
        key = ev["user"] or "guest:" + ev["name"]           # guests keyed by name
        device = (key, ev["device"])
        if ev["type"] == "join":
            first.setdefault(key, ev["ts"])                  # the first join survives a rejoin
            open_at[device] = ev["ts"]
        elif device in open_at:
            sessions.setdefault(key, []).append((open_at.pop(device), ev["ts"]))
    for (key, _), start in open_at.items():                  # still connected when the meeting ended
        sessions.setdefault(key, []).append((start, meeting["end"]))
    report = {}
    off = meeting["tz_offset_min"]
    for key, spans in sessions.items():
        spans.sort()
        total, run_start, run_end = 0, None, None            # union of sessions on absolute time
        for start, end in spans:
            if run_end is None or start > run_end:
                if run_end is not None:
                    total += run_end - run_start
                run_start, run_end = start, end
            elif end > run_end:
                run_end = end
        total += run_end - run_start
        report[key] = {
            "first_join": _fmt(first[key], off),             # the organiser's local time
            "last_leave": _fmt(max(end for _, end in spans), off),
            "seconds": total,
        }
    return report
```

**The planted bugs, their symptoms and their fixes.**
1. **A rejoin overwrites the first join.** `first[key] = ev["ts"]` runs on every join. Symptom: someone who dropped out and came back appears to have arrived late. Fix: keep the earliest join (`setdefault`, since events are in time order, or `min`).
2. **Several devices are counted twice.** Per-session lengths are added, so time on a laptop and a phone at once counts twice. Symptom: 90 minutes present in a 60-minute meeting. Fix: merge each attendee's sessions into their union before measuring.
3. **Durations from the clock time of day.** `_clock(end) - _clock(start)` measures seconds since midnight, so a session from 23:50 to 00:10 has a negative length. Symptom: late-evening meetings show negative or tiny durations. Fix: subtract absolute timestamps; format only for display.
4. **Times shown in UTC.** `_fmt` ignores `tz_offset_min`. Symptom: an organiser at UTC−7 sees join times seven hours ahead, and one at UTC+5:30 sees the wrong date for an evening meeting in UTC. Fix: add the offset before formatting.
5. **Every guest is one attendee.** `ev["user"] or "guest"` gives all guests the same key, so their sessions merge. Symptom: one "guest" row. Fix: key guests as `"guest:" + name`, which also keeps a guest apart from a member with the same name.

Each bug has its own check, and that check passes when only its bug is fixed, whatever the others: a leave and rejoin; two devices joined in the same second (so bug 1 cannot hide it); a session across UTC midnight with a UTC organiser; a daytime meeting with a western offset, and an evening UTC meeting with a +5:30 organiser whose local date rolls over; two guests, and a guest and a member with the same name. Two more checks (a device still connected at the end, and a leave with no join) pass on the original code and guard against regressions while fixing.

**Explanation.** An attendance report is a small sessionisation problem: open and close sessions per attendee and device, merge them per attendee, and present them in the organiser's local time. Arithmetic belongs on absolute timestamps; time zones belong only in formatting. Identity must be chosen deliberately for people who have no account.

**Complexity.** O(n) to build sessions, plus O(s log s) to sort each attendee's sessions, so O(n log n) overall. The timing test (about 120 000 events for 25 000 people) runs in about 0.6 s in CPython, most of it in formatting.

**Dialect notes.** In SQL, sessions are a self-join or a window (`LEAD` over join and leave per attendee and device). The union is the classic gaps-and-islands pattern: order sessions by start, start a new island when a start is later than the running `MAX(end)` of earlier rows, then sum island lengths. Convert to local time with `AT TIME ZONE` or by adding an interval of the offset, in the select list only. Not executed here.

**Edge cases built into the tests.** A leave and rejoin; two devices from the same second; a session across midnight; a western offset; an eastern half-hour offset with a date rollover; two guests; a member and a guest with the same name; a device still connected at the end; a leave with no join; (Hard and Very Hard samples) several devices, guests, meetings across midnight in UTC or in local time, and stray leaves.

**Common mistakes.** Fixing the double count by taking `last_leave − first_join`, which counts the gap of a rejoin; merging intervals that are in clock time, so the midnight bug survives; subtracting the offset instead of adding it; using `datetime.fromtimestamp(ts)` without a zone, which depends on the machine's local time; keying guests by device; rewriting the whole function instead of making minimal fixes.

**Follow-up guidance.** (1) Keep open sessions in state and compute the union with "now" as the provisional end. Recompute incrementally per attendee. (2) Buffer per meeting until a watermark, sort by timestamp, and make first join a `min`. Pairing joins and leaves needs order per device, so use a per-device sequence number if clocks disagree. (3) Use the scheduled length if the meeting ended on time, and the actual length if it overran, and state the choice in the report. The union already handles several devices. (4) Pseudonymise guests per meeting, for example "Guest 3", with a mapping held only for the organiser if the tenant allows it.

**Rubric anchors.** 2: finds two or three bugs; several checks still fail. 3: all five fixed, every check passes, each one explained. 4: also explains why arithmetic and formatting must be separated, adds a regression test per bug, and gives good answers on live reports and late events.

**Strong signals.** Reproduces each complaint with a three-event case before changing code; notices that the two-device check was built so bug 1 cannot mask it. **Red flags.** Clamping negative durations to zero; "convert everything to local time first".

## MSF-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Event schema as an allow-list.** `event_id, tenant_id, user_object_id, app, action_type (enum), outcome (enum), client_version, ts_utc`. The ingestion edge validates against the schema and drops every unknown field before anything is written. Free-text fields are rejected by type: enums and ids only. Error queues store the validated envelope and the reason, never the raw body. Service logs at the edge log ids and reasons only. A content scanner samples the stored data for long strings or prompt-like text and alerts.
- **Ingestion.** Events land per region in the tenant's geography, partitioned by `tenant_id` and UTC date. Deduplicate by `event_id` within a window covering client retries (for example 48 hours), with a later daily dedup pass over the partition.
- **Per-user daily activity.** One row per `(tenant, user, app, day)` with action counts by type and an `active` flag (at least one intentional action). This table is small compared with events, and it is the base for everything else.
- **Exact distinct users per period.** A per-user summary `(tenant, user, app, last_active_day, active_days_bitmap_180)`, or simply the daily activity table queried with `COUNT(DISTINCT user)` over the period's days per tenant, which is exact and cheap at tenant scale. Daily distinct counts are never summed. Report snapshots are materialised daily for 7, 30, 90 and 180 days.
- **Licences.** A daily snapshot of licence assignments from the directory export, kept as validity intervals per user. Adoption = active licensed users ÷ licensed users on the period's last day (state the choice), with unlicensed activity reported separately.
- **Concealment and identity.** Storage holds the directory object id. Concealment is applied when serving: a per-tenant keyed hash (HMAC with a tenant-specific secret) gives stable pseudonyms within the tenant that cannot be linked across tenants. Names are joined from the directory at serving time, so they disappear when the user does.
- **Small groups.** Department breakdowns show counts only for groups of at least {{min_group}} users. Smaller groups are merged into "Other", and complementary suppression ensures a hidden cell cannot be recovered by subtracting from totals.
- **Deletion.** A directory deletion feed drives deletion of the user's rows from the activity tables and materialised reports within 30 days; aggregates keep counts but no identifier. A deletion log proves completion.
- **Residency and isolation.** Pipelines run per geography; only tenant-level aggregates with no user identifiers may leave a region, and only if policy allows. Every query is scoped by `tenant_id`, enforced by the serving layer.
- **Definitions and restatement.** Metric definitions are versioned. A definition change recomputes from the per-user daily table (events are not needed), the report shows the definition version and a note, and history is restated for the visible window.

**Competing designs to accept.** A streaming pipeline with per-tenant state for today and a batch job for history; a warehouse with dbt-style models over the daily activity table; HyperLogLog sketches for cross-tenant or exploratory views, provided tenant-facing active-user counts stay exact. Each is fine if content never lands and deletion is complete.

**Bottlenecks and failure modes.** A free-text field slipping through a deny-list; error queues, crash dumps or debug logs holding raw payloads; summing daily active users; pseudonyms that are global hashes; suppression that can be undone by subtraction; deletion that misses materialised snapshots; very large tenants making per-tenant partitions skewed; directory sync failures making licence denominators wrong.

**Incident guidance.**
- *An error field carries prompt fragments in about 0.1% of {{daily_actions}} events*: the allow-list should have dropped the field at the edge. If it did not, stop ingestion of that field, identify the affected partitions by scanning for the field, purge them (rebuild from the dropped-field version), purge error queues and logs, and record what was deleted and when. Treat it as a privacy incident with the owners of the client release, and add a schema test that fails on any free-text field.
- *A directory sync failure marks users in 300 tenants as unlicensed*: detect it with a monitor on day-over-day licence changes per tenant. Hold the report refresh for affected tenants, keep yesterday's licence snapshot, re-run once the export is fixed, and annotate the day if a report was already published.
- *A department below {{min_group}} users can be derived by subtraction*: apply complementary suppression or merge small groups into "Other" before totals are shown, and audit published reports for the same pattern.

**Follow-up guidance.** (1) Detection by a content scanner and schema monitoring; deletion by partition rebuild, plus logs and queues; prevention by the allow-list and a release check. (2) Suppress the group and a complementary one, or merge it into "Other". (3) Recompute from the per-user daily table under the new definition, show the version, and restate within the window. (4) Move per-user data with the tenant under a migration plan; until complete, reports read from the old region; nothing per-user is duplicated across regions. (5) Publish only aggregates across many tenants (for example percentiles of adoption by size band, each band with enough tenants), never anything that identifies a tenant.

**Rubric anchors.** 2: stores raw events "temporarily", sums daily active users, global hashes for pseudonyms. 3: allow-listed schema, per-user daily table with exact distinct counts, serving-time concealment, suppression, deletion and residency covered. 4: also closes the error-queue and log leaks, prevents subtraction attacks, versions metric definitions with restatements, and gives concrete incident plans.

**Strong signals.** Starts with the event schema and what is not in it; asks how admins will compare numbers with licences. **Red flags.** "We hash the prompt so it is safe"; approximations for tenant-facing counts with no explanation.

## MSF-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing.** Activity events land raw and immutable, partitioned by event date, deduplicated by `event_id` (a started and a succeeded event are different events of one operation, linked by an operation or correlation id). Listings land as immutable snapshots with the read time of each resource, not just the listing's start.
- **Identity.** `resource_key` is a surrogate. `resource_id_history(resource_key, resource_id_normalised, display_id, valid_from, valid_to)` maps every id string a resource has had to its key, compared case-insensitively. A move or rename event closes the old id's interval and opens the new one on the same key. If a listing shows a new id with the same type, name and properties as a resource that vanished, a heuristic link can be proposed but is marked inferred.
- **From events to state.** Succeeded create and update events mark a resource as changed at a time. Properties come from a read of the resource shortly after (a targeted read queue), or from the next listing. A delete closes the current version. A resource group delete closes every resource whose id is under that group at that time.
- **History model.** `resource_versions(resource_key, valid_from, valid_to, type, location, resource_group, subscription, sku, tags, source observed|inferred, caller, event_id)`, as validity intervals. Late events are inserted by splitting the interval they fall in. When a listing contradicts the current version, an inferred version starts at the listing's read time for that resource (the honest bound), with the earlier bound recorded as "changed between t1 and t2".
- **Reconciliation.** After each listing ({{listing}}): resources in the listing but not in state get an inferred create; resources in state but not in the listing, and not changed during the listing window, get an inferred delete; property differences become inferred updates. Reconciliation is skipped for subscriptions whose listing failed.
- **Daily inventory.** A view or materialised table: versions valid at the end of each UTC day. Because history is append-and-split and inputs are versioned, any past day can be recomputed and gives the same answer for the same inputs. Corrections from late events are visible as restatements with a change log.
- **Outputs.** Inventory by day for finance (joined to cost by `resource_key` through the id-history table, so cost follows moves); change history with caller and source for security and audit; data quality metrics (inferred change share, event lag, listing coverage).

**Competing designs to accept.** Rebuild-from-snapshots only, with events as a supplement for timing and caller (accept if the candidate explains the lost changes between listings); an event-sourced store replayed into state with periodic snapshot checkpoints; a lakehouse with SCD2 MERGE. Any is fine if identity survives moves and inferred changes are labelled.

**Bottlenecks and failure modes.** Using the id string as the primary key; trusting events as complete; treating a listing as an instant; overwrite-only state; case-sensitive joins; cascade deletes missed; event bursts from policies overwhelming targeted reads; the activity log's {{log_retention}} retention expiring during an outage.

**Incident guidance.**
- *The event feed stalls for six hours*: alert on event lag. The next listing infers the missed changes with no caller and a time range. When the feed recovers, backfill the stalled events (within {{log_retention}}) and upgrade inferred changes to observed ones where an event matches, adding the caller. Tell security which changes remain without a caller.
- *400 resource groups move overnight and cost allocation drops by a third*: cost is joined by the new ids, which are not yet linked to their resource keys. Link them from the move events (old id to new id), and fall back to inferred links from the listing. Rerun the allocation for the affected days, and add a monitor on unallocated cost share.
- *A tagging policy rewrites a tag across {{subscriptions}} subscriptions in an hour*: the targeted read queue would explode. Rate-limit reads, coalesce updates per resource, and let the next listing fill in properties. The history records one inferred or observed version per resource with the policy as caller.

**Follow-up guidance.** (1) Inferred creates with `valid_from` at the read time and an "earliest possible" bound unknown, flagged as found by listing. (2) Close every resource under that group at the delete time, with source observed for the group and inferred for its contents. (3) Join cost through the id-history table to the resource key, so both ids map to one resource. (4) Rebuild from the oldest listing available plus the events still retained; mark the gap as unknown; never invent a change time. (5) Show the caller as recorded (a policy or service identity), with the policy assignment if it can be found.

**Rubric anchors.** 2: an overwrite-only current-state table keyed by id; events trusted as complete. 3: surrogate keys with id history, validity-interval history, reconciliation against listings, observed vs inferred changes. 4: also honest timestamps for inferred changes, late-event interval splitting, cascade deletes, cost joins across moves, and concrete incident plans.

**Strong signals.** Asks what an event actually contains before designing; treats the listing as a series of reads, not an instant. **Red flags.** "The resource id is the key"; filling inferred changes with the listing's start time without saying so.
