# Uber · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a marketplace
for ride-hailing, food delivery and freight, with riders, drivers, couriers,
merchants and cities. Every workload, number, schema and incident is
hypothetical, and nothing here describes how any company's systems are actually
built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## UBR-L3-01: Trips, shared-ride legs and fares that change after the ride

| | |
|---|---|
| **Template ID** | UBR-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / vehicle trip versus rider leg, fare components, post-trip adjustments and tips |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_trips": {"1": ["2 million"], "2": ["12 million", "20 million"], "3": ["35 million", "60 million"]},
  "shared_share": ["5%", "12%", "20%"],
  "tip_window_days": [7, 30],
  "currencies": [12, 45, 70]
}
```

**Business Scenario.** A ride-hailing marketplace completes about {{daily_trips}} trips a day, priced in {{currencies}} currencies. In this scenario a rider is shown an upfront price when requesting; the price is built from components (a base amount, time and distance, a dynamic-pricing adjustment, a booking fee, airport or toll surcharges, a promotion and taxes), and the driver's earnings are calculated separately from what the rider pays. About {{shared_share}} of vehicle trips are shared: several riders, each with their own pickup, drop-off and price, ride in one vehicle at once, and the driver is paid for the vehicle trip. After the ride, things change: a rider can add a tip for up to {{tip_window_days}} days, support can adjust a fare after a route complaint, a cleaning fee can be charged, and a promotion can be reversed when a payment fails. Rider receipts, driver earnings statements and the finance team's gross bookings and take rate must all agree.

**Problem Statement.** Design the data model from the trip service to the analytical facts. Cover: the vehicle trip, the rider legs on it (shared or not) and the keys between them; the fare at its proper grain, with components as typed lines and the price version that produced them; driver earnings as their own lines on the vehicle trip; how post-trip changes (tips, adjustments, refunds, fees, promotion reversals) are recorded without rewriting what a rider or driver already saw; and the facts with their grains that answer "gross bookings and take rate by city and day", "driver earnings per online hour", "adjustments by reason and city" and "tips as a share of fares". Write one definition of gross bookings and one of take rate that finance can use.

**Constraints.** Money is stored as integers in each currency's minor unit, together with its currency; amounts in different currencies are never added without an explicit, dated conversion. A rider's receipt and a driver's statement, once issued, change only through new lines that both can see. Tips belong to the driver and are never part of the marketplace's revenue in this scenario. The state of a trip's money at any past time must be reconstructable.

**Assumptions.** Volumes, shares, the tip window and the currency count are hypothetical, as are the fare components and the rule that tips go wholly to drivers. A shared trip's rider prices are set when each rider is matched and need not sum to the driver's earnings. Pricing rules themselves are out of scope; only their version is recorded.

**Clarifications.**
- Q: Is the shared trip one trip or several? | A: Your choice, but both the driver's vehicle trip and each rider's leg must be identifiable. The driver sees one trip; each rider sees their own.
- Q: Can the final price differ from the upfront price? | A: Yes, in this scenario, when the rider changes the destination or the route differs greatly. Record both and why they differ.
- Q: Which date does a tip count on? | A: Your choice. Say whether finance reports tips on the trip date or the tip date, and how a month that has closed handles a late tip.
- Q: Who pays a cancellation fee? | A: The rider, when they cancel after a grace period; the driver receives part of it. A trip that never started can still carry money.
- Q: Are all currencies two-decimal? | A: No. Some currencies have no minor unit and a few have three decimals.

**Hints.**
1. Separate the vehicle trip (driver, vehicle, route, timestamps) from the rider leg (rider, pickup, drop-off, price). A non-shared trip is a vehicle trip with one leg.
2. Treat each receipt and each earnings statement as a small ledger: typed, signed lines that are appended, never edited. Current totals are sums.
3. Record the currency's minor-unit exponent once in a currency dimension, not in each amount column's code path.

**Follow-ups.**
1. Walk one shared trip with three riders, one of whom changes the destination, through your tables. What does each rider's receipt show, and what does the driver's statement show?
2. A tip arrives {{tip_window_days}} days after the trip, in a month already closed for finance. Which rows are created, which reports change, and which do not?
3. Define gross bookings and take rate precisely. Which line types are in each, and how are tips, tolls, taxes and refunds treated?
4. Support refunds part of a fare after a route complaint, and the driver's earnings are not reduced. How does the take rate for that trip look, and is that what finance wants?
5. At {{daily_trips}} trips a day, which facts do you keep at line grain, which at trip or leg grain, and how do you keep the daily refresh cheap when tips trickle in for {{tip_window_days}} days?

**Follow-up rules.**
- when: fare column, total_fare, fare_amount → ask: A tip, a cleaning fee and a partial refund arrive in the week after the trip. Where do they go if the fare is one column, and how does the receipt from the day of the trip stay the same?
- when: float, decimal, double → ask: A city prices in a currency with no minor unit and another in a three-decimal currency. How are amounts stored, and how does a report avoid being off by a factor of 100 or 1,000?
- when: shared, pool, legs → ask: Three riders' fares are joined to the vehicle trip and its driver earnings. What does SUM(driver_earnings) return for that trip, and how does your model prevent it?
- when: update, overwrite → ask: The driver downloaded last week's statement before a fare adjustment. How do you show them what changed and why, without the old statement disagreeing with the new one?
- when: exchange rate, convert, usd → ask: Which rate and which date convert a trip's money, and what happens to last month's gross bookings when a rate is corrected?

**Production Reality Check.**
- Tips that arrive days after the trip are attached by updating the trip's fact row. Driver earnings statements already sent no longer match the warehouse, and the tips-share-of-fares metric for last month drifts every day for {{tip_window_days}} days.
- A dashboard joins rider legs to vehicle trips and sums driver earnings: for the {{shared_share}} of trips that are shared, earnings are counted once per rider, and earnings per online hour look far too high in the busiest cities.
- One market's currency has no minor unit, but a new pipeline divides every amount by 100. Its gross bookings fall a hundredfold on the global dashboard, and nobody notices for two days because that market is small.

**Evaluation Criteria.** Vehicle trip and rider leg as separate grains with explicit keys; fare components and earnings as typed, signed lines with the price version; post-trip changes appended as lines that both receipt and statement can see; tips kept out of revenue; money as integer minor units with a currency and a known exponent; written definitions of gross bookings and take rate; facts at stated grains with a policy for late tips in closed months; each incident contained, corrected and guarded.

## UBR-L3-02: Driver onboarding and document compliance, city by city, with full history

| | |
|---|---|
| **Template ID** | UBR-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated requirement rules, document versions, compliance intervals, audit |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "drivers": {"1": ["300,000"], "2": ["2 million", "3 million"], "3": ["5 million", "7 million"]},
  "cities": [60, 400, 1000],
  "document_types": [6, 12, 20],
  "grace_days": [0, 7, 14]
}
```

