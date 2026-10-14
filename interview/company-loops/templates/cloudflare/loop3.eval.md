# Cloudflare · Loop 3 — evaluator notes (hidden from candidates)

## CFX-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Entities.**
  - `zones (zone_id, account_id, name, created_at, status)`; zone lifecycle changes (added, activated, moved, deleted) are rows in `zone_events`.
  - `records (record_id, zone_id, created_at, deleted_at NULL)`: identity only. The id survives edits; delete-and-recreate gets a new id.
  - `record_versions (record_id, version, zone_id, name, type, value, ttl, proxied, valid_from, valid_to, change_id)`: one row per committed state, with `[valid_from, valid_to)` and `valid_to = 'infinity'` for the live version. An exclusion constraint (or a write path that closes the previous interval in the same transaction) stops overlaps.
  - `change_sets (change_id, zone_id, committed_at, actor_kind member|token, actor_id, token_owner_member_id NULL, interface api|dashboard|import, request_id, kind create|update|delete|import_add|import_replace, is_noop)`. A bulk import is one change set covering many record versions, committed atomically.
  - `actors` is a stable directory: member ids and token ids with their creator, created and deleted times. Token secrets never exist here; display names are attributes, never keys.
- **No-op writes.** The write path compares the new state with the live version. An identical write creates no new version; it is recorded as a `change_sets` row with `is_noop = true` (or counted in a per-zone, per-hour no-op counter) so automation behaviour is visible but history and counts stay readable.
- **As of.** `SELECT … FROM record_versions WHERE zone_id = :z AND valid_from <= :t AND :t < valid_to`. Index `(zone_id, valid_from)` or a GiST index on `(zone_id, tstzrange(valid_from, valid_to))`; partition by zone hash. Committed time is the system time; optionally `first_served_at` from propagation telemetry is a second axis (bitemporal) for "what did resolvers get".
- **Analytics.** `fct_record_change (change_id, record_id, zone_id, account_id, committed_at, type, interface, actor_kind, proxied_before, proxied_after, kind, is_noop)` — no values. "Zones switching to proxied this month" is `COUNT(DISTINCT zone_id) WHERE proxied_before = false AND proxied_after = true`. A monthly `zone_record_mix` snapshot (counts by type and proxied flag) serves trend dashboards.
- **Retention.** Versions and change sets for {{history_years}} years in the operational history store (cold partitions in columnar files); facts kept as long; values in facts never.

**Competing designs to accept.** Event-sourced zone aggregates where the change log is the source of truth and versions are a projection. Storing full zone snapshots per change set (content-addressed and deduplicated), if as-of queries stay exact and storage is estimated. A bitemporal model with both committed and first-served time, if they explain which question each answers.

**Bottlenecks and failure modes.** Update-in-place with `updated_at` (history lost); daily snapshots (short-lived states missed); keying actors by display name; imports as many independent commits (transient empty zones); no-ops creating versions at {{daily_changes}} a day; record values copied into analytics; as-of queries scanning every version of a zone without an interval index.

**Incident guidance.**
- *Automation re-applies every record every 10 minutes*: with {{api_share}} of changes via the API, no-op writes dominate. Contain by collapsing identical writes at the write path (no new version, an `is_noop` change set or a counter); backfill by marking historical no-ops (version equals predecessor) and hiding them in support views; guard with a metric of no-op share per token and a dashboard filter that defaults to real changes.
- *Replace-all import as delete then create*: make an import one change set committed atomically, so versions close and open at the same `committed_at`; correct the audit by re-labelling those change pairs as one import and regenerating the customer's report; add a test that the as-of view never shows a zone without its apex records during an import.
- *Deleted token, display name reused*: key actors by immutable token and member ids, keep the token's creator and deletion time in the actor directory, and backfill the affected change sets from request logs where the token id was recorded; never show the secret, and show "token (deleted), created by member X" to support.

**Follow-up guidance.** (1) The interval query above; GiST or `(zone_id, valid_from)` plus `valid_to > :t`, partitioned by zone. (2) No new version for identical writes; counts exclude `is_noop`. (3) One change set: every old version closes and every new one opens at the same instant; as-of one second before shows the old zone, at and after shows the new. (4) Stable ids; show member or token id, interface and request id; never secrets or the token's value. (5) Keep change facts for the window; monthly toggle counts come from the change fact (proxied_before/after), not from scanning versions.

