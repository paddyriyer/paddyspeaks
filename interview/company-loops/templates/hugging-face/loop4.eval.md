# Hugging Face · Loop 4 — evaluator notes (hidden from candidates)

## HGF-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **The rule, written once**: a versioned function `classify(request) → counts | excluded(reason) | ignored`. In this exercise: only successful GET requests (HEAD optional, but stated) for a repository's designated files are candidates; repeats by the same client for the same repository on the same UTC day collapse to one; requests from listed mirrors, declared automated clients and identified bot sources are `excluded(reason)`; everything else is `ignored`. The rule text and its version history are published, with "this exercise's rule; check current docs" for the hub's real rule.
- **Ingestion**: edge request logs (`ts, repo_id, revision, path, method, status, bytes, client_key, client_agent, edge_region`) land in a durable log partitioned by `repo_id` hash, then in a raw table partitioned by day. `client_key` is a salted hash of network address and client string with a salt that rotates daily, so repeats within a day collapse but clients cannot be followed across days; raw rows are deleted after the 30-day retention. Repository ids are stable across renames.
- **Provisional path**: a stream job applies the same `classify` (shared library, same version) and keeps per (repo, day) approximate distinct client sketches; it serves "today so far, provisional" within the hour. Hot repositories are salted across partitions and merged.
- **Final path**: a daily batch job, after a lateness bound, recomputes each day exactly from the raw table: `daily_downloads(repo_id, day, rule_version, counted, excluded_mirror, excluded_automated, excluded_bot, designated_requests, all_file_requests)`. Exact distinct counting per (repo, day) is affordable: the number of (repo, client) pairs per day is bounded by requests.
- **Serving**: a key-value or columnar serving store holds per-repo daily series and precomputed rolling 30-day and all-time sums for the current version; the page reads one key (p99 under 50 ms).
- **Mirror and bot registry**: `client_category(match, category, effective_from, effective_to, source)`. Changes are versioned; a change with an effective date in the past triggers a restatement of the affected days.
- **Restatement**: recompute affected days from raw logs while they are retained (30 days), or, for days up to `restate_days` back, from retained per-day aggregates by category (`designated_requests` broken down by client category is kept for the full window). Write a new version, swap atomically, keep the old one, and show a changelog entry on the repository ("counts for these days restated on DATE: reason"). Days older than the window are annotated as not restated, never silently left.
- **Monitors**: per-library-version ratio of designated-file requests to all file requests; per-repo day-over-day spikes relative to its own history, with a share from a single client category; sum checks `counted + excluded + ignored = all requests` per day.

**Competing designs to accept.** Counting one per fetch session instead of per client per day, if defined and published. Showing mirrors as a separate line rather than excluding them. Exact distinct counts in the stream, if the candidate sizes the state. A warehouse-only design with hourly batch for the provisional number.

**Bottlenecks and failure modes.** Hot repositories after a big release; client-string churn breaking exclusions; library changes that move which file is fetched; restatements that need logs past retention; dashboards that mix provisional and final numbers without saying so.

**Incident guidance.**
- *Forty-fold CI spike*: the per-client-per-day collapse limits a single runner but not thousands of ephemeral runners with different addresses. Diagnose from the share of the spike coming from one client agent and short-lived clients; decide under the published rule whether the traffic is automated; if the rule did not cover it, update the rule (new version) and restate with a visible note. Prevention: spike monitors relative to the repo's history, and a published category for CI traffic.
- *Library skips the designated file*: total requests are flat while designated requests fall, concentrated in one client version; the ratio monitor catches it. Fix with the library maintainers (designate the file actually fetched, or have the client send it) and annotate the affected days; restate only if the rule allows counting another file for that library version.
- *Mirror changes its identifier*: its requests inflate counts for a week. Add the new identifier with an effective date a week back, restate those days (inside retention), and post the changelog. Prevention: monitor mirror share against its usual level and ask mirrors to register identifiers.
- *Bot traffic older than the window*: restate the days inside `restate_days`; for older days publish an explicit note that all-time counts include traffic later identified as automated, with an estimate if aggregates allow. Never edit beyond what the retained data supports.

