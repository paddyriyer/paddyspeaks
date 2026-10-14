# Meta · Loop 2 — evaluator notes (hidden from candidates)

## MET-L2-01

**Reference solution**

```python reference
NEG = float("-inf")


def best_ad_load(values, gap, max_ads=None, advertisers=None):
    n = len(values)
    most = (n + gap) // (gap + 1)              # the spacing alone allows at most this many
    k = most if max_ads is None else min(max_ads, most)
    if k <= 0:
        return 0

    if advertisers is None:
        if k == most:                          # the cap never binds: one pass
            best = [0] * (n + 1)               # best[i]: slots [0, i) only
            for i in range(1, n + 1):
                take = values[i - 1] + best[max(0, i - 1 - gap)]
                best[i] = take if take > best[i - 1] else best[i - 1]
            return best[n]
        prev = [0] * (n + 1)                   # at most j - 1 ads in slots [0, i)
        for _ in range(k):
            cur = [0] * (n + 1)
            for i in range(1, n + 1):
                take = values[i - 1] + prev[max(0, i - 1 - gap)]
                cur[i] = take if take > cur[i - 1] else cur[i - 1]
            prev = cur
        return prev[n]

    # ends[i]: best total of a selection of exactly j ads whose last ad is in slot i.
    ends = list(values)
    answer = max(0, max(ends))
    for _ in range(2, k + 1):
        nxt = [NEG] * n
        b1, b1_adv, b2 = NEG, None, NEG        # best two earlier endings, different advertisers
        for i in range(n):
            p = i - gap - 1
            if p >= 0:
                x, a = ends[p], advertisers[p]
                if x != NEG:
                    if a == b1_adv:
                        if x > b1:
                            b1 = x
                    elif x > b1:
                        b2, b1, b1_adv = b1, x, a
                    elif x > b2:
                        b2 = x
            before = b2 if advertisers[i] == b1_adv else b1
            if before != NEG:
                nxt[i] = values[i] + before
        ends = nxt
        top = max(ends)
        if top == NEG:
            break
        if top > answer:
            answer = top
    return answer
```

**Explanation.** Without a cap this is the classic "no two chosen items too close" DP: `best[i]` is the best total over slots `[0, i)`; slot `i − 1` is either empty (`best[i − 1]`) or holds an ad, in which case the previous ad lies in `[0, i − 1 − gap)` and contributes `best[i − 1 − gap]`. Each value is used at most once and the spacing holds by construction. With a cap, `best_j[i]` (at most `j` ads in `[0, i)`) reads only layer `j − 1`, so no layer can place more than `j` ads. With advertisers, "the best prefix" is not enough, because whether slot `i` may follow depends on the advertiser of the last ad. The state becomes `ends_j[i]`: exactly `j` ads with the last one in slot `i`. The best eligible predecessor is the best ending at or before `i − gap − 1` whose advertiser differs from slot `i`'s. Keeping the best ending (and its advertiser) plus the best ending from any other advertiser answers that in O(1): if slot `i` has the best one's advertiser, take the second; otherwise take the first. Negative values are never forced in, but at Very Hard a slightly negative ad can be the best way to separate two valuable ads from the same advertiser, and the DP finds that without special handling. Capping `k` at the most ads the spacing allows keeps the no-cap case at O(n).

**Complexity.** O(n) time and O(n) memory without a cap; O(n · max_ads) time and O(n) memory with one (two layers at a time), independent of the number of advertisers. The timing checks are 300 000 slots (no cap) and 20 000 slots with up to 80 or 60 ads and 500 advertisers; the reference takes well under a second. Scanning every earlier slot per state is O(n² · max_ads) and does not finish; a per-advertiser maximum with a scan over the other advertisers is O(n · max_ads · advertisers), about 6·10⁸ steps here, and does not finish either.

