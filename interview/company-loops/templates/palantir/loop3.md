# Palantir · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of enterprise data
integration and operational analytics platforms: data connections and pipelines, an
ontology of objects, links and actions, lineage, markings and purpose-based access,
operational applications and decision workflows. Every customer, workload, number,
schema and incident is hypothetical and commercial, and every access-control rule is
this exercise's model, not a description of how any product works inside.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PLT-L3-01: The ontology as data — object types, properties, links, actions and an object as it stood on a date

| | |
|---|---|
| **Template ID** | PLT-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / metadata as versioned data, stable property ids, bitemporal object history, action log |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "objects": {"1": ["20 million"], "2": ["400 million"], "3": ["3 billion", "8 billion"]},
  "object_types": {"1": ["40"], "2": ["300"], "3": ["1,500", "4,000"]},
  "edits_per_day": ["2 million", "30 million", "150 million"],
  "schema_changes_per_week": [5, 20, 60]
}
```

**Business Scenario.** A manufacturer models its operations as an ontology: about {{object_types}} object types (asset, work order, part, supplier, plant and so on), each with typed properties; link types between object types (a work order is *for* an asset, a part is *supplied by* a supplier); and action types, the named edits a user can make in an operational application ("reassign work order", "flag part as defective"), each changing one or more objects at once. About {{objects}} objects are backed by pipeline datasets and also edited by users; together they make about {{edits_per_day}} property changes a day. The ontology itself keeps changing, about {{schema_changes_per_week}} definition changes a week: properties are added, renamed, retyped or deprecated, and link types change cardinality. Auditors and analysts ask the same kind of question again and again: "what did this work order look like on 3 March, which action changed it, and what did the schema say then?"

**Problem Statement.** Design the data model that stores the ontology's definitions and the objects' history as data. Cover: the definition tables (object types, properties with stable ids and display names, link types with cardinality, action types with their parameters and the edits they make) and how a definition change is recorded as a new version; how object property values are stored (wide per type, long per property, or events with snapshots) and with which time columns; how an action's submission, validation, and the edits it applied are logged so that edits made together stay together; and how to reconstruct one object as of a date, both under the schema in force then and under today's schema.

**Constraints.** A property keeps one stable id for life; a rename changes only its display name. History is append-only: a correction is a new record, never an update in place. Reconstructing one object as of a date takes seconds. A change of a property's type never silently rewrites stored history. An object type is deprecated, never dropped, while any object or history row refers to it.

**Assumptions.** Volumes and rates are hypothetical. The model is this exercise's, not a description of any product's internals. Objects have a stable primary key from their backing data. Times are UTC. Users edit only through actions; pipelines write through their own sync.

**Clarifications.**
- Q: Is "as of 3 March" about when a value was true or when we knew it? | A: Both are asked. A pipeline correction loaded on 10 March can fix a value that was wrong since 1 March; auditors need "as we knew it on 5 March" and analysts "as we know it now".
- Q: What happens when a property changes type, say text to date? | A: Treat it as a new version of the property's definition with a stated conversion. Old values stay as they were stored; how they are read under the new type is your design.
- Q: Can an action fail? | A: Yes. Submissions are validated; a rejected one changes nothing but is logged with the reason.
- Q: Do pipeline syncs and user edits ever touch the same property? | A: Yes, and that conflict is the subject of another question. Here, record which writer produced each value.
- Q: Can a link carry properties of its own? | A: Many-to-many links can, for example the quantity of a part on a work order. Decide how they are stored.

**Hints.**
1. Separate definitions (types, properties, link types, action types) from instances (objects, values, links, action runs), and version the definitions with valid_from and valid_to.
2. Key every value by the property's stable id, never by its display name.
3. Two time axes answer the two questions: when a value was true (valid time) and when the platform recorded it (recorded time).

**Follow-ups.**
1. A property `status` is renamed `lifecycle_state` and two of its allowed values are merged. Show what a query over last quarter returns, before and after the change.
2. A correction loaded today fixes a value that was wrong since last month. Show the rows, and the predicates for "as we knew it on the 5th" and "as we know it now".
3. One action edited three objects and one of the edits failed validation. How does your log show what happened, and what did the other two objects end up with?
4. At {{objects}} objects and {{edits_per_day}} changes a day, estimate the history's growth. What do you snapshot, how often, and how do you compact old history without losing what auditors need?

**Follow-up rules.**
- when: json, jsonb, document column → ask: A property changes from text to date across millions of objects. How does a reader of your JSON tell an old string from a new date, and how is a query over last year written?
- when: eav, entity attribute value, long format, key value → ask: A dashboard reads 30 properties of 2 million objects. How many rows is that in your layout, and what do you materialise to keep it fast?
- when: alter table, add column, wide table → ask: Definitions change {{schema_changes_per_week}} times a week. What does each change cost your wide tables, and how do you keep last year's shape for history?
- when: bitemporal, recorded_at, transaction time, system time → ask: Write the two timestamps for a correction loaded today about last month, and the exact predicate for "as we knew it on the 10th".
- when: snapshot, daily snapshot → ask: An auditor asks for the object at 14:32 on a given day. What does your daily snapshot answer, and what fills the gap between snapshots?

**Production Reality Check.**
- A property rename was deployed as a new property plus the deletion of the old one. Every report spanning the change shows the property empty before the rename date, and history for objects of that type no longer joins across it.
- A pipeline backfill re-loaded six months of corrected values and stamped each row's recorded time with its valid time. "As we knew it" views for last quarter now show values nobody saw then, and an audit of decisions made in that quarter reads the wrong data.
- With {{schema_changes_per_week}} definition changes a week, a link type's cardinality changed from one-to-many to many-to-many. Older links have no row in the new link table, and an application shows them as missing.

**Evaluation Criteria.** Definitions modelled as versioned data with stable ids separate from display names; instances keyed by those ids; a clear time model (valid and recorded time, or an equivalent with an explicit argument); an action log that groups edits and records rejections; a reconstruction path for one object at a date under both schemas; a growth estimate with snapshots and compaction; type changes and renames handled without rewriting history; each incident contained, corrected and guarded.

## PLT-L3-02: Markings and purpose-based access as data — inheritance along lineage, expiring grants, and who could read what when

| | |
|---|---|
| **Template ID** | PLT-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / access metadata over lineage, effective markings, time-bounded purpose grants, access audit |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "datasets": {"1": ["2,000"], "2": ["40,000"], "3": ["300,000", "1 million"]},
  "users": ["500", "8,000", "60,000"],
  "grant_days": [30, 90, 180],
  "markings": [12, 40, 150]
}
```

