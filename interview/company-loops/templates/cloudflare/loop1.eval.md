# Cloudflare · Loop 1 — evaluator notes

## CFX-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH matched AS (
  SELECT r.request_id, r.cache_status,
         COALESCE(lower(trim(split_part(r.content_type, ';', 1))), 'unknown') AS content_type,
         z.zone_name,
         ROW_NUMBER() OVER (PARTITION BY r.request_id ORDER BY length(z.zone_name) DESC) AS rn
  FROM requests r
  JOIN zones z
    ON r.host = z.zone_name
    OR right(r.host, length(z.zone_name) + 1) = '.' || z.zone_name
), cacheable AS (
  SELECT zone_name, content_type,
         cache_status IN ('hit', 'revalidated', 'stale', 'updating') AS is_hit
  FROM matched
  WHERE rn = 1
    AND cache_status NOT IN ('bypass', 'dynamic')
)
SELECT zone_name, content_type,
       COUNT(*)                         AS cacheable_requests,
       COUNT(*) FILTER (WHERE is_hit)   AS cache_hits,
       ROUND(COUNT(*) FILTER (WHERE is_hit)::numeric / COUNT(*), 4) AS hit_ratio
FROM cacheable
GROUP BY zone_name, content_type
HAVING COUNT(*) >= {{min_cacheable}}
ORDER BY zone_name, content_type;
```

**Explanation.** Three decisions, in order. First, the zone: a host belongs to a zone when it equals the zone name or ends with a dot followed by it; when nested zones both match, `ROW_NUMBER()` by name length keeps the longest, and hosts that match no zone fall out of the inner join. Second, the content type: the header's media type before any `;`, trimmed and lower-cased, with a missing header reported as `unknown` (below Very Hard this is a no-op on clean data). Third, the status: excluded statuses leave the population entirely, and of what remains `hit`, `revalidated`, `stale` and `updating` are hits. The floor is a `HAVING` on the same cacheable count that forms the denominator, so it cannot be lifted by excluded requests.

**Complexity.** The zone join compares every request with every zone: O(n·z) with a handful of zones per account, then a sort-based window and a hash aggregate. At scale, the host-to-zone mapping is resolved when the log line is written, never by a suffix join at query time.

**Dialect notes** (described, not executed). BigQuery: `SPLIT(content_type, ';')[SAFE_OFFSET(0)]`, `ENDS_WITH(host, CONCAT('.', zone_name))`, `COUNTIF(is_hit)`, `QUALIFY ROW_NUMBER() … = 1`. Snowflake: `SPLIT_PART`, `ENDSWITH`, `COUNT_IF`, `QUALIFY`; `ROUND` on a `NUMBER` division. Spark SQL: `split(content_type, ';')[0]`, `endswith` (3.3+) or `right`, `count_if`. MySQL 8: `SUBSTRING_INDEX(content_type, ';', 1)`, `SUM(CASE …)`; beware integer-looking division rules and a case-insensitive default collation that would hide the normalisation step.

**Edge cases built into the data.** A group exactly at the floor and one just below it that has many bypassed and dynamic requests on top; a revalidated hit in a reported group; (Hard) `stale`/`updating` hits and headers such as `Text/html; charset=utf-8`, `IMAGE/PNG`, ` image/webp`; (Very Hard) a nested zone, a look-alike host (`cdn.myexample.net` beside zone `example.net`), a host on a removed zone, and requests with no `Content-Type`.

**Common mistakes.** Counting `revalidated` as a miss; leaving bypassed or dynamic requests in the denominator; applying the floor with `>` or to all requests; grouping by the raw header; matching zones with `LIKE '%' || zone_name` (no dot), or attributing nested-zone hosts to the parent; integer division.

**Follow-up guidance.** (1) Sum bytes instead of counting rows; a zone whose small objects hit and large video segments miss has a high request ratio and a low byte ratio, so name both. (2) Weight every count by the sample interval; apply the floor to the number of lines actually seen (or the weighted count with the confidence that implies), and say which. (3) Keep an hourly rollup at (zone, content type, status class) with request and byte sums; the dashboard sums rollups and divides at read time, never averages ratios. (4) Ask whether the rule or classification changed, whether a new rule started bypassing, whether the traffic mix shifted (more dynamic content), and whether logs arrived late or partial before blaming the cache.

**Rubric anchors.** 2: right shape but one classification wrong (revalidated as miss, bypass in the denominator) or the floor on all requests. 3: matches the expected result. 4: also handles byte weighting, sampling and the rollup design credibly.

**Strong signals.** Restates the counting rule as a table of statuses before writing SQL; asks what the floor counts; notices the dot boundary unprompted. **Red flags.** Presenting this exercise's classification as a product's official definition; averaging per-hour ratios.

## CFX-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH last_attempt AS (                 -- one outcome per forwarded request: its last attempt
  SELECT DISTINCT ON (request_id) request_id, origin_status
  FROM origin_attempts
  ORDER BY request_id, attempt_no DESC
), classified AS (
  SELECT r.zone_name,
         date_trunc('hour', r.request_ts) AS hour_start,
         la.request_id IS NOT NULL                          AS forwarded,
         la.origin_status BETWEEN 500 AND 599               AS origin_5xx,
         la.request_id IS NULL AND r.edge_status >= 500     AS edge_error
  FROM requests r
  LEFT JOIN last_attempt la ON la.request_id = r.request_id
)
SELECT zone_name, hour_start,
       COUNT(*) FILTER (WHERE forwarded)   AS forwarded,
       COUNT(*) FILTER (WHERE origin_5xx)  AS origin_5xx,
       ROUND(COUNT(*) FILTER (WHERE origin_5xx)::numeric
             / COUNT(*) FILTER (WHERE forwarded), 4) AS origin_5xx_share,
       COUNT(*) FILTER (WHERE edge_error)  AS edge_errors
FROM classified
GROUP BY zone_name, hour_start
HAVING COUNT(*) FILTER (WHERE forwarded) >= {{min_forwarded}}
ORDER BY zone_name, hour_start;
```

