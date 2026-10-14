# LinkedIn · Loop 5 — evaluator notes (hidden from candidates)

Never supply or accept a model story. Judge a real example on evidence: a clear
situation, the candidate's own actions separated from the team's, a measurable
result, and what they learned. An honest "I have not faced this", followed by
sound reasoning, scores better than a story that falls apart under probing.
These templates test evidence-based technical leadership in a professional
network's setting of members, recruiters, creators and companies; score them on
the rubric below, never on any company's published values, culture or
interview process.

## LNK-L5-01

**What a strong answer contains.**
- **First conversation**: asks what problem the request solves (recruiters reaching people who want to be reached, better candidate lists, retention planning), how success would be measured, and why this means of solving it. Does not open with "no"; does not open with an estimate either.
- **Harm assessment, written down**: what happens when the inference is wrong (members contacted or judged on a false signal; a salary estimate that anchors an offer low), when it is right but seen by the wrong audience (the starkest case: an employer learning that its own employee may leave, which can cost that member their job), when it leaks, and whether members would expect it given what they chose to share. Notes that the member has a way to state some of this themselves, and that inferring it overrides their choice not to. A strong candidate recognises the employer-facing variant as the most harmful.
- **Decision rights**: product owns the product decision; privacy and legal review it; the candidate's role is to bring facts (what data it would use, accuracy, error cases, who sees it) and a recommendation. Involves them early, before engineering effort, and does not let a committed date substitute for the review.
- **Alternatives that serve the goal**: strengthen the member-stated signal (make it easier to state, with clear control over who sees it); let members opt in to being contacted for certain roles; give recruiters aggregate market information (for example how many members in a region state they are open to roles) rather than per-member inferences; for salary, use ranges from postings or member-reported data released as aggregates above a minimum count. For the employer-facing request, a strong answer declines the per-member flag outright and offers aggregate, anonymised retention insights only if those can be made safe.
- **Communication**: a short written position to the requester and their manager: the goal, the harms, the options and a recommendation, offered as a way to reach the goal rather than a veto. If the requester escalates, the candidate brings the same document and lets the decision-makers decide, making the member harm explicit.
- **Real example**: a request the candidate reshaped or declined, what they personally did, how they kept the relationship, and what shipped instead.

**How to judge.** Probe whether the candidate reasons about members, not only about legality. Reward specific alternatives that preserve the business goal. A candidate who says yes and adds a privacy notice, or who says no and stops there, has not done the job.

**Red flags.** "If legal approves, we build it"; hashing or "anonymising" as the answer to a per-member inference; refusing without understanding the goal; going around the requester to leadership without telling them; any suggestion of inferring protected traits.

**Rubric anchors.** 2: builds it with a notice, or refuses flatly. 3: understands the goal, assesses harm concretely including the wrong audience, involves the owners with facts, proposes a member-choice alternative. 4: also recognises the employer-facing case as the most harmful, offers aggregate options for planning goals, writes a fair position that survives escalation, and gives a credible real example with the relationship intact.

## LNK-L5-02

**What a strong answer contains.**
- **Before acting**: specific, recent examples (dates, pull requests, incidents, estimates), checked first-hand rather than taken from the complaining teammate; a look at whether anything changed around the engineer (new area, new manager, larger scope, unclear expectations). Does not speculate about personal causes.
- **First conversation (private, soon)**: names the observation with examples, says why it matters, then asks: "How are things from your side? What is getting in the way?" Listens. Agrees on what good looks like for the next few weeks (for example review comments addressed in one round, incident hand-offs with a checklist, estimates revisited at the midpoint), what support is available (pairing, smaller tasks, clearer specs, time), and a check-in date. If the candidate is the tech lead rather than the manager, they coordinate with the manager before or right after, and keep to technical feedback and support; performance management stays with the manager.
- **Personal circumstances**: if the engineer shares something personal, the candidate does not probe for details, offers the support available (time off, reduced scope for a period, people-team resources) through the manager, and still keeps clear expectations with an adjusted timeline.
- **The team and the commitment**: re-plans the commitment privately (pairing, moving a piece of work) without announcing why; tells the complaining teammate that it is being handled, without sharing details, and asks them to bring concrete issues directly.
- **If no improvement**: documents expectations and progress factually; the manager involves the people team and the formal process as a later step, with the engineer told plainly where they stand. No surprises.
- **Real example**: someone the candidate helped, what they did and said, the outcome (which may be that the person moved on), and what they learned.

**How to judge.** Ask for the exact words of the first piece of feedback. Strong candidates are both kind and clear; weak ones are one or the other. Check that a tech lead does not claim a manager's authority, and that a manager does not skip the conversation and go straight to process.

**Red flags.** Discussing the engineer with the team; going straight to a formal process; quietly taking work away without telling them; guessing at health or family causes; letting it drift for months; vague feedback ("be more proactive").

**Rubric anchors.** 2: avoids the conversation, or escalates straight to formal process. 3: evidence first, a private, direct and respectful conversation that asks before telling, clear expectations with support and a check-in, the team protected without exposure. 4: also handles personal circumstances well, acts precisely within their role, documents fairly with no surprises, and gives a credible real example with lessons.

## LNK-L5-03