**Business Scenario.** A pharmaceutical manufacturer integrates its manufacturing, quality and commercial data into about {{datasets}} datasets used by {{users}} people. In this exercise's model, a dataset carries markings (there are {{markings}} kinds, for example *trial participant data*, *supplier pricing*, *unreleased financials*). A user can read a dataset only if they hold every marking on it **and** have an active purpose grant for it: a request stating the purpose ("batch deviation investigation", "quarterly supplier review"), approved by the data owner, that expires after {{grant_days}} days unless renewed. A dataset derived from others inherits the union of its inputs' markings, unless an approved release step removes a marking (for example, an aggregation that leaves no participant-level rows). Compliance asks two kinds of question: "who could read this dataset on 4 June, and why?", and "which datasets carried *trial participant data* on 4 June, and through which inputs?"

**Problem Statement.** Design the data model for markings, lineage, purpose grants and the access audit. Cover: markings applied directly to datasets and their history; the lineage graph between dataset versions; how effective (inherited) markings are computed and stored, and how they change when an upstream marking or an edge in the lineage changes; release steps that remove a marking, with their approvals; users' marking eligibility; purpose grants with requests, approvals, renewals, expiry and revocation; read events; and the queries that answer "could user U read dataset D at time t, and through which grant and markings?", for any past t.

