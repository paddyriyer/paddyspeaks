# NVIDIA · Loop 4 — evaluator notes (hidden from candidates)

These are simulated practice scenarios for a GPU cluster operator. Hardware
behaviour is described generally; the event codes, throttle reasons, slice
layouts and every number are the exercise's own. Do not reward or penalise a
candidate for knowledge of any vendor's specific tools; reward the reasoning.

## NVD-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Collection**: a node agent samples per-GPU counters every {{sample_interval}} (correctable and uncorrectable memory errors, memory locations retired or remapped, interconnect link error counters, temperature, power) and tails the kernel log for driver error events. It sends them with `node_id, gpu_serial, gpu_index, driver_version, boot_id, sample_ts`. Including `boot_id` (or a driver-load id) lets the pipeline compute deltas that survive resets: a delta is `value − previous` within one boot, and `value` itself after a reset, never a negative number.
- **Normalisation**: a versioned mapping from event code to class (`hardware_fatal`, `hardware_degraded`, `application`, `unknown`), owned by the platform team. Unknown codes are kept and counted, not dropped.
- **Job attribution**: the scheduler's job events give, per job, the nodes and GPUs held and the exit reason. For a failed job, the attributor looks for (a) a hardware-class event on one of its GPUs within a window before the failure, (b) the first rank to stop heartbeating or to report an error, (c) link errors on a port the job's nodes share. Only (a), or (b) corroborated by repeated failures on the same node across different jobs, implicates a node. A timeout seen by every rank implicates no one by itself.
- **Detection rules**: stateful rules over the normalised stream, each with an id and a version, for example: any `hardware_fatal` event → drain now; correctable-error rate above R per hour over a day (rate from deltas, not cumulative value) → drain at next job boundary; same node implicated in N distinct jobs' failures in a week → drain at next boundary. Rules run in shadow first; their would-be decisions are logged and compared with outcomes before they are allowed to act.
- **Action layer**: a drain controller that enforces the {{drain_budget}} automatic budget, a rate limit (drains per 10 minutes), and a correlated-cause check: before draining, group candidates by shared switch, rack, power domain, driver version and recent change; if many candidates share one, stop and page a person with the grouping. Drain modes: immediate (fatal) or at the next checkpoint/job boundary (degraded), with a notice to the owners of running jobs. Beyond the budget, decisions queue for human approval.
- **Audit**: every decision writes an immutable record: `decision_id, node, gpus, rule_id, rule_version, the signal values and events that fired it (with their ids), automatic or approved by whom, jobs interrupted, time`. Diagnostics outcome, repair actions and return-to-service are appended to the same node history.
- **Return to service**: diagnostics pass → probation (placed only small or low-priority jobs, tighter thresholds) for 14 days; a recurrence during probation sends it to repair.
- **Measurement**: label each drain later as confirmed bad (diagnostic failure, part replaced, or recurrence within probation) or not confirmed. Precision = confirmed / drained, by rule version. For false negatives, count hardware-confirmed faults found by other routes (repair tickets, diagnostics on scheduled maintenance, a fatal event after the rule should have fired) per node-month. Report both with the uncertainty from the diagnostic suite's own miss rate, estimated by re-testing a sample of passing nodes or by recurrence rates.

**Competing designs to accept.** A learned model (gradient-boosted trees or similar) over the same signals, if the candidate supplies labels, explanations per decision and the same action limits. Per-GPU drains for small jobs and per-node drains for large ones. A streaming engine versus a time-series database with periodic rule evaluation, if the five-minute fatal-event target holds.

**Bottlenecks and failure modes.** Mass drains from a fleet-wide change; blaming every node in a failed job; counter resets hiding fast-growing errors; diagnostics that miss intermittent faults inflating apparent false positives; drains that kill large jobs right before a checkpoint; unknown event codes silently ignored.

**Incident guidance.**
- *Driver update makes a harmless code fire everywhere*: the budget and the correlated-cause check should stop it after a few drains; group candidates by driver version and page the driver owners. Recover: mark the code as `application` or `benign` for that driver version in the mapping (a new mapping version), undrain nodes drained by it. Prevent: any mapping or rule change and any driver rollout runs in shadow first; alerts on drain proposals per hour.
- *Four drains, all healthy, one flapping link*: attribution by "a node in the failed job" is wrong. Recover: undrain, look at link error counters on ports shared by the four jobs, take the port out. Prevent: require hardware evidence or repeat failures across different jobs for a node to be implicated; add link and switch-port counters to attribution; a rule that groups failures by shared fabric component.
- *Errors hidden by nightly resets*: rules used cumulative values. Fix: deltas within a boot id; a rate rule over a rolling window; backfill the rate for the fleet to find other such GPUs, and quarantine the checkpoints written from that GPU's job (verify them).
- *40% of drains pass diagnostics*: it is a measurement problem first. Split by rule version and by signal: which rules have low confirmation? Use probation recurrence rates to estimate how many passes were intermittent faults. Adjust thresholds per rule with that evidence, and propose longer or stress-based diagnostics where intermittent faults dominate.

