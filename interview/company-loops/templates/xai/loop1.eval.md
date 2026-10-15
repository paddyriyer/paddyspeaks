# xAI · Loop 1 — evaluator notes

Simulated practice scenarios; every tier, limit, window, constant, size and volume is
hypothetical and "this exercise's rule; check current docs". Every expected result is
computed by the template's generator and proven against the reference below.

## XAI-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH req AS (                          -- one row per request, whichever gateway logged it
  SELECT DISTINCT ON (request_id)
         request_id, team_id, model, requested_at, status_code, limit_hit
  FROM request_log
  ORDER BY request_id, log_id
), tiered AS (                         -- the tier in force at requested_at (tier 1 before any row)
  SELECT q.*,
         COALESCE((SELECT t.tier
                   FROM tier_changes t
                   WHERE t.team_id = q.team_id
                     AND t.effective_at <= q.requested_at
                   ORDER BY t.effective_at DESC
                   LIMIT 1), 1) AS tier
  FROM req q
)
SELECT model, tier,
       COUNT(*)                                                          AS requests,
       COUNT(*) FILTER (WHERE status_code = 429 AND limit_hit = 'rps')   AS rps_rejections,
       COUNT(*) FILTER (WHERE status_code = 429 AND limit_hit = 'tpm')   AS tpm_rejections,
       ROUND(COUNT(*) FILTER (WHERE status_code = 429 AND limit_hit = 'rps')::numeric / COUNT(*), 4) AS rps_share,
       ROUND(COUNT(*) FILTER (WHERE status_code = 429 AND limit_hit = 'tpm')::numeric / COUNT(*), 4) AS tpm_share
