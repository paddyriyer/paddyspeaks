# Snowflake · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a cloud data
platform: virtual warehouses, storage, secure data sharing, a data marketplace and
ingestion. Every workload, number, schema and incident is hypothetical, and where a
product rule is used it is this exercise's rule; check current docs. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## SNO-L3-01: One analytics product, many tenants — schema per tenant or shared tables with row access policies

| | |
|---|---|
| **Template ID** | SNO-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / multi-tenant isolation, row access policies, per-tenant schemas, cost attribution |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "tenants": {"1": ["300"], "2": ["4,000", "12,000"], "3": ["60,000", "150,000"]},
  "largest_share": ["15%", "35%", "60%"],
  "custom_fields": ["up to 20 custom fields per tenant", "up to 200 custom fields per tenant"],
  "regions": ["one region", "two regions, with EU tenants' data kept in the EU"]
}
```

**Business Scenario.** A SaaS company sells a customer-support product and builds its in-product analytics on a cloud data platform. It has {{tenants}} tenant companies; the largest tenant holds about {{largest_share}} of all rows, while most tenants are tiny. Each tenant's users see dashboards of tickets, agents, response times and satisfaction, and some tenants add their own fields ({{custom_fields}}). Large tenants also want a direct, governed way to query their own data, and the company runs in {{regions}}. The data team must choose between a schema (or database) per tenant and shared tables where every row carries a tenant id and access is filtered by a row access policy, and it must be able to say what each tenant costs to serve.

**Problem Statement.** Design the data model and the isolation scheme. Cover: the core tables (tickets, ticket events, agents, satisfaction surveys) and their keys; where the tenant id lives and how it is enforced on every read path (dashboards through a service account, direct tenant queries, internal analysts); how custom fields are stored and queried; the trade-offs of schema-per-tenant versus shared tables versus a hybrid (dedicated objects for the largest tenants), including deployment of schema changes, onboarding and offboarding, clustering and pruning for tiny and huge tenants, and the cost of many small objects; and how compute and storage cost is attributed to tenants.

**Constraints.** A tenant must never see another tenant's rows, through any path, including cached results and exports. A tenant's data can be deleted completely on request within a stated time. Schema changes ship to every tenant on one release cadence. Data residency, where it applies, is never broken by replication or by internal analysts' queries.

**Assumptions.** Tenant counts, shares and limits are hypothetical. Row access policies, secure views, role-based access and per-tenant databases are features of the platform in this exercise; check current docs for their exact behaviour and limits. Internal analysts may query across tenants only in aggregated, approved views.

**Clarifications.**
- Q: Do tenants query the warehouse directly? | A: The largest ones want to, through their own login or through data shared to their own account. Everyone else uses the dashboards.
- Q: How are dashboards authenticated? | A: Through a backend service account that runs queries on behalf of a signed-in tenant user. You decide how the tenant context reaches the query.
- Q: Can tenants define arbitrary custom fields? | A: Yes, typed (text, number, date, picklist), within the stated limit, and they can rename or retire them.
- Q: What does offboarding require? | A: All of the tenant's data removed from the platform within 30 days of the request, with evidence; you say what happens to backups and recovery copies.
- Q: Do internal teams need cross-tenant data? | A: Yes, for benchmarks such as "median first response time across tenants", only in aggregate and above a minimum group size.

**Hints.**
1. Start from the threat model: list every read path and say where the tenant filter is applied on each. A filter the caller can forget is not isolation.
2. Shared tables make schema changes and small tenants cheap; dedicated objects make deletion, residency and very large tenants simpler. A hybrid needs a rule for when a tenant moves.
3. Custom fields can be a typed key-value table, a semi-structured column, or generated columns per tenant. Think about how a dashboard filters and groups on them.

**Follow-ups.**
1. Write the row access policy logic (in pseudocode) for shared tables, including how the dashboard service passes the tenant context and how an internal analyst role is handled.
2. The largest tenant holds {{largest_share}} of rows. How do clustering and pruning behave for it and for a tenant with 2,000 tickets in the same table?
3. A tenant asks to be deleted. Walk through shared tables versus a dedicated schema, including time travel and recovery copies.
4. A schema change adds a column to tickets. How does it reach {{tenants}} tenants in each design, and how do you test it?
5. Show how one month's compute cost is split across tenants when dashboards for many tenants share one warehouse.

**Follow-up rules.**
- when: schema per tenant, database per tenant, separate schema → ask: You will have {{tenants}} schemas. How do you deploy one column change to all of them, and what do you do when it fails halfway?
- when: row access policy, row-level security, tenant_id → ask: The dashboard service connects with one service account. How does the policy know which tenant is asking, and what stops the service from passing the wrong one?
- when: secure view → ask: Why a secure view rather than an ordinary view here, and what does that cost the optimiser?
- when: variant, json, semi-structured → ask: A tenant filters a dashboard on a custom date field stored inside a semi-structured column. How fast is that, and how do you validate the type?
- when: eav, key-value, entity attribute value → ask: A dashboard groups by three custom fields. How many self-joins is that, and how would you avoid them?

**Production Reality Check.**
- A dashboard query's cached result was served to a user of another tenant because the cache key did not include the tenant context passed by the service account; with {{tenants}} tenants the blast radius is unknown until the query log is checked.
- An onboarding script creates a schema per new tenant; a failed release left some schemas one column behind, and every dashboard query for those tenants errors after the next deploy.
- The largest tenant, with {{largest_share}} of rows, runs heavy direct queries on the shared dashboard warehouse at month end, and every small tenant's dashboards time out.

**Evaluation Criteria.** Tenant id on every row and enforced by policy on every read path, not by caller discipline; a clear, justified choice (or hybrid with a promotion rule) weighing deployment, deletion, residency, pruning and object count; custom fields modelled for filtering and typing; deletion including recovery copies; cost attribution per tenant from query history; separate compute for heavy tenants; each incident contained, corrected and guarded.

## SNO-L3-02: Device events as semi-structured data — what to flatten, how to survive drift

| | |
|---|---|
| **Template ID** | SNO-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / semi-structured columns, flattening, schema drift, pruning and query performance |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_events": {"1": ["50 million"], "2": ["800 million", "2 billion"], "3": ["10 billion", "25 billion"]},
  "event_types": [40, 300, 1200],
  "app_versions": [6, 25],
  "drift": ["a few new fields a month", "new fields every week, and some fields change type"]
}
```

