# xAI · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in the setting of a
model API platform; score them on the rubric below, not on any company's
published values, culture statements, management frameworks or interview
process, and do not reward an answer for reciting one.

## XAI-L5-01

**What a strong answer contains.**
- **First hour**: acknowledge publicly through support with what is known, what is being checked and when the next update will come; no claim that the limiter is fine and no admission of a fault not yet established. Ask a few affected teams, through support, for permission to look at their own traffic and for exact times of rejections.
- **First day**: name the evidence gap precisely ({{evidence_gap}}) and close it for the cases in hand: reconstruct those teams' traffic at the resolution enforcement uses (per second, with reservations for in-flight tokens and retries counted), and compare with the limit snapshot actually enforced in each region. Check systematically for differences by tier, region and model rather than assuming fairness.
- **With the enforcement team**: a shared, blameless investigation over the same data; agree in advance what result would show a fault.
- **Outcomes planned in advance**: if the developers are right, own it publicly, fix it, and take a recommendation on credits to the people who decide; if partly right (for example client retries plus a regional bug), say both plainly and help teams with their clients; if wrong, show each team its own traffic at enforcement resolution and improve the docs and headroom view that misled them. Never discuss one team's usage with another or in public.
- **Weeks after**: keep rejection records with limit type, region and tier version, at per-second resolution, for long enough to answer complaints; give teams a headroom view that matches enforcement.
- **Real example**: a real dispute where the data was ambiguous, what evidence was gathered, what settled it, and whether the candidate's own view changed.

**How to judge.** Credit candidates who resist both defending the system by reflex and conceding to the loudest voices, and who fix the measurement so the question becomes answerable. Look for early, honest, non-committal communication with a date for the next update.

**Red flags.** "The limiter works as designed" before any evidence; promising credits they do not own; averages used to dismiss per-second complaints; discussing a team's usage publicly; no change to the data kept; a real example where the other side was simply wrong and nothing was learned.

**Rubric anchors.** 2: defends or concedes without evidence, communicates late. 3: communicates early, gets evidence at the right resolution for exact cases, plans for each outcome. 4: also systematic fairness checks by tier and region, a blameless joint investigation, durable changes to the data kept and the headroom view, and a credible real example.

## XAI-L5-02

**What a strong answer contains.**
- **First minutes**: establish the real bottleneck ({{constrained}}) from saturation signals rather than symptoms; check whether part of the traffic is retries that can be shed cheaply.
- **Protection order stated up front**: existing production workloads on older models and their commitments; correctness of billing, usage accounting and rate-limit enforcement; then launch availability. Data correctness is never traded for availability.
- **Cuts in order, explicit and reversible first**: pause batch within its completion window with someone watching the clock; slow or pause analytics pipelines sharing the infrastructure; let the usage console lag with a visible "delayed" label while the accounting itself stays correct; cap new-model access for new teams with a public, stated limit or a waitlist; label search results as delayed if freshness is degraded, so the model and the developer know. Silent degradation is avoided.
- **Decision rights**: the incident lead decides operational shedding within an agreed playbook; product-visible changes (who gets access, public limits) are decided with the product lead quickly, with a clear recommendation.
- **Communication**: a status update within the first hour, then on a fixed cadence; the message says what is limited, for whom, and when the next update comes.
- **The following week**: a blameless review, a forecast that includes launch uncertainty, load tests at multiples of the forecast, and a pre-agreed shedding plan with owners.
- **Real example**: a real overload, what they cut and in what order, and what they would change.

**How to judge.** Look for a reasoned order and explicit, reversible measures. Credit candidates who keep accounting correct while letting views lag, and who push back with evidence on degrading existing customers to protect a launch.

**Red flags.** Cutting existing production workloads to keep the launch shiny without discussion; silent degradation; "add more servers" as the plan; pausing batch without watching the completion window; letting billing or rate-limit accounting drift; no communication until it is over.

**Rubric anchors.** 2: firefights without a protection order, or waits for capacity. 3: finds the bottleneck, states what is protected, cuts in a sensible order with reversible measures, communicates. 4: also clear decision rights, visible degradations, clocks watched on paused work, a credible follow-up plan, and a credible real example.

## XAI-L5-03

