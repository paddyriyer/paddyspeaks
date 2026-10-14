# Adobe · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of creative,
document and marketing software: desktop and mobile creative apps with cloud
documents, PDF and e-signature services, generative features that attach
content credentials, and web analytics for customers' sites. Every workload,
number, limit and schema is hypothetical; product rules are this exercise's
rules (check current docs), and nothing here describes how the company's own
systems are built.

## ADB-L4-01: Creative app usage analytics that honour opt-outs and compare fairly across versions

| | |
|---|---|
| **Template ID** | ADB-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Product telemetry / event contracts, sessions, opt-out deletion, cross-version metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "apps": {"2": [8, 15], "3": [25, 40]},
  "monthly_users": {"2": ["6 million", "15 million"], "3": ["40 million", "90 million"]},
  "versions_live": [4, 7, 12],
  "offline_days": [7, 14, 30],
  "delete_days": [14, 30]
}
```

**Business Scenario.** A suite of {{apps}} creative apps for desktop and mobile is used by about {{monthly_users}} people a month. Each app can send usage events: launch, session heartbeats, feature used (a tool invoked, a panel opened, an export, a save to cloud documents), errors and quit. Desktop apps are updated on the user's schedule, so {{versions_live}} versions of a popular app are in use at once, and a desktop app that is offline buffers its events for up to {{offline_days}} days before sending them. Users can turn off usage-data sharing in their settings at any time. Product teams want weekly active users per app and feature, feature adoption by version, session length, and the share of new users who reach a first export, and they want each release compared fairly with the one before it.

**Problem Statement.** Design the usage analytics platform: the event contract and how it is versioned; collection from the apps (batching, offline buffering, retries); honouring the sharing setting end to end; sessionisation; a canonical feature catalogue so metrics compare across versions; storage layers and serving; and data-quality monitoring per release. Define a weekly active user and a session precisely.

**Constraints.** Under this exercise's rule (check current docs for the real products), when a user turns sharing off the apps stop sending from that moment, and identifiable event rows already received for that user are removed from every store within {{delete_days}} days; aggregates that no longer identify anyone may stay. No document content, file names or text typed in the apps ever enters an event. Dashboards refresh daily; a release-comparison view must be available within 6 hours of a release's first events. Events arrive late, out of order and sometimes twice.

**Assumptions.** All volumes, counts and service levels are hypothetical. Each event carries an app id, app version, platform, an install id (random per installation), a pseudonymous user id, the client's event time, a per-install sequence number and an event id. The account's privacy settings service publishes an event, with the pseudonymous user id and the time, whenever the sharing setting changes.

**Clarifications.**
- Q: Is a user who opens two apps on the same day one active user or two? | A: One for the suite, and one in each app's own count. Say which number you report where.
- Q: What counts as active: a launch, or doing something? | A: You define it. Product is unhappy that an app launched by a background updater counts today.
- Q: Do feature names stay the same across versions? | A: No. Tools are renamed, split and merged in redesigns, and each app team names its own events.
- Q: How long is raw data kept? | A: You propose it; identifiable rows are always subject to the deletion rule.
- Q: Can the apps send anything when sharing is off? | A: Nothing about usage. The settings change itself reaches you through the privacy settings service.

**Hints.**
1. Write down what one weekly active user and one session are before choosing stores; both depend on fields in the event contract.
2. A feature's identity must outlive its event name: map (app, version, event name) to a canonical feature id in a versioned catalogue owned with the app teams.
3. The sharing setting has two jobs: stop collection, and remove what is identifiable. List every place a user's rows live, including derived tables and backups.

**Follow-ups.**
1. Define a session for a desktop app that stays open for eight hours while the user works in bursts, and for a phone app sent to the background every few minutes.
2. A redesign splits one tool into two. How does "adoption of the tool" compare between the old version and the new one?
3. A desktop app sends {{offline_days}} days of buffered events at once. Which days' numbers change, and when are they final?
4. A user turns sharing off. Walk through every table their data lives in and what happens to each within {{delete_days}} days.
5. Users who update in the first week differ from those who wait. How do you compare a release with the previous one fairly?

**Follow-up rules.**
- when: device id, install id, installation → ask: One person uses three installations of the app on two computers and a tablet. How many weekly active users is that in your design, and is that the number product wants?
- when: heartbeat, idle, inactivity, timeout → ask: A new version changes the heartbeat interval. How do you keep session counts comparable between versions?
- when: delete, deletion, purge, erase → ask: The user's rows also fed yesterday's aggregates and a feature-adoption table keyed by user. Which of those must change, and which may stay?
- when: event name, rename, renamed → ask: Who owns the mapping from event names to features, and what stops a release from shipping an unmapped event?
- when: arrival time, ingestion time, processed date → ask: A desktop app was offline for {{offline_days}} days. Which day do its events count on, and what does that do to yesterday's dashboard?

**Production Reality Check.**
- A release of one app renames the event for its most-used tool. As the new version rolls out, the dashboard shows that tool's weekly use falling 40% while nothing changed for users.
- One mobile app version keeps sending usage events for 9 days after users turn sharing off, from about 2% of that app's users.
- A new desktop version sends its heartbeat every 15 minutes instead of every 5; average sessions per user for that version fall by a third, and a team reads it as the redesign hurting engagement.
- After a network outage at a large customer site, thousands of desktop apps upload up to {{offline_days}} days of buffered events in one hour; a daily active-user chart grouped by arrival date shows a one-day spike of 6%.

**Evaluation Criteria.** A typed, versioned event contract with no content fields; precise definitions of active users (suite and per app, with background launches excluded) and sessions that do not depend on one version's heartbeat; a canonical feature catalogue mapping per-version event names, enforced before release; event-time attribution with dedup on event id and a stated finality window for late offline uploads; the sharing setting enforced at collection and as tracked deletion across raw, derived and backup stores within the deadline; release comparison that controls for who updates early; per-release data-quality checks (unmapped events, volume shifts, opted-out senders); adapts to each incident with diagnosis, recovery and prevention.

## ADB-L4-02: Generative image service analytics with credits, moderation and content credentials, prompts never kept

| | |
|---|---|
| **Template ID** | ADB-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Service analytics / request lifecycle, credit reconciliation, privacy by construction, percentiles |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "requests": {"2": ["4 million", "12 million"], "3": ["50 million", "150 million"]},
  "surfaces": [4, 7, 12],
  "model_versions": [2, 3, 5],
  "freshness": ["15 minutes", "1 hour"],
  "min_count": [20, 50, 100]
}
```

