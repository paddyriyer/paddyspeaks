# Adobe · Loop 3 — evaluator notes (hidden from candidates)

## ADB-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Documents.** `documents (document_id, owner_id, owner_org_id NULL, created_at, created_by_app, deleted_at NULL, purged_at NULL)`. Ownership transfers are rows in `document_ownership (document_id, owner_id, owner_org_id, valid_from, valid_to)`, so "outside the organisation" can be computed as of any date.
- **Versions.** `document_versions (version_id, document_id, seq, kind autosave|manual|restore, based_on_version_id, restored_from_version_id NULL, committed_at (server), client_saved_at, app, app_version, device_class, size_bytes, component_count, content_ref, contents_deleted_at NULL)`. Append-only; `seq` is assigned by the service per document, so ordering never depends on device clocks. `content_ref` points to stored contents; retention clears the contents and sets `contents_deleted_at`, but the row stays as a tombstone.
- **Names.** `version_names (version_id, name, named_by, named_at, removed_at NULL)`: a history, so a rename is a new row. A version with an active name is exempt from retention; removing the last name makes it eligible again from that moment.
- **Current version.** Derived: the version with the highest `seq` committed at or before t. A cached `current_version_id` on the document is acceptable for serving if it is verified against the derivation; it is never the source for history.
- **Sharing.** `access_grants (grant_id, document_id, principal_type person|link|org, principal_id, role viewer|commenter|editor, granted_by, valid_from, valid_to NULL, change_reason)`. A role change closes the open row and opens a new one; revocation closes it; a link toggled off and on is two intervals. "Who could edit at t" = owner as of t ∪ grants with role editor and valid_from ≤ t < valid_to.
- **Comments.** `comments (comment_id, document_id, version_id, anchor (region or object id + coordinates), author_id, created_at, resolved_at NULL, resolved_by)` and `comment_replies`. The anchor keeps the original version; carry-forward to later versions is computed by the app (object still exists) and may be cached in `comment_anchor_resolution (comment_id, version_id, status shown|orphaned)`.
- **Analytics facts (no contents).** `fct_version_saved` (one row per version: document, app, kind, size, committed date), `fct_document_day` (document × day: versions saved, active editors, apps), `fct_sharing_interval` derived from grants, `fct_comment` (created, resolved, time to resolution, anchor status). File names, layer names and text never leave the operational store.
- **Estimate.** At follow-up 3's numbers: 3% of {{documents}} documents edited for two hours with a version every {{autosave_minutes}} minutes is the version-row count per day; tens to hundreds of millions of small rows a day at the top level, which is fine as an append-only partitioned table, while daily aggregates serve most dashboards.

**Competing designs to accept.** A single event log of document actions (saved, named, restored, shared, commented) with projections for versions, grants and comments, as long as as-of queries are defined on it. Type 2 history on the grant table instead of explicit intervals (equivalent). Storing named-ness as an attribute of the version row with a separate audit table for renames.

**Bottlenecks and failure modes.** An `is_current` flag flipped in place (no history, races between devices); grants overwritten or deleted (access history lost); deleting version rows under retention (comments, names and restore lineage dangle); ordering versions by device time; counting autosaves as user activity without separating kinds; contents (file or layer names) leaking into analytics.

**Incident guidance.**
- *Retention deleted metadata rows*: the job removed the row, not just the contents. Stop the job; restore the rows from the backup or the change log (contents are gone, metadata is not); make retention clear `content_ref` and set `contents_deleted_at` only; add a foreign-key or integrity check that every comment, name and `based_on_version_id` resolves before the job commits. Retention period ({{unnamed_retention_days}} days) unchanged.
- *Autosave every few seconds*: detect from versions per document-hour against the expected rate (one per {{autosave_minutes}} minutes while editing); contain by rate-limiting accepted autosaves server-side or coalescing them; report the metric by `kind` and exclude the affected app version from comparisons, with an annotation; add an alert on versions per active document by app version.
- *Grants updated in place*: rebuild the history from the sharing audit log or change capture if it exists, and say plainly what cannot be reconstructed; move to effective-dated grants with closes instead of updates and deletes; add a test that a revocation leaves a closed interval.