**Business Scenario.** A ride-hailing and delivery marketplace works with about {{drivers}} active drivers and couriers across {{cities}} cities. Before someone can go online, and for as long as they stay online, they must hold valid documents, and the set depends on the city and the product: a driver's licence, a vehicle registration, commercial insurance, a vehicle inspection, a city permit, a background check, and for delivery by bicycle almost none of these. There are {{document_types}} document types in all. Each document is submitted (often as a photo), checked automatically and sometimes by a reviewer, and carries an expiry date. Cities change their rules with effective dates: a new inspection requirement, a shorter renewal period. In this scenario a driver whose document expires has {{grace_days}} days of grace before they are blocked from going online. Regulators and the safety team must be able to ask, for any past trip, "was this driver compliant, under the rules then in force, at that moment?"

**Problem Statement.** Design the data model for requirements, documents and compliance. Cover: requirement rules per city and product as effective-dated versions; document submissions, their review decisions (automated and manual, with reasons) and the extracted fields (number, issuer, expiry); compliance as intervals per driver, city and product derived from the two; the onboarding funnel (sign-up, documents submitted, approved, first trip); and the facts that answer "time from sign-up to first trip by city and week", "documents expiring in the next 30 days", "reviews per reviewer and outcome", and "trips taken while not compliant" (which should be none). Say where document images live and who can see what.

**Constraints.** Rules are never edited in place: a change is a new version with an effective time. A decision on a document is never deleted; a later decision supersedes it. Compliance at any past instant must be reproducible from what was known then, and separately from what is known now. Document images and personal fields are visible only to roles that need them; the analytical warehouse keeps no images. Expiry is evaluated in the city's local time.

**Assumptions.** Driver counts, city counts, document types and grace periods are hypothetical, and so are the rules. A driver can be onboarded in more than one city and for more than one product. Background-check results arrive from an external provider and can take days.