**Follow-up guidance.** Push on how a timeout on all ranks becomes (or does not become) a node blame; whether the budget still lets a genuine wave of bad hardware be handled (human approval, not a hard stop); and what the audit record contains.

**Rubric anchors.** 2: thresholds on raw counters and automatic drains with no limits or audit. 3: deltas that survive resets, event-code classes, versioned rules, a drain budget with human approval, an audit record, some attribution logic. 4: also shadow rollout with measured precision per rule version, correlated-cause grouping, checkpoint-aware drains, probation and false-negative measurement that accounts for the diagnostics' own misses, and crisp handling of every incident.

**Strong signals.** Asks what ground truth exists before proposing a model; treats automation's blast radius as a design requirement. **Red flags.** "Drain on any error"; a model with no labels or explanations; no limit on automatic action; blaming all nodes in a failed job.

## NVD-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **What each rank measures**: per step, durations from its own monotonic clock: compute (forward, backward), wait in each collective (grouped by communicator: data-parallel group, tensor-parallel group, pipeline send/recv), data-loader wait, optimiser, checkpoint. Plus `job_id, rank, dp_index, tp_index, pp_stage, node_id, gpu_index, step`. Timing uses events recorded around operations without forcing a device synchronisation on every step; reading them is deferred or done every N steps so the {{overhead}} budget holds.
- **Volume**: the largest job: {{ranks}} ranks × roughly 10 numbers per step, one step every {{step_time}}; across {{jobs}} jobs this is millions of numbers per second at peak. Too much to keep raw forever, fine to aggregate.
- **Aggregation**: each node agent buffers its ranks' records and ships them asynchronously (never in the step's critical path). A job-level aggregator (or a stream job keyed by job id) computes per step, per role group (ranks with the same pp_stage and tp_index): min, median, max of each phase, and which rank holds min collective wait and max compute. Store: per-step role-group summaries for the life of the job; full per-rank records for 1 step in 50 and for windows around anomalies (triggered by the aggregator), for a few days.
- **Straggler detection**: within a role group, a straggler is a rank whose compute (or data wait) is persistently above the group median by a margin and whose collective wait is near the group minimum; persistence over K of the last M steps avoids flagging noise. Attribution: join stragglers to node, switch and storage target from inventory; if slow ranks share a switch or a storage mount, report that component instead of the ranks. Data-loader stragglers are labelled as input-bound, not as hardware.
- **Timelines**: cross-rank timelines use per-node clock offsets estimated from a sync exchange (or from the collectives themselves), with uncertainty shown; durations, not absolute timestamps, drive detection.
- **Baselines and comparison**: per job, a baseline of step-time distribution per phase from its first healthy hours (excluding warm-up and checkpoint steps); regressions compare with the job's own baseline and with earlier runs of the same configuration.
- **Alerts**: to the job owner first (step time above baseline by X% for Y minutes, straggler named, suggested action: restart without node N); to the cluster on-call only for hardware-implicated stragglers. The telemetry agent's own cost (time spent in the agent per step) is itself a metric with an alert.

**Competing designs to accept.** Shipping per-rank data to a time-series database with job-level recording rules, if cardinality is estimated and controlled. Heavy-weight profiler sampling instead of continuous per-rank metrics, if detection within 100 steps is still met. Automatic node exclusion on restart, if gated by hardware evidence and owner opt-in.

**Bottlenecks and failure modes.** Per-rank metric cardinality in a metrics store; synchronous metric flushes inside the step; comparing ranks with different roles; clock skew in timelines; data-loader or storage effects misread as hardware; missing reports from the node that is in trouble (absence is a signal).

**Incident guidance.**
- *30% slower, everyone waiting, network blamed*: the tool showed the symptom (wait) not the cause. Find the rank with least wait or most compute in each role group; check its GPU clocks and throttle reasons. Prevent: the dashboard leads with "rank with least wait" and the straggler panel, not the average wait.
- *Agent update costs 4%*: roll back; make flushing asynchronous and batched; measure the agent's per-step time and alert when it exceeds a share of {{overhead}}; canary agent updates on a few jobs with step-time comparison.
- *Last pipeline stage always flagged*: comparison across roles. Fix: compare within role groups only; baseline per stage.
- *Slow shared storage blamed on nodes*: data wait spikes on many ranks across many nodes; group by storage target and label as input-bound. Undrain the healthy nodes; alert storage owners; consider prefetch depth.

