# Spotify · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of an audio streaming
service: music, podcasts and audiobooks, playlists, listening across devices, follows,
artist and creator analytics and yearly summaries. Every workload, number, schema, rule
and incident is hypothetical. Ranking appears only as a scoring function you are given,
and any counting rule is this exercise's rule, not a description of how a product
works. Listener data appears in aggregates, except a listener's own data shown to that
listener. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SPT-L3-01: Playlist types as data — editorial, personalised, user-made and collaborative, as of a date

| | |
|---|---|
| **Template ID** | SPT-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / playlist versions, membership and positions, generated versus edited playlists, as-of queries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "playlists": {"1": ["80 million"], "2": ["500 million", "900 million"], "3": ["2 billion", "4 billion"]},
  "personalised_refresh": ["every Monday", "every day"],
  "daily_edits": ["30 million", "150 million", "400 million"],
  "history_years": [2, 5, 7]
}
```

**Business Scenario.** A streaming service holds about {{playlists}} playlists of four kinds. Editorial playlists are curated by the service's editors, can differ by market and are re-ordered often. Personalised playlists are generated for each listener from a scoring function you are given and are regenerated {{personalised_refresh}}; every listener gets their own copy. User-made playlists belong to one listener, who adds, removes and re-orders tracks and episodes and can make the playlist public or private. Collaborative playlists let invited members add, remove and re-order items. Listeners, editors and members together make about {{daily_edits}} playlist edits a day. Analysts want to know how many plays started from a playlist and which version of it was live at the time; support wants to answer "what was in this playlist on that date"; editors want follower counts over time. In this scenario the service keeps playlist history for {{history_years}} years.

**Problem Statement.** Design the data model for playlists across the four kinds. Cover: the playlist entity and what differs by kind (owner, members, market, generator); how items and their positions are stored so that any past version can be reconstructed; what a version is (each edit, each generation run, or something coarser) and how a play is linked to the version that was live when it started; follows and unfollows; visibility changes; and the facts that answer "plays started from each editorial playlist per day and market", "what did this playlist hold on a given date, in order" and "followers per playlist per day". Estimate the storage for history at {{daily_edits}} edits a day and say how you keep it affordable.

**Constraints.** Any playlist's contents and order on a past date must be reconstructable within the {{history_years}}-year history. A personalised playlist is visible only to its listener; analytics on personalised playlists use aggregates across listeners. Plays must be attributable to the playlist they started from without storing a copy of the playlist per play. A deleted account's user-made playlists and their history are removed according to the deletion policy, and their contribution to aggregates is handled explicitly.

**Assumptions.** Counts, rates and the history period are hypothetical. The scoring function that fills personalised playlists is given and out of scope; you only store what it produced and when. An item is a track or an episode with a stable id. A playlist can contain the same item more than once.

**Clarifications.**
- Q: Is a re-order an edit? | A: Yes. Order matters to listeners and editors, so a move is an edit even though the set of items did not change.
- Q: Can an editorial playlist differ by market? | A: Yes. Treat the market variant as part of the model; editors often share most items across markets.
- Q: How is a personalised playlist versioned? | A: Each generation run produces a new version for that listener. A listener can also save a personalised playlist as their own, which creates a user-made copy.
- Q: How does a play know its playlist? | A: Each play event carries a context: the playlist id it started from, if any. You decide how to find the version.
- Q: Can the same track appear twice? | A: Yes, so an item's identity within a playlist is not just the track id.

**Hints.**
1. Separate the playlist (identity, kind, owner) from its versions (contents at a moment) and from the edits that move between versions.
2. Positions are fragile under inserts and moves. Consider an entry id per item occurrence, with ordering derived from the edit log or from sortable keys.
3. For "what was live when the play started", an effective-from / effective-to interval per version lets you join plays by time instead of copying contents.

**Follow-ups.**
1. Sketch the tables for playlists, entries and versions, and show how you reconstruct a 200-item playlist as it was on a date.
2. A collaborative playlist gets two re-orders from two members within the same second. How do your versions and positions stay consistent, and which order does the history show?
3. Personalised playlists are regenerated {{personalised_refresh}} for every listener. Do you store a full snapshot per generation, a diff, or only the item list with a run id? Estimate the rows.
4. An analyst asks for plays per editorial playlist per day, split by the version that was live. Write the join, and say what happens to plays that started a few seconds after a re-order.
5. A listener deletes their account. Which rows go, which aggregates keep their contribution, and how does a collaborative playlist they edited change?

**Follow-up rules.**
- when: snapshot, full copy, copy of the playlist → ask: At {{daily_edits}} edits a day, how many item rows does a full snapshot per edit write, and what would you store instead for a one-item move?
- when: position column, position index, array index → ask: A member moves the last item to the top of a 300-item playlist. How many rows change in your model, and how do you show that move in the history?
- when: scd, type 2, valid_from, effective_from → ask: What exactly carries the validity interval: the playlist, each entry, or each version? How does a play join to it?
- when: personalised, personalized, scoring function → ask: The generator is re-run because of a bug and produces a different list for the same week. Which version did the listener see, and where is that recorded?
- when: follower count, follower_count, followers column → ask: Is the follower number a counter on the playlist row or derived from follow events? How do you show followers per day for last year?

**Production Reality Check.**
- After a generation bug, one run of personalised playlists ({{personalised_refresh}}) was redone in place; the original run's rows were overwritten, and play attribution for those hours now credits items the listeners never saw.
- An editor re-orders a large editorial playlist many times in an hour; the snapshot-per-edit table grew far faster than the {{daily_edits}}-a-day estimate, and the nightly compaction fell behind.
- A collaborative playlist's history shows an item removed before it was added: two members' edits from different devices carried client timestamps, and one device's clock was minutes behind.

**Evaluation Criteria.** Playlist identity separated from versions and edits; an entry id per occurrence so duplicates and moves are representable; a clear definition of a version for each kind (edit, generation run, market variant); validity intervals so plays join to the live version by time; storage estimate with diffs or compaction instead of snapshot-per-edit; follows as events with derived daily counts; personalised playlists private to their listener with aggregates only for analysis; deletion handled explicitly; each incident contained, corrected and guarded.

## SPT-L3-02: Audiobooks and podcasts in one catalogue — series, editions, chapters and included hours

| | |
|---|---|
| **Template ID** | SPT-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / spoken-word catalogue, works versus editions, chapters and episodes, plan allowance versus ownership |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "shows": ["2 million", "6 million"],
  "audiobooks": {"1": ["250,000"], "2": ["400,000", "800,000"], "3": ["1 million", "2 million"]},
  "included_hours": [10, 15, 20],
  "markets": [20, 60, 180]
}
```

