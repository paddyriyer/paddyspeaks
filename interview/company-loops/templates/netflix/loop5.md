# Netflix · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a global video
streaming service. Every situation is hypothetical, and none describes any
company's hiring process, culture or the values it assesses. Answer from your
own experience, or say plainly that you have not faced it and reason it through.
Never invent a story.

## NFX-L5-01: A mandatory review gate that every team waits on

| | |
|---|---|
| **Template ID** | NFX-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Process change / removing a control safely, evidence, replacing what it protected |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "gate": ["every schema change to the shared viewing-history tables needs approval from a weekly review board, introduced after a column rename silently broke the daily title-popularity numbers", "any new pipeline that reads playback events needs a manual sign-off from the data platform team, introduced after a job copied events with device identifiers into an unprotected bucket", "every new experiment metric needs approval from a central analytics group, introduced after a metric defined the wrong way round reversed the conclusion of a large test"],
  "wait": ["6 working days", "11 working days", "three weeks"],
  "teams": [12, 25, 40]
}
```

**Business Scenario.** You lead data platform engineering for the streaming service's viewing data. Two years ago a rule was introduced: {{gate}}. Today the median wait for approval is {{wait}}, and {{teams}} teams depend on it. Some teams have started working around the gate by copying data into their own tables, which the gate never sees. Your director has asked you to remove or replace the gate this quarter. The people who run it believe it is the only thing preventing the original incident from happening again.

**Problem Statement.** How do you approach it? Cover how you find out what the gate actually catches today, what replaces each protection it provides, how you roll the change out and how you could roll it back, how you bring along both the reviewers and the teams who wait on them, how you will know whether things got worse, and what you do if an incident happens after the change. Then tell me about a real time you removed or simplified a process or control, with what happened, or say that you have not and reason it through.

**Constraints.** The original incident must not recur. You do not manage the reviewers. The teams' workarounds carry risks of their own. You have two engineers for this for one quarter.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is there data on what the gate rejects? | A: Every review is a ticket with its outcome and comments. Nobody has analysed them.
- Q: Do the reviewers want to keep the gate? | A: Most do. One of them built it after the original incident and feels personally responsible for it.
- Q: Who decides? | A: Your director, who wants a recommendation backed by evidence.
- Q: Could the gate stay for some changes? | A: Yes; that is your call to make and justify.

**Hints.**
1. Treat the gate as a bundle of checks. For each one, ask what it caught in the last year and whether it could be caught automatically, after the fact, or only by a person.
2. The workarounds are evidence: the risk the gate exists for may already be leaking around it.
3. Change it in steps you can reverse: a pilot group, measured outcomes, then wider.

**Follow-ups.**
1. What would you look for in two years of review tickets, and what finding would change your plan?
2. Which protections become automated checks, which become audits after the fact, and which stay as human review for a narrow set of changes?
3. How do you work with the reviewer who built the gate?
4. Three weeks after the change, a change that would once have been reviewed breaks a downstream report. What do you do, and do you bring the gate back?
5. In your real example, how did you measure whether removing the control was the right call?

**Follow-up rules.**
- when: automate, automated, automation, ci → ask: Which of the gate's past catches would your automated checks miss, and who notices those now?
- when: pilot, phased, rollout, gradual → ask: Which teams go first, why them, and what result would make you stop?
- when: remove, eliminate, abolish, scrap → ask: Name one thing the gate caught that nothing in your plan would catch. If there is none, how did you check?
- when: workaround, shadow, copies → ask: What do you do about the copies teams have already made outside the gate?
- when: we decided, the team decided, we agreed → ask: What did you personally decide, and who disagreed with it?

**Evaluation Criteria.** Establishes what the gate catches from evidence (ticket analysis, near misses, the workarounds) before deciding; replaces each protection with an automated check, an after-the-fact audit or a narrow human review, rather than simply deleting it; reversible, measured rollout with stop criteria; treats the reviewers, especially the gate's author, as partners whose knowledge goes into the checks; addresses the existing workarounds; a clear plan for the first incident afterwards that neither panics nor ignores it; real example with measurable outcome and personal contribution, or honestly hypothetical.

## NFX-L5-02: Inheriting a team whose last two projects were cancelled

| | |
|---|---|
| **Template ID** | NFX-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team leadership / trust, diagnosis, choosing the next commitment after a reorg |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "size": [5, 7, 9],
  "projects": ["a real-time viewing-metrics pipeline and a replacement for the nightly title-popularity job", "a new device-telemetry schema and a self-service query layer for playback quality data", "a feature store for recommendation models and a backfill tool for viewing history"],
  "signal": ["two engineers have asked to transfer to other teams", "one senior engineer has resigned", "nobody has left, but on-call handovers are missed and code reviews take weeks"],
  "months": [3, 6]
}
```

