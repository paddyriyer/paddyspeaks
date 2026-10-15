# Palantir · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of enterprise data
integration and operational analytics platforms. Every situation is commercial,
hypothetical and generic (a manufacturer, a distributor, a utility, a hospital
network's operations team); none is a real customer or deployment, and none
describes any company's hiring process or the values it assesses. Answer from
your own experience, or say plainly that you have not faced it and reason it
through. Never invent a story.

## PLT-L5-01: A customer deployment where the data is far messier than what was promised

| | |
|---|---|
| **Template ID** | PLT-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Customer delivery / expectations, data quality evidence, scope renegotiation, trust |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "customer": ["a regional distributor", "a mid-sized manufacturer with several plants", "a water utility"],
  "finding": ["a third of the maintenance work orders have no asset recorded", "the same supplier appears under four to nine different names and codes", "two plants count inventory in different units and nobody wrote down which"],
  "weeks_left": [3, 6, 10],
  "sponsor": ["the chief operating officer", "the head of supply chain", "the operations director"]
}
```

**Business Scenario.** You lead the data work on a project for {{customer}}: integrating their planning, maintenance and inventory systems so that operations staff can work from one picture. The project was agreed on the understanding that the customer's data was clean and complete. In week two you find that {{finding}}, and that the first use case, the one {{sponsor}} has announced to the company, depends on exactly that data. Go-live is {{weeks_left}} weeks away.

**Problem Statement.** What do you do? Cover how you measure the problem before you talk about it, who you tell and in what order (your own lead, the customer's project owner, the sponsor), what you propose (fix at the source, fix in the pipeline, narrow the first release, move the date), how you show users which numbers they can trust on day one, and how you keep the customer's confidence while the news is bad. Then tell me about a real project where the data turned out much worse than expected, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot fix the customer's source systems yourself; their own staff own them and are busy. The sponsor's announcement cannot be withdrawn quietly. Your team is small and already committed until go-live.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Did anyone on the customer's side know? | A: Their data team suspected it; it never reached the people who agreed the project.
- Q: Can the first use case work partly? | A: Possibly. Some sites and record types are much cleaner than others.
- Q: Who decides on scope or date changes? | A: The customer's project owner, with the sponsor's approval, and your own lead on your side.
- Q: Is there a contract penalty for a late go-live? | A: Not a formal one; the cost is credibility on both sides.

**Hints.**
1. Turn "the data is bad" into numbers: how much, where, which decisions it affects, and how fast it could be fixed.
2. Bring options with costs, not only a problem; let the people with decision rights choose.
3. Make data quality visible in the product itself, so users know which numbers to trust.

**Follow-ups.**
1. How exactly would you measure the problem in your first three days, and what would you show the customer's project owner?
2. The sponsor says "go live anyway; we'll clean it later". What do you say, and what do you do if they insist?
3. Which fixes belong in the customer's source systems and which in your pipeline, and why does the difference matter in a year?
4. A month after go-live, users still distrust the numbers. What do you change?
5. In your real example, what would you do differently in the first week?

**Follow-up rules.**
- when: escalate, escalation, sponsor → ask: What do you put in front of the sponsor, and how do you avoid it reading as blame on their data team?
- when: clean it, clean the data, cleansing → ask: Who keeps it clean after you leave, and what stops the same problem coming back at the source?
- when: delay, push the date, move the date → ask: What does the customer get on the original date instead, and who chose that?
- when: dashboard, data quality score, quality metrics → ask: Which users look at that, and what do they do differently because of it?
- when: we decided, the team decided, we agreed → ask: What did you personally recommend, and to whom?

**Evaluation Criteria.** Measures the problem first and in terms of decisions affected; tells the right people early and in the right order, without blame; brings options with costs (narrower first release on the clean sites or record types, source fixes owned by the customer with a plan, pipeline rules that are visible and reversible, a date change) and respects who decides; makes trust visible to users (coverage and quality shown next to the numbers); distinguishes fixes at the source from fixes in the pipeline; keeps the relationship honest when pressed to go live regardless; real example with what happened and personal contribution, or honestly hypothetical.

## PLT-L5-02: Turning repeated one-off customer solutions into a product capability

| | |
|---|---|
| **Template ID** | PLT-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Productisation / finding the common core, field and product alignment, migration, saying no |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "solution": ["supplier-feed reconciliation", "a prioritised maintenance work-order inbox", "an inventory exception queue with assignments"],
  "copies": [4, 7, 12],
  "period": ["year", "eighteen months", "two years"],
  "breakage": ["one copy broke at a customer during a platform upgrade", "two copies disagree about the same calculation and both customers noticed", "the engineer who wrote three of the copies has left"]
}
```

