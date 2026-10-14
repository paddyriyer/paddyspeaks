# Anthropic · Loop 3 — evaluator notes (hidden from candidates)

## ANT-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Telemetry event contract** `(stream_id, seq, event_type, block_index NULL, block_type NULL, emitted_at, host_id, schema_version, payload_bytes, delta_tokens NULL, stop_reason NULL, usage_output_tokens NULL, error_type NULL)`. `(stream_id, seq)` is the identity: duplicates collapse on it and order is by `seq`, never by timestamp. A delta record stores its size and token count, never the text. Pings are counted, not stored individually.
- **Request/stream context** written once at acceptance: `(stream_id, request_id, workspace_id, api_key_id, model, accepted_at, dequeued_at, first_byte_at, region)`. Queueing time = `dequeued_at − accepted_at` stays its own column so a scheduling change cannot masquerade as a model change.
- **fct_stream** (one row per stream, always): accepted_at, first_event_at, first_delta_at (any block), first_text_delta_at, last_delta_at, ended_at, end_state `completed | error | client_disconnect | timeout_closed`, stop_reason, error_type, output_tokens (from the final usage), delta_count, max_gap_ms, block_count by type, sampled flag. Derived: TTFT_any = first_delta_at − accepted_at, TTFT_visible = first_text_delta_at − accepted_at (NULL when no text), time to last token, output tokens per second = output_tokens / (last_delta_at − first_delta_at) (NULL when fewer than two deltas or zero tokens).
- **fct_stream_block** (one row per content block): stream_id, block_index, block_type `text | tool_use | thinking | …`, started_at, first_delta_at, stopped_at, delta_count, bytes, tokens. Answers "how long does thinking delay visible text" and tool-call timing without event data.
- **Event grain**: kept only for streams sampled by `hash(stream_id) mod N`, all events of the stream, for {{raw_retention}}; used for debugging and to validate the summariser, not for dashboards.
- **Assembly**: a stateful stream processor keyed by stream_id buffers events, dedups on seq, and closes the stream on message stop, on an error event, or on an inactivity timeout (e.g. 2–5 minutes after the last event, or a host-death signal); the timeout path writes `end_state = timeout_closed` with what is known. Late events after close produce a corrected row (upsert by stream_id, version column) rather than a second row.
- **Percentiles**: per (model, workspace, hour) store a mergeable histogram or sketch (fixed log buckets, t-digest, KLL/DDSketch) of each latency; daily and fleet-wide percentiles come from merging sketches, never from averaging percentiles.

**Competing designs to accept.** Computing the stream summary in the serving tier and emitting one record per stream (plus sampled events), if the candidate handles host death (no summary emitted) with a server-side registry of open streams or a reaper. A lakehouse table of events partitioned by hour with a batch summariser, if they meet the 15-minute target with micro-batches and still close incomplete streams. Exact percentiles from the stream fact (it is one row per stream and affordable) instead of sketches, at Medium.

**Bottlenecks and failure modes.** Event volume ({{daily_streams}} × {{events_per_stream}}); hot streams with thousands of deltas; streams that never close; duplicates and reordering from retries; timestamp ties; per-host clock skew (all timings for one stream come from one host, which helps); averaging percentiles; event-level sampling biasing gaps; text leaking into telemetry through error messages.

**Incident guidance.**
- *Message start moved earlier, TTFT "improved" 40%*: the metric measured to the first event of any type, which is not a token. Redefine TTFT to the first delta (any) and first text delta, keep time to first event as a separate infrastructure metric, backfill from fct_stream for the period, annotate the dashboard. Guardrail: a contract test that the first-token metric ignores non-content events, and an alert when two TTFT variants diverge suddenly.
- *2% of streams missing, mostly errors*: summary only on message stop. Close on error events and on inactivity timeout too; backfill from the sampled events where possible and from request logs for counts; publish a corrected error rate. Guardrail: reconcile stream count in fct_stream with accepted requests per hour; alert on any gap.
- *Event-level sampling inflated gaps*: sampling decided per record means consecutive sampled events are far apart. Switch to stream-level sampling by hash; compute max_gap only from complete streams (or in the summariser, which sees all events before sampling); mute the stall alert until the fix lands and recompute its baseline.

