# Hugging Face · Loop 1 — evaluator notes

Reference solutions and scoring guidance for `loop1.md`. Every scenario is a simulated
practice exercise; the rules it states (download counting, gating modes, conversion,
retention) are the exercise's own, not any hub's.

## HGF-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH counted AS (                     -- the rule's grain: one row per (model, client, UTC day)
  SELECT DISTINCT r.model_id, r.client_id,
         (r.requested_at AT TIME ZONE 'UTC')::date AS day
  FROM file_requests r
  JOIN models m        ON m.model_id = r.model_id
  JOIN counted_files f ON f.library = m.library AND f.path = r.path
  WHERE r.http_status < 400
    AND NOT EXISTS (                  -- excluded only on the days the mirror is listed
      SELECT 1
      FROM mirror_clients mc
      WHERE mc.client_id = r.client_id
        AND (r.requested_at AT TIME ZONE 'UTC')::date >= mc.listed_from
        AND (mc.listed_until IS NULL
             OR (r.requested_at AT TIME ZONE 'UTC')::date < mc.listed_until)
    )
)
SELECT date_trunc('week', day)::date AS week_start,
       model_id,
       COUNT(*)                  AS downloads,
       COUNT(DISTINCT client_id) AS distinct_clients
FROM counted
GROUP BY 1, model_id
ORDER BY week_start, model_id;
```

**Explanation.** The rule defines a download as a (model, client, UTC day) with at least one qualifying request, so the query reduces the log to exactly that grain with `DISTINCT` and only then rolls up to weeks. A request qualifies when its path is a designated file of the model's library (a join on both library and path, so `config.json` counts for one library and not another), its status is below 400, and its client is not a mirror listed on that day. The listing is a date range, so it lives inside `NOT EXISTS` with the request's day; a plain anti-join on `client_id` would drop a mirror's requests from before or after its listing. `downloads` counts (client, day) pairs per week; `distinct_clients` counts clients, which is smaller whenever a client downloads on several days.

**Complexity.** One scan of the request log with hash joins to two small tables, a hash aggregate for the `DISTINCT`, and a second small aggregate. In production the daily (model, client) set is the expensive part: it is a per-day distinct over billions of rows, usually materialised once per day and then rolled up.

**Dialect notes** (described, not executed). BigQuery: `DATE(requested_at)` is UTC; `DATE_TRUNC(day, WEEK(MONDAY))`, because BigQuery's default week starts on Sunday. Snowflake: `DATE_TRUNC('week', …)` follows the `WEEK_START` parameter (default Monday under the default policy; check the account setting); `TO_DATE(CONVERT_TIMEZONE('UTC', requested_at))`. Spark SQL: `date_trunc('week', …)` starts on Monday; `to_date` uses the session time zone, so set it to UTC. MySQL 8: no `date_trunc`; use `requested_at - INTERVAL WEEKDAY(requested_at) DAY` on the date, with the session time zone set to UTC.

**Edge cases built into the data.** The same client fetching designated files several times in one day (including a 304); a mirror pulling every model; a failed fetch of a designated file and a successful fetch of a non-designated file. Hard: several designated files per library (two on one day are one download), look-alike paths such as `onnx/config.json`, the same client at 23:59:59 and 00:00:00 inside a week, and across Sunday to Monday. Very Hard: mirror listings that start and end inside the period, with requests on the day before, the first day, the last listed day and the `listed_until` day.

**Common mistakes.** Counting requests instead of (client, day) pairs; deduplicating per week (one per client per week); matching paths with `LIKE '%config.json'`; ignoring the library when matching designated files; counting 4xx/5xx; excluding a mirror on every day, or treating `listed_until` as inclusive; weeks starting on Sunday; using the server's local time zone.

**Follow-up guidance.** (1) Library changes should not rewrite history silently: either version the counting rule and the model's library by date and count each day under the values valid then, or recompute and publish the restatement with a note. (2) Restate only the weeks in which the listing change falls; keep published values and corrections as separate versions so a chart can say "revised on". (3) Keep raw requests briefly (days, for restatements and audits), the daily (model, client, day) set longer, and the daily counts forever; the daily set is what makes restatements possible without the raw log. (4) A proxy is one client, so it counts once a day; that is the rule working as written. Changing it needs a signal the log does not have, and over-counting is the larger risk; a strong answer says so and does not invent a correction.

**Rubric anchors.** 2: counts requests or per-week clients, or applies the mirror list to every day. 3: matches the expected result. 4: also explains the daily grain as the unit of restatement and how the pipeline stores it at scale.

**Strong signals.** Restates the counting rule as a grain before writing SQL; notices that designated files depend on the library; treats the listing as a date range. **Red flags.** Presenting the exercise's rule as how a real hub counts; suffix matching on paths.

## HGF-L1-02

**Reference solution** (PostgreSQL; the cutoff is the instance's value)

```sql reference
WITH req AS (                         -- only what existed before the cutoff
  SELECT request_id, repo_id, requested_at
  FROM access_requests
  WHERE requested_at < TIMESTAMPTZ '{{as_of}}'
), dec AS (
  SELECT request_id, decision, decided_at,
         ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY decided_at, decision_id)           AS first_n,
         ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY decided_at DESC, decision_id DESC) AS last_n
  FROM access_decisions
  WHERE decided_at < TIMESTAMPTZ '{{as_of}}'
), per_request AS (
  SELECT r.repo_id, g.approval_mode,
         f.decided_at - r.requested_at AS wait,      -- NULL while pending
         l.decision                    AS outcome    -- NULL while pending
  FROM req r
  JOIN gated_repos g ON g.repo_id = r.repo_id
  LEFT JOIN dec f ON f.request_id = r.request_id AND f.first_n = 1
  LEFT JOIN dec l ON l.request_id = r.request_id AND l.last_n = 1
)
SELECT repo_id, approval_mode,
       COUNT(*)                                       AS requests,
       COUNT(*) FILTER (WHERE outcome = 'accepted')   AS accepted,
       COUNT(*) FILTER (WHERE outcome = 'rejected')   AS rejected,
       COUNT(*) FILTER (WHERE outcome IS NULL)        AS pending,
       CASE WHEN approval_mode = 'manual' THEN
         ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM wait) / 3600))::numeric, 2)
       END                                            AS median_hours_to_decision
