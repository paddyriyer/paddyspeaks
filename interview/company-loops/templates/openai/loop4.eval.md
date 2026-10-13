# OpenAI · Loop 4 — evaluator notes (hidden from candidates)

## OAI-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Producers** in each region emit a typed telemetry event under a data contract: `request_id, project_id, model_family, region, prompt_tokens, completion_tokens, ttft_ms, latency_ms, outcome, event_ts, schema_version`. There are no content fields in the schema. A producer-side allow-list drops any field not in the contract, so content cannot be added by accident.
- **Ingestion**: a regional log (Kafka or a managed equivalent), keyed by `request_id` for usage and by `(model_family, region)` for latency metrics. Ordering per key is enough, and keying by request_id spreads hot projects across partitions.
- **Exact path (usage → billing)**: a stream job deduplicates on `request_id` (state with a TTL longer than the maximum lateness, or an upsert into a keyed table), aggregates per `(project_id, model_family, hour)` in event time, and writes idempotent upserts to a lakehouse table. The daily feed is cut after the lateness bound and corrections are published as adjusting rows.
- **Approximate path (dashboards, alerts)**: per-region stream aggregation into mergeable latency sketches (t-digest, KLL or HDR histograms) per family and region, per 30 s window. Global p95 comes from merging sketches, never from averaging percentiles. Results go to a real-time OLAP store for dashboards and to alerting.
- **Storage**: raw events in object storage (columnar, partitioned by date and region, clustered by request_id), hot for 7 days and colder up to the retention limit. A request_id lookup is served from the clustered lakehouse table plus a small key-value index.
- **Multi-region**: each region aggregates locally. Only aggregates and sketches cross regions; raw data stays put. That keeps the system tolerant to partitions and helps data residency.

**Competing designs to accept.** Flink against Spark Structured Streaming (choose by latency target and team). A warehouse-native ingestion path instead of a lakehouse. A single global cluster, if the candidate prices cross-region traffic and names the failure blast radius.

**Bottlenecks and failure modes.** Hot partitions when the log is keyed by project. Dedup state growth. Percentile errors from averaging. Replay causing double counts. Late data mutating finalised billing. Content leakage through free-text fields.

**Incident guidance.**
- *20× traffic*: scale partitions and consumers (adding partitions remaps keys, so do it ahead of time or use a key-salting plan); shed or sample the approximate path first; protect the exact path; check autoscaling and backpressure.
- *Prompt text in payload*: stop the producer (roll back), quarantine the affected partitions and files, purge from every sink including caches and backups under a documented deletion process, audit who read it, and add a contract test that fails the build on unknown fields.
- *6-hour replay*: request_id dedup makes usage idempotent. Sketches are not idempotent, so recompute the affected windows from deduplicated raw data and republish.
- *Billing mismatch*: compare at the finest shared grain (request_id) to find the missing or duplicated requests; check lateness cut-off and timezone attribution.

**Rubric anchors.** 2: one pipeline for everything, percentiles averaged, no dedup. 3: exact and approximate paths separated, dedup and lateness explained, content stripped. 4: also mergeable sketches across regions, replay-safe correction model, costed storage, crisp handling of every incident.

**Strong signals.** Asks which numbers must be exact before drawing anything; states where exactly-once ends. **Red flags.** Logging prompts "for debugging"; one global consumer group with no regional isolation.

