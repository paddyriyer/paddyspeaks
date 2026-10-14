# Spotify · Loop 2 — evaluator notes (hidden from candidates)

## SPT-L2-01

**Reference solution**

```python reference
def apply_queue(context, ops):
    # Sentinels are tuples, so they can never equal a string entry id.
    HEAD, SPLIT, TAIL = ("head",), ("split",), ("tail",)
    nxt = {HEAD: SPLIT, SPLIT: TAIL}
    prv = {SPLIT: HEAD, TAIL: SPLIT}

    def link_after(a, e):
        b = nxt[a]
        nxt[a] = e
        prv[e] = a
        nxt[e] = b
        prv[b] = e

    def unlink(e):
        a = prv.pop(e)
        b = nxt.pop(e)
        nxt[a] = b
        prv[b] = a

    for e in context:
        link_after(prv[TAIL], e)
    playing = None
    for op in ops:
        kind = op[0]
        if kind == "next":
            link_after(HEAD, op[1])
        elif kind == "add":
            link_after(prv[SPLIT], op[1])         # end of the queued part
        elif kind == "remove":
            if op[1] in prv:                      # still in the queue
                unlink(op[1])
        elif kind == "move":
            e, after = op[1], op[2]
            if e not in prv or after == e or (after is not None and after not in prv):
                continue
            unlink(e)
            link_after(HEAD if after is None else after, e)
        elif kind == "advance":
            first = nxt[HEAD]
            if first is SPLIT:                    # queued part empty: take from the context
                first = nxt[SPLIT]
            if first is TAIL:
                playing = None
            else:
                unlink(first)
                playing = first
    out, e = [], nxt[HEAD]
    while e is not TAIL:
        if e is not SPLIT:
            out.append(e)
        e = nxt[e]
    return (playing, out)
```

**Explanation.** Every operation names an entry, so the structure must find an entry and its neighbours in O(1): a doubly linked list stored in two dicts, `prv` and `nxt`, keyed by entry id. Three sentinels make every rule an ordinary insert. `HEAD` is the front, so "play next" and a move with `after=None` link after it. `SPLIT` sits between the two parts, so "add to queue" links before it (after `prv[SPLIT]`). `TAIL` ends the queue. The two-part rule for moves needs no extra code: linking `e` right after `after` puts it on `after`'s side of `SPLIT`, which is exactly "takes `after`'s part". An entry is in the queue exactly when it is a key of `prv`, which makes the ignored operations one dict lookup each. `advance` takes the first real node, stepping over `SPLIT` when the queued part is empty.

**Complexity.** O(1) per operation and O(n) to walk the result, so O(C + Q) overall. The timing test (150 000 context entries, 150 000 edits) runs in about 0.5 s in CPython. A Python list with `index`, `insert` and `pop(0)` shifts or compares O(n) elements per edit; measured on 200 000 entries and 200 000 edits, it was still running after 300 s, against 0.7 s for the linked list. A `deque` helps only at the ends; removes and moves still cost O(n).

**Dialect notes.** In Java the same design is a `HashMap<String, Node>` over a hand-written doubly linked list (`LinkedHashMap` cannot insert in the middle). In C++ `std::list` plus an `unordered_map<string, list::iterator>` gives O(1) splices (`splice` moves an element without copying). In a database, ordered lists are usually stored with a sort key per item (fractional indexes) and read with `ORDER BY`, which trades O(1) edits for occasional renumbering. Not executed here.

**Edge cases built into the tests.** Two "play next" requests (the later plays first); "add" after earlier adds and before the context; "add" with nothing queued; advance taking queued entries first; advance on an empty queue (`None`); removing a played entry; "add" after the queued part has emptied; removing the only context entry, then adding; (Hard) a context entry moved to the front joining the queued part; a queued entry moved after a context entry joining the context; a move after the last queued entry staying queued; a move to the place it already is; (Very Hard) a move after itself; a move after a removed entry; a move of a played entry; advancing past the end, then queueing again.

