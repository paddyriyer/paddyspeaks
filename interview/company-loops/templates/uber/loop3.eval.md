# Uber · Loop 3 — evaluator notes (hidden from candidates)

## UBR-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Trips and legs.**
  - `vehicle_trips (vehicle_trip_id, driver_id, vehicle_id, city_id, product, is_shared, started_at, ended_at, distance_m, duration_s, route_version)`: what the driver did.
  - `rider_legs (leg_id, vehicle_trip_id, rider_id, request_id, pickup_at, dropoff_at, pickup_cell, dropoff_cell, status completed|cancelled_by_rider|cancelled_by_driver|no_show)`. A non-shared trip has one leg; a shared trip has one leg per rider. A leg may exist without a started vehicle trip (a cancellation that still carries a fee).
- **Rider money.** `fare_quotes (quote_id, request_id, price_version, currency, quoted_at)` with `fare_quote_components (quote_id, type, amount_minor)`, and `rider_charge_lines (line_id, leg_id, type base|time|distance|dynamic_adjustment|booking_fee|toll|airport_surcharge|promotion|tax|tip|cleaning_fee|cancellation_fee|adjustment|refund, amount_minor signed, currency, reason_code, source quote|trip_end|support|tip|payment, created_at, effective_for_date)`. The upfront quote's components become lines at trip end; the final-price difference (destination change) is its own adjustment line with a reason. Lines are append-only; a receipt is "all lines for the leg at time t".
- **Driver money.** `driver_earning_lines (line_id, vehicle_trip_id or leg_id NULL, driver_id, type fare_share|surge_or_boost|toll_reimbursement|tip|cancellation_fee_share|adjustment|incentive, amount_minor, currency, created_at, statement_period_id)`. Earnings are on the vehicle trip (once), with a tip line linked to the leg it came from.
- **Currency.** `currencies (code, minor_unit_exponent)` following ISO 4217 (0, 2 or 3); presentation divides by 10^exponent, storage never does. Conversion to a reporting currency uses a dated rate table and is done only in reporting views, with the rate date recorded.
- **Facts.** `fct_rider_charge_line` and `fct_driver_earning_line` at line grain (append-only, partitioned by created date); `fct_leg` (one row per leg, accumulating: quoted, final and adjusted totals, tip total, closed flag) and `fct_vehicle_trip` (one row per vehicle trip: earnings totals, online-time attribution).
- **Definitions (one acceptable wording).** Gross bookings = Σ rider charge lines excluding tips and taxes collected on behalf of authorities (and excluding tolls passed through, if finance treats them as pass-through), net of refunds, by the date of the leg. Take rate = (gross bookings − Σ driver earnings excluding tips and pass-throughs) ÷ gross bookings, per city and currency, converted only after the per-currency computation.
- **Late changes.** Tips and adjustments are lines with their own created_at; the report for a closed month uses a "restatement" policy: either post them in the month they arrive (activity basis) or restate with a published delta. The tip share uses trip-date cohorts that are final after {{tip_window_days}} days.

**Competing designs to accept.** A single trip table with a leg table only for shared rides (if non-shared trips still get a leg row or a view makes the grain uniform). An event-sourced fare service whose events are the lines. A double-entry ledger with rider, driver, marketplace and tax-authority accounts per trip; strong if receipts and statements are projections of it.

**Bottlenecks and failure modes.** One fare column overwritten by adjustments; earnings stored per leg and summed for shared trips; tips inside revenue; floats for money; exponent assumptions; converting currencies before computing take rate; recomputing whole months for late tips at {{daily_trips}} trips a day (touch only legs with new lines).

**Incident guidance.**
- *Late tips update the fact row*: the fact was mutable and statements were generated from a different source. Contain by freezing the closed month's published numbers; rebuild facts as append-only lines; reconcile Σ statement lines to warehouse lines per driver and period daily. The tips metric is cohort-based and labelled provisional for {{tip_window_days}} days.
- *Earnings counted per rider on shared trips*: fan-out from joining legs to vehicle-trip earnings. Fix the dashboard to aggregate earnings at vehicle-trip grain before joining; add a test that Σ earnings in the mart equals Σ earning lines; at {{shared_share}} shared trips, quantify the inflation by city.
- *Zero-decimal currency divided by 100*: an exponent assumption in code. Revert the pipeline, recompute the affected days, read the exponent from the currency table, and add a per-currency anomaly check (day-over-day gross bookings within a band) so a small market's hundredfold drop alerts.

