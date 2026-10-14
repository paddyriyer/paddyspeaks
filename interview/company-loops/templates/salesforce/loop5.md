# Salesforce · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a multi-tenant
cloud CRM with a customer data platform, automation and per-org limits. Every
situation is hypothetical, and none describes any company's hiring process or
the values it assesses. Answer from your own experience, or say plainly that you
have not faced it and reason it through. Never invent a story.

## SFC-L5-01: Writing a one-year technical strategy the team will actually follow

| | |
|---|---|
| **Template ID** | SFC-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical strategy / direction setting, trade-offs, buy-in, keeping a plan alive |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "platform": ["the pipelines that ingest customers' sources into the customer data platform", "the org usage analytics that product teams and customer admins rely on", "the telemetry pipeline behind automation run and fault reporting"],
  "pressure": ["the number of orgs on the platform is expected to double", "two new regions must keep customer data inside their borders", "a legacy store that half the pipelines depend on is being retired within the year", "on-call load has risen every quarter for a year"],
  "team": [6, 12, 25]
}
```

**Business Scenario.** You are the most senior engineer on a team of {{team}} that owns {{platform}}. The year ahead is shaped by one fact: {{pressure}}. Your director asks you to write the team's technical strategy for the year. The last two strategy documents the team wrote were approved, presented once, and then ignored: within a quarter, work was being chosen ticket by ticket again.

**Problem Statement.** How do you produce a strategy that changes what the team does? Cover how you find out where the system and the team really are; who you involve and when; what the document says and what it leaves out; how you make the trade-offs explicit (what the team will stop doing, not only start); how you get commitment from the team, your director and the teams that depend on you; and how you keep it alive through the year as things change. Then tell me about a real time you set technical direction for a team, and whether people followed it, or say you have not and reason it through.

**Constraints.** Roadmap requests from other teams will keep arriving all year. You do not control headcount. The strategy must fit on a few pages.

**Assumptions.** The team, platform and pressures are hypothetical.

**Clarifications.**
- Q: Why were the earlier strategies ignored? | A: Ask the team. The visible facts: they listed many goals with no order, nobody tracked them, and the first urgent request displaced them.
- Q: Does the director expect a specific format? | A: No. They expect something they can defend to their own leadership and that the team believes in.
- Q: Can the strategy say no to other teams' requests? | A: It can set rules for what the team takes on; the director must back those rules.
- Q: How long do I have? | A: About six weeks before the planning cycle closes.

**Hints.**
1. A strategy is a diagnosis, a few guiding choices and the actions that follow from them. A list of goals is not a strategy.
2. Saying what the team will not do, and how it will decide on new requests, is what keeps the plan alive when the first urgent request arrives.
3. Plan the review points (monthly or quarterly) and the signals that would tell you the strategy is wrong.

**Follow-ups.**
1. What would you look at in the first two weeks to diagnose where {{platform}} really stands?
2. Name two things your strategy would explicitly stop or defer, and how you would explain that to the teams who wanted them.
3. Three months in, an urgent request from a large customer does not fit the strategy. What happens?
4. How would you know at the half-year mark whether the strategy is working, and what would make you change it?
5. In your real example, what did people do differently because of the direction you set, and what did you get wrong?

**Follow-up rules.**
- when: okr, okrs, goals, objectives → ask: Goals say where you want to be. What are the two or three choices that say how you will get there, and what they rule out?
- when: survey, interviews, listening tour → ask: What did you expect to hear, and what would genuinely change your plan if you heard it?
- when: roadmap, quarter by quarter, timeline → ask: Halfway through the first quarter, an estimate turns out double. Which part of your roadmap gives way first, and who decides?
- when: buy-in, alignment, consensus → ask: One senior engineer on the team disagrees with your main choice and says so in the review. What do you do?
- when: i wrote, i decided, my strategy → ask: Which parts of the strategy came from other people, and how did they see their input in it?

**Evaluation Criteria.** Starts with a diagnosis grounded in evidence (incidents, on-call load, cost, data growth, dependencies, what customers and internal users report) and in the team's own view; a small number of guiding choices tied to the year's main pressure, with explicit trade-offs and things the team will stop or defer; involves the team early so they shape it, and engages the director and dependent teams on the rules for taking new work; concrete first actions and measurable signals; regular reviews with criteria for changing course; keeps it short and visible; real example with what changed in people's behaviour and the candidate's own role, or an honest hypothetical.

## SFC-L5-02: Introducing design reviews to a team that sees them as bureaucracy

| | |
|---|---|
| **Template ID** | SFC-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Engineering practice / introducing process, lightweight reviews, measuring whether it helps |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "team": [5, 9, 15],
  "incident": ["a new connector that read every record of a source on each run and exhausted several customers' API allocations", "a change to how source records were matched that merged unrelated customers' profiles in one org", "a schema change that silently dropped a field from the usage reports customer admins rely on"],
  "pace": ["ship weekly and are proud of it", "have a release next month that leadership is watching", "were previously on a team where reviews took weeks"]
}
```

