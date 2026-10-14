# Databricks · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a data and AI
platform built around a lakehouse, Apache Spark and an open table format.
Every situation is hypothetical, and none describes any company's hiring
process or the values it assesses. Answer from your own experience, or say
plainly that you have not faced it and reason it through. Never invent a story.

## DBX-L5-01: A large customer's jobs got slower after a platform upgrade

| | |
|---|---|
| **Template ID** | DBX-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Customer-facing incident leadership / performance regression, communication under scrutiny |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "slowdown": ["40% slower", "twice as slow", "three times as slow"],
  "jobs": [12, 60, 300],
  "change": ["a new default for automatic shuffle partition sizing", "a new query-optimiser rule turned on by default", "a changed default for how files are sized on write"],
  "watching": ["the customer's head of data engineering wants a daily call with you", "the customer's CTO has escalated to your executives", "the customer's engineers have described the slowdown in a public community forum"]
}
```

**Business Scenario.** You are a senior engineer on the team that ships the managed runtime of a data platform: the Spark-based engine version customers' jobs run on. Two weeks ago a runtime upgrade rolled out to all customers; among many changes it included {{change}}. A large customer reports that {{jobs}} of their nightly jobs are now {{slowdown}}, and their morning reports are late. Your support organisation has made you the technical lead for the investigation, and {{watching}}.

**Problem Statement.** Tell me how you would lead it: what you do in the first hour, the first day and the following weeks; how you mitigate before you know the root cause; how you find the cause; what you tell the customer, when and how; and what changes so the next upgrade does not do this to anyone. Then tell me about a real time you led an investigation while a customer or stakeholder was watching closely, with what happened, or say that you have not and reason it through.

**Constraints.** You may not read the customer's data without their written permission; you can see the telemetry the platform collects (query plans, stage metrics, cluster configuration). The upgrade includes security fixes, so rolling back every customer is not an option. Commercial matters (credits, contract terms) belong to the account team, not to you.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can one customer's workloads be pinned to the previous runtime? | A: Yes, per workspace or per job, for a limited time, with the security trade-off made explicit.
- Q: Is the change named in the release notes? | A: Yes, in one line among forty.
- Q: Have other customers complained? | A: Two small ones filed tickets about "slower jobs" that nobody has linked to the upgrade yet.
- Q: Does the customer have a test environment? | A: They have one, with much less data.

**Hints.**
1. Mitigate first: a per-job or per-workspace pin, or turning one setting back, can restore the reports tonight while you investigate.
2. Compare the same job before and after the upgrade at the stage level; the plans and the stage metrics usually point at the change.
3. Decide what you will say and when you will next update before the first call, and keep every promise about timing.

**Follow-ups.**
1. What happens in the first hour, and what do you say on the first call when you do not yet know the cause?
2. How do you find which of the upgrade's changes caused the slowdown, using only the telemetry you are allowed to see?
3. The customer asks you to promise this will never happen again. What do you say?
4. You find the change helps most customers and hurts this customer's job shape. What do you decide for the default, and who else needs to agree?
5. In your real example, what did you tell the stakeholder that you would say differently now?

**Follow-up rules.**
- when: rollback, roll back, revert → ask: The upgrade carries security fixes. Who decides whether this customer may run without them, and for how long?
- when: root cause, rca, five whys → ask: Tonight's reports will be late again while you look for the cause. What do you do before you know it?
- when: their data, customer data, customer's data, data access → ask: You have not been given permission to read their data. What can you learn from plans and metrics alone, and how would you ask for more?
- when: credit, credits, refund, compensation → ask: That belongs to the account team. What do you give them so they can decide?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and what did it risk?

**Evaluation Criteria.** Mitigates before diagnosing (a scoped pin or setting change with the security trade-off made explicit and agreed); sets a communication rhythm with honest status and kept timing promises; investigates with evidence (before/after plans and stage metrics, a reproduction on synthetic or permitted data, bisecting the upgrade's changes); respects data-access boundaries; checks for other affected customers; decides the default with data from the whole fleet and the right owners; prevention through workload-representative regression testing and staged rollouts with per-change switches; real example with personal actions and outcome, or honestly hypothetical.

## DBX-L5-02: A breaking change in an open format that customers rely on

| | |
|---|---|
| **Template ID** | DBX-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Compatibility and ecosystem stewardship / protocol upgrades, defaults, migration paths |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "feature": ["a row-level delete marker that avoids rewriting whole files on every delete", "a column-mapping mode that allows renaming and dropping columns without rewriting data", "a new statistics layout that makes file skipping far more effective"],
  "old_readers": ["8%", "20%", "35%"],
  "months": [2, 6]
}
```

