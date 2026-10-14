# Spotify · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of an audio
streaming service for music, podcasts and audiobooks. Every situation is
hypothetical, and none describes any company's hiring process, its culture or
the values it assesses. Answer from your own experience, or say plainly that you
have not faced it and reason it through. Never invent a story.

## SPT-L5-01: Artists and podcasters ask for listener data you can only give in aggregate

| | |
|---|---|
| **Template ID** | SPT-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Saying no to a stakeholder / privacy limits, understanding the need, offering aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "requester": ["a large label's analytics team", "an independent podcast network", "a touring artist's management", "an audiobook publisher"],
  "ask": ["a list of the listeners in each city who played the new album, to invite them to shows", "the age and gender of every listener who finished each episode", "a daily export of every play of their catalogue with a listener id attached"],
  "minimum": [50, 100, 250],
  "pressure": ["a senior partnerships lead who has already said yes in a meeting", "a competitor that, they say, already gives them this", "a renewal of their agreement due next month"]
}
```

**Business Scenario.** Your team owns the data behind the analytics that artists, podcasters and publishers see. A request has come from {{requester}}: they want {{ask}}. Under this exercise's rules, listener data is shared with them only in aggregates, and a breakdown cell is shown only when it has at least {{minimum}} listeners. Adding to the pressure: {{pressure}}. The requester's underlying goal is reasonable: they want to understand and reach their audience.

**Problem Statement.** What do you do? Cover how you find out what they actually need, how you decide what you can and cannot provide, who else must be involved, how you say no to the part you cannot do and what you offer instead, how you handle the pressure without making it personal, and how you make sure the next similar request is easier for everyone. Then tell me about a real time you had to refuse or reshape a data request from someone important, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot change the aggregation rule on your own. The requester is important to the business. Any new product feature takes at least a quarter.

**Assumptions.** The situation, the rule and the figures are hypothetical.

**Clarifications.**
- Q: Is there a privacy or legal team? | A: Yes, and they review any new kind of data sharing; they are busy and respond in about a week.
- Q: Could listeners opt in to being contacted? | A: There is no such feature today. You could propose one.
- Q: Who told the requester yes? | A: If it was the partnerships lead, they did so without asking your team.
- Q: Have similar requests come before? | A: Several, each handled differently by whoever received it.

**Hints.**
1. Separate the goal from the requested data: "reach fans in a city" can be met without a list of who they are.
2. Get the decision made by the people who own the rule, and bring them options rather than only a refusal.
3. A repeated, inconsistent request is a sign the product or the policy needs a clear answer written down.

**Follow-ups.**
1. What questions do you ask the requester first, and what would change your answer?
2. What can you offer within the aggregation rule that meets most of their goal?
3. The partnerships lead tells you this account matters more than your concern. How do you respond?
4. Two breakdowns, each above {{minimum}} listeners, differ by a handful of people. Does that change what you are willing to provide?
5. In your real example, what did the relationship look like afterwards, and what changed in how such requests were handled?

**Follow-up rules.**
- when: legal, privacy team, compliance → ask: They take a week, and the requester wants an answer tomorrow. What do you say tomorrow?
- when: anonymise, anonymize, hash, pseudonymise → ask: The export keeps a hashed listener id per play. What can the requester still learn about one person over a year of plays?
- when: opt in, opt-in, consent → ask: That is a new feature. Who decides whether to build it, and what do you give the requester in the meantime?
- when: escalate, escalation, my manager → ask: What exactly do you put in front of the person you escalate to, and how do you present the requester's case fairly?
- when: we decided, the team decided, we agreed → ask: What did you personally say to the requester, and when?

**Evaluation Criteria.** Understands the underlying goal before answering; distinguishes what the rule forbids from what it allows and offers concrete aggregate alternatives (city-level counts above the minimum, cohort trends, in-product reach tools that never hand over identities); involves the rule's owners with options; says no clearly and early, without blaming the requester or the partnerships lead; addresses the pressure through the right decision makers; recognises re-identification risks in pseudonymised exports and differencing; turns a repeated request into a written policy or a product proposal; real example with personal actions and outcome, or honestly hypothetical.

## SPT-L5-02: A hack-week prototype everyone loves that must now become a product

| | |
|---|---|
| **Template ID** | SPT-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Prototype to production / scoping, hidden costs, saying what it really takes, ownership |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, data-engineer |

```params
{
  "prototype": ["a live view of which tracks are rising in each city this hour", "automatic chapter markers for podcast episodes", "a shared mix that blends two listeners' tastes into one playlist"],
  "weeks": [6, 10, 16],
  "shortcut": ["reads directly from a production database replica every minute", "runs on a schedule from one engineer's laptop", "has no tests and hard-coded lists of markets and catalogues"],
  "sponsor": ["a vice president who demoed it to the whole company", "the product lead for the home screen", "a group of artists who saw it at a showcase"]
}
```

**Business Scenario.** During a hack week, three engineers, one from your team, built {{prototype}}. It won the demo, and {{sponsor}} now wants it launched to all listeners in {{weeks}} weeks. You have been asked to lead turning it into a product. The prototype {{shortcut}}, works for a few markets, and nobody has measured what it costs to run at full scale. Two of its three builders have gone back to other teams.

**Problem Statement.** How do you lead it? Cover how you find out what the prototype really is and what launching it would take, how you present that honestly to the sponsor, what you would cut, keep or change to meet a date, who owns it after launch, how listeners' data and privacy are handled, and how you keep the energy that made the prototype good. Then tell me about a real time you took something built quickly into production, or argued that it should not go, with what happened, or say that you have not and reason it through.

**Constraints.** Your team has existing commitments. The prototype's builders can give a few hours a week. Whatever ships needs an on-call owner.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the date fixed? | A: The sponsor announced it informally; it can move with a good reason, but not easily.
- Q: Does the prototype handle personal data? | A: Yes, it reads listening history.
- Q: Will you get more people? | A: Possibly, if you make the case quickly.
- Q: Is there a launch process? | A: Yes: a privacy review, a load test and an on-call handover are required before launch.

**Hints.**
1. Estimate the real work: data sources, scale, failure handling, privacy review, on-call. Show it as a list the sponsor can read.
2. Offer options: a smaller launch on the date, or the full launch later, each with its risks.
3. Decide who owns it before you start building, not after it pages someone at night.

**Follow-ups.**
1. What do you do in the first week, and what do you know at the end of it?
2. The estimate is three times the time available. How do you present that to {{sponsor}}?
3. What would a smaller first launch look like, and what would make you comfortable shipping it?
4. The prototype's best idea depends on its shortcut (for example fresh data every minute). How do you keep the idea without the shortcut?
5. In your real example, what did the first version cost to run and operate compared with what you expected?

**Follow-up rules.**
- when: rewrite, from scratch, start over → ask: The sponsor hears "rewrite" as "the demo was fake". How do you explain it, and what parts of the prototype do you keep?
- when: mvp, minimum, smaller launch, phased → ask: What exactly is in the first launch, and what promise are you making about the rest?
- when: tech debt, technical debt, shortcut → ask: Which shortcut would you accept in the first launch, with what limit on its life?
- when: hire, headcount, more people → ask: People arriving in week three slow you down before they help. How does that change your plan?
- when: we decided, the team decided, we agreed → ask: What did you personally decide, and who disagreed?

**Evaluation Criteria.** Investigates the prototype first and produces a concrete, readable estimate (data sources, scale, cost, reliability, privacy review, load test, on-call); presents options with risks rather than a flat yes or no; protects the core idea while removing unsafe shortcuts (no reads from production replicas at scale, no laptop schedules, tests and market coverage); clear ownership and on-call before launch; listening data handled with review and minimisation; keeps the builders involved and credited; real example with outcome and personal contribution, or honestly hypothetical.

## SPT-L5-03: Becoming the lead of the team you were a peer on

| | |
|---|---|
| **Template ID** | SPT-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | New lead from within / changed relationships, expectations, first decisions, delegation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "team_size": [5, 8, 12],
  "context": ["a peer who also wanted the role stays on the team", "your closest friend at work is now someone you lead", "the previous lead left suddenly and the team is unsettled"],
  "owns": ["the play-event pipeline that most other teams depend on", "the data behind artist and podcaster analytics", "the batch jobs that generate personalised playlists"],
  "issue": ["an on-call rotation that two people carry most of", "a long-running disagreement about rewriting the main pipeline", "a stakeholder who goes around the team straight to individual engineers"]
}
```