**Business Scenario.** You lead a team of {{team}} engineers building ingestion connectors and transformations for a customer data platform used by many customer orgs. Last quarter, {{incident}}. The design behind it was never seen by anyone but its author; in the post-incident review, two engineers said they would have spotted the problem in ten minutes. You want the team to review designs before building significant changes. The team, who {{pace}}, see design reviews as bureaucracy that slows them down.

**Problem Statement.** How do you introduce design reviews so that they catch problems like this without the team resenting them? Cover what you would change and what you would not; what counts as a change that needs a review; what a review looks like (who, how long, what document); how you get the team to adopt it rather than comply with it; how you know whether it is working; and what you would do if it is not. Then tell me about a real time you introduced or changed an engineering practice, and what happened, or say you have not and reason it through.

**Constraints.** You can set team practices, but the team's speed is something your director values and watches. You cannot hire a review board.

**Assumptions.** The team, incident and figures are hypothetical.

**Clarifications.**
- Q: Does every change need a review? | A: You decide the threshold. Most changes in the last quarter were small.
- Q: Does the team have any written designs today? | A: A few engineers write short notes in the ticket; most do not.
- Q: Who reviewed code? | A: Code review is routine and quick; it is the designs that nobody saw.
- Q: Will leadership support a short slowdown? | A: If you can show it reduces incidents like the one last quarter.

**Hints.**
1. Make the threshold explicit and narrow: changes that touch customers' limits, data matching, schemas others read, or anything hard to undo.
2. Make it cheap: a one-page template, an asynchronous review with a deadline, and a named reviewer, not a meeting for everyone.
3. Start with the people who are already persuaded, and measure something the sceptics care about.

**Follow-ups.**
1. What would the one-page design template ask for, and why each item?
2. Two months in, reviews are rubber stamps: approved within an hour with no comments. What do you do?
3. Your most productive engineer refuses to write designs for their changes. How do you handle it?
4. How would you show the director, after a quarter, whether reviews were worth the time?
5. In your real example, what did the practice catch, what did it cost, and what did you change after trying it?

**Follow-up rules.**
- when: mandatory, required, policy, enforce → ask: The team complies but resents it, and designs become box-ticking. How would you notice, and what would you change?
- when: template, checklist → ask: Which item on your checklist would have caught last quarter's incident, and how do you keep the checklist from growing forever?
- when: meeting, review meeting, weekly review → ask: Nine people in a one-hour meeting every week is a lot of time. What does it buy that an asynchronous review would not?
- when: metrics, measure, track → ask: Fewer incidents could also be luck. What would convince you, and the sceptics, that reviews made the difference?
- when: lead by example, i wrote the first → ask: What did you do when your own first design got real criticism in review?

**Evaluation Criteria.** Diagnoses what went wrong in the incident rather than blaming the author; introduces a narrow, explicit threshold and a cheap format (short template, asynchronous, a named reviewer, a deadline); involves the team in designing the practice and starts with willing engineers; reviews own designs first and accepts criticism visibly; measures outcomes the team cares about (incidents caught in review, rework avoided, time from design to ship) and adjusts or drops parts that do not help; handles a resistant high performer with curiosity and clear expectations; keeps the director informed with evidence; real example with what changed and what the candidate personally did, or an honest hypothetical.

## SFC-L5-03: A decision that has to be made this week on incomplete data

