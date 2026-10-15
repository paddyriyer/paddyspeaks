# PayPal · Loop 3 — evaluator notes (hidden from candidates)

## PYP-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Reference data.** `currencies (currency, exponent)` with exponent 0, 2 or 3; every amount column is `BIGINT` in minor units next to a `currency` column, and display formatting reads the exponent from here.
- **Accounts and instruments.** `accounts (account_id, user_id, home_country, opened_at, closed_at)`. `instruments (instrument_id, kind bank|card, token, display_suffix, network_or_bank_ref, currency)`; the token comes from a vault and no card or bank number exists in this model. `instrument_links (link_id, account_id, instrument_id, linked_at, verified_at NULL, removed_at NULL, removed_reason)`: relinking the same instrument is a new link row, so history is never overwritten.
- **Preference history.** `funding_preferences (account_id, instrument_id NULL, balance_first bool, valid_from, valid_to NULL)`, non-overlapping per account (an exclusion constraint on a range, or a single writer that closes the previous row in the same transaction). Removing the preferred instrument closes the preference interval with a reason; "preferred on D" is the interval containing D, possibly "none".
- **Balances from movements.** `balance_movements (movement_id, account_id, currency, bucket available|held, amount_minor signed, kind payment_debit|payment_credit|hold_placed|hold_released|conversion_out|conversion_in|refund, payment_id NULL, hold_id NULL, conversion_id NULL, occurred_at, recorded_at)`. A hold is two movements per side: placed (available −x, held +x) and released (held −x, available +x). Available at T = Σ available-bucket movements with `occurred_at <= T`; held likewise. `balance_snapshots (account_id, currency, as_of, available_minor, held_minor)` daily (or every N movements) so an as-of read is a snapshot plus a short tail; the snapshot is rebuildable.
- **Holds.** `holds (hold_id, account_id, currency, amount_minor, placed_at, release_due_at, released_at NULL, review_ref)`; `release_due_at` at most {{hold_days}} days after placement in this exercise; the review is only referenced.
- **Conversions.** `conversions (conversion_id, account_id, from_currency, to_currency, from_minor, to_minor, rate, quote_id, quoted_at, applied_at, rounding_rule)`, rounded once, half away from zero, to the target's minor unit.
- **Funding legs.** `payment_funding_legs (payment_id, leg_no, source_kind balance|bank|card, currency_of_source, instrument_id NULL, source_minor, payment_minor, conversion_id NULL, attempt_outcome used|declined, decline_reason NULL)`. Invariant: Σ `payment_minor` over used legs = payment amount; declined attempts are kept with zero amounts for the funding-mix and fallback questions. Refunds write `refund_legs (refund_id, payment_id, leg_no, minor)` reversing legs in reverse order (this exercise's rule).
- **Analytics.** `fct_funding_leg_daily (date, payment_currency, source_kind, legs, payments, payment_minor_sum)` built from legs, never from accounts; shares by amount are Σ leg amount ÷ Σ payment amount, so they add up to 100%.
- **Concurrency.** The write path serialises per (account, currency): a row lock on a per-balance row holding the derived current available amount, updated in the same transaction as the movement with a `CHECK (available_minor >= 0)`, or a conditional update (`… WHERE available_minor >= :x`). The cached figure is a derived lock target, rebuilt from movements and reconciled daily.

**Competing designs to accept.** A double-entry journal underneath (accept, as long as the candidate keeps the wallet questions in view: funding legs, preference history, per-currency available and held). Holds as a separate table with available computed as Σ balance − Σ open holds, if "available at T" still works for past T. An event-sourced account aggregate with the balance row as its projection. Per-payment funding stored as JSON on the payment, if they show how the funding mix is computed and reconciled.

**Bottlenecks and failure modes.** One balance column per user; balance in one currency only; a float or decimal amount with an assumed exponent; instrument rows overwritten on removal; a preferred flag with no history; holds as a boolean on the payment; funding recorded as a single source per payment; conversions rounded per leg and again on the total; funding mix counted by payments rather than by leg amounts; balance checks against a cached value read outside the transaction; at {{payments_per_day}} payments a day, as-of balance queries that scan all movements.

**Incident guidance.**
- *Funding mix over 100%*: payments with two sources were counted once per source. Recompute the daily fact from legs by amount (and, if a count is wanted, count legs and payments separately with clear labels); add a test that shares by amount add up to 100% per day and currency.
- *Negative available balance*: a check-then-write race on a cached balance. Move the check into the write transaction (row lock or conditional update, with a non-negative constraint), find the affected accounts from movements, and resolve each negative window by the rule the product sets (for example, holding the later payment); alert on any negative derived balance.
- *Statement totals moving daily*: conversion at read time with current rates. Use the rate recorded on each conversion or leg; where a cross-currency total is only informative, label it with the rate date and freeze it with the statement. Restate the affected statements and add a check that a closed statement's totals never change.

**Follow-up guidance.** (1) Snapshot at or before T plus Σ movements in (snapshot, T], per bucket; index (account_id, currency, occurred_at). (2) Leg 1: balance 1840 EUR minor; leg 2: card in USD with a conversion row, `payment_minor` 3160 EUR; check Σ payment_minor = 5000. (3) The preference interval was closed on the 3rd (reason: instrument removed), so on the 5th no instrument was preferred; a payment on the 5th used the balance and then the fallback rule, and its legs say so. (4) Facts: movements and funding legs at event grain; daily fact by date, currency and source kind; incremental by date partition. (5) Serialise per balance; the second payment fails or uses the next source, never goes negative.

**Rubric anchors.** 2: a users table with a balance column and a default card flag; floats; no history. 3: instruments and links over time, preference history, per-currency movements with available and held, funding legs that reconcile. 4: also conversions recorded once with the shown rate, refunds against legs, write-path concurrency, rebuildable snapshots sized for volume, and incident repairs.

**Strong signals.** Writes the leg invariant unprompted; asks where the exponent comes from; treats the cached balance as derived. **Red flags.** Storing card numbers; amounts in floating point; overwriting instrument or preference rows; converting historical totals at today's rate.

## PYP-L3-02

**Reference architecture (one defensible design).**
- **Requests.** `requests (request_id, requester_account_id, kind single|split, currency, created_at, rule_version)` and `request_versions (request_id, version, total_minor, split_method equal|custom, participants_ordered, created_at)`: an edit before any payment is a new version, and shares are recomputed for it.
- **Shares.** `shares (share_id, request_id, version, participant_ref, position, amount_minor, remainder_minor)` where `participant_ref` is an account or an invited identifier. Equal split: base = total ÷ n (integer division), leftover = total − base × n; participants at positions 1..leftover get +1 minor unit (this exercise's rule). Invariant: Σ shares = total for each version, checked on write.
- **Share events.** `share_events (event_id, share_id, kind paid|declined|expired|cancelled|reminded, amount_minor NULL, payment_id NULL, source_currency NULL, source_minor NULL, conversion_id NULL, occurred_at, recorded_at)`. A payment answers one share and never exceeds the outstanding amount (checked in the transaction that writes the event).
- **Rules.** `request_rules (rule_version, reminder_after_hours, expiry_after_days, remainder_rule, valid_from)`; each request stores the version it was created under, so expiry and reminders use that version. Expiry in this exercise: {{expiry_days}} days under the current version.
- **State as of D.** A share's state at T is a fold of its events with `occurred_at <= T`: outstanding = amount − Σ paid; status open | paid | partly paid | declined | expired | cancelled. A request is settled when every share is paid or declined (say how declines count; see follow-up 4). `share_state_daily (date, share_id, outstanding_minor, status)` for open shares only is an optimisation, rebuilt for days touched by late events.
- **Reminders.** Eligible today: shares open with outstanding > 0, `created_at + reminder_after_hours <= now`, no `reminded` event, not cancelled or expired; reminder event keyed by (share_id, reminder_no), so a retry cannot send twice; the job re-reads state at send time.
- **Analytics.** `fct_request (request_id, created_week, amount_band, participants, settled_at NULL, settled_within_days NULL, declined_shares, expired_shares)`; no participant identities.

**Competing designs to accept.** A single `request_events` stream with share ids inside; a state table updated transactionally alongside events, if history by date stays reproducible; shares with custom amounts validated by the same invariant.

**Bottlenecks and failure modes.** One status column per request; shares rounded independently; edits that overwrite the amount; a reminder job reading request-level status; expiry computed at query time with the current rule; full refolding of every request every night at {{requests_per_day}} requests a day; large splits ({{max_participants}} participants) written without a transaction, leaving shares that do not sum.

**Incident guidance.**
- *One cent short*: shares rounded independently. Recompute with the remainder rule, write a correcting version or an adjustment share event (never edit silently), and enforce the invariant at write time with a test on random totals and participant counts.
- *Reminders to people who paid*: eligibility must be per share, from share events. Fix the job's selection, add the reminder key, and measure the misfire rate from reminded events followed by earlier paid events.
- *Expired report changed*: expiry must use the rule version stored on the request. Backfill `rule_version` from creation dates and the rules history, restate the report, and add a check that past months do not change when a new rule version is added.

**Follow-up guidance.** (1) 10000 ÷ 3 = 3333 rem 1: shares 3334, 3333, 3333 by position; Σ = 10000. (2) Two paid events (1000 Monday, 2334 Thursday); Wednesday shows paid 1000, outstanding 2334. (3) The selection above with a NOT EXISTS on reminded events and the idempotency key on (share, reminder number). (4) Candidates should define it: for example, settled when no share is open, with declined shares reported separately, and the denominator as requests created that week. (5) Grain: one row per request (accumulating) plus share events; state as of D from snapshots of open shares and a tail of events.

**Rubric anchors.** 2: a request with one status and an amount; no partial payments or history. 3: shares and share events, the remainder invariant, state as of D. 4: also edit versions, per-request rule versions, idempotent reminders, conversion recorded once, privacy in analytics, and incident repairs.

**Strong signals.** Writes the remainder rule and invariant first; defines "settled" with declines explicitly. **Red flags.** Floats for money; reminders driven by request-level status; analytics that expose who owes whom.

## PYP-L3-03

**Reference architecture (one defensible design).**
- **Identifiers.** `identifiers (identifier_id, kind email|phone|username, normalised_value, created_at)`; emails normalised by lower-casing (this exercise's rule), phones to an international format, usernames lower-cased. The raw value lives only here, in the operational store with restricted access.
- **Holdings.** `identifier_holdings (holding_id, identifier_id, account_id, from_at, to_at NULL, verified_at NULL, end_reason released|lapsed|reassigned_reported|account_closed|removed)`. At most one verified, open holding per identifier: a partial unique index on (identifier_id) WHERE `to_at IS NULL AND verified_at IS NOT NULL`, or an exclusion constraint on a range; a concurrent second verification fails and retries against the new state. `verification_events (identifier_id, account_id, kind code_sent|confirmed|lapsed, at)`.
- **Usernames.** Holdings of username identifiers carry the release time; `available_from = released_at + {{quarantine_days}} days` is stored, and a claim before it is rejected.
- **Payments to identifiers.** `payments (payment_id, sender_account_id, amount_minor, currency, sent_at, recipient_identifier_id, recipient_as_entered_ref, resolved_holding_id NULL, credited_account_id NULL)`; resolution happens once at send time and is stored. `unclaimed_payments (payment_id, identifier_id, deadline_at, rule_version, state waiting|claimed|returned|cancelled, claimed_by_account_id NULL, closed_at NULL)` with `deadline_at = sent_at + {{claim_window_days}} × 24h` under the version in force at send time. Funds set aside by a movement at send time and released by exactly one closing movement.
- **Return job.** Selects `state = 'waiting' AND deadline_at <= now()` from an index on (state, deadline_at); each return is a conditional update `… SET state = 'returned' WHERE state = 'waiting'` in the same transaction as the money movement, so a retry or a race with a claim cannot apply twice.
- **Analytics.** Surrogate identifier ids or a keyed pseudonym (HMAC with a key held outside analytics); `fct_unclaimed (payment_id, sent_date, kind, state, claimed_within_window, hours_to_claim, new_account_claimed bool)`; joins use `credited_account_id` and the holding at the time, never the current holder.
- **Erasure.** Raw values erased from `identifiers` (or replaced with a tombstone), holdings and payments keep surrogate ids, amounts and times; payments still reconcile.

**Competing designs to accept.** A bitemporal holdings table; identifiers embedded in an account service with a separate history log, if "who held N on D" is answerable; a token service that maps identifiers to opaque ids.

**Bottlenecks and failure modes.** Email or phone columns on the user; resolution at read time; lapses never recorded (a stale open holding); deadlines recomputed from dates in UTC; a return job without a conditional update; plain unsalted hashes of phone numbers in analytics (easily reversed by enumerating numbers); reports joined to current holders.

**Incident guidance.**
- *Payment to a reassigned number reached the previous holder*: write the lapse as an event that closes the holding; resolution should require a verified open holding. Identify affected payments from holdings history, handle the money through the support process with an audit trail, and add a monitor for holdings whose verification is older than the rule allows.
- *Returns a day early*: use the stored `deadline_at` instant. Identify payments returned before their deadline, contact and remediate per the product's process, and add a test with deadlines near midnight in several time zones.
- *Report changed after username changes*: join via `credited_account_id`; restate the report and add a check that closed quarters do not change when holdings change.

**Follow-up guidance.** (1) `SELECT account_id, verified_at <= D FROM identifier_holdings WHERE identifier_id = … AND from_at <= D AND (to_at IS NULL OR to_at > D)`. (2) On the 10th no verified holder: the payment waits as unclaimed with a deadline; on the 20th the new holder verifies and, under this exercise's rule, can claim it within the window. Rows: old holding closed on the 1st (lapsed), unclaimed payment row, new holding from the 20th, claim event. (3) Index on (state, deadline_at); conditional update. (4) `credited_account_id` joined to account creation dates; the holding at send time. (5) Erase raw values; keep surrogate ids and amounts.

**Rubric anchors.** 2: identifiers as user columns; resolution at read time. 3: identifier entities, holdings over time with verification, resolution stored, unclaimed state machine with stored deadline. 4: also concurrency on verification, exactly-once returns, keyed pseudonyms, erasure, and incident repairs.

**Strong signals.** Asks how reassignment is learned and what if it is never reported; stores the deadline. **Red flags.** Raw identifiers or plain hashes in analytics; resolving the recipient again later; deleting holdings on account closure.

## PYP-L3-04

**Reference architecture (one defensible design).**
- **Purchases (buyer's view).** `purchases (purchase_id, buyer_account_id, merchant_ref, amount_minor, currency, purchased_at, payment_id)`, `purchase_items (purchase_id, line_no, description, qty, amount_minor)`, `shipment_refs (purchase_id, carrier_ref, tracking_ref, added_at)`.
- **Rules.** `programme_rule_versions (rule_version, effective_from, window_days, eligible_categories, evidence_required, seller_response_hours, reopen_days)`; a claim stores the version in force when it was opened (this exercise's rule), and eligibility at opening is computed against the purchase date and that version.
- **Claims.** `claims (claim_id, purchase_id, buyer_account_id, reason not_received|not_as_described, amount_claimed_minor, rule_version, opened_at)`, `claim_items (claim_id, line_no)`. `claim_events (event_id, claim_id, kind opened|message|seller_responded|escalated|info_requested|decided|refunded|closed|reopened, actor_role buyer|seller|reviewer|system, at, payload_ref)`; state and durations derived. Seller deadline `opened_at + {{seller_response_days}} × 24h`, stored on the opened event or computed from the stored rule version.
- **Messages and evidence.** `messages (message_id, claim_id, from_role, to_role, sent_at, body_ref)`; `evidence (evidence_id, claim_id, uploaded_by_role, type photo|tracking|document, object_key, content_hash, uploaded_at, delete_after)`, `evidence_visibility (evidence_id, role, granted_at, via_message_id)`; the seller gets a grant only when the buyer attaches the file to a message to the seller. Files are served by short-lived signed links after a visibility check. `delete_after = closed_at + {{evidence_retention_years}} years`; after deletion the row keeps type, hash and a `deleted_at`, so timelines show "evidence removed under retention".
- **Decisions and refunds.** `decisions (decision_id, claim_id, round 1|2, outcome buyer|seller|partial, refund_minor, reason_codes, rule_version, decided_at)`; reason codes describe the transaction (for example, tracking showed no delivery), never the person. `refunds (refund_id, purchase_id, decision_id, amount_minor, currency, issued_at)` with legs back to the funding sources in reverse order; constraint Σ refunds ≤ purchase amount enforced in the issuing transaction. Exponent from `currencies`; a 30% partial refund is computed in minor units with one stated rounding.
- **Analytics.** `fct_claim (claim_id, category, opened_month, escalated, first_decision_at, final_decision_at, hours_to_first_decision, outcome, reopened)` with the definition of which decision counts written down.

**Competing designs to accept.** Event sourcing with a state projection; a case-management schema shared with other claim kinds, if the buyer-side visibility and rule versions remain; decisions as events only.

**Bottlenecks and failure modes.** One overwritten status column; rule lookup at evaluation time with the current version; evidence blobs in the database; visibility enforced only in the UI; refunds in major units or with an assumed exponent; no cap on total refunds; deleting claims along with evidence; at {{claims_per_day}} claims a day, timelines assembled from many tables without an index on claim_id and time.

**Incident guidance.**
- *Open claims re-evaluated with the new window*: eligibility must use the version stored at opening. Restore the stored versions, recompute eligibility for affected claims, correct what buyers saw with a notice, and add a test that a new version does not change any open claim.
- *Refunds 100× too large in an exponent-0 currency*: compute in minor units with the exponent from reference data. Stop issuance, quantify affected refunds from the refund table, recover through the defined process with an audit trail, and add a per-currency test and a guard that a refund never exceeds the purchase amount (which would have caught it).
- *Escalation blocked*: the deadline counted from the seller's first read. Recompute deadlines from `opened_at`, allow escalation immediately where due, and measure time to decision from the opened event; add a test for the deadline rule.

**Follow-up guidance.** (1) Union of events, messages and evidence the buyer may see, ordered by time. (2) A stated rule: for example, first decision for "time to first decision" and final decision for outcomes, both reported. (3) The version in force when the claim is opened (this exercise's rule), with the window measured from the purchase date; a late claim is shown as outside the window with the rule version, not as a judgement. (4) Refund 30% of the purchase in minor units, rounded once; legs in reverse funding order; currency is the purchase currency. (5) Rows keep type, hash and dates; reports use facts, not files.

**Rubric anchors.** 2: one claims table with a status and a blob column. 3: events, messages, evidence with visibility, decisions with rule versions, refunds capped. 4: also retention with tombstones, deadline rules, refunds against funding legs, careful wording of decisions, and incident repairs.

**Strong signals.** Separates what the seller can see; fixes the rule version at opening. **Red flags.** Decisions that label buyers or sellers; evidence visible to all parties; refunds computed in floating point.

## PYP-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH originals AS (
  SELECT c.claim_id,
         p.item_category,
         (p.purchased_at AT TIME ZONE b.time_zone)::date AS purchase_day,
         (c.filed_at AT TIME ZONE b.time_zone)::date AS filed_day
  FROM claims c
  JOIN purchases p ON p.purchase_id = c.purchase_id
  JOIN buyers b ON b.buyer_id = p.buyer_id
  WHERE c.reopens_claim_id IS NULL
), judged AS (
  SELECT o.item_category,
         to_char(o.filed_day, 'YYYY-MM') AS claim_month,
         o.filed_day - o.purchase_day AS days_to_claim,
         rule.window_days,
         EXISTS (SELECT 1 FROM claims k WHERE k.reopens_claim_id = o.claim_id) AS reopened
  FROM originals o
  CROSS JOIN LATERAL (
    SELECT pr.window_days
    FROM programme_rules pr
    WHERE pr.effective_from <= o.purchase_day
    ORDER BY pr.effective_from DESC
    LIMIT 1
  ) AS rule
)
SELECT item_category,
       claim_month,
       COUNT(*) AS claims,
       COUNT(*) FILTER (WHERE days_to_claim > window_days) AS late_claims,
       COUNT(*) FILTER (WHERE reopened) AS reopened_claims,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_claim) AS median_days_to_claim
FROM judged
GROUP BY item_category, claim_month
ORDER BY item_category, claim_month;
```

**Explanation.** Only original claims (`reopens_claim_id IS NULL`) are counted, so every chain of reopenings counts once and is dated by its original filing, however deep the chain is; no recursion is needed because the original is the one row without a parent. Both timestamps are turned into the buyer's local calendar date with `AT TIME ZONE` and subtracted as dates, which gives whole calendar days rather than 24-hour periods. The window comes from the rule with the latest `effective_from` on or before the local purchase date (inclusive, so a purchase on the change date takes the new rule). Late is strictly greater than the window. `reopened_claims` asks whether any row reopens the claim itself, which keeps two separate claims on one purchase apart.

**Complexity.** One pass over claims and purchases with hash joins; the lateral rule lookup is a tiny sorted scan per claim (production: an index on `effective_from`, or validity ranges from `LEAD` joined by range); the EXISTS is an index lookup on `reopens_claim_id`. The median is a sort per group.

**Dialect notes.** Not executed here. Snowflake: `CONVERT_TIMEZONE(tz, ts)::date`, `DATEDIFF('day', a, b)`, `MEDIAN(x)` or `PERCENTILE_CONT(0.5) WITHIN GROUP`, `COUNT_IF`. BigQuery: `DATE(ts, tz)`, `DATE_DIFF(b, a, DAY)`, `PERCENTILE_CONT(x, 0.5) OVER (PARTITION BY …)` is analytic only (use `APPROX_QUANTILES` for an approximate median, or a window and DISTINCT), `COUNTIF`, and no LATERAL with LIMIT (use a join on validity ranges built with `LEAD`). Spark SQL: `to_date(from_utc_timestamp(ts, tz))`, `datediff`, `percentile(x, 0.5)` (exact) or `percentile_approx`. MySQL 8: `CONVERT_TZ` needs loaded time-zone tables, `DATEDIFF`, and no built-in median (window with `ROW_NUMBER` and `COUNT`). `FILTER (WHERE …)` is PostgreSQL; elsewhere `SUM(CASE WHEN … THEN 1 ELSE 0 END)`.

**Edge cases built into the data.** All levels: a claim filed exactly `window_days` after the purchase (on time) that is reopened after the window and sometimes in a later month; a purchase at about 22:00–23:30 and a claim at about 00:15–02:00 on the day after the window's last day (late by dates, on time by 24-hour periods); reopenings in general. Hard: a rule change during the purchases, a purchase before the change claimed after it with days between the two windows, a purchase on the change date, buyers in several fixed-offset time zones, a Tokyo purchase early in the local morning (the previous date in UTC) filed on the window's last local day, and a Bogota claim filed late in the evening on a month's last day (the next month in UTC). Very Hard: a version with an effective date after every filing (the newest rule must not be used), reopenings of reopenings, and one purchase with two separate original claims of which only the first is reopened.

**Common mistakes.** Counting every claim row; counting chains once but dated by the latest reopening; `EXTRACT(EPOCH …)/86400` or `filed_at - purchased_at` as an interval truncated to days; `>=` for lateness; dates in UTC (`::date` in a UTC session); the rule in force on the filing date; the newest rule; `effective_from < purchase_day`; mapping reopenings with `COALESCE(reopens_claim_id, claim_id)` (one level); marking reopened by purchase. Each has a diagnostic.

**Follow-up guidance.** (1) Add a nullable `item_category` to `programme_rules` (NULL = all categories) and prefer the category-specific row: `ORDER BY (pr.item_category IS NULL), pr.effective_from DESC`, or separate validity ranges per category. (2) A late reopening changes only `reopened_claims` for the original's month; a time-zone correction can move the purchase date and the claim's month. Materialise per claim (local dates, window, late flag, reopened flag) and aggregate; restate only months whose claims changed, tracked by recorded time. (3) Index `claims (reopens_claim_id)`, `claims (filed_at)` for monthly slices, `programme_rules (effective_from)`; storing local purchase and filing dates at write time (with the zone used) is reasonable and makes the report cheaper and stable. (4) A CASE on `days_to_claim - window_days` for late claims; the share's denominator is all claims in the group, stated explicitly.

**Rubric anchors.** 2: counts every row, or uses 24-hour periods or UTC dates. 3: matches the expected result. 4: also explains restatement, category-specific rules and indexing, and why counting originals is enough without recursion.

**Strong signals.** Asks which time zone defines a date and which rule version applies before writing SQL. **Red flags.** Taking the newest rule; counting reopenings; treating lateness as a judgement about the buyer.
