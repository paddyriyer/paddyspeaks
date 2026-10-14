# Salesforce · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a multi-tenant cloud
CRM: customer orgs, records, sharing, automation, API allocations, sandboxes and
reports. Every workload, number, schema and incident is hypothetical, and every
product rule used here (sharing, role hierarchy, allocations, sandbox refreshes,
merges) is this exercise's rule; check current docs for the product's own behaviour.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## SFC-L3-01: Who could see this record on that date — the sharing model as data

| | |
|---|---|
| **Template ID** | SFC-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / temporal access policy, role and group closure, derived access with reasons |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "org_records": {"1": ["5 million"], "2": ["50 million", "120 million"], "3": ["400 million", "1 billion"]},
  "role_depth": [6, 10, 15],
  "sharing_rules": [40, 300],
  "audit_years": [1, 3, 7]
}
```

**Business Scenario.** In a multi-tenant CRM each customer org controls who can see its records. In this exercise's rules (check current docs for the product's own): an organisation-wide default per object (Private, Public Read Only or Public Read/Write) sets the baseline; a record's owner has full access; users whose role sits above the owner's role in the org's role hierarchy get the owner's access, for objects where hierarchy access is switched on; sharing rules grant Read Only or Read/Write to a group or a role, either for records owned by members of another group or role (owner-based) or for records whose fields match criteria (criteria-based); an owner can share one record manually with a user or group; and record teams give their members an access level on one record. Public groups can contain users, roles, "roles and subordinates" and other groups. Every mechanism only widens access beyond the default. One large org here has {{org_records}} records, a role hierarchy {{role_depth}} levels deep and {{sharing_rules}} sharing rules. Its compliance team investigates data-access questions — "who could read this opportunity on 3 March, and why?" — and must answer for any date in the last {{audit_years}} years.

**Problem Statement.** Design the data model that answers, for one org, "who could see record R at time T, at which level, and through which grants" and "which records of an object could user U see at time T". Cover: the entities (users and their role over time, the role tree, groups and nested membership, object defaults, sharing rules and their versions, manual shares, team memberships, record ownership history, and the field history criteria-based rules need), all with valid time; whether effective access is materialised as rows of (record, principal, level, reason) or computed at query time, and how materialised rows are kept right when the hierarchy, a group or a rule changes; how a point-in-time question is answered; and what is kept for {{audit_years}} years.

**Constraints.** An answer lists every grant path (default, ownership, hierarchy, a rule by id and version, a manual share, a team), not only yes or no. The model must never show a grant that did not exist at that time, and never omit one that did. Moving one user to another role must not rewrite the access rows of the whole org. Record field values enter the access model only for the fields a criteria-based rule references, and only as history of those fields.

**Assumptions.** Record counts, depths, rule counts and retention are hypothetical, and so are the access rules above. Times are UTC. Users can be deactivated; a deactivated user keeps their history. Implicit access between related records (for example, a child record granting read access to its parent) is out of scope unless a follow-up brings it in.

**Clarifications.**
- Q: Does the role hierarchy apply to every object? | A: In this exercise a flag per object says whether access is granted through the hierarchy. It is on for accounts and opportunities and off for one custom object.
- Q: Can a sharing rule reduce access below the default? | A: No. The default is the floor; everything else only widens it.
- Q: If a group contains "role and subordinates", does its membership change when the hierarchy changes? | A: Yes. Membership is resolved through the role tree in force at the time, so a reorg changes who is in the group without anyone editing it.
- Q: What happens to manual shares when a record changes owner? | A: In this exercise they are removed. Record that as an event with a time; do not just delete the rows.
- Q: Is "could see" read or edit? | A: Both. Report the highest level and every path that grants any level.

**Hints.**
1. Separate the policy (defaults, users' roles, the role tree, groups, rules, manual shares, teams, ownership — each with valid-from and valid-to) from derived effective access. The policy history is the source of truth; derived access is a cache you can rebuild for any time.
2. Access to a record at time T is a function of: its owner at T, the owner's role at T, the role tree at T, group membership at T, the rules in force at T and whether the record matched their criteria at T, and the manual shares and team memberships active at T.
3. A closure table (ancestor, descendant, depth) with valid time, for the role tree and for nested groups, turns hierarchy questions into joins.

**Follow-ups.**
1. Walk one opportunity through a day: its owner's role is moved under a different manager at 10:00; at 14:00 a criteria-based rule starts sharing Closed Won opportunities with a Finance group; at 16:00 the opportunity is closed won. Who could see it at 09:00, 12:00 and 17:00, and through which grants?
2. A role near the top of a {{role_depth}}-level tree moves to another branch. Which derived rows change, how many in the worst case with {{org_records}} records, and what does a query see while they are being rewritten?
3. How do you store the role tree and nested groups over time so that "every role above role X at time T" and "every member of group G at time T" are single queries?
4. A criteria-based rule references two fields. What history of those fields must you keep, for how long, and how do you avoid copying record contents into the access store?
5. Product wants, across all orgs, "how many orgs use criteria-based rules, and how deep are their role trees". What may that pipeline read, and what must it never read?

**Follow-up rules.**
- when: materialize, materialise, share table, precompute → ask: A reorg moves 3,000 users to new roles. How many derived rows change, how long does recalculation take, and what does an auditor see for times inside that window?
- when: recursive cte, recursive query, recursion → ask: The role tree changed twice on the day asked about. Which version of the tree does your recursion walk, and how do you make it the one in force at time T?
- when: current state, latest, snapshot → ask: The auditor asks about a date eight months ago, before a sharing rule was deleted. Where does your model still know that the rule existed and whom it granted?
- when: boolean, can_view, has_access → ask: Compliance needs to know why the user could see the record, not only that they could. Which grant paths do you keep, and at which grain?
- when: closure table, closure, ancestor → ask: A subtree of 200 roles moves under a new parent. How many closure rows close and open, and how do you keep the old ones for point-in-time questions?

**Production Reality Check.**
- A reorg moved a top-level role in an org with {{org_records}} records. Recalculating derived access ran for hours; during that window the derived rows said some managers could not see their own team's records, and an access report generated inside the window was sent to the customer.
- An administrator deleted a sharing rule and recreated it with the same name the next day. The access answer for the day in between showed grants through "the same" rule, because derived grants were keyed by rule name instead of rule id and version.
- An investigation asks who could read a record {{audit_years}} years ago, but group membership history had been kept for only 90 days, so every grant through a group from that time is unknown.

**Evaluation Criteria.** Policy kept as temporal source data separate from derived access; valid-time role tree and nested groups (closure or equivalent) so membership is resolved as of T; ownership and criteria-field history kept minimally; grants carry a reason (rule id and version, share, team, hierarchy); a clear choice between materialised and computed access with a recalculation strategy that is incremental and whose in-progress state is visible; point-in-time queries defined; retention matched to {{audit_years}} years; cross-org analytics restricted to metadata; each incident contained, corrected and guarded.

## SFC-L3-02: Custom objects and fields per org — schema metadata as data, analytics across different schemas

| | |
|---|---|
| **Template ID** | SFC-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / per-tenant schema metadata, stable field identity, schema evolution, metadata-only analytics |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "orgs": {"1": ["5,000"], "2": ["50,000"], "3": ["150,000", "400,000"]},
  "custom_fields_per_org": ["about 300", "about 2,000"],
  "schema_changes_per_day": ["40,000", "250,000"],
  "field_limit": [500, 800]
}
```