**Follow-up guidance.** Push on how de-duplication works without lasting identifiers, on what an author sees after a restatement, and on whether the provisional and final numbers can disagree visibly.

**Rubric anchors.** 2: counts every request or every file, no mirror or bot handling, overwrites history. 3: a published rule implemented once, per-client-day collapse with privacy, exclusions with reasons, daily exact recomputation, versioned restatements. 4: also the shared classify function in both paths, aggregates kept to support restatement beyond raw retention, ratio monitors that catch client changes, and crisp handling of every incident.

**Strong signals.** Writes the counting rule before the architecture; treats restatements as versions with a changelog. **Red flags.** Per-user download histories kept indefinitely; approximate final numbers without saying so; "filter bots by user agent" as the whole answer.

## HGF-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Emitters**: (1) the router emits, per endpoint and 10-second interval, request counts by outcome (served, error from replica, rejected because no replica, timed out while queued), latency histograms measured from arrival at the router to response (client-perceived, including queueing), and queue depth; (2) replicas emit model-side latency histograms, accelerator memory and utilisation, and health; (3) the orchestrator emits replica lifecycle events (`scheduled, image_pulled, weights_loaded, ready, unhealthy, restarted, terminated` with reasons); (4) the autoscaler emits a decision record (`ts, endpoint_id, from, to, inputs (metric values, target), policy_version, reason`). No request or response bodies anywhere; schemas are allow-lists.
- **Collection**: per-region collectors aggregate into histograms per (endpoint, interval) and forward to a regional time-series store and a durable log; events go to an event store. Labels are bounded: endpoint id, region, outcome class, replica id only on replica-level series (short-lived); never request ids, user ids or input sizes as labels.
- **Cold starts**: derived from events: begins when a request arrives (or queues) with zero ready replicas, ends at the first ready replica's first response; attributed requests are those queued in that span; phases (scheduling, image pull, weight download, load) come from lifecycle timestamps. Stored as a `cold_start` record per occurrence and shown on the dashboard timeline.
- **Storage and query**: full-resolution histograms for 30 days, rolled to 5-minute and hourly for a year; percentiles computed from merged histograms at query time. Idle endpoints emit nothing per interval; the absence of data is distinguished from zero by a per-region collector watermark ("data complete up to T").
- **Late data**: event-time intervals; the dashboard shows "delayed" for intervals after the region's watermark instead of zero; late data fills in and the view updates.
- **Customer export**: metrics API and a lifecycle-event stream per endpoint.
- **Scale estimate**: e.g. 300,000 endpoints, most idle; active ones with ~10 series of histogram buckets per 10 s; the candidate should produce an order of magnitude and say what dominates (histogram buckets for active endpoints).

**Competing designs to accept.** Scraping replicas with a pull model if they handle short-lived replicas (push on termination, or router-side metrics). OpenTelemetry-style pipelines. Per-request logs sampled for debugging with short retention. A single global store with regional buffering.

**Bottlenecks and failure modes.** Telemetry gaps exactly when there are no replicas; cardinality blow-up from per-replica or per-request labels; averaging percentiles; missing data drawn as zero; autoscaler and dashboard reading different signals.

**Incident guidance.**
- *Eleven-minute cold start invisible*: the router must report queued, rejected and timed-out requests while no replica exists; add router-side metrics and a cold-start record with its phases (here probably weight download and load). Recovery: backfill from router logs if retained; tell the customer what happened. Prevention: show expected cold-start time on the endpoint, suggest a minimum of one replica for latency-sensitive use.
- *Crash-looping replica counted as capacity*: per-replica restart counts and readiness should exclude it from capacity; alert on restarts and retry rate at the router, not only on error rate. The autoscaler should use ready replicas and router queueing, not the scheduled count.
- *Region collectors 35 minutes behind*: dashboards must show "delayed" via the watermark, and the lifecycle event stream (which records any scale-to-zero after `idle_minutes`) answers the customers' question. Prevention: collector backlog alerts, and a status banner per region.

