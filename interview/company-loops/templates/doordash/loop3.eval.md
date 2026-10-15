# DoorDash · Loop 3 — evaluator notes (hidden from candidates)

## DSH-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Stable identity.** `menu_items (item_key, store_id, created_at)` is the marketplace's own key; `item_source_ids (item_key, source, source_item_id, valid_from, valid_to)` maps point-of-sale ids to it over time. A re-sync matches incoming items to existing keys (source id first, then name + category + price similarity with review for low-confidence matches) instead of minting new keys.
- **Structure and versions.** Nodes: `menus (menu_id, store_id)`, `categories`, `items`, `modifier_groups (group_id, store_id)`, `options (option_id, group_id)`. Each node has a version table with `valid_from, valid_to, recorded_at`: `item_versions (item_key, version, name, description, base_flag_in_stock)`, `group_versions (group_id, version, name, min_select, max_select)`, `option_versions (option_id, version, name, price_delta_cents, nested_group_id NULL)`. Edges are versioned too: `menu_category_items (menu_id, category_id, item_key, position, valid_from, valid_to)`, `item_groups (item_key, group_id, position, valid_from, valid_to)`. A shared group is one `group_id` referenced by many `item_groups` rows; editing it writes one new group or option version.
- **Hours and prices.** `menu_hours (menu_id, iso_weekday, open_local, close_local, valid_from, valid_to)` in store-local time. `prices (item_key, menu_id, channel, amount_cents, valid_from, valid_to)` so lunch and dinner prices and channel prices (on {{channel_list}}) are rows, not columns; the precedence when two open menus list the item (this exercise: the menu that opened later wins) lives in the resolution function and is recorded with a rule version.
- **Published versions.** Optionally, each change also produces an immutable `published_menu (store_id, channel, version, published_at, content_hash, document)` used for serving; it is derived from the node versions, not the source of truth.
- **Orders.** `order_lines (order_line_id, item_key, item_version, menu_id, channel, unit_price_cents)` and `order_line_options (order_line_id, path, option_id, option_version, group_id, group_version, price_delta_cents, name_at_order)`; a frozen name and price per option means receipts and refunds never depend on the live menu.
- **Menu as of T.** Filter every version and edge table by `valid_from <= T < valid_to` for the store and channel, and evaluate menu hours at T in local time. Or, with published versions, take the latest `published_at <= T`.
- **Validation.** For each group attached at a level, count selected options: `min_select <= n <= max_select`; recurse into the nested group of each selected option only; a nested group under an unselected option is ignored even if `min_select > 0`. Depth ≤ 3 and a cycle check (a group may not appear on its own path) at write time.

**Competing designs to accept.** Immutable published-menu documents per change as the only store, with a normalised index derived for analytics, if the candidate costs the storage (a full copy of {{items_per_menu}} items per change) and explains how history questions are answered. A bitemporal node model. An event-sourced menu log with projections. A document store for serving plus versioned relational tables for history.

**Bottlenecks and failure modes.** Point-of-sale ids as keys; prices overwritten in place; order lines pointing at live nodes; a whole-menu rewrite per change at {{menu_changes}} changes a day; validation that treats nested required groups as always required; menu hours stored in UTC with a fixed offset; no rule for two open menus listing the same item.

**Incident guidance.**
- *Re-sync made every item new*: item keys must be the marketplace's own. Rebuild `item_source_ids` by matching the new point-of-sale ids to the old keys (exact matches first, review the rest), re-point the new rows to the old keys, and merge the reset history; add a check that a re-sync creating more than a small share of new items is held for review.
- *Shared group edit changed old receipts*: order lines referenced live nodes. Rebuild the past from version history where it exists (option versions valid at order time), freeze names and prices on order lines going forward, and recompute the refunds issued with the wrong amounts.
- *Publishing fell behind*: rebuilding whole menus per change does not scale. Publish incrementally (only the changed items and the items sharing a changed group), coalesce changes per store within a short window, and alert on publish lag rather than discovering stale prices from consumers.

