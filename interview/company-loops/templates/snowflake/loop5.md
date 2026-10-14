# Snowflake · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a cloud data
platform (virtual warehouses, storage, data sharing, a data marketplace and
ingestion). Every situation is hypothetical, and none describes any company's
hiring process or the values it assesses. Answer from your own experience, or
say plainly that you have not faced it and reason it through. Never invent a
story.

## SNO-L5-01: Blameless review when an executive wants a name after a sharing misconfiguration

| | |
|---|---|
| **Template ID** | SNO-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / blameless review, accountability, executive communication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "exposure": ["one consumer account could read two other consumers' rows through a shared view for six hours", "a share meant for a trial consumer granted the full paid dataset for nine days", "a test listing exposed a table of customer contract prices to three outside accounts for a day"],
  "exec": ["the chief revenue officer", "your VP of engineering", "the head of the business unit that owns the dataset"],
  "days": [2, 5]
}
```

**Business Scenario.** Your team publishes your company's datasets to customers through a cloud data platform's data sharing and marketplace. Last week {{exposure}}. A customer noticed and reported it; access was removed within the hour of the report, and the affected customers have been told. The change that caused it was made by an engineer on your team following the documented process, and two colleagues approved it in review. Two levels above you, {{exec}} has told you in front of others that they want to know "who did this" and expects a name in the review within {{days}} days.

**Problem Statement.** What do you do? Cover confirming the exposure is fully contained and understood, how you run the review, what you say to {{exec}} and when, how you support the engineer, what accountability looks like in your answer, which actions come out of it and how you know they worked. Then tell me about a real incident review you led or took part in where blame was in the air, with what happened, or say that you have not and reason it through.

**Constraints.** Legal and the customer-facing team are involved and need facts, not opinions. The engineer is upset and has offered to resign. You cannot delay the review past {{days}} days.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Was the documented process followed? | A: Yes. It had no automated check that a shared view's filter matched each consumer's entitlement.
- Q: Has this kind of change gone wrong before? | A: A near miss six months ago was caught in review; nothing changed afterwards.
- Q: Does the executive have authority over the engineer's employment? | A: Not directly; your manager and HR do. But the executive's view carries weight.
- Q: Do you know exactly what was read? | A: Access history shows which accounts queried which objects and when; you have not yet checked it in detail.

**Hints.**
1. First make sure the facts are complete: who could read what, who did, for how long, and whether anything else shares the same flaw.
2. Accountability in a blameless review is for the system and its owners, including you, not the absence of accountability.
3. Give the executive what they actually need: confidence that it is understood, contained and will not recur, with dates.

**Follow-ups.**
1. What do you check in the first day to be sure the exposure is contained and nothing similar is still open?
2. How do you answer {{exec}} when they ask for the name, and what do you offer them instead?
3. What does the review conclude about why two reviewers and a documented process let this through?
4. Six weeks later, how do you know the actions worked, and who would tell you if they had not?
5. In your real example, what did the review change, and how did the person closest to the mistake fare afterwards?

**Follow-up rules.**
- when: fire, fired, terminate, disciplinary, performance plan → ask: What would that action teach the next engineer who finds a mistake like this in their own change?
- when: blameless → ask: The executive says "blameless means nobody is accountable." What do you answer, and who is accountable in your account?
- when: root cause, five whys → ask: Which of your "whys" ends at a person, and how do you continue past it?
- when: automated check, guardrail, linter, validation → ask: The check you propose would have caught this case. Which class of sharing mistake does it still miss?
- when: we decided, the team decided, we agreed → ask: What did you personally say to the executive, and when?

**Evaluation Criteria.** Confirms containment from evidence (access history, other shares with the same pattern) before anything else; runs a blameless review that traces the failure to process and system gaps (no automated entitlement check, an ignored near miss) and names owners for fixes, including their own; answers the executive promptly and directly, declines to make the review about a name while offering accountability, a timeline and measurable actions; supports the engineer privately and publicly; actions are verifiable and followed up; real example with what changed and personal contribution, or honestly hypothetical.

## SNO-L5-02: Consolidating three orchestration tools across the organisation

| | |
|---|---|
| **Template ID** | SNO-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Platform consolidation / migration strategy, adoption across teams, decommissioning |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, data-engineer, analytics-engineer |

```params
{
  "tools": ["a self-hosted open-source workflow scheduler, cron jobs on virtual machines and the warehouse's own scheduled tasks", "two open-source workflow schedulers on different major versions and a commercial ELT tool's scheduler", "the warehouse's own scheduled tasks, a managed workflow service and a scheduler written in-house years ago"],
  "pipelines": ["600", "2,500", "9,000"],
  "teams": [8, 20, 45],
  "months": [6, 9, 12]
}
```

**Business Scenario.** Your organisation loads data into and out of a cloud data warehouse with {{pipelines}} scheduled pipelines owned by {{teams}} teams, orchestrated by {{tools}}. Dependencies between tools are expressed as schedules ("run at 03:15 because that one usually finishes by 03:00"); three of last quarter's incidents started when an upstream job ran late and a downstream job read half-loaded tables. Nobody can list every pipeline with its owner. You have been asked to lead a consolidation and to show progress within {{months}} months.

**Problem Statement.** How would you lead it? Cover how you decide whether to consolidate and onto what, the evidence you gather first, the migration plan, how you get {{teams}} teams to move while they have their own roadmaps, what you choose not to migrate, how you measure success, and how the old tools are switched off. Then tell me about a real platform migration or consolidation you led or took part in, with what happened, or say that you have not and reason it through.

**Constraints.** You have three engineers for the work and no authority over the other teams' plans. Some pipelines feed external customers through data shares, and their timing is promised. The old tools' licences and machines cost money every month they stay up.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the target tool already chosen? | A: No. Leadership expects a recommendation from you.
- Q: Do teams want this? | A: Some do; others say their tool works fine and migration is risk with no benefit to them.
- Q: Are there pipelines without an owner? | A: Probably; nobody has checked.
- Q: Can you block new pipelines on the old tools? | A: You can propose it; your director would have to agree.

**Hints.**
1. An inventory comes first: every pipeline, its owner, its schedule, what it reads and writes, and what depends on it.
2. The problem in last quarter's incidents was missing dependencies, not the number of tools; make sure your target fixes that.
3. Make the new path easier than the old one before asking anyone to move, and stop the old path from growing.

**Follow-ups.**
1. How do you build the inventory, and what do you do about pipelines nobody owns?
2. How do you choose the target, and what would make you recommend keeping two tools instead of one?
3. A team with a fifth of all pipelines refuses to migrate this year. What do you do?
4. How do you migrate the pipelines behind customer-facing shares without missing their promised times?
5. In your real example, what did you underestimate, and what would you do differently?

**Follow-up rules.**
- when: mandate, deadline, force, forced → ask: The director mandates the move by a date. Which teams miss it, and what happens to their pipelines then?
- when: big bang, cutover, switch over → ask: Which pipelines move first, and what is your rollback if a migrated pipeline produces different numbers?
- when: rewrite, rebuild, from scratch → ask: How many of the {{pipelines}} pipelines need a rewrite rather than a translation, and who pays for that time?
- when: inventory, survey, audit, catalogue, catalog → ask: Your inventory finds a fifth of pipelines with no owner. Which do you switch off, and how do you find out who needed them?
- when: we decided, the team decided, we agreed → ask: Which decision was yours, and who disagreed?

**Evaluation Criteria.** Starts with an inventory and the failure that matters (missing explicit dependencies); chooses the target on criteria tied to that failure (dependency modelling, retries and backfills, observability, cost, skills) and considers keeping more than one tool where justified; a phased plan (stop new pipelines on old tools, make the new path easier, migrate by dependency cluster, high-risk last or with dual running and output comparison); wins teams through reduced work and clear support rather than only mandate, with escalation where needed; retires orphan pipelines safely (switch off with notice, watch for complaints); measurable outcomes (incidents, pipelines migrated, cost retired); real example with personal contribution, or honestly hypothetical.

## SNO-L5-03: A VP's urgent request against the team's committed quarter

| | |
|---|---|
| **Template ID** | SNO-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation / competing commitments, saying no with options, stakeholder management |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "request": ["a usage dashboard for a large prospect evaluating your data listings, to be shown in their final review", "per-customer warehouse spend reports that finance wants before budget season", "a new curated dataset shared with a strategic partner for a joint announcement"],
  "weeks": [2, 3, 5],
  "committed": ["moving the ingestion pipeline off a loader that is being retired", "row-level entitlements for every shared dataset", "rebuilding the shared reporting tables as incremental models"]
}
```