**Business Scenario.** You have been a senior engineer on a team of {{team_size}} people that owns {{owns}}. You have just been named its technical lead, and {{context}}. You are still expected to do some hands-on work. Within your first month you must also deal with {{issue}}.

**Problem Statement.** How do you handle the first months? Cover how the relationships change and how you talk about it with the team, what you do in the first week and the first month, how you make your first contested decision, how you deal with the specific issue, how much hands-on work you keep and what you stop doing, and how you know whether it is going well. Then tell me about a real transition into a lead role, or a time you led peers without formal authority, with what happened, or say that you have not and reason it through.

**Constraints.** You are not anyone's line manager; people management stays with the engineering manager. The team's delivery commitments do not pause while you settle in.

**Assumptions.** The situation is hypothetical.

**Clarifications.**
- Q: How do I split work with the engineering manager? | A: The manager owns people matters and careers; you own technical direction and execution. The boundary is yours to agree with them.
- Q: Does the team know why you were chosen? | A: They were told, briefly. Some may have their own view.
- Q: Can I change how the team works? | A: Yes, within reason; changes that touch other teams need agreement.

**Hints.**
1. Name the change openly, early, and one-to-one, especially with anyone who wanted the role.
2. Listen before changing things, but do not wait so long that the issue grows.
3. Make the first contested decision through a visible process (options, criteria, input, a stated owner), not by personal authority.

