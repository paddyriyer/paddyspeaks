# Walmart Global Tech · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of omnichannel
retail: stores and e-commerce, online grocery pickup and delivery, fulfilment from
stores and distribution centres, marketplace sellers, and pricing and rollbacks.
Every workload, number, schema and incident is hypothetical; pricing, rollback,
clearance, substitution and featured-offer rules are this exercise's rules (check
current docs), and nothing here describes how the company's own systems work.
Store, associate and customer data appear only in aggregate. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## WMT-L3-01: Items and prices across channels — store, online and marketplace offers, rollbacks, clearance and the price shown on a date

| | |
|---|---|
| **Template ID** | WMT-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated prices, precedence of price types, zones and store exceptions, bitemporal corrections |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "stores": ["2,800", "4,600"],
  "price_zones": [40, 150, 600],
  "online_items": {"1": ["20 million"], "2": ["80 million", "150 million"], "3": ["400 million"]},
  "weekly_changes": ["3 million", "12 million"]
}
```

**Business Scenario.** A retailer sells in {{stores}} stores and online. Its online catalogue holds about {{online_items}} items, most of them offered by marketplace sellers rather than by the retailer itself. In this exercise store prices are set per price zone ({{price_zones}} zones), with exceptions for individual stores; the retailer's own online price can differ from any store's; and each marketplace seller sets its own price for its own offer. A price can be regular, a rollback (a temporary lower price with a start and an end), clearance (a permanent markdown on an item being sold through), or online-only. There are about {{weekly_changes}} price changes a week. Merchants, the website and customer care all ask the same question in different words: what price did item X carry at store S, or online, on date D, and which rule produced it?

**Problem Statement.** Design the data model for items, offers and prices across the three channels. Cover the item and its variants; an offer per channel (a store item, the retailer's online offer, each seller's marketplace offer); prices as effective-dated records with a type; zones, zone membership over time and store exceptions; the precedence that resolves several applicable prices into one price of record; and a derived table that answers "the price on a date" quickly. Show how a price recorded late, or recorded wrongly and corrected, is kept, so that you can answer both "what was true on D" and "what did we believe on D".

**Constraints.** Money is stored in integer cents. In this exercise's rule the precedence is clearance, then rollback, then regular, with a store exception beating its zone's price of the same type; an item on clearance in a store is never put on rollback there. Store prices take effect at the start of the store's local day; the online price takes effect at a stated instant. A store's zone can change, and history must keep the zone the store was in at the time. Nothing is ever overwritten: a correction is a new record. Marketplace prices belong to their sellers and are kept apart from the retailer's own prices.

**Assumptions.** Store counts, zone counts, catalogue size and change volume are hypothetical. Price-matching at the register, coupons and loyalty discounts are out of scope. Tax is out of scope.

**Clarifications.**
- Q: Is the price shown on the shelf the same as the price charged at the register? | A: They should be equal; in this exercise the register applies the price of record. If they disagree, the register's charged price is the evidence for what the customer paid.
- Q: Does a rollback carry a "was" price? | A: Yes. In this exercise the shelf and the page show the regular price the rollback replaces, so the model must be able to produce it for that date.
- Q: Can two rollbacks for one item overlap in one zone? | A: Not by rule, but the input sometimes contains them. Say what your model does with an overlap.
- Q: Does the online price follow a store? | A: No. The retailer's online price is national here, but pickup orders are charged the price of the pickup store in this exercise.
- Q: How far back must "the price on a date" go? | A: Three years for merchants and customer care.

**Hints.**
1. Separate what was decided (price records with a type, scope, valid-from and valid-to) from what was resolved (the price of record per offer and day).
2. Two time axes: when a price is in force, and when the system learned of it. A late record and a correction differ only in the second.
3. A zone is a group of stores whose membership changes; keep membership as its own effective-dated table.

**Follow-ups.**
1. Write the resolution rule as a query or pseudocode: for one store, one item and one date, which records apply and which wins?
2. A rollback in one zone starts on Friday. On Wednesday the merchant shortens it by two days. What rows exist afterwards, and what does "what did we believe on Thursday" return?
3. Thirty stores move from one zone to another on the first of the month. Which rows change, and what does last month's price history for those stores show?
4. With {{weekly_changes}} changes a week across {{price_zones}} zones, would you materialise the resolved price per store, item and day, or per zone with store exceptions? Estimate the row counts and say how you keep it current.
5. A marketplace seller and the retailer both offer the same item online. Customer care asks what the customer saw. Which tables answer it, and what do you need to have logged at the time?

**Follow-up rules.**
- when: update the price, overwrite, current price column → ask: A rollback was entered with the wrong end date and fixed the next day. With the price overwritten, how do you answer what the shelf showed in between, and what the store believed at the time?
- when: scd2, type 2, valid_from, valid_to, effective_from → ask: Your valid-from tells you when a price was in force. How do you tell a price that was always in force from one entered late and back-dated?
- when: one price table, single price, price per item → ask: A store exception, a zone rollback and the online price all apply to one item today. Which rows does your table hold, and which one does a pickup order use?
- when: utc, time zone, midnight → ask: A rollback starts at the start of Friday in each store's local day. Stores span several time zones. What do you store, and what does a national report at 23:30 UTC show?
- when: materialise, materialize, precompute, daily snapshot → ask: How many rows is that per day at {{stores}} stores, and which events force a recompute of the past?

**Production Reality Check.**
- After a re-zoning of {{price_zones}} zones, a merchant's report of last quarter's rollback prices changed: the store-to-zone mapping had been stored on the store row and overwritten.
- A batch of rollback end dates was loaded in UTC instead of store-local time. In the westernmost stores the rollback ended at the register several hours early on its last day, and the shelf labels still showed the rollback price.
- A clearance price and a rollback were both active for the same item in 400 stores because two teams entered them on the same day. The page showed the rollback with a "was" price lower than the clearance price.

**Evaluation Criteria.** Items, offers per channel and prices as typed, effective-dated records, never overwritten; zone membership effective-dated; a stated precedence with store exceptions and clearance over rollback; the "was" price derivable; a second time axis for corrections and late records; a resolved price-of-record table with a sound refresh strategy; store-local effective times; marketplace prices kept per seller; the incidents explained by the model and fixed without rewriting history.

## WMT-L3-02: Store fulfilment as data — orders picked in stores, totes, staging, handoffs and substitutions per line

| | |
|---|---|
| **Template ID** | WMT-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / order lines to picks, totes and staging, substitution as its own record, handoff outcomes, aggregate-only operations metrics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "orders_per_day": {"1": ["400,000"], "2": ["1.5 million"], "3": ["4 million", "6 million"]},
  "lines_per_order": [30, 45, 60],
  "stores": ["2,500", "4,000"],
  "staging_limit_minutes": [60, 90, 120]
}
```