FROM per_request
GROUP BY repo_id, approval_mode
ORDER BY approval_mode, repo_id;
```

**Explanation.** The cutoff is applied to both tables first, so a request or decision at or after it does not exist for the report; a decision after the cutoff leaves its request pending, and a reversal after the cutoff leaves the earlier outcome. Two `ROW_NUMBER`s pick each request's first decision (which ends the wait) and its latest (which is the outcome), with `decision_id` making ties deterministic. LEFT JOINs keep pending requests, whose wait and outcome are NULL: they are counted by `outcome IS NULL` and ignored by `PERCENTILE_CONT`, which skips NULLs. The `CASE` reports auto repos apart, with counts but no median.

**Complexity.** One sort of decisions per request for the two window functions (small partitions), joins on `request_id`, and a group-by with an ordered-set aggregate per repo: O(n log n) overall. The percentile needs each repo's waits sorted, which is cheap per repo.

**Dialect notes** (described, not executed). BigQuery: `PERCENTILE_CONT(x, 0.5) OVER (PARTITION BY repo_id)` is analytic only, so compute it in a subquery and take one value per repo, or use `APPROX_QUANTILES` (approximate); `TIMESTAMP_DIFF(…, SECOND) / 3600`. Snowflake: `MEDIAN()` or `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY …)`, `DATEDIFF('second', …)`; `QUALIFY` for first/latest. Spark SQL: `percentile(wait_hours, 0.5)` (exact, interpolating) or `percentile_approx`. MySQL 8: no percentile function; rank the waits with `ROW_NUMBER` and `COUNT(*) OVER` and average the middle one or two.

**Edge cases built into the data.** Manual and auto repos interleaved alphabetically; pending requests; a manual repo with an even number of decided requests. Hard: decisions reversed later (wait to the first, outcome from the latest), including a quick rejection reversed days later, and a manual repo whose every request is pending (median NULL, `pending` equal to `requests`). Very Hard: the cutoff inside the data: a decision exactly at the cutoff (still pending), a decision before the cutoff reversed after it (outcome is the earlier one), and requests at and after the cutoff (not counted).

**Common mistakes.** An inner join to decisions (pending requests disappear); the latest decision used for the wait, or the first for the outcome; including auto repos in the median, or dropping them entirely; counting pending requests as a wait up to the cutoff; `<=` at the cutoff; `now()` instead of the fixed cutoff; mean instead of median; `PERCENTILE_DISC`.

**Follow-up guidance.** (1) Report open requests by their age so far (count and oldest age, or the share older than a day), or a survival estimate that treats them as censored; never mix them into the median of completed waits. (2) A withdrawal is a third terminal outcome; it ends the request without a decision, so it leaves `pending`, does not enter the median, and gets its own count. (3) Duplicated decisions do not change "first" or "latest" times, but a duplicate with a different id and the same timestamp can flip the tie-break; a uniqueness constraint on (request_id, decision, decided_at) or deduplicating on load protects it. (4) Pending requests of a past week can still be decided, so last week's numbers change; store the report as dated snapshots (as of each run) or report by decision week as well as by request week.

**Rubric anchors.** 2: loses pending requests or uses one decision for both wait and outcome. 3: matches the expected result. 4: also explains censoring of open requests and how the report changes as decisions arrive.

**Strong signals.** Asks how reversals and the cutoff work before writing SQL; keeps the wait and the outcome as two different questions. **Red flags.** Treating the auto repos' near-zero waits as maintainers being fast; drawing any conclusion about a repo's licence from the report.

## HGF-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH RECURSIVE edges AS (             -- base -> derivative, self-declarations dropped
  SELECT DISTINCT base_model_id AS parent, model_id AS child
  FROM model_bases
  WHERE base_model_id <> model_id
), closure (ancestor, descendant) AS (
  SELECT parent, child FROM edges
  UNION                               -- UNION, not UNION ALL: pairs seen before stop here
  SELECT c.ancestor, e.child
  FROM closure c
  JOIN edges e ON e.parent = c.descendant
), counted AS (
  SELECT c.ancestor, c.descendant, m.base_relation
  FROM closure c
  JOIN models m ON m.model_id = c.descendant
  WHERE c.ancestor <> c.descendant                 -- a cycle never makes a model its own derivative
    AND c.ancestor IN (SELECT model_id FROM models)
)
SELECT ancestor AS model_id,
       (SELECT COUNT(*) FROM edges e WHERE e.parent = counted.ancestor) AS direct_derivatives,
       COUNT(*)                                            AS descendants,
       COUNT(*) FILTER (WHERE base_relation = 'finetune')  AS finetunes,
       COUNT(*) FILTER (WHERE base_relation = 'adapter')   AS adapters,
       COUNT(*) FILTER (WHERE base_relation = 'quantized') AS quantized,
       COUNT(*) FILTER (WHERE base_relation = 'merge')     AS merges
FROM counted
GROUP BY ancestor
ORDER BY descendants DESC, model_id;
```

