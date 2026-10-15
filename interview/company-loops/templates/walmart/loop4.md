# Walmart Global Tech · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of omnichannel
retail: stores and e-commerce, online grocery pickup and delivery, store
inventory and replenishment, fulfilment from stores and distribution centres,
returns, and pricing. Every workload, number and schema is hypothetical;
pricing, rollback, clearance, price-match, return and slot rules are this
exercise's rules (check current docs), and nothing here describes how the
company's own systems, suppliers or carriers work. Store, associate and
customer data appear only in aggregate.

## WMT-L4-01: Near-real-time store inventory across thousands of stores, corrected by cycle counts

| | |
|---|---|
| **Template ID** | WMT-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Event-sourced state / perpetual inventory, count corrections, late data, availability shown online |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "stores": {"2": ["1,200", "2,500"], "3": ["4,600", "10,000"]},
  "items_per_store": ["60,000", "120,000"],
  "events": {"2": ["400 million", "900 million"], "3": ["2 billion", "5 billion"]},
  "freshness": ["1 minute", "5 minutes", "15 minutes"]
}
```

**Business Scenario.** A retailer runs {{stores}} stores, each carrying about {{items_per_store}} items, and sells online for delivery and for pickup at a store. Online shoppers who choose a store see each item as "in stock", "limited stock" or "out of stock" there. A store's on-hand quantity for an item changes all day: register sales and returns, receipts from distribution centres, transfers between stores, damaged and expired units written off, units picked for online orders, and cycle counts in which store teams count a shelf or a backroom location and the count corrects the system's number. Together these come to about {{events}} inventory-affecting events a day. The perpetual on-hand should reflect a register sale within {{freshness}}.

**Problem Statement.** Design the store inventory system: ingestion from registers, handheld devices and receiving; the perpetual on-hand per store and item, and where it lives; how a cycle count corrects it while the store is open and selling; the availability state shown online and the rule behind it; the read path for product and search pages; and how inventory accuracy is measured per store and category. Say what is exact, what is approximate, and how fresh each number is.

**Constraints.** Registers and handheld devices buffer events while offline and upload them later, sometimes hours later; events can arrive out of order and twice. A count is a snapshot at one moment, and sales keep happening during and after it. Online availability reads must answer p99 under 50 ms at holiday peak. Showing "in stock" for an item that is not on the shelf leads to a failed pick and a disappointed pickup customer; hiding an item that is there loses a sale. Accuracy is reported per store, department and category in aggregate; no individual associate's counts are measured or ranked.

**Assumptions.** All volumes, timings and thresholds are hypothetical, and the three online states and their thresholds are this exercise's rule. Every event carries an event id, store, item, quantity change, reason, the device time and the time it was received. A count carries the store, item, location (sales floor, backroom, a second display), the counted quantity and the count time. Receipts arrive in cases and are converted to units using the item's pack size.

**Clarifications.**
- Q: Is a count always right? | A: It is the best evidence at its moment, but people miscount and scan the wrong item. Decide how far you trust one count.
- Q: Does a count cover every location of the item in the store? | A: Not always; some counts cover one location. Say how you combine them.
- Q: Do online orders hold stock before they are picked? | A: Orders awaiting picking are known by store and item; picking itself decrements on-hand. You may hold back units for orders not yet picked.
- Q: Does the online page show quantities? | A: No, only the three states. You propose the rule that maps a number to a state.
- Q: Can an item's pack size change? | A: Yes, occasionally, and the change can arrive after cases with the new size have been received.

**Hints.**
1. Keep on-hand as a projection of an append-only event log per store and item, so any balance can be rebuilt and every unit change traced to its event.
2. A count taken at time T sets the balance as of T, not as of now: on-hand = counted quantity + the sum of changes with event time after T. Changes timed before T that arrive late must not move it.
3. The state shown online can depend on more than on-hand: units held for unpicked orders, and how reliable that store's number for that item has been.

**Follow-ups.**
1. A count of 12 is recorded at 10:05. Sales scanned at 10:02, 10:07 and 10:09 arrive at 10:20. What is on-hand afterwards, and why?
2. How do you define and measure inventory accuracy per store and category, and what would make that metric misleading?
3. How do you choose the buffer that keeps an item from showing "in stock" when it is probably not on the shelf, and how would you know it is too cautious?
4. A store's network is down for two hours. What does the online page show for that store meanwhile, and what happens when its events arrive?
5. A bug applied one reason code with the wrong sign for a day in every store. How do you rebuild every affected balance without stopping the read path?

**Follow-up rules.**
- when: overwrite, replace on hand, set on hand → ask: A count overwrites on-hand at 10:05. Sales scanned at 10:02 arrive at 10:20. Does your design subtract them a second time?
- when: kafka, stream, partition, partitioned → ask: What do you key the stream by? One store uploads three hours of backlog at once; what happens to the freshness of every other store on that partition?
- when: cache, redis, cdn → ask: A popular item sells its last unit at 14:00. How long does your cached state keep saying "in stock", and how many pickup orders can be placed in that time?
- when: buffer, safety stock, threshold → ask: A fixed buffer of two units hides every item a small store stocks only one or two of. How would your buffer adapt to the item and the store?
- when: nightly, batch, daily job → ask: A sale must show within {{freshness}}. Which parts of your design can still run nightly, and which cannot?

**Production Reality Check.**
- One store's registers are offline for three hours on a busy Saturday, then upload 40,000 sales at once. Meanwhile online shoppers saw "in stock" for items that had sold out, and pickup orders for them failed at picking.
- A handheld app release records count times in UTC but labels them as store local time. In stores west of UTC each count is treated as taken hours later than it was, sales made in between are ignored, and on-hand reads high for every counted item.
- Inventory accuracy for one category drops across most of the {{stores}} stores overnight. The item's pack size changed from 12 to 6 units a case, and cases received since are being converted at the old size.
- A count with a mis-scanned barcode sets one item to 0 and a similar item to 48 in the same store; the first disappears from the online page for that store.

**Evaluation Criteria.** On-hand as a projection of an append-only, idempotent event log keyed by store and item; counts applied as a balance at the count time with later changes replayed on top, so late events neither double count nor vanish; event-time ordering per store and item with duplicate handling by event id; online state derived from on-hand, units held for unpicked orders and a buffer that adapts to measured reliability; a fast, regionally served read view refreshed within the freshness target, with exact checks at picking; accuracy defined precisely and reported in aggregate only; pack-size conversion versioned by effective date; sanity checks on counts (large swings, device time); rebuild by replay beside the live view; adapts to each incident with diagnosis, recovery and prevention.

## WMT-L4-02: Returns across channels — refunds, restock or disposal, and sales and inventory restated

| | |
|---|---|
| **Template ID** | WMT-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Cross-channel reconciliation / returns linked to original sales, dispositions, restatement and closed periods |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "returns_per_day": {"2": ["300,000", "800,000"], "3": ["2 million", "4 million"]},
  "stores": {"2": ["1,500", "3,000"], "3": ["4,600", "10,000"]},
  "window_days": [30, 90],
  "close_days": [3, 5, 8]
}
```

