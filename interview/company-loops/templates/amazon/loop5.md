# Amazon · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of an online
marketplace with its own fulfilment and delivery network and a public cloud.
Every situation is hypothetical, and none describes any company's hiring
process or the values it assesses. Answer from your own experience, or say
plainly that you have not faced it and reason it through. Never invent a story.

## AMZ-L5-01: Delivery promises broken by stale carrier capacity data

| | |
|---|---|
| **Template ID** | AMZ-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / data correctness, customer promises, cross-team response |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "orders": ["60,000", "250,000", "900,000"],
  "hours": [5, 14, 30],
  "cause": ["a pipeline that kept republishing the last good capacity file after its source stopped updating", "a schema change upstream that turned missing capacity values into zeros the loader read as unlimited", "a backfill that overwrote this week's capacity with last year's holiday figures"]
}
```

**Business Scenario.** Your team owns the pipeline that feeds daily delivery-station and carrier capacity into the service that sets the delivery date shown at checkout. For {{hours}} hours during a busy shopping weekend, the capacity that checkout read was wrong; the cause was {{cause}}. Checkout promised dates the network could not meet, and about {{orders}} orders now carry promises that will be missed. Customers have started contacting support, the operations teams are moving volume between stations by hand, and you are the most senior engineer on the team.

**Problem Statement.** Tell me how you would lead the response in the first hour, the first day and the following weeks. Cover stopping new bad promises, working out exactly which orders are affected and by how much, what customers are told and when, how you work with the operations, checkout and customer-service teams, and how you prevent a repeat. Then tell me about a real incident where data you owned caused customer-visible harm (situation, your actions, measurable result), or say that you have not and reason through how you would.

**Constraints.** You do not own the checkout service, the operations teams or customer messaging. Promised dates already shown to customers cannot be silently changed. Operations can add some capacity, but not enough to save every order.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the bad data still flowing when you are paged? | A: You do not know yet. The alert is from operations: one station's volume for tomorrow is far above its capacity.
- Q: Can checkout fall back to something safer? | A: It has a conservative default capacity setting, but turning it on lengthens promises for every customer.
- Q: Who decides what customers are told? | A: Customer-service and checkout leaders, using your numbers.
- Q: Did any check exist on the capacity feed? | A: Row counts and a freshness timestamp on the file, both of which passed.

**Hints.**
1. Contain first: what is the fastest switch that stops new wrong promises, and what does it cost?
2. The affected list is a join between orders, their promised dates and the capacity they consumed. Define "affected" before you count.
3. The checks that passed tell you what the next check must measure: content, not just arrival.

**Follow-ups.**
1. Turning on the conservative capacity default lengthens promises for every customer, including those in regions the bug did not touch. Do you turn it on? Who decides?
2. Operations can save some orders by moving volume. How do you help them choose which ones?
3. Your list of affected orders is 15% larger than operations' estimate. How do you resolve the difference before customers are contacted?
4. What check would have caught this failure within an hour of it starting? Name the signal, the threshold and the owner.
5. In your real example, what did you personally decide, and what would you do differently?

**Follow-up rules.**
- when: rollback, revert, roll back → ask: Rolling back the pipeline stops new bad data, but checkout has cached the capacity it already read. What else must happen before promises are right again?
- when: notify all, email everyone, tell all customers → ask: Some of those orders will still arrive on time after operations moves volume. How many customers would you alarm unnecessarily, and does that matter?
- when: postmortem, post-mortem, retro, review → ask: Name one change from the review that actually shipped, and how you checked it would catch this exact failure.
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?
- when: data quality, validation, checks → ask: The existing checks passed. What property of the data do your new checks measure that the old ones did not?

**Evaluation Criteria.** Contains first with an explicit trade-off (conservative fallback, pinning to last verified data, regional scoping); precise definition and count of affected orders reconciled with operations; works through owners it does not control with clear facts and decision rights; customer communication that is timely and honest without over-alarming; prevention that tests content (distribution shifts, unchanged files, zero or unlimited values) with an owner and threshold; real example with measurable evidence and personal contribution, or honestly hypothetical.

## AMZ-L5-02: One shared order-events table, many writers, no contracts

| | |
|---|---|
| **Template ID** | AMZ-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Influence without authority / data contracts, platform adoption |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "writers": [12, 30, 60],
  "breaks": [2, 4, 7],
  "consumers": ["seller reports and finance close", "returns analytics and fraud review", "demand forecasting and inventory planning"]
}
```

