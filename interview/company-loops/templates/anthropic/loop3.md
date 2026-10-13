# Anthropic · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a frontier AI model
provider: Claude models offered through apps, an API (the Messages API, streaming,
tool use, prompt caching, workspaces) and enterprise plans. These are not questions
from the company's interviews, and they describe no non-public system. Every workload,
number, schema and incident is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ANT-L3-01: Streamed responses — event schema and time-to-first-token facts

| | |
|---|---|
| **Template ID** | ANT-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / streaming event schema, grains, latency facts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "daily_streams": {"1": ["5 million"], "2": ["60 million", "120 million"], "3": ["400 million", "900 million"]},
  "events_per_stream": [150, 600, 2500],
  "raw_retention": ["7 days", "30 days"],
  "sample_rate": ["1%", "10%"]
}
```

**Business Scenario.** A model API can stream its responses. Instead of one JSON body, the client receives a sequence of server-sent events: as public documentation describes them, a message start, then for each content block (text, a tool call's JSON input, or extended thinking) a block start, many deltas and a block stop, then a message delta carrying the stop reason and the final usage counts, and a message stop. Keep-alive pings can be interleaved, and an error event can arrive in the middle of a stream (for example when the service is overloaded). In this scenario the platform serves about {{daily_streams}} streamed requests a day, averaging {{events_per_stream}} events each, and the serving fleet emits one telemetry record per event. Product and infrastructure teams want time to first token, output speed, stalls and stop reasons by model, workspace and hour.

**Problem Statement.** Design the data model from raw stream telemetry to analytical facts. Define: the telemetry event's schema (envelope, keys, ordering, and what a delta record stores, given that it must not store text); what is kept at event grain, for how long ({{raw_retention}}) and for which share of streams ({{sample_rate}}); the per-stream summary fact and the per-content-block fact, with their grains and columns; precise definitions of time to first token, time to last token, output tokens per second and the longest gap between deltas; and how a stream that never finishes (client disconnect, mid-stream error, host failure) is represented.

**Constraints.** No response text, thinking text or tool input is stored anywhere in the analytical model: only types, sizes, counts and timings. Every stream has exactly one summary row, including streams that never send a message stop. Hourly time-to-first-token percentiles by model must be available within 15 minutes of the hour ending. Event-grain data at {{daily_streams}} × {{events_per_stream}} events a day cannot be kept in full.

**Assumptions.** Volumes, rates, retention and the 15-minute target are hypothetical. Event names follow the public documentation in general terms. Telemetry is emitted server-side, each record carries the stream id, a per-stream sequence number and a timestamp from the serving host; what happens on the client after the bytes leave is not observable.

**Clarifications.**
- Q: When does the clock for time to first token start? | A: You define it. The time the request was accepted and the time the first byte of the response was sent are both recorded; say which you use and keep queueing time visible separately.
- Q: Does a thinking block or a tool call's first delta count as the first token? | A: Decide and name it. Product wants "first visible text"; infrastructure wants "first token of any kind". Both may be needed.
- Q: Does the pipeline receive events in order? | A: Mostly. They arrive through a log partitioned by stream id, but retries can duplicate and reorder records within a stream.
- Q: What does the message delta carry? | A: The stop reason (for example end of turn, max tokens reached, a stop sequence or a tool use) and cumulative usage counts.
- Q: Can a stream resume after a disconnect? | A: Not in this scenario. A disconnect ends it.

**Hints.**
1. Separate three grains: the stream (one row per request), the content block (one row per block per stream) and the event (one row per event, sampled and short-lived). Most questions need only the first two.
2. Compute the timing columns once, when the stream closes, from its full event sequence: first delta, first text delta, last delta, delta count, longest gap. Then the deltas themselves can be dropped.
3. Sample by stream id, all or nothing, never event by event, so a sampled stream can still be replayed end to end.

**Follow-ups.**
1. Write the exact definitions of time to first token and output tokens per second, including a stream whose first block is thinking and a stream with zero output tokens.
2. A stream never sends message stop: the client disconnected or the host died. When is its summary row written, by whom, and what does it say?
3. Why can hourly p95 not be computed by averaging per-host p95 values, and what do you store so that hourly and daily percentiles are exact or have a known error?
4. A stall alert must fire when more than 0.5% of a model's streams have a gap above 5 seconds between deltas. Which grain does it read, and how soon after a stall can it fire?
5. A new content block type ships next quarter. Show how the event contract and the summary fact evolve without breaking existing dashboards.

**Follow-up rules.**
- when: one row per event, every event, all events, delta table → ask: At {{daily_streams}} streams a day and {{events_per_stream}} events each, what does that table cost to store and scan for {{raw_retention}}, and which question actually needs it?
- when: sample, sampling, sample rate → ask: Do you sample events or streams? Show what event-level sampling does to the longest gap and the first-token time of a sampled stream.
- when: message_start, message start, first event → ask: The message start event is sent before the model produces any content. Is time to message start a useful first-token metric, and what would it hide?
- when: average, avg(, mean ttft, mean latency, mean time → ask: Your dashboard shows mean time to first token. What does the mean hide that p95 and p99 show, and how do you combine percentiles across hours?
- when: timestamp order, order by timestamp, event time → ask: Two events of one stream carry the same millisecond, and a retry delivers one of them twice. What orders them, and what removes the duplicate?

**Production Reality Check.**
- A serving release starts sending the message start event before the request leaves the queue. The dashboard, which measures time to first token to the first event of any type, shows a 40% improvement nobody shipped.
- About 2% of a day's streams have no summary row because the summariser writes one only on message stop. Most of the missing streams ended in a mid-stream overload error, so the error rate on the dashboard is too low exactly when it matters.
- Event records were sampled at {{sample_rate}} one by one instead of by stream. Sampled streams now show gaps between deltas many times longer than real, and the stall alert fires every afternoon at peak.

**Evaluation Criteria.** Clear grains (stream, content block, event) with event data sampled by stream and kept {{raw_retention}}; named, precise first-token variants with queueing time separate; one summary row per stream including incomplete ones, closed by a timeout or a terminal event; idempotent, order-tolerant assembly by stream id and sequence number; no content stored; percentile-friendly storage (histograms or mergeable sketches); a versioned event contract; each incident traced to the grain or definition that caused it.

## ANT-L3-02: Tool-use calls across stateless requests

| | |
|---|---|
| **Template ID** | ANT-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / tool-use telemetry, linking calls to results, agent runs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "daily_requests": {"1": ["3 million"], "2": ["40 million"], "3": ["200 million", "500 million"]},
  "tool_share": ["15%", "35%", "60%"],
  "max_parallel": [2, 5, 10],
  "tools_per_workspace": ["about a dozen", "a few hundred"]
}
```