**Constraints.** Every answer about the past is reproducible: what was effective at time t is never recomputed from today's state. A dataset's effective markings never lose an inherited marking except through an approved release step. Grants expire exactly at their stated expiry. Read events are append-only. The model describes the rules; how a platform enforces them at read time is out of scope.

**Assumptions.** Counts and durations are hypothetical; the access rules are this exercise's model, not any product's. Lineage is known for every derived dataset from the pipeline that builds it. Users' marking eligibility is managed elsewhere and arrives as dated changes.

**Clarifications.**
- Q: If one input of a derived dataset is marked, is the whole output marked? | A: Yes. Inheritance is the union of all inputs' effective markings, at the dataset version that was built.
- Q: Can a marking be removed upstream? | A: Yes, by the owner, with a reason. What happens downstream is part of your design; say whether it is immediate or waits for a rebuild.
- Q: Does a renewal create a new grant? | A: Your choice; the audit must show the original request, every renewal and who approved each.
- Q: What exactly is a read? | A: A logged event: user, dataset version, time, the grant used, and the application or query that read it.
- Q: Is revoking a grant retroactive? | A: No. It stops future reads; reads made before revocation stay valid in the audit.

**Hints.**
1. Store direct markings and lineage edges with validity; compute effective markings as a derived, versioned table keyed by dataset version.
2. A grant is an interval with a purpose, an approver and a reason; renewals extend it with their own records.
3. "Could U read D at t" is a join of three time-bounded facts: U's eligible markings at t, D's effective markings at t, and U's grants for D active at t.

**Follow-ups.**
1. Lineage forms a diamond: dataset C reads A and B, both of which read a marked dataset R. R's marking is removed. When does C lose it, and what does the audit show for the hours in between?
2. Write, in words or SQL, the check for reads that happened outside an active grant or without every required marking.
3. A grant of {{grant_days}} days expires mid-investigation and the user renews a day late. What does the model record for the gap, and which reads in it are flagged?
4. At {{datasets}} datasets, a marking added to one raw dataset reaches thousands of descendants. How do you recompute effective markings incrementally, and how long may they lag?
5. An approved release step removed *trial participant data* from an aggregate, and the aggregate's code later changed so that small groups re-appear. How does your model notice that the approval no longer covers the output?

**Follow-up rules.**
- when: role, rbac, group → ask: Two analysts in the same group have the same markings but different purposes. Where does purpose live in your design, and how does the audit show which purpose a read served?
- when: inherit, propagation, lineage → ask: A marking is added upstream while a downstream build is running. Which version of the output carries it, and what about reads of the previous version?
- when: cache, materialise, materialize → ask: Your effective markings are materialised. An upstream edge is added. What exactly is invalidated, and what is the read path during recomputation?
- when: revoke, revocation → ask: A grant is revoked at 10:00. A long-running query started at 09:58 reads until 10:05. What does your audit record?
- when: expiry, expires, ttl → ask: Is a grant valid at exactly its expiry time? Write the comparison and say why.

**Production Reality Check.**
- A marking was added to a raw dataset of supplier pricing; the job that recomputes effective markings lagged for hours, and a derived dashboard stayed readable by users without that marking. Compliance asks exactly who read it in that window.
- A batch of grants created on the same day for a {{grant_days}}-day project expired together on a holiday. Hundreds of analysts lost access mid-investigation, and the renewals approved in bulk the next morning carried no stated purpose.
- A release step approved for an aggregate was reused when the aggregate's inputs changed; the output now includes participant-level rows while carrying no *trial participant data* marking.

**Evaluation Criteria.** Direct markings, lineage, effective markings and grants modelled as time-bounded data; inheritance at dataset-version grain with a stated propagation rule and lag; release steps as approved, scoped records tied to a specific output version; grants with purpose, approval, renewal, expiry and non-retroactive revocation; an append-only read log that records the grant used; a reproducible "could U read D at t" query; incremental recomputation at scale; each incident contained, corrected and guarded, without describing any product's enforcement internals.

## PLT-L3-03: Decision workflows as data — alerts, cases, assignments, closing actions and outcomes weeks later