**Follow-up guidance.** (1) Recursive check over selected options; required nested groups only under selected parents; reject selections of options not in the group version valid at order time. (2) One new option version and one new group version (if max changes); no item rows change; the earlier order shows its frozen options. (3) Mapping table from source ids to stable keys; a re-sync writes new mapping rows. (4) Snapshot: changes × items per menu rows (or bytes) per day, cheap "as of" reads; node versions: rows proportional to changes, "as of" needs a join over versions per node; many teams do both. (5) Resolution rule with a version, applied per channel; the order line stores the menu and price used.

**Rubric anchors.** 2: one item table with a price column and a JSON blob of modifiers, updated in place; order lines reference live items. 3: versioned nodes or published snapshots, shared groups, channel prices, frozen order lines, correct validation. 4: also stable identity across re-syncs, explicit precedence for overlapping menus, storage and publish costs estimated, cycle and depth checks, incident repairs from history.

**Strong signals.** Asks how a shared group's change propagates; freezes order lines unprompted; separates the serving document from the source of truth. **Red flags.** Point-of-sale ids as primary keys; receipts rebuilt from the live menu; money as floating point.

## DSH-L3-02

**Reference architecture (one defensible design).**
- **Stores and zones.** `stores (store_id, time_zone_iana)`; `store_time_zone_history (store_id, time_zone_iana, valid_from, valid_to, is_correction)`. A correction re-derives intervals; whether past answers move is a stated choice (usually: the corrected zone applies to the past too, with the old answers kept in a log of what was served).
- **Schedules.** `schedule_versions (schedule_id, store_id, valid_from_utc, valid_to_utc, saved_at, source)` and `schedule_intervals (schedule_id, iso_weekday, open_local TIME, close_local TIME, is_24h)`: close earlier than open means the next day; `is_24h` is an explicit flag, so an equal open and close is rejected as an error. An edit creates a new version effective from the save instant; past versions are never changed.
- **Overrides.** `date_overrides (override_id, store_id, local_date, kind closed|hours, open_local, close_local, saved_at, superseded_at)`: replaces only the intervals that open on that local date.
- **Pauses.** `pauses (pause_id, store_id, started_at_utc, planned_end_utc NULL, ended_at_utc NULL, started_by merchant|system_device_offline, ended_by merchant|system|expiry)`. A merchant pause and an automatic pause can coexist; the store reopens only when no pause is active.
- **Resolution at instant T.** Convert T to the store's local time with the zone in force; candidate dates are the local date and the day before; for each, take the override if one exists, else the schedule version in force, and turn its intervals into UTC instants with the IANA zone rules (wall-clock honoured: on a fall-back night 22:00–02:00 lasts 5 hours, on a spring-forward night 3). Open if T is in an interval and no pause is active; the reason code says which source decided.
- **Derived table.** `open_intervals (store_id, opens_at_utc, closes_at_utc, source_version, derived_at)` for the next N weeks, regenerated per store on every schedule edit, override, zone change and as the horizon rolls; "open now" = an interval lookup minus active pauses held in a fast key-value store keyed by store. At {{open_checks}} checks a second, serving reads a cache or in-memory index per region; pause starts and ends are pushed (events) rather than polled, with a freshness target in seconds.
- **History.** Because versions and pauses are append-only, "was S open at T" replays resolution with the versions valid at T; the derived intervals are also kept (not deleted) so past answers are cheap.

**Competing designs to accept.** Computing open/closed on read with no derived table, if the candidate shows the read cost fits {{open_checks}} checks a second with caching. Storing intervals as `tstzrange` with exclusion constraints. An RRULE-style recurrence representation, if overnight intervals and overrides are handled.

**Bottlenecks and failure modes.** Fixed UTC offsets; a single boolean "open now" refreshed by a job; holiday edits written into the weekly schedule; overrides that cut the previous night's late shift; pauses with no source, so automatic pauses cannot end automatically; open-ended pauses without monitoring; past answers that change when hours are edited.

