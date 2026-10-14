# Spotify · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of an audio
streaming service for music, podcasts and audiobooks: playlists, listening across
devices, follows, artist and creator analytics and yearly listener summaries.
Every workload, number, rule and schema is hypothetical, and nothing here
describes how any company's systems, recommendations, rankings or stream counting
are actually built.

## SPT-L4-01: Yearly listener summaries at scale: a year of plays computed once, checked, and revealed on a fixed date

| | |
|---|---|
| **Template ID** | SPT-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Large batch computation / frozen snapshots, validation gates, launch-day serving, deletion before reveal |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "listeners": {"2": ["150 million", "300 million"], "3": ["600 million", "700 million"]},
  "plays_per_day": {"2": ["1 billion", "2 billion"], "3": ["5 billion", "8 billion"]},
  "freeze_days": [14, 21, 30],
  "launch_peak": {"2": ["150,000", "300,000"], "3": ["1 million", "2 million"]}
}
```

**Business Scenario.** Once a year, every one of about {{listeners}} listeners can open their own yearly summary: minutes listened, top artists, tracks, genres and podcasts, and a few "story" cards they can choose to share as images. The service records about {{plays_per_day}} plays a day. Under this exercise's rules the summary covers plays from 1 January up to a cutoff date, plays under 30 seconds and plays in private sessions are excluded, and the summary is revealed to everyone at one announced moment {{freeze_days}} days after the cutoff. At the reveal, requests for summaries climb to about {{launch_peak}} per second within minutes. Each listener sees only their own summary; artists get a separate summary of their own year built only from aggregates.

**Problem Statement.** Design the system from the year's play history to the revealed summaries. Cover how the input is frozen so that every number is reproducible, how the per-listener computation is run once at this scale, the checks that must pass before anything is published, how summaries are stored and served at the reveal, how share images are produced, what happens to listeners who delete their account or their data between the cutoff and the reveal, and how you correct a mistake found after the reveal for some or all listeners.

**Constraints.** A listener's summary must be the same every time they open it unless it is deliberately corrected, and every figure in it must be traceable to the frozen input. No listener ever sees another listener's data; the artist summary contains aggregates only. Summary reads p99 under 150 ms at the reveal peak. The reveal moment does not move. A listener who has deleted their account by the reveal must not get a summary, a notification or a share image.

**Assumptions.** All volumes, dates and rules are hypothetical and belong to this exercise; check current docs for any real product's rules. The play history already exists as a deduplicated, partitioned event table with listener id, track or episode id, device type, start time and milliseconds played. The catalogue maps tracks to artists (primary and featured) and genres.

**Clarifications.**
- Q: Do featured artists count toward a listener's top artists? | A: Under this exercise's rule, only the primary artist does. Say how you would change it if that rule changed.
- Q: What about plays that arrive late, for example from offline devices after the cutoff? | A: Your call: include those that arrive before the freeze, or not; say which and keep it consistent for everyone.
- Q: Can the computation be rerun if it fails? | A: Yes, but it must give the same result from the same frozen input.
- Q: Is the reveal the same instant worldwide? | A: Yes, one announced moment; listeners in some markets see it at night.
- Q: Do listeners with very little listening get a summary? | A: Only above a minimum of listening that you choose and state; below it they get a short message instead.

**Hints.**
1. Freeze the input as a versioned snapshot and make the computation a pure function of it. Reproducibility is what makes checks, reruns and corrections possible.
2. Separate computing, checking and publishing. Nothing becomes visible until checks pass, and publishing is a pointer switch, not a rewrite.
3. The reveal is a read storm on precomputed, immutable records keyed by listener. Think about what can be cached, pre-warmed and generated lazily.

**Follow-ups.**
1. Walk through the computation for one listener and then for all of them: the joins, the partitioning, the heaviest step and how long it takes at {{plays_per_day}} plays a day.
2. What checks run before publishing, and which ones block the reveal versus only raise an alert?
3. How do share images get produced for {{listeners}} listeners without rendering every image in advance?
4. A bug affects the top-genre card for 4% of listeners and is found two days after the reveal. What do you correct, how, and what do those listeners see?
5. How would you prove, a month later, that no deleted account received a summary or a notification?

**Follow-up rules.**
- when: spark, mapreduce, batch job, dataflow → ask: The job's shuffle on listener id hits a few listeners with ten times the usual plays, such as shared accounts on a speaker in a shop. What happens to that stage, and what do you do about it?
- when: cache, cdn, edge → ask: The reveal is one moment worldwide. What is in the cache at that moment, and what happens to the first request for a listener whose record is not cached?
- when: recompute, rerun, backfill → ask: You rerun the job after a fix. How do you show that every listener the fix did not touch has a byte-identical summary?
- when: delete, deletion, erasure → ask: A listener deletes their account an hour before the reveal. Which systems still hold their summary, and what stops each of them from showing it?
- when: sample, sampling, spot check → ask: Your spot checks pass, but the error affects one device type in one market. What check would have found it?

**Production Reality Check.**
- The week before the reveal, a check finds that listeners on one smart-speaker client have about 1.8 times more minutes in their summary than their app's own listening history shows: a backfill in the spring re-delivered a month of that client's plays with new event ids.
- At the reveal, reads reach {{launch_peak}} per second as forecast, but share-image rendering falls behind and 30% of share attempts time out while summaries themselves load normally.
- About 40,000 listeners deleted their accounts during the {{freeze_days}} days between the cutoff and the reveal; on reveal day some of them receive the push notification announcing their summary.
- The day after the reveal, many listeners in one market post that their top track is one they never chose: a client version in that market reported milliseconds played from when a track was queued rather than when it started, so tracks that played automatically and were skipped within seconds passed this exercise's 30-second rule.

**Evaluation Criteria.** Frozen, versioned input and a deterministic computation that can be rerun; a clear plan for the heavy steps (partitioning by listener, skew handling, cost and duration estimates); checks before publishing (reconciliation with known totals, distribution and drift checks by market and device type, exclusion rules, privacy checks on the artist aggregates) with blocking versus alerting decisions; immutable per-listener records published by a pointer switch, served from a store and cache sized and pre-warmed for the reveal, with share images generated lazily and degraded gracefully; deletion honoured at every layer up to and after the reveal, including notifications; corrections as new versions for an affected set with an audit; adapts to each incident with diagnosis, recovery and prevention.

## SPT-L4-02: Group listening sessions: one shared queue, several listeners, playback in sync

| | |
|---|---|
| **Template ID** | SPT-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time shared state / session coordination, clock sync, conflicting edits, session success metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "sessions": {"2": ["200,000", "500,000"], "3": ["2 million", "4 million"]},
  "max_people": [8, 16, 32],
  "drift_ms": [150, 300, 500],
  "mode": ["each participant listening on their own device, in different places", "everyone in one room, with one speaker playing for the group", "a mix of people in one room and people joining from elsewhere"]
}
```

