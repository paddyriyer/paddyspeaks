# PayPal · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a consumer wallet and
peer-to-peer payments service: balances and funding sources, social payments with a feed
and audience settings, payments to email or phone recipients, cross-border transfers and
pay-later instalments. Every workload, number, rule and schema is hypothetical; money is
always integer minor units. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PYP-L1-01: Feed audience per month — the audience each payment was posted with

| | |
|---|---|
| **Template ID** | PYP-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / as-of lookups over a settings history, COALESCE precedence, ratio of counts per month |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | PYP-L1-01.mjs |

**Business Scenario.** A peer-to-peer payments app shows payments in a social feed. Each sender has a **default audience** setting — public, friends only, or private — which they can change at any time, and they can also choose a different audience on an individual payment before sending it. A privacy team wants to know, month by month, how payments were actually posted: what share went out public, friends-only and private. That depends on the setting **in force when each payment was made**, not on what the sender's setting is today.

**Problem Statement.** Write one PostgreSQL query that returns `month, payments, public_share, friends_share, private_share`, one row per month with at least one counted payment, ordered by `month`. `month` is the first day of the UTC month of `created_at`. A payment's audience is its `audience_override` when that is not NULL; otherwise it is the sender's default in force at `created_at`: the `default_audience` of the sender's latest `feed_settings` row with `changed_at` at or before `created_at`. {{initial_rule}} {{status_rule}} {{tie_rule}} `payments` counts the month's counted payments; each share is the number posted with that audience divided by `payments`, rounded to 4 decimal places.

**Constraints.** One SQL statement (CTEs allowed). A change at exactly the payment's `created_at` is in force for that payment. The sample has {{payments}} payments and {{changes}} setting changes; production has hundreds of millions of payments a month and far fewer setting changes.

**Assumptions.** Hypothetical users, amounts, settings and schema. The three audience values and the override-wins rule are this exercise's model of a social payments feed; check current docs for any real product's settings. The report is aggregated per month and shows no individual's payments.

**Clarifications.**
- Q: The sender changed their default to private last week. Does that change how a payment from March was posted? | A: No. A payment uses the default in force when it was created.
- Q: A payment has an override and the sender's default differs. | A: The override wins.
- Q: A setting change and a payment have the same `created_at` and `changed_at`. | A: The change is in force for that payment: at or before, inclusive.
- Q: What if the sender has no setting row before the payment? | A: {{initial_answer}}
- Q: How are shares rounded? | A: `ROUND(count::numeric / payments, 4)`; the three shares of a month need not add up to exactly 1 after rounding.

**Hints.**
1. Resolve one audience per payment first; aggregate afterwards. The month and the shares are the easy part.
2. "The latest row at or before a time" is an as-of lookup: a correlated subquery with `ORDER BY changed_at DESC … LIMIT 1`, a `LATERAL` join, or validity ranges built with `LEAD(changed_at)` and a range join.
3. `COALESCE(override, default_in_force, initial_default)` expresses the precedence in one place.

**Follow-ups.**
1. Build `feed_settings` validity ranges (`valid_from`, `valid_to`) once with `LEAD`. Which boundary is inclusive, and how do you make sure two rows at the same second never produce an empty or overlapping range?
2. At hundreds of millions of payments a month, which join strategy would you expect the engine to use for the as-of lookup, and how would you make it cheap (sorting, clustering, a range join, or a snapshot of settings per day)?
3. Users can later change the audience of a payment already in the feed. Model both "posted with" and "currently visible to" so both questions can be answered.
4. The privacy team now asks how many payments were posted public by senders who had switched to private within the previous 30 days. Write the definition precisely and the query outline.

**Follow-up rules.**
- when: max(changed_at), latest setting, current setting → ask: Your lookup returns the sender's latest change. Latest as of when — today, or the moment of the payment? What does it return for a payment made before that change?
- when: < created_at, strictly before → ask: A setting changes at exactly 10:00:00 and a payment is created at 10:00:00. Which audience does your query give it, and which does the spec require?
- when: inner join, join feed_settings → ask: What happens to a payment whose sender has no setting row before it? Does it disappear from `payments`?
- when: lead, valid_to, validity range → ask: How does your range handle the sender's newest row, whose `valid_to` is NULL, and two rows with the same `changed_at`?
- when: lateral, limit 1 → ask: How many index probes does this make at hundreds of millions of payments, and what index would make each one cheap?

