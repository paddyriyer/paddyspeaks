# Together AI · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a cloud for
open models: fine-tuning jobs on uploaded datasets, dedicated endpoints billed per
minute per running replica, several LoRA adapters sharing one endpoint, serverless
inference across many open models metered per model and tenant, and an open-model
catalogue with versions and deprecations. Every price, capacity, limit, volume,
timing and notice period is hypothetical and this exercise's rule (check current
docs), and nothing here describes the company's customers, hardware, capacity or
how its own systems are built.

## TGA-L4-01: Per-tenant latency on shared serverless models — time to first token, throughput, noisy neighbours and honest percentiles at low volume

| | |
|---|---|
| **Template ID** | TGA-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant observability / per-tenant latency, interference attribution, mergeable sketches, small samples |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "tenants": ["4,000", "15,000", "60,000"],
  "models": {"2": [40, 80], "3": [150, 250]},
  "peak_rps": {"2": ["5,000", "15,000"], "3": ["80,000", "200,000"]},
  "min_requests": [20, 50, 100]
}
```

**Business Scenario.** A serverless inference service runs {{models}} open models that {{tenants}} tenants share. Each model is served by a pool of replicas, and each replica batches requests from many tenants together as they arrive (described generally). At peak the service handles about {{peak_rps}} requests per second. For every request the servers can record the tenant, the model version, input and output token counts, time spent queued, time to first token, generation time after the first token, the outcome and the replica that served it. Tenants want to see their own latency on each model; the platform team wants to know when one tenant's traffic is slowing everyone else on a model, and what to do about it. A percentile for a tenant is shown only when the window holds at least {{min_requests}} of that tenant's requests (this exercise's rule; check current docs).

**Problem Statement.** Design per-tenant latency monitoring. Cover where each timing is measured and what exactly it includes; the event and its schema; aggregation per tenant, model version and minute, and how longer windows and the model-wide view are built from it; the tenant-facing console and API; how percentiles stay honest when a tenant has few requests; how a noisy neighbour is detected and attributed (which tenant, which model, what about its traffic); the actions the platform can take once one is found; alerts; retention; and how one tenant is kept from ever seeing another tenant's numbers.

**Constraints.** A tenant sees its own requests and, at most, the model-wide aggregate across all tenants; never another named tenant. Tenant views are fresh within one minute. Percentiles are never averaged across minutes, replicas or tenants. Below the {{min_requests}}-request floor the view shows counts and a stated reason, not a percentile. Prompts and outputs never enter the monitoring path; only counts and timings do.

**Assumptions.** Tenant counts, model counts, request rates and the floor are hypothetical. Servers have synchronised clocks; client-side timings are not available unless a tenant sends them. Batching and scheduling on a replica are described generally; you may assume the server can report, per replica and per second, which tenants' requests were in flight and how many input tokens each was processing.

**Clarifications.**
- Q: Is time to first token measured on the server or the client? | A: The server, from when the request was accepted to when the first token was sent. Say what that leaves out and how a tenant should read it.
- Q: Does throughput mean tokens per second for the request or for the replica? | A: For the tenant: output tokens per second for a request, measured after the first token. Replica throughput is a platform metric.
- Q: Can the platform limit one tenant's traffic? | A: Yes, by this exercise's per-tenant limits per model; you decide when a limit changes and who is told.
- Q: Do tenants want per-request detail? | A: They can look up their own requests by request id for a short retention period; the console shows aggregates.
- Q: How many tenants are tiny? | A: Most tenants send a few requests a minute to any one model; a few send thousands a second.

**Hints.**
1. Split time to first token into queue time and prefill time; interference from a neighbour shows up first in queue time, a tenant's own long prompts in prefill.
2. Keep one mergeable sketch per tenant, model version and minute, plus exact counts; every coarser view is a merge of sketches.
3. A noisy neighbour is a claim about cause. Record what each replica was doing per second so the claim can be checked, not only correlated.

**Follow-ups.**
1. A tenant with 12 requests in the last hour asks for its p99 time to first token. What does the console show, and why?
2. Time to first token for most tenants on one model doubles for 20 minutes. Walk through how you find whether one tenant caused it, and what evidence you would show.
3. You decide to cap a tenant's concurrency on a model. How is that decided, applied and communicated, and how do you check it helped the others without hurting that tenant more than needed?
4. How do you merge per-replica, per-minute data into a tenant's hourly p95 and a model-wide p95 at {{peak_rps}} requests per second without shipping every request?
5. A tenant says your numbers are better than what their users experience. How do you help them reconcile the two?

**Follow-up rules.**
- when: average, mean, avg → ask: Why can't you average per-minute p95 values to get a tenant's hourly p95, and what do you store instead?
- when: p99, percentile, percentiles → ask: A tenant sent 30 requests this hour. How many of them sit above its p99, and what does that number tell them?
- when: t-digest, sketch, hdrhistogram, ddsketch → ask: What error does your sketch guarantee at p99, and is that error the same for a tenant with 40 requests as for one with 4 million?
- when: rate limit, throttle, concurrency limit, quota → ask: The tenant you limited is paying for the traffic. What do you tell them, and what do you offer instead?
- when: correlation, correlated, anomaly → ask: Two tenants' traffic rose at the same moment the latency did. How do you decide which one, if either, caused it?

**Production Reality Check.**
- One tenant starts sending long-context requests in bursts and accounts for 30% of one model's input tokens; time to first token p95 for every other tenant on that model rises from 0.4 s to 3 s for 20 minutes, mostly as queue time.
- A tenant's console shows a p99 time to first token of 14 s computed from 9 requests, below the {{min_requests}}-request floor, because the API path that feeds the console skipped the floor; the tenant escalates to their account team.
- During a traffic peak near {{peak_rps}} requests per second the aggregation pipeline falls 25 minutes behind; when it catches up, latency alerts fire for hundreds of tenants at once for a period that has already ended.

**Evaluation Criteria.** Server-side stages measured separately (queue, prefill to first token, generation) with honest labels about what each includes; one event per request with counts and timings only; exact counts plus mergeable sketches per tenant, model version and minute, with coarser views built by merging; a stated low-volume rule (floor, wider windows, counts and an interval instead of a point percentile); noisy-neighbour detection that attributes cause from per-replica records of what was in flight, not from correlation alone; proportionate actions (per-tenant limits, fair queuing, isolation, a dedicated endpoint offered) with communication; tenant scoping by construction in every query path; alerts on event time with lag awareness; adapts to each incident with diagnosis, recovery and prevention.

## TGA-L4-02: Dedicated endpoint autoscaling and billing — replicas between a minimum and maximum, per-minute billing per running replica, and idle cost the customer can see

| | |
|---|---|
| **Template ID** | TGA-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Autoscaling control loops / replica lifecycle events, minute-level metering, idle cost reporting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "endpoints": {"2": ["1,500", "5,000"], "3": ["20,000", "50,000"]},
  "max_replicas": [4, 8, 16],
  "idle_minutes": [5, 10, 20],
  "load_minutes": [3, 6, 12]
}
```

