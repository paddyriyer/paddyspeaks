# Cloudflare · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a global network
that sits in front of customers' websites and applications: zones and DNS, a CDN
cache with purge, DDoS, WAF, bot and rate limiting rules, edge compute with
key-value, object and coordinated storage, analytics and log delivery. Every
workload, number and schema is hypothetical, product rules are this exercise's
rules (check current docs), and nothing here describes how the company's own
network or systems are built or operated.

## CFX-L4-01: Per-zone analytics at very high volume: sampled edge logs, rollups and dashboards that answer in seconds

| | |
|---|---|
| **Template ID** | CFX-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time analytics / sampling with weights, columnar rollups, multi-tenant query isolation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "edge_rps": {"2": ["8 million", "20 million"], "3": ["45 million", "80 million"]},
  "zones": ["3 million", "10 million", "25 million"],
  "locations": [120, 250, 330],
  "raw_days": [3, 7, 14]
}
```

**Business Scenario.** A global network serves about {{edge_rps}} HTTP requests per second, at peak, for about {{zones}} customer zones (a zone is a customer's domain), from {{locations}} edge locations. Every request produces a log line at the location that served it: zone, timestamp, host, path, method, status, cache status, bytes sent, client country, client network (ASN), the security action taken, and the location. Customers open a per-zone dashboard showing requests, bandwidth, cache ratio, status codes, top paths, top countries and security actions, filterable by any of those fields over any range in the retention period. Traffic is extremely skewed: a few thousand zones carry most requests, while millions of zones see a handful an hour. Under this exercise's rule, analytics for busy zones may be sampled, every stored row carries the sample interval it represents, and the dashboard must say when a number is estimated.

**Problem Statement.** Design the path from edge log lines to the dashboard. Cover collection and transport from {{locations}} locations; where and how sampling happens and how the weights are kept; the storage layout and its keys; the rollups (which dimensions, which time grains) and how a query chooses between raw rows and rollups; top-N queries; how estimated numbers and their uncertainty are shown; late data from a location that was cut off; how one very large zone is kept from slowing everyone else's dashboard; and how a separate set of exact per-zone hourly totals (requests and bytes) is produced for a usage report.

**Constraints.** A request appears on the dashboard within one minute. Dashboard queries answer at p95 in under 2 seconds for the last 24 hours and under 5 seconds for 30 days. Sampled rows are kept for {{raw_days}} days and rollups for 13 months. The exact hourly totals must match a sum over every request, with no sampling, and may be final up to 3 hours after the hour. Storage and compute cost per zone must be small enough that free zones can be served.

**Assumptions.** All volumes, latencies and retention periods are hypothetical, and the sampling rule is this exercise's rule; check current docs for any real product's behaviour. Each location can buffer its own log lines on local disk for a few hours.

**Clarifications.**
- Q: Can the edge drop log lines before they leave the location? | A: Only by sampling with a recorded interval; anything else is data loss and must be counted as such.
- Q: Must top paths be exact? | A: No, but the dashboard must not show a path in the top ten that is not there, and it must say when a list is estimated.
- Q: Are small zones sampled? | A: You decide. Most of them are tiny, and customers notice when a page that got 7 requests shows 10.
- Q: Do customers query unique visitors? | A: They can ask for unique client addresses per day, shown as an estimate.
- Q: Can a customer ask for any combination of filters? | A: Yes; the common ones (status, path, country, cache status) must be fast, and rare combinations may be slower if the page says so.

**Hints.**
1. Separate the two products: exact counters for the usage report (cheap to compute at the edge as aggregates) and sampled rows for exploration. They have different correctness rules.
2. A row that represents 1 in N requests counts N times in every sum and count. Write down what that means for sums, counts, averages, top-N and distinct counts before choosing storage.
3. Sampling only when a zone is busy keeps small zones exact; deciding "busy" per zone per short interval at each location keeps the decision local.

**Follow-ups.**
1. Walk through one log line from the edge to a dashboard chart: what is sampled where, what is stored, and what the query multiplies.
2. A customer filters to a path that got 40 requests in an hour while the zone was sampled at 1 in 100. What does the chart show, and what does the page say?
3. How are the exact hourly totals produced without sampling, and how do you prove they match the sampled view within the expected error?
4. One zone takes a fifth of all traffic during an attack. What protects the other zones' dashboards, and what does that zone's own dashboard show?
5. How would you add a new dimension (say, HTTP protocol version) to the rollups without rewriting 13 months of history?

**Follow-up rules.**
- when: clickhouse, columnar, olap, druid, pinot → ask: What is the sort or primary key of your main table, and what happens to its parts and merges when one zone suddenly sends a fifth of all rows?
- when: sample, sampling, sampled, reservoir → ask: Your sample interval changes from 1 to 50 in the middle of an hour for one zone. How does a per-hour total over that hour stay correct?
- when: kafka, queue, stream, broker → ask: One location is cut off for 40 minutes and then delivers its backlog at once. Which minutes change, and how does the dashboard behave while it catches up?
- when: rollup, pre-aggregate, materialized view, cube → ask: A customer asks for top paths for status 404 from one country over 30 days. Which of your rollups answers it, and if none does, what runs?
- when: hyperloglog, hll, distinct, unique → ask: Unique client addresses for a 30-day range: how are daily sketches combined, and how do sampled rows affect a distinct count?

**Production Reality Check.**
- During an attack on one zone, its share of all rows jumps fifty-fold in ten minutes. Dashboard queries for unrelated zones stored alongside it slow from 1 second to 30, and ingestion lag across the cluster grows to 12 minutes.
- One of the {{locations}} locations loses its link to the pipeline for 40 minutes and then sends its backlog. A customer's hourly chart showed a dip and now shows a spike; they opened a ticket saying traffic was lost and want to know which version of the chart was right.
- A release of the edge logger writes a sample interval of 1 on rows that were sampled at 1 in 10. For 3 hours, request totals on dashboards of the busiest zones fall by about 90%, while the exact hourly totals do not move.

**Evaluation Criteria.** Separates exact usage totals (edge aggregates, idempotent, reconciled) from sampled exploratory rows; sampling with an interval stored on every row and every aggregate weighted correctly, small zones kept exact, estimates and their uncertainty shown; a columnar store keyed by zone and time with rollups at several grains and a query planner that picks the coarsest one that answers; top-N and distinct counts handled as estimates with mergeable sketches; late data placed by event time with a defined finality and visible restatement; isolation for very large zones (separate shards, adaptive sampling, per-tenant query limits); reconciliation between sampled and exact views as a monitor; adapts to each incident with diagnosis, recovery and prevention.

## CFX-L4-02: DDoS and anomaly signals: per-zone baselines, mitigation decisions with an audit trail, and measured false positives

| | |
|---|---|
| **Template ID** | CFX-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Security analytics / streaming baselines, decision records, false-positive measurement (described generally) |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "zones": ["2 million", "8 million", "20 million"],
  "attack_rps": {"2": ["1 million", "5 million"], "3": ["40 million", "150 million"]},
  "decide_seconds": [10, 20, 30],
  "audit_retention": ["180 days", "1 year", "2 years"]
}
```

