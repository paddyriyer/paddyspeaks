# Block · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of point-of-sale
software and hardware for sellers, peer-to-peer payments and buy-now-pay-later
instalments. Every workload, number, limit and schema is hypothetical; product
rules (offline limits, deposit cut-offs, transfer fees and limits) are this
exercise's rules (check current docs), and nothing here describes how the
company's own systems are built. Money is always held in integer minor units
(cents).

## BLK-L4-01: Restaurant order flow — tickets to kitchen displays, course timing and table turns in local time

| | |
|---|---|
| **Template ID** | BLK-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Operational event flow / local routing, ticket state machines, time-zone-correct metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "locations": {"2": ["8,000", "20,000"], "3": ["60,000", "150,000"]},
  "stations": [3, 5, 8],
  "time_zones": [4, 6, 11],
  "close_hour": ["3 a.m.", "4 a.m.", "5 a.m."]
}
```

**Business Scenario.** A point-of-sale product for restaurants runs in about {{locations}} locations across {{time_zones}} time zones. Servers enter orders on handhelds and registers at the front of house; each order becomes a ticket whose items are routed to kitchen display screens at up to {{stations}} stations per location (grill, fry, cold, pastry, bar). Items are grouped into courses: the first course is sent to the kitchen at once, later courses are held and "fired" when the server or the expo station says so. A cook bumps an item or a ticket off the screen when it is done; a bump made by mistake can be recalled. Tables are seated, ordered, paid and cleared. Owners want reports on ticket times per station, the gap between courses, and table turns per location and daypart. Under this exercise's rule (check current docs), a location's business day ends at {{close_hour}} local time, so a ticket at 1 a.m. belongs to the previous day's dinner service.

**Problem Statement.** Design the system end to end: how a ticket travels from the front of house to the right kitchen screens quickly and reliably, the event model for tickets, items, courses, bumps and tables, and the analytics. Define precisely: ticket time per station, course gap, and table turn time, including what happens when an item is added, voided or remade after the ticket was sent, when a check is split, and when a party moves tables. Say how every report is placed in the location's own business day and daypart.

**Constraints.** A ticket must appear on the kitchen screen within one second of being sent at p99, including during a busy dinner service. If the location's internet connection drops, the front of house and the kitchen must keep working with each other. Owners with several locations compare them side by side, each in its own local time. Reports for yesterday must be final by 9 a.m. local time; today's numbers may be minutes behind. Device clocks within one location can disagree by a few seconds, sometimes by minutes.

**Assumptions.** All counts, timings and volumes are hypothetical. Each location has a registered address and IANA time zone. Devices in a location share a local network. Menu items carry a station routing set by the owner, and owners rename and re-route stations whenever they like.

**Clarifications.**
- Q: Is ticket time measured from when the server sent it, or from when the kitchen screen showed it? | A: Owners want both: the time the kitchen spent and the time the guest waited. Define both and say which timestamps each uses.
- Q: Does a held course count toward ticket time while it waits to be fired? | A: No. Kitchen time for a course starts when it is fired; the guest's wait between courses is the course gap.
- Q: How should a remake count? | A: It is a new item on the same ticket and station, linked to the item it replaces; owners want remakes counted separately, not hidden inside the average.
- Q: What about locations that never close, or that close after the business-day cut-off? | A: The {{close_hour}} rule applies to every location in this exercise; a ticket is assigned to the business day in which it was sent.
- Q: Can owners change a location's time zone? | A: Only when it was set wrong. Decide whether history moves with the correction.

**Hints.**
1. Separate the latency-critical path inside the location (front of house to kitchen screens) from the path to the cloud for analytics; they need different guarantees.
2. Give every ticket, item and course a stable id created where the order is entered, and model each as a state machine driven by events, so late and repeated events are harmless.
3. Store instants in UTC with the location's time zone, and derive the business day and daypart from local time at query or build time, not at the device.

**Follow-ups.**
1. Walk through one table of four with two courses and a remade main: which events are produced, in what order, and what each metric reports for it.
2. How do the kitchen screens keep receiving tickets when the location's internet is down, and what reaches the cloud when it comes back?
3. Two devices in the same location disagree on the time by three minutes. Which timestamps do your metrics trust, and how do you detect the skew?
4. The clocks change for daylight saving in one time zone on a Sunday. Walk through Saturday's late service and Sunday's brunch in your reports.
5. An owner renames the "grill" station to "hot line" and moves half its items to a new station mid-month. How do ticket-time trends per station stay readable?

**Follow-up rules.**
- when: websocket, pub/sub, push, cloud → ask: The location's internet drops in the middle of dinner service. Which path does a new ticket take to the grill screen now, and what happens to tickets already in flight?
- when: device timestamp, client time, local clock → ask: One kitchen screen's clock is four minutes fast. What do your ticket times look like for that station, and how would you find out?
- when: utc, timestamp with time zone, time zone → ask: A ticket is sent at 1:30 a.m. local time on the night the clocks go back. Which business day and daypart is it in, and how many minutes long was that night?
- when: average, averages → ask: One ticket was left on the screen overnight and bumped the next morning. What does it do to your average, and what would you report instead?
- when: state machine, bump, recall → ask: A cook bumps a ticket by mistake and recalls it 40 seconds later. What does the event history look like, and what does ticket time report?

**Production Reality Check.**
- After the clocks go back in one of the {{time_zones}} time zones, Sunday's brunch report for every location in that zone shows a median ticket time of −58 minutes at one station and a table turn of 25 hours.
- A busy location's internet connection drops for 40 minutes during dinner service. The kitchen keeps cooking, and when the connection returns about 1,500 events arrive at once, with one kitchen screen's timestamps three minutes ahead of the registers'.
- An owner of 120 locations re-routes desserts from the cold station to a new pastry station on a Wednesday. The chain's cold-station ticket time "improves" by 22% the next week, and the owner asks whether the new kitchen training worked.
- A firmware bug makes some kitchen screens send each bump event twice. Ticket counts per station rise about 8% for the affected locations, while orders and sales stay flat.

**Evaluation Criteria.** Separates the in-location latency path (local routing over the location's network, a local coordinator or peer delivery with acknowledgements, store-and-forward to the cloud) from the analytics path; stable ids created at order entry and event-sourced state machines for tickets, items, courses and tables that tolerate duplicates and late events; precise metric definitions (kitchen time from fire to bump, guest wait from send, course gap, table turn) with explicit handling of voids, remakes, split checks, moved tables and recalls; UTC instants plus the location's time zone, business day and daypart derived from local time with the {{close_hour}} cut-off and daylight-saving changes; clock-skew handling (server receipt time, per-device offset estimates); station history kept so renames and re-routes do not break trends; percentiles rather than means; adapts to each incident with diagnosis, recovery and prevention.

## BLK-L4-02: Seller risk review — signals from aggregates, a given score, payment holds and an audit trail

| | |
|---|---|
| **Template ID** | BLK-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Risk operations data / point-in-time signals, case management, reproducible decisions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "sellers": {"2": ["2 million", "4 million"], "3": ["8 million", "15 million"]},
  "reviewers": [40, 120, 300],
  "review_hours": [24, 48, 72],
  "audit_years": [5, 7]
}
```

