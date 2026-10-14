# LinkedIn · Loop 3 — evaluator notes (hidden from candidates)

## LNK-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Entities.** `members (member_id, created_at, status active|closed, closed_at)`. One table per entry kind, each row a *version* of an entry with a stable `entry_id`:
  - `position_versions (entry_id, member_id, version_no, title, company_page_id NULL, company_text NULL, start_month, end_month NULL, description, valid_from_month, valid_to_month, recorded_from, recorded_to, client_edit_seq, op insert|update|delete)`.
  - `education_versions`, `skill_versions (entry_id, member_id, skill_id NULL, skill_text, …)` and `headline_versions`, `location_versions` with the same recorded-time columns.
  - `section_visibility_versions (member_id, section, audience everyone|connections|only_me, recorded_from, recorded_to)`.
- **Two time axes.** Valid time is the business fact (the job ran from start_month to end_month); recorded time is when the system held this version. "What did the profile say at T" filters `recorded_from <= T < recorded_to`; "where did they work in month M, as known now" filters current versions (`recorded_to = ∞`) on `start_month <= M <= COALESCE(end_month, M)`. A position added today with a 2019 start month has recorded_from = today and valid time from 2019.
- **Ordering edits.** Versions are ordered by a per-entry sequence (server-assigned on accept, or a client sequence checked by the server), never by arrival; a stale edit is rejected or recorded as a conflict, not made current.
- **Visibility.** Applied at read time from the current visibility version for every reader except the member. Point-in-time features for the matching model use only sections visible to that consumer under current settings (stricter of then and now is also acceptable if argued).
- **Applications.** `applications (application_id, member_id, posting_id, submitted_at)` with `application_profile_copy (application_id, payload)` written once at submission; it is part of the application record and follows the application's retention.
- **Point-in-time features.** For each (member, application_date): the versions with `recorded_from <= application_date < recorded_to` — recorded time, not valid time, or a correction made later leaks into training.
- **Erasure.** Deletion of an entry or account closure writes an erasure request `(member_id, entry_id NULL, requested_at, due_at = requested_at + {{erase_days}} days)`. Every store that holds profile-derived rows is registered with a delete path keyed by member_id/entry_id: versioned tables (row deletes or delete vectors, then compaction), snapshots and extracts (registered, partitioned or bucketed by member hash so one rewrite touches few files), caches (TTL below the window or explicit purge), and, as an alternative, per-member encryption keys destroyed on erasure (crypto-shredding). A completion check queries each registered store for the member before closing the request.
- **Retention.** Non-current versions older than {{history_days}} days are purged by the same mechanism.
- **Aggregates.** `agg_skill_region_month (skill_id, region, month, members)` computed from current versions at month-end with a minimum-member threshold; published cells stay as published (this exercise's rule), later months exclude erased data, and the method note says so.

**Competing designs to accept.** An event log of profile edits as the source of truth with versioned tables as projections, if erasure reaches the log (log compaction by key or per-member encryption). A full-profile document per version, if it is clear how per-skill questions are answered (an extracted entry table) and how erasure works. Uni-temporal versions plus an audit table, if both example questions can still be answered precisely.

**Bottlenecks and failure modes.** Overwriting entries (no history); a single "effective date" column that mixes valid and recorded time; ordering versions by arrival; daily full-profile snapshots at {{members}} profiles (storage, and erasure must rewrite every snapshot); unregistered copies (extracts, notebooks, caches) that erasure cannot find; point-in-time features filtered on valid time (leakage); inferring protected traits from names, photos or dates.

**Incident guidance.**
- *Headline still in a training extract {{erase_days}} days after closure*: contain by deleting the extract or the member's rows in it and pausing jobs that read it; fix by registering every materialised extract with the erasure service (a store that is not registered cannot be created by the pipeline tooling); guard with a completion check that scans every registered store for erased member ids before an erasure is marked done, plus an alert when a request nears its due date.
- *Résumé import wrote the upload month as start month*: it confused recorded time with valid time. Contain by labelling the hiring-trends chart and pulling it; correct by re-importing with parsed start months (new versions, not overwrites) or flagging the batch as "start month unknown"; guard with a distribution check on start months per import batch and a rule that bulk imports never default valid time to the import date.
- *Out-of-order edits made an old title current*: ordering by arrival time. Reorder affected entries by the per-entry sequence, write corrective versions, and tell affected applicants' employers only if the policy requires (application copies are what was sent); guard with server-side sequence checks that reject stale edits and a test that replays retried edits.

**Follow-up guidance.** (1) Version 1: recorded today, valid from three years ago; version 2 next week with the corrected title; deletion closes the entry and erasure removes both versions within {{erase_days}} days — before that only the member sees the history, after it nobody does; an application submitted in between keeps its own copy. (2) A join of (member_id, application_date) to versions with `recorded_from <= application_date AND application_date < recorded_to`. (3) Delete vectors or row-level deletes plus scheduled compaction, member-hash bucketing so a delete touches few files, or per-member keys. (4) Grain: (skill, region, month) over current versions at month-end; next month excludes deleted skills; last month's published cell stays and the note explains why. (5) Entry versions store only what changed; snapshots copy everything daily and make erasure touch every snapshot — entry versions are the strong answer, with an optional periodic snapshot for fast reads.

**Rubric anchors.** 2: a profile table overwritten in place, or a daily snapshot with a deleted flag. 3: entry versions with stable ids, valid and recorded time distinguished, an erasure path for the main tables. 4: also edit ordering, application copies, point-in-time features on recorded time, erasure that reaches snapshots, extracts and caches with a completion check, and an aggregate restatement policy.

**Strong signals.** Separates "true when" from "known when" without prompting; treats erasure as a property of every derived store. **Red flags.** "Soft delete is enough"; inferring age or gender from graduation dates or names; using hidden sections for features.

## LNK-L3-02

**Reference architecture (one defensible design).**
- **Identities.**
  - `openings (opening_id, employer_id, requisition_id NULL, first_posted_at, status open|filled|cancelled, identity_method requisition|matched)`.
  - `postings (posting_id, opening_id, employer_id, source direct|ats_feed, source_ref, posted_at, closed_at NULL, close_reason poster|auto_{{auto_close_days}}d|filled|ats_removed NULL)`; reopenings as `posting_status_events (posting_id, status, at)`.
  - `posting_versions (posting_id, version_no, title, location, workplace_type, salary_min, salary_max, currency, pay_period, valid_from, valid_to)`.
- **Repost identity.** With a requisition id: opening = (employer, requisition). Without: a deterministic matcher (same employer, normalised title, location, overlapping or adjacent posting windows within N days) that assigns `identity_method = matched` and a confidence; a labelled sample of pairs measures precision and recall each quarter.
- **Applications.** `applications (application_id, member_id, posting_id, posting_version_no, submitted_at, channel on_platform)`; `offsite_clicks (click_id, member_id, posting_id, clicked_at)` kept in a separate fact, never unioned into applications.
- **Status.** `application_stage_events (application_id, employer_stage_id, stage_version, at, actor)` append-only; `employer_stages (employer_id, stage_id, version, name, visible_status submitted|viewed|not_selected|NULL, valid_from, valid_to)`; `applicant_status_shown (application_id, visible_status, shown_at, source_event_id)` written when the applicant's view changes. "Not selected" is written only from an explicit employer action (this exercise's rule).
- **Facts.** `fct_applications_daily (posting_id, opening_id, date, applications)`; `fct_application_snapshot (application_id, submitted_at, first_viewed_at, last_visible_status, received_any_status_after_submit, closed_reason)` as an accumulating snapshot; `fct_openings (opening_id, postings_count_90d, …)` for repost counts.

