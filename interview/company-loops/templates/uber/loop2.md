# Uber · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a marketplace
for ride-hailing, food delivery and freight, with riders, drivers, couriers,
merchants, shippers and carriers in many cities. Every workload, number and
schema is hypothetical, and nothing here describes how any company's systems
are actually built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## UBR-L2-01: Surge smoothing across neighbouring hex cells

| | |
|---|---|
| **Template ID** | UBR-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Grids and neighbourhoods / hex k-rings, integer averaging, step limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | UBR-L2-01.mjs |

**Business Scenario.** A ride-hailing marketplace divides each city into hexagonal cells. Every interval it counts open ride requests and available drivers in each cell, and when requests outnumber drivers it raises the price multiplier there, so that more drivers head to the cell and fewer riders wait. A multiplier computed from one cell alone is noisy: a cell with one driver and three requests jumps to the cap, while the cell next door sits at 1.00x, and drivers chase the boundary. So the pricing input is smoothed over each cell's neighbourhood, capped, and not allowed to jump too far from one interval to the next.

**Problem Statement.** Implement `smooth_surge(cells, k, cap, prev=None, max_step=None, weighted=False)`. `cells` maps a hex cell in axial coordinates `(q, r)` to `(open_requests, available_drivers)` for the interval. Cells with no data are not in it. Multipliers are integers in hundredths: 100 means 1.00x. For every cell in `cells`:
1. **Raw multiplier.** 100 if requests are at most drivers. `cap` if there are no drivers and at least one request. Otherwise `min(cap, 100 * requests // drivers)`, truncated.
2. **Smoothing.** Average the raw multipliers of every cell in `cells` within hex distance `k` of this cell, itself included, and round half up to a whole hundredth. The hex distance between `(q1, r1)` and `(q2, r2)` is `(|q1 − q2| + |r1 − r2| + |q1 + r1 − q2 − r2|) / 2`. {{weight_rule}}
3. **Step limit.** {{step_rule}}
4. **Bounds.** The final multiplier is limited to the range 100 to `cap`.

Return a dict mapping every cell in `cells` to its final multiplier.

**Constraints.** About 52 000 cells and `k` up to 3 in the timing check; `cap` is at most 1 000. Something close to O(N · k²) is expected for N cells. Comparing every cell with every other cell is not fast enough. Keep the arithmetic in integers.

**Assumptions.** All counts, caps and step sizes are hypothetical, and a real pricing input uses far more signals than two counts. The grid is a flat axial hex grid, similar in spirit to open-source hexagonal indexes but without their resolutions or pentagons. Counts are non-negative integers.

**Clarifications.**
- Q: Do cells with no data count as 1.00x in the average? | A: No. Only cells present in `cells` are averaged, so a cell at the edge of the service area averages fewer cells.
- Q: Is a cell exactly `k` away included? | A: Yes. The neighbourhood is every cell at distance 0 to `k`.
- Q: How should I round? | A: Half up, to a whole hundredth: 100.5 becomes 101. Python's `round()` rounds half to even, so it gives 100 there.
- Q: Is the raw ratio rounded too? | A: No, it is truncated: 7 requests and 3 drivers give 233.
- Q: Which comes first, the step limit or the bounds? | A: The step limit, then the 100 and `cap` bounds.

**Hints.**
1. On an axial grid, the cells within distance `k` are a fixed set of offsets `(dq, dr)`, 3k(k + 1) + 1 of them. Build that list once.
2. Compute every raw multiplier once, before smoothing. Each cell then needs one dictionary lookup per offset.
3. With integer sum `S` and total weight `W`, `(2 * S + W) // (2 * W)` is `S / W` rounded half up.

**Follow-ups.**
1. A concert ends and one cell spikes while its neighbours are calm. Your average spreads the spike over 19 cells. How would you keep a real local spike visible while still damping noise from cells with very few drivers?
2. The input refreshes every 30 seconds for a whole city, but only a few hundred cells change between intervals. How would you update the smoothed values without recomputing every cell?
3. Drivers cross a boundary between a high cell and a low cell, and the multipliers oscillate from interval to interval. What does the step limit do about that, and what else would you add?
4. How would you test a new smoothing rule against today's before any rider sees a price from it?

