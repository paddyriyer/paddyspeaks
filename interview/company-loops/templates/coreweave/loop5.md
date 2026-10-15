# CoreWeave · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a GPU cloud for
AI workloads, sold by reservation and by the hour. Every situation, customer,
date and figure is hypothetical; nothing here describes the company's customers,
contracts, data centres or suppliers, and none of it describes any company's
hiring process or the values it assesses. Answer from your own experience, or
say plainly that you have not faced it and reason it through. Never invent a
story.

## CRW-L5-01: Telling a customer that capacity they planned around will arrive late

| | |
|---|---|
| **Template ID** | CRW-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Delivering bad news / evidence, options, commitments, working with account teams |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "delay_weeks": [4, 8, 12],
  "share": ["a third", "half", "all"],
  "customer_plan": ["a large training run starting on the ramp date", "an inference expansion ahead of their own seasonal peak", "a product launch promised to their own customers"]
}
```

**Business Scenario.** You lead the team that owns the delivery forecast for reserved capacity: the data that says when GPUs in each region will be ready for each contract's ramp. Your team's latest numbers show that {{share}} of the next ramp step for one customer will be ready about {{delay_weeks}} weeks late, because a data hall is behind schedule. The customer has planned {{customer_plan}} around that date. The account team owns the relationship and has not been told yet; the next scheduled call with the customer is in five days.

**Problem Statement.** What do you do? Cover how you make sure the delay and its range are real before anyone is told; who should tell the customer, when, and with what; the options you prepare (another region, another GPU type, a partial delivery, a temporary bridge with on-demand capacity, a changed ramp) and how you check each one is actually available; what you commit to and what you refuse to commit to; and how you keep the customer and the account team updated until the capacity is delivered. Then tell me about a real time you had to deliver bad news about a date to someone who depended on it, or say that you have not and reason it through.

**Constraints.** You are not the account owner and do not negotiate contract terms; any remedy under the contract is the account and legal teams' decision, and every term here is hypothetical. The construction date itself is uncertain: the hall team gives a range, not a date. Other customers may be counting on the same hall.

**Assumptions.** The customer, figures and dates are hypothetical.

**Clarifications.**
- Q: How sure is the forecast? | A: The hall team gives a range: the delay could be shorter or longer by about two weeks.
- Q: Is there spare capacity elsewhere? | A: Some, in another region and partly in a different GPU type; whether it fits the customer's workload is unknown.
- Q: Does sales want to wait until the date is certain? | A: The account lead would prefer to wait a week "until we know more".
- Q: Are other customers affected? | A: Two smaller customers have ramp steps against the same hall.

**Hints.**
1. Separate what is known, what is estimated (with a range), and what is not known yet; say each plainly.
2. Bad news gets worse with time; give the customer the earliest honest warning with a date for the next update.
3. Options are only options if someone has checked they exist; reserve them tentatively before offering them.

**Follow-ups.**
1. The account lead wants to wait a week. What do you say, and what evidence do you bring?
2. Which options would you prepare, and how would you check that each one would actually work for the customer's workload?
3. The customer asks you to promise the new date in writing. What do you say?
4. The two smaller customers are affected too. Do they hear at the same time, and who decides how the capacity that does arrive is shared?
5. In your real example, what did you say first, and what did the other person do with the news?

**Follow-up rules.**
- when: wait, until we know, more certain → ask: The customer finds out from someone else in the meantime. What does that do to every later date you give them?
- when: promise, guarantee, commit → ask: The range is plus or minus two weeks. Which date do you commit to, and what happens if you miss that one too?
- when: escalate, executive, leadership → ask: What exactly do you bring to the executive, and what decision do you need from them?
- when: compensation, credit, discount, refund → ask: You do not own contract terms. How do you make sure the customer is not promised something before the right people decide?
- when: we told, the team told, we decided → ask: What did you personally say or do, and when?

**Evaluation Criteria.** Verifies the delay and its range with the owning team before acting and states uncertainty honestly; insists on an early warning through the account owner rather than waiting for certainty, and prepares the account team with facts, a range and a date for the next update; prepares concrete options and checks they exist before offering them; commits to dates only at a stated confidence and to updates on a schedule; treats affected customers consistently under a documented rule; respects decision rights on contract remedies; follows through until delivery and changes the forecasting so later slips are seen earlier; real example with what they personally did and how it landed, or honestly hypothetical.

## CRW-L5-02: Processes that worked for a small company breaking during very fast growth

| | |
|---|---|
| **Template ID** | CRW-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Scaling an organisation's practices / diagnosing what breaks, proportionate process, change without paralysis |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |

```params
{
  "growth": ["engineering headcount tripled in a year", "the number of customers grew tenfold in eighteen months", "the platform went from two regions to nine in two years"],
  "process": ["capacity tracked in a shared spreadsheet that several teams edit", "every production schema change reviewed by one senior engineer", "an on-call rota shared by everyone who can deploy", "billing questions answered by whoever wrote the query last"],
  "incidents": [3, 5, 8]
}
```

**Business Scenario.** The company has grown fast: {{growth}}. Many of the ways of working that served it well when it was small are still in place, among them {{process}}. In the last quarter there were {{incidents}} incidents or near misses that trace back, at least in part, to that way of working. People who built it are proud of it, and some say the answer is simply to be more careful.

**Problem Statement.** What do you do? Cover how you establish what is actually failing and why (rather than who); how you decide what to replace, what to keep and what to change only a little; how you design the replacement so that it fits the size of the problem and does not slow everything down; how you get the people who run the current way of working to own the change; how you roll it out without stopping the business; and how you will know it worked. Then tell me about a real time you changed a way of working that had stopped scaling, or say that you have not and reason it through.

**Constraints.** You lead one team; the way of working spans several teams. Growth will not slow down while you fix it. The people involved are respected and stretched.

**Assumptions.** The company, figures and incidents are hypothetical.

**Clarifications.**
- Q: Is leadership asking for a fix? | A: Your director agrees there is a problem and wants a proposal, not a big programme.
- Q: Did the incidents hurt customers? | A: One of them did, briefly; the rest were caught in time.
- Q: Is there a budget for tools? | A: Small; time from your team is the main resource.
- Q: Have earlier fixes been tried? | A: A checklist was added last year; it is filled in inconsistently.

**Hints.**
1. Look at the incidents together: what do they have in common, and which part of the way of working failed in each?
2. A good replacement removes a single point of failure or a manual step; a bad one adds approvals.
3. Change the smallest thing that would have prevented most of the incidents, then measure.

**Follow-ups.**
1. How would you analyse the {{incidents}} incidents to find what the way of working actually got wrong?
2. Someone says the answer is to be more careful. How do you respond without dismissing them?
3. Describe the replacement you would propose for {{process}}. What does it cost, and who has to do something differently?
4. Six months later, how do you know the change worked and did not just move the risk somewhere else?
5. In your real example, what resistance did you meet, and what changed your mind about part of your own proposal?

**Follow-up rules.**
- when: tool, platform, automate, automation → ask: The tool takes a quarter to build. What do you change next week so the next incident is less likely?
- when: approval, sign-off, review board, gate → ask: How long will a change wait for your new approval step at today's growth rate, and what will people do to get around it?
- when: careful, discipline, training → ask: The people involved were already careful. What about the way of working let a careful person make the mistake?
- when: owner, ownership, accountable → ask: Who owns the new way of working a year from now, and how do they know it is still working?
- when: we changed, the team changed, we rolled → ask: What did you personally do or decide?

**Evaluation Criteria.** Diagnoses from the incidents rather than from opinion, finding the structural cause (a single person, a manual step, no source of truth) without blaming individuals; proposes a proportionate replacement that removes the failure mode rather than adding gates, sized to the growth rate; brings the people who run the current way of working into the design and the ownership; rolls out incrementally with a measurable outcome and a review date; acknowledges what the old way did well and keeps it; real example with personal contribution, resistance and outcome, or honestly hypothetical.

## CRW-L5-03: A customer's security review your platform cannot yet fully satisfy

| | |
|---|---|
| **Template ID** | CRW-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Integrity under commercial pressure / honest answers, compensating controls, roadmap commitments |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "gap": ["customer-managed encryption keys for one storage service", "per-customer logs of every operator access to their resources", "evidence that one shared networking component isolates tenants", "certified deletion of a customer's data within a stated number of days after they leave"],
  "weeks": [2, 4, 8],
  "pressure": ["an account executive has already replied 'yes' to that question in an email", "the deal would be the largest in the region this year", "a competitor has told the prospect it supports this today"]
}
```

