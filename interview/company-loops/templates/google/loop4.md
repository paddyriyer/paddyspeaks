# Google · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domains of a search,
video, maps, advertising and cloud company. Every workload, number and schema is
hypothetical, and nothing here describes how any company's systems are actually
built.

## GOO-L4-01: Search performance reports for site owners

| | |
|---|---|
| **Template ID** | GOO-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Batch and incremental analytics / log joins, fan-out aggregation, privacy thresholds, interactive serving |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_impressions": {"2": ["20 billion", "60 billion"], "3": ["200 billion", "500 billion"]},
  "properties": {"2": ["5 million", "15 million"], "3": ["40 million", "100 million"]},
  "min_searchers": [10, 25, 50],
  "freshness": ["6 hours", "2 hours"],
  "history_months": [16, 24]
}
```

**Business Scenario.** A web search engine gives site owners a free performance report. Owners verify a **property** (a URL prefix such as `https://www.example.com/`, or a whole domain including every subdomain and protocol) and then see clicks, impressions, click-through rate and average position, filterable and groupable by query, page, country, device and date, for the last {{history_months}} months. About {{properties}} properties are verified, and search results generate around {{daily_impressions}} result impressions per day. In this scenario the reporting rules are: a URL counts an impression when it appears on a results page the searcher saw; a click is a click on that URL's result; average position is the topmost position the property held on each results page, averaged over the pages where it appeared. Queries issued by fewer than {{min_searchers}} distinct searchers in a day are never shown as rows, but their clicks and impressions still count in the chart totals.

**Problem Statement.** Design the pipeline and serving system behind this report: from search serving logs (results pages with the URLs shown and their positions, and click events) to the numbers an owner sees. Cover joining clicks to impressions, mapping URLs to properties when properties overlap, the two aggregation modes (by property and by page), the rare-query privacy rule, storage and serving for interactive filtering over {{history_months}} months, data freshness of {{freshness}} for recent days, and how a day is corrected after it was published.

**Constraints.** No searcher identifier, IP address or raw log line ever reaches the reporting store. Interactive reports return in under 2 seconds at p95 for any property, however large. When grouped by property, one results page counts at most one impression for the property even if it shows three of its URLs; when grouped by page, each URL counts. Totals must equal the sum of all rows plus the withheld rare-query rows, and the report must explain why the rows do not add up to the total.

**Assumptions.** All volumes, thresholds and retention periods are hypothetical. One URL can belong to several verified properties at once (a domain property and two URL-prefix properties inside it, owned by different teams). Clicks arrive in the logs up to a few hours after the impression.

**Clarifications.**
- Q: Is the rare-query threshold applied per day or over the date range the owner selects? | A: Per query per day in this scenario. Be ready to discuss what changes if it had to hold over any range.
- Q: Do owners need data for the current day? | A: A preliminary view within {{freshness}} is wanted, clearly labelled, and replaced by final numbers.
- Q: How many properties can one URL belong to? | A: Usually one or two; a few large organisations verify dozens of nested prefixes.
- Q: Can owners export rows? | A: Yes, through the report and an API, under the same privacy rule and with a row limit per request.
- Q: What is the largest property? | A: A few properties see more than a billion impressions a day across millions of distinct queries.

**Hints.**
1. Join and attribute in the log domain first: one record per (results page, URL, position, clicked) before anything is grouped. Every later aggregate derives from that.
2. Property mode needs a de-duplication step per results page per property; page mode does not. Decide where that happens so you do not count twice.
3. The privacy rule needs a distinct-searcher count per query per day, which needs searcher identity — compute it inside the log boundary and ship only the decision.

**Follow-ups.**
1. Walk through how one results page showing two URLs from `www.example.com` becomes rows for a domain property and a URL-prefix property that both contain those URLs.
2. Owners filter by a query substring over {{history_months}} months on a property with millions of distinct queries. How is the store laid out so that answers in 2 seconds?
3. The threshold now has to hold over any date range the owner picks, not per day. What breaks in a precomputed design, and what would you build instead?
4. A logging defect inflated positions for 2 days of published data. How do you restate those days, and what do owners and the export API see while it happens?
5. Storage cost is dominated by the long tail of tiny properties. What do you change, and what do those owners lose?