**Follow-up guidance.** (1) Name both variants; thinking-first stream: TTFT_any is the thinking delta, TTFT_visible is later; zero output tokens: TTFT NULL, counted in a separate "no output" share, never as 0. (2) Inactivity timeout or host-death signal in the stream processor; end_state and partial counts recorded. (3) Percentiles are not linear; store sketches or histograms and merge them. (4) The alert reads fct_stream (max_gap_ms) for closed streams, or a per-stream rolling state in the processor for in-flight stalls; latency = summariser lag. (5) Versioned contract with additive fields; block_type is open-ended text with a mapped "other"; dashboards read named columns that keep their meaning.

**Rubric anchors.** 2: one events table queried directly for everything, or TTFT defined vaguely. 3: stream and block facts with precise TTFT variants, stream-level sampling, incomplete streams represented. 4: also order-tolerant assembly with versions, mergeable percentile storage, a versioned contract, and incident answers that name the broken definition.

**Strong signals.** Asks "first token of what?" before drawing tables; keeps queueing separate; samples by stream unprompted. **Red flags.** Storing delta text; ordering by timestamp; averaging p95s; summary rows only for completed streams.

## ANT-L3-02

**Reference architecture (one defensible design).**
- **fct_request** `(request_id, workspace_id, api_key_id, model, received_at, end_user_ref NULL, stop_reason, n_tool_definitions, n_tool_use_blocks_new, n_tool_result_blocks_new, input/output tokens)`.
- **dim_tool_version** `(tool_key, workspace_id, name, schema_fingerprint, first_seen_at, last_seen_at)` where `tool_key = hash(workspace_id, name, schema_fingerprint)`. A schema change under the same name is a new version of the same named tool; trend charts can group by name with a version marker.
- **fct_tool_call** (one row per tool_use id, the central fact): `tool_use_id, workspace_id, tool_key, emitted_in_request_id, emitted_at, parallel_group_size, position_in_response, input_bytes, input_schema_valid, result_first_seen_request_id NULL, result_first_seen_at NULL, result_is_error NULL, result_bytes NULL, status open|answered|unanswered|dropped_from_history, run_id`.
- **Linking**: when a request arrives, parse its tool_result blocks; for each `tool_use_id` not yet answered, set the result columns (first seen wins); ids already answered are history and are ignored. Tool-use blocks in the request's history whose ids are already known are ignored; new tool_use ids appear only in responses. Matching is always by id, never by position or order.
- **Agent run**: a chain of requests linked because request N+1 answers a tool_use emitted in response N (run_id = id of the first request in the chain; a union-find over "answers a call from" edges). Optionally refined with end_user_ref. A run ends when a response stops for a reason other than tool use, or when no follow-up arrives within a timeout. Stated limitation: two chains merged or split by edited history are possible; runs without tool use are single requests.
- **Unanswered**: status becomes `unanswered` when no result has been seen within a timeout (e.g. 1 hour) of emission; `dropped_from_history` when a later request in the same run no longer contains the tool_use block and no result (a framework summarised it away).
- **Round-trip time**: `result_first_seen_at − emitted_at`, named "client round trip" (tool execution + developer processing + network + queueing), never "tool latency".
- **Privacy**: inputs and results are never stored; schema validity is computed in flight; sizes and error flags only.

**Competing designs to accept.** A run defined by a client-supplied end-user id plus a time gap, if the candidate says how many requests lack the id and what the metric means then. A prefix-hash approach to recognise history, if they handle edited history by falling back to id-based linking. Graph storage of request edges for run reconstruction.

**Bottlenecks and failure modes.** Resent history double counting; position-based pairing with parallel calls; retries with identical bodies; edited or summarised history; tool name collisions across workspaces; schema changes under the same name; timeouts that decide "unanswered" too early for slow tools; storing customer content in telemetry.

