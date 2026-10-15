# Block · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domains of a company whose
products include a point of sale for sellers, a peer-to-peer payments app and
buy-now-pay-later instalments. Every workload, number, rule and schema is hypothetical;
money is always integer cents. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## BLK-L1-01: Payment method mix per business category and month, split tenders counted per tender

| | |
|---|---|
| **Template ID** | BLK-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / a complete category × month × method grid, LEFT JOIN zeros, local-time months, ratio of totals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | BLK-L1-01.mjs |

**Business Scenario.** A point-of-sale product lets a seller take a payment in several **tenders**: a customer pays part in cash and the rest by card, or two friends split a bill across two cards. Each tender records how it was taken: contactless (tap), chip (dip), swipe, keyed-in (the card number typed by hand) or cash. A product team wants a monthly view of the payment method mix for each business category, to see how fast tap is replacing chip and swipe and where keyed-in payments are still common, measured both by number of tenders and by money.

**Problem Statement.** Write one PostgreSQL query that returns `business_category, month, method, tenders, amount_cents, tender_share, amount_share`, ordered by `business_category, month, method`. A category-month is a seller's `business_category` with a `month`; {{month_rule}} Each tender counts **once, under its own method** — a payment split across two tenders contributes two tenders. {{status_rule}} {{change_rule}} For every category-month with at least one counted tender, return one row for **each of the five methods** in `tender_methods`, including methods with no tenders (0, 0, 0, 0). `tenders` counts the method's tenders, `amount_cents` sums their amounts, `tender_share` is `tenders` over all counted tenders of the category-month, and `amount_share` is `amount_cents` over all counted cents of the category-month, both rounded to 4 decimal places.

**Constraints.** One SQL statement (CTEs allowed). Money stays in integer cents until the division. The sample has {{payments}} payments and {{tenders}} tender rows.

**Assumptions.** Hypothetical sellers, categories, amounts and schema. The five method names are this exercise's simplification of how card-present payments are taken. No individual buyer appears anywhere; the report is per category.

**Clarifications.**
- Q: A payment is half cash, half chip. How does it count? | A: As one cash tender and one chip tender, each with its own amount.
- Q: Which time zone decides the month? | A: {{month_rule}}
- Q: A category-month has no keyed-in tenders. Does it still get a keyed row? | A: Yes, with zeros. Every category-month with counted tenders has exactly five rows.
- Q: Is `amount_share` the average of each payment's share? | A: No. It is the method's cents over the category-month's cents: a ratio of totals.
- Q: How is rounding done? | A: `ROUND(…, 4)` of the exact ratio, half away from zero.

**Hints.**
1. Build one row per counted tender first, with its category, month, method and amount; everything after aggregates that.
2. The grid is the category-months that exist × `tender_methods`; LEFT JOIN the counted tenders onto it and count a column from the right side, so empty cells count 0.
3. Compute each category-month's totals once (a CTE or a window `SUM(…) OVER (PARTITION BY category, month)`) and divide numerics, not integers.

**Follow-ups.**
1. Product wants the same mix by payment rather than by tender: "share of payments that used any contactless tender". Write the definition precisely and say how a split payment counts.
2. A large seller in one category takes most of the payments. How would you show the mix per seller so one seller does not dominate the category, and what would you have to suppress for small sellers?
3. The tender table grows by hundreds of millions of rows a month. What would you pre-aggregate daily, and how do late corrections (a tender marked failed hours later) reach the monthly numbers?
4. Each seller's time zone can change when they move a location. Which zone should an old payment use, and how would you store it so the report never changes retroactively?

