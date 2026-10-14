# Hugging Face · Loop 2 — evaluator notes (hidden from candidates)

## HGF-L2-01

**Reference solution**

```python reference
def _walk(trees, tid, prefix, status, out):
    for name, (mode, oid) in trees[tid].items():
        if mode == "dir":
            _walk(trees, oid, prefix + name + "/", status, out)
        else:
            out.append((prefix + name, status))


def _diff(trees, old, new, prefix, out):
    if old == new:                       # same id, same content: nothing below differs
        return
    a, b = trees[old], trees[new]
    for name, (ma, oa) in a.items():
        path = prefix + name
        eb = b.get(name)
        if eb is None:
            if ma == "dir":
                _walk(trees, oa, path + "/", "D", out)
            else:
                out.append((path, "D"))
            continue
        mb, ob = eb
        if ma == "dir" and mb == "dir":
            _diff(trees, oa, ob, path + "/", out)
        elif ma == "dir":                # directory replaced by a file
            _walk(trees, oa, path + "/", "D", out)
            out.append((path, "A"))
        elif mb == "dir":                # file replaced by a directory
            out.append((path, "D"))
            _walk(trees, ob, path + "/", "A", out)
        elif ma != mb or oa != ob:
            out.append((path, "M"))
    for name, (mb, ob) in b.items():
        if name not in a:
            if mb == "dir":
                _walk(trees, ob, prefix + name + "/", "A", out)
            else:
                out.append((prefix + name, "A"))


def diff_revisions(trees, commits, pairs):
    result = []
    for old, new in pairs:
        if old not in commits or new not in commits:
            result.append(None)
            continue
        out = []
        _diff(trees, commits[old], commits[new], "", out)
        out.sort()
        result.append(out)
    return result
```

**Explanation.** Tree ids come from content, so two equal ids mean two identical subtrees, and nothing below them can differ. The walk compares the two trees name by name. Where both sides are directories with different ids it recurses; where they are equal it stops without opening them. A name present on one side only, or a file meeting a directory, lists every file below the directory that exists (`_walk`) plus the file itself. Two files differ if the object id or the mode differs, so an executable-bit flip is an `'M'`. Directories are never listed. Changes are collected and sorted once at the end, because the order a walk visits names (`onnx` before `onnx-int8` before `onnx.json`) is not the order of whole path strings (`onnx-int8/…` < `onnx.json` < `onnx/…`, since `-` < `.` < `/`). Unknown commits give `None` for that pair; the same commit gives equal root ids and an empty list.

**Complexity.** For one pair, the walk opens only the directories on the paths to changed files: O(Σ entries of the changed trees) ≈ O(changed · depth · fan-out), plus O(k log k) to sort k changes, plus the size of any added or deleted subtree (which is output). Flattening both revisions is O(files) per pair. The timing test (64 000 files in three levels of 40, 300 commits, 400 diffs between nearby commits) runs in about 0.04 s in CPython; flattening both sides for every pair took about 45 s in our check, and memoising the flattened commits still leaves O(files) dictionary comparisons per pair.

**Dialect notes.** In Java or Go the same walk uses maps per tree and an explicit stack if depth is unbounded; real git stores tree entries sorted by name (with a directory compared as if its name ended in `/`), which allows a merge-style walk over two sorted lists without hashing. In SQL, a closure table of (commit, path, object id) makes the diff a FULL OUTER JOIN, but the table is O(files × commits) to store, which is exactly the cost the content-addressed tree avoids. Not executed here.

**Edge cases built into the tests.** One file three levels deep; an added and a deleted directory (listed file by file, recursively); the same pair in both directions; the path-sort trap (`onnx-int8/…`, `onnx.json`, `onnx/…`); an unknown commit next to a valid pair; (Hard) a renamed directory (same subtree id, new name), an executable-bit-only change, several pairs over three revisions; (Very Hard) a file replaced by a directory and a directory replaced by a file, one subtree id at two paths with only one copy changed, and the same commit on both sides.

