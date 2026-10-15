# Google DeepMind · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in the setting of a
research lab with public science products; score them on the rubric below, not
on any company's published values, culture statements, principles, management
frameworks or interview process, and do not reward an answer for reciting one.
Every situation is hypothetical; no real research result, partner or release is
implied.

## GDM-L5-01

**What a strong answer contains.**
- **First hour**: reply to the reporter with thanks and a commitment to a date for the next update; freeze any release work that could spread the error (a mirror sync, a derived dataset); write down what is known, what is suspected and what is not known. Do not publish anything yet, and do not overwrite files.
- **First day**: run a scope check that would catch the same class of error anywhere in the release, not just where it was reported (for misaligned sequence versions: compare every entry's sequence with the catalogue version it claims; for swapped confidence files: check each file's residue count and identifiers against its structure; for a short archive: compare archive contents with the release manifest, not with the archive's own checksum list). Brief the partner institute with the facts and the scope.
- **The fix**: regenerate the affected files as a new version, publish a corrected release (or a point release), and keep the faulty version resolvable but marked: entry pages carry a visible notice with the date, what was wrong, which version is affected and where the corrected one is; the release notes and an errata page list affected entries; archive manifests carry new checksums and a changes list. Never replace files silently.
- **The partner's quiet fix**: argue with evidence for prompt, plain correction: the error is known to at least one researcher who will publish it; anyone using the data in the next three months builds on it; trust in a public resource depends on visible corrections. Offer to do the work and draft the notice with them; agree the wording and timing together, because public statements are joint.
- **Reaching users**: entry-page notices, release notes, a mailing list or announcement channel, direct contact with known mirrors and bulk users, and a note that tools reading the manifest will see the change.
- **The preprint question**: describe exactly what was wrong in the data and which entries; say plainly that you cannot judge their conclusions and that no medical or clinical inference should be drawn from the database either way; point to the corrected files.
- **Prevention**: a release gate that runs the scope check for this error class on every release, and a review of why the existing checks missed it (for the archive, a checksum list generated from the archive instead of from the manifest).
- **Credit**: acknowledge the reporter publicly with their permission.
- **Real example**: a real data error others had used, how users were reached, and what check was added.

**How to judge.** Look for scope before statements, versioned correction over silent replacement, joint communication with the partner without accepting a long silence, and a durable check. Credit candidates who keep the impact statement factual.

**Red flags.** Overwriting files; waiting for the next scheduled release without telling anyone; announcing before the scope is known; speculating about medical or research consequences; blaming the partner or the reporter; a real example in which nobody outside the team was told.

**Rubric anchors.** 2: fixes quietly or in place, or announces without knowing the scope. 3: scopes with a broad check, corrects with versions and errata, works through the partner, adds a check. 4: also reaches mirrors and bulk users, keeps citations honest, argues the timing with evidence while preserving the partnership, credits the reporter, and gives a credible real example.

## GDM-L5-02

**What a strong answer contains.**
- **First two days**: sit with two or three members of the team while they launch runs; instrument the platform to time each step (commit, push, registration, capture); separate the rule's purpose (reproducible, citable results) from its mechanism (for the rule that {{rule}}, how it is enforced today).
- **Quick fixes**: remove the measured friction while keeping the protection, for example capturing the uncommitted diff automatically at launch instead of requiring a commit; registering a snapshot automatically from a path with a manifest built in the background; marking runs "fully captured" automatically so citation needs no extra step. Ship within days for a team facing {{deadline}}.
- **Exception, if any**: narrow (this team, this push, specific run types), time-limited (ends at {{deadline}} plus a short grace), with conditions (runs must still be launched through the platform so something is captured; anything to be cited must be re-run or recovered under the rule before citation), and agreed with research leadership because they own the rule.
- **Workstation runs**: no blame; offer a way to register them after the fact (code state, environment, data paths, seeds as far as known), label them as partly captured, and require a captured re-run before outside citation.
- **Judgement later**: measured launch overhead before and after, the share of runs launched outside the platform, and whether any result from the push could not be reproduced.
- **Real example**: a rule or standard they owned that slowed people down, what they measured, what they changed in it, and what they kept.

**How to judge.** Credit measurement over opinion, reducing friction over granting blanket waivers, and keeping the reason for the rule intact. The best answers treat the workaround as data about the platform's cost.

**Red flags.** Waiving the rule indefinitely because a senior person asked; enforcing harder without measuring; blaming the researchers; ignoring the workstation runs; making a decision that belongs to research leadership alone.

**Rubric anchors.** 2: either "rules are rules" or a blanket waiver. 3: measures the cost, removes friction, a scoped exception with conditions and an end date, brings outside runs back in. 4: also involves the rule's owners correctly, defines how success is judged, plans the recovery of results made under the exception, and gives a credible real example.

## GDM-L5-03

**What a strong answer contains.**
- **Understand the partner**: meet their lead and team before the meeting; learn what they are measured on and funded for, their capacity, and what the change under discussion would cost them in support, storage, hosting and risk; write it down and check it with them.
- **Evidence both sides trust**: download and API logs (shared, with the same definitions), support tickets, a short user survey designed together, and who would be affected by each option (for example mirrors and pipelines that depend on a schedule, or citations that depend on old releases).
- **Options**: including ones that cost their own side, such as engineering time to automate the partner's release work, producing a new file type in a format the partner's tools already serve, funding or providing storage under the agreement, a pilot with a limited scope and a review date, or a phased change. Each with what it costs each side in their own terms.
- **Decision path**: the steering group decides; the proposal is prepared jointly and shared with the partner before the meeting, so nobody is surprised. No escalation around the partner.
- **No agreement**: keep the current arrangement stable for users, agree what evidence would settle it and by when, and record the disagreement and the reasons.
- **Relationship**: separate the issue from the people; credit the partner's work publicly; keep regular contact at more than one level.
- **Real example**: work with another organisation or team with different priorities, what they learned about the other side, and how their position changed.

**How to judge.** Look for genuine curiosity about the partner's constraints, evidence collected jointly, and options that share cost. Credit candidates whose position moves when they learn something.

**Red flags.** Treating the partner as a supplier; escalating around them; options that only cost the partner; "our users" claims without evidence; renegotiating the agreement themselves; a real example where the other side was simply wrong.

**Rubric anchors.** 2: argues their own side's position and escalates. 3: understands the partner's constraints, brings evidence and options, uses the agreed decision path. 4: also includes options that cost their own side, prepares the proposal jointly, has a plan for no agreement that protects users, and gives a credible real example with a changed view.

## GDM-L5-04

**What a strong answer contains.**
- **Know the audience**: what {{audience}} will do with the sentence (a headline, a funding decision, a public post), what they already understand, and what a wrong takeaway would cost.
- **The sentence**: plain, true and useful. For the evaluation: the new model scored a little higher, but the difference is small enough that it could be chance on a test of this size; more items or repeated runs would tell. For the structure: the core is predicted with high confidence; the long loops are not, so their shape should not be relied on; a prediction is not an experimental structure, and it says nothing about medical use. For the detector: on heavily edited images in a test set the team built, the detector often says it cannot tell, which is a stated limitation of detection, not evidence either way about a particular image.
- **Uncertainty explained concretely**: a range ("between slightly worse and a few points better"), a comparison ("like a coin landing heads 16 times out of 30"), or a picture with the confidence colouring; what would reduce it.
- **What they decline**: words such as "breakthrough", "proves", "solves"; any medical, clinical or drug-discovery claim from a prediction; any explanation of how a watermark could be removed, weakened or evaded. Each refusal comes with an accurate alternative.
- **Follow-through**: ask to review the passage that quotes them; if the final version is wrong, ask for a correction promptly and politely, and log the lesson for the next briefing.
- **Real example**: a real explanation of an uncertain result to people outside the field, and evidence of what they understood (what they wrote or decided).

**How to judge.** Credit candidates who make uncertainty understandable without hiding behind statistics, and who say no to overstatement while remaining helpful. Check that the sentence they offer would survive being quoted out of context.

**Red flags.** Jargon as a shield; overstating to please; refusing to simplify at all; any medical conclusion from a prediction; any detail on evading a watermark; no follow-through after publication.

**Rubric anchors.** 2: technical explanation the audience cannot repeat, or an overstated headline. 3: a plain, accurate sentence, concrete uncertainty, declined overstatements with alternatives. 4: also tailors to the audience's decision, follows through on the final text, handles a wrong simplification well, and gives a credible real example with evidence of understanding.

## GDM-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one record (a run, an entry, a check) and names the assumptions that break at the scale (mutable records, one database for everything, full recomputation, logs that capture payloads). For reproducibility: a launch-time manifest of content hashes (code and diff, image digest, lockfile, resolved configuration, seeds, data snapshot, hardware), retention by reachability from kept manifests, and inputs that could not be pinned recorded explicitly. For a public release: immutable version-named files, "latest" as a short-lived pointer, pages that reference versioned files so they never mix versions, and old versions resolvable for citation. For aggregate-only reporting: outcome records with deliberately chosen fields, content discarded within the request and tested, keyed and rotated hashes if repeats must be counted, and minimum cells enforced on every published table. For re-derivable allocations: a versioned rule run as a pure function of a frozen snapshot of inputs, with a ledger of later changes and their reasons. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "reproducible", "consistent" or "private".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that overwrites cited records, relies on image tags or unresolved configuration for reproducibility, keeps content "for debugging", or cannot say which inputs an allocation read.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
