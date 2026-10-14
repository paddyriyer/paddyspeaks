# Hugging Face · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of an open hub of
models, datasets and Spaces apps: git-based repositories with large-file
storage, model and dataset cards, gated repositories, community discussions and
hosted inference endpoints. Repositories, cards and datasets are user content.
Every workload, threshold, number and schema is hypothetical; product rules used
here are this exercise's rules (check current docs), and nothing here describes
how any company's hub, storage or services are actually built.

## HGF-L4-01: Download analytics at hub scale with a published counting rule

| | |
|---|---|
| **Template ID** | HGF-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Usage analytics / published counting rules, bots and mirrors, restatements |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "repos": {"2": ["1.5 million", "3 million"], "3": ["8 million", "15 million"]},
  "daily_requests": {"2": ["800 million", "2 billion"], "3": ["6 billion", "12 billion"]},
  "mirror_share": ["10%", "25%", "40%"],
  "restate_days": [30, 90, 180]
}
```

**Business Scenario.** An open hub hosts {{repos}} public model and dataset repositories. Every file a client fetches is a request at the hub's download edge, {{daily_requests}} file requests a day in total. Fetching one model usually means many requests: a configuration file, a tokenizer, several weight shards, sometimes the same files again on every run. Each repository page shows a download count for the last 30 days and all-time, and authors quote these numbers in papers and launch posts. Some clients are not people at all: CI jobs that re-fetch on every build, caching mirrors run by companies and universities (known mirrors account for {{mirror_share}} of all requests), and crawlers.

**Problem Statement.** Design the download analytics system. Define the counting rule you would publish (which requests count as one download, in this exercise's terms), and design the path from raw edge request logs to per-repository counts, the per-repository dashboard, the exclusion of mirrors and automated traffic, and restatements: how a count is corrected when a source of bad traffic is found later, going back at most {{restate_days}} days.

**Constraints.** A repository page reads its counts in under 50 ms at p99. Counts may lag by up to a day, but a provisional number for today should appear within an hour. Raw logs contain network addresses and client identifiers; nothing that identifies a person may be kept longer than this exercise's 30-day raw-log retention, and per-user download lists are never shown to anyone. The rule must be published so that an author can check, in principle, why a number is what it is.

**Assumptions.** All volumes and shares are hypothetical. In this exercise a repository can designate which of its files count (a configuration file by default), and a library can declare the designated files for the repositories that use it; check current docs for the hub's actual rule. The mirror list is maintained by the hub and changes a few times a month.

**Clarifications.**
- Q: Does fetching ten weight shards count as ten downloads? | A: Under this exercise's rule only requests for designated files count, so a normal fetch counts once; you decide how repeats are collapsed and say why.
- Q: Do HEAD requests and cache revalidations count? | A: Your call. State what you count, and what a client that checks for updates on every run does to your number.
- Q: Should mirrors count at all? | A: One fetch by a mirror can serve thousands of people the hub never sees. Decide whether to exclude, count once, or show separately, and publish it.
- Q: Who can see per-country or per-organisation breakdowns? | A: Nobody, in this exercise. Authors see totals, a daily series and the share of traffic excluded, by reason.
- Q: Can a count ever go down? | A: Yes, after a restatement. Say how the author finds out.

**Hints.**
1. Write the counting rule down first as a function from one request to "counts", "excluded (reason)" or "ignored". Everything else implements and versions that function.
2. Keep two paths: an approximate, fast provisional count and an exact daily count recomputed from retained logs. Only the daily count is final.
3. A restatement is a new version of a day's numbers, not an edit. Keep enough per-day detail (counted and excluded, by reason and rule version) that you can recompute or explain any day.

**Follow-ups.**
1. Walk one request for a designated file from the edge log to the number on the repository page. Where can it be counted twice, and what stops that?
2. How do you collapse repeated fetches by the same client in a day without keeping a per-user list longer than the retention allows?
3. A university mirror asks to be removed from the mirror list because it wants its users counted. What do you need before you agree, and what changes in the numbers?
4. A bot source is identified today that has been active longer than {{restate_days}} days. How do you correct what you can, and what do you say about the days you cannot?
5. An author says their count dropped by half overnight with no change to their repository. How do you investigate, and what monitor would have caught it first?

**Follow-up rules.**
- when: hyperloglog, hll, approximate distinct, sketch → ask: Your sketch has about 1% error. Is a final, published count allowed to be approximate, and does the error matter for a repository with 40 downloads?
- when: user id, user_id, account, logged in → ask: Most fetches are anonymous. What identifies a client for de-duplication, and how long do you keep it?
- when: overwrite, update in place, upsert → ask: An author asks what the number was before last month's correction. Where does your design keep that?
- when: real-time, streaming, flink, kafka → ask: Which number on the page comes from the stream, which from the daily job, and what happens when they disagree?
- when: user agent, user-agent, bot list → ask: A CI system changes its client string every release. How does your exclusion keep up, and how do you know it has fallen behind?

**Production Reality Check.**
- A popular CI template starts fetching one model's designated file on every job without a cache. That model's counted downloads rise forty-fold in two days, and its author cites the number in a launch post before anyone notices.
- A new release of a widely used client library skips the designated file when its local cache is warm. Counted downloads for thousands of repositories fall by a third on the day it ships, while total file requests do not fall.
- One of the listed mirrors, which on its own carries a large part of the {{mirror_share}} mirror traffic, changes its client identifier without notice, and for a week its requests are counted as ordinary downloads.
- A network of automated clients is identified whose traffic began before the oldest day you restate ({{restate_days}} days back); some repositories' all-time counts are inflated by it.

**Evaluation Criteria.** Publishes an explicit, versioned counting rule (designated files, repeat collapsing per client and day, excluded categories) and implements it as one function; separates a provisional fast count from an exact daily recomputation; client de-duplication that respects retention (rotating salted identifiers, no per-user lists); mirrors and automated clients handled through a maintained registry with effective dates and shown as excluded shares; restatements as new versions with a visible changelog on the repository and a stated limit; serving from precomputed aggregates; monitors on ratios (designated to all file requests, per library version) that catch client changes; adapts to each incident with diagnosis, correction and prevention.

## HGF-L4-02: Inference endpoint telemetry with scale-to-zero and cold starts

| | |
|---|---|
| **Template ID** | HGF-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Observability / autoscaling, scale-to-zero, cold starts, per-endpoint latency |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | ai-infra-engineer, ml-platform-engineer, software-engineer, senior-data-engineer, staff-data-engineer, data-engineer |

```params
{
  "endpoints": {"2": ["15,000", "40,000"], "3": ["120,000", "300,000"]},
  "regions": [3, 5, 8],
  "idle_minutes": [15, 30, 60],
  "peak_rps": {"2": ["60,000", "150,000"], "3": ["600,000", "1.5 million"]}
}
```

**Business Scenario.** Customers deploy models from an open hub as dedicated inference endpoints. For each endpoint they pick hardware, a minimum and maximum number of replicas, and an autoscaling target; the platform adds replicas as load per replica rises and removes them as it falls. In this exercise an endpoint with a minimum of zero scales to zero after {{idle_minutes}} minutes without requests, and the next request waits for a cold start: a replica is scheduled, its image pulled, the model weights fetched and loaded onto the accelerator (this exercise's rule; check current docs). There are {{endpoints}} endpoints across {{regions}} regions, serving {{peak_rps}} requests per second at peak in total. Each request passes a router in front of the endpoint's replicas.

**Problem Statement.** Design the telemetry system. Customers need, per endpoint: request rate, latency percentiles, errors by kind, replica count over time, and every cold start with how long it took and how many requests it delayed. The platform needs fleet-wide views and an audit of every autoscaling decision with the inputs that caused it. Cover what is emitted (router, replicas, lifecycle events, autoscaler), how it is collected across regions, stored and queried, and how late or missing data is shown.

**Constraints.** Dashboards are at most one minute behind. Full-resolution data is kept 30 days and coarser data for a year. Request and response bodies are customer data and never enter telemetry; only metadata does. Telemetry must keep working, and say so honestly, when a region's collectors fall behind.

**Assumptions.** All volumes, timings and targets are hypothetical. Replicas expose a health check; the router knows how many requests are queued per endpoint. Customers may run very different models, so a cold start can take seconds or many minutes.

**Clarifications.**
- Q: Where is latency measured? | A: You decide, but customers care about what their clients experienced, including time spent waiting for a replica.
- Q: Is a request that times out while an endpoint is waking an error of the endpoint? | A: It is something the customer must be able to see and explain. Decide how it is labelled.
- Q: How detailed is the autoscaling audit? | A: For each decision: time, endpoint, old and new replica counts, the metric values and target that drove it, and the policy version.
- Q: Can customers export their telemetry? | A: Yes, as metrics and as a stream of lifecycle events.

**Hints.**
1. Model each replica's life as a sequence of events (scheduled, image pulled, weights loaded, ready, unhealthy, terminated). A cold start is a span you can derive from those events plus the router's queue.
2. Percentiles cannot be averaged across replicas or regions. Store mergeable histograms and compute percentiles at query time.
3. Distinguish "zero" from "no data". A dashboard that draws missing data as zero turns a collection delay into a fake outage.

**Follow-ups.**
1. Define a cold start precisely: when does it begin, when does it end, and which requests are attributed to it?
2. Estimate the number of time series and points per second at {{endpoints}} endpoints, and say which labels you refuse to put on a metric.
3. How do customers see requests the router rejected or timed out while no replica existed?
4. The autoscaler and the dashboard disagree about how busy an endpoint was. Which one is right, and how would you prove it?
5. How would you reduce what telemetry costs per idle endpoint, given that most endpoints are idle most of the time?

**Follow-up rules.**
- when: average, mean latency, avg → ask: Average latency hides cold starts. Which percentile does a customer with occasional cold starts care about, and how do you compute it across replicas?
- when: replica logs, replica metrics, sidecar → ask: While an endpoint has zero replicas there is nothing to emit from. Where do the failed requests of that period show up?
- when: prometheus, scrape, pull → ask: A replica lives for forty seconds before it crashes. Does your scrape interval ever see it?
- when: request id, request_id, per-request → ask: At {{peak_rps}} requests per second, how long can you afford to keep per-request records, and what do you keep instead?
- when: payload, request body, prompt → ask: What exactly in your telemetry could contain customer data, and what stops it from getting there?

**Production Reality Check.**
- An endpoint serving a large model takes eleven minutes to become ready after scaling to zero. Its clients see timeouts the whole time, but the endpoint's dashboard shows no requests and no errors for those minutes, because only replicas report metrics.
- One replica of a busy endpoint restarts in a loop after running out of accelerator memory on long inputs. The endpoint's error rate stays under 1% because the router retries elsewhere, but latency doubles and the autoscaler still counts the replica as capacity.
- Collectors in one of the {{regions}} regions fall 35 minutes behind. Dashboards for its endpoints show them idle, and customers whose minimum is zero ask whether their endpoints scaled down after {{idle_minutes}} minutes.

**Evaluation Criteria.** Measures at the router (client-perceived latency, queueing, rejections) as well as at replicas; replica lifecycle as an event log from which cold starts and their phases are derived; mergeable histograms with bounded label cardinality; an autoscaler decision log with inputs and policy version; regional collection with event-time handling and an explicit "data delayed" state; no request or response content in telemetry; tiered retention and cost control for idle endpoints; adapts to each incident with diagnosis, recovery and prevention.

## HGF-L4-03: Large-file storage for repositories: deduplication, garbage collection and quotas

| | |
|---|---|
| **Template ID** | HGF-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage systems / content addressing, cross-fork deduplication, safe garbage collection, quotas |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "stored": {"2": ["15 PB", "40 PB"], "3": ["150 PB", "400 PB"]},
  "daily_upload": {"2": ["60 TB", "200 TB"], "3": ["1 PB", "3 PB"]},
  "grace_days": [7, 14, 30],
  "fork_share": ["30%", "50%", "70%"]
}
```

