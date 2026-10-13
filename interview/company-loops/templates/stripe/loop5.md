# Stripe · Loop 5 — Architecture Leadership + Project Deep Dive

Simulated practice scenarios set in the public product domain of a payments
infrastructure company. Every situation is hypothetical. Answer from your own
experience, or say plainly that you have not faced it and reason it through.
Never invent a story.

## STR-L5-01: Customers double-charged after a retry bug

| | |
|---|---|
| **Template ID** | STR-L5-01 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Incident leadership / money correctness, customer impact |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "customers": ["1,200", "8,500", "40,000"],
  "hours": [2, 6, 18],
  "cause": ["a client retry path that generated a new idempotency key on every attempt", "a queue consumer that re-processed charge requests after a timeout", "a deploy that skipped the idempotency check on one code path"]
}
```

**Business Scenario.** Your team owns a service that creates charges on behalf of merchants. For {{hours}} hours, {{cause}} caused about {{customers}} end customers to be charged twice for one purchase. Merchants are opening support tickets, some cardholders have already called their banks, and the second charges are beginning to settle. You are the most senior engineer on the team and the incident is yours to lead.

**Problem Statement.** Tell me how you would lead the response: the first hour, the first day and the following weeks. Cover stopping the harm, identifying exactly who was affected, making customers whole, communicating with merchants and internal teams, and preventing a repeat. Then tell me about a real incident you led where customers lost money or trust (STAR, with measurable outcomes), or say that you have not and reason through how you would.

**Constraints.** You cannot delete or edit charges; corrections are new transactions (refunds or reversals). Merchants own the relationship with their customers. Some duplicates may already be disputed.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is the bug still live? | A: You do not know yet when you are paged; the alert is a spike in charges per order.
- Q: Can we refund on the merchants' behalf? | A: Technically yes, but legal and support want a decision on consent and messaging first.
- Q: How do we know which charges are duplicates? | A: That is part of your job. Some customers genuinely bought twice.
- Q: Who talks to merchants? | A: Support and account teams, with your facts.

**Hints.**
1. Stop the bleeding before you diagnose: what is the fastest safe switch?
2. Define "duplicate" precisely and estimate your false positives before refunding anyone.
3. Refunding duplicates quickly also avoids disputes, which cost merchants fees and time.

**Follow-ups.**
1. Your query finds 9% more suspected duplicates than the support tickets suggest. Do you refund all of them? Who decides?
2. A large merchant asks you not to refund automatically because they want to contact customers first. How do you handle different merchant preferences at scale?
3. Some duplicates are already disputed. What happens if you refund those too, and how do you avoid paying twice?
4. What did you change so the next idempotency failure is caught in minutes? Name the signal, threshold and owner.
5. In your real example, what did you personally decide, and what would you do differently?

**Follow-up rules.**
- when: rollback, revert, roll back → ask: The bug is in a client library merchants have already deployed. What can you roll back, and what can you not?
- when: refund everyone, refund all, automatic refund → ask: Some of those customers really did buy twice. How many would you refund wrongly, and what does that cost the merchant?
- when: postmortem, post-mortem, retro → ask: Name one change from the review that actually shipped, and how you verified it worked.
- when: we decided, the team decided, we agreed → ask: What did you personally decide or do?
- when: blame, fault, their mistake → ask: How do you keep the review blameless when one engineer's change caused it?

**Evaluation Criteria.** Contains first (feature flag, revert, server-side dedup guard); precise definition of a duplicate with a measured error rate; refunds through new transactions, coordinated with dispute handling; clear decision rights with legal, support and merchants; timely, factual communication; prevention at the right layer (server-side idempotency, invariants on charges per order) with an owner; real example has measurable evidence and a personal contribution, or is honestly marked as hypothetical.

## STR-L5-02: Rewrite the ledger service, or evolve it?

| | |
|---|---|
| **Template ID** | STR-L5-02 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Architecture decisions / migration strategy, risk |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "age": [6, 9, 12],
  "driver": ["volume expected to grow tenfold in two years", "a new multi-currency product the current schema cannot represent", "audit findings that some entries can be edited after posting"],
  "team": [6, 12, 20],
  "incidents": [2, 5, 9]
}
```