**Business Scenario.** After a reorganisation you now lead a team of {{size}} engineers that runs the data infrastructure behind viewing analytics. In the past year the team's last two projects, {{projects}}, were cancelled after months of work. The team now mostly reacts to pipeline failures and requests. On top of that, {{signal}}. Your director wants a direction from you within 30 days and visible results within {{months}} months.

**Problem Statement.** How do you lead the team from here? Cover your first weeks, how you find out why the projects were cancelled and what part the team played, how you choose what the team commits to next, how you rebuild trust with the team and with its stakeholders, how you handle the people concerns, and how you will know it is working. Then tell me about a real time you took over a team or project in trouble, with what happened, or say that you have not and reason it through.

**Constraints.** No new hires this half. The existing pipelines must keep running. You did not choose the team, and the team did not choose you.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Why were the projects cancelled? | A: Accounts differ. The team says priorities changed under them; stakeholders say the projects were late and kept changing scope.
- Q: How strong is the team? | A: Mixed: two strong senior engineers, the rest mid-level. Form your own view.
- Q: Do stakeholders still need what the projects promised? | A: Some of it. One stakeholder team has built its own workaround.
- Q: Does the director have a view? | A: The director thinks the team over-engineers; you have not seen evidence either way yet.

**Hints.**
1. Before deciding anything, listen: each engineer, each main stakeholder, and the written history of both projects.
2. Separate what the team controlled (estimates, scope, delivery) from what it did not (priority changes) before you assign any lesson.
3. The next commitment should be small enough to finish, valuable enough to matter, and agreed in writing with the people who could cancel it.

**Follow-ups.**
1. What do you do in your first two weeks, and what are you trying to learn?
2. You find the team did contribute to both cancellations through scope growth. How do you raise it with them without destroying what morale is left?
3. How do you choose the first commitment, and how do you protect it from becoming the third cancelled project?
4. One of the two strongest engineers tells you privately that they are thinking of leaving. What do you do?
5. In your real example, what did you change in how the team committed to work, and what was the measurable result?

**Follow-up rules.**
- when: one-on-one, one on one, 1:1 → ask: What do you ask in those conversations, and what do you do with an answer that contradicts your director's view?
- when: quick win, small win → ask: Which win, how small, and why would anyone outside the team care about it?
- when: roadmap, priorities, prioritise, prioritize → ask: Who signs off the priorities, and what do you do the next time they change halfway through?
- when: morale, trust → ask: How would you know morale is improving, apart from people telling you so?
- when: performance, underperforming, low performer → ask: How do you separate an engineer's performance from the effect of two cancelled projects?

**Evaluation Criteria.** Listens before deciding and builds an evidence-based account of the cancellations, including the team's own part; protects running pipelines while reducing reactive load; chooses a small, valuable, written commitment agreed with the people who could cancel it, with milestones and an explicit process for priority changes; honest, respectful conversations about the team's contribution; deliberate attention to the at-risk engineers and to on-call health; measures progress beyond self-report (delivery against milestones, stakeholder confidence, on-call load, retention); real example with personal actions and measurable result, or honestly hypothetical.

## NFX-L5-03: A senior engineer whose reviews stall everyone else