**Business Scenario.** A listener can start a group listening session and invite others with a link. Up to {{max_people}} people can join; everyone can add tracks to a shared queue, reorder it, and (if the host allows) skip, pause or play. The setting for this exercise is {{mode}}. At the evening peak about {{sessions}} sessions are live at once. The product team wants participants who play on their own devices to stay within {{drift_ms}} ms of each other, and wants to know how many sessions "succeed", a word nobody has defined yet.

**Problem Statement.** Design the session service and its measurement. Cover how a session and its queue are represented and where the authoritative state lives, how edits from several participants are applied and ordered, how playback position is kept in sync across devices and networks, what happens when the host leaves or loses connection, how invites, joins and plan rules are enforced, how the system scales to {{sessions}} live sessions, and how session success is defined, measured and reported.

**Constraints.** An edit (add, move, remove, skip) must be visible to every participant within 1 second at p95. Two participants acting at the same moment must never produce an outcome neither of them asked for, such as two tracks skipped for two presses. A participant on a poor mobile network must not stall the session for everyone else. Analytics use session-level events and aggregates; they never expose which tracks a named participant added to anyone outside the session.

**Assumptions.** All volumes, limits and rules are hypothetical and belong to this exercise; check current docs for any real product's rules. Each device already has a playback client that can seek to a position, buffer ahead and report its state. Rights to play a track can differ by market; participants may be in different markets.

