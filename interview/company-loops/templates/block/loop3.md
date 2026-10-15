# Block · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of payments for
sellers and people: point of sale for sellers (in-person payments, orders, items,
team members, gift cards), person-to-person payments, and buy-now-pay-later
instalments. Every workload, number, schema and incident is hypothetical; fee,
instalment, late-fee and expiry rules are this exercise's rules (check current
docs), and nothing here describes how the company's own systems are built. Money
is always integer minor units (cents).

## BLK-L3-01: Seller accounts as data — businesses, locations, devices, team members, permissions and what each location sold on a date

| | |
|---|---|
| **Template ID** | BLK-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated hierarchy, device pairing, permission history, location business dates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "sellers": {"1": ["300,000"], "2": ["1.5 million", "3 million"], "3": ["4 million", "6 million"]},
  "max_locations": [40, 250, 1200],
  "permission_model": ["four fixed roles (owner, admin, manager, staff)", "fixed roles plus custom permission sets the owner can edit"],
  "device_moves": ["2%", "6%"]
}
```

**Business Scenario.** A point-of-sale platform serves {{sellers}} sellers, from a single market stall to chains of up to {{max_locations}} locations. A business has locations (each with an address, a time zone and opening and closing dates); devices (card readers, registers and phones running the point-of-sale app) paired to one location at a time; and team members who are assigned to some locations and hold a role. In this exercise's model permissions come from {{permission_model}}: for example, who may issue refunds, open the cash drawer, see reports or edit items. Things change constantly: about {{device_moves}} of devices are re-paired to another location each month, locations open, close and reopen, team members leave and come back, and roles are edited. Sellers want daily sales per location in each location's own business date; an owner checking a disputed refund wants to know who was allowed to issue refunds at that location on that day.

**Problem Statement.** Design the data model. Cover: the entities (business, location, device, team member, role or permission set, and the assignments between them) with keys; how history is kept for device pairings, location attributes, team assignments and permission definitions, so the state on any past date can be reconstructed; how a payment or order gets its location and business date, and why that is fixed when the payment happens; the daily sales fact per location and the dimensions it joins to (as-of-date versus current attributes); and the query shape for "who could issue refunds at location L on date D". Say what personal data about team members reaches the warehouse.

**Constraints.** A sale's location never changes after the fact, even when its device moves later. Daily sales use the location's business date in its own time zone. Any past date's permissions for any team member at any location are reconstructable. Ids are stable; names change. Money is integer cents. Team members appear in analytics by id and role only; contact details stay in the operational system.

**Assumptions.** Seller counts, location counts and move rates are hypothetical. A business operates in one currency in this exercise. A device belongs to exactly one location at a time and to one business forever. A team member can work at several locations of the same business.

**Clarifications.**
- Q: Can a device be paired to two locations at once? | A: No. One location at a time; a move ends one pairing and starts the next.
- Q: Does a payment carry its location? | A: The device sends its device id and the location it believes it is in. Decide which you trust and when it is stamped.
- Q: Can a location change time zone? | A: Rarely, when it moves. The business date of a sale uses the time zone in force when the sale happened.
- Q: Is a role per business or per location? | A: The role is per team member and business; assignments say which locations they work at. Permissions apply only at assigned locations.
- Q: Can an owner edit a permission set? | A: Yes, with custom sets. An edit applies to everyone holding the set from that moment and never changes the past.

**Hints.**
1. Model every relationship that changes as its own effective-dated table with `valid_from` and `valid_to`, not as a column on the entity.
2. Stamp `location_id`, the location's time zone and the business date on each payment when it is written; deriving them later from the device's current pairing rewrites history.
3. Permission sets need versions: a role points at a set, and the set's version in force on a date says what it allowed.

**Follow-ups.**
1. A reader moved from the café to the kiosk on Tuesday at 14:00. Show the rows for its pairing and how Monday's and Tuesday's sales are attributed.
2. Write the query shape for "who could issue refunds at location L on date D", walking assignments, roles and permission-set versions.
3. A seller with {{max_locations}} locations reorganises them into regions. Do last year's reports group by the regions then or now, and how does your model offer both?
4. A location closes and reopens six months later at a new address in another time zone. Is it the same location, and what happens to its reports?
5. At {{sellers}} sellers, how much history do these effective-dated tables hold, and how do you serve a seller dashboard that asks for the state on a date in milliseconds?

**Follow-up rules.**
- when: current location, location column, devices table → ask: The reader moved to another location yesterday. With the location on the device row, which location do last week's sales show?
- when: utc, date_trunc, calendar day → ask: A location in Honolulu closes its till at 22:00 local. On which business date do its last sales land in your fact, and why?
- when: role column, is_admin, boolean flag → ask: The owner removed refund rights from managers last month. Can your model say who could refund at the downtown location in the week before that?
- when: scd, type 2, valid_from, valid_to → ask: How do you stop two pairings for the same device overlapping, and is valid_to inclusive or exclusive?
- when: delete, deactivate, remove the team member → ask: A team member left in March. Their refunds from February still need a name in the audit. What do you keep, and what do you never copy into the warehouse?

**Production Reality Check.**
- A bulk re-pairing tool, run by mistake for a seller with {{max_locations}} locations, moved every reader to the flagship for an hour. Payments in that hour were stamped with the flagship, and the other locations' daily sales dropped.
- An owner edited a custom permission set to remove refund rights; the warehouse held only the current definition, so an audit of who could refund last quarter came back with today's permissions.
- New locations were created without a time zone and defaulted to UTC. For weeks their business dates were shifted, and daily sales did not match the till reports sellers printed.

**Evaluation Criteria.** Entities with stable ids and effective-dated relationships (pairings, assignments, roles, permission-set versions, location attributes); location, time zone and business date stamped on the payment at write time; a daily sales fact by location and business date with as-of and current dimension options; a correct "who could refund on date D" walk; non-overlapping intervals with a stated boundary convention; team-member data minimised; each incident contained, corrected and guarded.

## BLK-L3-02: Instalment plans as data — purchases, schedules, payments, late fees, rescheduling and refunds that shrink what is left

| | |
|---|---|
| **Template ID** | BLK-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned schedules, payment allocation, fees as charges, refund allocation, receivables on a date |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "monthly_plans": {"1": ["2 million"], "2": ["10 million", "20 million"], "3": ["40 million", "60 million"]},
  "schedule_rule": ["four instalments, the first at checkout and the rest every two weeks", "four instalments, the first at checkout and the rest every two weeks, or six monthly instalments for larger orders"],
  "late_fee_rule": ["a fixed late fee when an instalment is still unpaid 10 days after its due date, with all fees on a purchase capped at 25% of the order", "a late fee charged once per missed instalment after a 3-day grace period, capped per purchase"],
  "partial_refund_share": ["4%", "9%"]
}
```

