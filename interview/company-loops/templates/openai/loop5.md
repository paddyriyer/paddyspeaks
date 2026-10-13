# OpenAI · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of an AI model
provider. Every situation is hypothetical. Answer from your own experience, or
say plainly that you have not faced it and reason it through. Never invent a story.

## OAI-L5-01: Usage numbers that finance no longer trusts

| | |
|---|---|
| **Template ID** | OAI-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident response / data correctness, cross-team trust |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "drift": ["0.6%", "1.8%", "3.5%"],
  "days": [4, 9, 14],
  "audience": ["the CFO's monthly review", "an enterprise customer's invoice dispute", "a board metrics pack"]
}
```

**Business Scenario.** Your team owns the usage pipeline that turns inference telemetry into token totals. For {{days}} days, the totals have drifted {{drift}} above what the billing system charged. The number has already appeared in {{audience}}. The inference platform team says their events are correct; the billing team says the same about theirs.

**Problem Statement.** Tell me how you would lead the response: the first hour, the first day and the following two weeks. Then tell me about a real time you led a team through a data-correctness problem that other teams disputed (use STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** You cannot pause billing. Three teams own parts of the path, and none reports to you.

**Assumptions.** Hypothetical situation and figures.

**Clarifications.**
- Q: Has anyone acted on the wrong number? | A: Yes: it went into {{audience}}.
- Q: Who decides what is published externally? | A: Finance, with your recommendation.
- Q: Is customer billing itself known to be wrong? | A: Unknown. That is part of what you must establish.

**Hints.**
1. Contain before you diagnose: who needs to stop using the number right now?
2. Compare the three systems at the finest grain they share.
3. A good answer names who owns each decision and how disagreement gets resolved.

**Follow-ups.**
1. The inference team's lead says the drift is your pipeline's bug and refuses to look. What do you do?
2. You find that both sides are partly wrong. How do you communicate that without making it a blame exercise?
3. What would you change so this class of problem is caught within an hour next time? Name the check, its threshold, where it runs and who is paged.
4. What did you personally do in your real example, separate from your team, and what would you do differently?

**Follow-up rules.**
- when: blame, fault, their bug, they broke → ask: How do you keep three teams cooperating once someone feels blamed?
- when: rollback, revert → ask: What exactly would you roll back, and how do you know the rollback does not make billing worse?
- when: dashboard, alert, monitor → ask: What threshold would have fired here, and how do you stop it paging every day for noise?
- when: we decided, the team decided → ask: What did you personally decide or do?

**Evaluation Criteria.** Contains first; verifies before asserting; brings three owners to one fact base at a shared grain; clear decision rights and communication to finance; blameless but accountable; concrete prevention with owners; real example has measurable evidence and a personal contribution, or is honestly marked as hypothetical.

## OAI-L5-02: Build or buy an evaluation platform under launch pressure

| | |
|---|---|
| **Template ID** | OAI-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Architecture trade-off / build vs buy, decision records |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "weeks": [6, 8, 12],
  "team": [3, 5, 8],
  "vendor_cost": ["$300k", "$900k", "$1.6M"],
  "gap": ["it cannot run evaluations inside your own network", "it has no way to version grader models", "it only supports exact-match scoring"]
}
```

**Business Scenario.** A model launch is {{weeks}} weeks away. Research runs evaluations with a collection of scripts that nobody fully trusts, and leadership wants a proper evaluation platform before the launch. You lead a team of {{team}} engineers. A vendor offers a hosted evaluation product for about {{vendor_cost}} a year that covers most needs, but {{gap}}. Your team estimates a minimal in-house platform at most of the time before launch, with nothing else delivered in that period.

**Problem Statement.** How would you reach and drive the decision: what you would find out in the first days, who decides, what you would recommend under each outcome, and how you would protect the launch either way? Then tell me about a real build-versus-buy or adopt-versus-extend decision you drove (STAR, with what it cost and what happened afterwards), or say plainly that you have not and reason through it.