**Dialect notes.** In Java, Scala or C++ use 64-bit totals: 300 000 values of up to 10⁶ exceed a 32-bit integer. A SQL engine is the wrong place for this DP; in a batch pipeline, sessions are independent, so the DP runs per session inside a `mapPartitions` (Spark) or a user-defined function, with no shuffle beyond grouping by session. Not executed here.

**Edge cases built into the tests.** All values negative (0); an empty feed; two peaks exactly `gap + 1` apart (both) and `gap` apart (one); a greedy trap where the single best slot blocks two good neighbours; `gap = 0`; (Hard) `max_ads = 0`, a binding cap where the best pair is not the two largest singles, and a cap larger than the spacing allows; (Very Hard) the same advertiser three times in a row, an advertiser returning after another, a −1 separator that is worth placing, the same separator when the cap leaves no room for it, a case where the best earlier ending has the same advertiser and the second-best must be used, and alternation plus spacing together.

**Common mistakes.** Off-by-one spacing (`q − p ≥ gap` instead of `gap + 1`); greedy by value; forcing at least one ad (returning a negative total); relaxing the cap layer in place so one layer adds two ads; at Very Hard, using a prefix maximum that ignores the last advertiser, keeping a second-best that may share the best one's advertiser, or skipping negative values entirely; recursion with memoisation that exceeds the recursion limit at 300 000 slots.

**Follow-up guidance.** (1) Keep back-pointers (the predecessor slot per state, O(n · max_ads) memory) or recompute layers backwards from the answer; state a tie rule, for example fewest ads, then earliest slots. (2) Online, a decision is final when the slot arrives; a threshold policy that adapts to remaining session length and value is typical. The offline optimum on logged sessions is an upper bound, so measure regret against it, and remember sessions end at unknown lengths. (3) A window cap needs the positions of recent ads in the state; with spacing `g` and window `w`, at most `⌈w / (g + 1)⌉` ads fit in a window, so the state is the last few ad positions — exponential in that count in general. Strong candidates propose Lagrangian relaxation (a per-ad penalty tuned until the constraint holds) or prove the window cap is implied by the spacing for the given numbers. (4) Replay logged sessions under both policies and compare value per advertiser segment; then an experiment with guardrail metrics for people's experience and advertiser outcomes.

**Rubric anchors.** 2: correct small cases but greedy, off-by-one spacing, or quadratic scans that fail the timing check. 3: all tests pass at the level attempted with O(n) or O(n · max_ads) and a clear recurrence. 4: also the best-two-of-different-advertisers argument, the negative-separator insight, reconstruction with a tie rule and a credible online discussion.

**Strong signals.** Asks whether "gap" counts organic slots or distance; asks whether negative ads may be chosen before coding; states the recurrence before writing it. **Red flags.** Assuming ads with negative value can be dropped up front at Very Hard without checking; enumerating subsets "because the feed is short".

## MET-L2-02

**Reference solution**

```python reference
def separation(friendships, queries, max_depth, inactive=None, count_paths=False):
    off = inactive or set()
    adj = {}
    for a, b in friendships:
        if a in off or b in off:
            continue                            # a deactivated account links nobody
        adj.setdefault(a, set()).add(b)         # sets: a repeated row is one friendship
        adj.setdefault(b, set()).add(a)

    def expand(frontier, dist, ways, depth):
        """Advance one side by one full layer; return the new layer."""
        layer = []
        for x in frontier:
            wx = ways[x]
            for y in adj.get(x, ()):
                d = dist.get(y)
                if d is None:
                    dist[y] = depth + 1
                    ways[y] = wx
                    layer.append(y)
                elif d == depth + 1:
                    ways[y] += wx               # another shortest way into y
        return layer

    out = []
    for u, v in queries:
        if u in off or v in off:
            out.append((-1, 0) if count_paths else -1)
            continue
        if u == v:
            out.append((0, 1) if count_paths else 0)
            continue
        dist_u, ways_u, front_u, du = {u: 0}, {u: 1}, [u], 0
        dist_v, ways_v, front_v, dv = {v: 0}, {v: 1}, [v], 0
        found = (-1, 0)
        while front_u and front_v and du + dv < max_depth:
            if len(front_u) <= len(front_v):     # grow the smaller side
                front_u = expand(front_u, dist_u, ways_u, du)
                du += 1
                layer, other, mine, theirs = front_u, dist_v, ways_u, ways_v
            else:
                front_v = expand(front_v, dist_v, ways_v, dv)
                dv += 1
                layer, other, mine, theirs = front_v, dist_u, ways_v, ways_u
            meet = [y for y in layer if y in other]
            if meet:                            # every meeting node is on a shortest chain
                found = (du + dv, sum(mine[y] * theirs[y] for y in meet))
                break
        out.append(found if count_paths else found[0])
    return out
```

