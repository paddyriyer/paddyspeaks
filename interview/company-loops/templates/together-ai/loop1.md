# Together AI · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a cloud for open
models: fine-tuning jobs on datasets a customer uploads (LoRA or full fine-tunes,
checkpoints, job states), dedicated endpoints billed per minute for each running
replica, several LoRA adapters sharing one dedicated endpoint, serverless inference
across many open models, and an open-model catalogue with versions. Every price,
capacity, limit, volume and schema is hypothetical and "this exercise's rule; check
current docs"; nothing here describes a real customer, internal system, hardware or
capacity. Customer data appears only as counts, lengths and formats, never content.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TGA-L1-01: Fine-tuning job outcomes per base model and method — retries counted once, cancellations shown apart

| | |
|---|---|
| **Template ID** | TGA-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / latest attempt per retry chain (DISTINCT ON), terminal state per job, LEAD over state events, percentile_cont with FILTER |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | TGA-L1-01.mjs |

**Business Scenario.** Customers of a cloud for open models start fine-tuning jobs on a dataset they uploaded, choosing a base model and a method: LoRA (a small adapter trained on top of the frozen base model) or a full fine-tune. A job first validates the dataset's format, then waits in a queue, then trains. When a job fails, the customer often fixes the problem and retries it. The fine-tuning team reviews outcomes per base model and method to see where jobs fail: at dataset validation (usually a format problem the customer can fix) or during training (more often the platform's problem), and how long jobs wait for capacity.

**Problem Statement.** Write one PostgreSQL query that returns `base_model, method, jobs, completed, failed_validation, failed_training, cancelled, completion_rate, median_queue_minutes`, one row per (base model, method) that has at least one job, ordered by `base_model, method`. A retry is a row of `ft_jobs` whose `retry_of` names the original job (always the first attempt, never another retry). The original and all its retries are one job, and it is counted once, by its latest attempt (largest `created_at`): that attempt's base model, method and outcome. An attempt's outcome is its terminal event: `completed`, `validation_failed`, `failed` (during training) or `cancelled`; `failed_validation` and `failed_training` count the second and third. `completion_rate` is completed ÷ (completed + failed_validation + failed_training), rounded to 3 decimals, NULL when that is 0. An attempt's minutes queued is the sum, over its `queued` events, of the minutes from that event to the attempt's next event. `median_queue_minutes` is `percentile_cont(0.5)` of the minutes queued of latest attempts that `completed` or `failed`, NULL if there are none. {{cancel_rule}} {{queue_rule}}

**Constraints.** One SQL statement (CTEs allowed). Timestamps are whole minutes in UTC. The sample has {{attempts}} attempts and {{events}} events; a real platform has many thousands of jobs a week.

**Assumptions.** Base models, tenants, methods, counts and timings are hypothetical. Job states are simplified to `validating`, `validation_failed`, `queued`, `running`, `completed`, `failed` and `cancelled`; a real pipeline has more (checkpointing, uploading the result). The data was extracted after every attempt in it had reached a terminal state. Datasets appear only through the outcome of the validation the customer asked for; nothing about their content is used.

**Clarifications.**
- Q: A job failed at validation, was retried and completed. What do I count? | A: One job, completed. The failed first attempt is not counted anywhere.
- Q: Does `retry_of` ever point to another retry? | A: No. Every retry names the original job, so one level of grouping is enough.
- Q: Do cancelled jobs count in `completion_rate`? | A: No. They are shown in `cancelled` and left out of the rate's denominator.
- Q: Does time spent validating the dataset count as queued? | A: No. Minutes queued start at a `queued` event and end at the attempt's next event, whatever it is.
- Q: Which jobs feed the median? | A: Jobs whose latest attempt `completed` or `failed`; jobs that failed validation never queued, and cancelled jobs are shown apart.

**Hints.**
1. `COALESCE(retry_of, job_id)` names each attempt's job; `DISTINCT ON (that) … ORDER BY that, created_at DESC` keeps the latest attempt.
2. The terminal event of an attempt is its latest event among the four terminal states; `DISTINCT ON (job_id)` again, so a terminal event delivered twice still gives one outcome.
3. `LEAD(event_ts) OVER (PARTITION BY job_id ORDER BY event_ts)` gives each event's next event; sum the gaps after `queued` events. `percentile_cont(0.5) WITHIN GROUP (ORDER BY …) FILTER (WHERE …)` keeps the median to the right jobs.

