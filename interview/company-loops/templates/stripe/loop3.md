# Stripe · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of an online
payments platform. Every workload, number, schema and incident is hypothetical.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## STR-L3-01: A double-entry ledger for money movement

| | |
|---|---|
| **Template ID** | STR-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / double-entry ledger, immutability, invariants |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "daily_journals": {"1": ["4 million"], "2": ["40 million", "90 million"], "3": ["250 million", "600 million"]},
  "currencies": [25, 60, 135],
  "snapshot_cadence": ["hourly", "every 15 minutes", "daily"],
  "retention_years": [7, 10]
}
```

**Business Scenario.** A payments platform moves money for merchants: a card charge credits the merchant and the platform's fee account, a refund and a payout debit the merchant, and a currency conversion moves value between currencies. Every movement must be explainable to an auditor for {{retention_years}} years. The platform posts about {{daily_journals}} journals a day across {{currencies}} currencies, and product teams want each merchant's available balance on demand.

**Problem Statement.** Design the ledger's data model and its write path. Define accounts, journals and entries; how a journal is posted atomically and exactly once; how mistakes are corrected without editing history; how balances are served fast (snapshots taken {{snapshot_cadence}} plus the entries since); which invariants the system enforces, where, and how you prove they hold; and the queries an auditor will run.

**Constraints.** Posted entries are immutable: no UPDATE or DELETE on posted money. Every journal sums to zero **in each currency**. Amounts are integers in each currency's minor unit. A client may retry a posting after a timeout, and the retry must not move money twice. Balance reads p99 under 50 ms.

**Assumptions.** Volumes, latency targets and retention are hypothetical. Accounts belong to a merchant or to the platform (cash at banks, fees, FX clearing, reserves). Payment-processor terms such as "balance transaction" are used in their public meaning: one record of a movement through an account balance, with amount, fee and net in minor units.

**Clarifications.**
- Q: Is a negative balance allowed? | A: For some account types yes (a merchant can go negative after a refund); for platform cash accounts it is an alert, not a constraint violation.
- Q: Do journals ever touch more than two accounts? | A: Yes. A charge has at least three legs (cash, merchant, fees); a conversion has four, two per currency.
- Q: What does a client send to make a posting safe to retry? | A: An idempotency key per logical operation, the same pattern public payment APIs document for POST requests.
- Q: Can a journal be backdated? | A: Only with an explicit effective time; the time it was recorded is always kept as well.
- Q: Who reads the ledger? | A: The balance API, finance close, reconciliation against bank statements, and auditors.

**Hints.**
1. Separate the journal (one business event, atomic) from its entries (one signed amount per account per currency). The invariant lives on the journal.
2. A correction is a new journal: a reversal that negates the original, then the right posting. Link them.
3. A balance is a cached fold over entries. Decide what the snapshot covers (up to which entry or which time) so that snapshot + tail is always exact.

**Follow-ups.**
1. Where exactly is the "sums to zero per currency" invariant enforced: in the database, in the posting service, or by an asynchronous checker? What does each catch that the others miss?
2. One platform account (fees in the main currency) is touched by most journals. What happens to write contention, and how do you remove the hot row without breaking the balance?
3. An auditor asks for one merchant's balance as of the end of last quarter, as it was reported then, and as it is known now after backdated corrections. What do you store to answer both?
4. The ledger must be split across shards by account. A journal now spans shards. How do you keep posting atomic and the invariant true?
5. Prove to finance, every day, that no entry was lost or duplicated between the ledger and the warehouse copy.

**Follow-up rules.**
- when: update balance, balance column, increment, running balance → ask: Two postings to the same account commit at the same moment. Show how your balance stays correct, and what the row lock does to throughput on the fees account.
- when: delete, update the entry, edit, overwrite → ask: The constraint says posted money is immutable. How would you correct a wrong amount without UPDATE, and what does the auditor see afterwards?
- when: float, decimal, double, numeric → ask: Why integers in minor units? What breaks with floating point, and how do you handle a currency whose minor unit is not 1/100?
- when: idempotency key, idempotency, dedup → ask: The retry arrives with the same key but a different amount. What does your posting API return, and how long do you keep keys?
- when: event sourcing, event log, kafka → ask: Is the event log your ledger, or does it feed one? Where is the invariant checked before money is considered posted?

**Production Reality Check.**
- The nightly invariant check finds 1,800 journals in one zero-decimal currency that do not sum to zero; all came through a bulk import path that bypassed the posting service. They have already been folded into the balance snapshots taken {{snapshot_cadence}}.
- A client timed out on a payout posting and retried with a new idempotency key: the merchant's payout was journaled twice and the second one has already been sent to the bank.
- After a backfill of backdated entries, the balance API (snapshot plus tail) and a full recomputation from entries disagree for 40 merchant accounts.

**Evaluation Criteria.** Journal/entry separation with signed integer minor units; per-currency zero-sum enforced synchronously on write and re-verified asynchronously; immutability with reversals and links; idempotent posting with a stored request fingerprint; snapshot + tail with a precise watermark; hot-account mitigation; effective time distinct from recorded time; audit queries named; each incident handled with containment, correction by compensating journals, and a guardrail.

## STR-L3-02: The payment intent lifecycle, from OLTP to facts

| | |
|---|---|
| **Template ID** | STR-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / state machines, event models, accumulating snapshots |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_intents": {"1": ["2 million"], "2": ["15 million", "30 million"], "3": ["80 million", "150 million"]},
  "action_share": ["3%", "8%", "15%"],
  "webhook_lag": ["10 minutes", "2 hours", "9 hours"]
}
```

