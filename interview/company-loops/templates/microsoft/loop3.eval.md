# Microsoft · Loop 3 — evaluator notes (hidden from candidates)

## MSF-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Series.** `meeting_series (series_id, organiser_id, tenant_id, title, tz_name, rrule, dtstart_local, until_local NULL, created_at, superseded_by_series_id NULL, split_from_series_id NULL, split_at_original_start NULL)`. The rule and its start are stored in the organiser's wall-clock time with an IANA zone name, never as a UTC offset. Edits to the series as a whole are versions: `meeting_series_version (series_id, version, rrule, dtstart_local, tz_name, valid_from, valid_to)`, so "what the series said last month" is a lookup.
- **Occurrence identity.** `occurrence_key = (series_id, original_start_local)` — the iCalendar RECURRENCE-ID idea. It is derived from the rule, so it exists before the occurrence is materialised and it never changes when the occurrence moves. A single meeting is a series of one.
- **Exceptions.** `series_exception (series_id, original_start_local, kind modified|cancelled, new_start_utc NULL, new_end_utc NULL, attendee_delta, recorded_at, version)` — append-only; the latest version per key wins.
- **Materialised occurrences.** `occurrence (occurrence_id = hash(series_id, original_start_local), series_id, original_start_local, scheduled_start_utc, scheduled_end_utc, status scheduled|moved|cancelled, materialised_at)`. Expanded per occurrence from the rule using the zone database at expansion time, for a rolling {{horizon_months}}-month horizon, plus the past. Exceptions are applied as they arrive (an upsert of one occurrence), not only on a nightly rebuild. A time-zone database update re-expands future occurrences of affected zones.
- **"This and following".** Ends the old series with `until_local` just before the split point and creates a new series with `split_from_series_id` and `split_at_original_start`. Past occurrences keep their keys; future ones of the old series are marked superseded (or simply no longer generated). A `series_lineage` view links the halves for yearly reports.
- **Attendance.** `participant_session (session_id, join_link_id, participant_id or guest marker, joined_at, left_at, client, received_at)`, deduplicated on session_id (at least once). Attribution, written as its own table `session_occurrence (session_id, occurrence_id, rule_version, matched_how)`: the occurrence of that join link whose `[scheduled_start − grace_before, scheduled_end + grace_after)` contains `joined_at`; if two match, the one whose scheduled start is nearest; if none, `unmatched` (an ad-hoc use of the link), never silently dropped. A session that runs across two occurrences' windows stays with the occurrence it joined (or is split by time — either, if stated).
- **Recordings and transcripts.** Attached by the meeting service to the online meeting instance at recording start, then mapped to the occurrence by the same rule; store the mapping and its method.
- **Facts.** `fct_occurrence` (one row per occurrence: series, organiser, status, scheduled minutes, invitees, attendees, minutes attended, no-show flag for one-to-ones); `fct_participant_occurrence` (one row per person per occurrence: attended minutes, joined late, left early); `fct_person_day_meeting_hours`. Cancelled occurrences have no expected attendees and no no-show.

**Competing designs to accept.** Storing only the rule and exceptions and expanding at query time (fine for a calendar UI; expensive for warehouse reporting at {{daily_occurrences}} a day, so a materialised past is still needed). Event sourcing of calendar changes with occurrences as a projection. Keying occurrences by a service-issued instance id, if it is stable under moves and recoverable for future instances. Splitting a long session across occurrences by time instead of assigning it to one.

**Bottlenecks and failure modes.** Occurrence keys built from the actual start (moves re-key); expansion with fixed UTC offsets (wrong for half the year); nightly-only exception application; "this and following" implemented as an edit of the original series (re-keys the past); infinite series fully materialised; attendance attributed by date only (two occurrences on one day); guests and duplicate sessions inflating attendance; tz database updates ignored.

**Incident guidance.**
- *DST week: occurrences an hour off, joins unmatched, no-shows doubled*: the series had been expanded once with a fixed UTC offset. Contain by labelling the week's no-show metric and re-expanding future occurrences from the stored zone name; correct the past by re-expanding affected occurrences and re-running attribution for the week (the unmatched sessions are kept, so this is possible). Guard: store `tz_name`, never an offset; a test that expands a series across a DST change in {{dst_regions}}; alert when the unmatched-session share jumps.
- *"This and following" re-keyed two years of occurrences*: the edit changed the original series' rule in place and occurrence ids were derived from the new rule. Contain by restoring the previous series version's occurrences from history; fix by implementing the split (old series ended, new series linked) so past keys never change; re-point attendance and recordings by the old keys; guard with a check that the number of past occurrences of a series never changes after an edit.
- *Late cancellations shown as 100% no-show*: exceptions were applied only at the nightly rebuild of the next {{horizon_months}} months. Apply each exception as it arrives (upsert one occurrence), recompute affected facts, exclude cancelled occurrences from no-show denominators, and add a freshness check comparing exception events with occurrence status.

