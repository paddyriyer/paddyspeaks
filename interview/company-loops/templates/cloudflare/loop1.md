# Cloudflare · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a global edge network:
zones and their hostnames, a CDN cache with cache statuses and purges, DNS records,
requests forwarded to customers' origin servers, and bulk redirect lists. Every rule,
workload, number and schema is hypothetical and this exercise's own; check current
product documentation for how any real feature behaves. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## CFX-L1-01: Cache hit ratio per zone and content type, under a stated counting rule

| | |
|---|---|
| **Template ID** | CFX-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / classification before aggregation, conditional counts, HAVING floors, longest-match joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | CFX-L1-01.mjs |

**Business Scenario.** A customer's dashboard shows how much of their traffic the edge cache served, per zone (a domain the customer has added) and per content type. Customers compare it across zones and argue with it, so the counting rule is written down: a response served from cache counts as a hit even if the edge first revalidated it with the origin, and requests the cache could never have served (bypassed by a rule, or uncacheable by nature) are not part of the ratio at all. A ratio over a handful of requests means nothing, so small groups are hidden. You have one day of request logs ({{requests}} rows) and the list of {{zone_count}} zones.

**Problem Statement.** Write one PostgreSQL query that returns `zone_name, content_type, cacheable_requests, cache_hits, hit_ratio`, ordered by `zone_name, content_type`. Each request belongs to the zone whose `zone_name` equals its `host` or is a suffix of it after a dot (`img.example.com` is in `example.com`). Under this exercise's rule, `cache_status` `hit` and `revalidated` are **hits**; `miss` and `expired` are **misses**; `bypass` and `dynamic` are **excluded**. `cacheable_requests` counts hits plus misses, `cache_hits` the hits, and `hit_ratio` is `ROUND(cache_hits / cacheable_requests, 4)`. Report a (zone, content type) group only if it has at least {{min_cacheable}} cacheable requests. {{status_rule}} {{ct_rule}} {{zone_rule}}

**Constraints.** One SQL statement (CTEs allowed). The floor is inclusive and counts cacheable requests only. Use the exact zone-matching rule above: a plain "ends with" test is not enough.

**Assumptions.** The statuses, their classification and the floor are this exercise's rules; real products define their cache statuses and analytics in their own documentation, so check current docs. Traffic, hosts and zones are hypothetical; `example.*` names are placeholders.

**Clarifications.**
- Q: Why is a revalidated response a hit? | A: Under this exercise's rule the body came from the cache; the edge only asked the origin whether it was still fresh. The origin did not send it again.
- Q: Do bypassed requests count as misses? | A: No. They are excluded from both the numerator and the denominator.
- Q: Is the floor applied to all requests or to cacheable ones? | A: Cacheable ones. A group with many bypassed requests but few cacheable ones is hidden.
- Q: Is `www.example.com` in zone `example.com`? | A: Yes: the zone name follows a dot. `example.com` itself is also in it.
- Q: What do I return for a group below the floor? | A: Nothing: leave the row out.

**Hints.**
1. Classify first: one row per request with its zone, its normalised content type and a hit flag, with excluded statuses filtered out.
2. Match zones with `host = zone_name OR right(host, length(zone_name) + 1) = '.' || zone_name`; if several zones match, keep the longest with `ROW_NUMBER()` or `DISTINCT ON`.
3. Then `COUNT(*)`, `COUNT(*) FILTER (WHERE is_hit)` and a `HAVING COUNT(*) >= …` on the classified rows.

**Follow-ups.**
1. Product wants the same ratio weighted by bytes instead of requests. How does the query change, and why can the two ratios disagree sharply for one zone?
2. The logs reaching you are sampled, and each line carries how many requests it stands for. What changes, and what happens to the floor?
3. At billions of requests a day, would you compute this from raw logs on every dashboard load? Describe the rollup you would keep and its grain.
4. A customer says the ratio dropped overnight with no change on their side. Which questions about the counting rule and the data would you ask before looking at the cache itself?

