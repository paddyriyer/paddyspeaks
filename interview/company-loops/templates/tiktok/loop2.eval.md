# TikTok · Loop 2 — evaluator notes (hidden from candidates)

## TTK-L2-01

**Reference solution**

```python reference
def common_origin(remixes, pairs, deleted=frozenset()):
    # Integer index per video; parent = the source's index, -1 for an original.
    index, names, parent = {}, [], []
    for video, source in remixes:
        for v in (video, source):
            if v not in index:
                index[v] = len(names)
                names.append(v)
                parent.append(-1)
        parent[index[video]] = index[source]          # a repeated row writes the same value
    n = len(names)

    # Depth, family root and nearest non-deleted video (itself or above), without recursion:
    # walk up to the first video already done, then fill the path on the way back down.
    depth, top, alive = [-1] * n, [0] * n, [-1] * n
    for v in range(n):
        if depth[v] >= 0:
            continue
        path, u = [], v
        while u >= 0 and depth[u] < 0:
            path.append(u)
            u = parent[u]
        if u < 0:
            d, r, a = -1, path[-1], -1                # path[-1] is the original
        else:
            d, r, a = depth[u], top[u], alive[u]
        while path:
            u = path.pop()
            d += 1
            depth[u], top[u] = d, r
            if names[u] not in deleted:
                a = u
            alive[u] = a

    # Binary lifting: up[k][v] is v's 2**k-th source (an original points at itself).
    up = [[p if p >= 0 else i for i, p in enumerate(parent)]]
    for _ in range(1, max(max(depth, default=0).bit_length(), 1)):
        prev = up[-1]
        up.append([prev[p] for p in prev])

    out = []
    for a, b in pairs:
        x, y = index.get(a), index.get(b)
        if x is None or y is None or top[x] != top[y]:
            out.append(None)                          # unknown video, or separate families
            continue
        if depth[x] < depth[y]:
            x, y = y, x
        diff, k = depth[x] - depth[y], 0
        while diff:                                   # lift the deeper video to the same depth
            if diff & 1:
                x = up[k][x]
            diff >>= 1
            k += 1
        if x != y:
            for k in range(len(up) - 1, -1, -1):      # largest jumps first, while still apart
                uk = up[k]
                if uk[x] != uk[y]:
                    x, y = uk[x], uk[y]
            x = up[0][x]
        w = alive[x]                                  # skip deleted videos upwards
        out.append(names[w] if w >= 0 else None)
    return out
```

**Explanation.** The remix log is a forest: every video points at its source, and originals are roots. The nearest video both descend from is the lowest common ancestor (LCA) of the two nodes, where a node counts as its own ancestor. The reference maps ids to integers, computes each video's depth and family root iteratively (walking up only as far as the first video already done, so the whole pass is O(n)), and builds a binary-lifting table: `up[k][v]` is the 2ᵏ-th source of `v`, with originals pointing at themselves. For a pair in the same family, it lifts the deeper video by the depth difference using the binary digits of the difference; if the two are then equal, that video is the answer. Otherwise it jumps both videos by the largest powers of two that keep them apart; afterwards their sources are the same video, the LCA. Different family roots, or an unknown id, give `None`. At Very Hard, `alive[v]` is the nearest non-deleted video at or above `v`, computed in the same downward fill; since every common ancestor is the LCA or above it, the answer is `alive[LCA]`.

**Complexity.** O(n log D) time and memory to build, for n videos and maximum depth D, and O(log D) per pair, so O((n + q) log D) in total. The timing test (up to 4 chains 15 000 deep, about 90 000 videos, 15 000 pairs) runs in about 0.2 to 0.35 s in CPython. Building each table level is one list comprehension, which keeps the constant small.

