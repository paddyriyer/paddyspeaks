# Anthropic · Loop 1 — evaluator notes (hidden from candidates)

## ANT-L1-01

**Reference solution** (PostgreSQL; `{{day}}` and `{{min_requests}}` are the instance's values)

```sql reference
WITH day_usage AS (
  SELECT COALESCE(k.workspace_id, 'default') AS workspace_id, u.model,
         u.input_tokens AS inp, u.cache_creation_5m_tokens AS w5, u.cache_creation_1h_tokens AS w1,
         u.cache_read_input_tokens AS rd, u.output_tokens AS outp
  FROM messages_usage u
  JOIN api_keys k ON k.api_key_id = u.api_key_id
  WHERE u.created_at >= DATE '{{day}}'
    AND u.created_at <  DATE '{{day}}' + 1
), g AS (
  SELECT workspace_id, model, COUNT(*) AS requests,
         SUM(inp) AS inp, SUM(w5) AS w5, SUM(w1) AS w1, SUM(rd) AS rd, SUM(outp) AS outp
  FROM day_usage
  GROUP BY workspace_id, model
  HAVING COUNT(*) >= {{min_requests}}
), costed AS (
  SELECT g.*, g.inp + g.w5 + g.w1 + g.rd AS prompt_tokens,
         (g.inp * p.input_usd_per_mtok
          + g.w5 * p.input_usd_per_mtok * 1.25
          + g.w1 * p.input_usd_per_mtok * 2
          + g.rd * p.input_usd_per_mtok * 0.1
          + g.outp * p.output_usd_per_mtok) / 1000000 AS actual,
         ((g.inp + g.w5 + g.w1 + g.rd) * p.input_usd_per_mtok
          + g.outp * p.output_usd_per_mtok) / 1000000 AS uncached
  FROM g JOIN model_prices p ON p.model = g.model
)
SELECT workspace_id, model, requests, prompt_tokens,
       ROUND(rd::numeric / prompt_tokens, 4) AS cache_read_share,
       ROUND(actual, 4)            AS actual_cost_usd,
       ROUND(uncached, 4)          AS uncached_cost_usd,
       ROUND(uncached - actual, 4) AS net_savings_usd
FROM costed
ORDER BY net_savings_usd, workspace_id, model;
```

**Explanation.** Attribute each request to its key's workspace (`COALESCE(workspace_id, 'default')` at the Very Hard level, where some keys have none), keep the half-open UTC day, aggregate token classes per `(workspace, model)` and apply the minimum in `HAVING`. Prices are per model, so cost is linear in the sums: join the price once per group. The actual cost weights each class (input 1, 5-minute write 1.25, 1-hour write 2, read 0.1, all × input price; output × output price); the uncached cost bills every prompt token at the input price. Both are `numeric` because the prices are `NUMERIC(8,2)` and the multipliers are numeric literals, so nothing is rounded until the final `ROUND(…, 4)`; the saving is rounded from the unrounded difference. Ordering by the rounded alias is deterministic because workspace and model break ties.

**Complexity.** One scan of the day's usage (a range predicate on `created_at`, so a partitioned or clustered table prunes to one day), a hash join to the small keys table and a hash aggregate. The price join touches one row per group.

**Dialect notes** (described, not executed). Snowflake: `NUMBER` arithmetic is exact, but dividing two integers returns a scaled decimal, so state the scale with `ROUND` or `DIV0`; the day filter is the same. BigQuery: `INT64 * NUMERIC` is `NUMERIC`; `ROUND(x, 4)` rounds half away from zero, as here; use `SAFE_DIVIDE` for the share. Spark SQL: `1.25` is a decimal literal and decimal arithmetic stays exact, but results that exceed decimal precision can lose scale (`spark.sql.decimalOperations.allowPrecisionLoss`), so round explicitly; `count_if` replaces `FILTER`. MySQL 8: `DECIMAL` arithmetic is exact; there is no `FILTER`, so use `SUM(CASE …)`.

**Edge cases built into the data.** A write-heavy group whose saving is negative (every level); a group with exactly the minimum and one with one fewer; a group with no caching (saving exactly 0); two keys per workspace (Hard and Very Hard); 1-hour writes (Hard and Very Hard); rows at 00:00:00 of the day (in), 23:59:59 the day before and 00:00:00 the next day (out); keys with no workspace (Very Hard).

**Common mistakes.** Pricing reads at the input price, or as free; computing the uncached cost from `input_tokens` only; dividing the share by `input_tokens`; `>` for the minimum; grouping by API key; `created_at::date = …` is right but `BETWEEN day AND day + 1` is not; dropping keys without a workspace with an inner join to a workspaces table or a `WHERE workspace_id IS NOT NULL`; float casts.

**Follow-up guidance.** (1) Every token and cost column is additive, so monthly rows are sums of daily rows; `cache_read_share` is not (recompute it from summed tokens), and the per-group minimum must be re-applied at the new grain. (2) Writes with no later reads (prefix changes every request, for example a timestamp near the top of the prompt); reads after the lifetime expired, so the same prefix is written again and again (requests further apart than the cache duration); a cached prefix that is short relative to the rest of the prompt. Distinguish them with writes per request over time and the gap between consecutive requests per workspace. (3) A longer duration pays when the extra write cost is less than the re-writes it avoids: count, per workspace, how often the same prefix is written again within the longer window. (4) Upsert a daily table keyed by `(day, workspace, model)` from late-arriving usage, mark days final after a lateness bound, and post restatements as adjusting rows.

**Rubric anchors.** 2: right shape but one pricing rule wrong (reads, 1-hour writes, uncached denominator), or the boundary rows. 3: matches the expected result. 4: also explains why caching can lose money and how to tell the causes apart.

**Strong signals.** Asks how a cache read is priced in the uncached scenario before writing SQL; keeps money in `numeric`; notices that output tokens cancel out. **Red flags.** "Cache reads are free"; summing rounded per-request costs; averaging `cache_read_share` across groups.

## ANT-L1-02

**Reference solution** (PostgreSQL; `{{ttft_ms}}` and `{{gap_ms}}` are the instance's thresholds)

```sql reference
WITH deltas AS (
  SELECT e.request_id, e.seq, e.event_ts,
         e.event_ts - LAG(e.event_ts) OVER (PARTITION BY e.request_id ORDER BY e.seq) AS gap
  FROM stream_events e
  WHERE e.event_type = 'content_block_delta'
), per_request AS (
  SELECT q.request_id, q.model, q.started_at,
         (SELECT MIN(d.event_ts) FROM deltas d WHERE d.request_id = q.request_id) AS first_delta_ts,
         (SELECT MAX(d.gap) FROM deltas d WHERE d.request_id = q.request_id) AS max_gap,
         (SELECT COUNT(*) FROM deltas d WHERE d.request_id = q.request_id) AS deltas,
         EXISTS (SELECT 1 FROM stream_events s WHERE s.request_id = q.request_id AND s.event_type = 'message_stop') AS stopped,
         EXISTS (SELECT 1 FROM stream_events s WHERE s.request_id = q.request_id AND s.event_type = 'error') AS errored
  FROM stream_requests q
), measured AS (
  SELECT request_id, model,
         (EXTRACT(EPOCH FROM first_delta_ts - started_at) * 1000)::bigint AS ttft_ms,
         (EXTRACT(EPOCH FROM max_gap) * 1000)::bigint AS max_gap_ms,
         deltas,
         CASE WHEN stopped THEN 'completed' WHEN errored THEN 'error' ELSE 'truncated' END AS outcome
  FROM per_request
)
SELECT request_id, model, ttft_ms, max_gap_ms, deltas, outcome
FROM measured
WHERE outcome <> 'completed' OR ttft_ms > {{ttft_ms}} OR max_gap_ms > {{gap_ms}}
ORDER BY request_id;
```

**Explanation.** The deltas CTE filters to `content_block_delta` before the window function, so `LAG` compares each piece of text with the previous piece of text; pings, block starts and message events can never split a silence. `MAX(gap)` ignores the NULL of the first delta, so one delta gives NULL. TTFT is the first delta's time minus `started_at`. The per-request values are taken from `stream_requests` outward (correlated subqueries here; a LEFT JOIN to a grouped CTE is equivalent), so requests with no deltas, or no events at all, stay in. The outcome is a three-way CASE in priority order. The WHERE clause is NULL-aware by construction: a NULL TTFT or gap makes its comparison NULL, which is not true, so only the outcome can flag such a request. Milliseconds come from `EXTRACT(EPOCH FROM interval) * 1000`, exact in `numeric` in PostgreSQL 14 and later, then cast to `bigint`.

**Complexity.** One sort of the deltas by `(request_id, seq)` for the window (the primary key provides it), then per-request aggregates: O(n log n), or O(n) with the index order. A production version groups once per request instead of four correlated lookups.

**Dialect notes** (described, not executed). Snowflake: `TIMESTAMPDIFF(millisecond, a, b)`, `BOOLOR_AGG` for the outcome flags, `QUALIFY` if you take the first delta by `seq` with a window. BigQuery: `TIMESTAMP_DIFF(b, a, MILLISECOND)`; `LOGICAL_OR`. Spark SQL: `unix_millis(b) - unix_millis(a)`; windowed `lag` works the same; no `FILTER`, use `max(case …)`. MySQL 8: `TIMESTAMPDIFF(MICROSECOND, a, b) DIV 1000`, and `LAG` over a derived table of deltas.

**Edge cases built into the data.** Pings inside every stall and before the first delta (every level); a slow first token; a stall over the gap threshold; events sharing a millisecond, values exactly at each threshold, and streams ended by an `error` event (Hard and Very Hard); an error before any delta, a stream that stops with neither `message_stop` nor `error`, a completed single-delta stream that must not be flagged, a slow single-delta stream, a request with no events, and events stored out of order (Very Hard).

**Common mistakes.** LAG over all events and filtering afterwards (pings hide the stall); measuring TTFT from `message_start`; ordering by `event_ts` without `seq` (harmless for gaps, but a smell); `>=`; treating a NULL gap as 0 or as a problem; inner joins that lose requests without events; labelling every unfinished stream `'error'`; returning seconds or an interval instead of integer milliseconds.

**Follow-up guidance.** (1) Per open request keep `started_at`, last delta time, max gap, count and flags; emit when `message_stop` or `error` arrives, or when a request has been silent past a hard timeout (then it is truncated). (2) Percentiles are not additive; keep a mergeable histogram or sketch (fixed buckets, t-digest, DDSketch) per model and hour and merge for longer ranges. (3) Compare gaps with output position and output length per model; network problems correlate with client region or connection and appear across models, generation effects with long outputs on one model. (4) Ratios and per-stream distributions are unbiased under uniform sampling; counts must be scaled by 100 and rare events (a 0.01% stall type) get wide confidence intervals.

**Rubric anchors.** 2: TTFT right, but the gap is computed over all events or the outcomes are wrong. 3: matches the expected result. 4: also designs the streaming version with bounded state and explains percentile merging.

**Strong signals.** Asks whether pings count before writing SQL; checks the single-delta and no-event cases unprompted. **Red flags.** "Use the max time minus min time"; gaps from `ROW_NUMBER` self-joins without `seq`; flagging NULLs by `COALESCE(…, 0)` without saying why.

## ANT-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH attempts AS (
  SELECT b.job_id, q.custom_id, b.batch_id, b.created_at, b.processing_status,
         r.result_type, r.output_tokens,
         ROW_NUMBER() OVER (PARTITION BY b.job_id, q.custom_id
                            ORDER BY b.created_at DESC, b.batch_id DESC) AS recency
  FROM batch_requests q
  JOIN batches b ON b.batch_id = q.batch_id
  LEFT JOIN batch_results r ON r.batch_id = q.batch_id AND r.custom_id = q.custom_id
), items AS (
  SELECT job_id, custom_id,
         COALESCE(BOOL_OR(result_type = 'succeeded'), false)                  AS ever_succeeded,
         MAX(processing_status) FILTER (WHERE recency = 1)                     AS latest_status,
         BOOL_OR(result_type IS NOT NULL) FILTER (WHERE recency = 1)           AS latest_has_result
  FROM attempts
  GROUP BY job_id, custom_id
), successes AS (
  SELECT job_id, custom_id, output_tokens,
         ROW_NUMBER() OVER (PARTITION BY job_id, custom_id ORDER BY created_at, batch_id) AS nth
  FROM attempts
  WHERE result_type = 'succeeded'
), dup AS (
  SELECT job_id, custom_id, COUNT(*) AS wins,
         COALESCE(SUM(output_tokens) FILTER (WHERE nth > 1), 0) AS wasted
  FROM successes
  GROUP BY job_id, custom_id
)
SELECT i.job_id,
       COUNT(*)                                                                         AS items,
       COUNT(*) FILTER (WHERE i.ever_succeeded)                                         AS succeeded,
       COUNT(*) FILTER (WHERE NOT i.ever_succeeded AND i.latest_status = 'ended' AND i.latest_has_result)     AS retry,
       COUNT(*) FILTER (WHERE NOT i.ever_succeeded AND i.latest_status = 'ended' AND NOT i.latest_has_result) AS missing,
       COUNT(*) FILTER (WHERE NOT i.ever_succeeded AND i.latest_status <> 'ended')     AS in_flight,
       COUNT(*) FILTER (WHERE d.wins > 1)                                               AS duplicate_successes,
       COALESCE(SUM(d.wasted), 0)                                                       AS wasted_output_tokens
FROM items i
LEFT JOIN dup d ON d.job_id = i.job_id AND d.custom_id = i.custom_id
GROUP BY i.job_id
ORDER BY i.job_id;
```

**Explanation.** One row per attempt: every `batch_requests` row with its batch and, through a LEFT JOIN, its result if one exists. `recency = 1` marks an item's latest attempt (by `created_at DESC, batch_id DESC`, so ties are deterministic). Reducing to one row per item gives `ever_succeeded` (any success at all, so a success followed by a failed resubmission is still succeeded), the latest attempt's batch status and whether it has a result. Those three facts classify each item into exactly one bucket. Successes are numbered by the same ascending order; every success after the first is wasted. Items join their duplicate summary with a LEFT JOIN so items with no duplicates stay.

**Complexity.** A sort of attempts by `(job_id, custom_id, created_at, batch_id)` for the windows, a hash join to results on `(batch_id, custom_id)` and two aggregations: O(n log n) in attempts. Incrementally, only items with an attempt in a newly ended batch change.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `QUALIFY ROW_NUMBER() OVER (…) = 1` for the latest attempt; `BOOLOR_AGG` / `LOGICAL_OR` for `BOOL_OR`; `COUNT_IF` / `COUNTIF` for `COUNT(*) FILTER`. Spark SQL: `bool_or` exists, `count_if` replaces `FILTER`. MySQL 8: no `BOOL_OR` or `FILTER`; use `MAX(result_type = 'succeeded')` and `SUM(CASE …)`.

**Edge cases built into the data.** Items failed and retried, and one failed item not yet resubmitted (every level); an item resubmitted after it had succeeded, and two batches created in the same second that both succeed for the same item, so `batch_id` decides which success is first and which tokens are wasted (Hard and Very Hard); an item that succeeded and then failed on a resubmission, an ended batch with no result for its item, and a batch still in progress (Very Hard).

**Common mistakes.** Counting request rows as items; classifying by the latest attempt only; an inner join to results (missing items vanish and `items` shrinks); treating in-progress items as missing; wasting the first success too; ordering successes by `created_at` alone; grouping items by `custom_id` across jobs.

**Follow-up guidance.** (1) Process batches that ended since a watermark; upsert an item-state table keyed by `(job_id, custom_id)` with `first_success_batch`, latest attempt and counts; recompute only touched items. (2) Resubmit only items whose state is not succeeded, from that state table, and record the resubmission before submitting; keep `custom_id` stable per item so results map back. (3) Compare the batch's own result counts (the API reports counts per result type when a batch ends) with rows exported per batch; alert when an ended batch's exported results do not equal its request count. (4) Look at submission time and batch size against when results arrive, and at whether expirations are concentrated in specific jobs or models, before splitting batches.

**Rubric anchors.** 2: right totals at Medium but latest-attempt classification or row counts as items. 3: matches the expected result. 4: also designs idempotent resubmission and a completeness check.

**Strong signals.** Asks what wins between an early success and a later failure; notices that `items` must equal the sum of the buckets and uses it as a self-check. **Red flags.** `DISTINCT` sprinkled to hide fan-out; "missing results can't happen".

## ANT-L1-04

**Reference solution**

```python reference
def tool_call_stats(events, timeout_ms):
    calls = {}        # (conversation_id, tool_use_id) -> [tool, start_ts, resolved]
    per_tool = {}
    unmatched = 0
    spans = []        # (start, end) of every call, half-open
    for ts, conv, kind, tool_use_id, tool, is_error in events:
        key = (conv, tool_use_id)
        call = calls.get(key)
        if kind == 'use':
            if call is None:                      # a re-delivered use is ignored
                calls[key] = [tool, ts, False]
                per_tool.setdefault(tool, [0, 0, 0, 0])[0] += 1
            continue
        if call is None:                          # no earlier use for this key
            unmatched += 1
            continue
        if call[2]:                               # the call already has its result
            continue
        call[2] = True
        stats = per_tool[call[0]]
        if ts - call[1] > timeout_ms:             # it had already timed out
            stats[3] += 1
            spans.append((call[1], call[1] + timeout_ms))
        else:
            stats[2 if is_error else 1] += 1
            spans.append((call[1], ts))
    for tool, start, resolved in calls.values():
        if not resolved:                          # never answered
            per_tool[tool][3] += 1
            spans.append((start, start + timeout_ms))
    points = []
    for start, end in spans:
        if end > start:
            points.append((start, 1))
            points.append((end, -1))
    points.sort()                                 # at equal times, -1 sorts before +1
    peak = cur = 0
    for _, d in points:
        cur += d
        if cur > peak:
            peak = cur
    return per_tool, unmatched, peak
```

**Explanation.** One pass over the events with a dict keyed by `(conversation_id, tool_use_id)`: a `use` creates the call if the key is new (a re-delivered use is ignored); a `result` for an unknown key is unmatched; the first result for a known call resolves it (late ones become timeouts with an interval capped at the deadline) and later results are ignored. Calls that never resolve time out. The peak is a sweep over interval endpoints: `(t, +1)` and `(t, −1)`; Python sorts tuples so `−1` comes before `+1` at the same time, which is exactly the half-open rule. Empty intervals are skipped.

**Complexity.** O(n) for the pass and O(c log c) for sorting 2c endpoints, c ≤ n calls; O(n) memory. The naive versions are quadratic: scanning back through the log for each result's use, or counting overlaps for every pair of calls. With 200 000 events and hundreds of calls in flight both take far longer than the limit; the reference takes well under a second.

**Common mistakes.** `>=` for the timeout; counting a late result as unmatched or as ok; counting a second `use` as a new call; keying by `tool_use_id` alone (Very Hard has the same id in two conversations); sorting endpoints with `+1` first (adjacent calls overlap and the peak is one too high); forgetting calls without results in the sweep; counting a result that precedes its use as matched.

**Follow-up guidance.** (1) Keep open calls in a min-heap by deadline; at each event pop calls whose deadline has passed (they end at their deadline) and maintain the in-flight count; a result decrements immediately. A late result finds its call already expired and is ignored. (2) Keep one counter per tool and one overall in the same sweep; the overall peak is not the sum of per-tool peaks. (3) Durations near the timeout and zero-length calls change; key the order by one collector's clock or apply measured offsets, and treat results within the skew of the deadline as uncertain. (4) Results for unknown ids come from a use lost in transit, ids rewritten by a client, results sent to the wrong conversation, or clock skew putting a result before its use; join by id across conversations and by time to see which.

**Rubric anchors.** 2: correct counts but a quadratic peak or matching, or a boundary error. 3: correct and O(n log n). 4: also a streaming design with a deadline heap and an honest treatment of skew.

**Strong signals.** Asks what happens at equal timestamps before coding; explains the endpoint order. **Red flags.** A per-millisecond array over the whole time range; "duplicates never happen".

## ANT-L1-05

**Reference solution**

```python reference
def cache_accounting(requests, min_tokens=0):
    roots = {}                     # workspace_id -> trie node
    out = []
    for ts, workspace, segments, ttl_s in requests:
        node = roots.get(workspace)
        if node is None:
            node = roots[workspace] = [{}, None]      # [children by segment id, expires_at]
        cum = hit = last = 0
        path = []                                     # cacheable nodes on this prompt's path
        for seg_id, tokens in segments[:-1]:          # the last segment is never cached
            cum += tokens
            child = node[0].get(seg_id)
            if child is None:
                child = node[0][seg_id] = [{}, None]
            node = child
            if cum >= min_tokens:
                if node[1] is not None and node[1] > ts:
                    hit = cum                         # deepest live prefix so far
                path.append(node)
                last = cum
        total = cum + (segments[-1][1] if segments else 0)
        write = last - hit if last > hit else 0
        out.append((hit, write, total - hit - write))
        new_exp = ts + ttl_s
        for nd in path:
            if nd[1] is None or nd[1] < new_exp:
                nd[1] = new_exp
    return out
```

**Explanation.** A trie per workspace whose edges are segment ids: the node reached after k + 1 segments is the cache entry for prefix k, and it stores its expiry. Walking a prompt from the root costs O(1) per segment, so each request is O(m). Along the walk the code tracks cumulative tokens, the deepest cacheable node whose entry is live (`expires_at > ts`) and the deepest cacheable node; reads and writes follow from those two, and the last segment is never walked. Every cacheable node on the path is then refreshed to `max(current, ts + ttl_s)`, which is the plain refresh when TTLs are equal and never shortens a 1-hour entry. Because a request refreshes all of its prefixes together, a shorter prefix never expires before a longer one on the same path, but the walk does not rely on it.

**Complexity.** O(total segments) time; memory O(distinct prefixes), which is the size of the trie. A key built as `(workspace, tuple(ids[:k + 1]))` for every k costs O(k) to build and to hash, so O(m²) per request; on the timing test (prompts up to about 1 200 segments) that approach takes 11 to 20 seconds in CPython, against well under one second for the trie.

**Common mistakes.** Caching the last segment; `>=` for liveness; taking the first live prefix instead of the deepest; refreshing only the hit; applying the minimum to a single segment; sharing entries across workspaces; overwriting a 1-hour expiry with a 5-minute one; quadratic keys; nested tuples `(parent_key, seg)` as keys, which look O(1) but hash in O(depth) because tuple hashes are not cached.

**Follow-up guidance.** (1) The model assumes unlimited breakpoints, no capacity eviction, perfect prefix stability and no minimum on how often a prefix must be used to pay off; real savings are lower. (2) Put breakpoints where the prompt stops being shared: after the system prompt, after stable documents, after older turns that change rarely; use the trace to find prefixes with many reads per write. (3) Delete subtrees whose newest expiry has passed (keep a max-expiry per node, or a heap of expiries) since an expired node behaves like a missing one. (4) Price both durations per conversation with the measured gaps between its requests; the longer duration pays when gaps often exceed the short lifetime but not the long one.

**Rubric anchors.** 2: correct accounting but quadratic keys, or one rule wrong (last segment, boundary, refresh). 3: correct and linear per prompt. 4: also explains which simplifications bias the savings and how to prune state.

**Strong signals.** Sees the prefix-of-prefix structure and reaches for a trie or incremental keys unprompted; asks how liveness interacts with refresh. **Red flags.** Hashing the full prompt text per prefix; "the cache always hits after the first request".