**Common mistakes.** Using a counter of queued entries and positions, which breaks when moves cross the boundary; deciding an entry's part from its id or from where it came from instead of where it now is; two separate lists that cannot move an entry across in O(1); unlinking `e` before checking that `after` is valid (the entry vanishes when the move is ignored); treating `after == e` as "stay"; forgetting that `SPLIT` is not an entry when walking the result or advancing; `list.index` in the hot path.

**Follow-up guidance.** (1) Walk from `HEAD` to `SPLIT` for "Next in queue" and on from `SPLIT` for the context; to show the first 50, walk 50 steps. Counts per part can be kept as counters updated on each link and unlink (a move across `SPLIT` changes both). (2) Keep the original context order (or a version of it) and apply shuffle as a separate order over context entries; turning shuffle off reorders the context part by the original order and keeps removals and moved entries, by a rule the candidate states. (3) Send the final order with a revision number, and the edit log since the last sync; two devices editing at once is the collaborative-playlist problem (SPT-L2-05) in miniature: a single order of operations, operations by entry id. (4) Materialise the context lazily: keep it as an index into the playlist plus a set of edited entries; a move that names an entry far down forces only that entry (and its neighbours) into the linked structure.

**Rubric anchors.** 2: a list-based simulation that is correct on small inputs but fails the timing test, or one that gets the part rules wrong after moves. 3: all tests pass with a linked list over dicts. 4: also uses a boundary sentinel and explains why it makes the part rule fall out, states the invariant ("in the queue iff in `prv`"), and answers the display, shuffle and cross-device follow-ups concretely.

**Strong signals.** Asks what identifies an entry when a track is queued twice; asks which part a moved entry belongs to before coding. **Red flags.** "Lists are fast enough in practice" without sizing; positions as identifiers.

## SPT-L2-02

**Reference solution**

```python reference
from bisect import bisect_right


def pick_highlights(clips, min_gap=0):
    order = sorted(clips, key=lambda c: c[2])          # by end
    ends = [c[2] for c in order]
    # best[i] = best (total, -count) using only the first i clips in end order
    best = [(0, 0)] * (len(order) + 1)
    for i, (_cid, start, _end, score) in enumerate(order):
        j = bisect_right(ends, start - min_gap, 0, i)  # clips ending at or before start - gap
        total, neg = best[j]
        take = (total + score, neg - 1)
        best[i + 1] = take if take > best[i] else best[i]
    total, neg = best[-1]
    return (total, -neg)
```

**Explanation.** This is weighted interval scheduling. Sort clips by end time. `best[i]` is the best selection among the first `i` clips. Clip `i` is either left out (`best[i]`), or taken together with the best selection among clips that end at or before `start_i - min_gap`. Because clips are sorted by end, those clips form a prefix, found with one `bisect_right` (the `<=` boundary: a clip ending exactly at `start - min_gap` is compatible). Comparing `(total, -count)` tuples applies both rules at once: higher total first, then fewer clips. The search is limited to `hi=i`; every clip at position `i` or later ends after `start_i`, so none of them could be compatible anyway.

**Complexity.** O(n log n) for the sort and the binary searches, O(n) memory. The timing test (80 000 clips over four hours, up to 20 minutes long) runs in about 0.1 s in CPython. Walking back from each clip to the last compatible one costs O(n × overlap): about 17 s on 60 000 such clips. Comparing every earlier clip is O(n²), billions of steps.

**Dialect notes.** In Java or C++ use a sorted array of ends with `Arrays.binarySearch` adapted to "last ≤ x" or `std::upper_bound`, and pack `(total, -count)` into a `long` (for example `total * 2^20 - count`) to compare in one step. In SQL this DP does not express well (it needs a recursive CTE with a max over a range per row); a batch job would run it per episode in a UDF. Not executed here.

**Edge cases built into the tests.** Touching clips (compatible); one second of overlap; no clips (`(0, 0)`); the highest-scoring clip not in the best set; earliest-end greedy losing; unsorted input; (Hard) a score tie broken by fewer clips (one long clip versus two halves), a clip scored 0, two clips with the same end; (Very Hard) a gap of exactly `min_gap` (allowed), one second short (not allowed), and touching clips that are no longer compatible when a gap is required.

