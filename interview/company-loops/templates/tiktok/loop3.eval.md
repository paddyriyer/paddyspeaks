# TikTok · Loop 3 — evaluator notes (hidden from candidates)

## TTK-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity.** `videos (video_id, owner_account_id, created_at)`: one row per video, written once. Drafts are `drafts (draft_id, owner_account_id, saved_at, expires_at, posted_video_id NULL)`, kept apart so a draft never counts as a video; `expires_at = saved_at + {{draft_days}} days` (this exercise's rule).
- **Lifecycle.** `video_lifecycle_events (event_id, video_id, kind upload_started|upload_resumed|upload_completed|processing_started|processing_failed|published|unavailable|available|deleted, event_at, recorded_at, client_event_id)`. Upload attempts carry `upload_id`; resumptions share it. `published` is unique per video (a constraint or a dedupe on `client_event_id`); a reprocess after a failed check is `unavailable` then `available`.
- **Settings.** `video_settings (video_id, setting visibility|comments|duet|stitch, value, valid_from, recorded_at, source creator|default|account)`, effective-dated by event time with the recorded time kept. `account_privacy (account_id, is_private, valid_from, recorded_at)`. Effective visibility at T = the video's visibility at T combined with the account's privacy at T (a private account narrows "everyone" to approved followers in this exercise).
- **Content versions.** `video_text_versions (video_id, version, caption_text, cover_frame_ms, valid_from, recorded_at, erased_at NULL)`. Text is erased after deletion plus the retention period by nulling `caption_text` and stamping `erased_at`; the row (and so the version count and dates) remains.
- **Moderation outcome.** `video_moderation_state (video_id, decision_id, policy_area_code, state restricted|removed|reinstated, valid_from)`: a reference to the decision kept by the moderation process, not its details.
- **Derived intervals.** `video_state_intervals (video_id, valid_from, valid_to, lifecycle, effective_visibility, text_version, comments, duet, stitch)` rebuilt per video when any input changes; "as of T" is one indexed range lookup, and per-day visibility counts are interval-day intersections.
- **Per-day public count.** Choose a definition and state it: public at the end of the local day, or public at any time during the day, or public-minutes ÷ 1,440. End of day is the simplest reproducible metric; "any time" overstates churn.
- **Owner-only data.** Creator-facing views filter on `owner_account_id` = the signed-in account; no viewer identifiers are in this model.

**Competing designs to accept.** A fully bitemporal settings table with range types and exclusion constraints instead of a derived intervals table. Event sourcing of everything with projections. Daily snapshots for recent months plus intervals for older history, if costed. A single "video_versions" table that copies all attributes on every change, if the candidate addresses write amplification at {{setting_changes_per_day}} changes a day.

**Bottlenecks and failure modes.** One mutable status and one visibility column; drafts counted as uploads; resumptions counted as separate uploads; device local times stored as if UTC; caption text kept forever after deletion, or deletion erasing the row so historical counts change; daily snapshots of every video for {{history_years}} years (billions of rows a day at the upper volumes); history queries without date bounds on a partitioned table.

**Incident guidance.**
- *Local device times*: normalise at ingestion using the offset the client sends (or reject events without one), restate the affected `valid_from` values as superseding rows with the corrected time (recorded time = now), rebuild intervals for the affected videos and re-run the two regions' daily counts, annotated. Guardrail: reject or quarantine setting events whose event time is after the recorded time by more than a tolerance.
- *Duplicate published event*: enforce one `published` per video (unique constraint or idempotent write keyed by video id and event kind), dedupe the history, recompute upload success for the days affected, and correct the creator's count; add a check that each video has at most one `published`.
- *History query timeout*: give the support lookup a per-video index or a per-video derived intervals table clustered by `video_id`; keep the date-partitioned event table for batch use; require date bounds in batch queries.

**Follow-up guidance.** (1) Intersect visibility intervals with the day; end-of-day definition uses the interval containing the day's end. (2) Viewers saw the old caption at 10:00 (the server learned at 11:00); "true at 10:00" by event time returns the new caption. Both are valid for different questions; support uses recorded time for "what was shown". (3) Keep identity, lifecycle and settings rows; erase text after retention; per-day counts use intervals that close at deletion, so earlier days do not change. (4) Snapshots: videos × days (tens of billions per year at the upper volumes); intervals: changes only. (5) A retry with a new upload id on the same video id keeps success per video meaningful; a new video id per retry turns failures into separate videos; candidate should pick and define the metric.

