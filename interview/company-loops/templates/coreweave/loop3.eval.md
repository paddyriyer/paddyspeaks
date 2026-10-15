# CoreWeave · Loop 3 — evaluator notes

Simulated practice scenarios; every contract, price, capacity, power figure and
volume is hypothetical and "this exercise's rule; check current docs". Score
designs on the criteria, not on matching the reference.

## CRW-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity.** `contracts (contract_id, customer_id, currency, signed_on)` and `contract_lines (line_id, contract_id, gpu_type, region, line_kind committed|burst_rate)`. A line's GPU type and region never change; a region move ends GPUs on one line and starts them on another (a new line, or a step to 0 on the old line and a step up on the new one).
- **Versions.** `amendments (contract_id, amendment_no, signed_on, kind original|amendment|renewal, supersedes_amendment_no)`, immutable once signed. Each amendment restates the full terms of the lines it touches (simplest to query) or stores only changes and a resolver composes them (smaller, harder to query). Restating is the recommended default at {{active_contracts}} contracts and about {{amendments_per_year}} amendments a year: the volume is trivial.
- **Terms.** `ramp_steps (contract_id, amendment_no, line_id, effective_date, committed_gpus)` and `line_prices (contract_id, amendment_no, line_id, effective_month, price_minor_per_gpu_hour, currency)`. `term_start`, `term_end` per line per amendment.
- **Two time axes.** Valid time is the step's `effective_date` (when it commits GPUs); knowledge time is the amendment's `signed_on`. "As the contracts stand today" uses each contract's latest amendment for every day. "As it stood on date K" first keeps amendments with `signed_on ≤ K`, takes the latest of those, then reads its steps. A back-dated step is visible only in views whose knowledge date is on or after the signing.
- **Reservations.** `capacity_reservations (reservation_id, line_id, zone, gpu_type, gpus, held_from, held_to, state)` with history. Commitment is demand; reservation is supply held for it. Reconciliation view: for each line and day, committed GPUs versus GPUs held, listing lines held below commitment.
- **Derived daily fact.** `fct_committed_daily (as_known_on, contract_id, line_id, day, gpu_type, region, committed_gpus, price_minor)`, rebuilt for a contract whenever an amendment is signed. Usually materialised only for "current" knowledge plus month-end snapshots that invoices reference (`as_known_on` = invoice date); other knowledge dates are computed on demand.
- **Size estimate.** {{active_contracts}} contracts × a few lines × 365 days × {{term_years}} years is tens of thousands to tens of millions of rows: easily materialised; amendments are rare, so rebuild per contract on signing.
- **Access.** Customer-facing views filter by customer_id; reservations' zones may be hidden from customers.

**Competing designs to accept.** Bitemporal rows on the steps themselves (`valid_from/valid_to` plus `recorded_from/recorded_to`) instead of amendment versions, if both axes are queried correctly. Storing amendments as change sets with a resolver, if the candidate shows how "as it stood on K" is computed and tested. A document per amendment plus a relational projection for analytics, if the projection is the queried source and is validated.

**Bottlenecks and failure modes.** In-place edits destroy what was invoiced; one validity range used for both axes makes back-dated steps ambiguous; renewals double counted in overlap months; reservations conflated with commitments so supply looks like demand; float prices drifting on invoices; region moves modelled as edits to the line's region.

**Incident guidance.**
- *Ramp step edited in place*: restore the original step from backups or the change log, re-enter the change as an amendment with its signing date, rebuild the daily fact, and confirm the invoice reproduces from the "as known on invoice date" view. Guard: steps are insert-only (no UPDATE grant), and a test reproduces each issued invoice's committed quantities from the model.
- *Renewal loaded as a new contract*: identify contracts with the same customer, line kind, type and region whose terms overlap; link the new contract as a renewal (or convert to an amendment), and rebuild the forecast. Guard: a uniqueness check that a customer's committed GPUs on a line key never come from two active contracts for the same day unless explicitly additive, plus a reconciliation of committed totals before and after each load. At about {{amendments_per_year}} amendments per contract a year, such loads are frequent enough to need the check on every run.
- *Reservations still pointing at the old zone*: the move was recorded on one side only. Treat reservation moves as events that close the old interval and open the new, re-run the held-versus-committed reconciliation, and add an alert when a line's held GPUs drop to zero while its commitment stays.