**Common mistakes.** Flattening both revisions for every pair; listing an added directory as one entry; sorting each directory's names during the walk instead of sorting whole paths; missing mode-only changes; treating a file replaced by a directory as `'M'`; memoising by subtree id alone and reusing the paths of a subtree seen at another location (the same subtree id at two paths needs the right prefix); raising on an unknown commit instead of returning `None`; dropping the whole result when one pair is invalid.

**Follow-up guidance.** (1) Cache by `(old root tree id, new root tree id)`: both are content ids, so the diff for that pair can never change, and the cache needs no invalidation, only eviction. (2) Group deleted and added paths by object id; pair them one to one when unambiguous, and decide a rule (same directory first, then by name similarity) when one id maps to several paths; skip trivially common ids such as an empty file. (3) Split very wide directories into a fan-out of subdirectories by name prefix (a tree of trees), so a change reopens only one small tree; or store directory entries sorted and compare with a merge that can skip runs. (4) Run it where pushes are committed, once per push, and emit the changed paths (or the commit pair, for big pushes) into the repository event stream that search and the dataset viewer consume.

**Rubric anchors.** 2: flattens and compares, or misses several statuses or the sort order. 3: all tests pass with a pruned simultaneous walk. 4: also explains why pruning is safe (content addressing), states the per-pair cost precisely, and gives a strong answer on caching by root ids or on wide directories.

**Strong signals.** Asks whether equal ids really mean equal content; notices the sort-order trap before testing. **Red flags.** Caching by commit id with invalidation logic; recursion that recomputes the full flattened set at every level.

## HGF-L2-02

**Reference solution**

```python reference
import re

_WORD = re.compile(r"[a-z0-9]+")


def _windows(row, n):
    w = _WORD.findall(row.lower())
    return [tuple(w[k:k + n]) for k in range(len(w) - n + 1)]


def split_overlap(datasets, n):
    out = {}
    for name, (train, test) in datasets.items():
        first = {}                                   # n-gram -> smallest train row index
        for i, row in enumerate(train):
            for g in _windows(row, n):
                if g not in first:
                    first[g] = i
        hits = []
        for ti, row in enumerate(test):
            best = None
            for g in _windows(row, n):
                j = first.get(g)
                if j is not None and (best is None or j < best):
                    best = j
            if best is not None:
                hits.append((ti, best))
        out[name] = hits
    return out
```

**Explanation.** One pass over the train split builds a dict from each n-gram (a tuple of n words) to the smallest train row index containing it: rows are visited in index order and an existing key is never overwritten. Then each test row's n-grams are looked up, keeping the smallest index found. Tokenisation is the specified one: lower-case, then every maximal run of `[a-z0-9]`, so punctuation, hyphens, tabs and line breaks separate words. N-grams are built inside each row only, so nothing spans two rows. Rows shorter than n produce no windows. Every dataset gets an entry, even when the result is `[]`.

**Complexity.** O(W · n) time and memory for W total words (each window is a tuple of n words), with O(1) expected dict operations; a rolling hash brings the time to O(W) with a collision check. Comparing every test row with every train row is O(train × test) row pairs, even with a set per row. The timing test (2 datasets of 6 000 train and 2 000 test rows, about 40 words each) runs in about 0.4 s in CPython; the per-pair version took about 28 s in our check.

**Dialect notes.** In Spark or SQL, explode each row into (dataset, n-gram, row index) rows, `MIN(train_index)` grouped by (dataset, n-gram) for train, join test on (dataset, n-gram), and `MIN` again per test row. That is a shuffle on the n-gram key: hash the n-gram to 64 bits to shrink the shuffle and confirm hits on the exact text. Regular expressions differ by engine: `\w` includes underscores and, in some engines, Unicode letters, so state the token rule explicitly. Not executed here.

**Edge cases built into the tests.** A test row that is exactly one window of a train row; a shared run of n − 1 words (not flagged); a test row matching train rows 2 and 1 in that order (report 1); a clean dataset still listed with `[]`; overlap only with another dataset (not flagged); (Hard) capitals, punctuation, tabs and line breaks; a test row shorter than n that appears inside a train row; two identical test rows; (Very Hard) n other than 8, a window that would only exist across two train rows, empty train and test splits, `"step-by-step"` as three words, duplicated train rows.

