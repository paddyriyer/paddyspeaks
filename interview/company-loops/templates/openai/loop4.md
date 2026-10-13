# OpenAI · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of an AI model
provider. Every workload, number and schema is hypothetical.

## OAI-L4-01: Inference telemetry and usage analytics platform

| | |
|---|---|
| **Template ID** | OAI-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time analytics / stream processing, metering, multi-region |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "daily_events": {"2": ["2 billion", "5 billion"], "3": ["12 billion", "30 billion"]},
  "regions": [3, 5, 8],
  "families": [4, 6, 9],
  "freshness": ["30 seconds", "2 minutes"],
  "retention_days": [30, 90]
}
```

**Business Scenario.** A model API serves {{families}} model families from {{regions}} regions. Every request emits telemetry: model, region, project, prompt and completion token counts, time to first token, total latency and outcome. About {{daily_events}} events arrive per day. Product teams want live dashboards; finance needs token totals that reconcile exactly with billing; on-call engineers need error-rate and p95 latency alerts within {{freshness}}.

**Problem Statement.** Design the platform that ingests these events and serves: (1) token consumption per project, model family and hour; (2) error rate and p95 latency per model family and region with {{freshness}} freshness; (3) a daily usage feed that billing can reconcile against. Cover the event schema, ingestion, stream and batch processing, storage and serving, privacy controls and failure handling.

**Constraints.** Raw telemetry is kept for {{retention_days}} days. Prompt and completion **content** must never reach the analytics platform. Dashboards p95 under 1 second. Usage totals feeding billing must be exact; dashboards may be approximate if labelled.

**Assumptions.** All volumes and SLOs are hypothetical. Each region runs its own inference fleet and can be cut off from the others.

**Clarifications.**
- Q: Can dashboard numbers be approximate? | A: Yes, if labelled; billing totals cannot.
- Q: Is p95 per model family per region or global? | A: Both. Per family per region for alerts, global for the executive view.
- Q: How late can events arrive? | A: Most within seconds; a region recovering from an outage can deliver hours of backlog.
- Q: Does any team need per-request detail? | A: Support needs to look up one request by request_id for {{retention_days}} days.
- Q: Who owns the event schema? | A: The inference platform team; analytics consumes it under a data contract.

**Hints.**
1. Separate the exact path (usage that feeds billing) from the approximate path (latency percentiles, live dashboards). They have different correctness and freshness needs.
2. p95 cannot be averaged across partitions or regions. Think about mergeable sketches.
3. Decide where content is stripped: at the producer, before anything is written.

**Follow-ups.**
1. How do you compute p95 latency per family per region every 30 seconds, and how do you combine regions into a global p95 without shipping raw events?
2. A region is unreachable for 3 hours, then replays its backlog. What do the dashboards show during the outage, what happens to billing, and how do you prevent double counting on replay?
3. Billing's daily total and your dashboard disagree by 0.4% for one project. Walk through how you find out which one is wrong.
4. Your storage bill doubles in a quarter. Where is the money going, and what do you change without breaking the {{retention_days}}-day lookup?
5. A new model family emits a field the schema does not know. How does the platform behave, and who finds out?

**Follow-up rules.**
- when: partition by project, key by project, project_id → ask: One enterprise project sends 30% of all traffic. What happens to the partition and the consumer that owns it?
- when: random partition, round robin → ask: Your usage aggregation needs every event for a request_id handled once. How do you keep that guarantee with random partitioning?
- when: average, mean latency, avg → ask: Why can't the platform average per-partition p95 values to get a global p95?
- when: exactly once, exactly-once → ask: Where exactly does your exactly-once guarantee end, and what makes the billing feed correct beyond that point?
- when: log the prompt, store payload, full request, raw request → ask: The constraint says content must never reach analytics. Where in your design is content removed, and how would you prove it?

**Production Reality Check.**
- Traffic rises 20× within an hour after a launch: from {{daily_events}} per day to that rate times twenty. Consumer lag on the usage topic reaches 30 minutes.
- A deploy adds the full prompt text to the telemetry payload by mistake, and it has been flowing for 40 minutes.
- An upstream bug replays the last 6 hours of events from one region.
- The daily usage feed and the billing system disagree for 1 project in {{regions}} regions.

**Evaluation Criteria.** Separates exact and approximate paths; event-time windows with an explicit lateness policy; mergeable percentile sketches; idempotent usage aggregation keyed by request_id; regional isolation with replay safety; content stripped at the producer under a data contract; costed storage tiers; adapts to each incident with diagnosis, recovery and prevention.

## OAI-L4-02: Batch inference job platform with a 24-hour completion window

| | |
|---|---|
| **Template ID** | OAI-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed job scheduling / batch inference, capacity isolation, metering |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "daily_batches": {"2": ["8,000", "20,000"], "3": ["150,000", "400,000"]},
  "max_requests": ["50,000", "100,000"],
  "idle_share": ["20%", "35%", "50%"],
  "regions": [2, 4, 6]
}
```

