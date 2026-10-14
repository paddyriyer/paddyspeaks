# Spotify · Loop 3 — evaluator notes (hidden from candidates)

## SPT-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity.** `playlists (playlist_id, kind editorial|personalised|user|collaborative, owner_id NULL, generator_id NULL, created_at, deleted_at NULL)`. Editorial market variants are `playlist_variants (playlist_id, market, variant_id)` sharing most entries, or one playlist per market linked to a parent; both are fine if "the editorial playlist" can be reported across markets. Personalised playlists are one logical playlist per listener (`playlist_id` keyed by listener and playlist family), never visible to others.
- **Entries.** `playlist_entries (entry_id, playlist_id, item_id, added_by, added_at, removed_at NULL, sort_key)`. The entry id identifies one occurrence, so the same track twice is two entries. Order is a sortable key (fractional or lexicographic keys between neighbours) so a move rewrites one row, not all positions.
- **Edits and versions.** `playlist_edits (edit_id, playlist_id, version_no, actor_id, op add|remove|move|visibility|rename, entry_id, before_key, after_key, server_ts, client_ts)`, append-only and ordered by a per-playlist version number assigned by the server (optimistic concurrency: an edit names the version it was based on). `playlist_versions (playlist_id, version_no, valid_from, valid_to, source edit|generation_run|editor_publish)`. Contents at time T = replay edits up to the version valid at T, accelerated by periodic checkpoints (full entry list every N edits or daily).
- **Generated playlists.** `generation_runs (run_id, generator_version, scheduled_for, status, superseded_by NULL)` and the run's output as entry rows tagged with run_id. A re-run is a new run; which run each listener actually received is a fact of delivery (`playlist_versions.source = generation_run, run_id`), never an overwrite.
- **Plays.** Play events carry `context_playlist_id`; attribution joins on `valid_from <= play_started_at < valid_to` to get the version, no copy of contents per play. `fct_playlist_plays_daily (date, playlist_id, market, version_no, plays, listeners)` for editorial playlists; personalised playlists only in aggregates across listeners (per playlist family and day).
- **Follows.** `playlist_follow_events (playlist_id, listener_id, op, at)`; `fct_playlist_followers_daily` derived from events (end-of-day state), with the live count as a cache reconciled nightly.
- **Storage.** {{daily_edits}} edit rows a day of tens of bytes each is small; full snapshots per edit (an average playlist of ~50–100 entries rewritten per edit) would be 50–100× larger. Checkpoints plus edits, partitioned by date and clustered by playlist, with older checkpoints thinned beyond a year and everything dropped after {{history_years}} years.
- **Deletion.** Deleting an account deletes its user-made playlists, their edits and follow events after the policy's grace period; aggregates already published keep the counts (they contain no identity) and are labelled as such; in collaborative playlists the member's edits are attributed to a "removed member" pseudonym or deleted per policy, while the playlist's current entries remain for the other members.

**Competing designs to accept.** Snapshots per version with structural sharing (content-addressed entry lists) instead of an edit log. A document store holding the current playlist plus an event log for history. Positions as integers with a rebalancing step, if the cost of moves and the history representation are discussed. Event sourcing with periodic snapshots.

**Bottlenecks and failure modes.** Positions as dense integers (one move rewrites hundreds of rows, history unreadable); snapshot-per-edit storage; client timestamps ordering concurrent edits; generator re-runs overwriting the run listeners saw; follower count as an un-reconciled counter; plays attributed to the current version rather than the one live at play time; duplicates of one track collapsed by using item_id as key.

**Incident guidance.**
- *Personalised run redone in place*: the overwrite destroyed the record of what listeners saw. Contain: stop attribution jobs for the affected window; restore the original run from the raw generation output or backups if available, otherwise mark that period's attribution as unreliable. Guardrail: generation runs immutable with run ids, re-runs as new runs, and delivery records naming the run each listener got ({{personalised_refresh}} refreshes multiply the damage of each overwrite).
- *Snapshot table outgrew the estimate under rapid re-orders*: switch to edit log plus checkpoints, coalesce bursts of moves by the same editor into one version for history display while keeping the raw edits, and alert on edits per playlist per hour against the {{daily_edits}} baseline.
- *Remove before add in collaborative history*: ordering by client clocks. Order by the server-assigned version number; keep client time only as an attribute; reject an edit based on a stale version and let the client rebase.

