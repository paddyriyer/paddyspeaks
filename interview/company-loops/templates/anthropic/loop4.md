# Anthropic · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of an AI model
provider (models offered through apps, a Messages API with streaming, a Message
Batches API, prompt caching, workspaces and enterprise plans). Every workload,
number, price and schema is hypothetical, and nothing here describes how the
company's own systems are built.

## ANT-L4-01: Stream health as the client experiences it

| | |
|---|---|
| **Template ID** | ANT-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Streaming inference observability / event sequencing, stalls, client-perceived SLOs |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "daily_streams": {"2": ["40 million", "120 million"], "3": ["600 million", "1.5 billion"]},
  "regions": [3, 4, 6],
  "stall_threshold": ["5 seconds", "10 seconds"],
  "freshness": ["1 minute", "5 minutes"]
}
```

**Business Scenario.** Most calls to a model API's Messages endpoint are streamed as server-sent events: `message_start`, then for each content block a `content_block_start`, a run of `content_block_delta` events carrying text or fragments of a tool call's JSON input, and a `content_block_stop`; then `message_delta` (with the stop reason and the final output token count) and `message_stop`. Periodic `ping` events keep the connection alive, and an `error` event (for example, overloaded) can arrive in the middle of a stream. About {{daily_streams}} streamed responses a day are served from {{regions}} regions. Latency dashboards measured at the inference servers look healthy, yet enterprise customers report responses that start quickly and then hang, and streams that end without a `message_stop`. Leadership wants to measure stream health the way the client experiences it.

**Problem Statement.** Design the stream-health observability platform. Cover what is recorded per stream and per event and where (the API gateway that holds the client connection, the inference server, optionally a client SDK); how one stream's events become one record; which metrics define health (time to `message_start`, time to the first content delta, inter-event gaps, stalls longer than {{stall_threshold}}, how a stream ended and who closed it first); how they are computed per model, region and organisation with {{freshness}} freshness; and how on-call tells a server fault from a client or network one.

**Constraints.** The content of deltas (text, thinking, tool inputs) never leaves the serving path; telemetry may carry sizes, counts, timestamps and identifiers only. Telemetry must not add measurable latency to the stream. Per-event detail is kept 7 days for debugging; per-stream summaries 90 days. An organisation's view is visible only to that organisation's admins and to internal on-call.

**Assumptions.** All volumes, thresholds and retention periods are hypothetical. The event types are those of the public streaming format. Gateway hosts and inference hosts have independent clocks that can drift by tens of milliseconds, sometimes more. Every request has a request id returned to the client.

**Clarifications.**
- Q: Where does "client-perceived" start and end? | A: At the gateway: when it received the request, when it flushed each event to the socket, and when the socket closed. We cannot see the customer's network.
- Q: Do ping events count as progress? | A: No. A stream that sends only pings for {{stall_threshold}} or longer is stalled.
- Q: Do we need every event long-term? | A: No. Per-event detail for 7 days; a per-stream summary for 90 days.
- Q: Who can end a stream early? | A: Either side: the client disconnects (a user pressed stop, a timeout fired), or the server sends an error event or drops the connection.
- Q: Does tool use change anything? | A: Tool input arrives as JSON fragments in deltas and the stream ends with stop reason `tool_use`; the tool result comes back in a new request, so a multi-step agent turn is several streams.

**Hints.**
1. Summarise each stream where all its events pass, the gateway's connection handler, instead of shipping every delta and reassembling it downstream.
2. Classify how every stream ended (`message_stop`, error event, server close, client close) and record which side closed first.
3. Gaps are a distribution inside each stream. Keep per-stream maximum gap and stall count, then compute percentiles across streams with mergeable sketches.

**Follow-ups.**
1. Define a stalled stream precisely, and show how you compute the stall rate per model and region within {{freshness}}.
2. A stream ends without `message_stop`. How does your record tell apart a client that left, a network failure and a server failure?
3. Gateway and inference-server records for the same request arrive out of order and with clock skew. How do you join them, and which clock do you trust for which metric?
4. An enterprise admin asks for their organisation's stall rate per API key and per workspace. What do you show, and what stops one organisation seeing another's data?
5. Server-side time to first token is flat, but complaints doubled. What would your platform have shown, and which metric did the old dashboards miss?

**Follow-up rules.**
- when: every event, each delta, per-event, all events → ask: At {{daily_streams}} streams a day with hundreds of deltas each, what does shipping every event cost, and what do you summarise at the edge instead?
- when: ttft, time to first token → ask: A stream sends `message_start` in 300 ms and its first text delta 9 seconds later. What does your TTFT measure, and is that what the customer felt?
- when: average, mean gap, avg → ask: Why does an average inter-event gap hide stalls, and what would you compute instead?
- when: session window, gap window, timeout, watermark → ask: How long do you wait before a stream's record is final, and what happens to an event that arrives after that?
- when: sdk, client library, client-side → ask: Client timings come from customers' machines. How do you sample, trust and store them, and what does the platform do for customers who never send them?

**Production Reality Check.**
- A load-balancer change sets an idle timeout shorter than the server's ping interval. Streams with a long pause before their first delta are cut with no error event, and the inference servers' dashboards stay green because the servers finished their work.
- During an overload in one of the {{regions}} regions, 4% of streams end with an overloaded error event after content has started; client retries resend the whole request and roughly double that region's load.
- A gateway deploy flushes events through a 64 KB buffer instead of immediately. Server-side timings are unchanged, but time to first visible text rises by several seconds for short answers.
- Clock drift of 2 seconds on a subset of gateway hosts produces negative gaps on some streams and false stalls longer than {{stall_threshold}} on others.

**Evaluation Criteria.** Measures at the point that sees the client (gateway) and summarises per stream at the edge; precise definitions of first content, stall and end type with who closed first; per-stream records joined with server records by request id under bounded lateness, using one host's monotonic clock for durations; percentiles from mergeable sketches; per-event detail sampled and short-lived; content never in telemetry; organisation-scoped access; adapts to each incident with diagnosis, recovery and prevention.

## ANT-L4-02: Workspace spend limits and cost attribution

| | |
|---|---|
| **Template ID** | ANT-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Usage quotas and cost attribution / near-real-time enforcement, priced ledger |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer |

```params
{
  "daily_requests": {"2": ["300 million", "600 million"], "3": ["3 billion", "8 billion"]},
  "models": [5, 8, 12],
  "enforce_within": ["1 minute", "5 minutes"],
  "regions": [2, 3, 5]
}
```

**Business Scenario.** An organisation using a model API groups its API keys into workspaces, typically one per product team or environment. Each request's usage reports ordinary input tokens, output tokens, cache-write input tokens and cache-read input tokens. Prices are per model and per token class: cache writes cost more than ordinary input, cache reads much less, and requests sent through the asynchronous batch interface are discounted. Prices for some of the {{models}} models change a few times a year. Admins can set a monthly spend limit per workspace; once a workspace reaches it, further requests from its keys are rejected until the limit is raised or the month ends. Admins also want cost per API key and per workspace per day that matches the invoice exactly. The platform serves {{daily_requests}} requests a day from {{regions}} regions, and a crossed limit must take effect within {{enforce_within}}.

**Problem Statement.** Design (1) cost attribution from usage records to cost per API key, workspace, model and day, consistent with the invoice; (2) spend-limit enforcement on the request path within {{enforce_within}}; and (3) the admin reporting view with corrections. Cover the price catalogue and its versions, where cost is computed, how batch usage that completes hours after submission is counted, how far a workspace can overshoot, how {{regions}} regions share one limit, and what happens when the enforcement path is unavailable.

**Constraints.** The limit check adds under 2 ms at p99 and makes no synchronous cross-region call. Overshoot above a limit must be bounded and stated. Invoice amounts are exact in fixed-point currency units, never floating point. An API key belongs to one workspace at a time, but keys can be moved between workspaces or archived. Organisation-wide request and token-per-minute rate limits exist and are enforced by another system; you own spend only.

**Assumptions.** All volumes, prices and limits are hypothetical. The monthly invoice is produced from the same usage records. Each request has a unique request id, and usage is known in full only when the request finishes.

**Clarifications.**
- Q: Is a request's cost known before it runs? | A: No. Input tokens are known at admission; output, cache-write and cache-read tokens only when it finishes.
- Q: When does a batch request count against the limit and the invoice? | A: Assume when its result is produced, which can be up to 24 hours after the batch was created.
- Q: Can an admin raise the limit mid-month? | A: Yes, and requests should be accepted again within {{enforce_within}}.
- Q: A key moves to another workspace mid-month. Where does its cost go? | A: Usage stays with the workspace the key belonged to when the request was made.
- Q: Is the month in UTC? | A: Assume yes for this design.

**Hints.**
1. Separate the exact priced ledger (one record per request id, idempotent) from the fast approximate counter the request path reads.
2. Cost is tokens times the price in force when the request was made. Version the price catalogue by effective time and store the version on each record.
3. Output cost is unknown at admission. Decide whether you reserve an estimate or check after the fact, and compute the worst-case overshoot either way.

**Follow-ups.**
1. Walk one request from admission to its line on the invoice. Where is the price looked up, and where could the request be counted twice?
2. A workspace at 99.8% of its limit sends 2,000 concurrent long requests. How far can it overshoot under your design, and how would you shrink that?
3. A price change takes effect at midnight UTC while one region's usage stream is 40 minutes behind. Which price do the delayed requests get?
4. The counter store in one region is unavailable. Do you fail open or closed, for which workspaces, and for how long?
5. An admin's daily cost per key in the console differs from the invoice by 0.3%. Design the system so the gap can be explained line by line.

**Follow-up rules.**
- when: redis, counter, incr, in-memory → ask: After a regional failover the counter and the priced ledger disagree. Which one wins, and how is the counter corrected?
- when: reserve, reservation, estimate, max_tokens → ask: Reserving against the maximum output length blocks a workspace early when it sends many long-limit requests. When and how is the unused part released?
- when: float, double, decimal → ask: What numeric type holds cost at each stage, and where does rounding happen relative to the invoice?
- when: fail open, fail-open → ask: How much can one workspace spend while the check fails open, and who absorbs that cost?
- when: kafka, stream, event log, queue → ask: A usage record is delivered twice after a consumer restart. What key makes the priced record idempotent, and where is it enforced?

**Production Reality Check.**
- A price update for one of the {{models}} models was loaded with the cache-write and cache-read prices swapped, and has been live for 6 hours.
- An enterprise workspace keeps spending for 25 minutes after crossing its limit, far beyond {{enforce_within}}, because the counter in one of the {{regions}} regions stopped receiving usage after a consumer-group rebalance.
- A large batch created on the 30th completes on the 1st. The customer's finance team asks why its cost appears in the new month.
- An admin moves 40 API keys between workspaces mid-month, and the daily cost per workspace report counts their usage in both workspaces for that day.

**Evaluation Criteria.** Exact priced ledger keyed by request id, separate from a fast regional counter; versioned price catalogue with effective times, cost in fixed-point at a stated grain; key-to-workspace attribution as of request time; a stated overshoot bound with admission estimates or reservations and post-hoc reconciliation; regional budget allocation without synchronous cross-region calls; explicit fail-open or fail-closed policy; reports reconcile to the invoice by construction; adapts to each incident with diagnosis, recovery, customer remediation and prevention.

## ANT-L4-03: Safety signal monitoring and the human review queue

| | |
|---|---|
| **Template ID** | ANT-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Safety monitoring data / streaming aggregation, review prioritisation, privacy |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "daily_requests": {"2": ["200 million", "500 million"], "3": ["3 billion", "6 billion"]},
  "classifiers": [4, 8, 12],
  "review_capacity": ["1,500", "6,000"],
  "flag_retention": ["30 days", "90 days"]
}
```