**Business Scenario.** Halfway through the quarter, a VP who is not in your management chain asks your team directly for {{request}} within {{weeks}} weeks. Your team is committed to {{committed}}, which two other teams depend on, and the plan has no slack. Your manager is on leave this week. The VP says the request is "the top priority for the company" and has already told the prospect or partner it will happen.

**Problem Statement.** What do you do this week, and over the next {{weeks}} weeks? Cover how you understand what is really needed and by when, how you estimate it honestly, what options you put on the table and what each costs the committed work and the teams depending on it, who decides, how you communicate with the VP, your manager and the dependent teams, and what you do if the decision goes against your team's plan. Then tell me about a real time an urgent request collided with committed work, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot add people this quarter. The dependent teams have their own commitments built on yours. Saying yes to everything means missing something.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the VP's claim about company priority true? | A: You do not know yet. Nobody has written it down.
- Q: Could another team do it? | A: Possibly a smaller version; they are also busy.
- Q: Can you reach your manager? | A: By message, with a delay of a day or two.
- Q: What is the smallest useful version? | A: You have not asked yet.

**Hints.**
1. Ask what decision or event the request serves; that sets the real deadline and the smallest version that is enough.
2. Turn the conflict into options with costs, not a yes or a no.
3. The decision belongs to whoever owns both priorities; get it made in writing and tell everyone affected.