**Business Scenario.** A shared table of marketplace order events (placed, item cancelled, shipped, returned, refunded) is written by {{writers}} teams' services and read by {{consumers}}, among many others. Nobody owns its schema. A team renames a field, changes a status value, or starts emitting events for a new order type, and something downstream breaks; that has happened {{breaks}} times in the last quarter, each found days later by a consumer. You lead the data platform team, which runs the table's infrastructure but does not manage any of the writing teams.

**Problem Statement.** How would you fix this? Cover how you establish what is actually written and read, what you propose (data contracts, ownership, validation, versioning or something else), how you get teams you do not manage to adopt it while they have their own roadmaps, how you roll it out without breaking the consumers you are trying to protect, and how you know it worked. Then describe a real change you drove across teams that did not report to you, with its outcome, or say that you have not and reason it through.

**Constraints.** You cannot stop the writing teams from shipping. The table cannot be frozen; new order types are launched every quarter. Your team has two engineers for this.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does leadership support this? | A: They agree it is a problem; they have not given you any authority over the writing teams.
- Q: Is there any schema documentation? | A: A wiki page, last edited a year ago.
- Q: Do consumers know which fields they use? | A: Roughly. Nobody has measured it.
- Q: Do writing teams know they break consumers? | A: Most learn about it from an angry message days later.

**Hints.**
1. Measure before you propose: which fields are read, by whom, and what each break cost.
2. The cheapest adoption path is one that makes the writing team's life easier, not just the consumer's.
3. Start where breaks hurt most and prove the approach on two or three writers before asking all of them.

**Follow-ups.**
1. What does a contract for one event type contain, and where is it enforced: in the writer's build, at publish time, or at the table?
2. The team that caused the most breaks says they have no time this quarter. What do you do?
3. A contract check blocks a writing team's deploy on launch day. Who decides whether it ships?
4. Six months in, how do you know this worked, and what would make you change course?
5. In your real example, who resisted, why, and what changed their mind?

**Follow-up rules.**
- when: mandate, require, enforce, block → ask: You have no authority over the writing teams. Who enforces it, and what happens the first time a team ignores it?
- when: documentation, wiki, document → ask: The last documentation went stale within a year. What keeps yours true?
- when: schema registry, registry, contract → ask: What does a writing team have to do differently on day one, and how long does it take them?
- when: escalate, escalation, leadership → ask: What would you put in front of leadership, and what do you ask them to decide?

**Evaluation Criteria.** Evidence first (field-level usage, cost of each break); a proposal sized to two engineers (contracts per event type, ownership, compatibility rules, checks in the writer's pipeline, versioned changes); adoption through value to writers and a pilot with the most painful sources; a rollout in warn-then-block stages that protects consumers; clear decision rights for blocked deploys; measures of success (breaks, time to detect, adoption); real example of cross-team influence with a measured outcome and personal contribution, or honestly hypothetical.

## AMZ-L5-03: A multi-year compute commitment the forecast cannot yet justify

| | |
|---|---|
| **Template ID** | AMZ-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cost decisions under uncertainty / cloud commitments, finance partnership |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "spend": ["$150,000 a month", "$900,000 a month", "$4 million a month"],
  "discount": ["20%", "35%", "50%"],
  "term": ["one-year", "three-year"],
  "uncertainty": ["a planned migration of the batch platform to a different compute type", "a forecasting model rewrite that may halve or double training compute", "a new marketplace region whose demand is unknown"]
}
```

**Business Scenario.** Your data platform spends about {{spend}} on cloud compute at on-demand prices. Finance proposes buying a {{term}} commitment covering most of today's usage, which would cut that cost by about {{discount}} on what it covers. You own the platform's architecture, and the decision needs your recommendation. The difficulty is {{uncertainty}}, so you do not know what the platform will use in a year.

**Problem Statement.** How would you reach and present a recommendation? Cover the data you gather about current and future usage, how you size the commitment (all, some or none), how you weigh the saving against the risk of paying for capacity you no longer use, how the commitment interacts with the architecture choices ahead, and how you keep the decision under review. Then tell me about a real decision where you traded a cost saving against flexibility, with its outcome, or say that you have not and reason it through.

**Constraints.** The commitment cannot be cancelled once bought. Finance needs an answer this month. The engineering roadmap cannot be held hostage to the commitment.

**Assumptions.** The situation and figures are hypothetical. The commitment applies to a flexible family of compute rather than a single instance type unless you choose otherwise.

**Clarifications.**
- Q: Is usage steady? | A: There is a steady base, a nightly batch peak, and month-end spikes.
- Q: Can commitments be layered? | A: Yes. You can buy part now and more later.
- Q: Who owns the decision? | A: Finance signs; your recommendation carries the technical risk.
- Q: How confident is the usage forecast? | A: That is for you to establish.

**Hints.**
1. Separate the base that will exist in every plausible future from the usage that depends on the uncertain change.
2. Compute the break-even: how much of the committed usage can disappear before the commitment costs more than on-demand?
3. Commitment flexibility (family-level versus instance-level) has a price; compare it with the architecture risk.

**Follow-ups.**
1. Show me how you would size the commitment from the last six months of hourly usage. Which percentile of usage do you commit to, and why?
2. What is the break-even utilisation at a {{discount}} discount, and what does that tell you?
3. Six months after the purchase, usage covered by the commitment falls 40%. What happens to the bill, and what could you have done at purchase time?
4. A year later, an engineer proposes moving a large workload to a cheaper compute type that the commitment does not cover. How do you decide?
5. In your real example, what did the decision cost or save, measured how?

**Follow-up rules.**
- when: all of it, 100%, full coverage → ask: The usage you commit to includes the nightly peak and the month-end spikes. How many hours a month is that capacity unused?
- when: on-demand, stay flexible, no commitment → ask: You are leaving a {{discount}} discount on the table for the steady base that will exist anyway. How do you justify that to finance?
- when: forecast, projection, model → ask: How wrong was the last usage forecast for this platform, and how does that error shape your recommendation?
- when: spot, preemptible, interruptible → ask: Which of the platform's workloads tolerate interruption, and how much of the cost do they represent?

**Evaluation Criteria.** Usage data at hourly grain separated into base, peak and uncertain components; commitment sized to the base that survives every scenario, layered over time; break-even arithmetic stated (a discount d breaks even at a utilisation of 1 − d); risk framed for finance in money terms with scenarios; architecture decisions kept free where flexibility matters; review cadence with triggers; real example with numbers and personal contribution, or honestly hypothetical.

## AMZ-L5-04: A peer's reservation design that you believe can oversell

| | |
|---|---|
| **Template ID** | AMZ-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical disagreement with a peer / design review, evidence, escalation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "peer": ["a principal engineer from the checkout team", "a respected senior engineer on your own team", "the engineer who built the current reservation service"],
  "benefit": ["checkout latency cut by half", "a third of the reservation service's hardware cost saved", "the deal-day hot-key problem gone without re-sharding"],
  "weeks": [3, 6, 10]
}
```

