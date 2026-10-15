# DoorDash · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a local
commerce marketplace: restaurant menus, convenience and grocery catalogues,
store hours, order accuracy, a membership subscription, consumer promotions and
merchant tools. Every situation is hypothetical, and none describes any
company's hiring process, its merchants or partners, or the values it assesses.
Courier data appear only in aggregate and never rank or score an individual
courier. Answer from your own experience, or say plainly that you have not faced
it and reason it through. Never invent a story.

## DSH-L5-01: A statistically significant result too small to matter, and the launch pressure behind it

| | |
|---|---|
| **Template ID** | DSH-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Experiment judgement / practical significance, guardrails, influencing a launch decision |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "change": ["a redesigned store page layout", "a new substitution prompt in grocery checkout", "a simplified membership sign-up step"],
  "lift": ["+0.08% in orders per consumer", "+0.05 percentage points in checkout conversion", "+0.1% in weekly orders per consumer"],
  "sample": ["4 million consumers", "12 million consumers", "30 million consumers"],
  "cost": ["two engineers maintaining a second code path for a year", "a 3% increase in page load time on older phones", "a new dependency on a service with no on-call coverage at night"]
}
```

**Business Scenario.** Your team ran a three-week experiment on {{change}} with {{sample}}. The result is {{lift}}, statistically significant at the threshold the team agreed beforehand. The product manager and their director want to announce the launch at next week's quarterly review, where the change is already on the slide. You own the experimentation data and the analysis. Looking closely, you believe the effect is too small to matter for the business, the confidence interval reaches almost to zero, one guardrail metric (orders with a missing-item report) moved slightly in the wrong direction without reaching significance, and shipping it brings {{cost}}.

**Problem Statement.** What do you do? Cover how you check your own analysis before saying anything, how you frame the result so people can decide (not only "significant" or "not"), how you raise it with the product manager and the director given the timing, what you recommend, and what you would put in place so the next experiment has its decision rule agreed before it starts. Then tell me about a real time a result you analysed was used to justify a decision you disagreed with, with what happened, or say that you have not and reason it through.

**Constraints.** You are not the decision maker; the product manager and director are. The review is in a week. The experiment cannot be rerun before then.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Was a minimum effect worth shipping agreed before the experiment? | A: No. Only the significance threshold was agreed.
- Q: Is the guardrail movement real? | A: Unknown. It is within noise, but the experiment was not sized to detect a change of that size in that metric.
- Q: Does the director know about the cost? | A: Not in detail; the launch slide lists only the lift.
- Q: Can the launch be partial? | A: Yes. It could ship to a share of traffic or a set of cities.

**Hints.**
1. Translate the lift into what it means in absolute terms (orders per week, money per year) and compare it with the cost, both with their uncertainty.
2. Separate three questions: is the effect real, is it large enough to matter, and is anything getting worse.
3. Give the decision makers options with consequences, not a verdict; and give them time before the review, not during it.

**Follow-ups.**
1. Show me how you would present {{lift}} to the director in one slide: what numbers, what uncertainty, what comparison.
2. The product manager says "significant is significant, and we committed to shipping something this quarter." How do you respond?
3. What would make you change your mind and support the launch as it is?
4. How would you set up the next experiment so this argument happens before it starts, not after?
5. In your real example, what did you personally do, and how was the decision made in the end?

**Follow-up rules.**
- when: p-value, p value, significance, significant → ask: Statistical significance answers whether the effect is likely non-zero. What answers whether it is worth shipping?
- when: guardrail, guardrails → ask: The guardrail moved in the wrong direction but not significantly. Was the experiment able to detect a change that would matter there? How do you know?
- when: escalate, escalation, director → ask: How do you raise this with the director without going around the product manager?
- when: rollout, ramp, holdout, partial → ask: You propose a partial launch with a holdout. What decides, and when, whether it goes to everyone or is removed?
- when: we decided, the team decided, we agreed → ask: What did you personally say, to whom, and when?

**Evaluation Criteria.** Checks the analysis first (sample ratio, novelty effects, segment consistency, the interval rather than the point estimate); translates the lift into absolute business terms and weighs it against {{cost}} with uncertainty; separates significance from practical importance and from guardrail risk, and states what the experiment could and could not detect; raises it early with the product manager, then the director together, before the review; offers options (launch, partial launch with a holdout and a stated decision rule, do not launch, simplify the change to remove the cost); accepts the decision makers' call while making the residual risk visible; proposes pre-registered decision rules (minimum effect worth shipping, guardrail thresholds, power) for future experiments; real example with personal contribution and outcome, or honestly hypothetical.

## DSH-L5-02: Replacing the spreadsheets an operations team runs the business on

| | |
|---|---|
| **Template ID** | DSH-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Stakeholder change / migrating manual workflows, trust, adoption |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "team": ["the regional operations team that onboards new stores", "the team that plans merchant-funded promotion budgets each week", "the team that tracks store hours and holiday closures for a region"],
  "sheets": [12, 30, 60],
  "people": [6, 15, 40],
  "months": [3, 6, 9]
}
```

