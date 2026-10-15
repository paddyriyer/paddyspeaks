# Block · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of point-of-sale
software and hardware for sellers, peer-to-peer payments and buy-now-pay-later
instalments. Every situation is hypothetical, and none describes any company's
hiring process or the values it assesses. Answer from your own experience, or
say plainly that you have not faced it and reason it through. Never invent a
story.

## BLK-L5-01: A seller publicly challenges a payment hold your data helped inform

| | |
|---|---|
| **Template ID** | BLK-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Accountability for data behind decisions / verification, privacy, correction, decision rights |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "days": [6, 12, 21],
  "finding": ["the signals were correct and the review followed the written process, but the review queue was days behind", "one signal your team computes was inflated by a recent change that double-counted refunds for sellers with several locations", "the signals were correct, but the message the seller received gave no idea of how long the review would take"],
  "reach": ["a local news site picks it up", "it is shared widely by other sellers", "a seller association asks for a meeting about holds in general"]
}
```

**Business Scenario.** Your team computes the aggregate signals that, together with a score another team provides, open review cases for sellers on a payments platform. Reviewers in a separate risk operations team decide on holds; under this exercise's rule a hold delays part of a seller's deposits until the review is complete. A small-business owner posts that their deposits have been held for {{days}} days with no explanation, and {{reach}}. Communications and risk operations ask your team, the same morning, whether the data was right. After two hours of checking you believe {{finding}}.

**Problem Statement.** What do you do over the first day and the following weeks? Cover how you confirm what you believe before you report it, what you tell risk operations and communications and how fast, what you do about other sellers who may be affected, what you change in your own team's systems and practices, and what you must not do. Then tell me about a real time data you owned informed a decision that someone challenged, with what happened, or say that you have not and reason it through.

**Constraints.** You do not decide holds and you do not speak publicly for the company. Nothing about an individual seller's account may be shared outside the people who need it for the case. The review draws no legal conclusion and no judgement of the seller's creditworthiness. Your team is midway through a committed project.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can you see the case record? | A: Yes, the frozen record of what the reviewer saw, through the access your role has for incidents.
- Q: Who talks to the seller? | A: Risk operations and support; communications handles anything public.
- Q: Is the seller right? | A: You do not know yet whether the hold itself was justified. You only know about the data and the process.
- Q: Does anyone want a name for the mistake? | A: Someone asks which engineer made the change. How you answer is part of the question.

**Hints.**
1. Separate three questions: was the data right, was the process followed, was the seller treated well. Your team owns the first and influences the others.
2. Report what you know with its confidence and what you will know by when, rather than waiting for certainty.
3. Look for every other case the same cause could have touched before anyone asks.

**Follow-ups.**
1. What exactly do you check in the first two hours, and how do you decide you are confident enough to report?
2. What do you write to risk operations and communications, and what do you leave out?
3. How do you find other sellers affected by the same cause, and what should happen to their cases?
4. Communications asks for a sentence they can say publicly about the data. What do you give them?
5. In your real example, what changed in how your team builds or checks the data afterwards?

**Follow-up rules.**
- when: tweet, reply publicly, respond publicly, social media → ask: You are not the company's spokesperson. Why is answering the seller yourself a problem, even with good intentions?
- when: blame, whose fault, who made → ask: A senior leader asks which engineer made the change. What do you say, and what do you do next with your team?
- when: rollback, revert, fix → ask: Reverting the change fixes new signals. What about the decisions already made with the inflated values?
- when: release the hold, lift the hold, remove the hold → ask: You do not decide holds. What do you give the people who do, so they can decide quickly and well?
- when: privacy, personal data, account details → ask: Communications wants the seller's case details to prepare a statement. What do they get from you?

**Evaluation Criteria.** Verifies before reporting (the frozen case record, the signal values and their code version, a recomputation, the queue and message history) and reports early with stated confidence; clear separation of data correctness, process and treatment, owning the first; protects the seller's information and respects that risk operations decides and communications speaks; finds every case the same cause could have touched and gives decision-makers what they need to re-review promptly; blameless handling inside the team with a specific prevention (tests on multi-location sellers, distribution monitors, frozen snapshots, queue-age alerts, better messages); no legal or credit conclusions; real example with what changed and personal contribution, or honestly hypothetical.

## BLK-L5-02: A team that never writes anything down

| | |
|---|---|
| **Template ID** | BLK-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Engineering culture / lightweight written decisions, runbooks, knowledge spread |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "system": ["the pipeline behind sellers' daily sales summaries", "the service that computes instalment schedules for purchases", "the reader and register telemetry pipeline"],
  "trigger": ["an outage lasted five hours because the only person who knew the recovery steps was on a flight", "a new engineer took four months to make a change on their own", "an auditor asked why a rounding rule was chosen, and nobody could say"],
  "team_size": [4, 7, 10]
}
```

