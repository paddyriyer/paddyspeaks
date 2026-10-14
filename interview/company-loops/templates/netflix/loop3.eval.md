# Netflix · Loop 3 — evaluator notes

Hidden until the candidate reveals, or a mock or assessment ends. Simulated practice:
every scenario, number and incident is hypothetical.

## NFX-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **What a title is.**
  - `titles (title_id, kind film|series, original_language, first_release_date)`; `seasons (season_id, title_id, season_no)`; `episodes (episode_id, season_id, episode_no)`. A film has no season or episode rows; a "playable unit" is a film or an episode (`unit_id` with a kind, or a nullable episode on a common table).
  - `title_localisations (title_id, language, name, synopsis, artwork_ref, valid_from, recorded_at)`: localised metadata as versioned rows; a missing language falls back to a stated default.
- **What can be played.**
  - `versions (version_id, unit_id, cut original|edited, runtime_s, published_at)`: immutable; a corrected encode or an edited cut is a new version.
  - `audio_tracks (version_id, language, type original|dub|audio_description, published_at, withdrawn_at)` and `subtitle_tracks (version_id, language, type subtitles|closed_captions|forced_narrative, published_at, withdrawn_at)`. Tracks belong to a version, never to a title.
  - `version_assignment (unit_id, country, version_id, valid_from, valid_to)`: which cut a country gets.
- **Where and when.**
  - `licences (licence_id, title_id, scope seasons[] or film, countries[], signed_at)` normalised into `availability_windows (window_id, licence_id, title_id, season_id NULL, country, start_utc, end_utc, valid_from_recorded, valid_to_recorded)`: one row per (licence, season or film, country). Half-open `[start_utc, end_utc)`, computed from local midnight in the country's catalogue time zone when the window is recorded (store the local date and zone too, so a zone-rule change can be re-derived).
  - **Bitemporal history.** A change never updates a row in place: it closes the old row's recorded interval (`valid_to_recorded = now`) and inserts the new one. "What was playable at T" reads rows current now with `start_utc ≤ T < end_utc`; "what did we believe on D about T" reads rows with `valid_from_recorded ≤ D < valid_to_recorded`.
- **Availability check** for (episode, country, T): exists a window for the episode's title and (its season or the whole title) in that country with `start_utc ≤ T < end_utc`, AND the country's assigned version at T exists and has at least one audio track published by T. Overlapping windows from two licences are fine (an exists test, not a sum).
- **Facts.**
  - `fct_availability_day (title_id, season_id, country, date, is_available, available_hours)`: derived from windows by expanding intervals to days for the affected (title, country) pairs only; rebuilt incrementally from the change log (each window change names the dates and pairs to recompute).
  - `fct_track_coverage_day (country, date, language, track_type, available_hours_with_track, available_hours)`: answers the dub/subtitle share; derived from availability × versions × tracks.
  - Arrivals and departures: windows whose `start_utc` or `end_utc` falls in the next month, from current rows, with the local date for display.

**Competing designs to accept.** Windows at episode grain (simpler checks, many more rows) if the expansion is derived from licences. A single interval table keyed by (unit, country) produced by a rights system, treated as the source, with history kept as an append-only change log rather than bitemporal columns. Range types with exclusion constraints in PostgreSQL to forbid inconsistent overlaps within one licence. Storing the localised metadata in a document store, if keys and versions remain.

**Bottlenecks and failure modes.** Inclusive end dates and local/UTC confusion (off-by-one day in every country); tracks attached at title level; overwriting windows (history lost, past reports drift); full daily rebuild of title × country × day across {{countries}} countries (expensive at {{titles}} titles; do it incrementally); forgetting that a country can get an edited cut whose tracks differ.

