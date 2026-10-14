# NVIDIA · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a GPU cluster and
accelerated-computing setting; score them on the rubric below, not on any
company's published values, culture or interview process.

## NVD-L5-01

**What a strong answer contains.**
- **First day: test the requests.** Ask each team how its number was made (model size, tokens or samples, measured throughput per GPU, number of runs including failures and restarts, evaluation needs) and compare with its own history on the cluster. The utilisation gap (45% against 70% of held GPUs) is evidence: the lower team may be able to do the same work with fewer GPUs, or may have a fixable input or configuration problem. An inflated request is handled privately and factually, not as an accusation.
- **First week: shrink the gap.** Each option with a rough size: efficiency help from the platform team for the 45% team (input pipeline, batch size, checkpoint frequency), with the gain measured, not promised; preemptible or off-peak scheduling for work that can wait; pausing other teams' work for the period, with its cost stated to them and to the decider; capacity from elsewhere (another cluster, rented capacity) with its cost; scope cuts each team could make (fewer ablations, a smaller evaluation). Often the shortfall falls from {{shortfall}} to something much smaller.
- **Decision**: the business priority is not the platform team's to set. The candidate prepares a short written decision for the director: the remaining gap, two or three allocation options, what each team can deliver by its date under each, the risks, and a recommendation if asked; both teams' leaders see the document before it goes up and agree it represents them fairly.
- **Enforcement**: the allocation is written as quotas or reservations in the scheduler with start and end dates, not as a verbal promise; idle reserved GPUs can be borrowed by the other team preemptibly.
- **Communication**: both teams told together, with the reasoning; the rest of the cluster told what pauses and for how long; a shared dashboard of each team's usage against its allocation.
- **Revisiting**: a weekly check against each team's plan; a pre-agreed rule for moving GPUs (for example, a team ahead of plan releases its reservation early; the decider is asked only if the rule does not cover the case).
- **Real example**: a scarce resource divided among people who needed it (hardware, headcount, a release slot, on-call time), what the candidate did, the outcome and how the losing side was treated.

**Red flags.** Deciding the business priority alone, or splitting evenly to avoid conflict when that makes both miss; promising both teams their share; ignoring efficiency evidence; an allocation that lives only in conversation; no plan for the rest of the cluster; a real example where the candidate simply "found more capacity" and nothing was traded.

**Rubric anchors.** 2: picks one team or splits evenly, with little evidence. 3: tests requests against history, reduces the gap with concrete options, prepares a decision for the right owner, enforces the result in the scheduler. 4: also a fair written decision both teams endorse as accurate, measured efficiency gains, costs to other teams made explicit, a rebalancing rule agreed in advance, and a credible real example.

## NVD-L5-02

**What a strong answer contains.**
- **First hour**: say no to rerunning until a number matches; that is selecting a result, not reproducing one. Tell the engineer why without humiliating them (it is a natural instinct under pressure). Freeze the current state of what is known: everything recorded about the original run, and the environment of the rerun.
- **First day**: measure run-to-run variance on the current setup (several runs, on different nodes); reconstruct the original environment as far as possible (driver, toolkit and library versions, container image digest, firmware, per-GPU power limit and clock settings, node list, configuration, data); list the known changes since (the driver update, the firmware update on some nodes, the power-limit change).
- **First week**: bisect: change one factor at a time back to its original value and measure, starting with the most likely and cheapest (the power-limit change is a strong first suspect for a throughput gap; node selection second). Two outcomes, handled differently: something changed (then the original may still be right for its environment, and the report must say which environment) or the original was an outlier (best of three on unusually fast nodes, so the reported number overstated typical performance).
- **Correction**: decided by evidence and by how the audience used the number: customers relying on {{result}} for capacity plans need a prompt, clear correction with the reproduced number and its spread; a library standardisation decision needs its owners told and the decision re-checked; a public write-up needs an update note, not a silent edit. The candidate owns the sign-off; the correction does not wait for the result to look better, and it does not single out the original engineer.
- **Practice change**: a benchmark harness that records the full environment automatically (software digests, firmware, power and clock settings, node ids, configuration, data version) with each result; at least N runs on varied nodes, reported as median and spread; results stored with their records; review of any externally used number by someone who reruns it from the record. Make it the easy path, not a checklist.
- **Real example**: a reported result that turned out wrong or irreproducible, how it was found, how it was corrected and to whom, and what practice changed.

**Red flags.** Rerunning until it matches, or publishing the better of new runs; quietly editing the published number; blaming the original engineer; a correction delayed for appearances; "pin the container" as the whole fix; a real example where the error was someone else's and the candidate only pointed it out.

**Rubric anchors.** 2: reruns and tweaks until it matches, or argues the new run is wrong. 3: measures variance, reconstructs the environment, isolates the cause, corrects the published result and changes the benchmarking practice. 4: also distinguishes outlier from environment change and acts on each correctly, proportionate corrections to each audience with ownership of the sign-off, fair treatment of the engineer, a harness that makes full records automatic, and a credible real example.

## NVD-L5-03

