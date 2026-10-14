# Amazon · Loop 3 — evaluator notes (hidden from candidates)

## AMZ-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **OLTP entities.**
  - `orders (order_id, customer_id, marketplace, placed_at, currency)`: a header only, with no quantities and no status that summarises lines.
  - `order_lines (order_line_id, order_id, seller_id, sku, category_id, qty_ordered, unit_price_minor, promo_alloc_minor, tax_minor, fulfilment_channel network|seller, created_at)`. Every line has exactly one seller (first party is a seller id).
  - `line_cancellations (cancellation_id, order_line_id, qty, reason, cancelled_at)`.
  - `shipments (shipment_id, order_id, fulfilment_centre_or_seller, carrier, shipped_at)` and `shipment_lines (shipment_id, order_line_id, qty, kind original|replacement)`. A stable `shipment_line_id` comes from the source system or a deterministic hash of (shipment_id, order_line_id, kind) — never from the position in a list.
  - `returns (return_id, order_id, started_at, reason)`, `return_lines (return_id, order_line_id, shipment_line_id NULL, qty, received_at NULL, disposition)`.
  - `refunds (refund_id, order_line_id, return_id NULL, amount_minor, issued_at, reason)`.
  - **Invariants** (checked by the order service on every write and re-verified asynchronously): Σ cancelled + Σ shipped(original) + open = qty_ordered with open ≥ 0; Σ returned ≤ Σ shipped (original + replacement); Σ refunded ≤ line charge.
- **Change capture.** Either an outbox of domain events (`LineCancelled`, `LineShipped`, `ReturnStarted`, `ReturnReceived`, `RefundIssued`) written in the same transaction as the state change, or CDC on the movement tables. Because quantity changes are rows (insert-only), CDC never loses an intermediate state; CDC on a mutable counter column could.
- **Facts.**
  - `fct_order_line_movement` (append-only, one row per movement): line, movement type (ordered, cancelled, shipped, replacement_shipped, return_started, return_received, refunded), signed units, signed amount_minor, event time, seller, category, date keys. Net units = Σ signed units over a chosen set of movement types, so every team's definition is a filter on one table.
  - `fct_order_line_snapshot` (accumulating snapshot, one row per line): ordered/cancelled/shipped/returned/refunded quantities and amounts, first_shipped_at, last_return_at, is_closed. Rebuilt from movements for lines touched in the window (MERGE by partition of order date).
  - Dimensions: seller, product/category (type 2 for category re-mapping), date, fulfilment channel.
- **Definition (one acceptable wording).** Net units sold for a period = units shipped (original shipments only) in orders placed in the period − units returned and received against those lines; cancellations never count as sold; replacements are neither sales nor returns of new units. Report the provisional value until the period is older than the return window plus a lag, then close it.
- **Return rate.** Cohort by ship month: returned units of lines shipped in the month ÷ units shipped (original) in the month. Replacement returns are tracked separately (they are returns of a replacement, not a second sale).
- **Refunds before receipt.** `refunds` with `return_id` whose return line has no `received_at`: an "exposure" measure for finance, aged by days since refund.
- **Access.** Seller-facing marts filter by `seller_id` at the row level; first-party lines never reach seller views.

**Competing designs to accept.** An event-sourced order service where the event log is the source of truth and the OLTP tables are projections (if invariants are checked before events are accepted). Only an accumulating snapshot plus a raw event table. A single "line quantity ledger" table with a movement-type column instead of separate cancellation/shipment/return tables, if the referencing (which shipment a return came from) is kept.

**Bottlenecks and failure modes.** Order-grain modelling that cannot represent partial states; counters overwritten on the line (history lost, CDC races); replacement shipments miscounted; shipment-line identity unstable across updates; promotions allocated at order level and re-allocated after a cancellation (restates closed months); return rates by return date mixed with sales by order date; huge MERGE cost on the snapshot at {{daily_orders}} a day (partition by order date and only touch open lines).

