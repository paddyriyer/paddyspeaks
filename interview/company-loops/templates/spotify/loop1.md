# Spotify · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an audio streaming
service: music, podcasts and audiobooks, playlists (including collaborative ones),
listening across devices, follows, artist and creator analytics, and yearly listening
summaries. Every listener, number, rule and schema is hypothetical, and nothing here
describes how any company's systems, rankings or stream counts actually work. Listener
data appears only in aggregate, or as a listener's own data shown to that listener.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SPT-L1-01: Collaborative playlists: who adds, and whose additions others remove

| | |
|---|---|
| **Template ID** | SPT-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LEAD per (playlist, track), pairing an event with the next one, deduplication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SPT-L1-01.mjs |

**Business Scenario.** A music app lets a playlist's owner invite friends to edit it together: anyone in a collaborative playlist can add tracks and remove them. The product team wants to know how collaboration goes in practice: how many tracks each collaborator adds to each playlist, and how often an addition is taken out again quickly by someone else, a sign of disagreement about what belongs on the playlist.

**Problem Statement.** Write one PostgreSQL query that returns `playlist_id, user_id, additions, removed_by_others, removed_share`: one row per playlist and user with at least one addition, ordered by `playlist_id, user_id`. `additions` counts the user's `add` events in the playlist. An addition's **removal** is the next event for the same playlist and track, in `event_ts, event_id` order, if that event is a `remove`. `removed_by_others` counts the user's additions whose removal was made by a **different** user **within 24 hours** of the addition (at most 24 hours after it). `removed_share = removed_by_others / additions`, rounded to 4 decimal places. {{scope_rule}} {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). Exactly 24 hours counts as within 24 hours; 24 hours and one second does not. A removal by the user who added the track never counts. The sample has {{playlists}} playlists and {{events}} event rows.

**Assumptions.** Hypothetical playlists, users and events. Timestamps are UTC. The event log is the only source: there is no table of the playlist's current contents.

**Clarifications.**
- Q: Who counts as a collaborator? | A: Anyone with at least one addition in the playlist; the owner included.
- Q: A track is added, removed by its adder, and added again by someone else. Which removal belongs to which addition? | A: Each addition is paired with the next event for that playlist and track only. The first addition's removal is the self-removal; a later removal belongs to the re-add.
- Q: Is a removal exactly 24 hours later within 24 hours? | A: Yes. At most 24 hours after the addition counts.
- Q: Two events for the same track have the same timestamp. | A: `event_id` breaks the tie.
- Q: How is the share rounded? | A: `ROUND(…, 4)` of removed_by_others over additions, half away from zero.

**Hints.**
1. `LEAD(action)`, `LEAD(user_id)` and `LEAD(event_ts)` over `PARTITION BY playlist_id, track_id ORDER BY event_ts, event_id` give each addition the event that follows it.
2. Keep only `add` rows after the window function, not before it: filtering first throws away the removals you are looking for.
3. If rows can repeat, remove the copies before `LEAD`; a doubled addition would otherwise become its own "next event".

**Follow-ups.**
1. The product team also wants "additions still on the playlist today". How would you get that from the same log, and what changes if the log has gaps?
2. Collaborators edit offline, and their edits arrive hours later with device timestamps. What does that do to "within 24 hours" and to the pairing of add and remove?
3. Rank playlists by how contentious they are. Why is `removed_share` alone a poor ranking for playlists with three additions, and what would you use instead?
4. At hundreds of millions of playlist events a day, how would you compute this daily without rescanning history, when a removal can arrive up to 24 hours after the addition it closes?

**Follow-up rules.**
- when: self join, join on track_id, exists → ask: A track was removed and added back twice. Which removals does your join attach to the first addition, and should it?
- when: where action = 'add', filter adds → ask: If you filter to additions before the window function, what does LEAD return?
- when: distinct, dedup, duplicate → ask: A retried addition is logged twice. Without deduplication, what is the first copy's next event, and how does that change removed_by_others?
- when: interval, 24 hours, 86400 → ask: Is your comparison inclusive at exactly 24 hours, and what would a 23-hour day do if you compared calendar times instead?
- when: owner, owner_id → ask: Does the owner removing a friend's addition count, and does your query treat the owner differently from anyone else?

**Evaluation Criteria.** Pairs each addition with the next event for its playlist and track, in a deterministic order; counts only removals by someone else; inclusive 24-hour bound; collaborative playlists only (Hard+); duplicates collapsed before LEAD (Very Hard); correct counts, rounding and order; can discuss offline edits, small-sample ranking and incremental computation.

## SPT-L1-02: Release-day share of first-week streams, at each market's local midnight

| | |
|---|---|
| **Template ID** | SPT-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / time zones with AT TIME ZONE, local calendar days, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SPT-L1-02.mjs |