**Follow-up guidance.** (1) Same query, different amendment filter: latest overall versus latest with `signed_on ≤ K`. (2) Old line steps down by 64 in month 7, new line steps up by 64 on the same day; totals for the customer unchanged, regional totals move. (3) Current-knowledge reports change; reports as known on earlier dates and issued invoices do not; any credit or re-bill is a new document referencing both versions. (4) Rows ≈ contracts × lines × days; materialise current plus invoice-date snapshots; rebuild per contract on each new amendment.

**Rubric anchors.** 2: a contracts table updated in place, one row per line with current GPUs. 3: immutable amendments with restated steps and prices, effective dates, reservations separate, a daily derived table. 4: also knowledge time handled explicitly (as it stood on K), region moves and renewals without double counting, held-versus-committed reconciliation, and crisp incident handling.

**Strong signals.** Asks "as of which knowledge date?" before drawing tables; separates demand (commitment) from supply (reservation). **Red flags.** Editing steps in place; prices in floating point; a single "GPUs" column on the contract.

## CRW-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Declared state.** `clusters (cluster_id, customer_id, region, created_at, deleted_at)`, `node_pools (pool_id, cluster_id, created_at, deleted_at)` and `node_pool_versions (pool_id, version, instance_type, gpu_type, target_count, labels, effective_at)`, each change a new version.
- **Observed state.** `nodes (node_id, pool_id, cluster_id, instance_type, gpu_type, gpus, replaces_node_id NULL)` with node ids never reused (hostnames are attributes, not keys), and `node_events (event_id, node_id, state requested|provisioning|ready|draining|released|failed_health_check, source, source_time, received_at)`, append-only and deduplicated by event_id.
- **Derived intervals.** `node_state_intervals (node_id, state, from_ts, to_ts)` computed by ordering events by source_time (ties by a state rank), recomputed for a node when a late event arrives. Current state is the open interval. A transition that is impossible (ready with no provisioning) is accepted and flagged, not dropped.
- **Attribution.** `node_attribution (node_id, basis reservation|on_demand, reservation_id NULL, from_ts, to_ts)`, produced by an attribution step that walks ready (and draining) intervals in time order and assigns each node to the oldest reservation of its GPU type and region with room; an end of reservation closes intervals at that instant and reassigns. Invariant: for any instant, Σ gpus attributed to a reservation ≤ its GPUs.
- **Facts.** Ready nodes per pool per minute (or interval-based with a point-in-time query); time to ready per node (requested → first ready); declared-versus-ready gap per pool per minute from versions and intervals; node-hours by customer, day and basis from attribution intervals clipped to the day.
- **Volume.** At {{lifecycle_events}} events a day the event table is modest; intervals are fewer still. Point-in-time queries use interval tables partitioned by day with (pool_id, from_ts) ordering, or a per-minute ready-count rollup per pool for the console.
- **Access.** Every table carries customer_id; customer views filter by it.

**Competing designs to accept.** A state-machine table with SCD type 2 rows per node (equivalent to intervals) if built from source time. Event sourcing with projections. Attribution computed at query time instead of materialised, if the candidate shows billing reproducibility (a materialised, versioned attribution is easier to audit).

**Bottlenecks and failure modes.** Arrival-order state; hostname as identity; one reservation column per node; gap measures that count nodes provisioning for an old target; reservations over-attributed when nodes overlap during replacement; minute-level rollups at {{clusters}} clusters if built naively.

