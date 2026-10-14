# Hugging Face · Loop 3 — evaluator notes (hidden from candidates)

These are simulated practice scenarios set in the public product domain of an open
hub of models, datasets and Spaces and its inference endpoints. Product behaviour
is described generally and every rule, threshold and number is the exercise's own
(check current docs); nothing here describes the hub's internal infrastructure.
Score the reasoning, not agreement with these notes.

## HGF-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Immutable, hash-keyed objects.**
  - `repos (repo_id, kind model|dataset|space, created_at, visibility_history via repo_visibility)`; `repo_names (repo_id, owner, name, valid_from, valid_to)` so renames and transfers keep one key.
  - `commits (repo_id, commit_id, author_kind, committed_at, pushed_at, message_len)` and `commit_parents (repo_id, commit_id, parent_id, parent_ordinal)` (merges have two rows).
  - `blobs (blob_id, size_bytes, is_pointer)`; `pointer_blobs (blob_id, object_sha256, object_size_bytes)`; `large_objects (object_sha256, size_bytes, first_seen_at)`.
- **Mutable refs as history.** `ref_history (repo_id, ref_type branch|tag, ref_name, commit_id, valid_from, valid_to, change_kind create|fast_forward|force_push|delete|recreate, push_id)`. Built from push events (old, new) with a uniqueness rule: one open interval per (repo, ref). "What `main` was at T" is `valid_from <= T < valid_to`.
- **Manifests without copying every file per commit.**
  - `manifest_changes (repo_id, commit_id, path, change added|modified|deleted, blob_id)` against the first parent.
  - `manifest_checkpoints (repo_id, commit_id, path, blob_id)` every N commits along first-parent history or when the change chain exceeds a size budget (e.g. reconstruct with at most K change sets). Reconstruction: nearest checkpoint ancestor plus changes after it.
  - A materialised `manifest_current` for each branch head serves most reads; historical revisions reconstruct on demand.
- **Reverse index.** `object_refs (object_sha256, repo_id, commit_id, path)` written from manifest changes (added/modified pointer blobs), so "which revisions reference O" is a lookup; joined with `repo_visibility` at query time so private repos never leak into public answers.
- **Facts.** `fct_commits_daily (repo_id, date, commits, pushes, force_pushes)`; `fct_revision_size (repo_id, commit_id, files, pointer_files, bytes_inline, bytes_large)` where bytes count the object size for pointers and the blob size otherwise, never both.
- **Retention.** Unreachable commits (no ref interval names them and no reachable commit descends from them) are marked `unreachable_since` and kept for a stated period.

**Competing designs to accept.** Full manifests per commit in a columnar store with heavy compression, if the candidate quantifies the cost at {{daily_commits}} commits a day and {{max_files}} files and partitions sensibly. A graph store for the commit DAG with a warehouse copy for analytics. Validity intervals per (repo, branch, path) instead of change sets, provided merges and force-pushes are handled (intervals are per branch history, so a force-push closes and reopens them).

**Bottlenecks and failure modes.** Copying {{max_files}} rows per commit; resolving branch names with today's head for historical events; counting both pointer and object bytes; keying by owner/name; losing commits on force-push; diffing merges against an arbitrary parent; long change chains without checkpoints; private repos visible through the reverse index.

**Incident guidance.**
- *Bytes per model doubled*: the job summed pointer-blob sizes and object sizes for the same path. Restate the affected days from manifests with the rule "object size for pointers, blob size otherwise", and add a check that revision bytes ≤ Σ distinct object sizes + inline bytes, plus a day-over-day change alert per repo.
- *Downloads attributed to future commits*: resolution used the ref's current head. Re-resolve using `ref_history` at the request time (or the commit id recorded at request time, which is better), restate the affected window, and store the resolved commit id at ingestion from then on.
- *Slow reconstruction*: checkpoints only at creation. Backfill checkpoints for large or busy repos, set a policy (every N commits or a change-volume budget), and alert when the replay length for a lookup exceeds the bound.

