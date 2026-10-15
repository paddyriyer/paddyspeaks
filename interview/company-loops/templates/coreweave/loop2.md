# CoreWeave · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a GPU cloud for
AI workloads: capacity reservations and contracts, on-demand GPU instances,
Kubernetes-based customer clusters, GPU-hour metering and billing, regions and
data centres with power constraints, storage and networking services. Every
contract, price, capacity, volume, SLA term and schema is hypothetical and
"this exercise's rule; check current docs"; nothing here describes a real
customer, contract, data centre, supplier or internal system.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CRW-L2-01: Accepting GPU reservations in order against a pool's hourly capacity

| | |
|---|---|
| **Template ID** | CRW-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Segment trees / lazy propagation, range add and range minimum over an hourly book |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer |
| **Generator** | CRW-L2-01.mjs |

**Business Scenario.** A GPU cloud sells capacity reservations: a customer asks for a number of GPUs of one type, in one region, for a range of hours that can start months ahead and last for years. Requests for {{pool}} reach the reservation book in the order they are submitted, and each gets an answer straight away. A request is accepted only if, in every hour of its range, the GPUs already booked plus the new request stay within the pool's capacity for that hour. Otherwise it is rejected whole, with nothing booked. Customers can also cancel a reservation, which frees its GPUs for later requests. The book is hourly and covers several years.

**Problem Statement.** Implement `accept_reservations(horizon, capacity, ops)`. The book covers hours `0` to `horizon - 1`. `capacity` is a list of `(from_hour, gpus)` steps, sorted by hour, the first at hour 0; each step holds until the next one. `ops` is processed in order. `("reserve", rid, start, end, gpus)` asks for `gpus` GPUs in every hour of `[start, end)`: `end` is exclusive. It is accepted when, for every hour `h` in the range, the GPUs booked at `h` by accepted, uncancelled reservations plus `gpus` is at most the capacity at `h`. `("cancel", rid)` releases reservation `rid` if it is accepted and not yet cancelled. Return one bool per op, in order: for a reservation, whether it was accepted; for a cancellation, whether it released something. A cancellation of a rejected, unknown or already cancelled id returns `False` and changes nothing. Every `rid` in a reserve op is unique. {{level_rule}}

**Constraints.** The timing check has 60 000 ops on a book of 52 560 hours (six years), with requests lasting between a year and a half and four and a half years. Checking or updating every hour of every request is billions of steps in CPython, and even a `min()` over a list slice copies tens of thousands of values per request. Something close to O(log horizon) per op, after an O(horizon) setup, is expected.

**Assumptions.** Pools, capacities, request sizes and the six-year book are hypothetical; how real reservations are sold, sized and cancelled is not described here, so check current docs. One pool means one GPU type in one region. GPUs in a pool are interchangeable, so only the count per hour matters, not which machines. Hours are whole UTC hours.

**Clarifications.**
- Q: Is `end` part of the reservation? | A: No. `[start, end)` books hours `start` to `end - 1`, so a reservation ending at hour 10 and one starting at hour 10 never overlap.
- Q: Can a request be partly accepted, for the hours that fit? | A: No. It is accepted for its whole range or rejected with nothing booked.
- Q: Does a rejected request change anything for later requests? | A: No. Only accepted reservations book GPUs.
- Q: What does a cancellation of something that was rejected return? | A: `False`, and the book does not change. The same goes for an unknown id and a second cancellation.
- Q: Can a planned reduction leave a pool over capacity? | A: No. Steps are known before the first request, so every check already uses them.
- Q: Are the requests sorted by start hour? | A: No. They arrive in submission order, and that order decides who gets the capacity.

**Hints.**
1. Keep the headroom per hour: capacity minus GPUs booked. A request fits exactly when the minimum headroom over its range is at least its size.
2. You need two operations over a range: the minimum, and adding a value to every hour. Which structure does both in logarithmic time?
3. A segment tree over hours with a pending add stored on internal nodes (lazy propagation). A reservation adds `-gpus` to its range, a cancellation adds `+gpus`, and the leaves start from the capacity steps.

