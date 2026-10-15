# xAI · Loop 3 — evaluator notes (hidden from candidates)

## XAI-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Ledger (facts).** `spend_ledger (entry_id, team_id, occurred_at, recorded_at, kind charge|refund|chargeback|promotional_credit|manual_adjustment, amount_cents, source_ref, idempotency_key)`. Append-only; a correction is a new entry referencing the old one. `counts_toward_tier` is a function of `kind` under a versioned rule (`spend_rule_versions`), so the rule "promotional credits never count" is data, not code scattered across jobs.
- **Cumulative spend (derived).** `team_spend_daily (team_id, day, counted_net_cents)` and a running `team_spend_state (team_id, cumulative_cents, as_of_entry_id, updated_at)` maintained incrementally by a consumer of the ledger; reproducible from the ledger at any time.
- **Thresholds.** `tier_threshold_versions (version_id, effective_from, announced_at, recorded_at)` and `tier_thresholds (version_id, tier, min_cumulative_cents)`. A version never demotes: evaluation only ever raises a team's tier.
- **Tier history.** `team_tier_intervals (team_id, tier, valid_from, valid_to NULL, cause spend_crossing|threshold_version|manual_decision, cause_ref, recorded_at)`. A crossing closes the current interval and opens the next (or jumps several tiers; either "one row per tier" or "one row to the highest" is fine if stated). Manual decisions live in `tier_decisions (decision_id, team_id, from_tier, to_tier, effective_from, reason, decided_by, recorded_at)` and open an interval with cause `manual_decision`.
- **Models and limits.** `models (model_id, family, launched_at, retired_at)`; `model_aliases (alias, model_id, valid_from, valid_to)`; `tier_limits (model_id, tier, rps, tpm, valid_from, valid_to, version_id)`. "Not offered" is the absence of a row, enforced explicitly: the lookup returns NOT_OFFERED, never 0 or unlimited, and a launch check asserts that every (model, tier) pair intended to be offered has a row.
- **Limits in force (derived and served).** For (team, alias, t): alias → model at t; team tier interval containing t; `tier_limits` row for (model, tier) in force at t. Pushed to request handling as versioned snapshots (per team: tier + snapshot version), and each request log records the snapshot version it used, so any rejection can be explained from logged versions plus these tables.
- **Late events.** A late refund is a ledger entry with `recorded_at` today and `occurred_at` in the past; it changes the reproducible cumulative history but, by rule, never removes a tier already reached. A bitemporal view (`recorded_at`) answers "what did we believe at the time".

**Competing designs to accept.** Event-sourced tier state with the interval table as a projection. Computing the tier on read from the ledger with a cache, if the candidate shows how history and the no-demotion rule are kept and how latency is bounded. Storing tier changes as events only (no intervals), with interval views derived. A single combined `limits_in_force` table keyed by (team, model, valid range), if they size it (teams × models × changes) and explain refresh.

**Bottlenecks and failure modes.** A mutable `current_tier` column; recomputing tiers from scratch with the latest thresholds (retroactive demotion); summing the ledger per request at {{spend_events}}; a default of 0 or unlimited for a missing limits row; aliases resolved at query time instead of at request time; promotional credits counted as spend; no cause recorded on tier changes; time-of-belief lost, so late events silently rewrite history.

**Incident guidance.**
- *Nightly job demoted 3% of teams*: the job violated the no-demotion rule by recomputing from the new version. Revert by restoring the intervals from the previous state (the ledger and intervals make this exact), push snapshots, and change evaluation so a version can only open higher-tier intervals. Add a test: applying any threshold version never lowers a tier.
- *Missing limits row defaulted to zero*: make "no row" an explicit NOT_OFFERED result with a clear message, add a pre-launch completeness check over (model × tier), and alert when NOT_OFFERED or zero-limit rejections spike for one model.
- *No place for a manual decision*: add `tier_decisions` with reason, actor and time, have it open a tier interval with cause `manual_decision`, and keep the chargeback in the ledger; the history then shows both the rule and the decision.

