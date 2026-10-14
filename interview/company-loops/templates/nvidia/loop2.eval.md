# NVIDIA · Loop 2 — evaluator notes (hidden from candidates)

## NVD-L2-01

**Reference solution**

```python reference
from bisect import bisect_left, insort


def simulate_allocator(events, segment_bytes, min_split):
    free_list = []            # (size, addr) of every cached free block, sorted
    free_at = {}              # addr -> (size, seg_base, seg_end)
    free_end = {}             # end address -> start address, free blocks only
    live = {}                 # alloc id -> (addr, size, seg_base, seg_end)
    segments = {}             # seg_base -> seg_size
    next_base = 0
    reserved = peak = allocated = 0
    addresses = []

    def add_free(addr, size, base, end):
        free_at[addr] = (size, base, end)
        free_end[addr + size] = addr
        insort(free_list, (size, addr))

    def take_free(addr):
        size, base, end = free_at.pop(addr)
        del free_end[addr + size]
        del free_list[bisect_left(free_list, (size, addr))]
        return size, base, end

    for ev in events:
        if ev[0] == "alloc":
            _, aid, nbytes = ev
            need = -(-nbytes // 512) * 512
            i = bisect_left(free_list, (need, -1))       # smallest size >= need, lowest address
            if i < len(free_list):
                addr = free_list[i][1]
                size, base, end = take_free(addr)
            else:
                size = -(-need // segment_bytes) * segment_bytes
                addr = base = next_base
                end = base + size
                segments[base] = size
                next_base = end
                reserved += size
                peak = max(peak, reserved)
            if size - need >= min_split:
                add_free(addr + need, size - need, base, end)
                size = need
            live[aid] = (addr, size, base, end)
            addresses.append(addr)
            allocated += size
        elif ev[0] == "free":
            blk = live.pop(ev[1], None)
            if blk is None:
                continue                                 # double or unknown free
            addr, size, base, end = blk
            allocated -= size
            if addr + size < end and addr + size in free_at:
                size += take_free(addr + size)[0]
            if addr > base and addr in free_end:
                prev = free_end[addr]
                size += take_free(prev)[0]
                addr = prev
            add_free(addr, size, base, end)
        else:                                            # ("empty_cache",)
            for base, seg in list(segments.items()):
                f = free_at.get(base)
                if f is not None and f[0] == seg:
                    take_free(base)
                    del segments[base]
                    reserved -= seg
    return {"addresses": addresses, "peak_reserved": peak, "reserved": reserved, "allocated": allocated,
            "free_blocks": len(free_list), "largest_free": free_list[-1][0] if free_list else 0}
```

**Explanation.** The allocator's state is a set of segments, each cut into blocks that are either held by a live id or cached as free. Best fit needs "the smallest free block of at least `need` bytes, lowest address on ties", which is exactly the first element at or after `(need, -1)` in a list sorted by `(size, address)`. Merging on free needs the free block that ends where this one starts and the free block that starts where it ends: two dicts keyed by start and end address give both in O(1). Each block carries its segment's bounds, so a merge never crosses into a neighbouring segment even though segments are laid out back to back. New segments always start at the high-water address, so `empty_cache` can drop a segment without any address being reused. `allocated` counts block sizes, so slack kept by the split rule is visible as allocated memory, which is how fragmentation inside blocks shows up in practice.

**Complexity.** O(E log F) comparisons for E events and F cached blocks, plus the element moves of `insort` and `del` on a Python list (O(F) memory moves each, very fast in practice at a few thousand blocks). A balanced tree or a sorted container makes it O(log F) strictly. `empty_cache` is O(segments). The timing test is 150 000 events with several thousand cached blocks; scanning every cached block per request takes minutes.

**Dialect notes.** In C++ the natural structure is `std::set<std::pair<size_t, uintptr_t>>` with `lower_bound`, plus hash maps by start and end address; real allocators also keep separate pools for small and large blocks. In Java, `TreeSet` with a comparator on (size, address) and `ceiling`. The model is not a SQL problem; a replay at scale would be run offline in a general-purpose language. Not executed here.

**Edge cases built into the tests.** Best fit choosing a later, smaller block over an earlier, larger one; equal sizes freed in reverse address order (lowest address wins); rounding of 1, 512 and 513 bytes; a middle block merging with both neighbours; two adjacent but separate segments that must not merge; double and unknown frees; an empty trace; (Hard) a remainder of exactly `min_split` (split) and 512 bytes less (not split, and counted as allocated); a request larger than one segment; (Very Hard) `empty_cache` releasing only fully free segments, the high-water mark for new addresses, the peak kept, and a cached block in a partly used segment still reused after `empty_cache`.

