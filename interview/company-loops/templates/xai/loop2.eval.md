# xAI · Loop 2 — evaluator notes (hidden from candidates)

## XAI-L2-01

**Reference solution**

```python reference
def find_loops(traces, r, max_cycle):
    out = []
    for trace in traces:
        s = trace[::-1]                     # the loop is at the end: read the trace backwards
        n = len(s)
        z = [0] * n                         # z[p]: how far s agrees with itself shifted by p
        left = right = 0
        for i in range(1, n):
            k = 0
            if i < right:
                k = z[i - left]
                if k > right - i:
                    k = right - i
            while i + k < n and s[k] == s[i + k]:
                k += 1
            z[i] = k
            if i + k > right:
                left, right = i, i + k
        top = n // r
        if max_cycle is not None and max_cycle < top:
            top = max_cycle
        best_reach, best_p = 0, 0
        for p in range(1, top + 1):
            reach = p + z[p]                # calls at the end that repeat with period p
            if reach >= r * p and reach > best_reach:   # strict: ties keep the shorter cycle
                best_reach, best_p = reach, p
        out.append((best_p, n - best_reach, best_reach // best_p) if best_p else None)
    return out
```

**Explanation.** Reverse the trace, so the loop sits at the start of `s`. The last `L` calls of the trace have period `p` exactly when `s[i] == s[i + p]` for `i < L − p`, so the reach of `p` is `p + z[p]`, where `z[p]` is the longest common prefix of `s` and `s[p:]`: the Z-function. One O(n) pass computes `z` for every shift (the window `[left, right)` is the rightmost stretch already known to equal a prefix of `s`; inside it `z[i]` starts from `z[i − left]`, and only the part beyond `right` is compared, so `right` only moves forward). A second pass over `p ≤ min(n // r, max_cycle)` keeps the loop with the longest reach; the strict comparison makes the shorter cycle win a tie. `start = n − reach` and `copies = reach // p` follow.

**Complexity.** O(n) time and memory per trace. The timing test (four traces of 60 000 calls, the last 60 to 70 percent one loop of 2 to 5 calls) runs in about 0.07 to 0.09 s in CPython, plus about 0.03 s to build the data.

**The middle approach.** The likely middle answer tries every length `p`, walks back from the end comparing `trace[i]` with `trace[i + p]`, stops early once the length cannot reach `r` copies, and otherwise keeps walking to measure the reach. On a long loop of `q` calls every multiple of `q` up to `reach / r` is a loop whose walk runs to the start of the stretch, so the cost is about `reach² / (r · q)` per trace. Measured at about 10 to 11 s for one 60 000-call trace and **70 s on the timing test** (limit 8 s), about 1 000 times the reference: it fails. Walking every length to its full reach without the early exit is slower still. Two variants pass and are acceptable with an argument: skipping multiples of a loop already found (correct, because a multiple of a loop's length reaches exactly as far: the first mismatch for `q` is also a mismatch for `j · q`; measured at 0.04 s here, near-linear because few lengths that are not multiples can be loops), and the prefix function on the reversed trace (borders give periods; correct but fiddlier to turn into every length's reach). A third is fast but wrong: stopping at the **shortest** length that repeats `r` times. It passes the timing test, whose loops have no shorter loop inside them, and fails the checks where "open, open" ends a three-call loop.

**Dialect notes.** In SQL the reach of one fixed `p` is a gaps-and-islands query over `LAG(call_id, p)` per trace, numbered from the end; every `p` at once is a self-join of the trace with itself shifted, which is O(n²) rows. Stream processors would keep the last few hundred calls per response and test small `p` only (follow-up 2). In Java or C++ the same Z-function on an `int[]`, with the trace reversed in place or indexed from the end. Not executed here.

