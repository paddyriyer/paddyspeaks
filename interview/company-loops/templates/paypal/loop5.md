# PayPal · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a consumer wallet and peer-to-peer payments service. Every situation is hypothetical, and none describes any company's internal systems, teams or partners, or any company's hiring process. Evaluation is evidence-based leadership; no company's published values are used as the rubric.

## PYP-L5-01: A partner's errors that your users experience as yours

| | |
|---|---|
| **Template ID** | PYP-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | External dependencies / evidence, user communication, influence without authority |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "partner": ["the bank-transfer provider used for withdrawals in one market", "the provider that verifies linked bank accounts", "the provider that delivers one-time sign-in codes by text message"],
  "symptom": ["withdrawals shown as sent arrive a day or more late", "bank links fail with a generic error and users retry again and again", "sign-in codes arrive minutes late or not at all"],
  "share": ["2%", "5%", "9%"],
  "weeks": [3, 6]
}
```

**Business Scenario.** Your team owns the integration with {{partner}}. For {{weeks}} weeks, about {{share}} of the users who depend on it have found that {{symptom}}. Support contacts are rising, app-store reviews and public posts blame the wallet, and some users have stopped using the feature. The partner's own dashboard shows them meeting the service levels in their agreement. A partnerships manager owns the relationship and the agreement; your team owns the code that calls the partner, what the app shows while it waits, and the data about every request.

**Problem Statement.** What do you do? Cover how you establish, with evidence, where the failure is (your side, the partner's, or the boundary between them); what you can do for users now without waiting for the partner; what users are told, and by whom; how you work with the partnerships manager and the partner's engineers; what you change so the next problem is seen in hours rather than weeks; and when you would look for a second provider. Then tell me about a real time a dependency you did not control hurt your users, with what you did, or say that you have not and reason it through.

**Constraints.** You cannot change the partner's systems or the agreement. Public statements go through the communications team. You draw no legal conclusion about the agreement; that is for the partnerships and legal teams, and you bring them evidence.

**Assumptions.** The situation, figures and partner are hypothetical.

**Clarifications.**
- Q: Do we log every request to the partner? | A: Yes, with timing and the partner's response code, but nobody has looked at them by market, bank or hour.
- Q: Has the partner been told? | A: Support has opened tickets; the partner answered that everything is within the agreed levels.
- Q: Is there a second provider? | A: Not today. Adding one would take at least a quarter.
- Q: Can we tell users the partner is at fault? | A: Not by name, and not without communications; you can tell them what is happening and what to expect.

**Hints.**
1. Measure the user's experience end to end, then split it at the boundary: time in your systems, time waiting for the partner, and what came back.
2. The agreement measures what it measures. Find the gap between it and what users experience; that gap is usually the conversation to have.
3. Some of the harm is in how the app behaves while it waits: honest status, sensible retries and clear timing expectations are yours to fix today.

**Follow-ups.**
1. What would you look at in the first day, and what result would tell you the problem is on your side after all?
2. Your data shows the partner fails mostly for three banks and mostly at month end. How do you present that to the partner so they act on it?
3. What do you change in the app this week, and how do you know it reduced the harm rather than just the complaints?
4. The partner fixes it, then it recurs two months later. What should already be in place by then?
5. In your real example, what did you get wrong first, and what changed in how you manage dependencies?

**Follow-up rules.**
- when: sla, agreement, contract → ask: The partner meets the agreed levels on paper. What measure would capture what users experience, and how would you get the partner to accept it?
- when: retry, retries → ask: Your retries double the load on a partner that is already struggling. How do you decide how many, and when to stop?
- when: second provider, switch provider, replace → ask: That takes a quarter and has its own risks. What do users get in the meantime, and what evidence would justify the switch?
- when: escalate, escalation → ask: To whom, with what, and what do you want them to decide?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say, and when?

**Evaluation Criteria.** Establishes the facts first with end-to-end measurement split at the boundary, and is open to the problem being on their own side; acts now on what they control (honest in-app status and timing, retry and timeout behaviour that does not add load, support guidance) and measures harm, not only complaints; brings specific evidence (by market, bank, hour) to the partnerships manager and the partner's engineers, proposing a measure that reflects users' experience; communicates to users through the proper owners, honestly and without blaming by name; builds lasting detection (per-dependency service-level objectives on the user's outcome, joint dashboards, alerts) and decides on a second provider with evidence; draws no legal conclusions; real example with personal contribution and changed practice, or honestly hypothetical.

## PYP-L5-02: Using customer support contacts to find and fix the biggest source of user confusion

| | |
|---|---|
| **Template ID** | PYP-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Problem discovery from support data / measurement, privacy, cross-team prioritisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect, software-engineer |

```params
{
  "contacts": ["40,000", "150,000", "400,000"],
  "data_state": ["contact reasons picked by agents from a list of 200, used inconsistently", "free-text chat and email only, with no reason codes", "reason codes from a list that was replaced three months ago, plus free text"],
  "candidates": ["money shown as pending versus available after a transfer", "payments sent to an email or phone number that the recipient has not claimed", "the amount a recipient abroad receives compared with what the sender expected"],
  "weeks": [6, 10, 12]
}
```

**Business Scenario.** The wallet's support teams handle about {{contacts}} contacts a week. The data you have is {{data_state}}. Product leaders each believe they know the biggest source of confusion; the loudest view is that it is {{candidates}}. You have been asked to find out what actually drives the most contacts that a product change could prevent, and to lead the fix with the product teams over the next {{weeks}} weeks.

**Problem Statement.** How would you approach it? Cover how you turn the contact data into a trustworthy ranking of causes, with honest uncertainty; how you handle the personal information in contacts; how you choose what to fix (volume, harm to users, cost per contact, how fixable it is); how you get the owning product team to take it on; how you will know the fix worked; and how you keep the ranking current afterwards. Then tell me about a real time you used operational data such as support contacts, incidents or logs to change what a team built, or say that you have not and reason it through.

**Constraints.** Contacts contain names, contact details and descriptions of people's money; access is restricted and every use must fit the support data policy. You do not own the product teams' roadmaps. Support agents' time is limited; you can ask for a small change to how they record contacts, not a new process.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can I read individual contacts? | A: A small sample, under the policy, by people with access; anything wider must be redacted or aggregated.
- Q: Is contact volume the only cost? | A: No. Some confusions also lead to users sending money to the wrong person or abandoning a payment.
- Q: Do product teams track contacts today? | A: Not systematically; they hear about the worst cases.
- Q: Is the loudest view wrong? | A: You do not know yet. It might be right.

**Hints.**
1. Build the ranking on a labelled sample first: read and code a few hundred contacts by hand (under the policy), then check how well reason codes or an automatic classifier agree with your labels before trusting them at scale.
2. Rank by preventable harm, not raw volume: contacts per thousand active users of the feature, repeat contacts, and money or trust at stake.
3. Agree with the owning team, before the change ships, what number should move and by how much.

**Follow-ups.**
1. Given the data you have, how would you size the top causes, with confidence intervals, before trusting any automatic labels?
2. Your ranking says the loudest view is third, not first. How do you present that to the leader who holds it?
3. The fix is a wording change on one screen. How do you measure its effect on contacts when contact volume moves with seasons and releases?
4. An analyst proposes running a language model over all transcripts. What has to be true before you agree?
5. In your real example, what did the data change that opinion alone would not have?

**Follow-up rules.**
- when: classifier, model, nlp, llm → ask: How do you know its labels are right, and what personal data does it see, where, and under whose approval?
- when: dashboard, report → ask: Who looks at it every week, and what decision does it change?
- when: survey, interview → ask: How does what users say compare with what the contacts show, and which do you trust when they disagree?
- when: a/b test, experiment, holdout → ask: The fix is a help screen. Is it right to withhold it from a hold-out group, and for how long?
- when: we decided, the team decided, we agreed → ask: Which part did you personally do?

**Evaluation Criteria.** Builds a trustworthy ranking (a hand-labelled sample, measured agreement of reason codes or classifiers, uncertainty stated) instead of trusting raw codes; handles personal data within policy (minimum access, redaction, aggregates, approval before new processing); ranks by preventable harm normalised by usage, not volume alone; engages the owning team with evidence and an agreed success measure; measures the effect fairly (comparison against expected volume, staged rollout or a hold-out where appropriate); keeps the ranking current with a small, durable change to how contacts are recorded; treats the loud view fairly; real example with what changed and personal contribution, or honestly hypothetical.

## PYP-L5-03: Turning a vague executive goal into a measurable plan

| | |
|---|---|
| **Template ID** | PYP-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Strategy to execution / metric definition, scoping, trade-offs, alignment |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "goal": ["\"make sending money abroad feel instant\"", "\"make splitting a bill with friends effortless\"", "\"make people trust that their money is where we say it is\""],
  "quarters": [2, 3, 4],
  "team": [6, 12, 25]
}
```

