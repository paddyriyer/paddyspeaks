# Hugging Face · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an open hub of
models, datasets and apps (git-based repositories with large files, model and
dataset cards, gated repositories, downloads). Repositories and cards are user
content. Every workload, number, rule and schema here is hypothetical; counting,
gating and conversion rules are this exercise's rules (check current docs for the
real ones). Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## HGF-L1-01: Weekly model downloads under a stated counting rule

| | |
|---|---|
| **Template ID** | HGF-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / deduplication to a daily grain, semi-joins, date-ranged exclusions, weekly rollups |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | HGF-L1-01.mjs |

**Business Scenario.** A model hub shows a download count on every model page. A model is a git repository of many files, and a single "download" by a library fetches several of them, so a count of file requests would mean nothing. This exercise publishes a counting rule instead (this exercise's rule; check current docs for any real hub's): for each library, a few **designated files** stand for "the model was downloaded"; a client counts **at most once per model per UTC day**; and clients on a published **mirror list** (caches that re-serve models to many users) are excluded while they are listed. You are writing the weekly report behind the per-model download chart for the two weeks from {{first_day}} to {{last_day}}.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, model_id, downloads, distinct_clients`: one row per week and model with at least one counted download, ordered by `week_start, model_id`. A request counts when all of these hold: its `path` is one of the designated files for the model's `library` in `counted_files` (exact match); its `http_status` is below 400; and its client is not excluded that day. A client in `mirror_clients` is excluded on every UTC day `d` with `listed_from <= d` and (`listed_until` is NULL or `d < listed_until`). `downloads` is the number of distinct (client, UTC day) pairs with a counted request for the model in that week; `distinct_clients` is the number of distinct clients among them. `week_start` is the Monday (UTC) of the request's week, as a date. {{files_rule}} {{mirror_rule}}

**Constraints.** One SQL statement (CTEs allowed). Days and weeks are UTC: a request at 23:59:59 and one at 00:00:00 the next day are two days. The sample has {{requests}} file requests; a busy hub logs billions of file requests per day.

**Assumptions.** Hypothetical models, libraries, designated files, clients and volumes. `client_id` is an anonymous client key the log already provides; nothing in this report identifies a person. Real counting rules differ and change; this one is fixed for the exercise.

**Clarifications.**
- Q: A client fetches the designated file three times on one day. How many downloads is that? | A: One. A client counts at most once per model per UTC day.
- Q: Does a 304 Not Modified count? | A: Yes. Any status below 400 counts; 403, 404 and 500 do not.
- Q: Is `onnx/config.json` the same as `config.json`? | A: No. Paths match exactly.
- Q: Is `listed_until` inclusive? | A: No. A mirror is excluded from `listed_from` up to the day before `listed_until`; on `listed_until` itself it counts again.
- Q: Which day does a week start on? | A: Monday, UTC, so `date_trunc('week', …)` works as is.
- Q: Should weeks with no downloads appear? | A: No. Only (week, model) pairs with at least one counted download.

**Hints.**
1. Reduce the log to the grain of the rule first: one row per (model, client, UTC day) that has a counted request. `SELECT DISTINCT` does it.
2. The designated files depend on the model's library, so join `file_requests` to `models` and then to `counted_files` on both library and path.
3. The mirror exclusion depends on the day, so it is a `NOT EXISTS` with the date range inside it, not a plain anti-join on `client_id`.

**Follow-ups.**
1. A model's library is changed in its card. Which days' counts change if you recompute, and how would you keep published counts stable?
2. The mirror list is updated after a week was published. How do you restate the affected weeks, and what do you show model owners?
3. At billions of file requests a day, design the daily pipeline: what do you keep (raw requests, the daily (model, client) set, the counts), for how long, and why?
4. A model owner says their count is too low because many users download from one corporate proxy. What does the rule do with that, and what would you change, if anything?

**Follow-up rules.**
- when: count(*), count requests → ask: A client fetches the designated file ten times in one day. What does your count give, and what does the rule say?
- when: not in, anti-join, left join mirror → ask: A mirror was listed only for the second half of the period. Which of its requests should still count, and where does your query decide that?
- when: like, ilike, endswith, suffix → ask: Does `onnx/config.json` match your condition? Should it?
- when: date_trunc, week → ask: Where does a request at Sunday 23:59:59 UTC go, and one a second later?
- when: distinct → ask: What exactly is the grain of your DISTINCT, and what changes if the day is left out of it?

**Evaluation Criteria.** Designated files matched exactly per library; statuses below 400 only; mirrors excluded on listed days with an inclusive start and exclusive end; one download per (client, model, UTC day) before rolling up to weeks; correct Monday week starts; `distinct_clients` separate from `downloads`; deterministic order; can discuss restatement and scale.

## HGF-L1-02: Gated repositories: hours from access request to decision

| | |
|---|---|
| **Template ID** | HGF-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first and latest event per key, PERCENTILE_CONT, point-in-time cutoffs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | HGF-L1-02.mjs |

**Business Scenario.** On a model hub, a repository may require users to accept conditions or request access before they can download its files. Some gated repos approve requests automatically; on others a maintainer reviews each request. The hub wants to show maintainers how long requesters wait, and to see which repos have a backlog. Automatic approvals take seconds and would drag a combined median towards zero, so auto-approving repos are reported apart. You are writing the report as of {{as_of}}.

**Problem Statement.** Write one PostgreSQL query that returns `repo_id, approval_mode, requests, accepted, rejected, pending, median_hours_to_decision`: one row per gated repo with at least one request before the cutoff, ordered by `approval_mode, repo_id` (so the `auto` repos come first, apart from the `manual` ones). Only requests and decisions **strictly before** {{as_of}} exist for this report. For each request, the **wait** is from `requested_at` to its **first** decision; its **outcome** is its **latest** decision (ties on `decided_at` broken by `decision_id`); a request with no decision is **pending**. `accepted`, `rejected` and `pending` count requests by outcome. `median_hours_to_decision` is `PERCENTILE_CONT(0.5)` of the waits of decided requests, in hours, rounded to 2 decimal places; it is NULL for `auto` repos and for a repo with no decided request. {{decision_rule}} {{cutoff_rule}}

**Constraints.** One SQL statement (CTEs allowed). Pending requests are counted, never treated as a wait of zero or as waiting until the cutoff. The sample has {{requests}} requests.

**Assumptions.** Hypothetical repos, users and timings; gating is described generally (a repo may require accepting conditions before access) and this report says nothing about any licence. The approval modes are this exercise's simplification.

**Clarifications.**
- Q: A request was rejected and later accepted. When did its wait end? | A: At the first decision. The reversal changes the outcome to accepted, not the wait.
- Q: Do pending requests enter the median? | A: No. They are counted in `pending` only. (Follow-up 2 asks what that hides.)
- Q: Why is the median NULL for auto repos? | A: Their decisions are automatic; a median of seconds would only blur the manual repos' figure. The counts are still reported.
- Q: A decision is stamped exactly at the cutoff. Does it count? | A: No. Only events strictly before the cutoff exist for this report.
- Q: Which percentile? | A: `PERCENTILE_CONT(0.5)`: the average of the two middle values when the count is even.

**Hints.**
1. Filter both tables to the cutoff first, so everything after it simply does not exist.
2. Number each request's decisions twice with `ROW_NUMBER()`: ascending for the first, descending for the latest. Join both back to the requests with LEFT JOINs so pending requests survive.
3. `PERCENTILE_CONT` ignores NULLs, so a NULL wait for a pending request is excluded automatically; a `CASE` on `approval_mode` makes the auto repos' median NULL.

**Follow-ups.**
1. A maintainer asks for "median wait including the ones still waiting". How would you report waiting requests honestly: their age so far, a survival curve, or something else?
2. Requests can be withdrawn by the requester. How do you add that state, and which counts change?
3. The decision log is append-only, but one day of decisions was replayed twice by a buggy job. How does your query behave, and what constraint or step would protect it?
4. The hub wants this per repo per week, recomputed daily. Which numbers can change after a week ends, and how do you store the report so the changes are visible?

**Follow-up rules.**
- when: max(decided_at), max(, latest decision → ask: You took the latest decision. Which question does that answer, the outcome or the wait? What should the other one use?
- when: inner join, join access_decisions → ask: What happens to a request that has no decision yet? Where does it appear in your result?
- when: avg, mean, average → ask: A few requests waited a week. What does that do to the mean, and why does the report use the median?
- when: now(), current_timestamp, current_date → ask: The report is as of a fixed cutoff. What does your query return if it is rerun next month?
- when: <=, at or before → ask: A decision is stamped exactly at the cutoff. Is it in your report, and should it be?

**Evaluation Criteria.** Cutoff applied to both requests and decisions, strictly; wait to the first decision and outcome from the latest with a deterministic tie-break; pending requests counted and kept out of the median; median NULL for auto repos and for repos without decisions; `PERCENTILE_CONT` rounded to 2 places; deterministic order; can discuss reporting open requests honestly.

## HGF-L1-03: Every derivative of a base model, from declared base-model metadata

| | |
|---|---|
| **Template ID** | HGF-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Recursive CTEs / transitive closure, diamonds, cycle guards, dirty user-supplied links |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect, ml-platform-engineer |
| **Generator** | HGF-L1-03.mjs |

**Business Scenario.** On a model hub, a model card can declare the model's base model and how the model relates to it: fine-tuned from it, an adapter on it, a quantised copy of it, or a merge of several models. Derivatives have derivatives of their own, so a popular base model sits at the root of a large family tree. The hub wants a "derivatives" panel on each model page: how many models descend from it at any depth, by kind. The declarations are user content and are not checked: they can name repos that are not on the hub, a model can name itself, and in the hardest case they can loop. {{data_rule}}

**Problem Statement.** Write one PostgreSQL query that returns `model_id, direct_derivatives, descendants, finetunes, adapters, quantized, merges`: one row for every model in `models` that has at least one descendant, ordered by `descendants` descending, then `model_id`. `model_bases` holds one row per declaration: `model_id` declares `base_model_id` as a base. A model's **descendants** are the distinct models other than itself reachable by following declarations from base to derivative, at any depth. `direct_derivatives` is the number of distinct other models that declare it directly. `finetunes`, `adapters`, `quantized` and `merges` count its descendants by the descendant's own `base_relation` (`'finetune'`, `'adapter'`, `'quantized'`, `'merge'`).

**Constraints.** One SQL statement (a recursive CTE is expected). A model is never its own descendant, and a descendant reachable by several paths counts once. Declared bases that are not in `models` get no row. The query must terminate on any input. The sample has {{models}} models and {{links}} declarations.

**Assumptions.** Hypothetical model ids and relations. Every model with a declared base has a `base_relation`; models without one are originals. The relation values follow the kind of metadata model cards can carry, simplified for the exercise.

**Clarifications.**
- Q: A merge declares two bases that both descend from the same original. How many times does the merge count for the original? | A: Once. Descendants are distinct models.
- Q: Which relation decides the column? | A: The descendant's own `base_relation`. A quantised copy of a fine-tune counts under `quantized` for every ancestor.
- Q: A model declares itself as its base. | A: Ignore that declaration; it does not make the model its own derivative.
- Q: What if declarations form a loop? | A: Every model on the loop reaches the others, so they are each other's descendants, but none is its own.
- Q: What about a declared base that is not in `models`? | A: It has no row. Its derivatives are still models and can be descendants of other models.

**Hints.**
1. Build the closure as pairs `(ancestor, descendant)`: start from every declaration, then extend each pair by one more declaration.
2. `UNION` (not `UNION ALL`) in a recursive CTE discards pairs already produced, which both removes duplicate paths and stops cycles. Alternatively carry a path array and stop when the next model is already on it.
3. Drop self-declarations up front, and drop `ancestor = descendant` pairs before counting.

**Follow-ups.**
1. Your closure has one row per (ancestor, descendant). For a base model with 50 000 descendants, how big is the closure across the whole hub, and when would you store it instead of computing it?
2. A card edit changes one model's declared base. Which rows of a stored closure change, and how would you update them incrementally?
3. The panel should also show the depth of the nearest path to each descendant. What changes in the recursion, and what does a cycle do to it?
4. How would you flag declarations that are probably wrong (cycles, bases newer than their derivatives), and where would you show that?

**Follow-up rules.**
- when: union all → ask: Two paths lead to the same merge. What does UNION ALL do with it, and what happens if declarations loop?
- when: path, array, cycle → ask: You carry a path array. How long can a path get, and what does the array cost compared with deduplicating pairs?
- when: depth, level, max depth → ask: You stop at a fixed depth. How do you know it is deep enough, and what does the query return for a chain one level deeper?
- when: join models, inner join models → ask: A declared base is not on the hub. Does your query still reach its derivatives from their other ancestors?
- when: base_model_id = model_id, self → ask: Besides a model declaring itself, how else could a model reach itself, and where does your query exclude that?

**Evaluation Criteria.** Correct transitive closure with distinct descendants; self-declarations and self-pairs excluded; terminates on cycles; counts by the descendant's own relation; direct derivatives counted separately; only models in `models` reported; deterministic order; can discuss storing and maintaining the closure.

## HGF-L1-04: Dataset viewer paging across converted row shards

| | |
|---|---|
| **Template ID** | HGF-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Prefix sums and binary search / locating global offsets in ordered chunks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | HGF-L1-04.mjs |

**Business Scenario.** A dataset hub shows the first rows of every dataset in a viewer and lets people page through all of it. To make that possible, each pushed dataset is converted into ordered **shards** of rows (a large dataset has thousands). The viewer asks for pages by global row number, "rows 1 200 000 to 1 200 099", and the server must say which shards to read and where in them. Conversion can still be running when someone opens the viewer. {{data_rule}}

**Problem Statement.** Implement `locate_pages(shard_rows, requests)`. `shard_rows[i]` is the number of rows in shard `i`, in dataset order; global rows are numbered from 0 through the shards in that order. Each request is `(offset, length)`: the rows `offset … offset + length − 1`. For each request return a list of segments `(shard_index, first_row_in_shard, n_rows)` that covers those rows in order, with no segment of 0 rows (an empty shard never appears). A page that runs past the last row is cut at the end, and a page that starts at or after the end is `[]`. If any shard is `None` (not converted yet), the rows of that shard and of every shard after it have unknown positions: a request that needs any row at or beyond the first `None` shard returns `None` instead of a list.

**Constraints.** Up to 30 000 shards and 80 000 requests; a shard holds up to 10 000 rows, so a dataset can have hundreds of millions of rows. `offset ≥ 0` and `length ≥ 1`. Expected: O(s + q log s + output). Walking the shards from the first for every request is too slow, and expanding rows into a list does not fit in memory.

**Assumptions.** Hypothetical shard sizes and requests; the conversion and the viewer are this exercise's model, not a description of any hub's service. Shard sizes are known exactly once a shard is converted.

**Clarifications.**
- Q: A page ends exactly at the end of a shard. Is there a segment for the next shard? | A: No. Every segment has at least one row.
- Q: What do I return for a page that starts past the end? | A: An empty list `[]`, if every shard is converted.
- Q: Shards 0–4 are converted, 5 is not, 6 is. Can I serve rows from shard 6? | A: No. Its position depends on shard 5's size, so any row at or beyond shard 5 is unknown and the request returns `None`.
- Q: A page ends exactly at the last converted row, before a `None` shard. | A: It is fully known: return its segments.
- Q: Can a shard have 0 rows? | A: Yes. It holds no rows and never appears in a segment.

**Hints.**
1. Precompute the global row number where each non-empty shard starts. That list is sorted.
2. `bisect_right(starts, offset) − 1` is the shard holding row `offset`; from there, walk forward only as far as the page goes.
3. Decide `None`, cut and `[]` from the totals before locating anything.

**Follow-ups.**
1. Shards are converted one at a time and appended. How do you keep the start list up to date without rebuilding it, and what if an earlier shard is reconverted with a different row count?
2. The viewer also filters rows (say, only rows whose label is 3). How does paging change when a page is "the next 100 matching rows"?
3. The service is stateless and runs on many machines. Where does the start list live, and how large is it for a dataset with a million shards?
4. A user jumps to the middle of a 2-billion-row dataset. Which reads does your design make, and how would you make the first page fast?

**Follow-up rules.**
- when: for each shard, loop over shards, cumulative → ask: You walk the shards for every request. With 30 000 shards and 80 000 requests, how many steps is that, and how do you avoid it?
- when: expand, flatten, row index list → ask: The dataset has hundreds of millions of rows. How much memory does a per-row list take?
- when: bisect, binary search → ask: Which bisect variant did you use, and what does it return for an offset that is exactly the first row of a shard?
- when: None, unconverted, not converted → ask: Shard 5 is not converted but shard 6 is. Why can't you serve shard 6, and what would you need to know to do so?

**Evaluation Criteria.** Prefix starts over non-empty shards and a binary search per request; correct segments across boundaries with no empty segment; `[]` past the end and cutting at the end; `None` for any row at or beyond the first unconverted shard while the converted prefix is still served; O(s + q log s + output); can discuss incremental conversion and filtered paging.

## HGF-L1-05: Reclaimable large-file storage after branches and tags are deleted

| | |
|---|---|
| **Template ID** | HGF-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Graph traversal / mark phase of mark-and-sweep over a commit DAG, iterative DFS |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, data-architect, ml-platform-engineer |
| **Generator** | HGF-L1-05.mjs |

**Business Scenario.** Model and dataset repositories on a hub are git repositories in which large files (weights, shards) are stored as content-addressed objects outside the git history, referenced by small pointer files. Deleting a file in a new commit does not free its bytes, because history still references it; bytes are freed only when no remaining branch or tag can reach any commit that references the object. A repository owner deletes some branches and tags and asks how much storage that frees. You are writing the estimate (this exercise's retention rule; check current docs for any real service's). {{history_rule}}

**Problem Statement.** Implement `reclaimable(commits, refs, deleted, store, pinned)`. Each commit is `(commit_id, parent_ids, oids)`, where `oids` are the large-file objects that commit wrote. `refs` maps every branch and tag name to a commit id, before deletion; `deleted` lists the ref names being deleted (a name that is not in `refs` changes nothing). `store` maps every object the repository holds to its size in bytes. An object is **kept** if it is in `pinned`, or if some commit reachable from a remaining ref (following `parent_ids` at any depth) wrote it. A parent id or ref that names a commit not in `commits` leads nowhere. Return `(count, bytes)` for the objects in `store` that are not kept. An object that a commit names but `store` does not hold is ignored.

**Constraints.** Up to 150 000 commits, about 150 000 objects and 1 000 refs; history chains can be 150 000 commits deep, so a recursive walk overflows Python's stack. Expected: O(C + P + F) for C commits, P parent links and F object references. A reachability search per object (or per ref, without sharing what was already visited) is too slow.

**Assumptions.** Hypothetical commits, objects and sizes. The retention rule is this exercise's simplification: a real service may keep objects longer (grace periods, open pull requests, other repositories sharing the store), which is what `pinned` stands for.

**Clarifications.**
- Q: A file is deleted in a later commit on a remaining branch. Is its object freed? | A: No. The earlier commit that wrote it is still in the branch's history.
- Q: Do I need to rebuild the full file tree of each commit? | A: No. An object is kept if any reachable commit wrote it; that is all the rule needs.
- Q: A branch and a tag point at the same commit, and only the branch is deleted. | A: The tag keeps that commit and its history.
- Q: An object was uploaded but no commit ever referenced it. | A: It is not kept, so it is reclaimable.
- Q: The same object was written on two branches. | A: It is kept as long as either branch remains.

**Hints.**
1. This is the mark phase of mark-and-sweep: mark every commit reachable from the remaining refs once, collect the objects they wrote, then sweep the store.
2. Use an explicit stack and a `seen` set shared by all refs, so every commit is visited once whatever the number of refs.
3. Skip ids you do not know instead of failing on them.

**Follow-ups.**
1. Forks share one object store. How would you compute what deleting a fork frees, and why does `pinned` turn into a reference count?
2. The owner wants to see which deleted branch is responsible for most of the freed bytes. Define that carefully: what about bytes only freed when two branches are both deleted?
3. On a store with billions of objects, the mark phase cannot be done in one process. How would you split it, and how do you stay safe against a push that lands during the sweep?
4. Why do real systems wait (a grace period) before deleting unreferenced objects, and what does that change in your estimate?

**Follow-up rules.**
- when: recursion, recursive, def visit → ask: The history is a chain of 150 000 commits. What happens to your recursive walk, and how do you rewrite it?
- when: for each object, for every object, per object → ask: You search the history once per object. With 150 000 objects and 150 000 commits, how much work is that?
- when: snapshot, file tree, tree for each commit → ask: Do you need each commit's full file tree to decide whether an object is kept? What does that cost in memory?
- when: seen, visited, mark → ask: Is your visited set shared across refs? How many times is a commit on a shared trunk visited otherwise?

**Evaluation Criteria.** One iterative traversal from the remaining refs with a shared visited set; objects kept if any reachable commit wrote them, or pinned; deleted names that do not exist ignored; unknown commit ids skipped; orphan uploads reclaimable, unknown objects ignored; O(C + P + F); can discuss forks sharing a store, attribution and safe sweeping.