**Rubric anchors.** 2: a records table updated in place, or daily snapshots, and actors as names. 3: stable record ids, append-only versions with intervals, change sets with actor ids and interface, values kept out of facts. 4: also no-op handling, atomic imports, deleted-actor attribution, bitemporal reasoning about served time, and a storage and retention plan.

**Strong signals.** Asks how record identity works before drawing tables; keeps record values out of analytics unprompted. **Red flags.** Overwriting rows; reconstructing history from nightly snapshots; storing token secrets or keying actors by display name.

## CFX-L3-02

**Reference architecture (one defensible design).**
- **Definitions.**
  - `custom_rules (rule_id, account_id, created_at, deleted_at)` and `custom_rule_versions (rule_id, version, expression, action, enabled, description, created_at, created_by)`.
  - `managed_rulesets (ruleset_id)`, `managed_releases (ruleset_id, release_version, published_at)` and `managed_release_rules (ruleset_id, release_version, rule_id, group_id, default_action, default_enabled, sensitivity)`. Releases are immutable; rule ids are never reused.
- **Deployments.** `deployments (deployment_id, scope_kind account|zone, scope_id, phase, position, target_kind ruleset|rule_list, target_id, target_version, status, deployed_at, actor_id)`. The ordered list for a scope is a version: `rule_list_versions (scope, list_version, ordered entries)`.
- **Overrides.** `overrides (override_id, scope_kind, scope_id, ruleset_id, target_kind ruleset|group|rule, target_id, setting action|enabled|sensitivity, value, valid_from, valid_to, actor_id)`. Precedence in this exercise: rule over group over rule set, zone over account. An override whose target no longer exists in the deployed release is flagged `orphaned` by a job that runs at every release.
- **Effective configuration.** `effective_config (zone_id, config_version, config_hash, valid_from, valid_to, built_from: list versions, release versions, override ids)` computed at deploy time whenever any input changes. Each security event carries `config_version`, `rule_id`, `rule_version` (or release version for managed rules), `action`, and the `override_id` that changed the action if any.
- **Events and facts.** `security_events (event_id, zone_id, occurred_at, config_version, final_rule_id, final_rule_version, action, override_id NULL, logged_rule_ids)` kept {{event_retention_days}} days; `fct_events_daily (zone_id, day, rule_id, rule_version, action, override_applied, events)` kept long. Override effect: events where `override_id` is set, by setting changed.
- **Expressions** stay in the configuration history, visible to the customer; events carry ids only.

**Competing designs to accept.** Deriving the effective configuration on demand from the three layers (if reproducible and cached), instead of materialising it. Recording only `config_hash` on events and resolving rule versions from a content-addressed configuration store. A single versioned document per zone holding the whole effective configuration, if per-rule queries are served from an exploded fact table.

**Bottlenecks and failure modes.** Overrides as JSON blobs (unqueryable); attribution by event time against deployment time (propagation makes this wrong); joining events to the current rule version; removed managed rules leaving orphaned overrides unnoticed; copying expressions onto events; recomputing effective configuration for every zone at every managed release ({{managed_releases_per_month}} releases a month across {{zones_with_rules}} zones — do it incrementally, only for zones whose deployed rule set changed).

**Incident guidance.**
- *A managed release moves a detection to a new rule id and overrides stop applying*: contain by flagging zones whose overrides became orphaned at that release and notifying them; offer a mapping (old id → new id) in the release metadata so overrides can be carried forward deliberately, not silently. Guardrail: the release pipeline computes, before publication, how many active overrides each removal orphans.
- *Event without a rule version*: support showed the current expression. Correct by stamping `config_version` on every event and resolving the expression from history; for old events without it, show "version unknown" rather than the current text. Guardrail: a schema check that rejects events without a version.
- *Attribution by time*: events from locations that had not yet received the new configuration were credited to it. Fix by attributing via the config version on the event; report propagation time as its own measure.