**Business Scenario.** A payments product serves about {{sellers}} active sellers. A risk team reviews sellers whose activity looks unusual, so that payments that are likely to be refunded or reversed do not leave the seller's balance before anyone has looked. Another team owns a risk score: you are given a service that returns a score and a score version for a seller and a set of input signals. Your system computes those signals from aggregates of the seller's own activity (for example volume compared with the seller's own history, refund and reversal rates, the mix of in-person and keyed-in payments), routes sellers to review, applies holds when a reviewer decides on one, and keeps the record. Under this exercise's rule (check current docs), a hold delays part or all of a seller's deposits until a review is complete; it never changes what the seller has earned. {{reviewers}} reviewers work the queue, and the target is a decision within {{review_hours}} hours of a case opening.

**Problem Statement.** Design the system: signal computation from aggregates (with the time each value was true), how the given score and a set of written rules open cases, the case and review workflow, how holds are applied and released, what the seller is told and when, and the audit trail. Show how, years later, anyone with the right access can reproduce exactly what the reviewer saw and why the decision was made. Say how you would measure whether reviews are timely and consistent, and whether holds fall unevenly on particular kinds of sellers. You do not design the score itself, and how someone might try to avoid these controls is out of scope.

**Constraints.** No hold is placed without a reviewer's decision, except a short automatic hold that a written rule allows and that a reviewer must confirm or release within {{review_hours}} hours. Every case, signal snapshot, score and version, rule version, decision, reason and message to the seller is kept for {{audit_years}} years (this exercise's rule; check current docs). Reviewers see only what a case needs; analysts outside the risk team see aggregates only. The system draws no legal conclusion and no judgement about a person's creditworthiness; it records what was observed and what was decided.

