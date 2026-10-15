# TikTok · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a short-video
service: creation and the in-app editor, sounds, captions and translations,
comments, LIVE, creator programmes, well-being settings and moderation. Every
situation is hypothetical, and none describes any company's hiring process, its
culture or the values it assesses. Answer from your own experience, or say plainly
that you have not faced it and reason it through. Never invent a story.

## TTK-L5-01: Protecting the well-being of a team whose work exposes them to distressing reports

| | |
|---|---|
| **Template ID** | TTK-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | People leadership / exposure to distressing material, workload, support, delivery under pressure |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "team_size": [5, 8, 12],
  "trigger": ["two engineers spent three days opening reported items one by one to find the cause of a queue incident", "an engineer quietly asked to stop working on the moderation tooling, and said others feel the same", "the moderation programme announced a launch that will double, within a quarter, the number of reported items your pipelines and tools handle"],
  "weeks": [4, 8, 12]
}
```

**Business Scenario.** You lead a team of {{team_size}} engineers who build the data pipelines and tools behind moderation: report intake, queues, the reviewers' tooling and the metrics on decisions. The team is not a reviewing team, but debugging, testing and labelling problems sometimes mean opening reported items, and nothing limits how often. Recently, {{trigger}}. A major delivery for the moderation programme is due in {{weeks}} weeks.

**Problem Statement.** What do you do? Cover the first conversations you have, how you reduce how much distressing material your team sees without stopping the work, what support you put in place and how people can use it without it counting against them, how you change the team's tools and practices (for example, what engineers can do without opening items at all), how you handle the delivery date, and how you will know whether things are better. Then tell me about a real time you looked after a team's well-being under pressure, with what happened, or say that you have not and reason it through. Describe processes and practices only; no example of content is needed or wanted.

**Constraints.** The delivery date matters to the moderation programme, and moving it has a cost to other teams. You are not a clinician. Support must be available to people who do not want their manager to know they are using it.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Does the company offer support services for this kind of work? | A: Assume a general employee support service exists; specialised support for this work is something you could ask for.
- Q: Can engineers work on synthetic or masked data instead? | A: For most debugging, in principle yes; nobody has built it.
- Q: Has anyone said they are struggling? | A: One person has said they are tired; nobody has said more, and you do not know how others feel.
- Q: Who else needs to agree to changes? | A: The moderation programme's leads for anything that changes the delivery, and the security and privacy teams for changes to who can open items.

**Hints.**
1. Treat exposure as something you can measure and design down, like any other risk: who opens items, how often, and why.
2. Separate what needs a decision from you this week from what needs tooling over months.
3. Support works when using it is normal and private; make the team's practices model that, starting with you.

**Follow-ups.**
1. What do you say in the first one-to-one conversations, and what do you avoid saying?
2. Which work can be done without opening a reported item, and what would you build to make that possible?
3. The delivery is at risk because you have reduced exposure. How do you make the case to the programme's leads?
4. How would you measure whether the changes helped, without asking people to disclose more than they want?
5. In your real example, what did you get wrong at first, and what changed afterwards?

**Follow-up rules.**
- when: rotation, rotate, shifts → ask: Your two most experienced engineers are the ones who can debug the queue fastest. Does rotation apply to them too, and what does it cost the delivery?
- when: survey, check-in, pulse → ask: Someone answers that they are fine but you see signs they are not. What do you do, and what do you not do?
- when: synthetic data, masked, masking, blur → ask: A bug only reproduces on a real reported item. Who may open it, under what rules, and who knows it happened?
- when: deadline, push back, delay → ask: The programme's leads say the date cannot move. What scope do you cut, and who decides?
- when: we decided, the team decided, we agreed → ask: Which decision did you personally make, and how did you tell the team?

**Evaluation Criteria.** Listens first and privately, without probing for detail or diagnosing; treats exposure as a measurable risk and designs it down (access only when needed and logged, masked or synthetic data for debugging and tests, tools that show metadata instead of items, limits and rotation that apply to everyone); puts in place support people can use privately and normalises it; brings the delivery trade-off to the programme's leads with evidence and a scope proposal; measures outcomes in aggregate without forcing disclosure; describes processes only; real example with what changed and personal contribution, or honestly hypothetical.

## TTK-L5-02: A launch that must work in dozens of languages on day one

| | |
|---|---|
| **Template ID** | TTK-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Launch leadership / localisation, per-language quality bars, go/no-go, cross-team coordination |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer, ml-platform-engineer |

```params
{
  "feature": ["auto-generated captions that creators can edit", "comment filters creators set by keyword", "translated video descriptions on request", "a new in-app editor with text effects"],
  "languages": [25, 40, 60],
  "weeks": [6, 10, 16],
  "gap": ["right-to-left scripts have never been tested in the pipeline", "quality has been measured for only five languages", "half the languages have so little test data that no metric is stable"]
}
```

**Business Scenario.** The launch of {{feature}} is planned for {{languages}} languages on the same day, {{weeks}} weeks from now, and the date has been announced to creators. You lead the data and engineering work behind it: the pipelines, the quality measurement and the launch metrics. Today, {{gap}}. Localisation, product, and regional teams in several time zones each own part of the launch.

**Problem Statement.** How would you lead it? Cover how you find out what "works" means for each language, how you measure quality where data is thin, what you build or test first, how you coordinate teams across time zones, what decides whether each language launches on the day, and what you monitor after launch. Then tell me about a real launch you led or worked on that had to work across many languages, markets or locales, with what happened, or say that you have not and reason it through.

**Constraints.** The date is public. Launching a language that works badly harms creators who rely on it. You cannot hire speakers of every language in {{weeks}} weeks, but regional teams can help.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Can some languages launch later? | A: Yes, if you make the case. Product prefers all on the day.
- Q: Who judges quality in a language nobody on the team speaks? | A: Regional teams and contracted reviewers can, if you give them a clear method and enough of their time.
- Q: Are there language-specific rules? | A: Some: scripts written right to left, languages without spaces between words, and different number and date formats.
- Q: Is there a fallback when a language is not ready? | A: The feature can be hidden per language with a switch.

**Hints.**
1. Write the quality bar per language before measuring anything, and make it the same shape for every language even if the numbers differ.
2. Find the classes of language that break things (script direction, word segmentation, character sets) and test one of each first.
3. Decide in advance, per language, what launches, what waits, and who signs off.

**Follow-ups.**
1. How do you measure quality for a language with very little test data, and how confident can you be?
2. Two weeks before launch, eight languages are below the bar. What do you recommend, and how do you present it?
3. How do you run a launch day across teams in many time zones without one person awake for 24 hours?
4. After launch, one language's creators turn the feature off at three times the rate of others. What do you do?
5. In your real example, which language or market surprised you, and what did you change afterwards?

**Follow-up rules.**
- when: machine translation, translate, translation → ask: Who checks that a translated test set measures the same thing as the original, and how?
- when: metric, accuracy, error rate → ask: The metric is fine for one language but creators there complain. What is your metric missing?
- when: phased, staged, rollout, gradual → ask: The date was announced for all {{languages}} languages. How do you explain a phased launch to the creators who wait?
- when: feature flag, kill switch, switch → ask: Who can turn off one language at 3 a.m. their time, and what tells them to?
- when: we decided, the team decided, we agreed → ask: Which call did you personally make, and what did it cost?

**Evaluation Criteria.** Defines a per-language quality bar of the same shape before measuring; finds the classes of language that break pipelines (script direction, segmentation, character sets, formats) and tests one of each early; measures quality with stated confidence where data is thin, using regional teams with a clear method; coordinates across time zones with owners and handoffs; decides per language with criteria set in advance, recommends a phased launch honestly where needed and explains it to creators; monitors per-language signals after launch with a switch per language; real example with what changed and personal contribution, or honestly hypothetical.

## TTK-L5-03: Keeping data quality when the product changes every week

| | |
|---|---|
| **Template ID** | TTK-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Data quality leadership / event contracts, release cadence, ownership, prevention over detection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "teams": [6, 12, 25],
  "breakages": [3, 5, 8],
  "symptom": ["a creator-facing metric dipped for two days after an app release renamed an event field", "a LIVE metric doubled after a client started sending an event twice on reconnect", "upload success rates were wrong for a week because a new app version added a step that nobody mapped"],
  "authority": ["you lead the data platform team", "you are a senior engineer on the analytics team with no authority over the app teams", "a director has given you a quarter to fix this"]
}
```

