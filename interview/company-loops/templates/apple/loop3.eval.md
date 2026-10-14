# Apple · Loop 3 — evaluator notes (hidden from candidates)

## APL-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Catalogue.** `subscription_groups (group_id, name)`; `products (product_id, group_id, level, duration P1M|P1Y|…, family_shareable)`; `product_prices (product_id, storefront, currency, price_minor, valid_from, valid_to)`. Levels are attributes of products, versioned if the developer re-ranks (`product_levels (product_id, level, valid_from)`), because a move between levels is judged by the ranking in force when it happened.
- **Raw notifications.** `store_notifications (notification_id UNIQUE, type, subtype, original_transaction_id, transaction_id, signed_at, received_at, payload)`. Append-only, deduplicated by notification id; this is the evidence everything else is rebuilt from.
- **Chain.** `subscription_chains (chain_id, original_transaction_id UNIQUE, customer_key, group_id, storefront, first_purchase_at)`. One chain per customer and group in this exercise.
- **Billing periods.** `billing_periods (period_id, chain_id, transaction_id, product_id, level, period_start, period_end, offer_type NULL intro|promo, offer_id NULL, price_minor, currency, kind trial|paid, ended_reason renewed|upgraded|expired|refunded|revoked, revoked_at NULL)`. An exclusion constraint (or a scheduled check) enforces no overlap per chain. An upgrade closes the old period at the upgrade instant (ended_reason upgraded) and opens a new one there.
- **Scheduled changes.** `scheduled_changes (change_id, chain_id, from_product, to_product, kind downgrade|crossgrade, chosen_at, effective_at, status pending|applied|cancelled)`. It becomes a period only at renewal.
- **Money events.** `subscription_money (money_id, chain_id, period_id, kind charge|proration_refund|refund, amount_minor signed, currency, occurred_at)`. Proration and refunds are rows, never edits to a period's price.
- **Offers.** `offer_redemptions (chain_id, customer_key, group_id, offer_type, offer_id, period_id, redeemed_at)` plus `eligibility_decisions (customer_key, group_id, offer_id, decided_at, eligible, reason, evidence_redemption_id NULL)`. Intro eligibility = no intro redemption by the customer in the group.
- **Family access.** `shared_entitlements (shared_id, purchaser_chain_id, member_key, valid_from, valid_to, ended_reason)`. Its validity is bounded by the purchaser's entitlement; no money rows ever reference it.
- **Facts.** `fct_entitlement_daily (date, chain_id or member_key, role purchaser|family, product_id, level, storefront, paid flag)` derived from periods and shared entitlements (end-of-day or "any time in the day" — stated); `fct_level_moves (month, chain_id, from_level, to_level, kind, effective_at)`; `fct_offer_conversion (offer_id, storefront, cohort month, converted_by_day_n)`; `fct_revenue_daily` from money events (recognised over the period, proration refunds as negative recognition).

**Competing designs to accept.** Event-sourcing the chain from notifications with periods as a projection (if the projection is rebuildable and ordered by signed date, not arrival). A single "subscription state history" table with valid_from/valid_to per chain instead of periods, if scheduled changes and money stay separate. Treating family members as entitlements on the purchaser's chain rather than separate rows, if they are countable and carry no revenue.

**Bottlenecks and failure modes.** A current-level column overwritten on each notification; applying a downgrade on the day it is chosen; counting trials as paid; intro eligibility per product; summing currencies; revenue on cash date instead of recognised over the period; family members in revenue-per-subscriber denominators; out-of-order notifications applied in arrival order; rebuilding the daily snapshot for all {{subscribers}} chains every night instead of only chains with new notifications.