**Business Scenario.** A multi-tenant CRM lets each org define its own custom objects and custom fields — text, number, currency, date, picklist (with its list of values), lookup to another object, and formula. Administrators rename labels, convert some field types, add and deactivate picklist values, and delete fields; in this exercise's rule a deleted field can be restored for 15 days, after which it and its data are purged, and an object can have at most {{field_limit}} custom fields. About {{orgs}} orgs, averaging {{custom_fields_per_org}} custom fields each, make {{schema_changes_per_day}} schema changes a day. Two consumers depend on this metadata. Each customer can export its own records into its own analytical tables, which must follow its schema as it changes. The platform's product teams analyse metadata across orgs (field counts against the limit, field types in use, how often fields are deleted soon after creation) and must never read record contents; in this scenario labels, descriptions and picklist values are also customer data.

**Problem Statement.** Design three things. (a) The metadata store: objects, fields, picklist values and relationships, each with a stable identity and a versioned history, so "what did org X's schema look like at time T" is a query. (b) How one org's records land in its own analytical tables when its schema changes (add, rename, type conversion, delete, restore, purge), and how one pipeline serves thousands of different schemas: per-org physical tables, a wide table with typed generic slots, attribute-value rows, or a semi-structured column — choose one and defend it. (c) Cross-org metadata analytics that answer "share of orgs with an object within 10% of the {{field_limit}} field limit", "field types in use" and "fields deleted within 30 days of creation", using no labels, values or record contents.