**Follow-up guidance.** (1) Resolve the default from the release, then apply account overrides and zone overrides in precedence order; done at deploy time into the effective configuration, verifiable at query time. (2) Events carry whichever version each location was running; both versions appear for those minutes. (3) Orphaned overrides recorded and surfaced to the affected customers with the mapping if one exists. (4) Configuration answers what could have matched; the event itself is gone, and the customer sees aggregate facts only. (5) Changes × zones affected; materialise per zone with intervals, and deduplicate identical configurations by hash.

**Rubric anchors.** 2: one rules table with current values and events joined by rule id. 3: versioned rules and releases, deployments over time, overrides as rows with precedence, events carrying versions. 4: also an effective-configuration version on events, orphaned-override detection at release time, propagation-aware attribution and incremental recomputation.

**Strong signals.** Separates definition, deployment and override; insists that events carry versions. **Red flags.** Joining events to the latest rule; overrides stored as unqueryable blobs; copying expressions into every event.

## CFX-L3-03

**Reference architecture (one defensible design).**
- **Definitions.** `cache_rule_lists (zone_id, list_version, deployed_at, actor_id)`; `cache_rules (zone_id, list_version, position, rule_id, expression)`; `cache_rule_settings (zone_id, list_version, rule_id, setting eligibility|edge_ttl|browser_ttl|cache_key, value)`. Reordering or editing creates a new list version (at most {{rule_limit}} rules).
- **Cache key definitions** as data: `cache_key_defs (key_def_id, include_params[], exclude_params[], ignore_all_params, header_parts[], cookie_parts[])`, referenced by the `cache_key` setting. A fingerprint is a hash of (host, path, the included parameter names and values, the declared header/cookie parts); only the hash and the part names are recorded.
- **Resolution.** For each setting, the effective value is the last matching rule (by position) that sets it, else the default ({{default_ttl}} edge TTL for eligible content). Store per request which rule set each setting.
- **Request records.** Complete counters: `zone_hourly_cache (zone_id, hour, list_version, cache_status, requests, bytes)` from all requests. Sampled detail ({{log_sample}}): `sampled_requests (zone_id, ts, sample_weight, list_version, matched_rule_ids, rule_for_eligibility, rule_for_edge_ttl, rule_for_cache_key, key_def_id, cache_key_fp, path_template, cache_status, response_fp)`.
- **Facts.** `fct_rule_hourly (zone_id, hour, list_version, rule_id, setting, est_requests = Σ weight, est_hits)` with a confidence interval; `fct_key_fanout (zone_id, day, path_template, distinct_keys, distinct_response_fp_per_key)`.
- **Hit ratio definition (state it).** Hits (hit + revalidated, or hits only — either if stated) ÷ eligible requests (excluding bypass and dynamic). Per request and per byte both offered.

**Competing designs to accept.** Recomputing effective settings at query time from the definitions and the request's URL (if every request carries the list version). Recording only matched rule ids and deriving "who set what" downstream. Complete per-rule counters on all requests instead of sampling, if they justify the cost at {{daily_requests}} a day.

**Bottlenecks and failure modes.** First-match semantics assumed; attribution by current rule position; raw query strings in logs; sampled per-rule numbers shown without uncertainty; cache-key changes that merge variants detected only by complaints; hit ratio definitions that silently include bypassed requests.

**Incident guidance.**
- *Ignoring all query parameters serves stale versioned stylesheets*: contain by adding the version parameter back to the key (a new list version) and purging the affected paths; the old entries would otherwise live until the {{default_ttl}} default lapsed. Detect next time with `fct_key_fanout`: one cache key fingerprint mapping to several response fingerprints (or a jump in distinct query parameters per key) alarms.
- *Reorder moves numbers between rules*: facts were keyed by position. Re-key by `rule_id` and `list_version`, rebuild last week's per-rule facts, and add a test that a reorder changes no historical per-rule number.
- *Sample disagrees with totals*: per-rule numbers from the {{log_sample}} sample are estimates. Show intervals, calibrate sampled totals to complete counters per zone and hour (ratio adjustment), and never display a sampled estimate where a complete count exists.

