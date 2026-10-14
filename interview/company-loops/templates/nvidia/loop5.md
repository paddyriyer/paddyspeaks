# NVIDIA · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of GPUs,
data-centre systems and the software that runs on them. Every situation is
hypothetical, and none describes any company's hiring process, its teams or
the values it assesses. Answer from your own experience, or say plainly that
you have not faced it and reason it through. Never invent a story.

## NVD-L5-01: Two teams with hard deadlines and not enough GPUs for both

| | |
|---|---|
| **Template ID** | NVD-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Scarce resources / allocation decisions, decision rights, transparent trade-offs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "need_a": ["a model release promised to customers", "a training run that must finish before a product launch"],
  "need_b": ["a benchmark submission with a fixed external date", "a large evaluation that gates a partner's integration"],
  "shortfall": ["a quarter", "a third", "half"],
  "weeks": [4, 6, 8]
}
```

**Business Scenario.** You lead the platform team that runs a shared GPU cluster. For the next {{weeks}} weeks two teams each need most of it: one for {{need_a}}, the other for {{need_b}}. Their combined requests exceed the cluster's capacity by {{shortfall}}. Both deadlines are real, both teams' leaders say theirs comes first, and each has asked you, separately, to guarantee their share. New capacity cannot arrive within {{weeks}} weeks. You have been asked to propose an allocation and explain it.

**Problem Statement.** What do you do? Cover what you check about the requests themselves, which options reduce the shortfall before anyone has to lose, who should make the priority call and how you prepare it for them, how the allocation is written down and enforced, how you tell both teams, and what you watch and revisit over the {{weeks}} weeks. Then tell me about a real time you had to divide a scarce resource between people who all needed it, with what happened, or say that you have not and reason it through.

**Constraints.** You own the cluster and its data; you do not own the business priority between the two teams. Every other team on the cluster also has work. Whatever you decide will be read as a precedent.

**Assumptions.** The situation, teams and figures are hypothetical.

**Clarifications.**
- Q: Are the requests accurate? | A: They are each team's estimate. Neither has shown you how it was made.
- Q: How efficiently do the teams use GPUs today? | A: Your telemetry shows one team's jobs average 45% utilisation of the GPUs they hold; the other's about 70%.
- Q: Who is above both teams? | A: A director who would rather not decide, but will if asked clearly.
- Q: Can the other teams on the cluster give anything up? | A: Some of their work could pause for a few weeks, at a cost they will want to know about.

**Hints.**
1. Before anyone loses, test the numbers: how was each request estimated, and what does the team's history say about it?
2. Shrink the gap first: efficiency fixes, scheduling (preemptible and off-peak work), pausing lower-priority work, and borrowing capacity from elsewhere.
3. Your job is to make the trade-off visible and the decision clean, not to choose the business priority yourself.

**Follow-ups.**
1. How would you check each team's request, and what would you do if one is clearly inflated?
2. What options shrink the shortfall, and roughly how much could each give?
3. What do you put in front of the director, and how do you make sure both teams think it is fair?
4. Two weeks in, one team is ahead of plan and the other behind. Do you move GPUs? Who decides?
5. In your real example, how did the team that got less react, and what did you do about it?

**Follow-up rules.**
- when: split, fifty-fifty, equally, proportional → ask: An even split makes both teams miss. Is that better or worse than one team making it for sure?
- when: escalate, director, leadership → ask: What exactly do you ask the director to decide, and what do you decide yourself?
- when: utilisation, utilization, efficiency → ask: The 45% team says their utilisation is low because of input data stalls they cannot fix in time. What do you do with that?
- when: preempt, preemption, priority → ask: Your priority scheme preempts the other teams' jobs. Who tells them, and what do they get in return?
- when: we decided, the team decided, we agreed → ask: Which part of the decision did you make personally, and how did you explain it?

**Evaluation Criteria.** Verifies the requests against history and asks how they were estimated; reduces the gap before allocating (efficiency work with measured gains, preemptible scheduling, pausing other work with its cost stated, outside capacity); separates the platform's decisions from the business priority and prepares a clear, fair decision for the person who owns it, with options and consequences; writes the allocation down and enforces it in the scheduler; communicates to both teams together and to the rest of the cluster; tracks progress and has a rule for re-balancing; real example with what happened and personal contribution, or honestly hypothetical.

## NVD-L5-02: Benchmark results the team cannot reproduce a month later

| | |
|---|---|
| **Template ID** | NVD-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Engineering integrity / reproducibility, correcting a published result, changing practice |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "gap": ["8%", "15%", "25%"],
  "audience": ["a performance report sent to customers", "a decision to standardise every team on a new library version", "a public write-up on the team's blog"],
  "result": ["training throughput in samples per second", "time to train to a target accuracy", "inference requests per second at a latency target"]
}
```

