# CoreWeave · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a GPU cloud for
AI workloads: capacity reservations and contracts, on-demand GPU instances,
Kubernetes-based customer clusters, GPU-hour metering and billing, regions and
data centres with power constraints, customer quotas, storage and networking
services, customer-facing SLAs and planned maintenance. Every capacity, price,
power figure, volume, notice period and SLA term is hypothetical and this
exercise's rule (check current docs), and nothing here describes the company's
customers, contracts, data centres, suppliers or how its own systems are built.

## CRW-L4-01: Capacity that can be promised — sellable GPUs by region, type and month from installed, building and reserved supply

| | |
|---|---|
| **Template ID** | CRW-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Capacity promising / time-phased supply and demand, holds, uncertainty, as-of audit |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer |

```params
{
  "regions": {"2": [3, 5], "3": [8, 12]},
  "gpu_types": [3, 4, 6],
  "quarters": [4, 6, 8],
  "slip_weeks": [6, 10, 16]
}
```

**Business Scenario.** A GPU cloud sells capacity in {{regions}} regions and {{gpu_types}} GPU types, mostly through multi-year reservations whose contracts carry a ramp (so many GPUs from one month, more from a later month) and partly by the hour on demand. Supply comes from GPUs installed and accepted, from data halls under construction with an expected ready date and a power allocation, and from expansions still being planned. Demand comes from signed reservations, deals the sales teams are negotiating, a floor kept for on-demand customers, and spare held back for failures and maintenance. Account teams want to know, before they quote a delivery schedule, what can be promised in each region, GPU type and month over the next {{quarters}} quarters.

**Problem Statement.** Design the capacity-promising system. Cover the inputs and who owns each one; the model of supply and demand per region, GPU type and month; how construction uncertainty is represented and what you promise against; tentative holds for deals in negotiation, with expiry, so that two account teams cannot promise the same GPUs; how a signed contract converts its hold into committed capacity; how a construction delay propagates to the contracts that depended on it and in what order shortfalls are assigned; the history that shows what was promisable on the day each contract was signed; and the interfaces for account teams, the contract system and operations.

**Constraints.** Committed capacity in any region, GPU type and month must never exceed the supply you chose to promise against, net of the on-demand floor and spare. A hold request is answered within a second, and concurrent holds must not both succeed for the same last GPUs. Every promise must be traceable to the supply snapshot and rules that allowed it. The data is small (thousands of rows a month), so the hard parts are correctness, concurrency, uncertainty and audit, not throughput.

**Assumptions.** All capacities, ramps, dates, spare fractions and power figures are hypothetical, and the rules are this exercise's (check current docs). GPU types do not substitute for each other unless a contract says so. Construction reports each hall's expected ready date as a range, and power for a hall is fixed by its power contract.

**Clarifications.**
- Q: Is installed capacity certain? | A: Installed and accepted GPUs are, apart from failures, which the spare covers. Halls under construction have a ready-date range; you decide which date you promise against.
- Q: Can a deal be quoted for a region or GPU type with no free supply? | A: Only as a waitlist or with a later start; the system must say which.
- Q: How long does a hold last? | A: This exercise's rule: 14 days, renewable once with approval; you decide what happens at expiry.
- Q: Is the on-demand floor fixed? | A: It is a business setting per region and GPU type, changed a few times a year; changes must not break existing commitments.
- Q: Who decides which contract absorbs a shortfall? | A: A documented policy you propose, applied by the system and approved by people; customers' names never decide it.

**Hints.**
1. Think of a time-phased ledger like available-to-promise in manufacturing: cells of (region, GPU type, month) with supply, the floor, spare, holds and commitments, each change an appended event.
2. Represent uncertain supply as dated scenarios (a likely date and a conservative date per hall) and promise only against the conservative one; sell the difference as a waitlist or with a stated risk.
3. A hold is a conditional write across every month of a ramp; it succeeds for all of them or for none.