**Business Scenario.** A prospective customer sends a security questionnaire before signing a reservation. Your team owns the platform area it asks about, and one requirement is {{gap}}. Today the platform supports it only in part. The prospect wants answers in {{weeks}} weeks, and {{pressure}}.

**Problem Statement.** What do you do? Cover how you establish exactly what the platform does today, with evidence; how you write an answer that is accurate and useful rather than a bare no; which compensating controls or interim arrangements you could offer, and how you make sure they are real; whether and how you commit to closing the gap, and who has to agree before anything is promised; how you handle the pressure that comes with the deal (here, {{pressure}}); and what you do after the answer is sent. Then tell me about a real time you had to give an honest answer that put a deal, a launch or a relationship at risk, or say that you have not and reason it through.

**Constraints.** Security and legal teams own the final wording of any security answer; you own the technical facts. A wrong answer in a questionnaire can become a contractual commitment. Roadmap items need the owning teams' agreement and capacity.

**Assumptions.** The prospect, requirement and dates are hypothetical.

**Clarifications.**
- Q: Is the partial support documented? | A: Partly; the documentation is a year old and you suspect it overstates one detail.
- Q: Could the gap be closed? | A: Your team estimates about a quarter of work, which would displace something already planned.
- Q: Does the prospect need it on day one? | A: Unknown; the questionnaire does not say why they ask.
- Q: Who talks to the prospect? | A: The account team, with you on a call if useful.

