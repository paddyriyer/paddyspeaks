# xAI · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a model API
platform with real-time data, spend-based rate limits, server-side search tools
and regional endpoints. Every situation, team, date and figure is hypothetical;
nothing here describes the company's customers, partners, internal systems or
data, and none of it describes any company's hiring process or the values it
assesses. Answer from your own experience, or say plainly that you have not
faced it and reason it through. Never invent a story.

## XAI-L5-01: Developers say they are being throttled unfairly, and the data is ambiguous

| | |
|---|---|
| **Template ID** | XAI-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Customer trust under uncertainty / evidence gaps, honest communication, fixing the measurement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |

```params
{
  "channel": ["a public developer forum thread", "support tickets from several large teams", "a widely shared post by a well-known developer"],
  "affected": ["dozens of teams", "a few hundred teams", "most teams in one spend tier"],
  "evidence_gap": ["usage metrics aggregated per minute while enforcement acts per second", "rejection logs kept for only three days", "no record of which limit rejected each request"]
}
```

**Business Scenario.** You lead the team that owns usage and rate-limit analytics for a model API. Through {{channel}}, {{affected}} say they receive 429 rejections well below the limits published for their tier, and some say the platform is quietly favouring other customers. Your dashboards show their usage below the limits in most minutes, but you know they cannot settle the question: there is {{evidence_gap}}. The team that runs enforcement says the limiter is working as designed. Support wants something to tell people today.

**Problem Statement.** What do you do? Cover what you say publicly today, before you know the answer, and what you refuse to say; how you get evidence that can actually settle the question, given {{evidence_gap}}; how you work with the enforcement team without it becoming a blame exercise; what you do if the developers turn out to be right, partly right, or wrong; and what you change so the next complaint can be answered from data within hours. Then tell me about a real time users or another team said a system was treating them unfairly and the data did not clearly say who was right, or say that you have not and reason it through.

**Constraints.** You do not own the limiter and cannot change its behaviour yourself. Any change to published limits or credits is a product and finance decision. Individual teams' usage can be discussed only with those teams, never in public.

**Assumptions.** The teams, limits and figures are hypothetical, and the limit rules are this exercise's (check current docs).

**Clarifications.**
- Q: Is there any sign the limiter treats teams differently? | A: Not that you know of, but nobody has checked by tier or by region.
- Q: Could the teams' own clients be the cause? | A: Possibly: retries count as requests, and streamed responses hold token budget. You do not know how much this explains.
- Q: How quickly do people want an answer? | A: The thread is growing; support wants a statement today and the enforcement lead wants to wait for a full analysis.
- Q: Can you contact affected teams directly? | A: Yes, through support, with their permission to look at their own usage.

**Hints.**
1. Separate what you can say now (what you know, what you are checking, when you will report back) from what needs evidence.
2. Reconstruct a few affected teams' traffic at the resolution enforcement uses before you generalise; a handful of exact cases beats an average.
3. Plan for each outcome in advance: right, partly right, wrong. Each needs its own message and its own fix.

**Follow-ups.**
1. Draft the two or three sentences support posts today. What do you deliberately leave out?
2. The enforcement lead says the limiter is correct and the developers misread the docs. How do you respond?
3. The data shows half the rejections came from the teams' own retry storms and half from a real bug that hit one region. What do you say publicly, and to whom first?
4. What would you change in the data you keep so that the next complaint like this can be answered in hours?
5. In your real example, what evidence finally settled it, and did you change your own mind along the way?

**Follow-up rules.**
- when: working as designed, as designed, user error, their fault → ask: Suppose that is true for most of them. What would a developer need to see to believe it, and how would you show them without exposing other teams?
- when: credit, credits, refund, compensate → ask: You do not own credits. What evidence would you bring to the people who do, and what would you recommend?
- when: blog post, public statement, announce → ask: What exactly would you say before the analysis is done, and how do you avoid a statement you later have to retract?
- when: dashboard, metric, per minute → ask: Your metric says they were below the limit. At what resolution does enforcement decide, and does your metric see the same thing?
- when: we found, the team found, we decided → ask: What did you personally do or decide, and when?

