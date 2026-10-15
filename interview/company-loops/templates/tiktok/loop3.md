# TikTok · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a short-video
service: uploads and the in-app editor, captions, visibility settings, duets and
stitches, sounds and regional music licensing, comments, reports and appeals.
Every workload, number, schema and incident is hypothetical; licence, remix,
visibility and appeal rules are this exercise's rules (check current docs), and
nothing here describes how any company's systems are actually built. Moderation
appears only as a process (queues, decisions, appeals, aggregates), never with
examples of content. Viewers appear only in aggregates; a creator's own data may be
shown to that creator. Nothing here infers a protected or sensitive attribute of
anyone. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TTK-L3-01: Videos as data — drafts, uploads and processing states, visibility settings, caption edits after posting, and a video as it stood on a date

| | |
|---|---|
| **Template ID** | TTK-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / lifecycle states as events, effective-dated settings, versioned captions, deletion as a state, as-of reconstruction |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "uploads_per_day": {"1": ["5 million"], "2": ["20 million"], "3": ["60 million", "100 million"]},
  "setting_changes_per_day": ["8 million", "30 million"],
  "draft_days": [30, 90],
  "history_years": [2, 5]
}
```

**Business Scenario.** Creators publish about {{uploads_per_day}} videos a day. A video starts as a draft in the in-app editor; in this exercise a draft saved to the account is kept for {{draft_days}} days (this exercise's rule). When the creator posts, the upload can be interrupted and resumed, then the video is processed (transcoded, checked, captioned) and becomes published, or processing fails and the creator is asked to retry. After posting, the creator can change who can watch it (everyone, friends only, only me), change its caption text and cover, turn comments, duets and stitches on or off, and delete it. There are about {{setting_changes_per_day}} such setting changes a day. A video can also be restricted or removed by a moderation decision, which this model records as an outcome only. Creator analytics, support and transparency reporting all need the same answer to "what was this video's state, visibility and caption on date D?", for up to {{history_years}} years.

**Problem Statement.** Design the data model for videos across their life. Cover the video's identity and owner; drafts and their expiry; upload attempts and resumptions; processing states and failures; publishing; visibility and interaction settings as effective-dated records; caption and cover versions; moderation outcomes as a state that refers to a decision kept elsewhere; deletion by the creator. Show the queries for "the video as it stood at time T" (state, visibility, caption version, interaction settings) and for "per day, how many videos were publicly visible", and say which tables are facts, which are dimensions, and at what grain.

**Constraints.** Nothing is overwritten: each change is a new record with an event time and a recorded time, and clients send changes late after being offline. A video has exactly one owner. Visibility applies from the instant it changes. A deleted video keeps no caption text or media after this exercise's retention period, but the fact that a video existed and when it was deleted stays for counting. Viewer data is out of scope; creator-facing numbers about a video are shown only to its owner. Moderation outcomes are recorded by decision id and policy area code only.

**Assumptions.** Volumes, the draft period and the history window are hypothetical. Media storage and transcoding internals are out of scope: model their outcomes, not their mechanics. Account-level privacy settings exist; assume a video's visibility is its own setting, defaulted from the account at posting time.

**Clarifications.**
- Q: Is a draft a video? | A: Your choice, but drafts that are never posted must not count as videos in any published metric, and they expire after {{draft_days}} days.
- Q: Can a published video go back to processing? | A: Yes: in this exercise replacing the cover or re-captioning does not, but a media replacement after a failed check does. Say how you represent a video that is published but temporarily unavailable.
- Q: If the account becomes private, does every video become friends-only? | A: In this exercise the account setting changes who can see the account's videos without editing each video's own setting; the effective visibility is derived from both.
- Q: What does "the video on date D" mean when a change arrived late? | A: Two answers: what was true on D, and what the system showed on D. Say which each consumer needs.
- Q: Can a creator undo a deletion? | A: No, in this exercise deletion is final.

**Hints.**
1. Separate the lifecycle (draft, uploading, processing, published, unavailable, deleted) from the settings (visibility, interactions) and from the content versions (caption, cover); each changes on its own clock.
2. Settings as effective-dated rows make "state at T" a lookup of the row in force at T per setting; the account setting is a second effective-dated input to the derived visibility.
3. Event time and recorded time differ for offline edits; keep both.

**Follow-ups.**
1. Write the query for "publicly visible videos per day" that treats a video made private at 14:00 correctly. Visible at any moment of the day, at the end of the day, or for a share of the day: which do you choose and why?
2. A creator changed a caption offline at 09:00 and the change reached the server at 11:00. What did a viewer see at 10:00, and what does your "as of 10:00" query return?
3. A creator deletes a video. Which rows are kept, which are erased, and how do the per-day counts for earlier days stay unchanged?
4. At {{uploads_per_day}} uploads a day over {{history_years}} years, would you keep a daily snapshot of every video's state, or intervals? Estimate the rows and the cost of the "as of T" query for each.
5. Processing fails for 1% of uploads, and creators retry with a new upload. Is the retry the same video or a new one, and how does each choice change the upload success metric?

**Follow-up rules.**
- when: status column, update the status, overwrite → ask: A support agent asks what state the video was in yesterday at 15:00, before a failed reprocess. With one status column updated in place, how do you answer?
- when: is_public, visibility column, public flag → ask: The account became private for two hours last week while the video stayed "everyone". Was the video public in those hours, and where does your model say so?
- when: valid_from, valid_to, scd2, type 2 → ask: An offline caption edit arrives two hours late. Your valid-from is the edit's time. How do you answer what viewers were shown in those two hours?
- when: soft delete, deleted flag, is_deleted → ask: After this exercise's retention period the caption text must be gone. Which columns does your soft delete leave behind, and how do last month's counts still include the video?
- when: snapshot, daily snapshot → ask: How many rows is that per day at {{uploads_per_day}} uploads a day for {{history_years}} years, and what happens to the snapshot when a late edit lands?

**Production Reality Check.**
- After a client release, visibility changes were recorded with the device's local time instead of UTC. For about {{setting_changes_per_day}} changes that day, "made private at" times are off by hours, and the daily count of publicly visible videos moved by several percent in two regions.
- A resumed upload produced a second "published" event for the same video. Upload success per day counted the video twice, and the creator's video count showed one more video than they had.
- A history query for {{history_years}} years of settings timed out when support looked up one video, because the settings table was partitioned by change date and the query had no date bound.

**Evaluation Criteria.** Identity, lifecycle events, settings and content versions kept apart, all append-only with event and recorded times; drafts excluded from published metrics and expired; visibility derived from video and account settings in force at T; "as of T" and "per day" queries that are precise about intervals; deletion that removes content after retention while keeping counts reproducible; moderation outcomes by decision id only; owner-only creator data; sizing of intervals versus snapshots; incidents explained and repaired from the stored events.

## TTK-L3-02: Remix lineage as data — duets and stitches, the clip range taken, each original's remix permissions over time, and attribution as of a date

| | |
|---|---|
| **Template ID** | TTK-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / typed edges between videos, permissions in force at creation time, chains of remixes, attribution that survives deletion and renames |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "remixes_per_day": {"1": ["2 million"], "2": ["8 million"], "3": ["20 million", "35 million"]},
  "stitch_limit": ["5 seconds", "10 seconds"],
  "max_depth": [12, 50, 200],
  "permission_changes_per_day": ["1 million", "4 million"]
}
```

