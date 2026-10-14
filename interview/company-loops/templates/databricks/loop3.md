# Databricks · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a data and AI
platform built around a lakehouse, Apache Spark and an open table format (data
files in cloud object storage plus a transaction log). Every workload, number,
schema and incident is hypothetical, and nothing here describes how the
company's own systems are built. Where a public behaviour of the platform, the
open format or Spark is used, it is this exercise's rule; check current docs.

## DBX-L3-01: Clickstream in bronze, silver and gold — schema drift and a quarantine that gets read

| | |
|---|---|
| **Template ID** | DBX-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / medallion layers, event grain, schema evolution, rescued data, quarantine, replay-safe deduplication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_events": {"1": ["300 million"], "2": ["2 billion", "5 billion"], "3": ["20 billion", "40 billion"]},
  "app_versions": [6, 15, 40],
  "late_days": [3, 7],
  "invalid_share": ["0.2%", "1%", "3%"]
}
```

**Business Scenario.** A retailer runs its analytics on a lakehouse. Its web site and two mobile apps send clickstream events (page views, searches, add-to-cart, checkout steps) as JSON files that land in cloud object storage, about {{daily_events}} events a day. At any time about {{app_versions}} app versions are live, each with its own idea of the event payload: fields get added, renamed or change type between releases, and old versions keep sending the old shape for months. Phones buffer events offline and upload them up to {{late_days}} days late, and a client retry can upload the same event twice. About {{invalid_share}} of events are unusable as sent (no event time, unknown event type, a user id in the wrong format). The data team wants three layers: a raw layer that never loses anything, a cleaned layer that analysts and data scientists can trust, and business tables (sessions, a daily product funnel, marketing attribution inputs) that the dashboards read.

**Problem Statement.** Design the tables in the three layers (bronze, silver, gold) and the rules between them. Cover: the bronze table's columns and partitioning, including what you keep about where each row came from; how schema changes are handled at each layer (new fields, type changes, renamed fields, fields you did not expect), including a rescued-data column for values that do not fit the declared schema; the silver event table's grain, keys, types and deduplication rule; the quarantine design for unusable events (what is kept, the reason codes, who reads it and how a fixed event re-enters silver); the gold tables' grains; and how late events and replays of bronze flow through to gold without double counting.

**Constraints.** Bronze is append-only and keeps every byte that arrived, including events that fail validation. Silver holds each event once, with typed columns and an event time in UTC. No event disappears silently between bronze and silver: every bronze row is either in silver, in quarantine, or explained by a deduplication rule. Gold numbers for a day can change only while that day is inside the late-arrival window, unless a documented restatement says otherwise.

**Assumptions.** Volumes, version counts and shares are hypothetical. Each event carries a client-generated event id, an app version and a client timestamp; the server adds a receive time. In this exercise the ingestion tool can add new columns to bronze automatically and put values that do not match the declared type into a rescued-data column; check current docs for the exact behaviour.

**Clarifications.**
- Q: Is the client event id unique? | A: It is meant to be, per device. A retry resends the same id; a buggy app version once reused ids after reinstall, so you should say what the deduplication key is and why.
- Q: Which time do analysts use, client or server? | A: Event time is the client timestamp, but clocks on phones can be wrong by hours. Say how you keep both and when you trust which.
- Q: Who owns the quarantine? | A: Today nobody. Part of the answer is who looks at it, how often and what they do with it.
- Q: Can a field change meaning without changing name? | A: Yes. One release started sending `price` in minor units instead of major units. Say how you would notice.
- Q: Must gold tables be rebuilt from scratch when a schema changes? | A: No; full rebuilds of {{daily_events}} a day are expensive. Say what is incremental and what is recomputed.

**Hints.**
1. Bronze is about provenance (file, offset or row number, ingest time, app version, the raw payload or rescued data), not about meaning; silver is about meaning.
2. Decide the deduplication key and window for silver, and make the silver write idempotent so a replay of bronze changes nothing.
3. Quarantine is a table with a reason code and the raw record, plus a way back into silver; a counter of dropped rows is not a quarantine.

**Follow-ups.**
1. Write the silver deduplication rule. A retried event arrives twice, two days apart, with different receive times. Which copy wins, and what does a replay of last week's bronze files do?
2. App version 7.3 starts sending `duration` as a string. What happens in bronze, in silver and in the gold session table that same hour?
3. Events arrive up to {{late_days}} days late. Which gold partitions does each run touch, and when is a day's funnel final?
4. A fix for the user-id format means a week of quarantined events are now valid. Walk through how they re-enter silver and gold without counting anything twice.
5. At {{daily_events}} events a day, how do you lay out bronze and silver (partitioning, clustering, file sizes) so that both the incremental pipeline and an analyst's query for one user's session stay cheap?

**Follow-up rules.**
- when: drop invalid, filter out, discard → ask: About {{invalid_share}} of events are unusable. A product manager asks next month how many checkouts you lost when one app version broke. Where is that answer in your design?
- when: overwrite, overwrites, full refresh → ask: Overwriting a day of silver means re-reading {{daily_events}} events. Which part of your pipeline really needs a recompute, and how do you limit it to the affected days?
- when: mergeschema, schema evolution, evolve → ask: Automatic schema evolution added a column called `userId` next to `user_id`. What does silver do, and who decides?
- when: dedupe, deduplicate, distinct → ask: What exactly is your key, and over what time window do you deduplicate? What does that window cost in state or in reads?
- when: partition by user, user_id partition → ask: How many distinct users a day, and how many files does that produce? What would you partition by instead, and how do you still find one user's events quickly?

**Production Reality Check.**
- A new app release sends the event timestamp in local time without an offset. For two days silver puts about a fifth of mobile events in the wrong hour, and the gold funnel shows a midnight spike; events from those days keep arriving for {{late_days}} days.
- The quarantine table grows from {{invalid_share}} to 12% of events after a release renames `event_type` to `type`. Nobody is alerted, and the daily checkout funnel drops by a tenth for three days before a marketer asks why.
- A storage-notification backlog is replayed and a week of bronze files is ingested a second time. Silver deduplicates, but a gold session table built by appending each run's new silver rows double counts sessions for that week.

**Evaluation Criteria.** Bronze as append-only provenance with the raw or rescued payload; explicit schema-evolution rules per layer (additive changes, type changes into rescued data, renames as deliberate mappings); a silver event grain with a stated deduplication key and window and idempotent writes; quarantine as a queryable table with reason codes, an owner, alerting on its rate and a re-entry path; gold grains with late-data windows and a close; partitions recomputed only where late or replayed data landed; each incident detected, contained and guarded.

## DBX-L3-02: Slowly changing account dimension with MERGE — late corrections and early facts

| | |
|---|---|
| **Template ID** | DBX-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / SCD type 2 with MERGE, back-dated changes, early-arriving facts, surrogate versus business keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "accounts": {"1": ["40,000"], "2": ["400,000", "1 million"], "3": ["5 million", "12 million"]},
  "daily_changes": ["0.5%", "2%"],
  "backdate_days": [7, 30, 90],
  "usage_rows": {"1": ["50 million"], "2": ["600 million"], "3": ["4 billion", "9 billion"]}
}
```

