# NVIDIA · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of GPUs,
data-centre systems and networking, and the software that runs on them. The
setting is always a GPU cluster operator or a team running training jobs on
GPUs. Hardware and telemetry are described generally, never as the
specification of a particular product; every workload, threshold, number and
schema is hypothetical, and nothing here describes how any company's clusters,
schedulers or systems are actually built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## NVD-L2-01: A caching allocator for GPU memory: best fit, split and coalesce

| | |
|---|---|
| **Template ID** | NVD-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Sorted containers and binary search / memory allocation, best fit, splitting, coalescing, fragmentation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer, data-engineer |
| **Generator** | NVD-L2-01.mjs |

**Business Scenario.** Asking the GPU driver for memory is slow, so deep-learning frameworks commonly put a caching allocator in front of it. The allocator reserves large segments from the device, hands out blocks carved from them, and keeps freed blocks in a cache to reuse, never giving memory back unless asked. A training team sees jobs fail with out-of-memory errors while the dashboard shows gigabytes "free". They have recorded the allocation trace of one training step and want to replay it through a model of the allocator, to see how much memory is reserved at the peak and how fragmented the cache is. {{trace_rule}}

**Problem Statement.** Implement `simulate_allocator(events, segment_bytes, min_split)`. `events` is a list, in order, of `("alloc", id, nbytes)`, `("free", id)` and `("empty_cache",)`. Addresses are integers.
1. **Rounding.** A request for `nbytes` (at least 1) needs `need` bytes: `nbytes` rounded up to a multiple of 512.
2. **Best fit.** Among cached free blocks of at least `need` bytes, take the smallest; if two are the same size, the one at the lower address.
3. **New segment.** If no cached block fits, reserve a new segment of `need` rounded up to a multiple of `segment_bytes`. The first segment starts at address 0, and each new segment starts where the previous new segment ended, so addresses are never reused, even after a segment is released. The new segment is one free block, and the request is served from it.
4. **Split.** The allocation takes the start of the chosen block. If the block's size minus `need` is at least `min_split`, the rest becomes a cached free block right after it. Otherwise the allocation keeps the whole block.
5. **Free.** Freeing a live id returns its block to the cache and merges it with the free block that ends where it starts and the free block that starts where it ends, but only within the same segment. A free for an id that is not live changes nothing.
6. **`empty_cache`.** Every segment that is now a single free block is released.

Return a dict: `"addresses"`, the address each `alloc` received, in event order; `"peak_reserved"`, the most bytes reserved at any moment; and, after the last event, `"reserved"` (bytes in segments not released), `"allocated"` (total size of the blocks held by live ids, including any slack kept by rule 4), `"free_blocks"` (number of cached free blocks) and `"largest_free"` (size of the largest one, or 0).

**Constraints.** Up to 150 000 events, with thousands of free blocks cached at once. `segment_bytes` and `min_split` are positive multiples of 512. Ids of live allocations are unique. Expected: O(log F) to find a block among F cached blocks, plus the cost of keeping them in order. Scanning every cached block for each request is too slow.

**Assumptions.** The rounding size, segment sizes and split rule are this exercise's rules, a simplified model of how caching allocators commonly behave; check a real framework's documentation for its own. There is one device, one stream and no limit on device memory.

**Clarifications.**
- Q: Two free blocks have the same size. Which one do I use? | A: The one at the lower address, regardless of which was freed more recently.
- Q: Two segments sit next to each other in the address space and are both completely free. Do they merge? | A: No. Blocks only merge within one segment.
- Q: After `empty_cache` releases a segment, does the next segment reuse its addresses? | A: No. New segments always start at the highest address reserved so far.
- Q: Does `allocated` count the bytes asked for or the block size? | A: The block size, which includes the rounding and any remainder kept by the split rule.
- Q: Is a free block left over when a request uses a whole new segment? | A: Only if the remainder is at least `min_split`.

