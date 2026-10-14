# Uber · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a marketplace
for ride-hailing, food delivery and freight, with riders, drivers, couriers,
merchants, shippers and carriers in many cities. Every workload, number and
schema is hypothetical, and nothing here describes how any company's systems
are actually built.

## UBR-L4-01: Live supply and demand per hex cell, every 30 seconds, as a pricing input

| | |
|---|---|
| **Template ID** | UBR-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Stream processing / geospatial aggregation, windowing, freshness as a contract |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "drivers": {"2": ["600,000", "1.2 million"], "3": ["3 million", "5 million"]},
  "ping_seconds": [4, 5],
  "requests": {"2": ["4,000", "9,000"], "3": ["25,000", "40,000"]},
  "staleness": ["60 seconds", "90 seconds"]
}
```

**Business Scenario.** A ride-hailing marketplace covers its cities with a hexagonal grid (an open-source hierarchical hex system, with cells a few hundred metres across at the finest level used here). At peak about {{drivers}} drivers are online at once, and each driver app sends a location and status ping (offline, open, en route to pickup, on trip) roughly every {{ping_seconds}} seconds. Riders open the app and request trips, at a peak of about {{requests}} requests per second worldwide; each app open with a destination produces a price quote. Every 30 seconds, the pricing service needs, for every active cell, a fresh view of supply (drivers who could take a new trip in or near the cell soon) and demand (app opens with intent, and requests) to compute its multiplier.

**Problem Statement.** Design the pipeline that produces this supply and demand map. Define precisely what counts as supply and as demand in a cell for a 30-second interval; describe ingestion from the apps, the aggregation (including neighbouring cells), how the result is published to the pricing service, and what pricing does when the map is late. Say how the same data is kept for analysis and for later replay.

**Constraints.** The map for a cell must never be older than {{staleness}} when pricing reads it; if it is, pricing must know and fall back. A driver must be counted at most once per interval, however many pings they send. Pings arrive out of order and some are duplicated; driver apps buffer pings while offline and send them later. Pricing reads must be p99 under 10 ms. Each city's map must keep working if another region of the platform is down.

**Assumptions.** All volumes, intervals and latencies are hypothetical. Each ping carries a driver id, the app's timestamp, a sequence number per driver session, latitude and longitude, accuracy, and the status. Requests and app opens arrive on a separate stream from the rider apps.

**Clarifications.**
- Q: Does a driver on a trip that ends in two minutes count as supply? | A: Product wants "soon-available" supply counted separately from open drivers. You define "soon" and say how you know the trip will end.
- Q: Is demand measured by requests or by app opens? | A: Both are wanted. Requests undercount demand when prices are high, because some riders do not request.
- Q: How precise is the location? | A: Usually within tens of metres, but in dense downtowns and near tall buildings it can be off by hundreds of metres.
- Q: Does pricing need history? | A: Only the latest map. Analysts and the replay team want every interval kept.
- Q: Can the cell size vary? | A: You may aggregate to coarser parent cells where data is sparse; say how you decide.

**Hints.**
1. Supply is a count of distinct drivers in a state at a moment, not a count of pings. Keep each driver's latest known state and count from that.
2. Key the stream so each driver's pings are processed in order by one worker, then aggregate by cell in a second stage.
3. Decide what pricing does when a city's map is stale before you design the fast path. The fallback is part of the contract.

**Follow-ups.**
1. A driver's pings arrive 20 seconds late after a tunnel. In which interval and cell is that driver counted, and why?
2. A cell has two drivers and no requests in most intervals. How do you keep the multiplier from swinging on noise?
3. One city's partition falls three minutes behind during a stadium event. What does pricing see in that city, and what does it do?
4. How would you show, a week later, the exact supply and demand values that a particular price quote used?
5. Product wants a 10-second interval for the busiest 20 cities. What changes, and what does it cost?

**Follow-up rules.**
- when: kafka, kinesis, partition, partitioned → ask: What is the partition key for pings, and how does that choice behave when one city's demand spikes during a concert?
- when: distinct, deduplicate, dedup, hyperloglog → ask: Do you need an approximate distinct count here, or can you count exactly? How many drivers can be in one cell at once?
- when: neighbour, neighbor, k-ring, smoothing → ask: Smoothing across neighbouring cells blurs a sharp boundary such as a river with one bridge. How do you keep the airport queue from leaking supply into the motorway next to it?
- when: watermark, late data, lateness → ask: Waiting for late pings makes the map older. How long do you wait before you publish an interval, and what happens to pings that arrive after it?
- when: redis, cache, in-memory → ask: The node holding one city's latest map restarts. What does pricing read for the next 30 seconds?

**Production Reality Check.**
- A driver app release on one mobile platform starts sending two pings every {{ping_seconds}} seconds instead of one. Within an hour, supply in every city looks about 40% higher and multipliers fall citywide.
- A stadium concert ends; requests in six cells rise twentyfold within ten minutes. The partition that carries that city falls three minutes behind, so the map pricing reads there is older than {{staleness}}.
- A GPS fault at an airport makes several hundred waiting drivers appear in a cell across the motorway from the official waiting lot, and the airport cell shows almost no supply.
- One region of the platform goes down for 40 minutes; cities whose apps are served from it are moved to another region, which starts with no driver state for them.

**Evaluation Criteria.** Precise definitions of supply (distinct drivers by state, with soon-available counted separately) and demand (requests and intent-bearing app opens) per cell and interval; per-driver ordered processing with dedup by session sequence and a current-state store; cell aggregation with sparse-cell handling (parent cells or neighbour smoothing with boundaries respected); an explicit lateness policy and a published freshness timestamp; a fast keyed read path for pricing with a defined fallback when stale; regional isolation and state rebuild on failover; every interval stored for analysis and replay with versioned definitions; adapts to each incident with diagnosis, recovery and prevention.

## UBR-L4-02: Trip lifecycle event pipeline from out-of-order, offline mobile events

| | |
|---|---|
| **Template ID** | UBR-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Event processing / state machines at scale, ordering, late and duplicate events |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "trips": {"2": ["8 million", "15 million"], "3": ["30 million", "45 million"]},
  "events_per_trip": [18, 30, 45],
  "offline_hours": [2, 6, 24],
  "consumers": [12, 25, 40]
}
```

