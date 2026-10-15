# Walmart Global Tech · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of omnichannel
retail: stores and e-commerce, online grocery pickup and delivery, store
inventory and replenishment, substitutions, and register sales. Every workload,
number and schema is hypothetical; pricing, weighing, substitution and
replenishment rules are this exercise's rules (check current docs), and nothing
here describes how the company's own systems, registers, suppliers or carriers
work. Store, associate and customer data appear only in aggregate.

## WMT-L2-01: Frequently bought together: item pairs that share at least s baskets

| | |
|---|---|
| **Template ID** | WMT-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing and counting / pair co-occurrence per basket, support thresholds, ordering |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | WMT-L2-01.mjs |

**Business Scenario.** A merchandising team wants to know which items customers buy together, so that it can place them near each other in stores and suggest one when the other is in an online cart. A basket is one register transaction or one online order, reduced to the list of items in it. A pair of items counts as "frequently bought together" when it appears in at least `s` baskets, the pair's support. The first version of the report is a plain count, before any lift or confidence measure is added.

**Problem Statement.** Implement `frequent_pairs(baskets, s, max_items=None)`. `baskets` is a list of baskets, and each basket is a list of item names. A pair `(a, b)` is two different items with `a < b`, and it appears in a basket if both items do. A basket counts once for a pair, however many times either item is listed in it. Return a list of `(a, b, count)` for every pair that appears in at least `s` baskets, where `count` is the number of baskets it appears in. Order the list by `count` descending, then by `a`, then by `b`. If no pair qualifies, return an empty list. {{basket_rule}} {{bulk_rule}}

**Constraints.** Up to 50 000 baskets over a catalogue of 5 000 items, with at most about ten distinct items in an ordinary basket. `s` is at least 1. Item names are plain ASCII names or codes, compared as Python strings. Something close to O(Σ b²) is expected, where b is the number of distinct items in each basket that is counted. Checking every pair of catalogue items against every basket, O(I²·n), is far too slow, and so is intersecting per-item sets of baskets for every pair of items.

**Assumptions.** Baskets, item names and thresholds are hypothetical. The bulk-basket rule is this exercise's rule; check current docs for any real product. Quantities do not matter: buying six cans of one soup is the same as buying one for this report.

**Clarifications.**
- Q: If milk appears twice in a basket with bread, is that two baskets for (bread, milk)? | A: No. A basket counts once for a pair, however many times its items are listed.
- Q: Is an item paired with itself when it is listed twice? | A: No. A pair is two different items.
- Q: Which way round is a pair written? | A: Name order: `a < b` as Python compares strings, whatever order the items were scanned in.
- Q: How are ties in count ordered? | A: By `a`, then by `b`, both ascending. The output is fully determined.
- Q: When `max_items` is set, do repeated items count towards it? | A: No. It limits distinct items: a basket with the same three items listed twice has three.

**Hints.**
1. How many pairs does one basket of b distinct items contain? Add that up over the baskets. That is the work you cannot avoid, and it is small.
2. Turn each basket into a sorted set of distinct items first. Then every pair comes out already in name order.
3. Check `max_items` before you generate any pair from a basket. A basket of 4 000 items holds about eight million pairs.

**Follow-ups.**
1. Bananas and milk appear in a large share of all baskets, so they top the list with everything. What measure would you report instead of the raw count, and what does it do to rare items?
2. The pair counts must cover a year of baskets across every store. How do you compute them in a distributed job, and where does the shuffle get large?
3. The team now wants triples. How does the work grow, and how would the pair results let you prune the candidates?
4. A pair's support jumps for one week in one region. How would you tell a real change in what customers buy from a promotion, a planogram change or a data problem?