**Follow-up guidance.** (1) Entries with sort keys, versions with validity, reconstruction from the nearest checkpoint plus edits. (2) Server versioning; second edit rebases or conflicts; history shows server order. (3) Item list per run with run id (one row per entry per listener per run); listeners × ~30–50 entries per refresh, retention shorter than editorial history. (4) Interval join on valid_from/valid_to; a play a few seconds after the re-order joins the new version, which is correct if the client fetched it; strong answers note client caching lag. (5) Delete owned playlists and personal edits; aggregates keep counts; collaborative playlist keeps entries, attribution anonymised.

**Rubric anchors.** 2: one table playlist_id, position, track_id overwritten in place; no history. 3: entries with occurrence ids, versions or edit log, validity intervals for play attribution, follows as events. 4: also concurrency control on collaborative edits, immutable generation runs, a storage estimate with checkpoints, privacy of personalised playlists and deletion handling.

**Strong signals.** Asks what "version" means for each kind before drawing tables; notices the duplicate-track case. **Red flags.** Copying the playlist into each play event; positions as dense integers with no move strategy; showing one listener's personalised playlist in analysis at listener level.

## SPT-L3-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Items.** A shared `items (item_id, kind episode|audiobook_edition)`; kinds never share a measure without a label.
- **Podcasts.** `shows (show_id, title, publisher_id)`, `seasons (show_id, season_no)`, `episodes (episode_id, show_id, season_no NULL, episode_type full|trailer|bonus, duration_ms, published_at, removed_at NULL)`.
- **Audiobooks.** `works (work_id, title, original_language)`, `editions (edition_id, work_id, publisher_id, language, abridged bool, runtime_ms, release_version)`, `series (series_id, title)` with `series_members (series_id, work_id, position)`, `contributors (contributor_id, name)` and `credits (contributor_id, work_id NULL, edition_id NULL, role author|narrator|translator|host)`.
- **Chapters.** `edition_chapters (edition_id, release_version, chapter_no, title, start_ms, end_ms)`: ranges over the edition's audio. A re-delivery creates a new release_version; progress is stored as `position_ms` in the edition, mapped through an alignment table (`release_alignment (edition_id, from_version, to_version, from_ms, to_ms, offset_ms)`) when the audio itself changed.
- **Rights.** `availability (item_id, market, channel plan_included|purchasable, valid_from, valid_to)`.
- **Progress.** `listening_progress (listener_id, edition_id, position_ms, updated_at, device_id)`, last-writer-wins by the event time of the latest play, with the history in segments.
- **Allowance ledger.** `allowance_periods (listener_id, period_start, period_end, granted_ms)` reset on the billing date in the listener's time zone; `allowance_usage (usage_id, listener_id, period_start, edition_id, listened_ms, occurred_at, reported_at, source online|offline)`; `allowance_topups`. Usage is assigned to the period in which listening occurred. Remaining = granted + top-ups − Σ usage; the displayed balance is the online number minus a conservative estimate for devices known to be offline, and is reconciled when they upload.
- **Entitlements.** `purchases (listener_id, edition_id, purchased_at)`: permanent, checked before plan availability. Minutes after purchase never create usage lines; minutes before stay where they were.
- **Facts.** `fct_spoken_listening_daily (date, market, item kind, show_id | work_id, edition_id, minutes_content, minutes_listened)` (content minutes = audio covered; listened minutes = wall time, which differ at speed ≠ 1); `fct_allowance_monthly (plan, period, listeners, granted_hours, used_hours)`; "started under allowance then purchased" from usage lines joined to purchases.

**Competing designs to accept.** Separate catalogues joined by a conformed item dimension. Chapters stored as a JSON array per edition release, if progress is position-based. Allowance as a counter in an online store with the ledger as its audit log, if reconciliation is explicit.

