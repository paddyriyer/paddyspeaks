# Salesforce · Loop 3 — evaluator notes (hidden from candidates)

## SFC-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Policy, with valid time (the source of truth).** Every table carries `valid_from`, `valid_to` (NULL = current) and the change event id that opened the row.
  - `object_defaults (org_id, object, default_access private|read|read_write, hierarchy_access bool, valid_from, valid_to)`.
  - `user_roles (org_id, user_id, role_id, active, valid_from, valid_to)`: a user's role and active state over time.
  - `role_parents (org_id, role_id, parent_role_id, valid_from, valid_to)` and a derived `role_closure (org_id, ancestor_role_id, descendant_role_id, depth, valid_from, valid_to)`.
  - `groups (group_id, kind public|role|role_and_subordinates, …)`, `group_members (group_id, member_type user|role|role_and_subordinates|group, member_id, valid_from, valid_to)` and a derived `group_user_membership (group_id, user_id, valid_from, valid_to)` resolved through the role closure and nested groups.
  - `sharing_rules (rule_id, version, org_id, object, kind owner|criteria, source_group_id NULL, criteria_json NULL, target_group_id, access read|read_write, valid_from, valid_to)`: a stable `rule_id` plus a version per edit; a deleted and recreated rule is a new `rule_id` even with the same name.
  - `record_owners (record_id, object, owner_user_id, valid_from, valid_to)`; `manual_shares (share_id, record_id, principal_type, principal_id, access, valid_from, valid_to, end_reason owner_change|revoked)`; `team_members (record_id, user_id, access, valid_from, valid_to)`.
  - `criteria_field_history (record_id, field_id, value, valid_from, valid_to)` only for fields that some criteria-based rule references, kept for the audit period; or, leaner, `criteria_match_history (record_id, rule_id, rule_version, matched, valid_from, valid_to)` so no field values are stored at all.