**Incident guidance.**
- *Closed for the last hour on fall-back night*: intervals were derived with a fixed offset. Re-derive with IANA zone rules across the {{time_zones}} zones, add tests for both transition nights, and compare derived durations with listed wall-clock durations each night before a transition.
- *Holiday saved as a weekly change*: the edit path did not distinguish an override from a schedule change. Restore the prior schedule version as a new version effective immediately, re-enter the holiday as a date override, re-derive intervals, and add a confirmation (or a separate UI path) for edits that affect every future week.
- *Automatic pauses stuck after an outage*: automatic pauses must carry their source and end when the device reconnects. Close the stuck pauses with `ended_by = system`, alert on pause starts above the normal rate ({{pauses_per_day}} a day is the baseline), and report lost open minutes to the affected merchants.

**Follow-up guidance.** (1) Local date and previous date; override else schedule; UTC conversion; pause check; reason code. (2) Spring forward: 22:00–02:00 holds 3 elapsed hours; fall back: 5; the interval endpoints are what the zone rules give for those wall-clock times. (3) A new schedule version from Friday's save instant; derived rows from then on change; last Saturday answers from the old version. (4) Derived intervals regionally replicated, pauses pushed to the serving cache in seconds. (5) The scheduled orders table joined to overrides saved after the orders were placed; the order should be flagged for the merchant and the consumer (this exercise's rule decides whether it is cancelled).

**Rubric anchors.** 2: hours as text or a single open/close per day; a boolean open flag; UTC offsets. 3: schedule, overrides and pauses separated; overnight intervals; IANA time zones; derived intervals. 4: also versioned history for past instants, daylight-saving behaviour stated and handled, pause sources and open-ended pauses, serving design sized, incidents repaired.

**Strong signals.** Asks immediately about midnight and daylight saving; keeps "the rule" separate from "the derived intervals". **Red flags.** Storing UTC offsets; overwriting hours; treating a holiday as a weekly change.

## DSH-L3-03

**Reference architecture (one defensible design).**
- **Master catalogue.** `master_items (master_item_id, family_id, brand, name, size_value, size_unit, unit_kind each|weight, created_at)`; `product_families (family_id)` links a can and a 6-pack. `master_item_codes (master_item_id, code, code_type barcode|store_code, valid_from, valid_to)`: a barcode is an attribute with a validity, not the key, so a reused barcode points to a new master item from a date.
- **Listings.** `listings (listing_id, store_id, merchant_item_id, first_seen_at)`; `listing_versions (listing_id, version, name, size_text, price_cents, price_unit each|kg|lb, valid_from, valid_to, feed_batch_id)` written only when an attribute changes (hash compare). A reused merchant id with a different product closes the old listing and opens a new one (detected by a large change in name, size or barcode).
- **Mapping.** `listing_mappings (listing_id, master_item_id, source barcode|manual|model, confidence, valid_from, valid_to, recorded_at, superseded_by)`; a correction is a new row superseding the old, so reports can be restated for the period. Low-confidence matches go to a review queue; units are normalised (oz to ml, counts) before matching.
- **Signals.** `availability_signals (listing_id, observed_at, recorded_at, source feed|pick|sale, value in_stock|out_of_stock|found|not_found, quantity NULL)`, append-only; no state is stored here.
- **Orders.** `order_lines (order_line_id, order_id, listing_id, listing_version, master_item_id_at_order, ordered_qty, ordered_unit, est_price_cents, preference specific|best_match|refund, named_listing_id NULL)`. `line_outcomes (order_line_id, kind found|substituted|refunded, listing_id, master_item_id, qty, weight_g NULL, amount_cents, best_match_ranking_version NULL, candidate_rank NULL, named_tried bool)`; invariant Σ qty = ordered_qty, checked.
- **Queries.** Found rate per master item, region and week = Σ found qty ÷ Σ ordered qty over lines whose mapping at order time was that master item (state whether to use the mapping of record or the corrected mapping). Substitutes given for a master item: group `substituted` outcomes by ordered master item and substitute master item, with the share where the consumer named it. One order: lines with their frozen listing versions, preferences and outcomes, visible only to that consumer and support.