**Follow-ups.**
1. Walk through a hold for a ramp spanning seven months when one of those months has fewer free GPUs than the ramp needs. What does the account team see?
2. Two account teams place holds on the last GPUs of one region-month in the same second. What makes exactly one of them succeed?
3. A hall slips by {{slip_weeks}} weeks. Which contracts are affected, how is the shortfall assigned, and what options does the system offer (other region, other month, partial delivery, on-demand bridge)?
4. Finance asks whether promising against the likely date instead of the conservative one would have been worth the risk last year. What data answers that?
5. An auditor asks what was promisable in one region and GPU type on the day a particular contract was signed. Show how you answer exactly.

**Follow-up rules.**
- when: overbook, overbooking, oversell → ask: Airlines overbook knowing no-show rates. What is your equivalent of a no-show here, how would you measure it, and who carries the cost when it goes wrong?
- when: spreadsheet, excel, google sheet → ask: Two account teams edit the spreadsheet at the same time for the same region. What stops both of them promising the same GPUs, and what is the audit trail?
- when: forecast, ml model, machine learning, prediction → ask: Your forecast says a hall will be ready in March with 80% confidence. Which number goes into a signed contract, and why?
- when: lock, row lock, select for update, transaction → ask: A seven-month ramp touches seven cells. What do you lock, in what order, and what happens to a hold that needs a month another hold is updating?
- when: eventual consistency, eventually consistent, cache, replica → ask: Which number in your design may be stale, and which must be exact at the moment a hold is granted?

**Production Reality Check.**
- A data hall that nine signed contracts are counting on for their ramps slips by {{slip_weeks}} weeks. Construction gives the new date as a range, and three more deals are waiting for holds against the same hall.
- Two account teams place holds within the same second on the last 1,024 GPUs of one type in one region-month; both holds are confirmed, and the region-month is now promised beyond its conservative supply.
- A problem found in acceptance testing withdraws 6% of one GPU type's installed GPUs in one region for three weeks, more than the spare held back for failures.

**Evaluation Criteria.** Separates supply (installed, building with a date range, planned) from demand (commitments, holds, on-demand floor, spare); a time-phased ledger per region, GPU type and month built from appended events; promising against a stated conservative scenario, with the gap sold explicitly; holds as atomic all-months conditional writes with expiry; a documented, people-approved shortfall policy and dated options for affected contracts; as-of history that reproduces what was promisable on any date; interfaces that tell account teams why a hold failed; adapts to each incident with diagnosis, recovery and prevention.

## CRW-L4-02: Customer quota enforcement across regions — concurrent provisioning that never overshoots, and the increase workflow