**Business Scenario.** The work of {{team}} runs on {{sheets}} linked spreadsheets that {{people}} people edit every day. The spreadsheets hold reference data, manual overrides and formulas that feed decisions other teams rely on; several have broken after someone sorted a column or pasted over a formula, and twice a wrong value reached consumers or merchants before anyone noticed. You have been asked to replace them with a proper system within {{months}} months. The team is proud of the spreadsheets, knows them better than anyone, and is wary: an earlier tool imposed on them slowed them down and was abandoned.

**Problem Statement.** How would you lead this? Cover how you learn what the spreadsheets actually do (including the parts nobody documented), how you involve the team that uses them, what you build first, how you migrate without stopping their work, how you know the new system gives the same or better answers, and when and how the spreadsheets are retired. Then tell me about a real time you replaced a manual process people depended on, with what happened, or say that you have not and reason it through.

**Constraints.** The operations team's work cannot pause. You have two engineers and part of an analyst's time. The team's manager supports the project but will not force adoption.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does anyone understand all the spreadsheets? | A: No single person. Two long-serving team members understand most of them.
- Q: Are all the spreadsheets worth keeping? | A: Probably not; some are copies, and some are no longer used.
- Q: Can the team keep a spreadsheet for exploration afterwards? | A: Your call; say what you would allow and why.
- Q: What does success look like to the team's manager? | A: No more incidents from broken formulas, and less time spent on manual checks.

**Hints.**
1. Watch the work before designing anything: sit with the people who use the spreadsheets and list the decisions they support.
2. Migrate one workflow end to end and let the team judge it, rather than building a full replacement first.
3. Run old and new side by side and compare outputs; differences are either bugs or undocumented rules worth knowing.

**Follow-ups.**
1. How do you find the rules hidden in formulas and manual habits that nobody wrote down?
2. Which workflow do you migrate first, and why that one?
3. Two months in, half the team uses the new system and half still uses the spreadsheets, and their numbers differ. What do you do?
4. One of the two long-serving team members opposes the change openly. How do you handle it?
5. In your real example, what did the people who did the work by hand teach you that changed your design?

**Follow-up rules.**
- when: requirements, document, spec → ask: The team says the spreadsheet "just works" and cannot list requirements. How do you get them anyway?
- when: big bang, cutover, switch over → ask: What happens on cutover day if the new system gives a different answer for a store than the spreadsheet did?
- when: training, train, adoption → ask: People still copy data out of the new system into a spreadsheet. Is that a failure? What does it tell you?
- when: automate, automation, replace → ask: Which manual checks would you deliberately keep human, and why?
- when: we built, we decided, the team built → ask: Which decisions were yours, and which did the operations team make?

**Evaluation Criteria.** Learns the work by observing it and inventories the spreadsheets by the decisions they support, not by their cells; involves the operations team as co-owners (named people, regular reviews, their acceptance criteria); prioritises the workflow with the most incidents or toil and migrates it end to end; extracts hidden rules into tested, documented logic, with validation that prevents the past incidents; runs old and new in parallel with output comparison, explaining every difference; retires spreadsheets explicitly with a date and read-only archives, while allowing safe exploration; handles opposition by listening and giving the opponent a real role; measures success by incidents and time saved; real example with personal contribution and outcome, or honestly hypothetical.

## DSH-L5-03: Scope that keeps growing after the plan and the date were agreed