## OAI-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Intake**: the file is uploaded to object storage and gets a content hash. Creating a batch writes a `batch` row (id, project, input file, endpoint, created_at, `expires_at = created_at + 24h`, status). A validation stage streams the file once, checks each line (JSON, endpoint, model, size limits, unique `custom_id`) and either rejects the batch up front with a line-numbered error report, or accepts it and routes invalid lines straight to the error file. Either choice is acceptable if stated and if the customer learns quickly; silently waiting hours before failing is not.
- **State model**: one `request` row per line, keyed by `(batch_id, line_no)`, with status `pending → leased → done | failed | not_run`, attempt count and lease expiry. The batch status (validating, in_progress, finalizing, completed, expired, cancelling, cancelled, failed) is derived from counts, not tracked separately by workers.
- **Scheduling**: requests are split into shards (for example 500 lines) in a durable queue. A global scheduler admits shards into each region's batch queue according to the spare capacity the regional routers report. Order is by deadline slack (time remaining minus estimated remaining work), with weighted fair sharing across projects so one large customer cannot starve others, and work-conserving so idle capacity is never left unused while any batch has work. Batch requests run at a lower priority class on the same fleet; the router admits synchronous traffic first and stops leasing batch shards when synchronous queue wait rises. Long batch generations may be preempted; the request is re-leased and the lost partial generation is an accepted cost (or batch work is restricted to replicas with headroom to avoid preemption).
- **Execution and idempotency**: a worker leases a shard, runs each request and commits the result with a conditional write on `(batch_id, line_no)` (insert-if-absent). A duplicate execution after a lost acknowledgement writes nothing new. Retries only for retryable failures (capacity, timeouts, 5xx) with backoff and an attempt cap; client errors go to the error file at once.
- **Finalizing**: when every line is terminal, or at `expires_at`, the finalizer writes the output and error files from the committed rows. At expiry, leased requests that finish after the deadline are discarded, remaining lines are marked `not_run` (expired) in the error file, and completed results are delivered.
- **Cost accounting**: usage is emitted once per committed result row (prompt and completion tokens), keyed by `(batch_id, line_no)`, at the batch price. The billing feed deduplicates on that key, so retries and duplicate executions cannot double-charge. A reconciliation check compares billed lines with committed result rows per batch.
- **Regions**: shard leases are regional; a region loss lets leases expire and the shards are re-admitted elsewhere unless the project is residency-pinned. Committed results are replicated before acknowledgement.

**Competing designs to accept.** A dedicated batch fleet (simpler isolation, worse utilisation; must be costed). Preemptible priority classes in the serving scheduler versus admission control at the router. A workflow engine per batch, if the candidate shows it scales to the stated batch volume (per-batch workflows at hundreds of thousands a day need care). Rejecting the whole file on one bad line, if validation is fast and the error says which line.

**Bottlenecks and failure modes.** Starvation of small batches behind large ones under FIFO; spare capacity collapsing at peak; duplicate execution and double billing when acknowledgements are lost; finalizer races with late results; validation of very large files becoming its own queue; skew where one region holds most of the backlog.

**Incident guidance.**
- *Peak eats spare capacity*: the scheduler should already be ranking by deadline slack; options are to reserve a small floor of capacity for batches at risk, to borrow capacity from other regions, and to tell customers early (batch status shows progress and an at-risk flag). Expiry delivers partial results and bills only completed lines. Prevention: forecast spare capacity against admitted batch work and use admission control or a capacity floor when the promise is at risk.
- *Lost acknowledgements*: insert-if-absent on `(batch_id, line_no)` keeps one result per line; the billing feed deduplicates on the same key. Find any billed duplicates by joining usage to result rows, issue credits, and add a reconciliation alert.
- *Malformed line*: the customer should have heard within minutes, not hours; either the line goes to the error file and the rest runs, or the batch fails fast with the line number. Prevention: validation is streaming and its latency is monitored.
- *Region loss*: leases expire, shards re-admit in healthy regions (residency permitting), committed results are durable, and the only loss is in-flight generation work. Check that the finalizer does not mark batches complete from a partial view.

**Follow-up guidance.** Push on the key that makes a charge idempotent; on what "fair" means when capacity is scarce; and on whether the candidate knows a preempted generation is wasted work.

**Rubric anchors.** 2: a queue of batches processed FIFO, retries without idempotency, billing from worker events. 3: request-level state, idempotent commits, deadline-aware scheduling, synchronous traffic protected, expiry with partial results. 4: also fairness with work conservation, capacity forecasting against the 24-hour promise, billing reconciliation, and crisp handling of every incident.

**Strong signals.** Treats the line as the unit; asks about the validation policy; knows that spare capacity is the product's supply and plans for its absence. **Red flags.** Batch traffic competing with synchronous traffic at equal priority; charging per batch rather than per completed line; no answer for a duplicate execution.

