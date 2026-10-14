# Hugging Face · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of an open hub of
models, datasets and Spaces (git-based repositories with large-file storage, cards,
gated repos, downloads and likes), its libraries and its inference endpoints.
Repositories, cards and datasets are user content; the setting is the hub's visible
behaviour, never its internal infrastructure. Every workload, rule, threshold,
number and schema is hypothetical; where a product rule is used it is this
exercise's rule (check current docs). Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## HGF-L3-01: Repositories as data — commits, branches, tags, large-file pointers and exactly what a revision contained

| | |
|---|---|
| **Template ID** | HGF-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / commit graphs, ref history, per-revision file manifests, large-file pointers |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "repos": {"1": ["300,000"], "2": ["2 million", "4 million"], "3": ["8 million", "15 million"]},
  "daily_commits": {"1": ["60,000"], "2": ["500,000"], "3": ["2 million", "4 million"]},
  "max_files": ["20,000", "250,000"],
  "pointer_threshold": ["10 MB", "50 MB"]
}
```

**Business Scenario.** The hub hosts about {{repos}} repositories of models, datasets and Spaces. Each is a git repository: commits with parents, branches (usually `main`, sometimes others such as a conversion branch), tags such as `v1.0`, and a tree of files. In this exercise a file larger than {{pointer_threshold}} is committed as a small pointer that names a large-file object by its SHA-256 and size; the bytes live in large-file storage. Users push about {{daily_commits}} commits a day; branches can be force-pushed, tags can be moved or deleted, and a repository can be renamed or transferred to another owner. A repository can hold up to {{max_files}} files. Analysts, the download-statistics team and support all ask the same kind of question: "what exactly did revision X contain, and what was `main` on date D?"

**Problem Statement.** Design the analytical data model for repository contents and history. Cover: commits and their parents (merges have two), the history of every ref (branch and tag moves, including force-pushes and deletions), the file manifest of a revision (path, blob id, size, whether it is a pointer and which large-file object it names), how a request "file F at revision R" resolves to bytes when R is a branch, a tag or a commit id, and the facts that answer "files and total bytes in a revision", "which revisions of which repos reference large-file object O", "what `main` pointed to at a given time" and "commits per repo per day". Say how a manifest is stored without copying {{max_files}} rows for every commit.

**Constraints.** Commit ids and blob ids are content hashes and never change; refs do. History must survive force-pushes: a commit that is no longer reachable from any ref is still answerable for as long as it is retained. Repository identity must survive renames and transfers. Pointer files and the objects they name are separate things: the same object can be named by many paths, revisions and repositories. Times are UTC.

**Assumptions.** Volumes, thresholds and file counts are hypothetical, as are the pointer rule and threshold (this exercise's rule; check current docs). You receive push events (repo id, ref, old commit, new commit, pushed_at) and can read any commit's tree. Private repositories exist; their contents never appear in public analytics.

**Clarifications.**
- Q: Do I need to store file contents? | A: No. Paths, blob ids, sizes and pointer details only.
- Q: Can a tag move? | A: In this scenario, yes: an owner can delete a tag and recreate it on another commit. Your model must say which commit the tag named at any time.
- Q: Is a rename a new repository? | A: No. The repo keeps a stable id; the owner/name pair has a history.
- Q: How are revisions written in requests? | A: As a branch name, a tag name or a full commit id; a short commit prefix is not accepted in this exercise.
- Q: What happens to commits dropped by a force-push? | A: They stay in the data for a retention period (your choice, stated), marked unreachable.

**Hints.**
1. Separate what never changes (commits, trees, blobs, large-file objects, all keyed by hash) from what moves (refs and repo names, kept as validity intervals).
2. A manifest can be stored as the change from the first parent (added, modified, deleted paths) plus periodic full checkpoints; any revision's manifest is a checkpoint plus the changes after it.
3. "What was `main` at time T" is an interval lookup on the ref's history, not a property of a commit.

**Follow-ups.**
1. Write the query (in words or SQL) that lists the files and total bytes of `main` on a given date for one repo, from your tables.
2. A force-push replaces the last five commits of `main`. What rows change in your model, and what does a download recorded against the old head now resolve to?
3. A merge commit has two parents. Which parent do you diff against when storing the manifest, and how do you answer "which commit introduced this path"?
4. With repositories of up to {{max_files}} files and {{daily_commits}} commits a day, how often do you checkpoint a full manifest, and how do you bound the cost of reconstructing any revision?
5. A large-file object is named by pointers in thousands of repositories. How do you answer "which public revisions reference it" quickly, and keep private repos out of the answer?

**Follow-up rules.**
- when: snapshot, full manifest, every commit → ask: A repo with {{max_files}} files gets a one-line README change. How many rows does your design write, and what does that cost at {{daily_commits}} commits a day?
- when: branch column, current_branch, head commit → ask: That records where a branch is now. A download was logged against `main` three weeks ago; how do you find which commit it meant?
- when: repo name, owner/name, full name → ask: The repo was renamed and later transferred. What is its key in your facts, and how does a dashboard keyed by name keep its history?
- when: pointer, lfs, sha256 → ask: Two repos commit the same 4 GB file under different paths. How many large-file objects, pointer rows and manifest entries do you store?
- when: delete, deleted, garbage collect → ask: An owner deletes a branch. Which of your rows disappear, which are marked, and what can support still answer afterwards?

**Production Reality Check.**
- A dashboard of "bytes per model" doubles overnight for repos holding files above {{pointer_threshold}}: the manifest job started counting both the pointer file's size and the large-file object's size for the same path.
- After a series of force-pushes on busy repos, a download report resolves branch names with the ref's current head and attributes three weeks of downloads to commits that did not exist yet.
- Manifest reconstruction for repos with {{max_files}} files slows to minutes because checkpoints were only written at creation; every lookup replays every change since.

**Evaluation Criteria.** Immutable, hash-keyed commits, trees, blobs and large-file objects separated from mutable refs and names; ref history as validity intervals including force-pushes and tag moves; a manifest stored as parent diffs plus checkpoints with a stated reconstruction bound; pointers modelled apart from the objects they name, with a reverse index; repo identity stable across renames and transfers; private content kept out of public facts; each incident contained, corrected and guarded.

## HGF-L3-02: Gated repositories — access conditions, requests, approvals, revocations and licence changes

| | |
|---|---|
| **Template ID** | HGF-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / access-condition versions, request lifecycles, grants as intervals, licence metadata per revision |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "gated_repos": {"1": ["5,000"], "2": ["40,000"], "3": ["150,000", "300,000"]},
  "daily_requests": {"1": ["20,000"], "2": ["200,000"], "3": ["1 million", "2 million"]},
  "auto_share": ["30%", "60%"],
  "form_fields": [3, 6, 10]
}
```

