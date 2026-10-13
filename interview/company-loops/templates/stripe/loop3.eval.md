# Stripe · Loop 3 — evaluator notes (hidden from candidates)

## STR-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **accounts** `(account_id, owner_type merchant|platform, owner_id, account_type available|pending|fees|cash|fx_clearing|reserve, normal_side, created_at)`. Currency is **not** an account attribute: an account holds a balance per currency, so balances are keyed `(account_id, currency)`. (Accept one account per currency too, if the candidate says why.)
- **journals** `(journal_id, idempotency_key UNIQUE per client, request_fingerprint, kind, reverses_journal_id NULL, effective_at, recorded_at, source)`. One business event; immutable once committed.
- **entries** `(entry_id, journal_id, account_id, currency, amount_minor BIGINT signed, seq)`. Append-only. Debits positive, credits negative (or a side column plus an unsigned amount; either works if consistent).
- **Write path**: the posting service validates the request (accounts exist, currencies allowed, Σ amount_minor = 0 **per currency**), then inserts journal and entries in **one transaction** together with the idempotency key. A retry with the same key and the same fingerprint returns the stored result; the same key with a different payload is rejected (the pattern public payment APIs document: the first result is saved and replayed). Keys are kept at least as long as clients retry; public docs describe pruning after about 24 hours, so a longer business-level dedup (e.g. payout id) protects money movements beyond that.
- **Invariants**: synchronously in the posting service (and, where the database allows, a deferred constraint trigger that sums per journal and currency at commit); asynchronously by a checker that recomputes Σ per journal per currency and Σ over all entries = 0 per currency, plus snapshot-vs-recompute comparisons. The synchronous check prevents; the asynchronous one detects bypasses (imports, manual SQL, bugs).
- **Corrections**: never UPDATE or DELETE. A reversal journal negates the original (linked by `reverses_journal_id`), then a corrected journal posts the right amounts. The auditor sees original, reversal and correction.
- **Balances**: `balance_snapshots (account_id, currency, as_of_entry_id or as_of_recorded_at, balance_minor)`. Read = snapshot + Σ entries after the snapshot's watermark. The watermark must be by **recorded** order (entry id or commit sequence), not effective time, so a backdated entry recorded after the snapshot is still in the tail; as-of-effective-time balances are a separate query.
- **Hot accounts**: split the platform fees account into N sub-accounts (sharded by hash of journal id) and sum them on read, or post platform legs asynchronously in batches. Never a single mutable balance row for the fees account.
- **Audit queries**: balance as of effective time T as known at K (bitemporal filter); all journals touching an account in a period; trial balance per currency = 0; reversal chains; journals by idempotency key / source.

**Competing designs to accept.** Event-sourced ledger where the event log is the source of truth, if the candidate puts the invariant check before an event is considered posted and keeps projections rebuildable. A mutable balance column updated in the same transaction as the entries, if they address hot-row contention and keep entries as the truth (balance is a cache). Per-currency accounts instead of per-currency balances.