**Follow-up rules.**
- when: avg, average → ask: Is the ratio the average of per-request flags, the average of per-hour ratios, or the ratio of the totals? Which one does the dashboard need, and does it matter here?
- when: like, ends with, endswith → ask: Does your suffix test put `cdn.myexample.net` in zone `example.net`? How do you make it respect the dot?
- when: having → ask: Your HAVING counts which rows: all requests, or only cacheable ones? What does a group with many bypassed requests do to it?
- when: lower, split_part → ask: Which normalisation do you apply first, and what does `Text/HTML ; charset=utf-8` become in your query?
- when: sampled, sample rate, weight → ask: If each line stands for several requests, do you apply the floor to lines or to the weighted count, and why?

**Evaluation Criteria.** Classifies statuses exactly as stated (revalidated, and stale and updating where present, as hits; bypass and dynamic excluded); a floor on cacheable requests, inclusive; content types normalised (Hard+); a dot-respecting zone match with the longest zone winning and unmatched hosts dropped (Very Hard); correct rounding; deterministic order; can discuss byte weighting, sampling and rollups.

## CFX-L1-02: Origin 5xx share per zone and hour, with edge-generated errors kept apart

| | |
|---|---|
| **Template ID** | CFX-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / outer joins, latest row per key, hourly buckets, ratio floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | CFX-L1-02.mjs |

**Business Scenario.** When a visitor sees an error, the customer needs to know whose problem it is. Some errors come from the customer's own origin server: the edge forwarded the request and the origin answered 5xx. Others are generated at the edge because no answer came back at all, and those belong in a separate column. A support engineer wants, per zone and hour, the share of forwarded requests the origin failed, so a customer can see when their origin was in trouble. You have the request log ({{requests}} requests) and one row per origin attempt that received an HTTP response ({{attempts}} attempts).

**Problem Statement.** Write one PostgreSQL query that returns `zone_name, hour_start, forwarded, origin_5xx, origin_5xx_share, edge_errors`, ordered by `zone_name, hour_start`, where `hour_start` is `request_ts` truncated to the UTC hour. A request is **forwarded** if it has at least one row in `origin_attempts`. A forwarded request is an **origin error** if its outcome `origin_status` is between 500 and 599. A request with no attempts and `edge_status` 500 or above is an **edge-generated error**: it is counted in `edge_errors` only, never in `forwarded`. `origin_5xx_share` is `ROUND(origin_5xx / forwarded, 4)`. Report a zone-hour only if it has at least {{min_forwarded}} forwarded requests. {{edge_rule}} {{attempt_rule}}

**Constraints.** One SQL statement (CTEs allowed). 4xx statuses are not errors for this report. Requests served from cache, or blocked at the edge with a 4xx, have no attempts and are neither forwarded nor errors.

**Assumptions.** The classification is this exercise's rule; which edge error codes a real product uses, and when, is described in its own documentation, so check current docs. Statuses, zones and volumes are hypothetical.

**Clarifications.**
- Q: An origin returned 503 but the visitor got a 200 from a stale cached copy. Is it an origin error? | A: Yes. The report is about the origin, so judge `origin_status`.
- Q: Does an edge-generated error count toward the floor? | A: No. The floor counts forwarded requests only.
- Q: Which hour is 03:59:59.999 in? | A: 03:00. Truncate, do not round.
- Q: Are zone-hours with no forwarded requests reported? | A: No; they are below any floor.
- Q: Is a 404 from the origin an error here? | A: No. Only 5xx.

**Hints.**
1. Reduce `origin_attempts` to one outcome per request first; `DISTINCT ON (request_id) … ORDER BY request_id, attempt_no DESC` is one way.
2. `LEFT JOIN` the outcome onto every request: a NULL outcome means not forwarded, and that is where edge errors live.
3. One classified row per request (forwarded, origin_5xx, edge_error flags), then `COUNT(*) FILTER (…)` per zone and `date_trunc('hour', request_ts)`.

**Follow-ups.**
1. The customer's dashboard is in their own time zone. Which hours move, and what happens on a day the clocks change?
2. Their origin sits behind several data centres; the support engineer wants the share per origin address. What do you need in the log, and how does the floor interact with the finer grain?
3. The same query over a month of logs for a large zone is slow. What would you precompute every hour, and can you still apply the floor afterwards?
4. An alert fires when the share exceeds 5% for two hours running. What false alarms does a low-traffic zone produce, and how would you design the threshold to avoid them?