**Incident guidance.**
- *Return rate above 100% for a category*: replacement shipments were not counted as shipments while their returns were. Contain by excluding replacement returns from the rate (or counting replacements in a separate denominator) and labelling the dashboard; fix the matching so a return links to the shipment line it came from; add a check that returned ≤ shipped per line and per seller-category, which would have paged.
- *Net sales no longer sum to finance after promo re-allocation*: the re-allocation edited allocated amounts on lines in a closed month. Do not edit history: write the re-allocation as adjustment movements dated when they happened; restate only through a published restatement with the delta per seller; add a reconciliation of Σ seller net sales to the finance total per month that runs before statements go out.
- *Shipment lines re-numbered upstream, split lines double-counted*: the key was positional. Derive a stable key (source id, or a hash of shipment id + order line id + kind), deduplicate the affected window by that key, rebuild the snapshot for lines touched, and add a contract test that a shipment line's key survives an update. The higher {{split_share}} is, the larger the blast radius: quantify it from the movement fact.

**Follow-up guidance.** (1) Check in the order service before commit plus an asynchronous checker; a breaking line is quarantined from seller statements and alerted, never silently clipped. (2) Original shipped 1, replacement shipped 1, returned 1 (the replacement): net sold 1, return rate for originals 0, replacement return tracked separately. (3) Re-allocation is an adjustment movement in the current period; the closed month is restated only by policy. (4) Close after {{return_window_days}} days plus processing lag; show "provisional" before. (5) Movements append-only (cheap), snapshot rebuilt for touched lines only; both is the strongest answer.

**Rubric anchors.** 2: an orders table with a status, or line counters overwritten, and a return rate with no cohort. 3: order-line grain, movements as rows, separate shipment/return/refund entities, a movement fact and a stated net-units definition. 4: also replacement handling, stable shipment-line identity, promotion re-allocation without editing closed months, refunds-before-receipt exposure, and a close for return rates.

**Strong signals.** States the line invariants before drawing tables; separates "sold" from "shipped" and "returned" from "refunded". **Red flags.** Order-level quantities; deleting a cancelled line; net sales computed from current line state for past months.

## AMZ-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Declared.**
  - `inbound_plans (plan_id, seller_id, created_at)` and `inbound_plan_versions (plan_id, version, sku, qty, edited_at)`; the version in force when the shipment is marked shipped is frozen as the declaration.
  - `inbound_shipments (shipment_id, plan_id, seller_id, destination_fc, carrier, marked_shipped_at, status)`: one per fulfilment centre after the split.
  - `boxes (box_id, shipment_id, label, declared_at)` and `box_contents (box_id, sku, qty, version)`; a contents correction after shipping is a new version with evidence, and the reconciliation uses the latest accepted version.
- **Observed.** `receiving_events (event_id UNIQUE, fc_id, box_id NULL, shipment_id NULL, sku, unit_qty, kind box_arrived|checked_in_sellable|checked_in_damaged|unexpected_unit, occurred_at, received_by_pipeline_at)`. Append-only; deduplicated by event id at ingestion. Box arrival at an unplanned fulfilment centre is recorded where it physically happened and matched by box label to its shipment.
- **Resolved.** `discrepancy_cases (case_id, shipment_id, sku, qty, opened_at, status opened|investigating|found|reimbursed|declaration_error, resolved_at)` and `reimbursements (reimbursement_id, case_id, qty, amount_minor, currency, paid_at)`; a later find of a reimbursed unit creates a reversal of the reimbursement (or an inventory adjustment), never a delete.
- **Invariant (per shipment × SKU).** declared = sellable + damaged + found + reimbursed + declaration_error + open. Open must reach 0 by the investigation window; a scheduled check lists violations.
- **Reconciled view and facts.** `fct_inbound_reconciliation` (one row per shipment × SKU, accumulating: declared, received sellable/damaged, found, reimbursed, error, open, first_arrival_at, sellable_at, closed_at); `fct_receiving_daily` (fulfilment centre × seller × day aggregates of check-ins); the unit-level events are kept in cheap storage for a limited period.
- **Definitions.** Received = checked in at the fulfilment centre; sellable = put away and available. Discrepancy rate = units in discrepancy cases ÷ declared units, by shipment cohort (shipped date), final once every shipment in the cohort is closed or older than {{receive_days}} days plus the investigation window.
- **Access.** Seller views filter by `seller_id`; carrier and fulfilment-centre breakdowns are internal.

