# Together AI · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in the setting of a
cloud that fine-tunes and serves open models; score them on the rubric below, not
on any company's published values, culture statements, management frameworks or
interview process, and do not reward an answer for reciting one. No answer should
reach a legal conclusion about a licence or claim knowledge of a real company's
customers or systems.

## TGA-L5-01

**What a strong answer contains.**
- **First hour**: read the publisher's announcement; confirm with legal that they own the interpretation and ask what facts they need; tell account teams and support that the platform is reviewing it and that nobody gives customers an interpretation; stop the "switch every alias tonight" idea by naming who would have to decide it and what it would break.
- **Facts, fast and scoped**: an inventory by tenant, model version and path (serverless calls by alias and by exact version, dedicated endpoints, fine-tuning jobs and adapters on this family), with traffic shares, from request records and job metadata, never from data contents. Legal and product see what they need; each account team sees only its own customers; tenants can see their own usage. Kept current with a daily refresh and a stated as-of time.
- **Communication**: a holding message to customers who ask: what was announced (with a link), that the platform is reviewing what it means for the service, that customers should consult their own advisers about their own use, and the date of the next update. Nothing that sounds like advice or an interpretation.
- **Options prepared, not executed**: for {{change}}, plausible platform decisions include keeping earlier versions available on their earlier terms if legal concludes that is right, adding a named alternative family, offering migration help for fine-tunes and adapters (re-training on another base, with cost and time estimates), or changing what is offered on serverless versus dedicated endpoints. Each option is checked for feasibility (capacity, onboarding time, acceptance checks) before it is put to the owners, with a timeline that fits the {{days}} days.
- **After the decision**: catalogue changes as new versions and states (never edits in place), notices with dates, per-tenant migration reporting, and a review of how quickly the inventory could be produced.
- **Real example**: an outside change (a vendor's terms, a dependency's licence, an API retired by a provider, a regulation interpreted by others) that forced a decision on something in production, with what the candidate contributed and how the decision was made.

**How to judge.** The core is staying inside one's own role while being maximally useful: fast, precise facts and prepared options, with communication that is early but makes no claims the candidate does not own. Credit candidates who stop a rushed production change without being obstructive.

**Red flags.** Giving customers or colleagues an interpretation of the terms; switching aliases or blocking a model without a decision by the owners; sending a broad announcement before anyone knows what to say; sharing one tenant's usage with another tenant's account team; a real example where the candidate made the call that belonged to someone else and calls it leadership.

**Rubric anchors.** 2: interprets the licence, or acts on production immediately, or does nothing until legal speaks. 3: respects decision rights, delivers a scoped inventory quickly, sends a holding message without conclusions, prepares options. 4: also checks options for feasibility against the timeline, plans for each plausible decision, follows through with versioned catalogue changes and migration reporting, and gives a credible real example.

## TGA-L5-02

**What a strong answer contains.**
- **Rule kept, and explained**: to support first (why the rule protects every customer, including this one), then to the customer in plain words with what the platform can do instead. No exception, no "ten lines".
- **Diagnosis from metadata**: for {{failure}}, explicit hypotheses with predictions. NaN loss: learning rate or method defaults too high for the base model, sequences near the length limit, mixed precision issues; check the step of failure against the learning-rate schedule, length distribution from validation, and whether other jobs with the same configuration failed. Prompt repetition: loss computed on prompt tokens rather than only on the assistant turn, a chat template mismatch, very short assistant turns; check validation counts of turn lengths per role and the job's template and loss settings. Out-of-memory at one step: a few very long examples landing in one batch; check the maximum length and the length distribution, and the batch composition rule. No improvement: too few examples or epochs, a learning rate too low, an evaluation that differs from training format; check counts, epochs, and the metrics curve.
- **Reproduce with synthetic data**: build a dataset with the same counts, length distribution and turn structure from the validation summary; if the failure reproduces, the cause is in configuration or the platform, and it can be shown to the customer without any of their content.
- **Equip the customer**: a precise description of what to look for in their own data (for example "the 37 lines whose assistant turn exceeds N tokens", "lines where the assistant turn is empty after trimming"), a local checker, or extra named checks they request that report counts and line numbers only.
- **Platform causes**: if a default is wrong (for long sequences, say), fix it for everyone, tell this customer and others affected, and consider whether failed jobs should be credited (a decision for the owners).
- **Deadline**: honest options within {{deadline_days}} days: a configuration that avoids the failure mode, a smaller first release, help from the team in working sessions; no promise that it will work.
- **Real example**: a real case of diagnosing something they could not see directly (a customer's environment, a partner's system, encrypted or restricted data), how they did it and what they learned.

**How to judge.** Credit systematic diagnosis and respect for the rule together. The weakest answers either break the rule or retreat behind it; the best ones make the rule cost the customer as little as possible.

**Red flags.** Opening the dataset or asking the customer to email it; vague "check your data" advice; blaming the customer before checking platform defaults; promising a working fine-tune by the deadline; a real example that relied on breaking a similar rule.

**Rubric anchors.** 2: breaks the rule or offers nothing beyond "check your data". 3: hypotheses from metadata, a synthetic reproduction, precise guidance for the customer, the rule explained. 4: also checks aggregate outcomes for a platform cause and fixes it for everyone, manages the deadline with honest options, and gives a credible real example.