**Explanation.** The outcome of a forwarded request is the status of its last attempt, so `origin_attempts` is first reduced to one row per request (below Very Hard every request has one attempt and this is a no-op). A `LEFT JOIN` keeps every request: a matched outcome means forwarded; no outcome with an edge 5xx means an edge-generated error, which feeds only `edge_errors`. Origin errors are judged on `origin_status`, so an origin 5xx that reached the visitor as a stale 200 still counts. Everything is counted with `FILTER` at the request grain, and the floor is a `HAVING` on the forwarded count. `date_trunc('hour', timestamptz)` truncates in the session time zone, which the setup fixes to UTC.

**Complexity.** One sort (or hash) of attempts for `DISTINCT ON`, one hash join and one aggregate: O(n log n). A production version aggregates per zone-hour as logs arrive.

**Dialect notes** (described, not executed). BigQuery: no `DISTINCT ON`; `QUALIFY ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY attempt_no DESC) = 1`, `TIMESTAMP_TRUNC(request_ts, HOUR)` (UTC by default), `COUNTIF`. Snowflake: `QUALIFY`, `DATE_TRUNC('HOUR', …)` in the session zone (set it), `COUNT_IF`, `DIV0` for safety. Spark SQL: `max_by(origin_status, attempt_no)`, `date_trunc('HOUR', …)` in the session zone. MySQL 8: `ROW_NUMBER()` in a CTE, `DATE_FORMAT(request_ts, '%Y-%m-%d %H:00:00')`, `SUM(CASE …)`.

**Edge cases built into the data.** A zone-hour exactly at the floor and one just below it with many cache hits and blocks; an edge-generated error in a reported zone-hour; origin 4xx responses; (Hard) origin 5xx served stale with edge status 200, and timestamps at `hh:59:59.9xx` and `hh:00:00`; (Very Hard) retries: failed attempts followed by a successful one, and failures on every attempt.

**Common mistakes.** An inner join that loses edge-generated errors, or counting them as forwarded failures; judging by `edge_status`; counting 4xx; flagging a request when any attempt failed, or using the first attempt; counting attempts instead of requests; the floor on all requests or with `>`; rounding timestamps to the nearest hour.

**Follow-up guidance.** (1) Convert to the customer's zone before truncating; a fall-back day has a 25-hour local day with one local hour twice, so key by UTC hour and label locally. (2) Log the origin address per attempt; at the finer grain fewer cells pass the floor, so show "insufficient traffic" rather than hiding the origin. (3) Keep hourly counts (forwarded, origin 5xx, edge errors) per zone; the floor and the share are applied at read time on the summed counts, so they stay correct for any range. (4) Require both a share and a minimum count of failures (or a confidence bound such as Wilson) and two consecutive windows; a zone with three requests an hour otherwise alerts on one failure.