**Clarifications.**
- Q: Does a new rule apply to drivers who are already active? | A: Yes, from its effective date, unless the rule says existing drivers have a transition period. Model both.
- Q: Can a document be approved and later found invalid? | A: Yes, after an audit. The approval stays on record and a new decision revokes it from a stated time.
- Q: Is a document's expiry a date or an instant? | A: A date printed on the document. You decide which local instant it ends, and in which time zone.
- Q: Does one document serve several cities? | A: A licence can; a city permit cannot. Requirements reference document types, and a document can satisfy requirements in several cities.
- Q: What happens to the data when a driver leaves? | A: Personal data is deleted after a retention period; the facts needed for safety audits are kept in a form you describe.

**Hints.**
1. Keep three things apart: what was required (rule versions), what was presented and decided (documents and decisions), and the derived compliance intervals.
2. Compliance is an interval table: (driver, city, product, valid_from, valid_to, reason). A trip joins to it with a half-open time condition.
3. "Known then" versus "known now" is two time axes: when something was true, and when the system recorded it.

**Follow-ups.**
1. Write the derivation of compliance intervals for one driver whose insurance expires, is renewed four days later, and whose city adds an inspection requirement in between. Show the intervals with a {{grace_days}}-day grace.
2. An audit revokes an approval of a licence made three months ago. Which past trips become "taken while not compliant", and how does the report distinguish "known then" from "known now"?
3. A city adds a requirement with a transition period for existing drivers. How do the rule version and the intervals represent it?
4. At {{drivers}} drivers and {{cities}} cities, how often do you recompute intervals, and what event triggers a recompute for one driver instead of everyone?
5. A driver asks for their data to be deleted. What is removed, what is kept for safety audits, and in what form?

**Follow-up rules.**
- when: is_compliant, status column, boolean → ask: A regulator asks whether a driver was compliant at 21:40 on a date eight months ago. Your flag says true today. How do you answer?
- when: expiry, expires, expiration → ask: The document says it expires on a date. In a city twelve hours ahead of UTC, at which instant is the driver blocked, and who decides?
- when: rules table, requirements table, config → ask: A city shortens its renewal period from next month. Is the old rule overwritten? How does an audit of last month's trips see the old one?
- when: image, photo, s3, blob → ask: Who can open the licence photo, how long is it kept, and does any of it reach the warehouse?
- when: bitemporal, recorded_at, as of → ask: Show the two queries: compliant under what we knew at the time, and compliant under what we know now. Which one does a regulator ask for?

**Production Reality Check.**
- A city's rule was corrected by editing the existing rule row instead of adding a version. The safety team's monthly audit now reports hundreds of past trips as non-compliant that were compliant under the rule in force at the time.
- The nightly expiry job evaluates dates in the server's UTC day. Drivers in cities far east of UTC are blocked several hours late; with a {{grace_days}}-day grace the window is shifted by most of a day, and some trips run on expired insurance.
- Automatic extraction read some expiry dates in month/day order where the document uses day/month. Across {{document_types}} document types the share is small, but some drivers stayed online with expired documents and others were blocked with valid ones.

**Evaluation Criteria.** Effective-dated rule versions per city and product; documents, extracted fields and append-only decisions with reasons; compliance as derived half-open intervals with grace, transitions and revocations; trips joined to intervals by time; two time axes for known-then versus known-now; local-time expiry with an explicit time zone; images separated with access control and retention; funnel and audit facts at stated grains; each incident contained, corrected and guarded.

## UBR-L3-03: Hex cells, zones and geofences that change over time

