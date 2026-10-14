# NVIDIA · Loop 3 — evaluator notes (hidden from candidates)

These are simulated practice scenarios for a GPU cluster operator or a team
running training jobs on GPUs. Hardware is described generally; every layout,
code, threshold and number is hypothetical and the exercise's own. Score the
reasoning, not agreement with these notes.

## NVD-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Physical GPUs.** `gpus (gpu_serial, node_id, model, memory_gb, installed_at)`; the node it sits in comes from the inventory as an effective-dated relation, not a column that is overwritten.
- **Layout catalogue.** `layouts (layout_id, name, version)` and `layout_slices (layout_id, position, size_units, offset_units)` with Σ size_units = {{slices_per_gpu}} per layout (or ≤, with unused units listed as unallocatable). A whole GPU is a one-slice layout, so every query works the same way.
- **Layout history.** `gpu_layouts (gpu_serial, layout_id, valid_from, valid_to)` with half-open intervals and no overlaps per GPU (an exclusion constraint or a check in the loader). Reconfiguration gaps are rows with `layout_id = NULL` (or a "reconfiguring" layout) so time is never missing.
- **Slice instances.** `slice_instances (slice_id, gpu_serial, layout_interval_id, position, size_units, valid_from, valid_to)`; `slice_id` is a surrogate created when the layout is applied and never reused.
- **Allocations.** `slice_allocations (allocation_id, slice_id, job_id, team_id, started_at, ended_at)`; invariant: an allocation lies inside its slice instance's interval, and allocations on one slice do not overlap.
- **Samples.** Raw `slice_samples (gpu_serial, position, sampled_at, util_pct, received_at)` keyed by the exporter's label; a resolver joins (serial, sampled_at) to the layout interval and (position) to the slice instance, then to the allocation covering sampled_at, producing `slice_util_resolved (slice_id, job_id NULL, sampled_at, util_pct)`.
- **Rollups.** `gpu_util_hourly (gpu_serial, hour, weighted_util)` = Σ over slices of size_units × mean util (0 for seconds with no sample and no job; 0 for reconfiguration gaps) ÷ ({{slices_per_gpu}} × 3600 s). `team_slice_hours_monthly` from allocations (size_units × hours), not from samples. `layout_hours` from `gpu_layouts`. `stranded_hourly (gpu_serial, hour, stranded_units)`: free units on the GPU during periods when the queue's smallest waiting request was larger than the largest free slice, which needs a queue snapshot table.
- **Late samples.** Resolution uses sampled_at, so a sample arriving after a reconfiguration still lands in the old layout's slice. An hour is provisional until the watermark passes it by 15 minutes; rollups are recomputed for touched hours.

**Competing designs to accept.** One wide fact per slice-second resolved at ingest (fine if the resolver uses intervals and handles late data). A graph-free event-sourced design: layout-applied, allocation-started/ended events with projections. Storing slice instances implicitly as (gpu, layout interval, position) as a composite natural key, if it is never reused across intervals.

**Bottlenecks and failure modes.** Joining samples on (serial, position) without time; utilisation averaged per sample instead of size-weighted per GPU; gaps treated as missing rather than zero; chargeback from samples (sample loss under-bills); overlapping layout intervals after a retried reconfiguration; raw samples at {{sample_seconds}} s × up to {{slices_per_gpu}} slices × {{gpus}} GPUs kept forever.

**Incident guidance.**
- *New job billed to the previous team after a reconfiguration*: the model joined on the exporter label. Contain by freezing chargeback for the affected GPUs, re-resolve samples through layout intervals and slice instances, issue adjustments for the closed period rather than editing it, and add a test that a sample after a reconfiguration resolves to the new slice instance. Note chargeback should come from allocations anyway; samples are only for utilisation.
- *90% dashboard on mostly idle GPUs*: unweighted average over slices that reported. Recompute with size weights and zero for idle slices and gaps; show the old and new number side by side for a release; add a reconciliation that per-GPU busy slice-units ≤ total units.
- *Layout changes on busy GPUs*: the invariant "allocation inside its slice interval" is violated. Detect it with a check on the layout history (layout change inside an open allocation) that pages, roll back the scheduler release, list the killed jobs from the overlap for requeue and credit, and keep the check as a release gate. At {{reconfigs_per_day}} changes a day this check is cheap and should run continuously.