**Business Scenario.** The ledger service is {{age}} years old. It records every movement of money as entries, and dozens of services and finance reports depend on it. It caused {{incidents}} incidents last quarter. The trigger for the current debate is {{driver}}. Half of your {{team}}-person team wants a rewrite on a new design; the other half wants to evolve the current service. Leadership asks you for a recommendation within two weeks.

**Problem Statement.** How would you reach and present the decision? Cover the evidence you gather, the options you compare (including hybrids), how you de-risk whichever path you choose, how you keep money correct during any migration, and how you bring both halves of the team along. Then describe a real architecture decision of similar weight that you led or strongly influenced, with its outcome, or say that you have not and reason it through.

**Constraints.** The ledger cannot stop. Historical entries must remain queryable and auditable. Finance closes every month and cannot absorb a broken close.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Is there a deadline from the business? | A: The trigger for the debate sets one; you should establish how firm it is.
- Q: Can the team grow? | A: Modestly; assume most of the work is done by today's team.
- Q: Who must approve? | A: Engineering leadership, with finance and the audit owner consulted.
- Q: Are the incidents in one area? | A: You do not know yet; that is part of the evidence.

**Hints.**
1. Separate the problems: which ones the current design cannot solve, and which ones are just neglected.
2. Any migration of a ledger needs a period where old and new run side by side and are reconciled entry by entry.
3. Write the decision down with the criteria and the reversal points, so the half that lost can see why.

**Follow-ups.**
1. What would you have to see in the evidence to recommend a rewrite? And to recommend against one?
2. Describe the migration: dual writes, shadow reads or something else. How do you know the new system is right before it becomes the source of truth?
3. Three months in, the chosen path is behind schedule and the other camp says "told you so". What do you do?
4. How do you migrate {{age}} years of history, or do you?
5. In your real example, what evidence changed your mind, and what would you decide differently now?

**Follow-up rules.**
- when: rewrite, from scratch, greenfield → ask: During the rewrite the old service still needs fixes, and the pressure that started this debate does not wait. Who does that work?
- when: strangler, incremental, step by step → ask: Which seam do you cut first, and how do you prove that slice is correct before moving the next?
- when: dual write, dual-write → ask: The two writes succeed in one system and fail in the other. Which one is the truth, and how do you repair the other?
- when: we decided, the team decided, consensus → ask: Where did you personally disagree with the outcome, and what did you do about it?

**Evaluation Criteria.** Evidence before opinion (incident causes, change lead time, limits that are structural vs neglected); options compared on explicit criteria including risk to money and cost of delay; a reversible, staged plan with parallel run and entry-level reconciliation; history and audit handled deliberately; team alignment through a written decision; real example with measurable outcome and personal contribution, or honestly hypothetical.

## STR-L5-03: Warehouse spend for merchant reporting tripled