**Hints.**
1. Keep the free blocks in a list sorted by `(size, address)`. `bisect_left(blocks, (need, -1))` lands on the best fit.
2. To merge, you need the free block that starts at an address and the free block that ends at an address. Two dicts answer both in O(1).
3. Store each block's segment bounds with it, so that a merge can check it stays inside the segment.

**Follow-ups.**
1. The peak reserved bytes are 30% above the peak allocated bytes. Using your replay, how would you tell whether that is fragmentation or a short burst, and what would you change in the allocator's policy?
2. Real allocators keep separate pools for small and large blocks and round large requests more coarsely. What problem does each of those solve, and what does it cost?
3. Two CUDA streams use the same allocator. Why can a block freed by one stream not be reused immediately by the other, and how would you model that in the replay?
4. The team wants the replay to explain each out-of-memory error. What would you record per event so that a report can say which blocks were in the way?

**Follow-up rules.**
- when: first fit, first block, next fit → ask: Show a trace where first fit and best fit give different addresses. Which one leaves the larger free block behind, and does that always help?
- when: insort, bisect, sorted list → ask: `insort` on a Python list moves elements. What is the real cost per insertion with 5 000 cached blocks, and when would you reach for a balanced tree or a heap of per-size buckets?
- when: heapq, heap → ask: A heap gives you the smallest block, but best fit needs the smallest block at least `need` bytes. How do you get that from a heap, and what does a free in the middle cost?
- when: coalesce, merge, adjacent → ask: Two adjacent segments are both empty. What stops your code merging them, and why does that rule exist in a real allocator?
- when: empty_cache, release, give back → ask: Releasing memory to the driver lowers `reserved`. Why would a framework avoid doing that in every step, and what does it cost the next step?

**Evaluation Criteria.** Correct rounding, best fit with the lower address on ties, splitting only when the remainder reaches `min_split`, merging on both sides without crossing segments, segment addresses never reused, empty_cache releasing only fully free segments, ignored double frees, and every counter exact; a sorted structure with binary search and O(1) neighbour lookups; a clear complexity argument; sensible answers about fragmentation, pools and streams.

## NVD-L2-02: Where did the step time change? One exact split of a training run

| | |
|---|---|
| **Template ID** | NVD-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Prefix sums and exact arithmetic / change-point detection, least squares, integer comparison |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer |
| **Generator** | NVD-L2-02.mjs |

**Business Scenario.** A team running training jobs on GPUs records the wall-clock time of every training step. When a job slows down, for example after a node is swapped, a library upgrade or a change in data loading, the first question is when it changed. A simple and well-understood answer is the single split of the step-time series into "before" and "after" that best explains the data with two constant levels, reported only when it explains enough to be worth an alert. The alert runs on every job, and its answer must not depend on floating-point luck. {{data_rule}}

**Problem Statement.** Implement `find_change_point(step_ns, min_len, max_ratio_pct)`. `step_ns` lists one job's step times in step order, as integer nanoseconds. A split `k` puts steps `0 … k−1` before and `k … n−1` after, and is allowed only if both parts have at least `min_len` steps. The cost of a part is its sum of squared differences from its own mean (its SSE); the cost of a split is the cost of the part before plus the cost of the part after.
1. Choose the allowed split with the lowest cost. If two splits cost exactly the same, choose the smaller `k`.
2. Report it only if the original series has a cost above 0 and the split's cost is at most `max_ratio_pct` percent of the original series' cost (`split_cost × 100 ≤ max_ratio_pct × series_cost`, exactly).
3. Return `(k, mean_before, mean_after)` with the two means as floats. Return `None` if no split is allowed (`n < 2 × min_len`), if the series is constant, or if the best split fails rule 2.

