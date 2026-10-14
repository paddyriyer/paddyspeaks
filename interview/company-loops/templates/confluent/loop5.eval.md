# Confluent · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a data streaming
setting; score them on the rubric below, not on any company's published values
or interview process.

## CFL-L5-01

**What a strong answer contains.**
- **First days, evidence**: read the {{incidents}} incident reports and confirm the default is the common cause (and whether a better default would have prevented each). Use client and topic telemetry to find workloads that rely on the current behaviour, and separate those that set it explicitly (a deliberate choice) from those that inherited it. Talk to a sample of each group, including large customers and a few small ones, to learn why. State the confidence of the list and its gaps (workloads whose behaviour telemetry cannot show).
- **The change design**: an explicit setting that keeps the old behaviour for anyone who wants it; new resources get the safe default first; existing resources keep their behaviour unless the owner opts in, or are moved after notice where telemetry shows they cannot be relying on it. Notice periods proportionate to impact, written guidance on the trade-off (for example latency versus durability, availability versus consistency), and a time-boxed opt-out with an end date and review.
- **Rollout**: staged by cohort, with stop criteria defined in advance (support tickets for the affected behaviour, error rates, latency for opted-in workloads), and a fast rollback for new resources.
- **The objecting customer**: understand the contract and the latency or availability need, show the measured cost of the safer setting for their workload, offer to keep their explicit setting, and agree a plan; do not make an exception to the default, make an explicit configuration.
- **Decision**: product, support and the team agree on criteria; if they cannot, a director decides from a one-page summary both sides agree is fair.
- **Afterwards**: measure incidents tied to the default before and after; publish the change and the reasoning.
- **Real example**: a behaviour others relied on, how the candidate found the dependents, what they missed, and what they would change.

**Red flags.** Flipping the default for everyone at once; treating telemetry as proof of intent; no notice or no opt-out; letting the opt-out live forever without a plan; refusing to change anything because one large customer objects; a real example with no personal contribution.

**Rubric anchors.** 2: "announce it and flip it", or "too risky, leave it". 3: evidence on who relies on it, new-resources-first change with an explicit override, notice and staged rollout with monitoring. 4: also deliberate versus inherited reliance, predefined stop criteria, a fair escalation path, a time-boxed opt-out with an end, measured results, and a credible real example with lessons.

## CFL-L5-02

**What a strong answer contains.**
- **First two weeks, sizing**: use broker-side telemetry (client versions, protocol versions, consumer configurations) across the {{clusters}} clusters, plus scans of configuration and code repositories, to list affected applications and owners; classify them as no work, small (configuration or a library bump) or large (code changes), and confirm a sample with the teams. Usually most are small; a few are hard.
- **Reduce the work**: compatibility measures with an end date where they are cheap; automated detection in CI that tells a team exactly what to change; upgrade guides; the platform team opening pull requests for the small cases; a test environment on the new version teams can point at. Spend the three engineers where they remove the most work across teams.
- **Credible deadline**: the director asks peer directors to commit to the date; an exception process (who grants it, on what evidence, what the team owes, for example a dated plan and the risk accepted in writing by their director); a visible tracker by team that shows progress without shaming.
- **The long tail**: one team at a time; for the team with a key launch, offer platform engineers to do the work, a short exception with a dated plan, or isolating them on a cluster upgraded last; escalate only with options.
- **Next time**: a supported-version policy (n and n−1), continuous checks that flag deprecated usage as soon as it appears, small regular upgrades, and deprecation warnings visible to teams long before removal.
- **Real example**: a change others had to do work for, what actually made people move, and what the candidate would do earlier.

**Red flags.** More newsletter announcements; blaming teams; a mandate with nothing done to reduce their work; no exception process; no plan for the next upgrade; a real example with no measurable outcome.

**Rubric anchors.** 2: announce a deadline and escalate. 3: measures impact, removes work with tooling and pull requests, a backed deadline with a tracker, works the long tail. 4: also an agreed exception process, options for the launch team, prevention through supported-version policy and continuous checks, and a credible real example with what made people move.

## CFL-L5-03

