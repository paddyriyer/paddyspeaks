# MongoDB · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These are not a description of any company's hiring process, and no company's
published values are the rubric; the rubric is the evidence below.

## MDB-L5-01

**What a strong answer contains.**
- **First days: confirm and quantify**: pull a sample of the raw records behind the headline number ({{case}}) and classify them; recompute the last quarters with the gamed cases counted honestly (reopened tickets joined to their originals, alerts evaluated at the original thresholds, accepted suggestions checked for later index use). Know how much of the improvement is real before saying anything.
- **Own their part**: they reported the number for two quarters without looking underneath; they say so to their manager and to the team.
- **With the team**: start privately with the two who built the metric, as a conversation about what the number now rewards, not about who did what; then the whole team, framed as "the target taught us the wrong thing". Invite the team to design the replacement.
- **Replacement**: a small set of measures that pull against each other and tie to customer outcomes, such as repeat escalations within 30 days, time to a confirmed fix (customer-verified or measured latency improvement), alert precision (share of alerts that led to action), and index suggestions measured by later use and latency change. Keep a regular review of raw cases (a handful each week), and say how each new measure could be gamed and what would catch it.
- **Upward**: tell the manager and the director before the next report, with the corrected history, the reason, and the new measures, so the coming drop is expected and understood.
- **People**: for engineers whose goals or promotion cases cite the old number, make sure their real contribution is described in outcome terms and that they are not penalised for doing what the target rewarded.
- **Real example**: a metric that drifted from its purpose, how they noticed, what they changed, and the outcome.

**Red flags.** Naming and shaming individuals; quietly changing the definition so the trend still looks good; replacing one gameable number with another without any cross-check; hiding the corrected history from leadership; a real example where the candidate only noticed and did nothing.

**Rubric anchors.** 2: "change the metric" without quantifying, owning or communicating. 3: quantifies the real improvement, raises it without blame, replaces with balanced outcome measures, informs leadership early. 4: also owns their own part, protects people whose goals relied on the old number, builds in review of raw cases and anticipates gaming of the new measures, and gives a credible real example with lessons.

## MDB-L5-02

**What a strong answer contains.**
- **Check the case, once**: a short written summary of their argument and the evidence, shared with the manager to confirm it was understood, plus anything genuinely new (data, a customer case). Ask what the manager is weighing that they cannot see. Not a campaign to reverse the decision.
- **Judgement call versus must-escalate**: this is a judgement about risk and value inside the manager's authority, so they commit. They say what would be different (data loss for customers, a legal or safety issue, misleading customers), in which case they would escalate openly, telling the manager first.
- **To the two engineers**: honest and loyal at once: "I argued for a different option; the decision was made with reasons I understand; here is how we make it succeed and how we will watch the risk." No hinting that the decision is foolish.
- **Executing well**: plan the work properly; reduce the risk they raised through how it is carried out: for weekly restore drills, targeting daily drills at the highest-risk tiers or the most recently changed backup paths; for the schema-migration tool, staged rollout with abort criteria and monitoring of failure rates; for the profiling deprecation, a migration path and direct outreach to the heaviest users. Agree with the manager, in advance, the measure and threshold that would reopen the decision.
- **Evidence either way**: report early data whether it supports them or not, and update their own view when it shows they were wrong.
- **Real example**: a decision they opposed and carried out, what they did, how it turned out against their prediction, and what they learned about their own judgement.

**Red flags.** Relitigating repeatedly; complying while signalling to the team that the decision is wrong; slow-walking the work; escalating behind the manager's back; "I just do what I'm told"; a real example where the candidate turned out right and the lesson is only that.

**Rubric anchors.** 2: either reopens the decision repeatedly or complies silently with no risk management. 3: checks the case was understood, commits, communicates honestly to the team, executes with the risk monitored. 4: also a clear line between judgement calls and must-escalate issues, an agreed trigger to revisit, reporting evidence both ways, and a credible real example with self-aware lessons.

## MDB-L5-03