| | |
|---|---|
| **Template ID** | UBR-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / hierarchical hex grid, versioned polygons, effective dating, point-in-zone assignment |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "base_resolution": [7, 8, 9],
  "geofences": ["20,000", "150,000", "600,000"],
  "zone_edits_per_week": [50, 500, 3000],
  "daily_points": {"2": ["2 billion", "8 billion"], "3": ["30 billion", "80 billion"]}
}
```

**Business Scenario.** A ride-hailing and delivery marketplace describes places in two ways. For pricing, supply and demand it uses a hierarchical hexagonal grid, such as the open-source H3 system: the earth is divided into hexagonal cells at 16 resolutions, each cell has about seven children at the next finer resolution, the children do not cover their parent exactly, and each resolution also has twelve pentagons. Here the base resolution is {{base_resolution}}. For operations it uses polygons: city boundaries, pricing zones, airport pickup areas with their own rules, and short-lived event geofences around a stadium for a concert night. There are about {{geofences}} active zones and geofences, and operations edits about {{zone_edits_per_week}} a week: a zone is redrawn, split in two, merged, or an event geofence is created for a few hours. The platform assigns about {{daily_points}} location points a day (pings, pickups, drop-offs) to cells and zones, and analysts compare metrics for a zone across months in which its boundary changed.

**Problem Statement.** Design the geospatial reference model. Cover: cells (id, resolution, parent) and what "parent" means when children do not nest exactly; zones and geofences with types, owners and versioned geometries; effective dating (valid from and to) and, separately, when each version was recorded; a derived mapping from base-resolution cells to zone versions, with the rule used for cells on a boundary; precedence when zones overlap (an airport pickup area inside a pricing zone inside a city); how a point is assigned for pricing (fast, approximate) and for an airport rule or a tax boundary (exact); and how metrics are compared across versions of a zone.

**Constraints.** A zone version is immutable once published; a correction is a new version. Any historical point or trip can be re-assigned to the zones that were in force at its time, and the report says which versions it used. Cell ids are stable and meaningful; zone ids survive redraws while version ids change. A city lookup must answer in milliseconds; an exact polygon test is allowed only where the rule requires it.

**Assumptions.** Counts, edit rates and the base resolution are hypothetical; the grid facts above describe the open-source system in general terms (check current docs). Geometries are stored in one coordinate reference system (longitude and latitude). Event geofences carry a time window as well as a geometry.

**Clarifications.**
- Q: Does a zone equal a set of cells? | A: Approximately. You decide the rule for boundary cells (cell centre inside the polygon, any overlap, or majority of area) and when an exact polygon test overrides it.
- Q: Can two zones of the same type overlap? | A: Pricing zones must not; geofences of different types can, and an airport area overrides its pricing zone for pickups.
- Q: What happens to history when a zone is split? | A: The old zone's last version ends; two new zones (or the old one and a new one) start. Analysts still want a continuous series where it makes sense.
- Q: Can a version be backdated? | A: Operations sometimes asks for it. Decide whether you allow it and how reports that already used the old version find out.
- Q: Are cells at a coarser resolution exact unions of base cells? | A: No. Rolling up base cells to a coarser parent is approximate at the edges.

**Hints.**
1. Separate the grid (static, computed by a library), the zone catalogue (zone id, type, owner), and zone versions (geometry, valid_from, valid_to, recorded_at).
2. Precompute cell to zone-version mappings per version at the base resolution; a lookup is then an equality join on the cell id plus a time condition.
3. For metrics across a redraw, decide between "as it was" (each period with its own version) and "as it is" (re-assign history to the current geometry), and label which.

**Follow-ups.**
1. A pricing zone is split in two. Show the rows in the zone, version and mapping tables before and after, and how a monthly trend for the old zone is drawn.
2. A pickup lands in a base-resolution cell that straddles the airport boundary. How does the pricing lookup assign it, and when does the airport rule run an exact test?
3. Estimate the size of the cell-to-zone mapping at resolution {{base_resolution}} for a large city, and how it grows if you move one resolution finer.
4. A version was published with a valid_from two weeks in the past. Which facts must be recomputed, and how do you tell their consumers?
5. With {{daily_points}} points a day, where does the point-to-cell and cell-to-zone assignment happen, and what is stored with each point so it never has to be repeated?

**Follow-up rules.**
- when: geohash → ask: Why might a hexagonal grid suit pricing and neighbour lookups better than rectangles, and what does a geohash give you that a hex grid does not?
- when: parent, rollup, roll up → ask: The children of a cell do not cover it exactly. What does a zone metric computed from coarser parents count twice or miss at the edges?
- when: polygon, st_contains, point in polygon → ask: An exact point-in-polygon test for every one of the points is expensive. Which points need it, and how do the others avoid it?
- when: valid_from, effective date, scd → ask: Is valid_from the time the boundary applies or the time it was recorded? Show what happens when operations backdates a version.
- when: overwrite, update the geometry → ask: Last month's airport pickup report was computed with the old boundary. After the geometry is overwritten, can you reproduce that report?

**Production Reality Check.**
- A redrawn pricing zone was published with a valid_from in the past. The nightly job re-assigned the previous month's trips, and city reports for a month already closed changed without notice.
- A dashboard computed zone metrics by rolling base resolution {{base_resolution}} cells up to their coarser parents. Because children do not nest exactly, trips near zone edges were counted in two zones or none, and the totals stopped matching the city's.
- An event geofence around a stadium was created without an end time. Its pickup rules stayed active for nine days, and about {{zone_edits_per_week}} weekly edits made it hard to find which change caused it.

**Evaluation Criteria.** Grid, zone catalogue and immutable zone versions separated; valid time and recorded time kept apart; an explicit boundary-cell rule and an exact test only where a rule needs it; precedence for overlapping types; precomputed cell-to-version mappings with stable cell ids; parent rollups treated as approximate; a stated policy for backdating and for "as it was" versus "as it is" reporting; each incident contained, corrected and guarded.

## UBR-L3-04: Delivery orders, batched courier trips and refunds by item

| | |
|---|---|
| **Template ID** | UBR-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / order items with modifiers, many-to-many orders and courier trips, item-level refunds, cost allocation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_orders": {"1": ["1 million"], "2": ["6 million", "10 million"], "3": ["20 million", "35 million"]},
  "batched_share": ["10%", "25%", "40%"],
  "merchants": ["80,000", "500,000", "1 million"],
  "refund_share": ["1%", "3%"]
}
```

