# Google · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domains of a search,
video, maps, advertising and cloud company. Every situation is hypothetical.
Answer from your own experience, or say plainly that you have not faced it and
reason it through. Never invent a story.

## GOO-L5-01: Conversions double-counted, and automated bidding acted on them

| | |
|---|---|
| **Template ID** | GOO-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / data correctness with automated downstream consumers |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "days": [2, 4, 6],
  "advertisers": ["900", "6,000", "35,000"],
  "inflation": ["18%", "35%", "60%"],
  "cause": ["a deduplication step that was skipped after a pipeline migration", "a tag change that sent each conversion through two ingestion paths", "a backfill that re-imported conversions the stream had already counted"]
}
```

**Business Scenario.** Your team owns the pipeline that turns advertisers' conversion events (purchases, sign-ups) into the conversion counts shown in advertising reports and consumed by automated bidding, which raises bids for ads that appear to convert well. For {{days}} days, {{cause}} inflated conversions by about {{inflation}} for roughly {{advertisers}} advertisers. Automated bidding responded by bidding higher, so those advertisers spent more than they otherwise would have. An advertiser's analyst noticed that reported conversions no longer match their own sales system. You are the most senior engineer on the pipeline.

**Problem Statement.** Tell me how you would lead the response: the first hour, the first day and the following weeks. Cover stopping the inflation, correcting the data, the effect on bidding and spend, who decides about remediation for advertisers, communication, and prevention. Then tell me about a real incident where wrong data drove automated decisions or customer cost (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** Corrected conversions will change the inputs of bidding models that have already adapted to the inflated numbers. Reports are read through an API by thousands of advertisers' own systems. Remediation for spend is decided with account, finance and policy teams, not by engineering alone.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the inflation still happening when you are told? | A: You do not know yet; the first signal is one advertiser's ticket and a rising conversions-per-click ratio on an internal dashboard nobody pages on.
- Q: Can bidding be told to ignore a window of data? | A: The bidding team has a mechanism to exclude a date range from learning for affected advertisers; it has costs of its own.
- Q: Do we know exactly which conversions are duplicates? | A: Partly. Some duplicates share an order id; some conversion types have no order id at all.
- Q: Who talks to advertisers? | A: Account and support teams, with the facts your team provides.

**Hints.**
1. Two things are wrong at once: the reports and the decisions made from them. Contain both.
2. Measure how well you can identify duplicates before you restate anything; "remove all duplicates" is a claim you need to back with a sample.
3. Think about the order of operations: correcting conversions while bidding is still learning from them changes its behaviour again.

**Follow-ups.**
1. Your correction removes 20% more conversions than the advertiser tickets suggest. Do you restate all of them? Who decides?
2. Bidding has already raised bids for {{days}} days. If you restate the data today, what happens to bids tomorrow, and how would you make that transition safe?
3. Finance asks for an estimate of the extra spend caused. How would you produce it, and how confident would you be?
4. What signal, threshold and owner would have caught this within an hour?
5. In your real example, what did you personally decide, and what would you do differently?

**Follow-up rules.**
- when: rollback, revert, roll back → ask: The bad data has already been read by bidding and by advertisers' systems through the API. What does a rollback of the pipeline fix, and what does it not?
- when: delete the duplicates, remove the rows, restate → ask: Some conversion types have no order id. How do you decide what to remove there, and what is your error rate?
- when: refund, credit, compensate → ask: That is not your team's decision alone. Who decides, and what evidence do they need from you?
- when: postmortem, post-mortem, retro → ask: Name one prevention item that actually shipped, and how you know it works.
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Contains the pipeline (disable the faulty path, restore deduplication) and the decision effect (exclude the window from bidding with the bidding team); quantifies duplicates with a measured error rate before restating; restates through versioned data with an API signal; coordinates remediation decisions with account, finance and policy owners and supplies an evidence-based spend estimate; factual, timely communication; prevention with invariant monitors (conversions per click, duplicate-key rates) that page an owner; real example with measurable evidence and personal contribution, or honestly marked as hypothetical.

## GOO-L5-02: Halfway through a migration that is not paying off

| | |
|---|---|
| **Template ID** | GOO-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Architecture decisions / course correction, sunk cost, owning your own call |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "done": ["40%", "60%", "75%"],
  "cost_ratio": ["1.4 times", "1.8 times"],
  "missed": [2, 5, 9],
  "lease": ["three months", "six months"]
}
```

