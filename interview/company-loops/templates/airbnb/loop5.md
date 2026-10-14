# Airbnb · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a marketplace
for stays and experiences, with hosts on one side and guests on the other.
Every situation is hypothetical, and none describes any company's hiring
process or the values it assesses. Answer from your own experience, or say
plainly that you have not faced it and reason it through. Never invent a story.

## ABB-L5-01: Planning when a sudden demand shock makes historical data stop predicting

| | |
|---|---|
| **Template ID** | ABB-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Leading through uncertainty / broken forecasts, scenarios, communicating confidence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "shock": ["travel restrictions that cancel most cross-border trips within two weeks", "a natural disaster that closes a popular region at the start of its peak season", "a sudden shift in what guests book: far fewer city weekends, many more long stays in the countryside"],
  "consumer": ["finance's quarterly revenue forecast", "the price suggestions offered to hosts", "the staffing plan for customer support"],
  "horizon": ["the next quarter", "the next six months"],
  "deadline": ["by Friday", "within 48 hours"]
}
```

**Business Scenario.** Your team owns the demand forecasts for a stays marketplace: nights booked and cancellations per market and stay date. They feed {{consumer}} and several other plans, some of which read them automatically every day. After {{shock}}, cancellations spike, new bookings fall in some markets and rise in others, and forecasts trained on several years of history are wrong by far more than their stated error. Leadership asks you for a demand plan for {{horizon}}, {{deadline}}.

**Problem Statement.** What do you do? Cover the first hours (what you stop, whom you tell and what you tell them), how you produce numbers people can plan with when history no longer predicts, how you express uncertainty so that leaders use it rather than ignore it, what you change in the models and the pipeline, how you decide when to trust the models again, and what your team stops doing to make room. Then tell me about a real time a model, forecast or dashboard you owned stopped describing reality, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot wait for months of new data. You do not own the systems that consume the forecast. Your team has other committed work this quarter.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does anything act on the forecast automatically? | A: Yes. {{consumer}} reads it every day without a person in the loop.
- Q: Is there a historical analogue? | A: Partial ones: smaller regional events in past years, none at this scale.
- Q: What does leadership want? | A: Something they can plan with. They will accept ranges if they understand them.
- Q: Who decides what each plan does with the numbers? | A: Each plan's owner. You own the forecast and what you say about its quality.

**Hints.**
1. First stop automated decisions from acting on a forecast you know is wrong, and tell each owner plainly what is broken, since when and what you recommend instead.
2. Replace one number with a few explicit scenarios, each with its assumptions and the leading indicators (searches, booking pace at short lead times, cancellation rates) that would show which one is unfolding.
3. Shorten the feedback loop: forecast short horizons from current signals, and publish the forecast's error every week against what actually happened.

**Follow-ups.**
1. What do you tell the owner of {{consumer}} in the first hour, and what do you ask them to do?
2. Walk me through the scenarios you would present for {{horizon}}: what differs between them, and which signals tell them apart early?
3. Finance says it needs one number, not three scenarios. What do you give them, and how do you make sure the other scenarios still shape decisions?
4. Some months later, forecast error is back to normal in most markets. How do you decide to trust the models again, and what do you do with the shock period in the training data?
5. In your real example, what did you get wrong first, and how did you find out?

**Follow-up rules.**
- when: retrain, retraining, new model → ask: Retrain on what? You have two weeks of data after the shock and years from before it. What would the new model know that the old one did not?
- when: scenario, scenarios, range, ranges → ask: Leadership picks the middle scenario and plans only for it. What do you do to keep the other scenarios alive in their decisions?
- when: confidence interval, prediction interval, uncertainty, error bars → ask: Your intervals were calibrated on history that no longer applies. How do you know they are honest now?
- when: pause, freeze, turn off, switch off, disable → ask: Turning off the forecast feed leaves {{consumer}} with what instead, and who decides that?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and what did it cost?

**Evaluation Criteria.** Acts first to stop harm (automated consumers moved to a safe fallback, owners told plainly what is broken and since when); replaces a single forecast with explicit scenarios tied to assumptions and leading indicators; communicates uncertainty in a form leaders can plan with (ranges, triggers, decisions that hold across scenarios); shortens feedback loops and publishes forecast error; changes the models deliberately (shorter horizons, recent-signal features, treatment of the shock period) and sets criteria for trusting them again; makes room by stopping lower-value work; real example with what happened and personal contribution, or honestly hypothetical.

## ABB-L5-02: A change that is good for guests and costly for hosts

| | |
|---|---|
| **Template ID** | ABB-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team conflict / two-sided trade-offs, experiment validity, fair framing of a decision |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "change": ["showing guests the full total price, fees included, from the first search page", "making this exercise's more flexible cancellation rule the default for new listings", "giving more search prominence to listings that can be booked instantly, without host approval"],
  "result": ["guest bookings up 3%, and average host earnings down 2% in the test", "guest conversion up 4%, with a quarter of hosts, mostly small ones, losing bookings while the rest gain", "guest satisfaction up, with more host cancellations and fewer new listings in the test period"],
  "role": ["the data lead who owns the experimentation platform and its metrics", "the tech lead of the guest team that built the change", "a staff engineer who works with both teams"]
}
```