**Incident guidance.**
- *Season stayed playable one day after the licence ended*: the end was loaded as inclusive. Contain by correcting the windows (new rows, not edits) and invalidating the availability cache; quantify exposure from plays in `[intended_end, loaded_end)` per country — the list rights asked for. Fix at the boundary: one loader converts local dates to half-open UTC intervals, with a contract test on a known licence; add a daily check that no play occurs outside a current window.
- *Dub offered for every season*: tracks were attached at series level by a tool. Contain by withdrawing the series-level mapping and regenerating the per-version track list; quantify affected plays (audio language chosen ≠ audio track served). Guard with a constraint that tracks reference a version, and a pre-publish check that every advertised language exists on the version for that country.
- *Bulk overwrite changed last quarter's numbers*: history was edited in place. Restore the prior state from backups or the change log into the bitemporal table; reproduce the reported numbers with "as recorded on" reads; make writes insert-only (revoke UPDATE on the window table, or route all changes through a procedure that closes and inserts). With about {{window_changes}} changes a week, an append-only log is small.

**Follow-up guidance.** (1) EXISTS over windows for the title with season = the episode's season or NULL (whole title), country, half-open test; plus the version/track test. (2) Store `end_utc` = local midnight converted (05:00 UTC next day for UTC−5); the daily fact must say which "day" it uses (country-local date is the natural choice). (3) Recompute only the (title, country, date range) pairs named by each change; a nightly full check for drift is fine. (4) Bitemporal read with `recorded ≤ 1 March` for the plan and current rows for the actual; diff the two. (5) The corrected file is a new track row (or a new version), the old one withdrawn with a reason; audits see both.

**Rubric anchors.** 2: one titles table with an "available countries" list or flag, tracks on the title, no history. 3: hierarchy, versions with tracks, windows at season/country grain with half-open intervals, a correct availability check and a daily fact. 4: also bitemporal history (actual versus believed), the local-midnight conversion, edited cuts per country, incremental facts and a convincing account of each incident.

**Strong signals.** Asks at which level a licence applies before drawing tables; states the interval convention unprompted; separates "what we believed" from "what was". **Red flags.** Availability as a boolean column; dubs as an array on the title; end dates stored as inclusive local dates with no time zone.

## NFX-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Entities and history.**
  - `accounts (account_id, country, created_at)`; `account_plans (account_id, plan_id, valid_from, valid_to)` (the plan history itself is modelled in the subscription domain).
  - `profiles (profile_id, created_at, type standard|kids, deleted_at NULL)`; `profile_settings_history (profile_id, maturity_ceiling, language, valid_from, valid_to)`.
  - `profile_membership (profile_id, account_id, valid_from, valid_to, reason created|transferred)`: a profile's account is an interval, so a transfer closes one row and opens another.
  - `extra_members (member_id, host_account_id, login_id, country, valid_from, valid_to)`: an extra member has their own login and profile(s) and is billed through the host account.
  - `devices (device_id, device_type, first_seen_at)`; `device_signins (device_id, account_id, signed_in_at, signed_out_at)`.
  - `household_assignments (account_id, household_id, device_id, valid_from, valid_to, confidence, method)`: coarse placement only; no precise location is stored, and raw network signals are kept briefly (days) and then dropped.
- **Plays.** `plays (play_id, profile_id, account_id_at_play, device_id, household_id_at_play, in_primary_household, extra_member_id NULL, maturity_ceiling_at_play, started_at, ended_at, title_id, episode_id)`. Attribution is **frozen at play time**: the profile selected, and the account and household that held it then. It never changes after the fact, so published metrics are stable without restatement logic.
- **Transfer.** Close `profile_membership`, open a new row on the new account. The profile's history moves with the profile id (personalisation reads by profile). Account-level metrics read `account_id_at_play` and do not change; any "current owner" view is a separate, labelled lens.
- **Deletion.** `deleted_at` set; a deletion job, within the stated deadline (for example 30 days), removes the profile's plays from personalisation stores and raw row-level tables (or replaces the profile id with a tombstone key unlinkable to the account), drops it from the next training snapshot, and records completion per store. Published aggregates keep their counts. Snapshots older than the deadline are expired by retention, not edited.
- **Kids profiles.** Row-level kids data lives in a restricted schema used only by that profile's personalisation; analytics read pre-aggregated facts (by maturity rating, country, day) with a minimum count per cell and no profile ids. Access is granted by role and audited.
- **Facts.** `fct_profile_activity_month (profile_id_hash, account_id_at_play, month, minutes, active)`; `fct_kids_minutes_day (country, date, maturity_rating, minutes, profiles_bucketed)` with thresholds; `fct_plays_household_day (account segment, date, plays, plays_outside_primary)`; "active" defined (for example ≥ 1 play of ≥ 60 s in the month).