**Incident guidance.**
- *Overlapping periods from out-of-order upgrade notifications*: contain by marking the affected chains and excluding the overlap from per-level counts (keep the later-signed period for each instant); fix by rebuilding those chains' periods from the stored notifications in signed-date order; guard with an overlap check per chain and a reconciliation that Σ per-level actives = total actives across the {{levels}} levels, which would have paged on day one.
- *Intro offer granted twice after crossgrades*: eligibility keyed by product instead of group. Fix the key to (customer, group); list affected customers from redemptions in all {{storefronts}} storefronts; decide with the business whether to honour the grants (usually yes) and record them as exceptions; add a test that a crossgrade never changes eligibility.
- *Revenue per subscriber dropped by about {{family_share}}*: the denominator changed definition, not the business. Restore the purchaser-only denominator, publish family members as their own metric, annotate the chart, and require a metric definition version on every dashboard tile.

**Follow-up guidance.** (1) Trial period (kind trial, intro offer), paid period at level 3, upgrade on day 10: the level-3 period ends at the upgrade instant with a pro-rata refund row; a full level-1 period starts then; the downgrade is a pending scheduled change that becomes a level-2 period at the next renewal. (2) Paid and entitled at end of day (or any time in the day), excluding trials and family members; a refund revokes from the refund time — past days stay counted, and if the business wants refunded periods excluded retroactively that is a labelled restatement. (3) A move counts when it takes effect; a crossgrade to a yearly product at the same level is a crossgrade (level unchanged), effective at renewal. (4) Snapshot per day from periods with an interval join; only chains with notifications since the last run are rebuilt; a late notification rebuilds that chain's days and the affected daily aggregates. (5) Family access ends when the purchaser's entitlement ends (refund, expiry); a downgrade to a non-shareable product ends it at renewal; revenue per subscriber uses purchasers only.

**Rubric anchors.** 2: one subscriptions table with a current product and status, trials counted as paid, downgrades applied immediately. 3: chain / periods / notifications separated, non-overlapping periods, scheduled changes, intro eligibility per group, money as events, a defined paid-subscriber count. 4: also out-of-order handling by signed date, revocation semantics and restatement, family access without revenue, incremental rebuilds, and each incident guarded.

**Strong signals.** Asks what "active" means at an instant before drawing tables; distinguishes billing from entitlement; notices that eligibility is a group-level fact. **Red flags.** Updating the period's price to apply proration; deriving levels from product names; trusting arrival order of notifications.

## APL-L3-02

**Reference architecture (one defensible design).**
- **Identity.** `devices (device_key, serial, model_id, configuration, manufactured_at)`; `device_replacements (old_device_key, new_device_key, case_id, replaced_at)`; `models (model_id, family, release_date)`.
- **Intervals (bitemporal).** Each table carries valid_from, valid_to (when it was true) and recorded_from, recorded_to (when we believed it):
  - `device_ownership (device_key, owner_key, valid_from, valid_to, start_event_id, end_event_id, recorded_from, recorded_to)`; `owner_key` is pseudonymous; the identity mapping lives in a separate, access-controlled store.
  - `part_installations (device_key, slot display|battery|camera|main_board|…, part_serial, part_condition new|refurbished|harvested, valid_from, valid_to, event_id, recorded_from, recorded_to)`.
  - `coverage (device_key, plan_id, valid_from, valid_to, transferred_from_device_key NULL, recorded_from, recorded_to)`.
- **Events.** `lifecycle_events (event_id, device_key, type activation|transfer|repair|whole_unit_replacement|trade_in|refurbishment|resale|retire, occurred_at, source, source_record_id, received_at)`; `repairs (repair_id, event_id, provider_id, under_coverage, parts_replaced)`. Late records are inserted with their true occurred_at and a later recorded time.
- **Constraints.** No overlapping valid intervals per (device, slot) and per part_serial (current recorded version); one owner per device at any valid time. Enforced by exclusion constraints or a nightly checker on current rows.
- **Facts.** `fct_device_month (month, device_key, model, age_months, in_use, refurbished_flag)`; `fct_repairs (repair_id, device_key, model, age_at_repair, slot, under_coverage, occurred_at, recorded_at)`. The battery replacement rate per 1,000 in-use devices by model and age band uses the month's in-use devices as the denominator; published months are snapshots tagged with the recorded-time cut-off they used.
- **Privacy.** Analysts see owner_key only; erasure deletes the identity mapping (and any personal attributes), so ownership intervals remain as "an owner" with an unlinkable key.