## OAI-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Run manifest**: every run is defined by an immutable manifest: checkpoint id and hash, suite id and version (dataset hash), prompt template version, decoding parameters (temperature, top-p, max tokens, samples per item), seeds, harness version, grader model and grader prompt version, sandbox image digest. The manifest is the reproducibility record and is stored with every result.
- **Orchestration**: a run expands into a DAG of suite tasks, each split into item shards. Generation and grading are separate stages so grading can be retried or re-done without regenerating. A failed shard is retried; a failed suite is reported as missing and never blocks the others. Results are written per shard, so a preempted suite resumes from completed shards.
- **Scheduling**: a scheduler with a per-run deadline and a weekly budget. It runs short, high-signal suites first (gating and safety suites), packs large suites onto the largest available slices, uses preemptible capacity for resumable work and reserved capacity for the tail near the deadline. Shards are sized so a preemption loses minutes, not hours. Expensive suites can run on a schedule (every second candidate, or only on finalists) by policy decided with research.
- **Caching**: content-addressed. A generation cache key is (checkpoint hash, item hash, prompt template version, decoding parameters, seed, harness version). A grading cache key adds the grader model and grader prompt versions. Change any of them and the key changes, so stale results cannot be served. Greedy generations are reusable; sampled ones only with the same seed and only if the serving stack is deterministic for that setting.
- **Storage**: raw generations and per-item grades in a lakehouse table (partitioned by run), per-suite aggregates in a small relational store for dashboards, and the manifest beside both. Results are append-only; a re-score is a new run linked to the old one.
- **Fair comparison**: the candidate and the baseline must share suite version, harness and grader. If the baseline was scored on an older harness, the platform re-runs the baseline (cached where valid) instead of comparing with history. Reports show per-suite deltas with confidence intervals (bootstrap over items, or paired tests because both models answer the same items), and flag deltas within noise.
- **Cost**: accelerator-hours and grader calls attributed per run, suite and stage; the weekly budget is enforced at admission.

**Competing designs to accept.** A general workflow engine (Airflow-style, Argo-style) versus a purpose-built scheduler, if the candidate handles item-level sharding and resumption. Running grader models on the same accelerators or calling them as a service. Storing results in a warehouse instead of a lakehouse.

**Bottlenecks and failure modes.** Stale cache after a grader or template change; comparisons across harness versions; preemption without checkpointing; long-tail suites missing the deadline; non-determinism from batching and parallel reductions in accelerator numerics, which can change sampled and even greedy outputs; small suites reported without uncertainty.

**Incident guidance.**
- *Template change between runs*: the manifest diff shows it at once if the template version is recorded. Re-run the baseline on the new harness, report the corrected delta, and make the comparison view refuse to compare manifests whose score-affecting fields differ.
- *Stale grader cache*: the grading key lacked the grader version. Invalidate by recomputing keys, re-grade (generations can be reused), and add the grader version to the key plus a test that a changed grader produces a cache miss.
- *Preemption and missed deadline*: resumable shards would have bounded the loss; move gating suites onto reserved capacity; report the missing suites explicitly to the release review rather than letting absence look like a pass.
- *1.5-point spread with identical settings*: the cause is non-determinism (sampling, batch-size-dependent numerics, nondeterministic kernels). Estimate run-to-run variance, report confidence intervals, increase samples or items where the decision depends on it, and pin batch composition where determinism matters.

**Follow-up guidance.** Ask what makes two scores comparable; whether greedy decoding is truly deterministic on accelerators (not guaranteed); and how the candidate would tell research a new suite is too expensive to run on every candidate.

**Rubric anchors.** 2: a job runner that loops over suites, results in a spreadsheet, no manifest or cache key. 3: manifest, content-addressed cache, per-suite isolation, budget and deadline scheduling. 4: also statistical comparison with uncertainty, baseline re-runs on harness changes, resumable shards on preemptible capacity, and precise incident handling.

**Strong signals.** Starts by asking what defines a score; brings up confidence intervals unprompted. **Red flags.** Comparing against historical baselines from a different harness; caching keyed only on checkpoint and suite; treating a missing suite as passed.

