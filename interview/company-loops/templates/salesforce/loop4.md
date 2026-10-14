# Salesforce · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a multi-tenant
cloud CRM: customer orgs with their own records, sharing, automation, API
allocations and sandboxes, plus a customer data platform. Every workload, number,
limit and schema is hypothetical; platform rules are this exercise's rules (check
current docs), and nothing here describes how the company's own systems are built.

## SFC-L4-01: Unified customer profiles with identity resolution, unmerges and consent

| | |
|---|---|
| **Template ID** | SFC-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Identity resolution / match rules, merge graphs, unmerge, consent propagation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "sources": {"2": [8, 15], "3": [30, 60]},
  "records": {"2": ["120 million", "300 million"], "3": ["2 billion", "5 billion"]},
  "purposes": [4, 6, 9],
  "withdraw_minutes": [5, 15, 60]
}
```

**Business Scenario.** A customer data platform lets each customer org bring together what it knows about the same person from {{sources}} sources: CRM contacts and leads, an online store's accounts, a loyalty programme, support cases, event registrations and email subscriber lists. The largest org holds {{records}} source records. Each org configures its own match rules (for example "same normalised email" or "same last name and same normalised postal address"), and the platform builds one unified profile per person, which marketing segments, service consoles and analytics all read. Consent is recorded per purpose ({{purposes}} purposes in the largest org, such as email marketing, SMS and analytics) and arrives from several of the sources, sometimes in conflict.

**Problem Statement.** Design identity resolution and the unified profile. Cover how source records are normalised and matched; how matches become profiles and how a profile id stays stable as records arrive, change and are deleted; how an org changes its match rules without taking its profiles offline; how a wrong merge is undone (an unmerge) and what happens downstream; how consent is carried with the profile, including conflicts between sources; how a person's deletion request is honoured everywhere; and how the system explains to an org administrator why two records were merged.

**Constraints.** A new or changed source record reaches the unified profile within 15 minutes. A consent withdrawal must stop all activation for that purpose within {{withdraw_minutes}} minutes, whichever source it arrives from. Matching never crosses orgs. Downstream segments refer to profile ids, so ids must not churn without reason. A deletion request is completed across every store, including derived ones, within the window the org's policy sets.

**Assumptions.** All volumes, timings and counts are hypothetical. Match-rule behaviour, consent precedence and deletion windows are this exercise's rules; check current docs for any real product's behaviour. Sources deliver either change events or periodic full extracts.

**Clarifications.**
- Q: Are match rules deterministic or probabilistic? | A: Deterministic rules configured by the org. You may propose a scored fuzzy rule as an extension, but say how an administrator would understand and override it.
- Q: Is matching transitive? If A matches B and B matches C, is A the same person as C? | A: In this exercise, yes by default. Tell me what that costs you.
- Q: When sources disagree on consent, which wins? | A: The org sets a policy; the default in this exercise is the most recent explicit choice per purpose, with withdrawal never overridden by an older grant.
- Q: Do downstream systems hold copies of profiles? | A: Yes: segment exports to email and advertising tools, and cached profiles in the service console.
- Q: Can an administrator force two records apart permanently? | A: Yes. A "never merge" pair must survive every later rule run.

**Hints.**
1. Separate the match graph (records as nodes, rule matches as edges, each edge with the rule that produced it) from the profile built on top of it. Unmerges and explanations are much easier when the edges are kept.
2. Some values (a shared support mailbox, a call-centre phone number, a household email) connect thousands of unrelated people. Decide how a rule recognises a value that is too common to identify anyone.
3. Treat consent as its own event stream keyed by person and purpose, evaluated at activation time, not only copied into a nightly profile.

**Follow-ups.**
1. Walk through one new loyalty-programme record that matches two existing profiles. What changes, and which profile id survives?
2. An org adds a rule that matches on phone number. How do you re-resolve {{records}} records without disrupting segments that are running today?
3. A source record that was the only link between two halves of a profile is deleted. What happens to the profile id, its segments and its consent?
4. A consent withdrawal arrives from the email tool while a segment export to an advertising audience is in flight. How do you meet the {{withdraw_minutes}}-minute bound?
5. How would you measure over-merging and under-merging per org without reading record contents across orgs?

**Follow-up rules.**
- when: union find, connected component, transitive closure → ask: One shared mailbox links 40,000 records into one component. How does your design notice, and what do the 40,000 people's profiles look like afterwards?
- when: machine learning, probabilistic, fuzzy, similarity score → ask: An org administrator asks why two of their customers were merged. What exactly does your system show them, and how do they undo it?
- when: golden record, survivorship, most recent wins → ask: The loyalty programme's address is newer but the CRM's address was verified by a person. Which survives into the profile, and who decides?
- when: nightly, batch job, daily batch → ask: A customer withdraws email consent at 09:00 and your next batch runs tonight. What reaches them in between?
- when: delete, deletion, erasure, right to be forgotten → ask: The deleted record had already been copied into three segment exports and a cached service-console profile. How do you know every copy is gone?

**Production Reality Check.**
- An org adds a phone-number rule. Within an hour, 30,000 contacts who all list the same call-centre number collapse into one profile, and a scheduled campaign sends one person's offer to the email address that profile happened to keep.
- An email tool, one of the {{sources}} sources, re-sends its full extract after its own upgrade with every address lowercased and trimmed. The platform treats them as new values, and the largest org's profile count jumps by 12% overnight.
- A consent withdrawal recorded in the service console is not applied for 9 hours because that source's change events were stuck behind a full re-resolution; the person receives two SMS messages after opting out, far outside the {{withdraw_minutes}}-minute bound.

**Evaluation Criteria.** Normalisation before matching, with per-rule blocking keys; a persistent match graph with edges labelled by rule, and profiles derived from it; stable profile ids with a clear survivorship rule on merge and on split; detection of over-connected values (frequency caps, blocklists, cluster-size alarms) before they merge; rule changes re-resolved in a shadow version and cut over with a diff, not in place; unmerge and "never merge" constraints that survive reruns, with downstream retraction; consent as a separate, per-purpose stream with precedence rules and enforcement at activation time; deletion propagated to derived stores and exports with proof; per-org isolation; adapts to each incident with containment, repair and prevention.

## SFC-L4-02: Sandbox refresh with consistent masking of personal data

| | |
|---|---|
| **Template ID** | SFC-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Test data management / production copies, deterministic masking, referential integrity |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "data_size": {"2": ["400 GB", "1.5 TB"], "3": ["8 TB", "20 TB"]},
  "objects": {"2": ["300", "600"], "3": ["1,500", "3,000"]},
  "window_hours": [8, 24, 48],
  "sandboxes": [5, 20, 60]
}
```