**Business Scenario.** Online grocery orders are picked in {{stores}} stores and handed to customers at a pickup bay or to a delivery driver. There are about {{orders_per_day}} orders a day with about {{lines_per_order}} lines each. Store teams pick several orders in one walk, into totes kept apart by temperature zone (ambient, chilled, frozen). When a tote is full or the walk ends, it goes to a staging location: a shelf, a cooler or a freezer. At handoff the order's totes are brought out, the customer is shown any substitutions, and they can accept or reject each one. In this exercise chilled and frozen totes may stay in staging for at most {{staging_limit_minutes}} minutes (this exercise's rule). Customers set a substitution preference per line (allow any, allow only a choice they named, or none) before the order is picked.

**Problem Statement.** Design the data model for store fulfilment, from order lines to what the customer took home. Cover order lines and their requested quantities; pick walks and the picks within them (found, short, or substituted); totes and the lines in them; staging locations and each tote's moves between them; the handoff and the customer's decision on each substitution; weighted items; and the per-line outcome that analytics read. Show the facts and grains that answer, per store and day: fill rate (requested units delivered as ordered), substitution rate and acceptance rate, items short with no substitute offered, and time in staging per temperature zone.

**Constraints.** One line can end up in several states at once: of 6 units, 4 picked as ordered, 1 substituted and 1 short. A substitute is a different item at its own price, linked to the line it replaces; in this exercise the customer pays no more than the price of the item ordered (this exercise's rule). Weighted items (produce, deli) are ordered as an estimate and picked as an actual weight. All operational metrics are reported per store, department and day in aggregate; no individual associate is measured or ranked, and analytics do not carry associate identifiers. Times are reported in the store's local time.

**Assumptions.** Volumes, lines per order, store counts and the staging limit are hypothetical. Payment and refunds are out of scope except for the amount charged per line. Delivery after handoff to the driver is out of scope.

**Clarifications.**
- Q: Can one tote hold lines from more than one order? | A: During a walk a cart holds several orders' totes, but each tote belongs to exactly one order.
- Q: Can a line be split across totes? | A: Yes: a large quantity, or a line moved to a new tote when the first one filled.
- Q: What if the customer rejects a substitute at handoff? | A: The substitute goes back to the store, the customer is not charged for it, and for the line the units count as short.
- Q: Can a tote change staging location? | A: Yes, for example from a cooler to a pickup bay's cooler when the customer arrives early. Every move has a time.
- Q: Is the picker recorded? | A: The operational system needs to know which walk a pick belonged to; analytics never carry who did it.

**Hints.**
1. Keep requested quantity on the line and record every outcome (picked, substituted, short, rejected) as its own row with a quantity, so the line reconciles.
2. A substitution links two items: the one ordered and the one picked. Model it as a row of its own, not as a changed item id on the line.
3. Time in staging is a sequence of tote moves; derive intervals from them instead of storing a "staged at" column that is overwritten.

**Follow-ups.**
1. Write the invariant that ties a line's requested units to its outcome rows. What happens to a line whose outcomes do not add up?
2. A customer ordered 2 kg of apples; 2.3 kg was picked. What is stored, what is charged in this exercise, and how does fill rate treat it?
3. Define acceptance rate precisely. Is the denominator substitutes offered, substitutes handed out, or lines with a substitute? What happens when the customer never arrives?
4. A tote of frozen items was moved twice and handed over at {{staging_limit_minutes}} minutes plus 10. Which rows show it, and how do you report breaches per store and day?
5. At {{orders_per_day}} orders a day, which tables are facts, at what grain, and which one would you keep as an accumulating snapshot per line?

**Follow-up rules.**
- when: status column, line status, update the line → ask: A line of 6 units has 4 picked, 1 substituted and 1 short, and the substitute is then rejected. What does a single status say, and how do you rebuild the line's state at 14:00?
- when: replace the item, item_id on the line, overwrite the item → ask: If the substitute's item id replaces the ordered one, how do you report "items short with no substitute offered" and the price cap for the substitute?
- when: picker, associate, employee id, user id → ask: Analytics never carry who picked. Which grain do your operational metrics use, and how do you keep identifiers out of the warehouse?
- when: staged_at, staging time → ask: The tote moved from a cooler to a pickup bay cooler. Which interval counts towards the {{staging_limit_minutes}}-minute limit, and how is it computed?
- when: weight, weighted, kg → ask: The ordered quantity is an estimate. Which number do fill rate and the charge use, and what if the picked weight is far above the estimate?

**Production Reality Check.**
- After a handheld app release, rejected substitutes were recorded as accepted for several hours in 300 stores. Acceptance rate for those days is wrong, and customers were charged for items they did not take.
- Frozen totes in one region show staging times far above {{staging_limit_minutes}} minutes; a cooler-to-bay move was logged with the store's local time while other moves were in UTC.
- At {{orders_per_day}} orders a day, the nightly job that rebuilds the per-line outcome table from all events takes longer every week and missed the morning report twice.

**Evaluation Criteria.** Requested quantity on the line and outcome rows that reconcile to it; substitution as its own row linking ordered and picked items, with the customer's decision at handoff; totes owned by one order, lines split across totes; staging as timed moves with intervals derived; weighted items with estimated and actual quantities; precise metric definitions and denominators; aggregates per store and day with no associate identifiers in analytics; incremental builds; incidents handled by correction rows and recomputation of the affected days.

## WMT-L3-03: Distribution-centre flows as data — receipts, cross-docking, allocations to stores, outbound trailers and units in transit on a date

| | |
|---|---|
| **Template ID** | WMT-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / unit conservation across DC stages, cross-dock versus storage, case packs, as-of in-transit queries |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "dcs": [20, 45, 120],
  "stores": ["1,800", "4,600"],
  "cases_per_day": ["1.5 million", "5 million", "12 million"],
  "crossdock_share": ["25%", "50%", "70%"]
}
```

**Business Scenario.** A retailer replenishes {{stores}} stores from {{dcs}} distribution centres that together handle about {{cases_per_day}} cases a day. Inbound loads arrive against purchase orders; each pallet and case carries a scannable label. About {{crossdock_share}} of the cases are cross-docked: already allocated to stores when they arrive, they move straight from receiving to an outbound lane without being stored. The rest are put away into storage and later allocated to stores as replenishment orders come in, picked, and loaded. Outbound trailers carry cases for one or more stores, and each store scans what it receives. Planning, finance and the stores need one consistent answer to "where are the units of item X on date D": received but not allocated, allocated but not shipped, in transit to which store, or received by the store.

**Problem Statement.** Design the data model for flows through the distribution centres. Cover purchase orders and their lines; receipts at pallet and case level; the cross-dock and storage paths; allocations of quantities to stores (made before arrival for cross-dock, after putaway otherwise); picks and loads onto outbound trailers; departures; store receipts with shortages and overages; and case packs and units. Show how "units in transit to each store on date D" and "units at each distribution centre by state on date D" are computed, and how you prove that units are conserved from receipt to store.

**Constraints.** Purchase orders and allocations are in cases, store inventory in units, and an item's case pack can change over time (a supplier moves from 12 to 8 per case); every quantity must be convertible as of the time it was recorded. Every flow is an append-only event with an event time and a recorded time; scans arrive late and sometimes twice. In this exercise conservation holds per distribution centre and item: received = in storage + allocated not shipped + shipped + written off. Store data are reported per store in aggregate. No supplier, carrier or vendor is identified in analytics beyond an id.

**Assumptions.** DC counts, store counts, volumes and the cross-dock share are hypothetical. Returns to suppliers and transfers between distribution centres are out of scope unless you choose to add them.

**Clarifications.**
- Q: Can a cross-docked case end up in storage? | A: Yes, when its trailer is full or the store's allocation is cancelled; it is then put away and re-allocated later.
- Q: Is a store receipt per case or per unit? | A: Per case scan; a store can report a case short (not on the trailer) or a damaged case. Overages happen when a case for another store is unloaded by mistake.
- Q: What does "in transit on date D" mean? | A: Shipped from a distribution centre at or before the end of D, not yet received by the store at that moment. You choose the time zone and say why.
- Q: Are allocations ever changed? | A: Yes, before picking. A changed allocation is a new allocation event, not an edit.
- Q: Does the same label appear twice? | A: A case label is unique per case, but scanners resend scans after losing connectivity.

**Hints.**
1. Treat the case label as the unit of identity; every stage is an event on a case (received, put away, allocated, picked, loaded, departed, received at store).
2. A state on date D is the latest event per case at or before D; counts by state come from that, never from a mutable "current location" column alone.
3. Convert cases to units with the case pack in force when the case was received, not today's.

**Follow-ups.**
1. Write the query that returns units in transit per store and item at the end of D. Which event table and which "latest event" rule does it use?
2. A case pack changed from 12 to 8 last month. Cases received before the change are still in storage. How many units does the distribution centre hold, and what does the store's receipt show?
3. A trailer arrives at a store with two cases missing and one case for another store. Which rows are written, and how does conservation still hold for each store and distribution centre?
4. At {{cases_per_day}} cases a day, would you keep a daily snapshot of each case's state, or compute states from events on demand? What does each cost?
5. Scans arrive up to two days late. When is "in transit on D" final, and what do you show planners before then?

**Follow-up rules.**
- when: current location, location column, update the case → ask: Planning asks how many units were in transit to a store last Tuesday at midnight. With a single current location column, how do you answer?
- when: cases, case count → ask: The store's inventory is in units and a case pack changed last month. Which case pack converts a case received before the change, and where is that stored?
- when: dedup, dedupe, duplicate scans, duplicate → ask: A scanner resends a "loaded" scan two hours later. What key makes it a duplicate rather than a second load, and what if the case really was loaded twice after being unloaded?
- when: cross-dock, cross dock, crossdock → ask: A cross-docked case misses its trailer and is put away. How do its allocation and its state change, and how is that visible in the cross-dock share you report?
- when: snapshot, daily snapshot → ask: How many case-state rows is that per day at {{cases_per_day}} cases, and how do late scans correct a snapshot already taken?

**Production Reality Check.**
- Units in transit to stores jumped 30% overnight at one distribution centre: its scanners resent a day of "loaded" scans after a network outage, and the count summed loads instead of taking the latest state per case.
- After a case pack change, a store's receipts in units disagreed with the distribution centre's shipments by a third for that item; the conversion used the current case pack for cases shipped before the change.
- With {{crossdock_share}} of cases cross-docked, a week of cancelled store allocations left thousands of cases with no allocation and no storage location; they appear in no state, and conservation fails for those items.

**Evaluation Criteria.** Cases as the unit of identity with append-only events and event and recorded times; cross-dock and storage paths in one model; allocations as events in cases with conversion to units by the case pack in force at the time; state on a date from the latest event per case; conservation per distribution centre and item, checked; shortages and overages at store receipt; duplicates handled by event identity; a sound choice between snapshots and on-demand computation; each incident explained and corrected.

## WMT-L3-04: Marketplace offers as data — many sellers per item, the featured offer chosen by a given rule, and its history

| | |
|---|---|
| **Template ID** | WMT-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / offer versions, eligibility inputs, featured-offer intervals, explainable selections, what the customer saw at order time |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "items": {"1": ["30 million"], "2": ["120 million"], "3": ["300 million", "500 million"]},
  "sellers": ["40,000", "150,000"],
  "offer_updates": ["150 million", "600 million"],
  "featured_rule": ["the lowest total price (item price plus shipping) among eligible offers, ties going to the earliest delivery promise", "the highest value of a score you are given per offer, recomputed whenever price, stock or delivery promise changes"]
}
```

