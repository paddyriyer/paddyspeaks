# LinkedIn · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a professional
network: members and their profiles, connections, jobs and recruiters, creators,
learning and company pages. Every situation is hypothetical, and none describes
any company's hiring process, its culture or the values it assesses. Answer from
your own experience, or say plainly that you have not faced it and reason it
through. Never invent a story.

## LNK-L5-01: A feature request that would infer something members never chose to share

| | |
|---|---|
| **Template ID** | LNK-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Responsible data use / saying no well, reshaping a request, decision rights |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer, software-engineer |

```params
{
  "request": ["a score of how likely each member is to be looking for a new job, inferred from their activity and shown to recruiters", "an estimate of each member's current salary, inferred from title, location and tenure and shown to recruiters searching for candidates", "a flag on members likely to leave their employer soon, offered to that employer's own talent team"],
  "requester": ["a product director with a launch planned next quarter", "the sales team, on behalf of a large customer", "your own manager, who has already mentioned it to leadership"],
  "weeks": [4, 8, 12]
}
```

**Business Scenario.** Your team owns the data pipelines and features built from member activity on a professional network: profile edits, job views, applications, searches, connections and message metadata. Members can already state some things about themselves, such as that they are open to new roles, and choose who sees that. You receive a request from {{requester}}: build {{request}}. The requester has a business case and wants it live in {{weeks}} weeks. Members have not chosen to share this, and most would not expect it to be computed about them.

**Problem Statement.** How do you respond? Cover how you understand the goal behind the request, how you assess the harm to members if the inference is right, if it is wrong, and if it leaks, who else must be involved and who decides, what you propose instead, and how you communicate your position to the requester and to your own team. Then tell me about a real time you pushed back on, or reshaped, a request to use data in a way the people it described would not expect, or say that you have not and reason it through.

**Constraints.** You do not own the product decision or the privacy policy. The pipeline could technically compute the inference in a few weeks. The requester's goal is legitimate: recruiters want to reach people who are open to being reached.

**Assumptions.** The situation is hypothetical. Nothing here describes any company's real products, models or policies.

**Clarifications.**
- Q: Is the inference legal? | A: You do not know; the privacy and legal teams would need to review it. Legal is not the same as acceptable to members.
- Q: Would members be able to see or correct it? | A: The request does not say. It assumes they would not see it.
- Q: How accurate would it be? | A: Nobody has measured it. A quick prototype by an analyst suggests it is right more often than chance, with many errors.
- Q: Is there already a way for members to state this? | A: For job-seeking, yes; for salary and leaving intent, only partly.

**Hints.**
1. Separate the goal (what the requester actually needs) from the proposed means (an inference about members).
2. Think about who is harmed by a wrong inference, and who by a right one shown to the wrong person.
3. A good "no" usually comes with a better "yes": something that serves the goal with members' choice built in.

**Follow-ups.**
1. Walk me through your first conversation with the requester. What do you ask before you say anything about the request itself?
2. Who must be involved in the decision, in what order, and what do you bring them?
3. The requester says competitors already do this and the launch is committed. What do you do?
4. What alternative would you propose, and how would you show it serves the same goal?
5. In your real example, what did you personally do, and what happened to the working relationship?

**Follow-up rules.**
- when: opt-in, consent, choose → ask: Most members will never opt in. The requester says that makes the feature worthless. What do you answer?
- when: legal, privacy team, compliance → ask: The privacy review says it is allowed with a notice in the policy. Is that the end of the question for you?
- when: anonymised, anonymized, aggregate, aggregated → ask: The recruiter needs to reach individual people. Which part of the goal does an aggregate still serve?
- when: refuse, say no, reject → ask: The requester escalates to your director, who asks why the team is blocking revenue. What do you put in front of the director?
- when: we decided, the team decided, we agreed → ask: What did you personally decide or say, and to whom?