**Follow-ups.**
1. A rejected customer asks for the largest number of GPUs they could have over the same hours. How does your structure answer that with one query?
2. A rejected request may move: find the earliest start at or after the requested one where the same duration and size fit. How would you descend the tree to find it faster than trying every start?
3. Requests can be placed in either of two regions with different prices. Which rule decides, and what extra state would you keep so the choice can be explained to the customer later?
4. Several API servers accept requests for the same pool at once. How do you keep decisions consistent with submission order, and what do you persist so the book survives a restart?

**Follow-up rules.**
- when: for hour in range, per hour, every hour → ask: A request spans four years. How many steps does one check take, and how many for 60 000 requests?
- when: slice, numpy → ask: The minimum over a slice runs in C, but what does copying a 30 000-hour slice cost, and how do you update the booked counts afterwards?
- when: segment tree, lazy → ask: Why must a pending add be pushed down, or added on the way up, before you trust a child's minimum? Show a request that goes wrong if you skip it.
- when: sqrt, block, bucket → ask: Which block size do you pick for 52 560 hours, and how does the cost per request compare with a tree?
- when: interval tree, sorted list, bisect → ask: You keep accepted reservations as sorted intervals. How do you get the busiest hour inside a new request's range from them?

**Evaluation Criteria.** Half-open ranges; a request accepted only if every hour fits, at exactly capacity included; rejected requests book nothing; cancellations release only accepted, uncancelled reservations and return `False` otherwise; malformed requests rejected at Hard and Very Hard; capacity steps, including a step to 0, honoured at Very Hard; headroom with range minimum and range add in O(log horizon) per op (a lazy segment tree, or a block decomposition argued carefully); a clear complexity argument; sensible answers on largest fit, earliest start and concurrent acceptance.

## CRW-L2-02: Private interconnect plan: the cheapest links joining a customer's clusters

| | |
|---|---|
| **Template ID** | CRW-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / minimum spanning tree, Kruskal with union-find, a strict tie rule |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | CRW-L2-02.mjs |

**Business Scenario.** A customer runs several GPU clusters across sites and regions and wants them joined by private links, so that every cluster can reach every other one directly or through other clusters. A planning tool lists the candidate links the provider could set up, each with a hypothetical monthly cost. The tool must propose the cheapest set of links that joins every cluster, show its monthly total, and give the same answer every time it is run on the same input, so that a quote never changes between two runs.

**Problem Statement.** Implement `interconnect_plan(clusters, links, existing=())`. `clusters` is a list of distinct cluster ids. `links` is a list of `(link_id, cluster_a, cluster_b, monthly_cost)`: a link joins its two clusters in both directions, and `monthly_cost` is a positive integer. A plan is a set of links such that every cluster can reach every other one through links of the plan. Return `(total_cost, ids)` for the cheapest plan, where `ids` is the sorted list of its link ids. When several plans share the lowest total, compare links by `(monthly_cost, link_id)`, with link ids compared as strings: under that order no two links tie, and the answer is the plan that is cheapest under it, which is unique. If there is a single cluster, return `(0, [])`. {{level_rule}}

**Constraints.** The timing check is a stress test with 8 000 clusters and 100 000 candidate links. Adding links in cost order and running a search over the chosen links to test each one is O(E·(V + E)) and takes minutes. Something close to O(E log E) is expected.

**Assumptions.** Clusters, sites, links and costs are hypothetical; how private networking is really priced or provisioned is not described here, so check current docs. Every link has the same capacity, so cost is the only thing that matters. The input can contain many links of equal cost.

**Clarifications.**
- Q: Do two clusters need a direct link? | A: No. A path through other clusters is enough.
- Q: Which plan do I return when two have the same total? | A: The one the `(monthly_cost, link_id)` order prefers. It is the same as raising every cost by a tiny amount that grows with the link id, which makes the cheapest plan unique.
- Q: Are link ids zero-padded? | A: Yes, they have a fixed width, so comparing them as strings and as numbers agree.
- Q: What if a link names the same cluster twice? | A: It joins nothing, so it is never part of a plan. That only happens where the statement says so.
- Q: Must `ids` be in the order I chose the links? | A: No. Return them sorted.