**Competing designs to accept.** Looking attribution up through interval joins instead of copying it onto the play, if every lookup is as-of the play time and the cost is understood. Modelling extra members as a special profile type (if billing and login separation are clear). A separate identity graph service. Hard deletion of raw plays versus pseudonymisation, with the trade-off for aggregates explained.

**Bottlenecks and failure modes.** Current-state joins that rewrite history; "user" conflated with profile or account; kids data in general tables; deletion that misses copies (snapshots, features, exports); household signals stored at high precision indefinitely; volume: at {{daily_plays}} plays a day, interval joins at query time are expensive, which is one more argument for freezing attribution at ingestion.

**Incident guidance.**
- *TV release defaulted to the first profile*: attribution was wrong at the source, so freezing it preserved the error. Contain by fixing the client and flagging the affected device/app version and window; repair personalisation (reset or down-weight those plays for the affected profiles) and annotate the metrics for the week rather than guessing the right profile. Guard: a play must carry an explicit profile-selection event id; monitor the share of plays per device on the first profile after releases.
- *Active accounts changed on every rebuild after transfers*: plays were joined to the current account. Rebuild from `account_id_at_play` (or as-of interval joins), compare against what finance used, and publish one documented restatement if they differ. Guard with a test that a closed month's metric is identical across two rebuilds.
- *Household placement change tripled outside-household plays*: a method change moved a device family to a new household id. Record `method` and version on assignments, compare the metric by method, roll back or re-baseline, and gate any enforcement or communication on a stable metric. With about {{devices_per_household}} devices per household, one device family is a large share of plays.

**Follow-up guidance.** (1) Copied: profile, account at play, household at play, device, maturity ceiling at play; looked up: device type, title metadata. (2) A new membership row; old plays keep `account_id_at_play`; last year's report unchanged. (3) Aggregates by rating, country and day with minimum cell sizes and no profile-level output. (4) Raw plays: delete or tombstone; features: purge; last week's snapshot: excluded from the next one and expired by retention; published aggregates: unchanged. (5) Denormalise the at-play attributes; a mid-month household change is just two intervals, and plays carry whichever was in force.

**Rubric anchors.** 2: one users table, profile's current account joined at query time, no deletion or kids story. 3: distinct entities with interval history, attribution frozen on the play, a working transfer and deletion path. 4: also kids-profile governance with thresholds, coarse household signals with retention, stable published metrics, and incident repair that does not guess.

**Strong signals.** Refuses to call a profile a person; separates personalisation data from published aggregates when discussing deletion. **Red flags.** Storing precise location; kids plays in a general table with ad hoc filters; rewriting history on transfer.

## NFX-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Source.** `source_versions (source_version_id, unit_id, picture_lock_at, supersedes_id, change_summary)`: each editorial re-cut is a new source version; `source_change_map` (optional) records which timecode ranges changed, so conform needs can be computed.
- **Orders.** `work_orders (work_order_id, unit_id, language, deliverable_type subtitles|cc|forced|dub|audio_description, source_version_id, ordered_at, needed_by_launch_id)`; `work_order_assignments (work_order_id, vendor_id, assigned_at, unassigned_at)`.
- **Deliveries.** `deliveries (delivery_id, work_order_id, vendor_id, source_version_id_claimed, checksum, storage_ref, uploaded_at)`: immutable; uniqueness on (work_order_id, checksum) collapses duplicate uploads to one delivery (or a `duplicate_of` link).
- **Checks.** `qc_runs (qc_run_id, delivery_id, checked_against_source_version_id, check_suite_version, started_at, outcome pass|fail)`; `qc_findings (qc_run_id, severity, type timing|reading_speed|format|translation|mix, timecode_in, timecode_out, note)`.
- **Decisions.** `approvals (work_order_id, delivery_id, source_version_id, decided_at, decision approved|rejected, reviewer_role)`.
- **Due dates.** `launches (launch_id, unit_or_title, country, launch_at, valid_from, valid_to)` (history); `due_dates (work_order_id, due_at, computed_at, reason)` recomputed whenever a relevant launch changes: earliest launch among countries needing the language minus a lead time per type. Both the due date at assignment and the current one are kept.
- **Derived status** (view over events): no delivery → ordered/overdue; latest delivery without a QC run → in QC; latest QC failed → failed (awaiting re-delivery); approved for the current source version → approved; approved only for an older source version → needs conform; reassigned → back to ordered for the new vendor.
- **Invariant.** A work order is complete only if an approval exists for `source_version_id = current source version of the unit`.
- **Facts.** `fct_delivery (delivery grain: vendor, language, type, attempt_no, qc outcome, dates)`; `fct_work_order (work-order grain: first-pass pass flag, cycle time order→approval, on-time vs due at assignment and vs current due)`; at-risk view: incomplete work orders with due date or launch within 14 days. Vendors read row-filtered views by `vendor_id`.