**Business Scenario.** A retailer with {{stores}} stores accepts about {{returns_per_day}} returns a day. An item bought in a store can be returned in any store; an online order, whether shipped from a distribution centre or picked in a store for pickup or delivery, can be returned in a store or by mail to a returns centre; some marketplace sellers' items can be returned in a store too. In this exercise an item may be returned within {{window_days}} days of purchase (this exercise's rule; check current docs). Each return produces a refund to the original payment method, and the returned unit gets a disposition: back on the shelf, back to the supplier, sold through a liquidation channel, donated, or destroyed. Finance closes each month {{close_days}} business days after it ends, and closed numbers do not change.

**Problem Statement.** Design the returns data system: capture at store service desks, registers and returns centres; linking each returned unit to its original order line and the price actually paid; the refund events; dispositions and the inventory changes they cause; and how sales are restated, including which store, channel and day carry a return. State the reporting rule precisely and explain how it treats returns that arrive after a month has closed.

**Constraints.** A return can be partial (two of five units), part of a bundle, or for an item bought with a discount that applied to the whole order. Refunds are integer cents and must equal what the customer actually paid for the returned units. A store that takes back an online order receives inventory it never received from a distribution centre. Customer data appear only in aggregate in analytics; refund amounts are reconciled with the payments system daily. Store results are reported per store and day in each store's local time.