**Business Scenario.** A connected-fitness company streams JSON events from its app and devices into a cloud data platform: about {{daily_events}} events a day across {{event_types}} event types. A typical event has an envelope (event id, type, device id, user id, app version, timestamps) and a payload whose shape depends on the type: workout summaries, heart-rate samples as arrays, nested settings objects, and error reports. {{app_versions}} app versions are live at once, and the payload drifts: {{drift}}. Today everything lands as one semi-structured column, and analysts write path expressions against it; their queries are slow and sometimes silently wrong after a release.

**Problem Statement.** Design the model from landing to analysis. Cover: the raw landing table (what is typed, what stays semi-structured, and the keys and load metadata kept); which fields are extracted into typed columns and which tables are flattened (for example, one row per heart-rate sample or per workout lap); how schema drift is detected and handled (new fields, renamed fields, type changes, JSON null versus missing) without losing data or breaking queries; how queries prune by time and device; and the contract between app teams and the data team for event payloads.

**Constraints.** No event is dropped because its payload is unexpected; unparseable or invalid records are kept and counted. A field's meaning never changes under the same name in a typed table. Analysts can query new fields within a day of a release without a code change from the data team, but dashboards read only typed, documented columns. Raw events are kept for a stated period for replay.

**Assumptions.** Volumes, type counts and drift rates are hypothetical. In this exercise the platform stores a semi-structured column in a columnar form and can prune on some paths, but values whose type varies across rows, dates stored as strings and arrays get less benefit; check current docs for the exact behaviour. Timestamps in payloads are device clocks and can be wrong.