**Competing designs to accept.** An event log as the source of truth with materialised current and historical interval tables (if rebuildable and checked). Uni-temporal intervals plus a separate audit table of corrections, if "as known on" queries can be reproduced. A graph model (device–part–owner edges with time), if the non-overlap rules are enforced.

**Bottlenecks and failure modes.** Owner and part columns on the device row (history lost); late records overwriting intervals; parts keyed by slot without the part serial (cannot detect a part in two devices); whole-unit replacement treated as a new customer device with no link; erasure deleting history; monthly rates recomputed silently after backfills; interval tables at {{devices}} devices queried without indexing on (device, valid range).

**Incident guidance.**
- *Repair feed down for {{late_record_days}} days*: contain by flagging the affected weeks as incomplete for that provider (feed freshness per source on the dashboard); after the backfill publish the restated rate next to the original with the recorded-time cut-off; guard with a completeness check (expected vs received records per provider per day) before a weekly number is used in a review.
- *A display serial in two devices*: the harvest did not close the source installation. Close the old interval at the harvest time (as a new recorded version), re-run the overlap checker, and make the refurbishment workflow write "remove from A" and "install in B" as one transaction; add the per-part-serial overlap check to the pipeline gate.
- *Erasure deleted ownership intervals*: restore the intervals from backup or the event log with a fresh unlinkable owner key; fix the erasure job to delete the identity mapping only; add a test that the next owner's coverage check still sees prior repairs after an erasure, run in all {{markets}} markets' configurations.

**Follow-up guidance.** (1) Ownership A then B then C as intervals; battery and display installations with part serials; the harvested display gets a closing interval in this device and an opening one in the other; trade-in ends B's ownership; refurbishment adds a new display interval; resale opens C. (2) The late repair adds a row with an earlier valid time and a later recorded time; last month's published rate (recorded cut-off) stays; the restated rate is published beside it. (3) A replacement link carries case history and coverage to the new serial; devices in use counts the new serial and retires the old; age can be reported from the original purchase for warranty and from manufacture for quality. (4) Delete the identity mapping and personal attributes; keep intervals with an unlinkable key; C's claim still sees the repair. (5) Devices × slots × a few installations each: billions of rows at the top level; partition by device hash, index (device_key, slot, valid range), keep a current-parts table for support reads.

**Rubric anchors.** 2: one devices table with owner and parts columns updated in place. 3: identity separated from intervals, part serials, events, non-overlap rules, pseudonymous owners. 4: also bitemporal recording, restatement policy, replacement links, erasure that preserves history, and each incident guarded.

**Strong signals.** Asks "true when versus known when" unprompted; puts the part serial, not the slot, at the centre of part history. **Red flags.** Storing owner names in analytics tables; deleting history on erasure; inferring "in use" from device signals the scenario never provides.

## APL-L3-03

**Reference architecture (one defensible design).**
- **Entities with internal keys.** `works (work_id, title, iswc NULL)`; `recordings (recording_id, title, version_type original|remaster|live|radio_edit|clean|…, duration_ms, audio_fingerprint NULL, work_id NULL)`; `releases (release_id, type album|single|ep|compilation|deluxe, upc, release_date, source_id)`; `tracks (track_id, release_id, disc, position, recording_id, valid_from, valid_to)`; `artists (artist_id, name)`; `credits (recording_id, artist_id, role primary|featured|remixer, ordinal)`.
- **Source evidence.** `source_identifiers (entity_type, entity_id, scheme isrc|upc|iswc|source_native, value, source_id, delivery_id, confidence)`. ISRC and UPC are attributes with provenance, never primary keys: one ISRC can (wrongly) label two audio files, and one recording can carry two ISRCs.
- **Deliveries.** `deliveries (delivery_id, source_id, received_at, kind new|update|takedown)` and versioned catalogue rows (valid_from/valid_to) so a takedown ends availability, not existence.
- **Identity layers.** `recording_clusters (cluster_id)` with `recording_cluster_map (recording_id, cluster_id, valid_from, valid_to, decided_by, evidence)` for duplicates of the same audio; `song_map (cluster_id, song_id, valid_from, valid_to)` grouping versions (original, remaster, live) of one work by one primary artist. Merges and splits close and open map rows; nothing is deleted.
- **Plays.** `fct_play (play_id, played_at, listener_key, track_id, …)` at event grain, partitioned by day; it stores what was played (track_id) and nothing derived. Daily aggregates `agg_track_day (day, track_id, plays)` are cheap to keep.
- **Rollups.** recording plays = Σ over tracks of that recording; cluster plays through the map valid at report time (or at play time — a stated choice); song plays through song_map; release plays via track.release_id; artist plays = plays of recordings credited to the artist (each credited artist gets the full play). Totals across artists are never computed by summing artist counts; "total plays" comes from the play fact.
- **Finality.** A month's artist report is a published snapshot with the map version (or valid time) it used. Later merges apply going forward and, if material, through a documented restatement with deltas.