**Evaluation Criteria.** One audience per payment with override precedence; the default as of `created_at` with an inclusive boundary, not the current setting; a deterministic tie-break on `change_id` (Very Hard); payments before any setting row kept with the initial default (Hard+); declined payments excluded (Hard+); later edits ignored (Very Hard); UTC months; numeric division and correct rounding; can discuss validity ranges and as-of joins at scale.

## PYP-L1-02: Cross-border corridors per week — speed to available and totals in each currency's units

| | |
|---|---|
| **Template ID** | PYP-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / latest row per key, ordered-set aggregates with FILTER, currency exponents as data, ISO weeks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | PYP-L1-02.mjs |

**Business Scenario.** A wallet lets people send money abroad: the sender pays in one currency and the recipient receives another. A transfer is **available** when the recipient can use the money. Product and operations teams track each **corridor** (send currency to receive currency) weekly: how many transfers were sent, how quickly they became available, and how much money moved on each side. Currencies differ in their minor units — some have none, most have hundredths, a few have thousandths — so amounts are stored as integers in minor units, and each currency's exponent is kept as data.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, send_currency, receive_currency, transfers, available, median_minutes, sent_total, received_total`, one row per week and corridor with at least one counted transfer, ordered by `week_start, send_currency, receive_currency`. `week_start` is the Monday (UTC) of the week of `sent_at`. {{log_rule}} {{status_rule}} `transfers` counts the corridor-week's counted transfers and `available` those that became available. `median_minutes` is the median (`percentile_cont(0.5)`) of the minutes from `sent_at` to `available_at` over the transfers that became available, NULL when none did. `sent_total` is the sum of `send_amount_minor` over counted transfers, and `received_total` the sum of `receive_amount_minor` over transfers that became available (0 when none did), each expressed in **major units** of its currency: the minor-unit sum divided by 10 to the currency's `minor_exponent` from `currencies`.

**Constraints.** One SQL statement (CTEs allowed). Never convert one currency into another: each total stays in its own currency. Keep money exact (numeric, not floating point). The sample has {{transfers}} transfers in {{rows_n}} rows; timestamps are recorded to the minute.

**Assumptions.** Hypothetical corridors, amounts, delays and schema; the exchange rates implied by the amounts are made up. The exponents in `currencies` follow ISO 4217 for the codes used, but this exercise reads them from the table, never from code. How fast real cross-border transfers become available depends on the corridor and the product's own rules; check current docs.

**Clarifications.**
- Q: Which week does a transfer sent on Sunday at 23:58 UTC belong to? | A: The week that started on the Monday before it. Weeks start Monday 00:00 UTC (`date_trunc('week', …)`).
- Q: Does a pending transfer count? | A: In `transfers` and `sent_total` only. It is not in `available`, the median or `received_total`.
- Q: Can I divide every amount by 100? | A: No. A currency with exponent 0 is already in whole units, and one with exponent 3 is in thousandths. Use `currencies`.
- Q: Should the totals be rounded? | A: They are exact: rounding to the currency's exponent changes nothing, but keep the division in numeric.
- Q: Median or average? | A: The median, with `percentile_cont(0.5)`; with an even count it interpolates between the two middle values.

**Hints.**
1. Settle the grain first: exactly one current row per transfer. `DISTINCT ON (transfer_id) … ORDER BY transfer_id, updated_at DESC` is one way.
2. Join `currencies` twice — once for the send side, once for the receive side — and divide by `power(10::numeric, minor_exponent)`.
3. `percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes) FILTER (WHERE available_at IS NOT NULL)` and `SUM(…) FILTER (…)` keep each measure on its own population in one GROUP BY.

**Follow-ups.**
1. Finance wants a single weekly total in one reporting currency. What would you need (rates, their timestamps, the rounding rule), and why must the conversion happen once per transfer rather than on the summed totals?
2. The median hides corridors where a few transfers wait days. Which other measure would you report, and how would you alert on a corridor-week that slows down?
3. The status log receives billions of rows. How would you maintain a current-state table incrementally, and what happens when an older status row arrives after a newer one?
4. A transfer is cancelled after the week was reported. How do the numbers change, and how would you make published weeks reproducible?

**Follow-up rules.**
- when: / 100, cents, *100 → ask: What does dividing by 100 do to an amount in a currency with no minor unit, and to one counted in thousandths?
- when: avg, average → ask: Your speed measure is an average. What happens to it when one transfer in the week waits two days?
- when: float, double, real → ask: Where in your query could money pass through floating point, and why does that matter for a total someone will reconcile?
- when: distinct on, row_number, latest → ask: Two status rows of one transfer share an `updated_at`. What does your query keep, and how would you make it deterministic?
- when: count(available_at), filter → ask: Which population does each of your columns cover, and how do you show that the median and `received_total` ignore pending transfers?

