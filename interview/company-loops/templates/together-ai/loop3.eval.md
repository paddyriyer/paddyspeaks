# Together AI · Loop 3 — evaluator notes

Simulated practice scenarios; every price, capacity, limit, volume and schema is
hypothetical and "this exercise's rule; check current docs". Nothing here describes a
real customer or internal system. Score designs on the criteria, not on matching the
reference.

## TGA-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Files.** `files (file_id, customer_id, purpose training|validation, sha256, bytes, line_count, format, uploaded_at, deleted_at)`. Immutable apart from `deleted_at`; contents live in object storage and are removed on deletion, the row stays as a tombstone so lineage survives. A corrected dataset is a new `file_id`; the display name is an attribute, never the identity.
- **Validation.** `validation_runs (run_id, file_id, validator_version, token_rule_version, started_at, finished_at, outcome passed|failed, examples, total_tokens, max_example_tokens)` and `validation_errors (run_id, line_no, error_code, field_path, count)` with codes like `role_order`, `too_long`, `empty_assistant_turn`, `duplicate_key`. Only counts, 1-based line numbers, codes and token totals; no excerpt of the line. Every run is a row; "the file's status" is the latest run for a stated validator version.
- **Job configuration.** `jobs (job_id, customer_id, base_model_version_id, method lora|full, training_file_id, validation_file_id, epochs, learning_rate, batch_size, submitted_at, suffix)` plus `job_lora_settings (job_id, rank, alpha, dropout, target_modules[])` with a check that only `method = 'lora'` jobs have a row (or a typed column group with `CHECK (method = 'lora') = (rank IS NOT NULL)`). Immutable after submission; the job records the validation run it relied on.
- **Attempts and states.** `job_attempts (attempt_id, job_id, attempt_no, reason_started first|infra_retry)`; `job_events (attempt_id, seq, state queued|running|saving|completed|failed|cancelled, at, failure_stage, error_code)` insert-only. Derived `fct_job_attempt (attempt_id, queued_at, started_at, ended_at, outcome, queue_minutes, run_minutes)` and `fct_job (job_id, final_outcome, failed_at_validation bool, attempts)`. The customer's view shows one job with its events; operations read attempts.
- **Checkpoints and models.** `checkpoints (checkpoint_id, attempt_id, step, epoch, eval_loss, artefact_uri, sha256, bytes, created_at, expires_at, deleted_at)`. `models (model_id, customer_id, kind adapter|full_weights, job_id, checkpoint_id, base_model_version_id, training_file_id, training_file_sha256, artefact_uri, sha256, created_at, deleted_at)`: the produced model has its own artefact copy (promotion copies, never points at the checkpoint path) and carries denormalised lineage keys so it survives checkpoint expiry and file deletion.
- **Size.** At {{jobs_per_day}} jobs a day with {{checkpoints_per_job}} checkpoints each, checkpoint rows are small (millions a year); events are tens per attempt. Artefact bytes dominate: rank-dependent adapters are small, full weights large; {{retention_days}}-day expiry of non-promoted checkpoints is the main storage control. Partition events by month; cluster by customer.
- **Access.** Every table carries `customer_id`; customer views filter by it. Validation results never leave the customer's scope except as aggregated error-code counts.

**Competing designs to accept.** One `jobs` table with a JSONB `hyperparameters` column plus a JSON schema per method and generated columns for reported fields (rank, method), if validation is enforced at write. SCD type 2 rows for job state instead of events, if derived from source events and attempts are kept. Event sourcing for the whole job with projections. Storing validation results as a per-run summary document plus an error table, as long as no text is kept.

**Bottlenecks and failure modes.** Status overwritten in place; retries reusing one row; validation results overwritten when the validator changes; file name used as identity; method settings as nullable columns with no check (full fine-tunes carrying ranks); lineage via storage paths that expire; error excerpts that copy customer text into logs or analytics.

