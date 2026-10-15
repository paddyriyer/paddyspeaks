# Palantir · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of enterprise data
integration and operational analytics platforms: data connections and pipelines,
an ontology of objects, links and actions, lineage, access restrictions,
operational applications and model deployment. Every scenario is a commercial one
(a manufacturer, a distributor, a utility, a hospital network) described
generically; it is not any real customer or deployment. Access restrictions
follow this exercise's model, every workload, number and schema is hypothetical,
and nothing here describes how the company's own products or systems are built.

## PLT-L4-01: Ontology indexing: objects in sync with their datasets, user edits merged, queries in seconds

| | |
|---|---|
| **Template ID** | PLT-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Object indexing / dataset-to-index sync, edit merging, re-indexing without downtime, row restrictions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "object_types": {"2": [40, 120], "3": [400, 900]},
  "objects": {"2": ["50 million", "200 million"], "3": ["2 billion", "6 billion"]},
  "edit_rate": ["200", "1,500", "6,000"],
  "sync_minutes": [5, 15, 30]
}
```

**Business Scenario.** A large manufacturer models its operations on an enterprise data platform as an ontology: {{object_types}} object types such as Plant, Machine, Work Order, Part, Supplier and Shipment, each backed by a dataset that pipelines rebuild, with link types between them (a Work Order is for a Machine; a Shipment carries Parts from a Supplier). Altogether there are about {{objects}} objects. Operational applications let planners and engineers filter and search objects, aggregate them (open work orders by plant and priority), follow links, and edit properties through actions (reassign a work order, mark a shipment delayed, set a machine's status). At the start of a shift, edits peak at {{edit_rate}} per second. Pipelines rebuild backing datasets on their own schedules, some as often as every {{sync_minutes}} minutes, sometimes as an incremental append and sometimes as a full snapshot.

**Problem Statement.** Design the object indexing and query layer. Cover how changes in backing datasets reach the index (and how you find what changed when a pipeline writes a full snapshot); where user edits are stored and how they are merged with pipeline values under this exercise's rule (per property, the later of the latest edit and the latest source change wins; a tie goes to the edit); read-your-writes after an action; link traversal; schema changes to an object type (a new property, a changed type) and full re-indexing without taking the type offline; how this exercise's row restrictions are applied so a user never sees, or counts, an object they may not read; and how you know the index is current.

**Constraints.** Filter and search queries over one object type return their first page with p95 under 2 seconds; aggregations over up to {{objects}} objects under 5 seconds. A change in a backing dataset is queryable within {{sync_minutes}} minutes of its build finishing. A user who submits an edit sees it in their next query. No edit is ever lost by a re-index, a schema change or a pipeline rebuild. Counts and aggregates must not include objects the user cannot read.

**Assumptions.** All volumes, timings and counts are hypothetical. Each backing dataset is versioned: every build produces a new version, and a primary key column identifies each object. Row restrictions in this exercise are expressed as a set of restriction labels on each object, derived from its properties (for example the plant), and a set of labels each user holds.

**Clarifications.**
- Q: Do edits go back to the source system? | A: Not in this question; edits live on the platform. Writeback is a separate topic.
- Q: Can a pipeline delete an object that has edits? | A: Yes. Say what happens to its edits, and what happens if the same key reappears later.
- Q: Is the primary key guaranteed stable? | A: It is meant to be. Pipelines change, and you should say what protects you when it is not.
- Q: How fresh must link traversal be? | A: The same as properties: within {{sync_minutes}} minutes of the build, and immediate for links changed by an action.
- Q: Do all object types need full-text search? | A: Only some properties are searchable; most queries are filters, sorts and aggregations.

**Hints.**
1. Keep user edits in their own durable store, keyed by object and property. The index is a projection of datasets plus edits and can always be rebuilt from both.
2. A full snapshot is still a change set: diff it against the previous version by primary key and a row hash.
3. A schema change or full re-index is easier as a new index built beside the old one and switched in one step once it has caught up.

**Follow-ups.**
1. Walk through one edit: an engineer sets a machine's status to "down". Which stores change, in what order, and when does the next query from the same engineer, and from a planner elsewhere, see it?
2. A pipeline that used to append changes now writes a full snapshot every {{sync_minutes}} minutes. How does your sync keep up, and what does it cost?
3. Which timestamp is the "source change" time in the merge rule: the build's time, a timestamp column in the data, or something you record? What goes wrong with each?
4. An object type's property changes from string to integer and some rows will not cast. How do you roll the change out without stopping the type's sync?
5. How do you make sure an aggregation over {{objects}} objects never counts an object the user cannot read, and still meets 5 seconds?

**Follow-up rules.**
- when: elasticsearch, opensearch, search index, inverted index → ask: Your search index is near real-time, not transactional. How do you give the engineer read-your-writes after an action?
- when: cdc, change data capture, incremental → ask: A pipeline rewrites its whole dataset each build although only 0.1% of rows changed. Where do your change events come from now?
- when: last write wins, latest wins, overwrite → ask: A pipeline build today carries a value that the source system recorded last week, after an edit made yesterday. Which wins under your design, and why?
- when: reindex, re-index, rebuild, backfill → ask: The largest object type takes six hours to re-index. What do users see during those six hours, and how are edits made meanwhile not lost?
- when: filter at query time, post-filter, filter the results → ask: The user's query matches a million objects and they may read only a thousand. How do your pagination and counts work if you filter after the search?

**Production Reality Check.**
- A pipeline change adds a plant prefix to every Work Order primary key. The next sync sees every work order deleted and a new one created, and about 80,000 user edits now point at keys that no longer exist.
- A full re-index of the largest of the {{object_types}} object types runs during the working day: query p95 rises from 1 second to 9 seconds, and for 40 minutes queries return a mix of old and new values.
- At a shift change, edits reach {{edit_rate}} per second and the edit pipeline falls 3 minutes behind; engineers cannot see their changes and submit them again.
- A property's type changes from string to integer in its backing dataset; 2% of rows fail to cast, that object type's sync stops, and its objects are now three builds behind.

**Evaluation Criteria.** User edits in a durable store separate from the index, with the index as a rebuildable projection of datasets plus edits; a correct change-detection path for both incremental and snapshot builds (diff by primary key and row hash); a precise merge rule with a recorded source-change time; read-your-writes after actions; links indexed for traversal in both directions; schema changes and re-indexes done side by side with a switch-over and changelog catch-up; row restrictions applied inside the query before pagination and aggregation; freshness and lag monitored per object type; guards against mass deletes and key changes; adapts to each incident with diagnosis, recovery and prevention.

## PLT-L4-02: Operational alerting over integrated data: rules on object changes, collapsed duplicates, routing, time to action

| | |
|---|---|
| **Template ID** | PLT-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Alerting / rule evaluation on changes, stateful conditions, deduplication, routing, alert lifecycle metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "sites": {"2": [12, 40], "3": [150, 400]},
  "rules": {"2": [300, 800], "3": ["3,000", "8,000"]},
  "changes": {"2": ["2,000", "5,000"], "3": ["40,000", "100,000"]},
  "renotify_hours": [4, 12, 24]
}
```