**Assumptions.** All volumes, windows and timings are hypothetical, and the return window, disposition codes and restatement rule are this exercise's. Every return event carries a return id, the original order or receipt reference when there is one, the item, the quantity, where it was returned, the refund amount and tender, and a disposition that may be recorded hours or days later.

**Clarifications.**
- Q: Which store and channel does a return reduce: where it was bought, or where it was returned? | A: Finance and store operations disagree. Propose a rule and say what each audience sees.
- Q: Is a return always linked to an original sale? | A: Usually; returns without a receipt happen and get a looked-up or a current price under this exercise's rule.
- Q: Who funds a marketplace item's refund? | A: The seller, under the marketplace's terms; the retailer may refund first and recover it. Keep the two flows separate.
- Q: When is a disposition known? | A: Restock is often recorded at the desk; others are decided later at a returns centre, sometimes days later.
- Q: Can a refund be issued without the item being returned? | A: Yes, for some low-value items or damaged deliveries, under this exercise's rule. No inventory moves.

**Hints.**
1. Separate the facts: the refund (money), the unit (inventory and disposition) and the sales restatement (reporting). They happen at different times and are owned by different systems.
2. Allocate order-level discounts to lines when the sale happens, so a return can be valued from the line without recomputing the order.
3. A closed period never changes; a late return lands in the open period with a reference to the period it relates to.

**Follow-ups.**
1. An online order of five units with a 10% order discount is partly returned in a store: two units. What refund is issued, and which rows change in sales, inventory and refunds?
2. Which store's sales does an online return made in a store reduce, and what does the store manager's daily report show?
3. A disposition arrives four days after the refund. How do on-hand and the returns-centre backlog look in between?
4. How do you reconcile refunds in your data with what the payments system actually paid out, and what do you do with the difference?
5. Finance asks for return rates by category and channel that do not move after a month is closed. How do you provide them, and what do you say about returns still to come within the {{window_days}}-day window?

**Follow-up rules.**
- when: original store, original channel, attribute to the sale → ask: An online order is returned in a store. The store's own sales for the day fall. How do you keep the store's report fair while finance still sees net sales by channel?
- when: update, update in place, overwrite → ask: You update the original sale row when it is returned. What does last month's report show if someone re-runs it after the close?
- when: restock, back on the shelf → ask: A unit is marked "restock" at the desk but sits in the backroom for three days. What does the online page show for that store meanwhile?
- when: join, match, link → ask: About 3% of returns have no receipt reference. How do you value them, and how do they appear in return rates?
- when: cents, rounding, allocate, allocation → ask: An order discount of 100 cents is spread over three lines. How do you allocate it so the line refunds add back to exactly what was paid?

**Production Reality Check.**
- Online orders returned in stores are counted as negative in-store sales. Store comparable sales fall about 2% in a month with heavy online returns, while online net sales look overstated by the same amount.
- After a network blip, one store's service desk sends each of 900 return events twice. The payments system refunded each once, but the units are restocked twice and on-hand for those items reads high.
- A returns centre clears a backlog of 60,000 mail-in returns on the first day of a new month, after the previous month has closed. The new month's online net sales start negative in two categories, and a merchant asks why.
- A register release records refunds for no-receipt returns at the item's current price instead of the price under this exercise's rule; refunds no longer reconcile with the payments system by a few thousand dollars a day.