**Business Scenario.** You have just become the technical lead of a team of {{team_size}} engineers that owns {{system}}. The team is fast and proud of it. Decisions are made in chat threads and calls; there are no design documents, the runbooks are a few lines in a wiki page last edited two years ago, and the people who have been there longest hold most of the knowledge. Last month {{trigger}}. When you raise documentation, people say it goes stale, slows them down and nobody reads it.

**Problem Statement.** How would you change this? Cover what you would write first and why, what the team writes from now on and in what form, how you keep it short and current, how you get the longest-serving engineers to take part rather than resent it, and how you would know in six months that it is working. Then tell me about a real time you changed how a team records decisions or knowledge, with what happened, or say that you have not and reason it through.

**Constraints.** The team's delivery commitments for the quarter stand. You cannot hire a technical writer. You are not anyone's manager.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does the team's manager support this? | A: Yes, but expects you to lead it and does not want velocity to drop noticeably.
- Q: Is there a company template for design documents? | A: There is one, eleven pages long, which is part of why the team avoids it.
- Q: Who knows the most? | A: Two engineers who built most of the system; both are busy and are asked everything.
- Q: Are there compliance needs? | A: Some decisions, such as rounding and retention rules, must be explainable later to people outside the team.

**Hints.**
1. Start where the cost of not writing was felt: the incident, the slow ramp or the unanswered question, and write that first.
2. Make the smallest useful format the default (a half-page decision record, a runbook entry tested in a drill) and attach it to work that already happens, such as code review.
3. Measure the effect in things the team cares about: time to recover, time for a new engineer's first change, questions sent to the two experts.

**Follow-ups.**
1. What are the first three documents you write or get written, and who writes each?
2. One of the two experts says writing things down is a waste of their time. What do you do?
3. Six months in, half the decision records are out of date. Is that a failure? What do you change?
4. How do you make sure the rounding rule and retention rule decisions survive the people who made them?
5. In your real example, what did you stop asking people to write, and why?

**Follow-up rules.**
- when: template, mandatory, policy → ask: The team already avoids an eleven-page template. Why will yours be different, and what is the smallest version that still works?
- when: wiki, confluence, notion → ask: The last wiki went stale in a year. What keeps these pages current without you policing them?
- when: adr, decision record, design doc → ask: Show me what one entry for the rounding rule would say, in five lines.
- when: runbook, playbook, drill → ask: Who has followed that runbook without its author in the room, and what changed after they did?
- when: we decided, the team decided, we agreed → ask: What did you personally write or change first?

**Evaluation Criteria.** Starts from the felt cost ({{trigger}}) and writes that first, often personally; small formats attached to existing work (decision records linked from pull requests, runbooks tested in drills, onboarding paths built by the newest engineer); engages the longest-serving engineers by reducing their interruptions and giving them authorship, not by mandate; keeps documents current through ownership and review dates, and accepts deleting what nobody uses; decisions that must be explained later (rounding, retention) recorded with context and alternatives; success measured in recovery time, ramp time and expert interruptions; real example with what changed and personal contribution, or honestly hypothetical.

## BLK-L5-03: Supporting a teammate going through a hard time during a critical launch

