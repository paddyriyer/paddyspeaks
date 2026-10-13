# Amazon · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of an online
marketplace with first- and third-party sellers, a fulfilment and delivery network,
and public cloud services. Every workload, number, schema and incident is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## AMZ-L3-01: Orders that split, ship and come back line by line

| | |
|---|---|
| **Template ID** | AMZ-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / order-line grain, partial cancellations and returns, OLTP to facts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_orders": {"1": ["3 million"], "2": ["20 million", "45 million"], "3": ["120 million", "250 million"]},
  "third_party_share": ["40%", "60%"],
  "return_window_days": [30, 90],
  "split_share": ["8%", "15%", "25%"]
}
```

**Business Scenario.** A marketplace sells items from its own retail business (first party) and from independent sellers (third party, about {{third_party_share}} of units here). Customers place about {{daily_orders}} orders a day. An order holds several line items; a line can be fulfilled by the marketplace's network or by the seller, and about {{split_share}} of orders split into more than one shipment. Before a line ships, the customer can cancel the whole order or part of a line's quantity; after delivery they can return some or all units within {{return_window_days}} days, and in this scenario a refund can be issued as soon as a return is started, before the item is received back. Seller, category and finance teams all report on these orders, and each has its own idea of "net units sold".

**Problem Statement.** Design the data model from the transactional system to the analytical facts. Cover: the OLTP entities (order, order line, shipment and its lines, cancellation, return and its lines, refund) with their keys and the quantity invariants that hold between them; how changes are captured so that history is not lost; the fact tables and their grains that answer "net ordered units and net sales by day, seller and category", "cancellation rate before shipment", "return rate by seller and category" and "refunds issued for items not yet received back"; and one written definition of net units sold that all three teams can use.

**Constraints.** Quantities on a line reconcile: ordered = cancelled + shipped + still open, and returned ≤ shipped. The refunded amount for a line never exceeds what was charged for it. Money is stored as integers in minor units. A line's state at any past time must be reconstructable. Seller-facing numbers for a closed month change only by a documented restatement.

**Assumptions.** Volumes, shares and the return window are hypothetical. Prices, promotions and taxes are carried per line; an order-level promotion is allocated to its lines when the order is placed. A first-party line carries the retail business as its seller, so every line has exactly one seller.

**Clarifications.**
- Q: Can one line ship in more than one shipment? | A: Yes. A line of 3 units can ship 2 now and 1 later, possibly from different fulfilment centres.
- Q: What does a return reference? | A: The order line, and the shipment when it is known. A replacement for a damaged unit is a new shipment against the same line with no new charge.
- Q: Which date does a return count on? | A: Your choice. Say whether rates are reported by the date the units shipped (a cohort) or the date of the return (activity), and why.
- Q: Can a line be cancelled after it ships? | A: No. After shipment the customer returns it or refuses the delivery, and a refused delivery comes back as a return.
- Q: Do sellers see each other's numbers? | A: No. A seller sees only their own lines, never the first-party ones.

**Hints.**
1. Choose the grain first: the order line is the unit of truth for quantity and money; the order is a header.
2. Record quantity movements on a line (cancelled, shipped, returned, refunded) as their own rows instead of overwriting counters on the line.
3. A return rate needs a cohort and a denominator: returns of units shipped in a period, or returns received in a period, answer different questions.

**Follow-ups.**
1. Write the invariant ordered = cancelled + shipped + open as a check. Where does it run, and what happens to a line that breaks it?
2. A replacement ships for a damaged unit and the customer then returns the replacement. How many units were shipped and returned, and what does the return rate show?
3. An order-level promotion was allocated across three lines. The line that qualified the order for it is cancelled. What happens to the other lines' allocated amounts and to net sales already reported?
4. Returns arrive up to {{return_window_days}} days after delivery. When is a month's return rate final, and what do you show before then?
5. At {{daily_orders}} orders a day, would you keep an accumulating snapshot per line, append-only movement facts, or both? How do you keep the warehouse cheap to update?

**Follow-up rules.**
- when: one row per order, orders table, order level → ask: One order has a line that shipped, a line that was half cancelled and a line that was returned. What does your row per order say about each, and how does a seller see only their own line?
- when: status column, update the line, overwrite → ask: A line of 3 units had 1 cancelled, 2 shipped and 1 returned. If the status is overwritten, how do you answer "how many units were open last Tuesday"?
- when: return rate, returns / orders, returns divided → ask: Is your denominator units shipped, units ordered or orders? Which cohort, and what happens to the most recent month?
- when: refund, refunded → ask: The refund was issued when the return started, but the item never came back. Where does that show in your model, and who sees it?
- when: cdc, change data capture, binlog → ask: The OLTP system updates the same line row several times within a second. What do you capture, and how do you avoid losing an intermediate state?

**Production Reality Check.**
- A seller's dashboard shows a return rate above 100% for one category: replacement shipments were matched as returns of the original line but never counted as shipments.
- After promotion amounts were re-allocated on partial cancellations, last month's net sales by seller no longer sum to the finance total. The month was already closed and statements went to sellers.
- With {{split_share}} of orders splitting into several shipments, an upstream release starts re-numbering shipment lines on every update, and the warehouse counts split lines twice.

**Evaluation Criteria.** Order line as the grain with explicit quantity invariants; quantity movements kept as rows or events so history survives; shipments, returns and refunds as separate entities referencing the line; refunds decoupled from receipt of the return; facts at stated grains (movement fact and/or accumulating snapshot per line) with conformed seller, category and date dimensions; one precise net-units definition; a cohort, denominator and close for return rates; seller-level access; each incident contained, corrected and guarded.

## AMZ-L3-02: Seller inbound shipments — declared, received and reconciled units

| | |
|---|---|
| **Template ID** | AMZ-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / declared versus observed quantities, receiving events, discrepancy cases |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_inbound_units": {"1": ["1 million"], "2": ["8 million", "20 million"], "3": ["60 million", "150 million"]},
  "sellers": ["50,000", "400,000", "2 million"],
  "receive_days": [3, 7, 14],
  "discrepancy_share": ["0.5%", "2%"]
}
```