**Assumptions.** All volumes, periods and rates are hypothetical. Payment, refund and reversal events arrive from the payments platform within minutes; the balance and deposit systems are given and accept a hold or release instruction with a reason code. Signals are computed hourly; the score service answers in under 200 ms.

**Clarifications.**
- Q: Can a reviewer see a seller's individual customers' details? | A: Only what the case needs, such as amounts, times and payment types for the flagged activity. Say how you enforce that.
- Q: What does the seller see? | A: That part of their deposits is held for review, roughly how long it usually takes, and what information could help. They do not see the score or the rules.
- Q: Does a new score version apply to open cases? | A: Your call. Existing decisions must stay explainable by the version that informed them.
- Q: Can a seller appeal? | A: Yes. An appeal reopens the case with a different reviewer, and the outcome is recorded alongside the original.
- Q: Are signals ever corrected after the fact? | A: Yes, when a bug is found. Decide what that means for decisions already made.

**Hints.**
1. A decision is reproducible only if the inputs are frozen at decision time: store a snapshot of the signal values, the score and its version, and the rule version on the case, not a pointer to tables that will be recomputed.
2. Treat the case as the unit of work: a state machine (opened, assigned, decided, appealed, closed) with every transition an append-only event carrying who and why.
3. Measure the queue the way a seller experiences it: time from case open to decision and from hold to release, by percentile, not only cases closed per day.

**Follow-ups.**
1. Walk through one seller: an unusual week, a case opens, a reviewer places a partial hold, the seller sends information, the hold is released. Which records exist at the end?
2. How do you compute signals so that a value used three months ago can be shown exactly as it was, even after the signal job is fixed and rerun?
3. The score team ships a new version that would open twice as many cases. How do you introduce it without flooding the queue or changing past decisions?
4. How would you show, from aggregates, whether holds fall more often on certain business categories or regions than their outcomes justify, and what would you do with the answer?
5. A bug inflated one signal for a month. How do you find every decision it may have influenced, and what happens to those sellers?

**Follow-up rules.**
- when: automatic, automate, auto-hold → ask: A rule places automatic holds on 3,000 sellers in an hour, and reviewers can confirm or release about 200 an hour. What does a seller in that queue experience, and what stops this from happening again?
- when: recompute, backfill, rerun → ask: You rerun the signal job with a fix. A seller asks why they were held in March. Which numbers does the reviewer show them, the old ones or the corrected ones?
- when: feature store, signals table, snapshot → ask: Where exactly is the value the reviewer saw stored, and what stops a later job from overwriting it?
- when: precision, false positive, accuracy → ask: Most held sellers are released with no loss. Is that a failing system, a cautious one, or a working one? What measure would tell you?
- when: access control, permission, least privilege → ask: An analyst wants per-seller hold histories to study reviewer consistency. What do you give them?