**Evaluation Criteria.** Separate, linked records for refund, unit and restatement with their own timestamps and owners; returns linked to the original order line with discounts allocated to lines at sale time and exact integer-cent refunds; a precise, stated restatement rule (for example, the return reduces the original channel in finance views and is shown separately as "returns accepted" in the receiving store's view) applied by the receiving store's local day; idempotent capture by return id; inventory moves only on dispositions, with "pending disposition" as a visible state; closed periods immutable, late returns booked in the open period with a reference; daily reconciliation with the payments system; customer data in aggregate only; adapts to each incident with diagnosis, recovery and prevention.

## WMT-L4-03: Pickup and delivery slot capacity — honest availability at peak

| | |
|---|---|
| **Template ID** | WMT-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Capacity booking / multi-dimensional capacity, contention at peak, holds, honest availability |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "stores": {"2": ["800", "2,000"], "3": ["4,000", "4,600"]},
  "slot_minutes": [30, 60, 120],
  "peak_bookings": {"2": ["1,500", "4,000"], "3": ["12,000", "30,000"]},
  "days_ahead": [3, 7],
  "hold_minutes": [5, 10, 15]
}
```

**Business Scenario.** Online grocery customers at {{stores}} stores choose a pickup or delivery slot at checkout: a {{slot_minutes}}-minute window, offered up to {{days_ahead}} days ahead. Each slot's capacity is limited in several ways at once: the picking hours the store has planned for that period (planned in aggregate, not per person), chilled and frozen staging space for totes, pickup parking bays, and delivery routes. In the week before a holiday, booking attempts peak at {{peak_bookings}} a minute, and the most popular slots fill within seconds of opening. A slot chosen at checkout is held for {{hold_minutes}} minutes while the customer finishes paying (this exercise's rule). Customers can change their order until a cut-off before the slot. Showing a slot as available that then fails at checkout frustrates customers; showing a slot as full when it is not loses orders.

**Problem Statement.** Design the slot capacity system: the capacity model and its units; how a store's capacity is set and changed during the day; the booking path (hold, confirm, release, change, cancel) and what makes it exact; the availability read path at peak; and the metrics that tell you whether availability is honest. Say what happens to already booked orders when a store's capacity drops.

**Constraints.** A slot may never be booked beyond its capacity plus the overbooking allowance the store sets (zero by default). The availability read path must handle several times the booking rate, p99 under 100 ms. Slots are in each store's local time, including on the days clocks change. Order size varies widely, and a large order uses more picking time and more totes than a small one. Store data are reported per store and slot in aggregate.

**Assumptions.** All volumes, windows and rules are hypothetical. Each store publishes its planned capacity per slot and resource; it can change it during the day, for example after bad weather or when fewer people are available than planned. Each order carries an estimated picking time and tote count by temperature zone, refined as the order changes.

**Clarifications.**
- Q: Is capacity a number of orders? | A: That is your choice. A count of orders is simple; picking minutes and totes are closer to the real limits. Say what you lose either way.
- Q: Does a hold use capacity? | A: Yes, for {{hold_minutes}} minutes; then it is released if checkout has not completed.
- Q: What if a customer adds many items after booking? | A: Changes are allowed until the cut-off; say whether the slot can refuse them or what else happens.
- Q: Can a delivery slot be served from another store? | A: In some areas two stores overlap; you may propose using that.
- Q: What happens when capacity drops below what is already booked? | A: Someone must decide which orders move; the system must make that decision visible and fast.

**Hints.**
1. Separate the exact booking path, which decrements capacity with a conditional write, from the availability view, which can be slightly stale but must say how stale.
2. Measure capacity in the resource that runs out first: picking minutes, totes per temperature zone, bays or route stops. An order consumes some of each.
3. Honest availability is measurable: of the slots shown as available, what share failed when the customer tried to book them?

**Follow-ups.**
1. Walk through one booking for a popular slot: which records change, in what order, and what makes two racing customers unable to take the last capacity?
2. The availability view is a few seconds stale at peak. How do you keep shown-available slots from failing at checkout too often?
3. A store reduces capacity for tomorrow's busiest slot by a third. Which booked orders move, who decides, and what do customers see?
4. A customer adds forty items an hour before the cut-off. What happens to the slot's capacity and to other customers?
5. How do you decide each store's capacity per slot next week, and how do you learn from slots that were overfull or idle?

**Follow-up rules.**
- when: lock, row lock, select for update, mutex → ask: Thousands of customers try the 18:00 Saturday slot in the same second. How long do they wait on that lock, and what do the others see?
- when: cache, redis, stale → ask: The cache says the slot has capacity, the booking path says it is full. What does the customer see, and how often does that happen at peak?
- when: queue, waiting room, throttle → ask: Who gets the next free capacity, the customer who joined first or the one whose retry happened to arrive? Does that matter here?
- when: utc, timezone, time zone, daylight saving → ask: On the night clocks go back, the 01:00 hour happens twice. Which slots exist that night, and what does a customer see?
- when: orders per slot, count of orders → ask: A holiday order is three times the usual size. What does your order count do to picking and staging in that slot?

**Production Reality Check.**
- In the week before a holiday the availability view is refreshed every 60 seconds. Thirty percent of booking attempts fail on slots shown as available; customers retry, and booking traffic triples.
- A storm closes a store's parking lot for an afternoon. The store cuts the 16:00 to 18:00 pickup capacity by half, and 140 orders are already booked into it.
- On the day clocks change, slots are generated in UTC and converted once at midnight; one store shows a slot that starts at a time that does not exist and no slot for an hour that does.
- Holiday orders average twice the usual tote count. Every {{slot_minutes}}-minute slot books to its order limit, and chilled staging overflows by mid-afternoon in most stores.

**Evaluation Criteria.** A capacity model in the limiting resources (picking minutes, totes per temperature zone, bays, route stops) with order estimates refined on change; an exact booking path using conditional decrements and idempotent hold, confirm and release by order id, with holds that expire by rule and count as free when past their deadline; hot-slot contention handled (sharded counters or a single writer per store-slot, plus a waiting room or fair queue at opening); an availability view with stated staleness, a near-full margin, and a re-check at booking; honest-availability metrics (failed-on-shown-available rate, fill time, idle capacity); capacity reductions handled by a visible, prioritised re-slotting with customer notice; local-time slot generation correct across daylight-saving changes; aggregate reporting only; adapts to each incident with diagnosis, recovery and prevention.

## WMT-L4-04: In-transit visibility for store replenishment — trailers, ETAs and receiving plans

| | |
|---|---|
| **Template ID** | WMT-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Streaming state / trip tracking, ETA updates with hysteresis, manifests, units in transit |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "dcs": {"2": [20, 45], "3": [120, 160]},
  "stores": {"2": ["900", "2,000"], "3": ["4,600", "10,000"]},
  "trips": {"2": ["6,000", "12,000"], "3": ["30,000", "45,000"]},
  "ping_minutes": [2, 5, 15]
}
```