**Explanation.** Breadth-first search from both ends, one full layer at a time, always growing the side with the smaller frontier. Before an expansion the two visited sets are disjoint. When side S grows to depth `d + 1` and its new layer touches the other side's visited set, every touching user `y` is at the other side's current depth `d'` exactly: if `y` were closer to the other end, the other side would already have expanded `y` and reached its S-side neighbour, so the sets would not have been disjoint. So the distance is `d + 1 + d'` for every meeting user, and every shortest chain passes through exactly one user of the new layer. Counting: `ways` holds the number of shortest ways into each user from its own end, and is complete for every user in a finished layer, so the number of shortest chains is the sum over meeting users of the product of the two counts. The loop stops once `du + dv` reaches `max_depth`, which makes the bound inclusive. Deactivated accounts are removed when the adjacency is built, so they appear neither as intermediates nor as endpoints.

**Complexity.** Building the adjacency is O(E). A query touches roughly the neighbourhoods of radius d/2 around each end — about 2·b^(d/2) users for branching factor b — instead of b^d for a one-sided search. In the timing check (60 000 users, 300 000 rows, 600 queries, typical distance 4–6) the reference takes about a second in CPython; a one-sided search that stops as soon as it reaches `v` takes over 20 seconds.

**Dialect notes.** In Java or C++ use a compressed sparse row adjacency (two int arrays) and reusable distance arrays reset per query by touched list; shortest-chain counts can exceed 64 bits on dense graphs, so use `BigInteger`, Scala `BigInt` or saturating arithmetic if counts matter. In Spark or SQL, each BFS layer is one join of the frontier with the edge table (one shuffle); batching all queries together with a query-id column is the usual approach, and hubs need salting. Not executed here.

**Edge cases built into the tests.** The same user (0, even with no friendships); direct friends in both directions; a chain of exactly `max_depth` (reported) and `max_depth + 1` (−1); separate groups; a user with no friendships; repeated and reversed rows; (Hard) a deactivated user on the short chain forcing the long one, a deactivated endpoint (−1, even for itself), a chain only through a deactivated user, and an empty deactivated set; (Very Hard) k mutual friends (k chains), two layers of two (4 chains), a repeated row that must not double a chain, longer chains that must not be counted, chains through a deactivated user excluded, and a wide star on one side.

**Common mistakes.** One-sided BFS (correct, too slow); stopping at the first meeting user in the middle of a layer (distance may still be right, counts are not); marking visited on dequeue so a user is enqueued twice, or skipping already-seen users in the same layer so counts drop the second way in; treating the graph as directed; counting a repeated row as a second friendship; letting deactivated users stay endpoints; recursion.

**Follow-up guidance.** (1) Measure a frontier's cost by the sum of its degrees, not its size; expanding a hub's side is the expensive move. Analytics teams often exclude or cap very high-degree accounts for this kind of study and say so; landmark distances precomputed from hubs give fast bounds. (2) Iterative frontier joins, about `max_depth / 2` rounds per side, all queries in one batch keyed by query id; salt hub edges to avoid skew; checkpoint between rounds. (3) Sample sources and run full BFS from each, or approximate the neighbourhood function with HyperLogLog counters (HyperANF-style); public research on a large social graph's average distance used that approach. (4) Version the snapshot by date and keep it immutable for the analysis; record the snapshot id, query set and code version with every result.

