# OpenAI · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an AI model
provider. Every workload, number and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## OAI-L1-01: Metered tokens versus billed tokens

| | |
|---|---|
| **Template ID** | OAI-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / deduplication, full outer joins, reconciliation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | OAI-L1-01.mjs |

**Business Scenario.** An API platform meters every model request in tokens: prompt tokens in, completion tokens out. A nightly billing job writes one total per project per UTC day. Finance has found days where the billed total and the metered total disagree, and asks for a daily report of the project-days that drift by more than {{threshold}} tokens.

**Problem Statement.** Write one PostgreSQL query that returns `usage_date, project_id, metered_tokens, billed_tokens, diff` (where `diff = billed_tokens - metered_tokens`) for every project-day where `|diff| > {{threshold}}`, ordered by `usage_date, project_id`. Metered tokens are `prompt_tokens + completion_tokens` over requests with `status = 'ok'`, attributed to the UTC date of `event_ts`. {{retries}} {{gaps}}

**Constraints.** One SQL statement (CTEs allowed). Strictly greater than {{threshold}}: a drift of exactly {{threshold}} is not reported. The sample has {{events}} usage rows; production has billions per day.

**Assumptions.** Hypothetical schema and volumes. `event_ts` is when the request was served; `ingested_at` is when the usage record reached the warehouse.

**Clarifications.**
- Q: Which date does a request belong to? | A: The UTC date of event_ts, not of ingested_at.
- Q: Do errored requests count? | A: No. Only status = 'ok' is billable.
- Q: What if the same request appears twice? | A: Keep one row per request_id: the copy with the latest ingested_at.
- Q: What if a project-day exists only in billing, or only in usage? | A: Report it if the drift exceeds the threshold, treating the missing side as 0.
- Q: Is the threshold inclusive? | A: No. Report only when the absolute difference is strictly greater.

**Hints.**
1. Build the metered side first, in its own CTE, at the same grain as billing: one row per (usage_date, project_id).
2. Deduplicate before you aggregate. `DISTINCT ON (request_id) … ORDER BY request_id, ingested_at DESC` is one way.
3. A row that exists on only one side survives a FULL OUTER JOIN; use COALESCE on both keys and both totals.

**Follow-ups.**
1. Billing runs at 02:00 UTC, but usage can arrive up to 6 hours late. How do you make the report final, and how do you correct a day that was already billed?
2. At billions of rows a day, which physical design makes this query cheap: partitioning, clustering, or a pre-aggregated daily metered table? What keeps that table correct when late events land?
3. Some drift is legitimate: credits, free-tier allowances and batch discounts. How do you model them so reconciliation compares like with like?
4. Write the data-quality check you would run before finance sees the report, and say what it does when it fails.

**Follow-up rules.**
- when: inner join, join billing, left join → ask: What happens to a project that was billed but sent no usage that day, and to one that used tokens but has no billing line?
- when: distinct, row_number, dedup, latest → ask: Your deduplication keeps one row per request_id. What if two copies share the same ingested_at?
- when: ingested_at, ingest date → ask: Which timestamp decides the billing day, and what goes wrong if you pick the other one near midnight?
- when: group by, sum → ask: How would you prove to finance that every metered token is counted exactly once?

**Evaluation Criteria.** Deduplicates before aggregating; attributes by event time; ok-only; full outer join with zero-fill; strict threshold; deterministic ordering; can explain how to make the report final under late data.

## OAI-L1-02: Hourly p95 latency regressions by model family

| | |
|---|---|
| **Template ID** | OAI-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / ordered-set aggregates, hour grids, LAG |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | OAI-L1-02.mjs |

**Business Scenario.** An inference API serves several model families. The on-call dashboard shows, for every family and every hour, the traffic, the error rate and the p95 latency of successful requests, and it flags an hour whose p95 rose more than {{pct}}% over the hour before. You are writing the query behind that panel for the report window {{start}} to {{end}}.

**Problem Statement.** Write one PostgreSQL query that returns `hour_start, model_family, requests, error_rate, p95_ms, prev_p95_ms, regressed`: one row for every family in `model_families` and every hour from {{start}} to {{end}} inclusive ({{hours}} hours), ordered by `hour_start, model_family`. An event belongs to the UTC hour `date_trunc('hour', event_ts)`. `requests` counts every request in the hour; `error_rate` is the share whose `status` is not `'ok'` (NULL when there were no requests). `p95_ms` is `percentile_cont(0.95)` of `latency_ms` over `status = 'ok'` requests only (NULL when there were none). `prev_p95_ms` is the same family's `p95_ms` for the immediately preceding clock hour. `regressed` is true when both are present and `p95_ms > prev_p95_ms * (1 + {{pct}} / 100.0)`, otherwise false. {{gaps}} {{baseline}}

