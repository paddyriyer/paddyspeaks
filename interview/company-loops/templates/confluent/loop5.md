# Confluent · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of Apache Kafka
based data streaming. Every situation is hypothetical, and none describes any
company's hiring process or the values it assesses. Answer from your own
experience, or say plainly that you have not faced it and reason it through.
Never invent a story.

## CFL-L5-01: Changing an unsafe default that some customers rely on

| | |
|---|---|
| **Template ID** | CFL-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Product and platform judgement / safe defaults, customer impact, staged change |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "default": ["producers are acknowledged once only the partition leader has written a record", "a replica that is not in sync may become leader when no in-sync replica is available", "topics are created automatically, with default settings, the first time any client names one"],
  "incidents": [3, 5, 9],
  "share": ["8%", "20%", "35%"]
}
```

**Business Scenario.** You lead the team that owns the defaults of a managed streaming service. In this exercise's service, by default {{default}}. Over the last year, {{incidents}} customer incidents involving lost or misplaced data were traced to that default. Changing it is safer for almost everyone, but telemetry suggests about {{share}} of active workloads rely on the current behaviour, some deliberately (for lower latency, for availability, or because their tooling expects it) and some without knowing.

**Problem Statement.** How do you change the default? Cover how you establish who depends on the current behaviour and why; whether the change applies to new resources only or to existing ones too; how customers are told, and how far ahead; what opt-out exists and for how long; how you stage the rollout and what you watch; how you handle a large customer who objects; and how you decide, and who decides, if the evidence is mixed. Then tell me about a real time you changed a behaviour that others relied on, or say that you have not and reason it through.

**Constraints.** The service promises not to break existing workloads without notice. Some affected customers are large and vocal; others have no active contact. You cannot see what customers' applications do with the data, only how their clients behave.

**Assumptions.** The service, the figures and the incident count are hypothetical.

**Clarifications.**
- Q: Do the incidents have anything in common? | A: In most, the customer did not know the default existed until they lost or misplaced data.
- Q: Who can approve a change to a default? | A: Your team proposes; product management and the support organisation must agree; a director decides if they do not.
- Q: Is there a deadline? | A: No external one. A competitor's comparison of safe defaults is circulating, which raises the pressure.
- Q: Can customers set the old behaviour explicitly? | A: Yes; an explicit setting is never changed, only the default.

**Hints.**
1. Split the workloads that rely on the behaviour into those that chose it and those that inherited it; they need different treatment.
2. "New resources first" is a common way to change a default without breaking anything that already runs.
3. Decide in advance what signal would make you stop the rollout.

**Follow-ups.**
1. How exactly would you find the workloads that rely on the current behaviour, and how confident can you be in that list?
2. A large customer says the change will cost them latency they have contracts around. What do you do?
3. Do you change existing resources at all? If so, how, and on what timeline?
4. Two weeks into the rollout, support tickets rise. How do you decide whether to pause, and who decides?
5. In your real example, what did you get wrong about who depended on the old behaviour?

**Follow-up rules.**
- when: deprecate, deprecation, announce, notice → ask: Customers with no active contact never read the notice. How do you reach them, and what happens to them on the day?
- when: opt out, opt-out, flag, override → ask: How long does the opt-out live? What stops it from becoming the new permanent default for a third of your customers?
- when: new topics only, new resources, existing → ask: Two years later, half the fleet still runs the old default. Is that acceptable? What would you do next?
- when: survey, telemetry, metrics → ask: Telemetry shows clients' behaviour, not intent. How do you tell a deliberate choice from an inherited one?
- when: we decided, the team decided, we agreed → ask: What did you personally propose, and what did you change your mind about?

**Evaluation Criteria.** Starts from evidence (the incidents, telemetry on who relies on the behaviour, separating deliberate from inherited use, talking to a sample of each); chooses a staged change (new resources first, an explicit setting that keeps the old behaviour for those who want it, notice periods, a time-boxed opt-out, then existing resources only where it is safe or with consent); defines stop criteria and monitoring before rolling out; handles the objecting customer with options, not a fight; names decision owners and escalates with a fair summary when evidence is mixed; measures the result (incidents before and after); real example with personal contribution and what was learned, or an honest "have not" with sound reasoning.

## CFL-L5-02: A fleet-wide major-version upgrade every team keeps postponing

| | |
|---|---|
| **Template ID** | CFL-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Driving change across teams / upgrades, deadlines, incentives, tooling |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "clusters": [40, 150, 600],
  "months": [6, 9, 12],
  "blocker": ["the removal of a client protocol version that about 15% of applications still use", "a change to a consumer default that some consumer groups depend on", "a metadata migration that needs every cluster restarted in a fixed order"],
  "postponed": [2, 3, 4]
}
```