**Rubric anchors.** 2: correct one-sided BFS that fails the timing check, or a bidirectional search with an off-by-one bound. 3: correct bidirectional search, inclusive bound, deactivated accounts, passes all tests at the level attempted. 4: also correct counts with the equidistance argument, degree-aware side choice and a credible distributed plan.

**Strong signals.** Asks whether max_depth is inclusive and whether rows repeat; explains why whole layers are needed for counting. **Red flags.** Returning the list of people on a chain when only a distance was asked; "precompute all pairs".

## MET-L2-03

**Reference solution** (the fixed function)

```python reference
def dwell_by_impression(events, min_visible_ms, cap_ms):
    open_at = {}          # imp -> start of its open interval
    total = {}            # imp -> capped visible time so far
    longest = {}          # imp -> longest single interval

    def close(imp, ts):
        length = ts - open_at.pop(imp)
        total[imp] = total.get(imp, 0) + min(length, cap_ms)        # cap each interval
        longest[imp] = max(longest.get(imp, 0), length)

    # time order; at the same moment, stop and background before start
    ordered = sorted(events, key=lambda ev: (ev["ts"], ev["kind"] == "start"))
    for ev in ordered:
        imp, kind, ts = ev["imp"], ev["kind"], ev["ts"]
        if kind == "start":
            if imp not in open_at:                                  # a repeated start changes nothing
                open_at[imp] = ts
        elif kind == "stop":
            if imp in open_at:
                close(imp, ts)
        elif kind == "background":
            for on_screen in list(open_at):                         # every visible post
                close(on_screen, ts)

    end = max((ev["ts"] for ev in events), default=0)
    for imp in list(open_at):                                       # still visible at the end
        close(imp, end)

    return {imp: t for imp, t in total.items() if longest[imp] >= min_visible_ms}
```

**The planted bugs, their symptoms and their fixes.** Each one has a test that only it fails.
1. **Arrival order instead of time order.** The loop walks `events` as uploaded. When a later batch arrives first, a `stop` is seen before its `start` and ignored, and the interval stays open until the end of the session. Symptom: implausibly long dwell, worse after the batching change. Fix: sort by `(ts, kind == "start")` so that at the same moment stops and backgrounds come first. Tests: *a later upload batch that arrives first is put back in time order*, and *a stop and a start at the same moment* (which also catches a fix that sorts by `ts` alone).
2. **Backgrounding closes only one post.** `max(open_at, key=open_at.get)` assumes a single post is on screen; the others stay open until the end of the session. Symptom: long dwell for posts that were half visible when the app was closed. Fix: close every open interval. Test: *backgrounding the app ends every visible post*.
3. **A repeated start resets the interval.** `open_at[imp] = ts` overwrites the original start. Symptom: dwell cut short for posts whose layout changed while visible. Fix: ignore a start when the impression is already open. Test: *a repeated start does not restart the interval*.
4. **Cap on the total.** `min(t, cap_ms)` caps the impression's sum, so a post read twice for a long time is cut to one cap. Symptom: long reads cut short. Fix: cap each interval when it closes. Test: *the cap applies to each interval, not to the total*.
5. **Viewability on the total.** `t >= min_visible_ms` lets several glances add up to a view. Symptom: posts glanced at for a moment count as viewed. Fix: track the longest single interval and compare it. Test: *viewable needs one interval of min_visible_ms, not a total*.

**Explanation.** Dwell is interval reconstruction from unordered client events: restore time order with an explicit tie rule, keep at most one open interval per impression, close all of them on background and at the end, then apply per-interval rules (cap, viewability) before aggregating. The fix is small; a rewrite is not needed.

**Complexity.** O(n log n) for the sort plus O(n) for the pass; O(impressions) memory. The timing check is 200 000 events.

