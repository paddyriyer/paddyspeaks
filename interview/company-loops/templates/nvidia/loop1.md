# NVIDIA · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an accelerated
computing company: GPUs, data-centre systems and networking, CUDA and its
libraries, and the clusters people run training jobs on. The setting is always "a
GPU cluster operator" or "a team running training jobs on GPUs"; nothing here
describes any company's own clusters, schedulers or customers. Every workload,
number, layout and schema is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## NVD-L1-01: Correctable memory errors per GPU per day, from a counter that resets on reload

| | |
|---|---|
| **Template ID** | NVD-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LAG over cumulative counters, counter resets, daily attribution, top-1 per group |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |
| **Generator** | NVD-L1-01.mjs |

**Business Scenario.** A GPU cluster operator polls every GPU a few times a day and stores the value of its cumulative **correctable memory error** counter. Correctable errors are fixed in hardware and do not crash a job, but a GPU whose count climbs quickly is a candidate for a closer look before it starts failing jobs. The counter is cumulative since the driver was last loaded: when the driver is reloaded, it starts again from 0, and each reading carries the `driver_load_id` it was read under. The reliability team wants a daily list of nodes with GPUs whose counter increased by at least {{threshold}} in a day.

**Problem Statement.** Table `gpu_error_samples(sample_id, node_id, gpu_uuid, sample_ts, driver_load_id, ce_total)` holds {{samples}} readings from {{gpus}} GPUs. Write one PostgreSQL query that returns `day, node_id, flagged_gpus, worst_gpu, worst_increase`.

For each GPU, order its readings by `sample_ts` and compare each reading with the previous one:
- if both were read under the same `driver_load_id`, the **increase** is `ce_total − previous ce_total`;
- if `driver_load_id` changed, the driver was reloaded in between and the counter restarted from 0, so the increase is the new `ce_total` itself;
- a GPU's first reading has no increase.

An increase belongs to the UTC date of the later reading. A GPU's **daily increase** is the sum of its increases on that date, and a GPU is **flagged** on a day when its daily increase is at least {{threshold}}. Return one row per (day, node) with at least {{min_gpus}} flagged GPUs: how many GPUs on the node were flagged, the flagged GPU with the largest daily increase (ties to the smaller `gpu_uuid`) and that increase. Order by `day, node_id`. {{null_rule}} {{reset_rule}}

**Constraints.** One SQL statement (CTEs allowed). A GPU stays on its node for the whole sample. Two readings of the same GPU never share a `sample_ts`.

**Assumptions.** The counter's behaviour (cumulative since driver load, restarting from 0 on reload), the polling schedule and the threshold are this exercise's hypothetical model, not the specification of any product; check current docs for how a given driver exposes its error counters. Uncorrectable errors and driver error events are out of scope here.

**Clarifications.**
- Q: Why not just take the largest reading of the day minus the smallest? | A: A reload in the middle of the day restarts the counter, so max − min mixes two different counts and can even go negative.
- Q: The previous reading is on the day before. Which day gets the increase? | A: The later reading's UTC date. The errors were observed by the reading that reported them.
- Q: Is the threshold inclusive? | A: Yes. A daily increase exactly equal to {{threshold}} is flagged.
- Q: A reload happened and the new value is higher than the old one. Is that a reset? | A: Yes. A reset is any change of `driver_load_id`; the value alone does not tell you.
- Q: Can the same GPU appear on two nodes? | A: Not in this sample.

**Hints.**
1. `LAG(ce_total)` and `LAG(driver_load_id)` over `PARTITION BY gpu_uuid ORDER BY sample_ts` give each reading its predecessor.
2. Decide what a row means before you aggregate: one row per reading with its increase and its day.
3. Filter rows you should not compare before the window, not after it: a window computed over rows you later discard pairs the wrong neighbours.
4. `ROW_NUMBER() OVER (PARTITION BY day, node_id ORDER BY increase DESC, gpu_uuid)` together with `COUNT(*) OVER (PARTITION BY day, node_id)` gives the worst GPU and the count in one pass.