**Common mistakes.** Joining all train rows into one text (creates windows across rows) and searching substrings; splitting on spaces only, so `"Hello,"` ≠ `"hello"`; keeping the last train index instead of the first; reporting the first train row found while scanning the test row's windows rather than the smallest; omitting clean datasets; building keys with `" ".join` is fine here (words have no spaces) but the candidate should say why; a set of n-grams per train row compared with every test row.

**Follow-up guidance.** (1) Hash each n-gram to 64 bits, partition by hash range or shard the train split by hash, process test rows against each shard, and confirm hits exactly; or use a Bloom filter as a first filter, then an exact check on the candidates. (2) Precompute a global n-gram → (dataset, revision, smallest row) index sharded by hash, updated on each push of a dataset (remove the old revision's n-grams, add the new one's); MinHash/LSH for near-duplicates rather than exact runs. (3) Down-weight or exclude n-grams that occur in many datasets (a document-frequency stop list), and n-grams made only of numbers or very common words; report suppressed counts so nothing is silently hidden. (4) Measure on known clean and known contaminated pairs; show the distribution of overlap lengths and examples at the threshold; let the maintainer adjust n and see the effect.

**Rubric anchors.** 2: pairwise comparison, or tokenisation or index rules wrong in several tests. 3: all tests pass with a single n-gram dict. 4: also justifies keeping the first index, gives the exact complexity, and handles the scale-out and false-positive follow-ups with concrete mechanisms.

**Strong signals.** Asks whether windows may cross rows; asks which train index to report before coding. **Red flags.** "Fuzzy matching will catch more" without a definition; a substring search over the concatenated split defended as linear.

## HGF-L2-03

**Reference solution** (the fixed digest)

```python reference
from datetime import datetime, timezone


def activity_digest(events):
    repos = {}      # repo id -> {"owner", "name", "private", "deleted"}
    counts = {}     # (day, repo id) -> pushes
    for ev in events:
        t, rid = ev["type"], ev["repo"]
        rec = repos.get(rid)
        if t == "create":
            owner, name = ev["name"].split("/")
            repos[rid] = {"owner": owner, "name": name,
                          "private": ev["private"], "deleted": False}
        elif rec is None:
            continue
        elif t == "push":
            if rec["deleted"] or rec["private"]:                  # public at the moment of the push
                continue
            day = datetime.fromisoformat(ev["ts"]).astimezone(timezone.utc).date().isoformat()
            key = (day, rid)                                      # the stable id, not the name
            counts[key] = counts.get(key, 0) + 1
        elif t == "rename":
            rec["name"] = ev["name"]
        elif t == "transfer":
            rec["owner"] = ev["owner"]                            # only the owner changes
        elif t == "visibility":
            rec["private"] = ev["private"]
        elif t == "delete":
            rec["deleted"] = True                                 # hidden, not erased
        elif t == "restore":
            rec["deleted"] = False
    digest = {}
    for (day, rid), n in counts.items():
        rec = repos[rid]
        if rec["deleted"] or rec["private"]:                      # left out entirely at the end
            continue
        digest.setdefault(day, {})[rec["owner"] + "/" + rec["name"]] = n
    return digest
```