**Follow-up guidance.** (1) Stored: rule in local time with zone; expanded: each occurrence converted with that zone's rules, so the UTC start moves by an hour and attendees elsewhere see the meeting shift during the weeks when the two regions' clocks change on different dates. (2) One modified exception (Tuesday → Wednesday) on the old series; old series ended before the split; new series of Thursdays starting the week after; the moved occurrence keeps its key. (3) A stated rule: nearest scheduled start, or the occurrence in progress at join time; record `matched_how`. (4) Rolling horizon extended daily; beyond it, "meeting hours next quarter" is computed from rules (expand on demand) and labelled as a projection. (5) Occurrences partitioned by scheduled date, clustered by series; a late exception touches one occurrence and the facts for its date.

**Rubric anchors.** 2: one meetings table with a start time; moves create new meetings; UTC offsets. 3: series, exceptions and occurrences separated; stable key from original start; zone name stored; an attribution rule for shared links. 4: also the split with linked lineage, incremental exception application, a horizon strategy, at-least-once dedup, unmatched sessions kept, and the three incidents traced to these choices.

**Strong signals.** Brings up RECURRENCE-ID or original start unprompted; asks how joins are attributed when the link is shared. **Red flags.** "Store everything in UTC" for a recurring rule; materialising forever; deleting a cancelled occurrence.

## MSF-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity.** `device (device_key surrogate, tenant_id, created_at)`, `device_id_map (device_id, device_key, valid_from, valid_to)` and `device_hardware (device_key, hardware_id, valid_from, valid_to)`. A re-registration with the same hardware id in the same tenant maps the new device id to the existing device_key; a move to another tenant (resale) creates a new device_key, so history never crosses tenants. Renames are attributes with history, not identity.
- **Rings.** `ring (ring_id, tenant_id, name)`, `ring_settings_version (ring_id, quality_deferral_days, feature_deferral_days, paused, valid_from, valid_to, changed_by, reason)`, and `device_ring_assignment (device_key, ring_id, valid_from, valid_to)` — both versioned (type 2 intervals).
- **Build catalogue.** `os_build (build_id, version, build_number, revision, update_type quality|feature, released_at, supersedes_build_id)` with a total order (version, build, revision) so "on or after the latest quality build" is a comparison. Quality updates are cumulative, so a device is current if its build ≥ the latest released revision for its version.
- **Offers and attempts.** `update_offer (offer_id, device_key, build_id, ring_id, ring_settings_version, offered_at)` — the offer records the settings version it was made under. `install_attempt (attempt_id, offer_id, device_key, build_id, started_at)` and `install_state_event (event_id, attempt_id, state, error_code NULL, device_time, device_seq, received_at)` with a legal transition graph (offered → downloading → downloaded → installing → pending_restart → installed | failed; installed → removed). Events deduplicated by event_id; ordered by device_seq when present, else by the transition graph, never by device_time alone.
- **Observed state.** `heartbeat (device_key, build_id, device_time, received_at)` (sampled daily at full grain for weeks, then compacted).
- **Derived build history.** `device_build_interval (device_key, build_id, valid_from, valid_to, source event|heartbeat|both, confidence)`: built from installed/removed events, confirmed or corrected by heartbeats (a heartbeat from a later received time showing a different build closes the interval). Rollbacks produce a new interval on the previous build — the build can go down.
- **Facts.** `fct_attempt` (one row per attempt: offer → installed duration, final state, error code, rollback flag); `fct_device_day` (daily snapshot: ring, build, online flag, is_current) for ring coverage; failure rate by build and error code over attempts.
- **Definition.** "Share of ring on latest build N days after release" = devices in the ring (as of that day) seen online in the last 28 days whose build interval on that day is ≥ the latest released build, ÷ those devices; offline devices reported separately.

**Competing designs to accept.** A current-state table plus an append-only change log (if history is rebuilt from the log). Event sourcing per device. A daily device snapshot as the main history (coarser, but acceptable if intra-day rollbacks are captured in attempts). Hardware-id-first identity, if resale across tenants is handled.

