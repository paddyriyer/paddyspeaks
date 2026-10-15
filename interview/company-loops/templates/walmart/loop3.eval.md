# Walmart Global Tech · Loop 3 — evaluator notes (hidden from candidates)

## WMT-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Items and offers.** `items (item_id, product_group_id, upc, description, department, category, is_weighted)`; variants are items sharing a `product_group_id`. `offers (offer_id, item_id, channel store|online|marketplace, seller_id, store_id NULL)`: one row per store item, one for the retailer's online offer, and one per marketplace seller offer (the retailer itself is not a marketplace seller here; its online offer is channel `online`).
- **Zones.** `price_zones (zone_id, name)` and `zone_membership (store_id, zone_id, valid_from_date, valid_to_date)`, effective-dated by store-local date. Never a `zone_id` column on the store row alone.
- **Price records (decisions).** `price_records (price_record_id, item_id, scope_type zone|store|online|seller_offer, scope_id, price_type regular|rollback|clearance|online_only, amount_cents, reference_cents NULL, valid_from, valid_to NULL, recorded_at, superseded_at NULL, supersedes_id NULL, source, reason)`. `valid_from/valid_to` is when the price is in force (store prices as a local date; online as an instant); `recorded_at/superseded_at` is when the system believed the record. A correction inserts a new record that `supersedes_id` the old one and sets the old one's `superseded_at` (the only update ever made, and an append-only design can derive it instead).
- **Resolution (this exercise's precedence).** For (offer, date): take records in force on that date and not superseded as of the "believed at" time; rank clearance > rollback > regular; within a type, a store-scope record beats the zone record; the store's zone is the one in `zone_membership` on that date. The "was" price for a rollback is the regular price that would have applied on that date without it. An overlap of two records of the same type and scope is a data-quality violation: reject at write time, or resolve by latest `recorded_at` and flag it.
- **Derived price of record.** `price_of_record (offer_id, valid_from, valid_to, amount_cents, price_type, was_cents, winning_record_id)` as intervals (not one row per day), maintained incrementally: a new or corrected record recomputes only the affected offers and dates. Store-level intervals can be derived per zone and expanded only for stores with exceptions, which keeps the table near zones × items rather than stores × items.
- **Questions answered.** "Price on D" = the interval containing D; "what did we believe on D" = re-run resolution with records where `recorded_at <= D_end AND (superseded_at IS NULL OR superseded_at > D_end)`, or keep the derived table bitemporal too.
- **Marketplace.** Seller prices are `price_records` with scope `seller_offer`, written only from seller feeds; they never participate in the retailer's precedence. What a customer saw is answered from the page/offer log (see WMT-L3-04) plus these records.

**Competing designs to accept.** A fully bitemporal table with both axes as ranges (`tstzrange` plus an exclusion constraint) instead of supersedes links. An event-sourced price log with the resolved table as a projection. Per-day snapshots for the last N days plus intervals for older history, if the candidate costs it. Resolution done on read with a cache, if they explain the latency and reproduce history correctly.

**Bottlenecks and failure modes.** One mutable price column; zone stored on the store row; time zones ignored for store-local effective dates; one row per store × item × day at {{stores}} stores (billions of rows a day); no second time axis, so late and corrected records are indistinguishable; marketplace prices mixed with retailer precedence; overlaps of clearance and rollback not detected; recomputing the whole history after each of {{weekly_changes}} changes.

**Incident guidance.**
- *Re-zoning changed last quarter's report*: zone was overwritten on the store row. Restore history by building `zone_membership` from change logs or snapshots, rerun the report from effective-dated membership, and add a check that historical reports are stable when only future membership changes.
- *Rollback ends loaded in UTC*: store prices take effect at the store-local day boundary. Correct with superseding records (not edits) carrying the local date, re-derive the affected intervals, and reconcile register charged prices for the hours affected; add validation that store-scope effective times are local dates.
- *Clearance and rollback both active*: precedence must reject or resolve the conflict at write time. Supersede the rollback in the 400 stores, recompute the price of record, fix the "was" price derivation (it must be the regular price, and a rollback on a clearance item is not allowed), and alert on overlaps of incompatible types.

**Follow-up guidance.** (1) Filter in force on D, not superseded; ORDER BY type rank, scope rank, recorded_at DESC; take first. (2) Old record superseded, new record with the shorter end; "believed on Thursday" returns the shortened one only if it was recorded before Thursday's end; otherwise the original. (3) Only `zone_membership` rows change; last month's history is unchanged because resolution uses membership on the date. (4) Intervals per zone and item plus store exceptions; estimate: items × zones × changes per year, versus stores × items × days. (5) The seller's offer record plus a log of the offer and price shown at order time; without a logged snapshot, a later reconstruction may not match what was on screen.

**Rubric anchors.** 2: a price column per item (maybe per store) updated in place; no history or only SCD2 with one time axis; zone on the store row. 3: typed effective-dated records, zone membership over time, stated precedence, resolved intervals, store-local dates. 4: also bitemporal corrections, "was" price, incremental recompute sized with numbers, marketplace prices kept apart, and incident fixes by supersession.

**Strong signals.** Separates decisions from resolved prices; asks how corrections are dated; sizes the derived table. **Red flags.** Overwrites prices; computes the price on a date from today's zone; stores money as floating point.

## WMT-L3-02

**Reference architecture (one defensible design).**
- **Orders.** `orders (order_id, store_id, slot_start, slot_end, channel pickup|delivery, placed_at)`; `order_lines (order_line_id, order_id, item_id, requested_qty, uom each|kg, est_price_cents, sub_preference any|named|none, named_sub_item_id NULL)`.
- **Picking.** `pick_walks (walk_id, store_id, started_at, ended_at, temp_zone)` with no person identifier in analytics (the operational system may hold a device id; it is not replicated). `pick_events (pick_event_id, walk_id, order_line_id, tote_id, kind picked|short|substituted, item_id, qty, measured_weight NULL, recorded_at)`. A substitution is a pick event with `kind = substituted` and its own `item_id`, plus `substitutions (substitution_id, order_line_id, ordered_item_id, sub_item_id, qty, offered_price_cents, charged_cap_cents)`.
- **Totes and staging.** `totes (tote_id, order_id, temp_zone)` (one order per tote); `tote_moves (tote_id, location_id, moved_at)` with `staging_locations (location_id, store_id, kind shelf|cooler|freezer|bay_cooler)`. Time in staging = intervals between consecutive moves until handoff, computed with LEAD over moves per tote.
- **Handoff.** `handoffs (handoff_id, order_id, handed_at, kind customer|driver, no_show bool)`; `substitution_decisions (substitution_id, decision accepted|rejected, decided_at)`.
- **Line outcome (analytics).** `fct_line_outcome (order_line_id, store_id, local_date, department, requested_qty, picked_as_ordered_qty, substituted_qty, sub_accepted_qty, sub_rejected_qty, short_qty, est_amount_cents, charged_cents)` with the invariant requested = as_ordered + substituted + short (for weighted items, in the ordered unit with a stated tolerance). Built incrementally from events by order (an accumulating snapshot that closes at handoff).
- **Metrics (per store, department, day; aggregates only).** Fill rate = Σ as-ordered units ÷ Σ requested; substitution rate = Σ substituted ÷ Σ requested; acceptance rate = Σ accepted ÷ Σ substitutes presented at handoff (no-shows excluded and reported apart); short with no substitute offered = Σ short where preference allowed one; staging breach count per temp zone = totes with chilled/frozen staging time over {{staging_limit_minutes}} minutes.

**Competing designs to accept.** Line outcome as an event-sourced fold, recomputed per order on each event. A single `line_events` table with a typed event column instead of separate pick/substitution tables, if quantities still reconcile. Weighted items modelled with a separate estimated and actual quantity on the line outcome.

**Bottlenecks and failure modes.** A single status on the line; substitutes overwriting the ordered item; associate ids leaking into the warehouse or being used for per-person metrics; staging time from one overwritten `staged_at`; mixed time zones between devices; nightly full rebuilds at {{orders_per_day}} orders × {{lines_per_order}} lines; acceptance rates with an unclear denominator.

**Incident guidance.**
- *Rejected recorded as accepted*: identify the release window and stores, rebuild decisions from the handoff device's raw events if kept (or mark the window as unknown), issue refunds through the payment system for rejected-and-charged substitutes, write correction rows (never edit the outcome silently), recompute the affected days and annotate the metric. Guardrail: a contract test that the decision field round-trips; alert on sudden acceptance-rate jumps per store.
- *Staging times inflated*: one move type logged in local time. Normalise all event times to UTC with the store's zone at ingestion, recompute intervals for the affected period, and add a validation that moves for a tote are monotonic in time.
- *Nightly rebuild too slow*: switch to incremental builds keyed by orders touched since the last watermark (orders close at handoff, so late events are bounded), partition by store-local date, and keep a weekly full reconciliation.

**Follow-up guidance.** (1) Σ outcome qty per line = requested; violations go to a quarantine table and an alert, never silently dropped. (2) Store both 2 kg requested and 2.3 kg picked; the charge is per this exercise's rule (the actual weight at the per-kg price, within a tolerance, or capped — candidate states it); fill rate counts the line as filled within tolerance. (3) Acceptance = accepted ÷ presented; no-shows are not decisions. (4) Two `tote_moves` rows and the handoff; breach when staged time exceeds the limit; report per store, day and temperature zone. (5) Facts: pick events (event grain), tote moves, handoffs; the accumulating line outcome snapshot.

**Rubric anchors.** 2: one status per line, substitutes overwrite the item, staging as a single timestamp, per-picker metrics. 3: outcome rows that reconcile, substitution as its own record, totes and moves, precise metrics per store and day. 4: also weighted items, privacy by grain (no associate ids in analytics), incremental builds and correct incident repairs.

**Strong signals.** Writes the reconciliation invariant unprompted; defines denominators. **Red flags.** Ranking stores' or associates' "productivity" from pick times; editing outcomes without a correction trail.

## WMT-L3-03

**Reference architecture (one defensible design).**
- **Reference data.** `items`, `case_packs (item_id, units_per_case, valid_from, valid_to)`, `dcs`, `stores`, `suppliers (supplier_id)` as ids only.
- **Inbound.** `purchase_orders (po_id, dc_id, supplier_id, expected_at)`, `po_lines (po_id, item_id, cases_ordered, crossdock bool)`. `case_events (event_id, case_label, item_id, dc_id, kind received|put_away|allocated|unallocated|picked|loaded|unloaded|departed|store_received|store_short|written_off, store_id NULL, trailer_trip_id NULL, location_id NULL, event_at, recorded_at, device_id)`. `received` captures `units_per_case` as of that moment (copied from `case_packs`) so later conversions never use today's pack.
- **Allocations.** Cross-dock allocations are created before arrival from po_lines and store orders; storage allocations after putaway. Both are `allocated` events on cases (or `allocation_lines (allocation_id, dc_id, item_id, store_id, cases, created_at, superseded_by)` with cases bound at pick time).
- **Outbound.** `trailer_trips (trip_id, dc_id, departed_at)`, `trip_stops (trip_id, stop_seq, store_id)`; `loaded` and `departed` events per case.
- **State on D.** `case_state_asof(D)` = latest event per case with `event_at <= D_end` (dedup by `event_id`, and by (case_label, kind, event_at) for resent scans); states: in_storage, allocated_not_shipped, in_transit(store), received_at_store, written_off. Units = Σ units_per_case captured at receipt.
- **Conservation per DC and item.** received = in storage + allocated not shipped + shipped + written off, checked daily; shipped = in transit + received at stores + store shortages under investigation.
- **Physical design.** Events partitioned by event date and DC; a daily snapshot of open cases (cases not yet received at a store or written off) so "as of D" reads the snapshot for D−1 plus one day of events; late events trigger a re-snapshot of the affected days.

**Competing designs to accept.** Quantity-based flows (lots of N cases) instead of per-case identity, if conversions and partial picks are handled. A pallet-level model with cases as children. Event sourcing with a state table updated in the same transaction as each event, as long as history by date is reproducible.

**Bottlenecks and failure modes.** A mutable current location as the only state; summing events instead of taking the latest per case; converting with today's case pack; duplicate scans; cross-dock cases that fall out of every state when allocations are cancelled; full scans of all events for every as-of query at {{cases_per_day}} cases a day; time zones of DCs and stores mixed.

**Incident guidance.**
- *Resent "loaded" scans*: counting loads, not states. Deduplicate by event id (or label, kind and event time), compute state as the latest event per case, rerun the affected day's snapshot, and add a monitor comparing in-transit units with loaded-not-received cases.
- *Case pack conversion*: capture units per case on the receipt event; restate the affected shipments using the captured pack; add a check that conversions use the pack valid at receipt.
- *Orphan cases after cancelled allocations*: an `unallocated` event must return the case to a state (awaiting putaway). Backfill the state for the orphaned cases, make "no state" impossible by a constraint or a daily conservation check, and report the cross-dock share from cases that actually flowed through, not from the plan, with {{crossdock_share}} as the plan.

**Follow-up guidance.** (1) Latest event per case at D_end with `DISTINCT ON (case_label) … ORDER BY case_label, event_at DESC, recorded_at DESC` filtered to `departed`; group by store and item, sum units. (2) Old cases convert at 12, new at 8; the store's receipt uses the pack captured on the case. (3) Two `store_short` events and one `store_received` at the wrong store plus a transfer or return event; conservation holds per DC because each case is in exactly one state. (4) Snapshot of open cases daily versus compute on demand; cost in rows and recompute after late events. (5) Final after the lateness bound (two days here); show provisional numbers with a watermark.

**Rubric anchors.** 2: a current-location table, cases and units mixed, no as-of capability. 3: case events with event and recorded times, cross-dock and storage paths, state as latest event, case pack captured, conservation stated. 4: also deduplication, orphan prevention, snapshot strategy sized against volume, lateness and provisional numbers, and incident repairs.

**Strong signals.** Picks the case label as identity; writes the conservation equation. **Red flags.** Converting with the current case pack; updating rows in place; counting scans as movements.

## WMT-L3-04

**Reference architecture (one defensible design).**
- **Catalogue and sellers.** `items (item_id, product_group_id)`, `sellers (seller_id, is_retailer)`, `seller_standing (seller_id, as_of_date, on_time_rate, valid_tracking_rate, meets_minimums, inputs_complete)` recomputed daily (this exercise's rule).
- **Offers.** `offers (offer_id, item_id, seller_id, condition)`; `offer_versions (offer_id, version, price_cents, shipping_cents, qty_available, delivery_promise_days, event_at, recorded_at, source)` append-only; the current version per offer is the one with the latest event_at (with recorded_at as a tie-break), and an out-of-order update older than the current one is stored but does not change the present.
- **Decisions.** `featured_decisions (decision_id, item_id, decided_at, trigger offer_update|standing_change|stock_out|rule_change, rule_version, chosen_offer_id NULL, chosen_version NULL)`; `decision_inputs (decision_id, offer_id, version, eligible, ineligible_reason, total_price_cents, score NULL, score_version NULL, rank)` so the choice under {{featured_rule}} is reproducible. `featured_intervals (item_id, offer_id NULL, valid_from, valid_to, decision_id)` non-overlapping per item (an exclusion constraint on a range, or closing each interval at the next interval's start in the same time axis). `offer_id NULL` means "no eligible offer".
- **Time axes.** Decisions are recomputed on event time for history ("who should have been featured") and the live system logs what was served (`page_views` are not stored per customer; order lines store it).
- **Orders.** `order_lines (order_line_id, item_id, offer_id, offer_version, featured_decision_id, price_cents)`: what the customer bought, and what was featured at that moment.
- **Queries.** Share of featured time per seller, item and week: intersect each interval with the week ([max(from, week_start), min(to, week_end))), sum durations, divide by the week's length. Share of orders: count order lines by `featured_decision_id`'s chosen seller. "Why not S at T": the decision active at T and its `decision_inputs` row for S (ineligible reason or rank and the featured total price), filtered to S's own rows plus the fields the rule exposes.
- **Scale.** At {{offer_updates}} updates a day, offer versions are partitioned by day and clustered by item; decisions are recomputed only for items whose offers or sellers changed; a standing change fans out through an index of (seller → items with offers).

**Competing designs to accept.** Computing the featured offer on read with a cache, plus a decision log written on change (history must still exist). Storing only decisions with inputs and deriving intervals as a view. A stream processor keyed by item maintaining the current choice, with the log as its output.

**Bottlenecks and failure modes.** Offers overwritten; a featured flag on the offer row (two flags at once, no history); intervals closed on recorded time and opened on event time (overlaps); no "none eligible" state; standing computed from incomplete inputs; sellers seeing competitors' details; re-evaluating all {{items}} items when standing changes.

**Incident guidance.**
- *Backlogged updates*: decisions and intervals built on recorded time penalised sellers for delay in ingestion. Recompute history on event time from stored versions; keep "what was served" separately from the decision log; communicate to affected sellers with the corrected share of featured time.
- *Standing input missing*: an incomplete input should keep the previous standing (or mark it unknown and not change eligibility), never mark everyone ineligible. Re-run standing with the input, recompute decisions for affected items, and add `inputs_complete` as a gate.
- *Shares adding to 107%*: intervals on mixed time axes overlap. Rebuild intervals on one axis, add a non-overlap constraint per item, and assert shares sum to at most 100% per item and week.

**Follow-up guidance.** (1) Interval-week intersection, including those still open (valid_to NULL → now). (2) Event-time history says the seller was featured from 12:00 if their new price wins; what the customer saw (served log) shows the old choice until 12:10; both are true for their own questions. (3) Fan out from the three sellers to items with their offers; recompute those decisions only. (4) The decision and its inputs for S, the featured offer's exposed fields only. (5) Partitioned versions, current-state table for the page, intervals table for history.

**Rubric anchors.** 2: offers overwritten, a flag for the featured offer, no history or reasons. 3: offer versions, eligibility with reasons, featured intervals with decisions, order lines linked to versions. 4: also two time axes handled deliberately, reproducible selections with rule and score versions, seller-scoped evidence, incremental recompute with fan-out, and incident repairs.

**Strong signals.** Distinguishes "who should have been featured" from "what was served"; models "none eligible". **Red flags.** Showing sellers competitors' data; overlapping intervals; recomputing the whole catalogue on every change.

## WMT-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH windows AS (
  SELECT rollback_id, item_id, region, 'rollback' AS phase, start_date AS first_day, end_date AS last_day
  FROM rollbacks
  UNION ALL
  SELECT rollback_id, item_id, region, 'baseline', start_date - 28, start_date - 1
  FROM rollbacks
), store_days AS (
  SELECT w.rollback_id, w.item_id, w.phase, s.store_id, s.region, s.opened_on, w.first_day + k AS day
  FROM windows w
  JOIN stores s ON s.region = w.region
  CROSS JOIN LATERAL generate_series(0, w.last_day - w.first_day) AS k
), counted AS (
  SELECT sd.rollback_id, sd.item_id, sd.phase, sd.store_id, sd.day
  FROM store_days sd
  WHERE sd.day >= sd.opened_on
    AND NOT EXISTS (SELECT 1 FROM out_of_stock_days o
                    WHERE o.store_id = sd.store_id AND o.item_id = sd.item_id AND o.oos_date = sd.day)
    AND NOT (sd.phase = 'baseline' AND EXISTS (
          SELECT 1 FROM rollbacks r2
          WHERE r2.item_id = sd.item_id AND r2.region = sd.region AND r2.rollback_id <> sd.rollback_id
            AND sd.day BETWEEN r2.start_date AND r2.end_date))
), rates AS (
  SELECT c.rollback_id, c.phase, COUNT(*) AS store_days, SUM(COALESCE(f.units, 0)) AS units
  FROM counted c
  LEFT JOIN store_item_sales f
    ON f.store_id = c.store_id AND f.item_id = c.item_id AND f.sale_date = c.day
  GROUP BY c.rollback_id, c.phase
)
SELECT r.rollback_id,
       r.item_id,
       ro.store_days AS rollback_store_days,
       ROUND(ro.units::numeric / ro.store_days, 2) AS rollback_units_per_store_day,
       COALESCE(b.store_days, 0) AS baseline_store_days,
       ROUND(b.units::numeric / b.store_days, 2) AS baseline_units_per_store_day,
       CASE WHEN b.units > 0
            THEN ROUND(100.0 * ro.units * b.store_days / (ro.store_days * b.units) - 100, 1)
       END AS lift_pct
FROM rollbacks r
JOIN rates ro ON ro.rollback_id = r.rollback_id AND ro.phase = 'rollback'
LEFT JOIN rates b ON b.rollback_id = r.rollback_id AND b.phase = 'baseline'
ORDER BY r.rollback_id;
```

**Explanation.** The denominator is store-days, and a store-day exists whether or not anything sold, so it has to come from a calendar: each rollback's two windows expanded to dates and crossed with the stores in its region. Store-days before a store opened, store-days when the item was out of stock and (at the hardest level) baseline days inside another rollback of the same item in the same region are removed as whole store-days, units included; only then are sales LEFT JOINed and summed with zeros filled in. The two windows are aggregated separately and placed side by side. The lift is written as one division of exact integers, 100 × rollback units × baseline days ÷ (rollback days × baseline units) − 100, so it is exact before the single rounding; a zero baseline gives NULL rather than an error.

**Complexity.** The calendar has Σ over rollbacks of (window days × stores in region) rows: about 36 × stores per rollback. The anti-joins and the sales join are hash or index lookups on (store_id, item_id, date). In production, a daily store-item fact with an in-stock flag and explicit zero rows (or a store-item-day calendar table) replaces the generated series, and readouts are incremental per rollback.

**Dialect notes.** `generate_series` with `CROSS JOIN LATERAL` is PostgreSQL; BigQuery uses `UNNEST(GENERATE_DATE_ARRAY(first_day, last_day))`, Snowflake a row generator or a calendar table (`TABLE(GENERATOR(ROWCOUNT => n))` with `DATEADD`), Spark SQL `explode(sequence(first_day, last_day))`, MySQL 8 a recursive CTE or a calendar table. `date - integer` is PostgreSQL; others use `DATE_SUB`/`DATEADD`. Division: `units / store_days` truncates to an integer in PostgreSQL, while Snowflake and MySQL return a decimal and BigQuery and Spark SQL a floating-point value; an explicit cast to NUMERIC/DECIMAL keeps the result portable. `ROUND` on numeric rounds halves away from zero in PostgreSQL; BigQuery `ROUND` on FLOAT64 also rounds half away from zero but floating point may land just below a half, so use NUMERIC. None of these variants is executed here.

**Edge cases built into the data.** Sales the day before the baseline (start − 29) and the day after the rollback (end + 1), which must not count; the first baseline day and the last rollback day, which must; out-of-stock store-days with units sold before the stock-out, in both windows. Hard adds a second region (stores outside a rollback's region sell the item too), sales rows only on days with sales, and a seasonal item whose baseline sold nothing (lift NULL, baseline rate 0.00). Very Hard adds a store that opened inside a baseline window (no rows before opening, which a calendar built from all stores would count as zeros), an earlier rollback of the same item in the same region inside a later rollback's baseline, and a rollback of the same item in the other region during that baseline, which must not be excluded.

**Common mistakes.** Averaging only the sales rows present (zero days lost); starting from `store_item_sales` with an inner join; dropping out-of-stock store-days from the count but keeping their units; including the start date in the baseline (`BETWEEN start_date - 28 AND start_date`); treating `end_date` as exclusive; counting stores from other regions; integer division; rounding the rates before computing lift; (Very Hard) counting pre-opening days, keeping overlapping rollback days in the baseline, or excluding another region's rollback days. Each has a diagnostic.

**Follow-up guidance.** (1) Holdout stores chosen before the start (random within region or matched on prior sales), recorded with the rollback; difference-in-differences between rollback and holdout stores over the same window. (2) Add a similar-items list (same category or a substitution group) and compute the same rates for those items in the same stores and windows; net lift = item lift minus loss on substitutes. (3) In-stock hours as a fractional denominator (store-day weighted by hours on shelf); usually worth it only for fast sellers. (4) A store-item-day fact with in-stock flag and zero rows, partitioned by date; per-rollback aggregates recomputed only when late sales, out-of-stock corrections or rollback edits touch their windows.

**Rubric anchors.** 2: rates over sales rows only, or out-of-stock handled on one side only. 3: matches the expected result. 4: also explains the holdout design, cannibalisation, and incremental materialisation with explicit zero rows.

**Strong signals.** Asks immediately whether zero-sale days have rows; treats the denominator as a calendar. **Red flags.** `AVG(units)` over the sales table; `NOT IN` against a nullable column without thought; a lift computed from rounded rates.
