# Hugging Face · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an open hub of
models, datasets and Spaces apps: git-based repositories with large-file
storage, model and dataset cards, gated repositories and a dataset viewer.
Repositories, cards and datasets are user content. Every workload, threshold,
number and schema is hypothetical; product rules used here are this exercise's
rules (check current docs), and nothing here describes how any company's hub,
storage or services are actually built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## HGF-L2-01: Changed files between two revisions of a hub repository

| | |
|---|---|
| **Template ID** | HGF-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Trees and hashing / content-addressed directory trees, pruned recursive diff |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | HGF-L2-01.mjs |

**Business Scenario.** Models and datasets on a public hub live in git-style repositories. A commit points at a root tree. A tree lists names, and each name points at a file object or at another tree, by an id derived from the content. Two trees with the same id hold exactly the same files. A dataset repository can hold tens of thousands of files in nested directories, and most commits touch a handful of them. Several features need the list of files that changed between two commits: a "files changed" view, a job that decides which converted files are stale, and a notice to people who watch the repository. Flattening both revisions into full path lists for every request is too slow on large repositories, and many such diffs are requested every minute.

**Problem Statement.** Implement `diff_revisions(trees, commits, pairs)`. `trees` maps a tree id to its entries, `{name: (mode, object_id)}`, where `mode` is `'file'`, `'exec'` (an executable file) or `'dir'`. A `'dir'` entry's `object_id` is another tree id in `trees`. `commits` maps a commit id to its root tree id. For each `(old, new)` in `pairs`, return the list of changed file paths as `(path, status)` tuples, sorted by `path` as a plain string. A path is the names from the root joined by `/`. Status `'A'` means the file exists only in `new`, `'D'` only in `old`, and `'M'` in both with a different object id or a different mode. Directories are never listed themselves: an added or deleted directory lists every file below it. A file replaced by a directory of the same name is a `'D'` for the file and an `'A'` for every file in the new directory, and the reverse for a directory replaced by a file. There is no rename detection: a moved file is a `'D'` and an `'A'`. If either commit id is not in `commits`, that pair's entry is `None`. If both sides are the same commit, the entry is `[]`. Return one entry per pair, in the order of `pairs`. {{tree_rule}}

**Constraints.** Up to 100 000 files, 3 000 commits and 1 000 pairs per call. Trees are never empty and are at most 12 levels deep. Names contain no `/`. The work for one pair should grow with the number of changed files times the depth of the tree, not with the size of the repository. Flattening both revisions for every pair is too slow.

**Assumptions.** Repository contents, ids and sizes are hypothetical. Ids are opaque strings: two equal tree ids mean identical subtrees, but you cannot read anything else from an id. Large files stored outside the repository appear here as ordinary file objects (their pointers), so a change to a large file is a change of object id like any other. Symbolic links and submodules do not appear.

**Clarifications.**
- Q: Is a directory that was added listed as one entry? | A: No. Only files are listed, so an added directory lists every file under it, recursively.
- Q: A file's content is the same but it became executable. Is that a change? | A: Yes, status `'M'`: the mode is part of the entry.
- Q: Should I detect renames? | A: No. A moved file is a `'D'` at the old path and an `'A'` at the new one, even when the object id is the same.
- Q: How are the results sorted? | A: By the whole path string, as Python's `sorted` orders strings. That is not always the order a recursive walk visits them: `'onnx-int8/…'` sorts before `'onnx.json'`, which sorts before `'onnx/…'`.
- Q: What if a pair names a commit that does not exist? | A: That pair's entry is `None`. The other pairs are answered normally.
- Q: Can `old` be newer than `new`? | A: Yes. The diff is just from the `old` side to the `new` side, so additions and deletions swap.

**Hints.**
1. If the two root tree ids are equal, nothing differs. The same is true for any pair of subtrees: equal ids mean you never have to open them.
2. Walk the two trees together, name by name. Recurse only where both sides are directories with different ids. Where one side is missing, or a file meets a directory, list all the files below the directory that is there.
3. Collect the changes in a list and sort once at the end, rather than trying to emit them in order during the walk.