| | |
|---|---|
| **Template ID** | PLT-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / case lifecycle, assignment history, actions with parameters, delayed outcome labels |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "alerts_per_day": {"1": ["5,000"], "2": ["60,000"], "3": ["400,000", "1.5 million"]},
  "rules": [30, 120, 400],
  "inboxes": [20, 80, 300],
  "outcome_weeks": [2, 4, 6]
}
```

**Business Scenario.** A food distributor runs its operations from applications built on integrated data. About {{rules}} rules raise {{alerts_per_day}} alerts a day on objects: a refrigerated shipment whose temperature drifts, a purchase order a supplier is late to confirm, a store forecast to run out of a staple. Related alerts are grouped into a case, and cases are routed to {{inboxes}} team inboxes, where planners pick them up, reassign them, and act: reroute a shipment, expedite an order, accept a delay, or dismiss the case as a false alarm. Each action is recorded with its parameters. Whether a decision was good is known only later: about {{outcome_weeks}} weeks afterwards the distributor knows whether the shipment was accepted in specification, whether the store ran out, and what the expedite cost. Leaders want time to first action, false-alarm rate per rule, workload per inbox, and which actions tend to lead to better outcomes.

**Problem Statement.** Design the data model. Cover: alerts (rule, rule version, the object and the values that triggered it), cases and the alert-to-case grouping (which can change), the case lifecycle and its states, assignments and reassignments to inboxes and people, actions with parameters and their effect on objects, the closing resolution, and outcomes that arrive weeks later and can be revised. Define precisely: time to first action, false-alarm rate per rule (and its cohort), and an outcome comparison by action type that does not mistake selection for effect. Say which facts and grains answer these questions, and what is reported per inbox versus per person.

**Constraints.** Case history is append-only; the current state is derived. Every action records who took it, when, with which parameters, and on which object version. Outcomes are labelled with their source and the date they became known. Workload and timing are reported per inbox and per rule, not used to rank individual planners.

**Assumptions.** Volumes, rule counts and delays are hypothetical. Rules are versioned. A case can contain alerts on several objects (for example several shipments on one truck). Outcomes come from other systems (receiving, store sales, invoices) through pipelines.

**Clarifications.**
- Q: Can an alert move to another case? | A: Yes, when a planner merges or splits cases. The history must show it.
- Q: When does time to first action start? | A: Your choice: when the first alert fired, or when the case reached an inbox. Define it, and say what happens on reassignment.
- Q: Can a closed case reopen? | A: Yes, if a new alert joins it within a window you choose.
- Q: Are dismissals always false alarms? | A: No. A planner may dismiss because someone already fixed it outside the application. Your resolution codes should let you tell these apart.
- Q: Can an outcome change after it is recorded? | A: Yes; a credit note can arrive after the first invoice, for example.

**Hints.**
1. Separate events (alert raised, case created, assigned, action taken, closed, reopened) from current-state tables, and derive the latter.
2. Store rule version and the triggering values on each alert; a rule change otherwise looks like a change in the world.
3. Outcomes are their own table keyed by case (or object) with a known_at date, so "what did we know then" stays answerable.

**Follow-ups.**
1. A rule's threshold was changed mid-month. Show how your model reports the false-alarm rate before and after, and why the two are not directly comparable.
2. Expedited shipments had better outcomes than accepted delays. What else could explain that, and what would your data need to say more?
3. A case was merged into another after two days. How do timing metrics treat each of the original alerts?
4. At {{alerts_per_day}} alerts a day and outcomes arriving {{outcome_weeks}} weeks later, which facts do you keep at event grain, which as accumulating snapshots per case, and when is a month's outcome report final?

**Follow-up rules.**
- when: status column, update the case, current status → ask: A case went open → assigned → reassigned → closed → reopened. With a status column, how do you compute time to first action for last month?
- when: false positive, false alarm, dismissed → ask: Which dismissals count as false alarms, and how does your resolution code tell "not a problem" from "already fixed elsewhere"?
- when: per planner, per person, leaderboard, ranking → ask: Planners take harder cases in different inboxes. What would a per-person comparison actually measure, and what would you report instead?
- when: outcome, label → ask: The outcome for a case is revised five weeks later. Which reports change, and how does a reader know which version they saw?
- when: causal, effect, uplift → ask: Planners chose which cases to expedite. What would let you estimate the effect of expediting rather than the difference between the cases chosen?

**Production Reality Check.**
- A rule change doubled one rule's alerts overnight. Inboxes filled, time to first action rose for every rule, and the dashboard attributed the slowdown to planners rather than to the rule version.
- A cleanup job closed thousands of stale cases with the resolution "dismissed". The false-alarm rate per rule jumped for the month, and two useful rules were proposed for retirement.
- Outcomes arrive about {{outcome_weeks}} weeks after a case closes; a weekly report treated cases with no outcome yet as failures, so the newest actions always looked worst.

**Evaluation Criteria.** Alerts, cases, membership, assignments, actions, resolutions and outcomes modelled as separate, time-stamped facts; rule versions and triggering values on alerts; derived current state; precise definitions of time to first action and false-alarm rate with cohorts; outcomes with known_at and revisions, and a stated close for monthly reports; caution about selection effects; reporting per inbox and rule rather than ranking people; each incident contained, corrected and guarded.

## PLT-L3-04: Scenarios as data — what-if copies of objects, proposed changes, approvals and plan against actual

| | |
|---|---|
| **Template ID** | PLT-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / copy-on-write overlays on objects, scenario lineage, approval and apply, plan-versus-actual |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "objects_in_scope": {"2": ["2 million"], "3": ["20 million", "60 million"]},
  "open_scenarios": [50, 400, 1500],
  "edits_per_scenario": ["500", "5,000", "50,000"],
  "horizon_weeks": [6, 13, 26]
}
```