**Business Scenario.** A model provider runs {{classifiers}} automated safety classifiers over traffic to its apps and API, each scoring requests or responses for one category of its usage policy. About {{daily_requests}} requests a day are scored. Individual scores are noisy; what matters are patterns: an account whose traffic is persistently flagged in one category, a sudden rise in one category across many unrelated accounts (a new misuse technique spreading), or a classifier whose flag rate shifts after a model or classifier update. A trust and safety team can review about {{review_capacity}} cases a day, and enforcement (a warning, restricting an account) requires a human review with evidence. Flagged material is kept for {{flag_retention}}; unflagged content is not kept for this purpose.

**Problem Statement.** Design the monitoring pipeline: collecting scores, aggregating them per account and category over time, detecting persistent patterns and cross-account spikes, a prioritised review queue that fits the team's capacity, the evidence a reviewer sees, feeding review decisions back into measures of classifier quality, and monitoring the classifiers themselves. Cover who can see what, retention, and failure handling.

**Constraints.** Scoring must not add noticeable latency to requests. Reviewers see the minimum content needed, only for queued cases, and every access is logged. Some enterprise organisations have agreements under which request content is not stored; for them only scores and metadata may be kept. Flagged material is deleted after {{flag_retention}}. No enforcement action is fully automatic.

