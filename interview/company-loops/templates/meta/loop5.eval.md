# Meta · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.

## MET-L5-01

**What a strong answer contains.**
- **First weeks**: confirm the requirement in writing with privacy and legal (which data, which people, what may cross, what evidence they need). Inventory all {{pipelines}} pipelines: inputs, outputs, owners, consumers, whether they touch identifiers, last use. Classify into: retire (unused or redundant), aggregate-only (can run centrally on qualifying aggregates), and must-move (identifiable data, processed in-region). Agree the inventory with the sponsor; the retire list is the cheapest progress.
- **Architecture**: ingestion for the affected people terminates in-region; raw and identifiable telemetry is stored and processed there; only aggregates that meet the minimum group size leave, and they are in mergeable form (counts, sums, histograms or sketches for percentiles) so global views are built from regional pieces without moving rows. Global incident dashboards read those aggregates; a drill-down into identifiable data happens in-region with regional access controls. Backups and extracts follow the data's region.
- **Delivery**: a migration path per pipeline class with a template other teams can follow (so each team's work is small and repeatable); parallel run comparing regional and central outputs before cut-over; verification evidence per pipeline (data-flow tests that fail if identifiable fields leave, storage location checks, access logs) delivered to privacy as it completes, not at the end.
- **Cross-team**: owners and dates per pipeline agreed early; a monthly status to the sponsor with a red/amber/green by pipeline and the risks; when a team cannot start, options first (your team does the migration with their review, a temporary freeze of that pipeline for the affected people, scope cut), escalation with a specific ask only after that.
- **Near the deadline**: honest status early; prioritise by risk (identifiable data first); decide with the sponsor and privacy what is acceptable for what remains (for example stopping collection for the affected people in a pipeline until migrated), never quietly missing it.
- **Real example**: a migration with a fixed external date, with inventory, sequencing, how the candidate moved teams they did not manage, and the measured outcome.

**Red flags.** Interpreting the regulation themselves; replicating data "temporarily" outside the region; a big-bang cut-over; no evidence for compliance; hiding slippage until the last month; losing incident visibility.

**Rubric anchors.** 2: "move the databases to the region" with no inventory, verification or cross-team plan. 3: inventory and classification, in-region processing with qualifying aggregates crossing, staged migration with evidence, owners and status. 4: also scope cut by retirement, a repeatable template that makes other teams' work small, mergeable aggregates for global percentiles, early and explicit trade-offs near the date, and a credible real example.

## MET-L5-02

**What a strong answer contains.**
- **First two weeks**: categorise the last month of pages: cause, time of day, action taken, whether action was needed, and owner. Typically a large share is non-actionable (flapping thresholds, upstream delays nobody on the team can fix, duplicates). Map late reports to causes. Talk with each engineer about on-call and what they would fix; take the attrition seriously and tell the director what is happening with numbers.
- **Quick wins**: delete or downgrade non-actionable alerts (with a reviewed list so real failures still page); route upstream-delay alerts to the upstream owner or turn them into a daytime ticket; automate the manual reruns (idempotent jobs triggered by data arrival rather than by clock); runbooks for the remaining pages.
- **Root causes**: rank by pages and advertiser impact; fix the top few (data-arrival triggers instead of fixed schedules, completeness checks before publishing, retries with idempotent writes, an SLO for report freshness with an error budget).
- **Negotiating capacity**: bring the director the cost: late days, tickets, engineer hours on pages, attrition and its replacement cost, and the effect on feature delivery speed. Propose an explicit split (for example a fixed share of capacity on reliability for a quarter) with milestones, or re-scope one feature; agree what slips if anything, so the director can manage the commitment rather than discover it.
- **Upstream**: agree a data delivery SLO with the upstream team, measure it, and design defensively (wait for completeness signals, publish with an as-of note rather than failing silently).
- **People**: fair rotation and recovery time after night pages, but the point is reducing load, not spreading it; recognise the work; follow up with the people who want to leave.
- **Measures**: pages per week and the share that were actionable, night pages, late-report days, tickets, time spent on toil; targets set with the team.
- **Real example**: a time they reduced operational load, with numbers before and after, and how they balanced it against delivery.

**Red flags.** Ignoring attrition; silencing alerts without a review; a rewrite as the only answer; agreeing to the roadmap and hoping; blaming the upstream team without an agreement or defensive design.

**Rubric anchors.** 2: "fix the alerts" or "hire more people". 3: pages categorised, noise removed safely, top causes fixed, capacity negotiated with data, measures. 4: also upstream SLOs with defensive design, a freshness SLO with an error budget, explicit trade-off agreed with the director, care for people beyond rotation changes, and a credible, measured real example.

## MET-L5-03

**What a strong answer contains.**
- **Evidence**: show that the new rule measures attention better, not just that it helps ranking: impressions under the new rule should predict later engagement, recall or survey responses better; quantify the change per surface and country (fast-scrolling surfaces change most); check the effect on every major dependent metric.
- **Decision**: a written proposal to the metrics review group with the evidence, the impact on each dependent team, the migration plan and its cost (dual logging). Teams that gain and teams that lose are both consulted before the decision.
- **Migration**: a fixed dual period with both definitions computed side by side (ending on a date, because of cost); goals rebased by the ratio observed in the dual period (targets move by the measured factor, so no team gains or loses from the definition alone); experiments in flight finish on the definition they started with, and new experiments use the new one; history handled honestly: backfill the 30 days possible, mark a definition break on longer charts or show a ratio-adjusted series labelled as estimated, never splice silently.
- **People**: affected teams get an owner on the platform team, migration tooling, and early numbers; the team asking for delay gets its concern addressed (rebased goal) rather than a delay by default; the decision is communicated with reasons.
- **Real example**: a change to a widely used definition, interface or contract, with the candidate's role, how dependants were moved, and measurable outcome (migration completed by date, incidents, adoption).

**Red flags.** Switching the definition on a date and letting goals swing; splicing two series without a label; endless dual logging; treating ranking gains as proof the definition is better for everyone; escalating instead of persuading.

**Rubric anchors.** 2: "announce the change and update dashboards". 3: evidence, decision rights, dual period with an end, rebased goals, rule for experiments, labelled history. 4: also validation that the new rule is better beyond ranking, per-surface impact, support for the losing teams, and a credible, measured real example.

## MET-L5-04

**What a strong answer contains.**
- **First day**: get a second qualified reviewer to confirm the flaw and the corrected analysis within hours, not weeks. Then tell the manager and the owners of decisions being made on the number, the same day, in writing: what was reported, what is wrong, what the corrected estimate is with its interval, what is not yet known (other studies), and when the next update comes. Recommend pausing decisions that rely on the number. Flag to the teams that own advertiser communication that a correction may be needed, with the facts.
- **Waiting is not an option**: decisions are being made now; waiting a month to "confirm" with another study converts an honest error into a concealed one. If the manager insists, the candidate escalates respectfully and documents the disagreement.
- **Other studies**: identify every study processed by the affected pipeline version or analysis code; rerun them with the fix; prioritise by decisions at stake and by how far results move; publish a list with old and corrected values.
- **Presenting uncertainty**: give the point estimate and interval, say what decision each end of the interval would support, and recommend what would reduce uncertainty (a new, correctly run study). Avoid both overclaiming and "the result is meaningless".
- **Prevention**: automatic checks on every study before results are released: sample ratio mismatch, covariate balance between groups (would have caught the age-correlated hash), identical processing in both groups (would have caught asymmetric dedup), analysis over everyone assigned (intention to treat; would have caught the exposed-only filter), periodic A/A studies; an analysis plan fixed before results are seen.
- **Ownership**: the candidate approved the review and says so; the review is blameless and focuses on why the system allowed it.
- **Real example**: a time they reported their own team's error, to whom and how fast, what happened next, and what changed.

**Red flags.** Waiting for a better moment; correcting quietly in the next report; overclaiming the corrected number; blaming the analyst; prevention that is "double-check results".

**Rubric anchors.** 2: fixes the analysis and reports it at the next scheduled review. 3: quick second review, prompt written correction to decision-makers with uncertainty, other studies traced, automatic checks. 4: also handles the manager's pushback with integrity, prioritises affected studies by decisions at stake, names the specific check for each flaw, owns their review role, and a credible real example.

## MET-L5-05

**What a strong answer contains.**
- **Diagnosis first (weeks 1–4)**: compute every app's number and the company number from the same raw data under each definition; decompose the {{gap}} into causes (day boundary, test and internal accounts, event types counted, cross-app de-duplication) with sizes; classify each as legitimate (a messaging app counting received messages may be intentional) or accidental.
- **Options**: (a) one central pipeline producing all numbers; (b) shared definitions and a shared library or semantic layer running over each app's data; (c) a hybrid: a central layer for company-wide numbers and shared building blocks (day boundary, exclusions, account linking) that app pipelines adopt, with app-specific definitions kept where legitimate and named differently. Compare on consistency, ownership and on-call, cost, migration risk and team autonomy. Most strong answers land on (c), but (a) can be right if the evidence shows the differences are almost all accidental.
- **Cross-app counting**: only where accounts are linked under the privacy rules and user settings; elsewhere an estimated overlap from an approved method, labelled as estimated, never created by linking accounts.
- **Migration**: parallel run per app with daily reconciliation and every difference explained; goals rebased where definitions change; old pipelines turned off only after an agreed period; cost tracked against the {{cost}} baseline.
- **Adoption without a mandate**: give app teams something they want (less on-call, faster new metrics, fewer review arguments), start with a willing app, publish results, and use the vice president's sponsorship for priority, not coercion. For the largest app, consider adopting its pipeline as the base where it is already right.
- **Real example**: a consolidation or migration with the candidate's role, what they got wrong and corrected, and measured outcome (cost, number of disputes, adoption, incidents).

**Red flags.** Starting with a central rewrite before diagnosing; forcing adoption through the sponsor alone; linking accounts to improve a count; declaring one app's definition the winner by size; no parallel run.

**Rubric anchors.** 2: "build one pipeline and make everyone use it". 3: diagnosis of the gap with sizes, options compared on criteria, staged migration with reconciliation, adoption plan. 4: also privacy-correct cross-app counting with labelled estimates, legitimate differences preserved by name, cost and on-call implications handled, and a credible, measured real example.