**Business Scenario.** Repositories on an open hub are git repositories, but large files (weights, dataset shards) are stored outside git: the commit holds a small pointer naming the file's content hash and size, and the bytes live in an object store addressed by that hash. The hub holds {{stored}} of large files and receives {{daily_upload}} of new uploads a day before deduplication. Duplication is everywhere: forks, re-uploads of the same weights under a new name, fine-tunes that change a few layers, datasets that append shards. In a sample, {{fork_share}} of newly pushed large-file bytes already existed somewhere on the hub. Users delete files, branches and whole repositories, and sometimes rewrite history to reclaim space. Each account has a storage quota.

**Problem Statement.** Design large-file storage for repositories: how objects are addressed, uploaded and verified; how duplicates are stored once (whole files, and optionally parts of files); how storage no longer referenced by any branch, tag or retained revision is reclaimed safely, with a grace period of {{grace_days}} days; and how storage is counted against quotas when one object is shared by many repositories and accounts.

**Constraints.** A byte referenced by any commit reachable from a branch or tag must never be deleted. Downloads verify the content hash. An upload of a file that already exists should not transfer it again. Quota numbers shown to a user must be explainable from their own repositories.

**Assumptions.** All sizes, rates and shares are hypothetical. In this exercise clients upload large-file bytes first and then push the commit that references them; a long upload can take hours. Check current docs for how the hub actually stores large files.

