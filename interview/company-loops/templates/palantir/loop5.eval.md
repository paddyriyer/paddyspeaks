# Palantir · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in commercial data
integration and operational analytics settings; score them on the rubric below,
not on any company's published values, culture statements or interview process,
and do not reward an answer for reciting one.

## PLT-L5-01

**What a strong answer contains.**
- **First days**: measure before talking: profile the data behind the first use case (share of records affected, by site, record type and age; which decisions the gaps break; whether the gap is growing). Find out who on the customer's side already knew, and why it did not travel. Separate "missing" from "inconsistent" from "wrong", because each has a different fix.
- **Telling people**: own lead first (same day), then the customer's project owner with the numbers and options, and together decide how to bring it to {{sponsor}}; framed as a shared problem, never as blame on the customer's data team, who may be the best allies.
- **Options with costs**: a narrower first release (the cleanest sites or record types, with the rest following); source fixes owned by the customer with named owners and dates; pipeline rules (mapping tables, unit conversions) that are visible, documented and reversible, never silent; a date change if nothing honest is ready. The decision belongs to the customer's project owner and sponsor; the candidate recommends.
- **Trust in the product**: coverage and quality shown next to the numbers (for example "work orders without an asset: 31%, excluded"), so users can judge. A plan to measure improvement weekly.
- **Under pressure to go live regardless**: explain in writing what users would see and what decisions it would mislead; offer the narrower release; if overruled, go live with the limitations shown in the product and a dated plan, and record the decision.
- **Real example**: a project where data was worse than expected, what they measured, how they told people, what was chosen, and what they would do earlier next time.

