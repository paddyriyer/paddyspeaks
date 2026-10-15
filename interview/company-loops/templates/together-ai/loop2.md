# Together AI · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a cloud for open
models: fine-tuning jobs on uploaded datasets (LoRA or full fine-tunes, checkpoints,
job states), dedicated endpoints billed per minute per running replica, several LoRA
adapters sharing one dedicated endpoint, serverless inference across many open models
metered per model and tenant, and per-tenant latency. Every price, capacity, limit,
volume and schema is hypothetical and "this exercise's rule; check current docs";
nothing here describes a real customer, internal system, hardware or capacity. A
customer's training data is never inspected beyond the validation the customer asked
for: data here is counts, lengths, formats and placeholder words.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TGA-L2-01: Adapter slots on a dedicated endpoint: least-frequently-used eviction with a recency tie-break

| | |
|---|---|
| **Template ID** | TGA-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Caches / LFU in O(1): frequency buckets of insertion-ordered dicts, recency tie-break, counts reset on eviction |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer, data-engineer |
| **Generator** | TGA-L2-01.mjs |

**Business Scenario.** A customer fine-tuned many LoRA adapters from the same base model and serves them all on one dedicated endpoint running {{base_model}}. The endpoint can hold only a fixed number of adapters loaded at once, called slots here. A request for an adapter that is already loaded is served straight away; a request for one that is not has to wait while it is loaded, and when every slot is taken another adapter is evicted first. The customer wants to replay their own request log against a slot count and see the hits, the misses and the evictions in order, before choosing how many slots to pay for. The eviction rule is this exercise's rule; check current docs for how real endpoints load and unload adapters.

**Problem Statement.** Implement `adapter_cache(slots, requests, pinned=())`. Process `requests` in order. A request for a loaded adapter is a **hit**: its use count goes up by 1 and it becomes the most recently used. A request for an adapter that is not loaded is a **miss**: if fewer than `slots` adapters are loaded it is loaded with a use count of 1; otherwise the loaded adapter with the **lowest use count** is evicted first, ties broken by **least recent use** (the adapter whose latest request, hit or load, came earliest), and then the new one is loaded with a count of 1. An evicted adapter's count is forgotten: if it is requested again, it is a miss and starts again at 1. Return `(hits, misses, evictions)`, where `evictions` is the list of evicted adapter ids in the order they were evicted. {{level_rule}}

**Constraints.** The timing check replays 150 000 requests on an endpoint with 4 000 to 6 000 slots, tens of thousands of distinct adapters and tens of thousands of misses. Scanning every slot for the victim on each miss is hundreds of millions of steps in CPython. Constant or logarithmic time per request is expected.

**Assumptions.** Slot counts, adapter names and traffic are hypothetical. Every adapter is the same size, so one adapter takes one slot. Loading time is not modelled: only which requests hit or miss. Adapter ids are compared exactly as strings.

**Clarifications.**
- Q: Does the request that loads an adapter count as a use? | A: Yes. After the load its count is 1 and it is the most recently used adapter. The request itself is a miss, not a hit.
- Q: Which adapter goes when two have the same lowest count? | A: The one used least recently, where "used" means its latest request, hit or load.
- Q: Does an adapter keep its count after it is evicted? | A: No. It is forgotten, and the adapter starts again at 1 if it comes back.
- Q: Is the order of `evictions` the order of the misses that caused them? | A: Yes. One eviction at most per miss.
- Q: Is the request log sorted by adapter or by time? | A: By arrival time only. Process it in the order given.

**Hints.**
1. Group the loaded adapters by use count. The victim is in the group with the smallest count, and within it, the one used least recently.
2. A hit moves an adapter from group `f` to the end of group `f + 1`. So the order inside every group is simply the order in which adapters arrived in it, which is their order of last use.
3. Keep the smallest non-empty count in a variable. A load sets it to 1; a hit that empties group `f` while it was the smallest moves it to `f + 1`. It never needs a search.