**Business Scenario.** Developers give the model tools by sending each tool's name, description and JSON input schema with a request. When the model decides to use tools, the response ends with a tool-use stop reason and contains one or more tool-use blocks, each with its own id, the tool's name and an input. The developer's code runs the tools and sends a new request whose user turn carries a tool-result block for each tool-use id it answers (with the result, or flagged as an error). The API is stateless: every request resends the conversation so far. In this scenario about {{tool_share}} of the platform's {{daily_requests}} daily requests carry tools, a response can contain up to {{max_parallel}} tool calls at once, and a workspace typically defines {{tools_per_workspace}} tools. The platform wants to show developers and product teams tool error rates, how many round trips an agentic task takes, how often a tool call is never answered, and how long the round trip through the developer's code takes.

**Problem Statement.** Design the data model for tool-use telemetry. Define the entities (request, response, tool definition, tool call, tool result, and an "agent run" if you introduce one); how a tool result in one request is linked to the call that a previous response emitted, without a conversation id; how resent history is recognised so that nothing is counted twice; how tools are identified and versioned; and the facts that serve the four metrics above, with their grains and exact definitions.

**Constraints.** Tool descriptions, inputs and results are customer content: the analytical model keeps only names, schema fingerprints, sizes, error flags, validity and timings. Each tool call is counted once, although its block is resent in every later request of the conversation. Metrics are reported per workspace and per tool. A tool's name is unique only within one request's tool list.

