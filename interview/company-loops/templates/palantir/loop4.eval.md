# Palantir · Loop 4 — evaluator notes (hidden from candidates)

These are simulated, commercial scenarios. Score the design on the criteria
below, not on whether it resembles any vendor's product. Access restrictions
are this exercise's model; do not reward or require claims about how any
company's products enforce them.

## PLT-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Dataset sync**: every backing dataset version is a unit of change. For an incremental (append or change) build, read the change rows directly. For a full snapshot, diff the new version against the last indexed one by primary key and a hash of the indexed columns, producing upserts and deletes; for very large types, partition the diff by key hash so it runs in parallel and only touches changed partitions. Each change is written to a per-object-type changelog (`object_type, pk, property values, dataset_version, observed_at`), where `observed_at` is when the sync saw the property change. That recorded time is the "source change" time in the merge rule: build time alone re-dates unchanged values every build, and a timestamp column in the data may be missing, late or in another clock.
- **Edits store**: a durable, transactional store keyed by `(object_type, pk, property)` holding the edited value, `edited_at`, the action id and the user. It is the system of record for edits and is never rebuilt from the index. An action writes here first (synchronously), then publishes an edit event.
- **Merge**: an indexer consumes both the dataset changelog and edit events and writes the merged object: per property, the value whose time (`observed_at` or `edited_at`) is later, ties to the edit (this exercise's rule). Because both inputs are kept, the merged object can be recomputed at any time. Deleting an object keeps its edits in a tombstoned state for a retention period, so a key that reappears (a pipeline glitch) gets its edits back, and a key change can be remapped.
- **Index and queries**: per object type, an index sharded by primary-key hash with columnar fields for filters, sorts and aggregations and an inverted index only for searchable properties. Links are stored as their own index of `(link_type, from_pk, to_pk)` keyed in both directions, so traversal is a lookup plus a filter on the target type. Query p95 is met by pre-sorted fields, per-shard aggregation and a merge step.
- **Read-your-writes**: the action returns the edit's sequence number; the query layer either waits briefly for the index to reach that sequence or overlays the user's own recent edits from the edits store on the results. Other users see it when the index catches up (seconds).
- **Row restrictions (this exercise's model)**: each object carries its restriction labels as an indexed field; the query planner adds "labels ⊆ user's labels" as a filter inside the search before ranking, pagination and aggregation, so counts and facets never include unreadable objects. Labels derived from properties are recomputed when those properties change.
- **Schema change and re-index**: build a new index version beside the old one from the dataset's current version plus the edits store, then replay the changelog from the version it started at until it is caught up, then switch the alias atomically. Properties that fail to cast are recorded in a per-type error table with counts, the property is null for those rows, and the type's sync continues; a cast failure rate above a threshold blocks the schema release instead.
- **Guards and monitoring**: index lag per type (latest dataset version vs indexed version, and edit sequence vs indexed sequence), edits queue depth, cast errors, and a circuit breaker that pauses applying a change set that deletes more than a set share of a type's objects until someone approves it.

**Competing designs to accept.** Merging on read (index pipeline values only and overlay edits at query time from a fast store) if the candidate handles sorting and filtering on edited properties. A search engine plus a separate columnar engine for aggregations. One shared index across types with a type field for small types. Edits winning permanently until cleared (a different rule) if the candidate states the trade-off against the given rule.

**Bottlenecks and failure modes.** Snapshot builds forcing full re-index; hot shards for skewed types; edits lost or orphaned by key changes; read-your-writes broken by index refresh intervals; restriction filters applied after search, leaking counts; long re-indexes causing mixed old and new results; cast failures halting a type.

**Incident guidance.**
- *Primary key format change*: the circuit breaker should have held the change set (mass delete plus create). Recovery: pause the type's sync, build an old-to-new key map (the new key is the old one with a plant prefix, derivable from the row), re-key the 80,000 edits in the edits store (they were never deleted, only tombstoned), then apply the build. Prevention: primary-key stability checks in the pipeline's release, a delete-ratio breaker, and an owner approval for key changes.
- *Daytime full re-index*: build the new index beside the old one and switch only when caught up; throttle the rebuild's resource use and run it off-peak; never re-index in place. Mixed values mean the type was being rewritten in place.
- *Edits at {{edit_rate}} per second, 3 minutes behind*: users need read-your-writes from the edits store or a sequence wait, not from the index; scale the edit indexer by key partition; show "saved, updating" so users do not resubmit; make actions idempotent by action id so resubmissions do not double-apply.
- *Cast failures stop the type*: quarantine failing rows per property with counts and continue; alert the dataset owner; decide with them whether to fix the data or keep the property as a string; catch up the three builds from the changelog.

**Follow-up guidance.** Push on which timestamp the merge compares (recorded observation time is the strong answer), on how edits survive deletes and key changes, and on whether restriction filters are applied before aggregation.

**Rubric anchors.** 2: "store objects in a search engine and update them", edits written into the index only, no change detection for snapshots. 3: separate edits store, diff-based sync, a stated merge rule, read-your-writes, side-by-side re-index. 4: also recorded source-change times, tombstoned edits and key remapping, restriction filtering inside the query, delete-ratio guard, lag monitoring per type, and crisp incident handling.

**Strong signals.** Treats the index as rebuildable from two sources of truth; asks whether keys are stable. **Red flags.** Edits that a pipeline rebuild can erase; counts computed before restrictions; re-indexing in place during the day.

## PLT-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Rules as data**: each rule has an id, owner team, version, object type, condition in a constrained expression language (threshold, comparison with a linked object one link away, duration, sequence, absence), severity, routing, reminder interval and auto-resolve flag. Versions are immutable; publishing a new version keeps the rule id.
- **Inputs**: the object change stream with origin and event time. Changes with origin = backfill or a replayed build do not trigger alerts unless a rule opts in; they still update evaluator state.
- **Evaluation**: (1) stateless predicates evaluated per change, partitioned by object key, within seconds; (2) stateful conditions with durable keyed state (per rule and object: when the condition became true, the last N readings with event times), checkpointed so a restart resumes rather than resets; out-of-order readings are ordered by event time within a small allowed lateness; (3) absence and duration conditions use timers ("fire at became_true_at + 2 hours unless cleared"), stored with the state so they survive restarts. A change to a linked object triggers re-evaluation of the objects linked to it through a reverse link lookup.
- **Alerts**: alert key = `(rule_id, object_key)`; at most one open alert per key. A new breach while open updates it; after a close, a new breach opens a new alert with a reference to the previous one (or reopens within a short window — either is fine if stated, as long as time-to-action is computed consistently). Alert records store the rule version that fired. Lifecycle events (`opened, notified, acknowledged, assigned, reminded, action_recorded, closed(no_action|action|auto_resolved)`) are append-only with actor and time; time to acknowledge and time to action are computed from them.
- **Storm control**: per-rule rate caps; grouping by shared cause (same feed, same site, same upstream object) into a parent alert with children; feed-health rules: when a feed is known to be down, absence rules on its objects are suppressed and one feed-down alert is raised for the feed's owner.
- **Routing**: routes per rule to team inboxes and on-call schedules, reminders after {{renotify_hours}} hours unacknowledged, escalation. Notifications carry only the alert id and a summary the recipient may see; properties are rendered per recipient after an access check (this exercise's model).
- **Backtesting**: replay the last 90 days of changes through a candidate rule in an offline evaluator, report alerts per day, per site, and an estimate of how many would have been closed "no action needed" (from similar existing rules), before enabling.
- **Measures**: time to acknowledge, time to action, no-action share and reopen rate per rule, rule version and team, from lifecycle events only.

**Competing designs to accept.** A stream processor for stateful rules plus a scheduled evaluator for absence rules; a database of current state with triggers for small scale; evaluating rules as incremental queries over the object store every minute for non-sensor rules, if the candidate shows it meets the 5-minute target and handles durations.

**Bottlenecks and failure modes.** Storms from backfills or dead feeds; lost state on restart; out-of-order sensor readings; fan-out when a linked object changes; rule edits that reset alert identity; inbox overload that hides real alerts; notifications leaking properties.

**Incident guidance.**
- *Backfill sends 180,000 alerts*: stop notifications (global kill switch per origin), bulk-close the alerts created from backfill-origin changes with a reason, and tell the affected teams. Prevention: origin-aware evaluation, per-rule rate caps, and a storm detector that pauses a rule above a threshold.
- *Rule edit halves time to action*: alert identity must not depend on the version; restore by recomputing metrics from lifecycle events with the original open times, and store the version as an attribute. Prevention: version changes keep open alerts open and record the version change as an event.
- *Feed down at one of {{sites}} sites*: feed-health detection should suppress per-object absence alerts for that feed and raise one alert to the feed owner; recovery: collapse the existing alerts into one parent; surface the buried stock-out by severity ordering. Prevention: dependency-aware suppression.
- *State lost on redeploy*: checkpointed state and timers; on cold start, rebuild duration state from the object's recent history (the change log) rather than starting from now. Add a test that redeploys mid-condition.

**Follow-up guidance.** Push on where duration state lives and how it is recovered; on whether the alert key includes the version (it should not); on how a feed outage is told apart from many simultaneous real breaches.

**Rubric anchors.** 2: a scheduled query per rule that emails results; no state, no dedup key. 3: event-driven evaluation with durable state, stable alert keys, lifecycle events, routing with reminders. 4: also origin-aware evaluation, storm grouping and feed-health suppression, backtesting with a noise measure, per-recipient access checks, and metrics robust to rule edits.

**Strong signals.** Asks where changes come from and whether backfills happen; defines time to action precisely. **Red flags.** One alert per change; state in memory only; alert metrics computed from a mutable current-state table.

## PLT-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Landing**: every file, message and API push stored raw and unchanged with a receipt record (`source, supplier, received_at, checksum, schema version, row count, status`); a parser per format produces standardised records (`purchase_order_line, supplier_part, qty, unit, ship_date, eta, source, as_of`) with validation (required fields, plausible ranges, known units). Reprocessing from raw is routine.
- **Entity resolution**: a cross-reference table from `(supplier, supplier_part)` to the manufacturer's part, with method (exact code, confirmed by steward, suggested by similarity), confidence, owner and validity dates. Suggestions (normalised descriptions, dimensions, history) go to a stewardship queue; only confirmed mappings feed the projection, and unmapped lines are counted and shown as "unmatched", never dropped. Undoing a mapping is ending its validity, which triggers recomputation of everything derived from it.
- **Units**: per supplier and part, a conversion (case size, pack quantity) held as data; a change in implied quantity beyond a plausible factor (for example 10×) against that line's history is quarantined for review.
- **Precedence and conflicts**: per field, an ordered list of sources with recency limits, for example quantity shipped: carrier pickup scan > supplier ship notice > spreadsheet; arrival estimate: carrier ETA > planner override (shown as an override) > supplier ETA. Disagreements beyond a tolerance create a conflict record (`field, values per source, detected_at, status`) shown on the planner's screen; the projection uses the precedence choice and marks the line "in conflict".
- **Disruptions**: logged with scope (supplier, supplier site, region, port, carrier) and dates; a rule matches them to open shipments and purchase order lines by scope, adjusting arrival estimates (or flagging them as unknown) and recording the link.
- **Projection**: per part, plant and day for the next {{horizon}} days: on hand + expected receipts (by chosen arrival estimate, optionally weighted by each source's measured accuracy) − requirements from production orders; the first day below zero; production orders at risk are those needing that part at that plant on or after that day. Recomputed incrementally for the parts touched by a new feed.
- **Freshness**: expected cadence per feed; a feed with no update for {{stale_days}} days goes stale, its lines are marked stale on screen and their arrival estimates are treated as unknown after a further grace period rather than trusted.
- **Lineage**: each number links to the source records and mappings it came from.

**Competing designs to accept.** A probabilistic arrival estimate (distribution per source learnt from history) instead of a precedence list, if explained; a graph model of orders, shipments and parts; a warehouse with daily batch recomputation if the 30-minute target is met for the feeds that arrive intra-day.

**Bottlenecks and failure modes.** Silent mapping failures that look like reduced risk; unit errors; over-trusting supplier dates; stale feeds whose future dates look fine; wrong merges that propagate; manual overrides that never expire.

**Incident guidance.**
- *Part numbering change*: the unmatched rate for that supplier jumped from near zero to 40% — monitor unmatched share per supplier and alert on a jump; treat unmatched open lines as risk ("unknown") rather than absent, so the at-risk list does not shrink. Recover by bulk-mapping with the supplier's old-to-new table and reprocessing from raw.
- *5,000 vs 500*: the carrier scan should win for shipped quantity and the conflict should be on screen from the first scan. Recover: correct the line, recompute the projection, notify the planner. Prevention: per-field precedence with a tolerance check.
- *Cases instead of units*: a 24-fold jump is caught by the plausibility check against the line's history and unit conversion; quarantine and ask the supplier. Recover by reprocessing the file with the correct conversion.
- *Feed silently stops*: expected cadence per feed and a stale state after {{stale_days}} days; stale lines lose trust in their dates. Prevention: freshness monitoring owned by a named team, and supplier contact on stale.

**Follow-up guidance.** Push on what the screen shows during a conflict, how unmatched lines enter the risk calculation, and how a wrong mapping is undone with recomputation.

**Rubric anchors.** 2: load all feeds into one table, latest value wins, no entity resolution story. 3: raw landing, cross-reference with stewardship, per-field precedence, a correct projection, freshness per feed. 4: also conflicts as records shown to planners, unmatched and stale treated as risk, plausibility checks on units, reversible mappings with recomputation, and source accuracy measured and used.

**Strong signals.** Asks how reliable each source is and how planners act on the picture. **Red flags.** Fuzzy matching applied automatically to the projection; hiding conflicts; dropping unmatched lines.

## PLT-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Registry**: model id, version, artefact, code commit, training data snapshot id, feature list with feature-definition versions, applicable asset types, offline evaluation results, approver, status (`registered → shadow → limited → live → retired`). The current live version per model is a pointer.
- **Features**: one declarative definition per feature (for example "work orders in the last 90 days", "max vibration over 24 hours") executed by a batch engine for training and nightly scoring, and by an incremental engine for an online store used by live scoring. Training sets are built as of each label's time (point-in-time joins). Parity checks compare online and batch values for a sample of assets daily.
- **Scoring**: the nightly batch scores every applicable asset per live model into a score history store keyed by `(asset, model, version, scored_at)` with an input snapshot reference; writes are idempotent per run. The live service consumes asset change events (up to {{live_events}} per second), reads features from the online store, scores, and appends to the same history. The asset property is a pointer to (or a materialised copy of) the current score of the live version, with version and time shown.
- **Release**: offline evaluation on held-out periods; a shadow period where the new version scores into history without being shown; a comparison of score distributions and of top-N overlap with the live version; then live for some asset types or regions before all.
- **Monitoring**: input checks (ranges, units, null rates, distribution distance per feature and region) that can halt a batch before writing; output distribution per model and segment (share above the high-risk threshold); outcome tracking when inspections and work orders reveal failures (calibration, precision at the planners' capacity).
- **Rollback**: switching the live pointer to the previous version and re-materialising the asset properties from score history (the previous version's scores are already there if it scored in parallel, or re-scored from stored inputs) within {{rollback_minutes}} minutes; notify planners of which assets' scores changed.
- **Decision records**: when a planner schedules or skips an inspection, store the score, version and time they saw.
- **Evaluation of impact**: because inspections change outcomes, use a holdout share of assets prioritised by the old process, or compare against the score's predicted risk for assets not inspected; state limits honestly.

**Competing designs to accept.** Scoring only in batch with live re-scoring for a subset of event types; writing score history in the platform's datasets and properties directly via the object layer; champion/challenger by region rather than by asset type.

**Bottlenecks and failure modes.** Training/serving skew from two feature implementations; a bad batch overwriting all scores; unit changes in inputs; live fan-out at peak; rollback that only affects future scores; feedback loops that make evaluation biased.

**Incident guidance.**
- *High-risk share 3% → 31%*: the output distribution check should have halted the release (compare to shadow). Recover: roll back the pointer, restore the previous version's scores, tell planners which lists changed and why; keep the decision records. Prevention: shadow comparison gates and an output-share alarm before 06:00.
- *Fahrenheit in one region*: input validation per feature and region should stop the batch for that region and keep yesterday's scores marked as such; fix the feed's units at ingestion; re-score after the fix.
- *Live vs nightly disagree*: parity checks between the online store and the batch values; fix the cache refresh (or read the latest day from the change stream); backfill the online store.
- *Rollback leaves bad values*: with score history and a pointer, rollback restores properties within {{rollback_minutes}} minutes; if scores were overwritten in place, re-score from stored input snapshots with the previous version and track progress over the {{assets}} assets.

**Follow-up guidance.** Push on how the asset property and the history relate (rollback depends on it), on one feature definition shared across paths, and on evaluating a model that changes which assets are inspected.

**Rubric anchors.** 2: a nightly job that overwrites a score column; no versions on outputs. 3: registry, shared features, batch and live scoring with version on every score, shadow release, drift monitoring. 4: also score history with pointer-based rollback, input validation that halts writes, online/batch parity checks, decision records, and a credible impact evaluation.

**Strong signals.** Asks how planners use the score and what a wrong score costs; treats outputs as data with lineage. **Red flags.** Automatic retraining and release without review; rollback that only changes future scoring; no record of what a planner saw.

## PLT-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **At each hospital**: a small integration service on the hospital network receives event messages from its system (one adapter per source system type, {{systems}} in all). It parses each message in memory, keeps only what the picture needs (event type, event time, unit, bed id, bed status, admission class), and replaces the patient or visit identifier with a pseudonym computed with a key held only at that hospital (a keyed hash, rotated on a schedule), used only to pair an admission with its later transfer or discharge. Names, dates of birth, addresses and free text are dropped before anything is written. Messages that fail to parse stay in a quarantine on the hospital side, readable only by its integration team, with a short retention; only counts of failures leave.
- **Central**: a per-bed state table per hospital (`bed_id, state ∈ {vacant-clean, vacant-dirty, occupied, blocked-maintenance, blocked-isolation}, since, last_event_time`), updated from events in event-time order per bed with an idempotency key per message; a replayed or corrected message replaces the earlier effect rather than adding to it. A cancelled admission reverts the bed's state. Hourly snapshots count beds per unit and state.
- **Census reconciliation**: each hospital's midnight census (counts per unit) compared with the computed count; differences per unit shown and alerted above a tolerance; persistent drift opens a defect for the adapter.
- **Other measures**: expected discharges as counts from the source's planned-discharge flag aggregated at the hospital; patients waiting in emergency departments as a count per hospital; staffing from rosters plus manager entries, compared with this exercise's ratio rule per unit; transfers as requests (`request_id, from_site, to_site, unit_type, status, timestamps`) with no patient details, created in their own workflow.
- **Freshness and outages**: last successful update per hospital and source shown on screen; a feed down marks that hospital's numbers as stale with the time, falls back to the last good snapshot or a manual count entered by the hospital, and after recovery the replayed events correct the affected hours.
- **Access and sharing**: unit managers see their units; the operations centre sees all; any extract leaving operations is produced by a separate step that applies suppression below {{min_count}} last, after all corrections, and records what it suppressed.
- **Proof of minimisation**: schema allow-lists at the hospital boundary; automated scanners over central stores, logs and dead-letter queues for identifier patterns; logging that records message ids and counts, never payloads; retention limits.

**Competing designs to accept.** Hospitals sending counts only (no pseudonym at all) if their source system can compute occupancy per unit reliably; a central restricted zone that receives raw messages and drops identifiers immediately, if the candidate limits retention, access and logging there and explains why it is acceptable; daily batch for staffing.

**Bottlenecks and failure modes.** Identifiers leaking through logs, errors or dead letters; replays double counting; unhandled message types causing drift; source systems that differ in event semantics; small counts shared outside operations; outages that look like empty wards.

**Incident guidance.**
- *Feed down 5 hours, replay out of order*: per-bed state with event-time ordering and idempotency fixes the over-count once all messages are applied; show the hospital as stale during the outage and "correcting" during the replay; recompute affected hourly snapshots. Prevention: a replay test per adapter.
- *Cancelled admissions unhandled*: census reconciliation should have flagged the drift within days; fix the adapter, reprocess the hospital's events from the retained (pseudonymised) stream, alert on drift above tolerance per unit.
- *Raw messages in logs*: treat as a privacy incident: stop the logging, delete the entries (and their copies and backups per retention), record who could access them and whether they did, inform the network's privacy officer under its process. Prevention: payload logging forbidden by configuration and a scanner on the log store, with a test that fails the build if a debug flag can log payloads.
- *Count of 3 shared below {{min_count}}*: suppression must run last, on the final numbers; correct and reissue the report, tell the recipient, and change the pipeline order with a test.

**Follow-up guidance.** Push on where exactly identifiers stop, who holds the pseudonym key, and how the system is proven not to leak them; and on how replays converge to the right counts.

**Rubric anchors.** 2: copy event messages into a central database and count; identifiers stored "securely". 3: identifiers removed or pseudonymised at the hospital, per-bed state, census reconciliation, freshness shown, role-based access. 4: also failure quarantine kept at the hospital, payload-free logging with scanners, idempotent replay handling, suppression applied last for shared extracts, and crisp handling of the privacy incident.

**Strong signals.** Asks what the operations centre needs before collecting anything; designs the absence of identifiers rather than their protection. **Red flags.** Storing patient identifiers centrally "for joining"; logging payloads for debugging; treating a feed outage as zero patients.