**Production Reality Check.**
- A new score version goes live on a Monday and cases triple overnight. Within the week the oldest open case passes {{review_hours}} hours; most of the new cases are restaurants in one region whose volume rose legitimately after a holiday weekend.
- A seller who was held four months ago asks for an explanation. The signal tables have since been recomputed after a bug fix, and the refund rate in today's table differs from the one the reviewer saw.
- A change to the signal job counts each refund once per location for sellers with several locations, so their refund rates double for 11 days before anyone notices.
- A release instruction to the deposit system fails silently for 2% of decided cases; those sellers' holds stay on for days after reviewers released them.

**Evaluation Criteria.** Signals computed from aggregates with validity intervals (point-in-time correct) and versioned code; the given score called with its version recorded; cases as append-only state machines; a decision record that freezes signal values, score and version, rule version, reviewer, reason codes and messages, kept for {{audit_years}} years; holds applied and released through the deposit system with acknowledgement and reconciliation (every decided case has a matching hold state); queue design and capacity reasoning against {{reviewers}} reviewers and the {{review_hours}}-hour target, with safe introduction of new score versions (shadow scoring, capped case volume); least-privilege access for reviewers and aggregates for analysts; fairness and consistency measured from aggregates of outcomes (release rate, loss rate, time held) by category and region; stays general about risk signals, gives no detail that would help someone avoid a control, and draws no legal or credit conclusions; adapts to each incident with diagnosis, recovery and prevention.

## BLK-L4-03: Offline-capable point of sale — device-stored payments and orders, sync on reconnect, catalogue conflicts and late analytics