**Constraints.** Up to 200 000 steps; values up to 10 000 000 000. `min_len ≥ 1`; `0 ≤ max_ratio_pct ≤ 100`. Comparisons in rules 1 and 2 must be exact: two splits whose costs are equal as rational numbers are a tie. Expected O(n). Recomputing both parts' costs for every split is O(n²) and too slow.

**Assumptions.** Step times and thresholds are hypothetical. One split is enough here; jobs with several changes are a follow-up. The cost is the classic least-squares criterion for one change in the mean.

**Clarifications.**
- Q: Can I use floats? | A: For the returned means, yes. The choice of `k` and the threshold test must be exact; with values near 10¹⁰, sums of squares reach 10²⁰ and more, beyond what a float holds exactly.
- Q: Two splits have exactly the same cost. Which do I return? | A: The smaller `k`.
- Q: What if the series is constant? | A: `None`: there is nothing to explain.
- Q: Is the boundary in rule 2 inclusive? | A: Yes. A split costing exactly `max_ratio_pct` percent of the original is reported.
- Q: What does `min_len` protect against? | A: Splits that only isolate the first few warm-up steps or a single outlier. Splits closer than `min_len` to either end are not allowed.

**Hints.**
1. The SSE of a part with `m` values, sum `s` and sum of squares `q` is `q − s²/m`. Running sums give `s` and `q` for every prefix in O(1).
2. The total sum of squares is the same for every split, so minimising the cost means maximising `L²/k + R²/(n−k)`, where `L` and `R` are the sums of the two parts.
3. Compare `a/b` with `c/d` as `a·d` with `c·b` (all positive). Python integers do not overflow.

**Follow-ups.**
1. Your alert fires on a job whose step time rises slowly over a day. Is a single change in the mean the right model, and what would you report instead?
2. A job has two changes: a node swap and, later, a data-loader fix. How would you extend this to find several change points, and what stops it from splitting the noise?
3. Checkpoint saves make one step in a thousand take ten times as long. What do they do to the squared-error cost, and what more robust cost would you use?
4. The detector runs every minute on a growing series for 20 000 jobs. How do you avoid recomputing from step 0 each time, and what exactly do you keep per job?

**Follow-up rules.**
- when: float, numpy, np.mean, statistics → ask: With step times near 10¹⁰ ns, how many exact digits does a float keep in a sum of squares? Show how two exactly equal costs could compare unequal.
- when: Fraction, fractions → ask: Fractions are exact. What do they cost per split at 200 000 steps, and how would you get the same exactness with plain integers?
- when: slice, sum(step_ns[:k]), for each split → ask: What is the total work when you recompute the sums for every split, and what can you carry from split k to split k + 1?
- when: z-score, threshold on mean, rolling mean → ask: A rolling-mean rule fires when the slowdown is already old. How would you get the step where it started, and how confident are you in it?

**Evaluation Criteria.** Correct split with the smaller `k` on exact ties; `min_len` respected; `None` for too-short series, constant series and splits that explain too little, with an inclusive boundary; running sums giving O(n); exact integer comparisons by cross-multiplication; means returned correctly; clear reasoning about outliers, several changes and incremental updates.

## NVD-L2-03: Debug the GPU utilisation rollup

| | |
|---|---|
| **Template ID** | NVD-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Debugging / fractional slices, preemption, day boundaries, missing data, per-GPU lookups |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | NVD-L2-03.mjs |

**Business Scenario.** A GPU cluster operator charges each team for the GPU-hours it holds and reports how busy those GPUs were, from utilisation samples taken on every GPU. Some GPUs are partitioned into fixed-size slices, so a job can hold part of a GPU. The daily report has drawn complaints. Teams that run on slices show no usage at all. One team was charged for four hours on a job that was preempted after one. Teams with long overnight runs see nothing on the second day. Teams on newer nodes, where GPUs of two models share a node, are charged wrong amounts. And a node whose telemetry agent restarted shows those teams' GPUs as nearly idle. The rollup below is the suspect. {{replay_rule}}