| | |
|---|---|
| **Template ID** | NFX-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | People leadership / code review culture, feedback, protecting quality and growth |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "engineer": ["the person who designed the streaming ingestion of playback events", "the team's most experienced person on the title-popularity pipeline", "a senior engineer who is the only expert on the encoding-metadata service"],
  "signal": ["changes to the core pipeline wait a median of 9 days for approval", "two mid-level engineers have asked to move off the codebase", "a new hire's first three changes were rejected with one-line comments"],
  "role": ["their manager", "the tech lead on the same team, not their manager", "a staff engineer on a neighbouring team that depends on the code"]
}
```

**Business Scenario.** The engineer in question is {{engineer}}. They are technically excellent. Their reviews have caught real defects that would have corrupted viewing data, and other teams trust the code because they guard it. But {{signal}}. Their comments are usually correct and often curt, and approval usually means rewriting the change their way. You are {{role}}.

**Problem Statement.** What do you do? Cover how you gather evidence beyond anecdote, how and when you talk to them, what you change in how review works (ownership, written standards, design discussion before code), how you keep the quality they bring, what you do for the engineers affected, and what you do if nothing changes. Then tell me about a real time you dealt with a colleague whose behaviour slowed others down, with what happened, or say that you have not and reason it through.

**Constraints.** Their expertise is needed; losing them would hurt. The other engineers' growth and retention matter too. What you can do depends on your role.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Has anyone told them? | A: Not directly. People complain to each other.
- Q: Are their objections usually right? | A: Mostly about correctness, yes; often also about style and approach where several answers would be fine.
- Q: Is anything written down about review standards? | A: No. The standard lives in their head.
- Q: Are they aware of the impact? | A: Unknown. In a recent retrospective they said review quality is the only thing protecting the data.

**Hints.**
1. Get facts first: review turnaround, rejection reasons, who is affected. Separate correctness objections from preference.
2. Talk to them privately, early and specifically, about impact, and listen; they may see a real risk others do not.
3. Turn their standard into something written and shared, so quality no longer depends on one reviewer.

**Follow-ups.**
1. What data would you gather, and what would change your view of the situation?
2. What do you say in the first conversation, and how do you respond if they say the others' code is simply not good enough?
3. What would you change in the review process, and how do you keep the quality bar on the changes that matter most?
4. Two months later nothing has changed. What do you do next, given your role?
5. In your real example, what changed in the colleague's behaviour, and what did you learn about your own approach?

**Follow-up rules.**
- when: feedback, conversation, talk → ask: What exactly do you say in the first two minutes, and what do you expect them to say back?
- when: hr, performance review, pip → ask: Before any formal step, what have you tried, and what evidence do you have that it did not work?
- when: codeowners, owners, rotation, second reviewer → ask: Does spreading review ownership lower the bar on the changes that matter most? How would you know?
- when: style guide, standards, guidelines → ask: Who writes the standards, and what happens when the senior engineer disagrees with one of them?
- when: escalate, escalation, their manager → ask: What can you do yourself before you involve someone else, and what would you bring to that conversation?

**Evaluation Criteria.** Gathers evidence (turnaround, rejection reasons, affected people) and separates correctness from preference; holds an early, private, specific conversation about impact and listens for real risks; acts within the authority of their stated role and escalates with evidence only when needed; turns implicit standards into written ones, adds design discussion before code and shares review ownership while keeping the bar on critical paths; supports the affected engineers; follows through with a clear next step if nothing changes; real example with personal actions and outcome, or honestly hypothetical.

## NFX-L5-04: An internal fork of an open-source engine, or contributing upstream

| | |
|---|---|
| **Template ID** | NFX-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical strategy / open-source forks, upstream contribution, migration risk |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "engine": ["an open-source stream-processing engine that runs the playback-event pipelines", "an open-source table-format library used by every batch job on viewing data", "an open-source workflow scheduler that runs every nightly content-analytics job"],
  "behind": ["two minor versions", "four minor versions", "a major version and its follow-up releases"],
  "patches": [12, 40, 90],
  "trigger": ["a security fix has been released upstream and does not apply cleanly to the fork", "the engineer who maintained most of the local patches has left", "a feature the team needs exists upstream but conflicts with two of the fork's patches"]
}
```

**Business Scenario.** Your organisation runs an internal fork of {{engine}}. It carries {{patches}} local patches (performance fixes, integrations with internal services, and a few behaviour changes other teams now rely on) and is {{behind}} behind upstream. Now {{trigger}}. You have been asked to recommend a direction and lead it: keep the fork and catch up, rebase onto upstream and contribute what can be contributed, or move to a managed offering of the same engine.

