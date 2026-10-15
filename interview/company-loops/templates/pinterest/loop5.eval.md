# Pinterest · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a visual discovery
setting; score them on the rubric below, never on any company's published values,
culture or interview process.

## PIN-L5-01

**What a strong answer contains.**
- **First hours: try to break the result.** Check holdout integrity (assignment still random, sizes as expected, no leakage of the feature into the holdout, no change in who is logged), instrumentation (did the feature change what is logged, so the metric moves for a measurement reason?), duration (is the gap stable or still moving, novelty or learning effects), guardrails and related metrics (do saves, closeups and returning pinners tell a consistent story with {{metric}}?), and segments, without fishing for a segment that saves the feature. Ask a peer to review the analysis.
- **First day: tell the right people first.** The product lead (the decision owner) and the feature's design and engineering leads, privately, before any wider forum, with the evidence, the uncertainty, and options: roll back, roll back part, change and re-test, or keep with an explicit cost. Never surprise the builders in a public meeting.
- **The decision**: framed as the cost of keeping {{feature}} (the size of {{metric}} over a year, in terms the product lead values) against the cost of rolling back (work lost, public message, any pinners who prefer it). Respect that the product lead decides; give a clear recommendation and say what would change it.
- **Partial keep**: if one part stays, test that part alone against the holdout (or re-run an experiment) instead of assuming it is the harmless part.
- **The team**: separate the craft from the bet; credit what was built well and what was learned; make it safe to be wrong, because a team punished for negative results stops reporting them. Handle pushback on the data by inviting the sceptics into the analysis.
- **Next time**: pre-registered primary and guardrail metrics, experiments long enough for novelty to fade, long-running holdouts for major launches, and a launch review that looks at guardrails.
- **Real example**: a real time they brought unwelcome results about their own team's work, with what they checked, whom they told and how, what was decided, and what changed afterwards.

**Red flags.** Announcing the result broadly before checking it or before telling the builders; burying it because the team is proud; hunting for a segment that makes the feature look good; treating the rollback as their decision; blaming the designers.

**Rubric anchors.** 2: reports the number in a team meeting, or sits on it. 3: verifies the result, tells the decision owner and builders privately with options, respects decision rights, supports the team. 4: also rigorous checks (integrity, instrumentation, novelty, guardrails) without fishing, a quantified cost framing, a tested partial keep, concrete changes to launch practice, and a credible real example.

## PIN-L5-02

**What a strong answer contains.**
- **First weeks: listen and re-examine.** Talk to designers one to one about what broke their trust; re-open the experiment that killed the earlier design, in the open, and say plainly if it was underpowered, stopped early or measured the wrong thing. Ask what the designers would accept as evidence of a good outcome.
- **Change your own side where justified.** Retire misleading metrics; add measures closer to what designers care about (for example saves that are revisited later, board organisation after saving, return visits, outbound clicks that are not immediately bounced back), with their limits stated; add guardrails; pre-register experiments with designers, agreeing in advance what result would change whose mind.
- **Combine the evidence.** Research explains why and generates hypotheses; experiments measure how much at scale. Around {{decision}}, lay out what each source says, where they agree, and what would resolve a disagreement (a targeted experiment, a follow-up research round on the specific behaviour). Keep research participants' sessions separate from usage data, as the constraints require.
- **Presenting contradicting evidence**: to the designers first, with uncertainty, as a question about what explains the difference, not as proof they were wrong. The product lead decides with both cases presented fairly.
- **Signs trust is returning**: designers bring questions to the data team early; they co-design experiments; they cite a metric in their own reviews.
- **Real example**: a real team that distrusted their data, what they changed in their own methods, and how the relationship changed.

**Red flags.** "Data beats opinions"; treating designers as obstacles; refusing to re-examine the old experiment; joining research participants to their usage data; going to the product lead to win before working with the designers.

**Rubric anchors.** 2: tries to win the argument with more dashboards. 3: listens, re-examines the old case honestly, adjusts metrics, combines research and data around the decision. 4: also co-designed, pre-registered experiments, measures with stated limits for what designers value, careful handling of privacy limits, clear signs of rebuilt trust, and a credible real example.

## PIN-L5-03