**Follow-up rules.**
- when: round(, round half, banker → ask: What does round(100.5) return in Python 3, and what would that do to a price shown to a rider?
- when: every cell, all pairs, nested loop, every other cell → ask: How many distance checks is that for 52 000 cells, and how many does the list of k-ring offsets need?
- when: float, decimal → ask: Where could a float give 232.99999 instead of 233, and how do you keep the multiplier exact?
- when: offsets, k-ring, ring → ask: How many offsets are within distance k, and how do you generate them without duplicates or gaps?
- when: h3, hexagon library, resolution → ask: A real hexagonal index has several resolutions and a few pentagons. What would change in your neighbour lookup?

**Evaluation Criteria.** Correct raw multiplier, including no drivers with and without requests and truncation; correct hex distance on axial coordinates, not a square-grid distance; only cells with data averaged; round half up in integers; at Hard, a step limit from the previous value (100 when absent) applied before the bounds; at Very Hard, distance weights over the cells that have data; precomputed k-ring offsets for O(N · k²) work; a reasoned answer on spikes, incremental updates and safe testing.

## UBR-L2-02: Inserting a new rider into a shared ride

| | |
|---|---|
| **Template ID** | UBR-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Routing / cheapest insertion, prefix and suffix arrays, feasibility under capacity and time limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | UBR-L2-02.mjs |

**Business Scenario.** In a shared ride, riders going the same way share one car, and each is promised a pickup soon and a ride that is not much longer than a direct trip. When a new request comes in, the dispatcher looks at a candidate driver's planned sequence of pickups and drop-offs and asks: where can this rider's pickup and drop-off go so that the car never has more riders than seats, the new rider is picked up in time and does not ride too long, and nobody already promised a time is made late? Of all the places that work, it wants the one that adds the least time to the driver's route. The same routine plans long batched routes, such as a courier's multi-order run, so it must stay fast when the plan has hundreds of stops.

**Problem Statement.** Implement `insert_rider(start, onboard, capacity, stops, pickup, dropoff, max_wait, max_ride, seats=1, dwell=0)`. At time 0 the car leaves `start` with `onboard` seats taken; the drop-offs of those riders are in `stops` without a pickup. `stops` is the planned sequence, each stop `(rider, kind, x, y, latest, seats)`: a `'pickup'` adds that party's seats, a `'dropoff'` removes them. Travel time between two points is the Manhattan distance `|x1 − x2| + |y1 − y2|`, in seconds. {{latest_rule}} {{party_rule}}

Insert the new rider's pickup, and later their drop-off, into the sequence without reordering the planned stops. An insertion is feasible if seats taken never exceed `capacity` when the car leaves a stop; the car arrives at the new pickup at or before `max_wait`; the new rider's ride time, arrival at the drop-off minus arrival at the pickup, is at most `max_ride`; and every planned stop is reached by its `latest`. Its cost is how much later the car leaves its final stop than in the plan without the new rider (a plan with no stops finishes at 0). Return `(added_seconds, pickup_index, dropoff_index)`, the positions of the two new stops in the new sequence, for the cheapest feasible insertion. On equal cost, return the smallest `pickup_index`, then the smallest `dropoff_index`. Return `None` if no insertion is feasible.

**Constraints.** Up to 600 planned stops in the timing check. There are about n²/2 candidate pairs of positions; checking each pair in constant time is expected. Rebuilding and simulating the whole route for each pair is O(n³) and too slow. All values are integers.

**Assumptions.** Locations, times and limits are hypothetical, and a street grid with Manhattan distances stands in for a road network. The planned route is feasible before the new rider is added. There are no earliest times: the car never waits for a stop. The dispatcher has already chosen this driver as a candidate.

**Clarifications.**
- Q: Can the pickup and the drop-off be next to each other? | A: Yes. Then `dropoff_index` is `pickup_index + 1`.
- Q: Is `latest` checked on arrival or on departure? | A: On arrival, and so is `max_wait`.
- Q: Which loads must stay within capacity? | A: The load when the car leaves each stop, including the new pickup. The new rider counts when the car leaves every stop between their pickup and their drop-off.
- Q: Does the cost include the time spent at the new rider's own stops? | A: Yes. It is everything that makes the final departure later.
- Q: What if the new pickup is at the same place as a planned stop? | A: It is still a separate stop in the sequence, at distance 0.

**Hints.**
1. Putting a stop `x` between locations `a` and `b` delays every later stop by the same amount: `dist(a, x) + dwell + dist(x, b) − dist(a, b)`, or `dist(a, x) + dwell` at the end of the route.
2. Precompute, for the plan as it is, the arrival time at each stop, the load when the car leaves it, the slack `latest − arrival`, and the minimum slack from each stop to the end.
3. Fix the pickup position, then move the drop-off position forward, keeping the largest load and the smallest slack seen so far. Once either check fails, it fails for every later drop-off too.

**Follow-ups.**
1. A request is checked against 40 nearby drivers within a 200 ms budget. Where does the time go, and what would you rule out before calling this function?
2. Travel times now come from a routing service and no longer satisfy the triangle inequality exactly. Which step of your algorithm relied on it, and what would you change?
3. Two requests arrive in the same second and both fit only into the same car's last seat. How does the dispatcher keep the two decisions consistent?
4. Cheapest insertion places one request at a time. When would you re-plan a driver's whole route instead, and what do the promises already made limit you to?

**Follow-up rules.**
- when: permutations, itertools, every order, reorder → ask: Riders already in the car were promised an order of stops. What happens to them, and to your running time, if you reorder?
- when: simulate, rebuild the route, insert into a copy → ask: Rebuilding and simulating each candidate is O(n) per pair. How many pairs are there for 600 stops, and what would you precompute to make each pair O(1)?
- when: break, early exit, prune → ask: Your inner loop stops early. Prove that no later drop-off position can become feasible again.
- when: triangle inequality → ask: Where exactly does your argument use it, and what breaks with travel times from a real road network?
- when: heap, dijkstra, shortest path → ask: The order of planned stops is fixed. What graph would a shortest-path search run on here, and what does it buy you over checking positions?

**Evaluation Criteria.** Correct arrival times, loads and slack for the plan; detours computed from the neighbouring locations, including at the end of the route; capacity checked from the pickup through the stop before the drop-off; `max_wait` and `max_ride` on arrival times; at Hard, every later planned stop within its `latest` after the shift it receives; at Very Hard, party sizes and dwell at every stop, including the new ones; the specified tie-break and `None`; O(n²) with O(1) checks per pair and a proof for each early exit; credible answers on latency budgets, concurrency and re-planning.

## UBR-L2-03: Debug the trip-state reconstruction from mobile events

| | |
|---|---|
| **Template ID** | UBR-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / state machines, ordering, duplicates, illegal transitions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | UBR-L2-03.mjs |

**Business Scenario.** The rider's and the driver's phones report each step of a trip: requested, accepted, arrived, started, completed or cancelled. Phones lose signal, keep events in an offline buffer and upload them later in batches, retry uploads, and have clocks that are minutes off. An analytics job rebuilds each trip's final state, its duration and a count of events that make no sense, and operations has raised several complaints about it. Trips whose driver's phone clock runs slow show up as never accepted. Trips on flaky networks show inflated illegal-event counts. Some trips that completed are reported as cancelled. Trips where the rider never came out stay "arrived" for ever. And the illegal-event alarm fires every time the mobile team raises the location sampling rate. The job below is the suspect.

**Problem Statement.** Fix `reconstruct_trips(events)` so that it meets this specification. `events` is a list of dicts in delivery order, each `{"event_id", "trip", "seq", "type", "device_ts"}`. {{replay_rule}}
1. **Copies.** A phone may upload the same event more than once. Copies share `event_id` and every other field. Apply each `event_id` once. Event ids are unique across all trips.
2. **Order.** Within a trip, apply events in increasing `seq`, the sequence number the trip service assigned when it accepted the action. Neither the delivery order nor `device_ts`, the phone's clock in seconds, is reliable for ordering. Distinct events of one trip have distinct `seq` values.
3. **Types.** The lifecycle types are `requested`, `accepted`, `arrived`, `started`, `completed` and `cancelled`. Any other type, such as `location`, is ignored: it changes nothing and is not counted.
4. **Transitions.** From no state, only `requested`. `requested` → `accepted` or `cancelled`. `accepted` → `arrived` or `cancelled`. `arrived` → `started` or `cancelled` (a rider no-show). `started` → `completed`. `completed` and `cancelled` are final. A lifecycle event that is not allowed from the current state is illegal: count it, and leave the state unchanged.
5. **Output.** `{trip: {"state", "trip_seconds", "illegal"}}` for every trip that appears in `events`. `state` is the last state applied, or `None`. `trip_seconds` is the `device_ts` of the applied `completed` minus the `device_ts` of the applied `started`, or `None` if the trip did not complete. Both come from the driver's phone, so its clock offset cancels out. `illegal` counts the illegal lifecycle events.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events, in O(n log n) time.

**Assumptions.** The event shapes, the transition rules and every number are hypothetical and simplified. Real trip lifecycles have more states. `seq` is reliable; `device_ts` is reliable only for differences between two events from the same phone.

**Clarifications.**
- Q: Why not order by `device_ts`? | A: The rider's and the driver's phones have different clocks. Only `seq` is assigned in one place.
- Q: Is a retransmitted copy an illegal event? | A: No. It is the same event, so it is applied once and never counted.
- Q: A driver taps "start" twice and two different events arrive. Which counts? | A: The first one by `seq`. The second is illegal, because `started` is not allowed from `started`.
- Q: What if a trip's `requested` event never arrives? | A: Then every lifecycle event of that trip is illegal and its state is `None`. That is what the specification says, and the count tells operations something is missing.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Build a trip where the driver's phone runs two minutes slow, sort its events the way the code does, and read the order.
2. Upload one event twice. What does the second copy look like to the transition check?
3. After the code counts an illegal event, what happens to `state`?
4. List every state a trip can be cancelled from, and compare with the table.

**Follow-ups.**
1. This now runs as a streaming job. A trip's events arrive over many minutes, some after you have already emitted its state. What do you emit, when, and how do you correct it?
2. Your set of seen event ids grows without limit. How would you bound it, and what can go wrong once an id has been forgotten?
3. The illegal-event count doubles the day after a mobile app release. How do you tell an app bug from a pipeline bug?
4. A phone's clock is corrected by a network time sync in the middle of a trip, so its `device_ts` jumps. What would you use for durations instead, and what does it cost?

**Follow-up rules.**
- when: device_ts, sort by time, timestamp → ask: The driver's phone runs two minutes slow. In what order do requested and accepted come out when you sort by device time?
- when: seen, dedup, event_id → ask: How large does your set of seen ids grow over a day, and how would you bound it in a streaming job?
- when: raise, exception, assert → ask: One malformed sequence from one phone: should it stop the whole job? What does the specification ask for instead?
- when: arrival order, received_at, server time → ask: An offline batch is uploaded twenty minutes late. What does ordering by arrival do to that trip?
- when: last write wins, overwrite state → ask: A stale "accepted" retry arrives after the trip started. What does last-write-wins make of it, and how does your fix treat it?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; orders by `seq`, not by phone clocks; drops copies by `event_id` without counting them; never applies an illegal transition; allows a cancel after arrival; ignores non-lifecycle events; the duration comes from the applied start and completion; the fixes stay minimal and O(n log n); adds a test per bug.

## UBR-L2-04: Fare recomputation backfill after a pricing bug

| | |
|---|---|
| **Template ID** | UBR-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / deterministic replay, versioned rules, diffs, idempotent adjustments, audit |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "trips_affected": {"2": ["1.2 million", "4 million"], "3": ["30 million", "80 million"]},
  "bug_window": ["9 days", "23 days", "41 days"],
  "cities": [12, 60, 240],
  "currencies": [3, 9, 17]
}
```

**Business Scenario.** A ride-hailing marketplace prices trips from versioned pricing rules: base fare, per-minute and per-kilometre rates, minimum fares, surge multipliers, tolls and fees. Some trips are priced up front, so the rider agrees to a quoted price; others are metered on actual time and distance. A rules release contained a bug: for {{bug_window}}, trips in {{cities}} cities used the wrong per-minute rate for one vehicle class. About {{trips_affected}} trips in {{currencies}} currencies may have been priced wrongly, some too high and some too low, and driver earnings were computed from the same components. Finance, support and the city teams want to know exactly who was affected, by how much, and want the fix applied once and only once.

**Problem Statement.** Design the backfill. Cover how you identify the affected trips; how you recompute each fare deterministically with the corrected rules from the inputs that existed at the time (the quote, the trip's measured time and distance, surge, promotions, tolls); how you produce a reviewable diff between charged and corrected amounts per trip and per component; the policy choices that decide what is adjusted for riders and for drivers, and who makes them; how adjustments are issued idempotently, in minor units, through the normal payment and earnings flows; and how every step is auditable and can be re-run.

**Constraints.** Amounts are integers in minor units of each trip's currency. A rider or a driver must never receive the same adjustment twice, even if the job is restarted. Trips refunded by support, disputed, or adjusted for another reason since the bug must not be corrected blindly. The recomputation must use the rule version that should have applied, not whatever rules are live today. Finance must be able to reconcile the totals to the ledger.

**Assumptions.** All volumes, windows, rates and policies are hypothetical. Each trip record keeps its pricing inputs and the identifier of the rule version used. Payments and driver earnings are separate systems that accept adjustment requests with an idempotency key.

**Clarifications.**
- Q: Do we charge riders who paid too little? | A: That is a policy decision you should surface, not assume. Many marketplaces absorb undercharges and refund overcharges. Design for whichever policy is chosen.
- Q: Does an upfront price change if the per-minute rate was wrong? | A: The quote was computed from the rate, so the quote was wrong too. Whether the rider is owed the difference depends on whether the trip was charged the quote or the metered fare.
- Q: Are driver earnings affected? | A: Yes, where earnings are computed from the same components. Driver adjustments may follow a different policy from rider adjustments.
- Q: Can the corrected rules change again during the backfill? | A: Assume they could be revised once. Your design should make a second run cheap and safe.
- Q: Who signs off? | A: Finance and the city operations teams review the diff before any money moves.

**Hints.**
1. Separate three stages: recompute (pure, re-runnable, no side effects), review (a diff people can sign off), and apply (side effects, idempotent).
2. Pin everything a recomputation reads: the rule version, the trip's inputs, currency rounding rules and the code version. A recomputation that reads today's state is not a replay.
3. Give each adjustment a deterministic identity, such as the trip, the incident and the party, and use it as the idempotency key downstream.

**Follow-ups.**
1. The diff shows that 3% of the trips also had a promotion applied, and the promotion was a percentage of the fare. How do you recompute those, and what does the rider see?
2. Midway through issuing adjustments the job crashes. Walk through the restart: what has happened downstream, and how do you know?
3. A second bug is found in the corrected rules after half the adjustments are out. What does your design do now?
4. How do you prove to finance, a quarter later, that every adjustment matches the diff that was signed off?
5. Some affected trips were in cities with tax rules applied to fares. What changes in the recomputation and in the adjustments?

**Follow-up rules.**
- when: update in place, overwrite the fare, update the trips table → ask: The original charged amount is evidence. If you overwrite it, how do you explain a rider's receipt or reconcile last month's revenue?
- when: idempotency key, idempotent, dedupe → ask: What exactly is your key made of, and what happens if a second incident later affects the same trip?
- when: float, double, round → ask: Where does rounding to the minor unit happen, per component or on the total, and what does the original pricing do?
- when: current rules, latest version, live config → ask: Which rule version does the replay read, and what happens if the rules change again during the backfill?
- when: notify, email, communication → ask: What does the rider or the driver see, and what happens if the notification goes out but the adjustment fails?

**Production Reality Check.**
- For {{bug_window}} the bug affected {{cities}} cities. The first recompute run finds 0.4% of trips whose recomputed fare differs from the charged fare in cities the bug never touched.
- The adjustment job is restarted after a deploy and issues requests for trips it already processed; the payments system reports duplicate idempotency keys for 12 000 of them.
- Support had already refunded some affected trips in full after complaints, and those riders would receive a second refund from the backfill.

**Evaluation Criteria.** Affected trips found from rule versions and inputs, not from symptoms; deterministic recomputation from pinned inputs and the correct rule version; a component-level diff reviewed before any money moves; explicit, owned policies for overcharges, undercharges, upfront quotes and driver earnings; exclusions for trips already refunded, disputed or adjusted; idempotent adjustments with deterministic keys through the normal flows; the original amounts kept as evidence; integer minor units with the original rounding; reconciliation and an audit trail; a plan for each incident.

## UBR-L2-05: Assigning trips to versioned zones and geofences every day

| | |
|---|---|
| **Template ID** | UBR-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / spatial joins, cell covers, effective-dated versions, reprocessing |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_trips": {"2": ["5 million", "12 million"], "3": ["30 million", "70 million"]},
  "zones": ["40,000", "250,000"],
  "geofence_updates": ["a few a week", "hundreds a day"],
  "late_share": ["0.5%", "3%"]
}
```