**Clarifications.**
- Q: Do all event types need typed tables? | A: No. About a dozen types serve most dashboards; the long tail is explored ad hoc.
- Q: What does a type change look like? | A: For example, `distance` changed from a number in metres to a string such as "5.2 km" in one app version.
- Q: Are arrays large? | A: Heart-rate samples can have thousands of elements per workout; most other arrays are small.
- Q: Is a JSON null the same as a missing field? | A: Not to the app teams: null means "measured, no value", missing means "this version does not send it". You decide how the model keeps the difference.
- Q: Can the app teams change the payload format? | A: They can add versioned schemas and follow a contract you propose, but old app versions stay in the field for months.

**Hints.**
1. Keep the raw envelope typed and the payload semi-structured; extract the paths that are filtered, joined or aggregated often into typed columns, with the extraction rule versioned.
2. Arrays that analysts aggregate (samples, laps) deserve their own flattened table at their own grain, keyed by event id and index.
3. Drift is a data-quality signal: profile new paths and type mismatches per app version each load, and route bad values to a rejects column or table instead of casting them to NULL.

**Follow-ups.**
1. Estimate rows in a flattened heart-rate sample table at {{daily_events}} events a day if 2% of events are workouts with 1,800 samples each. Partitioning, clustering and retention?
2. `distance` changes from a number to a string in one app version. What happens to the typed column, the dashboards and the history?
3. An analyst wants a new field from yesterday's release. What do they query today, and how does it become a typed column?
4. Write the check that would have caught a release where `user_id` moved from the envelope into the payload.
5. Compare three ways to keep {{event_types}} event types: one wide table, one table per type, or a typed envelope plus a semi-structured payload with a few flattened children. When does each win?

**Follow-up rules.**
- when: flatten, lateral flatten, explode → ask: Flattening a workout with 1,800 samples multiplies rows. Which queries need the flattened table, and which should stay on the summary?
- when: one table per event type, table per type → ask: With {{event_types}} types and new ones each month, who creates the tables, and how does a cross-type query (all events for one device in an hour) work?
- when: variant, semi-structured column, json column → ask: An analyst filters on a payload path for one day. How much of the table does that read, and what would make it prune?
- when: cast, try_cast, to_number → ask: A cast fails for one app version. Does the row disappear, become NULL, or go somewhere you can count?
- when: schema registry, data contract, contract → ask: Old app versions stay in the field for months and ignore the new contract. What does your pipeline do with their events?

**Production Reality Check.**
- An app release sends `distance` as a string; the typed column casts it to NULL, and weekly distance on dashboards drops by a fifth for users on that version without any load error.
- A query over one day of workouts scans the whole landing table: the analysts' filter is a payload timestamp stored as a string, not the typed event date the table is clustered on; at {{daily_events}} events a day the warehouse runs for hours.
- With {{drift}}, a renamed field appears under its new name in new app versions while old versions keep the old name; one dashboard counts only the new name and reports a false 40% drop in a feature's use.

**Evaluation Criteria.** Typed envelope and kept raw payload with load metadata; a principled rule for which paths become typed columns and which arrays become child tables at their own grain; drift detected per app version with rejects kept and counted, never silent NULLs; null versus missing preserved; pruning on typed time and device columns; a contract with versioning that tolerates old clients; storage and row estimates; each incident contained, corrected and guarded.

## SNO-L3-03: A retail star schema — returns, promotions, currencies and stores that arrive late