**Follow-up guidance.** (1) Three as-of joins: alias at t, tier interval containing t, limits row for (model, tier) at t; return the row ids as justification. (2) The refund is a new negative ledger entry; cumulative spend history changes, the tier interval does not (no automatic demotion); a reviewer may record a manual decision. (3) No team moves down; teams below the new threshold that had not reached the tier now need more; a team one dollar short sees a larger gap in its console. (4) Absence of a row means not offered; a launch checklist query lists (model, tier) pairs without rows; request handling returns a specific error. (5) Incremental per-team running totals updated from the ledger stream; crossing detection compares the new total with the next threshold in force; snapshots pushed with version numbers; periodic reconciliation against a full recompute.

**Rubric anchors.** 2: a tier column on the team and a limits table keyed by tier only; no history, no versions, no rule for what counts. 3: ledger, versioned thresholds, tier intervals, per-(model, tier) limits with an as-of lookup. 4: also no-demotion enforced by design, aliases as of the request, missing rows as not offered, late events with a second time axis, manual decisions with reasons, and an incremental path sized to {{spend_events}}.

**Strong signals.** Asks what counts as spend before drawing tables; treats thresholds and limits as versioned data; names the snapshot version on request logs. **Red flags.** Recomputes tiers from today's thresholds; defaults missing limits to zero or unlimited; overwrites the tier.

## XAI-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Posts.** `posts (post_id, author_key, created_at, kind original|reply|quote|repost, reply_to, quote_of, repost_of, status live|deleted, deleted_at)`. `author_key` is opaque and used only for aggregates (posts per hour, distinct authors in a window); nothing joins it to anything else.
- **Versions.** `post_versions (post_id, version, valid_from, valid_to, tokens, token_count, content_hash)`. An edit inside the {{edit_window_minutes}}-minute window adds a version and closes the previous one; an edit event after the window is rejected and logged.
- **Tombstones.** `post_tombstones (post_id, deleted_at, received_at, purge_completed_at)`. Deletion nulls `tokens` in every version (or deletes the version rows and keeps only `(post_id, version, content_hash)`), and the tombstone outlives all content. The tombstone is the source of truth for "never serve".
- **Labels.** `post_labels (post_id, version, label_type language, value, classifier_version, labelled_at)`; a re-run inserts rows for the new classifier version; the index reads a chosen classifier version.
- **Index documents.** `index_documents (doc_id, post_id, version, index_generation, embedding_model_version, built_at, depends_on_post_ids[])`. One document per live version of an original, reply or quote; a quote's document includes the quoted post's tokens only while it is live and records the dependency in `doc_dependencies (doc_id, depends_on_post_id)`. Reposts get no document; `repost_counts (post_id, window, reposts)` aggregates them as a signal to the given scoring function. Retention: documents older than {{index_days}} days are dropped by generation or partition.
- **Retrieval records.** `retrievals (request_id, team_id, tool_call_id, post_id, version, doc_id, index_generation, rank, score, retrieved_at)` and `post_citations (request_id, post_id, version, span_start, span_end)`. No text: the console shows text by looking up (post_id, version) while the post is live and inside retention, otherwise "deleted" or "expired".
- **Deletion path.** Tombstone first (filter at query time immediately), then purge versions, documents of every version, dependent quote documents (via `doc_dependencies`), and caches keyed by (post_id, version), each step timed against {{delete_sla}}.

**Competing designs to accept.** One document per post (latest version) with versions kept separately, if the candidate makes retrieval records carry the version that was current at retrieval and handles purge of every version. An event log of create/edit/delete with tables as projections. Indexing reposts as pointers that collapse to the original at query time. Storing quoted text by reference only (rendered at read time) instead of in the quote's document, which removes the dependency problem at the cost of a join at search time.

**Bottlenecks and failure modes.** Overwriting text on edit; a deleted flag with the text left in place; documents for earlier versions forgotten by deletion; quote documents with copied text and no dependency record; one document per repost (copies crowd results); retrieval logs that copy text (deletion now has to reach the logs) or keep only post ids (versions lost); author keys joined into profiles; embedding rebuilds blocking edits at {{posts_per_day}}.