**Business Scenario.** A streaming service releases a new album at midnight local time in each market, so the release rolls around the world over a day. The label team asks, for each album and market, how front-loaded the first week was: the share of first-week streams that happened on release day itself. Streams are logged as UTC instants; each market has one time zone for releases.

**Problem Statement.** Write one PostgreSQL query that returns `album_id, market, first_week_streams, release_day_streams, release_day_share`, ordered by `album_id, market`. A stream's **local date** is its `stream_ts` in the market's time zone (`markets.tz`). Its **day number** is its local date minus the album's `release_date`. Release day is day 0, and the **first week** is days 0 to 6. `first_week_streams` counts the pair's streams in the first week, `release_day_streams` those on day 0, and `release_day_share` is their ratio rounded to 4 decimal places. {{week_rule}} {{min_rule}} {{dst_rule}}

**Constraints.** One SQL statement (CTEs allowed). Each row in `streams` is one stream: this exercise's counting rule has already been applied. The sample has {{streams}} streams in {{markets}} markets.

**Assumptions.** Hypothetical albums, markets, release dates and streams. Real markets can span several time zones; here each market has one zone for releases.

**Clarifications.**
- Q: Is release day the first 24 hours after release? | A: It is the local calendar date of release in the market. On a day the clocks change it is 23 or 25 hours long.
- Q: A stream at exactly local midnight at the start of release day. | A: Day 0: it counts in both columns.
- Q: Does the first week end after 168 hours? | A: It ends at local midnight at the end of day 6. Compare local dates, not elapsed hours.
- Q: Which time zone applies, the listener's or the market's? | A: The market's (`markets.tz`), for every stream in that market.
- Q: How is the share rounded? | A: `ROUND(…, 4)` of release_day_streams over first_week_streams, half away from zero.

**Hints.**
1. `(stream_ts AT TIME ZONE m.tz)::date` is the local date; subtracting two dates in PostgreSQL gives an integer number of days.
2. Compute the day number once in a CTE, filter to days 0–6, then count with `COUNT(*) FILTER (WHERE day_no = 0)`.
3. Never add an interval of hours to a local midnight to find the end of the week: a clock change inside the week moves the boundary by an hour.

**Follow-ups.**
1. Labels want the same share by hour of release day, in local time. What does the hour axis look like in a market whose clocks change that day?
2. A market spans several time zones. Should release follow each listener's zone or one zone per market, and how would either choice change this report?
3. The streams table grows by billions of rows a day. How would you partition and pre-aggregate so this report reads days, not raw streams, and what grain must the aggregate keep to stay correct across time zones?
4. Streams arrive up to three days late from offline devices. When is a first-week number final, and how would you show a number that is still moving?

**Follow-up rules.**
- when: date(stream_ts), ::date, utc → ask: Which calendar does your date come from? A stream at 00:30 in Tokyo on release day: what UTC date does it have?
- when: interval '7 days', 168, + interval → ask: What happens to your week boundary when the clocks fall back inside the week?
- when: between → ask: Your BETWEEN covers which day numbers exactly? Is day 7 inside it?
- when: listener time zone, user time zone → ask: The release rule is per market. What would per-listener zones change, and which number would a label then compare across markets?
- when: partition, pre-aggregate, rollup → ask: If you pre-aggregate by UTC hour, can you still compute local days for a market at UTC+5:30?

**Evaluation Criteria.** Local dates in the market's zone; day numbers by date arithmetic; first week as days 0–6 with exact boundaries at local midnight (Hard+); the minimum floor as "at least" (Hard+); robust to a clock change inside the week (Very Hard); correct counts, rounding and order; can discuss late data and pre-aggregation grain.

## SPT-L1-03: Yearly summary: a listener's own top five artists

| | |
|---|---|
| **Template ID** | SPT-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-partition top-N with ROW_NUMBER, deterministic tie-breaks, filtered aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SPT-L1-03.mjs |

**Business Scenario.** Each year a streaming service shows every listener a personal summary of their listening. One card lists the listener's top five artists of the year by minutes listened. Only the listener sees their own summary. The card must be reproducible: computed again from the same plays, it must list the same five artists in the same order.