**Evaluation Criteria.** One current row per transfer (Very Hard); cancelled transfers excluded and pending ones counted only where specified (Hard+); Monday-based UTC weeks; the median with `percentile_cont` over available transfers only, NULL when none; each total scaled by its own currency's exponent from `currencies`, never converted, never by a hard-coded 100; numeric arithmetic; deterministic order; can discuss reporting-currency conversion, tail latency and late status rows.

## PYP-L1-03: Pay-later early payoff per purchase-amount band

| | |
|---|---|
| **Template ID** | PYP-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / range joins to a band table, LEFT JOIN for empty bands, per-plan aggregation before per-band, local dates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | PYP-L1-03.mjs |

**Business Scenario.** A pay-later product lets a consumer split a purchase into instalments: in this exercise's rule (check current docs for any real product's terms), four instalments two weeks apart, the first at purchase, so the last falls due six weeks after the purchase. Consumers can also make **extra** payments at any time, and some pay the whole plan off before the final due date. A product team wants to see, by purchase-amount band, how many plans were paid off early and how often extra payments are used — to understand how the schedule fits purchases of different sizes. The analysis is about the product's design; it draws no conclusion about any person.

**Problem Statement.** Write one PostgreSQL query that returns `band_id, label, plans, paid_off, paid_off_early, early_share, extra_payments, extra_cents`, one row for **every** band in `amount_bands`, ordered by `band_id`. A plan belongs to the band with `lower_cents <= purchase_cents` and `purchase_cents < upper_cents` (a NULL `upper_cents` has no upper limit). {{status_rule}} A plan is **paid off** when its counted payments add up to `purchase_cents` (no plan in the sample is paid more), and **paid off early** when it is paid off and the date of its last counted payment is strictly before `final_due_date`. {{date_rule}} `plans`, `paid_off` and `paid_off_early` count the band's counted plans; `early_share = paid_off_early / plans` rounded to 4 decimal places, NULL when the band has no plans; `extra_payments` counts and `extra_cents` sums the counted payments with `kind = 'extra'` on the band's counted plans (0 when there are none).

**Constraints.** One SQL statement (CTEs allowed). Aggregate each plan once before aggregating bands. The sample has {{plans}} plans and {{payments}} payments.

**Assumptions.** Hypothetical plans, amounts, bands and schema. The schedule, the meaning of "early" and the band boundaries are this exercise's rules; check current docs for any real pay-later product. Late fees, refunds and rescheduling are out of scope. The report is aggregated per band and draws no legal, credit-worthiness or eligibility conclusion about any person.

**Clarifications.**
- Q: A plan of exactly 150.00 and bands 50–150 and 150–400. | A: It belongs to 150–400: lower bounds are inclusive and upper bounds exclusive.
- Q: The last payment was made on the final due date itself. Early? | A: No. Strictly before the final due date.
- Q: Which time zone decides the date of the last payment? | A: {{date_answer}}
- Q: A band has no plans. Do I still return it? | A: Yes: zeros, and a NULL `early_share`.
- Q: Does an extra payment on a plan that was never paid off count? | A: Yes. `extra_payments` counts every counted extra payment on the band's counted plans.

**Hints.**
1. Build one row per plan with its paid total, its last payment time and its extra-payment count and cents, using a LEFT JOIN so plans with no counted payments survive.
2. Then LEFT JOIN that onto `amount_bands` with a range condition, so empty bands still appear, and count a column from the plan side.
3. Filter reversed payments in the join's source, not after the LEFT JOIN, or plans without payments vanish.

**Follow-ups.**
1. Plans bought recently cannot be judged yet: their final due date is in the future. How would you report them honestly, and what bias appears if you include them?
2. Product proposes new band boundaries. How would you let analysts try several sets without changing the query, and how would you keep old reports reproducible?
3. A partial refund lowers what a consumer owes. How would you model it so "paid off" still means what the team expects?
4. At tens of millions of plans, how would you maintain this report daily rather than recomputing every plan?

