# DoorDash · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a local commerce
marketplace: restaurant menus, convenience and grocery catalogues, item availability,
store hours, order accuracy, a membership subscription with delivery-fee benefits, and
merchants' own ordering channels. None of these questions comes from the company's
interviews, and none describes its internal systems, merchants, partners or data. Every
rule marked "this exercise's rule" is a simplification made for practice (check current
docs for how any real programme works); all numbers are hypothetical. Merchant and
consumer data appear only in aggregate, and no courier appears at all.

## DSH-L1-01: Order accuracy per merchant and week, with the merchant's own channel shown apart

| | |
|---|---|
| **Template ID** | DSH-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / DISTINCT before counting, LEFT JOIN of a flag onto every order, weekly buckets in a time zone |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | DSH-L1-01.mjs |

**Business Scenario.** A merchant's weekly report shows **order accuracy**: of the orders it delivered, how many came with an item missing or wrong. Consumers report problems after delivery, sometimes several times about one order, and they also report things that are not about the items at all (a late delivery, damaged packaging). Some merchants also take orders on their own website or app and use the marketplace only for delivery; those orders are reported on a separate row so a merchant can compare its two channels.

**Problem Statement.** Write one PostgreSQL query that returns `merchant_id, week_start, channel, delivered_orders, inaccurate_orders, accuracy_rate`, one row per merchant, week and channel with at least one delivered order, ordered by `merchant_id, week_start, channel`. Only orders with `status = 'delivered'` count; cancelled orders are in neither count. A delivered order is **inaccurate** if it has at least one report with `issue_type` `missing_item` or `incorrect_item` filed within {{window_h}} hours after `delivered_at` (`reported_at <= delivered_at + {{window_h}} hours`, this exercise's rule); other issue types do not count. An order with several qualifying reports is one inaccurate order. `accuracy_rate` is `(delivered_orders − inaccurate_orders) / delivered_orders`, rounded to 4 decimal places. A store belongs to the merchant in `stores.merchant_id`; a merchant's stores are added together. {{week_rule}}

**Constraints.** One SQL statement (CTEs allowed). `channel` is `marketplace` or `own_channel`. The sample has {{orders}} orders and {{reports}} reports.

**Assumptions.** Merchants, stores, orders, reports and the report window are hypothetical; the window is this exercise's rule, so check current docs for how any real accuracy metric is defined. Reports carry no consumer identity, and the report is about the order, not about whoever delivered it.

**Clarifications.**
- Q: An order has a `missing_item` and an `incorrect_item` report. How many inaccurate orders is that? | A: One. Accuracy is counted per order.
- Q: A cancelled order has a `missing_item` report. Does it count anywhere? | A: No. It was never delivered, so it is in neither the denominator nor the numerator.
- Q: Is a report exactly {{window_h}} hours after delivery inside the window? | A: Yes. The window is inclusive; one second later is outside.
- Q: Does a delivered order with no report at all appear? | A: Yes, in `delivered_orders`. Most orders have no report.
- Q: How is `accuracy_rate` rounded? | A: `ROUND(…, 4)` on a numeric, half away from zero.

**Hints.**
1. Build the set of inaccurate orders first: `SELECT DISTINCT order_id` from qualifying reports. That collapses repeated reports.
2. LEFT JOIN that set onto the delivered orders, so orders without a report stay in the denominator, and count the joined id.
3. Find the week with `date_trunc('week', …)`, which starts weeks on Monday, after converting the timestamp to the time zone the report uses.

**Follow-ups.**
1. Merchants dispute reports they think are wrong. How would you show accuracy both before and after disputes are resolved, without rewriting last month's published numbers?
2. A small merchant has 6 orders in a week and one problem, so its accuracy is 0.8333. How would you present a rate on so few orders honestly?
3. Reports arrive up to {{window_h}} hours after delivery. When is a week's number final, and how would you build the report incrementally until then?
4. Accuracy should be broken down by item, to tell a merchant which dishes go missing. What does the data need, and why does a report about one item not make the other items inaccurate?

**Follow-up rules.**
- when: count(report_id), count(*) → ask: An order has three reports. How many times does your query count it as inaccurate?
- when: inner join, join issue_reports → ask: Where do the delivered orders with no report go in your query, and what happens to the denominator?
- when: status, cancelled → ask: Where does a cancelled order with a report leave your query: before or after you count reports?
- when: utc, at time zone, date_trunc → ask: A store in Los Angeles delivers an order on Sunday evening local time. Which UTC week is that, and which week does the merchant expect to see it in?
- when: avg, average → ask: Is the merchant's accuracy the average of its stores' rates, or the ratio of the totals? When do they differ?

**Evaluation Criteria.** Cancelled orders excluded from both counts; only missing or incorrect item reports, inside the inclusive window (Hard+); one inaccurate order however many reports; delivered orders with no report kept through a LEFT JOIN; stores added up per merchant; channels shown apart; Monday weeks, in the store's local time at Very Hard; numeric division and correct rounding; deterministic order; sensible answers on disputes, small denominators and late reports.

## DSH-L1-02: Membership value per month: fees waived against the monthly price, trial months shown apart

| | |
|---|---|
| **Template ID** | DSH-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per member-month aggregation with a LEFT JOIN, conditional sums, strict thresholds, a ratio of members |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | DSH-L1-02.mjs |

**Business Scenario.** A delivery membership charges a monthly price and, under this exercise's rule, waives the delivery fee on orders above a minimum subtotal. The membership team wants to know, month by month, whether members get their money's worth: how much in delivery fees was waived, and what share of members saved more than they paid. Free trial months behave differently and are reported on their own row.

**Problem Statement.** Write one PostgreSQL query that returns `month, plan_kind, members, waived_orders, fees_waived_cents, members_ahead, share_ahead`, one row per month and plan kind (`'paid'` or `'trial'`, from `is_trial`) that has at least one member-month, ordered by `month, plan_kind`. A **member-month** is a row of `member_months`; an order belongs to the UTC calendar month of `placed_at`, and counts only if its consumer has a member-month for that month. A member's order has its delivery fee waived when it is `delivered` and meets the minimum subtotal; the amount waived is its `delivery_fee_cents`. {{min_rule}} Per member-month, add up the waived fees; the member is **ahead** when that total is strictly greater than its `price_cents` (for a trial month, the price it would have paid). `members` counts member-months, including those with no orders; `waived_orders` and `fees_waived_cents` add up the waived orders; `members_ahead` counts member-months that are ahead; `share_ahead` is `members_ahead / members` rounded to 4 decimal places.

**Constraints.** One SQL statement (CTEs allowed). Amounts are integer cents. The sample has {{member_months}} member-months and {{orders}} orders.

**Assumptions.** The price, the minimum subtotal and the waiver are this exercise's rules with hypothetical numbers; check current docs for any real membership's terms. Orders by consumers who are not members that month are out of scope. The report is in aggregate; no consumer is shown individually.

**Clarifications.**
- Q: A member placed no orders this month. Are they in `members`? | A: Yes. They paid (or trialled) and saved nothing; leaving them out would flatter the share.
- Q: A member's waived fees equal the monthly price exactly. Are they ahead? | A: No. Ahead means strictly greater.
- Q: Is a subtotal exactly at the minimum enough? | A: Yes. The minimum is inclusive.
- Q: An order is placed at 23:59:59 UTC on the last day of a month by someone who joined the next month. Does it count? | A: No. It belongs to the month of its `placed_at`, when they were not a member.
- Q: Does a cancelled order waive anything? | A: No. Only delivered orders count.

**Hints.**
1. Compute the waived orders first: delivered, in a member-month, meeting the minimum. Aggregate them per consumer and month.
2. LEFT JOIN that aggregate onto `member_months`, so every member-month is present, and treat a missing total as 0.
3. Then group by month and plan kind, with `COUNT(*) FILTER (WHERE waived > price_cents)` for the members ahead.

**Follow-ups.**
1. Members on an annual plan pay once a year. How would you compare their waived fees with a price, and what would you show for a member who cancelled in month three?
2. The share ahead rises in the month the minimum subtotal is lowered. How would you separate the effect of the rule change from a change in who joined?
3. Finance asks for the cost of the waiver. Why is `fees_waived_cents` not the cost, given that members order more often than they would without the membership?
4. Months must be the member's billing cycle (joined on the 17th, renews on the 17th), not calendar months. What changes in the data and the query?

**Follow-up rules.**
- when: inner join, join orders → ask: A member placed no qualifying order this month. Is that member-month in your denominator?
- when: >= price, at least the price → ask: A member's waived fees equal the price exactly. Are they ahead under the rule?
- when: subtotal_cents >= → ask: Which subtotal do you compare with the minimum: before or after the promotion?
- when: date_trunc, extract(month → ask: An order at 23:59:59 on the 31st by someone who joined on the 1st of the next month. Where does it land?
- when: avg, average → ask: Is the share of members ahead an average of something? What exactly is in the numerator and the denominator?

**Evaluation Criteria.** Only delivered orders in a member-month; the minimum inclusive and tested after promotions (Hard+), per vertical at Very Hard; fees summed per member-month before comparing; strict "ahead"; member-months without orders kept; trial months apart; correct rounding and order; good reasoning on annual plans, billing cycles and why waived fees are not cost.

## DSH-L1-03: Ordered while toggled off: items that were already marked unavailable

| | |
|---|---|
| **Template ID** | DSH-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / as-of join (latest row at or before a time), tie-breaks, scope precedence, two-level aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | DSH-L1-03.mjs |

**Business Scenario.** Convenience and grocery merchants mark items unavailable in their merchant tools when they run out, and back on when they restock. A consumer app that shows a stale menu can still take an order for an item the store had already switched off, which ends in a substitution or a refund. The catalogue team wants to measure, per store and day, how many orders contained an item that was switched off when the order was placed.

**Problem Statement.** Write one PostgreSQL query that returns `store_id, order_date, orders, flagged_orders, flagged_lines`, one row per store and UTC date of `placed_at` with at least one order, ordered by `store_id, order_date`. An order line's item was **unavailable** when the latest availability toggle for that item and store with `toggled_at <= placed_at` has `is_available = false`. Toggles after the order are ignored. If two toggles have the same `toggled_at`, the one with the higher `toggle_id` is the later one. An item with no toggle at or before the order is available. `orders` counts the store's orders that day, `flagged_orders` those with at least one unavailable line, and `flagged_lines` the unavailable lines. {{scope_rule}}

**Constraints.** One SQL statement (CTEs allowed). An item appears at most once per order. The sample has {{orders}} orders and {{toggles}} toggles.

**Assumptions.** Stores, items and toggles are hypothetical. Nothing here says why an item was switched off or whether the order was later fulfilled; the measure is only "the item was off when the order was placed".

**Clarifications.**
- Q: The item was switched off at 10:00 and back on at 11:00, and the order was at 11:30. Is it flagged? | A: No. Only the latest toggle at or before the order counts, and that one says available.
- Q: A toggle and an order have exactly the same timestamp. Which comes first? | A: The toggle applies: `toggled_at <= placed_at`.
- Q: The item was switched off an hour after the order. Is the order flagged? | A: No. Toggles after the order are ignored.
- Q: The same item is switched off at another store. Does that matter? | A: No. A store-level toggle applies to its own store only.
- Q: An order has two unavailable lines. What do the columns show? | A: One flagged order and two flagged lines.

**Hints.**
1. For every order line, find one toggle: the latest for that item and store at or before `placed_at`. A correlated subquery with `ORDER BY toggled_at DESC, toggle_id DESC LIMIT 1`, a `LATERAL` join, or `DISTINCT ON` all work.
2. Aggregate to one row per order (its count of unavailable lines) before aggregating to store and day, so `flagged_orders` counts orders, not lines.
3. Treat "no toggle found" (NULL) as available: compare with `= false`, not `NOT …`, or use `COALESCE`.

**Follow-ups.**
1. Toggles arrive from merchants' tools with a delay of up to a few minutes. How would you report the orders that fall inside that uncertainty, rather than flagging them as if the timing were exact?
2. With billions of order lines and millions of toggles a day, the correlated lookup is too slow. How would you compute the as-of join in a warehouse, and what would you partition by?
3. The team wants "minutes the item had been off when the order arrived". What do you add, and how do you treat an item that was off since before your data starts?
4. Flagged orders lead to substitutions or refunds. How would you connect this measure to what actually happened to the line, without double-counting lines that were substituted and then refunded?

**Follow-up rules.**
- when: max(toggled_at), latest toggle time → ask: Your MAX finds the latest time. How do you get the is_available of that row, and what if two toggles share that time?
- when: exists, any toggle → ask: The item was switched off, then back on before the order. Does your EXISTS still flag it?
- when: lateral, distinct on → ask: What is in your ORDER BY, and does it decide every tie?
- when: count(*), count lines → ask: Is flagged_orders counting orders or lines in your query? Show me with an order that has two unavailable items.
- when: asof, as-of join → ask: Your engine has an ASOF JOIN. How does it treat a toggle at exactly the order time, and is that what the rule says?

**Evaluation Criteria.** The latest toggle at or before the order, with `<=` and the `toggle_id` tie-break (Hard+); later toggles ignored; no toggle means available; store scoping, and merchant-wide toggles with the latest of either scope winning (Very Hard); orders and lines counted separately; every store-day with orders present; deterministic order; credible answers on toggle delays and computing an as-of join at scale.

## DSH-L1-04: Open stores at each order's time, from a week of opening hours

| | |
|---|---|
| **Template ID** | DSH-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sorting + binary search / counting intervals containing a point with two bisects; intervals that wrap a cycle |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | DSH-L1-04.mjs |

**Business Scenario.** When a consumer orders, how much choice did they have? A city's analysts want, for every order in a period, the number of the city's stores that were open at that minute. Stores publish weekly opening hours: some open once a day, some close between lunch and dinner, and late-night stores stay open past midnight. There are thousands of stores and many more orders, so the count must be fast.

**Problem Statement.** Implement `open_store_counts(hours, orders)`. `hours` is a list of `(store_id, day, open_min, close_min)`, one per opening interval: `day` is 0 (Monday) to 6 (Sunday) and the minutes count from that day's midnight, `0 <= open_min < 1440` and `0 <= close_min <= 1440`, never equal. A store is open from `open_min` up to but not including `close_min`. A store's own intervals never overlap. `orders` is a list of integer minutes since Monday 00:00 of week 0. Return, for each order in input order, the number of stores open at that minute. {{midnight_rule}} {{weeks_rule}}

**Constraints.** Up to about 3 000 stores (some 22 000 intervals) and 20 000 orders in the timing check. Checking every interval for every order is O(n·q) and too slow; so is scanning a start-sorted list until the starts pass the order, which is still O(n) per order. Something close to O((n + q) log n) is expected.

**Assumptions.** Stores and hours are hypothetical, and every time is in the city's local time with no daylight-saving change in the period. Holiday hours and temporary pauses are out of scope here. Because a store's intervals never overlap, counting open intervals counts open stores.

**Clarifications.**
- Q: A store opens at 11:00. Is an order at exactly 11:00 counted? | A: Yes. An order at the closing minute is not.
- Q: Do I need store ids at all? | A: Not for the count, because a store's intervals never overlap. They matter for the follow-ups.
- Q: Are the hours sorted? | A: No. Intervals of different stores and days arrive in any order.
- Q: Can I precompute an answer for every minute of the week? | A: Yes, if you can explain the cost; the week has 10 080 minutes.

**Hints.**
1. Put every interval on one line of week minutes: it starts at `day × 1440 + open_min`.
2. A store is open at `t` if it started at or before `t` and has not yet ended. Count the starts `<= t` and subtract the ends `<= t`: two binary searches on two sorted lists.
3. An interval that runs past the end of the week wraps to Monday morning: split it into two pieces.

**Follow-ups.**
1. Analysts want to know which stores were open, not just how many, for a sample of orders. What would you build, and what does it cost?
2. Stores publish holiday hours that replace the weekly hours on certain dates. How does your structure change?
3. Every store pauses itself now and then when the kitchen is busy, for minutes at a time. How would you include pauses without rebuilding everything for each one?
4. The orders arrive as a stream, all day. What would you keep in memory, and how would you handle a store that changes its hours during the week?

**Follow-up rules.**
- when: for each store, nested loop, for interval in → ask: There are 22,000 intervals and 20,000 orders. How many comparisons is that, and how long in Python?
- when: bisect, binary search → ask: Why does starts-at-or-before minus ends-at-or-before give the number of open stores? When would it be wrong?
- when: 10080, every minute, difference array → ask: That precomputes the week. What happens to memory and build time if the analysts want seconds, or a year of holiday hours?
- when: midnight, wrap, modulo → ask: A store opens Sunday at 20:00 and closes at 03:00. Where does that interval go on your week line?
- when: interval tree, segment tree → ask: What does the tree give you here that two sorted lists do not?

**Evaluation Criteria.** Half-open intervals, open at the opening minute and closed at the closing minute; split lunch and dinner hours; at Hard+, intervals across midnight and the Sunday-to-Monday wrap split correctly, and a close of 0 or 1440 both meaning midnight; at Very Hard, orders reduced modulo the week and adjacent all-day intervals counted once at midnight; sorted starts and ends with two bisects per order (or a per-minute count array) rather than a scan; a clear complexity argument; sensible answers on holiday hours, pauses and streaming.

## DSH-L1-05: Repeat carts: orders that exactly repeat one of the same account's earlier carts

| | |
|---|---|
| **Template ID** | DSH-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hashing / canonical form of a multiset (sorted tuple) as a dictionary key; most recent match per key |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | DSH-L1-05.mjs |

**Business Scenario.** Many orders are reorders: the same lunch every Tuesday, the same weekly shop. The consumer app wants to know how often a cart exactly repeats an earlier one, and which earlier order it repeats, to decide how prominently to offer "reorder". Carts are written in whatever order the consumer added items, sometimes with the same item on two lines, so two identical carts rarely look identical in the raw data. Workplace accounts that order for a whole office can have tens of thousands of orders.

**Problem Statement.** Implement `repeat_carts(orders)`. `orders` is a list of `(order_id, account_id, lines)` in the order they were placed. Two carts are **the same** when every line has the same total quantity in both. Return, for each order in input order, the `order_id` of the **most recent** earlier order by the same account with the same cart, or `None` if there is none. {{line_rule}}

**Constraints.** Up to 50 000 orders in the timing check, from two accounts with tens of thousands of orders each, carts of up to five lines. Comparing each order with every earlier one is O(k²·m) per account; keeping a list of earlier carts and testing `cart in earlier` is still O(k) per order and too slow. Something close to O(Σ m log m) is expected.

**Assumptions.** Accounts, items and orders are hypothetical. The analysis uses only the account id and the cart; prices, stores and delivery addresses are out of scope, and the result is used in aggregate.

**Clarifications.**
- Q: Do the lines have to be in the same order? | A: No. A cart is the set of lines with their quantities; the order the items were added does not matter.
- Q: Is a cart that contains everything from an earlier one, plus one more item, a repeat? | A: No. The carts must be exactly the same.
- Q: Two earlier orders have the same cart. Which do I return? | A: The most recent one before the current order.
- Q: Does another account's identical cart count? | A: No. Only the same account's earlier orders.
- Q: Can I sort the lines and compare? | A: Yes, that is the canonical form. The question is what you then do with it for 50 000 orders.

**Hints.**
1. Turn each cart into a canonical, hashable value: add up quantities per line key, drop zero quantities, and sort into a tuple.
2. Keep a dictionary from `(account_id, canonical cart)` to the most recent `order_id`. Look up before you store.
3. Each order then costs O(m log m) for its own lines and O(1) for the lookup, independent of how many orders came before.

**Follow-ups.**
1. Product wants "near repeats": the same cart with one item more or less. How would you find them without comparing every pair of carts?
2. An item's id changes when the merchant rebuilds its menu, so last month's identical cart no longer matches. What would you key on instead, and what could go wrong?
3. The analysis runs daily over five years of orders. What state do you keep between runs, and how big is it?
4. How would you compute the same result in SQL over an `order_lines` table, and what plays the role of the canonical tuple there?

**Follow-up rules.**
- when: in earlier, list of carts, append → ask: The office account has 25,000 orders. How many cart comparisons does `cart in carts` make over the whole run?
- when: frozenset, set( → ask: Does a set keep the quantities? What does your key say about two lattes against one?
- when: sorted, tuple → ask: Two lines of the same item with quantities 1 and 1. Does your sorted tuple equal the cart with one line of quantity 2?
- when: hash, md5, sha → ask: You hash the cart into a short string. What happens on a collision, and do you need the hash at all when Python can key a dict on the tuple?
- when: counter → ask: A Counter is not hashable. How do you turn it into a key, and what about zero counts?

**Evaluation Criteria.** Line order ignored; quantities matter; only the same account; the most recent earlier match; subsets are not repeats; at Hard+, repeated items added up, zero lines ignored and empty carts returning `None` without ever matching; at Very Hard, options as part of the line, in any order, with an empty tuple equal to none; a canonical sorted tuple in a dictionary rather than a list scan; a clear complexity argument; good answers on near repeats, changing ids and incremental runs.
