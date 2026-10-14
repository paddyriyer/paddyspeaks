# Spotify · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in an audio streaming
setting; score them on the rubric below, never on any company's published values,
culture or interview process.

## SPT-L5-01

**What a strong answer contains.**
- **First hour**: acknowledge the request quickly and do not promise anything; ask what the requester is trying to achieve (reach fans before a tour, understand who finishes episodes, plan releases), how they would use the data, and how often.
- **First days**: map the goal to what the aggregation rule allows: counts of listeners by city or region above {{minimum}}, age-band and completion trends at cohort level, in-product tools that let the requester reach listeners without receiving identities (for example announcements shown to their own followers), or an opt-in feature as a proposal. Check with the privacy or legal owners, bringing options rather than only the request. Recognise that a "hashed" listener id per play is still personal data and enables profiling.
- **Saying no**: early, clearly, in writing, with the reason (the rule protects listeners, not a preference of the team) and the alternatives; not hiding behind process or blaming the partnerships lead. Address the pressure through the right people: talk privately to the partnerships lead, then, if needed, take the decision to whoever owns the rule with both cases written fairly.
- **Differencing**: two breakdowns that each pass the minimum can reveal a small group by subtraction; offer fixed ranges, coarser cells or suppression of complements.
- **Next time**: write down the policy and a menu of what can be shared, so requests get the same answer; propose a product feature if demand is real.
- **Real example**: a real request they refused or reshaped, with what they said, who they involved, what was offered, and the relationship afterwards.

**Red flags.** Providing the data because someone senior said yes; pseudonymisation presented as anonymisation; a flat no with no alternative; treating the requester as an adversary; inventing policy on the spot; a story where they personally overrode a privacy rule.

**Rubric anchors.** 2: complies with the request, or refuses without understanding the need. 3: understands the goal, offers aggregate alternatives, involves the rule owners, says no clearly and kindly. 4: also handles the pressure through the right decision makers, recognises pseudonymisation and differencing risks, turns the repeat request into policy or a product proposal, and gives a credible real example.

## SPT-L5-02

**What a strong answer contains.**
- **First week**: sit with the builders, run the prototype, read the code, list its data sources and shortcuts ({{shortcut}}), and estimate at full scale: data volume, freshness, cost, failure handling, markets, privacy review, load test, on-call. End the week with a one-page estimate and options.
- **With the sponsor ({{sponsor}})**: lead with what is good about the idea, then the real work as a list, then options: a smaller launch on the date (fewer markets, lower freshness, a beta audience, a feature flag) or the full launch later, each with risks. Ask for what would change the date (people, scope). No "the demo was fake"; no promises the team cannot keep.
- **Keeping the idea, not the shortcut**: for example a minute-fresh view built from a streaming aggregate rather than polling a production replica; a scheduled job on managed infrastructure, not a laptop; tests and market configuration from data, not hard-coded lists.
- **Ownership**: a named owning team and on-call before launch; runbooks; a cost budget.
- **Data and privacy**: listening history is personal data; privacy review early, minimise what is read and stored, aggregates for anything shown beyond the listener.
- **People**: keep the builders involved and credited; protect the team's existing commitments by trading scope explicitly.
- **Real example**: a real move from prototype to production (or a decision not to ship), with the estimate versus reality, cost, incidents and what they changed.

**Red flags.** Saying yes to the date without investigation; shipping the shortcut; a full rewrite announced before understanding the prototype; no owner after launch; ignoring privacy review because "it's already built".

**Rubric anchors.** 2: ships the prototype as is, or refuses without options. 3: investigates, produces an estimate, offers a smaller launch, removes unsafe shortcuts, names an owner. 4: also preserves the core idea with a production-grade equivalent, handles privacy and cost explicitly, keeps builders engaged, and gives a credible real example with numbers.

## SPT-L5-03

