# Palantir · Loop 3 — evaluator notes

Evaluator-only material for interview/company-loops/templates/palantir/loop3.md.
All scenarios are simulated and commercial; numbers are hypothetical, and every
access-control rule is this exercise's model, not a description of any product.

## PLT-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Definitions as versioned data.**
  - `object_type (type_id, api_name, display_name, primary_key_property_id, status active|deprecated, valid_from, valid_to, recorded_at, changed_by, change_reason)`.
  - `property_def (property_id, type_id, api_name, display_name, data_type, allowed_values, required, valid_from, valid_to, recorded_at, conversion_from_previous)`. `property_id` is minted once and never reused; a rename is a new row with the same id and a new display name; a type change is a new row with a new `data_type` and a stated conversion (for example "parse ISO date; unparseable → NULL with a quality flag").
  - `link_type (link_type_id, from_type_id, to_type_id, cardinality one_to_one|one_to_many|many_to_many, has_properties, valid_from, valid_to, recorded_at)` and `link_property_def` for many-to-many links that carry properties.
  - `action_type (action_type_id, display_name, parameters (property-style definitions), edits (which object types and properties it may change), validation rules, version, valid_from, valid_to)`.
  - A `schema_version (version_id, effective_at, recorded_at, change_set)` row groups the definition changes deployed together, so "the schema in force at t" is one lookup.
- **Instances.**
  - `object (type_id, object_pk, created_at, deleted_at)`.
  - `property_value (type_id, object_pk, property_id, value (typed columns or a tagged variant), valid_from, valid_to, recorded_at, superseded_at, writer pipeline|action, source_ref (sync run id or action run id))`. Long format keyed by stable property id; append-only; a correction inserts a new row and closes the old one in recorded time (`superseded_at`), never edits it.
  - `link (link_type_id, from_pk, to_pk, link properties, valid_from, valid_to, recorded_at)`.
  - `action_run (action_run_id, action_type_id, action_version, submitted_by, submitted_at, parameters, status accepted|rejected, rejection_reason)` and `action_edit (action_run_id, type_id, object_pk, property_id, old_value, new_value, applied_at, status applied|failed, failure_reason)`. Edits made together share the run id; with all-or-nothing semantics a single failed validation rejects the run and no edit is applied; if the action type allows partial application, each edit's status is explicit.
- **Read paths.**
  - Serving: a current-state wide table per object type (materialised from `property_value` where valid_to and superseded_at are open), rebuilt incrementally from changes.
  - History: periodic snapshots (daily, partitioned by type and date) plus the change rows since; "object at t as we know it now" = latest snapshot ≤ t + changes with valid_from ≤ t and superseded_at NULL; "as we knew it at k" adds recorded_at ≤ k and (superseded_at NULL or > k).
  - Schema at t: property definitions valid at t give display names and types; reading under today's schema maps through `property_id` and applies stated conversions.
- **Growth estimate (shape).** {{edits_per_day}} changes a day × ~100–200 bytes compressed per long row ≈ tens of GB a day before snapshots; daily snapshots of {{objects}} objects are the larger cost, so snapshot weekly for cold types and keep daily for hot ones, and compact superseded rows older than the audit retention into monthly summaries only if auditors agree.

**Competing designs to accept.** Event sourcing of property changes with periodic snapshots (equivalent if both time axes are kept). Wide per-type tables with SCD2 rows per object, if a property registry with stable ids maps columns and type changes create new columns rather than altering old ones. A document per object version (JSON) with a schema version stamp, if readers resolve fields through the registry and type changes are explicit.

**Bottlenecks and failure modes.** Keying by display name (renames break history); ALTER-in-place type changes that rewrite history; single time axis that cannot answer "as we knew it"; actions logged per object with no run id; per-object reconstruction by scanning full history (no snapshots); wide tables churned by {{schema_changes_per_week}} changes a week; many-to-many links with properties stored as arrays on one side.