**Business Scenario.** A streaming service offers podcasts (about {{shows}} shows, each with episodes, seasons and trailers) and audiobooks (about {{audiobooks}} titles from publishers) in {{markets}} markets. An audiobook can exist in several editions: abridged and unabridged, different narrators, different languages and publishers, each with its own chapters and runtime, and some books belong to a series. Rights differ by market and change over time. In this scenario some plans include {{included_hours}} hours of audiobook listening a month (this exercise's rule; check current docs), and a listener can also buy an audiobook, which they then keep. Listeners resume where they left off on any device. Product teams want listening hours by title, edition and series; finance wants included hours used per plan and month; listeners see their own remaining hours.

**Problem Statement.** Design the data model for one spoken-word catalogue holding podcasts and audiobooks. Cover: shows, seasons and episodes; works, editions, series and the order within a series; contributors (authors, narrators, hosts) as roles; chapters with offsets; market availability over time; listening progress per listener and edition; and the allowance model: how included hours are measured, consumed, reset each month and reconciled with purchases. Say which facts answer "hours listened per edition, per market and day", "share of included hours used per plan and month" and "titles started under the allowance and later purchased".

**Constraints.** A listener's remaining included hours shown to them must never be less accurate than what they are charged against. A purchase is permanent for that listener even if the title later leaves the plan or the market. Progress must survive a publisher re-delivering an edition with different chapter boundaries. Podcast and audiobook analytics share dimensions (date, market, contributor) but never mix a podcast episode with an audiobook chapter in the same measure without saying so.

**Assumptions.** Catalogue sizes, markets and the allowance are hypothetical. In this exercise the allowance counts time actually listened, so an hour of audio at double speed uses thirty minutes; check current docs for any real plan's rule. Offline listening is reported when the device reconnects. The allowance resets on the plan's monthly billing date in the listener's time zone.

**Clarifications.**
- Q: Is an edition a separate title? | A: It is a separate product with its own runtime, chapters and rights, but it belongs to one work. Reports need both levels.
- Q: Does re-listening use allowance? | A: Yes, in this exercise every minute listened under the allowance counts, including re-listening.
- Q: What happens when the allowance runs out mid-book? | A: Listening stops until the next reset or a top-up; a listener can buy the book and continue from the same position.
- Q: Can a podcast episode also be an audiobook chapter? | A: No. They are separate kinds of items; a show can, however, promote a book.
- Q: Do purchased titles use allowance? | A: No. Once purchased, listening to that edition never uses allowance.

**Hints.**
1. Separate the abstract work from its editions; contributors attach to either with a role.
2. Model progress as position within an edition (an offset in its audio), and chapters as ranges over that offset, so chapters can change without moving the listener.
3. The allowance is a small ledger per listener and period: usage lines from listening, resets, top-ups, and an entitlement record per purchase.

**Follow-ups.**
1. Draw works, editions, series and contributors. How do you answer "hours listened to this book across all its editions"?
2. A publisher re-delivers an edition with chapters re-split. What happens to listeners' progress and to "hours per chapter" reports already published?
3. A listener listens offline for several days, then reconnects after the reset date. Which period's allowance do those minutes use, and what did the listener see meanwhile?
4. A title leaves the plan in one of the {{markets}} markets while a listener is halfway through it under the allowance. Model what they can do next, and how the analytics show it.
5. Finance asks for included hours used per plan and month at {{included_hours}} hours included. How do you prove the per-listener ledgers sum to the reported total?

**Follow-up rules.**
- when: one table for audiobooks, audiobooks table, books table → ask: The same book has an abridged and an unabridged edition with different narrators. Where does each live, and how does "hours for this book" work?
- when: chapter_id, chapter number, current chapter → ask: The publisher re-splits the chapters. Your progress points to a chapter id that no longer exists. How does the listener resume in the right place?
- when: remaining hours, hours_remaining, counter → ask: Two devices report listening for the same listener at once, one of them offline. How does your counter stay correct, and how do you explain the balance to the listener?
- when: purchase, purchased, ownership → ask: The listener bought the book after using plan hours on it. Which minutes count against the allowance, and does the purchase change any past numbers?
- when: playback speed, 2x, double speed → ask: Your allowance counts time listened. Which measure do the "hours listened per edition" reports use, and how do you stop the two being confused?

**Production Reality Check.**
- Offline listening uploaded after the monthly reset was charged to the new period; listeners on the {{included_hours}}-hour allowance saw their new month start partly used and complained.
- A publisher re-delivered a popular edition with new chapter boundaries and a re-encoded file a few seconds longer; resume positions now start mid-sentence for listeners in {{markets}} markets.
- A rights change removed a title from the plan in some markets overnight; listeners who had already purchased it saw "unavailable" because purchase entitlements were checked against plan availability.

**Evaluation Criteria.** Works separated from editions, with series order and contributor roles; podcasts and audiobooks as distinct item kinds sharing dimensions; progress as an offset within an edition, chapters as ranges; market availability with validity intervals; the allowance as a ledger with usage, resets and top-ups, measured in listening time and attributed by when listening happened; purchases as permanent entitlements independent of plan availability; facts at stated grains; each incident contained, corrected and guarded.

## SPT-L3-03: Artists, credits and follows — primary and featured artists, claimed profiles and the numbers an artist sees

| | |
|---|---|
| **Template ID** | SPT-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / artist profiles and credit roles, profile merges and splits, follow events, artist-facing aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "artists": {"1": ["2 million"], "2": ["8 million", "11 million"], "3": ["15 million"]},
  "daily_follows": ["20 million", "80 million", "200 million"],
  "featured_share": ["10%", "20%", "35%"],
  "min_listeners": [50, 100, 1000]
}
```

**Business Scenario.** A streaming service has about {{artists}} artist profiles. A track lists one or more primary artists and, on about {{featured_share}} of tracks, featured artists; credits also name songwriters and producers. Artists or their teams can claim a profile and then see analytics for it. Listeners follow and unfollow artists, about {{daily_follows}} follow changes a day. Some profiles turn out to be duplicates of one artist and are merged; some profiles mix two different artists with the same name and must be split. Artists see daily numbers on their profile and in their analytics: streams, listeners, followers and saves, with breakdowns by country and city shown only when at least {{min_listeners}} listeners are behind a cell (this exercise's rule).

**Problem Statement.** Design the data model for artists, credits and follows, and the aggregates an artist sees. Cover: artist profiles and their lifecycle (created, claimed, merged, split); the credits on each track with roles and order; how a stream is credited to artists (in this exercise every primary and featured artist on a track is credited with the stream, and a listener is counted once per artist per day); follow and unfollow events and the follower number; claims and team access; and the daily aggregates per artist with the minimum-listener rule. Explain how merges and splits change past numbers, and what an artist sees after one.

**Constraints.** An artist sees only aggregates, never individual listeners. Breakdown cells with fewer than {{min_listeners}} listeners are suppressed, and a suppressed cell cannot be recovered by subtracting other published numbers. The follower count on the profile and in analytics must agree after the daily refresh. Credit changes from rights holders are applied from a stated date and leave an audit trail.

**Assumptions.** Counts, shares and the threshold are hypothetical. The stream-counting rule (what counts as a stream) is this exercise's rule and is given upstream; this question starts from counted streams. Songwriter and producer credits are displayed but do not receive stream credit in this exercise.

**Clarifications.**
- Q: Does a featured artist's listener count include listeners of the track? | A: Yes, in this exercise. A listener who streams a track with a featured artist is a listener of both artists that day.
- Q: What happens to follows when two profiles are merged? | A: The merged profile keeps the union of followers; a listener who followed both counts once.
- Q: How does a split decide which follows go where? | A: It often cannot. Say what you would do and what the artist sees.
- Q: Who can see a profile's analytics? | A: Members of the profile's team after the claim is verified, with roles you define.
- Q: Are follower numbers real-time? | A: The profile can show a rounded live number; analytics refresh daily. They must agree after the refresh.

**Hints.**
1. Keep the profile identity stable and record merges and splits as events that map old ids to new ones, rather than rewriting history in place.
2. Credits are a bridge between tracks and artists with a role and an order, versioned by effective date.
3. Daily facts per artist are additive for streams but not for listeners; distinct listeners need their own computation at each grain you publish.

**Follow-ups.**
1. Draw artists, credits and follows. How does one stream of a track with two primary artists and one featured artist appear in each artist's daily facts?
2. Two duplicate profiles are merged. Show the follower count before and after, and what each artist's past daily numbers show.
3. A profile mixed two artists with the same name for a year. How do you split streams, follows and saves, and what do you tell each artist?
4. Prove that the city breakdown with the {{min_listeners}}-listener threshold cannot be undone by subtracting the country total and the other cities.
5. A label re-delivers credits for a back catalogue, moving some featured artists to primary. Which numbers change, from which date, and how is that visible?

**Follow-up rules.**
- when: artist_id on the track, artist column, single artist → ask: A track has two primary artists and a featured artist. How does your track row express that, and how does each of them get credit for a stream?
- when: follower_count, follower count, counter → ask: Follow and unfollow events for one listener arrive out of order after a retry. What does your counter show, and how does the daily refresh fix it?
- when: merge, merged → ask: After a merge, an artist asks why last year's monthly listeners changed. Do you restate history or only change numbers from the merge date, and why?
- when: sum listeners, add listeners, sum of listeners → ask: Can you add a primary artist's listeners and a featured artist's listeners to get the listeners of the track? What do you store to answer distinct counts correctly?
- when: threshold, suppress, suppression → ask: A cell has 49 listeners and the country total is published. How does a reader reconstruct it, and what does your suppression do about it?

**Production Reality Check.**
- Two artists with the same name were merged by mistake; for a week one artist's profile showed the other's releases, and with about {{daily_follows}} follow changes a day, thousands of new follows went to the wrong artist before the split.
- A credits re-delivery moved featured artists to primary on {{featured_share}} of a label's catalogue and was applied to all history; artists whose past numbers dropped opened support tickets.
- The country total and the city breakdown were refreshed at different times, and for a small city the difference revealed a suppressed cell below {{min_listeners}} listeners.

**Evaluation Criteria.** Stable profile identity with merge and split events mapping ids; credits as a versioned bridge with roles and order; streams credited per the stated rule with distinct listeners computed per grain, never summed; follows as events with a derived, reconcilable count; claims and team roles controlling access; suppression with complementary-cell protection and consistent refresh; restatement policy for merges, splits and credit changes; each incident contained, corrected and guarded.

## SPT-L3-04: Playback across devices — handoffs, remote control, offline plays and private sessions

| | |
|---|---|
| **Template ID** | SPT-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / device registry, playback state and segments, controller versus player, offline upload, private-session flags |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_listeners": {"1": ["20 million"], "2": ["100 million", "200 million"], "3": ["300 million", "500 million"]},
  "device_mix": ["phone, desktop and smart speaker", "phone, car and smart speaker", "phone, TV, games console and smart speaker"],
  "offline_days": [7, 30],
  "events_per_day": ["20 billion", "60 billion"]
}
```

