# Airbnb · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a two-sided stays
and experiences marketplace setting; score them on the rubric below, not on any
company's published values or interview process.

## ABB-L5-01

**What a strong answer contains.**
- **First hour**: confirm the break with numbers (forecast versus actuals for the last days, by market, against the stated error), then stop harm: move automated consumers such as {{consumer}} to a safe fallback (last good values, a manual override, or a conservative rule agreed with the owner) and tell each owner in writing what is broken, since when, how wrong, and what to use instead. Name one person to coordinate.
- **First day to first week**: build a small set of scenarios for {{horizon}} (for example a fast recovery, a slow one, a lasting shift), each with explicit assumptions (cancellation rate, booking pace by lead time, which markets recover first) and leading indicators that distinguish them early (searches with dates, short-lead booking pace, cancellation rates, external signals such as announced restrictions). Deliver {{deadline}} what can be defended: scenarios with triggers, not false precision.
- **Communicating uncertainty**: ranges with the decisions that hold across all scenarios, and the triggers that would change a decision ("if short-lead bookings in these markets recover above X by date Y, move to plan B"). Give finance a planning number if they need one, labelled as a chosen scenario, with the downside case and its trigger alongside.
- **Models and pipeline**: short horizons from current signals; features that react fast (searches, recent pace) rather than year-ago seasonality; the shock period flagged in training data (excluded, down-weighted or modelled explicitly); a weekly published error report per market.
- **Trusting models again**: stated criteria (error back within the old band for several consecutive weeks across most markets, calibration of intervals checked on recent data), with the decision and its evidence written down; consumers restored one at a time.
- **Priorities**: what the team stops (non-urgent model work, low-value reports) to make room, agreed with their manager.
- **Real example**: a model or metric that stopped describing reality, how the candidate noticed, what they did first, how they communicated, and what changed afterwards.

**Red flags.** Retraining immediately on two weeks of data and shipping a new number; one point forecast with no uncertainty; leaving automated consumers running on a broken forecast; hiding the error until the plan is ready; a real example with no measurable outcome.

**Rubric anchors.** 2: "retrain the model with new data" and present a number. 3: stops automated harm, tells owners, builds scenarios with assumptions, communicates ranges, sets a weekly error report. 4: also leading-indicator triggers tied to decisions, deliberate treatment of the shock period, explicit criteria for restoring trust in the models, priorities cut to make room, and a credible real example.

## ABB-L5-02

**What a strong answer contains.**
- **Validity first**: with guests randomised but sharing the same listings, treated guests can take bookings from control guests, inflating the measured guest gain; host earnings measured across hosts serving both groups dilute or distort the host effect. Three weeks cannot show supply effects (hosts changing settings, leaving, or new hosts not joining). Check who was affected (small hosts, particular markets) and whether the result is consistent across markets.
- **Framing**: one view with both sides' effects and agreed guardrails (for example total nights booked, host earnings by segment, cancellation rates, new listings), with thresholds agreed by both leads before anyone argues from the result. The long-run supply effect as a range of scenarios with stated assumptions, not a single estimate.
- **Alternatives**: a market-level (cluster) or switchback test to measure the marketplace effect properly; a targeted or phased launch; compensating changes for the most affected hosts; an iteration that reduces the host cost.
- **Fair process**: share the analysis with both leads before the meeting, let each correct facts, present both cases in their strongest form; decline private requests to slant the presentation, openly. Name the decider (the product leader) and the decision criteria.
- **After the decision**: if launched, monitoring of the host guardrails with a rollback condition, a market-level holdout to measure the real effect, and a date to revisit; if not, a plan for the better test.
- **Real example**: conflicting goals between two teams, what the candidate did to make the trade-off clear, how the decision was made, and the relationship afterwards.

**Red flags.** Accepting the test result at face value; picking a side and building the analysis to support it; "find a single north-star metric" without checking it hides group losses; presenting different versions to different leads; making the decision their own.

**Rubric anchors.** 2: reports the numbers and recommends a side. 3: questions the test's validity (interference, duration), presents both sides' effects with guardrails, proposes a better test or a phased launch, respects the decider. 4: also guardrails agreed before the result, segment-level host effects, long-run supply scenarios, transparent handling of pressure from both leads, monitoring and rollback after the decision, and a credible real example.

## ABB-L5-03

