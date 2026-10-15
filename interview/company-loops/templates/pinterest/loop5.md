# Pinterest · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a visual
discovery service: pins, boards, saves, visual search, shopping and creators.
Every situation is hypothetical, and none describes any company's hiring
process, its culture or the values it assesses. Answer from your own experience,
or say plainly that you have not faced it and reason it through. Never invent a
story.

## PIN-L5-01: Rolling back a launched feature the team is proud of, because the data says it hurt

| | |
|---|---|
| **Template ID** | PIN-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Data-driven decisions / negative results, rollback, team morale, learning |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "feature": ["a redesigned pin closeup page", "a board organiser that suggests sections for a pinner's saves", "a new layout for search results with larger product tiles"],
  "metric": ["saves per weekly active pinner down 2%", "outbound clicks to creators' sites down 4%", "the share of pinners returning the following week down 1.5 percentage points"],
  "weeks": [3, 5, 8]
}
```

**Business Scenario.** Your team spent a quarter building {{feature}}. It launched to everyone {{weeks}} weeks ago after a short experiment that looked neutral, the team presented it at an all-hands, and the people who designed it are proud of it. You own the data for the area. A longer holdout that was kept running now shows {{metric}} for pinners who have the feature, compared with those who do not, and the gap has been stable for three weeks. Nobody else has looked at the holdout closely yet.

**Problem Statement.** What do you do? Cover how you check the result before telling anyone, who you tell first and how, what you recommend (roll back, change, keep and watch), how the decision gets made, how you handle the team's disappointment and any pushback on the data, and what changes so a launch is judged better next time. Then tell me about a real time you brought bad news about something your team had built, or say that you have not and reason it through.

**Constraints.** You are not the product owner and cannot roll the feature back yourself. The holdout is the only clean comparison left. The feature has already been mentioned publicly as an improvement.

**Assumptions.** The situation and figures are hypothetical. Any ordering of pins on the affected surfaces comes from a scoring function the team is given; the feature changed presentation, not that function.

**Clarifications.**
- Q: How big is the holdout? | A: Large enough that the gap is well outside the run-to-run noise you have measured before; you can check that.
- Q: Did the original experiment miss it? | A: It ran for one week and measured a different primary metric.
- Q: Does any part of the feature help? | A: You do not know yet; one segment might.
- Q: Who decides on a rollback? | A: The product lead for the area, with engineering and design leads.

**Hints.**
1. Before you bring the result to anyone, try hard to break it: instrumentation, novelty effects, a broken holdout, segments that move in opposite directions.
2. Bring the result first to the people who own the decision and the people who built the feature, privately, with options rather than a verdict.
3. Separate the quality of the team's work from the outcome of the bet; a rollback can be a good decision about a well-built feature.

**Follow-ups.**
1. What checks do you run on the holdout before you believe {{metric}}?
2. The design lead says the metric does not capture what pinners value about the feature. How do you respond?
3. The decision is to roll back most of it but keep one part. How do you make sure the part that stays is not the part that hurt?
4. How do you talk to the team afterwards so they keep taking bold bets?
5. In your real example, what changed in how launches were evaluated?

**Follow-up rules.**
- when: statistically significant, p-value, confidence interval, significance → ask: The product lead asks whether {{metric}} is "real" in one sentence. What do you say, and what uncertainty do you name?
- when: segment, segments, slice → ask: You find that one segment improved while the total got worse. Is that a reason to keep the feature for that segment, or a forking-paths risk?
- when: rollback, roll back, revert → ask: Rolling back also removes something a vocal group of pinners asked for. Who tells them, and what do they hear?
- when: we decided, the team decided, leadership decided → ask: What did you personally recommend, and what did you do when the decision was made?
- when: novelty, novelty effect, learning effect → ask: How long would you wait for a novelty effect to fade, and what does waiting cost?

**Evaluation Criteria.** Verifies the result rigorously before raising it (holdout integrity, instrumentation, duration and novelty, segments, guardrail metrics); tells the decision owner and the builders first, privately, with options; frames the decision in terms of the cost of keeping versus rolling back and the uncertainty; respects decision rights; separates the team's craft from the bet's outcome and protects psychological safety; turns it into better launch practice (longer holdouts, pre-registered primary and guardrail metrics); real example with own actions and outcome, or honestly hypothetical.

## PIN-L5-02: Working with a design-led team that distrusts the data

| | |
|---|---|
| **Template ID** | PIN-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-functional influence / qualitative and quantitative evidence, metric design, trust |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "team": ["the design team for the home feed grid", "the design team for creator tools", "the design team for shopping surfaces"],
  "reason": ["an experiment once killed a design that later proved right", "the dashboards contradict what they hear in user research sessions", "the metrics count clicks but say nothing about whether pinners found inspiration"],
  "decision": ["whether a new pin layout ships", "which of two creator onboarding flows to keep", "whether product tiles get a price label by default"]
}
```