- **Derived access (a cache).** `record_access (record_id, principal_user_id, access, reason_type default|owner|hierarchy|rule|manual|team, reason_id, reason_version, valid_from, valid_to)`. It is computed incrementally from policy change events: a role move touches rows for records owned by users in the moved subtree and for users above it; a rule change touches records matching that rule. Each recalculation job has an id and a watermark; queries for a time beyond the watermark are answered from the policy tables directly or marked "recalculation in progress".
- **Point-in-time answer.** `WHERE record_id = R AND valid_from <= T AND (valid_to IS NULL OR valid_to > T)` on `record_access` returns every grant path; the highest level is the max. The same question can always be recomputed from the policy tables (owner at T, owner's role at T, ancestors via closure at T, groups at T, rules at T with match state at T, shares and teams at T) — that recomputation is how the cache is verified.
- **Retention.** Policy history (small) is kept for {{audit_years}} years in full. Derived rows can be compacted (merge adjacent intervals) or dropped beyond a few months and recomputed on demand from policy history; the policy history is what must never be shortened.
- **Cross-org analytics.** Reads only policy metadata: counts of rules by kind, role tree depth, number of groups; never record ids, owners or field values; small categories suppressed.

**Competing designs to accept.** No derived table at all: compute access at query time from the temporal policy tables (fine for audit questions, slow for "which records could U see" in an org with {{org_records}} records unless the candidate bounds it). A derived table of current access only plus the temporal policy tables for history. Event sourcing of policy changes with periodic snapshots of the closure tables. Storing nested group membership as a materialised path instead of a closure table, if time-versioned.

**Bottlenecks and failure modes.** A recursion over the current tree for a past date; a derived table with no reasons; rule identity by name; manual shares deleted on owner change so history is lost; storing full record contents to evaluate criteria; a reorg causing an org-wide rewrite (the worst case is records owned below the moved role × users above it — bound it and make it asynchronous with a visible watermark); membership history shorter than the audit requirement.

**Incident guidance.**
- *Reorg recalculation window*: the derived rows were read as truth while incomplete. Contain by marking the report generated in the window as unreliable and re-issuing it from policy tables; tell the customer which report is superseded. Fix: every derived row set carries the recalculation watermark; queries for times past the watermark either wait, fall back to computing from policy, or are labelled. Guardrail: a reconciliation that samples records and compares derived access to a recomputation from policy at org scale ({{org_records}} records here).
- *Rule deleted and recreated with the same name*: grants were keyed by name. Re-key derived grants to (rule_id, version), recompute the affected interval, and correct the answer that was given. Guardrail: a test that a recreated rule never inherits the old rule's history.
- *Membership history kept 90 days*: the answer for grants via groups older than 90 days is UNKNOWN and must be stated as such, not guessed; reconstruct from any surviving audit trail of membership changes if it exists. Fix: retention of all policy history for {{audit_years}} years (it is small compared with records) and a retention test in the data contract.

**Follow-up guidance.** (1) 09:00: owner, default, hierarchy through the old managers. 12:00: hierarchy through the new managers only (closure at 12:00). 17:00: plus the Finance group through the criteria rule, because the record matched from 16:00. (2) Records owned by users in the moved subtree × users in the old and new ancestor chains; process it incrementally and expose the watermark. (3) Time-versioned closure tables; queries filter on validity at T. (4) Keep only the referenced fields' history, or only rule-match intervals; delete with the record. (5) Policy metadata counts only, aggregated, never record-level data.

**Rubric anchors.** 2: a current access table with a boolean, no history and no reasons. 3: temporal policy tables, derived access with reasons and validity, closure tables, point-in-time query defined. 4: also incremental recalculation with a visible watermark, rule identity by id and version, minimal criteria history, retention reasoning and metadata-only cross-org analytics.

**Strong signals.** Separates policy from derived access unprompted; asks how groups that contain roles move with the hierarchy. **Red flags.** Recursing over today's tree for a past date; rule names as keys; copying record contents to evaluate criteria.

## SFC-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Metadata store.**
  - `objects (org_id, object_id)` and `object_versions (object_id, api_name, label, is_custom, deleted_state active|deleted|purged, valid_from, valid_to)`.
  - `fields (org_id, object_id, field_id)` and `field_versions (field_id, api_name, label, data_type, length_or_precision, lookup_target_object_id NULL, formula_hash NULL, deleted_state, valid_from, valid_to, change_id)`.
  - `picklist_values (field_id, value_id)` and `picklist_value_versions (value_id, api_value, label, active, sort_order, valid_from, valid_to)`.
  - `schema_changes (change_id, org_id, kind add|rename|type_change|delete|restore|purge|picklist_change, entity_id, at, actor_id, deployment_id NULL)`: the event that opened each version.
  - Schema at time T: `WHERE valid_from <= T AND (valid_to IS NULL OR valid_to > T)`. An API name is unique per (object, time), enforced with an exclusion constraint or a check at write time.
- **Customer export (per-org analytical tables).** One defensible choice: per-org physical tables in the customer's own schema, with columns named by a stable mapping `export_columns (org_id, field_id, column_name, column_type, created_at, retired_at)`. A rename changes only the mapping's display label (a view exposes friendly names); an API name reused by a new field gets a new column because its field_id differs. A type change creates a new column (e.g. `region__v2`) or a converted column with the old one retired, and a view presents the current shape; history is not silently cast. Delete hides the column in views; restore unhides; purge drops the column and its data in every copy, logged with a completion record per copy.
- **Alternatives for the pipeline.** A wide table with typed generic slots per org (a slot allocator mapping field ids to `text_07`, `num_12`), attribute-value rows, or a semi-structured column. Each must show how a customer report with 40 fields over tens of millions of records is served (materialised wide views) and how type changes behave.
- **Cross-org metadata analytics.** `fct_org_schema_daily (snapshot_date, org_bucket, object_kind standard|custom, custom_field_count, field_type, deleted_within_30d_count)` built from ids, types, counts and timestamps only; no api names, labels, descriptions or picklist values ever leave the org's metadata store. "Share of orgs with an object within 10% of the {{field_limit}} limit" = orgs with any object at ≥ 0.9 × {{field_limit}} custom fields ÷ all orgs, reported as a share with small cells suppressed; org ids are not in the product-facing table (or are pseudonymised and access-controlled).
- **Scale.** {{schema_changes_per_day}} changes a day is small compared with record traffic, but arrives in bursts from deployments: process changes per org incrementally (only touched objects), batch a deployment's changes into one export migration.

**Competing designs to accept.** Generic slots or attribute-value storage for the export with materialised per-org views; JSON columns with a typed view per org regenerated on schema change; event-sourced metadata with snapshots. Any of these, if field identity is by id and purge reaches every copy.

**Bottlenecks and failure modes.** API names or labels as keys; ALTER TABLE storms at {{orgs}} orgs; casting historical values on type change; purge only in the primary store; cross-org pipelines that read labels or picklist values "just for statistics"; per-object field limits computed from current state only so deleted-but-restorable fields are miscounted (state the rule: in this exercise, deleted fields within the restore window still count toward the limit, or say which choice you make).

**Incident guidance.**
- *300 fields deleted and re-created with the same API names*: the export keyed on API names. Contain by freezing the customer's export and restoring the previous mapping; re-map history to the old field ids (now deleted) and start new columns for the new field ids; tell the customer which dashboards were affected. Guardrail: field id is the only join key; a test re-creates a field with a reused API name and checks history does not move.
- *Purge left copies*: list every copy (export tables, staging, caches, backups with their expiry) in a purge registry; purge each and record completion; delete the staging table that captured picklist values and remove that capture from the pipeline. Guardrail: purge is complete only when every registered copy confirms; a scan of cross-org stores for value columns fails the build.
- *Dashboard with org ids and labels shared with a partner team*: revoke access, remove labels from the product-facing table, report it through the privacy process, and rebuild the dashboard on bucketed shares with suppression. Guardrail: the cross-org model has no label or value columns at all, so the mistake cannot recur by query.

**Follow-up guidance.** (1) Two field ids: the old one now has api_name `Territory__c`; the new picklist has `Region__c`. The export keeps the old column (renamed in the view) and adds a new column. (2) New column or converted column with the old values kept; a saved report on old free text keeps working on history and shows unmapped values. (3) Delete hides, restore unhides with data, second delete and purge removes data everywhere; cross-org counts change only through type and count metrics. (4) Per org, max over objects of custom field count from field_versions at the date; share across orgs; suppression. (5) Process changes per org and object; purge registry with confirmations.

**Rubric anchors.** 2: one table per org altered in place, keyed by API name, labels used in analytics. 3: stable ids with versioned attributes, schema-as-of queries, a defended export layout with a mapping table, metadata-only analytics. 4: also purge propagation with proof, type-change handling that preserves history, burst handling and the label-as-customer-data reasoning.

**Strong signals.** Asks about API name reuse before designing; treats labels as customer data unprompted. **Red flags.** "Labels are just metadata, so they are fine to aggregate"; dropping history on a type change; purge implemented as a flag.

## SFC-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Environments.** `environments (env_id, org_id, kind production|sandbox, sandbox_type NULL, source_env_id, created_at)` and `env_refreshes (refresh_id, env_id, source_env_id, requested_by, started_at, completed_at, source_state_as_of)`. A refresh is an event; the next allowed refresh is completed_at + {{refresh_days}} days in this exercise.
- **Components and versions.** `components (component_id, org_id, type, api_name)`; `component_versions (version_hash, component_id, type, size_bytes, created_at)` — the hash identifies content; the content itself stays in the org's metadata store, never in analytics.
- **Environment state.** `env_component_state (env_id, component_id, version_hash NULL for deleted, valid_from, valid_to, change_kind creation|deployment|direct|refresh|destructive, change_id)`. A refresh closes every interval of the sandbox and opens intervals copying production's state at `source_state_as_of`; the old intervals remain queryable.
- **Deployments.** `deployments (deployment_id, source_env_id NULL, target_env_id, requested_by, requested_at, kind validate|deploy|quick_deploy, validated_by_deployment_id NULL, reverses_deployment_id NULL, status queued|running|succeeded|failed|cancelled, finished_at)`; `deployment_items (deployment_id, component_id, version_hash, action upsert|destructive)`; `deployment_tests (deployment_id, test_id, outcome, duration_ms)`. Status comes from the outcome event, never from the request. Only a succeeded deploy opens state intervals.
- **Direct changes.** `setup_audit (audit_id, env_id, actor_id, at, change_type, component_id)` plus the version hash read after the change; it opens a `direct` interval.
- **Drift.** A production component whose current interval has change_kind = direct and opened after the last deployment of that component. Before a deployment, compare each item's component with production's current interval: if it is a drift interval, block or require acknowledgement.
- **Questions.** Changes between T1 and T2: intervals of production with valid_from in [T1, T2), joined to deployments or audit entries for who and how. Which deployment introduced a version: the interval whose change_id is a deployment. Sandbox behind production: full outer join of current intervals by component_id where hashes differ, split into "changed in production since the sandbox's refresh" and "changed in the sandbox".
- **Rollback.** A new deployment with `reverses_deployment_id = X`: for each component X upserted, the version in force before X (from state intervals); for each component X added, a destructive change. Data in a field that X added is lost if the field is deleted, so the reversing deployment needs an explicit approval and an export of that data first, or the field is kept and hidden.
- **Health analytics.** `fct_deployment (deployment_id, org_bucket, kind, status, component_type_counts, test_count, test_duration_ms, queued_ms, run_ms, failure_component_type)`, partitioned by day; at {{deployments_per_day}} a day this is small; retain for years. No component content, names or code.

**Competing designs to accept.** Snapshots of each environment's full manifest (component → hash) per change event, with diffs computed between snapshots, if they handle direct changes between snapshots via the audit trail. A source-control-centric design where the repository is the source of truth, as long as direct changes and drift are modelled. Event sourcing of state changes with materialised current state.

**Bottlenecks and failure modes.** Nightly snapshots that miss same-day changes and their authors; status taken from the request; refresh overwriting sandbox history; rollback described as "restore the old org"; diffs over content instead of hashes; non-canonical serialisation making identical components hash differently (normalise before hashing); analytics reading customer code.

**Incident guidance.**
- *Integration sandbox refreshed before a release*: from the closed intervals, list every component whose version in the sandbox differed from production at refresh time — that is the lost work, with hashes and authors; recover the content from the source sandboxes or the repository. Guardrail: a refresh request shows the pending-work diff and requires confirmation; automation cannot refresh an environment with undeployed changes; the {{refresh_days}}-day limit is shown before the refresh, not after.
- *Failed deployment recorded as deployed*: correct the state by closing the wrongly opened intervals with a correction record (not a delete) and restoring the previous versions' intervals; status only from outcome events; a reconciliation that compares production's actual manifest with modelled state daily.
- *Hotfix overwritten*: query deployments whose items replaced an interval with change_kind = direct, across the production org and its {{sandboxes_per_org}} sandboxes, for the quarter; report each with the hotfix and its author. Guardrail: the pre-deployment drift check.

**Follow-up guidance.** (1) `env_component_state` for the production env with valid_from in the range, joined to change sources. (2) Previous versions for changed components plus destructive changes for added ones; data consequences and approval. (3) The sandbox's closed intervals before the refresh versus production's state; a warning computed from that diff before refresh. (4) Drift interval detection before the deployment. (5) Success rate = succeeded deploys ÷ deploys attempted (excluding validations, or reported separately); test duration per component type; daily partitions.

**Rubric anchors.** 2: a list of deployments with no environment state, or nightly snapshots only, and rollback as "restore". 3: component-version intervals per environment, deployments with items and outcome status, direct changes in the same history, a rollback as a reversing deployment. 4: also drift detection before deploy, refresh lineage with lost-work reporting, canonical hashing and metadata-only health analytics.

**Strong signals.** Asks how direct production changes are seen before designing; distinguishes validation from deployment. **Red flags.** Taking status from the request; treating a refresh as an overwrite with no history; analytics on component content.

## SFC-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Accounts and hierarchy.** `accounts (account_id, created_at)` with `account_versions (account_id, name, …, valid_from, valid_to)`; `account_parent_history (account_id, parent_account_id NULL, valid_from, valid_to, recorded_at, change_kind normal|backdated)`. Valid time and recorded time are both kept, so a backdated change is visible (bitemporal).
- **Derived hierarchy.** `account_closure (ancestor_id, descendant_id, depth, valid_from, valid_to)` or a path per account per version; `ultimate_parent (account_id, global_parent_id, valid_from, valid_to)` derived from it. Acyclicity and depth ≤ {{max_depth}} are checked when a parent link is ingested: a link that would create a cycle or exceed the depth is quarantined, never applied.
- **Contacts.** `contacts (contact_id, …)`; `account_contact_relations (relation_id, contact_id, account_id, role, is_primary, valid_from, valid_to, end_reason ended|deleted|merged, restored_from_relation_id NULL)`. A deleted relationship closes with end_reason = deleted; a restore within 15 days opens a new interval linked to the deleted one (or reopens it, explicitly), so the gap is visible.
- **Merges.** `merges (merge_id, object account|contact, loser_id, survivor_id, merged_at, steward_id)`, `merge_moves (merge_id, child_object, child_id, from_parent_id, to_parent_id)`. A resolved map `merge_resolution (original_id, current_survivor_id, resolved_at)` computed transitively (A → B → C resolves A to C); a merge whose survivor is already a loser is resolved at write time, and a merge that would create a cycle is rejected.
- **Facts.** `fct_opportunity_snapshot (snapshot_date, opportunity_id, account_id as recorded then, amount, stage, close_date)`: facts keep their original account id.
- **Rollups.** As reported at date D: snapshot at D joined to `ultimate_parent` valid at D, with ids as they were at D (no merge resolution after D). Restated: the same snapshot, account ids re-pointed through `merge_resolution` and joined to the hierarchy as currently known for D (or today's hierarchy, stated). Both views carry a label and a computed-at time; a "differences" view explains the change per parent by cause (merge, hierarchy change, backdated change).
- **Scale.** At {{accounts}} accounts and depth {{max_depth}}, the closure has at most accounts × depth rows per version; a re-parent of a subtree closes and opens rows for that subtree × the ancestors above it only.

**Competing designs to accept.** Materialised path strings per version instead of a closure; recursive queries at report time with a depth limit and cycle detection, if the hierarchy is small enough and point-in-time is respected; a type 2 dimension of account with a global-parent attribute recomputed on hierarchy change. Rewriting facts to survivors physically is acceptable only if the as-reported numbers are frozen elsewhere.

**Bottlenecks and failure modes.** Re-pointing facts in place (as-reported lost); inner joins to current accounts dropping loser ids; recursion without a depth limit or cycle check; contact-account bridge without dates; deletes and merges treated alike; backdated changes applied silently.

**Incident guidance.**
- *Cycle from a bulk import*: quarantine the offending links, restore the last valid hierarchy version, rerun the rollup, and label the dashboard's data time correctly (a stale run must show its own as-of time, not today's). Guardrail: the cycle and depth ({{max_depth}}) check at ingestion; the rollup has a depth bound and fails loudly; the dashboard shows the run timestamp.
- *Weekend of {{merges_per_month}} merges*: nothing is wrong with the data; the views were unlabelled. Publish both views with labels, produce a per-parent reconciliation from as-reported to restated by cause, and agree which one the board uses. Guardrail: every published rollup names its view.
- *Loser ids dropped by an inner join*: resolve facts through the merge map before joining (or LEFT JOIN and report unresolved ids); backfill the affected dashboard. Guardrail: a check that the sum of amounts before and after the account join is equal.

**Follow-up guidance.** (1) merges row (B → A); as reported: B's opportunities under B's old parent; restated: under A's parent. (2) Transitive resolution; reject a merge whose survivor resolves back to the loser. (3) Restated reports for the quarter change; as-reported reports already published do not; the backdated change is visible through its recorded_at. (4) Closure per version, or path, indexed by ancestor and validity. (5) A closed interval with end_reason deleted and a new one linked as restored; the gap is shown.

**Rubric anchors.** 2: a parent column overwritten, recursion over today's tree, facts re-pointed in place. 3: parent history with derived closure, a dated contact bridge, a merge map with transitive resolution, both rollup views. 4: also bitemporal handling of backdated changes, ingestion checks for cycles and depth, end reasons that distinguish deletes from merges and ends, and reconciliation between views.

**Strong signals.** Asks "as of which hierarchy?" before writing a rollup; keeps original keys on facts. **Red flags.** Overwriting account ids on facts; no cycle protection; deleting the loser's history.

## SFC-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH hourly AS (                               -- one row per org-hour: the latest load is the corrected count
  SELECT DISTINCT ON (org_id, hour_start) org_id, hour_start, requests
  FROM api_usage
  ORDER BY org_id, hour_start, loaded_at DESC
), running AS (
  SELECT org_id, hour_start, hour_start::date AS usage_day,
         SUM(requests) OVER (PARTITION BY org_id, hour_start::date ORDER BY hour_start) AS running,
         SUM(requests) OVER (PARTITION BY org_id, hour_start::date) AS day_total
  FROM hourly
), days AS (
  SELECT DISTINCT org_id, usage_day, day_total AS requests
  FROM running
), alloc AS (
  SELECT d.org_id, d.usage_day, d.requests,
         LEAST(e.base_requests + e.per_licence * l.licences, e.max_requests) + COALESCE(x.extra, 0) AS allocation
  FROM days d
  CROSS JOIN LATERAL (
    SELECT oe.edition FROM org_editions oe
    WHERE oe.org_id = d.org_id AND oe.effective_at <= d.usage_day::timestamptz
    ORDER BY oe.effective_at DESC LIMIT 1) ed
  JOIN editions e ON e.edition = ed.edition
  CROSS JOIN LATERAL (
    SELECT lc.licences FROM licence_changes lc
    WHERE lc.org_id = d.org_id AND lc.effective_at <= d.usage_day::timestamptz
    ORDER BY lc.effective_at DESC LIMIT 1) l
  LEFT JOIN LATERAL (
    SELECT SUM(a.extra_requests) AS extra FROM allocation_addons a
    WHERE a.org_id = d.org_id AND d.usage_day BETWEEN a.starts_on AND a.ends_on) x ON TRUE
)
SELECT a.org_id, a.usage_day, a.allocation, a.requests,
       ROUND(100.0 * a.requests / a.allocation, 1) AS pct_used,
       MIN(r.hour_start) FILTER (WHERE r.running * 100 >= a.allocation * 80) AS crossed_80_at,
       MIN(r.hour_start) FILTER (WHERE r.running >= a.allocation) AS crossed_100_at