**Business Scenario.** About {{daily_listeners}} listeners a day play music, podcasts and audiobooks on several devices: in this scenario mostly {{device_mix}}. In this exercise one device plays for an account at a time: starting playback on a second device moves it there, and a phone can act as a remote control for a speaker while the speaker plays. Downloaded items play offline and their plays are reported when the device reconnects; in this exercise a device must reconnect at least every {{offline_days}} days to keep downloads. A listener can start a private session, whose plays are not shown in social features and not used as personalisation inputs, but still count as plays under this exercise's counting rule. Devices send about {{events_per_day}} playback events a day (start, progress, pause, seek, skip, transfer, remote command). Analysts want minutes by device type, handoffs between device types, and offline listening; artists receive play counts; each listener sees their own listening history.

**Problem Statement.** Design the data model from raw playback events to analytical facts. Cover: the device registry (type, app version, owner account, a device used by several accounts); the raw event schema with ids and the clocks it carries; how events become playback segments (continuous playback of one item on one device) and how a handoff and a remote-control command are represented; which device is the player and which the controller; offline plays uploaded later; the private-session flag and where it must travel; and the facts that answer "minutes per device type and day", "handoffs between device types per month" and "share of listening that was offline".

**Constraints.** A play is counted once, on the device that played it, never on the controller. Private-session plays never reach social features or personalisation inputs, and the flag survives a handoff. Offline plays are attributed to when they happened, not to when they were uploaded, and a closed reporting period changes only by a documented restatement. A listener's own history may show their own detail; every other consumer sees aggregates.