**Explanation.** The closure is a set of (ancestor, descendant) pairs. The anchor is every declaration (minus self-declarations); each step extends a pair by one declaration. In PostgreSQL a recursive `UNION` discards rows already in the result, so each pair is produced once: a merge reachable by two paths is one pair, and a cycle stops as soon as it would only produce pairs already seen, so the query terminates on any input. Pairs where a cycle led back to the ancestor are dropped before counting. Relations are the descendant's own; ancestors that are not in `models` (bases not on the hub) get no row, but their derivatives are still reached from their other ancestors.

**Complexity.** The closure has one row per (ancestor, descendant) pair, which is O(n²) in the worst case (a long chain) and is the real cost: every iteration joins the newest pairs to the edges and checks them against everything produced so far. Fine for a panel computed offline over a hub, too heavy per page view for a very large family; see follow-up 1.

**Dialect notes** (described, not executed). PostgreSQL 14+ also offers `CYCLE model_id SET is_cycle USING path`, which marks and stops cyclic paths but still enumerates paths, not pairs. BigQuery supports `WITH RECURSIVE` with `UNION ALL` only, so cycles need an explicit path check; Spark SQL's support for recursive CTEs depends on the version (check current docs), and closures there are often computed by iterated joins or a graph library. Snowflake supports `WITH RECURSIVE` and `CONNECT BY` with `NOCYCLE`; `UNION ALL` is required there, so cycles need an explicit path check. MySQL 8: recursive CTEs with `UNION DISTINCT` deduplicate like PostgreSQL; watch `cte_max_recursion_depth`.

**Edge cases built into the data.** A forest of fine-tunes, adapters and quantised copies several levels deep. Hard: merges with two or three bases, including a guaranteed diamond (two derivatives of one model merged), a declared base that is not on the hub, and a model that lists itself. Very Hard: declarations that close cycles, so models on a loop are each other's descendants.

**Common mistakes.** `UNION ALL` (duplicates through diamonds; never terminates on a cycle); counting paths instead of models; counting the model itself when a cycle or a self-declaration leads back; classifying by the relation of the first hop or of the ancestor; reporting bases not in `models`; counting only direct derivatives; a fixed depth limit.