**Follow-ups.**
1. The same diff is requested many times, for example by every visitor of a popular "files changed" page. What would you cache, keyed by what, and why is that cache never stale?
2. Users ask for rename detection: a deleted path and an added path with the same object id. How would you add it, and what do you do when one object id is deleted at one path and added at three?
3. A repository has one directory with 200 000 files in it, and a commit changes one of them. Your diff still reads both 200 000-entry trees. What changes to the tree layout or the comparison would avoid that?
4. A job needs the changed paths for every commit pushed to the hub, across all repositories, and passes them to search indexing and the dataset viewer. Where does this diff run, and what does it emit?

**Follow-up rules.**
- when: flatten, os.walk, all paths, every path → ask: How many paths do you build per pair on a 64 000-file repository, and how many pairs arrive per minute? What does that cost?
- when: hash comparison, same hash, equal ids, prune, skip → ask: You skip subtrees with equal ids. What property of the ids makes that safe, and what would break if ids were assigned by counter instead of from content?
- when: lru_cache, memo, cache → ask: What is your cache key, and can a cached diff ever become wrong when new commits are pushed?
- when: recursion, recursive, stack → ask: Trees can be 12 levels deep here. What happens to your recursion on a pathological repository 5 000 levels deep, and how would you make it iterative?
- when: rename, renamed → ask: Your rename detection pairs a deleted path with an added one by object id. Two empty files share one id. What does your code report?

**Evaluation Criteria.** Correct statuses including mode-only changes; files listed below added and deleted directories; file-to-directory and directory-to-file replacements; `None` for unknown commits and `[]` for the same commit; results sorted by the whole path string; a simultaneous walk that never opens subtrees with equal ids; a clear complexity argument (changed files × depth × entries per changed tree) against O(files) per pair; sensible answers on caching, rename detection and very wide directories.

## HGF-L2-02: Test rows that overlap the train split

| | |
|---|---|
| **Template ID** | HGF-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing / n-gram sets, text normalisation, train–test overlap per dataset |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer, software-engineer, analytics-engineer |
| **Generator** | HGF-L2-02.mjs |

**Business Scenario.** Dataset repositories on a public hub often ship a train split and a test split. When a test row repeats a passage from the train split, scores measured on that test split look better than they should. A maintainer wants a check that runs whenever a dataset revision is pushed: for every test row, does it share a run of n consecutive words with any train row of the same dataset? This exercise's rule uses n = {{n}}. A shared run that long is unlikely to be chance, and short enough to catch passages copied with small changes around them.

**Problem Statement.** Implement `split_overlap(datasets, n)`. `datasets` maps a dataset name to `(train_rows, test_rows)`, two lists of strings. A row's words are found by lower-casing it and taking every maximal run of ASCII letters and digits; everything else separates words, so `"Step-by-step!"` is the three words `step`, `by`, `step`. An n-gram is n consecutive words of one row; rows are never joined, so no n-gram spans two rows. A test row overlaps if at least one of its n-grams is also an n-gram of a train row of the same dataset. For every dataset, return a list of `(test_index, train_index)` for the overlapping test rows, sorted by `test_index`, where `train_index` is the smallest index of a train row that shares at least one n-gram with that test row. Every dataset in the input appears in the output, with `[]` when no test row overlaps. A row with fewer than n words has no n-grams and never overlaps. {{text_rule}}

**Constraints.** Up to 20 datasets, 50 000 train rows and 10 000 test rows per dataset, and up to 300 words per row; 2 ≤ n ≤ 20. Something close to linear in the total number of words is expected. Comparing every test row with every train row is too slow.

**Assumptions.** Datasets, rows and sizes are hypothetical, and the text is ASCII. The check only reports overlaps; deciding what to do about them is the maintainer's choice. Exact n-gram matching after the normalisation above is the whole rule: no stemming, no fuzzy matching.

**Clarifications.**
- Q: Do rows from different datasets count? | A: No. Only train rows of the same dataset.
- Q: If a test row shares n-grams with several train rows, which index do I report? | A: The smallest train row index among all of them, not the first one you happen to find while scanning the test row.
- Q: Is punctuation part of a word? | A: No. Words are runs of ASCII letters and digits after lower-casing, so `"Hello,"` and `"hello"` are the same word, and an apostrophe or hyphen splits a word.
- Q: Can an n-gram run from the end of one train row into the start of the next? | A: No. Each row is a separate piece of text.
- Q: What about a test row with fewer than n words? | A: It has no n-grams, so it is never reported, even if it appears word for word inside a train row.