| | |
|---|---|
| **Template ID** | BLK-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Edge sync / store-and-forward, conflict rules, watermarks and restated reports |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 55 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "devices": {"2": ["400,000", "900,000"], "3": ["3 million", "6 million"]},
  "offline_hours": [24, 48, 72],
  "offline_cap": ["$300", "$1,000", "$5,000"],
  "devices_per_location": [2, 4, 8]
}
```

**Business Scenario.** A point-of-sale app runs on about {{devices}} phones, tablets and registers, with up to {{devices_per_location}} devices at a location. When the device cannot reach the internet, the seller can keep taking card payments in offline mode: under this exercise's rule (check current docs), each offline payment is stored encrypted on the device and must be forwarded for authorisation within {{offline_hours}} hours of being taken, or it expires and cannot be processed; a payment declined when it is forwarded is the seller's loss; and a seller may set a per-payment limit for offline payments of up to {{offline_cap}}. Orders, items sold, discounts and stock decrements are also recorded on the device. Meanwhile the seller, or a colleague on another device, may change prices, items and stock counts in the online dashboard.

**Problem Statement.** Design the device-side store, the sync protocol, the conflict rules for the catalogue and stock, and the analytics. Cover: how payments and orders are identified on the device so that forwarding twice never charges twice and never counts twice; the order in which a reconnecting device sends its backlog; what wins when the dashboard and an offline device both changed the same item, price or stock count; what the seller is shown about payments not yet forwarded and payments declined after forwarding; and how daily sales reports handle data that arrives up to {{offline_hours}} hours late.

**Constraints.** Card data stays encrypted on the device as the payment-industry rules require and never enters analytics. A device may be offline for minutes or for days. Payments must be forwarded in a bounded time after reconnecting even when thousands of devices reconnect together. Reports for a day may change after the day ends, but every change must be explainable, and the seller's sales summary must agree with what eventually settles.

**Assumptions.** All volumes, limits and periods are hypothetical. Each device has a stable device id and a monotonically increasing local sequence number. The payment authorisation service and the catalogue service are given; you design how the device and the data platform use them.

**Clarifications.**
- Q: Can the device check stock with the server before selling offline? | A: No. Offline, it only knows its last synced catalogue and its own sales.
- Q: Which price is right if the dashboard changed it while the device was offline? | A: The price the customer was charged is the sale price. Decide what the catalogue and the reports show.
- Q: Do declined offline payments disappear from sales? | A: Not silently. The seller must see them, and the reports must say what happened.
- Q: Does an expired offline payment ever reach the payments platform? | A: Not under this exercise's rule. It exists only on the device and in whatever the device reports about it.
- Q: How late can an order event be? | A: For a device that reconnects within the limit, up to {{offline_hours}} hours; orders without card payments can be later still.

**Hints.**
1. Create every payment and order id on the device, before anything is sent, and make every server-side write keyed by that id; then retrying a whole backlog is harmless.
2. Treat a stock count as a set of signed changes from many devices rather than a value to overwrite; changes merge, overwrites lose sales.
3. A daily report needs a watermark per device and a status per day (provisional, final); know how many devices still owe data for a day before calling it final.

**Follow-ups.**
1. Walk through a device that goes offline at 11:00, takes 40 card payments, and reconnects at 17:00 after the price of one item changed in the dashboard at 13:00.
2. Two offline devices at one location each sell the last three units of an item. What stock does the dashboard show after both reconnect, and what does the seller see?
3. A regional outage reconnects tens of thousands of devices within ten minutes. How do you forward their payments quickly without overwhelming authorisation?
4. How do you decide when a day's sales report is final, and how are later corrections shown to the seller?
5. A device is lost with stored payments on it. What does the seller see, and what can be recovered?

**Follow-up rules.**
- when: last write wins, lww, overwrite → ask: The dashboard sets stock to 20 at 12:00; an offline device sold 5 at 11:30 and syncs at 13:00. What does last-write-wins leave, and is it right?
- when: crdt, merge, counter → ask: Merged decrements leave the count at −3 after two devices both sold the last units. What does the seller see, and who fixes it?
- when: queue, backlog, retry → ask: A device retries its backlog after a timeout, but the first attempt had in fact succeeded for half the payments. Walk through what the server does with each payment.
- when: watermark, late data, restate → ask: A device that owes Tuesday's data never reconnects. When does Tuesday become final, and what does the report say about that device?
- when: encrypt, encryption, card data → ask: Support wants to see the stored offline payments on a seller's lost tablet to help them. What can support see, and what can it never see?

**Production Reality Check.**
- A regional internet outage takes about 9,000 locations offline for six hours on a Saturday. When it ends, roughly 1.4 million stored payments are forwarded within 20 minutes, authorisation latency climbs to 9 seconds, and some devices time out and resend.
- A tablet left in a drawer reconnects three hours after the {{offline_hours}}-hour limit has passed for its first offline payment. Its 60 oldest stored payments have expired; the seller's sales summary for that day still includes them.
- A seller changes an item's price at 13:00; a device offline since 11:00 sells it 80 times at the old price and syncs at 17:00. The item's revenue per unit in the report is wrong for both prices.
- Two registers at a busy location sold the same last units offline; after reconnecting, the dashboard shows −12 units for a best-selling item and the online store accepts orders against the next delivery that has not arrived.

**Evaluation Criteria.** Device-generated ids for payments and orders with server writes keyed by them, so forwarding and backlog retries are safe; per-device sequence numbers and an ordered, rate-controlled forwarding queue that drains within {{offline_hours}} hours and smooths a mass reconnection (jittered back-off, priority by time left before expiry); offline payments as explicit states (stored, forwarded, authorised, declined, expired) shown to the seller, with the {{offline_cap}} limit enforced on the device; conflict rules stated per field (sale price is what was charged; stock as merged signed changes with negative counts surfaced; catalogue edits versioned so reports know which price was current); card data encrypted on the device and absent from analytics; daily reports with per-device watermarks, provisional and final states and visible restatements; reconciliation of the sales summary with what authorised and settled; adapts to each incident with diagnosis, recovery and prevention.

## BLK-L4-04: Deposits and instant transfers — schedules, cut-offs, measured arrival times and what sellers are shown

| | |
|---|---|
| **Template ID** | BLK-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Money movement scheduling / business calendars, rail status, honest arrival estimates |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "sellers": {"2": ["1 million", "3 million"], "3": ["6 million", "12 million"]},
  "countries": [2, 4, 6],
  "fee": ["1.5%", "1.75%", "2%"],
  "daily_limit": ["$10,000", "$25,000", "$50,000"]
}
```