**Follow-up rules.**
- when: inner join, join origin_attempts → ask: With an inner join, where do the requests with no attempts go, and how do you still count the edge-generated errors?
- when: edge_status → ask: A stale copy hides an origin 503 behind a 200. Which column does your error test read?
- when: max(origin_status), any attempt, bool_or → ask: The edge retried and the second attempt returned 200. Is that request an origin error in your query?
- when: count(*) from origin_attempts, per attempt → ask: Are you counting requests or attempts in the denominator? What does a request with three attempts contribute?
- when: date_trunc → ask: In which time zone does your date_trunc run, and what makes that explicit rather than a session default?

**Evaluation Criteria.** Separates forwarded requests (with an attempt) from edge-generated errors (no attempt, 5xx at the edge); judges origin errors by `origin_status`, not the status the visitor saw (Hard+); one outcome per request from its last attempt (Very Hard); 4xx excluded; floor on forwarded requests, inclusive; UTC hours; correct rounding; can discuss local time, finer grains and alert thresholds.

## CFX-L1-03: DNS records that flapped — real changes per record and UTC day

| | |
|---|---|
| **Template ID** | CFX-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LAG over change history, null-safe comparison, per-day counts, value normalisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | CFX-L1-03.mjs |

**Business Scenario.** Customers manage DNS records for their zones through a dashboard, an API and automation such as failover scripts. A record whose answer keeps changing back and forth usually means two automations are fighting, and resolvers around the world see a moving target. A reliability team wants a daily list of records that **flapped**. The change log is noisy: automation often rewrites a record with the value it already had, which changes nothing a resolver sees. You have the change log for a few days ({{changes}} rows).

**Problem Statement.** Write one PostgreSQL query that returns `zone_name, record_name, record_type, change_date, changes`: for each record and UTC date of `changed_at`, the number of **real changes**, keeping only rows where `changes` is greater than {{k}}. Order by `zone_name, change_date, record_name, record_type`. Order a record's rows by `changed_at`, then `change_id`. A row is a real change when its value differs from the record's **previous** row's value, wherever that previous row falls (it may be on an earlier day). A record's first row is its creation and is never a change. {{identity_rule}} {{value_rule}}

**Constraints.** One SQL statement (CTEs allowed). "More than {{k}}" is strict. The previous row is the record's previous row in the whole log, not within the day.

**Assumptions.** The flapping rule and the threshold are this exercise's; real DNS products keep audit logs with their own schemas and semantics, so check current docs. Zones, names and addresses are hypothetical, using documentation address ranges.

**Clarifications.**
- Q: The record was set to the value it already had. Is that a change? | A: No. Nothing a resolver sees changed.
- Q: The first change on Tuesday restores the value from Monday morning. Is it a change? | A: Compare it with the previous row, which is Monday's last value. If that differs, yes.
- Q: Is creating a record a change? | A: No. The first row of a record is its creation.
- Q: Exactly {{k}} changes in a day: reported? | A: No. More than {{k}}.
- Q: Two rows share a timestamp. | A: Order them by `change_id`.

**Hints.**
1. `LAG(new_value) OVER (PARTITION BY <record> ORDER BY changed_at, change_id)` gives the previous value across days.
2. Use `IS DISTINCT FROM` rather than `<>` if a value can be NULL; `<>` with a NULL is neither true nor false.
3. Keep `ROW_NUMBER()` from the same window to drop the creation row, then group by record and `(changed_at AT TIME ZONE 'UTC')::date`.

**Follow-ups.**
1. The team wants to know which actor (dashboard user, API token, automation) caused each flap. What would you add to the log, and how would you report "two actors alternating"?
2. A record with several values (a set of A records for one name) is changed by adding and removing members. How would you define a "real change" for a set?
3. Flapping matters only if resolvers saw it. How would you relate the change log to the record's TTL to estimate how many changes could actually have been observed?
4. The log covers millions of zones. How would you partition and incrementally compute this report each day without rescanning history, given that the previous value can be months old?