**Assumptions.** Volumes and shares are hypothetical. Tool-use ids are unique strings generated per call. A request may carry an opaque end-user identifier in its metadata if the developer chooses to send one; many do not. In this scenario only tools that the developer runs (client tools) are in scope.

**Clarifications.**
- Q: Is there a conversation or session id? | A: No. The API is stateless; you see each request in full and nothing else.
- Q: How do I know which call a tool result answers? | A: Each tool-result block names the tool-use id it answers.
- Q: Can a developer edit history before resending it? | A: Yes. They can drop, summarise or rewrite earlier turns, so a request is not guaranteed to extend the previous one exactly.
- Q: Is a tool's name stable? | A: Within a workspace usually, but two workspaces can give different tools the same name, and a tool's schema can change under the same name.
- Q: What counts as a tool error? | A: A tool result the developer flags as an error. Separately, a tool-use input that does not match the declared schema is worth tracking.

**Hints.**
1. Make the tool call the central fact: one row per tool-use id, opened when the response that emitted it is logged and completed when a result naming that id is first seen.
2. Each request resends history. A tool-use id or tool-result block you have already recorded is history, not a new event; key on the ids, not on positions.
3. Identify a tool by (workspace, name, schema fingerprint), not by name alone, and keep its versions.

**Follow-ups.**
1. Define an agent run precisely enough to count "tool calls per run" without a conversation id. What breaks your definition?
2. A response contains {{max_parallel}} parallel tool calls and the next request answers only some of them. How are the others represented, and when do you declare a call unanswered?
3. The same tool-result block appears in five later requests. Show how it is recorded once, and which time is the result time.
4. A workspace changes a tool's input schema under the same name. How do error-rate trends stay comparable?
5. Product asks for a "task success rate" for agentic runs. What would you need that the API traffic does not contain, and what can you honestly report instead?

**Follow-up rules.**
- when: conversation_id, conversation id, session id, session_id → ask: The API has no conversation id. Where would yours come from, and what happens to it when a developer edits history?
- when: hash the history, prefix hash, hash of messages, hash of the conversation → ask: The developer summarises earlier turns before resending. What does your prefix hash do then, and how do you still link the tool result?
- when: tool name, by name, group by name → ask: Two workspaces both have a tool called `search` with different schemas. What does your per-tool error rate mean?
- when: store the input, tool input, store the result, payload → ask: Tool inputs and results are customer content. What do you keep instead, and how do you still investigate a schema mismatch?
- when: latency, duration, execution time → ask: The gap between a response and the next request includes the developer's tool, their own processing and the network. What can you honestly call that number?

**Production Reality Check.**
- A widely used client library retries timed-out requests with identical bodies. Tool results are now seen twice within seconds, and for some workspaces "answered calls" exceeds "calls".
- The unanswered-call rate for a group of workspaces jumps from 3% to 28% overnight after their agent framework starts summarising history and dropping old tool-use blocks; their tools did not change.
- A developer runs {{max_parallel}} parallel calls and returns the results in a different order from the calls. A pipeline that paired calls and results by position recorded correct results against the wrong tools, and two tools' error rates swapped.

**Evaluation Criteria.** Tool call as the central fact keyed by tool-use id; results linked by id, first-seen semantics, duplicates absorbed; resent history recognised by ids, not positions; tools identified by workspace, name and schema fingerprint; an honest, stated definition of agent run and of round-trip time; unanswered calls with a defined timeout; no customer content stored; each incident explained by the linking rule it broke.

## ANT-L3-03: Enterprise seats, directory changes and adoption reporting

