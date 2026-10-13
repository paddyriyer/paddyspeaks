# Meta · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a company that runs
social apps, messaging apps and an advertising business. Every workload, number,
schema, threshold and incident is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MET-L3-01: Encrypted group chats — membership versions and per-device delivery state

| | |
|---|---|
| **Template ID** | MET-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Low-level design / versioned membership, fan-out state, idempotent receipts, minimisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "daily_group_messages": {"1": ["300 million"], "2": ["3 billion", "8 billion"], "3": ["30 billion", "60 billion"]},
  "group_size": [256, 512, 1024],
  "max_devices": [2, 4, 5],
  "queue_days": [14, 30]
}
```

**Business Scenario.** A messaging app supports end-to-end encrypted group chats of up to {{group_size}} members; each member can have up to {{max_devices}} devices (a phone plus linked devices). About {{daily_group_messages}} group messages are sent a day. The sending app encrypts each message for a specific set of recipient devices, so the servers never see content, but they do hold what routing needs: groups, members, each account's device list, an opaque message id per send, and acknowledgements from devices. Members join, leave, are removed by admins, and link or unlink devices at any time. A device that is offline keeps its messages queued on the server for up to {{queue_days}} days. The sender can open "message info" to see how many recipients have it delivered and, when receipts are on, read.

**Problem Statement.** Design the data model and the low-level write paths for group membership and delivery state. Cover: how membership and device lists are versioned; how a send is checked against the current membership so that exactly the right devices receive it; ordering within a group; the per-device queue entry, its lifecycle and when it is deleted; how acknowledgements and read receipts update "message info" exactly once; what the server still holds about a message one hour, one day and {{queue_days}} days after it was sent; and what account deletion and group deletion remove.

**Constraints.** A member removed from the group (or a device unlinked) must not be sent any message accepted after the removal. A newly linked device does not receive messages sent before it was linked. Message info reads p99 under 100 ms. The server keeps no message content and no delivery record longer than it needs to deliver and to serve message info.

**Assumptions.** Volumes, limits and the queue duration are hypothetical. How keys are distributed and rotated is out of scope; the model only has to tell the sender which devices to encrypt for and reject a send aimed at the wrong set. Read receipts can be turned off, in which case read events never arrive.

**Clarifications.**
- Q: Two admins change membership at the same moment as a send arrives. Who wins? | A: Membership changes are serialised per group; the send must be judged against one specific membership version.
- Q: What happens to a send encrypted for an out-of-date device list? | A: The server rejects it with the current version, and the sending app re-encrypts for the new set and retries.
- Q: Are messages ordered? | A: Within a group, every member must see accepted messages in the same order.
- Q: How long is message info available? | A: As long as any recipient device can still acknowledge: up to {{queue_days}} days. After that it is final.
- Q: Does a removed member lose messages already on their device? | A: That is device-side and out of scope; the server must only stop sending.

**Hints.**
1. Treat membership as an append-only log of changes with a version number per group, plus a materialised current view. A send carries the version it was encrypted for; accept it with a compare-and-check against the current version.
2. The accepted send gets a per-group sequence number in the same step, which gives one order for everyone.
3. Message info is a small per-message aggregate updated from receipts that are deduplicated by (message, device), not a scan of the queue.

**Follow-ups.**
1. An admin removes a member while a send to {{group_size}} members is being accepted. Walk through both requests and show which devices receive the message.
2. One group of {{group_size}} members with {{max_devices}} devices each is very active. Where do the per-group version check and sequence number become a bottleneck, and what would you change?
3. A device stays offline past {{queue_days}} days. What does its queue entry become, what does the sender's message info show, and what is left on the server?
4. A member deletes their account. List every table that references them (membership log, device list, queue entries, message info) and what happens to each.
5. A receipt arrives twice, and another arrives for a device that was unlinked after the message was accepted. What do your message-info counters do with each?

**Follow-up rules.**
- when: group_members, members table, membership table → ask: Your members table is updated in place. How does a send prove it was encrypted for the membership that was current when it was accepted?
- when: counter, delivered_count, increment → ask: A device's acknowledgement is retried after a timeout. What stops your counter from counting it twice, and how many bytes per message does that cost?
- when: timestamp, sent_at, order by time → ask: Two members send in the same millisecond to the same group. Which order do the other members see, and is it the same on every device?
- when: delivery log, keep, archive, history → ask: A month after a message was delivered, what does the server still know about it, and why does it need to?
- when: fan-out, fanout, per device → ask: How many queue entries does one send to a full group create, and when is each one deleted?

**Production Reality Check.**
- A client release sends with a stale membership version and the server's check is accidentally skipped for one region; for two hours a member removed from groups of up to {{group_size}} people keeps receiving new messages encrypted for their devices.
- After a retry storm, message info shows "delivered to" more devices than a group of {{group_size}} members with {{max_devices}} devices each can have.
- The queue clean-up job uses the wrong unit and deletes undelivered entries after {{queue_days}} hours instead of days; devices that were offline over a weekend never receive those messages.

**Evaluation Criteria.** Versioned membership and device lists with an atomic check at acceptance; a per-group order; per-device queue entries deleted on acknowledgement or expiry; exactly-once message info from deduplicated receipts; read receipts treated as possibly absent; minimal retention stated per table; deletion handled across membership, devices, queues and aggregates; each incident contained with a guardrail that would have caught it.

## MET-L3-02: A social graph edge model for friends, follows and blocks

| | |
|---|---|
| **Template ID** | MET-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / graph edges, symmetric versus directed, edge history |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "accounts": {"1": ["50 million"], "2": ["500 million"], "3": ["2 billion"]},
  "avg_friends": [150, 300, 450],
  "top_followers": ["5 million", "80 million", "400 million"],
  "edge_changes": ["40 million", "300 million"]
}
```