**What a strong answer contains.**
- **Sorting**: for each proposal, the cost and possibility of undoing it and who bears that cost. Turning off a non-critical pipeline and temporarily raising limits are cheap to undo (raising limits does carry a capacity risk and a public expectation; a strong answer notes it); moving one model's traffic to one region is undoable but risky for capacity and for teams with residency settings; a public statement with numbers is very hard to retract; changing a public API field's format breaks customers' code; changing a billing computation retroactively touches money; deleting partitions of unreplicated data is irreversible.
- **Delegation**: reversible proposals delegated to the {{team_size}} engineers immediately with clear boundaries ("you may turn off these pipelines; tell me when you do").
- **Making decisions cheaper to undo**: snapshot or copy the oldest partitions (or confirm which are backed up) before deleting, or free space by other means first (compress, move cold data, turn off writers of non-critical data); add a new field rather than change the existing one; apply the billing change only to usage from a timestamp; put the pricing change behind a flag; move traffic in stages.
- **Minimum evidence for irreversible ones**: which partitions are backed up and who needs the rest; whether customers parse the field; whether the statement's numbers are confirmed. Escalate with a crisp ask in minutes.
- **Records**: a running decision log with time, decision, who made it, what was known and how to undo it; reviewed the following week.
- **Real example**: a real irreversible decision under pressure (made or witnessed), whether it really was irreversible, and what would have made it cheaper to undo.

**How to judge.** The best answers do not slow everything down equally: they move fast on the reversible ones and spend their time on the two or three that cannot be undone, often by turning them into reversible ones. Do not reward a recited framework or slogan; reward the specific sorting and the specific way to reduce the cost of undoing each proposal.

**Red flags.** Treating every proposal with the same urgency; deleting data before checking backups; changing public formats in place; announcing numbers before they are confirmed; escalating everything, or nothing; no record of decisions.

**Rubric anchors.** 2: decides in the order proposals arrived, or freezes. 3: sorts by cost of undoing, delegates reversible ones, insists on evidence for irreversible ones. 4: also makes irreversible proposals reversible before acting, escalates with crisp asks, keeps a decision log, and gives a credible real example.

## XAI-L5-04

**What a strong answer contains.**
- **Confirm**: test the actual behaviour directly; find who relies on the documented behaviour from support tickets, public client code and request patterns; estimate the harm (for example teams mis-sizing requests if they believed only input tokens count; results mismatched if they relied on submission order; code that crashes on a citation without a URL; numbers treated as final too early).
- **Decide which behaviour wins**: by harm to affected customers. Sometimes the system should change to match a reasonable documented promise (with the owning team's agreement and a rollout); sometimes the docs change, with a migration path. Either way, state the trade-off and who decided.
- **Correct visibly**: a dated note near the top of the page saying what the page used to say, what is true, and since when; a changelog entry; never a quiet edit.
- **Reach people**: contact affected teams and library maintainers directly, with examples and a migration path; a grace period where the system can offer one.
- **Closed bugs**: reopen them, answer each reporter, and thank them; take ownership without blaming support.
- **Process**: docs reviewed against shipped behaviour before publishing; executable examples or contract tests for documented behaviours; an owner per page.
- **Real example**: something they published that was wrong, how they found out, how they corrected it, and how the people affected responded.

**How to judge.** Credit candidates who make the correction visible, choose by harm rather than convenience, and fix the drift process. A quiet fix is a strong negative signal.

**Red flags.** Quietly editing the page; changing the system without checking who relies on current behaviour; blaming support or the original writer; a changelog entry as the only outreach; no process change.

**Rubric anchors.** 2: fixes the page and moves on. 3: confirms behaviour and reliance, corrects visibly, reaches affected teams, reopens closed bugs. 4: also decides docs-versus-system by harm with the trade-off stated, offers a migration path, puts contract tests or executable examples in place, and gives a credible real example.

## XAI-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one request or one post and names the assumptions that break at the scale (one central counter, one database for everything, deletes applied in place, prices applied in queries, logs shipped to one place). For limits across regions: regional shares of each team's limit with rebalancing and a stated overshoot bound, versioned limit snapshots with enforced versions reported. For searchable within a minute and never after deletion: a time-partitioned index with a fresh in-memory tier and tombstones checked at serve time on every path including caches and replicas. For usage to the cent: one priced usage fact in integer minor units with versions recorded at write time and a continuous tie-out against invoices. For residency: allowed regions resolved at the edge and enforced at every hop, the serving region recorded on every record, and only aggregates leaving a region. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "real time", "accurate" or "global".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination with a synchronous global counter on every request, caches that can return deleted posts, floating-point money, or request logs copied to a central store regardless of residency.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
