# Microsoft · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a cloud,
productivity-suite, operating-system and gaming setting; score them on the
rubric below, not on any company's published values, culture statements or
interview process, and do not reward an answer for reciting one.

## MSF-L5-01

**What a strong answer contains.**
- **First 48 hours**: confirm the cause with evidence before anyone presents a conclusion: the drop lines up with the settings release by build and day; metrics that do not depend on optional data (device counts by build, basic health signals) did not drop; among devices whose consent did not change, the metric is flat. Tell the product's leaders early, in writing: the drop is (or is mostly) a measurement change, the metric is not comparable across the break, and a corrected view is coming by a stated date. Do not claim the real usage number yet.
- **Rebuilding the metric**: report on the consenting population explicitly and characterise how it differs (managed versus consumer devices, hardware, region, build, tenure), using attributes known for every device from required data. Estimate the all-device figure with weighting or post-stratification on those attributes, report it with an uncertainty range, and validate it: back-test the method on the period before the change by re-weighting a subsample that resembles the new population and comparing with the known full figure. Consider redefining the metric on a ratio that is less sensitive to who consents (for example usage per consenting device in each segment). Mark the series break on every chart and in the metric's definition.
- **Required data**: moving feature usage into data every device sends is a privacy decision, not an engineering one. A strong candidate brings a minimal, specific question to the privacy team and accepts "no".
- **The prompt suggestion**: decline clearly, because nudging users against their choice undermines the consent the data depends on; raise it with the product manager directly and, if pressed, with the privacy team, while offering what the team can do instead (better estimation, a smaller honest metric).
- **Prevention**: a subscription to settings and consent changes (release notes reviewed by an owner, a review step where the privacy or settings team flags metric-affecting changes), and a monitor on the consenting share by build and segment that alerts on sudden changes.
- **Real example**: a definition or collection change that broke a metric the candidate owned, what they detected, what they told whom, how the metric was rebuilt and what decision it changed.

**Red flags.** Smoothing or imputing the drop silently; extrapolating from the consenting devices as if they were a random sample; agreeing to make the prompt less prominent, or treating consent as an obstacle; moving to new data without the privacy team; blaming the settings team.

**Rubric anchors.** 2: reports the drop, or corrects it by simple scaling, with no bias analysis. 3: diagnoses measurement versus behaviour with evidence, communicates early, rebuilds with weighting and uncertainty and a marked series break, declines to nudge consent. 4: also validates the estimate against the pre-change period, involves the privacy team appropriately, builds an early-warning path for consent changes, keeps the product manager as an ally, and gives a credible, measured real example.

## MSF-L5-02

**What a strong answer contains.**
- **First two weeks**: meet the acquired company's engineering leader first, then the engineers, especially the two senior ones, to learn the stack's history and why each choice was made. Build an inventory with them: services, data stores, pipelines, volumes, costs, dependencies, customer-facing service levels, who knows what, and the parts with the most risk. Start the security and compliance reviews immediately, since they gate everything.
- **Scope**: separate what the hosting deadline forces (where the data and services run) from what is preference (which tools they use). A strong plan moves hosting first with minimal change where safe (rehost, then improve), standardises only where the company's platform gives real value (shared identity, security controls, the few shared business metrics), and keeps tools that are better for their workloads, with a stated review date.
- **Decisions with the acquired engineers**: give them ownership of decisions inside clear constraints (security baseline, deadline, shared metric definitions), let the senior engineers design the target for their own system, and make their expertise visible (for example, they lead the shared metric definitions for their product, or present to the wider platform group).
- **Reliability during the move**: parallel runs with reconciliation of outputs, per-component cut-overs with rollback, migrations scheduled away from the product's peak periods, customer-facing service levels tracked throughout.
- **Retention**: talk to people regularly and directly; early signals include withdrawal from design discussions, declining to take on ownership, and loss of their roadmap. Address the root causes (being heard, interesting work, clear future roles) through their leader, who owns their careers.
- **Slippage**: re-plan with explicit trade-offs (what moves later, what extra cost of a short hosting extension, what risk is carried), and tell leadership early with options.
- **Real example**: a migration or integration across teams with different practices, what the candidate personally led, the outcome in measurable terms (dates, incidents, people retained) and what they misjudged.

**Red flags.** "Standardise everything on our tools" as the plan; going around the acquired team's leader; treating the acquired engineers as resources to be told; a big-bang cut-over; no parallel run or reconciliation; retention treated as HR's problem.

**Rubric anchors.** 2: a migration plan to the company's tools with dates, people not considered. 3: inventory first, deadline-driven scope with preferences deferred, phased migration with parallel runs, the acquired engineers involved through their leader. 4: also real ownership and visible credit for the acquired engineers, early retention signals acted on, explicit slippage trade-offs, security gating planned early, and a credible, measured real example.

## MSF-L5-03