**Bottlenecks and failure modes.** Current-build columns overwritten (no as-of); trusting install events without considering removals; trusting device clocks for order or for partitioning; reimage creating a new device; ring settings stored only as current; offline devices counted as failures; heartbeat storage at {{devices}} devices a day.

**Incident guidance.**
- *Rolled-back devices still counted on the new build*: "installed" was terminal in the model. Contain by deriving builds from intervals that close on a `removed` event or a contradicting heartbeat; recompute the dashboard for the month; guard with a reconciliation between the dashboard's build share and the heartbeat build share per build, alerting when they diverge by more than about {{rollback_share}}.
- *Deferral shortened, earlier offers flagged late*: ring settings were not versioned. Backfill settings history from the admin audit log, store the settings version on every offer, and judge timeliness against that version; add a test that changing settings does not change past compliance.
- *Mass reimage made the fleet grow and histories restart*: identity was the device id. Map the new device ids to existing device keys through hardware id within the same tenant, merge histories, recompute ring coverage, and add a monitor on new-device registrations per tenant per day.

**Follow-up guidance.** (1) The transition graph; a later state wins only if it is reachable; duplicates are no-ops; out-of-order arrivals are placed by device_seq. (2) Intervals: old build → new build (installed) → old build (removed) → new build (reinstalled); the week counts the device as current only on days its interval is the latest build. (3) Same tenant and hardware id: history joined; new tenant: not joined, and the old tenant's history is not visible to the new owner. (4) The offer carries the settings version; early relative to the old deferral but on time under the new one, with the change's author and reason. (5) Events and attempts kept at full grain for a release cycle or two; heartbeats compacted into intervals; daily device snapshots for trend reports.

**Rubric anchors.** 2: a devices table with a current build and status. 3: attempts with state events, ring assignment history, a derived build history, a stated "latest" definition. 4: also identity across reimage and resale, versioned ring settings tied to offers, rollback-aware intervals reconciled with heartbeats, clock-skew handling, and storage tiers.

**Strong signals.** Asks how a rollback is reported and which clock orders events. **Red flags.** Ordering by device timestamp only; counting offline devices as failed; one row per device updated in place.

## MSF-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Tree with validity.** `mg_node (mg_id, tenant_id, name)`, `mg_parent (mg_id, parent_mg_id, valid_from, valid_to)` (adjacency, versioned), and a derived `mg_closure (ancestor_id, descendant_id, depth, valid_from, valid_to)` rebuilt for the affected subtree on each change (the tree is small: at most {{mg_depth}} levels). Subscriptions are leaves: `subscription_placement (subscription_id, mg_id, valid_from, valid_to)`.
- **Lower levels.** `resource_group (rg_key, subscription_id, name, created_at, deleted_at)`. `resource (resource_key surrogate, type, created_at, deleted_at)` and `resource_id_history (resource_id_path, resource_key, rg_key, subscription_id, valid_from, valid_to)`: a move closes one id path and opens another for the same key. Resolution of move pairs comes from the move activity event (source and target ids); the daily snapshot confirms.
- **Tags as rows.** `tag_assignment (scope_type sub|rg|resource, scope_key, tag_name_normalised, tag_name_original, tag_value, valid_from, valid_to, set_by)`. A rewrite with the same value does not open a new row (change compaction). Names compared case-insensitively and values case-sensitively in this exercise.
- **Effective tags.** A derived `effective_tag_day (resource_key, day, tag_name, tag_value, source resource|rg|subscription)` using the stated precedence — or computed at query time for the questions that need it. The rule is documented, because the platform does not inherit tags itself in this exercise.
- **Rollups.** Cost facts keyed by `resource_key` and usage date (the resource id path is kept for audit). *Usage-date allocation*: join cost to `resource_id_history` → subscription → `subscription_placement` → `mg_closure`, all valid on the usage date. *Current-structure view*: the same join with today's intervals. Invoiced months are frozen in a `chargeback_statement` table; a later change shows as a restatement line, never as a silent rewrite.
- **Policy scope as of D.** Descendants of the assignment's scope in `mg_closure` valid on D → subscriptions → resource groups → resources alive on D.
- **Corrections.** When the snapshot shows a change the events missed, write the interval with `valid_from` = the snapshot time (or the best known time from the activity log), flagged `source=snapshot`, and publish a correction event so downstream rollups for the affected dates recompute.