**Evaluation Criteria.** Starts from the goal and asks questions before judging; assesses harm concretely (wrong inferences, correct inferences shown to the wrong audience, especially an employer, leaks, members' expectations) rather than only legality; brings in product, privacy and legal owners with clear facts and respects decision rights; proposes alternatives that serve the goal with members' choice (member-stated signals, controls on who sees them, aggregates for planning); communicates a firm position respectfully, with evidence, and escalates fairly if needed; real example with personal contribution and outcome, or honestly hypothetical.

## LNK-L5-02: An engineer on the team who is underperforming

| | |
|---|---|
| **Template ID** | LNK-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | People leadership / feedback, expectations, support, fairness to the team |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "symptom": ["pull requests that sit for weeks and come back with the same review comments each time", "on-call incidents in the job-alert pipeline that teammates have had to re-handle after the hand-off", "estimates missed by a factor of three on every task this quarter, discovered only at the deadline"],
  "your_role": ["the engineer's manager", "the team's tech lead, not the engineer's manager"],
  "tenure": ["eight months", "four years"]
}
```

**Business Scenario.** You work on a team that runs the pipelines behind job alerts and job recommendations on a professional network. One engineer, on the team for {{tenure}}, has been struggling for about two months: {{symptom}}. Teammates have started working around them and one has complained to you privately. You are {{your_role}}. The engineer has not raised anything with you.

**Problem Statement.** How do you handle it? Cover how you check what is actually happening before you act, the first conversation (what you say, what you ask, what you avoid), how you set clear expectations and support, how you keep the rest of the team working well meanwhile, what you do if things do not improve, and who else you involve and when. Then tell me about a real time you helped someone who was struggling at work, or say that you have not and reason it through.

**Constraints.** The engineer's work is needed for a commitment due next month. You may not share the engineer's situation with the rest of the team. If you are not the manager, you have no formal authority over the engineer's performance review.

**Assumptions.** The situation is hypothetical. There may be causes you do not know about.

**Clarifications.**
- Q: Has the engineer had good reviews before? | A: Yes; their work was solid until recently.
- Q: Does the engineer know there is a problem? | A: Probably in part; nobody has said it to them directly.
- Q: Is there a formal performance process? | A: Yes, run by managers with people-team support; it is not the first step.
- Q: Is the complaint from the teammate fair? | A: Partly; it is also frustrated and second-hand.

**Hints.**
1. Gather specific, recent examples first; feedback without examples is opinion.
2. In the first conversation, ask before you tell: there may be a reason you do not know, and it is theirs to share or not.
3. Clear expectations, support and a check-in date belong together.

**Follow-ups.**
1. What exactly do you say in the first five minutes of the conversation?
2. The engineer tells you about a difficult personal situation. What changes, and what does not?
3. Six weeks later, there is little improvement. What do you do next, and who do you involve?
4. How do you protect next month's commitment without making the engineer's situation visible to the team?
5. In your real example, what did you do that helped, and what would you do differently?

**Follow-up rules.**
- when: hr, people team, performance plan, pip → ask: Why involve them at that point rather than earlier or later, and what do you still own yourself?
- when: reassign, move them, take over → ask: What does reassigning the work tell the engineer and the team, and how do you say it?
- when: feedback, example → ask: Give me one piece of feedback exactly as you would say it to them.
- when: personal, health, family → ask: How do you support them without asking for details they have not offered, and without lowering the bar for everyone?
- when: we decided, the team decided, we agreed → ask: What did you personally say or do?

**Evaluation Criteria.** Gathers specific evidence before acting and separates it from second-hand complaints; holds a private, direct and respectful first conversation that asks before telling and does not speculate about personal causes; sets clear, measurable expectations with support and a check-in date; adapts fairly to personal circumstances (time, scope, available support) without lowering the bar indefinitely; keeps the team and the commitment healthy without exposing the engineer; involves the manager or people team at the right time and acts within their role; real example with what helped and what they learned, or honestly hypothetical.

## LNK-L5-03: Raising a risk your manager does not want to hear

| | |
|---|---|
| **Template ID** | LNK-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Upward communication / risk evidence, options, escalation without surprise |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "risk": ["the new recruiter candidate-search index cannot meet its latency target at the launch's expected load", "the member data export built for privacy requests misses two downstream stores that hold member data", "the migration of profile history will not finish before the old store's support contract ends"],
  "weeks": [3, 6, 10],
  "manager_state": ["has just told leadership the work is on track", "is new and under pressure to show quick wins", "has twice said 'let's not raise problems without solutions'"]
}
```