**Business Scenario.** A food and grocery delivery marketplace takes about {{daily_orders}} orders a day from {{merchants}} merchants. An order holds items, each with a quantity and modifiers (a size, extra toppings, a substitution preference); grocery items can be substituted or found out of stock while being picked. Couriers deliver, and about {{batched_share}} of orders are batched: one courier trip picks up two or more orders, sometimes from different merchants, and drops them off in a sequence. Couriers are paid per trip, with components for distance, time and each extra stop. Customers pay item prices, a delivery fee, a service fee and sometimes a small-order fee, minus promotions that are funded by the marketplace or by the merchant. About {{refund_share}} of orders get a refund, usually for one or two items (missing, wrong, damaged), and whether the merchant or the marketplace bears it depends on the reason.

**Problem Statement.** Design the data model from the order and dispatch systems to the analytical facts. Cover: orders, order items and modifiers with the menu or catalogue version they were ordered from; substitutions and out-of-stock events; courier trips, their stops and the many-to-many link between trips and orders (including an order re-assigned to a second courier); money as typed lines for customer charges, merchant payouts, courier pay and promotions with their funder; item-level refunds with a reason and a liable party. Define the facts and grains that answer "refund rate by merchant and item", "delivery cost per order", "time from merchant ready to drop-off, per order, for batched and single orders", and "merchant payout per week".

**Constraints.** Money is stored as integers in minor units with a currency. Refunded quantity for an item line never exceeds its ordered quantity, and refunded amount never exceeds what was charged for it. An item ordered last month is reported under what it was then, even if the menu changed. Courier pay is never shown to merchants, and customer details are never shown to couriers after delivery.

**Assumptions.** Volumes, shares and fee types are hypothetical. In this scenario courier pay is set per trip, not per order. A merchant can edit its menu at any time; item ids may be reused by the merchant for a different dish.

**Clarifications.**
- Q: Can an order be split across couriers? | A: Rarely, for a large grocery order. More often an order is re-assigned when a courier cancels; both trips are recorded.
- Q: Which time does "delivery time" start from? | A: Define it. The customer sees time from placing the order; merchants are judged from the time they marked it ready.
- Q: Who bears a refund for a missing item? | A: In this scenario the merchant for missing or wrong items it packed, the marketplace for damage in transit. The liable party is recorded per refund line.
- Q: Is a substitution a new item line? | A: Your choice. The customer is charged for what was delivered, and the merchant's item metrics need both what was ordered and what was sent.
- Q: Can a refund be issued twice for the same item? | A: It must not be. Refunds arrive from the app and from support chat.

**Hints.**
1. Snapshot the item name, price and modifiers onto the order item line from the menu version; never join an old order to the current menu for its name or price.
2. A courier trip and an order are many-to-many through a stop table (trip, stop sequence, order, pickup or drop-off, times).
3. Courier cost per order needs an allocation rule written down (by stops, by distance, equal split); the trip's pay itself is stored once.

