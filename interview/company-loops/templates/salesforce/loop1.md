# Salesforce · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a multi-tenant cloud
CRM: records such as opportunities, leads and cases, field history, sharing through a
role hierarchy, entitlements measured in business hours, and routing work to agents.
Every rule, workload, number and schema is hypothetical and this exercise's own; check
current product documentation for how any real feature behaves. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## SFC-L1-01: Open pipeline at each month-end, rebuilt from field history

| | |
|---|---|
| **Template ID** | SFC-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / point-in-time reconstruction from change history, DISTINCT ON, as-of joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | SFC-L1-01.mjs |

**Business Scenario.** A sales operations team keeps its deals as opportunity records in a CRM. Each opportunity has a stage, an amount and an owner, and the CRM keeps a field history: one row per tracked field change, with the old value, the new value and when it changed. The team never took month-end snapshots, and leadership now wants the open pipeline as it stood at the end of {{months}}, by stage and owner, to compare with what was forecast at the time. You have the current records and their field history ({{opps}} opportunities, {{history_rows}} history rows).

**Problem Statement.** Write one PostgreSQL query that returns `month_end, stage, owner_id, open_opportunities, open_amount`: for every `month_end` in `report_months`, the opportunities that were **open** at the end of that day, grouped by the stage and owner they had then, ordered by `month_end, stage, owner_id`. An opportunity's value of a field at a month-end is its value after every change of that field with `changed_at` strictly before midnight UTC on the following day. If the field had no change before then, its value was the `old_value` of the field's first later change, or the current value in `opportunities` if the field never changed. An opportunity counts only if `created_at` is before that midnight, and only while its stage then is not `Closed Won` or `Closed Lost`. Only the fields `StageName`, `Amount` and `OwnerId` matter; `Amount` history values are text holding whole numbers. {{fields_rule}} {{tie_rule}}

**Constraints.** One SQL statement (CTEs allowed). Return only groups with at least one open opportunity. A change at exactly 00:00:00 on the 1st belongs to the new month. Every field-history chain is consistent: each change's `old_value` is the previous change's `new_value`, and the last `new_value` is the current value.

**Assumptions.** Hypothetical opportunities, owners, stages and amounts in one currency. Which fields a CRM tracks, and how it records them, is configurable and product-specific; this exercise's history table and rules are its own, so check current docs for any real product. Opportunities are never deleted in this sample.

**Clarifications.**
- Q: An opportunity changed stage twice in May and once in June. What is its stage at the end of May? | A: The new_value of the last May change.
- Q: An opportunity's amount first changed in July. What was its amount at the end of May? | A: The old_value of that July change: that is what the field held before it.
- Q: A deal closed in May and was reopened in July. Is it in the June pipeline? | A: No, it was closed at the end of June. It counts again at the end of July if it is open then.
- Q: Which owner do I group by: the current one or the one at the time? | A: The owner at the month-end, rebuilt the same way as the stage.
- Q: A change happened at 2026-07-01 00:00:00 UTC. Is it part of the June month-end? | A: No. Only changes strictly before midnight count.

**Hints.**
1. Pair every month-end with every opportunity created before its cut-off first; everything else is a lookup per (month-end, opportunity, field).
2. The last change before a cut-off is a `DISTINCT ON (month_end, opportunity_id, field) … ORDER BY …, changed_at DESC, history_id DESC`. The first change after it is the same with ascending order, and you want its `old_value`.
3. `COALESCE(value before, old value after, current value)` gives the value at the cut-off. Pivot the three fields with `MAX(…) FILTER (WHERE field = …)` before filtering closed stages.

**Follow-ups.**
1. Leadership wants this every month from now on. Would you keep reconstructing from history, or start writing snapshots? What does each cost, and what does a snapshot table lose?
2. Amounts are entered in several currencies, and the exchange rate changes during the quarter. Which rate do you apply to a month-end amount, and why?
3. Field history is kept for a limited time, and older changes are archived elsewhere. How does your query behave for a month-end older than the retained history, and how would you detect that rather than silently report wrong values?
4. The history table holds billions of rows across many orgs. How would you index or partition it so that an as-of lookup for one org and one month stays cheap?