**Bottlenecks and failure modes.** Hot platform accounts; long transactions across many legs; cross-shard journals (need a single-shard placement for the journal record with two-phase or saga posting, or a design where each journal's legs live on one shard and inter-shard movement goes through clearing accounts); idempotency key storage growth; snapshot drift when backdated entries land; floating point money; currencies with exponent 0 or 3.

**Incident guidance.**
- *Imported unbalanced journals (zero-decimal currency)*: stop the import path; quarantine the affected journal ids (exclude from available balance, flag accounts); do not edit — post reversals of the bad journals and correct journals through the posting service; recompute the affected snapshots from their watermark; root cause is likely an exponent assumption (dividing by 100 for a zero-decimal currency). Guardrail: all writes through the posting service; DB permissions forbid direct inserts; the async checker pages on any non-zero sum.
- *Duplicate payout via a new idempotency key*: a key per HTTP attempt is not a key per operation. Contain: freeze further payouts for the merchant, try to cancel/recall the second bank transfer; account for it with a receivable or a reversal journal once the outcome is known — never delete. Prevent: key derived from the business operation (payout id), unique constraint on `(merchant, payout_id)` in the ledger.
- *Snapshot + tail disagrees after backfill*: the snapshot watermark was by effective time, so backdated entries recorded later fell before the watermark and were never added. Fix the watermark to recorded order, rebuild the 40 accounts' snapshots, and keep the snapshot-vs-recompute check running daily.

**Follow-up guidance.** (1) Synchronous service check plus DB deferred constraint where feasible, plus async checker; each catches a different failure. (2) Sharded sub-accounts or batched platform legs. (3) Store both effective_at and recorded_at; "as reported then" filters recorded_at ≤ report time. (4) Keep each journal on one shard where possible; otherwise saga with a clearing account and a pending state, invariant per shard via clearing legs. (5) Daily counts and per-currency sums by journal-id range in both stores, plus a hash of entry ids per partition.

**Rubric anchors.** 2: a balances table updated in place, or entries without journals; no per-currency invariant. 3: journal/entries with signed integer minor units, immutability with reversals, idempotent posting, snapshot + tail. 4: also hot-account mitigation, a correct snapshot watermark under backdating, bitemporal audit queries, and crisp incident handling.

**Strong signals.** States the invariant per currency before drawing tables; distinguishes recorded time from effective time unprompted. **Red flags.** Floats for money; "just fix the row"; idempotency key generated per retry.

## STR-L3-02

**Reference architecture (one defensible design).**
- **OLTP**: `payment_intents (id, merchant_id, amount_minor, currency, status, created_at, updated_at, version)` and `payment_intent_transitions (intent_id, seq, from_status, to_status, at, cause, attempt_id)` written in the same transaction as the status change. Allowed transitions are a table or code map: requires_payment_method → requires_confirmation/requires_action/processing/canceled; requires_action → processing/requires_payment_method/canceled; processing → succeeded or requires_payment_method (a failed attempt); with manual capture an intent waits in requires_capture before succeeded or canceled; terminal: succeeded, canceled. An optimistic `version` prevents lost updates.
- **Event model**: each event carries `event_id`, `object_id`, `type`/new status, `created` (second precision), and a snapshot of the object. Consumers dedup by `event_id` (store processed ids with TTL ≥ the redelivery window), and apply out-of-order events safely by either (a) a state rank where terminal states dominate and a transition is applied only if legal from the stored state, or (b) storing every event and rebuilding current state per intent from the event set (terminal wins; within a second, order by rank). A good answer also mentions fetching the current object from the API when in doubt, since the event's embedded snapshot may be stale.
- **Facts**:
  - `fct_payment_intent_transition` (transaction fact, one row per transition / attempt, append-only, keyed by event_id): time in requires_action (interval between paired transitions), decline analysis per attempt.
  - `fct_payment_intent_lifecycle` (accumulating snapshot, one row per intent): created_at, first_requires_action_at, first_processing_at, succeeded_at, canceled_at, attempts, final_status, is_terminal. Updated with **monotone merges** (MIN for "first" milestones, terminal timestamps set once), so a late or duplicate event cannot move a milestone backwards.
  - Current state for "stuck in processing" from the snapshot (`final_status = 'processing' and first_processing_at < now() - threshold`), or from a current-state table maintained by the consumer.
- **Close**: conversion by creation day is provisional until day + N days (N from the observed distribution of time-to-terminal); after close, late changes are restatements, logged. The page shows "provisional" until close.

**Competing designs to accept.** Only a transaction fact with a derived current-state view (if they show how "currently in processing" stays cheap: a periodic snapshot or a current-state table). Only an accumulating snapshot plus a raw event table for intervals. CDC from the OLTP transitions table instead of webhooks, if they note it is not available to a merchant (webhooks are the merchant's interface) and keep the same idempotency.

**Bottlenecks and failure modes.** "Latest timestamp wins" overwriting a terminal state with a stale event; second-precision ties; duplicate deliveries double-counting requires_action; updating a wide snapshot table in a columnar warehouse (use MERGE on partitions by created date, or rebuild recent partitions); conversion numbers that never settle.

**Incident guidance.**
- *Backlog after a consumer outage*: the stuck-in-processing alert must read processing state that is fresh; during backlog drain, suppress or annotate the alert by consumer lag (alert on lag itself). Rebuild current state from the event set (or refetch objects) once drained; dedup by event id.
- *Double confirmations inflating requires_action*: count distinct `(intent, attempt)` rather than events; dedup on event id; check whether the second confirm produced a real second transition (legal) or a duplicate event. Report requires_action rate per attempt, not per event.
- *Conversion changes overnight*: expected for provisional days; the fix is a defined close and a provisional label, plus a restatement log for changes after close.

**Follow-up guidance.** (1) Dedup → legality check or rank-based rebuild; the snapshot's MIN/once-only merges keep milestones right; the transition fact simply appends (an analyst orders by rank, not arrival). (2) Close at the p99 time-to-terminal; show provisional before. (3) event_id dedup in the consumer and a unique key in the fact. (4) Transition map is data; snapshot gets a nullable new milestone column; history is untouched. (5) Partition the snapshot by created date; MERGE only open-intent partitions; consider keeping open intents in a small hot table.

**Rubric anchors.** 2: one status column overwritten by the latest event. 3: transition fact + snapshot (or current state) with idempotent, order-tolerant application and creation-day attribution. 4: also a defined close, monotone merges, correct handling of ties and stale snapshots, and costed warehouse updates.

**Strong signals.** Says terminal states dominate before talking about timestamps; separates intervals from current state. **Red flags.** Trusting arrival order; counting events instead of attempts; conversion by event date.

## STR-L3-03

**Reference architecture (one defensible design).**
- **disputes** `(dispute_id, charge_id, merchant_id, network, reason_code, reason (mapped), stage inquiry|chargeback, status, amount_minor, currency, opened_at, evidence_due_by TIMESTAMPTZ, deadline_tz, closed_at, outcome won|lost|withdrawn|NULL)` — current state.
- **dispute_transitions** `(dispute_id, seq, from_status, to_status, effective_at, recorded_at, source_message_id)` — event-sourced history; a type-2 projection `(dispute_id, status, valid_from, valid_to)` is derived from it, never edited by hand.
- **Money**: ledger journals that reference the dispute: disputed amount withdrawn from the merchant, the dispute fee, the return on a win (and fee return when the rule says so). Refunds on the charge are their own journals linked by `charge_id`; total cost per charge = Σ journals by charge.
- **Inquiry** is a stage: an inquiry can close without escalating or escalate into a chargeback (same dispute id, stage changes, or a linked chargeback record). Inquiries have their own escalation-rate metric.
- **Deadlines**: stored as an absolute instant computed from the network's rule in its time zone, with the zone kept for display; the alert job scans `evidence_due_by between now() and now() + 48h and status = needs_response`.
- **Win rate**: cohort = chargebacks **opened** in month M; numerator won, denominator won + lost (closed), reported with the count still open; the month is provisional until ≥ 95% closed; restatements after publication are logged with reason. Accept a closed-month definition if consistent and stated.
- **Serving**: `fct_dispute` (accumulating snapshot: opened, evidence_submitted_at, decided_at, outcome, amounts, fee) plus the transition fact for durations; reason mapping as versioned data `(network, code, reason, valid_from)`.

**Competing designs to accept.** Pure type-2 dimension with late-arriving correction handling (closing and splitting intervals), if they explain how corrections with earlier effective times are absorbed. Pure event store with materialised projections. Separate inquiry and chargeback entities linked by id.

**Bottlenecks and failure modes.** Overwritten status losing durations; time-zone errors on deadlines; double fees on escalation; win-rate denominators including open disputes; decision reversals; refunds after a dispute causing double loss; reason-code drift across networks.

**Incident guidance.**
- *Deadline computed in UTC*: identify the network and the affected disputes by deadline_tz; reopen the auto-expired ones if still within the true deadline and notify merchants; store the zone with the deadline and add a test per network rule.
- *Batch of decision corrections after the report*: append transitions with the true effective time; the ledger posts compensating journals (no edits); the published win rate is restated with a log entry and the delta, or the month is shown as revised.
- *Fee debited at inquiry and again at escalation*: under either fee rule in this scenario an inquiry carries no fee, so the inquiry fee was wrong. Post reversals for the inquiry fee journals, make the fee posting idempotent per (dispute, stage = chargeback), and add a reconciliation check: fees per dispute ≤ 1.

**Follow-up guidance.** (1) Opened-month cohort, closed-only denominator, open count shown, provisional flag. (2) Transition appended with effective time; ledger compensating journal; restatement. (3) Σ ledger journals by charge_id with labels. (4) Absolute instant + source zone; alert from the instant. (5) Versioned mapping table; unknown codes map to "unmapped" and alert.

**Rubric anchors.** 2: one disputes table with an overwritten status and a win rate over all disputes. 3: entity + history + ledger links, defined cohort and denominator. 4: also late corrections across history, ledger and published metrics; deadlines with time zones; double-loss visibility.

**Strong signals.** Asks what the denominator is before modelling; separates inquiry from chargeback. **Red flags.** Win rate including open disputes without saying so; deleting fee rows to fix double fees.

## STR-L3-04

**Reference architecture (one defensible design).**
- **currencies** `(code, exponent, valid_from, valid_to)`: exponent 0 for zero-decimal (JPY), 2 for most, 3 for three-decimal (KWD, BHD). Effective-dated so a redenomination does not rewrite history.
- **Amounts**: `amount_minor BIGINT, currency` everywhere money is stored. Decimal display = amount_minor / 10^exponent at the presentation layer only.
- **Transactions** carry presentment amount/currency, settlement amount/currency, the **applied rate** (exact decimal or rational), and the conversion fee separately. These are facts and never change.
- **fx_rates** `(base, quote, valid_from, published_at, rate NUMERIC(…), source)`: a correction is a new row with the same valid_from and a later published_at. "Rate in force at t as published by cut-off c" = the row with max valid_from ≤ t, and among those max published_at ≤ c. Index `(base, quote, valid_from DESC, published_at DESC)`; or materialise a daily rate-per-day table per report run.
- **Reporting rate** is a named policy per report: transaction-date rate, applied rate, or month-average; stored on the report run with the rate cut-off.
- **Rounding**: convert line by line at full precision, round each line to the reporting currency's minor unit with a stated rule (half-even or half-up, consistently), sum lines; publish the tolerance versus converting the total (≤ n lines × 0.5 minor units).
- **Constant currency**: this period's volume at last period's rates vs at this period's rates; the difference is the FX effect.
- **Restatement**: report runs are versioned `(report, period, run_id, rate_cutoff, exponent_version)`; a restatement is a new run with a reason; the old run stays readable.

**Competing designs to accept.** Rates stored as integer numerator/denominator. Converting at ingestion into a reporting-currency column, if the policy and cut-off are recorded per row and restatement is planned. Per-day rate snapshot tables instead of a bitemporal rate table.

**Bottlenecks and failure modes.** Floating point; exponents assumed to be 2; "latest rate" making old reports change; rounding at different steps in different reports; currencies added mid-period missing rates; rate join explosions without a proper as-of join.

**Incident guidance.**
- *Wrong rate in one publication*: find the affected transactions by the rate's valid_from window and currency; ingest the correction as a new published_at row; re-run the draft at a new cut-off and tell leadership what changed and why. Applied rates on transactions (what customers paid) are not changed by a reporting-rate correction. Guardrail: day-over-day rate-change bounds per pair with a quarantine.
- *Three-decimal currency loaded with exponent 2*: the 10× error is in display/conversion, not in stored minor units, if amounts were kept as integers; fix the currencies row (effective-dated) and restate every report run that used it, listing them from the run metadata. If amounts were stored as decimals, every row must be rewritten: that is the argument for minor units.
- *Total vs sum of lines beyond tolerance*: the new currency had no rate for part of the month, so lines dropped out or used a default; detect missing rates as an explicit failure, never a silent zero or 1.0.

**Follow-up guidance.** (1) As-of join (LATERAL with ORDER BY valid_from DESC, published_at DESC LIMIT 1) and the composite index. (2) Run metadata tells which runs used the bad exponent; restate those. (3) Constant-currency decomposition. (4) The line-rounded sum is the reconciled figure; print the tolerance. (5) Reports with a cut-off before the correction stay as published; new runs use it; the reader sees run id and cut-off.

**Rubric anchors.** 2: decimal amounts and a single "rates" table keyed by date. 3: integer minor units with exponents, effective-dated rates, applied vs reporting rate, a rounding rule. 4: also bitemporal rates with cut-offs, constant-currency analysis, versioned report runs and clean restatement.

**Strong signals.** Mentions zero- and three-decimal currencies unprompted; separates the rate a customer paid from the rate a report uses. **Red flags.** Floats; "use today's rate"; editing past reports in place.

## STR-L3-05

**Reference solution** (PostgreSQL; `{{as_of}}` and `{{known_at}}` are the instance's times — at Medium and Hard, `known_at` equals `as_of` and nothing is backdated, so the same query applies)

```sql reference
WITH eligible AS (
  SELECT journal_id
  FROM journals
  WHERE effective_at <= TIMESTAMPTZ '{{as_of}}'
    AND created_at   <= TIMESTAMPTZ '{{known_at}}'
), journal_currency AS (
  SELECT e.journal_id, e.currency, SUM(e.amount_minor) <> 0 AS unbalanced
  FROM entries e
  JOIN eligible j ON j.journal_id = e.journal_id
  GROUP BY e.journal_id, e.currency
)
SELECT e.account_id,
       e.currency,
       COALESCE(SUM(e.amount_minor) FILTER (WHERE NOT jc.unbalanced), 0) AS balance_minor,
       COUNT(DISTINCT e.journal_id) FILTER (WHERE jc.unbalanced)          AS unbalanced_journals
FROM entries e
JOIN journal_currency jc
  ON jc.journal_id = e.journal_id AND jc.currency = e.currency
GROUP BY e.account_id, e.currency
ORDER BY e.account_id, e.currency;
```

**Explanation.** Eligibility is a property of the journal (every entry shares its timestamps), so decide it once. The balance check groups by **journal and currency**: an FX conversion balances in each currency but not in sum, and a misbooking can sum to zero across currencies while each currency is off. Joining the verdict back to the entries lets one aggregation produce both columns: the balance from entries of balanced journal-currencies, and the count of distinct unbalanced journals. Reversals need no special case: each reversal is a journal that counts when it is eligible. At Very Hard the as-of is bitemporal: effective time decides where a journal belongs, created_at decides whether it was known by `known_at`.

**Complexity.** One pass to group entries by (journal, currency) and one to group by (account, currency): two hash aggregates over the eligible entries. In production a balance query should start from a snapshot and only read the tail.

**Dialect notes.** `FILTER (WHERE …)` is PostgreSQL (and SQLite); Snowflake, BigQuery, Spark SQL and MySQL use `SUM(CASE WHEN … THEN amount_minor END)` and `COUNT(DISTINCT CASE WHEN … THEN journal_id END)`; Snowflake also has `COUNT_IF` (not distinct). Timestamp literals: `'…'::TIMESTAMP_TZ` (Snowflake), `TIMESTAMP '…'` (BigQuery, UTC). None of these variants is executed here.

**Edge cases built into the data.** A journal exactly at the as-of time; journals after it; an off-by-one rounding journal and (Medium) a charge missing its fee leg, which leaves one merchant with balance 0 and one unbalanced journal; (Hard+) FX conversions that balance per currency only, a cross-currency misbooking that sums to zero overall, a merchant whose charge was reversed before the as-of time (rows at 0), and a reversal posted after the as-of time; (Very Hard) backdated journals, a journal created after the as-of time but effective before it (included), one created exactly at `known_at` (included), one created after `known_at` (excluded), and one effective exactly at the as-of time.

**Common mistakes.** Adding unbalanced entries to the balance; `<` instead of `<=`; `HAVING SUM(...) <> 0` dropping zero rows; checking balance per journal across currencies; dropping reversed originals and their reversals regardless of time; ignoring reversal journals; filtering by created_at instead of effective_at; ignoring known_at. Each has a diagnostic.

**Follow-up guidance.** (1) Snapshot per (account, currency) at a watermark in recorded order; backdated journals recorded after the snapshot stay in the tail; as-of-effective queries need either a bitemporal snapshot or a recompute window. (2) In the posting service before commit (and a deferred constraint where possible); reject with a typed error naming the currency that does not balance. (3) Index entries by (account_id, currency) with journal timestamps denormalised onto entries, or monthly bitemporal snapshots. (4) Show the quarantine list, the balance API's computation for those dates, and that no payout was authorised against the quarantined amounts.

**Rubric anchors.** 2: right shape but adds unbalanced entries or checks across currencies. 3: matches the expected result. 4: also explains bitemporal as-of semantics and how snapshots stay exact under backdating.

**Strong signals.** Groups by journal and currency without prompting; asks whether a reversal makes the original vanish. **Red flags.** `NOT IN (SELECT reverses_journal_id …)`; summing amounts across currencies.
