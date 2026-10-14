# Cloudflare · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a global network
that sits in front of customers' websites and applications: zones and DNS records,
WAF rules, cache rules, and edge compute scripts with their storage bindings. Every
workload, number, schema and incident is hypothetical, product rules are this
exercise's rules (check current docs), and nothing here describes how the company's
own network or systems are operated. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CFX-L3-01: Zones and DNS records with history — who changed what, proxied or DNS-only, and the zone as of a date

| | |
|---|---|
| **Template ID** | CFX-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / configuration history, bitemporal as-of views, actor attribution |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "zones": {"1": ["500,000"], "2": ["5 million", "12 million"], "3": ["30 million", "60 million"]},
  "daily_changes": ["2 million", "15 million", "60 million"],
  "api_share": ["70%", "85%", "95%"],
  "history_years": [2, 5, 7]
}
```

**Business Scenario.** Customers manage about {{zones}} zones (a domain and its DNS records) on a global network. A zone holds records of several types (A, AAAA, CNAME, MX, TXT and others); in this exercise an address or CNAME record can be *proxied*, so resolvers receive the network's edge addresses and traffic flows through it, or *DNS-only*, so resolvers receive the record's own value. Records change about {{daily_changes}} times a day; {{api_share}} of changes come through the API (often from customers' automation, with an API token), the rest from the dashboard by a signed-in member of the account. Support engineers, customers and analytics teams all ask the same kinds of questions: who changed this record, what did the zone look like last Tuesday at 14:00, and how many zones moved a record from DNS-only to proxied this month. Changes must stay answerable for {{history_years}} years.

**Problem Statement.** Design the data model for zones, records and their history. Cover: the zone and record entities with their keys (a record's identity across edits); how each change is captured (create, update, delete, proxied toggle, bulk import) with the actor (member or token, and through which interface) and the reason or request id; how to answer "the zone as of an instant" and "every change to this record" efficiently; how a change that writes the same value is treated; and the facts that answer "zones switching records between proxied and DNS-only per month" and "changes per zone by interface".

**Constraints.** History is append-only; a deleted record stays answerable. The as-of view of a zone must be exact to the second for the {{history_years}}-year window. Actor ids are stable even if the member leaves the account or the token is deleted. Record values can contain customer data (for example TXT verification strings), so analytics facts carry types, flags and counts, never values.

**Assumptions.** Zone counts, change rates, shares and retention are hypothetical. Proxied versus DNS-only behaviour, record types and TTL rules are this exercise's rules; check current docs. Several records can share a name and type (for example several A records for one name).

**Clarifications.**
- Q: If two records share a name and type, how do I tell them apart? | A: Each record has an id assigned at creation; an update keeps the id, a delete-and-recreate gets a new one.
- Q: Does a bulk import replace the whole zone? | A: It can. In this exercise an import either adds records or replaces all records of the zone, in one request.
- Q: Do we need to know who changed a record if they used an API token? | A: Yes: the token id, the account member who created it, and the interface (API or dashboard). The token's secret is never stored.
- Q: Is a change that writes the same value a change? | A: Your choice. Automation often re-applies the whole configuration; say how you record it and how it shows in history and in counts.
- Q: What does "as of" mean when a change is made in the dashboard but takes a moment to reach resolvers? | A: Use the time the change was committed. Say whether you would also record when it was first served, and why.

**Hints.**
1. Separate the current state (one row per live record) from the change log (one row per change, with before and after images and the actor). The current state is a projection of the log.
2. For "as of", store each record version with a validity interval `[valid_from, valid_to)`; then the zone at instant t is every version whose interval contains t.
3. The proxied flag is part of the record version; a toggle is a change like any other, and the monthly fact counts toggles from the log, not from snapshots.

**Follow-ups.**
1. Write the query, against your model, for the zone as of a given instant. Which index or partitioning makes it fast for a zone with 5,000 records and {{history_years}} years of edits?
2. A customer's automation re-applies every record each hour. How does your model keep history readable, and how do the change counts avoid counting no-ops?
3. A bulk import replaced every record of a zone. Show what the change log holds, and what the as-of view shows one second before, during and after.
4. The member who made a change has left the account and the token used is deleted. What does a support engineer see for "who changed this", and what must never be shown?
5. At {{daily_changes}} changes a day, what grain do you keep in the warehouse for {{history_years}} years, and how do you compute "zones that switched a record to proxied this month" without scanning every version?

**Follow-up rules.**
- when: updated_at, overwrite, update in place → ask: A record was changed three times on Tuesday. With the row updated in place, how do you answer what resolvers received at 14:00?
- when: snapshot, daily snapshot, nightly → ask: A record was proxied for forty minutes between two snapshots. Does your model show that it ever happened, and who did it?
- when: scd, type 2, valid_from → ask: Two edits to the same record arrive within the same second from two tokens. How do you order them, and what stops the intervals from overlapping?
- when: record value, content column, txt value → ask: Which of these columns may reach the analytics warehouse, and how do you answer "what changed" for support without copying values into facts?
- when: soft delete, deleted flag, is_deleted → ask: The record is deleted and a new one with the same name and type is created a minute later. Is that the same record in your model, and what does history show?

**Production Reality Check.**
- A customer's automation re-applies every record of its zones every 10 minutes. With about {{api_share}} of changes coming from the API, no-op writes swamp the change log, and the one real edit support needs is buried under thousands of identical rows.
- A replace-all import was implemented as delete-every-record followed by create-every-record in separate commits. For a few seconds the as-of view shows the zone with no address records, and a customer's audit report says their site had no DNS for that time.
- Months later a support engineer asks who disabled proxying on a customer's apex record. The token that made the change was deleted, and the change log stored only the token's display name, which another token now uses.

**Evaluation Criteria.** Stable record identity across edits; an append-only change log with before and after images, actor (member or token id) and interface; versioned records with validity intervals for exact as-of queries; no-op writes recorded distinctly and excluded from change counts; bulk imports as one atomic change set; record values kept out of analytics facts; facts at stated grains for proxied toggles and changes by interface; retention for the stated years; each incident contained, corrected and guarded.

## CFX-L3-02: WAF rules as data — rule sets, versions, per-zone overrides, and which version matched a request

| | |
|---|---|
| **Template ID** | CFX-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned configuration, override layering, event-to-version attribution |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "zones_with_rules": {"1": ["200,000"], "2": ["1 million", "3 million"], "3": ["8 million", "15 million"]},
  "rule_changes_per_day": ["40,000", "250,000", "1 million"],
  "managed_releases_per_month": [2, 4, 8],
  "event_retention_days": [30, 90]
}
```

