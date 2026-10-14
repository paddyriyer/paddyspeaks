# Uber · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a ride-hailing,
delivery and freight marketplace setting; score them on the rubric below, not
on any company's published values or interview process.

## UBR-L5-01

**What a strong answer contains.**
- **First weeks: evidence.** Consumers of each table from query logs and lineage, grouped by criticality (finance close, pricing and payments inputs, city operations dashboards, ad hoc analysis) and by owner (named, or unowned service accounts). A row-level reconciliation of the two tables for a few representative cities and weeks, with every difference classified (definition: completed at trip end vs at fare finalisation; grain: batched delivery as one or many trips; scope: cancelled trips with a fee; duplicates across units; timing; genuine bugs). The {{gap}} difference is explained in parts, with the unexplained remainder stated.
- **Decisions and who makes them.** Grain is settled first (what one row is, for example one row per trip leg or per order, with a parent trip id), then definitions as explicit columns or flags (`completed_at_trip_end`, `fare_finalised_at`, `is_cancelled_with_fee`), so both questions remain answerable without two tables. A named metric owner decides what "completed trips" means for company reporting, recorded in a decision record with the reasoning; the candidate recommends, leadership confirms.
- **Migration.** Build the target, run it in parallel with both old tables, and publish a daily reconciliation. Provide compatibility views that reproduce each old table from the new one (with an end date), so consumers can move without rewriting at once. Migrate in order of criticality, with finance last or after the quarter close (freeze around close), and with each critical consumer's owner signing off on a parallel-run comparison. Unowned consumers: identify by account and query, notify through the account's last known owners, brown-out (temporarily fail reads with a message) before final retirement, and keep the ability to restore for a period.
- **People.** Both data teams take ownership of parts of the result (for example, one owns ingestion of rides, the other delivery; both sit on the definition review). The candidate names the losing side's concerns and gives them substance (their definition survives as a column; their expertise shapes the grain). Credit shared publicly.
- **Progress measures.** Share of consumers migrated by criticality, reconciliation difference over time, number of incidents caused by the migration, date the old tables are switched off.
- **Real example.** A consolidation of competing sources across teams the candidate did not manage, with the resistance met, the decisions they personally drove, and measured results.

**Red flags.** Picking a winner table on day one; a big-bang cut-over; changing finance's numbers before close; ignoring unowned consumers; "we will document the differences" as the plan; treating the other team's definition as wrong rather than different.

**Rubric anchors.** 2: "choose the better table and migrate everyone". 3: consumer inventory, reconciliation with classified differences, grain settled and definitions as flags, parallel run and staged migration with a finance freeze. 4: also a decision record with an owner, compatibility views with an end date, a safe retirement path for unowned consumers, both teams given real ownership, progress measures, and a credible real example.

## UBR-L5-02

**What a strong answer contains.**
- **Needs first.** What the platform must do in six months (load, reliability, the next capabilities), turned into skills and a seniority mix (for example two or three senior engineers early who can own areas and mentor, then mid-level engineers, with one early hire focused on reliability and tooling). The order of hires accounts for the complication: a second office needs a senior lead there early so new hires are not isolated; a departing senior engineer needs knowledge transfer started now; limited interview capacity needs a funnel that spends interviewer time only on likely candidates (a short work-sample screen first).
- **Selection with a consistent bar.** Written criteria per role (what someone must be able to do), structured interviews with exercises close to the work (debugging a lagging stream job, designing a backfill, reviewing a real-looking pull request), trained interviewers with shadowing, independent written feedback before discussion, and a decision rule (for example, a clear "no" on a must-have criterion is decisive). Calibration sessions as the panel changes. The candidate is clear that this is their team's process within whatever the organisation requires.
- **Protecting the current engineers.** Reduce operational load in the first weeks: classify pages, delete or fix the noisiest, borrow the neighbouring engineer for on-call cover or toil; limit each current engineer's interviews per week; make it explicit what the team stops doing.
- **Onboarding as a product.** Runbooks for top alerts written early (by the borrowed engineer and the first hires as they learn), a staged on-call path (shadow, reverse shadow, primary with a backup), small first changes in week one, a buddy for each hire. Readiness for on-call judged on demonstrated handling of real or rehearsed incidents, not on time served.
- **Knowing the bar held.** Measures decided up front: ramp time to first independent change and to on-call, incidents caused by changes from new engineers, peer and interviewer feedback, early attrition, and a review of later hires' interview packets against early ones.
- **Real example.** A period of rapid hiring or onboarding, what they designed, what went wrong (a mis-hire, an onboarding gap), what they changed, with outcomes.

**Red flags.** Hiring to a headcount target; lowering the bar quietly when the pipeline is thin; leaving the three engineers to interview while carrying all of on-call; "they will learn on the job" with no onboarding plan; unstructured interviews or "culture fit" as a criterion; presenting the plan as a company hiring process.

**Rubric anchors.** 2: "post the roles and interview a lot". 3: needs-driven role plan, structured selection with written criteria and calibrated interviewers, operational load reduced, staged onboarding to on-call. 4: also a plan shaped by the complication, a decision rule that resists pressure, measures that test whether the bar held, protection of the existing team, and a credible real example including what went wrong.

## UBR-L5-03