**Assumptions.** Volumes, capacities, categories and retention are hypothetical. An account is an organisation, and within it an API key or an app user; actions can apply at either level. Thresholds per category are set by the safety team through reviewed configuration.

**Clarifications.**
- Q: Are classifier scores calibrated probabilities? | A: No. Each classifier has its own scale; thresholds are set per category.
- Q: Does one flagged request start a review? | A: Not on its own, except in the most severe categories. Patterns do.
- Q: Can a reviewer see a whole conversation? | A: Only the flagged turns with minimal context, unless they escalate with a recorded reason.
- Q: Who changes thresholds? | A: The safety team, through a reviewed change. Your platform must record which classifier version and threshold produced each flag.
- Q: How fast must a spreading pattern be seen? | A: Within an hour for a cross-account spike; daily is fine for slow persistent patterns.

**Hints.**
1. Separate per-request scores (huge volume, short-lived) from per-account aggregates over windows (small, and what drives review).
2. Rank the queue by expected harm and confidence, not arrival time. Review capacity is the binding constraint.
3. Every review decision is a label. Use labels to estimate each classifier's precision at its threshold, and watch for drift after model or classifier changes.

**Follow-ups.**
1. How do you find an account whose flag rate in one category is persistently high without flooding reviewers with large accounts that simply send more traffic?
2. A new misuse technique appears across 3,000 small accounts within an hour. What detects it, and what does the review queue look like?
3. A model version upgrade changes one classifier's flag rate by 40%. How do you tell a classifier shift from a real change in behaviour?
4. A reviewer asks to see an account's full history. What does your design allow, and how is it audited?
5. You only review what the pipeline flags. How do you estimate what it misses, and how much review capacity do you spend on that?

