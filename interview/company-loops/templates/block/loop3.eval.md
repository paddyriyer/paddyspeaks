# Block · Loop 3 — evaluator notes

Simulated practice. These notes describe one defensible answer, not the only one.
Nothing here describes how the company's own systems are built; every number is
hypothetical and every product rule is this exercise's rule.

## BLK-L3-01

**Reference architecture (one defensible design).**
- **Entities.** `businesses (business_id, currency, created_at)`; `locations (location_id, business_id, opened_at)`; `devices (device_id, business_id, device_type reader|register|handheld, registered_at)`; `team_members (team_member_id, business_id, joined_at)`; `roles (role_id, business_id, name, is_custom)`; `permission_sets (permission_set_id, business_id)`.
- **Effective-dated relationships**, each with `valid_from` (inclusive) and `valid_to` (exclusive, NULL while current) and a constraint that intervals for the same key never overlap:
  `location_versions (location_id, name, address, time_zone, status open|closed, region_id, valid_from, valid_to)`;
  `device_pairings (device_id, location_id, valid_from, valid_to, changed_by)`;
  `team_assignments (team_member_id, location_id, valid_from, valid_to)`;
  `role_grants (team_member_id, role_id, valid_from, valid_to)`;
  `permission_set_versions (permission_set_id, version, permissions[] or one row per permission, valid_from, valid_to, edited_by)` and `role_permission_sets (role_id, permission_set_id, valid_from, valid_to)`.