**Hints.**
1. Start by finding out why the prospect asks: the risk they want covered may be met another way.
2. Describe precisely what exists, what does not, and what would mitigate the gap, in words a security reviewer can test.
3. A roadmap date given to win a deal is a commitment; get it agreed by those who will do the work, or do not give it.

**Follow-ups.**
1. How do you find out what the platform really does today, and what do you do about the documentation that may overstate it?
2. Suppose an account executive had already replied 'yes' to the question in an email. How do you correct it, and with whom first?
3. The prospect accepts an interim control plus a date. What has to be true inside your organisation before that date is sent?
4. Your director asks whether the quarter of work should displace the planned item. How do you frame that decision?
5. In your real example, what did honesty cost, and what did it earn?

**Follow-up rules.**
- when: technically true, wording, phrase it → ask: A reviewer later finds that the answer was technically true but misleading. What happens to the relationship and to your company's other answers?
- when: roadmap, commit, date → ask: Who agreed to that date, and what moves out of the plan to make room for it?
- when: compensating control, workaround, interim → ask: How would the prospect's security team verify that your interim control works?
- when: escalate, director, leadership → ask: What decision do you need from them, and what options do you put in front of them?
- when: we answered, the team answered, we decided → ask: What did you personally write or say?

**Evaluation Criteria.** Establishes the facts with evidence and corrects documentation that overstates them; asks why the requirement matters to the prospect and answers the underlying risk; writes an accurate answer that states what exists, what does not and what mitigates the gap, through the security and legal owners; corrects an inaccurate earlier answer promptly, starting privately with the colleague and the account lead; offers only compensating controls that are real and verifiable; makes roadmap commitments only with the owning teams' agreement and frames the trade-off for the decider; follows through after the answer; real example with what honesty cost and earned, or honestly hypothetical.

## CRW-L5-04: Running a pre-mortem before a high-stakes launch

| | |
|---|---|
| **Template ID** | CRW-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Risk leadership / pre-mortems, turning risks into owned actions, go/no-go criteria |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |

```params
{
  "launch": ["a new region opening to customers", "a new billing system taking over from the old one at the start of a month", "self-service on-demand clusters opening to all customers at once", "per-second metering replacing hourly metering on every invoice"],
  "weeks": [3, 6, 10],
  "teams": [3, 5, 8]
}
```

**Business Scenario.** In {{weeks}} weeks the company launches {{launch}}. The work spans {{teams}} teams, the date has been announced to customers, and everyone says things are on track. You are the technical lead accountable for the launch going well, and you want to run a pre-mortem: imagine it is a month after launch and it has gone badly, and work out why.