## TGA-L5-03

**What a strong answer contains.**
- **Evidence per model**: demand (API requests naming the model that currently fail, waitlist sign-ups, tickets, account notes, each de-duplicated by tenant), expected traffic with a range, cost to serve (size, context length, memory and throughput on the serving variants), onboarding effort, overlap with catalogue models (is it meaningfully different?), licence status as recorded by the owners, and the publisher's history of revisions. The least reliable signal is named (often account notes and announcements).
- **Weighing**: a simple, explicit comparison (expected tenants and traffic per unit of effort and ongoing cost), with ranges and a sensitivity check showing whether reasonable alternative weights change the top {{capacity}}.
- **Recommendation**: one page, first lines saying which models, why, and what would change the choice; the rest in an appendix. Product leadership decides.
- **Pressure handled on evidence**: for {{pressure}}, quantify it (what traffic the customer would bring, verified through their account team; what tenants actually ask for versus what a competitor announced; whether the small model fills a real gap) and include it as one input, not the decision.
- **Saying no for now**: tell requesters which models were not chosen, why, and when the decision will be revisited; offer a path (a dedicated endpoint with the customer's own weights, if the platform supports it, or a preview if product agrees).
- **Revisit**: triggers decided in advance (request volume for a skipped model above a threshold, a publisher revision, a licence review completed) and a monthly review; learn from misses by checking which signal would have predicted them.
- **Real example**: a real prioritisation with many good options, what was declined and how the people who wanted it reacted.

**How to judge.** Credit structured, honest estimates with uncertainty and the courage to decline. A long weighted spreadsheet without a sensitivity check is not better than a clear short comparison.

**Red flags.** Adding whatever is loudest; trying to onboard everything by skipping checks; treating a competitor's announcement as demand; ignoring the long-term cost of each model; deciding licence questions themselves; a real example with no declined option.

**Rubric anchors.** 2: picks by excitement or by the loudest voice. 3: comparable evidence with ranges, ongoing cost counted, a clear recommendation, pressure weighed as evidence. 4: also a sensitivity check, explicit revisit triggers, honest communication of no-for-now with alternatives, and a credible real example.

## TGA-L5-04

**What a strong answer contains.**
- **Verify**: recompute idle share from request and replica records independently; separate forgotten idle (endpoints with no requests for days, replicas left after tests) from deliberate warm capacity (minimum replicas kept for latency, with regular traffic); adjust {{idle_share}} accordingly and say how much of it is clearly unintended.
- **Frame for the owners**: short-term revenue effect (about {{revenue}}, with its range) next to long-term effects: customers who found idle cost themselves and left, the cost of support disputes, trust in the bill, and the likelihood that competitors offer the same view. State what cannot be quantified. The product and business owners decide.
- **Engage the objection**: for {{objection}}: the quarter concern is real and can be addressed by timing and by pairing the view with recommendations that keep customers on the platform (right-sizing rather than leaving); "customers chose their settings" is true, and the view is what lets them choose with information; an opt-in report is a reasonable first step if it is discoverable and the monthly notice for endpoints idle most of the time still ships.
- **Acceptable and unacceptable compromises**: acceptable: staged rollout, opt-in first with a date to make it default, recommendations framed as right-sizing. Unacceptable: numbers that do not match the invoice, hiding the idle view from customers who look for it, or misleading framing.
- **Build it right**: idle minutes from the same replica-minutes as the bill; deliberate warm capacity labelled; recommendations with the expected saving and the expected latency effect.
- **Measure**: retention and expansion of customers who saw the view versus a comparable group, dispute and support volume, revenue per retained customer over a year.
- **Respect the decision**: if overruled, accept it, record the disagreement and the evidence, and propose a review date with the measures.
- **Real example**: a real case where the candidate argued for transparency or a customer-favourable change that cost their organisation, who decided, and what happened.

**How to judge.** The core is integrity combined with business judgement: candidates who say "just ship it, it's right" without engaging revenue concerns score lower than those who make the long-term case with evidence and still respect the owners' decision.

**Red flags.** Inflating the idle share; dismissing revenue concerns; going around the decision owners; a view whose numbers differ from the invoice; agreeing to bury it; a real example where nothing was at stake.

**Rubric anchors.** 2: either "revenue first" or "transparency at any cost", no verification. 3: verified analysis with deliberate warm capacity separated, an honest long-term versus short-term framing, engagement with the objection, numbers tied to the invoice. 4: also a clear line between acceptable and unacceptable compromises, a measurement plan, a respectful path after the decision, and a credible real example.

## TGA-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one inference request or one uploaded dataset and names the assumptions that break at the scale (one database for everything, full recomputation, names used as keys, tenant filters added by hand in each query). For usage that matches the invoice: events keyed by request id and deduplicated, per-model tokenizers and versioned prices, integer units with one rounding step, and a continuous tie-out with the invoice. For deletion in every copy: an inventory where every copy registers before use, per-artefact or per-tenant keys for backups and caches, a deletion workflow with verification before the receipt. For honest per-tenant latency: mergeable sketches per tenant and model version, never averaged percentiles, a low-volume floor with counts shown instead. For traceability: immutable model and adapter version ids, aliases resolved and recorded on every request. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "accurate", "secure" or "real time".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that uses floating point for money, keys records by mutable names, averages percentiles, or treats deletion as removing one object.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