**Clarifications.**
- Q: Whole-file or chunk-level deduplication? | A: Your choice. Say what each saves for a fine-tune that changes 5% of a model's bytes, and what each costs in metadata.
- Q: Does deleting a branch delete its files? | A: Only when nothing else still references them. Revisions reachable from another branch or tag, or from another repository, keep them.
- Q: Are private repositories deduplicated against public ones? | A: Decide. Say whether dedup could reveal to someone that a private file exists.
- Q: Does a fork count against the forker's quota? | A: Your rule; publish it and make sure the forker can understand it.

**Hints.**
1. Content addressing makes deduplication and integrity checks the same mechanism: the address is the hash of the bytes.
2. A reference index (which commits point at which objects) maintained on every push and delete is easier to keep correct than a reference count per object.
3. The dangerous moment in garbage collection is an object that looks unreferenced while an upload or a deduplicated push is about to reference it again.

**Follow-ups.**
1. Walk through uploading a 300 GB checkpoint where 90% of the bytes already exist on the hub. What is transferred, what is written, and when does the commit become visible?
2. How does garbage collection decide an object can go, and what makes it safe against an upload that finishes just after the decision?
3. A fine-tune changes a few layers in the middle of a large file. What would chunk-level deduplication need so that an insertion does not change every chunk after it?
4. Define the quota rule for shared objects. What does an organisation see after it rewrites history on a repository that has hundreds of forks?
5. How would you find out that a stored object's bytes no longer match its hash before a user does?