**Follow-ups.**
1. The team also wants the share of jobs that needed at least one retry before completing, per base model and method. Add it without counting a job twice.
2. A customer retries a failed LoRA job as a full fine-tune on a different base model. Which group should it count in, and what would the per-model view hide?
3. Jobs now write a checkpoint every N steps, and a failed job can resume from its last checkpoint instead of retrying from the start. How do you model resumes so minutes queued and outcomes stay honest?
4. At millions of events a month, how would you keep this report up to date incrementally as events arrive, including a late terminal event for a job already counted?

**Follow-up rules.**
- when: count(*), count of events, count events → ask: A terminal event was delivered twice. How many outcomes does your query count for that job, and how would you make the count immune to duplicates?
- when: min(created_at), first attempt, original job → ask: A job failed validation, was fixed and retried, and completed. Which attempt decides its outcome in your query, and which should?
- when: created_at - , from created_at, since submission → ask: How long did a job that spent 6 minutes validating and 40 minutes in the queue wait in your query, and what does the team want to measure?
- when: avg, average, mean → ask: Queue waits are long-tailed when capacity is short. Why might the median be the better headline here, and what would you show next to it?
- when: lead, next event → ask: A job is preempted and queued a second time. Does your query add both queued periods, and what happens when two events of one job share a timestamp?

**Evaluation Criteria.** One job per retry chain, judged by its latest attempt (base model, method and outcome); one outcome per attempt even with duplicate terminal events; validation failures separated from training failures; cancelled jobs shown apart and outside the rate's denominator; minutes queued summed over every queued period and excluding validation; median over the right jobs, NULL when none; exact rounding; deterministic order; sensible answers on retries, resumes from checkpoints and incremental maintenance.

## TGA-L1-02: Dedicated endpoint replica-minutes per endpoint and UTC day — every started minute billed per running replica

| | |
|---|---|
| **Template ID** | TGA-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / step functions from change events (LEAD), expanding intervals to the minutes they touch, MAX per minute, idle filtering, day splitting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | TGA-L1-02.mjs |

