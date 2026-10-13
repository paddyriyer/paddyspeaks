# Amazon · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a marketplace,
fulfilment and cloud setting; score them on the rubric below, not on any
company's published values or interview process.

## AMZ-L5-01

**What a strong answer contains.**
- **First hour**: declare an incident with a lead, a communications owner and a scribe; bring in checkout and operations on-call. Confirm whether bad capacity is still being published (compare the feed with the source and with yesterday). Contain: stop the pipeline from publishing, pin checkout to the last verified capacity, or turn on the conservative default only for the affected stations or regions if that is possible. A strong candidate names the cost of each lever (the global default lengthens every customer's promise) and who must agree. Give support and operations a first statement of what is known and when the next update comes.
- **First day**: define "affected": orders placed during the window whose promise relied on capacity above what the network actually has, by station and date. Produce the list with the expected miss per order, reconcile it with operations' own estimate (differences usually come from orders already re-routed, cancelled or shipped), and hand operations a prioritised list for the capacity they can add (for example the most delayed, or orders for which a missed date matters most). Agree messaging with customer service and checkout: tell customers whose promise will be missed, with a new date, once it is known; do not alarm those who will still arrive on time.
- **Following weeks**: confirm every affected order got a correct new date or arrived; review blamelessly why the checks passed (they measured arrival and row count, not content); prevention: content checks on the feed (unchanged-file detection, distribution shifts against the previous day and the same day last year, zero or null capacity, bounds), a publish gate that holds the last verified data when checks fail, alerts to the pipeline owner, and a contract with the upstream source about schema changes and missing values.
- **Real example**: an incident where the candidate's data harmed customers, with their own decisions (what they switched off, what they chose not to do), the size of the impact, time to contain and the prevention they shipped.

**Red flags.** Debugging the root cause while bad promises keep being made; changing customers' promised dates silently; messaging every customer without knowing who is affected; prevention that is "more monitoring" with no named signal; blaming the upstream team.

**Rubric anchors.** 2: fixes the pipeline only; no containment trade-off, no affected list. 3: fast containment with a stated cost, precise affected list reconciled with operations, honest customer messaging through the owners, content-level checks with an owner. 4: also scoped containment, prioritisation of the capacity operations can add, a publish gate that holds verified data, an upstream contract, and a credible, measured real example.

## AMZ-L5-02

**What a strong answer contains.**
- **Evidence (first weeks)**: from query logs and lineage, list which fields of the table each consumer reads; from the incident history, the cost of each break (hours to detect, hours to repair, reports late, decisions affected). Identify the handful of writers and event types behind most breaks.
- **Proposal sized to two engineers**: a contract per event type (fields, types, allowed values, required fields, semantics of each status, owner team, compatibility rule: additive changes allowed, removals and renames only through a new version with a deprecation window). Enforcement as early as possible: a check in the writer's build or deploy pipeline that compares the emitted schema with the contract, plus validation at publish time that quarantines non-conforming events rather than writing them to the shared table. Consumers subscribe to versions.
- **Adoption without authority**: start with the two or three writers responsible for most breaks and make it cheap for them (a generated client or library, templates, the check running in their pipeline for free, fewer angry messages). Show consumers' pain with numbers to writers' leaders. Roll out in stages: observe only (report violations), warn, then block for new violations. Ask leadership to sponsor the standard and agree a decision rule for blocked deploys (writer and contract owner decide, escalation path documented), not to give the candidate control.
- **Measuring success**: breaks per quarter, time from a change to its detection, share of event volume under contract, consumer-reported incidents.
- **Real example**: a change the candidate drove across teams they did not manage, the resistance they met, how they made it worth the other teams' time, and measured results.

**Red flags.** Starting with a mandate and enforcement; documentation as the answer; blocking deploys from day one; a plan that needs ten engineers; treating writing teams as careless rather than as unaware.

**Rubric anchors.** 2: "write documentation and tell teams to follow it". 3: measured problem, contracts with compatibility rules and early enforcement, a pilot with the worst offenders, staged rollout. 4: also adoption designed around the writers' incentives, decision rights for blocked deploys, success measures, and a credible real example of cross-team influence.

## AMZ-L5-03

**What a strong answer contains.**
- **Data**: hourly compute usage for the last six to twelve months, broken down by workload and compute family: the steady base, the nightly batch peak and month-end spikes. The candidate looks at what each uncertain change would do to each component and at how accurate past usage forecasts were.
- **Sizing**: commit to the usage that exists in every plausible scenario, usually a low percentile of hourly usage after removing workloads the uncertain change may move. Layer: buy part now and add more as the uncertainty resolves (commitments can be stacked), rather than one large purchase. Choose a flexible commitment type if the migration may change instance families, accepting a smaller discount.
- **Break-even**: with discount d, a commitment costs (1 − d) of on-demand for the committed amount whether used or not, so it breaks even when utilisation of the committed capacity is 1 − d (at 35%, the committed capacity must be used at least 65% of the time on average). The candidate translates the downside into money: if usage falls by X, the waste is so much per month for the rest of the term.
- **Architecture**: the commitment must not decide the migration; if the better architecture uses a different compute type, the commitment should be sized or chosen so that decision stays open. Interruptible capacity for fault-tolerant batch work is a separate lever.
- **Presenting to finance**: scenarios (base, high, low) with savings and worst-case waste for each option (none, partial, full), a recommendation, and review triggers (quarterly, and at each milestone of the uncertain change).
- **Real example**: a decision that traded saving against flexibility, with numbers, what the candidate decided personally and how it turned out.

**Red flags.** Committing to average or peak usage; refusing any commitment without quantifying what is left on the table; no break-even reasoning; letting the commitment dictate the architecture; treating it as finance's problem only.

**Rubric anchors.** 2: "buy the commitment, it saves money" or "never commit". 3: hourly usage decomposition, base-load sizing, break-even stated, scenarios for finance. 4: also layered purchases tied to the uncertainty's milestones, the flexibility trade-off priced, interruptible capacity considered, review triggers, and a measured real example.

## AMZ-L5-04

**What a strong answer contains.**
- **Verify first**: re-read the design and write the exact interleaving that oversells (two regions each see the last N units in their counters, both accept orders, reconciliation runs after both). Estimate how often it happens at the deal's expected order rate and reconciliation interval, ideally with a small simulation or a test against a prototype. Check whether the design already has a guard the candidate missed; be ready to be wrong.
- **Raise it with the author early**: privately, before the review, as a question ("what happens when two regions take the last units within one reconciliation interval?"), sharing the interleaving or the test. Give the author the chance to fix the design and present the fix as their own.
- **At the review**: evidence, not assertion: the event sequence, the estimated oversell rate, and the cost of one oversold deal (cancelled confirmed orders, customer trust, support load). Propose changes that keep most of the benefit: in-memory counters for ordinary items with a strict per-region allotment that can never exceed the deal cap, exact reservations only for capped deal items, an exact final check at order confirmation, or a reconciliation that is pre-emptive near zero stock.
- **Decision**: name the decider and the criteria (acceptable oversell rate, latency or cost targets); if still in disagreement, escalate together with a written one-page summary of both positions that the author agrees is fair. A strong candidate distinguishes "I would do it differently" from "this is unsafe", and only pushes hard on the second.
- **After the decision**: if overruled, support the chosen design fully and make the residual risk visible: a monitor that counts oversold units per deal, a kill switch to exact reservations for any deal, and a load test of the race before the sale. If the design changes in their favour, give the author credit.
- **Real example**: a real disagreement over a peer's design, with what the candidate did to verify and raise it, the evidence that moved the decision, the outcome, and the state of the working relationship afterwards.

**Red flags.** Raising the concern for the first time in the review, in front of everyone; opinion without a concrete failure case; treating the decision as theirs; undermining the design after it is chosen; dismissing the benefit; a real example where the candidate was simply proven right and nothing else is learned.

**Rubric anchors.** 2: argues in the review on intuition, or stays silent. 3: verifies and quantifies the risk, raises it early with the author, proposes a design change, respects decision rights. 4: also a fair written escalation, a hybrid that keeps the benefit, full support after the decision with the risk monitored and a kill switch, and a credible real example with the relationship intact.

## AMZ-L5-05

**What a strong answer contains.**
- **Capacity model**: for each stage of the pipeline (ingest, partitions, consumers, sinks) and each of the dependencies, its limit in events per second and what fails first. Last year's failure is the first hypothesis to test.
- **Testing**: end-to-end load tests at and beyond the expected peak (for example 1.5 times it) with synthetic orders that are marked as tests and filtered by every consumer, or replayed into isolated copies of downstream systems; never test events that can become real shipments or charges. Agreements with each downstream team on time windows and abort criteria. Game days for the failure modes (a consumer falls behind, a partition is hot, a dependency throttles).
- **Fixes by evidence**: change only what the tests show is the first or second limit; things that cannot scale by adding machines (partition counts, downstream rate limits) are planned early.
- **Dependencies**: clear asks with dates (join the test, state your limit, name an on-call); where a team cannot take part, protect them with rate limits or buffering on your side and record the risk with its owner.
- **The day**: dashboards and alarms on lag and error per consumer, pre-agreed levers (slow or pause non-critical consumers such as analytics, shed by priority, buffer), who may pull each one, rehearsed runbooks, on-call rota and an escalation path.
- **Go/no-go**: a planned change ships only with evidence it is safe at peak (tested under load), a fast off switch, and value before the event that outweighs its risk; a large structural change three weeks out usually waits unless it fixes a proven limit and has been load-tested. A stricter freeze than the general one is justified for the pipeline's critical path.
- **Real example**: a launch or peak the candidate prepared for, what they measured, what they changed, what happened on the day, and what they learned.

**Red flags.** Testing only their own pipeline; load tests that send synthetic orders into real fulfilment or payments; "we'll autoscale"; no levers decided before the day; shipping a large change late because it is exciting.

**Rubric anchors.** 2: "load test and add capacity". 3: capacity model, end-to-end load tests with safe synthetic traffic, fixes prioritised by first limit, levers and on-call defined, evidence-based go/no-go. 4: also dependencies brought in with clear asks and fallbacks, rehearsed runbooks, last year's failure explicitly closed, a justified freeze policy, and a credible real example.