**Business Scenario.** Ahead of the next big sale, {{peer}} proposes replacing the inventory reservation path with in-memory counters per region that are reconciled with the inventory ledger every few seconds. The design review document promises {{benefit}}. You have read it closely and believe that under a burst of orders for one deal item, two regions can each sell the last units before reconciliation runs, so the deal can oversell. The proposal is popular, the design review is in a week, and building would start in {{weeks}} weeks.

**Problem Statement.** What do you do? Cover how you check that your concern is real before you raise it, how you raise it with the author, how you bring evidence to the review, what you propose instead (or as a change to the design), how a decision gets made if you and the author still disagree, and what you do once it is made, whichever way it goes. Then tell me about a real time you disagreed with a peer's technical design, with what happened, or say that you have not and reason it through.

**Constraints.** You are not the author's manager, and the author is at least as senior as you. The sale date does not move. Overselling a deal means cancelling orders customers were told were confirmed.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Has anyone else raised the concern? | A: Not in writing. One engineer mentioned "consistency" in a comment without detail.
- Q: Is the benefit real? | A: The latency or cost benefit is plausible; the author has a benchmark.
- Q: Who decides after the review? | A: The owning team's lead, with the review's input; escalation goes to the director over both teams.
- Q: Can the design be changed rather than rejected? | A: Yes, and the author would rather change it than lose it.

**Hints.**
1. Turn the concern into something testable: a sequence of events, or a small simulation, that oversells.
2. Raise it with the author first, privately and early, as a question about the design rather than a verdict on it.
3. Look for a design that keeps most of the benefit and removes the risk; the choice is rarely all or nothing.

**Follow-ups.**
1. How would you demonstrate the oversell risk concretely, and how likely is it at the deal's expected order rate?
2. The author agrees there is a window for overselling but says it is small enough to accept. How do you decide together how small is small enough?
3. What changes to the design would keep most of the promised benefit without the risk?
4. The decision goes the author's way. What do you do in the {{weeks}} weeks before building starts, and on the day of the sale?
5. In your real example, what evidence moved the decision, and what did the disagreement do to the working relationship?

**Follow-up rules.**
- when: escalate, escalation, director → ask: What do you put in front of the director, and how do you show the author's case as fairly as your own?
- when: reject, block, veto → ask: You are not the decider. What happens if the owning team's lead approves it anyway?
- when: test, simulation, model, prototype → ask: Your test shows an oversell rate of one in a million orders. Is that acceptable? Who should say so?
- when: compromise, hybrid, middle ground → ask: Which part of the benefit does your hybrid give up, and does the author agree it is worth it?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say, and when?