**Clarifications.**
- Q: Who can join? | A: Anyone with the link while it is valid, up to {{max_people}} people. Under this exercise's rule only some plan types can host; you decide where that is checked.
- Q: Does the session end when the host leaves? | A: Your call: end it, or hand the host role to someone else. Say what participants see either way.
- Q: What if a track in the queue is not available in one participant's market? | A: That participant must not play it. Say what they hear instead and whether the session stays in step.
- Q: Is perfect sync required? | A: No. {{drift_ms}} ms is the target for separate devices; in one room with one speaker, only the speaker plays.
- Q: Do sessions need to survive a server restart? | A: Yes, without participants noticing more than a brief pause.

**Hints.**
1. Give each session one authority (a single writer) that sequences every edit and assigns it a version number; clients send intents, not results.
2. Express "skip" and "move" against the version or item the client saw, so two concurrent presses on the same track collapse into one action.
3. Sync is about a shared clock, not about pushing positions constantly: the authority publishes "track X started at server time T", and clients estimate their offset to server time.

**Follow-ups.**
1. Walk through two participants pressing skip within 50 ms of each other. What does each send, what does the authority do, and what does everyone hear?
2. How does a client stay within {{drift_ms}} ms of the others, and how do you measure the drift you actually achieve?
3. The node holding 5,000 live sessions dies. What do participants experience, and how is each session's state recovered?
4. Define a successful session in a way the product team can act on, and show the event model and the query that produce the weekly number.
5. How would you test the whole system at {{sessions}} live sessions before a launch?

**Follow-up rules.**
- when: crdt, operational transform, ot → ask: With one authority per session already sequencing edits, what does that technique buy you, and what does it cost in client complexity?
- when: websocket, persistent connection, long poll → ask: How many connections does each server hold at {{sessions}} live sessions with an average group size of four, and what happens to them during a deploy?
- when: timestamp, client clock, device time → ask: One participant's phone clock is 40 seconds fast. Where does that error show up in your design, and what protects the others?
- when: database, postgres, dynamodb, cassandra → ask: Is that store on the path of every edit? What is its write rate at peak, and what latency does it add to each skip?
- when: success rate, success metric, kpi → ask: Your metric rises 15% after a release that made sessions harder to join. What is wrong with it?

**Production Reality Check.**
- After a client release, the share of sessions where any two devices drift by more than {{drift_ms}} ms rises from 2% to 18%; it is concentrated on one operating system version whose audio output latency the client no longer compensates for.
- A host's phone goes through a tunnel and loses its connection for 90 seconds; the other participants' queues freeze, and when the host reconnects, three tracks they added during the gap are missing.
- The weekly session success rate drops by a fifth overnight with no change in usage, after a client change stopped sending a "joined" event for the host.
- A popular show asks its audience to start sessions at the same minute; session creation reaches ten times the normal rate for five minutes and invite links begin to fail.

**Evaluation Criteria.** One authoritative, sequenced state per session with versioned edits and intent-based commands that make concurrent actions idempotent; a session placement and failover plan (sharding by session id, state snapshotted or logged so a restart is a brief pause); clock-offset estimation and scheduled playback against server time, with drift measured from client reports; host departure, network loss and per-market availability handled explicitly; capacity estimates for connections and edit rates; a precise, gaming-resistant definition of session success built on a clear event model, aggregated without exposing individuals; adapts to each incident with diagnosis, recovery and prevention.

## SPT-L4-03: Artist analytics platform: streams, listeners, saves and playlist adds, refreshed daily and consistent with yearly summaries

