# Stripe · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.

## STR-L5-01

**What a strong answer contains.**
- **First hour**: declare an incident with an incident lead, a communications lead and a scribe. Stop new duplicates with the fastest safe lever: a feature flag, a revert, or a server-side guard that rejects a second charge for the same order and amount within a short window (accepting a few false declines for an hour is usually better than more double charges). Confirm with the metric that triggered the page (charges per order) that it has stopped. Tell support and account teams what is known, what is not, and when the next update comes.
- **First day**: define a duplicate precisely (same merchant, customer or payment method, amount, order reference or cart, within a time window, second created by the faulty path, identifiable from logs of the retry) and measure false positives on a hand-checked sample. Produce the affected list with confidence levels. Agree with legal, support and merchants on the remediation: refund high-confidence duplicates through new refund transactions, route low-confidence ones to merchants, and exclude charges already in dispute (refunding a disputed charge risks paying the customer twice; handle through the dispute process). Draft merchant communication with exact counts and amounts.
- **Following weeks**: complete refunds and confirm through the ledger that every duplicate is reversed exactly once; reconcile refunds, disputes and support tickets to zero open items; a blameless review that finds why the idempotency guarantee failed (keys generated per attempt rather than per logical request, a consumer without dedup, a path that skipped the check) and why detection took the time it did. Prevention: server-side idempotency enforced where the charge is created, a test that replays retries and timeouts, an invariant monitor on charges per order with a paging threshold, and a library fix shipped to merchants with a deprecation plan for the faulty version.
- **Judgement under pressure**: separates containment, remediation and root cause; does not refund blindly; respects that merchants own the customer relationship while not leaving customers out of pocket for long.
- **Real example**: an incident with customer money or trust at stake, with the candidate's own decisions (what they stopped, what they chose not to do), measured impact and recovery time, and a change they drove afterwards.

**Red flags.** Starting with root-cause analysis while duplicates keep happening; deleting or editing charges; refunding everything without measuring false positives; ignoring disputes; prevention that is "more code review"; blaming the engineer.

**Rubric anchors.** 2: technical fix only, no containment or customer remediation plan. 3: fast containment, precise duplicate definition, refunds through new transactions, communication, server-side prevention with an owner. 4: also handles disputes and merchant preferences, measured false-positive rates, detection improvements with thresholds, and a credible, evidence-backed real example.

## STR-L5-02

**What a strong answer contains.**
- **Evidence (first week)**: classify last quarter's incidents by cause (schema limits, concurrency, operations, missing tests); measure change lead time and failure rate; list what the trigger actually requires (tenfold volume: where does the current design bottleneck and at what load, by test; multi-currency: which schema invariants break; mutable entries: where edits happen and whether they can be blocked now). Separate structural limits from neglect.
- **Options**: (a) evolve in place (fix the top causes, add invariants, block edits, partition tables); (b) incremental replacement behind a stable interface (strangler: new write path for one entry type or one product first); (c) full rewrite with a cut-over. Compare on risk to money, time to meet the trigger, total cost, reversibility and what the team can run. Most strong answers land on (b) or on (a) with targeted (b), but a rewrite can be right if the evidence shows a structural limit that cannot be evolved, and the candidate de-risks it.
- **De-risking**: shadow writes or a parallel run with entry-level reconciliation (every entry in old and new compared, differences explained to zero) for at least one or two closes before switching the source of truth; cut-over by slice with a rollback path; invariants (entries balance, balances equal sum of entries) checked continuously in both systems. History: leave immutable history in place and expose it through the new interface, or migrate with full reconciliation and keep the old store read-only for audit.
- **People**: a written decision record (context, options, criteria, decision, reversal points); both camps contribute to the criteria before the conclusion; named owners; finance and audit consulted early about close and controls.
- **Real example**: a decision of similar weight with the evidence used, the alternatives rejected and why, the outcome measured (incidents, latency, delivery time), and what the candidate would change.

**Red flags.** Deciding by taste or by headcount of the camps; a rewrite with a big-bang cut-over and no parallel run; dual writes with no repair story; ignoring finance's close calendar; treating history as an afterthought.

**Rubric anchors.** 2: picks a side with opinion and no plan for correctness during migration. 3: evidence-based comparison, staged plan with parallel run and reconciliation, written decision. 4: also explicit reversal points, history and audit strategy, team alignment that holds when the plan slips, and a credible real example.

## STR-L5-03