**Rubric anchors.** 2: correct for single attempts but edge errors mixed into the share, or errors judged by the visitor's status. 3: matches the expected result. 4: also designs local-time reporting, a finer grain and alert thresholds that respect small samples.

**Strong signals.** Separates "whose error is it" before writing SQL; asks how retries are logged. **Red flags.** Claiming specific product error codes always mean a particular cause; treating the share as meaningful at three requests.

## CFX-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH ordered AS (
  SELECT zone_name, record_name, record_type, changed_at,
         lower(rtrim(new_value, '.')) AS v,          -- NULL stays NULL: a deletion
         ROW_NUMBER() OVER w AS rn,
         LAG(lower(rtrim(new_value, '.'))) OVER w AS prev_v
  FROM dns_changes
  WINDOW w AS (PARTITION BY zone_name, record_name, record_type
               ORDER BY changed_at, change_id)
)
SELECT zone_name, record_name, record_type,
       (changed_at AT TIME ZONE 'UTC')::date AS change_date,
       COUNT(*) AS changes
FROM ordered
WHERE rn > 1                                         -- the first row is the record's creation
  AND v IS DISTINCT FROM prev_v                      -- rewrites of the same value are not changes
GROUP BY zone_name, record_name, record_type, (changed_at AT TIME ZONE 'UTC')::date
HAVING COUNT(*) > {{k}}
ORDER BY zone_name, change_date, record_name, record_type;
```

**Explanation.** One window over each record's whole history, ordered by `changed_at` then `change_id`, gives every row its previous value, even when that value was written days earlier. `ROW_NUMBER() = 1` marks the creation row, which is never a change. A row is a real change when its normalised value `IS DISTINCT FROM` the previous one: that treats a deletion (NULL) after a value, and a re-creation after a deletion, as changes, which `<>` would silently drop. Normalising (lower-case, trailing dots removed) is a no-op below Very Hard. Only then group by record and UTC date and keep counts above k.

**Complexity.** One sort per record partition for the window and one aggregate: O(n log n). Incrementally, only the last known value per record needs carrying from day to day.

**Dialect notes** (described, not executed). BigQuery: `IS DISTINCT FROM` is supported; `RTRIM(new_value, '.')`; `DATE(changed_at)` is UTC. Snowflake: `IS DISTINCT FROM`, `RTRIM(…, '.')`, `TO_DATE(changed_at)` in the session zone; `QUALIFY` could replace the outer filter. Spark SQL: the null-safe operator `<=>` (negated), `rtrim('.', s)` or `regexp_replace(s, '\\.+$', '')`. MySQL 8: `NOT (a <=> b)` for null-safe inequality, `TRIM(TRAILING '.' FROM …)`; LAG is available from 8.0.

**Edge cases built into the data.** Same-value rewrites between real changes; a first change of the day whose previous value is from an earlier day; a record with exactly k real changes in a day; (Hard) one name with both an A and an AAAA record, pairs of rows in the same second, changes at 00:00:00 and 23:59:59; (Very Hard) deletions and re-creations with the same value as before, and CNAME/AAAA values in different letter case or with a trailing dot.

**Common mistakes.** Counting rewrites; partitioning the window by day; counting the creation row; `>=` instead of `>`; leaving the record type out of the identity; ordering ties without `change_id`; `<>` that drops deletions; comparing raw spellings.

**Follow-up guidance.** (1) Record the actor (user, token or automation id) on each change; report flaps where consecutive changes alternate between two actors, which is the signature of two automations fighting. (2) Treat the record set as a sorted array of values (or a set hash) per name and type at each change; a real change is a different set, and adding then removing the same member is two changes. (3) A resolver sees at most one value per TTL period, so changes closer together than the TTL are partly invisible; count distinct values per TTL-sized bucket as an "observable changes" estimate and say it is an estimate. (4) Partition by change date, keep a small "last value per record" table updated daily, and seed each day's LAG from it; only records changed that day are touched.

**Rubric anchors.** 2: counts rewrites, or resets the comparison each day. 3: matches the expected result. 4: also handles actors, record sets and incremental computation credibly.

**Strong signals.** Asks what the previous value is for the first change of a day; asks whether NULL can appear. **Red flags.** `COUNT(DISTINCT new_value)` as the change count; assuming DNS data in a log reflects what every resolver saw.

## CFX-L1-04

**Reference solution**

```python reference
def resolve_redirects(rules):
    def canon(url):
        host, slash, path = url.partition('/')
        path = '/' + path
        if len(path) > 1 and path.endswith('/'):
            path = path[:-1]
        return host.lower() + path

    nxt = {}                                   # canonical source -> (canonical target, permanent hop)
    for src, tgt, code in rules:
        s = canon(src)
        if s not in nxt:                       # the first rule for a source wins
            nxt[s] = (canon(tgt), code in (301, 308))

    LOOP = (None, -1, False)
    res = {}
    for start in nxt:
        if start in res:
            continue
        path, on_path, u = [], set(), start
        while u in nxt and u not in res and u not in on_path:
            on_path.add(u)
            path.append(u)
            u = nxt[u][0]
        if u in on_path:                       # this walk closed a cycle
            tail = LOOP
        elif u in res:                         # joined a chain resolved earlier
            tail = res[u]
        else:                                  # reached a URL that is not a source
            tail = (u, 0, True)
        for v in reversed(path):               # unwind: each URL is one hop before the next
            if tail is not LOOP and tail[1] != -1:
                tail = (tail[0], tail[1] + 1, tail[2] and nxt[v][1])
            else:
                tail = LOOP
            res[v] = tail
    return res