**Business Scenario.** A software company sells a usage-billed cloud product and analyses usage on a lakehouse. Usage arrives every hour as one row per account, workspace, product and hour, about {{usage_rows}} rows a day. Finance and sales report usage by the account's attributes: pricing tier, sales segment, region, account owner and parent company. Those attributes change for about {{daily_changes}} of {{accounts}} accounts a day and come from a CRM extract delivered daily. The extract is messy: it sends full snapshots of changed accounts, sometimes the same account twice in one file with different values, and corrections that are back-dated up to {{backdate_days}} days ("this account moved to the enterprise tier on the 3rd, not today"). Usage for a brand-new account often arrives before the CRM knows the account exists.

**Problem Statement.** Design the account dimension as a slowly changing dimension (type 2) and the process that maintains it with MERGE statements on the lakehouse. Cover: the columns (business key, surrogate key, validity interval, current flag, a hash of tracked attributes, provenance), which attributes are tracked as history and which are overwritten; the MERGE logic for an ordinary change, including how one MERGE both closes the old version and inserts the new one; how a back-dated change is inserted between existing versions; how duplicate rows for one account in one extract are resolved; what happens to usage that arrives before its account (an inferred member) and when the real attributes arrive; and how usage facts are joined to the right version, by surrogate key fixed at load time or by business key and time at query time. Say which reports must show history as it was and which as it is now.