| | |
|---|---|
| **Template ID** | CRW-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Admission control / quota claims, global caps split across regions, partitions, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "regions": {"2": [4, 6], "3": [10, 14]},
  "customers": ["3,000", "12,000", "40,000"],
  "peak_requests": {"2": ["600", "1,500"], "3": ["8,000", "20,000"]},
  "review_hours": [4, 24, 48]
}
```

**Business Scenario.** {{customers}} customer organisations run GPU workloads in {{regions}} regions. Each organisation has quotas: the most GPUs of each type it may hold at once in each region, and for some organisations a global cap per GPU type across all regions. Nodes are requested through the API, the console, and the node-pool autoscaling of customers' Kubernetes clusters, so many requests from one organisation arrive concurrently in several regions; across the platform there are up to {{peak_requests}} provisioning requests a minute at peak. Customers who need more ask for an increase, which is reviewed against capacity within {{review_hours}} hours (this exercise's target).

**Problem Statement.** Design quota enforcement. Cover the quota model (organisation, GPU type, region, optional global cap, effective dates); the admission check that claims quota before provisioning starts and releases it when provisioning fails or nodes are released; how usage is counted through the node lifecycle (requested, provisioning, ready, draining, released); how a global cap is enforced across regions that can be cut off from each other; reconciliation of quota counters with the nodes that actually exist; the increase workflow and its audit trail; and what customers see (limit, in use, pending, and why a request was refused).

**Constraints.** An organisation's GPUs in use plus in-flight claims never exceed its quota, under any interleaving of concurrent requests. Admission p99 under 300 ms. A region keeps admitting within its own quotas when it cannot reach the other regions. Quota is not capacity: a request within quota can still fail because the region has no free GPUs of that type, and the response must say which of the two refused it. Every quota change and increase decision is auditable.

**Assumptions.** Customer counts, request rates and review targets are hypothetical. Each region has its own provisioning control plane that emits node lifecycle events. Quotas and the increase process are this exercise's rules (check current docs).

**Clarifications.**
- Q: Do nodes being drained still count? | A: Yes, until they are released; the customer is still holding them.
- Q: Is the global cap common? | A: A minority of organisations have one, and they tend to be the largest.
- Q: Can an increase be granted partly? | A: Yes, for some regions, types or a smaller number, with a reason.
- Q: Does a quota decrease evict running nodes? | A: No. It blocks new requests until usage falls below the new limit.
- Q: Who reviews increases? | A: Capacity planners with an automatic first check; you design the check and what goes to a person.

**Hints.**
1. Make admission a claim: one conditional update that adds the requested GPUs to `in_use + claimed` only if the sum stays within the limit, with a claim id and an expiry.
2. A global cap across regions can be split into per-region allotments (escrow), so each region admits locally from its own share and rebalances when it can reach the others.
3. Counters drift. Recompute them from lifecycle events and the regions' own view of nodes, and decide which source wins.

**Follow-ups.**
1. Two requests for 64 GPUs each arrive in the same millisecond when 100 remain in the organisation's quota. Walk through what each one sees.
2. Provisioning for a 64-GPU request gets 40 nodes ready and fails on the rest. What is counted against the quota now, and what does the customer see?
3. An organisation with a global cap scales in two regions while one of them is cut off from the global allotment service for 30 minutes. What does each region allow?
4. Reconciliation finds the counter for 200 organisations is higher than the nodes they hold. Which source do you trust, and how do you correct the counter without ever letting an organisation overshoot?
5. Increase requests spike before a holiday and capacity cannot cover them all. How does the workflow decide, and what keeps it fair and explainable?

**Follow-up rules.**
- when: distributed lock, global lock, zookeeper, consensus → ask: The region holding the lock leader is cut off. Can the other regions still admit requests, and how much of the global cap can they use?
- when: redis, cache, in-memory counter → ask: The cache holding quota counters restarts. What are the counters afterwards, and how do you know no organisation overshot while they were rebuilt?
- when: autoscaler, autoscaling, retry, retries → ask: A customer's cluster autoscaler retries every denied request immediately. What does that do to admission latency for everyone else in the region, and what do you return to slow it down?
- when: eventually consistent, eventual consistency, async → ask: Which count in your design may lag, and which must be exact when a claim is granted?
- when: queue, waitlist, pending → ask: A request waits in your queue for quota to free up. How long, who sees it, and when is it refused instead?

**Production Reality Check.**
- After denials, one customer's cluster autoscaler sends 3,000 provisioning requests a minute for a single node pool, and admission p99 for every customer in that region rises from 120 ms to 2 seconds.
- Release events for nodes freed during a two-hour control-plane outage in one of the {{regions}} regions were lost, so 40 organisations show as at quota while holding far fewer GPUs, and their clusters cannot scale.
- An organisation with a global cap is admitted in two regions during a partition and holds 7% more GPUs of one type than its cap when the regions reconnect.

**Evaluation Criteria.** Quota modelled per organisation, GPU type and region with optional global caps and effective dates; admission as an atomic conditional claim with an idempotent claim id and expiry, released on failure; usage tied to explicit node lifecycle states; a global cap split into per-region allotments with rebalancing, conservative behaviour when partitioned, and a stated bound on any overshoot; reconciliation of counters with lifecycle events that only ever corrects in the safe direction first; quota refusals distinguished from capacity refusals; an auditable, partly automatic increase workflow; backpressure for retrying clients; adapts to each incident with diagnosis, recovery and prevention.

## CRW-L4-03: Usage exports customers can reconcile — hourly files and an API that tie to the invoice to the cent

| | |
|---|---|
| **Template ID** | CRW-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Billing data products / line-level usage, versioned restatements, rounding, tenant isolation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "customers": ["1,500", "6,000", "25,000"],
  "lines_per_day": {"2": ["150 million", "400 million"], "3": ["2 billion", "5 billion"]},
  "file_hours": [2, 4, 8],
  "restate_days": [5, 10, 20]
}
```