**Business Scenario.** On the hub, a repository owner can gate a model or dataset: a user must accept the owner's access conditions, and may have to fill in a short form (here up to {{form_fields}} fields), before the files can be downloaded. Some owners approve every request automatically (about {{auto_share}} of the {{gated_repos}} gated repos here); others review requests by hand and can reject them or later revoke access. Owners edit their conditions and form over time, and the licence declared in the repo's metadata can change from one revision to the next. About {{daily_requests}} access requests arrive a day. Owners want to see who has access and under which conditions they accepted; users want to see the status of their own requests; the hub's analysts want aggregate review times and approval rates, never form answers.

**Problem Statement.** Design the data model for gating. Cover: the gate configuration and its versions (on/off, manual or automatic approval, the conditions text and form fields), the access request lifecycle (requested, approved, rejected, revoked, and requested again), which conditions version a user accepted, access grants as intervals so "could user U download from repo R at time T" is answerable, how form answers are stored and who can read them, and the licence declared at each revision. Define the facts that answer "median time to decision per repo", "approval rate by approval mode" and "downloads by users whose access was later revoked".

**Constraints.** Every decision keeps who made it (owner, a member of the owning organisation, or the automatic rule) and when. A grant is never edited in place; a revocation closes it. Form answers are personal data: they are readable by the repo's owners and by the user, retained under a stated policy, and never copied into analytics. The licence is metadata the owner declares; the model records what was declared and when, and draws no conclusion about what a licence permits.