| | |
|---|---|
| **Template ID** | SNO-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / dimensional design, conformed dimensions, late-arriving dimension members, currency conversion |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "stores": {"1": ["400"], "2": ["2,500", "6,000"], "3": ["15,000", "30,000"]},
  "daily_lines": {"1": ["5 million"], "2": ["40 million", "90 million"], "3": ["300 million", "700 million"]},
  "currencies": [3, 12, 40],
  "store_lag_days": [2, 10, 30]
}
```

**Business Scenario.** A retail chain, a customer of a cloud data platform, sells through {{stores}} stores and an online channel in {{currencies}} currencies, about {{daily_lines}} sales lines a day. Returns can happen in any store, weeks later, with or without the original receipt. Promotions (percentage off, buy-one-get-one, basket thresholds, loyalty coupons) can stack, and a line can carry several. New stores, pop-ups and franchise stores start trading before the master-data team registers them: their sales arrive with a store code the warehouse has never seen, and the store's details follow up to {{store_lag_days}} days later. Finance reports in one group currency; country managers report in local currency.

**Problem Statement.** Design the star schema. Cover: the grain of the sales fact and of a returns fact (or one fact with signed rows), with their keys and measures; the dimensions (date, store, product, customer or loyalty member, promotion, currency) and which are slowly changing and how; how multiple promotions per line are represented (a bridge, an allocation, or a factless coverage fact); how returns link to the original sale when they can and what happens when they cannot; how currency conversion is modelled (which rate, which date, stored or computed); and how a sale with an unknown store code is loaded and later corrected.

**Constraints.** Sales are never dropped or delayed because a dimension member is missing. Reported net sales for a closed month change only through a documented restatement. Amounts are stored in the transaction currency, in minor units, with conversion reproducible. A store that moves region keeps its history in the region it belonged to when it sold.

**Assumptions.** Store counts, volumes, currency counts and lags are hypothetical. Exchange rates come from a daily reference feed. Product and store master data is owned by other teams. Discounts are known at line level from the point-of-sale system.

**Clarifications.**
- Q: Do returns carry the original receipt? | A: Most do. About a fifth are returns without a receipt, refunded at the current price.
- Q: How does finance convert currency? | A: At the daily reference rate of the transaction date. Country managers use local currency only. You decide what to store.
- Q: Can a line have several promotions? | A: Yes, up to four; the point-of-sale system records each promotion's discount on the line.
- Q: When a store changes region, how should last year's sales be reported? | A: Both ways: "as it was" for financial history and "as it is now" for like-for-like comparisons. Say which is the default.
- Q: What do we know about an unknown store code on arrival? | A: Only the code and the currency of its sales.

**Hints.**
1. State the grain of each fact in one sentence before naming columns; a sales line and a return line are different events.
2. A late-arriving store can be loaded as an inferred (placeholder) dimension row keyed by its code, updated in place when the master data arrives; history starts from there.
3. Store amounts in transaction currency and convert in a view or a derived column using a rate table keyed by currency and date, so a rate correction does not require reloading facts.

**Follow-ups.**
1. Write the definition of net sales in group currency for a month, including returns of sales from earlier months and returns without a receipt.
2. A line carries a 20% discount and a basket coupon. How do your promotion tables answer "sales lift and discount cost by promotion" without double-counting?
3. A store's code arrives {{store_lag_days}} days before its master data. What do the dashboards show in between, and what changes when the master data lands?
4. The rate feed corrects last Tuesday's rate for one currency. What changes in the warehouse and in reports?
5. At {{daily_lines}} lines a day, how do you cluster or partition the facts, and what do most queries filter on?

**Follow-up rules.**
- when: scd type 2, type 2, valid_from → ask: The store changed region in March. Show the two queries for "as it was" and "as it is now" against your store dimension.
- when: bridge, promotion bridge → ask: A line with two promotions appears twice in the bridge. How does a SUM of sales over promotions avoid counting the line twice?
- when: unknown store, unknown member, default member → ask: You mapped the unknown store to one default member. When the real store arrives, how do last week's sales move to it?
- when: convert at load, converted amount → ask: The rate for last Tuesday was corrected. Which rows do you rewrite, and how do you prove the restated total?
- when: negative quantity, negative row, signed → ask: How does a return of last month's sale show in this month's net sales and in last month's return rate?

**Production Reality Check.**
- A new store traded for {{store_lag_days}} days before registration; its sales were mapped to a single "unknown" member and, when the store arrived, they stayed there, so the region's like-for-like growth was understated for the quarter.
- A promotion bridge without an allocation factor made total discount cost by promotion exceed total discount on the receipts by 18% for basket-threshold offers.
- The reference rate for one of {{currencies}} currencies was loaded a day late; facts converted at load time used the previous day's rate and the month's group-currency sales were restated after close.

**Evaluation Criteria.** Explicit grains for sales and returns with signed or separate facts; conformed date, store, product, promotion and currency dimensions with justified SCD choices and both "as was" and "as is" reporting; promotions modelled without double-counting (bridge with allocation or per-promotion discount rows); returns linked when possible and handled when not; amounts in transaction currency with reproducible conversion; inferred members for late stores, corrected without losing sales; clustering for the dominant filters; each incident contained, corrected and guarded.

## SNO-L3-04: A query-history model for workload analysis — queued, compiling and executing time

| | |
|---|---|
| **Template ID** | SNO-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / query history facts, warehouse dimensions with size history, time breakdowns, query fingerprints |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_queries": {"1": ["200,000"], "2": ["3 million", "8 million"], "3": ["40 million", "120 million"]},
  "warehouses": [25, 120, 600],
  "history_latency": ["45 minutes", "3 hours"],
  "retention_days": [90, 365]
}
```