**Business Scenario.** A global network protects about {{zones}} zones from denial-of-service floods at the HTTP layer. Floods aimed at one zone can reach {{attack_rps}} requests per second, while the same zone may see a legitimate surge of similar shape during a product launch, a ticket sale or a news event. The network watches aggregate traffic per zone and decides when to apply a mitigation: a rule that matches part of the traffic and applies an action (log only, rate limit, challenge, or block) for a limited time. Customers can set how sensitive the protection is for their zone and can see, in their dashboard and logs, what was mitigated and why. This exercise stays at the level of aggregate signals, baselines and decisions; it does not describe how attacks are built or how detection could be avoided.

**Problem Statement.** Design the data side of the protection: the aggregate signals computed per zone and how fresh they are; per-zone baselines that respect daily and weekly patterns; how a signal becomes a mitigation decision within {{decide_seconds}} seconds of an anomaly starting; the decision record (what was seen, which rule and threshold fired, what action, which traffic it matched, when it started and ended, and who or what changed it); what the customer sees; and how false positives (legitimate requests mitigated) are measured and fed back.

**Constraints.** The decision is made from aggregates per zone, summed across locations, not from any single location's view alone. Decision records are kept for {{audit_retention}} and must answer "why was this request challenged?" for any mitigated request a customer names. A mitigation expires on its own unless renewed. A customer's sensitivity setting and their explicit allow rules always apply. Personal data in the signals is limited to what the decision needs, and raw client addresses are kept only for a short, stated period.

