# Meta · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a company that
runs social apps, messaging apps and an advertising business. Every situation is
hypothetical. Answer from your own experience, or say plainly that you have not
faced it and reason it through. Never invent a story.

## MET-L5-01: Moving messaging telemetry in-region before a residency deadline

| | |
|---|---|
| **Template ID** | MET-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Program leadership / regulatory-deadline migration, influence without authority |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "months": [6, 9, 12],
  "pipelines": [14, 40, 90],
  "teams": [5, 12, 20],
  "scope": ["people in one new region", "people in two regions whose rules differ"]
}
```

**Business Scenario.** You lead data engineering for the reliability telemetry of a messaging app: delivery metadata, client crash and performance reports, and server health data. A new data-residency requirement means that telemetry about {{scope}} must be stored and processed in-region within {{months}} months. Today everything flows to central storage, and {{pipelines}} pipelines owned by {{teams}} teams read it. The privacy and legal teams have defined what the requirement means; your job is the technical plan and its delivery. Product teams fear losing the global dashboards they rely on during incidents.

**Problem Statement.** How would you lead this: the first weeks, the plan, and delivery to the deadline? Cover how you establish what has to move, the architecture you propose (what stays in-region and what may cross), sequencing and verification, how you get {{teams}} teams to do work they did not plan for, how you manage the risk of missing the date, and how incident response keeps working throughout. Then describe a real migration you led with an external or fixed deadline, or say that you have not and reason it through.

**Constraints.** You do not interpret the requirement; privacy and legal do, and they have said that aggregates meeting a minimum group size may leave the region while anything carrying account or device identifiers may not. Reliability alerting must keep working throughout. The date does not move.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are all the pipelines still used? | A: You do not know; some probably are not.
- Q: Is there budget? | A: Infrastructure budget for regional capacity, yes. No new team.
- Q: Who owns the deadline? | A: A program sponsor in engineering leadership, who expects a monthly status from you.
- Q: Do other teams have to help? | A: They own their pipelines; you cannot change them without them.

**Hints.**
1. Inventory and classify first: which pipelines read identifiable data, which read only aggregates, which nobody uses.
2. The date is fixed; the scope is not. Retiring a pipeline is the cheapest migration.
3. Compliance is shown with evidence (data-flow tests, storage locations, access logs), not asserted.

**Follow-ups.**
1. Halfway through, a team that owns a third of the pipelines says it cannot start for three months. What do you do?
2. Global incident dashboards need a p95 delivery latency across all regions. How do you provide it without moving identifiable data?
3. How do you prove to the privacy team that nothing identifiable leaves the region, including backups and ad hoc extracts?
4. Four weeks before the date you are 70% done. What do you tell whom, and what are your options?
5. In your real example, what did you personally decide, and what would you do differently?

**Follow-up rules.**
- when: replicate, copy, mirror → ask: A replicated copy outside the region is exactly what the requirement rules out. How do you find every copy, including backups and extracts?
- when: federated, query across regions, cross-region query → ask: A federated query that returns rows to a central engine moves data. What exactly leaves the region in your design?
- when: deadline, timeline, slip → ask: You will not finish everything by the date. What do you cut, who agrees to it, and what is the fallback for what remains?
- when: escalate, sponsor, leadership → ask: What do you try before escalating, and what does your escalation ask for specifically?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Inventory and classification before planning; scope reduced by retiring unused pipelines; an architecture where identifiable data stays in-region and only qualifying aggregates (mergeable, above the minimum group size) cross; staged migration with verification evidence; incident tooling kept working; cross-team plan with owners, milestones and early warnings; honest status and explicit trade-offs as the date nears; real example with measurable outcome and personal contribution, or honestly hypothetical.

## MET-L5-02: Ads reporting on-call is burning the team out

| | |
|---|---|
| **Template ID** | MET-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Reliability debt and people / operational load versus roadmap, advertiser impact |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "pages": [25, 60, 140],
  "late_days": [3, 8, 15],
  "team": [5, 8, 12],
  "leaving": ["two engineers have asked to move teams", "one senior engineer has resigned, citing on-call", "the team's last two hiring candidates declined after hearing about on-call"]
}
```