**Business Scenario.** You lead the technical work on a project for a professional network that is due in {{weeks}} weeks. You have found that {{risk}}. You raised it informally with your manager, who {{manager_state}}. Their response was that it would probably work out and that you should keep going. You believe the risk is real and that the longer it goes unspoken, the fewer options the team will have.

**Problem Statement.** What do you do? Cover how you make the risk concrete and checkable, how you prepare options rather than only a problem, how you raise it again with your manager, when and how it goes further if your manager still disagrees, and how you keep the working relationship. Then tell me about a real time you raised a risk that someone above you did not want to hear, or say that you have not and reason it through.

**Constraints.** Your manager decides what is reported to leadership. You are not willing to stay silent about something that could harm members or the launch. Other teams depend on the date.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: How sure are you? | A: You have a test or analysis that shows it, but it rests on assumptions someone could challenge.
- Q: Is there any way to still meet the date? | A: Possibly, with reduced scope or more people; you have not costed either.
- Q: Who else knows? | A: One engineer on your team who helped with the analysis.
- Q: Is there a regular forum where risks are reported? | A: A weekly status review; your manager presents it.

**Hints.**
1. Turn a worry into evidence: what you measured, the assumption it depends on, and how you would know if you are wrong.
2. Bring options with costs (cut scope, add people, move the date, accept the risk with a mitigation) and a recommendation.
3. Going above your manager is sometimes right; doing it without telling them almost never is.

**Follow-ups.**
1. How would you present the risk to your manager the second time, and what is different from the first?
2. Your manager still says to keep going. What do you do next, and how do you tell them?
3. What is the difference for you between a risk to the date and a risk to members, and does it change what you do?
4. The risk materialises two weeks before the launch. What do you do, and what do you say about the earlier conversations?
5. In your real example, how did you raise it, what happened, and what did it do to the relationship?

**Follow-up rules.**
- when: escalate, skip level, go above, director → ask: Does your manager know you are doing that? What exactly do you tell them beforehand?
- when: benchmark, load test, analysis, measured → ask: Your manager challenges the main assumption behind your analysis. How do you settle it quickly?
- when: option, trade-off, tradeoff, scope → ask: Which option would you recommend, and what does it cost the people who depend on the date?
- when: document, email, write it down → ask: How do you write it down so it informs rather than reads as covering yourself?
- when: we decided, the team decided, we agreed → ask: What did you personally say, to whom, and when?

**Evaluation Criteria.** Makes the risk concrete with evidence and stated assumptions; brings options with costs and a recommendation; raises it again with the manager directly and constructively, acknowledging their pressures; distinguishes risks to members (privacy, correctness) from risks to a date and escalates the former without delay; escalates beyond the manager only transparently, telling the manager first, through a legitimate forum; records the risk in writing in a way that helps decisions; keeps the relationship intact and supports the decision once made unless it harms members; real example with personal actions and outcome, or honestly hypothetical.

## LNK-L5-04: A high-visibility new project versus finishing an important, unglamorous one

| | |
|---|---|
| **Template ID** | LNK-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prioritisation / finishing work, opportunity cost, team motivation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer, ml-platform-engineer |

```params
{
  "new_project": ["a writing assistant for recruiters' outreach messages, with a launch demo already planned", "a new analytics dashboard for creators that leadership wants to show at a public event", "a skills-based job matching prototype that two directors are excited about"],
  "unglamorous": ["the migration that lets a member's account deletion reach every derived table", "retiring the fragile job-ingestion pipeline that pages the team every week", "the backfill that makes skills trend reports comparable across taxonomy releases"],
  "remaining": ["six weeks", "three months"]
}
```

**Business Scenario.** Your team on a professional network is {{remaining}} of work away from finishing {{unglamorous}}. Nobody outside the team asks about it, but it matters: members, on-call engineers or report readers depend on it. You are now offered the chance to lead {{new_project}}. It would need most of the team, it is highly visible, and several engineers are excited about it. If the team takes it, the unfinished work stops.

**Problem Statement.** How do you decide, and how do you lead the team through the decision? Cover how you weigh the cost of stopping the unfinished work (including what happens to it half done), how you test whether the new project really needs the team now, what options sit between all or nothing, how you present the choice to the people who offered the project, and how you keep the team motivated whichever way it goes. Then tell me about a real time you chose between visible new work and finishing something important, or say that you have not and reason it through.