**Business Scenario.** Creators remix each other's videos about {{remixes_per_day}} times a day. A duet places the new video beside the original for its length; a stitch takes a clip of up to {{stitch_limit}} from the original and plays it before the new video (this exercise's rule; check current docs). A remix can itself be remixed, so chains form; the longest chains in the data are about {{max_depth}} remixes deep. Each original's creator chooses whether duets and stitches are allowed and for whom (everyone, friends, no one), and changes it about {{permission_changes_per_day}} times a day across all videos. A remix shows an attribution to the original's creator. Creators ask "who remixed my video, and when"; the support team asks "was this remix allowed when it was made"; creator analytics show per original how many remixes it drew.

**Problem Statement.** Design the data model for remix lineage. Cover the remix as a typed link between two videos (duet or stitch), the clip range taken for a stitch, the permission settings of each original over time, the permission in force when each remix was created and the check's outcome, the chain from any remix back to its root original, and the attribution shown on a remix as of a date. Show the queries for: remixes of one original per week by type; all descendants of an original; the root of a given remix; and "was this remix allowed when it was created".

**Constraints.** A remix's parent never changes once posted. Permissions are effective-dated, and a later change does not retroactively invalidate an earlier remix (this exercise's rule). If the original is deleted or made private, the remix stays up in this exercise but its attribution shows that the original is unavailable; the link stays in the data for counting. Creator handles can change; attribution must follow the account, not the handle text. Remix counts shown to a creator cover only their own originals, and never list a remix that is not visible to them.