**Business Scenario.** About {{sellers}} sellers in {{countries}} countries receive their card sales as deposits to a linked bank account. Under this exercise's rules (check current docs): sales up to a daily cut-off in the seller's time zone are paid out in a standard deposit sent the next business day, where business days follow each country's bank holidays; a seller can instead request an instant transfer of their available balance at any time for a fee of {{fee}} of the amount, rounded once to the nearest cent with halves rounded up, with a minimum fee of 25 cents; and instant transfers are limited to {{daily_limit}} per seller per day. Standard deposits travel over bank batch networks that confirm days later or not at all; instant transfers travel over card-network or real-time rails that answer in seconds, though the money can still be returned. Sellers want to know when the money will arrive and whether it did.

**Problem Statement.** Design the scheduling and status system and its analytics: computing each seller's next deposit (amount, send date, expected arrival) from their balance, cut-off and calendar; the instant transfer request path (eligibility against balance and limits, fee, submission, status); a single status model for both kinds of movement across rails; how arrival time is measured when banks confirm late or never; and what sellers are shown before, during and after a deposit, including returns to a closed bank account. The seller's balance itself is a given service you call; do not design it.

**Constraints.** Money is integer cents everywhere; the fee is computed once, by the stated rule, and shown before the seller confirms. An instant transfer request must never send money twice, even when the seller taps twice or the rail times out. Holiday calendars change and are sometimes wrong. The estimated arrival shown to sellers must be honest: if the estimate is missed for more than a small share of deposits on a rail, the estimate shown must change.

**Assumptions.** All volumes, fees, limits and timings are hypothetical. The balance service answers "available to transfer" and accepts a debit with a reference. Each rail's partner sends status events or files, on its own schedule, with its own codes.

**Clarifications.**
- Q: Whose time zone is the cut-off in? | A: The seller's business location's, under this exercise's rule. A seller with locations in two zones uses the account's primary location.
- Q: What is "eligible" for an instant transfer? | A: Only product limits: available balance, a linked eligible card or account, and the daily limit. Nothing about the seller as a person, and no credit judgement.
- Q: How do we know a standard deposit arrived? | A: Often we do not. Some banks confirm; most stay silent unless the deposit is returned. Decide what "arrived" means for the metric.
- Q: Can a seller cancel an instant transfer? | A: Not once submitted to the rail.
- Q: What happens to a returned deposit? | A: The money comes back to the balance after some days, and the seller must be told and asked to fix their bank details.

**Hints.**
1. One status model for every movement (scheduled, submitted, sent, confirmed, returned, failed), with rail-specific codes mapped onto it and the original codes kept.
2. A business-day calendar is data with versions and owners, not code; schedule computation reads the version in force and records which one it used.
3. Arrival time without confirmations is an estimate: measure it where confirmations exist, use returns as the negative signal elsewhere, and label which is which.

**Follow-ups.**
1. Walk through a seller in a country with a bank holiday on Monday: sales on Friday evening, Saturday and Sunday. When is each deposit sent, and what arrival date is shown?
2. A seller requests a $1,333.33 instant transfer. Compute the fee under this exercise's rule and show every number the seller sees.
3. The rail times out on an instant transfer and the seller taps "try again". What does the system do, and what does the seller see in the meantime?
4. How do you compute and publish the share of deposits that arrived by the date shown, per rail and country, when most banks never confirm?
5. A country's holiday calendar was missing a date last month. How do you find every seller who was shown a wrong date, and what do you tell them?