**Business Scenario.** Generative image features are offered in {{surfaces}} surfaces: desktop apps, mobile apps and the web. About {{requests}} generation requests arrive a day. Each request names a feature (an image from a text description, filling a selected area, extending the canvas), one of the {{model_versions}} model versions being served, the surface and the account. A request can be rejected by input moderation, succeed with several variants, fail, time out or be cancelled by the user; output moderation can block some or all of the variants. Under this exercise's rule (check current docs), each plan includes a monthly allowance of generative credits, a successful request consumes credits according to the feature, and failed, blocked or cancelled requests consume none. Every image the service returns carries content credentials: provenance metadata recording that a generative tool made it. Product, trust-and-safety, finance and support teams all want analytics on this service.

**Problem Statement.** Design the analytics platform: the events the service emits for a request's lifecycle; how prompts and images are kept out; the metrics (success rate, latency percentiles per model version and surface, moderation outcomes by stage and category, credits consumed per account against its allowance, and content-credentials coverage); reconciliation with the credit ledger that enforces allowances; and serving with dashboards no more than {{freshness}} behind.

**Constraints.** Prompts, uploaded reference images, selections and generated images never enter analytics, logs or the warehouse, and nothing derived from a prompt's text does either. Moderation categories are reported only in aggregates of at least {{min_count}} requests. Credits per account per month in analytics must equal the credit ledger exactly. Latency percentiles must be correct across hosts and regions.