**Business Scenario.** A distributor runs {{sites}} warehouses and integrates its orders, shipments, inventory positions and warehouse equipment readings into one set of objects on an enterprise data platform. Operations teams want alerts: an inventory position of a critical part below its safety stock for more than 2 hours; a shipment whose estimated arrival slips by more than a day for an order due this week; a conveyor motor above its temperature limit on three readings in a row; a site whose inventory feed has not updated for 2 hours. Teams write about {{rules}} such rules. Objects change up to {{changes}} times per second at peak, from pipelines, sensor feeds and users' edits. Alerts go to team inboxes, where people acknowledge them, assign them and close them with the action they took, or with "no action needed".

**Problem Statement.** Design the alerting system. Cover how rules are written, versioned and owned; how they are evaluated on object changes, including duration conditions ("for more than 2 hours"), sequence conditions ("three readings in a row") and absence conditions ("no update for 2 hours"); one open alert per rule and object, with a reminder after {{renotify_hours}} hours if nobody acts; collapsing a storm of alerts that share one cause; routing to inboxes and on-call; access (under this exercise's model an alert never shows a recipient a property they may not read); testing a new rule against history before it goes live; and measuring time to acknowledge, time to action and the share of alerts closed with no action, per rule and team.

**Constraints.** A threshold breach on a sensor reading alerts within 1 minute; other rules within 5 minutes. A recipient never receives two open alerts for the same rule and object. Alert history (every state change, who made it and when) is kept for two years and is the only source for the time-to-action measures. Rule state must survive the evaluator restarting.

**Assumptions.** All volumes, timings and counts are hypothetical. Every object change is available as an event with the object's key, the changed properties, the time of the change and its origin (pipeline build, sensor feed, user edit, backfill).

**Clarifications.**
- Q: Who writes rules? | A: Operations analysts, through a form or a small expression language; some engineers write more complex ones. Most are simple thresholds.
- Q: Do alerts close themselves? | A: A rule may auto-resolve when the condition clears; the alert history must show that it did.
- Q: Are backfills common? | A: Yes; pipelines are re-run after fixes and can rewrite months of history in an hour.
- Q: How many teams and inboxes? | A: A few hundred, with on-call rotations for the equipment rules.
- Q: Can a rule depend on linked objects, such as the order a shipment belongs to? | A: Yes, one link away. Say what triggers re-evaluation when the linked object changes.

**Hints.**
1. Separate three kinds of evaluation: stateless predicates on a change, stateful conditions that need history per object, and absence conditions that need a timer.
2. Give every alert a stable key, such as rule and object; the rule version is a property of the alert, not part of its key.
3. Know where a change came from. A backfill or a dead feed should not look like the world changing.

**Follow-ups.**
1. Walk through the conveyor rule: three readings above the limit in a row. Where is the state kept, and what happens when readings arrive out of order?
2. How do you evaluate "below safety stock for more than 2 hours" when the inventory position does not change again during those 2 hours?
3. A rule's owner fixes its threshold. What happens to the alerts it has open, and to the time-to-action history?
4. One upstream feed fails and 3,000 alerts fire across {{sites}} sites. How does the inbox show one problem instead of 3,000?
5. How do you test a new rule against the last 90 days before enabling it, and what number tells the owner it is too noisy?

**Follow-up rules.**
- when: cron, scheduled job, every minute, batch → ask: A motor crosses its limit seconds after your job runs. When does the alert fire, and does that meet the 1-minute target?
- when: flink, kafka streams, stream processing, streaming → ask: A duration condition holds state per object for hours. Where is that state stored, and what happens to it on a restart or a redeploy?
- when: dedup, deduplicate, dedupe, suppress → ask: The same object breaches again a minute after its alert was closed. New alert or reopen? What does that do to time-to-action?
- when: anomaly detection, machine learning, ml → ask: An analyst asks why an alert fired and why another did not. What can you show them?
- when: email, slack, pager, page → ask: A storm sends 50,000 messages to the on-call engineer's phone. Which layer of your design should have stopped it?

**Production Reality Check.**
- A pipeline backfill rewrites three months of shipment arrival estimates in one hour; the rules treat every change as new, and 180,000 alerts reach inboxes in 20 minutes.
- A rule's threshold is edited; its open alerts are closed and reopened under the new version, and the owning team's time to action appears to halve overnight.
- One of the {{sites}} warehouses' inventory feed stops for 6 hours. The "no update for 2 hours" rule fires for every inventory position at that site, burying a real stock-out alert from another site.
- The evaluator is redeployed and its duration state is lost; for the next 2 hours, "below safety stock for more than 2 hours" alerts fire late or not at all.

**Evaluation Criteria.** Rules as versioned, owned data in a constrained language; three evaluation paths (stateless, stateful with durable per-object state and event-time ordering, absence with timers); stable alert keys with the version stored on the alert; an append-only alert lifecycle that drives the measures; origin-aware evaluation that keeps backfills and feed outages from looking like real changes; storm collapse by shared cause and per-rule rate caps; routing with on-call and reminders; access checked per recipient when the alert is rendered; backtesting of rules with a noise measure; adapts to each incident with diagnosis, recovery and prevention.

## PLT-L4-03: One supply-chain picture from many suppliers' feeds, conflicts reconciled and flagged

| | |
|---|---|
| **Template ID** | PLT-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Data integration / supplier feeds, entity resolution, source precedence, conflict flags, projected inventory |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "suppliers": {"2": [300, 800], "3": ["3,000", "9,000"]},
  "plants": {"2": [6, 12], "3": [30, 45]},
  "horizon": [14, 30, 60],
  "stale_days": [2, 3, 5]
}
```

**Business Scenario.** A manufacturer buys parts from about {{suppliers}} suppliers for {{plants}} plants. Its own planning system holds purchase orders and production orders. Suppliers send order confirmations, ship notices and capacity notes in many ways: structured electronic messages, files on a schedule, API pushes, and spreadsheets uploaded by hand each week. Carriers send tracking events. A team also logs disruptions as they hear of them: a port delay, a supplier's plant closed by a flood, a capacity cut. Planners want one picture: for each part and plant, what is on hand, what is on the way and when it will arrive, and which production orders in the next {{horizon}} days are at risk because a part will run out. Sources disagree often, and the planners need to see when they do.

**Problem Statement.** Design the integration and the picture. Cover ingestion of each kind of feed with validation and a record of every file and message received; resolving parts and suppliers across sources (each supplier has its own part numbers and units); source precedence for each field (who is believed for quantity shipped, ship date, arrival estimate); detecting and flagging conflicts instead of silently choosing; linking disruptions to the shipments and orders they affect; the projected inventory per part, plant and day over the next {{horizon}} days and the first day it goes below zero; feed freshness, with a supplier's feed treated as stale after {{stale_days}} days without an update; and how a planner sees where each number came from.

**Constraints.** Every value shown carries its source and as-of time. A conflict between sources is shown, never hidden. The at-risk list is recomputed within 30 minutes of any relevant feed arriving. A wrong part match must be reversible, with everything computed from it recomputed. A stale feed must never look like "nothing has changed".

**Assumptions.** All volumes, counts and timings are hypothetical. The planning system is the authority for purchase orders and production orders. Suppliers and carriers are not under the manufacturer's control and their feeds change without notice.

**Clarifications.**
- Q: Is there an existing part master? | A: The manufacturer has its own part numbers; about 70% of supplier part numbers are already mapped to them. The rest are mapped by hand, slowly.
- Q: How reliable are the sources? | A: Carrier scans are reliable for pickup and delivery; supplier ship notices are usually right on quantity but early on dates; spreadsheets are the least reliable.
- Q: What does "at risk" mean? | A: In this exercise, a production order is at risk if projected inventory of any of its parts at its plant goes below zero on or before its start date.
- Q: Do planners edit data? | A: They can override an arrival estimate with a note, and that override must be visible as theirs.

**Hints.**
1. Land every feed raw and unchanged, then standardise; you will reprocess when mappings change.
2. Keep the cross-reference from supplier part to your part as data with a confidence and an owner, not as code.
3. Precedence is per field, not per source, and a conflict is itself a record the planner can see.

**Follow-ups.**
1. A supplier's ship notice says 5,000 units shipped; the carrier's pickup scan shows 500. What does the planner's screen show, and which number feeds the projection?
2. How do you resolve a supplier part number you have never seen, and what does the projection do with it until it is resolved?
3. A disruption is logged: a supplier's plant is closed for two weeks. Which shipments and production orders does it touch, and how?
4. A part match made last month turns out to be wrong. What is recomputed, and how do you tell the planners who acted on it?
5. How would you measure how often each source's arrival estimate is right, and use that in the projection?

**Follow-up rules.**
- when: master data, mdm, golden record → ask: Who decides the part master when two suppliers' descriptions of one part disagree, and how is a wrong merge undone?
- when: fuzzy match, similarity, edit distance → ask: A fuzzy match links two parts that differ only by a revision letter. What does that do to the at-risk list, and what stops it?
- when: latest wins, most recent, overwrite → ask: The most recent value often comes from the least reliable source. Is latest still the rule?
- when: real-time, streaming, kafka → ask: Most of these feeds arrive daily or weekly. What does streaming buy you, and where would you use it?
- when: confidence, probability, likelihood → ask: How does a planner read a 70% confidence on an arrival date, and what do they do differently because of it?

**Production Reality Check.**
- A large supplier changes its part numbering in one weekly file; 40% of its open order lines no longer match a part, and the at-risk list for the next {{horizon}} days shrinks sharply, which looks like good news.
- A supplier's ship notice says 5,000 units shipped on Monday; the carrier shows a pickup of 500. The planner's screen shows 5,000 in transit for three days.
- A weekly spreadsheet reports cases instead of units; projected inventory for 60 parts jumps about 24-fold and their production orders drop off the at-risk list.
- One of the {{suppliers}} suppliers' feeds stops without warning. Nothing alerts for 9 days, because the last file's arrival estimates are still in the future.

**Evaluation Criteria.** Raw landing of every feed with receipt records and replay; a cross-reference for parts and suppliers held as data with confidence, owner and reversibility; unit normalisation with checks against plausible ranges; per-field source precedence with conflicts recorded and shown; disruptions linked to shipments and orders through explicit rules; a projection per part, plant and day with the first stock-out and the orders at risk; freshness measured per feed with a stale state that cannot read as "no change"; lineage from every number back to its sources; adapts to each incident with diagnosis, recovery and prevention.

## PLT-L4-04: Models in operational workflows: versioned scoring in batch and live, outputs as properties, drift, rollback

| | |
|---|---|
| **Template ID** | PLT-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Model deployment / batch and live scoring, model registry, outputs as object properties, drift, rollback |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ml-platform-engineer, ai-infra-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "assets": {"2": ["400,000", "2 million"], "3": ["20 million", "60 million"]},
  "live_events": {"2": ["500", "2,000"], "3": ["20,000", "50,000"]},
  "models": [8, 25, 60],
  "rollback_minutes": [5, 15, 30]
}
```

