# Spotify · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an audio
streaming service for music, podcasts and audiobooks: playlists, listening across
devices, follows, artist and creator analytics and yearly listener summaries.
Every workload, number, rule and schema is hypothetical, and nothing here
describes how any company's systems, recommendations, rankings or stream counting
are actually built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SPT-L2-01: Play queue edits: the final order after play next, add to queue, remove, move and skip

| | |
|---|---|
| **Template ID** | SPT-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Data structures / doubly linked list over a dict, sentinels, O(1) edits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | SPT-L2-01.mjs |

**Business Scenario.** A listener starts a playlist or an album, and the player builds a queue from it. While it plays, the listener edits the queue: "play next" on one track, "add to queue" on a few more, removing a track they changed their mind about, dragging an entry to a new place, and skipping ahead. The queue the listener sees has two parts: entries the listener queued themselves come first, and the rest of the playlist or album (the context) follows. A long-running session on a smart speaker can collect hundreds of thousands of edits against a very long context, and the client replays the edit log to rebuild the queue after a restart. The rebuild must be fast and give exactly the order the listener saw.

**Problem Statement.** Implement `apply_queue(context, ops)`. `context` is the list of entry ids from the playlist or album, in play order. Each entry id is unique and is never reused, even after the entry has played or been removed. Every entry belongs to one of two parts, and the queue always shows the whole *queued* part followed by the whole *context* part. Context entries start in the context part. Apply the operations in order (these are this exercise's rules, not a description of any real player):
1. `('next', e)` puts the new entry `e` at the very front of the queue, in the queued part.
2. `('add', e)` puts the new entry `e` at the end of the queued part, immediately before the first context-part entry (or at the end of the queue if the context part is empty).
3. `('remove', e)` takes `e` out of the queue. If `e` is not in the queue (it already played or was removed), nothing changes.
4. `('move', e, after)` takes `e` out and puts it immediately after entry `after`, in `after`'s part. If `after` is `None`, `e` goes to the very front, in the queued part. If `e` or `after` is not in the queue, or `after == e`, nothing changes.
5. `('advance',)` is a skip or the end of a track: the first entry of the queue leaves it and becomes the one now playing. If the queue is empty, nothing is playing any more.

Return `(now_playing, queue)`: the entry now playing (`None` if nothing has been advanced to, or the last advance found the queue empty) and the list of entry ids in queue order. {{op_rule}}

**Constraints.** Up to 150 000 context entries and 150 000 operations. Every operation must take constant time on average. Searching a Python list with `list.index` and inserting with `list.insert` costs O(n) per edit, which is far too slow at this size.

**Assumptions.** Entry ids, queue sizes and the two-part rule are hypothetical and simplified. The same track can appear in the queue twice as two different entries, which is why the operations use entry ids. New entries in `next` and `add` never repeat an id seen before. There is no shuffle or repeat in this exercise.

**Clarifications.**
- Q: If I add three entries with "add to queue", in what order do they play? | A: In the order they were added: each one goes after the queued entries already there, just before the context.
- Q: Does "play next" go in front of entries queued earlier? | A: Yes. It goes to the very front, so two "play next" entries play in reverse order of the requests.
- Q: Which part does a moved entry belong to? | A: The part of the entry it is placed after; an entry moved to the front (`after` is `None`) joins the queued part. So a context entry can become queued and a queued entry can join the context.
- Q: What should a remove or move of an entry that already played do? | A: Nothing. The entry is no longer in the queue, and the operation is ignored.
- Q: What does `now_playing` start as? | A: `None`. It changes only on `advance`, and an advance on an empty queue sets it back to `None`.

**Hints.**
1. Every operation names an entry, not a position. What structure lets you find an entry, unlink it and insert next to it without shifting anything else?
2. Store `prev` and `next` for each entry in two dicts. Add sentinel nodes so that "the front", "the end of the queued part" and "the end of the queue" are ordinary nodes you can insert after or before.
3. One sentinel between the two parts does all the work for "add to queue" and for deciding which part a moved entry ends up in. Check that it does.

**Follow-ups.**
1. The client must show "Next in queue" and "Next from: <playlist>" as two headed lists. How do you produce both from your structure, and how would you show the first 50 entries without walking the whole queue?
2. The listener turns on shuffle for the context part only, and later turns it off. What do you store so that turning shuffle off restores the original order with the edits kept?
3. The queue must survive the app restarting on another device mid-session. Do you send the edit log, the final order or both, and how do you keep the two devices from diverging if both edit at once?
4. A very long context (a 10 000-track playlist) is mostly never reached. How would you avoid materialising all of it while still applying moves that name entries far down the list?

**Follow-up rules.**
- when: .index(, .insert(, pop(0), list.remove → ask: Each of those is O(n). With 150 000 entries and 150 000 edits, how many element shifts or comparisons is that in the worst case?
- when: deque → ask: A deque is fast at both ends. Which of the five operations touch the middle of the queue, and what does a deque cost there?
- when: sentinel, dummy node, boundary node → ask: Which sentinels do you have, and how does the one between the two parts decide where "add to queue" and a moved entry go?
- when: positions, index numbers, fractional index → ask: How would you renumber when two moves keep inserting between the same pair of entries, and what does the ordering cost to read?
- when: two lists, separate lists, user queue and context → ask: An entry moved after a context entry must join the context. How do your two lists handle a move across the boundary in constant time?

**Evaluation Criteria.** Exact final order and now-playing entry; "play next" in front, "add to queue" at the end of the queued part; moved entries take the part of the entry they follow, and `None` means the front of the queued part; ignored operations on entries no longer in the queue and on `after == e`; advance on an empty queue returns `None`; O(1) per operation with a dict-based doubly linked list and sentinels; a clear complexity argument; credible answers on two-part display, shuffle and cross-device state.

## SPT-L2-02: Episode highlights: the best set of non-overlapping clips under a score you are given

| | |
|---|---|
| **Template ID** | SPT-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / weighted interval scheduling with binary search |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | SPT-L2-02.mjs |

**Business Scenario.** A podcast app can show a short reel of highlights from an episode so that listeners can sample it before they commit to two hours. An upstream step proposes many candidate clips for each episode, with a start, an end and a score from a scoring function you are given (you do not need to know how it works). Candidate clips overlap heavily: the same moment appears in several clips of different lengths. A reel must not play the same second twice, so the chosen clips cannot overlap. The reel should have the highest total score. This step runs for every new episode as it is published.

**Problem Statement.** Implement `pick_highlights(clips, min_gap=0)`. `clips` is a list of `(clip_id, start_s, end_s, score)`; each clip covers the half-open range `[start_s, end_s)` of the episode, in seconds, with `end_s > start_s`. Choose a set of clips in which every two clips, taken in order of start, satisfy `later.start_s - earlier.end_s >= min_gap`. With `min_gap = 0` that means they do not overlap, and a clip ending at second 120 may be followed by one starting at 120. Return `(total_score, clip_count)` for the set with the highest total score; when several sets tie on the total, return the one with the fewest clips. An empty list returns `(0, 0)`. {{gap_rule}}

**Constraints.** Up to 80 000 clips per episode, starts up to four hours into the episode and clips up to 20 minutes long, so a single moment can sit inside thousands of clips. Scores are non-negative integers below 1 000. O(n log n) is expected. A DP that looks at every earlier clip for each clip is O(n²), and walking back from each clip to the first compatible one is O(n × overlap), and neither finishes in time.

**Assumptions.** Scores and clip boundaries are hypothetical and come from a scoring function you are given. Clip ids are unique. Clips are given in no particular order. The reel has no length limit in this exercise.

**Clarifications.**
- Q: Do two clips that touch, one ending at 120 and the next starting at 120, overlap? | A: No, ranges are half-open. With `min_gap = 0` both may be chosen. With a positive `min_gap` they may not.
- Q: Why return the count and not the clip ids? | A: Several selections can tie on total and on count. The pair `(total, count)` with the fewest-clips rule is unique, so it can be checked exactly.
- Q: Can a score be 0? | A: Yes. A clip scored 0 never raises the total, and the fewest-clips rule keeps it out.
- Q: Are clips sorted? | A: No. Sort them yourself if your approach needs it.

**Hints.**
1. Sort the clips by end time. For clip `i`, the best selection that ends with clip `i` uses clip `i` plus the best selection among clips that end at or before `start_i - min_gap`.
2. That set of clips is a prefix of the sorted order. Find where it stops with `bisect` on the list of end times.
3. Compare `(total, -count)` tuples: one `max` then applies both rules at once.

**Follow-ups.**
1. Producers want the reel to be at most 90 seconds long. What changes in your DP, and what does the extra dimension cost?
2. Return the chosen clip ids too, with a deterministic rule for ties. Which rule would you pick, and how do you reconstruct the choice from the DP table?
3. The scoring function changes and every episode in a back catalogue of millions must be re-cut. How would you run this as a batch, and how do you check that the new reels are not worse by some measure you can defend?
4. Some clips must not be cut mid-sentence: you are also given sentence boundaries. How would you snap clip ends to them before selection, and does that change the algorithm?

**Follow-up rules.**
- when: greedy, highest score first, earliest end first → ask: Give three clips where your greedy choice loses to another set. What does the greedy rule ignore?
- when: sort by start, sorted by start → ask: If you sort by start, which earlier clips are compatible with clip i, and are they still a contiguous block you can binary search?
- when: bisect, binary search → ask: With `min_gap` greater than 0, what exact value do you search for, and do you use bisect_left or bisect_right? Show the clip that sits exactly on the boundary.
- when: memo, lru_cache, recursion → ask: How deep does your recursion go with 80 000 clips, and what does Python do at that depth?
- when: float, seconds as float → ask: Clip boundaries come from a model as floating-point seconds. Where could comparing them exactly go wrong, and how would you make the boundary rule exact?

**Evaluation Criteria.** Correct `(total, count)` with fewest clips on ties; half-open ranges, so touching clips are compatible when `min_gap` is 0; `min_gap` applied at its exact boundary; `(0, 0)` for no clips; clips scored 0 left out; sort by end plus binary search for the last compatible clip, O(n log n); no recursion that overflows; a clear argument why greedy fails; sensible answers on length limits, reconstruction and batch re-cuts.

## SPT-L2-03: Debug the artist audience report

| | |
|---|---|
| **Template ID** | SPT-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Analytics code / counting rules, credits, distinct listeners, local-time windows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, analytics-engineer, senior-data-engineer, software-engineer, staff-data-engineer |
| **Generator** | SPT-L2-03.mjs |

**Business Scenario.** Artists see a small report of their audience over the last 28 days: how many streams their music had and how many different listeners played it. Several artists have written in. One says a track they were featured on, a hit, shows no streams for them at all. One says their listener count is higher than the number of people they know listened, and those people listen on a phone, a laptop and a speaker. One, based in Tokyo, says their numbers change in the middle of their morning, not at midnight. One says a whole month of plays disappeared when their label took an old track down. Another noticed that a test listen of exactly half a minute never shows up. The report function below is the suspect.

**Problem Statement.** Fix `artist_audience(plays, tracks, artists, as_of)` so that it meets this specification. These are this exercise's rules, not a description of how any real service counts streams. {{report_rule}}
1. **Inputs.** `plays` is a list of `{"listener", "device", "track", "ts", "ms"}`: `ts` is the play's start in UTC epoch seconds and `ms` the milliseconds played. `tracks` maps a track id to `{"primary": artist, "featured": [artists], "removed": bool}`; every played track is in it, and `featured` never repeats the primary artist. `artists` maps every artist named on a track to a fixed UTC offset in minutes (no daylight saving in this exercise). `as_of` is a date, `"YYYY-MM-DD"`.
2. **Streams.** A play counts as a stream when `ms` is at least 30 000. Shorter plays count for nothing.
3. **Credits.** Each stream is credited to the track's primary artist and to every featured artist.
4. **Window.** For each artist, only streams that started within the 28 calendar days ending with `as_of` count, where the calendar day is the artist's own local day (UTC time plus the artist's offset). So the window starts at local midnight 27 days before `as_of` and ends at local midnight after `as_of`.
5. **Removed tracks.** A track removed from the catalogue since still counts for the plays that happened.
6. **Listeners.** The number of distinct listener ids with at least one counted stream for the artist. A listener on several devices is one listener.
7. **Output.** `{artist: {"streams": n, "listeners": m}}` for every artist in `artists`, including those with zeros.

**Constraints.** Keep the function's name, arguments and output format. Up to 200 000 plays, processed in linear time.

**Assumptions.** All ids, offsets, thresholds and windows are hypothetical. Each play is delivered once. Offsets are whole or half hours between UTC−12 and UTC+12.

**Clarifications.**
- Q: Is a play of exactly 30 seconds a stream? | A: Yes, 30 000 ms or more counts.
- Q: Whose time zone defines the window when a track has artists in two places? | A: Each artist's own. The same play can fall inside the window for one credited artist and outside it for another.
- Q: Does a featured artist also get the listener? | A: Yes. Streams and listeners are both credited to every artist on the track.
- Q: Should removed tracks be skipped because they are no longer in the catalogue? | A: No. The plays happened, so they count.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Read the 30-second check out loud with the value 30 000.
2. Make a track with one featured artist, play it once, and read what the report says for that artist.
3. Take a play at 20:00 UTC on `as_of`. What is the local date for an artist at UTC+9, and does the code see the same date?
4. What exactly goes into the listener set?

**Follow-ups.**
1. An artist changes their profile's time zone. Do last month's numbers change, and what should the report say about it?
2. The report must also be correct for listeners' deletions: a listener who deletes their account. What do you recompute, and how do you avoid exposing that one person left?
3. Distinct listeners over 28 days across millions of artists is too expensive to recompute from raw plays every day. What would you store per day, and why are daily distinct counts not enough on their own?
4. A label disputes the featured credit on a track, and it is corrected a week later. How do the past 28 days look before and after, and what does the artist see?

**Follow-up rules.**
- when: hll, hyperloglog, approximate → ask: An artist with 40 listeners sees 42. Where would you use an approximate count and where must it be exact?
- when: zoneinfo, pytz, timezone, tzinfo → ask: This exercise uses fixed offsets. What changes for an artist in a region with daylight saving, on the day the clocks change?
- when: utc, utc date → ask: Which date does a play at 22:00 UTC belong to for an artist at UTC+9, and for one at UTC−5?
- when: listener and device, per device, each device → ask: What is the device for in this report, and where would counting per device ever be the right answer?
- when: removed, takedown, catalogue → ask: Which questions should still count plays of a removed track, and which should not?

**Evaluation Criteria.** Finds and explains every bug with the complaint it causes; 30 000 ms counts; featured artists credited with streams and listeners; listeners distinct across devices; the window taken in each artist's local calendar, at its exact boundaries; removed tracks still counted; zeros reported; the fix stays minimal and linear; adds a regression check per bug.

## SPT-L2-04: Podcast episode ingestion from hosting feeds

| | |
|---|---|
| **Template ID** | SPT-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / feed polling, episode identity, edits, removals, duplicate feeds |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "shows": {"2": ["300,000", "800,000"], "3": ["4 million", "6 million"]},
  "freshness": ["15 minutes", "1 hour"],
  "largest_feed": ["2,000 items", "10,000 items"],
  "hosts": [40, 200, 900]
}
```

**Business Scenario.** Many podcasts are hosted outside the streaming service: the show's hosting provider publishes an RSS feed, and the show's creator submits that feed once. From then on the service reads the feed and keeps the show's episodes in its catalogue up to date. There are {{shows}} submitted shows across about {{hosts}} hosting providers. Creators expect a new episode to appear within {{freshness}} of being published. Feeds are written by many different systems and are not always tidy: episodes are edited after release, removed, re-published under a new identifier, and the largest feeds hold {{largest_feed}}. Some shows also move to a new host, and for a while two feeds describe the same show.

**Problem Statement.** Design the pipeline that keeps the catalogue in step with the feeds. Cover how you schedule fetching so that active feeds are fresh and dormant ones are cheap, how you fetch politely and cheaply (conditional requests, per-host limits), how you parse and validate a feed, how you decide whether an item is a new episode, an edit of a known one or a re-publication, what a removal looks like and what you do about it, how you handle a show that moves to a new feed or is submitted twice, where audio files are fetched and checked, and what you record so that support can explain to a creator why an episode did or did not appear.

**Constraints.** Every change to an episode must be traceable to the feed version that caused it. An episode that disappears from a feed for one fetch because of a host error must not vanish from listeners' libraries. A feed can be very large, and most fetches return nothing new. Hosting providers must never see more requests than an agreed per-host rate.

**Assumptions.** Show counts, freshness targets, feed sizes and host counts are hypothetical. Feeds are RSS with each item carrying a title, a publication date, an audio enclosure URL and usually a unique identifier (a GUID). Some hosts can notify subscribers of updates by a push protocol; most cannot. Specific feed tags that announce a move to a new feed URL exist, but support for them varies by host (this exercise's rule; check current docs).

**Clarifications.**
- Q: Can I rely on the GUID being stable? | A: Mostly. Some hosts change GUIDs when they migrate, and a few feeds have no GUID at all, so you need a fallback.
- Q: What counts as an edit? | A: A changed title, description, artwork, publication date or audio file for the same episode. A changed audio file matters most, because it changes what listeners hear and the episode's duration.
- Q: What should happen when an item disappears from a feed? | A: That is your design decision. The creator may have removed it on purpose, or the host may have truncated the feed to its latest items.
- Q: Are listener libraries and play history in scope? | A: Only as consumers: they hold episode ids, so episode identity must not change under them.
- Q: How fresh must a dormant show be? | A: Dormant shows still need to notice a new episode, but the {{freshness}} target applies to shows that publish regularly.

**Hints.**
1. Separate the catalogue's episode id from the feed's identifier. Map one to the other, so that a GUID change does not create a new episode id for listeners.
2. Store every fetched feed version (or its normalised item list) with a content hash, and compute the change set by comparing with the previous version. Most fetches then end at "unchanged".
3. Schedule each feed by how often it actually publishes, and use conditional requests, so that most fetches are cheap and dormant feeds are polled rarely.

**Follow-ups.**
1. A host returns a feed with only the latest 50 items, and next hour returns all {{largest_feed}} again. What does your pipeline do in each fetch?
2. A show moves to a new host. For two weeks both feeds exist, with different GUIDs for the same episodes. How do you keep one show and one episode id per episode?
3. A creator replaces an episode's audio with an edited version, ten minutes shorter. What do listeners who were halfway through see, and what do analytics do with plays of the old version?
4. A host goes down for six hours, then comes back and every one of its feeds changes at once. How do you catch up without breaking the per-host limit or starving other hosts?
5. Support must answer "why is my episode not showing" within minutes. What do you keep, and what does the support view show?

**Follow-up rules.**
- when: guid, unique identifier → ask: Two feeds for the same show give different GUIDs for the same episode. What else would you match on, and how sure must you be before merging?
- when: delete, hard delete, remove from catalogue → ask: The host served a truncated feed for one fetch. What did your rule just do to the listeners who had those episodes saved?
- when: poll every, cron, fixed interval → ask: At {{shows}} shows and a {{freshness}} target, how many fetches an hour is that, and how many of them return nothing new?
- when: websub, webhook, push → ask: Most hosts cannot push. How do push and polling share one scheduler, and what if a push is lost?
- when: hash, etag, if-modified-since → ask: A host ignores conditional headers and returns the full feed every time. What does your pipeline do with a full body that has not changed?

**Evaluation Criteria.** A stable catalogue episode id mapped from feed identifiers with a fallback; versioned feed snapshots and diff-based change sets; adaptive per-feed scheduling with conditional requests and per-host limits; a removal rule that tolerates truncated or failed fetches; explicit handling of edits, especially audio replacement; duplicate and moved feeds merged into one show deliberately; audio fetched and validated separately from metadata; an audit trail support can read; a credible plan for each follow-up.

## SPT-L2-05: Collaborative playlist edits from many devices

| | |
|---|---|
| **Template ID** | SPT-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / concurrent list edits, operation logs, offline merges, version history |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "playlists": {"2": ["40 million", "120 million"], "3": ["800 million", "1.5 billion"]},
  "collaborators": [5, 20, 50],
  "offline_window": ["3 days", "30 days"],
  "max_tracks": ["10,000", "50,000"]
}
```

**Business Scenario.** Any playlist can be made collaborative: the owner invites friends, and every collaborator can add, remove and reorder tracks. There are about {{playlists}} collaborative playlists. A popular one at a party has up to {{collaborators}} people editing it from their phones at the same time, while a desktop app and a speaker show it. Phones can go offline on a plane or in the underground and keep editing for up to {{offline_window}} before they reconnect. Playlists can hold up to {{max_tracks}} tracks. People expect every device to settle on the same playlist, no edit to vanish without a reason, and the owner to be able to see who changed what and to go back to an earlier version.

**Problem Statement.** Design how playlist edits are recorded, ordered, merged and stored. Cover the identity of a playlist item (versus a track), the operations a client sends and what each one refers to, how concurrent edits from several devices are ordered and merged, how an offline device's edits are applied when it reconnects much later, what happens when two edits conflict (a move of an item someone else removed, two people moving the same item, the same track added twice), how the current playlist and its history are stored and read cheaply, how version history and restore work, and what the analytics events for collaboration look like.

**Constraints.** Every device must converge to the same order. A reconnecting device must not overwrite other people's changes with its stale copy. Reading the current playlist must be fast for {{max_tracks}} tracks. History must be kept so that the owner can restore an earlier version, which is itself a new change, not a rewrite of history.

**Assumptions.** Counts, windows and sizes are hypothetical. Each client has a stable device id and the user's account id. The service has a durable store and can order writes for one playlist. You may choose between server-ordered operation logs, revision checks with rebasing, and CRDT-style sequences; say what you give up with each.

**Clarifications.**
- Q: Can the same track be in a playlist twice? | A: Yes, as two items. Removing one must not remove the other.
- Q: What does a client send for a reorder? | A: Your decision. Positions as indexes, or the item ids it should go after, or a sort key.
- Q: Who wins when two people move the same item at once? | A: Your decision, but every device must agree and nobody's edit may be lost silently: the loser should be explainable from history.
- Q: Does an offline device know what others changed? | A: No. It edits its last copy and sends its operations when it reconnects, possibly {{offline_window}} later.
- Q: Can the owner remove a collaborator? | A: Yes. Edits that collaborator made before removal stay; edits they made offline after removal must be rejected.

**Hints.**
1. Give every added item its own id and make every operation refer to item ids, not to index positions. An index is only meaningful in one version of the list.
2. Order operations per playlist with a revision number. A client sends the revision its edit was based on; the server rebases operations that refer to items, and rejects or transforms the rest.
3. Store the operation log as the source of truth with periodic snapshots: read = latest snapshot plus the operations since; history and restore = replay to a revision.

**Follow-ups.**
1. A phone reconnects after {{offline_window}} with 40 moves and 3 removes against a playlist that has since changed 2 000 times. Walk through what the server does with each kind of operation.
2. Two collaborators move the same item at the same moment, to different places. What does each device show a second later, and what does history say?
3. The owner restores last Tuesday's version. What exactly is written, and what happens to an edit that arrives from an offline phone based on a revision before the restore?
4. Sort keys between neighbours (fractional indexes) keep growing when people repeatedly insert in the same gap. How do you detect it and rebalance without breaking clients that are mid-edit?
5. What events would you emit so that product analytics can report collaboration per playlist without storing which person listened to what?

**Follow-up rules.**
- when: index, position → ask: A client sends "move position 4 to position 9" based on revision 30, and the server is at revision 33 with an insert at position 2. What does your server do?
- when: last write wins, lww, timestamp → ask: Whose clock decides, and what happens to a phone whose clock is three hours fast?
- when: crdt, rga, fractional index, lseq → ask: What does your sequence store per item, how large does that grow for a {{max_tracks}}-track playlist, and how do you compact it?
- when: lock, locking, mutex → ask: A collaborator on a plane holds the lock. How does anyone else edit?
- when: snapshot, event sourcing, operation log → ask: How often do you snapshot, and how long does the slowest read take at {{collaborators}} editors making changes every few seconds?

**Evaluation Criteria.** Item ids distinct from track ids; operations that reference items, not positions; a single order of operations per playlist with explicit rebasing or a sequence CRDT, and a stated convergence argument; defined outcomes for remove-versus-move, concurrent moves and duplicate adds, each explainable from history; offline edits applied without overwriting newer changes, and edits from removed collaborators rejected; an operation log with snapshots for fast reads, history and restore-as-a-new-change; analytics events that report collaboration in aggregate; credible answers to the follow-ups.