```

**Explanation.** Every source has exactly one next URL, so the rules form a functional graph: each chain either ends at a URL that is not a source or enters a cycle. A source's answer is its target's answer plus one hop, with permanence and-ed in, so each URL needs resolving once. The walk goes forward until it meets a resolved URL, a URL that is not a source, or a URL already on the current walk (a cycle); then it unwinds backwards, filling in every URL it collected. A cycle result propagates to the whole walk, lead-in included, and to any later walk that reaches it. The first rule per source is kept by inserting only when the key is absent; canonicalisation is applied to both ends before anything else (a no-op below Very Hard).

**Complexity.** O(n) time and memory for n rules: every URL is pushed on a walk once and resolved once. The timing test has about 135 000 rules in 3 000-hop chains and loops; the reference runs in about 0.5 s in CPython. Following each source's chain from scratch with a visited set did not finish in two minutes on the same input, and a recursive memoised version raises `RecursionError` at depth 1 000.

**Dialect notes.** In SQL the same resolution is a recursive CTE that carries a path array for cycle detection (`CYCLE` clause in PostgreSQL 14+), which is O(n·L) rows for long chains; fine for validation of small lists, not for these sizes. In Java or Go the iterative two-phase walk is identical; recursion overflows the default thread stack on long chains. Not executed here.

**Edge cases built into the tests.** A single hop; a two-URL loop; a temporary hop in the middle of a chain (only the URLs before it lose permanence); 307 vs 308; a chain that continues on another host; (Hard) a repeated source where the first rule wins, a self-redirect and a source pointing into it, a lead-in to a cycle; (Very Hard) host case and a trailing slash, a rule whose target is another spelling of its own source, the root path `/`, path case kept, two spellings of one source.

**Common mistakes.** Recursion; following each chain from scratch; a global visited set that mistakes an earlier resolved URL for a cycle; letting a later duplicate rule overwrite the first; returning loop results only for URLs on the cycle, not the lead-in; computing permanence from the first hop only; canonicalising sources but not targets, or stripping the root slash.

**Follow-up guidance.** (1) Rewrite each non-loop rule's target to its final URL; leave loop rules for a human, and keep the status code question explicit (a flattened chain that included a 302 should not become a 301). (2) With subpath matching a URL can grow at every hop (`/a` → `/a/b`, then `/a/b/b`…), so it can run forever without revisiting a URL; cap hops (and URL length) and report the cap. (3) Keep reverse edges; an edited rule invalidates only the URLs whose chains pass through it, found by walking predecessors, then re-resolve those. (4) Report each cycle once, as its URLs in order starting from the lexicographically smallest, with the number of sources that lead into it.

**Rubric anchors.** 2: correct on short chains but quadratic, recursive, or wrong on lead-ins to loops. 3: passes every test with an O(n) iterative pass. 4: also explains flattening, subpath growth and incremental revalidation.

**Strong signals.** Names the structure (one out-edge per node) and its consequence before coding; distinguishes "on the current walk" from "resolved". **Red flags.** Raising the recursion limit as the fix; detecting loops by a hop-count cutoff alone.

## CFX-L1-05

**Reference solution**

```python reference
from bisect import bisect_left