**Business Scenario.** Customers run {{endpoints}} dedicated endpoints, each serving one model on replicas that only that customer uses. Each endpoint has a minimum and a maximum replica count (the maximum here up to {{max_replicas}}). A new replica takes about {{load_minutes}} minutes to start and load the model before it can serve; a replica above the minimum is removed after {{idle_minutes}} minutes with no requests in flight. By this exercise's rule (check current docs), each replica is billed for every UTC minute from the minute it starts until the minute it stops, each started minute in full. Customers want endpoints that keep up with their traffic, a bill they can check minute by minute, and to know how much of what they pay for sat idle.

**Problem Statement.** Design autoscaling and billing for dedicated endpoints. Cover the signals the autoscaler uses and the decision rule (scale up, scale down, stay); how load time is accounted for so the endpoint neither falls behind nor flaps; the replica lifecycle events (requested, starting, ready, draining, stopped) and who emits them; metering from those events into billed replica-minutes per endpoint and day; reconciliation of the meter with the replicas that actually exist; idle cost (replica-minutes with no requests in flight) shown to the customer with a recommendation; what happens when a scale-up cannot be satisfied quickly; and the console and API the customer uses.

**Constraints.** Every billed replica-minute traces to lifecycle events for a replica that existed; a replica is never billed twice for the same minute and never billed after its stop. Replica counts stay within the customer's minimum and maximum at all times. Billing totals are exact integers of replica-minutes; money is computed from them in integer minor units at a versioned price (all hypothetical). The customer's idle view and the invoice come from the same minutes.