**Constraints.** The launch date does not move. Evaluation results gate the launch. The team cannot grow before launch.

**Assumptions.** Hypothetical situation, prices and estimates. No real vendor is implied.

**Clarifications.**
- Q: Who signs the vendor contract? | A: Your director, on your recommendation, after a security review that takes about three weeks.
- Q: Can the existing scripts run the launch evaluations? | A: Yes, with heroics. Their results have disagreed with each other twice this quarter.
- Q: What does research want most? | A: Results they can reproduce and compare, more than a dashboard.

**Hints.**
1. Separate what must be true for the launch from what the platform should become afterwards.
2. Price the in-house option in engineer-weeks and in what does not get done, not only in salary.
3. Make the decision reversible where you can: what would you need to own so switching later is cheap?

**Follow-ups.**
1. Research leadership prefers to build because "evaluation is our core competency". Your estimate says building puts the launch at risk. How do you handle that conversation?
2. You choose the vendor, and five weeks before launch the security review finds a blocker. What is your fallback, and when did you prepare it?
3. How would you write the decision down so that someone reading it in a year understands why it was right or wrong at the time?
4. In your real example, what evidence did you have, what did you get wrong, and what did it cost?

**Follow-up rules.**
- when: core competency, strategic, differentiator → ask: Which part of evaluation is actually differentiating, and could you build only that part and buy the rest?
- when: lock-in, locked in, vendor lock → ask: What exactly would you own (manifests, result formats, data) so leaving the vendor later is cheap?
- when: total cost, tco, cost of ownership → ask: Walk me through the in-house number. What is the on-call and maintenance cost in year two?
- when: we decided, the team decided, leadership decided → ask: What did you personally recommend, and what would have changed your mind?

**Evaluation Criteria.** Frames the decision around the launch's real requirements and the long-term platform separately; gathers evidence fast (vendor proof of concept on the hardest requirement, security review started on day one, honest in-house estimate); prices both options including opportunity cost and year-two ownership; names the decider and records the decision; keeps a fallback for the launch; protects reversibility by owning formats and data; real example has evidence, a personal contribution and lessons, or is honestly marked as hypothetical.

## OAI-L5-03: Telemetry storage and query costs doubled in a quarter

