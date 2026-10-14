# Microsoft · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a company that
runs a public cloud, a productivity and collaboration suite with an AI
assistant, a desktop operating system and a gaming network. Every situation is
hypothetical, and none describes any company's hiring process or the values it
assesses. Answer from your own experience, or say plainly that you have not
faced it and reason it through. Never invent a story.

## MSF-L5-01: A consent-setting change removes half or more of the telemetry behind a key metric

| | |
|---|---|
| **Template ID** | MSF-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Metrics under privacy change / consent, bias, honest communication with leadership |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "metric": ["weekly active devices using a new built-in search feature", "a monthly app reliability score reported to the product's leadership", "the adoption figure for a productivity feature in the quarterly business review"],
  "remaining": ["35%", "30%", "20%"],
  "weeks": [2, 4, 8]
}
```

**Business Scenario.** Your team owns the data behind {{metric}}. It is computed from optional diagnostic data, which devices send only when their users allow it. A redesigned privacy settings page, shipped by another team, now asks every user to choose again, and the share of devices still sending optional data has fallen from about two thirds to about {{remaining}}. The metric fell sharply the week the change shipped. The product's leaders are asking whether something real changed, and the next review that depends on the metric is in {{weeks}} weeks. One product manager has suggested making the optional-data prompt "less prominent".

**Problem Statement.** How would you handle it? Cover how you establish what actually changed (the product or the measurement), what you tell leadership first and when, how you rebuild a metric that is honest about the smaller and different population, which parts can move to data every device sends and which cannot, how you respond to the suggestion about the prompt, and how you stop the next settings change from surprising you. Then tell me about a real time a change in data collection or definition broke a metric you owned, or say that you have not and reason it through.

**Constraints.** Users' consent choices are not to be worked around, nudged against or inferred. Required diagnostic data, which every device sends, is minimal and may not contain the feature's usage events. You do not own the settings page or the consent design. The privacy team must approve any new use of data.

**Assumptions.** The situation and figures are hypothetical. Nothing here describes any product's actual consent design or data categories.

**Clarifications.**
- Q: Do the devices that still send optional data look like the rest? | A: You do not know yet; early signs are that they skew towards managed business devices and enthusiasts.
- Q: Is there any signal from every device? | A: Required data includes device counts by build and a few basic health signals; it does not include feature usage.
- Q: Who decides how the metric is reported? | A: The product's leadership, on your recommendation.
- Q: Was the settings change announced to your team? | A: It was in a release note that nobody on your team read.

**Hints.**
1. Separate the measurement change from any real change: look at metrics that did not depend on optional data, and at the devices whose consent did not change.
2. A smaller sample is not the problem; a biased one is. Decide what you can estimate, with what uncertainty, and say so.
3. Treat the discontinuity as a fact to report, not a number to smooth over.

**Follow-ups.**
1. What do you tell the product's leaders in the first 48 hours, and what do you deliberately not claim yet?
2. How would you estimate the metric for all devices from the {{remaining}} that still report, and how would you check the estimate?
3. The product manager presses on making the prompt less prominent. What do you say, and to whom?
4. What would you change so that the next consent or settings change is known to your team before it ships?
5. In your real example, what did you personally do, and what did the people who used the metric decide differently because of it?

**Follow-up rules.**
- when: weight, weighting, reweight, extrapolate → ask: The devices that still report differ from the rest in ways you can only partly observe. How would you know your weighting is wrong?
- when: prompt, default, opt-in, nudge → ask: Making the prompt less prominent would raise the number. Why is that not your call to make, and how do you say no without ending the conversation?
- when: required data, every device, basic telemetry → ask: Moving the metric to data every device sends needs the privacy team's approval and may not be appropriate. What would you ask them, and what would you accept as an answer?
- when: dashboard, annotate, footnote → ask: A leader screenshots the chart without the footnote and shows the drop to their own leadership. What should have been different?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or say, and to whom?

**Evaluation Criteria.** Diagnoses measurement versus behaviour with evidence before reporting; communicates early and honestly, with what is known and unknown; rebuilds the metric with explicit uncertainty and bias checks, or redefines it, with a clear break in the series; respects consent absolutely and declines to nudge users, while keeping the relationship with the product manager; works through the privacy team for any new data use; puts in place an early-warning path for consent and settings changes; real example with measurable effect and personal contribution, or honestly hypothetical.

## MSF-L5-02: Integrating an acquired company's data stack without losing its best people

| | |
|---|---|
| **Template ID** | MSF-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Integration leadership / migration planning, retention, respecting a different engineering culture |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "acquired": ["a games studio", "a developer-tools company", "a security analytics start-up"],
  "engineers": [8, 20, 45],
  "their_stack": ["self-hosted open-source tools on their own servers", "managed services on a different public cloud", "one large database and years of hand-written scripts"],
  "months": [6, 12, 18]
}
```