**Follow-up guidance.** (1) Interval join: layout interval containing 14:05 → slice instance at position 1 → allocation covering 14:05. (2) With 4 units: 10:00–10:40 the half is 2 of 4 units at 100% and the quarters idle, i.e. 50% for 40 minutes; 10:40–11:00 whole slice idle, 0% → (0.5 × 40 + 0 × 20) / 60 ≈ 33%. With 8 units the half is 4 of 8 units and the answer is the same. Reconfiguration gaps count as 0. (3) Attribute by sampled_at; hours final after watermark + 15 minutes; late samples trigger recompute of the hour. (4) Raw for days, per-minute per slice for months, hourly per GPU for 13 months; chargeback from allocations. (5) Stranded needs queue snapshots: requested sizes waiting at each minute; per GPU, free units whose largest contiguous free slice is smaller than the smallest waiting request.

**Rubric anchors.** 2: one table of GPU with a current layout column, samples joined on (serial, position), plain averages. 3: layout history and slice instances with never-reused ids, interval joins for samples and allocations, size-weighted utilisation with zeros. 4: also late-sample handling with watermarks, chargeback from allocations with closed-month adjustments, a precise stranded-capacity definition and correct incident handling.

**Strong signals.** Notices immediately that the exporter's position is a label that is reused; states the "allocation inside layout interval" invariant. **Red flags.** Overwriting a GPU's layout; computing utilisation only from slices that sent samples; billing from utilisation samples.

## NVD-L3-02

**Reference architecture (one defensible design).**
- **Assets.** `assets (asset_id, serial, asset_type gpu|node|nic|baseboard|psu, model, received_at)`; the serial is the identity, never the slot.
- **Positions and installations.** `positions (position_id, node_asset_id, slot_type, slot_no)` and `installations (asset_id, position_id, valid_from, valid_to, recorded_at, source work_order|agent, work_order_id)`. Nodes have their own installation in racks (`rack_positions`). Error history, burn-in and failures attach to `asset_id`.
- **Bitemporal corrections.** Either full bitemporal rows (valid_from/valid_to plus recorded_from/recorded_to) or an append-only `installation_records` log from which current belief is derived. A corrected serial closes the wrong record's recorded interval and inserts the right one; "what we believed last week" remains answerable.
- **Firmware.** `firmware_observations (asset_id, component, version, observed_at)` from the node agent, compressed into `firmware_intervals (asset_id, component, version, valid_from, valid_to)` by run-length (a new row only when the version changes; the interval end is extended by heartbeats). `rollout_targets (rollout_id, wave, asset_id, component, target_version, scheduled_at)` and `rollout_results (…, status, reported_version)` record intent and outcome separately.
- **Burn-in.** `burnin_runs (run_id, node_asset_id, attempt_no, started_at, ended_at, outcome, gpu_config_snapshot)` and `burnin_results (run_id, test_name, asset_id NULL, result, metric, threshold)`; never overwritten.
- **Lifecycle.** `node_states (node_asset_id, state received|burn_in|in_service|drained|repair|retired, reason, valid_from, valid_to, set_by)`.
- **Facts.** Failure rate per firmware version = failures on devices running version V ÷ device-days running V (from firmware_intervals), not ÷ devices ever on V. First-attempt pass rate = nodes whose attempt_no = 1 passed ÷ nodes whose first attempt finished in the month. Drain-to-return = intervals in drained/repair ending in in_service, by reason, with still-open drains reported separately (censored).

**Competing designs to accept.** Event-sourced inventory (InstallEvent, RemoveEvent, FirmwareObserved, StateChanged) with projections, if projections are rebuildable and corrections are events. A graph store of components with time-versioned edges. Type 2 dimensions in a warehouse fed from an operational CMDB, if asset and position are separated and observed firmware comes from agents.

**Bottlenecks and failure modes.** Keying history on (node, slot); firmware as a current column set by the rollout tool; burn-in result as a node attribute; corrections that edit history in place; storing every firmware heartbeat at {{nodes}} nodes × {{gpus_per_node}} GPUs × {{firmware_components}} components every few minutes; denominators by device count instead of exposure time.

