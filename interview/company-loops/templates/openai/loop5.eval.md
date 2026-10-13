# OpenAI · Loop 5 — evaluator notes (hidden from candidates)

## OAI-L5-01

**What a strong answer contains.**
- **First hour**: declare an incident with roles; tell finance and the owner of the affected audience that the number is under review, before anyone acts on it again; freeze further publication; open one shared document of facts.
- **First day**: reconcile the three systems at the shared grain (request_id, or project × hour). Classify every difference as missing, duplicated, late or attributed to a different day. Establish whether customer invoices are affected. That is the question that decides urgency.
- **Two weeks**: fix the root cause or causes; backfill and restate with a correction note; add a reconciliation check (for example, daily totals within 0.1% at project level, run before publication, blocking on failure, paging the pipeline owner); write a data contract for the hand-offs; hold a blameless review.
- **Leadership**: three owners agree on one method of comparison before arguing about conclusions; disagreements escalate with a named decider; external communication goes through finance.
- **Real example**: a STAR answer with a measurable outcome, the candidate's own actions separated from the team's, what failed and what they would change. Or an honest "I have not faced this" followed by sound reasoning. That scores better than a story that falls apart under probing.

**Red flags.** Diagnosing for days while the number keeps circulating; asserting billing is right without checking; naming individuals; prevention that is "be more careful".

**Rubric anchors.** 2: technical fix only, no containment or communication. 3: containment, reconciliation at a shared grain, prevention with an owner. 4: also handles the cross-team dynamics explicitly, decision rights, and gives a credible, evidence-backed real example.

## OAI-L5-02

**What a strong answer contains.**
- **First days**: write down the launch's non-negotiable evaluation requirements (reproducible, comparable results on the gating suites, by a date) separately from the platform's long-term wishes. Start the vendor security review on day one because it is on the critical path. Run a short proof of concept against the hardest requirement, including the stated gap, rather than a demo. Ask the team for an in-house estimate with ranges and the assumptions behind them.
- **Decision**: compare options on the agreed criteria: risk to the launch date, cost (vendor fee against engineer-weeks, plus the roadmap work that does not happen and year-two maintenance and on-call), fit with the gap, lock-in, and data handling. A hybrid is often right: buy the orchestration and dashboards, own the run manifests, suite definitions and result data in open formats so switching is cheap. Name the decider (the director), give a recommendation and write a decision record with the evidence and what would make it wrong.
- **Protecting the launch**: whichever option is chosen, keep the existing scripts runnable for the gating suites as a fallback, with their results cross-checked against the new path on one candidate before relying on it.
- **Stakeholders**: hears research's "core competency" argument and tests it: which part is differentiating (suites, graders, statistics) versus commodity (scheduling, storage, dashboards)?
- **Real example**: a STAR answer with the options considered, the evidence, the cost, the outcome a year later and what the candidate personally drove; or an honest "I have not faced this" with sound reasoning, which scores better than an unconvincing story.

**How to judge the real example.** Look for numbers (cost, weeks, adoption), a decision the candidate personally recommended, and a candid account of what turned out wrong. Probe for whether alternatives were genuinely evaluated.

**Red flags.** Deciding on preference ("we always build" or "never build"); ignoring the security review's lead time; no fallback for the launch; treating the decision as irreversible without trying to make it reversible.

**Rubric anchors.** 2: picks an option on instinct, no evidence or fallback. 3: separates launch needs from platform needs, gathers evidence, prices both options including opportunity cost, names the decider, keeps a fallback. 4: also designs for reversibility, handles the research lead's objection with evidence, writes a durable decision record, and gives a credible, evidence-backed real example.

## OAI-L5-03

**What a strong answer contains.**
- **First week**: attribute the bill: break it down by storage versus compute, by dataset and by query source; give shared service accounts per-dashboard or per-team identities (query tags) so compute can be attributed. Compute unit costs (per million events stored, per TB scanned, per dashboard refresh) and compare with a quarter ago to separate volume growth from inefficiency. Confirm the suspected driver with data rather than acting on the first look.
- **Ranking cuts**: list candidate savings with an estimate, effort, risk and owner. Typical engineering savings: retention per dataset with no owner, columnar formats and compression, partitioning and clustering so queries prune, compaction of small files, materialising the aggregates dashboards rescan, caching and refresh intervals, tiered storage for old data. Behaviour changes (a team's ad-hoc workload, a dashboard's refresh cadence) are negotiated with the team that owns them, with data.
- **Protecting what matters**: billing-grade data is excluded from sampling and retention cuts; each change has a check that no consumer broke (query failure rates, dashboard freshness, reconciliation still passing).
- **Making it last**: showback per team, then budgets with alerts; a default retention for every new dataset; review of top cost drivers monthly with a named owner.
- **On the research team**: show their share and unit cost, offer cheaper ways to do the same work (sampled or pre-aggregated tables, a sandbox with a budget), and escalate only with data and an option, not a demand.
- **Real example**: a STAR answer with before and after numbers, what the candidate personally did, a saving that did not materialise and why. Or an honest "I have not faced this".