**Business Scenario.** Your company has acquired {{acquired}}. Its {{engineers}} data and platform engineers run {{their_stack}}, which works for them and which they are proud of. Leadership wants the acquired product's data on the company's own cloud platform and in the shared reporting within {{months}} months, partly because a hosting contract ends then. You have been asked to lead the data integration. Two of the acquired company's most senior engineers have told a colleague they will leave if they are "told to rewrite everything in someone else's tools".

**Problem Statement.** How would you lead it? Cover how you learn what the acquired stack does and why before proposing anything, what must move by the deadline and what can wait, how you decide what to keep, replace or run side by side, how you involve the acquired engineers in those decisions, how you keep their product reliable for its customers during the move, and how you would know you are losing people before they resign. Then tell me about a real time you led a migration or integration across teams with different ways of working, with its outcome, or say that you have not and reason it through.

**Constraints.** The hosting contract end date is fixed. The acquired product's customers must not see an outage or a data loss. You do not manage the acquired engineers; their own leader does. Security and compliance reviews of the acquired stack must pass before it connects to shared systems.

**Assumptions.** The situation and figures are hypothetical, and no real acquisition is described.

**Clarifications.**
- Q: Has anyone mapped the acquired stack? | A: Not formally. Their engineers know it well; the documentation is thin.
- Q: Is a full rewrite expected? | A: Leadership expects the data on the company's platform; how is your proposal.
- Q: What does "shared reporting" need? | A: A handful of business metrics computed the same way as for the company's other products.
- Q: Do the acquired engineers have a say? | A: Formally, only through their leader. In practice, nothing will work without them.

**Hints.**
1. Inventory before opinions: what runs, what it costs, what depends on it, and which parts carry the most risk.
2. The deadline applies to hosting, not to every tool. Separate what must move from what you would like to change.
3. Give the acquired engineers ownership of decisions inside clear constraints, and make their expertise visible to the wider organisation.

**Follow-ups.**
1. What do you do in your first two weeks, and whom do you meet first?
2. Their scheduling tool is better than the company's for their workloads. Do you keep it? On what evidence, and who decides?
3. Halfway through, the migration is a month behind. What do you cut or change, and how do you tell leadership?
4. One of the two senior engineers resigns anyway. What do you do that week?
5. In your real example, what did you get wrong about the other team's way of working, and how did you find out?

**Follow-up rules.**
- when: standardise, standardize, rewrite, replace everything → ask: Which of those replacements is needed by the deadline, and which is your preference? What would the acquired engineers say about each?
- when: lift and shift, lift-and-shift, rehost → ask: Moving as it is meets the deadline. What risk do you carry afterwards, and when do you pay it down?
- when: retention, retain, attrition → ask: What would you see in the first month that tells you someone is about to leave, and what can you actually do about it without managing them?
- when: parallel run, side by side, dual run → ask: How long do you run both, how do you decide the new one is correct, and what does running both cost?
- when: we decided, the team decided, we agreed → ask: Which decision did you personally make, and which did you leave to the acquired engineers?

**Evaluation Criteria.** Learns the existing stack and its reasons before proposing; separates the hard deadline from optional changes; a phased plan with parallel runs, reconciliation and rollback that protects the product's customers; involves the acquired engineers in decisions with real ownership and visible credit; works through their leader rather than around them; treats retention as a leadership responsibility with early signals; handles slippage with explicit trade-offs; real example with measurable outcome and personal contribution, or honestly hypothetical.

## MSF-L5-03: The team's budget is cut by a third — deciding what stops