**Business Scenario.** A manufacturer's planners decide how to respond to disruptions by building what-if scenarios over the integrated picture of plants, lines, parts, suppliers and orders (about {{objects_in_scope}} objects in scope). A scenario starts from the live objects at some moment and proposes changes: move a part's production from one plant to another for {{horizon_weeks}} weeks, add a second supplier, delay a batch of orders. Each scenario holds up to about {{edits_per_scenario}} proposed edits, can be copied and varied into a new scenario, and is scored by models (capacity, cost, late orders). About {{open_scenarios}} scenarios are open at once. A chosen scenario is approved and applied: its edits become real changes made through actions. Months later, leaders want to compare what the chosen scenario predicted with what actually happened.

**Problem Statement.** Design the data model for scenarios. Cover: the scenario entity and its lineage (copied from which scenario, based on the live data as of when); how proposed edits are stored without copying the base objects; how a reader resolves an object's value inside a scenario; what happens when the live data changes under an open scenario (pinned to its base time, or rebased) and how conflicts are detected; model runs and their outputs per scenario, with the model version and inputs; approval and application (which edits were applied, by which actions, and what failed); and the plan-versus-actual comparison over the {{horizon_weeks}}-week horizon.

**Constraints.** A scenario never changes live data until it is applied. Reading an object inside a scenario returns the base value unless the scenario (or its ancestors) proposed a change. A scored result is reproducible: same scenario version, model version and inputs give the same numbers. An approved scenario version is frozen. Applying is auditable edit by edit.

**Assumptions.** Counts and horizons are hypothetical. The model is this exercise's, not a description of any product's internals. Live object history is kept with valid and recorded time (assume it exists). Models are versioned and deterministic given their inputs.