**Follow-up rules.**
- when: count(distinct payment_id, distinct payment_id, per payment → ask: The spec counts tenders, not payments. What does counting distinct payments do to a half-cash, half-card sale, and to the two shares?
- when: inner join, join tenders → ask: Where does a category-month with no keyed-in tenders get its keyed row with zeros in your query?
- when: utc, date_trunc('month', created_at) → ask: A seller in Los Angeles takes a payment at 18:00 local on 31 January. Which month does your query put it in, and which month does the seller see on their own reports?
- when: avg, average share → ask: Is the method's share the average of per-payment shares or the ratio of totals? Show a case where they differ.
- when: tendered_cents → ask: A customer hands over 20.00 in cash for a 13.50 remainder. Which amount does your query add up, and which one is the money the seller kept?

**Evaluation Criteria.** One row per counted tender, never per payment; only COMPLETED tenders; the month in the stated time zone (the seller's own zone at Hard+); cash tendered minus change (Very Hard); a complete five-method grid with zeros; shares as ratios of totals with numeric division and correct rounding; deterministic order; can discuss per-payment definitions, dominance by large sellers and incremental aggregation.

## BLK-L1-02: Offline-mode payments: hours until forwarded and the share declined once forwarded

| | |
|---|---|
| **Template ID** | BLK-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first qualifying event per entity (DISTINCT ON or ROW_NUMBER), LEFT JOIN with a window condition, NULL-safe averages |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | BLK-L1-02.mjs |

**Business Scenario.** A point-of-sale app can take card payments while the device has no internet connection (offline mode): the payment is stored on the device and **forwarded** for processing when the connection returns. Until then the seller does not know whether it will be approved, so a payment forwarded late, or declined once forwarded, is money the seller may not receive. A product team wants a monthly report per seller: how long offline payments waited before they were forwarded, how many were declined once forwarded, and — listed apart, because they are a different problem — the payments that were never forwarded at all.

**Problem Statement.** Write one PostgreSQL query that returns `seller_id, month, offline_payments, forwarded, avg_hours_to_forward, declined_share, never_forwarded, never_forwarded_cents`: one row per seller and month with at least one offline payment, ordered by `seller_id, month`. `month` is the first day of the UTC month of `taken_at` (the month the payment was taken, not the month it was forwarded). {{attempt_rule}} {{window_rule}} A payment is **forwarded** if it has a first decisive attempt that the window rule (if any) does not exclude; otherwise it is **never forwarded**. `avg_hours_to_forward` is the average, over forwarded payments, of the hours from `taken_at` to the first decisive attempt, rounded to 2 decimal places; `declined_share` is the share of forwarded payments whose first decisive attempt was `DECLINED`, rounded to 4 decimal places; both are NULL when nothing was forwarded. `never_forwarded` and `never_forwarded_cents` count those payments and sum their `amount_cents` (0 when there are none); they never enter the average or the share.

**Constraints.** One SQL statement (CTEs allowed). Every seller-month with an offline payment appears, even one where nothing was forwarded. The sample has {{payments}} offline payments and {{attempts}} forward attempts.

**Assumptions.** Hypothetical sellers, amounts, delays and schema. How long a real device may hold offline payments, and what happens to them afterwards, is set by the product's own published rules; check current docs. No buyer data is used.

**Clarifications.**
- Q: A payment taken on 31 August and forwarded on 1 September. Which month? | A: August: the month of `taken_at`.
- Q: What makes an attempt decisive? | A: Its result is `APPROVED` or `DECLINED`. An `ERROR` attempt settled nothing.
- Q: Two attempts have the same `attempted_at`. | A: The lower `attempt_id` comes first.
- Q: A seller-month where every payment is still unforwarded. | A: It appears with `forwarded = 0` and NULL for the average and the share.
- Q: How are the hours computed? | A: The exact interval in seconds divided by 3600, averaged, then `ROUND(…, 2)`.

**Hints.**
1. Pick each payment's first decisive attempt on its own (`DISTINCT ON (payment_id) … ORDER BY payment_id, attempted_at, attempt_id`, or `ROW_NUMBER`) before joining it to the payments.
2. LEFT JOIN that onto `offline_payments` so unforwarded payments stay; any condition that can make a payment "not forwarded" belongs in the join, not in a WHERE.
3. `AVG` and `COUNT(column)` ignore NULLs; `NULLIF(…, 0)` keeps a division by zero from failing.

**Follow-ups.**
1. Sellers want to be warned while it still matters. Turn this monthly report into a live alert: which payments would you flag, when, and from what data on the device?
2. The average hides a long tail. Which percentile would you report instead, and how would you compute it per seller-month in SQL?
3. Forward attempts arrive from devices hours late and sometimes twice. How do you keep this report correct as they trickle in, and when is a month final?
4. A product manager reads a high decline share as "offline mode is risky for these sellers". What else could explain it, and what would you check before anyone draws that conclusion?

**Follow-up rules.**
- when: max(attempted_at, last attempt, latest → ask: A payment was declined, then a retry was approved an hour later. Which attempt settles it in this report, and why does using the latest one change the decline share?
- when: where result, inner join → ask: Where do payments with no decisive attempt go in your query, and how do they reach `never_forwarded`?
- when: forwarded_month, month of attempted_at → ask: Which month does a payment taken on 31 August and forwarded on 1 September land in, and why does the report use the month it was taken?
- when: error → ask: A payment has three ERROR attempts and nothing else. What does your query report for it?
- when: count(*) → ask: Which denominator does your decline share use, and what happens to it when half the payments were never forwarded?

**Evaluation Criteria.** The first decisive attempt per payment with a deterministic tie-break; ERROR attempts ignored; later attempts ignored; the forwarding window applied inclusively with late payments moved to never forwarded (Very Hard); grouped by the month the payment was taken; NULL average and share when nothing was forwarded; never-forwarded counts and cents kept apart from the averages; correct rounding and order; can discuss alerts, percentiles and late data.

## BLK-L1-03: Instalment schedules: on-time plans per purchase-month cohort, and late instalments by number

| | |
|---|---|
| **Template ID** | BLK-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / running totals on two sides matched by threshold, cohort aggregation, dates versus timestamps |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | BLK-L1-03.mjs |

**Business Scenario.** A buy-now-pay-later product splits a purchase into four instalments: the first is paid at checkout and the rest fall due every two weeks. A team that reports on repayment behaviour wants, for each month's purchases (a cohort), the share of plans in which every instalment was paid by its due date, and how many instalments were paid late, broken down by instalment number. The report is about the product's schedule design, not about any person: no conclusion about an individual customer's credit is drawn from it.

**Problem Statement.** Write one PostgreSQL query that returns `cohort_month, plans, on_time_plans, on_time_share, late_2, late_3, late_4, unpaid_instalments`, one row per cohort, ordered by `cohort_month`. A plan's cohort is the first day of the UTC month of `purchased_at`. This exercise's rule (check current docs for any real product's terms): payments are applied in `paid_at, payment_id` order to the plan's **earliest instalment that is not yet fully paid**; instalment *k* is **fully paid** by the payment that brings the plan's running total of payments to at least the sum of instalments 1 to *k*. {{payment_rule}} An instalment is **on time** if the UTC date of the payment that fully paid it is on or before its `due_date`, **late** if after, and **unpaid** if no payment fully paid it. `plans` counts the cohort's plans; `on_time_plans` counts plans whose four instalments were all on time; `on_time_share = on_time_plans / plans` rounded to 4 decimal places; `late_2`, `late_3` and `late_4` count late instalments with that number; `unpaid_instalments` counts unpaid instalments of any number.

**Constraints.** One SQL statement (CTEs allowed). Every instalment in the sample was already due when the data was extracted, and no plan was paid more than its amount. The sample has {{plans}} plans and {{payments}} payments.

**Assumptions.** Hypothetical plans, amounts and payment behaviour. The four-instalment, two-weekly schedule, the order in which payments are applied and the on-time rule are this exercise's rules. Late fees, refunds and rescheduling are out of scope here. The report is aggregated per cohort and draws no legal, credit-worthiness or eligibility conclusion about any person.

**Clarifications.**
- Q: A payment arrives at 23:59 UTC on the due date. | A: On time: compare the payment's UTC date with `due_date`.
- Q: A customer pays half an instalment before the due date and the rest after. | A: Late: the instalment is judged by the payment that completes it.
- Q: A plan has an unpaid instalment and nothing late. Is it an on-time plan? | A: No. Every instalment must have been fully paid by its due date.
- Q: Does a payment say which instalment it is for? | A: No. Payments are applied to the earliest instalment not yet fully paid, so the running totals decide.
- Q: Can instalment 1 be late? | A: It is paid at checkout, on its due date, so it never is; the output has no `late_1` column.

**Hints.**
1. Two running totals per plan: the cumulative amount due through each instalment, and the cumulative amount paid through each payment (`SUM(…) OVER (PARTITION BY plan_id ORDER BY paid_at, payment_id)`).
2. Instalment *k* is fully paid at the earliest payment whose running paid total reaches its running due total — a correlated `MIN` or a join on `paid_through >= due_through`.
3. Aggregate to the plan first (`BOOL_AND` for "all on time", `COUNT(*) FILTER (…)` per instalment number), then to the cohort.

**Follow-ups.**
1. Cohorts whose last instalments are not yet due are excluded here. How would you report the most recent cohorts honestly, and what does "on time so far" mean?
2. The team wants a grace period before an instalment counts as late. Where does it go in your query, and how would you show the effect of choosing one grace period over another?
3. A refund for part of the purchase shrinks the remaining instalments. How would you model it so this report still applies payments correctly?
4. At tens of millions of plans, how would you compute this incrementally each day rather than recomputing every plan's running totals?

**Follow-up rules.**
- when: row_number, nth payment, match by order → ask: A customer pays an instalment in two halves. Which instalment does your second payment get matched to, and which one should it complete?
- when: paid_at <= due_date, timestamp → ask: How does your comparison treat a payment at 15:00 UTC on the due date, and what type is `due_date`?
- when: bool_and, every instalment → ask: What does your "all on time" test return for a plan whose fourth instalment was never paid?
- when: instalment_no → ask: Payments carry no instalment number. How does your query decide which instalment a payment belongs to when one payment covers more than one?
- when: avg, days late → ask: Would an average of days late tell this team more or less than the share of on-time plans? What would you add next to it?

**Evaluation Criteria.** Payments applied in order with running totals rather than matched one-to-one; an instalment judged by the payment that completes it; UTC date compared with the due date, not a timestamp; unpaid instalments make a plan not on time and are counted separately; per-plan then per-cohort aggregation with correct rounding; pay-ahead payments completing several instalments (Very Hard); deterministic order; can discuss incomplete cohorts, grace periods and refunds, and keeps the report free of conclusions about individuals.

## BLK-L1-04: Drawer discrepancy: runs of consecutive cash transactions whose net equals the shortfall

| | |
|---|---|
| **Template ID** | BLK-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and prefix sums / subarrays with a given sum over signed values, per-group state, shortest match |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | BLK-L1-04.mjs |

**Business Scenario.** At the end of a shift, a seller counts the cash drawer and compares it with what the point of sale expected. When the drawer is short (or over), the manager reviews the shift's cash transactions — sales, refunds and paid-outs — looking for a stretch of consecutive transactions whose net matches the difference exactly: for example a run that may have been rung up twice, or cash taken for a stretch of sales that never reached the drawer. You are writing the function that finds those candidate runs so the review starts from a short list, not from the whole shift.

**Problem Statement.** Implement `discrepancy_runs(txns, shortfalls)`. `txns` lists `(shift_id, amount_cents, voided)` in the order they were rung up: positive amounts are cash taken in, negative amounts cash paid out (refunds, paid-outs). `shortfalls` maps each shift under review to its discrepancy in cents (expected minus counted; negative for an overage; never 0). A **run** of a shift is a sequence of consecutive transactions of that shift whose amounts sum exactly to the shift's discrepancy. {{shift_rule}} {{void_rule}} For every shift in `shortfalls`, return `(count, shortest)`: `count` is the number of runs, and `shortest` is `(first_pos, last_pos)` — the positions in `txns` of the first and last transaction of the run with the fewest transactions, ties going to the run that starts first — or `None` when there is no run. Return a dict `{shift_id: (count, shortest)}`.

**Constraints.** Up to 200 000 transactions. Amounts are non-zero integers; refunds make some negative, so the net of a run can go down as it grows. Expected: O(n) time. Checking every start for every end is O(n²) and far too slow.

**Assumptions.** Hypothetical amounts and shifts. A matching run is only a place to start a review, never evidence of what happened or of who handled the drawer; the output names transactions, not people.

**Clarifications.**
- Q: Are positions counted within the shift or in the whole list? | A: In the whole `txns` list, 0-based, so the manager can find the transactions.
- Q: Can a run have one transaction? | A: Yes, if its amount equals the discrepancy.
- Q: Two runs have the same length. | A: The one that starts earlier is the shortest.
- Q: The shift is over by 7.50. | A: Its discrepancy is -750: look for runs whose net is -750.
- Q: Can I use two pointers, growing and shrinking a window? | A: Only if every amount were positive. Refunds make that approach miss runs.

**Hints.**
1. The net of transactions *i+1..j* is `prefix[j] - prefix[i]`. A run ending at *j* starts after every earlier point where the prefix was `prefix[j] - discrepancy`.
2. Keep, per shift, a dict from prefix value to how many times it has occurred — and the latest point it occurred, which gives the shortest run ending at *j*.
3. Start each shift's dict with the empty prefix (value 0 before its first transaction).

**Follow-ups.**
1. The manager wants every run, not just the count and the shortest. How large can that output be, and how would you present it so it is still useful?
2. Runs that are exact matches by coincidence are common in a busy shift with round prices. How would you rank candidate runs so the likeliest explanation comes first?
3. The point of sale stores transactions for thousands of sellers in a warehouse. How would you run this check for every short drawer each night in SQL or Spark, and what makes it hard to express there?
4. A discrepancy may also come from two separate mistakes. How would you find pairs of non-overlapping runs whose nets add up to it, and what does that cost?

**Follow-up rules.**
- when: two pointers, sliding window, shrink → ask: A refund of -5.00 sits in the middle of a run. What does your window do when the running net goes down as it grows?
- when: for i in range, nested loop, every start → ask: How many (start, end) pairs does a 200 000-transaction shift have, and how long would checking them take?
- when: defaultdict, counter, hash map, dict → ask: What does your map hold before the shift's first transaction, and which run does that entry let you find?
- when: per shift, group by shift → ask: Do positions in your answer refer to the shift's own list or to `txns`? How do you map them back?
- when: voided → ask: A voided transaction sits between two that together match. Is that a run, and how long is it?

**Evaluation Criteria.** Prefix sums with a per-shift hash map of counts; the empty prefix seeded; negative amounts and overages handled; the shortest run from the latest matching prefix with the earlier-start tie-break; positions in the original list; shifts kept apart, a shift with no transactions reported and shifts outside `shortfalls` left out (Hard+); voided transactions skipped and not counted in length (Very Hard); O(n); credible discussion of output size, ranking and running it at warehouse scale.

## BLK-L1-05: Tip pooling: equal shares among those on the clock, rounded once at the end

| | |
|---|---|
| **Template ID** | BLK-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sweep line and exact arithmetic / running per-head totals, event ordering at equal times, rounding once |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | BLK-L1-05.mjs |

**Business Scenario.** A point of sale with team management lets a seller pool tips: instead of each tip going to whoever took the payment, it is shared among the team. A large venue uses this exercise's rule: every tip is split **equally among the team members on the clock** at the moment the payment was taken, and each member's total is rounded to the cent **once**, at the end of the pay period, not tip by tip. Tips taken when nobody was on the clock are set aside for the manager to allocate. You are writing the payout calculation.

**Problem Statement.** Implement `tip_pool(shifts, tips, adjustments)`. `shifts` lists `(member_id, clock_in, clock_out)` in whole seconds; a member is **on the clock** at second `t` if `clock_in <= t < clock_out`. `tips` lists `(payment_id, paid_at, tip_cents)`. Each tip is split equally among the members on the clock at `paid_at`, as an exact fraction of a cent. {{shift_rule}} {{adjust_rule}} A member's payout is their exact total rounded to the nearest cent, half a cent rounding up. Tips with nobody on the clock are **unassigned**. Return `(payouts, unassigned)`: `payouts` maps every member that appears in `shifts` to their payout (0 if none), and `unassigned` is the total of unassigned tips in cents.

**Constraints.** Up to 200 000 tips and about 36 000 shifts, with a few hundred members on the clock at busy times. `clock_in < clock_out`; tips are non-negative. Expected: O((n + m) log(n + m)). Visiting every shift per tip, or every member on the clock per tip, is too slow.

**Assumptions.** Hypothetical team, shifts and tips. Whether and how tips may be pooled is governed by local law and the seller's own policy; this exercise's equal-split rule is a simplification and says nothing about what any seller should do. Member ids are pseudonymous; the output is each member's own payout.

**Clarifications.**
- Q: A tip at the exact second a member clocks out. | A: They are not on the clock: `clock_out` is exclusive. A member clocking in at that second is.
- Q: Three members share a 1.00 tip. What do they get? | A: 33⅓ cents each, kept exactly; rounding happens once, on each member's total.
- Q: Do the rounded payouts have to add up to the tips? | A: Not in this exercise; rounding each member once can leave a cent or two over or under. That is a follow-up.
- Q: A member has no tips at all. | A: They still appear, with 0.
- Q: Can I use floats? | A: Not safely: thousands of thirds and sevenths accumulate error, and the half-cent rule needs exact values. Use integers or `fractions.Fraction`.

**Hints.**
1. Picture a running total: "how much one person on the clock would have earned since the start". Each tip raises it by `tip / heads`.
2. A member's share for a shift is that running total at clock-out minus the total at clock-in — no need to touch the member at each tip.
3. Sort clock-outs, clock-ins and tips together; at equal times process clock-outs, then clock-ins, then tips.
4. Keep the running total exact: scale by the least common multiple of the head counts that occur, or use `Fraction` (slower).

**Follow-ups.**
1. The rounded payouts must add up exactly to the pooled tips. Which rounding rule would you use (for example largest remainder), and how do you explain an odd cent to the team?
2. The venue wants weighted shares (a role with more points gets a larger share). What changes in the running-total idea?
3. Shifts are edited after the fact (a forgotten clock-out fixed the next day). How would you recompute only what changed?
4. A member is on the clock in two locations of the same seller at once by mistake. How should the calculation and the data model prevent or flag it?

**Follow-up rules.**
- when: float, round( → ask: Where in your code is a value rounded or stored as a float, and what happens to a 1-cent tip shared by three people, a thousand times?
- when: for each tip, for shift in shifts, scan → ask: How many shift checks does your loop make for 200 000 tips and 36 000 shifts?
- when: active set, on the clock set, for member in → ask: At a busy time 400 people are on the clock. How much work does each tip cost in your solution, and how would a running per-head total avoid it?
- when: fraction, lcm → ask: How large do your exact values get, and why is that acceptable here?
- when: bisect, sorted → ask: Bisect gives you the head count at a tip. How do you then credit each member without visiting all of them?

**Evaluation Criteria.** Half-open shifts with clock-outs before clock-ins before tips at equal times; exact per-tip shares; rounding once per member with half a cent up; members with no tips present; unassigned tips totalled; a member's shifts summed before rounding (Hard+); the last adjustment replacing the tip at its original payment time (Very Hard); a sweep with a running per-head total in O((n + m) log(n + m)); credible discussion of reconciling cents, weighted pools and late shift edits.