**Business Scenario.** Third-party sellers who use the marketplace's fulfilment service send their stock to its fulfilment centres. A seller creates an inbound shipment plan listing SKUs and quantities; the plan can be split across several fulfilment centres; the seller then ships labelled boxes, each with declared contents. A fulfilment centre receives a shipment over several days (here receiving normally finishes within {{receive_days}} days of the first box arriving), scanning units as they are checked in and put away, and finds some units missing, extra, damaged or unlabelled. About {{daily_inbound_units}} units arrive a day from {{sellers}} active sellers, and about {{discrepancy_share}} of units end up in a discrepancy. Sellers want to see, per shipment and SKU, what they sent, what was received and what is still being investigated; the marketplace must resolve every shortfall, either by finding the units, reimbursing the seller, or recording that the seller's declaration was wrong.

**Problem Statement.** Design the data model: shipment plans and their versions (a seller can edit quantities until the shipment is marked shipped), the split into one shipment per fulfilment centre, boxes and their declared contents, receiving events (box arrivals, unit check-ins, damage found), and discrepancy cases with their lifecycle (opened, investigating, found, reimbursed, closed as a declaration error). Define the reconciliation invariant per shipment and SKU, when a shipment is closed, and the facts that answer "units in transit versus received, per seller", "time from first box arrival to units sellable", "discrepancy rate by seller, carrier and fulfilment centre" and "units and amounts reimbursed".

**Constraints.** For every shipment and SKU, declared units are eventually fully accounted for: received sellable + received damaged + found later + reimbursed + declaration error, with nothing left open after the investigation window. Receiving history is immutable. A seller sees only their own shipments. Reimbursements are money in integer minor units. Receiving events can arrive late and more than once.