**Follow-up guidance.** Push on the precise cold-start definition, on where failures appear when there are zero replicas, and on cardinality arithmetic.

**Rubric anchors.** 2: replica metrics only, averages, no lifecycle events. 3: router-side measurement, lifecycle events, histograms, autoscaler decision log, late-data handling. 4: also derived cold-start records with phases, watermarks distinguishing zero from no data, cardinality and cost reasoning for idle endpoints, and crisp handling of every incident.

**Strong signals.** Asks where latency is measured; treats "no data" as a state. **Red flags.** Request payloads in logs; per-request labels on metrics; percentiles averaged across replicas.

## HGF-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Addressing**: an object's address is the SHA-256 of its bytes; the git pointer holds the hash and size. Uploads: the client asks "do you have hash H?"; if yes, nothing is transferred; if no, it uploads, the store verifies the hash before marking the object durable. The commit is accepted only if every referenced object is durable.
- **Metadata**: `objects(hash, size, state: live | candidate | deleting, candidate_since, created)`, and a reference index `refs(repo_id, commit_id, hash)` maintained on push, and on ref deletion or history rewrite (from the set of commits reachable from retained refs). For a fork, the index can share entries with its parent by recording that the fork's reachable commits include the parent's.
- **Chunk-level option**: content-defined chunking with a rolling hash (boundaries chosen by content, so an insertion only changes nearby chunks), a chunk index, and a per-file reconstruction manifest listing chunks. Saves most of the bytes for a fine-tune that changes a few layers; costs a large index and read-time reassembly. Accept file-level only, if the candidate quantifies what it leaves on the table.
- **Garbage collection**: periodically mark every object reachable from any retained ref of any repository (or rely on the incremental reference index plus a periodic full audit); objects with no reference become `candidate` with a timestamp; after `grace_days` a sweeper flips `candidate → deleting` with a conditional write and then deletes. Any new reference (a push or a dedup hit on "do you have H?") must atomically move the object back to `live` with a conditional write; a dedup hit on an object already in `deleting` answers "no" so the client re-uploads. Deleted objects can be restored during the grace period (soft delete), which also covers mistaken repository deletions.
- **Quotas**: a published rule, for example: an account is charged for the logical size of unique objects reachable from its repositories, counting an object once per account; objects reachable from a fork's upstream are charged to the upstream, not the forker. Users see a breakdown per repository and "shared with N repositories".
- **Integrity**: verify on write and on read; background scrubbing re-hashes stored objects; on mismatch, serve from another replica, repair, and alert.

**Competing designs to accept.** Per-object reference counts if the candidate makes increments and decrements idempotent and runs periodic reconciliation. Charging physical bytes with an explicit argument. Per-tenant isolation without cross-account dedup for private repositories (to avoid revealing existence of a private file through dedup timing or a "you already have it" answer).

**Bottlenecks and failure modes.** The race between a sweep and a new reference; listing billions of objects; quota surprises after forks and rewrites; corrupt replicas; the dedup oracle leaking existence of private content.

**Incident guidance.**
- *GC deletes a just-referenced object*: the grace period protects only if the age is reset by any new reference; here the dedup hit did not cancel the deletion. Recovery: restore from soft delete or re-request the upload, and find every commit whose objects are missing (reference index scan). Prevention: conditional state transitions so a dedup hit and a sweep cannot both win; dedup answers "no" for `deleting` objects.
- *Fork over quota*: the rule charged the forker for objects already charged upstream. Fix the rule (charge only objects not reachable from upstream), recompute quotas, and publish the change.
- *Squash barely reduces usage*: correct behaviour under shared storage, but must be explainable: the quota page shows which bytes are still referenced elsewhere. Make the rule and the expectation visible before users rewrite history.
- *Hash mismatch from one node*: hash verification on read should already route around it; fix the read path if it served bad bytes, repair from a healthy replica, scrub that node, and alert on mismatch counts.