**Business Scenario.** {{customers}} customers buy GPU and CPU instances, storage and network transfer, some under reservations and some on demand. Their finance and cost teams want to reconcile each invoice to usage themselves: hourly usage files delivered to a storage bucket the customer owns or downloaded from the console, and an API over the same data, at line level — cluster, node or instance, GPU type, region, meter (GPU-seconds, CPU-seconds, storage byte-hours, transfer bytes), quantity, rate, whether the reservation or on-demand rate applied, and cost. The platform produces about {{lines_per_day}} usage lines a day. Metering data sometimes arrives late, and occasionally a metering error is found and corrected after the hour or the month has closed.

**Problem Statement.** Design the usage export. Cover the line-level model with stable line ids; how an hour is closed and its file produced; how late data and corrections are published (new file versions, correction lines, or both) so that a customer who already loaded the old data can tell exactly what changed; how the invoice is computed from the same lines and where rounding happens so that the lines sum to the invoice exactly; the API (filters, pagination over a consistent snapshot); schema evolution; delivery into customer-owned buckets; tenant isolation; and the monitoring that proves the exports and invoices agree.

**Constraints.** For every invoice, the sum of the customer's exported lines for that period equals the invoice total exactly, in cents. The file for hour H is available within {{file_hours}} hours after H ends. Corrections found within {{restate_days}} days after month close restate that month; later ones appear as dated adjustments on the next invoice (this exercise's rule; check current docs). No floating point for money. One customer's usage must never appear in another customer's export, bucket or API response.

**Assumptions.** Customer counts, volumes and timings are hypothetical. Metering emits records per resource and meter with an event time and a record id; rates come from a versioned price book and each customer's contract terms (all hypothetical).

**Clarifications.**
- Q: Do customers load the files into their own warehouse? | A: Many do, appending each hour; any restatement design must work for them.
- Q: Can a line's cost be fractional cents? | A: Rates can have more precision than cents. You decide where the one rounding to cents happens, and the lines must still sum to the invoice.
- Q: Are credits (for example SLA credits) in the export? | A: Yes, as their own lines, so the export explains the whole invoice.
- Q: Format? | A: Your choice; say how a new column is added without breaking a customer's loader.
- Q: Can customers ask for a different granularity? | A: Hourly is the base; daily and monthly are aggregations of the same lines.

**Hints.**
1. Give each line a deterministic id from (customer, resource, meter, hour, rate basis) so that a restated line replaces exactly the line it corrects.
2. Publish restatements as a new version of the affected hours with a manifest (which hours, which version, why), and also as signed correction lines, so append-only loaders and replace-by-hour loaders both converge.
3. Round once: either each line to cents with the invoice as their sum, or the invoice once with a visible rounding-adjustment line. State which, and test it at exact half cents.

**Follow-ups.**
1. Walk through one hour: when is it closed, which late records still make it into the first file, and what happens to a record that arrives after?
2. A correction changes lines in 30 hours of last month for 300 customers. What exactly is published, and how does a customer who appends hourly files avoid double counting?
3. Where does rounding happen, and how do you prove the lines sum to the invoice for every customer every month?
4. A customer's bucket permissions change and deliveries start failing. How long do you retry, what do you tell them, and how do they catch up?
5. How would you show a customer, line by line, why this month's invoice differs from last month's?

**Follow-up rules.**
- when: float, double, decimal → ask: Where exactly can a fraction of a cent exist in your pipeline, and where is it rounded?
- when: overwrite, replace, upsert → ask: A customer already loaded yesterday's version and appends new files. How do they learn that you replaced data, and what do they do?
- when: parquet, csv, json, avro → ask: You add a column for a new meter. What happens to a customer's loader written against last month's schema?
- when: bucket, iam, credentials, cross-account → ask: The export writer needs permission to write into thousands of customer-owned buckets. How do you keep one customer's data from ever landing in another's?
- when: snapshot, pagination, cursor → ask: A restatement lands while a customer is paging through the API. Can they see a mix of old and new lines?

