# Amazon · Loop 4 — evaluator notes (hidden from candidates)

## AMZ-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Source of truth**: each fulfilment centre's warehouse system is the authority for physical stock and emits stock-change events (`event_id, fc_id, item_id, delta, reason, event_ts`). Centrally, an append-only stock ledger per (item, fc) applies each event once (dedup on `event_id`); on-hand is a projection of the ledger. Reasons (receive, pick, damage, transfer out/in, return to stock, count adjustment) keep every unit change traceable.
- **Available to promise**: `ATP = on_hand − reserved − held_back` per (item, fc), rolled up per region. `held_back` covers safety stock and units in damaged or unsellable states.
- **Reservations (exact path)**: a reservation store keyed by (order_id, line_no) with states `held → confirmed → picked` or `held → released` (cancel, payment failure, expiry after the hold). Creating a reservation is one conditional write: decrement the item's available counter only if it stays ≥ 0, and insert the reservation row, atomically (a transaction in a store that supports it, or a single-item conditional update plus an idempotent reservation record). Retries carry the same (order_id, line_no), so a retried checkout returns the existing reservation instead of taking a second unit.
- **Deal hot key**: the deal's units are pre-split into K allotments (for example 16–64 counters, each with a share of the units) and checkouts pick one at random or by hash, falling through to another when one is empty; a rebalancer moves units from full allotments to empty ones with conditional updates so the total never rises. The sum of allotments plus confirmed and held reservations always equals the deal's units, checked continuously. An alternative is a single-writer actor for the deal item that serialises decrements in memory with a write-ahead log, if the candidate shows it reaches the peak rate and fails over without losing count.
- **Read path (approximate)**: product pages read a cached, regionally replicated availability view (in stock / low / out, and a delivery estimate) refreshed from the ledger projection within seconds. It is allowed to be stale; checkout re-checks against the exact path.
- **Disconnected centres**: the centre keeps its own ledger and buffers events; on reconnection events are applied idempotently by `event_id` in event-time order per (item, fc). Central reservations against a disconnected centre are limited to a conservative share of its last known ATP, or new orders are routed to other centres while it is dark.
- **Reconciliation**: cycle-count adjustments are ledger events. When ATP goes negative after an adjustment, the system re-sources reserved orders to other centres (by promise risk), and only then delays or cancels with notice. A daily job compares ledger on-hand with physical counts and sold units against deal limits.

**Competing designs to accept.** Reservations at region level with assignment to a centre at pick time (more flexibility, more re-sourcing work). A strongly consistent distributed database for the exact path versus a key-value store with conditional writes. A single-writer actor per hot item instead of allotments. Showing "in stock" while units are only reserved, if the candidate explains how often that disappoints at checkout.

**Bottlenecks and failure modes.** Single-row contention on the deal item; retry storms that hold duplicate reservations; expiry processes that stall and hide sellable stock; double application of events after a centre reconnects; cache stampedes on the product page when the deal starts; drift between ledger and shelf found only at count time.

**Incident guidance.**
- *4-second reservation latency and retries*: the hot key and non-idempotent retries are both visible. Make retries idempotent on (order_id, line_no) immediately (or drop duplicate held reservations by that key), shed load with a queue or waiting room in front of the deal item, and switch to allotments or a single writer. Reconcile reservations against placed orders to release the extras.
- *Cycle count short by 1,200*: post the adjustment through the ledger; ATP goes negative; re-source the ~300 promised orders to other centres in order of promise risk; notify customers of any that cannot be re-sourced before the promise slips. Prevention: shrink detection from pick failures ("shelf empty" scans) and targeted counts for high-velocity items.
- *Centre offline for 25 minutes*: while dark, route orders elsewhere or cap them at a conservative share; on return apply its buffered events idempotently in event-time order; compare the merged on-hand with the centre's own ledger and alert on differences.
- *Expiry stalls for an hour*: the deal looks sold out while units are held by expired reservations. Release them (the expiry rule is idempotent), add a monitor on the age of the oldest held reservation, and make expiry checkable at read time (a held reservation past its deadline counts as available) so a stalled job cannot hide stock.

**Follow-up guidance.** Push on what makes the decrement exact under a race; whether the candidate's rebalancer can ever create units; and how they would prove after the event that sold ≤ deal units (sum of confirmed reservations from the ledger).