**Assumptions.** Volumes, the stitch limit and the depth are hypothetical. Sounds reused by remixes are modelled elsewhere. Videos and their visibility are modelled as in a separate video model; refer to it by id.

**Clarifications.**
- Q: Can a stitch take a clip from a remix rather than an original? | A: Yes. The "original" of a remix is its direct parent; the root is the first video of the chain.
- Q: What if the clip range is longer than {{stitch_limit}}? | A: The editor prevents it, but the data occasionally contains one from an old client version. Say what your model does with it.
- Q: When a creator turns stitches off, what happens to existing stitches? | A: Nothing, in this exercise: they stay. New stitches are refused from that instant.
- Q: Is "who remixed my video" a list of accounts? | A: For the creator of the original, yes, limited to remixes they are allowed to see; any wider analytics use counts only.
- Q: Does a remix have one parent? | A: Yes, exactly one.

**Hints.**
1. A remix is an edge with a type and attributes (clip start and end for a stitch), stored on the child video because each child has exactly one parent.
2. Permissions are an effective-dated table per original; the check at creation is a lookup of the row in force at the remix's creation time, worth storing with its outcome.
3. For descendants and roots, compare a recursive query, a stored root id and depth on each remix, and a closure table; size each against {{max_depth}} and {{remixes_per_day}}.

**Follow-ups.**
1. Write the query "remixes of original V per week by type", counting only remixes created while the corresponding permission allowed them. Where does that rule come from in your tables?
2. The original's creator changed their handle twice since a stitch was posted. What does the stitch show today, and what did it show last month?
3. Store the root id on every remix, or compute it on read? What happens to your choice when a video in the middle of a chain is deleted?
4. A closure table for chains up to {{max_depth}} deep at {{remixes_per_day}} remixes a day: how many rows a day in the worst case, and when is it worth it?
5. Support asks why a duet was allowed although duets were off. The permission change and the duet were recorded within the same second. What decides it, and what do you store so it can be explained later?

**Follow-up rules.**
- when: parent_id, parent video → ask: The parent is deleted. What does your parent column point to, and do the original's weekly remix counts change?
- when: recursive, recursive cte → ask: A chain is {{max_depth}} remixes deep and support needs the root in under a second for many remixes at once. What do you store so you do not recurse on every request?
- when: closure table, closure → ask: How many closure rows does one new remix at depth {{max_depth}} add, and how do you keep the table consistent when the remix and its closure rows are written separately?
- when: allowed flag, duet_allowed, stitch_allowed → ask: A single "allowed" column on the video is overwritten when the creator changes it. How do you tell whether a remix made last week was allowed at the time?
- when: handle, username → ask: Handles change and can be reused by another account later. What does attribution store, and what does it show after a handle is reused?

**Production Reality Check.**
- After an editor release, stitches arrived with clip ranges measured in frames instead of milliseconds. About a day of the {{remixes_per_day}} remixes shows clips far longer than {{stitch_limit}}, and a validation job flagged them all as violations.
- A permission lookup used the original's current setting instead of the setting in force at creation. When a popular creator turned duets off, a report listed thousands of earlier duets as "not allowed", and support began to answer complaints from it.
- A descendant-count job that recursed through chains up to {{max_depth}} deep ran out of memory on one viral original, and the original's creator saw a remix count of zero for a day.

**Evaluation Criteria.** Remix as a typed edge on the child with clip range; effective-dated permissions per original and the outcome of the check stored at creation; no retroactive invalidation; attribution by account id, resolved to a handle as of a date; deletion and visibility handled without losing counts or exposing hidden remixes; a sized choice among recursion, a stored root and depth, and a closure table; owner-scoped lists and aggregate-only analytics; incidents explained and repaired from stored data.

## TTK-L3-03: Sounds as data — original sounds and licensed tracks, regional licence windows, the clips videos use, and videos muted when a licence lapses