**Follow-ups.**
1. Use counts never fade: an adapter that was busy last week can keep a slot forever. How would you age the counts, and what does each option cost per request?
2. Adapters now differ in size by LoRA rank, and a large one takes several slots and longer to load. How does the eviction rule change?
3. The endpoint runs several replicas, each with its own slots. How would you route requests so that each adapter stays loaded on as few replicas as possible without overloading one?
4. The customer wants the smallest slot count that keeps misses under 2% over a week of traffic. How would you find it, and what must you check before you binary search over slot counts?

**Follow-up rules.**
- when: min, scan, every slot, for slot → ask: How many slots does each miss look at in the timing check, and how many misses are there? Multiply them.
- when: heap, heapq, priority queue → ask: After a hit, the adapter's old entry is still in the heap. How do you recognise a stale entry when it reaches the top, and how large can the heap grow?
- when: ordereddict, ordered dict, linked list, doubly linked → ask: Which order does each group keep, and why is it the same as least-recent use among adapters with that count?
- when: min_freq, min_count, smallest count, minimum count → ask: When exactly does the smallest count change? Show the case where a hit changes it.
- when: lru, least recently used → ask: Give a request sequence where least-recently-used and this rule evict different adapters, and say which one the customer would prefer.

**Evaluation Criteria.** Hits and misses counted correctly, with the loading request a miss; the lowest count evicted, ties by least recent use; counts forgotten on eviction; evictions listed in order; at Hard, base-model requests ignored and zero slots handled; at Very Hard, pinned adapters never evicted and misses served without loading when nothing can be evicted; O(1) per request with count groups (or O(log slots) with a heap and lazy deletion, argued carefully); a clear complexity argument; sensible answers on ageing, sizes and choosing the slot count.

## TGA-L2-02: Per-tenant latency questions: how many requests were slower than a threshold

| | |
|---|---|
| **Template ID** | TGA-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Offline queries / sorting queries by threshold, a Fenwick tree over time per tenant, half-open ranges |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, analytics-engineer |
| **Generator** | TGA-L2-02.mjs |

**Business Scenario.** Serverless inference serves many open models to many tenants on shared capacity, and each tenant can see its own latency. A latency report built for each tenant asks many questions of the same form: how many of this tenant's requests in this time range had {{metric}} slower than this threshold? A report run asks tens of thousands of them at once, over different tenants, ranges and thresholds, against one day of request records. Each answer counts only the asking tenant's own requests; other tenants appear in nothing a tenant sees.

**Problem Statement.** Implement `slow_request_counts(requests, queries)`. `requests` is a list of `(tenant, ts, latency_ms, model)` in no particular order, where `ts` is an integer timestamp and `latency_ms` an integer. `queries` is a list of `(tenant, t_from, t_to, threshold_ms, model)`. For each query, return the number of requests of that tenant with `t_from <= ts < t_to` and `latency_ms > threshold_ms` (strictly slower), in the order the queries were given. When `model` is `None`, requests to every model count. A tenant with no requests gets 0. {{level_rule}}

**Constraints.** The timing check has 120 000 to 150 000 requests and 30 000 queries over three to five tenants, and most queries cover more than half of the day, so a query's slice of its tenant's requests holds tens of thousands of rows. Scanning that slice for every query is about a billion comparisons. Something close to O((n + q) log n) is expected.

**Assumptions.** Tenants, models, timestamps and latencies are hypothetical; how real latency is measured and reported is not described here, so check current docs. All queries are known before you answer any of them. Timestamps can repeat.

**Clarifications.**
- Q: Is a request exactly at `t_to` inside the range? | A: No. `t_from` is inclusive and `t_to` exclusive.
- Q: Does a latency equal to the threshold count? | A: No. Only strictly slower requests count.
- Q: Do I have to answer the queries in order? | A: You must return the answers in the order the queries were given, but you may compute them in any order.
- Q: Can two requests have the same timestamp? | A: Yes, and both count.
- Q: Can a query name a tenant that sent nothing? | A: Yes. The answer is 0.

**Hints.**
1. Each answer has two conditions: time inside a range, and latency above a threshold. With only the time condition, a sorted list of timestamps and two bisects would do. What stops that here?
2. Answer the queries in decreasing order of threshold. Before each one, add every request slower than its threshold that has not been added yet. Requests only ever get added.
3. Then each query asks "how many added requests of this tenant have a time in `[t_from, t_to)`?". A Fenwick tree over the tenant's timestamps in sorted order answers that with two prefix sums.