**Follow-up rules.**
- when: partition by property, key by property, property_id → ask: One property gets more than a billion impressions a day across millions of queries. What happens to the worker that owns that key, and how do you split it without breaking the per-property de-duplication?
- when: join on url, url to property, prefix match → ask: A URL matches a domain property and three nested prefix properties. How do you find all of them per impression at this volume without a scan of every property?
- when: hyperloglog, hll, sketch, approximate distinct → ask: The privacy decision uses an approximate distinct count near the threshold of {{min_searchers}}. Which way should the error lean, and how do you make it lean that way?
- when: average of averages, avg position, mean position → ask: An owner groups by country, then by date. How do you store position so both averages are correct when you combine rows?
- when: overwrite, update in place, rewrite the day → ask: Owners pulled the old numbers through the API yesterday. How do they learn the day changed, and what does your store keep about the earlier version?

**Production Reality Check.**
- A serving change starts logging a results carousel as a single position. For 2 days, average position shifts for about 8% of properties, and owner forums notice before your monitors do.
- One news publisher's domain property produces 30% of a day's attributed rows during a breaking story. The daily aggregation for that day runs 9 hours and misses the {{freshness}} target for the preliminary view of every property.
- An export bug returns rows for queries below the {{min_searchers}}-searcher threshold for 3 hours before it is caught.
- A log storage outage delays one region's click logs by 7 hours; impressions for that region are on time, so click-through rate for the preliminary view drops sharply for that region.

**Evaluation Criteria.** Joins clicks to impressions within the log boundary with a defined lateness window; attributes URLs to all matching properties with an efficient prefix lookup; implements property-mode de-duplication per results page correctly and separately from page mode; computes the privacy decision inside the log boundary and ships no identifiers; stores additive sums (impressions, clicks, sum of top positions) so any grouping is correct; lays out storage per property and date with indexes for query filtering; versions published days and restates visibly; handles skewed properties; adapts to each incident with diagnosis, recovery and prevention.

## GOO-L4-02: Budget pacing for search ad campaigns across regions