**Evaluation Criteria.** Communicates early and honestly (acknowledges, says what is being checked and when the next update comes) without claiming certainty either way; identifies why the existing data cannot settle the question and gets evidence at the resolution enforcement uses, starting from exact cases with the teams' permission; checks for differences by tier, region and model rather than assuming fairness; works with the enforcement team on shared evidence rather than blame; has a plan for each outcome, including owning a platform fault publicly and taking credits to the people who decide them; protects other teams' data; changes the data kept (rejection records with limit type, per-second resolution, longer retention) so the next question is answered quickly; real example with what they personally did and what settled it, or honestly hypothetical.

## XAI-L5-02: Launch-day traffic far above the forecast, and what you cut to stay up

| | |
|---|---|
| **Template ID** | XAI-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / load shedding by priority, protecting commitments, communication under pressure |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "multiple": ["five times", "ten times", "twenty times"],
  "constrained": ["serving capacity for the new model", "query capacity of the public-post search index", "the token-accounting service behind rate limits"],
  "hour": ["first", "third", "sixth"]
}
```

**Business Scenario.** A new model and a new server-side search feature launch together on a model API. In the {{hour}} hour after launch, traffic is {{multiple}} the forecast and the bottleneck is {{constrained}}. Latency is climbing for every customer, including teams with existing production workloads on older models, error rates are rising, and the batch queue is growing. You are the senior engineer leading the incident. Several things could be cut or degraded: new-model access for new teams, the search feature's freshness, batch processing, the usage console's freshness, free-tier traffic, and analytics pipelines that share the same infrastructure.

**Problem Statement.** Walk me through the next three hours. Cover how you establish what is actually saturated and what is merely slow; the order in which you would cut or degrade things, and the reasoning behind that order; who decides each cut and how fast; how you protect existing production workloads and commitments; what you tell customers, and when; how you avoid cuts you cannot undo; and what you do the following week. Then tell me about a real time demand far exceeded what a system you were responsible for was built for, or say that you have not and reason it through.

**Constraints.** Adding capacity takes hours at best. Product and marketing want the launch to remain visibly available. Some customers have contractual terms (all hypothetical here) and others are on a free tier. Any change to published limits must be stated publicly.

**Assumptions.** Traffic, forecasts, tiers and terms are hypothetical.

**Clarifications.**
- Q: Is the forecast wrong or is traffic abusive? | A: Mostly real usage; a share looks like automated retries from a few clients.
- Q: Can batch processing be paused? | A: Yes; batch has its own completion window (this exercise's rule), so a pause is safe up to a point.
- Q: Can the search feature return older results? | A: Yes, with a freshness cost that the model would not know about unless told.
- Q: Who is on the incident? | A: Serving, search, billing and support leads; product leadership wants hourly updates.

**Hints.**
1. Rank what you protect before you rank what you cut: existing production workloads and data correctness usually come first.
2. Prefer cuts that are explicit and reversible (lower limits for new teams, pause batch within its window, label search results as delayed) over silent degradation.
3. Billing and usage accounting must stay correct even when the console is behind; decide what may lag and what may not.

**Follow-ups.**
1. Which three things do you cut first, in what order, and why that order?
2. Product leadership asks you to keep new-model access open to everyone and degrade older models instead. What do you say?
3. You pause batch processing. How do you make sure no batch misses its completion window without anyone noticing?
4. What do customers hear in the first hour, and from whom?
5. In your real example, what did you cut, and what would you cut differently now?

**Follow-up rules.**
- when: autoscale, autoscaling, add capacity, more gpus → ask: Capacity arrives in four hours at best. What do you do in the meantime, minute by minute?
- when: rate limit, rate limits, throttle, lower limits → ask: Lowering limits is a public change. Which teams does it hit, how do they find out, and how do you raise them again?
- when: free tier, free users → ask: Cutting free traffic is simple. What does it cost you in trust, and how would you say it?
- when: pause batch, paused batch, batch queue → ask: How long can batch stay paused before the completion window is at risk, and who watches that clock?
- when: we decided, the team decided, leadership decided → ask: Which decisions did you make yourself, and which did you take to someone else?

**Evaluation Criteria.** Establishes the real bottleneck from data before cutting; states a protection order (existing production workloads, correctness of billing and accounting, commitments) and cuts in a reasoned order with explicit, reversible measures first; is clear about decision rights and moves quickly within them; keeps degradations visible to customers and to the model (labelled delayed results, explicit errors) rather than silent; watches the clocks of anything paused; communicates early on a cadence; follows up with capacity planning, load tests and pre-agreed shedding plans; real example with what they personally decided and what they would change, or honestly hypothetical.

## XAI-L5-03: Sorting decisions you can undo from ones you cannot, under extreme time pressure

| | |
|---|---|
| **Template ID** | XAI-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Decision-making under pressure / reversibility, cost of undoing, making decisions cheaper to reverse |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |

```params
{
  "situation": ["a storage cluster holding request logs and usage records will be full in a few hours", "a pricing change must ship tonight for a launch tomorrow morning", "a region is failing during a launch and traffic must move"],
  "time": ["thirty minutes", "two hours", "one evening"],
  "team_size": [3, 6, 12]
}
```

**Business Scenario.** You lead {{team_size}} engineers on a model API's data platform. The situation: {{situation}}. You have about {{time}} before the decisions must be made. In front of you are proposals from the team, including: delete the oldest partitions of a dataset to free space; raise every team's rate limits temporarily; change the format of a field in a public API response; publish a public statement with numbers; change how a usage field is computed for billing; send all traffic for one model to a single region; and turn off a non-critical pipeline.

**Problem Statement.** How do you decide what to decide quickly and what to slow down? Cover how you sort these proposals by how hard they are to undo and what undoing would cost; which ones you delegate to the team and which you take yourself or escalate; how you make a hard-to-undo decision cheaper to reverse before you make it (a snapshot, a flag, a staged rollout, a version); what evidence you insist on for the irreversible ones even under pressure; and how you record what was decided and why. Then tell me about a real time you made, or watched someone make, a decision under time pressure that could not be undone, or say that you have not and reason it through.

**Constraints.** Some decisions affect customers' code (public API formats), money (billing fields) or data that cannot be recovered (deleted partitions). Escalation is possible, but whoever you escalate to has only minutes to give you.

**Assumptions.** The situation, team and figures are hypothetical.

**Clarifications.**
- Q: Is there a backup of the oldest partitions? | A: Some of them; nobody is sure which.
- Q: Do customers parse the field whose format would change? | A: Probably; you do not know how many.
- Q: Can the billing computation change be applied only to new usage? | A: Yes, if someone builds that; it would take an hour.
- Q: Who can approve a public statement? | A: Communications and a product lead; both are reachable.

**Hints.**
1. For each proposal ask: if this is wrong, what does undoing it cost, who bears that cost, and can it be undone at all?
2. Many decisions that look irreversible can be made reversible cheaply: snapshot before deleting, add a new field instead of changing one, apply a billing change only from a timestamp, ship behind a flag.
3. Speed and care are not opposites: decide the reversible ones fast and spend your scarce time on the few that are not.

**Follow-ups.**
1. Sort the proposals in front of you. Which do you let the team decide on their own right now?
2. The storage cluster will be full in two hours, and deleting the oldest partitions is the fastest fix. What do you do first?
3. Someone argues that changing the API field format is "just a small fix". How do you decide, and what would you do instead?
4. How do you record the decisions made in those hours so that someone can review them next week?
5. In your real example, was the decision really irreversible, and what would have made it cheaper to undo?

**Follow-up rules.**
- when: delete, drop, truncate, purge → ask: Before that runs, what is the cheapest thing that would let you undo it, and how long does it take?
- when: escalate, escalation, ask my manager → ask: Your manager has five minutes. What exactly do you bring, and what decision do you ask for?
- when: flag, feature flag, toggle → ask: Which of these proposals cannot be put behind a flag, and what do you do with those?
- when: just do it, no time, right now → ask: Which one of these would you most regret doing quickly, and why?
- when: we decided, the team decided → ask: Which decision did you personally make, and what did you know when you made it?

**Evaluation Criteria.** Sorts decisions by cost and possibility of undoing, and by who bears the cost (customers' code, money, unrecoverable data), not by how urgent they feel; delegates reversible decisions quickly with clear boundaries; slows down on irreversible ones with the minimum evidence needed (which partitions are backed up, who parses the field), and escalates them with a crisp ask; makes decisions cheaper to undo before making them (snapshot, additive field, timestamped billing change, flags, staged traffic moves); records decisions and reasons as they happen; reviews afterwards; real example with what was or was not reversible and what they learned, or honestly hypothetical.

## XAI-L5-04: Developer documentation that was wrong, and customers who built on it

| | |
|---|---|
| **Template ID** | XAI-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Owning a public mistake / correcting docs, choosing which behaviour wins, migration and communication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer, analytics-engineer |

```params
{
  "wrong_fact": ["batch results would be returned in the order the requests were submitted", "the tokens counted toward a tokens-per-minute limit were input tokens only", "every citation returned by the search tool would include a URL", "usage records would be final within one hour"],
  "weeks": ["three", "eight", "twenty"],
  "builders": ["a handful of large teams", "hundreds of teams", "several open-source client libraries"]
}
```

**Business Scenario.** Your team owns part of a model API's developer documentation. You discover that for {{weeks}} weeks a page has said that {{wrong_fact}}. That was never how the system behaved. It appears that {{builders}} have built on the documented behaviour: some have code that assumes it, and a few have filed bugs that support closed as "working as intended". Changing the system to match the docs is possible but costly; changing the docs to match the system will break the assumption some customers rely on.

**Problem Statement.** What do you do? Cover how you confirm what the system actually does and who is affected; how you decide whether the system or the documentation changes (or both); how and when you correct the page, and what the correction says; how you reach the affected teams and library maintainers, and what help you offer; what happens to the bugs that support closed; and what you change so that documentation and behaviour cannot drift apart again. Then tell me about a real time you found that something you or your team had published was wrong after others relied on it, or say that you have not and reason it through.

**Constraints.** You cannot see what customers' code does, only how they call the API. The documentation is public, and any change is visible to everyone. Changing system behaviour needs the owning team's agreement and its own rollout.

**Assumptions.** The documentation, teams and figures are hypothetical; nothing here describes real documentation.

**Clarifications.**
- Q: How did the error get in? | A: The page was written from a design document before the feature shipped, and nobody compared it with the final behaviour.
- Q: Do you know who relies on it? | A: Partly: from support tickets, public code that calls the API, and request patterns.
- Q: Is anyone harmed today? | A: Some teams may be mis-sizing requests or mismatching results; you do not yet know how many or how badly.
- Q: Does support want to reopen the closed bugs? | A: Support is embarrassed and would rather just fix the page quietly.

**Hints.**
1. A quiet fix to a public page is itself a change people rely on; say what changed and why.
2. Decide which behaviour wins by the harm each choice does to the people affected, not by which is cheaper for you.
3. The root cause is a process that let docs and behaviour drift; fix that, not only the page.

**Follow-ups.**
1. What does the correction on the page say, word for word, near the top?
2. Support wants to fix the page quietly. What do you say?
3. How would you find the affected teams and client libraries, and what would you offer them?
4. What would you put in place so that a documented behaviour is tested against the real system?
5. In your real example, how did the people who had relied on the mistake react, and what did you learn?

**Follow-up rules.**
- when: quietly, silently, just fix the page → ask: A team notices the page changed under them a week later. What do they conclude about every other page?
- when: change the system, match the docs, change the behaviour → ask: Who else relies on today's behaviour, perhaps without knowing it, and what happens to them?
- when: changelog, release notes, announcement → ask: Who actually reads that? How do you reach the teams whose code is affected?
- when: contract test, tests, doc tests → ask: Which statements on a documentation page can be tested automatically, and who owns the tests when they fail?
- when: we fixed, the team fixed, we decided → ask: What did you personally do or decide?

**Evaluation Criteria.** Confirms the actual behaviour and the extent of reliance from evidence before acting; decides between changing docs or system by harm to affected customers and states the trade-off; corrects the page visibly with a dated note of what changed and why; reaches affected teams and library maintainers directly with concrete help (examples, a migration path, a grace period where possible); reopens and answers the bugs support closed and owns the mistake without blaming support; fixes the process (docs reviewed against shipped behaviour, executable examples or contract tests, an owner per page); real example with what they personally did and how it landed, or honestly hypothetical.

## XAI-L5-05: Project deep dive, re-examined for a model API with real-time search and spend-based limits

| | |
|---|---|
| **Template ID** | XAI-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Project deep dive / design decisions, failures, limits enforced across regions, freshness and deletion, usage to the cent |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "angle": ["the data model and the keys", "the hardest failure you diagnosed in it", "the decision you would most like to undo"],
  "requirement": ["rate limits per team enforced across several regions with a stated overshoot bound", "public posts searchable within a minute of creation and never returned after deletion", "usage priced once and shown to each team to the cent, matching the invoice", "every request served, logged and billed only in the region a team chose"],
  "scale": ["hundreds of thousands of requests a second", "a billion new public posts a day", "hundreds of thousands of teams"]
}
```