**Assumptions.** Endpoint counts, load times, idle thresholds and prices are hypothetical, and the billing rule is this exercise's (check current docs). Replicas run on the platform's own infrastructure, described generally; whether a requested replica can start immediately depends on capacity you do not control.

**Clarifications.**
- Q: Is loading time billed? | A: Under this exercise's rule, yes: billing starts at the minute the replica starts. Say how you show that to the customer.
- Q: Can customers set the minimum to zero? | A: Assume the minimum is at least one; a customer may stop the endpoint, which stops all replicas.
- Q: What counts as idle? | A: A replica-minute in which the replica had no request in flight at any moment. You may propose a better measure, but say how it is computed.
- Q: Can the customer choose the scaling signal? | A: They choose minimum, maximum and a target; the platform chooses how the signal is measured.
- Q: What if a scale-up waits for capacity? | A: The replica is requested but not started; it is not billed until it starts. The customer should see that it is waiting.

**Hints.**
1. The autoscaler and the meter should not share state: the autoscaler decides, the lifecycle events record what happened, and billing reads only the events.
2. Turn intervals into minutes once: a replica running from 10:03:40 to 10:07:05 touches the minutes 10:03 to 10:07, five billed minutes under this rule.
3. Scaling down after {{idle_minutes}} idle minutes while a replica takes {{load_minutes}} minutes to load is a control loop with a delay; think about hysteresis and cost before tuning numbers.

**Follow-ups.**
1. Walk through one replica's life, from the autoscaler's decision to its last billed minute, and name every event and its timestamp.
2. Traffic arrives in bursts every 15 minutes. How does your rule behave, and what does it cost the customer compared with keeping one more replica running?
3. A stop event never arrives for one replica. How does the meter find out, and what does it bill?
4. What exactly does the idle view show, and how would a customer use it to change their minimum?
5. Scale-ups wait 40 minutes for capacity during a busy period. What does the customer see, what is billed, and how does the autoscaler avoid piling up requests it cannot satisfy?

**Follow-up rules.**
- when: cpu, gpu utilization, gpu utilisation, utilization → ask: GPU utilisation on an inference replica can be high while requests queue, or low while it is busy. Why is it a weak scaling signal here, and what do you use instead?
- when: queue depth, queue length, in flight, in-flight → ask: The queue grows now, but a new replica is ready only after {{load_minutes}} minutes. How far ahead does your rule have to look, and what does it do meanwhile?
- when: per second, seconds → ask: The rule bills each started minute in full. Where in your pipeline do seconds become minutes, and how do you avoid billing a minute twice when two events fall in it?
- when: heartbeat, heartbeats, polling → ask: Heartbeats from a replica stop for three minutes but it is still running. Do you stop billing, and how do you settle the minutes afterwards?
- when: predictive, forecast, scheduled scaling → ask: Your forecast scales up before a peak that does not come. Who pays for those replica-minutes, and how does the customer know why they ran?

**Production Reality Check.**
- Bursty traffic makes one endpoint add replicas that take {{load_minutes}} minutes to load and remove them after {{idle_minutes}} idle minutes; it cycles between 1 and {{max_replicas}} replicas 30 times in a day, and the customer's bill for that day triples while p95 latency barely improves.
- During a control-plane restart, stop events for 140 replicas are lost, and the meter keeps billing them as running for up to 9 hours.
- A customer whose endpoint sat at its minimum of 2 replicas with no requests in flight for most of a month disputes the invoice, saying nothing showed them it was idle.

**Evaluation Criteria.** A scaling signal tied to demand (requests or tokens in flight, queue growth) rather than raw utilisation; a decision rule with hysteresis and cooldowns that accounts for load time, with its cost stated; lifecycle events as the single source of billing, emitted reliably (an outbox or equivalent) and reconciled against a listing of running replicas; minute bucketing done once, idempotent per replica and minute, with exact integer totals and versioned prices; idle minutes computed from the same minutes as the bill and turned into a recommendation; waiting-for-capacity shown and not billed; adapts to each incident with diagnosis, correction of bills and prevention.

## TGA-L4-03: Many LoRA adapters on one dedicated endpoint — loading, eviction, cold loads measured, and per-adapter reports for the customer

