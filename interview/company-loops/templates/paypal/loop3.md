# PayPal · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a consumer wallet
and peer-to-peer payments service: balances and linked funding sources, payment
requests and splits, payments to an email address, phone number or username,
currency conversion, and buyer protection claims from the buyer's side. They are
not questions from any company's interviews, and they describe no company's
internal systems. Every workload, number, schema and incident is hypothetical;
funding, hold, expiry, claim-window and programme rules are this exercise's rules
(check current docs). Money is always integer minor units, with each currency's
exponent given as data. Users appear in aggregates, except a user's own activity
shown to that user. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PYP-L3-01: The wallet as data — accounts, linked banks and cards, the preferred funding source, balances in several currencies, holds, and what funded each payment

| | |
|---|---|
| **Template ID** | PYP-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / funding instruments and links over time, preference history, per-currency balances from movements, holds, funding legs per payment |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "accounts": {"1": ["40 million"], "2": ["150 million"], "3": ["400 million"]},
  "payments_per_day": ["15 million", "40 million"],
  "currencies": [10, 25],
  "hold_days": [3, 7, 21]
}
```

**Business Scenario.** A consumer wallet has about {{accounts}} accounts. A user links bank accounts and cards, can hold a balance in up to {{currencies}} currencies, and picks a preferred funding source. About {{payments_per_day}} payments a day leave wallets, to friends and to merchants at checkout. In this exercise's funding rule (check current docs), a payment uses the balance in the payment's currency first, then the preferred funding source for the rest, and, if that source is declined, a fallback the user approved; so one payment can be funded from two or three sources. Some incoming money is placed on hold for up to {{hold_days}} days before it can be spent, when a review process you are given asks for it. Users ask "what paid for this?" and "why can't I use this money yet?"; support asks "which source was preferred on that date?"; analytics wants the funding mix per day and currency, in aggregate.

**Problem Statement.** Design the data model for the wallet. Cover users and accounts; funding instruments (banks and cards) and the user's links to them over time (linked, verified, removed); the preferred funding source as a history; balances per currency, derived from append-only balance movements, with available and held amounts; holds and their release; conversions between the user's own currency balances; and the funding of each payment as one or more funding legs that add up to the payment. Show how you answer: what funded payment X; the available and held balance in currency C at time T; the preferred source on date D; and the daily funding mix per currency in aggregate.

**Constraints.** Money is stored in integer minor units; each currency's exponent (0, 2 or 3) comes from a currency reference table and is never assumed. A conversion is recorded once, with the rate applied, and rounded once by this exercise's rule (half away from zero, to the target currency's minor unit). No balance is stored as the only truth: every change is a movement, and a stored balance is a derived, rebuildable figure. Card and bank numbers never enter the model; instruments are tokens, with a short display suffix shown only to the instrument's owner. The available balance never goes below zero (this exercise's rule). Analytics read aggregates; a user sees only their own activity.

**Assumptions.** Account counts, volumes, currency counts and hold lengths are hypothetical. Card and bank network messaging is out of scope: a decline arrives as an event with a reason code. Fees are out of scope unless you add them. Any risk score comes from another system and is only referenced.

**Clarifications.**
- Q: Is the balance one number per user? | A: No. A user can hold a balance in several currencies; each currency is its own balance with an available part and a held part.
- Q: Does a payment in euros spend the dollar balance? | A: Not automatically in this exercise. The euro balance is used first; the rest comes from the preferred source, converted if needed at a quoted rate that is recorded with the payment.
- Q: Can a removed card come back? | A: If the user links the same card again, it is a new link to the same instrument token in this exercise; the old link keeps its history.
- Q: Who places a hold and for how long? | A: A review process you are given places it, for up to {{hold_days}} days here. It is released early or at the end, and the release is an event of its own.
- Q: Where does a refund of a payment go? | A: In this exercise, back to the sources that funded it, in the reverse order they were used. Say how your model records which legs a refund reverses.

**Hints.**
1. Separate the instrument (a bank or card, as a token) from the user's link to it, and keep each with its own validity interval.
2. A balance is a sum of movements per account and currency; available and held are two sums. A hold is a pair of movements (placed, released), not a flag.
3. Funding legs per payment: (payment, leg number, source kind, instrument or balance currency, amount in the source's currency, amount in the payment's currency, conversion reference).

**Follow-ups.**
1. Write the query for the available and held balance in one currency at time T. What snapshot or index keeps it fast for an account with years of history?
2. A payment of 50.00 EUR used 18.40 EUR of balance and the rest from a card billed in USD. Show the rows written, including the conversion, and the check that proves the legs add up to the payment.
3. The user removes the preferred card on the 3rd and picks a bank account on the 10th. What does "preferred source on the 5th" return, and what funded a payment on the 5th?
4. At {{payments_per_day}} payments a day, which tables are facts, at what grain, and how do you build the daily funding mix per currency without reading every movement?
5. Two payments start at the same moment against one available balance that covers only one of them. How do the model and the write path keep the balance from going negative?

**Follow-up rules.**
- when: balance column, current balance, update the balance → ask: Support asks what the user's available euro balance was at 14:05 last Tuesday; a hold was placed at 14:00 and released at 14:30. With one balance column, how do you answer?
- when: card number, pan, card_number → ask: Card numbers never enter this model. What do you store instead, and how does the user still recognise which card paid?
- when: float, double → ask: One balance is in a currency with exponent 3 and another with exponent 0. How do you store both exactly, and where does the exponent live?
- when: is_preferred, default card, preferred flag → ask: A flag on the instrument row says which source is preferred now. How do you answer "which was preferred on the 5th", and what stops two sources being flagged at once?
- when: hold, on hold, held → ask: A hold of {{hold_days}} days is released early by the review. Which rows does the release write, and what is the available balance at a moment between the two?
- when: conversion, convert, exchange rate → ask: Where is the rate stored, and how do you prove later that the converted leg used the rate the user was shown?

**Production Reality Check.**
- The daily funding mix showed shares adding up to more than 100%: a payment funded partly by balance and partly by a card was counted once under each source instead of by leg amount.
- Available balances in one currency went negative for a few seconds on busy days: two payment debits read a cached balance, and both passed the check before either was written.
- With balances in up to {{currencies}} currencies, a monthly statement total was converted with today's rates rather than the rates applied at the time, so users saw last month's total change every day.

**Evaluation Criteria.** Instruments as tokens kept apart from the user's links to them, both with validity intervals; preference as a history; per-currency balances derived from append-only movements with available and held parts; holds as placed and released movements; conversions recorded once with the rate and a single rounding; funding legs that reconcile exactly to each payment, with refunds tied to the legs they reverse; exponents taken from reference data; no card or bank numbers; concurrency on the available balance handled on the write path; aggregate funding mix by leg amount; incidents explained by the model and repaired without rewriting history.

## PYP-L3-02: Payment requests and splits as data — requests, partial payments, reminders, declines, group splits and each request's settled state as of a date

| | |
|---|---|
| **Template ID** | PYP-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / request and share lifecycles as events, reproducible split rounding, state as of a date, reminder eligibility |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "requests_per_day": {"1": ["1 million"], "2": ["4 million"], "3": ["12 million"]},
  "max_participants": [8, 20, 50],
  "reminder_days": [3, 5, 7],
  "expiry_days": [30, 60, 90]
}
```