**Follow-ups.**
1. Walk a batched trip with two orders from two merchants, where one item in the second order is refunded. Which rows exist, and what are the delivery cost and refund cost per order?
2. A merchant reuses an item id for a different dish. How does your model keep last month's refund rate for the old dish correct?
3. Write the refund invariant as a check. Where does it run, and what happens to a support refund that would break it?
4. Choose the courier-cost allocation rule for batched orders and justify it. How does the cost per order change when {{batched_share}} of orders are batched?
5. At {{daily_orders}} orders a day, which facts are kept at item grain and which at order or trip grain, and how are late refunds folded in?

**Follow-up rules.**
- when: join on order_id, trip per order, order has a courier → ask: One courier trip carries three orders. Joined to orders, what does SUM(courier_pay) return, and what does your cost per order show?
- when: item_name, menu table, current menu → ask: The merchant renamed and repriced a dish last week. What do last month's item-level reports show if the order joins to the menu?
- when: refund_amount, refunded, refund → ask: The app and a support agent both refund the same missing drink. What stops the second refund, and what does the item-level refund rate show if it slips through?
- when: delivery time, eta, minutes → ask: In a batched trip the second order waits while the first is dropped off. Whose delivery time includes that wait, and is the merchant judged on it?
- when: promotion, discount, promo → ask: A promotion is funded half by the merchant and half by the marketplace. How does that split appear in the merchant's payout and in the marketplace's take rate?

**Production Reality Check.**
- A cost-per-order dashboard joined each courier trip's pay to every order on the trip. For the {{batched_share}} of orders that are batched, delivery cost was counted several times, and batching looked more expensive than single orders.
- A merchant chain reused item ids for a new menu. Refund rates for its old dishes jumped, because new refunds were attributed to old item names joined from the menu.
- The app and support chat both issued refunds for the same missing items for a few hours. About {{refund_share}} of orders are refunded normally; that day some orders were refunded more than their charge, and merchant payouts were reduced twice.

**Evaluation Criteria.** Order item as the grain for money and refunds, with modifiers and a menu snapshot; substitutions and out-of-stock events kept; courier trips and orders linked many-to-many through stops; courier pay stored once and allocated by a stated rule; typed money lines with funder and liable party; refund invariants enforced with idempotency; delivery-time definitions per audience; visibility rules for merchants and couriers; each incident contained, corrected and guarded.

## UBR-L3-05: Surge exposure per city and local hour

| | |
|---|---|
| **Template ID** | UBR-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / half-open range join, default multiplier, local time zones, fan-out, weighted shares |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |
| **Generator** | UBR-L3-05.mjs |

**Business Scenario.** A ride-hailing marketplace prices each request with a dynamic multiplier. In this exercise's model, when demand outruns supply in a zone, the pricing system opens a surge window for that zone: `surge_windows` holds windows per `zone_id` with a `multiplier`, each covering `starts_at` up to but not including `ends_at`; windows of one zone never overlap, adjacent windows can touch, and a window may set exactly 1.00x. `ride_requests` holds each request with its `city_id` and `zone_id`, and `trips` holds each match of a request to a driver with its `status` (`completed`, `rider_cancelled` or `driver_cancelled`). {{trip_rule}} Each city reports in its own time zone, from `cities.time_zone`; the cities here are {{city_list}}. The marketplace health team wants to know how exposed riders were to surge pricing, per city and local hour: as a share of requests, and weighted by the trips that actually completed.

**Problem Statement.** Write one PostgreSQL query for the local report date `{{report_date}}` that returns `city_id, local_hour, requests, surged_requests, request_surge_share, completed_trips, surged_completed_trips, completed_surge_share`, ordered by `city_id, local_hour`. A request belongs to the local date and hour of its `requested_at` in its city's time zone; `local_hour` is the start of that hour as a local timestamp without time zone (for example `{{report_date}} 08:00:00`). Only requests on the report date count. A request's multiplier is that of the window of its zone with `starts_at <= requested_at < ends_at`, or 1.00 when no window is in force; it is surged when the multiplier is above 1.00. `requests` counts the hour's requests and `surged_requests` the surged ones. `completed_trips` counts the hour's requests that have a completed trip (a completed trip counts in the hour of its request, whenever it ended), and `surged_completed_trips` the surged ones among them. `request_surge_share` is `surged_requests / requests` and `completed_surge_share` is `surged_completed_trips / completed_trips`, both rounded to 4 decimal places; `completed_surge_share` is NULL when `completed_trips` is 0. Return only (city, hour) rows with at least {{min_requests}} requests.

