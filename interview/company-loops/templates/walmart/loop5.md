# Walmart Global Tech · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of omnichannel
retail: stores and e-commerce, online grocery pickup and delivery, store
inventory and replenishment, fulfilment, returns and pricing. Every situation
is hypothetical, and none describes any company's hiring process, its vendors
or the values it assesses. Store, associate and customer data appear only in
aggregate. Answer from your own experience, or say plainly that you have not
faced it and reason it through. Never invent a story.

## WMT-L5-01: Rolling out a workflow change that thousands of stores must adopt

| | |
|---|---|
| **Template ID** | WMT-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Change at scale / pilots, waves, adoption measured in aggregate, feedback and rollback |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "change": ["a new way of recording substitutions while picking online grocery orders", "a new handheld flow for cycle counts", "receiving trailers by scanning pallets instead of every case"],
  "stores": ["2,000", "4,600", "10,000"],
  "weeks": [6, 10, 16],
  "pilot_result": ["the pilot stores improved the target measure, but the time the task takes rose by a fifth", "the pilot went well in large stores and badly in small ones", "the pilot's numbers looked good, but a third of the pilot stores had quietly gone back to the old process"]
}
```

**Business Scenario.** Your team built the software and data behind {{change}}. A pilot ran in 25 stores for a month, and {{pilot_result}}. Leadership wants the change in all {{stores}} stores within {{weeks}} weeks. Store teams are busy, the change alters work they do every day, and the people doing it were not in the room when it was designed. You lead the technical side of the rollout and are accountable for whether it works.

**Problem Statement.** How do you lead the rollout? Cover what you do about the pilot result before going wider, how you decide the waves and what stops the next one, how you measure adoption and outcome without measuring or ranking individual people, how store teams' feedback reaches your team and changes the product, what support and training exist, and how you would pause or roll back. Then tell me about a real time you rolled out a change that many people had to adopt, with what happened, or say that you have not and reason it through.

**Constraints.** Adoption and outcome are measured per store, region and store format in aggregate; no individual associate is measured, ranked or singled out. Stores cannot be offline for training, and a peak season starts soon after the target date. You do not manage store operations; their leaders decide store priorities.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the deadline fixed? | A: Leadership chose it; it can move with evidence, through your manager and store operations leadership.
- Q: Can the old process stay available? | A: Technically yes, for a while; running both costs support time and muddies the numbers.
- Q: Who talks to stores? | A: Store operations and regional leaders. Your team can join calls and visit stores with them.
- Q: What does the pilot data cover? | A: Per-store aggregates of the target measure, time per task, and errors, plus written feedback from pilot stores.

**Hints.**
1. Understand the pilot result before scaling it: what explains it, and does it hold in every store format?
2. Decide in advance what each wave must show before the next starts, and who can stop it.
3. People quietly going back to the old process is feedback about the product, not about the people.

**Follow-ups.**
1. What exactly do you do about the pilot result in the first two weeks?
2. How do you choose the stores for each wave, and what criteria must a wave meet before the next starts?
3. Adoption is high but the outcome has not improved in the first wave. What do you look at, and what do you change?
4. A regional leader asks for a dashboard that shows which associates use the new flow and which do not. What do you say, and what do you offer instead?
5. In your real example, what did you learn from the people who had to adopt the change, and what did it make you change?

**Follow-up rules.**
- when: dashboard, leaderboard, scorecard, ranking → ask: Who sees it, at what level of aggregation, and how do you make sure it is never used to single out individual people?
- when: mandate, enforce, force, require → ask: Stores comply on paper and work around the flow in practice. How would you find out, and what would you change in the product?
- when: pilot, wave, phase, phased → ask: Which result in a wave would make you stop the next one, and who agreed to that before it started?
- when: training, train, documentation → ask: Store teams cannot step away for training before peak. How else does the knowledge reach them, and how do you know it did?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do, and when?

**Evaluation Criteria.** Investigates the pilot result before scaling (time per task, store-format differences, quiet reversion treated as product feedback), with visits or calls to pilot stores alongside store operations; waves chosen across store formats with explicit entry and exit criteria agreed in advance and a named person who can stop them; adoption and outcome measured in aggregate per store and region, explicitly refusing per-associate tracking; feedback loops that change the product (in-app feedback, regional calls, a fast fix cadence); support and lightweight training that fit store work; a tested pause and rollback path and a decision on the old process; a realistic view of the deadline against peak season, raised with evidence; real example with personal contribution and what changed, or honestly hypothetical.

## WMT-L5-02: A central platform team's standards versus many product teams' autonomy

| | |
|---|---|
| **Template ID** | WMT-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Influence without authority / platform standards, exceptions, cost of compliance |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "standard": ["one event schema registry that every team must publish through", "one shared definition of 'in stock' used by every product surface", "a common data-quality check suite required before any dataset is published"],
  "teams": [12, 25, 40],
  "holdout": ["the online grocery team, who ship every week and say the process adds days to each change", "the store systems team, whose devices cannot run the shared client library", "the marketplace team, whose data comes from sellers and does not fit the standard's assumptions"],
  "months": [3, 6]
}
```