**Business Scenario.** An online catalogue holds about {{items}} items, and many are sold by several marketplace sellers as well as by the retailer itself. There are about {{sellers}} active sellers, and offers change about {{offer_updates}} times a day: price, shipping price, quantity available, delivery promise, condition. Only one offer per item is featured on the item page, and in this exercise it is chosen by {{featured_rule}} (this exercise's rule; check current docs). An offer is eligible only if it is in stock, new (not refurbished) and its seller meets published performance minimums such as on-time delivery and valid tracking rates (this exercise's eligibility rule). Sellers ask why they lost the featured offer; category managers ask how often the retailer's own offer is featured; customer care asks what a customer saw when they ordered.

**Problem Statement.** Design the data model for marketplace offers and the featured offer. Cover the item and its variants; sellers and their performance standing over time; offers and every version of an offer; eligibility as computed at a moment, with the reasons; the featured-offer decision as intervals per item, with the inputs that produced it; and the link from an order line to the offer and featured state at order time. Show the queries for: the share of time and of orders each seller's offer was featured per item and week, and "why was seller S not featured on item X at time T".

**Constraints.** Offer versions are append-only with event time and recorded time; a seller can send updates out of order. A selection must be reproducible: from the stored inputs you can recompute exactly the offer the rule chose. A seller sees only their own offers' data and aggregate competition facts the rule exposes (for example, the featured price), never another seller's details. Money is stored in integer cents.