**Business Scenario.** A merchant integration creates a payment intent for each checkout. The intent moves through a lifecycle: it requires a payment method, may require customer action (for example an authentication step, about {{action_share}} of intents here), moves to processing, and ends succeeded or canceled; a failed attempt sends it back to requiring a payment method. About {{daily_intents}} intents are created a day. Merchants receive state changes as webhook events, which can arrive late (up to {{webhook_lag}} here), more than once, and out of order, as public payment API documentation warns.

**Problem Statement.** Model the lifecycle three ways and say how they connect: (1) the OLTP state machine, with its allowed transitions and how a transition is recorded; (2) the event model (what one event carries and how a consumer applies it safely); (3) the analytical facts that answer "conversion from created to succeeded by day, merchant and payment method", "time spent in requires_action" and "how many intents are stuck in processing right now". Choose between an accumulating snapshot fact and a transaction (event) fact, or justify both.

**Constraints.** The analytical model must be correct when events arrive out of order or twice. A terminal state is never left. Conversion is reported by the day the intent was **created**, and that number must stop changing after a defined close.

**Assumptions.** Volumes, shares and lags are hypothetical. Public documentation lists further statuses (for example requires_confirmation and requires_capture); they are in scope if you include them. Every event carries the object's id, the new status, an event id and the time the event was created.

**Clarifications.**
- Q: Which states are terminal? | A: succeeded and canceled. A failed payment attempt is not terminal: the intent returns to requires_payment_method.
- Q: Can an intent pass through requires_action more than once? | A: Yes, after a failed attempt and a new payment method.
- Q: Do I get a sequence number per intent? | A: No. You get the event's created time (second precision) and the event id; two events can share a second.
- Q: Do analysts need every attempt or only the outcome? | A: Both: conversion needs the outcome, and decline analysis needs each attempt.
- Q: How long can an intent stay open? | A: Days. An abandoned intent may never reach a terminal state unless the merchant cancels it.

**Hints.**
1. An accumulating snapshot has one row per intent with a column per milestone, updated as milestones arrive. A transaction fact has one row per transition and is append-only.
2. Out-of-order events: apply a transition only if it is legal from the current state, or rebuild the current state from the full event set ordered by a rank you define.
3. "Stuck in processing" is a question about the current state; "time in requires_action" is a question about intervals. Different grains.

