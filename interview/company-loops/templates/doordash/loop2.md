# DoorDash · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a local commerce
marketplace: restaurant menus, convenience and grocery catalogues, item availability
and substitutions, consumer promotions, a membership subscription with delivery-fee
benefits, merchant point-of-sale integrations and white-label delivery for merchants'
own ordering channels. Every workload, number, schema and rule is hypothetical;
promotion, membership, fee, tax and substitution rules are this exercise's rules
(check current docs), and nothing here describes how the company's own systems work.
Consumer and courier data appear only in aggregate; a merchant sees only its own
stores. Money is always integer cents. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## DSH-L2-01: Substitutions that fill the most out-of-stock lines

| | |
|---|---|
| **Template ID** | DSH-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Bipartite matching / augmenting paths with item capacities, greedy counterexamples |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | DSH-L2-01.mjs |

**Business Scenario.** A grocery order is being picked in a store, and some lines are out of stock. For each out-of-stock line, the consumer approved a short list of substitutes when they placed the order (or chose a refund instead). The store has a few units of each substitute on the shelf, and several lines often approve the same items: oat milk and soy milk may both be acceptable for two different milk lines. Before the shopper starts substituting, the picking app wants to know the most lines the shelf can cover, so it can tell the consumer how many lines will be refunded. Taking the first approved item for each line in turn is quick, but it can use up the only item another line would accept.

**Problem Statement.** Implement `most_lines_filled(orders)`. Each order is a dict with `"lines"`, `"units"` and `"reserved"`. `"lines"` is a list of `(line_id, approved)` pairs, one per out-of-stock line, where `approved` lists the item ids the consumer accepts as a substitute for that line (an empty list means the consumer chose a refund). `"units"` maps an item id to the units on the shelf. One unit fills one line, a line takes at most one unit, and a line can be filled only by an item on its own approved list. Return a list with, for each order in input order, the largest number of its lines that can be filled at the same time. {{level_rule}} Orders are independent: units never move from one order to another.

**Constraints.** Up to 2 000 orders per call, each with up to {{max_lines}} out-of-stock lines and up to 5 approved items per line. Trying every way to give units to lines is exponential in the number of lines, and taking the first approved item with a unit left is fast but returns too few lines. Something close to O(L · E) per order, for L lines and E approved pairs, is expected.

**Assumptions.** Items, shelves and orders are hypothetical. Substitution rules here are this exercise's rules; check current docs for how real substitution preferences work. Preference order inside an approved list does not matter for the count. Units on the shelf are exact (no phantom stock in this exercise).

**Clarifications.**
- Q: Does it matter which line gets which unit? | A: Not for the answer, which is only the count. Any assignment that fills the most lines is fine.
- Q: Can an item fill several lines? | A: Yes, one line per unit. An item with three units can fill three lines.
- Q: An approved item has no entry in `"units"`. | A: The store has none of it, so it fills nothing.
- Q: Can a line take two units, say half from each of two items? | A: No. A line is filled by exactly one unit of one approved item, or not at all.
- Q: Is the consumer's first choice preferred? | A: Not in this exercise. Follow-up 2 asks about it.

**Hints.**
1. Draw lines on one side and items on the other, with an edge for each approved pair. You want the largest set of edges where every line is used at most once and every item at most as many times as it has units.
2. When a line finds all its items full, ask whether one of the lines holding one of those items could move to another item it approves. That chain of moves is an augmenting path.
3. Give each item a list of the lines holding it. A depth-first search per line, with a visited set of items, finds an augmenting path or proves none exists for that line.