**Business Scenario.** The guest team tested {{change}}. The three-week test shows {{result}}. The guest team wants to launch to everyone. The host team says the change hurts hosts and will shrink supply over the following months, which will hurt guests later. Each team's goals are tied to its own metrics. You are {{role}}, and both team leads have asked you to "settle it with data" before the quarterly planning meeting in two weeks.

**Problem Statement.** What do you do? Cover how you check whether the test measures what each side claims, what it cannot show in three weeks, how you frame the decision so that both sides' effects are visible in one place, what alternatives you would put on the table, who decides and how you present to them, and how you keep both teams' trust whichever way it goes. Then tell me about a real time two teams you worked with had conflicting goals and you helped reach a decision, with what happened, or say that you have not and reason it through.

**Constraints.** You do not make the launch decision. Both teams must be able to trust your analysis. The planning meeting date does not move.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: How was the test randomised? | A: By guest. Treated and control guests booked from the same listings in the same markets.
- Q: Is there a marketplace goal both teams share? | A: Not in writing. Leadership talks about healthy growth for both sides.
- Q: Who makes the call? | A: The product leader over both teams, at the planning meeting.
- Q: Can another test be run? | A: Yes, but a test randomised by market would take at least six weeks.

**Hints.**
1. Check the measurement first. When treated and control guests compete for the same listings, a treated guest's booking can be a control guest's lost booking; both the guest gain and the host effect can be biased.
2. Put both sides' effects in one view with guardrails agreed before anyone argues from the result, and show the long-run supply effect as a range of scenarios rather than a certainty.
3. Look for a version that keeps most of the guest gain at a smaller host cost: targeting, phasing, or a compensating change for the hosts most affected.

**Follow-ups.**
1. What, exactly, is right or wrong about this test's design for the question being asked, and how would you measure the host effect properly?
2. How do you estimate a supply effect that will take months to appear?
3. Each lead asks you privately to present the results their way. What do you do?
4. The product leader decides to launch. What do you put in place for the following months?
5. In your real example, how did you keep both sides' trust, and what would you do differently?

**Follow-up rules.**
- when: north star, shared metric, single metric, one metric → ask: Which metric, exactly, and how do you stop it from hiding a large loss for a small group of hosts?
- when: guardrail, guardrails → ask: Which guardrail would block this launch today, and who agreed its threshold before the result was known?
- when: market-level, switchback, cluster, interference → ask: That test needs at least six weeks and the planning meeting is in two. What do you say at the meeting?
- when: escalate, escalation, leadership → ask: What do you put in front of the product leader, and how do both leads know you presented their case fairly?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say, and when?

**Evaluation Criteria.** Examines the test's validity before arguing from it (interference between guests sharing supply, short duration, who was affected); separates what the data shows from what it cannot show yet; frames the decision with both sides' effects and guardrails agreed in advance, and with long-run supply effects as scenarios; offers alternatives (targeting, phasing, compensating changes, a market-level test); respects the decider and presents both cases fairly; supports the decision with monitoring and a rollback condition; real example with what happened and personal contribution, or honestly hypothetical.

## ABB-L5-03: From a queue of one-off analysis requests to self-serve