**Rubric anchors.** 2: one row per video with status and visibility updated in place; drafts and uploads mixed. 3: lifecycle events, effective-dated settings, caption versions, an "as of" query, deletion handled. 4: also two time axes, effective visibility from account and video settings, interval sizing, text erasure with reproducible counts, and incident repairs with guardrails.

**Strong signals.** Separates identity, lifecycle, settings and content; defines the per-day public metric precisely. **Red flags.** Hard deletes that change past counts; keeping caption text indefinitely; viewer data in the video model.

## TTK-L3-02

**Reference architecture (one defensible design).**
- **Edge on the child.** `remixes (remix_video_id PK, parent_video_id, kind duet|stitch, clip_start_ms NULL, clip_end_ms NULL, created_at, root_video_id, depth, permission_row_id, check_outcome allowed|refused_logged|legacy_unchecked)`. One parent per remix, never updated. A stitch's clip range is validated (`clip_end_ms − clip_start_ms <= {{stitch_limit}}` in ms); legacy rows that exceed it are kept and flagged, not dropped.
- **Permissions.** `remix_permissions (permission_row_id, video_id, kind duet|stitch, audience everyone|friends|no_one, valid_from, recorded_at)`. The check at creation looks up the row in force at `created_at` and stores its id and the outcome. A later change never rewrites earlier outcomes (this exercise's rule). Ties at the same instant are broken by a stated rule (for example, the change applies to remixes created strictly after it, by event time, then by recorded order) and the permission row id stored explains it.
- **Root and depth.** Because the parent never changes, `root_video_id` and `depth` are computed once at write time from the parent's row (root = parent's root, depth = parent's depth + 1). Root lookups are then O(1); descendants of an original are `WHERE root_video_id = X` for whole trees, or a recursive query bounded by depth for subtrees.
- **Closure (optional).** `remix_closure (ancestor_id, descendant_id, distance)` adds `depth` rows per new remix, up to {{max_depth}}; worth it only if "all descendants of any node" is frequent. Written in the same transaction as the remix or rebuilt idempotently from `remixes`.
- **Attribution.** `account_handles (account_id, handle, valid_from, valid_to)`; the remix stores the parent's `owner_account_id`. Attribution as of D resolves the handle valid on D; a reused handle points to a different account only in its own valid range. If the parent is deleted or not visible to the viewer, the attribution shows "original unavailable" and the link stays for counts.
- **Counts and lists.** Weekly remix counts per original from `remixes` grouped by `parent_video_id`, kind and week of `created_at`, optionally `check_outcome = 'allowed'`. The creator's list of remixers is filtered to remixes visible to them (joined to the video model's effective visibility at read time).

**Competing designs to accept.** A graph store for lineage with the same invariants. Materialised path (`/root/…/parent/`) instead of root and depth, if path length at {{max_depth}} is considered. Storing permission snapshots (the full setting) on the remix rather than a row id.

**Bottlenecks and failure modes.** A mutable "duet allowed" column (no history); recomputing root by recursion on every request; unbounded recursion on viral trees; closure tables written separately from remixes and drifting; attribution by handle text; deleted parents causing broken joins and lost counts; exposing remixes the creator may not see.

**Incident guidance.**
- *Clip ranges in frames*: identify the client version and window, convert using the frame rate captured with the upload (or quarantine if unknown), restate the rows as corrections, and clear the false violations; add a unit field or a validation that rejects implausible ranges at ingestion.
- *Current permission used*: re-run the check against the row in force at creation, restore outcomes from the stored `permission_row_id`, withdraw the report and tell support; add a test that a permission change never alters past outcomes.
- *Recursion out of memory*: switch descendant counts to `root_video_id`/`depth` aggregates or the closure table; bound recursion with a depth limit and iterative processing; publish the last good count rather than zero when the job fails.

