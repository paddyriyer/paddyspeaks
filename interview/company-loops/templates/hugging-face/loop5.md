# Hugging Face · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of an open hub of
models, datasets and Spaces apps, and the open-source libraries around it.
Repositories, cards and datasets are user content. Every situation is
hypothetical, and none describes any company's hiring process, its culture or
the values it assesses. Answer from your own experience, or say plainly that you
have not faced it and reason it through. Never invent a story.

## HGF-L5-01: A widely downloaded dataset is found to contain personal data

| | |
|---|---|
| **Template ID** | HGF-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Data incidents / personal data in a published dataset, containment, downstream users |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, analytics-engineer |

```params
{
  "downloads": ["40,000", "900,000", "5 million"],
  "derived": ["12", "150", "900"],
  "pii": ["email addresses and phone numbers inside free-text posts", "names and home addresses in scanned forms", "people's full names next to health details they described"],
  "reporter": ["an outside researcher, in a public discussion on the dataset's repository", "a person who found their own details in it, by email", "a user of the dataset, privately"]
}
```

**Business Scenario.** You lead the data engineering team of an organisation that publishes datasets on an open hub. One of your text datasets, built from public web pages two years ago, has been downloaded about {{downloads}} times, and {{derived}} public models declare it as training data in their model cards. Today a report arrives from {{reporter}}: some rows contain {{pii}}. The dataset is a git repository: every revision is kept, and many users pin a specific revision in their training code.