**Follow-up rules.**
- when: refcount, reference count, ref count → ask: A delete and a fork happen at the same moment on a repository holding a 200 GB file. Walk through how the count can end up wrong, and what that costs.
- when: chunk, chunking, content-defined → ask: How many chunks does {{stored}} come to at your chunk size, and where does the index for them live?
- when: delete immediately, hard delete, purge → ask: A user deletes a repository by mistake and asks for it back the next morning. What can you restore?
- when: physical bytes, deduplicated size, actual storage → ask: Charging physical bytes means the first uploader pays and every later one is free. Is that the incentive you want?
- when: s3, object store, bucket → ask: How many objects is that, and what does listing them all for garbage collection cost?

**Production Reality Check.**
- Garbage collection deletes an object that a push referenced minutes earlier. The object had been unreferenced for longer than {{grace_days}} days, and the new upload skipped transferring it because deduplication found it still present, in the window between the collector's decision and its delete.
- A user forks a 700 GB model to fix one line of its model card and is told they are over quota, although no new large-file bytes were stored.
- An organisation squashes the history of a large repository to free space; its usage barely drops, because {{fork_share}} of those bytes are also referenced by forks and other repositories.
- A storage node returns bytes for a popular weights file that do not match the file's hash. Downloads of that file fail intermittently for an hour before anyone looks.

