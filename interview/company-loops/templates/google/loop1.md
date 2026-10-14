# Google · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domains of a search,
video, maps and advertising company. Every workload, number and schema is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GOO-L1-01: Short clicks and long clicks on search results

| | |
|---|---|
| **Template ID** | GOO-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LEAD over a user's event stream, dwell thresholds, page-level flags |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | GOO-L1-01.mjs |

**Business Scenario.** A web search product logs, for every results page it serves, the page itself and what the searcher did on it: clicks on results and returns to the page with the back button. A click followed by a quick return (a **short click**) suggests the result did not satisfy; a click the searcher stays away from (a **long click**) suggests it did. The search-quality team wants, per query, the share of results pages that earned at least one long click, worst queries first.

**Problem Statement.** Write one PostgreSQL query that returns `query, pages, clicks, short_clicks, long_click_pages, long_click_rate`, ordered by `long_click_rate, query`, for every query with at least {{min_pages}} results pages. A user's events are all the `page_events` of that user's pages, in `event_ts, event_id` order. The **dwell** of a click is the time from the click to the same user's next event, whatever page it is on. A click is **long** if its dwell is at least {{long_s}} seconds, or if the user has no later event at all; otherwise it is **short**. `pages` counts the query's results pages, `clicks` and `short_clicks` count their clicks, `long_click_pages` counts pages with at least one long click, and `long_click_rate = long_click_pages / pages` rounded to 4 decimal places. {{next_rule}} {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). The threshold is inclusive: a dwell of exactly {{long_s}} seconds is long. Pages with no clicks count in `pages`. The sample has {{pages}} pages and {{events}} events.

**Assumptions.** Hypothetical schema, traffic and threshold. `user_id` is a pseudonymous browser identifier. Real dwell measurement has more signals (tabs, app switches); this exercise uses only the logged events.