**Assumptions.** Volumes, the device mix and the offline window are hypothetical. Devices carry clocks that can be wrong by minutes; the server records a receive time. Each event has a client-generated event id and a per-device sequence number.

**Clarifications.**
- Q: What is a handoff? | A: Playback of the same item continuing on another device within a few seconds near the same position. You define the window and tolerance.
- Q: Does the controller phone send play events? | A: It sends remote commands. The speaker sends the play events. Both carry the account and the session.
- Q: Can two people use the same speaker? | A: Yes. The account playing is on each event; the device is shared.
- Q: How late can offline plays arrive? | A: Up to {{offline_days}} days in this exercise, and occasionally later from devices that were lost and found.
- Q: Does a private session end on its own? | A: In this exercise it ends after a period of inactivity or when the listener turns it off. Model the boundary explicitly.

**Hints.**
1. Keep three layers: raw events as received, cleaned segments (one item, one device, continuous), and facts.
2. Order events by device and sequence number, not by device clock; record client time, server receive time and your chosen event time separately.
3. Make the playback session (one account's continuous listening across devices) an entity that carries the private flag, so a handoff inherits it.

**Follow-ups.**
1. Show the rows that one evening produces: start on a phone, transfer to a speaker controlled from the phone, pause, and finish in a car.
2. Where is the private-session flag stored, and how do you prove it never reaches the personalisation inputs?
3. Offline plays from the last {{offline_days}} days arrive after the month closed. Which facts change, and what does the monthly report say?
4. A device's clock is ten minutes fast. Which of your measures are wrong, and how does sequence number plus receive time repair them?
5. At {{events_per_day}} events a day, how do you build segments incrementally when progress events for one segment span midnight and arrive out of order?

**Follow-up rules.**
- when: client timestamp, device time, client_ts → ask: The device clock is wrong by minutes. Which ordering and which day does your segment use, and how do you detect the skew?
- when: controller, remote control, remote command → ask: Both the phone and the speaker send events while the phone controls playback. Which one counts the play, and what stops it being counted twice?
- when: private session, private_session, private flag → ask: The listener transfers playback from a phone in a private session to a speaker. How does the speaker's play know it is private?
- when: offline → ask: Offline plays arrive {{offline_days}} days late, after last month was reported. Do you restate the month, add them to the current month, or both? Who sees which number?
- when: event_id, dedupe, deduplicate → ask: A device resends a batch after a timeout with new event ids but the same sequence numbers. How does your dedupe hold up?

**Production Reality Check.**
- After an app release, phones acting as remote controls began sending their own play events, and minutes on smart speakers were counted twice for listeners on the {{device_mix}} mix until the release was rolled back.
- A batch of devices reconnected after {{offline_days}} days offline and uploaded weeks of plays; last month's closed minutes per device type rose and the published report no longer matched.
- The private-session flag was set only on the device where the session started; after a handoff to a speaker, private plays reached the personalisation inputs for a day.

**Evaluation Criteria.** Raw events, segments and facts as distinct layers; device registry with shared devices; player versus controller made explicit with plays counted only on the player; ordering by device sequence with client, receive and event times kept apart; dedupe by event id and by device sequence; private flag carried on the session and enforced at the consumer boundary; offline plays attributed by occurrence with a restatement policy; aggregates for everyone but the listener; each incident contained, corrected and guarded.

## SPT-L3-05: Device handoffs — playback that continued on another device near the same position

| | |
|---|---|
| **Template ID** | SPT-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / next row per listener (LEAD), interval and tolerance boundaries, month attribution, private-session exclusion |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SPT-L3-05.mjs |

**Business Scenario.** A streaming service records playback as segments: a segment is continuous playback of one item (a track `trk_…` or an episode `ep_…`) on one device, with the item position where it started and where it stopped. In this exercise one device plays for a listener at a time, so a listener's segments never overlap. A listener who moves from their phone to a speaker, or from a car to a desktop, produces a segment that ends on one device and a segment that starts on another a few seconds later, near the same position. The product team wants to know how often playback moves between device types, month by month. The sample covers {{months}}: {{listeners}} listeners, {{devices}} devices and {{segments}} segments, all hypothetical.

**Problem Statement.** Write one PostgreSQL query that returns `month, from_device_type, to_device_type, handoffs, listeners`, one row per combination with at least one handoff, ordered by `month, from_device_type, to_device_type`. For each segment A, take the same listener's next segment B, in order of `started_at` and then `segment_id`. The pair is a handoff when all of these hold (this exercise's rule):
- B is on a different `device_id` than A (two phones are two devices; that pair is reported as `phone`, `phone`);
- B plays the same `item_id` as A;
- B starts no earlier than A ended and at most 10 seconds after it: `A.ended_at <= B.started_at <= A.ended_at + 10 seconds`;
- B's `start_position_ms` is within {{tol_s}} seconds ({{tol_ms}} ms) of A's `end_position_ms`, in either direction, inclusive;
- neither A nor B has `private_session` true. A private segment is still a segment: it can be another segment's next one.