**Problem Statement.** Fix `utilisation_rollup(allocations, samples, inventory, slots_per_gpu, interval)` so that it meets this specification.
1. **Inputs.** `allocations` is a list of dicts `{"job", "team", "node", "gpu", "slots", "start", "end"}`, with an optional `"preempted_at"`. `gpu` is the GPU's index on its node. `inventory[node]` lists the GPU model at each index; one node can hold several models. `slots_per_gpu[model]` is how many slices a GPU of that model is split into. `samples` is a list of `(node, gpu, ts, util)`: the GPU's utilisation in percent over the `interval` seconds starting at `ts`. Times are Unix seconds, UTC.
2. **Share.** An allocation holds `slots / slots_per_gpu[model]` of a GPU, where `model` is that GPU's own model.
3. **Held time.** An allocation holds its share from `start` until `preempted_at` if it is present, otherwise until `end`.
4. **GPU-hours.** A team is charged share × held seconds / 3600, split at each midnight UTC and charged to the day each part falls on.
5. **Utilisation.** A sample belongs to every allocation holding that GPU at `ts` (`start ≤ ts < stop`), on the UTC day of `ts`. A team's average utilisation for a day is Σ(util × share × interval) / Σ(share × interval) over the samples that belong to its allocations that day. A missing sample is unknown: it counts in neither sum. With no samples, the average is `None`.
6. **Output.** `{(day, team): (gpu_hours, avg_util)}` for every day and team charged more than 0, `day` as `"YYYY-MM-DD"`, both numbers rounded to 3 decimals.

**Constraints.** Keep the function's shape and output format. About 250 000 samples and a few thousand allocations, in a few seconds. The slices held at once on one GPU never exceed its slot count.

**Assumptions.** Models, slot counts, teams and samples are hypothetical. Attributing a whole-GPU utilisation sample to every slice on that GPU is this exercise's simplification; real partitioned GPUs can report per-slice metrics.

**Clarifications.**
- Q: Two teams hold slices of one GPU at the same time. Who gets the sample? | A: Both, each weighted by its own share.
- Q: A sample's timestamp equals an allocation's end. Does it belong to it? | A: No. The held interval is `start ≤ ts < stop`; the sample belongs to the next holder, if any.
- Q: Should a missing sample count as 0 % utilisation? | A: No. It is unknown, so it is left out of both the numerator and the denominator.
- Q: Which day does a sample belong to? | A: The UTC day of its `ts`.
- Q: How many bugs are there? | A: Several, of different kinds. Each has a test named after it.

**Hints.**
1. Find a node whose GPUs are not all the same model and check which model the code looks up for GPU 2.
2. Evaluate `3 // 7` and `3 / 7` in Python.
3. Look for every place that uses `a["end"]`.
4. An allocation runs from 22:00 to 02:00 UTC. Which days does the code charge, and how much?
5. Write the average for an hour with 60 samples expected and 55 present, both ways.

**Follow-ups.**
1. Write the smallest set of unit tests that would have caught every one of these bugs.
2. Samples arrive late from nodes whose clocks drift. Which days' results can change after they are published, and how would you restate them?
3. Finance wants GPU-hours by team for a month to match the scheduler's own accounting exactly. Where can the two disagree, and which one should be the source of truth?
4. At 100 000 GPUs with one sample per second, the inner loop over allocations per GPU is the cost. How would you join samples to allocations in a warehouse or a stream processor instead?

