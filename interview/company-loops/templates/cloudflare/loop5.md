# Cloudflare · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a global network
that sits in front of customers' websites and applications (caching, DNS,
security rules, edge compute, analytics and log delivery). Every situation is
hypothetical, and none describes any company's hiring process or the values it
assesses. Answer from your own experience, or say plainly that you have not faced
it and reason it through. Never invent a story.

## CFX-L5-01: Writing the public post-mortem for an outage customers saw

| | |
|---|---|
| **Template ID** | CFX-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident communication / public post-mortem, blamelessness, honesty about data loss |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "minutes": [35, 70, 140],
  "cause": ["a configuration change that passed every automated check", "a shared database that failed over more slowly than designed", "a capacity limit in a dependency that nobody had measured"],
  "deadline_hours": [24, 48, 72],
  "lost": ["log batches for some customers' destinations from the first ten minutes may be lost", "no data was lost, but dashboards showed zero traffic for the whole window", "some customers' analytics for the window will be restated, and the exact number is not yet known"]
}
```

**Business Scenario.** You lead the team that owns per-zone analytics and log delivery for a global network. For {{minutes}} minutes, customer dashboards and the analytics API returned errors, and log delivery to customers' destinations fell behind. The trigger was {{cause}}. Your current understanding is that {{lost}}. Many customers noticed, some posted about it publicly, and leadership has asked you to write the public post-mortem within {{deadline_hours}} hours. The engineer whose change was involved is upset, two senior engineers still disagree about the root cause, and colleagues in communications and legal would prefer a shorter document with less detail.

**Problem Statement.** How do you produce the post-mortem? Cover what you establish before you write, what the document contains and in what order, how you describe impact (including anything uncertain or lost) without minimising it or speculating, how you keep it blameless while being specific about the cause, how you handle the disagreement about root cause and the requests for less detail, what you send directly to customers who lost data, and what happens after publication. Then tell me about a real incident write-up you led or contributed to, or say that you have not and reason it through.

**Constraints.** The deadline holds. Nothing in the post-mortem may be untrue or misleading, and nothing may identify the engineer. Remediation items must have owners and dates you can actually meet.

**Assumptions.** The outage, figures and people are hypothetical.

**Clarifications.**
- Q: Is the root cause known? | A: The trigger is known. Why it reached production and why recovery took {{minutes}} minutes are still argued.
- Q: Who approves publication? | A: Your director, after review by communications and legal; you own the content.
- Q: Do we know which customers lost data? | A: Not yet precisely; you have delivery logs per job that could tell you, with some work.
- Q: Can the post-mortem be updated later? | A: Yes, if updates are marked as such.

**Hints.**
1. Build the timeline in UTC from logs and tooling before anyone writes prose; it settles many arguments.
2. Customers need, in order: what happened to them, whether their data is affected, what they should do, and why it will not happen again.
3. Blameless means describing the system and the conditions that let a reasonable change cause harm, not hiding that a change was involved.

**Follow-ups.**
1. What is in the first paragraph, and why?
2. How do you describe the impact when the extent of data loss is still uncertain at publication?
3. Communications asks you to remove the timeline of the first 20 minutes, which shows the alert was missed. What do you do?
4. How do you resolve the root-cause disagreement in time, or how do you write the document if you cannot?
5. In your real example, what changed afterwards because of the write-up, and how do you know?

**Follow-up rules.**
- when: blameless, no blame → ask: The engineer asks to see the draft before it is published. Do you agree, and what if they want a sentence changed?
- when: legal, communications, comms, pr → ask: Where is the line between their review improving the document and their review making it misleading? Give a sentence you would refuse to change.
- when: root cause, five whys, contributing factor → ask: Two senior engineers name different root causes. What evidence would decide it, and what does the document say if you do not have it by the deadline?
- when: action item, remediation, follow-up → ask: Which remediation is the most important, how will customers know it was done, and what happens if it slips?
- when: we wrote, the team wrote, we published → ask: Which parts did you personally write or decide?

**Evaluation Criteria.** Establishes facts first (a UTC timeline from logs, impact quantified by product and customer, what is known versus uncertain); a document that leads with customer impact and data status, then timeline, cause, what went well and badly, and dated remediations with owners; honest about lost or uncertain data with a commitment to update; blameless but specific about the system conditions; handles review pressure by keeping accuracy non-negotiable while accepting clarity edits; resolves or transparently records the root-cause disagreement; contacts affected customers directly with specifics; follows through on remediations; real example with personal contribution and measurable change, or honestly hypothetical.

## CFX-L5-02: Leading an incident in a system your team does not own

| | |
|---|---|
| **Template ID** | CFX-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident command across team boundaries / authority, escalation, mitigation, joint review |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "owner": ["a platform team eight time zones away whose on-call has not acknowledged the page", "a team reorganised last month whose runbooks still name people who have left", "a team whose on-call is already leading a different incident"],
  "symptom": ["customers' log deliveries falling further behind every minute", "customer dashboards showing traffic drops that did not happen", "purge requests queuing for minutes instead of seconds"],
  "elapsed": [15, 30, 45]
}
```