**Business Scenario.** You lead a central data platform team in a retailer with {{teams}} product teams across stores, e-commerce, fulfilment and pricing. Last year your team introduced {{standard}}. Most teams have adopted it, and incidents caused by inconsistent data have fallen. One team has not: {{holdout}}. Leadership asks you to make the standard mandatory for every team within {{months}} months, and the holdout team's lead has asked for a permanent exception.

**Problem Statement.** What do you do? Cover how you decide which parts of the standard must be mandatory and which can be recommended, how you work with the holdout team, how exceptions are decided and reviewed, what your own team changes, and how you would know whether the standard is worth what it costs the teams that follow it. Then tell me about a real time you set or enforced a technical standard across teams you did not manage, or say that you have not and reason it through.

**Constraints.** You do not manage the product teams. Product teams' leads own their roadmaps. The standard's benefits are shared, while its costs fall on each team.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the holdout team's complaint valid? | A: Partly. Some of it is real friction your team created; some is preference.
- Q: Who decides exceptions today? | A: Nobody formally; your team has granted a few informally.
- Q: What evidence exists for the benefit? | A: Incident counts before and after for adopting teams, and some anecdotes. Nobody has measured the cost.
- Q: What happens if the holdout team never adopts? | A: Their data feeds several shared reports, which are where most remaining inconsistencies appear.

**Hints.**
1. Separate the interface everyone must meet from how each team meets it.
2. A standard that costs a team days per change is partly your team's product problem.
3. An exception process with criteria, an owner and an expiry date is more durable than an informal yes.

**Follow-ups.**
1. Which parts of the standard are truly mandatory, and how did you decide?
2. What do you change in your own platform to remove the holdout team's legitimate friction?
3. Leadership wants a mandate; you think a mandate now would backfire. What do you tell them, and with what evidence?
4. Another team asks for the same exception the holdout team got. How do you decide?
5. In your real example, what did enforcing the standard cost, and was it worth it?

**Follow-up rules.**
- when: mandate, mandatory, enforce, block → ask: The holdout team ships weekly. Your gate blocks a fix during peak season. Who can override it, and how fast?
- when: exception, waiver, carve out → ask: What are the criteria for an exception, who decides, and when does it expire?
- when: survey, feedback, interview → ask: What did the holdout team actually tell you, and which part of it did you change your platform for?
- when: metric, measure, incidents → ask: How would you measure what the standard costs each team, not only what it saves?
- when: we decided, the team decided, we agreed → ask: What did you personally do with the holdout team's lead, and when?

**Evaluation Criteria.** Distinguishes the shared interface (what must be true at the boundary, for example a schema contract or a single metric definition) from implementation freedom; listens to the holdout team and fixes the platform's own friction (faster review paths, a lighter client, adapters for devices or seller data); a written exception process with criteria, an owner, review and expiry; evidence of benefit and cost, including cost to teams; honest counsel to leadership on mandate timing with a plan and evidence; treats other teams' requests consistently; real example with personal contribution and measurable outcome, or honestly hypothetical.

## WMT-L5-03: Leading a team that is half contractors, with different incentives and tenure