**The planted bugs, their symptoms and their fixes.**
1. **The day is the local date.** `ev["ts"][:10]` takes the date as written, in the timestamp's own offset. Symptom: people far from UTC see pushes on the wrong day (a push at 20:30 −05:00 belongs to the next UTC day). Fix: parse with `datetime.fromisoformat`, convert to UTC, take the date.
2. **Pushes keyed by the name at push time.** A rename or transfer changes the name, so earlier pushes sit under a name that no longer exists, and the final filter drops them. Symptom: renamed and transferred repositories lose their history; worse, a new repository that takes an old name inherits the old repository's pushes. Fix: key counts by the stable repository id and look up the final name at the end.
3. **A transfer rebuilds the record with defaults.** `ev.get("private", False)` turns a private repository public, because transfer events carry no visibility. Symptom: a private model taken over by an organisation appears in the digest. Fix: change only `owner` on the existing record.
4. **A delete purges the counted pushes.** Symptom: a repository deleted by mistake and restored has lost all activity from before the deletion. Fix: a delete only marks the record; the end filter leaves out repositories still deleted.
5. **Visibility is checked only at the end.** Pushes are counted regardless of visibility, and only the final state is checked. Symptom: once a repository goes public, the pushes made while it was private appear. Fix: count a push only if the repository is public and not deleted at that moment, and keep the end filter too.

