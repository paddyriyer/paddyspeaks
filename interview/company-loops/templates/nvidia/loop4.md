# NVIDIA · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of GPUs,
data-centre systems and networking, and the software that runs on them. The
setting is always a GPU cluster operator or a team running training jobs on
GPUs. Hardware and telemetry are described generally, never as the
specification of a particular product; every workload, threshold, number and
schema is hypothetical, and nothing here describes how any company's clusters,
schedulers or systems are actually built.

## NVD-L4-01: Failing-GPU detection with drain decisions you can audit

| | |
|---|---|
| **Template ID** | NVD-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Fleet reliability / signal fusion, automated remediation, audit, measured false positives |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "gpus": {"2": ["8,000", "16,000"], "3": ["60,000", "120,000"]},
  "gpus_per_node": [4, 8],
  "sample_interval": ["10 seconds", "30 seconds", "60 seconds"],
  "drain_budget": ["1%", "2%", "3%"]
}
```

**Business Scenario.** A GPU cluster operator runs {{gpus}} GPUs in nodes of {{gpus_per_node}}, shared by many teams' training and inference jobs. A GPU that is going bad rarely announces it cleanly. Its correctable memory-error counter climbs; it may log driver error events with numeric codes ("Xid-style" events in this exercise), some of which point at the hardware and some at the application; its interconnect links may count errors; and jobs that use it fail, often as timeouts on every rank of a large job rather than as an error on the GPU itself. Per-GPU counters are sampled every {{sample_interval}}. When a node is suspected, it can be drained: no new jobs are placed on it, running jobs are checkpointed or killed, and an active diagnostic suite runs before the node returns to service or goes to repair.

**Problem Statement.** Design the failing-GPU detection and drain system. Cover the signals and how they are collected and normalised; how a job failure is attributed to a node (or not); the detection rules and how they are versioned and rolled out; the drain decision, automatic or by a person, and the limits on it; the audit trail that lets anyone see, months later, why a node was drained; return to service; and how you measure false positives (healthy nodes drained) and false negatives (bad nodes left in service).

**Constraints.** No more than {{drain_budget}} of nodes may be drained automatically at any time; beyond that a person must approve. A fatal hardware event should lead to a drain decision within five minutes. Draining a node interrupts the jobs on it, and a large job may span hundreds of nodes. Counters are cumulative and reset when the driver reloads. Every drain must record which signals, which rule and which rule version caused it.

**Assumptions.** All counts, thresholds and timings are hypothetical, as is this exercise's mapping of event codes to hardware or application causes. The scheduler publishes job events (start, end, exit reason, the nodes and GPUs used). The diagnostic suite takes about an hour and is good but not perfect: it can miss intermittent faults.

**Clarifications.**
- Q: Is there a ground truth for "this GPU was bad"? | A: Partly: a failed diagnostic, a repair ticket that replaced a part, or a recurrence after return to service. Decide how you combine them.
- Q: Can a user's code cause the same symptoms as bad hardware? | A: Yes. Out-of-memory errors, illegal memory accesses and deadlocks in user code all produce job failures, and some produce driver events.
- Q: Do failures cluster? | A: Sometimes: a switch, a power distribution unit, a cooling fault or a bad driver rollout can affect many nodes at once.
- Q: Who owns the drain decision today? | A: An on-call engineer, by hand, from dashboards. You are designing what replaces or assists them.
- Q: Can we drain a single GPU rather than a node? | A: In this exercise, scheduling is per node for large jobs and per GPU for small ones; you decide whether a single-GPU drain is worth supporting.

**Hints.**
1. Separate three things: collecting and normalising signals, deciding (rules with versions), and acting (drains with budgets and approvals). Each needs its own audit.
2. A collective-communication timeout is seen on every rank of the job. Look for the rank or node that stopped first, or that logged a hardware event, before blaming any of them.
3. Many nodes failing at once is usually one shared cause, not many bad GPUs. Group by what they share before you drain.

**Follow-ups.**
1. Walk through one fatal event on one GPU: what is recorded, which rule fires, what the scheduler does to the running job, and what the audit record contains.
2. A large job fails with a timeout on all of its ranks. How does your system decide which node, if any, is to blame?
3. How do you roll out a new detection rule without risking a mass drain, and how do you know it is better than the old one?
4. How do you measure the false-positive and false-negative rates when the diagnostic suite itself misses some faults?
5. Fifty nodes in one rack row report errors within ten minutes. Walk through what the system does, automatically and with people.

**Follow-up rules.**
- when: machine learning, ml model, classifier, anomaly detection → ask: How do you get labels for training it, and how does the on-call engineer find out why the model drained a particular node?
- when: threshold, rule, static threshold → ask: The counter resets when the driver reloads. How does your threshold see a GPU that gains a thousand errors between every reload?
- when: drain, cordon, quarantine → ask: Draining that node kills a job running on 300 nodes that has not checkpointed for two hours. Who decides, and on what information?
- when: automatic, automated, auto-remediation → ask: What stops your automation from draining a quarter of the cluster when a driver update makes a harmless event appear everywhere?
- when: audit, audit trail, log → ask: Six months later a team says a drain cost them a deadline. What exactly can you show them about why it happened?

**Production Reality Check.**
- A driver update reaches a fifth of the nodes and makes a harmless event code appear at every job start. Within an hour the detector proposes draining far more than {{drain_budget}} of the nodes.
- A large training job fails four times in a day with collective-communication timeouts. Each time the detector drains a different node; diagnostics on all four pass. The real cause is one flapping link on a switch port.
- A GPU's correctable memory-error count rises by several hundred between every driver reload, which happens nightly, so its cumulative counter never crosses the threshold. It is found only after it corrupts a checkpoint.
- Diagnostics pass on 40% of the nodes the system drained last month. One team says the rules are too eager; another says the diagnostics miss intermittent faults. Both could be right.

**Evaluation Criteria.** Normalised signals with counter-reset-safe deltas and event-code mapping that is versioned; job-failure attribution that looks for the first or the hardware-implicated rank and does not blame every node in a failed job; rules versioned, shadow-tested and compared on labelled outcomes; drain actions behind budgets, rate limits and correlated-cause grouping, with human approval beyond the budget; checkpoint-aware drains for large jobs; a complete audit record per decision; return to service with probation; false-positive and false-negative rates defined against a stated ground truth and tracked over time; adapts to each incident with diagnosis, recovery and prevention.

## NVD-L4-02: Straggler-aware observability for training jobs across thousands of ranks

| | |
|---|---|
| **Template ID** | NVD-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed training observability / per-rank telemetry, stragglers, collective waits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer |

```params
{
  "ranks": {"2": ["2,048", "4,096"], "3": ["16,384", "32,768"]},
  "step_time": ["0.8 seconds", "2 seconds", "6 seconds"],
  "jobs": [10, 40, 120],
  "overhead": ["1%", "0.5%"]
}
```

**Business Scenario.** Teams run large synchronous training jobs on a GPU cluster; the largest uses {{ranks}} ranks (one process per GPU) and takes about {{step_time}} per step, and about {{jobs}} large jobs run at once. Jobs combine data, tensor and pipeline parallelism, so ranks have different roles: a pipeline's first and last stages do different work from its middle stages. Every step, ranks compute, then wait for each other in collective operations such as all-reduce. One slow rank (a throttled GPU, a bad link, a noisy neighbour on the host, a slow data loader) makes every other rank wait, and the whole job slows. Engineers want to see per-step timings, find stragglers quickly, and compare a job with its own history.

**Problem Statement.** Design the observability system: what each rank measures and emits per step; how it is aggregated and stored without shipping every number from every rank at full fidelity forever; how stragglers are detected and attributed to a rank, a node, a switch or a data source; the dashboards and alerts; and how a job is compared with its own earlier runs. Say what the telemetry costs the training job.

**Constraints.** Telemetry may slow training by no more than {{overhead}}. A persistent straggler must be identified within 100 steps. Node clocks differ by up to several milliseconds, and a node in trouble may stop reporting. Each rank knows its role (data-parallel index, tensor-parallel index, pipeline stage) and its node; the cluster's topology (node to switch) is available from inventory.

**Assumptions.** All sizes, rates and budgets are hypothetical. Ranks can time their own phases with local clocks: compute, waiting in each collective, waiting for input data, optimiser step and checkpoint writes.

**Clarifications.**
- Q: Do we need every rank's timings for every step? | A: You decide; say what you keep at full fidelity, for how long, and what you summarise.
- Q: Are all ranks expected to take the same time? | A: Only ranks with the same role. Pipeline stages and tensor shards can legitimately differ.
- Q: Can the system act on a straggler, or only report it? | A: Reporting is required; proposing a node replacement to the job owner is welcome; you decide about anything automatic.
- Q: Is the profiler available? | A: Yes, but it is heavy; it can be switched on for a few steps on chosen ranks.

**Hints.**
1. In a synchronous step, the straggler is the rank that waits least in the collective; everyone else's wait is inflated by it. High wait everywhere is a symptom, not the cause.
2. Durations measured on one rank's own clock are safe to compare across ranks; absolute timestamps from different nodes are not.
3. Aggregate on the node or in the job (per-step min, median, max and the rank holding each), and keep full detail only for sampled steps and around anomalies.

**Follow-ups.**
1. Estimate the telemetry volume for the largest job and for the whole cluster, and show where you cut it down.
2. Walk through how your system names the straggler in a {{ranks}}-rank job that slowed down by 30% an hour ago.
3. How do you distinguish one slow GPU from a slow switch that affects every node behind it, and from a slow shared file system feeding the data loaders?
4. How do you avoid flagging the first and last pipeline stages as stragglers on every step?
5. A job owner wants an automatic restart without the straggling node when one is found. What would have to be true before you allow it?

**Follow-up rules.**
- when: timestamp, timeline, trace → ask: Node clocks differ by several milliseconds and a collective takes a few milliseconds. How does your timeline avoid showing a collective finishing before it started?
- when: average, mean → ask: One rank in {{ranks}} is 40% slower. What does the average per-rank step time show, and what does the job actually experience?
- when: prometheus, time series, metric per rank, label → ask: How many distinct series does a per-rank, per-phase metric create across {{jobs}} jobs, and what does that do to your metrics store?
- when: sample, sampling → ask: The straggler appears for two steps in every fifty. Does your sampling catch it, and how do you know?
- when: alert, page, alerting → ask: Who is paged for a straggler in a team's job at 3 a.m., and what can they do about it?

**Production Reality Check.**
- Step time on a {{ranks}}-rank job rises 30%. The dashboard shows every rank spending most of each step waiting in collectives, and the on-call engineer spends two hours investigating the network before anyone checks which rank waits least.
- An update to the telemetry agent makes each rank flush its metrics synchronously at the end of every step. Step time rises about 4% on every job, well above the {{overhead}} budget, and no alert fires because the agent's own cost is not measured.
- The straggler alert fires on every step for the last pipeline stage of every job using pipeline parallelism, and teams start muting it.
- A slow shared file system makes data-loader waits spike on a third of the ranks every few minutes. The straggler detector names a different node each time and the job owner drains three healthy nodes.

**Evaluation Criteria.** Per-rank phase durations measured on local clocks, with collective wait separated from compute and data wait; straggler detection by least wait or most compute within ranks of the same role; topology-aware attribution (GPU, node, switch, storage) by grouping slow ranks by shared component; volume estimate with node or job-level aggregation and full fidelity only for samples and anomaly windows; the cost of telemetry itself measured against the budget; baselines per job and comparison with its own history; careful use of clocks for timelines; alerts with owners and actions; adapts to each incident with diagnosis, recovery and prevention.

## NVD-L4-03: Fair-share GPU accounting: promised, delivered, borrowed and preempted

| | |
|---|---|
| **Template ID** | NVD-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Resource accounting / quotas, decayed usage, preemption, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "gpus": {"2": ["4,000", "10,000"], "3": ["40,000", "100,000"]},
  "teams": [30, 80, 200],
  "half_life": ["24 hours", "7 days", "14 days"],
  "period": ["month", "quarter"]
}
```