**Business Scenario.** A platform team inside a large company runs {{warehouses}} virtual warehouses on a cloud data platform for dozens of teams, about {{daily_queries}} queries a day from dashboards, scheduled pipelines and people. The platform exposes query history (text, user, role, warehouse, start and end times, bytes scanned, partitions scanned and total, and a breakdown of time spent compiling, queued and executing) and warehouse metering, with a delay of up to {{history_latency}} in this exercise. The team wants its own model of this history, kept for {{retention_days}} days and longer in aggregate, to answer: which workloads queue and on which warehouses, whether a warehouse should be resized or given more clusters, which repeated queries cost the most, and what each team spends.

**Problem Statement.** Design the workload-analysis model. Cover: the query fact (grain, keys, the time breakdown as separate measures, and status); dimensions for warehouse (with size and cluster settings as history), user, role, team and workload (from query tags or a mapping); a query fingerprint (the query text with literals replaced) as a dimension; how incremental loads handle the history's delay and late updates for long-running queries; how compute credits, which are metered per warehouse rather than per query, are allocated to queries and teams; and the aggregates that serve "queued time by warehouse and hour", "top fingerprints by cost" and "spend by team".

**Constraints.** Every query is counted once, even when it appears in the history before it finishes and again after. A warehouse's size at the time of a query is reproducible after it is resized. Allocated credits for a warehouse-hour sum exactly to its metered credits. Query text can contain literals with customer data and must be access-controlled; the fingerprint is not.

**Assumptions.** Volumes, warehouse counts, latencies and retention are hypothetical; check current docs for the platform's actual query history columns, retention and delay. Teams tag their queries inconsistently; a mapping from user or role to team exists for the rest.

**Clarifications.**
- Q: Is queued time one number? | A: In this exercise the history separates time queued while the warehouse was starting (provisioning) from time queued because the warehouse was busy (overload). Keep them apart.
- Q: Can a query appear before it finishes? | A: Yes. A running query can appear with a partial record and is updated when it ends.
- Q: How are credits allocated to queries? | A: You choose. Execution time weighted by warehouse size within each warehouse-hour is common; say what you do with idle time.
- Q: Do teams tag queries? | A: Pipelines usually do; dashboards and people rarely do.
- Q: Should failed and cancelled queries count? | A: Yes, they used compute. Keep their status and error class.

**Hints.**
1. Grain: one row per query id, with start time, end time and each time component as its own measure. Load it as a MERGE on query id over a window wider than the history's delay.
2. Warehouse settings are a type 2 dimension (size, min and max clusters, scaling policy) from a settings-change log or periodic snapshots; join by time, not by current value.
3. Allocate each warehouse-hour's metered credits over the queries that ran in it, then carry idle credit as its own line so the totals reconcile.