**Incident guidance.**
- *Rename deployed as drop-and-add*: the new property got a new id. Contain by marking the new id as the continuation of the old in the registry (a `continues_property_id` link) and serving a union view; correct by re-pointing the new definition to the old id where the platform allows, or keeping the mapping permanently; guard with a deployment check that refuses to delete a property with history unless a rename/continuation is declared.
- *Backfill back-dated its recorded time*: the corrected values claim to have been known when they were true. Contain by labelling "as we knew it" reports for the affected period as unreliable and freezing audits that read them; correct by re-stamping the backfill's rows (found by their sync run id) with the time they were actually loaded, so past views return to what was known then and "as we know it now" keeps the corrections; guard by having the platform set recorded time at write, never the pipeline, and by a check that no row's recorded time precedes its load run's start.
- *Cardinality change to many-to-many*: older links lived as a foreign key on one side. Contain by serving a view that unions the old foreign-key links with the new link table; correct with a migration that writes the old links into the link table with their original valid_from; guard with a definition-change checklist that requires a migration plan for cardinality changes, and a test that the count of links before and after matches.

**Follow-up guidance.** (1) Same property_id, new display name; merged values are mapped by a recorded conversion; queries over last quarter by id return continuous history, with labels from the schema of the reader's choice. (2) Two rows: the wrong one (valid_from 1st, recorded 1st, superseded today) and the correction (valid_from 1st, recorded today); "knew on the 5th" = recorded_at ≤ 5th and (superseded_at NULL or > 5th). (3) Run with one row and edits each with status; with all-or-nothing, rejected run and no edits; never two applied edits from a rejected run. (4) Estimate, snapshot cadence by heat, partition by type and date, compaction policy agreed with auditors.

**Rubric anchors.** 2: one wide table per type, overwritten in place, or names as keys. 3: versioned definitions with stable ids, long or SCD history, an action log with run ids, a reconstruction query. 4: also both time axes with exact predicates, type changes with conversions, cardinality migrations, and a growth estimate with snapshot and compaction choices.

**Strong signals.** Asks "when was it true versus when did we know" unprompted; separates metadata from data. **Red flags.** "Just store JSON and the latest schema"; updating history in place; no notion of who or what wrote a value.

## PLT-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Markings and eligibility.** `marking (marking_id, name, description, owner)`; `user_marking (user_id, marking_id, valid_from, valid_to, granted_by)` arriving as dated changes.
- **Datasets and lineage.** `dataset_version (dataset_id, version_id, built_at, build_run_id)`; `lineage_edge (output_dataset_id, output_version_id, input_dataset_id, input_version_id)` per build, so lineage is exact per version, not per dataset name.
- **Direct markings.** `dataset_marking_direct (dataset_id, marking_id, valid_from, valid_to, applied_by, reason)`.
- **Release steps.** `release_approval (approval_id, output_dataset_id, removes_marking_id, approved_by, approved_at, scope_code_hash, scope_input_versions, valid_from, valid_to, rationale)`. An approval covers a specific transform version and input set; a code or input change invalidates it.
- **Effective markings (derived, versioned).** `dataset_marking_effective (dataset_id, version_id, marking_id, source direct|inherited|..., via_input_dataset_id, valid_from, valid_to, computed_at)`. For a built version: effective = direct ∪ (∪ effective of every input version) − markings removed by a release approval whose scope matches this build. Changes upstream (a marking added or removed on R) open/close intervals on descendants; the propagation job records `computed_at`, so the lag is measurable.
- **Grants.** `grant_request (request_id, user_id, dataset_id, purpose, requested_at)`, `grant (grant_id, request_id, approved_by, approved_at, valid_from, expires_at)`, `grant_renewal (grant_id, renewed_by, renewed_at, new_expires_at, purpose_confirmed)`, `grant_revocation (grant_id, revoked_by, revoked_at, reason)`. Active at t: valid_from ≤ t < min(effective expiry at t, revoked_at). Expiry is exclusive: at exactly expires_at the grant is no longer active (state it; either is fine if consistent).
- **Reads.** `read_event (read_id, user_id, dataset_id, version_id, grant_id, started_at, ended_at, application, query_id)`, append-only.
- **"Could U read D at t".** Effective markings of D's version in force at t ⊆ U's eligible markings at t, and an active grant of U for D at t; the query returns the grant id, purpose and the marking set, so the answer is an explanation, not a boolean. A compliance view joins read_event to this check to list reads that were outside a grant or lacked a marking.