**What a strong answer contains.**
- **First week**: one-to-ones with every team member, starting with the person most affected ({{context}}); acknowledge the change openly, ask what they need, and agree how to work together. Agree the boundary with the engineering manager (people matters versus technical direction) and tell the team.
- **First month**: listen and learn the state of {{owns}} through the team's eyes; act on the urgent issue ({{issue}}) with a visible process: options, criteria, input, the decision, who owns follow-through. For on-call imbalance: rebalance with training and shadowing; for a rewrite dispute: a written decision with evidence and a time box; for a stakeholder bypassing the team: agree an intake path with the stakeholder and the manager, and protect individual engineers.
- **Challenge from a former peer**: private conversation first, curiosity about the substance, separate disagreement from undermining, involve the manager only if it persists.
- **Letting go**: stop being the default fixer; delegate the work they were best at, with support; keep a small, non-critical hands-on area.
- **Signals it works**: feedback from the team and manager, delivery and on-call load, decisions sticking, nobody leaving unexpectedly.
- **Real example**: a real transition or peer-leadership situation with mistakes made and how they found out.

**Red flags.** Pretending nothing has changed; avoiding the peer who wanted the role; deciding everything personally to prove authority; taking over people-management matters; keeping all the critical work.

**Rubric anchors.** 2: generic "build trust" with no concrete steps, or authority by fiat. 3: early one-to-ones, agreed boundary with the manager, a visible decision process for the urgent issue, deliberate delegation. 4: also a thoughtful handling of the affected peer and of public challenge, measures of success, and a credible real example with honest mistakes.

## SPT-L5-04

**What a strong answer contains.**
- **First days**: an inventory of every commitment ({{commitments}}) and every running system of {{old_charter}}, with users, state, cost of stopping, cost of finishing, and possible receivers. Confirm with leadership what {{new_charter}} means in concrete outcomes.
- **Decisions per item**: finish (nearly done and others depend on it), stop (low value or easily replaced), or hand over (needed long term, belongs elsewhere), each in writing and agreed with the dependent team early and directly. Running systems get an interim owner immediately (the team keeps them in maintenance mode with a stated budget) until a handover with documentation, shadowing and an on-call transfer is complete.
- **New roadmap**: learn from users of {{new_charter}} and its data quickly; a concrete first-quarter plan with early, visible progress and a loose plan for the rest; check it with leadership before committing.
- **Communication**: the team first, honestly; dependent teams individually; leadership with trade-offs and asks (for example someone to own the old systems).
- **People**: one-to-ones; for those who joined for the old work, options (move with the old systems, grow into the new area, transfer) without pressure.
- **Real example**: a real direction change with what they stopped, who was affected, the outcome, and what they would change.

**Red flags.** Dropping commitments without telling dependents; leaving running systems ownerless; a detailed year-long roadmap for an area they barely know; ignoring morale; blaming leadership to the team.

**Rubric anchors.** 2: "follow the new charter" with no inventory or ownership plan. 3: inventory with per-item decisions, dependents consulted, interim ownership of old systems, a near-term plan for the new charter. 4: also checks the plan with leadership, concrete handover mechanics, individual care for people, and a credible real example.

## SPT-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, data size, freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model and keys, the entities, keys and why they were chosen, and how schema changes were handled; for the hardest failure, the symptom, the diagnosis path, the root cause, the fix and the prevention; for the decision to undo, the original reasoning, what changed or what was missed, and the cost of undoing it.
- **In the streaming setting with {{listeners}} of listeners and {{requirement}}**: for daily personalised plus minute-fresh editorial surfaces, separate a per-listener batch path from a low-latency editorial path and merge at serving time, with rules for conflicts (an editorial removal overrides a personalised item). For artist numbers matching yearly summaries, one versioned metric definition consumed by both pipelines and a reconciliation check before publishing. For late offline plays without silent chart changes, published charts as frozen versions, late plays flowing into restatements with notices, and a cut-off rule stated in advance. For counting a listener once across devices, a stable listener key and device-level dedup with clear rules for shared devices. Ranking stays a given scoring function. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned only part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; claims about how a real streaming company's recommendations or stream counting work.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a sensible approach to the requirement. 4: also alternatives with evidence, an incremental and correct path to the requirement with its costs stated, crisp separation of own and team contributions, and lessons that show changed practice.