**Assumptions.** All volumes, timings and retention periods are hypothetical, and the sensitivity levels and actions are this exercise's rules; check current docs for any real product. A traffic signature (a set of request attributes describing part of the traffic) is something you are given by an upstream component; how it is derived is out of scope.

**Clarifications.**
- Q: How fresh must the per-zone aggregates be? | A: Fresh enough to decide within {{decide_seconds}} seconds; say what window and what update frequency that implies.
- Q: Is the baseline per zone or per zone and path? | A: Per zone at least; finer baselines are your choice, with their cost.
- Q: Can a decision be reversed by a person? | A: Yes, by the customer for their zone within their settings, and by the network's responders; both are recorded.
- Q: Do new zones have a baseline? | A: Not at first. Say what protects them in their first days.
- Q: How do we know a mitigated request was legitimate? | A: Rarely for certain. Name the evidence you would use and how it is biased.

**Hints.**
1. A baseline is a forecast with a spread: expected requests for this zone at this time of week, and how far from it is still normal. Store both.
2. Separate detecting an anomaly from choosing the action. A surge of real customers is an anomaly too; what distinguishes the cases is not volume alone.
3. Treat each mitigation as a record with a lifecycle (proposed, active, renewed, expired, overridden), keyed by an id that every mitigated request's log line carries.

**Follow-ups.**
1. Walk through the first {{decide_seconds}} seconds of a flood: which aggregates move, where they are summed, and what creates the mitigation record.
2. How do you keep last week's attack from inflating this week's baseline for the same zone?
3. A customer asks why 30% of their checkout requests were challenged for nine minutes. What can you show them, and from which stores?
4. How do you estimate the false-positive rate of mitigations when almost no mitigated client ever complains?
5. How would you roll out a change to the decision thresholds for millions of zones without discovering its false positives in production first?

**Follow-up rules.**
- when: machine learning, model, classifier → ask: Where do your labels come from, and how do you keep the model from learning that every launch-day surge is an attack?
- when: threshold, standard deviation, z-score, percentile → ask: A zone that normally gets 20 requests a minute gets 400. Is that an attack under your threshold, and what does the baseline's spread look like at such low counts?
- when: block, blocked, blocking → ask: Blocking is the strongest action. When does your design choose it over a challenge or a rate limit, and how quickly can it be undone?
- when: kafka, stream, flink, windowed → ask: Each location sees only its share of a zone's traffic. Where are the per-zone sums formed, and what happens to the decision when one location's updates arrive late?
- when: audit, audit log, decision record → ask: The mitigation fires a million times a second. What exactly is written per request, and what once per decision?

**Production Reality Check.**
- A retailer's flash sale starts on the hour and its traffic reaches twelve times its baseline in 40 seconds, from many client networks it has never seen before. A challenge is applied to a third of its checkout requests for nine minutes, sales are lost, and the customer asks which requests were affected and why.
- During a flood of {{attack_rps}} requests per second, the store for decision records falls behind and drops writes for 20 minutes. The mitigation worked, but the customer's report for that window is empty, and a compliance review asks for it.
- Several zones that were attacked last week now have baselines inflated by that traffic. A smaller flood this week stays inside their inflated "normal" band, and is mitigated only after 15 minutes instead of within {{decide_seconds}} seconds.

**Evaluation Criteria.** Per-zone aggregates formed across locations with a stated window and freshness; baselines with seasonality and spread, excluding mitigated periods, with a safe default for new zones; detection separated from action choice, with graded actions, expiry and customer settings honoured; a decision record with a lifecycle and an id carried on mitigated log lines, written durably once per decision rather than per request; customer-facing explanation; false positives estimated from several biased signals (customer reports, challenge pass rates, overrides, sampled review) and used to tune thresholds through shadow or log-only rollout; no evasion detail; adapts to each incident with diagnosis, recovery and prevention.