- **Payments and orders** carry `location_id`, the location's `time_zone` and `business_date` stamped by the server at write time from the pairing in force (the device's own claim is recorded too, for checks). They are never re-derived from the current pairing.
- **Facts.** `fct_location_daily_sales (business_id, location_id, business_date, gross_cents, refunds_cents, net_cents, tips_cents, payments)`; dimensions `dim_location` as SCD2 from `location_versions` so a report can choose "attributes as of the sale" or "current attributes" (for example, regions now versus then).
- **Who could refund at L on D** = team members with an assignment to L overlapping D (in L's local date), a role grant overlapping D, whose role's permission set version in force on D includes `issue_refunds`; owners always included. Return the interval detail so an audit can see why.
- **Personal data.** The warehouse holds team_member_id, role and assignments; names only in a restricted support view joined at read time; contact details never leave the operational system.

**Competing designs to accept.** Event-sourced changes (paired, unpaired, granted, revoked) with snapshot tables derived per day; a daily snapshot of every relationship instead of intervals (simpler joins, more storage, coarse granularity — acceptable if the candidate notes intra-day moves are lost); a graph store for the permission walk, as long as history is versioned.

**Bottlenecks and failure modes.** Location kept on the device row; sales re-attributed by joining to current pairings; UTC dates for business dates; overlapping intervals from concurrent edits; permissions stored only as current definitions; closed locations deleted; region hierarchy edited in place so last year's regional reports change silently; scanning every pairing interval for every payment at {{sellers}} sellers instead of stamping at write.

**Incident guidance.**
- *Bulk re-pairing to the flagship*: revert the pairings (new interval rows, never edits that hide the mistake), then correct the hour's payments by restating their location from the device's own claimed location and the pre-change pairing, with a restatement record; rebuild the affected daily facts. Guardrail: bulk tools require a dry-run diff and confirmation; an alert on sudden share shifts between a seller's locations.
- *Permission set held only as current*: reconstruct past versions from the operational audit log of edits if one exists; otherwise say plainly which dates cannot be answered. Fix: version permission sets going forward and backfill from the edit log; audits state the earliest reconstructable date.
- *Locations defaulted to UTC*: require time zone at creation (derived from address, confirmed by the seller). Restate business dates for the affected locations' payments from their instants and the correct zone; notify sellers whose daily totals change. Guardrail: a check that no location lacks a zone and that till close times fall near local midnight.

**Follow-up guidance.** (1) Two pairing rows: café [.., Tue 14:00), kiosk [Tue 14:00, NULL); Monday's sales stay at the café because they were stamped then; Tuesday splits at 14:00. (2) Join assignments, grants and permission-set versions on interval overlap with D in the location's zone. (3) Region membership is itself effective-dated; offer "as then" and "as now" views. (4) A judgement call: same `location_id` with a new version (new address and zone) if the seller says it is the same business; business dates follow the zone in force at each sale. (5) Intervals are small per entity; partition by business, index (key, valid_from); serve as-of lookups from a per-business cache or a daily snapshot plus the day's changes.

**Rubric anchors.** 2: current-state tables with a location column on devices; sales by UTC date. 3: effective-dated relationships, location stamped on payments, local business dates, versioned permissions and the refund-audit query. 4: also non-overlap enforcement and boundary conventions, as-then versus as-now dimensions, data minimisation for team members and incident handling with restatements and guardrails.

**Strong signals.** Says the payment's location is a fact of the event, not a join. Asks whether intervals are half-open. **Red flags.** Re-deriving history from current state; deleting team members or closed locations; storing contact details in the warehouse.

## BLK-L3-02

**Reference architecture (one defensible design).**
- `purchases (purchase_id, merchant_id, shopper_id, order_cents, currency, purchased_at, shopper_tz)`; `plans (plan_id, purchase_id, schedule_rule_version, late_fee_rule_version, status active|paid|refunded|closed)`.
- `schedule_versions (plan_id, version, reason original|reschedule|refund|early_payment, created_at, created_by)`; `instalments (plan_id, version, seq, due_date (shopper's local date), amount_cents)`. The current schedule is the latest version; any past schedule is readable. Leftover cents go on seq 1 (this exercise's rule).
- `payment_attempts (attempt_id, plan_id, amount_cents, attempted_at, outcome succeeded|failed, failure_reason, retry_of)`; `payment_allocations (attempt_id, plan_id, seq, amount_cents)` — a succeeded payment is allocated to the earliest unpaid instalments (or to the one the shopper chose).
- `fees (fee_id, plan_id, seq, amount_cents, charged_at, rule_version, due_date_at_charge)`; `fee_waivers (fee_id, waived_at, reason, by)`; fee payments allocated like instalments. The cap check reads Σ fees on the purchase.
- `refunds (refund_id, purchase_id, amount_cents, refunded_at)`; `refund_allocations (refund_id, plan_id, seq NULL, kind reduce_instalment|return_to_shopper, amount_cents)` — reduce the unpaid instalments from the last one backwards; any excess is returned to the shopper's payment method. A refund that reduces instalments writes a new schedule version.
- **Invariants** (checked per plan after every event and nightly): Σ instalments (current version) = order − Σ refund allocations of kind reduce_instalment; Σ payment allocations to seq ≤ instalment amount; Σ refund allocations = refund amount; Σ fees − waivers ≤ cap.
- **Facts.** `fct_instalment_outcome (plan_id, seq, purchase_month, original_due_date, due_date_in_force, paid_at, paid_on_time, days_late)`; `fct_receivable_daily (date, merchant_id, outstanding_cents)` computed from instalments in force on the date minus allocations made by that date; `fct_fees_monthly (month, charged, waived, net)`.
- **No person-level judgements.** The model records events; it has no credit or eligibility score, and aggregates are reported by cohort, merchant and instalment number.

**Competing designs to accept.** Event-sourced plans (PlanCreated, PaymentSucceeded, Rescheduled, Refunded) with projections for the current schedule and for history; a double-sided receivable per plan maintained as balances, if the candidate keeps the event history and the invariants. Storing the due-date history on each instalment row (original and current) is acceptable for "on time" reporting if the full version history also exists for support.

**Bottlenecks and failure modes.** Updating instalment rows in place; splitting cents with independent rounding; refunds applied to the next instalment; refunds dropped when nothing is unpaid; fee caps checked per instalment instead of per purchase; UTC due dates; status flags as the source of truth; at {{monthly_plans}} plans a month, recomputing every plan's state from all events for each report.

**Incident guidance.**
- *Due dates overwritten*: freeze rescheduling writes or add versioning immediately; reconstruct original due dates from the scheduling event log or from the charge attempts' timestamps where possible; review fees charged on rescheduled instalments under {{late_fee_rule}} and refund any that cannot be shown to be correct. Guardrail: schedules are append-only versions; a fee records the due date it was charged against.
- *Refunds applied to the next instalment*: re-allocate from the last instalment for the affected plans as new schedule versions and refund allocations; recharge nothing that was already skipped without telling shoppers; restate on-time rates and mark the affected period. Guardrail: a unit test and a nightly invariant that refund allocations hit the latest unpaid instalments first.
- *Refunds on fully paid plans dropped*: find refunds whose allocations sum to less than the refund amount; create return_to_shopper allocations and pay them out. Guardrail: the invariant Σ refund allocations = refund amount, alerting on any gap.

**Follow-up guidance.** (1) 10001 → 2501, 2500, 2500, 2500; two failed attempts and one success with days_late 4 (and a fee only if past the grace period of this exercise's rule); the 3000 refund makes seq 4 = 0 and seq 3 = 2000 in a new version. (2) Report both: on time against the due date in force and against the original; the cohort report states which. (3) All allocations are return_to_shopper; the plan stays paid with a refund record. (4) The refund's own date for activity reporting; a restated month-end balance only if finance restates, labelled with the version. (5) Partition by purchase month; a per-plan current projection plus versioned history for support queries.

**Rubric anchors.** 2: one row per instalment updated in place, status flags, no allocation records. 3: versioned schedules, attempts and allocations, fees and waivers as records, refund allocation from the last instalment with excess returned, invariants. 4: also exact cents, local due dates, receivables on a date from versions, careful on-time definitions under rescheduling, no person-level judgements, and incident remediation with restatement.

**Strong signals.** Writes the invariants as sums before drawing tables. Separates "attempt" from "allocation". **Red flags.** A credit or risk score per shopper in the analytics model; deleting a waived fee; recomputing history from current status.

## BLK-L3-03

**Reference architecture (one defensible design).**
- `orders (order_id, seller_id, location_id, business_date, opened_at, closed_at, currency, total_cents, state)`; `order_lines (order_id, line_no, item_variation_id, item_name_at_sale, unit_price_cents, quantity, gross_cents)`; `line_modifiers (order_id, line_no, modifier_id, name_at_sale, price_cents, quantity)`.
- `discounts (order_id, discount_id, scope line|order, type percent|fixed, value)` and `discount_applications (order_id, discount_id, line_no, amount_cents)` — order-level discounts allocated pro rata by line amount with largest remainder, so Σ applications = discount exactly; stored, never recomputed.
- `line_taxes (order_id, line_no, tax_id, rate_bp, inclusive bool, taxable_cents, tax_cents)` — per {{tax_rule}}: added tax on the discounted amount, or extracted from an inclusive price; per-tax totals for the order allocated exactly.
- `service_charges (order_id, charge_id, amount_cents, taxable)`.
- `tenders (tender_id, order_id, type card|cash|gift_card|other, amount_cents, tip_cents, card_brand, entry_method, last4, created_at)` and `tip_adjustments (tender_id, old_tip_cents, new_tip_cents, adjusted_at)` for {{tip_rule}} — an adjustment updates the tip on the same tender (by id), never a new tender.
- `refunds (refund_id, order_id, created_at, reason)`, `refund_lines (refund_id, line_no NULL, quantity, amount_cents, tax_cents)` and `refund_tenders (refund_id, tender_id, amount_cents)` with Σ refund_tenders = refund total and per-tender cumulative refunds ≤ tender amount.
- **Invariants.** Σ line totals (gross + modifiers − discount applications + added tax) + service charges = order total; Σ tender amounts = order total; tips separate; per line, refunded quantity ≤ sold quantity.
- **Facts.** `fct_order_line` (grain order line: gross, discount, tax, net), `fct_tender` (grain tender: amount, tip, type), `fct_refund_line`. Net sales = gross + modifiers − discounts − refunds (excluding tax and tips), stated once.

**Competing designs to accept.** A single "money movements" fact with typed rows (sale, discount, tax, tip, refund) per line and tender; JSON order documents in the lake with the relational facts derived from them, if allocations are materialised exactly once.

**Bottlenecks and failure modes.** Per-line independent rounding; computing discounts and taxes at query time with different code than the till; refunds that edit the sale; refunds to the wrong tender; tips counted as sales; tip adjustments creating new tenders; item names joined from the current library; card details copied into analytics; at {{daily_orders}} orders a day, rebuilding all history on every late refund.

**Incident guidance.**
- *Rounding drift*: recompute allocations for the affected orders with largest remainder, write corrected applications as a new allocation version, restate net sales per item for the period and record the restatement. Guardrail: the invariant check per order at write time and nightly.
- *Refunds to the first tender*: identify tenders whose cumulative refunds exceed their amount; move the excess with corrective refund_tender rows (and, operationally, correct the gift card balances). Guardrail: per-tender refund cap enforced at write; a stated refund order over tenders.
- *Tip adjustments as new tenders*: deduplicate by tender id and adjustment id, rebuild tender facts for the affected days, and restate tender mix. Guardrail: an adjustment record type with the tender's id; payments counted by tender id, never by row.

**Follow-up guidance.** (1) Gross 450 + 510 + 375 = 1335 (the second coffee carries the 60-cent modifier); 10% = 133.5 → 134 or 133 by the stated rounding of the discount, then allocated by largest remainder; tax per line on the discounted amount; show sums. (2) refund_lines (line, quantity 1), refund_tenders split by the stated rule with caps; net sales per item falls by the refunded line's net. (3) The tender's tip changes; tips fact restated for the order's business date (or reported as an adjustment on the day it happened — stated); tender amounts unchanged. (4) Names and prices at sale on lines. (5) Line facts kept for years partitioned by business_date; late refunds update only the affected days' summaries.

**Rubric anchors.** 2: an order row with totals; discounts recomputed in queries. 3: line, modifier, discount application, tax line, tender and refund entities; exact allocation; invariants. 4: also tender-level refund caps, tip adjustments by tender id, point-in-time names, data minimisation and incident restatements.

**Strong signals.** Brings up largest remainder unprompted; checks the invariants with a worked order. **Red flags.** Floats for money; editing the original sale for a refund; storing full card numbers.

## BLK-L3-04

**Reference architecture (one defensible design).**
- `instruments (instrument_id, seller_id, kind gift_card|store_credit, form physical|digital, number_token, created_at, activated_at, state active|blocked|expired|cleared, expiry_rule_version)`. The printed number is tokenised; analytics uses instrument_id.
- `instrument_activities (activity_id, instrument_id, type activate|load|redeem|refund_to_card|issue_credit|expire|clear|adjust, amount_cents signed, order_id, location_id, device_id, occurred_at, synced_at, offline bool, rule_version)`. Append-only; expiry is an activity under a rule version ({{credit_expiry}}) in the location's local time; balance checks are logged elsewhere (they are not money).
- `instrument_balances (instrument_id, balance_cents, version, updated_at)` updated in the same transaction as each online activity.
- **Online redemption**: `UPDATE instrument_balances SET balance_cents = balance_cents − :amt, version = version + 1 WHERE instrument_id = :id AND balance_cents >= :amt` — one row updated means success, zero means decline; insert the activity in the same transaction (or `SELECT … FOR UPDATE`).
- **Offline redemptions** up to {{offline_cap}} arrive with occurred_at earlier than synced_at; they are accepted (the goods are gone), may drive a balance negative, raise a seller-facing exception, and restate balances on past dates.
- **Facts.** `fct_instrument_activity` (grain activity) and `fct_balance_daily (seller_id, date, outstanding_cents, cards_with_balance)` derived from activities by occurred_at; redemptions by issuing location (from the activate activity) versus redeeming location; store credit expiring next month from computed expiry dates.
- **Reconciliation.** Nightly: every stored balance = Σ activities; mismatches alert. Snapshots per day per instrument (or per seller) make "balance on a date" cheap: snapshot + the tail.

**Competing designs to accept.** Event-sourced balances with no stored balance, if the till path uses a cache with a strict concurrency control; separate tables for gift cards and store credit with a shared activity shape. Reserving funds (authorise, then capture) for redemptions that may be cancelled is a good extension.

**Bottlenecks and failure modes.** Balance updated without an activity row; read-modify-write races; deleting expired credit; expiry in UTC; offline redemptions rejected (hiding a real loss) or silently accepted with no alert; card numbers in analytics; replayed activities without idempotent activity ids; at {{active_cards}} cards, computing balances on a date from full history every time.

**Incident guidance.**
- *Offline redemptions into negative balances*: list instruments below zero with their offline activities; notify sellers with the details; leave the activities in place (they happened). Guardrail: an alert on any negative balance, and the offline cap of {{offline_cap}} enforced on the device.
- *Expiry a day early*: reverse with compensating activities (an `adjust` restoring each credit, linked to the wrong expiry), re-run expiry using each location's local date, and tell affected sellers. Guardrail: expiry computed in local time with a test at a zone behind UTC.
- *Replayed loads*: identify duplicates by activity id or (source event id), write reversing activities, recompute stored balances and the daily facts, and make the loader idempotent on activity id. Guardrail: the nightly balance reconciliation already fired — make it page.

**Follow-up guidance.** (1) 5000 → 1800 → 3000; the two 2500 attempts: one conditional update succeeds (500 left), the other is declined. (2) The offline redemption lands with its occurred time, the balance goes negative, an exception reaches the seller, and that day's outstanding balance report is restated. (3) Σ signed activities with occurred_at before the end of the date in the seller's zone, over activated cards; reports sent earlier carry an "as of data through" timestamp and restatements are labelled. (4) Compute expiry per credit under the rule version (issue date + period, or last use + period), select those in next month's local dates; the job writes `expire` activities. (5) Stored balances for the till; nightly Σ comparison; partition activities by seller and month.

**Rubric anchors.** 2: a balance column updated in place; expired rows deleted. 3: append-only activities, stored balance in step, race-free redemption, expiry as an activity, balances on a date from occurred time. 4: also offline semantics with visible negatives, local-time expiry under versioned rules, nightly reconciliation, tokenised numbers and incident handling with compensating activities.

**Strong signals.** Writes the conditional update. Separates occurred_at from synced_at. **Red flags.** Rejecting offline activities on sync; deleting or editing activities; legal conclusions about unredeemed balances.

## BLK-L3-05

**Reference solution** (PostgreSQL; `{{as_of_date}}` and `{{cutoff_date}}` are the instance's dates)

```sql reference
WITH bounds AS (                 -- each seller's local midnights, as instants
  SELECT seller_id,
         (DATE '{{as_of_date}}' + 1)::timestamp AT TIME ZONE time_zone  AS as_of_end,
         (DATE '{{cutoff_date}}' + 1)::timestamp AT TIME ZONE time_zone AS active_from
  FROM sellers
), card AS (
  SELECT c.seller_id, c.card_id, b.active_from,
         SUM(CASE a.kind WHEN 'redeem' THEN -a.amount_cents
                         WHEN 'balance_check' THEN 0
                         ELSE a.amount_cents END)                         AS balance_cents,
         MAX(a.occurred_at) FILTER (WHERE a.kind <> 'balance_check')      AS last_activity_at
  FROM gift_cards c
  JOIN bounds b ON b.seller_id = c.seller_id
  JOIN gift_card_activities a ON a.card_id = c.card_id AND a.occurred_at < b.as_of_end
  GROUP BY c.seller_id, c.card_id, b.active_from
  HAVING BOOL_OR(a.kind = 'activate')
)
SELECT seller_id,
       COUNT(*) FILTER (WHERE balance_cents > 0)                                   AS cards_with_balance,
       COALESCE(SUM(balance_cents) FILTER (WHERE balance_cents > 0), 0)            AS outstanding_cents,
       COUNT(*) FILTER (WHERE balance_cents > 0 AND last_activity_at < active_from) AS dormant_cards,
       COALESCE(SUM(balance_cents) FILTER (WHERE balance_cents > 0
                                             AND last_activity_at < active_from), 0) AS dormant_cents
FROM card
GROUP BY seller_id
ORDER BY seller_id;
```

**Explanation.** Each seller's two boundaries are local midnights turned into instants: the end of the as-of date (`as_of_date + 1` at local midnight) and the start of the day after the cutoff date. Every activity before the first boundary is summed per card with its sign from the kind, and the card's last activity is the latest non-balance-check activity in that same window. A card counts only once it has an `activate` activity in the window, so printed-but-inactive cards and cards activated later drop out. A card is dormant when its balance is above 0 and its last activity is before the start of the day after the cutoff date, which is exactly "on or before the cutoff date". Cards are then aggregated per seller with conditional counts and sums; a seller with only spent cards keeps a row of zeros because the per-seller grouping runs over activated cards, not over cards with a balance. At Medium and Hard every seller's zone is UTC, so the time-zone conversion is harmless; at Very Hard it is required.

**Complexity.** One pass over activities before the as-of boundary (a hash aggregate per card), then a small aggregate per seller. In production, a daily balance snapshot per card (balance, last activity) plus the activities since the snapshot replaces the full scan.

**Dialect notes.** `FILTER (WHERE …)` on aggregates is PostgreSQL (also SQLite and DuckDB); Snowflake, BigQuery, Spark SQL and MySQL use `SUM(CASE WHEN … THEN … END)` and `COUNT_IF` (Snowflake) or `COUNTIF` (BigQuery). `BOOL_OR` is `BOOLOR_AGG` in Snowflake, `LOGICAL_OR` in BigQuery and `MAX(kind = 'activate')` in MySQL. Local midnight to an instant: `CONVERT_TIMEZONE(tz, 'UTC', ts)` (Snowflake), `TIMESTAMP(DATETIME(date), tz)` (BigQuery), `to_utc_timestamp(ts, tz)` (Spark), `CONVERT_TZ` with loaded zone tables (MySQL). None of these variants is executed here.

**Edge cases built into the data.** An activity at 23:59:59 local on the as-of date (counts) and one at 00:00:00 the next day (does not); a card whose last activity fell on the cutoff date (dormant) and one whose last activity was at exactly 00:00:00 on the day after it (not dormant); a dormant card reloaded after the as-of date (dormant as of the date); an old card drained to zero (neither counted nor dormant); a card activated after the as-of date; a printed card never activated. Hard adds refunds back onto cards, balance checks after the cutoff on a dormant card (still dormant), and a seller whose activated cards are all spent (a row of zeros). Very Hard puts sellers in zones on both sides of UTC, so the as-of and cutoff boundaries move by up to ten hours.

**Common mistakes.** Filtering `occurred_at < as_of_date` (drops the as-of date itself); no as-of filter; last activity over all time; the cutoff date treated as exclusive; `last_activity <= as_of_end − interval '12 months'` (catches 00:00:00 on the day after the cutoff); zero-balance cards counted as dormant; (Hard+) refunds subtracted, balance checks treated as activity, sellers with only spent cards dropped by a HAVING or a join from balances; (Very Hard) UTC dates. Each has a diagnostic. Using `gift_cards.created_at` as the activation time is another frequent error.

**Follow-up guidance.** (1) A daily snapshot per card of (balance, last activity) keyed by date, plus the activities since; or a per-seller daily balance fact. Reconcile snapshots with the activity sums. (2) Late offline activities with their original occurred_at restate the past; reports carry an "as of data through" time and restatements are labelled, or the report is frozen and corrections appear as adjustments in the current period — stated, not mixed. (3) The issuing location comes from the `activate` activity's location_id; group cards by it before aggregating. (4) Remove the balance-check exclusion in the last-activity filter; earlier months' numbers change unless the report is versioned by rule.

**Rubric anchors.** 2: right shape but the as-of date itself excluded, or last activity over all time. 3: matches the expected result. 4: also explains snapshots for speed, restatement for late offline data, and per-location attribution.

**Strong signals.** Computes the boundaries once per seller and compares instants; asks whether balance checks are use. **Red flags.** Casting `occurred_at::date` in UTC; using `created_at` for activation; dropping sellers whose balance is zero.