**Business Scenario.** A GPU cluster of {{gpus}} GPUs is shared by {{teams}} teams. Each team is promised a guaranteed number of GPUs for the {{period}}. When a team does not use its guarantee, others may borrow the idle GPUs at lower priority; when the owner comes back, borrowed jobs are preempted after a short grace period in which they can checkpoint. Among queued jobs, the scheduler orders teams by fair-share priority, computed from each team's recent usage decayed with a half-life of {{half_life}}. Some jobs use whole GPUs and some use fixed-size slices of a partitioned GPU. Team leads and finance want to know, per team: what was promised, what was delivered, what was borrowed and lent, how much work was lost to preemption, and why a particular job waited.

**Problem Statement.** Design the accounting system. Cover the event sources (scheduler job events, preemptions, quota grants and changes with effective dates, node availability); the usage ledger and its unit (GPU-seconds, with slices weighted); the definition of "delivered" against "promised"; the decayed-usage computation, reproducible for any past moment; the reports and chargeback; and the "why did my job wait?" explanation. Show how the numbers reconcile.

**Constraints.** Totals must reconcile every hour: GPU-seconds used by all teams, plus idle, plus unavailable (drained or in maintenance), equals the cluster's GPU-seconds. Quota changes can be made mid-{{period}}, and occasionally backdated. The fair-share priority shown in a report must equal what the scheduler used at that moment. Chargeback for a closed {{period}} must not change silently.