`month` is the UTC month of B's `started_at` as text `YYYY-MM`. `from_device_type` and `to_device_type` are the types of A's and B's devices. `handoffs` counts the pairs, and `listeners` counts the distinct listeners with at least one of them in that row.

**Constraints.** One SQL statement (CTEs allowed). Every boundary is inclusive: exactly 10 seconds, and exactly {{tol_ms}} ms apart, still count. Only the listener's next segment can be B, never a later one. Production holds billions of segments a month.

**Assumptions.** Hypothetical schema, listeners, devices and items. Timestamps are stored to the second, positions in milliseconds. A device belongs to whoever is playing on it; `devices` holds only its type.

**Clarifications.**
- Q: What if the listener resumes on the same device after a pause? | A: Not a handoff: the device_id is the same.
- Q: Two speakers of the same type? | A: A handoff if they are different device_ids; it is reported as speaker → speaker.
- Q: Which month does a handoff at midnight belong to? | A: The month in which B started, in UTC.
- Q: The next segment is a different track on another device, at a similar position? | A: Not a handoff: the item must be the same.
- Q: Should I drop private segments before finding the next segment? | A: No. They still happened; they are only excluded from being either side of a reported handoff.

**Hints.**
1. `LEAD(...) OVER (PARTITION BY listener_id ORDER BY started_at, segment_id)` gives each segment's next one without a self-join over all later segments.
2. Join `devices` for both sides after you have the pairs, so each side gets its own type.
3. `b.started_at <= a.ended_at + INTERVAL '10 seconds'` and `ABS(b.start_position_ms - a.end_position_ms) <= {{tol_ms}}` keep both boundaries inclusive.