**Business Scenario.** Over the past {{period}}, engineers working directly with customers have built {{copies}} separate versions of {{solution}} for different commercial customers. Each was built quickly to win or keep a customer, and each is a little different. They now take a growing share of the field engineers' time to maintain, and {{breakage}}. You believe it should become one capability in the product. Field engineers like the freedom to build what each customer needs; the product team has a full roadmap and has not asked for it.

**Problem Statement.** How would you lead this? Cover how you find what is common and what is truly different across the copies, how you make the case and to whom, how you work with field engineers so the product version is something they choose to use, what the first version includes and what it leaves out, how existing customers move to it without disruption, and what you will refuse to support. Then tell me about a real time you turned repeated custom work into something reusable, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot force field engineers to adopt it. Customers using the copies must not lose a feature they rely on without warning. The product team will give you a small team for one quarter if the case is convincing.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the copies in one codebase? | A: No; each lives in its customer's project, with its own data model.
- Q: Do customers pay for these features specifically? | A: Not separately; they are part of larger agreements.
- Q: Is there data on how the copies are used? | A: Some usage logs; nobody has compared them.
- Q: Who owns the copies today? | A: Whoever built them, in practice.

**Hints.**
1. Lay the copies side by side: inputs, rules, outputs and how users act on them. The common core is usually smaller and clearer than it first looks.
2. Measure the cost of the status quo: field engineer hours, incidents, and time to build the next copy.
3. Build with field engineers, not for them; give them extension points for what is truly customer-specific.

**Follow-ups.**
1. How would you compare the {{copies}} copies in a week, and what would the comparison look like?
2. What is your case to the product team, in numbers?
3. A field engineer says the product version will slow them down at their next customer. How do you respond, and what might you change?
4. One customer depends on a behaviour that only their copy has. Do you build it into the product, offer an extension point, or retire it?
5. In your real example, how did you know it had worked, a year later?

**Follow-up rules.**
- when: framework, platform, generic → ask: How do you keep the product version from becoming so configurable that it is harder to use than writing a new copy?
- when: mandate, require, enforce → ask: You cannot enforce adoption. What would make a field engineer choose it on their own?
- when: migrate, migration, cut over → ask: How do you prove a migrated customer's numbers match their old copy before you switch it off?
- when: roadmap, prioritise, prioritize → ask: What does the product team stop doing to make room, and who agreed to that?
- when: we decided, the team decided, we agreed → ask: Which part of the design did you personally argue for, and who disagreed?

**Evaluation Criteria.** Evidence from the copies themselves (a side-by-side comparison of inputs, rules and outputs, usage data) and the cost of the status quo; a case made in numbers to the people who fund it; field engineers involved as co-designers with extension points for real differences; a deliberately narrow first version; migration with parity checks per customer and no surprise loss of features; clear statements of what is not supported; adoption measured; real example with what happened and personal contribution, or honestly hypothetical.

## PLT-L5-03: Reporting an access-control mistake your own team made before anyone else notices