| | |
|---|---|
| **Template ID** | BLK-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | People leadership / care with privacy, redistributing work, honest launch risk |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "launch": ["instant transfers for sellers in a new country", "offline payments on a new card reader model", "a new instalment option at checkout"],
  "weeks": [2, 4, 6],
  "role": ["their technical lead", "their manager", "a peer on the same team"]
}
```

**Business Scenario.** Your team is {{weeks}} weeks from launching {{launch}}, with a date announced to sellers. You are {{role}}. A teammate who owns a critical part of the launch, the reconciliation checks that prove the numbers sellers see are right, has missed two standups, their work has slowed sharply, and in a one-to-one they tell you, briefly, that something difficult is happening in their life. They do not offer details, and they say they do not want the team to know.

**Problem Statement.** What do you do? Cover what you say and do in that conversation, what you do in the following days, how you handle their part of the launch without exposing what they told you, who else you involve and what you tell them, and how you decide whether the launch date is still safe. Then tell me about a real time you supported someone through a hard period while work had to continue, with what happened, or say that you have not and reason it through.

**Constraints.** Their privacy is theirs; you may not share what they told you without their agreement. The reconciliation checks must exist before launch. You are not a counsellor, and company support resources exist.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does the teammate want time off? | A: They have not said. They seem to want to keep working but cannot work as before right now.
- Q: Can someone else build the reconciliation checks? | A: One other engineer could, slowly, with the teammate's help or notes.
- Q: Does your manager know? | A: Not yet. If you are the manager, your own manager does not.
- Q: Is the date negotiable? | A: It has been announced to sellers; moving it is possible but costly and visible.

**Hints.**
1. In the conversation, listen, ask what would help and what they want shared, and point to the support available; do not ask for details they did not offer.
2. Separate the person from the plan: agree with them what changes in their work, then re-plan the launch with the team using only what they agreed to share.
3. Decide the launch question on the work, not on the person: what must exist, who can build it, and how much time remains.

**Follow-ups.**
1. What do you say in the first conversation, and what do you avoid saying?
2. The team asks why the work moved. What do you say?
3. Two weeks before launch, the reconciliation checks are still not done. What do you recommend, and to whom?
4. If you are not their manager, what is your role and what is not, and when do you involve the manager?
5. In your real example, what would you do differently?

**Follow-up rules.**
- when: hr, people team, employee assistance → ask: When do you involve those resources, and what do you tell the teammate before you do?
- when: tell the team, explain to the team, the team knows → ask: What exactly do you say to the team, and has your teammate agreed to it?
- when: deadline, launch date, delay → ask: Who decides whether the date moves, and what evidence do you bring them?
- when: take over, cover, reassign → ask: How do you move the work without signalling to the team that something is wrong with your teammate?
- when: check in, checking in, follow up → ask: How often, and how do you avoid making each check-in feel like a status report?

**Evaluation Criteria.** Leads the first conversation with care: listens, does not probe, asks what would help and what may be shared, points to company support and, where relevant, time-off options through the right channel; protects their privacy in every later conversation; re-plans the work openly on the work's merits (pairing, moving parts of the reconciliation checks, cutting scope that is not needed for launch) with the teammate's agreement; involves the manager or people team in the way that fits being {{role}}; decides the date on evidence about the work and escalates early if the checks that prove sellers' numbers are at risk; follows up over weeks without turning care into monitoring; real example with what they did personally and what they learned, or honestly hypothetical.

## BLK-L5-04: Learning a new domain fast after joining a payments team

| | |
|---|---|
| **Template ID** | BLK-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Ramp-up / domain learning, verifying understanding, early contribution without risk |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "background": ["advertising analytics", "game telemetry", "a hospital network's data warehouse"],
  "first_task": ["own the dashboard that tells sellers when their deposits will arrive", "explain why sellers' sales summaries and their deposits differ by a few cents on some days", "review a design for forwarding payments taken in offline mode"],
  "weeks": [3, 5, 8]
}
```

**Business Scenario.** You have joined a data team in a payments business as a senior engineer, coming from {{background}}. Words such as authorisation, capture, settlement, deposit, return, interchange, minor units and cut-off are used in every meeting, and most of the team has worked with payments for years. Your manager asks you to {{first_task}}, with a first result expected in {{weeks}} weeks.