**Bottlenecks and failure modes.** One audiobooks table (editions collapse, narrators lost); progress stored as chapter id; allowance counted by upload time; purchases checked against plan availability; content-time and listening-time confused; rights without validity intervals.

**Incident guidance.**
- *Offline usage charged to the new period*: usage was attributed by upload time. Re-attribute by occurred_at to the period in which it happened, refund the wrongly charged minutes in the new period, and tell affected listeners on the {{included_hours}}-hour allowance. Guardrail: period assignment by occurrence time with a test for uploads across a reset.
- *Re-delivered edition, resume mid-sentence*: positions were carried over unadjusted. Build an alignment between releases (or map by chapter start plus offset within chapter), migrate progress, and keep the old release's chapter table for published reports. Guardrail: a re-delivery with a runtime change cannot go live in any of the {{markets}} markets without an alignment.
- *Purchased titles shown unavailable*: entitlement check order was wrong. Purchases first, plan availability second; add a monitor for "purchased but blocked" plays.

**Follow-up guidance.** (1) Work → editions → credits; hours for the book = sum over its editions' facts. (2) Position-based progress plus alignment; published chapter reports keep their release version. (3) By occurrence time; the listener's balance showed an estimate meanwhile; strong answers say what happens if the old period is already exhausted (allow overage or deduct carefully, stated as a policy). (4) Continue only by purchase or in another plan; analytics record a stop reason "left plan". (5) Ledger totals per plan and month reconcile to the sum of per-listener lines; one check query.

**Rubric anchors.** 2: one catalogue table with a type column, chapter-based progress, a remaining-hours counter. 3: works/editions/series/contributors, position-based progress, rights intervals, an allowance ledger with occurrence-time attribution, permanent purchases. 4: also re-delivery alignment, offline estimates in the displayed balance, content vs listened minutes, and reconciliation of plan totals.

**Strong signals.** Asks how allowance is measured before modelling it; separates the work from editions unprompted. **Red flags.** Charging usage by upload time; purchase entitlements depending on plan rights; mixing episodes and chapters in one unlabelled minutes measure.