**Competing designs to accept.** Resolving cluster and song ids at ingestion into the play row (fast reads) with a re-key job on merges, if the original track id is kept and restatement is explicit. A graph store for identity with a relational play fact. Weighted artist allocation (1/n per credit) for revenue-like metrics, if counts per artist still give each artist the full play.

**Bottlenecks and failure modes.** ISRC as primary key; denormalising song and artist into each play at {{daily_plays}} a day so merges require rewriting billions of rows; joins to credits multiplying plays in summaries; published months read through the current map; duplicates from {{sources}} sources splitting a song's plays; takedowns deleting rows that old reports reference.

**Incident guidance.**
- *Merge of about {{dup_share}} of recordings changed last month*: the rollup read the current mapping. Re-publish last month from its snapshot (or from the map as of the publish time); apply the merge from its valid time; publish a restatement only if the policy says so. Guard: published reports pin the map version, and a diff check runs before any merge goes live.
- *Radio edits under album ISRCs*: identifiers were trusted over audio. Split the recordings (new recording ids for the edits, using duration or fingerprint evidence), re-point the compilation's tracks, recompute affected song and chart numbers from the track-grain aggregates, and add a check that flags one ISRC mapped to audio of differing durations.
- *Artist totals exceed total plays*: a credit join was summed across artists. Recompute the label summary from the play fact (distinct plays), fence the per-artist table with a "do not sum" contract or a role filter (primary only for totals), and add a reconciliation of the summary against total plays.

**Follow-up guidance.** (1) One work, recordings: original (on single, album and compilation tracks) and remaster (on the deluxe track); 10 plays → recording counts split original/remaster, song count 10, release counts per release. (2) Last month stays as published (or restated with deltas); this month uses the merged cluster from the merge's valid time. (3) Each of the three artists shows the full plays; total plays is the play count, not the sum (which would be 3×). (4) Store the track id; resolve at query time through versioned maps, with daily track-grain aggregates so a merge re-aggregates small tables, not the play log. (5) Detect by duration/fingerprint mismatch under one ISRC; split recordings and recompute from track aggregates.

**Rubric anchors.** 2: one songs table keyed by ISRC, plays joined to it, merges by rewriting. 3: work/recording/release/track separated, internal keys, identifiers as evidence, plays at track grain, versioned mapping for clusters. 4: also song-level grouping distinct from duplicate clusters, credit fan-out fenced, published-month pinning and restatement, and each incident guarded.

**Strong signals.** Separates "same audio" from "same song" without prompting; keeps the play log immutable. **Red flags.** Summing per-artist counts into totals; deleting merged recordings; assuming ISRCs are unique and correct.

## APL-L3-04