**Constraints.** For each account, versions never overlap and leave no gaps from the first version onwards. Re-running a day's load gives the same dimension. A month that finance has closed is not restated without a documented decision, even when a back-dated change says it was wrong. Every version records which extract produced it.

**Assumptions.** Counts, rates and windows are hypothetical. Each account has a stable business key from the CRM. In this exercise a MERGE fails when more than one source row matches the same target row; check current docs for the exact behaviour.

**Clarifications.**
- Q: Which attributes need history? | A: Tier, segment, region and parent company. The account owner's email and phone are overwritten, never versioned.
- Q: What does the extract say about time? | A: Each row has an `effective_date` from the CRM and the file's extract time. A back-dated correction has an effective date in the past.
- Q: How do I tell a real change from a re-sent row? | A: Your choice: compare tracked attributes (a hash is fine) and say what happens when nothing changed.
- Q: How fast do reports need new accounts? | A: Usage for a new account must be counted the day it arrives, even if the account has no attributes yet.
- Q: Who reads the dimension? | A: Finance's monthly revenue by tier (as it was at the time), sales dashboards (by today's segment and owner) and ad-hoc analysts.

**Hints.**
1. A MERGE updates or inserts per matched row. To close a version and insert its successor in one statement, the source can carry each changed account twice: once to match and close the current row, once with a null key so it never matches and is inserted.
2. Deduplicate the extract to one row per account and effective date before the MERGE, with a deterministic tie-break, or the MERGE fails or picks arbitrarily.
3. A back-dated change splits one existing version into two and may change the end of the version before it. Write down the before-and-after intervals before writing SQL.

**Follow-ups.**
1. Walk through one ordinary change: the dimension rows before, the source rows you build, the MERGE clauses, and the rows after.
2. A correction says an account moved to the enterprise tier 20 days ago; the dimension has two versions since then. Show the intervals before and after, and which usage facts change.
3. Usage arrives for an account the CRM has never sent. What row do you create, what key does the usage carry, and what happens when the real attributes arrive two days later?
4. Finance closed last month on the old tier. Sales wants the correction everywhere. What does each report show, and how is the difference explained?
5. At {{accounts}} accounts and {{usage_rows}} usage rows a day, what does a back-dated change cost if facts carry surrogate keys? Compare with joining by business key and time, and say what you would choose.

**Follow-up rules.**
- when: type 1, overwrite, update in place → ask: Finance's revenue by tier for March must not change when an account moves tier in May. With the tier overwritten, how do you answer March?
- when: merge into, when matched → ask: The extract has the same account twice with different tiers. What does your MERGE do, and what should it do?
- when: surrogate key, surrogate → ask: A back-dated change creates a new version in the middle of history. Which usage facts now point at the wrong surrogate key, and how many rows is that at {{usage_rows}} a day?
- when: current flag, is_current → ask: Two loads run out of order after a retry. How do you make sure exactly one version per account is current, and how do you check it every day?
- when: valid_to, end date, end_date → ask: Is your interval closed or half-open, and what end value does the current row carry? Show the join predicate a usage row at midnight on a boundary day uses.

**Production Reality Check.**
- A CRM bulk edit re-sends {{daily_changes}} of accounts with only the owner's phone format changed. The load treats every row as a change, the dimension grows by millions of versions in a week, and dashboard joins slow down.
- A back-dated tier correction {{backdate_days}} days old was applied by updating the tier on the current version. Finance's closed month and the sales dashboard now disagree, and nobody can say what the tier was when the invoice went out.
- A retried load ran twice for the same extract after a partial failure; for some accounts two versions are marked current, and usage for those accounts is counted twice in revenue by tier.

**Evaluation Criteria.** Tracked versus overwritten attributes chosen with reasons; surrogate key, business key and half-open validity interval with a no-overlap, no-gap invariant; a MERGE that closes and inserts in one statement from a deduplicated, change-detected source; back-dated changes that split intervals correctly; inferred members for early facts, completed later; an explicit choice between keys fixed at load and as-of joins, with cost; as-was versus as-is reporting and closed periods respected; idempotent loads with checks for one current row per account; each incident detected and repaired without editing history silently.