**Assumptions.** Volumes, seller counts, windows and shares are hypothetical. Each unit carries a label that identifies the seller's SKU, so stock from different sellers is never pooled in this scenario. A box can contain several SKUs. A unit received under the wrong shipment can be matched to the right one later.

**Clarifications.**
- Q: Can a seller change the plan after shipping? | A: No. Quantities can be edited until the shipment is marked shipped; afterwards only a box-contents correction with evidence is accepted.
- Q: What happens to a unit that no plan mentions? | A: It is received as an unexpected unit, held, and matched to a shipment later when possible.
- Q: When is a missing unit declared lost? | A: After an investigation window (your choice, stated); then it is reimbursed or closed as a declaration error.
- Q: Are boxes always delivered where they were planned? | A: No. A box can arrive at the wrong fulfilment centre, or with contents that differ from the declaration.
- Q: Does "received" mean scanned at the dock or available for sale? | A: Define both. Sellers care most about when units become sellable.

**Hints.**
1. Separate what was declared (plan and box contents, versioned) from what was observed (receiving events) and from how gaps were resolved (discrepancy cases). The reconciled view is derived from the three.
2. The invariant lives at shipment × SKU; each discrepancy case closes part of the gap with a typed resolution.
3. Receiving events are append-only with an event id, so late and repeated scans are harmless.

**Follow-ups.**
1. Write the reconciliation invariant and show the derived view for one SKU: 100 declared, 96 checked in sellable, 2 damaged, and 1 found a week later under another shipment.
2. A seller edited the plan twice before shipping. Which version do you reconcile against, and how do you show the edits?
3. A plan was split across three fulfilment centres and one receives a box meant for another. How does your model match it?
4. Define the discrepancy rate precisely, including the cohort and when a shipment's number is final given receiving that takes up to {{receive_days}} days.
5. At {{daily_inbound_units}} units a day, unit check-in events dominate storage. Which grain does the warehouse keep for years, and what is aggregated?

**Follow-up rules.**
- when: received_qty, received quantity, counter, increment → ask: Two scanners check in the same box at once and one scan is redelivered an hour later. How does your counter stay right, and how do you show the seller the history?
- when: one shipments table, shipments table, shipment row → ask: The plan is split across three fulfilment centres and one box arrives at the wrong one. Where does that box live in your model?
- when: reimburse, reimbursement → ask: A reimbursed unit is found two weeks later. What happens to the reimbursement and to the seller's inventory?
- when: discrepancy rate, shortage rate, missing units → ask: Is the denominator declared units or received units, and which shipments are still too young to count?
- when: scd, type 2, history table → ask: What exactly is versioned: the plan, the box contents or the receiving counts? Which of these may never change after the fact?

**Production Reality Check.**
- A carrier delivers a region's pallets to the wrong fulfilment centre. For {{receive_days}} days the planned shipments show missing units, and automated discrepancy cases open for thousands of sellers.
- A scanner firmware update redelivers a day of unit check-ins. Received exceeds declared for about {{discrepancy_share}} of shipments, and those sellers' sellable inventory jumps.
- Reimbursements were paid for units that were later found and put away. The seller's inventory counts them as sellable while the reimbursement stays paid.

**Evaluation Criteria.** Declared, observed and resolved quantities kept apart; plans versioned with the shipped version frozen; per-fulfilment-centre shipments and boxes with declared contents; append-only receiving events deduplicated by id; discrepancy cases with typed resolutions and an invariant per shipment and SKU; "received" and "sellable" defined; facts at stated grains with a cohort and a close for rates; seller-level access; each incident contained, corrected and guarded.

## AMZ-L3-03: Forecasts as data — issued runs, quantiles and accuracy against censored demand

