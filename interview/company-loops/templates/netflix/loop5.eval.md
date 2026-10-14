# Netflix · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a streaming-service
data setting; score them on the rubric below, not on any company's published
culture document, values or interview process, and do not reward an answer for
reciting one.

## NFX-L5-01

**What a strong answer contains.**
- **Evidence first**: analyse the review tickets: how many changes, how many rejected or changed, and why; which rejections would have caused real harm (a broken downstream report, exposed identifiers, a wrong metric) versus style or preference; how long each step waited. Find near misses the gate caught that resemble the original incident. Count and inspect the workarounds: copies made outside the gate are risk the gate no longer covers.
- **Replace each protection, do not just delete it**: for the original failure mode, an automated check in the change pipeline (schema compatibility and downstream-usage checks from lineage for schema changes; automatic detection and blocking of identifier fields and storage without required protections for new pipelines; metric definitions as code with tests, sign conventions and review by the metric owner for experiment metrics). Audits after the fact for lower-risk cases. Human review kept for a narrow, named set of changes (for example removing columns used by published numbers, or anything touching device identifiers).
- **Rollout**: a pilot with a few teams, measured against the gate's historical catch rate and incident rate, with stop criteria; then wider; a documented way to restore review for a category if the checks miss things.
- **People**: involve the reviewers in writing the checks, especially the one who built the gate; credit what the gate achieved; give them ownership of the narrow review that remains. Tell waiting teams what changes, when and what they must now do themselves.
- **Workarounds**: bring the existing copies under the new checks or retire them, with dates and owners.
- **Incident after the change**: run it blamelessly, ask whether the old gate would actually have caught it (check the evidence), fix the check that missed it, and restore human review only for that category if needed; avoid reinstating the whole gate on one incident, and avoid ignoring it.
- **Real example**: a process or control the candidate removed or simplified, how they measured what it did before and after, what they replaced it with, and the outcome.

**Red flags.** Removing the gate because it is slow, without knowing what it catches; treating the reviewers as the obstacle; "trust the teams" with no replacement check; ignoring the workarounds; reinstating everything at the first incident; reciting a company's published culture statements instead of reasoning about this control.

**Rubric anchors.** 2: "remove it and let teams own quality", or "keep it, it's there for a reason". 3: analyses what the gate catches, replaces the key protection with an automated check, pilots with stop criteria, involves the reviewers. 4: also handles the workarounds, keeps a narrow human review where evidence supports it, defines the post-change incident response in advance, measures outcomes against the gate's history, and gives a credible real example.

## NFX-L5-02

**What a strong answer contains.**
- **First two weeks**: one-on-ones with every engineer (what went wrong, what they would protect, what they want to work on, what worries them), conversations with the main stakeholders including the one who built a workaround, and a read of the written history of both projects (plans, scope changes, decision records). Keep the running pipelines healthy; look at on-call load and the worst sources of reactive work.
- **Diagnosis**: an honest account of the cancellations that separates causes inside the team's control (estimates, scope growth, no intermediate deliveries) from those outside it (priority changes). Test the director's "over-engineering" view against evidence rather than adopting or rejecting it.
- **Next commitment**: small enough to finish in the stated months, valuable enough that a stakeholder would notice its absence, delivered in increments, agreed in writing with the people who could cancel it, with a process for priority changes (what is traded off, who decides). Often one piece of what the cancelled projects promised, which the stakeholder still needs.
- **Reactive load**: reduce it deliberately (fix the top recurring failures, clarify request intake) so there is capacity for the commitment.
- **People**: talk early with the at-risk engineers about what would make the work worth staying for; give the strong seniors real ownership; raise the team's own part in the cancellations honestly and without blame, framed as changes to how the team commits.
- **Measures**: milestones delivered on time, stakeholder confidence (do they bring work to the team again), on-call pages and toil, retention and engagement signals.
- **Real example**: a team or project the candidate took over in trouble, what they found, what they changed, and the measurable result.

**Red flags.** Announcing a new grand plan in week one; blaming the previous lead or the stakeholders entirely; ignoring the team's own contribution; a "quick win" nobody outside the team values; no plan for the engineers at risk of leaving.

**Rubric anchors.** 2: generic team-building, no diagnosis. 3: listens first, diagnoses the cancellations with evidence, picks a small agreed commitment, reduces reactive load. 4: also a written change process with stakeholders, honest handling of the team's contribution, deliberate retention of strong engineers, measures beyond self-report, and a credible real example.

## NFX-L5-03