**Business Scenario.** A year ago you proposed moving the daily batch pipelines that produce watch-time and revenue-share inputs for video creators' analytics from an ageing in-house batch cluster to a newer distributed processing engine. Your proposal promised a 30% cost saving and earlier delivery. Today {{done}} of the jobs have moved. On the new engine those jobs cost {{cost_ratio}} as much as they did before, and {{missed}} of them now regularly miss their morning deadline. The old cluster's hardware lease ends in {{lease}}. The team is tired and mostly wants to push through; your manager has started asking when the savings will show.

**Problem Statement.** Tell me how you would decide what to do now: carry on, pause, roll some jobs back, or change the plan. Cover what you would measure before deciding, the options you would put on the table, who decides, how you tell people that the plan you championed is not working as promised, and how you look after the team. Then tell me about a real time you changed course on a technical decision you had argued for (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** Creators' analytics and payment inputs must stay correct and on time. The lease can be extended once, at a premium, for at most a few months. The team has other commitments this half.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do you know why the new jobs cost more? | A: Not fully. Some jobs were ported line by line; some shuffle far more data than before; nobody has profiled them all.
- Q: Are the missed deadlines visible to creators? | A: Not yet. Analytics have been a few hours late on some days; payments inputs have been on time.
- Q: Who approved the migration? | A: Your director, on your proposal and estimates.
- Q: Can the remaining jobs stay on the old cluster indefinitely? | A: No. The lease ends; extending it once is possible but costly.

**Hints.**
1. Separate the sunk cost from the decision: compare the options from today, with today's numbers.
2. Find out whether the cost is inherent to the new engine or comes from how the jobs were ported; a few jobs usually dominate.
3. Telling people early, with data and a revised plan, protects your credibility more than a late success story.

**Follow-ups.**
1. Profiling shows three jobs account for most of the extra cost. What do you do with them, and what with the rest?
2. Your director asks whether the original estimate was wrong or the execution was. How do you answer?
3. The team wants to finish the migration before fixing anything. How do you decide whether they are right?
4. What would you put in place so the next migration proposal is estimated better?
5. In your real example, what did changing course cost you, and what did you learn?

**Follow-up rules.**
- when: roll back, revert, move back → ask: The lease ends in {{lease}}. Where do rolled-back jobs run after that, and what does a second migration cost the team?
- when: push through, finish first, keep going → ask: What evidence would make you stop, and when will you have it?
- when: profile, profiling, tune, optimise → ask: Who does that work, and what does the team stop doing to make room for it?
- when: estimate, projection, original plan → ask: What assumption in your original estimate failed, and how would you have tested it before committing?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Gathers evidence (per-job cost and runtime, causes, risk to creators) before deciding; frames options from today rather than defending the sunk cost; considers a mixed plan (fix the dominant jobs, pause or roll back the worst, use the one lease extension deliberately); takes the revised plan to the decision owner with an honest account of what was wrong in the original estimate; protects correctness and deadlines for creators; looks after a tired team; improves future estimation (pilots on the hardest jobs first, exit criteria); real example with measurable evidence and personal contribution, or honestly marked as hypothetical.

## GOO-L5-03: A reach-estimate accuracy promised before it was measured

| | |
|---|---|
| **Template ID** | GOO-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Stakeholder management / resetting an external commitment, honesty with evidence |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, analytics-engineer, ml-platform-engineer, data-architect |

```params
{
  "promised": ["within 5%", "within 10%"],
  "measured": ["18%", "25%", "40%"],
  "launch": ["four weeks", "eight weeks"],
  "pilots": ["30", "200"]
}
```

**Business Scenario.** Your team builds the data behind a campaign-planning tool that estimates how many unique people an advertising campaign will reach for a given budget, audience and schedule. Before your team was consulted, sales leadership told {{pilots}} pilot advertisers that estimates would be accurate {{promised}}, with launch in {{launch}}. Your backtests on past campaigns show a median absolute percentage error of {{measured}}, worse for small audiences and new ad formats. Some pilot advertisers plan to commit budgets based on the estimates.

**Problem Statement.** Tell me what you do: how you make sure your own numbers are right, how and to whom you raise the gap, what you propose instead of the promise, how you work with sales leadership who made it, and how you would stop this from recurring. Then tell me about a real time someone else made a commitment your work could not meet and you had to reset it (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** You cannot move the launch date or change what was said to advertisers on your own. Reach is measured on de-duplicated people with privacy thresholds; you cannot show advertisers individual-level data to explain an error. Improving accuracy substantially would take longer than {{launch}}.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: How was the backtest done? | A: Estimates for past campaigns, made with only the data available before each campaign started, compared with the measured reach afterwards.
- Q: Who made the promise? | A: A sales vice-president, based on a slide from an earlier prototype.
- Q: Is any part of the product accurate enough? | A: Large audiences on established formats are close to the promise; the long tail is not.
- Q: Who owns the product decision? | A: A product manager, who reports into a different organisation from sales.

**Hints.**
1. Check your backtest before you challenge anyone: what is the error by segment, and could your measurement be the problem?
2. Bring a proposal, not just a problem: what can honestly be promised, for which campaigns, and how it is shown to advertisers.
3. Make it easy for sales leadership to correct course without losing face with advertisers.

**Follow-ups.**
1. The sales vice-president says "just launch; the estimates will improve with data". What do you say?
2. How would you present uncertainty to advertisers so it is honest and still useful for planning?
3. One large pilot advertiser has already committed budget based on an early estimate that now looks too high. What should happen?
4. What process change would make sure a data product's accuracy is measured before it is promised?
5. In your real example, how did you reset the commitment, and what happened to the relationship?

**Follow-up rules.**
- when: confidence interval, range, error bars, uncertainty → ask: Advertisers plan with one number. How do you show a range they will actually use, and what do you do for segments where the range is too wide to be useful?
- when: escalate, vice-president, leadership → ask: What did you do before going above the person who made the promise, and how did you tell them you were going to?
- when: improve the model, more data, retrain → ask: That takes longer than {{launch}}. What ships at launch in the meantime?
- when: backtest, holdout, validation → ask: How do you know the backtest is representative of the campaigns pilot advertisers will plan?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say, and to whom?

**Evaluation Criteria.** Verifies the error rigorously and by segment before raising it; raises it early, first with the people who made the promise and the product owner, in writing with evidence; brings a constructive alternative (scoped launch for segments that meet the bar, ranges or confidence labels, a clear statement of what the tool is for); helps sales correct the commitment with advertisers; considers advertisers who already acted on estimates; proposes a process so accuracy is measured before it is promised; real example with measurable evidence and personal contribution, or honestly marked as hypothetical.

## GOO-L5-04: A design disagreement with a senior peer

| | |
|---|---|
| **Template ID** | GOO-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical disagreement / design review, influence, disagree and commit |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "proposal": ["move map matching onto devices so only matched segment traversals are uploaded", "replace the streaming live-speed pipeline with a micro-batch job that runs every minute", "serve live speeds from one global database instead of per-region snapshots"],
  "days": [5, 10, 20],
  "peer": ["a principal engineer on the routing team", "the staff engineer who designed the current pipeline"]
}
```

**Business Scenario.** A design review in {{days}} days will decide the next architecture for the live road-speed system of a maps product. The design up for approval, written by {{peer}}, proposes to {{proposal}}. The author is more senior than you, widely respected, and most of your own team likes the design. You have read it closely and believe it has a serious weakness that the document does not examine (for example in failure handling, privacy, cost or freshness), but you are not certain, and you were not asked to review it.

**Problem Statement.** Tell me what you do between now and the review, at the review, and afterwards — whether the design changes or is approved as written. Cover how you test your concern, how you raise it and with whom, what you do if the decision goes against you, and what you do if you turn out to be wrong. Then tell me about a real time you disagreed with a more senior engineer about a design (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** The review date is fixed. You have no formal role in approving the design. Other teams are waiting on the decision.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Have you talked to the author? | A: Not yet.
- Q: Can you build a prototype? | A: A small one, in the time available, if you set aside other work.
- Q: Who approves the design? | A: A review group of senior engineers; the author presents.

**Hints.**
1. Talk to the author first and privately; you may be missing context, and they deserve the chance to answer before a group does.
2. Turn the concern into something testable: a failure scenario, a cost estimate, a measurement.
3. Decide in advance what you will do if the group decides against you.

**Follow-ups.**
1. The author listens politely and changes nothing. What next?
2. Your prototype shows the problem is real but smaller than you thought. How do you present that?
3. The review approves the design as written. How do you behave over the next six months?
4. A year later, the weakness you raised causes an incident. What do you do and say?
5. In your real example, what did you change in how you disagree?

**Follow-up rules.**
- when: talk to them, one on one, 1:1, privately → ask: What exactly would you say in the first two minutes of that conversation?
- when: prototype, benchmark, measure → ask: The prototype takes a week away from your committed work. Who do you tell, and how do you decide it is worth it?
- when: escalate, manager, director → ask: What would make escalating the right step here rather than raising it in the review?
- when: disagree and commit, commit → ask: What does committing look like in practice if you still think the design is wrong?
- when: i told you so, they were wrong, my design → ask: How do you raise the incident without making it about who was right?

**Evaluation Criteria.** Engages the author first, privately and with curiosity; makes the concern specific and testable, and tests it proportionately; raises it in the review with evidence and alternatives, not opinions; is open to being wrong and says so when they are; commits fully if overruled while recording the risk and a trigger to revisit; handles a later incident without blame; real example with measurable evidence and personal contribution, or honestly marked as hypothetical.

## GOO-L5-05: A live traffic pipeline that pages every night

| | |
|---|---|
| **Template ID** | GOO-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Operational excellence / on-call health, reliability versus feature work |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, software-engineer, ml-platform-engineer, data-architect |

```params
{
  "pages": [12, 25, 40],
  "team": [5, 7, 10],
  "actionable": ["10%", "25%"],
  "roadmap": ["expanding live speeds to two new countries", "a new incident-detection feature for road closures", "migrating to a new map version format"]
}
```

**Business Scenario.** Your team of {{team}} engineers owns the streaming pipeline that computes live road speeds for a maps product. On-call receives about {{pages}} pages a week, many at night, and only about {{actionable}} of them need any action. Two engineers have said they are thinking of leaving; on-call handoffs are tense. Product has committed the team to {{roadmap}} this half. You have just become the technical lead.

**Problem Statement.** Tell me how you would turn this around: what you look at first, how you decide what to fix, how you negotiate time with product, how you change alerting and on-call practice, and how you will know it worked. Then tell me about a real time you improved an on-call rotation or a system's operational load (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** The roadmap commitment was made before you arrived. You cannot hire this half. Live speeds feed routing for millions of trips, so real failures must still page.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are there service-level objectives? | A: Informally: "speeds should be fresh". Nothing written.
- Q: What do the pages say? | A: Mostly consumer lag thresholds, a few job restarts, and a weekly batch of "data looks odd" alerts nobody owns.
- Q: Does your manager support pausing features? | A: Your manager will support a well-argued proposal with numbers.

**Hints.**
1. Classify a few weeks of pages: actionable or not, cause, time of day, who resolved it and how.
2. Write the objective that matters to routing (freshness and coverage of live speeds) and alert on burning it, not on internal symptoms.
3. Bring product a trade-off with numbers: what the roadmap costs if reliability work is not done.

**Follow-ups.**
1. What would your first two weeks look like, concretely?
2. Product says the roadmap date cannot move. What do you propose?
3. Which alerts would you delete, and how do you convince the team it is safe?
4. Six months later, how would you show leadership that it worked?
5. In your real example, what did you personally change, and what was the measured result?

**Follow-up rules.**
- when: slo, service level objective, error budget → ask: Which objective would you write for live speeds, how would you measure it from routing's point of view, and what happens when the budget is spent?
- when: delete alerts, remove alerts, silence → ask: One of the alerts you removed would have caught an outage last year. How did you check before removing it?
- when: hire, headcount, more people → ask: You cannot hire this half. What do you do with the people you have?
- when: runbook, automation, auto-remediate → ask: Which page did you automate first, and what did you do to make sure automation could not make an outage worse?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Starts with data (page classification over weeks) and with the people (on-call load, attrition risk); defines user-facing objectives and moves alerting to them; removes or downgrades non-actionable alerts with evidence; negotiates a concrete trade-off with product backed by numbers; fixes top causes and automates safe remediation; sustainable on-call practice (handoffs, follow-up ownership, load measured); defines success metrics up front; real example with measurable evidence and personal contribution, or honestly marked as hypothetical.