**Clarifications.**
- Q: When a scenario is copied, are its edits copied too? | A: Your choice: copy them or inherit them from the parent. The read path and storage differ; say which and why.
- Q: The live data changed after a scenario was created. Which values does the scenario see? | A: Decide between pinned (the base as of creation) and rebased (the latest base plus the scenario's edits). Planners need both, explicitly.
- Q: Can an edit fail when applied? | A: Yes, if the object it changes has moved on or been deleted. The application must record it.
- Q: What is "actual" in plan-versus-actual? | A: The live objects and outcomes over the horizon, as recorded after the fact; say which version of them the comparison reads.

**Hints.**
1. Store a scenario as a base reference (a time) plus an overlay of edits keyed by (object, property); copy-on-write, never a copy of the objects.
2. Resolve a value by checking the scenario's overlay, then its ancestors', then the base as of the base time.
3. Record base version per edit, so applying can detect that the live value changed since the edit was proposed.

**Follow-ups.**
1. Scenario B was copied from A, then A was edited again. Does B see A's new edit? Show your read path for one property.
2. Estimate storage for {{open_scenarios}} open scenarios with {{edits_per_scenario}} edits each, versus copying the objects in scope. Which reads become slower with overlays, and how do you index them?
3. The chosen scenario predicted 40 late orders and 112 occurred. Which tables do you join to explain the gap, separating "the world changed" from "the model was wrong" from "we did not apply what we approved"?
4. A planner rebases an old scenario onto today's data, and 300 of its edits now conflict. What does your model record, and what does the planner see?

**Follow-up rules.**
- when: copy the objects, full copy, clone, duplicate tables → ask: With {{open_scenarios}} open scenarios over {{objects_in_scope}} objects, how much storage is that, and what happens to a copy when the base changes?
- when: overlay, copy-on-write, delta → ask: A scenario four levels deep reads one property. Walk through the lookups, and say how you keep that fast.
- when: rebase, latest base → ask: A rebased scenario's score changed overnight without anyone editing it. How does a planner see why?
- when: model version, score, model run → ask: The cost model was upgraded after approval. Which numbers does plan-versus-actual use, and where is that recorded?
- when: apply, applied, approval → ask: Half the approved edits applied and half failed because objects had moved on. Is the scenario applied? What do the plan-versus-actual numbers compare against?

**Production Reality Check.**
- An early version stored each scenario as a full copy of the objects in scope. With {{open_scenarios}} scenarios open over {{objects_in_scope}} objects, storage grew past budget in a month and scenario creation took tens of minutes.
- A scenario approved against a three-week-old base was applied; a supplier it relied on had since been marked inactive, and dozens of its edits were applied on top of changes made after the base without anyone being shown a conflict.
- A plan-versus-actual review recomputed the approved scenario's predictions with the current model version, and the predicted late orders changed after the decision had been taken.

**Evaluation Criteria.** Scenarios as a base time plus overlays with lineage, never full copies; an explicit read path through ancestors and base; pinned versus rebased semantics with conflict detection by base version; frozen approved versions; model runs recorded with model version and inputs; apply as audited edit-by-edit outcomes; a plan-versus-actual model that separates base drift, model error and execution gaps; storage and read-path estimates; each incident contained, corrected and guarded.

## PLT-L3-05: Dangling links — target objects deleted under live links, and how long each stayed broken

| | |
|---|---|
| **Template ID** | PLT-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / interval overlap of link versions and deletion periods, outcome classification, LEFT JOIN from a dimension |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | PLT-L3-05.mjs |

**Business Scenario.** A manufacturer's operational applications read an ontology of objects joined by typed links (here {{link_type_list}}). Pipelines delete an object when its source row disappears, and restore it if the row comes back; applications and users re-point links to other objects or remove them. A link whose target object is deleted is dangling: applications show a broken reference until the link is fixed or the target comes back. The data quality team wants, per link type, how many dangling episodes there were, how each one ended, and how long fixes took. The tables are a snapshot taken at {{as_of}}; nothing in them happens after that time.

**Problem Statement.** Write one PostgreSQL query that returns `link_type, episodes, removed, repointed, restored, still_dangling, avg_hours_to_fix`: one row per link type in `link_types` (a link type with no episodes shows zeros and a NULL average), ordered by `link_type`. `link_versions` holds each link's target over time: a version is in force from `valid_from` (inclusive) to `valid_to` (exclusive), and `valid_to` is NULL while it is in force. Re-pointing closes version n and opens version n + 1 at the same instant with another target; removing closes the last version with no successor. `object_deletions` holds one row per period an object spent deleted, from `deleted_at` to `restored_at` (NULL while it is still deleted). {{restore_rule}} A **dangling episode** is the overlap of one link version with one deletion period of its target object: it starts at the later of `valid_from` and `deleted_at`, ends at the earlier of `valid_to` and `restored_at` (a NULL end is open), and counts only if it starts strictly before it ends. Each episode is still dangling if both ends are open; otherwise the earlier end decides how it ended: `repointed` if `valid_to` ended it and the link has a next version, `removed` if `valid_to` ended it and the link has none, `restored` if `restored_at` ended it first. When `valid_to` equals `restored_at`, credit the link change (removed or repointed). `avg_hours_to_fix` is the total length in seconds of the link type's resolved episodes (removed, repointed or restored) ÷ (3600 × their number), rounded to 2 decimal places. {{grace_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{versions}} link versions and {{deletions}} deletion periods; production has hundreds of millions of links. Times are UTC. Every `target_object_id` exists in `objects`.

**Assumptions.** Hypothetical schema, link types, object ids and times; the model is this exercise's, not a description of any product's internals. Only the target side matters here (deleted source objects are handled by another check). Every new version of a link changes its target.

**Clarifications.**
- Q: A link was re-pointed to an object that had already been deleted. Is that an episode? | A: Yes, a new one. It starts when that version starts, not when the object was deleted.
- Q: The target was deleted at exactly the instant the link version ended. | A: That overlap has zero length, so it is not an episode.
- Q: Two links point at the same deleted object. One episode or two? | A: Two. Episodes belong to link versions, not to objects.
- Q: Does a still-dangling episode count in the average? | A: No. It has no end yet; it counts in `episodes` and `still_dangling` only.
- Q: Should a link type with no episodes appear? | A: Yes, with zeros and a NULL average.

**Hints.**
1. Join each link version to its target's deletion periods and keep the pairs whose overlap has positive length: the later start is strictly before the earlier end, with an open end treated as `'infinity'`.
2. "Has a next version" is an EXISTS on (link_id, version + 1), or LEAD over the link's versions.
3. Aggregate episodes per link type, then LEFT JOIN from `link_types`; count a column from the episode side, not `*`.

**Follow-ups.**
1. At hundreds of millions of links, how would you keep a live count of dangling links per type without re-running this join?
2. Write the follow-on query that lists the 20 longest still-dangling links with their source object, for the owning team's inbox.
3. Deletion periods arrive from a feed that can be hours late. Which numbers in this report change, and how do you label a report that may be incomplete?
4. Which deletions would you block, which would you cascade to links, and which would you allow and report? Who should decide, per link type?

**Follow-up rules.**
- when: inner join, join link_types → ask: Which link type disappears from your result, and how would the data quality team tell "clean" from "missing"?
- when: count(*) → ask: After a LEFT JOIN, what does COUNT(*) return for a link type with no episodes?
- when: deleted_at as, start at deleted_at → ask: A link was re-pointed at 10:00 to an object deleted at 08:00. When does your episode start, and what does that do to the average?
- when: lead, lag → ask: Over which partition and order does your window run? Show what it returns for the last version of a link.
- when: between → ask: BETWEEN is inclusive at both ends. What does it do with a target deleted exactly when the link version ended?

**Production Reality Check.**
- A source system re-keyed its supplier records overnight. The pipeline deleted every affected object and created new ones with new ids; the next morning this report showed thousands of new dangling links of one type that no restore would ever fix.
- An application cached link targets for a day and kept showing deleted objects as if they were live. Users saw no broken references, while this report counted the full dangling time; the team must decide which number the data quality target is measured on.

**Evaluation Criteria.** Interval overlap computed with the later start and the earlier end, open ends handled, zero-length overlaps excluded; the start taken from the version when the target was already deleted; outcomes classified by which end came first, with the tie credited to the link and "next version" decided per link; one row per link type from `link_types` with counts that are 0 (not 1) for clean types; the average over resolved episodes only, rounded as stated; at Hard and above, several deletion periods per object; at Very Hard, the grace period applied exactly; deterministic ordering; can explain incremental maintenance and late feeds.