**Common mistakes.** Greedy by score or by earliest end; `bisect_left` (drops the clip that ends exactly at the boundary) or `start` instead of `start - min_gap`; sorting by start and then binary searching ends that are not sorted; maximising the total but ignoring the count, or counting clips scored 0; recursion with `lru_cache` that hits Python's recursion limit at 80 000; returning the clips' scores as floats.

**Follow-up guidance.** (1) A length budget makes it a knapsack over intervals: `best[i][len]`, O(n × budget), feasible at 90 seconds with 1-second granularity, or a Lagrangian penalty per second if exactness is not needed. (2) Keep a choice bit per `i` (taken or not) and walk back from the end; a stated tie rule (for example prefer the selection whose clips start earliest) has to be applied inside the comparison, not after. (3) One task per episode, idempotent, writing reels keyed by episode and scoring version; compare old and new reels on agreed metrics (coverage of the episode, score under both functions, listener sampling outcomes in an experiment) rather than "the new score is higher", which is circular. (4) Snap boundaries to the nearest sentence start and end before the DP; the algorithm is unchanged, but clips may collapse into duplicates, which should be merged keeping the best score.

**Rubric anchors.** 2: greedy, or a quadratic DP that fails the timing test, or the tie rule missed. 3: all tests pass with sort-by-end plus bisect. 4: also states why the compatible clips form a prefix, gets the gap boundary right first time with the right bisect, and gives a careful answer on the length budget or reconstruction.

**Strong signals.** Asks whether touching clips overlap; produces a three-clip counterexample to greedy unprompted. **Red flags.** Trusting the score function's numbers as if they were the goal ("the highest score is best") with no word on how the reel is judged.

## SPT-L2-03

**Reference solution** (the fixed report)

```python reference
from datetime import date

DAY = 86400


def _window(as_of):
    """The 28 days ending with as_of, as [start, end) in seconds of local time."""
    end = (date.fromisoformat(as_of) - date(1970, 1, 1)).days * DAY + DAY
    return end - 28 * DAY, end


def artist_audience(plays, tracks, artists, as_of):
    start, end = _window(as_of)
    streams = {a: 0 for a in artists}
    listeners = {a: set() for a in artists}
    for p in plays:
        if p["ms"] < 30_000:                              # exactly 30 seconds counts
            continue
        info = tracks[p["track"]]                         # removed tracks still count
        for a in [info["primary"], *info["featured"]]:    # every credited artist
            local = p["ts"] + artists[a] * 60             # the artist's own calendar
            if start <= local < end:
                streams[a] += 1
                listeners[a].add(p["listener"])           # a person, not a device
    return {a: {"streams": streams[a], "listeners": len(listeners[a])} for a in artists}
```

**The planted bugs, their symptoms and their fixes.**
1. **Exactly 30 seconds is dropped.** `if p["ms"] <= 30_000: continue` skips a play of exactly 30 000 ms. Symptom: the "test listen of exactly half a minute never shows up" complaint, and a small undercount everywhere. Fix: skip only `< 30_000`.
2. **Featured artists are not credited.** Only `info["primary"]` is counted. Symptom: a featured artist on a hit sees zero streams and zero listeners for it. Fix: loop over the primary and every featured artist.
3. **Listeners counted per device.** The set holds `(listener, device)` pairs. Symptom: one person on a phone, a laptop and a speaker counts as three listeners. Fix: add the listener id only.
4. **The window is taken in UTC.** `start <= p["ts"] < end` compares UTC seconds with a window that is meant to be in the artist's local calendar. Symptom: an artist at UTC+9 sees the day roll over at 09:00 local time, in the middle of their morning; an artist at UTC−5 loses the evening of `as_of`. Fix: compare `ts + offset * 60`, per credited artist, inside the artist loop.
5. **Removed tracks are dropped.** The `live` dict leaves out removed tracks, so their past plays vanish. Symptom: a month of plays disappears when a label takes a track down. Fix: look the track up in `tracks` regardless of `removed`.