## DBX-L3-03: Governance model — catalogs, grants, row filters, column masks and what inheritance really grants

| | |
|---|---|
| **Template ID** | DBX-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / securable hierarchy, principals and nested groups, privilege inheritance, row filters and column masks, effective-access model |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-architect, staff-data-engineer, senior-data-engineer, data-engineer, ml-platform-engineer |

```params
{
  "business_units": [4, 9, 20],
  "tables": {"2": ["8,000", "25,000"], "3": ["120,000", "400,000"]},
  "groups": ["300", "2,000", "9,000"],
  "regions": ["EU and US", "EU, US and APAC", "eight countries with residency rules"]
}
```

**Business Scenario.** An insurance group moves its analytics to a lakehouse with a central governance layer. Data is addressed by a three-level name (catalog, schema, table), and the hierarchy above a table is a catalog and a schema; in this exercise a privilege granted on a catalog or schema applies to every current and future object inside it, and reading a table needs a usage privilege on its catalog and schema plus a read privilege on the table (check current docs for the exact privilege names). The group has {{business_units}} business units, about {{tables}} tables and {{groups}} groups synchronised from the identity provider, nested several levels deep. Customer data is spread across {{regions}}: claims handlers may see only their region's policyholders, actuaries see all regions but with names, emails and national identifiers masked, and a fraud team needs the unmasked values for open investigations only. Auditors ask regularly: "who could read this column on this date, and why?"

**Problem Statement.** Design two things. First, the governance layout: how catalogs and schemas are organised (by environment, business unit, data domain or sensitivity), how groups are designed so that grants stay few, where row filters and column masks are attached and how they decide (a mapping table, group membership, an attribute of the user), and who owns each level. Second, the data model that answers access questions: securables and their hierarchy, principals and nested group membership with history, grants with history, filters and masks with their versions, and a derived effective-access view that says, for a principal, table and column at a point in time, whether it can read, which rows, masked or not, and the chain of grants that explains it.

**Constraints.** Least privilege: nobody gets more than their role needs, and a new table must not become readable by a broad group unless that is intended. Every grant, revoke, membership change and policy change is recorded with who did it and when. The effective-access answer must be reproducible for any date in the last two years. The design must survive table renames and a table being dropped and recreated with the same name.

**Assumptions.** Counts and regions are hypothetical. Group membership changes arrive from the identity provider within an hour. A row filter and a column mask are functions attached to a table or column that run for every query; in this exercise a table has at most one row filter, and a column at most one mask.

**Clarifications.**
- Q: Can a grant deny access? | A: No. Grants only add access in this exercise; the restrictions come from row filters and column masks.
- Q: Are groups nested? | A: Yes, up to five levels, and cycles are not allowed but have happened in the identity provider's data.
- Q: Who may grant? | A: Owners of an object and principals with a manage privilege on it. Say who should own catalogs and schemas: people or groups.
- Q: Do service principals for pipelines count? | A: Yes. They read and write more data than any human; include them.
- Q: What is a "read" for the auditors? | A: Being able to run a query that returns the column's values unmasked. Being able to see that the table exists is not a read.

**Hints.**
1. Inheritance makes grants cheap and dangerous: a read grant on a schema covers tables created next year. Decide where broad grants are allowed (curated, non-sensitive schemas) and where grants are per table.
2. Make filters and masks decide on group membership or a mapping table rather than naming users, so that access changes are membership changes, which are already audited.
3. Effective access is a derived fact: expand nested groups (transitive closure, guarded against cycles), walk the securable hierarchy, and combine with filter and mask versions as of a time.

**Follow-ups.**
1. A claims handler in one region is also put in a cross-region project group. Using your model, show whether they can now read other regions' claims, and why.
2. A data engineer creates a new table of raw call-centre transcripts in a schema where a large analyst group has a schema-level read grant. What happens, and what in your layout prevents it?
3. The auditor asks who could read national identifiers unmasked in the claims table on 3 March. Write the query against your model, including nested groups as they were that day.
4. A table is dropped and recreated with the same name. Do old grants apply to it? How does your model keep the history of the old table separate from the new one?
5. With {{groups}} groups nested five deep and {{tables}} tables, how big is the effective-access view, how do you compute it incrementally and how fresh must it be?

