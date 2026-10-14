# Spotify · Loop 4 — evaluator notes (hidden from candidates)

These notes describe general, published engineering techniques (frozen snapshots,
single-writer sequencing, clock-offset estimation, mergeable sketches, versioned
restatements). Score the candidate on whether they apply them correctly, never on
whether they guess how any company builds its recommendations, rankings, stream
counting or integrity systems. On SPT-L4-05, a candidate who drifts into how to
fake or evade detection is off topic; steer back to the data system.

## SPT-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Frozen input**: at the cutoff plus a stated grace period for late offline plays, snapshot the play table (a table-format snapshot or a copy of the partitions) under a version id, together with the catalogue mapping (track → primary artist, genres) as of the same moment. The computation reads only that snapshot, so reruns are byte-identical.
- **Per-listener computation**: filter (≥ 30 s heard, not private session, eligible listener), then aggregate per (listener, artist / track / genre / show) with minutes and first-play time for tie-breaks; rank within listener; assemble one compact record per listener (a few KB). Partition by listener id; at {{plays_per_day}} plays a day the year is hundreds of billions to trillions of rows, so pre-aggregate daily or monthly per (listener, track) during the year and finish from those partial aggregates instead of rescanning raw plays. Skewed listeners (shared speakers, very heavy accounts) are handled by salting or a two-stage aggregation.
- **Checks before publish**: totals reconcile with independent daily totals; distributions of minutes and top-item shares compared with last year and across markets, device types and client versions (drift by segment, not just overall); exclusion rules re-verified on samples; no listener record references another listener; artist summaries meet minimum aggregate counts. Blocking checks (reconciliation, privacy) stop publication; distribution checks alert and require a named sign-off.
- **Publish and serve**: immutable records written to a key-value store keyed by listener id with the version in the key; the reveal flips a pointer to the version. Capacity planned for {{launch_peak}} reads per second with headroom; pre-warm caches and replicas; the client fetches one record. Notifications go out in waves from a list built at publish time and re-filtered against deletions just before sending.
- **Share images**: rendered lazily on demand from the record plus templates, cached by (listener, card, version) on a CDN, with a queue and a client fallback (render a simpler card on the device, or retry later) so rendering lag never blocks summaries.
- **Deletion**: a deletion feed is applied continuously from cutoff to reveal and after: drop records, tombstones in the serving store checked on read, and removal from notification lists and image caches. A deleted listener's id stays in a suppression set for the campaign.
- **Corrections**: fix, recompute only the affected listeners from the same snapshot, publish as a new version for that set, keep both versions and an audit of who was changed and why; decide whether to notify.

**Competing designs to accept.** Computing continuously through the year with incremental aggregates instead of one big batch, provided the frozen-input property is kept. Rendering share images ahead of time for the most likely cards. Staggered reveal by region, if the candidate addresses the fixed-moment constraint (they may propose it as a change and argue for it).

**Bottlenecks and failure modes.** The full-year shuffle and skewed listeners; definition drift between the summary and other reports; duplicated input after backfills (new event ids defeat dedup); cache cold start at the reveal; image rendering as a hidden dependency; deletion races between snapshot and reveal; notifications built from stale lists.