**Assumptions.** Counts and shares are hypothetical; gating behaviour here is this exercise's rule (check current docs). A request is made by one user for one repo. An organisation can own repos and has members who can act on requests.

**Clarifications.**
- Q: If the owner changes the conditions, do existing users have to accept again? | A: In this scenario the owner chooses per change: "re-accept required" or not. Your model must support both.
- Q: Can a rejected user request again? | A: Yes. Each request is its own row; the latest one is the current status.
- Q: Does ungating a repo end all requests? | A: Pending requests are closed as "gate removed"; existing grants stay in the history but no longer matter while the repo is ungated.
- Q: Is the licence part of the gate? | A: No. It is declared in the repo's metadata at each revision; a gate's conditions can mention it.
- Q: What do analysts see? | A: Counts, rates and durations per repo and approval mode, with no form answers and no user-level rows.

**Hints.**
1. Version the gate configuration; every request and acceptance points at the version the user saw.
2. Keep requests (a lifecycle with typed decision events) apart from grants (validity intervals derived from decisions).
3. Licence declarations belong to the repository's revision history, not to the gate.

**Follow-ups.**
1. Write how you answer "could user U download from repo R at 14:00 on a given day", including a revocation at 13:00 and a re-approval at 15:00.
2. The owner adds a field to the form and requires re-acceptance. What happens to existing grants, and how is the transition shown to users and to the owner?
3. Define "median hours to decision" so automatic and manual repos, pending requests and re-requests are handled consistently.
4. A user asks for their form answers to be deleted. What is removed, what stays, and how do the owner's audit view and the aggregate facts remain correct?
5. At {{daily_requests}} requests a day with {{auto_share}} approved automatically, which tables grow fastest, and how do you keep "who has access now" fast for an owner with many users?

**Follow-up rules.**
- when: status column, update status, current status → ask: A request went pending, approved, revoked, re-requested and approved again. If one status column is overwritten, how do you answer "did this user have access last Tuesday"?
- when: form answers, answers table, responses → ask: Who can read those rows, how long are they kept, and what stops them leaking into an analytics table?
- when: licence, license → ask: The declared licence changed between two revisions. Which revision's licence does an access request refer to, and what does your model avoid concluding?
- when: auto approve, automatic, auto-approval → ask: How do automatic approvals appear in "median time to decision"? Should they share a number with manual reviews?
- when: revoke, revocation, revoked → ask: Downloads made before the revocation are still in the logs. How do you report them, and what does the revoked user see?

**Production Reality Check.**
- An owner's dashboard reports a median of 0 hours to decision for a manually reviewed repo: the repo switched from automatic to manual approval mid-month, and the facts used the current mode for every request.
- A nightly export of request data for analysts started including form answers after a schema change added them to the request table as a JSON column.
- After an owner revoked access for many users at once, "users with access" stayed flat for a day: grants were derived only from approvals and a nightly job, with {{daily_requests}} requests a day crowding the queue.

**Evaluation Criteria.** Versioned gate configuration referenced by each request and acceptance; request lifecycle as decision events with actors; grants as intervals that revocations close; licence declarations per revision with no legal conclusions; form answers isolated with access control and retention, never in analytics; precise time-to-decision definitions split by approval mode with pending handled; each incident contained, corrected and guarded.

## HGF-L3-03: Model cards and metadata as data — base models, declared datasets, licences and tags over time