**Edge cases built into the tests.** A single call repeated; exactly `r` copies (a loop) and `r − 1` copies plus part of another (not); a stretch that begins part way through a cycle; a loop the trace broke out of with one different last call; no repeated calls, an empty trace, and a trace shorter than `r`; several traces in order; a one-call cycle repeated `r` times at the very end of a longer loop (the longer one is reported); a cycle and its multiples (the shorter wins). Hard adds a short inner run that does not hide the longer loop, and a longer cycle with only `r − 1` copies that loses to a one-call cycle with `r`. Very Hard adds the cap: a cycle longer than the cap is ignored even when it reaches further, a cycle exactly at the cap counts, and a cap of 1.

**Common mistakes.** Returning the shortest repeating cycle; measuring the period from the start of the trace instead of the end; counting the partial copy in `copies`; `reach ≥ r·p` written as `>` (exactly `r` copies must count); `>=` in the best-reach comparison, so a multiple overwrites the shorter cycle; applying the cap to the reach instead of the cycle length; an off-by-one in the Z-box (`z[i − left]` not capped at `right − i`); crashing on an empty trace.

**Follow-up guidance.** (1) Let the trace's last `L` calls have period `q`, with the call before them breaking it: `trace[n−L−1] ≠ trace[n−L−1+q]`. For `p = j·q ≤ L`, `trace[n−L−1+p]` equals `trace[n−L−1+q]` by period `q`, so the same call breaks period `p`: the reach is the same `L`. Skipping multiples then leaves few long walks (lengths that are loops without being multiples of a shorter loop are rare: O(log n) of them), so it is fast in practice; the Z-function is linear in the worst case. (2) Online: keep, per response, the last `r · max_cycle` calls and, at each new call, keep for every `p ≤ max_cycle` the length of the current run of calls equal to the call `p` before them; a loop of length `p` is complete when that run reaches `(r − 1) · p`. That is O(max_cycle) per call and flags the loop at the call that completes the `r`-th copy. Without a cap, online detection needs run-finding algorithms and is rarely worth it; a cap is the honest product answer. (3) Normalise in the stage that interns call ids (tool name plus canonicalised arguments, query text lowercased and stripped of whitespace, or a similarity bucket), versioned, so loop analytics and billing agree on what "the same call" is; fuzzy equality breaks the exact-period algorithms, so normalise before, not inside. (4) Per response: tool counts, the loop's `p`, `start`, `copies`, and wasted calls (`reach − p`), per team and day; never the queries or results themselves in the analytics tables.

**Rubric anchors.** 2: shortest repeating cycle, or a per-length scan that is quadratic. 3: all checks pass with the Z-function or an equivalent near-linear method. 4: also proves why multiples tie, explains the reversed-trace reduction cleanly, and gives a credible streaming design.

**Strong signals.** Asks why the shortest cycle is not the answer and draws the "open, open" case; reverses the trace before reaching for a string algorithm. **Red flags.** "Just compare the last two blocks for every length" with no cost estimate; a hash-only comparison with no plan for collisions.

## XAI-L2-02

**Reference solution**

```python reference
_MOD = (1 << 61) - 1
_BASE = 1_000_003


def _exact(response, source, length):
    first = {}
    for j in range(len(source) - length + 1):
        first.setdefault(tuple(source[j:j + length]), j)
    for i in range(len(response) - length + 1):
        j = first.get(tuple(response[i:i + length]))
        if j is not None:
            return i, j
    return None


def _earliest(response, source, length):
    """The smallest i, then j, with response[i:i+length] == source[j:j+length], or None."""
    if length > len(response) or length > len(source):
        return None
    top = pow(_BASE, length, _MOD)
    first = {}                              # hash of a source window -> its first position
    h = 0
    for j, w in enumerate(source):
        h = (h * _BASE + w + 1) % _MOD
        if j >= length:
            h = (h - (source[j - length] + 1) * top) % _MOD
        if j >= length - 1 and h not in first:
            first[h] = j - length + 1
    h = 0
    for i, w in enumerate(response):
        h = (h * _BASE + w + 1) % _MOD
        if i >= length:
            h = (h - (response[i - length] + 1) * top) % _MOD
        if i >= length - 1:
            j = first.get(h)
            if j is not None:
                a = i - length + 1
                if response[a:a + length] == source[j:j + length]:
                    return a, j             # verified word by word
                return _exact(response, source, length)   # a collision: decide this length exactly
    return None


def verbatim_overlap(response, sources):
    out = []
    for source in sources:
        best = (0, -1, -1)
        lo, hi = 1, min(len(response), len(source))
        while lo <= hi:                     # a shared run of length L implies every shorter one
            mid = (lo + hi) // 2
            hit = _earliest(response, source, mid)
            if hit:
                best = (mid, hit[0], hit[1])
                lo = mid + 1
            else:
                hi = mid - 1
        out.append(best)
    return out
```