**Competing designs to accept.** An event-sourced shipment aggregate with projections for the reconciled view. A single quantity ledger per shipment × SKU with typed movement rows (declared, received, found, reimbursed) instead of separate tables, if declared versions and box contents remain traceable. Matching unexpected units by a background job rather than at receiving.

**Bottlenecks and failure modes.** Counters on the shipment row (lost under concurrent scans, double-counted on redelivery); declarations editable after shipping; boxes modelled only under their planned fulfilment centre; reimbursements not reversed when units are found; rates computed on shipments still receiving; unit-level events kept forever at {{daily_inbound_units}} units a day.

**Incident guidance.**
- *Pallets delivered to the wrong fulfilment centre*: automated cases opened too early because "missing" was declared before the receiving window ended. Contain by pausing case creation for the affected shipments; match the boxes by label at the receiving fulfilment centre; transfer or re-point the shipments. Guardrail: cases open only after the receiving window ({{receive_days}} days) and a cross-centre label search.
- *Firmware redelivers a day of check-ins*: the pipeline lacked event-id deduplication. Dedupe by event id (or scanner + sequence), rebuild the reconciled rows for affected shipments, correct sellable inventory with adjustments, and add a check that received ≤ declared + unexpected per shipment × SKU.
- *Reimbursed units later found*: post a reimbursement reversal (or a seller-visible inventory adjustment) linked to the case; reconcile reimbursements against found units nightly; never delete the original reimbursement.

**Follow-up guidance.** (1) 100 = 96 sellable + 2 damaged + 1 found + 1 open (until resolved). (2) Reconcile against the version frozen at shipping; show earlier versions as history. (3) Box label is the join key; the box's physical location is an attribute of receiving events. (4) Cohort by shipped date; denominator declared units; final after the receiving window plus investigation. (5) Keep shipment × SKU and daily aggregates for years; unit events for months.

**Rubric anchors.** 2: one shipments table with received counters, no versioning, no discrepancy lifecycle. 3: declared / observed / resolved separation, versioned plans, append-only events, cases with resolutions and the invariant. 4: also wrong-centre matching by label, reimbursement reversal, receiving-window-aware rates and a retention plan for unit events.

**Strong signals.** States the invariant before tables; distinguishes received from sellable. **Red flags.** Overwriting counts; deleting a reimbursement; computing discrepancies the moment a box is late.

## AMZ-L3-03

**Reference architecture (one defensible design).**
- **Runs.** `forecast_runs (run_id, model_version_id, forecast_date, inputs_snapshot_id, purpose production|challenger|debug, status created|complete|issued|superseded, issued_at, issued_by)`. A unique constraint on (forecast_date) WHERE status = 'issued' enforces one issued run per date; issuing is a separate, audited action, never a flag set by the job that produced the run.
- **Values.** `forecast_values (run_id, series_id, target_week, horizon_weeks, quantile, value)`, long form, append-only; partitioned by forecast_date (or run) and clustered by series. Horizon and quantile are keys, so adding P98 or extending the horizon adds rows, not columns.
- **Overrides.** `forecast_overrides (override_id, series_id, target_week, quantile NULL, value, author, reason, created_at, run_id)`; the decision forecast = override if present else issued value, exposed by a view.
- **Actuals.** `actuals (series_id, week, units, version, published_at)` with corrections as new versions; `availability (series_id, week, in_stock_share)`.
- **Accuracy.** `accuracy_results (eval_id, run_id, actuals_version, censor_policy, metric, slice keys: horizon, category, region, model_version, value, n_series)`. Median: volume-weighted absolute percentage error (Σ|F − A| ÷ Σ A) and bias (Σ(F − A) ÷ Σ A); quantiles: pinball (quantile) loss and coverage (share of actuals ≤ the quantile). Censored weeks (in-stock share below a threshold) are excluded or reported separately, or evaluated against an estimated demand; the policy is stored with the result.
- **Storage.** {{series}} × {{horizon_weeks}} horizons × the quantile count, per week: hundreds of millions to tens of billions of rows a week at the top level. Keep full grain for the issued run for the decision-audit period (e.g. two years) in compressed columnar files; challengers at full grain for a few weeks, then only their accuracy results; debug runs expire quickly.

