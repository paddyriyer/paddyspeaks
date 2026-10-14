# Cloudflare · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in the setting of a
global network that serves and protects customers' sites; score them on the
rubric below, never on any company's published values, culture or interview
process, and do not reward an answer for reciting one.

## CFX-L5-01

**What a strong answer contains.**
- **Facts before prose (first hours)**: assemble a UTC timeline from deploy records, alerts, dashboards and chat logs (trigger, detection, escalation, mitigation, recovery); quantify impact by product (dashboards, analytics API, log delivery) and by customer (count of zones or jobs affected, delivery delay per job, batches lost or at risk) from delivery records; list what is known, what is uncertain and when it will be known.
- **Structure**: a summary paragraph that says what customers saw, for how long, whether their data is affected and what they need to do; then the timeline; the cause chain (trigger, why safeguards did not stop it, why recovery took {{minutes}} minutes); what went well and what did not; remediations with owners and realistic dates. Plain language, no internal jargon.
- **Data status**: says plainly what was lost or will be restated and for whom, or that the extent is still being determined, with a date for an update; never implies "no data loss" while it is uncertain. Affected customers receive direct, specific messages (which jobs, which window, how to re-request or what will be backfilled) rather than only the public page.
- **Blameless and specific**: describes the change and the system conditions that let a reasonable change cause harm (missing check, slow failover, unmeasured limit), never the person. Shares the draft with the engineer as a courtesy and invites corrections of fact, while keeping editorial ownership; supports them personally.
- **Root-cause disagreement**: time-boxed evidence gathering (a reproduction, logs, a test); if unresolved at the deadline, the document names the confirmed trigger and contributing factors that both sides accept, says investigation of the remaining question continues, and commits to an update.
- **Review pressure**: accepts edits for clarity, brevity and legal precision; refuses edits that make it misleading (for example removing the missed alert from the timeline or softening "lost" to "delayed"), and escalates to the director with a clear explanation if needed.
- **After publication**: tracks remediations to completion, publishes updates when items close or facts change, and checks that the class of failure is now caught (a test, a game day).
- **Real example**: a write-up the candidate led or contributed to, what they personally wrote or decided, a tension they handled, and a concrete change that followed.

**Red flags.** Minimising impact or claiming no data loss without proof; naming or hinting at the engineer; speculation presented as cause; remediation lists with no owners or dates; treating communications' preferences as overriding accuracy; or the opposite, refusing all review.

**Rubric anchors.** 2: writes quickly from memory, vague impact, blame or evasion. 3: evidence-based timeline, honest impact, blameless cause, dated remediations. 4: also precise handling of uncertain data loss with direct customer contact and a committed update, a principled line on review edits, a transparent treatment of the root-cause disagreement, follow-through after publication, and a credible real example.

## CFX-L5-02

