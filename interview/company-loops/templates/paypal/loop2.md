# PayPal · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a consumer wallet and
peer-to-peer payments service: balances and linked funding sources, social payments,
payment requests and splits, currency conversion and cross-border transfers. They are not
questions from any company's interviews, and they describe no company's internal systems.
Every user, number, rate, rule and schema is hypothetical. Money is always integer minor
units, a currency's minor-unit exponent is given as data, and every conversion rounds once
by a stated rule. Users appear only in aggregate, except a user's own activity shown to
that user. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PYP-L2-01: Settling a group's shared expenses — equal splits to the minor unit, net balances, largest creditor and largest debtor first

| | |
|---|---|
| **Template ID** | PYP-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Heaps / two priority queues over net balances, exact integer splits and conversion |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | PYP-L2-01.mjs |

**Business Scenario.** A group of friends shares costs on a trip: one person pays for dinner, another for the car, a third for tickets that only some of them used. The wallet's group feature records each expense with its payer and the people it was for, splits it equally, and at the end offers a "settle up" plan of transfers between members. The plan has to be reproducible: the same group must always get the same transfers, in the same order, so a member who sees the plan on two devices sees the same thing. Large community groups (clubs, shared houses over years) run to tens of thousands of members.

**Problem Statement.** Implement `settle_group(members, expenses, repaid, currencies, home, remainder)`. `members` lists member ids in the order they joined. Each expense is `(payer, amount, currency, participants)`: `amount` is in the currency's minor units, `participants` is a non-empty list of distinct members, and the payer may or may not be one of them.
1. **Split.** An expense of `A` home minor units among `k` participants gives each a share of `A // k`, and the leftover `A % k` units go one each to the first `A % k` participants by the remainder rule. With `remainder = 'listed'` that is the order the expense lists them; with `'joined'` it is the order of `members`. {{remainder_rule}}
2. **Balances.** A member's net balance is what they paid minus the shares they owe. {{repaid_rule}} {{currency_rule}}
3. **Transfers.** While some member has a positive balance and some member a negative one: take the creditor with the largest balance and the debtor with the most negative balance, each tie going to the member who joined first. The debtor pays the creditor `min(creditor's balance, −debtor's balance)`, and both balances move by that amount.
Return the transfers as `(from_member, to_member, amount)` in the order they are made. Return `[]` when everyone is even.

**Constraints.** Up to 40 000 members and 64 000 expenses in the timing check, and almost every member ends with a non-zero balance. A scan of every member before each transfer is O(n²) and too slow. Something close to O(e + n log n) is expected.

**Assumptions.** Members, amounts, rates and the remainder rules are hypothetical; this largest-first rule is this exercise's rule, so check current docs for how any real feature settles a group. The rule is not guaranteed to give the fewest transfers, and you must not optimise it away. Member ids are distinct. Balances always sum to zero, because splits add up exactly to each expense.

**Clarifications.**
- Q: Do I need the fewest possible transfers? | A: No. The rule is largest creditor and largest debtor first. Finding the fewest transfers is a much harder problem; this exercise wants a fixed, explainable rule.
- Q: Who gets the leftover cents of a split? | A: The first `A % k` participants by the stated remainder rule, one unit each. Nobody gets a fraction of a minor unit.
- Q: What if two creditors have the same balance? | A: The one who joined the group first, the earlier one in `members`, is paid first. The same tie rule applies to debtors.
- Q: Does the payer's own share count when they are a participant? | A: Yes. They paid the whole amount and owe their share like everyone else, so their balance goes up by the amount minus their share.
- Q: Is a member with a zero balance part of any transfer? | A: Never.

**Hints.**
1. First compute every net balance in one pass over the expenses (and repayments). This part is linear.
2. Each transfer clears at least one of its two members, so there are at most n − 1 transfers. The cost is in finding the two largest each time.
3. Keep creditors and debtors in two heaps keyed by `(−balance, join index)` and `(balance, join index)`. Pop one from each, transfer, and push back whichever still has a balance.

**Follow-ups.**
1. Prove that the loop ends, and bound the number of transfers it makes.
2. The group wants fewer transfers. Show a group where the largest-first rule makes more transfers than necessary, and say why the fewest-transfers problem is hard in general.
3. Members can opt out of paying certain people directly (they never transfer to each other). How does that change the problem?
4. Expenses keep arriving after a plan was shown, and some transfers were already paid. How would you keep a plan up to date without recomputing it from scratch, and what must stay stable for the members?

