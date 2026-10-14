# Snowflake · Loop 3 — evaluator notes (hidden from candidates)

## SNO-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Default: shared tables with a tenant key, plus dedicated objects for outliers (a hybrid).**
  - `tenants (tenant_id, name, region, tier shared|dedicated, created_at, offboarding_requested_at)`.
  - `tickets (tenant_id, ticket_id, created_at, channel, priority, status, requester_key, assignee_agent_id, …)`, `ticket_events (tenant_id, ticket_id, event_id, event_type, actor, occurred_at)`, `agents (tenant_id, agent_id, team, valid_from, valid_to)`, `surveys (tenant_id, ticket_id, score, responded_at)`. Every key is composite with `tenant_id` first, so no join can cross tenants by accident.
  - Clustering: shared fact tables clustered by (tenant_id, event date); tiny tenants share micro-partitions, the largest tenant's rows fill their own, so its queries prune well. The largest tenant ({{largest_share}} of rows) is the strongest candidate to move to dedicated objects and its own warehouse.
- **Enforcement on every read path.**
  - One row access policy attached to every shared table, mapping the session's context to allowed tenant ids: for the dashboard service, a tenant id set by the service per request (session variable or query tag) and checked against a mapping table of the service's roles; for direct tenant access, a role per tenant (or a share to the tenant's own account with a secure view filtered by the consumer account); for internal analysts, no row access except through aggregated, thresholded views.
  - Dashboards query only secure views over the policy-protected tables, so view definitions and filters cannot be inspected or bypassed.
  - The result cache and the service's own cache key must include the tenant context; exports go through the same views.
- **Custom fields ({{custom_fields}}).** `custom_field_defs (tenant_id, field_id, name, type, status, created_at, retired_at)` and either a typed key-value table `ticket_custom_values (tenant_id, ticket_id, field_id, value_text, value_number, value_date)` or a semi-structured column keyed by field_id (never by display name, so renames are free). For dashboard performance, a per-tenant pivot view or materialisation of the few fields a tenant actually filters on.
- **Deletion.** Shared tables: delete by tenant_id (a large DML job), then time travel and any recovery retention must lapse before the data is gone everywhere; state the window. Dedicated schema or database: drop it, with the same retention caveat. Evidence: a deletion job record with row counts per table and the date recovery copies expire.
- **Residency ({{regions}}).** A separate account (or deployment) per region; tenants live in exactly one; cross-region analytics only on aggregates.
- **Cost attribution.** Compute: per-query credits allocated from warehouse metering by execution time within each warehouse-hour, attributed to the tenant id carried in the query tag; storage: bytes per tenant from table sizes (dedicated) or row-share estimates (shared). Heavy direct-query tenants get their own warehouse, billed to them directly.

**Competing designs to accept.** Pure schema-per-tenant at low tenant counts (hundreds), if they automate migrations with per-tenant version tracking and accept object-count limits and slower onboarding. Database-per-tenant with data sharing to each tenant's own account for the large ones. Pure shared tables with secure views only (no row access policy) if the views are the only grant and the tenant context cannot be forged. Application-side filtering is not acceptable as the only control.

**Bottlenecks and failure modes.** Tenant context passed by a service that can be wrong or forged; caches keyed without tenant; object explosion at {{tenants}} schemas (migrations, grants, metadata); tiny tenants' rows scattered across partitions without tenant clustering; the largest tenant starving others on a shared warehouse; deletion that ignores recovery copies; custom fields keyed by display name.

**Incident guidance.**
- *Cached result served across tenants*: treat as a data exposure. Disable the cache path, identify affected queries from the query log (same query text, different tenant context, cache hit), notify affected tenants. Fix: include tenant context in every cache key and enforce the filter in the database (row access policy) so a cache hit can only return data the policy allowed for that session. Guardrail: an automated test that runs the same dashboard as two tenants and diffs results; at {{tenants}} tenants, sample continuously.
- *Schemas left a column behind after a failed release*: per-schema migration state was not tracked. Record a schema version per tenant, make migrations idempotent and resumable, block a deploy until all schemas report the target version, and roll forward the stragglers. This is a cost of schema-per-tenant worth naming.
- *Largest tenant starving small tenants*: move its direct queries to its own warehouse (or a multi-cluster warehouse with limits), add resource monitors and statement timeouts, and consider moving the tenant to dedicated objects; measure dashboard latency per tenant tier.

**Follow-up guidance.** (1) Policy: if the role is the dashboard service role, allow rows where tenant_id = the per-request context and the mapping table confirms it; if a tenant role, allow its tenant; if an analyst role, deny raw rows. (2) Clustering by (tenant_id, date) prunes both; a tiny tenant reads a few partitions shared with others, the largest reads its own. (3) Shared: delete DML plus waiting out retention; dedicated: drop plus retention; evidence either way. (4) Shared: one ALTER; per-tenant: a migration fan-out with versions and retries. (5) Allocate warehouse-hour credits by tenant-tagged execution time; idle time as a shared overhead line.

**Rubric anchors.** 2: "add a tenant_id column and filter in the app"; no answer for direct access or caches. 3: a policy-enforced shared model or automated per-tenant schemas with clear trade-offs, custom fields designed, deletion and cost attribution addressed. 4: also a hybrid with a promotion rule, residency, cache and export paths, clustering for skew, recovery-copy-aware deletion and crisp incident handling.

**Strong signals.** Enumerates read paths before choosing; treats the service account as a threat. **Red flags.** Isolation by naming convention; one warehouse for everything with no limits; custom fields as new columns on the shared table per tenant request.

## SNO-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing.** `raw_events (event_id, event_type, device_id, user_id, app_version, device_ts, received_ts, event_date (derived from received_ts or a corrected time), payload semi-structured, file_name, file_row, loaded_at, schema_fingerprint)`. Envelope fields are typed at load; the payload stays semi-structured; nothing is rejected at this layer. Clustered by event_date (and event_type if most queries filter on it). Kept for a stated replay period.
- **Typed layer.** For the dozen hot event types, one table each with typed columns extracted by a versioned rule (`extraction_version`), e.g. `workouts (event_id, user_id, device_id, started_at, duration_s, distance_m, calories, app_version, event_date)`. Values that fail typing go to a `rejects` table `(event_id, path, raw_value, expected_type, app_version, rule_version)` and are counted per load; the typed column is NULL with a flag, never silently NULL.
- **Flattened children.** `heart_rate_samples (event_id, idx, offset_s, bpm)` at sample grain, and `workout_laps (event_id, lap_no, …)`; keyed by event id and index so reloads are idempotent.
- **Null versus missing.** Keep a presence flag (or keep JSON nulls in the payload, which the platform can distinguish from absence) for fields where the distinction matters; typed columns document which they mean.
- **Drift.** Each load profiles paths and their types per event type and app version against a registry; new paths are listed (analysts can query them from the raw payload the same day), type changes raise alerts and route values to rejects; promotions of a path to a typed column are reviewed changes with a new extraction version and a backfill.
- **Contract.** A versioned schema per event type, owned by the app team, with compatibility rules (add optional fields freely; never change a type or meaning under the same name; renames are add-new, deprecate-old); old app versions are mapped by app_version.

**Competing designs to accept.** One table per event type created automatically from the registry (if they handle the long tail and cross-type queries). A fully flattened wide table for a small, stable set of types. Schema-on-read only with views over the raw table, at small scale, if they show how they would detect drift and keep pruning on typed columns.

**Bottlenecks and failure modes.** Path expressions on the payload for time filters (no pruning); exploding large arrays for every query; casts that NULL bad values; mixed types under one path reducing the benefit of columnar storage of the semi-structured column; dashboards reading raw paths; device clocks used as the partition date.

**Incident guidance.**
- *`distance` became a string; typed column NULLed it*: contain by flagging the affected app version's rows on dashboards; fix by routing failed casts to rejects with counts and alerting on a reject rate above a threshold per version; parse the new format under a new path or rule version and backfill from raw. Guardrail: a per-version type check in the load.
- *Full scan on a string timestamp*: teach the typed event_date column (clustered) and expose views that filter on it; reject or rewrite dashboards that filter on payload paths. At {{daily_events}} events a day, show the scanned-partition ratio before and after.
- *Renamed field split across versions*: a mapping in the extraction rule coalesces old and new names by app version into one typed column; dashboards read the typed column only; the contract forbids renames without a deprecation period. With {{drift}}, the registry should surface renames as "new path + vanishing path in the same type".

**Follow-up guidance.** (1) {{daily_events}} × 2% × 1,800 samples a day: cluster by event_date and user or device, keep raw samples for a limited period and per-minute aggregates longer. (2) New rule version, rejects for the old parse, backfill from raw, typed column unchanged in meaning. (3) Raw payload path today; promotion to a typed column through a reviewed change. (4) A check that envelope user_id is non-null per app version, compared with the prior version's rate. (5) Wide table: few stable types; per type: hot types; envelope + payload + children: the long tail and drift.

**Rubric anchors.** 2: everything in one semi-structured column queried directly, or everything flattened with failed casts dropped. 3: typed envelope, raw payload kept, typed tables for hot types, children for arrays, drift detection with rejects. 4: also null-versus-missing, versioned extraction with backfill, pruning designed, contract that copes with old clients, and sized estimates.

**Strong signals.** Asks which queries dominate before deciding what to flatten; treats drift as measured data. **Red flags.** "Cast and move on"; partitioning by device clock; no raw retention for replay.

## SNO-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Facts.**
  - `fct_sales_line` (one row per sold line on a receipt): date_key, store_key, product_key, member_key (nullable → "anonymous" member), currency_code, receipt_id, line_no, quantity, gross_minor, discount_minor, net_minor (transaction currency), sold_at.
  - `fct_return_line` (one row per returned line): return date, store_key of the returning store, product_key, quantity, refund_minor, currency, original receipt and line when known (`original_sale_line_id` nullable), `return_type with_receipt|without_receipt`. Alternatively signed rows in one fact with a `line_type`; both are fine if the grain is stated.
  - `fct_line_promotion` (one row per line × promotion): the promotion's own discount on that line from the point-of-sale system, so discount cost by promotion sums exactly; or a bridge with allocation weights summing to 1 per line for sales attribution.
- **Dimensions.** Date; store (type 2: region, format, franchise flag, with `valid_from/valid_to`, plus a type 1 "current region" column for "as is"); product (type 2 for category changes); member; promotion (type, mechanics, start/end); currency.
- **Currency.** Amounts stored in transaction currency minor units; `fx_rates (currency, rate_date, rate_to_group, version, published_at)`; group-currency values computed in a view at the transaction date's latest rate version, or materialised with the rate version recorded so a correction is a targeted recompute.
- **Late stores.** On first sight of an unknown code, insert an inferred store row (code, currency, `is_inferred = true`, placeholder attributes) and load the sales against its surrogate key; when master data arrives (up to {{store_lag_days}} days later), update the inferred row in place (type 1 for the placeholder period) and open type 2 history from then on. Sales never move keys.
- **Net sales definition.** Σ net sales lines in the month − Σ refunds of returns processed in the month (activity basis), in group currency at each transaction's own date rate; returns without receipt counted at the refunded amount; a return-rate view by sale-month cohort is separate.

**Competing designs to accept.** One signed fact for sales and returns with a line-type column. Converting at load if the rate version is stored and a correction triggers a targeted restatement. A single "unknown" member plus a remapping job, if they show the remap updates facts' keys reliably (weaker but acceptable with a reconciliation check).

**Bottlenecks and failure modes.** Grain unstated (receipt versus line); promotion bridges double-counting; currency converted at load without a version; unknown stores mapped to one default member and never remapped; "as is" versus "as was" confusion when stores change region; at {{daily_lines}} lines a day, facts clustered on a key nobody filters on.

**Incident guidance.**
- *Late store's sales stuck on the "unknown" member*: the single default member lost the store code. Remap facts by store code for the affected days (or, better, switch to inferred members keyed by code), restate the region's like-for-like with a note, and add a check that unknown-member sales are zero after {{store_lag_days}} days plus a margin.
- *Promotion discount exceeding receipt discount by 18%*: the bridge repeated the full line discount per promotion. Use per-promotion discount rows from the point-of-sale data (or allocation weights summing to 1), restate the promotion report, and add a reconciliation: Σ discount by promotion = Σ discount on receipts per day.
- *Late rate load*: conversion at load used the stale rate. Recompute group-currency values for the affected date and currency from the corrected rate version, publish a restatement with the delta, and gate loads that need a rate on the rate being present for that date (or convert in a view).

**Follow-up guidance.** (1) As in the definition above, with the treatment of cross-month returns stated. (2) Per-promotion discount rows answer cost; lift needs a baseline and the line counted once (distinct line keys). (3) The inferred member shows the code and "pending registration"; attributes fill in when master data lands; no fact moves. (4) Recompute conversions for that date and currency, or nothing if conversion is a view; reports carry the rate version. (5) Cluster by date (and store for store-level reports); most queries filter by date range and store or region.

**Rubric anchors.** 2: one wide sales table with converted amounts and a promo_id column. 3: stated grains, conformed dimensions with SCD choices, promotions without double-counting, inferred members, currency kept in transaction currency. 4: also "as was" and "as is" queries, reproducible conversion with versions, return linkage including no-receipt returns, and restatement discipline.

**Strong signals.** States both grains first; reaches for inferred members unprompted. **Red flags.** Holding sales until the store exists; summing amounts across currencies; deleting and reloading closed months silently.

## SNO-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Query fact.** `fct_query (query_id, start_time, end_time, warehouse_id, user_id, role_id, team_id (from tag or mapping, with source), fingerprint_id, status, error_class, compilation_ms, queued_provisioning_ms, queued_overload_ms, blocked_ms, execution_ms, bytes_scanned, partitions_scanned, partitions_total, rows_produced, query_tag, loaded_at)`. One row per query id; loaded by MERGE over a window wider than {{history_latency}} plus the longest query, so a running record is updated, never duplicated.
- **Text.** `query_text (query_id, text)` in a restricted schema; `dim_fingerprint (fingerprint_id, normalised_text, first_seen, last_seen)` readable by all. Fingerprint = hash of the text with literals, whitespace, comments and IN-list lengths normalised; collisions between different reports are rare but possible, and parameter-dependent plans share one fingerprint.
- **Warehouse dimension.** Type 2 from a settings-change log or snapshots: size, min/max clusters, scaling policy, auto-suspend seconds, `valid_from/valid_to`; queries join on start_time within validity.
- **Metering and allocation.** `fct_warehouse_metering (warehouse_id, hour, credits)` from the platform; `fct_query_cost (query_id, warehouse_id, hour, allocated_credits)`: each warehouse-hour's credits split across the queries that executed in it by execution time overlapping the hour (weighted by cluster count if multi-cluster), plus an `idle` row per warehouse-hour for the remainder so Σ allocated = metered exactly.
- **Aggregates.** `agg_warehouse_hour (warehouse_id, hour, queries, queued_overload_ms, queued_provisioning_ms, execution_ms, credits)`, `agg_fingerprint_day`, `agg_team_month`. Full grain kept {{retention_days}} days; aggregates for years.

**Competing designs to accept.** Storing raw history rows append-only and deduplicating in a view by latest record per query id (if the view is what everyone reads). Allocation by bytes scanned or by elapsed time, if stated and reconciled. Snapshotting warehouse settings hourly instead of a change log.

**Bottlenecks and failure modes.** Watermarks on end time with delayed history; duplicate rows for running queries; current-size joins; one queued number hiding cold starts; idle credit dropped so chargebacks do not sum to the bill; query text broadly readable; fingerprints that over- or under-merge.

**Incident guidance.**
- *Watermark skipped a day of queries*: the watermark ignored the {{history_latency}} delay. Reload the window with a MERGE (idempotent), restate team spend for the week, and change the load to re-read a lookback window ≥ the delay; add a check that daily query counts per warehouse match the platform's own counts, across {{warehouses}} warehouses.
- *Cost per fingerprint recomputed at the new size*: the warehouse dimension was type 1. Rebuild size history from the change log (or metering, which reflects the size then), recompute last quarter, and issue chargeback corrections as adjustments rather than editing invoices. Guardrail: costs come from metering allocated per hour, never from size × time at current settings.
- *More clusters for a provisioning queue*: the metric mixed provisioning and overload queueing. Split them; provisioning queues point at auto-suspend and warm-up, overload queues at size or clusters; revert the change and monitor both measures.

**Follow-up guidance.** (1) Queued share = Σ queued_overload_ms ÷ Σ (queued_overload_ms + execution_ms) for queries started in the hour; persistent overload with many concurrent small queries argues for more clusters, few long queries spilling argue for a bigger size. (2) 60 minutes of credits: 10/20/30 minutes of execution get 1/6, 2/6, 3/6 of the active share, and the idle 20 minutes are a separate line (or spread proportionally, if stated). (3) Normalise literals, whitespace, comments and IN lists; risks: different reports that differ only in literals merge, dynamic SQL with varying column lists splits. (4) MERGE on query id over [watermark − delay − max duration, now); the watermark is the min of the source's completeness marker and now − delay. (5) {{daily_queries}} × {{retention_days}} rows at full grain, clustered by start date and warehouse; daily aggregates retained longer.

**Rubric anchors.** 2: an append-only copy of history with total elapsed time and current warehouse size. 3: query grain with MERGE, time components separate, type 2 warehouse settings, fingerprints, allocation that reconciles. 4: also both queueing kinds driving different actions, text access control, delay-aware watermarking, idle credit explicit and sized retention.

**Strong signals.** Asks how queueing is broken down; insists allocated credits sum to metering. **Red flags.** Cost = elapsed time × current size; dropping failed queries; everyone can read query text.

## SNO-L3-05

**Reference solution** (PostgreSQL; `{{report_end}}` is the instance's report end)

```sql reference
WITH rs AS (                      -- RESUME and SUSPEND before report_end, with the previous one's type
  SELECT warehouse_name, event_type, occurred_at,
         LAG(event_type) OVER (PARTITION BY warehouse_name ORDER BY occurred_at) AS prev_type
  FROM warehouse_events
  WHERE event_type IN ('RESUME', 'SUSPEND')
    AND occurred_at < TIMESTAMPTZ '{{report_end}}'
), eff AS (                       -- only events that change the state; a warehouse starts suspended
  SELECT warehouse_name, event_type, occurred_at
  FROM rs
  WHERE event_type <> COALESCE(prev_type, 'SUSPEND')
), runs AS (
  SELECT warehouse_name, event_type, occurred_at AS resumed_at,
         COALESCE(LEAD(occurred_at) OVER (PARTITION BY warehouse_name ORDER BY occurred_at),
                  TIMESTAMPTZ '{{report_end}}') AS ended_at
  FROM eff
), billed AS (
  SELECT warehouse_name, resumed_at, ended_at,
         LEAST(GREATEST(ended_at, resumed_at + INTERVAL '60 seconds'),
               TIMESTAMPTZ '{{report_end}}') AS billed_end
  FROM runs
  WHERE event_type = 'RESUME'
), sizes AS (                     -- the size in force from each change until the next
  SELECT warehouse_name, from_at, size,
         LEAD(from_at, 1, TIMESTAMPTZ 'infinity') OVER (PARTITION BY warehouse_name ORDER BY from_at) AS to_at
  FROM (
    SELECT warehouse_name, TIMESTAMPTZ '-infinity' AS from_at, initial_size AS size FROM warehouses
    UNION ALL
    SELECT warehouse_name, occurred_at, size
    FROM warehouse_events
    WHERE event_type = 'RESIZE' AND occurred_at < TIMESTAMPTZ '{{report_end}}'
  ) z
), segs AS (
  SELECT b.warehouse_name,                       -- running time, cut at each resize
         GREATEST(b.resumed_at, s.from_at) AS seg_start,
         LEAST(b.ended_at, s.to_at) AS seg_end, s.size
  FROM billed b
  JOIN sizes s ON s.warehouse_name = b.warehouse_name
              AND s.from_at < b.ended_at AND s.to_at > b.resumed_at
  UNION ALL
  SELECT b.warehouse_name, b.ended_at, b.billed_end, s.size   -- the minimum's padding, at the run's last size
  FROM billed b
  JOIN sizes s ON s.warehouse_name = b.warehouse_name
              AND s.from_at < b.ended_at AND s.to_at >= b.ended_at
  WHERE b.billed_end > b.ended_at
), hourly AS (
  SELECT g.warehouse_name, h.hour_start, ws.credits_per_hour,
         EXTRACT(EPOCH FROM LEAST(g.seg_end, h.hour_start + INTERVAL '1 hour')
                          - GREATEST(g.seg_start, h.hour_start))::BIGINT AS secs
  FROM segs g
  JOIN warehouse_sizes ws ON ws.size = g.size
  CROSS JOIN LATERAL generate_series(date_trunc('hour', g.seg_start),
                                     g.seg_end - INTERVAL '1 microsecond',
                                     INTERVAL '1 hour') AS h(hour_start)
  WHERE g.seg_end > g.seg_start
)
SELECT warehouse_name, hour_start,
       SUM(secs) AS billed_seconds,
       ROUND(SUM(secs * credits_per_hour) / 3600.0, 4) AS credits
FROM hourly
WHERE secs > 0
GROUP BY warehouse_name, hour_start
ORDER BY warehouse_name, hour_start;
```

**Explanation.** The log is a state machine, so it is first reduced to effective transitions: with a warehouse starting suspended, an event changes the state exactly when its type differs from the previous RESUME/SUSPEND (this drops a RESUME while running and a SUSPEND while suspended; at Medium and Hard there are none, so the step is harmless). LEAD then pairs each effective RESUME with its SUSPEND, or with report_end if the run is still open. Each run's billed end is the later of its end and resume + 60 s, capped at report_end, so the minimum is paid per resume and two minimums can overlap. Sizes become intervals (the initial size from −infinity, each RESIZE until the next); running time is intersected with them, and the padding gets the size in force when the run ended (the data never resizes during a padding, so intersecting the padding with size intervals gives the same answer). Finally each segment is cut at hour boundaries with generate_series; seconds × rate are summed as integers and divided and rounded once per row.

**Complexity.** Two window sorts over the events per warehouse, a join of runs to size intervals (each run meets only the intervals it overlaps), and one generated row per hour a segment touches. Incrementally in production: carry each warehouse's open run, current size and last resume time across loads, and recompute only hours touched since the last watermark minus the log's delay.

**Dialect notes.** Snowflake: `TIMEADD`/`DATEADD('second', 60, ts)`, `DATE_TRUNC('HOUR', ts)`, and no `generate_series` over timestamps — split hours with a numbers table (`TABLE(GENERATOR(ROWCOUNT => n))`) or a calendar table of hours joined on overlap; `CONDITIONAL_CHANGE_EVENT` or `LAG` can drop no-op events; `TIMESTAMP_TZ` literals as `'…'::TIMESTAMP_TZ`. BigQuery: `TIMESTAMP_ADD`, `TIMESTAMP_TRUNC(ts, HOUR)`, `GENERATE_TIMESTAMP_ARRAY(start, end, INTERVAL 1 HOUR)` with `UNNEST`; no infinity timestamps, so use far-past/far-future literals. Spark SQL: `sequence(date_trunc('HOUR', s), e, INTERVAL 1 HOUR)` with `explode`, and `unix_timestamp` differences for seconds. MySQL 8: a recursive CTE or an hours table for the split; `TIMESTAMPDIFF(SECOND, a, b)`. In engines where `GREATEST`/`LEAST` return NULL for any NULL argument (Snowflake, BigQuery), the COALESCE to report_end matters. None of these variants is executed here.

**Edge cases built into the data.** A run shorter than 60 s (billed 60 s); a run of exactly 60 s (no padding); two runs whose minimums overlap (both billed); a short run near the end of an hour whose padding spills into the next hour; a run resuming exactly at hh:00:00 and suspending exactly at a later hh:00:00 (nothing in the final hour); runs spanning two or three hours. Hard adds RESIZE events inside long runs, a RESIZE inside a run shorter than the minimum (the padding bills at the new size), and a RESIZE while suspended (the next run starts at that size). Very Hard adds a RESUME while running (inside the first minute, so restarting the minimum changes the bill, and inside a long run), a SUSPEND while suspended, a run open at report_end with its SUSPEND after it, a run resumed seconds before report_end (its minimum is cut at report_end), and a whole run after report_end.

**Common mistakes.** No minimum; merging overlapping minimums into one interval; charging the whole run (or just the padding) to the resume hour; ignoring resizes during runs or while suspended; (Very Hard) treating a duplicate RESUME as a new start; using events after report_end; dropping open runs. Each has a diagnostic. Also common: pairing with `LEAD` over all events (a RESIZE becomes the run's end), rounding per segment, and off-by-one on the hour boundary (`<=` in generate_series end produces a zero-second row, filtered here by `secs > 0`).

**Follow-up guidance.** (1) Differences with metering: runs still open or late SUSPENDs at the cut-off; resize billing (in the real product a resize may bill differently — check current docs); multi-cluster warehouses; cloud-services credits; time zone of the hour buckets; the log's delivery delay and duplicates. (2) padding credits = credits on padding segments per warehouse ÷ total; recommend longer auto-suspend or consolidating probes onto a warehouse that is already running. (3) Runs per cluster: events carry a cluster number, and each cluster's start pays its own minimum; the warehouse's credits are the sum over clusters. (4) Carry state per warehouse (open run's resume time, current size, whether the minimum is already paid); recompute hours from the earliest late event's timestamp; finance reads only hours older than the log's delay.

**Rubric anchors.** 2: right shape but no minimum, or no split at hours, or runs paired by naive LEAD over all events. 3: matches the expected result. 4: also explains the metering differences, how to make it incremental, and the padding-waste query.

**Strong signals.** Builds runs and size intervals as separate steps; asks whether minimums overlap before writing code. **Red flags.** Summing `EXTRACT(EPOCH FROM ended_at - resumed_at)` per run start hour; rounding each run; filtering events by date only, so runs crossing midnight or report_end break.
