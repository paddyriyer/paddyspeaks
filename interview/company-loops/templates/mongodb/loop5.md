# MongoDB · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a document
database and its managed cloud service. Every situation is hypothetical, and
none describes any company's hiring process or the values it assesses. Answer
from your own experience, or say plainly that you have not faced it and reason
it through. Never invent a story.

## MDB-L5-01: A team metric people have learned to game

| | |
|---|---|
| **Template ID** | MDB-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Metrics and incentives / Goodhart's law, measuring outcomes, changing a target |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "case": ["the median time to resolve customer performance escalations keeps falling because tickets are closed as 'waiting on customer' and then reopened as new tickets", "the share of slow-query alerts closed within 24 hours keeps rising because alert thresholds were quietly raised on the noisiest clusters", "the number of index suggestions customers accepted keeps rising because suggestions were pushed for indexes that were never used afterwards"],
  "audience": ["the team's quarterly review", "a dashboard shown to the director every week", "the goals two engineers' promotion cases cite"]
}
```

**Business Scenario.** You lead a team that supports the performance of customers' database clusters. For a year the team has been judged on one headline number. It sits in {{audience}}, and it has improved every quarter. Looking at the underlying records, you find the pattern behind the improvement: {{case}}. Nobody has lied about the number; people did what the target rewarded. Customers' actual experience, judging by repeat escalations and survey comments, has not improved.

**Problem Statement.** What do you do? Cover how you confirm what is happening and how much of the improvement is real, how you raise it with the team without turning it into blame, what you measure instead (and how you stop the new measure being gamed the same way), how you report the change upward when the old number is about to get worse, and what you do about people whose goals were written around the old number. Then tell me about a real time a metric you owned or depended on stopped meaning what it was meant to, or say that you have not and reason it through.

**Constraints.** The number is already in {{audience}}. You cannot stop measuring the team's work. Two people on the team set this metric up and are proud of it.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is anyone breaking a rule? | A: No written rule. The behaviour is visible in the records if you look.
- Q: Did you set the metric? | A: Your predecessor did; you have reported it for two quarters without questioning it.
- Q: Does the director know? | A: Not yet. They have praised the trend in public.
- Q: Do customers see the number? | A: No; they see the outcomes.

**Hints.**
1. Quantify first: how much of the improvement survives once the gamed cases are counted honestly?
2. Name your own part in it. You reported the number too.
3. Prefer a small set of measures that pull against each other, and keep looking at the raw cases, not only the number.

**Follow-ups.**
1. How do you recompute the last four quarters honestly, and what do you do if the corrected trend is flat?
2. What do you say to the team, and in what order: the two who built the metric, the whole team, your manager?
3. Which measures replace it, and how could each of them be gamed?
4. An engineer's promotion case leans on the old number. What do you do for them?
5. In your real example, what told you the metric had drifted, and how long did that take?

**Follow-up rules.**
- when: okr, okrs, target, targets → ask: Every target can be gamed. Which behaviour does your new target reward that you would not want, and how will you notice it?
- when: survey, nps, customer satisfaction → ask: That signal arrives months late and from few customers. What do you watch week to week?
- when: blame, accountability, performance review → ask: The people gamed a target that leadership rewarded. Where does accountability sit, including yours?
- when: dashboard, dashboards → ask: The director's dashboard shows the corrected number falling next quarter. What do you put beside it so it is not misread?
- when: we decided, the team decided, we agreed → ask: Which part did you personally decide, and what did it cost you?

**Evaluation Criteria.** Confirms and quantifies before acting (samples of raw records, a corrected series); owns their part in reporting it; raises it with the team as a system problem, not individual blame, starting with the metric's authors; replaces one gameable number with a balanced set tied to customer outcomes (repeat escalations, time to a confirmed fix, measured latency improvement after a change) plus regular review of raw cases; tells leadership early, with the corrected history and the reason; protects people whose goals relied on the old number; real example with what changed and personal contribution, or honestly hypothetical.

## MDB-L5-02: Disagreeing with your manager's decision, then committing to it

| | |
|---|---|
| **Template ID** | MDB-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Disagree and commit / upward disagreement, evidence, executing a decision you opposed |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "decision": ["to make weekly instead of daily restore drills the default for backups, to save cost; in your view the risk to customers is larger than the saving", "to ship the new online schema-migration tool to all customers this quarter instead of a limited preview; in your view it has not been tested on enough real workloads", "to deprecate a widely used but costly query-profiling feature in six months; in your view the customers who depend on it have no good replacement yet"],
  "weeks": [2, 6, 12]
}
```

