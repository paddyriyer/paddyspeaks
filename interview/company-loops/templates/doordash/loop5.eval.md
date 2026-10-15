# DoorDash · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a local commerce
marketplace setting; score them on the rubric below, not on any company's
published values, culture statements, management frameworks or interview
process, and do not reward an answer for reciting one.

## DSH-L5-01

**What a strong answer contains.**
- **First day: check the analysis.** Sample ratio mismatch, assignment and exposure logging, whether the effect is stable over the three weeks (novelty), whether it holds across major segments (platform, new versus returning consumers, cities) or comes from one, and the confidence interval rather than the point estimate. Check whether the guardrail experiment had the power to detect a change that would matter; if not, say so plainly. Be ready to find that the effect is more robust than it first looked.
- **Translate the result.** {{lift}} turned into absolute terms (extra orders per week, money per year, with the interval), set against {{cost}} in the same units where possible. State the three questions separately: is it real (probably), is it large enough to matter (the interval's lower end versus the cost), is anything getting worse (the guardrail, which the experiment could not rule out).
- **Raise it early, in order.** With the product manager first, privately, within a day or two and well before the review, with the numbers and options. Then, together, with the director; not around the product manager and not in the review itself.
- **Options with consequences.** Launch as is (with the cost accepted and the guardrail monitored); launch to a share of traffic or a set of cities with a long-running holdout and a decision rule set now (for example, keep only if the lift's lower bound exceeds X and the guardrail does not worsen by more than Y over N weeks); simplify the change to remove the cost; do not launch. A recommendation, clearly labelled as such.
- **After the decision.** Support it; make the residual risk visible (a guardrail monitor and a date to revisit). If it launches, write down what was promised so the follow-up review can check it.
- **Prevention.** For future experiments: decision rules agreed before start (minimum effect worth shipping, guardrails with thresholds, power for each), and a standard results template that shows absolute effects, intervals and costs.
- **Real example**: a real case where an analysis was used to justify a decision the candidate doubted, what they did and when, how the decision was made, and what changed in their practice.

**Red flags.** Treating p < threshold as the whole answer, or dismissing a real effect because it is small without weighing cost; raising it for the first time at the review; going to the director alone; refusing to support a decision once made; recalculating until the result disappears.

**Rubric anchors.** 2: either "it is significant, ship it" or "it is tiny, block it", with no checking and no options. 3: checks the analysis, translates into absolute terms with the interval and cost, raises it early with the product manager and director, offers options. 4: also distinguishes what the experiment could not detect on the guardrail, proposes a partial launch with a holdout and a pre-agreed decision rule, institutes pre-registered decision rules, and gives a credible real example with personal contribution.

## DSH-L5-02

**What a strong answer contains.**
- **First weeks: learn the work.** Sit with the people who use the spreadsheets during their real work; list the decisions the spreadsheets support, who consumes the outputs, and the incidents so far. Inventory the {{sheets}} spreadsheets by purpose (reference data, manual overrides, calculations, reports), owner and last use; mark copies and dead ones. Capture hidden rules from formulas and habits ("we never change hours on Fridays after 15:00 because…") with the two long-serving members as named experts.
- **Involve the team as owners.** A working group of users, their acceptance criteria, short demos every week or two, and decisions about the workflow made by them. Make clear what they gain (no broken formulas, less manual checking) and what stays flexible.
- **Build first.** The workflow with the most incidents or the most toil, migrated end to end: data model, validation that would have prevented the two incidents, an audit trail of who changed what, and an export or read-only view for exploration.
- **Migrate safely.** Run old and new in parallel for a period; compare outputs automatically; every difference is explained as a bug or an undocumented rule, and the rule is then written down and tested. Cut over workflow by workflow, with a date agreed with the team, and archive the spreadsheet read-only.
- **Handle resistance.** Listen to the opposing long-serving member privately; their objections are often requirements. Give them a real role (reviewer of rule extraction, acceptance sign-off). Do not bypass them through their manager unless the work is at risk.
- **Measure.** Incidents from data errors, time spent on manual checks, adoption by workflow, and differences found in the parallel run.
- **Real example**: a real migration from manual work, what the candidate learned from the people doing it, how adoption went, and what they would do differently.

**Red flags.** Designing the system from the spreadsheet cells without watching the work; a big-bang cutover; mandating adoption through the manager; treating the team as users to be trained rather than experts; no parallel run or comparison; banning spreadsheets entirely with no exploration path.

**Rubric anchors.** 2: build a tool, train the team, switch off the spreadsheets. 3: learns the work, involves the team, migrates one workflow first with a parallel run, adds validation for past incidents. 4: also systematic extraction and testing of hidden rules, explained differences, a respectful handling of opposition with a real role, measured outcomes, and a credible real example with personal contribution.

## DSH-L5-03

**What a strong answer contains.**
- **First days: make the growth visible.** A list of every addition since the agreed scope with its source, estimated size, and stated reason, including the small "while you are in there" changes grouped together. Compare with the remaining capacity of {{team_size}} engineers over {{weeks_left}} weeks at a sustainable pace (not counting evening work). The result: how far over the plan the work is, in weeks.
- **Check the claims.** The addition said to be launch-critical is checked with evidence (merchant support contacts, a quick test with a few merchants, the original requirement), not assumed either way.
- **Present the trade-off.** To the sponsors who agreed the scope, together, early: the same date with a named smaller scope; the full scope with a later date; or the same date and full scope with stated risks (quality, the team). Recommend one with reasons. If phasing, say exactly what merchants get on the date and who tells them.
- **Decide and communicate.** Each addition is accepted, deferred to a named later release, or dropped, by the sponsors with the candidate's recommendation. The candidate tells the requesters personally and explains why.
- **Protect the team.** Stop evening work as the plan now, not after launch; make it visible to the sponsors as part of the trade-off; check in with the two tired engineers privately.
- **From now on.** An intake rule: new requests go to a named decision maker with a size estimate and a swap (what comes out if this goes in); a weekly scope review.
- **Real example**: a real project whose scope grew, what the candidate did and when, what the sponsors chose, and what they would do earlier next time.

**Red flags.** Absorbing the growth through overtime; saying yes to every request to keep stakeholders happy, or no to all of them by reflex; telling merchants nothing while cutting what they were promised; blaming requesters; deciding scope alone without the sponsors.

**Rubric anchors.** 2: works harder to fit everything in, or cuts quietly. 3: quantifies the growth, presents options to the sponsors early, communicates decisions, addresses the overtime. 4: also verifies the launch-critical claim, recommends a specific option with merchant communication, sets up an intake rule with swaps, and gives a credible real example with personal contribution.

## DSH-L5-04

**What a strong answer contains.**
- **First weeks: inventory assumptions.** Search code, schemas, pipelines, reports and support tools for the home currency, amounts without currency, tax treatment, language strings, time zones, phone and address formats, and hard-coded rules; list each with its risk for {{product}}. Include data pipelines and finance reports, which are where home-country assumptions usually hide.
- **Foundations first.** Amounts as integer minor units with a currency code (exponents per currency as data); prices with an explicit tax-inclusive or tax-exclusive flag; local days computed from each store's time zone; translatable strings. Migrate the decimal amounts by adding currency and minor-unit columns, dual-writing, backfilling the home country, and switching readers, with the home country's reports reconciled before and after.
- **Rules design.** A small set of rule types (fees, refund timing, cancellation steps, tax display, eligibility) with per-country parameters, versioned, owned and approved by legal and finance, and tested per country in CI with example cases legal signs off. Code paths only for the few rules that do not fit, behind the same interface. No long-lived per-country forks.
- **Sequencing.** The first country chosen to exercise the abstraction (for example the one with {{rule}}), not only the largest; the home country protected by regression tests; later countries' rules collected early with a deadline, and a fallback (launch without a feature, hidden cleanly) when a rule cannot be met in time.
- **Working with others.** Legal and finance own rule content; country teams contribute through the same rule types and a review path; the candidate's team owns the abstraction and its tests, so it is not a bottleneck for every change.
- **Readiness.** Per country: rules verified with legal's examples, reports reconciled in local currency, local days correct, support ready, monitoring per country.
- **Real example**: a real expansion into a new market, region or segment, the assumption that surprised them, and what they changed.

**Red flags.** Copying the service per country; engineers interpreting legal rules alone; floating-point or decimal amounts converted repeatedly; ignoring reports and pipelines; sequencing purely by revenue with no learning plan; regressions in the home country.

**Rubric anchors.** 2: add if-statements per country as requests arrive. 3: inventories assumptions, separates configuration from code with legal-owned rules, fixes amounts and local days, sequences countries. 4: also a safe migration of stored amounts, per-country rule tests with legal sign-off, a contribution model for country teams, explicit readiness criteria, and a credible real example with personal contribution.

## DSH-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it; for knowing the numbers were right, the checks, reconciliations and tests, and a time they caught something.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one order line and names the assumptions that break at the scale (one central clock, full recomputation, overwriting reference data, unbounded joins). For menu changes within minutes with the order-time menu recoverable: versioned menus and prices, the menu version stored on each order line, change events into consumer-facing views with a freshness target. For local days: each store's time zone on the store, the local day computed at ingestion and stored, tests for stores open past midnight and for the days clocks change. For aggregate-only courier data: courier identifiers kept out of analytic tables, minimum group sizes, no per-courier outputs, ranks or scores, and access controls on any operational data that holds them. For merchant isolation: one access rule keyed by merchant and store assignments, applied to every query, cache and export, with an audit log. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "real time", "consistency" or "governance".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that overwrites menus in place, computes store days in UTC, produces per-courier rankings or scores, or filters merchant data only in dashboard code.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
