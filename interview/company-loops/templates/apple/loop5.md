# Apple · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a company that
makes phones, watches and computers and runs an app store, subscriptions, cloud
sync and a music service. Every situation is hypothetical, and none describes
any company's hiring process, its culture or the values it assesses. Answer from
your own experience, or say plainly that you have not faced it and reason it
through. Never invent a story.

## APL-L5-01: Getting help from other teams for an unannounced project you cannot explain

| | |
|---|---|
| **Template ID** | APL-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Influence without context / secrecy, honesty, cross-team requests |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "ask": ["a new field in a shared device-event schema", "three times the usual capacity on a shared ingestion pipeline", "keeping an old data export running six months past its retirement date"],
  "weeks": [6, 10, 16],
  "teams": [2, 3, 5]
}
```

**Business Scenario.** You lead the data work for a product that has not been announced. A small, named group of people knows about it; everyone else must not. To be ready for launch you need {{ask}}, which depends on {{teams}} teams outside that group, within {{weeks}} weeks. Their roadmaps are full, and their first question is always "what is it for?". You may not tell them.

**Problem Statement.** How would you get what you need? Cover what you can say and what you cannot, how you frame the request so it can be judged on its merits, how you answer questions without misleading anyone, who you bring in and through what process, what you do if a team says no, and how you leave the relationship when the product is announced. Then describe a real situation where you needed something from people you could not give full context to, or any request you had to make with limited information, with its outcome; or say that you have not and reason it through.

**Constraints.** You may not disclose the project, and you may not add anyone to the group that knows about it yourself; there is a process for that, run by the project's sponsor. You must not give a false reason. Your own team could build part of a workaround, but the systems involved belong to the other teams.

**Assumptions.** The situation, timings and team counts are hypothetical.

**Clarifications.**
- Q: Can I tell the other teams' managers? | A: Only if they are added to the group through the sponsor's process. You can ask for that.
- Q: Is there a sponsor who knows? | A: A director, with very little spare time.
- Q: Can I say it is for something else? | A: You decide what you say; everything you say will be remembered after the launch.
- Q: Have these teams helped you before? | A: Two of them have; one has not worked with your team at all.

**Hints.**
1. Separate the request from the reason: what exactly you need, by when, at what cost to them, and what happens if it is late. Most of that can be shared.
2. "I cannot say why, and I will not pretend otherwise" is a statement you can make honestly. A made-up reason cannot be taken back.
3. Find the smallest number of people who must know, and ask the sponsor to bring exactly those in.

**Follow-ups.**
1. Write the first message you would send to the team that has never worked with you.
2. One team says they will only prioritise it if they know what it is for. What do you do?
3. The sponsor will not add anyone to the group. Do you build a workaround on another team's system? What does it cost later?
4. After the announcement, a team lead tells you they felt used. What do you say, and what would you have done differently?
5. In your real example, what did you decide not to say, and how did that affect the outcome?

**Follow-up rules.**
- when: cover story, pretend, a different reason, made up → ask: The product is announced and they learn the real reason. What do they now believe about everything else you tell them?
- when: escalate, escalation, sponsor, director → ask: What exactly do you ask the sponsor to decide, and what do you bring them so it takes ten minutes, not an hour?
- when: workaround, build it ourselves, fork → ask: That system belongs to another team. Who is on call for your workaround at launch, and who removes it afterwards?
- when: trust, relationship → ask: What did you give the other team in return, and how would they describe the exchange?
- when: we decided, the team decided, we agreed → ask: Which part of that did you personally do or decide?

**Evaluation Criteria.** Separates what is needed (precise, costed, dated) from why, and shares everything except the why; never invents a reason; uses the sponsor's process to bring in the minimum set of people, with a crisp ask; offers something real in return (engineering help, a clear cost estimate, flexibility on dates); a sound decision on workarounds that weighs ownership and launch risk; repairs and acknowledges the relationship after the announcement; real example with honest handling of limited information, personal contribution and an outcome, or honestly hypothetical.

## APL-L5-02: A fixed hardware launch date and a data pipeline that is not ready

| | |
|---|---|
| **Template ID** | APL-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Scope under a fixed date / day-one requirements, risk, recoverability |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "weeks_left": [3, 5, 8],
  "gap": ["the activation-metrics pipeline has been tested at only half the expected launch-day volume", "the new model's diagnostic events have no schema validation and no backfill path", "launch-day dashboards depend on a device-to-account join that has never run at full scale"],
  "stakeholder": ["the launch operations team", "the customer support organisation", "finance"]
}
```