**Incident guidance.**
- *New GPU inherited the old one's error history*: history keyed on position. Contain by un-draining the wrongly flagged GPU after a manual check, migrate history to asset ids using work orders and agent serial reports, and add a check that every error event resolves to an asset serial reported by the agent at that time. With {{rma_per_week}} returns a week, every week the bug lives misattributes more history.
- *Firmware analysis blamed a version nodes never ran*: firmware came from the rollout plan. Rebuild firmware intervals from agent observations, rerun the analysis, publish the correction, and add a rollout reconciliation (target vs reported) that marks failed updates and alerts.
- *First-attempt pass rate jumped*: retests overwrote results. Restore from logs or backups if possible, otherwise mark the affected months as unreliable; make burn-in runs append-only with attempt numbers and define the metric on attempt 1.

**Follow-up guidance.** (1) installations ⋈ positions where valid_from ≤ D < valid_to (half-open), joined to firmware_intervals on asset and D. (2) Store both records with their sources; the as-of query returns the agent observation when present (physical truth) and flags the discrepancy for a technician; the work order stays for audit. (3) Rate per device-day of exposure, ideally per comparable cohort (same GPU model, similar age), with confidence intervals for short exposures. (4) First attempt failed; burn-in time = first start to passing end; failures attach to the GPU asset that was in the slot during the failing run (from the run's config snapshot), not to the node or to the replacement. (5) Run-length intervals: insert only on change, extend `last_seen_at` in a small mutable table, and close the interval when the version changes or the device disappears.

**Rubric anchors.** 2: a node table with GPU serial columns and a firmware column overwritten. 3: asset/position separation with installation intervals, firmware observations as intervals, append-only burn-in with attempts, lifecycle intervals. 4: also bitemporal corrections, intent vs observed firmware reconciliation, exposure-based denominators and correct incident handling.

**Strong signals.** Asks "is the history about the slot or the part?" early; separates planned from observed. **Red flags.** Editing history to correct a serial; failure rate per version ÷ devices ever updated; burn-in "latest result" only.

## NVD-L3-03

**Reference architecture (one defensible design).**
- **Images.** `images (image_digest, built_at, build_pipeline_run, base_digest)`; `image_components (image_digest, component, version, path, source)` from the build pipeline's component list, stored once per digest. `tag_resolutions (tag, image_digest, resolved_at, resolved_by_run_id)` records what a tag pointed to when a job resolved it.
- **Host stack.** `node_stack_intervals (node_id, component driver|firmware|host_lib:<name>|kernel, version, valid_from, valid_to)`, built from agent reports (observed), with node pool and GPU/interconnect model from inventory as-of.
- **Runs.** `runs (run_id, job_id, attempt, submitted_by_team, code_commit, config_hash, image_tag, image_digest, launch_flags_hash, started_at, ended_at, node_count)`; `run_config (run_id, key, value)` with secret keys excluded by an allow-list (or stored as a hash only).
- **Observed per-node provenance.** `run_node_stack (run_id, node_id, component, version, source image|host|env, loaded bool)` written by a start-up agent that lists loaded libraries and host details. Write is asynchronous (a few KB per node) so job start is not delayed; the run is marked "provenance incomplete" if the agent fails.
- **Performance.** `run_step_metrics (run_id, step, step_time_ms, tokens_per_s, rank_count)` or per-minute summaries.
- **Queries.** Diff = FULL JOIN of the two runs' (component, version) sets, aggregated over nodes (a component with several versions inside a run is reported as mixed). "Runs that used V" = index on (component, version) in run_node_stack, or a per-day summary table (component, version, run_id).
- **Explaining a regression.** Diff stacks, code commit, config, node pool and hardware; if nothing differs, look at placement (topology), co-tenancy, input data and thermal/power events joined by time.

**Competing designs to accept.** A software bill of materials per image in a standard format plus a run record referencing it, if run-time observation is added. Storing the stack as a JSON document per run with a secondary normalised index for component queries. A content-addressed "stack hash" per node to make equality checks cheap, with the normalised rows kept for diffs.

**Bottlenecks and failure modes.** Tags as identities; image manifests as the whole truth; one stack per job when nodes differ; storing component lists per run (duplicates millions of rows instead of referencing digests); synchronous provenance capture slowing job start; secrets captured in environment dumps; at {{jobs_per_day}} jobs a day, per-node rows grow fast, so keep them compact and partitioned by day.

**Incident guidance.**
- *Same tag, rebuilt image*: provenance had only the tag. Contain by reconstructing digests from registry pull logs or tag history if retained; going forward, resolve tags to digests at submit time and store both. Add a check that every run record has a digest. For a {{regression}} regression the digest diff would have shown the library change at once.
- *Mixed driver versions in one job*: the record kept the first node's stack. Store per-node observed stacks, mark runs with mixed versions, exclude or separately analyse them in comparisons, and coordinate upgrades to drain whole pools ({{node_pools}} pools) or pin large jobs to a uniform pool.
- *Host-mounted library changed*: image manifests were identical. Capture loaded libraries at run time (path and version), add host libraries to `node_stack_intervals`, and include them in the diff; alert when a host library change lands without a pool-wide record.

**Follow-up guidance.** (1) FULL JOIN on component of the two runs' aggregated version sets (string_agg of distinct versions), WHERE versions differ or one side is NULL. (2) run_node_stack shows two driver versions; compare step times per node group or exclude; a mixed flag on the run. (3) Each run's tag_resolution row gives the digest; image_components diff explains it. (4) An index or daily partitioned table on (component, version, run_id); avoid scanning documents. (5) Placement and topology, co-located jobs, dataset changes, clocks/power throttling, and what the model lacks (for example thermal events), stated honestly.

**Rubric anchors.** 2: run row with image tag and a free-text "versions" field. 3: digests with component inventory, host stack intervals, per-run observed provenance, normalised diffs. 4: also per-node mixed stacks, tag resolution history, secret handling, non-blocking capture and correct incident handling.

**Strong signals.** Distinguishes declared from observed provenance unprompted; treats a mixed-stack job as a first-class case. **Red flags.** "We store the Dockerfile"; tag-only references; logging all environment variables including secrets.

## NVD-L3-04

**Reference architecture (one defensible design).**
- **Devices and positions.** `devices (device_id, serial, type node|nic|switch, model)`; `device_positions (device_id, position_id, valid_from, valid_to)` where `positions (position_id, rack, slot, logical_name, tier)`; the switch name lives on the position, so a replaced switch is a new device in the same position.
- **Ports and cables.** `ports (port_id, device_id, port_no)`; `cables (cable_id, kind, length)`; `cable_attachments (cable_id, end a|b, port_id, valid_from, valid_to, source tech|discovery, recorded_at)`.
- **Links.** `links (link_id, port_a, port_b, cable_id, valid_from, valid_to)` derived from attachments (two ends of one cable over the same interval) and reconciled with discovery; links between a node adapter and a leaf have tier 0, leaf–spine tier 1, and so on.
- **Reconciliation.** Discovery (port sees peer) is physical truth when the link is up; technician records are intent. A daily job compares them and opens a discrepancy for each mismatch; a constraint (or a check) forbids one port in two overlapping attachments.
- **Link state.** `link_events (link_id or port_id, state up|down, event_ts, received_at, event_key)` deduplicated by (port, event_ts, state); `link_state_intervals (link_id, state, valid_from, valid_to)` derived with ordering by event_ts (late events re-derive the affected window); `link_flaps (link_id, down_at, up_at)` where up − down ≤ 60 s; `port_counters (port_id, device_id, sampled_at, counter, value)` with deltas computed per device (reset-aware).
- **Snapshot.** `topology_current (node_id, nic_no, leaf_position, leaf_device, spine_positions[])` materialised incrementally on every link/position change and published to the scheduler (key-value or in-memory), with a version number.
- **Historical queries.** As-of joins: allocations ⋈ links valid at the allocation time ⋈ flaps during it.

**Competing designs to accept.** A graph database for the current topology with history kept in relational interval tables. A fully versioned graph (edges with valid intervals) in one store, if the scheduler snapshot is still materialised. Event-sourced cabling changes with projections.

**Bottlenecks and failure modes.** Names as keys (replacement merges histories); updating edges in place (history lost); counting flaps from raw at-least-once events; rebuilding the snapshot from raw events nightly; per-pair co-location tables at {{nodes}} nodes (quadratic); trusting technician records over discovery or the reverse without reconciliation.

**Incident guidance.**
- *Cable swap recorded on the wrong ports*: the model accepted the technician record. Contain by marking the affected adapters' leaf mapping as uncertain and excluding them from same-leaf placement; correct from discovery; add the one-port-two-links check and a daily tech-vs-discovery reconciliation that alerts.
- *One flapping port overwhelmed the snapshot rebuild*: the snapshot depended on raw event volume. Rate-limit and summarise flaps per port at ingest (flap intervals and counts), build the snapshot incrementally from topology changes only (flaps do not change topology), and alert on a stale snapshot version. Isolating a port that produces a large share of {{flap_events_per_day}} events is also an operational action.
- *Replaced spine, counters reset, negative rates*: keyed by name. Compute deltas per device_id with reset detection (a drop means a reset: delta = new value), recompute the dashboard, and key counters on device ids.

**Follow-up guidance.** (1) allocations ⋈ topology at allocation time (links valid then) where the node's adapter link or its leaf's uplink is L, and the allocation overlaps [first flap, last flap] on D. (2) Both records stored; discovery wins for physical truth when up; the discrepancy is visible; the scheduler excludes uncertain adapters. (3) Errors "for spine S" aggregate by position across devices, "per device" by device_id; both from the same counter table. (4) Raw events days to weeks, derived intervals and flap rows for months, daily summaries for years. (5) Group nodes by leaf per adapter (an inverted index leaf → nodes); two nodes share a leaf if they appear in the same group — never materialise all pairs; at {{nics_per_node}} adapters per node this is {{nics_per_node}} lookups per node.

**Rubric anchors.** 2: a static edges table updated in place, keyed by names. 3: device/position separation, effective-dated links carried by cables, deduplicated link events with derived intervals, a materialised snapshot. 4: also reconciliation with discovery and impossible-state checks, reset-aware counters, as-of job queries and correct incident handling.

**Strong signals.** Separates cable, link and port without prompting; designs the scheduler snapshot as a separate product of the history. **Red flags.** Switch names as primary keys; flap counts from raw events; a nightly full rebuild as the only path to the scheduler.

## NVD-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH ev AS (                       -- only events that change a node's state
  SELECT e.node_id, e.occurred_at,
         CASE WHEN e.event_type = 'xid' THEN 'fatal' ELSE e.event_type END AS kind
  FROM node_events e
  LEFT JOIN xid_codes c ON c.xid_code = e.xid_code
  WHERE e.event_type IN ('drain', 'resume') OR c.severity = 'fatal'
), seg AS (                        -- a segment starts at each drain or resume
  SELECT node_id, occurred_at, kind,
         COUNT(*) FILTER (WHERE kind <> 'fatal')
           OVER (PARTITION BY node_id ORDER BY occurred_at ROWS UNBOUNDED PRECEDING) AS seg_no
  FROM ev
), segs AS (
  SELECT node_id, seg_no,
         MIN(occurred_at) AS seg_start,
         MAX(kind) FILTER (WHERE kind <> 'fatal') AS opened_by,          -- NULL for the first segment
         MIN(occurred_at) FILTER (WHERE kind = 'fatal') AS first_fatal
  FROM seg
  GROUP BY node_id, seg_no
), win AS (
  SELECT node_id, opened_by, first_fatal AS opened_at,
         LEAD(seg_start) OVER (PARTITION BY node_id ORDER BY seg_no) AS closed_at
  FROM segs
), windows AS (                    -- in service (start or resume) and a fatal error: a window
  SELECT node_id, opened_at, closed_at
  FROM win
  WHERE opened_at IS NOT NULL AND COALESCE(opened_by, 'resume') = 'resume'
), placed AS (
  SELECT a.job_id, a.node_id, na.cluster
  FROM job_allocations a
  JOIN windows w
    ON w.node_id = a.node_id
   AND a.started_at >= w.opened_at
   AND (w.closed_at IS NULL OR a.started_at < w.closed_at)
  JOIN node_assignments na
    ON na.node_id = a.node_id
   AND a.started_at >= na.assigned_from
   AND (na.assigned_until IS NULL OR a.started_at < na.assigned_until)
)
SELECT p.cluster,
       COUNT(DISTINCT p.node_id) AS nodes_affected,
       COUNT(DISTINCT p.job_id) AS jobs_placed,
       COUNT(DISTINCT p.job_id) FILTER (WHERE j.final_state = 'failed') AS jobs_failed