| | |
|---|---|
| **Template ID** | AMZ-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / forecast runs and values, immutability, accuracy metrics, censored actuals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "series": ["5 million", "40 million", "200 million"],
  "horizon_weeks": [8, 13, 26],
  "quantiles": ["P10, P50 and P90", "P50, P70, P90 and P98"],
  "stockout_share": ["3%", "8%", "15%"]
}
```

**Business Scenario.** A retailer issues a weekly demand forecast for {{series}} item-and-region series, {{horizon_weeks}} weeks ahead, as probabilistic quantiles ({{quantiles}}). Buying and stock-placement decisions read the issued forecast. Several model versions run side by side: the production model and challengers. Actual sales arrive daily and are corrected later for returns and late orders. In about {{stockout_share}} of series-weeks the item was out of stock for part of the week, so sales understate demand. Planners want to know which forecast drove a decision; the forecasting team wants accuracy by horizon, category and model version.

**Problem Statement.** Design the data model for forecasts and their evaluation. Cover: how a forecast run is stored (model version, forecast date, the feature snapshot it read, status) and how its values are stored (grain, keys, immutability); how challenger runs and re-runs are kept apart from what was issued; planner overrides; the actuals, with their corrections and the in-stock share of each week; and the accuracy layer: which metrics (for example a volume-weighted absolute percentage error for the median, bias, and quantile loss or coverage for the other quantiles), at which grain, against which version of actuals, and how censored weeks are treated. Estimate the storage at series × horizon × quantile × forecast date and say what you keep at full grain.

**Constraints.** An issued forecast is never overwritten: a planner can always see exactly what was issued on a date. Accuracy is reproducible: re-running an evaluation gives the same number unless the actuals it reads were restated, and the report says which actuals it used. Exactly one run per forecast date is the issued production forecast.

**Assumptions.** Series counts, horizons, quantile sets and shares are hypothetical. Weeks are calendar weeks in the region's time zone. Model versions are immutable once registered. Availability data gives, for each series and week, the share of hours the item could be bought.

**Clarifications.**
- Q: Is a re-run of the same model on the same date a new forecast? | A: It is a new run. Only one run per forecast date is marked issued, and only issued runs drive decisions.
- Q: Which actuals does accuracy use, first reported or corrected? | A: You decide. State when actuals are final and whether accuracy is restated afterwards.
- Q: How do we know a week was censored? | A: From the in-stock share of the week in the availability data.
- Q: Do planners change forecasts? | A: Sometimes, for a promotion they know about. An override is its own record with author and reason; the model's forecast is never edited.
- Q: Which metric matters most? | A: A volume-weighted error on the median for buying, and coverage or quantile loss for the quantiles that set safety stock. You choose the weighting.

**Hints.**
1. Separate runs (model version, forecast date, inputs snapshot, status) from values (run, series, target week, quantile, value). "Issued" is a status of a run, set once.
2. Store target week and horizon explicitly as rows, not columns per horizon or per quantile; most accuracy questions slice by horizon.
3. Accuracy joins values to actuals by series and target week. Decide whether censored weeks are excluded, down-weighted or compared with estimated demand, and record the choice with the result.

**Follow-ups.**
1. Estimate rows per weekly issue at {{series}} series × {{horizon_weeks}} weeks × your quantiles. How do you partition and compress them, and what stays at full grain for how long?
2. A planner overrides the forecast for a promotion. How does accuracy treat the override versus the model, and who sees which number?
3. Returns arrive weeks later and lower last month's actuals. Which accuracy numbers change, and how is a report labelled?
4. A challenger beats production on the median error but its P90 covers actuals only 70% of the time. What does your model let the team see, and which decision does that inform?
5. In {{stockout_share}} of series-weeks the item was partly unavailable. Show how you avoid rewarding a forecast that predicted capped sales rather than demand.

**Follow-up rules.**
- when: overwrite, upsert, latest forecast → ask: A buyer asks what the forecast said on the day they placed a purchase order last month. With the latest forecast winning, can you answer?
- when: mape → ask: A series sold 0 units in a week. What does MAPE do there, and how does your metric handle low-volume series?
- when: stockout, out of stock, censored → ask: Do you drop censored weeks, down-weight them or estimate demand? What bias does each choice put into the accuracy report?
- when: one column per quantile, wide table, column per horizon → ask: The team adds a P98 quantile and extends the horizon. What happens to your table and to the rows already written?
- when: actuals table, sales table, actuals → ask: Which version of actuals does a reproducible accuracy run read, and where is that recorded?

**Production Reality Check.**
- A debugging re-run of last week's production model was marked issued by mistake. Purchase orders covering the next {{horizon_weeks}} weeks of one category now trace to a forecast nobody reviewed, and the original issued run cannot be told apart from it.
- Reported accuracy for the latest month improved sharply during a stockout wave: in {{stockout_share}} of series-weeks sales were capped by availability, so forecasts that under-predicted demand looked accurate.
- A returns backfill restated two months of actuals. Last quarter's model comparison, already used to promote a challenger, now favours the previous production model.

**Evaluation Criteria.** Runs separated from values, with issued runs immutable and a unique issued run per forecast date; values in long form with horizon and quantile as keys; overrides as their own records; actuals versioned with availability; accuracy metrics defined with weighting, censoring treatment and the actuals version recorded; a storage estimate with partitioning and retention; each incident traced, corrected and guarded.

## AMZ-L3-04: Seller settlements — orders, fees, refunds and disbursements that reconcile

| | |
|---|---|
| **Template ID** | AMZ-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / settlement periods, typed transaction lines, reserves, three-way reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "sellers": ["80,000", "500,000", "2 million"],
  "settlement_days": [7, 14],
  "monthly_transactions": ["300 million", "1.5 billion", "4 billion"],
  "reserve_rule": ["a reserve of 5% of each period's sales, released 30 days later", "a reserve equal to the refunds expected over the next 7 days"]
}
```