**Follow-ups.**
1. Queries now arrive one at a time from a live dashboard, so you cannot sort them first. Which structure answers each one quickly, and what does it cost in memory?
2. The report wants the 95th percentile of each tenant's latency per range instead of a count. How would you get it from the same kind of structure?
3. A tenant has only 14 requests in a range. What should the report show, and what must it not claim?
4. Requests keep arriving during the day and the report is re-run every five minutes. What would you keep between runs instead of starting again?

**Follow-up rules.**
- when: bisect, binary search → ask: After bisecting to the time range, how many requests are in a typical slice in the timing check, and what do you then do with each of them?
- when: fenwick, binary indexed tree, bit tree → ask: What does your tree index by, in what order do requests enter it, and why does that order make each answer correct?
- when: segment tree, merge sort tree, wavelet → ask: That structure answers online. What does it cost per query and in memory at 150 000 requests, and when would you still prefer sorting the queries?
- when: numpy, pandas, vectorise, vectorize → ask: A vectorised scan is fast per element, but how many elements does each query still touch, and how does that grow with the number of queries?
- when: percentile, p95, p99 → ask: How would your structure turn "how many are slower than x" into "what is the 95th percentile", and how many steps does that take?

**Evaluation Criteria.** Half-open time ranges, strictly slower latencies, only the asking tenant's requests, answers in query order and 0 for unknown tenants; at Hard, failed requests never counted and malformed ranges answered `-1`; at Very Hard, model filters honoured with `None` meaning all models; an offline method in O((n + q) log n) (or an online merge-sort or wavelet tree in O(log² n) per query, argued carefully); a clear explanation of why processing queries by threshold works; sensible answers on online queries, percentiles and low volume.

## TGA-L2-03: Debug the fine-tuning dataset validator

| | |
|---|---|
| **Template ID** | TGA-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Input validation / JSON Lines, 1-based line numbers, role order, token limits, repeated keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, ml-platform-engineer, software-engineer, ai-infra-engineer |
| **Generator** | TGA-L2-03.mjs |

**Business Scenario.** Customers upload training files for fine-tuning in a conversational JSON Lines format: each line is one example, a JSON object whose `messages` list holds turns with a `role` and a `content`. Before a job is queued, the platform validates the file and reports problems by line number and error code. The validator never shows, stores or summarises the content of a line: the customer asked for a format check, and that is all it does. Customers have reported several problems. Errors point at the wrong line in files with blank lines. A file with a system turn in the middle of a conversation passed validation and the job then failed. Examples over the length limit passed when they had a long system turn. An assistant answer made only of spaces passed as if it were text. A line with several repeated keys got the same error many times. The validator below is the suspect.

**Problem Statement.** Fix `validate_dataset(lines, max_tokens)` so that it meets this specification. The format and every rule here are this exercise's rules; check current docs for the real format. {{replay_rule}}
1. **Lines.** `lines[0]` is line 1 of the file. Lines that are empty or only whitespace are skipped, but they still count in the numbering. If every line is blank (or there are none), return `[(0, "no_examples")]`.
2. **JSON.** A line that is not valid JSON gets `invalid_json`, and nothing else is checked on it.
3. **Repeated keys.** If any JSON object on the line (the line itself or any object inside it) repeats a key, the line gets `duplicate_key`, **once** however many keys repeat. A repeated key's last value is the one that counts.
4. **Messages.** The line must be an object with a non-empty list under `messages`; otherwise it gets `missing_messages`, and the checks below are skipped. Every message is an object with a string `role` and a string `content`.
5. **Role order.** An optional `system` turn **first**, then turns alternating `user`, `assistant`, starting with `user` and ending with `assistant`. Anything else gets `bad_role_order`: a system turn anywhere else, two turns in a row with the same role, an unknown role, or a conversation with no user turn.
6. **Empty answers.** If any `assistant` turn has content that is empty or only whitespace, the line gets `empty_assistant` (once).
7. **Length.** The line's token count is the number of whitespace-separated words (`len(content.split())`) summed over **every** turn, the system turn included. Over `max_tokens` gets `too_long`; exactly `max_tokens` is allowed.
8. **Output.** A list of `(line_number, code)`, by line number, and within a line in the order `duplicate_key`, `missing_messages`, `bad_role_order`, `empty_assistant`, `too_long`. A valid file returns `[]`.