**Business Scenario.** A buy-now-pay-later service lets a shopper split a purchase at a merchant into instalments. In this exercise's rule (check current docs) a plan is {{schedule_rule}}; the instalments are equal except that any leftover cents go on the first. The shopper's card is charged automatically on each due date; a failed charge is retried, and the shopper can pay early or move a due date within limits. In this exercise {{late_fee_rule}}. Merchants can refund all or part of a purchase at any time; about {{partial_refund_share}} of plans see a partial refund, which in this exercise reduces the remaining instalments starting from the last one, and refunds the shopper's money only for any amount beyond what is still unpaid. About {{monthly_plans}} plans start each month. Finance wants receivables outstanding on any date; the product team wants the share of instalments paid on time by purchase cohort; support wants to explain any plan's history to its shopper.

**Problem Statement.** Design the data model. Cover: purchases and plans; schedules as versions (original, after a reschedule, after a refund), each with instalments carrying due date and amount; payment attempts (succeeded, failed, retried) and how a successful payment is allocated to instalments (including early and partial payments); late fees as their own charges, with waivers; refunds and how each is allocated to instalments and, beyond that, to money returned; plan status. State the invariants that must hold on every plan, and the facts behind "receivables outstanding on a date", "on-time rate by purchase-month cohort and instalment number" and "late fees charged and waived per month".