**Competing designs to accept.** Materialised path strings with validity instead of a closure table. A daily snapshot of the whole hierarchy (simple, and at a few thousand to a million subscriptions per day it is affordable; tags per resource per day are the expensive part). Tags as a JSON map with type 2 rows per resource, if names are normalised and no-op rewrites are compacted.

**Bottlenecks and failure modes.** Recursive walks per row per day; joining cost to today's hierarchy for past months; resource id as the key across moves; tag columns per name; case-variant tag names split; tag churn from automation; missed events never reconciled.

**Incident guidance.**
- *Mid-month subscription move re-allocated a whole invoiced month*: the report joined to the current tree. Contain by restoring the frozen statement for the invoiced month; switch the chargeback to usage-date allocation through intervals; show the move as a restatement in the next month if finance wants it; guard with a check that a closed month's totals per department never change on a rebuild.
- *Tag remediation rewrote every tag; history tripled; churn spiked*: no-op rewrites were recorded as changes. Compact consecutive rows with the same normalised name and value; recompute "tag changes per day" from real value changes, which should return to about {{tag_change_share}}; guard with change compaction at write time and an alert on churn far above its baseline.
- *Moved resources split into deleted plus new*: identity was the id path. Pair the old and new ids from the move events, map both to one resource_key, re-attribute cost history, and add a test that every move event yields exactly one key with two id intervals.

**Follow-up guidance.** (1) Closure rows for the moved group's subtree close on the 15th and reopen under the new ancestors; usage-date allocation splits the month at the 15th, current-structure gives the whole month to the new department. (2) One resource key, two id intervals, cost split by usage date between the subscriptions (and departments) it was in. (3) Effective tag on D = the resource's own interval valid on D, else the resource group's, else the subscription's; untagged before the 20th under usage-date rules, re-labelled only in an explicitly "as today" report. (4) Compaction of no-op rewrites and storing intervals, not daily rows. (5) Interval written from the snapshot with its source, a correction event, and recomputation of affected dates.

**Rubric anchors.** 2: parent ids with recursive queries against the current tree; tags as columns; resource id as the key. 3: versioned tree (closure or path) with as-of rollups; tags as rows with history; a stable resource key. 4: also both allocation rules with frozen invoiced months, a precedence rule with case handling, change compaction, snapshot reconciliation, and policy scope as of a date.

**Strong signals.** Separates "as of usage date" from "as of today" before being asked; proposes a closure table with validity. **Red flags.** Rebuilding history from the current tree; treating a move as delete plus create in cost reports.