**Constraints.** One SQL statement (CTEs allowed). The threshold is strict: a rise of exactly {{pct}}% is not a regression. `regressed` is never NULL. The sample has {{events}} events; assume billions per day in production.

**Assumptions.** Hypothetical families, latencies and volumes. `latency_ms` is the server-side duration of a request; for a timeout it is the timeout limit, not a serving time.

**Clarifications.**
- Q: Do failed requests count in the p95? | A: No. The p95 is over status = 'ok' only. Failed requests count in requests and error_rate.
- Q: Which statuses are failures? | A: Every status other than 'ok': here 'error' and 'timeout'.
- Q: Which percentile? | A: percentile_cont, which interpolates linearly between the two values either side of the 95th percentile. Not percentile_disc.
- Q: What is "the previous hour" if the family had no traffic then? | A: It is always the immediately preceding clock hour. If that hour has no p95, there is nothing to compare with and the row is not a regression.
- Q: Where does an event at exactly 10:00:00 belong? | A: To the 10:00 hour.
- Q: Is a rise of exactly {{pct}}% a regression? | A: No. Only strictly more.

**Hints.**
1. Aggregate per (hour, family) first: `COUNT(*)`, `COUNT(*) FILTER (WHERE status <> 'ok')`, and `percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status = 'ok')`.
2. LAG means "previous hour" only if every hour has a row. Build the grid with `generate_series(...)` × `model_families`, LEFT JOIN the hourly stats onto it, then apply LAG.
3. Restrict to the report window after LAG has run, not before.

**Follow-ups.**
1. The panel now needs p99 as well, broken down by region. What changes in the query, and why does an exact percentile get expensive at billions of rows per hour?
2. Raw latencies are kept for 7 days. How do you store hourly latency so that a daily or weekly p95 can still be computed later, and why is the average of 24 hourly p95s not the daily p95?
3. One hour with six requests fires an alert. How would you make the regression rule robust without hiding real regressions?
4. The panel must refresh every minute while events arrive up to 10 minutes late. How do you compute it incrementally, and when is an hour final?

**Follow-up rules.**
- when: percentile_disc, disc → ask: percentile_disc and percentile_cont differ most on small samples. Which would you alert on, and what does each return for 12 requests?
- when: avg, average of, mean → ask: Can you average hourly p95s to get a daily p95? If not, what would you store instead so the daily figure stays exact or bounded?
- when: lag, lead → ask: What does your LAG return for the hour right after an hour with no traffic, and how do you know the row it read is the previous clock hour?
- when: where status, status = 'ok' → ask: If failed requests are removed in WHERE, what happens to error_rate, and to an hour in which every request failed?
- when: generate_series, grid, cross join → ask: The grid is families × hours. How does that scale to 500 families in per-minute buckets over 30 days, and what would you do instead?

**Evaluation Criteria.** p95 over successful requests with percentile_cont; error_rate over all requests; a complete hour grid; LAG over the grid so "previous" means the previous clock hour, including the baseline before the window; strict, NULL-safe `regressed`; deterministic order; can explain why percentiles are not additive and how to alert robustly.

## OAI-L1-03: First context-window overflow per conversation session

| | |
|---|---|
| **Template ID** | OAI-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps and islands, running sums, window frames |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer, software-engineer |
| **Generator** | OAI-L1-03.mjs |

**Business Scenario.** A chat product sends the whole session history back to the model on every turn, so the context grows turn by turn. After a spell of inactivity the client starts a fresh session with an empty history. Before tuning truncation and summarisation, the team wants to know where sessions first outgrow their model's context window.

**Problem Statement.** Write one PostgreSQL query that returns, for every session whose context ever exceeds its model's window, the first message where it does: `conversation_id, session_no, turn_no, message_id, context_tokens, context_window`, ordered by `conversation_id, session_no`. Within a conversation, messages are ordered by `sent_at, message_id`. A conversation's first message starts session 1; a message that arrives more than {{gap}} minutes after the previous message of the same conversation starts the next session. `turn_no` is the message's 1-based position in its session. `context_tokens` is the conversation's `system_tokens` plus the running total of `tokens` over the session's messages up to and including this one. `context_window` comes from the conversation's model. {{models_rule}} {{ties_rule}} {{system_rule}}

**Constraints.** One SQL statement (CTEs allowed). A gap of exactly {{gap}} minutes continues the session. A context exactly equal to the window still fits: report only `context_tokens > context_window`. One row per overflowing session. The sample has {{messages}} messages.

**Assumptions.** Hypothetical models and context windows; they are not any real model's limits. `tokens` is the message's metered token count. A real client would also reserve room for the reply being generated; this exercise ignores that.