**Constraints.** Money is integer cents. For every plan at every moment: Σ current instalment amounts = order amount − refunds allocated to instalments, and Σ payments allocated = Σ instalments paid. An instalment's due date at the time a fee was charged must be reconstructable. Fees never exceed the cap in this exercise's rule. Analytics never draw conclusions about a person's credit-worthiness or eligibility; they measure plans and instalments.

**Assumptions.** Volumes, schedules, fee rules and shares are hypothetical and are this exercise's rules, not a statement of any real product's terms. One currency per plan. Each shopper's local date decides due dates in this exercise.

**Clarifications.**
- Q: How is $100.01 split into four? | A: In this exercise, 2501 + 2500 + 2500 + 2500 cents: leftover cents go on the first instalment.
- Q: Does a reschedule create a new plan? | A: No. The plan keeps its id; a new schedule version replaces the remaining instalments' due dates. The old version stays readable.
- Q: A merchant refunds $30 on a plan with $50 unpaid in two instalments of $25. What happens? | A: In this exercise the last instalment drops to 0 and the one before it to $20; nothing is returned to the shopper because the refund is less than what is unpaid.
- Q: Can a late fee be waived? | A: Yes, by support, with a reason. The waiver is its own record; the fee row is never deleted.
- Q: What counts as "on time"? | A: Paid in full by the end of the due date in the shopper's time zone, against the due date in force when the instalment fell due. You decide how rescheduled instalments are reported.

**Hints.**
1. Keep plans, schedule versions, instalments, payment attempts, payment allocations, fees, waivers and refund allocations as separate tables; a plan's state is derived from them.
2. Allocation rows (payment → instalment, refund → instalment or money returned) make the invariants checkable with sums.
3. Receivables on a date are instalment amounts in force on that date minus allocations made by that date, read from versioned rows, never from the plan's current status.

**Follow-ups.**
1. Walk one plan: a $100.01 purchase, the second instalment's charge fails twice and succeeds four days late, then a $30 partial refund. Show the rows each event writes.
2. A shopper moved the third due date by a week. Is that instalment on time or late in the cohort report, and what does your model let you show either way?
3. A refund arrives after the plan is fully paid. Where does the money go, and which rows record it?
4. Finance asks for receivables outstanding at month end, restated when a later refund applies to an earlier purchase. Which date does the refund use, and how is the restatement labelled?
5. At {{monthly_plans}} new plans a month with a schedule version on every change, how do you partition and serve "the plan as it stood on a date" for support?

**Follow-up rules.**
- when: status column, paid flag, update the instalment → ask: The second instalment's due date moved and then a partial refund changed its amount. With one row updated in place, what was due on the original date, and was the late fee right?
- when: amount / 4, divide by 4, split evenly → ask: Show the cents for an order of 10001. Where do the leftover cents go, and how does a refund that shrinks the last instalment keep the sum exact?
- when: credit score, risk score, creditworthiness, default rate → ask: Which of these measures is about plans and which would be a judgement about a person? What does this model refuse to store or show?
- when: late fee → ask: The fee was charged and later waived, then the instalment was paid. How does the fee report for that month look before and after the waiver?
- when: utc, timestamp, due_at → ask: A shopper in a zone behind UTC pays at 21:00 local on the due date. Is it on time in your model, and which date column decides?

**Production Reality Check.**
- A release overwrote due dates in place when shoppers rescheduled. Late fees charged under this exercise's rule ({{late_fee_rule}}) can no longer be shown to have been correct, and support cannot tell shoppers what was due when.
- Partial refunds (about {{partial_refund_share}} of plans) were applied to the next instalment instead of the last; the next charge dropped to 0, later instalments were unchanged, and on-time rates rose for the wrong reason.
- A refund on fully paid plans was recorded as reducing remaining instalments, of which there were none; the amount was dropped and shoppers were not refunded.

**Evaluation Criteria.** Plans with versioned schedules and instalments; payment attempts separated from allocations; leftover-cent rule explicit; fees and waivers as their own records with the cap enforced; refund allocation from the last instalment with any excess returned; invariants as checkable sums; receivables and on-time rates read from versions in force on a date; no person-level credit judgements; each incident contained, corrected and guarded.

## BLK-L3-03: Point-of-sale orders as data — line items, modifiers, discounts, taxes, tips, split tenders and partial refunds