**Follow-ups.**
1. A `succeeded` event arrives before the `processing` event for the same intent. Walk through your consumer and both facts.
2. Define the close: when is a creation day's conversion final, given intents can stay open for days? What do you show before that?
3. The same event is delivered three times during a backlog of {{webhook_lag}}. Prove your facts count it once.
4. Product adds a new status between processing and succeeded. What breaks in each of your three models, and how do you roll it out without rewriting history?
5. At {{daily_intents}} a day, the accumulating snapshot is updated in place. How do you store it so updates stay cheap in a columnar warehouse?

**Follow-up rules.**
- when: accumulating snapshot, one row per intent, milestone → ask: Your snapshot row is updated each time a milestone lands. How do you keep a late duplicate event from overwriting a later milestone with an earlier one?
- when: event fact, transaction fact, one row per event, append only → ask: How does an analyst get "intents currently in processing" from an append-only fact without scanning all history?
- when: timestamp order, order by created, latest event → ask: Two events for one intent share the same second. Which one wins, and why is "latest timestamp wins" unsafe for a terminal state?
- when: upsert, merge, overwrite status → ask: A stale `requires_action` event arrives after `succeeded`. What does your merge do, and what stops it?

**Production Reality Check.**
- The webhook consumer was down for {{webhook_lag}}; on recovery it receives the backlog with retries interleaved, and the "stuck in processing" dashboard pages the on-call team for 40,000 intents that actually succeeded.
- A merchant integration bug confirms some intents twice; the warehouse now shows {{action_share}} more requires_action entries than authentication attempts recorded upstream.
- Yesterday's conversion rate, already sent to a merchant, changes by 0.7 points overnight as late terminal events land.

**Evaluation Criteria.** Explicit state machine with legal transitions and terminal states; idempotent, order-tolerant consumer (event-id dedup, transition legality or rank-based rebuild); a transaction fact for intervals and attempts plus an accumulating snapshot (or current-state table) for outcome and stuck queries, with the trade-off stated; creation-day attribution with a close and a provisional label; schema evolution of states; each incident diagnosed with the right model.

## STR-L3-03: Dispute lifecycle and win-rate reporting