**Clarifications.**
- Q: What ends a click's dwell? | A: The same user's next event of any kind: a return, another click, or the serve of a new results page.
- Q: The click is the user's last event. | A: The user never came back: it is a long click.
- Q: Is a dwell of exactly {{long_s}} seconds long? | A: Yes. At least {{long_s}} seconds is long.
- Q: A page has two long clicks. | A: It counts once in `long_click_pages`; both clicks count in `clicks`.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` of long_click_pages / pages, half away from zero.

**Hints.**
1. Join `page_events` to `results_pages` to get the user, then `LEAD(event_ts) OVER (PARTITION BY user_id ORDER BY event_ts, event_id)`. Partitioning by page would miss a new search.
2. Classify clicks after the window function; keep every page (a LEFT JOIN from `results_pages`) so pages without clicks stay in the denominator.
3. Aggregate to the page first (`BOOL_OR` for "has a long click"), then to the query.

**Follow-ups.**
1. The threshold of {{long_s}} seconds is arbitrary. How would you choose it from data, and how would you report sensitivity to it?
2. Users open results in new tabs, so the next event may come from another tab while they are still reading. What does that do to dwell, and what extra logging would you ask for?
3. A long-click rate per query is noisy for rare queries. How would you rank the "worst" queries without the list being all one-page queries?
4. At billions of searches a day, how would you compute this daily when a user's next event can land after midnight or arrive late from a phone?

**Follow-up rules.**
- when: partition by page, partition by page_id → ask: If you partition LEAD by page, what dwell does a click get when the user's next action is a brand-new search?
- when: inner join, from page_events → ask: What happens to a results page where nobody clicked anything?
- when: avg, average dwell, mean → ask: Why does this report count pages with a long click rather than average the dwell of clicks?
- when: is null, coalesce, last click → ask: What does your query do with a click that has no later event, and why is long the right answer here?
- when: dedup, duplicate, distinct on → ask: If a click is logged twice, what dwell does the first copy get, and how does that bias the report?

**Evaluation Criteria.** Dwell from the user's next event across pages, in a deterministic order; inclusive threshold; a click with no later event is long; pages without clicks kept; page-level "has a long click"; duplicate clicks removed before LEAD (Very Hard); correct rounding and order; can discuss threshold choice, tabs and small-sample noise.

## GOO-L1-02: Audience retention curve from played ranges

| | |
|---|---|
| **Template ID** | GOO-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / interval stabbing on a generated grid, merging overlapping intervals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | GOO-L1-02.mjs |

**Business Scenario.** A video platform shows creators an audience-retention curve: for each moment of a video, the share of views that were still watching at that moment. The player reports which parts of the video each view actually played, as ranges of video position in seconds. You are writing the query behind the curve, sampled at checkpoints every {{step}}% of each video's length.

**Problem Statement.** Write one PostgreSQL query that returns `video_id, pct, viewers, retention`: one row for every video in `videos` and every checkpoint `pct` = 0, {{step}}, …, {{last_pct}}, ordered by `video_id, pct`. A checkpoint's position is `floor(duration_s * pct / 100)` seconds. A played range covers positions `start_s ≤ position < end_s` (half-open). `viewers` is the number of counted views of the video with at least one range covering the checkpoint's position; `retention = viewers / counted views of the video`, rounded to 4 decimal places. {{range_rule}} {{play_rule}}

**Constraints.** One SQL statement (CTEs allowed). Checkpoints nobody reached appear with 0 viewers and retention 0. A range is clipped to `[0, duration_s)` before anything else. The sample has {{views}} views and {{ranges}} ranges.

**Assumptions.** Hypothetical videos and viewing behaviour, at one-second resolution. Real retention reports handle ads, playback speed and live streams; this exercise does not.

**Clarifications.**
- Q: Does a range ending exactly at a checkpoint's position cover it? | A: No. Ranges are half-open; one starting exactly there does.
- Q: A view rewinds and plays the checkpoint twice. | A: It counts once.
- Q: Which checkpoints exist? | A: 0, {{step}}, … up to {{last_pct}}: every multiple of {{step}} below 100.
- Q: What is the position for 30% of a 125-second video? | A: floor(125 × 30 / 100) = 37 seconds.
- Q: How is retention rounded? | A: `ROUND(…, 4)` of viewers over counted views, half away from zero.

**Hints.**
1. Build the grid first: `videos` × `generate_series(0, 99, {{step}})`, with the position computed in integers.
2. Join ranges to the grid on `start_s <= pos AND pos < end_s`, then `COUNT(DISTINCT view_id)`; LEFT JOIN that back onto the grid for the zero rows.
3. Distinct seconds played per view: merge overlapping ranges (a running `MAX(end_s)` over the previous rows starts a new island when `start_s` is past it), then sum the island lengths.

**Follow-ups.**
1. The curve is shown per second for a two-hour video with 10 million views. Why is the grid join expensive, and how would you compute it with +1/−1 events at range boundaries and a running sum instead?
2. Creators compare the curve with "typical" videos of similar length. What would you precompute so that comparison is cheap and fair?
3. Played ranges arrive in batches from the player, possibly hours late and possibly twice. How would you keep the curve correct and idempotent?
4. A view at 2× speed covers twice the video per second of wall time. Does it change this report? Which other report would it change?

**Follow-up rules.**
- when: between, <= end_s → ask: A range ends exactly at a checkpoint's position. Does your condition count it, and should it?
- when: count(*), count of ranges → ask: A viewer rewinds across a checkpoint. How many times does your query count them there?
- when: generate_series, grid, cross join → ask: How big is your grid for per-second checkpoints over every video, and what would you do instead?
- when: sum(end_s, sum of lengths, total length → ask: Two ranges of one view overlap. How many seconds does your played-time calculation give, and how many distinct seconds were watched?
- when: inner join, join hits, having → ask: Where does a checkpoint that nobody reached go in your result?

**Evaluation Criteria.** A complete video × checkpoint grid with integer positions; half-open coverage; distinct views per checkpoint; zero rows kept; ranges clipped to the video; engaged-view filter from merged (not summed) ranges applied to numerator and denominator alike (Very Hard); correct rounding and order; can discuss the boundary-event formulation at scale.

## GOO-L1-03: Impression share and why it was lost, from auction logs

| | |
|---|---|
| **Template ID** | GOO-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-group ranking with ROW_NUMBER, top-1 per entity, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | GOO-L1-03.mjs |

**Business Scenario.** A search advertising platform tells advertisers their **impression share**: of the auctions their campaign was eligible for, the share in which an ad was shown, and how the rest were lost, to budget or to rank. You have one auction log and one bid log, and a deliberately simplified auction model (stated below, hypothetical) to reproduce the report from them.

**Problem Statement.** Write one PostgreSQL query that returns `auction_date, campaign_id, eligible, impressions, top_impressions, impression_share, lost_budget_share, lost_rank_share`: one row per UTC date of `auction_ts` and campaign with at least one eligible auction, ordered by `auction_date, campaign_id`. A campaign is **eligible** for every auction in which it has a bid. In each auction: a campaign with `budget_limited = true` does not enter and is **lost to budget**; the other campaigns are ranked by `ad_rank` descending, and the first `slots` of them are **shown** at positions 1, 2, …; every other entered campaign is **lost to rank**. `top_impressions` counts auctions shown at position 1. The three shares are impressions, lost-to-budget and lost-to-rank auctions divided by `eligible`, each rounded to 4 decimal places. {{min_rule}} {{ads_rule}}

**Constraints.** One SQL statement (CTEs allowed). A budget-limited campaign never takes a position, so it can never push another campaign out of a slot. The sample has {{auctions}} auctions and {{bids}} bid rows.

**Assumptions.** The auction model, ranks, slots and thresholds are hypothetical and much simpler than any real ad auction; they exist to make the report computable. Pricing is out of scope.

**Clarifications.**
- Q: Does a budget-limited campaign still use up a position? | A: No. It does not enter, so the next campaign moves up.
- Q: Which date does an auction belong to? | A: The UTC date of `auction_ts`.
- Q: Do the three shares always add up to 1? | A: Before rounding, yes: every eligible auction is shown, lost to budget or lost to rank. After rounding to 4 places they may differ by a tiny amount.
- Q: What if a campaign has no bid in an auction? | A: It was not eligible; that auction is not in its denominator at all.
- Q: How are shares rounded? | A: `ROUND(…, 4)` of each count over eligible, half away from zero.

**Hints.**
1. Reduce the bids to one row per (auction, campaign) first, even if the sample looks like it already is.
2. Rank only the entered campaigns: filter, then `ROW_NUMBER() OVER (PARTITION BY auction_id ORDER BY ad_rank DESC, campaign_id)`, and LEFT JOIN the positions back onto every eligible pair.
3. One row per (auction, campaign) with three booleans (shown, lost to budget, lost to rank) makes the final aggregation a set of `COUNT(*) FILTER (…)`s.

**Follow-ups.**
1. Advertisers want impression share by hour of day in their own time zone. What changes, and which auctions move to a different day?
2. "Eligible" here is any auction with a bid. In a real system eligibility is itself estimated (targeting, quality thresholds). How would you report an estimated denominator honestly?
3. At billions of auctions a day, how would you partition the bid log, and can you compute the ranking without a shuffle by campaign?
4. Budget-limited auctions cluster late in the day. How would you use this report to tell an advertiser how much more traffic a larger budget would buy?

**Follow-up rules.**
- when: rank(), dense_rank → ask: Two campaigns tie on ad_rank. What positions does RANK give them, and can that show more ads than there are slots?
- when: budget_limited → ask: Where in your query does a budget-limited campaign stop taking a position from someone else?
- when: row_number → ask: Your ROW_NUMBER partitions by auction. What is in the ORDER BY, and is it deterministic?
- when: avg, average share → ask: Is a campaign's daily impression share the average of its per-auction outcomes, or the ratio of the totals? Is there a difference here?
- when: group by bid, per bid, bid_id → ask: A campaign has three ads in one auction. How many times is it eligible, and how many slots can it take?

**Evaluation Criteria.** Budget-limited campaigns excluded before ranking; a deterministic ranking within each auction; slots respected; the minimum rank inclusive and ties broken by campaign_id (Hard+); one entrant per campaign with its best ad and eligibility counted once (Very Hard); shares over eligible auctions with correct rounding; UTC dates; deterministic order; can discuss time zones, estimated eligibility and scale.

## GOO-L1-04: Trending queries per window with a lateness bound

| | |
|---|---|
| **Template ID** | GOO-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Streaming / event-time windows, watermarks, heaps and top-K |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | GOO-L1-04.mjs |

**Business Scenario.** A search product's trends panel shows the top queries in each window of event time. Searches reach the aggregator out of order, some by minutes: a phone may have been offline. The aggregator waits a bounded time for stragglers, then publishes the window and drops anything that arrives for it later, counting what it dropped.

**Problem Statement.** Implement `trending(events, width, lateness, k, distinct_users=False)`. `events` is a list of `(event_ts, user_id, query)` in **arrival order**, with `event_ts ≥ 0` in seconds. An event belongs to the window starting at `event_ts - event_ts % width`. The **watermark** is the largest `event_ts` among the events that have arrived so far, minus `lateness`; before the first event there is none. Process events in order: an event whose window end (`start + width`) is less than or equal to the watermark of the events before it is **dropped**; otherwise it is accepted into its window, then the watermark is updated, and every window whose end is at or below the new watermark closes. At the end of input every remaining window closes. Return `(windows, dropped)`: `windows` lists `(window_start, top)` for every window that accepted at least one event, in ascending `window_start`; `top` holds up to `k` `(query, count)` pairs. {{count_rule}} {{tie_rule}} `dropped` is the number of dropped events.

**Constraints.** Up to 200 000 events; `width ≥ 1`, `lateness ≥ 0`, `k ≥ 1`. Thousands of windows can be open at once when `lateness` is large: per-event work must not grow with the number of open windows.

**Assumptions.** Hypothetical traffic and query texts. Event times are trusted (no clock skew correction). The output is the published panel, so a window, once closed, never changes.

**Clarifications.**
- Q: Does a window close when the watermark equals its end? | A: Yes. A window [s, s + width) closes as soon as the watermark reaches s + width, and an event for it after that is dropped.
- Q: Does an old event move the watermark back? | A: No. The watermark only ever advances: it uses the largest event_ts seen so far.
- Q: Can a late event open a window that has no events yet? | A: Yes, if that window has not closed (its end is still above the watermark).
- Q: Is the dropped event itself used to advance the watermark? | A: Its event_ts is older than the watermark's source, so it cannot advance it either way.
- Q: What if the input is empty? | A: Return ([], 0).

**Hints.**
1. Keep a dict from window start to a counter (or a dict of user sets), and a min-heap of open window starts.
2. Only an event that raises the maximum event time can close windows; then pop from the heap while the smallest start's window end is at or below the watermark.
3. For the top k of a closing window, `heapq.nsmallest(k, items, key=lambda qc: (-qc[1], qc[0]))` is O(d log k) for d distinct queries.

**Follow-ups.**
1. The panel must show a provisional top 10 for the open window, updated on every event. How do you maintain it without re-sorting the window's counts each time?
2. A window has 50 million distinct queries. Replace the exact counter with a bounded-memory heavy-hitters structure (Misra–Gries or Count-Min with a heap). What error guarantee do you give the panel?
3. Events come from 2 000 partitions with their own watermarks. How do you combine them, and what does one idle partition do to every window?
4. Product wants to re-open a window when a large batch of late data arrives. What does that do to consumers of the published panel, and how would you version the output instead?

**Follow-up rules.**
- when: sorted, rescan, every open window, for start in → ask: How many open windows does your loop visit per event when lateness is 2 500 windows long?
- when: heapq, heap, priority queue → ask: Can the same window start be pushed onto your heap twice? What happens if it is?
- when: processing time, arrival time, wall clock → ask: The rule is defined on event time. What would a processing-time window publish for a phone that was offline for ten minutes?
- when: counter, most_common → ask: `Counter.most_common(k)` breaks ties by insertion order. Does that satisfy the tie-break this panel needs?
- when: set, distinct → ask: Distinct users per query per window needs a set per pair. How would you bound that memory with a sketch, and what does it cost in accuracy?

**Evaluation Criteria.** Correct event-time windows; watermark from the maximum event time, never moving back; drop rule at the exact boundary; late events opening new windows; windows closed through a heap rather than a scan; deterministic top-k with the tie-break; distinct users when required; a clear complexity argument; credible discussion of heavy hitters and multi-partition watermarks.

## GOO-L1-05: Autocomplete suggestions from a sharded query log

| | |
|---|---|
| **Template ID** | GOO-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and sorting / prefix indexes, top-k per key, text normalisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | GOO-L1-05.mjs |

**Business Scenario.** A search box suggests completions as people type. A nightly job builds the suggestion table from the day's query log, which is written by many servers: the same query appears in several shards, each with its own count. Policy removes some words from suggestions entirely. You are writing the function that turns the log into the suggestions for a batch of typed prefixes.

**Problem Statement.** Implement `suggest(entries, prefixes, k, blocked=None)`. `entries` is a list of `(query_text, searches)`; a query's total is the sum of `searches` over all its rows. {{text_rule}} {{blocked_rule}} For each string in `prefixes`, in order, return up to `k` suggestions: the queries that start with that prefix (`str.startswith`; the empty prefix matches every query), ordered by total searches descending, then alphabetically. Return a list with one list per prefix; a prefix nothing starts with gets `[]`.

**Constraints.** Up to 200 000 log rows, about 100 000 distinct queries, and 50 000 prefixes of up to 8 characters; `k ≤ 10`. Checking every query for every prefix is far too slow.

**Assumptions.** Hypothetical log, counts and blocked words. Real suggestion systems also weigh freshness, location and personal history; this exercise uses only counts.

**Clarifications.**
- Q: Is a query equal to the prefix a valid suggestion? | A: Yes. `startswith` is true for it.
- Q: Two queries have the same total. | A: Alphabetical order (Python string comparison) breaks the tie.
- Q: Can the same prefix appear twice in `prefixes`? | A: Yes. Answer it each time.
- Q: Do I sum counts before or after normalising? | A: Normalise first; variants of one query are one query.
- Q: What should a prefix that matches nothing return? | A: An empty list.

**Hints.**
1. Sum into a dict keyed by the normalised text first; everything after works on distinct queries.
2. Sort the distinct queries once by `(-total, query)`. Walking that order, each prefix's suggestions are simply the first k queries you meet that start with it.
3. Only the prefixes that were asked for need a list, and only their lengths are worth slicing: for each query, try `q[:n]` for each requested length n.

**Follow-ups.**
1. Suggestions must update every few minutes as news breaks. How do you combine yesterday's table with a stream of fresh counts without rebuilding it?
2. A trie with the top k stored at every node answers in O(length). What does it cost in memory for 100 million queries, and how would you shard it?
3. The privacy policy says a query may be suggested only if many distinct users searched it. How do you enforce that when counts come from shards, and why can't you add distinct-user counts across shards?
4. Users make typos. How would you still suggest "weather" to someone who typed "waeth", and what does that cost per keystroke?

**Follow-up rules.**
- when: startswith, scan, for q in → ask: How many startswith checks does your solution make for 50 000 prefixes over 100 000 queries?
- when: trie → ask: What do you store at each trie node, and how much memory is that for 100 000 queries with k = 10?
- when: bisect, sorted list, binary search → ask: Your range for a one-letter prefix holds thousands of queries. What does picking the top k from it cost per prefix, and how would you avoid paying it again for the same prefix?
- when: heapq, nlargest, nsmallest → ask: Which key gives you count descending and text ascending in one heap, and why does the tie-break matter here?
- when: in q, substring → ask: Blocking "dough" must keep "doughnut shop". How does your check avoid matching inside a word?

**Evaluation Criteria.** Sums across shards after normalising; correct ordering with the tie-break; empty and trailing-space prefixes handled; whole-word blocking (Very Hard); one ranked pass or an index rather than a scan per prefix; a clear complexity argument; credible discussion of freshness, trie memory and the distinct-user privacy floor.