**Incident guidance.**
- *Retried identical requests, answered > calls*: the pipeline counted each sighting of a result as an answer. Make answering idempotent per tool_use_id (first seen wins); dedup requests by body fingerprint within a short window for request counts; recompute affected days. Guardrail: invariant check answered ≤ emitted per workspace per day.
- *Unanswered jumps to 28% after history summarisation*: the calls were answered before the history was summarised, or the summary dropped unanswered blocks. Distinguish `dropped_from_history` from `unanswered`, re-derive status from first-seen results, and tell the affected developers what the metric now means. Guardrail: alert on a step change per framework/user agent, not just per workspace.
- *Results paired by position with {{max_parallel}} parallel calls*: rebuild the pairing by tool_use_id from the retained identifiers; restate the two tools' error rates. Guardrail: a contract test with shuffled result order.

**Follow-up guidance.** (1) Union-find chain over "answers a call from"; breaks with edited history and with parallel sub-agents. (2) Each call has its own row; partially answered groups leave some open until the timeout. (3) First-seen semantics by id; result time = first request that carried it. (4) Version by schema fingerprint; compare error rates per version and mark the change on the chart. (5) Success needs ground truth the API never sees (the developer's own outcome); report proxies honestly: runs ending with end_turn, runs abandoned mid-tool, error-flag rates; offer an opt-in outcome callback as a product idea.

**Rubric anchors.** 2: counts tool_use blocks per request (double counting history) or pairs by position. 3: tool call fact keyed by id, results linked by id with first-seen semantics, tool identity including schema. 4: also a defensible run definition with stated limits, unanswered vs dropped, honest round-trip naming, and privacy-preserving columns.

**Strong signals.** Notices immediately that statelessness means history is resent; keys everything on tool_use_id. **Red flags.** Storing tool inputs "for debugging"; inventing a conversation id the API does not provide; calling the round trip "tool latency".

## ANT-L3-03

**Reference architecture (one defensible design).**
- **dim_organization** `(org_id, name, plan, contract_start, merged_into_org_id NULL, merged_at NULL)`.
- **dim_member** `(member_key surrogate, org_id, idp_user_id NULL, created_at, deprovisioned_at NULL, attributes_purged_at NULL)`. One member_key per person per organization; a returning person is matched by idp_user_id first, then by a verified email match within a policy window, and reactivated rather than recreated (or linked with `previous_member_key` when the policy says it is a new engagement). Email lives in the attribute history, never as the key.
- **member_attributes_scd2** `(member_key, valid_from, valid_to, department, manager_member_key, cost_centre, employment_status, email, display_name, source_sync_id, recorded_at)`. A sync produces a new version only when attributes actually change; effective date is the identity provider's when supplied, otherwise the sync time; a late change with an earlier effective date splits the open interval and the days in between are listed for restatement. Each sync batch is validated (e.g. reject or quarantine a batch where > 5% of members lose a department) before it touches history.
- **seat_assignment** `(member_key, seat_type, assigned_at, unassigned_at NULL, assigned_by manual|sync|trial)` as intervals; no overlapping intervals per member and seat type (exclusion constraint or check in the loader).
- **fct_member_activity_daily** `(org_id, member_key, activity_date (org's time zone), surface web|desktop|mobile, messages_sent, sessions, first_at, last_at)`. No content.
- **Derived**: weekly/monthly active members by distinct member_key over days (stored per period, or as per-member activity bitmaps so periods can be combined exactly); utilisation = active members ÷ assigned seats on the period's last day (or average), stated; activity of members without a seat on that day reported separately.
- **Billing**: at quarter close, compute the peak from the interval table exactly (sweep over assignment start/end events per organization) or from daily maximum concurrent seats, and write `billing_peak (org_id, quarter, peak_seats, method, computed_at, input_hash)`, immutable; corrections are new rows with reason and approval.
- **Purge**: after the purge period, null the personal columns in all attribute versions (email, display_name, manager) and set `attributes_purged_at`; member_key, department and counts remain, so reports stay additive.
- **Merger**: the acquired org gets `merged_into_org_id` and `merged_at`; members are mapped to the surviving org with a `member_merge_map (old_member_key, new_member_key)` so people with seats in both become one; reports after the merge read the surviving org; the quarter's peak is computed over the union of seat intervals after mapping, not by adding peaks.

**Competing designs to accept.** Daily periodic snapshot of seats and attributes (simple, robust) instead of intervals, if the candidate states what intra-day changes it misses and whether the contract cares. Type-1 department with a separate department-history table only for reports. Current-department attribution, if the candidate presents it as an explicit admin choice and offers both views.

**Bottlenecks and failure modes.** Email as key; current-department joins rewriting history; bad sync batches; late effective dates; overlapping seat intervals; summing weekly actives; peaks summed across merged orgs; purge breaking joins; time zones for "day"; trials and post-removal activity.

**Incident guidance.**
- *Empty department for 30% of members*: a sync batch should never be applied blindly. Quarantine batches that change an unusual share of members; for this one, close the bad versions by reverting to the prior values (new versions effective from the original start, with the bad interval marked invalid), rerun the affected week's report, and tell the admin. Guardrail: batch-level anomaly checks and a "pending sync" state.
- *Returning contractors got new ids*: merge each new member_key into the previous one through the identity rule (idp_user_id or verified email), fix seat intervals so they do not overlap, restate cohort reports, and credit the double-counted seat day in billing. Guardrail: match on idp_user_id before creating a member; alert on bulk creations matching deprovisioned emails.
- *Merged organizations' peaks added*: recompute the peak over the union of mapped intervals; people in both count once; document the method in billing_peak and issue a correction row.

**Follow-up guidance.** (1) Active = at least one message sent that day (org time zone); weekly active = distinct members active on any day of the week; utilisation stated with numerator and denominator; seatless activity shown as its own line. (2) The open version is split at Monday; Monday to Thursday activity rows now join to the new department; the restatement list is exactly those member-days. (3) Interval sweep or daily max over seat_assignment, frozen into billing_peak at close. (4) Before: full attributes; after: same rows with personal columns null and purged_at set. (5) merged_into, member map, union of intervals.

**Rubric anchors.** 2: one users table keyed by email with a current department column. 3: surrogate member key, type-2 attributes, seat intervals, daily activity fact, as-of-date attribution. 4: also late-change restatement, batch validation, an immutable billing artefact, a purge that preserves counts, and a merge model.

**Strong signals.** Asks what identifies a person before drawing tables; separates billing artefacts from live tables. **Red flags.** Email as primary key; adding weekly actives; updating department in place; summing peaks.

## ANT-L3-04

**Reference architecture (one defensible design).**
- **dim_model_snapshot** `(snapshot_id, model_family, released_at, deprecated_at NULL, retires_at NULL, announced_at)`; lifecycle dates from public announcements.
- **model_alias_history** `(alias, snapshot_id, announced_from NULL, observed_from, observed_to NULL)`: derived from fct_request (first and last response where `requested_model = alias` was served by the snapshot); announcement kept separately. It is a type-2 dimension whose validity comes from observation.
- **fct_request** `(request_id, app_id, api_key_id, workspace_id, template_id, template_version, requested_model, served_snapshot, experiment_id NULL, arm NULL, task_type, sent_at, ttft_ms, total_ms, input_tokens, output_tokens, stop_reason, status, cost_computed_at_price_version)`.
- **fct_feedback** `(request_id, rating, rated_at)` and **fct_eval_score** `(request_id, grader_id, grader_version, score, scored_at)`: late-arriving facts keyed by request; reports for the last 7 days are labelled provisional.
- **experiment_assignment** `(experiment_id, unit_type end_user|session, unit_id, arm, assigned_at)` and **experiment_arm** `(experiment_id, arm, requested_model, template_version)`: analysis by assignment (intention to treat), not by what served.
- **Comparison queries**: group by served_snapshot within strata (app, template_version, task_type); report per-stratum differences and a weighted average over a common mix; show counts and intervals; latency compared as TTFT and tokens per second as well as total time, since output length differs.
- **Retirement report**: from fct_request over the last N days: distinct app_id, api_key_id, template_id where served_snapshot = X, split into "pinned" (requested_model = X) and "via alias" (requested_model ≠ X).

**Competing designs to accept.** A single "model" column that stores the served snapshot plus a separate requested_model only in raw logs, if the candidate shows the alias questions are still answerable. Bayesian or bootstrap intervals instead of frequentist ones. A difference-in-differences between applications that switched and those that did not, if they state the assumption.

**Bottlenecks and failure modes.** Grouping by requested name; template changes confounded with model changes; mix shift across task types; feedback selection bias and low rates; output-length differences inflating total latency; late feedback making recent days look different; retirement lists built from configuration instead of traffic.

**Incident guidance.**
- *Alias moved, "same model" step change*: the dashboard grouped by requested name. Add served_snapshot as the default grouping, annotate alias moves from the observed history, and send the application team the per-snapshot view. Guardrail: an alert when the distribution of served_snapshot for a requested name changes.
- *Template and snapshot changed the same day*: unidentifiable from that application's traffic alone. Options: roll one change back for a randomised slice, use other applications' switch (same template not changed) as a comparison, or run the offline evaluation on old/new template × old/new snapshot. Say plainly what cannot be concluded.
- *Retirement report missed alias users*: rebuild it from served_snapshot in traffic, not from configuration; include keys and templates; re-send 60 days ahead and track each owner to zero traffic.

**Follow-up guidance.** (1) Per served snapshot for model owners; per requested name for application owners who care about their experience; both from the same fact. (2) Stratify by task_type and show mix per snapshot; weighted comparison. (3) The served-snapshot query split pinned/via-alias. (4) Assignment by end user, analysis by assigned arm including failures and retries; retries are outcomes, not exclusions. (5) Minimum counts per cell, intervals, and a "not enough data" state.

**Rubric anchors.** 2: one model column, mean metrics, no template version. 3: requested vs served, snapshot dimension with lifecycle dates, template version, late-arriving feedback. 4: also stratified or randomised comparisons with stated confounding and bias, observation-based alias history, and a traffic-based retirement report.

**Strong signals.** Separates requested from served in the first minute; raises confounding with template changes. **Red flags.** "Compare the averages before and after"; treating thumbs-down rate as unbiased quality; alias history typed by hand.

## ANT-L3-05

**Reference solution** (PostgreSQL; `{{window_start}}`, `{{window_end}}`, `{{report_at}}`, `{{min_users}}` and `{{min_orgs}}` are the instance's values. At Medium the organization threshold is 1, and at Medium and Hard every facet row was classified before the report time, so the same query applies at every level.)

```sql reference
WITH facet AS (
  SELECT DISTINCT ON (conversation_id) conversation_id, task_category
  FROM conversation_facets
  WHERE classified_at <= TIMESTAMPTZ '{{report_at}}'
  ORDER BY conversation_id, classified_at DESC
), counted AS (
  SELECT c.conversation_id, c.user_key, c.org_id, f.task_category,
         date_trunc('week', c.created_at)::date AS week_start
  FROM conversations c
  JOIN orgs o  ON o.org_id = c.org_id AND NOT o.analytics_opt_out
  JOIN facet f ON f.conversation_id = c.conversation_id
  WHERE c.created_at >= TIMESTAMPTZ '{{window_start}}'
    AND c.created_at <  TIMESTAMPTZ '{{window_end}}'
    AND NOT EXISTS (SELECT 1 FROM deletion_requests d WHERE d.conversation_id = c.conversation_id)
), cells AS (
  SELECT week_start, task_category,
         COUNT(*)                AS conversations,
         COUNT(DISTINCT user_key) AS users,
         COUNT(DISTINCT org_id)   AS orgs
  FROM counted
  GROUP BY week_start, task_category
), verdict AS (
  SELECT cells.*, (users >= {{min_users}} AND orgs >= {{min_orgs}}) AS publishable
  FROM cells
), other AS (
  SELECT k.week_start, 'other' AS task_category,
         COUNT(*)                  AS conversations,
         COUNT(DISTINCT k.user_key) AS users,
         COUNT(DISTINCT k.org_id)   AS orgs
  FROM counted k
  JOIN verdict v ON v.week_start = k.week_start AND v.task_category = k.task_category
  WHERE NOT v.publishable
  GROUP BY k.week_start
)
SELECT week_start, task_category, conversations, users, orgs FROM verdict WHERE publishable
UNION ALL
SELECT week_start, task_category, conversations, users, orgs FROM other
WHERE users >= {{min_users}} AND orgs >= {{min_orgs}}
ORDER BY week_start, task_category;
```

**Explanation.** Every rule about a single conversation (window, opt-out, deletion, category, week) is settled once in `counted`, one row per conversation, so nothing downstream can double count. `DISTINCT ON` keeps one facet row per conversation, the latest known at the report time; filtering facets by `report_at` makes the report reproducible, while deletions are honoured whatever their time because reproducibility never brings deleted data back. Cells are aggregated with distinct users and organizations, judged against inclusive thresholds, and the conversations of the failed cells are re-aggregated **from the rows**, so a user who appears in two suppressed categories counts once in `other`. `other` is itself an aggregate and is published only if it clears the thresholds.

**Complexity.** One sort or hash for `DISTINCT ON` over the facets, one hash aggregate over counted conversations, and a second aggregate over the suppressed subset: linear in the window's conversations plus sorts. At production scale this is computed per week incrementally: keep per-(week, category) sets of user and org keys (or exact distinct counts recomputed only for weeks touched by deletions or re-classification), never approximate sketches for a privacy threshold.

**Dialect notes.** `DISTINCT ON` is PostgreSQL only: Snowflake and BigQuery use `QUALIFY ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY classified_at DESC) = 1`, Spark SQL and MySQL 8 a subquery with `ROW_NUMBER()`. Week start: `date_trunc('week', ts)` is Monday-based in PostgreSQL and Snowflake by default (Snowflake's `WEEK_START` parameter can change it); BigQuery needs `DATE_TRUNC(DATE(ts), WEEK(MONDAY))` or `ISOWEEK` because `WEEK` starts on Sunday; Spark's `date_trunc('week', ts)` is Monday-based; MySQL needs `DATE_SUB(DATE(ts), INTERVAL WEEKDAY(ts) DAY)`. Timestamp literals: `'…'::TIMESTAMP_TZ` (Snowflake), `TIMESTAMP '…'` (BigQuery, UTC). None of these variants is executed here.

**Edge cases built into the data.** A cell at exactly `min_users` (published); cells one user short; two suppressed cells in the same week that share a user (so summing their users overstates `other`); a week whose only suppressed cell is too small for `other` to be published; a cell lifted to the threshold only by a user whose conversations are all deleted; a cell lifted only by users of the opted-out organization; unclassified conversations; a conversation exactly at the window start (included) and exactly at its end (excluded); a conversation exactly at Monday 00:00 inside the window; conversations before and after the window. Hard adds re-classified conversations (latest facet wins) and a cell with enough users from too few organizations. Very Hard adds a retention window that starts and ends mid-week (partial weeks), a conversation first classified after the report time (unclassified for this report), a re-classification after the report time (ignored), and a deletion requested after the report time (still honoured).

**Common mistakes.** Counting deleted or opted-out conversations; `>` instead of `>=`; summing users across suppressed cells; dropping suppressed cells instead of merging them; publishing `other` unconditionally; LEFT JOIN to facets that lets unclassified conversations into `other`; Sunday-based weeks; ignoring the window or retention cut-off; ignoring the organization threshold; using the first facet, or every facet row; using facets classified after the report time; honouring only deletions requested before the report. Each has a diagnostic.

**Follow-up guidance.** (1) With a published weekly total, total minus published cells equals `other` (or the single suppressed cell, if `other` is withheld and only one cell was suppressed): complementary suppression or not publishing totals; across reports, overlapping windows allow differencing too. (2) Store per-(week, category) distinct key sets or recompute only touched weeks; republish with a revision note; if a published cell falls below the threshold, it moves into `other`. (3) Yes: two adjacent reports can differ by one user; mitigations are rounding to a base, small calibrated noise (differential privacy) or stable cell membership rules; say what the threshold does and does not guarantee. (4) Keep the published aggregates (which passed the threshold) and their run metadata, not the raw rows; a reproduction request gets the published numbers and an explanation that the inputs were deleted by policy.

**Rubric anchors.** 2: right shape but counts deleted/opted-out conversations or sums users into `other`. 3: matches the expected result. 4: also explains differencing risk, incremental recomputation after deletions, and why facets are cut at the report time while deletions are not.

**Strong signals.** Asks whether `other` must itself meet the threshold; mentions that sketches are not acceptable for a privacy threshold near its boundary. **Red flags.** `SUM(users)` for `other`; treating a deletion as optional for reproducibility; publishing a total next to suppressed cells without noticing the leak.
