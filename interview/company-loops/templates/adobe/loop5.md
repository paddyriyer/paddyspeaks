# Adobe · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of creative,
document and marketing software. Every situation is hypothetical, and none
describes any company's hiring process or the values it assesses. Answer from
your own experience, or say plainly that you have not faced it and reason it
through. Never invent a story.

## ADB-L5-01: An enterprise customer's audit request when your logs are incomplete

| | |
|---|---|
| **Template ID** | ADB-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Customer trust / honesty under audit, evidence reconstruction, cross-team response |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "customer": ["a regional bank", "a public-sector agency", "a hospital network"],
  "gap": ["11 hours", "3 days", "2 weeks"],
  "deadline": [5, 10, 20],
  "missing": ["administrator activity (who exported agreements and changed sharing settings)", "document download events for agreements already completed", "events from one region's integration API calls"]
}
```

**Business Scenario.** Your team owns the pipeline that records activity events for a document and e-signature service. An enterprise customer, {{customer}}, has asked for a complete activity report for the last six months as part of its own audit, due in {{deadline}} business days. While preparing it, your team finds that for {{gap}} four months ago the pipeline dropped {{missing}}. The agreements themselves and their signing audit trails are intact; the gap is in the activity log the customer asked for. Nobody outside your team knows yet, and the account team has already told the customer the report is "on track".

**Problem Statement.** Tell me what you do in the first day, before the deadline, and afterwards. Cover how you establish exactly what is missing, what can honestly be reconstructed from other sources and how it is labelled, who must know and in what order, what the customer is told and by whom, and how you prevent the gap from recurring. Then tell me about a real time you had to tell a customer or stakeholder that data they relied on was incomplete, or say that you have not and reason it through.

**Constraints.** You do not own the customer relationship, the contract or legal advice. Nothing may be added to the report that did not happen or that cannot be traced to a source. The deadline can be discussed, but only through the account team.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do other systems hold any of the missing activity? | A: Partly: request logs at the service front door and storage access logs exist for some of the period, kept for different lengths of time and with less detail.
- Q: Did any alert fire at the time? | A: A volume alert existed, but its threshold was set for daily totals and the gap did not cross it.
- Q: Do other customers have the same gap? | A: Very likely; you have not checked yet.
- Q: Does the customer's contract say anything about activity logs? | A: You do not know. Legal and the account team do.

**Hints.**
1. Measure the gap before you describe it: which events, which period, which customers, and how you know.
2. Reconstructed evidence is still useful if it is labelled as reconstructed, with its source and its limits.
3. The account team's "on track" makes telling them sooner more important, not less.

**Follow-ups.**
1. How do you establish the exact extent of the gap, and how sure can you be?
2. The front-door logs let you reconstruct part of the missing activity. How do you present it in the report so an auditor can rely on what it says and not on what it does not?
3. The account manager asks you to "fill the gap so the report looks complete". What do you say?
4. Other customers are affected too but have not asked. What should happen for them, and who decides?
5. In your real example, what did you personally say, to whom, and when?

**Follow-up rules.**
- when: backfill, fill the gap, fill in → ask: Which events in your backfill can be traced to a source record, and how does the report tell those apart from events that were recorded at the time?
- when: legal, lawyer, counsel → ask: While legal reviews, the deadline approaches. What do you do in parallel, and what do you not do until they answer?
- when: tell the customer, notify the customer, inform the customer → ask: Who tells them, with which facts, and what is the first sentence?
- when: alert, monitoring, threshold → ask: The existing alert measured daily totals. What signal would have caught a gap of {{gap}} within an hour of it starting?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Establishes the gap's extent with evidence (event types, period, customers affected, how measured) before describing it; escalates promptly to their manager, the account team, legal and security or privacy owners, especially given the "on track" message; never fabricates or silently backfills, and labels any reconstruction with source and limits; supports an honest customer message delivered by the owners, with a realistic date; checks and handles other affected customers; prevention with specific signals (per-type, per-hour completeness checks against source counts), owners and tests; real example with personal actions and outcome, or honestly hypothetical.

## ADB-L5-02: A feature that works for most users but fails accessibility for some

| | |
|---|---|
| **Template ID** | ADB-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Product quality and inclusion / launch decisions, accessibility as a requirement, process change |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, analytics-engineer, data-engineer, senior-data-engineer, staff-data-engineer |

```params
{
  "feature": ["a redesigned signing flow that completes in fewer steps", "a new usage dashboard for customer administrators", "a drag-and-drop report builder for web analytics customers"],
  "failure": ["screen-reader users cannot complete the main task", "keyboard-only users cannot reach the main action", "key information is shown by colour alone, with no text alternative"],
  "found_by": ["an accessibility review the week before launch", "a customer's support ticket during the beta", "an engineer on your team testing with assistive technology"],
  "days": [5, 12, 30]
}
```

**Business Scenario.** You lead the engineering work on {{feature}}. It tested well: most beta users finish their tasks faster than before, and the launch is in {{days}} days with marketing planned around it. Then {{found_by}} shows that {{failure}}. The old version, which the new one replaces, does not have this problem. The product manager wants to launch on time and fix the problem "in a follow-up".

**Problem Statement.** What do you do? Cover how you size the problem and the fix, the options for the launch (and who decides), how users who depend on assistive technology are served whatever is decided, and what changes so the next feature does not reach this point with this problem. Then tell me about a real time you found a serious quality problem late, or say that you have not and reason it through.

**Constraints.** You are not the product decision-maker. The fix is not trivial: your first estimate is two to three weeks. Some customers have accessibility requirements in their procurement terms; you do not know the details.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can the old version stay available? | A: Technically yes, for a while; product would rather not run both.
- Q: How many users are affected? | A: You do not know. Usage analytics cannot tell you who uses assistive technology, and should not try to.
- Q: Has the team built accessible interfaces before? | A: Some engineers have; there is no checklist or automated check in the build.
- Q: Who else should be involved? | A: There is a central accessibility specialist who advises several teams, and legal can advise on customer terms.

**Hints.**
1. Treat it as a defect in a requirement, not as polish: the question is how users who cannot use the feature are served on launch day.
2. There are more than two options: delay, launch with the old version still available, launch to part of the audience, or change scope.
3. The process fix belongs before design and in the build, not only in a review before launch.

**Follow-ups.**
1. How do you size the fix more precisely within a day, and who helps you?
2. The product manager says affected users are "a small percentage". How do you respond, and what data do you not try to collect?
3. Which launch option do you recommend, and what has to be true for it to be acceptable?
4. What changes in the team's process, and how would you know it worked on the next feature?
5. In your real example, what did you personally push for, and what was the outcome for the affected users?

**Follow-up rules.**
- when: follow-up, fast follow, later release → ask: What do users who rely on a screen reader or keyboard do between launch day and the follow-up, and who has committed to its date?
- when: percentage, small number, few users → ask: How would you know how many users are affected, and is "few" a reason that holds when the old version is being removed?
- when: delay, postpone, push the launch → ask: Marketing has already committed the date. What do you offer that keeps as much of the launch as possible?
- when: automated, linter, axe, checker → ask: Automated checks find some problems but not whether a task can be completed. What else goes into the process?
- when: we decided, the team decided, we agreed → ask: What did you personally recommend, and to whom?

**Evaluation Criteria.** Treats accessibility as a requirement and the gap as a defect; sizes the fix quickly with the specialist and people who use assistive technology; lays out real options (delay, keep the old version available as an equal path, staged launch, scope change) with what each costs and who decides; refuses to estimate affected users by profiling assistive-technology use; makes sure an accessible path exists on launch day whatever is decided; brings in legal on customer terms without drawing legal conclusions; process change early in design and in the build (criteria in definition of done, automated checks plus manual testing with assistive technology); real example with personal contribution and outcome, or honestly hypothetical.

## ADB-L5-03: Adopting a technology the team does not know versus one it knows well

| | |
|---|---|
| **Template ID** | ADB-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical decision-making / evaluation, reversibility, operational readiness, team capability |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "choice": ["a stream processor for the web analytics hit pipeline, instead of extending the hourly batch jobs the team knows", "an open table format for the document-events lake, instead of the warehouse loads the team runs today", "a workflow orchestrator new to the team, instead of its own scheduler for the stock ingestion jobs"],
  "team": [4, 7, 12],
  "champion": ["a new hire who ran it at a previous job", "your manager, after a conference talk", "you"],
  "window": ["one quarter", "two quarters"]
}
```