**Common mistakes.** First fit or "most recently freed" instead of best fit; ignoring the address tie-break; merging across segment boundaries because addresses are contiguous; forgetting to split the fresh segment itself; `>` instead of `>=` against `min_split`; counting requested bytes instead of block sizes in `allocated`; reusing a released segment's addresses; releasing segments that still hold live blocks; letting a double free insert a block twice; scanning all free blocks per request.

**Follow-up guidance.** (1) Compare the peak of `reserved` with the peak of `allocated` and look at `largest_free` at the failing request: a large total free but a small largest block is fragmentation. Policy changes: round large requests coarsely so blocks are interchangeable, keep small and large pools apart, or call `empty_cache` and retry before failing. (2) Small pools stop tiny tensors from fragmenting large segments; coarse rounding for large requests improves reuse at the price of internal slack. (3) A block freed by one stream may still be in use by kernels queued on that stream; reuse by another stream must wait for an event recorded on the first. In the replay, give each free a "ready after" marker and allow reuse by another stream only after it. (4) Record, per failing request, the requested size, `reserved`, `allocated`, the largest free block and the live blocks per segment, so a report can name the long-lived blocks pinning each segment.

**Rubric anchors.** 2: a scan-based allocator that passes small tests, or one that merges across segments or ignores the tie-breaks. 3: all tests pass with a sorted structure, dict-based neighbour lookups and exact counters. 4: also explains the cost of list insertion versus a tree, why segments never merge, and gives a concrete diagnosis plan for "out of memory with memory free".

**Strong signals.** Draws a segment with blocks before coding; asks whether merging crosses segments; distinguishes allocated, reserved and fragmentation precisely. **Red flags.** A single global free list without segment bounds; recomputing `largest_free` by scanning on every event; treating `allocated` as the sum of requested sizes.

## NVD-L2-02

**Reference solution**

```python reference
def find_change_point(step_ns, min_len, max_ratio_pct):
    n = len(step_ns)
    if n < 2 * min_len:
        return None
    total = sum(step_ns)
    sq = sum(v * v for v in step_ns)
    # SSE of a segment with m values and sum s is sq_seg - s*s/m, so the split cost is
    # sq - g(k) with g(k) = L*L/k + R*R/(n-k). Minimising the cost maximises
    # g(k) = (L*L*(n-k) + R*R*k) / (k*(n-k)); compare those fractions by cross-multiplying.
    left = sum(step_ns[:min_len - 1])
    best = None
    for k in range(min_len, n - min_len + 1):
        left += step_ns[k - 1]
        right = total - left
        num = left * left * (n - k) + right * right * k
        den = k * (n - k)
        if best is None or num * best[2] > best[1] * den:     # strict: the smallest k keeps a tie
            best = (k, num, den, left)
    k, num, den, left = best
    base_n = n * sq - total * total               # SSE of the whole series, times n
    if base_n == 0:
        return None                               # a constant series has no change point
    cost_den = sq * den - num                     # SSE after the split, times den
    if cost_den * 100 * n > max_ratio_pct * base_n * den:
        return None
    return (k, left / k, (total - left) / (n - k))
```

**Explanation.** For a part with `m` values, sum `s` and sum of squares `q`, the SSE is `q − s²/m`. The total sum of squares is the same for every split, so the best split maximises `g(k) = L²/k + R²/(n−k) = (L²(n−k) + R²k) / (k(n−k))`, with `L` the running sum of the first part and `R = total − L`. Comparing `num/den` values by cross-multiplication keeps everything in integers; Python's integers are unbounded, so values near 10¹⁰ (squares near 10²⁰, products near 10³⁶) stay exact. A strict `>` keeps the smallest `k` on ties. The threshold test multiplies both sides of `cost ≤ pct/100 × base` by `100 × n × den`, where `base × n = n·Σx² − (Σx)²` and `cost × den = Σx²·den − num`.

**Complexity.** O(n) time and O(1) extra space after the input. The timing test is 200 000 steps; recomputing the two parts for every split is O(n²), about 2 × 10¹⁰ element operations.