**Business Scenario.** You are on call for the analytics and log-delivery services of a global network, and tonight you are the incident commander. For the last {{elapsed}} minutes customers have seen {{symptom}}. The evidence points to a shared message-transport service your services depend on, owned by {{owner}}. You have read access to its dashboards and, technically, write access to its configuration, because of an old permission nobody removed. A config change that looks like the fix is one command away.

**Problem Statement.** Walk me through the next hour. Cover how you confirm where the problem is, how you reach the owners, what you mitigate inside your own systems, whether and when you would touch the other team's system, how you communicate internally and with customers, and how you hand over and review afterwards. Then tell me about a real time you led or worked an incident in a system your team did not own, or say that you have not and reason it through.

**Constraints.** The other team's runbook says only their on-call may change the service's configuration, except under an escalation path that needs a senior incident manager's approval. Customer status updates are expected every 30 minutes during an incident.

**Assumptions.** The incident, people and times are hypothetical.

**Clarifications.**
- Q: Are you sure the transport service is the cause? | A: Its queue depth and error rates moved a minute before your symptoms began; nothing else changed in your services.
- Q: Is there a senior incident manager on call? | A: Yes, reachable by page.
- Q: Can your services work around the transport? | A: Partly: you can buffer longer, pause non-urgent consumers, or reduce what you send.
- Q: Who talks to customers? | A: A status-page owner on the support side, from your updates.

**Hints.**
1. Separate three jobs: restoring service, coordinating people, and communicating. Decide who does each.
2. What you can do safely in your own systems often buys the time the owners need.
3. "Can I?" and "may I?" are different questions; the escalation path exists for exactly this moment.

**Follow-ups.**
1. What do you do in the first ten minutes, in order?
2. The owner still has not answered and the backlog will start dropping data in 20 minutes. Do you run the config change? What has to be true first?
3. The owning team's on-call joins and disagrees with your diagnosis. How do you proceed?
4. How do you run the joint review afterwards so that both teams fix something, including the old write permission?
5. In your real example, what did you do that you would do differently now?

**Follow-up rules.**
- when: escalate, escalation, incident manager, page → ask: What exactly do you say in the page or call, and what decision do you ask them to make?
- when: rollback, roll back, change the config, fix it myself → ask: You run the change and it makes things worse. Who owns that outcome, and what would you want to have recorded beforehand?
- when: status page, customers, update → ask: Draft the first customer update. What do you say about data, and what do you not say yet?
- when: postmortem, post-mortem, review, retro → ask: The other team's review says your services' retries made the overload worse. How do you respond?
- when: we fixed, the team fixed, we decided → ask: What did you personally decide or do, and when?

**Evaluation Criteria.** Confirms the diagnosis with evidence and keeps an incident log; separates command, operations and communication roles; mitigates within own systems first (buffering, pausing consumers, shedding) to buy time; escalates early through the documented path with a clear decision request, and changes the other team's system only with that approval, recording it; communicates on a cadence with honest data status; welcomes the owners, shares evidence and hands over cleanly when they arrive; a joint, blameless review covering both teams' contributing factors and the stale permission; real example with personal actions and lessons, or honestly hypothetical.

## CFX-L5-03: An outside researcher reports a vulnerability in a pipeline that handles customer logs

