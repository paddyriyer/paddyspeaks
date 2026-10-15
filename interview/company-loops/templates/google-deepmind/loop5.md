# Google DeepMind · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public domain of an AI research lab
whose science and model work is public: experiment platforms, evaluation
results, a public database of predicted protein structures, and watermark
detection reporting. Every situation, partner, result and figure is
hypothetical and synthetic; nothing here describes the lab's research, people,
partners or compute, and none of it describes any company's hiring process or
the values it assesses. Answer from your own experience, or say plainly that
you have not faced it and reason it through. Never invent a story.

## GDM-L5-01: A public scientific database release found to contain an error after researchers have already used it

| | |
|---|---|
| **Template ID** | GDM-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Owning a public data error / scope, correction, errata, citations and prevention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "error": ["entries for one organism were aligned to an outdated version of their sequences, so residue numbering is shifted for a subset of them", "per-residue confidence files for a batch of entries were attached to the wrong structures", "a bulk archive for several organisms is missing a share of its entries, although its checksum list matches the archive as published"],
  "weeks": [2, 6, 12],
  "affected": ["about 0.5%", "about 3%", "about 10%"]
}
```

**Business Scenario.** You lead the data engineering team that builds the releases of a public database of predicted protein structures, run jointly with a partner institute that hosts the website and the API. {{weeks}} weeks after a release went live, an outside researcher emails the help address: {{error}}. Your team's first check confirms the problem and that it affects {{affected}} of the release's entries. The release has been downloaded in bulk by research groups and mirrored by other databases, and some preprints already cite entries from it.

**Problem Statement.** What do you do? Cover the first hour, the first day and the following weeks: how you establish the exact scope; whether you correct with a new version, withdraw the affected entries, or both; what users see on the affected entry pages and in the archives; how you tell people you cannot list (downloads need no login); how you work with the partner institute on the public message; how the researcher who reported it is acknowledged; how citations to the faulty files stay resolvable and honest; and what changes so this class of error is caught before release. Then tell me about a real time you found an error in data that others had already used, or say that you have not and reason it through.

**Constraints.** Downloads are anonymous, so you cannot contact every user. You do not know what anyone concluded from the faulty entries, and you must not speculate about biological, medical or clinical consequences. Public statements are agreed with the partner institute. Faulty files that were cited must not silently change.

**Assumptions.** The database, partner arrangement, error and figures are hypothetical; nothing here describes any real database's releases or errors.

**Clarifications.**
- Q: Is the error confined to one organism or batch? | A: Your first check says so, but the check that would prove it has not run yet.
- Q: Can we fix it quickly? | A: The correct files can be regenerated in about a week.
- Q: Does the partner agree on what to do? | A: They want a quiet fix in the next scheduled release, in three months, to avoid alarming users.
- Q: Has anyone else noticed? | A: Only the reporter, as far as you know; they intend to mention it in their own paper.

**Hints.**
1. Scope before statements: find every affected entry with a check that would also catch the same error elsewhere.
2. A correction that silently replaces files breaks every citation to them; versions and an errata note keep both the fix and the record.
3. People you cannot list can still be reached: the entry pages, the release notes, the archive manifests, mirrors and a mailing list.

**Follow-ups.**
1. What do you do in the first hour, and what do you not do yet?
2. The partner wants a quiet fix in three months. What do you say, and what evidence do you bring?
3. What exactly appears on an affected entry's page, in the archive manifest and in the release notes?
4. A user asks whether conclusions in their preprint are now wrong. How do you answer?
5. In your real example, how did people who had already used the data find out, and what changed in your checks afterwards?

**Follow-up rules.**
- when: quietly, quiet fix, next release, wait → ask: A user publishes a result based on a faulty entry during those three months. What would you say to them, and to the reporter?
- when: overwrite, replace the files, fix in place → ask: A preprint cites the faulty file. After your fix, what does that citation resolve to, and how would its reader know anything changed?
- when: email everyone, contact all users, notify all users → ask: Downloads need no login. Who can you actually reach, and through which channels?
- when: impact, consequences, conclusions → ask: How do you describe the impact without speculating about what researchers concluded from the data?
- when: we found, the team found, we decided → ask: What did you personally do in the first day?

**Evaluation Criteria.** Establishes the full scope with a check that would catch the same error elsewhere before making statements; corrects through a new version, with the faulty version marked and still resolvable for citations; prepares honest errata on entry pages, release notes and archive manifests, and reaches mirrors and bulk users through the channels that exist; argues with evidence against a silent or delayed fix while agreeing the public message with the partner; acknowledges the reporter with their permission; describes impact factually without speculating about research, medical or clinical consequences; adds a release check that would have caught this class of error; real example with what they personally did and how it landed, or honestly hypothetical.

## GDM-L5-02: Researchers who want to move faster than the platform's reproducibility rules allow

| | |
|---|---|
| **Template ID** | GDM-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Platform rules versus speed / understanding the cost, reducing friction, exceptions with limits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ml-platform-engineer, ai-infra-engineer, senior-data-engineer, staff-data-engineer, software-engineer |

```params
{
  "rule": ["every run must launch from committed code", "every training data snapshot must be registered before a run may read it", "every result cited outside the team must come from a run whose recipe was fully captured at launch"],
  "deadline": ["a conference deadline in 10 days", "an internal review in 3 weeks", "a public demonstration next month"],
  "team_size": [4, 12, 30]
}
```

**Business Scenario.** You own the experiment platform that a research lab's teams use to launch and track runs. One of its rules is that {{rule}}; it was introduced after results could not be reproduced for a paper review. A senior researcher who leads a team of {{team_size}} asks you to waive the rule for their team until {{deadline}}. They say it costs each person an hour a day, and members of their team have started launching runs from personal workstations outside the platform, where nothing is captured.

**Problem Statement.** How do you respond? Cover how you find out what the rule actually costs and where; what you can change in the platform quickly to reduce the cost without dropping what the rule protects; whether you grant an exception, and if so its scope, duration and conditions; how you deal with runs already happening outside the platform; who else needs to be involved; and how you would know a month later whether you made the right call. Then tell me about a real time a rule or standard you owned was slowing people down, or say that you have not and reason it through.

**Constraints.** You cannot remove the rule for everyone on your own; it was agreed with research leadership after the failed review. You cannot stop people running on workstations by force. The deadline is real and matters to the lab.

**Assumptions.** The team, the rule, the deadline and the figures are hypothetical.

**Clarifications.**
- Q: Is the hour a day real? | A: Nobody has measured it; the researcher's estimate comes from complaints on their team.
- Q: What exactly is slow? | A: Unknown. Your platform logs show launch times but not what people do before launching.
- Q: Have other teams complained? | A: Two smaller teams have mentioned the same rule, less urgently.
- Q: Will the results from this push be cited outside the team? | A: Very likely, if they are good.

**Hints.**
1. Watch someone work before deciding: the cost is usually in one step, not the whole rule.
2. Separate what the rule protects from how it is enforced today; often the protection can be kept with a lighter mechanism.
3. An exception needs an end date, conditions and a way to close the gap afterwards.

**Follow-ups.**
1. What do you do in the first two days?
2. You find that most of the cost is in one step. Walk through what you would change, and how fast.
3. Do you grant the exception? If so, what are its terms, and what happens on the day after {{deadline}}?
4. Some results from workstation runs turn out to be the best ones. Can they be cited, and how do you recover their recipes?
5. In your real example, what did you measure, and what did you change in your own rule?

**Follow-up rules.**
- when: exception, waive, waiver → ask: What exactly does the exception cover, when does it end, and how do you close the gap for runs made under it?
- when: enforce, block, mandatory → ask: People are already working around the rule on workstations. What does stricter enforcement do to that?
- when: survey, interview, measure, shadow → ask: What did you expect to find, and what would have changed your mind?
- when: leadership, escalate, director → ask: What decision do you need from leadership, and what do you bring them?
- when: we decided, the team decided, we agreed → ask: What did you personally decide, and who disagreed?

**Evaluation Criteria.** Takes the complaint seriously and measures the actual cost before deciding, by watching the work and using platform data; separates what the rule protects from how it is enforced, and removes friction quickly where possible; grants exceptions only with scope, conditions, an end date and a plan to close the gap, or declines with reasons and an alternative; brings workstation runs back into view without blame; involves research leadership for decisions they own; defines how success will be judged later; real example with what they personally changed and what they learned, or honestly hypothetical.

## GDM-L5-03: Co-running a public resource with a partner organisation that has different priorities

| | |
|---|---|
| **Template ID** | GDM-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Partnership / shared ownership, different incentives, decisions neither side can make alone |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-architect, staff-data-engineer, senior-data-engineer, software-engineer, data-engineer |

```params
{
  "partner": ["a public research institute", "a university consortium", "a national data centre"],
  "disagreement": ["how often releases ship: the partner wants one fixed release a year, your side wants smaller, more frequent releases", "whether to add a new kind of data file that your side can produce but the partner would have to host and support", "how long old releases stay downloadable, given the partner's storage budget"],
  "users": ["tens of thousands", "hundreds of thousands", "millions"]
}
```

**Business Scenario.** Your lab and {{partner}} jointly run a public database of predicted protein structures used by {{users}} of people a year. Your team builds the data; the partner hosts the website, the API and the downloads, runs user support, and answers to its own funders. The two sides now disagree about {{disagreement}}. Each side has good reasons, the working relationship has been good so far, and the next joint planning meeting is in a month.

**Problem Statement.** How do you handle it? Cover how you understand the partner's constraints and what they are measured on; what evidence about users would help both sides; the options you would put on the table, including ones that cost your side something; how a decision gets made when neither side can decide alone; what you do if no agreement is reached by the meeting; and how you keep the relationship working while you disagree. Then tell me about a real time you worked closely with another organisation or team whose priorities differed from yours, or say that you have not and reason it through.

**Constraints.** The agreement between the two organisations is not yours to renegotiate. Users from many fields rely on the resource being stable. Your side cannot ship anything the partner must host without the partner's agreement.

**Assumptions.** The partner, the arrangement, the disagreement and the figures are hypothetical; nothing here describes any real partnership.

**Clarifications.**
- Q: Who decides in the end? | A: A joint steering group with members from both organisations; it meets quarterly.
- Q: What do users want? | A: There is little direct evidence: support tickets, download logs and occasional feedback at conferences.
- Q: Does your side have a budget to offer? | A: Possibly some engineering time, but money flows between the organisations only under the agreement.
- Q: How does the partner's team feel? | A: Stretched: a small team running many services.

**Hints.**
1. Write down the partner's constraints in their words and check them with them; disagreements often hide a cost one side does not see.
2. Bring evidence about users that both sides trust, collected together if possible.
3. Offer options that move cost to your side where you can, and make the decision path explicit.

**Follow-ups.**
1. How do you learn what the partner is measured on and what the change would cost them?
2. What evidence would you gather before the meeting, and how would you make sure the partner trusts it?
3. Which options do you bring, including at least one that costs your side something?
4. The meeting ends without agreement. What happens next, and what do users see in the meantime?
5. In your real example, what did you learn about the other side that changed your position?

**Follow-up rules.**
- when: escalate, steering group, executive → ask: What exactly would you bring to the steering group, and how would you make sure the partner sees it first?
- when: contract, agreement, terms → ask: The agreement is not yours to change. What can you change within it?
- when: our users, users want, user research → ask: What evidence do you have, and would the partner read it the same way?
- when: compromise, middle ground, meet halfway → ask: What does the compromise cost each side, in their own terms?
- when: we decided, they refused, our side → ask: What did you personally do to understand their side?

**Evaluation Criteria.** Seeks to understand the partner's constraints, funders and capacity, and checks that understanding with them; gathers evidence about users that both sides trust; brings options including ones that cost their own side, such as engineering help or phased changes; uses the agreed decision path and prepares it jointly rather than escalating around the partner; keeps users' stability central and has a plan if there is no agreement; maintains the working relationship through the disagreement; real example with what they personally did and what changed in their view, or honestly hypothetical.

## GDM-L5-04: Explaining an uncertain result to a non-specialist audience without overstating it

| | |
|---|---|
| **Template ID** | GDM-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Communicating uncertainty / plain language, what is and is not known, resisting the headline |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect, ml-platform-engineer |

```params
{
  "audience": ["a journalist writing a story due tomorrow", "the board of a funding body deciding whether to renew its support", "your organisation's communications team drafting a public post"],
  "result": ["an evaluation in which a new research model scored 1.8 points higher than the previous one on a 300-item benchmark, with an interval that includes zero (all numbers synthetic)", "a predicted protein structure whose core is predicted with high confidence and whose long loops are in the lowest confidence band", "a watermark detector that reports \"inconclusive\" for a notable share of heavily edited images in a test set the team built for testing"]
}
```

**Business Scenario.** You are asked to explain {{result}} to {{audience}}. They want one clear sentence they can use. Your team understands the result well, including what it does not show, and is worried that a simple version will be wrong in a way that matters.

**Problem Statement.** How do you prepare and what do you say? Cover what you need to know about the audience and what they will do with the explanation; the one or two sentences you would offer, in plain words; how you explain what is known, what is uncertain and why; what you would refuse to say, and how you say no without being unhelpful; how you check what they finally publish or decide; and what you do if your explanation is later simplified into something wrong. Then tell me about a real time you explained an uncertain result to people outside your field, or say that you have not and reason it through.

**Constraints.** Every number here is synthetic. You do not draw medical, clinical or drug-discovery conclusions from a structure prediction, and you do not describe how a watermark could be removed, weakened or evaded. You cannot control what the audience finally publishes or decides.

**Assumptions.** The audience, the result and the figures are hypothetical; nothing here reports any real model's or system's performance.

**Clarifications.**
- Q: How much time do I have with them? | A: Thirty minutes, and a chance to answer follow-up questions by email.
- Q: Can I show a chart? | A: Yes, one.
- Q: Will I see the text before it is published or decided? | A: Not necessarily; you can ask.
- Q: Does my manager want a positive message? | A: Your manager wants it to be accurate and understood.

**Hints.**
1. Start from what the audience will do with the sentence, then write the sentence that is true and still useful.
2. Say what the result is, what it is not, and what would make it more certain, in that order.
3. Uncertainty is easier to understand as a concrete comparison or range than as a statistical term.

**Follow-ups.**
1. Say the one or two sentences you would offer.
2. They ask, "So is it better or not?" What do you answer?
3. They want to use a word you think overstates it. How do you respond?
4. Their published text simplifies your explanation into something wrong. What do you do?
5. In your real example, what did the audience take away, and how do you know?

**Follow-up rules.**
- when: confidence interval, statistically significant, p-value → ask: Say that again without the statistical terms, so that someone outside the field could repeat it correctly.
- when: breakthrough, proves, proven → ask: Would you sign your name under that word? What would you say instead?
- when: cure, drug, treatment, disease → ask: What can a structure prediction support, and where does your explanation stop?
- when: fool, bypass, evade, trick → ask: How do you answer questions about defeating the detector without describing how anyone could do it?
- when: refuse, decline, no comment → ask: How do you say no and still leave them with something accurate they can use?

**Evaluation Criteria.** Learns what the audience will do with the explanation before writing it; offers a plain sentence that is accurate and useful; separates what is known, what is uncertain and what would reduce the uncertainty, using concrete comparisons rather than jargon; declines overstated wording and offers an accurate alternative; never draws medical or clinical conclusions from a prediction and never describes how a watermark could be evaded; asks to check the final text and has a plan for corrections; real example with evidence of what the audience understood, or honestly hypothetical.

## GDM-L5-05: Project deep dive, re-examined for a research lab whose science products are public

| | |
|---|---|
| **Template ID** | GDM-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, reproducibility, public data releases and aggregate-only reporting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["any result reproducible from a recipe pinned at launch, with an honest report of what could not be pinned", "a public data release in which every page, file and API response for an entry comes from one version, and old versions stay citable", "aggregate outcome reporting in which no checked content is ever kept", "allocations that anyone can re-derive from a stated rule and the inputs it read"],
  "scale": ["hundreds of thousands of experiment runs a year", "hundreds of millions of public data entries", "tens of millions of detection checks a day"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or the public depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a research lab whose science products are public, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The research lab setting is hypothetical.

**Clarifications.**
- Q: Does it have to be a research or machine learning system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one record (a run, an entry, a check): which ids, versions and timestamps it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: overwrite, update in place, upsert → ask: Someone cited last month's version of that record. After your update, how do they find exactly what they cited?
- when: log, logs, logging → ask: What exactly do your logs contain, and could anything in them be content that should never have been kept?
- when: reproducible, reproduce, rerun → ask: What exactly would have to be pinned for that to be true, and which of those things did your system pin?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example a launch-time manifest of content hashes with retention by reachability and explicit unpinned inputs; immutable version-named files with "latest" as a pointer and pages that reference versioned files; outcome records with chosen fields, content discarded in the request and minimum cells enforced at publication; a versioned rule run on a frozen snapshot of its inputs, with a ledger of later changes); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