**Competing designs to accept.** An event log of deliverable state transitions with status as a projection. Storing the due date only at assignment plus a separate "current due" view. One table of "assets" with a type column for deliveries and source versions, if the version references stay explicit.

**Bottlenecks and failure modes.** A mutable status column (loses failures, yield unmeasurable); files overwritten (unreviewable QC); QC that does not record the source version it checked against; due dates copied once; duplicate uploads counted as attempts; vendor views built by copying data per vendor. At {{titles_per_month}} launches × {{languages}} languages × several types, work orders number in the tens to hundreds of thousands a month — modest — but QC findings per timecode are larger; keep them at full grain for a limited time.

**Incident guidance.**
- *Re-cut after approval; QC passed against the old source*: approvals and QC were not tied to the current source version. Contain by pulling or flagging the out-of-sync subtitles in affected countries and re-opening the work orders as "needs conform"; fix QC to always check against the unit's current source version and record it; add the completeness invariant (approval for the current source version) to the launch gate. Impact scales with {{languages}} languages.
- *Every upload arrived twice; yield halved*: duplicates were counted as attempts. Collapse by (work order, checksum), recompute yield, and tell the vendor's manager which numbers were wrong. Guard with the uniqueness rule and a monitor on duplicate checksum rate per vendor.
- *Launch moved earlier; at-risk report stayed green*: due dates were copied at assignment. Recompute due dates from launch history, re-run the at-risk report, escalate the real risks, and keep both due dates so the vendor is judged fairly (on the date they were given, with the change noted).

**Follow-up guidance.** (1) Status as a function of the latest delivery, its QC, approvals and the current source version (state machine in a view). (2) Judge on the due date in force when the order was placed or last accepted, and report against the current one separately. (3) A new source version row; approvals for the old one stop satisfying the invariant; work orders with timed deliverables in changed ranges go to "needs conform"; the at-risk report picks them up. (4) Row-level security or per-vendor views filtered by `vendor_id`; never copies. (5) Delivery and finding grain for months; work-order facts for years.

**Rubric anchors.** 2: one deliverables table with a status column and a due date. 3: orders, immutable deliveries, QC runs with findings, approvals and derived status with clear yield/on-time definitions. 4: also source versions in the key of approvals, conform logic, due-date history from launches, duplicate detection and vendor-scoped access.

**Strong signals.** Asks how a re-cut affects approved work before designing tables; defines first-pass yield precisely. **Red flags.** Overwriting files; status as the only record; ignoring the source version.