**The naive and middle approaches, and what this sizing does to them.** The naive answer walks each video up to its original to get depths, lifts the deeper one step by step, then steps both up together. The likely middle answer puts all of `a`'s ancestors in a set and walks up from `b` until it finds one. Both are O(depth) per pair. Measured in CPython on the exact timing tests (seed 1 of each level): the set-based middle approach took 22 to 25 s and the naive version 34 to 38 s, against 0.2 to 0.35 s for the reference, about 70 to 100 times slower. Both fail the 8 s limit clearly. Accept instead: an Euler tour with a sparse table for range-minimum queries (O(n log n) build, O(1) per pair), offline Tarjan LCA with union-find over all pairs at once (near-linear; natural here, because the pairs arrive as a batch), or jump pointers every √D levels (O(√D) per pair, which passes at these sizes). A recursive DFS for any of these fails on the deep chains unless it is rewritten iteratively or the recursion limit is raised (and raising it to 15 000 can still crash CPython's C stack).

**Dialect notes.** In SQL the ancestors of a video come from a recursive CTE over `(video, source)`; the LCA of a pair is the deepest ancestor of `a` that is also an ancestor of `b`. That is O(depth) rows per video and does not scale to these chains; warehouses usually materialise a closure table or a path column (the list of ancestors per video, written when the remix is created), after which the LCA is the longest common prefix of two paths. Spark has no built-in LCA; a batch job joins pairs with precomputed ancestor tables at doubling distances, which is binary lifting expressed as joins. Not executed here.

**Edge cases built into the tests.** One video a remix of a remix of the other, in both orders; a video paired with itself (a remix and an original); two remixes of the same video; cousins at different depths; separate families; an original paired with a deep remix; rows listed with remixes before their sources; an id that appears in no row (also paired with itself). Hard adds repeated rows. Very Hard adds a deleted LCA (the answer moves up), a deleted video in the pair that is the ancestor of the other, deletion of every common video up to the original (`None`), and deleted videos below the meeting point (no change).

**Common mistakes.** Treating "descends from" as strict, so a video paired with its own remix gets the remix's source; assuming the rows are sorted with sources first; returning an id for an unknown video (`index[a]` raising, or a default of the original); a recursive DFS that overflows on a 15 000-deep chain; building the lifting table with too few levels so long lifts stop short; at Very Hard, dropping deleted videos from the lineage, which separates their remixes from the family.

**Follow-up guidance.** (1) The distance is `depth[a] + depth[b] − 2·depth[LCA]`, free once depths exist. (2) A new remix's depth and lifting entries depend only on its source's, so appending a video is O(log D) without a rebuild: binary lifting is naturally incremental, while an Euler tour is not. (3) Keep deleted videos as links; answer with the nearest non-deleted ancestor, which can be maintained per video, or say that the product may show "a deleted video" as the branch point. (4) Store per video a path or a set of ancestors at power-of-two distances, built by repeated self-joins (log D rounds); then each pair is a few joins. Or partition by family root, since pairs from different families are answered immediately.

**Rubric anchors.** 2: a walk per pair, or recursion that crashes on the deep chain, or self-ancestor rules wrong. 3: all tests pass with binary lifting, an Euler tour with RMQ, or offline Tarjan, built iteratively. 4: also explains why the lift-then-jump loop finds the LCA, handles deletion with a precomputed nearest live ancestor, and answers the incremental and distributed follow-ups concretely.

**Strong signals.** Asks whether a video counts as its own ancestor and how deep chains get before coding; notices that the pairs arrive as a batch and mentions offline LCA. **Red flags.** "Python handles deep recursion"; caching every video's full ancestor set (O(n·D) memory).

## TTK-L2-02

**Reference solution**

```python reference
def best_alignment(library, clip, min_votes=1, max_repeat=None):
    # Index the clip: hash -> clip positions. None frames keep their positions but never vote.
    want = {}
    for i, h in enumerate(clip):
        if h is not None:
            want.setdefault(h, []).append(i)
    m = len(clip)
    best = None                                       # (sound_id, offset, votes)
    for sid in sorted(library):                       # sorted, so ties go to the smaller id
        sound = library[sid]
        last = len(sound) - m                         # the last offset where the clip fits
        if last < 0:
            continue
        hits = {}                                     # hash -> every position in this sound
        for p, h in enumerate(sound):
            if h in want:
                hits.setdefault(h, []).append(p)
        votes = {}
        for h, ps in hits.items():
            if max_repeat is not None and len(ps) > max_repeat:
                continue                              # too common in this sound to locate anything
            for i in want[h]:
                for p in ps:
                    o = p - i
                    if 0 <= o <= last:
                        votes[o] = votes.get(o, 0) + 1
        for o, c in votes.items():
            if best is None or c > best[2] or (c == best[2] and (sid, o) < best[:2]):
                best = (sid, o, c)
    if best is None or best[2] < min_votes:
        return None
    return best
```