**Business Scenario.** Your platform team runs {{clusters}} streaming clusters used by many product teams. The major version they run stops receiving security fixes in {{months}} months. The new major version needs work from application teams because of {{blocker}}. The upgrade has been on the roadmap and postponed {{postponed}} quarters in a row; each team has a good local reason, and most of the work to unblock it sits with them, not with you.

**Problem Statement.** How do you get the fleet upgraded before support ends? Cover how you size the real work per team; what you can take off their plate with tooling or compatibility measures; how you set and communicate a deadline that people believe; how you track progress and deal with the last few teams; what you do if a team says it cannot do it in time; and how you keep the next major upgrade from turning out the same way. Then tell me about a real time you drove a change that others had to do the work for, or say that you have not and reason it through.

**Constraints.** You have no authority over the application teams' roadmaps. Running unsupported software past the deadline is not acceptable for the security team. Your own team has three engineers available for this.

**Assumptions.** The figures and the version details are hypothetical.

**Clarifications.**
- Q: Do teams know about the deadline? | A: It has been announced twice in a newsletter.
- Q: Is there leadership support? | A: Your director supports it but has not asked the other directors for anything yet.
- Q: Can the platform keep both versions running for a while? | A: Some compatibility is possible at a cost, and it does not remove the deadline.
- Q: How much work is it per team? | A: Unknown; estimates range from a day to several weeks.

**Hints.**
1. Find out where the work actually is before asking anyone for time; most fleets have a long tail of easy cases and a few hard ones.
2. Every change you make on the platform side, such as compatibility shims, automated checks or code changes you open yourselves, removes a reason to postpone.
3. A deadline people believe needs an owner above the teams and a visible consequence, agreed in advance.

**Follow-ups.**
1. How would you find out, within two weeks, which applications are actually affected and how much work each has?
2. What would you build or change on the platform side so that most teams need almost nothing from their own roadmap?
3. One month before the deadline, five teams have not started, including one with a key launch. What do you do?
4. How do you prevent the next major upgrade from repeating this?
5. In your real example, what finally made people move, and was it what you expected?

**Follow-up rules.**
- when: mandate, enforce, escalate → ask: What exactly does the escalation ask the other directors for, and what happens to a team that still does not upgrade?
- when: dashboard, tracker, scorecard → ask: Whose numbers are on it, and how do you keep it from becoming a shaming board that teams resent?
- when: shim, compatibility, proxy, translation layer → ask: How long does the shim live, and what stops it from becoming the reason the next upgrade is postponed too?
- when: we migrated, we upgraded, the team migrated → ask: Which part did you personally do or decide, and what did you hand to others?
- when: exception, extension, waiver → ask: Who grants an exception, on what evidence, and what does the team owe in return?

**Evaluation Criteria.** Measures the real impact first (client versions from broker telemetry, a scan of configurations and code, a short survey) and sizes work per team; reduces the work on the platform side (compatibility measures with an end date, automated detection, upgrade guides, pull requests opened for teams); sets a credible deadline backed by leadership with an agreed exception process; tracks progress visibly and works the long tail one team at a time; handles the team with a launch with options rather than threats; changes the process so future upgrades are routine (supported-version policy, continuous compatibility checks, small regular upgrades); real example with personal contribution and measurable outcome, or an honest "have not" with sound reasoning.

## CFL-L5-03: A strategic customer asks for a custom feature that would fork the product