Each bug has its own check that the other bugs do not affect: a single play of exactly 30 000 ms, a single play of a track with a featured artist, one listener on two devices, a play of a removed track (all at local noon in the middle of the window), and plays around local midnight for artists at UTC+9 and UTC−5 at both ends of the window. The Hard check "one play near midnight falls inside the window for one credited artist and outside it for the other" needs bugs 2 and 4 both fixed, and is a good prompt to discuss why the window check must sit inside the artist loop.

**Explanation.** The report has four independent rules (what counts, who is credited, which calendar, who is a listener) plus one about data that must not be filtered (removed tracks). The subtle one is the window: once a play is credited to several artists in different time zones, the window check has to be made per artist, not once per play.

**Complexity.** O(P × A) where A is the number of artists on a track (at most a few), so linear in the plays; memory O(artists + distinct listener-artist pairs). The timing test is 200 000 plays.

**Dialect notes.** In SQL the same report is a join from plays to a `track_artists` bridge table (one row per credited artist), a filter `ms >= 30000`, a window on `(ts AT TIME ZONE artist_tz)::date BETWEEN as_of - 27 AND as_of`, and `COUNT(*)`, `COUNT(DISTINCT listener_id)` grouped by artist, with a left join from artists for zeros. A join to a "current catalogue" view reproduces bug 5. Not executed here.

**Edge cases built into the tests.** Exactly 30 000 ms and 29 999 ms; a featured artist; one listener on two devices; a removed track; 20:00 UTC on `as_of` for an artist at UTC+9 (outside); 03:00 UTC the day after for an artist at UTC−5 (inside); the first second of the window's first local day and the second before it; an artist with no plays; (Hard) one play that is inside for one credited artist and outside for another; (Very Hard) the day boundary for an artist at UTC+5:30, one second either side.

**Common mistakes.** Fixing the featured credit but keeping one window check per play; converting with the listener's time zone instead of the artist's; using `zoneinfo` names when the data gives offsets; fixing the device bug by counting devices per listener; filtering removed tracks "because they are not in the catalogue"; rewriting the report rather than making minimal fixes.

**Follow-up guidance.** (1) Decide whether history follows the profile's time zone at the time of each day or the current one, and say so on the report; recomputing with the new zone shifts every day's boundary. (2) Remove the person's plays from the stored daily aggregates and recompute the artist's 28-day numbers; small numbers can make a single departure visible, so reports with very few listeners are best shown with a threshold or rounded (aggregates only). (3) Store per artist and local day a mergeable distinct sketch or, where exact counts are required, a per-day set of listener ids; daily distinct counts cannot be summed because the same listener appears on many days. (4) Credits are versioned; recompute the affected window under the corrected credit and show the change with a note, keeping the old numbers in history.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, every check passes, each bug explained with its complaint. 4: also moves the window check inside the artist loop and explains why, adds a check per bug, and answers the distinct-count and deletion follow-ups with a concrete storage plan.

**Strong signals.** Maps each artist complaint to a bug before touching code; asks whose time zone the window uses. **Red flags.** "Counting devices is close enough"; dropping removed tracks to "match the catalogue".