**Business Scenario.** A marketplace completes about {{trips}} rides and deliveries a day. Each produces about {{events_per_trip}} lifecycle events from three sources: the rider app, the driver or courier app, and the marketplace's own services (requested, matched, driver arrived, trip started, stop added, destination changed, trip ended, cancelled, fare finalised, tip added). Driver and courier apps buffer events while they have no signal and send them later, sometimes up to {{offline_hours}} hours afterwards. The same event can arrive twice, and the two apps can disagree (the rider app says the trip was cancelled while the driver app says it started). {{consumers}} downstream teams depend on the trip's state: earnings, fares and receipts, safety, support tooling, marketplace analytics and the city metrics.

**Problem Statement.** Design the pipeline that turns these events into one authoritative state and history per trip. Cover ingestion, ordering, deduplication, the state machine and what happens to illegal transitions, how conflicts between sources are resolved, how corrections after a trip ends are published, and what downstream consumers receive (a current-state table, a change stream, or both) with what guarantees.

**Constraints.** Support tools must see a trip's current state within 5 seconds of the event reaching the platform. A trip's state may change after it ends (a fare adjustment, a late tip, a cancellation fee reversed by support); every change must be traceable to the event that caused it. Device clocks can be wrong by minutes. Events must never be silently dropped, even when they cannot be applied.

**Assumptions.** All volumes and timings are hypothetical. Every event carries a trip id, an event type, a source, a client-generated event id, the device or server timestamp, a per-device sequence number, and the time the platform received it.