**Follow-up guidance.** (1) Join remixes to their stored permission row or check outcome; never to the current permission. (2) Today: the current handle; last month: the handle valid then, from `account_handles`. (3) Store at write time: parent never changes; deleting a middle video does not change ancestry, only visibility. (4) Up to {{max_depth}} rows per remix × {{remixes_per_day}} in the worst case, typically a few per remix because most chains are shallow; worth it if subtree queries dominate. (5) Ordering by event time, then recorded order, decided by the stated tie rule and evidenced by the stored permission row id.

**Rubric anchors.** 2: a remix count column on the original and an "allowed" flag overwritten. 3: typed edges with clip ranges, effective-dated permissions, outcome stored at creation, root/descendant queries. 4: also stored root and depth with sizing, attribution by account with handle history, deletion and visibility handled, and incident repairs.

**Strong signals.** Uses the immutability of the parent to precompute root and depth; stores the permission row with the outcome. **Red flags.** Retroactively invalidating remixes; lists that reveal hidden remixes; attribution that breaks on a handle change.

## TTK-L3-03

**Reference architecture (one defensible design).**
- **Sounds.** `sounds (sound_id, origin original|licensed, created_from_video_id NULL, creator_account_id NULL, catalogue_track_id NULL, rights_holder_id NULL, created_at)`. `sound_track_links (sound_id, catalogue_track_id, confidence, score_version, valid_from, recorded_at)` for original sounds identified as containing a licensed track; the original keeps its id.
- **Licences.** `licences (licence_id, catalogue_track_id, region, licence_start, licence_end, granted_at, source_grant_id)` as half-open windows; a grant to a region group is expanded at grant time into one row per region in the group as it stood then, with `source_grant_id` and the group version kept. Overlaps are allowed; coverage is "any licence with start ≤ T < end".
- **Clips.** `video_sound_clips (clip_id, video_id, sound_id, offset_ms, duration_ms, sound_volume, own_volume, valid_from)`: a replacement is a new clip row with a later `valid_from`; the previous clip's use ends there.
- **Mutes.** `video_mutes (video_id, region, muted_at, licence_id, reason licence_ended|track_identified|correction, decided_at, job_run_id)`; permanent in this exercise. A mistaken mute is reversed only through a recorded correction row (`video_mute_corrections`), never by deleting the mute.
- **Lapse.** A licence end E for (track, region) is a lapse when no licence of the same track and region covers E. The videos to mute are those whose current clip uses a sound that is the track or is linked to it at E, published before E, not deleted, and without a mute in that region at or before E.
- **Counts.** `sound_usage_daily (sound_id, region, day, videos_using)` maintained incrementally from clip, deletion and mute events (a mute removes the video from the count in that region from `muted_at`; a replacement moves it to the new sound). Sound pages read this table; per-video lists filter by viewer visibility.

**Competing designs to accept.** Licences stored per region group with expansion at query time, if the group membership is effective-dated and the query uses membership as of the grant. An availability table of intervals per track and region, derived from licences, for fast coverage checks. Mute decisions produced by a stream job keyed by (track, region) with a work queue per lapse.

**Bottlenecks and failure modes.** A licensed flag per track; mutes as a flag on the video; BETWEEN-inclusive windows (double coverage or a gap at renewal); group expansion at read time without history; fan-out of {{lapse_videos}} mutes at one instant with no queueing or lag measurement; counters that ignore mutes; the original sound's identity replaced when a track is identified.

**Incident guidance.**
- *Renewal loaded an hour late*: the gap made the lapse job mute about {{lapse_videos}} videos. Fix the licence row (a corrected licence with the right start), write correction rows that restore the sound for the mutes whose licence was in fact covered, notify affected creators, and add a pre-mute check that re-reads coverage at execution time and a hold for mutes in the first minutes after a renewal is expected.
- *Group edited after grants*: expanding at read time used today's membership. Re-expand from the group version at grant time, regenerate the rights report for the quarter across {{regions}} regions, and make expansion part of the grant write.
- *Counts not decremented on mute*: rebuild `sound_usage_daily` for the affected days from clips, deletions and mutes, and include mutes in the incremental logic; add a reconciliation that compares the counter with a periodic full count.