**Business Scenario.** Your manager has decided {{decision}}. You argued against it in the planning meeting. Your manager listened, weighed it against other things they are accountable for, and decided anyway. Your team is responsible for carrying it out over the next {{weeks}} weeks, and two engineers on the team share your view and are asking you what to do.

**Problem Statement.** What do you do now? Cover how you check whether you have made your case as well as it can be made, and whether there is anything new to add; how you decide if this is a case to escalate further or to commit; what you say to the two engineers; how you carry out the decision well, including how you reduce the risk you raised; and what would make you raise it again. Then tell me about a real time you disagreed with a manager's decision and then carried it out, with what happened, or say that you have not and reason it through.

**Constraints.** The decision is within your manager's authority. You still think it is the wrong call. Your team's work on it starts now.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Did your manager explain their reasons? | A: Briefly: cost, a commitment made elsewhere, and a view that the risk is manageable.
- Q: Is there an ethical or safety issue? | A: Not of the kind that would oblige you to escalate; it is a judgement about risk and value.
- Q: Can the plan be adjusted? | A: Within the decision, yes; how it is carried out is largely up to your team.
- Q: Will anyone outside the team know you disagreed? | A: Only if you tell them.

**Hints.**
1. Separate "I would decide differently" from "this decision is unsafe or wrong in a way leadership must know". They call for different actions.
2. Committing does not mean hiding the risk. Measure it, and agree in advance what evidence would reopen the decision.
3. What you say to the team about a decision you opposed shapes whether they can execute it.

**Follow-ups.**
1. Before you commit, what do you do to be sure your manager has understood your strongest argument?
2. What do you tell the two engineers, word for word, about your own view?
3. How do you carry out the decision so that the risk you raised is visible and limited?
4. Halfway through the {{weeks}} weeks, early data suggests you were right. What do you do, and what if it suggests you were wrong?
5. In your real example, how did the outcome compare with your prediction, and what did you learn about your own judgement?

**Follow-up rules.**
- when: escalate, escalation, skip-level, skip level → ask: What makes this case worth going over your manager's head, and how would you tell them first?
- when: commit, committed, disagree and commit → ask: What does committing look like in your calendar next week, concretely?
- when: metric, measure, monitor, data → ask: Which result, by when, would make you raise the decision again, and did you agree that in advance with your manager?
- when: told the team, tell the team, the engineers → ask: One of the engineers says, "So you think this is a mistake?" in the team meeting. What do you answer?
- when: we decided, the team decided, we agreed → ask: Which part was your call, and which part was your manager's?

**Evaluation Criteria.** Checks the case was understood (a short written summary, new evidence if any) without relitigating endlessly; distinguishes a judgement call from an issue that must be escalated, and escalates openly if so; commits fully: plans the work well, speaks about the decision honestly but without undermining it; reduces the risk they raised through how the work is done (staging, monitoring, a defined trigger to revisit agreed with the manager); reports early evidence either way; real example with outcome, lessons and personal contribution, or honestly hypothetical.

## MDB-L5-03: Splitting a team that has grown too large to work as one