**Business Scenario.** Your team of {{team}} engineers owns the pipelines that produce advertisers' daily performance reports: impressions, clicks, spend and attributed conversions by campaign. On-call receives about {{pages}} pages a week, many at night, and last month the reports were late on {{late_days}} days, which produced advertiser support tickets. Meanwhile {{leaving}}. Your director has committed the team to two new reporting features this half. You have just taken over as the team's technical lead.

**Problem Statement.** What do you do in your first month and your first half? Cover how you find out where the load comes from, how you decide what to fix first, how you make the case for reliability work against the committed roadmap, how you look after the people on the team, and how you will know it worked. Then tell me about a real time you reduced operational load or reliability debt while still delivering, or say that you have not and reason it through.

**Constraints.** Advertisers' reports must stay correct; making them late is not a free option. The director's commitments were made publicly inside the organisation. You cannot hire in the next quarter.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the pages real problems? | A: You do not know; nobody has categorised them.
- Q: Why are reports late? | A: Mostly upstream data arriving late and jobs being rerun by hand, as far as anyone remembers.
- Q: Does the director know about the attrition? | A: They know people are unhappy; they have not seen numbers.
- Q: Do other teams page you for their problems? | A: Some alerts fire on upstream delays your team cannot fix.

**Hints.**
1. Data first: categorise a month of pages by cause, action taken and whether action was needed.
2. Separate alerts that need a human now from those that can wait for morning, and those that belong to another team.
3. Express the cost of the load in terms the director weighs: late reports, support tickets, delivery speed, attrition.

**Follow-ups.**
1. What do your first two weeks look like, concretely?
2. The director says the features cannot slip. How do you negotiate capacity for reliability work?
3. Half the pages come from an upstream team's late data. What do you do about alerts you cannot fix yourself?
4. What would you measure monthly to show the work is paying off, and what targets would you set?
5. In your real example, what did you personally change, and what did it cost?

**Follow-up rules.**
- when: rewrite, rebuild, new platform → ask: A rebuild takes two quarters while the pages continue. What do you do for the team in the meantime?
- when: delete alerts, remove alerts, silence → ask: Which alerts would you delete, and how do you make sure a real failure still reaches someone?
- when: rotation, follow the sun, on-call schedule → ask: A better rotation spreads the pain. What actually reduces it?
- when: upstream, dependency, other team → ask: The upstream team has its own roadmap. What do you ask them for, and what do you build on your side if they say no?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Measures the load before acting (pages categorised by cause and actionability); quick wins that remove noise without losing real signal; root-cause fixes ranked by pages and advertiser impact; a negotiated, explicit capacity split with the director, backed by data; upstream dependencies handled with agreements and defensive design; care for people (rotation fairness, recovery time, honest conversations) alongside fixes; measurable targets; real example with personal contribution and outcome, or honestly hypothetical.

## MET-L5-03: Changing what counts as a feed impression

| | |
|---|---|
| **Template ID** | MET-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team influence / metric definitions, migration of goals and experiments |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect, ml-platform-engineer |

```params
{
  "change": ["from 'any part of the post drawn on screen' to 'at least half of the post visible for at least one second'", "from 'post sent to the device' to 'post actually visible on screen'"],
  "shift": ["15%", "35%"],
  "teams": [6, 14, 25]
}
```

**Business Scenario.** You lead the logging and metrics platform for a social app's feed. Ranking researchers show that the current impression definition counts posts people scroll past too quickly to see, which adds noise to ranking training data and inflates reach. They propose changing the definition {{change}}. Under the new rule, impressions fall by about {{shift}} and every per-impression rate rises. {{teams}} teams have goals, dashboards and experiments built on the current definition. The change covers organic feed metrics only; ads measurement follows its own published definitions and is out of scope.

**Problem Statement.** How would you lead this change: the evidence you need, who decides, how you migrate goals, dashboards, history and experiments in flight, and how you bring the teams along? Then describe a real time you changed a widely used definition, interface or contract that other teams depended on, or say that you have not and reason it through.

**Constraints.** Experiments in flight cannot be stopped. This quarter's goals are already set. Logging both definitions doubles a significant logging cost, so dual logging must end.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Who owns metric definitions? | A: A metrics review group with product and data science leads. You bring the proposal; they decide.
- Q: Can the new definition be backfilled? | A: Partly. The visibility data the new rule needs has only been logged for the last 30 days.
- Q: Do all teams oppose it? | A: No. Some teams' goals look better under the new rule and some look worse.
- Q: Is the new rule known to be better? | A: The researchers have evidence for ranking; nobody has checked it against other uses yet.