**What a strong answer contains.**
- **First days**: normalise cost (per active merchant, per million payments, per report generated) to show how much is waste versus growth; with merchant growth far below the cost growth, most of it is not growth. Turn on or improve query tagging; attribute spend by workload, owner and schedule; rank the top queries and warehouses by cost.
- **Likely causes and fixes**, each with evidence: full-history recomputes in new scheduled exports (make them incremental on a correctable window that covers late refunds and disputes, or read from finalised daily aggregates); dashboards refreshing per tab every minute (shared cached results with an as-of label, refresh on data change, not on a timer); scans without partition pruning or clustering on date and merchant; warehouses sized up and never back, or not auto-suspending; duplicated transformations across teams.
- **Protecting correctness and service**: any change to financial reports is proven by comparing old and new outputs for a full period to the minor unit; merchant-facing service levels are agreed with product before changes ship; quick reversible fixes first, measured week over week.
- **Guardrails**: per-team budgets and alerts, cost per workload on a dashboard reviewed regularly, cost review for new scheduled workloads, ownership tags required.
- **Communication**: to finance, a plan with expected savings, timeline and confidence; to product, which merchant-visible changes are proposed and why. Set a target (for example back to a cost per merchant near the earlier level) once the attribution supports it.
- **Real example**: a cost reduction with baseline, method, measured saving, time to achieve it, and side effects.

**Red flags.** Cutting the biggest line item without knowing who depends on it; "buy reserved capacity" as the whole answer; sacrificing exactness of financial reports; no guardrail to stop recurrence; no normalisation by growth.

**Rubric anchors.** 2: generic cost tips, no attribution. 3: attribution, root causes with evidence, sequenced fixes that protect exactness, guardrails. 4: also unit economics, explicit trade-offs agreed with product and finance, incremental models that stay exact under late changes, and a measured real example.

## STR-L5-04

**What a strong answer contains.**
- **Understand needs**: product's need is merchants' cash-flow visibility and fewer "where is my money" tickets; finance's need is one official figure, no confusing differences, and nothing that looks like a statement. Bring data: how big and how frequent intraday-to-final differences are, and their causes (late refunds and disputes, fees finalised at settlement, FX).
- **Options**: (a) end-of-day only; (b) real-time only; (c) both, as distinct, labelled concepts: a provisional or "estimated" current balance with an as-of time and a short explanation, and final daily figures marked as such, both derived from the same ledger, with the provisional number converging to the final one; (d) real-time for some fields (pending and available funds from the ledger) and end-of-day for reporting totals. Each option has data implications: one source, a provisional state, convergence monitoring.
- **Decision process**: a short written proposal with options, data and risks; the joint deciders named; agreement on success measures (support tickets, audit questions, merchant engagement); a fair escalation if needed. If overruled, commit and make the chosen option work, while recording the risk.
- **Making it stick**: definitions written once and used in product copy and finance reports; a monitor of the gap between provisional and final with a threshold; a review date.
- **Real example**: a cross-team disagreement where the candidate surfaced needs, proposed options and reached a decision that held, with evidence of the outcome.

**Red flags.** Picking a side on day one; "real-time" without a source of truth or convergence; showing two unlabelled numbers; escalating without options; relitigating after the decision.

**Rubric anchors.** 2: sides with one team, no data. 3: needs surfaced, gap quantified, labelled provisional and final options from one source, clear decision rights. 4: also measurable acceptance criteria (gap thresholds, ticket rates), a plan to make definitions consistent across product and finance, disagree-and-commit, and a credible real example.

## STR-L5-05

**What a strong answer contains.**
- **First week**: inventory every script, its inputs, outputs, schedule, credentials and the machine it runs on; get all of them into version control as they are; record the next close's run with the engineer (screen-share, notes), producing a runbook; identify which steps are manual and which outputs finance books.
- **Second week**: a second engineer reruns last month's close from the runbook on archived inputs, without help, and compares outputs to what finance booked. Differences are investigated with the original engineer while they are available (a mismatch can reveal an undocumented manual step or a hidden dependency). Move execution off the laptop to a scheduled, logged environment.
- **Next close**: the second engineer runs it, the original engineer observes; finance signs off as usual.
- **Following months**: golden tests from several historical closes; refactor and harden the riskiest scripts; logging and alerts; decide on replacement only when the system is understood and tested, then run old and new in parallel for at least one close with entry-level comparison.
- **Getting time**: quantify the risk in business terms (a slipped close, audit findings on unexplained adjustments, the engineer's well-being, the cost of an outside contractor if it fails); propose a small, time-boxed slice of capacity; if still refused, document the risk and its owner, and escalate.
- **The engineer**: their knowledge is an asset, not a fault; credit them publicly, involve them in the design of the replacement, protect their time and health.
- **Real example**: debt with real operational risk, reduced in measurable steps (number of people able to run it, time to recover, incidents), with the candidate's own role clear.

**Red flags.** Starting with a rewrite before the next close is safe; documentation nobody tests; treating the engineer as the problem; no business case for time; changing scripts without a test oracle.

**Rubric anchors.** 2: "write documentation" or "rewrite in the new platform". 3: inventory, version control, runbook, shadow run by another engineer before the next close, historical outputs as tests. 4: also a quantified business case, a respectful plan for the engineer, staged hardening and parallel-run replacement, and a credible, measured real example.