**What a strong answer contains.**
- **Diagnose before drawing boxes**: list the systems in {{areas}}, the last two quarters' changes (which code changed together), incidents and customer escalations, and who was involved in each. The symptom ({{symptom}}) is evidence of coordination cost; confirm it with data (meeting load, cross-area reviews, on-call breadth).
- **Boundaries**: cut where changes rarely need two teams, often by lifecycle or component (for example backup and restore versus replication and upgrades). Test candidate boundaries against past work: count how many past projects and incidents would have crossed the boundary, and prefer the cut with the fewest. Name tightly coupled systems and give them a single owner with clear contribution rules for the other teams.
- **Ownership transfer**: every system, runbook, dashboard, alert and customer escalation path has exactly one owning team, written down. The unloved, frequently paging component gets an owner and an explicit investment (reduce paging, pair the single expert with two others, document).
- **On-call**: a transition period with shadow rotations, overlap and named escalation contacts, so no system is thinly covered; on-call breadth per person should fall.
- **People**: ask preferences, explain the criteria, place for balance of seniority and skills; choose leads on demonstrated leadership with the manager; for the person not chosen, a real conversation and a concrete growth path.
- **Communication**: reasons first, then the proposal, then time for questions; announce to partner teams who to contact for what.
- **Success measures set in advance**: cross-team dependencies per project, lead time, on-call pages per person, onboarding time for new engineers, decision participation, retention; a review at three and six months with willingness to adjust.
- **Real example**: an organisational change they led or shaped, with what they personally did and what happened.

**Red flags.** Splitting by headcount or seniority without looking at the work; leaving shared or unloved systems with no owner; switching on-call overnight; a reorganisation announced without reasons; no way to tell whether it worked.

**Rubric anchors.** 2: "split into two teams of seven" with no boundary reasoning. 3: evidence-based boundaries tested on past work, single ownership, an on-call transition, fair placement and clear communication. 4: also explicit handling of the coupled and unloved systems and the single expert, success measures defined in advance with a review, and a credible real example with lessons.

## MDB-L5-04

**What a strong answer contains.**
- **First day**: facts to account teams and leadership quickly: the date is missed, the honest cause ({{cause}}), what customers can do now, and when the next update comes. Own the miss, including that warning signs were seen a month earlier and not raised outside the team.
- **New date**: give a range with its dependencies and a stated confidence, not a single hopeful date; publish only when the remaining unknowns are understood (for data-loss bugs, after the fix is proven under failover testing). Update on a known schedule even when nothing changed.
- **Customers**: direct conversations with the customers who planned around the date, with account teams; workarounds; a limited preview only if the safety evidence supports it, with clear terms; never ship a known data-loss risk to hit a date.
- **Practice changes**: estimates with explicit confidence and the assumptions they rest on; a rule that a date risk is raised outside the team as soon as confidence drops below an agreed level; dependency tracking with escalation triggers; a public date only after design is understood.
- **Rebuilding trust**: a run of smaller commitments kept and visibly reported; a retrospective shared with stakeholders; no padding of everything, which only moves the problem.
- **Real example**: a missed commitment others relied on, how they communicated, what they changed, and how long it took for trust to return.

**Red flags.** Blaming the dependency team or product leadership; a new date given to soothe people; shipping something unsafe to recover face; silence until the new date is certain; a real example with no personal accountability.

**Rubric anchors.** 2: apologises and picks a new date. 3: owns the miss, communicates quickly and honestly, gives a range with dependencies, supports affected customers, changes how risks are raised. 4: also explicit handling of the month of unraised warning signs, safety-first reasoning on a preview, trust rebuilt through kept small commitments, and a credible real example with lessons.

## MDB-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (data size, operations per second, peak to average, latency or freshness targets, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, the entities, their access patterns and keys, and how schema changes were handled; for the hardest failure, the symptom, diagnosis path, root cause, fix and prevention; for the decision to undo, the original reasoning, what was missed, and the cost of undoing it.
- **As a replicated, sharded document database at {{scale}} with {{requirement}}**: starts from access patterns: what is read together (embed), what grows without bound or is shared (reference), and what key spreads writes evenly. For records whose shape varies and changes: a schema-version field, validation rules on required fields, migrate-on-read or backfill, and indexes on the common fields. For surviving a region: majority write concern with members placed so no region holds a majority of votes, and an honest latency cost. For outgrowing one machine: a shard key with high cardinality and even write distribution, chosen from the real queries so most are targeted to one shard, with a view on hot customers. For replica reads that never go backwards: causally consistent sessions or primary reads, and why reading any secondary does not give that. Accept other sound answers that fit their system.
- **Honesty**: what failed, what they would change, what was the team's versus theirs.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys, access patterns or failure modes does not.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; a document-database answer that embeds everything, ignores unbounded growth, or assumes reads from any replica are always current.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, access-pattern-driven document design. 4: also alternatives with evidence, an incremental and correct path to {{requirement}} with its costs stated, crisp separation of own and team contributions, and lessons that show changed practice.