**Follow-up guidance.** (1) One vehicle trip, three legs, each with its own lines; the destination change is an adjustment line on that rider's leg; the driver statement has one set of earnings for the vehicle trip. (2) A tip line with created_at in the open month; the closed month's published total does not change; the cohort metric for the trip date updates and is labelled. (3) Tips, taxes and pass-through tolls excluded from gross bookings; refunds subtracted. (4) The take rate for that trip falls (rider paid less, driver paid the same); finance usually wants it, but reports it with the reason. (5) Lines at line grain; legs and vehicle trips as accumulating facts rebuilt only for touched keys.

**Rubric anchors.** 2: one trips table with fare and tip columns updated in place; shared rides as duplicated trips. 3: vehicle trip and leg grains, typed lines for rider and driver money, append-only adjustments, integer minor units, written definitions. 4: also currency exponents and dated conversion, late-tip policy for closed months, fan-out prevention for shared trips, and correct incident handling.

**Strong signals.** Separates what the driver did from what each rider bought before drawing money tables; asks whether tips count as revenue. **Red flags.** Editing receipts; summing currencies; earnings per leg.

## UBR-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Requirements.** `requirement_rules (rule_id, city_id, product, document_type, version, valid_from, valid_to, recorded_at, renewal_months NULL, grace_days, transition_until NULL, applies_to new|all)`. Rules are versioned; a change ends one version and starts another. A correction of an erroneous rule is a new version with the same valid time and a later recorded_at (bitemporal), so an audit can ask either question.
- **Documents.** `documents (document_id, driver_id, document_type, submitted_at, storage_ref)`; the image sits in an access-controlled object store with encryption and retention; `document_fields (document_id, field, value, extracted_by ocr|reviewer, confidence, recorded_at)`; `document_decisions (decision_id, document_id, decision approved|rejected|revoked, reason_code, decided_by automated|reviewer_id, decided_at, effective_from)`. Decisions are append-only; the latest by decided_at wins.
- **Compliance intervals.** `compliance_intervals (driver_id, city_id, product, valid_from, valid_to, status compliant|grace|blocked, cause rule_id/document_id, computed_at)`. Derived per driver by walking the effective rule set and the approved documents' validity (approval effective_from → expiry end instant, where expiry is the end of the printed date in the city's local time). Grace of {{grace_days}} days produces a grace interval. Recomputed on any event that touches the driver (document decision, rule version in their city) and nightly as a safety net.
- **Two time axes.** Each interval set carries computed_at; "known then" is the set computed before the trip, "known now" is the latest. A revocation creates new intervals (and a list of affected trips) without deleting the old computation.
- **Facts.** `fct_onboarding_funnel` (one row per driver and city: signed_up_at, docs_submitted_at, approved_at, first_trip_at); `fct_document_review` (one row per decision); `fct_expiring_documents` (daily snapshot); and the audit view joining trips to intervals with `valid_from <= trip_started_at < valid_to`.
- **Privacy.** The warehouse holds document metadata and decisions, not images or document numbers in clear; deletion after the retention period removes personal fields and keeps pseudonymous audit facts (driver key, intervals, decisions) as policy allows.

**Competing designs to accept.** Computing compliance at query time from rules and documents (correct but slow; acceptable if they materialise the result for the online check). An event-sourced driver profile with projections. A rules engine owning requirement logic, with the warehouse storing its versioned outputs.

**Bottlenecks and failure modes.** A boolean is_compliant flag; rules edited in place; expiry in server time; deleting rejected or revoked decisions; recomputing every driver nightly at {{drivers}} drivers across {{cities}} cities instead of on events; images copied into the warehouse.