**What a strong answer contains.**
- **Evidence**: classify the last quarter's {{requests}}-a-month requests by question type, data used, requester and urgency; find the repeat questions and the places numbers disagreed. Interview a few heavy requesters about what they decide with the answers.
- **Build first**: a few certified datasets and metric definitions covering most repeat questions (for example bookings and nights by booking date and by stay date, occupancy with a stated denominator, cancellations by who cancelled), with owners, documentation and tests; then a simple access layer suited to the requesters' skills (a curated dashboard or explore view for most, SQL for the few). Personal data excluded or aggregated by design, with access controls.
- **Quality**: certified versus exploratory clearly marked; definitions changed only through the owner; spot checks of answers requesters produce early on.
- **Transition**: a published intake policy (what the team still does: new analyses, urgent executive questions through a fast lane; what moves to self-serve and from when), communicated with dates; office hours and examples rather than one training session.
- **Team**: new roles that keep the interesting work (owning definitions, harder analyses, teaching), so the change is not felt as loss.
- **Measures**: share of repeat questions answered without the team, consistency of numbers across teams, time to answer, team time freed for deeper work, requester satisfaction.
- **Real example**: a change in how a team worked with its stakeholders, what resisted it, what the candidate personally did, and the measured result.

**Red flags.** Building more dashboards first; announcing self-serve and refusing requests overnight; no definitions or ownership; ignoring personal data; measuring only ticket counts.

**Rubric anchors.** 2: "build dashboards and train people". 3: evidence from past requests, certified datasets and definitions with owners, a published intake policy with a fast lane, outcome measures. 4: also explicit booking-date versus stay-date definitions, privacy by design, the team's roles redesigned, a response to persistent "check my number" requests (certification, examples, embedded office hours), and a credible real example.

## ABB-L5-04

**What a strong answer contains.**
- **First two weeks**: blocking checks on outputs that would have caught the recent incident ("{{incident}}"): reconciliation of totals with source systems, row counts and uniqueness of keys, null and zero rates per column against history, value ranges; publication held when a check fails. A shadow run of every change on yesterday's production inputs, with an automated comparison of old and new outputs at key and aggregate level.
- **Characterisation tests**: real input samples (including the edge cases from past incidents) with today's outputs stored as expected results, so the current behaviour is pinned before anyone changes it; documented as "current behaviour", not "correct behaviour".
- **Reversibility**: versioned outputs (write a new version, switch a pointer), the ability to re-run a day, and a rollback in minutes, rehearsed.
- **Process**: every change declares its intended output differences; the comparison must show only those; ownership of each part assigned to a team; review rules that need someone who owns the affected part. Intended differences are approved explicitly and become the new baseline.
- **Persuading the director**: a side-by-side of a freeze plus rewrite (stalled teams, a big-bang cutover risk, the old code still running for two quarters) against safety nets (which past incidents each would have caught, how quickly they arrive, their cost); possibly accept a short, narrow freeze for the riskiest part while nets go in, with an end date.
- **Measures**: defects that reach consumers, time to detect, share of changes shadow-tested, rollback time, change lead time (to show teams are not slowed).
- **Real example**: a fragile system made safe to change, with what the candidate built or led, what it caught, and who objected.

**Red flags.** "Write unit tests for everything" for code nobody understands; a rewrite as the safety plan; checks that only alert after publication; imposing the process without the teams; no way to handle intended changes in the comparison.

**Rubric anchors.** 2: freeze or rewrite, or vague "add tests". 3: blocking output checks, shadow runs with output comparison, reversible releases, ownership, a reasoned case to the director. 4: also characterisation tests from production samples, a process for intended differences, a nuanced response to the director (narrow freeze with an end date), measures that show both safety and speed, and a credible real example.

## ABB-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain and how it handled change (schema evolution, late or corrected data); for correctness, the invariant at risk, how it was detected, the fix and the proof; for the decision they would change, the original reasoning, what they learned, and what they would choose now with evidence.
- **The two-sided question**: for metrics where a gain for one side can be a loss for the other, both sides' views of one event (a booking is a guest's purchase and a host's earning) and metrics reported for both, with segments; for experiments with shared supply, interference and how designs (market-level, switchback) or analysis handle it; for data both sides see, row-level access by side and party, and aggregates that cannot reveal the other side's details. Accept other sound answers that fit their system.
- **Late or changing facts**: event dates versus effective dates (booking date and stay date), append-only facts with corrections as new records, published reports kept as published with restatements recorded, and versioned outputs.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; treating a marketplace as one-sided; updating history in place without noticing the reporting consequences.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a credible account of how the two-sided setting changes their design. 4: also alternatives with evidence, a correct approach to late and changing facts, crisp separation of own and team contributions, and lessons that show changed practice.