**Clarifications.**
- Q: Which source wins when the apps disagree? | A: You define the rule. Some events are only authoritative from one side, such as "trip ended" from the driver app, "cancelled by rider" from the rider app, and fare finalisation from the server.
- Q: Can a trip go back to an earlier state? | A: Not normally, but support can reverse a cancellation or a completion with an explicit correction event.
- Q: Do downstream teams need every intermediate state? | A: Safety and analytics want the full history; earnings and receipts want the final state and every later correction.
- Q: How late is too late? | A: Nothing is too late to store. You decide which late events still change state and which are recorded only.
- Q: Is ordering by device timestamp safe? | A: Within one device session the sequence number is reliable; timestamps across devices are not.

**Hints.**
1. Separate the immutable event log from the derived state. State is a pure function of the ordered events for a trip, so it can always be rebuilt.
2. Order within a source by its sequence number; merge sources with explicit authority rules per event type rather than by timestamp alone.
3. Give each trip a version that increases with every applied change; consumers can then process changes idempotently and in order.

**Follow-ups.**
1. A "trip ended" event arrives four hours after the trip, while the trip shows "cancelled by rider" from the rider app. What does the state become, and what do earnings and receipts receive?
2. How do you handle an event your state machine says is illegal, such as "trip started" before "matched"?
3. A bug in state derivation is found that affected the last 10 days. How do you rebuild state and tell consumers what changed?
4. Partitioning by trip id puts each trip's events in order, but some consumers want everything for one driver in order. How do you serve both?
5. How do you prove each day that every event received was either applied or recorded as rejected with a reason?

**Follow-up rules.**
- when: timestamp, event time, device time → ask: A driver's phone clock is 9 minutes fast. Show me one trip where ordering by device time gives the wrong final state.
- when: exactly once, exactly-once → ask: Which part of your pipeline actually gives exactly-once effects, and what do consumers do when they see a change twice anyway?
- when: dead letter, dlq, quarantine, reject → ask: Who looks at the rejected events, how often, and what makes one go back into the pipeline?
- when: snapshot, current state, upsert → ask: A consumer reads the current-state table every five minutes and misses a state that lasted two minutes. Does that matter for them? What should they read instead?
- when: replay, rebuild, reprocess → ask: Rebuilding ten days of state produces changes for 3% of trips. Which consumers must receive those changes, and how do they know they are corrections rather than new trips?

**Production Reality Check.**
- A mobile network outage in one large city leaves many driver apps offline for up to {{offline_hours}} hours; when it ends, the buffered events from 40,000 trips arrive within ten minutes, many for trips the rider app already reported as finished.
- A driver app release generates a new event id each time it retries a send, so "trip ended" arrives two or three times with different ids for about 2% of trips. Earnings shows some trips twice.
- A server deploy emits "fare finalised" before "trip ended" for one product in one country for six hours. The state machine rejects 300,000 fare events.
- One of the {{consumers}} consumer teams reads the change stream with a bug that skips versions; their receipts disagree with the trip state for 0.4% of trips and nobody notices for a week.

**Evaluation Criteria.** An immutable event log keyed by trip with dedup on event id and on (device session, sequence); state derived deterministically from ordered events with per-event-type source authority; explicit handling of illegal transitions (held, retried after more events arrive, or recorded with a reason, never dropped); late events and post-trip corrections as versioned changes; a change stream plus a current-state table with clear guarantees and a version per trip; rebuild and restatement with correction semantics for consumers; reconciliation that accounts for every event and checks consumers; adapts to each incident with diagnosis, recovery and prevention.

## UBR-L4-03: Marketplace replay platform to evaluate dispatch policy changes offline

| | |
|---|---|
| **Template ID** | UBR-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Simulation platform / historical state capture, deterministic replay, counterfactual limits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, ml-platform-engineer, software-engineer, data-architect |

```params
{
  "cities": [20, 60, 150],
  "history_days": [14, 28, 56],
  "policies": [5, 15, 40],
  "location_retention": ["30 days", "90 days"]
}
```