| | |
|---|---|
| **Template ID** | SPT-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Analytics serving / shared metric definitions, distinct counts over ranges, aggregation thresholds, daily SLAs |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "artists": {"2": ["3 million", "6 million"], "3": ["10 million", "12 million"]},
  "plays_per_day": {"2": ["1 billion", "2 billion"], "3": ["5 billion", "8 billion"]},
  "refresh_hour": ["06:00", "09:00", "12:00"],
  "min_listeners": [50, 100, 250]
}
```

**Business Scenario.** About {{artists}} artists and their teams use an analytics app that shows, per artist, track and release: streams, listeners, saves, followers and playlist adds by playlist type (editorial, personalised, listener-made), with breakdowns by country, city, age band and source of the stream. The service records about {{plays_per_day}} plays a day. Under this exercise's rules a stream counts when at least 30 seconds were played, numbers refresh once a day and must be ready by {{refresh_hour}} UTC, and any breakdown cell with fewer than {{min_listeners}} listeners is not shown. Artists also see the same figures again in their yearly summary, and they compare the two.

**Problem Statement.** Design the platform. Cover the metric definitions and where they live so the analytics app and the yearly summaries cannot disagree; how daily aggregates are built from play events, saves, follows and playlist changes; how distinct listeners are computed for arbitrary ranges (last 7 days, 28 days, 12 months, since release) and breakdowns; how breakdowns are protected by the minimum; how featured artists, team access and removed or re-released tracks are handled; how late and restated data flow through; and how the app answers fast.

**Constraints.** Dashboards load p95 under 1 second. Numbers for a day, once shown, change only through an explained restatement. Distinct listener counts must be correct to within 1% where exact counts are not feasible, and the app must say which numbers are estimates. Listener data appears only as aggregates; no artist ever sees a named listener. Artist team members see only the artists they have been granted.

**Assumptions.** All volumes, thresholds and rules are hypothetical and belong to this exercise; check current docs for any real product's rules. Play events arrive deduplicated with listener id, track id, country, city, device type, source (playlist id and type, album, search, radio) and milliseconds played. Listener age bands come from a profile table and may be missing. Some streams are held back for integrity checks and released or removed later; that process is outside this design but its outputs reach it.

**Clarifications.**
- Q: Does a stream of a track with a featured artist count for both artists? | A: Yes for each artist's streams under this exercise's rule, but the listener counts once per artist; a release's totals must not double count it.
- Q: How far back can data change? | A: Late offline plays arrive up to 30 days late, and held-back streams can be released or removed up to 60 days later.
- Q: Must per-country listeners add up to total listeners? | A: They cannot always, because one listener can listen from two countries. Decide what you show and explain it to artists.
- Q: Are personalised playlists shown by name? | A: No. Plays from personalised playlists appear as one aggregate source.
- Q: How many artist team members are there? | A: Several million accounts with per-artist roles.

**Hints.**
1. Define each metric once, in one versioned place, and have both the daily aggregates and the yearly summary pipeline read that definition.
2. Distinct counts do not add up across days or countries. Store mergeable sketches per day and dimension, or precompute the fixed windows exactly; know which you are doing for each number.
3. Apply the minimum-listeners rule at query time on the final cell, and think about what can be inferred by subtracting two cells that are each above it.

**Follow-ups.**
1. Walk through how "listeners in the last 28 days by city" is computed and served for one artist, and how much storage it needs across {{artists}} artists.
2. A day's numbers are restated after held-back streams are removed. What do artists see, and how do the yearly summaries stay consistent with the app?
3. How do you stop someone learning about a small group of listeners by comparing breakdowns that are each above {{min_listeners}} listeners?
4. A track is taken down and re-released under a new id. What happens to its history and to the artist's totals?
5. The daily refresh must also produce numbers by the artist's own time zone. What does that do to your aggregates?

**Follow-up rules.**
- when: hyperloglog, hll, sketch, approximate → ask: An artist with 120 listeners in a city sees 118 one day and 123 the next for the same window. How do you explain that, and where do you use exact counts instead?
- when: olap, druid, pinot, clickhouse, cube → ask: Which dimensions do you pre-aggregate, and what does a query by city, age band and source together do to that store?
- when: reprocess, restatement, restate, backfill → ask: An artist screenshotted last week's number and it has changed. What does the app show to explain the difference?
- when: k-anonymity, threshold, minimum count → ask: Two date ranges are each above the minimum, and their difference is a single day with three listeners. Is that a leak, and what do you do?
- when: materialized view, materialised view, precompute → ask: How long does the full daily precompute take, and what happens to the {{refresh_hour}} UTC deadline when one input arrives four hours late?

**Production Reality Check.**
- On a Friday of many new releases, the play-event partition for the previous day lands nine hours late; the {{refresh_hour}} UTC refresh deadline is missed and artists who released at midnight see no first-day numbers.
- An artist posts publicly that the sum of their listeners by country is 18% higher than their total listeners and asks whether the numbers are inflated.
- A label notices that an album's streams in its yearly summary are 3% lower than the sum of the daily figures in the app for the same year; the summary pipeline still uses an older definition that excludes plays from one source.
- A breakdown by age band and city for a small artist shows a cell with {{min_listeners}} listeners on one day and none the next, because the threshold was applied before a late correction removed a few listeners.

**Evaluation Criteria.** Metric definitions owned once and shared by the daily aggregates and the yearly summary, with versioning; daily partitioned aggregates from events with clear handling of featured credits, re-releases and team access; distinct counts by mergeable sketches or exact precomputed windows, with the choice stated per metric and shown to users; minimum-count protection applied to final cells with defences against differencing; late data and held-back stream outcomes flowing in as explained restatements; a serving store sized for the dashboard latency; SLA monitoring with a plan for late inputs; adapts to each incident with diagnosis, recovery and prevention.

## SPT-L4-04: Weekly personalised playlists for every listener, from a scoring function you are given

| | |
|---|---|
| **Template ID** | SPT-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Large batch generation / time-zone scheduling, filtering rules, versioned outputs, delivery deadlines, measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer, software-engineer |

```params
{
  "listeners": {"2": ["150 million", "300 million"], "3": ["500 million", "650 million"]},
  "tracks": [30, 40, 50],
  "candidates": [500, 1000, 2000],
  "per_artist": [2, 3]
}
```

**Business Scenario.** Every listener gets a personalised playlist of {{tracks}} tracks each week, ready at 00:00 on Monday in the listener's own time zone; about {{listeners}} listeners are eligible. You do not design the recommendation model. You are given a candidate service that returns about {{candidates}} candidate tracks for a listener and a scoring function that returns a score for each candidate; both are owned by another team, versioned, and expensive to call. Under this exercise's rules a playlist must not include tracks the listener played in the last 90 days, tracks or artists they have hidden, explicit tracks if their setting excludes them, tracks unavailable in their market, or more than {{per_artist}} tracks by one primary artist.

**Problem Statement.** Design the weekly generation and delivery. Cover scheduling across time zones so every playlist is ready on time, how candidate and scoring calls are batched and paced, how the filtering and diversity rules are applied and proven, how each week's playlist is written as a new version, what happens when generation fails for some listeners, how changes between generation and delivery (rights, settings, hidden artists) are handled, and how you measure the playlists in aggregate, including when the scoring team ships a new version.

**Constraints.** A listener's playlist must be ready by 00:00 Monday local time; the earliest time zone is 26 hours ahead of the latest. The scoring function can be called at a fixed capacity agreed with its owners and must not be pushed past it. A listener must never be shown a track their settings exclude at the time they open the playlist. Measurement uses aggregates (saves, plays, skips, completion) by cohort and scoring version; no team browses an individual listener's playlist.

**Assumptions.** All volumes, rules and capacities are hypothetical and belong to this exercise; check current docs for any real product's rules. The candidate service and the scoring function are black boxes with documented inputs, outputs, versions and capacity. Listener settings, hidden items and market are available from profile services; the catalogue provides availability per market and an explicit flag.

**Clarifications.**
- Q: Can I change the scoring function? | A: No. You may choose which version to call and run controlled comparisons between versions.
- Q: What if a listener has too few candidates after filtering? | A: Decide: a shorter playlist, or a fallback source you name. Never pad with tracks that break the rules.
- Q: Can generation start days early? | A: Yes, but the 90-day rule and settings are judged at generation, and changes after that must still be respected when the listener opens it.
- Q: How are new listeners handled? | A: Listeners with under four weeks of history are not eligible in this exercise.
- Q: What does "ready" mean? | A: The new version is the one the listener's app shows, and any notification has been sent.

**Hints.**
1. Work out the scoring calls per week and divide by the capacity; that tells you how early you must start and how to order listeners by time zone.
2. Keep generation (expensive, early) separate from a cheap validation at delivery or open time that re-checks settings and availability.
3. Store each week's playlist as an immutable version with the inputs' versions recorded, and switch a pointer at delivery.

**Follow-ups.**
1. With {{listeners}} listeners and {{candidates}} candidates each, how many scoring calls per week is that, and what schedule meets every time zone's deadline at a fixed capacity?
2. How do you prove every delivered playlist obeys the filtering rules, including no more than {{per_artist}} tracks by one primary artist?
3. A track's rights change on Sunday in one market, after playlists are generated. What do listeners in that market see on Monday?
4. The scoring team ships a new version. How do you compare it with the old one on your aggregate measures without delaying anyone's playlist?
5. Generation for 6% of listeners fails on Sunday night. What does each of them see on Monday, and what do you do before the next time zone's deadline?

**Follow-up rules.**
- when: spark, batch, dataflow, mapreduce → ask: The scoring calls dominate the cost, not the joins. How does your batch job respect the scoring function's capacity without idling the cluster?
- when: cache, cached, precompute → ask: You generated a playlist on Friday. On Sunday the listener hides an artist that appears twice in it. What happens when they open it?
- when: a/b test, experiment, holdout → ask: Listeners in the new version's arm also get notified at a different time because of a scheduling change. Is the comparison still valid?
- when: retry, retries, fallback → ask: Your fallback serves last week's playlist. Which of this exercise's rules does that break, and is it acceptable?
- when: time zone, timezone, utc → ask: A listener travels and their device's time zone changes on Sunday. Whose midnight decides when their playlist is ready?

**Production Reality Check.**
- On Saturday the scoring function's owners halve the capacity available to you for six hours; generation for the time zones that reach Monday first is still running.
- On Sunday a catalogue rights change makes 3% of tracks unavailable in one market; about a fifth of that market's already generated playlists contain at least one of them.
- After a new scoring version is adopted, a slice of listeners receive playlists with the same artist eight times: tracks where that artist is credited as featured were not grouped under their primary artist, so the limit of {{per_artist}} per artist did not catch them.
- The weekly report shows completion rates up 12% in one week; the rise comes from a client change that started playlists automatically when the app opened, not from better playlists.

**Evaluation Criteria.** Capacity arithmetic for candidate and scoring calls with a schedule ordered by time-zone deadline and paced to the agreed capacity; filtering and diversity rules applied deterministically, proven by checks on every delivered playlist, and re-checked cheaply at open time for settings and availability; immutable, versioned weekly playlists with recorded input versions and a pointer switch at delivery; explicit fallbacks that never break the rules; aggregate measurement by cohort and scoring version with controlled comparisons and guards against instrumentation changes; respects the black-box boundary of the scoring function; adapts to each incident with diagnosis, recovery and prevention.

## SPT-L4-05: Stream-count integrity: holding back suspicious streams, then restating charts and artist numbers

| | |
|---|---|
| **Template ID** | SPT-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Integrity pipelines / aggregate signals, hold-back states, published charts, restatement and audit (described generally) |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "streams_per_day": {"2": ["1 billion", "2 billion"], "3": ["5 billion", "8 billion"]},
  "hold_hours": [24, 48, 72],
  "reviewers": [10, 25, 60],
  "chart_day": ["Monday", "Thursday", "Friday"]
}
```