**Follow-up rules.**
- when: first gpu, homogeneous, mixed node, own model → ask: Your fix looks the model up per GPU. Where else in a cluster's data can a per-node assumption hide, and how would you test for it?
- when: integer division, //, floor → ask: GPU-hours are now fractional. Where do you round, and what does rounding each allocation before summing do to a month's bill?
- when: midnight, utc, day boundary → ask: The finance team's day starts at midnight in their own time zone. What changes in your code, and in what you store?
- when: missing, zero, gap, telemetry agent → ask: A node sent no samples for six hours. Should the report show an average, or say how much of the day was observed? What would you add to the output?
- when: preempted, preemption → ask: A preempted job is restarted on another node. How would you report the GPU-hours lost to preemption per team?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; the model looked up per GPU; fractional shares; preempted allocations end at `preempted_at` for both charging and sample attribution; GPU-hours split at midnight UTC; missing samples excluded from the average, `None` with no samples; a minimal fix that keeps the output; a test per bug.

## NVD-L2-04: Joining per-second GPU samples to the job that held each GPU

| | |
|---|---|
| **Template ID** | NVD-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / interval joins, downsampling, retention tiers, clock skew |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer |

```params
{
  "gpus": {"2": ["4,000", "12,000"], "3": ["60,000", "150,000"]},
  "metrics": [12, 30, 60],
  "raw_retention": ["7 days", "14 days", "30 days"],
  "clock_skew": ["up to 90 seconds", "up to 10 minutes"]
}
```

**Business Scenario.** A GPU cluster operator runs {{gpus}} GPUs. An agent on every node samples {{metrics}} metrics per GPU once a second: utilisation, memory used, power, temperature, clock speeds and error counters. The scheduler records which job, and which slice of a GPU, held each GPU and when. Today the samples sit in a time-series store that knows nothing about jobs. Users want to see their job's GPUs on a dashboard; capacity planners want a year of history by team and GPU model; and engineers investigating a failure want the raw seconds around it. Node clocks are synchronised, but the operator has seen drift of {{clock_skew}} before a node is fixed.

**Problem Statement.** Design the pipeline that joins every sample to the job (and slice) that held that GPU at that second, and serves it at several resolutions. Cover how samples and scheduler events land, the join itself (an interval join keyed by GPU), what happens to samples for a GPU no job held, downsampling (which aggregates you keep per minute and per hour), retention tiers (raw seconds for {{raw_retention}}, then rollups), late and out-of-order samples, node clock skew, and how a dashboard and a capacity report each read the data.

**Constraints.** Raw seconds must stay queryable for {{raw_retention}}. Rollups must be reproducible: rebuilding an hour gives the same numbers. Scheduler events (allocate, release, preempt) can arrive minutes after the samples they explain. A job's dashboard should lag real time by less than a minute.

**Assumptions.** All volumes, metrics and retention periods are hypothetical. Each sample carries a node id, a GPU index, the node's own timestamp and the values. Each scheduler event carries a job id, a node, a GPU index, a slice, an event type and the scheduler's timestamp. You may use common building blocks: a partitioned log, a stream processor, object storage with a columnar format, a time-series database, a warehouse.

**Clarifications.**
- Q: Is the GPU or the job the main key? | A: Samples are produced per GPU; users ask per job and per team. You choose, and must explain, where each key is used.
- Q: What should a per-minute rollup hold? | A: You decide. Averages alone are not enough for some questions, such as "was the GPU ever pegged at 100%?" or "did the error counter increase?".
- Q: Can one GPU be held by several jobs at once? | A: Yes, when it is split into slices. Whole-GPU metrics then belong to several jobs.
- Q: How late can a scheduler event be? | A: Usually seconds; occasionally several minutes, after a scheduler restart.
- Q: Which clock is right? | A: Neither perfectly. Scheduler timestamps come from one service; sample timestamps come from each node.

**Hints.**
1. Turn scheduler events into a table of holding intervals per GPU `(gpu, slice, job, from, to)`. The join is then "which interval contains this second", which a sorted structure per GPU answers quickly.
2. Pick rollup aggregates that can be merged: sum and count, min and max, a histogram or sketch for percentiles, and first and last values for counters.
3. Treat an interval whose release has not arrived yet as open, and decide what the dashboard shows meanwhile and what the rollup does later.