**Follow-up rules.**
- when: cron, nightly batch, scheduler → ask: The nightly scheduling run fails halfway through on the night before a holiday weekend. Which sellers have a deposit, which do not, and how do you finish without paying anyone twice?
- when: retry, timeout, try again → ask: The rail answered after your timeout, and the transfer succeeded. Your retry is already on its way. What stops the second one?
- when: estimate, eta, expected arrival → ask: For one bank, a quarter of deposits arrive a day later than shown. How would you find out, and what do you change on the seller's screen?
- when: float, decimal, percentage → ask: Show me the exact cents of the fee on $1,333.33 and on $10.00, and the line of code that does the rounding.
- when: calendar, holiday, business day → ask: A government announces a one-off bank holiday four days ahead. Who updates the calendar, and what happens to deposits already scheduled for that day?

**Production Reality Check.**
- A bank holiday in one of the {{countries}} countries is missing from the calendar. About 40,000 sellers are shown Monday as the arrival date for deposits that arrive on Tuesday, and support contacts triple that morning.
- One rail partner's status file is two days late. The arrival-time dashboard shows instant transfers on that rail taking 50 hours, and an alert fires to every seller with a pending transfer.
- On the last evening of the month instant transfer requests rise sixfold; 10% of rail calls time out, sellers tap again, and a handful of sellers report two transfers where they asked for one.
- A change to the fee code rounds every fee down instead of half up. Over a week, 2.3 million instant transfers are charged a cent less than the {{fee}} rule says, and the daily fee report no longer matches the transfers.

**Evaluation Criteria.** Scheduling from cut-offs in the seller's time zone and versioned per-country business calendars, recording the calendar version used; instant transfers with a client-generated request id, a single debit reference to the balance service, rail submission with an at-most-once guarantee and a status query before any resend; fee in integer cents by the stated rule (half up, minimum, computed once and shown before confirmation) and {{daily_limit}} enforced per seller per day in a stated time zone; one status model across rails mapping partner codes and keeping originals; arrival-time metrics that distinguish confirmed, inferred (no return within N days) and returned, per rail, bank and country; seller-facing estimates driven by measured arrival distributions and updated when missed; returns handled with notices and bank-detail fixes; eligibility limited to product limits with no credit or legal conclusions; adapts to each incident with diagnosis, recovery and prevention.

## BLK-L4-05: Card reader and register fleet telemetry with seller-facing device health