**Business Scenario.** Users ask other people for money: a request to one person, or a split of a bill among up to {{max_participants}} participants. There are about {{requests_per_day}} requests a day. In this exercise's rules (check current docs): a participant can pay their share in full or in several parts, decline it, or ignore it; the requester can cancel the request, or edit its amount until anyone has paid; a reminder goes out {{reminder_days}} days after the request to every participant who still owes something; an unpaid share expires after {{expiry_days}} days. A split divides the total equally by default, with leftover cents assigned by a stated rule, or by custom amounts the requester types. The requester's screen shows, per participant, what is paid and what is outstanding; analytics asks how many requests are settled within N days, per amount band, and what share of split shares are declined.

**Problem Statement.** Design the data model for requests and splits. Cover requests (to one person or a group); the share each participant owes and how it was computed; payments made against a share (partial, several, possibly from a wallet in another currency); declines, cancellations and edits; reminders sent; expiry; and the state of each share and each request as of any date. Show how you answer: what each participant owed and had paid on date D; requests settled within N days, per week; and which participants are due a reminder today.

**Constraints.** Money is stored in integer minor units. The shares of a split add up exactly to the total; in this exercise's remainder rule, leftover minor units go one each to participants in the order they were added. A payment never exceeds what is outstanding on its share (an overpayment is rejected in this exercise). A request has one currency; a payment from a balance in another currency is converted once at the payer's quoted rate and recorded in the request's currency as well. Every change is an event: an edited request keeps its first amount in history. People see only requests they are part of; analytics see aggregates and amount bands, never who owes whom.