**Constraints.** A field keeps one stable id through renames; its API name is unique within its object at a point in time and can be reused after deletion. A purged field's data is removed from every copy, including the customer's export tables, within an agreed time that you state. Cross-org analytics read ids, types, counts and timestamps only. Schema history is immutable.

**Assumptions.** Org counts, field counts, change rates, the field limit and the 15-day restore window are hypothetical; so are the allowed type conversions (text to picklist, number to currency, picklist to text). Formula values are computed when read; an export may store them, labelled as computed at export time.

**Clarifications.**
- Q: Is the API name a good key? | A: No. It is unique only at a point in time: a deleted field's API name can be reused by a new field of another type.
- Q: Do customers see the cross-org analytics? | A: No. They are for the platform's product teams. A customer sees analytics about its own org.
- Q: What does restoring a deleted field bring back? | A: The field's definition and its data as they were at deletion, in this exercise's rule.
- Q: Why are labels treated as customer data? | A: Labels and picklist values can contain client names, project code names or health terms. Treat them like record contents.
- Q: How often does a typical org change its schema? | A: Most rarely; a few large orgs deploy hundreds of changes at once. Plan for bursts.

**Hints.**
1. Give every object, field and picklist value an immutable id; API names, labels, types and the deleted state are versioned attributes of that id.
2. Store schema history as valid-time versions per field (plus the change events that produced them), so the schema at time T is a filter rather than a replay of logs.
3. For the export, keep a per-org mapping from field id to warehouse column; a rename changes the mapping's label, never the data's location.

**Follow-ups.**
1. An administrator renames the field with API name `Region__c` to `Territory__c`, then creates a new `Region__c` as a picklist. Show the metadata rows and the customer's analytical table afterwards.
2. A field is converted from text to picklist. What happens to its history in the export, and to a saved report that grouped by the old free-text values?
3. A field is deleted, restored 10 days later, deleted again and purged. Walk the metadata store, the export and the cross-org analytics through each step.
4. Compute "share of orgs with an object within 10% of the {{field_limit}} limit" from your model: which tables, which grain, and how does the result avoid identifying any org?
5. With {{orgs}} orgs and {{schema_changes_per_day}} changes a day, how do you avoid reprocessing a whole org on each change, and how do you prove that a purge reached every copy?

**Follow-up rules.**
- when: eav, entity-attribute-value, key-value → ask: A customer's analyst wants 40 custom fields as columns over 30 million records. What does pivoting your attribute-value rows cost, and where do you materialise the wide shape?
- when: json, jsonb, variant, semi-structured → ask: A field converts from text to number. What happens to the values already stored as text, and to the queries that cast them?
- when: api name, api_name → ask: A deleted field's API name is reused by a new field of a different type. How does your pipeline tell the two apart, in metadata and in the export?
- when: label, picklist value → ask: Product asks for the 100 most common custom field labels across all orgs. What do you answer, and what could a label reveal about a customer?
- when: alter table, table per org, per-org table → ask: {{orgs}} orgs, each with its own tables, and {{schema_changes_per_day}} changes a day: what does migration cost, and how do you convert the type of a column with years of history?

**Production Reality Check.**
- A large org's deployment deleted and re-created 300 fields with the same API names. The export pipeline, keyed on API names, attached years of history to the new fields, and the customer's dashboards changed overnight.
- A purge completed in the primary store, but copies of the field's data remained in the customer's export tables and in a cross-org staging table that had captured picklist values "to compute type statistics".
- A product dashboard of orgs near the {{field_limit}} field limit listed org ids with their largest custom objects' labels, and it was shared with a partner team that was not allowed to see customer data.

**Evaluation Criteria.** Immutable ids for objects, fields and picklist values with versioned names, labels and types; schema-as-of-T as a query; a defended choice of physical layout for exports with its cost for wide reports and type changes; a field-id-to-column mapping so renames and API-name reuse are safe; delete, restore and purge as events with purge propagated and verified across copies; cross-org analytics on ids, types and counts only, with labels and values treated as customer data and small groups suppressed; incremental processing for bursts; each incident contained, corrected and guarded.

## SFC-L3-03: Sandboxes and deployments — what changed in an org, when, by whom, and how to undo it