**Assumptions.** All volumes, counts and thresholds are hypothetical. The credit ledger is a separate service and the authority for entitlement; analytics reads its events. Clients may retry a request that timed out; a retry carries the original request id only if the client kept it.

**Clarifications.**
- Q: Does analytics need the prompt for quality analysis? | A: No. Prompt-level research is out of scope and has its own controls; this platform never receives prompts.
- Q: Is a request with four variants, one blocked by output moderation, a success? | A: The user receives three images and is charged under this exercise's rule. You define how it counts in success rate and in moderation rate.
- Q: Which latency matters? | A: Product wants time from request to first image shown and to all variants; the service measures its own server time. Say what you measure where.
- Q: Who owns the credit numbers? | A: The credit ledger. Analytics must agree with it, not replace it.
- Q: Who attaches content credentials? | A: The service, when it returns an image. Some export paths in apps can lose them later; you decide what "coverage" measures.

**Hints.**
1. Keep content out by construction: an allowlisted event schema with typed fields and no free text, enforced where events are produced, not by a filter downstream.
2. One request, many events: give the request an id and model its lifecycle as states, so retries, partial blocks and charges are each counted once.
3. Percentiles do not average; keep mergeable sketches per model version, surface and time bucket.

**Follow-ups.**
1. Walk through one request that returns four variants, one blocked by output moderation: which events are emitted, and how is it counted in success, moderation and credits?
2. How do you show a privacy reviewer that no prompt text can reach the warehouse, including through error messages and logs?
3. Credits in analytics differ from the ledger for 0.3% of accounts. How do you find out why?
4. A new model version ships to one surface. How do you compare its latency and moderation rates with the old version fairly?
5. Trust-and-safety asks for moderation block rates per category, per country, per day. What do you give them, given the {{min_count}} rule?

**Follow-up rules.**
- when: prompt, prompts, prompt length → ask: Where exactly is the prompt dropped in your design, and what stops a developer adding it to an error field next quarter?
- when: average latency, mean latency, avg → ask: Two regions each report their own p95. How do you get the global p95 for one model version?
- when: retry, retries, retried → ask: A client retries a timed-out request without the original id, and both attempts succeed. How many credits does the account lose, and what does analytics show?
- when: sample, sampling, sampled → ask: Credit totals must equal the ledger exactly. Which metrics may you sample, and which must count every request?
- when: ledger, billing → ask: The ledger is corrected after a support refund. How does the correction reach last month's dashboards?

**Production Reality Check.**
- An app release starts putting the prompt text into a free-text error detail on failed requests; it reaches the raw event store for 3 days before anyone notices.
- For one month, credits shown in analytics exceed the credit ledger by 4%: timed-out requests retried by clients were logged as separate charged generations.
- A new model version and a new moderation threshold ship on the same day on one of the {{surfaces}} surfaces; output-moderation blocks rise from 1.5% to 6%, and product asks which change caused it.
- Content-credentials coverage for one output format falls to 70% after a service release, and the dashboard cannot say whether the credentials were never attached or the metric stopped seeing them.

**Evaluation Criteria.** Content kept out by construction (allowlisted typed schema, no free text, enforcement at the producer and a scanner as a backstop, a purge path when it fails); a request lifecycle keyed by request id so retries, partial output blocks and charges count once; precise definitions of success and moderation rates; credits reconciled to the ledger, which stays the authority, with corrections flowing through; mergeable latency sketches per model version and surface, with client and server latency kept apart; moderation categories only above the minimum count; coverage of content credentials measured at the point of return and on export separately; fair comparison of versions (one change at a time, or a holdout); adapts to each incident with diagnosis, recovery and prevention.

## ADB-L4-03: Document and e-signature services: usage reporting and audit trails without reading contents