**Business Scenario.** A model API offers an asynchronous batch endpoint at a lower price than synchronous calls. A customer uploads a file of up to {{max_requests}} requests (one JSON request per line, each with a customer-chosen `custom_id`), creates a batch against it, and gets back an output file of results and an error file of failed lines. The platform promises a 24-hour completion window; when the window closes, unfinished requests are not run, the batch is marked expired, and the results already produced are still delivered. Around {{daily_batches}} batches are created per day. The inference fleet in {{regions}} regions sizes for synchronous peaks, so roughly {{idle_share}} of its capacity sits idle outside peak hours, and batch work is meant to use that capacity without ever slowing synchronous traffic.

**Problem Statement.** Design the batch platform end to end: file intake and validation, the job and request state model, scheduling onto spare capacity with the 24-hour deadline, retries, partial results and the output files, expiry and cancellation, and cost accounting so each customer is charged exactly once for each request that completed. Say how batch capacity is kept separate from synchronous traffic.

**Constraints.** A synchronous request must never wait behind batch work. Every completed request is billed once and only once, at the batch price; requests that never ran are not billed. Results must survive a worker or region failure. The window is 24 hours from batch creation and does not stretch.

**Assumptions.** All volumes, prices and capacity shares are hypothetical. The output format (one result per input line, matched by `custom_id`) is fixed by the public API; everything behind it is yours to design.

**Clarifications.**
- Q: Do results have to come back in input order? | A: No. Each result line carries the `custom_id`; customers match on it.
- Q: Can a batch be cancelled? | A: Yes. Requests already running finish; the rest are not started; completed results are delivered.
- Q: Is the 24-hour window a hard deadline or a target? | A: Hard. At 24 hours the batch expires; you deliver what finished.
- Q: Can batch work run in any region? | A: Yes, unless the customer's project is pinned to one region for data residency.
- Q: Does a single invalid line fail the whole file? | A: Your call. Say what you choose and why.

**Hints.**
1. Treat the request (batch_id, line number) as the unit of scheduling, retry and billing, not the batch.
2. Spare capacity is a fluctuating supply. The scheduler needs a priority signal that synchronous traffic can preempt, and a notion of how far behind each batch is against its deadline.
3. Billing exactly once is easier if usage is derived from durable result records rather than from worker events.

**Follow-ups.**
1. How does the scheduler decide which batch runs next when spare capacity is short? What do you do with a batch that will clearly miss its window?
2. A worker finishes a request, writes the result, then dies before acknowledging. How do you avoid running and billing it twice?
3. One customer submits {{max_requests}}-line batches all day and would take most of the spare capacity. How do you keep fairness across customers without wasting idle capacity?
4. Synchronous peak lasts longer than forecast and spare capacity drops to zero for most of a day. What happens to the batches already in flight, and what do customers see?
5. How would you price and plan capacity so the 24-hour promise holds for 99.9% of batches, and what metric tells you it is about to break?