**What a strong answer contains.**
- **Evidence**: one inventory of everything the team runs (outputs, pipelines, services, reports), with yearly cost (compute, storage, people time to operate), users from query and access logs, last use, downstream dependencies from lineage, and obligations (customer contracts, legal or regulatory reporting, security). Low usage is not low value: a quarterly filing report opened four times a year can be essential.
- **Efficiency first**: savings that stop nothing: delete unused outputs and tables, right-size or schedule compute, reduce retention to what uses actually need, tier cold data, remove duplicate pipelines. A strong candidate estimates these honestly (with what it costs the team to deliver them) and checks against the cloud bill; efficiency rarely covers a full third.
- **Criteria for stopping**: value to users and the business, obligations, cost, risk of stopping, and availability of an alternative. Outputs are ranked into protect (contractual, legal, critical), reduce (lower freshness, fewer variants, self-serve instead of bespoke), and stop. The long-running migration is examined honestly: finish, pause cleanly, or stop.
- **Communication**: tell stakeholders early with the reasons and the evidence; escalate genuine trade-offs (a senior leader's dashboard) to the people who own the budget, rather than deciding quietly; give notice, an alternative or an export, a date and a way back.
- **Safe shutdown**: announce, watch access logs, switch to read-only or a brownout, then off; keep data and code for a period; a known path to restore.
- **The team**: be honest about what is known and unknown within the company's process; involve senior engineers in the inventory and ranking; protect time for the efficiency work; watch workload, since a cut with the same commitments burns people out.
- **Real example**: something the candidate stopped that people valued, who objected, the measured saving or cost, and what they would do differently.

**Red flags.** Equal cuts to everything; stopping by gut feel or by who complains least; switching things off without notice; promising efficiency savings that are not estimated; hiding the trade-off from leadership; keeping the team in the dark.

**Rubric anchors.** 2: a list of things to stop, chosen by intuition. 3: inventory with cost, users and obligations; efficiency estimated; explicit criteria; notice and safe shutdown; stakeholders told with evidence. 4: also honest valuation of low-use but critical outputs, escalation of real trade-offs to budget owners, a way back for each shutdown, care for the team's workload, and a credible, measured real example.

## MSF-L5-04

**What a strong answer contains.**
- **First two weeks**: one-to-one conversations with each product group's representative and, where needed, their manager; read the two earlier documents and ask why they were not followed (no owner, no tooling, no migration path, no consequence, a definition that ignored a group's real constraints). Gather evidence of the cost of the status quo: where numbers disagree today across product groups and what that led to (a misread trend, two answers to one leadership question).
- **Setting up the group**: the right people (someone from each group able to commit or with a direct line to someone who can), a cadence, a written charter with scope, a decision process agreed up front (for example, proposals in writing, a comment period, decision by the group lead with recorded dissent, escalation to the sponsor only for deadlocks), and a decision log.
- **Reaching the standard**: start from the use cases the standard must serve; define a core that is identical everywhere and documented extensions for real product differences (for example a product-specific qualifying action under one shared counting rule); test the proposal on each group's real data before agreeing it.
- **Disengaged groups**: talk to the representative and their manager about what the group gets from it and what it costs them; reduce the cost (reference implementation, tooling, the working group doing part of the migration); ask the sponsor to make the priority clear across groups without making the decision.
- **Adoption**: a migration plan per group with dates and owners, a reference implementation or library, validation that shows each group's numbers under the new definition beside the old, and a named owner for the standard afterwards. Measure adoption and agreement of numbers, not attendance.
- **Real example**: a peer group the candidate led to a decision, how decisions were made, a decision the group improved, and the measured outcome.

**Red flags.** Waiting for unanimous agreement; escalating early to force compliance; another document with no tooling or owner; ignoring a group's legitimate differences; measuring success by meetings held.

**Rubric anchors.** 2: schedules meetings and writes a specification. 3: learns from earlier failures, evidence of the problem, an agreed decision process, a core-plus-extensions standard, migration plans and tooling. 4: also handles disengaged groups through incentives and sponsorship rather than force, tests the standard on real data before agreement, names a long-term owner, measures adoption, and gives a credible real example with personal contribution.

## MSF-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change and late or corrected data, and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for reliability, the failure being guarded against, the mechanism, how it was tested and what it cost.
- **Inventory of copies**: before designing, the candidate lists every place a customer's data goes: primary stores, replicas, caches, queues and logs, traces and debug dumps, backups and snapshots, analytics and derived tables, search indexes, support tooling and exports.
- **The requirement, per tenant**: for a single geography, a tenant-to-geography mapping that routes storage and processing, regional copies of every component that touches the data, only aggregated or non-customer data leaving, and failover inside the geography; for customer-held keys, per-tenant envelope encryption where data keys are wrapped by the customer's key, so revocation makes data unreadable including in backups and caches (which must be bounded or encrypted too), and a plan for what the service does when the key is revoked; for legal holds, a hold flag that every deletion and retention path checks, including compaction and backup expiry; for audit logs, an append-only, tamper-evident log of every access (human and service), with per-tenant export. Accept other sound answers that fit their system. The cost per tenant at {{tenants}} customers and the operational burden should be addressed.
- **Proof**: continuous checks rather than a one-off review: automated tests and monitors that detect data outside the boundary, unencrypted copies, deletions of held data, or access without an audit record; evidence a customer's auditor can review.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. Do not reward legal claims; the requirement is a product commitment in this exercise.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; forgetting logs, backups or derived copies; "we would encrypt everything" with no key management or revocation behaviour; asserting what a law requires.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a reasoned per-tenant design for the requirement. 4: also alternatives with evidence, a complete inventory of data copies, the requirement's behaviour in failure (revoked key, regional outage, hold during compaction), continuous proof for auditors, crisp separation of own and team contributions, and lessons that show changed practice.
