# Apple · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a devices, app store,
subscriptions and cloud-services setting; score them on the rubric below, never
on any company's published values, culture or interview process.

## APL-L5-01

**What a strong answer contains.**
- **The request without the reason**: a precise ask (the field and its semantics, or the capacity in events per second and for how long, or the export's extension and its end date), the date, an estimate of what it costs the other team, what the candidate's team will do to reduce that cost, and what happens if it is late. All of that can be shared; only the purpose cannot.
- **Honesty**: says plainly "I cannot share what this is for" and does not invent a reason. A strong candidate notes that a false reason is discovered at announcement and damages every later request.
- **Bringing people in**: asks the sponsor to add the minimum set of people (usually one lead per team) through the project's process, with a short written case so the sponsor can decide quickly; accepts a refusal and works within it.
- **Making it worth their while**: offers engineers to do part of the work in the other team's system under their review, flexibility on the shape of the change, or a commitment of help on something the other team needs.
- **Workarounds**: weighs building around another team's system (launch risk, on-call ownership, removal after launch) and prefers a supported change; if a workaround is unavoidable, it is agreed with the owner and has an end date.
- **After the announcement**: thanks the teams specifically, explains what they enabled, acknowledges the inconvenience of working blind, and removes temporary arrangements.
- **Real example**: a request made with limited context (secrecy, a sensitive reorganisation, a security issue under embargo, or simply incomplete information), what the candidate chose to say and not say, and how it turned out.

**Red flags.** A cover story; hinting at the secret to win help; going around the sponsor's process; building on another team's system without telling them; treating the other teams' questions as obstruction.

**Rubric anchors.** 2: either leaks the purpose or invents one; or simply escalates. 3: precise, costed request shared openly without the purpose; honest refusal to explain; minimal disclosure through the sponsor; something offered in return. 4: also a well-judged workaround decision with ownership and removal, repair of the relationships after announcement, and a credible real example handled with integrity.

## APL-L5-02

**What a strong answer contains.**
- **First days**: one list of everything promised, with each stakeholder's actual need and date (day one, week one, month one), agreed with {{stakeholder}} and the launch lead. Classification by recoverability: raw event capture (with its schema and durability) must be right on day one; derived metrics, dashboards and backfills can follow if the raw data exists.
- **The gap as a measured risk**: for volume gaps, a synthetic event generator and load tests at and beyond expected volume, finding the first limit; for missing validation or backfill, validation at capture that quarantines rather than drops, and a replay path from raw storage; for an untested join, a run on production-sized data and a simpler fallback number that does not need the join. A defined degraded mode for launch day if the fix is not ready (for example raw capture plus a sampled or delayed metric).
- **Cuts**: made early, as one decision with each owner of a promised feature, through the person entitled to agree; each cut comes with when it will arrive and what the stakeholder gets meanwhile.
- **Launch day**: runbooks, on-call, dashboards on the pipeline's own health, who may switch to the degraded mode, and a time by which first numbers will be available, announced in advance.
- **Status**: reported against thresholds decided in advance (what makes it red), early, without optimism; a sustainable pace for the team.
- **Real example**: a fixed-date delivery where scope gave, what was cut and why, how stakeholders were told, and the result on the day.

**Red flags.** "We'll work weekends"; cutting quality of raw capture to save a dashboard; cuts announced on launch day; reporting green until the week before; no fallback.

**Rubric anchors.** 2: tries to deliver everything by working harder. 3: recoverability-based prioritisation protecting raw capture, measured risk with load tests and a fallback, early open cuts through the right people, honest status. 4: also an explicit degraded mode with decision rights, a replay path for derived data, sustainable pace, and a credible real example with measured outcome.

## APL-L5-03

**What a strong answer contains.**
- **Diagnosis**: separate one-to-ones with each engineer to understand their position on direction, ownership and how they feel treated; looks at the evidence (design reviews, duplicated components, incidents) and talks to others affected. Separates three questions: technical direction, decision rights, working relationship.
- **Owning the gap**: acknowledges that ownership of {{area}} was never defined and that this is the leader's responsibility.
- **Settling ownership**: a written decision on who owns {{area}} (or a clear split with a boundary and a rule for changes crossing it), what the owner decides alone, what needs consultation, and how disagreement is raised and closed (for example a design review with a named decider and a time limit). The technical direction is decided on evidence, with both engineers' strongest points included and credited.
- **Bringing them together**: a joint conversation after the one-to-ones, with a clear goal: agree the rule, not relitigate history. Expectations about behaviour in reviews stated directly.
- **Repairing damage**: consolidating the duplicated work with both involved; restarting stalled reviews with the new decision rule; a conversation with any engineer who wanted to leave; stopping side-taking.
- **If one will not accept it**: a direct conversation about disagree-and-commit and its limits; if behaviour continues, treat it as a performance matter with specific examples.
- **Measures**: review cycle times, duplicated work stopped, the two collaborating on a concrete deliverable, team feedback.
- **Real example**: a conflict the candidate dealt with, their own actions, what changed, and what they would do differently.

**Red flags.** Waiting for it to resolve itself; deciding the technical question by seniority or by who is louder; only a joint meeting with no preparation; treating the conflict as personality alone; threatening either engineer without evidence.

**Rubric anchors.** 2: "get them in a room" or "let them sort it out". 3: separate diagnosis, owns the missing definition, written ownership and decision rights, joint agreement, concrete repair. 4: also fair handling that keeps both engineers' strengths, a disagreement path with a decider, clear handling of continued relitigation, measures of resolution, and a credible real example with lessons.

## APL-L5-04

**What a strong answer contains.**
- **First conversation**: accepts the other team's reason, asks what is still possible and when, and proposes the smallest version of {{interface}} that unblocks the launch (fewer fields, a lower frequency, a file instead of an interface).
- **Options, priced**: (a) the minimal version from the other team; (b) the candidate's engineers building it in the other team's codebase, with the other team's review, standards and agreement on who runs it after launch; (c) a temporary alternative source (the nightly report) with its differences measured and documented, a named owner and a removal date; (d) launching part of the reporting later. Each priced in engineer-weeks, risk and what it leaves behind.
- **Negotiation**: offers something real (engineers, taking over a chore, flexibility on the shape); writes down what is agreed.
- **Escalation**: if no agreement, goes to the shared director together with the other lead if possible, with two or three options, their costs and a recommendation; accepts the decision and plans around it.
- **Communication**: tells stakeholders early which parts of the launch change; if developers are affected, says what they will see and when the full version arrives; never presents an approximate source as exact.
- **Prevention**: dependency agreements with checkpoints, early warning signals, and contingency planned for critical dependencies.
- **Real example**: a dependency that fell through, what the candidate negotiated, the option chosen and its outcome.

**Red flags.** Escalating first; blaming the other team; a temporary source with no owner or removal plan; quietly launching on approximate data; pressing engineers into the other codebase without the other team's agreement.

**Rubric anchors.** 2: complains or escalates with no options. 3: minimal ask, priced options, negotiation with something to offer, escalation with options and a recommendation, honest communication. 4: also ownership and removal plans for any temporary path, joint escalation, prevention through agreements with checkpoints, and a credible real example.

## APL-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change and late or corrected data, and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for reliability, the failure guarded against, the mechanism, how it was tested and what it cost.
- **The privacy redesign for {{devices}} devices**: names what moves onto the device (filtering, aggregation, randomisation), what leaves and in what form, and what the server may still know (counts, coarse attributes, no linkable identifiers). Recognises which outputs survive (population aggregates), which become estimates with error, and which are lost (per-user joins, funnels across sessions, long-term cohorts unless designed differently). Knows that hashing an identifier does not anonymise it.
- **The privacy feature**: for raw events staying on the device, on-device aggregation with a fixed schema and server-side sums; for a per-day limit, enforcement on the device with a persisted ledger, since the server cannot link reports; for a release threshold, a minimum population and error-based thresholds with suppression; for deletion, lineage from every derived table back to the user's records, deletion propagated with verification, or aggregates that hold no per-user data. Accept other sound answers that fit their system, and do not expect deep differential-privacy mathematics.
- **Honesty**: what failed, what they would change, what was the team's versus theirs, and which parts of the privacy answer are reasoning rather than experience.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. In the privacy half, reward correct reasoning about what the server must not see over vocabulary.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; "we hash the user id, so it is anonymous"; claiming privacy with no change to what leaves the device.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution, privacy treated as access control only. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a reasoned split between device and server with what is lost stated. 4: also alternatives with evidence, a verifiable path to the privacy feature, correct handling of identifiers and thresholds, crisp separation of own and team contributions, and lessons that show changed practice.