**Competing designs to accept.** One wide row per series and target week with quantile columns, if they show how schema changes are handled (a versioned schema per run). Storing forecasts as files per run with a catalog table, if issued runs are immutable and queryable. Evaluating against estimated (uncensored) demand from a separate model, if they mark it as an estimate.

**Bottlenecks and failure modes.** Overwriting forecasts (decision audit impossible); "issued" set by any job; MAPE exploding on zero-sales weeks; censored weeks rewarding under-forecasts; accuracy computed against moving actuals without recording the version; storing every challenger and debug run at full grain.

**Incident guidance.**
- *Debug re-run marked issued*: issuing was not a controlled action. Re-point the issued status to the original run (both runs still exist because values are immutable and keyed by run), notify planners whose purchase orders for the next {{horizon_weeks}} weeks read the wrong run, and re-evaluate those decisions. Guardrail: unique issued run per date, issuing only through an approval step, debug runs tagged and never eligible.
- *Accuracy improves during a stockout wave*: censored weeks were scored against capped sales. Recompute with censored weeks excluded or flagged ({{stockout_share}} of series-weeks here) and publish both numbers; add the in-stock share to every accuracy slice.
- *Returns backfill flips a model comparison*: the comparison did not pin the actuals version. Re-run against both versions, document the change, and revisit the promotion with the pinned, final actuals. Guardrail: accuracy results record actuals_version; comparisons for decisions use final actuals only.

**Follow-up guidance.** (1) series × horizons × quantiles per week; partition by forecast date, cluster by series; retention per run purpose. (2) Score both the model and the override separately; planners see the decision forecast, modellers see the model's accuracy. (3) Results with the old actuals version stay; new results labelled with the new version; reports say which. (4) Show the median error and coverage side by side by horizon; safety-stock decisions depend on the upper quantile. (5) Exclude or down-weight censored weeks, or compare against estimated demand, and state which.

**Rubric anchors.** 2: one forecast table overwritten each week, MAPE only, no notion of issued. 3: runs vs values, immutable issued runs, long-form values with horizon and quantile, versioned actuals, defined metrics. 4: also a censoring policy, reproducible evaluations with recorded actuals versions, overrides as records, and a storage and retention estimate.

**Strong signals.** Asks which forecast a decision used before designing storage; raises censoring unprompted. **Red flags.** Latest forecast wins; MAPE as the headline metric; deleting challenger results the moment a model is promoted.

## AMZ-L3-04

