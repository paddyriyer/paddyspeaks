# Google · Loop 3 — evaluator notes (hidden from candidates)

## GOO-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Events (the contract).** Every event carries `event_id`, `schema_version`, `page_id` (server-assigned when the results page is built), `user_key` (pseudonymous; signed-out users get a short-lived browser key), `client_ts` and `server_received_ts`. Server side: `search_issued` (query text, query source: typed, suggestion, related search, spelling link), `page_served` (page_id, query id, corrected-query flag, the ordered list of blocks: block type, block position, and the results inside it with their own rank and a result id). Client side: `results_seen` (positions that entered the viewport), `click` (page_id, block position, result rank, result type, destination type organic/ad/feature), `back_to_results` (with dwell since click), `query_edited`. The contract is versioned, additive-only within a major version, owned by the producing team, with a registry and a CI check on the client release.
- **Analytical tables.**
  - `search_page` (one row per served page; partitioned by date, clustered by country/locale and query hash): page_id, user_key, ts, query_hash, query_text (NULL unless the day's query passes the threshold), corrected flag, and a nested repeated `results` field (block_type, block_position, rank, result_type, seen flag, clicked flag, first click ts, dwell). One row per page serves page-level questions cheaply.
  - `result_impression` (optional flat view or materialisation: one row per shown result) for position × type aggregates across months; derivable from the nested table by unnesting.
  - `search_session` (session_id = user_key + first search ts; start, end, number of searches, clicked flag, answered flag, day assigned by session start).
  - `refinement_edge` (session_id, from_search, to_search, gap_seconds, edit kind: extension, deletion, substitution, spelling, reformulation by similarity; query text only through the thresholded dictionary).
  - `query_dictionary_daily` (query_hash, day, distinct_users, publishable flag): the single place the {{min_users}} rule is decided.
- **Definitions.** Refinement: the next search in the same session whose query differs from the previous one and was issued from the results page of the previous search (or within the session gap), classified by edit kind. Click-through (organic): pages with ≥ 1 organic click ÷ pages served (or ÷ pages with a `results_seen` event — say which). Answered on the page: pages with no click and no refinement within the session, where a direct-answer block was **seen**; pages without a `results_seen` event are excluded from the denominator and reported as a coverage figure.
- **Dedup.** A reload produces a second page_id: dedupe by (user_key, query_hash, served within N seconds, no interaction on the first) into one search, keeping both page ids linked.

**Competing designs to accept.** Flat result-impression table as the primary store, if the candidate addresses page-level questions (a page-level summary table) and row volume. Session id assigned on the client, if they handle clock skew and still recompute with the server gap rule. Storing refinements as columns (`next_query_hash`) on the search row, if they handle multiple next searches and late events.

**Bottlenecks and failure modes.** Late client events changing click and answered flags (re-aggregate a rolling lookback of days; publish with a close); sessionization across midnight; very heavy users or bots producing giant sessions (cap and flag); join volume between pages and clicks (co-partition by date and page_id hash); contract drift from client releases; privacy leaks through derived tables (refinement edges, autocomplete-like top lists, small-group drill-downs).

**Incident guidance.**
- *Missing "results seen" event on one platform*: detect with event-coverage monitors (ratio of pages with a results_seen event, per platform and client version); the answered metric must exclude pages without the event, which makes the jump disappear; annotate the dashboard and restate; contract test in the client release pipeline.
- *New result type at position 0*: the contract did not version the block list; the position column changed meaning. Fix by storing block position and rank within block separately, deriving "organic rank" explicitly; backfill the affected days; schema registry rejects an unknown block type without a version bump.
- *Rare query strings in refinement edges*: the threshold was applied to the source query only. Every place a query string is emitted must go through `query_dictionary_daily`; purge and rebuild the edge table, and add a test that no published table contains a query_hash whose day count is under {{min_users}}.

**Follow-up guidance.** (1) Pages with a seen direct-answer block, no click, no refinement in the session; exclude pages without the seen event; publish coverage. (2) Recompute sessions for a lookback window (e.g. two days) each run, keyed by user; yesterday is final after the late-event cutoff; sessions are stable ids derived from their first search. (3) Add a block type as a new enum value under a minor version; old queries filtering on known types keep working; queries that assumed fixed positions break, which is why rank within block exists. (4) Show only publishable refinements and an "other" bucket; never show X if X is under threshold. (5) Partition `search_page` by date, cluster by locale and query hash; `result_impression` clustered by result type and rank.

**Rubric anchors.** 2: one wide table of clicks; refinements undefined; privacy ignored. 3: clear grains joined by page id, sessionization with the gap, a precise click-through, threshold on query text. 4: also nested vs flat reasoning with costs, contract versioning, missing-event handling in metric definitions, thresholds enforced in derived tables, and crisp incident handling.

**Strong signals.** Asks what "seen" means before defining click-through; treats a metric's denominator as part of the contract. **Red flags.** Raw query text in every table; session ids taken blindly from the client; "answered" defined as "no click".

## GOO-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **`impression`** (written at serving time): impression_id (unique, generated by the server), viewer_key, video_id, surface, slot position, request_id (the page or list it belongs to), model_version, experiment arm, candidate-generator source, served_ts, plus a **logged feature snapshot** (the features the model actually saw, or a pointer to them). A separate `impression_visible` event marks on-screen exposure; training examples use visible impressions (say why: rendered-but-never-seen items carry no signal).
- **`feedback_event`** (client and server): event_id, impression_id (carried from the impression), viewer_key, video_id, type (click, watch_segment, like, dislike, not_interested, dont_recommend_channel, survey_response), value (watch seconds, survey score), event_ts. Watches started elsewhere carry no impression id and land in a separate stream.
- **`label`** keyed by impression_id: clicked, watch_seconds (sum of watch segments started from this impression within {{label_horizon}}), completion ratio, liked, negative feedback flag, survey score (sparse, nullable), `final_at = served_ts + {{label_horizon}}` and `computed_at`. Recomputed until final, immutable after.
- **Features for the point-in-time join** (when not logged): effective-dated rows `(viewer_key, feature, value, valid_from, valid_to)` or windowed aggregates computed with an as-of cutoff equal to served_ts; the join is `valid_from ≤ served_ts < valid_to`.
- **`training_set`**: a manifest (impressions included by served_ts range and `final_at ≤ snapshot_time`, label version, feature version) so a set is reproducible; examples are materialised with the manifest id.
- **Deletion**: a `history_deletion` log (viewer_key, video_id or range, requested_ts). A propagation job removes or tombstones matching watch segments, recomputes affected labels and features, rewrites affected partitions of training sets built within {{deletion_sla}}, and records completion per store (including backups and caches, which must either expire within the window or be filtered on restore).

**Competing designs to accept.** Fully logged features ("log and wait") instead of point-in-time joins — strong for leakage, costly in storage, and it fixes the feature set in time; accept with that trade-off. Labels as columns on an append-only impression table written once after the horizon (a delayed write), if they say how interim training runs get partial labels. Attribution of watches across surfaces with a rule (e.g. last impression within 1 hour) if it is explicit and the double-counting risk is handled.

**Bottlenecks and failure modes.** Joining billions of impressions to feedback by impression id (co-partition by impression id hash and served date); label recomputation churn before finality; the point-in-time join on high-cardinality features; position bias and exposure bias in labels; selection bias from training on one arm; deletion fan-out into many derived stores and backups.

**Incident guidance.**
- *Unfinished labels in training*: the run selected by served_ts, not by `final_at`. Guardrail: the training manifest requires `final_at ≤ snapshot_time`, or the trainer treats unfinished labels as censored (excluded or weighted). Retrain from a corrected manifest; compare fresh-upload ranking before and after.
- *Missing impression id → fallback join*: the fallback multiplies credit. Remove the fallback (unattributed watches go to the separate stream), alert on the share of watch events without an impression id per client version, rebuild labels for the affected days.
- *Deleted watches restored from a backup*: restores must replay the deletion log before data becomes readable; backups older than {{deletion_sla}} must be expired or filtered; add an audit that samples deletion requests and checks every store.

**Follow-up guidance.** (1) Sum of watch seconds from segments with this impression id that start within the horizon; rewatches counted (or capped) by a stated rule; non-clicked impressions get 0, not NULL. (2) Only impressions with `final_at ≤` noon; the label table's `final_at` makes it a filter, not a guess. (3) Raw watch → labels of impressions that contain it → features computed from it → training sets within {{deletion_sla}}; models trained earlier are retired on the normal retraining cadence (state the policy). (4) Windowed counts computed as of each served_ts: either logged at serving or computed with a sorted per-viewer timeline and a range join; never "last 7 days from today". (5) Keep arm and model_version on the impression; counterfactual bias: logged data reflects the serving policy; use exploration traffic or inverse propensity weighting.

**Rubric anchors.** 2: joins feedback by viewer and video, features from current tables, no horizon. 3: impression id end to end, labels with horizons, point-in-time features, a deletion path. 4: also reproducible manifests, deletion through backups and training sets, exposure and selection bias, and crisp incident handling.

**Strong signals.** Names leakage before being asked; treats finality as data. **Red flags.** "Use the latest features"; deleting from the raw table only; counting a watch from search as a recommendation success without a rule.

## GOO-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Why not sum**: a person seen on two days, in two campaigns or in two slices is counted twice; reach is a distinct count, which is not additive. Only impressions and clicks are additive.
- **Sketch store** `reach_sketch (day, campaign_id, ad_group_id, slice_dim, slice_value, sketch BYTES, precision, built_from_version)`: one HyperLogLog++ sketch per day × ad group × single-dimension slice (and an "all" slice). Two-dimension combinations are either precomputed for the pairs the product allows or built from a per-person daily table on demand. Public warehouses expose this pattern as aggregate functions that build sketches, merge them, and extract a cardinality; merging requires identical precision.
- **Precision and error**: m = 2^p registers; relative standard error ≈ 1.04/√m (p = 14 → about 0.8%; p = 16 → about 0.4%). Storage per dense sketch is on the order of m bytes or less with sparse encoding for small sets; compute the year: days × ad groups × slices × average sketch size, and show sparse encoding matters because most slices are small.
- **Queries**: date range and campaign set = merge the sketches for the cells, then extract. Overlap = |A| + |B| − |A ∪ B|, clamped at 0 and suppressed when the error bound exceeds the estimate; report union consistently (never above the sum).
- **Frequency**: a per-person count table `person_campaign_day (day, campaign_id, person_key, impressions)` kept for the longest range offered ({{max_range_days}} days) at the campaign grain; frequency for a range = aggregate per person over the range, then bucket. Expensive for big campaigns: precompute standard ranges (last 7/30/90 days, calendar months) and compute custom ranges as batch jobs with a progress state, or offer frequency only at campaign level. Accept a frequency-capable sketch family if they describe its limits.
- **Corrections**: late impressions (≤ 3 days) and invalid-traffic removals (≤ 14 days) rebuild the affected day's sketches and per-person rows from corrected impressions (sketches cannot remove elements); version each rebuilt cell.
- **Privacy**: apply the {{min_audience}} threshold to every published cell after merging; add protections against differencing: noise or rounding on published reach, minimum slice sizes on both sides of a subtraction, limits on the number of overlapping queries, and suppression of complements.

**Competing designs to accept.** Exact per-person tables with heavy precomputation for standard ranges and sketches only for custom ranges. Bitmap-based exact distinct counts over dense person ids, if they size it. A differentially private release mechanism for reach, if they explain the accuracy cost.

**Bottlenecks and failure modes.** Sketch storage at the dimension cross-product; merge cost for {{max_range_days}}-day ranges over many slices (pre-merge weekly and monthly rollups); inclusion–exclusion error on small overlaps; inconsistency between sketch-based reach and exact impressions (reach > impressions in tiny cells); precision changes making sketches incompatible; corrections that cannot subtract from a sketch.

**Incident guidance.**
- *Precision change breaks merges*: sketches carry their precision; the merge layer must refuse mixed precision; the fix is to rebuild old sketches at the new precision from source (or downgrade new ones to the old precision, which is lossy but valid); never cast silently. Guardrail: precision is part of the table's key and the builder's config is versioned.
- *Invalid-traffic removals missed the sketches*: a sketch cannot remove elements, so the day's sketches must be rebuilt from the corrected impressions; add a consistency check (reach ≤ valid impressions per cell) that pages.
- *Differencing attack*: the threshold applied per cell is not enough; add noise or coarser rounding to published reach, require both operands of any comparable pair above the threshold, cap slice combinations for small campaigns, and audit query patterns.

**Follow-up guidance.** (1) Pick p with the error and the storage arithmetic; doubling registers cuts error by about √2 and roughly doubles dense storage. (2) Rebuild the day's sketches and per-person rows for affected campaigns; show a "revised" marker and keep the previous version for audit. (3) Subtraction isolates the complement; protect with noise, complementary suppression, minimum sizes for both cells. (4) Per-person aggregates over the range; precompute standard windows; custom ranges as asynchronous jobs. (5) Clamp overlap at 0 or show "less than N"; compute union by merging, never by adding.

**Rubric anchors.** 2: sums daily reach, or COUNT DISTINCT over raw impressions for every request. 3: mergeable sketches at a clear grain, error stated, frequency handled separately. 4: also correction rebuilds, consistency rules on screen, differencing protection and a sized storage plan.

**Strong signals.** Explains non-additivity in one sentence before proposing storage; computes the error and the storage. **Red flags.** Averages of daily reach; inclusion–exclusion shown without an error discussion; privacy treated as a row filter only.

## GOO-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **`place`** (surrogate `place_sk`, created per real-world business at a location; status). **`place_id_alias`** (external_place_id, place_sk, valid_from, valid_to, reason: issued, merged_into, unmerged). Every id ever issued stays in the alias table; a merge closes the loser's mapping to its own sk and opens a mapping to the survivor; reversal closes that and reopens the original. Resolution follows at most one hop (aliases are always rewritten to the final survivor when a chain forms), and a constraint prevents cycles.
- **`place_attr_history`** (place_sk, name, category, hours, location, status, valid_from, valid_to, change_kind: real_change | correction, recorded_at). Real changes are type 2 versions; corrections overwrite the wrong version in place **and** are logged (or are a new version flagged as correction, so "as known then" is reproducible). A move is a new version of location on the same sk; a closure is a status version; a new business at the same address is a new `place_sk`.
- **`visit`** (visit_id, place_sk_at_inference, external id as seen, visit_hour_start, duration bucket, confidence, inference_model_version, visitor_key rotating, inferred_at), partitioned by visit date, retained {{history_weeks}} weeks.
- **Resolution at query time**: `visit → place_id_alias (as of now) → surviving place_sk`, so a merge or a reversal changes only the alias table; visit rows are never rewritten.
- **`busyness_profile`** (place_sk, day_of_week, hour, value 0–100, contributing_visitors_estimate, published flag, window_end, model_version): rebuilt incrementally from per-day partial aggregates (sum of visits per place × weekday × hour per day) by adding the new day and subtracting the day that left the window; published only if contributing distinct visitors ≥ {{min_visitors}} and the place is open.
- **Distinct visitors under rotation**: a rotating key overcounts distinct people (one person appears as many keys), so a threshold on distinct keys is weaker than it looks. Use a stable-within-window pseudonymous contributor id inside the trusted aggregation boundary (never published), or a conservative threshold (count keys per day and take the maximum daily count, or require the threshold per day).

**Competing designs to accept.** Rewriting visit place keys on merge with a batch job, if they cover reversals, cost and the reporting gap. Event-sourced place history (an event log of listing edits, merges and reversals with projections), if they show how analysts query state as of a date. Storing hourly busyness only as a published aggregate (no partials), if they accept full recomputes.

**Bottlenecks and failure modes.** Merge chains and cycles; chain-store false merges; resolution joins on billions of visits (broadcast the alias table, which is small relative to visits, or keep a daily resolved snapshot); type-2 explosion from frequent hours edits; re-running inference without double counting (write to a new model-version partition and swap atomically); retention deletes racing with rebuilds.

**Incident guidance.**
- *Bulk merge by brand name*: stop the job, reverse the merges through the alias table (visits need no rewrite), republish affected profiles; guardrail: merges require location proximity plus another signal, and any merge touching more than K listings needs review; a profile change above a threshold blocks publication.
- *Alias not restored after reversal*: the reversal must close the merged_into mapping and reopen the original as one transaction; add an invariant check that every external id resolves to exactly one open mapping, and a test for merge-then-reverse.
- *Threshold met by rotated keys*: the distinct-key count overstated contributors; withdraw profiles near the threshold, recompute with a contributor id that is stable within the window (inside the aggregation boundary), or require the threshold per day; add a margin.

**Follow-up guidance.** (1) Visits joined to aliases as of now, grouped by week and surviving sk; after reversal, the same query splits them again with no data rewrite. (2) Type 2: reports "as it was" use the version valid at visit time; category-based totals "as it is now" use the current version; both are joins on the same history. (3) Write the new model's visits to a separate version partition, build aggregates from it, then switch a pointer atomically; the old version expires. (4) As above: rotation overcounts; use a window-stable contributor id internally or a per-day threshold. (5) Partition visits by date, cluster by place_sk; busyness from daily partials added and subtracted.

**Rubric anchors.** 2: a single places table with ids rewritten on merge; visits keyed by address. 3: surrogate keys with an alias table, type 2 attributes, visits resolved at query time, a thresholded aggregate. 4: also reversible merges with cycle protection, correction vs change, closure-then-new-business, incremental windowed rebuilds, and the rotation effect on distinct counts.

**Strong signals.** Separates identity from attributes before drawing tables; spots that rotated keys inflate distinct counts. **Red flags.** Merging by name; rewriting the visit fact on every merge; publishing busyness without a contributor count.

## GOO-L3-05

**Reference solution** (PostgreSQL; the same query works at every level — at Medium and Hard the deduplication or counting step simply has nothing to remove)

```sql reference
WITH dedup AS (
  SELECT c.conversion_id, c.action_id, c.visitor_key, c.conv_ts, c.value_micros,
         CASE WHEN c.order_id IS NULL THEN 1
              ELSE ROW_NUMBER() OVER (PARTITION BY c.action_id, c.order_id
                                      ORDER BY c.conv_ts, c.conversion_id) END AS copy_no
  FROM conversions c
), credited AS (
  SELECT d.conversion_id, d.action_id, d.conv_ts, d.value_micros, a.counting,
         k.click_id, k.campaign_id, k.click_ts
  FROM dedup d
  JOIN conversion_actions a ON a.action_id = d.action_id
  CROSS JOIN LATERAL (
    SELECT cl.click_id, cl.campaign_id, cl.click_ts
    FROM clicks cl
    WHERE cl.visitor_key = d.visitor_key
      AND cl.click_ts <= d.conv_ts
      AND d.conv_ts <= cl.click_ts + make_interval(days => a.window_days)
    ORDER BY cl.click_ts DESC, cl.click_id DESC
    LIMIT 1
  ) k
  WHERE d.copy_no = 1
), counted AS (
  SELECT *
  FROM (
    SELECT cr.*,
           ROW_NUMBER() OVER (PARTITION BY cr.click_id, cr.action_id
                              ORDER BY cr.conv_ts, cr.conversion_id) AS nth_on_click
    FROM credited cr
  ) x
  WHERE counting = 'every' OR nth_on_click = 1
), click_cells AS (
  SELECT (click_ts AT TIME ZONE 'UTC')::date AS click_date, campaign_id, COUNT(*) AS clicks
  FROM clicks
  GROUP BY 1, 2
), conv_cells AS (
  SELECT (click_ts AT TIME ZONE 'UTC')::date AS click_date, campaign_id,
         COUNT(*) AS conversions, SUM(value_micros) AS conversion_value_micros
  FROM counted
  GROUP BY 1, 2
)
SELECT g.click_date,
       g.campaign_id,
       g.clicks,
       COALESCE(v.conversions, 0)             AS conversions,
       COALESCE(v.conversion_value_micros, 0) AS conversion_value_micros
FROM click_cells g
LEFT JOIN conv_cells v USING (click_date, campaign_id)
ORDER BY g.click_date, g.campaign_id;
```

**Explanation.** The rules are a pipeline and the order matters. Deduplicate first: copies share (action_id, order_id); the earliest copy is the conversion, and which copy survives decides which click is credited. NULL order ids must be kept apart (the `CASE` gives each its own copy number), because a window partition or GROUP BY puts all NULLs in one group. Attribution is a per-conversion top-1 over the visitor's clicks inside the action's own window, inclusive at both ends and never after the conversion; the `click_id DESC` tie-break makes it deterministic. The "one" counting setting is applied per credited click and action. Finally, clicks and conversions are aggregated to (click date, campaign) separately and joined, so the click grid keeps zero rows and a click with several conversions is still one click.

**Complexity.** Deduplication is a sort or hash partition over conversions. The lateral lookup is one index range scan per conversion with an index on `clicks (visitor_key, click_ts DESC, click_id DESC)`: O(C log K) for C conversions and K clicks. At billions of clicks, co-partition clicks and conversions by visitor_key hash and by date, bound the scan by the longest window, and process conversions incrementally by arrival day (a conversion only touches clicks from the previous window_days).

**Dialect notes.** The correlated top-1 (`LATERAL … ORDER BY … LIMIT 1`) runs as written in PostgreSQL and in MySQL 8.0.14+ (`JOIN LATERAL`). BigQuery, Snowflake and Spark SQL restrict correlated subqueries with LIMIT, so write the range join plus `ROW_NUMBER() OVER (PARTITION BY conversion_id ORDER BY click_ts DESC, click_id DESC) = 1` — filtered with `QUALIFY` in BigQuery and Snowflake, or in an outer query in Spark SQL and MySQL. `make_interval(days => n)` is PostgreSQL; BigQuery uses `TIMESTAMP_ADD(click_ts, INTERVAL n DAY)`, Snowflake `DATEADD(day, n, click_ts)`, Spark `click_ts + make_interval(0,0,0,n)` or `date_add` on dates, MySQL `DATE_ADD(click_ts, INTERVAL n DAY)`. `(ts AT TIME ZONE 'UTC')::date` is `DATE(ts)` in BigQuery (UTC by default) and `TO_DATE(CONVERT_TIMEZONE('UTC', ts))` in Snowflake. None of these variants is executed here.

**Edge cases built into the data.** A conversion exactly window_days after its only click (credited); a visitor who clicked two campaigns before converting (last click wins); a conversion just outside the window (unattributed); a visitor whose only click comes after the conversion; a click late in the evening converting after midnight (reported on the click's day); a click with two conversions (the fan-out trap); a click on the last day with no conversions (a zero row); organic conversions from visitors who never clicked. Hard adds: two actions with different windows and a conversion inside one window but not the other; an order uploaded twice, the copies credited to different clicks; two sign-ups with NULL order ids (both count); two clicks at the same instant (higher click_id wins). Very Hard adds: a `one`-counted action with two conversions on one click and with one conversion on each of two clicks; a duplicate upload with an identical timestamp (smaller conversion_id kept).

**Common mistakes.** `<` at the window end; no window, or only its upper bound (crediting clicks after the conversion); first click instead of last; grouping by the conversion's date; `COUNT(*)` of clicks after joining conversions; dropping zero rows (inner join or HAVING); not deduplicating, keeping the latest copy, or partitioning NULL order ids together; the wrong tie-break; one window for all actions; ignoring `one`, or applying it per visitor. Each has a diagnostic.

**Follow-up guidance.** (1) Range join on visitor and window plus `ROW_NUMBER() OVER (PARTITION BY conversion_id ORDER BY click_ts DESC, click_id DESC)`; distribute both tables by visitor_key so the join is local; cluster clicks by visitor_key and click time. (2) The click date of the credited click changes; a day becomes final only after the longest window plus the upload delay; publish a "final as of" marker and a restatement log. (3) A credit-share column per (conversion, click) pair; conversions become fractional sums; the bridge table replaces the top-1 pick. (4) A second aggregate (by conversion date), because the two assign the same conversion to different days; they agree only in total over a closed period.

**Rubric anchors.** 2: right shape but misses the window boundary, the fan-out or the dedup. 3: matches the expected result. 4: also explains the rule order, scale (co-partitioning, bounded windows, incremental processing) and the restatement that click-date reporting implies.

**Strong signals.** Asks which day a conversion is reported on before writing SQL; checks NULLs in the dedup key unprompted. **Red flags.** `NOT IN` against a self-join for dedup without NULL handling; `DISTINCT` to hide fan-out; joining conversions to every click of the visitor and summing.