| | |
|---|---|
| **Template ID** | GOO-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time distributed counters / pacing control, multi-region consistency, billing reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "campaigns": {"2": ["2 million", "5 million"], "3": ["20 million", "60 million"]},
  "auctions_per_sec": {"2": ["300,000", "800,000"], "3": ["3 million", "8 million"]},
  "regions": [3, 5, 8],
  "signal_delay": ["5 seconds", "30 seconds", "2 minutes"]
}
```

**Business Scenario.** An advertising platform runs an auction for every search results page that can show ads: about {{auctions_per_sec}} auctions per second served from {{regions}} regions. Around {{campaigns}} active campaigns each have an average daily budget in the advertiser's own time zone. Advertisers pay per click for most campaigns and per thousand impressions for some. In this scenario the budget rule is: a campaign may spend up to twice its average daily budget on a given day, but never more than 30.4 times its average daily budget in a calendar month; any spend above those limits is not charged. Advertisers also expect spend to be spread across the day rather than exhausted at 9 a.m. The auction servers see a spend signal that lags reality by about {{signal_delay}}.

**Problem Statement.** Design the spend tracking and pacing system. Cover how billable events (impressions, clicks) become spend, how each auction server decides whether a campaign may enter an auction and with what pacing, how spend and budget state are shared across {{regions}} regions, how you bound overdelivery given clicks that arrive minutes after the impression and a lagging signal, day and month boundaries in many time zones, invalid-click filtering that later removes charges, and how the advertiser's invoice reconciles with what the pacing system believed.

**Constraints.** The eligibility check sits on the auction path and may add at most a few milliseconds; it cannot call a remote counter per auction. A region must keep serving ads if it loses contact with the others. Charges are never above the stated limits, so overdelivery is the platform's cost, not the advertiser's. Spend shown to the advertiser must be within a few minutes of reality and must reconcile exactly with the invoice at month end.

**Assumptions.** All volumes, delays and budget figures are hypothetical; the budget rule above is the rule for this scenario. Most campaigns have small budgets; a few spend millions a day.

**Clarifications.**
- Q: Does the auction need exact remaining budget? | A: No. It needs a fast, local, conservative answer; exactness lives in billing.
- Q: How late can a click arrive? | A: Most within a minute of the impression; some hours later, and still billable.
- Q: How long until invalid clicks are removed? | A: Most within hours by an automated filter; some days later after review. Removed clicks are credited.
- Q: Can an advertiser change the budget mid-day? | A: Yes, and it should take effect within a minute.
- Q: Which time zone defines the day? | A: The advertiser's account time zone, including days with a daylight-saving change.

**Hints.**
1. Separate three numbers: spend the auction believes (fast, approximate), spend the advertiser sees (minutes), and spend that is billed (exact, final). Each has its own pipeline and owner.
2. Give each region a share of the remaining budget it can spend locally, and rebalance shares in the background. Think about what happens to a share when its region goes dark.
3. A click that has not happened yet is still exposure. Estimate in-flight cost from recent impressions.

**Follow-ups.**
1. What exactly does an auction server hold in memory per campaign, how is it refreshed, and what does it do when the data is older than expected?
2. A campaign with a small budget gets 500 clicks in 10 seconds after a news event. How much can it overspend with your design, and what bounds it?
3. One region is cut off for 20 minutes. What can it still spend, and what happens to its unused share when it returns?
4. Invalid-click filtering removes 4% of yesterday's clicks for one campaign, after the day closed. What changes in spend, in pacing and on the invoice?
5. How would you smooth delivery across the day so a campaign does not exhaust its budget early, and how do you know the controller works?

**Follow-up rules.**
- when: redis, central counter, global counter, decrement → ask: At {{auctions_per_sec}} auctions per second across {{regions}} regions, what is the round-trip cost of that counter on the auction path, and what happens when it is unreachable?
- when: kafka, stream, flink, event stream → ask: Your spend stream is {{signal_delay}} behind. How much budget can a high-spend campaign burn in that time, and what compensates for it?
- when: throttle, probabilistic, pacing multiplier, pacing rate → ask: How does your controller react to a traffic spike it has never seen at that hour without oscillating between spending everything and spending nothing?
- when: utc, timezone, midnight → ask: An advertiser in a time zone with a daylight-saving change has a 23-hour day. What happens to the pacing curve and to the twice-daily-budget limit?
- when: exactly once, idempotent, dedup → ask: A click event is delivered twice to your spend stream and once to billing. Which number is wrong, and who notices?

**Production Reality Check.**
- A breaking-news story multiplies query volume tenfold for 30 minutes on a topic where hundreds of small campaigns advertise. Several exceed twice their daily budget before the spend signal, about {{signal_delay}} behind, catches up, and the overdelivery is the platform's cost.
- A network partition isolates one of the {{regions}} regions for 20 minutes. It keeps serving on its local budget shares; when it rejoins, two other regions have already reallocated part of those shares.
- The invalid-click filter is delayed for 6 hours, then removes 3% of the day's clicks at once. Advertiser dashboards show spend going down, and pacing releases budget for the rest of the day.
- A daylight-saving change means one time zone's day has 25 hours. Pacing for every campaign in that zone runs out of budget an hour before its day ends.

**Evaluation Criteria.** Distinguishes auction-time, reported and billed spend; local, conservative eligibility with budget shares per region and background rebalancing; accounts for in-flight exposure and signal delay with an explicit overdelivery bound; a pacing controller with a target curve and damping; idempotent spend aggregation keyed by event id; correct day and month boundaries per advertiser time zone; invalid-click credits flowing to billing and pacing; reconciliation from billing to the invoice; adapts to each incident with diagnosis, recovery and prevention.

## GOO-L4-03: Playback quality telemetry for a video platform

| | |
|---|---|
| **Template ID** | GOO-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Stream processing / sessionisation, quality-of-experience metrics, high-cardinality alerting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "concurrent": {"2": ["4 million", "10 million"], "3": ["40 million", "90 million"]},
  "heartbeat_s": [10, 30, 60],
  "networks": ["5,000", "20,000"],
  "alert_minutes": [2, 5]
}
```