**Incident guidance.**
- *Deleted post cited 40 minutes later*: the deletion only reached the latest version's document. Check the tombstone at query time as a filter (immediate), purge documents for every version, add a sweep that compares tombstones with index contents, and measure deletion lag per stage against {{delete_sla}}.
- *Edited text shown beside an older citation*: add `version` to retrieval and citation records and render the cited version, labelled as an earlier version when it differs from the current one; past records without versions can only be labelled "version unknown".
- *Quote document kept deleted text*: record document dependencies, rebuild dependent documents on delete and edit, and add a check that no live document contains a tombstoned post's content hash.

**Follow-up guidance.** (1) posts row; versions 1 and 2 (1 closed); quote post with its document and a dependency row; two repost rows and repost counts, no documents; after deletion: tombstone, versions emptied, documents removed, quote document rebuilt without the quoted text, repost rows marked or removed. (2) The record says version 1; the link shows version 1 while the post is live, marked as edited since. (3) No documents for reposts; one document for the original with a repost-count signal; collapse at query time. (4) New label rows with the new classifier version; index rebuilt or relabelled by generation; past retrieval records keep their index generation, so they are explained by the labels of that generation. (5) Versions ≈ posts × (1 + edit rate); documents ≈ live versions within {{index_days}} days; retrieval records ≈ tool calls × results; bytes dominated by tokens and embeddings.

**Rubric anchors.** 2: one posts table with text updated in place and a deleted flag. 3: versions, tombstones, retrieval records with version, reposts not duplicated. 4: also document dependencies for quotes, per-stage deletion timing, label versions, index generations in retrieval records, retention sizing, and author keys kept aggregate-only.

**Strong signals.** Separates post, version and document unprompted; treats deletion as a pipeline with a deadline. **Red flags.** Copies post text into logs; builds author profiles; ignores earlier-version documents.

## XAI-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Responses.** `responses (response_id, team_id, model_id, created_at, completed_at, text_length_cp, offset_unit 'codepoint', retention_until)`. The final text itself lives with the team's response data under its retention; analytics tables do not copy it.
- **Tool calls.** `tool_calls (call_id, response_id, ordinal, tool web_search|post_search, params_json, params_hash, status ok|error|timeout, started_at, ended_at, scorer_version)`. Parameters are the team's data and expire with it.
- **Sources.** `web_sources (source_id, canonical_url, raw_url_example, domain, canon_rule_version, title_hash, first_fetched_at)` keyed by (canon_rule_version, canonical_url); `post_sources (post_id, version)` with tombstone status taken from the posts model.
- **Results.** `tool_results (call_id, rank, source_type, source_id or (post_id, version), snippet_hash, score)` — one row per result per call, so the same source returned by two calls is one source and two results.
- **Citations.** `citations (citation_id, response_id, span_start, span_end, call_id, rank, status valid|unreturned)` with a many-to-many: one span can have several citation rows; one result can be cited by several spans. A citation to a source no call returned is kept with `status = unreturned` (and the source recorded) instead of dropped.
- **Offsets.** Stored in Unicode code points of the final text; clients converting to UTF-16 or bytes use a shared library tested on emoji, combining marks and CJK; the response row states the unit.
- **Analytics.** Daily aggregates per team: tool-using responses, responses with ≥ 1 citation, citations per domain counted once per response (`COUNT(DISTINCT response_id)` per domain). Partitions by day and team-hash; expiry by dropping partitions plus per-team deletes for teams that shorten retention.

**Competing designs to accept.** Citations referencing sources directly plus a `call_id`, if "which result" stays answerable. Storing offsets in UTF-16 (the unit most web clients use) if stated and converted consistently. A per-response document store for the console with relational extracts for analytics. Byte offsets with a stored unit if the candidate handles conversions.

**Bottlenecks and failure modes.** A JSON blob per response as the only store (analytics impossible at {{responses_per_day}}); offsets with no stated unit; citations joined to sources by URL (duplicates when two calls return it); raw URLs as keys (http/https, tracking parameters, trailing slashes split one page into many); post sources without a version; caches that deletion does not reach; tool parameters kept beyond the team's retention.

**Incident guidance.**
- *Wrong words highlighted*: offsets were counted in different units. Store a single unit with the response, convert in one tested library, re-derive affected offsets from the stored text where retention allows, and add tests with non-ASCII text.
- *Citations per response doubled*: the join was citation → URL → every result with that URL. Join citations to the specific result (call_id, rank), recompute the chart, and add a check that citation counts equal citation rows.
- *Deleted post text in consoles*: cache keyed by post id never invalidated. Key by (post_id, version), check tombstones before rendering, purge on delete, and sweep caches against tombstones.

