# TikTok · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a short-video
setting; score them on the rubric below, not on any company's published values,
culture statements, management frameworks or interview process, and do not
reward an answer for reciting one. Moderation is discussed as a process only:
never ask for or reward examples of content.

## TTK-L5-01

**What a strong answer contains.**
- **First conversations**: private one-to-ones with each engineer, starting with the person who raised it (if anyone did): listen, thank them, say what will change and when. No probing for what they saw, no diagnosing, no promises the candidate cannot keep. Point to support that is private and say plainly that using it never counts against anyone.
- **Measure and reduce exposure**: find out who opens reported items, how often and why (access logs, or a quick honest inventory). Change the default: access to items only when a task truly needs it, logged and approved by a second person; debugging and tests on masked or synthetic data; tools that show metadata, counts and ids instead of items; a cap and rotation for the few tasks that still need access, applying to everyone including the most experienced engineers and the lead.
- **Support**: ask for specialised support suited to this work, not only the general service; make it normal (team-level sessions, time in the calendar), and private (the manager never learns who used it). Model it: the lead follows the same limits.
- **Delivery**: quantify what the changes cost in time; bring a scope or date proposal to the programme's leads with the reason and the evidence, rather than quietly absorbing the cost through more exposure. Never trade the limits for the date.
- **Measuring**: aggregate and voluntary measures (exposure counts from logs falling, opt-in pulse questions, attrition, sick days in aggregate), with nobody required to disclose anything.
- **Specific to {{trigger}}**: for the three-day debugging incident, a blameless review of why debugging needed real items, and the masked-data tooling as its action; for the engineer asking to move, honour the request without making them justify it, and treat their "others feel the same" as a signal about the system, not about individuals; for the doubling launch, design exposure down before the volume arrives.
- **Real example**: a real time the candidate protected a team under pressure (not necessarily moderation work: on-call load, incidents, crunch), with specific actions, the trade-off with delivery, and what changed.

**Red flags.** Asking engineers to describe what they saw; treating resilience as a personal trait to be trained; limits that exempt the best engineers "for the deadline"; support that is visible to the manager; delivering the date by quietly increasing exposure; any description of content.

**Rubric anchors.** 2: sympathetic but vague ("offer counselling"), no change to how work is done. 3: private conversations, exposure measured and reduced through tooling and access rules, private support, the delivery trade-off raised with evidence. 4: also limits that apply to everyone including the lead, a blameless review of the trigger with systemic actions, aggregate measures of improvement, and a credible real example with honest lessons.

## TTK-L5-02

**What a strong answer contains.**
- **Define "works" per language**: a quality bar with the same shape for every language (for example, for {{feature}}: an error measure on a test set, a creator-facing usability check, and a performance check), with thresholds that may differ by language and are agreed with product before measuring.
- **Risk classes first**: group the {{languages}} languages by what breaks systems: script direction (right to left), segmentation (no spaces between words), character sets and normalisation, plural and number formats, input methods. Test one language from each class end to end in the first weeks; a fix for the class usually fixes the rest.
- **Thin data**: build small, representative test sets with regional teams and contracted reviewers using a written method; report quality with confidence intervals and say when a sample is too small to decide; never translate a test set and assume it measures the same thing without checking.
- **Address {{gap}}**: make the stated gap the first workstream with an owner and a date.
- **Coordination**: one launch plan with per-language owners, handoffs that follow the sun, a single decision log, and a rehearsal; no person awake for the whole day.
- **Go/no-go per language**: criteria set in advance; languages below the bar launch later, behind the per-language switch, with an honest message to creators and a date. The recommendation goes to product with evidence and a plan, early.
- **After launch**: per-language monitoring (usage, errors, turn-off rate, support contacts), compared with expected baselines; a named person per time zone who can use the switch.
- **Real example**: a real multi-language, multi-market or multi-locale launch, with what surprised them and what they changed.

**Red flags.** One global metric for every language; launching everything on the date regardless of quality; translating English test data and calling it measured; a plan that depends on one heroic person or one time zone.

**Rubric anchors.** 2: "test every language" with no prioritisation or bar. 3: per-language bar, risk classes tested early, thin-data measurement with stated confidence, criteria-based go/no-go with a switch. 4: also follow-the-sun coordination with owners and a rehearsal, an early honest phased-launch recommendation explained to creators, post-launch per-language monitoring, and a credible real example.