**What a strong answer contains.**
- **First conversation**: private, in their working hours, framed as "how is onboarding going, and what would have helped?" rather than as a concern. Ask about blockers (access, local setup, unclear ownership in {{area}}, conflicting review comments, who to ask), not about personal circumstances; listen more than talk.
- **Look for system causes**: a team that started in an office shares context by overhearing; asynchronous reviews that arrive overnight across {{gap_hours}} hours and contradict each other multiply round trips; onboarding documents are stale; meetings are scheduled at the edge of their day. Treat these as the team's problems to fix.
- **Concrete help**: a named onboarding buddy; pairing in the overlapping hours (rotating who shifts their day); a sequence of small, well-scoped changes with a single primary reviewer and agreed review turnaround; written context for {{area}} (architecture, data flows, owners, common failure modes, how to test); an early, shadowed on-call shift.
- **Feedback**: specific, about the work, with examples and a clear next step ("this change mixed a refactor with a fix; splitting them would have halved the review"), and also about what is going well.
- **The manager**: share observations and the changes made, agree who does what; performance concerns are the manager's to raise. Keep anything personal the engineer shares out of the conversation unless they choose to share it.
- **A month later**: judged by concrete signals (time from first commit to merged change, review rounds per change, questions asked in channels, a first on-call shift completed) and by asking the engineer.
- **Team change**: updated onboarding for remote hires, review norms, meeting times that respect the overlap, written decisions.
- **Real example**: a real person they helped ramp up, what they did personally, what changed in the team, and the outcome.

**Red flags.** Diagnosing the person before asking; asking about personal life; treating it as a performance problem to escalate; taking over the manager's role; help that consists of "they can always ask me".

**Rubric anchors.** 2: tells them to speak up more, or reports to the manager. 3: asks first, finds concrete blockers, sets up a buddy, pairing and scoped work, gives specific feedback, coordinates with the manager. 4: also fixes the team's remote practices (reviews, documentation, meetings), measures progress with concrete signals, respects privacy and role boundaries, and a credible real example.

## PIN-L5-04

**What a strong answer contains.**
- **Measure the cost in four weeks.** Incidents and metric corrections traced to {{debt}} from incident records (with root causes, not just triggers); time lost estimated by a light, short time study (engineers log a week of interruptions) cross-checked against ticket data, not only by survey; lead time for changes that touch the debt versus comparable changes elsewhere; on-call pages caused by it; concentration of knowledge as a risk (what happens if one of the people who understand it leaves); the delay it adds to one item in {{roadmap}}, estimated with the engineers who will build it.
- **Translate**: present cost in the product side's units: weeks added to roadmap items, creator- or merchant-facing incidents, engineers' time as a share of capacity, and the risk with a rough likelihood and impact. Be conservative and show the method, so the numbers survive questioning.
- **Options**: (a) the full {{ask}}, (b) an incremental path that pays down the debt where roadmap work touches it (strangler pattern, one consumer or a group of jobs at a time), (c) a minimum that removes the biggest risk first. Each with cost, payoff and what it delays.
- **Payoff measures defined in advance**: lead time for changes in the area, incidents and corrections, on-call load, number of job variants or format versions remaining.
- **If no or half**: pick the highest-value slice, tie it to the roadmap item, keep measuring, and come back with results; never quietly slow the roadmap to force the issue.
- **Real example**: a real case with the evidence they gathered, which number moved the decision, and what happened afterwards.

**Red flags.** "It's obviously bad"; numbers that cannot be defended; insisting on a rewrite; holding the roadmap hostage; not measuring the payoff afterwards.

**Rubric anchors.** 2: appeals to engineering quality, no numbers. 3: measures incidents, time and lead time defensibly, presents options in product terms, defines payoff. 4: also connects cost to a specific roadmap item, quantifies risk honestly, offers an incremental path, handles a partial yes well, and a credible real example with the decisive number.

## PIN-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **In the visual discovery setting with {{pinners}} of pinners and {{requirement}}**: for catalogue changes within an hour, catalogue uploads as validated diffs with quarantine for suspicious changes and prices and stock resolved at serving time from a current offers store. For creator analytics agreeing with billing, one deduplicated event pipeline and one metric definition feeding both, with daily reconciliation and recorded adjustments. For secret boards, visibility carried as data in the change stream to every public surface, cache invalidation by key, and acknowledgement tracking against the deadline. For visual search logs without the photo, logging detected categories, crop coordinates on public pins, result ids and what the pinner did next, never the image or anything that could reconstruct it, with debugging done by replaying results rather than images. Ranking stays a given scoring function. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; claims about how a real visual discovery company's ranking, storage or catalogue systems work; designs that infer sensitive attributes about pinners.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a sensible approach to the requirement. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs stated, crisp separation of own and team contributions, and lessons that show changed practice.