| | |
|---|---|
| **Template ID** | OAI-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cost optimization / storage and compute, cross-team cost ownership |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "spend": ["$140k", "$420k", "$1.1M"],
  "target": ["25%", "40%"],
  "deadline": ["one quarter", "two months"],
  "driver": ["a dashboard tool that rescans raw tables every few minutes", "a new debugging dataset nobody set a retention for", "traffic that grew three-fold after a launch"]
}
```

**Business Scenario.** The telemetry platform your team owns costs {{spend}} a month in storage and query compute, double what it cost a quarter ago. Finance has asked for a {{target}} reduction within {{deadline}} without losing anything the business depends on. Your first look suggests one large contributor is {{driver}}, but most of the bill is not yet attributed to any team.

**Problem Statement.** How would you lead this: what you would do in the first week, how you would decide what to cut, how you would bring the teams that create the cost along, and how you would keep it from doubling again? Then describe a real cost reduction you led (STAR, with the before and after numbers and your own part), or say plainly that you have not and reason through it.

**Constraints.** Billing-grade usage data and its daily reconciliation must not be affected. You do not control the teams that run most of the queries.

**Assumptions.** Hypothetical figures and causes.

**Clarifications.**
- Q: Can you see who runs which queries? | A: Query logs exist, but most dashboards use one shared service account.
- Q: Is the growth in traffic itself expected to continue? | A: Yes. Unit cost has to fall even if total cost does not.
- Q: Is anyone already accountable for cost? | A: No team has a cost budget for data today.

**Hints.**
1. You cannot cut what you cannot attribute. Unit costs (per million events stored, per query, per dashboard) beat a total.
2. Some savings are pure engineering (formats, partitioning, compaction, retention); some need someone else to change behaviour. Plan them differently.
3. Decide in advance how you will know a cut did no harm.

**Follow-ups.**
1. A research team's ad-hoc queries are 30% of compute, and their lead says the work is critical and the cost is not your concern. What do you do?
2. Shortening retention would meet the target on its own. Why might that be the wrong first move?
3. How do you stop costs drifting up again next year? Name the mechanism and who owns it.
4. In your real example, which saving did you expect that never materialised, and why?

**Follow-up rules.**
- when: retention, delete old, shorter retention → ask: Who depends on the oldest data today, and how did you find out before cutting it?
- when: chargeback, showback, budget → ask: How do you make attribution fair when shared tables serve several teams?
- when: compression, parquet, partition, compaction → ask: How much of the target does that deliver, and how did you estimate it before doing the work?
- when: sampling, sample → ask: Which consumers can live with sampled data, and how do you keep billing-grade data exact?

**Evaluation Criteria.** Attributes cost before cutting; unit economics and a ranked list of savings with estimates; quick engineering wins separated from behaviour changes that need negotiation; protects billing-grade data; makes cost visible to the teams that cause it (showback or budgets) with an owner; verifies savings and checks for harm; real example has before and after numbers and a personal contribution, or is honestly marked as hypothetical.

## OAI-L5-04: A legacy metering job, one owner, who is leaving

| | |
|---|---|
| **Template ID** | OAI-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical debt / bus factor, safe migration of billing-critical code |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "weeks_left": [2, 4, 6],
  "stack": ["a chain of shell scripts and SQL files run by cron", "a single 6,000-line Python script on one virtual machine", "an old Spark job pinned to a framework version nobody else uses"],
  "invoice_day": ["the 1st", "the 3rd"],
  "volume": ["$8M", "$40M"]
}
```

**Business Scenario.** A nightly metering job turns usage records into the per-customer totals that invoices are built from, about {{volume}} of revenue a month. It is {{stack}}, has no tests, and is understood by one engineer, who has resigned and leaves in {{weeks_left}} weeks. Invoices are generated on {{invoice_day}} of each month. Your roadmap for the quarter is already full.

**Problem Statement.** What do you do this week, before the engineer leaves, and over the next two quarters? Who do you involve, what do you stop, and how do you replace the job without changing a single invoice by accident? Then describe a real time you inherited or retired critical code with little knowledge transfer (STAR, with measurable outcomes and your own part), or say plainly that you have not and reason through it.

**Constraints.** Invoices must go out on {{invoice_day}} every month. Any change to totals must be explained to finance before an invoice carries it.

**Assumptions.** Hypothetical system, timing and figures.

**Clarifications.**
- Q: Is the leaving engineer cooperative? | A: Yes, but busy with their own handover list.
- Q: Are there known bugs? | A: Two customers' totals are adjusted by hand every month. Nobody knows why.
- Q: Can you add headcount? | A: Not this quarter. You can trade roadmap items with your manager's approval.

**Hints.**
1. Before rewriting anything, capture what the job actually does: inputs, outputs, schedules, and the manual steps around it.
2. A parallel run with automated comparison is the safest way to prove a replacement.
3. Ask what you are willing to drop from the roadmap. The answer is the real priority.

**Follow-ups.**
1. Two weeks into the parallel run, the new job differs from the old one by 0.3% for twelve customers. The old job's behaviour looks like a bug. Which one goes on the invoice?
2. Your manager wants to delay the rewrite to next year because "it has run for five years". How do you make the case, or do you agree?
3. How do you make sure the knowledge does not end up in one new person's head?
4. In your real example, what did you discover only after the previous owner had gone?

**Follow-up rules.**
- when: rewrite, rebuild, from scratch → ask: How do you prove the rewrite produces the same totals, and what do you do where it should not?
- when: documentation, document, runbook → ask: What specifically goes in the runbook in the first week, and how do you test it before the owner leaves?
- when: shadow, parallel run, dual run → ask: How long does the parallel run last, what is the comparison grain, and what difference is acceptable?
- when: hire, contractor, consultant → ask: Headcount is frozen this quarter. What do you take off the roadmap instead?