**Business Scenario.** A social network has {{accounts}} accounts. Two kinds of connection coexist: a **friendship** is mutual and starts with a request that the other person accepts; a **follow** is one-way and needs no approval. An account can also **block** another, which hides each from the other. The average account has {{avg_friends}} friends, and the most-followed public accounts have up to {{top_followers}} followers. About {{edge_changes}} connections are created, removed or changed a day. Some accounts are private: following them needs the owner's approval, like a friend request. Product surfaces need friend lists, mutual-friend counts and follower counts; analysts need the graph as it was on any past date.

**Problem Statement.** Design the edge model. Cover: how a friendship is stored (one row or two directed rows) and how both directions stay consistent; how friend requests, follows, follow requests to private accounts and blocks are represented and what a block does to existing friendships and follows; the access patterns and the keys that serve them ("is A friends with B", "A's friends, newest first", "mutual friends of A and B", "follower count of a public account"); how counts are maintained for accounts with {{top_followers}} followers; how edge history is kept so an analyst can ask "was A friends with B on 1 March"; and what account deletion does to every table.

**Constraints.** "Is A friends with B" and "list A's friends" are online reads with p99 under 20 ms. A block takes effect for both people before the next page load. Edge history must answer as-of questions for at least two years. Friendship is symmetric: no read path may ever see A→B without B→A.

**Assumptions.** Account counts, degrees and change rates are hypothetical. Online storage is a sharded key-value or relational store of your choice; the analytical copy lives in a columnar warehouse. Friend suggestions are out of scope.

**Clarifications.**
- Q: Can a pending friend request exist alongside a follow? | A: Yes. Following someone and asking to be their friend are independent.
- Q: What happens to a friendship when one side blocks the other? | A: In this scenario the friendship ends and any follows in either direction are removed; unblocking does not restore them.
- Q: Is there a friend limit? | A: Assume a cap of 5,000 friends per account; follows are uncapped.
- Q: Must the follower count be exact? | A: Exact for the account itself within a minute; others may see a rounded figure such as "80M".
- Q: Do deleted accounts' edges stay in history? | A: Not in a form that identifies the deleted person. Say what you keep, if anything.

**Hints.**
1. Store the friendship as two directed rows keyed by the owner, so each person's friend list is one partition. Write both in one transaction when they share a shard; otherwise use an ordered, idempotent two-step write with a repair job.
2. Keep the current-edge table and the edge-history table separate: current for serving, history (one row per edge interval, with valid_from and valid_to) for as-of questions.
3. A follower count for a heavily followed account is a counter, not a COUNT(*). Decide how the counter is sharded and how it is reconciled with the edge rows.

**Follow-ups.**
1. Your friendship write touches two shards and the second write fails. What do readers see in the meantime, and what repairs it?
2. "Mutual friends of A and B" with {{avg_friends}} friends each: walk through the read. What changes when one side has 5,000 friends?
3. A private account with 3,000 pending follow requests switches to public. What happens to the pending requests, to the follower count and to the history table, given {{edge_changes}} edge changes a day already flow through the pipeline?
4. A public account gains followers at 50,000 a minute after going viral. What happens to your follower counter and to the shard holding that account's follower list?
5. An analyst asks for the number of friendships that existed on 1 March, by country. Write the query shape against your history table and say what deletion did to the answer.