**Follow-up guidance.** (1) Max seq with committed_at ≤ t; grants with valid_from ≤ t < coalesce(valid_to, ∞) plus the owner as of t, link principals included. (2) The comment still points at the tombstoned version; the panel shows it as "on a removed version" with its anchor resolved against the nearest later version if possible. (3) Version rows at version grain for recent months, document-day aggregates for history. (4) A new ownership interval; grants stay; past months are not restated because ownership is as-of. (5) The model proves which grants existed and which link was on; it cannot prove who received a forwarded link, only who opened it if access logs exist.

**Rubric anchors.** 2: a documents table with a current version column and a permissions table updated in place. 3: immutable versions with lineage, derived current version, effective-dated grants, comments on versions, tombstones under retention. 4: also names as history, link principals, ownership as of a date, carry-forward rules for comments, an estimate and content-free facts.

**Strong signals.** Asks "as of when?" before drawing tables; separates version metadata from stored contents. **Red flags.** Deleting rows to apply retention; ordering by device clock; file or layer names in analytics.

## ADB-L3-02

**Reference architecture (one defensible design).**
- **Agreements.** `agreements (agreement_id, account_id, sender_id, template_id NULL, template_version NULL, created_at, sent_at NULL, expires_at NULL, signing_mode sequential|parallel|groups)`. No mutable status as source of truth; the lifecycle is derived from events (a cached status is fine for serving).
- **Documents.** `agreement_documents (agreement_id, document_ref, page_count, size_bytes, position)`: references and metadata only.
- **Plan (frozen at send).** `participant_sets (agreement_id, set_id, order_no)`; `participant_slots (agreement_id, slot_id, set_id, role signer|approver|form_filler|cc, original_participant_id)`. Edits before sending create a new plan version; after sending the plan is immutable (a sender's "replace participant" is an event, not an edit).
- **Events (append-only).** `agreement_events (event_id, agreement_id, slot_id NULL, actor_participant_id, type created|sent|viewed|reminder_sent|delegated|signed|approved|declined|cancelled|expired|completed, delegate_to NULL, occurred_at, recorded_at, seq)`. `seq` per agreement gives the true order even with equal timestamps. Delegation: an event on the slot from the current holder to `delegate_to`; the holder at time t is the end of the chain of delegations at or before t.
- **Audit trail versus analytics.** The audit trail store keeps the full record the customer downloads (including identities and what the service records as evidence), hash-chained per agreement for tamper evidence, retained {{audit_retention_years}} years. Analytics receives an allowlisted projection: ids pseudonymised per customer, event types, roles, timestamps, page counts; never field values, document contents, signature images or email addresses. The projection is defined by a schema registry where every field is classified, and unknown fields are dropped, not passed.
- **Facts.** `fct_agreement` (accumulating snapshot: sent, completed/declined/cancelled/expired at, outcome, template and template version, participant and set counts, total wait); `fct_slot` (one row per slot: set order, role, became_actionable_at, acted_at, delegation hops, reminders received, outcome); `fct_agreement_event` (event grain, short retention). Stall = the set an open agreement is waiting on, measured from when it became actionable.
- **As-of reconstruction.** Read the frozen plan, then events with occurred_at ≤ t ordered by seq: completed sets advance the order, delegations move holders, declines and cancellations end it.

**Competing designs to accept.** Event sourcing with the agreement aggregate as a projection; a slot-state table updated by the service plus the event log as history (if as-of comes from events). Pseudonymising participants with a keyed hash per customer, or with a mapping table in the operational store.

**Bottlenecks and failure modes.** Wide rows with signer1..signerN columns; status overwritten so past state is lost; delegation stored by replacing the participant (original lost); analytics fed raw events (field values and emails leak); template joined at current version; reminders counted from the scheduler rather than from sent events; one analytics retention for audit purposes.

**Incident guidance.**
- *Field values in the event payload*: a contents leak. Stop the projection for that event type, purge the field from every analytics table, staging area and backup in scope, and record what was exposed for the customers affected (their notification follows the company's process). Guardrail: allowlisted projection from a classified schema; new fields blocked until classified; a scanner that fails the pipeline on unexpected payload keys.
- *Double reminders after failover*: deduplicate reminder events by (agreement, slot, scheduled window) and correct the metric; make the scheduler idempotent with a per-slot reminder key every {{reminder_days}} days; tell affected customers what happened.
- *Reports joined to current template*: pin `template_version` on the agreement at send; rebuild last quarter's stall report from the pinned version and publish it as a correction.

**Follow-up guidance.** (1) Plan plus events up to t in seq order; current set = lowest set with an incomplete slot. (2) Stall measured from when the set became actionable; delegations and reminders shown as counts on the slot. (3) Each agreement keeps the version it was sent with. (4) The audit store answers, with its hash chain and sequence numbers as proof of completeness and order; analytics never does. (5) Slot grain for the facts that need it (stalls, delegation), agreement grain for completion times; events at full grain only briefly.

**Rubric anchors.** 2: one agreements table with status and participant columns, analytics on raw events. 3: frozen plan with sets and slots, append-only events, delegation lineage, derived lifecycle, content-free projection, facts at stated grains. 4: also a classified allowlist, audit retention apart from analytics, as-of reconstruction, template versions pinned and incident handling with purge and guardrail.

**Strong signals.** Draws the audit/analytics boundary unprompted; keeps the original participant on delegation. **Red flags.** Field values or emails in analytics; deleting or overwriting events; treating the analytics warehouse as the customer's audit record.

## ADB-L3-03

**Reference architecture (one defensible design).**
- **Manifests.** `manifests (manifest_id, asset_hash, hash_alg, claim_generator_app, app_version, signer_cert_id, signed_at, identity_included bool, standard_version, created_by_feature)`. Immutable. An edit produces a new manifest that lists the previous asset as an ingredient.
- **Actions.** `manifest_actions (manifest_id, ordinal, action_kind crop|resize|color_adjust|generative_fill|generative_expand|…, generative bool, feature, model_family NULL)`. No prompts, no parameters that carry user text.
- **Ingredients.** `manifest_ingredients (manifest_id, ordinal, ingredient_asset_hash, ingredient_manifest_id NULL, relationship parentOf|componentOf|inputTo)`. A DAG keyed by hash; the same ingredient can appear many times.
- **Storage.** `manifest_locations (manifest_id, location embedded|cloud, stored_at, removed_at NULL)`.
- **Signers and trust.** `signer_certs (cert_id, issuer, valid_from, valid_to)`; `trust_lists (trust_list_version, effective_from)` and `trust_list_entries (trust_list_version, cert_id)`.
- **Verifications.** `verifications (verification_id, inspected_hash, checked_at, trust_list_version, outcome valid|signature_invalid|untrusted_signer|asset_modified|no_credentials|recovered_from_cloud, manifest_id NULL, source upload|url)`. Append-only, reproducible from (hash, manifest, trust list version). The inspected file is hashed and discarded.
- **Lineage.** Bounded recursive CTE over `manifest_ingredients` for ad hoc questions; for hot queries a closure table `manifest_ancestry (descendant_manifest_id, ancestor_asset_hash, depth)` maintained incrementally: a new manifest inherits its ingredients' ancestry plus the ingredients themselves (insert-only, because manifests never change). Fan-out from a hugely shared ingredient is served by the descendant index on ancestor_asset_hash with pagination, never by an unbounded walk.
- **Facts.** `fct_export_credential` (export grain: app, month, generative bool, ingredient count, identity flag); `fct_verification_week` (outcome × week × source). Report wording: "valid means the manifest is intact, bound to this file and signed by a recognised signer; it does not establish that the content is true".

**Competing designs to accept.** Storing the manifest as a JSON document plus extracted columns (actions and ingredients as rows or arrays) for analytics. A graph database for lineage, if the analytics tables still exist. Computing ancestry on read with depth limits instead of a closure table, if they show the cost bound.

**Bottlenecks and failure modes.** A mutable `is_valid` flag; recomputing past outcomes against today's trust list; "valid" described as authenticity; unbounded recursion from a popular ingredient; closure table rebuilt nightly instead of incrementally; prompts or uploaded files retained; identity stored in analytics; "no credentials" on re-shared copies conflated with exports that lacked credentials.

**Incident guidance.**
- *Trust list removal rewrote history*: past outcomes are observations with their trust list version and must not be recomputed. Restore the stored results, show the dashboard by trust list version (with a marker on the change date), and add a test that the results table is insert-only.
- *Site strips metadata*: a re-shared copy without an embedded manifest is not an export without credentials. Split the weekly report by source and by "recovered from cloud"; compute export coverage (about {{generative_share}} of exports with a generative step) from export facts, not from inspections.
- *Closure job ran nine hours*: the nightly full rebuild met an ingredient used {{max_ingredients}} times per composite and re-exported thousands of times. Switch to incremental insert-only ancestry per new manifest, deduplicate repeated ingredients per manifest, and serve fan-out queries from the descendant index with limits.

**Follow-up guidance.** (1) Recursive CTE from X's hash through `manifest_ingredients` to descendants, with a depth limit and a visited set; for huge fan-out, the closure table and pagination. (2) Yesterday's results stay; new checks get the new outcome; the weekly share is shown by trust list version. (3) An outcome "recovered from cloud", distinct from "found embedded" and "no credentials". (4) Edges per day ≈ exports × average ingredients; insert-only closure rows grow with depth, so cap depth or store ancestry only to a fixed depth plus a pointer. (5) Past manifests are immutable; analytics only has the flag, and future exports carry the flag set to false.

**Rubric anchors.** 2: one assets table with an authenticity flag. 3: immutable manifests, actions and ingredients as rows, verification as observations with trust list version, no prompts. 4: also a lineage strategy with cost bounds, precise outcome categories including recovery, wording that rules out an authenticity claim, and the incidents handled.

**Strong signals.** Separates "what the manifest says" from "what a check found"; bounds the graph walk unprompted. **Red flags.** "Verified = authentic"; storing prompts or inspected files; updating outcomes in place.

## ADB-L3-04

**Reference architecture (one defensible design).**
- **Libraries.** `libraries (library_id, owner_id, org_id NULL, created_at)`; `library_members (library_id, member_id, role viewer|editor, valid_from, valid_to NULL)`.
- **Elements.** `elements (element_id, library_id, kind color|char_style|para_style|graphic|logo, created_at, deleted_at NULL, copied_from_element_id NULL)`; `element_versions (element_id, version_no, published_at, published_by, change_kind edit|rename|revert|restore|delete, value_ref)`. `version_no` is assigned by the library service under a per-element lock or compare-and-set, never by the client.
- **Placements.** `placements (document_id, document_version_id, placement_id, element_id, applied_version_no, mode linked|embedded, unlinked_at NULL)`, recorded from each saved document version's metadata. The latest document version gives the current state.
- **Reverse index.** `element_links (element_id, document_id, latest_document_version_id, applied_version_no, mode, observed_at)` derived from placements, upserted by document version order (a late offline version older than the stored one never overwrites it).
- **Propagation events.** `propagation_events (element_id, version_no, document_id, event published|notified|applied, occurred_at)`. Apply only if version_no > applied_version_no: monotonic, so out-of-order updates can't go backwards.
- **Staleness.** A linked placement is out of date when applied_version_no < the element's latest version. Categories: *pending* (document not opened since publish), *blocked* (owner has no access to the library as of now), *kept* (unlinked on purpose, excluded from out of date), *failed* (opened but not applied: a defect).
- **Facts.** `fct_element_reach (element, day: linked documents, out-of-date by category)`; `fct_propagation (element version × document: published_at, applied_at, open_at_publish bool)`. Latency for open documents uses published → applied with the {{propagation_minutes}}-minute target; closed documents are reported as "time to first open after publish", separately, so both populations are visible.
- **Access.** Brand teams see document owners only for documents shared with them; other documents as counts.

**Competing designs to accept.** An event-sourced placement log with the reverse index as a projection. Storing placements only for the latest document version plus a change log (if history can be rebuilt). Push propagation versus pull on open, if the measurement covers both.

**Bottlenecks and failure modes.** An array of documents on the element row (hot row, unbounded growth); last-write-wins on updates (reverts lost, versions go backwards); client-assigned version numbers; reverse index ignoring late offline saves; latency measured only on open documents; unlinked or blocked placements counted as out of date forever; deleting placements when an element is deleted.

**Incident guidance.**
- *Edit and revert applied in different orders*: documents compared timestamps or applied in arrival order. Enforce applying only higher `version_no`; re-publish the latest version to every linked document (the revert is version n+2, so it wins); add an invariant check that applied_version_no never decreases per placement.
- *Library unshared from an agency*: those placements are blocked, not pending. Classify them as blocked from the membership interval, exclude them from the actionable count (still show them), and give the brand team a list of affected documents shared with them; alert when a category grows without any open events.
- *Latency only on open documents*: the percentile hid the closed-document population. Report two measures (open: publish → applied; closed: publish → first open → applied) and a share of documents updated within the target, and annotate the change.

**Follow-up guidance.** (1) From the reverse index for the element: linked placements with applied < latest, split by category; one indexed read per element, proportional to the linked documents. (2) Open document: applies n+1 then n+2 (or only n+2 if both arrive together); closed: applies n+2 on open. (3) published_at to applied_at on the document's device; exclude documents not open at publish, report them separately. (4) Placements keep the last applied version and mode; the element shows as deleted; the brand team sees "linked to a deleted element" counts. (5) When the document version syncs; until then the index undercounts, and the answer should state its freshness.

**Rubric anchors.** 2: a document list on the element, overwritten values. 3: element versions, placements at document-version grain, reverse index, monotonic apply, a stated out-of-date definition. 4: also pending/blocked/kept categories, membership over time, late offline saves, two latency populations, and the incidents handled.

**Strong signals.** Makes version order the rule for applying updates; separates "can't update" from "hasn't opened". **Red flags.** Timestamp ordering of updates; arrays of document ids; latency from open documents only, unstated.

## ADB-L3-05

**Reference solution** (PostgreSQL; `{{as_of}}` is the instance's as-of time)

```sql reference
WITH RECURSIVE ev AS (                         -- the books as of the as-of time
  SELECT agreement_id, participant_id, action, delegate_to, occurred_at
  FROM agreement_events
  WHERE occurred_at <= TIMESTAMPTZ '{{as_of}}'
), open_agreements AS (
  SELECT a.agreement_id, a.sent_at
  FROM agreements a
  WHERE a.signing_order = 'sequential'
    AND a.sent_at <= TIMESTAMPTZ '{{as_of}}'
    AND (a.cancelled_at IS NULL OR a.cancelled_at > TIMESTAMPTZ '{{as_of}}')
    AND (a.expires_at IS NULL OR a.expires_at > TIMESTAMPTZ '{{as_of}}')
    AND NOT EXISTS (SELECT 1 FROM ev WHERE ev.agreement_id = a.agreement_id AND ev.action = 'declined')
), chain AS (                                  -- every holder each signer slot has had, in order
  SELECT p.agreement_id, p.step, p.participant_id AS assigned_to, p.participant_id AS holder, 0 AS hops
  FROM agreement_participants p
  JOIN open_agreements o ON o.agreement_id = p.agreement_id
  WHERE p.role = 'signer'
  UNION ALL
  SELECT c.agreement_id, c.step, c.assigned_to, e.delegate_to, c.hops + 1
  FROM chain c
  JOIN ev e ON e.agreement_id = c.agreement_id AND e.participant_id = c.holder AND e.action = 'delegated'
), slots AS (
  SELECT c.agreement_id, c.step, c.assigned_to,
         (ARRAY_AGG(c.holder ORDER BY c.hops DESC))[1] AS pending_with,
         MIN(s.occurred_at) AS signed_at
  FROM chain c
  LEFT JOIN ev s ON s.agreement_id = c.agreement_id AND s.participant_id = c.holder AND s.action = 'signed'
  GROUP BY c.agreement_id, c.step, c.assigned_to
), current_step AS (
  SELECT agreement_id, MIN(step) AS step
  FROM slots
  WHERE signed_at IS NULL
  GROUP BY agreement_id
), reached AS (
  SELECT cs.agreement_id, cs.step,
         COALESCE((SELECT MAX(s.signed_at) FROM slots s
                   WHERE s.agreement_id = cs.agreement_id AND s.step < cs.step), o.sent_at) AS reached_at
  FROM current_step cs
  JOIN open_agreements o ON o.agreement_id = cs.agreement_id
)
SELECT s.agreement_id, s.step AS current_step, s.assigned_to, s.pending_with,
       ROUND(EXTRACT(EPOCH FROM TIMESTAMPTZ '{{as_of}}' - r.reached_at) / 3600, 2) AS hours_waiting
FROM slots s
JOIN reached r ON r.agreement_id = s.agreement_id AND r.step = s.step
WHERE s.signed_at IS NULL
ORDER BY hours_waiting DESC, s.agreement_id, s.assigned_to;
```

**Explanation.** Everything is rebuilt from events up to the as-of time; the `status` column is the state at extraction and would drop agreements that were waiting then but finished later. Open agreements are sequential, sent by the as-of time, not cancelled or declined by then (inclusive), and not expired (exclusive: open only while as_of < expires_at). The recursive CTE starts at each signer slot with the named participant as holder and follows `delegated` events from the current holder, only those at or before the as-of time; the deepest hop is `pending_with`, and a `signed` event by any holder in the chain completes the slot (in this data only the final holder signs). The current step is the lowest step with an unsigned slot; the agreement reached it at the latest signature among lower-step slots, or at `sent_at` when no lower step names a signer (a cc-only step or a gap in the numbering is passed over automatically because only signer slots exist in `slots`). Delegation never moves the start of the wait. Agreements where every slot is signed have no current step and drop out.

**Complexity.** One filtered pass over events up to the as-of time, a recursion whose depth is the longest delegation chain (each level a hash join of slots against delegation events), and hash aggregates over slots. The correlated MAX is per open agreement and touches only its slots. In production: partition events by customer and month, keep a per-slot state table (holder, signed_at) maintained from the event stream, and run this as-of logic only for history.

**Dialect notes.** Snowflake (also `CONNECT BY`), BigQuery (with an iteration limit) and MySQL 8 support `WITH RECURSIVE`; recursive CTEs arrived in Databricks SQL only in recent runtimes and older Spark SQL lacks them, where a bounded self-join per hop (chains here are at most two hops) is the fallback (check current docs). `(ARRAY_AGG(... ORDER BY ...))[1]` is PostgreSQL; use `MAX_BY(holder, hops)` (Snowflake, Databricks), `ARRAY_AGG(holder ORDER BY hops DESC LIMIT 1)[OFFSET(0)]` (BigQuery), or a `ROW_NUMBER()` subquery (MySQL). Hours: `DATEDIFF('second', a, b) / 3600` (Snowflake), `TIMESTAMP_DIFF(b, a, SECOND) / 3600` (BigQuery), `TIMESTAMPDIFF(SECOND, a, b) / 3600` (MySQL); `ROUND(x, 2)` exists everywhere but float rounding can differ at the last digit. None of these variants is executed here.

**Edge cases built into the data.** A step signed exactly at the as-of time (the next step is current with 0.00 hours); an agreement cancelled exactly at the as-of time (excluded); a delegation before the as-of time whose delegate signs after it (pending with the delegate, and the extract says completed); a delegation after the as-of time (pending with the named signer); a parallel agreement still in progress (excluded); a draft and an agreement sent after the as-of time (excluded); completed and declined agreements before the as-of time (excluded). Hard adds an agreement expiring exactly at the as-of time (excluded), cc rows next to a signer and cc-only steps (including one at step 1 and one right before the current step), a two-hop delegation chain before the as-of time, a chain whose second hop is after it, and a decline after the as-of time (still waiting). Very Hard adds steps naming two signers (one signed, the other still pending; both pending), and step numbers with gaps.

**Common mistakes.** Filtering on `status`; exclusive boundaries; ignoring delegations (pending_with wrong, and the delegate's signature not credited); following delegations after the as-of time; restarting the wait at a delegation; measuring every wait from `sent_at`; including parallel agreements; ignoring declines; (Hard+) treating cc rows as signers, ignoring expiry or treating `expires_at = as_of` as open, following only one hop, finding the previous step as `current_step - 1`; (Very Hard) treating a step as complete when one of its signers has signed. Each has a diagnostic.

**Follow-up guidance.** (1) A cc-only step or a gap: step − 1 has no signer, so a `step - 1` join falls back to `sent_at` and overstates the wait; the data contains such cases from Hard upward. (2) Grain: snapshot date × agreement × slot; rebuild the days on or after the earliest late event's occurred_at (events carry recorded_at to find them). (3) Maintain slot state (current holder, signed_at, became_actionable_at) incrementally from the event stream; a delegation updates one row; history comes from the events. (4) A step becomes a group; waiting rows are all incomplete slots in the lowest incomplete group, and the reached time is the completion of the previous group; the query shape stays the same with `set_id` in place of `step`.

**Rubric anchors.** 2: right shape but the status column used, or delegations ignored. 3: matches the expected result. 4: also explains why step − 1 fails, how to snapshot and rebuild after late events, and how slot state would be maintained incrementally.

**Strong signals.** Asks what the status column reflects before using it; reaches for a recursive CTE for the chain; separates "who holds it" from "how long it has waited". **Red flags.** `WHERE status = 'in_progress'`; using `MAX(step) + 1` or `step - 1` arithmetic for progress; reading document contents or participant emails for a report that needs neither.