**Competing designs to accept.** A graph or document model for the catalogue with a relational order side. Storing listing versions as SCD2 rows in a lake table partitioned by date with change detection. Using the mapping current today for found rate (with a stated restatement policy) instead of the mapping at order time.

**Bottlenecks and failure modes.** Barcode as primary key; merchant ids treated as permanent; an availability flag overwritten; the substitute written over the ordered item; outcomes that do not reconcile; weighted items counted as not found; rewriting every listing nightly at {{listings}} listings; consumer-level analytics.

**Incident guidance.**
- *Sizes in the name field created new master items*: the matcher accepted a malformed feed. Quarantine the batch (schema and distribution checks per feed before matching), supersede the bad mappings with the previous ones, retire the spurious master items, and restate the found rates for the affected days.
- *Weighted items recorded as not found*: the pick outcome conflated "found at a different weight" with "not found". Record picked weight on found outcomes, re-derive outcomes from the pick events for the affected days, and restate the region's found rate.
- *Nightly rewrite of every listing*: write versions only on change (hash per listing), compact historical versions, and partition by store and validity so "as of a date" reads one partition range; at {{feed_updates}} updates a day most updates change nothing.

**Follow-up guidance.** (1) Close the old listing (or mapping) at the reuse date and open a new one; last month's found rate stays with the old master item. (2) Units found ÷ units ordered, per line in ordered units; for weighted items, a line is found when picked within this exercise's tolerance. (3) Parse and normalise units; match on brand, normalised size and name similarity; review below a confidence threshold. (4) Change detection, append-only versions, compaction. (5) Superseding mapping rows; reports keyed by order-time mapping can be restated for the corrected window with an audit note.

**Rubric anchors.** 2: one items table per store with a stock flag; substitutes overwrite the line. 3: master items, versioned listings, mapping table, signals as events, outcome rows that reconcile. 4: also mapping corrections with restatement, barcode reuse and store codes, weighted items, change-only versioning sized against volume, privacy and merchant scoping.

**Strong signals.** Treats the mapping as data with confidence and history; writes the reconciliation invariant. **Red flags.** Barcode as the key; deleting old listings; per-consumer analytics.

## DSH-L3-04

**Reference architecture (one defensible design).**
- **Plans.** `plans (plan_id, cadence monthly|annual)`; `plan_versions (plan_id, version, price_cents, delivery_fee_waiver bool, service_fee_discount_bps, min_subtotal_cents, valid_from, valid_to)`: a price change is a new version, applied at each member's next renewal.
- **Memberships and periods.** `memberships (membership_id, consumer_id, started_at, ended_at NULL)`; `membership_periods (period_id, membership_id, kind trial|paid|grace|paused, plan_id, plan_version, starts_at, ends_at, created_by_event)` with no overlap per membership (exclusion constraint or checks). Cancellation is an event (`membership_events (membership_id, kind, at, effective_at)`) that sets the end of the membership at the current period's end; it does not shorten the paid period.
- **Money.** `billing_attempts (attempt_id, membership_id, period_id, attempted_at, outcome, amount_cents)`, `charges (charge_id, period_id, amount_cents, charged_at)`, `refunds (refund_id, charge_id, amount_cents, refunded_at, reason)`. Annual revenue recognised per month: a derived `revenue_schedule (charge_id, month, amount_cents)` spreading the charge evenly (remainder cents to a stated month), reversed for unused months on refund.
- **Benefit decisions.** `benefit_decisions (order_id, decision_seq, is_of_record, decided_at, period_id NULL, plan_version, store_eligible, subtotal_before_promotions_cents, min_subtotal_cents, applied bool, reason, delivery_fee_waived_cents, service_fee_discount_cents)`. An edited order writes a new decision and marks it the one of record; reports read only `is_of_record`.
- **Queries.** Members on date D by state: periods containing D's chosen instant (end of day in a stated zone), grouped by kind. Benefit cost per member-month: Σ waived fees of decisions of record by month ÷ member-months; revenue from the revenue schedule. "Why not O": the decision of record, its inputs and reason (below {{min_subtotal}}, store not eligible, no period in force).
- **Time.** Boundaries in UTC instants; the member's local day defines trial end and renewal day; trial end = local start date + {{trial_days}} days at the local end of day, converted to UTC.

