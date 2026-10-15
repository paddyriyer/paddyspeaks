# TikTok · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a short-video
service: uploads and the in-app editor, effects, sounds and regional music licensing,
duets and stitches, captions and translations. Every workload, number, schema and
incident is hypothetical; licence, remix, caption and effect rules are this
exercise's rules (check current docs), and nothing here describes how any company's
systems are actually built. Viewers appear only in aggregates; a creator's own data
may be shown to that creator, and an effect maker sees only aggregates about their
own effects. Nothing here infers a protected or sensitive attribute of anyone from
videos, sounds, captions or behaviour. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TTK-L2-01: Remix lineage — the nearest video two remixes share

| | |
|---|---|
| **Template ID** | TTK-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Trees / lowest common ancestor by binary lifting over a forest of duets and stitches |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | TTK-L2-01.mjs |

**Business Scenario.** A duet or a stitch is made from one earlier video, its source, and that source may itself be a duet or stitch of something older. Trends grow into long chains: each creator stitches the previous creator's video, and side branches split off along the way. An analytics job answers questions about pairs of videos taken from trend reports: do these two videos belong to the same remix family, and if so, which video is the nearest one they both descend from? That shared video is where the two branches of the trend split. The job receives the remix log and many pairs at once.

**Problem Statement.** Implement `common_origin(remixes, pairs, deleted=frozenset())`. `remixes` is a list of `(video, source)` rows: `video` was made as a duet or stitch of `source`. Each video has at most one source, rows are in no particular order, and the lineage never loops. A video that is never the first element of a row is an original. A video is known if it appears in at least one row, as either element. `pairs` is a list of `(a, b)` pairs of video ids. A video descends from itself, from its source, from its source's source, and so on. For each pair, return the nearest video that both `a` and `b` descend from — the one furthest from the original — or `None` if they share none. If one video of the pair descends from the other, the answer is the other one; a video paired with itself is itself. Return one answer per pair, in the order of `pairs`. {{data_rule}} {{deleted_rule}}

**Constraints.** The timing check has up to 4 remix chains 15 000 videos deep with tens of thousands of side branches (about 90 000 videos) and 15 000 pairs. Walking up both videos' chains for every pair costs tens of thousands of steps per pair, over 10⁸ in total, and is too slow. Something close to O((n + q) log n) is expected. Do not rely on recursion: chains are far deeper than Python's recursion limit.

**Assumptions.** Video ids, chains and pair lists are hypothetical; how deep a real trend goes, and what counts as a remix, are this exercise's rules (check current docs). The remix log is already validated: no video has two sources and there are no cycles. The job uses only the lineage, never who made or watched the videos.

**Clarifications.**
- Q: Does the kind of remix matter, duet or stitch? | A: No. Both make the new video a remix of its source, and both count the same.
- Q: If `b` is a remix of a remix of `a`, what is the answer? | A: `a`. `a` descends from itself, and `b` descends from `a`.
- Q: Two videos are in different remix families. | A: They share no video, so the answer is `None`.
- Q: Are the rows sorted so that a source comes before its remixes? | A: No. Build whatever index you need first.
- Q: Can I answer each pair on its own? | A: You can, but the pairs arrive together, and the chains are deep. Spend time once on an index so that each pair is cheap.

**Hints.**
1. Give every video an integer index, its source's index and its depth (the number of remix steps from its original). Compute depths without recursion, for example by walking up to the first video whose depth is already known and filling the path on the way back.
2. For two videos in the same family, first lift the deeper one until both are at the same depth. If they are now the same video, that is the answer.
3. Keep, for each video, its 2ᵏ-th source for every k (`up[k][v] = up[k-1][up[k-1][v]]`). Lifting by any distance then takes O(log n) jumps, and so does finding the last depth at which the two chains still differ.

**Follow-ups.**
1. The trend report also wants, for each pair, how many remix steps separate the two videos through their shared video. What do you add, and what does it cost?
2. New remixes arrive all day, and pairs are asked as they come. Which part of your index can be extended for a new video without rebuilding, and why?
3. A creator deletes a video in the middle of a chain. Its remixes stay up. Should the answer ever be a deleted video, and what changes in your index if it may not be?
4. The remix log has two billion rows and does not fit on one machine. How would you compute the nearest shared video for a batch of a million pairs in a distributed job?

