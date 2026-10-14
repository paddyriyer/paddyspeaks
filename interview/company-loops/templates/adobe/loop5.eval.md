# Adobe · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a creative,
document and marketing software setting; score them on the rubric below, not on
any company's published values, culture statements, management frameworks or
interview process, and do not reward an answer for reciting one.

## ADB-L5-01

**What a strong answer contains.**
- **First day**: measure the gap precisely: which event types, start and end times, which regions and customers, and how that was established (counts against source systems, sequence gaps, the pipeline's own error logs). Confirm it is not still happening. Tell their manager the same day, and through them the account team (the "on track" message makes speed more important), plus legal and the security or privacy owner, because the gap may matter under contracts and for other customers. Preserve every source that could help (front-door and storage access logs have their own retention clocks; stop them expiring for the period).
- **Before the deadline**: build the report from what was recorded, and add a clearly separate section for the gap: the period, what is missing, what was reconstructed from which other source, how complete that reconstruction is believed to be and why, and what cannot be known. Every reconstructed event is traceable to a source record and labelled as reconstructed; nothing is invented to make the report look whole. Give the account team accurate facts and a realistic date; they and legal decide what is said and whether the deadline changes. Then check every other customer for the same gap and give the owners a list; whether and how to notify them is the owners' decision, informed by the facts.
- **Afterwards**: blameless review (why did the alert not fire: its threshold matched daily totals, so a partial gap was invisible); prevention: per-event-type, per-hour completeness checks against source counts, sequence numbers on events with gap detection, a durable buffer that does not drop events on downstream failure, alerts with an owner, and a test that injects a gap and proves it is caught. Review retention of the secondary sources so reconstruction is possible next time.
- **Real example**: a time the candidate disclosed incomplete or wrong data to a customer or stakeholder: what they found, whom they told and when, what they did not do (hide it, patch it silently), and how trust was affected.

**Red flags.** Filling the gap with plausible events; delivering the report without mentioning the gap; waiting until the deadline to tell the account team; contacting the customer directly over the owners; giving legal conclusions themselves; ignoring other customers; prevention that is "monitor better" without a named signal.

**Rubric anchors.** 2: fixes the pipeline and hopes the gap goes unnoticed, or backfills it silently. 3: measures the gap, escalates promptly, labels reconstruction honestly, supports the owners' message, prevention with specific completeness checks. 4: also preserves secondary sources before they expire, handles other affected customers, presents reconstruction so an auditor can rely on it, tests the new checks, and a credible real example.

## ADB-L5-02

**What a strong answer contains.**
- **Sizing (first day)**: reproduce the failure with the assistive technology involved, with the central specialist and, ideally, users who rely on that technology; separate what blocks the main task from what is merely awkward; break the fix down and re-estimate. Check whether the old version can stay as an equal path.
- **Not counting by profiling**: the number of affected users is not knowable from usage analytics and the candidate should not propose detecting assistive-technology use to find out; "a small percentage" is not a reason when the change removes a working path for them.
- **Options with costs**: delay until fixed; launch with the old version available as a fully supported path (clearly signposted, not hidden) until the fix ships with a committed date; staged launch to part of the audience; launch with reduced scope that removes the inaccessible part. The candidate recommends one with conditions (for example, launch only if the old path stays until the fix is verified with assistive-technology testing) and says who decides (the product manager or their leadership), bringing in legal for customer procurement terms without drawing legal conclusions.
- **Launch day**: whatever is decided, a user who depends on assistive technology can complete the task; support knows the alternative path; the fix has an owner and a date.
- **Process change**: accessibility criteria in design reviews and the definition of done; automated checks in the build for what they can catch; manual testing of the main tasks with a screen reader and keyboard before beta; the specialist involved at design time; accessibility bugs triaged with the same severity scale as other blocking defects. Measured on the next feature: issues found at design or build time versus at launch.
- **Real example**: a serious quality problem found late, what the candidate pushed for, what was decided and the outcome for the affected users.

**Red flags.** Calling it polish; accepting "follow-up" with no date or interim path; proposing to detect or track users of assistive technology; deciding unilaterally to block the launch without offering options; only an automated checker as the process fix.

**Rubric anchors.** 2: ships as planned with a vague follow-up, or blocks the launch without options. 3: sizes the fix with the specialist, lays out real options with costs, ensures an accessible path on launch day, a concrete process change. 4: also refuses profiling to count users, involves users of assistive technology, recommendation with explicit conditions and decision rights, legal brought in without legal conclusions, a measured process change and a credible real example.

## ADB-L5-03

**What a strong answer contains.**
- **Criteria first**: agreed with the team and their manager before comparison: meets the requirement with numbers (latency, freshness, throughput, cost at expected volume), operability (monitoring, upgrades, failure behaviour, debugging at night), team capability and learning time, support and community, integration with existing systems, cost to reverse in six months, hiring.
- **Evidence**: a time-boxed spike (one to three weeks) on a representative slice of the real workload, run by more than the champion, with exit criteria written in advance (for example "handles peak volume with bounded lag, recovers from a node failure without data loss, two people other than the champion can operate it"). The familiar option is estimated with the same rigour: the extra work and cost to meet the requirement.
- **Champion handling**: separate the proposal from the person. A new hire's experience is valuable evidence, so pair them with others; a manager's enthusiasm is weighed like any other input with the criteria made explicit; if the candidate is the champion, they invite someone sceptical to own the evaluation.
- **Risk reduction**: incremental adoption (one pipeline first), a parallel run comparing outputs, a fallback path, runbooks and alerts, at least two trained operators before the system is on the on-call rota, and a vendor or internal support contact.
- **People**: learning time planned in the schedule; on-call fears addressed with shadowing and runbooks; excitement channelled into the evaluation rather than a fait accompli.
- **Record and revisit**: a written decision record (options, criteria, evidence, decision, risks) and a mid-point review with a pre-agreed switch-back signal (for example, behind plan by more than N weeks at the midpoint, or failing an operability criterion).
- **Real example**: a familiar-versus-unfamiliar decision, how it was made, what happened and what they would do differently.

**Red flags.** Deciding by enthusiasm or by habit; a spike with no exit criteria; only the champion knows the new system; ignoring on-call; no way back; dismissing team members' worries.

**Rubric anchors.** 2: picks one by preference. 3: criteria first, a time-boxed spike with exit criteria, risk reduction and on-call readiness, a recorded decision. 4: also equal rigour for both options, thoughtful handling of the champion, reversal cost estimated, people's concerns addressed with a plan, a switch-back signal, and a credible real example.

## ADB-L5-04

**What a strong answer contains.**
- **Starting point**: a conversation about their goals and worries, then real work together (pairing on a small change to the pipeline, walking through a past incident) to see where they are; the gaps listed specifically (branching and review workflow, unit and data tests, how the pipeline is partitioned and scheduled, idempotent reruns and backfills, reading logs and metrics, on-call practice).
- **Plan**: written together with observable milestones at intervals across the period, for example: first merged change with tests; owns a small feature end to end; reviews others' changes; leads a backfill with a written plan; shadows on-call, then is primary with the mentor as secondary; owns the pipeline's runbook. Shared with their manager with the engineer's knowledge.
- **First work**: real but recoverable, ordered for confidence and coverage: add data-quality checks and tests where their analytics strength shows (they know what a wrong number looks like), fix a documented bug, update the out-of-date documentation as they learn (useful to everyone), then a feature change with a staged rollout.
- **Safety**: code review with a clear purpose (teaching comments marked as such, a few points per review rather than everything); changes behind flags or staged; backfills rehearsed on a copy; on-call shadowing, then reverse-shadowing, with a runbook and an escalation path that is never treated as failure.
- **Feedback and incidents**: specific and timely, given privately, kind and direct; a first incident handled blamelessly, with the mentor present but not taking over, and a review they lead.
- **Slow progress**: diagnose whether the plan was too steep, the support too thin (mentor too busy) or the fit poor; adjust the plan first; discuss fit honestly with them and their manager if evidence points there.
- **Real example**: someone the candidate helped grow into a new role, what they did, and evidence of growth (what the person could do afterwards).

**Red flags.** Doing the work for them; a plan without milestones; first task an unrecoverable migration; on-call on day one without shadowing; surprising them with feedback through their manager; treating SQL experience as a deficit rather than a strength.

**Rubric anchors.** 2: "pair with them and answer questions". 3: assessment through real work, a written plan with milestones, recoverable first tasks building on strengths, staged on-call with safety, specific feedback. 4: also transparent coordination with their manager, a blameless first incident they lead, a diagnosis of slow progress that separates plan, support and fit, and a credible real example with evidence of growth.

## ADB-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one record and names the assumptions that break at the scale (one schema for all customers, one process for all volumes, full recomputation, unbounded free-form fields). For contents never readable: typed event schemas with no free text, enforcement in the producing library, file names treated as content, a downstream scanner and a purge path. For the same numbers in report, invoice and audit trail: one billable table keyed by operation id with retries collapsed, all three derived from it, and reconciliation checks. For restatement on classification changes: versioned lookup tables and versioned processed data built beside the live version with an atomic switch and rollback, with everything else pinned. For provenance: a record attached at each step (who or what tool, which action, which ingredient assets by id), stored with the asset and in a queryable index, verified when read, and described as metadata about history rather than a guarantee that content is authentic. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "privacy", "consistency" or "lineage".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that relies on everyone remembering not to log content, recomputes history in place, or treats provenance metadata as proof that content is genuine.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