**Business Scenario.** A marketplace's dispatch policy decides which driver is offered which request, whether to wait a few seconds to batch requests, and how far away a driver may be sent. Teams want to test changes (a new matching objective, a longer batching window, a new radius for airports) before running a live experiment. They ask for a replay platform: take what actually happened in {{cities}} cities over the last {{history_days}} days (requests, driver positions and states, trip outcomes) and replay it through a candidate policy to estimate wait times, match rates, cancellations, driver idle time and earnings. About {{policies}} candidate policies a week should be evaluated. Precise driver locations may be kept for at most {{location_retention}} under the data-retention policy.

**Problem Statement.** Design the platform: what is captured from production and how, how a historical period is reconstructed into a starting state plus an event stream, how a candidate policy runs against it, how the simulated world reacts to decisions the real world never saw (a driver who was matched differently, a rider who waited longer), what metrics come out, and how results are compared and trusted. Say what replay cannot answer and how the platform tells users so.

**Constraints.** Two runs of the same policy on the same period must give identical results. Each policy evaluation must cover enough city-days to detect a 2% change in average wait time. A full run should finish overnight. The platform must not touch production systems. Location data older than {{location_retention}} cannot be used at full precision.

**Assumptions.** All volumes and timings are hypothetical. The dispatch policy can be packaged as a library that takes the marketplace state and the pending requests and returns offers. A live experimentation system already exists (for example switchback tests that alternate policies by city and time block).

**Clarifications.**
- Q: Can we just re-run history with the new policy? | A: Only partly. Once the new policy makes a different match, what drivers and riders do next was never observed. You decide how the simulator models it.
- Q: Do drivers accept every offer? | A: No. Acceptance and cancellation depend on pickup distance, fare and time of day. Historical rates by those factors exist.
- Q: Who uses the results? | A: Policy teams before a live test, and reviewers deciding whether a live test is worth the risk.
- Q: Does it need to model surge? | A: Prices respond to supply and demand; you decide whether to hold prices at their historical values or simulate them, and say what each choice hides.

**Hints.**
1. Separate exogenous inputs (requests, drivers coming online) that can be replayed as they happened from endogenous behaviour (acceptances, cancellations, repositioning) that must be modelled once decisions diverge.
2. Determinism needs a seeded random source per simulated actor and a single simulated clock, not wall time.
3. Calibrate before you compare: replaying the historical policy must reproduce historical metrics within a known error, or no candidate result means anything.

**Follow-ups.**
1. How do you capture the marketplace state at a moment, and how do you get from a starting state to the exact sequence of events that follows?
2. The candidate policy matches a driver to a rider who historically took a different driver. What happens to the driver who historically picked that rider up?
3. Replay says the candidate cuts wait time by 6%; the live switchback test shows 1%. How do you find out which is wrong?
4. How do you parallelise {{policies}} policies across {{cities}} cities overnight while keeping every run reproducible?
5. The location retention limit means older periods have only coarse locations. How do you still evaluate seasonal effects such as a holiday from last year?

**Follow-up rules.**
- when: counterfactual, behaviour model, behavior model, acceptance model → ask: Your acceptance model was fitted on decisions the old policy made. Where will it be most wrong for the new policy?
- when: calibrate, calibration, baseline, validate → ask: Replaying the production policy gives wait times 4% below what actually happened. Do you correct the model, or report results relative to that baseline? Why?
- when: spark, distributed, parallel, workers → ask: A city's simulation is sequential in time. What is your unit of parallelism, and how do you stop the largest city from deciding how long the night takes?
- when: random, seed, deterministic → ask: A new library version changes floating-point rounding in the policy and a few matches differ. Is the run still reproducible? How would you detect that?
- when: experiment, switchback, a/b → ask: If live experiments exist, what is replay for? Which decisions should it make, and which should it never make on its own?