**Follow-ups.**
1. Define "queued share" for a warehouse-hour precisely. When does it argue for a bigger warehouse and when for more clusters?
2. Write the allocation rule for a warehouse-hour in which three queries ran for 10, 20 and 30 minutes and the warehouse was idle for 20 minutes.
3. How do you compute a fingerprint so that `WHERE id = 5` and `WHERE id = 7` match, but two different reports do not? What can go wrong?
4. The history arrives up to {{history_latency}} late and long queries are updated after they end. Design the incremental load and its watermark.
5. At {{daily_queries}} queries a day, kept {{retention_days}} days at full grain: storage, clustering, and what you aggregate for longer.

**Follow-up rules.**
- when: execution time, elapsed time, total time → ask: A dashboard query waited four minutes in the queue and ran for two seconds. Which number does your model blame, and what does the team see?
- when: query text, sql text → ask: Query text contains customer literals. Who can read it in your model, and what can everyone else group by?
- when: allocate, allocation, chargeback → ask: A warehouse ran one query a minute all day and was idle in between. Does the idle credit vanish, go to the queries, or get its own line?
- when: current size, warehouses table → ask: The warehouse was resized yesterday. How do last week's queries know the size they ran on?
- when: append, insert only → ask: A long query appears first as running and again when it finishes. How do you avoid counting it twice?

**Production Reality Check.**
- The incremental load used a watermark equal to the last loaded end time; with history arriving up to {{history_latency}} late, a day of queries from {{warehouses}} warehouses was skipped, and team spend for that week was under-reported by 6%.
- A warehouse's size was read from the current settings; after it was halved, last quarter's cost per fingerprint was recomputed at the new size and two teams' chargebacks changed after invoicing.
- Queued time was reported as a single number; a warehouse with long provisioning queues (cold starts after auto-suspend) was given more clusters, which did not help and doubled its peak spend.

**Evaluation Criteria.** Query grain with a MERGE on query id over a delay-aware window; the time breakdown as separate measures, including the two kinds of queueing; warehouse settings as history joined by time; fingerprints defined with their limits; credits allocated so that each warehouse-hour reconciles to metering, idle time explicit; text access-controlled; retention and aggregates sized; each incident contained, corrected and guarded.

## SNO-L3-05: Warehouse credits per hour — per-second billing and a 60-second minimum after each resume

| | |
|---|---|
| **Template ID** | SNO-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / event log to runs, state changes, interval splitting at hour boundaries, minimum charges |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SNO-L3-05.mjs |

**Business Scenario.** A company runs several virtual warehouses on a cloud data platform (here {{warehouse_list}}). A warehouse uses compute credits only while it runs: auto-resume starts it when a query arrives and auto-suspend stops it after a quiet spell, so it can start and stop many times an hour. In this exercise (check current docs for the actual rules) a running warehouse is billed per second at its size's `credits_per_hour` from `warehouse_sizes`, and each time it resumes it is billed for at least 60 seconds. The FinOps team wants credits per warehouse and hour, computed from the warehouse event log, to check against the platform's metering and to find warehouses that pay mostly for minimums.

**Problem Statement.** Write one PostgreSQL query that returns `warehouse_name, hour_start, billed_seconds, credits`: one row per warehouse and UTC hour that has at least one billed second before report_end, here `{{report_end}}`, ordered by `warehouse_name, hour_start`. {{events_rule}} A run starts when a suspended warehouse resumes and ends at its next SUSPEND (or at report_end, if it is still running then). It is billed for every second it runs, and if it ran for less than 60 seconds it is billed as though it kept running, at its last size, until 60 seconds after its resume. Each resume pays its own minimum, so the minimums of two runs a few seconds apart can overlap, and both are billed. Billed time is split at hour boundaries: `billed_seconds` is the number of billed seconds in the hour, summed over runs, and `credits` is Σ(seconds × credits_per_hour) / 3600 over those seconds, rounded to 4 decimal places once, at the end. Nothing at or after report_end is billed. {{end_rule}}

**Constraints.** One SQL statement (CTEs allowed). An hour is [hh:00:00, hh+1:00:00) in UTC; a run that suspends exactly at hh:00:00 bills nothing in the hour that starts then. No two events of one warehouse share a timestamp. The sample has {{events}} events; production has thousands of warehouses and millions of events a day.