**Business Scenario.** Your team of {{team}} engineers must deliver a large improvement within {{window}}. The proposal on the table is {{choice}}. It is championed by {{champion}}. The new option looks better on paper for this problem, but no one on the team except possibly its champion has run it in production, and the team is already on call for the existing pipelines.

**Problem Statement.** How do you decide? Cover what evidence you gather and how, the criteria and who agrees them, how you reduce the risk of the option you choose, what it means for on-call and for the people on the team, and how the decision is recorded and revisited. Then tell me about a real time you chose between a familiar and an unfamiliar technology, and what happened, or say that you have not and reason it through.

**Constraints.** The delivery date does not move. No extra headcount this year. Whatever runs in production must have at least two people able to operate it at night.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the familiar option good enough? | A: It can probably meet the requirement with more work and more cost; it is not clear by how much.
- Q: Is there company-wide guidance on the technology? | A: No standard either way; another team uses it lightly.
- Q: How does the team feel? | A: Split. Some are excited to learn it; some worry about being paged for something they do not understand.
- Q: Who makes the final decision? | A: You, as the technical lead, with your manager's agreement.

**Hints.**
1. Write the criteria before you compare the options, and include running it at 3 a.m., not only building it.
2. A time-boxed spike with exit criteria turns opinions into evidence.
3. Ask what it costs to reverse the decision in six months, for each option.

