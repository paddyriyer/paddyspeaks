# Walmart Global Tech · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an omnichannel
retailer: stores and e-commerce, online grocery pickup and delivery, substitutions,
store inventory and replenishment, and register sales. None of these questions comes
from the company's interviews, and none describes its internal systems, suppliers or
data. Every rule marked "this exercise's rule" is a simplification made for practice;
all numbers are hypothetical. Store, associate and customer data appear only in
aggregate.

## WMT-L1-01: Pickup wait from check-in to handover, per store and hour of day

| | |
|---|---|
| **Template ID** | WMT-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / conditional aggregation over event pairs, GREATEST for a clock that starts late, local hour of day |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | WMT-L1-01.mjs |

**Business Scenario.** Grocery pickup customers reserve an hour-long slot, drive to the store and tap "I'm here" in the app; an associate brings the order out to the car. Store operations wants to see how long customers wait, per store and per hour of day, so it can staff the pickup area for the busy hours. Customers who arrive before their slot are early by their own choice, so this exercise's rule starts their wait at the slot start, not at the moment they checked in.

**Problem Statement.** Write one PostgreSQL query that returns `store_id, hour_of_day, handovers, avg_wait_min, max_wait_min, over_target`. For each order with a check-in and a handover, the **wait starts** at the later of its check-in and its `slot_start`, and the **wait** is the minutes from the wait start to the handover, never below 0 (a handover before the slot started is a wait of 0). `hour_of_day` is the hour (0–23) of the wait start. Group by store and hour of day: `handovers` counts the orders, `avg_wait_min` is the average wait rounded to 1 decimal place, `max_wait_min` the longest wait, and `over_target` counts waits longer than {{target}} minutes. Order by `store_id, hour_of_day`. {{event_rule}} {{tz_rule}}

**Constraints.** One SQL statement (CTEs allowed). Event times are recorded to the minute. The sample has {{orders}} orders; the result has one row per store and hour with at least one counted order.

**Assumptions.** Stores, slots, waits and the target are hypothetical; the wait rule is this exercise's rule, not any retailer's published standard. No customer or associate appears in the data: orders carry no customer identity, and nothing here measures an individual associate.

**Clarifications.**
- Q: A customer checks in 20 minutes before the slot and gets the order 5 minutes after the slot starts. What is the wait? | A: 5 minutes, measured from the slot start. That order counts in the hour of the slot start.
- Q: Which hour does an on-time customer count in? | A: The hour of the check-in, because that is when the wait started.
- Q: Is a wait of exactly {{target}} minutes over the target? | A: No. Only waits longer than the target count.
- Q: How is the average rounded? | A: `ROUND(…, 1)` on the average of the per-order waits, half away from zero.
- Q: What about an order that was never handed over? | A: It has no wait and is left out, as is a handover with no check-in.

**Hints.**
1. Reduce the events to one row per order first: its check-in time and its handover time.
2. `GREATEST(checkin_ts, slot_start)` is the wait start; the wait is `EXTRACT(EPOCH FROM handover_ts - wait_start) / 60`, clamped at 0.
3. Take the hour of the wait start, not of the check-in. For a local hour, convert with `AT TIME ZONE` before extracting it.

**Follow-ups.**
1. Operations asks for the 90th percentile wait instead of the average. What changes, and why can percentiles not be averaged across stores afterwards?
2. Some customers never tap "I'm here" and walk to the desk instead. How would you report how many handovers your metric cannot see, without guessing their waits?
3. A store moves its pickup area and its waits drop. How would you show the change fairly when the same week also had fewer orders in the busy hours?
4. At thousands of stores and millions of events a day, how would you build this incrementally, given that handovers arrive minutes to hours after check-ins?

**Follow-up rules.**
- when: checkin_ts, check-in time, check in time → ask: A customer checks in at 10:40 for an 11:00 slot. Which hour does your query put that order in, and what does the specification say?
- when: max(event_ts), last check-in, latest check-in → ask: A customer taps "I'm here" twice. Which tap starts the wait, and why?
- when: >=, at least → ask: Is a wait of exactly the target over the target in your query?
- when: utc, at time zone → ask: A store in Los Angeles hands over an order at 8:30 pm local. Which UTC date and hour is that, and which hour does the report show?
- when: avg, average → ask: Do you average the waits or the per-hour averages? Is there a difference when the hours have different numbers of orders?

**Evaluation Criteria.** One row per order with its first check-in and its handover; the wait starts at the later of check-in and slot start; waits clamped at 0; the hour of the wait start, in the store's local time at Very Hard; orders without both events left out; strict "over" the target; correct rounding and deterministic order; can discuss percentiles, invisible walk-ups and incremental builds.