**Follow-ups.**
1. Extend the result with the median gap in seconds per row. Which function do you use, and what does it cost at production volume?
2. Product wants handoffs as a share: handoffs ÷ segments that ended on the from-device type. Write the denominator so a device type with no handoffs still appears.
3. A listener switches devices mid-track but the new device starts the next track because of a queue sync delay. Would you widen the rule to the next item in the queue? What breaks?
4. At billions of segments a month, how do you compute this incrementally, given that a handoff can span midnight and a month boundary?

**Follow-up rules.**
- when: self join, self-join, any later segment → ask: Your join matches every later segment within 10 seconds. A listener resumed briefly on the same device and then moved. How many handoffs does your query count for that move?
- when: device_type <>, different device type, device types differ → ask: The listener moved from one phone to another phone. Is that a handoff under the rule, and does your condition keep it?
- when: where not private_session, filter private, exclude private → ask: Did you remove private segments before or after finding each segment's next one? Walk through public → private → public on three devices.
- when: ended_at → ask: Which segment's time decides the month: the one that ended or the one that started? Check a handoff a few seconds either side of midnight on the first of a month.
- when: abs → ask: Good. What does your tolerance do at exactly {{tol_ms}} ms, and why does the direction of the difference not matter?

**Production Reality Check.**
- Device clocks drift: a car head unit's clock ran a few seconds slow, so its segments appeared to start before the phone's ended and fell outside the `A.ended_at <= B.started_at` rule; car handoffs dropped in the report for a month.
- A client release reported `start_position_ms` in seconds for one device type; positions near zero never fell within {{tol_ms}} ms of the previous end position, and handoffs to that device type vanished.

**Evaluation Criteria.** The next segment per listener (LEAD with a deterministic tie-break) rather than any later one; all five conditions with inclusive boundaries and an absolute position difference; device id compared, device type reported; month from B's start in UTC; private segments excluded from both sides but kept when finding the next one; distinct listeners per row; deterministic ordering; can discuss clock skew, units contracts and incremental computation across month boundaries.