**Business Scenario.** You lead data work for an area where {{team}} sets direction. Its designers are skilled and trusted by product leadership, and they rely on research sessions, prototypes and their own judgement. They have stopped using the area's dashboards and experiments, because {{reason}}. A decision is coming up on {{decision}}, and the data you have points one way while the designers lean the other.

**Problem Statement.** How do you work with this team? Cover how you learn why the distrust exists and whether it is justified, what you change in your own metrics or methods, how you combine research findings with quantitative data for the upcoming decision, how you present evidence that contradicts what designers believe, and how you would know trust is coming back. Then describe a real time you worked with a team that did not trust your data, or say that you have not and reason it through.

**Constraints.** You have no authority over the design team. The decision is due in four weeks. You may not show any individual pinner's activity to anyone; research participants are separate and have consented to sessions, not to their usage data being joined to them.

**Assumptions.** The situation and figures are hypothetical. Any ordering of pins is a scoring function the team is given.

**Clarifications.**
- Q: Was the experiment that killed the earlier design actually wrong? | A: You do not know; nobody re-examined it. You can.
- Q: Do the designers object to data in general? | A: No; they object to metrics they think measure the wrong thing.
- Q: Can you join research participants' sessions to their logged activity? | A: No, not under this exercise's rules. Treat the two kinds of evidence separately.
- Q: Who makes the decision? | A: The product lead, who listens to both teams.

**Hints.**
1. Start by listening: re-examine the case that broke trust, in the open, and admit what was wrong if something was.
2. Ask what the designers would accept as evidence of a good outcome, and see whether you can measure it, even approximately.
3. Bring the two kinds of evidence together around the decision's question rather than competing over whose evidence wins.

**Follow-ups.**
1. You re-examine the old experiment and find it was underpowered and stopped early. What do you do with that finding?
2. The designers say "inspiration" cannot be measured. What would you propose to measure, and what are its limits?
3. Your data and their research disagree on {{decision}}. Walk through the meeting where the product lead decides.
4. How would you build the next experiment together with the designers so both sides trust its result in advance?
5. In your real example, what was the first sign trust was returning?

**Follow-up rules.**
- when: dashboard, dashboards, metric → ask: Which metric on that dashboard would you retire because it misleads, and who would you tell?
- when: user research, qualitative, interviews → ask: Five research sessions say one thing and an experiment with a million pinners says another. When should the five sessions win?
- when: convince, persuade, prove them wrong → ask: What would change your own mind in this disagreement?
- when: pre-register, pre-registration, hypothesis → ask: The designers want to add a metric after the experiment starts. What do you say?
- when: executive, product lead, escalate → ask: If you go to the product lead before resolving it with the designers, what does that do to the relationship?

**Evaluation Criteria.** Seeks the cause of the distrust and re-examines past failures honestly; changes their own metrics and methods where justified (guardrails, longer-term and quality measures such as saves that are revisited, pre-registered metrics agreed with designers); treats research and quantitative evidence as complementary, around the decision's question; presents contradicting evidence with its uncertainty and without condescension; respects decision rights and privacy limits (no joining research participants to usage data); clear signals of rebuilt trust; real example with own actions and outcome, or honestly hypothetical.

## PIN-L5-03: Helping a new hire who joined remotely and is struggling to ramp up