| | |
|---|---|
| **Template ID** | ANT-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / SCD type 2, member identity, effective-dated seats, periodic snapshots |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "tenants": {"1": ["300"], "2": ["4,000"], "3": ["20,000", "60,000"]},
  "largest_tenant_seats": ["2,000", "40,000", "150,000"],
  "directory_sync": ["hourly", "daily"],
  "attribute_purge_days": [30, 90]
}
```

**Business Scenario.** An AI assistant is sold to organizations on seat-based enterprise plans. An organization's admins give members seats either by hand or through directory sync from the organization's identity provider, which runs {{directory_sync}} and supplies attributes such as department, manager, cost centre and employment status. Members use the assistant on web, desktop and mobile. In this scenario there are {{tenants}} enterprise organizations, the largest with {{largest_tenant_seats}} seats. Each organization's admins want seats purchased versus assigned versus active, weekly active members by department and surface, and adoption curves for new cohorts; the account team wants the same across all organizations; and billing trues up each quarter on the peak number of assigned seats. Members leave, are deprovisioned, and sometimes return; departments are reorganised; occasionally two organizations merge after an acquisition.

**Problem Statement.** Design the data model behind these reports. Define: the organization and the member (and what identifies a member over time); directory attributes as history; seat assignments as effective-dated intervals; the activity fact and its grain; precise definitions of an active member, seat utilisation and the quarterly peak; the rule that attributes activity to a department; how late or wrong directory changes are absorbed; what happens to a deprovisioned member's personal attributes after {{attribute_purge_days}} days while billing history remains; and how a merger of two organizations is represented.

**Constraints.** No conversation content enters this model: activity is counts by member, day and surface. A quarter's billed peak never changes after the quarter closes. Department reports attribute activity to the department the member was in on the day of the activity. Personal attributes of a deprovisioned member (name, email, manager) are removed {{attribute_purge_days}} days after deprovisioning; seat and activity counts stay.

**Assumptions.** Tenant counts, seat counts, the purge period and the quarterly peak rule are hypothetical (real plans and contracts differ). Directory sync delivers the current attributes of each member, without an effective date unless the identity provider supplies one. Times are UTC; organizations report in their own time zone.

**Clarifications.**
- Q: Is a member identified by email? | A: Emails can change (a name change) and can be reused (a returning contractor). The platform assigns its own member id; with directory sync the identity provider's user id is also available.
- Q: What counts as active? | A: You define it. Product suggests at least one message sent by the member that day, on any surface.
- Q: Can a member use the assistant without an assigned seat? | A: Not normally, but activity in the minutes after a seat is removed can still arrive, and trials grant temporary access.
- Q: How is the quarterly peak measured? | A: You define the sampling: per day, per hour or exact intervals. Say why; billing will read it for years.
- Q: Can admins see what members wrote? | A: Not in this model. It is usage analytics only.

**Hints.**
1. Separate four things: the member (a stable surrogate key), directory attributes (type-2 history), seat assignments (intervals with start and end) and activity (a fact at member × day × surface).
2. Join activity to the attribute row valid on the activity date. A late directory change then restates a known set of days, which you can list and report.
3. Billing reads an immutable artefact closed at quarter end (a periodic snapshot or a frozen interval table), never the live assignment table.

**Follow-ups.**
1. Define weekly active members and seat utilisation precisely. What do you do with activity on a day the member held no seat?
2. A sync that arrives on Thursday says a member moved department on Monday. Which rows change, and which already-published weekly numbers move?
3. The quarterly true-up bills the peak of assigned seats. Which table answers it, how is it computed, and why can it not change after close?
4. A member is deprovisioned and, after {{attribute_purge_days}} days, their personal attributes must go while billing history stays. Show the rows before and after.
5. Two organizations merge after an acquisition, and some people had seats in both. Model the merge so history before it stays correct and reports after it show one organization without double counting.

**Follow-up rules.**
- when: email, by email, email as key → ask: A contractor leaves and returns six months later with the same email; another member's email changes after a name change. What is your member key, and what do the cohort reports show for each?
- when: current department, latest department, join to the directory → ask: A member moved from Sales to Support last week. Which department does their activity from last month land in, and is that what the admin expects?
- when: scd, type 2, valid_from, valid_to → ask: The sync delivers a change late, effective three days ago. How does your type-2 table absorb it without overlapping intervals, and which published numbers change?
- when: count distinct, distinct users, active users, active members → ask: Weekly active is a distinct count over days. How do you get monthly active members without re-scanning activity, and why can you not add up weeks?
- when: snapshot, daily snapshot, periodic snapshot → ask: Your seat snapshot is taken at midnight UTC. A member is assigned at 09:00 and removed at 17:00 the same day. Is that seat in your peak, and should it be?

**Production Reality Check.**
- One {{directory_sync}} sync cycle sends an empty department for 30% of a large organization's members. The type-2 history records them all moving to "no department" and back, and that week's active-by-department report shows one department collapsing to a third of its size.
- An organization re-provisions 1,200 returning contractors with their old emails. The model creates new member ids, the adoption report counts them as new adopters, and billing counts their seats twice for the day on which old and new records overlapped.
- After an acquisition, two organizations are merged mid-quarter. The quarter's peak seat count adds both organizations' peaks although they occurred on different days, and members with seats in both are counted twice.

**Evaluation Criteria.** Stable member surrogate key with identity-provider id and email as attributes, plus a rule for returning members; directory attributes as type-2 history with late changes absorbed and restatements listed; seat assignments as intervals and an immutable quarter-close artefact; activity at member × day × surface with no content; precise definitions of active, utilisation and peak; department attribution as of the activity date; purge of personal attributes that keeps counts; an explicit merge model; each incident handled with validation of incoming syncs, identity resolution and correct peak computation.

## ANT-L3-04: Model aliases, snapshots and version comparison on production traffic

| | |
|---|---|
| **Template ID** | ANT-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned dimensions, alias history, confounded comparisons |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "apps": [6, 25, 80],
  "daily_requests": {"2": ["12 million"], "3": ["60 million", "150 million"]},
  "snapshots_in_use": [3, 5, 9],
  "feedback_rate": ["0.5%", "4%"]
}
```