| | |
|---|---|
| **Template ID** | SFC-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / environment state as component-version intervals, deployments, drift, reversing deployments |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "orgs": {"1": ["3,000"], "2": ["30,000"], "3": ["100,000", "250,000"]},
  "sandboxes_per_org": [3, 12, 40],
  "deployments_per_day": ["20,000", "120,000"],
  "refresh_days": [5, 29]
}
```

**Business Scenario.** Each production org of a multi-tenant CRM can have sandboxes: copies of its metadata (and, for some sandbox types, data) where teams build and test changes. A change is built in a developer sandbox, promoted to an integration sandbox, then deployed to production. A deployment carries a set of metadata components (objects, fields, automation flows, code classes, page layouts, permission sets), can first be validated (checks and tests run, nothing changes), and in this exercise's rule is all-or-nothing. Administrators also change production directly through setup screens, which a setup audit trail records. Refreshing a sandbox replaces it with a fresh copy of production and discards the work in it; in this exercise a sandbox can be refreshed at most once every {{refresh_days}} days. There are {{orgs}} production orgs with about {{sandboxes_per_org}} sandboxes each, and {{deployments_per_day}} deployments a day across them. Customers want a change history per org; the platform wants deployment health analytics (success rates, test time, failures by component type) without reading customer code or record data.

**Problem Statement.** Design the data model: environments (production orgs and sandboxes with their source, type, creation and refresh times); metadata components with a stable identity and versions identified by a content hash; the state of each environment over time (which version of each component was in force when); deployments (source, target, components and versions, validation runs, test results, status, who) and destructive changes; direct changes from the audit trail; and drift (production components that differ from what the last deployment put there). Answer: "what changed in production between Tuesday 09:00 and Thursday 18:00, by whom and how", "which deployment introduced this version of this flow", "which components is sandbox S behind production on", and "roll back deployment X" — and define rollback when nothing can be undone in place.

**Constraints.** Deployments are all-or-nothing. History is immutable: a refresh, a rollback or a failed deployment adds records, it never edits old ones. Component content is identified by hash; the platform's analytics see component types, counts, durations and outcomes, never the content of customer code, formulas or records. A sandbox's history before a refresh stays queryable for at least 90 days.

**Assumptions.** Counts, rates and the refresh interval are hypothetical, as are the deployment rules above. The audit trail records who, when, the kind of change and the component, but not always the full before and after content. Times are UTC.

**Clarifications.**
- Q: Can a deployment partly succeed? | A: Not in this exercise. If one component or a required test fails, nothing changes in the target.
- Q: Is a validation a deployment? | A: It runs the same checks and tests but changes nothing. A later quick deploy can reuse a recent successful validation, in this exercise's rule.
- Q: Does a deployment delete components? | A: Only components it lists as destructive changes.
- Q: How do we see direct changes in production? | A: Through the setup audit trail: who, when, what kind of change and which component; the new version's hash comes from a metadata read after the change.
- Q: What happens to a sandbox's history on refresh? | A: Its content is replaced by a copy of production. What history your model keeps is your decision.

**Hints.**
1. Model environment state as intervals: (environment, component, version hash, valid_from, valid_to, change kind deployment|direct|refresh|creation, change id).
2. A rollback is a new deployment of the previous versions plus destructive changes for components the original added; record which deployment it reverses.
3. Drift is a production interval opened by a direct change after the last deployment of that component; a deployment that would overwrite it can be detected before it runs.

**Follow-ups.**
1. Write the query shape for "what changed in production between two times": which table, which predicates on valid_from and valid_to, and how direct changes and deployments are labelled.
2. Deployment X added a field and changed a flow. Roll it back: which components and versions go into the reversing deployment, and what happens to values already written into the new field?
3. A developer sandbox was refreshed while a change was in progress. What does your model show about the work lost, and how would you warn before the refresh?
4. An administrator hotfixed a validation rule in production; a week later a deployment from the integration sandbox silently reverted it. Show how your model detects this before the deployment runs.
5. Deployment health across {{orgs}} orgs: define success rate and test duration per component type, and give the grain, partitioning and retention at {{deployments_per_day}} deployments a day.

**Follow-up rules.**
- when: git, version control, repository → ask: Production also changes through setup screens that never touch the repository. How does your model see those changes, and which version wins on the next deployment?
- when: rollback, roll back, revert → ask: The deployment you are reversing added a field that has since received 2 million values. What does your reversing deployment do to them, and who must approve it?
- when: nightly snapshot, daily snapshot, snapshot → ask: An administrator changes a flow at 10:00 and back at 15:00. Does your snapshot ever see the change, and can you say who made it?
- when: diff, compare → ask: Comparing a sandbox with production across 100,000 components: which keys and hashes make it cheap, and what about components that differ only in the order of their elements?
- when: refresh → ask: After a refresh, a pending deployment from that sandbox references component versions that no longer exist there. How does your model record that?

**Production Reality Check.**
- Automation refreshed an integration sandbox two days before a release. The work since the previous refresh is gone, the team cannot refresh again for {{refresh_days}} days, and it needs to know exactly which components and versions were lost.
- A deployment that failed its tests was recorded as deployed because the status was taken from the request, not the outcome. The org's change history now shows component versions that never reached production.
- A direct hotfix in production was overwritten by the next deployment. The customer asks which deployments, across their production org and its {{sandboxes_per_org}} sandboxes, have overwritten direct changes in the last quarter.

**Evaluation Criteria.** Environments with lineage and refresh events; components with stable ids and hashed versions; environment state as valid-time intervals tagged with the change that opened them; deployments with validations, test results and outcome-based status; direct changes from the audit trail in the same history; drift defined and detectable before a deployment; rollback as a reversing deployment with data consequences called out; immutable history including refreshes; health analytics on types, counts and durations only; each incident contained, corrected and guarded.

## SFC-L3-04: Accounts, contacts and hierarchies — relationships, merges and rollups that keep their history

| | |
|---|---|
| **Template ID** | SFC-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / temporal hierarchies, many-to-many relationships, merge lineage, as-reported versus restated rollups |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "accounts": {"1": ["2 million"], "2": ["20 million"], "3": ["80 million", "200 million"]},
  "multi_account_share": ["10%", "25%"],
  "merges_per_month": ["5,000", "50,000"],
  "max_depth": [5, 10]
}
```