**Reference architecture (one defensible design).**
- **Entities.** `apps (app_id, developer_id)`; `app_versions (version_id, app_id, platform, version_string, created_at)`; `builds (build_id, version_id, build_number, uploaded_at)` with UNIQUE (version_id, build_number); `submissions (submission_id, app_id, created_at, submitted_at, expedite_requested_at NULL)`; `submission_items (submission_id, item_type app_version|in_app_purchase|in_app_event, item_id, build_id NULL)`; one build per platform per submission.
- **State history.** `submission_transitions (transition_id UNIQUE, submission_id, from_state, to_state, at, actor_type developer|reviewer|system, recorded_at)`. Append-only, deduplicated by transition id; states are a reference table with a "clock category" (waiting, in_review, with_developer, terminal) so a rename upstream changes a mapping row, not the metric.
- **Review episodes.** `review_episodes (episode_id, submission_id, version_id, entered_queue_at, review_started_at, decided_at, decision approved|rejected|metadata_rejected|developer_removed, is_first_for_version, expedited)`, derived from transitions. A metadata-only fix opens a new episode of the same submission; a new build means a new submission linked by `resubmission_of`.
- **Decisions.** `rejection_citations (episode_id, guideline_ref)` many-to-many; `messages (message_id, submission_id, sender_type, sent_at, content_ref)` stored as references only.
- **Facts.** `fct_review_episode` (one row per episode: wait_hours = review_started − entered_queue; review_hours = decided − review_started; expedited flag; queue-entry week and decision week); `fct_version_outcome` (one row per version: first submission, approval, episodes, resubmissions, total hours with time-with-developer separated).
- **Published statistic.** For a week (by decision date, say), the 90th percentile of (decided_at − entered_queue_at) over non-expedited, non-removed episodes, published with the cohort definition; a week is final after its last episode decides or after a cut-off with open episodes reported.
- **Access.** Developer views filter by developer_id and expose decisions, citations and their messages; reviewer ids exist only in restricted tables and never in published statistics.

**Competing designs to accept.** A state machine per submission with SCD2 rows instead of a transitions table, if durations derive from them. Treating each metadata fix as a new submission, if the link and first-pass rules are explicit. Percentiles via approximate sketches for the platform view, if published numbers are reproducible from stored episodes.

**Bottlenecks and failure modes.** A status column overwritten; averages over skewed durations; first-pass defined per submission; guideline counts summed as rejections; durations tied to raw state names; expedited reviews mixed into the published wait time; duplicate transitions doubling durations; recomputing all history weekly at {{submissions_per_week}} a week instead of incrementally by episode.

**Incident guidance.**
- *Median time in review doubled after a rename*: the duration job keyed on raw state names. Contain by withdrawing or annotating the published number; map the new state into the clock-category table; recompute the affected weeks for {{platforms}} platforms; guard with a check that every observed state has a category, failing the job on an unknown state.
- *First-pass rejection rate collapsed below the usual {{rejection_share}}*: metadata fixes arrived as new submissions and were treated as first passes. Re-link them as episodes of the original submission (by app, version and timing); recompute first pass per version; add a test that each version has exactly one first episode.
- *Expedited reviews flatter waiting time*: publish waiting time for standard reviews (excluding the normally ~{{expedite_share}} expedited) and report expedited volume beside it; alert when the expedited share departs from its baseline.

**Follow-up guidance.** (1) Submission 1 (build 41): episode 1 rejected with two citations; developer reply; submission 2 (build 42, resubmission_of 1): episode 2 metadata_rejected, episode 3 approved, held then released; durations from transitions with with-developer time separated. (2) A stated percentile (e.g. 90th) of queue-entry to decision for standard episodes, by decision week, final after a cut-off. (3) Denominator = versions whose first episode reached a decision; developer-removed before review excluded and reported separately; a metadata fix after a rejection means the first pass was a rejection. (4) Developer history straight from per-developer partitions of episodes; platform percentiles from the episode fact per week, computed incrementally. (5) Exclude or separate expedited episodes from the published standard wait; show both.

**Rubric anchors.** 2: one submissions table with a status and timestamps per status, averages. 3: version / build / submission / episode separated, append-only transitions, durations by event pairs, rates with denominators, guideline citations many-to-many. 4: also clock categories robust to renames, first-pass per version, percentile definition with finality, expedite handling, developer-scoped views without reviewer identity, and each incident guarded.