| | |
|---|---|
| **Template ID** | BLK-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / order line grain, allocation with exact rounding, tax lines, tenders and refund allocation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_orders": {"1": ["3 million"], "2": ["15 million", "30 million"], "3": ["60 million", "90 million"]},
  "tax_rule": ["a sales tax is added on top of prices, and some items are exempt", "prices already include tax, at two rates depending on the item"],
  "split_share": ["3%", "8%", "12%"],
  "tip_rule": ["entered on the reader before payment, or, at table-service sellers, added to a signed receipt and adjusted after the order closes", "added to a signed receipt and adjusted after the order closes, up to a day later"]
}
```

**Business Scenario.** Sellers ring up about {{daily_orders}} orders a day. An order has line items (an item variation, a quantity and a unit price), each with optional priced modifiers (an extra shot, a larger size); discounts can apply to one line or to the whole order, as a percentage or a fixed amount. In this exercise, {{tax_rule}}. Tips are {{tip_rule}}. About {{split_share}} of orders are paid with more than one tender: two cards, card and cash, or a gift card and a card. Later, a seller can refund part of an order: some units of one line, or an amount with no item. The seller's reports must show net sales per item and modifier, discounts given, tax collected per tax, tips per team member and tender mix, and every report must agree with the money that actually moved.

**Problem Statement.** Design the data model for orders and their payments. Cover: order, line, modifier, discount (with its application to lines), tax (per line and tax), service charges, tenders (type, amount, tip, card details kept to what reporting needs), refunds (per line and quantity, or amount only) and their allocation to tenders; how an order-level discount and the tax on it are allocated to lines so that every line and the order total agree to the cent; and the facts at their grains: order line, tender, refund line. Define net sales, and the invariants that tie lines, taxes, tenders and refunds together.

**Constraints.** Money is integer cents. Σ line totals (after discounts and tax) + service charges = order total; Σ tenders = order total + tips. A refund never returns more than a line's paid amount for its quantity, or more than a tender received. Allocations are computed once, stored, and never recomputed with different rounding. Card details beyond brand, entry method and last four digits never reach analytics.

**Assumptions.** Order volumes, tax rules and shares are hypothetical; tax rules here are this exercise's rules and not tax advice. One currency per order. Items and modifiers reference an item library that changes over time; the order keeps the name and price at the time of sale.

**Clarifications.**
- Q: How is a 10% order discount split across lines? | A: Pro rata by line amount, rounded so the line shares add up exactly to the discount (for example, largest remainder). Store the result.
- Q: Is a tip part of net sales? | A: No. Tips belong to the team, are reported separately, and are not taxed in this exercise.
- Q: A gift card and a card paid an order; one item is refunded. Which tender gets the money back? | A: Your rule, stated. A common choice refunds to the original tenders in a fixed order, never more than each paid.
- Q: Does a refund return the tax? | A: Yes, the tax on the refunded part, allocated the same way as when sold.
- Q: Can a line's price change after the sale? | A: No. A correction is a refund and a new sale.

**Hints.**
1. The order line is the grain for sales; the tender is the grain for money received. Keep both and tie them with invariants.
2. Allocate order-level amounts once with an exact method (largest remainder or "last line takes the rest") and store the per-line shares.
3. Refunds are their own lines referencing the original line and quantity, plus refund-tender rows; never edit the sale.

**Follow-ups.**
1. Work an order: two coffees at 450 with a 60-cent modifier on one, a pastry at 375, a 10% order discount and the tax rule given. Show every line's discount, tax and total in cents and prove the invariants.
2. Half of the coffees are refunded on an order split between a gift card and a card. Which rows are written, and how does net sales per item change?
3. A tip is adjusted after the order closes. Which fact changes, on which business date, and how does the tender mix stay right?
4. The item is renamed and repriced next month. How do this month's reports still show what was sold?
5. At {{daily_orders}} orders a day, which facts do you keep at line grain for years, and how do you rebuild daily summaries when a refund lands weeks later?

**Follow-up rules.**
- when: round each line, round(, rounding → ask: Three lines each get a third of a 100-cent discount. What do your rounded shares add up to, and how do you make them equal the discount exactly?
- when: one row per order, orders table, order total → ask: Net sales by item needs the discount and tax per line. Where do those live if the order is one row?
- when: tender, split tender → ask: An item paid partly by gift card and partly by card is refunded. How much goes back to each, and what stops a tender from being refunded more than it paid?
- when: tip, tips → ask: A tip is adjusted after close and the tender row is re-sent. How do you avoid counting the payment twice in the tender mix?
- when: card number, pan, card details → ask: Which card details does reporting actually need, and what keeps the rest out of the warehouse?

**Production Reality Check.**
- Order-level discounts were allocated to lines with each share rounded on its own. In about 0.4% of orders lines summed to one cent more or less than the order total, and net sales per item no longer reconciled with tenders.
- With {{split_share}} of orders on several tenders, partial refunds were all sent back to the first tender. Some gift cards received more than they had paid, and some card tenders show refunds above their charge.
- Tips are {{tip_rule}}. After a release, each tip adjustment arrived as a new tender row; payments counted per order doubled for those orders, and tender mix shifted toward cards.

**Evaluation Criteria.** Order, line, modifier, discount application, tax line, tender and refund entities at clear grains; exact allocation with stored shares; invariants for lines, totals, tenders and refunds; refunds as new rows referencing lines and tenders with per-tender caps; tips apart from sales; point-in-time item names and prices on lines; card data minimised; each incident contained, corrected and guarded.

## BLK-L3-04: Gift cards and store credit as data — issuance, loads, redemptions across locations, expiry and balances on a date

| | |
|---|---|
| **Template ID** | BLK-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / stored-value activity log, concurrent redemption, offline devices, expiry rules, balances on a date |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "active_cards": {"1": ["5 million"], "2": ["40 million", "80 million"], "3": ["150 million", "250 million"]},
  "credit_expiry": ["store credit expires 12 months after it is issued", "store credit expires 6 months after its last use"],
  "offline_cap": ["5000 cents ($50)", "10000 cents ($100)"],
  "max_locations": [20, 300]
}
```