**Follow-ups.**
1. What is in your time-boxed evaluation, how long is it, and what result would make you choose the familiar option?
2. The champion is {{champion}}. How does that change how you run the evaluation and the conversation?
3. You choose the new technology. What has to be true before it takes production traffic and joins the on-call rota?
4. Halfway through the {{window}}, the new option is behind plan. What signals tell you to switch back, and who decides?
5. In your real example, what did you personally decide, and what would you decide differently now?

**Follow-up rules.**
- when: proof of concept, poc, spike, prototype → ask: What exact result from the spike would make you say no, and did you write it down before you started?
- when: learn, training, upskill → ask: How long until two people can operate it at night, and what does on-call look like until then?
- when: resume, hype, shiny → ask: How do you tell the team member who is excited about it that the answer is no, if it is?
- when: reversible, two-way door, rollback → ask: What does reversing it cost in six months, in engineer-weeks, and how did you estimate that?
- when: we decided, the team decided, we agreed → ask: What was your own position, and did it change?

**Evaluation Criteria.** Criteria agreed before comparison (fit to the requirement with numbers, operability, failure modes, team capability, cost, reversibility, hiring and support); a time-boxed spike on the real workload with written exit criteria; separates the merits from who champions it and handles the champion respectfully; risk reduction for the chosen option (incremental migration, parallel run, fallback path, at least two operators before on-call, runbooks); considers the people on the team (learning time, on-call fears) with concrete plans; a written decision record with revisit triggers and a switch-back signal; real example with outcome and personal judgement, or honestly hypothetical.

## ADB-L5-04: Mentoring an engineer moving from analytics into data engineering

| | |
|---|---|
| **Template ID** | ADB-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Growing people / skills assessment, stretch with safety, feedback, measurable progress |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, data-engineer |

```params
{
  "background": ["three years of SQL reports and dashboards for product teams", "a strong analyst who built the team's most-used metric definitions", "an analytics engineer who has only worked inside the warehouse"],
  "pipeline": ["the daily usage rollup for the document services", "ingestion of stock contributor upload events", "late-hit handling in the web analytics pipeline"],
  "months": [3, 6, 9]
}
```

**Business Scenario.** An engineer with {{background}} has moved into your data engineering team, and your manager asks you to mentor them. The goal is that in {{months}} months they own {{pipeline}}: they build changes to it, review others' changes, and take their share of on-call for it. They are confident with SQL and with what the numbers mean, and less so with version control workflows, testing, distributed processing, backfills and production operations. They are keen, and a little worried about being paged.