| | |
|---|---|
| **Template ID** | STR-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / lifecycle history, SCD versus event sourcing, deadlines |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "monthly_disputes": ["40,000", "250,000", "1.2 million"],
  "evidence_days": [7, 10, 20],
  "networks": [3, 5],
  "fee_rule": ["is charged when a chargeback opens (never for an inquiry) and returned if the dispute is won", "is charged when a chargeback opens (never for an inquiry) and kept whatever the outcome"]
}
```

**Business Scenario.** A cardholder can question a payment with their issuer. Sometimes this starts as an inquiry (a request for information that is not yet a chargeback); often it starts as a chargeback directly. The merchant may submit evidence before a deadline, here {{evidence_days}} days, after which the issuer decides: won or lost. In this scenario a dispute fee {{fee_rule}}. Disputes arrive from {{networks}} card networks, about {{monthly_disputes}} a month, and merchants want win rates they can act on.

**Problem Statement.** Design the data model for disputes: the lifecycle (inquiry → chargeback → evidence submitted → under review → won or lost, including an inquiry that closes without escalating), deadlines, the money movements (the disputed amount withdrawn, the fee, and any amount returned on a win), the links to the original charge and to refunds on that charge, and the history needed to answer "what state was this dispute in on any date". Then define the win-rate metric precisely and the model that serves it by month, network, reason and merchant.

**Constraints.** Win rate must be reproducible: last month's published number may change only by a documented restatement. Every money movement reconciles to the ledger. Missing an evidence deadline must be detectable before it happens.

**Assumptions.** Volumes, deadlines and the fee rule are hypothetical; real deadlines and fees vary by network and region. A charge can have several partial refunds and at most one open dispute at a time. Network reason codes are mapped to a small internal set of reasons.

**Clarifications.**
- Q: Does an inquiry count in the win rate? | A: Not as a chargeback. Report inquiries separately, with their own escalation rate.
- Q: What if the merchant refunds after the dispute opens? | A: In this scenario the refund does not close the dispute; both can move money, so double loss is possible and must be visible.
- Q: Does a dispute's amount always equal the charge amount? | A: No. A dispute can be partial, and the charge may already be partly refunded.
- Q: Win rate by which month: opened or closed? | A: You decide, but say why and keep it consistent.
- Q: Can a decision be reversed? | A: Rarely, through a later network stage. Model it so that it is possible.

**Hints.**
1. Separate the dispute entity (current state, keys, deadline) from its history (one row per transition with an effective time), and from the money (ledger journals that reference the dispute).
2. A win rate needs a cohort and a denominator. "Won / (won + lost)" over disputes **opened** in a month, counted once closed, is one defensible definition; say what you do with still-open disputes.
3. A type-2 dimension and an event-sourced history can answer the same "state on date X" question. Compare what each costs to correct.

**Follow-ups.**
1. Write the definition of win rate you would publish, including what happens to disputes still open at month end and to inquiries that escalate.
2. A network sends the "won" decision, then a correction 3 days later saying "lost". What happens in your history, your ledger and your published win rate?
3. Show how a merchant support agent answers "how much did this one charge cost us in total": charge, refunds, dispute amount, fee and any return.
4. The deadline alert must fire 48 hours before {{evidence_days}}-day deadlines across time zones. Where does the deadline live and in which time zone?
5. At {{monthly_disputes}} disputes a month and {{networks}} networks with their own codes, how do you keep the reason mapping stable when a network adds codes?

**Follow-up rules.**
- when: scd, type 2, valid_from, valid_to → ask: A decision arrives with an effective time earlier than the last version's valid_from. How does your type-2 table absorb it without overlapping intervals?
- when: event sourcing, event store, events table → ask: An analyst wants the state of 1 million disputes on 30 June. Does your design replay events for each query, or keep a projection?
- when: win rate, won / total, percentage won → ask: Your denominator includes disputes still under review. What does that do to the newest month, and how will a merchant misread it?
- when: status column, update status → ask: How do you answer "how long did this dispute spend under review" if the status column is overwritten?

**Production Reality Check.**
- The {{evidence_days}}-day deadline was computed in UTC for one network whose deadline is defined in another time zone; 300 disputes were auto-marked expired a day early.
- A network sends a batch of corrections reversing 2% of last month's "won" decisions after the monthly win-rate report went to merchants.
- Finance finds disputes where a fee was debited twice, once at the inquiry and again when it escalated to a chargeback, although the fee rule says it {{fee_rule}}.

**Evaluation Criteria.** Clean separation of entity, history and money; explicit inquiry and chargeback stages; deadlines stored with their source time zone; links to charge and refunds that make total cost per charge answerable; history that supports state-as-of-date and late corrections; a precise, cohort-based win-rate definition with a restatement policy; reason-code mapping as versioned data; each incident resolved with the history and ledger intact.

## STR-L3-04: Multi-currency balances and FX for reporting

| | |
|---|---|
| **Template ID** | STR-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / minor units, effective-dated FX rates, restatement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "currencies": [40, 90, 135],
  "reporting_currency": ["USD", "EUR", "GBP"],
  "rate_cadence": ["hourly", "daily"],
  "report": ["monthly gross volume by merchant country", "quarterly net revenue by product line"]
}
```

**Business Scenario.** Customers pay in their own currency (the presentment currency) and merchants can be settled in a different one (the settlement currency); the conversion happens at a rate on the day of the charge. The platform supports {{currencies}} currencies, including zero-decimal currencies (such as JPY) and three-decimal currencies (such as KWD). Leadership wants {{report}} in {{reporting_currency}}, and finance wants to know how much of a month-over-month change is real volume and how much is currency movement.