**Business Scenario.** About {{zones_with_rules}} zones use web application firewall rules. In this exercise there are two kinds: *custom rules* that a customer writes (an expression over request fields such as path, method or country, and an action such as block, challenge, log or skip), and *managed rule sets* that the provider publishes about {{managed_releases_per_month}} times a month, which a customer deploys to a zone and adjusts with *overrides* (turn a rule off, change its action, or change the sensitivity of a group). Rules can be deployed at account level (applied to every zone of the account) or zone level, and run in a defined order. Customers change rules about {{rule_changes_per_day}} times a day. Every request that a rule acts on produces a security event, kept for {{event_retention_days}} days. Customers ask "why was this request blocked, by exactly which rule and version?" and "what did my rules look like when it happened?".

**Problem Statement.** Design the data model for rules and their history. Cover: custom rules and their versions (expression, action, order, enabled); managed rule sets, their releases and the rules each release contains; deployments of a rule set or rule list to an account or zone; overrides and how they layer (account, zone, rule set, group, rule); the *effective configuration* of a zone at an instant; and what a security event must carry so that it can be traced to the exact rule version and override that produced its action. Show the facts that answer "events by rule version and action per zone per day" and "how often an override changed a managed rule's action".

**Constraints.** A security event must be attributable to the rule version that matched, even after the rule is edited or deleted. Configuration history is append-only. A managed release is immutable once published. Expressions are customer configuration and can be shown to that customer, but security events carry ids and versions, not copies of expressions.

**Assumptions.** Counts, rates and retention are hypothetical. Rule kinds, actions, evaluation order and override layering are this exercise's rules; check current docs. A request can be matched by several rules; the event records the rule whose action was final, and in this exercise also lists rules that only logged.