**Business Scenario.** A utility manages about {{assets}} assets (transformers, pumps, valves, pipe segments) as objects on an enterprise data platform, linked to their sensor readings, inspections and work orders. Data scientists have built {{models}} models that score assets, for example the risk of failure in the next 90 days or the expected remaining life. Scores are written onto the asset objects as properties, and maintenance planners use them, together with their own judgement, to choose which assets to inspect. All assets are scored every night; an asset is also re-scored live when a sensor reading or a work order changes it, up to {{live_events}} times per second. Whether an asset actually failed is known only weeks or months later, from inspections and work orders.

**Problem Statement.** Design the platform that runs these models in the planners' workflow. Cover a registry of models and versions (code, training data snapshot, features, owner, approval); feature definitions shared by training, batch and live scoring, and correct as of the scoring time; the nightly batch scoring and the live scoring service; how scores are written as properties so each one says which model version produced it, when and from which inputs; shadow and staged releases; monitoring of input drift, output drift and, later, outcomes; rollback to the previous version within {{rollback_minutes}} minutes, including the scores already written; and a record of which score a planner saw when they decided.

**Constraints.** A live re-score is written within 30 seconds of the change that caused it. The nightly batch finishes before planners start at 06:00. A rollback restores the previous version's scores on every affected asset within {{rollback_minutes}} minutes, not only for future scoring. Every decision a planner records keeps the score, model version and time it was based on. The model informs; planners decide.