| | |
|---|---|
| **Template ID** | CFL-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Product and engineering judgement / customer pressure, forks, open-source upstream |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "feature": ["a time-to-live on each record, enforced by the broker, which the open-source project does not support", "a broker-side partitioner that routes by a field inside the record value", "a way for their clients to skip schema checks on one high-volume topic"],
  "revenue": ["5%", "12%", "20%"],
  "weeks": [6, 10, 16]
}
```

**Business Scenario.** You are the technical lead for the core streaming engine of a managed service built on an open-source project. A strategic customer, worth about {{revenue}} of the business's revenue in their region, asks for {{feature}} within {{weeks}} weeks, and says they will move to a competitor otherwise. Your sales team has half-promised it. Building it in your version of the engine only would make that version diverge from the open-source project, which every future upgrade would then have to carry.

**Problem Statement.** What do you do? Cover how you find out what problem the customer is trying to solve; what options you lay out (including ways to solve their problem without the feature as asked); how you weigh the customer against the long-term cost of a divergent engine; who makes the decision and how you bring them the trade-off; how you work with sales and the customer; and, if you build something, how you keep it from becoming a permanent fork. Then tell me about a real time you said no, or "not like that", to an important customer or stakeholder, or say that you have not and reason it through.

**Constraints.** The {{weeks}} weeks are the customer's stated deadline. Your team is fully booked. Anything added to the engine must be supported for every customer who turns it on.

**Assumptions.** The customer, the revenue share and the deadline are hypothetical.

**Clarifications.**
- Q: Has anyone asked the customer why they need it? | A: Only sales, and the answer was "they need it for compliance".
- Q: Does the open-source community want something similar? | A: There is an old proposal for something close that stalled for lack of a contributor.
- Q: Who decides? | A: The product lead for the engine, with your recommendation; the business owner of the account has a strong voice.
- Q: Can the customer's problem be solved outside the engine? | A: Possibly, in the client, in a stream processing job or with existing configuration; that is for you to find out.

**Hints.**
1. Ask what outcome the customer needs; a request for a feature is often one possible solution to a problem with several.
2. Put a cost on divergence in upgrade effort per release, not only on building the feature.
3. Contributing upstream is slower but keeps one engine; say what it would take to get there in time, or what a bridge would look like.

**Follow-ups.**
1. What questions would you ask the customer's engineers in the first meeting?
2. Lay out three options with cost, time and risk for each, including one that does not change the engine.
3. The account owner says, "just build it, we will clean it up later". How do you respond?
4. If you do build it, how do you keep it from turning into a permanent fork?
5. In your real example, what happened to the relationship with the customer or stakeholder afterwards?

**Follow-up rules.**
- when: upstream, contribute, open source, proposal → ask: Upstream review could take longer than {{weeks}} weeks. What do you ship in the meantime, and what happens if upstream accepts a different design?
- when: say no, decline, reject, push back → ask: The customer leaves. Who carries that decision, and how did you make sure they were deciding with the full picture?
- when: plugin, extension, client-side, stream processing → ask: Who supports that path when it breaks for the customer at 3 a.m., and is that cheaper than the feature?
- when: feature flag, flag, only for them → ask: Six months on, two more customers turn the flag on. Is it still a customer-specific feature?
- when: sales, account owner, account team → ask: Sales half-promised it already. How do you reset the expectation without making sales look bad to the customer?

**Evaluation Criteria.** Goes to the underlying need with the customer's engineers before deciding; lays out options with honest costs, including solving the problem outside the engine and an upstream path; prices divergence over future releases; brings the trade-off to the right decider with a clear recommendation and respects the decision; works with sales to reset expectations without blame; if building, keeps it behind a clean interface, aimed at upstream, with an exit plan; real example with personal contribution and the outcome for the relationship, or an honest "have not" with sound reasoning.

## CFL-L5-04: Leading one team across three time zones with handoffs instead of meetings

| | |
|---|---|
| **Template ID** | CFL-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team leadership / distributed teams, written handoffs, on-call, decision making |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "size": [8, 12, 18],
  "overlap": ["one hour a day", "two hours a day", "none"],
  "owns": ["the connector runtime", "the schema registry service", "the cross-region replication service"],
  "handoffs": [3, 4, 6]
}
```

**Business Scenario.** You lead a team of {{size}} engineers who own {{owns}} for a managed streaming service. The team is split across the Americas, Europe and South Asia; working time shared by all three regions: {{overlap}}. Last month a customer-facing incident passed through {{handoffs}} handoffs before it was resolved, and each handoff lost time while the next person rebuilt context. Design reviews wait a week for a meeting everyone can attend, and engineers in one region say decisions are made while they sleep.

