# Snowflake · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a cloud data
platform setting (warehouses, sharing, marketplace, ingestion); score them on
the rubric below, not on any company's published values or interview process.

## SNO-L5-01

**What a strong answer contains.**
- **First hours**: confirm containment from evidence, not assumption: access history for the exposed objects (which accounts read what, when, how many rows), a check of every other share and view built the same way for the same flaw, and the exact window. Give legal and the customer-facing team a written factual timeline the same day, marked with what is still unknown.
- **The executive**: a prompt, direct conversation, ideally before the review: what happened, that it is contained, what is known about impact, when the review lands. On the name: the change followed the process and passed two reviews, so the failure is in the process, which the candidate (and their manager) own; naming one person would make the next mistake less likely to be reported. Offer accountability in a form the executive can use: owners and dates for each action, and the candidate's own accountability for the team's process.
- **The review**: blameless in the sense that it explains how a reasonable engineer, following the process, made this change and how two reviewers approved it: no automated check of view filters against entitlements, review checklists that do not cover sharing, the ignored near miss. Each finding has an owner, a date and a way to verify it.
- **The engineer**: a private conversation early (not their fault alone, the resignation offer declined, what the review will and will not say), involvement in the fix if they want it, and public support in the review.
- **Actions that can be verified**: an automated pre-deploy test that queries each shared view as every entitled consumer and as a non-entitled one; entitlements keyed by stable account identifiers; alerts on access by unexpected accounts; the near-miss process fixed so near misses produce actions. Follow-up at a set date with evidence.
- **Real example**: an actual incident review with blame pressure, what the candidate did, what changed, and how the people involved fared.

**How to judge.** Probe the order of events: containment and facts before the executive conversation is right, but not days of silence to the executive. A candidate who gives the name to end the pressure, or who refuses the executive without offering accountability, both score low.

**Red flags.** Naming the engineer; firing or a performance plan as the action; "blameless" used to mean no owners; no check that the exposure is fully contained; actions with no owner or verification; telling the executive what they want to hear in private and something else in the review.

**Rubric anchors.** 2: either supplies a name or refuses the executive with no alternative; actions are "be more careful". 3: verifies containment, runs a process-focused review, answers the executive with owners and dates, supports the engineer, proposes an automated check. 4: also checks for the same flaw elsewhere, owns the process gap personally, fixes the near-miss loop, verifies the actions later with evidence, and gives a credible real example.

## SNO-L5-02