| | |
|---|---|
| **Template ID** | DSH-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Delivery leadership / scope control, trade-offs, communicating with sponsors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "project": ["holiday hours support in merchant tools", "an annual billing option for the membership subscription", "a daily reporting export for merchants who use white-label delivery"],
  "weeks_left": [4, 8, 12],
  "added": ["three requests from the team that supports the largest merchants", "rules for two more countries added by a regional lead", "a redesign of the report layout requested by product design"],
  "team_size": [3, 5, 8]
}
```

**Business Scenario.** You lead {{team_size}} engineers building {{project}}. The scope and the launch date were agreed with the sponsors six weeks ago, and the date has been announced to merchants. With {{weeks_left}} weeks left, the work has grown: {{added}}, plus a steady trickle of small "while you are in there" changes. Each request is reasonable on its own. Together they add about 40% to the remaining work, and the team has started working evenings to keep up. Nobody has said the date can move.

**Problem Statement.** What do you do? Cover how you find out how much the scope has actually grown and what it does to the date, how you present the trade-off and to whom, how you decide what goes in, what is deferred and what is dropped, how you protect the team, and how new requests are handled from now on. Then tell me about a real project whose scope grew after it was agreed, with what happened, or say that you have not and reason it through.

**Constraints.** The date was announced to merchants. You cannot add people in time to help. You do not own the sponsors' priorities.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Who agreed the original scope? | A: The product lead and the head of merchant operations, with you.
- Q: Are any of the additions required for launch? | A: One might be: the requester says merchants will be confused without it. Nobody has checked.
- Q: Has the team raised the overtime? | A: Not formally. Two engineers mentioned being tired in a retrospective.
- Q: Can the launch be partial? | A: Possibly. A smaller first release followed by a second one is technically feasible.

**Hints.**
1. Make the growth visible: a list of every addition with its source, size and the reason it is needed, against the original scope.
2. Present the sponsors with the choice in their terms: the same date with less scope, the full scope with a later date, or more risk; never silently absorb it.
3. Protect the team by fixing the process, not by heroics: an intake rule for new requests with a named decision maker.

**Follow-ups.**
1. How do you estimate how much the scope grew, when most additions arrived as small requests?
2. The sponsors want the full scope and the same date. What do you say?
3. Which of the additions would you defer, and how do you tell the people who asked for them?
4. How do you handle the evening work, both now and so it does not become the norm?
5. In your real example, what would you do earlier next time?

**Follow-up rules.**
- when: overtime, evenings, weekends, crunch → ask: The sponsors say a few weeks of extra hours are normal before a launch. What do you say, and what do you do for the team?
- when: mvp, phase, phased, first release → ask: Merchants were told the full feature arrives on the date. What do they get, and who tells them?
- when: estimate, estimates, story points → ask: Your estimate for the additions is challenged as padded. How do you defend it?
- when: say no, push back, pushback → ask: The request comes from the team supporting the largest merchants, with revenue at stake. Do you still push back? How?
- when: we decided, the team decided, we agreed → ask: What did you personally put in front of the sponsors, and what did you recommend?

**Evaluation Criteria.** Quantifies the growth against the agreed baseline with sources and sizes; raises the trade-off early and explicitly with the sponsors who agreed the scope, with options and a recommendation (cut, defer, phase, or move the date with reasons), rather than absorbing it; checks the claimed launch-critical addition with evidence; communicates deferrals to requesters directly; protects the team (stops the evening work as a plan, makes it visible, sustainable pace) and introduces an intake rule with a named decision maker; keeps merchants' expectations accurate if the release is phased; real example with personal contribution and outcome, or honestly hypothetical.

## DSH-L5-04: Expanding a product built for one country into several with different rules

| | |
|---|---|
| **Template ID** | DSH-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical strategy / internationalisation, configurable rules, sequencing, local partners |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "product": ["the membership subscription", "the consumer promotions system", "the missing-item refunds flow"],
  "countries": [3, 5, 8],
  "months": [6, 9, 12],
  "rule": ["prices that must include tax in some countries and exclude it in others", "a requirement that subscriptions can be cancelled online in as few steps as they were started", "refunds that must go back to the original payment method within a fixed number of days"]
}
```