**Reference architecture (one defensible design).**
- **Periods.** `settlement_periods (period_id, seller_id, marketplace, currency, start_at, end_at (UTC instants derived from the marketplace's local boundary), status open|closed|disbursement_sent|paid|failed, opening_balance_minor, closing_balance_minor, reserve_opening_minor, reserve_closing_minor)`. Closed periods are immutable.
- **Lines.** `settlement_lines (line_id, period_id, seller_id, currency, type principal|shipping|tax|commission|fulfilment_fee|refund_principal|refund_commission|refund_admin_fee|reimbursement|promotion|storage|reserve_hold|reserve_release|adjustment, amount_minor signed, source_type order|refund|reimbursement|fee_run|manual, source_id, order_id NULL, event_at, posted_at)`. Posting happens at shipment for orders; a correction is a new line in the open period referencing the line it corrects.
- **Reserve.** A separate balance driven by `reserve_hold` and `reserve_release` lines with the rule version that produced them ({{reserve_rule}}); a rule change is a new rule version effective from a time, so the seller sees why the payout changed.
- **Disbursements.** `disbursements (disbursement_id, period_id, amount_minor, currency, sent_at, status sent|confirmed|failed, bank_reference, retry_of NULL)`. A period is paid only when the bank confirms; a failure posts a line returning the amount to the balance (or keeps the period in failed until retried).
- **Balance equation.** closing = opening + Σ lines − Δ reserve − disbursed, per seller, marketplace and currency; negative closing carries forward.
- **Reconciliation.** `order_settlement_status (order_id, shipped_at, posted_period_id, posted_amount_minor, paid_at, refund_status, break_reason)`. Daily checks: Σ principal posted for shipments of day D = Σ order value shipped on D (by marketplace and currency); every disbursement amount = the period's computed payout; every refund line has a sale line (allowing for timing within a tolerance window).
- **Times.** event_at (shipment or refund), posted_at, and period; the period boundary is defined once (UTC instants derived from the marketplace's local time) and printed on the statement.

**Competing designs to accept.** A full double-entry ledger per seller (accounts: available, reserve, payable to bank), as long as statements stay immutable and source keys are kept. Event-sourced settlement with statement projections. Daily (rather than period) balances with periods as views.

**Bottlenecks and failure modes.** Matching by amount and date instead of keys; statements edited after close; reserve hidden inside line types; "paid" set on send instead of on confirmation; boundary time zones; currencies summed; refunds posted before sales at boundaries producing false breaks; recomputing every seller's history for each statement at {{monthly_transactions}} a month.

**Incident guidance.**
- *Rejected disbursements marked paid*: status was set on send. Move the affected periods to failed, post lines returning the amounts to sellers' balances, notify sellers and retry with the corrected format. Guardrail: paid only on bank confirmation; reconcile disbursement outcomes daily against bank returns.
- *Fee applied twice*: never edit the closed statements. Post a reversing adjustment line referencing the duplicate in the current period, explain it on the next statement, and add an idempotency key per (seller, fee run, period) on fee postings.
- *Refunds before sales at the boundary*: timing, not loss. Reconcile by order id across periods with a tolerance window, mark "awaiting sale posting" instead of a break, and check that the boundary rule is applied the same way to both line types.

**Follow-up guidance.** (1) Equation with a worked period: prior-period sale's refund appears as negative lines now; failed disbursement adds the amount back. (2) Period boundary defined once and printed; the statement shows event time in local time and the period it posted to. (3) refund_principal, refund_commission (returned fee) and refund_admin_fee lines keyed by order_id and refund_id; net per order = Σ lines by order_id. (4) Join postings to shipments by order_id per day, marketplace and currency. (5) Reserve lines carry a rule version; the statement shows hold and release lines.

**Rubric anchors.** 2: a balance column updated in place, statements regenerated, matching by amount. 3: periods with typed signed lines, immutable closed statements, the balance equation, a reserve balance, source keys and a disbursement lifecycle. 4: also boundary time handling, reconciliation status per order with timing tolerance, idempotent fee postings and correct incident handling with compensating lines.

**Strong signals.** Separates event time from posting period; insists on keys over amount matching. **Red flags.** Editing closed statements; summing currencies; "paid" when the transfer is sent.

## AMZ-L3-05

**Reference solution** (PostgreSQL; `{{as_of}}` is the instance's as-of time)

```sql reference
WITH mv AS (                                   -- one row per event_id: the feed is at least once
  SELECT DISTINCT ON (event_id) event_id, fc_id, sku, kind, qty, reservation_id
  FROM inventory_movements
  WHERE occurred_at <= TIMESTAMPTZ '{{as_of}}'
  ORDER BY event_id, ingested_at
), stock AS (
  SELECT fc_id, sku, SUM(qty) AS on_hand
  FROM mv
  GROUP BY fc_id, sku
), shipped AS (
  SELECT reservation_id, -SUM(qty) AS units
  FROM mv
  WHERE kind = 'ship'
  GROUP BY reservation_id
), holds AS (
  SELECT r.fc_id, r.sku,
         SUM(CASE WHEN (r.cancelled_at IS NULL OR r.cancelled_at > TIMESTAMPTZ '{{as_of}}')
                   AND r.expires_at > TIMESTAMPTZ '{{as_of}}'
                  THEN GREATEST(r.qty - COALESCE(s.units, 0), 0)
                  ELSE 0 END) AS reserved
  FROM reservations r
  LEFT JOIN shipped s ON s.reservation_id = r.reservation_id
  WHERE r.reserved_at <= TIMESTAMPTZ '{{as_of}}'
  GROUP BY r.fc_id, r.sku
)
SELECT COALESCE(st.fc_id, h.fc_id) AS fc_id,
       COALESCE(st.sku, h.sku)     AS sku,
       COALESCE(st.on_hand, 0)     AS on_hand,
       COALESCE(h.reserved, 0)     AS reserved,
       GREATEST(COALESCE(st.on_hand, 0) - COALESCE(h.reserved, 0), 0) AS available_to_promise,
       GREATEST(COALESCE(h.reserved, 0) - COALESCE(st.on_hand, 0), 0) AS oversold_units
FROM stock st
FULL JOIN holds h ON h.fc_id = st.fc_id AND h.sku = st.sku
ORDER BY fc_id, sku;
```

**Explanation.** On hand and reserved live in different tables at different grains, so each is aggregated to (fc_id, sku) on its own and the two are combined with a FULL JOIN: a pair can have holds and no stock yet (the oversold rows) or stock and no holds. Shipping consumes a hold, so the units shipped per reservation (up to the as-of time) are subtracted from that reservation's qty before summing; otherwise a shipped unit is removed from on hand and still counted as reserved. Cancellation is inclusive (cancelled at or before the as-of time releases), expiry is exclusive (the hold lasts while as_of < expires_at). The deduplication by event_id costs nothing at Medium and Hard (event_id is unique there) and is required at Very Hard, where the feed redelivers events; occurred_at, not ingested_at, decides whether an event is in the books.

**Complexity.** One pass over movements up to the as-of time (a sort or hash for DISTINCT ON plus two hash aggregates) and one pass over reservations. In production, on hand per (fc, sku) comes from a materialised balance kept in step with the ledger, and only the tail since its watermark is read.

**Dialect notes.** `DISTINCT ON` is PostgreSQL; Snowflake, BigQuery and Spark SQL use `QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY ingested_at) = 1` (Spark without QUALIFY: a subquery on the row number); MySQL 8 uses the same row-number subquery. `GREATEST` exists in all of them, but in Snowflake and BigQuery it returns NULL if any argument is NULL, hence the COALESCE inside it. `FULL JOIN` is not supported in MySQL: union the keys of both sides and LEFT JOIN each. Timestamp literals: `'…'::TIMESTAMP_TZ` (Snowflake), `TIMESTAMP '…'` (BigQuery, UTC). None of these variants is executed here.

**Edge cases built into the data.** A receipt exactly at the as-of time (counts); a reservation made exactly at the as-of time (holds); a reservation cancelled exactly at the as-of time (releases); a reservation shipped after the as-of time (still holds at the as-of time, and its ship movement is not yet in on hand); a pair with holds and only a later receipt (on_hand 0, oversold); a pair with everything after the as-of time (no row). Hard adds a hold expiring exactly at the as-of time (lapsed), holds that expired earlier, signed cycle-count adjustments, and a reservation partly shipped before and partly after the as-of time. Very Hard adds redelivered events (same event_id, later ingested_at), including a redelivered ship, and a receipt that occurred before the as-of time but was ingested after it.

**Common mistakes.** Treating a boundary as exclusive; counting shipped units as still reserved; ignoring cancellations; starting from movements so hold-only pairs vanish; not flooring the outputs; (Hard+) ignoring expiry or treating `expires_at = as_of` as still held; (Very Hard) summing redelivered events twice, or filtering on ingested_at. Each has a diagnostic. Joining movements to reservations before aggregating multiplies rows and is a frequent cause of inflated totals.

**Follow-up guidance.** (1) A balance row per (fc, sku) updated in the same transaction as each ledger insert, or a snapshot at a watermark plus the tail; a nightly Σ ledger comparison proves it. (2) The storefront should use expiry-aware reads (lazy expiry) because the sweeper lags; this report uses the stated rule. (3) Running sum of holds per (fc, sku) ordered by reserved_at (window function), compared with on_hand: reservations whose running total exceeds on_hand are the unfillable ones. (4) At ingestion with a unique event_id is cheapest for every consumer; keeping the dedup in the query too is a cheap guard while the feed is at least once.

**Rubric anchors.** 2: right shape but shipped units counted as reserved, or hold-only pairs dropped. 3: matches the expected result. 4: also explains the sweeper gap, materialised balances with reconciliation, and the oversell allocation query.

**Strong signals.** Aggregates each side before joining without being told; asks what consumes a hold. **Red flags.** `SELECT DISTINCT *` as deduplication (rows differ in ingested_at); joining raw movements to raw reservations; filtering by ingested_at.
