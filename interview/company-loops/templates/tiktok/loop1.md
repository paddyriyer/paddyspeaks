# TikTok · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a short-video
service: uploads from phones on changing networks, duets and stitches, LIVE with
virtual gifts bought with coins, and comment threads. Every creator, number, rule and
schema is hypothetical; gift, remix and upload rules are this exercise's rules (check
current docs), and nothing here describes how any company's systems, ranking or
reporting actually work. The comment score is a number you are given; how it is
computed is out of scope. Viewers appear only in aggregates, a creator's own data may
be shown to that creator, and nothing here infers a protected or sensitive attribute of
anyone. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TTK-L1-01: Upload success per app version and network type, resumed attempts counted once

| | |
|---|---|
| **Template ID** | TTK-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / collapsing attempts to one row per entity, first-row attributes, inclusive time bounds, exclusion by state |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | TTK-L1-01.mjs |

**Business Scenario.** Creators upload videos from phones on Wi-Fi, 5G and 4G, and an upload interrupted by a dropped connection resumes later, sometimes on a different network. A mobile team wants to know whether a new app version made uploads more reliable, and the agreed measure for this exercise is simple: the share of uploads **published within one hour of the first attempt**. Every attempt writes one row to the attempt log, and resumed attempts share the upload's `upload_id`. Counting rows instead of uploads would reward a version that interrupts more often.