**Assumptions.** All sizes, rates and policies are hypothetical. The scheduler emits an event for every submit, start, preemption, checkpoint and end, with GPUs or slices held. GPU models differ in capability; how to weight them is your call.

**Clarifications.**
- Q: If a team had no queued work, was its guarantee "undelivered"? | A: That is the central definitional question. Decide and defend it.
- Q: Does preempted work count as delivered? | A: The GPUs were used, but work since the last checkpoint was lost. Report it somehow; you decide how it is charged.
- Q: Who borrows when several teams want idle GPUs? | A: The team with the best fair-share priority, then by submission time.
- Q: Is decayed usage counted per team or per user? | A: Per team for this exercise; per-user fairness inside a team is out of scope.

**Hints.**
1. Make the ledger the source of truth: intervals of (job, team, GPUs or slices, start, end, reason ended), from which every report is a projection.
2. "Delivered" only means something against demand: a guarantee is unmet only while the team had work waiting that could have used it.
3. Decayed usage can be updated incrementally (decay the old value by the elapsed time, add the new usage); store snapshots so any past value can be reproduced exactly.

**Follow-ups.**
1. Define promised, delivered, borrowed, lent and lost precisely, then compute them for one team over one day from a few example events.
2. How do you make the fair-share priority in your reports equal the scheduler's at any moment, including after a scheduler restart?
3. A quota grant is backdated to the start of the {{period}}. What changes in the reports, the chargeback and the priorities that were already used?
4. A team asks why their job waited six hours yesterday. What does your explanation show them?
5. Leadership wants to know whether lending idle GPUs is worth the preemptions it causes. What would you measure?