**Follow-up rules.**
- when: between → ask: BETWEEN is inclusive at both ends. Which band does a purchase exactly on a boundary land in, and is it in two bands at once?
- when: inner join, join amount_bands → ask: Which bands does your query return when no plan falls in the top band?
- when: <= final_due_date, on or before → ask: A plan's last payment is on the final due date. Is that early under this exercise's rule?
- when: utc, date(paid_at), ::date → ask: A consumer pays at 03:00 UTC on the due date and lives in Los Angeles. Which date did they pay on, and which date does your query use?
- when: where status, reversed → ask: Where is your filter on reversed payments: in the join, or in a WHERE after the LEFT JOIN? What happens to a plan whose only payment was reversed?

**Evaluation Criteria.** Range join with inclusive lower and exclusive upper bounds and an open top band; every band reported via LEFT JOIN with zeros and a NULL share; per-plan aggregation before per-band; paid off from the posted total; early strictly before the final due date; cancelled plans and reversed payments excluded (Hard+); the last payment's local date in the plan's time zone (Very Hard); correct rounding and order; can discuss immature cohorts, configurable bands and refunds without drawing conclusions about people.

## PYP-L1-04: Mutual payers — pairs who paid each other in both directions within a window

| | |
|---|---|
| **Template ID** | PYP-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps / directed-pair state, one pass after one sort, canonical pair keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PYP-L1-04.mjs |

**Business Scenario.** In a peer-to-peer payments app, friends pay each other back: one covers dinner, the other pays them back a few days later. A product team designing "settle up" suggestions wants to know which pairs of people pay each other **in both directions** within a short window, when that first happened, and how often. The answer feeds aggregate product analysis; each pair only ever sees its own history.

**Problem Statement.** Implement `mutual_payers(payments, window_days, aliases=None)`. Each payment is `(payment_id, sender, recipient, ts, status)` with `ts` in whole seconds. Time order is `(ts, payment_id)`: "earlier" means a smaller `(ts, payment_id)`. {{order_rule}} {{alias_rule}} A counted payment from `u` to `v` at `ts` is **reciprocating** if there is an earlier counted payment from `v` to `u` at most `window_days × 86 400` seconds before it. For every unordered pair with at least one reciprocating payment, return the key `(a, b)` with `a < b` and the value `(first_id, gap, count)`: `first_id` is the `payment_id` of the pair's earliest reciprocating payment, `gap` is its `ts` minus the `ts` of the latest earlier counted payment in the other direction, and `count` is the number of reciprocating payments in the pair. Return a dict; pairs with none are left out. In this exercise `window_days` is {{window_days}}.

**Constraints.** Up to 250 000 payments among tens of thousands of users, and a few pairs with many thousands of payments each. Expected: O(n log n) for one sort, then O(1) per payment. Comparing every pair of payments is O(n²); comparing every payment of one direction with every payment of the other, per pair, is still far too slow for the busiest pairs.

**Assumptions.** Hypothetical users, identifiers and payments. Pairs and counts are product analytics in aggregate; they say nothing about the relationship between two people and are never shown to anyone else.

**Clarifications.**
- Q: Is a payment exactly `window_days` after the other direction's payment inside the window? | A: Yes. At most `window_days × 86 400` seconds, inclusive.
- Q: Two payments in opposite directions at the same second. | A: The one with the lower `payment_id` came first, so the other one is reciprocating, with a gap of 0.
- Q: Which earlier payment does the gap measure from? | A: The latest earlier counted payment in the other direction.
- Q: Does the first payment of a pair ever count? | A: No. A payment can only reciprocate one that came before it.
- Q: Which way round is the key? | A: The two users sorted as strings, whoever paid first.

**Hints.**
1. Sort the counted payments once by `(ts, payment_id)`. Then walk them in order.
2. Keep a dict from a directed pair `(sender, recipient)` to the time of its latest payment so far. For a payment `u → v`, look up `(v, u)`.
3. Normalise before you sort: drop what does not count and resolve recipients first, so the walk only sees real payments between two different users.

**Follow-ups.**
1. The team wants "pairs who settled up": the second payment roughly equals the first. Define "roughly" in integer cents and say how the state you keep changes.
2. Run this daily over a payments table with billions of rows. What state do you carry from one day to the next, and how long must you keep it?
3. Express the same rule in SQL. Which join do you need, and why can it explode for the busiest pairs?
4. One user pays a hundred others and is paid back by most of them (a shared house). How would you summarise groups rather than pairs?