**Dialect notes.** In SQL, the same computation is a window query: running `SUM(x)` and `SUM(x*x)` ordered by step, then `ORDER BY` the explained term `DESC, k` with `LIMIT 1`. In PostgreSQL use `numeric` to keep products exact; `bigint` overflows at these magnitudes and `double precision` loses ties. In Java or C++, 64-bit integers overflow on `L² × (n−k)`; use `BigInteger`, 128-bit integers, or compare in long double with an explicit tie tolerance stated as a limitation. Not executed here.

**Edge cases built into the tests.** An exact tie between two splits (smaller `k`); a constant series (`None`); `n < 2 × min_len` (`None`); `n = 2 × min_len` (only `k = min_len`); a clean step; a split that explains too little (`None`); (Hard) a split costing exactly `max_ratio_pct` percent (reported) and the same series at one percent less (`None`); a slow first step that `min_len` keeps out; (Very Hard) mirrored series of nanosecond values between 2 × 10⁹ and 8 × 10⁹ with a shift under a microsecond, where the two tied splits cannot be separated in floating point.

**Common mistakes.** Floating-point `q − s²/m`, which suffers catastrophic cancellation at these magnitudes and breaks ties and boundaries at random; recomputing sums per split; reporting the larger `k` on ties; treating a constant series as a valid split with cost 0; an exclusive threshold; allowing splits closer than `min_len` to the ends; integer division for the means.

**Follow-up guidance.** (1) A slow drift is not a step; a linear-trend cost or a piecewise-linear fit fits better, and the report should say "drifting since step k" with a slope. (2) Binary segmentation (split, then split each part) or optimal partitioning with a penalty per change (PELT-style pruning keeps it near linear); the penalty is what stops it from splitting the noise. (3) Squared error is dominated by the rare long steps; use absolute deviation from the median, drop or cap known checkpoint steps by their step type, or model them separately. (4) Running totals alone are not enough, because each new step changes the cost of every split. Keep the prefix sums per job and re-scan only a recent window, or use an online detector (CUSUM-style) that needs O(1) state per job and reports when a shift becomes significant.

**Rubric anchors.** 2: an O(n²) or floating-point solution that passes small tests but fails timing or the exact ties. 3: all tests pass with running sums and integer cross-multiplication. 4: also explains why floats fail at these magnitudes, derives the maximised term cleanly, and handles robustness and multiple changes convincingly.

**Strong signals.** Notices that the total sum of squares cancels from the comparison; asks about magnitudes before choosing number types. **Red flags.** "Floats are precise enough" without estimating the magnitudes; comparing costs with an arbitrary epsilon.

## NVD-L2-03

**Reference solution** (the fixed rollup)

```python reference
from datetime import datetime, timezone


_DAY_NAMES = {}


def _day(ts):
    d = ts // 86400
    if d not in _DAY_NAMES:
        _DAY_NAMES[d] = datetime.fromtimestamp(d * 86400, timezone.utc).strftime("%Y-%m-%d")
    return _DAY_NAMES[d]


def utilisation_rollup(allocations, samples, inventory, slots_per_gpu, interval):
    charged = {}            # (day, team) -> GPU-seconds charged
    held = {}               # (node, gpu) -> [(start, stop, team, share)]
    for a in allocations:
        model = inventory[a["node"]][a["gpu"]]                  # this GPU's own model
        share = a["slots"] / slots_per_gpu[model]                # a fraction, not //
        stop = a.get("preempted_at")
        if stop is None:
            stop = a["end"]                                      # preempted: held until preemption
        held.setdefault((a["node"], a["gpu"]), []).append((a["start"], stop, a["team"], share))
        t = a["start"]
        while t < stop:                                          # split at each UTC midnight
            seg_end = min(stop, (t // 86400 + 1) * 86400)
            key = (_day(t), a["team"])
            charged[key] = charged.get(key, 0) + (seg_end - t) * share
            t = seg_end
    busy = {}               # (day, team) -> utilisation x GPU-seconds
    seen = {}               # (day, team) -> GPU-seconds actually sampled
    for node, gpu, ts, util in samples:
        for start, stop, team, share in held.get((node, gpu), ()):
            if start <= ts < stop:
                key = (_day(ts), team)
                busy[key] = busy.get(key, 0) + util * share * interval
                seen[key] = seen.get(key, 0) + share * interval
    out = {}
    for key, secs in charged.items():
        if secs > 0:
            avg = round(busy[key] / seen[key], 3) if seen.get(key) else None   # missing samples are unknown
            out[key] = (round(secs / 3600, 3), avg)
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **The model of every GPU is the node's first GPU's model.** `inventory[a["node"]][0]` assumes homogeneous nodes. Symptom: teams on mixed nodes are charged the wrong share (or nothing). Fix: `inventory[a["node"]][a["gpu"]]`.
2. **Integer division for the share.** `slots // slots_per_gpu[model]` is 0 for every slice. Symptom: teams that run on slices show no usage at all. Fix: `/`.
3. **Preempted allocations are held until their scheduled end.** The code ignores `preempted_at`, both for charging and for attributing samples. Symptom: a team charged four hours for a job preempted after one, and the samples of the GPU's next workload credited to it. Fix: `stop = preempted_at if present else end`.
4. **All GPU-hours are charged to the start day.** Symptom: overnight runs show nothing on their second day and too much on the first. Fix: split the held interval at each midnight UTC.
5. **Average utilisation divides by allocated time.** Missing samples then count as 0 %, and an allocation with no samples shows 0.0 instead of `None`. Symptom: a node whose telemetry agent restarted looks nearly idle. Fix: accumulate the sampled GPU-seconds (`share × interval` per attributed sample) and divide by those.