**Follow-ups.**
1. What do you ask the VP in your first conversation?
2. Lay out the options you would offer and what each costs the committed work.
3. The decision is to do the request in full and delay the committed work by {{weeks}} weeks. What do you tell the two dependent teams, and when?
4. The VP comes back a week later with a second urgent request. What do you do differently?
5. In your real example, what did you give up, and was it worth it in hindsight?

**Follow-up rules.**
- when: no, decline, push back, pushback → ask: The VP replies that "no" is not an option and they will take it to your director. What do you do next?
- when: overtime, weekends, extra hours, late nights → ask: For how many weeks can the team keep that up, and what does it cost you next quarter?
- when: escalate, escalation, director, manager → ask: What exactly do you put in front of the person who decides, and how do you present the VP's case fairly?
- when: mvp, minimal, smaller version, scope → ask: Which part of the request does your smaller version leave out, and has the VP agreed it is enough?
- when: we decided, the team decided, we agreed → ask: What did you personally recommend, and to whom?

**Evaluation Criteria.** Clarifies the underlying need, deadline and smallest sufficient version before committing; estimates honestly; offers options with explicit costs to committed work and dependent teams; routes the decision to the person who owns both priorities, with the manager informed despite leave; communicates the decision in writing to the VP, the team and dependent teams; protects the team from unsustainable overtime; handles repeat requests with a lightweight intake rule; real example with the trade-off made and its outcome, or honestly hypothetical.

## SNO-L5-04: Setting a freshness objective with product for a feature that never had one