**Business Scenario.** A marketplace's analytics depend on knowing where trips start and end in business terms: which city operating zone, which pricing zone, and whether a pickup was inside a geofence such as an airport pickup area or a temporary event zone around a stadium. City teams maintain about {{zones}} zone and geofence polygons, and they change {{geofence_updates}}: new zones are added, boundaries are corrected, and event geofences exist only for a few hours. About {{daily_trips}} trips a day each have a pickup and a drop-off point, and {{late_share}} of trips reach the warehouse a day or more late because of offline phones and corrections.

**Problem Statement.** Design the daily pipeline that assigns every trip's pickup and drop-off to zones and geofences. Cover how polygons are stored and versioned with effective dates; which version a trip is joined to (the one in effect at the trip's time); how the point-in-polygon join is made fast at this scale, for example by covering polygons with grid cells and testing exactly only near boundaries; overlapping geofences and priority rules; points on a boundary and GPS noise; late trips; what happens when a boundary correction is published for past dates; and how results stay reproducible and explainable.

**Constraints.** A trip's assignment must be explainable later: which polygon version, effective when, matched how. Corrections may be retroactive, and the business must decide whether past reports change. The daily run must finish within a few hours, and a full reprocess of a year must be possible. Downstream finance and incentive reports read these assignments.