**Business Scenario.** In one customer org of a CRM, accounts (companies) form hierarchies through a parent account field: subsidiaries and regional offices under a global parent, up to {{max_depth}} levels deep in this org. A contact (a person) has one primary account and, in this exercise's rule, can be related to other accounts as well, with a role and start and end dates — a consultant working with several clients, a board member — which is true of about {{multi_account_share}} of contacts. Duplicate accounts and contacts are merged: one record survives, the losing records' related records (contacts, opportunities, cases, activities) move to the survivor, and the losers are deleted. In this exercise a merge cannot be undone, and deleted records can be restored for 15 days. The org has about {{accounts}} accounts and runs {{merges_per_month}} merges a month. Sales leadership reports pipeline rolled up to each global parent; account managers need a contact's history across accounts; data stewards must explain why last quarter's number for a parent changed.

**Problem Statement.** Design the model in the org's analytical store, fed by the CRM's change events: accounts with their hierarchy over time; the account-contact relationships (primary and additional) over time; merges with lineage (loser, survivor, time, which related records moved); and the rollup of opportunity amounts to the global parent. Answer: "pipeline by global parent as of last quarter's end, as reported then", "the same, restated for merges and hierarchy changes since", "every account a contact has been related to, and when", and "which records did merge M move".

**Constraints.** The hierarchy has no cycles and is at most {{max_depth}} levels deep. A reference to a merged record resolves to its survivor, through chains of merges. Both "as reported" and "restated" views are available and labelled. Relationship history is never overwritten. Restated views change only through merges and dated hierarchy changes, never through silent edits.

**Assumptions.** Counts, shares, rates and the depth are hypothetical, as are the merge and restore rules above. Opportunity amounts are in one currency for this exercise. The change events carry record ids, the changed fields and a timestamp; a merge emits one event with the losing and surviving ids.

**Clarifications.**
- Q: Does the losing record's id survive anywhere in the CRM? | A: No. The merge event names the loser and the survivor; afterwards the loser's id no longer exists in the CRM. Your store must keep the mapping.
- Q: Can an account change parent? | A: Yes, after an acquisition or a reorganisation. The change has an effective time and data stewards sometimes backdate it.
- Q: Which global parent does an opportunity roll up to? | A: The global parent of the opportunity's account, in the hierarchy in force at the time the report is about (as reported) or today (restated).
- Q: Can a merge involve accounts in different hierarchies? | A: Yes. The survivor keeps its own parent unless the steward chooses otherwise.
- Q: Are additional relationships ended or deleted? | A: Both happen. Your model must tell "ended on a date" from "deleted by mistake and restored".