**Business Scenario.** A company runs {{apps}} applications on a model API, about {{daily_requests}} requests a day. Models are published as dated snapshots; an alias names a model's latest snapshot and moves when a newer one is released; older snapshots are deprecated and later retired on announced dates. Some applications pin a snapshot and some call an alias. Across the company {{snapshots_in_use}} snapshots are in use at once. Teams want to compare versions on their own traffic: latency, cost per request, stop reasons, user feedback (about {{feedback_rate}} of responses get a rating) and offline evaluation scores on sampled traffic, and the platform team must know who still depends on a snapshot that is about to retire.

**Problem Statement.** Design the data model for model-version comparison. Cover: the model snapshot dimension and its lifecycle dates; the alias history and where its validity times come from; the request fact (what the application asked for, what served it, which application, key and prompt template version); feedback and evaluation facts that arrive later; experiment assignments where a team randomises; and the queries that answer "is snapshot B better than snapshot A for this application" and "which applications, keys and templates still reach a snapshot retiring on a given date".

**Constraints.** Each request is attributed to the snapshot that served it, never only to the name it asked for. A comparison holds the application and prompt template version fixed, or says plainly that it does not. Feedback can arrive up to 7 days after the response. The retirement report must list every dependent application at least 60 days before the retirement date.

**Assumptions.** Volumes, counts and rates are hypothetical. In this scenario each response names the model that served it, and every request is logged with the application, API key and workspace that sent it. Prices are effective-dated per model and may differ between snapshots.

**Clarifications.**
- Q: Does the response say which snapshot served an alias request? | A: In this scenario, yes. Log it on every request.
- Q: When does an alias move? | A: When a newer snapshot is released. Record the announcement, and also the time you first observed a response from the new snapshot.
- Q: Is user feedback representative? | A: No. About {{feedback_rate}} of responses get any rating, and unhappy users rate more often.
- Q: Do applications run controlled experiments? | A: Some randomise by end user with an assignment table; most simply switch.
- Q: Do snapshots write answers of the same length? | A: Not necessarily. A newer snapshot may write longer or shorter answers for the same prompt.