**Clarifications.**
- Q: Does a gap of exactly {{gap}} minutes start a new session? | A: No. Only a gap of strictly more than {{gap}} minutes does.
- Q: What if two messages in a conversation have the same sent_at? | A: The lower message_id came first. Your ordering must be fully deterministic.
- Q: Does a context equal to the window overflow? | A: No. Strictly greater only.
- Q: Does a new session carry tokens over from the previous one? | A: No. Every session starts from system_tokens alone.
- Q: Should I report every message after the overflow? | A: No. Only the first overflowing message of each session; sessions that never overflow are not reported.

**Hints.**
1. This is gaps and islands: `LAG(sent_at)` per conversation, a 1 where the gap is more than the limit (or there is no previous message), and a running SUM of those flags is `session_no`.
2. The running total needs an explicit frame: `SUM(tokens) OVER (PARTITION BY conversation_id, session_no ORDER BY sent_at, message_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`. The default frame is RANGE, which treats rows with equal ORDER BY values as one.
3. Filter to overflowing rows, then keep the first per session with `DISTINCT ON` or `ROW_NUMBER()`.

**Follow-ups.**
1. Product changes the policy: instead of a new session, the client drops the oldest messages until the context fits. Describe how you would compute the context at every turn now, and why a single running sum no longer expresses it.
2. At billions of messages, how do you assign `session_no` incrementally as messages arrive, and what happens when a late message lands inside a gap and joins two sessions into one?
3. Report the median and p90 number of turns before overflow, per model. What bias do you introduce by looking only at sessions that overflowed, and how would you correct for it?
4. A conversation switches model mid-session, and the two models count tokens differently. How do you change the schema and the query?

**Follow-up rules.**
- when: range, default frame, order by sent_at → ask: Two messages share a sent_at. What does your running SUM return for the first of them, and why?
- when: rows between, rows unbounded → ask: Why ROWS rather than RANGE here? Construct the input on which they differ.
- when: lag, gaps and islands, islands → ask: A late message arrives in the middle of a three-hour gap and closes it. Which session numbers change, and how would an incremental pipeline repair them?
- when: >=, at least → ask: A session reaches exactly the window. Does it overflow? Point to the line of your query that decides it.
- when: distinct on, row_number, first → ask: How do you guarantee the "first" overflowing message is unique when timestamps tie?

**Evaluation Criteria.** Correct sessionisation per conversation with a strict gap; deterministic order with the message_id tie-break; an explicit ROWS frame; totals reset per session and start from the system prompt; strict overflow test; one row per overflowing session; can discuss a truncation policy and incremental sessionisation.

## OAI-L1-04: Sliding-window token rate limiter

| | |
|---|---|
| **Template ID** | OAI-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sliding window / deques and hash maps |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | OAI-L1-04.mjs |

**Business Scenario.** An API gateway enforces usage limits per project over a sliding 60-second window. Limits are measured in tokens per minute (TPM) and, for some plans, requests per minute (RPM), the same two dimensions public model APIs document. You are writing the admission decision for a replay of the gateway log.

**Problem Statement.** Implement `admit(requests, tpm, rpm=None)`. `requests` is a list of `(ts_ms, project_id, tokens)` sorted by `ts_ms`. Return one boolean per request. A request is admitted when the tokens of the project's **admitted** requests in the window `(ts_ms − 60000, ts_ms]`, plus its own tokens, stay within `tpm[project_id]`. {{limit_rule}} {{rpm_rule}} A rejected request consumes nothing.

**Constraints.** Up to 200 000 requests; 1 ≤ tokens ≤ 10⁶; timestamps are non-decreasing integers. Amortised O(1) work per request is expected.

**Assumptions.** Hypothetical limits and traffic. The window is half-open: a request exactly 60 000 ms older has left it.

**Clarifications.**
- Q: Is the window inclusive of a request exactly 60 seconds older? | A: No. The window is (ts − 60000, ts]; a request exactly 60 000 ms older has left it.
- Q: Do rejected requests count toward the limit? | A: No. Only admitted requests consume capacity.
- Q: What about a project with no configured limit? | A: Reject it.
- Q: Can several requests share a timestamp? | A: Yes. Process them in list order.

**Hints.**
1. Keep, per project, a queue of the admitted requests still inside the window and a running token total.
2. Before deciding on a request, drop from the front of that project's queue everything at or before ts − 60000.
3. Each request is pushed once and popped at most once, which is where amortised O(1) comes from.