**Follow-up guidance.** (1) 1 response, 2 calls, 15 result rows, ≤ 15 sources (the shared URL once), 4 citation rows (or more if a span cites two). (2) Convert code points to UTF-16 code units by counting supplementary characters as 2; test with emoji and astral-plane characters, round-trip. (3) `COUNT(DISTINCT response_id) FILTER (WHERE has_citation) / COUNT(DISTINCT response_id)` per team and day; domains ranked by `COUNT(DISTINCT response_id)`. (4) The console shows "post deleted" with no text; citation rows stay (ids only), the post source's status changes, caches are purged. (5) Calls, results, citations append-only; partition by day; expire by partition after {{retention_days}} days, with per-team deletion for shorter settings.

**Rubric anchors.** 2: one JSON per response, or citations to URLs with no call or result. 3: separate tables with results per call, sources shared, citations with spans. 4: also a stated offset unit with conversion, canonicalisation with versioned rules, unreturned citations flagged, post versions and tombstones, per-team expiry and analytics that count once per response.

**Strong signals.** Asks for the offset unit; distinguishes result from source. **Red flags.** Stores web page content; drops unreturned citations; counts citations by joining on URL.

## XAI-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Regions and endpoints.** `regions (region_id, name, status)`; `endpoints (endpoint_id, kind global|regional, region_id NULL, host)`.
- **Availability.** `model_region_availability (model_id, region_id, available_from, available_to NULL, announced_at)`. A withdrawal sets `available_to` in advance, so pinned teams can be told.
- **Prices.** `base_prices (model_id, price_version, unit input_tokens|output_tokens|..., micro_cents_per_unit, effective_from, effective_to)`; `region_multipliers (region_id, multiplier_version, multiplier NUMERIC(6,4), effective_from, effective_to, announced_at, recorded_at)`. Corrections add versions and supersede; nothing is updated in place except closing `effective_to`.
- **Residency settings.** `team_residency_settings (team_id, setting_version, mode none|pinned, allowed_regions[], failover_policy, effective_from, saved_by)`.
- **Request fact.** `request_facts (request_id, team_id, received_at, completed_at, endpoint_id, region_served, model_id, model_version, residency_setting_version, base_price_version, multiplier_version, multiplier, input_tokens, output_tokens, cost_micro_cents, residency_ok boolean, error_code)`. The pricing instant is `received_at`; the fact records the versions applied so billing never re-derives them. `residency_ok = false` makes any out-of-region service visible.
- **Billing.** Invoice lines = `SUM(cost_micro_cents)` per team, month, model, region and price version, rounded to cents once per line (stated rounding point). A reconciliation job compares invoice lines with facts per (team, month, region, version) and alerts on any difference.
- **Locality.** Facts with content-bearing fields stay in the serving region; a global billing table receives only billing fields per request or per hour, which is what the global console and the invoice read.

**Competing designs to accept.** Computing cost at invoice time from versions recorded on the fact (not looked up by time), which gives the same answer. Hourly aggregates as the billing grain instead of per-request facts, if versions are part of the key. Multipliers stored as integer basis points. A single price table with region as a dimension instead of base price × multiplier, if versions and the multiplier rule stay explicit.

**Bottlenecks and failure modes.** Floating-point money; multipliers looked up by completion time in one place and received time in another; only the endpoint called recorded; residency stored as a single column on the team; availability without end dates; global replication of request content; per-request rounding that drifts from per-line rounding at {{requests_per_day}}.

**Incident guidance.**
- *Invoice differed from console at midnight*: two time rules for the same price. Make received time the only pricing instant, record the multiplier version on the fact, have the invoice job sum facts instead of re-pricing, and reissue the affected invoice lines with a credit or debit note.
- *Pinned team, served elsewhere, cannot be told which requests*: add `region_served`, `residency_setting_version` and `residency_ok` to the fact; for the past, reconstruct from regional serving logs if they exist, otherwise say plainly what cannot be known; add an alert on `residency_ok = false`.
- *Withdrawn model still shown as available*: add `available_to` and announcements; serving returns a specific "not offered in this region" error for pinned teams; a check lists availability rows past their end that still route traffic.