**Business Scenario.** Customer orgs develop and test changes in sandboxes: copies of their production org's configuration and, for some sandbox types, its data. A large org has {{data_size}} of record data across {{objects}} standard and custom objects, and {{sandboxes}} sandboxes that its developers, testers and outside implementation partners refresh from production on their own schedules. Production holds personal data about the org's customers: names, emails, phone numbers, postal addresses, dates of birth, free-text notes and attached files. The platform is adding masked refreshes: personal data is replaced with realistic but fictitious values during the copy, so testers can work with production-shaped data without seeing anyone's real details.

**Problem Statement.** Design the masked sandbox refresh. Cover how the copy is taken without hurting production; how fields are classified as personal (and what happens to a field nobody classified); how values are masked so that the same real value always becomes the same masked value within a sandbox (so duplicate rules, joins and matching still behave); how formats, uniqueness and relationships between records are preserved; how free text and files are handled; how partial copies (a sample of records) keep related records together; and how you prove that no unmasked personal value ever reached the sandbox.

**Constraints.** A full refresh finishes within {{window_hours}} hours. Unmasked personal data must never be written to sandbox storage, logs, temporary files or search indexes, not even briefly. Masking must be repeatable within a sandbox and different between sandboxes, so values cannot be correlated across them. Production users must not notice a refresh. Automations in a sandbox must never reach a real person.