**Follow-up rules.**
- when: threshold, cutoff, fixed count → ask: Large accounts cross a fixed count just by sending more traffic. How do you normalise, and what does normalising do to very small accounts?
- when: store everything, keep all, log all, store the prompt → ask: The constraints limit what is kept. What exactly is stored for a request that was not flagged, and for how long?
- when: fifo, first come, arrival order → ask: Capacity is {{review_capacity}} cases a day and the queue grows faster. Which cases are never reviewed under arrival order?
- when: precision, recall → ask: Reviewers only see flagged cases. How do you estimate recall, and what sample of unflagged traffic would you review?
- when: automatic ban, auto-ban, block automatically, auto block → ask: Enforcement needs a human review. What may happen automatically before review, and what must not?

**Production Reality Check.**
- A classifier update changes its score scale. Flags in its category rise 9× within an hour, and the queue, sized for {{review_capacity}} cases a day, fills with low-value cases.
- Flagged excerpts from an enterprise organisation whose agreement forbids storing content are found in the evidence store, 3 days after they were written.
- A coordinated pattern spreads across thousands of new accounts, each below the per-account threshold, for two days before anyone notices.
- The scoring service falls behind during a traffic peak; 6 hours of scores arrive late and the per-account windows for that period were already closed and acted on.

**Evaluation Criteria.** Scoring asynchronous to the request path; versioned classifiers and thresholds recorded on every flag; per-account, per-category windowed aggregates normalised for volume, plus cross-account spike detection keyed on category and shared features; a capacity-aware queue ranked by severity and confidence with sampled review of unflagged traffic for recall; minimal, logged reviewer access and content rules enforced before storage; retention enforced and checked; classifier monitoring with label feedback; adapts to each incident with diagnosis, recovery and prevention.

## ANT-L4-04: Prompt-cache effectiveness analytics