FROM tiered
GROUP BY model, tier
ORDER BY model, tier;
```

**Explanation.** Three steps, each at a clear grain. First one row per request: `DISTINCT ON (request_id)` keeps one log row when two gateways logged the same request (below Very Hard it is a no-op). Then the tier as of the request: the latest `tier_changes` row with `effective_at <= requested_at`, inclusive, so a request in the very second of an upgrade gets the new tier; `COALESCE(…, 1)` covers requests sent before a team's first row (Very Hard). Finally aggregate per model and tier with filtered counts, so only 429s count as rejections while every request, including 400s and 5xxs, stays in the denominator.

**Complexity.** The correlated subquery is one index probe per request with an index on `tier_changes(team_id, effective_at)`; the deduplication is a sort on `request_id`; the aggregate is a hash aggregate. O(n log n) overall. At production volume the tier would be stamped on the request at the gateway, or joined per day partition from a small tier-history table.

**Dialect notes** (described, not executed). Snowflake: `ASOF JOIN … MATCH_CONDITION (q.requested_at >= t.effective_at)` does the as-of join directly; `QUALIFY ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY log_id) = 1` for the deduplication; `COUNT_IF`. BigQuery: no `DISTINCT ON` and no `LIMIT` in a correlated subquery; use `QUALIFY`, or turn tier rows into ranges with `LEAD(effective_at)` and join on `effective_at <= requested_at AND requested_at < next_at`; `COUNTIF`. Spark SQL: range join with `LEAD`, `count_if`. MySQL 8: the `LEAD` ranges and `SUM(CASE …)`.

**Edge cases built into the data.** Teams with one or two upgrades over three days; tiers that differ in rejection rate. Hard: a request at the exact second of an upgrade and one a second before it; 400, 500 and 503 statuses. Very Hard: requests logged twice by a second gateway (both 200s and 429s), and two teams whose first tier row comes after some of their requests.

**Common mistakes.** Joining the team's current tier; `<` instead of `<=` at the upgrade boundary; a `LEAD`-based range with an inclusive upper bound, which puts the boundary request in both tiers; dropping non-429 errors from the denominator or counting 5xx as rejections; counting log rows rather than requests; an inner join that drops requests before a team's first tier row; integer division.

**Follow-up guidance.** (1) For each upgraded team, compare its own rejection rate in equal windows before and after the upgrade (a paired comparison), then summarise across teams with a median or a request-weighted rate, stated as such; exclude the upgrade day or mark it. (2) Log the limit and the observed usage with each request (or per second and per minute buckets) and report headroom as usage over limit, with the distribution, not only a hit count. (3) Partition by request day, cluster by team and model; stamp the tier on the request at the gateway so the report never needs the as-of join, and keep the history table to audit it. (4) Join each rejection to the tier in force by `effective_at` and to the tier the gateway applied (logged on the request); the disagreements within the propagation window are the measured cost of the delay.

**Rubric anchors.** 2: right shape but tier taken as of today, or rejections counted from all errors. 3: matches the expected result. 4: also designs a fair before/after comparison and a headroom report, and explains how the tier gets onto the request at scale.

**Strong signals.** Says the grain out loud (one row per request) before joining; asks whether the boundary is inclusive; checks that `requests` equals the distinct request count. **Red flags.** Treating any non-200 as a rate-limit rejection; implying the exercise's tiers are a real product's thresholds.

## XAI-L1-02

**Reference solution** (PostgreSQL; `{{window_hours}}`, `{{mid}}` and `{{large}}` are the instance's values)

```sql reference
WITH first_result AS (                 -- a request's result time is its earliest result row
  SELECT batch_id, custom_id, MIN(result_at) AS result_at
  FROM batch_results
  GROUP BY batch_id, custom_id
), per_request AS (
  SELECT b.batch_id, b.submitted_at, f.result_at,
         COALESCE(f.result_at <= b.submitted_at + INTERVAL '{{window_hours}} hours', false) AS in_window
  FROM batches b
  JOIN batch_requests q ON q.batch_id = b.batch_id
  LEFT JOIN first_result f ON f.batch_id = q.batch_id AND f.custom_id = q.custom_id
), per_batch AS (
  SELECT batch_id, submitted_at,
         COUNT(*)                                        AS n,
         COUNT(*) FILTER (WHERE in_window)               AS n_in,
         BOOL_AND(in_window)                             AS complete,
         EXTRACT(EPOCH FROM MAX(result_at) - submitted_at) AS secs
  FROM per_request
  GROUP BY batch_id, submitted_at
)
SELECT date_trunc('week', submitted_at)::date AS week_start,
       CASE WHEN n >= {{large}} THEN {{large}} WHEN n >= {{mid}} THEN {{mid}} ELSE 1 END AS size_band,
       COUNT(*)                                          AS batches,
       SUM(n)                                            AS requests,
       ROUND(SUM(n_in)::numeric / SUM(n), 4)             AS in_window_share,
       COUNT(*) FILTER (WHERE NOT complete)              AS pending_batches,
       ROUND(percentile_disc(0.5) WITHIN GROUP (ORDER BY secs) FILTER (WHERE complete) / 3600, 2) AS median_hours