**Follow-up rules.**
- when: priority queue, priority, preempt → ask: When synchronous traffic preempts a batch request mid-generation, is the partial work lost? What does that do to your throughput and to billing?
- when: fifo, first in first out, first come → ask: A batch created at 09:00 with 100 lines sits behind one created at 08:55 with the maximum number of lines. Is FIFO still the right order with a 24-hour deadline?
- when: retry, retries, backoff → ask: Which failures do you retry, which go to the error file, and how do you stop a retried request being billed twice?
- when: exactly once, exactly-once, idempotent → ask: Name the key that makes a request's result and its charge idempotent, and where it is enforced.
- when: separate cluster, dedicated fleet, dedicated capacity → ask: A dedicated batch fleet sits idle at night like the synchronous one. How do you justify its cost against borrowing idle synchronous capacity?

**Production Reality Check.**
- A launch keeps synchronous traffic at peak for 14 hours, so the spare capacity batch normally borrows (about {{idle_share}} of the fleet) falls close to zero. At hour 20, 6% of batches created that morning are less than half complete.
- A worker pool loses its result-commit acknowledgements for 40 minutes because of a storage throttle. Requests are retried, and the usage feed shows some requests counted twice for a few customers.
- A customer uploads a {{max_requests}}-line file in which line 31,000 is not valid JSON. Their support ticket asks why nothing ran for 3 hours.
- One of the {{regions}} regions is lost for 2 hours while it holds partly processed requests from about a fifth of the batches in flight.

**Evaluation Criteria.** Request-level state model with idempotent result commits; a scheduler that preempts for synchronous traffic and prioritises by deadline slack with per-customer fairness; explicit validation policy; partial results and expiry handled as first-class states; billing derived once from committed results keyed by (batch_id, line); capacity isolation and regional failure handled; adapts to each incident with diagnosis, recovery and prevention.

## OAI-L4-03: Evaluation platform for model release candidates