| | |
|---|---|
| **Template ID** | BLK-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Device telemetry / relayed and intermittent uploads, fleet health by model and version, seller alerts |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "devices": {"2": ["600,000", "1.5 million"], "3": ["5 million", "10 million"]},
  "models": [4, 7, 12],
  "interval": ["5 minutes", "15 minutes", "30 minutes"],
  "retention_days": [90, 180, 400]
}
```

**Business Scenario.** Sellers use about {{devices}} payment devices across {{models}} hardware models: card readers that pair over Bluetooth with the seller's phone or tablet and have no internet connection of their own, and registers and terminals that connect directly over Wi-Fi, Ethernet or a mobile network. Each device can report battery level and charging state, signal strength and connection drops, its firmware and app versions, and counts of card-read errors by type. A register reports every {{interval}} while switched on; a reader reports only through the app on a paired device, and only while that app is running. Sellers want a device health page (which readers need charging, which are out of date, which keep disconnecting) and timely alerts; the hardware and firmware teams want fleet health by model and version.

**Problem Statement.** Design the telemetry system: what devices send and how often, the relay path for readers, ingestion, deduplication and ordering, the current-state store behind the seller's device health page, the alerting rules and their limits, and the fleet analytics by model, firmware version and age. Define the main fleet measures precisely (for example a model's card-read error rate, a battery's health over time, the share of devices on the current firmware), and say how a device that has not reported is treated in each.

**Constraints.** Telemetry never contains card numbers, customer data or anything typed on the device; a seller's devices are identified by serial number and the seller's location, never by a customer. Raw telemetry is kept {{retention_days}} days; daily aggregates by model and version are kept longer. A seller is not sent more than one alert per device per day for the same condition. The device health page must reflect a report within a minute of it arriving.

**Assumptions.** All volumes, intervals and periods are hypothetical. Each device has a serial number, a model and a factory date. Readers buffer a limited number of reports in memory and upload them in a batch when the app connects; device clocks drift and can reset when the battery fully drains.

**Clarifications.**
- Q: Can a reader be paired with more than one phone? | A: Yes, one at a time; a reader moves between a seller's devices during the day.
- Q: What counts as an active device? | A: You define it, and it must not count a reader twice because it reported through two phones.
- Q: May we read the device's location? | A: Only the seller's registered location; no device positioning.
- Q: Can the firmware team ask for raw reports from one device? | A: For a support case with the seller's consent, yes; otherwise only aggregates.

**Hints.**
1. Key every report by (serial number, device sequence number) so the same report relayed twice, or uploaded again after a crash, is counted once.
2. Keep two clocks per report: the device's and the server's receive time. Trust the server's for "last seen" and use the device's only within checked bounds.
3. Absence is a state: "no report for N intervals" must be distinguished from "reported and healthy" in both the seller's page and the fleet measures.

**Follow-ups.**
1. Walk through one reader across a day: paired to two phones, unpaired overnight, then reporting a low battery. What does the seller's page show at each point?
2. Define the card-read error rate per model and firmware version so that a seller who uses one reader all day does not dominate it.
3. A firmware version is installed on 10% of one model's readers. How quickly can your system say whether its error rate is worse, and with what confidence?
4. How do you keep low-battery alerts useful rather than noisy across {{devices}} devices?
5. Six months later the hardware team asks how battery health declines with age per model. What have you kept that answers it within {{retention_days}} days of raw data?

**Follow-up rules.**
- when: mqtt, websocket, streaming, kafka → ask: Readers only report while the seller's app is open. What does your stream see overnight, and what does the seller's page show at 8 a.m. before the shop opens?
- when: device timestamp, device time, client clock → ask: A reader's battery fully drains and its clock resets to 1 January 2000. Where do its next reports land, and how do you find them?
- when: alert, notify, email → ask: One model reports 0% battery while in deep sleep. How many alerts go out overnight, and what in your design stops them?
- when: average, error rate → ask: One reader at a busy food stall makes 4,000 reads a day; most readers make 30. Whose experience does your error rate describe?
- when: serial, serial number, device id → ask: A support case needs one reader's raw reports. Who can see them, for how long, and what is logged about that access?

**Production Reality Check.**
- A firmware version reaches 10% of one model's readers and card-read errors rise for those sellers, but the fleet dashboard shows nothing for six hours because readers upload only when the seller's app is open, and most were closed overnight.
- One reader model reports 0% battery while in deep sleep. Overnight, about 200,000 "charge your reader" alerts are queued for sellers whose readers are fine.
- Readers whose batteries fully drained reset their clocks to 1 January 2000; their next reports land in partitions dated 2000, and the share of the fleet on the current firmware drops by four points.
- A bug in the phone app re-uploads the last batch of reader reports at every app launch; daily card reads per reader for one of the {{models}} models double while payment counts stay flat.

**Evaluation Criteria.** A telemetry contract with typed fields and no card or customer data; readers relayed through the paired app with buffered batches, registers reporting every {{interval}}; deduplication on (serial, sequence) and both device and receive times kept, with clock-reset detection; a current-state store per device feeding the seller's page within a minute, with "not reporting" as an explicit state; alert rules with debouncing, minimum durations, per-device daily caps and plausibility checks per model; fleet measures defined per device-day (or with capped weights) by model, firmware and age, with confidence for small firmware cohorts and awareness of upload delay; {{retention_days}}-day raw retention with longer-lived aggregates designed for the questions the hardware team will ask; least-privilege access to per-device data; adapts to each incident with diagnosis, recovery and prevention.