| | |
|---|---|
| **Template ID** | SFC-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Decision-making under uncertainty / reversible and irreversible choices, risk, communication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "gap": ["0.4% of orgs", "3% of orgs", "11% of orgs"],
  "deadline": ["the old pipeline's storage contract ends on Friday", "the old pipeline runs on hosts that will be decommissioned on Friday", "the old pipeline reads from a source table that is dropped on Friday"],
  "stake": ["API allocation alerts", "the daily limit-consumption statement customer admins see", "the usage figures account teams use in renewal conversations"]
}
```

**Business Scenario.** Your team has rebuilt the pipeline that computes per-org limit consumption, which drives {{stake}}. For three weeks the new pipeline has run in shadow beside the old one. For most orgs the two agree exactly, but for {{gap}} they differ by more than 1%, sometimes in one direction and sometimes in the other, and the team has explained only part of it (late events handled differently, and a time-zone boundary). The rest is not yet understood. You must decide this week whether to cut over, because {{deadline}}.

**Problem Statement.** Walk me through how you make this decision. Cover what you do in the first day to narrow the unknowns; how you decide which unknowns matter; what options you consider beyond "cut over" and "do not cut over"; how you judge which errors are reversible and which are not; who you involve and who decides; how you communicate the decision and its risks; and what you put in place to catch a wrong call quickly. Then tell me about a real time you made an important technical decision with incomplete information, and how it turned out, or say you have not and reason it through.

**Constraints.** The deadline cannot move. Customers are not told about pipeline changes unless something they see changes. The team is tired after three weeks of comparisons.

**Assumptions.** The pipelines, figures and deadline are hypothetical.

**Clarifications.**
- Q: Which pipeline is right when they differ? | A: For the explained part, the new one. For the rest, nobody knows yet.
- Q: Can both run for a while longer? | A: Not as they are: the deadline is fixed. Keeping part of the old pipeline running a little longer might be possible, at a cost you would have to justify.
- Q: Who owns the decision? | A: You do, as the technical lead; your director will back you if the reasoning is clear.
- Q: Do the differing orgs have anything in common? | A: Unknown. Nobody has looked at them as a group yet.

**Hints.**
1. Separate what you must know to decide from what you would like to know. Group the differing orgs before investigating them one by one.
2. Look for options that make the decision more reversible: cut over with a fallback, cut over for most orgs, or keep the old result for the uncertain group.
3. Decide what would make you reverse the decision, and set that up before you make it.

**Follow-ups.**
1. In the first day, what analysis would you run on the differing orgs, and why that first?
2. What options exist between cutting over everything and cutting over nothing, and what does each cost?
3. You cut over. On day two, one large org's statement is 4% higher than it would have been under the old pipeline, and their admin asks why. What do you do?
4. How would you explain the decision and its residual risk to your director in five sentences?
5. In your real example, what did you know, what did you not, and what would you do differently with hindsight?

**Follow-up rules.**
- when: delay, postpone, wait → ask: The deadline cannot move. What exactly happens on that day if you have not decided, and is that better or worse than deciding?
- when: rollback, roll back, fallback → ask: For how long can you roll back after the old pipeline is gone, and what would trigger it?
- when: the data shows, the numbers show, evidence → ask: Which part of the difference is still unexplained, and how did you weigh it?
- when: consensus, the team agreed, we decided → ask: Who made the final call, and how did you handle the engineer who disagreed?
- when: customers, customer admins, notify → ask: Customers are not told about pipeline changes unless something they see changes. Does something they see change here, and how do you know?

**Evaluation Criteria.** Frames the decision (what is decided, by whom, by when, what is at stake for {{stake}}); narrows the unknowns fast by grouping the differing orgs and sizing the effect; separates reversible from irreversible parts and looks for options that preserve reversibility (cut over with the old results archived for comparison, phased cutover, holding back the uncertain group, a manual check before anything customer-visible); sets explicit reversal triggers and monitoring; involves the right people without diffusing ownership; communicates the decision, the evidence and the residual risk plainly; looks after a tired team; real example with what was known, the decision, the outcome and the lesson, or an honest hypothetical.

## SFC-L5-04: Stepping back from being the team's best debugger so others can grow

| | |
|---|---|
| **Template ID** | SFC-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Growing others / delegation, knowledge sharing, on-call ownership, removing yourself as a bottleneck |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "system": ["the asynchronous job platform that runs customers' queued and scheduled work", "the pipeline that records automation runs, faults and timings for customer admins", "the identity resolution service that builds unified customer profiles"],
  "share": ["about half", "about two thirds", "nearly all"],
  "team": [5, 8, 12]
}
```

**Business Scenario.** You know {{system}} better than anyone; you wrote much of it. In the last six months you were pulled into {{share}} of its serious incidents, usually within minutes of the page, and you usually found the cause fast. Your manager says the team of {{team}} has stopped trying: on-call engineers escalate to you almost immediately. Two engineers have told you they would like to get better at debugging the system but feel there is no point while you are around. You are also needed on a new design that leadership cares about.

**Problem Statement.** What do you do? Cover how you change your own behaviour during incidents; how you transfer what you know (and what in your head is not written down); how you let others debug without putting customers at risk; how you decide when to step in; and how you know the team is getting better. Then tell me about a real time you deliberately made yourself less needed, or a time you were the bottleneck, and what happened, or say you have not and reason it through.