| | |
|---|---|
| **Template ID** | PLT-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Integrity / self-reported access incident, containment, disclosure, blameless review |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "data": ["supplier contract prices", "per-plant overtime costs", "hospital unit staffing levels"],
  "days": [2, 9, 30],
  "audience": ["about 40 analysts in another business unit", "a group of contractors", "every user of the customer's platform"],
  "reads": ["no reads by anyone outside the intended group", "a handful of reads by three people outside the intended group", "hundreds of reads, most by one scheduled report"]
}
```

**Business Scenario.** Your team maintains a pipeline that builds a derived dataset of {{data}} for a commercial customer. While reviewing an unrelated change, you notice that a change your team merged {{days}} days ago dropped the access restriction on that dataset: under this exercise's model, the derived dataset should have inherited its input's restriction, but it was readable by {{audience}}. The access logs show {{reads}}. Nobody else, at your company or the customer's, has noticed.

**Problem Statement.** What do you do, in the first hour, the first day and the following weeks? Cover containment, how you establish the facts and the scope, who you tell and how quickly (your manager, your security or privacy contacts, the customer's data owner under whatever the agreement requires), what you tell them, how you run the review of how it happened without blaming the engineer who made the change, and what you change so it cannot happen silently again. Then tell me about a real time you reported a mistake you or your team made before anyone else found it, with what happened, or say that you have not and reason it through.

**Constraints.** The engineer who made the change is junior and worried. Your manager is travelling and hard to reach today. You do not decide what the customer is told on your own; your company has a process for that.

**Assumptions.** The situation and figures are hypothetical, and the access model is this exercise's.

**Clarifications.**
- Q: Is the data personal? | A: In this exercise it is business data that the customer treats as restricted; whether any of it identifies people depends on the dataset, and you should check.
- Q: Can you fix the restriction yourself? | A: Yes, you have the rights to restore it.
- Q: Are the access logs complete? | A: They cover reads through the platform; exports made by readers would need a separate check.
- Q: Was the change reviewed? | A: Yes, by another engineer; neither noticed the restriction.

**Hints.**
1. Contain first, then establish facts, then disclose through the right channel; do not wait for perfect facts before telling the people who must know.
2. Scope means who read what, when, and whether anything was copied onward.
3. The fix that matters is the one that makes the same mistake fail loudly next time.

**Follow-ups.**
1. Walk through your first hour, minute by minute if you can.
2. Your manager is unreachable for four hours. Who do you tell instead, and what do you say?
3. The logs show one scheduled report read the data daily and emailed a summary. What changes in your response?
4. In the review, someone asks who approved the change. How do you keep the review blameless and still learn from it?
5. In your real example, how did the people you told react, and what did you learn about telling early?

**Follow-up rules.**
- when: quietly fix, fix it quietly, no need to tell → ask: The fix is in and the logs show no outside reads. Why tell anyone at all?
- when: logs, audit log, access log → ask: The logs show reads through the platform. How do you find out whether anything was exported or copied onward?
- when: blame, fault, who did it → ask: How do you protect the junior engineer while still being honest about what happened?
- when: guardrail, automated check, ci, policy check → ask: Which check would have failed on the original change, and where in the process does it run?
- when: we decided, the team decided, we agreed → ask: What did you personally do in the first hour?

**Evaluation Criteria.** Contains immediately (restores the restriction, preserves the logs); establishes scope from evidence (who read what, when, any onward copies or exports, whether any data identifies people); discloses promptly through the right channels without waiting for perfect information, even with the manager unreachable; does not tell the customer on their own outside the company's process, but makes sure the process starts; runs a blameless review focused on why the review and tooling missed it; adds a guardrail (restriction inheritance checked automatically, a test that fails when a derived dataset is less restricted than its inputs); supports the engineer; real example with what happened and personal contribution, or honestly hypothetical.

## PLT-L5-04: Deciding not to automate a decision that should stay with a person

| | |
|---|---|
| **Template ID** | PLT-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Responsible automation / decision rights, cost of errors, human review, evidence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "decision": ["allocating scarce parts across customers' orders when supply is short", "deferring maintenance inspections on ageing equipment", "rejecting supplier shipments at receiving inspection"],
  "accuracy": ["92%", "97%", "99%"],
  "hours": [40, 120, 300],
  "requester": ["the operations director", "the customer's chief financial officer", "your own product lead"]
}
```

**Business Scenario.** A commercial customer uses an operational application in which a model recommends decisions about {{decision}}, and planners accept or change each recommendation. In a backtest, the model's recommendation matched what experienced planners decided {{accuracy}} of the time. The request now comes from {{requester}}: let the application act on the recommendations automatically, saving about {{hours}} hours of planners' time a week. You agree that much of it could be automated, but you believe some of these decisions should stay with a person.

**Problem Statement.** How do you decide which decisions to automate and which to keep with a person, and how do you make that case? Cover the criteria you would use (the cost of a wrong decision and who bears it, whether it can be undone, who is accountable, whether the model has seen situations like this one, what "matched the planners" really measures), the evidence you would gather, the design you would propose (what is automated, what is reviewed, how overrides and outcomes are recorded), how you would revisit the decision later, and what you do if the requester disagrees. Then tell me about a real time you argued to keep a person in a decision, or to automate one, with what happened, or say that you have not and reason it through.