**Assumptions.** All volumes, polygon counts and change rates are hypothetical. Polygons are stored with an id, a version, an effective-from and an effective-to time, a type (operating zone, pricing zone, airport, event) and a priority. Points are latitude and longitude from the phone, with an accuracy estimate.

**Clarifications.**
- Q: Which version applies to a trip: the one in effect at the trip's time or the latest? | A: The one in effect at the pickup time for pickup assignments, unless a correction is declared retroactive. You decide how that is represented.
- Q: Can geofences overlap? | A: Yes. An event zone can overlap an airport's area. Each type has its own priority, and a trip can be in several geofences of different types.
- Q: How precise are the points? | A: Usually within tens of metres, worse near tall buildings and in airport garages.
- Q: Who consumes the result? | A: Pricing and incentive reports, city operations dashboards and finance. Some reports are already published when a correction arrives.
- Q: Are polygons large? | A: Most are small, but some city zones have thousands of vertices.

**Hints.**
1. Cover each polygon with grid cells at a fixed resolution and split them into interior cells (always inside) and boundary cells (need an exact test). Most points then need only a key lookup.
2. Treat the polygon table as a slowly changing dimension with effective-from and effective-to times, and join on the cell and on the time interval.
3. Make the output a pure function of the trips and the polygon versions it read, and record those versions with each run.

