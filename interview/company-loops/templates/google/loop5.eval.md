# Google · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.

## GOO-L5-01

**What a strong answer contains.**
- **First hour**: confirm the signal quickly (conversions per click by advertiser and conversion type against a baseline; duplicate rate on order ids where they exist). Declare an incident with an incident lead, a communications lead and a scribe. Stop new inflation with the fastest safe lever: disable the faulty path ({{cause}}), restore the deduplication step, or pause the backfill. Bring in the bidding team at once, because the harm continues through bids even after the pipeline is fixed: agree whether to exclude the affected window from learning for affected advertisers. Tell account and support teams what is known, what is not, and when the next update is.
- **First day**: define a duplicate precisely per conversion type (same order id; for types without one, same click, conversion action, value and timestamp within a short window) and measure precision on a hand-checked sample. Produce the affected list with confidence levels and the size of the inflation per advertiser. Plan the restatement as a new data version, with an API signal (a "last modified" or restatement marker per day) so advertisers' systems re-pull. Coordinate the order of operations with bidding: exclusion of the window first, then restatement, so models do not swing twice.
- **Following weeks**: produce a spend-impact estimate per advertiser with a stated method (for example comparing bids and spend against a counterfactual from similar unaffected advertisers, or replaying bidding without the inflated conversions) and its uncertainty, for the account, finance and policy teams who decide remediation. Blameless review: why the deduplication could be skipped silently, why detection took {{days}} days, why the first detector was a customer. Prevention: deduplication enforced as an invariant (a test that fails the migration or backfill if duplicate-key rates rise), monitors on conversions per click and duplicate-key rate that page a named owner, and backfills that are idempotent by design.
- **Judgement**: recognises that the pipeline fix does not undo the automated decisions; does not restate blindly; does not promise refunds that are not engineering's to promise, but makes the decision easy for those who own it.
- **Real example**: an incident where wrong data drove automated or customer decisions, with the candidate's own decisions, measured impact, recovery time and a change they drove.

**Red flags.** Fixing the pipeline and declaring victory while bidding keeps acting on the bad window; deleting rows without measuring precision; promising compensation unilaterally; ignoring API consumers; prevention that is "be more careful with migrations"; blaming the engineer who ran the backfill.

**Rubric anchors.** 2: technical fix only, no thought for bidding or advertisers. 3: contains both the pipeline and the decision effect, measured duplicate definition, versioned restatement, coordination with decision owners, invariant monitors with an owner. 4: also the order of operations with bidding, a defensible spend estimate with uncertainty, API consumers handled, and a credible, evidence-backed real example.

## GOO-L5-02

