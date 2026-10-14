# Salesforce · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a multi-tenant CRM
and customer-data-platform setting; score them on the rubric below, not on any
company's published values, culture statements, management frameworks or
interview process, and do not reward an answer for reciting one.

## SFC-L5-01

**What a strong answer contains.**
- **First two weeks, diagnosis**: evidence about {{platform}}: incident and on-call history, where time went last year (planned versus unplanned work), cost and growth curves, the dependencies that block the team, what dependent teams and customer-facing teams complain about, and what the pressure ({{pressure}}) means in numbers and dates. One-to-one conversations with every engineer about what they think is broken and why the last strategies faded.
- **The document**: a short diagnosis (the two or three problems that matter most), a few guiding choices (for example "every pipeline is region-aware before any new source is added", "we stop building one-off exports"), and the first concrete actions with owners. It names what the team will stop or defer and the rule for new requests (for example a fixed share of capacity for unplanned work, and anything above it needs the director's trade-off).
- **Involving people**: the team drafts parts of it; dependent teams and the director review the trade-offs before it is final, so the "no" is agreed before the first request arrives. The candidate expects and handles disagreement on the main choice in the open.
- **Keeping it alive**: a monthly check against a few signals (on-call pages, share of planned work completed, a migration milestone, a cost figure), a quarterly revision, and each new request judged against the stated rule. The strategy says what would prove it wrong.
- **Real example**: a direction the candidate set, what people did differently because of it, how it was tracked, and what they got wrong.

**How to judge.** Strategy without trade-offs is a wish list. Look for one or two hard choices and a credible mechanism for saying no. Probe whether the team helped write it. A candidate who has only contributed to someone else's strategy and says so, and then reasons well, scores well.

**Red flags.** A long list of goals with no order; written alone and presented; no rule for new requests; success measured by the document being approved; a real example in which nothing changed in anyone's behaviour.

**Rubric anchors.** 2: a roadmap of projects with dates. 3: evidence-based diagnosis, a few guiding choices with explicit trade-offs, team involvement, review points. 4: also an agreed rule for unplanned requests backed by the director, signals that would change the plan, a plan that survives the first urgent request in the follow-up, and a credible real example with behaviour change.

## SFC-L5-02

**What a strong answer contains.**
- **Start from the incident**: understand how {{incident}} happened without blaming the author; identify which question in a short review would have caught it (API consumption per run, matching on a value shared by many records, downstream readers of a schema).
- **Narrow threshold**: reviews only for changes that affect customers' limits or data, matching or merging, schemas others read, or anything hard to reverse; everything else continues as before. The threshold is written down and examples are given.
- **Cheap format**: a one-page template (problem, the change, what could go wrong for customers, how it is tested, how it is rolled back, who reads its output), an asynchronous review with a named reviewer and a 48-hour deadline, a meeting only when the reviewer asks for one.
- **Adoption**: designed with the team (they edit the template and threshold), piloted with willing engineers, the candidate submits their own designs first and takes criticism visibly. Given that the team {{pace}}, the answer explicitly protects speed (small changes skip it; the review deadline is short).
- **Measurement and adjustment**: issues caught in review, incidents in reviewed versus unreviewed changes, time from design to ship; a retrospective after a quarter; drop or change parts that do not help. Rubber-stamp reviews are addressed by rotating reviewers, asking reviewers to name one risk, and sampling reviews.
- **Resistant high performer**: a private conversation to understand the objection, a lighter path for their low-risk work, and a clear expectation for changes over the threshold.
- **Real example**: a practice the candidate introduced or changed, what it caught or cost, how they adjusted it, and whether it lasted.

**How to judge.** The goal is fewer avoidable incidents at a small cost to speed, not more process. Credit candidates who measure and are willing to remove what does not work.

**Red flags.** A mandatory review for every change; a weekly meeting for everyone; enforcing through the director; blaming the incident's author; no measure of whether reviews help; a real example whose only outcome is that the process exists.

**Rubric anchors.** 2: mandates reviews for all changes. 3: narrow threshold, cheap asynchronous format, team involvement, own designs reviewed first. 4: also measured outcomes and adjustment, a respectful handling of resistance, evidence for the director, and a credible real example with what changed.

## SFC-L5-03

**What a strong answer contains.**
- **Frame the decision**: what exactly is decided (cutting over the pipeline behind {{stake}} by the deadline), who decides (the candidate), what the options are, and what happens by default if no decision is made (the old pipeline stops because {{deadline}}).
- **First day**: group the differing orgs ({{gap}}) by attributes (region, size, time zone, integration patterns, event lateness, specific limit types) to find whether one or two causes explain most of the gap; size the effect on what customers see (how many orgs would see a changed statement or alert, by how much); confirm the explained causes are fixed or understood.
- **Options beyond yes or no**: cut over for orgs where both agree, keep the old computation's last output (or a short extension) for the uncertain group; cut over with old results archived for side-by-side comparison; cut over with a manual review before any customer-visible statement for the uncertain group; delay only the customer-visible part. Each with its cost.
- **Reversibility**: separate what can be corrected later (internal numbers, alerts that can be re-sent) from what cannot (a statement or a renewal conversation based on a wrong figure). Spend the scarce time on the irreversible part.
- **Triggers and monitoring**: before deciding, write down what would cause a reversal (for example any org whose figure moves by more than X% without an explained cause), who watches, and for how long a rollback stays possible.
- **Communication**: a short written note to the director: decision, evidence, unknowns, residual risk, triggers. Tell the account or support teams what to say if an admin asks. Look after a tired team: narrow the remaining work and share the load.
- **Real example**: what was known and unknown, the decision, how it turned out, and the lesson; honest about luck.

**How to judge.** Look for speed with structure: narrowing the unknowns quickly, preserving reversibility, and setting triggers in advance. The quality of the reasoning matters more than whether their real decision turned out well.

**Red flags.** Waiting for certainty that cannot arrive; cutting over everything without triggers; a decision made by consensus so nobody owns it; ignoring what customers would see; a real example told as a success with no uncertainty acknowledged.

**Rubric anchors.** 2: picks yes or no on instinct. 3: frames the decision, narrows unknowns by grouping, considers a partial option, sets monitoring. 4: also separates reversible from irreversible, sets reversal triggers before deciding, communicates residual risk crisply, handles the day-two question with an explanation backed by data, and gives a credible real example with lessons.

## SFC-L5-04

**What a strong answer contains.**
- **Own the pattern**: recognises that answering fast and taking over teaches the team to escalate; names the cost to the team and to their own new work.
- **Incident role**: on the next page, the candidate joins as coach: asks the on-call engineer what they see, what they have ruled out and what they would try next; shares hypotheses as questions; lets them drive. A pre-agreed rule for taking over based on customer impact (for example if a customer-visible incident passes a time threshold, or data loss is at risk), agreed with the team and manager in advance.
- **Knowledge transfer**: a debugging guide for {{system}} written as the candidate's method (where to look first, the queries and dashboards, how to narrow the problem), a catalogue of past failure modes with symptoms, recorded walk-throughs of past incidents, and game days that replay them. Ownership of each artefact moves to someone else.
- **Measurement**: share of incidents resolved without the candidate (from {{share}} toward a target), time to resolve, escalations within the first 15 minutes, and engineers' own confidence.
- **Handling a slower incident**: tells the manager plainly what happened, what it cost, and whether the takeover rule should change; protects the engineer who drove it.
- **Credit and room**: gives the engineers who resolve incidents visible credit, and lets them present incident reviews.
- **Real example**: a time the candidate made themselves less needed, or was a bottleneck, what they changed in their own behaviour, and what the others did with the room.

**How to judge.** Credit candidates who change their own behaviour and accept a short-term cost with a safeguard for customers. Probe the takeover rule and whether the artefacts outlive the candidate's involvement.

**Red flags.** "I'll write a runbook" as the whole answer; stepping away completely with no safeguard; continuing to solve incidents while saying they coach; taking credit for others' fixes; a real example in which the candidate remained the hero.

**Rubric anchors.** 2: documentation only, or no recognition of their role in the pattern. 3: coaching role in incidents, a takeover rule, knowledge transferred to artefacts, progress measured. 4: also pre-agreed takeover rules with the manager, ownership of artefacts handed over, honest handling of a slower incident, visible credit for others, and a credible real example of growing people.

## SFC-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined for {{tenants}} of tenants with {{requirement}}**: starts from the tenant id: where it enters, whether every key, index, cache key, log line and analytics row carries it, and where a query could omit it. Names the single-customer assumptions in their system (global uniqueness, one schema, one set of limits, one region). For strict isolation: tenant-scoped keys, enforcement in a shared data-access layer rather than in each query, tests that try cross-tenant reads, tenant-keyed caches and scrubbed logs. For limits: per-tenant quotas and fair scheduling sized for skew (the largest tenant is many times the median), admission control, and visibility for the tenant. For tenant-defined fields and objects: metadata stored as data (field definitions per tenant) with values in a generic layout or typed columns mapped per tenant, not a schema per tenant at this scale. For data residency: tenant placement by region, routing by tenant, and checks that derived copies (backups, analytics, logs) stay in region. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the multi-tenant part, credit specific mechanisms over the word "isolation".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a multi-tenant answer that relies on every developer remembering a WHERE clause, or proposes a database per tenant for {{tenants}} of tenants without addressing migrations and cost.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a tenant-aware analysis naming single-customer assumptions. 4: also alternatives with evidence, an incremental and correct path to {{requirement}} with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
