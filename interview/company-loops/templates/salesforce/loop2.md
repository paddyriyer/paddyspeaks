# Salesforce · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a multi-tenant cloud
CRM: customer orgs with their own objects, formula fields, leads, accounts and
opportunities, forecasts, automation, and a customer data platform. Every rule,
workload, number and schema is hypothetical and this exercise's own; check current
product documentation for how any real feature behaves, and nothing here describes how
the company's own systems are built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SFC-L2-01: Formula field recalculation order after a record save

| | |
|---|---|
| **Template ID** | SFC-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / dependency levels, reverse reachability, cycle detection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | SFC-L2-01.mjs |

**Business Scenario.** A CRM lets each customer org define formula fields on its objects: `Net_Amount__c` reads `Amount` and `Discount__c`, `Commission__c` reads `Net_Amount__c`, and so on. A reporting cache stores the value of every formula field next to the record, so reports and search can filter on them without computing formulas on every read. When a record is saved, the cache must recompute exactly the formula fields whose value can have changed, and it must compute each one after every formula it reads. You are writing the planner that turns a save into that list.

**Problem Statement.** Implement `recalc_order(formulas, edits)`. `formulas` maps each formula field's API name to the list of field names its expression reads. A name that is not a key of `formulas` is an ordinary input field. `edits` is a list of record saves, and each save is a list of the input fields it changed. For each save, return the formula fields that read a changed field directly or through other formula fields, in evaluation order. This exercise's evaluation order is by **level**, then by API name in plain string order. A formula that reads no formula fields has level 1. Any other formula has level 1 + the highest level among the formula fields it reads. Levels are computed over all of `formulas`, not only over the fields a save affects. Return one list per save, in the order of `edits`. If the formulas contain a cycle anywhere, including a formula that reads itself, the configuration is invalid: return `None`. {{shape_rule}}

**Constraints.** Up to 50 000 formula fields, 150 000 references and 5 000 saves. Computing levels once in O(V + E) and then, for each save, touching only the affected formulas and their references (plus sorting them) is expected. Re-evaluating every formula until nothing changes, for every save, is too slow.

**Assumptions.** Field names, objects and sizes are hypothetical. The level rule and the cycle rule are this exercise's; check current docs for how a real platform evaluates formulas and rejects circular references. Edits name only input fields. A formula's value depends only on the fields it lists.

**Clarifications.**
- Q: Does an edited field appear in the output? | A: No. Only formula fields are recalculated, and edits only name input fields.
- Q: Why level and then name, rather than any valid topological order? | A: So that the answer is unique and two runs of the cache log the same order. Any order by level is a valid evaluation order, because a formula's inputs all have lower levels.
- Q: Is the level measured from the edited field? | A: No. It is a property of the formula in the whole configuration: the longest chain of formula references below it.
- Q: A formula reads a field that no formula defines and that is not on the object as far as I know. | A: Treat every name that is not a key of `formulas` as an input field.
- Q: The cycle is between two fields that no save touches. Is that still `None`? | A: Yes. A configuration with a cycle is rejected as a whole, whatever the saves are.
- Q: Can a formula list the same field twice? | A: Yes, for example `IF(Discount__c > 0, Amount * Discount__c, 0)`. It still reads the field once for this purpose.

**Hints.**
1. Build the reverse map once: for every field, the formulas that read it. A save's affected set is everything reachable from its fields in that map.
2. Kahn's algorithm processed layer by layer gives every formula its level and detects a cycle in the same pass: formulas that never reach in-degree zero are on a cycle or behind one.
3. Count a formula's distinct formula inputs when you compute in-degrees, or a repeated reference will hold it back for ever.

**Follow-ups.**
1. Formulas can read a parent record's fields, such as `Account.Industry` on an opportunity. A save on one account must recalculate formulas on 30 000 child opportunities. What changes in your plan and in its cost?
2. A save changes `Amount` but the recomputed `Net_Amount__c` comes out unchanged. How would you stop the recalculation from continuing past it, and what does that do to your precomputed order?
3. An administrator edits one formula in a configuration of 50 000. How do you update levels without recomputing them all, and when can a single edit change the level of thousands of fields?
4. Saves arrive at 20 000 a second across thousands of orgs, each with its own formulas. Where do you cache the plan, and how is it invalidated when an org deploys new metadata?