**What a strong answer contains.**
- **First meeting**: with the customer's engineers, not only their buyers: what problem (for example records that must not be readable after a time limit for compliance, routing that keeps related records together, throughput on one topic), what they do today, what "done" means and how it is audited. Many such requests can be met another way: retention settings or a downstream deletion process, keys chosen by the producer, a stream processing job that re-keys or filters, a client-side setting.
- **Options with costs**: (a) solve it outside the engine with existing features, possibly with the team's help, fastest; (b) build it as an extension point or plugin interface that upstream might accept, with an upstream proposal reviving the stalled one; (c) build it only in this engine (fastest to the customer, highest long-term cost: every upgrade carries the change, it must be supported for every customer, and it can conflict with a later upstream design). Price divergence as effort per release over years, and support load.
- **Decision**: a written recommendation to the engine's product lead with the options, costs, the customer's real need and the account risk; the account owner's view included fairly. Respect the decision.
- **Sales**: reset expectations together, framed as "here is how we solve your problem", not "engineering said no"; join the customer call.
- **If building**: behind a clean interface, tested, documented, aimed at upstream, with an exit plan if upstream chooses a different design, and an owner.
- **Real example**: a time they said "not like that" to an important stakeholder, what they offered instead, and the effect on the relationship.

**Red flags.** Building whatever is asked because of revenue; refusing outright without understanding the need; treating the decision as theirs alone; undermining sales in front of the customer; ignoring upgrade cost; a story where the stakeholder simply gave in.

**Rubric anchors.** 2: "build it, it's a big customer" or "no, we do not fork". 3: finds the underlying need, offers options including outside the engine, prices divergence, takes it to the decider. 4: also an upstream path with a bridge, works with sales to reset expectations, an exit plan for anything built, and a credible real example with the relationship outcome.

## CFL-L5-04

**What a strong answer contains.**
- **Diagnose first (first week)**: rebuild last month's incident timeline with the {{handoffs}} handoffs and measure the time lost at each; list design reviews and how long they waited; ask each region privately what slows them and how decisions reach them.
- **Ownership**: each region owns whole areas of {{owns}} (components, roadmap items, on-call for its hours), including design decisions, not just tasks handed over at the end of another region's day.
- **Handoffs**: a written format for incidents (current state, impact, what was tried and ruled out, hypotheses, next steps, who owns it now, how to reach the previous owner) kept in the incident tool's timeline as work happens; a similar short note for ordinary work in flight. Incidents keep a single incident commander per shift with an explicit handover.
- **Decisions**: written proposals with a stated comment window covering all three regions' working days, an explicit decider, and a recorded decision; meetings only for what writing cannot resolve, at times rotated or chosen so no region always pays.
- **On-call**: follow-the-sun where it helps, with the trade-off stated (handoffs on long incidents) and an option to keep the current owner on a little longer if they are close to a fix; no routine out-of-hours work.
- **Equity and growth**: senior engineers mentor across regions; lead roles and design ownership are given to the region with fewer senior engineers; the lead's own location is not where all decisions happen.
- **Measure (three months)**: time lost per handoff on incidents, decision latency for design reviews, survey of each region on whether they can influence decisions.
- **Real example**: a distributed team they led or worked in, what they changed, and what still did not work.

**Red flags.** More meetings at times that suit the lead's region; "just document more" with no format or ownership; treating one region as the night shift; expecting people to work outside their hours; no measurement.

**Rubric anchors.** 2: adds a daily all-hands meeting or a chat channel. 3: diagnoses the lost time, a written handoff format, regional ownership of whole areas, written decisions. 4: also on-call designed with handoff trade-offs, growth for the less senior region, fair meeting times, measurement after three months, and a credible real example with honest results.

## CFL-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **As event streams at {{events}} of events per second with {{guarantee}}**: starts from the key and what must be ordered relative to what; names the assumptions in their system of once-only and in-order arrival. For per-key ordering: partition by the key, keep partition counts stable (adding partitions changes key placement), idempotent producers so retries do not reorder or duplicate, one writer per key. For replay without disturbing live consumers: retention or tiered history long enough, separate consumer groups and quotas for replay, reading from replicas or a separate store, and checking replayed results against the originals. For exactly-once counting: transactions with offsets committed atomically, or idempotent outputs keyed deterministically, plus read-committed consumers. For readable old events: a schema registry with compatibility rules checked at write time, schema ids in each record, and transitive compatibility for long histories. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; an event-stream answer that assumes global ordering or exactly-once delivery for free.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, named ordering and delivery assumptions. 4: also alternatives with evidence, an incremental and correct path to the required guarantee with its costs stated, crisp separation of own and team contributions, and lessons that show changed practice.
