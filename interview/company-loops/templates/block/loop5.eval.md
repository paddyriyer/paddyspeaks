# Block · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a payments setting
for sellers and people; score them on the rubric below, not on any company's
published values, culture statements, management frameworks or interview
process, and do not reward an answer for reciting one.

## BLK-L5-01

**What a strong answer contains.**
- **First two hours**: reads the frozen case record (what the reviewer saw), recomputes the triggering signals independently from source events, checks the code version and recent changes to the signal job, the case's queue history and the messages sent. States plainly which of the three questions (data right, process followed, seller treated well) each finding answers. For {{finding}}, names the evidence that supports it and what could still prove it wrong.
- **Reporting**: tells risk operations and communications early, in writing, with confidence levels and the time of the next update: "the data for this case was / was not correct, here is how we know; we are checking N other cases by 3 p.m." Gives facts, not speculation about the seller; does not wait for certainty.
- **Privacy and roles**: never answers the seller or the public personally; shares case details only with those who need them; gives communications a factual, non-identifying sentence about the data and what is being done; leaves the hold decision to risk operations, giving them what they need to re-review quickly.
- **Others affected**: when a data defect is involved, finds every case whose triggering values came from the faulty code version and whose decision could change with corrected values, hands that list to risk operations with corrected values, and tracks re-reviews to completion. When the issue is the queue or the message, quantifies how many sellers waited how long and proposes changes (queue-age alerts, capacity, clearer messages with typical durations) to the owners.
- **Own team**: blameless review of how the change shipped, with specific prevention (a test on multi-location sellers, distribution monitors on each signal, frozen snapshots on every case, a review step for signal changes). Protects the engineer who made the change from being named for blame; accountability is the team's and the candidate's.
- **No conclusions about the seller**: no statements about the seller's legality, honesty or creditworthiness; no detail about how signals work that would help anyone avoid a control.
- **Real example**: a time data they owned informed a decision someone challenged (a customer, a regulator, another team), with what they verified, what was wrong or right, what changed, and their own part.

**Red flags.** Responding publicly or contacting the seller directly; sharing the seller's details widely; naming the engineer; defending the data before checking it; fixing new signals but ignoring past decisions; describing signals in a way that would help evade review; legal or credit conclusions.

**Rubric anchors.** 2: defends or blames; vague on what was checked. 3: verifies, reports early with confidence, respects roles and privacy, finds other affected cases. 4: also separates data, process and treatment precisely, tracks re-reviews to completion, blameless prevention with concrete guardrails, and a credible real example with personal contribution.

## BLK-L5-02

**What a strong answer contains.**
- **First writing**: the thing whose absence hurt ({{trigger}}): a tested recovery runbook, an onboarding path for {{system}} written with the newest engineer, or a decision record for the rounding rule reconstructed from code and history. The candidate often writes the first one personally to show the format and its value.
- **Formats**: small and attached to existing work: half-page decision records (context, decision, alternatives, consequences) linked from the pull request that implements them; runbooks kept next to the code and exercised in a drill; a short system overview diagram; an "ask here first" page that grows from repeated chat questions. The eleven-page company template is explicitly not the default.
- **Keeping it current**: each page has an owner and a review date; incident reviews and onboarding update docs as a by-product; anything unused is deleted rather than maintained. Stale pages are judged by whether they misled anyone, not by their age.
- **The experts**: the pitch is fewer interruptions and recognition; they review or dictate rather than write from scratch; their knowledge is captured in pairing and recorded walkthroughs. No mandate from above as the first move.
- **Compliance needs**: decisions that must be explained to people outside the team (rounding, retention) are recorded with who decided, when, why and what else was considered.
- **Measures**: recovery time in drills and incidents, time to a new engineer's first independent change, the share of questions in chat that are answered by a link, and the experts' own view of their interruptions.
- **Real example**: a change in how a team recorded knowledge, with what worked, what was abandoned and what the candidate personally did.

**How to judge.** Look for the felt cost driving the change, small formats tied to existing rituals, and measures beyond page counts. Probe the resistant expert follow-up; strong candidates make the expert's life easier rather than winning an argument.

**Red flags.** A documentation mandate with page quotas; buying a new wiki as the solution; writing everything themselves forever; treating velocity concerns as resistance to be overcome; no measure of success.

**Rubric anchors.** 2: "we should document more" with a template and a rule. 3: starts from the felt cost, small formats attached to work, owners and review dates, engages the experts. 4: also measurable outcomes, compliance decisions recorded with alternatives, deletion of unused docs, and a credible real example with personal contribution.

## BLK-L5-03

