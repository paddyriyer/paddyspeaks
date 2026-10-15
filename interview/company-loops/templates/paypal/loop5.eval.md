# PayPal · Loop 5 — evaluator notes (hidden from candidates)

These are evidence-based leadership questions. Nothing here describes any company's hiring process, and no company's published values are the rubric: judge the reasoning, the evidence and the candidate's own contribution.

## PYP-L5-01

**What a strong answer contains.**
- **First hour**: confirm the symptom from data, not from complaints: from the request logs, the share of affected users by market, bank, platform and hour; the end-to-end time or outcome as the user experiences it; and the split at the boundary (time in our systems before the call, the partner's response time and codes, time after). Check recent changes on their own side (a release, a timeout change, a retry change) before blaming the partner.
- **First day**: a short written summary of the evidence and what is still unknown; with support, a holding answer for agents and an in-app message through the proper owners that tells users what is happening and what to expect, without naming or blaming the partner; harm-reducing changes that are theirs to make: honest status ("on its way, usually within …" instead of "sent"), timeouts and retries that do not pile load on the partner (capped, with backoff), and a clear route for users who are stuck.
- **First weeks**: with the partnerships manager, a meeting with the partner's engineers built on specific evidence (failures concentrated in particular banks, hours or request types, with examples by request id) and a proposal for a measure that reflects the user's outcome (for example, share of withdrawals available within N hours) rather than the agreement's narrower one; joint dashboards; an agreed escalation path. Legal and contractual questions go to the partnerships and legal teams with the evidence; the candidate does not conclude on them.
- **Lasting change**: service-level objectives per dependency on the user's outcome, alerts that would have fired in hours, a regular review with the partner, and a decision on a second provider based on measured harm and the quarter it would take.
- **Real example**: a dependency they did not control (vendor, partner, another team), what they measured, what they changed on their side, how they influenced the owner, and what they would do earlier next time.

**How to judge.** Credit evidence before blame and openness to the problem being on their own side; credit separating harm reduction (in their control) from root-cause fixing (in the partner's). A story where the candidate just escalated loudly, or waited for the partner, is weak.

**Red flags.** Blaming the partner publicly or to users by name; claiming the partner is in breach of contract; retries that multiply load; measuring success by fewer complaints rather than less harm; no change in detection afterwards.

**Rubric anchors.** 2: escalates or waits; no data split at the boundary; users told nothing useful. 3: evidence-based diagnosis split at the boundary, honest in-app status and sane retries now, specific evidence brought to the partner with the partnerships manager. 4: also a proposed user-outcome measure the partner accepts, lasting per-dependency objectives and alerts, a reasoned second-provider decision, and a credible real example with changed practice.

## PYP-L5-02

**What a strong answer contains.**
- **Trustworthy ranking**: a hand-labelled random sample (a few hundred contacts, read by people with access under the policy), with a simple taxonomy of causes and a "could a product change have prevented this?" flag; agreement between that labelling and the existing reason codes (or a classifier) measured before either is trusted at scale; sizes with confidence intervals (with n = 400, a cause at 20% has roughly ±4 points at 95%); for reason codes from a replaced list, a mapping between old and new codes checked on the sample.
- **Privacy**: minimum access; redaction of names, contact details and account identifiers before wider analysis; aggregates for anything shared; approval through the data policy before any new processing such as a language model on transcripts, with where it runs and what it retains settled first.
- **Prioritisation**: by preventable harm normalised by usage (contacts per thousand users of the feature, repeat contacts, contacts linked to money sent to the wrong person or abandoned payments), plus fixability and cost; the result may confirm or contradict the loud view, and the candidate is comfortable with either.
- **Getting it fixed**: brings the owning product team the evidence, examples (redacted) and the cost per week; agrees the success measure before shipping (contacts for that cause per thousand users, plus the user outcome); offers their own team's help with instrumentation.
- **Measuring**: compare against expected volume using a baseline that accounts for seasonality and releases (for example contacts for that cause as a share of feature users, or against a comparable market), staged rollout where possible; a hold-out only where withholding the fix does no harm and for a short time.
- **Keeping it current**: one small change to how agents record contacts (a short list of top causes, or a single "product could have prevented this" flag), a monthly refresh of the sampled ranking, and a named owner.
- **Real example**: operational data that changed what a team built, with the evidence and outcome.

**How to judge.** Look for the candidate testing the data before trusting it and for the privacy handling being concrete. A plan that ranks by raw reason-code counts without checking them is a 2.

**Red flags.** Reading or exporting transcripts widely; running a model over all contacts without approval; ranking by raw volume; overriding the loud view without evidence, or deferring to it without checking; declaring success from a drop that coincided with a seasonal low.

**Rubric anchors.** 2: counts reason codes and reports the top one. 3: labelled sample with measured agreement, harm normalised by usage, privacy handled, the owning team engaged with an agreed measure. 4: also uncertainty quantified, a fair measurement design, a durable recording change and refresh, the loud view handled respectfully with evidence, and a credible real example.

## PYP-L5-03

**What a strong answer contains.**
- **Understanding intent**: a short list of questions for the thirty minutes: what prompted the goal (a complaint, a competitor, a number), who the user is, what "done" would look like to the executive, and what must not get worse. Before that meeting, look at existing data and the competing definitions so the questions are sharp.
- **Measures**: one main measure defined precisely. For "sending money abroad feels instant": share of cross-border transfers available to the recipient within N minutes of the sender confirming, by corridor, measured from the sender's confirmation event to the recipient's available event. For "splitting a bill effortless": share of split requests fully settled within a day, or median taps from bill to all requests sent. For "trust that money is where we say it is": share of balance and status views that later needed correction, or contacts about missing or unexpected money per thousand users. Guardrails: failed or reversed payments, accuracy of what is shown, cost, support contacts.
- **Baseline and target**: measured over recent weeks with variation; a target justified by the size of the gap and the likely effect of the bets, not chosen to sound good.
- **Bets**: two to four, each tied to the main measure with an expected effect and a way to measure it separately; something explicitly stopped to make room within the fixed headcount; renamed existing projects kept only if they plausibly move the measure.
- **Alignment and reporting**: a written definition circulated and agreed with the other teams; monthly reports with the measure, the guardrails, what was learned, and honest statements when it has not moved, followed by a change of bets rather than a change of definition.
- **Real example**: an unclear goal made concrete, with how the definition evolved and what happened.

**How to judge.** Credit precision (population, events, computation) and honesty (where changing what users are told is a legitimate improvement, such as accurate expectations, and where it would be dressed-up spin). Probe whether the candidate can live with a measure that may not move.

**Red flags.** A dashboard of twenty metrics; a target picked without a baseline; claiming credit for every existing project; redefining the measure when it does not move; making the goal "feel" met by hiding delays.

**Rubric anchors.** 2: restates the goal as a list of projects. 3: clarifies intent, defines a precise main measure with guardrails and a baseline, picks a few bets, reports monthly. 4: also explicit trade-offs and things stopped, alignment through an agreed definition, honest reporting when progress stalls, and a credible real example.

## PYP-L5-04

**What a strong answer contains.**
- **Evidence in the first two weeks**: users affected and growing; incidents caused by the workarounds (incorrect statements, failed payments), money at risk, support load, engineering time the market spends on workarounds; the two planned launches that need the same thing; and, critically, whether the need is a wrong assumption in the shared component (for example amounts assumed to have two decimal places, identifiers assumed to be usernames, funding assumed to be instant). If so, it is a correctness risk for every market and debt that grows with each launch.
- **Options on the same terms**: do it now; remove the wrong assumption first (for example carry each currency's minor-unit exponent as data, or treat funding results as possibly delayed) and let the market's two engineers build the rest with review; defer with a committed date and safety fixes for the workarounds now. Each with cost, risk, and what each side loses.
- **Decision**: a written comparison both sides agree is fair, a clear recommendation, and the product director decides; the candidate does not dodge making a recommendation.
- **Carrying it through**: for whichever side loses, a reason, a date or condition for revisiting, and mitigations (for example, fixing the errors the workarounds cause immediately even if the full need waits); for any change to the shared component, tests across every market, flags and staged rollout; reviewing the market's engineers' work as a teaching investment.
- **Real example**: a smaller group's need weighed against a larger group's, with the outcome and the relationship afterwards.

**How to judge.** Strong answers find the shared-assumption angle and reframe the question from "which market" to "which risk". Credit a recommendation made and held under pressure, and care for the losing side.

**Red flags.** Deciding by revenue alone; deciding by who shouts loudest; letting the workaround errors continue as "the market's problem"; a general platform project with no shipping plan; deciding unilaterally against the stated decision rights.

**Rubric anchors.** 2: picks a side on revenue or seniority. 3: sizes both sides, recognises the shared assumption, offers a middle option, brings a recommendation to the director. 4: also fixes the immediate correctness risk regardless of the decision, communicates well to the losing side, protects every market in the change, and gives a credible real example.

## PYP-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one payment from one currency to another and names the assumptions that break (two decimal places everywhere, conversion in several places, privacy applied only when an entry is written, wide tables of individual payments). For currencies with 0, 2 or 3 minor-unit digits: integer amounts with the currency and its exponent carried as data in every schema and API, one conversion step rounded by a stated rule, and tests with a zero-digit and a three-digit currency. For privacy changes on every surface: a versioned visibility record checked on every read path (feed, search, notifications, exports), only ever made more private, with tombstones that rebuilds and replays honour. For rates matching quotes: quotes stored with an id, rate, expiry and the user's acceptance, each conversion referencing the quote id, and a reconciliation that the applied rate equals the quoted one. For own activity only: per-user views scoped by user, and aggregates with minimum group sizes for everyone else, with access to individual records logged and limited to need. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "consistency", "privacy" or "real time".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that uses floating point for money, assumes two decimal places, converts or rounds in several places, applies privacy only at write time, or exposes individual people's payments in wide dashboards.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