**Follow-up guidance.** (1) Across a hub the closure can be large (a deep chain of n models alone has n(n−1)/2 pairs); store it when panels are read far more often than cards change, keyed by ancestor, or store per-model counts only. (2) Changing one declaration affects the pairs between the old and new base's ancestors and the model's descendants; incremental maintenance deletes and re-derives those (the classic approach for transitive closure), or simply recomputes the affected family. (3) Track the minimum depth per pair (`MIN(depth)` grouped after a path-limited recursion, or a breadth-first iteration that only adds pairs not yet seen, which yields shortest depths); cycles make "depth" ambiguous unless it is the shortest. (4) Flag cycles (pairs with `ancestor = descendant`), bases whose creation date is after the derivative's, and bases not on the hub; show them to the card's owner, never as an accusation.

**Rubric anchors.** 2: a recursive CTE that works on trees but double-counts diamonds or loops on cycles. 3: matches the expected result. 4: also reasons about closure size, incremental maintenance and cleaning user-supplied metadata.

**Strong signals.** Asks whether declarations can be wrong before writing the recursion; explains why `UNION` terminates. **Red flags.** Assuming user-supplied metadata forms a tree; a hard-coded depth.

## HGF-L1-04

**Reference solution**

```python reference
from bisect import bisect_right


def locate_pages(shard_rows, requests):
    known = []                       # shards whose global position is known
    complete = True
    for n in shard_rows:
        if n is None:                # rows at or beyond an unconverted shard are unknown
            complete = False
            break
        known.append(n)
    shard_ids, starts, total = [], [], 0
    for i, n in enumerate(known):    # empty shards hold no row, so they are never located
        if n > 0:
            shard_ids.append(i)
            starts.append(total)
            total += n
    out = []
    for offset, length in requests:
        end = offset + length
        if end > total:
            if not complete:
                out.append(None)
                continue
            end = total
        segs = []
        if offset < end:
            k = bisect_right(starts, offset) - 1
            pos = offset
            while pos < end:
                i, s0 = shard_ids[k], starts[k]
                take = min(end, s0 + known[i]) - pos
                segs.append((i, pos - s0, take))
                pos += take
                k += 1
        out.append(segs)
    return out
```

**Explanation.** Only the shards before the first `None` have known positions, so the reference keeps that prefix and remembers whether the dataset is complete. It lists the start row of each non-empty shard; because empty shards are left out, the starts are strictly increasing and `bisect_right(starts, offset) − 1` is the one shard that holds row `offset` (an offset equal to a start lands on that shard, row 0). From there it walks forward only over the shards the page touches. A page that needs rows past the known total returns `None` when the dataset is incomplete, and is cut at the end otherwise; a page starting at or past the end becomes `[]`.

**Complexity.** O(s) to build the starts, O(log s + k) per request for k segments: O(s + q log s + output) in total, O(s) memory. The timing test (30 000 shards, 80 000 requests) runs in about 0.1 s in CPython; walking the shards from the first for each request, even with an early stop, took about 12 s.

**Dialect notes.** Java: `Arrays.binarySearch` on a `long[]` of starts (convert a negative result with `-(r) - 2`); row counts must be `long` once a dataset passes 2³¹ rows. C++: `std::upper_bound(starts.begin(), starts.end(), offset) - 1`. Scala: `java.util.Arrays.binarySearch` likewise, or `Searching.search`. Not executed here.

**Edge cases built into the tests.** A page ending exactly at a shard boundary (no empty next segment), one starting exactly at a boundary, one crossing a boundary, one cut at the end, offsets equal to and beyond the total (`[]`), a page covering everything. Hard: empty shards at the start, in the middle and at the end; a dataset whose shards are all empty; a page spanning several one-row shards with an empty one among them. Very Hard: a page ending exactly at the last converted row (known), one row beyond it (`None`), converted shards after an unconverted one (unusable), and an unconverted first shard.

**Common mistakes.** Walking the shards per request; `bisect_left` without handling exact starts; emitting zero-row segments for empty shards or at boundaries; returning `None` past the end of a complete dataset, or `[]` for unknown rows; serving shards that come after an unconverted one; serving a partial page when some of it is unknown; expanding rows into a list.

**Follow-up guidance.** (1) Appending a converted shard appends one start, O(1); reconverting an earlier shard with a new row count shifts every later start: either rebuild (O(s), fine for thousands of shards) or keep a Fenwick tree of row counts for O(log s) updates and searches. (2) "The next 100 matching rows" needs per-shard counts of matching rows (or an index) to bisect on; without them it degenerates to scanning, so a strong answer proposes precomputed per-shard filter counts for common filters, or cursors that remember where the last page ended. (3) The start list is metadata of a dataset revision: tiny (8 bytes per shard, so 8 MB for a million shards), stored next to the shards and cached by revision. (4) One bisect, then a ranged read of one or two shards; a columnar shard format with row groups lets the server read only the rows it needs.