**Business Scenario.** Sellers sell gift cards, physical (printed in batches, activated at the till) and digital (bought online and emailed). A card is loaded with an amount, can be reloaded, and is redeemed at any of the seller's up to {{max_locations}} locations, often for part of an order with the rest on another tender. A refunded purchase that was paid by gift card goes back onto the card. Sellers also issue store credit for returns; in this exercise gift cards do not expire, but {{credit_expiry}} (this exercise's rule; check current docs and local law, which differ by place). Some readers take payments in offline mode, and in this exercise an offline device may redeem up to {{offline_cap}} from a card whose balance it last saw. There are about {{active_cards}} cards with a balance. Sellers want each card's history, the outstanding balance on any date, and redemptions by location; the issuing location and the redeeming location are often different.

**Problem Statement.** Design the data model for gift cards and store credit. Cover: the instruments (gift card, store credit) and their lifecycle (created, activated, loaded, redeemed, refunded onto, expired, cleared, blocked); an append-only activity record with types, signed effects and keys to the order and location; how a card's balance is read quickly while the activity record stays the truth; how two simultaneous redemptions on the same card are prevented from overdrawing it online, and what happens when offline redemptions arrive later; how expiry is applied and recorded; and the facts behind "outstanding balance per seller on a date", "redemptions by location versus issuing location" and "store credit expiring next month".

**Constraints.** Money is integer cents. A card's balance at any past instant equals the signed sum of its activities up to that instant. An online redemption never takes a balance below zero; an offline one may, and must then be visible and resolved. Expiry is an activity, not a deletion. Card numbers are never stored in analytics; a surrogate card id is.

**Assumptions.** Card counts, caps and expiry rules are hypothetical and are this exercise's rules. One currency per seller. Cards are redeemable only at the issuing seller's locations. The accounting treatment of unredeemed balances is the seller's decision; the model reports amounts and leaves conclusions to them.