**Follow-ups.**
1. Give an order where filling lines in order with each line's first available item fills fewer lines than possible, and one where "lines with the fewest options first" also fails.
2. The consumer ranks the approved items. Among all assignments that fill the most lines, you now want the one that uses first choices most often. What changes in the algorithm?
3. A substitute costs more than the original line, and the store absorbs at most a fixed amount of the difference per order (this exercise's rule). How does the problem change, and is it still a matching?
4. Shelf counts are uncertain: a unit the app thinks is there may not be. How would you present the count to the consumer, and what would you re-run when the shopper finds a shelf empty?

**Follow-up rules.**
- when: greedy, first fit, first available → ask: Two lines: one approves oat milk and soy milk, the other only oat milk, with one unit of each. What does your loop return, and what is the right answer?
- when: sort by, fewest options, most constrained → ask: Every line in this order approves exactly two items, so your sort changes nothing. Can a tie still lead the greedy to the wrong answer?
- when: itertools.product, every assignment, brute force, backtracking → ask: How many assignments does an order with {{max_lines}} lines and three approved items each have, and how many orders of that size does your code finish in a minute?
- when: augmenting path, kuhn, dfs → ask: Why is it safe never to take a unit back once a line has been filled, and what bounds the total work per order?
- when: max flow, edmonds-karp, dinic, hopcroft-karp → ask: Where do the item units go in your network, and how does the result differ from a matching where each item has one unit?

**Evaluation Criteria.** Item units used as capacities; repeated and unstocked approved items handled; empty approved lists never filled; (Very Hard) reserved units subtracted first and never below zero; independent orders; a correct augmenting-path or max-flow method with a clear argument for why greedy fails, illustrated by a small counterexample; a correct complexity statement.

## DSH-L2-02: Promotion price timeline — the price a consumer saw, segment by segment

| | |
|---|---|
| **Template ID** | DSH-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Sweep line / min-heap with lazy deletion, tie-breaking, segment output |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | DSH-L2-02.mjs |

**Business Scenario.** Merchants and the marketplace run promotions on menu items: a lunch price on a bowl, a weekend price on a pizza, a flash deal for an hour. Promotions overlap, and when several apply at once, the consumer sees the lowest price. Support and merchant reporting both need to answer "what price did a consumer see for this item at 19:40 last Tuesday, and which promotion gave it?", and finance wants each item's history as a list of segments rather than a lookup per order. A merchant tool can create promotions in bulk, so a single item can have thousands of promotions active at once.

**Problem Statement.** Implement `price_timeline(base, promotions, horizon)`. Times are whole minutes from the start of the period, and the period is `[0, horizon)`. `base` maps each item to its base price rows `(time, price)`. {{base_rule}} `promotions` is a list of `(promo_id, item, start, end, price)` tuples, listed in the order they were created, oldest first; a promotion applies at minute `t` when `start <= t < end`. A promotion may start before 0 or end after `horizon`; only the part inside the period counts. At each minute, the winning promotion is the one with the lowest price among those that apply and whose price is strictly below the base price in force; on equal prices the older promotion wins. If no promotion wins, the consumer sees the base price and no promotion. Return a dict mapping every item in `base` to a list of `(start, end, price, promo_id)` segments that cover `[0, horizon)` in order, with `promo_id` set to `None` for the base price. A new segment starts exactly when the price or the winning promotion changes, so two adjacent segments never have both the same price and the same promotion. {{level_note}}

**Constraints.** Up to 100 000 promotions across all items, up to 50 000 on one item, and thousands active at the same minute. `horizon` is at most 525 600 (a year of minutes). Every promotion has `start < end`. Re-evaluating every active promotion at every boundary is too slow when thousands overlap; something close to O(n log n) is expected.

**Assumptions.** Items, prices and promotions are hypothetical, and how promotions combine is this exercise's rule (check current docs). Prices are integer cents. No two promotions share an id. Every promotion's item appears in `base`.

**Clarifications.**
- Q: What does "older" mean? | A: Earlier in the `promotions` list. It is not the earlier `start`.
- Q: Two promotions with the same price, but different ids, follow each other. One segment or two? | A: Two. The winning promotion changed, so a new segment starts, even though the price is the same.
- Q: A promotion is priced exactly at the base price. | A: It never wins. The consumer sees the base price, with no promotion.
- Q: Can a promotion end exactly when another starts? | A: Yes. Ranges are half-open, so at the shared minute only the second applies.
- Q: Is the output per minute? | A: No. Segments only; the period can be a year of minutes.

**Hints.**
1. The winner can only change at a promotion's start, at a promotion's end or at a base price change. Visit those times in order.
2. Keep the active promotions in a min-heap keyed by `(price, creation index)`. The top is the winner, if it is still active and below the base price.
3. You do not need to remove a promotion from the middle of the heap when it ends. Store its end with it, and pop the top while the top has already ended.

**Follow-ups.**
1. Support asks for the price at one minute for millions of orders. Once the segments exist, how do you answer each lookup?
2. Some promotions are a percentage off rather than a fixed price. What changes when the base price changes during a promotion?
3. A promotion is cancelled after it ran, and finance wants the timeline as it was shown, and as it would be now. How do you keep both?
4. The timeline must be kept up to date as promotions are created all day. What do you recompute when one promotion is added?

**Follow-up rules.**
- when: min(, every minute, each minute, range(horizon) → ask: How many boundaries and how many active promotions does the largest item have, and how many comparisons does your loop make?
- when: list.remove, active list, .remove( → ask: Removing from the middle of a list is O(a). With thousands active, what does your sweep cost in total, and what would you keep instead?
- when: heapq, heap, lazy → ask: Your heap still holds promotions that have ended. Why is it enough to look only at the top, and how large can the heap grow?
- when: sort by start, sorted by start → ask: After sorting, how do you still know which of two equal-priced promotions is older?
- when: insort, bisect, sortedlist → ask: Your sorted list keeps comparisons logarithmic, but what does each insert and delete move in memory, and when would that matter?

**Evaluation Criteria.** Segments that cover the period exactly and change only when the price or the winning promotion changes; ties to the older promotion by creation order; promotions at or above the base never win; clipping at both ends; half-open ranges; (Very Hard) base price changes that make a promotion lose or win; a sweep with a heap and lazy deletion, or another O(n log n) structure, with a correct complexity statement and a clear reason why rescanning the active list fails at these sizes.

## DSH-L2-03: Debug the cart total calculator

| | |
|---|---|
| **Template ID** | DSH-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Pricing code / modifiers, promotion order, membership minimum, tax base, rounding once |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer, staff-data-engineer |
| **Generator** | DSH-L2-03.mjs |

**Business Scenario.** The checkout page shows a cart total before the consumer places an order. Support has passed on several complaints. Two burgers with extra cheese were charged the cheese once. A consumer with an item on promotion and a 20%-off order code got more off than the code allows. A member was charged a delivery fee on an order whose items were above the membership minimum, after a code brought the total below it. Tax looks too high on discounted orders. Totals on carts with several discounted items are a cent out. The calculator below is the suspect.

**Problem Statement.** Fix `price_carts(carts, fees)` so that it meets this specification (this exercise's rules; check current docs for real fee, membership and tax rules). {{replay_rule}}
1. **`fees`** is `{"delivery", "member_min", "tax_bps"}`: the delivery fee in cents, the membership minimum subtotal in cents, and the tax rate in basis points (800 is 8%).
2. **Lines.** Each cart is `{"member", "lines", "order_promo"}`. Each line is `{"item", "price", "qty", "modifiers", "promo_pct"}`. Modifier prices are per unit, so a line's total is `(price + sum of its modifier prices) × qty`. The subtotal is the sum of line totals.
3. **Promotions.** An item-level promotion takes `promo_pct` per cent off its line's total. Item-level promotions apply first. `order_promo` is `None` or `{"pct", "max_off"}`: `pct` per cent off the subtotal after item-level promotions, but never more than `max_off` cents.
4. **Rounding.** The discounted subtotal (subtotal minus every discount) is computed exactly and rounded once to whole cents, halves rounded up. `discount` is the subtotal minus the discounted subtotal.
5. **Membership.** The delivery fee is waived for a member whose subtotal before any promotion is at least `member_min`.
6. **Tax** is `tax_bps` basis points of the discounted subtotal, rounded to whole cents, halves rounded up. The delivery fee is not taxed in this exercise.
7. **Output.** One dict per cart, in order: `{"subtotal", "discount", "delivery_fee", "tax", "total"}`, all integer cents, with `total = discounted subtotal + delivery_fee + tax`.

**Constraints.** Keep the function's name, arguments and output format. Amounts stay exact: no floats. Up to 100 000 carts per call, processed in linear time.

**Assumptions.** Prices, fees, tax rates, promotions and the membership minimum are hypothetical. Service fees, tips and small-order fees are out of scope. No discount takes a line below zero, since every percentage is at most 100.

**Clarifications.**
- Q: Is the membership minimum tested before or after promotions? | A: Before, in this exercise: on what the consumer put in the cart.
- Q: Which subtotal is taxed? | A: The discounted one, after it has been rounded to cents.
- Q: Why round only once? | A: Rounding each line's discount separately can move the total by a cent per line, and the consumer sees a different number on the receipt.
- Q: Is `round()` fine for halves? | A: Python's `round()` rounds halves to even, so 904.5 becomes 904. The rule here is halves up.
- Q: How many bugs are there? | A: Several, of different kinds. Each check points at one.

**Hints.**
1. Work out by hand: two cheeseburgers at 850 with a 150 modifier. What is the line total?
2. Which amount is the order promotion taken from, and which amount decides the membership waiver?
3. Find every place an amount is rounded. How many should there be before the discounted subtotal?

**Follow-ups.**
1. The order promotion also has a minimum subtotal to qualify. Which subtotal should it test, and what do consumers see if it differs from the membership rule?
2. A refund is issued for one line after delivery. How do you split the order discount and the tax back to that line so that refunds of every line add up to what was charged?
3. Tax rates differ by item type (prepared food versus groceries) in some places. What changes in the calculation and in the output?
4. The checkout total and the total charged must match exactly, but they are computed by two services. How do you keep them from drifting?

**Follow-up rules.**
- when: float, round(, / 100 → ask: What does your code return for a discounted subtotal of exactly 904.5 cents, and does it match the rule "halves up"?
- when: decimal, quantize, round_half_up → ask: Where exactly does your one rounding happen, and what happens to the precision of a 33% discount before it?
- when: per line, each line → ask: If you round each line's discount, how far can a ten-line cart drift from rounding once, and in which direction?
- when: member_min, waiver, waived → ask: A consumer adds a promotion code and loses free delivery. Under this exercise's rule, should that happen, and how would you test it?
- when: tax → ask: Which amount does your tax use, and what would a tax authority expect when the discount is funded by the merchant?

**Evaluation Criteria.** Finds and explains every bug with its consumer-facing symptom; modifiers per unit; item promotions before the order promotion and its cap; the membership minimum on the subtotal before promotions; tax on the discounted subtotal; one exact rounding, halves up; integer cents throughout; minimal fixes, with a test per bug.

## DSH-L2-04: Menu ingestion from merchants' point-of-sale integrations

| | |
|---|---|
| **Template ID** | DSH-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / full and partial menu updates, validation, versioned publishing, freshness |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "stores": {"2": ["200,000", "450,000"], "3": ["1 million", "2 million"]},
  "pos_kinds": [6, 15, 40],
  "freshness": ["2 minutes", "5 minutes", "15 minutes"],
  "max_items": ["400", "2,500", "20,000"]
}
```

**Business Scenario.** About {{stores}} stores sell through a delivery marketplace, and many of them connect their own point-of-sale system so that their menu stays in one place. The marketplace integrates with {{pos_kinds}} kinds of point-of-sale systems, each with its own format. Some send the whole menu, up to {{max_items}} items with categories, modifier groups and prices; others send partial updates such as one item's price or "this item is sold out". Merchants expect a price change or a sold-out item to show to consumers within {{freshness}}. A menu that arrives broken must never replace a good one, and consumers must never see an item that the store cannot make.

**Problem Statement.** Design the pipeline that ingests menus from point-of-sale integrations and publishes them to consumers. Cover the canonical menu model you map every format to; how full menus and partial updates are applied; how availability updates take a faster path than full menus; validation and what happens to a menu that fails it; how a published menu is versioned and rolled back; how you meet the freshness target; and what you measure per integration and per store.

**Constraints.** Updates can arrive out of order and more than once. A full menu can be sent every few minutes even when nothing changed. Some systems use their own item ids that change when a merchant rebuilds a menu. Store hours and menu hours come in the same feeds. A merchant sees only its own stores' menus and errors.

**Assumptions.** Volumes, formats and targets are hypothetical; nothing here describes a real integration. You may use common building blocks: an API gateway, a queue or log, object storage, a relational or document store, a cache and a search index.

**Clarifications.**
- Q: Who owns the menu when a merchant edits it in the marketplace tools too? | A: You decide and explain it per field; the merchant must be able to see which source won.
- Q: What makes a menu invalid? | A: Your call: for example, prices of zero, modifier groups whose minimum exceeds their options, items in no category, or a menu that dropped 90% of its items at once.
- Q: Must a sold-out item disappear, or show as unavailable? | A: Either, but it must not be orderable within {{freshness}}.
- Q: Can a full menu be applied partially? | A: You decide. Say what a consumer sees while it is being applied.

**Hints.**
1. Separate structure (items, categories, modifiers), prices and availability: they change at very different rates and have different freshness needs.
2. Hash each normalised full menu so that an unchanged resend costs almost nothing.
3. Publish whole menu versions atomically, and keep the previous good version to fall back to.

**Follow-ups.**
1. A point-of-sale system resends the whole menu every two minutes for every store. How do you keep that from flooding the pipeline and the search index?
2. A merchant rebuilds their menu and every item id changes. How do you keep order history, ratings and item-level reporting linked?
3. A full menu arrives that removes 1,800 of 2,000 items. Publish, hold, or ask the merchant, and on what evidence?
4. A sold-out update arrives before the full menu that contains the item. What does your pipeline do with it?
5. Analysts want "the menu as consumers saw it at 18:30 last Friday" for any store. What do you keep to answer it?

**Follow-up rules.**
- when: last write wins, overwrite, upsert → ask: A sold-out flag arrives, then a full menu sent five minutes earlier is processed after it. Which state does the store end up in under your rule?
- when: diff, hash, checksum → ask: What exactly do you hash, and how do you stop a reordered but unchanged menu from looking new?
- when: webhook, push → ask: An integration's webhooks stop for an hour without errors. How do you notice, and what do consumers see meanwhile?
- when: cache, cdn → ask: A price changed but consumers keep seeing the old one for twenty minutes. Where is it cached, and how is it invalidated within {{freshness}}?
- when: reject, quarantine, validation → ask: A menu fails validation at 11:55, just before lunch. What does the merchant see, and what do consumers keep seeing?

**Production Reality Check.**
- One point-of-sale kind starts sending prices in dollars instead of cents after an update; 3% of stores show items at a hundredth of their price for {{freshness}} before anyone notices.
- A merchant's system resends a full menu with every modifier group missing; the pipeline publishes it, and consumers order burgers with no way to choose a side.

**Evaluation Criteria.** A canonical menu model; full and partial updates with ordering and dedup; a fast path for availability and prices; validation with quarantine and a kept last-good version; atomic, versioned publishing with rollback; hashing to absorb unchanged resends; stable item identity across rebuilds; per-integration and per-store freshness and error metrics; merchant-scoped visibility; a plan for each incident.

## DSH-L2-05: White-label delivery for merchants' own ordering channels

| | |
|---|---|
| **Template ID** | DSH-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | APIs and event pipelines / quotes, acceptance, status webhooks, per-channel reporting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "daily_requests": {"2": ["300,000", "800,000"], "3": ["3 million", "6 million"]},
  "quote_ttl": ["2 minutes", "5 minutes", "10 minutes"],
  "merchants": ["2,000", "15,000", "60,000"]
}
```

**Business Scenario.** Merchants with their own website or app take orders themselves and use a delivery service, described here generally, to deliver them: their site asks for a delivery quote, shows the fee and estimated time to the consumer, and accepts the quote when the consumer pays. About {{merchants}} merchants send about {{daily_requests}} delivery requests a day. A quote is valid for {{quote_ttl}} (this exercise's rule). After acceptance, the merchant's site receives status updates (accepted, courier assigned, picked up, delivered, cancelled) to show its own consumers. Merchants want reports per ordering channel: their website, their app and their phone orders. Assigning couriers is out of scope: a service you are given does it and emits status events.

**Problem Statement.** Design the merchant-facing API and the data flow behind it. Cover quote requests and their expiry; acceptance that is safe to retry; how status updates reach merchants reliably and in a useful order; what the merchant can query when it misses an update; cancellations from either side and what is charged; the per-channel reporting merchants see; and the data each merchant can and cannot see.

**Constraints.** Merchants' servers time out and retry; a quote may be accepted twice. Merchants' webhook endpoints are sometimes down for hours. Status events from the delivery service can arrive out of order. Courier information shown to a merchant is limited to what the delivery needs (for example a first name and a live status), never ratings or history; reports show couriers only in aggregate. A merchant sees only its own deliveries.

**Assumptions.** Volumes, fees, quote windows and cancellation rules are hypothetical; check current docs for any real product's rules. You may use common building blocks: an API gateway, a relational store, a log or queue, a webhook sender and a warehouse.

**Clarifications.**
- Q: Can the fee change between quote and acceptance? | A: Not within {{quote_ttl}}; after that the quote is expired and the merchant must ask again.
- Q: What identifies a delivery? | A: The merchant's own order reference plus a delivery id you issue. You decide which one makes acceptance safe to retry.
- Q: Must webhooks arrive in order? | A: The merchant wants a sensible final state. Say what you guarantee.
- Q: How does a merchant tag the channel? | A: A field on the quote request; reports group by it.

**Hints.**
1. Make the quote a stored object with its own id and expiry, and make acceptance refer to it, with an idempotency key from the merchant.
2. Give every delivery state a rank and a version, so a merchant can ignore an older update that arrives late.
3. Keep an outbox of webhook deliveries with retries and backoff, plus a "get delivery" endpoint as the source of truth.

**Follow-ups.**
1. A merchant's server accepts the same quote twice within a second because of a timeout. Walk through what happens.
2. The merchant's webhook endpoint is down for six hours. What happens to the updates, and what does the merchant see when it recovers?
3. A delivery is cancelled after the courier picked up the food. Which events, charges and report rows does that produce under your design?
4. A merchant wants delivery times per channel compared with their own in-store pickup times. What can you report, and what data must not leave your side?
5. At {{daily_requests}} requests a day, most quotes are never accepted. How long do you keep them, and what do they tell the merchant?

**Follow-up rules.**
- when: idempotency, idempotent, idempotency key → ask: The key is reused with a different quote id. What do you return, and why?
- when: webhook, retry, backoff → ask: A merchant's endpoint returns 200 but drops the update. How do they recover, and how do you know it happened?
- when: kafka, queue, stream → ask: Status events for one delivery arrive delivered-then-picked-up. What does the merchant's webhook stream show, and what does your state table hold?
- when: courier, dasher, driver → ask: Which courier fields does the merchant receive, for how long, and which never appear in reports?
- when: expire, expiry, ttl → ask: A consumer pays at {{quote_ttl}} plus three seconds. What does the merchant's acceptance return, and what does the consumer see?

**Production Reality Check.**
- A merchant's retry bug accepts every quote twice for a day; without idempotency, 4% of their orders get two deliveries.
- The webhook sender falls six hours behind after a deploy; merchants show "preparing" for orders already delivered, and support contacts spike.

**Evaluation Criteria.** Quotes as stored, expiring objects; idempotent acceptance; a delivery state machine with ranked, versioned updates; reliable webhooks through an outbox with retries, plus a query endpoint as the source of truth; clear cancellation and charge rules; per-channel reports at a stated grain; strict per-merchant visibility and minimal courier data, aggregate only in reports; a plan for each incident.