| | |
|---|---|
| **Template ID** | MDB-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team design / ownership boundaries, on-call, splitting a team |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "size": [14, 18, 22],
  "areas": ["replication, backups and restore, and cluster upgrades", "the query planner, indexes and the performance advisor", "data import connectors, change streams and the streaming integration"],
  "symptom": ["stand-up takes 40 minutes and nobody listens to most of it", "on-call covers so many systems that nobody feels expert in any of them", "two senior engineers make most decisions because no one else has the full picture"]
}
```

**Business Scenario.** Your team has grown to {{size}} engineers over eighteen months. It owns {{areas}}. The signs that it no longer works as one team are everywhere: {{symptom}}, planning takes a week, and new engineers take months to be useful. Your manager asks you to propose how to split it into two or three teams, and to lead the change.

**Problem Statement.** How would you approach it? Cover how you decide the boundaries (by component, by customer journey, by lifecycle or some other cut) and how you test them against real work from the last two quarters; how ownership of code, on-call, roadmaps and customer escalations moves; who leads each new team and how people are placed; how you communicate it; and how you will know in six months whether the split worked. Then tell me about a real time you changed how a team was organised, or say that you have not and reason it through.

**Constraints.** No new headcount. On-call coverage cannot lapse during the change. Some systems are tightly coupled and touched by most changes.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do the new teams need managers? | A: One more manager can be hired or promoted; for the rest, decide with your manager.
- Q: Can engineers choose their team? | A: Preferences can be asked for; the final placement is yours and your manager's.
- Q: Are there systems nobody wants to own? | A: Yes, an older component that pages often and has one expert.
- Q: How soon? | A: Within a quarter, without dropping committed work.

**Hints.**
1. Draw boundaries where changes rarely need two teams. Look at which code changed together and which incidents crossed areas.
2. Every system needs exactly one owner after the split, including the unloved one.
3. Plan on-call and customer escalations explicitly; they are where splits fail first.

**Follow-ups.**
1. Using the last two quarters' work, how do you test whether your boundary would have produced fewer cross-team dependencies?
2. Which team owns the older component that pages often, and what do you do about its single expert?
3. How do you split on-call without leaving any system thinly covered during the transition?
4. Two engineers both want to lead the same new team. How do you decide, and what do you do for the one not chosen?
5. Six months on, what numbers and conversations tell you whether the split worked, and what would make you change it again?

**Follow-up rules.**
- when: conway, conway's law → ask: Which part of your system's architecture would you want to change to fit the new teams, and is that worth doing?
- when: on-call, oncall, pager → ask: During the transition, who is paged for a system whose owner has just changed, and who do they call when they are stuck?
- when: survey, preferences, ask the team → ask: Most engineers ask for the same new team. What do you do with that information?
- when: shared, platform team, common → ask: A shared component is touched by every team. Who decides its roadmap, and how do the others get changes made?
- when: we decided, the team decided, we agreed → ask: Which decision did you personally make, and who disagreed with it?

**Evaluation Criteria.** Boundaries chosen from evidence (change coupling, incidents, customer escalations) and tested against past work; single ownership of every system with explicit handling of the unloved component and the single expert; on-call and escalation plans for the transition; fair, transparent placement and lead selection; clear communication, with the reasons; success measures set in advance (dependency count, lead time, on-call load, onboarding time, retention); willingness to adjust; real example with personal contribution and lessons, or honestly hypothetical.

## MDB-L5-04: Recovering trust after the team missed a commitment it made publicly

| | |
|---|---|
| **Template ID** | MDB-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Accountability / missed public commitment, communication, rebuilding credibility |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "commitment": ["general availability of a new backup feature on a date announced at a user conference", "a public roadmap date for a connector several large customers planned around", "a published fix date for a known issue that made some scheduled backups skip silently"],
  "slip": ["by six weeks", "by a quarter", "with no new date yet"],
  "cause": ["testing found the change could lose data in a rare failover case", "a dependency team's work slipped and nobody escalated", "the estimate was made before the design was understood"]
}
```

**Business Scenario.** Your team owned {{commitment}}. The date has been missed, {{slip}}. The cause is that {{cause}}. Customers who planned around the date are frustrated; account teams who repeated the date to customers feel let down; and your own leadership is asking how this happened and whether the next date can be believed.

**Problem Statement.** What do you do? Cover the first days (what you communicate, to whom, and with what honesty about the cause and the new date), how you decide when to give a new date and how confident it must be, how you support the customers who planned around the old one, what you change in how your team makes and tracks commitments, and how you rebuild trust over the following months. Then tell me about a real time your team missed a commitment others relied on, or say that you have not and reason it through.

