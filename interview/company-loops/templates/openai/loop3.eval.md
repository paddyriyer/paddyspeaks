# OpenAI · Loop 3 — evaluator notes (hidden from candidates)

## OAI-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Reference entities (transactional).** `organization(org_id, …)`; `project(project_id, …)` with ownership in `project_org(project_id, org_id, valid_from, valid_to)` because a project can move; `api_key(key_id, project_id, created_at, revoked_at)` (the key id, never the secret); `model(model_id, family)`; `sku(sku_id, model_id, unit)` where unit is input tokens, cached input tokens, output tokens, images or audio seconds.
- **Prices.** `price(price_id, sku_id, price_book_id, currency, unit_price DECIMAL, unit_size, effective_from, effective_to)` with half-open `[effective_from, effective_to)` intervals and an exclusion constraint (or a load-time check) so rows of one SKU, book and currency never overlap. `price_book` is "list" or one negotiated contract (`contract_id, org_id`). Rows are never updated; a correction closes one row and inserts another, with a `recorded_at` so the history of what was believed is kept.
- **Usage and rating.** `usage_record(request_id, key_id, project_id, org_id, sku_id, quantity, event_ts)` is immutable and stamped with the owning project and organization at event time. Rating writes `rated_usage(request_id, sku_id, quantity, price_id, gross_amount)` — the applied price id is stored, never re-derived later.
- **Allowances and credits.** `free_tier_allowance(plan_id, sku_id, units_per_month, valid_from, valid_to)` and a consumption record per organization-month. Credits are a ledger: `credit_grant(grant_id, org_id, kind, amount, currency, granted_at, expires_at)` and `credit_entry(entry_id, grant_id, invoice_id, kind ∈ {consume, expire, reverse}, amount, recorded_at)`; the balance is a sum, never a mutable column, and consumption order (for example, earliest expiry first) is written down.
- **Invoices.** `invoice(invoice_id, org_id, period, currency, status, issued_at)` and `invoice_line(invoice_id, line_no, sku_id, price_id, quantity, unit_price, amount, line_kind ∈ {usage, free_tier, credit, adjustment})`. Issued invoices are immutable; a correction is a credit note or an adjustment line on the next invoice, linked to the original.
- **Money.** DECIMAL with fixed scale, or integer minor units with a sub-unit scale for per-token prices (a token costs a tiny fraction of a cent, so rate at high precision and round once per invoice line). Never floats.
- **Warehouse.** Facts with stated grains: `fact_usage_hourly` (organization × project × key × SKU × hour, quantity and rated amount, applied price id), `fact_invoice_line` (one row per invoice line), `fact_credit_ledger` (one row per ledger entry), and `fact_daily_revenue` (organization × SKU × day, recognised amount after allowances and credits, reconciled to invoices). Dimensions: `dim_organization` (SCD2 for plan and tier), `dim_project` (SCD2 for owning organization), `dim_key` (type 1 attributes, keyed by key id), `dim_sku` and `dim_model` (family roll-up), `dim_price` (effective-dated, one row per price row), `dim_date`. Multi-currency: amounts in invoice currency plus a reporting-currency column using a stored FX snapshot with its rate date.
- **Reproducibility.** An invoice is reproduced from its own lines (which carry price ids and quantities) plus the rated usage behind them; the line totals equal the sum of rated usage for that period by construction, and the check runs before issue.

**Competing designs to accept.** One wide rated-usage table instead of separate rating and allowance steps, if the applied price and allowance are recorded per row. A balance column for credits protected by serialisable transactions, if the candidate also keeps an append-only history. Storing prices as `effective_from` only (validity until the next row) if overlap is prevented and lookups are correct at the boundary. A lakehouse instead of a warehouse.

**Bottlenecks and failure modes.** Overlapping price rows double-pricing usage; re-deriving prices at query time so a later correction silently changes history; credits consumed twice under concurrency; SCD1 project ownership moving past usage to a new organization; float rounding drift; hot partitions for the largest organizations in hourly facts; late usage after an invoice is issued.