**Follow-up rules.**
- when: combinations, itertools → ask: How many pairs does `combinations` produce for a basket of 4 000 items, and where in your loop do you make sure that never happens?
- when: apriori, frequent items, prune → ask: Pruning items with support below s first is a good idea. At these sizes most items pass it. What does the pair step cost after pruning?
- when: intersection, set of baskets, tid → ask: Intersecting two items' basket sets is fast. How many intersections does it take for 5 000 items, and how large is each one?
- when: Counter, defaultdict, dictionary → ask: How many distinct pairs can your dictionary end up holding over a year of baskets, and what would you do when it no longer fits in memory?
- when: lift, confidence → ask: Write the formula. What happens to lift for a pair of items that each appear in only three baskets?

**Evaluation Criteria.** Each basket counted once per pair, with repeats removed first; no item paired with itself; pairs in name order; the support threshold inclusive at exactly `s`; the stated ordering with tie-breaks; empty and one-item baskets handled; bulk baskets skipped by distinct-item count before pairs are generated; counting inside each basket, with a clear O(Σ b²) argument and why the set-intersection approach does not scale; sensible answers on lift, distributed counting and triples.

## WMT-L2-02: Store floor heat map: sales over many rectangular floor areas

| | |
|---|---|
| **Template ID** | WMT-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Arrays / 2D prefix sums, inclusion-exclusion, clipping rectangles |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | WMT-L2-02.mjs |

**Business Scenario.** A store's sales floor is divided into a grid of equal cells, and each cell holds the week's net sales, in whole dollars, of the items displayed there. Store planners draw rectangles on a floor plan (an end cap, an aisle block, a seasonal area, a department) and want the total sales inside each one. A planning tool sends tens of thousands of rectangles at once, for many layouts it compares, so each answer must be cheap.

**Problem Statement.** Implement `area_sales(grid, queries)`. `grid[r][c]` is the net sales of the cell in row `r` and column `c`. Every row has the same length, and the grid has at least one cell. Each query `(r1, c1, r2, c2)` names two opposite corner cells of a rectangle, and both corners are inside it. Return a list with the total of the cells inside each rectangle, in query order. {{corner_rule}}

**Constraints.** Up to 600 rows by 800 columns and 80 000 rectangles, many of them covering most of the floor. Values are integers with an absolute value below 10 000. Something close to O(R·C + q) is expected. Summing each rectangle, even row by row with slices, is too slow, and so is a prefix sum per row that still loops over the rows of every rectangle.

**Assumptions.** Floor layouts and sales are hypothetical. How sales are credited to a cell, and how returns are credited back, is this exercise's rule. The grid does not change while one batch of rectangles is answered.

**Clarifications.**
- Q: Are both corners included? | A: Yes. `(2, 3, 2, 3)` is the single cell in row 2, column 3.
- Q: Can I assume `r1 <= r2` and `c1 <= c2`? | A: Only where the rules above say so. Read them for this replay.
- Q: Can a total be negative? | A: Yes, when cells with returns outweigh the rest.
- Q: What if a rectangle has no cell on the floor? | A: Where rectangles can leave the floor, a rectangle with no cell on it totals 0.
- Q: May I use NumPy? | A: Answer in plain Python first. Then say what NumPy would and would not change about the complexity.

**Hints.**
1. Let `P[i][j]` be the total of every cell above and to the left of `(i, j)`, exclusive. One pass over the grid fills it.
2. A rectangle's total is four lookups in `P`: the large corner, minus the strip above, minus the strip to the left, plus the corner you subtracted twice.
3. Put the corners in order and clip them to the floor before you look anything up. An empty range after clipping means 0.

**Follow-ups.**
1. Sales update every hour, one cell at a time, while planners keep querying. What structure keeps both updates and queries fast, and what does each cost?
2. Planners now want the busiest 3 × 4 area on the floor, anywhere. How do you find it, and how fast?
3. The heat map should cover every store in the chain, each with its own floor size, every week for two years. How would you store the prefix sums, and what would you precompute?
4. Cells are not equal in practice: a freezer aisle and a clothing rack have very different sales per square foot. How would you make the heat map fair to compare across areas?