**Assumptions.** Volumes, participant limits and the reminder and expiry periods are hypothetical. Notification delivery is out of scope beyond recording that a reminder was sent. How participants without an account are identified is covered in another exercise; here a share may point at an invited identifier.

**Clarifications.**
- Q: Is a request's state stored or derived? | A: Your choice, but "state on date D" must be answerable for any past D.
- Q: Can one payment answer two requests? | A: No. In this exercise a payment answers exactly one share; a participant with two shares pays twice.
- Q: What happens when the requester edits the total? | A: Allowed only before any payment; the edit recomputes the shares and is recorded as a new version of the request.
- Q: Does a decline end the share? | A: Yes. The share closes as declined, and the requester can send a new request.
- Q: In which time zone is "{{reminder_days}} days after the request" counted? | A: As {{reminder_days}} × 24 hours from the moment the request was created, sent at the next morning in the participant's own time zone (this exercise's rule).

**Hints.**
1. Request → shares (one per participant) → share events (paid, declined, expired, cancelled, reminded). A state is a fold of events up to a moment.
2. Keep how the shares were computed (the rule version, the total, the participants in order) so the split can be reproduced exactly.
3. "As of D" filters events by time and folds them; a daily snapshot of open shares is an optimisation, never the source of truth.

**Follow-ups.**
1. Write out the shares for 100.00 split among three participants under this exercise's remainder rule, and the invariant you check on every split.
2. A participant pays 10.00 of a 33.34 share on Monday and 23.34 on Thursday. Which rows exist, and what does the requester see on Wednesday?
3. Write the query for "participants to remind today". How do you avoid reminding someone who paid an hour ago, or reminding twice after a retry?
4. Define "settled within N days" for a split in which one participant declined. Is the request settled, and what is the weekly metric's denominator?
5. At {{requests_per_day}} requests a day with splits of up to {{max_participants}} participants, what is the grain of the analytics fact, and how do you keep "state as of D" cheap?

**Follow-up rules.**
- when: status column, request status, update the status → ask: One status per request: two of five participants paid, one declined. What does it say, and how do you remind only the two who still owe?
- when: round, rounding, divide → ask: 100.00 split three ways: which participant pays the extra cent, where is that recorded, and can the shares ever add up to 99.99?
- when: snapshot, daily snapshot → ask: A payment recorded late belongs before yesterday's snapshot. How is yesterday's state corrected, and what did the reminder job see?
- when: expire, expiry, expired → ask: The expiry rule changed from {{expiry_days}} days last month. Which rule does a request created before the change follow, and where is that recorded?
- when: cron, batch job, nightly → ask: Reminders are due {{reminder_days}} days after creation, sent in each participant's morning. What does your job select, and what stops a second reminder after a retry?

**Production Reality Check.**
- A split among many participants showed shares adding up to one cent less than the bill: each share was rounded on its own and the remainder rule was never applied.
- Reminders went to participants who had already paid: the reminder job read the request's status, which changed only when every share was settled.
- After the expiry rule changed, last quarter's "expired requests" report changed too: expiry was computed at query time with the current {{expiry_days}}-day rule instead of the rule recorded on each request.

**Evaluation Criteria.** Requests, shares and share events kept separate; shares that add up exactly under a stated, reproducible remainder rule; partial payments and declines as events; edits as versions; state as of any date derived by folding events; reminder eligibility per share, idempotent per share and day; rule versions recorded on each request; conversion recorded once; analytics in aggregates and amount bands; incidents explained and repaired from events.

## PYP-L3-03: Recipients by email, phone or username as data — identifiers that change hands, verification, payments to unclaimed identifiers and claim windows

