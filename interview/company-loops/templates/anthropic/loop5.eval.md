# Anthropic · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.

## ANT-L5-01

**What a strong answer contains.**
- **First hour**: thank the engineer and protect them; reproduce the finding with a second person on a time-box of a few hours (rerun the faulty step and the fixed one on the same inputs, compare counts: test cases in, test cases scored, per category). In parallel, tell the release owners and the safety lead privately and early: "we found a possible error in the safety summary for the shipped version; we are verifying; next update at a stated time". Do not wait for certainty to give notice; do not announce a corrected number before it is verified.
- **First days**: publish the corrected result as a new, linked version (never overwrite), with the size of the change, its confidence interval and the exact cause, in plain words. Give the release owners what they need to decide: corrected score, uncertainty, which test categories moved, how the previous version compares on the same corrected pipeline (rerun the baseline too, so the comparison is fair). Present facts without steering; offer to walk them through. Start lineage: every suite and every report that passed through the faulty step, with which decisions they fed.
- **Following weeks**: recompute affected suites, prioritised by the decisions they supported (shipped releases first, then pending reviews, then research-only results). A blameless review: why the step could drop or collapse rows silently, and why nothing noticed. Prevention: invariants at each stage (rows in = rows scored, no duplicate test case ids, denominators by category compared with the suite manifest), failing the run rather than warning; a golden suite with planted edge cases (missing grader output, shared prefixes, multi-turn cases) run on every pipeline change; an owner for each check and evidence it ran.
- **Communication**: who hears what and from whom (release owners and safety leads directly from the candidate; wider audiences through the owners); written, factual, with next update times.
- **Real example**: a number the candidate's team produced that someone acted on, the candidate's own actions (how they verified, who they told, how fast), the measured impact and the check they added.

**Red flags.** Fixing silently; announcing before verifying, or waiting days to tell anyone; recommending a rollback as if it were their decision; overwriting the published result; blaming the engineer; prevention that is "be more careful" or "more code review".

**Rubric anchors.** 2: technical fix only, no disclosure plan. 3: time-boxed verification, early notice to owners, corrected linked version with uncertainty, lineage-based blast radius, invariants added. 4: also fair baseline rerun, prioritised recomputation by decision impact, blameless handling of the engineer, owned and tested checks, and a credible, evidence-backed real example.

## ANT-L5-02

**What a strong answer contains.**
- **First week**: from usage metadata, segment the remaining traffic: by organisation (concentration curve: how many organisations hold 80% of it), by feature use (tool use, caching, batch, long outputs, structured outputs where visible from request metadata), by trend (who is already moving). Join with customer-facing teams' list of named blockers. Agree a weekly progress metric with programme owners (for example share of the original traffic still on the old version, plus the number of organisations above a traffic floor), defined so a customer splitting traffic between versions still counts correctly.
- **Testing the blocker**: turn each reported pattern into a testable claim ("strict JSON outputs fail schema validation more often on the new version"), test it on public or synthetic evaluation sets built to mimic the pattern, and on examples customers choose to share under an agreed process. Report per pattern: reproduced or not, size of effect, workaround available (prompt change, tool definition change, a parameter). Hand reproduced issues to model teams with clear repro cases.
- **Working with others**: customer-facing teams own the conversations; the data team supplies per-customer evidence packs (their usage mix, which blocker patterns their metadata suggests, workarounds); model teams get prioritised repro cases; leadership gets a weekly one-page status with the metric, the top organisations and the blocker evidence.
- **Recommendation on the date**: weigh evidence (how much remaining traffic is blocked by a reproduced issue versus inertia), cost of extending (operating an old version, signalling that dates move, unfairness to customers who moved), and cost of holding (customers broken). Options include holding the date with targeted extensions for named organisations with reproduced blockers, if the policy allows, rather than a blanket delay. Present options with consequences and let product leadership decide.
- **Real example**: a migration or deprecation with a measured adoption curve, the candidate's own role in the evidence or plan, and what they would change.

**Red flags.** Proposing to read customer prompts; treating all remaining tenants the same; a progress metric that is easy to game (number of organisations "contacted"); recommending a blanket extension without evidence; deciding the date themselves.

**Rubric anchors.** 2: generic project management, no data plan. 3: segmentation and concentration, testable blocker claims measured without content, an agreed progress metric, clear decision rights. 4: also per-tenant evidence packs, a recommendation that weighs fairness and cost of delay with targeted options, model-team repro handoff, and a credible real example with measurable outcome.

## ANT-L5-03