**Assumptions.** All sizes, timings and counts are hypothetical. Sandbox types, which ones carry data and how refreshes are scheduled are this exercise's rules; check current docs. Field metadata can carry a data-classification label set by the org's administrators, but many fields have none.

**Clarifications.**
- Q: Can the masked values be random? | A: They must be consistent: the same real email masks to the same fake email everywhere in that sandbox, including in lookups and in other objects that store a copy of it.
- Q: Who decides which fields are personal? | A: The org's administrators label fields; the platform may suggest labels. You decide what happens to unlabelled fields.
- Q: Do tests need valid formats? | A: Yes. Validation rules and integrations in the sandbox expect well-formed emails, phone numbers and postcodes, and unique fields must stay unique.
- Q: Are attached files copied? | A: For full copies, today they are. Decide what masked refreshes do with them.
- Q: Can a refresh be partial? | A: Yes: a template of objects and a sample size per object. Related records must come along so the sample is usable.

**Hints.**
1. Mask in the copy pipeline, between reading production and writing the sandbox. Copying first and masking afterwards leaves real data in the sandbox for hours.
2. A keyed, deterministic transformation (for example an HMAC of the normalised value with a per-sandbox secret, used to pick a fake value from a dictionary or to format-preserve) gives consistency within a sandbox and no correlation across sandboxes.
3. Fail closed: a field that looks personal but has no label should be masked or blanked, and reported, not copied.

**Follow-ups.**
1. Walk through one contact record and its related account, cases and email messages. Which values are masked, by what rule, and how do the relationships survive?
2. A unique field (an external customer number) must stay unique after masking. How do you guarantee it?
3. Free-text case descriptions mention customers by name and phone number. What do you do with them, and what does a tester lose?
4. An org's partial refresh samples 1% of accounts. How do you choose the related records so the sample is consistent, and how do you bound its size?
5. Auditors ask you to prove no real personal value reached any of the {{sandboxes}} sandboxes last quarter. What evidence does your design produce?

**Follow-up rules.**
- when: encrypt, encryption, aes → ask: Encrypted values are consistent and reversible. Who holds the key, and what happens if a tester's sandbox and that key end up in the same place?
- when: hash, hashing, sha → ask: Hashing an email without a secret means anyone can hash a known address and look for it. How do you prevent that, and how do you keep the email format valid?
- when: random, randomise, faker → ask: The same customer appears in contacts, in a case's supplied email and in an email message. With random values, do those still line up in the sandbox?
- when: copy then mask, mask afterwards, post-processing → ask: For the hours between the copy and the masking job, real data sits in a sandbox that contractors can reach. How do you justify that?
- when: regex, pattern matching, detection → ask: Your detector misses a phone number written as words in a note. What is the second line of defence?

**Production Reality Check.**
- A custom field added to cases last month holds customers' mobile numbers, but nobody labelled it. After a refresh, an SMS automation in one of the {{sandboxes}} sandboxes sends test messages to 2,000 real customers.
- A refresh of {{data_size}} overruns its {{window_hours}}-hour window by a day because one object with millions of attached files is copied and scanned file by file; testers start work against a half-loaded sandbox.
- The masking secret for a sandbox is rotated between a full refresh and a later partial top-up. Contacts copied before and after no longer mask to the same values, duplicate rules fire on every new record, and test matches fail.

**Evaluation Criteria.** Copy from a consistent snapshot or replica with throttling, never from the live write path; masking inside the pipeline before any sandbox write, with no unmasked spill to logs or temporary storage; classification from labels plus detection, failing closed on unlabelled personal-looking fields; keyed deterministic masking per sandbox that is consistent across objects and copies, preserves formats, keeps unique fields unique (collision handling) and is not correlatable between sandboxes; secret lifecycle tied to the sandbox, with rotation forcing a full re-mask; free text redacted or replaced and files excluded or replaced by placeholders; partial copies with referential closure and size bounds; outbound email, SMS and integration endpoints disabled or redirected in sandboxes; an audit trail and sampling checks proving no real values were copied; adapts to each incident.

## SFC-L4-03: Org usage analytics for many thousands of orgs, without reading record contents