## TTK-L5-03

**What a strong answer contains.**
- **Diagnose**: classify the {{breakages}} breakages by cause (renamed or removed fields, duplicated events, new flows unmapped, changed semantics with the same name). Each class has a different prevention.
- **Shift left**: event definitions live in code as typed schemas owned by the product team that emits them; the app build validates events against them; a pre-release test asserts that key flows emit the expected events with the expected fields and counts (once per action, not twice on reconnect); changes are checked for compatibility (add fields freely, deprecate before removing, no reuse of a name with a new meaning).
- **Ownership and lineage**: every event has an owning team; a lineage view shows which metrics and creator-facing numbers depend on each field, so a change shows its consumers automatically, before release.
- **Make it cheap**: generated client code from the schemas, a one-line test helper, fast feedback in the build; checks that warn first and enforce later, with an exception path that is quick and logged.
- **Without blocking authority** ({{authority}}): adoption through the product teams' leads and a director's sponsorship, pilots with one or two willing teams, published results; a check that flags in review rather than blocking, until teams ask for it to block.
- **Detection still matters**: monitoring on metric shapes per release version to catch what slips through within hours, not days, with the release version as a dimension.
- **Measure**: breakages per release, time to detect, metrics wrong per month, share of events under contract, over a quarter.
- **Real example**: a real improvement to data quality in a fast-moving product, with the resistance met and what changed.

**Red flags.** More dashboards and alerts only; a data team that fixes every break by hand forever; mandates with no tooling; blaming product teams; deduplicating downstream without fixing the client.

**Rubric anchors.** 2: "add data quality checks in the warehouse". 3: diagnosis by cause, schemas and tests at the point of change, ownership with a compatibility policy, cheap tooling. 4: also lineage that shows consumers before release, adoption without authority with pilots and sponsorship, release-version monitoring, measured improvement, and a credible real example with honest resistance.

## TTK-L5-04

**What a strong answer contains.**
- **First**: calm down before acting; check the facts (the slides or announcement, what was said, what the other team did contribute). Talk to the two engineers soon: acknowledge it, say what you will do, and ask what matters to each of them, since they want different things.
- **With the other team**: a private conversation with its lead, assuming an oversight: "the presentation did not mention our part; can we fix that?" Ask for something specific and proportionate: credit in their next update or the written record, the engineers named in the launch notes, a joint mention at the next review.
- **For the engineers**: make sure the promotion evidence shows the work: the design documents, code, the candidate's own written assessment of the engineer's contribution, sent through the promotion process. That matters more than a public correction.
- **Manager**: inform the manager early and briefly, with facts and the plan, and ask for help only if the direct conversation fails; avoid making it a complaint about a peer team.
- **Next quarter**: keep the working relationship; separate the incident from the plan.
- **Prevent**: written design documents and launch notes with authors, shared ownership of presentations about joint work, and a habit of the team presenting its own work.
- **Real example**: a real time credit went elsewhere for the candidate's or their team's work, or they saw it happen to someone else, with what they did and how it ended; a candidate who once took too much credit and corrected it also gives strong evidence.

**Red flags.** Public confrontation or a complaint before any conversation; dropping it without telling the engineers anything; focusing on their own visibility over the engineers'; holding a grudge that harms next quarter's plan.

**Rubric anchors.** 2: either confronts publicly or does nothing. 3: checks facts, talks privately with the other lead and asks for a specific fix, makes sure the engineers' work reaches the promotion decision. 4: also handles the two engineers' different wishes, involves the manager proportionately, keeps the relationship, builds visibility into future work, and a credible real example with lessons.

## TTK-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one event and names the assumptions that break at the scale (one process for all volumes, server-assigned ids, full recomputation, late data counted on arrival). For uploads retried and resumed: a client-generated upload id, idempotent processing keyed by it, attempts collapsed into one upload, late mobile events counted on their event date. For gift totals that match statements: an append-only ledger keyed by client gift ids, on-screen totals as a fast projection, and a reconciliation after each session. For regional rules: rules versioned with validity dates per country, joined as of the event date, and a record of which rule applied. For aggregates only: creator views scoped to the creator, minimum group sizes for anything wider, and access to individual records logged and limited to need. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "consistency", "privacy" or "real time".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that counts retried uploads several times, applies today's regional rule to last month's events, or exposes individual viewers' activity in wide dashboards.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