| | |
|---|---|
| **Template ID** | OAI-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | ML platform / evaluation orchestration, accelerator scheduling, reproducibility |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "suites": {"2": [40, 80], "3": [200, 350]},
  "candidates": [3, 6, 12],
  "budget": ["3,000", "10,000", "25,000"],
  "deadline": ["6 hours", "12 hours"]
}
```

**Business Scenario.** A model provider runs a fixed set of {{suites}} benchmark suites against every release candidate before it ships: reasoning, coding, safety and regression suites, some scored by exact match, some by executing generated code in a sandbox and some by a grader model. About {{candidates}} candidates arrive per week, and the accelerator budget for evaluation is {{budget}} accelerator-hours per week. Release managers need every suite's result for a candidate within {{deadline}} of the checkpoint landing, and they compare each candidate with the current production model to decide whether it ships.

**Problem Statement.** Design the evaluation platform: how a run is defined and orchestrated, how suites are scheduled onto accelerators within the budget and deadline, what is cached and on what key, how results are made reproducible and stored, and how two releases are compared fairly. Include cost accounting per run.

**Constraints.** A score is only comparable with another if every input that could change it is the same or recorded. Results are kept indefinitely; raw generations for 180 days. Grader-model calls and sandboxed code execution count against the same budget. A failed suite must not block the others.

**Assumptions.** Suite counts, budgets and deadlines are hypothetical. Suites differ by two orders of magnitude in cost.

**Clarifications.**
- Q: Are generations sampled or greedy? | A: Both: some suites sample several times per item and report a mean; others decode greedily.
- Q: Can a run be partially reused from a previous candidate? | A: Only where nothing that affects the score changed. You define that.
- Q: Who adds or changes a suite? | A: Research teams, through a review. Changing a suite must not silently change history.
- Q: Is the grader model fixed? | A: It is versioned and changes a few times a quarter.
- Q: What does the release manager see? | A: Per-suite deltas against production with uncertainty, and a list of anything missing.

**Hints.**
1. Write down everything that defines a score: checkpoint, suite version, prompt template, decoding parameters, seeds, grader version, harness version. That tuple is your cache key and your reproducibility record.
2. Compare a candidate against production on the same harness and suite version; re-run the baseline when the harness changes rather than trusting a historical number.
3. Small suites have wide confidence intervals. A 1-point drop on 150 items may be noise.

**Follow-ups.**
1. Walk through the scheduler: given the budget and {{deadline}}, which suites run first, and what happens when accelerators are short?
2. What exactly is the cache key for a suite result, and what invalidates it?
3. A safety suite shows a 3-point regression on the candidate. How does the platform help someone decide whether it is real?
4. Research wants to add a suite that costs as much as the rest combined. How do you decide whether it runs on every candidate?
5. Two teams report different scores for the same checkpoint on the same suite. Design the platform so this cannot happen silently.

**Follow-up rules.**
- when: cache, cached, memoize → ask: The grader model was upgraded last night. Which cached results are still valid, and how does your key know?
- when: spot, preemptible, preempted → ask: A preemptible pool is reclaimed 70% through a long suite. Do you restart it, resume it, or score what finished?
- when: average, mean score, aggregate → ask: How do you report the uncertainty on that mean, and how many items does a suite need before a 1-point delta means anything?
- when: kubernetes, airflow, dag → ask: What is a node in your DAG, and how does one failed suite avoid failing the run?
- when: baseline, production model, compare → ask: The production model's score was computed four months ago on an older harness. Is the comparison fair?

**Production Reality Check.**
- A candidate drops 4 points on a coding suite. Two days later the cause is found: the harness upgraded its prompt template between the baseline run and the candidate run.
- Grader-model results are served from cache after the grader was upgraded, so a third of the suites in this week's {{candidates}} runs were scored by the old grader.
- A preemptible accelerator pool is reclaimed twice in one night; the run misses the {{deadline}} target and the release review starts with eleven suites missing.
- The same checkpoint scored twice on a 200-item suite differs by 1.5 points with every recorded setting identical.

**Evaluation Criteria.** Run manifest that pins every score-affecting input; content-addressed caching invalidated by any of them; deadline- and budget-aware scheduling with partial failure isolated per suite; checkpointed or resumable suites on preemptible capacity; fair comparison on the same harness with confidence intervals; immutable result storage with lineage; per-run cost; handles each incident with diagnosis, recovery and prevention.

## OAI-L4-04: Observability and capacity planning for a GPU inference fleet

| | |
|---|---|
| **Template ID** | OAI-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Observability / metrics pipelines, autoscaling, capacity planning |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "nodes": {"2": ["1,500", "4,000"], "3": ["12,000", "30,000"]},
  "models": [6, 10, 16],
  "regions": [3, 5],
  "ttft_slo": ["500 ms", "1 second"]
}
```

**Business Scenario.** An inference fleet of {{nodes}} accelerator nodes across {{regions}} regions serves {{models}} models. Each node hosts replicas of one or more models; requests queue at a router, are batched on the node, run a prefill phase over the prompt and then decode tokens one at a time. The service level objective is p95 time to first token under {{ttft_slo}} per model per region. Operators need to know when the fleet is saturated, when a node is quietly failing, how many replicas to add before tomorrow's peak, and how many accelerators to order for next quarter.

**Problem Statement.** Design the observability and capacity-planning system: which metrics are collected per node, per replica and per model; how they are shipped, stored and queried; which signals drive autoscaling; how hardware faults are detected and nodes drained; and how capacity forecasts are produced from the same data.

**Constraints.** Metrics must reach alerting within 30 seconds. The metrics system must stay up when the fleet is in trouble. Per-project labels are not allowed on fleet metrics (cardinality and privacy). Accelerators take weeks to procure, so forecasts drive real purchases.