| | |
|---|---|
| **Template ID** | STR-L5-03 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cost optimization / attribution, guardrails, trade-offs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "spend": ["$40,000 to $120,000 a month", "$150,000 to $450,000 a month", "$400,000 to $1.2 million a month"],
  "weeks": [6, 10, 16],
  "growth": ["12%", "25%", "40%"]
}
```

**Business Scenario.** Merchant reporting (downloadable reports, scheduled exports and the analytics behind dashboards) runs on a cloud data warehouse. Over {{weeks}} weeks its spend went from {{spend}}, while the number of active merchants grew {{growth}}. Finance wants a plan, and the reporting product team is worried that cuts will slow reports merchants rely on for their own month-end.

**Problem Statement.** How would you lead the response? Cover how you find where the money goes, what you change first and what later, how you protect merchant-facing service levels and the correctness of financial reports, and how you keep spend from drifting again. Then tell me about a real time you reduced a significant cost (STAR, with numbers), or say that you have not and reason it through.

**Constraints.** Reports that merchants reconcile against payouts must stay exact. No merchant-visible report may get slower than its stated service level without the product team's agreement.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Do we know which workloads cost what? | A: Only partly; queries are not consistently tagged.
- Q: Did anything launch recently? | A: A scheduled export feature and a dashboard redesign shipped in the period.
- Q: Is there a target? | A: Finance asked for a credible plan, not a number. You may propose one.
- Q: Who owns the warehouse? | A: A platform team operates it; several teams run workloads on it.

**Hints.**
1. Normalise before you react: cost per merchant or per million payments tells you whether this is growth or waste.
2. Attribute spend to workloads and owners first; the top handful of queries usually explain most of it.
3. Separate quick reversible fixes from structural changes, and measure each.

**Follow-ups.**
1. You find the new scheduled export recomputes each merchant's full history every night. What do you change, and how do you prove the exports are still exact?
2. A dashboard refreshes every minute for every open browser tab. The product team says freshness is the feature. How do you resolve it?
3. Which guardrails would stop this happening again: budgets, alerts, per-team attribution, review of new workloads? Who owns each?
4. How would you present the plan to finance and to the product team, who want different things?
5. In your real example, what was the saving, how was it measured, and what did it cost in other terms?

**Follow-up rules.**
- when: bigger warehouse, scale up, larger cluster → ask: Spend already tripled. How does more compute reduce the bill?
- when: incremental, materialize, materialized view → ask: Late refunds and disputes change past days. How does your incremental model stay exact?
- when: cache, caching, result cache → ask: What invalidates the cache when a late change arrives for a past day?
- when: cut, turn off, disable → ask: Which merchants notice, and who agreed?

**Evaluation Criteria.** Normalises cost to growth; attributes spend to workloads and owners; finds root causes (full recomputes, over-refreshing, unpruned scans, idle compute) with evidence; sequences reversible quick wins and structural fixes; protects exactness and service levels; installs guardrails with owners; communicates trade-offs to finance and product; real example is measured and personal, or honestly hypothetical.

## STR-L5-04: Real-time balances or audited end-of-day numbers?

| | |
|---|---|
| **Template ID** | STR-L5-04 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Cross-team disagreement / product and finance, data semantics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "audience": ["small online merchants", "enterprise finance teams", "platforms with many connected accounts"],
  "gap": ["0.2%", "0.8%", "2%"],
  "deadline": ["six weeks", "one quarter"]
}
```

**Business Scenario.** Product wants the merchant dashboard to show balances in real time, because {{audience}} keep asking how much they have right now. Finance wants the dashboard to show only audited end-of-day numbers, because intraday figures typically differ from the final ones by about {{gap}} and every difference becomes a support ticket or a question in an audit. Both teams have asked you, as the data lead, to back them. The roadmap needs an answer within {{deadline}}.

**Problem Statement.** How would you handle the disagreement and reach a decision? Cover how you understand what each side actually needs, what options you put on the table, how the data would have to work for each, who decides and how, and how you would make the decision stick. Then describe a real disagreement between two teams that you helped resolve, with its outcome, or say that you have not and reason it through.

**Constraints.** You do not own the decision alone. Whatever ships must not show two different numbers for the same thing without explaining why.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Why do intraday and final numbers differ? | A: Late refunds and disputes, fees finalised at settlement, and currency conversion. You should confirm the mix.
- Q: Is there a regulatory requirement? | A: Not for the dashboard specifically, but finance's audited reports are the official figures.
- Q: Who is the final decider? | A: The product director and the finance controller jointly; escalation goes to their common leader.
- Q: Do merchants act on these numbers? | A: Yes. Some decide on spending or payouts from them.

**Hints.**
1. Ask what decision each side is trying to protect; positions hide needs.
2. "Real-time" and "audited" can both be shown if they are clearly different things with clear labels and a known relationship.
3. Bring numbers: how often and how much do intraday figures move, and why.

**Follow-ups.**
1. What would the dashboard show under your proposal, word for word, for a balance that may still change?
2. Finance agrees, but only if intraday numbers are never more than a stated amount away from the final ones. How do you measure that and what happens when it is exceeded?
3. The decision goes against your recommendation. What do you do next?
4. In your real example, how did you separate positions from needs, and how did you know the resolution held?