FROM per_batch
GROUP BY 1, 2
ORDER BY 1, 2;
```

**Explanation.** Work at three grains. Per request: the earliest result row on the full key `(batch_id, custom_id)` (custom ids are the team's own and repeat across batches), with a `LEFT JOIN` so a request with no result is kept and counted as not in window; the window comparison is inclusive. Per batch: request count, in-window count, whether every request was in window (`BOOL_AND`) and the last result. Per week and band: the share over requests, the pending batches counted apart, and the lower median of turnaround over complete batches only, because a pending batch's turnaround is unknown or censored. `percentile_disc` returns a turnaround some batch really had; rounding after taking it is the same as rounding first, since rounding is monotone.

**Complexity.** One aggregate over results, two joins and two aggregates: O(n log n) or hash-based O(n). Results tables are large in production; the per-batch rollup is the natural incremental unit.

**Dialect notes** (described, not executed). BigQuery: `APPROX_QUANTILES` or `PERCENTILE_DISC(secs, 0.5) OVER (PARTITION BY …)` as an analytic function, no ordered-set `FILTER` (use `IF(complete, secs, NULL)`, which percentile functions skip); `LOGICAL_AND`; `DATE_TRUNC(DATE(submitted_at), WEEK(MONDAY))`. Snowflake: `PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY IFF(complete, secs, NULL))`, `BOOLAND_AGG`, `DATE_TRUNC('WEEK', …)` follows the `WEEK_START` parameter. Spark SQL: `percentile` (interpolating) or `percentile_disc` in recent versions; `bool_and`. MySQL 8: no percentile functions; `ROW_NUMBER` and counts per group.

**Edge cases built into the data.** Batches in all three bands; slow batches with results after the window; groups where every batch is pending (NULL median). Hard: custom ids `q1, q2, …` reused in every batch; requests with no result row; errored results; a result exactly at the window's end in an otherwise early batch; batches in the last minutes of a Sunday and the first minutes of a Monday. Very Hard: redelivered results, including one whose redelivery falls after the window while the first result was inside it.

**Common mistakes.** Joining on `custom_id` alone, which multiplies rows and lends one batch another batch's results; an inner join that drops pending requests; `<` at the window; excluding errored results; including pending batches in the median, or excluding them from `batches`; averaging per-request shares instead of dividing totals; `percentile_cont` (interpolated, not an observed turnaround); taking the latest result row instead of the earliest; Sunday-start weeks.

**Follow-up guidance.** (1) Request-level percentiles answer "when will most of my results be back", which is what a team plans around; batch-level answers "when is the whole job done"; offer both, labelled. (2) A cancelled request is its own state: count it in a `cancelled` column and leave it out of both in-window and pending, with the share's denominator stated. (3) Maintain the per-batch rollup incrementally keyed by batch, recomputing a batch's row when a result arrives, and the weekly report from the rollup; late results reopen only their own batch. (4) Show turnaround by submission hour as observed distributions with sample sizes and say plainly that the window is the only commitment (this exercise's rule; check current docs).

**Rubric anchors.** 2: right structure but custom ids joined alone, or pending batches mixed into the median. 3: matches the expected result. 4: also separates request-level from batch-level percentiles and explains incremental maintenance.

**Strong signals.** Notices that `custom_id` is only unique within a batch before writing the join; states why a censored turnaround cannot go into a median. **Red flags.** Dropping batches that have no results yet; reading result content to decide anything.

## XAI-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH live AS (                         -- deleted posts leave every column
  SELECT post_id, created_at
  FROM posts
  WHERE deleted_at IS NULL
), first_seen AS (                     -- one row per post: its first searchable time, any version
  SELECT l.post_id, l.created_at, MIN(s.searchable_at) AS first_at
  FROM live l
  LEFT JOIN searchable s ON s.post_id = l.post_id
  GROUP BY l.post_id, l.created_at
)
SELECT date_trunc('hour', created_at)                         AS hour_start,
       COUNT(first_at)                                        AS posts,
       COUNT(*) FILTER (WHERE first_at IS NULL)               AS unsearchable,
       ROUND(percentile_disc(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM first_at - created_at)) / 60, 2) AS median_minutes,
       ROUND(percentile_disc(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM first_at - created_at)) / 60, 2) AS p95_minutes
FROM first_seen
GROUP BY 1
ORDER BY 1;
```

**Explanation.** Filter deleted posts first, then reduce the searchable rows to one per post with `MIN(searchable_at)` across all versions and re-indexes, so an edited post counts once and its lag ends at the first moment any version was findable. The `LEFT JOIN` keeps posts with no searchable row; their `first_at` is NULL, so `COUNT(first_at)` leaves them out of `posts`, the filtered count puts them in `unsearchable`, and the ordered-set aggregates skip NULL inputs. Nearest-rank percentiles (`percentile_disc`) on the exact lag in seconds, divided to minutes and rounded at the end.