Each bug has its own check: a mixed node with a full GPU of the second model, a single slice, a preempted allocation, an allocation across midnight, and an hour with gaps plus one with no samples. Each check passes once its bug is fixed, whatever the other bugs. Bug 1's check uses a full GPU, so integer division gives the right answer there by accident once the model is right; a candidate who fixes bug 1 alone will see it pass and must still find bug 2 through the slice checks. Two more checks (a sample at the exact end second, and two slices sharing a GPU) guard the boundary and the per-share weighting.

**Explanation.** The rollup has two halves that must agree on the held interval: charging (share × held seconds, split by UTC day) and utilisation (samples within the held interval, weighted by share). Every bug breaks one rule in one half or both: the GPU's identity, the share, the end of the interval, the day boundary, and what counts as observed.

**Complexity.** O(A + S × a) for A allocations, S samples and a allocations per GPU (small); the day names are cached. The timing test is about 250 000 samples on 160 GPUs.

**Dialect notes.** In SQL the charging half is an interval split against a calendar table: join allocations to days where `day_start < stop AND day_end > start`, charge `LEAST(stop, day_end) − GREATEST(start, day_start)`; the share must be `slots::numeric / slots_per_gpu` (integer division in PostgreSQL has the same bug). The utilisation half is an interval join of samples to allocations on `(node, gpu)` and `ts >= start AND ts < stop`, aggregated with `SUM(util * share * interval) / NULLIF(SUM(share * interval), 0)`. Snowflake and BigQuery use the same shape; Spark needs a range join hint or bucketing by GPU and hour to avoid a cartesian product. Not executed here.

**Edge cases built into the tests.** A mixed node; a single slice; a preempted allocation with samples after preemption; an allocation from 22:00 to 02:00 UTC; missing samples; an allocation with no samples; a sample at the exact end second followed by the next holder; two slices sharing a GPU.

**Common mistakes.** Fixing the share with `float()` but keeping the node-level model; ending preempted allocations for charging but still attributing samples after preemption; splitting at midnight in local time; treating missing samples as 0 or interpolating them; returning 0.0 for no samples; rewriting the function instead of making minimal fixes; changing the output shape.

**Follow-up guidance.** (1) One test per bug, built from three or four allocations, like the checks above. (2) Late samples change the utilisation of past days; the charge does not (it comes from the scheduler). Restate by recomputing affected days as partitions and keeping versions, with a "restated on" marker. (3) The scheduler's records are the source of truth for GPU-hours; samples are evidence of use, not of holding. Disagreements come from clock skew, events lost on restart, and rounding; reconcile per allocation. (4) In a warehouse, bucket samples by `(node, gpu, hour)` and join to allocations expanded to the hours they cover; in a stream, keep per-GPU holding state and join each sample as it arrives, with corrections when late scheduler events arrive.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also states the shared held-interval rule explicitly, adds a regression test per bug, and answers the late-data and source-of-truth follow-ups concretely.

**Strong signals.** Reproduces each complaint from the scenario with a two-line input before fixing; notices that charging and attribution must use the same `stop`. **Red flags.** "Treat missing samples as idle to be safe"; rounding each allocation before summing.