**Follow-up guidance.** (1) Coverage test at E with `start <= E AND end > E`; exclude videos muted at or before E; a renewal at exactly E covers it. (2) Per this exercise's rule, no: expansion happened at grant time; the model answers it from the expanded rows. (3) Videos whose current clip uses the original sound; mute in the five regions; creators see the reason category and the date. (4) Partition the work by sound and region, queue mute decisions, apply in batches, and measure lag as mute time minus licence end (the SQL template's readout). (5) Incremental per-day counts from events with a periodic reconciliation.

**Rubric anchors.** 2: flags for "licensed" and "muted", inclusive windows, no history. 3: sounds of both origins, half-open licences per region, clips, mute decisions with reasons, a lapse query. 4: also identification links with effective times, group expansion at grant time, fan-out at {{lapse_videos}} with lag measured, counts that honour mutes, and correction-based reversal of mistaken mutes.

**Strong signals.** Defines a lapse as an uncovered end; keeps the original sound's identity. **Red flags.** Deleting mutes to undo them; per-video detail visible to anyone but the creator; licences overwritten on renewal.

## TTK-L3-04

**Reference architecture (one defensible design).**
- **Comments.** `comments (comment_id, video_id, author_account_id, parent_comment_id NULL, root_comment_id, posted_at, recorded_at, language_code)`; text in `comment_text (comment_id, text, erased_at NULL)` in the operational store only. `comment_deletions (comment_id, deleted_at)`.
- **Filters.** `creator_filter_settings (creator_account_id, setting, value, valid_from)` and `creator_filter_lists (creator_account_id, list_version, valid_from)` with the list's entries held operationally. `comment_filter_outcomes (comment_id, outcome passed|held, filter_kind list|default, list_version NULL, score NULL, score_version NULL, evaluated_at)`: the version in force at `posted_at` (this exercise's rule), so an offline comment posted at 11:59 uses the 11:59 version. `creator_reviews (comment_id, action approved|deleted, at)`.
- **Reports and cases.** `reports (report_id, comment_id, reporter_account_id, policy_area_code, reported_at, client_report_id)` (reporter id never leaves the operational store). `cases (case_id, comment_id, opened_at, queue_id, status)` with a partial unique index on `comment_id WHERE status = 'open'` so concurrent reports attach to one open case (insert … on conflict → attach). `case_reports (case_id, report_id)`.
- **Decisions and appeals.** `decisions (decision_id, case_id, outcome no_action|restrict|remove, policy_area_code, policy_version, decided_at, supersedes_decision_id NULL)`; reviewer ids stay in the operational system. `appeals (appeal_id, decision_id, filed_at)` within {{appeal_days}} days; the appeal's result is a new decision with `supersedes_decision_id`.
- **Visible state.** Derived at T from: deletion, filter outcome and creator review, and the latest decision in force; viewers see `visible`, the author sees their own comment with any decision and policy area, the creator sees held comments on their videos. A removed or deleted parent with visible replies renders as a placeholder.
- **Analytics.** `fct_moderation_weekly (week, region, policy_area_code, queue_id, cases_decided, removals, reinstated, median_minutes_to_decision)` with no text, reporter or reviewer ids; restated when appeals land, with a `restated_at` and the original published value kept; small cells suppressed under a stated threshold before publication.

**Competing designs to accept.** A single `comment_events` stream with typed events and a projection for visible state. Cases keyed by (comment, policy area) instead of comment only, if the transparency counts are defined accordingly. Publishing transparency counts as first-published values with a separate restatement table.

**Bottlenecks and failure modes.** One status column; one case per report; decisions overwritten by appeals; text or reporter ids in the warehouse; reviewer-level metrics or ranking; filters applied retroactively; weekly counts computed once and never restated; hot comments receiving thousands of concurrent reports.

**Incident guidance.**
- *40 cases for one comment*: no uniqueness for open cases. Merge the duplicate cases into one (keep the reports), correct the weekly counts for that policy area, and add the partial unique index or a per-comment lock so concurrent reports attach to one case.
- *Appeals not restated*: recompute the affected weeks from decisions with supersession, publish a restatement with the change explained, and make restatement part of the weekly job for decisions changed within the appeal window of {{appeal_days}} days.
- *Missing filter version*: the outcome must carry the version; backfill from the list's version history using `posted_at` where unambiguous, mark the rest unknown, and add a write-time constraint that held outcomes have a version.

