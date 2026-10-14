# Hugging Face · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in the setting of an
open hub of user-published models, datasets and apps; score them on the
candidate's reasoning and evidence, never against any company's published
values, culture statements or hiring process.

## HGF-L5-01

**What a strong answer contains.**
- **First hour**: thank and acknowledge the reporter; if the report is a public comment that quotes personal data, hide or edit that comment (the report itself is spreading the data). Verify the reported rows. Take a containment decision quickly and say its cost: gating or making the repository private stops new downloads of every revision, and breaks pipelines; most strong answers contain first and explain, because the harm to the people in the data cannot be undone and the pipeline cost can. Open an incident with a named owner and tell privacy and legal advisers the facts known so far.
- **First day**: scan the whole dataset (not only the reported rows) with several detectors and a labelled sample to estimate how many rows and which categories are affected, with an honest error range. Prepare a clean revision. Plan for history: earlier revisions still contain the rows, as may converted copies (for example a dataset viewer's columnar files) and caches; ask the hub to remove the old revisions from history if that is supported, and document what cannot be removed (copies already downloaded). Advisers decide on obligations to the people in the data and any regulators; the candidate supplies facts and does not draw legal conclusions.
- **Following weeks**: publish the clean revision; update the dataset card with a dated changelog that says what was removed and why, without repeating the data; post in the repository's discussions; contact the authors of derived models (their cards declare the dataset) with what changed and a suggestion to retrain or review, without dictating; restore access. Root cause: measure the original filter's recall on a labelled sample, fix it, add a pre-publication review step (sampled human review plus automated detection) for every dataset, and re-scan the team's other published datasets.
- **Real example**: an incident involving personal data with what the candidate did in the first hours, the numbers (rows affected, time to containment), the communication, and the lasting change.

**Red flags.** Waiting for legal advice before any containment; deleting the repository and with it the record of what was published; pushing a clean revision and calling it fixed while history still holds the rows; announcing the problem in a way that repeats or locates the data; drawing legal conclusions themselves; blaming the reporter or the people who scraped the web pages.

**Rubric anchors.** 2: deletes or ignores; no sizing; no thought for history or downstream users. 3: fast containment with its cost stated, whole-dataset scan, clean revision plus history plan, notification of users and derived-model authors, filter fix. 4: also handles the public report itself, measured filter recall and a pre-publication review, re-scan of other datasets, clear separation of facts given to advisers from legal decisions, and a credible real example.

## HGF-L5-02

**What a strong answer contains.**
- **The obligation**: name whose interest is at stake (gated-repository authors who set access conditions; organisations and people whose download behaviour would be shown; users who rely on scan warnings) and who decides it (policy and legal advisers, product leadership). Bring them facts: what the feature does, examples, the size of the affected group. No legal conclusions of the candidate's own.
- **The need**: analyse the forum thread (cluster the reasons), talk to a handful of voters, look at usage data (for example how often people copy repositories today and why). Common findings: voters want speed (one click instead of many), credibility signals for their model, or less noise from warnings they believe are wrong.
- **Variants that keep the obligation**: copying that carries gating conditions with it (the copy is gated with the same conditions and the author is told); aggregated download breakdowns (by sector or region with minimum thresholds) instead of named organisations, or named organisations only when they opt in; a faster dispute process and owner annotations on warnings instead of hiding them. Accept other variants that serve the need without moving the cost to a party who was not asked.
- **Decision and communication**: a named decision owner and date; a public reply in the thread that states what will be built, what will not and why, and when; patience with a hostile thread (no deleting criticism; moderate only abuse).
- **Measure**: the underlying need (time to start using a model, author satisfaction, dispute resolution time), not votes.
- **Real example**: a popular request the candidate argued against or reshaped, with the evidence, what it cost (time, goodwill) and what happened.

**Red flags.** Building it because votes decide; refusing without exploring the need; deciding the legal question themselves; treating the competitor's choice as permission; a private decision with no public explanation; an opt-out for the protected party rather than an opt-in.

**Rubric anchors.** 2: builds it or refuses it on instinct. 3: separates need from request, names the affected party and decision owner, proposes a variant, explains publicly. 4: also evidence from the thread and usage, the affected party brought in, a success measure for the need, graceful handling of public disagreement, and a credible real example.

## HGF-L5-03

**What a strong answer contains.**
- **Measure the queue**: open pull requests by age, arrival rate per week, median time to first response and to merge, CI duration and flake rate. Triage the backlog in a time-boxed sweep: label, close the stale or superseded ones with thanks and a reason (and an invitation to reopen), and pick a short list to finish.
- **Capacity multipliers**: fix CI (cut the 50 minutes by splitting slow tests, caching, running heavy tests nightly; quarantine flaky tests with owners); a rotating triage duty inside the team; area owners; templates and a contributing guide that says what will and will not be accepted.
- **Saying no**: a written scope for the library; early, kind closes; design discussions in issues before large pull requests.
- **Releases and stability**: a regular release cadence, semantic versioning, a deprecation policy (warnings for at least one minor release or a fixed period before removal), and migration notes.
- **Growing contributors**: a ladder of responsibility (triage rights → review rights → ownership of an area → merge rights) with written criteria, and a way to step back.
- **This week's pressure**: a breaking change goes through the same design review and deprecation path whoever offers the engineers, and the offer is welcome as capacity if it includes maintenance; a security report is handled privately (a private advisory, fix developed out of public view, coordinated disclosure with a release), and the freeze yields to it; commit rights for the contributor follow the ladder's criteria, perhaps starting with review rights in their area.
- **Team health**: rotations, protected focus time, and explicitly dropping work.
- **Measures a year later**: time to first response, pull request age, release regularity, CI time and flake rate, returning contributors, and the number of outside maintainers.
- **Real example**: a project with outside contributors, with what the candidate changed and the numbers before and after, or an honest hypothetical.

**Red flags.** A stale bot as the whole strategy; accepting a breaking change because a large company asked; discussing a vulnerability in a public issue; merge rights given on enthusiasm alone, or never given; heroics instead of process; no measures.

**Rubric anchors.** 2: works harder on the backlog; no policy. 3: measured triage, CI fixes, contribution and release policies, sound handling of the pressure. 4: also a responsibility ladder with criteria, deprecation policy with windows, team sustainability, measures of health, and a credible real example.

## HGF-L5-04

**What a strong answer contains.**
- **Framing**: this is the candidate's own team's interview process. Do not accept answers that describe or copy any real company's hiring process as the solution; judge the reasoning.
- **Diagnosis with evidence**: a funnel from application to offer acceptance by round and by interviewer over the 18 months; score and vote distributions per interviewer (one interviewer with a far lower pass rate is a calibration problem, not proof of a high bar); time to decision; offer acceptance and decline reasons. The scenario's signal (strong people turned down, a 3% take-home pass rate, one round failing everyone) is a sample, not proof; look for others like it.
- **Redesign**: write down what the job needs (for example debugging a data pipeline, designing a schema, reviewing code, explaining a trade-off) and map each round to one or two of those; replace puzzle-style or untested rounds with work samples close to the job; written rubrics with anchored levels; a time-boxed take-home (or a choice between a take-home and a live session) tried by current team members first.
- **Interviewers**: training, shadowing and reverse-shadowing, calibration sessions where several interviewers score the same recorded or written answer, and periodic review of each interviewer's scores.
- **Decisions**: independent written scores before the debrief; a decision rule that weighs evidence across rounds rather than one veto, with a strong no requiring specific evidence.
- **Not lowering the bar**: the bar is defined by the rubric against the job, applied consistently; the goal is fewer false negatives and better signal, not more hires.
- **Measure**: inter-interviewer agreement, pass rate per round, candidate time spent, offer acceptance, and the performance of people hired after six to twelve months, with the caveat that rejected candidates' performance is mostly unobserved.
- **Bringing the team**: involve the team in writing the rubric, pilot changes on a few loops, review data together; handle a teammate whose round rejects most candidates by looking at the data with them and calibrating, not by overruling.
- **Privacy**: analysis on outcomes and scores without names; candidates' information stays in the hiring system.
- **Real example**: a change the candidate made to how a team assessed candidates or other people's work, with measures before and after.

**Red flags.** "Just lower the bar" or "make it easier"; "culture fit" or gut feel as a criterion; blaming candidates or recruiters without data; overruling a teammate publicly; analysis that exposes candidates' personal information; presenting a real company's hiring process or published values as the rubric.

**Rubric anchors.** 2: changes questions on instinct, or blames the pipeline. 3: funnel and per-interviewer data, rounds tied to the job, rubrics and calibration, a better debrief rule. 4: also measures of agreement and outcome with honest limits, team buy-in with a pilot, respectful handling of the outlier round, privacy, and a credible real example.

## HGF-L5-05

**What a strong answer contains.**
- **Overview**: problem, users, real numbers (volume, peak and average, data size, latency or throughput targets, monthly cost), architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the bottleneck, how it showed up, how it was measured and proved (a profile, a controlled experiment), what changed and the measured result; for the cost decision, the baseline, the analysis, the change and the trade-off accepted; for the failure, detection, diagnosis, recovery and the lasting change.
- **Scaling to {{scale}}**: the first bottleneck named with a reason from their own numbers (a single database, a coordinator, storage throughput, network egress), and the signal that would show it early.
- **The hub feature**: for untrusted input, limits on size and rate at the edge, schema and format validation before expensive work, isolation of processing, and per-publisher fairness; for history that is always kept, storage growth and deletion that must work through references and grace periods, and requests to remove published data that need history rewrites; for uneven popularity, hot-key handling, caches and content delivery that warm before a release or tolerate a cold start, request coalescing, and per-item partition salting. Accept other sound reasoning that fits their system.
- **Honesty**: what failed, what they would change, what was the team's and what was theirs; a candidate without public-platform experience says so and reasons well.

**How to judge.** Probe numbers (per day or total? what peak?), the alternatives they considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims all of it but cannot explain its data paths, bottlenecks or costs does not.

**Red flags.** Buzzwords without numbers; "add more servers" as the scaling answer; no failures; numbers that change under questioning; cannot separate own work from the team's; treats user-published input as trusted.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the angle, honest failure, a named first bottleneck, workable reasoning about the hub feature. 4: also alternatives with evidence, quantitative reasoning at {{scale}}, new failure modes of the hub feature anticipated, crisp separation of own and team contributions, and lessons that changed practice.