**Assumptions.** Hypothetical warehouses, times and quantities. The rate table (X-Small 1, Small 2, Medium 4, Large 8, X-Large 16 credits per hour) and the billing rule are this exercise's; check current docs. In this exercise a resize changes the rate at that instant and does not start a new minimum. Multi-cluster warehouses, serverless features and cloud-services credits are out of scope.

**Clarifications.**
- Q: A warehouse runs for 20 seconds. How much is billed? | A: 60 seconds at its size: the run is billed as though it ran until 60 seconds after its resume.
- Q: It resumes at 10:59:50 and suspends at 10:59:55. Which hours get the seconds? | A: 10 seconds in the 10:00 row and 50 seconds in the 11:00 row; the minimum is billed as running time, so it follows on after the run.
- Q: It resumes at 10:00:00, suspends at 10:00:20, resumes at 10:00:30 and suspends at 10:00:40. How many seconds? | A: 120. Each resume pays its own 60-second minimum: [10:00:00, 10:01:00) and [10:00:30, 10:01:30), even though they overlap.
- Q: Should hours with no billed seconds appear? | A: No. Only hours with at least one billed second.
- Q: Should I round credits per run? | A: No. Sum the exact credits for the hour, then round once to 4 decimal places.

**Hints.**
1. Turn the log into runs first: order each warehouse's RESUME and SUSPEND events and pair each RESUME with the event after it (LAG and LEAD over the warehouse's events). If the log can hold no-ops, keep only events whose type differs from the previous RESUME or SUSPEND.
2. A run's billed end is the later of its end and resume + 60 seconds, and never later than report_end. If sizes change, build size intervals (each RESIZE until the next) and intersect them with the run.
3. To split an interval at hours, generate the hours it touches with `generate_series(date_trunc('hour', start), end - INTERVAL '1 microsecond', INTERVAL '1 hour')` and take the overlap with each. Sum seconds × rate as integers before dividing by 3600.

**Follow-ups.**
1. Your totals differ from the platform's metering by a few percent. List the causes you would check first, in order.
2. Write the query that finds warehouses where the minimum's padding is more than 20% of billed credits, and say what you would recommend to their owners.
3. Multi-cluster warehouses bill each cluster separately, with its own start. How does the model and this query change?
4. At millions of events a day, make this incremental: what state must carry over from one hour's run to the next, and how do you handle a SUSPEND that arrives late?

**Follow-up rules.**
- when: lead, lag → ask: With LEAD from each RESUME to the next event, what happens when a RESIZE, or a second RESUME, sits between it and its SUSPEND?
- when: date_trunc → ask: A run lasts from 10:40 to 12:15. If you truncate only its start to the hour, where do its 95 minutes go? How do you split it?
- when: greatest, minimum, 60 seconds → ask: Two runs resume 30 seconds apart and each lasts 10 seconds. Is your minimum per run, or per warehouse and minute, and what would the bill say?
- when: round → ask: Do you round per run or per hour? Show what 3,600 separate one-second X-Small charges round to each way.
- when: union, merge intervals, overlap → ask: You merged overlapping billed intervals. Is that what the billing rule says, and what does it do to two minimums that overlap?

**Production Reality Check.**
- A monitoring probe resumes one of {{warehouse_list}} every 70 seconds for a one-second query, and auto-suspend stops it in between; each resume pays its own 60-second minimum, and this report shows the idle warehouse costing more than the busiest one.
- A run of this report up to {{report_end}} disagreed with a rerun the next morning for the same hours: runs open at report_end were billed only up to it, and SUSPEND events still arriving late moved seconds between hours. Finance numbers should come only from hours closed after the log's delay.

**Evaluation Criteria.** Runs built from the event log with LAG/LEAD and, at the hardest level, no-op events removed by state change; the 60-second minimum applied per resume, as running time after the run, at the run's last size; size intervals intersected with runs; intervals split at hour boundaries with exact boundary handling; report_end respected, with open runs billed up to it; exact integer sums before one rounding; deterministic ordering; can explain metering differences, padding waste and incremental state.
