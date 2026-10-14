# Meta · Loop 3 — evaluator notes

Simulated practice scenarios; every design below is one defensible answer, not a
description of any company's systems. Score other designs on the criteria.

## MET-L3-01

**Reference architecture (one defensible design).**
- **Groups and membership.** `groups (group_id, created_at, membership_version, next_seq)`; `membership_log (group_id, version, change add|remove|leave|admin_grant, account_id, actor_id, at)` append-only; `members_current (group_id, account_id, role, joined_version)` materialised from the log in the same transaction. Every change increments `membership_version` with a compare-and-set, so changes per group are serialised.
- **Devices.** `account_devices (account_id, device_id, linked_at, unlinked_at, device_list_version)`, versioned per account the same way. The "recipient device set" of a group at a moment is a pure function of (membership_version, each member's device_list_version); a digest of it can be carried by a send.
- **Accepting a send.** The request carries `(group_id, client_message_id, membership_version, device_set_digest, per-device ciphertexts)`. In one step on the group's partition: check the versions/digest equal the current ones (otherwise reject with the current version and device list, and the app re-encrypts), assign `seq = next_seq++`, write `sends (group_id, seq, message_id, sender_device, accepted_at, recipient_count)`, and enqueue. `client_message_id` makes a retried send idempotent.
- **Queues.** `device_queue (device_id, group_id, seq, message_id, ciphertext_ref, enqueued_at, expires_at)` keyed by device, ordered by (group_id, seq). An entry is deleted when the device acknowledges, or at `expires_at = accepted_at + {{queue_days}} days`. Ciphertext lives only in the queue.
- **Message info.** `message_info (message_id, recipients, delivered, read, final_at)` plus a compact per-message set of devices already counted (a bitmap over the recipient set's device index, since the set is fixed at acceptance). A receipt `(message_id, device_id, kind)` sets the bit and increments the counter only if the bit was clear; receipts from devices not in the recipient set are ignored. Account-level "delivered" can be derived when the first device of a member acknowledges. Read is "read receipts received", never "unread".
- **Retention.** After acknowledgement the server keeps no per-device record except the bitmap and counters, kept until `final_at` (the last possible expiry) and then dropped or reduced to counters for the sender's view. Membership log entries are kept as long as the group exists (needed to explain changes to members) or compacted to the current view, per policy.
- **Deletion.** Account deletion: remove from `members_current` with a membership change (so later sends exclude them), delete their devices and queues, and keep no identifiers in message info (counts only). Group deletion: drop queues, sends, message info and the log.

**Competing designs to accept.** Server-side fan-out to a per-recipient-account queue that each device drains with its own cursor, if unlink and new-device rules are enforced. An event-sourced membership with snapshots. A sender-key style protocol where the server checks only the member list and the app manages per-device distribution, if the candidate keeps the server-side guarantee that removed members' devices are not sent new messages.

**Bottlenecks and failure modes.** The per-group serialisation point for very active large groups (version check and sequence number on one partition; mitigate with a single-writer per group and batching, since total per-group throughput is human-bounded); fan-out of up to {{group_size}} × {{max_devices}} queue entries per send; receipt storms after reconnects; offline devices pinning entries for {{queue_days}} days; races between membership changes and sends; leaked retention through "temporary" logs.

**Incident guidance.**
- *Stale-version sends accepted in one region*: stop accepting sends without the check (fail closed), identify sends accepted with a version older than the current one at acceptance (both values are on the send record), purge their queue entries for removed members' devices that have not acknowledged, and notify affected groups per policy. Guardrail: the check lives in the storage write (conditional write), not in an optional middleware; a canary test sends with a stale version in every region.
- *"Delivered to" above the maximum*: receipts were counted without per-device dedup. Recompute from the bitmap (or cap at recipients while repairing), make the increment conditional on the bit, and add an invariant check `delivered ≤ recipients`.
- *Expiry in hours*: restore is impossible for ciphertext already deleted; the senders' apps can be prompted to resend for affected devices if the protocol allows it, otherwise the loss is reported honestly. Guardrail: `expires_at` stored as an absolute timestamp computed in one place, with a unit-tested duration type and a monitor on the age distribution of deleted-but-unacknowledged entries.

**Follow-up guidance.** (1) Changes and sends serialise on the group's version: either the send wins (accepted with the old version, includes the member, then removal) or the removal wins (the send is rejected and re-encrypted without them); never both. (2) One writer per group, batched sequence assignment; a {{group_size}}-member group still produces only human-scale message rates; the fan-out is the cost, done asynchronously after acceptance. (3) Entry deleted at expiry; message info shows it as not delivered and becomes final; nothing per-device remains. (4) Membership change (remove), device rows and queue entries deleted, message-info bits for them become irrelevant once final; no identifier kept in aggregates. (5) Dedup by (message, device) bit; unlinked-after-acceptance devices were in the recipient set, so their acknowledgement can count if it arrives before the device's queue is purged at unlink; say which rule you chose.

**Rubric anchors.** 2: a members table updated in place and a messages table with every delivery kept; counters incremented per receipt. 3: versioned membership with a checked send, per-group order, per-device queue with deletion on ack and expiry, deduplicated message info. 4: also concurrency walkthroughs, a precise retention timeline per table, deletion in every table, and guardrails that live in the write path.

**Strong signals.** Separates what the server must know to route from what it chooses to keep; reasons about the race between removal and send. **Red flags.** Keeping message content or delivery history "for analytics"; trusting the client to drop removed members; read receipts treated as "unread".

## MET-L3-02

**Reference architecture (one defensible design).**
- **Online edge store**, sharded by owner id: `edges (owner_id, edge_type friend|follow_out|follow_in|request_out|request_in|block_out|block_in, other_id, created_at, state, version)` with primary key `(owner_id, edge_type, other_id)` and a secondary ordering `(owner_id, edge_type, created_at DESC)` for "newest first". A friendship is two rows (A→B on A's shard, B→A on B's). A follow is also two rows: `follow_out` on the follower's shard and `follow_in` on the followee's, so both "who do I follow" and "who follows me" are one-partition reads.
- **Writes.** Same-shard pairs: one transaction. Cross-shard: write an intent (outbox) row first, then each direction idempotently with the edge's version; a repair job scans intents and reconciles. Readers needing strict symmetry (for example "is A friends with B" used for permissions) read the requester's side and verify the other, or read the version-stamped pair.
- **Blocks.** A block writes `block_out`/`block_in`, deletes friendship, request and follow rows in both directions in the same workflow, and is checked on every read path (privacy before freshness: the block check is a direct lookup, not a cached list).
- **Counters.** `edge_counts (owner_id, edge_type, count)` maintained transactionally for ordinary accounts; for accounts with {{top_followers}} followers, a sharded counter (N sub-rows summed on read) updated asynchronously from the edge change log, reconciled daily against the edge rows, displayed rounded to others.
- **Mutual friends.** Intersect two friend lists (sorted by other_id, so a merge or a hash probe of the smaller list against the larger); cache per pair for a short time; with the 5,000-friend cap the work is bounded.
- **Private accounts.** A follow of a private account starts as `request_out`/`request_in` rows; approval converts them to follow rows in the same workflow as a friendship accept. Switching to public converts pending requests to follows in a rate-limited batch (each an edge change with its own history interval), with the follower counter updated per conversion.
- **History.** `edge_history (owner_id, other_id, edge_type, valid_from, valid_to)` with non-overlapping intervals per pair, built from the ordered change log (ordered by edge version, not by wall clock). As-of query: `valid_from <= T AND (valid_to > T OR valid_to IS NULL)`; count friendships once by taking `owner_id < other_id`.
- **Deletion.** Delete online rows both sides (fan-out job, rate limited and prioritised behind blocks), counters decremented, candidate rows purged, history rows for the deleted account removed or replaced by a non-identifying aggregate (for example daily counts by country), per the stated retention policy.

**Competing designs to accept.** A single canonical row per friendship (smaller id first) plus a per-owner adjacency index, if the candidate explains the read path for both positions. A graph database for the analytics tier, if the online access patterns stay one or two hops and the choice is justified. An event-sourced edge log with materialised adjacency lists.

**Bottlenecks and failure modes.** Cross-shard symmetric writes; high-degree accounts (hot partitions for follower lists, counter contention); bulk conversions when a private account goes public; deletion fan-out; history ordering when changes happen in the same second; caches serving blocked or deleted accounts.

**Incident guidance.**
- *One-direction friendships*: identify edges with no reverse (anti-join on the edge log for the window), complete or remove them according to the intent records, then rebuild the analytics copy for those pairs. Guardrail: outbox plus a continuous symmetry checker with an alert on asymmetry rate; deploy gate on the checker.
- *Deleting an account with {{top_followers}} followers*: throttle the fan-out, run it on a lower-priority queue than blocks, delete in batches per follower shard, and serve the deleted state from the account record immediately so nothing waits on the fan-out. Guardrail: deletion jobs have a rate budget per shard.
- *Overlapping history intervals*: the pipeline ordered by wall-clock seconds; reorder by edge version, rebuild the affected pairs' intervals, add a constraint check (no overlapping intervals per pair) in the history build, and restate the affected day's counts with a note.

**Follow-up guidance.** (1) Readers on the second side see no friendship until repair; permissions should treat a half-written edge as "not friends"; the outbox/repair job converges. (2) Merge or probe the smaller list; with 5,000 it is still a few thousand lookups; cache. (3) Pending requests become follows in a throttled batch (or are kept pending, if the product says so); each conversion is an edge change with history and a counter update; the burst is small next to {{edge_changes}} a day but concentrated on one account's shard, so rate-limit it. (4) Sharded counter plus write buffering; follower list writes spread by sub-partitioning the followee's `follow_in` rows. (5) Interval predicate with `owner_id < other_id`; deleted accounts are absent, so state that the historical number is "as currently retained" or keep a non-identifying daily aggregate.

**Rubric anchors.** 2: one `friends` table with no direction or consistency story; COUNT(*) for followers. 3: directed rows with symmetry handling, blocks applied both ways, counters, history intervals. 4: also high-degree handling, bounded mutual-friend reads, deletion fan-out under load, and ordered history with an overlap check.

**Strong signals.** Starts from the access patterns; separates serving from history; treats block as a privacy guarantee. **Red flags.** Asymmetric friendships visible to readers; recursive graph queries on the online path; deletion handled only with a flag.

## MET-L3-03

**Reference architecture (one defensible design).**
- **Study config.** `studies (study_id, advertiser_id, status, salt, start_at, end_at, post_period_days, objective_events)`; `study_versions (study_id, version, valid_from, budget, creatives, targeting_ref, change_reason)`; `study_cells (study_id, cell_id, holdout_bps, campaign_ids, bucket_from, bucket_to)` fixed at start. Changes are classified: budget and creative create a new version and are reported; cells, splits, salt, population rule and objective are frozen at start (a change means a new study).
- **Population.** Two accepted definitions: (a) everyone in the targeting audience at start (more people, much of it never reachable, noisier but no logging dependency), (b) people who reach an ad opportunity where a study ad would have competed, entering at their first such opportunity (less noise; requires logging the opportunity for both groups at the same point in the delivery flow so entry is not affected by the treatment).
- **Assignment.** `bucket = hash(salt, person_key) mod 10000`; the cell and group follow from the bucket ranges. Deterministic and sticky across devices and surfaces because it depends only on the person key and the frozen salt. Exclusivity among one advertiser's overlapping studies: allocate disjoint bucket ranges of an advertiser-level hash (one salt per advertiser, studies take disjoint ranges), so no lock is needed. `assignments (study_id, person_key, cell_id, group, first_assigned_at)` written once at entry (insert-if-absent) for analysis.
- **Opportunity log.** `study_opportunities (study_id, person_key, cell_id, group, opportunity_at, surface, would_have_competed, served bool, ad_id)` recorded for both groups when the holdout check runs; for holdout people `served` is always false and a served=true row is contamination.
- **Analysis.** `study_conversions (study_id, person_key, cell_id, group, conversions, value)` from conversions between entry and end + post-period. Per cell: conversion rates by group; incremental conversions = test conversions − holdout conversions × (test size / holdout size); interval from the difference of two proportions (or bootstrap); a pre-registered analysis at the end (or a sequential method if interim looks are shown). Multiple cells: compare each to its holdout and adjust for multiple comparisons when comparing cells.
- **Advertiser output.** Aggregates per cell only (people, conversions, incremental conversions, interval), with small-cell suppression; no person keys leave the platform.
- **Deletion.** Delete the person's rows from assignments, opportunities and conversions; final results computed after deletion use the remaining data; already-published interim results are not recomputed per person but are not republished without recomputation.

**Competing designs to accept.** Storing no assignments and recomputing from the hash, if the config is versioned and immutable and the opportunity log records the group. Geographic or time-based randomisation for some objectives, if motivated. Bayesian intervals instead of frequentist, if explained to the advertiser honestly.

**Bottlenecks and failure modes.** The holdout check on every ad opportunity ({{concurrent_studies}} studies to check per request, so a compact per-person bucket lookup is needed); assignment writes at {{population}} people; logging volume for holdout opportunities; config drift (salt or range changes); new surfaces that skip the check; peeking; tiny cells.

**Incident guidance.**
- *Salt rotated mid-flight*: assignments are no longer sticky for the re-randomised share. Contain by restoring the original salt (config is versioned); analyse only people whose stored first assignment is consistent, or report the study as compromised; never silently blend. Guardrail: salt and ranges immutable after start, enforced by the config service; alert when the share of people whose recomputed group differs from their stored group is non-zero.
- *A placement skipped the holdout check*: quantify contamination from opportunity rows with `served = true` in the holdout; the intention-to-treat estimate is biased toward zero (lift underestimated); report the bias direction and size and, if large, rerun. Guardrail: every serving path calls one shared eligibility function; a launch checklist and a contamination monitor per placement.
- *A cell of nine people*: suppress cells below the minimum; add the threshold to the output layer, not the dashboard; review whether the study should have been allowed to launch with that population.

**Follow-up guidance.** (1) Start-of-study population: no treatment-dependent entry, but diluted by unreachable people (more noise); opportunity-based: more precise, needs symmetric logging. (2) Disjoint bucket ranges under an advertiser-level hash. (3) Difference of proportions with an interval; adjust for {{cells}} comparisons; daily peeking inflates false positives, so use a fixed horizon or a sequential test and say so. (4) Budget doubling changes exposure, not assignment; still valid, but the estimate is for the policy as run; version and report it. (5) Delete their rows; final result recomputed without them; interim result marked as superseded.

**Rubric anchors.** 2: exposed vs unexposed comparison; random assignment per request; no config versioning. 3: deterministic sticky assignment, symmetric opportunity logging, intention-to-treat analysis, versioned config. 4: also exclusivity without locks, population trade-offs, peeking and multiple comparisons, contamination quantified, minimisation.

**Strong signals.** Asks how a person enters the study before designing tables; insists on symmetric logging. **Red flags.** "Compare people who saw the ad with people who didn't"; storing assignments in a cache that can be recomputed with a different salt; sending person-level results to advertisers.

## MET-L3-04

**Reference architecture (one defensible design).**
- **Items and media.** `media (media_id, owner_id, storage_ref, created_at)`; `stories (story_id, author_id, media_id, posted_at (server), expires_at = posted_at + 24h, audience_type followers|close_friends, audience_list_version, deleted_at)`; `archive_items (author_id, story_id, media_id)`; `highlights (highlight_id, author_id, title)` and `highlight_items (highlight_id, media_id, from_story_id, added_at)`. Media is referenced, never duplicated; each referencing row has its own visibility.
- **Audience.** `close_friends (author_id, member_id, added_at, list_version)`; `hide_story_from (author_id, hidden_id)`; blocks from the social graph. Read predicate for a viewer V: `now() < expires_at` AND not deleted AND not blocked either way AND V not in hide list AND (followers: V follows author now | close friends: V in the current list; optionally also require V was in the list at `audience_list_version`, if the design chooses "no retroactive additions"). Removals are always evaluated against the current lists, so they apply on the next request.
- **Serving.** The story tray can be cached, but opening a story always re-checks the predicate on the server; media URLs are short-lived signed URLs issued only after the check, so a cached tray entry or an old link stops working within the URL lifetime.
- **Viewer receipts.** `story_views (story_id, viewer_id, first_viewed_at, last_viewed_at, view_count)` with key `(story_id, viewer_id)`, upserted (idempotent under retries and multiple devices); author's own views are not written. For stories with {{top_viewers}} viewers, partition the receipts by `(story_id, hash(viewer_id) mod N)` and page with a cursor ordered by `last_viewed_at`; the viewer count is a separate counter. Receipts carry a TTL of {{viewer_list_hours}} hours from `posted_at`, enforced on read as well as by deletion.
- **Aggregates.** `story_daily_metrics (author_id or country, date, stories, reach, completions, replies)` computed from receipts before the identity TTL, with small-group thresholds for breakdowns; no viewer identifiers.
- **Deletion.** Delete story: the story row (and its receipts); archive and highlight items keep their own references unless the author deletes those too; media is garbage-collected when no reference remains. Delete account: stories, archive, highlights, media, receipts on own stories, **and the account's receipts on other people's stories** (index `story_views` by viewer for this, or keep a per-viewer receipt index with the same TTL).

**Competing designs to accept.** Snapshotting the audience at posting time (fixed recipient list) plus a removal/blocks check at read time; fan-out-on-write of story ids to followers' trays with read-time re-checks; storing receipts in a time-bucketed log that expires by dropping partitions, if per-viewer dedup and author-only access are kept.

**Bottlenecks and failure modes.** Read-time audience checks for {{close_friends_cap}}-member lists (a membership lookup, not a list scan); hot receipts for large accounts; caches and CDN links outliving removals; clock disagreement between regions; TTL jobs failing silently; deletion missing the viewer-side index.

**Incident guidance.**
- *Cached tray let a removed person keep opening a story*: the open path trusted the cache. Contain by invalidating trays for that author on audience changes; fix by re-checking on every open and issuing short-lived media URLs after the check; add a test that removes a viewer and asserts the next open fails.
- *Identity TTL job failed for nine days*: delete the over-retained identities now (by `posted_at` older than {{viewer_list_hours}} hours), record what was over-retained and for how long for the privacy team, and make the read path enforce the TTL so a failed job cannot expose data; alert on the age of the oldest receipt.
- *Regions disagree on time*: expiry was computed with local clocks; compute `expires_at` once at posting from one authority and store it; compare with a synchronised clock and allow no grace period on the visibility side (a grace period on clean-up is fine).

**Follow-up guidance.** (1) Tray shows it until refreshed, but opening it fails because the server re-checks the current list, and media links are short-lived. (2) Bucketed partitions per story and a separate counter; cursor paging by last view time. (3) Highlight item references the media and records `from_story_id`; visibility now follows highlight rules (current followers, blocks); no viewer list. (4) All own content and receipts on others' stories, via a viewer-keyed index. (5) Aggregate within the identity window with thresholds; keep counts by day and country only.

**Rubric anchors.** 2: expiry by deleting rows on a schedule; audience copied at posting with no removal check; receipts as an append-only log of every view. 3: read-time expiry and audience predicate, one receipt per (story, viewer) with TTL, media referenced by story, archive and highlight. 4: also caches and signed URLs, hot-story receipts, deletion in both directions, and aggregates that outlive identities safely.

**Strong signals.** Treats deletion jobs as hygiene, not enforcement; spots the author's receipts in other people's lists. **Red flags.** Device time for expiry; a viewer list readable by anyone with the story id; keeping viewer identities "for analytics".

## MET-L3-05

**Reference solution** (PostgreSQL; `{{start}}`, `{{end}}` and `{{k}}` are the instance's values; the same query serves every level)

```sql reference
WITH pairs AS (
  SELECT DISTINCT r.creator_id, v.viewer_id
  FROM reel_views v
  JOIN reels r    ON r.reel_id = v.reel_id
  JOIN accounts c ON c.account_id = r.creator_id
  JOIN accounts a ON a.account_id = v.viewer_id
  WHERE v.viewed_at >= TIMESTAMPTZ '{{start}}'
    AND v.viewed_at <  TIMESTAMPTZ '{{end}}'
    AND v.viewer_id <> r.creator_id
    AND c.deleted_at IS NULL
    AND a.deleted_at IS NULL
), band_at_end AS (
  SELECT DISTINCT ON (account_id) account_id, age_band
  FROM age_band_history
  WHERE valid_from <= TIMESTAMPTZ '{{end}}'
  ORDER BY account_id, valid_from DESC
), cells AS (
  SELECT p.creator_id, b.age_band, COUNT(*) AS viewers
  FROM pairs p
  JOIN band_at_end b ON b.account_id = p.viewer_id
  GROUP BY p.creator_id, b.age_band
), creators AS (
  SELECT creator_id,
         SUM(viewers)::bigint                     AS total,
         COUNT(*) FILTER (WHERE viewers < {{k}})  AS small_cells
  FROM cells
  GROUP BY creator_id
  HAVING SUM(viewers) >= {{k}}
), ranked AS (
  SELECT c.creator_id, c.age_band, c.viewers, t.small_cells,
         ROW_NUMBER() OVER (PARTITION BY c.creator_id, c.viewers >= {{k}}
                            ORDER BY c.viewers, c.age_band) AS rn
  FROM cells c
  JOIN creators t ON t.creator_id = c.creator_id
)
SELECT creator_id, age_band,
       CASE WHEN viewers < {{k}} THEN NULL
            WHEN small_cells = 1 AND rn = 1 THEN NULL
            ELSE viewers END AS viewers
FROM ranked
UNION ALL
SELECT creator_id, 'all', total
FROM creators
ORDER BY creator_id, age_band;
```

**Explanation.** All eligibility is decided once, in `pairs`: the half-open week, self-views out, deleted viewers and deleted creators out, and `DISTINCT` turns views into people. Each viewer then gets one band, the one in effect at the end of the week. Cells are counted per (creator, band); a creator below k is dropped by the `HAVING` on the creator total, never on cells. Complementary suppression ranks the published cells within each creator (`PARTITION BY creator_id, viewers >= k`), and the first of them is hidden only when exactly one cell is below k. The 'all' row is appended with `UNION ALL`; 'all' sorts after every numeric band.

**Complexity.** One scan of the week's views with two lookups (reel → creator, viewer → account), a distinct on (creator, viewer), one pass over band history, and small aggregates. In production the expensive part is the distinct over billions of views: pre-aggregate daily distinct (creator, viewer) pairs (or per-day sketches with care, see follow-up 4) and union seven days.

**Dialect notes.** `DISTINCT ON` is PostgreSQL only; Snowflake, BigQuery and Spark SQL use `QUALIFY ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY valid_from DESC) = 1` (Snowflake, BigQuery) or a subquery on `ROW_NUMBER()` (Spark SQL, MySQL 8). `COUNT(*) FILTER (WHERE …)` becomes `COUNT_IF(…)` (Snowflake, BigQuery) or `SUM(CASE WHEN … THEN 1 ELSE 0 END)`. A boolean in `PARTITION BY` works in BigQuery and Snowflake; MySQL needs a `CASE`. Timestamp literals: `'…'::TIMESTAMP_TZ` (Snowflake), `TIMESTAMP '…'` (BigQuery, UTC). None of these variants is executed here.

**Edge cases built into the data.** Repeat views by one viewer; a viewer whose only view is exactly at the start (counted); views exactly at the end, before the week and after it (not counted); self-views; deleted viewers whose views all happened before their deletion; a creator with exactly one small band (complementary suppression), a band with exactly k viewers (published); (Hard+) a creator with two small bands (no extra suppression), a creator below k overall (no rows), a tie for the complementary cell, a deleted creator with a large audience; (Very Hard) band changes during the week, one taking effect exactly at the end time (counts), and birthdays after the week (ignored).

**Common mistakes.** Counting views instead of viewers; keeping self-views; keeping views a deleted account made before deleting; `> k` instead of `>= k`; an inclusive end or an exclusive start; no complementary suppression; reporting a deleted creator; keeping a creator below k (or dropping small cells with `HAVING` on cells); the wrong tie-break; using the current band (`MAX(valid_from)` with no time bound) or `valid_from < end`. Each has a diagnostic.

**Follow-up guidance.** (1) Window t and t+1 differ by one day in and one day out; if one band changes from 5 to 4 (published to suppressed) while another stays, the differences can isolate a person. Remedies: publish only fixed, non-overlapping periods, apply suppression consistently across overlapping releases (or to the difference), add noise (differential privacy), or raise k for derived releases. (2) Deletion is a filter at query time until the purge, and a lineage-driven purge of every derived table and cache afterwards with a completion record per table; reports must recompute or expire. (3) Daily `(creator, viewer)` distinct pairs, partitioned by day and creator, with the band attached at query time; drop pairs of deleted accounts. (4) Estimates are noisy around k, so a true count below k can be published; apply the threshold with a margin, use exact counts for small cells (sketches switch to exact at low cardinality), or add calibrated noise.

**Rubric anchors.** 2: right shape but counts views, or misses deletion, or has no complementary suppression. 3: matches the expected result. 4: also explains differencing across overlapping windows, deletion guarantees beyond query filters, and the risk of thresholds on approximate counts.

**Strong signals.** Asks whether deleted accounts' earlier views count; spots the subtraction attack on 'all' before reading the rule. **Red flags.** `HAVING COUNT(*) >= k` on cells only; joining band history without a time bound (one viewer counted in two bands).