**What a strong answer contains.**
- **A credible estimate.** Parts with their own ranges: real-time ingestion of completed trips and base fares (known work); tips that arrive hours later; fare adjustments and support changes; incentive rules that today exist only in the batch (re-implementing or exposing them is the largest risk); cancellation fees; reconciliation with the nightly payout batch; the app or report surface; testing with real earnings data. The candidate states what is risky, what evidence would shorten it (for example if incentive progress can be read from an existing service), and what would make it eight weeks.
- **A first slice that is exact.** For example: completed trips and deliveries today with their base fares, labelled "so far today, before tips and adjustments; your pay statement is final", built so the number can only increase within the day and matches the batch's base fares for the same trips. Optionally incentive progress shown as trip counts against the target, not money. A daily automated comparison with the batch before launch and after.
- **Negotiation.** Understand the product manager's real goal ({{reason}}) and what would satisfy it; present the options (full scope in twelve weeks; the exact first slice in four and the rest in stages; full scope in four with a stated risk of wrong pay numbers) with their consequences, jointly with the product manager, to the director who decides. No surprises: the product manager sees everything before the director does.
- **If they insist.** State the risk in writing with examples of what a driver would see (an incentive shown as earned, then removed), propose guardrails (launch in one city, a kill switch, the batch still the source of payouts), and, if overruled on a matter of showing people wrong numbers about their pay, escalate once more with the evidence rather than quietly comply or quietly refuse. Commit fully once a sound decision is made.
- **Real example.** A sharp disagreement between estimate and committed date, how they made the estimate credible, the scope they negotiated, and how it turned out.

**Red flags.** Accepting four weeks for the full scope with overtime; padding without explaining; refusing to ship anything; showing approximate pay numbers that can go down without labelling; going over the product manager's head without them.

**Rubric anchors.** 2: "push back and ask for more time" or "we will work weekends". 3: estimate broken into parts with risks, an honest first slice, options presented to the decider with the product manager. 4: also a slice that is correct by construction and reconciled with payouts, explicit guardrails if overruled, protection of the people who see the numbers, and a credible real example.

## UBR-L5-04

**What a strong answer contains.**
- **First hour.** Page the security on-call and declare an incident (lead, scribe, communications owner). Revoke or disable the key immediately; a published key is compromised whether or not it was used, and deleting the commit does not help because history and copies remain. Accept that the fourteen jobs will fail: issue a new, narrowly scoped credential through the secret manager (or move the jobs to short-lived workload identity) for the critical ones first, such as the nightly earnings inputs, and tell their consumers they may run late. Preserve evidence: snapshot the warehouse access logs for the account (they expire after 30 days), the repository's commit history and any access-request records. Ask the repository host to purge the cached content if possible, knowing that copies may exist. Support the engineer: thank them for acting quickly, ask for the facts, keep them involved.
- **First day.** Scope from logs: every query by the account since the commit, separated into the jobs' normal pattern (known hosts, known query shapes, schedules) and anything else (unknown addresses, unusual tables, exports, large reads). For anything suspicious: what tables and how many rows, whether personal data (trip locations, contact details) was read, from where. Hand facts to privacy and legal in writing, with what is known and unknown; they decide on notification. If {{scope}} includes write access, check for changes to data as well.
- **Following weeks.** A blameless review that asks why a long-lived key existed, why it had broad access, why it could be placed in a file, and why nothing stopped the commit. Changes: short-lived credentials or workload identity for jobs; least privilege per job; secret scanning before commits and on the organisation's public repositories; alerts on access by service accounts from unexpected networks; a plan for all other long-lived keys (inventory, owner, migrate in order of access breadth, deadline, then block creation).
- **Real example.** A security or data-exposure incident they were part of, what they personally did in the first hours, how scope was established, and what changed after.

**Red flags.** Waiting until after the nightly run to revoke; deleting the commit and considering it fixed; guessing scope instead of reading logs; deciding notification themselves; blaming or disciplining the engineer as the main response; prevention that is "remind people not to commit secrets".

**Rubric anchors.** 2: rotates the key eventually and reminds the team. 3: immediate revocation with a managed job recovery, logs preserved and analysed to scope access, facts handed to privacy and legal, blameless review with credential changes. 4: also distinguishes normal job use from other use precisely, least privilege and short-lived credentials across the platform, a plan for the other keys with owners and deadlines, care for the engineer and the team's reporting culture, and a credible real example.

## UBR-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, freshness or latency targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain and how it handled change (schema evolution, late or corrected data); for correctness, the invariant at risk, how it was detected, the fix and the proof; for latency or cost, the baseline, the analysis, the change, the measured result and the trade-off accepted.
- **Real-time at {{freshness}}**: names the first component that cannot keep up (a nightly batch, a full-table recompute, a join with a slowly loaded dimension, a database that cannot take the write rate) with a reason from their own numbers, and an incremental change (stream the parts that need freshness, keep batch as the correcting source, publish freshness with each output).
- **The city feature**: for city rules that change weekly, rules as versioned data with effective times so results are reproducible; for city-local time, local days from a versioned time zone reference and daylight-saving handling; for a city that must keep working when its region is cut off, per-city or per-region isolation of state and processing with a defined degraded mode. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; "make it streaming" with no component named as the bottleneck.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a named first component that cannot meet the freshness target. 4: also alternatives with evidence, an incremental and correct path to the city feature, crisp separation of own and team contributions, and lessons that show changed practice.