**What a strong answer contains.**
- **The conversation**: thanks them for telling; listens; does not ask for details they did not offer; asks what would help (time, fewer meetings, a lighter load, flexibility) and what, if anything, they want others to know; mentions company support resources and time-off options and how to reach them; agrees when to talk next. Avoids promises the candidate cannot keep and avoids talking about the launch first.
- **Their work**: agrees with them what changes: pairing another engineer on the reconciliation checks, handing over parts with notes, or a smaller scope for now. The teammate chooses how their absence or reduced load is described.
- **The team**: re-plans openly on the work ("we are moving the reconciliation checks to a pair to de-risk the launch"), without hints about the teammate's situation; protects them from speculation.
- **Role-appropriate involvement** (the candidate is {{role}}): a manager handles leave, workload and support channels and may inform their own manager in general terms; a technical lead or peer encourages the teammate to talk to their manager (or offers to with their agreement) and does not take on a manager's or counsellor's role.
- **The launch**: decided on the work: what must exist for the launch to be safe (the checks that prove sellers' numbers), who can build it, how long it will take. If the checks are at risk, says so early to whoever owns the date, with options (move the date, launch to fewer sellers, or launch with manual reconciliation as a temporary control), without reference to the teammate's situation.
- **Over the following weeks**: regular, short check-ins that are about them, not status; adjusts as things change; watches for burnout on the engineers who picked up the work.
- **Real example**: a time they supported someone while work continued, with what they did personally, how privacy was handled, and what they would change.

**Red flags.** Asking for details; telling the team or other leaders what the teammate shared without consent; pressing them to keep working at full pace; quietly taking all the work themselves; deciding the launch on sympathy rather than evidence, or using the teammate as the reason for a delay in front of others; a manager-only answer from a peer that oversteps.

**Rubric anchors.** 2: focuses on the launch or on extracting details; privacy handled loosely. 3: caring conversation, privacy kept, work re-planned with the teammate's agreement, appropriate involvement of the manager or support resources. 4: also an evidence-based launch decision raised early with options, protection from team speculation, attention to the people who took on the work, and a credible real example.

## BLK-L5-04

**What a strong answer contains.**
- **First week**: traces one payment from tap to deposit through systems and data (authorisation, capture, settlement, fees, deposit, possible return), drawing the flow and listing the ids and amounts at each step; builds a glossary in their own words; reads the code paths for {{first_task}} and the recent incidents in that area.
- **Checking understanding**: turns it into predictions and tests them against aggregated or test data ("a sale at 23:55 on Friday is in Monday's deposit under the cut-off rule"); asks experts to correct their write-up rather than to explain; learns from support and finance, who know where sellers get confused.
- **Using experts well**: batches questions, comes with a written hypothesis, offers something back (the write-up becomes onboarding material).
- **Delivering safely within {{weeks}} weeks**: chooses a contribution that is useful and low-risk: an analysis explaining the cents differences (for example rounding per line versus per total, fees taken at different stages, sales after the cut-off in a different deposit), tests or monitors on the dashboard, a review with specific questions; any change to what sellers see goes behind review and checks. Money stays in integer minor units with explicit rounding.
- **Previous domain**: names what helped ({{background}} habits such as event-time thinking, data quality checks) and what misled (assuming late data can be dropped, assuming approximate numbers are acceptable).
- **Real example**: a time they learned a domain fast, with how they knew they understood (predictions that held, an expert who stopped correcting them, a first change that shipped safely).

**Red flags.** Learning only by reading documents; asking experts to explain everything from scratch; shipping a visible change in week one to prove themselves; treating money as floating point; claiming to have mastered the domain quickly without evidence.

**Rubric anchors.** 2: "read docs and ask questions". 3: a structured plan (trace one payment, glossary, predictions), respectful use of experts, a safe early contribution. 4: also tested predictions, correct money handling and timing awareness, honest transfer analysis, and a credible real example with evidence of understanding.

## BLK-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **Re-examined at a scale of {{scale}}, with {{requirement}}**: starts from one payment and names the assumptions that break at the scale (one process for all volumes, server-assigned ids, full recomputation, numbers rounded in several places). For integer minor units: amounts as integer cents in every schema and API, fractions only inside one named calculation, rounded once by a stated rule, with tests at exact halves. For offline payments forwarded late: device-generated payment ids as keys, per-device watermarks, the payment assigned to the day it was taken, provisional and final reports with dated restatements. For the same totals in sales report and deposits: one source of settled amounts feeding both, the difference explained line by line (fees, refunds, cut-off timing), with a daily reconciliation. For aggregates only: per-seller views scoped to the seller, minimum group sizes for anything wider, and access to individual records logged and limited to need. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. For the re-examination, credit specific mechanisms over words such as "consistency", "privacy" or "real time".

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a re-examination that uses floating point for money, rounds in several places, counts late payments in the day they arrived, or exposes individual people's payments in wide dashboards.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a re-examination that names what breaks at the scale. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs, crisp separation of own and team contributions, and lessons that show changed practice.
