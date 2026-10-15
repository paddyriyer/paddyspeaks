# xAI · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a model API platform
with real-time data: per-model rate limits on requests per second and tokens per minute
that scale with a cumulative-spend tier, a batch API whose requests carry their own ids,
server-side tools for web search and search over public posts that return citations,
real-time ingestion of public posts for retrieval, regional endpoints and usage analytics.
Every tier, limit, window, constant, size and schema is hypothetical and "this exercise's
rule; check current docs". Public posts are rows with a given schema and no content;
teams appear only in aggregate. Nothing here describes a real customer, partner, dataset
or internal system.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## XAI-L1-01: Rate-limit rejections by limit type, per model and spend tier as of each request

| | |
|---|---|
| **Template ID** | XAI-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / as-of join to a slowly changing tier, deduplication, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | XAI-L1-01.mjs |

**Business Scenario.** A model API enforces two limits per model for each team: requests per second and tokens per minute. Both grow with the team's spend tier, and a team moves up a tier when its cumulative spend crosses a threshold (this exercise's tiers; check current docs). A rejected request gets HTTP 429, and the gateway logs which limit it hit. Developers keep asking whether they are mostly hitting the request limit or the token limit, and whether that changes after an upgrade. You are asked for the split per model and tier, where the tier is the one the team was on when it sent the request, not the one it is on today.