**Follow-up guidance.** (1) Find the commit from `ref_history` at the date, reconstruct its manifest (checkpoint + changes), sum sizes with the pointer rule. (2) The open `main` interval closes and a new one opens with change_kind force_push; old commits stay, marked unreachable after retention checks; a download that recorded the commit id still resolves; one that recorded only "main" resolves via the interval at its time. (3) First parent for storage; "which commit introduced a path" walks first-parent history (or uses blame-like change rows) and must say how merges are treated. (4) A concrete checkpoint policy and the worst-case reconstruction cost. (5) The reverse index plus visibility at query time.

**Rubric anchors.** 2: one repos table with a current head and a files table per repo, no history. 3: immutable commits and parents, ref history as intervals, manifests by diff with some reconstruction story, pointers separated from objects. 4: also checkpoint policy with bounds, force-push and tag-move semantics, rename-stable keys, a reverse index that respects visibility, and correct incident handling.

**Strong signals.** Separates content-addressed facts from mutable names unprompted; asks how a revision is written in requests. **Red flags.** Overwriting the head; summing pointer and object sizes; owner/name as the key.

## HGF-L3-02

**Reference architecture (one defensible design).**
- **Gate configuration versions.** `gate_versions (repo_id, version, gated bool, approval_mode auto|manual, conditions_text_hash, form_schema (field ids, labels, types), reaccept_required bool, created_by, created_at)`. The conditions text itself is stored for display; analytics needs only the version.
- **Requests.** `access_requests (request_id, repo_id, user_id, gate_version, requested_at)` and `request_decisions (request_id, decision approved|rejected|revoked|closed_gate_removed|superseded, actor_kind owner|org_member|auto_rule, actor_id NULL, decided_at, reason_code NULL)`.
- **Grants as intervals.** `access_grants (grant_id, repo_id, user_id, request_id, gate_version, valid_from, valid_to NULL, end_reason revoked|reaccept_required|gate_removed)`. "Could U download from R at T": the repo was gated at T and a grant covers T (or the repo was ungated at T).
- **Form answers.** `request_form_answers (request_id, field_id, value)` in a separate store with access limited to the repo's owners and the requesting user, a retention period and deletion on request; analytics receives only "form completed" and counts.
- **Licence.** `repo_licence_declarations (repo_id, commit_id, declared_licence_text, licence_id NULL (resolved from a list), valid_from, valid_to)` from the metadata history. It records the declaration only.
- **Facts.** `fct_access_requests (request_id, repo_id, approval_mode_at_request, requested_at, first_decision_at, first_decision, hours_to_decision, is_rerequest)` with mode taken from the gate version at request time; pending requests have no hours and are counted separately; `fct_grants_daily (repo_id, date, users_with_access)`.

**Competing designs to accept.** Event-sourced requests with grants as a projection. One request row with a decision history table and grants derived as a view, if the view is interval-correct. A per-repo access list maintained online for authorisation plus the history tables for analytics.

**Bottlenecks and failure modes.** One status column overwritten; grants derived only nightly so revocations take a day; form answers copied into analytics; using the current approval mode for history; mixing automatic and manual decisions in one median; licence treated as a legal fact; re-acceptance after condition changes not modelled.

**Incident guidance.**
- *Median 0 hours for a manual repo*: the fact used the current mode. Rebuild the fact with the mode from the gate version at request time, restate the month, and add a test that a mode switch mid-period splits the metric.
- *Form answers in the analyst export*: stop and delete the export and its copies, treat it as a personal-data incident under the documented process, and fix the root cause: answers live only in the restricted store, and the export uses an explicit column allowlist with a schema-change check that fails on new columns.
- *"Users with access" stale after a mass revocation*: grants were derived nightly from approvals only. Write revocations to the grant intervals synchronously (authorisation already depends on them), derive daily counts from intervals, and alert when decisions and grants disagree; at {{daily_requests}} requests a day the decision path must not wait behind a batch.