**Problem Statement.** Write one PostgreSQL query that returns `listener_id, artist_rank, artist_id, minutes` for the year {{year}}, ordered by `listener_id, artist_rank`. A play **counts** when `ms_played` is at least 30 000 (this exercise's rule) and `played_at` is in {{year}} (UTC). A track's artist is `tracks.artist_id`. For each listener, rank the artists with counted plays by total counted `ms_played` descending; equal totals are ordered by the artist's **first counted play** (earliest `played_at` first), then by `artist_id`. Return ranks 1 to 5 (fewer if the listener has fewer artists). `minutes` is the total counted milliseconds divided by 60 000, rounded to 1 decimal place. {{scope_rule}}

**Constraints.** One SQL statement (CTEs allowed). Exactly five rows per listener with five or more artists, even when totals tie. A play of exactly 30 000 ms counts. The sample has {{plays}} plays by {{listeners}} listeners.

**Assumptions.** Hypothetical listeners, artists and plays; one artist per track. The 30-second rule, the tie-break and the private-session rule are this exercise's rules, not any product's.

**Clarifications.**
- Q: Do short plays count toward anything, such as the first play? | A: No. A play under 30 seconds is not a counted play; it neither adds minutes nor decides a tie.
- Q: Two artists tie for fifth place. | A: The one the listener played first (first counted play) is fifth; the other is not shown.
- Q: Which year boundaries? | A: From {{year}}-01-01 00:00:00 UTC inclusive to {{next_year}}-01-01 00:00:00 UTC exclusive.
- Q: Is ranking on the rounded minutes? | A: No. Rank on total milliseconds; round only for display.
- Q: How are minutes rounded? | A: `ROUND(total_ms / 60000.0, 1)`, half away from zero.

**Hints.**
1. Filter to counted plays first, then aggregate per listener and artist: `SUM(ms_played)` and `MIN(played_at)`.
2. `ROW_NUMBER() OVER (PARTITION BY listener_id ORDER BY total_ms DESC, first_play, artist_id)`; `RANK()` would let a tie return six rows.
3. Use a half-open range on `played_at` for the year rather than `EXTRACT(YEAR …)` or `BETWEEN`.

**Follow-ups.**
1. The summary must be computed once for hundreds of millions of listeners and shown on a fixed date. How would you compute top five per listener without one global sort?
2. A listener deletes some of their history after the summary was computed. What should happen to the card, and how would you support it?
3. Listeners in Sydney and Honolulu see their year end at different instants. What would change if the year were the listener's local year, and which plays move?
4. A track credits two artists. How would you split or share minutes, and how would you explain the choice on the card?

**Follow-up rules.**
- when: rank(), dense_rank → ask: Two artists tie for fifth. How many rows does your query return for that listener?
- when: extract(year, date_part, between → ask: Is a play at exactly midnight on {{next_year}}-01-01 inside your year, and should it be?
- when: min(played_at), first play → ask: Does your first play include plays under 30 seconds, and can a short play decide a tie?
- when: round(, minutes → ask: Do you rank on rounded minutes or on milliseconds? Give a case where the two disagree.
- when: limit 5 → ask: LIMIT applies to the whole result. How do you get five rows per listener?

**Evaluation Criteria.** Counted plays filtered before aggregation (30-second rule inclusive, year as a half-open UTC range, private sessions excluded at Hard+); ranking on milliseconds with the first-counted-play tie-break and `artist_id` last; exactly five rows via ROW_NUMBER; correct rounding and order; can discuss scale, deletions and local years.

## SPT-L1-04: Playlist reorder: the fewest track moves

| | |
|---|---|
| **Template ID** | SPT-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Dynamic programming / longest increasing subsequence by patience sorting, hash maps |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | SPT-L1-04.mjs |

**Business Scenario.** A listener edits a long playlist on one device and the new order must reach their other devices. Rather than resend the whole playlist, the sync sends a small diff: removals, additions and single-track moves ("take this track and put it there"). The fewer moves, the smaller the diff and the less it disturbs anyone listening on another device. You are writing the function that says how small the diff can be.

**Problem Statement.** Implement `reorder_moves(old, new)`. `old` and `new` are the playlist's track ids before and after the edit, in playlist order. Return `(removed, added, moves)`: the number of entries in `old` that are not in `new`, the number of entries in `new` that are not in `old`, and the fewest moves that put the entries kept from `old` into the order they have in `new`. A move takes one entry and puts it anywhere else in the list. {{churn_rule}} {{dup_rule}}

**Constraints.** Up to 200 000 entries in each list. A quadratic algorithm is far too slow at that size; aim for O(n log n).

**Assumptions.** Hypothetical playlists and track ids. Real sync protocols also carry versions and conflicts; this exercise counts the diff only.

**Clarifications.**
- Q: Does removing a track count as a move? | A: No. Removals and additions are counted separately and are never moves.
- Q: Why is the answer not the number of tracks whose position changed? | A: Moving one track shifts every track between its old and new place; those did not move themselves.
- Q: Two empty playlists? | A: `(0, 0, 0)`.
- Q: Does it matter where the moves happen? | A: No. Only how many are needed.

**Hints.**
1. Map each kept entry to its position in `old`, then read those positions in `new` order. The entries you do not move must already be in increasing order.
2. The fewest moves is the number of kept entries minus the longest increasing subsequence of that position sequence.
3. Patience sorting: keep `tails[k]` = the smallest possible last value of an increasing subsequence of length k + 1, and place each value with `bisect_left`.

**Follow-ups.**
1. Return the moves themselves, not just their number: which tracks move, and to where, in an order a client can apply one by one?
2. Two devices edit the same playlist offline. How would you merge two diffs computed against the same base, and which conflicts can you not resolve automatically?
3. The sync service sees millions of playlist edits an hour, most touching a few tracks of a long playlist. How would you avoid an O(n log n) pass over the whole playlist for each small edit?

**Follow-up rules.**
- when: lcs, longest common subsequence → ask: LCS of two lists of n entries is O(n²) in general. What property of these lists lets you do better?
- when: index(, list.index → ask: What does `list.index` cost inside a loop over 200 000 tracks, and what would you use instead?
- when: bisect, patience → ask: Is it `bisect_left` or `bisect_right`, and what would the other one do here?
- when: position changed, positions changed, count mismatches → ask: One track goes from the end to the top. How many positions changed, and how many moves were needed?
- when: duplicate, copies, same track twice → ask: A track appears twice in both lists. How do you decide which copy in old is which copy in new?

**Evaluation Criteria.** Reduces the problem to n − LIS over old positions in new order; O(n log n) with bisect; removals and additions kept out of the moves (Hard+); copies matched in order (Very Hard); correct empty and trivial cases; can explain why the LIS entries stay still and outline recovering the moves.

## SPT-L1-05: Album completion: the shortest stretch that plays a whole album

| | |
|---|---|
| **Template ID** | SPT-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sliding window / two pointers with counts, grouping and stable sorting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | SPT-L1-05.mjs |

**Business Scenario.** An artist analytics team wants an aggregate measure of how albums are listened to: do listeners take an album in one sitting, or reach every track over weeks of shuffled listening? The building block is, per listener, the shortest stretch of their own consecutive plays that contains every track of the album at least once. The function runs over each listener's plays in a batch job; only aggregates of its output ever reach a report.

**Problem Statement.** Implement `shortest_completion(plays, album)`. `album` is a list of distinct track ids. {{shape_rule}} {{short_rule}} For each listener, take their plays in order as a sequence and find the shortest run of consecutive plays that contains every album track at least once; plays of other tracks inside the run count toward its length. Return a dict `{listener_id: (length, start)}` where `start` is the run's 0-based index in that listener's own sequence; on a tie, the earliest start. Leave out listeners whose plays never contain the whole album.

**Constraints.** Up to 300 000 plays, an album of up to 30 tracks. Some album tracks are rare in a listener's history: trying every start position and scanning forward is far too slow.

**Assumptions.** Hypothetical listeners, tracks and plays. Ordering by play start is this exercise's rule; the output is an intermediate result for aggregate reporting, never shown per listener.

**Clarifications.**
- Q: Do another listener's plays break a stretch? | A: No. Each listener has their own sequence; other listeners' plays are not in it.
- Q: An album of one track? | A: The first play of that track: length 1.
- Q: Does an album track played twice inside the run matter? | A: It counts toward the run's length like any other play.
- Q: Empty input? | A: Return `{}`.

**Hints.**
1. Group plays per listener first; the problem is then independent per listener.
2. Expand a right pointer, counting album tracks in the window and how many distinct ones are present; while all are present, record the window and advance the left pointer.
3. Record only strictly shorter windows: as the right end moves forward, the first window of a given length you find has the earliest start.

**Follow-ups.**
1. Report per album the median completion length across listeners who completed it. What does leaving out non-completers do to that number, and how would you report them?
2. Plays arrive as a stream, per listener in order. How would you maintain each listener's current shortest stretch incrementally, and how much state per listener and album does that need?
3. You need this for 50 000 albums at once. Running the window once per album is too slow. How would you restructure the job?

**Follow-up rules.**
- when: for i in range, every start, nested loop → ask: How many steps does your scan take when one album track appears once every few thousand plays?
- when: set(, issubset → ask: Building a set per window costs its length. What would you keep instead so each step is O(1)?
- when: sorted(, sort( → ask: Is your sort stable, and do plays with equal timestamps keep their arrival order?
- when: counter, counts → ask: When the left pointer drops an album track whose count falls to zero, what must happen before you can record another window?
- when: dataframe, pandas → ask: How would you express "shortest window containing all tracks" in a dataframe, and what would it cost?

**Evaluation Criteria.** Per-listener sequences; a two-pointer window with counts and a distinct-present counter; strictly-shorter updates giving the earliest start; arrival-order input sorted stably by timestamp (Hard+); short plays removed before indexing (Very Hard); O(n) after grouping with a clear argument; credible discussion of streaming state and many albums.