**Business Scenario.** A month ago your team published a benchmark of {{result}} for a model on a GPU cluster, and it was used in {{audience}}. An engineer rerunning it this week, with what they believe is the same setup, gets a result {{gap}} worse. Nobody kept a full record of the original environment: the driver, toolkit and library versions, the container, firmware, power and clock settings, which nodes were used, and the exact configuration are partly in a notebook and partly in people's memories. One engineer suggests quietly rerunning until a number close to the original appears.

**Problem Statement.** What do you do in the first day, the first week and afterwards? Cover how you find out which number is right, how you decide whether and how to correct the published result and who needs to know, how you respond to the suggestion to rerun until it matches, and what you change so the team's benchmarks are reproducible from now on. Then tell me about a real time a result you or your team reported turned out to be wrong or irreproducible, with what happened, or say that you have not and reason it through.

**Constraints.** The original engineer is still on the team. The people who used the result are expecting a follow-up soon. Reruns cost scarce cluster time.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Was the original run a single run? | A: Three runs; the best was reported.
- Q: Has anything changed on the cluster since? | A: A driver update, a firmware update on some nodes, and a change to the default per-GPU power limit, all in the last month.
- Q: Is the difference within normal run-to-run variation? | A: Nobody knows; variance was never measured.
- Q: Who owns the published result? | A: Your team, and you signed off on it.

**Hints.**
1. Treat it as a bisection: recover as much of the original environment as you can, reproduce either number, then change one factor at a time.
2. Measure run-to-run variance before arguing about a {{gap}} difference.
3. Decide on the correction from the evidence and the audience's use of the number, not from how it looks.

**Follow-ups.**
1. Which factors would you test first, and why those?
2. You find the original was the best of three runs on a few unusually fast nodes. How do you correct it, and to whom?
3. How do you handle the suggestion to rerun until the number matches, and the engineer who made it?
4. What does a reproducible benchmark record contain, and how do you make the team actually use it?
5. In your real example, what did the correction cost you, and what did it earn?

**Follow-up rules.**
- when: rerun, rerunning, run again → ask: How many runs do you need before you trust the difference, and how much cluster time is that?
- when: correction, retract, erratum, correct → ask: The correction will embarrass a manager who quoted the number widely. Does that change what you publish or when?
- when: container, pin, pinned, versions → ask: Pinning software versions does not pin firmware, power limits or which nodes you get. What else do you record?
- when: variance, confidence interval, noise → ask: The variance turns out to be 6%. What should the original report have said?
- when: blame, mistake, mistakes → ask: How do you talk to the engineer who ran the original benchmark?

**Evaluation Criteria.** Refuses to rerun until it matches and says why; establishes run-to-run variance and reconstructs the original environment, then isolates the cause one factor at a time; distinguishes "the original was an outlier" from "something changed" and acts differently on each; corrects the published result promptly, proportionately and to everyone who used it, owning the sign-off; treats the original engineer fairly (a process failure, not a person); changes practice so every benchmark records its full environment (software, firmware, power and clock settings, nodes, configuration) and reports multiple runs with spread; real example with what happened and personal contribution, or honestly hypothetical.

## NVD-L5-03: Working with a hardware team whose release cycle is measured in years