**Assumptions.** Catalogue size, seller counts, update volume and the rule are hypothetical. Search ranking and advertising are out of scope. The retailer's own offer is modelled as an offer from one more seller.

**Clarifications.**
- Q: Is the featured offer stored or computed on read? | A: Your choice; the history must exist either way.
- Q: Does a seller's performance standing change often? | A: In this exercise it is recomputed daily over a trailing window, so eligibility can change at a day boundary with no change to the offer itself.
- Q: What if no offer is eligible? | A: The item page shows no featured offer in this exercise; that is a state to record, not a gap.
- Q: Can two offers tie? | A: Yes. The rule's tie-break decides, and if it still ties, the earlier offer wins; say how you would record that.
- Q: Does an order record the offer it bought? | A: It records the offer id; whether it also records the offer version is your decision.

**Hints.**
1. Store offer versions, not offers with mutable columns; the featured decision then refers to the versions it compared.
2. Featured history is a set of intervals per item: (item, offer, valid_from, valid_to, reason). Intervals make "share of time" a sum of durations.
3. Eligibility has its own inputs (stock, condition, seller standing); record the failing reason per offer at each decision.

**Follow-ups.**
1. Write the query for each seller's share of featured time per item and week, including intervals that cross a week boundary.
2. A seller's update arrives 10 minutes late: its price dropped at 12:00 but the system learned at 12:10. Who was featured between 12:00 and 12:10 in your history, and in what the customer saw?
3. Seller standing is recomputed at midnight and three sellers become ineligible. How many decisions are recomputed, and how do you avoid re-evaluating every item?
4. A seller disputes that they lost the featured offer unfairly last Tuesday at 15:00. Produce the evidence from your tables, showing only what that seller is allowed to see.
5. At {{offer_updates}} updates a day, how do you store offer versions and featured intervals so that both the history queries and the item page stay fast?