**Business Scenario.** A new device launches on a date that will not move. Your team owns the pipeline that turns launch-day events (activations, setup completions, early diagnostics) into the numbers {{stakeholder}} will use in the first week. With {{weeks_left}} weeks to go, {{gap}}. Your team also has a list of smaller features stakeholders were promised for day one.

**Problem Statement.** How do you decide what ships on day one and what does not? Cover how you find out what is truly required on launch day versus in the first week or month, what must be right from the first event because it cannot be reconstructed later, how you reduce the risk of the gap in the time left, what you cut and how you tell the people who were promised it, what you prepare for launch day itself, and how you report status honestly as the date approaches. Then describe a real fixed-date delivery you led where scope had to give, with the outcome, or say that you have not and reason it through.

**Constraints.** The launch date cannot move. You cannot hire for this. Data lost on launch day (events never captured) cannot be recovered; derived numbers can be recomputed if the raw events exist.

**Assumptions.** The situation and timings are hypothetical.

**Clarifications.**
- Q: Who decided which features were promised? | A: Your predecessor, with each stakeholder separately. Nobody has seen the whole list at once.
- Q: Can launch-day numbers arrive late? | A: Some can; {{stakeholder}} say all of them are urgent.
- Q: Can you run a test at launch volume? | A: With synthetic events, if you build the generator.
- Q: Who can approve cutting a promised feature? | A: The stakeholder who asked for it, or the launch's overall lead.

**Hints.**
1. Sort everything by "cannot be recovered if wrong on day one" versus "can be recomputed or added later". Raw capture is in the first group; most dashboards are in the second.
2. Turn the gap into a measured risk: what fails, at what volume, and what the fallback is.
3. A list cut once, early and in the open, costs less trust than features that quietly slip on launch day.

**Follow-ups.**
1. Walk me through the list: what is in the day-one group and why?
2. How do you reduce the risk of the gap in {{weeks_left}} weeks, and what is the fallback if it still fails on the day?
3. A stakeholder refuses to accept a cut. What do you do?
4. Two days before launch your load test fails at 80% of expected volume. Who do you tell, what do you change, and what do you not change?
5. In your real example, what did you cut, who did you tell and how, and how did it turn out?

**Follow-up rules.**
- when: overtime, weekends, work harder, push through → ask: The team works weekends for {{weeks_left}} weeks. What breaks on launch day because people are exhausted, and is that a plan?
- when: cut, descope, defer, postpone → ask: Who agreed to that cut, and what did you give them instead?
- when: raw events, raw data, capture, backfill → ask: If capture is right but processing fails on launch day, how long until the numbers exist, and who knows that in advance?
- when: green, on track, status → ask: What would have made you report red, and when did you decide that threshold?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and what did it cost?

**Evaluation Criteria.** Classifies work by recoverability, protecting raw capture first and treating derived numbers as recomputable; makes the gap a measured risk (load tests with synthetic events, a defined fallback) and reduces it with the time left; cuts scope early and openly with the people who were promised it, through the right decision-maker; prepares launch day (runbooks, on-call, degraded modes, who decides); reports status against stated thresholds rather than optimism; protects the team from unsustainable pushes; real example with scope trade-offs, personal decisions and an outcome, or honestly hypothetical.

## APL-L5-03: Two strong engineers in a long-running conflict over ownership

| | |
|---|---|
| **Template ID** | APL-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team leadership / conflict, ownership boundaries, decision rights |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, data-engineer |

```params
{
  "area": ["the shared ingestion library", "the subscription events schema", "the on-call rotation for the sync analytics pipeline"],
  "months": [4, 8, 12],
  "effect": ["design reviews that stall for weeks", "two half-built versions of the same component", "a new engineer who has asked to move to another team"]
}
```