**Hints.**
1. Log `requested_model` and `served_snapshot` as two columns. The alias history can be derived from them; you never need to guess which snapshot an alias meant.
2. Version the prompt template and log its version on every request. A model switch and a template change on the same day are confounded unless you can separate them.
3. Compare within strata (application, template version, task type) and weight to a common mix, or use the randomised assignment when one exists.

**Follow-ups.**
1. An application called an alias all month and the alias moved on the 12th. Write the logic for "latency by snapshot" and for "latency by what the application asked for", and say who needs each.
2. A snapshot's feedback is 3 points worse, but most of its traffic is a new, harder task type. How does your model expose the mix shift?
3. A snapshot retires in 90 days. Produce the list of applications, keys and templates still using it, including any that reach it through an alias.
4. Design the experiment tables so a 50/50 comparison stays valid when requests in one arm fail and retry more often.
5. With {{snapshots_in_use}} snapshots across {{apps}} applications, how does the comparison dashboard avoid inviting conclusions from tiny cells?

**Follow-up rules.**
- when: model column, model name, group by model → ask: Is that the name the application asked for or the snapshot that served it? What happens to your comparison the day an alias moves?
- when: thumbs, feedback, rating → ask: Only {{feedback_rate}} of responses get a rating, and unhappy users rate more. How do you compare two snapshots fairly with it?
- when: a/b, experiment, randomize, randomise → ask: What is the unit of randomisation, and what happens to your comparison if one arm times out and retries more?
- when: scd, type 2, valid_from → ask: Where do your alias history's valid_from times come from: the announcement, or the first response you saw from the new snapshot? When do they differ?
- when: average latency, mean latency, total latency → ask: The newer snapshot writes longer answers. Is a higher total latency a regression? Which latency would you compare?

**Production Reality Check.**
- The alias that most of the {{apps}} applications call moved to a new snapshot on a Tuesday. A dashboard keyed on the requested model name shows a step change in latency and cost for "the same model", and one application team files a regression against its own code.
- The largest application shipped a new prompt template version on the same day it pinned a newer snapshot. Its feedback rate drops, and two teams each blame the other's change.
- A retirement report built from pinned snapshot names misses four applications that reach the retiring snapshot through an older alias that has not moved since it was released.

**Evaluation Criteria.** Requested name and served snapshot logged separately; snapshot dimension with release, deprecation and retirement dates; alias history derived from observations with announcement time kept apart; prompt template version on every request; late-arriving feedback and evaluation facts keyed by request; stratified or randomised comparisons with honest statements of confounding and of feedback bias; a retirement report from served snapshots; each incident traced to the missing column or definition.

## ANT-L3-05: Weekly task-category counts with small cells merged into “other”

| | |
|---|---|
| **Template ID** | ANT-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / aggregation thresholds, suppression into other, deletion and retention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |
| **Generator** | ANT-L3-05.mjs |