**Dialect notes.** In SQL the same logic is a window over events ordered by `ts` and a tie column, pairing each start with the next stop or background (`LEAD` or a running count of open intervals), then per-interval `LEAST(length, cap)` and `MAX(length)` per impression. Spark, BigQuery and Snowflake all support it; the tie rule must be an explicit `ORDER BY` column in every engine, because row order within equal timestamps is not guaranteed. Not executed here.

**Edge cases built into the tests.** A later batch first; two posts visible at backgrounding; a repeated start; two long intervals under the cap; two short glances; a stop and a start at the same `ts`; a post still open at the end; a stop with no start; exactly `min_visible_ms`; (Very Hard) a single interval longer than the cap while another post is visible.

**Common mistakes.** Sorting by `ts` only (the tie test fails); fixing backgrounding by clearing `open_at` without adding the intervals; capping only at output time; comparing the capped length with `min_visible_ms` (equivalent here because cap ≥ min, but worth asking); rewriting the function instead of fixing it.

**Follow-up guidance.** (1) One test per bug, plus a property test: permuting the input never changes the output. (2) Emit an impression's dwell when its interval is closed and the session's upload watermark has passed the close time; sessions end by an inactivity timeout; very late batches go to a correction. (3) Detect non-monotonic or implausible jumps between consecutive events in a session; drop or flag affected intervals rather than computing negative or huge lengths; server receive times give a sanity bound. (4) Bugs 1, 2 and 4 bias dwell labels (1 and 2 upwards for posts near batch boundaries or at app exit, 4 downwards for long reads such as long text posts); bug 5 adds false positive views for fast-scrolled posts; bug 3 biases dwell down for posts whose layout changes, such as videos.

**Rubric anchors.** 2: finds two or three bugs; tests still fail. 3: all five fixed and explained, including the tie rule. 4: also order-independence tests, a streaming emission rule and a reasoned account of how each bug biased ranking labels.

**Strong signals.** Builds a tiny event list per bug before changing code; asks about the tie rule. **Red flags.** Dropping events with out-of-order timestamps; "just cap the total" without reading the specification.

## MET-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** Delivery events (impression, click) and billing events (charge, reversal) carry `event_id, account, campaign, ad set, ad, UTC event time, breakdown attributes, amount in the account's currency (minor units)`. Attribution publishes conversion events tied to the impression or click; the invalid-activity system publishes removal events with the original event ids. All land in an append-only lake table partitioned by UTC hour of event time (and arrival date for late data).
- **Grain.** Rollups are stored in UTC at 15-minute buckets. Every UTC offset in current use (including +05:30, +05:45 and +12:45) is a multiple of 15 minutes, so any account's local day or hour is a union of whole buckets; the account's time-zone rules (from the IANA time zone database) map buckets to local days at rollup or query time. Daylight-saving days naturally have 92 or 100 buckets.
- **Two paths.** A streaming job aggregates today's events per account and 15-minute bucket for the near-real-time view (labelled as an estimate). A batch job recomputes settled aggregates per account and local day from the full event table, applying removals and late attributions, for every day still inside the {{restate_days}} restatement window. Reports serve settled data where it exists and the near-real-time aggregate for the rest.
- **Versioning.** Each settled (account, local day) has a version number and a change reason; exports and API responses carry the version. Advertisers can request "changed since version N".
- **Spend and billing.** Spend in reports is summed from charge and reversal events in minor units, never from rounded rates. The settled daily spend per account and currency is reconciled with billing's daily charges; a mismatch blocks settlement for that account and day and pages the team.
- **After the window.** Removals that arrive after {{restate_days}} are not written into settled days silently; they appear as an adjustment line on the day they were processed (and a billing credit), with a link to the original day, so invoiced totals do not move.
- **Breakdowns.** Precompute the common combinations (level × day × a few breakdowns); serve rarer ones from a columnar store on demand. Rows below the minimum count are suppressed or merged, and totals are computed from unsuppressed data so they stay correct.
- **Large accounts.** Partition rollups by account; for the largest accounts, pre-materialise ad-level hourly tables per day and serve exports as asynchronous jobs that write files and return a link, paging through a consistent snapshot (one version) rather than live queries.
- **Freshness and monitoring.** Streaming lag against {{freshness}}, settlement completeness per account-day, reconciliation status per currency, export latency per account size.