**Follow-up guidance.** (1) Sum facts per (region, model, price versions) for the month, round per line, compare with invoice lines; list differences. (2) Insert a corrected multiplier version effective the 1st (recorded on the 10th); recompute facts for the 1st (their recorded version is now known to be wrong, so re-price them with a correction record); issue adjustment lines instead of rewriting invoices. (3) `available_to` set; pinned teams warned in advance; after the date, requests return the explicit error; history stays. (4) Regional fact stores with a global billing-field stream or hourly aggregates; the console and invoice read the global billing table; detail drill-down queries the region.

**Rubric anchors.** 2: region as a column on the team, a current multiplier table, cost computed at invoice time with today's prices. 3: effective-dated availability, multipliers and settings; request fact with region served and versions; exact money. 4: also a single pricing instant enforced everywhere, residency violations visible, withdrawals announced with explicit errors, content kept in region with billing fields aggregated, and a reconciliation that proves invoice = facts.

**Strong signals.** Distinguishes endpoint called from region served; asks which instant prices a request. **Red flags.** Floats for money; recomputing past costs from current prices; silently rerouting pinned teams.

## XAI-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH bounds AS (
  SELECT DATE '{{first_day}}' AS first_day, DATE '{{last_day}}' AS last_day
), team_days AS (
  SELECT t.team_id, g::date AS spend_day
  FROM (SELECT DISTINCT team_id FROM spend_events) t
  CROSS JOIN bounds b
  CROSS JOIN LATERAL generate_series(b.first_day, b.last_day, INTERVAL '1 day') AS g
), daily AS (
  SELECT team_id, (occurred_at AT TIME ZONE 'UTC')::date AS spend_day, SUM(amount_cents) AS net_cents
  FROM spend_events
  WHERE kind IN ('charge', 'refund')
  GROUP BY team_id, (occurred_at AT TIME ZONE 'UTC')::date
), cumulative AS (
  SELECT td.team_id, td.spend_day,
         SUM(COALESCE(d.net_cents, 0)) OVER (PARTITION BY td.team_id ORDER BY td.spend_day) AS cum_cents
  FROM team_days td
  LEFT JOIN daily d ON d.team_id = td.team_id AND d.spend_day = td.spend_day
), reached AS (
  SELECT c.team_id, th.tier, MIN(c.spend_day) AS reached_on
  FROM cumulative c
  JOIN tier_thresholds th
    ON th.effective_from <= c.spend_day
   AND (th.effective_to IS NULL OR c.spend_day < th.effective_to)
  WHERE c.cum_cents >= th.min_spend_cents
  GROUP BY c.team_id, th.tier
), rejections AS (
  SELECT team_id, (requested_at AT TIME ZONE 'UTC')::date AS err_day, COUNT(*) AS n
  FROM request_errors
  WHERE status_code = 429
  GROUP BY team_id, (requested_at AT TIME ZONE 'UTC')::date
)
SELECT r.team_id,
       r.tier,
       r.reached_on,
       CASE WHEN r.reached_on - 7 >= b.first_day THEN
         (SELECT COALESCE(SUM(x.n), 0) FROM rejections x
          WHERE x.team_id = r.team_id AND x.err_day BETWEEN r.reached_on - 7 AND r.reached_on - 1)
       END AS rejected_7d_before,
       CASE WHEN r.reached_on + 7 <= b.last_day THEN
         (SELECT COALESCE(SUM(x.n), 0) FROM rejections x
          WHERE x.team_id = r.team_id AND x.err_day BETWEEN r.reached_on + 1 AND r.reached_on + 7)
       END AS rejected_7d_after