| | |
|---|---|
| **Template ID** | TTK-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / sounds of two origins, licences per territory as half-open windows, clip usage per video, per-region mute decisions with a trail |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "sounds": {"1": ["50 million"], "2": ["200 million"], "3": ["600 million"]},
  "licensed_tracks": ["2 million", "10 million"],
  "regions": [40, 120, 180],
  "lapse_videos": ["200,000", "3 million"]
}
```

**Business Scenario.** Videos use sounds. Some are original sounds: the audio of a creator's own video, which other creators can reuse. Others are licensed tracks from a music catalogue, which in this exercise may be used only in the regions and during the windows a licence covers (this exercise's model; check current docs). There are about {{sounds}} sounds, of which about {{licensed_tracks}} are licensed tracks, across {{regions}} regions. A video uses a clip of a sound: an offset into it, a duration and a volume mix with the creator's own audio. When a track's licence ends in a region without a renewal, every video using it must be muted in that region; in this exercise a mute is permanent, and the creator can replace the sound. A single licence ending can affect about {{lapse_videos}} videos. Sound pages show how many videos use a sound; the rights team asks what was licensed where on a date; creators ask why their video is silent in one region.

**Problem Statement.** Design the data model for sounds and their use. Cover original sounds (who created them, from which video) and licensed tracks (catalogue id, rights holder ids); the link when an original sound is identified as containing a licensed track; licences per track and region as time windows, including renewals and region groups; the clip each video uses; and per-region mute decisions with their reason and time. Show the queries for: "where could track X be used at time T"; "which videos must be muted when this licence ends"; and "the number of videos using a sound per region and day, counting a muted video as no longer using it".

**Constraints.** Licence windows are half-open: a licence allows use from its start up to but not including its end. A licence can be granted for a region group, which this model must expand to regions as of the grant. Mutes are per video and region, with a reason, the licence they enforce, and the time they took effect. An original sound found to contain a licensed track keeps its identity and gains a link; the link has its own effective time. Sound pages show counts only; the list of videos using a sound shows only videos visible to the viewer.

**Assumptions.** Counts are hypothetical. Audio fingerprinting is out of scope: assume an identification feed that says which original sounds contain which tracks, with a confidence you are given. Royalty accounting is out of scope.

**Clarifications.**
- Q: Does a renewal that starts exactly when the old licence ends cause a lapse? | A: No. With half-open windows, a renewal starting at the old end covers that instant.
- Q: Can a muted video get its sound back? | A: Not in this exercise; the creator can replace the sound, which is a new clip record.
- Q: Are region groups stable? | A: No: a group can gain or lose a region. A licence covers the regions the group had when it was granted, in this exercise.
- Q: What if two licences for the same track and region overlap? | A: That is allowed; the track is licensed while any of them covers the instant.
- Q: Who sees why a video was muted? | A: Its creator, with the reason category and the date; no one else sees per-video detail.

**Hints.**
1. Keep the sound (identity) apart from the licence (permission over time and place) and from the clip (one video's use of one sound).
2. "Is X licensed in R at T" is an interval test: any licence with start ≤ T < end. A lapse is an end that no licence of the same track and region covers.
3. A mute is a decision with a reason that refers to a licence; store it as a row, not as a flag on the video.

**Follow-ups.**
1. Write the query that lists the videos to mute when licence L ends at time E, excluding videos already muted in that region and handling a renewal that starts exactly at E.
2. A region group that the licence named gains a region a month after the grant. Is the track licensed in the new region? Where does your model answer that?
3. An original sound is identified as containing a licensed track not licensed in five regions. Which videos are affected, and what do the creators see?
4. With {{lapse_videos}} videos to mute at one instant, how do you produce and apply the mute decisions without falling hours behind, and how would you measure the lag?
5. Sound pages show "videos using this sound" per region. How do you keep that count correct across mutes and replacements without recounting every day?

**Follow-up rules.**
- when: licence flag, is_licensed, licensed column → ask: A track's licence ends in 12 regions next Friday and is renewed in 9 of them, one starting an hour late. Where does a flag store that, and what does it say at 00:30 on Saturday?
- when: muted flag, is_muted → ask: A creator asks why their video is silent in one region since Tuesday. Which licence, which reason and which time does your flag give you?
- when: between, inclusive → ask: The old licence ends at midnight and the renewal starts at midnight. With BETWEEN on both ends, is that instant covered twice, and which videos does your lapse query mute?
- when: region group, territory → ask: The group gained a region after the grant. Does your expansion run at grant time or at query time, and which did this exercise's rule ask for?
- when: counter, running count, count column → ask: A muted video replaces its sound with another. Which sound's count changes, in which regions, and from what time?

**Production Reality Check.**
- A renewal for one track was loaded with its start an hour after the old licence's end because of a time zone error. In that hour the lapse job muted about {{lapse_videos}} videos in one region; with permanent mutes, the creators' videos stayed silent although the track was licensed again.
- A region group used by many licences was edited to add a region, and a query that expanded groups at read time showed the tracks as licensed there since the original grants. A rights report for the quarter was wrong across {{regions}} regions.
- Sound-page counts in one region stayed high after a lapse: the count was maintained by a counter that was decremented when a video was deleted but not when it was muted.

**Evaluation Criteria.** Sounds of both origins with identity kept, licensed tracks and identification links with effective times; licences as half-open windows per region, region groups expanded at grant time; lapse defined as an uncovered end, renewals at the exact end handled; clips per video; mutes as per-region decisions with reason, licence and time; counts that honour mutes and replacements; creator-only detail; incidents traced to the model and repaired, including how permanent mutes made by mistake are reviewed and reversed through a recorded correction.

## TTK-L3-04: Comments and reports as data — threads and replies, creator filters, reports, moderation decisions and appeals, as a process

| | |
|---|---|
| **Template ID** | TTK-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / threaded comments, filter outcomes with versions, reports grouped into cases, decisions and appeals with policy versions, aggregate-only reporting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "comments_per_day": {"1": ["300 million"], "2": ["1 billion"], "3": ["3 billion"]},
  "reports_per_day": ["2 million", "8 million"],
  "appeal_days": [7, 30],
  "languages": [40, 75]
}
```

