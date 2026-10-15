# xAI · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a model API
platform with real-time data: per-model rate limits on requests per second and
tokens per minute that scale with a team's cumulative-spend tier, a batch API,
server-side tools for web search and search over public posts that return
citations, regional endpoints and usage analytics for teams. Every tier, limit,
price, multiplier, volume and latency is hypothetical and this exercise's rule
(check current docs). Public posts are public posts with a given schema, authors
and users appear only in aggregate, and nothing here describes the company's or
any partner's internal systems, data or how they are built.

## XAI-L4-01: Rate limiting by spend tier — requests per second and tokens per minute, enforced across regions

| | |
|---|---|
| **Template ID** | XAI-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Admission control / per-model limits by tier, token reservations, regional shares, honest retry hints |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "teams": ["20,000", "80,000", "250,000"],
  "regions": {"2": [3, 4], "3": [6, 8]},
  "peak_rps": {"2": ["40,000", "90,000"], "3": ["300,000", "600,000"]},
  "upgrade_minutes": [2, 5, 10]
}
```

**Business Scenario.** {{teams}} teams call a model API through regional endpoints in {{regions}} regions, at up to {{peak_rps}} requests a second across the platform at peak. Each team has, for each model, a limit on requests per second and a limit on tokens per minute. Both limits depend on the team's spend tier, which rises as the team's cumulative spend crosses published thresholds. In this exercise a team's limit for a model applies to all regions combined, and the tokens counted are input plus output tokens (this exercise's rule; check current docs). When a request would exceed a limit, the API answers with HTTP 429. Teams that pay and cross a threshold expect their new limits within {{upgrade_minutes}} minutes.

**Problem Statement.** Design the rate-limiting system. Cover the limit model (tiers, versioned thresholds, per-model limits per tier) and how it reaches every region; how a request's token cost is counted when its output length is unknown at admission, including streamed responses that run for a minute or more; how a team-wide limit is enforced across {{regions}} regions without a cross-region call on every request; how a tier upgrade takes effect within {{upgrade_minutes}} minutes and how you prove it did; what a 429 says (which limit, and an honest hint for when to retry); how rejections caused by a team's own limit are kept apart from refusals caused by platform overload; what each rejection records for later analysis; and the headroom view teams see.

**Constraints.** The admission check adds under 5 ms p99 to a request. Across all regions, a team never exceeds a limit by more than a bound you state (for example 5% over any minute). A region keeps admitting within its own share when it cannot reach the other regions or the coordination service. A tier upgrade is in force in every region within {{upgrade_minutes}} minutes. A retry hint is never shorter than the real wait for the limit that was hit.

**Assumptions.** Team counts, rates, tiers, thresholds and limits are hypothetical, and the rules are this exercise's (check current docs). Cumulative spend is computed by the billing system and only grows; the tier thresholds themselves are versioned and can change. Batch requests have their own limits and are out of scope.

**Clarifications.**
- Q: Are limits per region or global? | A: In this exercise, per team and model across all regions combined.
- Q: What counts toward tokens per minute? | A: Input plus output tokens (this exercise's rule). The output count is known only when the response ends.
- Q: Can a team's tier go down? | A: Not in this exercise. A team's cumulative spend only grows, but a new threshold version can move where the boundaries are; decide what happens to teams near one.
- Q: Is there a burst allowance? | A: Your choice; say exactly what a team can send at the start of a minute, and make the headroom view agree with it.
- Q: Do retried requests count again? | A: Yes; every request that reaches admission is counted, including retries.

**Hints.**
1. Requests per second is known at admission; tokens per minute is not. Reserve an estimate at admission and settle it with the actual count when the response ends, returning the difference.
2. A team-wide limit across regions can be split into regional shares that a coordinator rebalances every few seconds from recent demand. Each region decides locally, and the overshoot is bounded by how much share can move between rebalances.
3. Tier state is small. Publish it as a versioned snapshot to every region, have each region report the version it enforces, and treat an upgrade as an event you can trace end to end.

**Follow-ups.**
1. Walk a streamed request with 2,000 input tokens and a maximum of 8,000 output tokens through admission and completion. What is reserved, what is settled, and when is the remainder released?
2. A team sends all its traffic to one region while its share is spread evenly across the {{regions}} regions. How fast does the share move, and what does the team see in the meantime?
3. Trace a tier upgrade from the spend event to the new limit in force in every region, and show how you would prove it happened within {{upgrade_minutes}} minutes.
4. How do you make the retry hint honest for a tokens-per-minute limit when the wait depends on in-flight requests whose output length is still unknown?
5. From your data, how do you tell a team throttled by its own limit from one refused because a model was overloaded, and what does each one see?

**Follow-up rules.**
- when: redis, central counter, global counter, single counter → ask: That counter lives in one region. What happens to admissions in the other regions when it is 80 ms away, or unreachable for ten minutes?
- when: max_tokens, max tokens, reserve, reservation → ask: Many teams set the maximum output far above what they use. How much of their tokens-per-minute budget does your reservation lock up, and what would you change?
- when: token bucket, leaky bucket, refill → ask: The bucket refills every second but the limit is per minute. What burst does a team get at the start of a minute, and does your headroom view say the same?
- when: retry-after, retry after, backoff, retry hint → ask: Thousands of clients receive the same hint at the same moment. What happens when they all come back together, and how would you spread them out?
- when: cache, cached, ttl → ask: A team upgrades. How long can a region keep enforcing the old tier from that cache, and how would you know it did?

**Production Reality Check.**
- A new tier-threshold version reaches all but one of the {{regions}} regions. In that region, 1,200 teams that crossed a threshold still get their old limits 50 minutes later, well past the {{upgrade_minutes}}-minute target, and nobody is paged.
- After a client library release, every tokens-per-minute rejection carries a retry hint of one second. Clients retry in lockstep, rejections reach 40% of all requests at peak, and admitted tokens stay flat.
- Teams running long streamed generations report being throttled at about 35% of their tokens-per-minute limit by their own count: reservations sized by the maximum output length are held until each stream ends.

**Evaluation Criteria.** Versioned tiers, thresholds and per-model limits published as snapshots with the enforced version reported per region; requests per second checked at admission and tokens per minute reserved then settled, with a stated estimate and early release of unused reservation for long streams; team-wide limits split into regional shares with rebalancing, local decisions and a stated overshoot bound, safe behaviour when partitioned; tier upgrades traced end to end with a measured time to enforce; 429s that name the limit hit with honest, jittered retry hints; own-limit rejections kept apart from overload refusals; rejection records with team, model, region, limit type and tier version; a headroom view consistent with enforcement; adapts to each incident with diagnosis, recovery and prevention.

## XAI-L4-02: Searching public posts as a server-side tool — a live index queried inside a response

| | |
|---|---|
| **Template ID** | XAI-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time retrieval / time-partitioned index, given scoring function, deletion-safe caching, latency budgets |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "posts_per_day": {"2": ["50 million", "150 million"], "3": ["500 million", "1 billion"]},
  "calls_per_second": ["2,000", "10,000", "40,000"],
  "budget_ms": [300, 600, 1000],
  "searchable_days": [7, 30, 90]
}
```