**Production Reality Check.**
- Two runs of the same policy on the same city-week differ in average wait time by 1.8%, almost the size of the effect the team is trying to measure.
- The replay of the current production policy over the last {{history_days}} days reproduces historical match rates within 1% in most cities, but in three cities it is off by 9%. Those cities had an outage of the driver location stream during the period.
- A policy evaluated as better in replay is tested live and raises driver cancellations by 5%, because it sends drivers on pickups longer than any they were offered in the historical data.
- A deletion request and the {{location_retention}} retention limit remove precise locations for part of the period while a two-week evaluation is in progress; reruns of last month's results no longer match.

**Evaluation Criteria.** Capture of a complete, privacy-compliant marketplace log (state snapshots plus ordered events, versioned schemas); deterministic simulation with a single clock and seeded randomness; explicit split between replayed exogenous inputs and modelled behaviour, with models calibrated and their range of validity known; calibration of the production policy as a gate; metrics with confidence intervals and enough city-days; parallelism by city and period with reproducible manifests; clear statements of what replay cannot answer and how it hands off to live experiments; compliance with retention and deletion; adapts to each incident with diagnosis, recovery and prevention.

## UBR-L4-04: Freight load board: search, ranking and live price quotes for carriers

| | |
|---|---|
| **Template ID** | UBR-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Search and ranking / near-real-time index, quotes with expiry, booking consistency |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "loads": {"2": ["40,000", "80,000"], "3": ["200,000", "350,000"]},
  "carriers": ["60,000", "150,000", "400,000"],
  "quote_minutes": [5, 10, 15],
  "searches": {"2": ["800", "1,500"], "3": ["4,000", "7,000"]}
}
```

**Business Scenario.** A digital freight marketplace connects shippers who need truckloads moved with carriers (from owner-operators to fleets) who move them. Shippers post loads with an origin, a destination, a pickup window, an equipment type (dry van, refrigerated, flatbed), weight and requirements. Carriers search the board on a phone or a desktop, see loads ranked for them with an upfront price, and book in a few taps. At any time about {{loads}} loads are open; about {{carriers}} carriers are active in a month, with up to {{searches}} searches a second at the morning peak. Each price shown is a quote valid for {{quote_minutes}} minutes; prices move with lane supply and demand, and a booked load must disappear from every other carrier's results quickly.

**Problem Statement.** Design the load board: load ingestion and updates from shippers, the search index (by origin and destination areas, dates, equipment, weight), ranking for a carrier (deadhead distance from where the truck is or will be empty, lane preferences, history, price), how quotes are produced, cached and expire, and how booking works so that a load is never booked by two carriers and the price a carrier booked at is the one honoured.

**Constraints.** Search p99 under 300 ms. A load booked or cancelled must leave search results within 5 seconds. A quote, once shown, must be honoured at booking until it expires. Two carriers tapping "book" on the same load within the same second must not both succeed. Carriers must be eligible for the load (equipment, insurance, authority to operate, any shipper restrictions).

**Assumptions.** All volumes and timings are hypothetical, and pricing rules are this exercise's. A pricing model exists as a service that returns a price for a (load, carrier) pair in about 50 ms; it can also price a lane in bulk.

**Clarifications.**
- Q: Is the price the same for every carrier? | A: Assume it can differ by carrier only through documented factors in this exercise (for example a reliability bonus). You decide where the per-carrier part is computed.
- Q: Where is the carrier's truck? | A: Some carriers share live location; others enter where they will be empty and when. Many do neither.
- Q: Can shippers change a load after posting? | A: Yes: pickup windows, weight and requirements change, and loads get cancelled. Each change may change the price.
- Q: What happens when a quote expires during booking? | A: You decide; say what the carrier sees.
- Q: Do carriers save searches? | A: Yes, and they want a notification when a matching load appears.

**Hints.**
1. Separate the index (which loads match) from the ranking and pricing (in what order, at what price). Pricing every match on every search is the expensive part.
2. A quote is a record with an id, the price, the inputs it depended on and an expiry; booking checks the quote, not a fresh price.
3. The booking decision is a conditional write on the load's state, not a search-index update.

**Follow-ups.**
1. Walk through one search: what is queried, how many candidates come back, which are priced, and what is cached.
2. Two carriers book the same load 200 ms apart. Which records change, in what order, and what does the second carrier see?
3. A shipper edits the pickup window on a load that has 300 live quotes. What happens to those quotes?
4. How do you serve saved searches for {{carriers}} carriers without running every saved search on every new load?
5. How would you measure whether ranking is helping carriers, given that carriers mostly book what they see first?

**Follow-up rules.**
- when: elasticsearch, opensearch, lucene, inverted index → ask: Your index refreshes every second, but a booked load must disappear within 5 seconds under peak write load. Where else must you check that a load is still open?
- when: geohash, hex, h3, radius → ask: A carrier in a rural area is 150 miles from the nearest load. How does your origin search behave when the nearby cells are empty?
- when: cache, cached, ttl → ask: You cache prices per lane. The pricing model is updated mid-morning. How long do carriers see the old prices, and is that a quote you must honour?
- when: lock, transaction, compare-and-set, conditional write → ask: The booking write succeeds but the confirmation to the app times out. The carrier taps book again. What happens?
- when: machine learning, learning to rank, ranking model → ask: Your ranking model is trained on clicks and bookings from the old ranking. What bias does that create, and how do you correct for it?

**Production Reality Check.**
- Two carriers both receive a booking confirmation for the same refrigerated load; both trucks arrive at the shipper's dock the next morning.
- A pricing model update goes out at 9:00 and raises quotes on several busy lanes by 30% for two hours before it is rolled back. About 1,100 loads were booked at those prices, and every quote issued in that time was valid for {{quote_minutes}} minutes.
- A large shipper uploads 25,000 loads at 7:58, just before the morning peak. Index lag reaches four minutes, and carriers book loads that the shipper had already cancelled in the same upload.
- Carriers who share live location see good loads near them; carriers who do not share location see mostly loads 300 miles away, and their bookings fall by half over a month.

**Evaluation Criteria.** Clear split of index, candidate retrieval, ranking and pricing; an index updated from a change stream of load state with a bounded lag and a check of the authoritative load state before showing or booking; quotes as first-class records with inputs, expiry and an honour rule; booking as an idempotent conditional write on load state, with clear outcomes for the losing carrier; eligibility filters applied before ranking; saved searches inverted (match new loads against stored queries); ranking that handles carriers without location and corrects for position bias; capacity for the morning peak and bulk uploads; adapts to each incident with diagnosis, recovery and prevention.

## UBR-L4-05: City-level marketplace health metrics for a thousand cities

| | |
|---|---|
| **Template ID** | UBR-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Metrics platform / definitions as code, backfills, per-city anomaly alerting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "cities": ["800", "1,000", "1,200"],
  "metrics": {"1": [30, 40], "2": [80, 120], "3": [150, 250]},
  "freshness": ["15 minutes", "60 minutes"],
  "history_years": [2, 3, 5]
}
```