**Follow-up guidance.** (1) Eligibility and TTL from rule 1, key from rule 2, then bypass from rule 3 overrides eligibility; record per setting. (2) A new list version; compare hit ratio for matching traffic in equal windows before and after, same weekdays, and show volume changes. (3) Σ weights with a binomial or bootstrap interval; for small rules, widen the window or show "insufficient sample". (4) Response fingerprints per cache key; >1 means variants merged. (5) Status totals and zone hit ratio from complete counters; per-rule and per-key detail from the sample, calibrated to the totals.

**Rubric anchors.** 2: current rules only, first-match, hit ratio from raw logs without definition. 3: versioned rule lists, per-setting resolution, cache key as data with fingerprint, request records carrying the list version, a stated hit-ratio definition. 4: also variant-merge detection, sampled estimates with intervals reconciled to totals, and privacy of query strings handled.

**Strong signals.** Asks which rule wins before modelling; defines hit ratio's numerator and denominator. **Red flags.** Raw URLs with query strings in analytics; per-position attribution; sampled numbers presented as exact.

## CFX-L3-04

**Reference architecture (one defensible design).**
- **Scripts and versions.** `scripts (script_id, account_id, name, created_at, deleted_at)`; `script_versions (script_id, version_id, created_at, actor_id, code_hash, compatibility settings)`, immutable; `version_bindings (version_id, binding_name, binding_type kv|object_class|bucket|service|var|secret, target_resource_id NULL, var_value_ref NULL)`. Secrets: name and type only; values live only in the secret store. Plain variables are treated as possibly sensitive too: stored by reference and excluded from exports and analytics by default.
- **Binding history without copies.** Bindings belong to a version; a version that reuses a parent's bindings references them by a binding-set hash, so up to {{max_bindings}} rows are written only when the set changes.
- **Deployments.** `deployments (deployment_id, script_id, created_at, actor_id, valid_from, valid_to)` and `deployment_versions (deployment_id, version_id, percentage)` (100, or a split such as {{gradual_split}} and the rest).
- **Routes.** `routes (route_id, zone_id, pattern, script_id, valid_from, valid_to, actor_id)` and `custom_domains (hostname, script_id, valid_from, valid_to)`; precedence (most specific pattern wins) computed by a function stored with a version so it is reproducible; a route-change fact records, per hostname and path prefix, the script before and after.
- **Storage resources.** `resources (resource_id, account_id, type, name, created_at, deleted_at)` with rename rows; bindings point at ids, so deletion leaves history intact and the dangling binding is visible.
- **Invocation records.** `(ts, script_id, version_id, deployment_id, route_id or trigger, outcome, cpu_ms, subrequests, bound_resources_touched[])` — resource ids, never keys or values. Facts: `fct_version_hourly (script_id, version_id, deployment_id, hour, requests, errors, cpu_ms quantiles)`; `fct_binding_daily (resource_id, day, script_id, version_id)`.

**Competing designs to accept.** Storing the whole version configuration as an immutable document plus an exploded binding table for queries. Deriving route precedence at query time from route history (if the precedence rule is versioned). Event-sourced deployments with projections.

**Bottlenecks and failure modes.** Mutable "current" script rows; bindings keyed by name rather than by target id; secret or variable values in configuration exports; route attribution by hostname only; deleted resources erasing history; copying every binding per deployment at {{deploys_per_day}} a day.

**Incident guidance.**
- *Preview namespace bound during a {{gradual_split}} split*: the version's binding target differed under the same name. Answer the customer from invocation records (version id) joined to that version's bindings (target resource id): every invocation on the new version in the window touched the preview namespace. Contain by rolling the deployment back; guard with a deploy-time diff that highlights binding target changes between the versions in a split.
- *Plain variables exported with values*: remove the export and the analytics table copy, rotate the exposed credential with the customer, and tell them. Guardrail: exports and analytics carry variable names and types only; values need an explicit, audited request by the owner.
- *More specific route silently moves traffic*: attribution by hostname hid it. Record the matched route id on each invocation, emit a route-change fact per hostname and path prefix when routes change, and show a "traffic moved" notice on both scripts.