**Business Scenario.** A retailer replenishes {{stores}} stores from {{dcs}} distribution centres, with about {{trips}} trailer trips a day. A trip can serve one store or several in sequence, and its manifest lists the pallets and cases for each stop. Trailers report their position every {{ping_minutes}} minutes through a common tracking feed, plus events for departure, arrival at a stop, door open and door close; refrigerated trailers also report temperature. Stores plan their receiving around expected arrivals: an unloading window, the stocking hours they plan in aggregate, chilled and frozen items first, and backroom space. Replenishment ordering counts units already in transit so a store is not sent the same need twice.

**Problem Statement.** Design the in-transit visibility system: ingestion of positions and trip events; the state of each trip and each stop; the ETA per stop and how it is updated; the units in transit per store and item from manifests; how store receiving plans are told about changes; how receipts at the store close out the manifest, including shortages and overages; and how ETA accuracy is measured per distribution centre and route type. Say which numbers other systems may depend on and how fresh each one is.

**Constraints.** Trailers lose signal in some areas; position reports arrive late, out of order and sometimes twice. A store's receiving plan should change only when an ETA change matters to it, not on every position report. Manifests are in cases; store inventory is in units. A trailer's temperature outside its allowed range for too long means its perishable items must be inspected at receipt (this exercise's rule). Store results are reported per store and day in aggregate.

**Assumptions.** All volumes, intervals and thresholds are hypothetical. Trailers are run by the retailer's own fleet and by outside carriers, and in this exercise all report through one feed in one format; nothing here describes any company's fleet, carriers or tracking provider. Every report carries a trailer id, a trip id when known, a position or event, a device time and the time it was received.

**Clarifications.**
- Q: Who computes the ETA? | A: You do, from positions, the remaining stops and typical travel and unloading times. Say what inputs you use.
- Q: How early does a store need to know about a delay? | A: About two hours before the planned window, to move its unloading hours; changes of under 30 minutes do not matter to it.
- Q: Can a pallet be unloaded at the wrong stop? | A: It happens. The receiving store scans what it gets, and the next store finds it missing.
- Q: When does a unit stop being "in transit"? | A: That is your rule to define; the replenishment calculation depends on it.
- Q: What if a trailer's feed stops? | A: Positions stop; the trailer keeps moving. Decide what you show and when you start to worry.

**Hints.**
1. Model the trip as a state machine per stop (planned, departed, approaching, arrived, unloading, closed), driven by event time, so late reports never move it backwards.
2. Separate the raw ETA, which can move with every report, from the ETA you publish to stores, which changes only past a threshold and with a reason.
3. Units leave "in transit" when the store scans them in, not when the trailer arrives; reconcile the manifest against the scans and record the differences.

**Follow-ups.**
1. A position report from 40 minutes ago arrives after the trailer's arrival event. What changes, and what does not?
2. How do you publish ETAs to stores so their plans do not change with every report, while a real two-hour delay still reaches them in time?
3. Pallets for the second stop are unloaded at the first. What do units in transit, the two stores' on-hand and the replenishment calculation show, and how is it corrected?
4. How do you measure ETA accuracy so that it is useful to stores, for example at a fixed time before arrival?
5. The tracking feed for a group of trailers stops for three hours. What do you show, and how does the system recover when the backlog arrives?

**Follow-up rules.**
- when: latest position, last ping, overwrite → ask: A report from 40 minutes ago arrives after newer ones. Does your trip state or ETA go backwards?
- when: notify, push, alert → ask: How many ETA notifications does a store get on a normal day under your rule, and which ones does it act on?
- when: kafka, stream, partition → ask: What do you key by: trailer, trip or store? A multi-stop trip affects several stores; how does each store's plan see it?
- when: geofence, arrival → ask: A trailer waits in the store's lot for an hour before its door opens. Has it arrived, and what does your ETA accuracy metric say?
- when: in transit, units in transit → ask: Units are on a trailer that is three hours late. Does replenishment order them again for that store? Why or why not?

**Production Reality Check.**
- The tracking feed for one region's trailers stops updating for three hours. Their ETAs stay at "on time"; stores keep unloading hours ready for trailers that are delayed, and other stores are not warned of late arrivals.
- On a multi-stop trip, pallets for the second store are unloaded at the first. The first store shows an overage, the second a shortage, and the second store's units in transit vanish while nothing arrives.
- On routes with heavy traffic, the published ETA swings between "on time" and "40 minutes late" with almost every report, and some stores' receiving plans are changed six times in an afternoon.
- A refrigerated trailer reports temperatures above its range for 50 minutes; the reports arrive after the trailer has been unloaded and its chilled items are already on the shelf.

**Evaluation Criteria.** An event-time trip and stop state machine that late or duplicate reports cannot regress; ETAs computed from positions and remaining stops, published with hysteresis and a materiality threshold tied to the store's planning lead time; feed health monitored per source with a "position unknown since" state and conservative ETAs when stale; units in transit from manifests (converted to units) cleared by store receipt scans, with manifest reconciliation recording shortages and overages and correcting both stores; replenishment counting in-transit units with a rule for late and lost shipments; temperature excursions evaluated by event time and routed to receipt inspection even when late; an ETA accuracy metric at a fixed horizon; aggregate store reporting; adapts to each incident with diagnosis, recovery and prevention.

## WMT-L4-05: Price and promotion analytics — rollbacks, clearance, price matches and lift against holdout stores

| | |
|---|---|
| **Template ID** | WMT-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Experimentation analytics / effective price history, holdout stores, lift with confounders |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "stores": {"2": ["1,000", "2,500"], "3": ["4,600", "10,000"]},
  "price_changes": {"2": ["200,000", "500,000"], "3": ["2 million", "5 million"]},
  "holdout_share": ["2%", "5%", "10%"],
  "weeks": [2, 4, 8]
}
```

**Business Scenario.** A retailer sets prices for {{stores}} stores and its website, nationally and by price zone, with about {{price_changes}} store-item price changes a week. In this exercise there are three kinds of reduction: a rollback, a temporary lower price that runs for {{weeks}} weeks; clearance, a permanent markdown to sell through an item being discontinued; and a price match, in which a store matches a qualifying competitor's advertised price at the register when a customer asks (all three are this exercise's rules; check current docs). Merchants want to know what each rollback achieved: incremental units, sales and margin. To measure it fairly, {{holdout_share}} of stores are held out of selected rollbacks by design and keep the regular price.

**Problem Statement.** Design the price and promotion analytics system: the effective price history per store, item and channel, both as planned and as actually charged at the register; promotions as data; how holdout stores are chosen and recorded; how lift is computed per rollback, with its uncertainty; how out-of-stock days, overlapping promotions, cannibalisation of similar items and seasonality are handled; and how results reach merchants, and how fresh they are.

**Constraints.** Price changes take effect at a store-local time and are sometimes applied late or not at all at a store; the register's charged price is the evidence. Holdout assignment must be decided before the rollback starts and recorded. Lift is reported only per item and region with enough stores to be meaningful; store data appear only in aggregate. Results for a rollback are expected within two days of its end, and must be reproducible later.

**Assumptions.** All volumes, shares and durations are hypothetical; the rollback, clearance, price-match and holdout rules are this exercise's. Register line items carry the store, item, quantity, the shelf price, the price charged and a reason code for any override. Daily store-item on-hand snapshots are available.

**Clarifications.**
- Q: Who chooses the holdout stores? | A: You propose the method; merchants must agree before launch, and stores must not be told which they are.
- Q: Is the online price part of the test? | A: Online prices may follow the rollback nationally. Say how that affects a store-level comparison.
- Q: Are price matches promotions? | A: No; they are register overrides. They must not be counted as rollbacks, but they change the price charged.
- Q: What period is the baseline? | A: Your choice; say how you handle seasonality and the weeks just before a holiday.
- Q: Do merchants want margin? | A: Yes: lift in units and sales, and the margin given up on units that would have sold anyway.

**Hints.**
1. Keep two price histories per store, item and channel: planned (from price files) and charged (from the registers). Most surprises live in the gap between them.
2. Compare test and holdout stores before and after the rollback starts (a difference in differences), using stores matched or stratified by size, region and past sales.
3. A store-day when the item was out of stock says nothing about demand; exclude it or model it, in both groups.

**Follow-ups.**
1. Define lift for one rollback precisely: which stores, which days, which baseline, and which items count.
2. How do you choose holdout stores so the comparison is fair, and how do you check after launch that they really kept the regular price?
3. The rollback item gains 40% but a similar item from another brand loses 25%. What do you report to the merchant?
4. Two promotions overlap on the same item in some stores. How do you attribute the lift, or decide not to?
5. A merchant wants every rollback's lift live, daily, for every store. What do you offer instead, and why?

**Follow-up rules.**
- when: random, randomise, randomize, random assignment → ask: Random assignment over {{holdout_share}} of stores puts three of the region's largest stores in holdout. Is the comparison still fair, and what would you change?
- when: average, before and after, pre and post → ask: Sales rise during the rollback in every store, holdout ones included, because it is the week before a holiday. What does your before-and-after number claim?
- when: price file, planned price → ask: The price file says the rollback started on Monday; registers in 6% of stores charged the old price until Wednesday. Which price does your history use?
- when: significance, confidence, p-value, interval → ask: How many holdout stores does a rollback need for the interval to be useful, and what do you report when it has fewer?
- when: margin, profit → ask: How do you estimate the margin given up on units that would have sold at the regular price anyway?

**Production Reality Check.**
- A price file applies one rollback by price zone instead of by store list, so 15% of the holdout stores receive the rollback too. Its measured lift is about half of what similar rollbacks showed.
- Price changes that take effect at store-local midnight are stored at midnight UTC. In western stores, the last evening before each rollback is attributed to the rollback price, and the rollback's own last evening to the regular price.
- A register release records price-match overrides with the rollback reason code. Rollback counts and lift in one region jump, though no new rollbacks started there.
- A {{weeks}}-week rollback item runs out of stock in most test stores by its second week. The lift report shows the rollback lost sales in its second half.

**Evaluation Criteria.** Planned and charged price histories per store, item and channel, versioned with store-local effective times; promotions, clearance and price matches kept distinct by reason; holdout stores chosen by a stated, stratified or matched method before launch, recorded, and verified from register prices; lift as a difference in differences with out-of-stock store-days excluded in both groups, seasonality handled through the comparison, cannibalisation and overlap reported rather than hidden, and uncertainty shown; minimum group sizes and aggregate-only reporting; reproducible results from snapshotted inputs; adapts to each incident with diagnosis, recovery and prevention.