**Hints.**
1. "Different" is not "better". Decide what evidence would show the new rule measures attention more faithfully.
2. A definition change moves goals without any change in user experience. Rebase targets explicitly.
3. Experiments compare arms under one definition. Decide which definition decides each experiment in flight.

**Follow-ups.**
1. A team whose goal metric drops under the new rule asks to delay until next half. What do you do?
2. Which definition decides experiments that started before the change and end after it?
3. History: restate with what you can backfill, splice the two series, or start fresh? What does each do to year-over-year charts?
4. How would you validate that the new definition is better rather than merely different?
5. In your real example, how did you handle the teams that lost out from the change?

**Follow-up rules.**
- when: backfill, restate, recompute history → ask: You have only 30 days of visibility data. What do charts that span a year show?
- when: dual, both definitions, side by side → ask: How long do you run both, what does it cost, and what ends it?
- when: goals, okr, targets → ask: One team's goal now looks {{shift}} better with no change in user experience. What happens to their target?
- when: mandate, force, require → ask: You do not own the other teams' roadmaps. What makes them migrate on time?
- when: we decided, consensus, the group agreed → ask: Where did you personally disagree, and what did you do about it?

**Evaluation Criteria.** Evidence that the new rule measures attention better (correlation with later actions or surveys, not only ranking gains); clear decision rights; an explicit migration plan with a dual period that ends, rebased goals and a rule for experiments in flight; honest history handling with labelled breaks; communication and support for affected teams; real example with measurable outcome and personal contribution, or honestly hypothetical.

## MET-L5-04: The lift result everyone celebrated was wrong

| | |
|---|---|
| **Template ID** | MET-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Integrity and communication / correcting a published measurement, process change |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, ml-platform-engineer |

```params
{
  "lift": ["+4%", "+9%", "+15%"],
  "weeks": [2, 6, 10],
  "flaw": ["conversions arriving from both the browser and the server were deduplicated in the holdout group but not in the test group", "the analysis kept only people who were actually shown an ad in the test group but kept everyone in the holdout group", "group assignment used a hash that correlated with account age, so the test group was older on average"],
  "audience": ["a launch review for a new ad format", "a quarterly business review", "a case study already shared with advertisers"]
}
```

**Business Scenario.** Your team runs the measurement pipeline for randomised conversion lift studies, where a holdout group is not shown an advertiser's ads and conversion rates are compared. {{weeks}} weeks ago a study reported a {{lift}} lift, and the result was presented in {{audience}}. You now find that {{flaw}}. Your corrected analysis shows a much smaller lift, with a confidence interval that includes zero. A senior leader championed the original result.

**Problem Statement.** What do you do in the first day and the following weeks? Cover how you confirm the flaw, who you tell and how, how you find other studies with the same problem, how you present a corrected result that is itself uncertain, and what you change so it cannot happen again. Then describe a real time you had to report that your own team's earlier result or number was wrong, or say that you have not and reason it through.

**Constraints.** External communication to advertisers is owned by other teams. Other studies may share the flaw. You cannot rerun the original study with the same timing.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are you sure of the flaw? | A: Fairly sure; you have reproduced it on one study. Nobody else has reviewed it yet.
- Q: How many other studies used the same pipeline version? | A: You do not know yet.
- Q: Is anyone deciding anything on the number now? | A: Yes. Budget and launch decisions are being made with it.
- Q: Who wrote the faulty step? | A: An engineer on your team, following a review that you approved.

**Hints.**
1. Get a second person to confirm the flaw quickly; then the clock is about decisions being made on a wrong number.
2. Say what is known, what is not, and when you will know more. A correction that overstates its own certainty repeats the mistake.
3. The best prevention is a check that runs automatically on every study, not a reminder.

**Follow-ups.**
1. Your manager suggests waiting for the next study to confirm before telling anyone. What do you do?
2. How do you find every other study affected, and in what order do you correct them?
3. How do you present a corrected result whose interval includes zero, to an audience that wants a yes or no?
4. Which automatic checks would have caught this flaw, and where in the pipeline do they run?
5. In your real example, what did you personally say, to whom, and what happened next?

