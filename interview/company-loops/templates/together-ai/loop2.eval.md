# Together AI · Loop 2 — evaluator notes (hidden from candidates)

Simulated practice scenarios; every price, capacity, limit, volume and rule is
hypothetical and "this exercise's rule; check current docs". Customer data is never
inspected beyond the validation the customer asked for.

## TGA-L2-01

**Reference solution**

```python reference
def adapter_cache(slots, requests, pinned=()):
    # Unpinned loaded adapters live in groups by use count. Each group is a dict used as
    # an ordered set: a hit moves the adapter to the end of the next group, so the order
    # inside a group is the order of last use, and its first key is the least recent.
    pinned = set(pinned)
    count = {}                            # unpinned loaded adapter -> use count
    groups = {}                           # use count -> {adapter: None}, oldest use first
    loaded_pinned = set()
    low = 0                               # smallest count with a non-empty group
    hits = misses = 0
    evictions = []
    for a in requests:
        if a is None:                     # the base model alone: not the cache
            continue
        if a in loaded_pinned:
            hits += 1
            continue
        f = count.get(a)
        if f is not None:                 # hit: move from group f to the end of group f + 1
            hits += 1
            g = groups[f]
            del g[a]
            if not g:
                del groups[f]
                if low == f:
                    low = f + 1
            count[a] = f + 1
            g = groups.get(f + 1)
            if g is None:
                groups[f + 1] = {a: None}
            else:
                g[a] = None
            continue
        misses += 1
        if len(count) + len(loaded_pinned) >= slots:
            if not count:                 # nothing evictable: served without loading
                continue
            g = groups[low]
            victim = next(iter(g))        # lowest count, least recently used
            del g[victim]
            if not g:
                del groups[low]
            del count[victim]             # its count is forgotten
            evictions.append(victim)
        if a in pinned:
            loaded_pinned.add(a)
            if count and low not in groups:
                low = min(groups)         # rare: only when a pinned load emptied the lowest group
        else:
            count[a] = 1
            g = groups.get(1)
            if g is None:
                groups[1] = {a: None}
            else:
                g[a] = None
            low = 1
    return (hits, misses, evictions)
```

**Explanation.** The victim is the minimum of `(count, last use)` over the loaded adapters, and every request changes one adapter's key in a very particular way: a hit raises the count by exactly 1 and makes the adapter the most recent; a load inserts count 1 as the most recent. So group adapters by count, and keep each group in order of arrival into it: an adapter enters group `f + 1` at the moment of its latest use, so the group's order is its order of last use and the first key is the least recent. Python dicts keep insertion order, so a dict per count is an ordered set with O(1) delete and O(1) "first key". The smallest non-empty count only changes in two ways: a load sets it to 1, and a hit that empties the smallest group moves it to `f + 1` (the adapter just moved there). Forgetting the count on eviction is simply deleting the adapter. Pinned adapters are kept outside the groups, count toward the slots and are never candidates; the one case where the smallest count must be found again is a pinned load that emptied the lowest group, which happens at most once per pinned adapter. `None` requests are skipped before anything is touched, and `slots == 0` falls out of the full-cache branch with nothing to evict.

**Complexity.** O(1) per request (amortised dict operations), O(slots) memory. The timing test (150 000 requests, 4 000 to 6 000 slots, about 24 000 to 25 000 distinct adapters, 65 000 to 105 000 misses) runs in about 0.11 to 0.17 s in CPython, plus about 0.15 s to build the data. Scanning every slot for the victim on each miss is O(slots) per miss: a lean version with `min(key, key=key.__getitem__)` over a dict of `(count, last)` takes about 4.2 s for the first 30 000 requests alone and about 23 to 40 s for the whole test, 150 to 250 times the reference; a version that also builds a candidate list per miss is about four times slower still.