**Business Scenario.** Viewers post about {{comments_per_day}} comments a day on videos, in {{languages}} languages; a comment can be a reply to another comment. Creators can turn on filters for their own videos: a filter list they maintain and a default filter for comments a score you are given marks as likely to break the rules. A filtered comment is held: it is visible to its author and, for review, to the creator, but not to others. Anyone can report a comment under a policy area; there are about {{reports_per_day}} reports a day. Reports about the same comment are grouped into one case that is reviewed; the decision is no action, restrict, or remove, under a versioned policy. The comment's author can appeal a decision within {{appeal_days}} days (this exercise's rule; check current docs), and an appeal can overturn it. Transparency reporting publishes aggregate counts of decisions by policy area and region.

**Problem Statement.** Design the data model for comments and the moderation process around them. Cover comments and replies with their thread; deletion by the author; creator filter settings and filter lists as versions; filter outcomes per comment; reports and their grouping into cases; review decisions with the policy version and the decision's effect on visibility; appeals and their outcomes; and the visible state of a comment as of a time. Show the queries for: "the visible thread under a video at time T for a viewer"; "per policy area, region and week, cases decided, removed, and removed then reinstated on appeal"; and "time from first report to decision" per queue.

**Constraints.** No comment text appears in any analytics table; analytics carry ids, policy area codes and counts only. The identity of a reporter is never shown to the reported author or to the creator. The author sees their own comment's state and any decision about it, with the policy area. Reviewer identifiers stay in the operational system; analytics do not carry them and no reviewer is ranked. A decision is never edited: an appeal outcome is a new decision that supersedes it. A deleted comment's text is erased after this exercise's retention period; its replies remain and the thread shows a placeholder.

**Assumptions.** Volumes, the appeal window and the language count are hypothetical. Queue routing and reviewer tooling are out of scope beyond the fields this model needs. The score you are given is produced elsewhere and is stored with its version.

**Clarifications.**
- Q: Do several reports on one comment create several cases? | A: No. Reports open one case per comment while it is open; a report after the decision opens a new case only if the comment is still visible.
- Q: Can the creator see who reported? | A: No. The creator sees held comments on their own videos and can approve or delete them; reporter identity is never shown.
- Q: When a filter list changes, are earlier comments re-filtered? | A: Not in this exercise: a filter applies from the version in force when the comment was posted. Say how you record which version applied.
- Q: Does a removed parent hide its replies? | A: No; the thread shows a placeholder for the parent and keeps its visible replies.
- Q: What counts as "reinstated"? | A: A removal superseded by an appeal decision of no action.

**Hints.**
1. A comment's visible state is derived from several independent inputs: author deletion, filter outcome, creator approval, and the latest decision. Store each as its own record.
2. Reports are many-to-one with a case; decisions belong to cases, and an appeal is a case of its own that refers to the decision it challenges.
3. Weekly transparency counts must be reproducible after appeals: decide whether a week's numbers are restated when an appeal lands later, and record the policy version used.