**Business Scenario.** A streaming service counts about {{streams_per_day}} streams a day. The counts feed weekly charts published every {{chart_day}}, the numbers artists see in their analytics, and the usage reports that pay rights holders. Some streams are artificial: generated to inflate a track's numbers rather than by people choosing to listen. The service wants a system that finds such streams from aggregate patterns, keeps them out of charts and artist numbers, and corrects published numbers when a decision is made later. Under this exercise's rules a stream is held back for at most {{hold_hours}} hours before it either counts or is excluded, and {{reviewers}} trust and safety reviewers examine cases the system is unsure about. This exercise is about the data system; describe signals only in general terms.

**Problem Statement.** Design the integrity pipeline around stream counting. Cover the states a stream (or a batch of streams) moves through, from recorded to held back to counted or excluded; which kinds of aggregate signals feed the decisions and how fresh they must be; how decisions are made, recorded and explained (a rule set or a score you are given, plus human review); how charts, artist numbers and payment reports read only settled counts; how a later decision restates numbers already published; how artists and distributors are told; how appeals work; and how you measure false positives and false negatives.

**Constraints.** A chart, once published, is never silently edited; a correction is a new, explained version. Every exclusion must be traceable to the evidence and the rule or score version that caused it, and reversible on appeal. Detection uses aggregates and account-level signals; it never reads private messages, and listener data shown to anyone outside the integrity team is aggregated. Holding back must not delay a chart's publication. The system must not describe or expose its detection logic to the parties it evaluates.