**Hints.**
1. Keep the hierarchy as a parent-link history (account, parent, valid_from, valid_to) and derive a closure or path per version; the global parent as of T is then a lookup.
2. A merge map (loser, survivor, merged_at), resolved transitively, lets facts keep their original account id and be re-pointed at query time.
3. "As reported" joins facts to the hierarchy and ids as they were at the report date; "restated" re-points facts through the merge map and today's hierarchy. Build both from the same history.

**Follow-ups.**
1. Account B (with three open opportunities) is merged into A, which sits under a different global parent. Show the merge map row and last quarter's pipeline for both parents, as reported and restated.
2. A is merged into B, and later B into C. How do facts that still carry A's id find C, and what prevents a cycle in the merge map?
3. A data steward backdates a parent change to the start of the quarter. Which reports change, which do not, and how is the change visible to someone reading them?
4. How do you store the hierarchy so that "all descendants of global parent P as of date D" is cheap at {{accounts}} accounts and depth up to {{max_depth}}?
5. A deleted contact relationship is restored within 15 days. What do your history rows look like, and does "every account a contact was related to" show the gap?

**Follow-up rules.**
- when: recursive cte, recursive, connect by → ask: The rollup runs the recursion over {{accounts}} accounts for every report. How do you stop on a cycle, and when would you precompute a closure table instead?
- when: closure table, closure → ask: An account with 5,000 descendants moves to a new parent. How many closure rows change, and how do you keep the old version for "as reported"?
- when: overwrite, re-point, update the account → ask: After you re-point the facts to the survivor, the steward asks what last quarter's report said before the merge. Where does that answer come from?
- when: soft delete, is_deleted, deleted flag → ask: A merged loser is deleted in the CRM. Is that the same kind of deletion as a mistaken delete that will be restored within 15 days? How does your model tell them apart?
- when: bridge table, junction, many-to-many → ask: What is the grain of your bridge, and how does it show a contact who left an account and came back a year later?

**Production Reality Check.**
- A bulk import created a cycle (A's parent is B and B's parent is A) in an org whose hierarchy is up to {{max_depth}} levels deep. The nightly rollup's recursion ran until the job timed out, and the pipeline dashboard kept showing yesterday's numbers labelled as today's.
- A data-quality project ran {{merges_per_month}} merges in one weekend. Last quarter's pipeline per global parent changed in the restated view, and sales leadership compared it with a board deck built on the as-reported numbers, with neither labelled.
- Opportunity facts that still carried a loser's account id were dropped by an inner join to the current accounts table, and revenue for merged accounts vanished from the dashboard.

**Evaluation Criteria.** Parent links with valid time and a derived closure or path per version; acyclicity and depth enforced at ingestion; a contact-account bridge with roles and dated intervals that distinguishes ending from deleting and restoring; a transitive merge map with lineage of moved records; facts keep their original keys; as-reported and restated rollups both defined, built from the same history and labelled; backdated changes visible; each incident contained, corrected and guarded.

## SFC-L3-05: API allocation use — org-days that crossed 80% and 100% of a licence-based allocation

| | |
|---|---|
| **Template ID** | SFC-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of joins to two histories, capped formulas, running totals per day, re-loaded feeds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | SFC-L3-05.mjs |

**Business Scenario.** A multi-tenant CRM gives each org a daily allocation of API requests that grows with its licences. In this exercise's rule (check current docs for the product's own rule, which may use a rolling 24 hours), the allocation is fixed for each UTC calendar day: `LEAST(base_requests + per_licence × licences, max_requests)` from the org's edition, plus the `extra_requests` of every add-on active that day. Requests are counted into hourly buckets in `api_usage` (counts only; nothing about a request's content). The platform's usage team warns an org's administrators when it reaches 80% and 100% of its allocation, and wants a daily report of the org-days that crossed those thresholds, and when.