## CFX-L4-03: Global cache purge: by URL, tag and prefix to every location quickly, and proving it finished

| | |
|---|---|
| **Template ID** | CFX-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Distributed invalidation / fan-out, ordering with tiered caches, completion measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "locations": [150, 250, 330],
  "purge_rps": {"2": ["2,000", "8,000"], "3": ["30,000", "100,000"]},
  "target_seconds": [2, 5, 10],
  "max_tags": [16, 32, 64]
}
```

**Business Scenario.** A global network caches customers' content at {{locations}} edge locations, with a smaller set of upper-tier locations that lower tiers fetch from before going to the customer's origin. When content changes, customers purge it: by exact URL, by cache tag (a label the origin attaches to responses; under this exercise's rule a response carries at most {{max_tags}} tags), by URL prefix, by hostname, or everything in the zone. Purge requests arrive through an API at about {{purge_rps}} per second at peak, often from deploy scripts. Customers expect a purged object not to be served from any location within {{target_seconds}} seconds, and many check by fetching the page themselves from different countries.

**Problem Statement.** Design global purge. Cover the purge API (validation, authorisation, per-account limits, what the response promises); the durable purge log; how purges reach every location, including ones that are temporarily cut off; how each kind of purge is applied at a location (exact keys, tags, prefixes, whole zone) without scanning the cache; how purge interacts with the upper tier so stale copies are not refetched; and how you measure and show completion, per purge and as a service-level indicator.

**Constraints.** A purge must take effect in every location within {{target_seconds}} seconds at p99, and a location that cannot confirm a purge must not keep serving the purged content as fresh. Purging must not create a burst of origin traffic large enough to harm the origin. Under this exercise's rule each account has a purge rate limit, and a purge is idempotent. Cache keys may include parts of the query string and request headers, so one URL can have several cached variants.

**Assumptions.** All counts and targets are hypothetical, and purge types, tag limits and rate limits are this exercise's rules; check current docs for any real product. Each location knows the zone of every object it caches and when it was cached.

**Clarifications.**
- Q: Does a purge delete objects or mark them stale? | A: Your choice; say what the next request for that object does in each case.
- Q: Must a purge of a URL remove all its cached variants? | A: Yes, every variant under that URL's cache key rules.
- Q: What does the API return? | A: At least an id the customer can check later; whether it waits for completion is your decision.
- Q: Can a location be unreachable for a while? | A: Yes, for seconds to tens of minutes, and it may keep serving users during that time.
- Q: Are tag purges common? | A: Very; some customers purge thousands of tags a minute during publishing.

**Hints.**
1. Give every purge a position in a per-zone (or global) ordered log. A location's state is then "applied up to position P", which is easy to report and easy to compare.
2. Tags and prefixes do not need an index walk at purge time: record "tag T purged at time t" and compare it with an object's cached time when the object is requested.
3. Think about the order between tiers: if a lower tier purges first, where does its next request for that object go, and what does that location still hold?

**Follow-ups.**
1. Walk through a tag purge from the API call to the first request for an affected object at a far location.
2. How is each purge type applied at a location without scanning every object, and what grows if you keep purge records forever?
3. A location reconnects after 20 minutes. What must happen before it serves another cached response for the affected zones?
4. How do you measure purge completion per location and per purge, and what number do you show the customer?
5. A customer's deploy sends 400,000 URL purges in a minute. How does your design protect everyone else, and what does that customer experience?

**Follow-up rules.**
- when: broadcast, fan-out, pub/sub, gossip → ask: How do you know every one of the {{locations}} locations received a given purge, and what do you do about the one that did not acknowledge?
- when: ttl, expire, expiry → ask: Why not just lower TTLs so purges matter less? What does that do to origin load and hit ratio?
- when: bloom filter, index, trie → ask: How large is that structure per location after a busy day of tag and prefix purges, and when can entries be dropped?
- when: version, generation, epoch → ask: A purge-everything bumps the zone's generation. What happens to origin traffic in the next minute, and how do you soften it?
- when: queue, rate limit, throttle → ask: Your queue is fair per account. A news publisher is purging during breaking news while a deploy script floods its own quota. Who waits?

**Production Reality Check.**
- A location that was cut off from purge delivery for 20 minutes rejoins and serves a product page that the customer purged twice during the outage. Shoppers in one country see a retracted price for six minutes before the location catches up.
- A customer purges a tag. Lower-tier locations apply it within {{target_seconds}} seconds, but refetch the objects from an upper tier that has not applied the purge yet, so the stale versions come back and are cached again for three minutes.
- A deploy script purges 400,000 URLs one by one in a minute. The shared purge pipeline backs up and other customers' purges take four minutes to complete, far beyond the {{target_seconds}}-second target.

**Evaluation Criteria.** A durable, ordered purge log with idempotent ids and per-account limits; fan-out to all locations with acknowledgements and a defined behaviour for unreachable ones (no stale-as-fresh serving: catch up before serving, or treat the zone as stale); purge types applied without scans (key deletion for URLs and variants, lazy comparison against tag and prefix purge times, a zone generation for everything), with bounded growth; tier ordering so upper tiers apply first or lower tiers revalidate; origin protection after large purges; completion measured per location from acknowledgements and verified by probes, shown per purge; fairness under bursty customers; adapts to each incident with diagnosis, recovery and prevention.

## CFX-L4-04: Bot management analytics: scores you are given, verified bots, per-zone reports and rule tuning

| | |
|---|---|
| **Template ID** | CFX-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Security analytics / score distributions, model-version shifts, rule what-if simulation (no evasion detail) |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "requests_day": {"2": ["200 billion", "500 billion"], "3": ["1 trillion", "2 trillion"]},
  "threshold": [10, 20, 30],
  "history_days": [7, 14, 30],
  "zones_with_rules": ["40,000", "150,000", "400,000"]
}
```