**Incident guidance.**
- *Replacement with the same hostname*: node-hours keyed by hostname merged two nodes' intervals and counted overlap twice. Re-key by node id, rebuild intervals and attribution for affected days, re-issue usage exports, and add a check that no hostname has two open ready intervals unless they are distinct node ids. At about {{replacement_share}} of nodes replaced weekly, sample-test exports against intervals every day.
- *Late source, arrival-order state*: rebuild state from source_time ordering; for the console, show "last event received" alongside state, and alert when one source's received_at − source_time lag exceeds a threshold. At {{lifecycle_events}} events a day, re-deriving intervals per node on each late event is cheap.
- *Reservation ended, hourly attribution*: attribution must close intervals at the reservation's end instant, not at the next run. Re-run attribution for the window, move the hour to on demand (or to another reservation), and add a test that no attribution interval extends past its reservation's end.

**Follow-up guidance.** (1) One node row, six to seven events, three to four state intervals, one or two attribution intervals, plus a replacement node row whose `replaces_node_id` points back. (2) Order by source_time; derived state corrects itself when the earlier event arrives; the console may show a transient state labelled with event time. (3) Attribution intervals split at midnight; node-hours for the day split into reservation and on-demand parts. (4) Events and intervals at full grain for the billing retention period; per-minute pool rollups for recent weeks; point-in-time queries via interval tables.

**Rubric anchors.** 2: a nodes table with a status column and a reservation column. 3: versioned pool settings, immutable events, derived intervals by source time, replacements as new nodes, attribution intervals. 4: also the capacity invariant on attribution, reservation-end splitting, declared-versus-ready gap defined, and crisp incident handling.

**Strong signals.** Separates desired from observed state unprompted; asks which clock orders events. **Red flags.** Updating state in place; hostnames as keys; billing node-hours from the current reservation column.

## CRW-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Hierarchy with history.** `regions`, `zones (zone_id, region_id)`, `data_centres (dc_id, tenure owned|leased)`, `dc_zone_membership (dc_id, zone_id, valid_from, valid_to)`, `halls (hall_id, dc_id, valid_from, valid_to)`, `rack_positions (position_id, hall_id, label, power_limit_kw, cooling_type, valid_from, valid_to)`. Re-numbering closes old positions and opens new ones with a mapping table `position_renumbering (old_position_id, new_position_id, at)`.
- **Power.** `power_contracts (contract_id, hall_id, contracted_kw)` and `power_phases (contract_id, phase_no, kw, planned_energised_on, actual_energised_on NULL)`, with plan revisions kept as versions (`phase_plan_versions`) so "what we planned on date K" reproduces. Energised power on date d = Σ phases with actual ≤ d.
- **Racks.** `racks (rack_id, node_type, gpus_per_node, nodes, rated_kw)` and `rack_placement (rack_id, position_id, from_ts, to_ts)`; `rack_state_intervals (rack_id, state planned|delivered|installed|burned_in|sellable|held|spare|out_of_service, from_ts, to_ts)`.
- **Spares.** Either designated spare racks (state `spare`) or a per-hall spare share (default about {{spare_share}}) recorded as a rule version. Both acceptable if stated.
- **Sellable derivation.** Per hall and day: GPUs in racks burned in and not spare or out of service, then capped by power: if Σ rated_kw of those racks exceeds energised kW, only the racks the energised power covers count (order by a stated rule). Held racks are capacity but not free to sell; report both. Roll up by zone and region through the membership valid on that day. "As planned" uses planned dates and planned rack states; "as it stood" uses actuals.
- **Size.** {{halls}} halls × racks per hall (a {{hall_power}} hall at {{rack_power}} per rack holds on the order of a hundred racks) × days: a daily per-rack table is tens of millions of rows a year at the top level; materialise per hall, GPU type and day for sales, and keep rack-level intervals for drill-down.
- **Access.** Customers see region and zone availability only; positions and halls are internal.

**Competing designs to accept.** A graph or adjacency model for the hierarchy if history is kept. Event-sourced rack states. Power modelled per row or per busway rather than per hall, if the candidate states the extra precision is needed.

**Bottlenecks and failure modes.** Contracted power used where energised power belongs; re-numbering duplicating racks; spares counted inconsistently; zone changes rewriting history; capacity stored as a counter patched by corrections; planned and actual dates mixed in one column.