**Follow-up rules.**
- when: dfs, recursion, recursive → ask: A chain of 20 000 formulas each reading the one before is legal here. What happens to your recursion in CPython, and how would you write it without recursion?
- when: until nothing changes, fixed point, every formula → ask: How many passes over all 50 000 formulas does one save take in the worst case, and how many saves are there?
- when: bfs depth, distance from the edit, shortest → ask: A formula reads the edited field directly and also reads a formula two levels up. Which level does your code give it, and does it run after both of its inputs?
- when: visited, seen set → ask: Your walk marks fields as seen. Where do you clear that set between saves, and what is the cost of clearing it?
- when: lru_cache, memo, memoize → ask: What is the key of your cache, and what happens to it when the org changes one formula?

**Evaluation Criteria.** Affected set exactly the formulas reachable from the edited fields; levels computed over the whole configuration as the longest chain, not the distance from the edit; order by (level, name); `None` for any cycle, including a self-reference and a cycle no save reaches; repeated references and unknown names handled; one list per save including empty ones; levels computed once and only affected formulas touched per save, with the complexity stated; sensible answers on cross-object formulas, early cut-off and metadata changes.

## SFC-L2-02: Matching new leads to accounts by email domain

| | |
|---|---|
| **Template ID** | SFC-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing / label-wise suffix lookup, normalisation, ambiguity |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | SFC-L2-02.mjs |

**Business Scenario.** Leads arrive in a CRM from web forms, events and purchased lists, each with an email address. Sales wants every lead from a company the org already sells to routed to that company's account owner, so a matching step links each new lead to an account by the domain of its email. Large customers have several domains and regional subdomains, and a regional subsidiary may be its own account under a subdomain of its parent's domain. Leads from personal email providers must never be matched, and a domain that two accounts both claim must go to a person rather than to a guess.

**Problem Statement.** Implement `match_leads(accounts, leads, public_domains)`. `accounts` is a list of `(account_id, domains)`, `leads` a list of email strings and `public_domains` a list of personal email domains. Compare everything after removing surrounding spaces and lowercasing. A lead's domain is the text after the **last** `@`. A lead with no `@`, or with nothing after it, matches nothing. A lead whose domain equals a public domain or ends with `.` followed by one matches nothing. Otherwise an account domain matches the lead if it equals the lead's domain or the lead's domain ends with `.` followed by it, so `sales.acme.com` matches `acme.com` but `notacme.com` does not. Of the matching account domains, the longest wins. If that domain is listed by more than one account, the lead is ambiguous and matches nothing; do not fall back to a shorter domain. Return, for each lead in order, the winning `account_id` or `None`. {{data_rule}}

**Constraints.** Up to 100 000 accounts with up to five domains each, and 500 000 leads in a batch. Work per lead should depend on the number of labels in its domain, not on the number of accounts. Comparing every lead with every account domain is too slow.

**Assumptions.** Accounts, domains, people and the public list are hypothetical. The matching rules are this exercise's; check current docs for how a real duplicate or matching rule behaves. Domains contain only letters, digits, hyphens and dots, and no domain starts or ends with a dot. An account listing the same domain twice still claims it once.

**Clarifications.**
- Q: Does `www.acme.com` match an account that lists `acme.com`? | A: Yes, like any other subdomain. The match is on whole labels from the right.
- Q: A public domain is also listed by an account, because somebody typed it in. What happens? | A: The lead matches nothing. The public list always wins.
- Q: Two accounts list `emea.acme.com` and a third lists `acme.com`. A lead comes from `eu.emea.acme.com`. | A: `None`. The longest matching domain is ambiguous, and an ambiguous lead goes to a person, not to the parent account.
- Q: Why the last `@`? | A: A quoted local part can contain `@`, as in `"pat@home"@acme.com`. The domain is always after the last one.
- Q: Should I validate the domain further, for example its top-level domain? | A: No. Apply only the rules in the statement.

**Hints.**
1. Put every account domain in a dict from domain to the set of accounts that list it. Then a lead needs only the suffixes of its own domain.
2. The suffixes of `a.b.c.com` that end on a label boundary are `a.b.c.com`, `b.c.com`, `c.com` and `com`. Walk them from longest to shortest and stop at the first one an account claims.
3. The public check uses the same suffixes. Decide whether it can stop at the first claimed suffix, or has to look at all of them.