**Problem Statement.** Write one PostgreSQL query that returns `app_version, network_type, uploads, published_within_1h, success_rate`, one row per app version and network type that has at least one counted upload, ordered by `app_version, network_type`. An upload is all the attempts with one `upload_id`, counted once, under the `app_version` and `network_type` of its **first attempt** (the earliest `started_at`). An upload is published if one of its attempts has `outcome = 'published'`; that attempt's `ended_at` is the publish time. It counts in `published_within_1h` if the publish time is at most one hour after the first attempt's `started_at` (exactly one hour counts). `success_rate` is `published_within_1h / uploads`, rounded to 4 decimal places. {{draft_rule}} {{id_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{uploads}} uploads in {{attempts}} attempt rows. An upload has at most one published attempt, and no two attempts of one upload start at the same instant.

**Assumptions.** Versions, networks, attempts and the one-hour rule are hypothetical and defined for this exercise only; they do not describe any product's reporting. The log carries no creator or video content, only opaque ids, and the result is aggregated.

**Clarifications.**
- Q: An upload started on 4G and finished on Wi-Fi after a resume. Which network is it? | A: 4G: the network of its first attempt.
- Q: Is the hour measured from the attempt that published? | A: No. From the `started_at` of the upload's first attempt, however many resumes came between.
- Q: Published exactly 60 minutes after the first attempt started? | A: It counts. One second later does not.
- Q: Do uploads that failed and never published count? | A: Yes, in `uploads` and not in `published_within_1h`.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` on a numeric.

**Hints.**
1. Reduce the attempts to one row per `upload_id` first; everything after that counts uploads, not attempts.
2. `(ARRAY_AGG(app_version ORDER BY started_at))[1]` or `DISTINCT ON (upload_id) … ORDER BY upload_id, started_at` gives the first attempt's attributes.
3. Hard: decide per upload whether it was ever saved as a draft and whether it was ever published, then filter.
4. Very Hard: order by `started_at`, never by `attempt_id`.

**Follow-ups.**
1. The team wants the median minutes from first attempt to publish per version, for published uploads only. Add it and say why it must be read next to the success rate.
2. Version 2 shipped to Wi-Fi-heavy markets first. How could that make it look more reliable than it is, and how would you compare versions fairly?
3. Uploads still in progress when the report runs have no final outcome yet. How do you keep the latest hours from looking like failures?
4. At hundreds of millions of attempts a day, attempts of one upload arrive over hours and days. How would you maintain the per-upload row incrementally, and when is an upload's outcome final?

**Follow-up rules.**
- when: count(*), count(attempt_id) → ask: An upload was interrupted twice and then published. How many rows does your count give it, and how many uploads is it?
- when: max(network_type), min(network_type), max(app_version) → ask: MIN or MAX of a text column gives the alphabetically first value, not the first attempt's. Which attempt does your query take the network from?
- when: min(attempt_id), row_number, order by attempt_id → ask: Is `attempt_id` guaranteed to follow time? What happens when a phone that was offline sends its first attempt's log late?
- when: < interval, '60 minutes', '1 hour' → ask: An upload publishes exactly one hour after its first attempt started. Does your comparison count it, and should it?
- when: draft, saved_draft → ask: A draft is published two days later. Is it in your denominator, and is it a success?

**Evaluation Criteria.** One row per upload before counting; the version and network of the first attempt by `started_at`; the hour measured from the first attempt, inclusive at exactly one hour; abandoned drafts excluded while drafts published later stay (Hard+); first attempt by time, not by id (Very Hard); correct rounding and order; can discuss confounding by market and in-progress uploads.

## TTK-L1-02: Remix reach — distinct creators who duetted or stitched an original within 7 days

| | |
|---|---|
| **Template ID** | TTK-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / anti-join to find originals, as-of lookup of a setting, distinct counts per entity then summed, LEFT JOIN with conditions in ON |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | TTK-L1-02.mjs |

**Business Scenario.** Duets and stitches let creators build on each other's videos, and a creator can turn remixing off for a video. A creator-tools team wants a weekly measure of how far originals travel through remixes: for each original, how many **different creators** duetted or stitched it within 7 days of its publishing, summed over the originals published that week. Originals whose creator had remixing turned off when they were published are left out, because nobody could remix them. Settings change over time, so the current setting is not the one that applied.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, originals, remixed_originals, remix_creators, creators_per_original`, one row per week with at least one counted original, ordered by `week_start`. An **original** is a video that does not appear in `remixes` as `remix_video_id`. It is counted if the setting in force at its `published_at` (the latest `remix_settings` row for it with `changed_at` at or before `published_at`) has `remix_allowed = TRUE`. Its **reach** is the number of distinct creators of remix videos whose `source_video_id` is the original, published at most 7 days (7 × 24 hours, exactly 7 days included) after it, not counting the original's own creator. Per week of the original's `published_at` (Monday 00:00 UTC; `week_start` is that Monday's date): `originals` counted, `remixed_originals` with reach above 0, `remix_creators` the sum of their reaches, and `creators_per_original` = `remix_creators / originals` rounded to 2 decimal places. {{setting_rule}} {{remix_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{videos}} videos, of which {{remixes}} are remixes. Every original has a setting row at or before its `published_at`.

**Assumptions.** Videos, creators, settings and the 7-day window are hypothetical; this exercise's rule, not a product definition (check current docs for how remix permissions work). Creator ids are opaque, and the measure describes videos in aggregate, never a person.

**Clarifications.**
- Q: One creator made a duet and a stitch of the same original. | A: One creator for that original.
- Q: One creator remixed two different originals in the week. | A: They count once for each original: reach is per original, then summed.
- Q: The original's creator duetted their own video. | A: Not counted.
- Q: A remix published in the week after the original's week? | A: It counts toward the original's week, if it is within 7 days.
- Q: An original with remixing on and no remixes? | A: It is counted in `originals` with reach 0.

**Hints.**
1. Find originals with `NOT EXISTS` against `remixes.remix_video_id`.
2. The setting in force at a time is the latest row at or before it: a correlated subquery with `ORDER BY changed_at DESC LIMIT 1`, or `DISTINCT ON`.
3. Compute reach per original with `COUNT(DISTINCT …)`, then aggregate originals per week; a LEFT JOIN keeps originals with no remixes, if the filters live in the `ON` clause.

**Follow-ups.**
1. The team also wants duets and stitches reported apart. A creator who did both: how do you count them in each column and in the total, and why do the columns no longer add up?
2. Turning remixing off after publishing does not delete existing remixes. Should a remix made just before the change count, and what does your query do?
3. Reach should also credit remixes of remixes to the root original (a stitch of a duet of it). How would you find the root, and how deep can chains go before a recursive query becomes the bottleneck?
4. At billions of videos, the as-of lookup per original and the distinct count per original are the expensive parts. How would you compute this incrementally each day?

**Follow-up rules.**
- when: count(*), count(remix_video_id) → ask: A creator made a duet and a stitch of one original. What does your count give, and what is reach?
- when: count(distinct creator_id) → ask: Distinct over the whole week, or per original? One creator remixed three originals this week: how many creators should the week show?
- when: videos.remix_allowed, current setting, latest → ask: A creator turned remixing off a week after publishing. Which setting does your query read for that original, and which one does the rule want?
- when: where rv., where x. → ask: Your filter on the remix side is in WHERE after a LEFT JOIN. What happens to an original with no remixes in the window?
- when: < interval, '7 days' → ask: A remix lands exactly 7 days after its original. Is it in your reach?

**Evaluation Criteria.** Originals found with an anti-join; eligibility from the setting in force at publish time, not the latest (Hard+); distinct remix creators per original excluding the original's creator; the 7-day bound inclusive; zero-reach originals kept through a LEFT JOIN with conditions in ON; the original's week, not the remix's; remixes of remixes kept out (Very Hard); correct rounding and order; can discuss lineage roots and incremental computation.

## TTK-L1-03: LIVE minutes and gifts per creator-day in the creator's time zone

| | |
|---|---|
| **Template ID** | TTK-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / local dates with AT TIME ZONE, splitting intervals at midnight with generate_series, anti-join exclusion, open intervals capped at a cutoff |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | TTK-L1-03.mjs |

**Business Scenario.** Creators who go LIVE see a daily summary of their own sessions: minutes live and the gifts viewers sent, valued in coins. Creators live in many time zones, so a "day" is the creator's local date, and LIVE sessions often run across local midnight: a session from 23:30 to 01:10 is 30 minutes on one day and 70 on the next, and a gift belongs to the local date it was sent. A gift can be reversed later (for this exercise, any reversal removes it from the summary; check current docs for how gift rules work). Viewers do not appear in the data.

**Problem Statement.** Write one PostgreSQL query that returns `creator_id, local_date, live_minutes, gifts, coins`, one row per creator and local date on which the creator was live for more than 0 minutes, ordered by `creator_id, local_date`. Local dates and times use the creator's `time_zone`. `live_minutes` is the total minutes of the creator's sessions that fall within that local date: a session that crosses local midnight is split there. `gifts` and `coins` count and sum the gifts sent during the creator's sessions whose `sent_at` falls on that local date, excluding every gift with at least one row in `gift_reversals`; a day without such gifts shows 0 and 0. The report runs at {{cutoff}} UTC. {{edge_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{sessions}} sessions and {{gifts}} gifts. Sessions start and end on whole minutes, one creator's sessions never overlap, and no daylight-saving change falls inside the data.

**Assumptions.** Creators, sessions, coin values and the reversal rule are hypothetical. The summary is shown only to the creator it describes; there is no information about who sent a gift.

**Clarifications.**
- Q: A session runs 23:30 to 01:10 local. | A: 30 minutes on the first date, 70 on the next.
- Q: A session ends at exactly 00:00 local. | A: Nothing on the next date, and no row for it unless another session is live then.
- Q: A gift sent at 00:00:00 local? | A: It belongs to the new date.
- Q: A gift was reversed two days later. Does it count on the day it was sent? | A: No. A reversed gift is excluded whenever it was reversed.
- Q: Which time zone defines the date: the session's, the viewer's or UTC? | A: The creator's, from `creators.time_zone`.

**Hints.**
1. `ts AT TIME ZONE c.time_zone` turns a `timestamptz` into the creator's local wall-clock time; its `::date` is the local date.
2. For each session, `generate_series(date_trunc('day', local_start), local_end, INTERVAL '1 day')` lists the local dates it touches; each piece is `LEAST(end, day + 1 day) − GREATEST(start, day)`.
3. Aggregate minutes and gifts separately and LEFT JOIN gifts onto the live days.
4. Very Hard: `COALESCE(ended_at, <cutoff>)` for sessions still live.

**Follow-ups.**
1. A creator moves from one time zone to another mid-month. What should their history show, and what would you store to make it reproducible?
2. The data spans a daylight-saving change. What happens to a session across the change in your query, and is a "day" still 24 hours?
3. The creator also wants to see minutes and coins per session, with sessions across midnight shown whole. How do you serve both views from one model without double counting?
4. Gifts arrive as a stream of tens of thousands per second during big events, and reversals arrive days later. How would you keep the daily summary correct and restate it when a reversal lands?

**Follow-up rules.**
- when: ::date, date(started_at), date_trunc('day', started_at) → ask: In which time zone is that date taken? What does a session at 21:00 in Los Angeles get?
- when: extract(epoch from ended_at - started_at), ended_at - started_at → ask: The whole session's length goes to one date. Where do the minutes after local midnight belong?
- when: left join gift_reversals, join gift_reversals → ask: One gift has two reversal rows. What does your join do to the gift count and the coin sum?
- when: at time zone → ask: `AT TIME ZONE` on a timestamptz gives a timestamp without zone. What does applying it a second time do, and where would that break?
- when: ended_at is not null, coalesce → ask: A session is still live when the report runs. What does it contribute, and what changes when the report is re-run an hour later?

**Evaluation Criteria.** Local dates from the creator's time zone; sessions split at local midnight with no zero-minute rows; gifts dated by their own local send time; reversed gifts excluded once whatever the number of reversal rows (Hard+); half-hour zones handled (Hard+); open sessions counted to the cutoff (Very Hard); minutes and gifts aggregated separately and joined; correct order; can discuss time-zone moves, daylight-saving days and restatement after late reversals.

## TTK-L1-04: Resumable upload assembly — fewest received byte ranges, or the first missing byte

| | |
|---|---|
| **Template ID** | TTK-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy interval cover / sort once by start, furthest reach per step, first gap |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | TTK-L1-04.mjs |

**Business Scenario.** A long video is uploaded in parts, and on a phone that drops connections the client retries: a part is resent whole, resumed from the middle, or cut short when the network fails again. The server ends up with many overlapping byte ranges, some of them duplicates. Before the video can be processed, an assembler must decide whether every byte arrived and, if it did, which received ranges to read, as few as possible, so the file is stitched from the fewest reads. For a large file the server holds well over a hundred thousand ranges, and the assembler must answer quickly.

**Problem Statement.** Implement `assemble_upload(file_size, ranges)`. The file has bytes `0 … file_size − 1`. Each range is `(seq, first_byte, last_byte, checksum_ok)`: bytes `first_byte` to `last_byte` inclusive, received with the unique sequence number `seq`. Only ranges with `checksum_ok` True are usable. Assemble from byte 0: at each step, among the usable ranges that contain the first byte not yet covered, take the one whose `last_byte` is largest, breaking ties by the lowest `seq`; continue after its last byte. This rule picks the fewest ranges. Return `("complete", [seq, …])` with the chosen ranges in file order once the whole file is covered, or `("missing", offset)` with the first byte that no usable range contains. {{order_rule}}

**Constraints.** Up to 150 000 ranges and covers of more than 10 000 ranges. `0 ≤ first_byte ≤ last_byte < file_size` and `file_size ≥ 1`. Rescanning every range at every step is O(n·k) for a cover of k ranges; aim for O(n log n).

**Assumptions.** File sizes, parts and sequence numbers are hypothetical. Nothing about the video's content is read or needed.

**Clarifications.**
- Q: Two ranges `[0, 199]` and `[200, 499]`: is there a gap? | A: No. Both ends are inclusive, so they meet.
- Q: Two ranges end on the same byte. Which one? | A: The lower `seq`, whatever their starts.
- Q: What if no range starts at byte 0? | A: Return `("missing", 0)`.
- Q: May I sort the input? | A: Yes; return the chosen `seq` values in file order.
- Q: Can a failed range be used for bytes no other range has? | A: No. A failed checksum means the bytes are not trusted; those bytes are missing.

**Hints.**
1. A range that starts after the first uncovered byte cannot help yet; a range that ends before it never will again.
2. Sort usable ranges by `first_byte` once. Keep a pointer: at each step, advance it over every range that starts at or before the uncovered byte, remembering the best end.
3. Each range is looked at once by the pointer, so the sweep is linear after the sort.

**Follow-ups.**
1. Prove that taking the range that reaches furthest gives the fewest ranges.
2. The server must answer "is it complete yet?" after every received range, not once at the end. What would you keep so each arrival costs O(log n)?
3. Reads are cheaper when ranges are long and contiguous on disk. How would you change the objective to fewest bytes read twice, and is greedy still optimal?
4. Parts of one upload land on different servers. How would you assemble across them without moving every range to one place?

**Follow-up rules.**
- when: for r in ranges, rescan, nested loop → ask: Your cover has 11 000 ranges and the server holds 132 000. How many range checks does your loop do in total?
- when: dp, dynamic programming → ask: What does each DP state depend on, and how many transitions are there for 132 000 ranges? Is there an exchange argument that removes the DP?
- when: heap, heapq → ask: What does the heap order by, and what does it give you that a sorted list and one pointer do not?
- when: last + 1, last_byte + 1, off by one → ask: Your ranges are inclusive. Where exactly does the next step start, and what does that do for two ranges that meet?
- when: checksum, checksum_ok → ask: A failed range is the only one reaching furthest. Where in your loop is it filtered, and what is the first missing byte if it held a byte nobody else did?

**Evaluation Criteria.** A single sort by first byte and a forward sweep with a pointer, O(n log n); inclusive bounds and adjacency; the furthest end per step, ties by lowest `seq`; the first missing byte as the sentinel result, including 0; unordered input and duplicates (Hard+); failed checksums ignored and single-byte files (Very Hard); can prove the greedy and make it incremental.

## TTK-L1-05: Comment thread display order with deleted comments kept as placeholders

| | |
|---|---|
| **Template ID** | TTK-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Trees / children index, iterative pre-order DFS with an explicit stack, post-order pruning, sorted siblings |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | TTK-L1-05.mjs |

**Business Scenario.** Comments under a popular video become threads: replies to comments, replies to replies, and sometimes two people answering each other thousands of times. The display order is fixed for this exercise: replies sit under their parent, depth first, and siblings are ordered by a score you are given (highest first), then by id. A deleted comment that still has replies below it stays as a placeholder ("comment deleted") so the conversation keeps its shape; one with nothing left below it disappears. A thread export job lays out every comment of a video in this order, and the largest threads have a hundred thousand comments.

**Problem Statement.** Implement `thread_order(comments)`. Each comment is `(comment_id, parent_id, score, deleted)`; `parent_id` is None for a top-level comment. Return a list of `(comment_id, depth, placeholder)` in display order: top-level comments at depth 0 ordered by `score` descending, then `comment_id` ascending; after each comment, its replies (depth + 1) in the same order, each followed by its own replies, depth first. A comment that is not deleted is always shown with `placeholder` False. A deleted comment is shown with `placeholder` True if at least one comment below it (at any depth) is shown, and is left out with everything below it otherwise. {{input_rule}}

**Constraints.** Up to 100 000 comments in one thread, and reply chains can be tens of thousands deep. Scanning all comments for each comment's replies is O(n²). Recursion stops at Python's default recursion limit (1 000). Aim for O(n log n) without recursion.

**Assumptions.** Comment ids, scores and threads are hypothetical. The score is input data; how it is computed is out of scope, as is anything a comment says. No information about who wrote a comment is used.

**Clarifications.**
- Q: Two replies have the same score. | A: The lower `comment_id` first.
- Q: A deleted comment whose only reply was also deleted? | A: Both disappear.
- Q: A deleted comment above a deleted reply above a live reply? | A: Both deleted comments are shown as placeholders.
- Q: Is depth counted from 0? | A: Yes. A top-level comment is depth 0, its replies depth 1.
- Q: Can parent links form a cycle? | A: No.

**Hints.**
1. Build a dict from parent id to its replies once, and sort each list of siblings once.
2. Replace recursion with a stack of `(comment_id, depth)`: push a comment's replies in reverse order so the first one is popped next.
3. Whether a deleted comment is shown depends on what is below it. The reverse of a pre-order visits every reply before its parent, so one backward pass decides it.

**Follow-ups.**
1. Viewers load threads page by page: the first 20 top-level comments with up to 3 replies each, then "view more". How would you serve that without laying out the whole thread?
2. Scores change constantly. How would you keep the order stable while someone is reading, and when do you re-sort?
3. A comment is deleted while the export runs. What guarantees does your output give, and what would you snapshot?
4. Threads of the largest videos are stored across many partitions by comment id. How would you build the display order without loading the thread onto one machine?

**Follow-up rules.**
- when: recursion, recursive, def visit, def dfs → ask: A reply chain is 20 000 deep. What happens to your function at depth 1 000, and is raising the recursion limit a fix you would ship?
- when: setrecursionlimit → ask: That works on this machine. What decides the real stack depth, and what happens in a runtime with a smaller stack?
- when: for c in comments, scan all → ask: For each of 100 000 comments you scan every comment for its replies. How many checks is that?
- when: placeholder, deleted → ask: How do you know a deleted comment has a live reply three levels down before you print the deleted comment?
- when: sort, sorted → ask: How many times does your code sort, and over what? Is it once per sibling list or once per visit?

**Evaluation Criteria.** A children index built once and siblings sorted once; an iterative depth-first walk with correct depths; deleted comments shown as placeholders exactly when something below is shown, decided without recursion; ties by id; unordered input and purged parents shown at the top level (Very Hard); O(n log n) and no recursion limit; can discuss paging, changing scores and partitioned threads.