| | |
|---|---|
| **Template ID** | NVD-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team influence / different cadences, requirements, long-horizon planning |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "you_own": ["the telemetry pipeline that collects counters from every GPU in a cluster", "the scheduler that places jobs on GPUs", "a software library that applications use to run on the hardware"],
  "ask": ["a new hardware counter that would expose a class of failures you can only guess at today", "a change in how the hardware reports why it reduced its clocks", "a way to read telemetry without interrupting running work"],
  "cycle": ["two years", "three years"],
  "freeze_months": [3, 6]
}
```

**Business Scenario.** Your team owns {{you_own}} and ships every week. You depend on a hardware team whose generation takes about {{cycle}} from design freeze to systems in the field. You need {{ask}}; without it, your team keeps building workarounds that are expensive and still miss things. The next generation's design freezes in {{freeze_months}} months; after that, changes are close to impossible. The hardware team has hundreds of requests, finite silicon area, power and validation time, and has never heard of your team.

**Problem Statement.** How do you get your request properly considered? Cover how you learn their constraints and decision process, how you make the case in terms they can weigh, what you ask for (and what smaller or different asks could serve), what your team does in the {{cycle}} before anything ships, and how you build a working relationship that lasts beyond this one request. Then tell me about a real time you depended on a team that worked on a very different cadence or with very different constraints, with what happened, or say that you have not and reason it through.

**Constraints.** You cannot escalate your way into their design. Your team's workarounds must keep running for at least {{cycle}} whatever the answer.

**Assumptions.** The situation, teams and timelines are hypothetical.

**Clarifications.**
- Q: Does the hardware team take requests from software teams? | A: Yes, through a requirements process with a review each quarter.
- Q: Do you have data on what the missing capability costs? | A: Incident records and your team's time on workarounds, not yet summarised.
- Q: Could the capability be delivered without new hardware? | A: Possibly, partly, through firmware or the driver; you do not know yet.
- Q: Who else wants it? | A: You suspect other teams do, but nobody has asked them.

**Hints.**
1. Learn how they decide before you ask: the cost to them of a feature, who weighs requests and when.
2. Quantify the cost of not having it with your own data, and find other teams who would benefit.
3. Separate the need from your proposed solution; they may know a cheaper way to meet the need.

**Follow-ups.**
1. What does your written request contain, and how long is it?
2. They reply that the counter costs area and validation time they do not have this generation. What do you do?
3. What could firmware or software deliver in the meantime, and how would you find out?
4. How do you keep the relationship useful for the next request, and the one after?
5. In your real example, what did you learn about the other team's constraints that changed your ask?

**Follow-up rules.**
- when: escalate, escalation, executive → ask: You escalate and the request is added. What has it cost you with the hardware team for the next {{cycle}}?
- when: data, incidents, evidence, quantify → ask: What single number from your data would make the hardware team's reviewer take it seriously, and how sure are you of it?
- when: workaround, software, firmware → ask: Your workaround is good enough for most cases. Do you still push for the hardware change, and how do you decide?
- when: other teams, coalition, partners → ask: Three other teams want something similar but slightly different. Do you merge the asks, and who owns the merged request?
- when: we decided, the team decided, we agreed → ask: What did you personally write, present or negotiate?

**Evaluation Criteria.** Learns the hardware team's process, constraints and timelines before asking; states the need separately from a proposed mechanism; quantifies the cost of not having it from incident and effort data and gathers other teams with the same need; makes the request early, concise and in their terms, with priorities and smaller alternatives; plans for the {{cycle}} gap with software or firmware measures and keeps workarounds maintained; builds a lasting relationship (field data shared back, early feedback on their designs, a named contact); accepts a "no" with a plan; real example with what happened and personal contribution, or honestly hypothetical.

## NVD-L5-04: Admitting that a design you championed was the wrong call

| | |
|---|---|
| **Template ID** | NVD-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Accountability / reversing your own decision, sunk cost, decision practice |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "design": ["a custom checkpoint format for training jobs, instead of the widely used one", "a central job-telemetry database for every cluster, instead of keeping telemetry in each cluster", "an in-house job launcher wrapped around the cluster scheduler"],
  "months": [6, 12, 18],
  "signal": ["it costs about three times what you estimated", "most of the teams it was built for have built workarounds rather than use it", "it has been involved in two of the last five incidents"]
}
```

**Business Scenario.** {{months}} months ago you argued hard for {{design}}. Others proposed a simpler path; your argument won, and you led the build. Now {{signal}}. You have looked at the evidence, and you believe the original decision, not just its execution, was wrong. Several engineers spent most of that time building it, and some of them still believe in it. Your manager backed you at the time.

**Problem Statement.** What do you do? Cover how you make sure it is the decision and not the execution or bad luck, how and to whom you say so, what you propose (move away, fix, or keep it with limits), how you handle the engineers who built it and the people who argued for the other path, and what you change in how you and the team make such decisions. Then tell me about a real time you reversed a decision you had championed, with what happened, or say that you have not and reason it through.

**Constraints.** Teams depend on the current design today, so any change must be gradual. Your credibility is part of what is at stake, and so is the team's trust in future proposals.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Did anyone predict this? | A: One engineer raised the cost concern in the original review, and you argued them down.
- Q: Is there a cheap way out? | A: Moving to the simpler path would take about a quarter of one team's time.
- Q: Does your manager know? | A: They know about the symptom, not your conclusion.
- Q: Could it be fixed instead? | A: Partly; you estimate a fix costs more than moving away and leaves the main weakness.