**Constraints.** Shipping something unsafe to hit a date is not an option. You cannot promise a date you do not believe. Account teams need something to tell customers this week.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Did you know the date was at risk before it was missed? | A: There were warning signs a month earlier; they were discussed but not raised outside the team.
- Q: Are customers harmed, or only inconvenienced? | A: Some changed their own plans and budgets around the date.
- Q: Can part of it ship? | A: Possibly a limited preview for a few customers; you decide whether that helps or adds risk.
- Q: Who announced the date publicly? | A: Product leadership, based on your team's estimate.

**Hints.**
1. Start with the facts and your part in them, including the month when the risk was known and not raised.
2. A new date is only useful if it is believed; give a range with what it depends on, and update it on a known schedule.
3. Trust comes back from a run of small commitments kept, not from one large promise.

**Follow-ups.**
1. What exactly do you send account teams this week, and what do you not say?
2. How do you build the new estimate, and how confident must you be before it is public?
3. What changes in how your team raises a risk to a date, so the month of warning signs does not happen again?
4. A large customer asks for an early preview to stay on their own plan. What do you weigh?
5. In your real example, how long did it take for others to trust your dates again, and what made the difference?

**Follow-up rules.**
- when: apology, apologise, apologize, sorry → ask: An apology without a believable plan can make things worse. What comes with yours?
- when: buffer, padding, pad → ask: Padding every estimate will make the next date safe and the roadmap slow. How do you keep estimates honest instead?
- when: preview, beta, early access → ask: The preview has the bug that caused the slip in a rarer form. Who decides whether it ships, and on what evidence?
- when: status update, weekly update, communication plan → ask: Who receives those updates, and what makes them trust the next one more than the last?
- when: we decided, the team decided, we agreed → ask: Which part of the miss was yours personally, and what did you change in your own practice?

**Evaluation Criteria.** Owns the miss, including the unraised warning signs; communicates quickly and honestly to account teams and leadership, with the cause, what customers can do now, and when the next update comes; gives a new date only as a range with its dependencies, at a confidence that is stated; supports affected customers directly, and weighs a preview on safety evidence; changes how the team raises date risks (explicit confidence, early escalation triggers, dependency tracking); rebuilds trust through visible, kept smaller commitments; real example with personal contribution and lessons, or honestly hypothetical.

## MDB-L5-05: Project deep dive, re-examined for a distributed document database

| | |
|---|---|
| **Template ID** | MDB-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, documents, replication and sharding |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and its access patterns", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["records whose shape differs by customer and changes every month", "writes that must survive the loss of any one region", "a dataset that outgrows one machine and must be split by a key chosen now", "reads from replicas that must never show a customer an older state than they have already seen"],
  "scale": ["tens of gigabytes", "tens of terabytes", "petabytes"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if its data, at {{scale}}, lived in a distributed document database with replica sets and sharding, and its users required {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the data were stored as documents in a replicated, sharded database with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The document-database setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a database project? | A: No. Any system that stored, moved or computed data others depended on; the document-database part is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to entities, keys, access patterns, consistency, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the document-database question, start from the access patterns: which data is read together, which grows without bound, and which key spreads the writes.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which of your entities would you embed in one document and which would you reference, and why?
4. How would you provide {{requirement}} without a rewrite, and what would it cost?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: postgres, mysql, cassandra, dynamodb, mongodb → ask: Why that over the obvious alternative, and what did it cost you?
- when: embed, embedded, denormalize, denormalise → ask: One of those embedded arrays grows without limit for your largest customer. What happens to the document and to every write that touches it?
- when: shard, sharding, shard key → ask: One customer is a hundred times larger than the rest. Where does their data live under your key, and what happens to that shard?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to entities, keys, access patterns and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible document-database analysis that starts from access patterns, names embedding and referencing choices and unbounded growth, and addresses {{requirement}} incrementally (for example versioned documents with a schema-version field and validation rules, majority writes with members placed so no region holds a majority, a shard key with high cardinality and even write spread chosen from real queries, causally consistent sessions or primary reads where order matters); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