**Competing designs to accept.** A single postings table with a nullable `previous_posting_id` chain instead of openings, if the matcher and its error rate are discussed. Event-sourced applications with materialised current status, if "what was shown" is an event, not recomputed from the current mapping. A canonical cross-employer stage taxonomy for reporting, if the applicant-visible mapping is still per employer and versioned.

**Bottlenecks and failure modes.** Treating each posting as a job (reposts inflate counts and reset time-to-fill); status overwritten (history and what-was-shown lost); recomputing shown status from today's mapping; salary shown from the current version; offsite clicks counted as applications; closure reason missing; ATS feed ids treated as globally stable.

**Incident guidance.**
- *ATS migration re-sent postings with new ids*: contain by pausing ingestion for that employer and suppressing the "new" flag; map new ids to old via (employer, requisition id or source_ref + title + location) and re-point the openings; keep applications on their original postings and show applicants an unchanged status; guard with a per-employer anomaly check (share of postings that are new versus a baseline, here about {{ats_share}} of a day's postings) that holds the batch for review.
- *"Not selected" sent after auto-sorting*: roll back the mapping, and correct what applicants were shown (an apology status is a product decision; the data change is a new shown-status event, not a deletion); guard by requiring explicit employer action for "not selected", mapping changes reviewed before activation, and a canary that alerts when shown "not selected" volume jumps for one employer.
- *Auto-closed postings counted as filled*: closure reason was missing. Backfill reasons from the auto-close job's log (closed at exactly posted_at + {{auto_close_days}} days with no poster action), restate time-to-fill with a note, and make close_reason NOT NULL with "unknown" never counted as filled.

**Follow-up guidance.** (1) One opening, posting v1 then v2 (salary edited; the first 40 applications keep v1), auto-close event, a new posting linked to the same opening, then filled; earlier applicants see "no longer accepting applications" on the closed posting and their own status as the employer moves them. (2) Matcher on employer + normalised title + location + time gap; measure with a labelled sample, and treat requisition ids as ground truth where present. (3) Stage versions keep the old mapping for events already shown; applicants already in the stage get a new shown status only if the employer's action changes it; last month's metric uses events as they were. (4) Report the share viewed within N days and the median among viewed; a month is final after N days plus lag. (5) Events and shown-status are append-only facts; the per-application snapshot is rebuilt for touched applications; "what was shown" is reproduced from the shown-status events.

**Rubric anchors.** 2: one jobs table and one applications table with a status column. 3: openings, postings, versions, status history and offsite clicks separated. 4: also a measured repost matcher, versioned stage mappings, what-was-shown as events, closure reasons, and each incident guarded.

**Strong signals.** Asks what the applicant actually saw and when; separates "we know they clicked" from "they applied". **Red flags.** Inferring rejections from silence; showing employer stage names to applicants; counting reposts as new demand.

## LNK-L3-03

**Reference architecture (one defensible design).**
- **Identity.** `organisations (org_id, created_at)`; `pages (page_id, org_id, created_at, retired_at NULL)`; `page_names (page_id, name, handle, valid_from, valid_to)` for rebrands (a rebrand is a new name version on the same page).
- **Merges.** `page_merges (merge_id, from_page_id, into_page_id, merged_at, unmerged_at NULL, verified_by)`. Resolution follows active merges to a fixed point; a cycle is rejected at write time (the merge service checks that `into_page_id` does not resolve to `from_page_id`). A materialised `page_resolution (page_id, resolved_page_id, valid_from, valid_to)` closure table is rebuilt on each merge or unmerge, so a warehouse join is a single equi-join with a time condition.
- **Affiliation.** `page_affiliations (parent_page_id, child_page_id, kind subsidiary|acquired|showcase, valid_from, valid_to)`; an acquisition is an affiliation from its date; retiring the acquired page into the acquirer is a separate merge with its own date.
- **Positions.** Member positions keep the `company_page_id` the member chose, or `company_text`; resolution happens at read time. `company_text_links (normalised_text, country, page_id, linked_at, method, reviewed_by)` links free text later, with evidence beyond the name.
- **Followers.** `follows (member_id, page_id, followed_at, unfollowed_at)` on the original page id, so an unmerge can return followers to their own page. Follows created on the surviving page during a merge record `via_merge_from` when the follow came through a resolved link.
- **Insights.** `fct_page_headcount_week (resolved_page_id, week, function, location_band, members)` built "as is" (current resolution) for the administrator's current view, with "as was" available for history; cells below {{insights_floor}} suppressed; published differences protected by rounding to a fixed base, a minimum reportable change, or calibrated noise, and suppression of complementary cells.

**Competing designs to accept.** Rewriting position links at merge time if a full undo log makes unmerges exact (costly, but defensible). A graph of pages and edges with time properties, if the closure table or equivalent makes resolution cheap. Differential privacy for insights, if the accuracy cost for small pages is discussed.

**Bottlenecks and failure modes.** Rewriting positions and follows (unmerge impossible); chains and cycles followed row by row at warehouse scale; rebrands created as new pages; acquisitions merging history silently; suppression only per cell, leaving differences and complements to reveal small groups; fuzzy name matching across countries without review.

**Incident guidance.**
- *Differencing revealed a group below {{insights_floor}}*: contain by withdrawing the affected function table for that page; fix by protecting differences (round counts to a base, require changes of at least the floor before they show, or add noise) and suppressing complementary cells; guard with an automated check that computes week-over-week and merge-before/after differences for every published table and blocks publication when any difference is below the floor.
- *Rebrand entered as a new page*: merge the new page into the original with an effective time and convert it to a name version, so positions resolve to one page; re-run headcount for the period with a note; guard with a duplicate-page detector (same domain, overlapping administrators, similar names) that routes new pages to review.
- *Bad merge of two companies*: unmerge; follows recorded with the original page id return automatically, and those created during the merge window go to the page whose link the member used (the `via_merge_from` trail), or are asked to re-follow; guard with stronger verification before merges (domain or administrator overlap) and a holding period during which merges can be undone without data loss.

**Follow-up guidance.** (1) Rows: A→B (t1), B→C (t2), A→B unmerged (t3). A position on A resolves to C between t2 and t3 and to A after t3; positions on B still resolve to C. (2) "As is" combines both companies across the whole period (a step-free line) and "as was" shows the step at the acquisition date; an administrator usually sees "as is" with a dated annotation. (3) Show the cell if both values are above the floor and the difference is published only if it meets the protection rule; never let an unmerge expose the small remainder. (4) Link with evidence (domain, location, reviewed), apply from the link date or restate with a note, never silently. (5) Materialise the closure table, rebuilt incrementally on each of the roughly {{merges_per_month}} monthly merges.

**Rubric anchors.** 2: positions rewritten to the surviving page, no history. 3: merge map with times, resolution at read time, affiliations with dates, the floor applied to cells. 4: also cycles and unmerges, the closure table, as-was versus as-is stated, difference attacks handled, and each incident guarded.

**Strong signals.** Treats unmerge as a first-class requirement; spots the differencing risk unprompted. **Red flags.** Listing individual employees in insights; inferring employment from anything but what members listed; deleting retired page ids.

## LNK-L3-04

**Reference architecture (one defensible design).**
- **Ownership.** `customers (customer_id)`, `contracts (contract_id, customer_id, starts_at, ends_at, delete_after = ends_at + {{retention_days}} days)`, `seats (seat_id, contract_id)`, `seat_assignments (seat_id, recruiter_member_id, valid_from, valid_to)`. Work is keyed by seat and contract, and attribution joins the event time to the seat assignment in force.
- **Projects.** `projects (project_id, contract_id, created_by_seat_id, created_at, closed_at)`; `project_ownership (project_id, seat_id, valid_from, valid_to)` for transfers.
- **Candidates in projects.** `project_candidates (project_id, candidate_member_id, added_at, added_by_seat_id)` — a reference to the member, never a profile copy; the profile is read live under the candidate's current settings.
- **Stages.** `stage_definitions (contract_id, stage_id, version, name, sort_order, canonical_stage, valid_from, valid_to)`; `stage_events (project_id, candidate_member_id, stage_id, stage_version, at, seat_id)` append-only. Time in stage comes from consecutive events; reports group by `canonical_stage` (contacted, screen, interview, offer, hired), so renames and reorders of the {{custom_stages}} stages stay comparable.
- **Notes and messages.** `notes (note_id, contract_id, project_id, candidate_member_id, seat_id, body, created_at)`. `threads (thread_id, contract_id, candidate_member_id, owner_seat_id)`; `messages (message_id, thread_id, sender seat_id|candidate, sender_member_id, sent_at)` — the sender of each message is fixed, the thread's owner seat changes on transfer.
- **Deletion.** Every customer-owned row carries `contract_id`; a deletion job runs at `delete_after` for the contract and for every registered derived table and export. Candidate account closure removes the candidate from projects (references die with the profile); notes about a closed account are deleted at closure in the strict policy, or at contract end in the lenient one — either is acceptable if argued and stated to the customer.
- **Facts.** `fct_stage_reached (project_id, canonical_stage, candidate, first_reached_at, seat_id_at_time, recruiter_at_time)`; `fct_thread_first_reply (thread_id, first_message_at, first_reply_at, seat_id_at_first_message)`; hires per recruiter from the seat assignment in force when the hire event happened.

**Competing designs to accept.** Ownership by recruiter with an explicit transfer table, if attribution is still by the holder at event time. A global canonical stage taxonomy instead of per-contract mapping. A per-customer database or schema (strong isolation, simpler deletion), if cross-customer analytics are kept aggregate.

**Bottlenecks and failure modes.** Recruiter as owner (orphaned projects on departure); attribution by current seat holder; a current_stage column (no time in stage); stage reports by name or sort order; profile copies (stale, and erasure misses them); deletion that skips exports and derived tables; any cross-customer signal ("another company contacted this candidate").

**Incident guidance.**
- *Hires credited to the new seat holders*: attribution read the current holder. Rebuild the fact by joining each stage event's time to `seat_assignments`; restate the report with a note; guard with a test that transfers a seat in a fixture and asserts last month's hires stay with the original recruiter.
- *Reordered stages reversed the conversion chart*: the chart sorted by `sort_order` and grouped by stage name. Group by canonical stage, keep display order per stage version, and add a check that a stage-definition change producing a canonical-stage regression (e.g. offer before interview) requires administrator confirmation.
- *Export table missed by contract-end deletion*: delete the export rows and stop the scheduled report; register every table and export with a `contract_id` in the deletion catalogue (an unregistered table cannot be created for customer data); prove completion with a post-deletion scan that every registered store has zero rows for the contract, {{retention_days}} days after the end date.

**Follow-up guidance.** (1) Events carry seat ids; the original recruiter is credited for the save, message and stages before departure, the new holder for the hire; replies during the {{transfer_lag_days}}-day gap belong to the thread, visible to administrators. (2) Canonical stages plus versioned definitions; time in stage from events. (3) The thread's owner seat is vacant; replies are stored and shown to the new holder after transfer; "replies per seat" attributes to the seat that sent the first message. (4) Delete projects, notes, stage events, threads' customer-side metadata and exports after {{retention_days}} days; aggregate usage counts without candidate identity may survive. (5) Within one contract, a per-candidate contact flag computed from that contract's threads only; never across contracts.

**Rubric anchors.** 2: recruiter-owned projects with a current stage column and profile copies. 3: seat-based ownership with assignment history, stage events, references not copies, contract-keyed deletion. 4: also canonical stages with versions, thread transfer semantics, attribution by holder at event time, candidate closure policy, cross-customer isolation and each incident guarded.

**Strong signals.** Says "the customer owns the work" first; attributes by time, not by current holder. **Red flags.** Copying profiles into projects; sharing contact history across customers; deleting history on transfer.

## LNK-L3-05

**Reference solution** (PostgreSQL; `{{week_from}}` and `{{week_to}}` are the instance's window)

```sql reference
WITH counted AS (                             -- self-views and closed accounts removed
  SELECT pv.viewed_id, pv.viewer_id, pv.viewed_at, m.time_zone,
         COALESCE((SELECT s.mode
                   FROM visibility_settings s
                   WHERE s.member_id = pv.viewer_id
                     AND s.effective_at <= pv.viewed_at
                   ORDER BY s.effective_at DESC
                   LIMIT 1), 'named') AS mode
  FROM profile_views pv
  JOIN members m ON m.member_id = pv.viewed_id          -- the viewed member's time zone
  JOIN members w ON w.member_id = pv.viewer_id
  WHERE pv.viewer_id <> pv.viewed_id
    AND w.closed_at IS NULL
), per_viewer AS (                            -- one row per (member, local week, viewer)
  SELECT viewed_id AS member_id,
         date_trunc('week', viewed_at AT TIME ZONE time_zone)::date AS week_start,
         viewer_id,
         bool_or(mode = 'named') AS named
  FROM counted
  GROUP BY 1, 2, 3
)
SELECT member_id, week_start,
       COUNT(*)                          AS viewers,
       COUNT(*) FILTER (WHERE named)     AS named_viewers,
       COUNT(*) FILTER (WHERE NOT named) AS private_viewers
FROM per_viewer
WHERE week_start BETWEEN DATE '{{week_from}}' AND DATE '{{week_to}}'
GROUP BY member_id, week_start
ORDER BY member_id, week_start;
```

**Explanation.** Each view first gets the mode in force when it happened: the latest setting at or before `viewed_at` (a correlated subquery with `ORDER BY … DESC LIMIT 1`), defaulting to `named` when the viewer had no setting yet. Self-views and views by closed accounts are removed before anything is counted. The view is then placed in a week of the *viewed* member's time zone: `viewed_at AT TIME ZONE time_zone` turns the instant into local wall-clock time, and `date_trunc('week', …)` takes its Monday. Grouping by (member, week, viewer) collapses repeat views, and `bool_or(mode = 'named')` applies the rule that one named view makes a named viewer; the outer counts then add up by construction. The window is applied to the local week start, so the last week is included up to the end of its local Sunday.

**Complexity.** One pass over views, with an index probe on `visibility_settings (member_id, effective_at)` per view (the primary key serves it), then two hash aggregates. At production scale the setting in force is better attached once, when the view event is recorded, or with a range join on setting intervals (`effective_at` to the next `effective_at`) instead of a probe per view.

**Dialect notes.** The correlated `LIMIT 1` subquery is not allowed in BigQuery or Spark SQL; there, build setting intervals with `LEAD(effective_at) OVER (PARTITION BY member_id ORDER BY effective_at)` and join on `effective_at <= viewed_at AND viewed_at < next_effective_at`, or use an as-of join where the engine has one (Snowflake `ASOF JOIN … MATCH_CONDITION (viewed_at >= effective_at)`). `bool_or` is `BOOLOR_AGG` in Snowflake, `LOGICAL_OR` in BigQuery, `bool_or` or `max` in Spark; `COUNT(*) FILTER (WHERE …)` becomes `COUNT_IF` (Snowflake, BigQuery, Spark) or `SUM(CASE …)` (MySQL). Time zones: `CONVERT_TIMEZONE('UTC', time_zone, viewed_at)` (Snowflake), `DATETIME(viewed_at, time_zone)` (BigQuery), `from_utc_timestamp` (Spark), `CONVERT_TZ` (MySQL, which needs the zone tables loaded). Week truncation: `DATE_TRUNC('WEEK', …)` is Monday-based in Snowflake by default (session parameter `WEEK_START`) and in Spark; in BigQuery use `DATE_TRUNC(d, WEEK(MONDAY))`, because plain `WEEK` starts on Sunday. None of these variants is executed here.

**Edge cases built into the data.** A self-view; repeat views by one viewer in one week; a viewer who switched from named to private mid-week and viewed before and after (counts once, as named); a viewer whose setting was private at the time and changed to named only after the data; a viewer whose first setting comes after their view (default named); viewers who never changed a setting. Hard adds a closed account with views in the window (and sometimes a second), a setting that took effect at exactly the second of a view, views exactly at the local Monday 00:00 that opens the window, at the last second of its final Sunday and at the Monday 00:00 after it, and European zones across the 2026-10-25 clock change. Very Hard adds members on several continents with views that are Monday in UTC but Sunday locally (west of UTC) and the reverse (east of UTC), across both the European and North American clock changes.

**Common mistakes.** Counting self-views; counting views instead of viewers; counting a mixed-mode viewer in both columns, or as private; using the viewer's current (latest) setting for past views; an inner join or a NULL filter that drops viewers with no setting yet; excluding the last week of the window; (Hard+) a strict `<` that misses a setting effective at the exact second; counting closed accounts; truncating weeks in UTC; (Very Hard) using the viewer's time zone. Each has a diagnostic. A plain `LEFT JOIN visibility_settings` on member_id without picking one row multiplies views by the number of settings, which inflates the view counts but, because of the distinct counting, often hides as a mode error.

**Follow-up guidance.** (1) Attach the mode when the view is recorded and keep per (member, week) the set of viewer ids with a named flag (or a per-week viewer table); a closure then deletes that viewer's rows and the week's counts are recomputed from the remaining rows, rather than decremented from a stored count. (2) Either is defensible if stated: re-bucket all weeks in the new zone (consistent, but past numbers move) or freeze past weeks; members generally expect stable past numbers with a note. (3) A small private count can identify a person when combined with outside knowledge; options include showing "a few private viewers" below a threshold or only showing private views in aggregate across weeks — the strong answer names the trade-off with the member's legitimate interest. (4) It exposes viewers who chose privacy: roll back immediately, purge caches, treat as a privacy incident with notification per policy; a test with a viewer who switched modes would have caught it.

**Rubric anchors.** 2: right shape but the current setting or counted views, or weeks in UTC. 3: matches the expected result. 4: also explains how to precompute safely with closures, the time-zone change policy, and the small-count disclosure risk.

**Strong signals.** Asks which time zone owns the week, and what happens at the exact second of a switch; collapses to viewers before counting. **Red flags.** Using the latest setting for history (a privacy failure, not only a wrong number); joining all settings and then `SELECT DISTINCT`; exposing any per-viewer detail beyond what the member's own page shows.