**Constraints.** Keep the function's name, arguments and output format. Report codes and line numbers only, never any content. Up to 100 000 lines, processed in close to linear time.

**Assumptions.** The format, the error codes, the word-count token rule and the limits are hypothetical; real fine-tuning formats and token counts (which use the model's tokenizer) differ, so check current docs. Line contents are synthetic placeholder words. Messages inside a parsed `messages` list are always objects with string `role` and `content` in this exercise.

**Clarifications.**
- Q: Do blank lines count in the line numbers? | A: Yes. They are skipped for checking, but line 5 is the fifth line of the file whatever comes before it.
- Q: Is a conversation with only a system turn valid? | A: No. It has no user turn, so it gets `bad_role_order`.
- Q: Does the system turn count toward the length? | A: Yes. The limit is over every turn.
- Q: If `messages` appears twice, which one is checked? | A: The last one, as the JSON parser keeps it. The line also gets `duplicate_key`.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Feed the validator a file whose second line is blank and whose third line is broken, and read the line number it reports.
2. Which turns does `turns` hold, and where else in the function is it used?
3. What does `"  ".strip()` return, and what does the empty-answer check compare against?
4. Count how many times `duplicate_key` can be appended for one line.

**Follow-ups.**
1. A customer's file has 2 million lines and 40 000 errors. What do you return to them, and what do you keep?
2. The real limit is in model tokens, not words, and each base model has its own tokenizer. Where does tokenization happen, and how do you keep it fast on large files?
3. The customer asks why a line was rejected, and support may not open the file. What can the error report say, and what should it never say?
4. Validation runs on upload, and the job starts hours later on a different base model with a smaller limit. How do you keep the two consistent?

**Follow-up rules.**
- when: enumerate, line number, numbering → ask: Where does the line number come from in your fix, and which test would have caught the original mistake?
- when: system, leading, first turn → ask: How does your fix treat a system turn in the middle, and two system turns at the start?
- when: strip, whitespace → ask: Which other check in the function depends on how whitespace is treated, and is it consistent with this one?
- when: object_pairs_hook, hook, duplicate → ask: Repeated keys can be inside a message, not only at the top level. How does your fix see those, and how many times does it report them?
- when: tokenizer, tokens, token count → ask: The word rule here is a stand-in. What changes in cost and in correctness when the count uses the model's real tokenizer?

**Evaluation Criteria.** Finds and explains every bug with its customer symptom; line numbers counted over the whole file, blank lines included; a system turn accepted only first; every turn counted toward the limit; whitespace-only answers rejected; repeated keys reported once per line; minimal fixes that keep the output format; no content ever in the output; a regression test per bug.

## TGA-L2-04: Fine-tuning job pipeline: from uploaded dataset to a deployable model

| | |
|---|---|
| **Template ID** | TGA-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Job pipelines / validation, queueing, checkpointing, job state machines and customer-visible events |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | ml-platform-engineer, ai-infra-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "daily_jobs": {"2": ["2 000", "5 000"], "3": ["20 000", "50 000"]},
  "max_dataset_gb": [5, 25, 100],
  "checkpoints": [3, 5, 10],
  "base_models": [20, 60, 150]
}
```

**Business Scenario.** A cloud for open models lets customers fine-tune any of {{base_models}} base models. A customer uploads a training file of up to {{max_dataset_gb}} GB, chooses a LoRA or a full fine-tune and its settings, and starts a job. The job waits in a queue for capacity, trains, saves up to {{checkpoints}} checkpoints along the way, and ends with a model the customer can deploy to an endpoint or download. About {{daily_jobs}} jobs start each day. Customers watch their jobs through a status page and an API that list the job's state and events, and they can cancel at any time.

**Problem Statement.** Design the fine-tuning job pipeline. Cover the upload and the validation the customer asked for (format, lengths, counts, never content), the job's state machine and its events, the queue and how jobs are admitted to capacity, how training is checkpointed and resumed after a failure, how cancellation works at every stage, how the finished model is registered and made ready to deploy, and what the customer sees at each step.

**Constraints.** A job's state shown to the customer must never go backwards or skip a failure. A training failure must resume from the last checkpoint rather than start again. A cancelled job must stop consuming paid capacity within minutes. Validation must finish before a job uses training capacity, and must report problems by line and code without exposing content. Customer files, checkpoints and models are isolated per customer.

**Assumptions.** Volumes, file sizes, checkpoint counts and the number of base models are hypothetical; how real fine-tuning jobs are scheduled, priced or checkpointed is not described here, so check current docs. Training runs on capacity you do not need to design. Every job has a stable id.

**Clarifications.**
- Q: Is validation part of the job, or a separate step? | A: Your choice, but the customer must see validation errors before the job is queued, and a file that passed validation should not be re-validated for every job that uses it.
- Q: Can a customer change settings after starting? | A: No. They cancel and start a new job; the new job can reuse the same uploaded file.
- Q: What does the customer get at the end? | A: A model id they can deploy, plus the checkpoints they asked to keep. For a LoRA job, that is an adapter on top of the base model.
- Q: Are failed jobs charged? | A: This exercise's rule: training time is charged only for work that ends in a usable checkpoint or model. Say how you record it.

**Hints.**
1. Separate files from jobs: an uploaded file has its own validation state and can serve many jobs.
2. Write the job's state machine down first, with every allowed transition, including cancelled and failed from each state, and make every transition an event with a sequence number.
3. Treat a checkpoint as a durable, registered artefact with its own id: resuming is "start from checkpoint k", and the final model is just the last checkpoint promoted.

**Follow-ups.**
1. A base model is deprecated while jobs on it are queued. What happens to them, and what do customers see?
2. A customer re-runs the same job on the same file with the same seed and gets a different loss curve. What would you have recorded to explain it?
3. Queue waits grow to hours for the largest base models. How would you show an honest estimate, and how would you decide admission order?
4. At {{daily_jobs}} jobs a day, which part of the pipeline breaks first, and how do you scale it?

**Follow-up rules.**
- when: state machine, transition, status → ask: A "training started" event arrives after "cancelled" for the same job. What does your state machine do, and what is charged?
- when: checkpoint, resume → ask: Training fails just after a checkpoint is written but before it is registered. Does the resume use it, and how do you know it is complete?
- when: queue, fifo, priority → ask: One customer starts 300 jobs in a minute. How does your queue keep other customers' jobs moving?
- when: validate, validation, schema → ask: What exactly does validation read, and how do you prove to the customer that nothing else read their file?
- when: retry, retries → ask: A job has failed three times on the same step. When do you stop retrying, and what do you tell the customer?

**Production Reality Check.**
- A storage hiccup makes some checkpoint writes look successful while the files are incomplete, and resumed jobs crash at load for several hours.
- A customer uploads a {{max_dataset_gb}} GB file, validation takes longer than the upload, and the status page shows "queued" the whole time.
- Cancellations during the queued-to-training handover are lost, and a few cancelled jobs train for an hour and are charged.

**Evaluation Criteria.** Files and validation separated from jobs, with validation reporting lines and codes only; a written state machine with idempotent, sequenced events that never move backwards; fair admission from the queue; durable, verified checkpoints and resume from the last one; cancellation honoured at every stage, including the handover; a registered, deployable model; per-customer isolation; a plan for each incident.

## TGA-L2-05: Multi-model serverless metering: request events to daily per-tenant usage

| | |
|---|---|
| **Template ID** | TGA-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Metering pipelines / per-model tokenizers, versioned prices, late and duplicate events, invoice reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "daily_requests": {"2": ["500 million", "1 billion"], "3": ["5 billion", "20 billion"]},
  "models": [40, 100, 200],
  "late_hours": [2, 12, 48],
  "model_servers": ["500", "2 000", "8 000"]
}
```