**Follow-up guidance.** (1) Per-version error rate over the same windows, with the split percentage and per-version request counts; compare only during the split, by route. (2) Invocation's version id → that version's binding row → target resource id. (3) Deleted resource keeps its id and deletion time; the dangling bindings show; past usage from `fct_binding_daily`. (4) Routes valid at each instant plus the precedence rule; the route-change fact gives before/after for the path. (5) Binding sets by hash; a version references its set.

**Rubric anchors.** 2: a scripts table with current code and bindings by name; secrets not considered. 3: immutable versions with binding rows to resource ids, deployments with splits, versioned routes, invocation records with version ids, secrets by name only. 4: also binding-set deduplication, route precedence reproducibility, dangling-binding visibility and the treatment of plain variables as possibly sensitive.

**Strong signals.** Raises secrets before being asked; models resources with stable ids. **Red flags.** "Latest version" attribution during a split; storing secret values anywhere outside the secret store; deleting history with the resource.

## CFX-L3-05

**Reference solution** (PostgreSQL; `{{min_requests}}` is the instance's floor)

```sql reference
WITH dz AS (                          -- one row per succeeded deployment and zone it applies to
  SELECT d.deployment_id, z.zone_id, d.deployed_at
  FROM waf_deployments d
  JOIN zones z
    ON z.zone_id = d.zone_id
    OR (d.zone_id IS NULL AND z.account_id = d.account_id)
  WHERE d.status = 'succeeded'
), w AS (                             -- window bounds, cut by the neighbouring deployments of the zone
  SELECT deployment_id, zone_id, deployed_at,
         GREATEST(deployed_at - INTERVAL '1 hour',
                  LAG(deployed_at)  OVER (PARTITION BY zone_id ORDER BY deployed_at)) AS before_start,
         LEAST(deployed_at + INTERVAL '1 hour',
               LEAD(deployed_at) OVER (PARTITION BY zone_id ORDER BY deployed_at))    AS after_end
  FROM dz
), c AS (
  SELECT w.deployment_id, w.zone_id,
         COUNT(r.request_id) FILTER (WHERE r.occurred_at <  w.deployed_at)                          AS req_b,
         COUNT(r.request_id) FILTER (WHERE r.occurred_at <  w.deployed_at AND r.action = 'block')   AS blk_b,
         COUNT(r.request_id) FILTER (WHERE r.occurred_at >= w.deployed_at)                          AS req_a,
         COUNT(r.request_id) FILTER (WHERE r.occurred_at >= w.deployed_at AND r.action = 'block')   AS blk_a
  FROM w
  LEFT JOIN requests r
    ON r.zone_id = w.zone_id
   AND r.occurred_at >= w.before_start
   AND r.occurred_at <  w.after_end
  GROUP BY w.deployment_id, w.zone_id
), p AS (
  SELECT deployment_id, zone_id, req_b, req_a,
         CASE WHEN req_b >= {{min_requests}} THEN ROUND(100.0 * blk_b / req_b, 2) END AS pct_b,
         CASE WHEN req_a >= {{min_requests}} THEN ROUND(100.0 * blk_a / req_a, 2) END AS pct_a
  FROM c
)
SELECT deployment_id, zone_id,
       req_b AS requests_before, pct_b AS blocked_pct_before,
       req_a AS requests_after,  pct_a AS blocked_pct_after,
       pct_a - pct_b AS change_pp
FROM p
ORDER BY deployment_id, zone_id;
```

**Explanation.** The report is driven by deployments, so the query starts from them: one row per succeeded deployment and zone (a zone-level deployment gives one row; at Very Hard an account-level deployment with `zone_id` NULL fans out to every zone of its account). `LAG` and `LEAD` over those rows, partitioned by zone and ordered by time, give the previous and next deployment affecting the zone; because failed deployments were filtered out first, they never cut a window. PostgreSQL's `GREATEST` and `LEAST` ignore NULL arguments, so the first and last deployment of a zone keep their full hour. One LEFT JOIN over the whole span `[before_start, after_end)` keeps deployments with no traffic, and `COUNT(r.request_id)` (not `COUNT(*)`) counts 0 for them; the split between before and after is a `FILTER` against `deployed_at`, which makes a request exactly at `deployed_at` an after request. `100.0 *` makes the division numeric; `ROUND(numeric, 2)` rounds half away from zero; the CASE leaves windows under the floor NULL, and `change_pp` is NULL whenever either side is.

**Complexity.** The deployments side is tiny (a sort per zone for the window functions). The join reads each zone's requests inside its windows; with an index or clustering on `(zone_id, occurred_at)` that is a range scan per window, O(requests in windows). In production this runs against per-zone, per-minute (or per-second) counts of requests and blocks rather than raw rows; minute buckets are exact only if windows are cut at minute boundaries, so either keep a raw tail for the partial minutes at each end or accept the approximation and say so.

**Dialect notes.** Snowflake, BigQuery and Spark SQL have no `FILTER` clause: use `COUNT_IF(…)` (Snowflake, BigQuery, Spark) or `SUM(CASE WHEN … THEN 1 ELSE 0 END)` (all, including MySQL 8). In Snowflake, BigQuery and MySQL `GREATEST`/`LEAST` return NULL when any argument is NULL, so wrap the LAG/LEAD in `COALESCE(…, deployed_at - INTERVAL 1 HOUR)` (or a far-future sentinel for LEAD). Interval syntax: `DATEADD(hour, -1, deployed_at)` (Snowflake), `TIMESTAMP_SUB(deployed_at, INTERVAL 1 HOUR)` (BigQuery), `deployed_at - INTERVAL 1 HOUR` (MySQL, Spark). BigQuery's `ROUND` on FLOAT64 can differ at exact halves; use NUMERIC. MySQL integer division with `/` returns a decimal, but `DIV` truncates. None of these variants is executed here.

**Edge cases built into the data.** A request exactly at a deployment's `deployed_at` (after window); one exactly an hour before a deployment (before window); one exactly an hour after (not in that deployment's after window); a failed deployment (no row); a zone with no traffic at all (a row with 0 requests and NULL shares); a newly onboarded zone whose first before window holds fewer requests than the floor (NULL share and NULL change); challenges and logs that are not blocks; blocks by rules other than the deployed one. Hard adds deployments to the same zone 15–50 minutes apart (windows cut by LAG/LEAD), sometimes a third close deployment before them, and a failed deployment inside a succeeded one's window (it must not cut it). Very Hard adds an account-level deployment within an hour of a zone-level one (it fans out to every zone of the account, including the silent one, and cuts and is cut by zone-level deployments), and sometimes a second account-level deployment in the other account.