| | |
|---|---|
| **Template ID** | WMT-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team leadership / mixed workforce, knowledge concentration, inclusion within agreed terms |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "size": [8, 12, 20],
  "issue": ["only contractors know how the nightly replenishment jobs work", "contractors are not invited to design reviews and have stopped raising problems", "employees take the new design work while contractors carry most of the on-call pages"],
  "milestone": ["the move of store inventory feeds to a new platform", "the readiness work for the holiday peak", "the launch of pickup slot capacity in a new region"],
  "weeks": [6, 12]
}
```

**Business Scenario.** You have just taken over a data engineering team of {{size}} people; half are contractors provided by an outside firm, most on engagements of about a year, and half are employees. In your first weeks you find that {{issue}}. The team must deliver {{milestone}} in {{weeks}} weeks. Two contractors' engagements end shortly after that, and one of them is the person the team calls when something breaks.

**Problem Statement.** What do you do? Cover what you do in the first weeks, how you reduce the team's dependence on a few people, how you make the team work as one team within what the contracting agreement allows, how you protect the milestone, and how you handle the engagements that are ending. Then tell me about a real time you led or worked in a team with a mix of employees and contractors, or say that you have not and reason it through.

**Constraints.** You cannot change contracts, rates or terms; the outside firm employs its people, and your company has rules about how contractors' work is directed and what they may access. You cannot promise anyone a job. The milestone date is fixed.

**Assumptions.** The situation and figures are hypothetical; nothing here describes any company's staffing arrangements.

**Clarifications.**
- Q: Can contractors attend design reviews and on-call? | A: Your company allows both, within the agreement; ask HR or procurement if unsure rather than guessing.
- Q: Can the ending engagements be extended? | A: Possibly, through procurement and the outside firm; it is not your decision alone.
- Q: Is anything documented? | A: Some runbooks exist, out of date. Most knowledge is in people's heads.
- Q: How do the employees feel? | A: Some think contractors should just "do the tickets"; others are uneasy with that.

**Hints.**
1. Start by finding where knowledge and risk are concentrated, and in whom.
2. Treat everyone as part of one team in how work, information and credit are shared, while respecting the agreement's terms.
3. Knowledge transfer is work: plan it, staff it and check it, especially before an engagement ends.

**Follow-ups.**
1. What do you do in your first two weeks, and what do you not change yet?
2. How do you transfer the knowledge of the person everyone calls before their engagement ends, without stalling the milestone?
3. An employee says contractors should not be in design reviews because "they will be gone next year". What do you say?
4. The milestone and the knowledge transfer compete for the same people in the last three weeks. How do you decide?
5. In your real example, what did you do to make the team work as one, and what was the result?

**Follow-up rules.**
- when: documentation, document, runbook, wiki → ask: Who checks that the runbook works? Has someone other than the author run it during an incident?
- when: extend, extension, convert, hire → ask: You cannot promise that. What do you tell the contractor while procurement decides?
- when: pair, pairing, shadow, rotation → ask: Pairing takes time from the milestone. How much, and how did you decide it was worth it?
- when: on-call, pager, rota → ask: How do you make the on-call load fair across the whole team, and what changes for the person who carries most of it now?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do, and when?

**Evaluation Criteria.** Diagnoses knowledge and risk concentration early (who can fix what, which jobs have one expert); treats the team as one in information, design discussion, credit and fair on-call, within the agreement and company rules, asking HR or procurement rather than guessing; plans and verifies knowledge transfer (pairing, rotation, runbooks tested in drills) before engagements end; raises extension or staffing needs early through the right channels without promising outcomes; protects the milestone with an explicit trade-off; addresses employees' attitudes directly and respectfully; real example with personal actions and outcome, or honestly hypothetical.

## WMT-L5-04: Bringing a vendor-run system in-house before the contract ends

| | |
|---|---|
| **Template ID** | WMT-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Migration leadership / discovery, parallel run, cut-over and rollback against a fixed end date |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "system": ["the service that turns price changes into store shelf-label and signage data", "the pickup slot booking service", "the service that authorises returns and computes refund amounts"],
  "months": [6, 9, 12],
  "gap": ["the vendor's documentation covers the API but not the nightly batch jobs behind it", "about a third of the business rules exist only as settings in the vendor's console", "the vendor will export current data but not history older than two years"],
  "team": ["five engineers", "nine engineers"]
}
```

**Business Scenario.** A retailer has run {{system}} on an outside vendor's platform for years. The contract ends in {{months}} months and will not be renewed; leadership has decided to bring the capability in-house, and you lead the work with {{team}}. Stores and online customers depend on the service every day. In discovery you learn that {{gap}}. The vendor is cooperative but has less reason to help as the end date approaches.