**Follow-up guidance.** Ask for the volume arithmetic, and for how the least-wait rule works when two ranks straggle alternately. Strong candidates mention that the straggler may be in a different parallel group than the ranks showing the wait.

**Rubric anchors.** 2: average step time per job on a dashboard, profiler on demand. 3: per-rank phase durations, straggler by least wait or most compute, aggregation with volume estimate, overhead considered. 4: also role-group comparison, topology-aware attribution (node, switch, storage), anomaly-triggered full fidelity, measured telemetry cost with canaries, clock-aware timelines, and crisp handling of every incident.

**Strong signals.** Explains why high collective wait points away from the waiting rank. **Red flags.** Per-rank labels in a metrics store with no cardinality estimate; synchronous telemetry in the step; "alert when step time is high" with no attribution.

## NVD-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Sources**: scheduler events (`submit, start, preempt, checkpoint, end` with job, team, GPUs or slices, GPU model, priority class, borrowed flag); quota grants as effective-dated records (`team, gpus, model, valid_from, valid_to, recorded_at`); node availability (in service, drained, maintenance) per interval.
- **Ledger**: append-only allocation intervals `(job_id, team, resource_units, gpu_model, start, end, end_reason, borrowed)`, where resource units weight slices (for example by their share of the GPU's memory and compute, a weighting agreed with the teams and versioned) and GPU models by an agreed factor. Hourly buckets are a projection: per team, used units, split into within-guarantee and borrowed; per cluster, idle and unavailable. Reconciliation check per hour: Σ used + idle + unavailable = capacity.
- **Definitions** (one defensible set): promised(t) = the team's guarantee in effect at t. Demand(t) = units held by the team's running jobs + units requested by its queued, eligible jobs. Delivered(t) = units the team held, capped at its guarantee. Unmet(t) = max(0, min(promised, demand) − delivered). Borrowed = units held above the guarantee. Lent = guarantee units the team did not need that others used. Lost = units × time between a preempted job's last checkpoint and its preemption. A team with no demand has no unmet guarantee.
- **Decayed usage**: U(t2) = U(t1) · 2^(−(t2 − t1)/{{half_life}}) + usage in (t1, t2], updated at a fixed tick (for example each minute) by one shared, versioned library used by both the scheduler and the reporting job; snapshots of U per team at each tick are persisted, so a past priority is a lookup, not a recomputation. Reproducibility: fixed tick, fixed order of operations, decimal or fixed-point arithmetic.
- **Reports**: per team per {{period}}: promised, demand, delivered, unmet, borrowed, lent, lost, utilisation of what was held (from GPU telemetry), all from the ledger. Chargeback for a closed period is frozen; later corrections (including backdated quota changes) are issued as adjustments in the next period with a note, never as a silent restatement.
- **"Why did my job wait?"**: from snapshots of the queue at each scheduling cycle: the job's position, the team's priority and decayed usage at that moment, capacity free, and which jobs started ahead of it and why (better priority, fit, reservation for a large job).

**Competing designs to accept.** Delivered measured as GPU-hours used (not capped at guarantee) with unmet reported separately; demand measured from queued jobs only at submission; charging lost work to the borrowing team or to the owner whose return caused it, if stated and agreed. Recomputing decayed usage from the ledger instead of snapshots, if it is proved bit-identical to the scheduler.

**Bottlenecks and failure modes.** Definitions that report a guarantee met when the team had no work, or unmet when it did not ask; double counting slices; reports that disagree with the scheduler's priorities; mass preemption overloading shared checkpoint storage; restated closed periods.

**Incident guidance.**
- *60% versus 100%*: the report measured allocation, not delivered work. Recover: recompute delivered with lost work after the last checkpoint separated, and show held-but-idle time from utilisation telemetry; agree the definition with the teams. Prevent: report delivered, lost and utilisation separately, with the definitions on the report.
- *Decayed usage rebuilt from zero*: restore from the latest persisted snapshot and replay the ledger since; make the scheduler load state from snapshots at start and refuse to schedule with a cold state (or start from the report's last snapshot). Prevent: a check that compares the scheduler's live U with the reporting job's U every hour.
- *Backdated quota change rewrites invoices*: revert the closed period, issue an adjustment in the current one, notify finance and the teams. Prevent: closed periods are immutable; backdated grants affect future priorities and produce adjustments only.
- *Mass preemption, checkpoints fail*: stagger preemptions (preempt only as many borrowed jobs as the owner's job needs, in priority order), extend or scale the grace period with the checkpoint size, and rate-limit checkpoint storms; measure lost work per preemption event and feed it into the lending policy.

**Follow-up guidance.** Make the candidate compute one team-day by hand; strong candidates find the demand-awareness issue without prompting. Ask how the scheduler and report stay in agreement.

**Rubric anchors.** 2: GPU-hours per team from job start and end times; no demand, no reconciliation. 3: interval ledger, demand-aware delivered, slice weighting, decayed usage with snapshots, frozen periods. 4: also hourly reconciliation including unavailable capacity, a shared versioned decay implementation proved equal to the scheduler's, wait explanations from queue snapshots, lost work measured and charged by an agreed rule, and crisp handling of every incident.

**Strong signals.** Writes definitions before tables; asks who agrees the weighting. **Red flags.** "Delivered = allocated"; recomputing priorities differently from the scheduler; editing closed invoices.

## NVD-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Upload**: the job's tooling uploads trace files to object storage with a manifest (`job_id, rank, step_range, stack versions, profiler version, team`), then posts a parse request. A queue per team with weighted fair scheduling across teams, so one 512-file upload cannot starve the rest; parsers are stateless workers that autoscale on queue depth, and each file is parsed independently.
- **Parsing**: one parser per profiler format version, chosen by the manifest, emitting a common event model in a columnar table: `trace_id, rank, device, stream, kind (kernel, memcpy, api, collective, range), name, family, start_ns, end_ns, range_path, step`. Schema checks per parser version (for example, the ratio of summed kernel time to trace span, and durations in plausible ranges) catch unit changes before data is published.
- **Name normalisation**: a versioned normaliser maps raw kernel names to a family (demangle, strip template arguments and tile sizes, apply a mapping table maintained per library version, so `kernel_a_v1` and its replacement split `kernel_a_part1 + kernel_a_part2` map to the same family). Every summary records the normaliser version.
- **Summaries per trace**: per step and per annotated range: wall time; GPU busy time as the union of intervals on all streams; per-kernel-family total time, count and duration percentiles; exclusive time (when only that family runs); exposed communication time (collective time not overlapped by compute); idle gaps. Warm-up steps and checkpoint steps are marked and excluded by default.
- **Comparison**: align the two runs on step and range path; normalise by work (tokens or samples per step) when batch sizes differ; report the change per range first, then per kernel family within the ranges that changed, using medians over steps with a spread (min–max or a bootstrap interval); flag differences smaller than the run-to-run variance as not significant.
- **Storage and search**: raw traces in object storage for {{retention}}; the event table partitioned by date and team and clustered by family; precomputed per-trace, per-family aggregates in a small table kept longer, which answers cross-trace queries without reading events.
- **Access**: traces and summaries inherit the owning team's permissions; cross-team search returns only traces the user can see.

**Competing designs to accept.** Loading events into an analytic database instead of files in object storage, if load time per day is estimated. Critical-path analysis instead of exclusive time. Keeping only summaries and discarding raw traces sooner, if the user accepts losing re-analysis.

**Bottlenecks and failure modes.** Burst uploads; summed durations over overlapping streams; kernel renames across versions; unit changes in the profiler format; comparisons over different step mixes; per-event row stores that cannot load the volume.

**Incident guidance.**
- *Attention kernels "twice as slow"*: a rename and split, not a regression. Recover: add the mapping to the normaliser for the new library version and rerun the comparison at family level. Prevent: a comparison warns when families appear or disappear between runs and shows range-level totals first, which are unaffected by renames.
- *512 files, nine-hour backlog*: per-team fair queues and parse concurrency limits per job; autoscale parsers; parse a few ranks first and give a provisional summary within the target, then the rest.
- *140% busy*: summed per-stream time was reported as busy. Fix: interval union per device; show overlap explicitly as a separate metric.
- *Unit change*: quarantine the affected week's summaries, add the parser for the new profiler version, re-parse from raw, and add range checks that block publishing when ratios move by orders of magnitude.

**Follow-up guidance.** Ask the candidate to define busy, exclusive and exposed communication on a small example with two overlapping streams; ask how the comparison avoids calling noise a regression.

**Rubric anchors.** 2: upload, parse into a database, show total time per kernel name. 3: columnar event model, interval-union busy time, normalised names, per-range summaries, comparison aligned on steps. 4: also versioned normaliser with library mapping tables, work-normalised comparisons with variance, fair burst handling, precomputed aggregates for search, schema checks on parser output, and crisp handling of every incident.

**Strong signals.** Raises overlap and renames before being asked. **Red flags.** Summing durations; comparing raw kernel names across versions; one global parse queue.

## NVD-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Ingestion**: node agents send per-GPU samples every {{sample}} (`gpu_serial, node_id, sample_start, power_w, temp_c, clock_mhz, throttle_mask`); facility systems send per-rack one-minute readings (`rack_id, window_end, power_kw`) and inlet temperatures. Two separate streams and raw tables; facility readings are converted to explicit `[window_start, window_end)` at ingestion.
- **Alignment**: rack power from GPUs = sum over the rack's GPUs of power samples, integrated into the facility's one-minute windows (energy per window, then average power), plus an estimated non-GPU share per node. Comparing these per window gives both a check on the facility data and the non-GPU baseline. Node clock skew is small relative to a minute; it matters for second-level peaks, where only node data is used.
- **Peaks**: the cap is about seconds, so second-level rack sums from node samples are kept for 30 days (at coarser {{sample}} values, note that short peaks are invisible and say so); alerts on rack sum above cap minus margin.
- **Throttling episodes**: per GPU, consecutive samples with any non-idle throttle bit form an episode `(gpu, start, end, reasons_seen, time_per_reason)`; with several bits set, time is counted per reason and also as "combined", rather than choosing one silently. Episodes are joined to job intervals (from the scheduler) on GPU and time.
- **Job slowdown**: for each job, step times from the training observability system; a step is affected if any of the job's GPUs was in an episode during it (synchronous jobs follow their slowest GPU). Slowdown = median affected step time / median unaffected step time for that job and configuration, with counts. Reported per job and per cause.
- **Capping policy**: per-GPU limits computed per rack so the expected peak (from history of synchronous ramps) stays under {{rack_cap}} minus {{headroom}}; rolled out by job type or rack with a control group, and the throughput cost measured as slowdown per job class. The scheduler gets rack headroom as a placement input, and large jobs ramp up in stages (staggered start of ranks or a power ramp limit) to avoid simultaneous peaks.
- **Capacity planning**: per rack and row, distribution of one-minute and peak-second power over weeks; headroom at the 99.9th percentile; what-if: adding N nodes of a given profile.
- **Retention**: full resolution 30 days; one-minute rollups (min, mean, max, percentiles) and episode tables for two years.

**Competing designs to accept.** A time-series database for samples and a warehouse for joins and reports; per-job power limits instead of per-rack ones; dynamic capping by a controller instead of static limits, if its stability and failure modes are considered.

**Bottlenecks and failure modes.** End-of-window stamps joined as start; averages hiding local throttling; second-level peaks invisible at coarse sampling; synchronous ramps; multi-reason bitmasks collapsed wrongly; fleet-wide policy changes without measurement.

**Incident guidance.**
- *Synchronous ramp over the cap*: immediate: lower per-GPU limits on those racks or stagger the job's restart. Prevent: ramp limits or staggered rank starts for large jobs; placement by rack headroom; an alert on second-level rack sums; the restart path uses the same staggering.
- *Thermal throttling hidden by the average*: show distributions and the worst racks, not cluster means; join episodes to jobs and report the jobs' slowdown; page facilities for the row's cooling; the scheduler avoids placing large jobs in a thermally degraded row.
- *End-of-minute stamps treated as start*: shift facility windows by one minute in the join; add a validation that compares rack power with the GPU sum per window and alerts when the facility value is persistently below it.
- *Fleet-wide power limit, mixed slowdown*: compare slowdowns per job class against a control group; communication-bound or input-bound jobs barely slow, compute-bound ones do. Recommend per-class or per-rack limits and quantify power saved against throughput lost.

**Follow-up guidance.** Ask for the alignment arithmetic and for how slowdown is computed for a synchronous job with 6 throttled GPUs out of many.

**Rubric anchors.** 2: dashboards of average power and temperature per rack. 3: aligned node and facility data with explicit windows, throttling episodes joined to jobs, slowdown against the job's own steps, a capping policy with headroom. 4: also second-level peak handling for synchronous ramps, multi-reason accounting, controlled rollout of capping with measured throughput cost, placement and capacity planning from distributions, and crisp handling of every incident.

**Strong signals.** Notices that synchronous jobs correlate power across thousands of GPUs and that the slowest GPU sets the pace. **Red flags.** Averages everywhere; joining sources without stating window semantics; lowering limits fleet-wide without measuring.