## NFX-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Price list.** `plans (plan_id, streams, quality, has_ads)`; `plan_prices (plan_id, country, currency, amount_minor, effective_from, effective_to, announced_at)`: effective-dated, never updated in place.
- **Subscription and plan history (SCD type 2).** `subscriptions (subscription_id, member_id, country, currency, billing_channel direct|partner, partner_id NULL, partner_subscriber_ref NULL, started_at)`; `subscription_plan_history (subscription_id, plan_id, price_amount_minor, valid_from, valid_to, recorded_at, change_reason upgrade|downgrade|price_change|partner_message)`: one row per period in which plan and price are constant. The price is copied onto the row from the price list using the notice rule, so the row states what the member pays.
- **Price change rule.** For each member: new price from the first billing date on or after the effective date, provided the member was notified at least {{notice_days}} days before that billing date (otherwise from the next billing date). Encoded in the job that writes the SCD rows, with the notice record (`price_notices (member_id, change_id, notified_at)`) as input.
- **State machine.** `subscription_states (subscription_id, state active|on_hold|paused|cancelling|ended, valid_from, valid_to, reason)`: transitions with timestamps. Cancel → "cancelling" with access until period end → ended. Payment failure → on hold; success within {{retry_days}} days → active (no churn); otherwise ended with reason involuntary.
- **Billing.** `billing_periods (subscription_id, period_start, period_end, plan_id, amount_minor)`; `invoices`; `payment_attempts (invoice_id, attempt_no, attempted_at, outcome, decline_code)`.
- **Partner feed.** `partner_messages (partner_id, message_id, partner_subscriber_ref, type activate|change|deactivate, plan_id, effective_at, received_at)` with uniqueness on (partner_id, message_id); applied in `effective_at` order per subscriber, idempotently; reconciled daily against the partner's billing file.
- **Facts.** `fct_membership_day` built from intervals (or a monthly snapshot plus intervals): state, plan, price per subscription per day for the window needed; as-of queries via interval joins (`valid_from ≤ d < valid_to`). `fct_membership_movements_day`: gross adds (new subscriptions), rejoins (new subscription for a member who ended earlier), voluntary churn (ended after cancel), involuntary churn (ended after hold expiry); identity: active(d) = active(d−1) + gross adds + rejoins − voluntary − involuntary ± pause transitions (stated). Revenue per currency in minor units; conversion for global totals at a stated rate table.

**Competing designs to accept.** An event-sourced subscription (events as the record, SCD as a projection). Keeping price outside the SCD row and joining to the price list with the notice rule at query time (correct but harder to audit). Monthly snapshots plus change intervals instead of daily facts. Paused as a flag on active rather than a state, if the churn and revenue rules are explicit.

**Bottlenecks and failure modes.** Price changes dated by effective date only; plan as a column overwritten; churn counted at hold start; partner duplicates and out-of-order messages; mixing currencies; daily snapshots of {{members}} members kept forever.

**Incident guidance.**
- *Price applied from the effective date to everyone*: the notice and billing-date rule was not encoded. Recompute the SCD rows for affected members from the price list, notices and billing dates; restate recurring revenue for the affected days with a note; check whether any member was actually billed early (that is a customer issue, not only a report issue) and refund. Guard with a test that no member's price changes before their first billing date on or after the effective date with {{notice_days}} days' notice.
- *Partner resent a month of activations*: messages were not idempotent. Deduplicate by (partner, message id) — and by (partner, subscriber ref, effective time, type) where ids changed — close the duplicate subscriptions, recompute gross adds for that partner, and reconcile to the partner's file. With about {{partner_share}} of members billed by partners, one partner's replay is a visible share of daily adds.
- *Recovered holds counted as churn and re-acquisition*: churn was recorded at hold start or before the retry window ended. Recompute movements with churn only when the {{retry_days}}-day window ends without payment; restate the month; add a test that a hold followed by a payment produces no churn and no gross add.

**Follow-up guidance.** (1) Rows: plan A until the 10th, plan B from the 10th, paused state from the 20th (plan row unchanged or closed, as stated), resumed, then plan C from the next billing date. (2) Members whose billing date in the month is on or after the effective date and who were notified in time pay the new price from that date; revenue on the 15th uses each member's row in force on the 15th. (3) Definitions as above; the identity must hold to the member. (4) Uniqueness on message id, ordering by effective time, last-writer-wins by effective time with a sequence tiebreak, daily reconciliation. (5) Intervals as the source; a monthly snapshot for fast scans plus intervals for days between; partitions by month of valid_from.