**Assumptions.** All volumes, rules and staffing are hypothetical and belong to this exercise; nothing here describes any company's real detection, counting or payment process, and the 30-second threshold for counting a stream is this exercise's rule. Play events arrive deduplicated with listener id, track id, device type, network-level metadata, country and milliseconds played. A scoring function for suspiciousness is given to you as a black box with a version.

**Clarifications.**
- Q: Do held-back streams count toward the listener's own history and yearly summary? | A: The listener's own history always shows what they played; whether held-back streams count in their summary is your call, stated.
- Q: Who decides an exclusion? | A: Rules and the given score decide clear cases automatically; unsure cases go to review. You design the thresholds' governance, not the score.
- Q: What does an artist see when streams are excluded? | A: A notice that some streams were not counted, with the period and the number, but not how they were detected.
- Q: Can a whole track be excluded? | A: Streams are excluded, not tracks; a track can have some streams counted and some not.
- Q: How late can a decision be made? | A: Most within {{hold_hours}} hours; investigations can conclude up to 90 days later and must then restate.

**Hints.**
1. Model integrity as states with timestamps on stream batches (recorded, held, counted, excluded, reinstated), and make every downstream number read from settled states only.
2. Treat each decision as an append-only record with its evidence summary and the versions of the rules and score used; restatements are new versions of aggregates, never edits.
3. False positives matter as much as missed abuse: a legitimately viral track looks unusual too. Plan how you measure both.