**Business Scenario.** A video platform serves on-demand and live video to {{concurrent}} concurrent viewers at peak. The player sends an event when playback starts, stalls, resumes, switches quality, errors or ends, and a heartbeat every {{heartbeat_s}} seconds while a session is open. Operations watches quality of experience: time to first frame, rebuffer ratio (stall time divided by stall time plus play time), average bitrate and playback failure rate, sliced by country, network operator (about {{networks}} of them), device class, app version and serving location. A cache cluster or a peering link that degrades must be visible within {{alert_minutes}} minutes; player teams compare adaptive-bitrate algorithms in experiments using daily, exact numbers.

**Problem Statement.** Design the telemetry platform: the event schema, ingestion from clients on unreliable networks, reconstructing each playback session, computing the quality metrics in real time and in a daily batch, detecting regressions across thousands of slices without paging on noise, and serving both the operations dashboards and the experiment analyses.

**Constraints.** Mobile clients lose events and may send them late or twice; sessions often end without an end event (the app is killed). Client clocks are unreliable. Real-time numbers may be approximate if labelled; the daily experiment tables must be reproducible. No viewer identity is needed for quality metrics, and none should be kept in the quality store.

**Assumptions.** All volumes, intervals and slice counts are hypothetical. Live events can triple concurrency within minutes.

**Clarifications.**
- Q: Do heartbeats carry deltas or running totals? | A: Your choice. Say why.
- Q: How is a session identified? | A: The player generates a playback session id per video start; it is not tied to the viewer's account in this telemetry.
- Q: What counts as a stall? | A: Playback stopped waiting for data after it had started. Seeking and the initial load are not stalls.
- Q: How many slices could alert? | A: Country × network × device class × serving location gives millions of combinations; most have little traffic.
- Q: What do experiment owners need? | A: Per-arm daily metrics with confidence intervals, computed the same way every time.

**Hints.**
1. Make heartbeats carry cumulative counters for the session (play time, stall time, stall count, bytes). Then a lost heartbeat costs freshness, not correctness.
2. Rebuffer ratio for a slice is total stall time over total watch time — a ratio of sums. Averaging per-session ratios answers a different question.
3. Alert on slices with enough traffic to be significant, against a baseline for that slice and hour, and roll up the hierarchy to find where the problem actually is.

**Follow-ups.**
1. A session's last heartbeat arrives and then nothing. When do you close it, what do you record, and what happens if an event for it arrives 40 minutes later?
2. How do you compute rebuffer ratio per slice every minute over {{concurrent}} concurrent sessions, and how do you combine slices into a country view?
3. A degraded cache cluster affects viewers in two countries on three networks. How does your detection name the cluster instead of paging six times?
4. An experiment arm shows 4% less rebuffering, but its sessions are 9% shorter. How do you decide whether the new algorithm is better?
5. An app release changes how stalls are reported. How do you notice that this is a measurement change rather than a quality change?

**Follow-up rules.**
- when: average ratio, avg rebuffer, mean of ratios → ask: One session watches 5 seconds with a 1-second stall; another watches an hour with none. What does your metric say about the slice, and what should it say?
- when: session window, gap, timeout → ask: A viewer pauses for 20 minutes and resumes. With your gap, is that one session or two, and what does it do to time to first frame?
- when: event time, watermark, late data → ask: Client clocks are unreliable. Which timestamp drives your windows, and what do you do with an event whose client time is two days in the future?
- when: threshold alert, static threshold, fixed threshold → ask: A slice with 40 sessions at 3 a.m. crosses your threshold every night. How do you keep paging meaningful across millions of slices?
- when: per user, user_id, account → ask: The constraint says no viewer identity in the quality store. What do you lose without it, and how do you answer a question that seems to need it?