**Follow-ups.**
1. Write the query for the visible thread at time T, with placeholders for removed or deleted parents that have visible replies.
2. A filter list version changes at 12:00. A comment posted at 11:59 arrives at 12:01 from a client that was offline. Which version applies, and where is that recorded?
3. A removal is overturned on appeal 20 days later. Which weekly counts change: the week of the removal, the week of the appeal, or both? How do you publish a restatement?
4. At {{reports_per_day}} reports a day, how do you group reports into open cases without two cases being opened for the same comment by concurrent reports?
5. The transparency report shows a policy area with three removals in a small region. What do you publish, and what rule protects the people involved?

**Follow-up rules.**
- when: status column, comment status, visible flag → ask: A comment was filtered, approved by the creator, then removed after a report, then reinstated on appeal. What does a single status say, and how do you rebuild what a viewer saw at 14:00 yesterday?
- when: report count, reports per comment → ask: A coordinated burst sends 5,000 reports about one comment. How many cases does your model open, and what does "reports per day" in the transparency report mean then?
- when: update the decision, overwrite → ask: An appeal overturns a removal. With the decision overwritten, how do you count removals for the week they happened, and how do you show the author the history?
- when: reviewer, moderator id → ask: Analytics never carry reviewer ids and nobody is ranked. Which grain do your queue metrics use, and how do you keep those ids out of the warehouse?
- when: comment text, text column → ask: Which tables hold the text, how long, and what removes it after the author deletes the comment? Show that no analytics table needs it.

**Production Reality Check.**
- Concurrent reports on a widely shared comment opened 40 cases for it within a minute. Reviewers handled the same comment repeatedly, and the weekly "cases decided" for that policy area was overstated in the transparency draft.
- Appeals overturned a batch of removals {{appeal_days}} days later, but the weekly transparency counts were computed once and never restated; published removals and reinstatements no longer added up for those weeks.
- After a filter list editor bug, held comments were recorded without the filter version that applied. Creators asked why comments were held, and the support team could not tell which version of their list had held them.

**Evaluation Criteria.** Threaded comments with deletion and placeholders; filter settings and lists versioned with the version recorded per outcome; reports grouped into one open case per comment with a concurrency guard; decisions append-only with policy versions, appeals superseding them; visible state at T derived from independent inputs; analytics free of text, reporter and reviewer identifiers; reproducible weekly counts with a stated restatement rule and small-cell protection; incidents explained and repaired; moderation described only as process.

## TTK-L3-05: Lapsed sounds — videos still playing a sound after its licence ended in their region, and hours until muted

| | |
|---|---|
| **Template ID** | TTK-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / half-open licence windows, uncovered ends, earliest of several stop times, permanent mutes, FILTER aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | TTK-L3-05.mjs |

**Business Scenario.** In this exercise's model a licensed track (a sound with `kind = 'licensed'`) may be used in a region only while a licence covers that instant (check current docs for how real music licensing works). When a licence ends without a renewal, every video using the sound must be muted in that region by a mute job, which writes a row to `video_mutes`. The rights team wants a monthly readout per region: how many videos were still playing a sound after its licence had ended, how many of those lapses ended with a mute, how long the mutes took, and how many are still playing now. The sample's regions are {{regions}}, and the data is a snapshot taken at `{{as_of}}`.