| | |
|---|---|
| **Template ID** | PIN-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Mentoring and onboarding / remote work, unblocking, feedback, team practices |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "weeks": [6, 8, 12],
  "gap_hours": [3, 6, 9],
  "area": ["the pin engagement pipelines", "the shopping catalogue ingestion jobs", "the creator analytics service"]
}
```

**Business Scenario.** An engineer joined your team {{weeks}} weeks ago, fully remote, working {{gap_hours}} hours apart from most of the team. They came with good experience elsewhere and were assigned to {{area}}. Their first changes have been slow and have needed many review rounds, they rarely speak in meetings, and they have not yet been on call. Nobody has said anything to them directly; their manager mentions in passing that they "seem to be struggling", and you are the most senior engineer on the team, not their manager.

**Problem Statement.** What do you do? Cover how you find out what is actually in the way, what you change in the help they get, how you give useful feedback on their work, what you change in the team's practices that may be the real cause, how you coordinate with their manager without taking over the manager's role, and how you would judge in a month whether it is working. Then tell me about a real time you helped someone ramp up, or say that you have not and reason it through.

**Constraints.** You are not their manager and do not handle performance reviews. Their working hours overlap with yours for only part of the day. Do not ask about or speculate on their personal circumstances; if they share something, it stays with them and the manager.

**Assumptions.** The situation is hypothetical.

**Clarifications.**
- Q: Is there onboarding documentation? | A: Some, mostly written two years ago for the office; much of it is out of date.
- Q: How are reviews done? | A: Asynchronously, often with comments arriving overnight for them.
- Q: Have others on the team joined remotely before? | A: No; everyone else started in an office.
- Q: Does the manager want your help? | A: Yes, and asks you to share what you learn.

**Hints.**
1. Ask before you diagnose: a private conversation about what is hard, framed as improving onboarding, not as a concern about them.
2. Look for system causes first: missing context that people in the office pick up by overhearing, slow overnight review loops, undocumented local setups.
3. Make help concrete and scheduled: a named onboarding buddy, pairing in the overlapping hours, small well-scoped tasks with fast review.

**Follow-ups.**
1. In your first conversation, what do you ask, and what do you avoid asking?
2. You learn that review comments arrive overnight and contradict each other. What do you change in how the team reviews?
3. What would you write down for {{area}} that a new person needs and nobody documented?
4. A month later, progress is uneven. What do you tell the manager, and what do you tell the engineer?
5. In your real example, what did you change in the team, not just for the person?

**Follow-up rules.**
- when: pair, pairing, buddy → ask: Your overlap is only part of the day. How do you make pairing work across {{gap_hours}} hours, and who gives up what?
- when: documentation, docs, wiki, runbook → ask: Who keeps that documentation current after the next new hire, and how will you know it has gone stale?
- when: performance, underperforming, pip → ask: You are not their manager. Where does your role end and the manager's begin?
- when: feedback → ask: Give me the exact words you would use for feedback on a change that needed five review rounds.
- when: meeting, meetings, standup → ask: They rarely speak in meetings. What would you change in the meetings rather than in them?

**Evaluation Criteria.** Asks before diagnosing and keeps the conversation respectful and private; looks for systemic causes of a remote ramp (context only shared in person, slow asynchronous reviews, outdated onboarding, unclear ownership); makes help concrete (buddy, overlapping-hours pairing, scoped tasks, fast and consistent reviews, written context for {{area}}); gives specific, kind, actionable feedback; coordinates with the manager while respecting role boundaries and the engineer's privacy; defines how to tell whether it worked; improves team practices for the next hire; real example with own actions and outcome, or honestly hypothetical.

## PIN-L5-04: Making the case for paying down technical debt with numbers

| | |
|---|---|
| **Template ID** | PIN-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation / quantifying debt, cost of delay, negotiating roadmap time, measuring payoff |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "debt": ["about 300 copy-pasted daily jobs that each compute pin engagement metrics slightly differently", "a save-event format with four versions that every consumer still parses itself", "a catalogue ingestion service with no automated tests that only two people dare change"],
  "ask": ["a quarter of the team's time for two quarters", "two engineers for one quarter", "a feature freeze on the area for six weeks"],
  "roadmap": ["new shopping features promised to merchants", "creator analytics improvements announced publicly", "a visual search expansion to new markets"]
}
```

**Business Scenario.** The area you lead depends on {{debt}}. Everyone on the team agrees it slows them down, but "tech debt" requests have been turned down twice by product leadership, who point at {{roadmap}}. You believe fixing it needs {{ask}}, and you have been asked to make the case at next month's planning, in terms the product side will weigh against features.

**Problem Statement.** How do you build and present the case? Cover what you measure about the debt's cost and how (incidents, hours lost, lead time for changes, on-call load, data corrections, risk), how you turn that into a comparison with roadmap work, what you propose (all at once, incremental, tied to roadmap items), how you would measure the payoff after the work, and what you do if the answer is still no. Then tell me about a real time you argued for paying down technical debt, or say that you have not and reason it through.