**Production Reality Check.**
- A live sports final triples concurrency in 10 minutes, from {{concurrent}} toward three times that. Ingestion lag for the quality stream reaches 6 minutes, longer than the {{alert_minutes}}-minute detection target.
- An app release starts counting buffering after a seek as a stall. Rebuffer ratio for that app version rises 40% overnight while every other version is flat.
- A sampling config meant for 10% of clients ships at 100% for one platform. Event volume from that platform rises tenfold and its slices dominate the dashboards.
- One network operator's traffic arrives 2 hours late after an ingest outage in its country; real-time dashboards showed that operator as healthy (no data) during the outage.

**Evaluation Criteria.** Event schema with cumulative per-session counters and an idempotency key; session reconstruction with a stated timeout and late-event policy; ratio-of-sums metrics stored as additive numerators and denominators; event-time processing with protection against bad client clocks; per-slice baselines, minimum-volume rules and hierarchical localisation for alerting; separate real-time (approximate, labelled) and daily (reproducible) paths; treats "no data" as a signal; adapts to each incident with diagnosis, recovery and prevention.

## GOO-L4-04: Live road speeds and ETA accuracy from location probes

| | |
|---|---|
| **Template ID** | GOO-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Geospatial stream processing / map matching, privacy aggregation thresholds, offline evaluation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 55 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "probes_per_sec": {"2": ["200,000", "600,000"], "3": ["2 million", "5 million"]},
  "segments": ["40 million", "120 million"],
  "min_devices": [3, 5, 10],
  "update_every": ["1 minute", "2 minutes"]
}
```

**Business Scenario.** A maps product estimates live traffic from devices whose users have opted in to share location. Each device sends a location probe every few seconds while navigating or moving: a rotating anonymous identifier, latitude and longitude, accuracy, timestamp, speed and heading. About {{probes_per_sec}} probes arrive per second. The road network has around {{segments}} directed segments. Routing needs a current speed per segment, with no more than {{update_every}} between refreshes, and the ETA team wants to know how accurate the predicted arrival times were — by region, road class, time of day and trip length. In this scenario a segment's live speed may be published only if at least {{min_devices}} distinct devices contributed to it in the window.

**Problem Statement.** Design the system: ingestion, matching noisy probes to road segments, computing live segment speeds with late and bad data, the privacy rules from collection to storage, publishing speeds to routing, and an offline pipeline that measures ETA accuracy by comparing each navigation trip's predicted arrival with the actual arrival.

**Constraints.** Raw probe tracks are kept only briefly (hours) and never joined to an account. Speeds below the {{min_devices}}-device threshold are not published; routing falls back to historical speeds. Routing reads a consistent snapshot: it must never see half of an update. The ETA accuracy pipeline may keep per-trip records longer, but only the fields it needs.

**Assumptions.** All volumes, thresholds and retention periods are hypothetical. Map data updates add, split and retire segments a few times a week.

**Clarifications.**
- Q: Can a probe be matched to a segment from its own position alone? | A: Not reliably: GPS error is often wider than the gap between parallel roads. You need the device's recent sequence.
- Q: How long does the rotating identifier last? | A: Long enough to follow a short sequence of probes; it rotates, so long tracks cannot be stitched together.
- Q: Which probes should not count toward traffic speed? | A: Ones that do not represent traffic: a parked car, a pedestrian on the pavement, a bus in its own lane. You decide how to detect them.
- Q: What is "actual arrival" for ETA accuracy? | A: When the navigation session ends at the destination. Trips that are abandoned or rerouted to a new destination need a rule.
- Q: How fresh must ETA accuracy reporting be? | A: Daily is fine.

**Hints.**
1. Map matching is stateful per device: partition by the rotating identifier and match short sequences, not single points.
2. Aggregate per segment per window from matched traversals (entry time, exit time, length), not from instantaneous speeds, and use a robust statistic.
3. Publish speeds as a versioned snapshot with the map version it was computed against; a segment id means nothing without the map version.

**Follow-ups.**
1. How do you shard map matching and segment aggregation, given that they are keyed by different things?
2. A downtown segment at rush hour has 400 devices; a rural road at 3 a.m. has one. What does routing get for each, and how do you blend live and historical speeds?
3. A map update splits a highway segment into three in the middle of the day. What happens to live speeds, the threshold count and the historical baseline?
4. How do you measure ETA accuracy so that the result is not dominated by short city trips, and what do you do with trips where the driver ignored the route?
5. Someone asks to keep raw tracks for 90 days to improve map matching. What do you answer, and what would you offer instead?

**Follow-up rules.**
- when: partition by segment, key by segment, segment_id → ask: Map matching needs each device's sequence of probes. If you key the stream by segment, how does one worker see a device's path across segment boundaries?
- when: average speed, mean speed, avg → ask: A delivery van stops on the segment for 4 minutes while traffic flows. What does your average say, and what statistic would you use instead?
- when: geohash, h3, grid cell, s2 → ask: A grid cell holds a highway and the frontage road beside it. How does a cell-based approach tell their speeds apart?
- when: k-anonymity, threshold, distinct devices → ask: The identifier rotates. How do you count distinct devices per segment per window without counting one device twice when its identifier changes mid-window?
- when: retain, store raw, keep the tracks, data lake → ask: Raw tracks must be deleted within hours. Which derived data do you keep, and how would you show an auditor nothing longer-lived can be joined back into a track?

**Production Reality Check.**
- A stadium lets out 60,000 people at once. Probe volume in that city rises to 15 times its usual share of the {{probes_per_sec}} total, most of it from pedestrians walking beside a road whose live speed drops to walking pace.
- A map update retires and replaces 2 million segment ids at noon. For 40 minutes the live snapshot mixes old and new ids, and routing falls back to historical speeds across large areas.
- A client release on one operating system reports probe timestamps in local time instead of UTC. Probes from those devices land hours away from their real windows.
- Overnight, most rural segments fall below the {{min_devices}}-device threshold. A road closure on one of them is invisible to live traffic, and ETAs through it are wrong by an hour.

**Evaluation Criteria.** Device-keyed, sequence-based map matching followed by a re-key to segments; traversal-based segment speeds with a robust statistic and filtering of non-traffic probes; event-time windows with a lateness policy and clock sanity checks; the distinct-device threshold applied before publishing, with rotation handled; versioned, atomic snapshots tied to a map version; historical fallback and blending; short raw retention with only derived data kept; an ETA accuracy pipeline with clear trip rules and weighting; adapts to each incident with diagnosis, recovery and prevention.

## GOO-L4-05: A multi-tenant serverless analytical SQL service

| | |
|---|---|
| **Template ID** | GOO-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed query processing / storage and compute separation, shuffle, skew, fair scheduling |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 55 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "tenants": {"2": ["20,000", "60,000"], "3": ["300,000", "800,000"]},
  "largest_table": ["800 TB", "5 PB", "20 PB"],
  "concurrent_queries": {"2": ["5,000", "15,000"], "3": ["80,000", "200,000"]},
  "reserved_share": ["40%", "60%"]
}
```