**Follow-up rules.**
- when: grant on catalog, catalog level, all tables → ask: That grant also covers every table created in the catalog from now on. Which future table worries you most, and what stops it?
- when: view, views, secure view → ask: You built a view per region instead of a row filter. How many views is that across {{business_units}} business units, and how do you keep them from drifting when the base table changes?
- when: user name, user email, current_user → ask: Your mask names individual users. What happens when someone joins the fraud team, and where does that change get audited?
- when: nested, transitive, recursive → ask: The identity provider produced a membership cycle. What does your expansion do, and how do you report it?
- when: table name, full name, three-level name → ask: The table was renamed last month and recreated under the old name. Which identifier do your grant history and audit answers key on?

**Production Reality Check.**
- A team grants read on a whole catalog to a large analyst group to unblock a deadline. Three weeks later a new table of unmasked customer contact data lands in a schema of that catalog and, through nested membership, is readable by people in many of the {{groups}} groups.
- The identity provider sync fails for a day. People who left the fraud team keep unmasked access, and the effective-access view, rebuilt from the stale membership, says nothing changed.
- A row filter function is edited to fix a bug and for an afternoon returns every region's rows (here {{regions}}) to one region's claims handlers; the change was made by the table owner without review, and nobody can say afterwards which queries ran during the window.

**Evaluation Criteria.** A catalog and schema layout with a clear axis and stated owners; groups designed around roles with few, deliberate grants; inheritance treated as a risk with broad grants only where safe; filters and masks driven by membership or mapping tables, versioned and reviewed; a model of securables (stable ids, not names), principals, nested membership with history, grants with history, and policy versions; an effective-access derivation with cycle handling, as-of reproducibility and an explanation chain; each incident detected, contained and guarded.

## DBX-L3-04: Workspace audit-log model — who read what, when and from where

