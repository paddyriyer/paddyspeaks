# Anthropic · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a frontier AI
model provider: the Messages API and its usage reporting, prompt caching,
streamed responses, the Message Batches API, tool use, and workspaces that group
API keys. Every workload, price, number and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## ANT-L1-01: Prompt caching that costs more than it saves

| | |
|---|---|
| **Template ID** | ANT-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / conditional cost arithmetic, grouping through a lookup, numeric rounding |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | ANT-L1-01.mjs |

**Business Scenario.** API customers can mark the stable start of a prompt (a long system prompt, a contract, a codebase) for caching. Public documentation describes the billing shape: writing a prefix to the cache costs more than ordinary input tokens, and reading it back costs much less, with a longer cache duration priced higher than the default one. Each response reports its usage split into ordinary input tokens, cache-write tokens, cache-read tokens and output tokens. A platform team keeps a warehouse copy of that usage and wants to know, per workspace and model, whether caching is saving money or quietly costing more: a prefix that is written again and again but never read back is pure overhead.

**Problem Statement.** Write one PostgreSQL query over the UTC day `{{day}}` that returns one row per `(workspace_id, model)` with at least {{min_requests}} requests that day: `workspace_id` (the API key's workspace), `model`, `requests`, `prompt_tokens` (input + 5-minute writes + 1-hour writes + cache reads), `cache_read_share = ROUND(cache reads / prompt_tokens, 4)`, `actual_cost_usd`, `uncached_cost_usd` and `net_savings_usd = uncached − actual`. Prices are in US dollars per million tokens. In this exercise a 5-minute cache write costs 1.25 × the model's input price, a 1-hour cache write 2 ×, a cache read 0.1 ×; output tokens cost the output price. The uncached cost bills every prompt token at the input price, plus the same output cost. Round the three money columns to 4 decimal places, computing `net_savings_usd` from the unrounded costs. Order by `net_savings_usd`, then `workspace_id`, then `model`. {{write_rule}} {{workspace_rule}}

**Constraints.** One SQL statement (CTEs allowed). Do every calculation in `numeric`; never in floating point and never with integer division. The day is half-open: `[{{day}} 00:00, next day 00:00)` UTC. The sample has {{n_requests}} usage rows; production has hundreds of millions per day.

**Assumptions.** Hypothetical prices, models, workspaces and usage. The multipliers are this exercise's and follow the shape described in public pricing pages; real prices change, so check current documentation. The warehouse table stores the usage block of each response in its own columns, one row per request. Output tokens are the same with or without caching, so they cancel out of the savings.

**Clarifications.**
- Q: Which workspace does a request belong to? | A: The workspace of the API key that sent it, from `api_keys`. A workspace can have several keys.
- Q: Is a cache read free? | A: No. In this exercise it costs 0.1 × the input price; it is cheap, not free.
- Q: What is the "uncached" cost of a cache read token? | A: The full input price: without caching, that token would have been sent as ordinary input.
- Q: Is the minimum inclusive? | A: Yes. A group with exactly {{min_requests}} requests is reported.
- Q: Can net savings be negative? | A: Yes, and those rows are the point of the report: they sort first.

**Hints.**
1. Aggregate tokens per `(workspace, model)` first, then join the price once per group; prices are per model, so the cost is a linear function of the sums.
2. The uncached cost is `(input + writes + reads) × input price + output × output price`; the actual cost weights each class by its multiplier.
3. Cast before dividing for the share: `reads::numeric / prompt_tokens`.

**Follow-ups.**
1. Finance asks for the same report monthly per workspace across all models. What changes, and which columns can you no longer add up from the daily rows?
2. A workspace shows a large negative saving. List three causes you could tell apart from this table alone, and the query that tells them apart.
3. The longer cache duration costs more to write. Using this data, how would you estimate, per workspace, whether it would pay for itself?
4. Usage arrives late and is occasionally restated. How would you build this as an incremental daily table that stays correct?

**Follow-up rules.**
- when: join api_keys, inner join, group by api_key → ask: A workspace has two keys, and some keys belong to no named workspace. Which rows does your join and grouping produce for them?
- when: float, double, real, ::float → ask: Why does floating point matter for a money column rounded to 4 places, and where in your query could it change a result?
- when: created_at::date, date(created_at), between → ask: Which rows at exactly midnight does your day filter include, and on which day do they belong?
- when: 0.1, 1.25, multiplier → ask: Cache pricing differs by duration and changes over time. Where would you keep these multipliers so a price change does not mean rewriting the query?

**Evaluation Criteria.** Attributes requests through the key's workspace; aggregates before pricing; correct per-class multipliers including the longer duration; uncached cost bills all prompt tokens at the input price; numeric arithmetic with the stated rounding; half-open day; inclusive minimum; deterministic ordering with negative savings first; explains what the result means for a customer.

## ANT-L1-02: Streams that stalled after the first token

| | |
|---|---|
| **Template ID** | ANT-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Window functions / LAG over a filtered event stream, per-request outcomes, NULL-aware filters |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, ai-infra-engineer |
| **Generator** | ANT-L1-02.mjs |

**Business Scenario.** When a client asks for a streamed response, the API sends server-sent events: `message_start`, then for each content block a `content_block_start`, a series of `content_block_delta` events carrying the text, and a `content_block_stop`, then `message_delta` and `message_stop`. Public documentation also describes `ping` events, which can arrive at any time and carry no content, and `error` events. A streaming-observability team logs every event a sampled client receives and wants two numbers per stream: the time to the first token, and the longest silence between two pieces of text, because a stream that starts quickly and then stalls for seconds feels broken to users.

**Problem Statement.** Write one PostgreSQL query that returns one row for every request that is a problem: `request_id`, `model`, `ttft_ms` (milliseconds from `started_at` to the first `content_block_delta`; NULL if there is none), `max_gap_ms` (the largest gap in milliseconds between two consecutive `content_block_delta` events of the request, in `seq` order; NULL with fewer than two), `deltas` (the number of `content_block_delta` events) and `outcome`: `'completed'` if the stream has a `message_stop`, otherwise `'error'` if it has an `error` event, otherwise `'truncated'`. A request is a problem if its outcome is not `'completed'`, or `ttft_ms > {{ttft_ms}}`, or `max_gap_ms > {{gap_ms}}`. Return both durations as whole milliseconds (`bigint`). Order by `request_id`. {{edge_rule}}

**Constraints.** One SQL statement (CTEs allowed). `seq` orders the events of one request; `event_ts` never decreases along `seq`. Thresholds are strict. The sample has {{n_requests}} requests and {{n_events}} events; production samples millions of streams a day.

**Assumptions.** Hypothetical models, timings and thresholds. Event names follow the public streaming documentation; the table is a client-side log of what was received, one row per event. Every request is complete in the log: nothing more will arrive.

**Clarifications.**
- Q: Does a ping count as progress? | A: No. A ping carries no content; a stall with pings in it is still a stall. Only `content_block_delta` events count.
- Q: When does the TTFT clock start? | A: At `started_at`, when the client sent the request, not at `message_start`.
- Q: Two events have the same `event_ts`. Which is first? | A: The one with the lower `seq`. Their gap is 0.
- Q: A stream has one delta and then completes. Is its gap 0? | A: No, it has no gap: `max_gap_ms` is NULL, and NULL is not over the threshold.
- Q: A request never received any event. Is it in the result? | A: Yes: it has no `message_stop` and no `error`, so it is `'truncated'`.

**Hints.**
1. Filter to `content_block_delta` first, then `LAG(event_ts) OVER (PARTITION BY request_id ORDER BY seq)`. LAG over all events lets a ping split a silence.
2. `EXTRACT(EPOCH FROM interval) * 1000` gives milliseconds; cast to `bigint`.
3. Start from `stream_requests` and LEFT JOIN the per-request aggregates, so requests without deltas or without events survive.

**Follow-ups.**
1. The same report every minute over a live stream of events. What state do you keep per open request, and when can you emit a row?
2. Product wants a p50 and p99 TTFT per model per hour on a dashboard. Why can you not average hourly percentiles into a daily one, and what would you store instead?
3. A long stall appears only for very long outputs. How would you separate model generation time from network or client problems using only this log?
4. The log is sampled at 1% of streams. Which of your metrics stay unbiased, and which need care?

**Follow-up rules.**
- when: lag(, over (partition → ask: Did you filter to deltas before or after the window function? Walk me through a 9-second silence with pings every second.
- when: message_start → ask: Why measure from `started_at` rather than `message_start`, and what would the difference hide?
- when: inner join, join stream_events → ask: A request that never received a single event: where is it in your result?
- when: order by event_ts, event_ts) → ask: Two deltas share a millisecond. Is your LAG order deterministic, and does it matter for the gap?

**Evaluation Criteria.** TTFT from `started_at` to the first delta; gaps from LAG over deltas only, in `seq` order; NULL-aware handling of streams with zero or one delta; correct three-way outcome; requests without events kept; strict thresholds; integer milliseconds; deterministic ordering; can explain why pings must not count as progress.

## ANT-L1-03: Message batch reconciliation across resubmissions

| | |
|---|---|
| **Template ID** | ANT-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Joins and windows / latest attempt per item, anti-joins for missing results, first-of-many with tie-breaks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer |
| **Generator** | ANT-L1-03.mjs |

**Business Scenario.** The Message Batches API processes many requests asynchronously. Each request in a batch carries a `custom_id`, unique within that batch, and once the batch has ended each request has one result whose type is `succeeded`, `errored`, `canceled` or `expired` (public documentation says requests not processed within 24 hours expire). A customer's nightly job submits its items as one batch, then resubmits the items that did not succeed in later batches. Their data team needs to know, per job, where every item stands, and whether a client bug is paying for the same item twice.

**Problem Statement.** Write one PostgreSQL query that returns one row per `job_id`: `items` (distinct `custom_id`s submitted by the job's batches), and a classification of each item into exactly one of `succeeded` (it has a `succeeded` result in any of the job's batches), `retry` (no success; its latest attempt has a result), `missing` (no success; its latest attempt is in an ended batch but has no result row) or `in_flight` (no success; its latest attempt is in a batch that has not ended). Also `duplicate_successes` (items with more than one `succeeded` result) and `wasted_output_tokens` (the output tokens of every success after an item's first). An item's attempts are ordered by the batch's `created_at`, then `batch_id`. Order by `job_id`. {{status_rule}}

**Constraints.** One SQL statement (CTEs allowed). An item is identified by `(job_id, custom_id)`. `items = succeeded + retry + missing + in_flight` for every job. The sample has {{n_batches}} batches and {{n_requests}} batch requests.

**Assumptions.** Hypothetical jobs, ids and token counts. Batch statuses and result types follow the public documentation, simplified to `in_progress` and `ended`. Results exist only for ended batches. In this exercise every success is billed, so a second success for the same item is wasted spend.

**Clarifications.**
- Q: An item succeeded, was resubmitted by mistake, and the resubmission errored. What is it? | A: Succeeded. Once an item has a success, it has its answer.
- Q: Two batches of the same job were created in the same second. Which is later? | A: The one with the greater `batch_id`. The result must be deterministic.
- Q: Is an item whose latest batch is still in progress missing? | A: No. Results do not exist until a batch has ended, so it is in flight.
- Q: Which success is "first" for wasted tokens? | A: The earliest by `created_at`, then `batch_id`. Every later success is wasted.

**Hints.**
1. Build one row per attempt: `batch_requests` joined to `batches`, LEFT JOIN `batch_results`. An inner join to results loses exactly the items you are asked to find.
2. `ROW_NUMBER() OVER (PARTITION BY job_id, custom_id ORDER BY created_at DESC, batch_id DESC) = 1` is the latest attempt; the same window ascending over successes numbers them.
3. Reduce to one row per item, then count with `FILTER` per job.

**Follow-ups.**
1. Jobs submit millions of items a night. How would you make this report incremental, touching only batches that ended since the last run?
2. How should the client choose what to resubmit, so that a duplicate success cannot happen? What does the batch result give you to make the resubmission idempotent?
3. A batch has ended, and 0.1% of its requests have no result in your warehouse. How do you tell an export problem from an API problem, and what alert would you add?
4. Expired results cluster at certain hours. What would you look at before deciding to split jobs into smaller batches?

**Follow-up rules.**
- when: inner join batch_results, join batch_results → ask: An item in an ended batch with no result row: where does it appear in your result?
- when: max(created_at), latest → ask: An item succeeded in its first batch and failed in its second. What does "latest attempt" say about it, and what should the report say?
- when: count(*), count(custom_id) → ask: An item submitted in three batches: how many items does your count give for it?
- when: order by created_at), created_at desc) → ask: Two batches of one job share a `created_at`. Which success is first in your query, and is that the same on every run?

**Evaluation Criteria.** One row per attempt with a LEFT JOIN to results; latest attempt with a full tie-break; succeeded wins over a later failure; missing and in-flight separated by batch status; distinct items per job; first success by the same ordering; categories that add up to `items`; deterministic ordering; can discuss idempotent resubmission.

## ANT-L1-04: Tool-use calls: outcomes per tool and peak calls in flight

| | |
|---|---|
| **Template ID** | ANT-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and sweep lines / matching events by id, interval overlap |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer |
| **Generator** | ANT-L1-04.mjs |

**Business Scenario.** With tool use, the model replies with a `tool_use` block that has an id, a tool name and an input; the application runs the tool and sends back a `tool_result` block that refers to that id, optionally marked `is_error`. An agent platform logs both sides of every call and wants a dashboard per tool (how many calls succeeded, errored or timed out) and one capacity number: the most tool calls that were ever in flight at the same moment, which sizes the pool of workers that execute them.

**Problem Statement.** Implement `tool_call_stats(events, timeout_ms)`. `events` is a list of `(ts_ms, conversation_id, kind, tool_use_id, tool_name, is_error)` sorted by `ts_ms` (ties in list order), with `kind` `'use'` or `'result'`. A `use` starts a call. A `result` finishes the call it refers to: if it arrives at most `timeout_ms` after the use, the call is `ok` (or an error if `is_error`); if it arrives later, the call counts as timed out and the result is ignored. A call that never gets a result timed out. A call is in flight over the half-open interval `[use_ts, end)`, where `end` is its result's time if it finished in time and `use_ts + timeout_ms` if it timed out. Return `(per_tool, unmatched_results, peak_in_flight)`: `per_tool[tool_name] = [calls, ok, errors, timed_out]` for every tool with at least one call, the number of results that refer to no earlier use, and the largest number of calls in flight at any instant (0 if none). Only a call's first result counts; a later one for the same call is ignored. {{dup_rule}} {{key_rule}} In the tests, `timeout_ms = {{timeout_ms}}`.

**Constraints.** Up to about 220 000 events and hundreds of calls in flight at once. Expected: O(n log n) time and O(n) memory.

**Assumptions.** Hypothetical tools, timeouts and traffic. The log is complete: every result that will ever arrive is in it.

**Clarifications.**
- Q: Is a result exactly `timeout_ms` after the use on time? | A: Yes. Only strictly later is a timeout.
- Q: Does a late result count as unmatched? | A: No. It matches its call, which is already timed out; the result is ignored.
- Q: A call ends at the same millisecond another starts. Do they overlap? | A: No. Intervals are half-open, so the first is no longer in flight.
- Q: A result and its use have the same timestamp. Is the call ever in flight? | A: No. Its interval is empty.
- Q: The same `use` appears twice. Two calls? | A: No. A `use` whose call already exists is ignored.

**Hints.**
1. A dict keyed by `(conversation_id, tool_use_id)` matches results to uses in O(1).
2. Once every call's interval is known, turn each into a +1 at its start and a −1 at its end, sort, and sweep. At equal times the −1 must come first.
3. Calls that never get a result also need intervals: `[use_ts, use_ts + timeout_ms)`.

**Follow-ups.**
1. Compute the peak on a live stream instead, without waiting for the log to be complete. What do you keep in memory, and when is a call's end known?
2. The worker pool is shared by 40 tools with different latencies. How would you report the peak per tool and the peak overall in one pass?
3. Telemetry from two collectors disagrees by up to 200 ms. Which of your numbers change, and how would you make them robust?
4. Results for unknown ids keep growing. What could cause them, and how would you find out which?

**Follow-up rules.**
- when: for each result, scan back, search the list → ask: How many events does your matching look at per result when 500 calls are in flight?
- when: sort, sweep, +1, -1 → ask: Two events at the same millisecond, one ending a call and one starting another. Which comes first in your sort, and why?
- when: heap, heapq → ask: When you push a call into the heap, do you already know when it ends? What do you do about results that arrive after the timeout?
- when: dict, defaultdict, (conversation_id → ask: What does your dict hold after a call finishes, and how large does it grow in a week of traffic?

**Evaluation Criteria.** Correct matching with duplicate uses and results ignored; inclusive timeout boundary; late results become timeouts and are not unmatched; unmatched counted only for results with no earlier use; half-open intervals with ends before starts at equal times; O(n log n) with a justification; discusses streaming and bounded state.

## ANT-L1-05: Prompt-cache replay: reads, writes and uncached input

| | |
|---|---|
| **Template ID** | ANT-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Tries and hash maps / longest live prefix with expiry, linear work per prompt |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer |
| **Generator** | ANT-L1-05.mjs |

**Business Scenario.** Prompt caching stores a prompt's prefix so a later request that starts with exactly the same content can read it instead of processing it again. Public documentation describes the behaviour this exercise simplifies: a cached prefix lives for a few minutes by default (a longer duration is available), using it refreshes its lifetime, prefixes below a minimum length are not cached, and a request that misses writes the prefix. Before a customer turns caching on for a long-running chat assistant, an analyst wants to replay last week's prompts through a model of the cache and see how many tokens would have been read, written and sent as ordinary input.

**Problem Statement.** Implement `cache_accounting(requests, min_tokens=0)`. Each request is `(ts_s, workspace_id, segments, ttl_s)` with `segments` a non-empty list of `(segment_id, tokens)`; requests are sorted by `ts_s` and processed in list order. The prompt is the concatenation of its segments. Prefix k is segments 0..k; only prefixes ending before the last segment can be cached (the last segment is the new turn and is always ordinary input). A prefix is cacheable if its cumulative tokens are at least `min_tokens`. A cache entry is identified by the workspace and the exact sequence of segment ids, and is live while `ts < expires_at`. For each request: the hit is its longest cacheable prefix with a live entry; `cache_read` is the hit prefix's tokens (0 if none); `cache_write` is the tokens of its longest cacheable prefix minus `cache_read` (0 if there is nothing beyond the hit); everything else is `uncached_input`. Then every cacheable prefix of the request is stored or refreshed with `expires_at = ts + ttl_s`. Return one `(cache_read, cache_write, uncached_input)` per request. {{min_rule}} {{ws_rule}} {{ttl_rule}}

**Constraints.** Up to a few thousand requests whose prompts have up to about 1 200 segments each (long conversations); about two million segments in total. Expected: work proportional to the number of segments in each prompt, not to its square.

**Assumptions.** A deliberately simplified, hypothetical cache model: every segment boundary acts as a breakpoint (the real API limits how many you can mark), there is no eviction other than expiry, and the cache is scoped to a workspace. TTLs, the minimum and the traffic are hypothetical.

**Clarifications.**
- Q: Does a hit refresh the entry? | A: Yes. Every cacheable prefix of the request, hit or written, is refreshed to `ts + ttl_s` (the TTL rule above says what happens when requests use different TTLs).
- Q: Is an entry live at exactly `expires_at`? | A: No. It is live while `ts < expires_at`; at exactly 300 seconds after a 300-second write it has expired.
- Q: Is the minimum about one segment or the whole prefix? | A: The whole prefix: its cumulative tokens from segment 0.
- Q: Two requests in different workspaces send the same segments. Do they share an entry? | A: Not in this exercise: entries are per workspace.
- Q: A request repeats the previous prompt exactly. What is read? | A: Everything except the last segment, which is never cached.

**Hints.**
1. Build the key for prefix k from the key for prefix k − 1 in O(1): a trie of segment ids per workspace, where each node stores its expiry, or an integer id per (parent id, segment id) pair.
2. Walk the prompt once from the start: track the cumulative tokens, the deepest cacheable node with a live entry, and the deepest cacheable node; then refresh the cacheable nodes you passed.
3. `tuple(ids[:k + 1])` as a key costs O(k) to build and to hash, for every k: that is quadratic per prompt.

**Follow-ups.**
1. The replay says caching would save 70% of input tokens. Which simplifications in this model make that number optimistic?
2. The real API lets you mark only a few breakpoints. Given this trace, how would you choose where to put them for one conversation?
3. Memory: the trie keeps every prefix ever seen. How would you prune it without changing any answer?
4. Price the replay with the longer cache duration on some requests. How would you decide, per conversation, which duration pays for itself?

**Follow-up rules.**
- when: tuple(, join(, ids[: → ask: What does building and hashing that key cost for a prompt with 1 000 segments, and how many times do you do it per request?
- when: trie, children, node → ask: Your trie never deletes nodes. How large is it after a week, and what could you remove safely?
- when: hash(, rolling hash, fingerprint → ask: What happens if two different prefixes collide, and how would you detect or bound that?
- when: expires, expiry, ttl → ask: A 1-hour entry is hit by a request with a 5-minute TTL. What must happen to its expiry, and why?

**Evaluation Criteria.** Correct longest live cacheable prefix; strict expiry; reads and writes as defined, with the last segment never cached; refresh of every cacheable prefix; workspace isolation; cumulative minimum; at the Very Hard level, expiry never shortened; linear work per prompt with a clear argument; honest discussion of what the simplified model over- or under-states.