**Incident guidance.**
- *Validator upgrade overwrote results*: restore prior runs from the change log or backups where possible, re-key results by `(file_id, validator_version)`, and show the customer the run their job relied on (the job stores its `validation_run_id`). Guard: validation runs insert-only; jobs reference the run, not the file's current status; a release of a new validator version reports how many existing files it would newly reject before rollout.
- *Retry overwrote the first attempt*: rebuild attempts from the event log (two `queued` events per job) and backfill `job_attempts`; correct the weekly queue-time report. Guard: attempts are separate rows with `attempt_no`; a test that a job with an infrastructure retry yields two attempt rows and two queue durations; the retry-rate metric is alerted when it drops to zero at {{jobs_per_day}} jobs a day.
- *Promoted model pointed at an expired checkpoint*: find every model whose artefact URI is under a checkpoint prefix; for those still within retention, copy the artefact; for lost ones, tell the affected customers plainly and offer a retrain from the recorded file and config (if the file still exists). Guard: promotion copies the artefact and stores its own checksum; the expiry job refuses to delete any object referenced by a live model; lineage keys live on the model row.

**Follow-up guidance.** (1) Two files (the failing one and the corrected one), two validation runs with error rows only for the first, one job, two attempts, event rows for each, three checkpoints, one model row pointing at the final checkpoint and the second file. (2) Reports on "files failing validation by validator version" change only for the new version; the job's own record still points at the passing run under the old version; the customer sees both runs labelled with the version. (3) `SELECT model_id FROM models WHERE training_file_id = :f` (or by checksum, which also finds the same bytes uploaded twice), plus jobs that failed; no contents needed. (4) Jobs ≈ {{jobs_per_day}} × 365; checkpoints × {{checkpoints_per_job}}; events tens per attempt; artefact bytes depend on method and model size; partition events and checkpoints by month, expire non-promoted checkpoints after {{retention_days}} days.

**Rubric anchors.** 2: a jobs table with a status column, a JSON config and a path to the output. 3: immutable files and configs, versioned validation runs without content, attempts and events, checkpoints and models with lineage. 4: also method subtypes enforced, lineage surviving expiry and deletion, validator-version reasoning, volume estimate at the stated scale, and crisp incident handling.

**Strong signals.** Asks what the validation result may contain before designing it; separates the job the customer sees from attempts operations need. **Red flags.** Storing sample lines in validation errors; identity by file name; model lineage only through a checkpoint path.