**Evaluation Criteria.** Treats the departure as a risk with a deadline and acts this week (recorded walkthroughs, runbook tested by someone else running the job, access and credentials transferred, the manual adjustments explained); makes the risk visible and trades roadmap explicitly; replaces the job through characterisation tests and a parallel run compared at customer and line grain; agrees with finance how intentional differences are handled; spreads ownership; real example has evidence, a personal contribution and lessons, or is honestly marked as hypothetical.

## OAI-L5-05: Request logging — research wants more, privacy wants less

| | |
|---|---|
| **Template ID** | OAI-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical disagreement / privacy, debugging needs and cost |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "ask": ["full request and response bodies for 30 days", "a 5% sample of request and response bodies for 14 days", "token-level output probabilities plus request metadata for 30 days"],
  "cost": ["$60k", "$250k", "$700k"],
  "decide_by": ["two weeks", "a month"]
}
```

**Business Scenario.** Model researchers want richer request logging to debug quality regressions: {{ask}}. The privacy team wants less than is logged today, pointing to customer agreements and the data-minimisation principle. Infrastructure estimates the request at {{cost}} a month in storage and processing and worries about operating it. All three teams have escalated to you, and you have been asked to drive a decision within {{decide_by}}.

**Problem Statement.** How would you drive this to a decision: how you frame it, what evidence you gather, who decides, what options you put forward and how you keep the three teams working together afterwards? Then describe a real technical disagreement you drove to a decision across teams with competing goals (STAR, with the outcome and your own part), or say plainly that you have not and reason through it.

**Constraints.** You do not manage any of the three teams. Any decision must honour existing customer agreements, including customers who have opted out of data retention. The decision must be revisited if it turns out wrong, without a new escalation.

**Assumptions.** Hypothetical teams, figures and options. No statement here describes any company's actual logging practice.

**Clarifications.**
- Q: What regression prompted this? | A: A quality drop last month took nine days to diagnose because nobody could see example requests.
- Q: Who has final say? | A: A named executive, on your recommendation. Privacy has a veto on anything that breaks an agreement.
- Q: Is there an existing access process for logged data? | A: Yes, ticket-based, but research says it takes days.

**Hints.**
1. Reframe positions as needs: what question does research need to answer, what risk does privacy need to avoid, what cost and load can infrastructure carry?
2. The options are not only "more" or "less": consider scope, sampling, retention, redaction, access path and opt-in sources.
3. Agree the decision criteria before debating the options.

**Follow-ups.**
1. The research lead says that without full bodies they cannot do their job, and privacy says any bodies at all are unacceptable. How do you move them?
2. What would you measure in three months to know whether the decision was right?
3. The executive picks an option you argued against. What do you do next?
4. In your real example, what did you concede, and what would you do differently?

**Follow-up rules.**
- when: compromise, middle ground, split the difference → ask: A compromise can leave every team unable to do its job. How do you check the middle option actually solves research's problem?
- when: anonymize, anonymise, redact, scrub → ask: How do you know the redaction works on free-text prompts, and who signs off that it is good enough?
- when: sampling, sample → ask: Is a sample enough to catch a regression that only affects a small slice of traffic?
- when: escalate, executive, leadership decides → ask: What do you bring to the executive so the decision is quick and sticks?

**Evaluation Criteria.** Turns positions into needs and agreed decision criteria; gathers evidence (the debugging cases that failed, what data would have resolved them, the agreements that bind, real cost figures); puts forward several concrete options with trade-offs (for example scoped sampling, redaction, short retention, opt-in or internal traffic, faster access path) and a recommendation; respects privacy's veto and customer agreements; names the decider and a review date with success metrics; keeps relationships intact; real example has evidence, a personal contribution and lessons, or is honestly marked as hypothetical.