**Production Reality Check.**
- A metering fix found four days after month close changes 0.4% of lines for 300 customers whose invoices have already been sent, within the {{restate_days}}-day restatement window.
- A customer reports that its hourly files for one month sum to $1,284.17 more than the invoice. It loaded both the original and the restated version of 20 hours.
- A change to the export path template writes 14 hourly files for one customer under another customer's prefix for 40 minutes before it is caught.

**Evaluation Criteria.** Line-level model with deterministic ids and the rate basis on each line; hour closing with watermarks and a defined path for late records; versioned restatements with a manifest plus correction lines that work for both append and replace loaders; invoice computed from the same lines with one stated rounding step and a continuous tie-out check; consistent API snapshots; additive schema evolution with versions; tenant isolation by construction (per-customer paths derived from verified identity, write credentials scoped per customer, post-write verification); adapts to each incident with diagnosis, recovery, customer communication and prevention.

## CRW-L4-04: Network transfer metering — bytes per customer, region and destination class, billed without inspecting traffic contents

| | |
|---|---|
| **Template ID** | CRW-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Metering pipelines / interface counters, destination classification, counter resets, data minimisation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer |

```params
{
  "regions": {"2": [4, 6], "3": [10, 14]},
  "interfaces": {"2": ["200,000", "500,000"], "3": ["3 million", "8 million"]},
  "report_seconds": [10, 30, 60],
  "free_gb": ["100", "500", "1,000"]
}
```

**Business Scenario.** Customers' clusters, instances and storage in {{regions}} regions send and receive network traffic: to each other within a region, to other regions, to object storage, over private interconnects to the customer's own sites, and to the public internet. Transfer is billed by this exercise's rule (check current docs): inbound and same-region traffic are free; transfer between regions is billed at one rate; transfer to the internet is billed at another after the first {{free_gb}} GB a month per customer. The platform has about {{interfaces}} customer-attached virtual and physical interfaces, and the hosts and gateways that carry them report byte counters every {{report_seconds}} seconds.

**Problem Statement.** Design network transfer metering. Cover where bytes are counted (host interfaces, gateways that handle public addresses and translation, interconnect ports) and how double counting between them is avoided; how each byte count is attributed to a customer and classified by destination class using address ranges that change over time; counter deltas, resets and wraparound; the aggregation pipeline to per-customer, per-region, per-class totals; the billable calculation including the free allowance; late and missing reports; what customers see; and the data you keep and for how long. Traffic contents are never inspected.

**Constraints.** No packet payload is captured, sampled or stored anywhere in the design. Billable bytes must come from counters, not from sampled flows. Address-range classifications apply from their effective time, and reclassifying history requires an explicit, audited restatement. Usage visible to customers within an hour; month totals final three days after month end. Per-connection records, if you keep any, are minimised and retained for a short, stated period.

**Assumptions.** Interface counts, reporting intervals, free allowances and rates are hypothetical. Each interface belongs to exactly one customer resource at a time, and the attachment history is available as events. Counters are 64-bit and reset when an agent or device restarts.

**Clarifications.**
- Q: Can we use sampled flow records for billing? | A: You may use them for troubleshooting; billing must come from counters. Say why.
- Q: How is the destination known without looking inside packets? | A: From packet headers and routing: the destination address and the route or gateway the traffic leaves by, matched against a versioned table of address ranges and their class.
- Q: Does a customer see per-connection detail? | A: No. They see totals by region, destination class and resource; anything finer is for troubleshooting and is not billed.
- Q: What if a host stops reporting? | A: Its counters keep counting; the next report carries the bytes since the last one. You decide how the gap is spread across time.
- Q: Do interconnect ports belong to one customer? | A: Yes, dedicated ports do; shared gateways carry many customers and attribute bytes by the customer's address or network.

**Hints.**
1. Bill from per-interface (or per-customer-network) counters per destination class at the edge where the class is known; count each byte at exactly one designated metering point per path.
2. Compute deltas from monotonically increasing counters with an explicit reset rule (a lower value after a restart means the new value is the delta) and never trust a delta larger than the link could carry in the interval.
3. Keep the destination table bitemporal: what was true at the time of the traffic, and when we learned it.