**Follow-up rules.**
- when: one row per friendship, single row, least(, smaller id first → ask: You store each friendship once, ordered by id. How does "list A's friends, newest first" read when A is sometimes the smaller id and sometimes the larger?
- when: two rows, both directions, bidirectional → ask: The second direction's write fails after the first commits. What does A see, what does B see, and what guarantees they converge?
- when: count(*), count of followers, select count → ask: That account has {{top_followers}} followers. What does a COUNT on every profile view cost, and what do you keep instead?
- when: graph database, neo4j, graph db → ask: Which of the listed access patterns needs a graph traversal deeper than two hops? What would you lose by moving the online reads off a sharded key-value layout?
- when: soft delete, is_deleted, deleted flag → ask: A deleted account's edges are flagged, not removed. Which reads must filter the flag, and how do you prove none forgets?

**Production Reality Check.**
- A deploy of the friendship service wrote only the first direction for 0.3% of new friendships for two hours; mutual-friend counts now differ depending on which person you ask, and the analytics copy shows friendships that the app does not.
- A public account with {{top_followers}} followers is deleted; the deletion job fans out to every follower's edge rows, saturates the shard and delays blocks for other accounts on that shard by 40 minutes.
- A unblock-then-refriend sequence on the same second was applied out of order by the history pipeline, leaving two overlapping valid intervals for one pair; the as-of friendship count for that day is now double-counting.

**Evaluation Criteria.** Symmetric edges stored and served consistently, with an explicit repair path for partial writes; follows, requests and blocks modelled distinctly with block semantics applied to both directions; keys designed from the stated access patterns; counters for high-degree accounts with reconciliation; separate current and interval history tables with non-overlapping intervals; deletion propagated through serving, counters and history; each incident contained and guarded.

## MET-L3-03: Conversion lift studies — eligibility, assignment and opportunity logging

| | |
|---|---|
| **Template ID** | MET-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / randomised experiments, sticky assignment, versioned study config |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "population": {"1": ["20 million"], "2": ["200 million"], "3": ["1 billion"]},
  "holdout_share": ["5%", "10%", "20%"],
  "cells": [2, 3, 4],
  "concurrent_studies": [20, 200, 2000]
}
```

**Business Scenario.** An ads platform lets advertisers measure the causal effect of their ads with conversion lift studies. People who could be reached by the study's ads are randomly split: a holdout group ({{holdout_share}}) is never shown those ads, and the rest is eligible to see them. Conversions (purchases, sign-ups) are compared between the groups. A study can have {{cells}} cells (for example two creative strategies), each with its own holdout. Up to {{concurrent_studies}} studies run at once; one person can be in studies from different advertisers, but in this scenario two studies from the same advertiser must never share people. A study's population can reach {{population}} people.

**Problem Statement.** Design the data model for lift studies. Cover: the study definition and which changes are allowed after it starts (and how they are versioned); when a person enters the study (at study start, or at their first ad opportunity) and what that choice does to the estimate; how assignment is made deterministic and sticky across devices and surfaces; what is logged at each ad opportunity for both test and holdout people; how conversions are joined to assignment; the analysis tables (conversions per group and cell, incremental conversions, an interval); how contamination (a holdout person shown a study ad) is detected and reported; and what advertisers see.

**Constraints.** A person's assignment never changes during a study. Results must be reproducible from the stored data. Advertisers see only aggregates, never who converted, and no cell covering fewer than a minimum number of people. Exclusivity between one advertiser's overlapping studies is guaranteed at assignment time.

**Assumptions.** Population sizes, shares, cell counts and the number of concurrent studies are hypothetical. People are identified by the platform's own logged-in identity across devices. Conversions arrive already deduplicated and matched to people; that pipeline is out of scope.

**Clarifications.**
- Q: Is the population everyone the campaign targets, or only people who reached an ad opportunity? | A: Your choice. Say what each does to the estimate's noise and to the data you must log.
- Q: Can the advertiser change targeting or budget during the study? | A: Budget and creative yes, as new config versions. Changing the holdout share or the cells after start is not allowed.
- Q: Does a holdout person see other ads? | A: Yes. Only the study's ads are withheld; the auction fills the slot with another ad.
- Q: How long after the study ends do conversions count? | A: For a fixed post-period defined in the study config, then the result is final.
- Q: What if a person deletes their account during the study? | A: Their data leaves the study; say what that does to a published result.

**Hints.**
1. Assignment can be computed instead of stored: hash(study salt, person) into buckets, with the cut-points in the study version. Record the first assignment event anyway; analysis should not depend on recomputing a hash with today's config.
2. Log the same opportunity record for both groups at the moment the holdout check runs, with the group, the would-be ad, and whether it was served. Then the two groups can be compared on the same footing.
3. Analyse by assigned group (intention to treat), not by whether the person saw an ad.

**Follow-ups.**
1. Compare "everyone targeted at study start" with "people who reached an ad opportunity" as the study population. Which has less noise, which needs more logging, and which can be biased by the ads themselves?
2. With {{concurrent_studies}} concurrent studies, how do you guarantee that two studies from the same advertiser never assign the same person, without a global lock?
3. Compute incremental conversions and a confidence interval for one cell with a {{holdout_share}} holdout. What changes with {{cells}} cells compared at once, and with an advertiser checking the result every day?
4. The advertiser doubles the budget halfway through. What is versioned, what is reported, and is the study still valid?
5. A person in the holdout deletes their account two days before the study ends. What happens to stored opportunities, conversions and the already-published interim result?

**Follow-up rules.**
- when: exposed, saw the ad, unexposed, did not see → ask: You compare people who saw the ad with people who did not. Who chose who saw it, and why is that not the lift?
- when: random(, rand(, random number → ask: The assignment service restarts and recomputes. Does the same person land in the same group, on every device and surface?
- when: assignment table, store the assignment, assignments table → ask: A study has {{population}} people. Do you store every assignment, compute it on demand, or both? What does analysis read?
- when: p-value, significance, significant → ask: The advertiser checks the result every morning and stops when it looks significant. What does that do to the error rate, and what do you show instead?
- when: person_id, user id, person key → ask: Which tables contain person identifiers, who can query them, and what does the advertiser's report contain instead?

**Production Reality Check.**
- A configuration change rotated a study's salt mid-flight; about {{holdout_share}} of people were re-randomised, and some who had been in the holdout started receiving the study's ads.
- A newly launched ad placement skipped the holdout check, so holdout people saw study ads there for four days; the measured lift falls and the advertiser asks whether to trust any of it.
- One of {{cells}} cells in a small study reports conversions for a group of nine people, and an advertiser asks why one identifiable customer appears in the converted count.

**Evaluation Criteria.** Versioned study config with changes classed as allowed or forbidden after start; an explicit population definition and its bias/noise trade-off; deterministic, sticky, exclusive assignment; opportunity logging for both groups; intention-to-treat analysis with an interval and a stopping rule; contamination measured and reported; minimisation and small-cell suppression in advertiser output; each incident handled with containment and an honest statement about the result's validity.

## MET-L3-04: Stories that expire — audiences, viewer lists and highlights

| | |
|---|---|
| **Template ID** | MET-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Low-level design / time-bounded visibility, audience lists, viewer receipts, retention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "daily_stories": {"1": ["50 million"], "2": ["500 million"], "3": ["1 billion"]},
  "viewer_list_hours": [24, 48],
  "top_viewers": ["200,000", "5 million", "40 million"],
  "close_friends_cap": [500, 2000]
}
```