| | |
|---|---|
| **Template ID** | SNO-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Reliability objectives / defining freshness, cost of options, agreement with product |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "feature": ["the consumer usage charts that data providers see for their listings", "a customer-facing dashboard of warehouse spend by team", "a popularity signal used to rank marketplace listings in search"],
  "lag": ["between 20 minutes and 9 hours", "usually 2 hours, sometimes 2 days", "anything from 5 minutes to a full day"],
  "complaints": [3, 12, 40]
}
```

**Business Scenario.** Your team's pipelines feed {{feature}}. Nobody has ever said how fresh its data must be. Measured from the moment an event happens to the moment it shows in the feature, the lag is {{lag}}. Support logged {{complaints}} complaints about stale data last quarter. The product manager wants it "real time"; your engineers say the pipeline is a batch job on a schedule and real time would be a rebuild. You have been asked to agree a freshness objective with product and then make it true.

**Problem Statement.** How would you lead this? Cover how you define freshness precisely (which timestamps, measured where, at what percentile, over what window), how you find out what users actually need, how you cost each option, how you reach agreement with product, how you instrument and publish it, what happens when the objective is missed, and how it is reviewed. Then tell me about a real time you set a reliability or freshness objective with a partner team, with what happened, or say that you have not and reason it through.

**Constraints.** The team has one quarter and no extra headcount. The warehouse budget for the pipeline can grow by at most a third. Product owns the feature's promises to customers.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is any promise already made to customers? | A: The documentation says "updated regularly". Sales have said "near real time" in some calls.
- Q: Where does the lag come from today? | A: You have not broken it down; the pipeline has four stages and one of them is a daily job.
- Q: What do the complaints say? | A: Mostly that numbers changed after a decision was made on them, or that today's activity was missing.
- Q: Who would be paged if the objective were missed? | A: Nobody today.

**Hints.**
1. Measure before negotiating: where the lag comes from, stage by stage, and how it is distributed, not just its average.
2. Ask what decision users make with the feature and how fast that decision needs new data; that is the requirement, not "real time".
3. An objective needs an owner, a measurement users can see, and an agreed response when it is missed.

**Follow-ups.**
1. Define the freshness measure you would propose, precisely enough that two engineers would compute the same number.
2. What options would you cost for product, and what does each cost in money and team time?
3. Product insists on five minutes. The cheapest design that meets it would double the warehouse spend. What happens next?
4. The objective is agreed. Two months later it is missed for three days running. What happens, and who decides?
5. In your real example, how did the objective change behaviour on both teams?

**Follow-up rules.**
- when: real time, real-time, streaming, stream → ask: Which decision does a user make differently with data that is seconds old rather than fifteen minutes old?
- when: p99, p95, percentile, slo → ask: Measured over what window, from which timestamp, and what does a user see when a day falls outside it?
- when: alert, page, paging, on-call → ask: Who gets paged at 03:00 when freshness slips, and what can they actually do about it?
- when: sla, contract, credits, guarantee → ask: Is this promised to customers or only internal? Who decides, and what changes if it is promised?
- when: we decided, the team decided, we agreed → ask: Which part of the agreement was your proposal, and what did product change in it?

**Evaluation Criteria.** Measures the current lag end to end and per stage with a distribution; defines freshness precisely (event time to visible time, at a percentile over a window, with a stated handling of late and restated data); grounds the requirement in user decisions rather than labels; costs options in money and effort (more frequent batches, micro-batches, incremental processing, streaming) within the budget; reaches a written agreement with product including what customers are told; instruments and publishes freshness in the feature itself, with alerts, an owner and an agreed response when missed; reviews it periodically; real example with personal contribution and outcome, or honestly hypothetical.

## SNO-L5-05: Project deep dive, re-examined for multi-tenant elastic compute

| | |
|---|---|
| **Template ID** | SNO-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, workload isolation and elastic compute |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "angle": ["the workload that was hardest to keep fast", "the decision that most changed what the system cost", "the failure that taught you the most"],
  "scale": ["10×", "30×"],
  "tenant_feature": ["separate compute per tenant that suspends when idle and resumes on the next query", "a spending limit per tenant with alerts and a hard stop", "isolation so that one tenant's heavy jobs never slow the others"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it served many tenants on elastic compute, the way a cloud data platform runs each workload on warehouses that can be resized, scaled out and suspended, at {{scale}} today's load, and with {{tenant_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at {{scale}} the load, with tenants sharing the system, and with {{tenant_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear which parts you are recalling and which you are reasoning through.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The multi-tenant, elastic setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to workloads, keys, failure modes, costs and numbers.
- Q: Does "elastic" mean I must have used a cloud warehouse? | A: No. Reason about compute that can be added, removed and paused, whatever you used.

**Hints.**
1. Lead with the problem and the numbers, including peak against average, before the architecture.
2. Know what each workload in your system costs and what it competes with for resources.
3. For the elastic question, decide what is shared (storage, metadata, compute) and what each tenant gets of its own.

**Follow-ups.**
1. What was the main alternative to your key decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. At {{scale}} the load, which component fails first, and how would you know before users did?
4. How would you add {{tenant_feature}} without a rewrite, and what new failure does it bring?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: autoscale, autoscaling, scale out, elastic → ask: What signal triggers scaling, how long does new capacity take to help, and what do queries do in the meantime?
- when: queue, queued, queueing, concurrency → ask: How long did queries wait at peak, and who decided that was acceptable?
- when: credits, cost, budget, spend → ask: How much did the system cost per month, which workload drove it, and what did you change because of it?
- when: tenant, multi-tenant, noisy neighbour, noisy neighbor → ask: One tenant is a hundred times larger than the median. Where in your design does their load stop affecting the others?

**Evaluation Criteria.** Clear problem framing with real numbers (peak and average, data size, latency or freshness targets, cost); depth on the chosen angle down to workloads, keys and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a scaling analysis that names the first bottleneck and how it would be seen early; a concrete, incremental path to the tenant feature with its new failure modes (resume latency, hard stops interrupting critical jobs, isolation cost); own contribution separated from the team's, or an honest statement of reasoning rather than recall.