**Evaluation Criteria.** Content-addressed objects with hash verification on write and read; upload protocol that checks existence first and commits only after bytes are durable; deduplication at file level with a reasoned choice about content-defined chunks and their index; a reference index or periodic mark from all retained refs instead of fragile per-object counts; two-phase deletion (candidate, grace, delete) where any new reference, including a dedup hit, cancels the deletion atomically; a published quota rule for shared objects that users can verify; scrubbing and repair from replicas; adapts to each incident with diagnosis, recovery and prevention.

## HGF-L4-04: Scanning pushed files for unsafe formats and committed secrets

| | |
|---|---|
| **Template ID** | HGF-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Security pipelines / content scanning queues, rescans, results on the repository |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-engineer, ml-platform-engineer, ai-infra-engineer |

```params
{
  "pushes_per_hour": {"2": ["40,000", "90,000"], "3": ["300,000", "700,000"]},
  "files_total": {"2": ["300 million", "600 million"], "3": ["2 billion", "5 billion"]},
  "scan_minutes": [5, 15, 30],
  "rule_releases": ["weekly", "twice a month", "monthly"]
}
```

**Business Scenario.** An open hub accepts {{pushes_per_hour}} pushed files an hour from anyone with an account and holds {{files_total}} files in total. Every pushed file is scanned. Some model files use serialisation formats that can run code when they are loaded (for example, Python pickle-based checkpoints), so a scanner inspects them without loading them and reports what they would import or call; other formats store only tensors and metadata. Text files are scanned for committed credentials such as access tokens and keys, and all files for known malicious content. Each file's status appears on the repository page: no issue found, flagged (with a reason), not yet scanned, or scan failed. The scanners' rules are updated {{rule_releases}}, and a rule update can change the result for files already scanned.

**Problem Statement.** Design the scanning pipeline: how pushes become scan jobs, how jobs are queued, prioritised and run, how results are stored and shown on repository pages, how rescans after a rule update are scheduled, and how owners are told about findings. A new file's status should be known within {{scan_minutes}} minutes. Describe detection only in general terms; the design is about the pipeline, not about the rules.

**Constraints.** Scanners never execute or load the files they scan, and run isolated with limits on memory and time. A detected credential is shown only to the repository's owners, never publicly, and its value never enters logs or analytics. Every change of a file's status is kept with its scanner and rule version, so the history of a warning can be explained.

**Assumptions.** All volumes, rates and timings are hypothetical. Large files are content-addressed, so the same bytes in many repositories have one content hash. Check current docs for how the hub actually scans files and what it shows.

**Clarifications.**
- Q: Is the push blocked until the scan finishes? | A: No, in this exercise pushes are accepted and the status shows "not yet scanned" until a result exists. Say what a downloader sees meanwhile.
- Q: Are identical files in different repositories scanned separately? | A: Your decision; say how a result is shared and what happens if the repositories have different owners.
- Q: Who can dispute a finding? | A: The repository owner. A dispute is reviewed by people and can override a result for that file and rule version.
- Q: What happens to a credential found in an old commit? | A: It stays in history unless the owner rewrites it; the owner must be told so they can revoke it.