**Rubric anchors.** 2: one counter in a cache or a locked row, no idempotency, no notion of authority between centre and central. 3: exact reservation path with conditional writes and idempotent keys, cached read path, reservation states with expiry, a hot-key strategy. 4: also allotment rebalancing or a single writer that provably cannot oversell, disconnected-centre merge rules, reconciliation with automatic re-sourcing, and crisp handling of every incident.

**Strong signals.** Asks which number must be exact before designing; treats stock as a ledger of changes. **Red flags.** "Strong consistency everywhere" with no throughput estimate for the deal item; an in-memory counter with no recovery story; retries that take a new unit.

## AMZ-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Ingestion**: scanner devices post batches to a regional endpoint; carrier feeds arrive by webhook or file and pass through per-carrier adapters. Both write raw events, unchanged, to a durable log keyed by `package_id` (so all of a package's events are ordered in one partition), and to raw storage for replay.
- **Normalisation**: an owned mapping table from (carrier, carrier code) to a canonical status (`shipped, in_transit, at_station, out_for_delivery, delivered, attempted, exception, returned, lost`), versioned. Unknown codes map to `unknown` and raise a mapping alert; they never drop the event.
- **Dedup**: on (package_id, canonical status, location, event time rounded to the scanner's resolution) plus the device's own scan id where present; repeated identical scans are kept in raw storage but not in history.
- **State**: a keyed store holding each package's history ordered by event time and a derived current state. Current state is recomputed from the history whenever an event arrives, so a late event slots into place and cannot regress the state (a late "out for delivery" after "delivered" does not change current state). Terminal states can be reopened only by explicit correction events (delivered → recovered).
- **Event time**: use device time, validated against receipt time: a scan more than a tolerance in the future, or before the package was shipped, is flagged and its time is replaced by receipt time (keeping both).
- **Tracking reads**: the keyed state store (or a cache in front of it), with a short, customer-facing status and estimated delivery.
- **At-risk detection**: a stream job compares each package's current position and time with the remaining legs and their typical durations (from history, by lane) against the promise; it emits a risk score, and alerts group by station or lane so operations act on clusters, not on individual packages. Alert budgets per team.
- **Promise-accuracy metric**: per package, on time = delivered (first valid delivered event, not attempted) at or before 23:59:59 of the promised date in the destination's time zone. Denominator: packages with that promised date (or shipped that day; choose and state). Report against both original and latest promise. Late events restate the metric for a bounded window (for example 7 days), after which a day is frozen and later corrections are reported separately. Computed in a batch over the history table, partitioned by promised date.

**Competing designs to accept.** A managed stream with a keyed state store versus a database with per-package rows updated by consumers, if ordering and late events are handled. Restating the metric indefinitely with a "last changed" mark instead of freezing. Measuring against the latest promise only, if the candidate argues it and names what leadership loses.

**Bottlenecks and failure modes.** Out-of-order and duplicate scans; device clocks; carrier feed gaps that look like no movement; code-mapping drift; day boundaries in the wrong time zone; at-risk alerts so numerous they are ignored; hot partitions for large consolidated shipments.

**Incident guidance.**
- *Device clocks a day ahead*: the validation rule (future time beyond tolerance → use receipt time) would have caught it. Re-derive event times for the affected scans from receipt time, restate the metric for the affected days, roll back or fix the app, and add a monitor on the share of scans with device time far from receipt time.
- *Carrier feed stops 9 hours*: monitor per-carrier feed freshness and expected volume; while a feed is down, mark its packages as "no data" rather than "at risk"; on backlog, process in event-time order and suppress alerts for packages whose risk resolved within the backlog.
- *UTC day boundary*: restate the affected days with the destination time zone; add a test with deliveries late in the local day for the westernmost and easternmost zones; record the metric definition with a version.
- *Sort centre outage*: the estimated delivery must react to an event at the facility (all packages there are delayed), not wait for each package's next scan. Push a facility-level delay to the estimate, notify customers proactively, and record a revised promise while keeping the original for accuracy.

**Follow-up guidance.** Ask how the metric behaves when a "delivered" scan arrives a day late, and whether the candidate keeps both device and receipt time. Probe the at-risk model: how they estimate remaining leg time and how they keep alert volume actionable.

**Rubric anchors.** 2: latest-event-wins status table, UTC days, no dedup, metric undefined. 3: ordering by event time per package, normalised codes with ownership, precise local-time metric, at-risk detection, tracking from a keyed store. 4: also device-time validation, a restatement policy with frozen days, feed health monitoring and facility-level delays, alert budgets, and precise incident handling.

**Strong signals.** Defines the metric before the pipeline; asks which timestamp to trust. **Red flags.** Overwriting status with the last event received; counting attempts as deliveries; one alert per late package.

## AMZ-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Ingestion**: each delivery of the month's export is a version identified by its manifest. A loader validates the manifest (file count, row counts, schema version), loads the files into a staging table partitioned by (billing month, version), and swaps the month's current version atomically (a partition overwrite or a pointer in a version table) only after validation. Readers always query the current pointer, so they never see a half-loaded or doubled month. Old versions are kept a few days for comparison.
- **Normalised cost fact**: per line item, hour, account, service, usage type, resource id, with unblended cost, amortised cost (commitment fees spread over the term, plus the effective cost of covered usage), credits and refunds as separate measures. Schema changes in the export are handled by a column mapping with a version.
- **Allocation**: effective-dated dimension of account → team ownership (valid_from, valid_to) and tag → team mappings. A versioned allocation policy (owned by finance) for shared costs: shared clusters by measured consumption (CPU or memory share from cluster metrics), networking and support by proportional spend, untagged spend to the account owner's team. Output: allocated cost per team per day under policy version P, so changing the policy restates explicitly.
- **Serving**: a warehouse with daily aggregates per team, service and account, plus resource-level detail scoped by team through row-level access.
- **Anomaly detection**: per account and service, compare daily (or hourly) amortised cost with a seasonal baseline (day of week, month start) and require both a relative and an absolute threshold; exclude known scheduled charges (commitment fees, support charges, credits) by charge type. Because the export is hours behind, add faster signals for the worst cases: provider budget alerts and usage metrics (instance counts, request rates) that move before cost does.
- **Close**: after the invoice is final, reconcile per account: sum of the final version's unblended cost (and the invoice's own adjustments) equals the invoice; freeze the month; any later change is a new adjustment row in the next month.