**Incident guidance.**
- *Power phase slipped*: sellable must be capped by energised power, not contracted power of about {{hall_power}}. Recompute the hall's sellable capacity from phases with actual dates, flag commitments that exceed it (racks at about {{rack_power}} each), notify sales with the new date. Guard: a check that sellable kW never exceeds energised kW per hall per day, and planned phase dates versioned so the slip is visible.
- *Re-numbering loaded as new positions*: close the old positions as of the re-numbering instant, map racks across, rebuild sellable capacity for the affected month. Guard: a rack may occupy one position at a time (an exclusion constraint on placement intervals) and a daily check that GPUs per region do not jump without placements.
- *Spare holdback inconsistent*: define spares once (state or rule) and derive every report from the same sellable view; publish the definition alongside both dashboards. A difference of exactly {{spare_share}} between two numbers is a definition bug, not a data bug.

**Follow-up guidance.** (1) Racks in burned-in states on the day, minus spares, capped by energised kW. (2) Planned-view reports for future quarters change; as-it-stood reports for past dates do not; the plan version records the slip. (3) Membership valid on each past day drives the roll-up. (4) Size by halls × days × GPU types for the sales table; rack-level intervals stay for drill-down.

**Rubric anchors.** 2: a capacity number per data centre, updated by hand. 3: hierarchy with validity, phased power, rack state intervals, sellable derived and capped by power. 4: also plan versus actual, spares defined, re-numbering handled, access boundary for location detail, and crisp incident handling.

**Strong signals.** Distinguishes contracted, energised and drawn power; asks how spares are defined. **Red flags.** Sellable capacity as a stored counter; zone membership without history; exposing hall-level detail to customers.

## CRW-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Resources.** `resources (resource_id, customer_id, kind volume|bucket|private_network|public_address, region, created_at)`; identity never reused (an address's resource is the allocation, keyed separately from the IP literal).
- **State intervals.** `volume_states (volume_id, size_bytes, tier, state active|deleted_retained|purged, from_ts, to_ts)`; `bucket_class_bytes (bucket_id, storage_class, bytes, from_ts, to_ts)` derived from change events and reconciled to the daily inventory; `address_allocations (address_ip, customer_id, allocation_id, from_ts, to_ts)` with an exclusion constraint so two allocations of one IP never overlap; `attachments (resource_id, cluster_id, from_ts, to_ts)`.
- **Bucket capture.** Change events keep intra-day shape; the daily inventory is authoritative for the end-of-day total; a reconciliation step writes a correction interval when they differ beyond a tolerance, flagged in the customer export.
- **Units.** Base units: byte-minutes (or byte-hours) and address-minutes. GB-days = byte-minutes ÷ (10^9 × 1440) applied once when invoicing, with one rounding rule. Partial steps under the {{metering_step}} rule: time-weighted, or the maximum size within the step; state the choice.
- **Fact.** `fct_billable_units (customer_id, resource_id, unit, day, quantity_base, source_interval_ids)` built by clipping intervals to the day; each row traceable to the state rows that produced it.
- **Retention.** `deleted_retained` is its own state for {{retention_days}} days; whether it bills is a recorded rule version.
- **Volume.** {{resources}} resources with interval history are small compared with the raw events; keep intervals for the billing retention period and daily facts long term; rebuilding one day touches only intervals overlapping it.

**Competing designs to accept.** Hourly snapshots of every resource if the candidate accepts the coarser billing and shows the sub-hour gap (resizes, short-lived resources). An event-sourced resource ledger with projections. Monthly units computed directly from intervals without a daily fact, if traceability is kept.

**Bottlenecks and failure modes.** Cluster column on the volume; once-a-day snapshots that miss intra-day spikes; float GB math; overlapping address ownership from late events; retention state treated inconsistently; deleted resources disappearing from history.