**Follow-up rules.**
- when: utilisation, utilization, gpu-hours, gpu hours → ask: A team's GPUs were allocated all day but their jobs used them at 30%. Is that delivered? Whose problem is it?
- when: preempt, preemption, grace period → ask: Two hours of a borrowed job's work were lost because it could not checkpoint in the grace period. Who pays for those GPU-hours in your chargeback?
- when: half-life, decay, exponential → ask: The scheduler and your report both compute decay in floating point. How do you make them agree to the last digit a month later?
- when: snapshot, recompute, backfill → ask: Recomputing a month of decayed usage after a correction takes how long, and which already-sent reports change?
- when: slice, partition, fractional → ask: A slice holds a small fixed share of a GPU's memory but is worth more than that share to some jobs. How do you weight it, and who agrees to that?

**Production Reality Check.**
- A team says it received 60% of its guarantee last {{period}}; the report says 100%. The report counted every GPU-hour on the team's quota, including jobs preempted hours after their last checkpoint and GPUs held by jobs that were waiting on input data.
- The scheduler restarts and rebuilds decayed usage from zero. For about a day, the team that had used the most gets the best priority, and other teams' jobs wait behind it.
- A quota correction is backdated to the start of the {{period}}, and last {{period}}'s chargeback invoices change without notice to the teams that already reported them to finance.
- An owner team submits a large job and dozens of borrowed jobs are preempted at once. Half of them cannot write a checkpoint within the grace period because the shared storage is saturated by everyone checkpointing together.