**What a strong answer contains.**
- **Evidence first**: trace the tickets with request ids through gateway and server records; characterise what happened (long wait before first visible content, long pauses mid-stream, streams ending without completion). Then measure the same symptoms across all traffic for a few weeks from the gateway's event send times. Show why the official metric missed them (a median or mean ignores the tail; server-side timing excludes gateway and network; excluding errored requests hides the worst experiences; time to first token is not time to the first content the customer sees).
- **Agreeing what "slow" means**: a short written proposal of candidate metrics with definitions: time to first visible content at the gateway, longest pause between content events per stream, share of streams ending without completion, and the same per customer (share of customers whose worst-5% experience breaches a threshold). Each team reviews the definitions for its segment; the objective's owners decide.
- **Changing the official metric**: run old and new side by side for a period; publish a translation ("last quarter under the new definition would have been…"); be candid that the objective was missed under a definition that better reflects customers, without blaming teams; set a realistic new target with a plan. Tie the new metric to the tickets so leadership sees it predicts customer pain.
- **Making it stick**: metric definitions owned by the data team and versioned; per-segment breakdowns so each team sees its share; reviews of the metric against tickets every quarter to catch drift.
- **Real example**: a metric the candidate changed, the resistance, how they won agreement (data, side-by-side runs, alignment with customer outcomes) and what changed in behaviour.

**Red flags.** Changing the metric unilaterally; blaming a team or "the network" without evidence; hiding the historical miss; replacing one aggregate with another without checking it against the tickets; percentiles of requests only, never of customers.

**Rubric anchors.** 2: "add p99" with no evidence or process. 3: traced tickets, customer-grounded definitions, side-by-side run, decision by the objective's owners. 4: also per-customer measures, candid communication of the historical miss with a plan, anti-gaming guardrails and periodic validation against tickets, and a credible real example.

## ANT-L5-04

**What a strong answer contains.**
- **Urgent part first**: if the trigger touches what may be logged (tool arguments), stop it at the producer immediately with a field allow-list, then deal with what is already stored per policy (deletion, access review). Otherwise, ship the minimum change the trigger needs in a backward-compatible way (additive fields), so the structural work is not rushed.
- **Inventory**: consumers from table and topic access logs over a long enough window (including monthly jobs), mapped to owners; classify by criticality and by the fields they read.
- **Structural change**: a typed, versioned schema (for example in a schema registry) with a data contract: field meanings, types, nullability, compatibility rules (additive changes allowed, removals and type changes need a new major version), checked in CI on the producer side; the producing team owns approval. A v2 stream or table runs beside v1 with a field-by-field mapping, a published end date, and usage monitoring per field so the last reader of each old field is known before removal.
- **People and time**: make the case with the cost of the last quarter's {{breakages}} breakages (hours lost, wrong numbers shipped); offer migration help (a compatibility view, pull requests to the biggest consumers); escalate only with options. Orphaned consumers: notify, then archive or break with notice after a deadline, approved by their parent org. Holdouts: a compatibility view for a limited time, with its cost visible.
- **Real example**: technical debt with many consumers, how breakage or toil was measured before and after, the candidate's own role.

**Red flags.** Big-bang switch; removing fields without usage evidence; leaving a privacy-relevant logging issue until the migration; contracts without enforcement; assuming consumers will read an announcement.

**Rubric anchors.** 2: "write documentation" or another patch. 3: urgent fix first, consumers from access logs, typed versioned schema with contract and CI checks, parallel run with a dated end. 4: also per-field usage monitoring before removal, a plan for orphans and holdouts, a concrete business case from breakage costs, and a credible measured real example.

## ANT-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change (schema evolution, late or corrected data) and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for cost or performance, the baseline, the analysis, the change, the measured result and the trade-off accepted.
- **Scaling to {{scale}}**: names the first component to break (a hot partition, a single-writer database, a nightly batch window, an index that no longer fits in memory), with a reason grounded in their numbers, and a change that addresses it incrementally.
- **The tenant feature**: for cost attribution per workspace and key, attribution as of request time, versioned prices, idempotent usage records and reconciliation with invoices; for limits per organisation and workspace, a fast approximate counter separated from an exact ledger with a stated overshoot; for per-tenant retention, retention as a property of data at write time, per-tenant partitioning or encryption keys, and verified deletion. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a scaling answer of "add more nodes" with no bottleneck named.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a named first bottleneck. 4: also alternatives with evidence, an incremental and correct path to the tenant feature, crisp separation of own and team contributions, and lessons that show changed practice.