**Follow-up rules.**
- when: slice, sum(row, sum(grid → ask: A row slice is summed at C speed. How many slices does one tall rectangle take, and how many slices is that for 80 000 rectangles?
- when: accumulate, row prefix, prefix per row → ask: With a prefix sum per row, what does one rectangle still cost, and how would you remove the loop over its rows?
- when: numpy, vectorise, vectorize → ask: NumPy makes each rectangle's sum fast. What is the total work across all rectangles, and what precomputation would make each one O(1) in NumPy too?
- when: fenwick, binary indexed, segment tree → ask: That supports updates. What does a query cost in two dimensions, and when is a plain prefix-sum table better?
- when: inclusion-exclusion, four corners → ask: Show your four lookups for a rectangle that starts at row 0. How does your table avoid an index of -1?

**Evaluation Criteria.** A 2D prefix-sum table with an extra row and column, built in one pass; correct inclusion-exclusion with inclusive corners; corners put in order where they can come either way; rectangles clipped to the floor and empty ones returning 0; negative cells handled; O(R·C + q) explained, and why per-rectangle summing (even with C-speed slices or per-row prefixes) does not scale; credible answers on updates, the best fixed-size area and storage across stores.

## WMT-L2-03: Debug the store replenishment order calculator

| | |
|---|---|
| **Template ID** | WMT-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Business rules / rounding to case packs, stock positions, time zones, renamed fields |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer, staff-data-engineer |
| **Generator** | WMT-L2-03.mjs |

**Business Scenario.** Every night a calculator decides how many cases of each item each store should order, so that the shelf covers the forecast for the next few days plus some safety stock. Store teams have raised several complaints. Shelves run out a day early, because orders arrive one case short. Stores with full backrooms keep receiving more of the same item. A store whose count went negative after a late receipt over-ordered. Items already delivered are treated as if they were still on the way. Stores in the west order for the wrong days. The function below is the suspect.

**Problem Statement.** Fix `replenishment_orders(positions, forecast, stores, start, end)` so that it meets this specification. `stores` maps each store to its offset from UTC in whole hours. `start` and `end` are store-local dates, `YYYY-MM-DD`, inclusive. {{replay_rule}}
1. **Forecast.** Each row `{"store", "item", "utc", "units"}` is the units expected to sell in the hour that starts at `utc`, a UTC timestamp written `YYYY-MM-DDTHH:MM` without a zone. It counts towards the item's need at that store if the store-local date of that hour (UTC plus the store's offset) is between `start` and `end`. Rows for a store and item with no position are ignored.
2. **Available stock.** Each position `{"store", "item", "on_hand", "backroom", "case_pack", "safety", "open_orders"}` has available stock `max(on_hand, 0) + backroom + units on order`. `on_hand` is the sales-floor count, and it can be negative when sales are scanned before a receipt is recorded; this exercise treats a negative count as 0. Units on order are `cases × case_pack` summed over `open_orders` whose `status` is `"open"`. A `"received"` order is already in the counts, and a `"cancelled"` order will not arrive.
3. **Order.** The shortfall is `need + safety − available`. If it is positive, the store orders the smallest whole number of cases that covers it. Otherwise it orders nothing.
4. **Output.** A dict `{"<store>/<item>": cases}` with an entry only for positions that order at least one case.

**Constraints.** Keep the function's shape and output format. Up to 40 000 positions and 200 000 forecast rows, processed in linear time. Offsets are fixed for the window (this exercise's simplification: no daylight-saving change inside it).

**Assumptions.** Stores, items, forecasts and the ordering rule are hypothetical and simplified; they are this exercise's rules, not any retailer's. Lead times, minimum orders and shelf capacity are left out.