**Evaluation Criteria.** Verifies the concern first and makes it concrete (an event sequence, a simulation, a quantified oversell rate at the expected load); raises it early and privately, as a question, with respect for the author; brings evidence to the review and proposes design changes that keep most of the benefit (for example exact reservations for capped deal items only, per-region allotments that cannot exceed the cap, or an exact final check at order confirmation); respects decision rights and escalates fairly if needed; commits fully once decided while making the residual risk visible and monitored; real example with what changed and personal contribution, or honestly hypothetical.

## AMZ-L5-05: Proving the order pipeline is ready for peak season

| | |
|---|---|
| **Template ID** | AMZ-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Operational readiness / load testing, risk, go/no-go across teams |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "multiplier": ["4×", "7×", "12×"],
  "weeks": [6, 10, 14],
  "dependencies": [8, 15, 25],
  "last_year": ["order events lagged three hours behind and seller reports were late for two days", "a downstream returns service throttled and order confirmations were delayed for forty minutes", "nothing failed, but only because a manual throttle was applied by one engineer at 2 a.m."]
}
```

**Business Scenario.** A large shopping event is {{weeks}} weeks away. Your team owns the order-event pipeline that carries placed, cancelled, shipped and returned order events from checkout to {{dependencies}} downstream systems: fulfilment, payments, seller reports, analytics, forecasting and others owned by other teams. Peak order rate is expected at {{multiplier}} a normal day. Last year, {{last_year}}. Leadership has asked you to lead readiness for the pipeline and to make a go or no-go call on the planned changes your team wants to ship before the event.

**Problem Statement.** How would you lead it? Cover how you find the limits of your pipeline and its dependencies, how you test them without harming production, what you change and what you freeze, how you get the other teams to take part, what is decided in advance for the day itself (alarms, levers, who is on call), and how you would decide whether a planned change ships. Then tell me about a real high-stakes launch or peak event you prepared for, with what happened, or say that you have not and reason it through.

**Constraints.** You do not own the downstream systems. Load tests in production need the other teams' agreement. Your team also has committed feature work.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Has the pipeline been load-tested before? | A: Last year, at a lower rate, and only up to its own boundary.
- Q: Can traffic be shaped on the day? | A: Some consumers can be slowed or paused; checkout itself cannot be.
- Q: Who makes the final go/no-go on the event's changes? | A: You, for your pipeline, with an escalation path to the event's overall leader.
- Q: Is there a change freeze? | A: A general one starts one week before the event; you can set a stricter one.

**Hints.**
1. Find the first thing that breaks at {{multiplier}}, then the second. Test the whole chain, not only your part.
2. Decide the levers before the day: which consumers can be slowed, what is shed first, and who may pull each lever.
3. A planned change ships only if its value before the event exceeds its risk, and it can be turned off in minutes.

**Follow-ups.**
1. Walk me through the load test plan: what traffic, where, at what rate, and how you protect real customers during it.
2. A downstream team says they cannot take part in testing before the event. What do you do?
3. Your test shows the pipeline holds at {{multiplier}}, but one consumer falls behind at half that. What do you change, and who owns it?
4. Your team wants to ship a new partitioning scheme three weeks before the event because it fixes last year's lag. Go or no-go, and on what evidence?
5. In your real example, what did you get wrong in preparation, and what did you change afterwards?

**Follow-up rules.**
- when: load test, stress test, game day → ask: Your test traffic flows into the payments and fulfilment systems downstream. How do you keep it from becoming real orders or real charges?
- when: freeze, code freeze, no changes → ask: The freeze blocks a fix for a bug you find in week two of testing. How do you decide whether the fix goes out?
- when: autoscaling, scale up, add capacity → ask: Which part of the pipeline cannot scale by adding machines, such as a partition count or a downstream limit, and what is your plan for it?
- when: runbook, playbook, on-call → ask: Who has rehearsed that runbook under load, and what did the rehearsal change?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and what did it cost?

**Evaluation Criteria.** Readiness driven by evidence (capacity model per stage and dependency, end-to-end load tests at and beyond the expected peak with synthetic traffic that cannot become real orders); fixes prioritised by the first limit hit; dependencies brought in with clear asks and owners; levers, alarms, on-call and escalation decided and rehearsed before the day; change decisions based on value, risk and reversibility, with a stricter freeze where warranted; last year's failure explicitly addressed; real example with what happened and personal contribution, or honestly hypothetical.
