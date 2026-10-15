# Walmart Global Tech · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in an omnichannel
retail setting; score them on the rubric below, not on any company's published
values, culture statements, management frameworks or interview process, and do
not reward an answer for reciting one.

## WMT-L5-01

**What a strong answer contains.**
- **The pilot result first (first two weeks)**: treat the pilot result (here, {{pilot_result}}) as the most important data in hand. Break it down by store format, size and region; visit or call pilot stores with store operations to watch the flow in use; find the cause (a slow screen, an extra step, a flow that does not fit small stores, a mismatch with how the work is really done). Quiet reversion is feedback that the product does not fit the work; it is never a reason to measure or police people. Fix what can be fixed and re-pilot if the change is material.
- **Waves**: choose wave stores to cover every store format, with regional leaders' agreement; write entry and exit criteria before each wave (target measure no worse than baseline, time per task within a bound, error rate, support tickets per store, reversion rate) and name who can stop the next wave. Keep a pause and rollback switch per store that has been tested.
- **Measurement in aggregate**: adoption (share of tasks done in the new flow per store) and outcome (the target measure, time per task, errors) per store, region and format. When a regional leader asks for per-associate views, decline and explain why (trust, fairness, and the change's own adoption), and offer store-level and format-level views plus qualitative feedback.
- **Feedback and support**: an in-app feedback path, regular calls with regional leaders, a fast fix cadence with visible "you said, we changed" notes; short in-flow guidance and help at the moment of use rather than long training sessions that take people off the floor.
- **The deadline**: compare the evidence with the {{weeks}}-week target and the approaching peak; if the pilot issues are not fixed, present leadership with options (fewer waves before peak, a pause during peak, or a later finish) with the evidence and a recommendation, through the right people.
- **Real example**: a rollout to many users or sites; what the candidate learned from those who adopted it, what changed in the product as a result, and the measured outcome.

**Red flags.** Scaling a pilot with a known problem to meet a date; treating reversion as non-compliance; per-person dashboards or rankings; training as the answer to every problem; no rollback; claiming store operations decisions as their own.

**Rubric anchors.** 2: rolls out on schedule with training and a dashboard, ignores the pilot signal. 3: investigates the pilot, waves with criteria, aggregate measurement, feedback loop, rollback. 4: also refuses per-associate tracking with a credible alternative, adapts waves to store formats, raises the deadline risk with evidence and options, and a credible real example with changes driven by users.

## WMT-L5-02

**What a strong answer contains.**
- **Mandatory versus recommended**: the mandatory part is the interface others depend on (for {{standard}}: schemas published and versioned in one place, one metric definition consumed by every surface, or a minimum set of checks that must pass before publishing); how a team meets it (tools, libraries, processes) can vary. Decide from where the incidents came from: the shared reports fed by the holdout team.
- **The holdout team**: meet their lead early, listen, and separate real friction from preference. For the holdout team (here, {{holdout}}), fix the platform: a faster review path or automated compatibility checks, a lighter client or a server-side adapter for devices, or an adapter that maps seller data into the contract with explicit gaps. Agree a dated plan with them, possibly with a time-limited exception while the platform changes ship.
- **Exceptions**: written criteria, an owner, a review date and an expiry; recorded and visible; the same criteria for every team, so the next request is decided on its merits.
- **Evidence**: incident counts before and after, plus the cost to teams (time per change, review wait, failed publishes) measured, not guessed. If the standard costs more than it saves for some teams, change the standard.
- **Leadership**: if a mandate in {{months}} months would backfire, say so with the evidence and propose a path (platform fixes first, then the mandate, with a date), rather than either refusing or quietly complying.
- **Real example**: a cross-team standard the candidate set or enforced, what it cost, how resistance was handled, and whether it paid off.

**Red flags.** "Make it mandatory and block their deploys" without fixing friction; granting informal, permanent exceptions; treating the holdout team as the problem; no measure of cost; inconsistent treatment of teams.

**Rubric anchors.** 2: mandate or give up. 3: separates interface from implementation, fixes legitimate friction, a written exception process, evidence of benefit. 4: also measures cost to teams, consistent exception decisions, honest counsel on mandate timing with a plan, and a credible real example with outcomes.

## WMT-L5-03

**What a strong answer contains.**
- **First weeks**: one-to-ones with everyone, employees and contractors; map who can fix which systems and where only one person can (here, {{issue}}: this is the central risk); look at on-call load and who carries it; read incidents. Change little at first except obvious unfairness in information sharing.
- **One team within the rules**: invite everyone to design reviews and planning where the agreement and company rules allow (and ask HR or procurement when unsure); share context and credit equally; fair on-call rotation; design work spread across both groups. Talk to employees who see contractors as ticket-takers, directly and respectfully, about why that costs the team.
- **Knowledge transfer**: identify the two people whose engagements end soon and the person everyone calls; plan transfer as scheduled work (pairing on real incidents, rotation of on-call shadowing, runbooks written by the learner and tested in a drill) with checkpoints before the engagements end.
- **Milestone versus transfer**: make the trade-off explicit with the manager: what transfer costs in milestone capacity, what risk losing the expert carries. Raise an extension request early through procurement with the evidence, without promising anyone a job or an extension.
- **Real example**: working in or leading a mixed team, what the candidate did to include people and spread knowledge, and the measurable result (fewer single-expert systems, on-call balance, incidents resolved by more people).

**Red flags.** Treating contractors as second-class or excluding them; promising conversions or extensions; directing contractors in ways the agreement may not allow without checking; leaving knowledge transfer to the last week; ignoring employees' attitudes.

**Rubric anchors.** 2: focuses only on the milestone, or makes promises they cannot keep. 3: maps knowledge concentration, includes everyone within the rules, plans knowledge transfer, explicit trade-off with the milestone. 4: also tested runbooks and drills, fair on-call redesign, early and honest handling of ending engagements through the right channels, and a credible real example.

## WMT-L5-04

**What a strong answer contains.**
- **First month**: inventory every input, output, consumer and schedule of {{system}}; capture the vendor's console settings, batch jobs and rules while access exists (here, {{gap}}, which makes this urgent); export history early and verify it; record real outputs for a period to build a behavioural test set. Agree scope with consumers: parity, deliberate changes, and things to drop.
- **Recovering hidden rules**: compare outputs with inputs to infer rules; walk the console and jobs with the vendor's engineers while they still have reason to help; write each rule as a test case with an example; treat unexplained outputs as unknown rules until proven otherwise.
- **Parallel run**: run both systems on the same inputs; compare outputs at a defined grain (per store-item, per slot, per return); classify each difference (bug in new, bug in old to keep or fix, intended change, data timing); set a cut-over threshold on unexplained differences.
- **Cut-over and rollback**: staged by consumer, region or store group; rollback to the vendor system rehearsed while it still runs; avoid peak days; a final data sync plan.
- **New features**: after cut-over unless essential, because they make the parallel run harder to interpret; tell leadership so with the reason.
- **Vendor and date**: keep the relationship constructive and specific (a list of sessions and exports needed by date); contract matters to procurement and legal. Decide early which signals would justify asking for a short extension, and raise it with evidence well before the end of the {{months}}-month contract.
- **Real example**: a migration off a system the candidate did not build; what they discovered late and what they would do earlier.

**Red flags.** A big-bang switch on the last day; rebuilding from the API documentation alone; adding new features before parity is proven; no rollback; negotiating the contract themselves; blaming the vendor.

**Rubric anchors.** 2: rebuild from documentation and switch at the deadline. 3: behavioural discovery, parallel run with difference classification, staged cut-over with rollback, features deferred. 4: also early capture of console rules and history, explicit extension decision criteria, constructive vendor plan, and a credible real example with lessons.

## WMT-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one register line item and names the assumptions that break at the scale (one central clock, full recomputation, always-online sources, unbounded joins). For reconciliation to registers: per-register transaction sequence numbers with gap detection, end-of-day totals from each register ingested as their own record, and a daily store-and-register reconciliation that lists unexplained differences. For local business days: each store's time zone recorded on the store, the business day computed at ingestion from the event's instant and stored with the record, with tests for the days clocks change and for stores that close after midnight. For late stores: versioned, labelled restatement (a report version per day, a changes view, readers told what moved), or a stated freeze with late data in a later period. For aggregate-only visibility: no customer or associate identifiers in analytic tables, minimum group sizes, and access controls. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "real time", "consistency" or "governance".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that overwrites reports silently, computes store days in UTC, or exposes individual customers or associates.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