**Business Scenario.** A marketplace collects payment from customers on behalf of third-party sellers and pays sellers on a settlement cycle, here every {{settlement_days}} days. Each period a seller receives a statement of transactions: order principal, shipping and tax collected, marketplace fees (a commission on each sale, and fulfilment fees where the marketplace ships the order), refunds with their fee adjustments, reimbursements for lost or damaged inventory, promotion costs and other charges such as storage. In this scenario the marketplace holds back {{reserve_rule}}. The net amount is disbursed to the seller's bank account; a disbursement can fail and be retried. There are about {{monthly_transactions}} transactions a month across {{sellers}} sellers.

**Problem Statement.** Design the data model that lets the marketplace's finance team and each seller reconcile three things: the operational events (orders shipped, refunds issued), the settlement transaction lines (what was posted, to which period), and the disbursements (bank transfers and their outcomes). Cover the settlement period and its lifecycle (open, closed, disbursement sent, paid, failed, retried), transaction lines with types and signs, the reserve as its own balance, the keys that link each line to its order or refund and to its period, a reconciliation status per order, and the timing differences (an order shipped on the last day of a period settles in the next).

**Constraints.** A closed period's statement never changes; corrections appear as new lines in a later period. For each period, opening balance + Σ lines − change in reserve − amount disbursed = closing balance, carried forward when negative. Money is stored as integers in minor units, per currency; a seller can sell in several marketplaces with different currencies, and amounts in different currencies are never added. Every line is traceable to its source event.

**Assumptions.** Seller counts, cycles, volumes and the reserve rule are hypothetical; the fee schedule itself is out of scope. In this scenario an order's money posts when it ships, not when it is placed.

**Clarifications.**
- Q: When does an order's money post? | A: At shipment in this scenario. An order cancelled before shipment never posts.
- Q: Can a period's net be negative? | A: Yes, after heavy refunds. The negative balance carries forward to the next period in this scenario.
- Q: Does a refund return the marketplace fee? | A: Partly. In this scenario most of the commission is returned and a small administration fee is kept, so model fee lines separately from principal.
- Q: What happens when a disbursement fails? | A: The amount returns to the seller's balance and is paid by a retry or in the next period.
- Q: Which time zone defines a period? | A: You decide; the seller's reports are in their marketplace's local time.