**Hints.**
1. Build one structure from the train split first, then answer each test row from it, instead of comparing pairs of rows.
2. A tuple of n words is hashable. A dict from tuple to the smallest train index answers "which train row, if any" in one lookup.
3. Insert into the dict only if the n-gram is not already there, and visit train rows in index order. Then the stored index is already the smallest.

**Follow-ups.**
1. The train split is 400 GB of text and the dict no longer fits in memory. How would you run the same check, and what would you use instead of exact tuples?
2. A maintainer wants overlaps between a new dataset's test split and the train splits of 5 000 other datasets on the hub. What would you precompute, and how would you keep it current as those datasets are pushed?
3. Long numbers, licence headers and boilerplate like "the following is a conversation" create overlaps that are not leaks. How would you suppress them without hiding real ones?
4. How would you choose n, and what evidence would you show a maintainer that the number of flagged rows is meaningful?

**Follow-up rules.**
- when: in train_text, substring, find( → ask: How long is the joined train text, and how many substring searches do you run? What is the total cost?
- when: set intersection, isdisjoint, intersect → ask: You intersect a test row's n-grams with each train row's set. How many row pairs is that at 50 000 × 10 000?
- when: hash(, hash of the n-gram, rolling hash, minhash → ask: Two different n-grams can hash to the same value. What does a collision do to your answer, and how would you confirm a hit?
- when: join(, " ".join → ask: You join words with a space to make a key. Could two different word lists ever produce the same key here? What about if words could contain spaces?
- when: bloom filter, bloom → ask: A Bloom filter can say "maybe present" for an n-gram that is not there. How do you get the smallest train index, and what is your false-positive rate at this size?

**Evaluation Criteria.** Exact tokenisation as specified; no n-grams across rows; rows shorter than n never flagged; per-dataset matching with every dataset present in the output; the smallest train index, not the first found; a single dict from n-gram to smallest index, O(total words · n) to build and query; a clear comparison with the O(train × test) approach; credible answers on scale (hashing, sharding by n-gram, MinHash or suffix structures) and on false positives from boilerplate.

## HGF-L2-03: Debug the repository activity digest

| | |
|---|---|
| **Template ID** | HGF-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / stable ids versus names, visibility at event time, UTC days, deletes and restores |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | HGF-L2-03.mjs |

**Business Scenario.** A public hub sends each user a daily digest of activity on public repositories: how many pushes each repository received on each day. Repositories are renamed, transferred between users and organisations, deleted and sometimes restored, and switched between private and public. Support has collected complaints about one function. Renamed models show no history from before the rename. A private model that an organisation took over shows up in the digest. A dataset that was deleted by mistake and restored lost all its earlier activity. Pushes made while a model was still private appear once it is made public. And people in some time zones see pushes on the wrong day. The function below is the suspect.

**Problem Statement.** Fix `activity_digest(events)` so that it meets this specification. `events` is a list of dicts in the order the hub committed them. Every event has `"type"`, `"repo"` (a stable repository id that never changes) and `"ts"` (an ISO 8601 timestamp with a UTC offset, such as `"2026-10-13T20:30:00-05:00"`). {{replay_rule}}
1. **`create`** has `"name"` (`"owner/name"`) and `"private"` (a bool). **`rename`** has `"name"`, the new repository name without the owner. **`transfer`** has `"owner"`, the new owner; the name and the visibility are unchanged. **`visibility`** has `"private"`. **`delete`** and **`restore`** have nothing more. A restored repository comes back exactly as it was, with its name, owner, visibility and history.
2. A **`push`** counts if the repository exists, is not deleted and is public at the moment of the push. Pushes the hub rejected because the repository was deleted are still in the log, and are ignored. Events for an id that was never created are ignored.
3. A counted push belongs to the **UTC** calendar day of its timestamp.
4. The digest reports a repository under its **final** `"owner/name"`, after every event. A repository that is deleted or private at the end is left out entirely, with all its history.
5. **Output.** `{"YYYY-MM-DD": {"owner/name": pushes}}`. Days and repositories with no counted pushes do not appear.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events, processed in linear time.

**Assumptions.** Event shapes, names and volumes are hypothetical, and the visibility and digest rules are this exercise's rules (check current docs for how the hub actually behaves). The final names of repositories that exist at the end are unique. A deleted repository receives no events except rejected pushes and a restore.

**Clarifications.**
- Q: A repository was public, then made private. Are its earlier public pushes shown? | A: No. A repository that is private at the end is left out entirely, so its name never appears.
- Q: Does a transfer change visibility? | A: No. A private repository transferred to an organisation stays private.
- Q: Which name does a push made before a rename appear under? | A: The final name. The digest is keyed by repository, and shows its name as it is now.
- Q: Which day is "the day" of a push? | A: The UTC date of the timestamp, after applying its offset. `2026-10-13T20:30:00-05:00` is on 2026-10-14.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Which value identifies a repository for its whole life? Key everything you accumulate by that, and look the name up once at the end.
2. Write out what the record looks like before and after a transfer of a private repository.
3. Visibility matters twice: at the moment of each push, and at the end.
4. What does a delete need to change, if a restore must bring everything back?

**Follow-ups.**
1. The digest is computed for millions of users from billions of events. How would you compute it incrementally each day instead of replaying all history?
2. A repository is renamed after yesterday's digest was sent. Should yesterday's digest change? What do you store so that both answers are possible?
3. A user asks to be forgotten, and their repositories are deleted for good. How does that reach every derived table, including digests already computed?
4. Events arrive from several services, and a `visibility` event sometimes lands a few seconds after a push it should precede. What ordering guarantee do you need, and how would you handle the cases where you do not get it?

**Follow-up rules.**
- when: datetime, fromisoformat, astimezone, utc → ask: Your timestamps are converted to UTC. What does a user in UTC−08:00 expect to see as "yesterday", and how would you offer that without breaking the UTC totals?
- when: repo id, repo_id, stable id, by id → ask: You key by repository id now. If two repositories end with the same name, which one is shown, and how could that happen on a real hub?
- when: purge, delete history, remove counts → ask: Deleting no longer purges. When must data from a deleted repository actually be removed, and how would you do it?
- when: final check, at the end, end state → ask: You check visibility at the end. Show an event sequence where that check alone shows activity that was private when it happened.
- when: rebuild, new record, copy the record → ask: Your transfer builds a new record. Which fields could it lose, and how do you make sure a new field added next year is not lost too?

**Evaluation Criteria.** Finds and explains every bug with its user-visible symptom; accumulates by stable repository id and names at the end; a transfer that changes only the owner; deletes that hide but do not erase, so restores keep history; visibility checked at push time and at the end; UTC days from offset timestamps; minimal, linear fixes; a regression check per bug.

## HGF-L2-04: One event stream for hub repository changes

| | |
|---|---|
| **Template ID** | HGF-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / change events, ordering per key, fan-out to search, cards and notifications |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "repos": {"2": ["2 million", "5 million"], "3": ["15 million", "40 million"]},
  "pushes_per_day": {"2": ["600,000", "1.5 million"], "3": ["8 million", "20 million"]},
  "consumers": [4, 6, 9],
  "freshness": ["30 seconds", "2 minutes", "5 minutes"]
}
```

**Business Scenario.** A public hub hosts about {{repos}} model, dataset and Spaces repositories and receives about {{pushes_per_day}} pushes a day. Besides pushes, repositories get tags and branches, renames, transfers between owners, visibility changes, gating changes and deletions. Today, {{consumers}} features each poll repositories or listen to their own ad-hoc hooks: search indexing, the parsed metadata from model and dataset cards, notifications to watchers, the dataset viewer and others. They disagree about what a repository is called and whether it is public, and a private repository has once appeared in search results for a few minutes after it was made private. You are asked to design one stream of repository events that every feature consumes, with changes visible to consumers within {{freshness}}.

**Problem Statement.** Design the repository event stream and how it is fed and consumed. Cover where events come from and how a push becomes an event only once it is committed, the event schema (stable repository id, a per-repository sequence number, event types and payloads), ordering guarantees and the partition key, what a consumer does with each event type (in particular renames, transfers, visibility changes and deletions), how a new consumer builds its state from scratch, replay and retention, schema evolution, and how you would check that every consumer agrees with the repositories' real state.

**Constraints.** A repository that becomes private or is deleted must disappear from every public surface within {{freshness}}. Consumers are owned by different teams and fail independently. Events about one repository must be applied in order; events about different repositories need not be. A push can contain thousands of files, and its event must not carry their contents.

**Assumptions.** Volumes, freshness targets and the list of consumers are hypothetical. Repositories are git-based, and the hub already knows when a push is committed. You may use common open building blocks: a partitioned log, a stream processor, a key-value store, a search index and object storage.

**Clarifications.**
- Q: What identifies a repository in events? | A: A stable id assigned at creation. Names and owners change; the id never does.
- Q: Does a push event list the changed files? | A: You decide. Listing every changed path can be large. A pointer to the old and new commit lets a consumer compute the diff itself.
- Q: Is "deleted" final? | A: Not always: a repository can be restored within a period set by this exercise's rule. Consumers must handle both.
- Q: Who is harmed by a late visibility change? | A: The owner of a private repository, whose name, card or files may be shown publicly. That case matters more than any other latency.
- Q: Can consumers call back into the hub for the current state? | A: Yes, through an internal read API, but every consumer doing that on every event is what overloads the hub today.

**Hints.**
1. Partition by the stable repository id, and number events per repository. A consumer can then detect gaps and duplicates by itself.
2. Visibility changes and deletions are different from other events: think about whether they should be "facts to apply" or "triggers to re-read the current state".
3. A new consumer needs a starting state. A compacted snapshot of each repository's latest state plus the log from that point is a common answer.

**Follow-ups.**
1. A consumer was down for six hours. How does it catch up, and what do public surfaces show for repositories that went private during those hours?
2. A repository is renamed, and its old name is taken by a new repository a minute later. Walk through what search, notifications and card metadata each do.
3. You add a new event type for gating changes. How do existing consumers that do not know it behave?
4. How would you prove, every day, that no private or deleted repository is visible on any public surface?
5. One organisation pushes 200 000 times in an hour from an automated job. What does that do to your partitions and to other repositories' freshness?

**Follow-up rules.**
- when: partition by repo, repo id, partition key → ask: One very active repository lands on one partition. What happens to the other repositories on that partition, and what would you do about it?
- when: exactly once, exactly-once → ask: Which consumers actually need exactly-once effects, and which are fine with at-least-once delivery plus idempotent writes keyed by sequence number?
- when: webhook, webhooks, polling, poll → ask: Some consumers are outside your control and use webhooks. How do they get the same ordering and the same privacy guarantee?
- when: name, repo name, owner/name → ask: You key something by name. What happens to it on a rename followed by a new repository taking the old name?
- when: compaction, compacted, snapshot → ask: Your compacted topic keeps the latest state per repository. How does a consumer learn that a repository was deleted, and when is that tombstone itself removed?

**Production Reality Check.**
- A consumer's lag grows to 40 minutes after a deploy, while {{pushes_per_day}} pushes a day keep arriving, and a repository made private during that time still appears in that consumer's search results.
- A bug in the producer emits two events with the same per-repository sequence number but different payloads for about 300 repositories.
- A burst of renames and transfers from an organisation migrating 50 000 repositories makes notification volume spike and watchers receive notices under old names.

**Evaluation Criteria.** Events emitted only for committed changes; stable id and per-repository sequence numbers; partitioning that preserves per-repository order with a plan for hot repositories; a schema with versioning and pointers instead of file contents; privacy-sensitive events handled with priority or a re-read of current state, and measured against the {{freshness}} target; bootstrap from a snapshot plus the log; replay, retention and tombstones; consumer independence and lag monitoring; a reconciliation that proves public surfaces match the real state; a plan for each incident.

## HGF-L2-05: Converting pushed datasets for the dataset viewer

| | |
|---|---|
| **Template ID** | HGF-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / per-revision conversion jobs, columnar shards, retries, stale-while-converting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "datasets": {"2": ["150,000", "400,000"], "3": ["1 million", "3 million"]},
  "pushes_per_day": {"2": ["20,000", "60,000"], "3": ["250,000", "600,000"]},
  "max_size": ["5 GB", "50 GB", "500 GB"],
  "formats": [5, 8, 12]
}
```

**Business Scenario.** A public hub hosts about {{datasets}} dataset repositories. A dataset viewer lets anyone page through the rows of a dataset, filter them and see column statistics, without downloading anything. To make that fast, each pushed revision is converted into columnar shards with a fixed row-group size, and the viewer reads those. Datasets arrive in about {{formats}} formats (CSV, JSON lines, columnar files, image and audio folders, archives and others) and range from a few rows to {{max_size}}. The hub receives about {{pushes_per_day}} pushes to dataset repositories a day, sometimes several to the same dataset within minutes. Some conversions fail: malformed files, columns whose types change from file to file, or a dataset too large for the limits. You are designing the conversion pipeline and what the viewer shows while it works.

**Problem Statement.** Design the pipeline from a dataset push to rows in the viewer. Cover how a push becomes conversion work (and how several quick pushes to one dataset are handled), the unit of work (dataset, revision, configuration and split), job states, retries and the difference between a transient failure and a failure that will repeat, how converted shards are stored and addressed by revision, what the viewer shows for a revision that is not converted yet or failed, large datasets and partial conversion, schema inference and its errors, quotas so that one huge dataset cannot starve the others, and how you would know the pipeline is healthy.

**Constraints.** The viewer must never mix rows from two revisions. A failed conversion must tell the dataset's owner what went wrong in words they can act on. Re-running a job for the same revision must produce the same shards. Datasets may be gated or private, and their converted shards must be governed by the same access rules as the repository. Compute is shared, and cost matters.

**Assumptions.** Volumes, sizes, formats and limits are hypothetical, and partial-conversion and size limits are this exercise's rules (check current docs). The hub already publishes an event when a push to a repository is committed, with the old and new commit ids. A dataset's configurations and splits can be read from its files or its card.

**Clarifications.**
- Q: Must every revision be converted? | A: No. Only what the viewer needs: usually the latest revision of the main branch. Converting every intermediate push is waste.
- Q: What does the viewer show while a new revision converts? | A: You decide, and justify it: the previous revision's rows clearly labelled, a progress state, or nothing.
- Q: Are very large datasets converted completely? | A: In this exercise, a dataset above a size limit is converted only up to the limit, and the viewer says so.
- Q: Can a job fail forever? | A: Yes, for example a malformed file. Retrying it every hour wastes compute; it should wait for a new push.
- Q: Who can see converted rows of a gated dataset? | A: The same people who can read the repository's files. Converted shards are a copy of the data, not public metadata.

**Hints.**
1. Make the job key `(dataset, revision, config, split)`, and make each job's output immutable and addressed by that key. Then "which rows does the viewer show" becomes "which revision's pointer is current".
2. Coalesce: when a newer push arrives before an older job starts, the older one can be cancelled. Decide what happens if it already started.
3. Classify failures into transient (retry with backoff) and deterministic (record the error, stop, wait for a new revision).

**Follow-ups.**
1. A maintainer pushes 30 commits in 10 minutes while fixing a file. What runs, what is cancelled, and what do viewers see?
2. A 300 GB dataset with 40 configurations is pushed. How do you schedule it so that small datasets pushed at the same time still convert within minutes?
3. A dataset's column is an integer in the first 1 000 files and a string in file 1 001. What does your schema inference do, and what do you tell the owner?
4. You change the conversion code, and every dataset's shards should be rebuilt. How do you roll that out without the viewer going stale for everyone?
5. A gated dataset's conditions change so that some users lose access. What must happen to the converted shards and to any caches in front of them?

**Follow-up rules.**
- when: queue, job queue, celery, worker pool → ask: One {{max_size}} dataset takes hours on a worker. How does your queue keep small datasets flowing while it runs?
- when: retry, retries, backoff → ask: Which failures do you retry, and how do you stop retrying a malformed file every hour for months?
- when: overwrite, latest, replace → ask: You overwrite the converted shards in place. What does a viewer paging through rows see while the overwrite is half done?
- when: parquet, row group, columnar → ask: How do you choose the row-group size, and what does it do to the cost of serving one random page of 100 rows?
- when: schema inference, infer, infer the schema → ask: How many rows or files do you read to infer a schema, and what happens when a later file disagrees?

**Production Reality Check.**
- A release of a popular data library changes how one of the {{formats}} formats is parsed, and conversions that succeeded yesterday start failing for 4% of datasets.
- A dataset near {{max_size}} is pushed 12 times in one afternoon, and each push starts a full conversion that the next push makes useless.
- A dataset is made private while its conversion is running, and the job finishes and writes shards to a location the viewer serves publicly.

**Evaluation Criteria.** Conversion triggered by committed pushes with coalescing per dataset; a job key that includes the revision, immutable outputs and an atomic switch of the current pointer; a clear viewer state for converting, failed and partial revisions with no mixing of revisions; transient versus deterministic failures; fair scheduling and quotas for very large datasets; deterministic reruns; access control on converted shards equal to the repository's; useful health metrics (queue age, failure rate by cause, time from push to viewable); a plan for each incident.