**Business Scenario.** A public cloud offers a serverless analytical SQL service: customers load data into tables and run SQL without managing servers. About {{tenants}} customer projects use it, with up to {{concurrent_queries}} queries running at once; the largest tables hold {{largest_table}}. Customers choose between paying per byte scanned (an on-demand pool shared by everyone) and buying reserved compute capacity, measured in units of parallel compute (call them slots). Reserved capacity covers about {{reserved_share}} of the fleet. Tables can be partitioned by date and clustered by up to a few columns.

**Problem Statement.** Design the query service: how storage and compute are separated, how a SQL query becomes a distributed plan of stages, how intermediate data moves between stages (the shuffle), how you schedule work across tenants so reservations are honoured and idle capacity is not wasted, how you handle data skew, how a query survives the loss of workers mid-flight, and how scanned bytes are metered for billing.

**Constraints.** A reserved customer always gets at least its reserved slots within seconds of asking. One tenant's very large query must not starve the on-demand pool for others. Queries are billed by bytes scanned after partition and column pruning, so metering must be exact and repeatable. A worker failure must not fail a query that has run for an hour.

**Assumptions.** All sizes, counts and shares are hypothetical. Storage is columnar, compressed and replicated in a distributed file system; compute nodes hold no durable state.

**Clarifications.**
- Q: Is the service single-region? | A: Each dataset lives in one region or multi-region location; queries run where the data is.
- Q: How are joins between a large and a small table handled? | A: Your call; say when you broadcast and when you shuffle.
- Q: Can idle reserved capacity be used by others? | A: In this scenario, idle slots in a reservation can be lent to other reservations of the same customer first, then to the shared pool, and are reclaimed when needed.
- Q: What does a customer see while a query runs? | A: Stage-by-stage progress, bytes processed, slot time used, and the slowest tasks in each stage.
- Q: Are results cached? | A: Yes, for identical queries over unchanged tables; a cached result scans and bills nothing.