def invalidated(purges, requests):
    times = {}                                     # (zone, kind, value) -> sorted purge times
    for ts, zone, kind, value in purges:
        times.setdefault((zone, kind, value), []).append(ts)
    for ts_list in times.values():
        ts_list.sort()

    def purged(key, lo, hi):                       # any purge time in [lo, hi]?
        ts_list = times.get(key)
        if not ts_list:
            return False
        i = bisect_left(ts_list, lo)
        return i < len(ts_list) and ts_list[i] <= hi

    out = []
    for req_ts, zone, path, cached_at, tags in requests:
        hit = purged((zone, 'everything', None), cached_at, req_ts)
        for tag in tags:
            if hit:
                break
            hit = purged((zone, 'tag', tag), cached_at, req_ts)
        cut = 0
        while not hit:                             # every whole-segment prefix of the path
            cut = path.find('/', cut + 1)
            prefix = path if cut == -1 else path[:cut]
            hit = purged((zone, 'prefix', prefix), cached_at, req_ts)
            if cut == -1:
                break
        out.append(hit)
    return out
```

**Explanation.** Each check asks whether some purge time lies in the closed interval `[cached_at, request_ts]` for one key. Grouping purge times by `(zone, kind, value)` and sorting each list once turns that into a binary search: `bisect_left` finds the first purge at or after `cached_at`, and the copy is invalidated if it exists and is at or before `request_ts`; both boundaries are inclusive by construction. A request needs only the keys that could match it: its zone's purge-everything, each of its tags, and each whole-segment prefix of its path (`/a`, `/a/b`, `/a/b/c.png`), which is how `/img` covers `/img/logo.svg` but not `/images/hero.jpg`. The zone in the key isolates zones, and the input order of purges does not matter.

**Complexity.** O(p log p) to build the index, then O(log p) per key checked: O(q·(k + d)·log p) for k tags and path depth d. The timing test (100 000 requests, 60 000 purges, 20 tags per zone) runs in about 0.2 s; scanning one key's purge list per request took 11–13 s on the same data, and scanning all purges per request is around 6·10⁹ comparisons.

**Dialect notes.** In SQL this is a semi-join: `EXISTS (SELECT 1 FROM purges p WHERE p.zone = r.zone AND p.tag = ANY(r.tags) AND p.purge_ts BETWEEN r.cached_at AND r.request_ts)`, which needs an index on `(zone, kind, value, purge_ts)` to become a range lookup per key; Spark would explode tags and use a range join or bucketing by key. Not executed here.

**Edge cases built into the tests.** A purge at exactly `cached_at` and at exactly `request_ts`; purges one second outside on each side; `product` vs `product-42`; a copy with no tags; no purges; (Hard) the same tag in another zone, purge-everything in one zone only, purges out of time order; (Very Hard) `/img` vs `/images`, a prefix equal to the whole path, `/docs/v2` vs `/docs/v20`.

**Common mistakes.** Exclusive boundaries; `bisect_right` with the wrong comparison; substring tag matching; ignoring the zone; assuming purges are sorted; `path.startswith(prefix)` without the segment boundary; scanning purge lists per request.

**Follow-up guidance.** (1) The first matching purge per key is the bisect result itself; take the minimum time across the request's keys (and keep the purge id alongside the time). (2) Replace the purge time with the per-location apply time, keyed by `(location, zone, kind, value)`; requests are checked against their own location's timeline, and the gap between purge request and apply time becomes a metric of its own. (3) Explode request tags and path prefixes into keys, join to purges on key with a range condition, partitioned by zone and day; carry a day's last purge per key forward for copies cached before midnight. (4) Count purges per tag per hour, and the share of requests that missed because of a purge; show which tags are purged far more often than the content they cover changes.

**Rubric anchors.** 2: correct but scans purges per request, or one boundary or matching rule wrong. 3: passes every test with sorted per-key timelines and binary search. 4: also designs first-purge attribution, per-location timelines and the batch replay.

**Strong signals.** Rephrases the question as "any point in an interval" before coding; asks whether boundaries are inclusive and whether tags are case-sensitive. **Red flags.** Claiming this exercise's purge rules describe how a real product propagates purges.