**Competing designs to accept.** Re-processing the whole month on each version (simple, and fine at the lower volumes) versus diffing versions. Allocating untagged spend proportionally to tagged spend instead of to the account owner, if the candidate explains the incentive it creates. Running the platform on the provider's managed query service directly over the files instead of a warehouse, with the cost argued.

**Bottlenecks and failure modes.** Appending rewritten files; schema drift in the export; ownership changes recorded late; mixing unblended and amortised cost; anomaly detectors without seasonality; alert latency bounded by export delivery; cost of reprocessing billions of rows several times a day.

**Incident guidance.**
- *Doubled month during load*: readers saw two versions at once. Roll back to the previous version pointer, then load into staging and swap atomically; add a check that month-to-date cost per account between consecutive versions changes within expected bounds.
- *Reorg recorded a week late*: ownership must be effective-dated; correct the mapping with valid_from = the 14th and recompute the month's allocation (it is still open). Prevention: account moves come from the organisation's account-management events, not a hand-edited mapping, and finance reviews a draft with changes highlighted.
- *Commitment fee pages dozens of teams*: chargeback and anomaly detection should use amortised cost, where the fee is spread; exclude fee charge types from the detector; send one notice to the owner of the purchase. Silence the alerts and fix the detector input.
- *Runaway job found 30 hours late*: export latency plus a daily batch exceeds the target. Run detection on each new version (several times a day), add usage-metric and budget-based alerts for faster signal, and add per-account spend guardrails for the riskiest services.

**Follow-up guidance.** Probe whether the candidate understands that a version replaces, not appends; how amortised and unblended costs both tie to the invoice; and whether their anomaly detection can be faster than its input.

**Rubric anchors.** 2: append each file, sum unblended cost by tag, static thresholds. 3: version-aware atomic loads, amortised cost for chargeback, effective-dated ownership, an allocation policy for shared and untagged spend, invoice reconciliation. 4: also seasonal anomaly detection with charge-type exclusions and a faster signal, versioned policies with explicit restatement, costed processing, and crisp handling of every incident.