**Business Scenario.** At a planning meeting, an executive sets a goal for your area: {{goal}}. There is no definition, no baseline and no target, but there is a deadline: show progress within {{quarters}} quarters. You lead a group of about {{team}} engineers and analysts whose systems touch the goal, alongside product managers and teams you do not lead. Several teams have already started describing their existing plans in the goal's words.

**Problem Statement.** How do you turn the goal into a plan? Cover what you do to understand what the executive actually means; how you define the measures (one main measure, the ones that must not get worse, and how each is computed); how you set a baseline and a target; how you choose the few bets most likely to move the main measure, and what you stop doing to make room; how you get the other teams and the executive to agree; and how you report progress honestly, including when the measure does not move. Then tell me about a real time you turned an unclear goal into a concrete plan, with what happened, or say that you have not and reason it through.

**Constraints.** Your group's headcount is fixed. Every measure must be computable from data you can get within a month. Progress reports go to the executive monthly.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can I go back to the executive with questions? | A: Yes, once, for thirty minutes, in the next two weeks.
- Q: Is there an existing measure close to the goal? | A: Several, defined differently by different teams, none agreed.
- Q: Can the goal be met by changing what users are told rather than what happens? | A: Some of it, honestly; say where that line is.
- Q: Do other teams have to adopt your measure? | A: Only if they agree it is right; you cannot make them.