**Business Scenario.** A customer of a cloud for open models runs a dedicated endpoint: a model deployment reserved for them, with a number of replicas that the customer or an autoscaler changes over time. In this exercise the endpoint is billed per minute for each running replica (this exercise's rule; check current docs for real billing). The billing team produces each endpoint's daily replica-minutes and cost, and shows how many of those replica-minutes served no request at all, so customers can see what idle capacity costs them.

**Problem Statement.** Write one PostgreSQL query that returns `day, endpoint_id, billed_replica_minutes, idle_replica_minutes, cost_usd` for the report ({{report_days}}), one row per endpoint and UTC day with at least one billed replica-minute, ordered by `day, endpoint_id`. Each row of `replica_events` sets the endpoint's replica count to `replicas` from `event_ts` until the endpoint's next event; before an endpoint's first event its count is 0, and 0 means stopped. This exercise's billing rule: every clock minute (UTC, from :00 to the next :00) is billed for the largest number of replicas running at any moment in that minute, so a minute in which a replica started or stopped is billed in full. `billed_replica_minutes` sums that over the day's minutes. `idle_replica_minutes` sums it over the minutes in which the endpoint received no request (a request at `request_ts` belongs to the minute it falls in). `cost_usd` is `billed_replica_minutes × price_per_replica_minute`, rounded to 2 decimals. {{before_rule}} {{minute_rule}}

**Constraints.** One SQL statement (CTEs allowed). Timestamps are whole seconds in UTC. The report covers `{{first_day}}` to `{{last_day}}` inclusive. The sample has {{scale_events}} scale events and {{requests}} requests; a busy endpoint has many thousands of requests a minute, and a platform has many endpoints.

**Assumptions.** Endpoints, prices, replica counts and traffic are hypothetical, and the per-started-minute rule is this exercise's billing rule, not any provider's; check current docs. A replica counts as running from the event that starts it, whether or not it is ready to serve. Requests are only used to tell busy minutes from idle ones.

**Clarifications.**
- Q: The endpoint scaled from 2 to 4 replicas at 10:05:30. How is 10:05 billed? | A: 4 replica-minutes. Four replicas ran during that minute, so it is billed for four.
- Q: It stopped at exactly 10:07:00. Is 10:07 billed? | A: No. At no moment from 10:07:00 to 10:08:00 was a replica running. 10:06 is billed in full.
- Q: What makes a minute idle? | A: No request at all for that endpoint between its :00 and the next :00. An idle minute on three replicas is three idle replica-minutes.
- Q: A request arrived while the endpoint was stopped. | A: It bills nothing; a stopped minute is not in either total.
- Q: Should an endpoint-day with no billed minutes appear? | A: No. Only endpoint-days with at least one billed replica-minute.

**Hints.**
1. Turn events into segments: `LEAD(event_ts) OVER (PARTITION BY endpoint_id ORDER BY event_ts)` is where a count stops applying; the last segment runs to the end of the report. Clip each segment to the report.
2. A segment from `a` to `b` touches the minutes from `date_trunc('minute', a)` up to the last minute that starts before `b`; `generate_series` over those minutes and take `MAX(replicas)` per endpoint and minute.
3. Build the set of minutes that had a request with `date_trunc('minute', request_ts)` and LEFT JOIN it; `FILTER (WHERE … IS NULL)` gives the idle sum.

**Follow-ups.**
1. A month has 43 200 minutes per endpoint. How would you compute billed minutes from segments without expanding every minute, and where does the per-minute rule make that harder?
2. Customers ask why an endpoint that "scaled to zero at 10:07" was billed for 10:06. Write the explanation the invoice should carry.
3. Scale events arrive late from the control plane, sometimes after the day was invoiced. What do you do with the difference?
4. The team wants to show customers the replica-minutes they could have saved with a smaller minimum replica count. What would you compute, and what would you refuse to promise?

**Follow-up rules.**
- when: epoch, seconds, extract(epoch → ask: Your query measures running time in seconds. What does this exercise's rule bill for a replica that ran from 10:05:30 to 10:06:10, and what does yours?
- when: generate_series, minute grid, every minute → ask: How many rows does your grid make for 2 000 endpoints over a month, and which minutes can you skip?
- when: last value, at the start, in force at → ask: The endpoint spiked from 2 to 6 replicas for 20 seconds inside one minute. What does your query bill for that minute?
- when: count(*), count of minutes → ask: An idle minute on three replicas: is that one idle unit or three in your query?
- when: where event_ts >=, events of the day, filter the day → ask: An endpoint was scaled to 2 replicas yesterday and has no event today. What does your query bill it for today?

**Evaluation Criteria.** The count from the last event at or before each moment, including events before the report; segments clipped to the report and split at UTC midnight; every minute billed at the largest count running in it, so started minutes are whole and a stop exactly on the minute bills nothing for that minute; idle replica-minutes as replicas × minutes with no request; stopped periods excluded; exact rounding of cost; deterministic order; a credible plan for month-scale computation and late events.

## TGA-L1-03: Adapter traffic on shared endpoints — requests per LoRA adapter, the base model's share, and adapters idle for 7 days

| | |
|---|---|
| **Template ID** | TGA-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / day × entity grid, ROW_NUMBER over an aggregate for the top item with ties, interval coverage of a trailing window, NOT EXISTS, string_agg |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer |
| **Generator** | TGA-L1-03.mjs |

**Business Scenario.** On a cloud for open models, a customer can attach several LoRA adapters to one dedicated endpoint: every request names an adapter, or none to use the base model alone, and all of them share the endpoint's replicas. Each attached adapter takes memory on those replicas. The endpoint dashboard shows each day how traffic splits between the base model and the adapters, which adapter was busiest, and which adapters have sat attached for a week without serving anything, so the customer can detach them.

**Problem Statement.** Write one PostgreSQL query that returns `day, endpoint_id, requests, base_share, adapters_used, busiest_adapter, idle_adapters`: one row for every endpoint in `adapter_attachments` and every UTC day from `{{first_day}}` to `{{last_day}}`, ordered by `day, endpoint_id`. Only requests with status `ok` were served. `requests` counts the endpoint's served requests that day; `base_share` is the share of them with no `adapter_id`, rounded to 3 decimals (NULL with no requests). `adapters_used` counts distinct adapters with a served request that day, and `busiest_adapter` is the adapter with the most served requests that day, ties to the smaller `adapter_id` (NULL if none). `idle_adapters` lists, as `adapter_id`s in ascending order joined by `', '`, the adapters for which one attachment row covers the whole 7 days ending that day (attached at or before 00:00 six days earlier, and not detached before the end of the day) and that served no request on this endpoint in those 7 days; NULL when there are none. {{status_rule}} {{attach_rule}}

**Constraints.** One SQL statement (CTEs allowed). Timestamps are whole seconds in UTC. A detachment time of NULL means still attached. Endpoints in this sample: {{endpoints}}; {{attachments}} attachment rows and {{requests}} requests.

**Assumptions.** Endpoints, adapters, attachment history and traffic are hypothetical. An adapter's memory cost is not modelled; the dashboard only lists candidates to detach. Request contents are never used, only which adapter a request named.

**Clarifications.**
- Q: Which 7 days are "the 7 days ending" on 2026-09-30? | A: 2026-09-24 00:00 up to 2026-10-01 00:00. A request at exactly 2026-09-24 00:00:00 is inside the window.
- Q: An adapter was attached three days ago and has never been called. Is it idle? | A: Not by this rule. It has not been attached for the whole window, so it is not listed yet.
- Q: An adapter was detached in the afternoon. Can it appear in that day's list? | A: No. It was not attached until the end of the day.
- Q: Two adapters tie for the most requests. | A: The smaller `adapter_id` is the busiest.
- Q: What if an endpoint had no requests on a day? | A: It still gets a row: `requests` 0, `base_share` NULL, `adapters_used` 0, `busiest_adapter` NULL, and its idle list.

**Hints.**
1. Build the grid first: report days from `generate_series` CROSS JOIN the endpoints, then LEFT JOIN the served requests of that day, so empty days keep their row.
2. For the busiest adapter, `ROW_NUMBER() OVER (PARTITION BY day, endpoint_id ORDER BY COUNT(*) DESC, adapter_id)` over the grouped counts, and keep rank 1.
3. For idle adapters, join attachments that cover the window and keep them with `NOT EXISTS` a served request in the window; `string_agg(adapter_id, ', ' ORDER BY adapter_id)` builds the list.

**Follow-ups.**
1. The customer wants each idle adapter's last served request next to it, or "never". How would you add it?
2. Adapters are loaded into replica memory on demand and evicted when unused. How does that change what "idle" should mean on the dashboard?
3. An endpoint serves thousands of requests a second. Which daily aggregate would you maintain so this query never scans raw requests?
4. The same adapter is attached to two endpoints in different regions. Should the dashboard call it idle if one of them serves it? Argue both ways.

**Follow-up rules.**
- when: 7 days, interval '7 days', - 7 → ask: Which instant does your window start at for a report day, and is a request at exactly 00:00 six days earlier inside it?
- when: min(attached_at), first attached, earliest attach → ask: An adapter was detached and attached again yesterday, and has not been called since. Has it been attached for the whole window in your query?
- when: status, rejected → ask: A call to an adapter was rejected because it was not attached. Should that count as the adapter being used, in this report and in a capacity report?
- when: max(, max of counts, order by count → ask: Two adapters tie for the most requests. Which does your query return, and is that deterministic across runs?
- when: inner join, join requests → ask: An endpoint had no served requests on one day. Does it still get a row in your query?

**Evaluation Criteria.** A full endpoint × day grid; only served requests counted anywhere; correct base share and its NULL; busiest adapter with the stated tie rule; a 7-day window that starts at 00:00 six days earlier and includes that instant; idle only when a single attachment covers the whole window, per endpoint; a sorted list and NULL when empty; deterministic order; sensible answers on last-used, on-demand loading and pre-aggregation.

## TGA-L1-04: Ordering a customer's own fine-tuning queue — the least total weighted completion time

| | |
|---|---|
| **Template ID** | TGA-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy / exchange argument (Smith's ratio rule), exact ratio comparison by cross-multiplication, tie rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | TGA-L1-04.mjs |

**Business Scenario.** A customer of a cloud for open models has a fixed fine-tuning allocation that runs one job at a time, and a queue of jobs, each with an estimated number of minutes. The customer sets a weight per job for how much it matters to have that job finished early. The console offers to reorder the customer's own queue so that the sum, over jobs, of weight × the minute at which the job finishes is as small as possible.

**Problem Statement.** Implement `queue_order(jobs, running=None)`. `jobs` is a list of `(job_id, minutes, weight)` with integer minutes and weights. Jobs run one after another with no gaps, starting at minute 0; a job's completion time is the sum of the minutes of every job up to and including it. Return `(order, total)`: `order` is the list of job ids in an order that minimises the total of weight × completion time, and `total` is that minimum. When two jobs have exactly the same ratio of minutes to weight, the one with the smaller `job_id` (string order) goes first. {{weight_rule}} {{running_rule}}

**Constraints.** Up to 60 000 jobs in the timing check. Trying every order is O(n!), and picking the best remaining job again and again is O(n²); one sort, O(n log n), is expected. Compare ratios exactly; do not trust floating-point division.

**Assumptions.** Minutes, weights and job ids are hypothetical. Estimates are taken as exact; how real job lengths are estimated is not part of this exercise. Only the customer's own queue is reordered; other customers' jobs are not involved.

**Clarifications.**
- Q: Should I just run the shortest job first? | A: Not when weights differ. A long job that matters a lot can belong before a short job that matters little.
- Q: How do I compare two jobs? | A: By minutes ÷ weight, smaller first. Compare `m1 × w2` with `m2 × w1` in integers, so equal ratios are recognised exactly.
- Q: Do I return a tuple? | A: Yes, `(order, total)` with `order` a list of job ids, or `None` where the statement says so.
- Q: Which order do you want when several orders give the same minimum? | A: Jobs with equal ratios go by `job_id`; with that rule the order is unique.

**Hints.**
1. Look at two adjacent jobs and swap them. Only their own two terms change. Which order is better, in terms of minutes and weights?
2. The swap argument says: job a goes before job b when `minutes_a × weight_b < minutes_b × weight_a`. Sort by that comparison (`functools.cmp_to_key`, or an exact key such as `fractions.Fraction`).
3. Ties by `job_id` make the answer unique, and integers keep the total exact however large it gets.

**Follow-ups.**
1. Prove the exchange argument: why does any order with an adjacent pair out of ratio order have a strictly larger total, unless their ratios are equal?
2. Some jobs must run after another job of the same customer (for example, evaluation after training). What happens to the greedy, and what would you do for chains of jobs?
3. The allocation now runs two jobs at a time. Is the ratio rule still optimal? What would you try instead?
4. Estimates are often wrong. How would the console re-plan when a running job overruns, and how would you explain the new order to the customer?

**Follow-up rules.**
- when: shortest first, sort by minutes, shortest job → ask: Jobs (a, 10 minutes, weight 1) and (b, 30 minutes, weight 6). Which order does shortest-first give, and what are the two totals?
- when: float, division, divide → ask: Weights and minutes can be near 10^9. Can two different ratios divide to the same float, and what does your tie rule do then?
- when: permutations, itertools.permutations, every order → ask: How many orders are there for 20 jobs, and what property of an optimal order lets you avoid trying them?
- when: heaviest, sort by weight, highest weight → ask: Jobs (a, 700 minutes, weight 5) and (b, 70 minutes, weight 2). Which goes first by weight, and which by the total?
- when: zero, weight 0 → ask: How does your comparison place a job with weight 0, and does it ever divide by zero?

**Evaluation Criteria.** Sort by the ratio of minutes to weight, compared exactly by cross-multiplication; ties by job id; the total computed in exact integers; at Hard, zero-weight jobs last, an empty queue, and `None` for invalid input; at Very Hard, the running job kept first, `None` for an unknown running id, and values up to 10^9 handled without floats; O(n log n) with a clear exchange-argument proof; good answers on precedence, parallel machines and re-planning.

## TGA-L1-05: Structured output streams — the chunk where the JSON became complete, the first invalid character, or still incomplete

| | |
|---|---|
| **Template ID** | TGA-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Streaming / incremental state machine across chunk boundaries (bracket stack, string and escape states) |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | TGA-L1-05.mjs |

**Business Scenario.** An inference API for open models can stream a response in JSON mode: the text arrives in small chunks, and a client wants to act as soon as the JSON object is complete, or stop as soon as the text can no longer be valid. A monitoring job checks many streamed responses for structural problems. It must keep up with long responses split into thousands of tiny chunks, so it cannot re-read everything it has seen each time a chunk arrives.

**Problem Statement.** Implement `json_stream_status(streams)`. `streams` is a list of streamed responses, each a list of text chunks in arrival order (a chunk may be empty). Return one result per stream, in order, by this exercise's structural rules. Whitespace is space, tab, newline and carriage return. Leading whitespace is skipped; the first other character must be `{` or `[`, or the stream is invalid at that character. Outside strings, `{` and `[` open a bracket, and `}` or `]` must close the most recently opened bracket of the same kind, or it is invalid. `"` starts a string; inside a string, `"` ends it, a backslash escapes the next character (so `\"` does not end the string and `\\` is one backslash), and brackets are just text. Every other character outside strings is accepted: this check covers structure, not values. The response is complete when the bracket that opened it closes. Return `("complete", k)` with `k` the 0-based index of the chunk holding that closing bracket; `("invalid", i)` with `i` the 0-based position of the first invalid character in the stream's text (all chunks joined); or `("incomplete", n)` when the stream ends first, with `n` the number of brackets still open (0 if none was opened). {{escape_rule}} {{control_rule}}

**Constraints.** Streams can be hundreds of thousands of characters, in chunks of 1 to 4 characters, in the timing check. Re-scanning the accumulated text after every chunk is quadratic and too slow; keep a scanner state per stream so every character is read once.

**Assumptions.** Responses and chunk boundaries are synthetic; the structural rules are this exercise's, a subset of JSON (numbers, literals, commas and colons are not checked). Text is ASCII. What the response says is never inspected, only its structure.

**Clarifications.**
- Q: Does a `}` inside a string close anything? | A: No. Inside a string only `"` (unescaped) and the backslash matter.
- Q: A chunk ends with a backslash. | A: The escape continues into the next chunk; the next character, wherever it arrives, is the escaped one.
- Q: How do I count positions with empty chunks? | A: Positions are in the joined text, so empty chunks add nothing; chunk indexes still count them.
- Q: The stream is only whitespace so far. | A: `("incomplete", 0)`.
- Q: Can I raise on bad input? | A: No. Return the tuple; an invalid stream is a normal result.

**Hints.**
1. The state you need between chunks is small: the stack of open brackets, whether you are inside a string, whether the last character was an unescaped backslash, and whether the response has started or finished.
2. Process each character once, chunk by chunk, keeping a running position; record the chunk index at the moment the stack becomes empty.
3. Check `\\"` and `"\\"` by hand: whether a quote ends a string depends on the escape state, not on whether the previous character is a backslash.

**Follow-ups.**
1. Extend the scanner to check full JSON: commas, colons, numbers and `true`/`false`/`null`. Which states do you add?
2. The client also wants the value of a top-level key as soon as it is complete, before the rest of the object arrives. How would you emit it?
3. Responses are UTF-8 bytes, and a chunk can end in the middle of a multi-byte character. What changes?
4. A monitoring job reads 50 000 concurrent streams. How much state per stream do you keep, and when can you drop it?

**Follow-up rules.**
- when: json.loads, json.load, loads( → ask: You call json.loads on the accumulated text after each chunk. How many characters does that read for a 150 000-character response in 60 000 chunks?
- when: previous character, prev char, text[i-1], [i - 1] → ask: What does your check say about the string "a\\" followed by a quote? Is the quote escaped?
- when: "".join, join the chunks, accumulate → ask: Joining is fine once. Where does your code join or re-scan, and how often does that happen per stream?
- when: count(, counts of brackets, counter → ask: Counting brackets accepts {[}]. How does your scanner reject it, and at which position?
- when: regex, re., regular expression → ask: Can a regular expression match balanced nested brackets? What would you keep instead between chunks?

**Evaluation Criteria.** One pass with a per-stream state; a bracket stack that rejects mismatches at the right position; strings and escapes honoured across chunk boundaries; chunk index of completion and character position of the first invalid character; incomplete with the open-bracket count; at Hard, JSON's escapes only, four hex digits after `\u`, and nothing but whitespace after completion; at Very Hard, raw control characters in strings rejected and escapes split across chunks; O(total characters) with a clear argument; good answers on full JSON, early emission and UTF-8.