| | |
|---|---|
| **Template ID** | PYP-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / identifiers as entities, holdings over time, resolution at send time, unclaimed-payment lifecycle with a stored deadline, pseudonymised analytics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "identifiers": {"1": ["300 million"], "2": ["700 million"], "3": ["1.5 billion"]},
  "unclaimed_per_day": ["40,000", "250,000"],
  "claim_window_days": [14, 30, 45],
  "quarantine_days": [60, 90, 180]
}
```

**Business Scenario.** Users send money to an email address, a phone number or a username rather than to an account number. One account can hold several identifiers, and there are about {{identifiers}} identifiers in all. Identifiers change hands: carriers reassign phone numbers, people give up email addresses, and usernames are changed and later taken by someone else. In this exercise's rules (check current docs): an identifier receives money only while it is verified by its holder; a released username can be taken by another account only after {{quarantine_days}} days; a phone number whose verification lapses is detached until it is verified again. A payment sent to an identifier that no account holds waits as an unclaimed payment: the recipient has {{claim_window_days}} days to sign up and verify it, otherwise the money returns to the sender. About {{unclaimed_per_day}} payments a day go to unclaimed identifiers.

**Problem Statement.** Design the data model for identifiers and the payments sent to them. Cover identifiers (normalised email, phone number in an international format, username) as entities of their own; each account's holding of an identifier over time, with verification events; username history; the recipient of a payment as entered, as resolved at send time, and as finally credited; unclaimed payments and their lifecycle (waiting, claimed, returned, cancelled by the sender) with a deadline; and the analytics: the share of unclaimed payments claimed within the window, time to claim, and returns per day. Show how you answer "which account held this phone number on date D" and "which account was credited for payment X, and why".

**Constraints.** An identifier has at most one verified holder at a time, and its history is never overwritten. Identifiers are personal data: analytics hold a surrogate or a keyed pseudonym, never the raw email address or number; a user sees their own identifiers and payments. The claim deadline is fixed when the payment is sent, from the rule then in force. The sender's money for an unclaimed payment is set aside when it is sent and either credited to the claimant or returned. Money is stored in integer minor units.

**Assumptions.** Identifier counts, volumes, the claim window and the quarantine are hypothetical. Verification is described generally (a code or a link confirmed by the holder); how carriers report reassigned numbers is out of scope beyond an event that may arrive late or never.

**Clarifications.**
- Q: Are `Alice@Example.com` and `alice@example.com` the same identifier? | A: In this exercise, yes: emails are matched case-insensitively. Say how you normalise phone numbers.
- Q: Can the sender cancel an unclaimed payment? | A: Yes, until it is claimed.
- Q: A payment was resolved to an account at send time, and the identifier changed hands a minute later. Who gets the money? | A: The account resolved at send time; the payment records it.
- Q: How is the claim window counted? | A: As {{claim_window_days}} × 24 hours from the moment the payment was sent; the deadline is stored on the payment.
- Q: Can a username be reused at once? | A: No. Only after the {{quarantine_days}}-day quarantine in this exercise.

**Hints.**
1. An identifier is not a column on the user: it is an entity with holdings (identifier, account, from, to, verified at, end reason).
2. Resolve the recipient once, at send time, and store the result on the payment; never resolve it again when reading.
3. An unclaimed payment is a small state machine with a deadline stored at creation; returns are driven by the stored deadline.

**Follow-ups.**
1. Write the query: which account held phone number N on date D, and was the holding verified at that moment?
2. A carrier reassigns a number. The old holder's verification lapses on the 1st; the new holder verifies on the 20th. A payment to the number on the 10th: what happens, and which rows exist?
3. At {{unclaimed_per_day}} unclaimed payments a day, how does the return job find expired payments, and what makes each return happen exactly once?
4. Analytics asks for the share of new accounts created to claim a payment. Which tables answer it, and how do you avoid joining to each identifier's current holder?
5. A user asks to close their account and erase their data. Which identifier rows are kept, erased or pseudonymised, and how do past payments still reconcile?

**Follow-up rules.**
- when: email column, phone column, users.email, on the user table → ask: A carrier reassigns a number to someone new. With the number stored on the user row, what does "who held it on the 10th" return?
- when: current owner, current holder, lookup at query time → ask: Last quarter's report of payments received by new accounts changed this week. What did your join do when identifiers changed hands?
- when: hash, hashed, sha256 → ask: Is a plain hash of a phone number enough to keep it out of analytics? What would you use instead, and who holds the key?
- when: deadline, claim window, expire → ask: The claim window changed from {{claim_window_days}} days. Which deadline does a payment sent the day before the change keep, and where is it recorded?
- when: unique, unique constraint, unique index → ask: How do you enforce "one verified holder at a time" with history kept, when two accounts verify the same email address within the same second?

**Production Reality Check.**
- A payment to a reassigned phone number reached the previous holder's account: their holding row had no end, because the lapse of their verification was never written as an event.
- Unclaimed payments were returned up to a day early for some senders: the return job compared the send date plus {{claim_window_days}} days with today's date in UTC instead of the deadline instant stored on the payment.
- A report of payments received by new accounts changed after a wave of username changes: it joined payments to each identifier's current holder instead of the account credited at the time.

**Evaluation Criteria.** Identifiers as entities with normalisation; holdings over time with verification and end reasons, at most one verified holder at a time; usernames with history and the quarantine rule; the recipient as entered, as resolved and as credited, stored on the payment; unclaimed payments as a state machine with a stored deadline and exactly-once returns; keyed pseudonyms in analytics; erasure that keeps payments reconcilable; incidents explained by the model and repaired from events.

## PYP-L3-04: Buyer protection claims as data, from the buyer's side — the purchase, the claim, messages and evidence, escalation, the decision, refunds and versioned programme rules

| | |
|---|---|
| **Template ID** | PYP-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / claim lifecycle as events, messages and evidence with visibility and retention, rule versions fixed at opening, refunds against funding legs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "claims_per_day": {"1": ["20,000"], "2": ["80,000"], "3": ["250,000"]},
  "claim_window_days": [60, 120, 180],
  "seller_response_days": [3, 7, 10],
  "evidence_retention_years": [2, 5, 7]
}
```