**Competing designs to accept.** Hourly UTC rollups plus a separate path for non-whole-hour zones (works but duplicates logic); storing per-account local-date columns computed at ingest (simple but fragile when rules or views change; acceptable if the candidate handles DST and rule updates); an OLAP store with real-time ingest serving both today and settled data, if versioning and reconciliation are still explicit.

**Bottlenecks and failure modes.** Rolling up by UTC hour or UTC day; converting with fixed offsets that ignore DST; floating-point spend; silently overwriting settled numbers; restatements that never reach exports; a combinatorial explosion of pre-aggregates; the largest accounts dominating a partition; reports that disagree with invoices; small breakdown cells revealing individuals.

**Incident guidance.**
- *25-hour Sunday and an "hour charged twice"*: the 25 hours are correct for that local day (the repeated hour happens twice); check that billing charged each event once by event id and that the hourly report labels the two repeated hours (for example with their UTC offsets) instead of summing them into one row labelled ambiguously. Fix the display, explain to the advertiser, and add a DST-day test for every zone with transitions.
- *Removals after the window, for invoiced spend*: apply them as adjustments on the processing day with a credit, keep settled days and invoices unchanged, notify affected advertisers, and review whether the window or the invalid-activity system's latency should change.
- *Large export timing out*: move the account to asynchronous file exports from pre-materialised tables, paginate by stable keys within one version, and set a limit per synchronous request; capacity-plan by number of ads, not by account count.

**Follow-up guidance.** (1) 23:50 UTC is 05:20 the next day in UTC+05:30 and 15:50 the same day in UTC−08:00 (or 16:50 during daylight-saving time in a zone like America/Los_Angeles): the same 15-minute bucket lands on different local days. (2) A new settled version for that day, a change reason, a billing credit for the reversed charges, and "changed since" for the export. (3) Asynchronous export from pre-materialised tables, one version, stable pagination, breakdown thresholds applied before writing. (4) Compare per day, account and currency; typical causes are rounding per row instead of summing minor units, a time-zone boundary misassigning a bucket, or reversals counted in one system and not the other. (5) Settled history would need recomputation under the new zone, or a cut-over date with two zones in history; the 15-minute UTC grain makes the recomputation possible.

**Rubric anchors.** 2: rollups by UTC hour or day; spend in floats; restatements by overwrite. 3: 15-minute (or equivalent) UTC grain with per-account local days, DST handled, near-real-time and settled paths, versioned restatements. 4: also billing reconciliation in minor units, a policy after the window, breakdown thresholds, a credible design for the largest accounts and exports.

**Strong signals.** Asks about non-whole-hour offsets and DST before choosing a grain; separates estimate from settled. **Red flags.** "Store everything in UTC and convert in the UI" with hourly buckets; overwriting settled numbers with no trace.