**Business Scenario.** In this part of the loop you describe a data system you designed or substantially changed, one that other teams or customers depended on. The interviewer will go deep on {{angle}}, then ask how the system would have to change for a model API with real-time search over public posts and spend-based rate limits, at a scale of {{scale}}, with {{requirement}}.

**Problem Statement.** Give a five-minute overview: the problem, the users, the scale in numbers, the architecture and your role. Then go deep on {{angle}}. Then reason through what changes at a scale of {{scale}}, with {{requirement}}. If you have never owned such a system, say so, pick the closest thing you have worked on, and be clear about which parts you are reasoning through rather than recalling.

**Constraints.** Your own project only. Describe it without revealing anything a previous employer would not want shared; round numbers are fine if you say so.

**Assumptions.** The model API setting is hypothetical, and any limits or prices mentioned are this exercise's rules (check current docs).

**Clarifications.**
- Q: Does it have to be an API, search or billing system? | A: No. Any system that moved, stored or computed data others depended on; the re-examination is where we bring it into this domain.
- Q: Can it be a team project? | A: Yes, but separate what you did from what the team did.
- Q: How deep should I go? | A: Down to keys, schemas, failure modes and numbers.

**Hints.**
1. Lead with the problem and the numbers before the architecture.
2. Have one decision you would defend again and one you would change.
3. For the re-examination, start from one request or one post: where it enters, which ids and timestamps it carries, and which of them the new requirement constrains.