**Business Scenario.** A buyer who paid a merchant through the wallet can open a claim when an item did not arrive or arrived significantly not as described. There are about {{claims_per_day}} claims a day. In this exercise's programme rules (check current docs): a claim must be opened within {{claim_window_days}} days of the purchase; the buyer and the seller first exchange messages; the seller has {{seller_response_days}} days to respond, after which the buyer can escalate the claim to a review; the reviewer decides in the buyer's favour, in the seller's favour, or for a partial refund; and a refund is issued in the purchase currency. The rules change over time: the window, the eligible categories and the evidence asked for are versioned. The buyer sees their claim's timeline; the programme team sees aggregates.

**Problem Statement.** Design the data model for claims from the buyer's side. Cover the purchase as the buyer sees it (merchant, amount, currency, items, shipment tracking references); the claim, its reason and the items and amount claimed; the claim's lifecycle as events (opened, message, seller responded, escalated, information requested, decided, refunded, closed, reopened); messages between buyer and seller with their attachments; evidence with its type, storage reference, who may see it, and retention; the decision with its outcome, amount, reason codes and rule version; refunds and their link to how the purchase was funded; and versioned programme rules. Show how you answer: the claim's timeline as the buyer sees it; time from opening to decision per category and month; the share of claims escalated; and which rule version governed claim X.

**Constraints.** Money is stored in integer minor units, with each currency's exponent from reference data. Refunds on a purchase never add up to more than the purchase amount. The rule version is fixed when a claim is opened (this exercise's rule). A decision records an outcome and reason codes about the transaction, never a judgement about a person's honesty or creditworthiness. Evidence files live in an object store; the model holds references and access rules. A seller never sees the buyer's other claims or account details. Evidence is kept for {{evidence_retention_years}} years after the claim closes and then deleted, while the claim's facts remain.

**Assumptions.** Claim volumes, the window, the seller deadline and retention are hypothetical. Card-network disputes are out of scope: a claim here is opened with the wallet provider. How a reviewer reaches a decision is out of scope; the model records it.

