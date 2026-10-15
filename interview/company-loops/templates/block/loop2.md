# Block · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of payments for
sellers and people: point of sale for sellers (in-person payments, items and
inventory, appointments, invoices, offline mode, deposits and transfers),
peer-to-peer payments, and buy-now-pay-later instalments. Every workload, number,
rule and schema is hypothetical, and nothing here describes how any company's
systems are actually built. Money is always integer minor units (cents). Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## BLK-L2-01: Earliest free slot in a staff member's calendar, booked as you go

| | |
|---|---|
| **Template ID** | BLK-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Segment trees / longest free run, first fit, lazy range assignment |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | BLK-L2-01.mjs |

**Business Scenario.** A salon takes appointments online. Clients pick a service, and the booking page offers the earliest time one staff member can fit it. In this exercise the calendar opens {{weeks}} weeks ahead (this exercise's rule; check current docs for real booking settings). The calendar is kept in whole minutes, and some minutes can never be booked: the hours the location is closed, the staff member's breaks and appointments already in the book. Requests arrive one after another, and each is booked before the next is answered, so two clients are never offered the same minutes.

**Problem Statement.** Implement `book_appointments(horizon, busy, requests)`. The calendar has `horizon` minutes, numbered from 0, and minute 0 is Monday 00:00 of the first week in the location's local time. `busy` is a list of `(start, end)` half-open ranges: minutes `start` to `end - 1` cannot be booked. Process `requests` in order. A request `("book", length)` books the earliest start `s` such that minutes `s` to `s + length - 1` are all free and `s + length <= horizon`. Those minutes stop being free, and the result is `s`. If no such start exists, nothing changes and the result is -1. {{busy_rule}} {{cancel_rule}} Return a list with one result per request, in request order.

**Constraints.** `horizon` is at most 80 640 (eight weeks). Up to 12 000 requests and 5 000 busy ranges. Every length is a whole number of minutes, at least 1. Each busy range satisfies `0 <= start < end <= horizon`. Once the calendar is full, most requests cannot fit. Scanning the minutes for every request is O(horizon) per request and is too slow; something close to O((B + R) · log horizon) for B busy ranges and R requests is expected.

**Assumptions.** Opening hours, breaks, service lengths and request volumes are hypothetical. One staff member, one location, one time zone. A booking needs no buffer before or after it. The earliest start is the only rule: no preference for mornings or for keeping gaps tidy.

**Clarifications.**
- Q: Can a booking start at a minute where a busy range ends? | A: Yes. Ranges are half-open, so `(60, 120)` leaves minute 120 free.
- Q: Are the busy ranges sorted, and can they overlap? | A: Neither is promised. They can arrive in any order, overlap and touch.
- Q: Can an appointment run across midnight or across a busy range? | A: Across midnight, yes, if every minute is free (it is a single minute line). Never across a busy minute.
- Q: What if a request is longer than the whole calendar? | A: Then it cannot fit, and its result is -1.
- Q: Does a request that fails change anything? | A: No. The calendar stays as it was.

**Hints.**
1. A request fits only if some free run is at least `length` long. What would you store per node of a tree over the minutes so that the longest free run inside the node is known?
2. Store, per node, the longest free run, the free run at its left edge and the free run at its right edge. A parent combines its children with `left.suffix + right.prefix` for the run that crosses the middle.
3. To find the earliest start, walk down from the root: go left if the left child holds a long enough run, take the crossing run if it is long enough, and go right otherwise. Booking and freeing are range assignments, so you need lazy propagation.

**Follow-ups.**
1. A sorted list of free gaps also works. When is it faster than the tree, and what calendar makes it slow?
2. A service needs 10 minutes of clean-up after it, which another booking may not use but which may overlap closing time. What changes?
3. A client may book with any of several staff members, and the earliest start across all of them wins, ties to the staff member listed first. How do you answer without querying every calendar in turn?
4. Bookings arrive from several web servers at once. Where does the earliest-fit decision have to be serialised, and what does a client see when two of them race for the same minutes?

**Follow-up rules.**
- when: range(horizon), minute by minute, scan every minute, linear scan → ask: Once the calendar is full, every request scans all {{weeks}} weeks of minutes and fails. How many steps is that for 12 000 requests, and how could you answer "nothing fits" in one step?
- when: free gaps, gap list, free intervals, insort → ask: How many gaps does the list hold in the worst case, and what calendar would make every request walk past most of them?
- when: segment tree, lazy, longest free run → ask: Why do you need a node's prefix and suffix free runs as well as its longest run? Give two children whose longest runs are both too short while their parent can still fit the request.
- when: bytearray, .find(, bytes( → ask: Your search runs in C, but what is its complexity per request, and what happens if the calendar is kept in seconds instead of minutes?
- when: heap, heapq → ask: A heap gives the longest gap, not the earliest one that fits. How do you get the earliest start that fits from it?

**Evaluation Criteria.** Half-open ranges, unsorted and overlapping busy ranges, and the horizon end all handled; earliest start, not best fit; failed requests leave the calendar unchanged; (Very Hard) cancellations free exactly the booking's minutes once and return -1 for failed or repeated cancels; a structure that answers "nothing fits" quickly and finds the earliest fit in logarithmic time, such as a segment tree of free runs with lazy assignment; a clear complexity argument, including when a gap list is good enough.

## BLK-L2-02: Which open invoices does a lump payment cover?

| | |
|---|---|
| **Template ID** | BLK-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Meet in the middle / exact subset sums, counting matches, ambiguity |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | BLK-L2-02.mjs |

**Business Scenario.** A seller sends invoices to a business customer and has up to {{max_open}} of them open at once. The customer sometimes pays several invoices with one bank transfer and does not say which ones. The seller's bookkeeping assistant wants to mark the right invoices as paid, but only when there is exactly one set of open invoices the transfer can be paying. If several sets fit, a person decides. If none fits, the transfer is a partial payment or a mistake, and that is a different workflow.

**Problem Statement.** Implement `match_invoices(invoices, payment)`. `invoices` is a list of `(invoice_id, amount)` open items with unique ids, and `payment` is the transfer amount, at least 1. All amounts are integer cents. Count the different sets of open items whose amounts add up to exactly `payment`. Two sets are different when they contain different invoice ids, even if their amounts are the same. Return `(count, ids)`, where `ids` lists the invoice ids of the only matching set, in the order they appear in `invoices`, when `count == 1`, and `[]` otherwise. {{amount_rule}} {{credit_rule}}

**Constraints.** Up to {{max_open}} open items. Amounts are up to $250 000 in cents, so payments reach hundreds of millions of cents and a table indexed by every sum up to the payment does not fit. Trying all 2ⁿ sets is far too slow; something close to O(2^(n/2) · n) is expected.

**Assumptions.** Amounts, counts and customers are hypothetical. Every invoice is open for its full amount (no partial payments in this exercise). The transfer pays whole invoices, with no fee taken out and no rounding.

**Clarifications.**
- Q: Does the empty set count? | A: No. The payment is at least 1 cent, and the empty set adds up to 0.
- Q: Two invoices have the same amount. Is a set with the first one different from the set with the second? | A: Yes. They are different invoices, so the count includes both sets, and the result is ambiguous.
- Q: Why not return a matching set even when there are several? | A: Because the seller would mark the wrong invoices paid half the time. Ambiguity goes to a person, so you return the count and no ids.
- Q: Can the count be large? | A: Yes, with many similar amounts. Return the exact number.
- Q: In what order are the ids returned? | A: In the order the invoices appear in the input list.

**Hints.**
1. Split the invoices into two halves. Every set is a set from the left half plus a set from the right half.
2. List the 2^(n/2) sums of each half. For every left sum `s`, how many right sums equal `payment - s`? A dictionary of counts answers that in O(1).
3. If the total is exactly 1, remember which left subset gave the match. You can find the matching right subset afterwards, because its sum is unique.

**Follow-ups.**
1. Amounts are small, say under $50 each, and there are 300 invoices. Which approach would you use then, and why?
2. The customer may have taken an early-payment discount of up to 2% per invoice (this exercise's rule). How would you match with that tolerance, and what happens to ambiguity?
3. The customer often pays the oldest invoices first. How would you use that to rank several matching sets for the person reviewing them?
4. Thousands of sellers receive transfers every hour. How would you run this as a service, and which cases would you never try to match automatically?

**Follow-up rules.**
- when: itertools.combinations, every subset, all subsets, brute force → ask: How many sets are there with {{max_open}} open items, and how long would checking them all take at ten million a second?
- when: dp over sums, dp[, knapsack, bitset → ask: How large is your table when one invoice is $250 000, and can it count the matching sets, or only say whether one exists?
- when: backtracking, prune, sort descending → ask: Your pruning stops when the sum passes the payment. What happens to that rule {{credit_hint}}, and how many nodes does your search visit when the payment is about half the total?
- when: greedy, largest first → ask: Give three invoices and a payment where taking the largest invoice that fits first finds no match although one exists.
- when: dictionary, counter, hash map → ask: Your dictionary holds 2^(n/2) sums. How much memory is that for {{max_open}} items, and could a sorted list with two pointers use less?

**Evaluation Criteria.** Counts sets by invoice, not by amount; the empty set never matches; ids only when the count is exactly 1, in input order; (Very Hard) credit notes with negative amounts handled without pruning that assumes positive amounts; a meet-in-the-middle count with a hash map or sorted halves, with the reasoning for why a DP over sums and every-subset search both fail; integer cents throughout; a sensible view of when to match automatically and when to ask a person.

## BLK-L2-03: Debug the seller's daily sales summary

| | |
|---|---|
| **Template ID** | BLK-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Reporting code / local dates, offline payments, tips, refunds by day |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, staff-data-engineer |
| **Generator** | BLK-L2-03.mjs |

**Business Scenario.** A seller with locations in several countries opens the daily sales summary in their dashboard each morning. Support has passed on several complaints about it. A bar on the west coast sees last night's late sales on today's report. A café that ran in offline mode during a network outage sees yesterday's sales on today's report, when the device reconnected. Gross sales do not match the till because they include tips. A sale refunded this week changed a report the seller had already closed last week. A $5 partial refund on a $60 order wiped out the whole $60. The summary code below is the suspect.

**Problem Statement.** Fix `daily_summary(payments, refunds, locations)` so that it meets this specification. {{replay_rule}}
1. **`locations`** maps each location id to its fixed UTC offset in minutes, positive east of UTC (for example −300 for UTC−5 and 600 for UTC+10). A location's local date for a UTC timestamp is the calendar date of that timestamp plus the offset.
2. **`payments`** are dicts `{"id", "location", "taken_at", "forwarded_at", "amount", "tip", "status"}`. Timestamps are ISO 8601 strings in UTC. `amount` and `tip` are integer cents. `forwarded_at` is `None` for an online payment. For an offline payment it is when the device forwarded the payment after reconnecting, and `status` may then be `"declined"`. Only `"completed"` payments count. A payment belongs to the location's local date of `taken_at`.
3. **`refunds`** are dicts `{"payment", "refunded_at", "amount"}` for completed payments, in any order. A payment can have several partial refunds. A refund belongs to the local date of `refunded_at`, at the payment's location, and subtracts its own `amount`. Tips are never refunded in this exercise.
4. **Output.** A dict keyed `"<location>/<YYYY-MM-DD>"` for every location and local date with at least one completed payment or refund. Each value is `{"payments", "gross", "tips", "refunds", "net"}`: the number of completed payments, the sum of their amounts (tips excluded), the sum of their tips, the sum of refunds made that day, and `gross - refunds`, which can be negative.

**Constraints.** Keep the function's name, arguments and output format. All arithmetic stays in integer cents. Up to 200 000 payments, processed in linear time.

**Assumptions.** Offsets are fixed for this exercise, with no daylight-saving changes. Amounts, locations and timings are hypothetical, and how long a device may stay offline is this exercise's rule (check current docs for real limits). Refunds never exceed what was paid.

**Clarifications.**
- Q: Which day does an offline payment belong to? | A: The day it was taken. Forwarding only tells the processor about it later.
- Q: If a refund on Thursday is for a sale on Monday, does Monday's summary change? | A: No. Monday stays as the seller closed it, and Thursday shows the refund. That day can have a negative net.
- Q: Are tips part of gross sales? | A: No. They are reported in their own column and belong to the staff, not to sales.
- Q: Which offset applies to a refund? | A: The offset of the location where the payment was taken.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Work out the local date of `2026-10-06T02:00:00+00:00` for a location at −300 by hand, then call the helper.
2. Read every line that touches `gross` and `refunds`: which amount does each one add?
3. Where does the refund loop get its day from?

**Follow-ups.**
1. A location moves from UTC−5 to UTC−4 when daylight saving starts. What would you store instead of a fixed offset, and which days could change?
2. The summary is precomputed every night. An offline payment taken yesterday is forwarded this morning. Which rows do you recompute, and how does the seller learn that yesterday changed?
3. A seller asks for "sales by the hour" across all locations in one chart. Whose local time do you use, and what does the chart look like on a day the clocks change?
4. Gross sales must reconcile to the money deposited to the seller's bank account. List the reasons the two numbers differ on a given day.

**Follow-up rules.**
- when: [:10], utc date, date in utc, utcfromtimestamp → ask: A seller in Sydney closes at 22:00 local time. Which UTC date do those sales fall on, and which date does the seller expect?
- when: zoneinfo, pytz, daylight saving → ask: With named time zones, a local day can have 23 or 25 hours. What does your summary report for those days, and what do you key rows by?
- when: forwarded_at, offline → ask: An offline payment is declined when it is finally forwarded. What did the seller's device show at the time, and what does the summary show now?
- when: restate, sale day, original day → ask: If refunds restated the sale's day, how would a seller's closed books from last week change, and who would notice?
- when: float, decimal, / 100 → ask: Where does your code divide money, and what type comes out? Keep the report in integer cents and say where formatting belongs.

**Evaluation Criteria.** Finds and explains every bug with its seller-facing symptom; local dates from the location's offset with the right sign; offline payments dated by when they were taken; declined payments excluded; tips reported apart from gross; refunds on their own local date and for their own amount; integer cents throughout; minimal, linear fixes, with a test per bug.

## BLK-L2-04: Item library and inventory across locations and channels

| | |
|---|---|
| **Template ID** | BLK-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / catalogue sync, per-location overrides, stock counts, conflicts |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "sellers": {"2": ["150,000", "400,000"], "3": ["2 million", "5 million"]},
  "max_locations": [5, 60, 300],
  "max_items": ["3,000", "25,000", "200,000"],
  "sync_target": ["5 seconds", "30 seconds", "2 minutes"]
}
```

**Business Scenario.** A point-of-sale platform serves about {{sellers}} sellers. Each seller keeps one item library: items, variations (size, colour), prices, modifiers and categories, up to {{max_items}} items for the largest. A seller can have up to {{max_locations}} locations, and a location can override an item's price, hide an item or track its own stock. The same items are sold in person on registers and tablets, and online through the seller's online store. When a seller changes a price, it should reach every register and the online store within {{sync_target}}. When the last unit sells in a shop, the online store should stop selling it soon after.

**Problem Statement.** Design how the item library and stock counts are stored, changed and synced across locations and channels, and how they reach analytics. Cover the data model for items, variations, per-location overrides and stock; how a change made on one device or in the dashboard reaches the others; how stock changes from sales, returns, receiving and manual counts are recorded; what happens when two edits conflict; how the online store avoids selling stock that a shop has just sold; and the tables analysts use for sales by item and stock over time.

**Constraints.** Registers may be offline for hours and must keep selling. Stock can go negative when a shop sells an item the system thought was out of stock, and that must be visible, not hidden. Edits come from the dashboard, from registers, from the online store and from bulk imports of thousands of rows. Analytics must answer "how many units of this variation did location X have at 18:00 last Friday?"

**Assumptions.** All volumes, limits and targets are hypothetical. You may use common building blocks: a relational store, a change stream, a cache, a message queue and a warehouse. Price and stock rules here are this exercise's rules; check current docs for any real product behaviour.

**Clarifications.**
- Q: Is stock tracked per item or per variation? | A: Per variation and per location. An item with three sizes has three stock counts at each location.
- Q: What does a location override look like? | A: A price, a visibility flag or a tax setting for one variation at one location. Anything not overridden comes from the library.
- Q: What happens when a register sells offline? | A: It records the sale and a stock decrement locally and uploads both when it reconnects, possibly hours later.
- Q: Who wins when two people edit the same price at once? | A: You decide and explain it. The seller must be able to see what happened.
- Q: Does the online store have its own stock? | A: In this exercise it sells from one location's stock, chosen by the seller.

**Hints.**
1. Separate the item definition (rarely changes, read everywhere) from stock (changes on every sale). They have different write rates and different conflict rules.
2. Store stock as a log of changes with reasons (sale, return, receive, count, adjustment) and derive on-hand counts from it. A physical count sets the value at a moment; it is not a delta.
3. Give every library change a version per seller, and let each device ask for "everything since version N".

**Follow-ups.**
1. A register comes back online after four hours with 300 sales. Walk through what happens to stock, the online store and the dashboard.
2. A stock count at 09:00 says 12 units, but a sale recorded offline at 08:55 arrives at 11:00. What is on hand now, and why?
3. A bulk import changes 40 000 prices at once. How do registers receive it without stalling, and what happens to a sale rung up halfway through?
4. Analysts want "stock at 18:00 on any day" for every variation and location. Do you store snapshots, replay the change log, or both, and what does each cost at {{max_items}} items?

**Follow-up rules.**
- when: last write wins, lww, timestamp wins → ask: Two devices with clocks 90 seconds apart edit the same price. Which edit wins under your rule, and what does the seller see?
- when: crdt, counter → ask: A counter merges sales from many devices, but a physical count sets the value to 12. How does your structure represent a "set" that must override earlier deltas but not later ones?
- when: snapshot, nightly snapshot → ask: An offline sale from yesterday afternoon arrives this morning. Which snapshots are now wrong, and how do you fix them?
- when: reserve, reservation, hold → ask: Who holds stock for an online order that has not been picked yet, and what happens if a shop sells that unit in the meantime?
- when: cache, redis → ask: A price changes and one register still shows the old one from cache. How long can that last, and what price does the sale record?

**Production Reality Check.**
- A seller with {{max_locations}} locations bulk-imports a new price list at 08:55. Registers opening at 09:00 show a mix of old and new prices for twenty minutes.
- A shop's register is offline all afternoon on a busy day. When it reconnects, the online store has sold eight units that the shop had already sold, and that location's on-hand count goes to −8.

**Evaluation Criteria.** Item definitions separated from stock; per-variation, per-location stock derived from a change log with reasons; physical counts treated as set-at-a-time events; a versioned change feed per seller for devices; explicit conflict rules with an audit trail the seller can see; offline sales merged without hiding negative stock; a clear answer on overselling between shops and the online store; analytics tables for sales by item and stock at a point in time; a plan for each incident.

## BLK-L2-05: Peer-to-peer payment events into analytics, with the right final state

| | |
|---|---|
| **Template ID** | BLK-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Event pipelines / state machines, out-of-order and duplicate events, late reversals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_payments": {"2": ["15 million", "40 million"], "3": ["120 million", "300 million"]},
  "reversal_window": ["72 hours", "14 days", "60 days"],
  "freshness": ["10 minutes", "1 hour"],
  "client_kinds": [3, 5]
}
```

**Business Scenario.** A peer-to-peer payments app lets people send money to each other. About {{daily_payments}} payments are made a day. Events about each payment come from {{client_kinds}} kinds of producers, such as the phone apps, the web app and the service that moves the money. In this exercise's model a payment is `sent`, may be `pending` (for example while the recipient has not accepted it), and then becomes `completed` or `cancelled`. A completed payment can still be `reversed` up to {{reversal_window}} later (this exercise's rule). Product and finance teams want dashboards, refreshed every {{freshness}}, of payment counts and amounts by state, day and region, and they need the totals to match what actually happened. Individual people's payments never appear in analytics outputs; only aggregates do.

**Problem Statement.** Design the pipeline that turns these events into analytics tables. Cover the event contract (what every producer must send), how duplicates and out-of-order events are handled, how the current state of each payment is derived, how late reversals and corrections change totals that were already published, what the published tables look like at their grain, how the pipeline is backfilled and rerun, and how you show that the published totals are right.

**Constraints.** Events from phones can arrive hours late, after the phone reconnects. The same event can arrive more than once. A `completed` event can arrive before its `pending` event. Totals for a day can change after the day ends, and finance must know when and why. Amounts are integer minor units in the payment's currency. No table that analysts query may expose one person's payments.

**Assumptions.** Volumes, windows and freshness targets are hypothetical. The service that moves the money is the authority on whether a payment completed, and it emits an event for every change it makes. Phone and web events describe what the person saw and did. You may use common building blocks: a partitioned log, a stream processor, object storage, a warehouse.

**Clarifications.**
- Q: Which source decides the final state? | A: The money-movement service. Client events add context, such as where in the app the payment started, and never override it.
- Q: Can a payment go from cancelled to completed? | A: Not in this exercise's model. If events say so, that is a data problem to flag, not a state to show.
- Q: Which day does a payment belong to? | A: You choose and explain it: the day it was sent, the day it completed, or both, for different questions. A reversal belongs to its own day for some reports.
- Q: Do dashboards show individual payments? | A: No. Only aggregates, with small groups suppressed or combined.
- Q: How late can an event be? | A: Client events up to two days; a reversal up to {{reversal_window}} after completion.

**Hints.**
1. Give every event a stable event id and every payment a payment id, and decide which fields are the payment's state and which are context.
2. Define the allowed transitions and a rank for each state, so that applying events in any order ends in the same state. Keep the event history so that you can explain the state.
3. Keep "as of now" totals separate from "as first published" totals, so that changes to past days are visible as changes.

**Follow-ups.**
1. A `completed` event arrives before `sent` and `pending`. Walk through what your state table holds after each event.
2. A reversal arrives {{reversal_window}} after a payment completed, at the very end of the window. Which published numbers change, and how does a finance analyst see the change?
3. One phone app version sends every event twice with different event ids. How do you notice, and how do you fix the totals?
4. Leadership wants "payments completed in under a minute" as a metric. Which events and timestamps do you trust for it, and why not the phone's clock?
5. At {{daily_payments}} payments a day, recomputing every payment's state from history each run is too slow. What do you keep incrementally, and how do you rerun one day from scratch?

**Follow-up rules.**
- when: latest event wins, last event, order by timestamp → ask: Events from the phone and from the money-movement service disagree, and the phone's clock is ahead. Which state does your rule pick, and is it right?
- when: dedupe, deduplicate, event_id → ask: How long do you remember event ids, and what happens to a duplicate that arrives after that window?
- when: watermark, window, late data → ask: A reversal arrives {{reversal_window}} after the payment. Your stream window closed long ago. Where does that change land?
- when: user_id, per user, per person → ask: Which tables contain a person's identifier, who can query them, and how do the published tables avoid showing one person's activity?
- when: exactly once, transactional → ask: Exactly-once delivery inside the pipeline does not stop a producer from sending the same fact twice. What does?

**Production Reality Check.**
- A phone app release sends `cancelled` instead of `completed` for one screen's payments; client events and money-movement events disagree for 3% of payments for six hours.
- A batch of reversals is processed late, with reversal times up to {{reversal_window}} in the past, and the published completed amount for the days they touch drops by 0.4% overnight.

**Evaluation Criteria.** A clear event contract with event ids, payment ids and the authoritative source; a state machine whose result does not depend on arrival order, with invalid transitions flagged; deduplication with a stated memory window; late reversals applied to the right day with "first published" versus "current" totals; tables at a stated grain with privacy-preserving aggregates; deterministic reruns and backfills; reconciliation against the money-movement service as proof of correctness; a plan for each incident.