**Competing designs to accept.** Effective markings computed at build time only and stored on the dataset version (simpler; a marking added upstream later then requires a rebuild or a "pending" overlay, which must be stated). A graph store for lineage with effective markings materialised in the warehouse. Grants modelled as one row per interval (renewal = new interval) if the original request and approvals remain linked.

**Bottlenecks and failure modes.** Inheritance computed from dataset names instead of versions; markings recomputed from today's state for audit questions; fan-out at {{datasets}} datasets when a raw dataset gains a marking (needs incremental propagation by descendant traversal with a lag metric); release approvals not scoped to a version; grants with no purpose or with silent auto-renewal; revocation implemented by deleting the grant (audit loses history).

**Incident guidance.**
- *Propagation lag left a dashboard readable without the marking*: contain by blocking reads of descendants of a dataset with a pending marking change until propagation completes (a fail-closed "pending" state in this exercise's model); answer compliance with read_event joined to the effective-marking intervals now corrected, listing users who lacked the marking; guard with a lag SLO on propagation and an alert when a pending change is older than it.
- *Grants of {{grant_days}} days expired together on a holiday*: contain by an emergency renewal path that requires a stated purpose and an approver, never bulk approval without one; correct the bulk renewals by requesting purposes retroactively and flagging those without; guard with expiry reminders ahead of time, staggered expiry for project grants, and a report of renewals without purpose.
- *Release approval reused after inputs changed*: contain by restoring the inherited marking on the output immediately (fail closed) and listing reads since the change; correct by re-reviewing the release step against the new code and inputs; guard by binding approvals to the transform's code hash and input versions, so any change invalidates them automatically.

**Follow-up guidance.** (1) C keeps the marking until a rebuild (build-time model) or until propagation runs (continuous model); during the gap the audit shows C's effective marking still present — the conservative direction, and that is fine. (2) Reads where no grant was active at started_at, or where D's effective markings at started_at were not all in U's eligibility at that time. (3) A gap between expiry and renewal; reads in the gap are flagged; the renewal does not backdate. (4) Descendant traversal from the changed dataset, recompute per version, record computed_at; target lag in minutes; show "pending" during recompute. (5) Approval scoped to a code hash and input versions; a change invalidates it and restores the marking.

**Rubric anchors.** 2: roles and a current-state ACL, no time dimension, no lineage. 3: time-bounded markings, grants with purpose and expiry, inheritance as union over lineage, a read log. 4: also version-grain inheritance with measured lag and fail-closed pending state, scoped release approvals, non-retroactive revocation, and an explanatory "could U read D at t" query.

**Strong signals.** Treats access as facts with time, not as a current setting; distinguishes what the model records from how a platform enforces it. **Red flags.** Recomputing past access from today's state; deleting grants or markings instead of closing intervals; treating purpose as free text nobody reads.

## PLT-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Rules and alerts.** `rule (rule_id, version, definition, threshold, owner, valid_from, valid_to)`; `alert (alert_id, rule_id, rule_version, object_type, object_pk, object_version_or_time, triggering_values, raised_at, severity)`.
- **Cases and membership.** `case (case_id, created_at, created_by rule|person)`; `case_membership (case_id, alert_id, joined_at, left_at, reason merged|split|auto)`. Merges and splits close and open membership intervals; the original case keeps its history.
- **Lifecycle and assignment.** `case_event (case_id, event_type created|routed|assigned|reassigned|action|closed|reopened, at, actor, inbox_id, details)`; `case_assignment (case_id, inbox_id, assignee_id NULL, from_at, to_at)` derived from events.
- **Actions.** `action_taken (action_id, case_id, action_type reroute|expedite|accept_delay|dismiss|..., parameters, object_pk, object_version, taken_by, taken_at, result applied|failed)`.
- **Resolution.** `case_resolution (case_id, closed_at, code not_an_issue|fixed_elsewhere|resolved_by_action|auto_closed_stale|duplicate, closed_by person|job)`. A cleanup job's closures carry their own code.
- **Outcomes.** `outcome (case_id or object_pk, outcome_type in_spec|rejected|stockout|cost, value, source, known_at, revision)`, append-only with revisions; "as known on date" is answerable.
- **Facts.** `fct_case_snapshot` (accumulating snapshot per case: first alert time, first routed time, first action time, close time, resolution, latest outcome), `fct_case_event` (event grain), `fct_alert` (alert grain with rule version). Workload per inbox per day from assignment intervals.
- **Definitions (acceptable wording).** Time to first action = first action_taken.at − first time the case reached any inbox (state the alternative: from first alert); reassignment does not reset the clock. False-alarm rate per rule version = alerts whose case was closed `not_an_issue` ÷ alerts of that rule version whose case is closed by a person, cohort by raised week; `auto_closed_stale` and `fixed_elsewhere` excluded from the numerator and reported separately.
- **Outcome comparison.** Compare outcomes by action type within strata of similar cases (rule, severity, lead time, object attributes), report the share with outcome known, and say plainly that planners' choices make this observational; a randomised holdout for low-risk cases is the stronger answer.

**Competing designs to accept.** Event-sourced case service with projections; one wide case table plus an event log (if the log is the source of truth); outcomes stored on the object rather than the case, joined by object and time window, if the join rule is stated.

**Bottlenecks and failure modes.** Overwritten status columns; no rule version on alerts; dismissals conflated with false alarms; outcomes treated as final; selection bias read as action effect; per-person rankings built from workload data; volume at {{alerts_per_day}} alerts a day makes event-grain facts large (partition by day, cluster by rule).

**Incident guidance.**
- *A rule change doubled alerts and the slowdown was blamed on planners*: contain by annotating the dashboard with the rule version change and splitting time to first action by rule version; correct by reporting load-adjusted timing (alerts per inbox per hour beside timing); guard with a rule-change review that estimates alert volume on recent data before deploying, and with a dashboard that always shows timing by rule version.
- *Cleanup job closed stale cases as "dismissed"*: contain by recoding those closures as `auto_closed_stale` (a correction event, not an update) and recomputing the month; guard by requiring jobs to use their own resolution codes and excluding them from false-alarm numerators.
- *Cases without outcomes counted as failures*: outcomes arrive about {{outcome_weeks}} weeks after closure. Contain by showing "outcome pending" separately; correct the report to compute outcome rates only over cases older than the outcome window, or with known-outcome denominators; guard with a stated close date for monthly outcome reports and a test that pending outcomes never fall into a failure category.

**Follow-up guidance.** (1) Split by rule version; thresholds change the population, so compare only within a version or on a re-scored common set. (2) Selection: planners expedite the cases that look recoverable; stratify, report the overlap of case types, and propose a holdout. (3) Each original alert keeps its raised_at; timing is computed on the case it belonged to at first action, with the merge recorded. (4) Event grain for alerts and case events, accumulating snapshot per case, outcomes with known_at; monthly report final after {{outcome_weeks}} weeks plus lag.

**Rubric anchors.** 2: a cases table with a status column and a timestamp, no rule versions, no outcome model. 3: events and derived state, membership history, actions with parameters, resolution codes, outcomes with known_at. 4: also precise metric definitions with cohorts, selection-bias awareness with a holdout proposal, report close for delayed outcomes, and reporting per inbox and rule rather than ranking people.

**Strong signals.** Separates "what happened" from "what we believe now"; refuses to rank planners on raw timing. **Red flags.** Treating every dismissal as a false alarm; using outcomes before they are known; "the action with the best outcome is the best action".

## PLT-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Scenario and lineage.** `scenario (scenario_id, name, parent_scenario_id, base_mode pinned|rebased, base_time, created_by, created_at, status draft|scored|approved|applied|abandoned)`; `scenario_version (scenario_id, version, frozen_at)`; approval freezes a version.
- **Overlay edits.** `scenario_edit (scenario_id, edit_seq, object_type, object_pk, property_id, new_value, base_value_seen, base_recorded_at_seen, proposed_by, proposed_at, superseded_by_seq)`. Copy-on-write: a child inherits its parent's edits by reference up to the parent's version at copy time (stated) or live (stated); a child's own edit on the same key shadows the parent's.
- **Read path.** Value of (object, property) in scenario S: S's overlay → each ancestor's overlay (nearest first, up to the inherited version) → base as of S's base_time (pinned) or now (rebased). Index overlays by (scenario_id, object_type, object_pk); keep the ancestor chain short by flattening deep chains into a child's overlay when it is frozen.
- **Conflicts.** For rebased reads and at apply time: an edit conflicts when the live value's recorded version differs from `base_value_seen`/`base_recorded_at_seen`, or the object was deleted. Conflicts are rows (`scenario_conflict (scenario_id, edit_seq, kind changed|deleted, live_value, detected_at, resolution)`).
- **Scoring.** `model_run (run_id, scenario_id, scenario_version, model_name, model_version, input_snapshot_ref, started_at, outputs_ref)`; outputs (predicted late orders, cost, capacity by week over {{horizon_weeks}} weeks) stored per run, immutable.
- **Apply.** `scenario_apply (apply_id, scenario_id, version, approved_by, approved_at, applied_at)` and `apply_edit (apply_id, edit_seq, action_run_id, status applied|conflict|failed, reason)`; each applied edit is a real action with its own audit.
- **Plan versus actual.** Join the approved version's frozen model run (never re-run) to the actual outcomes over the horizon, and to apply_edit (what was really applied) and to base drift (live changes after base_time on objects the scenario relied on). Three gaps: execution (approved but not applied), world change (base drift), model error (the rest).
- **Estimate (shape).** Overlays: {{open_scenarios}} × {{edits_per_scenario}} rows of ~100–200 bytes, small; full copies: {{open_scenarios}} × {{objects_in_scope}} × object width, orders of magnitude larger.

**Competing designs to accept.** Branches of the object store with copy-on-write at the storage layer (if the read path, conflict detection and approval freeze are explained). Full copies for a few very large structural scenarios with an explicit budget, overlays otherwise. Edits stored as a patch document per scenario version, if keyed lookups stay fast.

**Bottlenecks and failure modes.** Full copies; deep ancestor chains slowing reads; rebased scenarios silently changing scores; approval without freeze; apply without conflict detection; plan-versus-actual comparing to re-run predictions; model outputs without model version.

**Incident guidance.**
- *Full copies exhausted storage*: with {{open_scenarios}} scenarios over {{objects_in_scope}} objects. Contain by stopping new full-copy scenarios and archiving abandoned ones; correct by migrating to overlays (diff each copy against its base time to extract edits); guard with a storage budget per scenario and a creation path that never copies objects.
- *Applied against a three-week-old base without conflict warnings*: contain by pausing apply for that scenario, listing edits whose objects changed after the base, and reverting the conflicting applied edits through actions; guard by requiring a rebase-and-review step when base age exceeds a threshold, and by recording base_value_seen so apply detects drift automatically.
- *Plan-versus-actual re-ran predictions with the current model*: contain by restoring the original model run's outputs (immutable) as the plan; guard by making plan-versus-actual read only the approved version's recorded run, and showing the current model's re-score as a separate, labelled column if wanted.

**Follow-up guidance.** (1) Depends on the stated inheritance: by-reference-at-copy-version means B does not see A's later edit; live inheritance means it does. Either is fine if explicit and shown in the read path. (2) Overlay storage is small; reads pay extra lookups per ancestor level, so index overlays and flatten frozen chains; full copies cost {{objects_in_scope}} × width per scenario. (3) Separate execution gap (apply_edit failures), world change (base drift on relied-on objects, new disruptions) and model error (residual against the frozen run). (4) Conflicts recorded per edit with kind and live value; the planner reviews each with keep/drop/adjust, and the scenario's score is marked stale until re-run.

**Rubric anchors.** 2: copies of tables per scenario, no lineage or approval freeze. 3: overlays keyed by object and property, a read path, model runs with versions, apply as actions. 4: also pinned versus rebased semantics with conflict detection, frozen approved versions, plan-versus-actual separating execution, drift and model error, and storage and read-path estimates.

**Strong signals.** Starts from "a scenario is a base plus a diff"; insists approved predictions are immutable. **Red flags.** Applying a scenario by overwriting live tables; re-scoring the past and calling it the plan; no notion of conflicts.

## PLT-L3-05

**Reference solution** (PostgreSQL; `{{grace_minutes}}` is the instance's grace period, 0 at Medium and Hard)

```sql reference
WITH periods AS (                              -- deletion periods that count
  SELECT object_id, deleted_at, restored_at
  FROM object_deletions
  WHERE restored_at IS NULL
     OR restored_at - deleted_at >= INTERVAL '1 minute' * {{grace_minutes}}
), versions AS (
  SELECT lv.*,
         EXISTS (SELECT 1 FROM link_versions n
                 WHERE n.link_id = lv.link_id AND n.version = lv.version + 1) AS has_next
  FROM link_versions lv
), pairs AS (
  SELECT v.link_type, v.valid_to, v.has_next, p.restored_at,
         GREATEST(v.valid_from, p.deleted_at) AS started_at,
         LEAST(COALESCE(v.valid_to, 'infinity'), COALESCE(p.restored_at, 'infinity')) AS ended_at
  FROM versions v
  JOIN periods p ON p.object_id = v.target_object_id
), episodes AS (
  SELECT link_type, started_at, ended_at,
         CASE WHEN valid_to IS NULL AND restored_at IS NULL THEN 'open'
              WHEN valid_to IS NOT NULL AND (restored_at IS NULL OR valid_to <= restored_at)
                THEN CASE WHEN has_next THEN 'repointed' ELSE 'removed' END
              ELSE 'restored' END AS outcome
  FROM pairs
  WHERE started_at < ended_at                  -- positive length only
)
SELECT t.link_type,
       COUNT(e.link_type)                                   AS episodes,
       COUNT(*) FILTER (WHERE e.outcome = 'removed')        AS removed,
       COUNT(*) FILTER (WHERE e.outcome = 'repointed')      AS repointed,
       COUNT(*) FILTER (WHERE e.outcome = 'restored')       AS restored,
       COUNT(*) FILTER (WHERE e.outcome = 'open')           AS still_dangling,
       ROUND(EXTRACT(EPOCH FROM SUM(e.ended_at - e.started_at) FILTER (WHERE e.outcome <> 'open'))
             / (3600 * NULLIF(COUNT(*) FILTER (WHERE e.outcome <> 'open'), 0)), 2) AS avg_hours_to_fix
FROM link_types t
LEFT JOIN episodes e ON e.link_type = t.link_type
GROUP BY t.link_type
ORDER BY t.link_type;
```

**Explanation.** An episode is an interval intersection: a link version is in force on [valid_from, valid_to) and its target is deleted on [deleted_at, restored_at); the overlap is [later start, earlier end), and only a positive-length overlap is a dangling episode. Open ends become `'infinity'` so GREATEST and LEAST work unchanged. How the episode ended is decided by which end came first: the link's (valid_to) or the target's (restored_at), with the tie credited to the link, and "re-pointed versus removed" by whether the link has a version n + 1. The counts are aggregated per link type and attached to `link_types` with a LEFT JOIN, counting a column of the episode side so a clean type shows 0, not 1. The average divides total resolved seconds by 3600 × resolved count in one division, so ties at the second decimal round exactly; NULLIF gives NULL when nothing was resolved. At Very Hard, deletion periods restored less than the grace period after they began are dropped before the join (exactly the grace period counts; open periods always count).

**Complexity.** One join of link versions to their targets' deletion periods (hash join on object id; each version meets only its own target's few periods), one EXISTS probe per version on the (link_id, version) primary key, one aggregation. In production, deletions are rare relative to links: drive the join from deletion periods (an index on link_versions(target_object_id)) and maintain the counts incrementally from deletion, restore and link-change events.

**Dialect notes.** `'infinity'` timestamps are PostgreSQL; in Snowflake, BigQuery, Spark SQL and MySQL use a far-future literal such as `'9999-12-31'` (and keep the open/closed logic on the NULLs, as the reference does). `COUNT(*) FILTER (WHERE …)` is PostgreSQL (and DuckDB); elsewhere `COUNT_IF(…)` (Snowflake, Spark), `COUNTIF(…)` (BigQuery) or `SUM(CASE WHEN … THEN 1 ELSE 0 END)` (MySQL and all of them). Interval arithmetic differs: `DATEDIFF('second', a, b)` (Snowflake), `TIMESTAMP_DIFF(b, a, SECOND)` (BigQuery), `unix_timestamp(b) - unix_timestamp(a)` (Spark), `TIMESTAMPDIFF(SECOND, a, b)` (MySQL); `GREATEST`/`LEAST` return NULL on any NULL argument in Snowflake, BigQuery and MySQL, so substitute the far-future value first. None of these variants is executed here.

**Edge cases built into the data.** A link type with no deletions at all (row of zeros, NULL average); a target deleted exactly when its link version ended (zero length, no episode); a link re-pointed to a target that was already deleted (episode from the version's valid_from) and later closed; a target deleted exactly at the snapshot time (still dangling); a deletion inside a version followed by a re-point; two links sharing one deleted target (two episodes); versions created against already-deleted targets. Hard adds restores: a restore exactly at valid_to (credited to the link), a restore exactly at valid_from (no episode), an object deleted twice under one version (two episodes), restores before and after a version ended. Very Hard adds the grace period: a period shorter than it (ignored), one exactly equal to it (counts, restored), and an open deletion younger than it (counts, still dangling).

**Common mistakes.** BETWEEN or ≤ in the overlap test (zero-length episodes); timing from deleted_at when the version started later; INNER JOIN or starting from the episodes (clean types vanish); COUNT(*) after the LEFT JOIN (clean types show 1); classifying every closed version as removed; averaging still-dangling episodes; (Hard+) ignoring restored_at or crediting the tie to the restore; (Very Hard) ignoring the grace period or excluding a period of exactly the grace length. Each has a diagnostic. Averaging per-episode hours rounded first, or AVG over seconds/3600 in floating point, can differ only at the last digit in rare cases; the reference's single division is exact.

**Follow-up guidance.** (1) A per-link-type counter table maintained from events (object deleted → find in-force link versions targeting it; link re-pointed or removed, object restored → close episodes), reconciled nightly against this query on a sample; an index on link_versions(target_object_id) where valid_to IS NULL. (2) Episodes still open, ordered by started_at ascending, joined to the source object and its owning team; LIMIT 20 with a tie-breaker. (3) Late deletion periods add episodes and lengthen still-open ones after the fact; report with a "data complete up to" watermark and restate older days only through a labelled correction. (4) Block deletion of objects with in-force links for link types where a broken reference is unsafe; cascade for owned children (a work order's line items); allow and report for loose references. The owners of each link type decide, with this report as the evidence.

**Rubric anchors.** 2: right shape but zero-length overlaps counted, or episodes timed from deleted_at, or clean types missing. 3: matches the expected result. 4: also explains incremental maintenance, late-arriving deletions with a completeness watermark, and a prevention policy per link type.

**Strong signals.** Writes the overlap as later-start < earlier-end without being told; asks what happens at ties. **Red flags.** Joining on the latest deletion only; computing outcome from the link's current state rather than the version's; COUNT(*) after a LEFT JOIN.