| | |
|---|---|
| **Template ID** | HGF-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / semi-structured card metadata per revision, normalised relations, vocabularies, temporal queries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "model_repos": {"1": ["400,000"], "2": ["2 million"], "3": ["5 million", "9 million"]},
  "daily_card_edits": {"1": ["10,000"], "2": ["80,000"], "3": ["300,000"]},
  "invalid_share": ["2%", "8%"],
  "base_declared": ["35%", "60%"]
}
```

**Business Scenario.** Every model repository can carry a card: a README whose header block holds structured metadata (licence, tags, library, pipeline task, languages, the datasets the model was trained on, and the base model or models it was derived from, with a relation such as fine-tune, adapter, quantised or merge), followed by free text. The {{model_repos}} model repos receive about {{daily_card_edits}} card edits a day, each a commit. About {{base_declared}} of models declare a base model. Metadata is written by people: about {{invalid_share}} of headers contain an unknown tag, a misspelled licence identifier, a dataset that does not exist on the hub, or plain malformed YAML. Search filters, the "models derived from this one" list on a model page and analysts' questions all read this metadata.

**Problem Statement.** Design the data model that turns card headers into queryable data over time. Cover: what is stored per revision (the raw header, the parse result and its errors), the normalised relations (model → base model with relation type, model → dataset, model → tag, model → licence), controlled vocabularies and how unknown values are kept, how references to other repos survive renames, and how to answer "the licence and base model declared on date D", "models whose declared base model changed", "models declaring dataset X, as of now and as of a past date" and "share of cards with a valid header by month". Say what the derivative list reads and how it stays fresh.

**Constraints.** The raw header for every revision is kept; normalised rows can be rebuilt from it when the parser changes. A malformed header never blocks a push and never erases the last good metadata from search. References to other repos are stored by stable repo id where they resolve and as the declared text where they do not. The model records what owners declared, never whether a declaration is true or what a licence permits.

**Assumptions.** Counts and shares are hypothetical. Card edits arrive as commits (repo id, commit, pushed_at, header text). The tag vocabulary and licence identifiers are a curated list that changes a few times a month.

**Clarifications.**
- Q: Should a header that fails to parse appear in search? | A: The repo appears with its last valid metadata, marked as having a header error on the current revision.
- Q: Can a model declare several base models? | A: Yes, for merges; each relation is its own row with its type.
- Q: What if a declared dataset is later renamed on the hub? | A: The reference should still find it; say how.
- Q: Do card edits on non-default branches count? | A: Only the default branch drives search and the model page; other branches are kept as history.
- Q: Who reads the free text? | A: Nobody in analytics: only its length and the presence of standard sections are measured.

**Hints.**
1. Store the raw header per revision and parse it into versioned rows; normalised relations carry the revision they came from (or validity intervals on the default branch).
2. Keep "declared value" and "resolved value" side by side: a dataset reference as written, and the repo id it resolved to, if any.
3. A vocabulary change is a new version of the vocabulary: re-validating old revisions should not rewrite what an owner wrote.

**Follow-ups.**
1. Show the rows written for one card edit that changes the licence, adds a tag that is not in the vocabulary and declares a second base model as a merge.
2. The parser gets a new version that accepts a previously rejected licence spelling. How do you reprocess, and what changes in last month's "valid header" share?
3. How do you answer "the base model declared on 1 March" for a model whose card was edited ten times since?
4. A base model is renamed, then deleted. What does the derivative list on each child show, and what do your relations hold?
5. With {{daily_card_edits}} edits a day, how do you keep the derivative list and search facets fresh within minutes without re-parsing every card?

**Follow-up rules.**
- when: json column, jsonb, variant, store the yaml → ask: Search needs "all models with tag X and licence Y" in milliseconds. What do you index or flatten, and how do you keep it in step with the raw header?
- when: overwrite, latest metadata, current metadata → ask: An analyst asks which licence a model declared last March. Where does that come from in your design?
- when: foreign key, base_model_id, references → ask: About {{invalid_share}} of headers name things that do not resolve. Does your foreign key reject the row, drop the reference or keep it as text?
- when: validate, validation, reject → ask: Does a header that fails validation block the push? What does the model page show while it is broken?
- when: recursive, lineage, descendants → ask: The derivative list follows declared base models. What happens with a declared cycle, and with a base model that is private?

**Production Reality Check.**
- A curated licence list was updated and the nightly re-validation re-parsed every revision; about {{invalid_share}} of models suddenly showed "no licence" in search because unknown values were dropped instead of kept as declared text.
- A popular base model was renamed; the derivative list on its page went from thousands of models to a handful because relations were keyed by the declared owner/name string.
- After a card-template change, merges declared base models as a list in a new field; the parser read only the old single-value field and every merge disappeared from the "models derived from" counts for a week.

**Evaluation Criteria.** Raw header kept per revision with a versioned parse result and errors; normalised relations (base model with type, dataset, tag, licence) tied to revisions or validity intervals; declared versus resolved references, keyed by stable repo id; vocabularies versioned without rewriting what owners wrote; last-good metadata preserved for search; no conclusions about truth or licence meaning; freshness of derived views explained; each incident contained, corrected and guarded.

## HGF-L3-04: Spaces — apps, hardware, builds, sleep and wake, duplicates, and secrets that never reach analytics

| | |
|---|---|
| **Template ID** | HGF-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / app lifecycle states, builds per commit, hardware intervals, duplication lineage, secret handling |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "spaces": {"1": ["100,000"], "2": ["600,000"], "3": ["1.5 million", "3 million"]},
  "daily_builds": {"1": ["40,000"], "2": ["250,000"], "3": ["800,000"]},
  "sleep_hours": [1, 48],
  "hardware_tiers": [4, 8, 12]
}
```