**Follow-up guidance.** (1) Interval lookup: no grant at 14:00 between the revocation at 13:00 and the re-approval at 15:00. (2) New gate version with reaccept_required closes existing grants with end_reason reaccept_required (or keeps them until re-acceptance, if the owner chose so); users see a "accept the updated conditions" state. (3) Time from request to first decision, by approval mode at request time, pending excluded and counted; re-requests are separate requests. (4) Delete the answers; keep the request and decision rows (no answers) for audit; aggregates unaffected because they never held answers. (5) Decisions and requests grow fastest; a current-access table per repo (or an index on open grants) serves owners.

**Rubric anchors.** 2: one table of users with a status and the form answers next to it. 3: versioned gates, requests with decision events, grants as intervals, answers isolated. 4: also mode-at-request facts, re-acceptance, deletion handling, licence as declaration with no conclusions, and correct incident handling.

**Strong signals.** Asks who can read form answers before drawing tables. **Red flags.** Analytics on form answers; claims about what a licence allows; editing grants in place.

## HGF-L3-03

**Reference architecture (one defensible design).**
- **Raw and parsed per revision.** `card_headers (repo_id, commit_id, branch_is_default, pushed_at, header_raw, header_hash)`; `card_parses (repo_id, commit_id, parser_version, status ok|partial|malformed, errors[])`.
- **Normalised relations with provenance.** `card_base_models (repo_id, commit_id, parser_version, declared_text, resolved_repo_id NULL, relation fine_tune|adapter|quantised|merge|unknown)`, `card_datasets (… declared_text, resolved_repo_id NULL)`, `card_tags (… tag_text, vocab_version, in_vocabulary bool)`, `card_licence (… declared_text, licence_id NULL, vocab_version)`. Unknown or unresolved values are kept as declared text.
- **Current and temporal views.** For the default branch, intervals per repo: `model_metadata_history (repo_id, valid_from, valid_to, commit_id)`; "as of D" picks the commit valid at D and joins its relations. `model_metadata_current` holds the last commit with status ok or partial (last good metadata for search), plus a flag when the head header is malformed.
- **Resolution.** References resolve to stable repo ids through `repo_names` history at the time of the edit and are re-resolved when a name changes; the declared text never changes.
- **Vocabularies.** `vocab_versions (vocab, version, valid_from, terms)`; re-validation writes new parse rows with the new parser or vocab version instead of overwriting old ones.
- **Derived views.** The derivative list = children whose current metadata has a base-model relation resolved to this repo, maintained incrementally from card-edit events (recursion with a visited set for "all descendants", cycles cut, private repos filtered by visibility at read time). Facets for search are flattened from current metadata.
- **Facts.** `fct_card_validity_monthly (month, repos, valid_headers, partial, malformed)` by parser version; `fct_base_model_changes (repo_id, commit_id, old, new, at)`.

**Competing designs to accept.** Keeping the parsed header as a semi-structured column per revision with search facets flattened by a stream job, if relations are still queryable by stable id. Bitemporal tables (revision time × parser version). Graph store for the derivative relations with the warehouse as history.

**Bottlenecks and failure modes.** Overwriting metadata in place; dropping unknown values; foreign keys that reject unresolved references; keying relations by owner/name; re-parsing everything for each vocabulary change; reading only one field when a new list field appears; letting malformed headers wipe search facets.

**Incident guidance.**
- *"No licence" for {{invalid_share}} of models after the list update*: unknown values were dropped. Roll back to the previous parse version for search, re-run keeping declared text with `licence_id NULL`, and add a guard that a re-validation may not change more than a set share of current facets without review.
- *Derivative list collapsed after a rename*: relations were keyed by declared owner/name. Re-resolve declared text via the name history to stable ids, rebuild the list, and add a test that renaming a repo leaves its derivative count unchanged.
- *Merges disappeared after a template change*: the parser ignored a new list field. Add the field, reparse the affected revisions (parse rows are versioned, so the change is auditable), and monitor per-relation-type counts day over day with an alert on a sudden drop.