| | |
|---|---|
| **Template ID** | SFC-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Product telemetry / multi-tenant usage analytics, adoption, limit consumption, data minimisation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "orgs": {"2": ["40,000", "90,000"], "3": ["150,000", "400,000"]},
  "events": {"2": ["2 billion", "6 billion"], "3": ["20 billion", "60 billion"]},
  "features": [200, 600, 1500],
  "alert_minutes": [5, 15, 30]
}
```

**Business Scenario.** The platform hosts {{orgs}} customer orgs. Product teams want to know which of {{features}} features are adopted, by how many orgs and users, and how adoption changes after a release. Each org's administrators want to see their own org's logins, active users, feature use and how much of each limit (API calls, data storage, asynchronous jobs) they have consumed, and they want an alert before they hit one. Telemetry runs to {{events}} events a day. Org data is the customer's: usage analytics may use metadata about activity, never the contents of records.

**Problem Statement.** Design the usage analytics system end to end. Cover what events are emitted and with which fields (and how you keep record contents out); collection and deduplication; the models for logins, feature adoption and limit consumption; the views for an org's own administrators versus product teams looking across orgs; near-real-time limit consumption with alerts at thresholds; and how one very large org or one misbehaving integration does not distort everything else.

**Constraints.** A limit alert fires within {{alert_minutes}} minutes of consumption crossing a threshold. An org administrator sees only their own org; product teams see aggregates across orgs, with user identities pseudonymised and small groups suppressed. No field values, record names, search terms or free text may enter the analytics store. Events can arrive hours late when a region's collectors back up. The cost of the system should grow roughly with event volume, not with the number of orgs times the number of features.

**Assumptions.** All volumes, counts, limits and thresholds are hypothetical, as is how limits are allocated; check current docs. Every event carries an org id, a pseudonymous user id, a timestamp and an event type.

**Clarifications.**
- Q: What counts as adopting a feature? | A: Define it. A sensible default: an org with at least one active user of the feature in a rolling 28 days; for users, at least one use in the period.
- Q: Can product teams see which orgs use a feature? | A: Named orgs only for teams that manage those customers' accounts and with a purpose; everyone else sees aggregates.
- Q: Do administrators see individual users? | A: Their own users, yes, by name, inside their own org's view. Cross-org views never show a person.
- Q: Are integration users counted as active users? | A: Not as people. Logins by integration users must be distinguishable.
- Q: How exact must limit consumption be? | A: The alert must not be late; the daily statement must be exact.

**Hints.**
1. Make the event schema an allowlist enforced at the collector: unknown properties are dropped and reported, not stored.
2. Two different products share one event stream: an exact, fast counter path for limits, and an analytical path for adoption. They need different stores and different latencies.
3. Distinct users across orgs and days do not add up; plan for exact distinct counts where an org sees them and sketches where product teams aggregate.

**Follow-ups.**
1. Walk through one login event and one feature-use event from emission to the administrator's dashboard and to the product team's adoption report.
2. How do you compute weekly active users per feature across {{orgs}} orgs efficiently, and what is exact versus approximate?
3. An engineer adds a property to a feature event that turns out to contain search terms typed by users. How does your design stop it, or detect and purge it?
4. Events from one region arrive six hours late. What does the adoption report show in the meantime, and how is it corrected?
5. How would you show the effect of a release on adoption without misleading the team when the largest orgs adopt first?

**Follow-up rules.**
- when: data lake, raw events, store everything → ask: Keeping every raw property "just in case" means record contents eventually land there. What stops that, and who is accountable for it?
- when: hyperloglog, sketch, approximate → ask: An org administrator sees 1,003 active users while their licence count says 1,000. What do you show them, and why?
- when: partition by org, partitioned by org, shard by org, sharded by org → ask: One org produces 8% of all events. What happens to the partition it lands on, and to the jobs that read it?
- when: stream processing, streaming, flink, kafka → ask: Your streaming counter crashes and restarts from a checkpoint. How do you avoid double counting API calls toward an org's limit?
- when: k-anonymity, suppression, minimum group → ask: A product manager filters adoption by country and industry until a cell holds two orgs. What does your system return?

**Production Reality Check.**
- A release adds a property to a feature event that carries the text users typed into a search box. For two days customer names and email addresses flow into the analytics store before anyone notices.
- One org's misconfigured integration logs in and fails 40,000 times an hour; that org's active-user count, the login-failure dashboard and several adoption ratios across all {{orgs}} orgs are distorted for a week.
- The counter path behind limit alerts lags by two hours during a regional backlog. Several orgs hit their API allocation without the promised alert {{alert_minutes}} minutes earlier, and their integrations start failing.

**Evaluation Criteria.** An event schema allowlist enforced at collection, with dropped-field reporting and scanning for content that slipped through, plus a purge path; separation of the exact, low-latency limit counter from the analytical adoption path; idempotent ingestion keyed by event id, event-time windows with late-data correction and completeness signals; adoption metrics defined precisely, with integration users separated from people; per-org isolation in the administrator view and pseudonymised, suppressed aggregates across orgs; skew handling for the largest orgs; exact distinct counts where an org sees them and sketches where they are mergeable aggregates; alert freshness monitored as its own signal; adapts to each incident with containment, repair and prevention.

## SFC-L4-04: Fair asynchronous job processing across tenants on shared workers

| | |
|---|---|
| **Template ID** | SFC-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant scheduling / per-org queues, fair share, limits, noisy neighbours |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "orgs": {"2": ["20,000", "60,000"], "3": ["150,000", "300,000"]},
  "workers": {"2": ["400", "1,200"], "3": ["4,000", "10,000"]},
  "peak_jobs": {"2": ["5,000", "15,000"], "3": ["60,000", "150,000"]},
  "daily_limit": ["250,000", "1 million"]
}
```