**Problem Statement.** What do you do in the first hour, the first day and the following weeks? Cover how you confirm and size the problem, what you change on the hub and when, what happens to earlier revisions, who you tell (users, authors of derived models, the people in the data, your own organisation's privacy and legal advisers) and what you tell them, and what you change so the next dataset does not ship with the same problem. Then tell me about a real time you handled a data incident involving personal data, or say that you have not and reason it through.

**Constraints.** You cannot recall copies already downloaded. Whether and whom you must notify is for your privacy and legal advisers to determine; your job is to give them facts quickly and act on their advice. Many research pipelines depend on the dataset and will break if it disappears.

**Assumptions.** The situation and figures are hypothetical. In this exercise a dataset owner can make a repository private or gated, push a new revision, and ask the hub to remove old revisions from history; check current docs for what the hub actually supports.

**Clarifications.**
- Q: How many rows are affected? | A: Unknown. The report shows a dozen rows; nobody has scanned the rest.
- Q: Was the dataset filtered for personal data when it was built? | A: A pattern-based filter ran, and its configuration is in the build code.
- Q: Is the report public? | A: Depends on the reporter; if it is a public discussion, the comment itself quotes one of the rows.
- Q: Who owns the dataset? | A: Your team built and published it under your organisation's account.

**Hints.**
1. Separate containment (stop further spread of the affected rows) from repair (a clean revision) from notification (who must know); they run on different clocks.
2. A new revision does not remove old ones. Think about history, pinned revisions, the dataset viewer and any converted copies.
3. Measure before you speak: a scan of the whole dataset turns "some rows" into a number you can act and report on.

**Follow-ups.**
1. Restricting access now protects people in the data but breaks pipelines for thousands of users. How do you decide, and how fast?
2. How would you size the problem across the whole dataset within a day, and how sure would you be of the number?
3. What do you say, and where, to the authors of the {{derived}} derived models?
4. Your filter missed these rows two years ago. What changes in how your team builds and reviews datasets, and how would you know it works?
5. In your real example, what was the first decision you made, and what would you do differently?

**Follow-up rules.**
- when: delete, take down, remove the dataset → ask: Deleting it breaks every pinned pipeline and erases the evidence of what was published. What do you keep, and where?
- when: new version, new revision, clean version → ask: The affected rows are still in every earlier revision, and many users pin one. What do you do about history?
- when: legal, lawyer, compliance → ask: While you wait for advice, what can you do on your own authority in the first hour?
- when: regex, filter, pattern → ask: Your patterns missed these rows once. How do you estimate how many they still miss?
- when: announce, announcement, blog → ask: How do you describe the problem publicly without repeating the personal data or pointing people to where it is?

**Evaluation Criteria.** First hour: acknowledge the reporter, hide or edit any public comment that repeats the data, verify the report, and take a containment decision (gating or making the repository private) with its cost to users stated; first day: scan the whole dataset to size the problem, engage privacy and legal advisers with facts, prepare a clean revision and a plan for history (removal of old revisions, converted copies); weeks: notify users and derived-model authors through the card, a discussion post and direct contact, without repeating the data; a root-cause review of the filter with measured recall on a labelled sample and a pre-publication review step; no legal conclusions of their own; real example with own actions, measurable outcome and lessons, or honestly hypothetical.

## HGF-L5-02: The community's most-requested feature conflicts with an access or safety obligation

| | |
|---|---|
| **Template ID** | HGF-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Product judgement / community demand versus repository conditions, privacy and safety |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, analytics-engineer |

```params
{
  "feature": ["one-click copying of any model, gated ones included, into the user's own account", "showing on each model's page which named organisations download it most", "letting repository owners hide the warnings that file scanning shows on their files"],
  "votes": ["3,000", "12,000", "40,000"],
  "weeks": [4, 8, 12]
}
```

**Business Scenario.** You lead engineering for one area of an open hub of models, datasets and apps. The most-upvoted request in the public feedback forum, with {{votes}} votes, is {{feature}}. It would be simple to build, a competitor offers something similar, and your product manager wants it on the roadmap within {{weeks}} weeks. You believe it conflicts with an obligation the hub has to someone who is not voting: authors of gated repositories who set conditions for access, the people and organisations whose downloads would be shown, or the users who rely on warnings to decide what to load.

**Problem Statement.** How do you handle this? Cover how you establish what the obligation actually is and who decides it, how you work out what the voters really need, what you propose instead or in addition, how the decision is made and communicated publicly, and how you would measure whether the community's need was met. Then tell me about a real time you argued against a popular request, or say that you have not and reason it through.

**Constraints.** You do not decide alone: product, policy and legal advisers have a say, and you must not substitute your own legal conclusions for theirs. The forum thread is public, and whatever you decide will be read by the people who asked.

**Assumptions.** The situation and figures are hypothetical. In this exercise a repository may require users to accept conditions before access; check current docs for how the hub's gated repositories actually work.

**Clarifications.**
- Q: Why do people want it? | A: The thread is long; the most common reasons are convenience and speed, and some posts describe a different underlying problem.
- Q: Have the affected parties been asked? | A: No. The repository authors or organisations concerned have not been part of the discussion.
- Q: Is the conflict certain? | A: You believe so; policy and legal advisers have not looked at it yet.
- Q: Can the feature be partly built? | A: Yes. Any variant is open, including not building it.

**Hints.**
1. Find the job behind the request: what do voters do today without the feature, and what does it cost them?
2. Name the party whose obligation is at stake and ask them, or their representatives, before deciding for them.
3. A no in a public forum needs a reason and an alternative; silence reads as indifference.

**Follow-ups.**
1. How would you find out what the {{votes}} voters actually need, beyond what the request says?
2. What variant would meet most of that need without breaking the obligation?
3. The product manager says the competitor already does it and nobody complained. How do you respond?
4. How would you explain the decision in the public thread, and what would you do if the thread turned hostile?
5. In your real example, what did saying no or changing the request cost, and what did you learn?

**Follow-up rules.**
- when: survey, interview, user research → ask: Your survey goes to the people who voted. How do you hear from the people the feature would affect, who did not vote?
- when: just build it, ship it, give users what they want → ask: Who carries the cost if the feature goes wrong, and were they asked?
- when: opt-in, opt in, setting → ask: Whose setting is it: the voter's, or the party the obligation protects? Who should have to opt in?
- when: legal, policy, compliance → ask: What do you bring to the policy and legal advisers so they can decide quickly, and what do you do in the meantime?
- when: competitor, competition → ask: How much does the competitor's choice tell you about your obligations?

**Evaluation Criteria.** Separates the stated request from the underlying need, with evidence (forum analysis, a few conversations, usage data); identifies the affected party and brings them, or the policy owners, into the decision; brings facts to legal and policy advisers rather than legal conclusions; proposes variants that serve the need while keeping the obligation (for example copying that carries gating conditions with it, aggregated rather than named download breakdowns, warnings that owners can annotate or dispute but not hide); a clear decision owner and a public explanation with an alternative and a date; a success measure for the need; real example with own actions, cost and lessons, or honestly hypothetical.

## HGF-L5-03: Maintaining a widely used open-source library with a small team

| | |
|---|---|
| **Template ID** | HGF-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Open-source stewardship / review capacity, contributors, releases, saying no |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, ml-platform-engineer, ai-infra-engineer, senior-data-engineer, staff-data-engineer, data-engineer |

```params
{
  "team": [3, 4, 6],
  "contributors": ["300", "1,200", "4,000"],
  "open_prs": ["250", "800", "1,500"],
  "pressure": ["a large company asks for a breaking API change and offers two of its engineers to build it", "a security report arrives during a release freeze", "the most active outside contributor asks for commit rights"]
}
```

**Business Scenario.** You lead a team of {{team}} maintainers for an open-source library that many projects on an open hub use to load and process models and datasets. It has had {{contributors}} outside contributors, and {{open_prs}} pull requests are open, some for over a year. Releases are irregular, CI is slow and flaky, and regular contributors have started to drift away. This week, {{pressure}}.

**Problem Statement.** How do you get the project healthy, and how do you handle this week's pressure? Cover review capacity and triage, what you say no to and how, contribution guidelines and CI, release and deprecation policy, how outside contributors gain responsibility, and how you keep your own team from burning out. Then tell me about a real time you maintained or led a project with many outside contributors, or say that you have not and reason it through.

**Constraints.** The team will not grow this year. Users depend on the library's API staying stable between major versions. Anything you decide is visible in public issues and pull requests.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: What share of open pull requests are still relevant? | A: Unknown; nobody has looked at the oldest ones in months.
- Q: Is there a written governance or contribution policy? | A: A short contributing guide, out of date.
- Q: Does anyone outside the team have merge rights? | A: No.
- Q: How long does CI take? | A: About 50 minutes, and one run in five fails for reasons unrelated to the change.

**Hints.**
1. A backlog of reviews is a queue: measure arrivals, review time and age before deciding how to drain it.
2. Saying no early and kindly costs a contributor less than silence for a year.
3. Responsibility can be given in steps: triage rights, review rights, ownership of one area, then merge rights.

**Follow-ups.**
1. What do you do with the {{open_prs}} open pull requests in the next month?
2. How do you respond to this week's pressure, and who else is involved in the decision?
3. What release and deprecation policy would you publish, and how do you hold to it?
4. How would you know a year from now that the project is healthier? Name the measures.
5. In your real example, what did you stop doing, and what happened?

**Follow-up rules.**
- when: close, closing, stale bot → ask: Closing a two-year-old pull request from a first-time contributor without a word: what does that do to the next one, and how would you close it instead?
- when: hire, more maintainers, more people → ask: The team will not grow this year. What do you do with the people you already have, inside and outside the team?
- when: breaking change, major version, deprecate → ask: Thousands of projects pin your library. How long is the deprecation window, and how do you tell them?
- when: commit rights, merge rights, maintainer access → ask: What does someone have to show before getting that access, and how would you take it back if needed?
- when: security, vulnerability, cve → ask: Who sees the report, where is the fix developed, and when is it made public?

**Evaluation Criteria.** Measures the backlog (age, arrival rate, review time) and triages it with labels, clear closes with thanks and reasons, and owners per area; fixes CI speed and flakiness as a multiplier on review capacity; publishes contribution guidelines, a release cadence and a deprecation policy tied to semantic versions; handles the pressure on its merits (a breaking change through a deprecation path and design review regardless of who offers the engineers; security reports privately with coordinated disclosure; graduated responsibility for a contributor); protects the team (rotations for triage, saying no); success measures such as time to first response, pull request age and contributor retention; real example with own actions, measures and lessons, or honestly hypothetical.

## HGF-L5-04: Fixing an interview process on your team that keeps rejecting strong candidates

| | |
|---|---|
| **Template ID** | HGF-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Team building / interview process evidence, calibration, structured assessment |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "signal": ["two people your team turned down were hired by other teams nearby and are now among their strongest engineers", "only 3% of candidates pass your team's take-home exercise, and most who pass decline the offer", "your last eight rejections all failed the same live-coding round, which no current team member has ever taken"],
  "openings": [2, 4, 6],
  "months": [3, 6, 9]
}
```

**Business Scenario.** You are a senior engineer on a data platform team for an open hub of models and datasets, and you run your team's interview process: the rounds you and your teammates design, run and score when your team hires. The team has {{openings}} open roles and has filled none in {{months}} months. Then {{signal}}. Your manager asks you to fix the process without lowering the bar. This is about the interview process on your own team, not about any real company's hiring process.

**Problem Statement.** What do you do? Cover how you find out what is actually wrong (with evidence rather than impressions), what you change in the rounds, the scoring and the interviewers, how you would know the changes worked, and how you bring the team with you. Then tell me about a real time you changed how a team assessed candidates or other people's work, or say that you have not and reason it through.

**Constraints.** You cannot change company-wide hiring policy; you can change your team's rounds, rubrics, interviewer assignments and debriefs. Candidates' personal information stays inside the hiring system; your analysis uses outcomes and scores, not names.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the rounds written down? | A: Each interviewer has their own questions; there is a one-line description per round.
- Q: Is there a scoring rubric? | A: Interviewers write free-text feedback and a hire or no-hire vote.
- Q: Who makes the decision? | A: A debrief of the interviewers, where any single strong no usually ends it.
- Q: Do you have data on past candidates? | A: Stage outcomes, votes and dates for the last 18 months.

**Hints.**
1. Look at pass rates per round and per interviewer before touching any question; a funnel shows where good candidates are lost.
2. Ask what each round is meant to measure, and whether that is something the job needs.
3. You rarely learn about false negatives directly; look for the signals you do have and treat them as samples, not proof.

**Follow-ups.**
1. What would you look at first in the 18 months of outcomes and votes, and what would worry you?
2. How do you make the rounds measure what the job needs, and the scoring consistent between interviewers?
3. A respected teammate's round rejects far more candidates than the others, and they say it protects the bar. How do you handle it?
4. How would you know in {{months}} months whether the process is better without simply hiring more people?
5. In your real example, what changed in how people were assessed, and how did you measure it?

**Follow-up rules.**
- when: lower the bar, easier, make it easier → ask: Your manager said not to lower the bar. How is what you propose different, and how would you show it?
- when: rubric, scorecard, structured → ask: Who writes the rubric, how do you check two interviewers score the same answer the same way, and how often?
- when: take-home, take home, homework → ask: How long does it really take candidates, and who drops out because of it?
- when: culture fit, gut feel, vibe → ask: What exactly would that round measure, and how would two interviewers agree on it?
- when: bias, fairness, diverse → ask: What would you measure in the outcomes to see whether the process treats different groups of candidates differently?

**Evaluation Criteria.** Diagnoses with evidence (funnel by round and interviewer, score distributions, offer acceptance, time to decision, the signal in the scenario treated as a sample); defines what each round measures against the job and rewrites rounds as work samples with written rubrics; calibrates interviewers (shadowing, paired scoring, periodic calibration on the same answer); fixes the debrief (independent written scores before discussion, a decision rule other than a single veto); respects candidates' time and personal information; handles a teammate's round with data and respect; measures success by consistency, pass rates by round, acceptance and later performance, not just volume; brings the team along; real example with own actions, measures and lessons, or honestly hypothetical; never presents any company's actual hiring process as the model.

## HGF-L5-05: Project deep dive, re-examined for an open hub of models, datasets and apps

| | |
|---|---|
| **Template ID** | HGF-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, scaling onto an open hub |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the bottleneck that was hardest to find", "the decision that most changed what the system cost", "the failure that taught you the most"],
  "scale": ["10×", "50×"],
  "hub_feature": ["anyone can publish, so inputs are untrusted and their sizes unbounded", "every revision is kept in git history, so nothing published is ever simply overwritten", "a few repositories take most of the traffic, and one new release can take a large share of it within an hour"]
}
```