**Problem Statement.** Write one PostgreSQL query that returns `region, lapse_month, video_lapses, muted, still_playing, avg_hours_to_mute, max_hours_to_mute`, one row per region and lapse month with at least one video lapse, ordered by `region`, then `lapse_month`.
- A licence allows its sound in its region from `licence_start` (inclusive) up to `licence_end` (exclusive). A licence whose `licence_end` is after `{{as_of}}` has not ended yet and is ignored.
- {{renewal_rule}}
- A video lapses at a licence end when it uses that licence's sound, was published before the end (`published_at < licence_end`), and was not muted in that region at or before the end. Mutes are per region and permanent: the video's earliest row in `video_mutes` for that region is when it was muted. One video can lapse in several regions. Original sounds have no licence rows and never lapse.
- {{removal_rule}}
- A lapse ends at the earliest of the events this statement names (at least the video's first mute in that region after the end). It counts in `muted` when that earliest event is the mute (a mute that coincides with another event counts as the mute), and in `still_playing` when nothing has ended it by `{{as_of}}`. A lapse that ends any other way counts only in `video_lapses`.
- `lapse_month` is the licence end's month in UTC as text, `YYYY-MM`. `video_lapses` counts lapses (a video and a licence end). `avg_hours_to_mute` and `max_hours_to_mute` are the hours from the licence end to the mute over the lapses counted in `muted`, each rounded to 1 decimal; NULL when `muted` is 0.

**Constraints.** One SQL statement (CTEs allowed). All timestamps are `TIMESTAMPTZ` and the session time zone is UTC. Use `ROUND(numeric, 1)`. Do not use `now()`: the snapshot time is `{{as_of}}`. The sample has {{licence_count}} licences, {{video_count}} videos and {{mute_rows}} mute rows; production has hundreds of millions of videos using licensed sounds and a readout due every morning.

**Assumptions.** Hypothetical schema, sounds, regions and times; this is not how any real licensing or muting system works. Every timestamp in the sample other than some licence ends is at or before `{{as_of}}`.

**Clarifications.**
- Q: A video was muted at exactly `licence_end`. Is that a lapse? | A: No. The sound may play up to but not including `licence_end`; a mute at that instant is on time.
- Q: Should a video muted before the licence ended appear? | A: No. It was not playing the sound when the licence ended.
- Q: Does `lapse_month` follow the mute or the licence end? | A: The licence end, in UTC.
- Q: Can one video lapse twice in the same region? | A: At the hardest level, yes, after a renewal; each lapse counts once in `video_lapses`.
- Q: If a sound's licence is renewed, does a muted video get its sound back? | A: No; mutes are permanent in this exercise.

**Hints.**
1. Build the lapses first: licence ends at or before `{{as_of}}` that no licence of the same sound and region covers.
2. Reduce `video_mutes` to the earliest mute per video and region before joining, then LEFT JOIN it: a video that was never muted must stay.
3. `LEAST` ignores NULLs, so the earliest of several possible end events is one expression; `COUNT(*) FILTER (WHERE …)` and `AVG(…) FILTER (WHERE …)` keep the whole readout in one GROUP BY.

**Follow-ups.**
1. The mute job is expected to finish within 2 hours of a licence end. Change the query into an alert that lists every region and licence with lapses still playing after 2 hours, as of `{{as_of}}`.
2. Licences are now granted to region groups that change over time. What changes in the schema and in your lapse definition?
3. In production a popular sound is used by tens of millions of videos. How would you avoid joining every video to every licence end each morning, and what would you precompute?
4. The rights team decides that a renewed licence restores the sound to muted videos. Which rows would represent that, and how would "still playing" and the hours change?

**Follow-up rules.**
- when: max(muted_at), latest mute, last mute → ask: The mute job retries and can write a second row hours later. Which of the rows is the moment the video went silent, and what does the latest one do to your hours?
- when: inner join video_mutes, join video_mutes → ask: A video that was never muted has no row in `video_mutes`. Where does it go in your query, and which column should it have counted in?
- when: now(), current_timestamp, current_date → ask: Why would `now()` make this readout differ between two runs on the same data, and what makes it reproducible?
- when: count(distinct, distinct video_id, distinct videos → ask: One video lapsed twice in one region and month after a renewal. What does COUNT(DISTINCT video_id) report, and what did the statement ask you to count?
- when: between, <= licence_end → ask: Is a licence's end instant inside the licence? Show what your comparison does with a renewal that starts exactly at the old end.

**Production Reality Check.**
- At month end many licences ended at the same instant and the mute job fell behind; in one region thousands of lapses stayed in `still_playing` for over a day. A dashboard that showed only the average hours of muted lapses looked normal throughout, because still-playing lapses are not in it.
- A renewal was loaded with its `licence_start` one hour after the old `licence_end` because of a time zone error. The readout showed a one-hour lapse for every video using the sound in that region, and the mute job, seeing the gap, muted them all permanently.

**Evaluation Criteria.** Lapses built from licence ends at or before the snapshot that no licence covers (half-open windows, renewals at the exact end handled); earliest mute per video and region with a LEFT JOIN; published-before and removed-at-or-before filters at the end instant; the lapse's end as the earliest of the stated events, with a mute winning a tie; counts with FILTER and hours over muted lapses only, from exact intervals, rounded once; deterministic order; can discuss alerting, region groups, precomputation at scale and restoration on renewal.