**Business Scenario.** Your team maintains a data platform's support for an open table format that many customers also read with other engines and older clients. The format records which features each table uses; a reader that does not support one of them must refuse to read the table rather than read it wrongly, so turning a feature on can lock out older readers. A new feature, {{feature}}, brings customers large benefits. Product wants it on by default for new and existing tables in {{months}} months. Platform telemetry suggests that about {{old_readers}} of customers' active tables are also read by at least one engine or client version that does not support the feature yet.

**Problem Statement.** How do you decide what ships and how? Cover what you find out first, what compatibility promise the platform should make and write down, whether the feature is on by default for new tables, existing tables or neither, how customers are told and how they opt in or out, what happens to a table whose old reader breaks after the change, and how you bring product, the open-source community and customer-facing teams to one plan. Then tell me about a real time you shipped or blocked a change that was incompatible for some users, or say that you have not and reason it through.

**Constraints.** Enabling the feature on a table is not trivially reversible. Other engines are maintained by other organisations, on their own release schedules. Product's date is tied to a public announcement.

**Assumptions.** The situation and figures are hypothetical. How a given format version handles feature flags and downgrades is this exercise's rule; check current docs.

**Clarifications.**
- Q: How good is the telemetry on old readers? | A: It sees reads that go through the platform and some reads by other engines through its catalogue; reads directly from storage are invisible.
- Q: Can a table be downgraded after the feature is on? | A: Only by a maintenance operation that rewrites or cleans up data and then drops the feature; it takes time and may not be possible for every feature.
- Q: Do other engines plan to support the feature? | A: Some have it on their roadmap; dates are not committed.
- Q: Who owns the announcement? | A: Product marketing, with product management; your team owns the technical plan.

**Hints.**
1. The {{old_readers}} figure is a lower bound; ask what you cannot see before you decide anything.
2. New tables, existing tables and tables shared with others are three different decisions.
3. A compatibility promise is only useful if it is written down, specific and checked automatically before a change ships.

**Follow-ups.**
1. What would you need to know before you agree to any default, and how would you get it within two weeks?
2. Product says opt-in means nobody will use the feature. How do you respond?
3. A customer's external reporting tool stops reading their tables the morning after the change. What happens next, hour by hour?
4. What compatibility promise would you propose for the format's features, and how would you enforce it in your release process?
5. In your real example, who was hurt by the change, and what would you do differently?

**Follow-up rules.**
- when: default, on by default, enabled by default → ask: For existing tables, who exactly gets the feature on that day, and how did you decide that their readers can handle it?
- when: telemetry, data shows, metrics → ask: Reads directly from storage are invisible to your telemetry. How do you account for readers you cannot see?
- when: opt-in, opt in → ask: Product says adoption will stall. What would make opt-in succeed, and how long would you wait before reconsidering?
- when: community, open source, upstream → ask: Other engines release on their own schedule. What can you do to help them support the feature sooner, and what can you not control?
- when: we decided, the team decided, we agreed → ask: What was your own position, and did it change? Why?