**What a strong answer contains.**
- **First ten minutes**: declare the incident and its severity; open an incident channel and log; confirm the diagnosis with evidence (the transport's queue depth and errors moved first; nothing changed in own services); page the owning team's on-call and their escalation, and page the senior incident manager in parallel rather than after waiting; assign someone to customer communication and someone to own-system mitigation.
- **Mitigate in own systems**: extend buffering, pause non-urgent consumers, reduce or batch what is sent, slow retries (which may be adding load), and estimate when data would start to be dropped. This buys time and is fully within the candidate's authority.
- **The config change**: the old write permission is not authority. The candidate frames a clear decision for the incident manager (the proposed change, the evidence, the risk if it is wrong, the rollback, the time until data loss), runs it only with that approval under the documented escalation path, records it in the incident log, and preferably has someone who knows the service watch it. If approval is refused, continue mitigation and keep escalating.
- **When owners join**: share the evidence and timeline, listen to their diagnosis, hand operational control of their system to them while keeping incident command (or hand command over explicitly). Disagreements are settled by data, quickly.
- **Communication**: status updates every 30 minutes with what customers see, data status (delayed versus lost) and next update time; no speculation about cause.
- **Review**: a joint blameless review covering both sides (the transport's failure, own retry behaviour, the unanswered page or stale runbook, the leftover permission), with actions owned by each team; remove the stale permission.
- **Real example**: an incident across a boundary, with what the candidate personally did, how authority was handled, and what they would change.

**Red flags.** Running the change because they can, unrecorded; waiting passively for the owner while data is about to be lost; blaming the other team in channel or to customers; never communicating to customers; ignoring their own retries' contribution.

**Rubric anchors.** 2: either fixes it alone on the old permission or waits without escalating. 3: confirms diagnosis, mitigates in own systems, escalates through the documented path, communicates on cadence. 4: also a crisp decision request with risk and rollback, clean handover and command roles, a joint review that fixes both sides including the permission, and a credible real example with lessons.

## CFX-L5-03

**What a strong answer contains.**
- **First hour**: acknowledge the researcher promptly, thank them, confirm a contact and say what happens next; if the report arrived outside the programme ({{channel}}), move it into the official process without making the researcher feel brushed off. Route it immediately to the security team and follow its process; involve legal counsel and the candidate's manager or director early. Do not discuss details in public channels.
- **Confirm safely**: reproduce with test accounts in an approved environment; if the evidence includes another customer's log lines, hand them to the security team and do not circulate them. Preserve evidence: delivery records, configuration history, and a hold on deletion where policy allows.
- **Contain**: ship the mitigation (for example disable the condition that triggers cross-delivery) and verify it with tests and synthetic jobs, not by reading customer logs.
- **Scope**: define the precise condition, then query per-batch delivery records for jobs where it held, the period, and the bytes or batches that could have crossed; state clearly what cannot be known (no per-line record) and choose conservative assumptions.
- **Notification**: provide facts to legal and security, who decide obligations; advocate for telling affected customers when exposure is real or cannot be ruled out; prepare specific customer messages (which jobs, which period, what was possibly received by whom only in general terms, what has been done).
- **Disclosure timing**: work with the researcher on a date that allows the fix and notifications; if the full fix needs longer than {{disclosure_days}} days, explain why with the mitigation already in place and ask for an extension rather than demanding silence. Credit the researcher if they wish and handle any reward through the programme.
- **Afterwards**: tenant-isolation tests in the pipeline, design-review questions for cross-tenant paths, and a blameless review.
- **Real example**: a security or privacy report the candidate handled or contributed to, with their role distinct from the security team's.

**Red flags.** Threatening or stonewalling the researcher; handling it alone or quietly fixing without telling security; arguing against notification because the exposure is "small"; reading customer logs freely to "check"; dwelling on exploit details rather than response.

**Rubric anchors.** 2: fixes the bug quietly or treats the researcher as an adversary. 3: prompt acknowledgement, security process engaged, safe reproduction, containment, scoping from records. 4: also preserved evidence, honest scoping of the unknowable, principled advocacy on notification, collaborative disclosure timing with credit, lasting isolation tests, and a credible real example.

## CFX-L5-04

**What a strong answer contains.**
- **Define first**: one or two customer-facing objectives (for example delivery delay for log jobs, availability and latency of the analytics API) with a measurement and a budget; paging alerts only on symptoms that threaten them (for example delivery lag beyond a threshold for many jobs, API error rate burning budget fast); everything else becomes a ticket, a dashboard or is deleted. The 140 existing alerts are triaged with the team.
- **Preparation**: runbooks for each paging alert written by the team; shadowing then reverse-shadowing; a few game days on realistic failures; escalation to a secondary and to the candidate; clear handover notes.
- **Rotation for {{team_size}}**: primary and secondary, weekly or split weekday/weekend, with the frequency stated (with {{team_size}} people, each is on call roughly every {{team_size}} weeks as primary); consider a shared secondary with a neighbouring team or follow-the-sun if time zones allow. Fairness: transparent swaps, holiday rules, and time off after night pages.
- **Constraints and objection**: for caregivers, explore arrangements within policy (daytime-weighted shifts, swaps, a shared secondary) agreed with them and the manager, not imposed; for the engineer who objects, listen, explain why the change is happening, involve them in reducing the burden, and agree an outcome with the manager within policy — without exempting by favour or coercing. The team sees that the rules are applied consistently.
- **Support**: makes the cost visible to the manager with data and asks for policy support (compensation, time off) and for project commitments to shrink while on-call matures.
- **Measuring**: pages per shift, share at night, actionable share, time to acknowledge, incidents found by customers versus alerts, and a short wellbeing check; review monthly and fix the top sources of pages. Five pages a week mostly at night means noise or a recurring fault: fix the cause, raise thresholds on non-urgent signals, and consider adjusting the rotation.
- **Real example**: a practice the candidate introduced or changed, how they got buy-in, and how they measured it.

**Red flags.** Turning all 140 alerts into pages; a rotation with no secondary or escalation; dismissing constraints or the objection; promising compensation they cannot give; no measurement of the burden.

**Rubric anchors.** 2: a schedule and a pager, little else. 3: objectives and symptom-based paging, runbooks and shadowing, a fair rotation, escalation. 4: also respectful handling of constraints and the objection within policy, visible support secured from management, continuous noise reduction with measures of load and wellbeing, and a credible real example.

## CFX-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change and late or corrected data, and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for reliability, the failure being guarded against, the mechanism, how it was tested and what it cost.
- **Data produced at {{locations}} edge locations**: aggregate at the edge where possible (counters, sketches), buffer locally through link outages, transfer with idempotent keys (location, sequence) so resends do not double count, define lateness bounds and finality centrally, and state the staleness of configuration and reference data at each location.
- **The edge feature**: for fast global configuration, a versioned, ordered change log with acknowledgements per location and a rule for locations that are behind; for exact-once billing, edge counters keyed idempotently and reconciled centrally with restatements recorded; for serving while cut off, the decisions a location may make alone, with what default, and how it reconciles on return; for regional data placement, routing at collection by customer setting, keeping raw data in region and moving only permitted aggregates, with an audit. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; "send everything to the centre" with no plan for link outages or double counting; staleness never considered.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a reasoned split between edge and central work. 4: also alternatives with evidence, idempotent transfer and outage behaviour made explicit, an incremental and correct path to the edge feature, crisp separation of own and team contributions, and lessons that show changed practice.