**Business Scenario.** A Space is an app hosted from a git repository on the hub: the owner chooses an SDK (for example a Python UI framework, a static site or a container), pushes code, and each push triggers a build. A running Space uses one of {{hardware_tiers}} hardware tiers, from a free CPU tier to paid GPU tiers, and the owner can change tier at any time. In this exercise a Space with no visitors sleeps after {{sleep_hours}} hours (owners on paid hardware can choose a different sleep time) and wakes when someone visits; sleep rules are this exercise's rule (check current docs). Users can duplicate a public Space into their own account. Owners store secrets (API keys) and variables in the Space's settings. There are about {{spaces}} Spaces and {{daily_builds}} builds a day. The hub wants to understand build failures, time to first running state, hardware hours by tier and how often duplicated Spaces diverge from their source; owners want their own Space's history.

**Problem Statement.** Design the data model. Cover: Spaces and their repos, builds per commit (queued, building, failed with a classified reason, succeeded), the runtime state history (building, running, sleeping, paused, error, deleted), hardware assignments as intervals, wake events and the time from a visit to running, duplication lineage (which Space and commit a duplicate came from), and settings changes. Define facts for "build failure rate by SDK and reason", "hardware hours by tier per day", "median wake time by tier" and "duplicates whose code no longer matches the source". State exactly how secrets are kept out of every analytical table and log.

**Constraints.** Secret values never leave the secrets store: no analytics table, log line, event payload or build-log extract may contain one. Analytics may record that a secret named X was added, changed or removed, by whom and when. Build logs are owner-visible only; analytics sees a classified failure reason. Hardware hours must be reconstructable for any past day. Times are UTC.

**Assumptions.** Counts, tiers and sleep times are hypothetical. Events arrive from the build system and the runtime as (space_id, kind, at, details). A private Space's details are visible only to its owners; aggregates over all Spaces may include it.

**Clarifications.**
- Q: Does a settings change rebuild the Space? | A: A secret or hardware change restarts it; your model should record which commit and settings version each run used.
- Q: Is a duplicate linked to its source after duplication? | A: Only by the record of where it came from; after that it is an independent repo.
- Q: What counts as "running"? | A: The first successful health check after a build or wake.
- Q: Can a build log mention a secret? | A: User code can print anything. Assume a build log may contain a secret value, which is why it stays out of analytics.
- Q: Is a sleeping Space using hardware? | A: No. Hardware hours count only running time.

**Hints.**
1. Keep three histories apart: code (commits and builds), configuration (hardware, sleep time, settings versions), and runtime state (intervals). Each run references a build and a configuration version.
2. Record secrets by name and fingerprint-free metadata only; never hash a secret value into analytics either.
3. Hardware hours are the overlap of "running" intervals with hardware-assignment intervals.