**Follow-ups.**
1. The batch is 500 000 leads and the accounts change all day. How do you keep the domain dict fresh without rebuilding it for every batch?
2. Country-code domains such as `acme.co.uk` and `acme.com.au` belong to the same group. How would you link them, and who should be allowed to say they are one company?
3. Sales wants a confidence score instead of a yes or no, and to send ambiguous leads to the account owner with the most open opportunities. What would you need to log to know whether that is a good idea?
4. The same matching must run inside many customer orgs, each with its own accounts. What is shared between orgs, and what must never be?

**Follow-up rules.**
- when: endswith, endswith( → ask: `notacme.com` ends with `acme.com`. Show the line in your code that stops that match.
- when: trie, reversed labels, reverse the domain → ask: A dict of full domains also works here. What does your trie buy you, and what does it cost in memory for 500 000 domains?
- when: split('@'), split("@") → ask: What does your code do with `"pat@home"@acme.com`, and with an address that has no `@` at all?
- when: regex, regular expression, re.match → ask: How many patterns does your regex try per lead, and how does that grow with the number of accounts?
- when: fallback, parent account, shorter domain → ask: Two accounts claim the regional domain. Who should get the lead, and why is sending it to the parent account risky?

**Evaluation Criteria.** Normalisation of emails, account domains and public domains; domain taken after the last `@` and malformed emails rejected; label-boundary suffix matching; public domains and their subdomains never matched, even if an account lists one; the longest matching domain wins and an ambiguous longest domain gives `None` with no fallback; duplicates within one account not counted as ambiguity; per-lead work proportional to labels; clear answers on freshness, related country domains and multi-tenancy.

## SFC-L2-03: Debug the forecast rollup

| | |
|---|---|
| **Template ID** | SFC-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Reporting logic / forecast categories, splits, dated rates, fiscal calendars, ownership |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SFC-L2-03.mjs |

**Business Scenario.** Sales leaders review a forecast every week: for each rep and fiscal quarter, how much is closed, committed, at best case and in the pipeline, all in the company's corporate currency. A job rebuilds the rollup from opportunities, opportunity splits and dated exchange rates. Since the last release the sales operations team has raised five complaints. Deals reps have marked Omitted still inflate the pipeline. A euro deal that closed on the day a new rate took effect was converted at the old rate. On split deals only one member of the team sees any credit. Some reassigned deals still count for the rep who handed them over. With a fiscal year that starts in February, deals closing in February land in the wrong fiscal year. The function below is the suspect.

**Problem Statement.** Fix `forecast_rollup(opps, split_rows, rates, corporate, fy_start)` so that it meets this specification. {{replay_rule}}
1. **Opportunities.** Each is `{"id", "owner_history", "amount", "currency", "close_date", "category"}`. `amount` is an integer in the currency's minor units, and `close_date` is `"YYYY-MM-DD"`. `owner_history` is a list of `(date, user)` ownership changes in no particular order, with distinct dates. The owner is the user of the change with the latest date, so a deal reassigned in the middle of a quarter counts entirely for its new owner.
2. **Credit.** If `split_rows` has rows `(opp_id, user, percent)` for an opportunity, every one of those users is credited with their percent (the percents sum to 100). Otherwise the owner is credited with 100.
3. **Currency.** An opportunity in the `corporate` currency converts at exactly 1. Otherwise use the rate `(currency, effective_date, ppm)` for its currency with the latest `effective_date` on or before `close_date`. `ppm` is corporate units per 1 000 000 units of the currency. Each credited amount is `amount * percent * ppm // 100_000_000`, rounded down per credited user. Rates are not sorted. There is at most one rate per currency and date, and one always exists on or before a close date.
4. **Fiscal quarter.** The fiscal year starts on the first day of month `fy_start` (1–12) and is named by the calendar year in which it **ends**, so with `fy_start = 2` a deal closing on 10 February 2026 is in `FY2027-Q1`. Quarter 1 is the first three months of the fiscal year.
5. **Categories.** This exercise's rollup is cumulative: Closed counts in closed, commit, best_case and pipeline; Commit in commit, best_case and pipeline; Best Case in best_case and pipeline; Pipeline in pipeline; Omitted in none.
6. **Output.** `{"<user>/FY<year>-Q<n>": {"closed", "commit", "best_case", "pipeline"}}` with a row for every user and quarter credited by at least one opportunity, Omitted ones included (a rep whose only deal is Omitted shows a row of zeros).

**Constraints.** Keep the function's shape and output format. Up to 200 000 opportunities and 50 000 rates, in O((n + r) log r).

**Assumptions.** Opportunities, rates and calendars are hypothetical. Forecast categories, cumulative rollups, split credit, dated rates and fiscal-year naming are this exercise's rules; check current docs for how a real forecasting feature is configured. Amounts are never negative.

**Clarifications.**
- Q: Which rate applies when the rate changes on the close date itself? | A: The new one. A rate effective on the close date is "on or before" it.
- Q: Does a deal reassigned mid-quarter split its amount between the two owners? | A: No. The whole deal counts for the current owner, the user of the latest change.
- Q: When a deal has splits, does the owner get anything extra? | A: Only if the owner is one of the split rows.
- Q: Why does an Omitted deal create a row at all? | A: So a manager can see that a rep has deals in the quarter, even if all of them are Omitted. The row's numbers are zero unless other deals add to them.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. For each complaint, write the smallest input that reproduces it: one opportunity is usually enough.
2. Read the rate lookup at its boundary: the rate list for EUR is `["2026-01-01", "2026-04-01"]` and the deal closes on `2026-04-01`. Which index does `bisect_left` return, and which does `bisect_right`?
3. Look at every place the code builds a dict from rows, and ask what happens when two rows share a key.
4. Write out the fiscal year for every month with `fy_start = 2`, and compare with the rule.

**Follow-ups.**
1. Finance wants last quarter's forecast reproduced exactly as it was on the Friday it was reviewed, even though deals, owners and rates have changed since. What would you store?
2. Rates for a currency arrive a week late. Which rows change when they arrive, and how do you tell the sales leaders?
3. Splits that do not sum to 100 appear after a data import. What would you do with them, and where would you check?
4. The rollup runs for thousands of orgs with different fiscal calendars, including custom calendars with 13 periods. What would you change in the fiscal-quarter logic?

**Follow-up rules.**
- when: float, round(, decimal → ask: Where could a fraction of a cent appear in your fix, and which rounding rule does the specification ask for?
- when: sort the history, sorted(, max( → ask: Two ownership changes on the same date would make "latest" ambiguous. What would you ask the data owner to add?
- when: today's rate, current rate, latest rate → ask: Why does the specification tie the rate to the close date, and what would a leader see each week if you used today's rate?
- when: setdefault, defaultdict, append → ask: Which other dict in this function is built from rows that can share a key, and is it safe?
- when: calendar quarter, month // 3, (month - 1) // 3 → ask: With a fiscal year that starts in November, which quarter is January in, and which fiscal year?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; Omitted counts nowhere but keeps its row; the rate effective on the close date applies; every split member is credited and rounded down separately; the owner is the latest change by date; the first month of a fiscal year belongs to the new fiscal year; minimal fixes that keep the complexity; a test per bug.

## SFC-L2-04: Ingesting many sources into a customer data platform

| | |
|---|---|
| **Template ID** | SFC-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / connectors, mapping to a common model, freshness per source, multi-tenant ingestion |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "tenants": {"2": ["600", "2,500"], "3": ["15,000", "40,000"]},
  "daily_records": {"2": ["1 billion", "4 billion"], "3": ["30 billion", "80 billion"]},
  "fast_freshness": ["5 minutes", "15 minutes"],
  "batch_freshness": ["6 hours", "24 hours"]
}
```

**Business Scenario.** A customer data platform is offered to {{tenants}} customer orgs. Each org connects its own sources: the CRM's own objects, an online store, a mobile app's event stream, a marketing email tool, files dropped in cloud storage, and tables in the org's data warehouse. Together they bring in about {{daily_records}} records a day. Each org maps its sources onto a common data model (individuals, contact points such as email and phone, orders, engagement events) so that segmentation, identity resolution and analytics downstream can read one shape. Streaming sources should be queryable within {{fast_freshness}}; batch sources such as file drops and warehouse tables within {{batch_freshness}} of their arrival.

**Problem Statement.** Design the ingestion layer up to the common model. Cover the connector framework (push and pull, full and incremental extracts, credentials, retries), how raw data lands and is kept, how each org's field mappings and transformations are stored, versioned and applied, schema changes at the source, deletions at the source, how freshness is measured and reported per source, isolation between orgs on shared infrastructure, and what an org administrator sees when a source is late or broken. Identity resolution and segmentation are downstream; describe only what you hand to them.

**Constraints.** One org's data must never be visible to another, and a large org's backfill must not delay a small org's stream. A source can redeliver a file or replay a stream, and the result must not double count. A change to an org's mapping must be reproducible: you must be able to say which mapping version produced any record in the common model. A deletion in a source must reach the common model within a day.

**Assumptions.** All volumes, freshness targets and source types are hypothetical. Connector behaviours and limits are this exercise's; check current docs for any real product. Each source delivers either change events with a key and a timestamp, or periodic full extracts. The platform runs on shared compute with a shared object store and a lakehouse table format.

**Clarifications.**
- Q: Does the common model have fixed fields? | A: It has standard objects and fields, and orgs may add custom fields to them. Mappings are per org and per source.
- Q: How does a full extract tell you about deletions? | A: Only by absence: a key in yesterday's extract and not in today's. Some sources also send explicit delete events.
- Q: What does freshness mean for a batch source? | A: The time from a file's arrival in the drop location to its rows being queryable in the common model. For streams, from the event's ingestion time.
- Q: Who writes the mappings? | A: Org administrators in a configuration screen. They change them at any time, and sometimes get them wrong.
- Q: Can two sources write the same common-model record? | A: Yes, two sources can describe the same order. Keep both, with their source; reconciling them is downstream.

**Hints.**
1. Land everything raw, immutable and per org before mapping it. Remapping then means replaying from raw data, not asking the source again.
2. Make each common-model row carry its source, the source key, the source's own timestamp and the mapping version that produced it.
3. Measure freshness from the source's point of view, per source and per org, and publish it, not only an internal queue lag.

**Follow-ups.**
1. An administrator fixes a wrong mapping that has been live for two weeks. What do you reprocess, how long does it take for an org at {{daily_records}} a day, and what do downstream consumers see meanwhile?
2. A source adds a column, renames another and changes a date format, all without notice. What does each stage do?
3. A full extract arrives with 40% fewer rows than yesterday's. Do you treat the missing keys as deletions?
4. One org starts a backfill of five years of order history. How do you keep every other org inside {{fast_freshness}}?
5. How would you show an org administrator that a deletion requested in the source has reached every table you manage?

**Follow-up rules.**
- when: kafka, stream, partition key → ask: What is your partition key, and what happens to the other orgs on that partition when one org replays a month of events?
- when: schema registry, schema evolution, avro → ask: The source renames a field your mapping uses. Does ingestion stop, write nulls, or keep the old name, and who finds out?
- when: overwrite, upsert, merge into → ask: A source replays yesterday's events after a fix. How does your merge decide which version of a record wins?
- when: absence, missing keys, full extract → ask: A file is truncated in transit. What stops your pipeline from deleting half of the org's customers?
- when: mapping version, versioned mapping, lineage → ask: Downstream asks why one customer's email changed last Tuesday. What can you show them, record by record?

**Production Reality Check.**
- A partner's file drop delivers yesterday's file again, with a new name, for 300 orgs at once; freshness looks fine but the row counts double for some orgs.
- One org's warehouse connector backfill reads {{daily_records}} worth of history in an afternoon, and stream freshness for other orgs slips past {{fast_freshness}}.
- An administrator saves a mapping that sends the phone column into the email field; within an hour, downstream identity resolution starts merging profiles on phone numbers.

**Evaluation Criteria.** Connectors with clear incremental semantics and idempotent landing (file hash, source key and version); raw data kept immutable per org; mappings stored and versioned, every row stamped with its mapping version; replay from raw for remaps; schema changes detected and surfaced, not silently nulled; deletions handled both from explicit events and from absence, with a guard against truncated extracts; freshness measured per source and org and shown to administrators; fair sharing and quotas so one org cannot delay others; a plan for each incident.

## SFC-L2-05: Flow automation telemetry — runs, faults and the chain one save sets off

| | |
|---|---|
| **Template ID** | SFC-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Observability pipelines / execution traces, causal chains, element timings, tenant-safe telemetry |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "orgs": {"2": ["5,000", "20,000"], "3": ["150,000", "400,000"]},
  "daily_runs": {"2": ["300 million", "1 billion"], "3": ["15 billion", "40 billion"]},
  "detail_retention": ["7 days", "30 days"],
  "max_depth": [5, 16]
}
```

**Business Scenario.** A CRM lets administrators build automations without code: record-triggered flows that run before or after a record is saved, scheduled flows, and flows started by platform events. One save can set off a chain: a flow on an opportunity updates its account, which triggers the account's flow, which creates a task, which triggers another flow, some of it in the same transaction and some on asynchronous paths later. Across {{orgs}} orgs there are about {{daily_runs}} flow runs a day. Administrators ask "why did this record change?", "which flow failed and why?" and "which element makes saves on this object slow?". This exercise's platform stops a chain deeper than {{max_depth}} levels and enforces per-transaction limits on queries and record updates.

**Problem Statement.** Design the telemetry pipeline for flow runs. Cover what each run emits (run, element and fault events, timings, the limits it used), how runs in one save are tied together into a chain across synchronous and asynchronous steps, where the telemetry is produced so it does not slow the save, how it is transported, stored and aggregated, what is kept in detail and for how long ({{detail_retention}} in detail, aggregates longer), the views an administrator gets for one record, one flow and the whole org, and how you make sure no record field values from the customer's data leak into telemetry or across orgs.

**Constraints.** Telemetry must never fail or noticeably slow a save; if the pipeline is behind, runs still execute. An administrator sees only their own org. Field values are customer data and are not recorded by default; record ids are. Some chains finish in milliseconds and others continue for hours through asynchronous steps. Costs scale with {{daily_runs}} runs a day, most of which succeed in under 100 ms.

**Assumptions.** All volumes, depth limits, retention periods and per-transaction limits are hypothetical and this exercise's own; check current docs for how a real automation platform records runs and enforces limits. Each run has a flow id, a flow version, an org id, the triggering record id and an element-by-element path.

**Clarifications.**
- Q: Do I store every element of every successful run? | A: You decide, and justify it with the cost at {{daily_runs}} runs a day. Failed runs must be kept in full detail.
- Q: What ties an asynchronous step to the save that caused it? | A: Nothing yet. You design the identifiers that carry the chain across steps.
- Q: Can an administrator turn on extra detail, such as field values, for debugging? | A: Yes, for one flow or user for a limited time, with an audit record. Default telemetry never has values.
- Q: What does "the chain one save sets off" include? | A: Every flow run caused directly or indirectly by that save, in this transaction or later asynchronous steps, with the record each one changed.
- Q: How fast must a failure show up? | A: An administrator watching a failing flow should see the fault within a minute.

**Hints.**
1. Give every save a chain id and every run a run id and a parent run id; pass them through asynchronous work the same way a distributed trace passes its context.
2. Buffer telemetry in memory on the application server and ship it asynchronously, with a bounded buffer and counted drops, so a slow pipeline costs data, not saves.
3. Decide on sampling per outcome: keep all faults and slow runs, sample fast successes, and keep exact counts in aggregates regardless.

**Follow-ups.**
1. An administrator asks why an account's rating changed at 10:42 yesterday. Walk through the query and the data that answers it.
2. A flow fails one run in a thousand, only for records owned by one queue. How do your aggregates make that visible, and what detail do you need?
3. One org's flows loop until they hit the {{max_depth}}-level limit thousands of times an hour. What does your pipeline do with that volume, and what do you tell the administrator?
4. You sample fast successful runs. How do you still report an exact run count and an accurate p95 duration per flow?
5. A flow version is deployed from a sandbox. How do you compare its timings and fault rate with the previous version fairly?

**Follow-up rules.**
- when: synchronous write, same transaction, write the log in → ask: The telemetry store is slow for ten minutes. What happens to every save in every org during those ten minutes?
- when: sampling, sample → ask: Which runs are never sampled out, and how do you correct the counts and percentiles for the ones that are?
- when: trace id, chain id, parent run, correlation id → ask: How does your id survive a step that is queued and runs two hours later on another server?
- when: field values, record data, payload → ask: Whose data is that, who can see it in your store, and how long do you keep it?
- when: per org table, tenant id, org id → ask: How do you stop one org's runaway loop from filling the storage and query capacity every other org shares?

**Production Reality Check.**
- A loop in one org's flows produces 30% of all runs for an hour, every chain stopping at the {{max_depth}}-level limit.
- The telemetry buffer fills during a storage outage, and four minutes of successful-run events are dropped; the next day an administrator asks for a run in that window.
- An administrator's debugging session captured field values for one flow and was never switched off; three weeks later the values are still being recorded.

**Evaluation Criteria.** Run, element and fault events with flow version, org, record id and limit use, and no field values by default; chain and parent ids that carry across synchronous and asynchronous steps; non-blocking emission with bounded buffers and counted drops; tiered storage with {{detail_retention}} of detail and longer aggregates; sampling that keeps faults and slow runs and exact aggregate counts; per-org isolation in storage and queries with quotas against noisy orgs; administrator views for a record, a flow and an org; time-boxed, audited value capture; a plan for each incident.