## MSF-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Catalogue.** `title (title_id)`, `product (product_id, title_id, kind base|edition|add_on, requires_product_id NULL, platforms)`. Edition upgrades and add-ons depend on a base right.
- **Immutable sources.** `licence_grant (grant_id, player_id, product_id, source purchase|redemption|bundle|member_discount, order_id, granted_at, platform_scope, region, subscription_id NULL)`; `licence_revocation (grant_id, revoked_at, reason refund|chargeback|fraud)`; `subscription_period (player_id, subscription_id, tier, valid_from, valid_to, reason paid|grace|lapsed|resumed)`; `catalogue_window (title_id, tier, platform, region, joins_at, leaves_at, announced_at)` — windows are closed by setting `leaves_at`, never deleted; `sharing_membership (group_id, owner_id, member_id, valid_from, valid_to)`.
- **Derived access intervals.** `access_interval (player_id, product_id, right owned|subscription|shared, source_id, platform, region, valid_from, valid_to)`: owned = grant to revocation; subscription = intersection of the player's paid periods with the title's catalogue windows for their tier, platform and region; shared = owner's owned interval ∩ membership interval, ending when the owner's licence ends (refund) or the membership ends. Add-ons are playable only where a base right overlaps. Rebuilt per player from sources (deterministic), so any past date can be answered and corrections are recomputations.
- **Precedence.** One stated rule, e.g. owned > shared > subscription (or owned > subscription > shared, if the publisher model wants it). Session attribution writes `session_right (session_id, player_id, product_id, right, source_id, rule_version)` — exactly one row per session, deduplicated by session id; a session is attributed using the rights valid at its start (and, if it runs past a leave time, by the platform's stated rule).
- **Reports.** Hours by title and right per month from `session_right`; publisher statements for closed months frozen, with later corrections (refund-related) as restatement lines in the next period.

**Competing designs to accept.** Answering "could they play on D" directly from sources at query time (correct and fine for support, too slow for monthly play attribution at {{players}} players). An entitlement event log with a state projection per player. Precedence by "the right that costs the platform least" if stated and stable.

**Bottlenecks and failure modes.** Current-only entitlement tables; deleting catalogue rows; boolean "owns" flags; double attribution when two rights overlap; refunds not propagated to shared rights; time zones on leave dates; add-ons playable without a base; interval explosion (players × catalogue titles) — subscription intervals can be stored per player-period and joined with catalogue windows at query time instead of being exploded per title.

**Incident guidance.**
- *Deleted catalogue rows broke "could they play last month" and changed a closed month*: deletion destroyed a source. Restore windows from backups or the catalogue's change history with `leaves_at` set; make windows append-only; freeze closed publisher months so rebuilds cannot change them; add a test that a rebuild of a closed month reproduces its frozen totals.
- *Member-discount buyers double counted in their last {{leave_notice_days}} days*: sessions joined to every matching right. Enforce one row per session with the precedence rule; recompute the affected months and publish restatements; add a uniqueness constraint on session id in the attribution table and a check that attributed hours equal played hours.
- *Refund left a family's shared intervals open*: shared intervals were not derived from the owner's licence end. Rebuild shared intervals as intersections, close them at the refund time for all {{family_size}} members, re-attribute play after the refund (not before), and add a check that no shared interval outlives its source grant.

**Follow-up guidance.** (1) Subscription interval until purchase; owned interval from the purchase; with owned > subscription, sessions after the purchase count as owned; the subscription interval ends at the leave date regardless. (2) Owner's licence and every derived shared interval close at the refund time; hours before the refund keep their attribution; the closed month is restated only if the platform's rule requires it. (3) Leave time defined per region (local midnight or a UTC instant, stated); a session that started before is allowed to finish or is cut — stated, and attributed by its start. (4) Tier history as periods; the support view lists, per day, the tier and the catalogue windows that applied. (5) Owned and shared intervals materialised; subscription access computed as period × window at query time; partitions by player hash; refresh per player on source change.

**Rubric anchors.** 2: an entitlements table of (player, title) with a flag. 3: rights as intervals derived from immutable sources, subscription access as an intersection, a precedence rule. 4: also add-on dependencies, refunds propagating to shared rights from the right time, one right per session with dedup, regional leave times, frozen publisher months, and an interval-size strategy.

**Strong signals.** Asks "which right" before "could they"; keeps catalogue windows forever. **Red flags.** Deleting rows when titles leave; attributing a session to several rights; treating a refund as if the purchase never happened (rewriting past play).

## MSF-L3-05

**Reference solution** (PostgreSQL; `{{start_day}}` and `{{end_day}}` are the instance's first and last reported days)

```sql reference
WITH days AS (
  SELECT g::date AS day, g + INTERVAL '1 day' AS day_end
  FROM generate_series(TIMESTAMPTZ '{{start_day}} 00:00:00+00',
                       TIMESTAMPTZ '{{end_day}} 00:00:00+00',
                       INTERVAL '1 day') AS g
), ev AS (                                       -- each evaluation with the lifetime it falls in
  SELECT e.evaluation_id, e.policy_id, e.resource_id, e.evaluated_at, e.compliance_state,
         r.created_at, r.deleted_at
  FROM policy_evaluations e
  JOIN resources r
    ON r.resource_id = e.resource_id
   AND e.evaluated_at >= r.created_at
   AND (r.deleted_at IS NULL OR e.evaluated_at < r.deleted_at)
), latest AS (                                   -- latest evaluation per day, policy and lifetime
  SELECT DISTINCT ON (d.day, ev.policy_id, ev.resource_id, ev.created_at)
         d.day, d.day_end, ev.policy_id, ev.compliance_state, ev.deleted_at
  FROM days d
  JOIN ev ON ev.evaluated_at < d.day_end
  ORDER BY d.day, ev.policy_id, ev.resource_id, ev.created_at,
           ev.evaluated_at DESC, ev.evaluation_id DESC
)
SELECT day, policy_id,
       COUNT(*) AS assessed_resources,
       COUNT(*) FILTER (WHERE compliance_state = 'compliant') AS compliant,
       COUNT(*) FILTER (WHERE compliance_state = 'non_compliant') AS non_compliant,
       ROUND(100.0 * COUNT(*) FILTER (WHERE compliance_state = 'compliant') / COUNT(*), 1) AS compliance_pct
FROM latest
WHERE compliance_state <> 'exempt'
  AND (deleted_at IS NULL OR deleted_at >= day_end)
GROUP BY day, policy_id
ORDER BY day, policy_id;
```

**Explanation.** The calendar comes from `generate_series`, so days with no new evaluations still get rows. Each day is joined to every evaluation made before its end (half-open: `evaluated_at < day_end`), and `DISTINCT ON` keeps the latest per day, policy and resource lifetime — that is the carry-forward. Ties on `evaluated_at` go to the larger `evaluation_id`; ids are otherwise not in time order, so they never decide "latest" alone. The exempt filter and the existence check come after the latest row is chosen: an exempt latest state hides an earlier non-compliant one, and a resource deleted before the day's end leaves the report although its last evaluation is still the latest. Joining evaluations to `resources` on the lifetime that contains them makes the same query correct at every level: at Medium and Hard each resource has one lifetime; at Very Hard a re-created resource's evaluations from the earlier lifetime belong to the deleted row and never reach the new one.

**Complexity.** Days × evaluations before each day's end, then a sort for `DISTINCT ON`: O(D · E log E) for D days. Fine for a report window; at production volume the daily trend comes from a state-change interval table (resource, policy, state, valid_from, valid_to) joined to the calendar, or from a daily snapshot built incrementally from yesterday's snapshot plus today's evaluations.

**Dialect notes.** `DISTINCT ON` is PostgreSQL; Snowflake, BigQuery and Databricks SQL use `QUALIFY ROW_NUMBER() OVER (PARTITION BY day, policy_id, resource_id, created_at ORDER BY evaluated_at DESC, evaluation_id DESC) = 1` (MySQL 8 and Spark without QUALIFY: a subquery on the row number). Calendars: `GENERATE_DATE_ARRAY` + `UNNEST` (BigQuery), `GENERATOR` / `ARRAY_GENERATE_RANGE` or a date dimension (Snowflake), `sequence()` + `explode` (Spark). `COUNT(*) FILTER (WHERE …)` becomes `COUNT_IF` (Snowflake, BigQuery `COUNTIF`, Spark `count_if`) or `SUM(CASE …)`. Rounding of exact halves can differ for floating-point types: keep the division in NUMERIC/DECIMAL. None of these variants is executed here.

**Edge cases built into the data.** Resources evaluated days before the first reported day (carried in); an evaluation exactly at midnight that flips a state (belongs to the new day); a resource deleted exactly at midnight (counted the day before, gone from that day); a resource deleted in the middle of a day (gone from that day); resources created mid-range and evaluated hours or a day later; a policy that applies to only some resources; evaluation ids in random order; evaluations after the last day. Hard adds `exempt` as a latest state hiding a non-compliant one and two evaluations of one resource and policy at the same instant with different states. Very Hard adds a resource deleted and re-created with the same id, with a day on which the new lifetime exists but has not been evaluated.

**Common mistakes.** Counting only each day's evaluations (no carry-forward); counting every evaluation instead of the latest; ignoring `deleted_at`; `deleted_at > day_end` (drops a resource deleted exactly at midnight a day early); `evaluated_at <= day_end` (counts a midnight evaluation in the previous day); latest per resource across policies; latest by `MAX(evaluation_id)`; (Hard+) filtering exempt rows before choosing the latest; tie broken the wrong way; (Very Hard) joining evaluations on `resource_id` alone, which carries the earlier lifetime's state into the re-created resource (or duplicates rows). Each has a diagnostic. A window function over the whole table without the day in the partition returns today's state for every day.

**Follow-up guidance.** (1) A state-change interval table built by comparing each evaluation with the previous one per resource and policy (LAG), closed by deletion; the daily trend is an interval-to-calendar join; correctness checked by recomputing a sample of days from raw evaluations. (2) `LAG(compliance_state)` per resource and policy ordered by `evaluated_at, evaluation_id`; count rows where it differs (first evaluation counted as a change or not — stated). (3) Exempt resources, resources never evaluated and deleted ones are outside the denominator; a good dashboard shows the not-yet-evaluated count beside the percentage. (4) Add `state_age = day_end − evaluated_at` and flag beyond the scan interval; whether stale states count is a policy choice, but they should be visible.

**Rubric anchors.** 2: latest evaluation per resource overall, or only the day's evaluations. 3: matches the expected result. 4: also explains the interval table or incremental snapshot, real state changes with LAG, and what the denominator leaves out.

**Strong signals.** Builds the calendar first; asks whether deleted resources and exempt states count before writing. **Red flags.** `MAX(evaluation_id)` as "latest"; grouping by `evaluated_at::date` and calling it a daily trend; ignoring deletions.