**Hints.**
1. Treat each seller's statement as a small ledger: periods, typed signed lines, and balances (available and reserved) derived from lines.
2. Reconciliation is a status per source item: an order is posted when its lines appear in a period, and paid when that period's disbursement succeeds.
3. Keep event time, posting time and period apart. Most reconciliation breaks are timing.

**Follow-ups.**
1. Write the period balance equation and walk one period that contains a refund for an order sold in the previous period and a failed disbursement.
2. An order ships at 23:59 local time on the last day of a period whose boundary is defined in UTC. Which period gets it, and how does the seller see why?
3. A refund is issued for an order whose sale posted three periods ago. Which lines are created, with which keys, and how does the seller see the net result of that order?
4. Finance must prove every day that order postings equal operational shipments, by marketplace and currency. Which tables and keys make that one query?
5. The reserve rule changes in the middle of a period. How is the change auditable, and how does the seller see why the payout dropped?

**Follow-up rules.**
- when: balance column, update balance, running balance → ask: A refund and a sale post for the same seller at the same moment. How does the balance stay right, and how does it appear on a statement that must never change?
- when: delete, edit the statement, correct the line → ask: A posted fee was wrong. How do you correct it without changing the closed statement the seller already downloaded?
- when: match on amount, join on amount, fuzzy → ask: Two orders for the same amount on the same day: how do you avoid matching the wrong one, and which key would remove the guess?
- when: utc, time zone, period boundary → ask: The seller's dashboard counts local days and your periods use another boundary. How do you keep their totals from disagreeing?
- when: reserve → ask: Is the reserve a separate balance or just a line type? How does its release show up on a later statement?

**Production Reality Check.**
- A bank rejects a batch of disbursements because of a changed account format, but the {{settlement_days}}-day periods were marked paid when the transfers were sent. Sellers see "paid" for money they did not receive.
- A fee change was applied twice in one period for 3% of sellers. Their statements are closed and already downloaded.
- For orders that shipped at a period boundary, refund lines arrived before the sale lines, and per-order reconciliation shows thousands of "refund without sale" breaks.

**Evaluation Criteria.** Periods and typed signed lines with balances derived, never edited; the balance equation per period and currency; the reserve as its own balance with an auditable rule; keys from every line to its source event and period; reconciliation status per order through posting and payment; event, posting and period times kept apart; disbursement lifecycle with failures returning funds; each incident contained and corrected with compensating lines, not edits.

## AMZ-L3-05: Available to promise from an inventory ledger and reservation holds

| | |
|---|---|
| **Template ID** | AMZ-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / ledger sums, reservation holds, as-of boundaries, at-least-once feeds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | AMZ-L3-05.mjs |

**Business Scenario.** A marketplace keeps sellable stock in fulfilment centres (here {{fc_list}}). Every physical change is a row in the inventory movement ledger with a signed `qty`: positive puts units on the shelf, negative takes them off. {{kinds_rule}} When an order is assigned to a fulfilment centre, a reservation holds units of the SKU there until they ship. A hold lapses at `expires_at` ({{ttl_hours}} hours after it was made) and a cancelled order releases it. Operations wants a point-in-time view of what each fulfilment centre can still promise, and of where more units are held than are on the shelf.

**Problem Statement.** Write one PostgreSQL query that returns `fc_id, sku, on_hand, reserved, available_to_promise, oversold_units` as of `{{as_of}}`: one row per (fc_id, sku) that has a movement that occurred at or before that time, or a reservation made at or before it, ordered by `fc_id, sku`. `on_hand` is the sum of `qty` over the pair's movements with `occurred_at` at or before the as-of time. `reserved` is the sum, over the pair's reservations made at or before the as-of time, of the units each still holds: its `qty` minus the units shipped against it (ship movements carrying its `reservation_id` that occurred at or before the as-of time), never below 0. A reservation holds nothing if it was cancelled at or before the as-of time, or if it has expired: it holds only while the as-of time is strictly before `expires_at`. `available_to_promise` is `on_hand − reserved` and `oversold_units` is `reserved − on_hand`, each floored at 0. {{feed_rule}}