**Business Scenario.** Serverless inference offers {{models}} open models behind one API, served by about {{model_servers}} model servers, and tenants pay per token by model: input and output tokens priced separately, with prices that change over time as models are added, upgraded and repriced. Each model counts tokens with its own tokenizer. About {{daily_requests}} requests a day produce usage events. Most events arrive within seconds, but a server that loses its connection can deliver them up to {{late_hours}} hours late, and retries can deliver the same event twice. Tenants want their usage per model per day the next morning, and finance needs it to match the invoice exactly.

**Problem Statement.** Design the metering pipeline from model-server usage events to daily per-tenant, per-model usage and charges. Cover the usage event and where token counts come from, how events are collected and deduplicated, how late events reach the right day, how the price in force for each request is found and stored, how a day becomes final and how corrections are issued, how the numbers a tenant sees match the invoice, and how each tenant sees only its own usage.

**Constraints.** An event delivered twice must never be charged twice. Late events up to {{late_hours}} hours must land on the day the request happened. Every charge must be reproducible later from stored events and the price version used. A price change takes effect at a stated instant, never "whenever the pipeline notices". Prompt and completion contents never enter the metering pipeline: only counts, ids and timestamps.

**Assumptions.** Volumes, model counts, server counts, lateness and every price rule are hypothetical; check current docs for real pricing and metering. Each request has a unique id. Servers timestamp events with their own clocks, which can drift by seconds.