**Business Scenario.** A photo and video app lets people post stories: photos or short videos that others can see for 24 hours. A story is shared with all followers or with a "close friends" list of up to {{close_friends_cap}} people that the author maintains; the author can also hide stories from chosen people, and a block hides everything. The author can see who viewed each story for {{viewer_list_hours}} hours after posting. After 24 hours the story disappears for everyone else but stays in the author's private archive, and the author can add it to a highlight on their profile, where it stays visible until removed. About {{daily_stories}} stories are posted a day; the largest accounts get up to {{top_viewers}} viewers per story.

**Problem Statement.** Design the data model and the read and write paths. Cover: the story item and the media it points to; how the audience is decided (at posting time, at viewing time, or both) and what happens when a close-friends list, a hide list or a block changes while a story is live; how expiry is enforced to the second; the viewer receipt (one per viewer per story, ordering, deduplication) and how its retention of {{viewer_list_hours}} hours is enforced; how archive and highlights reuse the media without reusing the story's visibility rules; what deleting a story, a highlight or a whole account removes, including the author's own appearances in other people's viewer lists; and what aggregate story metrics may be kept after viewer identities are gone.

**Constraints.** Nobody but the author sees a story after 24 hours from posting, whether or not any clean-up job has run. A person removed from the audience (removed from close friends, added to the hide list, or blocked) must not be able to open the story on their next request. Only the author can see the viewer list. Viewer identities are not kept beyond {{viewer_list_hours}} hours; counts may be.