**Business Scenario.** A marketplace operates rides and delivery in {{cities}} cities, from megacities with millions of trips a week to small towns with a few hundred. City operations teams and leadership watch about {{metrics}} health metrics per city: completed trips, request-to-match rate, pickup time and its accuracy against the shown estimate, rider and driver cancellation rates, unfulfilled requests, surge exposure, driver utilisation, courier wait at restaurants, and others. Today each team computes its own version in its own notebooks, the numbers disagree, and alerts are hand-tuned for the largest cities only. You are asked to build one platform: metric definitions written once, refreshed for every city every {{freshness}}, kept for {{history_years}} years, and alerted on automatically.

**Problem Statement.** Design the platform. Cover how a metric is defined (as code: source tables, filters, grain, numerator and denominator, time zone, owner, version), how definitions are reviewed and changed, how metrics are computed incrementally and backfilled when a definition changes or late data arrives, how restatements are recorded, and how anomaly detection works across cities of very different sizes so that teams trust the alerts.

**Constraints.** Every metric is computed per city in the city's local time (days and hours), including cities that change clocks for daylight saving time. A definition change must never silently rewrite history: old and new versions must be comparable. A backfill must not delay the regular updates every {{freshness}}. Alerts should reach the city's own team, and the platform should page no one for noise.