**Business Scenario.** The app ships a new version every week. {{teams}} product teams add and change the events their features send. Last month, {{breakages}} metrics were wrong for at least a day after releases; the latest: {{symptom}}. Each time, the data team found out from someone downstream, and fixed it by hand. In this situation, {{authority}}. The product teams' priority is shipping, and they see data checks as something that slows them down.

**Problem Statement.** How would you change this? Cover how you find where breakages come from, what you change so they are caught before release rather than after, who owns an event and its definition, how you make the change cheap for product teams, what you measure to know it is working, and how you get teams to adopt it. Then tell me about a real time you improved data quality in a fast-changing product, with what happened, or say that you have not and reason it through.

**Constraints.** The weekly release cadence does not change. You cannot block releases on your own authority. The fixes must not need a data engineer in every product team.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is there a schema for events today? | A: Loosely: a shared document that is out of date.
- Q: Do product teams test their events? | A: Some check that an event fires; none check its fields or its counts.
- Q: Who notices broken metrics now? | A: Usually an analyst or a creator support team, days later.
- Q: Is there budget for tooling? | A: Some, if you can show what it saves.

**Hints.**
1. Classify the last few breakages by cause. The fix for a renamed field is different from the fix for a duplicated event.
2. Move checks to where the change is made: the event definition and the app's tests, not the warehouse.
3. Make the safe path the easy one for product teams; adoption follows convenience more than mandates.