**Problem Statement.** How do you make the team work well across the three time zones? Cover how work and ownership are divided between regions; what a good handoff contains and how it is made, for incidents and for ordinary work; how decisions are made in writing and when a meeting is still needed; how on-call is organised; how you notice and fix it when one region feels second-class; and how you would measure whether things are better in three months. Then tell me about a real time you led or worked in a distributed team and changed how it worked, or say that you have not and reason it through.

**Constraints.** Moving people or hiring in one place is not an option this year. Customer incidents must be worked around the clock. No one should routinely work outside their own hours.

**Assumptions.** The team, regions and incident are hypothetical.

**Clarifications.**
- Q: Are the regions equal in size and seniority? | A: No. Most senior engineers are in one region.
- Q: Is there an incident tool? | A: Yes, with a timeline; people rarely write in it during an incident.
- Q: How are design decisions recorded today? | A: In meetings and chat threads; there is no single place.
- Q: Are you in one of the regions? | A: Yes, in the one with most senior engineers.

**Hints.**
1. A handoff is a written artefact: state, hypotheses ruled in and out, next steps, and who owns it now.
2. Give each region ownership of whole things, not leftovers from another region's day.
3. Written decisions with a stated comment window let everyone take part without a meeting.

**Follow-ups.**
1. What would a good incident handoff note look like for last month's incident?
2. How would you divide ownership so that each region owns whole pieces of work, including design and decisions?
3. How do you make sure the region without senior engineers grows and is not just the night shift?
4. Three months on, how do you know whether it worked?
5. In your real example, what did you change, and what still did not work?

**Follow-up rules.**
- when: follow the sun, follow-the-sun → ask: Follow-the-sun means every incident crosses at least one handoff. When would you rather keep one person on it longer?
- when: meeting, meetings, sync, standup → ask: Which meetings survive your change, at what time, and which region pays the inconvenience?
- when: document, written, rfc, design doc → ask: How long do people get to comment, and what happens to a decision that someone in another region disagrees with after it is made?
- when: we changed, the team changed, we agreed → ask: What did you personally change, and how did you find out it was working?
- when: rotate, rotation, rotating → ask: Rotating meeting times shares the pain. How does it affect the people with caring responsibilities in each region?

**Evaluation Criteria.** Diagnoses where time is lost (the incident timeline, decision latency, who waits for whom) before changing anything; gives each region ownership of whole areas, including decisions and design; a written handoff format used for incidents and ordinary work, with an explicit owner at every moment; written decisions with comment windows and a few meetings with fairly shared times; on-call designed so incidents are followed around the clock without hero hours; develops seniority in every region; measures the change (time lost per handoff, decision latency, survey of each region); real example with personal contribution and honest outcomes, or an honest "have not" with sound reasoning.

## CFL-L5-05: Project deep dive, re-examined for event streams with ordering and replay guarantees

| | |
|---|---|
| **Template ID** | CFL-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, ordering and replay |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "guarantee": ["per-key ordering, even when producers retry and partitions are added", "replaying 90 days of history into a new consumer without disturbing live ones", "results that count every event exactly once when consumers crash mid-batch", "old events that must stay readable after the schema changes many times"],
  "events": ["thousands", "hundreds of thousands", "millions"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if its inputs arrived as event streams of {{events}} of events per second, and its users required {{guarantee}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the system were built on event streams with {{guarantee}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The event-stream setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a streaming system? | A: No. Any system that moved, stored or computed data others depended on; the event-stream part is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, ordering, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the event-stream question, start from the key: what must be ordered relative to what, and what may be processed independently.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design assume data arrives once and in order? What breaks first with event streams?
4. How would you provide {{guarantee}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, kinesis, pulsar, flink, spark → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: partition, partitioned, partition key → ask: One key is a hundred times busier than the rest. What happens to ordering and lag on its partition?
- when: replay, reprocess, backfill → ask: While you replay, live consumers and producers keep running. What protects them, and how do you know the replayed results equal the originals?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible event-stream analysis that starts from keys and ordering, names assumptions of once-only and in-order delivery, and addresses {{guarantee}} incrementally (for example keyed partitioning with stable partition counts, idempotent producers and consumers, transactional or idempotent outputs, separate replay paths with quotas, schema compatibility rules enforced at write time); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