**Assumptions.** All volumes, counts and timings are hypothetical. Trip, request, driver-status and order tables exist in a warehouse with event times in UTC; city boundaries and time zones are in a versioned reference table.

**Clarifications.**
- Q: Who owns a metric definition? | A: Each metric needs one owning team. Today nobody owns most of them.
- Q: Do cities ever change? | A: Yes. Cities are merged, split, and have their boundaries redrawn; a metric's history must still make sense.
- Q: What counts as an anomaly? | A: A change the city team would act on. A 50% drop in completed trips in a town with ten trips an hour may be one quiet hour.
- Q: Can late data change yesterday? | A: Yes. Trips finish, fares are adjusted and cancellations are reversed for days afterwards.
- Q: Which numbers does leadership see? | A: A weekly review uses the same metrics; they want them stable once reviewed.

**Hints.**
1. A metric definition is code with a version and an owner; the platform compiles it into queries. A ratio metric stores its numerator and denominator separately so it can be rolled up correctly.
2. Compute on a grain fine enough to roll up (city × local hour × product) and derive days, weeks and regions from it.
3. Anomaly detection for a small city needs a different model from a large one: use expected counts with seasonality and a significance test, not a fixed percentage.

**Follow-ups.**
1. Show me the definition of "rider cancellation rate" in your format, including what happens to a request re-matched to a second driver.
2. The owner changes that definition to exclude cancellations within two minutes of request. How is history handled, and what do dashboards show?
3. How do you schedule a {{history_years}}-year backfill for every city without delaying today's updates?
4. How do you alert on {{cities}} cities × {{metrics}} metrics without paging anyone for noise? What is your false-alert budget?
5. A daylight-saving change gives one city a 25-hour day. What do the hourly and daily metrics show, and what does the anomaly detector do?

**Follow-up rules.**
- when: dbt, semantic layer, metrics layer, yaml → ask: Two teams want slightly different "match rate" definitions. Do you allow both? How does a dashboard reader know which one they are looking at?
- when: utc, time zone, timezone, local time → ask: Show me how one trip at 23:30 local time on the night clocks go back is assigned to an hour and a day.
- when: threshold, percent change, static threshold → ask: In a town with 40 trips a day, how often does your threshold fire on ordinary days? How did you work that out?
- when: backfill, recompute, restate, restatement → ask: A backfill changes last quarter's numbers that leadership already reviewed. What do they see, and how do they know why it changed?
- when: average, averaged, avg → ask: You have a cancellation rate per city. How do you compute the region's rate from the cities, and what goes wrong if you average the city rates?

**Production Reality Check.**
- The new "rider cancellation rate" definition is deployed on a Monday morning; within an hour every one of the {{cities}} cities fires a cancellation alert, because the detector compares the new definition with history computed under the old one.
- Two neighbouring cities are merged into one operating city. Their history disappears from dashboards, and the merged city's detector has no baseline.
- A backfill of {{history_years}} years for a new metric starts on Friday evening and takes the warehouse capacity the regular jobs use; Saturday's regular updates, due every {{freshness}}, are four hours late during a holiday weekend.
- Small cities fire about 300 alerts a week, almost all noise; city teams mute them, and a real drop in one town (a payments outage affecting a local card network) goes unseen for a day.

**Evaluation Criteria.** Metrics as versioned code with owners, review and tests; ratios stored as numerator and denominator and rolled up correctly; a fine local-time grain with daylight-saving handling from a versioned time zone reference; incremental computation with a lateness window and explicit restatements recorded with reasons; backfills isolated in capacity and priority from regular runs; definition changes computed side by side and the detector re-baselined; city boundaries versioned with history mapped through merges and splits; anomaly detection scaled to volume (expected counts, seasonality, significance, minimum volume) with an alert budget and routing to owners; adapts to each incident with diagnosis, recovery and prevention.