**The middle approach.** A heap of `(count, last_use, adapter)` with lazy deletion: every hit pushes a new entry, and on eviction stale entries (whose count or last use no longer match the adapter's current state, or whose adapter is gone) are popped and dropped until a live one comes up. It is O(log n) amortised per request, measured at about 0.2 to 0.25 s on the timing test, so it passes. It is another correct method and an accepted answer; ask how stale entries are recognised (the `(count, last)` pair must match exactly, or a returning adapter can be evicted by an old entry) and how large the heap can grow (one entry per request without compaction). A sorted list of `(count, last, adapter)` maintained with `bisect.insort` and `pop(0)` is O(slots) per request in memory moves; at these sizes it measured about 1.9 to 2.7 s in CPython, under the limit but with little room in a slower runtime, so ask for its cost per request.

**Dialect notes.** In Java, a `HashMap<Integer, LinkedHashSet<String>>` per count plus a `HashMap<String, Integer>` gives the same O(1) structure; in C++, a `std::list` per count with iterators stored in a hash map. Some caching libraries ship LFU or LFU-like policies (often with ageing or a frequency sketch), and their tie-break and reset rules differ from this exercise's. Not executed here.

**Edge cases built into the tests.** A count of 3 beating a more recent count of 1 (where least-recently-used would evict the other one); equal counts broken by last use; an evicted adapter returning with a count of 1, which decides the next eviction; one slot; more slots than adapters; the same adapter every time. Hard adds `None` requests between adapter requests (no effect at all), zero slots (every adapter request a miss, no evictions), and a log of only `None`. Very Hard adds a pinned adapter with the lowest count that is skipped, every slot pinned (misses served without loading and no eviction), a pinned adapter's first request evicting an unpinned one, and a pinned adapter that is never requested and takes no slot.

**Common mistakes.** Counting the loading request as a hit; evicting by count only, so ties depend on dict or heap order; breaking ties by the time an adapter was loaded rather than its last use; keeping counts for evicted adapters ("history LFU"), which this exercise forbids; letting `None` touch recency; a stale smallest count after a group empties; pre-loading pinned adapters before their first request; a heap compared on `(count, adapter)` without the last use.

**Follow-up guidance.** (1) Age counts: halve every count periodically (O(n) per halving, or lazily with an epoch per adapter), count over a sliding window, or move to a policy with recency built in (LRU-K, or admission with a frequency sketch). Strong answers state the cost per request and how the tie rule survives. (2) Sizes break the unit-slot assumption: evict by a cost-aware score (count per slot, or expected reload cost), and evict several adapters until the new one fits; note that this is no longer a pure LFU and needs a different structure (for example a heap over the score). (3) Route by adapter (consistent hashing or a rendezvous hash over replicas) so each adapter is warm on few replicas, with a spill-over rule when a replica is overloaded; the trade-off is hit rate against load balance. (4) Do not assume misses fall as slots rise: some policies do not have the inclusion property that lets least-recently-used be evaluated for every size in one pass. Replay a grid of slot counts (in parallel), or check monotonicity on the customer's own log before binary searching, and report the miss rate with the week it was measured on.

**Rubric anchors.** 2: a scan of every slot per miss, or ties or count resets wrong. 3: all tests pass with count groups (or a heap with lazy deletion), with `None`, zero slots and pinned adapters right. 4: also explains why the order inside a group is the order of last use, when the smallest count changes, and gives concrete answers on ageing and on choosing a slot count.

**Strong signals.** Asks whether the loading request is a use and whether counts survive eviction before coding; writes a three-request example where LFU and LRU differ. **Red flags.** "Use `functools.lru_cache`"; a victim chosen by `min()` over all loaded adapters with no complexity discussion.

## TGA-L2-02

**Reference solution**

```python reference
from bisect import bisect_left


def slow_request_counts(requests, queries):
    # Group the usable requests by (tenant, None) and (tenant, model). For each group,
    # answer its queries in decreasing threshold order: before a query, add every
    # request slower than its threshold to a Fenwick tree over the group's timestamps;
    # the answer is the number of added requests with t_from <= ts < t_to.
    groups = {}
    for tenant, ts, latency, model in requests:
        if latency is None:                       # failed: never counted
            continue
        groups.setdefault((tenant, None), []).append((latency, ts))
        groups.setdefault((tenant, model), []).append((latency, ts))
    answers = [0] * len(queries)
    asked = {}
    for qi, (tenant, t_from, t_to, threshold, model) in enumerate(queries):
        if t_from >= t_to:
            answers[qi] = -1
        elif (tenant, model) in groups:
            asked.setdefault((tenant, model), []).append(qi)
    for key, qis in asked.items():
        rows = groups[key]
        rows.sort(reverse=True)                   # slowest first
        times = sorted({ts for _, ts in rows})
        rank = {t: i + 1 for i, t in enumerate(times)}
        size = len(times)
        tree = [0] * (size + 1)
        qis.sort(key=lambda qi: -queries[qi][3])  # highest threshold first
        j, n_rows = 0, len(rows)
        for qi in qis:
            _, t_from, t_to, threshold, _ = queries[qi]
            while j < n_rows and rows[j][0] > threshold:
                i = rank[rows[j][1]]
                while i <= size:
                    tree[i] += 1
                    i += i & -i
                j += 1
            hi, lo = bisect_left(times, t_to), bisect_left(times, t_from)
            s = 0
            while hi > 0:
                s += tree[hi]
                hi -= hi & -hi
            while lo > 0:
                s -= tree[lo]
                lo -= lo & -lo
            answers[qi] = s
    return answers
```

**Explanation.** Each answer counts points in a rectangle: time in `[t_from, t_to)` and latency above a threshold. One dimension can be removed by ordering. Process a tenant's queries from the highest threshold to the lowest; before each one, add every request slower than its threshold that is not yet in the structure. Requests are only ever added, because a request slower than a high threshold is slower than every lower one. What remains is a one-dimensional count over time of the requests added so far, which a Fenwick tree over the tenant's sorted distinct timestamps answers with two prefix sums; `bisect_left` turns `t_from` and `t_to` into tree positions, which makes the range half-open. Strictness falls out of `latency > threshold`, repeated timestamps share a tree position, and answers are written back by query index so the output order is the input order. Groups are per tenant (and per tenant and model at Very Hard), so no tenant's requests ever enter another tenant's count.

**Complexity.** O((n + q) log n) time and O(n) memory. The timing test (120 000 to 150 000 requests, 30 000 queries, three to five tenants; three at Very Hard) runs in about 0.6 to 0.8 s in CPython, plus about 0.2 s to build the data. Scanning every request for every query is O(n·q), billions of steps. Bisecting to the time range and scanning the slice (the middle approach below) takes about 18 to 45 s on the timing test.

**The middle approach.** Sort each tenant's requests by time, bisect to `t_from` and `t_to`, then count the slice with `sum(1 for l in lats[i:j] if l > th)`. It is correct, and fast when ranges are narrow, but here most queries cover more than half of the day, so each slice holds 15 000 to 40 000 requests. Measured on the timing test, the first 3 000 queries took 1.8 to 4.5 s, so the full 30 000 take about 18 to 45 s, 25 to 60 times the reference and well over the 8 s limit (the low end is Very Hard, where half the queries are limited to one model and their slices are smaller). Sorting each slice is worse. Accept as correct sublinear alternatives: a merge-sort tree or wavelet tree over time with sorted latencies (O(log² n) per query, online), sqrt decomposition with sorted blocks (O(√n log n) per query, passes at these sizes), or a 2D offline sweep in the other order (by time, with a Fenwick tree over latency ranks and prefix differences). Ask each for its cost per query and its memory.

**Dialect notes.** In SQL, each query is `SELECT count(*) FROM requests WHERE tenant = :t AND ts >= :a AND ts < :b AND latency_ms > :th`; with an index on `(tenant, ts)` it still reads every row in the range, and a batch of queries becomes a join of queries to requests on those conditions, which is a range join and expensive. Warehouses answer it per query with a scan; time-series systems usually pre-aggregate latency histograms per tenant and minute, which gives approximate answers at bucket boundaries. In Java or C++, the same offline Fenwick method with arrays of `int`. Not executed here.

**Edge cases built into the tests.** A latency equal to the threshold (not counted) and one millisecond above it; requests exactly at `t_from` (counted) and exactly at `t_to` (not); several requests at the same timestamp; another tenant's slower requests in the same range; a tenant with no requests (0); the same range at several thresholds in mixed order. Hard adds failed requests with no latency (never counted, even at threshold 0) and malformed queries with `t_from > t_to` and `t_from == t_to` (`-1`). Very Hard adds model filters, a model the tenant never called (0), and `None` meaning every model.

**Common mistakes.** `>=` instead of `>` on latency, or `<=` on `t_to`; answering in sorted order and returning answers in that order; counting another tenant's requests because the tree is shared; `bisect_right` for `t_from`; treating a failed request's `None` as 0 latency (and crashing on the comparison in Python 3) or as infinite; returning 0 instead of `-1` for a malformed range; a model filter that matches on substrings.

**Follow-up guidance.** (1) Online queries: a merge-sort tree (O(n log n) memory, O(log² n) per query) or a wavelet tree, or a persistent segment tree over latency rank keyed by time (O(log n) per query, O(n log n) memory). (2) For a percentile, binary search over the latency ranks with the counting query, or use the wavelet tree's k-th smallest in a range directly; strong answers note that a percentile of a small range is noisy. (3) With 14 requests, show the count and the slowest values, or a range for the percentile, and say plainly that a p95 of 14 requests is essentially the maximum; never colour it as a regression on volume that small. (4) Keep per-tenant structures that accept appends (time only grows): a Fenwick tree over time-bucketed histograms, or append-only blocks with sorted latencies, and merge blocks as they age.

**Rubric anchors.** 2: a scan per query, or the boundary rules wrong. 3: all tests pass with an offline Fenwick (or another sublinear structure), failed requests, malformed ranges and model filters right. 4: also explains why processing by threshold lets requests only be added, compares the offline and online structures with their costs, and answers the low-volume follow-up honestly.

**Strong signals.** Rephrases the question as counting points in a rectangle; asks whether all queries are known up front. **Red flags.** "Bisect makes it logarithmic" while scanning the slice; mixing tenants in one structure and filtering afterwards.

## TGA-L2-03

**Reference solution** (the fixed validator)

```python reference
import json


def _load(line):
    """Parse one line. Returns (value, whether any object repeated a key)."""
    repeated = []

    def hook(pairs):
        seen = set()
        for key, _ in pairs:
            if key in seen:
                repeated.append(key)
            seen.add(key)
        return dict(pairs)                 # a repeated key keeps its last value
    return json.loads(line, object_pairs_hook=hook), bool(repeated)


def validate_dataset(lines, max_tokens):
    if not any(line.strip() for line in lines):
        return [(0, "no_examples")]
    errors = []
    for n, line in enumerate(lines, start=1):           # every line counts in the numbering
        if not line.strip():
            continue
        try:
            record, repeated = _load(line)
        except ValueError:
            errors.append((n, "invalid_json"))
            continue
        found = []
        if repeated:
            found.append("duplicate_key")               # once per line
        messages = record.get("messages") if isinstance(record, dict) else None
        if not isinstance(messages, list) or not messages:
            found.append("missing_messages")
            errors.extend((n, code) for code in found)
            continue
        turns = messages[1:] if messages[0]["role"] == "system" else messages   # system only first
        expected = ["user", "assistant"] * (len(turns) // 2)
        if not turns or [m["role"] for m in turns] != expected:
            found.append("bad_role_order")
        if any(m["role"] == "assistant" and not m["content"].strip() for m in messages):
            found.append("empty_assistant")
        tokens = sum(len(m["content"].split()) for m in messages)            # every turn
        if tokens > max_tokens:
            found.append("too_long")
        errors.extend((n, code) for code in found)
    return errors
```

**The planted bugs, their symptoms and their fixes.**
1. **Line numbers counted after dropping blank lines.** `rows = [line for line in lines if line.strip()]` and then `enumerate(rows, start=1)` numbers the non-blank lines. Symptom: in a file with blank lines, every error after the first blank line points at an earlier line. Fix: enumerate `lines` and skip blank lines inside the loop (the `no_examples` check stays on the whole file).
2. **A system turn accepted anywhere.** `turns = [m for m in messages if m["role"] != "system"]` removes every system turn before the order is checked. Symptom: a conversation with a system turn in the middle (or two at the start) passes, and the training job fails later. Fix: strip a system turn only when it is first: `messages[1:] if messages[0]["role"] == "system" else messages`.
3. **The system turn left out of the length.** The token count sums over `turns`, which never holds a system turn. Symptom: examples with a long system turn pass while over the limit. Fix: sum over `messages`.
4. **Whitespace-only answers not treated as empty.** `m["content"] == ""` misses `"  "` and `"\n"`. Symptom: assistant answers made of spaces pass validation. Fix: `not m["content"].strip()`.
5. **`duplicate_key` once per repeated key.** The loop appends one `duplicate_key` for every repeated key. Symptom: a line with several repeated keys gets the same error several times. Fix: report it once when any key repeated.

Each bug has its own check in which the others do not show: blank lines before a broken line and a line with no messages, all without system turns or repeated keys (bug 1); a system turn in the middle and two system turns at the start, short enough that the length does not matter (bug 2); a system turn that takes a conversation one word over the limit, alongside one exactly at the limit (bug 3); an answer of spaces and a newline next to an empty answer (bug 4); a line with two repeated keys next to one with one (bug 5). Five checks pass on the original code and stay as regression checks: exactly `max_tokens` allowed and one more rejected, a file of only blank lines, lines that are not JSON or not objects or lack `messages`, conversations that start with the assistant, end with the user or hold only a system turn, and a repeated `messages` key whose last (empty) value counts. Random samples can hit several bugs at once.

**Explanation.** A validator report is a promise about where the customer must look and what they must fix. Each bug breaks one rule of that promise: the line number (counted over the file as the customer's editor counts it), the role order (a system turn is a preamble, so it is allowed only first), the length (every turn the model reads counts), the empty answer (whitespace trains the model to say nothing), and the report itself (one code per problem per line). None of the fixes needs the validator to keep or show any content.

**Complexity.** O(total characters) for the file: one JSON parse per line plus linear passes over its messages. The timing test (50 000 or 80 000 lines) runs in about 0.7 to 0.9 s in CPython, most of it in `json.loads` with a Python hook, plus about 0.5 s to build the data. A fix that checks `if (n, code) not in errors` before appending would make it quadratic in the number of errors; the timing test guards against that kind of slip.

**Dialect notes.** In other languages, check what the JSON parser does with repeated keys: many keep the last value silently, some keep the first, and some reject the document; detecting repeats usually needs a streaming parser or a hook like `object_pairs_hook`. JavaScript's `JSON.parse` keeps the last value and gives no hook for repeats. "Whitespace" also differs: Python's `str.split()` and `str.strip()` treat Unicode spaces as whitespace, while a regex like `[ \t\n]` does not. Not executed here.

**Edge cases built into the tests.** Blank lines of spaces and tabs counted in the numbering; a broken line and a line without `messages` after them; a system turn first (valid), in the middle and twice at the start (invalid); the limit with and without the system turn; answers of spaces and a newline; two repeated keys on one line; exactly `max_tokens`; a file with only blank lines; not JSON (single quotes, a trailing comma after the object, a truncated line), not an object (a list), an empty or non-list `messages`, no `messages` at all; a conversation starting with the assistant, ending with the user, two users in a row, only a system turn; a repeated `messages` key whose last value is empty.

**Common mistakes.** Fixing bug 1 with `enumerate(rows, start=1)` plus an offset; fixing bug 2 by checking `messages[0]` but keeping the filtered list elsewhere; fixing bug 3 by adding the first message's tokens even when it is not a system turn (double-counting); fixing bug 5 by deduplicating `errors` at the end, which also merges legitimate codes and is quadratic if done with `in`; rewriting the function instead of making minimal fixes; adding content to error messages to "help" the customer.

**Follow-up guidance.** (1) Return the first few hundred errors with a total count per code, and keep only line numbers and codes, never content; the customer fixes and re-uploads. (2) Tokenize with the base model's tokenizer in the validation worker, streaming the file, and record the tokenizer version with the result; the length rule then depends on the base model, so a file is validated per model family. (3) The report can say the line, the code, the turn index and the measured count against the limit; it never quotes the line. Support can ask the customer to look at a line, or run the same validator on the customer's behalf with the customer's consent. (4) Store the limits and the tokenizer version with the validation result and re-check when a job targets a different base model, before it is queued, so the customer sees the error at submission rather than hours later.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each explained with its customer symptom. 4: also names the rule each bug breaks, keeps fixes minimal, adds a regression test per bug, and answers the tokenizer and support follow-ups without ever exposing content.

**Strong signals.** Runs a file with a blank line before reading the loop; asks whether the system turn counts toward the limit. **Red flags.** "Show the offending line in the error so the customer can find it"; fixing the line numbers by renumbering after the loop.

## TGA-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Files.** Uploads go to per-customer object storage under a file id, with a checksum. A validation worker streams the file once and records a validation result: line count, example count, token counts per example under the declared tokenizer, error list as `(line, code)` with a cap, format version, and the validator and tokenizer versions. Nothing else reads the file until a job trains on it. A file that passed validation can serve many jobs.
- **Jobs and states.** `created → validating (if needed) → queued → provisioning → training → saving → succeeded`, with `failed` and `cancelled` reachable from every non-terminal state, and `cancelling` while capacity is being released. Each transition is an event `(job_id, seq, state, ts, reason)` written by the one owner of the job's state with optimistic concurrency on `seq`; a late or replayed event with a lower sequence is dropped. The customer-facing status and event list read these events.
- **Queue and admission.** Jobs are admitted per base model and size class to capacity pools by a fair rule (per-customer concurrency caps and weighted round robin across customers, then age), so one customer's burst cannot starve others. Queue position and an estimate come from recent admission rates for that class, shown as a range.
- **Training and checkpoints.** The trainer writes a checkpoint to a temporary path, verifies it (size, checksum, a load test of the manifest), then registers it with an id and step; only registered checkpoints are used to resume. On a failure the job returns to `provisioning` with `resume_from = last registered checkpoint` and an attempt number; after a stated number of attempts on the same step it fails with a reason the customer can act on. Up to {{checkpoints}} checkpoints are kept as the customer asked.
- **Cancellation.** A cancel request is an event; the orchestrator acknowledges it, the trainer polls or is signalled, and capacity is released within a stated time. A cancel during admission is checked again after provisioning, so the handover cannot lose it. Billing stops at the cancel acknowledgement.
- **Output.** The final checkpoint is promoted to a model in the registry: base model and version, method (LoRA rank or full), the file and validation result it trained on, settings and seed; a LoRA output is an adapter tied to its base. Deployment reads from the registry; download links are signed and per customer.
- **Isolation and billing.** Files, checkpoints and models are stored per customer and encrypted; training time is metered per attempt and charged only for work ending in a registered checkpoint or the model, by this exercise's rule.

**Competing designs to accept.** A workflow engine whose history is the job's event log; a Kubernetes-operator style controller with the job as a custom resource and status conditions; validation as the first stage of every job instead of a per-file result (accept if repeated validation of the same file is cached by checksum). All are fine if states never move backwards, checkpoints are verified before use, and cancellation survives the handover.

**Bottlenecks and failure modes.** Validation of large files on the request path; checkpoints used before they are complete; state taken from the latest event by arrival; queues that one customer can flood; cancellations lost between the queue and the trainer; models that cannot be traced back to the file and settings that produced them.

**Incident guidance.**
- *Checkpoint writes that look successful but are incomplete*: resumes must only use registered checkpoints that passed verification. Fix the write-then-verify-then-register order, mark the affected checkpoints invalid, resume affected jobs from the previous verified checkpoint, and alert on verification failures and on resumes that crash at load.
- *A {{max_dataset_gb}} GB file still validating while the page says "queued"*: validation needs its own state and progress (lines read, errors so far), and large files should be validated by a streaming worker sized for them. Show `validating` with progress, and only queue the job when the result is in.
- *Cancellations lost at the queued-to-training handover*: the orchestrator must re-check the cancel flag after provisioning and before training starts. Refund the charged hour, add a test for a cancel during admission, and alert on jobs that trained after a cancel event.

**Follow-up guidance.** (1) Queued jobs on a deprecated base model are held or moved to the named replacement only with the customer's consent; until then they fail with a clear reason, and new jobs on it are rejected at submission. (2) Record the seed, the data order seed, library and container versions, the hardware class and the exact file checksum; strong answers say what still cannot be made deterministic (some GPU kernels) and say so to the customer. (3) Estimate from recent admission rates per class, show a range, and make admission order a stated, fair rule rather than pure arrival order. (4) Validation of large files and the state store under event bursts usually break first; scale validation workers by bytes, partition job state by job id, and keep the event log append-only.

**Rubric anchors.** 2: one job table with a status column updated in place, or no checkpoint verification, or no answer for cancellation. 3: files and validation separated, a written state machine with sequenced events, fair admission, verified checkpoints and resume, cancellation at every stage. 4: also handles the handover race explicitly, registers models with their full lineage, keeps validation content-free, and has a plan for each incident.

**Strong signals.** Draws the state machine with failed and cancelled from every state before choosing tools; asks what the customer is charged for a failed attempt. **Red flags.** "Retry the job from scratch"; validation that samples lines into logs "for debugging".

## TGA-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Usage event.** One event per request, emitted at completion by the model server: `(request_id, tenant_id, api_key_id, model_id, model_version, tokenizer_version, received_at, completed_at, input_tokens, output_tokens, status, server_id, server_seq)`. Token counts come from the model server, which ran the tokenizer and knows how much output was produced before a disconnect; the API layer records the request with `received_at` and the price key. No prompt or completion text is included.
- **Collection.** Servers write events to a durable log partitioned by `request_id` hash, with a local buffer that survives restarts. The log is at-least-once; deduplication is by `request_id` in the metering store (an upsert keyed by request id, or a dedup table checked in the same transaction as the write). Gaps in each server's `server_seq` show lost or late events.
- **Pricing.** A versioned price table `(model_id, model_version, token_kind, cents_per_million, effective_from, effective_to, price_version)` with non-overlapping ranges enforced on write and changes scheduled ahead with an exact `effective_from`. Each priced event stores the price version used, chosen by `received_at` (this exercise's rule); a reprice is a new version and a recorded correction, never an edit.
- **Daily usage.** Partitions by UTC day of `received_at`, per `(tenant, model, model_version, price_version)`: request counts, input and output tokens, and the exact amount in integer minor units before one rounding per invoice line. Late events trigger a rebuild of their day's partition from the deduplicated events, so replays and rebuilds are idempotent.
- **Finality and corrections.** A day is provisional until {{late_hours}} hours plus a margin have passed and every server's sequence is gap-free or explained; then it is final and versioned. Later events or reprices create correction records against the final day, which flow to the next invoice as dated adjustments.
- **Tenant view and isolation.** The usage API reads the same partitions as invoicing, scoped to the caller's tenant, and labels days provisional or final; aggregate reporting across tenants is internal and never shows another tenant's numbers.

**Competing designs to accept.** A stream processor with exactly-once sinks keyed by request id; metering at the API gateway with token counts reported back by servers; a warehouse-only batch pipeline that runs hourly. All are fine if duplicates cannot charge twice, late events land on their day, and every charge records its price and tokenizer version.

**Bottlenecks and failure modes.** Counters incremented on arrival; days keyed by arrival or processing time; prices looked up at processing time instead of request time; overlapping price rows; token counts that differ between layers without a stated source; content leaking into usage events; one hot tenant overloading a partition.

**Incident guidance.**
- *A server's clock a day behind after a restart*: events from that server land on the wrong day. Detect clock skew by comparing `completed_at` with log arrival per server and with the API layer's `received_at`; take the day from the API layer's timestamp, rebuild the two affected days, issue corrections if they were final, and alert on per-server skew.
- *A retry storm delivering events three times, triple usage for an hour*: the tenant view must read deduplicated data, not raw arrival counters. Find where the page bypassed deduplication, rebuild the hour, and add a check that usage per request id is never more than one.
- *A price change active before its announced start*: requests in between were priced at the new rate. Reprice them under the correct version, issue corrections or refunds, enforce `effective_from` on the server side with tests at the boundary, and make price changes reviewable before they take effect.

**Follow-up guidance.** (1) Charges already invoiced stay under the old tokenizer version unless a stated policy says otherwise; going forward, the new version applies from an announced instant. Strong answers say whether customers are refunded the difference and keep both counts for the transition. (2) The day's partitions are rebuilt under the backdated price version; the invoice shows a dated adjustment and the original amounts, never a silent change. (3) Compare per request: the tenant's request ids and token counts against the stored events, by model and tokenizer version; common causes are a different tokenizer, counted system or tool tokens, retries the tenant did not see, and streamed output cut off. None of it needs their prompts. (4) Deduplication state and day rebuilds usually break first; partition by request id hash, keep dedup state in a store with a retention longer than {{late_hours}} hours, and rebuild per tenant partition.

**Rubric anchors.** 2: counters incremented on arrival, or prices looked up when processed, or no deduplication key. 3: request id deduplication, event-time days with rebuilds, versioned prices stored with charges, finality and corrections. 4: also a stated token-count source with tokenizer versions, tenant views identical to the invoice, no content anywhere in the pipeline, and a plan for each incident.

**Strong signals.** Asks which timestamp decides the price and who counts the tokens before designing; treats a reprice as a new version. **Red flags.** "Log the prompt so we can recount tokens later"; "deduplicate by timestamp and tenant".