**What a strong answer contains.**
- **Make it checkable**: the measurement or analysis, the assumption it rests on, and the result that would prove it wrong; ideally a quick test that removes the main assumption (for example a load test at the expected peak, a lineage check listing every store that holds member data, a migration rate measured on a real batch). Asks a trusted peer to challenge it.
- **Options with costs**: reduce scope, add people, move the date, ship with a mitigation (for example a feature flag, a staged rollout, a manual process for the missing stores); a recommendation; what each costs the teams that depend on the date.
- **Second conversation with the manager**: one-to-one, a short written summary, acknowledges the manager's pressure (they told leadership it was on track, or they want solutions), frames it as protecting them from a surprise, and asks for a decision by a date.
- **Risk to members is different**: the privacy-export variant is not a date risk; it means member requests are not fully honoured. The candidate says that clearly and does not accept silence: it goes to the privacy owner promptly, with the manager informed.
- **If the manager still declines**: says plainly that they will raise it in the status review or with the skip-level and why, invites the manager to present it together, and does so through a legitimate forum, not a hallway. Writes it down factually so the decision is informed, not to cover themselves.
- **After**: supports the decision if it is within the manager's authority and does not harm members; if the risk materialises, focuses on the response, not on "I told you".
- **Real example**: a time the candidate raised an unwelcome risk upward, how, with what evidence, what happened, and the state of the relationship afterwards.

**How to judge.** Look for evidence, options and transparency. A strong candidate never goes over their manager's head without telling them, and never sits on a risk to members.

**Red flags.** Staying silent because the manager said so; escalating secretly; bringing only a problem; treating a privacy gap as a scheduling issue; "I told you so" afterwards; a written record designed to assign blame.

**Rubric anchors.** 2: complains, or stays silent. 3: concrete evidence with stated assumptions, options with a recommendation, a constructive second conversation, transparent escalation if needed. 4: also distinguishes member harm from date risk and acts accordingly, involves the manager in any escalation, writes it down to inform, supports the outcome, and gives a credible real example with the relationship intact.

## LNK-L5-04

**What a strong answer contains.**
- **Cost of pausing**: what the unfinished work protects, made concrete: for the deletion migration, members whose deletions do not reach every table (a privacy obligation, not a nice-to-have); for the ingestion pipeline, weekly pages and the risk of a long outage of job ingestion; for the backfill, reports that mislead readers. Plus the cost of a half-done state: two systems to run, partly migrated data, knowledge that fades. A strong candidate recognises that some unfinished work (deletion) is close to non-negotiable.
- **Test the new project's need**: what must exist by the demo date versus what is wished for; whether a small team (two or three people) can deliver the demo while the rest finish.
- **Options**: finish first with a firm date and then move; a split team with explicit priorities; hand the unfinished work to another team with a proper hand-off; take the new project and pause the old one only after reaching a safe stopping point. Each with costs and risks.
- **Communicating up**: a clear recommendation to the sponsors with evidence, presented as how to get the new project done well, not as a refusal; agreed priorities written down, so when both slip the team knows which wins.
- **The team**: explains the decision and the reasons; gives people a path to the new work (rotation, a date); makes the unglamorous work visible (demo the deletion coverage, the drop in pages, credit in reviews).
- **Real example**: a choice between visible new work and finishing something important, what was decided, what it cost and what the candidate would repeat.

**How to judge.** Reward quantified costs and options between extremes. Probe whether the candidate thinks about the people on the team as well as the plan.

**Red flags.** Jumping to the visible project because it is visible; abandoning a privacy obligation half done; splitting the team without priorities; ignoring the engineers' motivation; no plan for the half-finished state.

**Rubric anchors.** 2: picks one by preference with no costs. 3: costs both options including the half-done state, tests the new project's real need, proposes an option between extremes, communicates a recommendation. 4: also recognises non-negotiable obligations, sets explicit priorities for when both slip, leads the team through disappointment and makes the less visible work valued, with a credible real example.

## LNK-L5-05

**What a strong answer contains.**
- **Overview**: a clear problem statement, who depended on the system, real numbers (volumes per day, peak to average, latency or freshness targets, data size, cost), the architecture at the right altitude, and the candidate's role.
- **Depth on the chosen angle**: for the data model, keys, grain, how it handled change and late or corrected data, and why it held up; for correctness, the invariant at risk, how it was detected, the fix and the proof; for reliability, the failure guarded against, the mechanism, how it was tested and what it cost.
- **The redesign for the requirement**: follows the data from where it is written to every copy (replicas, caches, search indexes, warehouse tables, exports, model features). For visibility settings: settings as data with versions, checked at read time for each audience, and propagated to copies (indexes re-filtered or rebuilt when a setting changes) with a bounded delay. For deletion: lineage from every derived table back to the member, deletion events propagated to each store, verification by scanning for the deleted ids, and a deadline. For recruiters' view: a separate projection containing only what the member allows recruiters to see, so a mistake in a query cannot reveal more. For company figures: aggregates with minimum group sizes and protection against differencing. Accept other sound answers that fit the candidate's system.
- **Testing the guarantee continuously**: canary members with known settings checked in every store; automated checks that deleted ids are absent; alerts on propagation lag.
- **Honesty**: what failed, what they would change, what was the team's versus theirs, and which parts of the redesign are reasoning rather than experience.

**How to judge.** Probe numbers (per day or total? peak?), alternatives considered, and one failure in detail. A candidate who owned part of a system and says so precisely scores well; one who claims the whole system but cannot explain its keys or failure modes does not. In the redesign, reward following data into every copy over vocabulary.

**Red flags.** Only buzzwords; numbers that change under questioning; no failure ever; cannot say what they personally did; "we hash member ids, so it is anonymous"; enforcement only at the front-end; ignoring copies and exports.

**Rubric anchors.** 2: high-level description, vague numbers, no clear personal contribution, the requirement treated as a single access check. 3: clear framing with numbers, real depth on the chosen angle, honest failure story, a redesign that enforces the requirement at read time and propagates it to copies. 4: also alternatives with evidence, continuous verification of the guarantee, separate projections per audience, correct handling of identifiers and aggregates, crisp separation of own and team contributions, and lessons that show changed practice.