**Hints.**
1. A cheapest plan never contains a cycle: dropping the most expensive link of a cycle keeps everything joined and costs less. So a plan for n clusters has n − 1 links.
2. Take links from cheapest to most expensive and keep a link only if its two clusters are not yet joined. Why is that safe?
3. "Are these two clusters already joined?" is a union-find question. Use path compression (or halving) and union by size or rank, and stop once one group remains.

**Follow-ups.**
1. The customer wants every cluster to stay reachable if any single link fails. What changes in the problem, and what would you propose?
2. One link's monthly cost drops after the plan is made. How do you update the plan without rebuilding it from scratch?
3. Links now have bandwidth, and traffic between some pairs of clusters must fit. Why is the cheapest plan no longer enough, and how would you approach it?
4. The customer adds a rule that no two clusters may be more than three links apart. How does that change the difficulty, and what would you do in practice?

**Follow-up rules.**
- when: bfs, dfs, breadth first, depth first → ask: You search the chosen links for every candidate. How many searches is that at 100 000 links, and how big does each get?
- when: union find, union-find, disjoint set → ask: Which optimisations do you use, and what does a find cost without them after a long chain of unions?
- when: prim, heapq, priority queue → ask: Your heap is keyed by cost. When two links cost the same, does your key give the same plan as the tie rule? Show why.
- when: dijkstra, shortest path → ask: A shortest-path tree from one cluster minimises the distance from that cluster, not the total cost. Give a small example where the two differ.
- when: none, unreachable, disconnected → ask: The customer gets `None`. How would you tell them which clusters cannot be reached, and which link they would need to order?

**Evaluation Criteria.** The cheapest plan with n − 1 links; the `(monthly_cost, link_id)` tie rule applied, so equal-cost inputs give one answer; sorted ids and the right total; one cluster gives `(0, [])`; at Hard and Very Hard, self-links and unknown clusters ignored, parallel links handled and `None` when no plan exists; at Very Hard, existing links counted as joined and never returned; Kruskal with union-find (or Prim with a heap keyed by the same order) rather than a search per link; a clear argument for why the greedy choice is safe; sensible answers on redundancy, cost changes and bandwidth.

## CRW-L2-03: Debug the GPU-hour invoice calculator

| | |
|---|---|
| **Template ID** | CRW-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Billing code / per-second metering, reserved hours per month, price amendments, month boundaries, rounding once |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, ai-infra-engineer |
| **Generator** | CRW-L2-03.mjs |

**Business Scenario.** A GPU cloud bills GPU instances by the second. Customers with a reservation get a number of GPU-hours each month at a reserved rate, and usage beyond that is billed at the on-demand rate, which can be amended in the middle of a month. Finance and customers have reported several problems with the monthly invoice lines. A training job that ran for three days was billed for a few hours. A customer's reserved hours seem to run out in their second month. A run that started before a price change was billed entirely at the old price. Usage from the first hours of a month appears on the previous month's invoice. Totals are sometimes a cent off from the customer's own calculation. The calculator below is the suspect.

**Problem Statement.** Fix `monthly_invoice_lines(runs, prices, reservations)` so that it meets this specification. {{replay_rule}}
1. **Runs.** `runs` are dicts `{"customer", "gpu_type", "gpus", "start", "end"}` for instance runs. `start` and `end` are ISO 8601 timestamps in UTC with whole seconds, and `end` is at or after `start`. A run's usage is `gpus` times its length in seconds: metering is per second (this exercise's rule).
2. **Months.** Usage belongs to the calendar month in UTC in which it happened. A run across a month boundary is split at the boundary.
3. **On-demand prices.** `prices` are dicts `{"gpu_type", "from", "cents_per_hour"}`: the on-demand price per GPU-hour from `from` until that type's next row. Usage is priced at the row in force when it happened, so a run across an amendment is split at it. Every run starts after its type's first row.
4. **Reserved hours.** `reservations` maps `"<customer>|<gpu_type>"` to `{"hours", "cents_per_hour"}`. Each calendar month, the first `hours` GPU-hours of that customer's usage of that type are billed at the reserved rate, and the rest at on-demand prices. Reserved hours cover the month's earliest price period first. Unused reserved hours do not carry over. A customer and type with no entry pays on-demand prices for everything.
5. **Output.** A dict keyed `"<customer>|<YYYY-MM>|<gpu_type>"` for every line with usage, each value `{"gpu_seconds", "reserved_seconds", "on_demand_seconds", "amount_cents"}`. `amount_cents` is the exact amount of the line, reserved GPU-seconds times the reserved rate plus each period's on-demand GPU-seconds times its rate, divided by 3 600 and rounded **once**, half up, to a whole cent.