**Follow-ups.**
1. Readings arrive a few hours apart. How would you attribute an increase that spans midnight more fairly, and is that worth the complexity?
2. The fleet grows to hundreds of thousands of GPUs polled every minute. How would you compute daily increases incrementally, without re-reading the whole history each day?
3. A node's GPUs all jump at the same moment. What could explain that besides failing memory, and how would you tell the cases apart in data?
4. How would you turn this daily list into a drain decision with a measured false-positive rate?

**Follow-up rules.**
- when: max(, min(, max - min, greatest → ask: A GPU's driver was reloaded at noon. What does max minus min of the day's readings give you, and is it the number of errors?
- when: lag, lead → ask: Some reads failed and stored NULL. Where in your query do they disappear, before or after the window, and why does that matter?
- when: sample_id, order by sample_id → ask: Is `sample_id` guaranteed to follow time? What happens to your increases if it does not?
- when: ce_total < prev, lower than the previous, decrease, went down → ask: After a reload the counter can climb past its old value before the next reading. Does your reset test still see it?
- when: date_trunc, ::date, at time zone → ask: Which reading's date does an increase spanning midnight belong to in your query, and why?

**Evaluation Criteria.** Readings ordered by time per GPU; failed reads removed before neighbours are paired (Hard+); a reset recognised by a change of `driver_load_id` and its increase taken as the new value (Very Hard: including a reset with no drop); the first reading excluded; increases dated by the later reading in UTC; inclusive threshold; minimum flagged GPUs per node-day; worst GPU with the stated tie-break; deterministic order; can discuss incremental computation and how to validate a drain signal.

## NVD-L1-02: Work lost to restarts: steps recomputed after each restore, and the GPU-hours they cost

| | |
|---|---|
| **Template ID** | NVD-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / sessionising event streams into runs, latest-before lookup, GROUPING SETS, ratio of totals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer, analytics-engineer |
| **Generator** | NVD-L1-02.mjs |

**Business Scenario.** A team running long training jobs on a shared GPU cluster saves checkpoints every few hundred steps. When a run is interrupted, the job restarts from its last saved checkpoint, so every step since that checkpoint is computed twice. The platform team wants to show each team how much of its GPU time went into recomputing work, to decide whether more frequent checkpoints would pay for themselves.

**Problem Statement.** Tables `jobs(job_id, team)` ({{jobs}} jobs) and `job_events(event_id, job_id, event_ts, event_type, step, gpus)` ({{events}} events). {{types_rule}} A job's events, in `event_ts` order, form **runs**: a run begins with a `start` event (its `step` is the step training resumes from, its `gpus` the GPUs the run holds) and ends with the next `fail`, `preempt` or `complete` event, whose `step` is the step reached. A `checkpoint` event inside a run saved that run's state at its `step`. {{gpus_rule}}

When a run is **interrupted** (it ends with `fail` or `preempt`), its **restore point** is the latest `checkpoint` of that run at or before the interruption (a checkpoint in the same second as the interruption counts), or the run's own `start` if the run saved none. For each interruption:
- recomputed steps = interruption `step` − restore point `step`;
- lost GPU-seconds = seconds from the restore point's `event_ts` to the interruption × the run's `gpus`.

A job's **total GPU-seconds** is the sum over all its runs of the run's duration in seconds × its `gpus`.

Write one PostgreSQL query returning `team, job_id, interruptions, recomputed_steps, lost_gpu_hours, lost_share`: one row per job (every job, including jobs never interrupted), and after each team's jobs one **team row** with `job_id` NULL that sums the team's jobs. `lost_gpu_hours` = lost GPU-seconds / 3600 rounded to 2 places; `lost_share` = lost GPU-seconds / total GPU-seconds rounded to 4 places (for the team row, of the team's totals). Order by `team`, then `job_id` with the team row last.

**Constraints.** One SQL statement (CTEs allowed). Every run ends before the next `start` of its job, and every job's last run is `complete`. `event_id` is assigned at load time and is not in time order.

**Assumptions.** Jobs, teams, step rates, checkpoint intervals and GPU counts are hypothetical. The model is deliberately simple: a restart resumes exactly from the restore point, step time is constant, and the time spent loading a checkpoint is ignored.

**Clarifications.**
- Q: A checkpoint and a failure have the same `event_ts`. Was the checkpoint saved? | A: Yes. A checkpoint at the same second as the interruption counts; nothing after it was lost.
- Q: Can a run restore from a checkpoint saved in an earlier run? | A: Not directly: the run's `start` step is already that checkpoint. If the run saved none of its own, its restore point is its `start`.
- Q: Does the time between an interruption and the next start count as GPU time? | A: No. Only time inside runs is counted, in both the lost and the total GPU-seconds.
- Q: For the team row, is the share the average of the jobs' shares? | A: No. It is the team's lost GPU-seconds over the team's total GPU-seconds.
- Q: Which GPU count applies to a run? | A: The `gpus` on that run's `start` event.

**Hints.**
1. Number the runs: a running count of `start` events per job, ordered by `event_ts`, gives every event its run.
2. One row per run with `FILTER`ed aggregates: start time and step, GPUs, end time and step, how it ended, and its latest checkpoint.
3. `GREATEST(start, latest checkpoint)` is the restore point; a run with no checkpoint has a NULL latest checkpoint, so `COALESCE` first.
4. `GROUP BY GROUPING SETS ((team, job_id), (team))` produces both the job rows and the team rows; compute shares from summed seconds, not from rounded hours.

**Follow-ups.**
1. Given a team's failure rate and the time a checkpoint takes to save, how would you choose the checkpoint interval that minimises expected lost plus checkpointing time?
2. Preemptions are announced a short time in advance. How would you measure how much lost work a checkpoint-on-preempt policy would have saved, from this data?
3. Runs restart on a different number of GPUs and the step rate changes. Which of your measures still mean the same thing?
4. Events come from thousands of jobs as a stream, sometimes late. How would you compute these numbers continuously?

**Follow-up rules.**
- when: lag, lead → ask: Your LAG looks one event back. What if a failed checkpoint attempt or another event sits between the checkpoint and the interruption?
- when: grouping sets, rollup → ask: How does your team row's share come out: from summed seconds, or from the rounded job values? Show where the difference would appear.
- when: avg → ask: Is the team's share the average of its jobs' shares? What happens when one small job lost half its time and a large one lost almost none?
- when: event_id → ask: Is `event_id` in time order here? What breaks if you number runs by it?
- when: < event_ts, strictly before → ask: A checkpoint and the interruption share a second. Which restore point does your query pick, and what does the rule say?

**Evaluation Criteria.** Runs reconstructed per job in time order; the restore point is the latest checkpoint in the run at or before the interruption, else the start; preemptions counted like failures (Hard+); failed checkpoint attempts ignored and each run charged at its own GPU count (Very Hard); never-interrupted jobs present with zeros and counted in team totals; team shares as ratios of totals; correct rounding from unrounded seconds; NULL `job_id` for team rows and the stated order; can reason about checkpoint intervals and streaming computation.

## NVD-L1-03: Queue wait by request size: median minutes to start per partition and GPU bucket

| | |
|---|---|
| **Template ID** | NVD-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / range join to a bucket table, PERCENTILE_CONT medians, conditional counts, HAVING floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | NVD-L1-03.mjs |

**Business Scenario.** A GPU cluster operator runs a batch scheduler with several partitions. Users keep asking "if I ask for more GPUs, how much longer will I wait?" The operator wants a table of typical queue waits by partition and by how many GPUs a job requested, using the median because a few jobs that wait for hours would drag an average far from what most users see.

**Problem Statement.** Table `job_attempts(job_id, attempt, partition_name, gpus_requested, queued_at, started_at, cancelled_at)` has {{rows}} rows; `gpu_buckets(bucket_min, bucket_max, label)` defines the buckets {{buckets}} (a NULL `bucket_max` means no upper bound; both bounds are inclusive). {{attempt_rule}}

A job's **queue wait** is from its attempt 1 `queued_at` to its attempt 1 `started_at`, in minutes. A job whose attempt 1 has no `started_at` but has a `cancelled_at` was **cancelled before start**: it has no wait and is counted separately. {{cancel_rule}}

Write one PostgreSQL query returning `partition_name, bucket_min, gpu_bucket, jobs_started, cancelled_before_start, median_wait_min`: one row per partition and bucket (by `gpus_requested`), where `jobs_started` is the number of jobs that started, `cancelled_before_start` the number cancelled before start, and `median_wait_min` the median queue wait (`PERCENTILE_CONT(0.5)`, so with an even count the mean of the two middle waits) rounded to 2 places. Leave out groups with fewer than {{min_jobs}} started jobs. Order by `partition_name, bucket_min`.

**Constraints.** One SQL statement (CTEs allowed). `(job_id, attempt)` is unique; a job keeps its partition and GPU request across attempts. Every `gpus_requested` falls in exactly one bucket.

**Assumptions.** Partitions, bucket boundaries, waits and the floor are hypothetical, and the scheduler is a generic batch scheduler, not any particular product. A median of waits that ended ignores jobs still waiting, which biases it low when the queue is long; the follow-ups return to that.

**Clarifications.**
- Q: Do cancelled jobs count in `jobs_started`? | A: A job cancelled before it started does not; it is counted in `cancelled_before_start`. A job cancelled after it started did start, so it counts.
- Q: Does the floor count cancelled jobs? | A: No. The floor is on `jobs_started`.
- Q: A job asks for exactly the upper bound of a bucket. Where does it go? | A: In that bucket: both bounds are inclusive.
- Q: How is the median computed with an even number of jobs? | A: `PERCENTILE_CONT(0.5)`: the mean of the two middle waits.
- Q: Should a job that was requeued contribute two waits? | A: No. This report is about the first wait from submission to start; attempt 1 only.

**Hints.**
1. Join to the bucket table with a range condition, and decide what happens when `bucket_max` is NULL before you write `BETWEEN`.
2. `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY …)` ignores NULL values, so jobs that never started fall out of the median on their own.
3. `COUNT(started_at)` counts non-NULL values; `COUNT(*) FILTER (WHERE …)` counts any condition.
4. `PERCENTILE_CONT` returns double precision; cast to `numeric` before `ROUND(…, 2)`.

**Follow-ups.**
1. Jobs still waiting are left out, so a long queue makes the median look better than it is. How would you report a median that accounts for them?
2. Users want a forecast for a job they are about to submit. What would you add to this table, and how would you tell them how uncertain it is?
3. At millions of jobs a day, exact medians per group are expensive. What would you use instead, and what error would you accept?
4. Large requests wait longer partly because the scheduler holds GPUs back to fit them. How would you separate waiting for capacity from waiting for priority?

**Follow-up rules.**
- when: avg, average, mean → ask: A few jobs waited four hours and most waited two minutes. What does the average tell a user, and why did the team ask for a median?
- when: between → ask: The top bucket has no upper bound. What does `BETWEEN bucket_min AND bucket_max` do with a NULL `bucket_max`?
- when: percentile_disc → ask: With four jobs in a group, which value does PERCENTILE_DISC return, and what does the question ask for?
- when: cancelled_at is null, cancelled_at is not null → ask: A job was cancelled an hour after it started. Is it excluded by your filter, and should it be?
- when: min(queued_at), max(started_at), attempt → ask: A job was preempted and requeued. Which two timestamps define its wait in your query?

**Evaluation Criteria.** Range join with inclusive bounds and an open-ended top bucket; attempt 1 only (Very Hard); cancelled-before-start excluded from the median and counted separately; jobs cancelled after starting kept and still-waiting jobs left out (Hard+); `PERCENTILE_CONT` median with numeric rounding; floor on started jobs inclusive; deterministic order by bucket lower bound; can discuss censoring, forecasting and approximate quantiles.

## NVD-L1-04: Placing GPU slices: first fit on aligned slot boundaries across thousands of GPUs

| | |
|---|---|
| **Template ID** | NVD-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps and bitmasks / first-fit allocation with lazy invalidation, aligned buddy-style blocks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer |
| **Generator** | NVD-L1-04.mjs |

**Business Scenario.** A GPU cluster operator partitions GPUs into fixed-size slices so that small inference and notebook workloads can share a GPU. In this exercise's hypothetical layout, each GPU has `slots` equal slots (4 or 8), and a slice of 1, 2 or 4 slots must start on a slot index that is a multiple of its size, like aligned blocks in a buddy allocator. Before changing the placement policy, the operator wants an exact replay of a day of requests and releases under the current policy: first fit. {{drain_rule}}

**Problem Statement.** Implement `place_slices(num_gpus, slots, ops)`. GPUs are numbered `0 … num_gpus − 1` and start empty. Process `ops` in order:
- `('alloc', req_id, size)`: place a slice of `size` slots on the **lowest-numbered** eligible GPU that has `size` free slots starting at an offset that is a multiple of `size`; on that GPU, use the **lowest** such offset. If no GPU can take it, the request is rejected.
- `('free', req_id)`: release that request's slots. {{release_rule}}
- `('drain', gpu)` / `('undrain', gpu)`: see the scenario.

Return a list with one entry per `alloc`, in order: `(gpu, offset)`, or `None` if the request was rejected. A rejected request holds nothing, so a later `free` of its id does nothing.

**Constraints.** Up to 3 000 GPUs and 150 000 operations, on a cluster that stays nearly full, so free slots left by releases are scattered everywhere. `size` is 1, 2 or 4 and never larger than `slots`; request ids are never reused. Expected: about O(log G) per operation. Scanning the GPUs from 0 for every request is too slow.

**Assumptions.** The slot layout, alignment rule and policy are this exercise's own hypothetical model of GPU partitioning; check current docs for how any real partitioning feature lays out its slices, which differ by product. Placement ignores memory, topology and fairness.

**Clarifications.**
- Q: A GPU with 8 slots has slot 1 free and slots 2–3 free. Where does a 2-slot slice go? | A: At offset 2. Offsets must be multiples of the size, so slots 1–2 are not a valid 2-slot slice.
- Q: Is "first fit" the first GPU after the last placement (next fit)? | A: No. Always the lowest-numbered GPU that can take it, even if it was full a moment ago.
- Q: What should `free` do with an id that is not currently placed? | A: Nothing. It may have been rejected, released already or never seen.
- Q: Should I move slices around to make room (defragment)? | A: No. Slices never move.
- Q: Does a rejected request wait and retry? | A: No. It is rejected and reported as `None`.

**Hints.**
1. Represent each GPU as a bitmask of used slots; a slice of size k at offset o is the mask `((1 << k) − 1) << o`.
2. Whether a GPU can take a size-k slice depends only on its mask: at most 8 checks.
3. For each size keep a min-heap of GPUs that may be able to take it. When the top cannot (anymore), pop it; that check is cheap and each push is paid for by a state change.
4. A release (and, if present, an undrain) is the only event that makes a GPU eligible again: push it back into the heaps it now fits, unless it is already there.

**Follow-ups.**
1. First fit packs low-numbered GPUs and leaves fragments everywhere else. Construct a small sequence where best fit (the GPU with the fewest free slots that still fits) rejects fewer requests, and one where it rejects more.
2. Requests now say "any size from 2 to 4, larger preferred". What changes in your data structures?
3. The operator wants to reconfigure a GPU to a different slot layout, which requires it to be empty. How would you choose which GPUs to drain, and what does this replay tell you about the cost?
4. Placement must also respect which GPUs share a fast interconnect for multi-slice jobs. How would you extend the heap-per-size idea, and what breaks?

**Follow-up rules.**
- when: for g in range, scan, linear → ask: The cluster is nearly full and the free slots are on GPU 2 900. How many GPUs does your loop look at for one request, and for 150 000?
- when: heap, heapq, priority queue → ask: When does a GPU enter a size's heap, and what stops it from being pushed twice?
- when: next fit, pointer, cursor → ask: GPU 0 just released a slice. Does your cursor ever go back to it, and does the specification require that?
- when: segment tree, fenwick → ask: A tree over GPUs answers "lowest GPU that fits size k" too. How would you store the per-size answer in each node, and is it worth it over three heaps?
- when: bisect, sorted list, sortedcontainers → ask: Sorted lists give O(n) inserts in plain Python. How many inserts does the timing test make, and what is your actual cost?

**Evaluation Criteria.** Correct aligned offsets and lowest offset within a GPU; strict first fit across GPUs, including GPUs that become eligible again after a release; rejected requests return `None` and hold nothing; stale or unknown releases ignored (Hard+); drained GPUs keep their slices and take nothing new until undrained (Very Hard); per-size heaps (or an equivalent ordered structure) with lazy invalidation, O(log G) per operation; can compare first fit and best fit and reason about fragmentation.

## NVD-L1-05: Profiler self time: exclusive time per annotated range from nested push/pop events

| | |
|---|---|
| **Template ID** | NVD-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Stacks / nested intervals per thread, exclusive versus inclusive time, recursion, truncated traces |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer |
| **Generator** | NVD-L1-05.mjs |

**Business Scenario.** A team running training jobs on GPUs annotates its code with named ranges (`forward`, `attention`, `allreduce`, `optimizer_step` …) so a profiler can show where a step's time goes. Each annotation is recorded as a push when the range opens and a pop when it closes, on the CPU thread that issued it. The total (inclusive) time of `forward` includes everything inside it, so the team's report needs **self time**: the time a range spent outside its own child ranges, summed per name. {{thread_rule}}

**Problem Statement.** Implement `self_times(events, end_ts)`. `events` is the trace in order: `('push', thread, ts, name)` opens a range, `('pop', thread, ts)` closes the innermost open range **of that thread**. Ranges on one thread nest like a stack; threads are independent. A range's **duration** is close time − open time, and its **self time** is its duration minus the durations of its **direct** children (ranges opened and closed while it was the innermost open range of the thread). Return `{name: (calls, self_time)}` with one entry per name that was pushed: how many ranges of that name were opened, and the sum of their self times. {{ragged_rule}}

**Constraints.** Up to 300 000 events, nesting up to 400 deep. Timestamps are integers (nanoseconds) and never decrease along the list; `end_ts` is at least the last timestamp. Expected: O(n). Finding each range's children by scanning the events it encloses is O(n × depth) and too slow here.

**Assumptions.** The event format is a generic model of annotated-range profiling with integer timestamps, not the output format of any particular profiler; check the current docs of the tool you use for its exact semantics. Asynchronous GPU work launched inside a range is out of scope: this trace measures the CPU-side ranges only.

**Clarifications.**
- Q: Is a grandchild's time subtracted from its grandparent? | A: No. Only direct children are subtracted; the grandchild's time is already inside the child's duration.
- Q: A range named `matmul` opens inside another `matmul`. Is that one call or two? | A: Two calls. Each instance has its own self time, and the sum never counts the same nanosecond twice.
- Q: Two events have the same timestamp. Which happened first? | A: The one earlier in the list.
- Q: Can a pop on one thread close a range on another thread? | A: No. Each thread has its own stack.
- Q: Can self time be negative? | A: Not with a valid trace: children fit inside their parent.

**Hints.**
1. Keep one stack per thread, and for each open range remember its name, start time and the total duration of its children so far.
2. When a range closes, its self time is its duration minus that children total; then add its duration to the children total of the new top of the stack.
3. There is no need to build the whole tree or store every range.
4. If a trace can end with ranges still open, close them from the innermost outwards so their parents receive their durations.

**Follow-ups.**
1. The report also needs inclusive time per name. With recursion (a name inside itself), how do you avoid counting the same time twice?
2. Two runs of the same model are traced. How would you compare them range by range, when names repeat thousands of times per step?
3. GPU kernels launched inside a range run later and asynchronously. How would you attribute kernel time back to the ranges that launched them?
4. The trace is 50 GB across many processes. How would you compute self times in a distributed job, given that a range can span chunk boundaries?

**Follow-up rules.**
- when: for each range, nested loop, scan → ask: A range at depth 1 encloses 300 000 events. How many events does your inner loop look at in total for the whole trace?
- when: inclusive, total time → ask: Inclusive time of `matmul` when `matmul` nests inside itself: which instances' durations do you add, and why?
- when: tree, children list, parent pointer → ask: Do you need the tree at all? What is the least you must keep per open range to get self time when it closes?
- when: sort, sorted( → ask: The events are already in time order per thread. What does sorting cost you, and what does it lose when timestamps are equal?
- when: global stack, one stack → ask: Thread 2 pops while thread 1 has a range open. Which range does your stack close?

**Evaluation Criteria.** One stack per thread; self time = duration − direct children's durations, with a running children total per open range; each instance of a recursive name counted once; list order for equal timestamps; interleaved threads kept apart (Hard+); pops with nothing open ignored and open ranges closed at `end_ts`, innermost first (Very Hard); O(n) time and O(depth) extra memory per thread; can discuss inclusive time with recursion and asynchronous GPU work.