**Clarifications.**
- Q: Is a negative on-hand an error? | A: It is a count that is behind reality. The order uses 0 for it, and the negative number is a signal for a cycle count, outside this function.
- Q: Does backroom stock count, even though it is not on the shelf? | A: Yes. It can be moved to the shelf without an order.
- Q: Which date does a forecast hour belong to? | A: The store-local date of the hour's start: UTC plus the store's offset, which is negative for stores west of UTC.
- Q: Can a store order part of a case? | A: No. It orders whole cases, enough to cover the whole shortfall.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Work one position by hand: 10 on hand, safety 4, a forecast of 20, a case pack of 6. How many cases does the code order, and how many cover the shortfall?
2. Print the keys of a position dict, and compare them with every key the code reads.
3. Take a store at UTC−5 and a forecast hour at 02:00 UTC on the first day of the window. Which local date is that?
4. List the statuses an open order can have, and which of them add stock that is not yet counted.

**Follow-ups.**
1. The forecast is uncertain, and some items sell in bursts. How would you set safety stock per item and store, and what data would you use?
2. A case pack changes from 6 to 12 in the middle of the week, while orders in the old pack are still open. What breaks, and how would you store pack sizes?
3. Some stores show negative on-hand counts every week for the same items. What does that tell you, and how would you turn it into a list of counts to do?
4. This runs nightly for thousands of stores across six time zones. When does each store's run start, and how do you handle a forecast or a receipt that arrives late?