**Constraints.** Keep the function's name, arguments and output format. Keep money exact: integers until the single rounding. Up to 100 000 runs, processed in close to linear time.

**Assumptions.** Prices, reservations, customers and the per-second rule are hypothetical; how any real GPU cloud meters, prices and rounds is not described here, so check current docs. A reservation's rate and hours do not change within the data. Months are cut in UTC.

**Clarifications.**
- Q: Which price applies to a run that crosses an amendment? | A: Each part at its own price: the seconds before the amendment at the old price, the seconds after at the new one.
- Q: Do unused reserved hours roll into the next month? | A: No. Every month starts with the full `hours`, used or not.
- Q: When reserved hours run out in the middle of a month with two prices, which seconds become on-demand? | A: The later ones. Reserved hours cover the earliest price period first.
- Q: How is half a cent rounded? | A: Up. 2.5 cents is 3 cents. And the line is rounded once, not each part of it.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Feed the calculator one run of two days and three hours and read the GPU-seconds it reports.
2. Follow the variable that holds the remaining reserved seconds from one invoice line to the next. What is it keyed by?
3. Inside the loop over a run's pieces, which variables describe the piece and which describe the whole run?
4. Work out a 36-second run at 250 cents per GPU-hour by hand, then read every `round`.

**Follow-ups.**
1. A price amendment is announced after the month has started and backdated to its first day. Which invoice lines change, and what does the customer see?
2. A customer disputes a line. What would you store with each invoice line so support can rebuild it second by second?
3. Usage records arrive up to a day late from some regions. When is a month's invoice final, and how do you issue a correction after that?
4. Reservations become pooled across GPU types at different conversion rates. How would the allocation of reserved hours change, and which order would you choose?

**Follow-up rules.**
- when: .seconds, timedelta, total_seconds → ask: What does `timedelta(days=2, hours=3).seconds` return, and where else in a billing system could the same mistake hide?
- when: carry over, roll over, remaining → ask: Where does the remaining reserved allowance live, and what key would make it impossible to leak from one month into the next?
- when: round, rounding, half up → ask: Python's `round(2.5)` is 2. Which rounding rule does your fix use, and how do you keep the amount exact until you apply it?
- when: float, decimal → ask: Where could a float enter this calculation, and what is the largest line amount before an error in the last cent is possible?
- when: split, boundary, amendment → ask: A run crosses both a month end and an amendment within the same hour. Walk through how your loop splits it.

**Evaluation Criteria.** Finds and explains every bug with its finance or customer symptom; usage metered for every second of a run, including whole days; reserved hours reset each month; each piece of a run priced at the rate in force when it happened and billed to the month it happened in; one rounding per line, half up, on an exact integer amount; minimal fixes that keep the output format; a regression test per bug.

## CRW-L2-04: Object storage request logs into per-customer usage