| | |
|---|---|
| **Template ID** | ADB-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-tenant event platform / audit trails, billable usage, data residency, content exclusion |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "customers": {"2": ["3,000", "10,000"], "3": ["40,000", "120,000"]},
  "operations": {"2": ["8 million", "25 million"], "3": ["150 million", "400 million"]},
  "regions": [2, 3, 5],
  "retention_years": [3, 7, 10]
}
```

**Business Scenario.** A document platform offers PDF services through an API and through apps (convert to PDF, export to other formats, recognise text in scans, compress, combine, protect) and e-signature agreements: a sender creates an agreement, participants receive it, view it, sign, delegate or decline, and it completes, expires or is cancelled. About {{customers}} enterprise customers use it, producing about {{operations}} document operations and agreement events a day, stored in {{regions}} regions; each customer's data stays in the region it chose. Customers want three things: usage reports (operations by type, pages processed, and transactions consumed against their contract), an audit trail for each agreement that they can download and show to an auditor, and admin reports (who sent what, completion times, agreements waiting on a signer).

**Problem Statement.** Design event collection from the document and e-signature services, the per-customer reporting store, the audit trail (completeness, ordering, tamper evidence and retention), data residency, and how you guarantee that contents are never read. Say what "complete" means for an audit trail, and how a customer can trust the usage numbers they are invoiced on.

**Constraints.** Document contents, page text, file names and form-field values never enter the event pipeline, reports or logs; events carry only ids, types, statuses, timestamps, page counts and sizes. Audit trails are kept for {{retention_years}} years and must show events in their true order, with nothing missing or altered. The usage numbers in a customer's report must equal the numbers on their invoice. No customer can ever see another customer's events.

**Assumptions.** All volumes, counts and periods are hypothetical. Under this exercise's rule (check current docs), an agreement's final audit report is produced when it reaches a terminal status, with times in UTC. Participants' names and email addresses appear in the agreement's own audit trail, which belongs to the customer, but never in usage analytics.

**Clarifications.**
- Q: Can we keep file names to help support? | A: No. Treat file names as content; give support an id they can look up together with the customer.
- Q: Who counts pages: the converter or the billing system? | A: You decide; the customer's report and their invoice must agree.
- Q: Is a failed conversion billed? | A: Not under this exercise's rule. A retried conversion of the same request is billed once if it succeeds.
- Q: How is an audit trail used? | A: Customers download it as evidence of who did what and when; it must hold up for years.
- Q: Do one agreement's events ever come from more than one region? | A: Participants act from anywhere, but each agreement belongs to its customer's region; events can reach that region late or out of order.

**Hints.**
1. There are two products here: an audit trail per agreement (complete, ordered, tamper-evident, long-lived) and usage analytics per customer (aggregated, billable). They need different stores and guarantees.
2. Keep contents out by construction: typed event schemas with no free-text fields, validated where events are produced.
3. Give every billable operation an id so retries count once, and derive both the invoice and the usage report from the same table.

**Follow-ups.**
1. What does one agreement's audit trail look like as data, and what makes it tamper-evident?
2. How do you make sure the usage report and the invoice can never disagree?
3. A participant's "viewed" event arrives after their "signed" event. What does the audit trail show?
4. How do you meet residency in {{regions}} regions and still give the platform team a global usage dashboard?
5. A customer's auditor asks you to prove an audit trail has not been altered in {{retention_years}} years. What do you show?

**Follow-up rules.**
- when: hash chain, hash, merkle, signature → ask: The chain is computed per agreement. What stops someone with database access from rewriting the whole chain?
- when: log, logs, logging → ask: A converter's debug log line includes a snippet of extracted text. Where does that line end up in your design, and how would you know?
- when: arrival order, received, ingestion time → ask: Two events for one agreement arrive in the wrong order through different regions. Whose clock decides their order in the audit trail?
- when: global, central, single warehouse → ask: Which customer data leaves its region to feed that global view, and is it allowed to?
- when: retry, retries, idempotent, idempotency → ask: A conversion times out on the client and is retried, and both attempts finish. How many pages does the customer pay for?

**Production Reality Check.**
- A conversion worker release logs the first 200 characters of recognised text in a debug field; the field flows into the per-customer reporting pipeline for 2 days.
- A customer disputes a monthly usage report showing 12% more pages than their own records: retried conversions that both completed were counted twice.
- 0.3% of audit trails show "signed" before "viewed" because events relayed between regions were ordered by arrival time.
- The event pipeline in one of the {{regions}} regions is down for 6 hours while signing keeps working; audit trails downloaded for agreements completed in that window are missing events.

**Evaluation Criteria.** Separates the per-agreement audit trail from per-customer usage analytics; content excluded by typed schemas with no free text, checked at the producer and scanned downstream, with a purge path; billable operations keyed by operation id so retries count once, and one usage table feeding both report and invoice; audit events ordered by a sequence assigned by the agreement's owning service (not by arrival), completeness checked against the agreement's state machine before a final report is issued; tamper evidence (per-agreement hash chain anchored in an append-only, separately controlled store) and retention for the stated years; in-region storage with only non-identifying aggregates leaving a region; tenant isolation enforced in the data-access layer; adapts to each incident with diagnosis, recovery and prevention.

## ADB-L4-04: Cloud document storage and sync across devices, with conflicts, quotas and honest sync latency

| | |
|---|---|
| **Template ID** | ADB-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage and sync / content-addressed versions, conflicts, quota accounting, latency measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, data-engineer |

```params
{
  "users": {"2": ["5 million", "15 million"], "3": ["50 million", "120 million"]},
  "largest_doc": ["500 MB", "2 GB", "8 GB"],
  "devices": [2, 3, 5],
  "quota": ["20 GB", "100 GB", "1 TB"],
  "sync_target": ["10 seconds", "30 seconds"]
}
```

**Business Scenario.** Creative apps on desktop, tablet and phone save documents to cloud storage for about {{users}} users. A cloud document is a set of components (layers, artboards, embedded images, references to fonts) described by a manifest, and documents reach {{largest_doc}}. A typical user edits on {{devices}} devices, sometimes offline, with autosave every few minutes and named versions saved by hand. Under this exercise's rule (check current docs), each plan has a storage quota ({{quota}} in this scenario), version history is kept for 30 days and does not count toward the quota, and deleted documents count until the trash is emptied. A save on one device should be visible on the user's other online devices within {{sync_target}} at p95.

**Problem Statement.** Design storage and sync: the document and version model; uploading large documents by sending only changed components; making a version's commit atomic; propagating it to the other devices; handling conflicts when two devices edit the same document; quota accounting and enforcement; and measuring sync latency honestly.

**Constraints.** A saved edit is never lost, even when two devices conflict. A version becomes visible only when all of its components are stored. Uploads over poor mobile networks must resume rather than restart. Quota is checked when a save is accepted; a user over quota can still open, download and export everything. Storage cost matters: most edits change a small part of a large document.

**Assumptions.** All volumes, sizes and targets are hypothetical. Components can be addressed by a hash of their bytes. The apps cannot merge two pixel edits to the same layer automatically, but they can show two versions side by side.

**Clarifications.**
- Q: Can two devices edit the same document at once? | A: Yes, though usually it is one person moving between devices, sometimes offline. Real-time co-editing is out of scope.
- Q: Do identical components in two documents count twice toward the quota? | A: Under this exercise's rule the quota counts the logical size of each current document, so yes; deduplicated storage is your saving, not the user's.
- Q: What does "visible" mean for sync latency? | A: The other device shows the new version as current. You decide whether that requires the bytes to be downloaded.
- Q: What happens when a user goes over quota? | A: New cloud saves are refused with a clear message; nothing already stored is deleted.

**Hints.**
1. Separate immutable content (components addressed by hash) from the small, mutable pointer to the current version. A version commits by writing its manifest after all its components exist.
2. A conflict is two versions with the same parent. Keep both, then decide what each device shows.
3. Measure sync latency from the saving device's commit to the other device's acknowledgement, and include the devices you would rather not count.

**Follow-ups.**
1. Walk through saving a {{largest_doc}} document in which one layer changed, over a connection that drops halfway.
2. Two devices edited the same document offline for a day. What does each device show when it reconnects, and what is stored?
3. How do you account for quota when components are shared between versions and between documents?
4. Version history is kept for 30 days. How do you delete expired components without deleting one that a current version still uses?
5. Your sync latency p95 meets {{sync_target}}, but users say sync takes minutes. What are you not measuring?

**Follow-up rules.**
- when: last write wins, last-writer-wins, timestamp, latest → ask: A device's clock is two hours behind. Whose edits win under your rule, and does the user lose work?
- when: deduplication, dedup, content-addressed, hash → ask: A component is shared by 40 versions across three documents and one document is deleted. When is the component removed, and what proves nothing still needs it?
- when: push, notification, websocket, long poll → ask: The other device is a laptop that was asleep for three days. How does it catch up, and does that count in your latency metric?
- when: merge, merging, crdt → ask: These documents are layered images, not text. What can be merged automatically, and what cannot?
- when: quota, over quota → ask: A user goes over quota while an autosave is uploading. Do you refuse the save after half of it has been uploaded?

**Production Reality Check.**
- After a client release, devices on unstable networks sometimes publish a manifest before all of its components are uploaded; other devices open that version with missing layers.
- A user edits the same document offline on two devices for a day. On reconnecting, one device's edits vanish from the current version because the device with the later clock won.
- A storage backfill recomputes usage and includes version history by mistake; 3% of users appear to be over their {{quota}} quota, and their saves are refused.
- The sync latency dashboard shows p95 under {{sync_target}} while support tickets say sync takes minutes: the metric stops at the server commit and leaves out devices that were asleep.

**Evaluation Criteria.** Content-addressed components with resumable, chunked uploads that send only what changed; a version committed by a conditional write of its manifest only after the server verifies every component exists; a version graph with parent pointers, conflicts detected as siblings (never by device clocks) and both kept, with a clear rule for what each device shows; quota computed from the logical size of current documents and trash under the stated rule, checked before upload begins; garbage collection by reachability from live versions with a grace period; end-to-end sync latency measured from commit to the other device's acknowledgement, including devices that were offline, reported separately from online-device latency; adapts to each incident with diagnosis, recovery and prevention.

## ADB-L4-05: Restating web analytics history after a customer changes processing rules or classifications

| | |
|---|---|
| **Template ID** | ADB-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Reprocessing and restatement / versioned rules, lookup joins, atomic switch-over, tenant isolation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "sites": [20, 80, 300],
  "hits": {"2": ["300 million", "900 million"], "3": ["4 billion", "10 billion"]},
  "history_months": [13, 25, 37],
  "deadline": ["24 hours", "72 hours"]
}
```