**Business Scenario.** In this part of the loop you describe a system you designed or substantially changed, one that other teams or users depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it ran inside, or served, an open hub of models, datasets and apps at {{scale}} today's load, where {{hub_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at {{scale}} the load on an open hub where {{hub_feature}}. If you have never worked on a public platform with user-published content, say so, pick the closest system you have worked on, and be clear which parts you are recalling and which you are reasoning through.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The open-hub setting is hypothetical.

**Clarifications.**
- Q: Does it have to involve machine learning? | A: No. Any system that moves, stores or computes data others depend on counts; the hub part is reasoning.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to data paths, bottlenecks, failure modes, costs and numbers.
- Q: What is special about an open hub for this question? | A: Content comes from anyone, is versioned, and its popularity is extremely uneven. Reason from those.

**Hints.**
1. Lead with the problem and the numbers, including peak against average, before the architecture.
2. Know where the time and money go in your system, and which input would hurt it most if someone you do not trust supplied it.
3. For the hub question, ask what happens when one item suddenly takes most of the traffic, and what happens when nothing can be overwritten.

**Follow-ups.**
1. What was the main alternative to your key decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. At {{scale}} the load, which component fails first, and how would you know before users did?
4. How would your system cope when {{hub_feature}}, and what new failure does that bring?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: cache, caching, cdn → ask: One new release takes a large share of all traffic within an hour. What does your cache do in the first minute, before it is warm?
- when: validation, validate, schema → ask: Someone uploads a file a thousand times larger than anything you tested. Which part of your system notices first, and what does it do?
- when: bottleneck, profiling, profile → ask: How did you prove that was the bottleneck rather than a symptom of something upstream?
- when: cost, budget, spend → ask: What did the system cost per month, which part drove it, and what did you change because of it?

**Evaluation Criteria.** Clear problem framing with real numbers (volume, peak and average, latency or throughput targets, cost); depth on the chosen angle down to data paths, bottlenecks and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a scaling analysis that names the first bottleneck and how it would be seen early; concrete reasoning about the hub feature (limits and isolation for untrusted input, storage and deletion when history is kept, hot-item handling and cache warm-up for uneven popularity) with its new failure modes; own contribution separated from the team's, or an honest statement of reasoning rather than recall.