**Problem Statement.** Write one PostgreSQL query over `tier_changes(team_id, tier, effective_at)` and `request_log(log_id, gateway, request_id, team_id, model, requested_at, status_code, limit_hit)` that returns `model, tier, requests, rps_rejections, tpm_rejections, rps_share, tpm_share`: one row per model and tier with at least one request, ordered by `model, tier`. A request's tier is the `tier` of its team's latest `tier_changes` row with `effective_at` at or before `requested_at` (a row applies from its `effective_at`, inclusive). `requests` counts requests; `rps_rejections` and `tpm_rejections` count requests with status 429 whose `limit_hit` is `'rps'` or `'tpm'`; the two shares are those counts over `requests`, each rounded to 4 decimal places. {{status_rule}} {{tier_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{requests}} requests in {{log_rows}} log rows. Every 429 has a `limit_hit`; every other status has `limit_hit` NULL.

**Assumptions.** Model names, tiers, team names and every number are hypothetical, and the tiers here are this exercise's rule, not any product's real thresholds or limits; check current docs. Teams are reported only in aggregate. All timestamps are UTC.

**Clarifications.**
- Q: Which tier does a request sent at the very second of an upgrade belong to? | A: The new one. A tier row applies from its `effective_at`, inclusive.
- Q: Do tiers ever go down? | A: Not in this exercise; cumulative spend only grows. Your query should not rely on that, though: take the latest row at or before the request.
- Q: Is a 503 a rejection? | A: No. Only status 429 is a rate-limit rejection. Other failures are still requests and stay in the denominator.
- Q: How are shares rounded? | A: `ROUND(count::numeric / requests, 4)`, half away from zero.
- Q: Should models or tiers with no requests appear? | A: No. Only (model, tier) pairs with at least one request.

**Hints.**
1. Settle the grain first: one row per request. Then attach the tier, then aggregate.
2. The tier as of a time is "the latest row at or before it": a correlated subquery with `ORDER BY effective_at DESC LIMIT 1`, a `LATERAL` join, or `DISTINCT ON` after a range join.
3. `COUNT(*) FILTER (WHERE status_code = 429 AND limit_hit = 'rps')` keeps both splits in one pass.

**Follow-ups.**
1. Developers say an upgrade did not help. How would you compare each team's rejection rate in the days before and after its upgrade without mixing teams of different sizes?
2. Token limits are per minute and request limits per second. How would you show how close a model ran to each limit, not just how often it was hit?
3. The log is billions of rows a day. How would you partition it and maintain the tier as of each request without an as-of join over the whole history?
4. A tier change is recorded in the billing system and reaches the gateways within minutes (this exercise's rule). How would you measure requests rejected under the old tier after the new one took effect?

**Follow-up rules.**
- when: max(tier), current tier, latest tier → ask: You attached the team's tier as it is today. What happens to a request sent last week, before the upgrade?
- when: lateral, distinct on, correlated → ask: How does this as-of lookup behave for a team with thousands of tier rows, and what index makes it cheap?
- when: between, lead → ask: You turned tier rows into ranges with LEAD. Is the upper bound inclusive or exclusive, and what happens at the exact second of an upgrade?
- when: distinct, duplicate, dedupe → ask: Two gateways logged the same request. Which columns decide that two rows are the same request, and which row do you keep?
- when: status_code <> 200, status_code != 200, errors → ask: Is every failed request a rate-limit rejection? Where do 500s and 503s go in your numbers?

**Evaluation Criteria.** Tier taken as of `requested_at` with the boundary inclusive; one row per request before aggregating (Very Hard); teams on tier 1 before their first row (Very Hard); only 429s counted as rejections and split by `limit_hit`, other errors kept in the denominator (Hard+); correct rounding with numeric division; deterministic order; can discuss before/after comparisons, headroom and scale.

## XAI-L1-02: Batch turnaround per size band and week, with batches still pending at the window shown apart

| | |
|---|---|
| **Template ID** | XAI-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / composite-key joins, per-batch rollups, ordered-set percentiles with FILTER |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | XAI-L1-02.mjs |

**Business Scenario.** Teams submit batches of model requests for asynchronous processing. Each request inside a batch carries an id the team chose itself (`custom_id`), and results come back one by one as they finish. This exercise's completion window is {{window_hours}} hours from submission (check current docs for any real product's window). The platform wants a weekly view of how long batches really take, by batch size, and how many requests got a result within the window, without letting a few stuck batches distort the typical turnaround.

**Problem Statement.** Write one PostgreSQL query over `batches(batch_id, team_id, submitted_at)`, `batch_requests(batch_id, custom_id)` and `batch_results(result_id, batch_id, custom_id, result_at, outcome)` that returns `week_start, size_band, batches, requests, in_window_share, pending_batches, median_hours`, one row per week and size band with at least one batch, ordered by `week_start, size_band`. `week_start` is the date of the Monday (UTC) of the week of `submitted_at`. A batch's size is its number of `batch_requests` rows; `size_band` is 1 for sizes 1 to {{mid_less}}, {{mid}} for {{mid}} to {{large_less}}, and {{large}} for {{large}} or more. A request is **in window** when it has a result at or before `submitted_at` plus {{window_hours}} hours; an errored result is still a result. `in_window_share` is in-window requests over all requests in the group, rounded to 4 places. A batch is **pending at the window** if any of its requests is not in window; `pending_batches` counts them. For every other batch, its turnaround is the time from `submitted_at` to its last result; `median_hours` is the median turnaround of those batches in hours, rounded to 2 places, where the median is the lower middle value for an even count (`percentile_disc(0.5)`), or NULL if every batch in the group was pending. {{id_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{batches}} batches. Join results to requests on the full key `(batch_id, custom_id)`.

**Assumptions.** The window, size bands, teams and every timestamp are hypothetical and this exercise's rule; check current docs. Result content is never read: only times and the outcome label. All times are UTC.

**Clarifications.**
- Q: Is a result exactly at the window's end in window? | A: Yes. The window is inclusive: `result_at <= submitted_at + interval`.
- Q: Why leave pending batches out of the median? | A: Their last result is either missing or after the window, so their turnaround is unknown or censored. They are reported in `pending_batches` instead.
- Q: Does an errored result count? | A: Yes. The request was answered within the window; whether it succeeded is a different report.
- Q: Which week does a batch submitted Sunday 23:58 UTC belong to? | A: The week starting the Monday before. Weeks start Monday 00:00 UTC.
- Q: Is the turnaround computed from in-window results only? | A: It is only computed for batches whose every request is in window, so the last result is in the window too.

**Hints.**
1. Build one row per request with its result time (or NULL) first, then one row per batch, then aggregate per week and band.
2. Per batch: `COUNT(*)`, `COUNT(*) FILTER (WHERE in_window)`, `BOOL_AND(in_window)` and `MAX(result_at)` give everything the final step needs.
3. Ordered-set aggregates accept a `FILTER` clause: `percentile_disc(0.5) WITHIN GROUP (ORDER BY …) FILTER (WHERE complete)`.

**Follow-ups.**
1. Teams want turnaround in percentiles for the requests, not the batches. What changes, and which number is more useful to a team planning around the window?
2. A batch can be cancelled part way. How would you report cancelled requests without hiding them in either the in-window or the pending numbers?
3. Results arrive continuously for weeks of history. How would you maintain this report incrementally instead of recomputing it?
4. Turnaround depends on when in the day a batch was submitted. How would you show that without implying a promise the window does not make?

**Follow-up rules.**
- when: custom_id → ask: Is custom_id unique across batches? What does joining on it alone do when two teams both name their requests q1, q2, q3?
- when: avg, average, mean → ask: One batch took 20 times longer than the rest. What does it do to an average turnaround, and why did you choose it over the median?
- when: percentile_cont → ask: percentile_cont interpolates between two batches. What does the report promise when the median is a turnaround no batch actually had?
- when: inner join, join batch_results → ask: A request with no result yet: where does it go in your query, and does its batch still appear?
- when: date_trunc → ask: Which time zone does date_trunc('week', …) use here, and what changes if a team reads this in UTC-8?

**Evaluation Criteria.** Results joined on `(batch_id, custom_id)` (Hard+); requests with no result kept and counted as not in window; the window inclusive; errored results counted as results; pending batches excluded from the median and counted apart; a request's earliest result used (Very Hard); correct band boundaries and Monday weeks; deterministic order; can discuss request-level percentiles, cancellations and incremental maintenance.

## XAI-L1-03: Freshness of public posts: minutes from creation to searchable, per hour

| | |
|---|---|
| **Template ID** | XAI-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first-event per entity, anti-filters, nearest-rank percentiles |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | XAI-L1-03.mjs |

**Business Scenario.** A model API offers a server-side tool that searches public posts, and the posts reach the search index through a real-time ingestion pipeline. The number that matters to developers is freshness: how long after a post is created can a search find it. Posts are rows with a given schema and no content here. Posts can be edited (each edit is a new version, indexed separately) and deleted. You are asked for hourly freshness on {{day}}, measured honestly.

**Problem Statement.** Write one PostgreSQL query over `posts(post_id, created_at, deleted_at)` and `searchable(post_id, version, searchable_at)` that returns `hour_start, posts, unsearchable, median_minutes, p95_minutes`: one row per UTC hour of `created_at` that has at least one post that was not deleted, ordered by `hour_start`. Leave out every post with a `deleted_at`. A post's **lag** is the time from its `created_at` to the first time any of its versions became searchable (its earliest `searchable_at`); an edited post counts once. `posts` counts posts with a lag; `unsearchable` counts posts with no `searchable` row. `median_minutes` and `p95_minutes` are the 50th and 95th percentile lags by nearest rank (the value at position ceil(p · n) in ascending order, which is `percentile_disc`), in minutes, rounded to 2 decimal places, or NULL when the hour has no post with a lag. {{index_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{posts}} posts. Compute the percentiles on the lag before rounding.

**Assumptions.** Post ids, versions and every timestamp are synthetic, and the freshness definition is this exercise's rule; check current docs for any real product. No post content, authors or engagement are used. All times are UTC.

**Clarifications.**
- Q: Is the lag measured to the edit's own time when the edited version is the first one searchable? | A: No. Freshness is from the post's `created_at`: the post became findable at that moment, whichever version it was.
- Q: Why exclude deleted posts entirely, even if they were searchable for a while? | A: This exercise's rule: a deleted post leaves every freshness report, so a report never refers to it. Their lags can be studied elsewhere with the right controls.
- Q: Which hour does a post created at 10:59:59 belong to? | A: 10:00, the hour of `created_at`, even if it became searchable after 11:00.
- Q: Why nearest rank instead of interpolation? | A: So every reported percentile is a lag some post actually had, and so the number is reproducible in any engine.

**Hints.**
1. Reduce `searchable` to one row per post first: `MIN(searchable_at)` grouped by `post_id`.
2. Start from the posts that were not deleted and `LEFT JOIN` the first-searchable times, so posts with none are still counted.
3. `percentile_disc(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM first_at - created_at))` ignores NULLs, which is exactly what `unsearchable` posts need.

**Follow-ups.**
1. Freshness is end to end. How would you break the lag into stages (ingested, labelled, indexed, replicated) so a regression points to one stage?
2. A post that is never searchable has no lag. How would you report it so the percentiles do not look better as the pipeline gets worse?
3. Hourly percentiles cannot be added up into a daily one. How would you store data so any time range can be answered later?
4. At this volume, exact percentiles per hour are expensive. Which sketch would you use, and what error would you state next to the number?

**Follow-up rules.**
- when: percentile_cont → ask: percentile_cont interpolates. What lag does it report for an hour with five posts, and did any post have that lag?
- when: version = 1, version 1 → ask: A post was edited before its first version reached the index. When did it first become findable?
- when: count(*) → ask: Your COUNT(*) runs after joining searchable rows. How many times does an edited post count?
- when: deleted_at → ask: You exclude deleted posts. Should a post deleted three days later be excluded from today's freshness, and what would change if it were kept?
- when: avg, average → ask: What does one post that took 30 minutes do to an hourly average of lags that are usually under a minute?

**Evaluation Criteria.** One lag per post from its earliest searchable time across versions; deleted posts excluded from every column; posts with no searchable row counted apart and left out of the percentiles (Hard+); hours by `created_at` in UTC; nearest-rank percentiles on the unrounded lag; deterministic order; can discuss stage-level lag, censored posts and percentile storage.

## XAI-L1-04: Fusing web and public-post search results with reciprocal rank fusion

| | |
|---|---|
| **Template ID** | XAI-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hashing and ranking / reciprocal rank fusion with exact rational scores and deterministic ties |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | XAI-L1-04.mjs |

**Business Scenario.** A model can call two server-side search tools inside one response: web search and search over public posts. Each tool returns its own ranked list of sources, and the response should cite one fused list. This exercise fuses them with reciprocal rank fusion: each list contributes `weight / (k + rank)` to every source it contains, so a source near the top of both lists beats one that is first in only one. Both tools return canonical source ids, so a post that web search also found has the same id in both lists. The fused order must be reproducible to the last position, because citations are logged and compared across runs.

**Problem Statement.** Implement `fuse_results(web, posts, k, top_n, weights=(1, 1))`. `web` and `posts` are lists of source ids, best first; a source's rank in a list is its 1-based position. A source's score is the sum, over the lists it appears in, of `weight / (k + rank)`, with `weights[0]` for `web` and `weights[1]` for `posts`. Return the ids of at most `top_n` sources, highest score first; sources with equal scores are ordered by id ascending. Compare scores **exactly**, as fractions: two sources whose scores are equal as fractions tie, even if floating-point sums of them differ in the last bit. `k` is this exercise's constant ({{k}} in this instance's tests), and `top_n` is at least 1. {{level_rule}}