**Follow-ups.**
1. What did your classification of the breakages show, and which fix comes first?
2. How do you define ownership of an event so that a change cannot ship without its owner knowing what depends on it?
3. A product team says your new check delayed their release by a day. What do you do?
4. What would you measure to show leadership that quality improved, and how long before you could tell?
5. In your real example, what did teams resist, and how did you change your approach?

**Follow-up rules.**
- when: data contract, schema registry, contract → ask: A team needs to rename a field this week for a launch. What does your contract let them do, and what happens to the dashboards that read the old name?
- when: anomaly detection, monitoring, alert → ask: Your alert fires two days after release, like the analysts did. What would catch it before release?
- when: block, blocking, gate → ask: You cannot block releases. How does your check stop a breaking change without that authority?
- when: dedupe, deduplicate, duplicate → ask: Deduplication downstream hides the client bug. Who finds out the client sends events twice, and how?
- when: we decided, the team decided, we agreed → ask: What did you personally build or change, and what did others do?

**Evaluation Criteria.** Diagnoses breakages by cause before prescribing; moves checks to where changes are made (event definitions in code, schema validation and count checks in app tests and pre-release builds) rather than only downstream monitoring; defines ownership with a lineage of who depends on each event and a compatible-change policy (add, deprecate, then remove); makes the safe path easy for product teams and earns adoption without blocking authority; measures quality (breakages per release, time to detect, metrics wrong per month) and shows the trend; real example with what changed and personal contribution, or honestly hypothetical.

## TTK-L5-04: Another team presents your team's work as its own

| | |
|---|---|
| **Template ID** | TTK-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team relationships / credit, recognition for the team, direct conversation, escalation judgement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer |

```params
{
  "work": ["the pipeline that made upload success visible per app version for the first time", "the sound-licence checks that stopped videos playing sounds after their licence ended", "the creator rewards restatement process that fixed months of support tickets"],
  "venue": ["an all-hands presentation", "a quarterly review with senior leadership", "a written launch announcement sent to the whole organisation"],
  "who": ["a partner team you depend on for the next quarter", "a team whose lead is your manager's peer", "a team that contributed a small part of the work"]
}
```