## OAI-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Demand metrics**: request arrivals, prompt tokens and requested output tokens per model and region.
- **Supply metrics**: prefill tokens/s and decode tokens/s served per replica, replicas ready per model.
- **Saturation metrics**: router queue depth and queue wait, running batch size against its maximum, KV-cache occupancy and evictions or preemptions, rejected requests.
- **Latency metrics**: TTFT split into queue wait and prefill time, inter-token latency, end-to-end latency, all as histograms (or mergeable sketches) per model, region and node.
- **Health metrics**: accelerator temperature, power and clock throttling, memory (ECC) errors, interconnect errors, driver error events, host CPU and network; collected from the vendor's management library on every node.
- **Pipeline**: a node agent pre-aggregates into histograms at a 10 to 15 second interval. Two tiers: a regional, low-cardinality operational store for alerting and autoscaling (fleet, model, region, node), with recording rules for SLO burn rates; and a long-term store (object storage, columnar) of downsampled metrics for capacity planning. The operational tier runs on separate infrastructure from the fleet and has a cardinality budget enforced at ingestion (label allow-list per metric). Per-request traces are sampled (for example tail-based on slow requests), not collected for all.
- **Autoscaling**: scale up on queue wait and queue depth per replica (and KV-cache pressure) against the TTFT SLO, with predictive scale-up from the demand forecast because replicas take minutes to start; scale down on sustained low occupancy with a longer window and hysteresis. Utilization counters that measure the fraction of time a kernel was running saturate early and are not a saturation signal.
- **Hardware faults**: peer-relative detection: compare each node's tokens/s and TTFT with peers serving the same model at similar load; combine with health counters. A node that crosses thresholds is cordoned, drained (in-flight requests finish), and sent to diagnostics; repeated faults open a hardware ticket. Rate-limit automatic drains so a bad detector cannot empty a region.
- **Capacity planning**: forecast demand in tokens per phase (prefill and decode) per model, not in requests, because cost per request depends on prompt and output length; convert to replicas with measured throughput at the SLO (load tests per model and hardware generation); add headroom for regional failover and launches; produce a range rather than a point estimate.

**Competing designs to accept.** Push versus pull collection; a commercial or open-source time-series store versus a columnar store for both tiers, if the candidate addresses alerting latency; reactive-only autoscaling if the candidate accepts and quantifies the start-up gap; queue-based admission control instead of scaling for short bursts.

**Bottlenecks and failure modes.** Cardinality explosion; the metrics system sharing fate with the fleet; utilization-based autoscaling; averages hiding tail latency; slow nodes that pass health checks; forecasts in requests that miss a change in prompt length mix.

**Incident guidance.**
- *Thermal throttling on eight nodes*: per-node TTFT and tokens/s compared with peers would have flagged them; the health counters show clock throttling. Drain the nodes, check cooling in that rack or row, and add a peer-outlier alert plus a throttling alert per node.
- *Autoscaler never scales*: switch the scaling signal to queue wait and queue depth per replica; add predictive scale-up before known launches; keep utilization as a dashboard metric only.
- *40× series growth*: drop the label at ingestion (allow-list), shed the offending metric, protect the alerting tier; prevention is a cardinality budget checked in CI and enforced by the agent.
- *Long-prompt model shifts the mix*: tokens/s hides that prefill dominates; TTFT decomposition shows prefill time rising. Rebalance replicas, consider separating prefill-heavy traffic, and change the forecast to tokens by phase and model mix.

**Follow-up guidance.** Look for the candidate to distinguish throughput from saturation, to understand why scale-up and scale-down need different signals and windows, and to treat the observability system as something that must survive the incident it is watching.

**Rubric anchors.** 2: CPU-style dashboards and utilization-based autoscaling, averages, no fault detection. 3: queue-based saturation signals, TTFT decomposed, fault detection with drain, cardinality control. 4: also predictive scaling for slow starts, peer-relative outlier detection, two-tier metrics that survive incidents, token-based forecasting by phase and mix, and clean incident handling.

**Strong signals.** Asks how long a replica takes to start; separates prefill and decode. **Red flags.** Tracing every request at full volume; per-project labels on fleet metrics; treating 100% utilization as "needs more nodes".