**Business Scenario.** A web analytics product collects hits from customers' sites and apps (page views, link clicks and custom events), about {{hits}} a day across all customers. One large customer has {{sites}} sites reporting into its account and keeps {{history_months}} months of history. Two kinds of customer configuration change what reports show. Processing rules, set by the customer, act on each hit as it is processed: copy a query-string parameter into a dimension, rename a page, assign a marketing channel. Classifications are lookup tables the customer uploads: tracking code to campaign, product code to category, page to site section. Under this exercise's rule (check current docs), classifications apply to all history as soon as they are uploaded, while processing rules apply only to new hits unless the customer requests reprocessing of a date range, which must finish within {{deadline}}.

**Problem Statement.** Design restatement: how raw and processed hits are stored; how classifications reach reports (joined at query time or materialised); how a reprocessing request replays history under the new rules; how reports switch from old numbers to new without mixing them; what happens to exports and scheduled reports already delivered; and how customers see what changed.

**Constraints.** Raw hits are immutable and kept for the history window. A report must never show a date range in which some days use the old rules and some the new, unless it says so. Reprocessing one customer must not slow other customers' current-day processing. Everything except the changed rule must stay as it was for each day (bot filtering, the report time zone, visit definitions), so totals the rule does not touch do not move. Daily data feeds delivered to customers' own storage may already contain the old values.