**Evaluation Criteria.** An append-only interval ledger from scheduler events as the source of truth; demand-aware definitions of promised, delivered, borrowed, lent and lost, stated precisely; hourly reconciliation against capacity including unavailable GPUs; slice and model weighting made explicit and agreed; decayed usage computed incrementally with snapshots so past priorities reproduce exactly (and a shared implementation with the scheduler); closed periods frozen with corrections issued as adjustments; an explanation of waits from the queue state at the time; preemption cost measured as lost work; adapts to each incident with diagnosis, recovery and prevention.

## NVD-L4-04: Profiler trace analytics: kernel-level summaries and run-to-run comparison

| | |
|---|---|
| **Template ID** | NVD-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Performance analytics / large trace ingestion, normalisation, comparison |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, data-architect |

```params
{
  "traces_per_day": {"2": ["2,000", "8,000"], "3": ["40,000", "100,000"]},
  "trace_size": ["200 MB", "1 GB", "4 GB"],
  "retention": ["30 days", "90 days", "1 year"]
}
```

**Business Scenario.** Teams running training and inference jobs on GPUs capture profiler traces: for a window of steps on chosen ranks, a timeline of kernels executed on each GPU (several streams can run at once), memory copies, CPU-side API calls that launched them, collective operations, and ranges the code annotates such as "forward", "layer 12" or "optimizer". About {{traces_per_day}} traces arrive per day, each around {{trace_size}} compressed, in formats that change with the profiler's version. Engineers want, for any trace, time per kernel and per annotated range, GPU idle gaps and the overlap of compute with communication; and for two runs of the same model, before and after a library or driver upgrade, an answer to "what got slower, and by how much?"

**Problem Statement.** Design the trace analytics platform: upload, parsing into a common event model, storage, per-trace summaries, search across traces ("which jobs spend more than a fifth of their step in this kernel?") and run-to-run comparison. Say how you avoid double counting when kernels overlap, how kernel names are normalised, and how you keep comparisons fair when the two runs differ in batch size or in the number of steps captured.

**Constraints.** A summary for a trace should be ready within 10 minutes of upload. Raw traces are kept {{retention}}; summaries for longer. Traces belong to teams and may reveal model names and file paths, so access follows the team that owns the job. Kernel names are long, generated from templates, and change across library versions.

**Assumptions.** All sizes and rates are hypothetical. Each trace arrives with its job id, rank, the software stack versions and the step range captured. Event timestamps are on one clock per trace, after the profiler aligns CPU and GPU timelines.

**Clarifications.**
- Q: Are traces from all ranks of a job? | A: Usually a few ranks; sometimes every rank of a job for a few steps, which arrives as hundreds of files at once.
- Q: Should warm-up steps be included? | A: The first steps after start or after a checkpoint restore are slower; you decide how they are treated.
- Q: What is "time" for a kernel that overlaps another? | A: That is for you to define; the answer differs for "where does the GPU spend time?" and "what is on the critical path?".
- Q: Are the two runs in a comparison always the same configuration? | A: Same model, but batch size, sequence length or the number of GPUs can differ. The user says which run is the baseline.

**Hints.**
1. Parse once into a columnar event table (trace, rank, stream, kind, name, normalised name, start, end, range path) and build every summary from it.
2. Summing kernel durations overstates busy time when streams overlap; compute the union of busy intervals per GPU, and separately the time each kernel is the only thing running.
3. Compare runs per step and per annotated range first, then drill into kernels inside the range that changed; normalise by work done (tokens or samples) when batch sizes differ.