FROM alloc a
JOIN running r ON r.org_id = a.org_id AND r.usage_day = a.usage_day
WHERE a.requests * 100 >= a.allocation * 80
GROUP BY a.org_id, a.usage_day, a.allocation, a.requests
ORDER BY a.usage_day, a.org_id;
```

**Explanation.** The hourly feed is reduced to one row per (org_id, hour_start) first — at Medium and Hard that changes nothing; at Very Hard it keeps the latest load, which replaces earlier ones. Running and daily totals are window sums partitioned by org and UTC day (the session time zone is UTC, so `hour_start::date` is the UTC day). The allocation is computed once per org-day: two LATERAL lookups take the edition and licence row in force at 00:00 (inclusive), the cap applies to the licence-based part, and add-ons are summed per org-day in their own LATERAL subquery so they never multiply hourly rows. The threshold tests stay in integers, and the first crossing is a filtered MIN over the running total. Days that never reach 100% get NULL from the filtered MIN.

**Complexity.** One sort of the usage rows (DISTINCT ON and the windows share the order), plus two index-friendly LATERAL lookups and one add-on aggregate per org-day. In production the allocation would be a small daily table computed once per org-day (it changes only at 00:00), and usage would be a pre-aggregated hourly table partitioned by day.

**Dialect notes.** `DISTINCT ON` and `FILTER (WHERE …)` are PostgreSQL. Snowflake and BigQuery: `QUALIFY ROW_NUMBER() OVER (PARTITION BY org_id, hour_start ORDER BY loaded_at DESC) = 1`, and `MIN(IFF(cond, hour_start, NULL))` (Snowflake) or `MIN(IF(cond, hour_start, NULL))` (BigQuery) instead of FILTER. LATERAL with LIMIT works in Snowflake only in limited forms; the portable version is a range join with `ROW_NUMBER() OVER (PARTITION BY org_id, usage_day ORDER BY effective_at DESC) = 1`, or an ASOF JOIN where the engine has one (Snowflake, DuckDB). In Snowflake and BigQuery, `LEAST` returns NULL if any argument is NULL (PostgreSQL ignores NULLs), which matters if a cap can be missing. Spark SQL lacks QUALIFY in older versions (use a subquery). MySQL 8 has no FILTER, no DISTINCT ON and no LATERAL before 8.0.14. None of these variants is executed here.

**Edge cases built into the data.** A licence change at exactly 00:00 (applies that day) and one mid-day (applies the next day); an add-on whose dates partly cover the window; a day landing exactly on 80% (sometimes with no later buckets, so it is reported with crossed_100_at NULL); a bucket bringing the running total exactly to 100%; days below 80% and days with no usage (no rows). Hard adds a binding `max_requests` cap, an add-on ending exactly on a reported day, an add-on that ended before the window, licence decreases, and a bucket that crosses 80% and 100% at once. Very Hard adds an edition upgrade inside the window (at 00:00 or mid-day) and re-loaded hours whose preliminary counts are lower or higher than the corrected count, sometimes loaded three times.

**Common mistakes.** Exclusive thresholds; today's licence count for every day; applying a mid-day licence change to the same day; `effective_at < day start`; ignoring add-ons; a running total not reset at midnight; keeping only days that reached 100%; integer division in pct_used; (Hard+) ignoring the cap or treating `ends_on` as exclusive; (Very Hard) summing loads, keeping the earliest load, or using today's edition. Each has a diagnostic. Joining add-ons directly to hourly usage multiplies requests when two add-ons overlap.

**Follow-up guidance.** (1) For each bucket, the sum of the last 24 buckets (`RANGE BETWEEN INTERVAL '23 hours' PRECEDING AND CURRENT ROW`) compared with the allocation in force at that bucket's end; a licence change then takes effect within the day, and the candidate should say which instant's allocation applies. (2) Per org: the current day's running total, the day's allocation and flags for warnings already sent, keyed by (org, day); an idempotent warning key; a nightly comparison with this query. (3) Do not retract silently: the warning was correct on the data at the time; record it, show the corrected numbers in the report, and if the policy says so, send a correction. (4) Allocation as of today (or the latest licence row) against each of the last seven daily totals; flag orgs with any day ≥ 100%.

**Rubric anchors.** 2: right shape but the current licence count, or add-ons multiplying rows, or a running total over all days. 3: matches the expected result. 4: also explains rolling windows, streaming warnings with idempotent keys, and how late corrections are reported.

**Strong signals.** Computes the allocation per org-day before touching hourly rows; compares integers without being told. **Red flags.** Rounded percentage compared with 80; MAX(effective_at) over the whole history; summing re-loads.