**Follow-up rules.**
- when: max(, for each step, scan all, nested loop → ask: With 40 000 members and about 40 000 transfers, how many balance comparisons does your loop make?
- when: sort, sorted, re-sort → ask: You sort after every transfer. What does that cost in total, and which structure would let you change two balances cheaply?
- when: heapq, heap, priority queue → ask: After a transfer, which of the two members do you push back, and how do you keep the join-order tie rule in the heap key?
- when: float, round(, / 100 → ask: Where does a fraction of a minor unit appear in your code, and how do you make the shares add up exactly to the expense?
- when: minimum transfers, fewest transfers, optimal → ask: The rule asks for largest first, not the fewest. What would it take to find the fewest, and why is it expensive?

**Evaluation Criteria.** Exact integer splits with the stated remainder rule; the payer's own share handled; net balances from expenses (and, at Hard, repayments that may overshoot); at Very Hard, each expense converted once with half-up rounding and its currency's own exponent before the split; the largest-first rule with join-order ties applied exactly, even when fewer transfers exist; an O(n log n) approach with two heaps (or another O(log n) structure); a termination and transfer-count argument; sensible answers on minimum transfers and incremental plans.

## PYP-L2-02: Lowest balance after back-dated activity — the wallet's low point as late events arrive

| | |
|---|---|
| **Template ID** | PYP-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Segment tree / (sum, lowest prefix) per node, point updates for late and corrected events |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | PYP-L2-02.mjs |

**Business Scenario.** A wallet's activity does not always arrive in the order it happened. A bank transfer is dated the day it was initiated but confirmed days later; an offline card payment is forwarded hours after it was made; a payment from another currency is posted at the time of the original request. Each late event is inserted into the user's history at its own time, which changes every running balance after it. The user's own activity view shows the lowest balance the wallet reached and when, so the user can see whether it ever dipped below what they expected, and it must be right after every arrival, not only at the end of the day.

**Problem Statement.** Implement `lowest_balance(opening, arrivals)`. `opening` is the balance before any event, in minor units. `arrivals` lists events in the order they reached the wallet, each `(event_id, t, amount)`: `t` is the integer minute the event took effect, and `amount` is a signed number of minor units. The history is every event that has arrived so far, ordered by `t`. {{tie_rule}} The running balance after an event is `opening` plus the amounts of every event up to and including it in history order. After each arrival, report `(lowest, t)`: the lowest running balance over the whole history as it then stands, and the `t` of the earliest event in history order where that balance is reached. The opening balance on its own is not an event and is never the answer. {{correction_rule}} Return one tuple per arrival.

**Constraints.** Up to 80 000 arrivals in the timing check, 40% of them dated at a random earlier minute. Recomputing the running balances after each arrival is O(n) per arrival and O(n²) in total, and so is recomputing only from the inserted position on, because late events land early. Something close to O(n log n) is expected.

**Assumptions.** Event ids, times and amounts are hypothetical. The balance may go below zero in this exercise; how any real wallet handles a negative balance is not part of it, so check current docs. Your function receives every arrival at once, but each answer must reflect only the arrivals up to that point.

**Clarifications.**
- Q: After one arrival, what is the answer? | A: That event's running balance, `opening + amount`, and its `t`. The opening balance alone is not a candidate.
- Q: Two events reach the same lowest balance. Which `t` do I report? | A: The earlier one in history order.
- Q: Where does a back-dated event go when other events share its minute? | A: After the events of that minute that arrived before it, so ties are always ordered by arrival.
- Q: Do I know the final history in advance? | A: Yes, the whole arrival list is an argument. You may preprocess it, but each reported answer must ignore events that have not arrived yet.
- Q: Can amounts be zero or negative? | A: Both. A debit is negative; a cancelled event (at Very Hard) has amount 0 and still occupies its place.

**Hints.**
1. Running balances are prefix sums in history order. The lowest running balance is the minimum prefix sum, plus `opening`.
2. For a block of events, keep two numbers: its total and its lowest prefix sum. Two adjacent blocks combine as `total = L.total + R.total` and `low = min(L.low, L.total + R.low)`.
3. Since every event's final place in history is known in advance, give each event a slot in a fixed array of positions and build a segment tree over it. An arrival fills (or, for a correction, rewrites) one slot and updates its path to the root; empty slots are total 0 with a low of +∞. Keep the position of the low in each node, preferring the left on ties.

**Follow-ups.**
1. Events now arrive one at a time and the final history is not known in advance. Which structure would you use instead of fixed slots?
2. The view also wants the lowest balance within a chosen date range. What does your tree need to answer that, and at what cost?
3. A user has ten years of history and the view changes for a back-dated event from three years ago. What would you store to avoid touching the whole history, and what would you show the user?
4. Balances are held in several currencies. What does "lowest balance" mean then, and what would you refuse to compute?

**Follow-up rules.**
- when: recompute, accumulate, for each arrival, prefix sums → ask: A late event lands near the start of an 80 000-event history. How many balances does your code touch for that one arrival?
- when: segment tree, fenwick, binary indexed tree → ask: What does each node store, and how do you combine a left and a right node so that the earliest low wins a tie?
- when: insort, bisect, sorted list → ask: Insertion is cheap with bisect. What about the balances after the insertion point?
- when: sqrt decomposition, blocks, buckets → ask: What is the cost per arrival with your block size, and how does it compare with a tree at 80 000 events?
- when: treap, balanced tree, order statistic → ask: Your tree is online. What does each node keep about its subtree so the low can be read at the root?

**Evaluation Criteria.** History ordered by time with arrival-order ties; running balances that include every earlier event after each insertion; the opening balance excluded; the earliest event on a tie; at Very Hard, corrections that rewrite an event in place and zero amounts that keep the slot; a segment tree (or equivalent) storing total and lowest prefix per node with O(log n) updates; a correct combine and tie argument; sensible answers on online insertion, range queries and multi-currency balances.

## PYP-L2-03: Debug the multi-currency wallet statement

| | |
|---|---|
| **Template ID** | PYP-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Reporting code / minor-unit exponents, one rounding, reversals, local months, funding fallbacks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, staff-data-engineer |
| **Generator** | PYP-L2-03.mjs |

**Business Scenario.** Each month a wallet user can open a statement of their own payments: what they sent and received, converted to their home currency, and how their sent payments were funded. Support has passed on complaints about it. A user paid in yen sees a received amount a hundred times too small, and one paid in dinars sees it ten times too large. A user whose home currency is pounds finds a euro payment one penny off the converted amount shown when it arrived. A payment that was reversed shows in the statement, and so does its reversal, so both totals look inflated. A user in California sees a payment made on the evening of 30 September in October's statement. A payment that fell back to a card after the balance was declined shows in both "from balance" and "from linked", so the two add up to more than was sent. The statement code below is the suspect.

**Problem Statement.** Fix `monthly_statement(entries, month, offset_minutes, home, currencies, rates)` so that it meets this specification. {{replay_rule}}
1. **Currencies.** `currencies[code]` is the currency's minor-unit exponent: 0, 2 or 3 decimal places. `rates[code] = (num, den)` means one major unit of `code` is worth `num / den` US dollars, and `rates['USD']` is `(1, 1)`.
2. **Conversion.** An entry of `amount` minor units of `code` is converted to home minor units once, at the cross rate, as `amount × num_code × den_home × 10^e_home / (den_code × num_home × 10^e_code)`, rounded half up. Nothing is rounded before that, and the statement adds the converted entries without further rounding.
3. **Entries.** Each entry is a dict `{"id", "ts", "kind", "currency", "amount", "reverses", "funding"}`. `ts` is an ISO 8601 time in UTC. `kind` is `"sent"`, `"received"` or `"reversal"`. `amount` is positive. A reversal's `reverses` is the id of the payment it reverses. A sent payment's `funding` lists the attempts in order as `(source, outcome)`, with `source` one of `"balance"`, `"bank"`, `"card"` and `outcome` `"declined"` or `"used"`; exactly one attempt is used.
4. **Month.** An entry belongs to the statement when its time, moved to the user's fixed UTC offset `offset_minutes` (positive east of UTC), falls in `month` (`"YYYY-MM"`).
5. **Reversals.** A payment that has a reversal anywhere in `entries`, in this month or another, counts in neither total and adds 1 to `reversed` if the payment itself is in the month. Reversal entries never count in anything.
6. **Output.** `{"sent", "received", "net", "from_balance", "from_linked", "reversed"}`: the converted totals of the month's sent and received payments that were not reversed, `received − sent`, the part of `sent` whose used source was the balance and the part whose used source was a bank or card, and the count of reversed payments.

**Constraints.** Keep the function's name, arguments and output format. All arithmetic stays in integers. Up to 100 000 entries, processed in linear time.

**Assumptions.** Rates, offsets, amounts and the reversal rule are hypothetical and this exercise's rules; check current docs for how any real statement converts currencies or shows reversals. Offsets are fixed, with no daylight-saving changes. The entries are the user's own, shown only to that user.

**Clarifications.**
- Q: Should a payment be converted to US dollars first, then to the home currency? | A: No. The rates are quoted against US dollars, but the conversion uses one cross rate and rounds once.
- Q: How many decimal places does a currency have? | A: Whatever `currencies` says: 0, 2 or 3. Never assume 2.
- Q: A payment in September was reversed in October. Which statement shows it? | A: Neither September's totals nor October's include it. September counts it as reversed, and the reversal entry itself is never counted.
- Q: Which month does 02:00 UTC on 1 October belong to for a user at −300? | A: 30 September, 21:00 local time, so September.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Convert 1 000 yen to US cents by hand with a rate of `(67, 10000)`, then call the helper.
2. Take a euro amount and convert it to pounds twice: once at the cross rate, rounded once, and once through rounded US cents. Find an amount where the two differ.
3. Read the date helper: does it convert the time to the user's offset, or relabel it?
4. For a sent payment funded after a declined attempt, count how many times its amount is added.

**Follow-ups.**
1. Rates change during the month. Which rate should each entry use, and what would you store on the entry so the statement can always be reproduced?
2. A reversal arrives after the statement for that month was already shown. Do you restate the old statement, and how does the user learn what changed?
3. The user moves from UTC−5 to UTC+1. Which months could change, and what offset would you store with each entry?
4. A user's statement should match the sum of their converted payment notifications to the minor unit. List the reasons it might not, and which rule in this specification prevents each.

**Follow-up rules.**
- when: 10 ** 2, / 100, cents → ask: Where does your code assume two decimal places? Give one currency for which that is wrong in each direction.
- when: usd, via dollars, pivot → ask: Show an amount where converting through rounded US cents and converting once at the cross rate disagree.
- when: replace(tzinfo, tzinfo, astimezone → ask: What is the difference between relabelling a time with a new offset and converting it to that offset? Which one does a statement need?
- when: reversal, reversed, reverses → ask: The reversal falls in the next month. Which statement shows the original payment, and what does the user see in each month?
- when: float, decimal, round( → ask: Which rounding does your code apply to an amount that converts to exactly half a minor unit, and where is that stated?

**Evaluation Criteria.** Finds and explains every bug with its user-facing symptom; each currency's own exponent; a single cross-rate conversion rounded half up once; reversed payments excluded and counted whatever month their reversal falls in, reversal entries never counted; local months computed by converting to the user's offset; only the used funding attempt counted; integer arithmetic throughout; minimal fixes with a regression test per bug.

## PYP-L2-04: Funding attempts as events — each source tried, declined or used, the fallback chosen, and what the user was shown

| | |
|---|---|
| **Template ID** | PYP-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Event modelling / attempt-level events, correlation ids, client and server events joined, funnel-safe analytics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "daily_payments": {"2": ["4 million", "12 million"], "3": ["40 million", "90 million"]},
  "clients": ["web, iOS and Android apps", "web, the apps and checkout buttons on merchant sites"],
  "max_attempts": [2, 3, 4],
  "late_hours": [12, 48]
}
```

**Business Scenario.** When a user sends a payment, the wallet tries a funding source: the balance, a linked bank account or a linked card. If that source is declined (insufficient balance, a bank that does not respond in time, a card that has expired), the wallet may fall back to another source, up to {{max_attempts}} attempts per payment, by this exercise's rule. The user sees a sequence of screens: the source chosen, sometimes a message that a fallback was used, sometimes a prompt to pick another source. About {{daily_payments}} payments a day come from {{clients}}. Product and support teams want to know how often each source is declined, which fallbacks succeed, how long users wait, and what they were shown, without ever logging card or account numbers. Client events can arrive up to {{late_hours}} hours late.

**Problem Statement.** Design the events and the pipeline that turn funding attempts into analytics. Cover the event model (payment, attempt, user-facing screen), the identifiers that tie an attempt to its payment and to the screens shown, how server outcomes and client screens are joined when they arrive out of order or late, how a decline reason is recorded without sensitive detail, the tables analysts use (attempt-level facts and payment-level outcomes), and how the numbers reconcile with the payments that actually completed.

**Constraints.** No card numbers, bank account numbers, or other credentials appear anywhere in the analytics events, only an opaque reference to the linked source and its kind. Each payment has at most {{max_attempts}} attempts, and the attempt order must be recoverable. Retries of an event from the client must not double count. Payment-level counts must equal the count of completed payments in the payment system of record for every day. Reports must be re-runnable for any past day after late events arrive.

**Assumptions.** Volumes, attempt limits and lateness are hypothetical. Decline reasons come from a fixed list of coarse categories (insufficient balance, issuer declined, timeout, source expired, risk hold) chosen for this exercise; risk decisions are represented only as "a score you are given" and a hold, never their inputs. The fallback rule is this exercise's, so check current docs for how any real wallet chooses a source.

**Clarifications.**
- Q: Who decides the fallback, the client or the server? | A: The server chooses and records it; the client shows a screen. Your model must keep both and say which is authoritative for what.
- Q: Is a declined attempt that the user never saw still an event? | A: Yes. Silent fallbacks are exactly what the product team wants to measure.
- Q: Can a user cancel during a fallback prompt? | A: Yes. That payment ends without completing, and its attempts still count.
- Q: May we log the last four digits of a card? | A: Not in analytics. Use an opaque per-source reference and its kind; the user's own app can show its own details from the system of record.
- Q: How late can a client screen event arrive? | A: Up to {{late_hours}} hours, for example from a phone that went offline.

**Hints.**
1. Give every payment an id at the server, every attempt an `(payment_id, attempt_no)`, and every screen a client event id that carries the payment id.
2. Treat the server's attempt outcomes as the source of truth for money, and client screens as the source of truth for what the user saw.
3. Build payment-level outcomes from attempts, then left-join screens with an allowed lateness, and reconcile daily counts with the payment system of record.

**Follow-ups.**
1. Analysts report that "fallback success" doubled overnight. List the pipeline causes you would check before believing it.
2. A new funding source kind is added next quarter. What has to change in the events, the tables and the reports?
3. The team wants per-user "you often fall back to your card" tips. What data does that need, who may see it, and how would you keep it out of the aggregate tables?
4. At {{daily_payments}} payments a day, late client events keep rewriting old partitions. How would you bound that cost and tell analysts when a day is final?

**Follow-up rules.**
- when: card number, last four, pan, account number → ask: Which table would that field land in, who can read it, and what opaque reference would replace it?
- when: session id, user id, device id → ask: Which question needs that identifier, and could the payment id answer it instead?
- when: dedupe, idempotent, exactly once → ask: Where exactly is a retried client event dropped, and what key do you use?
- when: late, watermark, allowed lateness → ask: A screen event arrives {{late_hours}} hours late for a payment already reported. What changes in yesterday's numbers, and who notices?
- when: funnel, conversion rate, success rate → ask: What is the denominator of your success rate: attempts, payments or users? Show how the choice changes the number.

**Production Reality Check.**
- A client release resends every funding screen event when the app resumes, for two days, so "fallback notices shown" doubles while server attempts do not.
- One decline path starts copying the issuer's raw response, including a masked card number, into the decline detail field for six hours.

**Evaluation Criteria.** A clear event model separating payments, attempts and screens; ids that preserve attempt order and tie screens to payments; server outcomes authoritative for money and client events for experience; no credentials in analytics, coarse decline categories, risk only as a given score and hold; deduplication of client retries; late events with re-runnable partitions; attempt-level and payment-level tables with explicit denominators; daily reconciliation with completed payments; sensible handling of new source kinds and per-user features kept apart from aggregates.

## PYP-L2-05: Exchange-rate quotes shown and used — quotes with expiry, conversions accepted, and proof that the rate applied is the rate the user saw

| | |
|---|---|
| **Template ID** | PYP-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data lineage / quote records, expiry, quote-to-conversion binding, audit and reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "quote_ttl": ["30 seconds", "2 minutes", "10 minutes"],
  "daily_quotes": {"2": ["5 million", "20 million"], "3": ["80 million", "200 million"]},
  "currency_pairs": ["about 150", "about 400"],
  "audit_years": [5, 7]
}
```

**Business Scenario.** Before a user sends money across currencies, the wallet shows a quote: the amount the recipient will get, the rate including the conversion fee, and how long the quote holds ({{quote_ttl}} in this exercise). If the user accepts in time, the conversion must use exactly that rate; if the quote expires, a new one is shown. Users and regulators can ask later what rate was shown and applied. About {{daily_quotes}} quotes a day are shown across {{currency_pairs}} currency pairs, and most are never accepted. Currencies have 0, 2 or 3 decimal places, and amounts are integer minor units.

**Problem Statement.** Design how quotes, acceptances and conversions are recorded and proven. Cover the quote record (pair, rate, fee, amounts, issued and expiry times, the rate source version), how an acceptance is bound to one quote and checked against its expiry, the conversion record and its link to the quote, the stated rounding rule applied once, retention of quotes nobody accepted, how you prove for any conversion that the applied rate equals the rate shown, and the reconciliation that finds conversions without a valid quote.

**Constraints.** A quote is immutable once shown. An acceptance after expiry must never use the expired rate. A quote can be accepted at most once, even if the client retries. Every conversion must be traceable to the quote shown, for {{audit_years}} years. Rounding happens once, by a stated rule, with each currency's exponent taken from data. Unaccepted quotes are numerous and may be kept for a shorter time than accepted ones.

**Assumptions.** Rates, fees, the quote lifetime and retention periods are hypothetical and this exercise's rules; check current docs for how any real service quotes or discloses conversion rates. The base rates come from an upstream feed that publishes versioned rate sets.

**Clarifications.**
- Q: Whose clock decides whether a quote has expired? | A: The server's at acceptance. The client's timer is a display only.
- Q: Can the same quote be shown on two devices? | A: It can be fetched again by its id, but it is one quote, and it can be accepted only once.
- Q: What do we need to keep for quotes nobody accepted? | A: Enough for aggregate analysis of quotes shown and expired; you decide how long and at what grain, and say why.
- Q: Is the fee part of the rate? | A: In this exercise the quoted rate includes the fee, and the quote records the base rate and the fee separately so both can be shown.
- Q: Where does rounding happen? | A: Once, when the recipient amount is computed from the sender amount, half up in this exercise, using the destination currency's exponent.

**Hints.**
1. Make the quote a first-class immutable record with its own id, and make the conversion carry that id.
2. Check expiry and single use in one atomic step at acceptance (for example, a conditional update from `open` to `accepted` with `now < expires_at`).
3. Store the inputs to the amount (sender amount, rate, exponents, rounding rule version), so any conversion can be recomputed and compared.

**Follow-ups.**
1. The upstream rate feed publishes a wrong rate for one pair for five minutes. Which quotes and conversions are affected, and how do you find them?
2. A user says they were charged a different rate than they saw. Walk through the evidence you would produce.
3. Product wants to show a quote that holds for {{quote_ttl}} even when the market moves quickly. What risk does the business carry, and what data would you build to measure it?
4. At {{daily_quotes}} quotes a day, the quote store dominates storage. How do you tier and expire it without breaking the audit trail for accepted ones?

**Follow-up rules.**
- when: cache, redis, in memory → ask: The cache loses the quote before the user accepts. What does the user see, and could the conversion ever use a different rate?
- when: float, double, decimal → ask: How is the rate stored, and which exact computation turns a sender amount into recipient minor units?
- when: idempotency, retry, accept once → ask: Two acceptances of the same quote arrive 50 ms apart from two devices. Show the step that lets exactly one win.
- when: expiry, ttl, expires_at → ask: The acceptance arrives one second after expiry because the network was slow. What happens, and what does the user see?
- when: audit, immutable, append-only → ask: How would you prove to an auditor, {{audit_years}} years later, that a conversion used the shown rate?

**Production Reality Check.**
- The upstream feed publishes a rate set in which one pair's rate is off by a factor of 100 for five minutes, and quotes with a {{quote_ttl}} lifetime are issued from it.
- A deploy makes the acceptance check compare expiry with the time the client reports, and for one day acceptances up to a minute after expiry succeed.

**Evaluation Criteria.** An immutable quote record with id, pair, base rate, fee, amounts, issue and expiry times and rate-set version; acceptance bound to one quote with an atomic expiry and single-use check on server time; conversions carrying the quote id and the inputs to a single, versioned rounding with per-currency exponents; a reconciliation that finds conversions without a valid quote or with mismatched amounts; differentiated retention with audit for accepted quotes; a credible incident plan for a bad upstream rate.