**Problem Statement.** How do you decide, and how do you lead it? Cover how you inventory and classify the patches, how you estimate the cost and risk of each option, how you work with the upstream project's maintainers, how you prove a new version behaves the same on your production workloads before switching, how you bring along the teams that rely on the fork's behaviour, and how you handle the immediate trigger while the longer plan runs. Then tell me about a real time you made a build, fork or adopt decision about a dependency, with what happened, or say that you have not and reason it through.

**Constraints.** The engine runs production pipelines that cannot have a long outage. Upstream contributions can take months and may be rejected. You have three engineers for two quarters. Assume your employer permits open-source contributions.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the patches documented? | A: Partly: commit messages and a wiki page last updated a year ago.
- Q: Have any patches been offered upstream before? | A: Two were; one was merged, one stalled in review.
- Q: Does the managed offering support our integrations? | A: Most, through public extension points; you would have to check each patch.
- Q: Who relies on the behaviour changes? | A: At least four teams, not all of whom know they rely on them.

**Hints.**
1. Classify every patch: already fixed upstream, could be contributed, could become a plugin or configuration, or must stay local. The last group is the fork's true cost.
2. Deal with the immediate trigger on its own short path, so the long-term choice is not made under pressure.
3. Prove equivalence on your workloads: replay or shadow-run production jobs on both versions and compare outputs and performance.

**Follow-ups.**
1. How do you estimate what the fork costs per year today, and what each option would cost?
2. The maintainers reject your largest patch because it does not fit their design. What now?
3. How do you shadow-run the new version, and what differences would block the switch?
4. A team discovers during testing that it depends on a behaviour change nobody documented. How do you handle it?
5. In your real example, what did the decision cost, and would you make it again?

**Follow-up rules.**
- when: upstream, contribute, contribution → ask: How do you get a patch accepted by maintainers who owe you nothing, and how long do you plan for it?
- when: rebase, cherry-pick, merge → ask: How do you test that the rebased engine behaves the same on your production workloads before switching?
- when: managed, vendor, managed service → ask: Which of your local patches does the managed offering lack, and who depends on them?
- when: plugin, extension, hook → ask: Which patches can become plugins against public interfaces and which cannot? What happens to the rest?
- when: security, cve, vulnerability → ask: Do you patch the fork now or wait for the rebase? Who decides, and on what evidence?

**Evaluation Criteria.** Handles the immediate trigger on a short, separate path; inventories and classifies patches, finding which are already upstream, contributable, replaceable by extension points or truly local; estimates the ongoing cost of each option in engineer time and risk, not only the migration cost; works with upstream maintainers respectfully and plans for rejection; proves equivalence by shadow runs or replays on production workloads with explicit blocking criteria; finds and brings along teams that rely on behaviour changes; real example with cost and outcome, or honestly hypothetical.

## NFX-L5-05: Project deep dive, re-examined for a global, many-region audience

| | |
|---|---|
| **Template ID** | NFX-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, scaling to a global multi-region service |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the most important reliability decision you made"],
  "regions": [3, 4, 6],
  "global_feature": ["daily numbers computed for each country's local day", "member data kept in particular regions for some countries", "regional failover that neither loses nor double counts events", "a launch that has to go live in every country at the same moment"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change to serve a global streaming audience in many time zones from {{regions}} cloud regions, and to support {{global_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes when the system runs in {{regions}} regions for a worldwide audience and must support {{global_feature}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The global multi-region setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.
- Q: Was my system ever multi-region? | A: It does not need to have been; the second half is reasoning, and you should say which parts are.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the global question, start from what "a day", "an event" and "the source of truth" mean when there are {{regions}} regions and two dozen time zones.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Running in {{regions}} regions, where does each piece of state live, and what happens to it when a region fails?
4. How would you add {{global_feature}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, spark, flink, airflow, cassandra → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: utc, timezone, time zone, local time → ask: A country's day ends while another region is still processing yesterday's late events. When is that country's daily number final?
- when: active-active, replication, failover → ask: Two regions accept writes for the same record during a network split. What does your system do when they reconnect?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a credible multi-region analysis that places each kind of state, states consistency and failover behaviour, and handles time zones explicitly; a concrete, incremental path to the global feature; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