**Incident guidance.**
- *Speaker client minutes 1.8×*: a duplicated backfill with new event ids. Dedup on a natural key (listener, device, track, start time) for that client, rebuild the snapshot version, recompute, rerun checks. Prevention: segment-level reconciliation of minutes against an independent source per device type and client, and backfills that preserve original event ids.
- *Share rendering behind*: decouple it: summaries are healthy, so degrade share (simpler client-side card, queue with retry), scale renderers, cache hot templates. Prevention: load-test rendering at the expected share rate, not only reads.
- *Deleted listeners notified*: stop the wave, re-filter remaining waves against the deletion set, confirm their records are gone from the store and caches, and record the affected count for the privacy team. Prevention: notification lists filtered at send time against a live suppression set.
- *Autoplayed tracks counted*: a client measuring played time from queue time. Identify the client version, recompute affected listeners in that market with corrected durations (or excluding that client's short plays), publish a corrected version, and tell those listeners their summary was updated. Prevention: a check of short-play rates by client version before publishing.

**Follow-up guidance.** Push on numbers for the job (data volume, shuffle size, hours), on which checks block, on how the pointer switch and caches interact at the reveal, and on deletion end to end including notifications and images.

**Rubric anchors.** 2: "run a big Spark job and put the results in a database", no freezing, no checks, no deletion story. 3: frozen snapshot, deterministic per-listener computation with skew handling, blocking checks, immutable records with a pointer switch, cache warm-up, deletion applied before reveal. 4: also segment-level drift checks, lazy share rendering with graceful degradation, notification suppression at send time, versioned partial corrections with an audit, and crisp handling of every incident.

**Strong signals.** Asks what must be reproducible before designing; estimates the job and the read peak in numbers. **Red flags.** Recomputing on read at the reveal; editing records in place to correct them; treating deletion as a nightly batch that may run after the reveal; showing one listener's data to another through share links.

## SPT-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Session authority**: each session is owned by one actor or process on a session server (placement by consistent hashing of session id, with a directory). The authority holds the queue (items with stable item ids, independent of track ids, so the same track can appear twice), playback state (current item, server time it started, paused position), participants and permissions, and a monotonically increasing version.
- **Edits**: clients send intents with the version or item id they saw: `skip(item_id)`, `move(item_id, after_item_id)`, `add(track_id, client_op_id)`. The authority applies them in order; a skip of an item that is no longer current is a no-op, so two concurrent skips skip one track; `client_op_id` makes retried adds idempotent. Each applied edit is broadcast as a versioned delta; clients that miss a version request a snapshot.
- **Durability**: the authority appends edits to a log or snapshots state to a replicated store every few seconds; on node failure the directory reassigns the session and the new owner restores from the snapshot plus the log tail. Clients reconnect and resync by version; participants hear a short pause.
- **Sync**: clients estimate their offset to server time with repeated round-trip exchanges (NTP-style, keeping the minimum-delay samples); the authority publishes "item X playing from position 0 at server time T"; each client seeks to the position implied by its estimated server time, compensating for its known output latency (Bluetooth or speaker delay). Clients report measured offset and drift periodically; drift beyond {{drift_ms}} ms triggers a re-seek. In one room with one speaker, only the speaker plays and phones are remotes.
- **Host and network loss**: the session lives on the server, not on the host's phone; when the host disconnects, the session keeps playing for others; host role transfers after a timeout, or the session ends with a clear message. Clients queue edits made offline with op ids and resend them on reconnect; the authority applies them against the current state and reports any that no longer apply.
- **Rules**: link tokens with expiry and a participant cap of {{max_people}}; plan eligibility checked at create time on the server; per-market availability checked per participant at play time, with a skip or silence for that participant and a note.
- **Measurement**: session events (created, joined, edit, playback started, left, ended) with session id, anonymised participant index and timestamps; a defined success metric, for example sessions where at least two people listened together for at least ten minutes with drift within target; aggregate weekly by platform, mode and client version; never expose who added what outside the session.

**Competing designs to accept.** CRDTs for the queue with peer-to-peer sync (accept if they handle concurrent skips and give a convergence argument, and weigh client complexity). Host's device as authority with server relay (accept if they address host network loss, which is exactly the second incident). Server-side mixing for remote listeners is not needed; reject designs that stream audio between participants unless they explain rights and cost.

**Bottlenecks and failure modes.** Connection counts per server and reconnect storms on deploys; hot sessions at the participant cap; clock skew and audio output latency; lost deltas and version gaps; host-device dependence; metric definitions that change with instrumentation.

**Incident guidance.**
- *Drift 2% → 18% on one OS version*: correlate by OS and client version; the output-latency compensation regressed. Roll back or hotfix the compensation, use drift reports to confirm. Prevention: drift measured by client version in canary rollouts, with a gate.
- *Host in a tunnel, edits lost*: the design depended on the host device. Make the server the authority so others continue; idempotent replay of offline edits by op id on reconnect. Prevention: chaos tests that drop the host's connection.
- *Success rate drops a fifth*: an instrumentation change, not a usage change; check the metric's inputs by client version. Fix the event or the metric definition, annotate the series, and backfill if possible. Prevention: metric definitions that do not depend on a single client event, and anomaly alerts on input event volumes.
- *10× session creation*: rate-limit and queue creation, pre-scale session servers, make invite-link validation cheap (signed tokens checked without a database read), and degrade gracefully (sessions created, joins retried). Prevention: load tests and admission control.

**Follow-up guidance.** Make them walk the concurrent skip in detail, compute connections (sessions × average size), and define success precisely with its gaming risks.

**Rubric anchors.** 2: "everyone sends positions over websockets" with no authority, no versioning, no sync method, success left undefined. 3: single authority per session with versioned intents, idempotent edits, server-time scheduling with offset estimation, failover from snapshots, a defined success metric. 4: also output-latency compensation and drift measurement, offline edit replay, per-market availability, capacity numbers, a metric robust to instrumentation changes, and crisp handling of every incident.

**Strong signals.** Separates intent from result; identifies the double-skip problem unprompted. **Red flags.** Trusting client clocks; the host phone as the only copy of the session; a success metric that rewards friction or counts the host as a participant.

## SPT-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Definitions**: a versioned metric registry (stream = ≥ 30 s under this exercise's rule; listener = distinct listener id in the window; save, follow, playlist add) consumed as code by both the daily aggregation and the yearly summary pipeline; a change in a definition produces a new version and a planned restatement for both.
- **Daily aggregation**: per day and artist (primary and featured, each counted once per stream per artist), per track and release: streams, saves, follows, playlist adds by playlist type, with dimensions country, city, age band (with "unknown"), source type. Release totals deduplicate across artists. Late plays (up to 30 days) and integrity outcomes (released or removed held-back streams up to 60 days) recompute the affected days as new versions.
- **Distinct listeners**: for fixed windows (7, 28 days, 12 months) compute exact counts daily from per-day (artist, listener) sets for the top-level numbers; for arbitrary ranges and breakdowns, store mergeable sketches (HLL) per day and dimension cell and merge at query time, labelled as estimates with a stated error. Per-country listeners do not sum to the total; the app says so.
- **Privacy**: cells below {{min_listeners}} listeners are suppressed after the final computation, with complementary suppression or coarsening (merge small cities into region, cap date-range granularity) so that differencing does not reveal small groups; date ranges snap to whole days or weeks with fixed starts. Personalised playlists appear as one source.
- **Serving**: precomputed aggregates in a columnar OLAP store partitioned by artist, with the common views materialised; per-artist access control from team grants enforced in the query layer.
- **Re-released tracks**: a catalogue mapping links old and new ids (a recording identity), so history continues; the mapping is versioned and restates where needed.
- **SLA**: the {{refresh_hour}} UTC deadline tracked per input; if an input is late, publish what is complete with a "partial" flag or hold the day, stated per metric, and backfill when it lands.

**Competing designs to accept.** Exact distinct counts everywhere using bitmap indexes (Roaring bitmaps) per artist and day if they estimate the storage; sketch-only with clear labelling; streaming updates for today's numbers alongside the daily batch.

**Bottlenecks and failure modes.** Distinct counts across arbitrary ranges; skew (top artists have hundreds of millions of listeners); definition drift between two pipelines; differencing attacks on small cells; restatements that confuse artists; late partitions on peak release days.

**Incident guidance.**
- *Partition nine hours late*: detect at the input level before the deadline, communicate in the app, publish partial with a flag if the definition allows, prioritise new releases in the backfill. Prevention: input SLAs with the upstream owner and earlier alerts.
- *Country sum 18% above total*: not inflation; listeners in several countries are counted in each. Explain in the app (a note on non-additivity), and publish a support article. Prevention: the UI never shows a sum of distinct counts.
- *Summary 3% lower than the daily sum*: definition drift: the summary pipeline uses an older version. Move both to the registry version, restate the summary with notice. Prevention: a reconciliation check between the two outputs before any summary is published.
- *Cell present then gone*: the threshold was applied before a late correction. Apply suppression on the final, corrected values and suppress consistently across versions so a cell does not flicker. Prevention: suppression as the last step on every restatement.

**Follow-up guidance.** Push on storage for sketches per artist × day × dimension, on differencing, and on what an artist sees when numbers change.

**Rubric anchors.** 2: one big table with COUNT DISTINCT at query time, two separate definitions, no privacy threshold. 3: shared definitions, daily aggregates with featured credits, sketches or exact windows with labelling, suppression below the minimum, restatement flow, an OLAP serving layer. 4: also differencing defences, re-release identity, SLA plan for late inputs, reconciliation between app and summary, and crisp handling of every incident.

**Strong signals.** Raises non-additivity of distinct counts early; ties both products to one definition. **Red flags.** Summing listeners across days or countries; showing individual listeners; editing past numbers without a trace.

## SPT-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Capacity arithmetic**: scoring calls per week ≈ {{listeners}} × {{candidates}} (for example 300 million × 1,000 = 3×10^11 candidate scores; if the scoring function scores batches, divide by batch size). Divide by the agreed capacity to get hours of scoring; start early enough to finish the first time zone (UTC+14) with slack, and order listeners by local Monday deadline. Pace with a token bucket at the agreed rate.
- **Pipeline**: per listener: fetch candidates → score (batched) → filter (played in last 90 days, hidden tracks and artists, explicit setting, market availability) → diversity (at most {{per_artist}} per primary artist, after mapping featured credits to primary artist) → select {{tracks}} tracks → write. Inputs recorded: candidate and scoring versions, catalogue snapshot, settings snapshot.
- **Output**: each week's playlist as an immutable version (listener, week, version, items, input versions); the listener's playlist pointer switches at local Monday 00:00 by a scheduler per time zone; notifications follow the switch.
- **Open-time validation**: when the app opens the playlist, a cheap filter re-checks current settings, hidden items and market availability and hides any violating tracks (showing fewer, or replacing them from a stored reserve list of next-best tracks generated with the playlist).
- **Failures**: retry per listener with capacity reserved for retries; if still failing at the deadline, a stated fallback: keep last week's version labelled as not refreshed, or a short playlist from the reserve list; never a rule-breaking playlist.
- **Proof**: an automatic check over every generated playlist (rule violations count must be zero) before the pointer switch; violations block that listener's switch and alert.
- **Measurement**: aggregates by cohort and scoring version (saves, plays, skips, completion), with a randomised split by listener for new scoring versions, the same schedule in both arms, and guards on client and instrumentation changes.

**Competing designs to accept.** Continuous generation spread over the week rather than a weekend batch (fresher capacity use, staler data). Generating in the listener's region close to serving. Leaving the 90-day check to open time only if they estimate the cost.

**Bottlenecks and failure modes.** The scoring capacity, not compute; time-zone deadlines; rights and setting changes between generation and opening; featured credits defeating diversity; instrumentation changes masquerading as quality changes.

**Incident guidance.**
- *Capacity halved for six hours*: reprioritise by deadline (earliest time zones first), use the reserve or partial results, and negotiate burst capacity; listeners who cannot be generated get the stated fallback. Prevention: slack in the schedule and a pre-agreed priority for early time zones.
- *Rights change on Sunday*: open-time validation hides unavailable tracks and fills from the reserve list; optionally regenerate affected listeners in that market if capacity allows. Prevention: subscribe to availability changes and re-check generated playlists before the switch.
- *Same artist eight times*: diversity applied on credited artist ids rather than primary artist. Block switches for violating playlists, fix the grouping, regenerate the affected slice. Prevention: the rule checker runs on every playlist before the switch, using the catalogue's primary-artist mapping.
- *Completion up 12%*: instrumentation, not quality; annotate, segment by client version, exclude autoplay starts from the measure. Prevention: metrics defined on listener-initiated plays and alerted on client-version mix.

**Follow-up guidance.** Make them do the arithmetic; push on what happens between generation and open; check they never redesign the scoring function.

**Rubric anchors.** 2: "run the model for everyone on Sunday" with no capacity estimate, no time zones, no revalidation. 3: capacity-driven schedule by time zone, deterministic filters and diversity, immutable versions with a pointer switch, open-time revalidation, stated fallbacks. 4: also a rule checker gating every switch, reserve lists, controlled comparisons of scoring versions robust to instrumentation, and crisp handling of every incident.

**Strong signals.** Starts from scoring capacity; treats rules as checkable invariants. **Red flags.** Inventing recommendation internals; padding playlists with rule-breaking tracks; browsing individual playlists to judge quality.

## SPT-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **States**: streams grouped into batches by (track, hour) or by (account, day), each with a state: recorded → held → counted | excluded, plus reinstated after appeal; transitions are append-only records with timestamp, reason code, evidence summary, rule set and score versions, and actor (automatic or reviewer).
- **Signals (general)**: aggregates computed per track, account and network over sliding windows: concentration of a track's streams among few accounts, repetition, account age and history, completion distributions, unusual geography or device mixes relative to the track's own baseline, many accounts sharing network-level attributes. Fresh enough to decide within the {{hold_hours}}-hour hold (streaming aggregates for the hold decision; daily batch features for investigations). Never described at a level that would teach evasion.
- **Decisions**: clear cases decided by rules and the given score above governed thresholds; uncertain cases to {{reviewers}} reviewers, prioritised by impact (streams at stake, chart proximity); a default when the hold expires stated explicitly (count by default, with the right to exclude later via restatement).
- **Settled counts**: charts, artist numbers and payment reports read a "settled" view; streams still held at the chart cutoff are either counted provisionally with a later restatement or excluded until settled; the rule is fixed and documented.
- **Restatement**: a later exclusion or reinstatement creates new versions of affected daily aggregates; charts get a correction notice and a new version (the original remains as published); payment reports carry adjustment lines in the next cycle; artists and distributors receive a notice with period and numbers.
- **Appeals**: an appeal reopens the decision with reviewer access to the evidence summary; a reversal reinstates streams and restates. Excluded streams are retained, not deleted.
- **Measurement**: false positives estimated from random samples of excluded and counted streams reviewed blind (not only flagged cases), appeal overturn rates, and rule changes run in shadow mode with predicted impact before rollout and staged afterwards.

**Competing designs to accept.** Per-account decisions instead of per-stream batches; no hold at all with all corrections via restatement (accept if they show the cost of restating charts); a separate integrity warehouse. Accept any signal set described generally.

**Bottlenecks and failure modes.** Viral legitimate tracks; review backlogs; holds expiring into counts; rule changes with large blast radius; restatements cascading into published charts and payments; deleting evidence.

**Incident guidance.**
- *Viral track held at 60%*: likely false positive from a baseline that does not adapt to genuine trends. Expedite review for high-impact holds, release streams that review clears, communicate status to the artist's team. Prevention: signals relative to wider context (external trend indicators, organic discovery sources), and an alert when one track's hold rate jumps.
- *Chart number seven should be thirty-one*: publish a corrected chart version with a notice; tracks that move up are shown in the correction; restate artist numbers and add payment adjustments; tell the artist and distributor. Prevention: decisions earlier for chart-relevant tracks.
- *Rule change to 4% overnight*: roll back the rule (versioned), reinstate streams it held, check whether the chart is affected. Prevention: shadow evaluation and staged rollout with an impact cap.
- *Review backlog of nine days*: holds are expiring into counts. Prioritise by impact, raise automatic thresholds only with evidence, add temporary capacity; stated default stays "count and restate later". Prevention: review-capacity forecasting and alerts on queue age.

**Follow-up guidance.** Push on the chart cutoff interaction, unbiased false-positive measurement, and restatement order (aggregates → charts → artist numbers → payment adjustments → notices).

**Rubric anchors.** 2: "an ML model deletes fake streams", no states, no restatement, no appeals. 3: explicit states and settled views, decision records with versions, review with a stated hold-expiry default, restatement as new versions with notices. 4: also unbiased false-positive measurement, shadow and staged rule changes, impact-prioritised review, careful chart correction semantics, and crisp handling of every incident.

**Strong signals.** Treats false positives as a first-class harm; never deletes evidence. **Red flags.** Detailing how to fake or evade streams; silently editing published charts; accusing artists by default; exposing detection logic in notices.