**Assumptions.** All volumes, counts and timings are hypothetical. Models are trained elsewhere and delivered as versioned artefacts with a declared list of features. Asset objects, sensor readings and work orders are already on the platform.

**Clarifications.**
- Q: Do all models score all assets? | A: No; each model applies to some asset types. A few assets are scored by several models.
- Q: Can a planner see an older score? | A: Yes; they can see the score history and which version produced each value.
- Q: Who approves a new version? | A: The model's owner and a reviewer from the planning team, based on an offline evaluation and a shadow period.
- Q: Is retraining automatic? | A: Not today. Say whether you would make it so.

**Hints.**
1. Keep the score history in its own store, keyed by asset, model and version; the property on the object is a pointer to the current one. Rollback then becomes a pointer change.
2. Training/serving skew usually comes from two implementations of one feature. Make one definition and two executions of it.
3. Outcomes arrive weeks later; drift on inputs and outputs is your early signal, and outcomes are the slow, true one.

**Follow-ups.**
1. Walk through a live re-score: a vibration reading changes a pump. What runs, where do its features come from, and what is written where?
2. How do you release a new version: offline evaluation, shadow, then what? What number decides it is ready?
3. The new version is rolled back at 07:00 after planners have built their day from its scores. What do you restore, and what do you tell them?
4. Input drift fires for one region. How do you tell a real change in the assets from a broken feed?
5. How would you measure, months later, whether the model helped planners prevent failures, when its scores changed which assets were inspected?