**Hints.**
1. A shuffle tier that holds intermediate data outside the compute workers lets you add, remove or lose workers between and during stages without restarting the query.
2. Fair scheduling has two levels: across reservations and the shared pool, then across queries and tasks within each.
3. Skew is a property of the data, not the plan. Detect it from statistics or runtime sizes and split the heavy keys.

**Follow-ups.**
1. Trace `SELECT country, COUNT(DISTINCT user_id) FROM events WHERE event_date BETWEEN … GROUP BY country` through your system: which stages, what is shuffled, and on which key.
2. A join on `customer_id` has one key holding 30% of the rows. What does your engine do, at plan time and at run time?
3. A worker dies in the middle of a stage that has run for 40 minutes. What is lost, what is recomputed, and how do you avoid billing the bytes twice?
4. A reserved customer's dashboard refreshes 200 queries every minute and their reservation is full; queries queue. What do you show them, and what are their options?
5. How would you meter bytes scanned so that partition pruning, clustering, caching and retries all bill correctly, and how would you prove it to a customer who disputes an invoice?

**Follow-up rules.**
- when: broadcast, broadcast join, replicate the small table → ask: The "small" table is 40 GB after a customer's filter changes. When does your planner notice, and what happens to the workers already running?
- when: hash partition, shuffle by key, repartition → ask: One key holds 30% of the rows. What does the task that receives it do, and how do you split it without breaking the join?
- when: fifo, queue, first come → ask: A reserved customer and an on-demand customer both submit at the same time while the shared pool is busy. Who runs first under your queue, and does that honour the reservation?
- when: spill, disk, out of memory → ask: Spilling keeps the query alive but slows it by 10×. Where does the spill go, and how does the customer find out it happened?
- when: retry, rerun, restart → ask: A retried task re-reads its input partitions. How does metering avoid charging the customer twice for those bytes?

**Production Reality Check.**
- A customer's dashboard runs an unpartitioned scan of a table of {{largest_table}} every minute after someone removes the date filter. Their on-demand bill for the day is 300 times normal, and the shared pool's queue time rises for everyone.
- A join on a skewed key leaves one task holding 40% of a stage's input; the query has run for 6 hours with every other task finished.
- A rack of shuffle-tier nodes is lost during peak. Several thousand running queries have intermediate data on those nodes.
- At month end, reserved customers, whose reservations cover about {{reserved_share}} of the fleet and usually sit partly idle, reclaim their idle slots at once; on-demand queries that were borrowing those slots slow to a crawl.

**Evaluation Criteria.** Columnar storage with partition and column pruning before any compute; plans as stages connected by a shuffle that is decoupled from workers; broadcast versus shuffle joins chosen on measured sizes, with adaptive replanning; skew detection and key splitting; two-level fair scheduling with guaranteed reservations, lending and preemption of borrowed slots; task-level retries from persisted shuffle data; metering defined on pruned logical bytes once per query, independent of retries; quotas and cost guardrails; adapts to each incident with diagnosis, recovery and prevention.