**Follow-up rules.**
- when: while loop, walk up, parent chain, ancestors set → ask: A trend chain is 15 000 stitches deep and you have 15 000 pairs. How many steps does your loop take, and what would you precompute to avoid it?
- when: recursion, recursive, dfs → ask: The deepest chain is 15 000 videos long. What happens to your recursive function in CPython, and how do you rewrite it?
- when: binary lifting, jump pointers, sparse table → ask: How much memory does your table take for 90 000 videos, and how do you choose how many levels to build?
- when: euler tour, range minimum, rmq → ask: That works too. How do you build the Euler tour without recursion, and how does its memory compare with binary lifting?
- when: tarjan, offline, union find → ask: Offline answers are fine for this batch job. What changes if pairs start arriving one at a time from a live dashboard?

**Evaluation Criteria.** Correct answers when one video descends from the other, for a video paired with itself, for siblings and for cousins at different depths; `None` for separate families and unknown ids; repeated rows harmless; at Very Hard, deleted videos kept in the lineage but never returned, including a deleted video in the pair itself; no recursion on deep chains; an index built once, with binary lifting, an Euler tour with range minimum, or offline Tarjan, rather than a walk per pair; a clear complexity argument; sensible answers on incremental updates and distributed computation.

## TTK-L2-02: Sound match — aligning a clip's fingerprint with a sound library

| | |
|---|---|
| **Template ID** | TTK-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing / inverted index of fingerprint hashes and voting on alignment offsets |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | TTK-L2-02.mjs |

**Business Scenario.** When a creator uploads a video with audio, the service checks whether the audio is a clip of a sound in its library, so the video can link to that sound's page and follow its regional licence. A fingerprinter you are given turns audio into one integer hash per short frame. A library sound is a long list of frame hashes, and the uploaded clip is a shorter list. The clip is noisy: talking, room sound and compression change many of its frames, so only some hashes match. The question is where the clip lines up best: in which sound, starting at which frame, with how many matching frames.

**Problem Statement.** Implement `best_alignment(library, clip, min_votes=1, max_repeat=None)`. `library` maps a sound id to its list of integer hashes, one per frame. `clip` is a list of hashes, one per frame. An alignment places the whole clip inside one sound starting at frame `offset`, where `0 ≤ offset ≤ len(sound) − len(clip)`; a clip longer than a sound has no alignment in it. The alignment's votes are the number of clip positions `i` with `clip[i] == sound[offset + i]`. Return `(sound_id, offset, votes)` for the alignment with the most votes; on a tie, the smaller sound id, then the smaller offset. Return `None` if the best alignment has fewer than `min_votes` votes (so, with `min_votes = 1`, when no frame matches anywhere). {{gap_rule}} {{repeat_rule}}

**Constraints.** The timing check has up to 400 sounds of 1 000 to 7 000 frames each, about 1.5 million frames in all, and a clip of 1 500 frames. Hashes are spread over a range of about 16 million values, so most clip hashes occur in only a few places. Trying every offset in every sound is O(n·m), about 2 × 10⁹ comparisons. Finding each clip hash's positions by scanning the sounds is also O(n·m), even when the scan runs in C. Something close to O(n + m + matches) is expected.

**Assumptions.** Sounds, hashes and the fingerprinter are hypothetical; this exercise does not say how any real audio matching works, and the rules for linking a clip to a sound are this exercise's (check current docs). The fingerprinter is a black box. The clip is not stretched or sped up: frame `i` of the clip lines up with frame `offset + i` of the sound. Nothing about the uploader is used.

**Clarifications.**
- Q: Can the clip hang over the end of a sound? | A: No. Only offsets where the whole clip fits count, so an offset whose clip frames would run past the end gets no votes.
- Q: A hash appears three times in the clip and four times in the sound. How many votes is that? | A: Count per offset: each clip position votes at most once for a given offset, when the sound has the same hash at `offset + i`.
- Q: How are sound ids compared on a tie? | A: As strings, in ordinary lexicographic order.
- Q: Should I return the alignment with the best ratio of votes to clip length? | A: No. Most votes, then the tie rules. The clip length is the same for every alignment.
- Q: Can I load the library into a dictionary first? | A: Yes. Whatever index you build counts towards the time.