**How to judge the real example.** Look for a measured baseline and a measured result, the candidate's own analysis or decision, and evidence that savings held over time.

**Red flags.** Cutting retention first without asking who uses the old data; across-the-board query limits that break critical work; savings claimed but never measured; treating cost as purely a platform problem with no team ownership.

**Rubric anchors.** 2: one big cut (retention or quotas) without attribution. 3: attribution, unit costs, ranked savings with estimates, protects billing data, verifies no harm. 4: also durable ownership (showback or budgets, default retention), handles the reluctant team with data and options, and gives a credible real example with numbers.

## OAI-L5-04

**What a strong answer contains.**
- **This week**: treat the departure as an incident with a deadline. Record walkthroughs of the job, its inputs, outputs, schedule and every manual step. Have a second engineer run the job end to end from the runbook while the owner watches. Transfer credentials, cron or scheduler ownership, alerts and access. Find out why the two customers' totals are adjusted by hand and write it down. Snapshot the current inputs and outputs for several months as test fixtures.
- **Make the risk visible**: tell your manager and finance what the risk is, what you will drop from the roadmap to address it, and get that trade approved explicitly.
- **Next two quarters**: characterisation tests that pin today's behaviour (golden outputs from historical months); move the job into supported tooling with version control, tests and monitoring; build the replacement in parallel and run both for at least two invoice cycles, comparing at customer and line grain with automated diffs; classify every difference as a bug in the new job, an intentional fix of an old bug, or a known adjustment; agree with finance how intentional changes are introduced (with notice, effective date and, where needed, customer communication); cut over with a rollback path.
- **Ownership**: at least two people own the new job, with a runbook, on-call rotation and a design note; the hand adjustments become explicit, reviewed rules.
- **On the 0.3% difference**: the old behaviour stays on invoices until finance agrees the change and its communication; correctness changes are deliberate, not side effects of a migration.
- **Real example**: STAR with measurable outcomes (incidents avoided, cycles run in parallel, time to cut over) and the candidate's own actions, plus what they discovered only after the owner left. Or an honest "I have not faced this".

**How to judge the real example.** Look for concrete knowledge-capture steps, a verification method (parallel run, golden tests), and honest discoveries after the fact.

**Red flags.** Starting a rewrite before capturing behaviour; letting the new job's differences reach invoices unreviewed; relying on a single successor; "we will document it" with no test of the documentation.

**Rubric anchors.** 2: plans a rewrite, little urgency about the departure. 3: acts this week on knowledge transfer, characterisation tests and a parallel run, finance agrees on differences. 4: also trades roadmap explicitly with the manager, spreads ownership, handles the bug-compatibility question crisply, and gives a credible real example.

## OAI-L5-05

**What a strong answer contains.**
- **Framing**: one shared document stating each team's need rather than its position: research needs to diagnose a quality regression within, say, a day; privacy needs every customer agreement honoured and data minimised; infrastructure needs predictable cost and operational load. Agree decision criteria and the decider (the executive, with privacy's veto on agreements) before debating options.
- **Evidence**: the debugging cases that took too long and what data would have resolved them; which customer agreements and opt-outs apply; the cost estimate checked with infrastructure; whether metadata, aggregates or synthetic reproductions would have been enough for past cases.
- **Options**: present three or four concrete options, for example (a) metadata and aggregate signals only, with a faster access path to existing data; (b) a small, short-retention sample of bodies from traffic whose terms allow it, excluding opted-out customers, with automated redaction, restricted access and audit; (c) on-demand capture switched on for a defined incident and scope, with approval and an expiry; (d) the full request as asked. For each: what research can do, privacy risk, cost and operational load. Make a recommendation.
- **Decision and follow-through**: write it down with success metrics (time to diagnose the next regression, privacy incidents, monthly cost) and a review date, so it can be revisited without a new escalation.
- **Relationships**: acknowledge each team's legitimate concern; avoid framing privacy as a blocker or research as careless; if the decision goes against your recommendation, commit to it and measure it.
- **Real example**: STAR with competing goals, the candidate's own role in reaching the decision, the outcome, and what they conceded. Or an honest "I have not faced this".

**How to judge the real example.** Look for a decision the candidate drove (not just observed), evidence used to move people, and a measurable outcome; probe for how the losing side was treated afterwards.

**Red flags.** Siding with one team from the start; a "compromise" nobody checked against research's actual need; ignoring customer agreements or opt-outs; no decider, no review date; escalating without options.

**Rubric anchors.** 2: picks a side, or splits the difference without evidence. 3: needs and criteria agreed, evidence gathered, several options with trade-offs, privacy's constraints respected, decider named. 4: also defines success metrics and a review date, keeps all three teams engaged, handles being overruled well, and gives a credible, evidence-backed real example.