**Follow-up rules.**
- when: update the offer, overwrite, current price → ask: A seller asks why they lost the featured offer at 15:00 last Tuesday. With offers overwritten, what can you show them?
- when: winner column, featured flag, is_featured → ask: A flag on the offer row says who is featured now. How do you compute each seller's share of featured time last week, and how do you avoid two offers flagged at once?
- when: event time, recorded time, late → ask: Which time does the featured history use, and which does "what the customer saw" use? Can they disagree, and which is right for which question?
- when: score → ask: The score you are given is recomputed by another team. Which score value and version does your decision row keep, so the selection can be reproduced later?
- when: per seller, seller dashboard, seller sees → ask: A seller's view of a lost decision must not reveal a competitor's details. Which columns do they see, and how is that enforced?

**Production Reality Check.**
- With {{offer_updates}} updates a day, a backlog delayed price updates by 40 minutes during a holiday sale. Featured history built from recorded time shows sellers losing the featured offer for prices they had already lowered.
- A daily standing recomputation marked 2,000 sellers ineligible because a tracking-rate input was missing for one day. Their offers lost the featured position on thousands of items until the next run.
- Featured-time shares for one category add up to 107% per item and week: intervals were closed with the next decision's recorded time, while new ones started at event time, so they overlap.

**Evaluation Criteria.** Items, sellers, seller standing over time, and append-only offer versions with event and recorded times; eligibility computed with reasons; featured-offer decisions as non-overlapping intervals per item referring to the offer versions and inputs that produced them, including "none eligible"; reproducible selections under the stated rule; order lines linked to the offer version and featured state at order time; seller-scoped views; share-of-time queries that split intervals at week boundaries; incidents explained and repaired by recomputing intervals from stored inputs.