**Hints.**
1. A match between clip position `i` and sound position `p` votes for exactly one alignment: `offset = p − i`. You never need to look at an offset that no match votes for.
2. Index one side by hash. Indexing the clip (hash → clip positions) and scanning each sound once finds every match in O(n + matches).
3. Count votes per offset in a dictionary for each sound, discard offsets outside `0 … len(sound) − len(clip)`, and keep the best by `(−votes, sound_id, offset)`.

**Follow-ups.**
1. The library grows to a hundred million sounds. You cannot scan it per upload. What do you index ahead of time, and how big is it?
2. Clips are sometimes sped up by a few per cent, so offsets drift along the clip. How would you change the vote so that a stretched clip still matches?
3. Two different sounds share a sample, so a clip matches both with similar votes. How would you decide which sound to link, or whether to link none?
4. The check runs at upload time for every video. What latency budget would you set, and what do you do with uploads whose check times out?

**Follow-up rules.**
- when: for every offset, sliding, nested loop → ask: There are 1.5 million offsets and 1 500 clip frames. How many comparisons is that, and which offsets could you skip without looking?
- when: list.index, .index(, in sound → ask: That scan runs in C. How many elements does it touch for one clip of 1 500 hashes against 1.5 million library frames?
- when: dict, hash map, inverted index, defaultdict → ask: Which side do you index, the clip or the library, and how does that choice change for one upload against a fixed library versus a batch of uploads?
- when: counter, most_common, votes → ask: Two alignments tie on votes. Show how your code picks the smaller sound id and offset, and test it.
- when: drop none, skip none, silence, filter out → ask: You drop the `None` frames before you start. What happens to the offsets of the frames after them?

**Evaluation Criteria.** Votes counted per offset with each clip position voting once; only offsets where the whole clip fits; ties to the smaller sound id, then the smaller offset; `None` below `min_votes` and when nothing matches; at Hard and above, `None` frames keep their positions and never vote, and the threshold is inclusive; at Very Hard, a hash occurring more than `max_repeat` times in a sound casts no votes in that sound only; an index of hashes with offset voting rather than a scan per offset or per hash; a clear complexity argument in terms of matches; sensible answers on library-scale indexing and stretched clips.

## TTK-L2-03: Debug the regional sound availability check

| | |
|---|---|
| **Template ID** | TTK-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Validity windows / exclusive end dates, region groups, local midnight, lapsed versus never licensed, renewals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, analytics-engineer, staff-data-engineer |
| **Generator** | TTK-L2-03.mjs |

**Business Scenario.** A sound can be used in videos only where and while a licence covers it. Licences name countries and region groups, with a start date and an end date in each country's local calendar. When a licence lapses in a country, videos that already use the sound keep playing there without it (muted); a sound that has never been licensed in a country cannot be used there at all (blocked). Creators and the music partnerships team have reported several problems with the check that decides this. A sound shows as available for a whole extra day after its licence ends. Sounds licensed for a region group are blocked in every country of the group. In Japan a sound becomes available nine hours after the licence starts. A sound announced for next month shows as muted, as if it had been withdrawn. A sound whose licence was renewed after a gap shows as muted for the whole of its first licence period. The check below is the suspect.

**Problem Statement.** Fix `sound_status(licences, groups, offsets, checks)` so that it meets this specification. {{replay_rule}}
1. **`licences`** are dicts `{"sound", "regions", "start", "end"}`. `regions` is a list of country codes and region-group names. `start` and `end` are dates `"YYYY-MM-DD"` in each country's local calendar: a licence covers a country from 00:00 local time on `start` up to, but not including, 00:00 local time on `end`. `end` is `None` for a licence with no end date. A sound can have several licences in one country: a renewal can start on the day the previous licence ends, or after a gap.
2. **`groups`** maps a region-group name to its list of country codes. Group names never equal a country code, and groups never contain other groups. A country named directly and through a group is covered once.
3. **`offsets`** maps every country code to its fixed UTC offset in minutes, positive east of UTC (for example 540 for UTC+9 and −360 for UTC−6).
4. **`checks`** is a list of `(sound, country, ts)` with `ts` in Unix seconds (UTC).
5. **Output.** One status per check, in order: `"available"` if a licence for the sound covers the country at `ts`; otherwise `"muted"` if a licence for the sound covered the country at some earlier moment (it has lapsed); otherwise `"blocked"` (never licensed there up to `ts`, including a sound whose only licence there starts later).

**Constraints.** Keep the function's name, arguments and output format. Up to 200 000 checks against 20 000 sounds, processed in close to linear time.

**Assumptions.** Offsets are fixed for this exercise, with no daylight-saving changes. Sounds, licences, groups and dates are hypothetical, and the muted and blocked behaviour is this exercise's rule (check current docs for how any real licensing works). Licences are already validated: a licence's start is before its end.

**Clarifications.**
- Q: Is the end date covered? | A: No. The end date is the first local day the licence no longer covers.
- Q: Whose midnight starts a licence in a region group? | A: Each country's own: the same licence starts at different UTC moments in Tokyo and in Mexico City.
- Q: What if a sound's licence starts next month and someone checks today? | A: It has never been licensed there yet, so it is blocked. Muted is only for a licence that has lapsed.
- Q: Does a renewal replace the earlier licence? | A: No. Both periods count. A check during the first period is available, a check in the gap between them is muted.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Work out the UTC moment at which a licence starting on `2026-04-01` begins in a country at UTC+9, then compare with what `_midnight` returns.
2. Read the line that computes `end`. What does the comment say, and what does the specification say?
3. Follow a licence for `["NORDICS"]` through `_countries` and into `windows`.
4. Put two licences for the same sound and country into `windows` by hand. What is left?

**Follow-ups.**
1. Countries change their UTC offset for daylight saving. What would you store instead of a fixed offset, and how do you compute local midnight on the day the clocks change?
2. The check runs for every video play. How would you precompute licence windows so that a play costs one lookup, and what invalidates your cache when a licence is amended?
3. A sound's licence lapses in one country. Which videos must be muted, and how would you produce that list and the hours each kept playing after the lapse?
4. The music partnerships team wants a history: for any past date, the status of a sound in every country, as the licences were known then (before later corrections). What do you add to the data model?

**Follow-up rules.**
- when: utc, utcfromtimestamp, midnight → ask: A licence starts on 1 April in Tokyo and in Mexico City. At which UTC moments does it start in each, and what does your code compute?
- when: zoneinfo, pytz, daylight saving → ask: With named time zones, local midnight can fall in a skipped hour on some days. How would you define the start of the licence then?
- when: inclusive, <=, end date → ask: Your licence covers up to the end date. Show the check at noon on the end date and say which status it should get.
- when: overwrite, setdefault, list of windows, renewal → ask: A sound has fifty renewals in one country. How do you find whether any covers a moment, and would sorting the windows help?
- when: future, not yet started, start date → ask: A licence is signed today for next month. What do creators in that country see today, and what would they see if the check said muted?

**Evaluation Criteria.** Finds and explains every bug with its creator-facing symptom; end dates exclusive; region groups expanded to their countries; licence boundaries at each country's local midnight with the right sign; blocked rather than muted for a sound licensed only in the future; renewals kept alongside earlier licences, with the gap muted; minimal, linear fixes that keep the output format; a regression test per bug.

## TTK-L2-04: Captions and translations — versions, requests and what each viewer was shown

| | |
|---|---|
| **Template ID** | TTK-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Versioned derived text / auto-captions, creator edits, on-demand translation, serving logs joined to versions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "daily_uploads": {"2": ["10 million", "30 million"], "3": ["80 million", "200 million"]},
  "languages": [20, 40, 70],
  "edit_window": ["24 hours", "7 days"],
  "retention": ["90 days", "13 months"]
}
```

**Business Scenario.** About {{daily_uploads}} videos with speech are uploaded a day. Each gets auto-captions in its spoken language from a speech model you are given. The creator can review and edit the captions, and edits are most common within {{edit_window}} of posting. Viewers can ask for a translation into any of {{languages}} supported languages, and translations are produced on request by a translation model you are given, then reused. Models are upgraded every few weeks. The quality team wants to know which caption version each viewer was shown, so that a complaint about a wrong caption can be traced to the exact text, model and edit, and so that the share of views shown creator-edited captions can be reported by language and week.

**Problem Statement.** Design the data and pipeline for captions and translations. Cover the caption version as an entity (what identifies it, what it is derived from), creator edits and their effect on existing translations, translation on request with reuse and deduplication of concurrent requests, model upgrades and whether old captions are regenerated, what the player logs when it shows captions, how a view is joined to the exact version shown, retention of {{retention}} for serving logs, and the aggregates the quality team reads.

**Constraints.** A creator's edit must reach viewers within minutes. Translations must never be served for an older caption version without saying so in the logs. Two viewers asking for the same translation at the same moment must not trigger two model runs. Serving logs carry no viewer identifier beyond what the aggregate needs. Reports are by language pair, model version and week, and they must be re-runnable.

**Assumptions.** Volumes, the language count, the edit window and retention are hypothetical; how any real caption or translation feature behaves is not described here, so check current docs. The speech and translation models are black boxes with version ids. Captions are a list of timed cues. Nothing about the speaker or the viewer is inferred from captions.

**Clarifications.**
- Q: Does an edit create a new version or change the old one? | A: That is part of your design, but the quality team must be able to see exactly what was shown before the edit.
- Q: When the creator edits the original captions, what happens to existing translations? | A: Decide. They were made from the old text; you must say whether they are regenerated, marked stale or served as they are.
- Q: Are all {{languages}} translations produced at upload? | A: No. Only on request, then reused for later viewers.
- Q: Do we regenerate every caption when the speech model is upgraded? | A: Not necessarily. Weigh cost against quality and say what you would do for edited captions.
- Q: Can the quality team see which viewer saw which caption? | A: No. They see versions and aggregates; a complaint carries the video, the language and the time.

**Hints.**
1. Make a caption version immutable and identify it by what it was derived from: the video, the source (auto or creator edit), the model version, and for a translation, the source caption version and the target language.
2. Keep a pointer per video and language to the current version, so an edit or a regeneration is a new version plus a pointer swap.
3. Have the player log the version id it rendered, not just the language, so every view joins to exactly one version.

**Follow-ups.**
1. A creator edits captions twenty times in an hour. How many translation runs do you allow, and what do viewers in other languages see meanwhile?
2. A new speech model is better for most languages but worse for one. How would you roll it out by language and measure it with the serving logs?
3. A creator deletes their video. What happens to its caption versions, translations, cached files and serving logs?
4. At {{daily_uploads}} uploads a day, translation requests spike for a video that goes viral in a new country. How do you keep the model from being overwhelmed while still serving something?

**Follow-up rules.**
- when: overwrite, update in place, latest only → ask: A viewer complains about a caption shown yesterday, and the creator has edited it since. Where is the text the viewer saw?
- when: cache, cdn, reuse → ask: What is the cache key for a translation, and what happens to the cached file when the source caption changes?
- when: regenerate, backfill, reprocess → ask: How much would regenerating every caption for a model upgrade cost at {{daily_uploads}} uploads a day, and which ones would you skip?
- when: lock, dedupe, single flight, idempotent → ask: Two requests for the same translation arrive within a millisecond on different servers. Walk through what happens.
- when: user_id, viewer id, device id → ask: Which report needs that identifier? Could the aggregate be computed without it?

**Production Reality Check.**
- A translation cache keyed by video and language serves translations of an outdated caption for {{edit_window}} after creator edits, and complaints rise in one language.
- A model upgrade regenerates auto-captions, overwrites creator-edited ones for a day, and creators report their corrections were lost.
- Serving logs past {{retention}} are not deleted for one region because a partition naming change broke the deletion job.

**Evaluation Criteria.** Immutable caption versions with lineage (source, model, parent version, language); a current-version pointer per video and language; edits that mark or regenerate dependent translations explicitly; on-request translation with a cache keyed by source version and target language and deduplication of concurrent requests; a stated policy for model upgrades that never overwrites creator edits; player logs that carry the version id; aggregates by language pair, model and week, re-runnable; no viewer profiles; retention enforced; a plan for each incident.

## TTK-L2-05: Effects usage from the in-app editor, reported to effect makers in aggregate

| | |
|---|---|
| **Template ID** | TTK-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Client event pipelines / versioned catalogue entities, device capability checks, failed renders, aggregate reporting with suppression |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |

```params
{
  "daily_sessions": {"2": ["50 million", "150 million"], "3": ["400 million", "1 billion"]},
  "effects": ["200 000", "1 million"],
  "min_cell": [20, 50, 100],
  "offline_hours": [12, 48]
}
```

**Business Scenario.** The in-app editor offers about {{effects}} effects, many made by independent effect makers, and each effect is published in versions. There are about {{daily_sessions}} editor sessions a day. When a creator opens an effect, the app first checks whether the device can run it (for example GPU features, memory, camera); then the effect renders in preview, may be applied to a recording, and the video may be posted. Renders sometimes fail or fall back to a simpler mode. Phones queue events offline for up to {{offline_hours}} hours. Effect makers want a daily report for their own effects: opens, devices that could not run it, failed renders by effect version and device class, recordings and posted videos. They must see aggregates only, and never anything about an individual creator or device.

**Problem Statement.** Design the pipeline from editor events to the effect makers' reports. Cover the event model (open, capability check, preview render, failure or fallback, apply, record, post) and how one effect use is identified across them, effect versions and how events are tied to the version actually rendered, device classes and how capability results are recorded, late and duplicate events from offline phones, the report tables, suppression of cells under {{min_cell}}, and how a maker sees only their own effects.

**Constraints.** A failed render must be attributed to the effect version that failed, not to the version currently published. Device information is reduced to a coarse class before it reaches any maker-facing table. Cells with fewer than {{min_cell}} sessions are suppressed in a way that cannot be undone by subtracting from totals. Reports for a day may change for {{offline_hours}} hours and then become final. No creator id reaches the maker's report.

**Assumptions.** Volumes, effect counts, the suppression threshold and the offline window are hypothetical; how any real editor or effect platform works is not described here, so check current docs. A device class is a coarse bucket (for example by chipset tier and OS major version) defined by the platform. Effects are hosted by the platform and identified by effect id and version.

**Clarifications.**
- Q: An effect is updated while a creator is mid-session with the old version. Which version do events belong to? | A: The version that was actually loaded and rendered on the device.
- Q: Do capability-check failures count as failed renders? | A: No. A device that cannot run the effect never renders it; report those apart.
- Q: Does a fallback to a simpler mode count as a failure? | A: Report it as its own outcome, because the effect did render, but not as designed.
- Q: Can a maker see which creators used their effect? | A: No. Makers see aggregates by day, version, device class and country group, with small cells suppressed.
- Q: What links a post to the effect? | A: That is part of your design; the posted video should record the effect id and version it used.

**Hints.**
1. Give each effect use a client-minted id when the effect is opened, and carry it on every later event of that use, so funnels join without a creator id.
2. Put the effect version and a content hash of the downloaded package on every render event, so a failure is tied to what actually ran.
3. Reduce device details to a class on the server at ingestion, and build maker tables only from the reduced events.

**Follow-ups.**
1. A maker publishes a version that crashes on one device class. How quickly can your pipeline show it, and could the platform pull the version automatically?
2. A maker has one niche effect used in fewer than {{min_cell}} sessions a day. What can they see, and how would you let them see weekly totals without breaking suppression?
3. The platform wants a ranking of effects for the editor's browse page. What would you keep out of that ranking's input from this pipeline, and why?
4. At {{daily_sessions}} sessions a day, the deduplication of offline events dominates cost. How would you bound it?

**Follow-up rules.**
- when: device id, device model, user id → ask: Which maker report needs that level of detail? What do you reduce it to before any maker-facing table, and where does the reduction happen?
- when: suppress, threshold, k-anonymity → ask: A maker sees a total and every cell but one. How do you stop them from working out the suppressed cell?
- when: latest version, current version, join on effect id → ask: Version 7 was published at noon; a creator's phone ran version 6 at 12:05 and failed. Where does your pipeline put that failure?
- when: dedupe, dedup, event id, session id → ask: Offline phones send the same render event twice after {{offline_hours}} hours. Where is the duplicate dropped, and for how long do you remember ids?
- when: crash, failure rate, alert → ask: A failure rate jumps from 0.5% to 4% for one version and device class. Is that enough sessions to alert on, and what would you show the maker?

**Production Reality Check.**
- An app release logs the currently published effect version instead of the loaded one, and a fixed effect keeps showing failures for {{offline_hours}} hours of late events.
- A maker notices that a cell suppressed under {{min_cell}} can be recovered by subtracting the other device classes from the daily total.
- A new device class is added server-side, and its events are dropped from reports for three days because the class mapping did not know it.

**Evaluation Criteria.** An event model with a per-use id that joins open, check, render, apply, record and post; failures tied to the loaded version and package hash; capability failures and fallbacks reported apart from failed renders; device details reduced to classes at ingestion; late and duplicate events handled with a bounded deduplication window and days finalised after {{offline_hours}} hours; maker tables keyed by effect and scoped to the maker's own effects; suppression under {{min_cell}} that is protected against subtraction; no creator identifiers in maker reports; a plan for each incident.
