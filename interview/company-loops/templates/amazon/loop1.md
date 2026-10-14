# Amazon · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an online
marketplace with its own fulfilment and delivery network and a public cloud:
orders and packages, delivery promises, package scans, fulfilment-centre
operations and cloud cost and usage data. Every workload, number, name and
schema is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## AMZ-L1-01: Delivery promise kept, on the customer's local date

| | |
|---|---|
| **Template ID** | AMZ-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / time zones, order-level rollups before grouping, outer joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | AMZ-L1-01.mjs |

**Business Scenario.** An online marketplace shows every order a promised delivery date, and customers judge the promise by the calendar at their own address: a parcel handed over at 8 p.m. in Los Angeles is on time for a customer promised that day, even though it is already the next day in UTC. Carrier scans are recorded as UTC instants. The delivery-experience team wants a daily scorecard of promises kept, per `{{group_col}}`.

**Problem Statement.** Write one PostgreSQL query that returns, for every `(promised_date, {{group_col}})` that has orders: `promised_date`, `{{group_col}}`, `orders`, `on_time`, `late`, `undelivered`, `on_time_pct = ROUND(100.0 * on_time / orders, 1)` and `max_days_late` (the largest number of days a late order arrived after its promised date, NULL when the group has no late order). An order is **on time** when it is delivered and the local date of its delivery, in the order's `dest_tz`, is on or before `promised_date`; **late** when it is delivered after that date; **undelivered** otherwise. {{package_rule}} {{scan_rule}} Order by `promised_date, {{group_col}}`.

**Constraints.** One SQL statement (CTEs allowed). Every order appears in exactly one of the three outcomes, so `on_time + late + undelivered = orders`. The sample has {{n_orders}} orders; production has millions of orders a day across many fulfilment centres and destination time zones.

**Assumptions.** Hypothetical schema, identifiers, carriers and promises. `dest_tz` is a valid IANA time zone name. Every promised date in the sample is already in the past, so an order with no delivery by now is not going to change the scorecard by arriving early.

**Clarifications.**
- Q: Which date decides on time: UTC or local? | A: The destination's local date. Convert the delivery instant with `AT TIME ZONE dest_tz`, then take the date.
- Q: When is a multi-package order delivered? | A: When its last package is delivered. Until then the customer does not have the order.
- Q: Is a delivery on the promised date itself on time? | A: Yes. On or before the promised local date is on time.
- Q: Does an undelivered order count in the percentage? | A: Yes. It is in `orders` (the denominator) and not in `on_time`.
- Q: What does `max_days_late` measure? | A: Local delivery date minus promised date, in whole days, over late orders only.

**Hints.**
1. Bring everything to one row per order before grouping: the number of packages, the number delivered, and the latest local delivery date.
2. `(delivered_at AT TIME ZONE dest_tz)::date` turns a `timestamptz` into the local calendar date at the destination; DST is handled by the zone name.
3. Reduce scans to one delivery time per package first (`MIN(scanned_at)` over `DELIVERED`), then LEFT JOIN from orders so nothing disappears.

**Follow-ups.**
1. The scorecard runs hourly while parcels are still arriving. How do you keep "undelivered" from being read as "late" for promises that are still in the future?
2. A destination's `dest_tz` is missing for 0.5% of orders. What do you do with them, and how do you make sure the percentage is not quietly biased?
3. At hundreds of millions of scans a day, which table do you pre-aggregate, at what grain, and how do late scans (devices that upload a day later) correct it?
4. The business now wants promises judged per package for split shipments, and per order for the customer view. How do you model both without double-counting?