**Clarifications.**
- Q: Can a claim cover part of an order? | A: Yes. The claim names the items and the amount claimed.
- Q: Who can see an attachment? | A: The buyer and the reviewer always; the seller only when the buyer attaches it to a message to the seller (this exercise's rule).
- Q: Can a closed claim be reopened? | A: Yes, once, within 10 days of the decision in this exercise. It keeps its id and its rule version.
- Q: How is the seller's deadline counted? | A: As {{seller_response_days}} × 24 hours from the moment the claim was opened.
- Q: Does a refund go back to a card or to the balance? | A: In this exercise, to the sources that funded the purchase, in the reverse order they were used.

**Hints.**
1. A claim header plus append-only claim events; the current state and every duration are derived from them.
2. Evidence is metadata rows with visibility and a retention date; the files are elsewhere.
3. Programme rules as versioned rows; the claim stores the version it was opened under.

**Follow-ups.**
1. Write the query for the buyer's timeline of one claim, with the messages and the evidence the buyer may see.
2. Define time to decision for a claim that is reopened and decided twice. Which decision counts in the monthly report?
3. The window changes from {{claim_window_days}} days on the 1st. A purchase made before the change, a claim opened after it: which window applies, and what does the buyer see if the claim is too late?
4. A partial refund of 30% on a purchase funded by balance and a card: which rows are written, in which currency, and how is the amount rounded?
5. After {{evidence_retention_years}} years, evidence files are deleted. What remains, and how do the reports and the timeline still work?

**Follow-up rules.**
- when: status column, claim status, update the claim → ask: The monthly report needs time from opening to decision and the share escalated. With one status column overwritten, which timestamps are left?
- when: rules table, rule version, window → ask: The window changed last month. How does a claim opened today, for a purchase made before the change, find its rule version, and where is that stored?
- when: s3, blob, attachment, object store → ask: The seller may see an attachment only if the buyer sent it to them. Where is that rule stored, and how do you serve the file to the seller without exposing the buyer's other files?
- when: refund, partial refund → ask: Two partial refunds on one purchase, the second after a reopening. What stops the total exceeding the purchase amount, and where is the currency's exponent applied?
- when: delete, retention, purge → ask: Evidence is deleted after {{evidence_retention_years}} years. What happens to the decision, the reports and a message that referenced the file?

**Production Reality Check.**
- After the window changed from {{claim_window_days}} days, claims already open were re-evaluated against the new window, and some buyers saw "not eligible" on claims that had been accepted when they were opened.
- Partial refunds in a currency with exponent 0 were issued 100 times too large: the amount was computed in major units and converted with an assumed exponent of 2.
- Buyers could not escalate for days in one month: the {{seller_response_days}}-day seller deadline was computed from the seller's first reading of the claim instead of from its opening.

**Evaluation Criteria.** The purchase as the buyer sees it; claims with append-only events and derived state and durations; messages and evidence with per-party visibility, storage references and retention; decisions with outcome, amount, reason codes and rule version, no judgements about people; refunds capped by the purchase and tied to the funding legs; rule versions fixed at opening; aggregates for the programme team; incidents explained and repaired without rewriting history.

## PYP-L3-05: Late claims — buyer protection claims filed after this exercise's window, per item category and month, reopened claims counted once

| | |
|---|---|
| **Template ID** | PYP-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / rule in force on a date, calendar dates in the buyer's time zone, inclusive windows, reopenings counted once, median |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | PYP-L3-05.mjs |

**Business Scenario.** A buyer who paid through the wallet can open a buyer protection claim on a purchase. In this exercise a claim is on time when it is filed within the window in force on the purchase date; `programme_rules` holds the window's versions (this exercise's rule; check current docs for how a real programme works). A closed claim can be reopened: a reopening is a new row in `claims` whose `reopens_claim_id` points at the row it reopens. The programme team wants a monthly view, per item category, of how many claims arrive after the window and how long buyers take to file. {{rule_rule}} {{tz_rule}} The sample has {{purchase_count}} purchases and {{claim_rows}} claim rows, {{reopen_rows}} of them reopenings.

**Problem Statement.** Write one PostgreSQL query that returns `item_category, claim_month, claims, late_claims, reopened_claims, median_days_to_claim`, one row per item category and month with at least one claim, ordered by `item_category, claim_month`.
- A claim is a row with `reopens_claim_id IS NULL` (an original claim). A reopening is never a claim of its own, and a claim's dates are always its original filing's. {{chain_rule}}
- Dates are calendar dates in the buyer's time zone (`buyers.time_zone`): the purchase date from `purchased_at`, the filing date from the original claim's `filed_at`. `claim_month` is the filing date's month as text, `'YYYY-MM'`.
- `days_to_claim` is the filing date minus the purchase date, in days. The window is the `window_days` of the `programme_rules` row with the latest `effective_from` on or before the purchase date. A claim is late when `days_to_claim` is greater than the window, so a claim filed on the window's last day is on time.
- `claims` counts the group's claims, `late_claims` the late ones, and `reopened_claims` those that some row reopens directly.
- `median_days_to_claim` is the median of the group's `days_to_claim` (`percentile_cont(0.5)`: the mean of the two middle values when the count is even).