**Follow-up rules.**
- when: feature store → ask: The live path reads a feature from the online store that the nightly batch computed from yesterday's data. How stale can it be, and is that the same value the model was trained on?
- when: retrain, retraining, automatic retraining → ask: Drift fires and the pipeline retrains on last week's data, which includes a broken feed. What stops a bad model being trained and released?
- when: a/b test, canary, shadow → ask: Planners act on the scores, so the two versions change which assets get inspected. How do you compare them fairly?
- when: psi, kl divergence, distribution shift, population stability → ask: What threshold pages someone, and what does that person do in the first ten minutes?
- when: overwrite, update in place → ask: You overwrote last night's scores with the new version's. How do you roll back within {{rollback_minutes}} minutes now?

**Production Reality Check.**
- A new model version goes live at 02:00; by 06:00 the share of assets scored high risk has gone from 3% to 31%, and planners' inspection lists for the day are already built from it.
- A sensor firmware update reports temperature in Fahrenheit instead of Celsius for one region. The input drift alarm fires, but the nightly scores for that region have already been written.
- The live score and the nightly score for the same asset disagree widely, because the live path computes "work orders in the last 90 days" from a cache that misses the most recent day.
- The model is rolled back within {{rollback_minutes}} minutes, but scores written overnight for most of the {{assets}} assets still show the bad version's values.