**Incident guidance.**
- *Wrong-timezone effective date*: find affected usage by joining rated usage to the wrong price id within the 8-hour window; insert a corrected price row (closing the bad one, recorded_at now); rate the difference and issue credit notes or next-invoice adjustments rather than editing issued invoices; prevent with UTC-only timestamps, a review step for price changes and a check that effective_from is at a declared boundary.
- *Dashboard 3% below invoice*: compare at the shared grain (organization × SKU × day) between `fact_daily_revenue` and invoice lines; likely causes are allowances or credits applied in one place only, a different price derivation in the warehouse, or project-ownership attribution (SCD1). Fix by building warehouse revenue from rated usage and invoice lines, not recomputing.
- *Replayed hour*: dedup belongs upstream, but rating must be idempotent too: a unique key on `rated_usage(request_id, sku_id)` rejects duplicates; reconcile record counts per hour against the metering source before invoicing.

**Follow-up guidance.** (1) `fact_daily_revenue`, reconciled to invoice lines per month. (2) A new price row in the contract's price book with the backdated effective date and `recorded_at` today; re-rate the affected period and issue adjustments; issued invoices stay. (3) Usage carries the project at event time; the key-to-project mapping is effective-dated; the warehouse uses the SCD2 version current at event time. (4) Partition usage facts by date, cluster by organization; incremental aggregates keyed by (date, organization, SKU) recomputed for late partitions within a lateness window. (5) The lineage from invoice line → price id and rated usage → usage record, with a reconciliation query that sums both sides.

**Rubric anchors.** 2: one usage table and a current-price lookup; credits as a balance; grains unstated. 3: effective-dated prices with the applied price id recorded, credit ledger, immutable invoices, stated grains. 4: also bitemporal price corrections, multi-currency with FX snapshots, allowance-credit-paid order, SCD choices justified, and crisp incident handling.

**Strong signals.** Asks how a mid-month price change and a backdated contract interact before drawing tables; states each fact's grain unprompted. **Red flags.** Joining usage to "the current price"; editing issued invoices; floats for money; no link from an invoice line to the price that produced it.

## OAI-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Envelope.** `event_id` (UUID), `schema_version`, `producer` (service and build), `event_ts`, `request_id`, `org_id`, `project_id`, `key_id`, `model`, `endpoint`, `region`, `outcome`, `latency_ms`, `ttft_ms`, totals per unit (`input_tokens`, `cached_input_tokens`, `output_tokens`), and `parts`: an ordered array.
- **Part.** `index`, `direction` (input or output), `modality` (string with a documented set of known values, never a closed enum), `mime_type` (an allow-listed set), `bytes`, `tokens`, and modality-specific measures with units in the name: `image_width_px`, `image_height_px`, `detail`, `audio_seconds`, `sample_rate_hz`. No `text`, `url`, `filename`, `transcript` or `data` field exists.
- **Privacy tiers, annotated per field in the schema.** T0 aggregate-safe operational metadata (model, modality, counts, latency, outcome) → analytics. T1 customer identifiers (`org_id`, `project_id`, `key_id`) → analytics with access control. T2 end-user identifiers → only as a keyed pseudonym (HMAC with a key held by the serving platform, rotated, never in analytics) and only in a restricted dataset. T3 content and anything derived from it that could reveal it (text, image bytes, audio, transcripts, file names, unkeyed hashes) → never in telemetry. Safety category labels and scores → restricted tier.
- **Enforcement.** The producer library builds events from a generated class (from the registry), so unknown fields cannot be set; a serializer allow-list drops anything else. Registry subjects use backward-and-forward compatible evolution (additive optional fields with defaults; no renames; no type changes; no unit changes under an existing name). Meaning changes need a new field name.
- **Contract tests.** In each producer's CI: serialize representative events (including every modality) and validate against the registered schema; a tier linter fails the build if a field lacks a tier or if a field typed as free-form string is added; a canary test asserts that no field value equals a known content sentinel injected into test requests. Consumer-side tests pin the fields each consumer reads.
- **Runtime.** Validation at the log ingress (asynchronous, off the request path): conforming events flow; non-conforming events go to a quarantine topic with restricted access. Billing reads the unit totals from a minimal, separately validated usage record so quarantining telemetry never loses billable units. Metrics: conformance rate per producer and version, alerting on any T3-looking field.