**Assumptions.** All volumes and periods are hypothetical. Each hit has a hit id, a site id and a received time; each customer account has a report time zone. Bot filtering is the product's own rule set, versioned separately from customer rules.

**Clarifications.**
- Q: Does a processing-rule change affect the past by default? | A: Not under this exercise's rule; only a reprocessing request changes history.
- Q: What about visits and visitors, not just hits? | A: A rule could change which visit a hit belongs to only if it touched visit-defining fields; say whether you allow that.
- Q: Can a customer undo a reprocessing? | A: They can ask to. You decide what that costs.
- Q: Is bot filtering part of the reprocessing? | A: No. Reprocessing should apply the bot rules that were in force on each day.
- Q: How big is one customer's history? | A: Up to {{history_months}} months of that customer's hits, and the largest customers are a large share of all volume.

**Hints.**
1. Keep three layers: raw hits as received, processed hits under a versioned rule set, and reports. A restatement is a new version of the processed layer, built beside the old one.
2. A classification is a join against a lookup table. Decide which reports can join at query time and which need materialisation.
3. Pin everything except the changed rule to the version in force on each day, and check that totals the rule cannot affect did not move.

**Follow-ups.**
1. A customer uploads a classification file. What do their reports show one minute later, and how?
2. Walk through a reprocessing request for {{history_months}} months: where it runs, how long it takes, how it is isolated from today's processing, and how reports switch over.
3. After reprocessing, total page views for the period change by 0.5%. Should they have? How do you find out why?
4. The customer's daily data feed already delivered the old values for those months. What do you do?
5. Two reprocessing requests from the same customer overlap in time and in date range. What happens?