**Strong signals.** Defines each duration as an event pair before drawing tables; asks about the denominator of every rate. **Red flags.** Averages for skewed durations; reviewer identity in developer views; counting guideline citations as rejections.

## APL-L3-05

**Reference solution** (PostgreSQL; `{{report_end}}` is the instance's report end date)

```sql reference
WITH rel AS (                                   -- one phased release per app, with the phased build
  SELECT l.app_id, l.action_date AS start_date, b.build_number AS phased_build
  FROM phased_release_log l
  JOIN app_builds b ON b.app_id = l.app_id AND b.version = l.version
  WHERE l.action = 'start'
), cal AS (                                     -- every date from the start to the report end
  SELECT r.app_id, g::date AS activity_date
  FROM rel r
  CROSS JOIN LATERAL generate_series(r.start_date::timestamp, TIMESTAMP '{{report_end}}', INTERVAL '1 day') AS g
), st AS (                                      -- state from the latest action on or before the date
  SELECT c.app_id, c.activity_date,
         CASE a.action WHEN 'pause' THEN 'paused' WHEN 'release_all' THEN 'complete' ELSE 'active' END AS release_state
  FROM cal c
  CROSS JOIN LATERAL (
    SELECT l.action FROM phased_release_log l
    WHERE l.app_id = c.app_id AND l.action_date <= c.activity_date
    ORDER BY l.action_date DESC
    LIMIT 1
  ) a
), ph AS (                                      -- phase_day counts active dates only
  SELECT app_id, activity_date, release_state,
         COUNT(*) FILTER (WHERE release_state = 'active')
           OVER (PARTITION BY app_id ORDER BY activity_date) AS phase_day
  FROM st
), win AS (                                     -- the release ends at day 7 or release_all
  SELECT ph.*,
         MIN(activity_date) FILTER (WHERE release_state = 'complete' OR phase_day = 7)
           OVER (PARTITION BY app_id) AS end_date
  FROM ph
), dev AS (                                     -- one row per app, local date and device
  SELECT s.app_id, (s.started_at AT TIME ZONE a.report_tz)::date AS activity_date, s.device_id,
         BOOL_OR(b.build_number >= r.phased_build) AS on_new
  FROM app_sessions s
  JOIN apps a       ON a.app_id = s.app_id
  JOIN app_builds b ON b.app_id = s.app_id AND b.version = s.app_version
  JOIN rel r        ON r.app_id = s.app_id
  GROUP BY s.app_id, 2, s.device_id
)
SELECT w.app_id, w.activity_date, w.phase_day, w.release_state,
       CASE WHEN w.release_state = 'complete' THEN 100 ELSE ps.release_pct END AS release_pct,
       COUNT(d.device_id) AS active_devices,
       COUNT(d.device_id) FILTER (WHERE d.on_new) AS devices_on_new,
       ROUND(100.0 * COUNT(d.device_id) FILTER (WHERE d.on_new) / NULLIF(COUNT(d.device_id), 0), 2) AS share_on_new
FROM win w
JOIN phase_schedule ps ON ps.phase_day = w.phase_day
LEFT JOIN dev d ON d.app_id = w.app_id AND d.activity_date = w.activity_date
WHERE w.activity_date <= COALESCE(w.end_date, DATE '{{report_end}}')
GROUP BY w.app_id, w.activity_date, w.phase_day, w.release_state, ps.release_pct
ORDER BY w.app_id, w.activity_date;
```

**Explanation.** The output is a calendar, not a summary of sessions, so it starts from a date spine built from each app's start date; dates with no sessions and paused dates then appear by construction. The state of a date is the latest action on or before it. `phase_day` is a running count of active dates, which is exactly why a paused date holds the percentage and pushes the end of the release later. The end date depends on that running count, so it is found with a window over the finished calendar and applied as a filter afterwards (a WHERE before the window would change the count). Sessions are reduced to one row per app, local date and device with `BOOL_OR` over "build_number ≥ the phased build", so a device that updated mid-day counts once and as updated, and a hotfix build counts as the new code. `COUNT(d.device_id)` (not `COUNT(*)`) gives 0 on a date with no devices, and `NULLIF` turns its share into NULL. The comparison uses build numbers because version strings do not sort as text ('2.9.6' > '2.10.0').

**Complexity.** The spine is (apps × days); the LATERAL lookup is one index probe per date on (app_id, action_date). The session pass is one hash aggregate to device-day grain, which dominates. In production the device-day rollup (app, date, device, max build) is computed once per day and this report reads only that, so it is days × devices, not sessions.

**Dialect notes.** Not executed here. Snowflake: `GENERATOR`/`ROW_NUMBER` or a calendar table for the spine, `CONVERT_TIMEZONE(report_tz, started_at)::DATE`, `BOOLOR_AGG`, `COUNT_IF`, `IFF`; a correlated "latest action" is usually written as `ASOF JOIN` or `QUALIFY ROW_NUMBER() … = 1`. BigQuery: `GENERATE_DATE_ARRAY` + `UNNEST`, `DATE(started_at, report_tz)`, `LOGICAL_OR`, `COUNTIF`, `SAFE_DIVIDE`; window `COUNTIF(...) OVER (...)`. Spark SQL: `sequence(start, end, interval 1 day)` + `explode`, `to_date(from_utc_timestamp(started_at, report_tz))`, `bool_or`, `count_if`. MySQL 8: a recursive CTE for the spine, `CONVERT_TZ` (needs time zone tables loaded), no `FILTER` clause (use `SUM(CASE …)`), and no `LATERAL` before 8.0.14.

**Edge cases built into the data.** A paused date (and at Very Hard two pauses, up to three days long); a session at exactly local midnight and one at 23:59:59; devices with several sessions in a day and devices that updated mid-day; manual updaters ahead of the schedule; sessions the day before the start and after the end; the report end after the release finished (Medium) so rows must stop at phase day 7. Hard adds several apps, a `release_all` (with or without an earlier pause), an app whose release is cut by the report end, a date with no sessions at all, and devices shared across apps. Very Hard adds per-app time zones (east and west of UTC, sometimes a half-hour offset), a hotfix build after the phased build including a device seen only on the hotfix, and version strings whose text order disagrees with build order.

**Common mistakes.** Counting sessions instead of devices; numbering dates since the start so pauses advance the phase; integer division (`100 * on / active` with integers truncates); not stopping at phase day 7 or `release_all`; (Hard+) starting from sessions or using an inner join so empty dates vanish, or `COUNT(*)` after a LEFT JOIN, which returns 1 for an empty date; (Very Hard) `app_version = phased version` (misses the hotfix), comparing version strings as text, and UTC dates instead of the report time zone. Each has a diagnostic except `COUNT(*)`, which shows as a wrong count on the empty date.

**Follow-up guidance.** (1) Add per-day crash-free session share by build (another fact joined at device-day grain); the phased cohort is not random: automatic-update users differ from manual updaters, and early days are tiny, so compare with confidence intervals and against the same days of previous releases. (2) Devices that updated before the schedule could reach them, or whose sessions show the new build on a day when the cumulative share far exceeds release_pct, point to manual updates; per-device eligibility is not in the data, so the split is only an estimate. (3) Keep a daily device-version rollup (app, date, device, max build); a late session updates that rollup and a published day is either restated with a version or frozen after a cut-off — state which. (4) Count active phase days (not calendar days) to 90%, or report both; exclude or annotate releases that went to `release_all` early.

**Rubric anchors.** 2: a share per date from sessions, but pauses advance the phase or empty dates vanish. 3: matches the expected result at the level asked. 4: also explains why phase days skip pauses, the device-day rollup for scale, and the selection bias of the phased cohort.

**Strong signals.** Builds the date spine first without being told; reduces to device-day grain before counting; compares builds numerically. **Red flags.** `MAX(app_version)` as text; `COUNT(*)` after the LEFT JOIN; filtering the end date before computing the running count.