**Follow-up guidance.** (1) Recursive or root-keyed thread query joining visible state at T, emitting placeholders for invisible parents with visible descendants. (2) Posted 11:59 by event time: the 11:59 version applies; recorded on the outcome row. (3) The removal week keeps its first-published count and shows a restatement; the appeal week counts the reinstatement; candidates should define both and publish restatements explicitly. (4) A partial unique index on open cases per comment (or an idempotent upsert keyed by comment), and grouping by `client_report_id` for retries. (5) Suppress or band small cells (for example, below a threshold, show "fewer than N") to protect people involved.

**Rubric anchors.** 2: a status on the comment; reports counted as cases; decisions overwritten; text in analytics. 3: threads, filter outcomes with versions, cases from reports, decisions and appeals append-only, visible-state query. 4: also concurrency on case creation, restatements with history, privacy of reporters and reviewers by design, small-cell suppression and incident repairs.

**Strong signals.** Treats visible state as derived from independent inputs; guards case creation under concurrency. **Red flags.** Any content examples; ranking reviewers; exposing reporter identity; analytics that need comment text.

## TTK-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH lapses AS (
  SELECT l.sound_id, l.region, l.licence_end AS lapsed_at
  FROM sound_licences l
  WHERE l.licence_end <= TIMESTAMPTZ '{{as_of}}'
    AND NOT EXISTS (
      SELECT 1 FROM sound_licences n
      WHERE n.sound_id = l.sound_id AND n.region = l.region
        AND n.licence_start <= l.licence_end AND n.licence_end > l.licence_end)
), first_mute AS (
  SELECT video_id, region, MIN(muted_at) AS muted_at
  FROM video_mutes
  GROUP BY video_id, region
), exposed AS (
  SELECT la.region, la.lapsed_at, m.muted_at,
         LEAST(m.muted_at, v.removed_at,
               (SELECT MIN(n.licence_start) FROM sound_licences n
                WHERE n.sound_id = la.sound_id AND n.region = la.region
                  AND n.licence_start > la.lapsed_at)) AS stopped_at
  FROM lapses la
  JOIN videos v ON v.sound_id = la.sound_id
  LEFT JOIN first_mute m ON m.video_id = v.video_id AND m.region = la.region
  WHERE v.published_at < la.lapsed_at
    AND (v.removed_at IS NULL OR v.removed_at > la.lapsed_at)
    AND (m.muted_at IS NULL OR m.muted_at > la.lapsed_at)
)
SELECT region,
       to_char(lapsed_at, 'YYYY-MM') AS lapse_month,
       COUNT(*) AS video_lapses,
       COUNT(*) FILTER (WHERE muted_at = stopped_at) AS muted,
       COUNT(*) FILTER (WHERE stopped_at IS NULL) AS still_playing,
       ROUND(AVG(EXTRACT(EPOCH FROM muted_at - lapsed_at) / 3600) FILTER (WHERE muted_at = stopped_at), 1) AS avg_hours_to_mute,
       ROUND(MAX(EXTRACT(EPOCH FROM muted_at - lapsed_at) / 3600) FILTER (WHERE muted_at = stopped_at), 1) AS max_hours_to_mute