**Follow-ups.**
1. Show the rows written when an owner pushes a commit, the build fails, they fix it, it succeeds, and they move to a GPU tier an hour later.
2. Define "wake time" precisely. Which event starts it, which ends it, and what about a visit while the Space is already waking?
3. Write how you compute hardware hours by tier for one day, including a Space that slept through midnight and changed tier mid-run.
4. A Space was duplicated 5,000 times. How do you answer "how many duplicates still run the source's code", and what does "the same code" mean?
5. An owner reports their secret appeared in a dashboard. Walk through how your design makes that impossible, and what you check first.

**Follow-up rules.**
- when: status column, current state, state field → ask: Hardware hours for last Tuesday need every running interval. If state is overwritten in place, where do those intervals come from?
- when: secret, secrets, api key → ask: Where does the secret value live, which service reads it, and which of your tables could end up containing it by accident?
- when: build log, build logs, logs table → ask: User code can print a secret in its build output. How does a failure reason reach analytics without the log text?
- when: duplicate, duplicated, fork → ask: The source Space is deleted later. What happens to the lineage of its duplicates in your model?
- when: sleep, sleeping, wake → ask: A visitor arrives while the Space is still building after a push. Is that a wake? How does it count in median wake time?

**Production Reality Check.**
- A build-failure classifier started storing the last 20 lines of each failed build log "for debugging" in the analytics table; several contained API keys that user code printed at startup.
- Hardware hours by tier dropped by a third on the day the sleep time changed to {{sleep_hours}} hours: sleep and wake events arrived out of order and the interval builder closed running intervals at the next event of any kind.
- With {{daily_builds}} builds a day, a retry storm after a registry outage created several builds per commit; "build failure rate" counted every attempt and doubled for one SDK.

**Evaluation Criteria.** Separate code, configuration and runtime histories joined by build and configuration versions; runtime state and hardware as intervals; precise wake-time and running definitions; duplication lineage by source Space and commit; build failures classified without log text; secret values confined to the secrets store, with only metadata in analytics and logs; hardware hours from interval overlaps; each incident contained, corrected and guarded.

## HGF-L3-05: Cold starts — requests that reached a scaled-to-zero inference endpoint, and the wait each added

| | |
|---|---|
| **Template ID** | HGF-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / state as of an event, interval boundaries, next-event lookups, at-least-once logs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | HGF-L3-05.mjs |