**Follow-up rules.**
- when: compromise, middle ground, meet halfway → ask: Which part of each side's need does your compromise give up, and did they agree to give it up?
- when: escalate, escalation → ask: What would you put in front of the decider, and how do you keep it fair to the side you disagree with?
- when: label, provisional, pending → ask: How do you know merchants read and understand the label? What would you measure?
- when: real-time, streaming, live → ask: What is the source of the real-time number, and how does it converge to the audited one?

**Evaluation Criteria.** Surfaces underlying needs; quantifies the intraday-to-final gap and its causes; proposes options with data implications (one ledger source, provisional vs final states, as-of labels, reconciliation of the two); clear decision rights and a fair escalation; disagree-and-commit when overruled; real example with a durable outcome and personal contribution, or honestly hypothetical.

## STR-L5-05: Reconciliation scripts only one person understands

| | |
|---|---|
| **Template ID** | STR-L5-05 |
| **Loop** | 5 |
| **Kind** | leadership |
| **Topic** | Technical debt / key-person risk, month-end close |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "scripts": [14, 30, 60],
  "situation": ["is going on leave in six weeks", "has given notice and leaves in a month", "is paged at every month-end close and is burning out"],
  "close_days": [3, 5]
}
```

**Business Scenario.** Month-end close depends on {{scripts}} reconciliation scripts that match the ledger against processor and bank files and produce the adjustments finance books. They run partly by hand, from one engineer's laptop and a shared server. One engineer wrote most of them and is the only person who understands them, and that engineer {{situation}}. Finance must close within {{close_days}} business days.

**Problem Statement.** What do you do, in what order, and how do you get the time for it? Cover the immediate risk to the next close, how you transfer knowledge, how you make the scripts safe to change, whether and when you replace them, and how you treat the engineer. Then tell me about a real piece of risky technical debt you reduced, with its outcome, or say that you have not and reason it through.

**Constraints.** The next close must not slip. Feature work for the quarter is already committed. Finance must be able to explain every adjustment to auditors.

**Assumptions.** The situation and figures are hypothetical.

**Clarifications.**
- Q: Are the scripts in version control? | A: Some are; others exist only on the shared server.
- Q: Are there tests? | A: No. There are past close outputs, kept by finance.
- Q: Is the engineer willing to help? | A: Yes, but their time is limited.
- Q: Can you rewrite them in the new data platform? | A: Eventually, perhaps. Not before the next close.

**Hints.**
1. First make the next close survivable without that person: inventory, runbook, and a shadow run by someone else.
2. Past close outputs are your test oracle: rerun old inputs and compare with what finance booked.
3. Make the case for time in terms the business feels: a late close, an audit finding, one person's health.

**Follow-ups.**
1. Show me the first two weeks: what exists at the end of week one, and at the end of week two?
2. A shadow rerun of last month's close differs from what was booked by a few hundred minor units on one source. What do you do?
3. Your manager says the roadmap cannot give up any time. How do you make the case, and what do you do if the answer is still no?
4. When would you replace the scripts rather than harden them, and how would you run old and new in parallel?
5. In your real example, how did you measure that the risk was actually lower?

**Follow-up rules.**
- when: rewrite, replace, migrate → ask: The next close is in three weeks. What exactly runs that close, and who runs it?
- when: documentation, document, wiki, runbook → ask: How do you know the runbook works? Who has followed it without help?
- when: hero, they own it, only person → ask: How do you recognise that person's contribution while removing the dependency on them?
- when: tests, golden, regression → ask: Which inputs and outputs do you use as the oracle, and how do you know they were right?

**Evaluation Criteria.** Sequences risk: next close first (inventory, version control, runbook, shadow run by another engineer), then tests from historical outputs, then hardening and scheduling, then optional replacement with parallel run; treats the engineer with respect and recognition; makes the business case in concrete terms and secures time; keeps adjustments explainable; real example with measured risk reduction and personal contribution, or honestly hypothetical.