**Incident guidance.**
- *Rule edited in place*: restore the previous rule version from the change log or backups, re-add the correction as a new version, recompute intervals for the affected city, and rerun the audit. Guardrail: rule tables accept only inserts (permissions and a database trigger), and every audit cites the rule version.
- *Expiry evaluated in UTC*: compute the expiry instant from the printed date in the city's time zone; list trips that ran between the true block time and the actual one, notify the safety team, and add a test with cities on both sides of UTC. With a {{grace_days}}-day grace, compute grace from the same local instant.
- *Day and month swapped by extraction*: identify documents whose extracted date is ambiguous (both parts ≤ 12) for formats that use day/month; send them to review; block or unblock as the corrected date requires; store the document format with the extractor's output and add a confidence threshold below which a reviewer must confirm. Report the share per document type out of {{document_types}}.

**Follow-up guidance.** (1) Intervals: compliant until expiry, grace for {{grace_days}} days, blocked until renewal approval, compliant again, and a new blocked interval if the inspection requirement starts before an inspection is approved (or a transition interval if one applies). (2) Known-then report unchanged; known-now report lists the affected trips with the revocation as the cause. (3) A rule version with transition_until; intervals for existing drivers stay compliant until then. (4) Event-driven recomputation per driver; nightly sweep for expiries crossing midnight in each city's time zone. (5) Delete images and personal fields; keep pseudonymous intervals and decisions for the safety-audit retention period.

**Rubric anchors.** 2: a drivers table with document columns and an is_compliant flag. 3: versioned rules, append-only decisions, derived intervals, trips joined by time. 4: also bitemporal known-then/known-now, local-time expiry, transitions and revocations, privacy separation and event-driven recompute.

**Strong signals.** Asks how a past trip is audited before designing; treats expiry as a local-time instant. **Red flags.** Overwriting rules; deleting rejected documents; images in the warehouse.

## UBR-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Grid.** Cells are computed by the grid library, not stored as polygons: `cell_id` (64-bit index), resolution, and the library's parent function. A small `cells` table may be materialised only for cells in service areas, with the parent at the coarser resolutions in use. Parent relationships are by the library's definition; a coarser cell is *not* the exact union of its children, so area statistics at coarser resolutions are approximate.
- **Zone catalogue.** `zones (zone_id, type city|pricing|airport_pickup|event|tax, city_id, owner, precedence)`; zone_id survives redraws.
- **Zone versions.** `zone_versions (zone_version_id, zone_id, geometry, valid_from, valid_to NULL, recorded_at, author, reason, supersedes_version_id NULL)`. Immutable. Event geofences require a non-null valid_to. A split ends the old zone's version and starts versions of two zones, with a `zone_lineage (from_zone_id, to_zone_id, at)` table for continuous series.
- **Mapping.** `cell_zone_map (zone_version_id, cell_id, coverage center|partial)` at the base resolution {{base_resolution}}, computed when a version is published (a polyfill by cell centre, plus boundary cells flagged partial). Lookup for pricing: point → cell id (library) → equality join to the map filtered by valid time and precedence; cached per city in memory.
- **Exact tests.** Only for rules that require them (airport pickup queues, tax boundaries): if a point's cell is flagged partial for such a zone, run point-in-polygon against the version geometry.
- **Points.** Each assigned point stores its cell id at the base resolution and, for facts, the zone_version_id used; re-assignment under "as it is" uses the cell id, never the raw coordinates again unless an exact test is needed.
- **Reporting.** "As it was" uses the version in force at event time (default); "as it is" re-assigns history to the current versions, labelled; zone_lineage supports trends across splits.

**Competing designs to accept.** Storing polygons only and assigning by spatial index (R-tree) point-in-polygon at query time, if they address cost at {{daily_points}} points a day. Mapping at a finer resolution only near boundaries (compact cell sets). Geohash or S2 instead of hex cells, with a reasoned trade-off (exact nesting and prefix scans versus uniform neighbour distances).

**Bottlenecks and failure modes.** Overwriting geometries; backdated versions silently rewriting closed months; coarser-parent rollups treated as exact; event geofences without an end; exact polygon tests on every point; mapping size explosion when moving to a finer resolution (about seven times the cells per step).

**Incident guidance.**
- *Backdated redraw re-assigned last month*: valid time and recorded time were not separated, and the reassignment job was allowed to touch closed months. Restore the published month from the "as recorded" view, publish any restatement explicitly, and require approval for valid_from earlier than recorded_at, with an automatic list of affected reports.
- *Parent rollups double-count or miss edge trips*: assign each trip to a zone at the base resolution {{base_resolution}} (or exactly), then aggregate by zone; use coarser cells only for display. Add a check that Σ zone totals equals the city total within the expected tolerance.
- *Event geofence without an end*: require valid_to for event types, alert on events active longer than their declared window, and make the edit log searchable by zone type and author so one change among {{zone_edits_per_week}} a week is found in minutes.