**What a strong answer contains.**
- **Learn first**: how the hardware team decides (its requirements process and quarterly review, who weighs requests, what a feature costs them in area, power, validation and schedule); what it already plans; whether the need could be met by firmware or the driver. Find a contact who will explain this honestly, and listen before asking.
- **Make the case in their terms**: the need, separately from a proposed mechanism ("we cannot tell which of these failures are hardware without X" rather than "add register Y"); the cost of not having it, from the team's own data (incidents where the missing capability delayed diagnosis, hours spent on workarounds, failures missed); other teams with the same need, gathered into one request with one owner. A short written request (a page or two), with priorities and smaller alternatives (a subset, a firmware-only version, a debug-only mode).
- **Timing**: the request goes in well before the design freeze in {{freeze_months}} months, at the next review, not at the last minute.
- **The gap**: whatever the answer, the team plans for {{cycle}} without the capability: maintained workarounds, software or firmware measures, and data collection that will show whether the hardware change, when it comes, works.
- **Relationship**: share field data back (failure statistics, telemetry they would not otherwise see), give early feedback on their designs, keep a named contact on both sides, and follow up after the decision either way. Accept a "no" this generation with a plan for the next.
- **Real example**: a dependency on a team with a very different cadence or constraints (hardware, a vendor, a regulated system, a platform with long release trains), what the candidate learned about their constraints, how the ask changed, and the outcome.

**Red flags.** Escalating to force the request in; asking for a specific mechanism without explaining the need; no data on the cost; treating the hardware team as slow rather than constrained; no plan for the years in between; a real example where the other team was simply wrong.

**Rubric anchors.** 2: files a request and escalates when it stalls. 3: learns their process, quantifies the need, asks early with alternatives, plans for the gap. 4: also gathers other teams into one request, separates need from mechanism so they can propose a cheaper way, builds a two-way relationship with field data shared back, and a credible real example.

## NVD-L5-04

**What a strong answer contains.**
- **Diagnose honestly**: write down the assumptions the original argument rested on (cost estimates, adoption, reliability) and test each against what happened. Separate a wrong decision (the assumptions were wrong, or a known risk was dismissed) from a good decision badly executed or unlucky. The engineer who raised the cost concern was right; that is part of the evidence.
- **Say it first and plainly**: to the manager who backed it, before they hear it elsewhere, with the evidence and a proposal; then to the team and to the dependent teams. Credit the engineer who raised the concern, specifically. No hedging language that makes it sound like circumstances.
- **Next step on future costs only**: compare moving to the simpler path (about a quarter of one team's time) against fixing (estimated to cost more and keep the main weakness) against keeping it with limits (stop extending it, freeze its scope). Choose with the team; if a fix is tried, set measurable criteria and a date after which the move happens anyway.
- **Migration**: gradual and safe, since teams depend on it: run both, migrate users with support, keep the old path until the last one moves, measure the result.
- **People**: the builders learned and delivered real things; say what carries over (skills, components, knowledge about the problem). Involve them in the migration plan and listen to the case for fixing before deciding. Those who argued for the other path get credit, and the candidate steers the team away from "told you so".
- **Decision practice**: written assumptions and exit criteria for significant designs; a review date after launch to check them; dissent recorded in the design document and revisited; the candidate's own habit (for example, asking for the strongest case against their proposal).
- **Real example**: a decision the candidate championed and later reversed, how they recognised it, how they said it, the cost and the change in their practice.

**Red flags.** Blaming execution, the team or circumstances for a decision they made; waiting to be found out; doubling down on a fix to avoid admitting error; sunk-cost reasoning; dismissing the builders' work; a real example where the "mistake" was trivial or someone else's.

**Rubric anchors.** 2: admits a problem but frames it as bad luck or execution. 3: tests the decision against its assumptions, owns it to the manager and team, chooses the next step on future cost with a safe migration. 4: also credits the dissenter, treats the builders with care, sets kill criteria for any fix, changes decision practice concretely, and a credible real example with a personal cost.

## NVD-L5-05

**What a strong answer contains.**
- **Overview**: problem, users, real numbers (volume, peak and average, data size, latency or throughput targets, monthly cost), architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the bottleneck, how it showed up, how it was measured and proved (a profile, a controlled experiment), what changed and the measured result; for the cost decision, the baseline, the analysis, the change and the trade-off accepted; for the failure, detection, diagnosis, recovery and the lasting change.
- **Scaling to {{scale}} on a GPU cluster**: what keeps the expensive hardware busy (input pipelines, data locality, overlap of communication and compute) and what makes it idle; the first bottleneck named with a reason from their numbers (storage throughput for data and checkpoints, a central coordinator, network, a single database).
- **The cluster feature**: for whole-job failure, checkpoint interval against failure rate (with mean time between failures falling as the number of nodes rises, a rule of thumb is to checkpoint so that expected lost work plus checkpoint cost is minimised), fast restart and node replacement, and checkpoint storage bursts; for slices, sizing and how much isolation they really give (in this exercise each slice has its own memory and compute, while the host's CPUs, storage and network stay shared; check current docs for any real product), fragmentation and placement; for a rack power cap, synchronised power ramps, throughput lost to lower limits, and placement by headroom. Accept other sound reasoning that fits their system.
- **Honesty**: what failed, what they would change, what was the team's and what was theirs; a candidate without GPU experience says so and reasons well.

**How to judge.** Probe numbers (per day or total? what peak?), the alternatives they considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims all of it but cannot explain its data paths, bottlenecks or costs does not.

**Red flags.** Buzzwords without numbers; "add more GPUs" as the scaling answer; no failures; numbers that change under questioning; cannot separate own work from the team's; claiming GPU experience they cannot explain.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the angle, honest failure, a named first bottleneck, workable reasoning about the cluster feature. 4: also alternatives with evidence, quantitative reasoning about utilisation and failure cost at {{scale}}, new failure modes of the cluster feature anticipated, crisp separation of own and team contributions, and lessons that changed practice.