**Follow-up guidance.** Push on the exact atomic step that prevents the sweep race, the chunk index size at the scenario's scale, and whether the quota rule is explainable to one user.

**Rubric anchors.** 2: delete when a repository is deleted, no grace, no dedup reasoning. 3: content addressing, upload-then-commit, reference index or mark phase, grace-period deletion, a quota rule. 4: also atomic cancellation of deletion by any new reference including dedup hits, reasoned chunking, private-content dedup concerns, scrubbing, and crisp handling of every incident.

**Strong signals.** Finds the dedup-versus-sweep race unprompted. **Red flags.** Reference counts with no reconciliation; immediate hard deletes; listing the whole bucket on every run.

## HGF-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Jobs**: each accepted push produces events per new file `(repo_id, path, content_hash, size, type)`. A job is keyed by `(content_hash, scanner, rule_version)`; if a result already exists for that key, the file page links to it immediately, so forks and re-uploads cost nothing.
- **Queues**: two lanes per scanner type: fresh pushes (high priority, reserved capacity) and rescans (low priority, capped share). Within a lane, fair queuing by organisation or repository so one large push cannot delay others. Large files go to a separate pool with longer limits.
- **Workers**: stateless, isolated sandboxes with memory, CPU and time limits; scanners parse files statically and never load or execute them. Completion is idempotent (write result keyed by the job key). Attempts are bounded (for example three); after the last, the status becomes "scan failed" with an alert and a human queue, so a poison file cannot block a partition.
- **Results**: `scan_results(content_hash, scanner, rule_version, status, reasons, ts)` and a status history `file_status_events(repo_id, path, content_hash, status, scanner, rule_version, ts, actor)`. The file page reads the latest status for the file's hash; disputes write an override event for (hash, rule_version), applying to every repository with that hash, reviewed by people.
- **Secrets**: a finding stores the location (repo, commit, path, line) and a non-reversible fingerprint, never the value. Owners are notified privately, de-duplicated per (repository, rule) with digests for bursts, and told how to revoke and how to rewrite history. Analytics count findings by rule and status only.
- **Rule releases**: a release guard runs the new rules on a sample first and compares finding rates per rule with the previous version; large changes block the release. Rescans are ordered by exposure (most-downloaded and recently pushed first) and paced against the rescan lane's share; the time to finish is estimated (files ÷ throughput).
- **Monitoring**: time from push to status (p50/p95 against the target), backlog age per lane, failure rate, findings per rule per hour.

**Competing designs to accept.** Blocking a push until scanning completes for small files only, with a clear user experience. Per-repository scanning without hash sharing if the candidate argues about owner-specific results. Event streaming with Kafka or a managed queue; either is fine if fairness and poison handling are addressed.

**Bottlenecks and failure modes.** Rescans starving fresh pushes; poison files; noisy rules; notification floods; results not shared across identical files; disputes that fix one repository but not the same bytes elsewhere.

**Incident guidance.**
- *Rescan delays fresh uploads by nine hours*: move rescans to their own lane immediately, restore reserved capacity for fresh pushes, and drain the fresh backlog first. Prevention: lanes with explicit shares and an alert on time-to-status against `scan_minutes`.
- *Out-of-memory retries forever*: cap attempts, mark the file "scan failed", alert and route to a person; isolate the partition. Prevention: resource limits per job and a separate pool for large or unusual files.
- *Two million false findings*: roll back the rule version, withdraw the findings (status events, not deletes), send one apology digest. Prevention: the release guard on finding rates and notification digests per owner.
- *Wrong warning for a week*: the dispute overturns the result for that hash and rule version; the history shows when and why; report how many page views carried the warning from aggregate page metrics. Prevention: faster dispute review for high-exposure repositories and a second review before flagging very popular files.

**Follow-up guidance.** Push on rescan duration arithmetic, notification de-duplication, and how a dispute propagates to every copy of the bytes.