**Problem Statement.** Write one PostgreSQL query that returns `org_id, usage_day, allocation, requests, pct_used, crossed_80_at, crossed_100_at`: one row per org and UTC day (the sample covers {{first_day}} to {{last_day}}) whose `requests`, the day's total, is at least 80% of that day's `allocation`, ordered by `usage_day, org_id`. The edition and the licence count used for a day are the ones in force at the start of the day (00:00 UTC): in each history, the latest row for the org with `effective_at` at or before that instant. An add-on is active on a day when `starts_on <= day <= ends_on`. `pct_used` is `ROUND(100.0 * requests / allocation, 1)`. `crossed_80_at` is the `hour_start` of the first bucket at which the day's running total reached 80% of the allocation; `crossed_100_at` is the same for 100%, or NULL if the day never reached it. {{feed_rule}}

**Constraints.** One SQL statement (CTEs allowed). Thresholds are inclusive: a day at exactly 80% has crossed. Compare integers (`requests * 100 >= allocation * 80`), not rounded percentages. The sample has {{orgs}} orgs and {{usage_rows}} usage rows; production has hundreds of thousands of orgs and years of hourly buckets.

**Assumptions.** Hypothetical editions, licence counts, add-ons and request counts; the formula is this exercise's rule, not a product's. Every org has an edition row and a licence row before the first day. Days are UTC calendar days and `hour_start` is always on the hour.

**Clarifications.**
- Q: Licences were added at 14:00. Does that raise the same day's allocation? | A: No. The allocation is fixed at 00:00 UTC; the change counts from the next day.
- Q: And a change effective at exactly 00:00? | A: It applies to that day: effective at or before the start of the day.
- Q: Does the cap apply to add-ons? | A: No. The cap limits the licence-based part; add-ons are added on top of it.
- Q: Should days below 80%, or days with no usage, appear? | A: No. Only org-days at or above 80%.
- Q: One bucket takes the day from 70% to 110%. What are the crossing times? | A: Both crossed_80_at and crossed_100_at are that bucket's hour_start.

**Hints.**
1. Compute the allocation per (org_id, day) first. A LATERAL subquery with ORDER BY effective_at DESC LIMIT 1 picks the row in force at 00:00; do it for editions and for licences.
2. The running total is `SUM(requests) OVER (PARTITION BY org_id, day ORDER BY hour_start)`; the first crossing is `MIN(hour_start) FILTER (WHERE running * 100 >= allocation * 80)`.
3. Sum the add-ons per org and day before combining them with anything hourly; joining add-ons to hourly rows multiplies the requests.

**Follow-ups.**
1. Suppose the allocation applied to a rolling 24 hours instead of a calendar day. Rewrite the crossing test over hourly buckets. Which allocation is "in force" for a window that spans a licence change?
2. Warnings must go out within minutes of crossing, not in a daily report. What state does a streaming job keep per org, and how do you prove it agrees with this query afterwards?
3. A late re-load lowers an hour's count after an 80% warning has already gone out. Is the warning retracted, and what does this report show?
4. An org's licences fell mid-month. Write the follow-on query that lists orgs whose last seven days of usage would have crossed 100% under the allocation in force today.

**Follow-up rules.**
- when: join allocation_addons, join addons → ask: An org has two add-ons active on the same day. How many rows does each hourly bucket produce after your join, and what happens to SUM(requests)?
- when: max(effective_at), current licences, latest licence → ask: For a day three days ago, which licence count does your query use: the one in force at 00:00 that day, or today's?
- when: round, rounded → ask: You compare a rounded percentage with 80. Which day can that misclassify, and why is requests * 100 >= allocation * 80 exact?
- when: partition by org_id → ask: Does your running total restart at midnight, or does yesterday's usage push today's crossing earlier? Show the PARTITION BY.
- when: loaded_at, distinct on → ask: An hour was loaded three times. Which load does your query keep, and why is adding the loads wrong?

**Production Reality Check.**
- An org added licences at 15:00 UTC and its integration reached 100% at 19:00. Support had told the customer the higher allocation applied immediately; this report, which applies licence changes from the next day, flagged the org, and the customer escalated over a warning they believed was wrong.
- A version of this report that summed every load of a re-loaded hour counted late usage twice and sent 100% warnings to orgs that were nowhere near their allocation.

**Evaluation Criteria.** Allocation per org-day from both histories as of 00:00 (inclusive), the cap on the licence part only, add-ons summed per day with inclusive dates; a running total partitioned by org and day; inclusive integer threshold comparisons; NULL for an uncrossed 100%; at the hardest level, the latest load per hour; deterministic ordering; can explain rolling windows, streaming warnings and late corrections.