**Explanation.** A match between clip position `i` and sound position `p` supports exactly one alignment, `offset = p − i`, so the votes for an alignment are the number of matches that point at it. The reference indexes the clip by hash, scans each sound once, collects every position of each clip hash in that sound, and turns each (clip position, sound position) pair into a vote for its offset, keeping only offsets where the whole clip fits. Each clip position can vote at most once for a given offset, because the sound has one hash at `offset + i`. `None` frames are left out of the index but keep their positions, so later frames still line up. At Very Hard, `hits[h]` holds every position of `h` in the sound, so its length is the hash's count in that sound, and a hash over `max_repeat` is skipped for that sound only. Sounds are visited in sorted order and offsets compared on ties, so the first best alignment by (votes, id, offset) wins; the threshold is applied once at the end.

**Complexity.** O(n + m + matches) time, for n library frames, m clip frames and the number of matching (clip position, sound position) pairs, plus O(s log s) to sort s sound ids. Memory is O(m) for the clip index plus the votes of one sound at a time. The timing test (about 1.5 million library frames, a 1 500-frame clip, hashes spread over about 16 million values, so each hash occurs only a handful of times and matches stay in the low thousands) runs in about 0.1 s in CPython. Indexing the library instead (hash → (sound, position)) is equally correct and costs one pass over all frames, about 0.4 s; it is the right choice when one library serves many uploads (follow-up 1).

**The naive and middle approaches, and what this sizing does to them.** The naive answer tries every offset of every sound and compares the clip frame by frame: about 2 × 10⁹ comparisons. Written as a Python loop it takes many minutes; even with C-speed comparisons (`sum(map(operator.eq, clip, sound[o:o + m]))` per offset) it took 4.3 s on a tenth of the library, so about 40 s in all. The likely middle answer finds each clip hash's positions by scanning each sound, for example with repeated `sound.index(h, start)`. That scan runs in C, but it is still O(n·m): measured at 17 to 22 s on the exact timing tests at every level (350 to 400 sounds), even with distinct clip hashes cached, against about 0.1 s for the reference, well over 100 times slower. It fails the 8 s limit clearly. One variant passes and is acceptable: building `set(sound)` per sound first and scanning only for the clip hashes that are in it. The set is an index in disguise, and the only full scans left are for the matching sound's own hashes. Expect the candidate to say why it is fast.

**Dialect notes.** In SQL this is a join of `clip(i, hash)` with `library(sound_id, p, hash)` on `hash`, then `GROUP BY sound_id, p − i` with `COUNT(*)`, filtered to `0 ≤ p − i ≤ sound_len − clip_len`, ordered by count descending, sound id and offset, `LIMIT 1`. With an index or hash join on `hash` that is the same algorithm as the reference. In Spark, broadcast the small clip and join; a skewed join key (a very common hash) is exactly the `max_repeat` problem, and dropping hashes above a frequency cut-off is also the usual skew fix. Not executed here.

**Edge cases built into the tests.** A match at offset 0; a match at the last offset where the clip fits; an alignment that would run past the end (no votes); a clip longer than every sound; no hash in common; equal votes in two sounds (smaller id) and at two offsets (smaller offset); a hash repeated in clip and sound (one vote per clip frame per offset); a strong alignment after a weaker one. Hard adds a `None` frame before the matching frames, a clip of only `None` frames, and `min_votes` exactly reached and missed by one. Very Hard adds a hash too common in one sound that still votes in another, and a hash at exactly `max_repeat`.