**Clarifications.**
- Q: Who counts the tokens: the API layer or the model server? | A: Your choice, but say which and why; the two can disagree when a request is cut off mid-stream.
- Q: Which time decides the price: when the request started, or when it finished? | A: This exercise's rule: when the request was received. Store it with the event.
- Q: Are failed requests charged? | A: This exercise's rule: input tokens are charged only if the model produced output; a request that failed before any output is free. Keep the status in the event.
- Q: Can a request use a fine-tuned adapter on serverless? | A: Assume not in this exercise; dedicated endpoints are billed separately per replica-minute.

**Hints.**
1. Make the request id the identity of a usage event, so a duplicate is the same row, not a second one.
2. Store the tokenizer version and the price version with each priced event; a reprice is then a new version, never an edit.
3. Build daily totals as partitions you can rebuild, keyed by the request's day in UTC, and let late events trigger a rebuild of their day.

**Follow-ups.**
1. A model's tokenizer is fixed in a new version and counts 3% fewer tokens for the same text. Which past charges change, and what do you tell tenants?
2. A price cut is announced at noon and backdated to the start of the day. How do the day's totals change, and how is the invoice corrected?
3. A tenant says their own client-side count is 5% lower than yours. How do you investigate without reading their prompts?
4. Volume grows ten times past {{daily_requests}} requests a day. Which stage breaks first?

**Follow-up rules.**
- when: exactly once, exactly-once → ask: Where exactly is a duplicate event dropped, and what would prove to finance that it was?
- when: arrival time, ingestion time, processing time → ask: An event from 23:58 arrives at 01:30. Which day is it charged to, and when is the earlier day final?
- when: counter, increment, running total → ask: A batch of events is replayed after a crash halfway through. How do your counters avoid counting part of it twice?
- when: price version, price table, pricing table → ask: Two price rows overlap by a minute after a rushed change. Which one wins, and how would you have prevented it?
- when: tokenizer, token count → ask: The API layer and the model server count different tokens for a request cut off mid-stream. Which one is charged, and why?

**Production Reality Check.**
- One model server restarts with its clock a day behind, and its events land on the previous day for every tenant it served.
- A retry storm after a network partition delivers some events three times, and one tenant's usage page shows triple usage for an hour.
- A price change is deployed to the pricing table before its announced start time, and requests in between are charged the new price.

**Evaluation Criteria.** Request id as event identity, with duplicates dropped where it can be proven; event-time days with late events rebuilding their day; token counts with a stated source and tokenizer version; versioned prices with exact effective instants, stored with each charge; finality and versioned corrections; tenant numbers equal to the invoice; per-tenant isolation and no content in the pipeline; a plan for each incident.