**Assumptions.** Volumes, list sizes and retention are hypothetical. Media storage and delivery are out of scope beyond the reference to a media object. Replies to a story are delivered as messages and are out of scope.

**Clarifications.**
- Q: A person is added to close friends while a close-friends story is live. Can they see it? | A: Your choice; say which you chose and why. Removal, though, must take effect immediately.
- Q: Does the author's own view count? | A: No, and the author never appears in their own viewer list.
- Q: A viewer opens the same story six times. How many receipts? | A: One per viewer per story in the list; you may keep a count or the last view time.
- Q: Who can see a highlight? | A: In this scenario, the author's current followers, subject to blocks; highlights have no viewer list.
- Q: Which clock decides expiry? | A: The server's time of posting plus 24 hours. Device clocks are not trusted.

**Hints.**
1. Make expiry and audience part of the read predicate (`posted_at + 24h > now()` and the audience check). Deletion jobs only reclaim storage; they are never what hides a story.
2. Store the audience as a reference to the list plus the list's version at posting time, and re-check removals at read time against the current list, hide list and blocks.
3. Media is one object; the story, the archive entry and each highlight item are separate rows that reference it, each with its own visibility.

**Follow-ups.**
1. The author removes someone from close friends while a close-friends story is live and that person has the story tray cached in their app. Walk through what they can and cannot open.
2. A story on an account with {{top_viewers}} viewers: how do you write receipts without a hot partition, and how does the author page through the viewer list?
3. The author adds an expired story to a highlight. Which fields are copied, which are referenced, and who can now see it?
4. An account is deleted. List what goes: its stories, archive, highlights, viewer lists of its own stories, and its receipts in other people's viewer lists.
5. Product wants daily reach and completion for stories by country. What do you aggregate, when, and at what threshold, so the aggregate survives the {{viewer_list_hours}}-hour limit on identities?

**Follow-up rules.**
- when: ttl, cron, cleanup job, deletion job → ask: The clean-up job is three hours behind. What does a follower see 25 hours after posting, and what in your design guarantees it?
- when: snapshot, copy the list, audience snapshot → ask: You snapshot the audience at posting. The author blocks someone an hour later. What stops that person from opening the story?
- when: story_views, viewers table, viewer list → ask: The same person views a story six times, from two devices, during a retry. How many rows, and what key makes that true?
- when: delete, hard delete, remove the row → ask: The story is also in the archive and in a highlight. What exactly does "delete this story" remove, and what does "delete this highlight" remove?
- when: cache, cached, cdn → ask: Media URLs are cached at the edge. How does a removed viewer get blocked from media they already have a link to?

**Production Reality Check.**
- The story tray in the app is cached for 10 minutes; a person removed from close friends kept opening a close-friends story during that window, and the author reports it as a privacy failure.
- The job that removes viewer identities after {{viewer_list_hours}} hours silently failed for nine days; identities of viewers of about {{daily_stories}} stories a day are still stored.
- Two regions disagree by several minutes on time, and some stories stay openable for a few minutes past 24 hours in one of them.

**Evaluation Criteria.** Expiry and audience enforced on read with server time; audience removals and blocks effective immediately, with caches and media links handled; one receipt per (story, viewer) with a sensible key and hot-story handling; viewer identities removed on schedule with counts kept; media referenced by story, archive and highlight with separate visibility; deletion complete in both directions; each incident contained, quantified and guarded.

## MET-L3-05: Creator audience insights with a privacy threshold and deletion

| | |
|---|---|
| **Template ID** | MET-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / k-anonymity thresholds, complementary suppression, deletion, as-of dimensions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | MET-L3-05.mjs |

**Business Scenario.** A photo and video app gives creators weekly audience insights for their short videos (reels): how many distinct people watched, broken down by age band. Small groups must not be identifiable, so the insights apply a privacy threshold of k = {{k}} people. Account deletion is first marked in `accounts.deleted_at` and purged from the raw view log by a later job; the insights must already treat a deleted account as gone. Ages are kept only as bands in `age_band_history`, one row per band an account has been in, from its `valid_from`. {{band_note}}