**Business Scenario.** In this scenario, {{product}} was built for one country. It assumes one currency, one tax treatment, one language, one time zone per city and one set of consumer rules. The business plans to launch it in {{countries}} more countries over {{months}} months. Each has different rules (this exercise's rules; check current docs), for example {{rule}}. The original code has the home country's rules spread through many services, reports and data models. Each country's launch team wants its own changes quickly, and the team that built the product worries that country-specific branches will make it impossible to change.

**Problem Statement.** How would you lead the technical side of the expansion? Cover how you find every place the home country is assumed, how you decide what becomes configuration, what becomes per-country logic and what stays the same everywhere, how you sequence the countries, how you work with legal, finance and local teams on the rules without becoming the bottleneck, how data and reporting change (currencies, minor units, local days), and how you know a country is ready to launch. Then tell me about a real time you took a system into a new market, region or very different customer segment, with what happened, or say that you have not and reason it through.

**Constraints.** The home country must not regress. Rules come from legal and finance teams, not from engineers. The first new country launches in a third of the time available.

**Assumptions.** The situation, countries and rules are hypothetical.

**Clarifications.**
- Q: Are the rules known for every country now? | A: For the first two. The rest will be confirmed one to three months before each launch.
- Q: Can countries launch with fewer features? | A: Yes, if the missing features are hidden cleanly.
- Q: Do the country teams have engineers? | A: Some do; you decide how they contribute.
- Q: Is there a standard for currencies and amounts today? | A: Amounts are stored as decimals in the home currency, with no currency column.

**Hints.**
1. Inventory assumptions first: search the code and the data for the home currency, tax, language, time zone and rules, and list them by risk.
2. Prefer a small set of rule types with per-country parameters over per-country code paths; reserve code for the few genuinely different rules.
3. The first country is your test of the abstraction; choose it for what it teaches, not only for its size.

**Follow-ups.**
1. How do you find every place the home country is assumed, including in reports and data pipelines?
2. Which rules would you make configurable, and which would you leave as code? Give an example of each from this product.
3. A country's rules arrive two weeks before launch and one cannot be met by configuration. What do you do?
4. How do you change amounts stored as decimals with no currency into a form that works for every country, without stopping the home country?
5. In your real example, which assumption surprised you most, and how did you find it?

**Follow-up rules.**
- when: config, configuration, feature flag, flags → ask: Configuration that nobody tests is code that nobody reviews. How do you test every country's configuration before it goes live?
- when: fork, branch, per-country code → ask: A year later you have {{countries}} variants of one service. How do you prevent them from drifting apart?
- when: currency, currencies, minor units, exchange → ask: How do you store and report amounts across currencies with different minor units, and when do you convert?
- when: legal, compliance, regulation → ask: Legal gives you a rule as a paragraph of text. Who turns it into a configuration, and who checks it was done correctly?
- when: we built, we decided, the team built → ask: Which architectural decision was yours, and what did it cost?

**Evaluation Criteria.** Inventories home-country assumptions systematically (code, data models, pipelines, reports) and ranks them by risk; designs rule types with per-country parameters, owned and approved by legal and finance, versioned and tested per country, with code only for genuinely different rules; fixes data foundations first (amounts as integer minor units with a currency, local days per store's time zone, translations); sequences countries for learning and risk, with the home country protected by regression tests; involves country teams through clear contribution paths rather than forks; defines launch readiness per country (rules verified, reports reconciled, support ready); real example with personal contribution and outcome, or honestly hypothetical.

## DSH-L5-05: Project deep dive, re-examined for a local commerce marketplace of merchants, consumers and couriers

| | |
|---|---|
| **Template ID** | DSH-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, store-local time, merchant isolation, aggregate-only courier data |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo", "how you knew its numbers were right"],
  "requirement": ["menu and price changes visible to consumers within minutes, with the menu as it stood at order time always recoverable", "every store report in the store's local day, including stores open past midnight", "courier data only in aggregate, never ranking or scoring an individual courier", "access for each merchant to its own stores' data and nothing else"],
  "scale": ["hundreds of thousands of stores, each with its own menu and hours", "tens of millions of orders a day across several countries", "hundreds of millions of item listings updated many times a day"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a local commerce marketplace of merchants, consumers and couriers at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The marketplace setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a marketplace or delivery system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one record, such as an order line: where it is created, which store, menu version and local day it belongs to, and which of its fields the requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: utc, timezone, time zone → ask: A store open until 02:00 local time takes its last order at 01:50. Which day does it belong to in your design, and on the night clocks change?
- when: overwrite, upsert, update in place → ask: An order from last month needs the menu price it was placed at. Can your design still answer that after the menu changed?
- when: courier, couriers, dasher, dashers → ask: Which tables or views in your design could identify an individual courier, and how do you keep courier data aggregate-only?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example versioned menus with the menu version stored on each order line and change events into consumer-facing views; the store's time zone recorded on the store and the local day computed at ingestion; courier identifiers excluded from analytic tables with minimum group sizes and no per-courier outputs; one access rule keyed by merchant and store assignments applied to every query and export); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