## TGA-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Endpoints.** `endpoints (endpoint_id, customer_id, created_at, deleted_at)` and `endpoint_config_versions (endpoint_id, version_no, valid_from, valid_to, base_model_version_id, min_replicas, max_replicas, hardware_class)`; a base model change is a new config version.
- **Replicas.** `replicas (replica_id, endpoint_id, config_version_no, started_at, ready_at, stopped_at)`, built from scale events with `event_id` for deduplication. Billing: per replica interval, `ceil((stopped_at − started_at) / 60s)` minutes (each started minute in full; this exercise's rule), split by UTC day by clipping the interval and applying the rule to the per-day pieces in a stated way (the reference: assign each started minute to the day it starts in). `fct_replica_minutes (endpoint_id, day, replica_minutes)`.
- **Adapters.** `adapters (adapter_id, customer_id, name)` and `adapter_versions (adapter_version_id, adapter_id, version_no, base_model_version_id, rank, source_model_id, sha256, uploaded_at)`. The name is customer-facing; a re-upload is a new version.
- **Attachments.** `adapter_attachments (endpoint_id, adapter_version_id, name_on_endpoint, attached_at, detached_at, detach_reason)`; an exclusion constraint (or a load-time check) keeps a name unique per endpoint at any instant; a trigger or validation rejects an attachment whose `base_model_version_id` differs from the endpoint config in force. A base model change closes all attachments with `detach_reason = 'base_model_changed'`.
- **Requests.** `requests (request_id, endpoint_id, replica_id, adapter_name_requested, adapter_version_id NULL for base, attachment_id, received_at, first_token_at, completed_at, input_tokens, output_tokens, status)`. The resolver writes the version at request time; "named an adapter not attached" is `adapter_name_requested IS NOT NULL AND adapter_version_id IS NULL` with a status.
- **Rollups.** `fct_adapter_hourly (endpoint_id, adapter_version_id, hour, requests, input_tokens, output_tokens, ttft_histogram)`; medians from histograms. At {{requests_per_day}} requests a day, request grain is kept for a short window; rollups long term.
- **Access.** All tables keyed by `customer_id` through the endpoint or adapter; per-customer views only.

**Competing designs to accept.** Bitemporal attachment rows. Storing the attachment set as a versioned document per endpoint (one row per change, an array of attached versions) if as-of queries and the compatibility check are shown. Computing billing minutes at query time from replica intervals rather than materialising, if reproducibility of issued bills is addressed.

**Bottlenecks and failure modes.** Requests carrying only the adapter name; an `is_attached` flag; replica count instead of replica intervals (cannot apply a per-replica minute rule); base model changes as in-place updates; duplicate or missing scale events; per-adapter metrics without the version; at up to {{max_adapters}} adapters per endpoint, high-cardinality rollups if every dimension is kept.

**Incident guidance.**
- *Re-upload merged two versions in reports*: backfill `adapter_version_id` on recent requests by joining the name to attachment intervals at `received_at`; republish the per-adapter latency report per version and tell the customer the regression was an artefact. Guard: the request record must carry the resolved version (a not-null check when a name was given and the call succeeded); reports group by version.
- *Base model change left incompatible adapters attached*: close the attachments at the config change time, mark requests that failed against them with a clear error class, and correct the console. Guard: the compatibility check on attach and an automatic detach on config change, with a reconciliation that lists attachments whose base model version differs from the endpoint's.
- *Lost scale-down left a replica open*: reconcile replica intervals daily against the serving layer's live replica list; close the interval at the last heartbeat or the observed stop and re-issue the bill line with an explanation. Guard: an alert when an endpoint's open replica intervals exceed its configured maximum of {{max_replicas}} or a replica has no heartbeat for N minutes; bills read reconciled intervals only.

**Follow-up guidance.** (1) Old attachment row closed at the switch instant, new one opened; requests before carry the old version id, after the new; requests in flight keep what they resolved. (2) A new config version; all attachments closed with a reason; new attachments for compatible versions; past reports read the old rows, untouched. (3) Deduplicate by event id; a missing stop is closed by reconciliation; the bill shows estimated minutes as provisional until reconciled. (4) Request grain for days to weeks; hourly per-version rollups with histograms; partition by day, cluster by endpoint; answer per-version per-hour queries from the rollup in under a second.

**Rubric anchors.** 2: endpoints with a replica count and adapters with an attached flag; requests by adapter name. 3: config versions, replica intervals, adapter versions, attachment intervals, requests with resolved versions. 4: also the compatibility rule enforced, the per-replica minute rule applied correctly with day splits, reconciliation of scale events, rollups sized to the volume, and crisp incident handling.

**Strong signals.** Asks how a request identifies an adapter and whether names are reused; separates the adapter from its versions unprompted. **Red flags.** Billing from a replica count; overwriting the endpoint's base model; no record of which version served a request.

## TGA-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity.** `publishers`, `families (family_id, publisher_id, name)`, `model_versions (version_id, family_id, api_model_id UNIQUE, parameter_count, weights_sha256, max_context_tokens, tokenizer_id, published_at)`. `api_model_id` never points at different weights.
- **Licences.** `licences (licence_id, name)`, `licence_versions (licence_version_id, licence_id, version_label, text_uri, text_sha256, commercial_use_allowed, attribution_required, use_restrictions_ref)` and `version_licences (version_id, licence_version_id, effective_from, effective_to, recorded_at)`. Reportable properties are typed columns on the licence version, set by a reviewer, not inferred by the pipeline.
- **Offerings.** `offerings (offering_id, version_id, deployment serverless|dedicated)`, `offering_terms (offering_id, effective_from, effective_to, context_limit_tokens, input_price_minor_per_million, output_price_minor_per_million, currency)`, `offering_availability (offering_id, available_from, available_to, status preview|general|deprecated|retired)`.
- **Notices.** `deprecation_notices (version_id, notice_no, announced_at, deprecates_on, replacement_version_id, supersedes_notice_no)`, insert-only; the notice in force at time t is the highest `notice_no` with `announced_at ≤ t`. The replacement is a foreign key into `model_versions`.
- **As of D.** The catalogue listing is a view parameterised by D: versions published by D, availability windows containing D, terms in force at D, licence interval containing D, notice in force at D. One function per history table keeps the pattern uniform.
- **Usage joins.** Requests carry `version_id` and the request time; price and context limit come from `offering_terms` in force at that time. Tenant-level licence reports are run per tenant or aggregated; one tenant never sees another.
- **Go-live check.** A version becomes listed only when it has at least one offering with terms, a licence interval, and availability; enforced by a publishing step that validates all, then flips availability in one transaction.

**Competing designs to accept.** Bitemporal tables (`valid_from/valid_to` plus `recorded_from/recorded_to`) for every history table, which additionally answer "what did we believe on date K". A catalogue published as immutable snapshots (one document per release of the catalogue) plus relational projections for analytics, if projections are the queried source. Prices kept in a separate pricing service with version ids, if requests record the price version.

**Bottlenecks and failure modes.** A licence column overwritten in place; notices edited rather than superseded; context length kept only on the version; aliases reused for new weights; partial go-live (listed without prices); different consumers each computing "as of" differently; licence properties parsed from text by a pipeline.

**Incident guidance.**
- *Licence change applied in place*: rebuild the version's licence history from the publisher's change record and audit log; regenerate the previous quarter's compliance export from the interval table and tell its readers what changed. Guard: `version_licences` insert-only with intervals; a test reproduces each issued compliance export from the model.
- *Postponed deprecation edited in place*: restore the original notice as notice 1 and add the postponement as notice 2 with its announcement time; re-run the migration report judging each call by the notice in force; correct the account review. Guard: notices are insert-only; customer notifications record the `notice_no` they carried; the report's definition names the in-force rule.
- *Version live without prices*: bill the affected calls at the price that should have applied, or decide (and say) to waive them; add the missing terms with the correct effective time. Guard: the go-live check above, plus a billing-pipeline alert when a priced request type resolves no terms; at about {{new_per_week}} new versions a week the check runs on every publish.

**Follow-up guidance.** (1) A join of `model_versions` to each history table with `effective_from ≤ D < effective_to` (and `published_at ≤ D`), plus the notice with the highest `notice_no` announced by D. (2) A new `version_licences` interval; tenant list = requests for the version with `requested_at ≥` change, grouped by tenant, delivered to each tenant (or to the account team) separately. (3) Notices 1 and 2 both exist; the migration report judges a call by the notice in force when the call was made; the replacement shown today is the latest notice's. (4) A publish pipeline that writes all rows with future effective times and flips availability in one transaction; the API list and page read the same as-of view; billing reads terms by request time; with a {{notice_days}}-day notice period, deprecations are scheduled rows long before they apply.

**Rubric anchors.** 2: a models table with licence, context length and a deprecated flag, updated in place. 3: identity separated from versioned licences, offerings, terms and notices; as-of listing. 4: also licence properties as reportable typed columns, notices superseded rather than edited, offering-level context limits, a go-live completeness check, tenant-scoped reporting, and crisp incident handling.

**Strong signals.** Asks whether context limits differ by deployment type; treats notices as communications that must be preserved. **Red flags.** Interpreting licence text in the pipeline; a single `deprecated_at` column; an alias that can move to new weights with no record of what served a request.

## TGA-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Grain.** `fct_request (request_id, tenant_id, api_key_id, received_at, deployment serverless|dedicated, endpoint_id, model_version_id, adapter_version_id, streaming, status ok|error|cancelled_by_client|timeout, error_class, attempts, input_tokens, cached_input_tokens, output_tokens, tokenizer_id, queue_ms, ttft_ms, generation_ms, e2e_ms, first_token_produced bool)` — one row per tenant-visible request. `fct_request_attempt (request_id, attempt_no, replica_id, server_received_at, started_at, first_token_at, ended_at, outcome, output_tokens_this_attempt)` — one row per attempt, for operations.
- **Clocks.** Durations measured on one machine with a monotonic clock: queue_ms on the server (enqueue to start), ttft_ms and generation_ms on the server; e2e_ms on the router. Wall-clock timestamps are kept for ordering and partitioning, never subtracted across machines; when a cross-machine figure is needed, apply a stated offset estimate and flag it.
- **Tokens.** The tenant-visible request's tokens are the delivered attempt's (or the sum the usage rule states; this exercise: delivered tokens only). Counts are per `tokenizer_id`; dashboards that sum across models label them "tokens (mixed tokenizers)" or convert nothing.
- **Cancellations and errors.** Kept as rows with `status` and the tokens produced so far; TTFT exists when the first token was produced; e2e for cancelled requests is "until cancel".
- **Rollups.** `agg_latency_hourly (hour, tenant_id, model_version_id, deployment, status_class, metric ttft|queue|generation|e2e, histogram fixed log-spaced buckets or a mergeable sketch, count, sum)` and `agg_tokens_hourly (hour, tenant_id, model_version_id, input, cached_input, output)`. Percentiles across hours or tenants merge histograms; accuracy bounded by bucket width.
- **No content.** No prompt or output text; debugging uses ids, sizes, timings, error classes and a sampled, consented trace store if one exists (out of scope here).
- **Size.** At {{requests_per_day}} requests a day and ~150–250 bytes per request row compressed, request grain is GB to TB per day; kept {{raw_retention_days}} days, partitioned by hour or day, clustered by tenant and model version. Hourly rollups are orders of magnitude smaller and kept long term.
- **Access.** Row-level security by tenant on both grains and rollups.

**Competing designs to accept.** Only attempt-grain storage with a view that collapses to requests, if token double counting is prevented. Streaming the rollups directly (no request grain at all) if the candidate accepts losing ad hoc drill-down and keeps a short sample. t-digest or DDSketch instead of fixed buckets.

**Bottlenecks and failure modes.** Averages instead of distributions; percentiles averaged across hours; cross-machine subtraction; dropping cancelled or errored requests; retries counted as requests; cardinality explosion in rollups if API key and adapter are both kept per hour for {{tenants}} tenants; storing text "for debugging".

**Incident guidance.**
- *Negative queue time from clock drift*: switch queue_ms to the server-side monotonic measurement, recompute the affected hours from attempt rows where available, and annotate the dashboard. Guard: a constraint that durations are non-negative (rows failing it are quarantined, not clamped); a monitor on the share of quarantined rows; clock offsets tracked per server.
- *Cancelled streams dropped from rollups*: include cancellations with their TTFT (when produced) and a status dimension; recompute rollups for the retained {{raw_retention_days}} days; tell tenants their dashboards changed and why. Guard: a test that every request row lands in exactly one rollup cell (counts reconcile), and a cancellation-rate panel beside latency; with {{streaming_share}} of requests streaming this matters most.
- *Retries counted as requests*: rebuild the tenant-visible grain by grouping attempts on `request_id`; recompute token rollups; reconcile with usage reporting. Guard: a daily reconciliation of output tokens between the latency store and usage reporting per tenant, alerting on any difference; at {{requests_per_day}} requests a day, even 0.1% is visible.

**Follow-up guidance.** (1) One request row (status cancelled_by_client, tokens so far, TTFT from the second attempt), two attempt rows (one failed on the server, one delivering), durations from the server for queue and TTFT. (2) Merge hourly histograms over the week for that tenant; the p99 is accurate to one bucket's width; state the bucket scheme. (3) Divergence from retries, cancellations, mixed tokenizers or late rows; agree by reading the same request grain and the same delivered-tokens rule. (4) Bytes per row × rows per day; partition by day or hour, cluster by tenant and model version; rollups partitioned by month.

**Rubric anchors.** 2: one log row per request with timestamps and an average latency table. 3: tenant-visible and attempt grains, per-stage durations, tokens with tokenizer, cancellations kept, histogram rollups. 4: also clock discipline, mergeable percentiles across retention, reconciliation with usage, cardinality and size reasoning, no content, and crisp incident handling.

**Strong signals.** Asks which clock each timestamp comes from; defines the grain before the columns. **Red flags.** Averaging percentiles; storing prompts for debugging; filtering out cancellations as noise.

## TGA-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH serverless AS (
  SELECT tenant_id, version_id, status, requested_at
  FROM requests
  WHERE deployment = 'serverless'
), late AS (
  SELECT q.tenant_id, q.version_id,
         date_trunc('week', q.requested_at)::date AS week_start
  FROM serverless q
  CROSS JOIN LATERAL (
    SELECT n.deprecates_on
    FROM deprecation_notices n
    WHERE n.version_id = q.version_id
      AND n.announced_at <= q.requested_at
    ORDER BY n.notice_no DESC
    LIMIT 1
  ) d
  WHERE q.requested_at >= d.deprecates_on::timestamptz
), late_weeks AS (
  SELECT tenant_id, version_id, week_start, COUNT(*) AS late_calls
  FROM late
  GROUP BY tenant_id, version_id, week_start
), named AS (
  SELECT DISTINCT version_id, replacement_id
  FROM deprecation_notices
), repl_ok AS (
  SELECT tenant_id, version_id AS replacement_id, requested_at
  FROM serverless
  WHERE status = 'ok'
)
SELECT w.tenant_id, w.version_id, w.week_start, w.late_calls,
       COUNT(ro.requested_at) FILTER (
         WHERE date_trunc('week', ro.requested_at)::date = w.week_start) AS replacement_calls,
       MIN(ro.requested_at)::date AS first_replacement_on