**Business Scenario.** A model API offers a server-side tool that searches public posts. During a response the model decides to call it with a query, an optional time range and optional filters such as language; the tool returns a ranked list of posts and the response cites the ones it used. About {{posts_per_day}} public posts with a given schema (post id, version, creation time, language label you are given, synthetic tokens, aggregate engagement counts) arrive each day, and the last {{searchable_days}} days are searchable. Edits arrive as new versions and deletions as events, both from an ingestion pipeline that already exists. At peak the tool is called {{calls_per_second}} times a second, and each call has a budget of {{budget_ms}} ms because the model is waiting.

**Problem Statement.** Design the query side of the tool. Cover the index layout over time (how the newest minutes are held, how older data is organised, how partitions are retired); how a time range prunes the work; candidate retrieval and how the scoring function you are given is applied (its inputs are the match against the query, recency and the post's aggregate engagement counts); merging the top results across shards with deterministic ties; edits (only the latest version is returned) and deletions (a deleted post is never returned or cited once its deletion has been processed); any caching of results and how it stays safe under deletions; behaviour when a shard is slow (partial results, clearly marked); what each call returns to the model (post id, version, score, citation); and what is logged per call.

**Constraints.** Tool call p99 within {{budget_ms}} ms at {{calls_per_second}} calls a second. A deleted post is never returned or cited more than 30 seconds after its deletion event is received (this exercise's rule). Identical calls against the same index version return the same ranked list. Logs carry post ids and versions, never post text, and no individual author appears in any report.

**Assumptions.** Volumes, budgets and windows are hypothetical. The scoring function, its weights and the language labels are given to you and are out of scope; you decide where and how it is evaluated. Ingestion freshness is owned by another team; assume a post is handed to you within a minute of creation.

**Clarifications.**
- Q: Lexical, vector or both? | A: Your choice; say what each costs at this volume and how the given score combines them.
- Q: How common are time ranges? | A: Most calls ask for the last hour or the last day; a few ask for a specific older window.
- Q: May an edited post's older version be returned? | A: No. Only the latest version, and the citation names that version.
- Q: Can the tool return fewer results than asked? | A: Yes, if it says so and why (no matches, time budget, a shard missing).
- Q: Can results be cached between different teams' calls? | A: The posts are public, so yes, if no team-specific filter or setting changes the result; say how you keep that true.

**Hints.**
1. Partition by time: a small, frequently rebuilt in-memory tier for the newest minutes, immutable segments for older hours and days, and whole-partition retirement at the end of the window.
2. Deletions are cheapest as a tombstone set checked at serve time on every result, regardless of which index or cache produced it; physical removal can come later.
3. A per-shard deadline turns a slow shard into a marked partial result instead of a timeout for the whole call.

**Follow-ups.**
1. Walk one call asking for the last hour in one language through the system, with the time spent at each step against the {{budget_ms}} ms budget.
2. A post is deleted while a result list containing it sits in your cache. Show exactly why it is never returned again.
3. A widely discussed event makes most calls ask for the last ten minutes. Which shards get hot, and what do you change?
4. How do you make the merged ranking deterministic when scores tie across shards, and why does the model need that?
5. The scoring function is replaced by a new version. How do you roll it out, compare it with the old one, and keep citations from both versions explainable?

**Follow-up rules.**
- when: elasticsearch, opensearch, lucene, solr → ask: How do you keep deletions visible within 30 seconds when segments are immutable and merges run in the background?
- when: cache, cached, caching → ask: What exactly is in the cache key, and what makes a cached list unsafe once one of its posts is deleted?
- when: embedding, vector, ann, approximate nearest → ask: Approximate search can miss a post the exact scoring would rank first. How would you measure that, and is it acceptable for a time-range filter of the last ten minutes?
- when: fan out, fan-out, scatter gather, all shards → ask: One shard of many answers in three times the usual time. What does the caller get, and how does the model learn the results are partial?
- when: replica, replicas, replication → ask: A replica lags the deletion stream by two minutes. Can a query routed to it return a deleted post, and what stops that?

**Production Reality Check.**
- A cached result list for a popular query keeps citing a post for 20 minutes after it was deleted: the cache key held the query and time range but nothing tied to deletions, and serve-time checks were skipped for cache hits.
- When a widely discussed event breaks, 70% of calls ask for the last hour. The shards holding the newest partition reach 95% CPU and tool-call p99 rises to four times the {{budget_ms}} ms budget, while shards for older partitions sit idle.
- One shard answers slowly after a disk fault. Because the merger waits for every shard, 8% of calls time out instead of returning the other shards' results marked partial.

**Evaluation Criteria.** Time-partitioned layout with a fresh in-memory tier, immutable older segments and whole-partition retirement; time-range pruning before any scoring; the given scoring function applied consistently with deterministic tie-breaks and a clear top-k merge; latest-version-only results with versioned citations; deletions enforced at serve time on every path including caches and replicas, with a stated bound; per-shard deadlines and explicitly marked partial results; hot-partition handling (more replicas for the newest partitions, caching of recent-window candidates, load-aware routing); per-call logs of ids, versions, timings and outcomes without post text; adapts to each incident with diagnosis, recovery and prevention.

## XAI-L4-03: A team's usage console — spend toward the next tier, limit headroom, and numbers that match the invoice

| | |
|---|---|
| **Template ID** | XAI-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Usage analytics / one priced usage fact, provisional and final numbers, tier progress, tenant isolation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "teams": ["30,000", "100,000", "300,000"],
  "usage_rows": {"2": ["300 million", "800 million"], "3": ["4 billion", "10 billion"]},
  "tiers": [4, 5, 6],
  "fresh_minutes": [5, 15, 60]
}
```

**Business Scenario.** {{teams}} teams use a model API through ordinary requests, the batch API (billed at a discount), server-side tools (each tool call billed by this exercise's rule) and regional endpoints (billed with a price multiplier). Each team's usage console shows: spend this month and spend toward the next of {{tiers}} spend tiers; current limit headroom per model; and breakdowns by model, API key, ordinary versus batch, tool and region. The platform records about {{usage_rows}} usage rows a day. Teams reconcile the console against their invoice and complain when the two disagree. The console should be no more than {{fresh_minutes}} minutes behind.

**Problem Statement.** Design the console's data. Cover the usage record and its ids; where prices, batch discounts, tool-call charges and regional multipliers are applied (once, from versioned price data); how batch requests that finish later are dated; how the console separates provisional numbers from final, invoiced ones; how spend toward the next tier is computed so it agrees with the system that actually changes a team's tier; how limit headroom is shown from enforcement data rather than from billing data; late and duplicate usage events; the breakdowns and how they sum to the total; the tie-out that proves the closed month equals the invoice; and how one team's data never appears in another team's console.

**Constraints.** For a closed month, the console's total for a team equals the invoice to the cent, and every breakdown sums to that total. The console is at most {{fresh_minutes}} minutes behind for provisional numbers. Money is never stored or summed in floating point. A team sees only its own usage, and every view is scoped by the verified identity of the caller.

**Assumptions.** Team counts, volumes, prices, discounts, multipliers and tier thresholds are hypothetical, and the rules are this exercise's (check current docs). Usage events come from the request path with a request id, team, key, model, region, token counts, tool calls and a batch id when there is one.

**Clarifications.**
- Q: Which spend moves a team up a tier? | A: In this exercise, invoiced and paid spend; decide how the console shows spend that is accrued but not yet paid.
- Q: When is a batch request's usage dated? | A: Your choice between submission and completion; state it and apply it everywhere, including the invoice.
- Q: Can prices change mid-month? | A: Yes, with an effective time; requests are priced by the version in force when they were served.
- Q: Are credits and refunds shown? | A: Yes, as their own lines, so the console explains the whole invoice.
- Q: Can teams export the breakdowns? | A: Yes, and an export must match the console exactly.

**Hints.**
1. Price each usage row once, when it is written, with the price version, discount and multiplier recorded on the row; every view and the invoice then sum the same rows.
2. Keep two clocks: provisional rows that can still change, and closed periods that change only by dated adjustments. Show which one each number comes from.
3. Tier progress and limit headroom come from different systems. Read each from the system that enforces it, and label what each means.

**Follow-ups.**
1. Walk one request that used the post-search tool twice in a regional endpoint from usage event to a line on the console and a line on the invoice.
2. A team's console says it passed the next tier threshold yesterday, but its limits have not changed. What happened, and what should the console have said?
3. A price version changes on the 15th. Show how the month's total and every breakdown still sum to the invoice.
4. A batch submitted at 23:50 on the last day of the month finishes at 02:10 the next day. Which month carries it, in the console, the tier progress and the invoice?
5. How would you prove continuously that the console and invoices agree for every team, and what do you do when one does not?

**Follow-up rules.**
- when: float, double, decimal → ask: Where can a fraction of a cent exist in your pipeline, and where exactly is it rounded?
- when: materialized view, materialised view, rollup, aggregate table → ask: A late usage event arrives for an hour already rolled up. Which numbers change, and how does the team see that?
- when: real time, real-time, streaming → ask: Which numbers on the console must be exact and which may be provisional, and how does the page say which is which?
- when: tenant, team_id, row-level security, row level security → ask: A new breakdown is added by an engineer who forgets the team filter. What stops it leaking another team's usage?
- when: exactly once, deduplicate, dedupe, idempotent → ask: The same usage event arrives twice, once late. What is the key that makes the second one harmless?

**Production Reality Check.**
- The console counts accrued spend toward the next tier while the tier engine counts paid spend, so 600 teams see a tier reached on the console that their limits do not reflect, and support tickets triple in a day.
- A regional multiplier version that took effect mid-month is applied by the console to the whole month, so for teams using that region the console and the invoice differ by up to 4%.
- A backlog in the usage stream leaves the console 3 hours behind, far past the {{fresh_minutes}}-minute target, and the page still labels its numbers as current.

**Evaluation Criteria.** One priced usage fact with stable ids, the price version, discount and multiplier recorded at write time and integer minor units; one stated dating rule for batch usage applied in console, tier progress and invoice; provisional versus closed numbers labelled, with closed periods changed only by dated adjustments; tier progress read from the same definition the tier engine uses and limit headroom read from enforcement data; idempotent ingestion of late and duplicate events; breakdowns that sum to totals and a continuous tie-out against invoices; team scoping from verified identity in every query path and export; freshness measured and shown; adapts to each incident with diagnosis, recovery, customer communication and prevention.

## XAI-L4-04: Citation quality monitoring — dead links, unsupported spans and per-tool trends

| | |
|---|---|
| **Template ID** | XAI-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Quality monitoring / link checking with politeness, versioned support scores, probe sets, stratified review samples |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "citations_per_day": {"2": ["20 million", "60 million"], "3": ["400 million", "1 billion"]},
  "probe_queries": ["5,000", "20,000", "50,000"],
  "sample_size": [200, 500, 1000],
  "recheck_hours": [6, 24, 72]
}
```

**Business Scenario.** Responses that use the server-side web search or public-post search tools attach citations: a span of the response and the source (a URL, or a post id and version) that supports it. About {{citations_per_day}} citations are produced a day. The product team wants to know, per tool, model and week, how often citations point to dead links, how often a support score you are given says the source does not support its span, and whether either is getting worse. Production responses belong to the teams that made them. In this exercise only content-free signals (tool, model, time, the cited URL or post id, link status, the support score and its scorer version) leave the request path, and only teams that opted in contribute response text to review. A fixed probe set of {{probe_queries}} synthetic queries is also run every day. Each week {{sample_size}} citations go to people who judge whether the score was right.

**Problem Statement.** Design the monitoring. Cover the citation record and what it may and may not hold; link checking (when a URL is checked, how often it is rechecked, how 404s, timeouts, server errors, redirects to a home page and blocked requests are told apart, and how small sites are not overloaded); post citations whose post was later deleted (a separate status, never a dead link, and never re-fetched); where the support score is computed and how its scorer version is recorded; the probe set and what it adds that production signals cannot; per-tool, per-model weekly trends and alerts that tell a real change from a change in the scorer or the checker; and the weekly review sample, how it is drawn and what reviewers see.

**Constraints.** No response text is kept for teams that did not opt in. The link checker sends no more than a polite, per-domain rate of requests, honours the site's crawling rules, and fetches status only, keeping no page contents. A cited URL is rechecked every {{recheck_hours}} hours while it keeps being cited. Every trend can be split by scorer version and checker version. The review sample is drawn so that rare tools and models are represented.

**Assumptions.** Volumes, rates and sizes are hypothetical, and the opt-in, retention and checking rules are this exercise's (check current docs). The support score is a function you are given: it takes a span and source text and returns a number between 0 and 1 with a version; "unsupported" means below a threshold that is also given.

**Clarifications.**
- Q: Can the score be recomputed later over production citations? | A: Not for teams that did not opt in, because their text is not kept. It is computed once in the request path; the probe set can be rescored at any time.
- Q: Is a redirect a dead link? | A: Not by itself. A redirect to the same page's new address is live; a redirect of every path to a home page usually means the page is gone. Decide how you tell them apart.
- Q: What do reviewers judge? | A: Whether the source supports the span, on a fixed scale with written guidance. They never judge the topic of the content.
- Q: Who sees the trends? | A: The product and model teams, in aggregate. No individual team's citations appear in a report.
- Q: How fresh must the trends be? | A: Daily is enough; the dead-link rate for a tool should alert within a day.

**Hints.**
1. Separate three clocks: when a citation was made, when its link was last checked, and which scorer version scored it. Most false alarms come from mixing them.
2. A fixed probe set run every day is a controlled experiment: the queries do not change, so movements in its numbers come from the tools, the models or the scorer.
3. Stratify the review sample by tool, model and score band, and weight the results back to the population when you report them.

**Follow-ups.**
1. Walk one web citation from the response to its first link check, its rechecks and the weekly trend it lands in.
2. The unsupported share doubles overnight for every tool at once. How do you find out within an hour whether the citations changed or the scorer did?
3. How would you check that the support score agrees with people, and what do you do if it disagrees mostly for one tool?
4. A cited site starts blocking the checker. What status do its citations get, and what keeps that from looking like a wave of dead links?
5. A model team wants the response text of unsupported citations from all teams to debug. What do you offer instead?

**Follow-up rules.**
- when: crawl, crawler, scrape, scraper → ask: The checker hits a small site 50,000 times in an hour because a popular response cites it. What limits that, and what does the site owner see?
- when: llm judge, model as judge, judge model → ask: The judge model is updated. How do you keep last month's trend comparable with this month's?
- when: random sample, sample randomly → ask: One tool makes 2% of citations. How many of your {{sample_size}} reviews does it get, and is that enough to say anything about it?
- when: retain, retention, stored, log → ask: Which fields in that record could identify a team or reveal a response, and why do you need each one?
- when: alert, threshold, page → ask: Your dead-link alert fires every Monday because many sites are down for maintenance at the weekend. How do you make it useful?

**Production Reality Check.**
- The dead-link rate for web citations jumps from 2% to 15% in a day. A change to URL canonicalisation stripped a query parameter that some sites need, so the checker requests pages that do not exist; the cited pages are fine.
- A new scorer version is deployed and the unsupported share doubles overnight across every tool and model; nothing about the citations changed, and the weekly report has already gone out with the jump.
- A small site cited by a widely used response blocks the checker after a burst of requests, and all its citations are reported as dead for {{recheck_hours}} hours.

**Evaluation Criteria.** A citation record that holds ids, tool, model, times, link status and versioned scores but no response text outside the opt-in; a polite link checker with per-domain rate limits, crawl-rule honouring, status-only fetches, recheck scheduling and statuses that tell gone pages from blocked, transient and redirected ones; deleted posts as their own status, never re-fetched; scores computed in the request path with the scorer version and threshold recorded; a daily probe set to separate tool, model and scorer changes; trends and alerts split by scorer and checker version with seasonality handled; a stratified, reweighted review sample with written guidance and agreement measured; aggregate-only reporting; adapts to each incident with diagnosis, recovery and prevention.

## XAI-L4-05: Regional endpoints at scale — routing to the chosen region, logs kept in region, and the multiplier billed

| | |
|---|---|
| **Template ID** | XAI-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Multi-region serving / residency settings, team-chosen failover, in-region logs, versioned price multipliers |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "regions": {"2": [3, 4], "3": [6, 9]},
  "pinned_share": ["5%", "15%", "30%"],
  "multiplier": ["1.1", "1.25", "1.5"],
  "failover_minutes": [2, 5, 15]
}
```

**Business Scenario.** A model API is served from {{regions}} regions. Teams call either a global endpoint, which routes each request to a region, or a regional endpoint, which serves the request only in that region. About {{pinned_share}} of teams have a residency setting: their requests, request logs and usage records must stay in a chosen region. Some models are offered only in some regions. Requests served by a regional endpoint are billed at {{multiplier}} times the base price (this exercise's rule; check current docs). When a region is degraded, each team's own failover policy applies: fail the request, or move it to another region the team allowed. Moving traffic must happen within {{failover_minutes}} minutes of a region being declared degraded.

**Problem Statement.** Design regional serving. Cover the region and model catalogue (which models each region offers, versioned); routing for the global and the regional endpoints; how a team's residency setting and failover policy are stored, versioned and enforced on every request; capacity when failover moves traffic into another region; where request logs, usage records and metrics are kept, and what may leave a region (aggregates for billing and capacity, never request-level data of a pinned team); how the price multiplier is applied by the region that actually served each request, with versioned multipliers; and how you detect and report any request that was served outside the place a team's setting allowed.

**Constraints.** A request from a team pinned to a region is never served, logged or stored outside it. Failover follows each team's chosen policy and completes within {{failover_minutes}} minutes of the declaration. Every usage record carries the region that served it and the multiplier version applied. Cross-region data for billing and capacity is aggregate only. A routing mistake that breaks a residency setting must be detected within an hour and reported to the team.

**Assumptions.** Regions, shares, multipliers and timings are hypothetical, and the residency and billing rules are this exercise's (check current docs). Each region has its own serving fleet, storage and observability stack.

**Clarifications.**
- Q: Is the global endpoint billed with the multiplier? | A: Not in this exercise; only requests sent to a regional endpoint are, at the multiplier version in force when the request was served.
- Q: Can a pinned team fail over? | A: Only to regions it listed in advance; many pinned teams list none and prefer errors.
- Q: Does an engineer debugging an incident get request logs from every region? | A: Only within each region's own tools, and pinned teams' request logs never leave their region.
- Q: Are models identical across regions? | A: The same model version where offered; some regions lag new versions by days.
- Q: Who declares a region degraded? | A: Automated health checks with a human able to override; decide the signals.

**Hints.**
1. Make the serving region a first-class field on every request, log line and usage record, set by the region that served it, never inferred later.
2. Resolve the team's residency and failover policy once at the edge into a short list of allowed regions, and carry that list with the request so any later hop can refuse.
3. Ship only aggregates out of a region (per team, model and hour), and build global billing and capacity views from those.

**Follow-ups.**
1. Walk a request from a pinned team through a regional endpoint: routing, serving, logging, usage and billing.
2. One region is degraded. Which teams move, where, and how do you avoid overloading the regions that receive them?
3. A new model version is in only two of the {{regions}} regions. What does a pinned team in a third region get when it asks for it?
4. The multiplier changes at midnight UTC while long streamed requests are running. Which version applies to each of them?
5. How would you prove to a pinned team, every month, that none of its requests were served or logged elsewhere?

**Follow-up rules.**
- when: dns, anycast, geo routing, geolocation → ask: The nearest region by network distance is not the one a pinned team chose. Where exactly does your design stop that request from being served nearby?
- when: central logging, central logs, global log, single warehouse → ask: A pinned team's request logs would land in that central store. What is allowed to leave the region instead, and how is that enforced?
- when: active-active, active active, failover → ask: Failover moves several thousand teams into one region in {{failover_minutes}} minutes. How do you keep that region from failing next?
- when: price, multiplier, billing → ask: A request is admitted in one region and served in another after a retry. Which region's multiplier is billed, and how do you know?
- when: replicate, replication, backup → ask: A backup of a region's usage store is copied to another region for durability. Does that break a residency setting, and what would you do instead?

**Production Reality Check.**
- A region is declared degraded. Teams whose policy allows failover move to the next region, which runs out of capacity for one model within ten minutes, while pinned teams with no failover receive errors for 40 minutes; both groups say the platform failed them.
- During an incident review, an engineer copies a sample of request logs from one region into a shared analysis store in another, including requests from 30 teams pinned to that region.
- A routing configuration change sends 3% of a pinned team's regional-endpoint requests to another region for two hours. The responses are correct, but they are billed at the wrong region's multiplier and served outside the team's region.

**Evaluation Criteria.** A versioned catalogue of regions and models; routing that resolves residency and failover policy at the edge into allowed regions carried with the request and enforced at every hop; failover by team policy with admission limits and load shedding in receiving regions; request logs, usage records and metrics kept in region with only aggregates leaving; the serving region and multiplier version recorded on every usage record and billed from it; detection of any out-of-region serving within an hour with team notification and billing correction; access controls on debugging tools that respect residency; adapts to each incident with diagnosis, recovery, customer communication and prevention.