**Problem Statement.** How do you approach it? Cover how you find out where they actually are, the plan and its milestones, how you choose their first pieces of work, how you give feedback, how you protect both them and the pipeline while they learn, and how you and they will know it has worked. Then tell me about a real time you helped someone grow into a new kind of role, or say that you have not and reason it through.

**Constraints.** You keep your own delivery commitments; mentoring is part of your time, not all of it. The pipeline has paying customers downstream. The engineer's manager, not you, writes their performance review.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: What does the engineer want? | A: To become a data engineer and stay one; they have said they would like to keep using their analytics strengths.
- Q: Is there documentation for the pipeline? | A: Some, out of date. Two people know it well, you and one other engineer.
- Q: What does on-call involve? | A: About one page a week, mostly late inputs and occasional backfills.
- Q: Can you choose their first tasks? | A: Yes, with the team lead's agreement.

**Hints.**
1. Start from their strengths: someone who knows what the numbers mean can write the tests and checks the pipeline lacks.
2. Choose work that is real but recoverable, and widen it as evidence grows.
3. Agree observable milestones together, so progress is visible to them, to you and to their manager.

**Follow-ups.**
1. How do you find out what they already know and where the real gaps are, without making it an exam?
2. What are their first three pieces of work, and why in that order?
3. Their first production change causes a small incident. What do you do that day, and in the following week?
4. Halfway through, progress is slower than planned. How do you tell whether the plan, the support or the fit is the problem, and what do you say to them?
5. In your real example, what did you personally do, and how did you know it had worked?

**Follow-up rules.**
- when: pair, pairing, shadow, shadowing → ask: When do you stop driving and let them drive, and how do you decide they are ready?
- when: code review, review → ask: Your reviews of their code are long. How do you keep them useful without overwhelming them?
- when: on-call, paged, pager → ask: When does their first night on call happen, and what is in place so a page they cannot solve does not become a crisis?
- when: feedback → ask: Give me an example of feedback you would give in the first month, word for word.
- when: manager, performance review → ask: What do you share with their manager, and do they know what you share?

**Evaluation Criteria.** Finds the starting point through real work and conversation rather than a test; builds on their analytics strengths (tests, data checks, metric definitions) while closing specific gaps (version control, testing, distributed processing, idempotent backfills, operations); a written plan with observable milestones agreed together; first tasks real but recoverable, widening in scope; safety for the pipeline and the person (review, staged rollout, shadowed then reverse-shadowed on-call, runbooks); timely, specific, kind feedback, and an incident treated as learning; transparent coordination with their manager; adjusts the plan when progress is slow and distinguishes plan, support and fit; real example with personal actions and evidence of growth, or honestly hypothetical.

## ADB-L5-05: Project deep dive, re-examined for creative, document and marketing software

| | |
|---|---|
| **Template ID** | ADB-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, content exclusion, restatement and provenance |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["document and agreement contents never readable by the analytics that measures them", "the same numbers in a customer's usage report, their invoice and their audit trail", "history restated whenever a customer changes how their data is classified", "provenance recorded for every asset the system produces or edits"],
  "scale": ["thousands of enterprise customers", "tens of millions of individual users", "billions of events a day from customers' sites and apps"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change in creative, document and marketing software, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The creative, document and marketing setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a document or analytics system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one record: where it enters, which fields it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: free text, json blob, payload → ask: A free-form field in your events could carry anything a client puts in it. How would you guarantee it never carries document contents?
- when: overwrite, update in place, reprocess → ask: When history is recomputed, what do readers see while it runs, and can you get the previous numbers back?
- when: metadata, provenance, lineage → ask: An asset is edited, exported to another format and combined with two others. What does its provenance record say, and what could make that record wrong?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example typed event schemas with no free text and producer-side enforcement; one billable table feeding report, invoice and audit; versioned processed data built beside the live version with an atomic switch; provenance records attached at each step with ingredients linked, described as metadata rather than proof of authenticity); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