**Follow-up rules.**
- when: overwrite, in place, update → ask: Reprocessing fails halfway. What do reports show for the months already rewritten, and can you get the old numbers back?
- when: query time, join, view → ask: A classification table has 40 million rows and a report scans a year of hits. What does the join cost, and when do you materialise?
- when: partition, partitioned, date partitions → ask: Your reprocessing replays partition by partition. How do reports avoid showing some months new and some old in the meantime?
- when: priority, queue, isolation → ask: The largest customer's reprocessing would use a third of the cluster for a day. Who waits?
- when: notify, changelog, audit → ask: What exactly does the customer see that tells them their history changed, when and why?

**Production Reality Check.**
- A customer uploads a classification file in which 8% of tracking codes have a trailing space; across {{history_months}} months of reports, that share of campaign revenue moves to "unclassified".
- A reprocessing job for one large customer runs past its {{deadline}} deadline; for 30 hours, half of the months show the new rules and half the old, and a quarterly report mixes them.
- A processing-rule change that should only reassign marketing channels changes total page views for the reprocessed months by 0.5%: the replay used today's bot rules instead of the rules in force on each day.
- The customer's warehouse, loaded from the daily data feed, now disagrees with the restated reports, and the customer's analysts ask which is right.

**Evaluation Criteria.** Immutable raw hits with a processed layer versioned by rule set; classifications as versioned lookup tables joined at query time where affordable and materialised for heavy reports, with upload validation (normalisation, unmatched-key report) before they apply; reprocessing built beside the live version, per customer, with an atomic switch of the whole range and the old version kept for rollback; all other inputs (bot rules, time zone, visit logic) pinned per day, with an invariant check that untouched totals did not move; isolation through separate capacity or fair scheduling so one customer's replay cannot delay others; delivered feeds handled by versioned re-delivery and a change notice; a customer-visible change log; adapts to each incident with diagnosis, recovery and prevention.