**Follow-ups.**
1. Walk through what happens when every rank of a 512-rank job uploads its trace at once, from arrival to a ready summary.
2. Define "GPU busy time", "kernel time" and "exposed communication time" for a step where compute and an all-reduce overlap.
3. A library upgrade renames and splits a kernel. How does your comparison still say which work got slower?
4. How would you answer the cross-trace search query quickly over {{retention}} of traces?
5. How do you show a comparison's uncertainty, so a 3% difference between two single runs is not reported as a regression?

**Follow-up rules.**
- when: sum, total time, add up → ask: Two streams each run kernels for 8 ms of a 10 ms step, overlapping by 6 ms. What does your summary say the GPU was busy for?
- when: database, postgres, relational → ask: One trace holds tens of millions of events. How long does loading and summarising {{traces_per_day}} of them a day take in that database?
- when: regex, demangle, normalise, normalize → ask: Which version of your normaliser produced last month's summaries, and what happens to comparisons across a normaliser change?
- when: average, mean, p50, median → ask: The baseline run has 20 captured steps and the new one has 5, one of them a checkpoint step. How does your comparison treat that?
- when: object storage, s3, parquet, columnar → ask: How do you lay out the event table so "time in this kernel across all jobs last week" does not read every trace?

**Production Reality Check.**
- After a library upgrade, a comparison reports a model's attention kernels as twice as slow. The new library split one kernel into two with different names, and the old name now appears half as often.
- Every rank of a 512-rank job uploads a {{trace_size}} trace in the same minute. The parser backlog grows to nine hours and every other team's summaries miss the 10-minute target.
- On jobs that run compute and communication on separate streams, summed kernel time per step is 40% larger than the step's wall-clock time, and a dashboard shows GPU busy time of 140%.
- A profiler update changes the unit of one event type's duration field, and a week of summaries shows a family of kernels as a thousand times faster before anyone notices.

**Evaluation Criteria.** Asynchronous, chunked ingestion with per-team fairness and back-pressure; one versioned parser per profiler format into a common columnar event model; versioned kernel-name normalisation (families, mapping tables across library versions); interval-union busy time, exclusive time and exposed communication defined precisely; summaries per step and range with warm-up and checkpoint steps marked; comparisons aligned on step and range, normalised by work, with variance shown; partitioned and clustered storage plus precomputed aggregates for cross-trace search; access by owning team; schema checks that catch unit changes; adapts to each incident with diagnosis, recovery and prevention.

## NVD-L4-05: Power and thermal telemetry: rack caps, throttling and job slowdowns