## SPT-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Registry.** `feeds (feed_id, url, host, show_id, state active|moved|dead, etag, last_modified, last_hash, next_fetch_at, publish_rate)`. `shows (show_id, canonical_feed_id)`. A show has one canonical feed and may have aliases (old URLs, duplicates) pointing at it.
- **Scheduler.** Each feed's next fetch time comes from its observed publishing rate: feeds that publish daily or weekly are fetched often enough to meet the {{freshness}} target around their usual publishing times; dormant feeds back off to once a day or less. Push notifications, where a host supports them, move a feed's next fetch to now; polling continues as a safety net. A per-host token bucket enforces the agreed rate, and a host's queue is fair across its feeds.
- **Fetching.** Conditional GET (`If-None-Match`, `If-Modified-Since`); a 304 ends the work. A 200 body is hashed; an unchanged hash ends the work. Errors, timeouts and implausible bodies (an empty feed, a feed a tenth of its usual size) are recorded and do not produce changes.
- **Snapshots and diffs.** Each changed feed is parsed into a normalised item list and stored as an immutable version (`feed_id, version, fetched_at, hash, items`). The change set is computed against the previous good version: new items, changed items, missing items.
- **Episode identity.** `episodes (episode_id, show_id, …)` with an `episode_keys (show_id, key_type guid|enclosure|title_date, key, episode_id)` table. Matching tries the GUID, then the enclosure URL (normalised), then title plus publication date. A match on a fallback key with a changed GUID is recorded as a re-key, not a new episode, so listener libraries keep their ids.
- **Edits.** Metadata changes update the episode with a new revision. A changed enclosure (new audio) creates a new audio version for the same episode id; the audio is fetched, checked (format, duration, loudness or validity checks) and only then made live; plays keep the audio version they used.
- **Removals.** A missing item is "missing since version V" first; it is unpublished only after it has been missing from N consecutive good fetches or for a grace period, and never when the feed looks truncated (far fewer items than usual, or the missing items are exactly the oldest ones while the host is known to trim). Creators can also remove episodes explicitly through the creator tools.
- **Moves and duplicates.** A feed that declares a new URL, or a second submission whose items match an existing show's episodes on enclosure or title-plus-date above a threshold, becomes an alias; episodes are matched across feeds with the identity table, and the canonical feed switches once the new one is confirmed (verification through the show's owner contact or a token in the feed).
- **Audit and support.** Every episode change carries the feed version and rule that caused it. The support view for a show lists recent fetches (status, 304, unchanged, changed), parse errors, and per-episode history with the reason an item was not published (missing audio, invalid enclosure, duplicate, held because of a suspected truncation).

**Competing designs to accept.** Push-first with polling fallback; a simpler fixed-interval schedule with conditional requests if the candidate sizes it and shows it fits the host limits; storing only diffs instead of full snapshots, if a feed can still be reconstructed for audits; a stream of change events (episode created, updated, unpublished) consumed by catalogue, search and notifications.

**Bottlenecks and failure modes.** Fixed-interval polling of all {{shows}} feeds wasting fetches; one slow host blocking a shared worker pool; very large feeds ({{largest_feed}}) parsed in full on every change; GUID churn duplicating episodes; truncated feeds unpublishing back catalogues; audio replaced in place under listeners; per-host limits breached after an outage when everything is due at once.

**Follow-up guidance.** (1) The 50-item fetch looks truncated (the missing items are the oldest, and the item count fell sharply): hold, mark missing, change nothing for listeners; the next full fetch clears the marks. (2) Alias the new feed to the show, match episodes by enclosure or title-plus-date into the existing episode ids, record re-keys, and switch the canonical feed after verification; the old feed is polled rarely until it dies. (3) A new audio version with a new duration: listeners halfway through resume by proportion or restart with a note, by a stated rule; analytics attribute plays to the audio version, so completion rates are not mixed across versions. (4) Per-host token buckets with a catch-up queue ordered by staleness and publishing rate; other hosts keep their own buckets, so they are not starved. (5) The audit trail per episode and per fetch; the support view shows the last fetches and the reason for each held or rejected item.

**Rubric anchors.** 2: poll every feed on a timer, key episodes on GUID only, delete what disappears. 3: adaptive scheduling with conditional requests and host limits, versioned snapshots and diffs, a stable episode id with fallback keys, grace-period removals. 4: also handles truncated feeds and host migrations explicitly, versions audio separately from metadata, and designs the support view from the audit trail.

**Strong signals.** Separates the catalogue's identity from the feed's identifier first; asks what a truncated feed looks like. **Red flags.** "Re-import the whole feed and replace the show's episodes"; no thought for the hosts' capacity.