**Clarifications.**
- Q: Is the balance stored on the card or computed? | A: Both, if you like: a stored balance for speed, but the activity record is the truth and the two must reconcile.
- Q: Two tills redeem the same card in the same second. What should happen? | A: Online, exactly one of them succeeds if the balance covers only one. Say how.
- Q: An offline redemption arrives after the card was emptied online. What then? | A: The redemption already happened at the till. Record it, show the negative balance, and route it to the seller; nothing here decides who is at fault.
- Q: Does a balance check count as use? | A: No. In this exercise only loads, redemptions and refunds onto the card count as use.
- Q: When does store credit expire under a "since last use" rule? | A: The expiry moves each time the credit is used; record the rule version and the computed expiry date.

**Hints.**
1. One append-only activity table per instrument (type, signed amount, order, location, device, occurred_at, synced_at) plus a balance row kept in step in the same transaction for online writes.
2. Prevent online overdraw with a conditional update on the balance row (balance ≥ amount) or a version check; the activity and the balance change commit together.
3. Offline activities carry the device's occurred time and a later sync time; balances on a date use occurred time, and late arrivals restate the past.

**Follow-ups.**
1. Walk a card: activated at 5000 at one location, redeemed 3200 at another, a 1200 refund back onto it, then two tills try to redeem 2500 at the same moment. Show the rows and the balance after each.
2. An offline reader redeems up to {{offline_cap}} from a card that was emptied online in the meantime. What does the seller see, and how does the outstanding balance report for that day change when the offline activity syncs?
3. Write the definition of "outstanding balance per seller on a date" and say how a late offline activity changes a report already sent.
4. Under the rule that {{credit_expiry}}, how do you produce "store credit expiring next month" and the expiry activities themselves, and in which time zone?
5. At {{active_cards}} cards with a balance, how do you serve a balance lookup at the till in milliseconds and still prove nightly that every stored balance equals its activity sum?

**Follow-up rules.**
- when: balance column, update balance, current balance → ask: A seller asks for the card's balance on 1 March last year. With only the current balance stored, what can you answer?
- when: lock, select for update, optimistic → ask: Show the exact statement that makes two simultaneous 2500 redemptions on a 3000 balance end with one success. What does the loser see?
- when: offline → ask: The offline redemption already happened. Do you reject it on sync, accept it into a negative balance, or something else, and who is told?
- when: expire, expiry, expired → ask: The expiry job ran in UTC and some locations are hours behind. Which credits expired a day early, and how do you reverse them without deleting rows?
- when: card number, gift card number → ask: Which id does the warehouse use for a card, and how does support still find a card from the number on its back?

**Production Reality Check.**
- After an outage, readers in offline mode synced several hundred redemptions at once; cards redeemed up to {{offline_cap}} offline were also emptied online, and some balances went below zero with no alert to sellers.
- The expiry job for store credit ({{credit_expiry}}) ran on UTC dates and expired credit a day early for locations behind UTC; shoppers were turned away at the till with credit they still held.
- A data migration replayed a day of load activities. Outstanding balances for a seller with {{max_locations}} locations jumped, and stored balances no longer matched the activity sums.

**Evaluation Criteria.** Instruments with a lifecycle; an append-only typed activity record with order, location and device keys; a stored balance kept in step and reconciled nightly; a race-free online redemption; offline activities with occurred and synced times and visible negative balances; expiry as an activity under a versioned rule in local time; balances on a date from occurred time; card numbers kept out of analytics; each incident contained, corrected and guarded.

## BLK-L3-05: Gift card balances on a date, and cards untouched for twelve months, per seller

| | |
|---|---|
| **Template ID** | BLK-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / signed activity sums, end-of-day boundaries, dormancy cutoffs, local dates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | BLK-L3-05.mjs |

**Business Scenario.** Sellers on a point-of-sale platform sell gift cards. Each card belongs to one seller and is redeemable at any of that seller's locations. Every change to a card is a row in `gift_card_activities` with a kind and a non-negative `amount_cents`; the kind decides the sign. A printed card exists in `gift_cards` before it is activated; a card's first activity is always `activate`. In this exercise gift cards do not expire. Sellers want their outstanding gift card balance on a chosen date, and how much of it sits on cards nobody has used for a year.