**Hints.**
1. Write down the assumptions the original decision rested on, and check which ones failed.
2. Say it plainly and first to the people who need to act on it, with the evidence and a proposal; do not wait to be found out.
3. Judge the next step by future cost and benefit only; what was spent is gone either way.

**Follow-ups.**
1. How do you tell the decision was wrong rather than badly executed?
2. What exactly do you say to your manager, and to the engineer who raised the concern originally?
3. The engineers who built it want to fix it instead. How do you decide, and how do you keep them motivated either way?
4. What would you change in how the team makes decisions like this one?
5. In your real example, what did reversing the decision cost you, and what did it gain?

**Follow-up rules.**
- when: sunk cost, already invested, wasted → ask: The engineers who built it hear "sunk cost" as "your year was wasted". How do you talk about it with them?
- when: fix, improve, iterate → ask: What evidence would show the fix is working, and by when would you give up on it?
- when: credibility, trust, reputation → ask: Your next proposal is next quarter. What will people remember about this one, and what do you want them to remember?
- when: postmortem, retrospective, review → ask: What decision-making practice changes because of it, concretely, and who checks it is followed?
- when: we decided, the team decided, we agreed → ask: You championed it. Which parts of the decision were yours alone?

**Evaluation Criteria.** Tests the decision against its own assumptions and separates decision quality from execution and luck; raises it early, plainly and first with the people who must act, with evidence and a proposal; owns the original call, including credit to whoever raised the concern; decides the next step on future costs and benefits with a gradual, safe migration or a fix with kill criteria; treats the builders with respect and keeps their work's value visible; changes decision practice (written assumptions, review dates, exit criteria); real example with what happened and personal contribution, or honestly hypothetical.

## NVD-L5-05: Project deep dive, re-examined for accelerated computing at cluster scale

| | |
|---|---|
| **Template ID** | NVD-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, scaling onto GPU clusters |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "angle": ["the bottleneck that was hardest to find", "the decision that most changed what the system cost", "the failure that taught you the most"],
  "scale": ["10×", "50×"],
  "cluster_feature": ["jobs that span thousands of GPUs and all stop when one node fails", "GPUs shared between jobs by partitioning each into fixed-size slices", "a power cap per rack that the system must stay under"]
}
```

**Business Scenario.** In this part of the loop you describe a system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change if it ran on, or served, a large GPU cluster at {{scale}} today's load, where work is expensive per hour, tightly synchronised across many machines, and subject to {{cluster_feature}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at {{scale}} the load on a GPU cluster with {{cluster_feature}}. If you have never worked with GPUs or accelerated computing, say so, pick the closest system you have worked on, and be clear which parts you are recalling and which you are reasoning through.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The GPU cluster setting is hypothetical.

**Clarifications.**
- Q: Does it have to involve GPUs? | A: No. Any system that moves, stores or computes data others depend on counts; the GPU part is reasoning.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to data paths, bottlenecks, failure modes, costs and numbers.
- Q: What is special about a GPU cluster for this question? | A: Expensive hardware that should not sit idle, work synchronised across many machines, and failures that stop a whole job. Reason from those.

**Hints.**
1. Lead with the problem and the numbers, including peak against average, before the architecture.
2. Know where the time goes in your system: compute, waiting on data, waiting on other machines, or recovering from failure.
3. For the GPU question, ask what keeps expensive hardware busy and what happens to a synchronised job when one part is slow or fails.

**Follow-ups.**
1. What was the main alternative to your key decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. At {{scale}} the load, which component fails first, and how would you know before users did?
4. How would your system cope with {{cluster_feature}}, and what new failure does that bring?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: checkpoint, checkpointing, restart → ask: How often would you checkpoint, what does each checkpoint cost, and how much work is lost per failure at {{scale}}?
- when: utilisation, utilization, idle → ask: What fraction of the time was your expensive hardware actually busy, how did you measure it, and what kept it idle?
- when: bottleneck, profiling, profile → ask: How did you prove that was the bottleneck rather than a symptom of something upstream?
- when: cost, budget, spend → ask: What did the system cost per month, which part drove it, and what did you change because of it?

**Evaluation Criteria.** Clear problem framing with real numbers (volume, peak and average, latency or throughput targets, cost); depth on the chosen angle down to data paths, bottlenecks and failure modes; decisions explained with alternatives and evidence; an honest account of what broke and what changed; a scaling analysis that names the first bottleneck and how it would be seen early; a concrete reasoning about the GPU-cluster feature (checkpoint interval against failure rate, slice sizing and isolation, power headroom and its throughput cost) with its new failure modes; own contribution separated from the team's, or an honest statement of reasoning rather than recall.