**Follow-ups.**
1. Walk through one hour of streams for one track from recording to the weekly chart: the states, the stores and the decision points.
2. How does the {{hold_hours}}-hour hold interact with the {{chart_day}} chart deadline? What does the chart count for streams still held at the cutoff?
3. An investigation concludes 40 days later that a track's streams over three weeks should be excluded. What is restated, in what order, and who is told?
4. How do you measure the false-positive rate with {{reviewers}} reviewers, and how do you stop that measurement being biased by what the system already flagged?
5. A rule change is proposed that would exclude twice as many streams. How do you evaluate and roll it out safely?

**Follow-up rules.**
- when: machine learning, model, classifier → ask: The score is given to you. What does your system need from it (a version, calibration, an explanation field), and what do you do when its owners change it?
- when: real-time, streaming, flink, kafka → ask: Which decisions must be made within the hold window, and which can wait for daily aggregates? What does each cost?
- when: delete, remove, purge → ask: An appeal succeeds three weeks after the streams were excluded. If you deleted them, how do you reinstate them and restate every report?
- when: chart, ranking, top 50 → ask: A restatement moves a track from seventh to thirty-first on a chart already published. What do you publish, and what happens to the tracks that move up?
- when: threshold, cutoff, score above → ask: Who owns that threshold, what evidence changes it, and how is each change recorded?

**Production Reality Check.**
- A track goes viral after a short video trend; many new accounts play it repeatedly within hours, the system holds back 60% of its streams for {{hold_hours}} hours, and the artist's team posts publicly that their numbers have frozen.
- An investigation finds that a track that charted at number seven two weeks ago should have charted at number thirty-one; the restatement changes a chart, the artist's numbers and a payment report already sent.
- A rule change deployed on a Tuesday raises held-back streams from 0.3% to 4% of all streams overnight, and the {{chart_day}} chart is due in two days.
- Review cases pile up to nine days of work for {{reviewers}} reviewers, so held-back streams are timing out of their {{hold_hours}}-hour hold and being counted by default.

**Evaluation Criteria.** Explicit, timestamped integrity states with charts, artist numbers and payment reports reading settled counts only; signals described generally as aggregates (concentration, repetition, account and network-level patterns) with freshness matched to the hold window, never as evasion detail; decisions as append-only records with evidence summaries and rule and score versions, reversible on appeal; review capacity planned with prioritisation and a stated default when a hold expires; restatements as new, explained versions of charts and reports with notices to artists and distributors; false positives measured from unbiased samples and rule changes evaluated in shadow before rollout; adapts to each incident with diagnosis, recovery and prevention.