## WMT-L3-05: Rollback lift — units per store-day against the four weeks before, out-of-stock days left out

| | |
|---|---|
| **Template ID** | WMT-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / store-day calendars, missing zero rows, exclusions on both sides, date windows, NULL-safe ratios |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | WMT-L3-05.mjs |

**Business Scenario.** A retailer runs rollbacks: a temporary lower price on one item in every store of one region, from `start_date` to `end_date` (this exercise's rule; check current docs for how a real programme works). {{region_rule}} Merchandising wants a first readout of each rollback: did the item sell more per store and day during the rollback than in the four weeks before it? A store-day when the item was out of stock says nothing about demand, so in this exercise it is left out on both sides. The sample covers {{first_day}} to {{last_day}}.

**Problem Statement.** Write one PostgreSQL query that returns, for every rollback, `rollback_id, item_id, rollback_store_days, rollback_units_per_store_day, baseline_store_days, baseline_units_per_store_day, lift_pct`, ordered by `rollback_id`.
- A rollback's store-days are the pairs (store, date) where the store is in the rollback's region and the date is in a window. The rollback window is `start_date` through `end_date`; the baseline window is the 28 days before it, `start_date − 28` through `start_date − 1`. Both are inclusive dates.
- A store-day counts only on or after the store's `opened_on`. It is left out when the item has a row in `out_of_stock_days` for that store and date, and so are its units, even if some sold before the shelf emptied. {{overlap_rule}}
- {{rows_rule}}
- `*_store_days` is the number of counted store-days. `*_units_per_store_day` is the units sold on the counted store-days divided by that number, rounded to 2 decimals; the baseline's is NULL when it has no counted store-days.
- `lift_pct` is 100 × (rollback rate ÷ baseline rate − 1), computed from the unrounded rates and rounded to 1 decimal; NULL when the baseline rate is 0 or NULL.

**Constraints.** One SQL statement (CTEs allowed). Dates are calendar dates in each store's local time and are stored as `DATE`; no time zone conversion is needed. Use `ROUND(numeric, n)`. The sample has {{rollback_count}} rollbacks and {{sales_rows}} sales rows; production has thousands of stores and hundreds of thousands of items, with a rollback readout due every morning.

**Assumptions.** Hypothetical schema, regions, stores, items, prices and units. A rollback's price is shown for context and plays no part in the calculation. This readout is a simple before-and-after comparison, not a causal estimate; holdout stores and seasonality are discussed in the follow-ups.

**Clarifications.**
- Q: Is `end_date` part of the rollback? | A: Yes. Both windows are inclusive at both ends.
- Q: What if an item sold some units and then ran out the same day? | A: The day has a row in `out_of_stock_days`, so the whole store-day is left out, units included.
- Q: Should stores outside the rollback's region count in its baseline? | A: No. Both windows use only the stores in the rollback's region.
- Q: The baseline sold nothing at all. What is the lift? | A: NULL. The baseline rate is 0.00 and a ratio to zero means nothing.
- Q: Do I round the rates before computing lift? | A: No. Compute lift from the unrounded rates and round each output once.

**Hints.**
1. Build the store-days first: each rollback's two windows, joined to the stores in its region, expanded to one row per date (`generate_series` over the day offsets, or a calendar table).
2. Remove the store-days that do not count (before opening, out of stock, and any other exclusion the statement names) with `NOT EXISTS`, then LEFT JOIN the sales and sum with `COALESCE(units, 0)`.
3. Aggregate per rollback and window, then put the two windows side by side. `units::numeric / store_days` avoids integer division.

**Follow-ups.**
1. Some rollbacks run in regions where the item sold strongly before for seasonal reasons. How would you compare against holdout stores instead of the item's own past, and what must be decided before the rollback starts?
2. A rollback lifted the item by 60%, but sales of a similar item in the same stores fell. How would you extend the query to show that?
3. Out-of-stock days are flagged per whole day here. With an hourly on-shelf signal, how would the denominator change, and is it worth it?
4. This query recomputes every rollback from raw daily sales each morning. At production scale, what would you materialise, at what grain, and what forces a recompute?

**Follow-up rules.**
- when: avg(units), avg(, average of units → ask: Which rows does your AVG run over? A store-day with no sales row is not in the sales table at all; does it count as a zero in your average?
- when: inner join, join store_item_sales → ask: Which store-days disappear when you start from the sales table, and which way does that bias both rates?
- when: between start_date - 28 and start_date, start_date - 28 → ask: Show your baseline window's last day. Is the rollback's first day inside it?
- when: generate_series, calendar → ask: How many rows does your calendar produce for one rollback in production, with a thousand stores in a region, and how would you avoid building it per rollback?
- when: not in → ask: What happens to NOT IN if the subquery ever returns a NULL, and would NOT EXISTS be safer here?

**Production Reality Check.**
- A merchant shows a rollback with lift above 400% in one region. A data feed had stopped writing zero-sale days for weeks, and a version of this report that averaged only the rows present overstated both rates differently.
- Out-of-stock flags for one region arrived a day late, so the morning readout counted empty-shelf days at the rollback price as demand and showed a lower lift than the corrected readout an hour later.

**Evaluation Criteria.** Store-days built from a calendar and the stores in the rollback's region, not from sales rows; opening dates, out-of-stock days and (hardest level) other rollbacks of the item removed with their units; inclusive windows with the baseline ending the day before the start; numeric division with NULL-safe lift from unrounded rates; deterministic order; can discuss holdout comparisons, cannibalisation, finer out-of-stock signals and incremental materialisation.