**Follow-up rules.**
- when: current stage, current value, opportunities.stage → ask: What does using the current stage do to a deal that was open at the end of May and closed in June?
- when: lag, lead, window function → ask: A window over the history gives you changes in order. How do you get the value at a cut-off that falls between two changes, or before the first one?
- when: <=, at or before → ask: A change landed at exactly midnight on the 1st. Which month does your comparison put it in?
- when: distinct on, row_number → ask: Two changes of one field share a changed_at. Which one wins in your ordering, and is that deterministic?
- when: snapshot, snapshots → ask: If you start writing month-end snapshots today, how do you backfill the months before, and how do you make sure the backfill and the live snapshots agree?

**Evaluation Criteria.** Rebuilds stage, amount and owner as of each cut-off with a strict `<`; falls back to the old_value of the first later change, then to the current value; excludes opportunities created after the cut-off and those closed at the time; ignores untracked fields; orders same-second changes by history_id (Very Hard); groups by the values at the time; deterministic order; can discuss snapshots versus reconstruction, currencies and history retention.

## SFC-L1-02: Lead conversion within 30 days by source, duplicates merged first

| | |
|---|---|
| **Template ID** | SFC-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / recursive CTEs, entity resolution before aggregation, cohort maturity |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | SFC-L1-02.mjs |

**Business Scenario.** Marketing reports, per lead source, what share of new leads convert into a customer within 30 days. The CRM is full of duplicates: the same person fills in a web form, then calls, then meets a rep at a trade show, and each time a lead record is created. Sales operations merges duplicates into one surviving lead, and the merge log keeps which lead went into which. The current report counts every lead record, so a person who arrived three times looks like two failures and one success. Rebuild it on one lead per person. The snapshot was taken at {{as_of}}; the sample has {{leads}} leads and {{merges}} merges.

**Problem Statement.** Write one PostgreSQL query that returns `lead_source, leads, converted_30d, conversion_rate`, one row per source, ordered by `lead_source`. First fold every merged lead into its surviving lead: a **group** is a surviving lead (one that was never merged into another) plus every lead merged into it. A group reports under its surviving lead's `lead_source`, and its **start** is the earliest `created_at` of any lead in the group. It is **converted within 30 days** when the surviving lead's `converted_at` is at or before start + 30 days (merged-away leads are never converted). Report a group only if start + 30 days is at or before {{as_of}}. `leads` counts groups, `converted_30d` the converted ones, and `conversion_rate` is `ROUND(converted_30d / leads, 4)`. {{age_rule}} {{chain_rule}}

**Constraints.** One SQL statement (CTEs allowed). "30 days" is exactly 30 × 24 hours: `+ interval '30 days'` on a UTC timestamp. The boundary is inclusive. The sample is small; a production org can hold millions of leads.

**Assumptions.** Hypothetical sources, leads and merges. How a real CRM merges records (which field values survive, what happens to related records) is product behaviour to check in current docs; this exercise's rule is simply that the surviving lead keeps its own values and the merged leads contribute only their creation time.

**Clarifications.**
- Q: Why measure from the earliest lead, not the surviving one? | A: The person first showed interest then. Measuring from a later duplicate makes slow conversions look fast.
- Q: Which source does a group report under if its duplicates came from different sources? | A: The surviving lead's source, in this exercise. It is a choice; first-touch attribution would pick the earliest lead's source.
- Q: A group's 30 days end after the snapshot. Is it unconverted? | A: Neither. It cannot be judged yet and is not reported.
- Q: Exactly 30 days after the start: in or out? | A: In. converted_at <= start + 30 days.
- Q: Can a merged-away lead have a converted_at? | A: No, never in this sample.