**Evaluation Criteria.** Gathers evidence first (who reads which tables with what; the blind spot of direct storage reads; downgrade feasibility); separates new tables, existing tables and shared tables; proposes a written compatibility policy (deprecation windows, explicit enablement, a documented downgrade path, release gates); communicates early with clear guidance and tools (a checker that lists a table's readers, opt-out settings); works with the open-source community and other engines rather than around them; plans the response for broken readers; reaches one plan with product without hiding the trade-off; real example with impact and lessons, or honestly hypothetical.

## DBX-L5-03: Growing a strong senior engineer toward staff

| | |
|---|---|
| **Template ID** | DBX-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Mentorship and sponsorship / scope, influence, written design, honest feedback |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, data-architect, ml-platform-engineer |

```params
{
  "area": ["the streaming ingestion service", "the table-maintenance service that compacts and cleans up customers' tables", "the query-planning layer of the SQL engine"],
  "gap": ["designs that are excellent but never written down, so other teams cannot build on them", "deep work inside the team's own component, with little influence on neighbouring teams", "strong opinions that win arguments but leave peers unconvinced"],
  "months": [6, 12]
}
```

**Business Scenario.** You are a staff engineer on a data platform. A senior engineer who owns {{area}} has asked you to help them reach staff level within {{months}} months. Their technical work is consistently strong. Their last review named one gap: {{gap}}. Their manager supports the goal and has asked you to mentor them; promotion is decided by a group that reviews written evidence of impact.

**Problem Statement.** How would you help? Cover how you would assess where they are, how you would agree on what "staff" means for them in concrete terms, what opportunities you would find or create, how you would give feedback, including uncomfortable feedback, what you would do as a sponsor rather than a mentor, and what happens if they are not ready at the end of {{months}} months. Then tell me about a real person you helped grow, with what changed for them, or say that you have not and reason it through.

**Constraints.** You are not their manager. There is no staff-sized project waiting to be handed out. Your own roadmap does not get lighter.

**Assumptions.** The situation is hypothetical, and nothing here describes how any company runs promotions.

**Clarifications.**
- Q: Does the engineer agree with the review's gap? | A: Partly. They think the work should speak for itself.
- Q: Are there cross-team problems they could take on? | A: Several, unowned: inconsistent table-maintenance settings across teams, flaky end-to-end tests, an incident pattern that keeps recurring.
- Q: How often can you meet? | A: Every two weeks for an hour, plus whatever you arrange around real work.

**Hints.**
1. Make the expectation concrete: which problems a staff engineer here owns, and what evidence would show it.
2. The fastest growth comes from a real, cross-team problem with visible stakes, not from extra assignments.
3. Sponsorship is spending your own credibility: putting their name forward, and giving them the room to lead where you would normally lead.

**Follow-ups.**
1. What do you do in your first two conversations, and what do you agree to measure?
2. Which cross-team problem would you steer them toward, and why that one?
3. Three months in, their design document for that problem is technically right and nobody has read it. What do you do?
4. At the end of {{months}} months you believe they are not ready. How do you tell them, and what happens next?
5. In your real example, what feedback did you give that was hardest to say, and what did it change?

**Follow-up rules.**
- when: pair, shadow, mentor, mentoring → ask: That builds skill. What will you do that changes how others see their impact, and what does it cost you?
- when: feedback → ask: Give me the exact words you would use about {{gap}}, and what you would do if they disagreed.
- when: project, stretch, opportunity → ask: Who owns that problem today, and how do you give it to them without taking it from someone else or setting them up to fail?
- when: promotion, promoted, promote → ask: If the promotion does not happen at the end, what has the engineer still gained, and how do you keep them motivated?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say?

**Evaluation Criteria.** Starts by understanding the person (their goals, their view of the gap, examples); turns "staff" into concrete, observable expectations agreed with them and their manager; chooses a real cross-team problem with visible stakes and sets them up to lead it; gives specific, timely, honest feedback, including about {{gap}}; acts as a sponsor (opens doors, credits them in writing, steps back so they lead); tracks progress with evidence; handles "not ready" honestly with a plan; real example with what changed for the person and the candidate's own contribution, or honestly hypothetical.

## DBX-L5-04: Negotiating reliability capacity against a feature-packed roadmap

| | |
|---|---|
| **Template ID** | DBX-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation and negotiation / reliability investment, evidence, error budgets |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "service": ["the catalogue service that every query consults for table metadata and permissions", "the job scheduler that starts customers' workflows", "the cluster-provisioning service"],
  "incidents": [4, 7, 12],
  "ask": ["25%", "40%"],
  "launch": ["a new serverless compute option to be announced at a conference", "a data-sharing feature promised to several large customers", "an integration with a managed vector search product"]
}
```

**Business Scenario.** Your team owns {{service}} for a data platform. Last quarter it caused {{incidents}} customer-facing incidents; each one was fixed, and each fix was local. You believe the service needs {{ask}} of the team's capacity for the next two quarters to fix structural causes: a single database that every request depends on, retries that amplify overload, and missing load isolation between large and small customers. The roadmap is already full, and the product leader has committed the team to {{launch}}.

**Problem Statement.** How do you get the time, or decide you should not? Cover how you build the case, what evidence you bring, how you size and sequence the work, what you offer product in exchange, how you keep the launch on track if the work happens, and what you do if the answer is no. Then tell me about a real time you negotiated capacity for reliability or technical debt against feature work, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot hire this half. The launch date is public. The product leader is measured on the launch; you are measured on both.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are there written objectives for the service? | A: An availability target exists; latency has none.
- Q: Did the incidents breach the availability target? | A: Two did, and the quarter's budget is spent.
- Q: Does the launch depend on the service? | A: Yes; the launch will add load to it.
- Q: Who decides? | A: The product leader and your engineering director together.

**Hints.**
1. Translate incidents into what product cares about: customers affected, hours lost, support load, deals at risk, and the launch's own risk.
2. Show that the launch adds load to a service that is already failing; reliability work may be part of the launch, not a competitor to it.
3. Offer options with costs: the full ask, a smaller first slice with explicit milestones, and doing nothing with its expected incidents.

**Follow-ups.**
1. What does your one-page case contain, and what numbers are on it?
2. How would you sequence the {{ask}}, and what will be measurably better after the first six weeks?
3. The product leader offers 10%. What do you do?
4. The answer is no, and the next incident happens during the launch week. What do you do that week, and afterwards?
5. In your real example, what evidence changed the decision, and was the investment worth it?

**Follow-up rules.**
- when: error budget, slo, objective → ask: The budget is already spent. What does your policy say happens now, and did product agree to that policy before this conversation?
- when: tech debt, technical debt, refactor, rewrite → ask: Product hears "debt" as "engineers want to tidy up". How do you describe this work in terms of customers and the launch?
- when: escalate, escalation, director → ask: Your director and the product leader decide together. What do you bring to them so the choice is fair to both sides?
- when: incident, incidents, postmortem → ask: Each incident was fixed locally. What evidence shows they share a structural cause?
- when: we decided, the team decided, we agreed → ask: Which part of that case did you build yourself, and which argument did you lose?

**Evaluation Criteria.** Builds the case from evidence (incident analysis showing shared structural causes, customer and business impact, load projections including the launch); frames reliability as part of the launch's success; sizes and sequences the work into milestones with measurable outcomes; offers real options with costs and lets the decision makers choose with the trade-off visible; uses or proposes an agreed objective and error-budget policy; plans for a "no" (mitigations, risk register, readiness for launch week) without sulking or sabotage; real example with outcome and personal contribution, or honestly hypothetical.

## DBX-L5-05: Project deep dive, re-examined for a multi-cloud lakehouse

| | |
|---|---|
| **Template ID** | DBX-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, scaling across clouds and regions |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the storage layout and table design", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "clouds": [2, 3],
  "cloud_feature": ["data residency, with some tables kept in one region", "one access-control model across every cloud", "a fixed budget for cross-cloud egress charges", "disaster recovery to a different cloud"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it ran as a lakehouse across {{clouds}} clouds, with tables stored as open-format files in each cloud's object storage and a requirement for {{cloud_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes across {{clouds}} clouds with {{cloud_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The multi-cloud setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a lakehouse or a Spark system? | A: No. Any system that moved, stored or computed data others depended on; the multi-cloud part is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to file layouts, keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the multi-cloud question, start from where the data lives and what crossing a cloud boundary costs, in money, latency and failure modes.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design assume one cloud or one region, and which would break first across {{clouds}} clouds?
4. How would you meet the requirement for {{cloud_feature}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: spark, kafka, airflow, flink, snowflake, bigquery → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: replicate, replication, copy, copies → ask: Which copy is the source of truth, how far behind can the others be, and what does a reader in the other cloud see while a write is half replicated?
- when: egress, cross-cloud, network cost → ask: Put a number on it: how many bytes a day would cross between clouds in your design, and what would that cost?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to layouts, keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible multi-cloud analysis that starts from data location, names single-cloud assumptions, and addresses {{cloud_feature}} incrementally (for example a single source of truth per table with replicas or shares, governance defined once and enforced in each cloud, compute placed next to data, tested failover); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