**Strong signals.** Asks how the export changes over the month before designing ingestion; distinguishes amortised and unblended cost. **Red flags.** Treating the export as an append-only stream; chargeback that does not add up to the invoice; one anomaly threshold for every account.

## AMZ-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Storage**: every feature value is a row `(entity keys, feature_id, feature_version, valid_time, knowledge_time, value)` in a lakehouse table partitioned by feature group and knowledge date, clustered by entity. Corrections append new rows with a later knowledge time; nothing is overwritten. For snapshot-only sources, the platform diffs consecutive snapshots and records changed values with knowledge time = snapshot time.
- **Point-in-time join**: for forecast date D and feature f, take, per entity and valid week, the value with the greatest knowledge_time ≤ D (plus the source's publication lag). Implemented as an as-of join, or by precomputing, per feature group, a "known as of" table at each weekly forecast date (the backtest grid is weekly, so this materialisation is bounded: dates × entities × features).
- **Backfills**: carry an explicit knowledge time policy: either the original publication time if it can be reconstructed, or a declared lag (for example "price known on the day it applied"), labelled as reconstructed; never "today" for history.
- **Feature definitions**: code with a version; a training set, a backtest and the production run each record a manifest (feature ids and versions, forecast dates, code version, data snapshot). A definition change is a new version computed alongside the old; old backtests reproduce from their manifest.
- **Censored demand**: out-of-stock flags (with their own knowledge times) travel with sales; the platform provides an "available to sell" fraction per week so the model or a demand-unconstraining step can treat stock-out weeks as censored, not as zero demand. Missing flags are a data-quality failure, not zeros.
- **Production**: the weekly run uses the same code with D = this week's date; features are materialised by 06:00 with the job graph scheduled backwards from that deadline. A parity check recomputes a sample of production features through the backtest path and compares.
- **Cost**: series × features × weeks of history × corrections; precompute only the weekly grid and the features actually used; compress and tier old knowledge versions; most series are long-tail and small.

**Competing designs to accept.** A commercial or open-source feature store with point-in-time retrieval, if the candidate checks its knowledge-time semantics. Precomputed weekly snapshots of the full feature table (simpler, more storage) instead of as-of joins. Treating censoring inside the model instead of the platform, as long as the platform supplies the flags.

**Bottlenecks and failure modes.** Leakage from final values of revisable sources; backfills with wrong knowledge times; skew on best-selling items in joins; drift between production and backtest code paths; missing out-of-stock flags read as zero demand; storage growth from keeping every correction.

**Incident guidance.**
- *18% backtest win from future promotions*: the promotion feature lacked knowledge time (it read the latest calendar). Invalidate the backtest, rebuild the promotion history with knowledge times from the calendar's change log, and re-run; add a leakage test: shift every feature's knowledge time by +1 week and confirm the backtest gets worse, never better, and a check that no joined value has knowledge time after D.
- *Backfill dated today*: correct the knowledge time policy for the backfill and reload; list every backtest run since the backfill from manifests, re-run them, and revisit the two approvals. Prevention: backfills require a declared knowledge-time policy, and a monitor flags features whose history became empty for past dates.
- *Production build misses 06:00*: salt or separately process the hot items, broadcast small dimension tables, materialise incrementally (only this week's new knowledge), and alert on the critical path well before the deadline.
- *Missing out-of-stock flags*: a completeness check per region and week should have stopped the run; re-run with flags restored, and treat missing flags as unknown (and exclude those weeks) rather than as in-stock.

**Follow-up guidance.** Have the candidate write the as-of predicate; ask what knowledge time they give a backfill; ask how they would prove there is no leakage. Strong answers propose a leakage test, not just a design.

**Rubric anchors.** 2: one latest-value feature table joined on date; backfills overwrite. 3: bitemporal storage, as-of joins, versioned definitions shared by all paths, explicit censoring. 4: also deliberate backfill policy, manifests for reproducibility, a leakage test, skew-aware precomputation with costs, parity checks, and precise incident handling.

**Strong signals.** Separates valid time and knowledge time without prompting; asks about publication lag. **Red flags.** "Just use the snapshot from that date" with no snapshots kept; online stores for a weekly batch with no reason; zero sales treated as zero demand.

## AMZ-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Cells**: the region is divided into cells, each a full copy of the stack (front door, ingestion, storage, evaluator) serving a subset of tenants. A thin routing layer maps a tenant to its cell. A cell's failure, or a tenant's misbehaviour, affects only that cell's tenants. Large tenants can be placed in their own cell or spread by namespace.
- **Front door**: authenticates, validates (timestamp within an allowed window into the past and a small tolerance into the future; dimension count and lengths), and enforces per-tenant limits: datapoints per second (token bucket) and new series per hour (counting first-seen series identities). Over-limit requests are throttled with a clear error, not silently dropped.
- **Ingestion**: datapoints are written to a durable log partitioned by series id (hash of tenant, namespace, name, dimensions). Aggregators consume it and keep, per series and period, a statistic set: count, sum, min, max and a mergeable sketch for percentiles. Dedup on datapoint identity (series + timestamp + batch or request id) over a short window makes retries safe for sums and counts.
- **Storage**: a hot time-series store with the finest resolution for hours to days; rollups (1 minute, 5 minutes, 1 hour) computed by merging statistic sets, kept for months; older data at coarser resolution only. Queries choose the finest tier that covers the range.
- **Evaluator**: alarms are sharded across evaluator hosts by alarm id within a cell. Each alarm has a schedule: period end + lateness allowance (for example a fraction of a period, bounded). Evaluations are spread across the period's allowance window (jitter) rather than all at the boundary. The evaluator reads the alarm's series' statistic sets for the last N periods, applies the missing-data rule, computes the M-of-N state, and only on a state change writes the new state and enqueues an action with an idempotency key (alarm id, state-change sequence), so a retried action is delivered once.
- **Self-protection**: when the cell's ingestion is delayed beyond the allowance, the evaluator knows (it tracks the ingestion watermark) and holds evaluation or treats the periods as "insufficient data" rather than "missing" so that "missing treated as breaching" alarms do not fire because of the service's own delay.
- **Billing**: series counts and alarm counts are computed from the series registry and alarm store per tenant, exactly.

**Competing designs to accept.** Push-based evaluation triggered by datapoint arrival versus scheduled evaluation, if the candidate handles periods with no data. Storing raw datapoints for a short window alongside statistic sets. Shuffle sharding of tenants across shared resources instead of strict cells, if the blast radius is argued.

**Bottlenecks and failure modes.** Series-count explosions from high-cardinality dimensions; thundering herds at period boundaries; percentiles averaged across hosts; false alarms caused by the service's own lag; future-dated datapoints landing in periods not yet evaluated; tenant migrations that double-fire actions.

**Incident guidance.**
- *Request-id dimension*: the per-tenant new-series limit would have throttled it at the front door; enforce it now (throttle that tenant's new series), protect the cell, and tell the customer which metric and dimension caused it. Prevention: limits on new series per tenant per hour and visibility of the tenant's series growth.
- *Ingestion 3 minutes behind*: evaluation must be aware of the ingestion watermark; do not evaluate periods whose data is not yet complete, or mark them as late rather than missing. Undo where possible (customers' scaling actions cannot be recalled, so communicate), and add the watermark check before the next incident.
- *Regional event overload*: evaluation has priority over graph queries in each cell; throttle queries first, add capacity, and evaluate the backlog oldest first, telling customers which alarms were evaluated late. Prevention: load tests at regional-event rates, headroom per cell, and query admission control.
- *Future timestamps*: reject or clamp datapoints beyond the future tolerance at the front door and return an error; the customer learns their clocks are wrong instead of getting confusing alarms.

**Follow-up guidance.** Probe cells versus a shared cluster; how the evaluator knows data is complete; and how a tenant migration avoids a double action (state carried with a sequence number, a cut-over point where the old cell stops evaluating before the new one starts).

**Rubric anchors.** 2: one shared database queried by a cron every minute, raw points only, percentiles averaged. 3: per-tenant limits, partitioned ingestion with statistic sets and sketches, tiered rollups, sharded evaluator with lateness allowance and action-on-state-change. 4: also cell isolation with tenant placement and migration, watermark-aware evaluation that protects customers from the service's own lag, idempotent actions, and crisp handling of every incident.

**Strong signals.** Asks how alarms treat missing data before designing the evaluator; mentions blast radius. **Red flags.** Storing every raw point forever; no per-tenant limits; firing actions on every evaluation rather than on state changes.