**Problem Statement.** How do you run it? Cover who you invite and how you make it safe for people to name risks in other teams' work and in senior people's plans; how you structure the session so it produces specific failure stories rather than generic worries; how you sort and size what comes out; how each important risk becomes an action with an owner and a date, a test, a monitor or a rollback plan; the go/no-go criteria you set for launch day and who decides; and how you follow up so the pre-mortem is not forgotten. Then tell me about a real time you ran or took part in a risk review before a launch, what it caught or missed, or say that you have not and reason it through.

**Constraints.** The date does not move without a director's decision. Teams are busy, and a session that produces a long list with no owners will be ignored. Some of the risks will be in work owned by people more senior than you.

**Assumptions.** The launch, teams and timings are hypothetical.

**Clarifications.**
- Q: Has anything like this launched before here? | A: Not at this scale; there is no previous launch to copy.
- Q: Can you delay the launch? | A: Only by asking the director with evidence.
- Q: Is there a rollback? | A: Each team has said it has one; nobody has tested them together.
- Q: How long can the session be? | A: Ninety minutes, with follow-ups afterwards.

**Hints.**
1. Ask each person to write their failure stories alone before anyone speaks, so the first or most senior voice does not set the agenda.
2. Size each risk by likelihood and by the cost if it happens, and look hardest at the ones nobody owns or that cross team boundaries.
3. Prefer actions that make a failure detectable and reversible over actions that try to make it impossible.

**Follow-ups.**
1. What three failure stories would you expect to come up for {{launch}}, and which would worry you most?
2. A senior engineer dismisses a risk raised about their team's work. How do you handle it in the room and afterwards?
3. Which go/no-go criteria would you set, and what evidence would each need on launch day?
4. Two weeks before launch, a risk from the pre-mortem is still open and its owner says there is no time. What do you do?
5. In your real example, what did the review catch, and what did it miss?

**Follow-up rules.**
- when: brainstorm, everyone shares, round the room → ask: The most senior person speaks first and names two risks. How many people now raise something different?
- when: risk register, spreadsheet, list → ask: The list has 60 items. Which ten get owners this week, and how did you choose them?
- when: rollback, roll back, revert → ask: Has the rollback been run end to end across all {{teams}} teams? What would you learn by trying it?
- when: delay, postpone, move the date → ask: What evidence would you put in front of the director, and what would you need to see to recommend launching on time instead?
- when: we ran, the team ran, we found → ask: What did you personally do in the session and after it?

**Evaluation Criteria.** Invites the people who know the failure modes across all teams, including operations and support, and makes it safe to raise risks (silent writing first, the facilitator naming that risks in senior people's work are expected); produces specific failure stories, sorts them by likelihood and cost, and focuses on cross-team and unowned risks; turns the important ones into owned, dated actions favouring detection, rehearsed rollback and limited blast radius (for example a staged opening); sets measurable go/no-go criteria with a named decider; follows up on open risks and escalates with evidence when needed; real example with what was caught and missed, or honestly hypothetical.

## CRW-L5-05: Project deep dive, re-examined for a GPU cloud sold by reservation and by the hour

| | |
|---|---|
| **Template ID** | CRW-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, metering to the cent, as-of capacity and tenant isolation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["usage metered per second and invoiced to the cent, reconcilable by each customer", "committed capacity answerable as of any past date, through every contract amendment", "each customer seeing only its own usage, clusters and status", "network usage metered from counters without inspecting traffic contents"],
  "scale": ["thousands of customers' clusters", "hundreds of thousands of GPUs across many regions", "billions of metered usage records a day"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a GPU cloud sold by reservation and by the hour, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The GPU cloud setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a cloud or billing system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one GPU-hour: where it is measured, which ids and timestamps it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: float, double, decimal → ask: Where in your system could a fraction of a cent appear, and where exactly is it rounded?
- when: late data, backfill, reprocess, restate → ask: A metering fix changes last month's usage after invoices went out. Which numbers change, and what does a customer see changing?
- when: dashboard, report, export → ask: How do you make sure one customer can never see another customer's usage in that, even through a misconfigured path or filter?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example integer base units and exact rates with one stated rounding step and line-level exports that sum to the invoice; a bitemporal record of contracts, ramps and amendments; tenant scoping derived from verified identity in every query path and export; byte counters with reset handling and destination classes from a versioned address table, with no payload capture); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