**Follow-ups.**
1. The gateway now runs on 40 machines. How do you enforce one project-wide limit without a central lock on every request?
2. A fixed-window counter is much cheaper than a sliding log. What does it get wrong at window boundaries, and how much over the limit can a client get?
3. Tokens are only known after the response is generated. How do you admit a request before you know its true cost, and how do you reconcile afterwards?
4. Memory is per project per window. What happens with 2 million active projects, and how would you bound it?

**Follow-up rules.**
- when: redis, central, shared store, database → ask: Every request now makes a network round trip to that store. What is your p99 overhead, and what does the gateway do when the store is slow or down?
- when: fixed window, bucket, per minute counter → ask: Show a request pattern that exceeds the limit by nearly 2× under your fixed window.
- when: token bucket, leaky bucket → ask: How does a token bucket's behaviour differ from the sliding window this question specifies, and when is that difference acceptable?
- when: list, scan, loop over window → ask: What is the time complexity per request when 10 000 requests sit in the window?

**Evaluation Criteria.** Correct half-open window; rejected requests do not consume; per-project state; amortised O(1) with a justification; handles unknown projects and simultaneous timestamps; discusses distributed enforcement honestly.

## OAI-L1-05: Global p95 per window from regional latency streams

| | |
|---|---|
| **Template ID** | OAI-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / k-way merge of sorted streams, order statistics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | OAI-L1-05.mjs |

**Business Scenario.** Each serving region of an inference API writes its own request log, sorted by time. The observability service builds a global latency view by merging those regional streams and reporting the p95 per time window. The streams are long-lived: a report on a few minutes must not read a day of data.

**Problem Statement.** Implement `window_p95(logs, t0, width, n_windows, step=None, min_count=1)`. `logs` holds K iterables, one per region, each yielding `(ts_ms, latency_ms)` sorted by `ts_ms`. Return a list of `n_windows` values: for each window, the nearest-rank p95 of the latencies of every region's events in it: sort them ascending and take the value at 1-based rank ⌈0.95·n⌉. {{window_rule}} {{count_rule}} Read the logs lazily: a log can be far longer than the report period, so consume each one only as far as the report needs.

**Constraints.** Up to 64 regions and 2 000 000 events per log, of which the report period covers a small fraction. Merging the M events the report needs should cost O(M log K); memory O(K + M).

**Assumptions.** Hypothetical regions, rates and latencies. Region clocks are treated as synchronised. Events before t0 or at or after the end of the last window are ignored.

**Clarifications.**
- Q: Are window boundaries inclusive? | A: A window is [start, start + width): the start is in, the end is out.
- Q: Which p95 definition? | A: Nearest rank: the ⌈0.95·n⌉-th smallest value, a latency that actually occurred. No interpolation. For n = 20 that is the 19th value.
- Q: Two regions have an event at the same timestamp. | A: Both count. Their relative order does not matter.
- Q: Can I call list() on a log? | A: On the samples, yes. The timing test passes streams about 80 times longer than the report, so reading them to the end will not finish in time.
- Q: Can a window be empty? | A: Yes. It reports None.

**Hints.**
1. Keep a min-heap holding the next event of each region. Pop the smallest, then push that region's next event: that is the global time order, one event at a time.
2. Every log is sorted, so once the smallest timestamp in the heap is at or past the end of the last window, nothing that is left can fall inside it. Stop there.
3. Map each event to its window(s) arithmetically and collect latencies per window in a dict or list; select the rank-th value per window at the end.

**Follow-ups.**
1. One region's collector runs 30 seconds behind. When can you safely emit window i, and what do you do with an event that arrives after you have emitted its window?
2. Per-window memory is O(events). Replace the exact p95 with a mergeable sketch. What error guarantee do you get, and why can per-region sketches be merged when per-region p95 values cannot?
3. K becomes 5 000 streams (one per host). What does each event cost now, and when would batching or a different structure beat a binary heap?
4. The panel wants a p95 over the last 60 seconds, updated on every event. Design it with two heaps and lazy deletion, and give its complexity.

**Follow-up rules.**
- when: sorted(, list(, concatenate, sort all → ask: Your solution reads every log to the end. What happens when each log is an unbounded live stream?
- when: heapq.merge, merge → ask: heapq.merge is lazy. Where does your loop stop reading, and what does each event cost?
- when: per region p95, average, mean → ask: Can you combine per-region p95 values into a global p95? Give a counterexample.
- when: interpolat, percentile_cont, numpy.percentile → ask: This spec uses nearest rank. When would you prefer interpolation, and what does each give for 20 samples?

**Evaluation Criteria.** Lazy k-way merge with a heap and a correct stop condition; half-open windows; nearest-rank arithmetic in integers; empty windows and `min_count`; correct window assignment for hopping windows; a clear complexity argument; a credible discussion of watermarks and mergeable sketches.