**Hints.**
1. Resolve groups before you aggregate anything: every lead needs the id of its final surviving lead.
2. A survivor is a lead that never appears as `merged_lead_id`. A recursive CTE can walk the merge table from the survivors outwards, carrying the survivor's id as the root.
3. Then one aggregate per root gives the start; join the root back to `leads` for its source and conversion.

**Follow-ups.**
1. A merge is undone a week later. How should the merge log represent that, and which past reports change?
2. Finance prefers first-touch attribution (the earliest lead's source) and marketing prefers the survivor's. How would you serve both without two copies of the logic?
3. Duplicates are only partly merged: many remain unmerged in the CRM. How would you estimate the conversion rate per person without trusting the merge log alone, and what would you report about its uncertainty?
4. This runs nightly for many orgs with millions of leads each. How do you make the group resolution incremental instead of recomputing every chain every night?

**Follow-up rules.**
- when: recursive, with recursive → ask: What stops your recursion if the merge table ever contained a cycle by mistake, and how would you detect one?
- when: count(distinct, distinct lead_id → ask: Distinct leads are still duplicates of one person. Which id do you count, and where in your query does a merged lead stop being a lead?
- when: survivor created_at, surviving lead's created_at → ask: A person first arrived 40 days before converting, but the surviving record was created 10 days before. Converted within 30 days or not?
- when: < interval, strictly → ask: A conversion at exactly 30 days to the second: which way does your comparison decide it, and what does the specification say?
- when: first touch, earliest source → ask: You attributed by first touch. The specification says the survivor's source; when do the two give different reports, and which would you defend to marketing?

**Evaluation Criteria.** Resolves every lead to its final survivor (a recursive walk for chains, Very Hard); one row per person-group; start at the earliest created_at in the group; survivor's source and conversion; inclusive 30-day boundary; immature groups excluded rather than counted as failures (Hard+); `'Unknown'` for a missing source (Very Hard); rate as a rounded ratio, not integer division; deterministic order; can discuss unmerges, attribution choices and incremental resolution.

## SFC-L1-03: Case first response within entitlement, in business hours

| | |
|---|---|
| **Template ID** | SFC-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / business-time arithmetic, calendar tables, generate_series, interval intersection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SFC-L1-03.mjs |

**Business Scenario.** A support organisation runs its customer cases in a CRM. Each case has a priority, and each priority has an entitlement: a first-response target in minutes, measured on a calendar. In this exercise the business calendar is Monday to Friday, {{open_hhmm}} to {{close_hhmm}} UTC, minus the dates in `holidays`; time outside it does not count, so a case opened on Friday evening has not used any of its target by Monday morning. The support lead wants first-response compliance per priority as of the snapshot {{as_of}} ({{cases}} cases, {{comments}} comments).

**Problem Statement.** Write one PostgreSQL query that returns `priority, cases, met, breached, met_rate`, one row per priority with at least one judged case, ordered by `priority`. A case's **first response** is its earliest comment with `author_type = 'agent'` and `is_public = true`. Its **elapsed time** is the calendar time from `created_at` to the first response, counted on its entitlement's calendar. The case **met** its entitlement if elapsed time is at most `response_minutes`, and is **breached** otherwise. {{answer_rule}} {{calendar_rule}} `cases = met + breached`, and `met_rate = ROUND(met / cases, 4)`.

**Constraints.** One SQL statement (CTEs allowed). Measure in seconds; a response at exactly the target meets it. Timestamps are UTC; business days are UTC dates. Business hours are the half-open window [{{open_hhmm}}, {{close_hhmm}}) of each business day.

**Assumptions.** The calendar, holidays, priorities and targets are hypothetical. Real CRMs let administrators define business hours, holidays and entitlement processes in many ways; this exercise fixes one simple rule, so check current docs for any product's behaviour. Comments never predate their case.

**Clarifications.**
- Q: A case arrives on Saturday. When does its clock start? | A: Effectively at the next business opening: no time counts until then.
- Q: An agent replies at 21:00 on a weekday. How much business time has passed since 17:00? | A: None. Business time stops at closing; the reply at 21:00 has the same elapsed time as a reply at closing.
- Q: Does an automatic "we received your case" email count as the first response? | A: No. Only a public comment by an agent.
- Q: Is a response at exactly the target met or breached? | A: Met.
- Q: Does a holiday that falls on a weekend matter? | A: No holiday in this sample falls on a weekend; a holiday removes a business day.

**Hints.**
1. Business time between two instants is a sum over calendar days: for each business day, the overlap of [created, response] with [day + open, day + close].
2. `generate_series(date_trunc('day', s), date_trunc('day', t), interval '1 day')` gives the days; filter weekends with `EXTRACT(ISODOW FROM d) < 6` and holidays with an anti-join; `LEAST`/`GREATEST` give the overlap, kept only when positive.
3. Decide each case's fate (met, breached, not judged) in one CTE, then aggregate with `COUNT(*) FILTER (…)`.

**Follow-ups.**
1. Customers are in several time zones and each support region has its own business hours. What changes in the data model and in the query?
2. At millions of cases, generating a row per case-day is expensive. Precompute a cumulative business-seconds table per calendar so that elapsed time is two lookups and a subtraction. Sketch it.
3. The entitlement clock should pause while the case waits on the customer. How would you model status intervals, and how do pauses combine with business hours?
4. The dashboard must show live time-to-breach for open cases every minute. Which parts of your query move into a stream, and which stay batch?

**Follow-up rules.**
- when: extract(epoch, wall clock, age( → ask: That subtraction counts nights and weekends. A case opened Friday at 18:00 and answered Monday at 09:30: how much business time is that?
- when: generate_series → ask: How many rows does your series produce for a case that stayed open for a year, and how would you avoid generating them?
- when: holiday, holidays → ask: The holiday calendar changes after the fact (a regional holiday added late). Which past results change, and do you recompute them?
- when: where is_public, author_type → ask: What would happen to the report if you dropped this filter, and which kind of comment is most likely to appear first?
- when: open cases, not answered, unanswered → ask: An unanswered case is still within its target at the snapshot. Why is it neither met nor breached, and what bias appears if you count it either way?

**Evaluation Criteria.** First response defined as the earliest public agent comment; business time summed per day with a correct overlap; weekends and holidays excluded; inclusive target in seconds; unanswered cases judged against the snapshot, with not-yet-due cases excluded (Hard+); a 24x7 calendar per entitlement (Very Hard); rate as a rounded ratio; deterministic order; can discuss time zones, cumulative calendar tables and clock pauses.

## SFC-L1-04: Records each user can see through the role hierarchy

| | |
|---|---|
| **Template ID** | SFC-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Trees / iterative post-order aggregation, subtree sums, forests |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, data-architect |
| **Generator** | SFC-L1-04.mjs |

**Business Scenario.** In a multi-tenant CRM an org arranges its users in a role hierarchy: a sales VP above regional directors, above managers, above reps. One common way such systems share records is upward: a user can see the records owned by users in roles below their own. An admin team wants to audit an org's sharing before a reorganisation and asks, for every user, how many records the hierarchy lets them see. The org is large, and its hierarchy, imported from a territory model, can be very deep.

**Problem Statement.** Implement `visible_counts(roles, users, records, no_hierarchy)`. `roles` lists `(role_id, parent_role_id)`, with `None` for a top-level role; the roles form a forest. `users` lists `(user_id, role_id)`. `records` lists `(record_id, object_name, owner_user_id)`. Under this exercise's rule a user can see (a) every record they own, and (b) every record owned by a user whose role is **strictly below** theirs: a child role, a grandchild role, and so on. Users in the same role do **not** see each other's records through the hierarchy. Return `{user_id: number of visible records}` for every user, including users who see nothing. {{role_rule}} {{object_rule}}

**Constraints.** Up to 12 000 roles, 30 000 users and 120 000 records; the hierarchy can be thousands of levels deep, so recursion depth is a real limit in CPython. Every owner is a listed user and every parent a listed role; there are no cycles. Expected: O(roles + users + records). Walking each user's (or each role's) subtree is too slow on a deep tree.

**Assumptions.** Hypothetical orgs, roles and records. Real CRM sharing combines org-wide defaults, role hierarchy, sharing rules, teams and manual shares, and its exact behaviour is configurable; this exercise uses only the hierarchy rule above, so check current docs for any product. Each record counts once per user even if two rules would grant it.

**Clarifications.**
- Q: Two reps share the role "Team A". Does one see the other's records? | A: Not through the hierarchy. Only roles strictly below yours.
- Q: My manager's manager is two roles up. Does she see my records? | A: Yes. Every ancestor role sees them.
- Q: A role has no users but has roles below it. Does it matter? | A: It has no one to show the count to, but the records below it still count for every role above it.
- Q: Do I return users who see nothing? | A: Yes, with 0.
- Q: Can I use recursion? | A: The tree can be thousands of levels deep; Python's default recursion limit is about 1 000. Use an explicit stack.

**Hints.**
1. A user's count is their own records plus the records owned strictly below their role. The second part depends only on the role, not the user.
2. Count shareable records per role first (owned by users in exactly that role). Then the total at or below a role is its own count plus its children's totals: a post-order sum.
3. Build a parents-first order with an explicit stack from the roots; walking it in reverse visits every child before its parent. Below-role = subtree total − the role's own count.

**Follow-ups.**
1. The audit now needs the list of users who can see one particular record, not counts. How would you answer that per record without precomputing everything?
2. Sharing rules add "role R and its subordinates can see records owned by role Q and its subordinates". How do you extend the computation, and how do you avoid double counting a record granted twice?
3. A reorganisation moves one role (with its subtree) under a different parent. Which counts change, and can you update them without recomputing the whole tree?
4. This audit runs across many thousands of orgs every night. How would you structure the job so that one huge org does not dominate, and what do you store so a support engineer can explain one user's count?

**Follow-up rules.**
- when: recursion, recursive, def dfs → ask: The test hierarchy is about 6 000 levels deep. What happens to your recursive function at depth 1 000, and what do you change?
- when: for each user, per user, every user → ask: How many tree nodes does your loop visit in total when the tree is one long chain, and how do you make it linear?
- when: same role, peers → ask: How does your code make sure peers in one role do not count each other's records, while their manager counts both?
- when: set, sets of records → ask: Holding a set of record ids per role is O(roles × records) memory on a deep tree. Do you need the sets, or only the counts?
- when: memo, memoize, cache → ask: Caching per role removes repeated work across users of one role, but what is still repeated between a role and its parent?

**Evaluation Criteria.** Separates "own records" from "records strictly below the role"; aggregates per role, not per user; an iterative post-order (or reverse pre-order) sum that survives deep trees; handles forests, empty roles and users with zero records; users without a role see only their own (Hard+); objects excluded from hierarchy sharing still count for their owner (Very Hard); O(n); can discuss per-record queries, sharing rules and incremental reorganisation.

## SFC-L1-05: Routing each case to the agent with the most spare capacity

| | |
|---|---|
| **Template ID** | SFC-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / priority queues with lazy invalidation, per-key heaps, event processing |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer |
| **Generator** | SFC-L1-05.mjs |

**Business Scenario.** A contact centre built on a cloud CRM pushes incoming work (cases, chats, messages) to agents instead of letting agents pick from a queue. Each agent has skills and a capacity: how many units of work they can hold at once. The team is testing a "most available" policy: send each new case to the agent with the skill who has the most spare capacity, so load spreads evenly. Before turning it on, they want to replay a day of traffic and see exactly where every case would have gone.

**Problem Statement.** Implement `route_cases(agents, events)`. `agents` lists `(agent_id, skills, capacity)`. `events` are processed in list order (their times never decrease): `('case', t, case_id, skill, units)` asks for routing; `('done', t, case_id)` completes a routed case and frees its units; `('offline', t, agent_id)` and `('online', t, agent_id)` change presence. Under this exercise's rule a case goes to an online agent who has `skill` and whose **spare capacity** (capacity minus units of their cases not yet done) is at least `units`; among them, the one with the **most spare capacity**; ties go to the agent whose **latest assignment is oldest** (an agent never assigned counts as oldest of all), then to the agent listed first in `agents`. If no agent qualifies, the case gets `None` (it overflows to a queue outside this exercise) and is never routed later. A `'done'` for a case that was never routed is ignored. Return `{case_id: agent_id or None}` for every case. {{units_rule}} {{done_rule}}

**Constraints.** Up to 2 000 agents, hundreds per skill, and 60 000 cases with as many completions. Times are non-negative integers. Expected: O(E · k · log E) for E events and k skills per agent. Scanning every agent with the skill for every case is too slow.

**Assumptions.** Hypothetical agents, skills, capacities and traffic. Real routing products offer several documented policies (for example least-active or most-available, with their own tie-breaks, queues and push timeouts); this exercise's rule is its own, so check current docs for any product. Routing is instantaneous and an agent never declines work.

**Clarifications.**
- Q: Agent A has 3 spare units and B has 2. A case needs 1 unit. Who gets it? | A: A, the most spare capacity, even if B is listed first.
- Q: Both have 2 spare. A was last assigned at t = 50, B at t = 80. Who gets it? | A: A: the latest assignment that is oldest. An agent never assigned beats both.
- Q: A case needs 2 units; two agents each have 1 spare. Can it be split? | A: No. It goes to one agent with at least 2 spare, or to nobody.
- Q: An agent goes offline while holding cases. What happens to them? | A: They stay with the agent and still complete; the agent just gets nothing new until back online.
- Q: When an agent has no room, does the case wait for them? | A: No. It gets None at once and never routes later.

**Hints.**
1. The best agent for a skill is a maximum over a changing set: keep one heap per skill keyed by `(-spare, last_assigned, input position)`.
2. An agent's key changes on every assignment, completion and presence change, and an agent with two skills sits in two heaps. Instead of updating heap entries, push a fresh entry and bump a version number; skip entries whose version is out of date when they reach the top.
3. Once the top valid entry cannot fit the case, nobody can: it has the most spare capacity.

**Follow-ups.**
1. Instead of overflowing, unroutable cases now wait in a queue per skill and are pushed when capacity frees up. Which agent's completion should pull which waiting case, and what changes in your structures?
2. Product wants "least active" instead: the agent with the fewest units in progress, regardless of capacity. Show a sequence where the two policies send a case to different agents, and say which spreads load better.
3. Agents have a skill level from 1 to 10 and a case needs at least level L. How would you index agents so that "most spare capacity among those with level ≥ L" stays fast?
4. Many routing servers share the same agents. How do you keep two servers from giving the same last unit of capacity to two cases?

**Follow-up rules.**
- when: sorted(, sort, max(, min( → ask: Hundreds of agents share a skill and every case changes one of them. What does sorting or scanning per case cost over 60 000 cases?
- when: heapq, heap, priority queue → ask: An agent with two skills changes load. How do you update both heaps without searching for the old entries?
- when: lazy, version, stale → ask: How large can a heap grow with stale entries, and when would you rebuild it?
- when: round robin, least recently → ask: The rule is most spare capacity first, and idleness only breaks ties. Where in your key does each appear?
- when: split, partial → ask: Can a 2-unit case be split across two agents with 1 spare each under this rule? What does your code return?

**Evaluation Criteria.** Picks the most spare capacity among online agents with the skill, then the oldest latest assignment (never assigned first), then input order; frees capacity only for routed cases; one heap per skill with lazy invalidation, so agents with several skills stay consistent; the top-entry test for "nobody fits"; units and presence (Very Hard); O(E log E); can discuss waiting queues, alternative policies and concurrency across routing servers.