| | |
|---|---|
| **Template ID** | ABB-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Changing how a team works / intake, certified datasets, enabling other teams |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "requests": [40, 90, 150],
  "team": [4, 6, 9],
  "requesters": ["city and regional operations teams", "product managers on the guest and host teams", "finance, trust and support leaders"],
  "backlog": ["three weeks", "six weeks"]
}
```

**Business Scenario.** Your data team of {{team}} receives about {{requests}} one-off analysis requests a month, mostly from {{requesters}}: occupancy in one city last summer, how many hosts cancelled after a policy change, conversion by device for a new search filter. The backlog is {{backlog}}, the team does little else, and the same questions are answered several times a quarter with slightly different numbers. Your manager asks you to move the team to self-serve within two quarters, without leaving the people who depend on you stranded.

**Problem Statement.** How would you lead the change? Cover how you find out which requests repeat and why, what you build first (datasets, definitions, tools), how you keep self-serve numbers correct and consistent, how requesters learn to use it, what happens to new requests during the transition and after it, how you bring your team along, and how you measure whether it worked. Then tell me about a real time you changed how a team worked with the people it served, with what happened, or say that you have not and reason it through.

**Constraints.** No extra headcount. Requesters' skills range from SQL to spreadsheets. Some requests are urgent and come from executives. Self-serve must never expose an individual guest's or host's personal data.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do requesters write SQL? | A: A few do; most use spreadsheets and dashboards.
- Q: Are there dashboards already? | A: Dozens, many abandoned, with conflicting definitions of the same metric.
- Q: Can the team say no to requests? | A: Your manager will back a published intake policy, not case-by-case refusals.
- Q: How does the team feel about it? | A: Tired of the queue, but some enjoy the analysis work and worry it will disappear.

**Hints.**
1. Classify a quarter of past requests; a handful of question types usually covers most of them, and the rest tells you what self-serve will not do.
2. The product is a small set of certified datasets and metric definitions with owners and documentation, not more dashboards. Decide which date each metric uses (booking date or stay date) and say so.
3. Keep a fast lane for questions self-serve cannot answer, with a published policy for what qualifies.

**Follow-ups.**
1. How do you choose the first three things to build, and what evidence do you use?
2. Operations and finance both ask for "occupancy" and mean different things. What do you build, and who decides the definition?
3. Six weeks in, requests have not fallen: people use the new datasets but still ask your team to check their numbers. What do you change?
4. How do you measure whether self-serve works, beyond fewer tickets?
5. In your real example, what did the people you served resist, and how did you respond?

**Follow-up rules.**
- when: dashboard, dashboards → ask: There are already dozens of abandoned dashboards. Why will yours be used, and who retires the old ones?
- when: training, office hours, workshop, workshops → ask: Who still attends after the first month, and how do you know they can answer their own questions correctly?
- when: semantic layer, metrics layer, certified, governed → ask: A requester joins a certified dataset to their own spreadsheet and a wrong number reaches an executive. Whose problem is it, and what do you change?
- when: intake, stop taking, no longer take, fast lane → ask: An executive's urgent request arrives the week after you stopped taking one-off work. What happens?
- when: we built, we decided, the team built → ask: Which parts did you personally design or decide?

**Evaluation Criteria.** Starts from evidence (classified past requests, repeat questions, where numbers disagreed); builds a small set of certified, documented datasets and definitions with owners, booking-date and stay-date versions made explicit, before tools; protects personal data by design (aggregates, access controls); a published intake policy with a fast lane; teaches requesters and checks they get correct answers; brings the team along with new roles (owning definitions, harder analysis); measures outcomes (repeat questions answered without the team, consistency of numbers, time to answer, team time freed); real example with what happened and personal contribution, or honestly hypothetical.

## ABB-L5-04: Making an untested critical pipeline safe to change without a freeze

| | |
|---|---|
| **Template ID** | ABB-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Engineering risk / safety nets for legacy pipelines, persuading leadership, adoption across teams |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "pipeline": ["the host payout calculation that feeds the payments system", "the nightly bookings and revenue tables that finance closes the books on", "the features that search ranking uses"],
  "changes": [3, 8, 15],
  "teams": [2, 4, 6],
  "incident": ["last month a change double-counted cleaning fees for a day before anyone noticed", "a renamed column silently zeroed one of its outputs for a week", "a time-zone fix moved a day of bookings into the wrong month"]
}
```

**Business Scenario.** You have just taken over the pipeline behind {{pipeline}}. It has almost no tests, {{teams}} teams change it about {{changes}} times a week, and {{incident}}. After that incident a director proposes freezing all changes for a quarter while the pipeline is rewritten. You think a freeze would stall the teams that depend on changing it, and that a rewrite carries its own risk. You are asked for an alternative plan by next week.

**Problem Statement.** What do you propose, and how do you lead it? Cover what makes changes safer quickly when nobody fully understands the code, what you do first and why, how changes are reviewed, tested and released from now on, how you get {{teams}} teams to adopt it, how you convince the director that your plan is safer than a freeze, and how you show over the following months that risk has actually fallen. Then tell me about a real time you made a fragile system safe to change, with what happened, or say that you have not and reason it through.