**Follow-ups.**
1. Trace one gigabyte from a customer's node to the internet through a gateway with a public address. Which device counts it, and which class does it get?
2. A host agent restarts and its counters start again from zero. Walk through the next report and what gets billed.
3. An address range moves from "internet" to "same region" because a storage endpoint moved. How do you apply that, and what about traffic already billed?
4. How do you show a customer that their bill is right without giving them, or keeping, per-connection data?
5. A region's metering pipeline is down for six hours. What do customers see, and how do month totals stay exact?

**Follow-up rules.**
- when: sflow, netflow, ipfix, sampling, sampled → ask: Sampling one packet in a thousand gives an estimate. Can a customer dispute an estimate on their invoice, and what do you show them?
- when: dpi, deep packet, packet capture, payload → ask: What would you learn from contents that the headers and counters do not tell you, and why is it worth the risk of holding customers' traffic?
- when: ip address, flow log, 5-tuple, connection → ask: You keep per-connection records. Who can read them, for how long, and what do they reveal about a customer's own users?
- when: counter, delta, reset, wrap → ask: A reported counter is lower than the last one. Is that a reset or a delayed, out-of-order report, and how do you tell?
- when: kafka, stream, streaming, flink → ask: A host's reports arrive out of order after a network blip. Does your stream compute negative deltas, and what does it bill?

**Production Reality Check.**
- A host agent upgrade restarts counters on 30,000 interfaces; the delta logic treats the lower readings as 64-bit wraparound and computes a charge of about 18 exabytes for several customers.
- An address-range update is published with the wrong effective time, and for six hours traffic from one region to its own object storage is classified as internet transfer, which would overbill about 900 customers.
- Traffic through gateways with public addresses is counted at both the host interface and the gateway for one region, so internet transfer for customers using public addresses is doubled for nine days before a customer notices that their usage exceeds their own measurements.

**Evaluation Criteria.** Counters, not samples or contents, as the billing source, with one designated metering point per path and a rule against double counting; attribution through interface attachment history; destination classes from a bitemporal address-range table with audited restatements; reset, wraparound and out-of-order handling with plausibility bounds; per-customer aggregation with watermarks, late reports and exact month totals; the free allowance applied once per month at the right stage; data minimisation (no payloads, short retention of any per-connection data, customer-facing totals only); reconciliation against independent counters; adapts to each incident with diagnosis, recovery and prevention.

## CRW-L4-05: Planned maintenance and regional status — scheduling across customers' windows, status pages and measured impact

