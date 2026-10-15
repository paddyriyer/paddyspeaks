# CoreWeave · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a GPU cloud setting;
score them on the rubric below, not on any company's published values, culture
statements, management frameworks or interview process, and do not reward an
answer for reciting one.

## CRW-L5-01

**What a strong answer contains.**
- **First hour**: confirm the forecast with the hall team (the range, what drives it, when it will narrow); check which ramp steps and which customers depend on that hall; separate known, estimated and unknown.
- **First day**: brief the account lead in person with the facts, the range and the other affected customers; argue for telling the customer now rather than in a week, because a customer who plans {{customer_plan}} needs every week of warning, and a later discovery destroys trust in every date that follows. Agree who tells the customer (the account owner, with the candidate present for technical questions) and when (before the scheduled call if the news is material).
- **Options, checked**: another region (latency, data location and the customer's own constraints), another GPU type (does the workload run, at what performance), a partial delivery of what is ready, a bridge from on-demand capacity, or a changed ramp. Each is tentatively held before it is offered, and none is offered as certain if it is not.
- **Commitments**: a new date stated with its confidence and the conservative end of the range, plus a fixed schedule of updates (for example weekly) whether or not anything changed. Contract remedies are for the account and legal teams; the candidate makes sure nothing is promised before they decide.
- **Fairness**: the two smaller customers are told on the same timeline, and the capacity that does arrive is shared by a documented rule, not by who shouts loudest or is largest.
- **Afterwards**: follow through to delivery; review why the slip was seen this late and change the forecast (conservative dates, earlier warning thresholds).
- **Real example**: a real occasion of delivering bad news about a date, with what they said first, what options they brought, and how it landed.

**How to judge.** Look for the balance between speed and accuracy: early warning with an honest range beats a precise date later. Credit candidates who refuse to hide the news and also refuse to over-promise to soften it.

**Red flags.** Waiting for certainty; letting the account team carry the news without facts; offering options that were not checked; promising a firm new date; promising credits or discounts they do not own; treating the larger customer first by default; a real example where the bad news was someone else's fault and nothing was learned.

**Rubric anchors.** 2: tells the customer late or vaguely, or promises a firm date. 3: verifies, tells early through the account owner with a range and checked options, respects decision rights. 4: also consistent treatment of all affected customers, an update cadence, a changed forecasting practice, and a credible real example.

## CRW-L5-02

**What a strong answer contains.**
- **Diagnose from the incidents**: a short blameless review of all {{incidents}} incidents together, looking for the shared failure mode (a single person on the critical path, a manual step without a check, no single source of truth, no ownership of the whole). For {{process}}, name the specific way it fails at the new size (concurrent edits without history; a reviewer who is a queue and a single point of failure; on-call load and context too wide for anyone; answers that disagree because each query differs).
- **Proportionate replacement**: the smallest change that would have prevented most incidents, which removes the failure mode instead of adding approvals: for example a system of record with history and conditional updates instead of the spreadsheet; automated checks plus a rota of reviewers with written guidelines instead of one reviewer; service ownership with focused rotas instead of everyone on call; one governed definition and query for billing answers with an owner. Sized to the growth rate, with its cost stated.
- **Ownership**: the people who built and run the current way are invited to design the replacement; credit what the old way did well and keep it (speed, direct knowledge).
- **Rollout**: incremental, in parallel with the old way for a period, with a measurable outcome (incident rate, review wait time, page load per person, disagreement rate in billing answers) and a review date.
- **Real example**: a way of working the candidate changed, the evidence used, resistance met, and what changed in their own proposal.

**How to judge.** Credit diagnosis from evidence and structural thinking over blame. The best answers resist both "be more careful" and a heavy programme of gates.

**Red flags.** Blaming individuals; adding approvals as the default fix; a big-bang replacement; ignoring the people who run the current process; no measure of success; a real example that is only about a tool purchase.

**Rubric anchors.** 2: "more process" or "more care", no diagnosis. 3: diagnosis from the incidents, a proportionate replacement, owners involved, incremental rollout. 4: also explicit measures and a review date, what to keep from the old way, attention to the next scaling limit, and a credible real example.

## CRW-L5-03

**What a strong answer contains.**
- **Establish the facts**: test what the platform actually does today for {{gap}} (read the code or configuration, run it, ask the owners), and correct the outdated documentation through its owners so the answer and the documents agree.
- **Ask why**: through the account team, find out what risk the prospect wants covered; a different control may address it (for example access logging and approval for operator access, encryption with platform-managed keys plus strict key access controls, a contractual deletion process with evidence).
- **The answer**: precise and testable, drafted for the security and legal owners: what exists, what does not, what mitigates the gap, and, only if agreed, a plan. No "technically true but misleading" wording.
- **Pressure**: if a colleague already said yes, raise it with them and the account lead privately and quickly, and correct the record with the prospect before signing; never let an inaccurate answer become a contract term. A competitor's claim is not a reason to overstate; offer to demonstrate what exists.
- **Roadmap**: a date only after the owning teams agree and the displaced work is named; frame the trade-off for the director (deal value and strategic need versus the planned item and its customers), with options.
- **After the answer**: track the commitment, update the prospect if it slips, and use the questionnaire to find other customers who asked or will ask the same.
- **Real example**: an honest answer that put something at risk, what it cost and what it earned.

**How to judge.** The core is integrity under pressure combined with usefulness: candidates who say "just answer no" without exploring the underlying need score lower than those who give an accurate answer with real mitigations.

**Red flags.** Wording that is technically true but misleading; promising a roadmap date to win the deal without the owning teams; quietly leaving a colleague's wrong answer in place; disparaging the competitor; treating security and legal as obstacles.

**Rubric anchors.** 2: overstates to win, or refuses flatly with no help. 3: verifies facts, answers accurately through the owners, offers real mitigations, corrects an earlier wrong answer. 4: also finds the underlying risk, makes commitments only with agreement and frames the trade-off for the decider, fixes the documentation, and gives a credible real example.

## CRW-L5-04

**What a strong answer contains.**
- **Who and how**: representatives of all {{teams}} teams plus operations, support, finance where money moves, and someone from a team that would be woken at 3 a.m. by the failure. The facilitator states that risks in senior people's work are expected and welcome. Silent individual writing of failure stories first (ten minutes), then sharing in turn, senior people last.
- **Specific stories**: for {{launch}}, credible examples include: capacity or quota that does not hold under the first-day rush; a data migration or cut-over that double counts or drops usage at the month boundary; invoices or usage views that disagree with the old system; status and support not ready for the volume of questions; rollbacks that each work alone but conflict together.
- **Sort and size**: cluster duplicates, estimate likelihood and cost, and look hardest at cross-team and unowned risks. Choose about ten to act on; record the rest.
- **Actions**: an owner and a date for each; prefer detection (monitors, reconciliation checks), rehearsed rollback across teams, and limited blast radius (a staged opening, a parallel run of old and new billing for a cycle) over attempts to make failure impossible.
- **Go/no-go**: measurable criteria with evidence (a load test at the expected peak, a full rollback rehearsal, a parallel-run difference below a threshold, on-call staffed) and a named decider; the candidate states what would make them recommend delay and how they would bring it to the director.
- **Follow-up**: weekly review of open actions until launch; an escalation path when an owner has no time; a short review after launch comparing what happened with the pre-mortem.
- **Real example**: a real risk review, what it caught, what it missed, and what the candidate changed in how they run them.

**How to judge.** A pre-mortem is judged by the actions it produces and their follow-through, not the quality of the session. Credit candidates who make it safe to speak, keep the list short and owned, and connect it to launch criteria.

**Red flags.** An open brainstorm led by the most senior voice; a 60-item list with no owners; rollback assumed rather than rehearsed; go/no-go by feel; no follow-up after the meeting; a real example that is only a status meeting.

**Rubric anchors.** 2: a meeting that lists worries. 3: safe structure, specific stories, owned actions, go/no-go criteria. 4: also cross-team rollback rehearsal and staged exposure, escalation with evidence, a post-launch comparison, and a credible real example with something it missed.

## CRW-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one GPU-hour and names the assumptions that break at the scale (one database for everything, full recomputation, rounding in several places, tenant filters added by hand in each query). For per-second metering to the cent: quantities in integer seconds, exact rates from a versioned price book, one stated rounding step, line-level exports that sum to the invoice with a continuous tie-out, and restatements published with versions. For committed capacity as of any date: contracts, ramps and amendments as bitemporal records (effective period, recorded time), so any past question is a query. For tenant isolation: the customer scope derived from verified identity and applied in the data access layer for every query path, export and status view, with tests that try to cross tenants. For network metering without inspecting contents: byte counters per interface and destination class, reset handling, destination classes from a versioned address table, one metering point per path, and no payload capture. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "accurate", "secure" or "real time".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that uses floating point for money, rounds in several places, overwrites history so past commitments cannot be reconstructed, relies on each query remembering a tenant filter, or inspects traffic to meter it.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