**Constraints.** Customers' incidents still need to be resolved quickly. You cannot simply stop answering pages overnight. Your manager wants you on the new design within a quarter.

**Assumptions.** The team, system and figures are hypothetical.

**Clarifications.**
- Q: Is there a runbook? | A: A short one, out of date. Most knowledge is in your head and in old chat threads.
- Q: Are the other engineers capable? | A: Yes. They are strong engineers who have not had the chance to build the mental model.
- Q: Do incidents take longer when you are not involved? | A: On the few occasions it happened, about twice as long.
- Q: Does your manager support slower incident resolution for a while? | A: Within limits: no customer-visible incident may run much longer because of it.

**Hints.**
1. Change your role in incidents from solver to coach: ask the questions you would ask yourself, out loud, and let the on-call engineer drive.
2. Turn your debugging into artefacts: how you narrow a problem, the dashboards and queries you use, the failure modes you have seen.
3. Agree in advance on when you take over, so the decision is not made in the heat of an incident.

**Follow-ups.**
1. The next page comes in at 14:00 and you can see the likely cause within two minutes. What do you do?
2. What exactly would you write down or build first so that others can debug {{system}} without you?
3. How would you measure, after a quarter, whether the team has become less dependent on you?
4. An incident goes badly while you are coaching: it runs 40 minutes longer than it would have with you driving. What do you tell your manager and the team?
5. In your real example, what did it cost you to step back, and what did the people who grew do with the room you gave them?

**Follow-up rules.**
- when: runbook, documentation, wiki → ask: Runbooks go stale as fast as the code changes. How do you keep yours true, and who owns it once you step back?
- when: pair, pairing, shadow → ask: Shadowing shows what you do but not why. How do you make your reasoning visible while you debug?
- when: step in, take over, escalate → ask: What is your rule for taking over, and did you agree it with the team before the incident or in the middle of it?
- when: on-call, rotation → ask: The on-call rotation includes engineers who joined last month. How do you make their first incident a learning one rather than a frightening one?
- when: i fixed, i found, i solved → ask: In that example, who else could have found it, and what would it have taken for them to?

**Evaluation Criteria.** Recognises the bottleneck as partly their own behaviour; changes their incident role to coach with clear, pre-agreed rules for taking over based on customer impact; turns tacit knowledge into artefacts (a debugging guide, dashboards, saved queries, a failure-mode catalogue, recorded walk-throughs) owned by others; uses game days or replays of past incidents for practice; measures progress (share of incidents resolved without them, time to resolve, escalations); protects customers while accepting some short-term cost; handles a slower incident honestly; gives others visible credit; real example with what they changed in themselves and the result, or an honest hypothetical.

## SFC-L5-05: Project deep dive, re-examined for multi-tenant enterprise CRM

| | |
|---|---|
| **Template ID** | SFC-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, tenant isolation and per-tenant limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["each tenant's data kept strictly apart, including in caches, logs and analytics", "each tenant limited so one cannot slow the others down", "each tenant able to add its own fields and objects without a code change", "each tenant's data kept in a region the tenant chooses"],
  "tenants": ["hundreds", "tens of thousands", "hundreds of thousands"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it served {{tenants}} of customer organisations from shared infrastructure, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the system served {{tenants}} of tenants with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The multi-tenant setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a multi-tenant system? | A: No. Any system that moved, stored or computed data others depended on; the multi-tenant part is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the multi-tenant question, start from the tenant id: where it enters, which keys and indexes carry it, and which shared resource it does not yet bound.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design assume a single customer? What breaks first with {{tenants}} of tenants?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: database per tenant, schema per tenant, separate database → ask: With {{tenants}} of tenants, what does a schema migration look like, and how long does it take to reach the last one?
- when: tenant id, tenant_id, org id → ask: Show me the one place where a query could forget the tenant id. What stops it reaching another tenant's rows?
- when: rate limit, quota, throttle → ask: One tenant is a thousand times larger than the median. Does your limit fit both, and who sets it?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible multi-tenant analysis that starts from the tenant id in every key and query path, names the single-customer assumptions, and addresses {{requirement}} incrementally (for example tenant-scoped keys with enforcement in the data-access layer and tests that prove it, per-tenant quotas and fair scheduling sized to tenant skew, metadata-driven custom fields stored as data rather than per-tenant schemas, tenant placement by region with routing and residency checks); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