**Business Scenario.** An AI assistant platform publishes aggregate insight into what people use it for: weekly counts of conversations by task category. No person reads conversations for this: an automated classifier assigns each conversation a task category, and only that label, a pseudonymous user key, the organization and timestamps reach the analytics model below. So that no individual or organization can be singled out, a (week, category) cell is published only when it covers enough distinct users and organizations; smaller cells are merged into one `other` row per week, which must clear the same threshold. Users can delete conversations, and organizations can opt out of analysis.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, task_category, conversations, users, orgs`, ordered by `week_start, task_category`. The rules:
- {{window_rule}}
- A conversation counts when its organization has not opted out (`orgs.analytics_opt_out` is false), it has no row in `deletion_requests` (whatever the request's time), and it has a category. {{facet_rule}} A conversation with no facet row is unclassified and is not counted anywhere, not even in `other`.
- `week_start` is the date of the Monday (UTC) of the week containing the conversation's `created_at`.
- For each (week, category): `conversations` is the number of counted conversations, `users` the number of distinct `user_key`, `orgs` the number of distinct `org_id`. {{threshold_rule}}
- All the cells of a week that are not publishable are merged into one row with `task_category = 'other'`. Its `conversations`, `users` and `orgs` are counted over the union of those cells' conversations (distinct users and organizations, never sums of the cells' counts). The `other` row is returned only when it meets the same threshold. A week whose cells are all publishable has no `other` row. No real category is called `other`.

**Constraints.** One SQL statement (CTEs allowed). PostgreSQL. The sample has {{conversations}} conversations; production has hundreds of millions a week, so be ready to say how you would compute this incrementally.

**Assumptions.** Hypothetical schema, categories, thresholds and volumes. Real aggregation thresholds are far larger; small ones keep the sample readable. A `user_key` is a pseudonymous key that belongs to one organization. Timestamps are UTC.

**Clarifications.**
- Q: Are the thresholds inclusive? | A: Yes. A cell with exactly the minimum number of distinct users (and organizations) is published.
- Q: A user appears in two unpublishable categories in the same week. How many users does `other` have from them? | A: One. Count distinct keys over the merged conversations.
- Q: A deletion was requested after the report time. Is the conversation counted? | A: No. A deletion is honoured whenever the report is run.
- Q: A conversation was created at exactly Monday 00:00:00 UTC. Which week? | A: The week that starts at that moment.
- Q: Which time decides the week: creation or classification? | A: Creation. Classification time only decides which facet row is the conversation's category.

**Hints.**
1. Settle every conversation first, in one CTE with one row per conversation: is it counted, what is its category, which week is it in. Then aggregate.
2. Decide publishability per cell, then build `other` from the conversations of the cells that failed, by joining back to them. Adding up the failed cells' user counts is wrong.
3. At Hard and above, `DISTINCT ON (conversation_id) … ORDER BY conversation_id, classified_at DESC` picks one facet row per conversation.

**Follow-ups.**
1. Suppose you also published each week's total. Could a reader recover a suppressed cell? What does merging into `other` protect, and what would still leak?
2. Make it incremental: a deletion arrives for a conversation in a week already published. What do you store, what do you recompute, and what do you republish?
3. A category is suppressed one week and published the next at exactly the threshold. Is there a differencing risk across weeks or across overlapping reports, and would you add rounding or noise?
4. Retention says data older than the window must not be used, but last quarter's published report was computed from it. What do you keep, and what do you tell someone who asks to reproduce that report?

**Follow-up rules.**
- when: sum(users), sum(cnt), sum of users, sum(user → ask: Your `other` row adds up the users of the suppressed cells. A user in two of them is counted twice. What does that do to the threshold check?
- when: left join, coalesce(task_category → ask: Your LEFT JOIN keeps conversations that have no facet row. Where do they end up, and should they be counted at all?
- when: having count, having sum, having users, having (count, having (sum → ask: HAVING removes the small cells. Where do their conversations go, and how do you build `other` from them?
- when: date_trunc, extract(week, isoweek, week( → ask: Which day does your week start on, and in which time zone? What would BigQuery's default WEEK part give you?
- when: distinct on, row_number, max(classified_at) → ask: Do you pick the latest facet among all rows, or among the rows that existed at the report time? Which one lets you reproduce the report?

**Production Reality Check.**
- The deletion pipeline was paused for three days. When it resumed, 1,900 deletions landed for conversations in weeks that were already published, and two published cells now fall below {{min_users}} users. The published numbers are on a public page.
- The classifier was re-run over the past month with a new version, moving many conversations between categories. Last month's published figures no longer match a recomputation, and a reader asks which set is right.

**Evaluation Criteria.** Each conversation settled once (window, opt-out, deletion, category) before aggregation; one facet row per conversation (the latest, and at the hardest level only rows known at the report time); Monday weeks in UTC; inclusive thresholds on distinct users and organizations; `other` counted over the union of the suppressed conversations and itself threshold-checked; deterministic ordering; can discuss differencing, incremental recomputation after deletions, and retention versus reproducibility.