## MET-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Input.** Read the daily friendship snapshot, drop deleted and deactivated accounts, and write a symmetric edge table (both directions) partitioned by source id hash, once per night. Record the snapshot date and row counts; check degree statistics against yesterday before going further.
- **Algorithm.** Capacity-constrained label propagation (a balanced label propagation variant): each label (cluster) has a capacity around {{cluster_size}}; in each iteration, every person computes the label most common among their friends; proposed moves are aggregated per (from, to) label pair, and only as many moves are accepted as keep both clusters within size bounds, prioritised by gain (friendships gained inside the cluster). Each iteration is a join of labels onto edges, an aggregation by (person, label) and an aggregation of moves by label pair.
- **Warm start and churn.** Initialise from last night's labels; new people start with the most common label among their friends (or a fresh small cluster); run a fixed maximum number of iterations or until the share of moving people drops below a threshold; cap total moves at {{max_churn}} of people, accepting the highest-gain moves first.
- **Skew.** People with very high degree are handled separately: salt their edges across tasks, sample their edges for voting, or exclude them from voting and assign them afterwards, so one account does not create a straggler task.
- **Reliability.** Checkpoint labels to durable storage after every iteration (this also truncates Spark lineage); all randomness comes from a recorded seed and the iteration number, so a resumed run produces exactly the same result; the job is restartable from the last completed iteration.
- **Outputs.** A versioned `user → cluster` table per night, plus quality metrics: share of friendships inside clusters, cluster size distribution, churn versus yesterday, iterations used. A gate blocks publication if metrics regress beyond thresholds.
- **Experiments.** An experiment snapshots the assignment version at start and keeps it; people who join later are assigned by a rule that is fixed at experiment start (for example their friends' majority cluster under the frozen version) or excluded from analysis, as the experiment's design states.
- **Deletion.** Deleted accounts are removed from the latest version on the next run and from frozen versions by a deletion job within the deletion period; analysis uses the frozen version minus deleted ids.

**Competing designs to accept.** Recursive bisection or a multilevel partitioner (METIS-style) run offline on a coarsened graph; geographic or community-detection seeds refined by label propagation; GraphX or GraphFrames Pregel-style implementations, provided capacity and skew are addressed; a weekly rebuild with daily incremental assignment of new people, if churn and freshness trade-offs are argued.

**Bottlenecks and failure modes.** The shuffle per iteration ({{users}} × {{avg_friends}} edge rows joined with labels); stragglers from very high-degree accounts; unconstrained label propagation collapsing into a few huge labels; non-deterministic tie-breaks making runs irreproducible; lineage growth without checkpoints; churn from random restarts; experiments silently picking up a new assignment; doubled edges inflating degrees.

**Incident guidance.**
- *Holiday burst overruns the window*: publish the last completed checkpoint if its quality metrics pass the gate (warm-started labels are usable after any iteration) and record that the run stopped early; longer term, cap iterations, make convergence tests cheaper, or rebuild weekly with daily incremental updates.
- *Edges written in both directions*: the pre-flight degree check (average degree doubled overnight) should stop the run before clustering; if it ran, do not publish; deduplicate pairs by (min id, max id) at input so the job no longer depends on the export's convention.
- *Unbalanced test groups*: check the cluster size distribution in the frozen version (a few oversized clusters, or one cluster holding most high-activity accounts) and the randomisation unit; with few large clusters, group sizes vary a lot by chance. Fix with tighter capacity bounds, stratified randomisation of clusters by size, and analysis that accounts for cluster-level randomisation.

**Follow-up guidance.** (1) Salt or sample its edges; exclude it from voting and assign it last; its cluster should not be pulled toward it. (2) Resume from the iteration-8 checkpoint with the same seed; determinism comes from seeded tie-breaks and ordered aggregation, verified by comparing a resumed and an uninterrupted run on a sample graph. (3) Share of friendships inside clusters, size distribution and churn per run, compared with the previous algorithm on the same snapshot; an A/A test that shows no false effects with cluster randomisation. (4) Assign new people incrementally and re-optimise only neighbourhoods with many changed edges; churn stays low but quality slowly degrades, so a periodic full rebuild remains. (5) The latest and frozen assignment versions and any analysis datasets; experiments drop deleted ids from analysis.

**Rubric anchors.** 2: connected components or unconstrained label propagation; no stability plan. 3: capacity-constrained iterative clustering in Spark with checkpoints, warm starts and frozen versions for experiments. 4: also skew handling, deterministic resumable runs, a churn cap enforced by gain, published quality gates, and a credible incident response.

**Strong signals.** Asks why clusters are needed and what quality measure matters before choosing an algorithm. **Red flags.** Randomising individuals and calling it cluster randomisation; letting running experiments read the latest assignment.