**Competing designs to accept.** Protobuf or Avro (either, with a registry); JSON with JSON Schema if the candidate keeps strict validation and size limits. One event per request with nested parts versus one row per part in the warehouse (a parts table keyed by request_id and index is a good analytical form). Synchronous validation at a sidecar if latency is measured and bounded.

**Bottlenecks and failure modes.** Closed enums breaking old consumers; free-form maps bypassing tiers; unit changes under a stable name; hashing content as a "safe" identifier; quarantine dropping billing data; consumers silently ignoring a new required meaning; validation cost at high volume.

**Incident guidance.**
- *`filename` reached analytics*: stop the producer version (roll back or strip at ingress); purge the field from every consumer table, derived table and cache, and from backups by the documented deletion process; record who accessed it; add the field-name and free-form-string rules to the tier linter so the build fails next time; review why the generated-class path was bypassed.
- *`audio_seconds` → `audio_ms`*: the registry should have rejected a removal or rename; if it was added as a new field, consumers saw missing values. Correct the day's data by reprocessing from the raw log with a unit fix tagged by producer version; re-rate billing for the affected day with adjustments; add a rule that units live in field names and never change.
- *One event per chunk*: a semantic contract break (grain changed). Detect by event-per-request ratio per producer; aggregate chunks at the producer or emit a separate chunk stream; fix consumers that sum per-event counts; capacity-plan the log for the tripled volume until fixed.

**Follow-up guidance.** (1) A prompt hash is derived content; an unkeyed hash of short text is reversible by guessing. Offer a keyed hash held in the serving path with counts published only as aggregates above a minimum, or a cache-hit indicator. (2) Add `video` as a new known value plus optional `video_seconds` and `frame_count`; old consumers must already treat unknown modality values as "other". (3) Caught by the registry (rename) or by the conformance monitor (unit drift via value-range checks); correct by reprocessing. (4) Validate at ingress asynchronously, sample deep checks, full checks on the billing record. (5) Evidence: schema history with tiers, linter results per release, sentinel-canary results, and periodic scans of analytics tables for content-like values.

**Rubric anchors.** 2: a JSON blob with the request and "we strip PII later". 3: typed envelope and parts with units, tiers per field, content excluded at the producer, a registry with a compatibility mode, contract tests. 4: also keyed pseudonymisation, open enums, semantic versioning of meaning and grain, quarantine that preserves billing, auditable proof, and precise incident handling.

**Strong signals.** Starts from consumers' needs; names units in field names; treats a grain change as a contract break. **Red flags.** "Log the prompt and mask it downstream"; unkeyed hashes of content; closed enums; dropping non-conforming events with no path for billing.