**Rubric anchors.** 2: one queue, scan per repository file, no poison handling, secrets shown publicly or logged. 3: jobs keyed by hash and rule version, lanes, bounded retries with a final status, private notifications, status history. 4: also fair queuing per organisation, a release guard for new rules, exposure-ordered rescans with duration estimates, dispute propagation by hash, and crisp handling of every incident.

**Strong signals.** Keys results by content hash and rule version; protects fresh scans from rescans. **Red flags.** Loading a model file to see whether it is unsafe; storing found secrets; describing detection rules in a way that teaches avoidance instead of designing the pipeline.

## HGF-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Data model**: `threads(thread_id, repo_id, number, type: discussion | pull_request, author_id, status, created_at)`, `thread_events(event_id, thread_id, type: comment | edit | status_change | commit_pushed | merged | hidden | unhidden | deleted, actor_id, ts, payload_ref)`. `repo_id` is stable across renames and transfers; a name-to-id table with history serves redirects. A pull request carries a reference name and the commits pushed to it.
- **Projections**: the repository's community tab, search index, notification pipeline and metrics all consume the event log; a `hidden` event is applied by each projection (removes from page and search, suppresses unsent notifications).
- **Notifications**: mentions and replies on a high-priority lane, fan-out on write to the few recipients. Announcements from followed organisations on a low-priority lane: fan-out on write for small audiences, fan-out on read (a per-organisation feed merged into each user's inbox when opened) above a follower threshold, plus digests. Emails go through a delayed, batched queue (for example a few minutes for replies, longer for digests) so moderation can still suppress them; per-user rate limits.
- **Moderation**: reports grouped by target into cases, prioritised by severity, number of distinct reporters and account age signals; decisions are events (`hidden`, account restriction) with reason and moderator; removed content is retained in restricted storage for appeals with its own retention. Spam controls are described generally: limits on new accounts, burst detection across many repositories, holds pending review, with a plan to raise limits for a known launch.
- **Metrics**: computed daily from the event log per repository: open threads, pull requests merged, median time to first maintainer response (from thread creation to the first comment by someone with write access at that time; threads by maintainers excluded; spam-removed threads excluded). Recomputed when exclusions change; maintainers can drill into the threads a number counts.

**Competing designs to accept.** Pure fan-out on read with caching; a relational store for threads with change data capture to projections; a third-party email service with suppression lists. Counters updated in place are acceptable only with a recomputation path.

**Bottlenecks and failure modes.** Celebrity fan-out; shared queues where announcements delay mentions; moderation lag; content already copied to email or search; metrics poisoned by spam; renames breaking links.

**Incident guidance.**
- *Three-hour notification lag*: separate lanes so mentions bypass the announcement backlog; switch the large audience to fan-out on read. Prevention: a follower threshold for fan-out strategy and lag alerts per lane.
- *Spam wave on 50,000 repositories*: rate-limit new accounts, hold their content, bulk-act on the cluster of accounts as one case; recompute affected metrics with spam excluded. Prevention: burst detection across repositories and capacity planning for moderation.
- *Hidden comment in search and emails*: make search apply `hidden` events promptly (and verify with a lag monitor); delay low-priority email so the queue can drop hidden content; accept that sent email cannot be recalled.
- *Transfer breaks links and attribution*: links resolve by stable id with redirects from old names; "maintainer" is evaluated at the time of each response, using access history, not today's access list.

**Follow-up guidance.** Push on numbers for fan-out, on precisely what a moderation decision changes in every projection, and on the metric definition.

**Rubric anchors.** 2: one table of comments, synchronous fan-out, hard deletes, counters only. 3: event log with projections, hybrid fan-out with lanes, moderation as events, recomputable metrics. 4: also delayed email for moderation, access-history-based maintainer metrics, rename and transfer handling by ids, general but concrete spam controls with launch handling, and crisp handling of every incident.

**Strong signals.** Separates mention and announcement lanes; treats moderation as an event. **Red flags.** Hard deletes with no appeal evidence; metrics that cannot be recomputed; fan-out to millions on the request path.