**Problem Statement.** How would you get up to speed? Cover what you learn first and how, how you check that what you think you understand is right, who you learn from and how you avoid becoming a burden, how you deliver something useful within {{weeks}} weeks without making a mistake that costs sellers money, and what you bring from your previous domain. Then tell me about a real time you had to learn a new domain quickly, with what happened, or say that you have not and reason it through.

**Constraints.** Money is handled in integer minor units, and a mistake in what sellers are shown is visible to them at once. Your teammates are busy with their own commitments.

**Assumptions.** The situation and figures are hypothetical. Payment terms are used in their general industry sense.

**Clarifications.**
- Q: Is there documentation? | A: Some, of uneven quality, and parts of it describe how things worked two years ago.
- Q: Who is the expert? | A: One engineer knows deposits deeply and is often in meetings; finance and support also know a lot.
- Q: Can you look at real data? | A: Yes, aggregated data and test accounts, with the usual access controls.
- Q: Is anyone checking your work? | A: Code review, yes. Nobody will check your understanding unless you ask.

**Hints.**
1. Follow one payment end to end through the systems and the data, from tap to deposit, and write down what you see at each step.
2. Turn understanding into predictions you can check: if a sale happens at 23:55 on a Friday, which deposit includes it, and when does it arrive?
3. Ask experts to correct something you wrote rather than to explain from scratch; it costs them less and finds your gaps faster.

**Follow-ups.**
1. What do you do in your first week, day by day?
2. Your write-up of how deposits work has an error that an expert spots. How did you find out, and what do you change in how you learn?
3. What could you deliver within the first {{weeks}} weeks that helps, and what would you deliberately not touch yet?
4. What from {{background}} turned out to be useful, and what was misleading?
5. In your real example, how did you know you had understood the domain well enough?

**Follow-up rules.**
- when: read the code, read the docs, documentation → ask: Part of the documentation describes how things worked two years ago. How do you find out which part?
- when: shadow, pair, ask the expert → ask: The expert has thirty minutes a week for you. How do you spend them?
- when: glossary, write-up, notes → ask: Who checks your write-up, and what did the last correction teach you?
- when: float, decimal, rounding → ask: Show me how a few cents can appear between a day's sales summary and the deposit for it.
- when: quick win, ship, deliver → ask: What would make that quick win risky for sellers, and how do you make sure it is not?

**Evaluation Criteria.** A deliberate learning plan: one payment traced end to end in systems and data, a personal glossary and diagrams checked by experts, predictions tested against real (aggregated or test) data; respectful use of experts' time (corrections of written understanding, batched questions, learning from support and finance as well as engineers); an early contribution that is useful and safe (read-only analysis, tests, documentation fixes, a reviewed change behind checks) rather than a risky change to what sellers see; correct handling of money in minor units and awareness of cut-offs and settlement timing; honest about what transferred from the previous domain and what misled; real example with how they knew they understood, or honestly hypothetical.

## BLK-L5-05: Project deep dive, re-examined for payments for sellers and people, with offline-capable devices

| | |
|---|---|
| **Template ID** | BLK-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, minor units, late device data and seller-visible totals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["money in integer minor units end to end, with one stated rounding step", "payments taken offline and forwarded days later, counted once and in the right day", "the same totals in a seller's sales report and in their deposits", "people's and customers' data shown only in aggregates outside a seller's own view"],
  "scale": ["millions of sellers' devices", "tens of millions of people sending money to each other", "billions of payments a year"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for point-of-sale and peer-to-peer payments, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The payments setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a payments system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one payment: where it is created, which ids and amounts it carries, and which of them the new requirement constrains.

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
- when: late data, backfill, reprocess → ask: A device forwards three days of payments at once. Which reports change, and what does a seller see changing?
- when: dashboard, report, analytics → ask: Who outside the seller can see a single customer's payments in your design, and why?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example integer minor units in every schema with rounding at one named step; device-generated payment ids, per-device watermarks and dated restatements; one source of settled amounts feeding both the sales report and the deposit with a daily reconciliation; aggregates with minimum group sizes and per-seller views scoped to the seller); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