| | |
|---|---|
| **Template ID** | DBX-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / audit event normalisation, identity and securable resolution, network context, retention and immutability |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "workspaces": {"1": [5], "2": [40, 120], "3": [600, 1500]},
  "daily_events": {"1": ["20 million"], "2": ["300 million"], "3": ["3 billion", "6 billion"]},
  "retention_years": [3, 7],
  "delivery_delay": ["15 minutes", "2 hours", "up to 24 hours"]
}
```

**Business Scenario.** A bank runs {{workspaces}} workspaces on a data and AI platform. The platform emits audit events for actions in each workspace and in the governance layer: sign-ins, notebook and query runs, table and credential requests, permission changes, cluster and job changes, file downloads and token creation. Each event is a JSON record with a service name, an action name, the identity that acted (a user or a service principal), a source IP address and user agent, request parameters, a result and a timestamp; in this exercise events are delivered to the bank's storage after a delay of {{delivery_delay}}, at least once, and the set of services and actions grows with each platform release (check current docs for the event schema and delivery options). About {{daily_events}} events arrive a day. The compliance team must answer, within a day of being asked: who read a given table or column during a period, everything a given person did before and after they left, every permission change on sensitive data, and every access from outside the bank's network. Regulation requires keeping the evidence for {{retention_years}} years and proving it was not altered.

**Problem Statement.** Design the data model from raw audit events to the tables that answer those questions. Cover: the raw landing table (what is kept verbatim and why), the normalised event fact (grain, keys, the columns you extract and how you handle actions you do not recognise yet), how you resolve the identity (users renamed, deactivated, service principals, tokens), the object acted on (a stable id for a table even when it is renamed or recreated) and the network context (corporate ranges, VPN, cloud services, unknown); which event types count as reading data versus only looking at metadata; deduplication of redelivered events; partitioning and retention tiers for {{retention_years}} years; and how you prove the evidence is complete and unaltered.

**Constraints.** Raw events are never modified or deleted before the retention period ends; derived tables may be rebuilt. Every answer to compliance must be traceable to the raw events it came from. The model must cope with new action names without a code change, and must state what it cannot answer (for example, which rows a query returned). Personal data in request parameters (such as query text) is restricted to the compliance team.

**Assumptions.** Workspace counts, volumes, delays and retention are hypothetical. Each event has an id that identifies it across redeliveries. Directory data (people, their employment status, their groups) is available daily from the bank's identity provider.

**Clarifications.**
- Q: Does a "table read" event mean rows were read? | A: Not always. Some events show that metadata was fetched or that a short-lived credential was issued for the table's files. Say which you treat as evidence of reading and how you word the answer.
- Q: Are service principals people? | A: No, but a person can create or use one. Say how you attribute a job's reads to the person accountable for it.
- Q: How late can events be? | A: Usually {{delivery_delay}}; rarely a few days during an outage. Say how an answer for yesterday is labelled.
- Q: Can the bank alter events? | A: Its engineers can technically delete files in its storage. Part of the design is making that detectable or impossible.
- Q: Which IP ranges are internal? | A: A list maintained by the network team, which changes. Answers about last year must use last year's list.

**Hints.**
1. Keep the raw event verbatim (with its arrival file and time) and derive a narrow, typed fact; unknown actions still land in the fact with a generic category, so nothing is lost when the platform adds actions.
2. Resolve identities and objects through dimensions with history (as of the event time), keyed by stable ids, not by names that change.
3. A "who read X" answer is a union over several action types with different strengths of evidence. Model the strength explicitly.

**Follow-ups.**
1. Define the grain and key of the normalised event fact, and the deduplication rule for redelivered events.
2. Write the query for "who read the claims table between 1 and 31 March", including reads by jobs running as service principals and the table's earlier name.
3. A contractor's account is deactivated. List what you would show about their last 30 days, and which of those events are evidence of data access.
4. The network team reclassifies a range from "VPN" to "public cloud" in May. What happens to answers about April, and how does your model make that reproducible?
5. At {{daily_events}} events a day for {{retention_years}} years, estimate storage, describe the hot and cold tiers, and explain how you would prove to an auditor that no raw file was deleted or changed.

**Follow-up rules.**
- when: json column, raw json, store the json → ask: An auditor asks for every access from outside the corporate network last quarter. Which columns does that query read, and how long does it take across {{daily_events}} events a day if everything stays inside the JSON?
- when: user name, email address, username → ask: The person changed their name and email when they married, and later left. How does your model find all their events under both identities?
- when: delete, purge, vacuum → ask: Which tables may ever delete data before {{retention_years}} years, and how does anyone prove later that the raw events were not touched?
- when: service principal, service account → ask: A nightly job running as a service principal read the table. Who does your answer name, and on what evidence?
- when: ip address, ip range, cidr → ask: Is the network classification looked up at query time or stored with the event? What does each choice do to an answer about last year?

**Production Reality Check.**
- A platform release renames one action used for table credential requests. For two weeks the normalised fact files it under "unknown", and the monthly "who read sensitive tables" report silently drops a third of its rows.
- A delivery outage delays three days of events; they then arrive all at once, on top of the normal delay ({{delivery_delay}}). The compliance answer already sent for those days said "no access", and it was wrong.
- An engineer cleaning up storage costs runs a retention job on the raw audit location with the derived tables' 90-day setting. Eight months of raw events are deleted before anyone notices, inside the {{retention_years}}-year obligation.

**Evaluation Criteria.** Raw events kept verbatim, immutable and provably complete (counts, hashes or object locks); a typed event fact at one row per event id with redelivery deduplication and a generic category for unknown actions; identity, object and network dimensions with history, resolved as of event time by stable ids; explicit evidence strength for "read" versus metadata; service principals attributed to accountable people; late events handled with labelled answers and reruns; retention tiers and access control on sensitive parameters; each incident detected, contained and guarded.

## DBX-L3-05: Data quality expectations — failing rows, quarantined rows and the run-over-run trend

| | |
|---|---|
| **Template ID** | DBX-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / pipeline event log, versioned expectation actions, distinct counting, LAG over filtered runs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | DBX-L3-05.mjs |

**Business Scenario.** A team runs declarative pipelines that build silver tables from clickstream data. Each dataset declares data quality expectations (named constraints such as `non_null_user_id`), each with an action: `warn` keeps a failing row and records the failure, `drop` removes the row (in this exercise the team routes dropped rows to a quarantine table) and `fail` stops the update. Each pipeline run, called an update, reads `rows_in` rows; every failed check is logged to `expectation_failures` with the record it concerns. {{status_rule}} {{version_rule}} {{log_rule}} The team wants one report that shows, per update, how bad the data was and whether it is getting worse.

**Problem Statement.** Write one PostgreSQL query that returns `dataset, update_id, rows_in, failing_rows, quarantined_rows, failure_pct, prev_failure_pct, change_pts`: one row per `COMPLETED` update, ordered by `dataset`, then `started_at`. `failing_rows` is the number of distinct records with at least one failed expectation in that update. `quarantined_rows` is the number of distinct records with at least one failed expectation whose action, in the version in force for that update, is `drop`. `failure_pct` is `ROUND(100.0 * failing_rows / rows_in, 2)`. `prev_failure_pct` is the `failure_pct` of the same dataset's previous `COMPLETED` update (by `started_at`), NULL for its first one, and `change_pts` is `failure_pct − prev_failure_pct` (NULL when there is no previous one). An update with no failures appears with zeros.

**Constraints.** One SQL statement (CTEs allowed). Updates that did not complete are neither reported nor used as the previous update. The sample has {{updates}} updates, {{versions}} expectation versions and {{failures}} failure rows; production has thousands of pipelines and billions of failure rows a month.

**Assumptions.** Hypothetical schema, datasets, expectations and counts. Every expectation that appears in a failure row has a version in force for that update. An update's `started_at` is unique within its dataset.

**Clarifications.**
- Q: A record fails `non_null_user_id` and `valid_country_code`. How many failing rows is that? | A: One. It is one record; it failed two checks.
- Q: A record fails a `warn` expectation and a `drop` expectation. Is it quarantined? | A: Yes. One `drop` failure is enough.
- Q: Should a failed update count as the previous update? | A: No. The trend compares completed updates only.
- Q: Which action applies if an expectation changed from `warn` to `drop`? | A: The version in force for the update, as the description states; the current version is not necessarily that one.
- Q: Does `ended_at` matter? | A: No. Use `status` and `started_at`.

**Hints.**
1. Start from the completed updates and LEFT JOIN the failures; an inner join loses the clean updates.
2. For each failed check, find the action in force for its update: the version with the latest `effective_from` at or before the update's `started_at` (a correlated subquery with `ORDER BY … LIMIT 1`, or `DISTINCT ON`, or a window over versions).
3. Filter to completed updates before `LAG`, so the window only sees completed updates; `COUNT(DISTINCT …) FILTER (WHERE …)` gives both counts in one pass.

**Follow-ups.**
1. A new expectation is added and the failure rate jumps. How would you change the trend so that it compares like with like?
2. Alert when `change_pts` exceeds a threshold for two completed updates in a row. Write the extra step.
3. The failure log grows by billions of rows a month. How would you store and pre-aggregate it so this report reads megabytes, not terabytes?
4. A `drop` expectation removed 30% of rows in one update and the gold tables looked normal. Which numbers in this report should have paged someone, and who?

**Follow-up rules.**
- when: count(*), count(record_id) → ask: A record that fails two expectations: how many times does your count include it, and is that a failing row or a failed check?
- when: inner join → ask: Which updates disappear with an inner join between updates and failures, and are they the good news or the bad news?
- when: lag → ask: Does your LAG run before or after you filter out failed and cancelled updates? What does it return for the update right after a failed one?
- when: max(effective_from), current version, latest version → ask: Is that the version in force now, or when the update started? Show the predicate that picks the right one.
- when: logged_at → ask: Why might the time a failure was logged be the wrong time to look up the action? Which time decides the action for the whole update?

**Production Reality Check.**
- An expectation was switched from `warn` to `drop` on a Friday. On Monday this report showed a quarantine spike for the previous week's updates, because an earlier version of the query joined the current action instead of the version in force.
- A pipeline restart redelivered part of the event log. A dashboard that counted failure rows instead of distinct records showed the failure rate doubling for a few updates and paged the on-call engineer at night.

**Evaluation Criteria.** Completed updates as the driving set with a LEFT JOIN so clean updates show zeros; distinct records counted, not checks; the action resolved per update from the version in force at `started_at` (inclusive), not the current version or the log time; one `drop` failure enough to quarantine; `LAG` over completed updates only; deterministic ordering; can discuss like-for-like trends, alert rules and pre-aggregating the failure log.