**Problem Statement.** Design the data model for amounts, currencies and FX rates, and the reporting layer on top. Cover: how an amount is stored (minor units and per-currency exponents), the FX rate table as effective-dated data published {{rate_cadence}}, the difference between the rate applied to a transaction (a fact about that transaction) and the rate used for reporting (a policy), rounding rules and where they apply, and how a report is restated when a rate or an exponent was wrong.

**Constraints.** No floating point anywhere money is stored. A transaction's settlement amount never changes after it is recorded. Reports are reproducible: re-running last quarter's report gives last quarter's number unless a restatement is published. Totals in {{reporting_currency}} must reconcile, within a stated rounding tolerance, with the sum of converted lines.

**Assumptions.** Currency counts, cadence and report choices are hypothetical. A currency's exponent can change (a redenomination) but rarely; the rate source can publish a correction.

**Clarifications.**
- Q: Which rate converts a transaction for the report? | A: Your choice: the rate actually applied, the rate on the transaction date, or a month-average rate. Say which report uses which and why.
- Q: Do rates come with a valid-from time? | A: Yes, and corrections arrive as new rows for the same valid-from time with a later published time.
- Q: Round per line or per total? | A: Decide, and state the tolerance between the two.
- Q: Is the conversion fee part of the rate? | A: Model it separately; reporting wants a rate without fees.
- Q: What precision do rates have? | A: Up to 10 significant digits; store them exactly.

**Hints.**
1. Store `amount_minor BIGINT` plus `currency`, and keep the exponent in a currency table with its own valid-from date. Never store a decimal amount as the source of truth.
2. A rate table keyed by (base, quote, valid_from, published_at) answers both "the rate we believed then" and "the corrected rate now".
3. Constant-currency reporting (this period's volume at last period's rates) separates volume change from FX change.

**Follow-ups.**
1. Write the join that picks "the rate in force at the transaction time, as published by the report's cut-off". What index makes it cheap?
2. A three-decimal currency was loaded with exponent 2 for six weeks. How do you find every affected number, and what do you restate?
3. Show how to split month-over-month change in {{reporting_currency}} into volume and FX effects.
4. Line-level rounding and total-level rounding disagree by 3 units of {{reporting_currency}} on a report. Which is right, and what do you print?
5. The rate source publishes a correction to one of last Tuesday's {{rate_cadence}} rates. Which reports change, which must not, and how does a reader tell?

**Follow-up rules.**
- when: float, double, decimal amount, numeric amount → ask: What does 0.1 + 0.2 do to a ledger total, and how would your design guarantee integers end to end?
- when: latest rate, current rate, today's rate → ask: A report for last quarter is re-run today. With "latest rate", does it give the same answer as when it was published?
- when: month average, average rate → ask: Where does the average come from, and how do you reconcile a month-average report with the settlement amounts finance books?
- when: round, rounding, half up, banker → ask: At which step do you round, and what tolerance do you publish between the sum of rounded lines and the rounded total?

**Production Reality Check.**
- One {{rate_cadence}} publication carried a wrong rate for one currency (off by a factor of 100); transactions converted at it are already in the draft of {{report}} that went to leadership.
- A three-decimal currency's exponent was loaded as 2, so its volumes in {{reporting_currency}} were 10 times too high for six weeks.
- Finance's {{reporting_currency}} total and the sum of the per-merchant lines in the report differ by more than the published rounding tolerance after a currency was added mid-month.

**Evaluation Criteria.** Integer minor units with an effective-dated exponent table; FX rates as bitemporal data (valid-from and published-at); applied rate stored on the transaction, reporting rate as a named policy; explicit rounding step and tolerance; constant-currency decomposition; reproducible reports with explicit restatement; each incident traced to the affected rows, corrected and guarded.

## STR-L3-05: Ledger queries — quarantine unbalanced journals, balances as of a time

| | |
|---|---|
| **Template ID** | STR-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / double-entry invariants, as-of balances, bitemporal filters |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |
| **Generator** | STR-L3-05.mjs |