**Follow-ups.**
1. What do you say, one to one, to the person most affected by your appointment?
2. Walk me through how you handle {{issue}} in your first month.
3. A former peer starts challenging every decision in team meetings. What do you do?
4. You were the team's strongest contributor on {{owns}}. What do you stop doing, and who takes it on?
5. In your real example, what did you get wrong in the first months, and how did you find out?

**Follow-up rules.**
- when: friend, friendship, close → ask: Your friend asks you, privately, which way you are leaning on a decision before the team has discussed it. What do you say?
- when: manager, engineering manager, my manager → ask: Where exactly is the line between your role and the manager's on {{issue}}, and who agreed it?
- when: vote, consensus, everyone agreed → ask: Consensus does not come. Who decides, and how does the team know that in advance?
- when: delegate, delegation, hand over → ask: The person you delegated to is slower than you and the work is late. What do you do?
- when: we decided, the team decided, we agreed → ask: What was your own call in that, and what did it cost you?

**Evaluation Criteria.** Acknowledges the changed relationships openly and early, especially with the peer who wanted the role; listens before changing things but acts on the urgent issue with a clear, visible decision process; agrees the boundary with the engineering manager; handles challenge in private first and respectfully; delegates deliberately and lets go of being the strongest contributor; measures how it is going (feedback, delivery, on-call load, retention); real transition example with personal actions, mistakes and changes, or honestly hypothetical.

## SPT-L5-04: The team's charter changes mid-year and half the roadmap no longer fits

