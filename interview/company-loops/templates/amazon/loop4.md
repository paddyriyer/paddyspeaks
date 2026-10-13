# Amazon · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of an online
marketplace with its own fulfilment and delivery network and a public cloud.
Every workload, number and schema is hypothetical, and nothing here describes
how any company's systems are actually built.

## AMZ-L4-01: Inventory availability and reservations during a lightning deal

| | |
|---|---|
| **Template ID** | AMZ-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed consistency / inventory reservations, hot keys, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "fcs": {"2": [60, 120], "3": [250, 400]},
  "peak_orders": {"2": ["3,000", "8,000"], "3": ["25,000", "60,000"]},
  "deal_units": ["5,000", "20,000", "80,000"],
  "hold_minutes": [10, 20, 30]
}
```

**Business Scenario.** A marketplace ships items from {{fcs}} fulfilment centres, alongside third-party sellers who hold their own stock. Stock in a fulfilment centre changes all day: receiving, picks, damages, transfers between centres, customer returns put back on the shelf, and adjustments when a cycle count finds the shelf disagrees with the system. Product pages show whether an item is in stock and when it can arrive; checkout must not accept an order that no fulfilment centre can fill. A lightning deal offers {{deal_units}} units of one item at a discount for a short window. Marketplace-wide orders peak at {{peak_orders}} per second, and in the first minute of the deal a large share of them are for that one item.

**Problem Statement.** Design the inventory availability system. Cover the source of truth for on-hand stock per item and fulfilment centre; the available-to-promise number (on hand, minus reserved, minus anything held back); reservations taken when an order is placed and released when it is cancelled, when payment fails, or when it is not confirmed within {{hold_minutes}} minutes; the read path for product pages; the write path for checkout; and reconciliation with physical counts. Say how a single deal item with thousands of orders per second is handled without overselling.

**Constraints.** The deal must never sell more than {{deal_units}} units. Product page availability reads p99 under 20 ms and may be a few seconds stale; the checkout reservation decision p99 under 200 ms and must be exact. A fulfilment centre can lose connectivity to the central systems for several minutes and keeps picking, receiving and counting while disconnected. Every unit change must be traceable to the event that caused it.

**Assumptions.** All volumes, timings and counts are hypothetical. Each fulfilment centre runs a warehouse system that is the authority for what is physically on its shelves and emits stock-change events. Payment authorisation is a separate service that answers in under a second, or times out.

**Clarifications.**
- Q: Is a reservation tied to a specific fulfilment centre? | A: At order placement it can be tied to a region or a centre; you decide, and say what that costs you when a centre runs short.
- Q: Do carts reserve stock? | A: No. Only placed orders reserve.
- Q: Can the product page show "in stock" when the last units are reserved but unpaid? | A: Your call; say what customers see and why.
- Q: What happens to an order whose reserved unit turns out not to exist? | A: It is re-sourced from another centre if possible; otherwise it is delayed or cancelled with notice. Both cost money and trust.
- Q: Do third-party sellers' own stock counts go through the same system? | A: Their counts arrive as feeds and API updates; treat them as less timely and less trusted than a fulfilment centre's.

**Hints.**
1. Separate the exact, low-volume write path (reservations) from the approximate, very high-volume read path (product pages). They need different stores and different guarantees.
2. One row decremented thousands of times a second is a hot key. Think about splitting a deal's units into several independently decremented allotments.
3. Model stock as an append-only log of changes keyed by event id; the counts are a projection of it. That gives you idempotency, replay and an audit trail.

**Follow-ups.**
1. Walk through one checkout for the deal item: which records change, in what order, and what makes the decrement exact when two requests race for the last unit?
2. Splitting the deal's units into allotments helps throughput, but one allotment can run dry while others still hold units. How do you rebalance without overselling?
3. A fulfilment centre reconnects after 25 minutes offline and sends its backlog. How do you merge it without double counting or losing a pick?
4. A cycle count shows a popular item is short at one centre, and some of the missing units are already promised to customers. What does the system do automatically?
5. How would you prove, after the event, that the deal sold exactly what it was allowed to and no more?

**Follow-up rules.**
- when: lock, row lock, select for update, mutex → ask: Thousands of checkouts per second wait on that one lock for the deal item. What is the p99 reservation latency now, and what do you change?
- when: cache, redis, in-memory counter → ask: The cache node holding the deal counter fails mid-deal. What is the count on the replacement, and how do you know it has not oversold?
- when: eventual consistency, eventually consistent, async → ask: Which number in your design is allowed to be eventually consistent, and which one must never be? Show me where the boundary is.
- when: shard by sku, partition by item, shard by item → ask: The deal item lives on one partition and takes a large share of all writes in the first minute. What happens to the other items on that partition?
- when: ttl, expire, expiry, timeout → ask: The process that releases expired reservations stalls for an hour. What do customers see, and what do you lose?

**Production Reality Check.**
- The deal opens and reservation latency for the deal item climbs to 4 seconds. Checkout clients time out and retry, and the reservation count for the item rises faster than orders are placed.
- A cycle count at one fulfilment centre finds 1,200 fewer units of a best-selling item than the system shows; about 300 of them are already reserved for orders promised for tomorrow.
- One of the {{fcs}} fulfilment centres is cut off from the central systems for 25 minutes during the deal and keeps picking and receiving.
- The release of reservations not confirmed within {{hold_minutes}} minutes stops for an hour. The deal item shows sold out while more than a quarter of its {{deal_units}} units are held by expired reservations and sit unsold on shelves.

**Evaluation Criteria.** Separates the exact reservation path from the cached availability read path; stock as an append-only, idempotent change log with projections; atomic conditional decrements and a hot-key strategy (allotments with rebalancing, or a single-writer per deal) that cannot oversell; reservations with explicit states and expiry; idempotent retries keyed by order line; merge rules for disconnected centres and authority boundaries; reconciliation against physical counts with automatic re-sourcing; an audit that proves units sold; adapts to each incident with diagnosis, recovery and prevention.

## AMZ-L4-02: Package tracking and delivery-promise accuracy platform

| | |
|---|---|
| **Template ID** | AMZ-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Event processing / out-of-order scans, state machines, metric definition |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "packages": {"2": ["5 million", "12 million"], "3": ["30 million", "70 million"]},
  "scans": [6, 10, 14],
  "carriers": [3, 8, 15],
  "freshness": ["1 minute", "5 minutes"]
}
```