| | |
|---|---|
| **Template ID** | MSF-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation under constraint / stopping work, stakeholder communication, cost evidence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "team": [9, 18, 40],
  "cloud": ["$1.5 million", "$6 million", "$20 million"],
  "commitments": ["usage reports for tenant administrators, an internal metrics platform and a long-running migration", "a data export that enterprise customers download, a feature experiment platform and a set of executive dashboards", "a nightly data pipeline for a billing system, an anomaly detection service and a self-serve query service"]
}
```

**Business Scenario.** You lead a data platform team of {{team}} engineers that spends about {{cloud}} a year on cloud compute and storage. It runs {{commitments}}, plus dozens of smaller pipelines, reports and requests built up over years. Next financial year the team's budget, people and cloud spend together, is cut by a third. You are asked to come back in three weeks with what the team will stop doing, what it will do differently, and what the cut will cost the people who depend on you.

**Problem Statement.** How would you decide and carry it out? Cover what evidence you gather (usage, cost, who depends on what, what is required by contract or law), how you decide what stops, what is reduced and what is protected, how you find savings that do not stop anything, how you involve your team and how you tell the people who lose something, how you shut things down safely, and how you look after the team through it. Then tell me about a real time you had to stop work that someone valued, with its outcome, or say that you have not and reason it through.

**Constraints.** Some outputs are promised to customers in their contracts. People decisions follow the company's own process, which you do not control. The cut is decided; your job is how it lands. Nothing is switched off without notice to its users.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do you know who uses each report and pipeline? | A: Partly. Query logs and access logs exist; nobody has joined them to the list of outputs.
- Q: Can the cut come only from cloud spend? | A: Partly; how much is up to your evidence. The cut covers both.
- Q: Will stakeholders accept less? | A: Some will; several will escalate.
- Q: Is the team aware? | A: There are rumours; nothing has been said officially.

**Hints.**
1. Build one list of everything the team runs, with cost, users, last use and what breaks if it stops.
2. Look for waste before value: unused outputs, over-provisioned compute, data kept far longer than any use requires.
3. Stopping something well is work: notice, an alternative or an export, a date, and a way back if you were wrong.

**Follow-ups.**
1. Walk me through how you would rank the team's outputs. What does each one's score depend on?
2. A senior leader's favourite dashboard costs more than it is worth by your measure. What do you do?
3. How much of the cut can come from efficiency (compute, storage, retention) before anything stops, and how do you check the estimate?
4. After you switch off a pipeline, a team you did not know about says their monthly report is broken. What happens next?
5. In your real example, what did you stop, who objected, and what did stopping it actually save or cost?

**Follow-up rules.**
- when: cost per, usage, query logs, access logs → ask: A report is opened once a quarter, by the finance team, for a filing. Does low usage mean low value?
- when: everyone takes a cut, across the board, equal cut → ask: What does an equal cut to every service do to the ones that cannot run at two thirds?
- when: automate, automation, optimise, optimize → ask: Which efficiency saving is realistic within the year, and what does it cost the team to deliver it while also absorbing the cut?
- when: deprecate, deprecation, sunset, shut down → ask: What notice do the users get, what do they move to, and how do you find the users you do not know about?
- when: morale, burnout, layoff, redundancy → ask: What do you tell the team before the decisions are final, and what do you keep to yourself?

**Evaluation Criteria.** Evidence first (inventory with cost, users, dependencies and contractual or legal obligations); efficiency savings separated from stopping work and estimated honestly; explicit criteria for stopping, reducing and protecting; safe shutdowns with notice, alternatives, scream tests where appropriate and a way back; honest communication with stakeholders and escalation of real trade-offs; care for the team within the company's process; real example with measurable outcome and personal contribution, or honestly hypothetical.

## MSF-L5-04: Leading a cross-organisation working group with no authority over its members

| | |
|---|---|
| **Template ID** | MSF-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Influence without authority / shared standards across product groups, decision-making |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "goal": ["one definition of an active user that every product group reports the same way", "a shared schema for usage events that product groups send to a common store", "a common retention standard for diagnostic and usage data across product groups"],
  "groups": [4, 7, 12],
  "months": [3, 6]
}
```

**Business Scenario.** Leadership has asked for {{goal}}, and has asked you to lead a working group of engineers and analysts from {{groups}} product groups (chat and meetings, mail and calendar, documents, the operating system and others) to deliver it in {{months}} months. None of the members report to you; each has their own manager, roadmap and reasons why their product is different. Two earlier attempts at the same thing ended with a document nobody followed.