**Constraints.** One SQL statement (CTEs allowed). Boundaries are inclusive, except expiry: at exactly `expires_at` the hold has lapsed. A pair whose reserved units are all released still appears. The sample has {{movements}} movement rows and {{reservations}} reservations; production has billions of movements across hundreds of fulfilment centres.

**Assumptions.** Hypothetical schema, fulfilment centres, SKUs and quantities. A ship movement's fc_id and sku always match its reservation's. Quantities are units; no money is involved.

**Clarifications.**
- Q: Does a reservation made exactly at the as-of time hold units? | A: Yes. Made at or before the as-of time counts.
- Q: And one cancelled exactly at the as-of time? | A: It is released: cancelled at or before the as-of time holds nothing.
- Q: Should I filter on ingested_at? | A: No. occurred_at places an event in time; ingested_at is only when it reached the warehouse.
- Q: Should a pair with reservations but no movements yet appear? | A: Yes, with on_hand 0. Those are the rows operations cares about most.
- Q: Does shipping a reserved unit change both on_hand and reserved? | A: Yes. The ship movement takes it off the shelf and consumes that much of the hold, so the unit is never subtracted twice.

**Hints.**
1. First compute the units shipped per reservation from ship movements up to the as-of time, then each reservation's remaining hold.
2. Aggregate movements and holds separately by (fc_id, sku) and combine the two with a FULL JOIN. Joining raw movements to raw reservations multiplies rows.
3. `GREATEST(x, 0)` floors a value; `COALESCE` fills the side that is missing.

**Follow-ups.**
1. At billions of movements, how would you serve this per (fulfilment centre, SKU) in milliseconds, and what keeps a materialised balance exactly equal to the ledger?
2. This query treats a hold as released the instant it expires; the operational system releases it when a sweeper runs. Which number is right for the storefront, and which for this report?
3. A SKU shows oversold units. Write the follow-on query that lists which reservations, oldest first, cannot be filled from on_hand.
4. The feed is at least once. Should duplicates be removed in this query, at ingestion, or both? What does each cost?

**Follow-up rules.**
- when: join inventory_movements, join reservations, using (sku) → ask: How many rows does one reservation produce when it is joined to every movement of its SKU, and what does that do to your SUM?
- when: inner join → ask: Which (fc_id, sku) rows disappear with an inner join, and are they the ones operations needs most?
- when: select distinct, distinct fc_id, distinct * → ask: What exactly is DISTINCT removing? Two genuine receipts of the same quantity can differ only in event_id.
- when: ingested_at → ask: Why can ingested_at be later than occurred_at, and which of the two belongs in an as-of filter for physical stock?
- when: expires_at → ask: At exactly expires_at, is the hold still in force? Show the comparison you wrote and why.

**Production Reality Check.**
- During a deal, this report shows oversold units for one SKU at one fulfilment centre while the storefront kept promising delivery; the storefront's cached availability lagged the reservations by minutes, and holds last {{ttl_hours}} hours.
- After a consumer restart the movement feed redelivered an hour of ship events. A version of this report that summed raw rows showed on_hand below zero for a few SKUs and triggered re-planning of orders that could have shipped.

**Evaluation Criteria.** Movements and holds aggregated separately and combined with a FULL JOIN; units shipped subtracted from each hold, floored at 0; cancellation and expiry boundaries exactly as stated; floored outputs; at the hardest level, one row per event_id and occurred_at (not ingested_at) as the time; deterministic ordering; can explain materialised balances, the sweeper gap and how to allocate an oversell to orders.