**Hints.**
1. Key results by (content hash, scanner, rule version). The same bytes need scanning once per rule version, however many repositories hold them.
2. New pushes and rescans compete for the same scanners. Give them separate lanes with explicit shares, so a rescan can never starve fresh uploads.
3. A file that crashes the scanner every time is a poison message. Decide in advance how many attempts it gets and what status it ends with.

**Follow-ups.**
1. Trace one pushed checkpoint from the push to the status on its file page. Which steps are idempotent, and what happens if a worker dies halfway?
2. A rule release arrives. How long does rescanning {{files_total}} files take with your capacity, and in what order would you rescan?
3. How do you notify an owner about a committed credential without the notification itself exposing it?
4. A finding is overturned on dispute. What changes on the page, in the history, and in the numbers you report about flagged files?
5. How would you notice that a new rule is producing far too many findings before owners are flooded with them?

**Follow-up rules.**
- when: block the push, reject the push, synchronous → ask: A 200 GB push now waits on a scan before it is accepted. What does the uploader see, and what happens when the scanners are behind?
- when: queue, kafka, sqs → ask: One repository pushes 50,000 small files at once. How does your queue keep that from delaying everyone else's scans?
- when: retry, retries, dead letter, dlq → ask: The same file fails on every attempt. What status does its page show after the last one, and who is told?
- when: notify, email, alert → ask: A rule flags 10,000 files in one organisation overnight. How many messages do its owners get?
- when: cache result, by hash, content hash → ask: Two repositories share a file, and one owner wins a dispute about it. Does the other repository's warning disappear too?

**Production Reality Check.**
- A rule release queues a rescan of all {{files_total}} files on the same queue as new pushes. Fresh uploads wait nine hours, far beyond {{scan_minutes}} minutes, and their pages say "not yet scanned".
- A malformed file makes the scanner run out of memory. The job is retried without limit, and its partition of the queue stops moving for half a day.
- A credential rule released {{rule_releases}} starts matching long hexadecimal strings. A dataset of file checksums produces two million findings and floods one owner with notifications.
- A popular model is flagged by mistake and shows a warning for a week before a dispute overturns it; its owner asks how many people saw the warning and what will stop it happening again.

**Evaluation Criteria.** Push events turned into idempotent jobs keyed by content hash and rule version; separate lanes for new pushes and rescans with fair shares per repository or organisation; isolated scanners with resource limits and a bounded-attempt poison-message policy ending in an explicit "scan failed" status; a results store with history of status changes and versions, joined to file pages through the pointer's hash; private, de-duplicated owner notifications that never carry the secret; a dispute workflow with audit; monitoring of time-to-status, backlog age and per-rule finding rates with a release guard for new rules; adapts to each incident with diagnosis, recovery and prevention.

## HGF-L4-05: Discussions, pull requests and moderation on repositories

| | |
|---|---|
| **Template ID** | HGF-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Community systems / notifications fan-out, moderation queues, per-repo community metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, data-engineer |

```params
{
  "active_repos": {"2": ["400,000", "900,000"], "3": ["4 million", "9 million"]},
  "comments_per_day": {"2": ["150,000", "400,000"], "3": ["2 million", "5 million"]},
  "top_followers": ["200,000", "800,000", "2 million"],
  "report_hours": [4, 12, 24]
}
```

**Business Scenario.** On an open hub every repository has a community tab: discussions, and pull requests that propose commits on a separate reference for a maintainer to review and merge. {{active_repos}} repositories have community activity, with {{comments_per_day}} comments a day. Users watch repositories and follow people and organisations, and are notified in the app and by email about mentions, replies, new pull requests and new releases from what they follow; the most-followed organisation has {{top_followers}} followers. Anyone can report a comment, discussion or repository; in this exercise reports are reviewed within {{report_hours}} hours, and moderators can hide content or restrict accounts. Maintainers see community metrics for their repositories.