**Follow-up guidance.** (1) One header row, one parse row, licence row with the new value, a tag row with in_vocabulary false, two base-model rows of type merge; the interval for the previous commit closes. (2) New parser version, reparse affected revisions, report validity share per parser version, restate with a note. (3) Interval lookup on default-branch history at 1 March. (4) Rename: resolution follows the stable id, the list is unchanged; delete: children keep declared text, resolved id points to a deleted repo, the list shows "base model unavailable". (5) Incremental updates from card-edit events: only changed repos and their parents' lists are touched.

**Rubric anchors.** 2: a models table with columns for licence and base model, overwritten. 3: raw header per revision, normalised relations tied to revisions, declared versus resolved references. 4: also versioned parsing and vocabularies, last-good metadata for search, stable-id resolution across renames, cycle-safe derivative views and correct incident handling.

**Strong signals.** Keeps what the owner wrote separate from what the system understood. **Red flags.** Rejecting or dropping unknown values; claiming a declared licence or dataset is verified.

## HGF-L3-04

**Reference architecture (one defensible design).**
- **Code.** `spaces (space_id, repo_id, sdk, created_at)`; `space_builds (build_id, space_id, commit_id, attempt, trigger push|settings|restart|retry, queued_at, started_at, finished_at, outcome succeeded|failed|cancelled, failure_class dependency|build_timeout|oom|syntax|registry|unknown)`. Build logs stay in an owner-only log store.
- **Configuration.** `space_config_versions (space_id, version, hardware_tier, sleep_after_s, created_by, created_at)`; `space_secret_changes (space_id, secret_name, action added|updated|removed, actor_id, at)` with no value, hash or length; variables (non-secret) may be versioned with values if owners accept they are visible.
- **Runtime.** `space_runtime_intervals (space_id, state building|running|sleeping|paused|error|deleted, build_id, config_version, valid_from, valid_to)`, built from runtime events ordered by event time, with an event id for deduplication. `space_wakes (space_id, wake_id, trigger_visit_at, running_at, from_state)`.
- **Hardware hours.** Overlap of running intervals with hardware intervals (config versions), split at day boundaries in UTC.
- **Duplication.** `space_duplications (space_id, source_space_id, source_commit_id, duplicated_at)`; divergence = the duplicate's current tree hash versus the source commit's tree hash (or versus the source's current head, for "still the same as the source").
- **Facts.** `fct_builds_daily (date, sdk, failure_class, builds, commits_with_failure)` counting per commit as well as per attempt; `fct_hardware_hours (date, tier, hours)`; `fct_wakes (date, tier, wakes, p50_wake_s)`.
- **Secret boundary.** The secrets store is read only by the runtime that injects values into the container; events and logs from the platform carry secret names only; nothing in analytics reads build-log text; a scanner on analytics tables and exports looks for secret-like strings as a backstop.

**Competing designs to accept.** Event-sourced runtime with interval projections. A state-machine table with transition rows (from, to, at) instead of intervals, if hardware hours can be reconstructed. Divergence measured by file-level manifest comparison instead of tree hashes.

**Bottlenecks and failure modes.** Overwritten current state; intervals closed by the next event of any kind with out-of-order events; build attempts counted as failures per commit; build-log text in analytics; secrets hashed into analytics (a hash of a short key can be brute-forced); lineage lost when the source is deleted; wake time measured from the wrong event.

**Incident guidance.**
- *Log lines with API keys in analytics*: delete the column and every copy and derived extract, notify affected owners so they rotate keys, follow the documented incident process, and fix the root cause: the classifier runs inside the owner-only log boundary and emits a failure class only; add a secret-pattern scanner on analytics tables and a schema review for new text columns.
- *Hardware hours dropped after the sleep change to {{sleep_hours}} hours*: intervals were closed by any next event and events arrived out of order. Rebuild intervals ordered by event time with explicit transitions (running ends only on sleeping, paused, error, deleted or a new build), restate the days, and reconcile hours against billing-relevant run records daily.
- *Retry storm doubled failure rate*: attempts counted as builds. Report per commit (latest attempt outcome) as well as per attempt, mark registry failures as platform-caused, and alert on attempts per commit at {{daily_builds}} builds a day.

**Follow-up guidance.** (1) Build rows (failed, then succeeded), runtime intervals building → running, a config version for the GPU tier and a new running interval after the restart. (2) Wake time from the first visit while sleeping to the first successful health check; a visit during waking joins the same wake. (3) Split intervals at midnight, intersect with tier intervals, sum per tier. (4) Compare tree hashes with the source commit; "same code" means the same tree, not the same files list. (5) Trace the secret path: store → runtime injection; check build logs and any new text column first.

**Rubric anchors.** 2: a spaces table with a status and hardware column, secrets mentioned as "encrypted in the DB". 3: separate code, config and runtime histories, intervals, classified failures, names-only secret metadata. 4: also precise wake definitions, interval overlap for hardware hours, lineage and divergence, the secret boundary with a backstop scanner, and correct incident handling.

**Strong signals.** Treats build logs as untrusted user output. **Red flags.** Hashing secret values into analytics; build-log text in a warehouse; overwriting state.

## HGF-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH req AS (                                   -- one row per request_id: the log is at least once
  SELECT DISTINCT ON (request_id) request_id, endpoint_id, received_at
  FROM endpoint_requests
  ORDER BY request_id, logged_at
), classified AS (
  SELECT q.request_id, q.endpoint_id, q.received_at,
         st.kind IN ('scaled_to_zero', 'start_failed', 'resumed') AS is_cold,
         nr.ready_at
  FROM req q
  LEFT JOIN LATERAL (
    SELECT e.kind
    FROM endpoint_events e
    WHERE e.endpoint_id = q.endpoint_id AND e.occurred_at <= q.received_at
    ORDER BY e.occurred_at DESC
    LIMIT 1
  ) st ON TRUE
  LEFT JOIN LATERAL (
    SELECT MIN(e.occurred_at) AS ready_at
    FROM endpoint_events e
    WHERE e.endpoint_id = q.endpoint_id AND e.kind = 'replica_ready' AND e.occurred_at > q.received_at
  ) nr ON TRUE
)
SELECT ep.endpoint_id,
       COUNT(c.request_id) AS requests,
       COUNT(*) FILTER (WHERE c.is_cold) AS cold_requests,
       COUNT(*) FILTER (WHERE c.is_cold AND c.ready_at IS NULL) AS waiting_at_end,
       COALESCE(SUM(EXTRACT(EPOCH FROM c.ready_at - c.received_at)) FILTER (WHERE c.is_cold), 0) AS total_wait_s,
       COALESCE(MAX(EXTRACT(EPOCH FROM c.ready_at - c.received_at)) FILTER (WHERE c.is_cold), 0) AS max_wait_s