**What a strong answer contains.**
- **Evidence first**: an inventory built from the tools themselves (scheduler metadata, cron tables, the warehouse's task list, query history to find what each job reads and writes), with owners confirmed by asking; a dependency map derived from read and write sets; the incident record showing that hidden time-based dependencies are the main failure.
- **Target decision**: criteria tied to the problem: explicit dependencies (including data-driven triggers on table readiness), retries and backfills, observability, cost, operational burden, skills across {{teams}} teams. One target is the default; keeping the warehouse's own scheduled tasks for small in-warehouse transforms, or two tools with a single dependency layer, is acceptable if argued. Written recommendation with the alternatives.
- **Plan**: stop growth on the old tools (new pipelines on the target only, agreed with the director); make the target easier (templates, migration tooling that translates common patterns, docs, office hours, the three engineers pairing with teams); migrate by dependency cluster so explicit dependencies replace schedules early; customer-facing pipelines with dual running and output comparison, cut over in a window with rollback; retire orphan pipelines by switching them off with notice and watching for complaints.
- **Adoption**: what each team gains (fewer late-data incidents, less on-call, shared tooling); a visible tracker; escalation for teams that refuse, with a fair statement of their reasons; accepting a later date for some teams if the risk is contained (their pipelines kept behind a dependency interface).
- **Success**: incidents from late upstream jobs, percent migrated by pipeline and by criticality, old-tool cost retired, time to create a new pipeline. Decommission each old tool with a date and a final check that nothing runs on it.
- **Real example**: a migration or consolidation the candidate led or contributed to, with numbers, what went wrong, and what they personally drove.

**Red flags.** Choosing the tool first and the problem later; a big-bang cutover of everything; migration as a mandate with no help; ignoring pipelines without owners; no measure of success other than "all migrated"; no plan for customer-facing timing.

**Rubric anchors.** 2: "pick the best tool and tell everyone to move". 3: inventory, criteria-based choice, phased plan with growth stopped on old tools, support for teams, measurable outcomes. 4: also dependency-first migration addressing the actual incidents, dual running for customer-facing pipelines, orphan retirement with safeguards, fair escalation, decommissioning dates, and a credible real example.

## SNO-L5-03

**What a strong answer contains.**
- **This week**: a conversation with the VP to understand the need: what event it serves, the true deadline, who will use it, what the smallest version is that serves the event (a static report, a one-off extract, an existing dashboard filtered for the prospect or partner). A quick but honest estimate of the full and smaller versions with the team. A message to the manager with the facts and a proposed path, even on leave.
- **Options with costs**: (a) the smaller version in {{weeks}} weeks with a specific slip to the committed work; (b) the full request with the committed work delayed by a stated amount and the dependent teams' plans affected; (c) another team builds it with the candidate's team advising; (d) decline with reasons. Each states what the dependent teams lose.
- **Decision**: made by the person who owns both priorities (the VP's peer, the candidate's director or the manager on return), in writing; the candidate makes a recommendation and presents the VP's case fairly.
- **Communication**: the VP hears the options and the decision promptly; the dependent teams hear of any change the same day with a new date; the team hears why. If the decision goes against the committed work, the candidate commits to it and re-plans visibly.
- **Repeat requests**: a lightweight intake rule agreed with leadership (requests of this size go through the manager and a weekly decision), not a wall.
- **Real example**: an actual collision of urgent and committed work, what was traded, who decided, and how it looked afterwards.

**Red flags.** Saying yes and quietly working weekends; saying no without options; bypassing the absent manager entirely or waiting a week for them; letting the dependent teams find out late; treating the VP as an adversary.

**Rubric anchors.** 2: yes to everything, or a flat no. 3: clarifies the need, offers costed options, gets a decision from the right owner, tells dependent teams. 4: also finds the smallest sufficient version, protects the team's sustainability, presents both cases fairly in writing, sets an intake rule for next time, and gives a credible real example.

## SNO-L5-04

**What a strong answer contains.**
- **Measure first**: instrument event time, arrival time at each of the pipeline's stages and visible time in the feature; the current distribution of lag ({{lag}}) broken down by stage, which usually shows one stage (the daily job) dominating.
- **Definition**: for example "the share of minutes in a 28-day window in which data for events older than X minutes is visible in the feature", or "p95 over a 28-day window of (time visible − event time) for events, measured by a canary event injected every N minutes". It states which timestamp, where it is measured, the percentile, the window, and how late-arriving and restated data count.
- **Need**: talk to users and to support about the {{complaints}} complaints: which decisions they make with the feature and when; complaints about numbers changing after a decision are about restatement and labelling, not only lag.
- **Options and cost**: run the daily stage more often; incremental processing of new data only; micro-batches every few minutes; streaming ingestion for the hot path only. Each with warehouse cost (within the one-third budget limit) and team time for the quarter. Show the curve: most of the benefit usually comes from removing the daily stage.
- **Agreement**: a written objective with product, what customers are told (the feature shows "data as of" time), and what is explicitly not promised; sales messaging corrected if it said "near real time" without basis.
- **Operating it**: freshness shown in the feature itself; alerts on the objective's burn rate to an owning on-call; an agreed response when missed (freeze risky changes, prioritise fixes over features); a quarterly review with product.
- **Real example**: an objective the candidate set with a partner team, how it was measured, what changed in both teams' behaviour.

**Red flags.** Promising "real time" without cost; an objective on averages; no measurement in the feature; an objective with no owner or response; ignoring that some complaints are about restatements.

**Rubric anchors.** 2: picks a number and builds to it. 3: measures current lag by stage, defines freshness precisely, costs options, agrees in writing with product, alerts an owner. 4: also grounds the target in user decisions, handles restatement and "as of" labelling, uses an error budget with an agreed response, corrects external promises, and gives a credible real example.

## SNO-L5-05

**What a strong answer contains.**
- **Overview**: problem, users, real numbers (volume per day, peak to average, data size, latency or freshness targets, monthly cost), architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the hardest workload, what made it slow (data layout, joins, skew, concurrency, contention with other workloads), how it was measured, what changed and the measured result; for the cost decision, the baseline, the analysis, the change and the trade-off accepted; for the failure, detection, diagnosis, recovery and the lasting change.
- **Scaling to {{scale}} with tenants on elastic compute**: what is shared (storage and metadata) and what is per tenant (compute); the first bottleneck named with a reason from their numbers (a shared metadata store, a single scheduler, concurrency limits, a hot table, a nightly window); how they would see it coming (queue time, spill, lag).
- **The tenant feature**: for per-tenant compute that suspends when idle, resume latency and the first query after resume, any minimum billed period after each resume (for example a 60-second minimum, as an exercise rule; check current docs), and auto-suspend thresholds against cost; for spending limits, metering per tenant, alerts at thresholds, and what a hard stop does to running and critical jobs; for isolation, separate compute per tenant or per workload class, queueing and concurrency limits, and what still is shared (storage throughput, metadata, cache). Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's and what was theirs.

**How to judge.** Probe numbers (per day or total? what peak?), the alternatives they considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims all of it but cannot explain its workloads, keys or costs does not.

**Red flags.** Buzzwords without numbers; "autoscaling solves it" with no signal, delay or cost; numbers that change under questioning; no failures; cannot separate own work from the team's; isolation claimed with everything still shared.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the angle, honest failure, a named first bottleneck, a workable tenant feature. 4: also alternatives with evidence, explicit shared-versus-dedicated decisions with their costs, new failure modes of the tenant feature anticipated, crisp separation of own and team contributions, and lessons that changed practice.