**Business Scenario.** Customer orgs run asynchronous work on the platform: queued jobs from their own code, scheduled batch jobs that process records in chunks, automations that run after a record is saved, and bulk data loads. {{orgs}} orgs share a pool of {{workers}} workers in a region, and at peak they submit {{peak_jobs}} jobs a minute. Each org may run up to {{daily_limit}} asynchronous executions in a rolling 24 hours, and every execution runs under per-transaction limits on CPU time, queries and rows touched. A few orgs submit most of the work, and their jobs differ in length by three orders of magnitude.

**Problem Statement.** Design the asynchronous job system. Cover how jobs are accepted (including the daily limit), queued and dispatched; what "fair" means between orgs and how the scheduler achieves it; how one org with a surge cannot delay everyone else; how long jobs and short jobs share workers; how a job is leased, retried and made safe to run twice; how jobs from the same org that touch the same records avoid fighting over locks; and what each org and the platform's operators can see about queue health.

**Constraints.** A small org's job should start within seconds even while large orgs have deep backlogs. No org should be starved, and an org's share should not depend on how many jobs it can enqueue. Workers can be lost at any time. Retries must not send an email twice or double-apply an update the job was written to make once. The daily limit is enforced at acceptance, and an org learns it is close before it is cut off.

**Assumptions.** All counts, limits and timings are hypothetical, as are the job types and their limits; check current docs for any real platform's rules. Jobs read and write the org's records in a shared relational store partitioned by org.

**Clarifications.**
- Q: Should fair mean the same number of jobs per org? | A: Define it. Jobs differ hugely in length, so say whether you share job starts, worker-seconds or something else, and whether larger customers get larger weights.
- Q: Can an org mark jobs as urgent? | A: Jobs started by a user waiting on screen are more urgent than scheduled batch work. Org-set priorities apply only within that org.
- Q: How long can a job run? | A: Each execution has a CPU-time limit; batch jobs are split into chunks that each run as one execution.
- Q: What happens to a job when its worker dies? | A: Decide. The platform may run a job again; your design must make that safe.
- Q: Can the worker pool grow? | A: Yes, within minutes, but not instantly and not without limit.