**Clarifications.**
- Q: If a customer edits a rule, is it the same rule? | A: Yes, same rule id, new version. Deleting and recreating gives a new id.
- Q: Which override wins when the account and the zone both override the same managed rule? | A: In this exercise the most specific wins: rule over group over rule set, and zone over account. Say how your model makes that resolution reproducible.
- Q: Can a managed release rename or remove a rule? | A: It can remove one; rule ids are never reused. An override that points at a removed rule no longer applies, and the customer should be told.
- Q: Does the event store the expression that matched? | A: No. It stores ids and versions; the expression is looked up from the configuration history when someone asks.
- Q: What about requests that no rule acted on? | A: They produce no security event. Total request counts come from ordinary request analytics, not from this model.

**Hints.**
1. Model three layers apart: definitions (rules and their versions, managed releases), deployments (what is attached to which account or zone, in which order, from when), and overrides (versioned, with a scope). The effective configuration is derived from all three at an instant.
2. Give every effective configuration a version id (or hash) per zone, and stamp it on each security event; attribution then needs no time-range join.
3. Store overrides as rows keyed by scope and target, not as a JSON blob on the deployment, so "how often was this rule overridden" is a query.

**Follow-ups.**
1. Write how you compute the effective action of one managed rule in one zone at an instant, given account and zone overrides. Where does that run: at event time, at deploy time, or at query time?
2. A customer edits a rule and reverts it two minutes later. Which version do events in those two minutes carry, and how does the customer see the difference?
3. A managed release removes a rule that 30,000 zones had overridden. What does your model record, and how do you show affected customers?
4. Events are kept {{event_retention_days}} days but configuration forever. What does a customer get when they ask about a request older than that?
5. With {{rule_changes_per_day}} changes a day and {{zones_with_rules}} zones, how large is the effective-configuration history, and would you materialise it or derive it on demand?

**Follow-up rules.**
- when: json, jsonb, blob → ask: How would you answer "how many zones changed this managed rule's action to log last month" if overrides live inside one JSON document per deployment?
- when: deployed_at, time range, between → ask: An event is stamped one millisecond after a deployment. How do you know which configuration it saw, given clocks and propagation, and would a configuration version id on the event remove the guess?
- when: latest version, current rule, current version → ask: The rule was edited after the event. If you join the event to the current rule, what does the customer see as the reason it was blocked?
- when: expression, store the expression → ask: Where does the expression live, who may see it, and why not copy it onto each security event?
- when: priority, order, ordering → ask: Two rules both match; one blocks and one skips. How does your model show which ran first and why the final action was what it was?

**Production Reality Check.**
- A managed release, one of about {{managed_releases_per_month}} a month, removes a rule that many zones had turned off with an override. The same detection now lives under a new rule id, and those zones start blocking requests their owners had deliberately allowed.
- A customer asks why a checkout request was blocked 20 days ago. The event records the rule id but not its version, and the rule has been edited three times since; support shows the current expression, which would not have matched that request.
- Security events by rule version show a version that was live for only 90 seconds receiving events for 10 minutes: attribution was done by joining event time to deployment time, while the configuration reached some locations later than others.

**Evaluation Criteria.** Rules, versions and managed releases immutable once published; deployments with scope and order over time; overrides as versioned rows with explicit precedence; an effective configuration per zone with a version id stamped on each event; events carrying ids and versions, not expressions; facts at stated grains for events by rule version and override effects; retention reconciled between events and configuration; each incident contained, corrected and guarded.

## CFX-L3-03: Cache rules and their effect — order, TTL overrides, cache keys and which rule applied to each request