## OAI-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Versioned, immutable dimensions.** `dim_model_version(model_version_id, checkpoint, snapshot_name, decoding_config_hash, decoding params…)`; `dim_dataset(dataset_id, suite, owner)`; `dim_dataset_version(dataset_version_id, dataset_id, created_at, content_hash)`; `dim_example(example_id, revision, input_hash, label_hash, created_at)` where an edit creates a new revision; bridge `dataset_version_example(dataset_version_id, example_id, revision)`; `dim_grader_version(grader_version_id, kind ∈ {exact, model, human}, grader_model, rubric_version, prompt_hash)`; `dim_metric(metric_id, name, aggregation ∈ {mean, pass@k, …}, grader_version_id, valid_from)`.
- **Facts.** `fact_run(run_id, model_version_id, dataset_version_id, harness_version, started_at, manifest_uri)` — one row per run. `fact_sample(run_id, example_id, revision, sample_index, output_ref, output_tokens, latency_ms)` — one row per generated sample; `output_ref` points into the restricted store. `fact_grade(run_id, example_id, revision, sample_index, grader_version_id, score, graded_at, grade_batch_id)` — one row per sample per grader version, append-only. `fact_metric_value(snapshot_id, run_id, metric_id, slice, value, n, ci_low, ci_high)` — frozen per published snapshot.
- **Selecting grades.** A view picks, for each metric, the grade from the metric definition's grader version (not the latest by time). A re-grade adds rows under a new grader version; the metric changes only when its definition is changed through review, which creates a new metric version.
- **Fair comparisons.** Compare model A and B on the paired set: examples (same id and revision) present in both runs, graded by the same grader version, with matching decoding config. Report n, the paired difference and a confidence interval (paired bootstrap over examples); flag comparisons whose overlap falls below a threshold.
- **Reproducibility.** A published score is a `snapshot` row with a manifest: run ids, dataset version, example revisions, grader versions, metric version, harness version and code commit. Recomputing from the manifest yields the same number; published values are never updated.
- **Aggregation across suites.** Macro-average per suite (each suite weighted equally or by a declared weight), never micro-average across all examples; uncertainty per suite and for the composite.

**Competing designs to accept.** A wide results table with grader columns, if re-grades are versioned and published snapshots are frozen. A lakehouse with time travel used for reproducibility, if the candidate pins snapshot versions in the manifest and handles snapshot expiry. Storing per-example scores only at metric level if paired comparisons are still possible.

**Bottlenecks and failure modes.** In-place dataset edits; "latest grade wins" changing history; mixed grader versions in one chart; duplicate loads; micro-averages dominated by large suites; comparisons on different example sets; outputs leaking into broadly readable tables.

**Incident guidance.**
- *Dataset edited in place*: detect by the content hash in `dim_dataset_version` no longer matching; create a proper new version for the edited content, mark runs computed during the ambiguity, recompute comparisons on the paired set of unchanged examples, and annotate the chart; prevent with immutable storage and a hash check at run start.
- *Half re-graded*: the dashboard must select grades by the metric's grader version, so half-regraded data does not change it; if it did, freeze the metric version, finish the re-grade, then publish a new metric version with both numbers shown side by side.
- *Duplicate shards*: a uniqueness key on `fact_grade(run_id, example_id, revision, sample_index, grader_version_id)` and an idempotent load keyed by `grade_batch_id`; reconcile per-run counts against the run's planned example count.

**Follow-up guidance.** (1) Join both runs' grades on (example_id, revision, sample_index or per-example mean) with the same grader version; return n, both scores, the difference and a CI; refuse or flag below a minimum n. (2) New `fact_grade` rows under the new grader version; the dashboard is unchanged until the metric definition moves; then both versions are shown. (3) Macro-average with declared weights and a CI; never one pooled mean. (4) Example membership is a bridge table, so excluding contaminated examples is a filter; recompute snapshots as new snapshots, keep the old ones.

**Rubric anchors.** 2: one results table keyed by model and dataset name, latest grades overwrite. 3: versioned dimensions, append-only grades, paired comparisons, stated grains. 4: also metric definitions that pin grader versions, frozen snapshots with manifests, macro-averaging with uncertainty, restricted outputs, and clean incident handling.

**Strong signals.** Asks how a dataset edit is represented before modelling runs; brings up paired comparisons and confidence intervals unprompted. **Red flags.** Comparing scores computed on different example sets; "just re-run everything" as the reproducibility story; raw outputs in a widely readable table.