**Complexity.** One aggregate over searchable rows per post and one over posts per hour: O(n log n). Exact percentiles need the hour's lags sorted; at scale they come from sketches.

**Dialect notes** (described, not executed). BigQuery: `APPROX_QUANTILES(lag, 100)[OFFSET(95)]` is approximate; an exact nearest rank needs `ROW_NUMBER` and `COUNT` per hour; `TIMESTAMP_TRUNC(created_at, HOUR)`; `TIMESTAMP_DIFF(first_at, created_at, SECOND)`. Snowflake: `PERCENTILE_DISC` exists; `DATEDIFF('second', …)`. Spark SQL: `percentile` interpolates; `percentile_approx` with an accuracy argument. MySQL 8: no percentile functions; `ROW_NUMBER` over the hour and pick position `CEIL(0.95 * n)`.

**Edge cases built into the data.** Edited posts with a second searchable row; posts deleted later, some still with searchable rows; lags from seconds to half an hour, so the 95th percentile sits in the tail. Hard: edits indexed before the first version; posts created in the first and last second of an hour; posts with no searchable row. Very Hard: re-indexes of the same version later, and deleted posts whose searchable rows remain.

**Common mistakes.** Counting after the join (an edited post counted twice, and its later lag in the percentiles); using version 1 only, or the latest version; keeping deleted posts; an inner join that drops unsearchable posts and makes freshness look better; `percentile_cont`; grouping by the hour of `searchable_at`; rounding lags to minutes before taking the percentile.

**Follow-up guidance.** (1) Log a timestamp per stage per post and report each stage's lag distribution plus the end-to-end one; a regression shows up in one stage. (2) Report unsearchable posts as a count and share next to the percentiles, or treat them as censored at the report time; a pipeline that silently drops posts must look worse, not better. (3) Store per-hour sketches (t-digest, KLL, or fixed log-scale histogram buckets) that merge across hours; never average hourly percentiles. (4) A mergeable sketch with a stated rank error (e.g. ±0.5% of rank) is the usual answer; state the error next to the number.

**Rubric anchors.** 2: percentiles computed but edits double-counted or deleted posts kept. 3: matches the expected result. 4: also designs stage-level freshness and honest handling of never-searchable posts.

**Strong signals.** Asks what "searchable" means for an edited post before writing SQL; sees that an inner join improves the metric dishonestly. **Red flags.** Averaging percentiles across hours; using post content or authors for anything.

## XAI-L1-04

**Reference solution**

```python reference
import heapq
from fractions import Fraction


def fuse_results(web, posts, k, top_n, weights=(1, 1)):
    # First (best) rank of each source in each list; a later repeat is ignored
    # and does not renumber the list.
    def first_ranks(xs):
        ranks = {}
        for i, s in enumerate(xs, 1):
            if s not in ranks:
                ranks[s] = i
        return ranks

    score = {}
    for ranks, w in ((first_ranks(web), weights[0]), (first_ranks(posts), weights[1])):
        for s, rank in ranks.items():
            score[s] = score.get(s, 0) + Fraction(w, k + rank)   # exact, never a float
    # Highest score first, equal scores by id; only the top_n are needed.
    best = heapq.nsmallest(top_n, score.items(), key=lambda kv: (-kv[1], kv[0]))
    return [s for s, _ in best]
```

**Explanation.** Two dict passes give each source its first rank in each list in O(n + m), so a source in both lists is merged by id with no search. Scores are sums of `w / (k + rank)`, kept as `Fraction`s, so equality is exact: different rank pairs can produce the same fraction (for example `1/x + 1/y = 1/u + 1/v` for some ranks), and float sums of them can differ in the last bit, which would flip the id tie-break. `heapq.nsmallest` with the key `(-score, id)` returns the top `top_n` in order without sorting every source. An integer alternative compares `p1 * q2` with `p2 * q1`, or uses the key `p * S // q` with `S` larger than the product of any two denominators, which orders and ties exactly like the fractions.