**Common mistakes.** Allowing offsets that run past the end, or negative offsets; dropping `None` frames before enumerating the clip, which shifts every later offset; counting a repeated clip hash once per sound position across all offsets instead of per offset; `>` instead of `>=` against `min_votes`; applying `max_repeat` to the count across the whole library rather than per sound; comparing ids numerically; returning a list instead of a tuple (accepted by the checker, but say which).

**Follow-up guidance.** (1) Precompute an inverted index from hash to (sound, position) for the whole library, sharded by hash; a query then touches only the postings of its m hashes. Postings for very common hashes are dropped or capped, which is `max_repeat` at library scale. Size: one posting per frame, so tens of billions of postings for a hundred million sounds, stored compressed. (2) Vote on offset per window of the clip, or on pairs of (offset, rate) with rate bucketed, or fingerprint relative time differences between landmarks so that a uniform stretch keeps the same structure. (3) Report both candidates with their votes; require a margin between the best and second-best before linking; route close calls to the creator's choice or to no link. (4) Set a budget (for example a few hundred milliseconds), run the check asynchronously after upload, and link later; a timeout leaves the video unlinked and retries, never blocks the upload.

**Rubric anchors.** 2: a scan per offset or per hash, or offsets past the end allowed, or ties wrong. 3: all tests pass with an index of hashes and offset voting. 4: also explains the vote as `p − i` clearly, states complexity in terms of matches, explains why `max_repeat` protects both correctness and cost, and gives a credible library-scale index.

**Strong signals.** Asks whether the clip may hang over the end and how ties are broken; notices immediately that each match votes for one offset. **Red flags.** Calls `list.index` "fast because it's in C" without counting the elements it touches; filters out `None` frames with a list comprehension before indexing.

## TTK-L2-03

**Reference solution** (the fixed check)