## NVD-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing.** Node agents publish samples to a partitioned log keyed by `(node, gpu)`, batched per second per node. Scheduler events go to their own topic keyed by `(node, gpu)` too, so a stream processor sees both for one GPU in one partition. Everything is also archived raw to object storage by arrival hour.
- **Holding intervals.** A small stateful job turns allocate, release and preempt events into `gpu_holding (node, gpu, slice, job, team, from_ts, to_ts NULL, version)`. An interval with no release is open. A late release closes it and bumps the version, which triggers corrections downstream.
- **Join.** The stream processor keeps, per GPU, the current holders (one, or several slices) and a short history of recent intervals. Each sample is joined by "interval contains ts" on the GPU, after the node's clock correction. A sample no job held is kept with `job = NULL` and labelled idle; it matters for capacity planning. Whole-GPU metrics on a sliced GPU are attributed to each slice's job with the slice's share, and labelled as such.
- **Clock skew.** Each node's offset is estimated continuously from its sample timestamps versus arrival time and versus scheduler events for the same GPU. Samples are corrected by the current offset estimate, and the raw node timestamp is kept. A node whose offset exceeds a bound is flagged and its joins are marked low confidence until it is fixed.
- **Rollups.** Per minute and per hour, per `(gpu, job)`: count, sum, min, max, a mergeable histogram or quantile sketch for utilisation, power and memory, and first, last and delta for counters (error counters must use deltas that handle resets). Per team and model per day are rolled from the hourly level. Rollups are rebuilt per hour partition from the joined data, so a rebuild gives the same numbers.
- **Retention.** Raw joined seconds for {{raw_retention}} in columnar files partitioned by date and hour and clustered by `(node, gpu)`; minute rollups for months; hourly and daily rollups for years. Raw seconds around incidents are copied to a longer-lived bucket on request.
- **Serving.** The job dashboard reads recent minutes from a time-series store fed by the stream (sub-minute lag) and older ranges from minute rollups; capacity reports read daily rollups in the warehouse.

**Competing designs to accept.** A batch-only join every few minutes over the raw archive (accept if the dashboard target is met and corrections are simpler); enriching samples on the node with the job id from the local scheduler agent (accept, but ask about slices and races at job boundaries); storing everything in a time-series database with job tags (accept at smaller scale; ask about cardinality and retention cost). The key test is whether late scheduler events and skew produce corrected, reproducible results.

**Bottlenecks and failure modes.** Cardinality of job-tagged series in a time-series store; holding state lost on processor restart (rebuild from the scheduler topic); open intervals that never close; averages that hide spikes; counter resets after driver reloads read as huge negative deltas; skewed nodes joined to the wrong job; rollups appended twice on rerun.

**Incident guidance.**
- *Release events eight minutes late after a scheduler restart*: the old interval stays open, so samples were joined to the old job. When the release arrives, the interval closes with a new version; recompute the joins for that GPU from the release time, re-emit the affected minute rollups as corrections, and refresh the dashboard. Alert on the count of open intervals that overlap a new allocation on the same GPU, which is impossible in reality.
- *Clock drift of {{clock_skew}}*: offset estimation flags the node; joins near interval boundaries are re-done with the corrected offset; until the node is fixed, mark its joins low confidence. Prevention: monitor offset per node and drain nodes past a bound.
- *Rerun changes numbers already shown*: rollups are rebuilt per partition, so a rerun is a replacement, not an addition; publish it as a restatement with a version and a note, and keep the previous version for comparison. If the change was unexpected, diff the two versions per job to find the cause before republishing.

**Follow-up guidance.** (1) Re-join from the release time, emit corrected rollups, and keep a correction log. (2) Compare sample timestamps with arrival times and with scheduler events on the same GPU; correct or flag. (3) Exact only from raw seconds or exact histograms with fixed buckets; approximately from sketches; never from averages. (4) Keep raw seconds for recent days and for incident windows; keep minute rollups with min, max and sketches for longer; justify by who needs which resolution. (5) A slice layout change ends the holding intervals and starts new ones; the dashboard shows the job's slices over time.

**Rubric anchors.** 2: tags samples with a job by an equi-join or ignores the scheduler; averages only; one retention tier. 3: holding intervals with an interval join, mergeable rollups, retention tiers, explicit lateness handling. 4: also corrections for late scheduler events, clock-skew estimation and flagging, reproducible partition rebuilds, slices handled explicitly, and serving paths sized for both audiences.

**Strong signals.** Keeps idle samples; insists on counter deltas with reset handling; separates "held" from "used". **Red flags.** Joining on exact timestamps; dropping late scheduler events; hourly averages as the only long-term record.