| | |
|---|---|
| **Template ID** | CFX-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Security response / coordinated disclosure, scoping exposure, customer notification |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "channel": ["the public vulnerability disclosure programme", "an email to an engineer on your team they know personally", "a public post asking someone from the company to get in touch"],
  "evidence": ["a reproduction between two test accounts they own", "a written description with no reproduction", "a few log lines they say belong to another customer"],
  "disclosure_days": [14, 30, 90]
}
```

**Business Scenario.** You are the technical lead for a log-delivery pipeline that sends customers' request logs to destinations they configure. An outside security researcher reports, through {{channel}}, that under certain conditions one customer's delivery job could receive a few log lines belonging to another customer. They provide {{evidence}}. They say they intend to publish their findings in {{disclosure_days}} days. Your company has a security team, a documented disclosure policy and legal counsel, but you know the pipeline best.

**Problem Statement.** What do you do, from the moment the report reaches you? Cover how you acknowledge the researcher, who you involve and when, how you confirm or rule out the issue safely, how you scope which customers and data could have been affected and since when, how you contain and fix it, how decisions about notifying customers and the timing of public disclosure are made, and how you work with the researcher throughout. Then tell me about a real time you handled a security or privacy report, or say that you have not and reason it through.

**Constraints.** You may not test against real customers' data beyond what the security team approves. Customer log contents are not to be read except where needed to scope the exposure, and then only under the security team's process. Any notification obligations are decided with legal counsel, not by you alone.

**Assumptions.** The report, the pipeline and the timings are hypothetical. Describe your response, not technical details of the flaw.

**Clarifications.**
- Q: Is the researcher acting in good faith? | A: Assume so; they have reported issues responsibly before.
- Q: Do the delivery logs record which lines went to which job? | A: Per batch, with job id and byte counts, for 90 days; not per line.
- Q: Can the fix be shipped quickly? | A: A mitigation can ship today; a full fix will take about a week.
- Q: Does the researcher want a reward? | A: The programme offers one; they have not asked.

**Hints.**
1. The first hours are about acknowledging, containing and not destroying evidence; the cause can wait for the right people.
2. Scoping needs a precise question: which jobs, under which conditions, in which period, could have received which other jobs' data. Your logs answer some of it.
3. The researcher is a partner on timing; the disclosure date is negotiated, not dictated by either side.

**Follow-ups.**
1. What do you do in the first hour, and who is in the room by the end of it?
2. Your logs show the condition occurred for 40 jobs over six months, but not which lines crossed. How do you scope the exposure and what do you tell those customers?
3. The full fix needs a week longer than the researcher's {{disclosure_days}}-day date allows. What do you do?
4. Someone suggests quietly fixing it and not notifying anyone because the exposure is small. How do you respond?
5. In your real example, what did you change in how the team builds or reviews systems afterwards?

**Follow-up rules.**
- when: patch, hotfix, mitigation, fix → ask: Your mitigation ships today. How do you prove it closed the path, without reading customers' logs to check?
- when: notify, notification, disclose, disclosure → ask: Who decides whether and when customers are told, and what do you contribute to that decision?
- when: researcher, reporter, bounty, credit → ask: The researcher posts that the company is slow to respond. What is your next message to them, and who sends it?
- when: evidence, audit, logs → ask: How do you keep the evidence you need for scoping while respecting retention rules that would delete it next week?
- when: we handled, the team handled, security handled → ask: What was your personal role, as distinct from the security team's?

**Evaluation Criteria.** Acknowledges the researcher promptly and respectfully, and routes the report into the security process immediately rather than handling it alone; involves security, legal and leadership early with clear roles; reproduces safely and preserves evidence (including pausing deletion where policy allows); scopes exposure precisely from delivery records and is honest about what cannot be known; contains quickly, then fixes and verifies without reading customer data; supports notification decisions with facts and does not advocate hiding a real exposure; negotiates disclosure timing collaboratively and credits the researcher; drives lasting changes (tenant isolation tests, review checklists); stays at the level of response rather than flaw details; real example with personal contribution, or honestly hypothetical.

## CFX-L5-04: Introducing on-call to a team that has never had it

| | |
|---|---|
| **Template ID** | CFX-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Operational ownership / on-call design, alert quality, fairness, team buy-in |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer, analytics-engineer |

```params
{
  "team_size": [4, 6, 9],
  "reason": ["the team's log-delivery service became customer-facing", "a new contract promises an availability target for the team's analytics API", "the platform team that used to cover the service is handing it over"],
  "weeks": [4, 8, 12]
}
```

**Business Scenario.** You lead a team of {{team_size}} engineers who build analytics pipelines for a global network. Until now, problems were found in the morning and fixed during working hours. That is changing because {{reason}}, and the team must run a 24-hour on-call rotation in {{weeks}} weeks. Today the service has 140 alerts, mostly on internal metrics, that page nobody; there are few runbooks; two engineers have caregiving responsibilities at night; one engineer says they took this job partly because it had no on-call; and nobody on the team has been paged before.

**Problem Statement.** How do you introduce on-call? Cover what you define first, how you decide what pages a person and what waits until morning, how the rotation is built for a team of {{team_size}} and what makes it fair, how people are prepared, what support and recognition the team gets, how you handle the engineers with constraints and the one who objects, and how you will know after three months whether it works. Then tell me about a real time you introduced or changed an operational practice for a team, or say that you have not and reason it through.

**Constraints.** The {{weeks}}-week date is fixed. You cannot hire before then. On-call compensation and time off follow company policy, which you can ask your manager to clarify but not set yourself.

**Assumptions.** The team, service and numbers are hypothetical.

**Clarifications.**
- Q: Is there an availability target? | A: There will be one; you can propose its exact definition.
- Q: Could another team share the rotation? | A: Possibly a neighbouring team for a secondary rotation, if you arrange it.
- Q: Can the objecting engineer be excused? | A: That is a decision for you and your manager, within policy; say how you would make it.
- Q: How often does the service break today? | A: Roughly twice a month something affects customers, found the next morning.

**Hints.**
1. Start from what customers experience: define the objectives first, then page only on symptoms that threaten them.
2. A small team on a weekly rotation is on call often; the load per shift matters more than the schedule's shape.
3. People accept on-call more readily when they shape it: involve them in the alerts, runbooks and the rotation rules.

**Follow-ups.**
1. Which three alerts page someone on day one, and what happens to the other 140?
2. How is the rotation arranged for {{team_size}} people, including holidays, the two engineers with night-time constraints and handovers?
3. What do you do with the engineer who says they joined because there was no on-call?
4. After the first month, pages average five a week, mostly at night. What do you change?
5. In your real example, how did you measure whether the change worked?

**Follow-up rules.**
- when: slo, sli, error budget, objective → ask: Define one objective precisely for this service. Which alert fires when it is threatened, and how long before the budget runs out?
- when: rotation, schedule, weekly, follow the sun → ask: With {{team_size}} people, how many weeks a year is each on call, and is that sustainable alongside project work?
- when: runbook, playbook, shadow, shadowing → ask: The first real page is for something no runbook covers. What does the person on call do at 3 a.m.?
- when: compensation, time off, recognition → ask: Policy does not cover something your team needs. What do you ask for, from whom, and with what evidence?
- when: we agreed, the team decided, we rolled out → ask: Which decisions did you make yourself, and which did you leave to the team?

**Evaluation Criteria.** Starts from customer-facing objectives and pages only on symptoms that threaten them, with the rest demoted to tickets or deleted; runbooks for paging alerts, shadowing and reverse-shadowing before going live; a rotation sized for {{team_size}} with primary and secondary, fair handling of holidays and constraints, possibly shared with a neighbouring team; clear escalation and handover; makes the burden visible and secures policy support (compensation, time off after night pages) through the manager; handles the objecting engineer with respect, within policy, without special pleading or coercion; measures pages per shift, night pages, time to acknowledge and wellbeing, and cuts noise continuously; real example with personal contribution and measured outcome, or honestly hypothetical.

## CFX-L5-05: Project deep dive, re-examined for a global edge network

| | |
|---|---|
| **Template ID** | CFX-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, adapting a system to hundreds of edge locations |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the most important reliability decision you made"],
  "locations": [120, 250, 330],
  "edge_feature": ["a configuration change that must reach every location within seconds", "usage counted at every location and billed exactly once", "a location that keeps serving while cut off from the central systems", "per-customer data kept only in regions the customer chooses"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if its data were produced at {{locations}} edge locations around the world, close to users, rather than in a few data centres, and if it had to support {{edge_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes when the data is produced at {{locations}} locations with unreliable links between them and the core, and when the system must support {{edge_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The edge-network setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.
- Q: Did my system have to run at the edge? | A: No; the second half is reasoning, and you should say which parts are.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the edge question, start from what each location must be able to do on its own when its link to the core is down, and what must wait for the core.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. With data produced at {{locations}} locations, what is computed at the edge, what centrally, and what happens when a location's link is down for an hour?
4. How would you add {{edge_feature}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, spark, flink, airflow, clickhouse → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: idempotent, exactly once, deduplicate → ask: A location resends an hour of data after a reconnect. Show me exactly which key stops it being counted twice.
- when: replication, consistency, eventually consistent → ask: Which piece of your state can be stale at a location, for how long, and who would notice?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a credible edge analysis that separates what each location does alone from what needs the core, with idempotent transfer, buffering and a stated staleness for each kind of state; a concrete, incremental path to the edge feature; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