**Rubric anchors.** 2: a correct per-request walk, or bisect with boundary errors. 3: all tests pass with prefix starts and binary search. 4: also handles incremental conversion (Fenwick tree or append-only starts) and discusses filtered paging.

**Strong signals.** Asks what happens at boundaries and with empty shards before coding; separates "unknown" from "past the end". **Red flags.** Building a row-to-shard array; returning a partial page when part of it is unknown without saying so.

## HGF-L1-05

**Reference solution**

```python reference
def reclaimable(commits, refs, deleted, store, pinned):
    graph = {cid: (parents, oids) for cid, parents, oids in commits}
    gone = set(deleted)
    stack = [c for name, c in refs.items() if name not in gone]
    seen = set()
    keep = set(pinned)
    while stack:                       # one iterative mark pass over the history
        c = stack.pop()
        if c in seen or c not in graph:
            continue
        seen.add(c)
        parents, oids = graph[c]
        keep.update(oids)
        stack.extend(parents)
    n = size = 0
    for oid, b in store.items():       # sweep: whatever was not marked is reclaimable
        if oid not in keep:
            n += 1
            size += b
    return (n, size)
```

**Explanation.** Mark and sweep. The mark phase starts from every remaining ref and walks parents with an explicit stack and one `seen` set shared by all refs, so each commit is visited once however many refs reach it; unknown ids (pruned history, a ref to a missing commit) are skipped. Every object a visited commit wrote is kept, along with `pinned`. The key observation is that no commit's file tree is needed: an object in any reachable snapshot was written by some commit in that snapshot's history, and that commit is reachable too, so "written by a reachable commit" is exactly "present in some reachable snapshot". The sweep sums the sizes of store objects that were not marked, which includes orphan uploads and ignores ids the store does not hold.

**Complexity.** O(C + P + F) time and O(C + F) memory for C commits, P parent links and F object references. The timing test (150 000 commits on long chains, about 150 000 objects, 1 000 refs spread across the history) runs in about 0.3 s in CPython. A search per object is O(F·C) and does not finish; a search per ref without a shared `seen` set took about 17–23 s, because each of the roughly 500 remaining refs re-walks tens of thousands of shared commits; a recursive walk raises `RecursionError` on the 150 000-commit chain.

**Dialect notes.** Java: `ArrayDeque<String>` as the stack and `HashSet`s; C++: `std::vector` stack and `unordered_set`. In SQL the mark phase is a recursive CTE over a commit-parent table (`UNION` to deduplicate), then an anti-join of the store against the marked objects; at hub scale it is a distributed graph traversal (iterated joins in Spark) followed by an anti-join. Not executed here.

**Edge cases built into the tests.** Deleting the only branch frees everything; an object written early and still in the history of a later commit; a tag keeping a commit no branch reaches; deleting a side branch frees only what it alone wrote; an orphan upload; an object named by a commit but missing from the store. Hard: a merge whose second parent's history is kept; the same object written on two branches; deleting a name that does not exist. Very Hard: a pinned object no ref reaches, a parent missing from the history, a ref pointing at a missing commit.

**Common mistakes.** A recursive DFS; a `seen` set per ref; following only the first parent of merges; treating a deleted file as freeing its object; building per-commit snapshots; raising `KeyError` on unknown commits or deleted names; counting objects the store does not hold; forgetting orphan uploads or `pinned`.

**Follow-up guidance.** (1) Forks sharing a store need the union of all repos' marks, or a reference count per object across repos (incremented when any repo's reachable set gains it); deleting a fork frees only objects whose count drops to zero. (2) Attribution is not additive: bytes freed only when two branches are both deleted belong to neither alone; a fair answer reports "freed by deleting this branch alone" and "freed only together" separately (marginal versus joint). (3) Partition commits by repository (most repos are independent), run the marking per repo in parallel, and treat the store as a key-value set; protect concurrent pushes by marking new uploads at upload time and only sweeping objects older than a grace period, re-checking before deletion. (4) A grace period covers in-flight pushes, open pull requests and recovery from mistaken deletions; the estimate should say "freed after the grace period" and may be revised if a ref is restored.

**Rubric anchors.** 2: correct small cases with a recursive walk or a search per object or per ref. 3: all tests pass with one iterative mark pass. 4: also explains why snapshots are unnecessary and discusses shared stores, attribution and safe sweeping.

**Strong signals.** Recognises mark-and-sweep immediately; asks what "deleted" does to history before coding; mentions recursion depth unprompted. **Red flags.** Claiming a file deletion frees storage; deleting objects that a fork or an open pull request may still need without a grace period.
