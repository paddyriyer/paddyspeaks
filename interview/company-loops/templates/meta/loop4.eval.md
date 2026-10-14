# Meta · Loop 4 — evaluator notes (hidden from candidates)

## MET-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Assignment and exposure.** Assignment is `hash(person_id, layer_salt) → bucket → arm`, with the bucket ranges stored in a versioned experiment config. Exposure events (`experiment_id, arm, person_id, first_exposure_ts, platform, app_version`) are logged where the changed code path runs; server-side logging is preferred because it cannot be lost by one app version. A daily job produces `exposures(experiment_id, arm, person_id, first_exposure_date)`.
- **One aggregation pass.** Raw events are aggregated once a day into `person_day(person_id, date, m1 … mk)`, a wide columnar table of base measures (counts and sums: sessions, seconds, posts viewed, likes, comments…). Metric definitions are code, versioned, and compiled into this job. Automated and test accounts are filtered here, and extreme values are capped (winsorised) by a documented rule, which also reduces variance.
- **Experiment statistics.** For each experiment, join `exposures` to `person_day` from first exposure onward and reduce to sufficient statistics per arm and metric: `n, Σx, Σx²` and, for ratio metrics `Σx/Σy`, also `Σy, Σy², Σxy` so the delta method gives the variance with the person as the unit. Each person is in many experiments, so the join is `person_day × experiments per person`; it is one pass over `person_day` that emits a few rows per (experiment, arm, metric).
- **Cumulative results.** Per-person totals since first exposure are not additive across days in the variance (Σ over people of (Σ over days x)² differs from the sum of daily Σx²). Keep a per (experiment, person) running-total table updated daily (incremental, merge today's values), or recompute cumulative statistics on a schedule. Candidates who notice this non-additivity show depth.
- **Variance reduction.** CUPED: regress the metric on the same person's pre-period value; `Y_adj = Y − θ(X − mean X)` with `θ = cov(X, Y) / var(X)` pooled across arms. People without pre-period data get X set to the mean (their adjustment is zero), which keeps the estimate unbiased.
- **Quality gates.** Before a scorecard is shown as decision-ready: a sample ratio check (chi-square test of observed arm counts against the configured split), exposure completeness by platform and app version, and pre-period balance on key metrics. Failing experiments show a banner and no significance markers.
- **Cluster experiments.** Clusters come from graph partitioning of the friendship graph (densely connected groups), assigned by `hash(cluster_id, salt)`. Analysis uses the cluster as the unit: cluster-level totals and ratio estimators with the delta method (or cluster-robust variance). Effective sample size drops to the number of clusters, so intervals widen; the trade is bias from interference versus variance.
- **Peeking.** Either always-valid sequential tests for the daily view, or a fixed-horizon decision date with daily results labelled "monitoring only"; plus a false-discovery correction across the {{metrics}} metrics or a short list of pre-declared decision metrics.
- **Recompute.** Scorecards store the metric definition version. A definition fix recomputes `person_day` for the affected dates and then the experiment statistics, which is bounded and cheap compared with raw-log scans per experiment.

**Competing designs to accept.** Streaming per-arm accumulators for a few real-time guardrail metrics alongside the daily batch. Bootstrap intervals computed on per-person rows for a subset of metrics. Ego-cluster or switchback designs for interference, if the candidate explains what each estimates.

**Bottlenecks and failure modes.** Per-experiment raw scans; skewed person-days from automated accounts; ratio metrics with the wrong unit; non-additive cumulative variance; peeking; sample ratio mismatch from exposure logging; interference that biases the treatment effect toward zero (or inflates it).

**Incident guidance.**
- *Exposure missing for treatment on one platform*: the sample ratio gate should fire and hide significance. Segment the mismatch by platform and app version to find the cause; the +3% is not trustworthy because the missing exposures are not random. Tell leadership plainly that the daily view was invalid. Recovery: fix logging; analyse on assignment where it can be reconstructed server-side, or restart the experiment. Prevention: server-side exposure logging, the gate as a hard block, and exposure completeness monitored per version.
- *Skewed partition from automated accounts*: filter automated accounts before aggregation; cap per-person event counts; salt or split heavy keys; alert on job runtime against the {{results_by}} deadline, and publish scorecards per experiment as they finish rather than all or nothing.
- *Control comments also rose*: possible interference (treatment people's comments trigger replies from control friends) or a seasonal trend. Compare control with a long-term holdout or with other experiments' controls; examine control people with many treated friends versus few (exposure to treated neighbours); confirm with a cluster-randomised follow-up. Interference biases the measured difference, so the true total effect may be larger or smaller than +4%.

**Follow-up guidance.** Push on the ratio-metric variance, cumulative non-additivity, what a sample ratio mismatch means at 100 million people (a 50.6/49.4 split is far beyond chance), and the power cost of clusters.

**Rubric anchors.** 2: scans raw logs per experiment, t-tests on post views, no quality gates. 3: one aggregation pass with versioned definitions, sufficient statistics, delta method for ratios, sample ratio gate, CUPED. 4: also cumulative-variance handling, cluster randomisation with the right unit and its power cost, a peeking policy, interference diagnostics, and clean answers to every incident.

**Strong signals.** Asks what the randomisation unit is before computing anything; treats data quality as a gate, not a footnote. **Red flags.** Averaging daily p-values; trusting an experiment with a sample ratio mismatch; ignoring that friends share a feed.

## MET-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Metadata events.** From the messaging servers: `send(sender_id, recipient_or_group_id, ts, is_new_conversation, size_class)`, `group_create`, `group_invite`, `block(by, target)`, `report(by, target, ts, shared_message_count)`, and registration events (account age, registration country, client type). `is_new_conversation` is computed on the delivery path from operational state and emitted as a flag, so the feature pipeline never needs its own who-talks-to-whom store.
- **Features.** A stream job keyed by `sender_id` keeps, for windows of 1 minute, 10 minutes, 1 hour and 1 day: messages sent, distinct recipients (HyperLogLog sketch per window, or exact sets while small), share of messages to new conversations, groups created and invites sent, blocks and reports received per distinct recipient, account age. Recipient identities live only inside the sketches and expire with the window, well inside the 72-hour limit.
- **Sizing.** State per active sender is a few kilobytes (several windows of counters and sketches); tens to hundreds of millions of daily senders gives terabytes of state, partitioned by sender across the stream cluster with checkpoints. Sketch precision is chosen per window to keep it bounded.
- **Scoring.** Rules plus a model scoring on every feature update for accounts above a cheap pre-filter. An action ladder: slow sending, re-verification, temporary restriction, ban. Soft actions at moderate scores act within {{act_within}}; bans only at high confidence or after review. Each action stores the feature snapshot, rule or model version and score.
- **Labels and measurement.** Reviewer decisions, appeal outcomes and reviewed reports become labels. A random sample of non-actioned accounts and of actioned accounts goes to review each day, so precision, recall and prevalence can be estimated without the bias of only labelling what was actioned. Reports are weighted by the reporter's history and by the number of distinct, unrelated reporters, which blunts mass-reporting.
- **Coordinated campaigns.** A batch or micro-batch job builds a graph of accounts linked by shared registration attributes, client characteristics, synchronised timing and overlapping recipient cohorts (from sketches, not lists), finds clusters, and scores them as a unit; clusters go to review with cluster-level actions.
- **Appeals.** Show the category of behaviour ("many messages to people who have not messaged you before, in a short time") and the time, not thresholds or other people's data. Fast reinstatement for overturned actions.
- **Privacy and retention.** No content except reported messages, handled in a restricted review tool; per-account features retained for days, actions and their evidence for the appeal and audit period; aggregate metrics afterwards.

**Competing designs to accept.** Recipient-side scoring (the recipient's app or server flags unsolicited first messages) combined with sender scoring. A pure rules system at first with a model added later, if labels and measurement are designed in. Graph-based detection as the primary signal for organised campaigns.

**Bottlenecks and failure modes.** Feature state size; labels biased toward past actions; adversaries staying under per-account thresholds; seasonal legitimate bursts; feature staleness; mass-report abuse; sender-recipient data kept longer than needed.

**Incident guidance.**
- *40,000 accounts under every threshold*: per-account features cannot see it. Use cluster features (accounts registered together, sharing client characteristics, messaging overlapping recipient cohorts), recipient-side signals (many recipients reporting different new accounts), and a retrospective sweep of the cluster once identified. Prevention: cluster scoring as a standing job, and alerts on report volume that is not matched by actions.
- *Holiday false positives*: roll back the threshold change, reinstate affected accounts in bulk, and prioritise their appeals. Prevention: run threshold changes in shadow mode and per-country canaries first, use per-country seasonal baselines, and watch the restriction rate per country as a guardrail.
- *Regional lag of 25 minutes*: staleness must be an SLO with an alert, not discovered later. Short term: fail over to another region's pipeline or apply a simpler rule path that needs only fresh counters; measure enforcement rate per region so a silent drop pages someone.

**Follow-up guidance.** Push on how labels bias the model, how precision is measured, what the 72-hour rule does to features, and why soft actions exist.

**Rubric anchors.** 2: a batch job that bans accounts above a message-count threshold; stores sender-recipient pairs indefinitely. 3: real-time sliding-window features, an action ladder, labels from review with a random sample, retention limits, appeals. 4: also cluster detection, report weighting, shadow-mode changes, staleness SLOs, and clean answers to every incident.

**Strong signals.** Separates reversible from irreversible actions; designs measurement before modelling. **Red flags.** Wanting message content; banning on IP address alone; no way to measure false positives.

## MET-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Intake and dedup.** Browser and server events land in a log keyed by `(data_source_id, event_name, event_id)`. A dedup stage keeps state for a bounded window (for example 48 hours) and applies a deterministic precedence when both arrive (for example the server event's value wins; ties broken by source, then receive time). Events without an event id use a fallback signature (hashed identifiers, event name, value, time rounded to minutes) with a known false-merge risk, reported to the advertiser as a data-quality signal.
- **Matching.** Hashed identifiers go to the matching service; the result is a person id or none, plus the matcher version. Unmatched conversions are kept and reported as unattributed, not dropped.
- **Interaction index.** Clicks and views per `(advertiser_id, person_id)` with the ad hierarchy (campaign, ad set, ad), server time and the ad set's attribution setting version; clicks kept for the longest click window, views for 1 day. Partitioned by person id so a conversion's lookup reads one partition. Sizing: views are about one day of impressions; clicks are a small share of impressions times the window.
- **Attribution.** A pure function: given a conversion and the interactions known at a cutoff, pick the last click within the window across all of the advertiser's ads, else the last view within 1 day. One credited ad per conversion, so ten campaigns cannot each count it. Output is an `attribution` table keyed by `conversion_id` (upsert); a rerun after late data replaces rows. A late click can move a conversion from a view to a click until the restatement period ends.
- **Reporting date.** Either the conversion date (late conversions restate only recent days) or the interaction date (credit goes back to the ad's day, so restatement spans the window plus the period). The candidate must pick one and live with it.
- **Reports.** Aggregates per `(advertiser, campaign, ad_set, ad, day)` rebuilt from the attribution table for the days touched by changes; cells under a minimum are suppressed; no person-level output. Days older than 7 days are final.
- **Setting changes.** The setting is effective-dated per ad set; conversions are attributed under the setting in force at the conversion time; history is not recomputed unless the advertiser asks for a modelled comparison, which is labelled.
- **Fast feed.** Provisional, short-window-deduplicated conversions go to delivery within minutes, tagged provisional; corrections follow. The bidder smooths its inputs so a correction does not swing spend.

**Competing designs to accept.** Hourly batch attribution over the lakehouse plus a streaming provisional path. Stream state instead of an external index, if sized. Reporting by interaction date with a longer restatement period.

**Bottlenecks and failure modes.** Unbounded dedup state; dedup failing when ids differ; double counting on rerun; one conversion credited by many campaigns; restating closed days; delivery overreacting to provisional spikes; unmatched conversions disappearing; silent matcher changes.

**Incident guidance.**
- *Every purchase twice with different ids*: per-advertiser anomaly checks (conversions per click jump; many pairs with identical fallback signatures minutes apart) should flag it. Short term: apply signature-based dedup to that data source, dampen the bidder's response, contact the advertiser. Restate the affected days within the restatement period. Prevention: anomaly gates on the delivery feed per advertiser.
- *30-hour backlog*: the restatement period covers it, so the change is allowed; label recent days as not final, backfill attribution idempotently, and tell advertisers that exported numbers changed. Delivery gets the backlog with smoothing. Prevention: multi-region intake with a durable buffer and lateness alerts.
- *Matcher normalisation change*: a match-rate step change across all advertisers on one day points at the matcher, not at advertisers. Record the matcher version on every match; compare attributed conversions under old and new versions on a sample; decide with product whether to restate (within the period) or annotate the break. Prevention: matcher changes go through a shadow comparison and a release note to reporting.

**Follow-up guidance.** Push on determinism on rerun, dedup without ids, state sizing, credit across campaigns, and what restatement means for each reporting-date choice.

**Rubric anchors.** 2: joins all conversions to all impressions nightly, counts increments, no dedup policy. 3: bounded dedup with precedence, windowed interaction index, idempotent attribution table with one credit per conversion, restatement period, aggregate-only reports. 4: also effective-dated settings, provisional and final signals for delivery, matcher versioning, sizing that drives partitioning, and clean answers to every incident.

**Strong signals.** Makes the rerun a replacement; asks what advertisers do with exported numbers. **Red flags.** Person-level reports to advertisers; unbounded state "because it is a stream"; changing finalised days.

## MET-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Request log.** Deletion events from product systems land in a durable, append-only request log: `request_id, subject_type (account, post, comment), subject_id, related ids (device ids, hashed ids known for that account), requested_at, deadline`. The log itself holds only what deletion needs and is retained for audit.
- **Knowing where data lives.** Every table declares its identifier columns (including paths inside semi-structured columns) and a deletion policy at creation; table creation without it is rejected for tables that contain user identifiers. Lineage from the query engine marks derived tables; a scanner samples column values across tables to find identifiers in unregistered tables. Unowned tables get a default owner and an expiry.
- **Execution.** Each cycle (daily), for each table, join the batch of new requests against the table's identifier columns and delete matching rows in one operation, so each data file is rewritten at most once per cycle. Lakehouse formats support row-level deletes either by copy-on-write (rewrite the files now) or by merge-on-read (write deletion files now, rewrite at compaction). With merge-on-read, physical removal is complete only after compaction, which must be tracked against the deadline.
- **Layout.** Tables clustered or bucketed by user id (in addition to date) so one person's rows sit in few files; for large event tables this turns "rewrite every partition" into "rewrite a small share of files". Short-retention raw tables may simply expire before the deadline, which is cheaper than deleting.
- **Derived data.** Derived row-level tables are deleted the same way, discovered via lineage. Aggregates are kept when every cell covers at least 100 people; cells below that are recomputed or dropped. Streams have retention shorter than the deadline, so they age out.
- **ML.** Training datasets are purged before each training run (or rebuilt from purged tables); feature tables follow the table process. Models are retrained on a cadence shorter than the window; a candidate may reasonably raise whether a model can memorise individual data and propose an assessment for models that might (for example those trained on small or rare cohorts).
- **Backups and restores.** Backups age out on their documented cycle; any restore is followed by replaying the request log from the backup's timestamp before the restored data is readable.
- **Verification.** Per request and table: the job records rows deleted, files rewritten and compaction completion; a verifier periodically queries for a sample of completed requests' identifiers across all registered tables and expects zero; synthetic test accounts are created and deleted to prove end-to-end coverage. Evidence per request is a record of these.

**Competing designs to accept.** Crypto-shredding (per-person encryption keys, deleted to make data unreadable) for some stores, with its query cost and derived-data limits stated. Time-based expiry for most raw data with deletion only for long-retention tables. A central deletion service calling each storage system's API versus a table-format-level job.

**Bottlenecks and failure modes.** Rewrite cost on date-only partitioned tables; compaction backlogs leaving data physically present; unregistered copies; identifiers in semi-structured data; restores that resurrect data; models and datasets; tables without owners.

**Incident guidance.**
- *Compaction failing for three weeks*: rows are logically hidden but physically present, which does not meet the commitment. Fix the job and prioritise compaction for files with the oldest pending deletions, sized to finish in the nine days; track per-request physical completion. Prevention: physical completion as a monitored metric with alerts well before the deadline, not job success alone.
- *40 unregistered tables*: register them, run deletion for all requests since their creation, check their consumers, and report to the privacy team with scope. Prevention: block creation of tables with identifier columns without a policy, scan for identifiers, and default expiry for ad hoc tables.
- *Restore resurrects 60,000 accounts*: block reads of the restored table until the request log has been replayed from the backup's time; verify zero rows for requests since then; report the window of exposure. Prevention: make replay part of the restore procedure, enforced by tooling.

**Follow-up guidance.** Push on file rewrite counts, physical versus logical deletion, how unregistered tables are found, and what is reasonable for trained models.

**Rubric anchors.** 2: "run DELETE for each request in every table". 3: request log, batched deletes, registration and lineage, aggregates by rule, datasets purged, backups addressed, verification. 4: also layout to bound rewrite cost, physical completion tracking through compaction, identifier scanning, restore replay, synthetic-account proofs, and clean answers to every incident.

**Strong signals.** Starts with "how do we find the data" and "how do we prove it"; knows that a hidden row is not a deleted row. **Red flags.** Relying on owners to remember; deleting by full-table rewrites daily; ignoring backups and models.

## MET-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Sizing both options.** Fan-out on write: reactions per day times the reactor's friends, for example 10 billion × 300 = 3 trillion index writes a day (about 35 million a second), plus deletes on every un-react; heavy reactors with 5,000 friends amplify further. Read-time intersection: each render compares the viewer's few hundred friends with the post's reactors; done naively as point lookups that is hundreds of lookups per post at {{renders}} renders a second. Neither naive version is acceptable, which is the point of the question.
- **Pick the cheaper side per post.** Load the viewer's friend set once per feed request (a few hundred ids, cached for the session with invalidation on friendship and block changes). Most posts in a feed have few reactions: fetch the post's reactor list (it is small and often already cached with the post) and intersect in memory. For posts with many reactors, send the viewer's friend list to the shard holding the reactor set and intersect there (function shipping), returning only the matches; the reactor set is stored as a sorted set or a set keyed by (post, person) so membership tests are cheap, optionally screened by a per-post membership filter held next to it, with every hit confirmed.
- **Hot posts.** Reactor sets for very popular posts are replicated across several shards, and probes are spread among replicas; the membership filter is rebuilt incrementally.
- **Names and counts.** Among the matching friends, pick the two with the highest closeness (scores fetched with the friend set). The count is the size of the intersection after filtering, so it is never higher than the truth; display can cap it.
- **Removals.** Un-react removes the person from the post's reactor set (and the filter tolerates it by confirmation); unfriending and blocks update the viewer's friend set and a block check is applied to the matches at serving time; deleted and deactivated accounts are filtered by account state on the matches. Any cache of social context per (viewer, post) has a short TTL and is invalidated by un-react, block and unfriend events, so the one-minute rule holds.
- **Visibility.** A friend's reaction is named only if the viewer may see that reaction under the post's and the friend's visibility settings; this check runs on the few matches, not the whole set.
- **Fan-out alternative.** Acceptable if justified: push to friends' indexes only for reactors below a friend count and for posts in their first hours, and fall back to read-time intersection otherwise, with the write cost stated.

**Competing designs to accept.** Precomputed per-viewer social context for the posts most likely to be shown (from the feed's candidate set), refreshed by events. Probabilistic screening with exact confirmation. Graph-store queries, if throughput and p99 are reasoned with numbers.

**Bottlenecks and failure modes.** Write amplification; hot reactor shards; cache staleness after blocks; counts that include filtered people; per-render fan-out across many shards; old posts with huge reactor sets.

**Incident guidance.**
- *Hot shard for a post with {{top_reactions}} reactions*: replicate that post's reactor set (automatically above a reaction count or probe rate), spread probes, and degrade gracefully (omit social context for that post rather than time out the feed). Prevention: per-key load detection and automatic replication.
- *Blocked name shown for 20 minutes*: the cache was not invalidated by the block. Purge the viewer's cached contexts on block events; apply the block check at serving time on matches even when cached; add a test and a metric for block filter hits.
- *Fan-out queue three hours behind*: if the design depends on fan-out, social context is missing; fall back to read-time intersection for recent posts while the queue drains, and prioritise recent reactions. Prevention: the read path as a standing fallback, and capacity for known events.

**Follow-up guidance.** Push for the write-amplification number, the per-render lookup count, and how blocks and un-reacts meet the one-minute rule in their chosen design.

**Rubric anchors.** 2: fan-out on write or per-render graph queries without any numbers. 3: sized both options, chose per-post sides or a justified hybrid, serving-time block and visibility checks, never-overstate counts. 4: also function shipping or equivalent for large sets, hot-post replication, cache invalidation within a minute, graceful degradation, and clean answers to every incident.

**Strong signals.** Computes amplification first; notices that most posts have few reactors and designs for the distribution, not the average. **Red flags.** Caching social context for hours; counts computed before filtering; naming someone because of a membership-filter hit without confirmation.