**Business Scenario.** A global network attaches a bot score to each of about {{requests_day}} requests a day. The score is something you are given: a number from 1 to 99 where a lower score means the request is more likely automated (this exercise's rule; check current docs), along with the scoring model's version and a coarse label for which kind of signal decided it. Separately, a list of verified bots (well-known crawlers and monitoring services that identify themselves and are confirmed) marks requests from them with a category. About {{zones_with_rules}} customer zones use rules on the score, for example "challenge requests to /login with a score below {{threshold}}", and they want reports that show how automated traffic reaches their zone and what their rules would do before they turn them on.

**Problem Statement.** Design the analytics around the score. Cover the per-zone reports (score distribution over time, by path, by country, by verified-bot category, and by the action their rules took); a what-if tool that replays a draft rule over the last {{history_days}} days and shows what it would have matched, including how much verified-bot and known-good traffic; how a rule is rolled out (log-only first) and measured once live; how changes in the scoring model's version are handled in reports and in customers' rules; and how customers find false positives such as their own mobile app or partners' integrations.

**Constraints.** Reports load in under 3 seconds for {{history_days}} days of a zone's traffic. The what-if result must say how it was computed (sample, period) and how uncertain it is. Reports stay at the level of the score and its labels: the design does not describe how the score is computed or how automated traffic could avoid it. Client addresses are not shown beyond what the customer's own logs already contain, and no per-visitor profile is built for the report.

**Assumptions.** All volumes and settings are hypothetical, and the score range, labels and verified-bot list are this exercise's inputs; check current docs for any real product. The score, model version and label arrive on each request's log line.

**Clarifications.**
- Q: Do scores change for the same kind of traffic over time? | A: Yes, when the scoring model is updated; each request records the version that scored it.
- Q: Should verified bots be scored? | A: They carry a score like anything else, but most customers want them allowed; say how reports and rules treat them.
- Q: Can the what-if replay every request? | A: For small zones, perhaps; for large ones you will need a sample or pre-aggregated data. Say which.
- Q: Can a customer see why a single request got its score? | A: Only the coarse label and the model version, not the model's internals.

**Hints.**
1. Many questions are about the distribution of scores, not individual requests. A histogram of scores per zone, hour and a few dimensions is small and answers most reports.
2. A what-if for "score below X on path P" is a sum over histogram buckets below X for that path, if the path is a dimension you kept. Decide which dimensions keep that property.
3. A model update shifts every distribution at once. Annotate it everywhere and give customers a way to see their rule's match rate before and after.

**Follow-ups.**
1. What are the stored aggregates behind the report, at which grains, and which questions need raw sampled rows instead?
2. Walk through the what-if for a draft rule on /login with a threshold of {{threshold}}: inputs, computation, and what the customer sees.
3. A model update moves 7% of a zone's requests below {{threshold}}. What do your reports and the customer's live rule do that night?
4. How would a customer discover that their own mobile app's requests score low, before and after they deploy a blocking rule?
5. How do you measure, across all zones, whether customers' score rules are blocking mostly automated traffic, without labels for most requests?

**Follow-up rules.**
- when: histogram, bucket, bucketed → ask: Which dimensions does your histogram keep? A customer asks about a path you did not keep. What do they get?
- when: sample, sampling, sampled → ask: Your what-if samples 1% of requests. The draft rule targets a path with 300 requests a day. How sure is the answer, and what do you show?
- when: allowlist, allow list, exception, skip → ask: The customer adds an exception for their app's API path. How do you show them how much traffic the exception now lets through that the rule would have caught?
- when: model version, versioned, model update → ask: A customer's rule was tuned on the old model's scores. Do you change anything automatically when the model changes, and who decides?
- when: retrain, labels, ground truth → ask: Where would labels come from, and why are a customer's own rule actions biased labels?

**Production Reality Check.**
- After a scoring-model update, the share of requests scoring below {{threshold}} rises from 4% to 11% overnight for thousands of zones. Their rules start challenging many more visitors, support tickets triple, and the reports show the change with no annotation.
- A customer turns on a rule blocking scores below {{threshold}} on their API paths. Their own mobile app's requests score low; the app breaks for a large share of users. Their what-if looked clean because it replayed a quiet weekend before an app release.
- An update to the verified-bot list is delayed. For six hours a major search crawler is challenged on thousands of zones, and several customers later see pages drop out of search results.

**Evaluation Criteria.** Aggregates (score histograms by zone, time and selected dimensions, with model version and verified-bot category) sized and justified, with sampled rows for rare questions; a what-if that states its method, sample and uncertainty and shows the impact on verified and known-good traffic; log-only rollout and live measurement of a rule's match rate; model-version changes annotated, compared before and after, and rolled out gradually with customer notice; tools to find false positives such as their own apps; privacy (no visitor profiles, limited addresses); no description of detection internals or evasion; adapts to each incident with diagnosis, recovery and prevention.

## CFX-L4-05: Edge compute observability: per-script errors, CPU time, subrequests and live logs from hundreds of locations

| | |
|---|---|
| **Template ID** | CFX-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Observability / per-invocation telemetry, sampling hot scripts, live tail, per-version comparison |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer |

```params
{
  "invocations_ps": {"2": ["3 million", "10 million"], "3": ["30 million", "70 million"]},
  "locations": [150, 250, 330],
  "hot_rps": ["200,000", "600,000", "1.5 million"],
  "log_days": [3, 7, 30]
}
```

**Business Scenario.** Customers deploy small scripts that run at the edge on every request to their routes: they rewrite requests, call other services (subrequests), read and write key-value, object and coordinated storage, and return responses. Across {{locations}} locations the platform runs about {{invocations_ps}} invocations per second, and the hottest single script runs {{hot_rps}} times a second. Each invocation ends with an outcome (success, uncaught exception, exceeded CPU limit, exceeded memory limit, cancelled by the client), uses some CPU time and wall time, makes some subrequests, and may write console log lines. Under this exercise's rule, a script can run two versions at once with a percentage split during a gradual deployment. Developers want per-script and per-version metrics, searchable logs kept for {{log_days}} days, and a live tail that shows their invocations as they happen while they debug.

**Problem Statement.** Design the observability for these scripts. Cover what each invocation emits and how it leaves the location; metrics per script, version, route and location (requests, outcomes, CPU and wall-time percentiles, subrequests by status); how logs are sampled for very hot scripts while keeping errors and keeping counts estimable; the live tail (connecting a developer's session to invocations in every location, filtering, and what happens when the stream is too fast to read); per-version comparison during a gradual deployment; and how one customer's volume is kept from degrading another's telemetry.

**Constraints.** Telemetry must add negligible CPU time to the invocation and must never fail the invocation. Metrics are visible within a minute; live tail shows an invocation within 2 seconds. Console logs are the customer's data: they are stored only for that customer's use, for {{log_days}} days, and never used for anything else. Percentiles must be correct across locations, not averages of per-location percentiles. Each customer has a stated log volume allowance (this exercise's rule).

**Assumptions.** All volumes, allowances and retention periods are hypothetical; limits, outcomes and gradual deployments are this exercise's rules, so check current docs for any real product. Every location has a local agent that can buffer telemetry for a few minutes.

**Clarifications.**
- Q: Do metrics need every invocation? | A: Counts and outcome counts must be exact per minute; distributions may come from mergeable sketches.
- Q: Should errors be sampled? | A: Customers expect to see every distinct error; say what happens when a script throws a million times a second.
- Q: Who can open a live tail? | A: Anyone with access to the script; several people may tail the same script at once.
- Q: Are subrequest destinations recorded? | A: The host and status, not the full URL or body, under this exercise's policy.

**Hints.**
1. Split the stream at the edge: exact counters and mergeable latency sketches per script, version and minute; sampled log lines with a recorded rate; and a live-tail path that is only active while someone is watching.
2. Sampling that keeps every error and 1 in N successes is biased unless each kept line records its own rate.
3. Live tail is a subscription problem: tell every location which scripts are being watched, and filter and rate-limit at the location rather than centrally.

**Follow-ups.**
1. Walk through one invocation that throws an exception: what is counted, what is logged, and how it reaches a dashboard and a live tail.
2. How do you compute a script's p99 CPU time across {{locations}} locations for the last hour?
3. A gradual deployment sends 10% of traffic to a new version. How does the developer see that the new version's error rate is three times the old one's?
4. How does the live tail behave for a script at {{hot_rps}} invocations per second, and what does the developer see about what was dropped?
5. How would you let a customer send the same telemetry to their own log destination without paying the cost twice?

**Follow-up rules.**
- when: percentile, p99, p95 → ask: Each location reports its own p99. How do you get the global p99 from them, and why is averaging them wrong?
- when: websocket, live tail, tail, subscribe → ask: Three developers tail the same hot script with different filters. Where is each filter applied, and how many copies of each line cross the network?
- when: sample, sampling, sampled → ask: You keep every error and 1 in 100 successes. The dashboard computes an error rate from logs. Is it right?
- when: alert, alerting, anomaly → ask: An error rate moves from 0.2% to 0.6% on 10% of traffic. Does anything fire, and on which series?
- when: opentelemetry, otel, trace, tracing → ask: Which part of that telemetry do you emit per invocation at the edge, and what does it cost the invocation at {{hot_rps}} invocations per second?

**Production Reality Check.**
- One customer's script logs a 20 KB line on every invocation at {{hot_rps}} invocations per second. Its log volume exceeds the rest of a region's, collectors fall behind, and other customers' live tails stall for 15 minutes.
- A gradual deployment sends 10% of a script's traffic to a new version that throws on one route. The script's overall error rate rises only from 0.2% to 0.6%, nothing alerts, and the customer learns of it from their users two hours later.
- Telemetry from one of the {{locations}} locations stops for 30 minutes while its invocations keep running. The customer's dashboard shows a sudden drop in requests that looks like an outage of their script, and they roll back a release that was healthy.

**Evaluation Criteria.** Per-invocation telemetry split at the edge into exact counters, mergeable sketches and sampled logs with recorded rates, never blocking the invocation; metrics per script, version, route and location with correct cross-location percentiles; error-preserving sampling with correct weights and caps per distinct error; live tail as a subscription pushed to locations, filtered and rate-limited there, with visible drop counts; per-version comparison and alerting during gradual deployments; per-customer allowances and isolation; "no data" distinguished from "zero" so a telemetry gap is not shown as an outage; privacy of console logs; adapts to each incident with diagnosis, recovery and prevention.