**Problem Statement.** How would you lead it? Cover how you find out why the earlier attempts failed, how you set up the group (who, how often, how decisions are made and recorded), how you get from {{groups}} different practices to one standard, how you handle a product group that disagrees or does not show up, how you get the standard adopted and not just agreed, and how you will know it worked. Then tell me about a real time you led a group of peers who did not report to you to a decision, with its outcome, or say that you have not and reason it through.

**Constraints.** You have no authority over the members or their roadmaps. Leadership will back a decision but will not make it for you. Each product group's existing reports must keep working while it moves to the standard.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Why did the earlier attempts fail? | A: People give different reasons; that is for you to find out.
- Q: Does each product group have someone empowered to agree? | A: Some sent senior engineers who can commit; others sent whoever was free.
- Q: Can the standard allow product-specific differences? | A: Leadership wants comparable numbers; you decide how much variation is acceptable.
- Q: Who maintains the standard afterwards? | A: Undecided.

**Hints.**
1. Make the cost of the current situation concrete with data: where numbers disagree today and what that has led to.
2. Agree how decisions are made before arguing about the decisions themselves.
3. Adoption needs a cheap path: tooling, a reference implementation, a migration plan per group, and a named owner afterwards.

**Follow-ups.**
1. What do you do in the first two weeks, before the first meeting of the full group?
2. Two product groups have incompatible definitions and both are right for their products. How do you get to a decision?
3. One group's representative stops attending and their manager says the work is not a priority this half. What do you do?
4. The standard is agreed. Three months later, only two groups have adopted it. What went wrong, and what do you change?
5. In your real example, what decision did the group make that you would not have made alone?

**Follow-up rules.**
- when: consensus, everyone agrees, unanimous → ask: With {{groups}} groups, what happens when one never agrees? How is the decision made then?
- when: escalate, escalation, leadership → ask: What exactly do you ask leadership for, and what do you lose with the group if you go to them?
- when: document, spec, specification → ask: The last two attempts produced a document too. What makes yours different on the day after it is agreed?
- when: pilot, reference implementation, tooling → ask: Which product group goes first, why them, and what do they get out of it?
- when: we decided, the team decided, we agreed → ask: What did you personally propose, and how did it change in the group?

**Evaluation Criteria.** Learns from the failed attempts before starting; makes the problem concrete with evidence; sets up the group with the right representatives, a clear decision process and a written record; reaches a decision that allows justified differences while keeping numbers comparable; handles disengaged groups through their managers and leadership sponsorship without coercion; drives adoption with tooling, pilots, migration plans and an owner for the standard; measures success by adoption and agreement of numbers; real example with outcome and personal contribution, or honestly hypothetical.

## MSF-L5-05: Project deep dive, re-examined for enterprise customers inside compliance boundaries

| | |
|---|---|
| **Template ID** | MSF-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, enterprise compliance requirements |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the most important reliability decision you made"],
  "requirement": ["each customer's data stored and processed only inside one chosen geography", "encryption with keys the customer holds and can revoke at any time", "legal holds that stop deletion of a customer's data until the hold is lifted", "a complete audit log of every access to customer data that customers can export"],
  "tenants": ["2,000", "40,000", "300,000"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change to serve {{tenants}} enterprise customer organisations, each of which can require {{requirement}}. The requirement is this exercise's; treat it as a product commitment, and do not reason about what any law demands.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes when each of {{tenants}} customer organisations can require {{requirement}}: where data lives and moves, which components are affected (storage, caches, logs, backups, analytics copies, support access), and how you would prove to a customer that the commitment holds. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The enterprise setting and its requirements are hypothetical and are not legal advice.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.
- Q: Did my system ever serve enterprise customers? | A: It does not need to have; the second half is reasoning, and you should say which parts are.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the enterprise question, list every copy of a customer's data your system makes (including logs, caches, backups and derived tables) before deciding what has to change.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which copies of a customer's data in your system would the requirement affect, and which would you have forgotten at first?
4. How would you prove to a customer's auditor that the requirement holds, continuously rather than once?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, spark, flink, airflow, postgres, cassandra → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: backup, backups, snapshot → ask: A customer revokes access or a hold changes what may be deleted. What happens to the copies in your backups?
- when: logs, logging, debug → ask: Your logs and traces contain identifiers and sometimes payloads. Where do they go, and does the requirement cover them?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a complete inventory of where customer data lives, including logs, caches, backups and derived copies; a credible, per-tenant design for the requirement with its cost and failure modes; continuous evidence that the commitment holds; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