**Constraints.** You have four weeks to gather evidence, with no extra people. The roadmap commitments are real and some are public. Numbers you present must be ones you can defend under questioning.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is there existing data on incidents or time spent? | A: Incident records exist; time spent is not tracked anywhere.
- Q: Does the debt block any roadmap item directly? | A: At least one roadmap item touches it; nobody has estimated how much longer it takes because of it.
- Q: Who decides? | A: The product lead and the engineering manager for the area, at planning.
- Q: Has the debt caused anything customers or pinners saw? | A: Two metric corrections shown to creators last year traced back to it.

**Hints.**
1. Measure what the debt costs in units the product side already cares about: delivery time of their roadmap items, incidents that reached creators or merchants, and engineers' time.
2. Offer options with costs and payoffs, including an incremental one that rides along with a roadmap item.
3. Define in advance how you will show the investment paid off, so the next request is easier.

**Follow-ups.**
1. Time spent is not tracked. How do you estimate hours lost to {{debt}} credibly in four weeks?
2. How do you show the effect on one roadmap item, {{roadmap}}, without inflating it?
3. Product leadership says yes to half of {{ask}}. What do you do with half?
4. Six months later, how do you show whether it paid off?
5. In your real example, which number moved the decision?

**Follow-up rules.**
- when: incident, incidents, outage → ask: How do you attribute an incident to the debt rather than to the change that triggered it?
- when: survey, estimate, estimates → ask: Engineers' estimates of time lost are known to be biased. How do you check yours?
- when: rewrite, from scratch, rebuild → ask: Why is a rewrite safer than incremental change here, and what happens to the roadmap while it runs?
- when: velocity, lead time, cycle time → ask: Lead time also depends on review delays and unclear requirements. How do you isolate the part due to the debt?
- when: risk, risky → ask: How do you express a risk that has not happened yet in a way the product lead can compare with a feature?

**Evaluation Criteria.** Measures the debt's cost with defensible methods (incident records traced to the debt, sampled time studies or ticket analysis, lead time for changes touching the debt versus elsewhere, data corrections reaching creators or merchants, concentration of knowledge as a risk); translates it into the product side's terms; offers options including incremental paths tied to roadmap work; defines payoff measures in advance; handles a partial or negative answer constructively without sandbagging the roadmap; real example with the evidence used and the outcome, or honestly hypothetical.

## PIN-L5-05: Project deep dive, re-examined for visual discovery with shopping and creators

| | |
|---|---|
| **Template ID** | PIN-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, consistency across surfaces, external partners' data |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["merchants' catalogue changes reflected on product pins within an hour", "creator analytics that always agree with the counts used for ad billing", "a secret board's saves kept out of every public surface within minutes", "visual search logs that never store the pinner's own photo yet still let you debug bad results"],
  "pinners": ["millions", "tens of millions", "hundreds of millions"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it served a visual discovery service with {{pinners}} of pinners, where pins link to merchants' products and creators see analytics for their own pins, and its users required {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the system had to meet {{requirement}} in that setting. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The visual discovery setting is hypothetical. Any ranking in it (home feed, related pins, search) is a scoring function you are given; you are not asked to design one.

**Clarifications.**
- Q: Does it have to be a consumer or shopping system? | A: No. Any system that moved, stored or computed data others depended on; the visual discovery setting is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, freshness, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the visual discovery question, start from who sees which data (pinners, creators, merchants, advertisers) and how fresh and how consistent each view must be.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design depend on data from outside partners you do not control, and what happens when that data is wrong?
4. How would you meet "{{requirement}}" without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, flink, spark, airflow, beam → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: cache, cached, precompute, precomputed → ask: Something changes upstream after you precomputed it. How long until users see the change, and who decided that was acceptable?
- when: partner, merchant, vendor, third party → ask: A partner sends data that is wrong but valid-looking. How does your system notice, and what do downstream users see meanwhile?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible analysis of {{requirement}} in the visual discovery setting (for example catalogue diffs with quarantine and serving-time offers, one shared metric pipeline for analytics and billing with reconciliation, visibility carried as data to every consumer with acknowledged invalidation, logging detected categories, result ids and outcomes instead of the image or anything that could reconstruct it) that treats ranking as a given scoring function; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