## SPT-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Model.** `playlist (playlist_id, owner, revision)`, `items (playlist_id, item_id, track_id, added_by, added_at, sort_key, removed_at)`. An item is one appearance of a track; the same track twice is two items.
- **Operations.** `add(item_id, track_id, after_item_id)`, `remove(item_id)`, `move(item_id, after_item_id)`, `rename`, `set_collaborative`, each with `client_op_id`, `device_id`, `account_id` and `base_revision`. Operations name items, never positions.
- **Ordering.** The server is the single orderer per playlist: it appends accepted operations to a per-playlist log with consecutive revision numbers (a conditional write on the revision or a single writer per playlist partition). `client_op_id` makes retries idempotent.
- **Rebasing.** Because operations refer to item ids, most operations apply unchanged to the latest revision. Rules: a move or remove of an item that no longer exists is a no-op recorded in history ("item already removed by X"); a move after an anchor that was removed resolves to the anchor's nearest surviving predecessor at the time of removal; concurrent moves of the same item are ordered by revision, so the later one wins and both appear in history; duplicate adds of the same track are two items unless the client sent the same `client_op_id`.
- **Offline.** A reconnecting device sends its queued operations with its `base_revision`. They are applied in its own order after the current head, each rebased as above, unless the device's account lost edit rights before the operation's local time, in which case it is rejected and the device is told. The device then pulls the operations since its base to converge.
- **Ordering keys.** The current order is materialised with sort keys (fractional indexes between neighbours) so that reads are an index scan and a move is one row update; keys that grow too long trigger a rebalance written as an ordinary operation.
- **Storage.** The operation log is the source of truth; snapshots every N operations (or when the log since the last snapshot exceeds a size) make reads cheap: snapshot plus tail. History = the log, with who and when; restore = an operation that sets the order and membership to the version at revision R, appended as a new revision.
- **Analytics.** Events per accepted operation (playlist id, operation type, collaborator count bucket, device type) for aggregate reporting of collaboration; no listening data is joined at the person level.

**Competing designs to accept.** A sequence CRDT (RGA, Logoot, LSEQ or similar) with peer-to-peer convergence and no central orderer; operational transformation over positions (accept if the candidate shows the transformation rules and why item ids are simpler); last-writer-wins on a whole-list document only for very small playlists with a clear statement of the edits it loses. Each must say how convergence is guaranteed.

**Bottlenecks and failure modes.** Positions instead of ids (offline edits land in the wrong place); clock-based last-writer-wins (a fast clock wins every conflict); a hot playlist at a party exceeding a single writer's throughput with {{collaborators}} editors (batch operations per request, coalesce moves of the same item); unbounded logs without snapshots; sort keys that grow without bound; restore implemented as a rewrite that breaks offline devices' base revisions.

**Follow-up guidance.** (1) Removes of items still present apply; removes of already-removed items are no-ops; moves are applied in the device's order after the head with anchor resolution; the device pulls 2 000 operations (or a snapshot) to converge, possibly after {{offline_window}}. (2) Both see their own move instantly, then the server's order; the later revision wins; history shows both moves. (3) A restore operation at a new revision; an offline operation based on an earlier revision is rebased onto the restored state like any other (an item absent after the restore makes its move a no-op). (4) Track the length of sort keys; rebalance a range by writing new keys as one operation; clients mid-edit continue because their operations name items, not keys. (5) Counts of operations per playlist and per collaborator bucket per day, active collaborators per playlist, conflict and no-op rates; no per-person listening data.

**Rubric anchors.** 2: whole-playlist overwrite or positions with last-writer-wins; no history. 3: item ids, a per-playlist operation log with revisions, rebasing rules, snapshots, restore as a new change. 4: also explicit outcomes for every conflict type with history entries, an offline and permission story, sort-key rebalancing, and a convergence argument the interviewer can check.

**Strong signals.** Separates item from track in the first minute; asks what an offline device knows. **Red flags.** "Use timestamps to pick the latest version"; locks for editing.