**Follow-ups.**
1. A release event arrives five minutes late. Which samples were joined to the wrong state, and how do you correct the dashboard and the rollups?
2. One node's clock is 4 minutes ahead. How would you detect it from the data, and what do you do with its samples?
3. Capacity planning asks for p95 utilisation per team per month. Which rollups give that exactly, which give it approximately, and which cannot?
4. The raw tier costs too much at {{gpus}} GPUs. What would you keep at full resolution, for whom, and for how long?
5. A job's slice layout changes mid-run. How does your interval table represent it, and what does the job's dashboard show?

**Follow-up rules.**
- when: tumbling window, window by minute, group by minute → ask: The release event for a job arrives after its minute window closed. What does your window emit, and how is it corrected?
- when: average, avg, mean → ask: Your hourly rollup stores the average. How do you compute the daily p95 from it, and how would you know a GPU hit 100% for ten seconds?
- when: watermark, allowed lateness → ask: How did you choose the lateness bound, given clock drift of {{clock_skew}}, and what happens to a sample beyond it?
- when: join on timestamp, exact timestamp, equi-join → ask: The scheduler and the node never record the same second. What kind of join do you need, and how do you make it cheap?
- when: delete raw, drop raw, ttl → ask: An investigation needs the raw seconds from 40 days ago. What do you say, and what would you have kept to answer it?

**Production Reality Check.**
- After a scheduler restart, release events for 2% of jobs arrive eight minutes late; for those minutes, dashboards show the old jobs still running on GPUs that new jobs now hold.
- A node's clock drifts by {{clock_skew}}, and its samples are joined to the job that held the GPU before the current one.
- A rollup job is rerun after a bug fix, and its hourly utilisation for one week no longer matches what was already shown to teams.

**Evaluation Criteria.** A holding-interval table derived from scheduler events, with open intervals and corrections; an interval join per GPU that handles slices; idle samples kept and labelled; mergeable rollup aggregates (sum, count, min, max, sketches, counter deltas); explicit lateness and clock-skew handling with a correction path; retention tiers sized and justified; reproducible rollups by partition rebuild; serving paths for the dashboard and for long-range reports; a plan for each incident.

## NVD-L2-05: Training run lineage: restarts, resumed checkpoints and forks

| | |
|---|---|
| **Template ID** | NVD-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data modeling and pipelines / lineage graphs, checkpoints, metric series across restarts and forks |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | ml-platform-engineer, ai-infra-engineer, data-engineer, senior-data-engineer, data-architect |

```params
{
  "runs_per_week": {"2": ["300", "1,200"], "3": ["8,000", "25,000"]},
  "steps": ["200,000", "1 million", "5 million"],
  "metrics_per_step": [20, 80, 300],
  "checkpoint_every": ["500 steps", "2,000 steps", "30 minutes"]
}
```

**Business Scenario.** A team running training jobs on GPUs launches about {{runs_per_week}} runs a week. Long runs reach {{steps}} steps and save a checkpoint every {{checkpoint_every}}. Runs crash and are restarted from the last checkpoint, so some steps are trained twice. Researchers fork a run: they take a checkpoint, change a hyperparameter such as the learning rate, and continue as a new run. Each run logs {{metrics_per_step}} metrics per step. Researchers want one loss curve for "the run I care about", across every restart and back through the forks it came from, without the steps that were thrown away.

**Problem Statement.** Design the data model and the pipeline for training-run lineage. Cover the entities (run, attempt, checkpoint, fork, configuration), how a restart and a fork are recorded, which step of which attempt is the "effective" one when steps were trained twice, how a metric series is assembled for a run across its whole lineage, how configurations and their differences are stored, ingestion of {{metrics_per_step}} metrics per step, and the queries researchers run most often.

**Constraints.** Metrics arrive from running jobs and can be duplicated when a logger retries. A crashed attempt's metrics after its last checkpoint must stay visible for debugging, but must not appear in the effective curve. A fork can start from any checkpoint, including one from a run that was later deleted from the dashboard. Comparing two forks from the same parent must be quick.