## OAI-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Configuration entities.** `tier(tier_id, name)`; `tier_limit(tier_id, model_family, dimension, limit_value, valid_from, valid_to, recorded_at)`; `org_tier(org_id, tier_id, valid_from, valid_to, recorded_at, reason, actor)`; `override(override_id, scope ∈ {org, project}, scope_id, model_family, dimension, limit_value, mode ∈ {raise, ceiling}, valid_from, valid_to, recorded_at, reason, ticket, actor)`; `project_cap(project_id, model_family, dimension, limit_value, valid_from, valid_to, recorded_at, actor)`.
- **Bitemporal history.** Every table carries valid time (`valid_from`, `valid_to`: when the rule applies) and recorded time (`recorded_at`, plus `superseded_at` for corrections). Rows are never updated: a correction inserts a new version. An append-only `config_change_log(change_id, entity, entity_id, before, after, actor, reason, recorded_at)` is the audit trail.
- **Resolution (one pure function, shared).** `org_limit = override(ceiling) if present else max(tier_default, override(raise))`; `effective = min(org_limit, project_cap)` when a cap exists. Applied per (organization, project, model family, dimension) at instant T as recorded at K.
- **Request time.** A resolver materialises effective limits into versioned snapshots (full plus deltas), including each rule's `valid_to`, and publishes them through a config distribution channel. Gateways hold the snapshot in memory, apply deltas, evaluate expiry against the current time locally (so an expired override stops applying even if no new snapshot arrives), keep the last-known-good snapshot on disk, and log `snapshot_version` and the rule id with every throttling decision. Emergency decreases go out as small priority deltas.
- **Analytics.** Throttling events carry `snapshot_version` and `rule_id`; the warehouse keeps snapshot metadata, so "what applied" is a join on the version. "What should have applied" is the bitemporal query at valid time T as known now; "what did we believe" uses recorded time ≤ T.
- **Sizing.** Store only non-default rows in the snapshot (defaults come from the tier table); millions of organizations at a few families and dimensions fit in memory if overrides and caps are sparse; partition snapshots by organization hash if needed.

**Competing designs to accept.** A per-request lookup in a replicated key-value store with a local cache, if the candidate bounds staleness, handles store outages and still logs the version. Push versus pull distribution. Valid-time-only history plus the change log, if the candidate can still answer "what did the gateway believe".

**Bottlenecks and failure modes.** Cache entries that never expire; precedence implemented differently in gateway and warehouse; in-place updates destroying history; snapshot size growth; config outages making gateways fail-open or fail-closed by accident; clock skew around expiry.

**Incident guidance.**
- *Override cached 3 days*: expiry must be evaluated at decision time from `valid_to` inside the snapshot, not by a removal event; audit every cached rule with a past `valid_to`; assess the cost and the capacity impact; add a test that a snapshot older than N minutes with expired rules still enforces the expiry.
- *Backdated in-place updates*: restore history from the change log or backups into versioned rows; re-run the analysis using the gateways' logged snapshot versions (they are the ground truth for what was enforced); ban updates by permission and require inserts with recorded_at.
- *Snapshot too large*: ship defaults implicitly and only exceptions explicitly; shard the snapshot or load it lazily per organization with a bounded cache; keep readiness tied to last-known-good loading, not to a full fresh fetch during a spike.

**Follow-up guidance.** (1) Filter each source to `valid_from <= T < valid_to` and `recorded_at <= K < coalesce(superseded_at, ∞)`, then apply the precedence function. (2) Snapshot, delta, gateway memory, last-known-good file, any per-key cache; expiry evaluated locally fixes all of them. (3) Sparse exceptions in a hash map keyed by (org, project, family, dimension), with sizes stated. (4) Clock skew, stale snapshot, precedence drift between implementations, a backdated correction; logging the version and sharing one resolver makes the mismatch explainable.

**Rubric anchors.** 2: one `limits` table updated in place and read per request. 3: normalised entities with precedence, effective dating, snapshots pushed to gateways, an audit log. 4: also bitemporal history, local expiry evaluation, last-known-good fallback with a stated fail mode, version logging for analytics, sizing, and precise incident handling.

**Strong signals.** Distinguishes valid time from recorded time unprompted; insists that gateways log the configuration version. **Red flags.** A database read per request at the stated rate; deleting expired overrides as the only expiry mechanism; `updated_at` as the history.

## OAI-L3-05