**Follow-up rules.**
- when: partition by change_date, partition by date, per day → ask: The first change of a day compares with what? What does a window partitioned by date do to it?
- when: <>, != → ask: What does `new_value <> prev_value` return when one side is NULL, and which rows does that drop?
- when: count(distinct → ask: A record went A → B → A → B. How many distinct values is that, and how many changes?
- when: lag → ask: What is in your LAG's PARTITION BY? Is the record type part of the record's identity?
- when: lower, rtrim, trailing dot → ask: Which values does that normalisation affect, and could it ever merge two answers that really differ?

**Evaluation Criteria.** LAG across days within the record, ordered with `change_id` as the tie-break; same-value rewrites ignored; creation row excluded; strict threshold; record identity includes the type (Hard+); deletions and re-creations counted with null-safe comparison and values normalised (Very Hard); deterministic order; can discuss actors, record sets, TTLs and incremental computation.

## CFX-L1-04: Resolving a bulk redirect list — final target, hops and loops

| | |
|---|---|
| **Template ID** | CFX-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Graphs / functional graphs, memoised iterative walks, cycle detection |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | CFX-L1-04.mjs |

**Business Scenario.** A customer migrating a large site uploads a bulk redirect list: tens of thousands of rules, each sending one URL to another with a status code. Over years of migrations the list has grown chains (old → older → current) and, now and then, loops that send visitors round in circles. Before the list goes live, a validator reports for every source where a visitor would finally land, how many redirects it would take, and whether every hop on the way is permanent, which matters to search engines and caches.

**Problem Statement.** Implement `resolve_redirects(rules)`. `rules` is a list of `(source_url, target_url, status_code)`; URLs are written `host/path`. Following a URL means: if it is a source, go to its target (one **hop**); stop at the first URL that is not a source. Return a dict with one entry per distinct source: `(final_url, hops, permanent)`, where `permanent` is `True` only if every hop on the chain has status 301 or 308. If following a source ever revisits a URL, the chain never ends: return `(None, -1, False)` for it. {{dup_rule}} {{canon_rule}}

**Constraints.** Up to about 150 000 rules, with chains thousands of hops long. Following each source's chain from scratch is quadratic on such lists; aim for O(number of rules). CPython's default recursion limit is about 1 000.

**Assumptions.** Hypothetical sites and rules. The matching and canonicalisation rules are this exercise's; real redirect features have their own options (for example subpath matching or query-string handling), so check current docs. 302 and 307 are temporary, 301 and 308 permanent.

**Clarifications.**
- Q: Is a target that is not a source the final URL even on another host? | A: Yes. Any URL that is not a source ends the chain.
- Q: A source leads into a loop it is not part of. | A: It never ends either: `(None, -1, False)`.
- Q: Does a single 302 anywhere on the chain make it non-permanent? | A: Yes, for every source whose chain passes through it.
- Q: Do I return entries for targets that are not sources? | A: No. Only for sources.
- Q: Can I recurse? | A: Chains are thousands of hops long; an iterative walk is safer.

**Hints.**
1. Build `next[source] = (target, is_permanent)` first; every later step is a lookup.
2. A source's answer is its target's answer plus one hop. Walk forward collecting unresolved URLs on a list, then fill them in backwards.
3. Track which URLs are on the current walk: meeting one again means a cycle, and every URL on that walk, including the lead-in, gets the loop result.

**Follow-ups.**
1. The validator must also suggest a fix: rewrite each rule to point straight at its final URL. Which rules change, and what must you not rewrite?
2. Rules can match a source and all its subpaths, appending the rest of the path to the target. Why does that make "follow until not a source" possibly endless without a loop, and what limit would you add?
3. The list is edited one rule at a time in a UI and validated after every edit. How would you update the answers incrementally instead of recomputing everything?
4. How would you report loops to a customer so they can fix them quickly: which URLs would you show, and in what order?

**Follow-up rules.**
- when: recursion, recursive, def walk → ask: The test chains are 3 000 hops long. What does your recursion do at depth 1 000, and how do you make it iterative?
- when: visited, seen → ask: Is your visited set per walk or global? What goes wrong if a URL resolved in an earlier walk is treated as "on the current path"?
- when: from scratch, for each source, for src in → ask: How many steps does following every chain from scratch take for 40 chains of 3 000 hops?
- when: memo, cache, memoize → ask: How do you memoise a URL whose chain is still being walked, and how do you tell that apart from a cycle?
- when: lower(), canonical, normalise → ask: Do you canonicalise the targets as well as the sources, and what happens to a rule whose target is just another spelling of its source?

**Evaluation Criteria.** Correct final URL, hop count and permanence along each chain; loops, including chains that lead into them, returned as the sentinel; first rule wins for repeated sources and self-redirects are loops (Hard+); canonical forms applied to sources and targets, keeping the root slash and path case (Very Hard); one memoised iterative pass, O(n); a clear complexity argument; credible discussion of flattening, subpath rules and incremental validation.

## CFX-L1-05: Was the cached copy purged before this request?

| | |
|---|---|
| **Template ID** | CFX-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and binary search / per-key sorted timelines, interval existence queries, path prefixes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | CFX-L1-05.mjs |

**Business Scenario.** Customers label cached responses with cache tags (`product-42`, `homepage`) and, when content changes, purge by tag rather than URL by URL. A support team investigating "visitors saw the old price" replays the logs: for each request served from a cached copy, was that copy already invalidated by a purge, so the visitor should have received a fresh one? The replay has to run over a day of a busy zone's requests and purges.

**Problem Statement.** Implement `invalidated(purges, requests)`. `purges` is a list of `(purge_ts, zone, kind, value)`; `kind` is `'tag'` (value is a tag), `'everything'` (value `None`) or `'prefix'` (value is a path prefix). `requests` is a list of `(request_ts, zone, path, cached_at, tags)`: the copy that served the request was stored at `cached_at` and carries `tags`; `cached_at <= request_ts`. Return a list of booleans, one per request in order: `True` if some purge in the **same zone** that matches the copy has `cached_at <= purge_ts <= request_ts`. A tag purge matches when its tag is one of the copy's tags (exact, case-sensitive). {{zone_rule}} {{prefix_rule}}

**Constraints.** Up to 100 000 requests and 60 000 purges; a tag can be purged thousands of times. Checking every purge for every request is far too slow, and so is scanning all of one tag's purges per request. Times are integer seconds.

**Assumptions.** The purge kinds, matching rules and inclusive boundaries are this exercise's; real purge features differ in what they support and how quickly a purge takes effect, so check current docs. Here a purge takes effect at its own timestamp everywhere. Zones, paths and tags are hypothetical.

**Clarifications.**
- Q: A purge happened at exactly `cached_at`. | A: The copy counts as invalidated: both boundaries are inclusive.
- Q: A purge happened at exactly `request_ts`. | A: Also invalidated.
- Q: Does a purge of `product` touch a copy tagged `product-42`? | A: No. Tags match exactly.
- Q: A purge happened before the copy was stored. | A: It cannot affect that copy: the copy was stored afterwards.
- Q: What if the copy has no tags? | A: Tag purges never match it.

**Hints.**
1. The question per (request, key) is "is there a purge time in `[cached_at, request_ts]`?". Group purge times by `(zone, kind, value)` and sort each list once.
2. `bisect_left(times, cached_at)` finds the first purge at or after caching; the copy is invalidated if that time exists and is at or before `request_ts`.
3. A request checks only the keys that could match it: its zone's purge-everything, each of its tags, and (if prefixes exist) each whole-segment prefix of its path.

**Follow-ups.**
1. Support now wants, for each invalidated request, which purge invalidated it first. What changes in the lookup?
2. Purges do not take effect everywhere at the same instant; each location reports when it applied the purge. How would you redo the replay per location?
3. The replay must cover a month for a zone with a billion requests. How would you run it as a batch job, and what would you join on?
4. A customer purges by tag thousands of times an hour from a deploy script. What would you show them about the cost of that, using only these logs?

**Follow-up rules.**
- when: for p in purges, any(, scan → ask: How many purge comparisons does your loop make for 100 000 requests against 60 000 purges?
- when: bisect, binary search → ask: Which side do you bisect on, and how does your comparison keep both boundaries inclusive?
- when: startswith → ask: Does your prefix check treat `/img` as covering `/images/hero.jpg`? How do you stop it at a segment boundary?
- when: setdefault, defaultdict, dict of lists → ask: What is the key of your index? Where does the zone go, and what happens if two zones use the same tag?
- when: sort, sorted → ask: You sort once per key. What is the total cost, and what if purges arrive as a stream while requests are being replayed?

**Evaluation Criteria.** Inclusive boundaries on both ends; exact tag matching; zone isolation and purge-everything (Hard+); prefix purges on whole path segments, including a prefix equal to the path (Very Hard); per-key sorted times with binary search rather than scans; a clear complexity argument (O((p + q·k) log p)); credible discussion of first-purge attribution, per-location propagation and batch replay.