**Business Scenario.** A retailer ships about {{packages}} packages a day through its own network and {{carriers}} external carriers. Each package collects about {{scans}} scan events on its way: packed and shipped at the fulfilment centre, sorted, loaded for line haul, received at a delivery station, out for delivery, and delivered or attempted, scanned by drivers' handheld devices. External carriers report through their own tracking feeds with their own status codes. Every order carries a promised delivery date set at checkout. Customers watch tracking pages; operations teams need a list of packages at risk of missing their promise within {{freshness}} of the scan that put them at risk; leadership reviews a daily promise-accuracy metric by region, carrier and shipping option.

**Problem Statement.** Design the platform: ingestion from scanners and carrier feeds, normalisation into one status model, the current state and full history of each package, the customer tracking read path, at-risk detection, and the daily promise-accuracy metric. Define the metric precisely and say how late or corrected events change it.

**Constraints.** Handheld devices buffer scans while offline, sometimes for hours, and send them later; events arrive out of order and some arrive twice. A delivered package can later be corrected (delivered to the wrong address, then recovered). Promise accuracy is measured by the end of the promised day in the delivery address's local time zone. Tracking pages p99 under 100 ms. The scan history of a package is kept for two years.

**Assumptions.** All volumes, counts and service levels are hypothetical. Every scan carries a package id, a scan code, a location, a device or carrier id, a device timestamp, and the time the platform received it.

**Clarifications.**
- Q: Which timestamp counts, the device's or the platform's? | A: You decide; device clocks are usually right but not always.
- Q: What exactly is "on time"? | A: Delivered on or before the promised date in the destination's local time. Attempts do not count as deliveries.
- Q: Can a promised date change after checkout? | A: Yes, when the customer is told of a delay. Leadership wants accuracy against the original promise, and operations also wants it against the latest one.
- Q: How are carriers' status codes mapped? | A: Each carrier publishes its codes; someone has to own a mapping, and new codes appear without warning.
- Q: Is the metric allowed to change after the day is reported? | A: That is a choice you must make and explain.

**Hints.**
1. A package is a state machine, but the current state must be derived from the history ordered by event time, not by arrival order.
2. Write down how each status (delivered, attempted, returned, lost) affects the metric before you design the pipeline that computes it.
3. "At risk" is a prediction: compare where the package is with where it needs to be to make the promise, given the remaining legs.