**Follow-ups.**
1. What was the main alternative to your key design decision, and what evidence chose between them?
2. What broke in production, how did you find out, and what did you change?
3. Which parts of your design would not survive a scale of {{scale}}? What breaks first?
4. How would you provide {{requirement}} without a rewrite?
5. What would you build differently today, and why?

**Follow-up rules.**
- when: we built, we designed, the team built → ask: Which parts did you personally design or write?
- when: millions, billions, terabytes, petabytes → ask: Is that per day or in total, and what was the peak relative to the average?
- when: cache, cached, caching → ask: What in your cache could outlive a deletion or a limit change, and how long could it be wrong?
- when: float, double, decimal → ask: Where in your system could a fraction of a cent appear, and where exactly is it rounded?
- when: replicate, replication, multi-region, cross-region → ask: Which data in your system crossed regions, and could you have kept a customer's requests and logs in one region if asked?

**Evaluation Criteria.** Clear problem framing with real numbers; depth on the chosen angle down to keys, schemas and failure modes; decisions explained with alternatives and evidence; honest account of what broke and what changed; a credible re-examination that names the assumptions that would not survive the scale and addresses {{requirement}} incrementally (for example regional shares of a team's limit with rebalancing and a stated bound; a time-partitioned index with serve-time deletion checks on every path; one priced usage fact in integer units with a continuous tie-out; residency enforced at every hop with the serving region recorded on every record); own contribution clearly separated from the team's, or an honest statement of reasoning rather than recall.