FROM endpoints ep
LEFT JOIN classified c ON c.endpoint_id = ep.endpoint_id
GROUP BY ep.endpoint_id
ORDER BY ep.endpoint_id;
```

**Explanation.** Whether a request was cold depends on the endpoint's state when it arrived, and the state is set by the latest event at or before `received_at`; the LATERAL lookup reads exactly that event. The cold kinds are `scaled_to_zero`, `start_failed` (a failed wake keeps the endpoint at zero) and `resumed` (resuming starts from zero); `paused` and `replica_ready` are not cold, so paused requests count only as requests and a request right before an autoscaling `replica_ready` is served. The wait ends at the first `replica_ready` strictly after arrival; a missing one leaves `ready_at` NULL, which counts the request as waiting and keeps it out of SUM and MAX. A request with no earlier event (serving at the start) has `is_cold` NULL, which FILTER treats as false. Starting from `endpoints` keeps endpoints with no requests. The DISTINCT ON costs nothing at Medium and Hard (request_id is unique) and is required at Very Hard. Listing kinds that never occur at a level (start_failed, resumed) is harmless.

**Complexity.** Two index lookups per request on (endpoint_id, occurred_at) (with kind for the second), plus one sort for DISTINCT ON and one hash aggregate. At production scale, precompute at-zero intervals per endpoint once from the event log ([zero_start, first ready after it), with failed starts inside) and range-join requests to intervals by endpoint and time; cluster requests by endpoint and time.

**Dialect notes.** `LATERAL` exists in Snowflake and (as LATERAL subqueries with limits) in recent Spark versions, but BigQuery has no correlated LIMIT subquery: use a window over a UNION ALL of events and requests ordered by time, carrying the last event kind forward with `LAST_VALUE(kind IGNORE NULLS) OVER (PARTITION BY endpoint_id ORDER BY t, is_request)` (the tie order is how "at or before" is enforced), and `MIN(...) OVER (... ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING)` for the next ready time. `FILTER (WHERE …)` becomes `COUNTIF` (BigQuery) or `SUM(IFF(…,1,0))` / `COUNT_IF` (Snowflake), `SUM(CASE …)` in MySQL and Spark. `EXTRACT(EPOCH FROM …)` becomes `TIMESTAMPDIFF(SECOND, a, b)` (MySQL), `TIMESTAMP_DIFF(b, a, SECOND)` (BigQuery), `DATEDIFF('second', a, b)` (Snowflake). `DISTINCT ON` becomes `QUALIFY ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY logged_at) = 1`. None of these variants is executed here.

**Edge cases built into the data.** A request at exactly the scale-to-zero second (cold); a request at exactly the `replica_ready` second (served); several requests held by one wake; an autoscaling `replica_ready` right after a request on a serving endpoint, including on the endpoint with `min_replicas` 1; requests while serving before any event; an endpoint that scaled to zero and received nothing (a row of zeros). Hard adds failed starts with requests arriving after the failure, and a cold period still open at the end of the export (waiting requests with no wait). Very Hard adds a paused period (a request at exactly the pause second is rejected, not cold), requests between `resumed` and `replica_ready` (cold), and redelivered request rows.

**Common mistakes.** Exclusive start or inclusive end of the cold period; deciding "cold" from the next event (LEAD), which turns every request before an autoscaling `replica_ready` into a cold start; starting from requests so idle endpoints vanish; (Hard+) ending the wait at `start_failed`, or dropping requests still waiting at the end; (Very Hard) counting redelivered rows, counting paused requests as cold, treating `resumed` as serving. Each has a diagnostic. `BETWEEN zero_at AND ready_at` is a frequent source of the inclusive-end error.

**Follow-up guidance.** (1) UNION ALL events and requests, order by time with events before requests at the same second, carry the last event kind forward; at equal seconds the tie-break decides the boundary rule, so it must be explicit. (2) Build intervals with a window over events (each cold-starting event to the next `replica_ready`), store them, and range-join with an index on (endpoint_id, start) or clustering by endpoint and day. (3) `PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY wait)` per endpoint; engines with only approximate percentiles return an estimate, which is fine for a dashboard if labelled. (4) The hourly price of a warm replica, how many cold periods a warm replica would remove, and the assumption that traffic does not change when latency improves; the decision also depends on how many callers time out during a wait.

**Rubric anchors.** 2: right shape but cold decided by the next event, or endpoints with no requests missing. 3: matches the expected result. 4: also explains interval precomputation, the tie-break in the window version and the warm-replica trade-off.

**Strong signals.** Asks what `replica_ready` means on a serving endpoint; states boundary rules before writing SQL. **Red flags.** `SELECT DISTINCT *` (redelivered rows differ in logged_at); filtering or ordering by logged_at; joining every request to every event and aggregating.