**Constraints.** The timing check fuses two lists of 40 000 results each, with about a third of the post results also in the web list. Looking up each source's rank by scanning the other list is over a billion comparisons. Aim for O(n + m) work to score, plus the sort or selection of the top results.

**Assumptions.** The fusion rule, constant, weights and every list are this exercise's, hypothetical; ranking of results inside each list is a scoring function you are given, not something you compute. Ids are synthetic.

**Clarifications.**
- Q: Is rank 0-based or 1-based? | A: 1-based: the first result has rank 1 and contributes `weight / (k + 1)`.
- Q: What if a source is missing from one list? | A: That list contributes nothing for it. There is no penalty term.
- Q: Why exact fractions? Floats are close enough. | A: Close is not equal. Two different rank pairs can give the same fraction, and if the float sums differ in the last bit, the tie-break by id silently flips and logged citations stop matching between runs.
- Q: What if there are fewer than top_n sources? | A: Return all of them, in order.
- Q: Can a source appear twice in one list? | A: In Medium, no. In Hard and Very Hard, yes: only its first position counts, and the list is not renumbered.

**Hints.**
1. Build a dict from source id to its first rank, once per list. Every lookup after that is O(1).
2. Python's `fractions.Fraction` compares exactly. If you prefer integers, compare `p1 * q2` with `p2 * q1`, or build a key from the numerator and denominator.
3. You only need the top `top_n`: `heapq.nsmallest` with a key of `(-score, id)` avoids sorting everything.