**Complexity.** O(n + m) to score, plus O(N log top_n) to select, with N distinct sources. The timing test (40 000 results per list, a third of the post results also in the web list) takes about 0.3 s in CPython, and about 0.45 s with its data generation. Looking up ranks with `posts.index(s)` and `s in web` scans a list per source: about 27 to 28 s on the same test, 80 to 90 times the reference, well over the 8 s limit.

**The middle approach.** Sorting both lists by id (keeping each source's first position) and merging them like a sort-merge join is O((n + m) log(n + m)) and is another correct method: measured at about 0.35 to 0.45 s on the timing test, it passes and is accepted. Probe how it keeps the first position of a repeated source (sorting `(id, position)` pairs does it) and whether its scores are exact. A float version (`1/(k + r)` summed) passes every Medium test and the timing test, and fails the Hard and Very Hard tests built from rank pairs whose scores are equal as fractions but not as floats; ask the candidate to explain the failure, which is the point of the exercise.

**Dialect notes.** In SQL, fusion is a `FULL OUTER JOIN` of the two ranked lists on source id with `COALESCE`d terms; exactness needs a `NUMERIC` with enough scale or an integer numerator and denominator. In Java, `long` cross-multiplication is exact while `(k + n)²` fits comfortably; `BigInteger` otherwise. Search engines that offer RRF compute it in floating point; their tie behaviour is engine-specific (check current docs). Not executed here.

**Edge cases built into the tests.** A source second in both lists against sources first in only one; mirrored rank pairs that tie exactly, and a `top_n` that ends inside that tie; `top_n` larger than the number of sources. Hard adds a source repeated in one list, an empty list, and a pair of sources whose scores are equal as fractions while their float sums differ, with ids chosen so the float order is the wrong one. Very Hard adds integer weights per list, a weighted pair with the same float trap, and a heavy post list that lifts a post-only source above a web-only one.

**Common mistakes.** 0-based ranks; `list.index` lookups; renumbering a list after dropping a repeat, which shifts every later source; floats with `round` or an epsilon (an epsilon also merges scores that are genuinely different); sorting by score but forgetting the id tie-break, or sorting ids descending; returning fewer than `top_n` when a tie straddles the cut; weights applied to the wrong list.

**Follow-up guidance.** (1) A dict of first ranks per list and one more term in the sum; exactness still holds with fractions; with integer keys the bound on `S` grows with the product of all denominators. (2) Canonicalise before ranking (inside each tool's list), then keep the first position of the canonical id; canonicalising after fusion double-counts. (3) Show a rounded score as display only, and log the inputs (each list, k, weights) so the order can be recomputed exactly; never log only floats. (4) A threshold-algorithm argument: once the k-th best seen score exceeds the best score any unseen source could still reach (`w1/(k + next_web_rank) + w2/(k + next_post_rank)`), the top k are final.

**Rubric anchors.** 2: correct for simple cases but O(n·m) lookups or float ties. 3: all tests pass with dict lookups and exact comparison (or the sort-merge middle). 4: also argues exactness precisely, handles canonicalisation, and gives the early-termination bound.

**Strong signals.** Asks whether ties must be reproducible before choosing a number type; notices that repeats must not renumber. **Red flags.** "Floats are always fine for ranking"; computing the ranking of each tool's list instead of taking it as given.

## XAI-L1-05

**Reference solution**

```python reference
import heapq


def merge_plan(segments, target=1):
    # Optimal merge pattern: always merge the two smallest segments. Heap
    # entries are (bytes, id), so equal sizes come out in id order, and a new
    # segment (always a higher id) goes after an original of the same size.
    heap = [(size, sid) for sid, size in segments]
    heapq.heapify(heap)
    next_id = max((sid for sid, _ in segments), default=0)
    total, merges = 0, []
    while len(heap) > max(target, 1):
        b1, s1 = heapq.heappop(heap)
        b2, s2 = heapq.heappop(heap)
        next_id += 1
        total += b1 + b2
        merges.append((s1, s2, next_id))
        heapq.heappush(heap, (b1 + b2, next_id))
    return total, merges
```

**Explanation.** Every original byte is rewritten once per merge above it, so the total is the sum of size times depth over a forest of merge trees: Huffman's problem. Merging the two smallest first is optimal by the exchange argument (in an optimal plan the two smallest can be swapped into a deepest sibling pair without raising the cost; merge them and recurse). The same argument holds when the plan stops at `target` trees: as long as a merge remains, some pair of leaves are siblings at the deepest level. A heap of `(bytes, id)` gives the two smallest in O(log n) and orders ties exactly as the rule says; new ids exceed every original, so an original goes before a merged segment of equal size. `max(target, 1)` and the loop condition return `(0, [])` for empty, single and already-small inputs.

**Complexity.** O(n log n) time, O(n) memory. The timing test (80 000 segments) takes about 0.26 to 0.33 s in CPython, and under 0.45 s with its data generation. Re-sorting the whole list before every merge is O(n) per merge even on nearly sorted data: measured at 6.7 s for 20 000 segments, and it grows with n², so it is far over the limit at 80 000.

**The middle approach.** A sorted list with `bisect.insort` for the new segment and `pop(0)` twice for the smallest does O(log n) comparisons but O(n) element moves per merge (both the front pops and the insert shift the list). The moves run at C speed, but measured on the 80 000-segment timing test it takes about 18 s, 55 to 70 times the reference, so it fails the 8 s limit; it is fine for a few thousand segments, which is a good conversation about where the crossover is. The two-queue method (sort once; merged sizes come out non-decreasing, so a FIFO queue of merged segments plus the sorted originals always has the two smallest at the fronts) is O(n log n) for the sort and O(n) after; it is correct and accepted if ties between the queues go to the original (lower id).

**Dialect notes.** In Java, `PriorityQueue<long[]>` with a comparator on bytes then id; sizes in `long`, since totals exceed 2³¹ quickly. In SQL there is no natural way to express a greedy over changing state; a recursive CTE would re-sort each step. Real index merge policies (tiered or log-structured merges) trade rewrite cost against search cost and merge more than two at a time; the exercise isolates the rewrite cost. Not executed here.

**Edge cases built into the tests.** Two segments; a case where merging the largest first costs more; equal sizes merged in id order; an original that ties a merged segment, which goes first. Hard adds an empty list and a single segment (`(0, [])`) and zero-byte segments. Very Hard adds a target above 1, a target equal to the count and a target above the count.

**Common mistakes.** Ignoring the id in ties (a heap of bytes alone with a separate id map, or `(bytes, -id)`); giving the merged segment an id that is not after every original; `pop(0)` and `insort` at scale; summing the final size instead of every merge's size; crashing on an empty list (`max()` of nothing) or looping forever when `target` exceeds the count.

**Follow-up guidance.** (1) The exchange argument above; for the target version, note that any plan with a merge has a deepest sibling pair, so the swap applies, and contracting the pair keeps the target. (2) New segments go into the heap as they arrive; the plan is then only optimal for what has been seen; batching arrivals per interval bounds the loss. (3) f-way merges: pad with zero-byte segments so that `(n - 1) mod (f - 1) == 0` (with a target, adjust the count accordingly), then always merge the f smallest; the padding makes the first merge smaller. (4) With a cap on a merge's size, the greedy can strand small segments; a capped greedy is a heuristic, and the candidate should say so and measure it.

**Rubric anchors.** 2: correct total for small inputs but O(n) per merge, or ties wrong. 3: all tests pass with a heap (or the two-queue method) and a clear optimality argument. 4: also proves the target case, explains f-way padding, and is honest about caps.

**Strong signals.** Recognises Huffman quickly and explains why, not just names it; asks how ties and new ids interact. **Red flags.** "Merge the largest first to reduce the count fastest"; claiming the capped greedy is optimal without an argument.