| | |
|---|---|
| **Template ID** | TGA-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-adapter serving / placement and routing, cache eviction, cold-load measurement, per-adapter usage |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "adapters": {"2": [60, 300], "3": ["2,000", "8,000"]},
  "slots": [8, 16, 32],
  "replicas": [2, 4, 8],
  "cold_seconds": [2, 4, 8]
}
```

**Business Scenario.** A customer runs one dedicated endpoint serving a base model on {{replicas}} replicas, with {{adapters}} LoRA adapters attached: their own fine-tunes, for example one per product line or per task. Each request names an adapter or none (the base model alone). Each replica can hold up to {{slots}} adapters in accelerator memory at once; an adapter that is not resident is loaded from host memory or object storage, which takes about {{cold_seconds}} seconds (hypothetical). Requests for different resident adapters can be batched together on a replica (described generally). The customer attaches and detaches adapters through the API as they retrain, and wants per-adapter traffic, latency and usage for their own internal chargeback.

**Problem Statement.** Design adapter serving on the endpoint. Cover the adapter registry (immutable versions, the base model version each adapter was trained for, rank and target modules, checksums) and the compatibility check on attach; storage tiers and how adapters move between them; placement (which replicas hold which adapters) and request routing; the eviction policy and how hot adapters are replicated; how a cold load is defined, measured and attributed to the request that waited for it; detaching and replacing adapters while traffic flows; and the per-adapter report (requests, tokens, latency with cold and warm shown apart, load counts) through console and API.

**Constraints.** An adapter is never served on a base model version it was not trained for. Requests in flight when an adapter is detached complete; later requests get a documented error. Reports identify adapters by immutable version ids, with the customer's names shown beside them. Adapter weights are the customer's artefacts and are never inspected. Usage per adapter is for the customer's own reporting: the endpoint is billed by replica-minutes, not per adapter (this exercise's rule; check current docs).

**Assumptions.** Adapter counts, slot counts, load times and replica counts are hypothetical. All adapters on the endpoint target the same base model. Traffic across adapters is very uneven: a few adapters take most of it.

**Clarifications.**
- Q: Can one replica hold every adapter? | A: Not in accelerator memory: only {{slots}} at a time. Host memory holds more; object storage holds all.
- Q: Does a request for an adapter wait while it loads, or go elsewhere? | A: Your choice; say what you do and what it costs.
- Q: What is a cold load for reporting? | A: A request that waited for its adapter to be loaded into accelerator memory. You decide how the wait is measured and whether queued requests behind it count too.
- Q: Can the customer pin adapters so they are never evicted? | A: You may offer it; say how pinning interacts with the slot limit.
- Q: Are adapter names unique? | A: Names are the customer's labels and can be reused after a detach; versions are not.

**Hints.**
1. Route by adapter first: send a request to a replica that already holds its adapter, and only then balance load.
2. The eviction policy is a cache policy with a cost per miss of about {{cold_seconds}} seconds; frequency and recency both matter, and a burst of one-off adapters should not evict the steady ones.
3. Record the load as its own event (adapter version, replica, start, end, reason) and join requests to it; a request's cold wait is then computed, not guessed.

**Follow-ups.**
1. Walk through a request for an adapter that no replica holds. Where does it go, how long does it wait, and what does the report show?
2. One adapter suddenly takes 40% of traffic. How does placement respond, and how fast?
3. The customer detaches an adapter and attaches a retrained one under the same name within a minute. What happens to requests in flight, routing and the report?
4. How would you size {{slots}} slots across {{replicas}} replicas for {{adapters}} adapters, and what metric tells the customer they need more replicas?
5. The customer asks you to prove that adapter A's latency is worse because of cold loads and not because of the adapter itself. What do you show?

**Follow-up rules.**
- when: lru, least recently used → ask: A nightly job touches every adapter once. What does least-recently-used do to the adapters your daytime traffic depends on?
- when: lfu, frequency, frequent → ask: An adapter was very busy last week and is now unused. How long does frequency keep it resident, and how do you age it out?
- when: round robin, random, least loaded → ask: With {{adapters}} adapters and {{slots}} slots per replica, what share of requests would load their adapter cold under that routing?
- when: preload, prefetch, warm, pinning → ask: Which adapters do you preload, how many slots does that take, and what happens to the rest when the customer pins too many?
- when: adapter name, same name, by name → ask: A retrained adapter reuses the old one's name. Which id do routing and the report use, and how does the customer tell the two apart?

**Production Reality Check.**
- For a launch, the customer's traffic spreads evenly over all {{adapters}} adapters; with {{slots}} slots per replica, 45% of requests load their adapter cold, and p95 time to first token rises from 0.6 s to over {{cold_seconds}} seconds.
- An adapter trained on an earlier version of the base model is attached after the endpoint was upgraded; every replica fails to load it, and its requests return errors for 30 minutes before anyone notices.
- The customer detaches an adapter and attaches a retrained one under the same name; the per-adapter report for that day merges the two, and their own chargeback assigns the old adapter's traffic to the team that owns the new one.

**Evaluation Criteria.** An adapter registry with immutable versions, base-model compatibility checked on attach and again on load; tiered storage with explicit load events; adapter-aware routing with load balancing second and replication of hot adapters; an eviction policy that weighs frequency and recency, resists one-off bursts and respects pinning within a stated limit; cold loads defined, measured from events and shown apart from warm latency; safe detach and replace with versioned ids; per-adapter reports that sum to endpoint totals; adapters never inspected; adapts to each incident with diagnosis, recovery and prevention.

## TGA-L4-04: Customer artefacts for fine-tuning — datasets, checkpoints and adapters retained, expired and deleted in every copy, with a deletion receipt

| | |
|---|---|
| **Template ID** | TGA-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Data lifecycle / artefact inventory and lineage, retention, verified deletion across copies, no access to contents |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "tenants": ["2,000", "8,000", "30,000"],
  "regions": [2, 3, 5],
  "retention_days": [30, 90, 180],
  "deletion_days": [7, 14, 30]
}
```