**Constraints.** You cannot staff both at full speed. Your manager will support either choice if it is well argued. Half-finished migrations and backfills have costs of their own.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the new project's date fixed? | A: The demo date is; what must be ready by then is negotiable.
- Q: What does the unfinished work protect? | A: Say what you think it protects in your setting; the scenario names the work, not its exact consequences.
- Q: How does the team feel? | A: Some engineers want the new project; the two who know the unfinished work best want to finish it.
- Q: Could another team take one of them? | A: Possibly, with a hand-off cost.

**Hints.**
1. Write down what each option costs and what it protects, including the cost of leaving work half done.
2. Ask what the new project needs by its date, not what it could use.
3. Options between all or nothing (a small team for the new work, a finish-first plan with a date, a hand-off) are usually better than either extreme.

**Follow-ups.**
1. How would you estimate the cost of pausing the unfinished work for three months?
2. What would you say to the directors who offered the project if your recommendation is to finish first?
3. The engineers who want the new project are disappointed by your decision. What do you do?
4. You split the team, and both pieces of work slip. What do you change?
5. In your real example, what did you decide, what did it cost, and would you choose the same again?

**Follow-up rules.**
- when: split the team, in parallel, both projects → ask: Which work slips when both are under-staffed, and who did you tell in advance?
- when: finish first, finish it → ask: The demo goes ahead without your team and goes badly. What do you say?
- when: hand off, hand-off, another team → ask: What does the receiving team need in order to own the unfinished work safely, and how long does that take?
- when: visibility, promotion, career → ask: How do you make the unglamorous work visible and valued for the engineers who stay on it?
- when: we decided, the team decided, we agreed → ask: What did you personally recommend, and to whom?

**Evaluation Criteria.** Quantifies what the unfinished work protects and the cost of pausing it (risk, toil, half-migrated state), not only its remaining effort; tests what the new project truly needs by its date; considers options between all or nothing and states their costs; recommends clearly and explains it to the sponsors with evidence; leads the team through the decision, addressing disappointment and making the less visible work valued; real example with the decision, its cost and lessons, or honestly hypothetical.

## LNK-L5-05: Project deep dive, re-examined for a professional network of members, recruiters and companies

| | |
|---|---|
| **Template ID** | LNK-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, redesign for member-controlled visibility |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "angle": ["the data model and why it held up", "the hardest correctness problem you solved", "the most important reliability decision you made"],
  "members": ["50 million", "300 million", "1 billion"],
  "requirement": ["each member's visibility settings decide who may see each field", "a member's account deletion reaches every derived table and search index", "recruiters see a member only as that member allows", "figures about companies are released only for groups above a minimum size"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if its data described {{members}} members of a professional network, read by three audiences with different rights (members themselves, recruiters and companies), and it had to guarantee that {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the data described {{members}} members and the system had to guarantee that {{requirement}}: where the rule is enforced, what each audience can read, what derived data must change, and how you would show the guarantee holds. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The professional-network setting is hypothetical and describes general techniques, not how any company builds its systems.

**Clarifications.**
- Q: Does it have to be a data system? | A: It should move, store or compute data that others depend on; a service with a significant data model counts.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: Do I need to know privacy law? | A: No. Reason about who may see what, where that is enforced and how you would test it.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the requirement, follow the data from where it is written to every place it is copied, indexed or aggregated; each copy is a place the rule must hold.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Where in your system would you enforce the guarantee that {{requirement}}, and what happens to copies made before a member changes their mind?
4. How would you test that guarantee continuously, not just once?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: cache, replica, copy, copies, index → ask: A member changes a setting. How long until every copy in your design respects it, and how do you know?
- when: anonymised, anonymized, hashed, anonymous → ask: Could someone with your output and one public profile re-identify a member? How do you know?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: access control, permissions, acl → ask: Is the check made where the data is read, or where it is copied? What happens to an export made yesterday?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a credible redesign for the requirement that follows data into every copy, index and aggregate, enforces the rule at read time and at copy time, handles changes of mind and deletions with propagation and verification, and recognises that hashing is not anonymisation; a way to test the guarantee continuously; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
