# Databricks · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a lakehouse, Spark
and open-format setting; score them on the rubric below, not on any company's
published values or interview process.

## DBX-L5-01

**What a strong answer contains.**
- **First hour**: confirm the report with telemetry (the same jobs' durations before and after the upgrade date, stage by stage) so the investigation starts from facts; open an incident with a lead (the candidate), a communications owner (support or the account team) and a scribe; agree with the customer on a fast mitigation for tonight: pin the affected jobs or the workspace to the previous runtime for a fixed period, or revert only {{change}} for them if it can be switched, with the security trade-off written down and approved by the customer and by security. Send a first update that states what is known, what is being done tonight and when the next update comes.
- **First day**: compare plans and stage metrics before and after for the slowest jobs (partition counts, shuffle sizes, skew, spill, file counts and sizes, join strategies); form a hypothesis tied to {{change}} and reproduce it on synthetic data of the same shape, or on the customer's data only with written permission; bisect by switching individual changes on a pinned test cluster. Look at fleet telemetry for other customers with the same job shape, including the two small tickets.
- **Following weeks**: fix (a better default, a heuristic that avoids the pathological shape, or a documented setting), roll it out in stages with fleet-wide before/after comparisons, unpin the customer on a date agreed with them, and write a blameless review shared appropriately. Prevention: a regression suite of representative workload shapes (synthetic, or opt-in replays of plans and statistics), staged rollouts with automatic regression detection per workload class, per-change switches, and release notes that say which workloads a default change can slow down.
- **Communication**: a steady rhythm (daily at minimum while {{watching}}), only commitments the team controls, technical detail for the engineers and a short status for executives; refuses to promise "never again" but describes the concrete changes that make recurrence less likely and faster to catch. Hands commercial questions to the account team with the facts they need (impact, duration, cause).
- **Default decision**: if the change helps most of the fleet and hurts this shape, keep the default only with a fix or detection for the bad shape, decided with the runtime owners and product, using fleet data rather than one customer's pressure.
- **Real example**: an investigation with an anxious stakeholder, where the candidate's own decisions (what they mitigated first, what they said and when) are clear, with time to mitigation and what changed afterwards.

**Red flags.** Root-causing for days while reports stay late; rolling back security fixes without making the trade-off explicit; reading customer data without permission; blaming the customer's job design; promising "never again"; going silent between updates; offering credits personally.

**Rubric anchors.** 2: investigates without mitigating, vague communication. 3: scoped mitigation with the security trade-off, evidence-based diagnosis from plans and metrics, regular honest updates, respect for data access, fleet check. 4: also a clear default decision with fleet data, prevention through workload-representative regression testing and staged rollouts, well-run stakeholder management under scrutiny, and a credible real example.

## DBX-L5-02

**What a strong answer contains.**
- **Evidence first**: which tables would gain the feature under each option; which readers (engine, version, client) read them, from catalogue and platform telemetry; the blind spot (direct storage reads by external tools) and how to reduce it (ask customers, scan storage access logs where customers allow, publish a checker they can run). Treat {{old_readers}} as a lower bound. Confirm the downgrade path for {{feature}} and how long it takes.
- **Options**: on by default for new tables (low risk: nobody reads them yet, though shared and replicated tables need care), opt-in for existing tables with tooling and clear benefits, and never automatic for tables read by unsupported engines or shared with other organisations. Possibly on by default for existing tables only where telemetry sees no old readers for a long window, with a notice period and an easy opt-out before enablement.
- **Compatibility promise**: a written policy: features that lock out readers are never enabled on existing tables without notice of a stated length; every such feature has a documented downgrade path; release gates check reader telemetry before a default changes; the support matrix lists engines and versions. Enforced as a checklist and an automated gate in the release process.
- **Communication**: early notice to customers and to other engines' maintainers, documentation and a checker, release notes that state the reader requirement plainly, messages from customer-facing teams to the accounts with many old readers.
- **Ecosystem**: contribute to or support the open-source community's implementation for other engines (specification clarity, test suites, reference code), while acknowledging their schedules are not yours.
- **Broken reader response**: a fast path to downgrade or disable the feature for the table, guidance for upgrading the reader, and a record of what slipped through the checks.
- **Working with product**: agree that the announcement can be about availability and new-table defaults, with a dated plan for existing tables tied to reader readiness; show the cost of a broken reporting tool at a large customer against the benefit of a faster default.
- **Real example**: an incompatible change the candidate shipped or blocked, who was affected, how they communicated, and what they would change.

**Red flags.** Turning it on everywhere because "most customers benefit"; treating telemetry as complete; blocking the feature indefinitely without a path; ignoring other engines' maintainers; no written promise.

**Rubric anchors.** 2: "turn it on and announce it", or "never turn it on". 3: evidence including blind spots, different treatment for new, existing and shared tables, a documented downgrade path, clear communication. 4: also a written and enforced compatibility policy, ecosystem work with other engines, a broken-reader response plan, a plan product agrees to, and a credible real example.

## DBX-L5-03

**What a strong answer contains.**
- **Assessment**: talk to the engineer about their goals and how they see the gap; read their recent designs and reviews; ask the manager and two or three peers for specific examples. Agree on a written picture of staff-level impact in concrete terms (owns a problem that spans teams; their decisions are adopted by other teams; their writing is how others learn the system; they make the people around them better).
- **Opportunity**: steer them to a real, unowned cross-team problem with visible stakes (for example, inconsistent table-maintenance settings across teams, or the recurring incident pattern), negotiate its ownership with the people who care about it, and set it up so success is possible (clear scope, a sponsor, early stakeholders).
- **Feedback**: specific, timely and about behaviour, tied to {{gap}}: for example, "your design for X was right, but three teams did not adopt it because there was nothing to read; write the one-page proposal before the next meeting and send it to these two leads". Address disagreement ("the work should speak for itself") with evidence of where it did not.
- **Sponsorship**: put their name forward for visible work, credit them in writing where decisions are recorded, invite them to lead meetings the candidate would normally lead, and step back when they take a decision the candidate would have made differently but that is sound.
- **Tracking**: monthly check-ins against the agreed picture; collect evidence of impact as it happens (adopted designs, decisions referenced by other teams).
- **Not ready**: say so plainly and early, with specific evidence and a plan; separate the promotion outcome from the growth that happened; keep sponsoring.
- **Real example**: a person the candidate helped grow, with specific feedback given, opportunities created and what changed for the person, in the person's terms as well as the candidate's.

**Red flags.** Generic mentoring with no concrete goal; giving them the candidate's own work to "look busy"; feedback that is vague or only positive; taking credit; promising a promotion the candidate does not control; disengaging if they are not ready.

**Rubric anchors.** 2: "I would pair with them and review their designs". 3: concrete expectations agreed, a real cross-team opportunity, specific feedback on the gap, progress tracked. 4: also active sponsorship at the candidate's own cost, honest handling of "not ready" with a plan, and a credible real example with evidence of the person's growth.

## DBX-L5-04

**What a strong answer contains.**
- **Evidence**: an incident analysis showing that the {{incidents}} incidents share structural causes (the single database, retry amplification, lack of isolation), with their impact in product terms (customers affected, minutes of unavailability, support tickets, deals or renewals at risk). A load projection showing what {{launch}} adds to {{service}}, and the probable consequence without the work.
- **Shaping the ask**: the {{ask}} broken into milestones in order of risk reduction (for example retry budgets and load shedding in weeks one to three, isolation of the largest customers next, the database split last), each with a measurable outcome (incident rate, latency at projected load, blast radius); the launch's own readiness work included.
- **Negotiation**: a one-page case with options and costs (full ask; a smaller first slice with a checkpoint; nothing, with its expected incidents and launch risk) for the product leader and the director to decide together. Uses the existing availability target and spent budget: propose an error-budget policy (when the budget is spent, reliability work takes priority) agreed going forward, not imposed retroactively.
- **If they offer 10%**: accept it as a first slice aimed at the highest-risk cause, set a checkpoint with the data that would justify more, and say plainly which risks remain and who owns them.
- **If the answer is no**: commit to the launch; mitigate cheaply (feature flags, rate limits for the new load, runbooks and staffing for launch week), record the risk with its owner, and bring the data back after the next incident without "I told you so".
- **Real example**: a negotiation for reliability or debt work, the evidence used, the outcome, and whether the investment proved worth it.

**Red flags.** Asking for time with no numbers; framing reliability as engineering's preference; refusing to support the launch if the answer is no; using an incident as leverage in a way that blames product; inflating the ask to leave room to bargain.

**Rubric anchors.** 2: "we need time for tech debt". 3: evidence of shared causes, impact in product terms, a sequenced plan with measurable milestones, options presented for a joint decision. 4: also reliability framed as part of the launch, an agreed error-budget policy, a mature response to a partial yes or a no, and a credible real example with outcome.

## DBX-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for storage layout, file sizes and counts, partitioning and clustering choices with the query patterns that justified them, schema evolution and maintenance (compaction, retention); for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Across {{clouds}} clouds**: starts from where each table's data lives and who reads it; names the single-cloud or single-region assumptions in their design (one metastore, one identity system, one storage namespace, cheap reads anywhere); proposes one writer or source of truth per table with replicas or shares elsewhere and a stated lag; for {{cloud_feature}}: residency enforced by placing data and compute in-region and restricting replication by policy; one access model defined once and enforced in each cloud's catalogue and storage permissions; egress modelled in bytes and money with compute moved next to data, or incremental replication; disaster recovery with replicated data and metadata, tested failover and a stated recovery point and time. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its layout or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a multi-cloud answer that ignores where data lives, or treats cross-cloud reads as free.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, named single-cloud assumptions. 4: also alternatives with evidence, an incremental and correct path to the multi-cloud requirement with costs and lag stated, crisp separation of own and team contributions, and lessons that show changed practice.