**What a strong answer contains.**
- **Evidence first (days, not weeks)**: per-job cost and runtime on both systems; why the {{missed}} late jobs are late; whether the extra cost ({{cost_ratio}}) is spread evenly or dominated by a few jobs; and how much of it is inherent to the engine versus how the jobs were ported (line-by-line ports that shuffle much more data, missing partition pruning, default resource settings). Check whether creator-facing outputs are at risk now.
- **Decide from today, not from the sunk cost**: lay out options with costs and risks — continue as is; fix the dominant jobs before moving more; move the remaining jobs only when they meet entry criteria; roll the worst jobs back temporarily and use the one lease extension deliberately; change the target design for some jobs. A mixed plan is usually right.
- **Own it and communicate early**: tell the director (who approved the plan on the candidate's estimates) what the original estimate got wrong, what is now known, the revised plan with dates and costs, and what decision is needed. Do not wait until the savings appear or the lease forces the issue.
- **Protect creators**: correctness and timeliness for payment inputs come first; late analytics are acknowledged and given a date.
- **The team**: explain the change of plan honestly, make room for the profiling work by stopping something else, and recognise the work already done.
- **Prevention**: pilot the hardest and most expensive jobs first in future migrations, define exit criteria and checkpoints up front, and track cost per job from the first week.
- **Real example**: a decision the candidate argued for and later changed, with what evidence changed their mind, how they told people, and the measured result.

**Red flags.** Defending the original plan because it was theirs; pushing through to "finish" while deadlines slip; rolling everything back without data; hiding the cost overrun until it is discovered; blaming the engine or the team.

**Rubric anchors.** 2: "keep going, it will get better" or "roll it all back". 3: evidence-based diagnosis, options from today, a revised plan taken to the decision owner with honesty about the estimate, creators protected. 4: also a mixed plan using the lease extension deliberately, care for the team's capacity, concrete prevention for future estimates, and a credible, evidence-backed real example of changing course.

## GOO-L5-03

**What a strong answer contains.**
- **Verify first**: confirm the backtest is fair (estimates made only with data available before each campaign; measured reach computed the way the product will measure it) and break the error down by audience size, format and campaign length. Identify where the {{promised}} bar is met (often large audiences on established formats) and where the {{measured}} median error comes from.
- **Raise it quickly and in the right order**: share the analysis with the product owner and then with the sales vice-president who made the promise, privately, in writing, before anyone else hears it in a meeting. Lead with the evidence and a proposal, not with blame for the promise.
- **Propose an alternative**: launch for the segments that meet the bar; show ranges or confidence levels where they do not, or withhold estimates where error is too large to be useful; describe what the tool is for (planning, not a guarantee); a plan and timeline to improve accuracy for the long tail. Help sales draft how the change is explained to the {{pilots}} pilot advertisers.
- **Advertisers who acted already**: work with sales and product on contacting them, explaining the uncertainty in their estimate, and what support is offered; this is a business decision, informed by the data team.
- **Prevention**: a rule that accuracy claims for a data product come from a published backtest with an owner, and a review step before sales materials quote a number.
- **Real example**: a commitment made by someone else that the candidate's work could not meet, how they reset it, and what happened to the commitment and the relationship.

**Red flags.** Staying quiet and hoping accuracy improves; quietly shipping and letting advertisers find out; going over the sales vice-president's head first; blaming sales in public; promising accuracy improvements on the same unrealistic timeline.

**Rubric anchors.** 2: complains about the promise or accepts it silently. 3: verifies by segment, raises it early and in writing with the right people, proposes a scoped launch with honest uncertainty. 4: also handles advertisers who already acted, helps sales correct course gracefully, introduces a process so claims are measured before they are made, and a credible, evidence-backed real example.

## GOO-L5-04

**What a strong answer contains.**
- **Understand before objecting**: re-read the design, write down the concern precisely (the failure scenario, the assumption it depends on), and ask the author for time, privately, with questions rather than conclusions ("how does this behave when …?"). Accept that the author may have context the document lacks.
- **Make it testable**: a failure scenario walked through, a cost or capacity estimate, or a small prototype or measurement; proportionate to the risk and with the candidate's own commitments handled openly (tell their manager about the time spent).
- **Raise it constructively**: if the concern survives the conversation, ask the author to include it in the document or let them know the candidate will raise it at the review; bring evidence and at least one mitigation or alternative, not just objection. If the evidence shows the concern is smaller than thought, say so plainly.
- **If overruled**: disagree and commit — support the design in practice, record the risk and a trigger that would justify revisiting it (a metric or an event), and help make the chosen design succeed. No relitigating in hallways.
- **If an incident later proves the concern**: focus on fixing and learning, refer to the recorded risk factually, never "I told you so".
- **Real example**: a disagreement with a more senior engineer, what the candidate did, what evidence they brought, how it was decided, and what they learned about disagreeing well.

**Red flags.** Raising it first in the review to an audience; going to the author's manager first; staying silent because the author is senior; arguing from opinion without evidence; undermining the decision after it is made; treating being right as the goal.

**Rubric anchors.** 2: either stays silent or argues loudly without evidence. 3: talks to the author first, tests the concern, raises it with evidence and alternatives, commits if overruled. 4: also proportionate effort, records the risk with a revisit trigger, graceful when wrong, handles a later incident without blame, and a credible, evidence-backed real example.

## GOO-L5-05

**What a strong answer contains.**
- **First two weeks**: take a share of on-call personally; classify the last several weeks of pages (actionable or not, cause, time, resolution); talk to each engineer about load and what they would fix first; agree with the manager on the attrition risk.
- **Objectives**: write user-facing objectives for live speeds as routing experiences them (freshness of the published snapshot, coverage of segments with live data) and alert on error-budget burn rate rather than on internal lag thresholds. Keep pages for real user impact; route everything else to tickets or daytime review.
- **Alert cleanup**: delete or downgrade non-actionable alerts with evidence (how often they fired, whether anything was done, whether a real incident would still be caught by the objective-based alerts); give the "data looks odd" alerts an owner or remove them.
- **Fix causes**: the top few causes of pages usually account for most of them (consumer lag from a hot partition, restarts from memory pressure); fix them, and automate safe remediation with limits.
- **Negotiate with product**: bring numbers: pages per week, time lost, attrition risk, and what {{roadmap}} will cost if the platform stays fragile. Propose a concrete split (for example a fixed share of capacity for reliability for a set period, with milestones) or a re-scoped roadmap; let product choose with the trade-off visible.
- **Practice**: structured handoffs, follow-up items owned and tracked, load measured per person, a rule that repeated pages produce a fix.
- **Success measures**: pages per week from {{pages}} toward a target, share actionable from {{actionable}} toward most, objective attainment, and team health signals.
- **Real example**: a rotation or system they made operable, with measured before-and-after numbers and their own actions.

**Red flags.** Asking for headcount as the only answer; silencing alerts without checking coverage; heroics instead of fixes; ignoring the two engineers at risk; no conversation with product, or a demand with no numbers.

**Rubric anchors.** 2: "tune the thresholds". 3: data-driven classification, user-facing objectives and burn-rate alerting, evidence-based cleanup, a negotiated trade-off with product, success metrics. 4: also people care and sustainable practice, safe automation, a clear story for leadership six months later, and a credible, evidence-backed real example.