**Competing designs to accept.** An event-sourced membership with periods as a projection. Storing state transitions only, with periods derived by window functions. Daily membership snapshots for reporting, if the candidate shows how late refunds and corrections restate them.

**Bottlenecks and failure modes.** A status column with an expiry date; cancellations that cut benefits immediately; benefit decided from a recomputed subtotal later; summing every decision per order; annual revenue booked in one month; trial ends in UTC days; monthly price changes applied mid-period; analytics on individual members' order history.

**Incident guidance.**
- *Renewals failed during a provider outage*: a failed attempt must open a grace period, not end the membership. Reopen the memberships with grace periods back-dated to the failure, refund or credit the delivery fees charged in error, retry the payments, and add an alert on the failure rate of renewals.
- *Benefit cost doubled after order edits*: more than one decision was summed. Mark one decision of record per order (the last before fulfilment), restate the week from decisions of record, and add a uniqueness check on `(order_id) WHERE is_of_record`.
- *Trials charged a day early*: the trial end used UTC days. Compute trial ends from the member's local date, refund the early charges for the affected members, and test trials started near local midnight in several zones.

**Follow-up guidance.** (1) Periods containing the instant, by kind; paused counted apart. (2) The current monthly period ends now (or at its end, per this exercise's rule); a new annual period starts; the unused part of the month is credited against the annual charge with a recorded proration. (3) The existing member's next period uses the new plan version; revenue changes from that month. (4) The decision of record with its inputs and reason. (5) Monthly aggregates from decisions of record and the revenue schedule; a late refund restates the revenue schedule rows for unused months only.

**Rubric anchors.** 2: a member table with status and expiry; benefits inferred later from fees. 3: plans with versions, periods with states, charges and refunds, a benefit decision per order with inputs. 4: also one decision of record with edits, revenue spread across months, local-time trials and renewals, grace handling, and incidents repaired by correcting periods and decisions.

**Strong signals.** Separates relationship, periods and money; makes benefit decisions reproducible. **Red flags.** Recomputing past benefits from today's rules; cutting benefits at cancellation time; floating-point money.

## DSH-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH days AS (
  SELECT s.store_id, d::date AS on_date
  FROM stores s
  CROSS JOIN generate_series(DATE '{{first_day}}' - 1, DATE '{{last_day}}', INTERVAL '1 day') AS d
), listed AS (
  SELECT dy.store_id, dy.on_date, h.open_time, h.close_time
  FROM days dy
  JOIN holiday_hours h ON h.store_id = dy.store_id AND h.holiday_date = dy.on_date
  WHERE h.open_time IS NOT NULL
  UNION ALL
  SELECT dy.store_id, dy.on_date, w.open_time, w.close_time
  FROM days dy
  JOIN weekly_hours w ON w.store_id = dy.store_id AND w.iso_weekday = EXTRACT(ISODOW FROM dy.on_date)
  WHERE NOT EXISTS (SELECT 1 FROM holiday_hours h
                    WHERE h.store_id = dy.store_id AND h.holiday_date = dy.on_date)
), open_iv AS (
  SELECT store_id,
         on_date + open_time AS opens_at,
         CASE WHEN close_time > open_time THEN on_date + close_time
              ELSE (on_date + 1) + close_time END AS closes_at
  FROM listed
), pz AS (
  SELECT store_id, paused_at,
         COALESCE(resumed_at, TIMESTAMP '{{sample_end}}') AS resumed_at
  FROM pauses
), weeks AS (
  SELECT s.store_id, w::date AS week_start
  FROM stores s
  CROSS JOIN generate_series(DATE '{{first_day}}', DATE '{{last_day}}', INTERVAL '7 days') AS w
), flagged AS (
  SELECT o.store_id,
         date_trunc('week', o.accepted_at)::date AS week_start,
         EXISTS (SELECT 1 FROM pz p
                 WHERE p.store_id = o.store_id
                   AND p.paused_at <= o.accepted_at AND o.accepted_at < p.resumed_at) AS paused,
         NOT EXISTS (SELECT 1 FROM open_iv v
                     WHERE v.store_id = o.store_id
                       AND v.opens_at <= o.accepted_at AND o.accepted_at < v.closes_at) AS outside
  FROM orders o
), order_counts AS (
  SELECT store_id, week_start,
         COUNT(*) AS orders_accepted,
         COUNT(*) FILTER (WHERE paused OR outside) AS orders_while_closed,
         COUNT(*) FILTER (WHERE paused) AS orders_while_paused
  FROM flagged
  GROUP BY store_id, week_start
), pieces AS (
  SELECT wk.store_id, wk.week_start,
         GREATEST(p.paused_at, v.opens_at, wk.week_start::timestamp) AS piece_start,
         LEAST(p.resumed_at, v.closes_at, wk.week_start::timestamp + INTERVAL '7 days') AS piece_end
  FROM weeks wk
  JOIN pz p ON p.store_id = wk.store_id
  JOIN open_iv v ON v.store_id = wk.store_id
), paused_minutes AS (
  SELECT store_id, week_start,
         SUM(EXTRACT(EPOCH FROM piece_end - piece_start)) / 60 AS minutes_paused
  FROM pieces
  WHERE piece_end > piece_start
  GROUP BY store_id, week_start
)
SELECT wk.store_id,
       wk.week_start,
       COALESCE(c.orders_accepted, 0) AS orders_accepted,
       COALESCE(c.orders_while_closed, 0) AS orders_while_closed,
       COALESCE(c.orders_while_paused, 0) AS orders_while_paused,
       COALESCE(m.minutes_paused, 0)::int AS minutes_paused