**Follow-ups.**
1. A third tool joins with its own list. What changes in your code, and in the exactness argument?
2. One tool often returns the same page under two URLs. Where should canonicalisation happen, and what does it do to that page's rank?
3. Product asks for a score shown to developers. How would you present a fraction honestly, and what would you log so a fused order can be replayed?
4. The lists arrive as streams and the response wants the top 5 as early as possible. When can you be sure a source is in the final top 5?

**Follow-up rules.**
- when: .index(, index(, in posts, in web → ask: How long does looking up one source's rank take with list.index, and how many lookups does a 40 000-result list need?
- when: float, round, epsilon, isclose → ask: Two sources have scores equal as fractions but their float sums differ in the last bit. Which comes first in your output, and which should?
- when: fraction, fractions → ask: How many Fraction objects do you create, and what does each comparison cost compared with integer cross-multiplication?
- when: sorted(, sort( → ask: You sort every source to return the top 100. What would you use instead, and when does it start to matter?
- when: setdefault, first occurrence, first position → ask: Why must the later duplicate not renumber the list, and what would renumbering do to other sources' scores?

**Evaluation Criteria.** 1-based ranks; one dict lookup per source per list; a repeated source counted once at its first position without renumbering (Hard+); exact score comparison with ties by id (Hard+ tests check it); integer weights handled exactly (Very Hard); `top_n` cut correctly inside a tie; clear complexity argument; sensible answers on more lists, canonicalisation and replay.

## XAI-L1-05: Merging index segments of real-time posts at the least bytes rewritten

| | |
|---|---|
| **Template ID** | XAI-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy algorithms / optimal merge pattern with a min-heap, deterministic ties |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | XAI-L1-05.mjs |

**Business Scenario.** Public posts reach a search index in real time, so the index for {{where}} accumulates many small segments, and searches get slower as the segment count grows. A background job merges segments two at a time. A merge reads both segments and writes a new one of their combined size, so every merge rewrites bytes, and bytes rewritten are the job's main cost. The job wants a plan that brings the segment count down with the least total rewriting.

**Problem Statement.** Implement `merge_plan(segments, target=1)`. `segments` is a list of `(segment_id, bytes)` with distinct integer ids. Merging two segments of `a` and `b` bytes rewrites `a + b` bytes and replaces them with a new segment of `a + b` bytes; the j-th merge's new segment gets id `max_id + j`, where `max_id` is the largest id in the input. Merge until at most `target` segments remain. Return `(total, merges)`: the least possible total bytes rewritten, and the plan as a list of `(first_id, second_id, new_id)` in order. To make the plan unique, this exercise's tie rule is that each step merges the two segments that come first by `(bytes, segment_id)`, `first_id` being the one that comes first; that plan achieves the least total, and you should be ready to say why. {{level_rule}}

**Constraints.** The timing check has 80 000 segments of up to 5 MB each. A plan that re-sorts the segments before every merge, or keeps a sorted list and removes from its front, does O(n) work per merge, billions of steps in total. Aim for O(n log n).

**Assumptions.** Segment sizes, ids, the cost model (rewriting is the only cost) and the target are this exercise's, hypothetical; real index merge policies weigh more than bytes. Posts and segments carry no content here.

**Clarifications.**
- Q: Does a merged segment's id matter? | A: Yes: it is in the plan, and it breaks ties. It is `max_id + j` for the j-th merge, so it is always larger than every original id.
- Q: A merged segment has the same size as an original one. Which is merged first? | A: The one with the lower id, which is always the original.
- Q: What if there are already at most `target` segments? | A: No merge: return `(0, [])`. The same for an empty list or a single segment.
- Q: Can a segment have 0 bytes? | A: In Hard and Very Hard, yes (every post in it was deleted). Merging it still counts as a merge and rewrites the other segment's bytes.
- Q: Is the order of the input list meaningful? | A: No. Only sizes and ids matter.

**Hints.**
1. Think about how many times each original byte is rewritten: once per merge above it. Which segments should be merged as late as possible?
2. Exchange argument: in any optimal plan, the two smallest segments can be merged together without increasing the total.
3. A min-heap of `(bytes, segment_id)` gives the two smallest in O(log n) and orders ties exactly as the rule asks.

**Follow-ups.**
1. Prove that merging the two smallest first is optimal, including when the plan stops at `target` segments instead of one.
2. Segments keep arriving while the job runs. How would you adapt the plan, and what do you give up?
3. The merge can take up to f segments at once (rewriting their sum). What changes in the greedy, and when do you need zero-byte placeholders?
4. A merge of very large segments blocks searches on that shard. How would you cap the largest merge, and is the greedy still optimal under the cap?

**Follow-up rules.**
- when: sort(, sorted( → ask: You sort before every merge. How much work is that per merge, and for 80 000 segments in total?
- when: insort, bisect → ask: insort finds the place in O(log n). What does inserting into, and popping from the front of, a Python list cost?
- when: heapq, heap, priority queue → ask: How does your heap order two segments of equal size, and does a merged segment ever go before an original of the same size?
- when: largest, biggest → ask: Why not merge the largest segments first, to get them out of the way? Give a three-segment example.
- when: deque, two queues → ask: Why are merged sizes non-decreasing, and how does that let two queues replace a heap? What happens to ties between the queues?

**Evaluation Criteria.** Least total bytes with the greedy two-smallest rule and a correct optimality argument; ties by `(bytes, id)` with new ids after every original; `(0, [])` for empty, single and already-small inputs (Hard+); zero-byte segments (Hard+); stop at `target` (Very Hard); O(n log n) with a heap or the two-queue method; sensible answers on online arrivals, f-way merges and caps.