| | |
|---|---|
| **Template ID** | CFX-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / ordered rule evaluation, cache-key definitions, per-request rule attribution |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_requests": {"1": ["5 billion"], "2": ["50 billion", "120 billion"], "3": ["400 billion", "900 billion"]},
  "rule_limit": [10, 25, 50],
  "log_sample": ["1%", "10%"],
  "default_ttl": ["2 hours", "4 hours"]
}
```

**Business Scenario.** Customers control caching for their zones with an ordered list of up to {{rule_limit}} cache rules per zone. In this exercise a rule has a match expression (for example a hostname, a path prefix or a file extension) and settings: cache eligibility (eligible or bypass), an edge TTL override, a browser TTL override, and a cache key definition (which query-string parameters are included or ignored, and whether a header or cookie value is part of the key). Every matching rule applies in order and a later rule's setting wins where two rules set the same thing; without a rule, eligible content uses a default edge TTL of {{default_ttl}}. Zones serve about {{daily_requests}} requests a day; request analytics records each request's cache status (for example hit, miss, expired, revalidated, bypass) and, in this exercise, a {{log_sample}} sample of detailed request logs is available for analysis. Customers ask "which rule decided how this request was cached?" and "did my new rule raise my hit ratio, and did it serve anyone the wrong variant?".

**Problem Statement.** Design the data model for cache rules and their effect. Cover: rules and rule-list versions (order matters); the settings each rule can set and how the *effective settings* for a request are resolved from all matching rules; how the cache key definition is represented so that two requests can be shown to share or not share a cache entry; what each request record must carry to attribute its outcome (rule-list version, the rules that matched, the rule that set each effective setting, the cache key fingerprint); and the facts that answer "hit ratio per zone and rule per hour", "requests whose TTL came from an override" and "distinct cache keys per URL path".

**Constraints.** A rule-list version is immutable once deployed; reordering is a new version. Effective settings must be reproducible from the stored definitions for any past request. Query strings and headers can contain personal data: logs and facts carry a fingerprint of the cache key and the names of the parts used, never raw values. Sampled data must be weighted to estimate totals.

**Assumptions.** Volumes, limits, sampling rate and the default TTL are hypothetical. Rule evaluation order, override precedence, cache statuses and cache-key options are this exercise's rules; check current docs. Origin cache headers are out of scope unless you choose to model them.

**Clarifications.**
- Q: If two matching rules set edge TTL, which wins? | A: The later one in the list, in this exercise. A rule that sets only the cache key does not change the TTL set by an earlier rule.
- Q: Do I get every request's details? | A: Totals by cache status come for all requests from request analytics; detailed records come only for a {{log_sample}} sample, each with its sample weight.
- Q: Is "revalidated" a hit? | A: Say what you choose and why; it saves the origin a full response but still contacts it.
- Q: Can I record the raw query string? | A: No. Record which parameters were included in the key and a fingerprint of the resulting key.
- Q: Does a change to rules invalidate the cache? | A: Not in this exercise. A changed cache key definition makes new requests look up new keys, so old entries are simply no longer found.

**Hints.**
1. Keep definitions (rule-list versions, rules, settings) apart from outcomes (request records). The link is the rule-list version plus, per request, the matched rule ids.
2. Resolve effective settings per setting, not per rule: for each setting, the last matching rule that sets it. Store which rule set each one, because "why" questions are per setting.
3. Represent the cache key definition as data (included parameters, ignored parameters, header or cookie parts) so a fingerprint can be recomputed and compared.

**Follow-ups.**
1. Write the resolution of effective settings for one request given three matching rules, one setting eligibility and TTL, one setting only the cache key, and one setting bypass.
2. A customer moves a rule from position 9 to position 2. What does your model store, and how do you compare the hit ratio before and after fairly?
3. Detailed logs are a {{log_sample}} sample. How do you report hit ratio per rule for a rule that matched only a few thousand requests a day, and how sure can the customer be of it?
4. A cache key change starts ignoring a parameter used for asset versions. How would your facts reveal that one cache entry is now serving several different responses?
5. At {{daily_requests}} requests a day, which facts are built from complete counts and which from the sample, and how do you keep them consistent on one dashboard?

**Follow-up rules.**
- when: first match, first matching rule, stop at → ask: In this exercise every matching rule applies and later settings win. How does your resolution change, and which rule do you credit for the TTL?
- when: query string, raw url, full url → ask: The query string carries a session token for some customers. What does your request record keep, and how do you still show that two requests shared a cache key?
- when: hit ratio, hit rate → ask: Is your hit ratio per request or per byte, and are revalidated and bypassed requests in the denominator? Say which and why.
- when: sample, sampled, sampling → ask: How do you turn sampled rows into an estimate for a small rule, and what interval do you show the customer?
- when: current rules, latest rules → ask: A request from last week was served under an older rule order. How do you reproduce its effective settings if you only have the current list?

**Production Reality Check.**
- A customer adds a rule near the top that ignores all query-string parameters for static files. The hit ratio jumps, but stylesheets versioned with a query parameter now serve the old file until the {{default_ttl}} default edge TTL lapses, and the dashboard showed only the improvement.
- After a customer reorders their {{rule_limit}}-rule list through the API, the per-rule hit ratio report credits requests to rules by their current position, so last week's numbers move to different rules overnight.
- Per-rule hit ratios built from the {{log_sample}} sample disagree with the zone total from complete request counts by several points for low-traffic zones, and a customer opens a ticket saying the analytics are wrong.

**Evaluation Criteria.** Immutable rule-list versions with order; per-setting resolution with the rule that set each setting recorded; cache key definitions as data with a fingerprint, never raw values; request records carrying the rule-list version and matched rules; a stated hit-ratio definition (statuses in numerator and denominator); sampled facts weighted, with their uncertainty shown and reconciled to complete totals; each incident contained, corrected and guarded.

## CFX-L3-04: Edge compute resources — scripts, versions, deployments, routes and bindings to storage

| | |
|---|---|
| **Template ID** | CFX-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / deployable artefacts, traffic splits, routing precedence, resource bindings and secrets |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, analytics-engineer |

```params
{
  "scripts": {"1": ["200,000"], "2": ["1.5 million", "4 million"], "3": ["10 million", "25 million"]},
  "deploys_per_day": ["100,000", "600,000", "2 million"],
  "gradual_split": ["10%", "25%", "50%"],
  "max_bindings": [16, 32, 64]
}
```

**Business Scenario.** Customers run about {{scripts}} edge compute scripts. In this exercise a customer uploads a script, which creates an immutable *version* (code plus its configuration); a *deployment* says which versions serve traffic, either one version at 100% or a gradual split between two (for example the new version at {{gradual_split}}). A script receives requests through *routes* (URL patterns on the customer's zones, such as a hostname and path with a wildcard) or a custom domain, and through scheduled triggers. A version declares up to {{max_bindings}} *bindings*: named handles to key-value namespaces, coordinated-state objects (each object class addressed by id), object storage buckets, other scripts, plain environment variables and secrets. There are about {{deploys_per_day}} deployments a day. Customers, support and the platform's own analytics ask: which version served this request, which storage did it touch, and what changed between Tuesday and Wednesday?

**Problem Statement.** Design the data model for these resources and their history. Cover: scripts, versions and their bindings (each binding's name, type and target resource); deployments and splits over time; routes and custom domains, with how a request is matched to one script when patterns overlap; the storage resources themselves (namespaces, object classes, buckets) and their lifecycle; how a request or invocation record identifies the exact version and deployment that served it; and the facts that answer "requests and errors per version during a gradual deployment", "scripts bound to a given bucket on a date" and "routes that changed which script served a hostname".

**Constraints.** Versions are immutable. Secrets are stored only by name and binding type in anything outside the secret store: never their values, in configuration history, audit records or analytics. History is append-only and every change has an actor. Deleting a storage resource must not erase the record that scripts were bound to it.

**Assumptions.** Counts, rates, split percentages and binding limits are hypothetical. Version, deployment, route-precedence and binding semantics are this exercise's rules; check current docs. In this exercise the most specific matching route wins, and a hostname and path can be served by at most one script at a time.

**Clarifications.**
- Q: Is a configuration change without new code a new version? | A: Yes, in this exercise any change to code, bindings or variables creates a version.
- Q: During a split, how is a request assigned? | A: By a percentage of traffic; you do not control the assignment, but each invocation record carries the version that ran.
- Q: Can two scripts' routes overlap? | A: Patterns can overlap; for a given URL the most specific route wins. Your model must say which route won for a request.
- Q: What happens to a binding when its namespace or bucket is deleted? | A: The version still lists the binding; invocations using it fail. Your model should make that visible.
- Q: Who may see binding targets? | A: The account's members. Secret values are never visible to anyone after creation, including support.

**Hints.**
1. Treat version as the unit of configuration: a version row plus its binding rows (name, type, target resource id, or for a secret only its name). Deployments point at versions with percentages and a validity interval.
2. Give storage resources their own ids and lifecycle rows, so a binding references an id that survives a rename or deletion.
3. Routes are versioned too (pattern, zone, script, valid_from, valid_to). Matching a request to a route at an instant is a query over the routes valid then.

**Follow-ups.**
1. A gradual deployment sends {{gradual_split}} of traffic to a new version. Write how you report error rates per version during the rollout, and what makes the comparison fair.
2. The new version binds a different key-value namespace under the same binding name. How does your model show which namespace each request's reads came from?
3. A customer deletes a bucket that three scripts were bound to. What does your model show the next day, and how do you answer "which scripts used it last month"?
4. Two routes overlap on a hostname; a more specific route is added for one path. How do you show, for one URL, which script served it before and after?
5. At {{deploys_per_day}} deployments a day and up to {{max_bindings}} bindings per version, how do you store binding history without copying every binding for every deployment?

**Follow-up rules.**
- when: secret, secrets, api key → ask: Trace every place a secret's value could land in your design: upload, version record, audit log, analytics, support tools. Where is it stopped?
- when: latest version, current version → ask: During a {{gradual_split}} split two versions serve at once. Which version does your invocation record name, and how?
- when: binding name, by name → ask: Two versions use the same binding name for different namespaces. How does a query find the namespace a request actually used?
- when: route, routes, pattern → ask: Two patterns match the same URL. Which wins in your model, and can you reproduce that for a request last month?
- when: delete, deleted, drop → ask: The resource is deleted. What happens to the bindings that pointed at it, and to the history that says they existed?

**Production Reality Check.**
- During a gradual deployment at {{gradual_split}}, the new version's binding pointed the same binding name at a preview key-value namespace. For two hours that share of requests read and wrote preview data, and the customer asks exactly which requests and keys were affected.
- An audit export of version configuration for a customer included the values of plain environment variables, and one customer had stored an access key as a plain variable instead of a secret. The export reached a shared analytics table.
- A customer adds a route that is more specific than an existing one on the same hostname. Requests for one path silently move to another script, and the analytics, which attribute requests to scripts by hostname, show no change.

**Evaluation Criteria.** Immutable versions with binding rows; deployments with splits and validity intervals; versioned routes with explicit precedence; storage resources with stable ids and lifecycle; invocation records carrying script, version, deployment and route ids; secrets by name only, and plain variables treated as possibly sensitive; facts for per-version rollout comparison, binding history by resource and route changes; each incident contained, corrected and guarded.

## CFX-L3-05: Rule changes and blocking — blocked share in the hour before and after each WAF deployment

| | |
|---|---|
| **Template ID** | CFX-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / event windows around changes, half-open intervals, LAG and LEAD boundaries, scope fan-out |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | CFX-L3-05.mjs |

**Business Scenario.** Customers deploy WAF rules to their zones and want to see what each deployment did to their traffic. The model has three tables: `zones` (each zone belongs to an account), `waf_deployments` (one row per deployment of a rule version, with `status` `succeeded` or `failed`) and `requests` (one row per request logged for a zone, with the final `action`: `allow`, `block`, `challenge` or `log`, and the `rule_id` that produced it, NULL for plain allows). {{scope_rule}} The report compares the zone's blocked share in the hour before a deployment with the hour after it.

**Problem Statement.** Write one PostgreSQL query that returns `deployment_id, zone_id, requests_before, blocked_pct_before, requests_after, blocked_pct_after, change_pp`: one row per succeeded deployment and zone it applies to, ordered by `deployment_id, zone_id`. A failed deployment never took effect: it gets no row and is ignored everywhere else. The before window is `[deployed_at − 1 hour, deployed_at)` and the after window is `[deployed_at, deployed_at + 1 hour)`, both half-open. {{window_rule}} `requests_*` counts the zone's requests in the window; a request is blocked when its `action` is `block` (in this exercise challenges and logs are not blocks), whichever rule blocked it. `blocked_pct_*` is `100 × blocked ÷ requests` rounded to 2 decimal places, or NULL when the window holds fewer than {{min_requests}} requests. `change_pp` is `blocked_pct_after − blocked_pct_before`, NULL when either is NULL. A deployment with no requests in its windows still gets its row, with 0 requests.

**Constraints.** One SQL statement (CTEs allowed). The sample has {{zones}} zones, {{deployments}} deployments and {{requests}} requests; production has millions of zones and billions of requests a day.

**Assumptions.** Hypothetical schema, zones, rules and traffic. All timestamps are UTC. The reporting rules (what counts as blocked, the window lengths, the floor) are this exercise's rules, not a product's.

**Clarifications.**
- Q: A request logged exactly at `deployed_at`: before or after? | A: After. The before window ends just before `deployed_at`.
- Q: And one logged exactly an hour after the deployment? | A: Neither window of that deployment; the after window ends just before `deployed_at + 1 hour`.
- Q: Should I count only blocks by the rule that was deployed? | A: No. The report shows the zone's overall blocked share; `rule_id` on a request is informational here.
- Q: Does a failed deployment shorten another deployment's windows? | A: No. It never took effect, so it is ignored entirely.
- Q: How should I round? | A: PostgreSQL `ROUND(numeric, 2)` (half away from zero). Compute `change_pp` from the two rounded values.

**Hints.**
1. Start from the deployments, one row per (deployment, zone) it applies to, and give each its two window bounds. `LAG` and `LEAD` over the zone's succeeded deployments ordered by time give the neighbours.
2. LEFT JOIN the requests on zone and on the whole span `[before_start, after_end)`, then count each side with `COUNT(*) FILTER (WHERE …)` against `deployed_at`.
3. Apply the floor with `CASE WHEN n >= {{min_requests}} THEN ROUND(100.0 * blocked / n, 2) END`; integer division would truncate.

**Follow-ups.**
1. At billions of requests a day, how would you serve this report per zone in seconds? What would you pre-aggregate, and at what time grain, given that windows start at arbitrary seconds?
2. The share went up after a deployment. What else could explain it, and how would you show a customer whether the deployed rule was the cause?
3. Requests in production logs are sampled with a weight per row. Rewrite the counts so the shares are estimates of the true shares, and say what happens to the floor.
4. Deployments reach locations over several seconds, not at one instant. How would you change the windows, and what would you show for the few seconds in between?

**Follow-up rules.**
- when: between → ask: BETWEEN includes both ends. Which requests does it put in both windows, or in the wrong one?
- when: inner join, join requests → ask: Which deployments disappear when no request matches, and should they be in the report?
- when: rule_id = → ask: The customer asked for the zone's blocked share. Why would restricting to the deployed rule's blocks answer a different question?
- when: challenge → ask: Is a challenged request blocked? What does the visitor experience, and how would you report challenges if the customer asked?
- when: lag, lead → ask: Your LAG and LEAD run over which rows? What happens if failed deployments, or other zones' deployments, are in the same window frame?

**Production Reality Check.**
- A customer switched a rule from log to block and the report showed a jump of several points, but an attack against the zone started in the same hour. The support answer credited the rule, and the customer removed it the next day.
- Two teams at one customer deployed rules to the same zone eight minutes apart. A version of this report that used full-hour windows credited both deployments with the same jump, and each team took credit for it.
- A zone onboarded minutes before its first deployment showed a before share of 100% from two requests; the floor of {{min_requests}} requests was added after that report reached the customer.

**Evaluation Criteria.** Deployments as the driving rows, with a LEFT JOIN so quiet deployments keep their row; failed deployments ignored everywhere; half-open windows exactly as stated; at the harder levels, windows cut by the previous and next succeeded deployment affecting the zone, and account-level deployments fanned out to every zone of the account and used as neighbours; blocked defined as `block` only; the floor and NULL handling; numeric (not integer) division and rounding; deterministic ordering; can discuss pre-aggregation, attribution versus coincidence, sampling weights and propagation time.