**Problem Statement.** Write one PostgreSQL query for the week from `{{start}}` (inclusive) to `{{end}}` (exclusive) that returns `creator_id, age_band, viewers`, ordered by `creator_id, age_band`. The rules:
- An **eligible view** is a row of `reel_views` with `viewed_at` in the week, on a reel (`reels.creator_id`) whose creator is not deleted, by a viewer who is not deleted (`deleted_at IS NULL`) and is not the creator. Any recorded view counts, whatever its `watch_ms`.
- A viewer's band is the `age_band` of their `age_band_history` row in effect at `{{end}}`: the row with the latest `valid_from` at or before `{{end}}`.
- For each creator, one row per age band that has at least one eligible viewer, with `viewers` = the number of distinct eligible viewers in that band; and one row with `age_band = 'all'` and the number of distinct eligible viewers overall.
- A band row with fewer than {{k}} viewers is published with `viewers` NULL. If exactly one band row of a creator is NULL by that rule, also set `viewers` NULL on the creator's band row with the smallest count among the rest (ties: the first `age_band` in sort order), so that 'all' minus the published bands cannot reveal it.
- A creator whose 'all' count is below {{k}} gets no rows at all.

**Constraints.** One SQL statement (CTEs allowed). The extract has {{accounts}} accounts and {{views}} views; production has billions of views a week, so say how your query would scale. `age_band` values sort as text ('13-17' … '55+', then 'all').

**Assumptions.** Hypothetical schema, accounts, threshold and data. All timestamps are UTC. Every account has a band row in effect at the end of the week. Every deletion recorded in `accounts` happened before this report runs.

**Clarifications.**
- Q: A viewer watched three of a creator's reels. How many viewers is that? | A: One. Viewers are distinct people per creator.
- Q: A deleted account viewed reels before it was deleted. Do those views count? | A: No. A deleted account leaves every derived number, including for views from before its deletion.
- Q: Is a band with exactly k viewers published? | A: Yes. Only counts below k are suppressed.
- Q: A creator has two bands below k. Do I suppress a third? | A: No. Complementary suppression applies only when exactly one band is below k.
- Q: A view at exactly the end time? | A: It belongs to the next week. A view at exactly the start time belongs to this week.

**Hints.**
1. Build the distinct (creator, viewer) pairs first, applying every eligibility rule once; everything else is aggregation over that set.
2. `DISTINCT ON (account_id) … ORDER BY account_id, valid_from DESC` with `valid_from <= end` picks the band in effect.
3. For the complementary cell, rank each creator's published cells by `(viewers, age_band)` with `ROW_NUMBER()` and count the suppressed cells per creator with a window or a join.

**Follow-ups.**
1. The report is also produced daily over a sliding 7-day window. Show how two consecutive daily reports, each correctly suppressed, can still reveal one viewer by differencing, and what you would change.
2. Deletion is marked in `accounts` and purged later. What guarantees that no derived table or cached report keeps a deleted account's contribution after the purge deadline?
3. At billions of views a week, which pre-aggregate would you keep (and at what grain) so this query does not scan raw views, without breaking distinct counting?
4. Product asks for the threshold on approximate distinct counts (HyperLogLog sketches). What goes wrong with a threshold applied to an estimate, and how do you make suppression safe?

**Follow-up rules.**
- when: count(*), count(view_id) → ask: One person watched a creator's reels five times. How many does your count report, and what should a privacy threshold be counting?
- when: deleted_at > viewed_at, viewed_at < deleted_at, deleted_at > → ask: You keep views from before the deletion. What does the person who deleted their account expect to happen to those views?
- when: having count, having → ask: Is your HAVING applied to band cells or to the creator's total? A small band is published as NULL, a small creator disappears: which does your query do to each, and what could a creator learn by subtracting?
- when: max(valid_from), current band, latest band → ask: A viewer turned 18 the day after the week ended. Which band does your query put them in, and which should it?

**Production Reality Check.**
- The purge job for the raw view log falls three weeks behind; a privacy review asks whether any weekly insight published in that period counted deleted accounts, and how you would prove it from the tables alone.
- A creator compares the weekly insights with a daily insight that has a different threshold and recovers the age band of a single viewer in a band that the weekly report suppressed with k = {{k}}.

**Evaluation Criteria.** Eligibility applied once (week boundaries, self-views, deleted viewers and creators); distinct viewers, not views; the band in effect at the end time with an inclusive valid_from; threshold inclusive at k; complementary suppression with the stated tie-break; creators below k omitted; deterministic order; can explain differencing attacks, deletion guarantees and approximate counts.