**Incident guidance.**
- *Two resizes in an hour, billed at the smaller size*: the {{metering_step}} sampling took one value per step. Switch to time-weighted integration over intervals, re-derive the affected days, issue corrections. Guard: a test comparing billed units to the integral of the size history for random volumes.
- *Renamed state broke retention billing*: states are an enumerated, versioned contract between producer and pipeline; unknown states fail the load rather than defaulting. Re-derive the {{retention_days}}-day retention periods for the affected fortnight under the recorded rule and correct invoices.
- *Late release, double-charged address*: the allocation table's exclusion constraint should have rejected the second allocation until the first closed; derive allocation intervals from the authoritative allocator, not from customer events. Reassignment after {{reassign_minutes}} minutes is fine only if the first interval is closed at the release instant. Credit the overlap and alert on any overlap attempt.

**Follow-up guidance.** (1) Three intervals clipped to the day; GB-days as the size-weighted minutes, rounded once. (2) Inventory wins for the daily total; events give intra-day shape; the difference is a correction row visible in the export. (3) Two allocation intervals, disjoint, each customer billed for its own minutes. (4) Intervals at full grain for the billing retention period, daily facts long term; rebuilding a corrected day reads only intervals overlapping it.

**Rubric anchors.** 2: one row per resource with current size and a cluster column; billing from snapshots. 3: state and attachment intervals, units in base units, a daily fact from clipped intervals. 4: also bucket capture reconciliation, exclusive address ownership, retention rule recorded, traceability, and crisp incident handling.

**Strong signals.** Defines units and rounding before tables; treats time-weighted integration as the default. **Red flags.** Floating-point gigabytes; attachments as a column; billing an address from attachment rather than allocation.

## CRW-L3-05