**Business Scenario.** A team serves {{endpoint_count}} models from the hub on dedicated inference endpoints (table `endpoints`). An endpoint with `min_replicas` 0 scales to zero after `idle_minutes` with no requests, and wakes when a request arrives: the request is held until the first replica is ready (this exercise's rule; check current docs). An endpoint with `min_replicas` 1 never scales to zero. Scaling is logged in `endpoint_events` and requests in `endpoint_requests`; the export covers the UTC day {{day}} and ends at {{cutoff}}. {{kinds_rule}} `replica_ready` is also logged when autoscaling adds a replica to an endpoint that is already serving. The team wants to know, per endpoint, how many requests hit a cold endpoint and how much waiting the cold starts added, to decide which endpoints should keep one replica warm.

**Problem Statement.** Write one PostgreSQL query that returns `endpoint_id, requests, cold_requests, waiting_at_end, total_wait_s, max_wait_s`: one row per endpoint in `endpoints`, ordered by `endpoint_id`. An endpoint's state at a time is set by its latest event with `occurred_at` at or before that time; before its first event it is serving. {{cold_rule}} A request is cold when the endpoint was at zero at its `received_at`. A cold request's wait is the number of seconds from its `received_at` to the endpoint's first `replica_ready` after `received_at`; if there is no such event in the export, the request counts in `waiting_at_end` and has no wait. `requests` counts the endpoint's requests, `cold_requests` its cold requests (including those in `waiting_at_end`), and `total_wait_s` and `max_wait_s` are the sum and maximum of the waits, 0 when there are none. {{feed_rule}}

**Constraints.** One SQL statement (CTEs allowed). The boundaries matter: a request at exactly the second of `scaled_to_zero` is cold, and a request at exactly the second of `replica_ready` is served. Two events of the same endpoint never share a second. The sample has {{events}} events and {{requests}} request rows; production holds billions of requests a month across many endpoints.

**Assumptions.** Hypothetical endpoints, repos, instance types, times and rules. Timestamps are whole seconds. `logged_at` is when the request row reached the log store and plays no part in the state.

**Clarifications.**
- Q: Is a request that arrives right before an autoscaling `replica_ready` a cold start? | A: No. The endpoint was serving when it arrived; the new replica only adds capacity.
- Q: Does `idle_minutes` enter the query? | A: No. The events already record when each endpoint scaled to zero; idle_minutes explains why.
- Q: Should endpoints with no requests appear? | A: Yes, with zeros. The decision is about every endpoint.
- Q: Which `replica_ready` ends a cold request's wait? | A: The first one strictly after the request arrived. Failed starts in between do not end it.
- Q: How do I get whole seconds from two timestamps? | A: `EXTRACT(EPOCH FROM later - earlier)` returns seconds.

**Hints.**
1. For each request, find the endpoint's latest event at or before `received_at` (a LATERAL subquery with ORDER BY … DESC LIMIT 1, or a window over a union of events and requests). That kind decides cold or not.
2. For cold requests, find the first `replica_ready` strictly after `received_at`; a missing one means the request was still waiting at the end.
3. Aggregate per endpoint with `COUNT(*) FILTER (WHERE …)`, starting from `endpoints` with a LEFT JOIN.

**Follow-ups.**
1. Rewrite the state lookup without LATERAL, using window functions over a union of events and requests. What breaks if an event and a request share a second?
2. At billions of requests a month, how would you precompute the at-zero intervals per endpoint so this becomes a range join, and which index or clustering serves it?
3. Add the p90 wait per endpoint. Which aggregate do you use in PostgreSQL, and what changes in an engine without an exact percentile?
4. The team wants the cost of keeping one replica warm against the waits it would save. What extra data do you need, and what assumption about traffic does the comparison make?

**Follow-up rules.**
- when: lead(, lag(, next event → ask: The next event after a request can be an autoscaling replica_ready while the endpoint is serving. Does your LEAD/LAG approach call that request cold?
- when: inner join, join endpoint_requests → ask: Which endpoints disappear when you start from the requests, and are any of them ones the decision needs?
- when: between → ask: BETWEEN includes both ends. What does it do to a request at exactly the second a replica became ready?
- when: logged_at → ask: Why can logged_at be later than received_at, and which of the two belongs in the state lookup?
- when: start_failed → ask: After a failed start, is the endpoint still at zero? Which event ends the wait of a request that arrived after the failure?
- when: distinct → ask: What exactly does your DISTINCT remove? Two genuine requests can arrive at the same second for the same endpoint.

**Production Reality Check.**
- A status-code dashboard showed almost no cold starts on {{day}} because held requests eventually returned success; this query, which reads scaling events, showed several endpoints adding minutes of waiting, longer than many callers were willing to wait.
- An earlier version of this report paired each scale-to-zero with the next event of any kind; on days with failed starts it showed short waits exactly when callers saw the longest ones.
- A log-store consumer restart redelivered request rows; a version that counted raw rows inflated cold requests on the busiest endpoints and the team nearly paid for warm replicas that were not needed.

**Evaluation Criteria.** State taken from the latest event at or before each request with exactly the stated boundaries; autoscaling `replica_ready` not mistaken for a wake; the wait ended by the first `replica_ready` after arrival, not by a failed start; open cold periods counted as waiting with no wait; every endpoint present via a LEFT JOIN from `endpoints`; at the hardest level, paused requests not cold, resumed treated as at zero, and one row per request_id; deterministic ordering; can explain interval precomputation and percentiles.