FROM placed p
JOIN jobs j ON j.job_id = p.job_id
GROUP BY p.cluster
ORDER BY p.cluster;
```

**Explanation.** The window is a state machine per node, so the query first keeps only the events that change state: fatal-severity xid events (through the lookup), drains and resumes. A running count of drains and resumes splits each node's timeline into segments; a segment opened by nothing (the start of the data) or by a resume is in service, and its first fatal error opens a window that the next segment's first event (a drain) closes. Fatal errors in a segment opened by a drain are ignored, and an in-service segment with no successor gives a window with `closed_at` NULL (still open). Allocations are joined to windows on node and a half-open range on `started_at`, then to the node's assignment at that instant, and jobs, nodes and failed jobs are counted DISTINCT so multi-node and requeued jobs count once. Windows on one node never overlap, so an allocation matches at most one window.

**Complexity.** One pass over the filtered events per node (a sort for the window functions), a range join of allocations to windows and to assignments (both small per node), then a hash aggregate. In production, filter events by severity first (fatal events are rare), and keep windows as a maintained table updated when a fatal error, drain or resume arrives instead of re-deriving history.

**Dialect notes.** `COUNT(*) FILTER (WHERE …)` and `COUNT(DISTINCT …) FILTER` are PostgreSQL; Snowflake, BigQuery, Spark SQL and MySQL 8 use `SUM(CASE WHEN … THEN 1 ELSE 0 END)` for the running count and `COUNT(DISTINCT CASE WHEN … THEN job_id END)` for the filtered distinct. Snowflake and BigQuery support `LEAD` and running window sums; Snowflake also has `CONDITIONAL_CHANGE_EVENT` and `MATCH_RECOGNIZE`, which can express the state machine directly. MySQL has no `FILTER` and no `NULLS` options but supports window functions from 8.0. None of these variants is executed here.

**Edge cases built into the data.** Warning-severity events (including one just before a fatal error, with a job placed between them); repeated fatal errors inside a window; a maintenance drain with no fatal error; a job starting exactly at the fatal error (counts) and one exactly at the drain (does not); a job running across the fatal error (not placed); a two-node job on two exposed nodes (one job, two nodes). Hard adds resumes: a node that fails, drains, logs a fatal error while drained (opens nothing), resumes (a job placed before its next failure does not count) and fails again (a second window); a maintenance drain and resume followed by a failure; a node that failed and was never drained (open window). Very Hard adds a job requeued onto the same exposed node (two allocations, one job) and a node moved to another cluster during its repair that fails again there (each placement counts in the cluster of its time).

**Common mistakes.** Treating every xid as fatal; an exclusive start or inclusive end; COUNT(*) over allocations; counting jobs that overlapped the window rather than started in it; (Hard+) using MIN(fatal) per node and the first drain after it (misses later windows), letting a fatal error while drained open a window, or an inner join to the next drain (drops open windows); (Very Hard) using `nodes.cluster`. Each has a diagnostic.

**Follow-up guidance.** (1) `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY closed_at − opened_at)` per cluster over closed windows; open windows are censored and should be reported separately (count and current age), not dropped silently. (2) Replace the drain time with the confirmation time from the agent (a `drain_confirmed` event or column), taking the later; the data needs the confirmation event. (3) Maintain a `node_state` row per node and an `exposure_windows` table updated by a stream processor on each fatal/drain/resume; late events re-derive only that node's recent history. (4) Page when a node has an open window older than N minutes with new placements in it, or when placements in windows per hour exceed a threshold; maintenance drains open no window, so they cannot page.

**Rubric anchors.** 2: right shape but MIN(fatal)/first drain only, or COUNT(*) over allocations. 3: matches the expected result at the level asked. 4: also explains confirmation lag, incremental maintenance of windows, censoring of open windows and an alert that ignores maintenance.

**Strong signals.** Describes the node lifecycle as a state machine before writing SQL; asks whether a fatal error while drained matters. **Red flags.** Joining every fatal event to every drain (row explosion and double counting); filtering by `nodes.cluster` without asking about moves; using `ended_at` to decide placement.