| | |
|---|---|
| **Template ID** | CRW-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Operations platforms / maintenance scheduling, customer notice, status communication, impact measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "regions": {"2": [3, 6], "3": [10, 14]},
  "customers": ["800", "3,000", "12,000"],
  "notice_days": [5, 7, 14],
  "max_share": [10, 15, 25]
}
```

**Business Scenario.** A GPU cloud in {{regions}} regions must regularly patch firmware, drivers and operating systems, replace hardware, and do electrical and cooling work that takes whole rows of a data hall offline. {{customers}} customers declare maintenance preferences: weekly allowed windows in their own time zone, at most {{max_share}}% of their nodes in one cluster under maintenance at once, and occasional freeze periods (for example around a launch). Planned work announced at least {{notice_days}} days ahead and done inside the announced window does not count against the availability SLA (this exercise's rule; check current docs). Each region also has a public status page showing the state of each service.

**Problem Statement.** Design the maintenance and status system. Cover the inputs (work items with the nodes, racks or rows they touch, durations and dependencies; customers' windows, limits and freezes); how a schedule is computed and conflicts are surfaced to people; notices and how changes to a planned event are communicated; execution through customers' Kubernetes clusters (cordoning and draining nodes, described generally) with abort criteria; regional status pages and who or what may change them; and how customer impact is measured (node-minutes unavailable per customer, inside or outside the announced window) so that SLA exclusions are applied only where the rule allows.

**Constraints.** No customer cluster ever has more than {{max_share}}% of its nodes under planned maintenance at once. Work that cannot fit a customer's windows within 30 days is raised to people, not silently scheduled. Windows are honoured in the customer's local time across daylight-saving changes. The status page never shows "operational" for a service that is failing for many customers, and never shows a regional outage because of one monitoring signal. Impact measurements are reproducible from recorded events.

**Assumptions.** Region and customer counts, notice periods and limits are hypothetical. Node lifecycle events (cordoned, drained, in maintenance, returned) are recorded with times. Customers can acknowledge a notice or ask to move it; the platform may decline when the work is urgent.

**Clarifications.**
- Q: Is emergency work (a security fix) different? | A: Yes. It may need shorter notice; it then does not qualify for the SLA exclusion under this exercise's rule, and the design should make that visible.
- Q: Can a whole row's power work be split? | A: No; it takes all nodes in those racks at once. Customers with many nodes there are the hard case.
- Q: What if a drain is blocked by the customer's own disruption limits in their cluster? | A: The work waits up to a stated time, then either proceeds with notice or is rescheduled; you choose and justify.
- Q: Who owns the status page? | A: Operations; automation may propose changes, and you decide which it may publish on its own.
- Q: Do customers see each other's maintenance? | A: No. A customer sees its own events; the status page shows only regional and service-level state.

**Hints.**
1. Store windows as recurring local-time rules with an IANA time zone, and expand them into UTC intervals only for the dates you schedule.
2. Treat each work item as a set of nodes and each customer's limit as a capacity per cluster per time slot; the schedule is a constrained assignment that people review, not a single greedy pass hidden from them.
3. Measure impact from node lifecycle events joined to the announced events, so "inside the window" is computed, not reported.

**Follow-ups.**
1. Walk through scheduling power work for one row that holds nodes from 40 customers with different windows and limits.
2. The work overruns its window by three hours. What happens automatically, what do customers hear, and how is the SLA exclusion applied?
3. How does the status page decide between "operational", "degraded", "planned maintenance" and "outage" for a service in a region, and who approves each change?
4. A daylight-saving change is coming next week. What in your design could drain nodes an hour outside a customer's window, and how do you test it?
5. Over a quarter, how do you show each customer how much of its unavailability was planned and inside windows, and how do you use the same data to reduce maintenance impact?

**Follow-up rules.**
- when: drain, cordon, pod disruption budget, eviction → ask: A customer's disruption limits block the drain indefinitely. Does your maintenance wait, override, or reschedule, and who decides?
- when: greedy, solver, optimisation, optimization, ilp → ask: Your scheduler finds no plan that fits every customer's window this month. What does it produce, and who sees the conflict?
- when: utc, time zone, timezone, daylight saving → ask: A customer's window is 02:00–04:00 local on the night clocks go back. Which two hours do you use, and does the customer agree?
- when: status page, automated status, automation → ask: One synthetic check fails in a region at 03:00. What does the status page show, and who is woken?
- when: sla, credit, exclusion → ask: The work started inside the window and finished outside it. Which node-minutes are excluded, and how would a customer verify that?

**Production Reality Check.**
- Power work in one hall overruns its window by three hours, and nodes of 120 customers stay out of service past the time announced {{notice_days}} days earlier.
- Windows were stored as fixed UTC offsets, so after a daylight-saving change 60 customers have nodes drained an hour outside their allowed window.
- A drain wave for a driver update takes 30% of one customer's cluster at once, above its {{max_share}}% limit, because two work items scheduled independently overlapped on the same cluster.
- The status page shows "operational" for 50 minutes while node provisioning fails in one region, because the page is derived only from the health of running nodes.

**Evaluation Criteria.** Work items, customer windows, limits and freezes modelled explicitly with local-time rules; a scheduler that enforces the per-cluster limit across all concurrent work items and surfaces conflicts to people; notices with versioned changes and acknowledgements; execution through cordon and drain with timeouts, abort criteria and handling of blocked drains; status derived from several customer-facing signals with human confirmation for major states and automatic publication limited to clear cases; impact measured from lifecycle events against announced windows, with SLA exclusions applied only where the rule allows and reproducible per customer; adapts to each incident with diagnosis, recovery, communication and prevention.