**Follow-up rules.**
- when: wait, next study, confirm first → ask: Budget decisions are being made on the number this week. What is the cost of waiting a month, and who bears it?
- when: retract, correction, correct the record → ask: What exactly does the correction say, who sends it, and what does it say about the remaining uncertainty?
- when: sample ratio, balance check, a/a test → ask: Which check would have caught this specific flaw, and why was it not there?
- when: blame, fault, the analyst → ask: You approved the review. How do you keep the follow-up blameless and still own your part?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?

**Evaluation Criteria.** Confirms the flaw quickly with a second reviewer; escalates promptly to the people making decisions, with known, unknown and next update; does not wait for convenient timing; finds and prioritises other affected studies; presents the corrected result with honest uncertainty; owns their part; prevention through automatic checks (sample ratio, covariate balance, identical processing in both groups, A/A tests); real example with personal contribution and outcome, or honestly hypothetical.

## MET-L5-05: Several apps, several definitions of an active person

| | |
|---|---|
| **Template ID** | MET-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Architecture decisions / shared metrics layer, consolidation without a mandate |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "pipelines": [3, 5, 7],
  "cost": ["$1.5 million", "$4 million"],
  "gap": ["4%", "11%"],
  "months": [6, 12]
}
```

**Business Scenario.** A company runs several social and messaging apps. Years ago each app built its own daily-active pipeline with its own definition (opened the app; any logged event; sent or received a message) and its own day boundary. There are now {{pipelines}} such pipelines costing about {{cost}} a year combined. The company-wide report of active people differs from the apps' own reports by {{gap}}, and every review starts with an argument about whose number is right. A vice president asks you to propose and deliver a shared metrics layer within {{months}} months. App teams are not required to adopt it.

**Problem Statement.** How would you decide the architecture (one central pipeline, shared definitions over each app's pipeline, a semantic layer, or a hybrid), bring the app teams along, migrate without breaking their goals and reports, and show it worked? Then describe a real consolidation, platform migration or shared-standard effort you led or strongly influenced, with the outcome, or say that you have not and reason it through.

**Constraints.** App teams keep shipping throughout. Some differences between apps are legitimate and some are accidents. A person is counted once across apps only where their accounts are linked under the platform's privacy rules and their own settings; you may not link accounts yourself to improve the count.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Which differences are accidents? | A: You do not know yet; some teams use UTC days and others local days, and test accounts are excluded inconsistently.
- Q: Who consumes the numbers? | A: Company-wide reports, every app's goals, and many dashboards.
- Q: Is there budget for a new team? | A: A small one. Most of the work must come from existing teams.
- Q: Does the largest app want this? | A: Not especially. Its pipeline works and it sees cost without benefit.

**Hints.**
1. Separate definitions, code and data: you can share any one of them without sharing the others.
2. Classify every difference as legitimate or accidental with evidence before proposing anything.
3. A migration that only creates work for the biggest team will stall. Find what they get out of it.

**Follow-ups.**
1. The largest app team refuses to migrate. What do you do?
2. What exactly do you centralise: the definition, the code, the data, or the serving layer? Why?
3. During a parallel run, the new layer and one app's pipeline differ by 3%. Who is right, and how do you find out?
4. The new layer costs more than the old pipelines for its first two quarters. How do you justify it, and what do you cut?
5. In your real example, what did you get wrong at first, and how did you change course?

**Follow-up rules.**
- when: central team, single pipeline, one pipeline → ask: Your team now owns every app's most important metric. What happens to your on-call load and to their release speed?
- when: semantic layer, shared definitions, metrics layer → ask: The same definition applied to different raw logs still gives different numbers. Where does the definition stop and the logging start?
- when: mandate, require, force → ask: There is no mandate. Why would the largest app adopt in the next {{months}} months?
- when: deduplicate, unique people, count once → ask: Many people have not linked their accounts across apps. How do you count them once without linking them yourself, and how do you label that number?
- when: we decided, consensus, the group agreed → ask: Where did you personally disagree, and what did you do about it?

**Evaluation Criteria.** Diagnoses differences with evidence and classifies them; compares architectures on explicit criteria (consistency, ownership, cost, migration risk); proposes a staged path with a parallel run and reconciliation; respects privacy rules on cross-app counting with an estimated, labelled figure where accounts are not linked; earns adoption with value for app teams rather than mandate alone; defines success measures (one agreed number, fewer reconciliation disputes, cost); real example with measurable outcome and personal contribution, or honestly hypothetical.