| | |
|---|---|
| **Template ID** | CRW-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Usage pipelines / log ingestion, late batches, deduplication, daily billable totals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_requests": {"2": ["2 billion", "5 billion"], "3": ["20 billion", "60 billion"]},
  "late_hours": [6, 24, 48],
  "storage_classes": ["standard and infrequent access", "hot, standard and archive"],
  "gateways": [12, 40, 120]
}
```

**Business Scenario.** A GPU cloud also sells object storage, used for training data, checkpoints and model artefacts. Customers are billed per day for the bytes stored in each storage class ({{storage_classes}}), for requests by kind, and for bytes read out. About {{daily_requests}} requests a day pass through {{gateways}} storage gateways, each writing request logs in batches. Most batches land within minutes, but a gateway that loses its connection can deliver a batch up to {{late_hours}} hours late, and a retried upload can deliver the same batch twice. Finance wants daily billable totals per customer, bucket and storage class that match the invoice, and customers want to see their own usage the next morning.

**Problem Statement.** Design the pipeline from gateway request logs to daily billable usage per customer. Cover the log record and batch format, how batches are ingested and deduplicated, how late batches reach past days, how stored bytes per day are computed (from requests, from bucket snapshots, or both), how requests and bytes read are counted by kind and class, when a day is final and how corrections are issued, and how each customer sees only its own usage.

**Constraints.** A batch delivered twice must never be billed twice. A day's totals must be re-runnable and give the same answer. Late batches up to {{late_hours}} hours must land on the day the requests happened. Stored bytes must account for objects that are overwritten, deleted or moved between classes. Object keys and contents are customer data: the pipeline uses sizes, classes and request kinds, never object contents.

**Assumptions.** Volumes, gateway counts, storage classes and lateness are hypothetical, and so is any billing rule; check current docs for real pricing and metering. Each gateway numbers its batches. Every request carries a bucket id and the server's timestamp. Buckets belong to exactly one customer.

**Clarifications.**
- Q: Is stored bytes per day the bytes at midnight, or an average? | A: Your choice, but say it, and keep it consistent between the invoice and what customers see. A time-weighted average (byte-hours) is common.
- Q: Can a request log tell us an object's size after an overwrite? | A: The PUT logs the new size; the old size is only known if you kept it. That is part of the design.
- Q: Which timestamp decides the day? | A: The gateway's request timestamp in UTC, not the arrival time of the batch.
- Q: Do failed requests count? | A: In this exercise, requests that the service rejected with a server error are not billable; client errors are. Keep the status in the record.

**Hints.**
1. Make every batch identifiable (gateway id plus sequence number) and record which batches have been applied, so a replay is a no-op.
2. Request counts and bytes read are additive per day. Stored bytes are a state: derive them from a per-object size ledger, or reconcile against a daily bucket inventory.
3. Write daily totals as partitions you can rebuild: when a late batch arrives, recompute that day's partition, not a running counter.

**Follow-ups.**
1. A gateway's clock drifts by two hours for a day. How would you detect it, and which days' totals move when you fix it?
2. A customer moves a petabyte from one class to another in an hour. How does your stored-bytes calculation treat that day?
3. A late batch arrives after the month's invoice was issued. What do you do, and what does the customer see?
4. Volume grows to ten times {{daily_requests}} a day. Which stage breaks first, and how do you scale it?

**Follow-up rules.**
- when: exactly once, exactly-once → ask: Where exactly is the duplicate batch dropped, and what proves to finance that it was?
- when: snapshot, inventory, listing → ask: The daily inventory and the request-derived bytes disagree by 0.3% for one bucket. Which do you bill, and how do you investigate?
- when: arrival time, ingestion time, processing time → ask: A batch from yesterday 23:50 arrives today at 03:00. Which day does it bill to, and when do you consider yesterday final?
- when: counter, increment, running total → ask: A batch is replayed after a crash halfway through. How do your counters avoid counting part of it twice?
- when: object key, file name, contents → ask: Why do you need that field for billing, and who could read it in the analytics tables?

**Production Reality Check.**
- A gateway restarts with its batch sequence reset to 1, and its new batches are dropped as duplicates of old ones for six hours.
- After a network outage, one site's gateways deliver {{late_hours}} hours of batches at once, and the day's totals for its customers change after customers have already looked at them.
- A lifecycle rule moves millions of objects to a colder class overnight, and stored bytes for both classes are counted for the whole day.

**Evaluation Criteria.** Batch identity and an applied-batch record for idempotent ingestion; event-time days with late batches rewriting their day's partition; a stated definition of stored bytes with a size ledger or inventory reconciliation; overwrites, deletes and class changes handled; billable status rules; a finality rule and versioned corrections; per-customer isolation and no object contents in the pipeline; a plan for each incident.

## CRW-L2-05: Cluster provisioning telemetry: from request to ready

| | |
|---|---|
| **Template ID** | CRW-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Lifecycle events / state machines, stuck-request detection, customer-facing status |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer, ml-platform-engineer, software-engineer |

```params
{
  "daily_requests": {"2": ["3 000", "8 000"], "3": ["40 000", "100 000"]},
  "max_nodes": [64, 256, 1024],
  "stuck_minutes": [20, 45, 90],
  "regions": [4, 8, 15]
}
```

**Business Scenario.** Customers of a GPU cloud create Kubernetes-based clusters and add node pools of GPU nodes, up to {{max_nodes}} nodes in one request. A request moves through stages: capacity allocated, nodes imaged, health checks passed, nodes joined to the cluster, and the request ready. There are about {{daily_requests}} provisioning requests a day across {{regions}} regions. Customers see a status page for each request, operators want to find requests that are stuck (no progress for {{stuck_minutes}} minutes), and the product team wants weekly reports of time to ready by region and GPU type.

**Problem Statement.** Design the telemetry for cluster and node-pool provisioning. Cover the events each stage emits for the request and for each node, the state model and its allowed transitions, how a request's state is derived from its nodes' states, how out-of-order and duplicate events are handled, how stuck requests and stuck nodes are detected and alerted on, what the customer sees and how often it updates, and the tables behind the weekly time-to-ready reports.

**Constraints.** Status shown to a customer must never go backwards because of an out-of-order event. A request for {{max_nodes}} nodes must not need {{max_nodes}} separate status lookups to render. Stuck detection must fire within a few minutes of the {{stuck_minutes}}-minute threshold and must not page on requests that are waiting on purpose, for example for capacity a customer agreed to wait for. Customers see only their own requests. Reports must handle requests cancelled part-way.

**Assumptions.** Stage names, volumes, thresholds and region counts are hypothetical; this exercise does not describe how any real provider provisions clusters, so check current docs. Each node and each request has a stable id. Components emit events with their own timestamps, and clocks can disagree by seconds.

**Clarifications.**
- Q: When is a request ready: all nodes, or enough of them? | A: In this exercise, when every node requested is ready, or when the customer accepted a partial cluster. Record which.
- Q: Can a node go back from health checks to imaging? | A: Yes, when a check fails and the node is re-imaged or replaced. That is progress, not a regression of the request.
- Q: What is a stuck request? | A: One where no node has moved forward for {{stuck_minutes}} minutes and the request is not in a deliberate waiting state.
- Q: Do customers see per-node detail? | A: They see counts per stage and a reason for any node that failed, never other customers' information or internal host names.

**Hints.**
1. Make each node a small state machine with versioned transitions, and derive the request's state from counts of nodes per stage rather than storing it independently.
2. Separate "the last time anything progressed" from "the last event received", and drive stuck detection from the first.
3. Keep an append-only event log for reporting, and a current-state table keyed by request for the status page.

**Follow-ups.**
1. A health-check component restarts and re-sends every result from the last hour. What does your design do with them?
2. Customers ask for an estimated time to ready. What data would you use, and how would you avoid promising too much?
3. Time to ready for one region doubles overnight. How would you find which stage is responsible?
4. At {{daily_requests}} requests a day with {{max_nodes}}-node pools, which part of the pipeline is the bottleneck, and how do you scale it?

**Follow-up rules.**
- when: state machine, transition → ask: A "joined" event arrives before "health checks passed" for the same node. What does your state machine do, and what does the customer see?
- when: polling, poll → ask: How often does the status page poll, and what does that cost at {{daily_requests}} requests a day?
- when: timeout, threshold, heartbeat → ask: A request waits for capacity on purpose for three hours. How does your stuck detector know not to page?
- when: percentile, p95, median → ask: Do cancelled and partial requests enter your time-to-ready percentiles? Which choice could hide a problem?
- when: kafka, stream, queue → ask: Events for one node land on two partitions. How do you keep its transitions in order?

**Production Reality Check.**
- An imaging service bug marks nodes imaged twice, and status pages show some requests jumping back to an earlier stage for an hour.
- Stuck alerts fire for hundreds of requests in one region that are correctly waiting for capacity, and the on-call engineer mutes the alert for the night.
- A pool of {{max_nodes}} nodes has one node that never passes health checks, and the customer's request has shown 99% for {{stuck_minutes}} minutes without a reason.

**Evaluation Criteria.** Per-node state machines with versioned, idempotent transitions; request state derived from node counts and never moving backwards on stale events; stuck detection based on progress, with deliberate waits excluded; customer status that is fast, aggregated and isolated per customer; an append-only log and report tables that treat cancelled and partial requests explicitly; a plan for each incident.
