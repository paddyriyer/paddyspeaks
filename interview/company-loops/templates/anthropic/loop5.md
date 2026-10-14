# Anthropic · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of an AI model
provider. Every situation is hypothetical and none describes how the company
actually works. Answer from your own experience, or say plainly that you have
not faced it and reason it through. Never invent a story.

## ANT-L5-01: A safety evaluation number behind a release was wrong

| | |
|---|---|
| **Template ID** | ANT-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / data correctness behind a decision, disclosure |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, ai-infra-engineer |

```params
{
  "cause": ["a join that silently dropped test cases with no grader output", "a deduplication step that collapsed distinct test cases sharing a long common prefix", "a filter that left multi-turn conversations out of the denominator"],
  "delta": ["1.5 points", "4 points"],
  "days": [3, 10, 21]
}
```

**Business Scenario.** Your team owns the pipeline that turns safety evaluation runs into result tables and the summary that a model release review reads. A new model version shipped {{days}} days ago, in part on a summary showing it at least as good as the previous version on a suite of harmful-request tests. An engineer on your team has just found {{cause}}. With the bug fixed, the new version scores {{delta}} worse than reported on that suite. The release review, safety researchers and product leadership all relied on the number. You lead the team.

**Problem Statement.** How do you lead from here: the first hour, the first days and the following weeks? Cover confirming the finding, who you tell and in what words, how you correct the record, how you help the people who own the release decision decide whether anything changes (you do not own that decision), how you find what else the bug touched, and how you prevent a repeat. Then tell me about a real time a number your team produced turned out to be wrong after someone had acted on it (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** You do not own the release decision. Published result tables are append-only; a correction is a new, linked version. Other suites may share the same code path. Your team has committed work for the next release.

**Assumptions.** The situation and figures are hypothetical. The number appeared only in internal review material.

**Clarifications.**
- Q: Is the finding confirmed? | A: One engineer's analysis. Nobody has reproduced it yet.
- Q: Does a {{delta}} change matter? | A: That is for the release owners to judge with corrected data and its uncertainty; your job is to give them that.
- Q: Did other suites use the same step? | A: Probably several. Nobody knows how many.
- Q: Is the engineer who wrote the bug on your team? | A: Yes, and they are upset about it.

**Hints.**
1. Reproduce before you broadcast, but time-box it to hours, not days, and tell decision owners early that a check is under way.
2. Say what you know, what you do not, and when you will know more.
3. Find the blast radius from lineage: every result that passed through the faulty step.

**Follow-ups.**
1. Reproduction is taking longer than expected and a leader asks you for a yes or no today. What do you say?
2. The corrected score is inside the suite's confidence interval around the old one. How do you present that without minimising it or causing alarm?
3. The same step fed 11 other suites over six months. How do you decide which to recompute first?
4. Which check would have caught this before the review, who owns it now, and how do you know it works?
5. In your real example, what did you personally do, and what changed afterwards?

**Follow-up rules.**
- when: rollback, roll back, revert the release, pull the model → ask: That decision belongs to the release owners. What do you put in front of them, and how do you avoid deciding for them through the way you frame it?
- when: quietly fix, just fix it, patch it → ask: People made a decision on the old number. Who must hear about the correction, from whom, and how fast?
- when: we found, the team found, we decided → ask: What did you personally do or decide?
- when: test, unit test, assertion, check → ask: Name the invariant that would have failed, for example test cases in equals test cases scored. Where does it run, and what happens when it fails?
- when: blame, fault, careless → ask: How do you keep the review blameless while still being clear about what went wrong?

**Evaluation Criteria.** Time-boxed reproduction and early, factual notice to decision owners; correction published as a linked new version with uncertainty; decision rights respected while giving owners what they need; blast radius found by lineage and recomputation prioritised by decisions affected; blameless review with invariants (row counts in = row counts scored, denominators checked) owned and tested; real example has measurable evidence and a personal contribution, or is honestly marked as hypothetical.

## ANT-L5-02: Retiring a model version that customers still depend on

| | |
|---|---|
| **Template ID** | ANT-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team leadership / model deprecation, customer migration evidence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect, ml-platform-engineer |

```params
{
  "tenants": ["40", "300", "1,200"],
  "share": ["3%", "12%"],
  "weeks": [6, 12],
  "blocker": ["a regression on strict structured outputs for a few large customers", "different tool-use behaviour that breaks some agent workflows", "a higher cost per completed task for customers with long prompts"]
}
```

**Business Scenario.** A model version is due to be retired in {{weeks}} weeks under a published deprecation notice. {{tenants}} organisations still send {{share}} of API traffic to it. Customer-facing teams report that some of them will not move because of {{blocker}}. You lead the data team asked to supply the evidence for the migration programme: who is affected and how much, whether the blocker is real and how widespread, and progress every week. Product leadership owns the retirement date and will decide whether to hold it.

**Problem Statement.** Plan and lead the work from the first week to the retirement date. Cover the analyses you would run and on what data, how you test the blocker without reading customer content, how you work with customer-facing teams, model teams and leadership, and what you recommend about the date and how you present it. Then tell me about a real migration or deprecation that affected customers or internal users where you led the evidence or the plan (with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** Customer content is not inspected; you have usage metadata (model, organisation, workspace, token counts, stop reasons, whether tools, caching or batch were used) and whatever customers choose to share. The date is public, so changing it has a cost. Your team has other commitments.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do we know which organisations use which features? | A: From usage metadata, yes: tool use, caching, batch, output lengths, stop reasons. Not from content.
- Q: Can the blocker be tested? | A: With public or synthetic evaluation sets, and with examples customers choose to share.
- Q: Who decides on the date? | A: Product leadership. You provide evidence and a recommendation.
- Q: How concentrated is the remaining traffic? | A: You do not know yet. That is your first analysis.

**Hints.**
1. Segment early: a few large organisations and a long tail need different plans.
2. Turn "will not move" into a measurable claim you can test.
3. Agree one weekly progress number with everyone, and define it so it cannot be gamed.

**Follow-ups.**
1. Three organisations account for half the remaining traffic. What do you do differently for them?
2. Your tests reproduce the blocker for one of four reported patterns. What do you recommend, and to whom?
3. Two weeks before the date, a fifth of the original traffic remains. Hold or extend? Make the case either way.
4. In your real example, how did you measure progress, and what surprised you?

**Follow-up rules.**
- when: read prompts, look at prompts, sample prompts, customer data → ask: Customer content is not inspected. How else do you learn what breaks for them?
- when: extend, delay, push the date → ask: What does extending cost, and who pays it, including the customers who already migrated on time?
- when: dashboard, weekly report, tracker → ask: Which single number goes at the top, and what would make it misleading?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or recommend?

**Evaluation Criteria.** Fast segmentation of remaining traffic by organisation and feature use; blocker turned into a testable claim measured without customer content; tailored plans for the largest tenants and scalable ones for the tail; one agreed progress metric; a recommendation on the date that weighs evidence, cost of delay and fairness to customers who moved; clear decision rights; real example with measurable outcome and personal contribution, or honestly hypothetical.

## ANT-L5-03: The latency dashboard is green; customers say streaming is slow

| | |
|---|---|
| **Template ID** | ANT-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Metric ownership / redefining an SLO, cross-team evidence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "complaints": ["a dozen", "60", "200"],
  "metric": ["median time to first token measured at the inference servers", "mean total latency per request", "p95 time to first token excluding requests that ended in an error"],
  "teams": [3, 5]
}
```

**Business Scenario.** For a quarter, the official latency metric, {{metric}}, has met its objective and been reported to leadership every week. Over the same quarter, {{complaints}} enterprise support tickets said streamed responses hang in the middle of an answer or take a long time before any text appears. {{teams}} teams own parts of the path (gateway, routing, inference serving, client SDKs), and your data team owns the metrics pipeline. Each team says its own numbers are fine. You suspect the official metric measures the wrong thing.

**Problem Statement.** How would you lead this to a resolution? Cover how you establish the evidence, how you get the teams to agree what "slow" means for a streamed response, how you change an official metric that leadership has seen green for a quarter, and how you handle the fact that the new numbers will look worse. Then tell me about a real time you changed a metric people were attached to, or say that you have not and reason through how you would.

**Constraints.** You own the metrics pipeline, not the services and not the objective itself. Customer content is not inspected; timings and event metadata only.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do we have client-side timings? | A: Not today. The gateway can record when each streamed event is sent to the client.
- Q: Who owns the objective? | A: An engineering leadership group. Teams propose changes to it.
- Q: Are the tickets reproducible? | A: A few include request ids; most do not.

**Hints.**
1. Start from the tickets that include request ids and trace them end to end.
2. Propose measures that match what a customer feels: time to first visible content, the longest pause between content events, streams that end without completing.
3. Run old and new side by side before switching, and publish how they relate.

**Follow-ups.**
1. The new metric shows the objective was missed every week last quarter. How do you present that to leadership?
2. One team says the pauses are client network problems. What evidence settles it?
3. How do you stop the new metric being ignored or gamed the way the old one was?
4. In your real example, who resisted the change, and why?

**Follow-up rules.**
- when: p99, tail, percentile → ask: A percentile of which population: requests, streams or customers? A customer with 5% of traffic can sit in the worst 1% all day.
- when: blame, their fault, their team → ask: How do you keep the investigation about the system rather than about a team?
- when: new slo, change the slo, redefine, new metric → ask: Leadership has seen green for a quarter. How do you introduce a metric that is red on its first day?
- when: we agreed, everyone agreed, consensus → ask: Who disagreed, and what did you do about it?

**Evaluation Criteria.** Evidence from traced tickets before argument; a metric definition grounded in what customers experience (first visible content, pauses, incomplete streams), per customer as well as per request; side-by-side period and a written translation from old to new; candid presentation of the historical miss without blame; agreement through the objective's owners; guardrails against gaming; real example with measurable outcome and personal contribution, or honestly hypothetical.

## ANT-L5-04: Tool-use telemetry that dozens of teams parse differently

| | |
|---|---|
| **Template ID** | ANT-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical debt / schema evolution with many consumers, data contracts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "consumers": [15, 40, 90],
  "breakages": [2, 4, 7],
  "trigger": ["a new kind of tool whose call metadata does not fit the existing fields", "a privacy review finding that some log lines include tool arguments", "a request to report tool-call success rates to enterprise admins"]
}
```

**Business Scenario.** Every turn in which the model calls a tool writes a telemetry line (tool name, number of calls, latency, outcome, stop reason) as a free-form JSON blob whose fields grew over time without a schema. {{consumers}} dashboards, jobs and notebooks parse it, each with its own assumptions, and changes to it broke consumers {{breakages}} times last quarter. Now {{trigger}} forces a change. You are the senior engineer on the team that owns the log.

**Problem Statement.** How do you lead from here? Cover the decision between another patch and a typed, versioned schema under a data contract; how you find every consumer; how you migrate without breaking them; how you handle the immediate trigger; and how you get time and agreement from teams that do not report to you. Then tell me about a real piece of technical debt with many consumers that you reduced, with its outcome, or say that you have not and reason through how you would.

**Constraints.** The trigger has a deadline. Consumers belong to other teams with their own priorities. The log cannot stop during the migration.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do you know every consumer? | A: You know some. Access logs on the table and topic show more.
- Q: How urgent is the trigger? | A: Anything about what may be logged cannot wait for a migration; the rest has a quarter.
- Q: Can two versions run side by side? | A: Yes, at a storage and compute cost.

**Hints.**
1. Separate the urgent fix from the structural change, and do the urgent one first.
2. Find consumers from access logs, not from memory.
3. Run the old and new versions in parallel with a published end date and a field-by-field mapping.

**Follow-ups.**
1. Ten consumers have no active owner. What do you do with them?
2. A consumer team refuses to migrate this quarter. What are your options?
3. How do you stop the new schema degrading into the old one in two years?
4. In your real example, how did you measure that breakage went down?

**Follow-up rules.**
- when: data contract, schema registry, contract → ask: Who approves a change to the contract, and what happens in CI when a producer breaks it?
- when: big bang, cut over, switch everyone → ask: What happens to the consumers you did not find?
- when: dual write, parallel, both versions → ask: How long do both run, what does that cost, and what ends it?
- when: deprecate, sunset, remove the field → ask: How do you know nobody still reads the old field on the day you remove it?

**Evaluation Criteria.** Urgent risk handled first and separately; consumers inventoried from evidence; a typed, versioned schema with a contract checked in CI and an owner for changes; parallel run with a mapping, a dated end and usage-based proof that old fields are unread; a plan for orphaned consumers and holdouts; agreement won through cost of breakage in concrete terms; real example with measured reduction in breakage and personal contribution, or honestly hypothetical.

## ANT-L5-05: Project deep dive, re-examined for a multi-tenant model API

| | |
|---|---|
| **Template ID** | ANT-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, scaling to multi-tenant workloads |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the biggest cost or performance decision"],
  "scale": ["10×", "50×"],
  "tenant_feature": ["cost attribution per workspace and API key", "usage limits set per organisation and per workspace", "per-tenant data retention settings"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change at {{scale}} its load in a multi-tenant setting like an enterprise model API, where organisations group API keys into workspaces and expect {{tenant_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at {{scale}} the load and with {{tenant_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The multi-tenant setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to schemas, keys, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the scaling question, name the first component to break and how you would know.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. At {{scale}} the load, which component fails first, and how do you know?
4. How would you add {{tenant_feature}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, spark, flink, airflow, snowflake, bigquery → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: tenant, multi-tenant, workspace → ask: Where does tenant isolation live in your design: storage, the query layer or the application? What happens when one tenant is a hundred times larger than the median?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with the alternatives and evidence; honest account of what broke and what changed; a credible scaling analysis that names the first bottleneck; a concrete, incremental path to the tenant feature; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