**Problem Statement.** How do you lead it? Cover how you find out everything the current system does, including what nobody wrote down; how you decide what to rebuild exactly, what to change and what to drop; how you prove the new system behaves the same where it must; the cut-over and rollback plan; how you manage the vendor relationship through the exit; and what you do if the date is at risk. Then tell me about a real migration off a system you did not build, or say that you have not and reason it through.

**Constraints.** The contract end date does not move. Stores cannot tolerate a day without the service. Contract and commercial matters are handled by procurement and legal, not by you.

**Assumptions.** The situation and figures are hypothetical; nothing here describes any company's actual vendors, contracts or systems.

**Clarifications.**
- Q: Can the contract be extended for a short period? | A: Possibly at a high price; it would need a strong case through procurement.
- Q: Do you have production data from the vendor's system? | A: Its outputs and current data, yes; its internal logs, no.
- Q: Who uses the outputs? | A: Store systems, the website, finance reports and two other internal teams.
- Q: What did the business ask for beyond parity? | A: Two long-requested changes; leadership would like them "if possible".

**Hints.**
1. The system's real specification is its observed behaviour: inputs, outputs and the cases in between. Capture it before the vendor relationship ends.
2. A parallel run comparing the two systems' outputs on real inputs tells you where you differ and why.
3. Decide early what would make you ask for an extension, and what it would cost, so the decision is not made in the last week.

**Follow-ups.**
1. What do you do in the first month?
2. How do you recover the rules that exist only in the vendor's console or batch jobs, and how do you know you found them all?
3. The parallel run shows 2% of outputs differ. How do you decide which differences matter?
4. Leadership wants the two new features in the first release. What do you say?
5. In your real example, what did you discover late, and what would you do earlier next time?

**Follow-up rules.**
- when: big bang, cut over, cutover, switch over → ask: The new system fails two hours after the switch on a busy Saturday. What is the rollback, and has it been rehearsed while the vendor's system still runs?
- when: parallel run, shadow, compare → ask: What exactly do you compare, at what grain, and how many differences are you prepared to accept at cut-over?
- when: rewrite, improve, redesign → ask: Every improvement makes the parallel run harder to read. Which changes ship before cut-over, and which after?
- when: extension, extend → ask: What evidence would justify an extension, who would you take it to, and by when?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do, and when?

**Evaluation Criteria.** Discovery that treats observed behaviour as the specification (inventory of inputs, outputs, consumers, schedules; console settings and batch jobs captured while access exists; history exported early); scope split into parity, deliberate changes and removals, agreed with consumers, with new features after cut-over unless essential; a parallel run with output comparison at a defined grain and an explained-difference log; staged cut-over by consumer or region with a rehearsed rollback while the vendor system still runs; a constructive vendor relationship with contract matters left to procurement and legal; early, evidence-based decision on extension risk; real example with personal contribution and lessons, or honestly hypothetical.

## WMT-L5-05: Project deep dive, re-examined for omnichannel retail at store scale

| | |
|---|---|
| **Template ID** | WMT-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, store-local time, offline sources and reconciliation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["store numbers that reconcile exactly to each register's end-of-day totals", "every report in each store's local business day, including the days clocks change", "stores whose data arrives hours late without silently changing numbers people already acted on", "customer and associate data visible only in aggregate"],
  "scale": ["thousands of stores, each with its own registers and handheld devices", "hundreds of millions of store-item rows refreshed every day", "billions of register line items a year"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for omnichannel retail at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The omnichannel retail setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a retail system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one record, such as a register line item: where it is created, when it arrives, which store and day it belongs to, and which of its fields the requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: utc, timezone, time zone → ask: A store eight hours west of UTC closes at 23:00 local time. Which day do its last sales belong to in your design, and on the night clocks change?
- when: reprocess, backfill, restate, overwrite → ask: A store's data arrives six hours late, after the morning report went out. What do readers see, and can they tell what changed?
- when: reconcile, reconciliation, totals → ask: Your totals differ from the registers' by 0.1% for one store. How do you find which transactions explain it?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example per-register sequence numbers and end-of-day totals reconciled by store and register; a business day computed from each store's time zone at ingestion and stored with the record; versioned, labelled restatement with a changes view rather than silent overwrites; aggregation thresholds and access controls that keep individual customers and associates out of analytics); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