**Business Scenario.** You lead a data engineering team of eight. Two of its strongest engineers have disagreed for {{months}} months about who owns {{area}} and how it should change. Both are right about some things. Each has started making decisions about it without the other. The result so far is {{effect}}. Neither has asked you to intervene; both have complained about the other to you, separately.

**Problem Statement.** What do you do? Cover how you find out what the disagreement is actually about, how you talk to each of them and when together, how ownership and decision rights for {{area}} are settled and written down, how you deal with the damage already done, what you do if one of them will not accept the outcome, and how you would know it is resolved. Then describe a real conflict between people you led or worked closely with, what you did and how it ended, or say that you have not and reason it through.

**Constraints.** You cannot afford to lose either engineer. You cannot move either of them to another team. Delivery commitments on {{area}} continue.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do they disagree on technical direction or on who decides? | A: Both, and they mix them up.
- Q: Have you ever said who owns {{area}}? | A: No. It was shared by default.
- Q: Is anyone else affected? | A: Yes, as described; others have started taking sides.
- Q: Is either behaving unprofessionally? | A: Not openly. They are curt in reviews and avoid each other.

**Hints.**
1. Separate three questions: what the right technical direction is, who decides it, and how the two of them work together. They need different answers.
2. Unclear ownership is usually the leader's gap, not the engineers'. Say so.
3. Make the decision rule explicit and written, with a way to disagree and still commit.

**Follow-ups.**
1. What do you say in the first one-to-one with each of them?
2. How do you decide who owns {{area}}, or do you split it? What makes a split work?
3. One of them disagrees with the outcome and keeps relitigating it in reviews. What do you do?
4. How do you repair the effect on the rest of the team, including {{effect}}?
5. In your real example, what did you get wrong, and what would you do differently?

**Follow-up rules.**
- when: mediate, sit them down, together → ask: What do you need to know from each of them before you put them in a room, and what is the outcome you want from that meeting?
- when: split, divide, co-own, co-owners → ask: Where exactly is the boundary, and who decides when a change crosses it?
- when: hr, performance, warning → ask: What has either of them done that is a performance problem rather than a disagreement? What evidence do you have?
- when: escalate, my manager, leadership → ask: Which part of this is yours to fix, and what would you ask your manager for?
- when: we decided, the team decided, we agreed → ask: What did you personally say or decide, and how did each of them react?

**Evaluation Criteria.** Diagnoses before acting (separate conversations, understanding each position, separating direction from ownership from behaviour); owns the leader's part in leaving ownership undefined; settles ownership and decision rights explicitly, in writing, with a disagreement path; treats both engineers fairly and keeps them both; addresses the damage (stalled reviews, duplicated work, the team taking sides) concretely; handles continued relitigation directly and early; real example with personal actions, an outcome and an honest lesson, or honestly hypothetical.

## APL-L5-04: A team you depend on deprioritises the interface your launch needs