**Follow-up rules.**
- when: for i in range, nested loop, every pair → ask: How many comparisons does your solution make for a pair with 8 000 payments each way, and how long is that in Python?
- when: sort, sorted → ask: What is your sort key, and what happens to two payments in opposite directions at the same second?
- when: frozenset, tuple(sorted → ask: Your key is unordered. How do you still know which direction a payment went, and which earlier payment to measure the gap from?
- when: bisect → ask: Bisect over each direction's times works. What does it cost compared with keeping the latest time per direction while walking in order?
- when: alias, email, phone → ask: An identifier changes hands: the phone number now belongs to someone else. Which owner should an old payment use, and what would the alias map need to record?

**Evaluation Criteria.** Counted payments filtered and recipients resolved before the walk; one sort by `(ts, payment_id)`; latest time per directed pair in a dict; inclusive window; gap from the latest earlier opposite payment; first reciprocating payment by time, not by list position (Hard+); failed, refunded and self payments ignored (Hard+); identifiers resolved and unclaimed ones ignored (Very Hard); canonical sorted keys; O(n log n); credible discussion of incremental state, SQL formulation and privacy of pair-level data.

## PYP-L1-05: Balance targets — the first date a wallet's balance reached each target

| | |
|---|---|
| **Template ID** | PYP-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Prefix maxima and binary search / many queries over one history, sentinel answers, end-of-day aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PYP-L1-05.mjs |

**Business Scenario.** A wallet app lets a user set savings goals and see milestones on their own balance history: "you first had 500.00 on 12 March". Behind the screen is a question asked many times over one history: for each amount, on which date did the balance first reach it? A user with years of activity may have hundreds of thousands of balance changes, and the milestone view asks for thousands of amounts at once. The data is the user's own activity, shown only to that user.

**Problem Statement.** Implement `balance_targets(opening_cents, events, targets, end_of_day=False)`. `events` lists `(date, amount_cents)` in the order they were applied, with `date` as `'YYYY-MM-DD'` (dates never go backwards); the balance starts at `opening_cents` and each event adds its amount (negative for money out). {{opening_rule}} {{eod_rule}} For each target, in input order, return the date of the first event after which the balance was at least the target; `'opening'` if `opening_cents` is already at least the target; or `None` if the balance never reached it. Return a list.

**Constraints.** Up to 200 000 events and 20 000 targets, many of them never reached. Expected: O(n + q log n). Replaying the history for each target is O(n·q), and stopping at the first hit does not help the targets that are never reached.

**Assumptions.** Hypothetical amounts and dates. A milestone is a fact about the user's own history; it is not advice, and it says nothing about anyone's finances beyond what the user already sees.

**Clarifications.**
- Q: The balance equals the target exactly. Reached? | A: Yes: at least the target.
- Q: The balance reached the target, then fell. | A: It was still reached on that date.
- Q: Two events on the same date. | A: With `end_of_day` False, the balance after each event counts; with `end_of_day` True, only the balance after the date's last event counts.
- Q: Can targets repeat or arrive unsorted? | A: Yes. Answer each one in input order.
- Q: What if `events` is empty? | A: Every target above the opening balance is `None`.

**Hints.**
1. The first time the balance reached `t` is the first time the **running maximum** reached `t`, and the running maximum never decreases.
2. Record only the moments the running maximum rises (its value and the date). That list is sorted, so `bisect_left` finds the first value at least `t`.
3. With `end_of_day`, first reduce the history to each date's closing balance, then do the same.

**Follow-ups.**
1. New events arrive every day. How would you keep the structure up to date, and which answers can change when one arrives?
2. A payment from last month is reversed and the history is restated. What breaks in your precomputed list, and how would you rebuild only what is needed?
3. The user wants the first date the balance stayed at or above a target for 30 consecutive days. How would you answer that for many targets?
4. Balances are held in several currencies. What does "reached 500" mean then, and what would you refuse to compute?

**Follow-up rules.**
- when: for t in targets, for each target, break → ask: How many events does your loop read for a target that is never reached, and how many such targets are in the large test?
- when: bisect, binary search → ask: Which list are you searching, and why is it sorted even though the balance goes up and down?
- when: sort targets, sorted(targets → ask: Sorting the targets and sweeping once also works. What does it cost, and how do you return answers in input order?
- when: end of day, closing balance → ask: Two events on the same date: one takes the balance to the target, the next spends it. What does each mode return?
- when: float → ask: Where could floating point enter, and why are integer minor units the right type for a balance?

**Evaluation Criteria.** Running maximum recorded at its increases; `bisect_left` for the first value at least the target; inclusive comparison; answers in input order; `'opening'` for targets met by the opening balance and `None` for unreached ones (Hard+); end-of-day closing balances only (Very Hard); O(n + q log n); credible discussion of incremental updates, restated history and multi-currency balances.