**Constraints.** You are not the decision owner; the requester is. The planners' time saving is real and matters to the business. Nothing the model does may be described to users as more certain than it is.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Where does the model disagree with planners? | A: Nobody has broken it down; the backtest reports one overall number.
- Q: Can an automated decision be reversed? | A: Some quickly and cheaply, some not at all once acted on.
- Q: Do planners trust the model? | A: Mostly, for routine cases; they are wary in unusual ones.
- Q: Is there a regulation that decides it? | A: Not one you need to apply here; the question is judgement and evidence.

**Hints.**
1. Break the overall agreement rate down by situation; the disagreements are rarely spread evenly.
2. Weigh the cost of a wrong decision, not only how often the model is wrong.
3. Look for a split: automate the routine, reversible cases with high confidence, and route the rest to a person with the recommendation and its reasons.

**Follow-ups.**
1. What would you look at in the backtest to see where the {{accuracy}} agreement hides the risky cases?
2. Which decisions would you automate first, and what would make you stop?
3. How would you know, six months later, whether automated decisions were as good as the planners' would have been?
4. The requester says "the planners make mistakes too". How do you answer?
5. In your real example, what evidence changed someone's mind, yours or theirs?

**Follow-up rules.**
- when: human in the loop, human review, manual review → ask: Reviewers approve 99% of what the model proposes. Is a person really deciding, and how would you know?
- when: confidence, threshold, cut-off → ask: How do you choose that threshold, and who signs off on it?
- when: accuracy, precision, recall → ask: The model agrees with planners {{accuracy}} of the time. On which cases do the disagreements fall, and what does each one cost?
- when: audit, audit trail, log → ask: Someone harmed by an automated decision asks why it was made. What can you show them?
- when: we decided, the team decided, we agreed → ask: What did you personally recommend, and how did the requester respond?

**Evaluation Criteria.** Takes the time saving seriously while examining what the agreement rate measures; breaks performance down by situation and weights errors by cost, reversibility and who bears them; proposes a concrete split (automate routine, reversible, high-confidence cases; route others to a person with the recommendation and its reasons), with overrides and outcomes recorded and reviewed; guards against rubber-stamp review; sets criteria for expanding or pulling back automation; respects decision rights while making the risk explicit in writing; real example with what happened and personal contribution, or honestly hypothetical.

## PLT-L5-05: Project deep dive, re-examined for integrated operational data with fine-grained access controls

| | |
|---|---|
| **Template ID** | PLT-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, integration across sources, access restrictions and lineage |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["every derived dataset inheriting the access restrictions of its inputs", "row-level restrictions, so two users running the same query see different rows", "every user edit traceable to who made it, when and why", "decisions made in an application written back to the source system that owns the record"],
  "sources": ["a handful of", "dozens of", "hundreds of"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it integrated {{sources}} source systems into one operational picture that people act on, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the system integrated {{sources}} source systems with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The integration and access setting is hypothetical, and the access model is this exercise's.

**Clarifications.**
- Q: Does it have to be an integration platform? | A: No. Any system that moved, stored or computed data others depended on; the integration and access part is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the integration question, start from identity: how a record from each source is recognised as the same thing, and where that decision is recorded.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design assume one source or one set of users? What breaks first with {{sources}} source systems?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: lineage → ask: Show me how you would answer "which outputs did this bad source file touch?" in under an hour.
- when: role-based access, rbac, permissions → ask: A derived table joins two inputs with different restrictions. Who can read it, and what enforces that?
- when: golden record, entity resolution, deduplication → ask: A merge of two records turns out to be wrong. What is recomputed, and how do you find everything that used it?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible analysis for {{sources}} source systems that starts from identity and provenance (source keys kept, matches recorded as data and reversible, lineage from outputs to inputs) and addresses {{requirement}} incrementally (for example restrictions propagated through lineage with checks that fail a build when an output is less restricted than its inputs, restriction labels evaluated inside queries before aggregation, edits stored with actor, time and reason in an append-only history, writeback through the owning system's interface with conflict handling and an audit trail); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