**What a strong answer contains.**
- **Evidence**: review turnaround by reviewer, rejection reasons classified as correctness, safety or preference, who is affected and how (engineers avoiding the codebase, a new hire's progress). Confirm the defects their reviews caught; the quality is real and must survive any change.
- **First conversation**: private, early and specific: describe the observed impact with examples, not character judgements; ask what they are worried about; listen for real risks (fragile parts of the pipeline, missing tests) that justify strictness. Agree on concrete changes together.
- **Within the candidate's role**: as manager, set expectations, include review behaviour in feedback and follow up; as tech lead, change team review practice and coach directly; as a peer on another team, raise it with the engineer first, then with their lead or manager with evidence, and offer help (shared standards, design reviews).
- **Process**: write down the standards (what blocks a merge versus what is a suggestion), design discussion before large changes, review ownership shared with a second qualified reviewer, and the senior engineer's time spent where their expertise matters most (critical paths, mentoring) rather than on every change. Add tests and checks that encode what they look for.
- **Affected engineers**: pair them with the senior engineer on design, recognise their progress, and make sure the new hire gets a clear path.
- **If nothing changes**: with clear prior feedback and documented impact, a formal step appropriate to the role, while reducing single-person dependency on the codebase.
- **Real example**: a colleague whose behaviour slowed others, what the candidate did, what changed, and what the candidate learned about their own approach.

**Red flags.** Going straight to HR or a formal process; dismissing the quality concerns; solving it by removing the engineer from reviews without a conversation; acting outside their role's authority; labelling the person rather than describing behaviour.

**Rubric anchors.** 2: "talk to their manager" or "remove them from reviews". 3: gathers evidence, holds a specific private conversation, writes standards and shares review ownership while keeping the bar. 4: also acts precisely within the stated role, listens for and addresses the real risks the engineer sees, supports the affected engineers, has a clear next step if nothing changes, and gives a credible real example with self-reflection.

## NFX-L5-04

**What a strong answer contains.**
- **Immediate trigger**: a short, separate path: backport the security fix to the fork with tests, or a targeted upgrade; find the patch knowledge before it disappears (review commits, talk to the departed engineer's collaborators); for a needed feature, a time-boxed spike to see whether the conflicting patches can be dropped.
- **Inventory**: every patch classified as already fixed upstream, contributable, replaceable with configuration or a plugin through public extension points, or truly local. Find the teams relying on behaviour changes by searching job configurations and by running their workloads, not by asking only.
- **Options with costs**: the ongoing cost of the fork (engineer time to rebase and backport, delayed security fixes, features unavailable), the one-time cost of each migration path, and the risk of each. A strong candidate quantifies roughly: hours per upstream release to rebase, number of patches remaining after classification.
- **Upstream**: engage maintainers early through the project's normal channels (issues, design discussions), contribute small, well-tested changes that fit the project's direction, and plan for months and for rejection; reshape rejected patches into extensions or carry them knowingly.
- **Proof of equivalence**: shadow-run or replay production jobs on the new version, compare outputs (row counts, checksums, metrics) and performance, with blocking criteria agreed in advance; switch gradually with a rollback path.
- **Decision**: usually converge on upstream with the smallest remaining local set, or move to the managed offering if the remaining patches fit its extension points; the candidate should defend the choice with the numbers.
- **Real example**: a fork, build or adopt decision about a dependency, what it cost and whether they would make it again.

**Red flags.** "Always contribute upstream" or "never fork" as dogma; deciding the long-term direction in the heat of the security fix; underestimating the time upstream acceptance takes; switching without equivalence testing; surprising teams that rely on undocumented behaviour.

**Rubric anchors.** 2: picks an option on principle with no inventory or test plan. 3: handles the trigger separately, classifies patches, compares options with rough costs, shadow-runs before switching. 4: also a concrete upstream engagement plan with fallbacks, discovers hidden dependents systematically, explicit blocking criteria and gradual switch, numbers behind the recommendation, and a credible real example.

## NFX-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change and late or corrected data, and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for reliability, the failure being guarded against, the mechanism, how it was tested and what it cost.
- **Going global in {{regions}} regions**: places each kind of state (append-only events, mutable member state, aggregates, reference data) in a region or replicated, with a stated consistency model and failover behaviour; names the first thing that would break.
- **The global feature**: for local-day numbers, event time converted to each country's local date, a per-country finalisation time and a restatement policy for late data; for regional data residency, routing by country at write time, keeping identifiable data in region with only aggregates leaving, and auditability; for failover without loss or double counting, durable acknowledgement, idempotent event ids and replay; for a simultaneous launch, pre-positioned data, feature flags keyed on an instant, load tests per region and a rollback. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; "replicate everything everywhere" with no consistency or cost reasoning; time zones ignored.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a reasoned placement of state across regions. 4: also alternatives with evidence, explicit failover and time-zone handling, an incremental and correct path to the global feature, crisp separation of own and team contributions, and lessons that show changed practice.