**How to judge.** Credit numbers and a sequence of conversations over general statements about communication. Credit a candidate who distinguishes source fixes (lasting, owned by the customer) from pipeline fixes (fast, but they become the candidate's to maintain).

**Red flags.** Quietly patching the data in the pipeline and going live; blaming the customer's staff; hiding the problem until go-live; promising the date without evidence; treating the sponsor's announcement as a reason not to tell them.

**Rubric anchors.** 2: "tell the customer and clean the data". 3: measures the gap in terms of decisions, tells the right people in the right order, offers options with costs, respects decision rights. 4: also quality made visible in the product, a clear source-versus-pipeline split with owners, a principled response to "go live anyway", and a credible real example with lessons.

## PLT-L5-02

**What a strong answer contains.**
- **Evidence**: a side-by-side comparison of the {{copies}} copies: inputs and their shapes, matching or business rules, outputs, how users act on them, and usage. Usually a common core (for {{solution}}: the data model, the lifecycle, the core calculation) plus a few real differences and many accidental ones.
- **Cost of the status quo**: field engineer hours per month on maintenance, incidents (including {{breakage}}), the time it would take to build the next copy, and inconsistent results between customers.
- **The case**: to the product team and whoever funds it, in numbers; framed as reducing field load and speeding new customers, with a deliberately small first version.
- **Field engineers as co-designers**: involve the authors of the strongest copies; extension points (configuration of rules, hooks for customer-specific steps) for real differences; documentation and a fast path for feedback. Adoption earned, not mandated.
- **First version**: the common core only; explicit list of what is not supported; a way to keep a customer-specific extension outside the product.
- **Migration**: per customer, run the product version in parallel and compare outputs (parity checks) before switching; agree with each customer about any behaviour change in advance; retire the copy afterwards.
- **Real example**: something they made reusable, how they found the common part, how they got adoption, and how they knew a year later (fewer copies, hours saved, faster rollouts).

**How to judge.** Probe the comparison method and the adoption story; credit a narrow first version and parity checks. A candidate who designs a highly configurable framework up front without evidence should be pushed on usability.

**Red flags.** Mandating adoption; a "platform" that tries to cover every copy's quirks; switching customers without parity checks; dismissing field engineers' concerns; no measure of success.

**Rubric anchors.** 2: "build a shared library and tell everyone to use it". 3: evidence-based common core, a case in numbers, field engineers involved, migration plan. 4: also deliberate scope limits and extension points, parity-checked migrations with customer communication, adoption measured, and a credible real example.

## PLT-L5-03

**What a strong answer contains.**
- **First hour**: restore the restriction (contain), confirm it holds, preserve the access logs and the change history; check whether any downstream datasets, reports or exports inherited the open access; tell someone immediately: with the manager unreachable, the manager's manager or the on-call security or privacy contact under the company's incident process.
- **Facts and scope**: from logs, who outside the intended group read the data, what and when ({{reads}}); whether anything was exported, scheduled into emails or copied into other datasets; whether the data identifies any person (for {{data}}, possibly staff in small units), which raises the stakes.
- **Disclosure**: the company's process decides what the customer is told, by whom and when, often under contractual notice terms; the candidate makes sure it starts the same day and provides facts, and does not either hide it or contact the customer unilaterally outside that process.
- **Review**: blameless, focused on why a reviewed change could drop a restriction unnoticed (no automated check that outputs are at least as restricted as inputs, review checklist without access), with the junior engineer protected and involved in the fix.
- **Prevention**: an automated check in the build that fails when a derived dataset is less restricted than its inputs under this exercise's model; alerts on restriction changes; periodic access reviews.
- **Real example**: a mistake they reported themselves, how fast, how people reacted, and what changed.

**How to judge.** The decisive signals are speed of containment and disclosure through the right channel, and honesty when the logs show no outside reads. Probe the "why tell anyone?" follow-up: a strong candidate explains that the customer and the company's process, not the engineer, decide whether it matters.

**Red flags.** Fixing quietly because "nobody read it"; waiting days for the manager; telling the customer directly and alone; naming the engineer as the cause; prevention that is only "be more careful".

**Rubric anchors.** 2: fixes it and mentions it later. 3: contains, scopes from logs, discloses promptly through the company's process, blameless review. 4: also checks onward copies and whether data identifies people, protects the engineer, adds an automated guardrail that would have failed the change, and gives a credible real example.

## PLT-L5-04

**What a strong answer contains.**
- **Understanding the number**: "matched planners {{accuracy}} of the time" measures agreement with past decisions, not correctness; break it down by situation (routine versus unusual, size of the order or asset, customer or site), look at what the disagreements cost, and check for situations the model has not seen.
- **Criteria**: cost of a wrong decision and who bears it (for {{decision}}, often a customer or safety), reversibility, accountability (who answers for it), explainability to the people affected, and how stable the situation is.
- **A concrete split**: automate routine, reversible, high-confidence cases with monitoring; route the rest to a person with the recommendation, its main reasons and the alternatives; record overrides and outcomes; sample automated decisions for review; criteria to expand or pull back automation.
- **Guarding against rubber-stamping**: measure review time and override rates, occasionally include cases where the model is known to be wrong, and keep the human decision meaningful.
- **Making the case**: in writing, with the breakdown and costs, acknowledging the {{hours}}-hour saving and showing how much of it the split still delivers; the requester decides; the risk is recorded if they choose full automation.
- **Real example**: a time they argued for or against automating a decision, the evidence, and the outcome.

**How to judge.** Credit a candidate who treats this as a design question with evidence, not a moral stance; one who proposes a split that delivers most of the saving scores well. Penalise both "never automate" and "the model is {{accuracy}} accurate, so automate everything".

**Red flags.** Refusing all automation; trusting the overall agreement rate; a human-review step that is a rubber stamp; overriding the requester's authority; describing model output to users as certain.

**Rubric anchors.** 2: opinion without evidence either way. 3: breaks down the agreement rate, weighs cost and reversibility, proposes a split with review, respects decision rights. 4: also guards against rubber-stamp review, records overrides and outcomes to revisit the split, quantifies the saving retained, and gives a credible real example.

## PLT-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined for {{sources}} source systems with {{requirement}}**: starts from identity and provenance: source keys kept alongside any unified key, matches recorded as data and reversible, lineage from every output back to its inputs. For inherited restrictions: restrictions propagated along lineage, with a build check that fails when an output is less restricted than any input, and a review path for deliberate declassification (for example aggregation). For row-level restrictions: labels on rows evaluated inside the query engine before aggregation and pagination, not by each application. For traceable edits: an append-only edit history with actor, time, reason and the action that made it, separate from pipeline values. For writeback: through the owning system's interface, with conflict detection against newer source data, retries that are idempotent, and an audit trail. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the integration part, credit specific mechanisms (lineage, recorded matches, checks that fail builds) over the words "governance" or "security".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; access enforced by convention in each query; matches that cannot be undone.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, an integration analysis that starts from identity and lineage. 4: also alternatives with evidence, an incremental and correct path to {{requirement}} with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