FROM reached r
CROSS JOIN bounds b
ORDER BY r.team_id, r.tier;
```

**Explanation.** Spend is netted per team and UTC day over the counted kinds (charges and refunds, never promotional credits), so a charge refunded later the same day leaves no trace at the end of that day. A calendar of every day in the sample per team, with a running sum over it, gives the end-of-day cumulative spend on every day, including days with no spend; that matters at the hardest level, where a threshold version lowers one tier and a team qualifies on the day the version starts without spending anything. Each team-day is joined to the threshold rows in force that day (half-open `[effective_from, effective_to)`), and `MIN(day)` per team and tier is the first qualifying day: later dips and recrossings cannot add rows. Rejections are 429 rows grouped by UTC date; each window is a range of whole dates that excludes the reached day, and a `CASE` returns NULL when the window leaves the sample.

**Complexity.** The calendar is teams × days (a few hundred rows here; in production, teams × days of history, which is why the follow-up asks for an incremental design). The window sum is one sort per team. The threshold join multiplies by tiers × versions. The correlated rejection counts are index lookups on (team_id, day); a join to a per-day rejection table with a range condition is equivalent.

**Dialect notes.** `generate_series(date, date, interval)` with `CROSS JOIN LATERAL` is PostgreSQL; BigQuery uses `UNNEST(GENERATE_DATE_ARRAY(first_day, last_day))`, Snowflake a calendar table or `TABLE(GENERATOR(ROWCOUNT => n))` with `DATEADD`, Spark SQL `explode(sequence(first_day, last_day))`, MySQL 8 a recursive CTE. `(ts AT TIME ZONE 'UTC')::date` is PostgreSQL; BigQuery `DATE(ts, 'UTC')`, Snowflake `TO_DATE(CONVERT_TIMEZONE('UTC', ts))`, Spark `to_date(from_utc_timestamp(...))` depending on the session zone. `date - integer` is PostgreSQL; others use `DATE_SUB`/`DATEADD`. A running `SUM() OVER (... ORDER BY day)` defaults to `RANGE UNBOUNDED PRECEDING` in all of them, which is correct here because days are unique per team. None of these variants is executed here.

**Edge cases built into the data.** A threshold met exactly (`>=`); a team that jumps two tiers on one day; 429 rows at 00:00:00 on `reached_on − 7` and at 23:59:59 on `reached_on + 7` (both counted), at 23:59:59 on `reached_on − 8` and 00:00:00 on `reached_on + 8` (not counted), and on the reached day itself (not counted); 400, 500 and 503 rows inside windows. Hard adds refunds: a charge at about 09:00 that crosses a threshold and is fully refunded at about 17:00 the same day; a team that dips below a reached tier after a refund and crosses again later; and tiers reached near either end of the sample, so windows are NULL. Very Hard adds a second threshold version that lowers one tier, with a team whose cumulative spend lies between the new and old threshold and which spends nothing on the day the version starts, and promotional-credit usage, one row of which would push a team over the first threshold early if counted.

**Common mistakes.** `>` instead of `>=`; counting the reached day in the after window (`BETWEEN reached_on AND reached_on + 7`) or the before window; `requested_at <= reached_on + 7` (a timestamp compared with midnight, which loses the seventh day); counting every error code; partial counts instead of NULL for windows that leave the sample; ignoring refunds; a running total per event instead of per day (the same-day refund case); `LAG` to find crossings and taking the last one or returning several; (Very Hard) counting promotional credits, evaluating only days with spend events, applying the latest threshold version to every day. Each has a diagnostic.

**Follow-up guidance.** (1) Teams that upgrade are often growing or changing traffic; compare with teams of similar spend that did not cross a threshold in the same week, or normalise rejections by requests sent. (2) A late event can move `reached_on` earlier; publish with an "as of" time and recompute a trailing window, or freeze reports and log corrections. (3) Per team: cumulative spend so far, current tier, and the next threshold in force; each new ledger entry updates the total and checks one comparison; a new threshold version triggers a scan of teams between its thresholds and the old ones; reconcile with a periodic full recompute. (4) Fewer requests-per-second rejections but the same tokens-per-minute ones suggests token-heavy traffic or a tier whose TPM rose less than its RPS; check the limits per tier and the tokens per request.

**Rubric anchors.** 2: cumulative spend per event with no refunds or thresholds as of the day; windows with off-by-one or timestamp errors. 3: matches the expected result. 4: also explains why the calendar matters when thresholds change, discusses confounders, late events and an incremental design, and splits by limit type.

**Strong signals.** Asks whether thresholds can change and whether spend is checked per event or per day; states the half-open threshold interval. **Red flags.** Counts all errors as throttling; uses `<=` against a date on a timestamp column without noticing; returns several rows per tier.