| | |
|---|---|
| **Template ID** | ANT-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Prompt-cache analytics / counterfactual cost, miss attribution, privacy-safe identifiers |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "daily_requests": {"2": ["150 million", "400 million"], "3": ["2 billion", "5 billion"]},
  "cached_share": ["30%", "55%", "70%"],
  "freshness": ["15 minutes", "1 hour"],
  "regions": [2, 3, 5]
}
```

**Business Scenario.** A model API lets callers mark cache breakpoints in a prompt; the prefix up to a breakpoint is cached for a short lifetime that is refreshed each time it is read. Each response's usage reports cache-write input tokens, cache-read input tokens and ordinary input tokens: writes are billed above the ordinary input price, reads well below it. About {{cached_share}} of the {{daily_requests}} requests a day, served from {{regions}} regions, set breakpoints. Many customers get fewer hits than they expect: a timestamp at the top of the system prompt, tool definitions serialised in a different order, a prefix below the minimum cacheable length, or requests spaced further apart than the cache lifetime. The product team wants a cache-effectiveness view per workspace and API key, with likely miss reasons, estimated savings and spend wasted on writes that were never read, within {{freshness}}.

**Problem Statement.** Design the telemetry and analytics behind that view: what the serving layer records about cached prefixes for each request (without content); how hits and misses are attributed to reasons; how savings are computed against a no-cache counterfactual; how results are aggregated per organisation, workspace, key, model and hour and served to customers in a console; how the same data helps capacity planning for cache memory; and how all of it stays private.

**Constraints.** No prompt content, and nothing from which content could be recovered, leaves the serving path. Prefix identity may be represented only by a hash salted per organisation. Assume caches are never shared between organisations. Token counts shown must match billed usage exactly; savings estimates may be approximate if labelled. Customers see only their own organisation.

**Assumptions.** All figures and prices are hypothetical. Cache lifetime and minimum cacheable length are configuration of the serving system. On each request the serving layer knows which breakpoints were read, which were written, and why a lookup failed when it can tell.

**Clarifications.**
- Q: Can the serving layer tell an expired entry from one never written? | A: Only if it remembers recently expired prefix hashes. Assume it can keep a short list of them if your design needs it.
- Q: Do customers care about hit rate or money? | A: Money first; hit rate is how they debug.
- Q: Can customers see prefix hashes? | A: Only within their own organisation and only as an opaque id that cannot be compared across organisations.
- Q: Is a write that is never read waste? | A: Yes. A write costs more than ordinary input, so an unread write costs more than not caching at all.
- Q: How detailed must the view be? | A: Per workspace, API key, model and hour, plus a top list of prefix ids by wasted spend.

**Hints.**
1. The counterfactual cost of a request without caching is all of its input tokens at the ordinary price. Savings are counterfactual minus actual, and can be negative.
2. Miss reasons need state across requests: the last time this organisation used the same prefix hash, and where its prompt diverged from the last cached one.
3. Hash prefixes block by block (cumulatively) so you can tell where two prompts diverge without storing either.

**Follow-ups.**
1. How do you attribute a miss to "prefix changed", "expired" or "below minimum length", and how confident is each label?
2. A customer's hit rate is 4% and they insist their prompts are identical. What does your console show them?
3. How would you estimate what a customer saves by moving a timestamp out of the system prompt, or by spacing requests differently?
4. The capacity team asks how much cache memory a longer lifetime option would need. Can you answer from this data, and what is missing?
5. Show that per-organisation salted hashes cannot reveal that two organisations use the same prompt, including to your own analysts.

**Follow-up rules.**
- when: hash, sha, fingerprint → ask: How is the salt scoped and rotated, and what happens to week-over-week comparisons when it rotates?
- when: hit rate, hit ratio → ask: A key has a 90% hit rate but loses money on caching. How is that possible, and which metric would show it?
- when: join, previous request, lag, last seen → ask: Requests with the same prefix are served in several regions. Where does per-prefix state live, and what happens to miss attribution across regions?
- when: sample, sampling, approximate → ask: Token totals in the console must match billing exactly. Which numbers may come from samples, and which may not?

**Production Reality Check.**
- A popular open-source agent framework release starts inserting the current time at the start of the system prompt. Within a day cache-read tokens fall 60% across thousands of workspaces and write spend rises.
- A serving deploy shortens the memory of expired prefixes, so most misses are labelled "never written" and the console tells customers their prompts change when they actually expire.
- For one day the console's cache-read token total for a large workspace is 2% below the invoice: usage from one of the {{regions}} regions arrived more than {{freshness}} late and was never re-aggregated.
- Salt rotation changes every prefix id at once; customers' "top wasted prefixes" lists reset and support receives tickets asking what happened.

**Evaluation Criteria.** Per-request cache telemetry with cumulative per-block salted hashes and no content; billed token classes carried exactly and reconciled with billing; counterfactual savings and unread-write waste per key and hour; miss attribution through per-organisation prefix state with confidence and a short expired-prefix memory; late-data re-aggregation; organisation-scoped serving with opaque ids; salt rotation planned; capacity view of working-set size; adapts to each incident with diagnosis, recovery and prevention.

## ANT-L4-05: Privacy-preserving insight into how an assistant is used

| | |
|---|---|
| **Template ID** | ANT-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy-preserving analysis / aggregation thresholds, model-assisted extraction, retention |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "weekly_conversations": {"2": ["5 million", "20 million"], "3": ["100 million", "300 million"]},
  "min_accounts": [25, 50, 100],
  "retention_days": [7, 30],
  "languages": [10, 25, 40]
}
```