**Hints.**
1. A single global first-in-first-out queue gives the whole pool to whoever enqueues fastest. Queue per org (and per class), and let the scheduler choose which org's queue to take from next.
2. Measure fairness in worker-seconds consumed, not in jobs started: deficit round robin or weighted fair queuing over per-org queues, with per-org concurrency caps.
3. Leases with heartbeats and an expiry let another worker pick up a job whose worker died; an idempotency key per side effect makes the second run harmless.

**Follow-ups.**
1. Walk through what happens when one org enqueues three million jobs at 09:00 while a thousand small orgs each enqueue a few.
2. How does the scheduler choose the next job to run? Give the data structure and its cost per dispatch with {{orgs}} orgs.
3. Two hundred jobs from one org all update the same parent record and fail on lock contention, then retry. What does your design do?
4. A worker pauses for 90 seconds in garbage collection, its lease expires, another worker starts the job, and then the first worker wakes up. What prevents a double write?
5. How would you set per-org weights and concurrency caps, and how would you show an org why its jobs are waiting?

**Follow-up rules.**
- when: fifo, single queue, global queue → ask: One org enqueues three million jobs ahead of everyone. How long does a small org's single job now wait?
- when: priority queue, priority levels, high priority → ask: If every org marks its jobs high priority, what does your priority mean? Who is allowed to set it?
- when: round robin, deficit, weighted fair → ask: One org's jobs each run for 10 minutes and another's for 50 milliseconds. Is your round robin still fair?
- when: autoscale, autoscaling, scale out → ask: The surge comes from one org. Do you add workers for it? Who pays, and does it fix the wait for others?
- when: exactly once, exactly-once → ask: The job sends an email and then the worker dies before acknowledging. Show me how the retry knows not to send it again.

**Production Reality Check.**
- One org starts a data load that enqueues three million jobs at 09:00. Within twenty minutes, the p99 wait to start for every other org rises from 4 seconds to 40 minutes, and user-initiated jobs time out on screen.
- A release introduces a job type that runs until its CPU-time limit and is retried five times. It ends up occupying a third of the {{workers}} workers while its org's backlog looks normal by job count.
- A worker restart during peak loses its leases; 18,000 jobs run twice, and one org's customers receive duplicate order-confirmation emails.

**Evaluation Criteria.** Per-org (and per-class) queues with a scheduler that shares worker-seconds fairly (deficit round robin, weighted fair queuing or virtual-time scheduling) and an efficient structure to pick the next org; per-org concurrency caps and admission control with the rolling daily limit and early warning; urgency classes across orgs with org priorities only within an org; leases, heartbeats and fencing tokens; idempotency keys for side effects and at-least-once execution stated plainly; lock-contention handling by serialising jobs per record key or by backoff with jitter; retry budgets and poison-job quarantine; autoscaling that responds to aggregate demand rather than one org's surge; per-org queue age and worker-seconds as the operator's and the org's views; adapts to each incident.

## SFC-L4-05: Archiving old records while keeping them queryable and reportable