**Constraints.** No general freeze. No extra headcount this quarter. The pipeline's outputs reach money, the books or what guests see.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does anyone understand the whole pipeline? | A: Pieces of it, spread across the teams. The original author has left.
- Q: Can it be run twice side by side? | A: Yes, at roughly double the compute cost for that run.
- Q: How was the last incident found? | A: Someone downstream noticed a number that looked wrong.
- Q: Is there a staging environment? | A: A staging copy exists, but its data is months old and a small sample.

**Hints.**
1. You cannot quickly write unit tests for behaviour nobody can specify, but you can pin today's behaviour: run the old and new code on the same production inputs and compare the outputs before a change is released.
2. Add checks on the outputs that block publication rather than only alert: totals that reconcile with the sources, no duplicated rows, values inside expected ranges.
3. Make every change reversible: versioned outputs, the ability to re-run a day, and a rollback measured in minutes.

**Follow-ups.**
1. What do you put in place in the first two weeks, and which of the past incidents would it have caught?
2. A team's change is meant to alter the output, and your comparison blocks it. How does the process handle intended differences?
3. How do you convince the director that your plan is safer than a freeze?
4. Two months in, what do you measure to show that risk is lower?
5. In your real example, what did you have to slow down or stop, and who objected?

**Follow-up rules.**
- when: unit test, unit tests → ask: Nobody can say what the code should do in its corner cases. What are your unit tests asserting, and how do you know those assertions are right?
- when: rewrite, rewriting, rebuild → ask: The rewrite takes two quarters while {{changes}} changes a week keep landing on the old code. How do the two stay in step?
- when: diff, shadow, parallel run, golden → ask: The comparison shows 0.3% of rows differ on every run even with no code change. What do you do before anyone trusts it?
- when: freeze, code freeze → ask: The director agrees to drop the general freeze but insists on one for the riskiest part. Do you accept, and on what terms?
- when: we decided, the team decided, we agreed → ask: What did you personally do or decide?

**Evaluation Criteria.** Proposes fast safety nets that do not need full understanding (shadow runs with output comparison on production inputs, characterisation tests from real data, blocking output checks and reconciliations), ordered by which past incidents they would have caught; makes changes reversible (versioned outputs, re-runs, quick rollback); sets a change process with clear ownership and handling of intended differences; adopts it with the teams rather than imposing it; persuades the director with evidence and a clear risk comparison, possibly accepting a narrow freeze; measures results (escaped defects, time to detect, change lead time); real example with what happened and personal contribution, or honestly hypothetical.

## ABB-L5-05: Project deep dive, re-examined for a two-sided marketplace of hosts and guests

| | |
|---|---|
| **Template ID** | ABB-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, two-sided marketplace data |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and how it handled change", "the hardest correctness problem you solved", "the decision you would make differently today"],
  "two_sided": ["metrics where a gain for one side can be a loss for the other", "experiments in which treated and control users compete for the same supply", "data both sides see, where each side may see only its own part"],
  "lag": ["outcomes that arrive months after the event that caused them, such as a stay booked long before it happens", "facts that change after the event, such as alterations, cancellations and partial refunds"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change to serve a two-sided marketplace of hosts and guests, where it must handle {{two_sided}} and {{lag}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what would change if the system served a marketplace with hosts on one side and guests on the other, with {{two_sided}} and {{lag}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The marketplace setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a marketplace system? | A: No. Any system with real users works; the second half asks what would change.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to schemas, keys, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the marketplace question, say which of your tables or metrics would describe only one side, and what the other side's view of the same event would be.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which part of your design would mislead you once it had to handle {{two_sided}}, and what would you change first?
4. How would your system handle {{lag}}, without rewriting history silently?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, flink, spark, airflow, snowflake, bigquery, dbt → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: experiment, a/b test, ab test, randomized, randomised → ask: In a marketplace your treated users take supply from your control users. What would that have done to the results you just described?
- when: overwrite, overwrote, update in place, upsert → ask: A booking made in March is cancelled in June. If you update it in place, what does March's report say in July, and is that what its readers expect?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible marketplace analysis (both sides' views of one event, interference between competing users, access limited to each side's own data) tied to the candidate's own system; a concrete approach to late or changing facts (event dates versus effective dates, restatements, versioned outputs); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