```python reference
from datetime import datetime, timezone

DAY = 86400


def _midnight(day):
    """'YYYY-MM-DD' -> Unix seconds at 00:00 UTC on that date."""
    return int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp())


def _countries(regions, groups):
    """The countries a licence names, directly or through a region group."""
    out = set()
    for name in regions:
        out.update(groups.get(name, [name]))          # a group stands for its countries
    return out


def sound_status(licences, groups, offsets, checks):
    windows = {}                     # (sound, country) -> [(start, end), ...] in Unix seconds
    for lic in licences:
        for country in _countries(lic["regions"], groups):
            shift = offsets[country] * 60             # local midnight is earlier in UTC east of UTC
            start = _midnight(lic["start"]) - shift
            end = _midnight(lic["end"]) - shift if lic["end"] else None     # end date excluded
            windows.setdefault((lic["sound"], country), []).append((start, end))   # renewals add
    out = []
    for sound, country, ts in checks:
        ws = windows.get((sound, country), [])
        if any(s <= ts and (e is None or ts < e) for s, e in ws):
            out.append("available")
        elif any(s <= ts for s, _ in ws):             # licensed here before, now lapsed
            out.append("muted")
        else:
            out.append("blocked")                     # never licensed here up to now
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **End date inclusive.** `end = _midnight(lic["end"]) + DAY`, with the comment "through the end date". Symptom: a sound stays available for a whole extra local day after its licence ends. Fix: the window ends at local midnight at the start of the end date, no `+ DAY`.
2. **Region groups not expanded.** `_countries` returns `set(regions)`, so a licence for `["NORDICS"]` is stored under the key `"NORDICS"`, and no check for `"SE"` ever finds it. Symptom: sounds licensed for a region group are blocked in every country of the group. Fix: replace each group name by its countries.
3. **Midnight UTC instead of local midnight.** Windows are computed once per licence from `_midnight`, which is UTC, and the country's offset is never applied. Symptom: in Japan (UTC+9) a licence starts and ends nine hours late; in Mexico (UTC−6) six hours early. Fix: compute the window per country and subtract `offsets[country] × 60` from both boundaries (local midnight is earlier in UTC east of UTC, so the sign is minus).
4. **Future licence reported as muted.** Any stored window that does not cover `ts` gives `"muted"`. Symptom: a sound licensed from next month shows as muted today, as if it had been withdrawn. Fix: muted only if a licence started at or before `ts`; otherwise blocked.
5. **A renewal overwrites the earlier licence.** `windows[key] = (start, end)` keeps only the last licence per sound and country. Symptom: a sound renewed after a gap is reported muted (or blocked, once bug 4 is fixed) during its first licence. Fix: keep a list of windows per key and test them all.

Each bug has its own check that fails on the starter and passes once that bug alone is fixed: the end date at local noon (1); a Nordic country under a group licence (2); a check at 20:00 UTC on the day before a Japanese start (3); a sound licensed only from a future date (4); a check inside the first of two licences (5). The other checks — the last day before the end date, a licence ending in Mexico just after UTC midnight (passes on the starter only because bugs 1 and 3 cancel), a lapsed licence (muted), the gap between licences and the renewal, a back-to-back renewal at the boundary, an unlisted sound and a country named both directly and through a group — pass on the starter or fail only in combination, and stay as regression checks. Random samples can hit several bugs at once.

**Explanation.** The check makes three decisions: which countries a licence covers (groups expanded), when each country's window starts and ends (local midnight, end excluded), and what an uncovered check means (lapsed or never licensed, which needs every licence, not only the last one). Each bug breaks one of them.

**Complexity.** O(L·g + c·k) for L licences naming up to g countries each, c checks and k licences per sound and country (a handful). The timing test (200 000 checks, 20 000 sounds, up to three licences each) runs in about 0.4 to 0.6 s in CPython. With many renewals per key, sorting each key's windows and bisecting makes each check O(log k).

**Dialect notes.** In SQL, expand groups with a join to a `group_country` table, and compute the window with `(start_date::timestamp AT TIME ZONE tz)` in PostgreSQL when `tz` is a named zone, or `start_date::timestamp - make_interval(mins => offset)` with fixed offsets. BigQuery's `TIMESTAMP(date, tz)` and Snowflake's `CONVERT_TIMEZONE` do the same; watch the session time zone in each. "Ever licensed before" is `EXISTS (… start_ts <= check_ts)`, and "covers" is a half-open interval test `start_ts <= ts AND (end_ts IS NULL OR ts < end_ts)`. Not executed here.

**Edge cases built into the tests.** The end date at local noon; the last day before it; a country in a group and a country outside it; a check before UTC midnight that is already the start date in Japan; a check after UTC midnight that is still the day before the end date in Mexico; a licence only in the future; a lapsed licence; a check during the first of two licences; the gap and the renewal; a back-to-back renewal at the boundary; an unlisted sound; a country named twice.

**Common mistakes.** Fixing bug 3 with `+ shift` (the wrong sign), which moves Japan later still; applying the offset to `ts` and comparing dates, but using the UTC date of the licence; removing `+ DAY` but changing `ts < end` to `ts <= end`; fixing bug 4 by checking `end <= ts`, which is wrong for an open-ended future licence; fixing bug 5 by keeping the licence with the latest end; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Store an IANA time-zone name per country (or per region of a large country) and compute local midnight with zone rules; midnight can be skipped in a few zones, so define the boundary as the first instant of the local date. (2) Precompute per (sound, country) a sorted list of windows, or a materialised status timeline, keyed for one lookup per play; a licence amendment invalidates the affected keys through change events. (3) Join videos using the sound with the per-country lapse time; the list of videos to mute is the set used in that country, and the hours played after the lapse come from play logs aggregated per video, not per viewer. (4) Make licences bitemporal: valid time (when the licence applies) and recorded time (when we knew), so a past date can be answered as known then.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also names the decision each bug breaks, explains the sign of the offset, adds a regression test per bug, and answers the daylight-saving and bitemporal follow-ups concretely.

**Strong signals.** Works out a Tokyo and a Mexico City start in UTC by hand before touching the code; asks whether a future licence is muted or blocked. **Red flags.** "Use UTC everywhere, it's simpler" for licence dates defined in local calendars; deleting the muted branch.

## TTK-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Entities.** `caption_version (version_id, video_id, language, kind auto|edit|translation, model_version NULL, parent_version_id NULL, created_at, cues_uri, content_hash)`, immutable. An auto-caption's parent is none and its inputs are the video's audio and the speech model version; a creator edit's parent is the version it edited; a translation's parent is the source caption version and it records the target language and translation model version. `version_id` can be a hash of those inputs, which makes regeneration idempotent.
- **Current pointer.** `caption_current (video_id, language, version_id, updated_at)`, one row per video and language, swapped atomically. An edit writes a new version and swaps the pointer for the spoken language; viewers' clients fetch by pointer, so the change reaches them within minutes (short cache lifetimes on the pointer, long ones on immutable versions).
- **Translations on request.** The cache key is `(source_version_id, target_language, translation_model_version)`. A request first checks the key; on a miss it takes a short lease (single flight per key) so concurrent requests wait for one model run. When the source caption changes, the old translations stay valid for their old source version; the pointer for that language is marked stale and the next request regenerates from the new source, while the old translation is served with a `stale=true` flag in the log until then (or not served, if the policy says so — the candidate must choose and justify).
- **Model upgrades.** New versions are produced lazily (on next view or request) or by a prioritised backfill for the most viewed videos per language. Creator-edited captions are never regenerated; the pointer never moves from an edit to an auto version without the creator's action.
- **Serving log.** `caption_shown (view_bucket_time, video_id, language, version_id, stale, client, country)` with no viewer id, written by the player when captions render. Deduplicated per player session id that expires quickly. Kept for {{retention}}, deleted by partition with verification.
- **Aggregates.** Weekly by language pair, model version and kind: views shown captions, share shown creator-edited versions, stale shares, complaint rate per version (complaints carry video, language and time and join to the version current then via the pointer history).

**Competing designs to accept.** Storing edits as diffs on a base version (accept if the shown text can be reconstructed exactly); eager translation into the top languages for popular videos plus on-request for the rest; event-sourced pointer history instead of a pointer table. All fine if versions are immutable, the version shown is logged, and creator edits are protected.

**Bottlenecks and failure modes.** Mutable captions that lose what was shown; translation caches keyed by video and language only; thundering herds on viral videos; model upgrades overwriting edits; serving logs without version ids; retention jobs that fail silently.

**Incident guidance.**
- *Translation cache serving outdated captions for {{edit_window}} after edits*: the key lacked the source version. Add it, invalidate by pointer change, backfill the stale flag in logs for the affected window from pointer history, and report the share of views affected per language.
- *Model upgrade overwrote creator edits*: restore pointers from pointer history (versions are immutable, so the edited text still exists), add a rule that regeneration never moves a pointer away from an edit, and tell the affected creators.
- *Retention deletion broken in one region*: alert on the oldest partition's age, delete the backlog, verify, and address partitions by date rather than by name.

**Follow-up guidance.** (1) Debounce: regenerate translations for the latest edit after a quiet period, serve the previous translation marked stale meanwhile; cap runs per video per hour. (2) Roll out by language with a holdout; compare complaint rates and creator edit rates per version from the serving logs and the edits; keep the old model for the language where it is better. (3) Delete versions, translations and cached files with the video; serving logs keep only aggregates or are deleted by video id within the retention policy. (4) Single flight per key, a queue with priority by request count, serve the auto-caption in the original language or a "translation pending" state, and pre-warm the most requested languages for that video.

**Rubric anchors.** 2: captions overwritten in place; no record of the version shown. 3: immutable versions with lineage, a current pointer, translation cache keyed by source version, version ids in serving logs. 4: also single-flight deduplication, an explicit stale policy, upgrade rules that protect edits, aggregates without viewer ids, and credible incident handling.

**Strong signals.** Asks what exactly must be traceable after a complaint before drawing anything; treats a translation as derived from a specific caption version. **Red flags.** "Just store the latest captions per video"; viewer-level logs "for debugging".

## TTK-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Use id.** The client mints `use_id` when an effect is opened and carries it on every event of that use: `effect_opened`, `capability_checked (result ok|unsupported, reason_code)`, `preview_rendered (outcome ok|fallback|failed, error_code, duration_ms)`, `effect_applied`, `recording_finished`, and the post carries `effect_id`, `effect_version` and `use_id`. Each event also has an `event_id` for deduplication and a client timestamp, plus the server receive time.
- **Version tied to what ran.** Every render event carries `effect_id`, the loaded `effect_version` and the package `content_hash`; the server checks the hash against the catalogue so a mismatch is flagged. Reports never join to the "current" version.
- **Device reduction.** At ingestion, device details are mapped to `device_class` (chipset tier, OS major version) by a versioned mapping; unknown devices map to an explicit `unknown` class (never dropped), and an alert fires on its share. Raw device detail stays only in a short-lived engineering table with restricted access, if at all.
- **Late and duplicate events.** Deduplicate on `event_id` within a window of {{offline_hours}} hours plus margin; write events to the partition of their event day; recompute daily aggregates for days still within the window; mark a day final after {{offline_hours}} hours.
- **Maker tables.** `effect_daily (day, effect_id, effect_version, device_class, country_group, opens, unsupported, renders_ok, fallbacks, failed, applied, recorded, posted)`, built only from reduced events, with an `owner_maker_id` from the catalogue for access control: a maker's queries are scoped to their own effects by row-level policy. Cells with fewer than {{min_cell}} opens are suppressed; to prevent recovery by subtraction, suppress complementary cells too or publish totals computed from unsuppressed cells only, and coarsen (merge device classes or weeks) where suppression would hide most of an effect.
- **No creator ids.** The pipeline joins on `use_id`, never on a creator id; posted-video counts come from the post event carrying `use_id` and effect version.

**Competing designs to accept.** Server-side session ids instead of client-minted ones (accept if offline use is handled); computing aggregates on the device and sending only counts (accept with an explanation of late data and suppression); differential-privacy noise instead of suppression (accept if the candidate explains the trade-off for small makers). All fine if failures are tied to the loaded version and makers see only aggregates of their own effects.

**Bottlenecks and failure modes.** Joining failures to the current version; dropping unknown device classes; deduplication windows shorter than offline periods; suppression undone by totals; creator identifiers leaking into maker tables through post joins.

**Incident guidance.**
- *Published version logged instead of the loaded one*: fix the client field and, for the affected releases, recover the loaded version from the package hash where present; restate the affected days, and tell makers which days were restated and why.
- *Suppressed cell recoverable by subtraction*: switch to complementary suppression or totals over unsuppressed cells, republish the affected reports, and add a test that tries to recover every suppressed cell from published numbers.
- *New device class dropped for three days*: map unknown devices to an explicit `unknown` class from now on, backfill the three days with the new mapping, and alert when the unknown share rises.

**Follow-up guidance.** (1) Stream the render outcomes into a per-(version, device class) failure-rate monitor with a minimum session count; with enough sessions, alert the maker and let the platform pause the version for that device class, keeping the previous version available. (2) They see suppressed cells as "fewer than {{min_cell}}"; weekly or monthly rollups, coarser device classes or all-device totals can pass the threshold; never publish a weekly total next to daily cells in a way that reveals the suppressed days by subtraction. (3) Keep out anything at creator or device level, and failure data that would rank makers' effects down for reasons outside their control without a minimum sample; the ranking is a scoring function the platform owns and should read only documented aggregates. (4) Bound deduplication with a TTL equal to the offline window plus margin, sharded by `event_id` hash; beyond it, rely on idempotent aggregation keyed by `use_id` and stage.

**Rubric anchors.** 2: events joined to the current version; device ids or creator ids in maker tables; no suppression. 3: a per-use id, version and package on render events, device classes at ingestion, deduplication and late-data handling, maker-scoped aggregates with suppression. 4: also suppression protected against subtraction, explicit unknown device class, finalisation rules, and credible incident plans.

**Strong signals.** Asks which version actually ran on the device before designing tables; treats suppression as something a maker could attack with arithmetic. **Red flags.** "Makers can see per-user usage if they have consent" without any design for it; joining failures to the catalogue's latest version.