FROM late_weeks w
JOIN named nm ON nm.version_id = w.version_id
LEFT JOIN repl_ok ro
  ON ro.tenant_id = w.tenant_id
 AND ro.replacement_id = nm.replacement_id
GROUP BY w.tenant_id, w.version_id, w.week_start, w.late_calls
ORDER BY w.tenant_id, w.version_id, w.week_start;
```

**Explanation.** Every part of the report reads serverless requests only, so the filter comes first. The notice in force is an as-of lookup per request: among the version's notices announced at or before the request, the one with the highest `notice_no`; requests to versions with no notice, or made before any notice, drop out of the `CROSS JOIN LATERAL`. A call is late when it is at or after midnight UTC of that notice's `deprecates_on` (with the session in UTC, `deprecates_on::timestamptz` is that midnight), whatever its status. Late calls are counted per tenant, version and Monday-start week before anything else is joined. Only then are the tenant's successful serverless calls to the named replacement joined: `COUNT … FILTER` gives the same week's replacement calls, and `MIN` over all of them gives the first day at any time, including before the deprecation. Grouping by `late_calls` keeps the pre-aggregated count intact; the join can only add replacement rows to each week row, never multiply late calls.

**Complexity.** One index lookup per serverless request for the notice (notices are few per version), one aggregate over late calls, and a join of each late week to the tenant's replacement calls (the same tenant's replacement calls are revisited once per late week; a pre-aggregation of replacement calls per tenant, version and week plus a per-tenant minimum avoids that at scale). In production, restrict requests to versions with notices and to days on or after the earliest `deprecates_on` for the late part; the first-call part needs all history of the replacement, best kept as a small table of (tenant, version, first ok serverless call) maintained daily.

**Dialect notes.** Not executed here. Snowflake: `DATE_TRUNC('week', …)` follows the `WEEK_START` parameter (default Monday in most accounts, but check it); the notice lookup works with `ASOF JOIN … MATCH_CONDITION (q.requested_at >= n.announced_at)` or a `QUALIFY ROW_NUMBER()`; `COUNT_IF` for the filtered count. BigQuery: `DATE_TRUNC(DATE(ts), WEEK)` starts on Sunday — use `WEEK(MONDAY)` or `ISOWEEK`; no `LATERAL`, so join notices and keep the highest `notice_no` per request with `QUALIFY`; `COUNTIF`. Spark SQL: `date_trunc('week', ts)` is Monday-based; `count_if` or `SUM(CASE …)`; the as-of lookup with a window `row_number`. MySQL 8: no `date_trunc`; `DATE(ts) - INTERVAL WEEKDAY(ts) DAY` gives Monday; `LATERAL` exists from 8.0.14; `SUM(CASE …)` for the filter; timestamps need the session time zone set to UTC.

**Edge cases built into the data.** Calls at exactly 00:00:00 UTC on a deprecation date (late) and one second before (not late); late calls on Sundays (they belong to the week starting the Monday before); dedicated-endpoint calls to deprecated versions and to a replacement; a tenant that started on the replacement before the deprecation date yet still calls the old version; tenants that never call the replacement (NULL); noise traffic on versions never deprecated. Hard adds error statuses: a failed late call (still late) and a tenant whose earliest replacement call failed. Very Hard adds a replacement that is itself deprecated later, a notice that postponed a date before it arrived (calls between the two dates are not late), and a notice that extended a date that had already passed (calls between the first date and the extension's announcement are late, later ones until the new date are not).

**Common mistakes.** Including dedicated requests; counting late calls from the day after the deprecation date (`requested_at::date > deprecates_on`); Sunday-start weeks; searching for the first replacement call only from the deprecation date on; (Hard+) filtering late calls by `status = 'ok'`, or counting failed replacement calls; (Very Hard) judging every call by the version's latest notice, or by its first. Each has a diagnostic. Also common: joining raw replacement calls to raw late calls before counting, which multiplies `late_calls` by the replacement calls in the week; using an inner join to replacement calls, which drops tenants that never migrated.

**Follow-up guidance.** (1) Partition pruning on `requested_at` from the earliest relevant `deprecates_on`; a daily pre-aggregate of (tenant, version, day, deployment, status, calls) and a maintained first-ok-call table; the report then reads thousands of rows, not billions. (2) Tenants with any late call in the last 7 days and no row in the first-ok-call table for the replacement (an anti-join), regardless of week. (3) Arguments: late under what the tenant was told (communications are the contract) versus late under the corrected truth (the wrong date was never valid); either way notices must be immutable, the corrected notice linked to the one it supersedes, and the report must name which rule it used. (4) Follow the replacement chain with a recursive CTE over notices (or a precomputed closure) and accept a first successful call to any version along the chain; state whether a later version that is itself deprecated still counts.

**Rubric anchors.** 2: a query that uses the latest notice and counts late calls by date, or joins replacement calls before counting. 3: matches the expected result. 4: also explains the notice-in-force choice, the pre-aggregation for scale, and a principled position on corrected notices and replacement chains.

**Strong signals.** Asks which notice judges a call before writing the join; aggregates before joining unprompted. **Red flags.** `MAX(notice_no)` per version with no time filter; date comparisons that drop the midnight boundary; an inner join that hides tenants that never migrated.