**Business Scenario.** A double-entry ledger stores each money movement as a journal (one business event) with several entries (one signed amount per account and currency). A positive `amount_minor` is a debit, a negative one a credit, and every journal should sum to zero in each currency. A buggy import has let some unbalanced journals in. Finance wants each account's balance at a point in time, with unbalanced journals held aside rather than silently posted.

**Problem Statement.** Write one PostgreSQL query that returns `account_id, currency, balance_minor, unbalanced_journals`: one row per (account_id, currency) that has at least one entry in an eligible journal, ordered by `account_id, currency`. {{time_rule}} A journal is *unbalanced in a currency* when its entries in that currency do not sum to zero. `balance_minor` is the sum of `amount_minor` over the account's entries in that currency from eligible journals, leaving out entries of journals that are unbalanced in that currency. `unbalanced_journals` is the number of distinct eligible journals, unbalanced in that currency, that have an entry for the account in that currency. {{currency_rule}} {{reversal_rule}}

**Constraints.** One SQL statement (CTEs allowed). Time boundaries are inclusive. A row whose balance is 0 is still returned. The sample has {{journals}} journals and {{entries}} entries; production has billions of entries.

**Assumptions.** Hypothetical schema, accounts and amounts. `cash`, `fees` and `fx_clearing` are platform accounts; `merchant_*` accounts belong to merchants. Balances are reported in each currency's minor unit, never converted.

**Clarifications.**
- Q: Is balance "debits minus credits"? | A: Yes: the signed sum of amount_minor, with debits positive.
- Q: If a journal is unbalanced in one currency but balanced in another, what happens to its entries in the balanced currency? | A: They count. Balance is checked per journal per currency.
- Q: Should an account whose entries all cancel, or are all held aside, appear? | A: Yes, with balance_minor 0.
- Q: Is a journal at exactly the as-of time included? | A: Yes. Boundaries are inclusive.
- Q: Does the reversal of a journal make the original disappear? | A: No. Both are journals; each counts when it is itself eligible.

**Hints.**
1. Decide eligibility once, at the journal level, in its own CTE. Every entry of a journal shares its timestamps.
2. Check balance with `GROUP BY journal_id, currency` over eligible entries, then join that verdict back to the entries.
3. `SUM(...) FILTER (WHERE ...)` and `COUNT(DISTINCT ...) FILTER (WHERE ...)` produce both output columns in one pass.

**Follow-ups.**
1. At billions of entries, this query recomputes every balance from the beginning. How would balance snapshots change it, and what makes snapshot + tail exact when backdated journals arrive?
2. Turn the unbalanced-journal check into a write-time guarantee. Where does it run, and what does the posting API return when it fails?
3. Finance wants the balance "as of effective time T, as known at K" for every month end of last year. How do you store and index the ledger so that is cheap?
4. An auditor asks you to prove the quarantined journals were never visible in a merchant's available balance. What evidence do you produce?

**Follow-up rules.**
- when: group by journal_id, having sum, sum(amount_minor) <> 0 → ask: Did you group by currency too? What does a currency conversion journal look like to your check?
- when: created_at → ask: Which timestamp decides whether a backdated journal is in the balance, and when does created_at still matter?
- when: reverses_journal_id, not in, not exists → ask: You are excluding reversed journals. What is the balance one minute before the reversal was posted?
- when: having → ask: Your HAVING clause filters rows. Which accounts disappear from the report, and should they?

**Production Reality Check.**
- The quarantined journals in this report come from a bulk import that bypassed the posting service. Finance asks whether merchants could have withdrawn against them, and the balance API has no notion of quarantine.
- After a correction batch posts reversals with effective times earlier than their creation, last month's closing balances recomputed today no longer match the balances finance reported, and finance asks which number is right.

**Evaluation Criteria.** Eligibility decided per journal with inclusive boundaries (and, at the hardest level, effective time with a known-at cut-off); balance check grouped by journal and currency; unbalanced entries excluded from the balance but counted; reversals treated as ordinary journals; zero rows kept; deterministic ordering; can explain snapshots and write-time enforcement.