Each bug has its own check: offset timestamps on either side of midnight UTC, a rename with pushes before and after, a private repository transferred, a delete and restore with history, and a private-to-public switch. The other checks pass with that one bug left in. Bug 2 also hides bug 4 in some sequences (a renamed repository's old-name counts are not purged by a delete under the new name), which is worth discussing.

**Explanation.** The digest has two kinds of state: a small record per repository (owner, name, visibility, deleted) that changes over time, and counts that must be attributed to the repository, not to whatever it is called. Events change the record; pushes are judged against the record as it is at that moment; the final presentation uses the record as it is at the end.

**Complexity.** O(n) time; O(repositories + repository-days) memory. The buggy purge is O(counts) per delete. The timing test is 200 000 events (100 000 at Medium).

**Dialect notes.** In SQL, the same digest is a join of push events to a repository-state history table (SCD type 2) on `repo_id` and `ts` within the validity interval, filtered on visibility at that time, grouped by `repo_id` and `(ts AT TIME ZONE 'UTC')::date`, then joined to the current repository table for the name and the final filter. Storing timestamps as `timestamptz` avoids bug 1 entirely; slicing an ISO string re-creates it. Not executed here.

**Edge cases built into the tests.** Offset timestamps on both sides of midnight UTC; a rename; a private repository transferred; private pushes before going public; a repository made private at the end; (Hard) a public repository transferred with history; a repository deleted at the end; (Very Hard) delete and restore with history, a rejected push to a deleted repository, and a new repository taking a renamed repository's old name.

**Common mistakes.** Fixing the key for counting but still looking up names at push time; adding the visibility check at push time and removing the end filter (a repository made private at the end must vanish); fixing the transfer by copying the record but resetting `deleted`; converting to UTC with `replace(tzinfo=…)`, which relabels instead of converting; rewriting the whole function.

**Follow-up guidance.** (1) Keep a repository-state table updated from the event stream and a per-day count table keyed by repository id; each day add yesterday's counts and render names from the current state. (2) Store counts by id and render names at send time; for "as sent" questions keep the rendered digest or a state history so both views exist. (3) Deletion for good must propagate by id to every derived table, including stored digests; keep a deletion log and a job that proves nothing remains. (4) Per-repository ordering from one producer (sequence numbers), or treat visibility as authoritative only with a sequence check; a push that arrives before the visibility change it follows must be re-evaluated, so keep per-repository events until the sequence is gap-free.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed and explained, all checks pass. 4: also states the invariant (count by id, judge pushes at event time, present final state), adds a regression check per bug, and answers the ordering or deletion follow-ups concretely.

**Strong signals.** Reproduces each complaint with a three-event case; notices that the transfer bug only shows for private repositories. **Red flags.** Replacing the end filter with a push-time check alone; "store everything in local time to match the user".

## HGF-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Producer.** The service that commits a push, rename, transfer, visibility change, gating change, tag or deletion writes an event in the same transaction as the change (a transactional outbox), and a relay publishes it. No event exists for an uncommitted push, and none is lost when the publisher fails.
- **Schema.** `repo_id` (stable), `seq` (per repository, strictly increasing), `type`, `ts`, `actor`, a type-specific payload (`old_commit`, `new_commit`, `ref` for pushes; `old_name`/`new_name`; `old_owner`/`new_owner`; `private`; gating state), and a `state` snapshot of the repository's current name, owner and visibility after the change. Versioned with a schema registry; consumers ignore unknown types and fields. File lists are not inlined; large pushes carry commit ids, and a consumer computes or fetches the diff.
- **Log.** A partitioned log keyed by `repo_id`, so each repository's events are ordered. A compacted companion topic holds the latest state per repository (with tombstones for repositories purged for good). Retention on the event log covers the longest expected consumer outage plus a margin, e.g. 7–14 days.
- **Consumers.** Each tracks the last `seq` applied per repository and treats a duplicate as a no-op and a gap as a reason to re-read the current state. Visibility, gating and deletion events are applied by re-reading the current state (or trusting the attached snapshot), and are the first thing a consumer acts on: search removes the document, the card metadata store hides it, notifications stop. Consumers key everything by `repo_id` and treat names as attributes.
- **Privacy fast path.** Because a lagging consumer is the main risk, public surfaces also check a small authoritative "is visible" lookup (or a short-TTL cache of it) at read time, so a repository made private disappears within {{freshness}} even if a consumer is behind.
- **Bootstrap.** A new consumer reads the compacted state topic, then the event log from the offsets recorded with that snapshot.
- **Reconciliation.** Daily (and on demand) each consumer's view is compared with the authoritative repository table by `repo_id`: visibility, deletion, name, owner. Any public surface showing a private or deleted repository pages someone.

**Competing designs to accept.** Change data capture from the repository database instead of an outbox (fine if commits and DB changes are atomic); notification-only events ("repo X changed, seq N") with consumers always re-reading state (simpler, more load on the read API, strong for correctness); per-consumer queues fed by a fan-out service. Any is fine if order per repository, privacy latency and bootstrap are handled.

**Bottlenecks and failure modes.** Hot repositories or organisations on one partition; a consumer far behind on privacy events; renames treated as delete + create, losing watchers and history; payloads with full file lists; schema changes that break old consumers; webhooks to external consumers that retry out of order.

**Incident guidance.**
- *A consumer 40 minutes behind shows a now-private repository*: the read-time visibility check removes it immediately; then catch up the consumer, possibly reading privacy events from a separate priority topic or applying them first. Alert on consumer lag in relation to the {{freshness}} target, not in absolute numbers.
- *Two events share a sequence number with different payloads*: stop trusting those repositories' streams; consumers detect conflicting duplicates (same `seq`, different hash) and fall back to re-reading the current state; fix the producer, then reconcile the ~300 repositories.
- *Mass renames and transfers spike notifications*: notifications coalesce per repository over a short window, carry the stable id and current name, and bulk migrations are tagged so they are summarised rather than sent one by one.

**Follow-up guidance.** (1) Replay from its committed offset; public surfaces stay safe through the read-time visibility check; privacy events can be processed first by a separate fast topic. (2) Keyed by id, each consumer updates the name of repository A and creates repository B; nothing is attached to the old name. (3) Unknown types are ignored and logged; a consumer that must react to them is upgraded before the producer emits them. (4) A daily join of every public surface's ids with the authoritative visibility table; zero is the only acceptable result. (5) Quotas per organisation at the producer, partitions spread by id, and a separate lane for automated bulk pushes.

**Rubric anchors.** 2: polling or hooks per consumer with names as keys; no ordering or privacy story. 3: an outbox-fed log keyed by stable id with sequence numbers, ordered consumers, bootstrap from a snapshot, and deletion handling. 4: also a privacy fast path independent of consumer lag, reconciliation that proves public surfaces are correct, schema evolution, and hot-key handling.

**Strong signals.** Separates privacy-sensitive events from the rest; keys by stable id from the start. **Red flags.** Exactly-once claimed as the fix for everything; file contents in events.

## HGF-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Trigger.** The repository push event (old and new commit) for dataset repositories feeds a scheduler. The scheduler keeps one "wanted revision" per (dataset, branch) and only converts what the viewer needs, normally the head of the main branch. A newer push replaces the wanted revision; queued jobs for older revisions are dropped, and a running one is cancelled if far from done or allowed to finish if nearly done (its output is simply not made current).
- **Job model.** Jobs keyed by `(dataset, revision, config, split, step)`: discover configs and splits, infer schema, convert, compute statistics. States: queued, running, succeeded, failed-transient, failed-deterministic, cancelled, partial. A job record stores the error class and a message for the owner.
- **Storage.** Converted shards written under a path that includes the revision and are immutable once complete; a manifest per (dataset, revision, config, split) lists shards, row counts, schema and whether the conversion is partial. The viewer reads a "current" pointer per dataset, switched atomically after all splits of a revision succeed (or per split, with the revision shown). The viewer never mixes revisions because every page request is resolved against one manifest.
- **Viewer states.** Converting: show the previous revision's rows labelled with its commit and "a newer revision is being prepared". Failed: show the error in owner-actionable words and the last good revision if any. Partial: show the first rows up to the limit and say so.
- **Scheduling and quotas.** Separate queues or weighted fair sharing by size class and owner; big conversions are split into chunks (by file) so they can be pre-empted and resumed; per-owner concurrency limits.
- **Failures.** Transient (worker lost, timeout, storage error): retry with backoff and a cap. Deterministic (parse error, schema conflict, over-limit): record and stop until a new revision arrives or the conversion code changes.
- **Access control.** Shards inherit the repository's access rules: served through the same authorisation as the files, never from a public bucket; visibility or gating changes re-check access at read time and invalidate caches.
- **Health.** Time from push to viewable (p50/p95), queue age by size class, failure rate by error class and by format, share of datasets whose current pointer lags the head.

**Competing designs to accept.** Converting lazily on first view (cheaper for rarely viewed datasets, worse first impression); converting only a sample of rows first and the rest later; a streaming conversion that serves pages as they are written (acceptable if a revision's partial state is labelled). Any is fine if revisions never mix and failures are classified.

**Bottlenecks and failure modes.** Huge datasets monopolising workers; wasted conversions on rapid pushes; schema inference from too few rows; library upgrades changing parse results; caches serving shards after access changes; rerunning everything after a code change.

**Incident guidance.**
- *A parser library release breaks 4% of conversions*: failures cluster by format and by conversion-code version; pin the library version in the conversion image, roll back, and re-run only the failed jobs; record the code version in each manifest so affected outputs can be found; add a canary set of datasets per format before upgrades.
- *A dataset near {{max_size}} pushed 12 times in an afternoon*: coalescing per dataset means at most one running and one wanted revision; the viewer shows the last converted revision with a label; per-owner quotas protect others.
- *A dataset made private during conversion and written to a public location*: there should be no public location; outputs are served through the repository's authorisation. Remove the files, purge caches, audit access logs for the window, and add a check that the write path is never publicly readable.

**Follow-up guidance.** (1) Coalescing: one or two conversions run in total; viewers see the last good revision labelled until the newest succeeds. (2) Size classes, chunked work and fair sharing so small jobs never wait behind the huge one; its 40 configurations become separately schedulable jobs. (3) Either widen the column type with a documented rule or fail deterministically with the file and column named; never silently coerce. (4) Version the conversion code; rebuild in the background by priority (most viewed first) while the old shards stay current; switch per dataset as each succeeds. (5) Access is enforced at read time against the repository's rules, and caches keyed with access context or invalidated on gating changes.

**Rubric anchors.** 2: a queue that converts every push in place, no revision in the key, failures retried forever. 3: revision-keyed immutable outputs with an atomic current pointer, coalescing, failure classes, and clear viewer states. 4: also fair scheduling for huge datasets, conversion-code versioning and controlled rebuilds, access control on converted copies, and metrics tied to push-to-viewable time.

**Strong signals.** Asks which revisions actually need converting; treats converted shards as a copy of governed data. **Red flags.** Overwriting shards in place; public storage for converted data "because the viewer needs speed".