## SPT-L3-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Profiles.** `artists (artist_id, display_name, created_at, status active|merged|split_source)`, `artist_id_map (old_artist_id, new_artist_id, event merge|split, effective_at, scope)`; a merge maps both ids to the survivor; a split creates a new id and maps chosen releases to it from a stated date.
- **Claims and access.** `artist_claims (artist_id, claimant_org, verified_at, revoked_at)`, `artist_team_members (artist_id, user_id, role admin|editor|reader, granted_at, revoked_at)`.
- **Credits.** `track_credits (track_id, artist_id, role primary|featured|songwriter|producer, credit_order, valid_from, valid_to, source_delivery_id)`. Stream credit goes to primary and featured roles only (this exercise's rule).
- **Streams to artists.** From counted streams `fct_streams (date, track_id, listener_id, country, city)` (internal, not exposed to artists), build `fct_artist_daily (date, artist_id, streams, listeners, saves, follows_net)` by joining credits valid on the date; streams are additive across tracks, listeners are distinct per artist and day (and recomputed for 7- and 28-day windows, never summed). A listener of a track with a featured artist counts once for each artist.
- **Follows.** `artist_follow_events (artist_id, listener_id, op follow|unfollow, event_id, occurred_at)`; current state per (artist, listener) from the latest event by occurred_at with event_id dedupe; `fct_artist_followers_daily` from end-of-day state. The live number on the profile is a cache, overwritten by the daily recomputation; merges map events through `artist_id_map` and take the union of distinct followers.
- **Suppression.** Breakdown cells below {{min_listeners}} listeners are suppressed; to prevent differencing, suppress at least one complementary cell (or publish an "other" bucket that is itself above threshold), compute country totals and city cells from the same snapshot, and refresh them atomically.
- **Restatement.** Merges and splits apply to history by default for profile pages (the artist is one entity), with an artist-facing notice and an audit of numbers before and after; credit corrections apply from their stated date unless the rights holder states otherwise.

**Competing designs to accept.** Recomputing artist aggregates from scratch daily (simple at the given scale with a columnar engine) rather than incremental maintenance. A graph store for profile identity. Applying merges only forward, if what artists see is explained.

**Bottlenecks and failure modes.** A single artist_id on the track; summing listeners across tracks or artists; follower counters with out-of-order events; merges done by updating ids in place (no way back); splits without a release mapping; suppression without complementary cells; country and city refreshed at different times.

**Incident guidance.**
- *Mistaken merge of two artists*: reverse it via the id map (the merge was an event, so the pre-merge mapping is known); follows that arrived during the merge week (about {{daily_follows}} a day overall) cannot be attributed with certainty, so keep them on the survivor and offer listeners a re-follow prompt, or attribute by the release the follow came from where that signal exists. Guardrail: merges of profiles with different claimants require review.
- *Credits re-delivery applied to all history*: apply from the delivery's effective date instead; restate past numbers only on the rights holder's request with a notice. Monitor large day-over-day changes per artist after deliveries touching {{featured_share}} of a catalogue.
- *Differencing reveals a suppressed cell*: totals and breakdowns from different snapshots. Publish both from one snapshot, add complementary suppression, and test that no published cell below {{min_listeners}} can be derived.

**Follow-up guidance.** (1) Three credit rows; the stream appears once in each of three artists' facts; listeners distinct per artist. (2) Union of distinct followers; past numbers per the stated restatement policy. (3) Split by release mapping; follows stay with the original profile unless a signal exists; tell both artists. (4) City cell = country − Σ other cities unless a complementary cell is suppressed or an "other" bucket is published. (5) Credits by validity date; numbers change from the effective date; an audit table lists changed artist-days.

**Rubric anchors.** 2: artist column on tracks, follower counter, listeners summed. 3: credit bridge with roles, id map for merges, follow events with derived counts, distinct listeners per artist, threshold suppression. 4: also splits, complementary suppression with one snapshot, restatement policy and team access controls.

**Strong signals.** Distinguishes additive streams from distinct listeners immediately; treats merges and splits as reversible events. **Red flags.** Exposing listener-level data to artists; rewriting artist ids in place; suppression that a subtraction defeats.

## SPT-L3-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Devices.** `devices (device_id, device_type, platform, first_seen_at)`, `device_app_versions (device_id, app_version, valid_from)`; accounts are on events, so shared devices need no owner.
- **Raw events.** `playback_events (event_id, device_id, account_id, session_id, seq_no, event_type start|progress|pause|resume|seek|skip|stop|transfer_out|transfer_in|remote_command, item_id, position_ms, client_ts, received_at, private_session, offline bool, controller_device_id NULL)`, append-only, partitioned by received date. Dedupe on (device_id, seq_no) as well as event_id, because a resend can mint new event ids.
- **Event time.** Order within a device by seq_no; estimate the device's clock offset from received_at for online events (median of received_at − client_ts per device and day) and correct client_ts; offline events keep corrected client time with an "uncertain" flag.
- **Segments.** `playback_segments (segment_id, account_id, device_id, item_id, started_at, ended_at, start_position_ms, end_position_ms, private_session, offline, session_id)`: built per device by closing a segment on pause, stop, skip, seek, transfer or a progress gap. Only the player emits segments; remote commands go to `remote_commands (command_id, controller_device_id, target_device_id, command, at)` and never create plays.
- **Sessions.** `playback_sessions (session_id, account_id, private bool, started_at, ended_at)`: the private flag lives on the session, and a transfer carries the session id, so the new device inherits it. Personalisation and social consumers read through a view that filters `private = false`, with a test that runs on every release.
- **Facts.** `fct_listening_daily (date, device_type, item_kind, online|offline, minutes, plays, listeners)`, `fct_handoffs_monthly (month, from_type, to_type, handoffs)`, offline share. Offline plays are attributed by occurrence date; late arrivals after a close go to a restatement table and a published adjustment, not a silent rewrite.
- **Access.** Each listener's own history is served from their own segments; every other consumer reads aggregates; artists receive counts only.

**Competing designs to accept.** Stream processing that builds segments in near real time with a late-data window plus a daily batch rebuild for late offline uploads. A session-centric model where segments are children of sessions. Using server receive time only (with clear limits for offline plays).

**Bottlenecks and failure modes.** Ordering by client clocks; counting plays on the controller and the player; private flag on the device rather than the session; offline plays counted on upload day; resends deduped only by event id; progress events spanning midnight split into two plays.

**Incident guidance.**
- *Controller phones emitting play events*: duplicate plays on speakers. Contain by rolling back the release and excluding events from that app version where `controller_device_id` is set; restate affected days for the {{device_mix}} mix; guardrail: a contract test that controller devices produce only remote commands, and a monitor on plays per active device.
- *Weeks of offline plays after {{offline_days}} days*: by design these attribute to when they occurred; publish a restatement of the closed month with the delta per device type, or a stated policy of late adjustments in the current month, and show both numbers' provenance.
- *Private flag lost after handoff*: the flag lived on the device. Move it to the session carried on transfer; purge the leaked plays from personalisation inputs and recompute affected outputs; add a release test for transfers in private sessions.

**Follow-up guidance.** (1) Phone segment, transfer events, speaker segment(s) with controller commands, pause closes a segment, car segment after transfer. (2) On the session, enforced by a filtered view at the consumer boundary, plus a release test and a periodic audit query. (3) Restate or adjust, per stated policy; reports say which. (4) Event time and day attribution skew; fix with seq_no ordering plus offset estimation. (5) Incremental segment building keyed by device with a watermark and a late window; segments spanning midnight are cut at the day boundary for daily facts while the segment stays one entity.

**Rubric anchors.** 2: one events table queried directly, client time, plays counted wherever an event appears. 3: raw → segments → facts, player vs controller, dedupe, offline by occurrence, private flag carried. 4: also clock-offset correction, resend handling by sequence number, restatement policy, and enforcement of the private flag at consumer boundaries.

**Strong signals.** Separates player from controller without being asked; puts the private flag on the session. **Red flags.** Trusting device clocks; offline plays counted on upload day; any consumer other than the listener seeing a listener's history.

## SPT-L3-05

**Reference solution** (PostgreSQL; `{{tol_ms}}` is the instance's tolerance in milliseconds)

```sql reference
WITH ordered AS (
  SELECT s.*,
         LEAD(s.segment_id) OVER (PARTITION BY s.listener_id
                                  ORDER BY s.started_at, s.segment_id) AS next_segment_id
  FROM playback_segments s
), pairs AS (
  SELECT a.listener_id,
         da.device_type AS from_device_type,
         db.device_type AS to_device_type,
         to_char(b.started_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month
  FROM ordered a
  JOIN playback_segments b ON b.segment_id = a.next_segment_id
  JOIN devices da ON da.device_id = a.device_id
  JOIN devices db ON db.device_id = b.device_id
  WHERE b.device_id <> a.device_id
    AND b.item_id = a.item_id
    AND b.started_at >= a.ended_at
    AND b.started_at <= a.ended_at + INTERVAL '10 seconds'
    AND ABS(b.start_position_ms - a.end_position_ms) <= {{tol_ms}}
    AND NOT a.private_session
    AND NOT b.private_session
)
SELECT month, from_device_type, to_device_type,
       COUNT(*) AS handoffs,
       COUNT(DISTINCT listener_id) AS listeners
FROM pairs
GROUP BY month, from_device_type, to_device_type
ORDER BY month, from_device_type, to_device_type;
```

**Explanation.** "The next segment" is a window function: LEAD over each listener's segments ordered by started_at with segment_id as the tie-break gives exactly one candidate per segment. Joining that candidate back gives both rows; every condition is then a plain predicate. The private-session filter is applied to the pair, after LEAD, because a private segment still sits between two public ones. Device ids are compared (two phones are two devices); device types are only reported. The month comes from B, the segment in which playback continued.

**Complexity.** One sort (or an index scan) by (listener_id, started_at, segment_id) for the window, then hash joins to the next segment and the small devices table, and a hash aggregate. Linear in segments after the sort; the self-join over all later segments is quadratic per listener and wrong besides.

**Dialect notes.** Snowflake and BigQuery support LEAD with the same frame; they can also return the next row's columns directly (`LEAD(device_id) …`, `LEAD(started_at) …`), avoiding the join back. Month text: `TO_CHAR(ts, 'YYYY-MM')` in Snowflake, `FORMAT_TIMESTAMP('%Y-%m', ts, 'UTC')` in BigQuery, `date_format(ts, 'yyyy-MM')` in Spark SQL, `DATE_FORMAT(ts, '%Y-%m')` in MySQL 8. Interval arithmetic: `DATEADD(second, 10, ts)` (Snowflake), `TIMESTAMP_ADD(ts, INTERVAL 10 SECOND)` (BigQuery), `ts + INTERVAL 10 SECONDS` (Spark), `ts + INTERVAL 10 SECOND` (MySQL). `NOT a.private_session` works on a BOOLEAN column in Snowflake, BigQuery and Spark; in MySQL the flag is usually TINYINT, so write `a.private_session = 0`. None of these variants is executed here.

**Edge cases built into the data.** A gap of exactly 10 seconds (counts) and of 11 seconds (does not); a position difference of exactly the tolerance (counts) and of the tolerance plus 1 ms (does not); a restart far behind the previous end position (fails only because of ABS); two devices of the same type (counts as type → same type); a handoff whose A ended before midnight on the first of a month and whose B started after it (counts in the new month); a different item started on another device near the same position (not a handoff); a same-device resume (not a handoff); a handoff into a private session (excluded). Hard adds a brief same-device resume between A and the other device (only the resume → other device step counts) and occasional private segments. Very Hard adds public → private → public across three devices within 10 seconds: no handoff is reported, but removing private segments first fabricates one.

**Common mistakes.** Exclusive boundaries on the gap or the position; counting same-device resumes; comparing device types instead of device ids; not comparing the item; dating by the segment that ended; no position check, or no ABS; including private segments; (Hard+) matching any later segment instead of the next; (Very Hard) filtering private segments before LEAD. Each has a diagnostic.

**Follow-up guidance.** (1) `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM b.started_at - a.ended_at))`; it needs a sort per group, so at volume use an approximate percentile or a histogram of whole seconds (only 11 possible values here, so an exact histogram is cheap). (2) Denominator from all segments grouped by month and device type with a LEFT JOIN of handoffs; decide whether private segments are in the denominator and say so. (3) Widening to "next item in the queue" would need queue state and invites false positives from ordinary track changes; keep it a separate metric. (4) Process per day with the last segment of each listener from the previous day carried over (a one-row overlap per listener), or compute on segments partitioned by day plus a small boundary window; the month is assigned from B so a month boundary needs no special case beyond that overlap.

**Rubric anchors.** 2: right shape but a self-join over all later segments, or device types compared, or a boundary exclusive. 3: matches the expected result. 4: also explains why private filtering must follow LEAD, handles clock skew in the discussion, and describes incremental computation across day and month boundaries.

**Strong signals.** Reaches for LEAD with a tie-break unprompted; asks whether private segments still count as "next". **Red flags.** `SELECT DISTINCT` to hide duplicate matches from a self-join; comparing timestamps as text; dropping the tie-break so equal start times order arbitrarily.

**Incident guidance.**
- *Car clock a few seconds slow*: B appeared to start before A ended and failed `A.ended_at <= B.started_at`. Strong answers correct device time with a per-device offset estimated from server receive times before building segments, or allow a small negative gap explicitly and label it; they also notice the drop in one device type's handoffs as the signal.
- *Positions in seconds from one release*: a units contract break. Detect with range checks per device type and app version (positions far smaller than durations), quarantine and fix the affected rows by app version, and add a schema contract with units in the field name.