**Constraints.** One SQL statement (CTEs allowed). `purchased_at` and `filed_at` are `TIMESTAMPTZ` and the session runs in UTC. The sample's time zones have no daylight-saving changes, but the query should not rely on that. `amount_minor` and `currency` are shown for context and play no part. Production has hundreds of thousands of claims a day; the report runs monthly and is restated when late events arrive.

**Assumptions.** Hypothetical schema, buyers, categories, windows and dates. The window and its versions are this exercise's rules, not any real programme's. Lateness here is a reporting fact about timing, not a decision about any claim or any buyer.

**Clarifications.**
- Q: Is a claim filed exactly `window_days` after the purchase late? | A: No. Late means strictly more days than the window.
- Q: Which rule applies to a purchase made before a rule change and claimed after it? | A: The rule in force on the purchase date, taken in the buyer's time zone.
- Q: Which month does a claim reopened the following month belong to? | A: The month of its original filing; it is counted once, there.
- Q: Should I count 24-hour periods? | A: No. Count calendar dates in the buyer's time zone: bought at 23:00 on the 1st and filed at 01:00 on the 3rd is 2 days.
- Q: What if a category has no claims in a month? | A: Leave the row out.

**Hints.**
1. Start from original claims only. Reopenings matter only for `reopened_claims`: `EXISTS` a row whose `reopens_claim_id` is the claim's id.
2. `(ts AT TIME ZONE b.time_zone)::date` is the buyer's local date, and subtracting two dates gives an integer number of days.
3. The rule in force on a date is a "latest row on or before" lookup: a `LATERAL` subquery with `ORDER BY effective_from DESC LIMIT 1`, or validity ranges built with `LEAD(effective_from)`.

**Follow-ups.**
1. The programme later sets a shorter window for one category. How do `programme_rules` and the lookup change?
2. The report is restated monthly. A reopening arrives late, or a buyer's time zone is corrected. Which months change, and how would you materialise the report so a restatement is cheap?
3. At production volume, how would you index `claims` and `programme_rules` for this query, and would you store the local purchase date?
4. The team wants late claims broken down by days late (1–7, 8–30, more than 30). Extend the query and say what the denominator of a late share is.

**Follow-up rules.**
- when: distinct purchase_id, count(distinct purchase → ask: One purchase can carry more than one original claim. What does counting distinct purchases do then, and what unit should you count?
- when: coalesce → ask: COALESCE(reopens_claim_id, claim_id) climbs one level. What happens to a reopening of a reopening?
- when: epoch, interval, 86400, 24 hours → ask: Is 23:00 on the 1st to 01:00 on the 3rd one day or two in this report, and what does your expression return?
- when: ::date, utc → ask: Which time zone's date does `filed_at::date` give in this session, and which claims change month or lateness because of it?
- when: >=, between → ask: Show the comparison you use for lateness. Is a claim filed on the window's last day late in your query?
- when: max(effective_from), newest rule, current rule → ask: Which rule version applies to a purchase made before the last change: the one in force on the purchase date, or simply the newest?

**Production Reality Check.**
- One month's late share doubled after a release of the claims app: reopenings were written as new claims without `reopens_claim_id`, so each one counted as a claim filed weeks after its purchase.
- For months, buyers in time zones ahead of UTC were reported late more often than others: the report took dates in UTC, so a purchase made early in the buyer's morning moved to the previous date, and claims filed on the window's last local day counted as late.
- A window version loaded ahead of its effective date was applied at once to every claim: the lookup took the newest version instead of the one in force on the purchase date.

**Evaluation Criteria.** Original claims counted once, with dates from the original filing; reopenings used only for `reopened_claims`, matched by the row they reopen; dates in the buyer's time zone with integer date subtraction; the rule in force on the purchase date, inclusive of its `effective_from`; a strictly-greater lateness test; a correct median; deterministic order; can discuss category-specific rules, restatements and indexing.