**Problem Statement.** Write one PostgreSQL query that returns `seller_id, cards_with_balance, outstanding_cents, dormant_cards, dormant_cents` as of the end of {{as_of_date}}: one row per seller that has at least one card activated by then, ordered by `seller_id`. A card's balance is the sum of its activities up to the end of the as-of date, signed by kind: {{kinds_rule}} `cards_with_balance` counts the seller's cards whose balance is above 0, and `outstanding_cents` sums those balances. A card is dormant when its balance is above 0 and its last activity up to the end of the as-of date fell on or before {{cutoff_date}}, twelve months earlier. `dormant_cards` and `dormant_cents` count and sum the dormant cards' balances. {{tz_rule}}

**Constraints.** One SQL statement (CTEs allowed). "The end of the as-of date" includes 23:59:59 on that date and excludes 00:00:00 on the next. Activities after the as-of date are ignored for both the balance and the last activity. A seller whose activated cards all have zero balance still gets a row of zeros. The sample has {{cards}} cards and {{activities}} activities; production has hundreds of millions of cards.

**Assumptions.** Hypothetical schema, sellers and amounts. Amounts are integer cents. A redemption never exceeds the card's balance at the time, so balances are never negative in this data. Time zones here observe no daylight saving time, but your query should not depend on that.

**Clarifications.**
- Q: Does a card created but never activated count? | A: No. A card counts from its `activate` activity; until then it holds nothing.
- Q: Is a card whose last activity was exactly on the cutoff date dormant? | A: Yes. Last activity on or before the cutoff date means untouched for twelve months.
- Q: A card was untouched for a year on the as-of date but reloaded a week later. Dormant? | A: Yes, as of the as-of date. Later activities do not exist yet on that date.
- Q: Does `created_at` on `gift_cards` matter? | A: No. It is when the card was printed or issued, not when it was activated or used.
- Q: Do I need the location? | A: No. Balances are per card and seller, whichever location the activity happened at.

**Hints.**
1. Work out each seller's two boundaries first: the instant the as-of date ends and the instant the day after the cutoff date starts, both at local midnight.
2. Aggregate activities per card up to the as-of boundary: a signed balance with `CASE`, and the last activity time with `MAX(...) FILTER (WHERE ...)`.
3. Then aggregate cards per seller with `COUNT(*) FILTER` and `SUM(...) FILTER`, wrapping sums in `COALESCE(..., 0)`.

**Follow-ups.**
1. At hundreds of millions of cards, how would you serve this per seller for any date without summing every activity since the card was activated?
2. Offline redemptions sync days late with their original `occurred_at`. How does that change a report already sent for the as-of date, and how would you label it?
3. Sellers ask for the dormant balance by the location that sold the card. What changes in the query, and where does "the location that sold it" come from?
4. A rule change makes balance checks count as use. Which part of your query changes, and what happens to last month's numbers?

**Follow-up rules.**
- when: created_at → ask: A printed card was created a year ago and activated yesterday. What does created_at tell you about its dormancy?
- when: interval '12 months', interval '1 year', - interval → ask: Your cutoff is a timestamp twelve months before the end of the as-of date. Is a card whose last activity was at exactly that instant dormant, and is that what the rule says?
- when: having, inner join, where balance → ask: A seller's activated cards are all spent. Does that seller still get a row in your result?
- when: max(occurred_at), last activity → ask: Does your last activity include balance checks, and activities after the as-of date?
- when: at time zone, time_zone → ask: Which midnight is the end of the as-of date for a seller in Tokyo, and which instant is that in UTC?

**Production Reality Check.**
- The report for {{as_of_date}} was run with `occurred_at::date <= '{{as_of_date}}'` in UTC; sellers in zones ahead of UTC saw next-morning redemptions inside the month and the balances they printed at the till disagreed.
- A version of the report took the last activity over all time; a seller's year-end dormant balance fell sharply after a reload promotion in the new year, and the earlier report could not be reproduced.

**Evaluation Criteria.** Activities signed by kind and summed per card up to the end of the as-of date; last activity limited to the same window and excluding balance checks where stated; the cutoff inclusive of its date and exclusive of the next day's midnight; dormant only with a positive balance; sellers with only spent cards kept; local-date boundaries per seller at the hardest level; deterministic ordering; can explain snapshots for speed and restatement for late data.