**Follow-ups.**
1. A "delivered" scan arrives before the "out for delivery" scan for the same package. What does the tracking page show, and what is stored?
2. How do you compute the daily promise-accuracy metric so it is stable enough for leadership but still correct when scans arrive a day late?
3. How does at-risk detection work, and how do you keep it from flooding operations with alerts for packages that will still make it?
4. A carrier adds a new status code that your mapping does not know. What happens to those packages on the tracking page and in the metric?
5. Leadership asks why accuracy in one region dropped two points last week. What does the platform let you show them within an hour?

**Follow-up rules.**
- when: kafka, kinesis, stream, partition → ask: What do you key the stream by, and how does that key keep every scan for one package in order for the state machine?
- when: latest status, last event, overwrite → ask: An offline device uploads a scan from four hours ago after newer scans arrived. Does your latest-status update go backwards?
- when: utc, timestamp, timezone, time zone → ask: A package for an address eight hours west of UTC is delivered at 22:00 local time on the promised day. Is it on time in your metric?
- when: dedup, deduplicate, duplicate → ask: Two scans have the same package, code and location, eleven seconds apart. Are they duplicates? What is your key?
- when: alert, page, notify → ask: How many at-risk alerts does your rule raise on a normal day, and who acts on each one?

**Production Reality Check.**
- A handheld app release stamps scans with the device clock, and devices in one region have clocks a day ahead. For 3% of that region's packages, "delivered" is recorded a day after the promise and the region's accuracy drops overnight.
- One of the {{carriers}} external carriers' feeds stops for 9 hours, then sends the backlog at once. During the gap the at-risk list grows by tens of thousands; after it, alerts storm.
- A change computes the day boundary of the promise-accuracy metric in UTC instead of the destination's local time; the metric for the westernmost region falls 6 points.
- A sort centre outage delays a fifth of one day's packages, but the tracking page keeps saying "arriving today" for them until the evening.

**Evaluation Criteria.** Normalised status model with an owned carrier-code mapping; per-package ordering by event time with duplicate handling; current state derived from history so late events cannot regress it; a precise, local-time promise-accuracy definition with a stated restatement policy; at-risk detection based on remaining legs, with alert budgets; tracking reads from a keyed store; device-time sanity checks; carrier feed health monitoring; adapts to each incident with diagnosis, recovery and prevention.

## AMZ-L4-03: Multi-account cloud cost and usage analytics