## NVD-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Entities.** `run (run_id, project, owner, created_at, deleted_at NULL, parent_run_id NULL, fork_checkpoint_id NULL, config_id)`; `attempt (run_id, attempt_no, resumed_from_checkpoint_id NULL, start_step, last_step, status, started_at, ended_at, software_versions)`; `checkpoint (checkpoint_id, run_id, attempt_no, step, uri, hash, status valid|corrupt, created_at)`; `config (config_id, canonical_json, hash)` plus a flattened `config_kv (config_id, path, value)` for search and diff.
- **Metrics.** `metric_point (run_id, attempt_no, step, metric, value, logged_at)` in columnar storage, partitioned by project and date and clustered by `(run_id, metric, step)`. The ingestion key `(run_id, attempt_no, step, metric)` makes logger retries harmless (keep one value, or last by `logged_at`).
- **Effective segments.** For each run, derive `effective_segment (run_id, from_step, to_step, source_run_id, source_attempt_no)`: attempts are ordered; a later attempt resumed from checkpoint at step `c` supersedes everything after `c` from earlier attempts; a fork contributes its parent's effective segments up to the fork checkpoint's step. The table is recomputed for a run when an attempt starts or a checkpoint changes status, and is small (a few rows per run).
- **Curve assembly.** A run's effective curve is a join of `effective_segment` to `metric_point` on `(source_run_id, source_attempt_no)` and the step range. Superseded points stay in `metric_point` and are shown in a debug view labelled by attempt.
- **Fast comparison.** Precomputed downsampled curves per `(run, metric)` at a few resolutions, keeping min, max, first and last per bucket so spikes survive; two forks are compared from their fork step onward, with the shared prefix drawn once.
- **Deletion and access.** Deletion is a soft state on the run: its metrics and checkpoints metadata stay while any fork depends on them; the dashboard hides the run but forks still show their inherited segments, labelled "from a deleted run". Access to a fork's inherited segments follows the parent's visibility; cross-team forks require the parent's sharing setting.

**Competing designs to accept.** Rewriting the effective series into a separate table on each restart (accept if superseded data is kept and rewrites are idempotent); a graph database for lineage (accept, but ask how metric queries join to it); storing metrics in an experiment-tracking product with the lineage kept alongside (accept if the effective-step rule is explicit). Wide tables with one column per metric are acceptable only with an answer for sparse and new metrics.

**Bottlenecks and failure modes.** Effective curves computed by scanning all attempts on every query; overwriting crashed attempts' data; forks pointing at checkpoints whose run was hard-deleted; logger retries creating duplicates; configuration stored as opaque blobs with no diff; very long lineage chains walked at query time.

**Incident guidance.**
- *Restart from an older checkpoint ({{checkpoint_every}} older) because the latest is corrupt*: the effective segments must be recomputed from the checkpoint actually used, superseding everything after its step, including steps between the two checkpoints. Mark the corrupt checkpoint, show both attempts in the debug view, and make segment recomputation part of attempt start.
- *Logger retry duplicating 500 steps*: idempotent ingestion on `(run, attempt, step, metric)` absorbs it; if duplicates got in, deduplicate on that key and rebuild the downsampled curves. The sawtooth comes from plotting duplicates with differing `logged_at`, so the plot must read the deduplicated view.
- *Parent deleted and forks lose their first 30 000 steps*: deletion must not remove data that forks depend on. Restore from the soft-deleted state (or backups), switch deletion to a soft state with a dependency check, and test it with a fork fixture.

**Follow-up guidance.** (1) Soft-delete; keep data while forks depend on it; label inherited segments. (2) Query `run` by `fork_checkpoint_id` (and recursively), notify owners, and mark their curves from that point. (3) Downsampled curves with min, max and last per bucket; compare only from the fork step. (4) `software_versions` per attempt, and a marker on the curve at each restart with the differences. (5) Visibility inherits from the parent; cross-team forks need an explicit share; enforce in the query service.

**Rubric anchors.** 2: one metrics table keyed by run and step with overwrite on restart; forks as copies. 3: attempts and checkpoints as entities, effective view computed from attempt ranges and fork edges, idempotent ingestion, superseded data kept. 4: also precomputed effective segments, downsampling that keeps extremes, configuration diff and search, soft deletion with dependency checks, and concrete incident handling.

**Strong signals.** Separates "what was logged" from "what is effective"; asks what happens when a run resumes from a non-latest checkpoint. **Red flags.** Overwriting crashed attempts' metrics; copying the parent's metrics into each fork; deleting runs with forks.