**Reference solution** (PostgreSQL; `{{m1}}`, `{{m3}}`, `{{threshold}}` and `{{unpriced_mode}}` are the instance's values — `unpriced_mode` is `exclude` or `unpriced`)

```sql reference
WITH months AS (
  SELECT g::date AS month
  FROM generate_series(DATE '{{m1}}', DATE '{{m3}}', INTERVAL '1 month') AS g
), priced AS (
  SELECT p.org_id,
         date_trunc('month', u.usage_ts)::date AS month,
         u.input_tokens * pr.usd_per_mtok_input + u.output_tokens * pr.usd_per_mtok_output AS micro_cost,
         pr.model IS NULL AS unpriced
  FROM usage_records u
  JOIN projects p ON p.project_id = u.project_id
  LEFT JOIN LATERAL (
    SELECT mp.model, mp.usd_per_mtok_input, mp.usd_per_mtok_output
    FROM model_prices mp
    WHERE mp.model = u.model AND mp.effective_from <= u.usage_ts
    ORDER BY mp.effective_from DESC
    LIMIT 1
  ) pr ON TRUE
), gross AS (
  SELECT org_id, month,
         ROUND(SUM(micro_cost) / 1000000, 2) AS gross_usd,   -- SUM skips unpriced rows (NULL)
         BOOL_OR(unpriced) AS has_unpriced
  FROM priced
  GROUP BY org_id, month
), credit AS (
  SELECT org_id, credit_month AS month, SUM(amount_usd) AS credits_usd
  FROM credits
  GROUP BY org_id, credit_month
), monthly AS (
  SELECT o.org_id, m.month,
         GREATEST(COALESCE(g.gross_usd, 0) - COALESCE(c.credits_usd, 0), 0) AS net_usd,
         ('{{unpriced_mode}}' = 'unpriced' AND COALESCE(g.has_unpriced, FALSE)) AS unpriced
  FROM organizations o
  CROSS JOIN months m
  LEFT JOIN gross g  ON g.org_id = o.org_id AND g.month = m.month
  LEFT JOIN credit c ON c.org_id = o.org_id AND c.month = m.month
), compared AS (
  SELECT org_id, month, net_usd, unpriced,
         LAG(net_usd)  OVER w AS prev_net_usd,
         LAG(unpriced) OVER w AS prev_unpriced
  FROM monthly
  WINDOW w AS (PARTITION BY org_id ORDER BY month)
)
SELECT month,
       org_id,
       CASE WHEN prev_unpriced THEN NULL ELSE prev_net_usd END AS prev_net_usd,
       CASE WHEN unpriced THEN NULL ELSE net_usd END AS net_usd,
       CASE WHEN NOT unpriced AND prev_net_usd > 0
            THEN ROUND(100 * (net_usd - prev_net_usd) / prev_net_usd, 2) END AS pct_change,
       CASE WHEN unpriced THEN 'UNPRICED'
            WHEN prev_net_usd = 0 THEN 'FROM_ZERO'
            WHEN net_usd > prev_net_usd THEN 'UP'
            ELSE 'DOWN' END AS status
FROM compared
WHERE month > DATE '{{m1}}'
  AND (unpriced
       OR (NOT prev_unpriced AND prev_net_usd = 0 AND net_usd > 0)
       OR (NOT prev_unpriced AND prev_net_usd > 0
           AND ABS(net_usd - prev_net_usd) * 100 > {{threshold}} * prev_net_usd))
ORDER BY month, org_id;
```

**Explanation.** Price each usage row at its own instant: the lateral subquery takes the latest price row with `effective_from <= usage_ts`, so usage exactly at a change pays the new price. `micro_cost` is in dollars × 10⁶ (tokens × dollars per million), summed exactly in NUMERIC and divided and rounded once per organization-month. Credits are aggregated to organization × month on their own and joined after usage is aggregated, so neither side fans out. The organization × month grid (a cross join with `generate_series`) makes a month with no usage exist with cost 0, so `LAG` compares adjacent calendar months. The threshold test is written multiplicatively (`|Δ| × 100 > X × prev`), which is exact and avoids dividing by zero; `pct_change` is computed only where the previous net is positive. Under the `unpriced` rule an organization-month with any usage lacking a price is reported as UNPRICED and blocks the next month's comparison; under `exclude` the unpriced rows simply contribute nothing (NULL is skipped by `SUM`).

**Complexity.** The lateral lookup is one index probe per usage row with an index on `model_prices(model, effective_from)`: O(n log p). The `LEAD`-interval alternative turns prices into `[effective_from, next_effective_from)` ranges and range-joins; at scale, pre-rate usage once (store the applied price id) and aggregate a daily organization × model table, so monthly queries never touch raw usage.

**Dialect notes.** Snowflake and BigQuery have no `LATERAL … LIMIT 1` in the same form: use the `LEAD` interval join (`usage_ts >= effective_from AND usage_ts < COALESCE(next_from, '9999-12-31')`) or, in Snowflake, an ASOF JOIN (`MATCH_CONDITION(u.usage_ts >= p.effective_from)`); BigQuery generates months with `GENERATE_DATE_ARRAY` and `UNNEST`. Spark SQL: the interval join with a range condition, or a window over a union of usage and price rows (`last_value(price) IGNORE NULLS` ordered by time). MySQL 8: interval join with `LEAD`, months from a recursive CTE, `GREATEST` works the same. Rounding: PostgreSQL `ROUND(numeric)` rounds half away from zero; BigQuery `ROUND` on NUMERIC also rounds half away from zero, but on FLOAT64 results can differ, so keep money in NUMERIC. These variants are not executed here.

**Edge cases built into the data.** A usage row exactly at every price change and one shortly before it; changes on different days of a month (Medium) and at any time of day, with one model changing twice in one month (Hard); several credit grants for one organization-month (Hard and Very Hard); an organization whose net changes by exactly the threshold (not reported); credits above cost (net 0, then −100% and FROM_ZERO); an organization with a month of no usage; usage before a model's first price row, including usage exactly at that first `effective_from` (Very Hard).

**Common mistakes.** `effective_from < usage_ts` (boundary row pays the old price); pricing a whole month at the month-start or the latest price; joining credits to usage rows before aggregating; rounding each row; no floor at 0; `LAG` over months that have usage (skips a gap month); an inner join that silently drops unpriced usage when the rule says UNPRICED; `>=` instead of `>`; dividing by a zero previous month.

**Follow-up guidance.** (1) `LEAD` intervals plus a range join, or an ASOF join where the engine has one; at scale rate usage once at ingest and keep the price id. (2) A price book per contract with its own effective-dated rows; look up the contract's row first and fall back to list price (`COALESCE` of two lateral lookups). (3) Volume effect = Δtokens × old price; price effect = new tokens × Δprice; credit effect = Δcredits; the three sum to the change when computed in that order — the candidate should state the order because the split depends on it. (4) Find usage rated by the corrected price row (via the stored price id), re-rate, and issue adjustments or credit notes; never rewrite issued invoices.

**Incident guidance.** *Duplicate price row*: the lateral `LIMIT 1` picks one of the two arbitrarily (non-deterministic) and a plain `<=` join with a max subquery double-counts; restore the primary key or an exclusion constraint, deduplicate with a declared tie-break, and add a load check that fails on duplicate (model, effective_from). *Month-end ran early*: the first month is short, so the next month shows false increases; compute months only after a lateness cut-off, mark months final, and recompute open months idempotently.

**Rubric anchors.** 2: right shape but prices at the month start or latest, or credits fanned out. 3: matches the expected result. 4: also explains the interval alternative and its boundary, scaling by pre-rating, and how to handle retroactive price corrections.

**Strong signals.** Asks whether `effective_from` is inclusive and how rounding works before writing SQL; builds the month grid unprompted. **Red flags.** `ORDER BY` missing or only on month; summing credits per usage row; "just use the current price"; treating unpriced usage as free without checking the rule.