**Problem Statement.** Design the community system: the data model for threads, comments, pull requests and their state changes; notification fan-out to watchers and followers, in the app and by email; moderation from report to decision, and what a decision does everywhere the content has already gone; and per-repository community metrics (open threads, time to first maintainer response, pull requests merged) that stay correct when content is hidden, deleted or found to be spam.

**Constraints.** A mention or a reply reaches the person within a minute; announcements to followers within 15 minutes. Hidden content disappears from the repository page, search and any notification not yet sent. Repositories can be renamed or transferred without breaking threads or links. Metrics must be explainable: a maintainer can see which threads a number counts.

**Assumptions.** All volumes and targets are hypothetical. Accounts can be new and unverified. Check current docs for how the hub's discussions and pull requests actually behave.

**Clarifications.**
- Q: Is a pull request here the same as on a code host? | A: Close enough: commits on a separate reference, with comments and a merge by a maintainer. You may treat it as a thread with a reference attached.
- Q: Who counts as a maintainer for "first maintainer response"? | A: Anyone with write access to the repository at the time of the response. Decide what happens when access changes.
- Q: Do followers of an organisation get every new repository? | A: They get new public repositories and releases; you can batch them into a digest.
- Q: Are reports anonymous? | A: To the reported person, yes. Moderators see who reported.

**Hints.**
1. Store threads and comments as an append-only log of events keyed by a stable repository id; pages, notifications, search and metrics are projections of that log.
2. Fan-out on write is cheap for small audiences and ruinous for {{top_followers}} followers; fan-out on read is the reverse. Most systems mix them.
3. A moderation decision is itself an event that every projection must apply, including ones that already copied the content somewhere.

**Follow-ups.**
1. Walk a mention in a comment from the moment it is posted to the notification. What is the path, and where can it be delayed by somebody else's traffic?
2. How do you deliver one announcement to {{top_followers}} followers without delaying everyone's mentions?
3. A report arrives about a comment that has already been sent by email to 3,000 watchers. What can you still undo, and what do you change so it happens less?
4. Define "median time to first maintainer response" precisely. What does it do when spam threads are removed a week later?
5. How would you detect a coordinated spam wave early, without blocking a real launch that brings thousands of new users at once?

**Follow-up rules.**
- when: fan-out on write, push model, write fan-out → ask: The organisation with {{top_followers}} followers posts. How many writes is that, how long do they take, and what waits behind them?
- when: websocket, real-time, push notification → ask: Two million users follow one organisation and half are offline. Where do their notifications wait, and for how long?
- when: delete, deleted, hard delete → ask: Moderators need the evidence for an appeal after the content is removed from view. Where does it live, and who can see it?
- when: repo name, repository name, slug → ask: A repository is renamed and transferred to another owner. Which of your keys still find its threads?
- when: metrics table, counter, increment → ask: Five hundred spam threads are removed from a repository a week later. How does your counter learn about it?

**Production Reality Check.**
- The organisation with {{top_followers}} followers publishes a model. Notification fan-out builds a backlog, and every user's notifications, mentions included, arrive three hours late.
- New accounts open discussions on 50,000 repositories within an hour. The moderation queue grows far past {{report_hours}} hours, and the community metrics of the affected repositories jump.
- A comment hidden by a moderator still appears in search results for a day and in emails that had already been queued.
- A repository with hundreds of open pull requests is transferred to a new organisation; links in old notifications return not found, and its "first maintainer response" times attribute replies to people who no longer have access.

**Evaluation Criteria.** An event-log data model keyed by stable ids (repositories, threads, comments) with projections for pages, search, notifications and metrics; hybrid fan-out with separate priority lanes so announcements never delay mentions; delayed, batched email for low-priority notifications so moderation can still catch them; moderation as events applied to every projection, with evidence retained for appeals; spam controls described generally (new-account limits, burst detection, holds) with a plan for launch-day spikes; metrics recomputable from the log with exclusions and a precise definition of maintainer response; renames and transfers handled by ids and redirects; adapts to each incident with diagnosis, recovery and prevention.