| | |
|---|---|
| **Template ID** | AMZ-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Batch and incremental processing / restated data, cost allocation, anomaly detection |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "accounts": {"2": ["400", "1,500"], "3": ["8,000", "20,000"]},
  "line_items": {"2": ["150 million", "400 million"], "3": ["3 billion", "8 billion"]},
  "teams": [40, 150, 600],
  "untagged": ["15%", "30%", "45%"],
  "alert_within": ["6 hours", "24 hours"]
}
```

**Business Scenario.** A company runs its workloads in {{accounts}} public cloud accounts grouped under one organisation, used by {{teams}} engineering teams. The cloud provider delivers a cost and usage export to object storage: hourly line items per account, resource, service and usage type, with list cost, discounts from commitment purchases (savings plans and reserved capacity), credits, refunds, and the user-defined cost-allocation tags that were active. For the current month the export is rewritten several times a day, and line items can change until the month's invoice is final. That is about {{line_items}} line items a month. About {{untagged}} of spend carries no team tag. Finance wants monthly chargeback per team that matches the invoice to the cent; engineers want daily cost per service and an alert within {{alert_within}} when their spend jumps.

**Problem Statement.** Design the cost analytics platform: ingestion of export files that are rewritten rather than appended; a cost model that allocates shared and untagged spend, spreads commitment purchases over the period they cover, and handles credits and refunds; serving for finance and engineers; spend anomaly detection; and the month-end close that ties to the invoice.

**Constraints.** Monthly totals per account must equal the invoice exactly. Accounts move between teams during the month after reorganisations, and chargeback must follow the move from its effective date. Engineers see their own teams' resource-level detail; organisation-wide views are aggregated. The platform's own compute spend must stay small relative to what it measures.

**Assumptions.** All account counts, volumes and percentages are hypothetical. The export's columns are documented by the provider and change occasionally; files for a month are delivered as a set with a manifest that identifies the version.

**Clarifications.**
- Q: Do we load every new version of the month's files? | A: Every version supersedes the previous one for that month; you decide how much of it you reprocess.
- Q: How is a commitment purchased up front shown? | A: As a fee in the month of purchase; the export also carries amortised cost columns that spread it. Finance wants amortised cost for chargeback.
- Q: Who decides how untagged spend is allocated? | A: Finance owns the policy; you propose one.
- Q: How fresh is the export? | A: Hours behind usage, not minutes.
- Q: Are there shared costs beyond untagged ones? | A: Yes: shared clusters, networking, support charges, and data transfer between accounts.

**Hints.**
1. A rewritten file is a new version of the truth for that month, not new rows. Load by version and swap atomically.
2. Keep three layers apart: raw line items as delivered, a normalised cost fact with amortised and unblended costs, and allocated cost per team under a versioned allocation policy.
3. The export cannot see a spike faster than it is delivered. Decide what else the alerting can use.

**Follow-ups.**
1. A new version of this month's export arrives while yesterday's dashboards are being served. Walk through loading it so no one ever sees a half-loaded or doubled month.
2. How do you allocate the shared cluster's cost to the teams that run on it, and how do you explain the result to a team that disputes it?
3. An account moves from one team to another on the 14th. How is the month split, and what happens if the move is recorded a week late?
4. How do you detect a spend anomaly within {{alert_within}} without paging forty teams every time a commitment is purchased or a credit lands?
5. At month close the platform's total differs from the invoice by a small amount for three accounts. How do you find the cause?

**Follow-up rules.**
- when: append, insert, incremental load → ask: The provider rewrites the whole month several times a day. What happens to totals if you append each delivery?
- when: tag, tags, tagging → ask: A third of spend is untagged, and tags were added to resources halfway through the month. How does that spend reach a team, and can a team game it?
- when: unblended, list price, on-demand → ask: A team's workload is covered by a commitment the organisation bought. Which cost does the team see, and does it add up to the invoice?
- when: z-score, anomaly, threshold, standard deviation → ask: Spend is spiky by nature: month-start fees, weekend batch jobs, credits. How does your detector tell a runaway job from a scheduled one?
- when: real-time, streaming, minutes → ask: The export is hours behind usage. Where does a near-real-time signal come from, and how does it reconcile with the export later?

**Production Reality Check.**
- A new version of the month's export lands while the loader is midway through the previous one; for two hours dashboards show some accounts' month-to-date cost doubled.
- A reorganisation moves 120 of the {{accounts}} accounts to new teams on the 14th, but the mapping is updated on the 21st; finance's draft chargeback assigns the whole month to the old teams.
- The organisation buys a large commitment on the 1st. The up-front fee appears as one line item, and the anomaly detector pages dozens of the {{teams}} teams.
- A runaway job in one account spends eight times its normal daily cost over a weekend; the alert fires 30 hours after it started, longer than the {{alert_within}} target.

**Evaluation Criteria.** Version-aware ingestion with atomic month swaps and manifest validation; layered model (raw, normalised cost, allocated) with amortised commitments, credits and refunds; a versioned, finance-owned allocation policy for shared and untagged spend with effective-dated account ownership; reconciliation to the invoice at close; anomaly detection that separates scheduled charges from runaway usage and uses a faster signal than the export where needed; access scoped by team; costed processing; adapts to each incident with diagnosis, recovery and prevention.

## AMZ-L4-04: Point-in-time feature platform for demand-forecast backtests

| | |
|---|---|
| **Template ID** | AMZ-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | ML data platform / bitemporal features, point-in-time joins, training–serving parity |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, ai-infra-engineer |

```params
{
  "series": {"2": ["20 million", "60 million"], "3": ["300 million", "800 million"]},
  "horizon_weeks": [8, 13, 20],
  "features": [150, 400, 1200],
  "backtest_years": [2, 3]
}
```

**Business Scenario.** A retailer forecasts weekly demand for {{series}} item-and-region series, {{horizon_weeks}} weeks ahead, and the forecast drives what is bought and where it is placed. Models use about {{features}} features: past sales, prices, planned and actual promotions, product page views, out-of-stock flags (sales are zero when nothing could be sold, which is not the same as zero demand), item attributes and holidays. Many sources are corrected after the fact: returns adjust sales, prices are fixed, promotion calendars are edited weeks after planning. Forecasters test every model change with a backtest that replays {{backtest_years}} years of weekly forecast dates, and the result decides whether it ships.

**Problem Statement.** Design the feature platform: how features are stored with both the time they describe and the time they became known; how training sets and backtests are built with point-in-time joins so each forecast date sees only what was known then; how the weekly production run gets exactly the same feature definitions; how corrections and backfills are handled; and how lineage, cost and freshness are managed.

**Constraints.** A backtest that uses information unavailable on the forecast date is invalid, however good it looks. Production features for every series must be ready by 06:00 on the run day. A feature definition change must not silently change past backtest results. Storage and compute grow with series × features × history; say what that costs.

**Assumptions.** All counts, sizes and timings are hypothetical. Source systems publish changes with an event time; some only publish full daily snapshots.

**Clarifications.**
- Q: Do we keep every correction, or only the latest value? | A: That is the core of your design. Say what you keep and for how long.
- Q: How are promotions known in advance? | A: Planned promotions are entered weeks ahead and edited; what actually ran is known afterwards. Both are features.
- Q: Are features computed per series, or shared? | A: Both. Item attributes are shared across regions; sales are per series.
- Q: How often do forecasters run backtests? | A: Dozens a week, each over thousands of forecast dates for a sample or all series.
- Q: Who defines features? | A: Forecasting scientists, in code reviewed by the platform team.

**Hints.**
1. Give every feature value two times: valid time (the week it describes) and knowledge time (when the platform learned it). A point-in-time join filters on knowledge time ≤ forecast date and takes the latest value.
2. A backfill that loads history today must say when that history would have been known, or it is invisible to every backtest.
3. Define each feature once, as code with a version, and run the same code for training, backtests and production.

**Follow-ups.**
1. Write the point-in-time join for one feature and one forecast date. What index or layout makes it cheap across {{series}} series?
2. Out-of-stock weeks make observed sales lower than demand. Where in the platform is that handled, and what does the model see?
3. A scientist changes the definition of a feature. How do old backtests stay reproducible while new ones use the new definition?
4. The full point-in-time join over {{backtest_years}} years is too slow and too expensive to run dozens of times a week. What do you precompute, and what does that cost in storage?
5. How would you detect that production features and backtest features for the same date differ?

**Follow-up rules.**
- when: snapshot, daily snapshot, overwrite → ask: The price for last March was corrected yesterday. If you keep only the latest snapshot, what does a backtest for last March see?
- when: as of, point in time, point-in-time, bitemporal → ask: How do you set knowledge time for a source that only sends full daily snapshots without saying what changed?
- when: online store, low latency, redis → ask: The production forecast is a weekly batch. What does an online store buy you here, and what does it cost?
- when: backfill, reprocess, recompute → ask: Your backfill is loaded today. Which knowledge time do you give two years of history, and what does each choice do to backtests?
- when: spark, join, shuffle → ask: Best-selling items have far more rows than the long tail. What happens to that join's partitions, and how do you fix it?

**Production Reality Check.**
- A new model beats production by 18% in backtest and loses to it in its first month live. The cause: its promotion feature read the final promotion calendar, including promotions added after each forecast date.
- A price source is backfilled for two years with knowledge time set to today. Every backtest since then is missing price for the whole history, and two model changes were approved on those runs.
- The weekly production feature build misses 06:00 by 9 hours: the point-in-time join over {{series}} series is skewed on a few thousand best-selling items.
- Out-of-stock flags for one region were missing for three weeks; the model read zero sales as zero demand, and the next {{horizon_weeks}}-week forecast for hundreds of items in that region dropped sharply.

**Evaluation Criteria.** Bitemporal storage with valid and knowledge times; point-in-time joins that are correct and laid out to be cheap; backfills with deliberate knowledge times; versioned feature definitions shared by training, backtests and production; explicit handling of censored demand; reproducible backtest manifests; skew-aware joins and precomputation with a costed storage plan; parity checks between production and backtest features; adapts to each incident with diagnosis, recovery and prevention.

## AMZ-L4-05: Multi-tenant metrics ingestion and alarm evaluation for a cloud monitoring service

| | |
|---|---|
| **Template ID** | AMZ-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant time series / ingestion quotas, rollups, alarm evaluation, cell isolation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer |

```params
{
  "datapoints": {"2": ["2 million", "8 million"], "3": ["40 million", "120 million"]},
  "alarms": {"2": ["5 million", "20 million"], "3": ["100 million", "300 million"]},
  "shortest_period": ["1 minute", "10 seconds"],
  "tenants": ["200,000", "1 million", "3 million"]
}
```

**Business Scenario.** A public cloud offers a managed metrics service in each of its regions. About {{tenants}} customer accounts publish datapoints from their resources and applications: a namespace, a metric name, a few dimensions as name and value pairs, a timestamp and a value. A region receives about {{datapoints}} datapoints per second. Customers graph metrics and create alarms: an alarm evaluates a statistic (average, maximum, a percentile) over a period as short as {{shortest_period}}, goes into alarm when M of the last N periods breach a threshold, lets the customer choose how missing data is treated, and triggers actions such as notifications or scaling. A region holds about {{alarms}} alarms.

**Problem Statement.** Design the service for one region: the ingestion front door with per-tenant limits, storage for recent high-resolution data and for longer-term rollups at coarser resolution, the query path for graphs, and the alarm evaluator, which must evaluate every alarm on schedule. Say how one tenant cannot hurt another, how the region is divided so a failure affects only part of it, and how late datapoints are handled.

**Constraints.** Each region is independent; nothing in one region may depend on another. An alarm must be evaluated within seconds of the end of its period plus a fixed allowance for late data. Graph queries over the last three hours p99 under 1 second. Customers pay per metric and per alarm, so counts must be exact. A datapoint's identity is tenant, namespace, metric name, dimensions and timestamp.

**Assumptions.** All rates, counts and periods are hypothetical. Customers' agents and resources publish with their own clocks and retry on failure.

**Clarifications.**
- Q: Can a datapoint arrive after its period was evaluated? | A: Yes, sometimes minutes later. The customer's missing-data choice decides how an empty period counts.
- Q: Is a new combination of dimensions a new metric? | A: Yes. Each unique combination is a separate time series and is billed as a metric.
- Q: What resolution must be kept, and for how long? | A: High resolution for hours to days, then coarser rollups for longer; you choose the tiers and say what queries lose.
- Q: Do alarm actions need exactly-once delivery? | A: An action fires on a state change; firing it twice for one change is a defect customers notice.

**Hints.**
1. Partition the region into cells, each holding a subset of tenants end to end (ingestion, storage, evaluation), so a bad cell or a bad tenant affects a bounded share of customers.
2. Pre-aggregate at ingestion into per-series, per-period statistic sets (count, sum, min, max and a mergeable sketch for percentiles) rather than storing and rescanning raw points.
3. Alarm evaluation is a scheduling problem: millions of small jobs due at period boundaries. Avoid making them all read storage at the same second.

**Follow-ups.**
1. How does ingestion enforce per-tenant limits on datapoints and on new series without slowing well-behaved tenants?
2. Walk through evaluating one alarm with a {{shortest_period}} period and "3 of 5" datapoints: when does it run, what does it read, and what if the last period's data is late?
3. How do you compute a p99 statistic for a period when datapoints for one series arrive at several ingestion hosts?
4. How do you move a very large tenant from one cell to another without missing an evaluation or firing a duplicate action?
5. What do customers see during a partial outage of the evaluator, and how do you decide whether to evaluate late or skip?

**Follow-up rules.**
- when: kafka, kinesis, queue, log → ask: How is that log partitioned, and what happens to a partition when one tenant suddenly publishes a hundred times its usual rate?
- when: cron, scheduler, every minute → ask: Most alarms have one-minute periods, so tens of millions of evaluations are due at the top of each minute. How do you spread that load without making alarms late?
- when: raw datapoints, store every point, raw → ask: At {{datapoints}} per second, what does storing every raw point cost, and which queries actually need it?
- when: percentile, p99, p95 → ask: Can the evaluator average per-host p99 values for one period? If not, what do the hosts send?
- when: retry, at least once, at-least-once → ask: An agent retries a batch that was already accepted. How is the datapoint not counted twice in the sum statistic?

**Production Reality Check.**
- A tenant deploys code that adds a request-id dimension to one metric; it creates millions of new series an hour, and its cell's ingestion latency rises for every tenant on it.
- Ingestion in one cell falls 3 minutes behind. Alarms that treat missing data as breaching fire for thousands of customers and trigger scale-out actions they did not need.
- During a large regional event, datapoints from {{tenants}} customers spike together and graph queries triple; the evaluator falls behind and alarms with a {{shortest_period}} period are evaluated late.
- One customer's agents publish datapoints timestamped two hours in the future, and that customer's dashboards and alarms behave strangely.

**Evaluation Criteria.** Cell-based isolation with tenant placement; per-tenant rate and series-count limits enforced at the front door; idempotent ingestion keyed by datapoint identity; statistic sets with mergeable sketches; tiered rollups with retention; an evaluator scheduled by period with a lateness allowance, missing-data semantics applied correctly and action firing on state change only; protection against cascading false alarms during the service's own degradation; timestamp validation; adapts to each incident with diagnosis, recovery and prevention.