| | |
|---|---|
| **Template ID** | SPT-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Re-planning after a reorganisation / stopping work, commitments to others, morale |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "old_charter": ["music listening analytics", "podcast ingestion and analytics", "the shared play-event platform"],
  "new_charter": ["data for audiobooks, a newer product line with its own catalogue and plans", "the data behind creator tools for podcasters and artists", "company-wide metric definitions and the data quality checks behind them"],
  "months": [4, 5, 6],
  "commitments": [3, 5, 7]
}
```

**Business Scenario.** Your team's charter changes halfway through the year, from {{old_charter}} to {{new_charter}}. About half of the planned roadmap no longer fits. The team has made {{commitments}} commitments to other teams that are in progress, some of them half built. {{months}} months of the year are left. Some engineers joined the team for the old work and are unsettled. You are the technical lead and have been asked to bring a new plan within two weeks.

**Problem Statement.** How do you lead it? Cover how you decide what stops, what continues and what is handed to another team; how you deal with the in-flight commitments and the teams depending on them; how you shape the new roadmap with incomplete knowledge of the new area; how you communicate with the team, with dependent teams and with leadership; and how you look after the people who joined for the old work. Then tell me about a real time a team's direction changed under you, with what happened, or say that you have not and reason it through.

**Constraints.** Headcount does not change. Nobody has yet been named to take over the old charter's systems. Leadership expects early progress on the new charter this quarter.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the old systems still running? | A: Yes, with users; someone has to own them.
- Q: Can commitments be renegotiated? | A: Yes, with the teams that depend on them, and some will be unhappy.
- Q: Is the new charter well defined? | A: Only at the level of a short paragraph from leadership.

**Hints.**
1. List every commitment and system with its users and the cost of stopping it; make the stop, finish or hand over choice per item, in writing.
2. Ownership of the old systems is the first thing to settle; running systems with no owner become incidents.
3. Learn the new area quickly from its users and data before committing to a long roadmap; plan the first quarter in detail and the rest loosely.

**Follow-ups.**
1. Walk me through how you decide, for each of the {{commitments}} commitments, whether to finish, stop or hand it over.
2. A dependent team says stopping your commitment breaks their launch. What do you do?
3. Nobody will take the old systems. What do you propose to leadership?
4. How do you build a credible plan for {{new_charter}} in two weeks when you barely know the area?
5. In your real example, who did you lose or nearly lose, and what would you do differently?

**Follow-up rules.**
- when: hand over, handover, transfer → ask: The receiving team has no capacity and no knowledge of the system. What does a handover that actually works include?
- when: stop, cancel, drop → ask: What does stopping cost the team that depended on it, and who tells them?
- when: morale, motivation, unsettled → ask: One engineer says they will leave if they cannot keep working on the old area. What do you do?
- when: okr, roadmap, quarterly plan → ask: Leadership's paragraph is vague. How do you check your roadmap is what they meant before you commit to it?
- when: we decided, the team decided, we agreed → ask: Which of those calls did you personally make, and who disagreed?

**Evaluation Criteria.** Makes an explicit, written inventory of commitments and systems with users and costs; decides stop, finish or hand over per item with dependent teams consulted early and told directly; settles ownership of running systems before anything else; learns the new area from users and data and plans the near term concretely; keeps leadership, the team and dependents informed with honest trade-offs; looks after people individually, including those who joined for the old work; real example with personal actions and outcome, or honestly hypothetical.

## SPT-L5-05: Project deep dive, re-examined for audio streaming with personalised and editorial surfaces

| | |
|---|---|
| **Template ID** | SPT-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, consistency between surfaces, late data |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["personalised surfaces refreshed for every listener daily while editorial changes appear within minutes", "numbers shown to artists that always match the listener-facing yearly summaries", "plays from offline devices arriving up to 30 days late without silently changing published charts", "one listener's activity across phone, speaker and car counted once"],
  "listeners": ["millions", "tens of millions", "hundreds of millions"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it served an audio streaming service with {{listeners}} of listeners, mixing personalised surfaces (generated per listener) with editorial ones (chosen by people), and its users required {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes if the system had to meet {{requirement}} in that setting. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The audio streaming setting is hypothetical. Any ranking or recommendation in it is a scoring function you are given; you are not asked to design one.

**Clarifications.**
- Q: Does it have to be a media or recommendation system? | A: No. Any system that moved, stored or computed data others depended on; the streaming setting is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, freshness, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the streaming-service question, start from which numbers or surfaces must agree with each other, and how fresh each must be.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design assume one freshness for everything? What breaks first when personalised and editorial surfaces need different freshness?
4. How would you meet "{{requirement}}" without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: kafka, flink, spark, airflow, beam → ask: Why that over the obvious alternative, and what did it cost you?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: late data, late events, backfill, restatement → ask: A number already shown to users changes after late data arrives. What do they see, and who is told?
- when: cache, cached, precompute, precomputed → ask: Something changes upstream after you precomputed it. How long until users see the change, and who decided that was acceptable?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible analysis of {{requirement}} in the streaming setting (for example separate batch and low-latency paths with a merge at serving time, one shared metric definition used by every surface, versioned restatements instead of silent edits, identity resolution across devices with a stable listener key) that treats ranking as a given scoring function; own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