FROM weeks wk
LEFT JOIN order_counts c ON c.store_id = wk.store_id AND c.week_start = wk.week_start
LEFT JOIN paused_minutes m ON m.store_id = wk.store_id AND m.week_start = wk.week_start
ORDER BY wk.store_id, wk.week_start;
```

**Explanation.** The query first turns the hours into real intervals: one row per store and date from the day before the sample through the last day, joined to the date's holiday rows when there are any (NULL rows mean closed, so they produce no interval) and otherwise to the weekly rows for that ISO weekday. `date + time` gives a timestamp, and when `close_time` is earlier than `open_time` the close moves to the next date, so an interval stays with the date it opened on and still covers the early hours of a holiday or of the first day. Pauses get an end of `{{sample_end}}` when `resumed_at` is NULL. Each order is then flagged with two half-open tests, and one `COUNT(*) FILTER (WHERE paused OR outside)` counts an order that is both only once. Paused minutes are the positive pieces of a three-way intersection (pause ∩ listed interval ∩ week); because a store's intervals and pauses never overlap among themselves, the pieces never overlap and their sum is exact. The final select starts from every store crossed with every week, so store-weeks with no orders keep a row.

**Complexity.** Intervals: stores × (days + 1) × intervals per day. Order flags are two correlated lookups per order, served by indexes on `(store_id, opens_at)` and `(store_id, paused_at)`. The minutes join is pauses × intervals × weeks per store, filtered to positive pieces; in production a range join (`tsrange &&` with a GiST index) or a pre-built per-store interval table keeps it near linear. At hundreds of thousands of stores, the derived intervals are materialised (DSH-L3-02) rather than generated per run.

**Dialect notes.** `generate_series` over dates, `date + time`, `date + integer`, `EXTRACT(ISODOW …)` and `FILTER (WHERE …)` are PostgreSQL. BigQuery: `UNNEST(GENERATE_DATE_ARRAY(…))`, `DATETIME(date, time)`, `EXTRACT(DAYOFWEEK …)` (1 = Sunday, so remap), `COUNTIF`, `DATETIME_DIFF(…, MINUTE)`, `DATE_TRUNC(d, WEEK(MONDAY))`. Snowflake: a row generator or calendar table, `TIMESTAMP_NTZ_FROM_PARTS(date, time)`, `DAYOFWEEKISO`, `COUNT_IF`, `DATEDIFF('minute', …)`; `DATE_TRUNC('week', …)` follows the `WEEK_START` parameter. Spark SQL: `explode(sequence(…))`, `make_timestamp` or string concatenation, `dayofweek` (1 = Sunday), `count_if`. MySQL 8: a recursive CTE or calendar table, `TIMESTAMP(date, time)`, `WEEKDAY()` (0 = Monday), `SUM(CASE …)`, `TIMESTAMPDIFF(MINUTE, …)`. PostgreSQL's `GREATEST`/`LEAST` ignore NULL arguments, while in MySQL, Snowflake and BigQuery a single NULL argument makes the result NULL; replacing a NULL `resumed_at` first keeps the query portable. None of these variants is executed here.

**Edge cases built into the data.** Orders exactly at an `open_time` (open) and exactly at a `close_time` (closed); orders exactly at `paused_at` (paused) and exactly at `resumed_at` (not paused); a pause that runs past closing with an order inside it after closing (paused and outside, counted once) and paused minutes counted only up to closing; a holiday closed all day with an order at a time the weekly hours would have been open; a holiday with short hours; a weekday with no rows; one store-week with no orders. Hard adds split lunch and dinner hours with an order between them, a late-night store whose hours cross midnight, an order in the first minutes of the sample served by the previous evening's interval, a pause across the Sunday–Monday week boundary, and a pause that starts before opening. Very Hard adds the late store closed for a holiday while the previous evening's hours still run into it (with an order there), holiday hours that themselves cross midnight, a pause that began before the sample, and a pause with no `resumed_at` at the end of the sample.

**Common mistakes.** Starting from orders (store-weeks with no orders vanish); `BETWEEN` or `<=` at `close_time` or `resumed_at`; adding holiday hours to the weekly hours instead of replacing them; cutting intervals at midnight; generating dates from `first_day` instead of the day before; applying a holiday to the previous night's late shift; counting paused minutes outside listed hours; giving a pause's minutes to the week it started in; summing `paused` and `outside` flags; dropping pauses with NULL `resumed_at` (or ending them at `now()`, which makes a historical report change on every rerun). Each of these except `now()` has a diagnostic.

**Follow-up guidance.** (1) Store an IANA time zone per store, keep hours as local wall-clock times, convert each derived interval to `timestamptz` with `AT TIME ZONE`; minutes are elapsed minutes between instants, so the fall-back night's late shift is an hour longer (state that rule). (2) Overlapping pauses double count minutes and orders stay correct (EXISTS); merge pauses per store first (gaps-and-islands with a running max of ends) or compute minutes against the union. (3) Assign one cause by a stated precedence (paused, then holiday closure, then outside weekly hours) and report the overlap separately if needed. (4) Materialise per-store open intervals as `tsrange` rows for a rolling horizon, invalidated by hours edits, holiday entries and time zone changes; pauses are already intervals; the weekly report then joins three range tables.

**Rubric anchors.** 2: hours compared as times of day only (no dates), midnight crossing or holidays ignored, rows only for store-weeks with orders. 3: matches the expected result. 4: also explains time zones and daylight saving, overlapping pauses, cause attribution and materialisation of intervals.

**Strong signals.** Builds intervals per date before touching orders; asks about midnight and the day before the sample; states half-open boundaries. **Red flags.** Comparing `accepted_at::time BETWEEN open_time AND close_time`; `now()` in a historical report; counting an order twice.

**Incident guidance.**
- *A third of a late store's orders outside hours*: intervals were cut at midnight. Fix the close to move to the next date, rerun the affected weeks, and add a test with an order at 00:30 for a store open past midnight.
- *Previous night's late orders flagged on a holiday*: holiday rows were applied by calendar time rather than by the date an interval opens. Apply overrides only to intervals that open on the holiday date, rerun, and tell the affected merchants that the earlier numbers were wrong.
- *Thousands of paused minutes from open pauses*: automatic pauses never ended. Keep counting to the end of the period (the rule), but flag pauses open longer than a threshold, close the stuck ones at the device's reconnection time, and restate the weeks once corrected.