| | |
|---|---|
| **Template ID** | APL-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team dependencies / negotiation, contingency planning, escalation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "interface": ["a daily export of subscription state changes", "a streaming feed of app review outcomes", "a batch interface for storefront price schedules"],
  "weeks": [4, 8, 12],
  "reason": ["a security fix that is taking their whole team", "a reorganisation that moved two of their engineers elsewhere", "a launch of their own on the same date"]
}
```

**Business Scenario.** Your team is building reporting for a developer-facing launch {{weeks}} weeks away. It depends on {{interface}} from another team, which agreed last quarter to build it. This week they told you it is deprioritised because of {{reason}}. Their reason is legitimate. Your launch date has been announced to developers.

**Problem Statement.** What do you do? Cover how you establish what is now realistic from their side, what options exist (a smaller interface, your team doing part of the work, a temporary alternative source, moving part of your launch), how you negotiate without damaging the relationship, when and how you escalate, how you tell the developers or your stakeholders if something changes, and how you avoid this kind of dependency risk next time. Then describe a real case where a dependency fell through and what you did, or say that you have not and reason it through.

**Constraints.** You have no authority over the other team. Your own team has three engineers available. Any temporary alternative source must be removed after the real interface exists.

**Assumptions.** The situation and timings are hypothetical.

**Clarifications.**
- Q: Is there a written agreement? | A: A line in last quarter's plan and a design document both teams signed off.
- Q: Could your engineers work in their codebase? | A: Possibly, if they accept and review the changes.
- Q: Is there another source for the same data? | A: A nightly report built for a different purpose, close but not identical.
- Q: Who sets priorities for both teams? | A: A shared director two levels up.

**Hints.**
1. Start from what they can still do, not from what they promised. Ask for the smallest version that unblocks you.
2. Price every option in engineer-weeks, risk and what it leaves behind after launch.
3. Escalation asks a person with authority to choose between two clearly stated options; it is not a complaint.

**Follow-ups.**
1. What do you ask for in your first conversation with the other team's lead?
2. You propose that your engineers build the interface in their codebase. They are worried about reviewing it and owning it afterwards. How do you address that?
3. The nightly report is close but not identical. Do you launch on it? What do you tell developers about its limits?
4. You escalate and the director keeps their priority. What now?
5. In your real example, what did you learn about writing dependency agreements?

**Follow-up rules.**
- when: escalate, escalation, director → ask: What two options do you put in front of the director, with what costs, and what do you recommend?
- when: workaround, alternative source, nightly report, temporary → ask: Who owns that temporary path, how do you know when to remove it, and what if it is still there a year later?
- when: we will build it, our engineers, contribute → ask: Who reviews and runs that code after launch, and what did their team agree to?
- when: delay, slip, move the launch → ask: Who has to agree to moving part of the launch, and what do developers see?
- when: we decided, the team decided, we agreed → ask: What did you personally negotiate, and what did you give up?

**Evaluation Criteria.** Accepts the other team's reason and works from what is now feasible; defines a minimal interface; prices options (minimal version, contributing engineers with review and ownership agreed, a temporary source with known limits and a removal plan, partial launch); negotiates with something to offer; escalates with two clear options and a recommendation, together with the other lead where possible; honest communication of changes to stakeholders or developers; prevention through dependency agreements with checkpoints; real example with personal contribution and outcome, or honestly hypothetical.

## APL-L5-05: Project deep dive, re-examined for privacy-preserving, on-device aggregation

| | |
|---|---|
| **Template ID** | APL-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, redesign for on-device and privacy-preserving computation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the most important reliability decision you made"],
  "devices": ["10 million", "200 million", "1 billion"],
  "privacy_feature": ["raw events never leaving the device, only aggregates", "a per-day limit on what each device may contribute", "estimates released only above a minimum population", "a user's deletion reaching every derived table"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if its inputs came from {{devices}} personal devices whose owners expect privacy, and it had to support {{privacy_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the data came from {{devices}} personal devices and the system had to support {{privacy_feature}}: what moves onto the device, what the server may still know, what the people who use your outputs lose, and how you would show it works. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The device-based, privacy-preserving setting is hypothetical and describes general techniques, not how any company builds its systems.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: Do I need to know differential privacy in depth? | A: No. Reason from what must stay on the device, what may leave and in what form; use the terms you know correctly.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the privacy question, start from who would be harmed if your system's raw data were exposed, and work out what the server never needs to see.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. If raw events stayed on {{devices}} devices, which of your outputs could you still compute, which would become estimates, and which would you lose?
4. How would you add {{privacy_feature}} without a rewrite, and how would you prove it holds?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: user id, device id, identifier → ask: If the server could no longer link two events from one device, which of your tables and joins would still work?
- when: anonymised, anonymized, anonymous, hashed → ask: Could someone with your table and one other public dataset re-identify a person? How do you know?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: noise, differential privacy, threshold → ask: Which of your outputs becomes too noisy to use, and what do you tell the team that relied on it?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a credible privacy redesign that places computation on the device, states what the server may still know, recognises that hashing is not anonymisation, and is honest about which outputs become estimates or are lost; a concrete, verifiable path to the privacy feature; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