## WMT-L1-02: Substitutions rejected at handover, and short items with no substitute offered

| | |
|---|---|
| **Template ID** | WMT-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / latest row per group, anti-join, conditional counts, ISO weeks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | WMT-L1-02.mjs |

**Business Scenario.** When an online grocery item is out of stock at the store picking the order, the picker can offer a substitute, which the customer accepts or rejects at handover. Two numbers tell the merchandising team whether substitutions are working: how often customers reject them, and how often an item was short with no substitute offered at all, a missed chance to keep the sale. They want both per product category and week.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, category, lines, substituted, rejected, reject_rate, short_no_offer`, one row per week and category with at least one line in a completed order, ordered by `week_start, category`. `week_start` is the Monday of the UTC date of the order's `pickup_ts`; `category` is the category of the item the customer **ordered** (not of the substitute). `lines` counts the order lines. A line is **substituted** when it is `short` and has at least one row in `sub_offers`; it is **rejected** when the decision of its latest offer is `rejected`. `reject_rate` is rejected divided by substituted, rounded to 4 decimal places, and `NULL` when nothing was substituted. `short_no_offer` counts short lines with no offer whose customer allowed substitutes. {{offer_rule}} {{allow_rule}}

**Constraints.** One SQL statement (CTEs allowed). `(order_id, line_no)` identifies a line. Offers for one line never share an `offered_ts`.

**Assumptions.** Categories, items, orders and decisions are hypothetical; the substitution rules (what counts as a substitution, how a missing response is read) are this exercise's rules, not any retailer's. Orders carry no customer identity; every figure is an aggregate.

**Clarifications.**
- Q: A milk line was substituted with oat milk from another category. Which category is it in? | A: The ordered item's category. The question is how well each category's shortages are covered.
- Q: Which week does an order picked up late on Sunday evening belong to? | A: The week of its UTC date, starting on Monday, so Sunday belongs to the week that started six days earlier.
- Q: Should a category-week with no substitutions show a rejection rate of 0? | A: No. `NULL`: nothing was offered, so there is no rate.
- Q: Does a short line with no offer count as substituted? | A: No. It is counted in `short_no_offer` instead (when the customer allowed substitutes).
- Q: How is the rate rounded? | A: `ROUND(rejected::numeric / substituted, 4)`, half away from zero.

**Hints.**
1. Pick each line's latest offer first: `DISTINCT ON (order_id, line_no) … ORDER BY order_id, line_no, offered_ts DESC, offer_id DESC`, or `ROW_NUMBER()`.
2. LEFT JOIN that to the lines of completed orders; a short line with no latest offer is a missed offer.
3. `date_trunc('week', …)` starts weeks on Monday. `NULLIF(substituted, 0)` gives the `NULL` rate.

**Follow-ups.**
1. The team wants a rejection rate per substitute item as well, to stop offering bad substitutes. What is the grain now, and what is the denominator?
2. Customers can also reject at handover in the store's local evening, while the week here is UTC. Which orders change weeks if you use each store's local date, and does that matter for a weekly trend?
3. Rejected substitutions are refunded and missed offers lose the sale. How would you turn both numbers into lost revenue, and which prices would you use?
4. At hundreds of millions of lines a month, offers keep arriving until handover. How would you build this incrementally without recounting closed weeks?

**Follow-up rules.**
- when: first offer, min(offered_ts), offer_id asc → ask: The picker offered one substitute, the customer rejected it, and a second was accepted. Which decision does your query use, and why?
- when: sub_item_id, substitute category → ask: Which category does a substituted line count in, and what would change if it were the substitute's?
- when: coalesce, null decision, decision is null → ask: What does a `NULL` decision mean here, and how did you count it?
- when: inner join, join sub_offers → ask: Does your join drop short lines that had no offer? Where do they show up in the result?
- when: count(*) / count, all short lines → ask: What is the denominator of `reject_rate`, and why not every short line?

**Evaluation Criteria.** The latest offer per line with a deterministic tie-break; substitutions only on short lines; missed offers by anti-join, honouring `allow_sub` at Very Hard; cancelled orders left out at Hard+; the ordered item's category; Monday weeks from the UTC date; `NULL` rate when nothing was substituted and correct rounding; can discuss per-substitute rates, local dates, lost revenue and incremental builds.

## WMT-L1-03: Phantom inventory suspects: stock on hand, but no sales for three days

| | |
|---|---|
| **Template ID** | WMT-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / date spines, netting per day, windows counted in open days, NOT EXISTS |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | WMT-L1-03.mjs |

**Business Scenario.** A store's system can say it has an item on hand while the shelf is empty: the units were miscounted, damaged or misplaced. Customers cannot buy what is not there, and replenishment does not reorder what it believes is on hand, so the item quietly stops selling. A useful first signal is an item that normally sells every day, still shows stock, and has not sold for three days. Store teams then check the shelf and correct the count.

**Problem Statement.** As of `{{as_of}}`, write one PostgreSQL query that lists the store-items that are **phantom inventory suspects** under this exercise's rule, returning `store_id, item_id, baseline_days_sold, baseline_units, on_hand`, ordered by `store_id, item_id`. For each store, the **check window** is its last 3 days up to and including the as-of date, and the **baseline** is the {{baseline_days}} days immediately before the check window. A day **sold** when the item's net `units` that day (the sum of its `sales` rows) is above 0. A store-item is a suspect when all three hold: its end-of-day `on_hand` is above 0 on each of the 3 check days; it sold on none of the check days; and it sold on at least {{min_days}} of the {{baseline_days}} baseline days. `baseline_days_sold` counts those baseline days, `baseline_units` sums its net units over the baseline days, and `on_hand` is the snapshot on the last day of the check window. {{sales_rule}} {{closure_rule}}

**Constraints.** One SQL statement (CTEs allowed). `sales` covers every day from `{{first_day}}` to the as-of date: a day with no row has 0 units. `inventory_snapshots` holds end-of-day counts for the last 7 days. Every store-item in `sales` is in scope.

**Assumptions.** Stores, items, units and thresholds are hypothetical. The suspect rule is this exercise's rule; real out-of-stock detection uses more signals (expected sales rates, deliveries, cycle counts). The output is a list of store-items to check, never a statement about any associate.

**Clarifications.**
- Q: A day has no `sales` row for the item. Is that a day without a sale? | A: Yes. No row means 0 units.
- Q: The item sold on exactly {{min_days}} baseline days. Is that enough? | A: Yes. "At least" includes the threshold.
- Q: What if the snapshot shows 0 on one of the check days? | A: Then the shelf really was empty that day (it sold out); the store-item is not a suspect.
- Q: Is the as-of date itself in the check window? | A: Yes. The check window ends on the as-of date (or, when stores close, on its last open day).
- Q: Does a day with a return count as a sale? | A: No. Only a day whose net units are above 0 sold.

**Hints.**
1. Build a spine of days per store (`generate_series`), and number them backwards from the as-of date with `ROW_NUMBER()`: numbers 1–3 are the check window, the next {{baseline_days}} the baseline.
2. Net the sales per store, item and day before deciding whether a day sold.
3. Count check days with a positive snapshot (a missing snapshot is not positive) and require all three; `bool_and` or a count of 3 both work.

**Follow-ups.**
1. Fast sellers can go three days without a sale by chance less often than slow ones. How would you replace the fixed "sold on at least {{min_days}} days" rule with a probability based on each item's daily sales rate?
2. A delivery arrived during the check window and the item still did not sell. Is that stronger or weaker evidence, and how would you use it?
3. After store teams correct the count, how would you measure whether the suspect list is precise enough to be worth their time?
4. At thousands of stores and hundreds of thousands of items, how would you compute this daily without scanning a month of sales each night?

**Follow-up rules.**
- when: lag, interval '3 days', current_date - 3 → ask: A store was closed on one of the last three days. Does your window count it, and should it?
- when: count(*), count(sale_id), exists → ask: A day has a sale and a return of the same units. Does your query count it as a sold day?
- when: left join inventory_snapshots, coalesce(on_hand → ask: A snapshot is missing for one check day. What does your query assume the stock was?
- when: greater than, more than → ask: An item sold on exactly {{min_days}} baseline days. Is it a suspect under your query?
- when: rows between, window frame → ask: Does your window frame count rows or days? What happens on a day with no sales row?

**Evaluation Criteria.** Windows defined as the last 3 and the preceding {{baseline_days}} days per store, counted in open days at Very Hard; sales netted per day and only a positive net counted as sold; stock positive on every check day, with a missing snapshot not positive; the inclusive threshold; days with no row treated as 0 units; correct outputs and order; can discuss probabilistic rules, deliveries, measuring precision and incremental computation.

## WMT-L1-04: Sales over any time range while voids and late register uploads keep correcting the past

| | |
|---|---|
| **Template ID** | WMT-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Fenwick (binary indexed) tree / point updates and range sums, transaction state for voids and corrections |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | WMT-L1-04.mjs |

**Business Scenario.** A store's sales dashboard answers questions such as "what did we sell between 2:15 and 3:40 last Tuesday?" over any range of minutes. The data is never final: registers that were offline upload their transactions late, into minutes already reported; voids cancel transactions that were already counted; and a register whose clock was wrong sends a correction that moves a transaction to its true minute. The dashboard must answer each question from the data as it stands at that moment.

**Problem Statement.** Implement `range_sales(n_minutes, ops)`. Minutes are numbered `0 … n_minutes − 1`. `ops` is processed in order; each is one of:
- `('sale', txn_id, minute, cents)`: a transaction of `cents` (a positive integer) at `minute`. Every sale's `txn_id` is unique.
- `('void', txn_id)`: the transaction no longer counts.
- `('move', txn_id, minute)`: the transaction's true minute is `minute`.
- `('query', lo, hi)`: the total cents of the counted transactions whose minute is in `lo … hi`, inclusive. `lo` and `hi` are valid minutes; when `lo > hi` the range is empty and the answer is `0`.

Return the list of query answers, in order. {{void_rule}}

**Constraints.** Up to about a year of minutes (`n_minutes` up to 600 000), 150 000 sales with their voids and moves, and 30 000 queries whose ranges can span months, interleaved. Expected: O((u + q) log n) for u updates and q queries. Re-adding every minute of a range for each query is too slow, and so is rebuilding prefix sums after every update.

**Assumptions.** Registers, transactions and amounts are hypothetical. Amounts are integer cents; taxes, tenders and returns are out of scope. The operations arrive in one ordered stream.

**Clarifications.**
- Q: A sale is uploaded late into a minute that an earlier query already covered. Does that earlier answer change? | A: No. Each query is answered from the data as it stands when it arrives; later queries see the late sale.
- Q: Is the range inclusive at both ends? | A: Yes. `('query', 5, 5)` is the single minute 5.
- Q: What does a query with `lo > hi` return? | A: `0`, an empty range. It is not an error.
- Q: Can a void be undone? | A: No. Once voided, a transaction never counts again, even if it is moved.
- Q: Can I keep a list of totals per minute and add up the range? | A: That is correct but O(range) per query; with ranges of months and tens of thousands of queries it is too slow.

**Hints.**
1. Separate two concerns: a dict from `txn_id` to its minute, amount and whether it still counts; and a structure over minutes that supports "add to one minute" and "total of a range".
2. A range total is `prefix(hi + 1) − prefix(lo)`. A Fenwick tree gives both prefix totals and point updates in O(log n).
3. A void subtracts the amount at its current minute; a move subtracts at the old minute and adds at the new one, but only while the transaction still counts.

**Follow-ups.**
1. Store managers also want the busiest 15-minute window in any range. What would you add to the structure, and what does an update cost then?
2. The dashboard needs totals per store and per department over any range. How does the structure grow, and when would you switch to a two-dimensional Fenwick tree or to pre-aggregated blocks?
3. Queries arrive at a few per second and updates at thousands per second. Which side would you make cheaper, and how?
4. In a warehouse, the same corrections arrive as files hours later. How would you keep minute totals correct and auditable there, and what do you lose compared with this in-memory structure?

**Follow-up rules.**
- when: sum(, slice, for m in range → ask: A query spans three months of minutes and there are 30,000 of them. How many additions does your loop do in total?
- when: prefix sum, accumulate, itertools → ask: Every query follows an update in this stream. How often do you rebuild the prefix sums, and what does each rebuild cost?
- when: segment tree → ask: A segment tree works here too. What would make you choose it over a Fenwick tree, and what does it cost in memory?
- when: void, voided → ask: A transaction is voided and then moved. What happens to the totals in your code?
- when: sqrt, block, bucket → ask: What is the cost per query and per update with your blocks, and how did you choose the block size?

**Evaluation Criteria.** A dict of transaction state plus a Fenwick (or segment) tree over minutes; inclusive ranges and `0` for `lo > hi`; voids and moves applied only to transactions that still count; repeated voids harmless; at Very Hard, voids that arrive before their sale and moves of unknown transactions handled as specified; O((u + q) log n); can discuss window maxima, more dimensions and read/write trade-offs.

## WMT-L1-05: Expiring stock: units of each delivered lot that expire unsold

| | |
|---|---|
| **Template ID** | WMT-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Queues / FIFO consumption per key with expiry, amortised analysis |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | WMT-L1-05.mjs |

**Business Scenario.** Fresh items arrive at a store in lots, each with its own expiry date. Under this exercise's rule, every sale takes units from the oldest lot of the item on the shelf, first in, first out. Units still on the shelf after their lot's expiry date are thrown away. The fresh team wants to know, lot by lot, how many units expired unsold, to tune order sizes and delivery days.

**Problem Statement.** Implement `expired_units(lots, sales, writeoffs, as_of)`.
- `lots`: `(lot_id, item, delivered_day, units, expiry_day)`, sorted by `delivered_day`; `delivered_day ≤ expiry_day`.
- `sales`: `(day, item, units)`, sorted by `day`.
- `writeoffs`: `(day, lot_id, units)`, sorted by `day`.

Days are integers, and every sale and write-off is on a day `≤ as_of`. On each day, the lots delivered that day arrive first, then the write-offs of that day apply, then the sales of that day happen in list order. A sale on day `d` takes units from the **oldest** lot of its item that has been delivered (`delivered_day ≤ d`), has not expired (`expiry_day ≥ d`) and has units left; the oldest is the earliest `delivered_day`, then the earlier position in `lots`. When that lot runs out the sale continues from the next oldest; units that no lot can supply are lost (not owed later). A lot's units still left at the end of its `expiry_day` expire. Return `{lot_id: expired units}` for every lot whose `expiry_day < as_of` (including lots with 0 expired units); lots that have not expired by `as_of` are left out. {{item_rule}} {{writeoff_rule}}

**Constraints.** Up to 50 000 lots and 150 000 sales over thousands of days, across several items. Expected: O(n + L) after the inputs, for n sales and L lots (plus the write-offs). Scanning the lots from the oldest on every sale is too slow.

**Assumptions.** Items, lots, units and shelf lives are hypothetical, and selling oldest-first is this exercise's rule; real stores rotate stock by hand and customers pick from the front or the back. Markdowns and transfers are out of scope.

**Clarifications.**
- Q: Can a lot be sold on its expiry day? | A: Yes. It is sellable through `expiry_day` and expires at the end of that day.
- Q: The oldest lot expires after a newer lot. Which one sells first? | A: The oldest, always; the rule is first in, first out, not first expiring.
- Q: A sale wants 10 units and only 6 are on the shelf. What happens to the other 4? | A: They are lost. Later deliveries do not fill them.
- Q: Is a lot with `expiry_day == as_of` in the result? | A: No. It can still be sold on `as_of`, so it has not expired yet.
- Q: Are lots with nothing expired in the result? | A: Yes, with 0, as long as their `expiry_day < as_of`.

**Hints.**
1. Keep a queue of lot ids per item. Deliveries go on the back; a sale looks only at the front.
2. A lot at the front that is sold out, or whose `expiry_day` is before today, can be removed for good: days only move forward, so it can never be sold again.
3. Once a lot is past its expiry day nothing touches it any more, so its units left at the end are exactly its expired units.

**Follow-ups.**
1. Change the rule to first expiring, first out (the lot with the earliest `expiry_day` sells first). Which data structure replaces the queue, and what does a sale cost now?
2. Explain why your solution is O(n + L) even though a single sale can walk through many lots.
3. The team wants to try "order 20% less on days before a slow day". How would you replay a year of sales with a different delivery plan, and what would you hold fixed?
4. Expiry is per lot, but stores record sales per item, not per lot. What do you lose by inferring lots with this rule, and how would you check it against counted waste?

**Follow-up rules.**
- when: for lot in lots, scan, next( → ask: A shelf has 10,000 lots behind it by the end of the year. How many lots does each sale look at in your code?
- when: pop(0), list.pop → ask: What does `pop(0)` cost on a Python list, and what would you use instead?
- when: heap, heapq, priority queue → ask: Which order does your heap use, and is that the rule here, oldest delivered or earliest expiry?
- when: expiry_day > d, expiry < day, expired → ask: A sale happens on a lot's expiry day. Does your code sell from that lot?
- when: writeoff, write-off, damaged → ask: A write-off arrives the day after the lot expired. What does it change in your code, and what should it change?

**Evaluation Criteria.** A queue of lots per item with sold-out and expired lots removed from the front for good; oldest-first across lots, including a newer lot that expires first; sellable through the expiry day; lost units not carried forward; correct inclusion rule for `as_of`; at Very Hard, write-offs by lot id, capped at what is left, ignored after expiry, before the day's sales; O(n + L) with an amortised argument; can discuss first-expiring-first-out and replaying alternative plans.