**Follow-ups.**
1. An airport's boundary is corrected for the last 60 days because a new terminal opened. Which assignments change, how do you find them without reprocessing everything, and what do reports that were already published show?
2. One city zone has 40 000 vertices and makes the exact test slow for every point near its boundary. What would you do?
3. A temporary event geofence existed from 18:00 to 23:30. A trip was requested at 23:28 and picked up at 23:34. Which rule decides, and where is it written down?
4. GPS noise puts 2% of airport pickups just outside the airport geofence. How do you decide whether to snap them, and how would you measure the effect?
5. How would the same design serve a real-time assignment at request time, and how do you keep the two from disagreeing?

**Follow-up rules.**
- when: st_contains, point in polygon, cross join → ask: How many polygon tests does a naive join run for {{daily_trips}} trips and {{zones}} polygons, and what index would you put in front of it?
- when: h3, geohash, s2, cell cover → ask: What resolution do you choose, how many cells does your largest polygon cover, and which cells still need an exact test?
- when: latest version, current polygons, overwrite → ask: A boundary changes today. What happens to last month's report if you always join with the latest polygons?
- when: buffer, snap, tolerance → ask: Snapping a point into the airport geofence changes who earns the airport fee. Who signs off on the tolerance, and how is it recorded?
- when: broadcast, broadcast join, shuffle → ask: The polygon table is small but the trips are not. What do you broadcast, and what happens when the largest polygon's cell list is skewed?

**Production Reality Check.**
- A city team publishes a corrected airport boundary effective from 45 days ago, and the incentive report for that airport has already been paid out to drivers.
- Geofences change {{geofence_updates}}. One event geofence is published with its effective-to time earlier than its effective-from time, and the daily run silently assigns no trips to it.
- {{late_share}} of trips arrive a day or more late; on one day a mobile backlog delivers three days of trips at once, and the late trips are joined with today's polygons instead of the ones in effect when they happened.

**Evaluation Criteria.** Polygons versioned with effective intervals and the rule for which version applies, including retroactive corrections; a cell-cover index with exact tests only near boundaries; correct handling of overlaps, boundaries and GPS accuracy with documented rules; late trips assigned with the versions in effect at their time; a targeted reprocess for corrections, with a policy for published reports; reproducible runs that record polygon versions; validation of polygon changes before use; skew and performance handled for very large polygons; a plan for each incident.