**Follow-up guidance.** (1) Old zone version ends; two new zones start; lineage rows link them; the trend shows the old zone until the split and the sum of the two after, labelled. (2) Pricing uses the cell's mapping (centre rule); the airport rule runs an exact test because the cell is flagged partial. (3) Cells ≈ city area ÷ average cell area at that resolution; one resolution finer is about seven times as many rows. (4) Facts that used the affected cells and dates are recomputed under a restatement; consumers are notified via a published change record. (5) At ingestion, with the cell id and zone_version_id stored on the point.

**Rubric anchors.** 2: one zones table with geometry overwritten; zone = set of cells assumed exact. 3: catalogue and immutable versions with valid time, a precomputed cell mapping, precedence, an exact test where needed. 4: also recorded time versus valid time, the approximate hierarchy handled correctly, lineage across splits and a backdating policy.

**Strong signals.** Asks how analysts compare a zone across a redraw; knows that children do not nest exactly. **Red flags.** Point-in-polygon for every point at scale; editing geometry in place; event geofences with no end time.

## UBR-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Orders.** `orders (order_id, customer_id, merchant_id, city_id, placed_at, currency, ready_at, delivered_at)`; `order_items (order_item_id, order_id, merchant_item_id, menu_version_id, item_name_snapshot, unit_price_minor, qty, substitution_preference)`; `order_item_modifiers (order_item_id, modifier_name_snapshot, price_minor)`; `picking_events (order_item_id, kind found|substituted|out_of_stock, qty, substitute_item_id NULL, at)`. A substitution is a delivered line linked to the ordered line, so both "ordered" and "sent" survive.
- **Menu.** `merchant_items (merchant_item_id, merchant_id)`, `menu_versions (menu_version_id, merchant_id, published_at)`, `menu_item_versions (menu_version_id, merchant_item_id, name, price_minor)`. Reports group by a platform-assigned stable item key; a reused merchant id with a different dish gets a new stable key (detected by name/category change at publish).
- **Dispatch.** `courier_trips (courier_trip_id, courier_id, started_at, ended_at, distance_m, status)`, `trip_stops (courier_trip_id, seq, order_id, kind pickup|dropoff, arrived_at, departed_at)`. An order re-assigned after a courier cancels has stops on two trips; the completed one is marked.
- **Money lines.** `customer_charge_lines (order_id, order_item_id NULL, type item|modifier|delivery_fee|service_fee|small_order_fee|promotion|tip|tax, amount_minor, funder marketplace|merchant NULL)`; `merchant_payout_lines (merchant_id, order_id, type item_sales|commission|promotion_merchant_funded|refund_merchant_liable|adjustment, amount_minor, payout_period_id)`; `courier_pay_lines (courier_trip_id, type distance|time|extra_stop|incentive|tip, amount_minor)` stored once per trip.
- **Refunds.** `refund_lines (refund_line_id, order_item_id, qty, amount_minor, reason missing|wrong|damaged|late, liable merchant|marketplace, channel app|support, idempotency_key, created_at)`, with a database check (or a guarded write path) that Σ qty ≤ ordered qty and Σ amount ≤ charged for the item; the idempotency key is (order_item_id, reason, request id from the channel).
- **Facts.** `fct_order_item` (item grain: ordered, delivered, substituted, refunded qty and amounts, stable item key); `fct_order` (order grain: totals, ready-to-dropoff minutes, batched flag, allocated courier cost); `fct_courier_trip` (trip grain: pay, stops, distance). Courier cost per order = trip pay allocated by a stated rule (for example by each order's share of stop-to-stop distance, or equal per drop-off), computed once in `fct_order` with the rule name.
- **Visibility.** Merchants see item, order and payout facts for their own orders; courier pay stays out of merchant views; couriers lose access to customer details after drop-off.

**Competing designs to accept.** Order-level money with item-level refunds only (if refund invariants still hold per item). A delivery ledger with accounts for customer, merchant, courier and marketplace. Allocating courier cost by time rather than distance, if the rule is written and consistent.

**Bottlenecks and failure modes.** Joining courier pay to orders (fan-out); item names joined from the current menu; refunds without per-item invariants or idempotency; one delivery time for all audiences; courier per order modelled as a column (cannot represent batches or re-assignment); at {{daily_orders}} orders a day, rebuilding item facts nightly in full instead of touching orders with new refunds.

**Incident guidance.**
- *Courier pay counted per order on batched trips*: aggregate pay at trip grain and allocate it; correct the dashboard and recompute history; add a check that Σ allocated cost = Σ trip pay per day. At {{batched_share}} batched orders the inflation is large; quantify it for the people who acted on the dashboard.
- *Reused item ids*: snapshot names and prices on the order item; assign stable item keys at menu publish and detect reuse (name/category change); recompute refund rates on the stable key.
- *Double refunds from two channels*: stop the second channel's automatic refunds, list items where Σ refunded > charged, reverse the excess (and the merchant payout deductions) with compensating lines, and enforce the invariant and an idempotency key in the refund write path. Against a normal {{refund_share}} of orders refunded, alert when the daily share jumps.

**Follow-up guidance.** (1) One trip, four stops, two orders; one refund line on the second order's item with liable party; cost per order from the allocation rule. (2) Stable item key plus name snapshot; old dish's history unaffected. (3) Check in the refund service before commit; a refund that would break it is rejected or routed to review. (4) A rule based on stops or distance; batching lowers cost per order if the allocation is honest. (5) Item grain for refunds and menu analytics, order grain for delivery time and cost, trip grain for pay; late refunds update only touched orders.

**Rubric anchors.** 2: orders with a courier_id column and an items array; refunds at order level. 3: item grain with snapshots, many-to-many trips and orders via stops, typed money lines, item refunds with invariants. 4: also allocation rule, stable item keys against reuse, idempotent refunds across channels, audience-specific delivery times and visibility rules.

**Strong signals.** Sees the many-to-many between trips and orders immediately; asks who bears each refund. **Red flags.** Joining to the current menu for history; summing trip pay over orders; refunds without a cap per item.

## UBR-L3-05

**Reference solution** (PostgreSQL; `{{report_date}}` and `{{min_requests}}` are the instance's values)

```sql reference
WITH req AS (
  SELECT r.request_id,
         r.city_id,
         date_trunc('hour', r.requested_at AT TIME ZONE c.time_zone) AS local_hour,
         COALESCE(w.multiplier, 1.00) > 1.00 AS surged
  FROM ride_requests r
  JOIN cities c ON c.city_id = r.city_id
  LEFT JOIN surge_windows w
         ON w.zone_id = r.zone_id
        AND w.starts_at <= r.requested_at
        AND r.requested_at < w.ends_at
  WHERE (r.requested_at AT TIME ZONE c.time_zone)::date = DATE '{{report_date}}'
), completed AS (
  SELECT DISTINCT request_id
  FROM trips
  WHERE status = 'completed'
)
SELECT q.city_id,
       q.local_hour,
       COUNT(*)                                     AS requests,
       COUNT(*) FILTER (WHERE q.surged)             AS surged_requests,
       ROUND(COUNT(*) FILTER (WHERE q.surged)::numeric / COUNT(*), 4) AS request_surge_share,
       COUNT(d.request_id)                          AS completed_trips,
       COUNT(d.request_id) FILTER (WHERE q.surged)  AS surged_completed_trips,
       ROUND(COUNT(d.request_id) FILTER (WHERE q.surged)::numeric
             / NULLIF(COUNT(d.request_id), 0), 4)   AS completed_surge_share
FROM req q
LEFT JOIN completed d ON d.request_id = q.request_id
GROUP BY q.city_id, q.local_hour
HAVING COUNT(*) >= {{min_requests}}
ORDER BY q.city_id, q.local_hour;
```

**Explanation.** Each request is priced first: a LEFT JOIN to its zone's windows with the half-open condition `starts_at <= requested_at < ends_at` finds at most one window (windows of a zone never overlap), and a request with no window keeps a NULL multiplier that COALESCE turns into 1.00. Surge is strictly above 1.00, so explicit 1.00x windows and requests outside every window are unsurged but stay in the denominator. Trips are reduced to the set of request ids with a completed trip before the join, so a re-matched request (driver-cancelled trips before the final one) is still one row. `AT TIME ZONE` converts a `timestamptz` to the city's wall-clock time; the hour and the report date both come from it. A completed trip is attributed to its request's row, so it counts in the request's hour whenever it ended. `COUNT(d.request_id)` counts only matched (completed) rows; NULLIF makes the share NULL for an hour with nothing completed. The floor is a HAVING on the request count.

**Complexity.** One pass over the day's requests with an index or sort-merge range join on (zone_id, starts_at) for windows, a hash of completed request ids, and one hash aggregate by (city, hour). In production the request's quoted multiplier is stored with the request when it is priced, which removes the range join altogether; the date filter becomes a UTC range per city (local midnight to local midnight) so partitions on requested_at can be pruned.

**Dialect notes.** Time zones: Snowflake `CONVERT_TIMEZONE('UTC', c.time_zone, requested_at)` (or `CONVERT_TIMEZONE(c.time_zone, requested_at)` for a TIMESTAMP_TZ), then `DATE_TRUNC('hour', …)`; BigQuery `DATETIME_TRUNC(DATETIME(requested_at, c.time_zone), HOUR)`; Spark SQL `date_trunc('hour', from_utc_timestamp(requested_at, c.time_zone))`; MySQL 8 `CONVERT_TZ(requested_at, '+00:00', c.time_zone)`, which needs the server's time-zone tables loaded. Filtered counts: Snowflake `COUNT_IF(…)`, BigQuery `COUNTIF(…)`, Spark SQL supports `FILTER (WHERE …)` and `count_if`, MySQL `SUM(CASE WHEN … THEN 1 ELSE 0 END)`. Division by zero: BigQuery `SAFE_DIVIDE` returns NULL; Snowflake's `DIV0` and `DIV0NULL` return 0, not NULL, so use `NULLIF` there. ROUND rounds half away from zero on exact decimals in these engines, but BigQuery's `/` returns FLOAT64, so cast to NUMERIC before rounding if exact ties matter. None of these variants is executed here.

**Edge cases built into the data.** A surged window hit by one request exactly at `starts_at` (surged) and one exactly at `ends_at` (not priced by it); a window that sets exactly 1.00x with a request inside; a request exactly on a local hour; requests on the neighbouring local days (before local midnight of the report date, and from local midnight of the next day, sometimes exactly at it); an hour whose requests have no completed trip (NULL share); completed trips that end in a later hour. Hard adds re-matched requests (one or more driver-cancelled trips before the final trip), adjacent windows of one zone with different multipliers, and a minimum-requests floor with an hour below it. Very Hard adds three cities including one at UTC+5:30, and an hour 0 with a request exactly at local midnight and another one second before it.

**Common mistakes.** Bucketing hours or filtering the date in UTC; BETWEEN on the window (end inclusive: double counting with adjacent windows); an exclusive start; an inner join to windows (unsurged requests vanish); `>= 1.00` as surge; counting completed trips in their end hour; dividing surged completions by all requests; 0 instead of NULL for an empty denominator; (Hard+) joining requests to all trips before counting, and forgetting the floor. Each has a diagnostic.

**Follow-up guidance.** (1) Compute day-level shares from summed counts (Σ surged ÷ Σ requests); an average of hourly shares weights a quiet hour like a busy one. (2) Use the quoted multiplier stored on the request (or a `price_quotes` table keyed by request) as the record of what the rider saw; windows describe intent and can be corrected. (3) Truncating a local timestamp merges both occurrences of the repeated hour into one row (twice the usual requests); the report should label it or key hours by UTC offset as well; on a spring-forward day the missing hour has no row. (4) Store the multiplier at pricing time; partition requests by UTC date and city; compute per city-hour incrementally from a stream with late-event handling, keyed by local hour.

**Rubric anchors.** 2: right shape, but UTC hours or a fan-out through trips or an inner join to windows. 3: matches the expected result. 4: also explains summed-count rollups, storing the quoted multiplier, and repeated local hours.

**Strong signals.** Asks which time zone defines a city's day before writing SQL; reduces trips to one flag per request without being told. **Red flags.** `BETWEEN` for time windows; averaging hourly shares; hard-coding UTC offsets per city.