**Reference solution** (PostgreSQL; `{{from_date}}` and `{{to_date}}` are the instance's window)

```sql reference
WITH contract_days AS (
  SELECT c.contract_id, c.gpu_type, g::date AS day
  FROM contracts c
  CROSS JOIN LATERAL generate_series(GREATEST(c.start_date, DATE '{{from_date}}'),
                                     LEAST(c.end_date, DATE '{{to_date}}'),
                                     INTERVAL '1 day') AS g
), committed AS (
  SELECT cd.contract_id, cd.gpu_type, cd.day,
         (SELECT s.committed_gpus
            FROM ramp_steps s
           WHERE s.contract_id = cd.contract_id
             AND s.amendment_no = (SELECT MAX(a.amendment_no)
                                     FROM contract_amendments a
                                    WHERE a.contract_id = cd.contract_id
                                      AND a.signed_on <= cd.day)
             AND s.effective_date <= cd.day
           ORDER BY s.effective_date DESC
           LIMIT 1) AS committed_gpus
  FROM contract_days cd
), daily AS (
  SELECT cm.contract_id, cm.day, cm.committed_gpus,
         COALESCE(SUM(n.gpus), 0) AS ready_gpus
  FROM committed cm
  LEFT JOIN nodes n
    ON n.contract_id = cm.contract_id
   AND n.gpu_type = cm.gpu_type
   AND n.ready_at <= cm.day::timestamptz
   AND (n.released_at IS NULL OR n.released_at > cm.day::timestamptz)
  GROUP BY cm.contract_id, cm.day, cm.committed_gpus
)
SELECT contract_id,
       to_char(day, 'YYYY-MM') AS month,
       SUM(committed_gpus) AS committed_gpu_days,
       SUM(ready_gpus) AS ready_gpu_days,
       SUM(GREATEST(committed_gpus - ready_gpus, 0)) AS shortfall_gpu_days,
       COUNT(*) FILTER (WHERE ready_gpus < committed_gpus) AS short_days
FROM daily
GROUP BY contract_id, to_char(day, 'YYYY-MM')
ORDER BY contract_id, month;
```

**Explanation.** The grain of the question is the contract day, so the query builds it first: each contract's term clipped to the window and expanded with `generate_series` (a calendar, not node rows, so days with nothing ready still count). For each day the commitment is a two-step as-of lookup: the amendment in force (highest `amendment_no` signed on or before the day), then that amendment's latest step on or before the day. Ready GPUs are a point-in-time count at the day's 00:00 UTC, with `ready_at` inclusive and `released_at` exclusive; `ready_at` NULL drops out of the comparison by itself. Nodes are filtered by the contract's GPU type and summed by `gpus`. The shortfall is floored per day before the monthly sum, so over-delivery never offsets a short day. With the session in UTC, `day::timestamptz` is midnight UTC.

**Complexity.** Contract days × (amendment lookup + step lookup + nodes of the contract). Fine for a sample; in production, replace the day × node join with an interval sweep: +gpus on the first midnight a node is ready, −gpus on the first midnight it is not, a running sum per contract and day, and join the commitment from a pre-expanded daily schedule per amendment.

**Dialect notes.** Not executed here. Snowflake: build days with `GENERATOR` or a calendar table; the commitment lookup as `QUALIFY ROW_NUMBER() OVER (PARTITION BY contract_id, day ORDER BY effective_date DESC) = 1` after joining steps of the amendment in force (or `ASOF JOIN`); `COUNT_IF` instead of `FILTER`; `TO_CHAR(day, 'YYYY-MM')`. BigQuery: `UNNEST(GENERATE_DATE_ARRAY(...))`, `ARRAY_AGG(committed_gpus ORDER BY effective_date DESC LIMIT 1)[OFFSET(0)]` for the lookup, `COUNTIF`, `FORMAT_DATE('%Y-%m', day)`. Spark SQL: `explode(sequence(start, end, interval 1 day))`, a window `row_number` for the lookup, `count_if` and `date_format(day, 'yyyy-MM')`. MySQL 8: a recursive CTE for days, correlated subqueries with `LIMIT 1` work, `SUM(CASE …)` instead of `FILTER`, `DATE_FORMAT(day, '%Y-%m')`. `GREATEST`/`LEAST` exist everywhere except that Snowflake and BigQuery return NULL if any argument is NULL.

**Edge cases built into the data.** Contracts that start or end inside the window (days outside the term have no row and no commitment); a node ready at exactly 00:00 (counts that day); a node released at exactly 00:00 (does not); nodes ready mid-day (count from the next day); nodes never ready (`ready_at` NULL), nodes still running (`released_at` NULL); over-delivered days in months that also have short days. Hard adds amendments signed inside the window that drop old later steps and add new ones, one taking effect on its signing day, and a node of another GPU type assigned to a contract. Very Hard adds back-dated steps (effective before signing), contracts with two amendments, and nodes with 4 GPUs as well as 8.

**Common mistakes.** Netting the shortfall over the month; `<` / `>=` at midnight; counting a node ready at any time during the day (`ready_at::date <= day`); counting days after `end_date`; counting nodes of another GPU type; (Hard+) ignoring amendments, mixing steps from several amendments, or treating an amendment as in force only from the day after signing; (Very Hard) applying the latest amendment to every day, and `COUNT(*) * 8` instead of `SUM(gpus)`. Each has a diagnostic. Joining `ramp_steps` to days without picking one step (summing all steps on or before the day) inflates commitment badly.

**Follow-up guidance.** (1) Interval sweep with `+gpus`/`−gpus` deltas at day boundaries and a window `SUM` per contract, or a per-day materialised ready count maintained from node events. (2) GPU-minutes short = ∫ max(committed − ready(t), 0) dt within each day; nodes that become ready late in the day change it most; needs intervals, not a snapshot. (3) Filter amendments by `signed_on ≤` the as-known date (1st) as well as by the day; reproducibility needs amendments immutable and the as-known date recorded with the report. (4) Netting is a commercial term, not a data choice; the data team shows both, the contract owner decides.

**Rubric anchors.** 2: shortfall from monthly totals, or the commitment taken from the latest amendment for every day. 3: matches the expected result. 4: also explains the sweep for scale, minute-level delivery, as-known-on reporting, and why netting is a contract decision.

**Strong signals.** Builds the calendar before touching nodes; asks which amendment is in force on a day before writing the lookup. **Red flags.** Starting from `nodes` (days with nothing ready vanish); `MAX(amendment_no)` per contract with no date filter; summing `committed_gpus` over a join.