## OAI-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Classification at write time**: every dataset is registered in a catalogue with a data class (request detail, operational log, aggregate, audit) and a retention tier; tables inherit the strictest tier of their inputs through lineage unless an aggregation step is declared and reviewed to remove identifiers. Every record carries org and project ids; legacy derived tables without them are found by lineage and either rebuilt or put on the shortest tier.
- **Zero-retention tier**: enforced in the serving path: the request handler reads the organisation flag and the telemetry emitter drops detail fields before anything is written (only aggregate counters remain). A canary check samples durable stores for zero-retention org ids and pages if any appear.
- **Retention enforcement**: partitioned by date so most retention is a partition drop. For table formats with time travel, the job deletes, then expires snapshots older than a short window and removes orphaned files, otherwise the data stays readable. Positive monitoring: a daily check that queries the oldest partition per table and alerts if it is older than the tier allows, rather than trusting that the job ran.
- **Deletion workflow**: a deletion request becomes a ledger entry (request id, scope, deadline). An orchestrator fans out to each registered store via lineage: lake tables (row-level delete, then snapshot expiry and file removal), warehouse tables and copies, caches (evict and block re-fill by key), derived tables (delete or rebuild), search indexes. Each step records a verification query proving zero matching rows. Evidence = the ledger entry with per-store verification results and timestamps.
- **Backups**: either keep backups shorter than the deletion SLA, or encrypt request detail per organisation (or per project) and destroy the key on deletion (crypto-shredding), which makes copies in backups unreadable. On any restore, re-apply the deletion ledger before the data is readable.
- **Access audit**: raw-data access only through roles that require a ticket reference; every query logged with who, what dataset and which org or project ids (no content); access reviews and alerts on unusual reads. Audit logs have their own retention and do not hold request content, so they do not conflict with deletion.
- **Cost**: storage dominated by the 30–60 day tier and backups; deletion cost is rewrites of files containing the project (cluster or partition by org to keep rewrites small) and key management. Cuts: shorter operational log tier, sampling of logs, fewer warehouse copies. Do not cut verification or backup handling.

**Competing designs to accept.** Crypto-shredding versus short backup retention (or both). Deletion by rewrite on a schedule (batching deletes daily) as long as the SLA is met. A central policy engine versus per-pipeline configuration if inheritance is enforced in CI.

**Bottlenecks and failure modes.** Time-travel snapshots keeping deleted data readable; lifecycle rules deleting files that table metadata still references (broken tables) or vice versa; copies outside lineage (scratch tables, exports, notebooks); restores resurrecting deleted data; retention jobs failing silently; keys for crypto-shredding shared across tenants in mixed aggregates.

**Incident guidance.**
- *Silent retention failure for 11 days*: run the retention job by hand and verify; make the job resolve tables through the catalogue, not by name; add the positive "oldest partition" check; report the over-retention to the privacy team as policy requires.
- *Scratch-table copy after deletion*: the copy was outside lineage. Delete it, re-run verification across all warehouse schemas by org id, reopen the request, and either block scratch tables from raw classes or give scratch schemas a short default retention and include them in the fan-out.
- *Restore resurrects data*: re-apply the deletion ledger to the restored data before it is readable (or crypto-shredding makes it unreadable); verify; add the ledger replay to the restore runbook and test it.
- *Zero-retention detail written for 6 hours*: roll back, find and delete the affected records in every store including snapshots and backups (or rely on key destruction), notify per policy, and add a contract test plus the canary sampler.

**Follow-up guidance.** Probe on time travel and snapshot expiry, on how backups are handled, and on whether the candidate monitors that old data is absent rather than that a job succeeded.

**Rubric anchors.** 2: TTL rules on buckets and a delete query, no backups or snapshots considered. 3: tiered classification, deletion fan-out via lineage, snapshot expiry, backup strategy, audit trail. 4: also per-store verification as evidence, ledger replay on restore, positive retention monitoring, zero-retention enforced in the serving path, and costed trade-offs.

**Strong signals.** Mentions that row deletes in table formats leave files behind until snapshots expire; asks about copies outside the platform. **Red flags.** "Deleted" meaning a soft-delete flag; proof of deletion being a job's exit code; storing request content in the audit log.