**Explanation.** "Some run of length `L` is shared" is monotone in `L` (a shared run of length `L` contains shared runs of every shorter length), so the answer's length is found by binary search. For one length, a polynomial rolling hash over the source's windows keeps the first position per hash; sliding over the response from the left, the first window whose hash is present is verified word by word. Equal windows always have equal hashes, so no earlier response position can match, and the stored position is the earliest source window with that hash, hence the earliest with that content: the tie rule falls out. If a verification fails, two different windows collided; the length is then decided exactly with tuples, so a collision can cost time but never change the answer. The final `_earliest` call at the answer's length gives `(i, j)`.

**Complexity.** O((n + m) log min(n, m)) expected time, O(m) memory per length. The timing test (a 10 000-word response against 36 000 words in one source, or in three at Very Hard) runs in about 0.4 s in CPython. The two-row dynamic programme took **19 s** on the same data (limit 8 s, about 47 times slower); a C-speed variant that compares each diagonal with `map(operator.eq, …)` and `itertools.groupby` took **11.5 s**; both fail.

**The middle approach.** The two-row longest-common-substring table is the likely middle answer: correct, O(n·m) time, O(m) memory, 360 million cells here. It fails the timing test, as measured above. A suffix automaton of each source (O(m) states), with the response walked through it while tracking the current match length, is O(n + m) and fully acceptable if the candidate recovers the earliest `i` and `j` (keep each state's first end position, and take the first response position that reaches the final length). A suffix array of the concatenation with LCP is O((n + m) log) and also acceptable. Binary search with tuples of slices as dictionary keys is correct but O(n·L) per step; at the timing test's run lengths (up to about 200 words) it may pass, so ask for its memory at long runs.

**Dialect notes.** Not a natural SQL problem: an n-gram self-join for one length is possible (window functions to build `L`-grams as arrays or hashes, then a join), but the binary search becomes a sequence of queries, and BigQuery and Snowflake would run each as a large shuffle. Spark could do the same with `L`-gram hashing. In Java use `long` arithmetic modulo 2^61 − 1 with `Math.multiplyHigh` or two 31-bit moduli. Not executed here.

**Edge cases built into the tests.** No shared word (`(0, -1, -1)`); the whole response inside the source; a run that ends the response and starts the source; a long run after an earlier single shared word; a run of length 1; a run broken by one different word in the source. Hard adds two runs of the same length (earliest in the response wins), the same run twice in the source (earliest place in the source), and one word repeated so that the run overlaps itself. Very Hard adds several sources with one answer each, the same run in two sources, a periodic run with a source shorter than the run, and an empty source.

**Common mistakes.** Returning the last maximum instead of the first; ties by `j` before `i`; trusting the hash without verifying; verifying but treating a failed verification as "no run of this length" (a collision then shrinks the answer); a binary search that loses the positions at the final length; hashing word ids without an offset so that leading zeros collide (harmless with verification, but a sign of not thinking it through); `(0, 0, 0)` for no shared word; an index error on an empty source.

**Follow-up guidance.** (1) All runs of at least `k` words: hash every `k`-gram of the source, mark matching positions in the response, and merge consecutive matches into maximal runs (verify each), O(n + m); or walk the suffix automaton and report whenever the current match length drops from at least `k`. (2) Build the source's suffix automaton or its `k`-gram index once per source version, keyed by a content hash, cached with an expiry tied to the source's freshness; never per response. (3) Alignment-style measures: local alignment (Smith–Waterman) with a substitution cost, or shingled near-duplicate scores; local alignment is O(n·m), so restrict it to regions where shared `k`-grams were already found. (4) Hashing is simple and fast but probabilistic in time; the suffix automaton is linear and deterministic but uses about 2m states with dictionaries of transitions; a suffix array is compact but needs LCP and care for the tie rule.

**Rubric anchors.** 2: the O(n·m) table, or hashes without verification. 3: all checks pass with binary search and a verified rolling hash, or a suffix structure. 4: also argues monotonicity and the tie rule precisely, handles collisions so the answer is exact, and answers the all-quotes and precomputation follow-ups well.

**Strong signals.** Says "the length is monotone, so binary search it" early; asks how ties are broken before coding. **Red flags.** "Collisions are too rare to matter" as the whole answer; storing every window of every length.

## XAI-L2-03

**Reference solution** (the fixed code)

```python reference
from datetime import datetime, timezone
from urllib.parse import urlsplit


def _canonical(url):
    parts = urlsplit(url)
    host = parts.hostname or ""                      # urlsplit lowercases the host
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/")
    kept = [kv for kv in parts.query.split("&") if kv and not kv.split("=", 1)[0].startswith("utm_")]
    return host, host + path + ("?" + "&".join(kept) if kept else "")


def _domain(host, suffixes):
    labels = host.split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in suffixes:     # the last TWO labels
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def citation_report(responses, suffixes):
    report = {}
    for resp in responses:
        day = datetime.fromisoformat(resp["ts"]).astimezone(timezone.utc).date().isoformat()
        d = report.setdefault(day, {"responses": 0, "cited": 0, "web": 0, "posts": 0, "domains": {}})
        d["responses"] += 1                          # every response, cited or not
        if resp["citations"]:
            d["cited"] += 1
        seen, domains = set(), set()
        for c in resp["citations"]:
            if c["kind"] == "post":
                key = ("post", c["ref"])
            else:
                host, url = _canonical(c["ref"])     # canonicalise, then deduplicate
                key = ("web", url)
            if key in seen:
                continue
            seen.add(key)
            if c["kind"] == "post":
                d["posts"] += 1                      # never a web citation, no domain
            else:
                d["web"] += 1
                domains.add(_domain(host, suffixes))
        for dom in domains:
            d["domains"][dom] = d["domains"].get(dom, 0) + 1
    return report
```

**The planted bugs, their symptoms and their fixes.**
1. **Deduplicated before canonicalising.** The starter keeps a set of raw `ref` strings and canonicalises afterwards. Symptom: one page cited as `https://www.Example.com/a/?utm_source=feed#top` and `http://example.com/a` counts as two web citations. Fix: canonicalise first and deduplicate on the canonical form (posts on their id, in their own namespace).
2. **Two-label suffixes checked against one label.** `labels[-1] in suffixes` compares `"uk"` with `"co.uk"` and never matches. Symptom: every `.co.uk` and `.com.au` site folds to `co.uk` or `com.au`, so different sites merge. Fix: compare `".".join(labels[-2:])`.
3. **Post citations counted as web citations.** `d["web"] += 1` sits outside the `else`, so every post adds to `web` as well as `posts`. Symptom: web citations exceed web pages by exactly the number of post citations. Fix: count `web` only in the web branch.
4. **Uncited responses skipped.** `if not resp["citations"]: continue` runs before anything is counted, and `cited` is incremented for everyone who remains. Symptom: `responses` equals `cited`, so the cited share is 100 percent, and days with no citations vanish. Fix: count every response, and count `cited` only when it has a citation.
5. **The day is the local date.** `ts[:10]` reads the date written in the timestamp, in the response's own offset. Symptom: 22:00 at −07:00 on the 5th lands on the 5th instead of the 6th; 03:30 at +05:30 on the 6th lands on the 6th instead of the 5th. Fix: `datetime.fromisoformat(ts).astimezone(timezone.utc).date()`.

Each bug has its own check, and fixing one bug alone turns exactly its checks green, with no other check changing (verified by fixing each bug alone): the same page written five ways (bug 1); a `.co.uk` and a `.com.au` site, including `example.co.uk` with three labels (bug 2); one web citation and two post citations (bug 3); a response without citations next to one with, and a day with only uncited responses (bug 4); late evening west of UTC and early morning east of UTC (bug 5). Two checks pass on the original code and stay as regression checks: two different pages on one site, and paths that keep their case with non-tracking parameters kept. Random samples can hit several bugs at once.

**Explanation.** A report like this makes four decisions per citation and response: what counts as the same citation (canonical form, then deduplication), what site it belongs to, which counter it goes to, and which day and denominator the response belongs to. Each bug breaks one of them.

**Complexity.** O(total citations) time and memory per response for the sets. The timing test (50 000 responses with up to four citations each) runs in about 0.7 s in CPython, most of it in `urlsplit` and timestamp parsing, plus about 0.4 s to build the data. It guards only against something worse than linear.

**Dialect notes.** In SQL the day is `(ts AT TIME ZONE 'UTC')::date` in PostgreSQL, `CONVERT_TIMEZONE('UTC', ts)::date` in Snowflake, `DATE(ts, 'UTC')` in BigQuery; the canonical URL is a chain of `lower`, `regexp_replace` and `split` calls, best put in one tested UDF; distinct citations per response are `COUNT(DISTINCT canonical_url)` grouped by response, then summed per day; the uncited responses need a `LEFT JOIN` from responses to citations so they stay in the denominator. BigQuery has `NET.REG_DOMAIN`, which uses a full public suffix list and would give different sites from this exercise's two-entry list. Not executed here.

**Edge cases built into the tests.** Two pages on one site; one page written five ways; `/A` versus `/a` and `?id=7` versus `?id=8`; sites under two-label suffixes, including the three-label host itself; posts next to web citations; uncited responses and a day with only uncited responses; both sides of midnight in UTC.

**Common mistakes.** Lowercasing the whole URL (paths are case-sensitive here); dropping every query parameter instead of only `utm_` ones; fixing the fold with a hard-coded `"uk"` check; moving `web += 1` but counting posts toward a site; keeping uncited responses but forgetting their day; using the server's local time zone (`astimezone()` with no argument); rewriting the whole function instead of fixing it.

**Follow-up guidance.** (1) Use a published public suffix list, pinned by version and date, stored with each report run; when it changes, recompute only forward, or restate with a visible note; the site of an old report must be reproducible from the version it used. (2) Only with a redirect map observed at crawl time, stored with its date; otherwise count both and note it; redirects change, so a citation's canonical form must be what was cited then. (3) Store the input snapshot or its partition watermark, the code version, the suffix-list version and the canonicalisation rule version. (4) The day boundary becomes a parameter per team; storage, deduplication and billing stay in UTC, and the team's view is computed from UTC timestamps with its offset, which also needs a stated rule for daylight-saving changes.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, each with its symptom. 4: also explains canonicalise-then-deduplicate as an ordering rule, gives the UTC example by hand, and answers the suffix-list versioning follow-up well.

**Strong signals.** Writes the same URL several ways before reading the code; asks what the denominator is. **Red flags.** Deleting the deduplication "because it is buggy"; "ts[:10] is fine because servers run in UTC".

## XAI-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Intake.** A durable log of post events (create, edit, delete) partitioned by post id, so every event of a post is ordered in one partition. Each event carries `post_id`, `event_type`, `version` (an increasing number per post from the source, or the source timestamp plus a sequence), `event_time` and `received_at`. At {{posts_per_second}}, partitions are sized for the peaks with headroom, and consumers scale per partition.
- **Per-post state.** A keyed state store (or a key-value table) per post: `latest_version`, `deleted`, `deleted_at`, `searchable_version`. Every stage reads it before doing work and drops events older than `latest_version` or for deleted posts. A deletion writes a **tombstone** that is kept longer than any possible delay of a create (at least the index window plus a margin), so a late create is recognised and dropped.
- **Stages.** Validate the schema (rejects go to a dead-letter table with counts per reason, never silently); language label from the given classifier, with `classifier_version`; tokenise and embed with the given model, with `embedding_version`; index write with `(post_id, version)` as an idempotent key, so a redelivered event rewrites the same document. Each stage is idempotent and stamps `stage_in_at` and `stage_out_at` on the event.
- **Deletions on a fast lane.** Deletes skip enrichment: they go straight to the per-post state, the index (delete by post id on every replica), and the cache invalidation channel, with the deletion target ({{delete_target}}) measured from `event_time` of the delete to confirmed removal on all replicas. A delete for an unknown post still writes a tombstone. Deletion volume is reserved capacity, never shed.
- **Searchable.** A post is searchable when a probe query against the serving replicas returns it; the index acknowledges a version per replica, and `searchable_at` is the latest replica acknowledgement (or a sampled probe that confirms it).
- **Lag measurement.** A `stage_lag` fact per event and stage (`post_id`, `version`, stage, `in_at`, `out_at`, language label, replay flag), aggregated per hour of `event_time` into mergeable histograms (t-digest or fixed log buckets), giving p50 and p95 per stage and language and the end-to-end searchable lag against the {{searchable_target}} target. Hours are marked provisional until a watermark says no more events of that hour are in flight; still-in-flight events are counted as "not yet searchable" with their age, so slow hours cannot hide.
- **Replays.** A version change of the classifier or embedding model re-runs the last {{replay_days}} days on a **separate lane** reading the durable log or the stored canonical events, writing a parallel index (or new fields) under the new version and switching reads when complete. Replays check the tombstones, so deleted posts are never resurrected, and their stage stamps are flagged so the live lag numbers are not polluted.

**Competing designs to accept.** One stream job with all stages in-process and per-stage timers (accept if idempotency and deletion fast-pathing are explicit); a lambda-style split with a batch backfill for replays; a database-centric design where an outbox drives indexing (accept if the throughput and deletion path are credible); change data capture from a post store instead of raw events.

**Bottlenecks and failure modes.** Hot posts or authors concentrating a partition; deletions stuck behind a backlog of creates; replicas that apply a delete late; caches serving deleted posts; tombstones expiring before a delayed create; a classifier or embedding service slowing one stage; replays competing with live traffic; lag percentiles computed from completed events only (survivor bias); clocks that disagree between the source and the pipeline.

**Follow-up guidance.** (1) Run the new versions on the replay lane into a shadow index, compare samples, switch reads atomically per index window, keep the old index until the switch is confirmed; posts arriving meanwhile are processed under both versions. (2) Per-stage p95 per hour, plus in-flight counts by age per stage; the slow stage shows as the one whose out-minus-in grew, and searchable lag for posts created in that hour rises by roughly the stage's backlog. (3) Separate deletion capacity, priority queues per partition, and back-pressure on creates; report "creates delayed" honestly in the lag numbers. (4) Decline to keep every version of every post: deleted and edited content must leave; offer aggregate statistics (counts, languages, edit and deletion rates) or a governed, time-limited sample that honours deletions.

**Rubric anchors.** 2: one pipeline without per-post ordering, or deletions handled only at the end of the pipeline, or lag measured only end to end. 3: per-post ordering, idempotent stages, tombstones, a deletion path that reaches index and caches, per-stage stamps with percentile reporting. 4: also a fast lane and reserved capacity for deletions, replays that cannot resurrect deleted posts or distort lag, honest handling of in-flight events in the percentiles, and bounded copies of text.

**Strong signals.** Asks what happens when a delete arrives first; defines "searchable" precisely before measuring it. **Red flags.** "We will just reprocess everything nightly"; computing p95 lag from events that already finished.

## XAI-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Records.** `tool_call (call_id, response_id, team_ref, region, seq, tool, requested_at, final_state completed|empty|failed|timed_out|cancelled, failure_class, attempts, results_count, citations_count, total_ms, query_ref, rule_version)` with `call_id = hash(response_id, seq)`; `tool_attempt (call_id, attempt_no, started_at, queue_ms, backend_ms, fetch_ms, outcome, error_code)`; `tool_result (call_id, rank, source_kind web|post, source_ref)` where `source_ref` is a canonical URL or a post id, never contents; `citation (response_id, call_id, source_ref, span_ref)`. Up to {{max_calls}} calls per response, so `seq` is small and bounded.
- **Query minimisation.** `query_ref` points to the query text in a separate store readable only for the team's own view and for incident debugging with access logging, kept for {{log_retention_days}} days at most (or shorter); aggregate tables hold only the tool, length bucket and a keyed hash for deduplication analysis.
- **Delivery.** Log lines are produced by the tool service per attempt and per final state, carried through a durable log, deduplicated on `(call_id, attempt_no)` and `call_id` respectively; late lines are accepted within a window and partitions rewritten.
- **Latency.** Stage durations on attempts, total on the call (from the model's request to the result handed back, including retries); per tool and hour, log-bucket histograms per region, merged centrally for p50, p95 and p99; averages only beside percentiles.
- **Billing.** `billable_call (call_id, team_ref, day, tool, rule_version)` derived from final states by the stated rule ({{billing_rule}}), unique on `call_id`, so retries and duplicate lines cannot double count, and cancellations follow the rule. Billing tables are complete, never sampled, versioned by rule, and reproducible from the final-state records.
- **Reconciliation.** Daily per team and region: billable calls from logs against the usage meter's totals; differences listed by `call_id` (missing final state, late line, region gap) and must be resolved or explained before the invoice closes.
- **Views.** A team sees its own calls, latencies, failures, results and citations; aggregate reporting sees per-tool and per-region statistics only.

**Competing designs to accept.** One wide record per response with a calls array (accept if retries and late lines are handled and billing still dedups per call); billing from a separate meter that is reconciled daily against the logs (accept if differences are explainable per call); OpenTelemetry-style spans as the source, with billing derived from span attributes (accept if spans are not sampled for billing).

**Bottlenecks and failure modes.** Sampled traces used for billing; retries counted as calls; duplicate log lines after a collector restart; cancellations whose final state never arrives; averages hiding long tails; query text leaking into broad-access tables; regions closing their day at different times; a rule change applied retroactively.

**Follow-up guidance.** (1) Duplicate delivery without deduplication on `call_id`; attempts counted as calls after a retry storm; a new tool counted under two names; a region replaying a day; a rule-version change applied early; check calls per response and attempts per call against yesterday. (2) Version the rule with an effective date; compute billable calls with the version in force at `requested_at`; invoices are immutable, and a dual computation for the transition period shows both. (3) The call sequence, tools, stage durations per attempt, retries, failures and result counts; not the content of pages or posts, and the query only to the team itself. (4) Sample attempt-level debug detail and verbose error payloads, aggregate latency into histograms, shorten query retention; never sample final states or billable calls.

**Rubric anchors.** 2: one log line per response, or billing from sampled traces, or averages only. 3: call and attempt records with stable ids, deduplicated billing by rule, percentile latency per tool, daily reconciliation. 4: also query minimisation with access and retention, cancellation semantics, rule versioning without restating invoices, and a clear statement of what is never sampled.

**Strong signals.** Separates "the call the model asked for" from "attempts the platform made"; asks how cancellations are billed. **Red flags.** Logging full queries and page contents "for debugging"; "billing can come from the traces we already sample".