| | |
|---|---|
| **Template ID** | SFC-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Data lifecycle / archival tiers, related records, retention, legal holds, live-plus-archive reporting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "rows": {"2": ["300 million", "900 million"], "3": ["4 billion", "12 billion"]},
  "orgs": {"2": ["5,000", "20,000"], "3": ["100,000", "250,000"]},
  "archive_months": [18, 24, 36],
  "retention_years": [5, 7, 10]
}
```

**Business Scenario.** Orgs accumulate records they rarely touch: closed cases, completed tasks, old email messages and field-history rows. The largest org's case-related objects hold {{rows}} rows, and the primary store is slower and more expensive the more it holds. The platform is offering archiving to {{orgs}} orgs: each org sets a policy per object (for example "cases closed more than {{archive_months}} months ago"), archived records move out of the primary store, users can still find and open them, reports can still include them, and they are deleted for good when the org's retention period ({{retention_years}} years by default) ends, unless a legal hold applies.

**Problem Statement.** Design archiving. Cover how records are selected under each org's policy; how a record moves together with its related records (comments, emails, attachments, history) without loss or duplication; where archived records live and in what format; how users find and open one, and how reports combine live and archived records; how record access rules still apply to archived records; how schema changes after archiving are handled; and how retention, legal holds, deletion requests and restores work.

**Constraints.** Archiving must not slow the org's daytime work. No record may be lost or exist in both stores as a live record. Opening one archived record by id takes under two seconds; a report over archived data may take minutes. A user who could not see a record before it was archived must not see it afterwards. A deletion request for a person must reach archived records too. Retention and legal holds are per org.

**Assumptions.** All sizes, ages and periods are hypothetical. Retention defaults, legal-hold behaviour and which objects can be archived are this exercise's rules; check current docs. The primary store supports transactions within an org; the archive store does not need to.

**Clarifications.**
- Q: Can archived records be edited? | A: No. They can be restored to the primary store, edited there, and archived again later.
- Q: What about live records that look up an archived one, such as an open case whose parent case was archived? | A: Decide. The lookup must not break for users.
- Q: Do reports need to show live and archived records together? | A: Yes, for a defined set of report types; it may be slower.
- Q: Who can place a legal hold? | A: The org's administrators, on records matching a filter (for example every case for one account). A hold overrides both archiving and retention deletion.
- Q: Does sharing still matter for archived records? | A: Yes. Access must be checked as it would be for the live record, under this exercise's sharing rules.

**Hints.**
1. Make a move a copy, then a verification, then a delete, with a durable manifest per batch, so a crash at any step is safe to rerun.
2. Choose the unit of archiving as a record and its whole family of related records, chosen by the parent's policy, so the archive never holds orphans and the primary never holds dangling children.
3. Archived data is cold and read in bulk: a columnar format partitioned by org, object and close month, plus a small key-value index by record id for single-record opens.

**Follow-ups.**
1. Walk through archiving one closed case with 40 comments, 12 emails and 3 attachments. What is written where, in what order, and what happens if the process dies halfway?
2. How do you keep the access check correct for archived records when the role hierarchy and sharing rules change after archiving?
3. A field was added to cases after half of them were archived. How do reports that combine live and archived cases treat it?
4. An org shortens retention, and a day later places a legal hold on cases that the new retention period has started to delete. What does your design guarantee?
5. How do you prove to an org that every record selected for archiving in a month is in exactly one place?

**Follow-up rules.**
- when: soft delete, archived flag, is_archived → ask: The rows are still in the primary store with a flag. Which of the cost and speed problems has that solved?
- when: object storage, parquet, columnar → ask: A user opens one archived case by id. Which file holds it, and how do you find it in under two seconds?
- when: copy then delete, copy and delete, two phase, two-phase → ask: The copy succeeds and the process dies before the delete. On rerun, what stops the archive holding the case twice?
- when: ttl, expire, expiry → ask: A legal hold arrives for records whose expiry has already been scheduled. How does the hold win?
- when: union all, union view, combined view → ask: The live and archived halves have different columns and different access paths. How does one report query both and still apply sharing?

**Production Reality Check.**
- An archiving run for the largest org copies a batch of 2 million cases, crashes before deleting them from the primary store, and on restart copies them again. Reports combining live and archived cases double count that month.
- A policy archives closed cases but its selection leaves their attachments behind. Six million attachments in the primary store now point at parents users cannot reach from them; they are still billed, still hold personal data, and the next deletion request for a customer misses them.
- An org cuts retention from {{retention_years}} years to 2. Deletion starts that night; the next morning legal counsel places a hold on one account's cases, some of which have already been deleted.

**Evaluation Criteria.** Policy-driven selection per org and object with throttled, off-peak batches; families of related records archived together; copy, verify, delete with a durable batch manifest and idempotent reruns; a columnar archive partitioned by org, object and time, with a key-value index for opens and stubs or redirects for lookups from live records; access checks applied to archived records using stored owner and sharing-relevant fields evaluated against current rules; schema versions recorded with archived data and a union view with nulls or defaults for later fields; retention deletion as a scheduled, auditable job that checks legal holds at execution time with a grace period after policy changes; deletion requests that reach the archive; reconciliation counts per batch proving each record is in exactly one place; adapts to each incident.