**Evaluation Criteria.** A registry tying each version to code, training snapshot, features and approval; one feature definition executed for training, batch and live with point-in-time correctness; batch and live scoring with idempotent writes; score history kept per asset, model and version, with the object property pointing at the current score so rollback restores values; staged release (offline evaluation, shadow, limited rollout) with stated criteria; input, output and outcome monitoring with input validation that can stop a bad batch; decision records with the score shown; honest evaluation of impact when the model changes the outcomes it is judged on; adapts to each incident with diagnosis, recovery and prevention.

## PLT-L4-05: Hospital network capacity picture: beds, staffing and transfers hourly, patient data minimised to counts

| | |
|---|---|
| **Template ID** | PLT-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Operational analytics / event-derived occupancy, data minimisation at the source, transfers, freshness |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "sites": {"2": [6, 12], "3": [30, 60]},
  "beds": {"2": ["2,500", "5,000"], "3": ["12,000", "25,000"]},
  "systems": [2, 3, 5],
  "min_count": [5, 10, 11]
}
```

**Business Scenario.** A hospital network of {{sites}} hospitals with about {{beds}} beds wants one capacity picture, updated every hour, for its operations centre. For each hospital and unit type (intensive care, medical-surgical, paediatric, maternity) it wants staffed beds, occupied beds, beds blocked for cleaning, maintenance or isolation, expected discharges today, patients waiting in emergency departments for a bed, nurses on shift against this exercise's staffing rule, and transfer requests between hospitals with their status. The hospitals run {{systems}} different admission, discharge and transfer systems, which emit event messages (admit, transfer, discharge, cancelled admission, bed status change) carrying patient identifiers. The operations centre needs none of those identifiers: it needs counts.

**Problem Statement.** Design the capacity picture. Cover ingestion from the {{systems}} source systems; how occupancy per unit per hour is derived from events (including corrections and cancelled admissions) and reconciled with each hospital's midnight census; where patient identifiers are dropped or pseudonymised so that they never reach the platform's stores, logs or the picture, and how an admission is still matched to its discharge; staffing from rosters; transfer requests tracked by a request id with no patient details; freshness per hospital, shown on screen; and who sees what (unit managers their units, the operations centre every site, and any report shared outside operations suppressed below {{min_count}}, under this exercise's rule).

**Constraints.** The picture is at most one hour old, and each hospital's last successful update time is visible. No patient name, identifier, date of birth or free-text clinical note is stored outside the hospitals' own systems or the restricted ingestion step, and nothing in logs, errors or dead-letter queues may hold them. Computed occupancy must match each hospital's midnight census, or the difference must be reported per unit. When a feed is down, the picture says so and falls back to the last good value or a manual count.

**Assumptions.** All numbers are hypothetical, and the staffing rule and the suppression threshold are this exercise's rules. Each hospital can run a small integration service on its own network. Clinical decisions about any patient, including whether to transfer, are made by clinicians in their own systems; this picture only counts.

**Clarifications.**
- Q: Do we need individual patients at all? | A: No. You need to match each discharge or transfer to an earlier admission so beds are freed correctly; say how you do that without identifiers leaving the hospital.
- Q: Is hourly enough for transfers? | A: For the picture, yes. Transfer requests are created and updated in their own workflow; the picture shows their counts and status.
- Q: Do bed status messages arrive in order? | A: Usually, but after an outage a source system replays its backlog, and some systems resend corrected messages.
- Q: Who enters staffing? | A: Rosters come from a scheduling system per hospital; late changes are entered by unit managers.
- Q: Are counts by unit sensitive? | A: Inside the operations centre they are needed exactly. Outside it, under this exercise's rule, any count below {{min_count}} is suppressed.

**Hints.**
1. Reduce events to counts as close to the source as you can. If a key is needed to pair admissions with discharges, keep it inside the hospital and pass on only a salted, per-hospital pseudonym, or nothing at all.
2. Treat bed state as a state machine per bed and occupancy as a count of beds in a state; that tolerates replays better than adding and subtracting.
3. A daily census from each hospital is your ground truth; drift against it is a defect to find, not a number to overwrite.

**Follow-ups.**
1. Walk through one admission and its discharge two days later. Which messages arrive, what does the platform store, and what never leaves the hospital?
2. A hospital's feed is down for 5 hours and then replays 900 messages out of order. How does your occupancy for those hours end up right?
3. How do you show expected discharges and emergency patients waiting for a bed without any patient-level data in the picture?
4. A regional health authority asks for a daily feed of your capacity counts. What do you change before anything leaves the network?
5. How would you prove to the network's privacy officer that no identifier has reached the platform, including in logs and error queues?

**Follow-up rules.**
- when: hl7, fhir, adt → ask: Those messages carry names and identifiers in many fields. Where exactly are they removed, and what happens to a message that fails to parse?
- when: patient id, mrn, medical record number, patient identifier → ask: You need to pair a discharge with its admission. Where does that key live, who can reverse it, and how long is it kept?
- when: real-time, streaming, kafka → ask: The requirement is hourly. What does streaming buy you, and what does it cost a hospital's integration team?
- when: census, snapshot, reconcile → ask: Computed occupancy and the midnight census disagree by 12 beds at one site. Which do you show, and how do you find the cause?
- when: anonymise, anonymize, de-identify, anonymous → ask: Is a count of 2 in a small hospital's maternity unit identifying? Who sees it, and why is that acceptable?

**Production Reality Check.**
- One of the {{sites}} hospitals' feeds is down for 5 hours overnight. When it returns it replays 900 messages out of order, and that hospital's picture briefly shows 40 more patients than it has staffed beds.
- One source system's adapter does not handle cancelled admissions; computed occupancy drifts up by a few beds a day and is 60 beds above the midnight census after three weeks.
- A debug setting in the ingestion step was left on and has written raw messages, with names and dates of birth, to the shared log store for two weeks.
- A report shared with a regional body each morning shows a count of 3 for one small unit, below this exercise's threshold of {{min_count}}, because the suppression ran before a late correction was added.

**Evaluation Criteria.** Minimisation by design: identifiers removed or pseudonymised (salted per hospital, key held at the hospital) in a restricted step close to the source, with nothing patient-level stored, logged or dead-lettered downstream; occupancy derived from a per-bed state machine that tolerates replays and corrections; reconciliation with the midnight census reported per unit; staffing and transfers modelled without patient details; per-hospital freshness shown and fallbacks for outages; access by role, with small-count suppression applied as the last step for anything shared outside operations; tests and scans that prove no identifiers leak; adapts to each incident with diagnosis, recovery and prevention.