**Assumptions.** Fleet size, model count and SLOs are hypothetical. Nodes expose accelerator health counters (temperature, memory errors, interconnect errors, throttling) through a vendor management library.

**Clarifications.**
- Q: Is accelerator utilization a good saturation signal? | A: You tell me. The counter most fleets report is the fraction of time a kernel was running.
- Q: Do models share nodes? | A: Some small models share; large models span several accelerators on one node.
- Q: How fast can a replica start? | A: Several minutes, mostly loading weights.
- Q: Who consumes the forecast? | A: The capacity team, monthly, for purchase orders.

**Hints.**
1. Separate demand signals (arrivals, tokens requested) from supply signals (tokens per second served) and from saturation signals (queue depth, queue wait, KV-cache occupancy).
2. A slow node is harder to catch than a dead one. Compare each node with its peers serving the same model.
3. Time to first token mixes queue wait and prefill. Measure both.

**Follow-ups.**
1. Which signal drives scale-up, which drives scale-down, and why not the same one?
2. Replicas take minutes to start. How does that change the autoscaling policy?
3. How do you detect a node that answers correctly but 40% slower than its peers, and what happens automatically?
4. How do you build next quarter's accelerator forecast from these metrics, and what would make it wrong?
5. The metrics store itself is overloaded during the worst incident of the year. What did you design so operators can still see the fleet?

**Follow-up rules.**
- when: gpu utilization, utilization, util → ask: The utilization counter reads near 100% both when batches are full and healthy and when requests are queueing. What signal tells those apart?
- when: per request, per-request, trace every → ask: At this fleet size, what does tracing every request cost, and what do you sample instead?
- when: prometheus, time series, tsdb → ask: Someone adds a per-project label to one histogram. What happens to series count and to the store?
- when: average latency, mean ttft, avg → ask: Why can an average TTFT look healthy while p95 breaches the SLO?
- when: forecast, prophet, linear regression → ask: A new model launches with prompts four times longer. How does your forecast account for a change in mix, not just volume?

**Production Reality Check.**
- p95 time to first token for one model in one region breaches {{ttft_slo}} for two hours while fleet-wide averages look normal. The cause is eight nodes whose accelerators are throttling on temperature.
- The autoscaler, driven by accelerator utilization, never scales up during a launch because utilization was already near 100% at normal load. Queue wait grows to 20 seconds.
- A deploy adds a per-endpoint label to the latency histogram across all {{nodes}} nodes; active series grow 40× and the metrics store starts dropping writes.
- A new model with long prompts takes 30% of traffic in a week. Tokens per second per node look fine, but TTFT breaches the SLO at peak.

**Evaluation Criteria.** Metric taxonomy covering demand, supply, saturation and health; TTFT decomposed into queue wait and prefill; autoscaling on queue-based signals with lead time for slow replica start; peer-relative outlier detection with automatic drain; cardinality budget and a two-tier metrics pipeline that survives incidents; forecasts in tokens by phase and model mix with headroom; adapts to each incident with diagnosis, recovery and prevention.

## OAI-L4-05: Privacy and retention enforcement for telemetry and logs