| | |
|---|---|
| **Template ID** | NVD-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Infrastructure telemetry / time alignment, throttling attribution, capping policy |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "racks": {"2": ["300", "800"], "3": ["1,500", "3,000"]},
  "rack_cap": ["40 kW", "70 kW", "120 kW"],
  "sample": ["1 second", "5 seconds", "10 seconds"],
  "headroom": ["5%", "10%"]
}
```

**Business Scenario.** A GPU cluster operator runs {{racks}} racks of GPU nodes. Each rack has a power cap of {{rack_cap}} set by the facility; a node can set a power limit on each GPU, and a GPU lowers its clocks when it reaches its power limit or a temperature limit. Node telemetry, every {{sample}}, gives per-GPU power draw, temperature, clock frequency and a bitmask of the reasons clocks are currently reduced (power limit, thermal limit, hardware slowdown, idle; this exercise's set). The facility's own systems report each rack's measured power once a minute and the inlet temperature at each rack. Training jobs are synchronous: when they start a step, every GPU in the job draws power at once.

**Problem Statement.** Design the power and thermal telemetry platform: ingestion from node and facility sources, time alignment between them, rack- and row-level views, detection of throttling episodes and their reasons, the link from throttling to the jobs that ran on those GPUs and to their slowdown, and the feedback into capping policy (per-GPU limits that keep each rack under its cap with {{headroom}} margin) and capacity planning (how many more nodes a rack or row can take).

**Constraints.** A rack must not exceed its cap for more than a few seconds. Node and facility timestamps come from different clocks and different sample periods; the facility's readings are stamped at the end of each minute. Job slowdown must be stated against the job's own unthrottled step time, not against a guess. Telemetry is kept at full resolution for 30 days and as rollups for two years.

**Assumptions.** All caps, rates and limits are hypothetical, and the throttle-reason set is the exercise's own. Job step times are available from the training observability system, keyed by job, rank and step, with the node and GPU of each rank.

**Clarifications.**
- Q: Who sets per-GPU power limits? | A: Today, a fixed fleet-wide value. Part of your design may be to change that.
- Q: Can more than one throttle reason be active at once? | A: Yes; the bitmask can have several bits set. Decide how you count time per reason.
- Q: Does one throttled GPU slow a whole job? | A: In a synchronous job, usually yes: every rank waits for the slowest one at each collective.
- Q: Can a job be moved to avoid a hot rack? | A: Not while running; the scheduler can take rack power headroom into account when placing new jobs.

**Hints.**
1. Align sources on event time per rack: aggregate GPU power into the facility's one-minute windows, with each window's start and end made explicit, before comparing them.
2. Turn the bitmask into episodes (start, end, reasons) per GPU, then join episodes to the job intervals that held each GPU.
3. For a synchronous job, the slowdown follows the worst GPU in the job, not the average; compare its step times inside and outside episodes.

**Follow-ups.**
1. Estimate the telemetry volume per day at {{sample}} sampling and say what you keep at full resolution.
2. Walk through how you show that a 25% slowdown of one job last night was caused by thermal throttling on 6 of its GPUs.
3. How do you choose per-GPU power limits so each rack stays under {{rack_cap}} with {{headroom}} margin, and how do you measure what that costs in throughput?
4. A large job starts and every GPU in three racks ramps from idle to full power within a second. What does your platform see, and what should the policy do?
5. Facilities wants to add nodes to a row. What evidence does your platform give them, and how confident is it?

**Follow-up rules.**
- when: average, mean, cluster-wide → ask: Forty nodes in one row throttle while the rest of the cluster is fine. What does your cluster-average clock show, and what do the jobs on those nodes experience?
- when: join, timestamp, align → ask: The facility stamps each one-minute reading at the end of the minute and your GPU samples are stamped at the start of each {{sample}} interval. Show me the join.
- when: power cap, power limit, capping → ask: Lowering every GPU's limit keeps racks under the cap but slows some jobs and not others. How do you find out which, before you roll it out everywhere?
- when: alert, alarm, page → ask: A rack is above its cap for four seconds. Who or what acts first, and in what time?
- when: throttle, throttling, clock → ask: The bitmask shows both the power-limit and thermal bits for ten minutes. Which cause do you report, and why?

**Production Reality Check.**
- A large synchronous job starts on three racks. Every GPU ramps from idle to full power within a second and each rack briefly exceeds {{rack_cap}}; the facility raises an alarm, and the next time the job restarts after a failure it happens again.
- A cooling unit fails in one row. Forty nodes throttle for thermal reasons, and jobs spanning those nodes and healthy ones slow by 25%, while the cluster-wide average clock frequency on the dashboard falls by only 2%.
- A join of facility rack power with the sum of GPU power shows racks apparently drawing less power than their own GPUs for several hours a day. The facility's readings are stamped at the end of each minute and the join treats them as the start.
- The fleet-wide per-GPU power limit is lowered so that racks keep {{headroom}} headroom. Some jobs slow by 12%, others not at all, and leadership asks whether the change was worth it and for which jobs.

**Evaluation Criteria.** Separate ingestion for node and facility sources with explicit window semantics and time alignment; rack and row aggregation that respects the facility's interval stamps; throttling episodes with multi-reason accounting; episodes joined to job intervals and to step times, with slowdown measured against the job's own unthrottled steps and driven by the worst GPU in a synchronous job; capping policy evaluated by controlled rollout per job type, with throughput cost measured; awareness of correlated power ramps from synchronous jobs (staggered starts, ramp limits, placement by headroom); retention with rollups; adapts to each incident with diagnosis, recovery and prevention.