**Common mistakes.** BETWEEN or `<=` at the window ends (a request at `deployed_at` counted twice or in the wrong window); counting challenges as blocks; joining requests without the zone condition; counting only the deployed rule's blocks; computing a share for a window under the floor; an inner join that drops quiet deployments; leaving failed deployments in (reported, or inside the LAG/LEAD frame so they cut windows); (Hard+) full-hour windows that ignore neighbours; (Very Hard) ignoring account-level deployments, or computing LAG/LEAD separately for zone-level and account-level rows. Each has a diagnostic. Integer division (`100 * blk / req` with integers) also gives wrong shares.

**Follow-up guidance.** (1) Per-zone per-minute counts of requests and blocks (complete, not sampled) in a columnar store clustered by zone and time; windows assembled from minute buckets plus raw rows at the edges, or windows aligned to minutes by policy. (2) Look at blocks by the deployed rule versus others, the request volume change, the same hour on previous days, and other zones without the deployment (a comparison group); the report shows co-occurrence, not cause. (3) `SUM(weight)` for requests and blocked; the floor should apply to the number of sampled rows (or to an interval width), not the weighted estimate. (4) Use per-location activation times if available and exclude a short guard interval after `deployed_at`, reporting it separately.

**Rubric anchors.** 2: right shape but BETWEEN boundaries, an inner join, or failed deployments included. 3: matches the expected result at the candidate's level. 4: also explains pre-aggregation at scale, why the report cannot prove causation, sampling weights, and propagation time.

**Strong signals.** Starts from deployments, asks about the boundary at `deployed_at` before writing, and filters failed deployments before the window functions. **Red flags.** `COUNT(*)` after a LEFT JOIN (counts 1 for quiet deployments); integer division; claiming the change was caused by the rule.