**Business Scenario.** {{tenants}} customers upload datasets for fine-tuning. On upload, the platform runs the validation the customer asked for (file format, required fields, turn order, lengths) and reports counts, line numbers and error codes. Jobs then train on the dataset and write checkpoints, and finish with a model or a LoRA adapter that the customer can deploy to an endpoint or download. Artefacts are stored with copies in {{regions}} regions for durability and are backed up; training nodes keep working copies (for example tokenised caches) while a job runs. By this exercise's rule (check current docs), checkpoints are kept {{retention_days}} days after a job ends unless the customer keeps them, a customer can delete any artefact at any time, every copy is gone within {{deletion_days}} days of the request, and the customer receives a deletion receipt.

**Problem Statement.** Design the artefact lifecycle. Cover the inventory of artefacts and every copy of each (primary, regional copies, backups, caches on training nodes, models loaded on endpoints, exported downloads), and the lineage between them (dataset to job to checkpoints to model); retention and expiry; deletion on request across every copy, including backups and caches, and how it is verified; the deletion receipt (what was deleted, where, when, and what is kept and why); how a deployed model or adapter is handled when the customer deletes it; access control so that no person reads a customer's contents; how support helps a customer without seeing contents; and the audit trail.

**Constraints.** No person views a customer's dataset, checkpoint or adapter weights; the validator and the training job are the only processes that read contents, and validation output never contains content. A deletion receipt is issued only after every copy is verified gone or cryptographically unreadable. Billing records, receipts and counts may be kept after deletion; contents may not. Deleting a dataset does not delete models trained from it unless the customer asks; the customer is shown which ones exist.

**Assumptions.** Tenant counts, regions, retention periods and deletion targets are hypothetical. Storage is object storage with versioning and backups, described generally. Training nodes are shared between customers' jobs over time.

**Clarifications.**
- Q: Can backups be edited to remove one dataset? | A: Assume backups are immutable snapshots that expire on a schedule; you need another way to make a deleted artefact unreadable within {{deletion_days}} days.
- Q: What if the customer deletes a model that is deployed? | A: Your choice: refuse until it is undeployed, or undeploy as part of the delete with explicit confirmation. Say which and why.
- Q: Can support look at a failing dataset to help? | A: No. Support sees validation results (counts, line numbers, error codes) and job metadata only.
- Q: Do derived artefacts count? | A: Yes: tokenised caches, shards and any file produced from the dataset are copies of it for deletion purposes.
- Q: Does the receipt need to be signed? | A: It should be verifiable by the customer later; you choose how.