**Follow-up rules.**
- when: ::date, date(delivered_at, cast(delivered_at as date, date_trunc('day' → ask: Your date is taken from a timestamptz. In which time zone, and what happens to a parcel delivered at 21:00 in Los Angeles?
- when: inner join, join packages, join package_scans → ask: Which orders have no row on the other side of that join, and where do they end up in your counts?
- when: min(, first package, any package → ask: An order shipped as three packages; two arrived early and one arrived two days late. What did the customer experience, and what does your query say?
- when: max(scanned_at), last scan, latest scan → ask: A package has two DELIVERED scans a day apart because a device re-synced. Which one is the delivery?

**Evaluation Criteria.** Converts each delivery to the destination's local date before comparing; judges an order by its last package; first DELIVERED scan per package; attempts are not deliveries; keeps unshipped and undelivered orders in the denominator via LEFT JOINs; on-or-before comparison; exact rounding and NULL `max_days_late`; deterministic ordering.

## AMZ-L1-02: Package scan silences

| | |
|---|---|
| **Template ID** | AMZ-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Window functions / LEAD over ordered events, bounded sequences, per-group arg-max |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | AMZ-L1-02.mjs |

**Business Scenario.** A parcel moving through a delivery network is scanned at every hand-off: picked up, arrived at and departed from sort centres and delivery stations, out for delivery, delivered. A long stretch with no scan is how lost or stuck parcels show up first. The network-operations team wants a list of packages whose longest silence reached {{min_hours}} hours, with the facility where each one went quiet. The seller's label is created before the carrier has the parcel, and that wait is the seller's, not the network's.

**Problem Statement.** Write one PostgreSQL query against `package_scans` that returns one row per package whose longest silence is at least {{min_hours}} hours: `package_id`, `delivered` (whether the package has a `DELIVERED` scan), `gap_started_at` (the `scanned_at` of the scan before the silence), `facility_id` (that scan's facility) and `gap_hours = ROUND(seconds / 3600, 2)`. A package's scans are ordered by `(scanned_at, scan_id)`. The scans that count run from its first carrier scan (any `scan_type` other than `LABEL_CREATED`) up to and including its first `DELIVERED` scan, and a silence is the time between two consecutive counted scans. {{end_rule}} If two silences of one package tie for the longest, report the earlier. Order by the silence's exact length descending, then `package_id`. The report's `as_of` is `{{as_of}}`.

**Constraints.** One SQL statement (CTEs allowed). The threshold is inclusive: exactly {{min_hours}} hours qualifies. The sample has {{n_scans}} scans for {{n_packages}} packages; production has billions of scans a month.

**Assumptions.** Hypothetical facilities, scan types and timings. `scan_id` is unique and breaks ties between scans recorded at the same second. All timestamps are UTC instants.

**Clarifications.**
- Q: Does the wait between LABEL_CREATED and pickup count? | A: No. Until the first carrier scan the seller still has the parcel.
- Q: What about scans after delivery, such as a return pickup? | A: They are ignored: counting stops at the first DELIVERED scan.
- Q: Which facility do I report? | A: The facility of the scan before the silence: that is where the parcel went quiet.
- Q: Two scans have the same timestamp. Which comes first? | A: The smaller `scan_id`. Their silence is zero.
- Q: Is a silence of exactly {{min_hours}} hours reported? | A: Yes. The threshold is inclusive.

**Hints.**
1. Number each package's scans with `ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY scanned_at, scan_id)`, then find the first carrier scan and the first DELIVERED scan per package as row numbers.
2. Keep the rows between those two bounds; `LEAD(scanned_at)` over the kept rows gives the end of each silence.
3. Pick each package's longest silence with `DISTINCT ON (package_id) … ORDER BY package_id, gap DESC, rn`.

**Follow-ups.**
1. Operations wants this alert within an hour of a parcel going quiet, not in a nightly batch. What state do you keep per package, and when does the alert fire?
2. Some facilities upload scans in batches every few hours. How do you tell a stuck parcel from a facility whose scanners are offline?
3. Thresholds differ: a silence of 6 hours on an out-for-delivery van is alarming, 30 hours on a long linehaul is normal. How would you model expected silences per leg?
4. At billions of scans, how would you partition and cluster `package_scans` so this query reads only recent packages?

**Follow-up rules.**
- when: lag(, lead( → ask: Your window runs over all of a package's scans. What does it do with the label-to-pickup wait and with a return pickup three days after delivery?
- when: max(scanned_at) - min(, max - min, total transit → ask: That measures the whole journey. Which parcel has a 40-hour journey with no silence over 10 hours, and which has a 20-hour journey with one 15-hour silence?
- when: self join, correlated, scanned_at > → ask: How do you find "the next scan" with a self-join when two scans share a timestamp, and what does it cost on a package with 40 scans?
- when: order by scanned_at), partition by package_id order by scanned_at → ask: Two scans have the same `scanned_at`. Is your order deterministic, and which facility do you report?

**Evaluation Criteria.** Orders scans by `(scanned_at, scan_id)`; starts at the first carrier scan and stops at the first DELIVERED scan; LEAD (or equivalent) over the bounded sequence; reports the facility before the silence; earliest of equal longest silences; at the Very Hard level, the open silence to `as_of` for undelivered packages and no row for label-only packages; inclusive threshold; deterministic ordering.

## AMZ-L1-03: Shared cloud cost split by tagged usage, to the cent

| | |
|---|---|
| **Template ID** | AMZ-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / proportional allocation, largest-remainder rounding, window functions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | AMZ-L1-03.mjs |

**Business Scenario.** A company runs on a public cloud and reads its bill from a cost and usage report: one line item per account, usage day, service and charge type, with the team's cost-allocation tag where the resource was tagged. Some cost can never be tagged to one team (shared networking, monitoring, data transfer). Finance charges that shared cost back to teams in proportion to what each team used, and every cent of the pool must land on exactly one team.

**Problem Statement.** Write one PostgreSQL query on `cur_line_items` that returns one row per `(account_id, team)`: `direct_cents` (the team's tagged usage), `allocated_cents` (its share of untagged usage) and `total_cents = direct_cents + allocated_cents`. Within each `(account_id, usage_date)`, the untagged usage cost is the pool `P`, and each team with tagged usage that day, with tagged cost `t` out of the day's tagged total `T`, gets `floor(P * t / T)` cents; the cents still left over go one each to the teams with the largest remainders `(P * t) mod T`, ties broken by team name ascending. {{period_rule}} {{type_rule}} {{tag_rule}} Order by `account_id, team`.

**Constraints.** One SQL statement (CTEs allowed). Integer arithmetic only: no floating point, no rounding of fractions of a cent. For every pool, the allocated cents add up to exactly `P`. The sample has {{n_items}} line items; a large organisation's report has hundreds of millions of rows a month.

**Assumptions.** Hypothetical accounts, teams, services and amounts. Real reports carry costs as decimals with more precision; this extract has been rounded to whole cents. Treating tag values as case-insensitive is this exercise's business rule, not a property of any provider's tags.

**Clarifications.**
- Q: Is the split per day or over the whole period? | A: Per `(account_id, usage_date)`. Each day's pool follows that day's tagged usage; then add the days up.
- Q: Does a team with no tagged usage on a day get any of that day's pool? | A: No. Only teams with tagged usage that day share it.
- Q: Can I use ROUND on each share? | A: No. Independently rounded shares need not add up to the pool. Floor, then hand out the leftover cents by largest remainder.
- Q: Two teams have the same remainder and there is one cent left. Who gets it? | A: The team whose name sorts first.
- Q: Does one account's pool ever go to another account's teams? | A: Never. Pools are per account.

**Hints.**
1. Build two aggregates per `(account_id, usage_date)`: tagged cost per team, and the untagged pool. Join the pool onto the teams.
2. With integers, `P * t / T` is floor division and `P * t % T` the remainder (both are non-negative here). In PostgreSQL `SUM(bigint)` returns `numeric`, so cast the sums back with `::bigint` first. `SUM(t) OVER (PARTITION BY account_id, usage_date)` gives `T`.
3. Leftover cents = `P − SUM(floor)` over the pool. Rank teams by `(remainder DESC, team)` with `ROW_NUMBER()`; the first `leftover` of them get one more cent.

**Follow-ups.**
1. Finance asks why the allocation for one team changed after the month closed. Which late-arriving line items change a past day's allocation, and how do you make the report reproducible?
2. Proportional to cost penalises teams on expensive instance types for shared network traffic they did not cause. What other drivers could you allocate by, and what data would each need?
3. At hundreds of millions of line items a month, which intermediate tables would you materialise, and at what grain?
4. Some shared cost belongs to a platform team that itself serves other teams. How would you allocate in two stages without creating a cycle?

**Follow-up rules.**
- when: round(, numeric, float, double → ask: Three teams with equal usage share a pool of 100 cents. What does your rounding give each, and where did the missing cent go?
- when: month, whole period, date_trunc('month' → ask: A team used nothing on Monday and a lot on Tuesday. Should it carry part of Monday's shared cost?
- when: row_number(, rank(, dense_rank( → ask: Which function do you rank remainders with, and what happens to the leftover cents when two teams tie under it?
- when: team is null, where team is not null, coalesce(team → ask: What does your query do with a tag value of ' Checkout' or an empty string?

**Evaluation Criteria.** Pools per `(account, usage day)`; usage lines only; exact integer floor and remainder; leftover cents by largest remainder with team-name tie-break; allocations sum to the pool; daily results added up per team; at the Very Hard level, normalised tags, empty tags as untagged and an `'unallocated'` row for pools with no tagged usage; deterministic ordering.

## AMZ-L1-04: Usage above a capacity commitment

| | |
|---|---|
| **Template ID** | AMZ-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sweep line / interval events, half-open intervals, per-key integration |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer |
| **Generator** | AMZ-L1-04.mjs |

**Business Scenario.** A cloud customer pays in advance for a fixed amount of capacity in an instance family for a period: a commitment. Usage covered by the commitment costs nothing extra; anything running above it at a given moment is billed at the on-demand rate. The FinOps team wants to know, from a year or more of instance start and stop records, how much usage ran above the commitments, so it can decide whether to commit to more.

**Problem Statement.** Implement `on_demand_unit_seconds(usages, commitments)`. Each usage is `(start_s, end_s, family, units)`: an instance of that family running during the half-open interval `[start_s, end_s)`. Each commitment is `(start_s, end_s, family, units)`: capacity paid for during `[start_s, end_s)`. At any moment `t`, `used_f(t)` is the sum of `units` of usages of family `f` running at `t`, and `committed_f(t)` the sum of `units` of commitments of `f` active at `t`. Return a dict mapping every family that appears in `usages` to the integer `∫ max(0, used_f(t) − committed_f(t)) dt` in unit-seconds (0 if nothing ran above the commitment; a usage with `start_s == end_s` runs for no time but still puts its family in the result). Families that appear only in `commitments` are not in the result. {{family_rule}} {{unit_rule}}

**Constraints.** Up to 200 000 usages over several years of per-second timestamps, and up to a few hundred commitments; `0 ≤ start_s ≤ end_s`. Expected: O((n + c) log(n + c)). A loop over every second, or rescanning every usage for every interval, is too slow.

**Assumptions.** Hypothetical families, sizes and commitments. Real cloud commitment discounts (capacity reservations, savings plans) have their own documented matching and billing rules; this exercise uses a simplified rule on purpose. Unused commitment at one moment is not carried to another.

**Clarifications.**
- Q: An instance stops at second 100 and another starts at second 100. Do they overlap? | A: No. Intervals are half-open, `[start, end)`.
- Q: If the commitment is 3 units and 1 unit is running, is the result negative? | A: No. Only usage above the commitment counts; spare commitment is wasted, never credited.
- Q: Does a commitment for one family cover another family's usage? | A: No. Families are independent.
- Q: Do I report a family whose usage was all covered? | A: Yes, with 0. Every family in `usages` is in the result.

**Hints.**
1. Turn every interval into two events: `+units` at its start and `−units` at its end (commitments with the opposite sign). Only the times where something changes matter.
2. Sort the event times per family and walk them: between two consecutive times, `used − committed` is constant, so its positive part times the gap is the on-demand amount for that stretch.
3. Apply every change at a time before integrating the next stretch; then the order of events at the same time does not matter.

**Follow-ups.**
1. The FinOps team asks: what commitment level `C` would have minimised cost over last year, given an on-demand price and a commitment price per unit-second? Use your sweep to answer it.
2. Usage records arrive as an unbounded stream, partitioned across 50 workers. How do you compute the same number per hour, and what must reach one place?
3. A commitment may cover several families at a discount ratio (a larger family consumes it faster). How does your state change?
4. The usage list has 2 billion rows for the whole organisation. Which parts of the sweep would you do in SQL, and which can you not?

**Follow-up rules.**
- when: for t in range, per second, every second → ask: The timing test spans four years. How many iterations is that per family, and how much memory does an array per second need?
- when: sort, sorted(, heapq → ask: Two events share a timestamp: one instance stops and another starts. Does the order you process them in change your answer?
- when: defaultdict, dict of lists, group by family → ask: How much memory does your solution hold at once, and could you stream families one at a time?
- when: interval tree, segment tree → ask: What query does that structure answer that a single sorted sweep does not need here?

**Evaluation Criteria.** Half-open intervals; per-family independence; positive part only (no banking); every usage family in the result, zero-length included; commitments of unused families excluded; overlapping commitments add up and units weigh both sides; O(n log n) via a sorted sweep with all changes at a time applied before integrating.

## AMZ-L1-05: Dock doors for inbound trailers

| | |
|---|---|
| **Template ID** | AMZ-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / event simulation, priority queues, deterministic tie-breaks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | AMZ-L1-05.mjs |

**Business Scenario.** A fulfilment centre receives inventory from trailers that back into numbered dock doors. Trailers that arrive while every door is busy wait in the yard. Planners want to replay a day (or a peak season) of arrivals under a simple, fixed rule to see when each trailer would start unloading and at which door, before they change the rule or add doors.

**Problem Statement.** Implement `assign_doors(trailers, doors)`. Each trailer is `(arrival_min, trailer_id, unload_min, priority)`; doors are numbered `1..doors` and all free at the start. Whenever at least one door is free and at least one trailer has arrived and is waiting, the first waiting trailer takes the lowest-numbered free door and starts unloading at that minute; its door is busy during `[start, start + unload_min)` and free again at `start + unload_min`. The first waiting trailer is the one with the smallest `priority`, then the earliest `arrival_min`, then the smallest `trailer_id`. A door that frees at minute `t` can be taken at `t`, including by a trailer arriving at `t`, and before choosing at minute `t` every trailer that has arrived by `t` is in the yard. Return a dict mapping each `trailer_id` to `(door, start_min)`. {{order_rule}} {{priority_rule}}

**Constraints.** Up to 200 000 trailers and a few hundred doors; minutes are non-negative integers, `unload_min ≥ 1`, trailer ids are unique. At peak the yard holds tens of thousands of trailers. Expected: O(n log n).

**Assumptions.** Hypothetical arrivals, unload times and priorities. Real yard and dock scheduling uses appointments, door types and labour plans; this replay deliberately has one fixed rule.

**Clarifications.**
- Q: A door frees at minute 40 and a trailer arrives at minute 40. Can it use that door? | A: Yes, at minute 40.
- Q: Two doors are free. Which one does the trailer take? | A: The lowest-numbered.
- Q: Can an urgent trailer stop an unload in progress? | A: No. It waits for the next free door, and then goes ahead of less urgent trailers.
- Q: How are `trailer_id` values compared? | A: As strings, in the usual ascending order.
- Q: Is the input sorted? | A: Do not rely on it; sort it yourself.

**Hints.**
1. Keep three heaps: free door numbers, busy doors keyed by the minute they free up, and the yard keyed by `(priority, arrival_min, trailer_id)`.
2. Jump time, never step it: if the yard is empty, jump to the next arrival; if it is not empty and no door is free, jump to the next door to free up.
3. At each jump, first free the doors and admit the arrivals up to that minute, then assign while both a door and a trailer are available.

**Follow-ups.**
1. Planners want the average and the 95th-percentile yard wait per priority. What do you add, and what does the 95th percentile cost to compute exactly?
2. Some doors can only take refrigerated trailers. How do the heaps change when a trailer can only use some doors?
3. Low-priority trailers can now wait forever behind a stream of urgent ones. Propose an aging rule and say how it changes your data structures.
4. Replay a full peak season for 900 sites, each independently. How would you run it, and what would you store for analysis?

**Follow-up rules.**
- when: sort(key, list.sort, min(, pop(0) → ask: How long does the yard get in the timing test, and what does finding the next trailer cost per assignment in your structure?
- when: for each minute, while t <, t += 1 → ask: How many minutes does the timing test span, and how many of them change anything?
- when: heapq, priority queue, heap → ask: What exactly is your yard heap keyed on, and what happens when two trailers tie on priority and arrival?
- when: for door in range, scan doors, first free → ask: With 300 doors and 200 000 trailers, how many door checks is that, and how would a heap of free doors change it?

**Evaluation Criteria.** A door freed at `t` is usable at `t`; arrivals at `t` join before assigning; lowest free door; yard order (priority, arrival, trailer_id); no preemption; input sorted by the candidate; time jumps between events; O(n log n) with heaps for free doors, busy doors and the yard.