**Business Scenario.** Your team spent a quarter building {{work}}. In {{venue}}, {{who}} presented the result as their own work, without mentioning your team. Two of your engineers saw it and are upset; one of them wrote most of the code and is hoping for a promotion this cycle. You need that other team's cooperation for next quarter's plan.

**Problem Statement.** What do you do? Cover what you do first, how you find out whether it was deliberate or an oversight, how you raise it with the other team, what you do for your own engineers, whether and how you involve your manager, and how you make sure your team's work is visible in future. Then tell me about a real time credit for your or your team's work went elsewhere, or you saw it happen to someone else, with what happened, or say that you have not and reason it through.

**Constraints.** You need the other team next quarter. The promotion decision is not yours alone. The presentation cannot be undone.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Did the other team contribute anything? | A: Some integration work and the launch communication.
- Q: Has this happened before with this team? | A: Not that you know of.
- Q: Do your engineers want you to do something? | A: One wants a correction announced; the other wants it dropped.
- Q: Does your manager know? | A: Not yet.

**Hints.**
1. Assume an oversight until you know otherwise, and ask before you conclude.
2. Separate two goals: your engineers' work being recognised where it matters, and a good working relationship with the other team.
3. Visibility is easier to build in than to repair: think about how work gets written up and presented in future.

**Follow-ups.**
1. What exactly do you say to the other team's lead, and what outcome do you ask for?
2. The other team's lead says the presentation simplified things and no harm was done. What now?
3. How do you make sure the engineer who wrote most of the code gets recognised for the promotion decision?
4. The same thing happens again a quarter later. What changes in your approach?
5. In your real example, what did you do, and what would you do differently now?

**Follow-up rules.**
- when: escalate, escalation, manager, skip-level → ask: What do you ask your manager to do, and what would you consider a good outcome?
- when: correction, correct the record, announce → ask: A public correction embarrasses a team you need next quarter. Is there another way to get the same result?
- when: let it go, move on, ignore → ask: Your engineer who wrote most of the code asks you why you did nothing. What do you say?
- when: document, write-up, documentation → ask: Who reads that write-up, and will it reach the people deciding the promotion?
- when: we decided, the team decided, we agreed → ask: What did you personally do or say, and when?

**Evaluation Criteria.** Assumes good faith first and checks the facts; talks to the other team's lead privately and directly, asking for a specific, proportionate fix (credit in the next update, a correction in the written record) that keeps the relationship; puts the engineers first: tells them what will be done, and makes sure the promotion evidence reflects their work through the right channel; involves the manager in proportion, as information or for help, not as a complaint; builds visibility into future work (written design docs and launch notes with authors, shared presentations); real example with what happened and personal contribution, or honestly hypothetical.

## TTK-L5-05: Project deep dive, re-examined for short-video creation, LIVE and community at global scale

| | |
|---|---|
| **Template ID** | TTK-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, late mobile data, regional rules and creator-visible numbers |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["uploads retried and resumed over unreliable mobile networks counted once", "LIVE gift totals on screen that match creators' statements exactly", "rules that differ by region, such as sound licences, applied per country and as of a date", "viewers appearing only in aggregates, with a creator seeing only their own numbers"],
  "scale": ["hundreds of millions of uploads a month", "billions of comments a day", "millions of concurrent LIVE viewers"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for short-video creation, LIVE and community, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The short-video setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a video or social system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one event (an upload, a gift, a comment): where it is created, which ids it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: retry, retries, at-least-once, exactly-once → ask: A phone retries an upload five times over a day on a bad connection. Where in your design is it counted, and how many times?
- when: region, country, regional → ask: A rule changes in one country on a date. Which of your tables know which rule applied to an event a month ago?
- when: dashboard, report, analytics → ask: Who can see a single viewer's activity in your design, and why?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example client-generated upload ids with idempotent processing and late mobile events counted on their event date; an append-only gift ledger with the on-screen total as a projection reconciled after the session; versioned regional rules joined as of the event date; aggregates with minimum group sizes and creator views scoped to the creator); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