**Hints.**
1. You cannot delete what you have not recorded: every write of an artefact or anything derived from it registers a copy in the inventory before it is used.
2. Encrypt each artefact (or each tenant's artefacts) with its own key; destroying the key makes every copy, including immutable backups, unreadable at once.
3. Treat deletion as a workflow with states (requested, keys destroyed, copies removed, verified, receipt issued) and a deadline, not a single call.

**Follow-ups.**
1. Walk through deleting one dataset that three jobs trained on, one of which produced an adapter now deployed. What happens to each artefact, and what does the receipt say?
2. A training node crashes mid-job with a tokenised cache on its local disk. How does that copy get deleted, and how do you know it was?
3. How do you prove to an auditor that no person read a customer's dataset in the last year?
4. A customer's job fails validation and they ask support why. What can support see and say?
5. A customer asks for every copy of every artefact they ever uploaded to be deleted, today. How long does it take, what is kept, and why?

**Follow-up rules.**
- when: soft delete, soft-delete, deleted flag, tombstone → ask: A soft-deleted dataset is still in storage. When does it become unreadable, and what does the receipt say in the meantime?
- when: backup, backups, snapshot → ask: Backups are immutable for 35 days. How is a dataset deleted on day one unreadable in them by day {{deletion_days}}?
- when: encryption, encrypt, crypto-shredding, kms → ask: Who can use the per-tenant key, and what happens if the key service itself is restored from a backup?
- when: sample, debug, look at, inspect → ask: An engineer needs to understand why many datasets fail one check. What can they see, and how do they get it without reading any customer's lines?
- when: cron, nightly, batch job → ask: The nightly clean-up job fails for a week. Which deletion deadlines are missed, and who finds out?

**Production Reality Check.**
- An audit finds tokenised working copies of 300 deleted datasets left on training nodes' local disks for up to 40 days, beyond the {{deletion_days}}-day target, because jobs on those nodes crashed before their clean-up step.
- A restore of one region's object storage after an operator error brings back 1,100 datasets that customers deleted during the previous month.
- A change to the validator adds the first 200 characters of each failing line to error messages shown in the console and written to logs; it runs for two days before a customer points it out.

**Evaluation Criteria.** An inventory where every copy and derived artefact is registered before use, with lineage from dataset to job to model; retention and expiry as policy with dates; deletion as a tracked workflow with a deadline, per-artefact or per-tenant keys destroyed for backups and stray copies, and verification before a receipt; explicit handling of deployed models and derived artefacts; no human access to contents by construction, validation output limited to counts, line numbers and codes, and access logs that prove it; support tooling built on metadata; adapts to each incident with diagnosis, containment, customer communication and prevention.

## TGA-L4-05: The open-model catalogue lifecycle — new models added within days, versions, deprecations with notice, and per-tenant migration reporting

| | |
|---|---|
| **Template ID** | TGA-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Product catalogue platforms / onboarding pipelines, acceptance checks, immutable versions and aliases, deprecation and migration |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "models": {"2": [60, 120], "3": [250, 400]},
  "tenants": ["5,000", "20,000", "80,000"],
  "notice_days": [30, 60, 90],
  "onboard_days": [2, 3, 5]
}
```

**Business Scenario.** The platform offers a catalogue of {{models}} open model versions, each available on serverless inference, on dedicated endpoints, or both. Model publishers release new open models often, and customers expect popular ones within days: the target here is {{onboard_days}} days from a public release to general availability (this exercise's target). A model entry has a family, a version, its licence as published, context length, the tokenizer and chat template, the serving variants offered, and prices. Older versions are deprecated with at least {{notice_days}} days' notice and a named replacement, then retired (this exercise's rule; check current docs). {{tenants}} tenants call catalogue models, some by an exact version id and some through a family alias.

**Problem Statement.** Design the catalogue lifecycle. Cover intake of a new model (obtaining the publisher's public release, verifying checksums, recording the licence for the owners who review it, converting to serving variants); acceptance checks before release (tokenizer and chat template, deterministic smoke tests, performance targets, a check against public evaluation sets with synthetic expectations); the catalogue record as the one source for the API's model list, documentation, prices and billing; immutable version ids and how aliases move; deprecation (notice, named replacement, dates) and what happens to calls after retirement; per-tenant migration reporting, for the platform in aggregate and for each tenant about its own calls; and how a bad release is rolled back.

**Constraints.** A version id always means the same weights, tokenizer, template and serving variant; nothing about it changes after release except its lifecycle state. Every tenant that called a version in the last 30 days is notified of its deprecation through a contact they chose. No model is released before its licence has been recorded and reviewed by the people who own that decision; this design draws no legal conclusions. Prices and billing read the same catalogue record the API uses.

**Assumptions.** Model counts, tenant counts, onboarding targets and notice periods are hypothetical. Publishers release weights, tokenizers and templates publicly, and sometimes publish corrected revisions after release. Quality checks use public evaluation sets with expectations set by this exercise, not any real model's results.

**Clarifications.**
- Q: Does a publisher's corrected revision change our version? | A: No; it becomes a new version. You decide whether and when an alias moves to it.
- Q: What happens to a request for a retired version? | A: Your choice of documented behaviour: an error naming the replacement, or a redirect. Say which, and why.
- Q: Who decides a deprecation date? | A: Product owners, using your migration data; the notice period is a floor.
- Q: Who reviews licences? | A: Legal and product owners. The pipeline records what was published and blocks release until review is recorded.
- Q: Do tenants see each other in migration reports? | A: No. The platform sees aggregates and per-tenant rows for outreach; a tenant sees only its own calls.

**Hints.**
1. Separate the pipeline into stages with explicit gates (intake, conversion, acceptance, review, pricing, release), so the {{onboard_days}}-day target is a measured path with known slow steps.
2. Treat aliases as pointers with a history: who moved them, when, from which version to which, so every request can be tied to the exact version that served it.
3. Migration reporting is a query over requests by tenant, version and week, plus the first call to the replacement; design the request record so it carries the resolved version id.

**Follow-ups.**
1. Walk through a new open model from its public release to general availability. Which steps can run in parallel, and which gate usually takes longest?
2. A publisher fixes a tokenizer bug a week after release. What do you publish, and what happens to tenants on the alias and on the exact version?
3. With {{notice_days}} days to retirement, 15% of the deprecated version's traffic has not moved. What does your reporting show, and what do you do differently for the largest tenants and for the long tail?
4. On retirement day, what does a request to the retired version receive, and how do you measure the effect?
5. A new release turns out to be worse on one kind of task than its predecessor. How is that found, and how do you roll back without breaking tenants who already moved?

**Follow-up rules.**
- when: latest, alias, aliases → ask: A tenant in production calls the family alias. You move it to a new version. What changed for them, and how did they find out?
- when: email, notification, notice → ask: The notice went to the address on the billing account, which nobody reads. How do you know a tenant actually received it?
- when: redirect, fallback, automatically → ask: A retired version's requests are sent to the replacement, whose output format differs slightly. Whose application breaks, and who learns about it first?
- when: benchmark, eval, evaluation → ask: Your acceptance check passes but tenants report worse answers on their task. What did the check measure, and what would you add?
- when: spreadsheet, manual, by hand → ask: The API model list, the documentation and the pricing page disagree about one model's context length. Which is right, and how do you stop that recurring?

**Production Reality Check.**
- A newly added model is released with a chat template that drops the system turn; for two days tenants' outputs ignore their system instructions, and support receives 80 tickets before the cause is found.
- On release day the family alias is moved to a new version; tenants calling the alias get a different output format, and 60 tickets arrive within a day from tenants who did not know they were on an alias.
- {{notice_days}} days after notice, on retirement day, 400 tenants still send requests to the deprecated version; 150 of them never saw a notice because it went only to a billing contact.

**Evaluation Criteria.** A staged onboarding pipeline with gates and measured durations against the {{onboard_days}}-day target; acceptance checks that cover tokenizer, template, determinism and performance, with honest limits on quality checks; one catalogue record feeding API, docs, prices and billing; immutable versions and aliases with a history and the resolved version on every request; deprecation with a notice floor, named replacement, verified delivery of notices and documented retirement behaviour; per-tenant migration reporting with aggregate views and tenant-scoped self-service; licence review recorded as a gate owned by the right people, with no legal conclusions in the design; rollback without breaking tenants who moved; adapts to each incident with diagnosis, recovery and prevention.