FROM exposed
GROUP BY region, to_char(lapsed_at, 'YYYY-MM')
ORDER BY region, lapse_month;
```

**Explanation.** A lapse is an end instant at which the sound stops being licensed in that region: a `licence_end` at or before the snapshot that no licence of the same sound and region covers. Because windows are half-open, "covers E" is `licence_start <= E AND licence_end > E`, which makes a renewal starting exactly at E (or overlapping it) cover the instant, and excludes the licence itself. Mutes are reduced to the earliest per video and region first, so retries cannot multiply rows or move the mute later. Each lapse is joined to every video using the sound that was published before E and not removed at or before E, with a LEFT JOIN to the first mute so never-muted videos stay; a mute at or before E means the video was silent in time. The lapse ends at the earliest of the first mute, the removal and the next licence start after E; `LEAST` ignores NULLs, so a lapse with none of them has a NULL end and is still playing. A mute that ties with another event satisfies `muted_at = stopped_at`, so it counts as the mute. Hours come from exact `numeric` epochs, averaged and rounded once.

**Complexity.** The lapse set is one anti-join over licences. The main join is lapses × videos per sound, plus hash lookups into the first-mute aggregate; the correlated `MIN(licence_start)` is an index lookup on (sound_id, region, licence_start). In production the per-sound video list is the expensive side: keep a per-sound, per-region table of videos currently playing the sound (maintained from clips, removals and mutes), so a lapse touches only the videos still unmuted there.

**Dialect notes.** `EXTRACT(EPOCH FROM interval)` returns `numeric` in PostgreSQL 14 and later (double precision before); BigQuery uses `TIMESTAMP_DIFF(muted_at, lapsed_at, SECOND)`, Snowflake `DATEDIFF('second', lapsed_at, muted_at)`, Spark SQL `unix_timestamp(muted_at) - unix_timestamp(lapsed_at)`, MySQL `TIMESTAMPDIFF(SECOND, …)`. `FILTER (WHERE …)` is PostgreSQL (and standard SQL); BigQuery, Snowflake, Spark and MySQL use `COUNT(CASE WHEN … THEN 1 END)` / `AVG(CASE WHEN … THEN x END)`, and Snowflake also `COUNT_IF`. `LEAST` with a NULL argument returns NULL in Snowflake, BigQuery, MySQL and Spark (PostgreSQL ignores NULLs), so outside PostgreSQL coalesce each argument to a far-future timestamp and map it back. `to_char(ts, 'YYYY-MM')` is `FORMAT_TIMESTAMP('%Y-%m', ts)` in BigQuery, `TO_CHAR` in Snowflake, `date_format(ts, 'yyyy-MM')` in Spark, `DATE_FORMAT(ts, '%Y-%m')` in MySQL. None of these variants is executed here.

**Edge cases built into the data.** All levels: a mute exactly at `licence_end` (on time, not a lapse), mutes before the end (not a lapse), a late mute, a video never muted (still playing), a licence ending after the snapshot (ignored), and an original sound with videos but no licences. Hard adds a third region, duplicate mute rows from retries (an on-time mute followed by a retry after the end; a late mute followed by a later retry), a video muted in other regions but not in the lapse's region, videos removed before the end (excluded) and after it but before the mute (ended by removal, counted only in `video_lapses`), and a video published after the end. Very Hard adds renewals: one starting exactly at the old end and one overlapping it (no lapse), renewals after a gap of hours (the lapse ends at the renewal's start when that comes before a mute), and a second lapse after a short renewal, at which videos muted during the first lapse no longer count.

**Common mistakes.** Treating a mute at exactly `licence_end` as late (`<` instead of `<=`); including licences that end after the snapshot; averaging hours over still-playing lapses using the snapshot time; taking the latest mute row; joining mutes on video only, so a mute in another region counts; ignoring removals; counting videos published after the end; treating every licence end as a lapse; not ending a lapse at a renewal after a gap; treating a renewal at exactly the old end as a gap. Each has a diagnostic. Also common: an INNER JOIN to `video_mutes` (never-muted videos vanish), `COUNT(DISTINCT video_id)` (a video's two lapses counted once), and `now()` instead of the snapshot time.

**Follow-up guidance.** (1) Filter lapses with `stopped_at IS NULL` or `stopped_at > lapsed_at + interval '2 hours'` and `lapsed_at + interval '2 hours' <= as_of`; group by region and licence. (2) Effective-dated group membership expanded at grant time into per-region licence rows; the lapse definition is unchanged once expanded. (3) Maintain a "currently playing" set per sound and region, partitioned by sound; schedule mute work per (sound, region) at the end instant; measure lag. (4) Restoration as `video_unmutes (video_id, region, unmuted_at, licence_id)`; "muted" becomes an interval; a video can then lapse again at a later end, and hours are computed per interval.

**Rubric anchors.** 2: counts lapses from mute rows alone, or misses never-muted videos, or uses inclusive windows. 3: matches the expected result. 4: also designs the alert, the precomputed playing set at scale and the restoration model, and explains the half-open boundary unprompted.

**Strong signals.** States the coverage test before writing the query; reduces mutes to the earliest per region first. **Red flags.** `now()` in a reproducible report; an INNER JOIN that drops unmuted videos; hours averaged over lapses that never ended.