| | |
|---|---|
| **Template ID** | OAI-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Data governance / retention, deletion, access audit |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "daily_volume": {"2": ["8 TB", "20 TB"], "3": ["90 TB", "250 TB"]},
  "standard_days": [30, 60],
  "backup_days": [35, 90],
  "deletion_sla": ["7 days", "30 days"]
}
```

**Business Scenario.** An AI API platform writes {{daily_volume}} a day of request telemetry and service logs. The data lands in a lakehouse (object storage with table formats that support row-level deletes and time travel), is copied into a warehouse for analytics, is cached in a few serving stores, and is backed up nightly with backups kept {{backup_days}} days. Policy defines retention tiers: operational logs for 14 days, standard telemetry for {{standard_days}} days, aggregated usage (no request detail) for 7 years, and a zero-retention tier for customers whose agreements say request detail must not be stored at all. Customers and the platform can also request deletion of a project's or an organisation's data, to be completed within {{deletion_sla}}.

**Problem Statement.** Design how retention and deletion are enforced across every copy: classification and tagging at write time, retention enforcement per tier, deletion requests that reach the lake, warehouse, caches, derived tables and backups, an access audit trail, and evidence that deletion actually happened. Estimate what it costs and say where you would spend less.

**Constraints.** A deletion is not complete until no readable copy exists, including table-format snapshots kept for time travel. Backups cannot be rewritten record by record. The zero-retention tier must never be written to durable storage. Audit logs are themselves retained and must not contain request content.

**Assumptions.** All volumes, tiers and service levels are hypothetical. Every record carries an organisation id and a project id; some derived tables were built before that rule existed.

**Clarifications.**
- Q: Does a deletion request cover derived aggregates? | A: Aggregates with no request detail and no identifiers are out of scope; anything keyed by the project is in scope.
- Q: How are zero-retention customers identified? | A: A flag on the organisation, read at request time by the serving layer.
- Q: Who can read raw telemetry? | A: Named on-call and support roles, with a ticket reference. Everyone else uses aggregates.
- Q: What counts as proof of deletion? | A: That is part of what you design. Auditors will ask for it per request.
- Q: Can a restore from backup happen? | A: Yes, after corruption. Assume one restore a quarter.

**Hints.**
1. Deleting rows in a table format writes new files; the old files stay readable through snapshots until they are expired and removed.
2. If backups cannot be edited, either keep them short enough to age out within the service level, or make the data unreadable without a key you can destroy.
3. A deletion you cannot list the copies for is a deletion you cannot prove. Start from lineage.

**Follow-ups.**
1. Walk one deletion request for a project from intake to the evidence you hand the auditor. Which systems does it touch, in what order?
2. Your backups are kept {{backup_days}} days and the deletion service level is {{deletion_sla}}. How do you reconcile them?
3. A restore from backup brings back last week's data. How do you stop deleted records coming back to life?
4. How do you make sure a new pipeline written next quarter inherits the right retention tier without anyone remembering to configure it?
5. What does this cost per month, and which control would you weaken first if finance asked for a 30% cut?

**Follow-up rules.**
- when: crypto-shredding, crypto shredding, per-tenant key, encryption key → ask: Where do the keys live, what happens to aggregate tables that mix projects, and how do you prove a key is really gone?
- when: ttl, expire, lifecycle rule → ask: An object-storage lifecycle rule deletes old files, but the table metadata still references them. What do readers and time travel see?
- when: soft delete, tombstone, flag as deleted → ask: How long does the soft-deleted data stay readable, and to whom?
- when: vacuum, expire snapshots, compaction → ask: What retention do you set on snapshots, and what does that cost you in rollback ability?
- when: audit log, access log → ask: Your audit log records who queried which project. How long is it kept, and does keeping it conflict with a deletion request?

**Production Reality Check.**
- The daily retention job for the {{standard_days}}-day tier has been failing silently for 11 days after a table was renamed; nothing alerted.
- A deletion request was marked complete within {{deletion_sla}}, but three weeks later the project's request detail is found in an analyst's scratch table in the warehouse.
- A restore from a backup taken 9 days ago brings back data for two organisations whose deletion completed last week.
- A serving-layer bug writes request detail for zero-retention customers into the operational log tier for 6 hours.

**Evaluation Criteria.** Classification and tier tags assigned at write time and inherited through lineage; retention enforced per tier with positive monitoring (absence of old data is checked, not assumed); deletion workflow across lake, warehouse, caches, derived tables and snapshots, with backups handled by short retention or key destruction and a deletion ledger re-applied on restore; zero-retention enforced in the serving path; access audit with ticket references; per-request evidence of deletion; costed; adapts to each incident with diagnosis, recovery and prevention.
