# Amazon · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an online
marketplace with first- and third-party sellers, a fulfilment and delivery network,
and public cloud services. Every workload, number, schema and incident is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## AMZ-L2-01: Cheapest shipment plan for a multi-item order

| | |
|---|---|
| **Template ID** | AMZ-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / subset DP over bitmasks, split shipments |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | AMZ-L2-01.mjs |

**Business Scenario.** A customer buys several different items in one marketplace order. Several fulfilment centres each stock some of those items. Shipping a package from a centre costs a fixed package cost (picking, packing, the box and the carrier's base charge) plus a per-item cost that depends on the item and on how far that centre is from the customer. The order may be split into several packages from different centres. Before the order is released to the centres, a routing step must choose the cheapest way to ship it.

**Problem Statement.** Implement `plan_shipments(items, centres, max_items=None)`. `items` is a list of distinct SKUs, one unit each. `centres` is a list of `(centre_id, package_cost, units)`, where `units` maps each SKU the centre can ship to its per-item cost. A plan puts every item in exactly one package. A package comes from one centre, holds only items that centre stocks, and costs `package_cost` plus the per-item costs of its items. A centre may send more than one package, and each one pays the package cost. Return `(total_cost, packages)` for the cheapest plan. If two plans cost the same, return the one with fewer packages. An empty order returns `(0, 0)`. If an item is stocked by no centre, return `None`. {{stock_rule}} {{box_rule}}

**Constraints.** Up to 13 items in an order and 40 centres. All costs are non-negative integers in cents, below 10 000. A centre's `units` may list SKUs that are not in this order. Something close to O(m · 2ⁿ + 3ⁿ) is expected for n items and m centres. Trying every assignment of items to centres is not fast enough.

**Assumptions.** All costs are hypothetical. Every centre that lists a SKU has the one unit this order needs. Delivery speed is the same from every centre in this exercise, so only cost matters.

**Clarifications.**
- Q: Can one centre send two packages? | A: Yes, and each pays the package cost. Without a box limit that is never cheaper than one package, but with `max_items` it can be necessary.
- Q: Does a centre's dict say how many units it has? | A: No. Listing a SKU means the centre can ship the one unit this order needs.
- Q: If two plans cost the same, which do I return? | A: The one with fewer packages. The answer is just the pair (cost, packages), so it is unique even when several plans tie.
- Q: Does the order of `items` or `centres` matter? | A: No. The answer does not depend on either order.
- Q: What do I return for an order with no items? | A: `(0, 0)`.

**Hints.**
1. With 13 items there are 8 192 subsets. For each subset, what is the cheapest single package that could carry exactly those items?
2. Let `best[mask]` be the cheapest way to ship the items in `mask`. The lowest item in `mask` is in some package. Try every package that contains it, and add `best` of the items that remain.
3. Compare `(cost, packages)` pairs as tuples, or pack them into one integer so that a single comparison orders both.

**Follow-ups.**
1. Your plan is the cheapest, but it splits an order into four boxes and customers prefer fewer. How would you add a per-package penalty or a hard limit on packages, and what changes in your DP?
2. Centres have limited units, and thousands of orders are planned in the same minute. Why is planning each order on its own no longer optimal, and what would you do instead?
3. Different centres give different delivery dates. How do you find the cheapest plan that still meets the date promised to the customer?
4. Orders with 40 items appear, and the subset DP is out of reach. What would you do, and how would you measure how far from optimal your plans are?

**Follow-up rules.**
- when: greedy, cheapest centre, cheapest per item → ask: Give an order where shipping each item from its cheapest centre is not the cheapest plan. What does the package cost do to a per-item greedy choice?
- when: itertools.product, every assignment, all assignments, brute force → ask: How many assignments are there with 13 items and 40 centres, and how long would that take?
- when: subsets of centres, combinations of centres, set of centres → ask: Choosing the set of centres first works without a box limit. What breaks when max_items is set, and how large is 2^m with 40 centres?
- when: lru_cache, memo, recursion → ask: How many states does your memo hold, and how many transitions does each state try? Write the total.
- when: float('inf'), math.inf → ask: You use floating-point infinity next to integer cents. Where could a float sneak into the total, and how would you keep the answer exact?

**Evaluation Criteria.** Correct (cost, packages) with fewest packages on cost ties; `None` for an item no centre stocks and `(0, 0)` for an empty order; packages limited to items their centre stocks; box limit applied per package, with several packages from one centre allowed; a subset DP that precomputes the cheapest single package per subset and fixes the lowest item to avoid counting a partition twice; integer arithmetic; a clear complexity argument; sensible answers on capacity, delivery dates and large orders.

## AMZ-L2-02: Earliest arrival through scheduled linehauls

| | |
|---|---|
| **Template ID** | AMZ-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / time-dependent shortest paths, schedules and binary search |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | AMZ-L2-02.mjs |

**Business Scenario.** A package becomes ready to leave a fulfilment centre at a known minute. It moves through sort centres to the delivery station that serves the customer, on scheduled linehaul trucks. Each lane between two nodes has departures at fixed minutes, and each departure has its own transit time. At every sort centre the package needs some handling time before it can leave again. The delivery date shown to the customer depends on the earliest minute the package can reach the delivery station, so this calculation runs for every package.

**Problem Statement.** Implement `earliest_arrival(lanes, handling, origin, dest, ready, daily=False)`. `lanes` is a list of `(from_node, to_node, departures)`, and `departures` is a list of `(depart_minute, transit_minutes)`. A package at a node can take a departure if `depart_minute` is at or after the minute the package is ready at that node. At `origin` it is ready at `ready`. At any other node it is ready at its arrival minute plus `handling.get(node, 0)`. A departure arrives at `depart_minute + transit_minutes`. Return the earliest minute the package can arrive at `dest`, with no handling added there, or `None` if no sequence of departures reaches it. If `origin == dest`, return `ready`. {{schedule_rule}} {{daily_rule}}

**Constraints.** Up to 5 000 nodes, 40 000 lanes and 20 departures per lane. Every transit time is at least 1 minute. Departures are not sorted, and two lanes may join the same pair of nodes. Something close to O(D log D + L log N) is expected, for D departures, L lanes and N nodes.

**Assumptions.** The network, schedules and handling times are hypothetical. Trucks have unlimited room. A package may wait at any node for as long as it needs. Handling time at a node is the same for every package.

**Clarifications.**
- Q: Can the package take a departure at exactly the minute it becomes ready? | A: Yes. A departure can be taken when `depart_minute` is greater than or equal to the ready minute.
- Q: Is handling time added at the origin or at the destination? | A: No. At the origin the package is ready at `ready`, and the answer is the arrival minute at the destination.
- Q: Are a lane's departures sorted? | A: No, and two departures may leave at the same minute.
- Q: Can two lanes join the same two nodes? | A: Yes, for example two carriers. Consider both.
- Q: Is arriving earlier at a sort centre always at least as good as arriving later? | A: Yes, because the package can wait. That property is what makes an efficient algorithm possible.

**Hints.**
1. Because the package can wait, arriving earlier at a node never hurts. That is the property Dijkstra's algorithm needs, with arrival minutes as distances.
2. For one lane, the best arrival when the package is ready at `t` is the smallest `depart + transit` over departures at or after `t`. That is not always the next departure. Sort the departures, keep suffix minima, and binary search for `t`.
3. With daily schedules, only today's remaining departures and tomorrow's departures can matter. Any later day offers the same departures, only later.

**Follow-ups.**
1. Trucks have limited room, and packages compete for the last slots on a departure. Does your algorithm still give a correct promise, and what would you change?
2. Transit times vary from day to day. How would you promise a date that holds 95% of the time, and what data would you need?
3. This runs for millions of packages an hour from a few hundred origins. What would you precompute, and how would you keep it fresh when schedules change?
4. A linehaul is cancelled two hours before departure. How do you find the packages whose promise is now at risk, and what do you recompute?

**Follow-up rules.**
- when: next departure, first departure, bisect → ask: The next departure leaves at minute 600 and arrives at 900. A later one leaves at 630 and arrives at 720. Which one does your code take, and why?
- when: bfs, fewest hops, deque → ask: BFS finds the route with the fewest hops. Show a case where that route arrives later than another one.
- when: bellman, relax every lane, until nothing changes → ask: How many passes does that take on a route of 3 000 hops, and how much work is each pass?
- when: modulo, % 1440, divmod → ask: A transit takes 1 500 minutes and the package is ready at minute 1 430. Does your arithmetic still give the right day?
- when: heapq, dijkstra, priority queue → ask: Dijkstra needs a property of the edge costs. State it for this problem, and say what would break it.

**Evaluation Criteria.** Inclusive departure rule; handling only at intermediate nodes; `None` when unreachable and `ready` when origin equals destination; the earliest arrival over all catchable departures, not just the next one; Dijkstra on arrival time, justified by waiting being allowed; sorted departures with suffix minima and binary search; correct day arithmetic for daily schedules and transits longer than a day; a credible answer on capacity, uncertainty and recomputation.

## AMZ-L2-03: Debug the fulfilment-centre inventory reservation processor

| | |
|---|---|
| **Template ID** | AMZ-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / reservations, state checks, boundaries, keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | AMZ-L2-03.mjs |

**Business Scenario.** When a customer places an order, the marketplace reserves units at a fulfilment centre so that the same unit is not promised twice. Shipping consumes the reservation, and cancelling releases it. The availability shown to customers is units on hand minus units reserved. Operations has raised several complaints about one processor. Some centres show units reserved for orders that shipped weeks ago. The last unit of popular items is never sold. A centre that is oversold after a damage write-off shows 0 available, not a negative number. Multi-item orders leave one line reserved after the customer cancels the other line. Availability creeps upward when customers press cancel twice. The processor below is the suspect.

**Problem Statement.** Fix `process_inventory(events)` so that it meets this specification. `events` is a list of dicts in commit order for one region. {{replay_rule}}
1. **`receive`** `{"type", "fc", "sku", "qty"}` adds `qty` to `on_hand` at that centre for that SKU. **`adjust`** has the same shape, and its `qty` may be negative, for example damaged units. It changes `on_hand` only, never a reservation, so availability may become negative.
2. **`reserve`** `{"type", "order", "fc", "sku", "qty"}` is one order line. It is accepted if and only if `qty` is at most the available units (`on_hand − reserved`) for that centre and SKU. If accepted, `reserved` increases by `qty`. If not, `[order, sku]` is appended to `rejected`. An order can have several lines, at most one per SKU, and a line is identified by `(order, sku)`.
3. **`cancel`** `{"type", "order", "sku"}` releases the line's reservation (`reserved −= qty`) only if the line is currently reserved, and the line becomes cancelled. A cancel for a line that is shipped, already cancelled, rejected or unknown changes nothing.
4. **`ship`** `{"type", "order", "sku"}` applies only to a currently reserved line. It removes the units from stock: `on_hand −= qty` and `reserved −= qty`. The line becomes shipped.
5. **Output.** `{"stock": {"<fc>/<sku>": {"on_hand", "reserved", "available"}}, "rejected": [[order, sku], ...]}`. `stock` has an entry for every centre and SKU named in a `receive`, `adjust` or `reserve` event. `available` is `on_hand − reserved`, reported as is, even when negative. `rejected` is in event order.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events, processed in linear time.

**Assumptions.** Event types and quantities are hypothetical and simplified. Each event is delivered once and in order. Returns are a separate flow and do not appear here.

**Clarifications.**
- Q: Can availability be negative? | A: Yes, after a negative adjustment. Report it as is: a negative number tells operations the centre is oversold.
- Q: Is an order line identified by its order id? | A: By `(order, sku)`. One order can reserve several SKUs.
- Q: Can a rejected line be cancelled or shipped later? | A: No. A cancel or ship for a rejected or unknown line is ignored.
- Q: What does a cancel after shipping do? | A: Nothing. Returns are handled elsewhere.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Write out `on_hand`, `reserved` and available after receive 5, reserve 2, ship. Then compare with what the code reports.
2. Read the availability check at its boundary: there are 3 units, and someone reserves 3.
3. What identifies a line? Make an order with two SKUs and cancel only one of them.
4. List the states a line can be in, and the states a cancel may move it out of.

**Follow-ups.**
1. Two order services reserve the last unit at the same moment, in different processes. Where do you serialise, and what does a conditional `UPDATE … WHERE on_hand - reserved >= :qty` give you?
2. After a consumer restart, the event stream is redelivered from an earlier offset. Which events are already safe to apply twice, and what would you add for the others?
3. Reservations from abandoned checkouts never receive a cancel. How would you expire them, and what goes wrong if you expire them too early?
4. A centre shows negative availability after a damage write-off. Which orders should be moved to another centre first, who decides, and what does the customer see?

**Follow-up rules.**
- when: lock, mutex, threading, concurrent → ask: Your lock is inside one process. What happens when two hosts process events for the same SKU, and what key would you partition the stream by?
- when: max(0, clamp, never negative → ask: Who needs to see a negative availability number, and what decision would they make with it?
- when: composite key, tuple key, order and sku, order_id and sku → ask: What happens if the same SKU appears on two lines of one order, and how would you change the key if that became allowed?
- when: redelivery, replay, idempotent, duplicate → ask: Is a ship event safe to apply twice with your fix? Is a receive? What would you store to make receives safe?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; a ship releases the reservation as well as stock; the last unit can be reserved; negative availability is reported, not clamped; lines keyed by (order, sku); a cancel releases only a reserved line; the fix stays minimal and linear; adds a test per bug.

## AMZ-L2-04: Reconciling marketplace orders, payment settlements and refunds

| | |
|---|---|
| **Template ID** | AMZ-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / batch matching, late data, re-issued reports, idempotent reruns |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_orders": {"2": ["3 million", "8 million"], "3": ["40 million", "90 million"]},
  "sellers": ["20,000", "150,000", "600,000"],
  "settlement_cycle": ["every 7 days", "every 14 days"],
  "currencies": [4, 12, 21],
  "refund_window": ["30 days", "90 days"]
}
```

**Business Scenario.** A marketplace takes about {{daily_orders}} orders a day from first- and third-party sellers, in {{currencies}} currencies. A customer's payment is charged when items ship, so an order split into three shipments has three charges. Third-party sellers are paid their proceeds, sales minus marketplace fees, in settlements {{settlement_cycle}}, and each settlement comes with a report of the lines it covers. Refunds for returns can come up to {{refund_window}} after the sale, often in a later settlement period than the sale itself. Finance wants a daily answer for every order line: was it charged, was the seller settled, and was a refund handled correctly?

**Problem Statement.** Design the pipeline that reconciles three sources every day: order and shipment events from the marketplace, charges and refunds from the payment processor, and settlement reports for {{sellers}} sellers. Cover how each source lands and is versioned, the keys you match on and at what grain, the states a line can be in (matched, timing difference, amount mismatch, missing on one side), partial shipments and partial refunds, currencies, re-issued reports, reruns and backfills that give the same answer for the same inputs, and the outputs finance and seller support use.

**Constraints.** Amounts are integer minor units in the transaction currency. A settlement report for a period can be re-issued with corrections. Payment files can arrive up to a day late and occasionally twice. Any past day must be re-runnable without double counting. Every unmatched line must carry a reason a person can act on.

**Assumptions.** All volumes, cycles, windows and fee structures are hypothetical. Each charge and refund from the payment processor carries the marketplace's own shipment or refund reference. Settlement reports list one row per order line, fee or adjustment with an amount and a type.

**Clarifications.**
- Q: Is the grain the order, the shipment or the line? | A: Charges happen per shipment, settlement rows are per line and fee, and refunds are per returned line. You choose the matching grain, and you must explain it.
- Q: How late can a refund be? | A: Up to {{refund_window}} after the sale, and it can land in any later settlement period.
- Q: What does a re-issued settlement report look like? | A: The same seller and period with a new version number. Some rows change, some are added and some disappear.
- Q: Do amounts ever differ legitimately? | A: Yes. Currency conversion for settlement, rounding of fees per line versus per order, and partial refunds all cause differences you must explain, not hide.
- Q: Who reads the output? | A: Finance needs totals and ageing of breaks. Seller support needs to explain one seller's settlement line by line.

**Hints.**
1. Land every file as received, immutable and versioned, before you transform anything. A rerun should read exactly the versions it read the first time unless you ask for newer ones.
2. Match at the finest grain all three sources share, then roll up. A timing difference is a state with an expected resolution date, not a break.
3. Make each day's result a pure function of its inputs: rebuild a day's partition and overwrite it, never append to it.

**Follow-ups.**
1. A settlement report for a closed period is re-issued with corrected fees. What does your pipeline recompute, and what does finance see about the change?
2. An order line was shipped in two shipments and refunded in part twice. Walk through the rows each source produces and how they match.
3. Settlement happens in a different currency from the sale. Where does conversion happen, which rate do you use, and how do you separate a conversion difference from a real break?
4. Finance asks for the first day's results to be reproduced exactly, six months later, for an audit. What must you have kept?
5. Matching at {{daily_orders}} orders a day takes longer every week because unmatched lines accumulate. How do you bound the work?

**Follow-up rules.**
- when: order_id, join on order, order level → ask: An order has three shipments, one cancelled line and one partial refund. What does a join at the order level hide?
- when: append, insert into, incremental load → ask: Day 12 is rerun after a late payment file. How does your table avoid counting day 12's matches twice?
- when: float, double, decimal → ask: Which amounts in your pipeline are stored as what type, and where could a fraction of a minor unit appear?
- when: exchange rate, fx, conversion → ask: Which day's rate do you use for a refund that is 60 days after the sale, and does the seller's settlement agree?
- when: latest version, overwrite, replace report → ask: A re-issued report replaces the old one. How do you still explain to a seller why last month's statement changed?

**Production Reality Check.**
- Settlements run {{settlement_cycle}}. One period's report for one currency is re-issued three days after it was matched, with corrected fee rows, and finance has already closed that period.
- The payment processor's refund file for one day arrives twice; the second copy has 2% more rows because late refunds were added.
- A deploy changes the format of shipment references. For one day, charges stop matching shipments and the break count jumps by two orders of magnitude.

**Evaluation Criteria.** Immutable, versioned landing of all three sources; a matching grain justified by how charges, settlements and refunds are actually produced; explicit states including timing differences with expected resolution; partial shipments and refunds handled per line; currency differences separated from breaks; deterministic, overwrite-by-partition reruns; versioned settlement reports with change explanations; outputs designed for both finance and seller support; a plan for each incident.

## AMZ-L2-05: Centralised log pipeline for many cloud accounts

| | |
|---|---|
| **Template ID** | AMZ-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / multi-tenant ingestion, partitioning, compaction, retention |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "accounts": {"2": ["400", "1,500"], "3": ["12,000", "40,000"]},
  "ingest": {"2": ["2 TB a day", "6 TB a day"], "3": ["60 TB a day", "150 TB a day"]},
  "retention": ["30 days", "90 days", "13 months"],
  "query_target": ["in under 10 seconds for the last hour", "in under a minute for the last day"]
}
```

**Business Scenario.** Public cloud platforms offer managed log services: agents on customers' servers and functions send application and access logs, and customers search them and keep them for a chosen retention period. You are designing the ingestion and storage pipeline for such a service in one region. It serves {{accounts}} customer accounts sending about {{ingest}} of raw log lines. Each account sets a retention period, by default {{retention}}. Customers expect to find a request id {{query_target}}.

**Problem Statement.** Design the pipeline from the agent's batch upload to queryable storage. Cover the ingestion API and what makes a batch retry harmless, the durable buffer and how it is partitioned, parsing and enrichment, storage layout (a recent hot tier and compressed columnar files in object storage), how files are partitioned and compacted, late and out-of-order timestamps, isolation between tenants, retention deletion per account, and the metrics that tell you the pipeline is healthy.

**Constraints.** One account must never see another's logs. A noisy account must not delay others. Agents retry, so the same batch can arrive more than once. Log timestamps can be hours late, or in the future because of clock skew on a host. Expired data must be deleted within a day of expiry. Cost per stored and scanned gigabyte matters as much as latency.

**Assumptions.** All volumes, account counts and targets are hypothetical. Each agent batch carries the account, a log group, a stream name, a batch sequence number and up to a few thousand lines with timestamps. You may use common open building blocks (a partitioned log, a stream processor, object storage, a columnar format, an inverted index or a scan engine).

**Clarifications.**
- Q: Do customers query by time only, or by content too? | A: Both: a time range plus filters on fields or free text, and finding one request id is the most common query.
- Q: Which timestamp counts, the line's or the arrival time? | A: Customers search by the line's timestamp. You also record arrival time.
- Q: Must the order of lines within a stream be preserved? | A: Within one stream, yes, by the line's timestamp and then the order in the batch.
- Q: Can a customer change retention? | A: Yes, at any time, longer or shorter. A shorter period applies to data already stored.
- Q: Is per-account cost reported? | A: Yes. Ingested and stored bytes per account and log group are billed, so they must be exact.

**Hints.**
1. Make the agent's `(account, log group, stream, sequence number)` the identity of a batch, and decide where you remember which ones you have seen.
2. Partition storage so that both common queries and retention deletes touch as few files as possible: think about what the first partition key should be.
3. Small files are the main cost and latency risk of a streaming writer. Plan when and how they are merged, and what readers see during the merge.

**Follow-ups.**
1. One account starts sending ten times its usual volume. Walk through what each stage does, and what every other account notices.
2. Lines arrive two days late. Where are they written, how do customers find them, and what does that do to your compaction?
3. A customer shortens retention from {{retention}} to 7 days. What do you delete, how fast, and how do you prove it is gone?
4. How do you make ingested-bytes billing exact when batches are retried and some lines are dropped as malformed?
5. Search for a request id over a whole day is slow for the largest accounts. What index or layout change would you make, and what does it cost to maintain?

**Follow-up rules.**
- when: partition by timestamp, date partition, dt= → ask: A retention delete for one account must not rewrite other accounts' data. With your layout, what does deleting one account's expired day cost?
- when: kafka, kinesis, partition key → ask: What is your partition key, and what happens to the other tenants on that partition when one account's volume jumps?
- when: dedupe, dedup, exactly once → ask: How long do you remember batch identities, and what happens to a retried batch that arrives after that window?
- when: parquet, columnar, compaction → ask: A compaction job rewrites files that a customer's query is reading. What does the query see, and how is that made safe?
- when: elasticsearch, opensearch, inverted index, index everything → ask: What does indexing every field cost at {{ingest}}, and which fields would you index instead?

**Production Reality Check.**
- One account's debug logging is switched on by mistake, and within ten minutes it sends 40% of the region's {{ingest}}.
- After a network partition, agents on thousands of hosts retry, and twenty minutes of batches arrive twice.
- A customer reports that lines with timestamps two days in the past are missing from searches of that day.

**Evaluation Criteria.** Batch identity and a bounded deduplication store that makes retries harmless; a buffer partitioned for isolation with per-account quotas; partitions keyed so queries and per-account retention deletes are cheap; a compaction plan with atomic file swaps; late data written by event time with a clear rule for very late or future timestamps; tenant isolation enforced at write and read; exact per-account byte accounting; useful health metrics (lag, rejects, small-file count, deletion backlog); a plan for each incident.