**Hints.**
1. Translate the goal into a moment in the user's journey you can observe: what would a user experience if the goal were met, and how would you count it?
2. Pair the main measure with guardrails that it could tempt people to worsen (accuracy, cost, failed payments, support contacts).
3. A plan with fewer, bigger bets that you can measure separately beats a long list that claims credit for everything.

**Follow-ups.**
1. Give me a concrete definition of the main measure for {{goal}}: the population, the start and end events, and the computation.
2. What would you ask the executive in your thirty minutes, and what would change depending on the answers?
3. Two teams' existing projects have been renamed to fit the goal. How do you decide whether they stay in the plan?
4. After two months the main measure has not moved. What do you report, and what do you change?
5. In your real example, how did the definition you started with differ from the one you ended with, and why?

**Follow-up rules.**
- when: okr, kpi, north star → ask: What would make that number go up while users' experience got worse, and which guardrail catches it?
- when: survey, nps, satisfaction → ask: How often can you measure it, how noisy is it, and what behavioural measure would you pair it with?
- when: roadmap, backlog → ask: What did you take off it to make room, and who disagreed?
- when: baseline → ask: The baseline itself turns out to be computed differently by two teams. Which do you use, and how do you settle it?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and who did you have to persuade?

**Evaluation Criteria.** Clarifies intent with the executive using a few sharp questions; defines a main measure precisely (population, events, computation) with guardrails, a measured baseline and a target with a rationale; chooses a few bets tied to the measure, with explicit trade-offs and things stopped; aligns teams through a shared, agreed definition rather than mandate, and treats renamed projects on evidence; reports honestly, including no movement, and adjusts; is honest about where changing what users are told is legitimate and where it is not; real example with what changed and personal contribution, or honestly hypothetical.

## PYP-L5-04: A smaller market's needs against the largest market's roadmap