**Rubric anchors.** 2: a subscriptions table with current plan and status, churn as cancellations. 3: SCD type 2 plan history, effective-dated prices, a state machine with on hold and paused, partner messages deduplicated. 4: also the notice and billing-date rule encoded, a net-adds identity that handles recovery, rejoins and pauses, currency discipline, and as-of serving without unbounded snapshots.

**Strong signals.** Distinguishes voluntary from involuntary churn and recovery without prompting; treats the partner file as the reconciliation source. **Red flags.** Updating plan or price in place; summing amounts across currencies; counting every hold as churn.

## NFX-L3-05

**Reference solution** (PostgreSQL; `{{gap_minutes}}`, `{{min_episodes}}` and `{{min_view_s}}` are the instance's values — `{{min_view_s}}` is 0 at Medium, where every play is a view)

```sql reference
WITH dedup AS (                                -- one row per play_id: the feed may redeliver
  SELECT DISTINCT ON (play_id) play_id, profile_id, title_id, episode_id, started_at, ended_at, start_reason
  FROM plays
  ORDER BY play_id, received_at
), views AS (                                  -- the end of a play whose stop event was lost
  SELECT d.play_id, d.profile_id, d.title_id, d.episode_id, e.season_no, d.started_at, d.start_reason,
         COALESCE(d.ended_at, d.started_at + e.runtime_min * INTERVAL '1 minute') AS ended_at
  FROM dedup d
  LEFT JOIN episodes e ON e.episode_id = d.episode_id
), kept AS (                                   -- false starts are not views
  SELECT * FROM views
  WHERE ended_at - started_at >= {{min_view_s}} * INTERVAL '1 second'
), flagged AS (
  SELECT k.*,
         CASE WHEN k.episode_id IS NOT NULL
               AND LAG(k.episode_id) OVER w IS NOT NULL
               AND LAG(k.title_id)   OVER w = k.title_id
               AND LAG(k.season_no)  OVER w = k.season_no
               AND k.started_at - LAG(k.ended_at) OVER w <= {{gap_minutes}} * INTERVAL '1 minute'
              THEN 0 ELSE 1 END AS new_session
  FROM kept k
  WINDOW w AS (PARTITION BY k.profile_id ORDER BY k.started_at, k.play_id)
), numbered AS (
  SELECT f.*, SUM(f.new_session) OVER (PARTITION BY f.profile_id ORDER BY f.started_at, f.play_id) AS session_no
  FROM flagged f
), sessions AS (
  SELECT profile_id, session_no,
         MIN(title_id) AS title_id, MIN(season_no) AS season_no,
         COUNT(DISTINCT episode_id) AS episodes,
         COUNT(*) FILTER (WHERE new_session = 0 AND start_reason = 'autoplay') AS autoplay_cont,
         COUNT(*) FILTER (WHERE new_session = 0 AND start_reason = 'chosen')   AS chosen_cont
  FROM numbered
  WHERE episode_id IS NOT NULL                 -- a film is a session of its own and never a binge
  GROUP BY profile_id, session_no
)
SELECT t.title_name, s.season_no,
       COUNT(*)                     AS binge_sessions,
       COUNT(DISTINCT s.profile_id) AS binge_profiles,
       SUM(s.episodes)              AS episodes_in_binges,
       SUM(s.autoplay_cont)         AS autoplay_continuations,
       SUM(s.chosen_cont)           AS chosen_continuations
FROM sessions s
JOIN titles t ON t.title_id = s.title_id
WHERE s.episodes >= {{min_episodes}}
GROUP BY t.title_name, s.season_no
ORDER BY t.title_name, s.season_no;
```

**Explanation.** This is gaps and islands over each profile's whole viewing sequence. Views are cleaned first — one row per `play_id` (Very Hard), the missing end derived from the episode's runtime (Very Hard), plays shorter than the view threshold dropped (Hard and up) — because "the view immediately before" must be computed over views, not raw rows. A view continues a session only if it and the previous view are episodes of the same title and season and the gap from the previous `ended_at` is at most the threshold; any NULL in that test (a film before or after) falls to the ELSE branch and starts a session. A running SUM of the start flag numbers sessions; each session belongs to exactly one (title, season) because the continuation rule requires both to match, so MIN() simply reads them. Distinct episodes decide the threshold and feed `episodes_in_binges`; continuations are the views with `new_session = 0`, so a session's first view is never one, even when it was autoplayed from a previous season's finale.

**Complexity.** One sort of the cleaned plays by (profile, started_at, play_id) for both window functions (they share the ordering), then hash aggregates per session and per (title, season). In production the sort is per profile partition and sessions are computed incrementally with a look-back of the gap threshold into the previous day.

**Dialect notes.** `DISTINCT ON` is PostgreSQL; Snowflake and BigQuery use `QUALIFY ROW_NUMBER() OVER (PARTITION BY play_id ORDER BY received_at) = 1`, Spark SQL and MySQL 8 a subquery on the row number. `COUNT(*) FILTER (WHERE …)` is PostgreSQL (and Spark SQL 3.x); elsewhere use `SUM(CASE WHEN … THEN 1 ELSE 0 END)` or `COUNT_IF` (Snowflake, BigQuery). Interval arithmetic differs: `DATEDIFF('second', prev_end, started_at) <= 60 * N` in Snowflake (counts boundaries crossed, so compare in seconds, not minutes), `TIMESTAMP_DIFF(started_at, prev_end, SECOND)` in BigQuery, `TIMESTAMPDIFF(SECOND, …)` in MySQL, `unix_timestamp` differences in Spark; `TIMESTAMPADD`/`DATEADD` for the runtime end. A named `WINDOW` clause is not available in every engine; repeat the OVER clause. None of these variants is executed here.

**Edge cases built into the data.** A link of exactly the threshold (continues); a gap of the threshold plus one second (new session); a short episode of another series watched between two episodes of a season (ends the session — a per-season partition misses this, because its "previous" play skips the other series); a season finale that autoplays the next season's first episode within seconds (two sessions; the autoplayed first episode is not a continuation); films between runs; sessions with exactly the episode threshold. Hard adds plays under the view threshold between two episodes (dropped, so the session continues), a false start (autoplay started an episode, stopped within seconds, then the viewer chose it), a play of exactly the view threshold (a view), and a rewatched episode that gives a session enough plays but too few distinct episodes. Very Hard adds redelivered rows (same play_id, later received_at) and a mid-session play with a NULL `ended_at`.

**Common mistakes.** Partitioning the window by profile and season (or title), which skips over what was watched in between; measuring the gap from the previous start; comparing whole minutes (EXTRACT(MINUTE …) or a truncated difference); letting sessions cross seasons; counting the first view as a continuation; COUNT(*) instead of COUNT(DISTINCT episode_id); `>` instead of `>=` on either threshold; (Hard+) filtering false starts after sessionising, so they still break sessions; (Very Hard) not deduplicating, or dropping NULL-ended plays because their duration is NULL. Each has a diagnostic.

**Follow-up guidance.** (1) Process day D with a look-back window: read plays from D − (longest plausible session) or carry each profile's open session state (last view's end, title, season, session id) from the previous run; emit sessions only once closed (no view for longer than the threshold). (2) Late plays reopen closed sessions: either recompute affected profiles' sessions for the touched days (keyed by profile and day, MERGE the results) and restate, or freeze sessions after a cut-off and report late plays separately; say which and label the report. (3) Denominator: distinct profiles with at least one view of an episode of that season in the period (or that started episode 1), stated; numerator binge sessions or profiles with a binge — keep units consistent. (4) Signals of engagement after autoplay: a "still watching?" prompt response, interactions, playback position at stop; never infer presence beyond the data.

**Rubric anchors.** 2: sessions per profile and season or start-to-start gaps; right shape, wrong counts. 3: matches the expected result. 4: also explains incremental sessionisation with a look-back, late-arriving plays and a precise binge-rate denominator.

**Strong signals.** Cleans the input before the window function without being told; asks whether a film in between ends a session. **Red flags.** `SELECT DISTINCT *` as deduplication (rows differ in received_at); ordering views by received_at; grouping by (profile, title, season) and calling it back to back.