**Assumptions.** All volumes and intervals are hypothetical. Each job reports a run id, an attempt number, the checkpoint it resumed from (if any), its configuration and its metrics with step numbers. Checkpoint files live in object storage; this design stores their metadata, not the files.

**Clarifications.**
- Q: What is an attempt? | A: One execution of a run, from start or resume until it ends or crashes. A run has one or more attempts.
- Q: Steps 4 001 to 4 350 were trained by attempt 1, which crashed, and again by attempt 2, which resumed from the checkpoint at step 4 000. Which count? | A: Attempt 2's. Attempt 1's are kept for debugging but are not effective.
- Q: Does a fork share history with its parent? | A: Yes, up to the checkpoint it started from. After that it is its own run.
- Q: Can a run resume from a checkpoint that is not the latest? | A: Yes, for example when the latest is corrupt. Everything after the checkpoint used is superseded.
- Q: How are configurations compared? | A: Researchers want to see exactly which values differ between two runs, including nested ones.

**Hints.**
1. Model lineage as a graph of segments: each attempt covers a range of steps starting from a checkpoint, and a fork is an edge from a checkpoint of one run to the start of another.
2. The effective step `s` of a run is from the latest attempt whose range covers `s`, walking back through the fork edges for steps before the fork point.
3. Store metrics by `(run, attempt, step)` once and compute the effective view on top, rather than rewriting metrics when an attempt crashes.

**Follow-ups.**
1. A researcher deletes a parent run from the dashboard. What happens to its forks' curves, and what do you keep?
2. A checkpoint turns out to be corrupt, and three runs were forked from it. How do you find them, and what do you tell their owners?
3. Comparing two forks at {{steps}} steps with {{metrics_per_step}} metrics each is slow. What do you precompute or downsample, and how do you keep the shape of a loss spike?
4. Two attempts of the same run used different library versions. Where does that show up, and how would a researcher see that the curve changed character at the restart?
5. Lineage spans many teams' runs. Who may see a fork of their run made by another team, and how is that enforced?

**Follow-up rules.**
- when: overwrite, upsert, replace metrics → ask: Attempt 1 crashed at step 4 350 and attempt 2 overwrote steps 4 001 to 4 350. How does an engineer now debug why attempt 1 crashed?
- when: parent_id, parent run, tree → ask: A fork starts from step 30 000 of a parent that itself was resumed twice. Walk me through the query that builds the fork's curve from step 0.
- when: json, jsonb, config blob → ask: How do you show the exact differences between the configurations of two forks, including nested values, and how do you search for every run with a given learning rate?
- when: dedupe, duplicate, idempotent → ask: A logger retries a batch of metrics for steps 9 000 to 9 100. What key makes the retry harmless, and does it differ from the key that picks the effective step?
- when: wide table, one column per metric → ask: A new metric appears in half the runs. What does your table do, and how do you query a metric that most runs lack?

**Production Reality Check.**
- A job is restarted from a checkpoint {{checkpoint_every}} older than the latest because the latest is corrupt, and the effective curve briefly shows both attempts' values for the same steps.
- A logger retries after a network timeout and sends {{metrics_per_step}} metrics for 500 steps twice; one researcher's loss curve shows a sawtooth.
- A popular parent run is deleted from the dashboard, and the curves of its forks lose their first 30 000 steps.

**Evaluation Criteria.** Clear entities for run, attempt, checkpoint, fork and configuration; metrics kept per attempt and the effective view computed from attempt ranges and fork edges; superseded steps kept and labelled; idempotent ingestion on `(run, attempt, step, metric)`; configuration differences queryable; lineage queries that stay fast (precomputed effective segments, downsampled curves that keep extremes); deletion as a soft state that preserves lineage; access rules across teams; a plan for each incident.