**Constraints.** One SQL statement (CTEs allowed). The session time zone is UTC. The sample has {{requests_n}} requests, {{windows_n}} surge windows and {{trips_n}} trips; production has tens of millions of requests a day across hundreds of cities, and windows change every few minutes.

**Assumptions.** The schema, zones, windows, multipliers, requests and trips are hypothetical, and the cities' names and time zones are labels only. No listed time zone changes its UTC offset on the report date. A zone belongs to one city. Fares and amounts are out of scope.

**Clarifications.**
- Q: Is a request at exactly `ends_at` priced by that window? | A: No. Windows are half-open: `starts_at <= requested_at < ends_at`. A request at exactly `starts_at` is priced by the window.
- Q: What about a request when no window is open for its zone? | A: It is priced at 1.00x: not surged, but it is a request and stays in the denominator.
- Q: Does a 1.00x window count as surge? | A: No. Surge means strictly above 1.00x.
- Q: In which hour does a completed trip count? | A: In the hour of its request, even if the trip ended in a later hour or on the next day.
- Q: What if an hour has requests but nothing completed? | A: Keep the row if it meets the floor, with `completed_trips` 0 and a NULL `completed_surge_share`.
- Q: Which time zone defines the report date? | A: Each city's own, the same one that defines its hours.

**Hints.**
1. Price each request first: LEFT JOIN the window of its zone with a half-open range condition, and COALESCE the multiplier to 1.00.
2. Reduce trips to one "completed" flag per request before joining (EXISTS, or a DISTINCT list of completed request ids). Joining requests to all their trips multiplies them.
3. `requested_at AT TIME ZONE c.time_zone` gives the local wall-clock time; truncate it to the hour, and cast it to a date for the report-date filter.
4. `COUNT(*) FILTER (WHERE …)` counts a subset; `NULLIF(x, 0)` turns a zero denominator into NULL.

**Follow-ups.**
1. The team rolls the hourly shares up to a day per city. Why is the average of the hourly shares wrong, and what do you compute instead?
2. Operations later corrects a window that stayed open by mistake. Should this report recompute the multiplier from the windows, or use the multiplier each rider was quoted? Which table would you add?
3. On a day when a city's clocks fall back, one local hour happens twice. What does your query return for it, and what should the report show?
4. At production scale, how do you make the range join to windows cheap, and how would you serve this metric for every city every few minutes?

**Follow-up rules.**
- when: between → ask: BETWEEN includes both ends. A request arrives exactly at one window's ends_at, which is also the next window's starts_at. Which multiplier does it get under your join, and how many rows does it produce?
- when: inner join → ask: Which requests disappear when no window is open for their zone at that moment, and what happens to the denominator of the share?
- when: utc → ask: A city is UTC+5:30. Which UTC hour bucket holds its 08:00–09:00 local hour, and which local date does a request at 20:00 UTC on the report date belong to?
- when: avg, average → ask: Average over which rows? After joining trips, a re-matched request appears several times. What does that do to your share?
- when: count(distinct → ask: COUNT(DISTINCT request_id) fixes the requests column after a join to trips. Are surged_requests and the completed counts protected the same way?
- when: multiplier >= → ask: Is a request priced at exactly 1.00x exposed to surge? What does your comparison count for a window that sets 1.00x?

**Production Reality Check.**
- After a pricing incident, operations shortened a surge window that had stayed open by mistake. This report, recomputed from the corrected windows, now shows those riders as unsurged although their receipts show a surge; the multiplier each request was quoted was never stored with it.
- A first version of this report bucketed hours in UTC. For a city at UTC+5:30 every local hour was split across two bars and its local midnight hour landed on the previous day, and the city team stopped trusting the numbers for a week.

**Evaluation Criteria.** Each request priced by a LEFT JOIN on its zone with a half-open interval and a 1.00 default; surge as strictly above 1.00; trips reduced to one completed flag per request before counting; local hour and local date from the city's time zone; completed trips counted in the request's hour; shares rounded as stated with NULL for an empty denominator; the floor applied in HAVING; deterministic order; can explain why hourly shares are not averaged, why the quoted multiplier should be stored on the request, and how a repeated local hour behaves.