**Business Scenario.** Product, safety and policy teams want to understand, in aggregate, what people use an AI assistant for: which tasks, in which of {{languages}} languages, and how that shifts after a model release, without anyone reading individual conversations. The proposed approach: inside a restricted environment, a model reads each sampled conversation and extracts short, non-identifying facets (task, language, a one-line topic summary); facets are embedded and clustered; a model describes each cluster; and only clusters containing at least {{min_accounts}} distinct accounts are ever reported. About {{weekly_conversations}} conversations a week are in scope under a policy that defines which conversations may be used; enterprise and API traffic are out of scope.

**Problem Statement.** Design the pipeline end to end: scoping and sampling; the restricted extraction stage; privacy layers (extraction instructions that omit identifying details, the distinct-account threshold, a final privacy check on cluster descriptions); clustering into a browsable hierarchy; storage and retention of every intermediate; the outputs and who sees them; how privacy and accuracy are evaluated; and cost per weekly run.

**Constraints.** No person reads raw conversations in this pipeline. Facets and embeddings are deleted after {{retention_days}} days; only threshold-passing aggregates are kept longer. No cluster with fewer than {{min_accounts}} distinct accounts may be shown, including by subtracting one report from another. When a user deletes a conversation, it must leave every intermediate that still exists. Model calls have a fixed weekly budget.

**Assumptions.** All volumes, thresholds, budgets and retention periods are hypothetical. Accounts have stable pseudonymous ids inside the restricted environment.

**Clarifications.**
- Q: Is the threshold on conversations or accounts? | A: Distinct accounts. One account with 500 conversations is one account.
- Q: Can analysts filter by language or date? | A: Only along dimensions approved in advance, and the threshold applies after every filter.
- Q: How do we know facets carry no personal details? | A: That is part of your design; propose how you would measure it.
- Q: How often does it run? | A: Weekly; release comparisons are week over week.
- Q: Who sees the output? | A: Named internal teams through a dashboard; nothing below the threshold, and no drill-down to conversations.

**Hints.**
1. Treat every stage as a privacy layer that can fail, and measure each one separately.
2. Applying the threshold after every filter, and limiting which filters exist, is what stops differencing.
3. Validate the whole pipeline on synthetic conversations whose true distribution and planted identifying details you know.

**Follow-ups.**
1. How do you sample so that small languages and rare tasks still have usable precision, and how is the uncertainty shown?
2. An analyst runs the report for two overlapping date ranges and subtracts. How does your design stop a sub-threshold cluster leaking?
3. How do you test that the facet extractor never outputs names, contact details or rare identifying facts, and what is the acceptance bar?
4. A user deletes a conversation the day after the weekly run. What changes, and what does not need to?
5. Leadership wants to compare usage before and after a model release. What makes that comparison fair, and what would make it misleading?

**Follow-up rules.**
- when: k-anonymity, k anonymity, threshold → ask: The threshold counts accounts per cluster. What about a filter applied after clustering, or two clusters that differ by a handful of accounts?
- when: differential privacy, noise, epsilon → ask: What do you add noise to, how is the budget spent across weekly releases, and what does it cost small clusters in usefulness?
- when: embed, embedding, cluster, k-means → ask: Re-clustering each week changes cluster ids. How do you track a theme across weeks without keeping anything that identifies an account?
- when: store, keep, retain, retention → ask: Which intermediates exist after {{retention_days}} days, and how would you prove the rest are gone?

**Production Reality Check.**
- A prompt change to the facet extractor raises the share of facets naming a company or person from 0.1% to 3%; the weekly report shipped with three cluster descriptions that name a small business.
- A cluster with 12 distinct accounts, below the {{min_accounts}}-account threshold, appears in the dashboard because a new language filter was applied after the threshold check.
- The weekly run's model spend doubles because a retry loop re-extracts conversations that already have facets.
- An auditor asks for proof that facets older than {{retention_days}} days are gone, including a debugging copy an engineer made two months ago.

**Evaluation Criteria.** Scope and sampling stated with uncertainty; extraction confined to a restricted environment with identifying details excluded by instruction and verified by measurement; distinct-account threshold applied after every filter, with a fixed set of approved dimensions to stop differencing; a final privacy check on descriptions; idempotent, budgeted model stages; retention and deletion propagated to every intermediate with evidence; synthetic-data evaluation of privacy and accuracy; adapts to each incident with diagnosis, recovery and prevention.