| | |
|---|---|
| **Template ID** | PYP-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation across markets / platform generality, technical debt, stakeholder trade-offs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "need": ["support for a currency with no minor unit, which breaks screens, rounding and reports that assume two decimal places", "support for payments to phone numbers, which is how most people there pay each other, where the product assumes usernames", "support for bank transfers as the main funding source, with results known only the next day, where the product assumes instant card results"],
  "share": ["3%", "6%", "10%"],
  "quarters": [2, 3]
}
```

**Business Scenario.** Your team owns a shared part of the wallet used in every market. A market that accounts for about {{share}} of users, and is growing fast, needs {{need}}. The market's team has worked around the gap for a year with local fixes that keep breaking. The largest market's product leaders have a committed roadmap for your team for the next {{quarters}} quarters, and they argue that their market's users and revenue should come first. Both sides have asked you to decide what your team does next.

**Problem Statement.** How do you decide, and how do you carry the decision through? Cover what you find out about the size of the problem (users affected, failures, cost of the workarounds, risk); whether the need is really one market's or a flaw in a shared assumption that will hit others; the options (do it now, do part of it, let the market's team build it on your platform with your support, defer with a date); how you bring both sides to a decision and who makes it; and how you communicate it to the side that does not get what it asked for. Then tell me about a real time you had to weigh a smaller group's needs against a larger group's, or say that you have not and reason it through.

**Constraints.** Your team's capacity is fixed for the {{quarters}}-quarter period. Any change to the shared component must keep every market working. You are not the final decider on cross-market priorities; a product director over both is.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the local workarounds dangerous? | A: Some have caused incorrect statements and failed payments; none has lost money yet.
- Q: Will other markets need the same thing? | A: Two more planned launches would, according to their plans.
- Q: Can the market's team contribute engineers? | A: Two, for a quarter, if someone reviews their work.
- Q: Is the largest market's roadmap negotiable? | A: Partly; its leaders have said which two items are fixed.

**Hints.**
1. Check whether the need is a market feature or a wrong assumption in the shared component; the second is debt that grows with each launch.
2. Put both sides' costs in the same units: users affected, money at risk, support load, engineering time, and what delay costs each.
3. Look for options between all and nothing, such as removing the wrong assumption first and letting the market's team build the rest.

**Follow-ups.**
1. What evidence would you gather in the first two weeks, and from whom?
2. How would you show the largest market's leaders that the shared assumption is their risk too, if it is?
3. The director decides for the largest market's roadmap. What do you do for the smaller market in the meantime?
4. You take the market's two engineers for a quarter. How do you make sure what they build is safe for every market?
5. In your real example, how did the people whose request lost react, and what did you do about it?

**Follow-up rules.**
- when: revenue, roi, business value → ask: Revenue favours the largest market by design. What else belongs in the comparison, and how do you weigh it?
- when: workaround, hack, local fix → ask: The workarounds have already caused incorrect statements and failed payments. At what point does that stop being the market's problem and become yours?
- when: platform, generic, abstraction → ask: How much more does the general version cost than the specific one, and how do you stop it becoming a project that never ships?
- when: escalate, director → ask: What do you put in front of the director, and does each side agree it describes their position fairly?
- when: we decided, the team decided, we agreed → ask: What was your recommendation, and did you hold it when it was unpopular?

**Evaluation Criteria.** Sizes the problem with evidence (users affected, incidents from workarounds, money at risk, support load) and checks whether it is a flawed shared assumption rather than a local feature; compares options on the same terms, including middle options (remove the assumption first, enable the market's own engineers with review); respects decision rights, prepares a fair written comparison for the director and makes a clear recommendation; communicates the decision with reasons and a plan for the side that lost (dates, mitigations, safety fixes); protects correctness in every market (tests, flags, staged rollout); real example with outcome, personal contribution and relationships, or honestly hypothetical.

## PYP-L5-05: Project deep dive, re-examined for consumer wallets and peer-to-peer payments across currencies

| | |
|---|---|
| **Template ID** | PYP-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, currencies and minor units, privacy of payments |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["amounts in currencies whose minor units have 0, 2 or 3 digits, converted at most once and rounded by one stated rule", "privacy changes to past payments honoured on every surface within minutes", "proof that every exchange rate applied equals the quote the user accepted", "each user seeing their own activity, and everyone else seeing only aggregates"],
  "scale": ["tens of millions of people paying each other", "transfers between more than a hundred countries", "hundreds of millions of wallet payments a month"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a consumer wallet with peer-to-peer and cross-border payments, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The wallet setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a payments system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, follow one payment from one currency to another: which ids, amounts, currencies and visibility settings it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: float, floating point, decimal → ask: A currency with no minor unit and one with three both pass through your system. Where is the exponent stored, and where exactly is an amount rounded?
- when: exchange rate, conversion, fx → ask: A user disputes the amount their recipient received. What record lets you show which rate was applied and that it matches what they were shown?
- when: dashboard, report, analytics → ask: Who outside the user can see one person's payments in your design, and why?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example integer minor units with the currency's exponent carried as data and one conversion step rounded by a stated rule; a versioned visibility record checked on every read path with tombstones that rebuilds honour; quotes stored with ids and expiry and referenced by each conversion; per-user views scoped to the user and aggregates with minimum group sizes for everyone else); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