**Follow-up rules.**
- when: math.ceil, ceil( → ask: Your ceiling divides with `/`, which gives a float. Up to what size is that exact, and what integer-only form avoids the question?
- when: max(0, clamp → ask: The order treats a negative count as 0. Who should still see the negative number, and what would they do with it?
- when: zoneinfo, pytz, daylight → ask: This exercise fixes offsets for the window. What changes when the window crosses a daylight-saving change, and where would the store's zone name come from?
- when: received, cancelled, status → ask: A receipt is recorded a day after the truck arrived. For that day, is the order counted twice, not at all, or once? What would you check?

**Evaluation Criteria.** Finds and explains every bug with the complaint it caused; whole-case rounding up; backroom stock read from the right field; a negative on-hand treated as 0 without hiding backroom or open orders; only open orders counted as still to come; forecast hours bucketed by store-local date with each store's own offset; minimal, linear fixes; a test per bug.

## WMT-L2-04: Weighted and variable-price grocery items, from estimated to final charge

| | |
|---|---|
| **Template ID** | WMT-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / order line lifecycle, estimates versus actuals, money in minor units, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_orders": {"2": ["400,000", "900,000"], "3": ["3 million", "6 million"]},
  "stores": ["1,200", "3,000", "4,500"],
  "weighted_share": ["8%", "15%", "22%"],
  "hold_buffer": ["10%", "15%", "20%"]
}
```

**Business Scenario.** An online grocery service takes about {{daily_orders}} pickup and delivery orders a day, picked in {{stores}} stores. About {{weighted_share}} of order lines are sold by weight or have a variable price: loose produce, deli counter items, and packaged meat whose price depends on the weight of the pack. When the customer orders, the line shows an estimated price based on an average weight, and the payment method is authorised for the estimated total plus a buffer of {{hold_buffer}} (this exercise's rule; check current docs). At picking, the associate records the actual weight or the price on the pack. Some lines are substituted, some are short, and some are returned afterwards. The customer pays the final amount, which can differ from the estimate.

**Problem Statement.** Design the data model and pipeline that carries each line from the estimate to the final charge and beyond. Cover the events and their keys (order placed, line edited, picked with weight or price, substituted, short, handed over, returned), how the final charge per line is computed and rounded, what happens when the final total exceeds the authorised amount, how refunds for returns are calculated for weighed items, and the analytics on top: estimate accuracy per item and store, the share of orders that exceed the buffer, and the difference between estimated and final revenue per day.

**Constraints.** Money is stored as integer cents and weight as integer grams (or thousandths of a pound). The line's final price is computed and rounded once (this exercise's rule: half up to the cent). Events from store devices can arrive late or twice. A customer's receipt must be reproducible exactly, months later. Store and customer data appear in reports only in aggregate.

**Assumptions.** Order volumes, shares, buffers and rounding rules are hypothetical, and they are this exercise's rules, not a description of any retailer's checkout or payment flow. Each picked weighed line carries a measured weight from a scale, or a printed price and weight from a pre-packed label.

**Clarifications.**
- Q: Is the estimate per unit or per line? | A: Per line: the ordered quantity times an average weight times the price per kilogram or pound, or an average pack price for variable-price packs.
- Q: What if the final total exceeds the authorised amount? | A: That is one of the cases you must design for. Say what the system does and what the customer sees.
- Q: Can the price per kilogram change between the order and the pick? | A: Yes. You decide which price applies, state it as this exercise's rule, and record both.
- Q: How is a substitute for a weighed item priced? | A: Choose a rule and state it; the data model must record the original line, the substitute and the price rule used.
- Q: Who reads the analytics? | A: Merchandising (estimate accuracy per item), store operations (picking and weighing) and finance (estimated versus captured revenue).

**Hints.**
1. Keep the estimate and the actual as two separate facts on the line, never one field that is overwritten.
2. Compute the final charge per line from the recorded inputs (weight, unit price, rule version), so a receipt can be rebuilt exactly.
3. Separate the order line from its fulfilment: one ordered line can become a substitute, a partial pick and a return.

**Follow-ups.**
1. A scale in one store was mis-calibrated for a week. How do you find the affected lines, and what do you do about the charges?
2. The final total exceeds the authorised amount for 2% of orders on a holiday. What options exist, and what data would you use to choose the buffer?
3. A customer returns half of a weighed item. How is the refund calculated, and what does the line look like afterwards?
4. Estimates for one item are systematically 20% low in one region. How would you detect it, and who changes the average weight?

**Follow-up rules.**
- when: float, decimal, numeric → ask: Which amounts and weights do you store as what type, and where exactly does rounding happen?
- when: overwrite, update the line, update in place → ask: The estimate was overwritten by the actual. How do you now measure estimate accuracy, or rebuild the receipt the customer saw at checkout?
- when: authorization, authorisation, buffer → ask: The final total is above the authorised amount. Walk through what happens to the order and what the customer is told.
- when: substitution, substitute → ask: The substitute is sold by the pack, not by weight. Which price is charged, and where is that rule recorded?

**Production Reality Check.**
- About {{weighted_share}} of lines are weighed. After a price-file update, one store's deli prices per kilogram are ten times too high for three hours, and those orders are handed over before anyone notices.
- On a holiday peak, 3% of orders exceed the {{hold_buffer}} buffer, and the pipeline's daily revenue report shows captured revenue above the authorised total.
- A store device loses connectivity and sends the morning's pick events, with weights, twice after reconnecting.

**Evaluation Criteria.** Estimate and actual kept as separate facts; an event model keyed by order line and fulfilment step, with deduplication; final charges computed from recorded inputs with one stated rounding rule in integer cents; the over-buffer case designed end to end; substitutions, shorts and partial returns linked to the original line; receipts reproducible from stored inputs and rule versions; analytics in aggregate for merchandising, operations and finance; a plan for each incident.

## WMT-L2-05: Register transactions into analytics, reconciled to the tills

| | |
|---|---|
| **Template ID** | WMT-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / store-and-forward ingestion, voids and returns, late data, daily reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "stores": {"2": ["600", "1,500"], "3": ["4,000", "10,000"]},
  "registers": ["12", "25", "40"],
  "daily_transactions": {"2": ["4 million", "9 million"], "3": ["30 million", "60 million"]},
  "offline_hours": ["4 hours", "12 hours", "48 hours"]
}
```

**Business Scenario.** A retailer runs {{stores}} stores with about {{registers}} registers each, including self-checkout, and records about {{daily_transactions}} register transactions a day. Registers keep selling when the store loses its connection, and forward their transactions later; a register can be offline for up to {{offline_hours}}. A transaction can be voided before it completes, a line can be voided inside a transaction, and returns can be made at any store for purchases made elsewhere or online. Every evening each store closes its tills, and finance treats the till totals as the truth. Analytics must show daily sales by store, department and item that agree with the tills.

**Problem Statement.** Design the pipeline from the registers to daily sales tables. Cover the transaction record and its identity, how registers forward their transactions and what makes a resend harmless, how voids, line voids and returns are represented, which business date a transaction belongs to (store-local date, transactions that cross midnight, registers with a wrong clock), how late transactions update days already published, how you reconcile your daily totals with the till close and what happens when they disagree, and the tables analysts use.

**Constraints.** A transaction must be counted exactly once, however many times it is sent. A day's sales may change after publication, and every change must be explainable. Reconciliation with the tills must run per store and day, and a difference must name the registers and transactions behind it. Customer data stays out of these tables; reports are by store, department and item.

**Assumptions.** Store counts, volumes and offline durations are hypothetical. Each register numbers its transactions in sequence and stamps them with its own clock. The till close produces totals per register and tender type. Business-date and return rules are this exercise's rules.

**Clarifications.**
- Q: Which date does a return belong to? | A: The date and store where the return happens. It is linked to the original sale when the receipt is known.
- Q: Is a voided transaction sent at all? | A: Yes, with a void status. A line void appears as a line with a negative quantity, linked to the line it cancels.
- Q: How late can a transaction arrive? | A: Typically minutes, but up to {{offline_hours}} when a store is offline, and occasionally days after a register is repaired.
- Q: Does the register clock always agree with the store's? | A: No. Some registers drift or are set to the wrong zone after a repair.
- Q: Is the till close always right? | A: Finance treats it as the record. When analytics disagrees, you must show why, not quietly adjust either side.

**Hints.**
1. Give every transaction an identity that the register itself creates, such as store, register and sequence number, and use it to make resends harmless.
2. Gaps in a register's sequence numbers tell you exactly which transactions are still missing.
3. Treat a published day as a version. A late transaction creates a new version of that day, with the difference recorded.

**Follow-ups.**
1. A store was offline for {{offline_hours}} on its busiest day. Walk through what each table shows during the outage, after reconnection, and after the till close.
2. A register's clock was set to the wrong year after a repair, and it sold for a day. How do you detect it, and which date do its transactions get?
3. Finance's till total for one store and day is 0.4% higher than yours. How do you find the cause, and who signs off?
4. Item-level sales feed replenishment and price analytics within the hour. How do you serve them fast while still reconciling to the tills at night?

**Follow-up rules.**
- when: timestamp, event time, register clock → ask: Some register clocks are wrong. Which time decides the business date, and how do you notice a clock that has drifted?
- when: dedupe, dedup, exactly once → ask: What is the key you deduplicate on, how long do you keep it, and what happens to a transaction resent after that?
- when: append, insert only, incremental → ask: A transaction from three days ago arrives. How does the day's total change, and how do you show analysts what changed?
- when: merge, upsert, overwrite → ask: An upsert replaces a row. How do you still explain to finance why yesterday's total moved after it was published?
- when: sequence, gap → ask: A register restarts and its sequence begins again at 1. How does your gap detection tell that from missing transactions?

**Production Reality Check.**
- A region loses connectivity for {{offline_hours}} on a Saturday; when stores reconnect, their registers forward the backlog together, and several also resend transactions they had already sent.
- One register's clock is set to the wrong time zone after a repair, and for two days its sales land on the wrong business date.
- Analytics totals for 30 of {{stores}} stores are below the till close after a register software update changed how line voids are sent.

**Evaluation Criteria.** A register-generated transaction identity and deduplication on it; sequence gaps used to measure completeness; voids, line voids and returns modelled explicitly and linked; a clear business-date rule in store-local time with clock problems detected; late data applied as versioned, explainable corrections to published days; per-store, per-register reconciliation with the till close that names the transactions behind a difference; analyst tables by store, department and item, with no customer data; a plan for each incident.
