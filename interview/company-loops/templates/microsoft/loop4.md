# Microsoft · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a company that
runs a public cloud, a productivity and collaboration suite with an AI
assistant, a desktop operating system and a gaming network. Every workload,
number and schema is hypothetical, and nothing here describes how the company's
own systems are built.

## MSF-L4-01: Staged OS update rollout with automatic safeguard holds

| | |
|---|---|
| **Template ID** | MSF-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Progressive delivery / rollout control, cohort health signals, automatic holds |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "devices": {"2": ["150 million", "400 million"], "3": ["900 million", "1.4 billion"]},
  "cohorts": ["20,000", "80,000", "250,000"],
  "stages": [4, 6, 8],
  "decision_window": ["24 hours", "72 hours"]
}
```

**Business Scenario.** A desktop operating system ships a new feature update to about {{devices}} eligible devices. Devices are not all alike: the combination of device model, firmware, drivers and installed security or management software forms about {{cohorts}} distinct hardware and software cohorts. Consumers receive the update when the vendor offers it; organisations place their managed devices in their own deployment rings (a pilot ring first, broad rings after a deferral of some days), and the vendor's offer applies within those choices. The vendor releases the update in {{stages}} stages, each offered to a larger share of eligible devices. Devices that opted in to diagnostic data report install outcomes (downloaded, installed, failed with an error code, rolled back), boot failures and crash rates after install. When a cohort shows a problem, the vendor places a hold: in this exercise's rule, a hold stops offering the update to every device matching a rule (for example "this device model with this driver version") until a fix ships, and is then released.

**Problem Statement.** Design the rollout system: the offer decision a device receives when it checks for updates; how stages widen; the health-signal pipeline from device reports to per-cohort metrics; automatic detection of a cohort that is failing; creating, matching and releasing holds; how organisations' ring choices are respected; and the audit trail that explains why any one device was or was not offered the update on a given day. Say how a stage widens only after {{decision_window}} of healthy signals.

**Constraints.** An update check from a device must be answered in under 200 ms p99, and devices check at all hours. A hold must reach every matching device's next check within 15 minutes of being created. A device that has already installed the update is not uninstalled automatically; it can be offered a fix or a rollback. Diagnostic data comes only from devices whose users allowed it, so some cohorts are thinly observed. Every offer decision must be reproducible later.

**Assumptions.** All device counts, cohort counts, stage counts and timings are hypothetical. Devices send their model, firmware, driver and software inventory with each update check. Install outcomes arrive minutes to hours after the event; devices that are offline report days later.

**Clarifications.**
- Q: Who defines the cohorts? | A: You do. Say which attributes form a cohort, and what happens when a problem depends on an attribute your cohort key leaves out.
- Q: Does a hold cancel downloads already in progress? | A: In this exercise a device that has downloaded but not installed re-checks the hold before installing; a device that has installed is handled by a fix or a rollback offer.
- Q: Can an organisation override a hold? | A: In this exercise an administrator can explicitly install on managed devices despite a hold, and the system records that choice; consumers cannot.
- Q: How many devices must report before a cohort is judged? | A: That is part of your design. Some cohorts have a few hundred devices in total.
- Q: Who releases a hold? | A: An engineer, when the fix (a driver update, an app update or a revised OS update) is available; you decide how much of that is automated.

**Hints.**
1. Separate the control plane (stages, holds, ring policies, versioned and audited) from the data plane that answers device checks from a compiled, cached copy of the rules.
2. Health is a comparison, not an absolute: compare a cohort's failure rate on the new update with the same cohort's rate on the previous update, and require a minimum sample before acting.
3. A hold is a rule that matches device attributes. Decide how specific it is, and what happens to devices whose attributes change after the hold is placed.

**Follow-ups.**
1. Walk through one update check: what the device sends, what the service evaluates, in what order (eligibility, organisation ring, holds, stage), and what it returns.
2. How do you decide that a cohort with 300 devices in stage one is failing, without placing holds on hundreds of healthy cohorts by chance?
3. A problem appears only for one driver version on several device models. How does the detection find the common attribute, and how is the hold scoped?
4. How do you widen from stage to stage automatically, and what stops the widening when the health signal itself is late?
5. An organisation asks why 40 of its devices did not receive the update last Tuesday. What does the system let you show them?

**Follow-up rules.**
- when: percentage, percent, random sample, hash → ask: The stage is a percentage of devices. How do you keep the same device in the same stage across checks, and keep each stage representative of every cohort?
- when: threshold, failure rate, error rate → ask: A cohort has 40 reporting devices and 3 failures. Is that over your threshold? How does the rule behave for small and large cohorts?
- when: cache, cdn, edge → ask: A new hold is created. How long until every cached copy of the rules has it, and what does a device checking in the meantime receive?
- when: rollback, roll back, uninstall → ask: Devices that installed before the hold keep failing to boot. What does your system offer them, and how do you know it worked?
- when: kafka, stream, streaming → ask: Install outcomes arrive hours late from devices that were offline. How does your per-cohort metric avoid judging a cohort before its failures have arrived?

**Production Reality Check.**
- Midway through stage two, a hardware partner releases a new graphics driver. Devices with that driver and the new update fail to boot, but the automatic hold rule is keyed on device model only, so no hold matches; failures rise across 60 models at once.
- The health-signal pipeline falls 10 hours behind over a weekend. The rollout controller reads the empty window as "no failures" and widens to the next of the {{stages}} stages.
- A hold for one device model is released when the fixed driver ships, but the release removes the hold for the whole model, including devices still on the old driver; they are offered the update and fail.
- In stage one, detection places holds on more than a thousand small cohorts in a day, most of them healthy, because a few failures among a few dozen devices crossed a fixed percentage threshold.

**Evaluation Criteria.** Control plane and data plane separated, with versioned, audited rules compiled for fast evaluation; a deterministic, stable assignment of devices to stages that represents cohorts; an evaluation order that respects organisations' rings and holds; a health pipeline that compares against a baseline, accounts for late reports and small samples, and fails closed when its own data is late; holds as specific attribute rules that can be narrowed and released safely; offer decisions reproducible per device and day; adapts to each incident with diagnosis, recovery and prevention.

## MSF-L4-02: Presence across many clients for a collaboration app

| | |
|---|---|
| **Template ID** | MSF-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time state / multi-device aggregation, fan-out, connection management |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "online": {"2": ["15 million", "40 million"], "3": ["120 million", "250 million"]},
  "watchers": [40, 150, 500],
  "regions": [3, 6, 10],
  "heartbeat": [30, 60, 120]
}
```

**Business Scenario.** A workplace chat, meetings and calling app shows each person's presence next to their name: Available, Busy, In a call, In a meeting, Do not disturb, Away, Offline, and a status the person sets themselves, optionally until a time. A person is often signed in on several clients at once (desktop, web, phone), and their presence is derived from all of them plus their calendar: activity or idleness on each client, joining a call on any client, a meeting in the calendar, a status they set. At peak about {{online}} people are online, served from {{regions}} regions. Each person's presence is watched by about {{watchers}} others on average (people viewing a chat, a channel, a contact list or a meeting roster), and far more for some. Clients keep a connection to the service and send a heartbeat every {{heartbeat}} seconds.

**Problem Statement.** Design the presence service: the per-client signals and how they are stored; the rule that combines a person's clients, calendar and set status into one presence; detection that a client is gone; subscriptions (who is watching whom) and fan-out of changes to watchers; how it spans {{regions}} regions; and the privacy controls (an organisation can limit what people outside it see). Say how a change reaches watchers quickly without flapping.

**Constraints.** A presence change should reach online watchers within 2 seconds p99. A person whose every client has disconnected must show Offline within a bounded time you state. Presence must never show a person as available while they are in a call on any client. A status set "until 17:00" must end at 17:00 in the person's time zone even if none of their clients is running. Watchers outside the person's organisation may see only what the organisation allows.

**Assumptions.** All counts, rates and intervals are hypothetical. Calendar events arrive from the calendar service as change notifications. Each client sends events with a sequence number per connection.

**Clarifications.**
- Q: Which signal wins when clients disagree? | A: You define the precedence; say why. A call on any client and a set status are the usual candidates to outrank idleness.
- Q: Does every watcher need every change? | A: Only watchers currently looking at the person. A contact list in a closed window needs nothing until it opens.
- Q: Is presence stored for analysis later? | A: Not in this exercise; it is live state. Say what you would keep for debugging.
- Q: Are people in different regions watching each other? | A: Yes, often, especially across organisations and in large meetings.
- Q: Can a phone app keep a connection open in the background? | A: Not reliably; mobile operating systems suspend background apps, and push notifications are the usual channel.

**Hints.**
1. Keep per-client state with a lease that heartbeats renew; a person's presence is a pure function of their live client states, calendar and set status, recomputed when any of them changes.
2. Fan-out cost is changes per second × watchers per change. Reduce both: suppress changes that do not change the visible state, and push only to watchers with an active view.
3. Put a person's presence state in one home region and route reads and subscriptions to it, or replicate it; each choice has a cost when people in different regions watch each other.

**Follow-ups.**
1. Write the precedence rule that combines three clients, a calendar meeting and a set status into one presence. What happens when the phone stops heartbeating mid-call?
2. How many fan-out messages per second does your design send at peak, and what do you do for a person watched by 50,000 people in a company-wide meeting?
3. A person goes idle on the desktop and immediately active on the phone. How do you avoid sending Away then Available to every watcher?
4. A region loses its connection gateways for a minute and every client reconnects at once. What do watchers see, and how does the service survive the reconnect?
5. How does a set status expire at 17:00 local time when none of the person's clients is connected?

**Follow-up rules.**
- when: database, write every heartbeat, persist → ask: At {{online}} people and a {{heartbeat}}-second heartbeat, how many writes per second is that, and which of them change anything a watcher can see?
- when: pub/sub, publish, broadcast → ask: Who subscribes to a person's channel, and what happens to the cost when a meeting roster of 10,000 people all watch each other?
- when: last write wins, last-write-wins, timestamp → ask: Two clients of the same person send updates whose clocks disagree by a minute. Whose update wins in your design, and is that the right presence?
- when: replicate, replication, global → ask: A watcher in one region looks at a person homed in another. What latency does each read or update take, and what does a region failure do to that person's presence?
- when: push notification, mobile, phone → ask: The phone cannot keep a connection in the background. How does the service know whether the phone is still in a call?

**Production Reality Check.**
- A gateway deployment in one of the {{regions}} regions restarts its connection servers at once; millions of clients reconnect within seconds, each reconnect publishes Offline then Available, and fan-out traffic rises fortyfold for ten minutes.
- People in calls on their phones show Away: the phone's client is suspended in the background and stops sending activity, and the precedence rule lets the desktop's idle state win over the call.
- Statuses set "until 17:00" stay on all night for people who closed every client before 17:00, because expiry is evaluated only when a client sends an event.
- A company-wide meeting with 60,000 attendees makes every attendee watch every other on the roster; fan-out for that tenant saturates its partition and presence for unrelated people on the same partition lags by minutes.

**Evaluation Criteria.** Per-client leases renewed by heartbeat and a stated offline bound; presence as a deterministic function of client states, calendar and set status with explicit precedence (a call outranks idleness); server-side timers for expiries; change suppression and coalescing before fan-out; subscriptions scoped to active views, with special handling for very large audiences; a home-region or replicated design with its costs across regions; organisation-level visibility rules applied on read; reconnect storms absorbed with jitter and grace periods; adapts to each incident with diagnosis, recovery and prevention.

## MSF-L4-03: Permission-aware document index for a workplace assistant

| | |
|---|---|
| **Template ID** | MSF-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Retrieval systems / security trimming, permission change propagation, deletion |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "documents": {"2": ["80 million", "300 million"], "3": ["3 billion", "8 billion"]},
  "tenants": ["20,000", "150,000"],
  "largest_group": ["40,000", "250,000"],
  "apply_within": ["5 minutes", "15 minutes", "1 hour"]
}
```

**Business Scenario.** A productivity suite adds an assistant that answers employees' questions using their organisation's documents: files in team sites and personal storage, pages and shared notebooks. The index covers about {{documents}} documents across {{tenants}} customer organisations (tenants). Who may open a document is decided by the suite's own permissions: users and groups (groups can contain groups, and the largest has about {{largest_group}} members), permissions inherited from a site or folder unless a document breaks inheritance, and sharing links (specific people, or anyone in the organisation who has the link). The assistant retrieves passages relevant to the question and answers from them. It must use only content the asking user can open at the moment they ask, and a permission change, a removal from a group or a deletion must take effect in the assistant within {{apply_within}}.

**Problem Statement.** Design the indexing and retrieval system: ingestion of content changes and permission changes; chunking and embeddings; the index layout across tenants; how permissions are represented next to indexed passages; security trimming at query time; the propagation of permission changes, group changes and deletions; and caching that never leaks content between users. Say how retrieval quality survives trimming when most of the closest passages belong to documents the user cannot open.

**Constraints.** Retrieval must answer in under 300 ms p95 including trimming. No passage from a document the user cannot open may reach the model, the answer, a citation or a cache another user can read. Tenants' data never mixes in one result. A deleted document's passages and embeddings must be gone from the index within {{apply_within}}. Re-embedding a document costs model compute; say how often it happens.

**Assumptions.** All counts, latencies and limits are hypothetical. The suite's storage service emits change notifications for content, permissions and deletions; the directory service emits group membership changes. Both can be replayed from a point in time.

**Clarifications.**
- Q: Can we copy the full permission list onto every passage? | A: You can; say what happens when a group of {{largest_group}} people gains access to a site with a million passages, and when one person leaves that group.
- Q: Is the permission check done by the storage service at query time? | A: It can answer "can this user open these documents?" for a batch of up to a few hundred documents in about 50 ms. You decide whether and when to call it.
- Q: Does a sharing link for "anyone in the organisation with the link" let everyone in the organisation see the document in the assistant? | A: In this exercise, no: only people who have opened the link are treated as having access. Say how you learn who they are.
- Q: Are answers cached? | A: You may cache retrieval or answers, if you can prove the cache cannot serve one user's content to another.
- Q: What does a user see when nothing they can open is relevant? | A: The assistant says it found nothing it can use; it must not hint that restricted content exists.

**Hints.**
1. Store on each passage the access principals at the level they were granted (groups, not expanded members), and expand the user's own group memberships at query time. A group change then updates one membership, not millions of passages.
2. Trimming after retrieving the top k passages loses recall when most of them are filtered out. Filter inside the search, or retrieve more and fall back to a second pass.
3. Treat the index's permission data as a cache of the source of truth, and verify the final few documents against the storage service before they reach the model.

**Follow-ups.**
1. Walk through one question: from the user's identity to the passages the model sees. Where is each permission check, and what does each one cost?
2. A person is removed from a group that grants access to a site with 2 million passages. What changes in your index, and how long until the assistant stops using that site for them?
3. Most of the 50 closest passages to a question belong to a document the user cannot open. How does your retrieval still find the best passages they can open?
4. A document is deleted. List every place its content can still exist in your system, and how each is cleaned within {{apply_within}}.
5. How would you prove to a customer's security team that the assistant never used content the user could not open?

**Follow-up rules.**
- when: post-filter, filter after, top k, top-k → ask: The top 50 passages all come from one document the user cannot open. What does your system return, and how do you know?
- when: expand, expanded, flatten → ask: A group of {{largest_group}} people gains access to a site with a million passages. How many index updates does flattening cost, and how long do they take?
- when: cache, cached, caching → ask: Two people in the same tenant ask the same question but can open different documents. What is your cache key, and what happens when one of them loses access an hour later?
- when: vector database, vector index, embedding, embeddings → ask: Your filter is a list of principals per passage. Does your vector index support filtering during search, and how does recall change when the filter is very selective?
- when: nightly, batch, daily → ask: A person is removed from a group at 10:00 and asks a question at 10:20. Does your nightly job meet the {{apply_within}} requirement?

**Production Reality Check.**
- An administrator removes 4,000 people from a group that grants access to a finance site. The index flattened group members onto every passage, so the change is applied by rewriting millions of passages; for six hours, longer than the {{apply_within}} target, removed people still get answers quoting the budget.
- A user asks about a project they work on and the assistant says it found nothing: the 50 closest passages all came from a restricted planning document, and trimming them left an empty list.
- An answer cache keyed by tenant and question text serves one person's answer, citing a document shared only with them, to a colleague who asks the same question.
- A document deleted from a team site still appears in citations for two days, because its passages were removed from the main index but not from a smaller index built for recently changed content.

**Evaluation Criteria.** Per-tenant index isolation; passages carry unexpanded access principals with query-time expansion of the user's memberships; security trimming inside the search with a recall-preserving fallback, plus a final check of the few chosen documents against the source of truth; permission, group and deletion changes as an ordered change stream with a measured propagation lag and alerts against the target; deletion covering every copy (indexes, embeddings, caches); caches keyed by the user's effective permissions or not shared; audit records proving which documents were used; adapts to each incident with diagnosis, recovery and prevention.

## MSF-L4-04: Game achievements from consoles, PC and cloud play

| | |
|---|---|
| **Template ID** | MSF-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Event ingestion / offline sync, idempotency, tamper resistance, aggregate counts |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "players": {"2": ["40 million", "90 million"], "3": ["250 million", "400 million"]},
  "titles": ["3,000", "8,000", "15,000"],
  "offline_days": [7, 14, 30],
  "peak_events": {"2": ["60,000", "150,000"], "3": ["400,000", "1 million"]}
}
```

**Business Scenario.** A gaming network serves about {{players}} monthly players on consoles, PCs and cloud streaming. Each of its {{titles}} games defines achievements with points: some unlock on a single event ("finish the tutorial"), others track progress ("win 100 matches"). The game reports unlocks and progress to the network. Players can play offline on a console or PC for up to {{offline_days}} days; the device queues achievement events and sends them when it reconnects. The same account plays on several devices, sometimes at the same time. The network shows each player's unlocked achievements with unlock dates, their total points, a feed of friends' unlocks, and for each achievement the share of a game's players who have unlocked it ("rarity"). Events peak at {{peak_events}} per second, much higher on a big game's launch day.

**Problem Statement.** Design the achievements service: the event contract between games and the network; ingestion from online and offline devices; per-player achievement state and progress; total points; rarity per achievement; the friends feed; and defences against duplicated, replayed and tampered events. Say what the source of truth is and which views are derived.

**Constraints.** An achievement unlocks at most once per player; its unlock date is when it was earned, not when the event arrived. Total points must equal the sum of unlocked achievements' points at all times a player looks. Progress never moves backwards. A player sees their own unlock within 5 seconds when online. Rarity may lag by an hour. Unlocks found to be fraudulent can be revoked, and every view must reflect the revocation.

**Assumptions.** All player counts, title counts and rates are hypothetical. Games run on the device; PC games can be modified by players. Each event carries a player id, title id, achievement id or progress value, a device id, a device sequence number and a device timestamp, and is signed by the device's runtime.

**Clarifications.**
- Q: Can a game change its achievements after release? | A: A publisher can add achievements in an update; in this exercise, points of an existing achievement never change, and an achievement is never deleted, only hidden.
- Q: Which device's timestamp counts when two devices report the same unlock? | A: You decide, and say what you show if the earliest claim is implausible.
- Q: Is progress reported as increments or as a total? | A: As the game's current total for that player; you decide what to do when two devices report different totals.
- Q: How is rarity's denominator defined? | A: You define it: for example, players who have launched the game at least once.
- Q: What makes an event suspicious? | A: Signs include unlocks faster than the game allows, impossible order, a signature that does not verify, or a device seen sending events for many accounts.

**Hints.**
1. Make the ledger of accepted unlocks the source of truth, keyed by (player, title, achievement), with a conditional insert; points, feeds and rarity are projections of it.
2. Progress reported as a total can be merged with max, which is idempotent and order-independent across devices.
3. Rarity is a count per achievement divided by players per title; counting each unlock once with a hot counter per popular achievement needs sharding or periodic recomputation.

**Follow-ups.**
1. A console reconnects after {{offline_days}} days with 180 queued events, some for achievements the player already unlocked on PC since. Walk through what is accepted, what is ignored, and which unlock date is kept.
2. On a big game's launch day, one achievement is unlocked by 3 million players in an hour. What happens to your rarity counter and the friends feed?
3. How do you keep total points correct when an unlock is revoked as fraudulent?
4. A modified PC client sends unlock events for every achievement of a game in one second. How is it detected, and what do other players' rarity figures show meanwhile?
5. How would you rebuild every player's state for one game if a bug accepted bad events for a week?

**Follow-up rules.**
- when: counter, increment, increments → ask: A device retries the same unlock three times after timeouts. Does your counter count it three times? What is the idempotency key?
- when: device timestamp, client timestamp, timestamp → ask: The player's console clock is set two years in the past. Which unlock date do you show, and how do you decide it is implausible?
- when: exactly once, exactly-once → ask: Exactly once between which two points? The device queues events offline for {{offline_days}} days and may send some twice after a crash.
- when: leaderboard, ranking, rank → ask: Ranking was not asked for. What would it add to your storage and write path, and is it worth it here?
- when: shard, partition, partitioned → ask: You partition by player. Where does the per-achievement rarity count live, and what happens to it on launch day?

**Production Reality Check.**
- On a big game's launch day, "finish the tutorial" is unlocked by millions of players within an hour; the single counter row for its rarity becomes the slowest write in the system and unlock confirmations back up for every game.
- A console reconnects after {{offline_days}} days offline and sends 200 queued events; 40 of them are for achievements already unlocked on PC, and a bug in the total-points projection adds their points again.
- A modified PC client publishes unlocks for every achievement of a new game within one second for thousands of accounts; the rarest achievement shows as unlocked by 12% of players by morning.
- A game update ships with a progress bug that reports zero for "win 100 matches" after a reinstall; players' progress bars reset.

**Evaluation Criteria.** An event contract with stable ids and signed events; an unlock ledger keyed by (player, title, achievement) with conditional inserts as the single source of truth; progress merged monotonically; earned time chosen with plausibility checks; projections (points, feed, rarity) derived idempotently from the ledger and rebuildable; a hot-key strategy for rarity; tamper detection with revocation that propagates to every projection; offline sync bounded by device sequence numbers; adapts to each incident with diagnosis, recovery and prevention.

## MSF-L4-05: OS reliability analytics — crash rates, bucketing and preview-build regressions

| | |
|---|---|
| **Template ID** | MSF-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Telemetry analytics / rate denominators, crash bucketing, regression detection |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "preview_devices": {"2": ["1 million", "3 million"], "3": ["8 million", "15 million"]},
  "reports": {"2": ["20 million", "60 million"], "3": ["200 million", "500 million"]},
  "builds_per_week": [1, 2, 3],
  "upload_rate": ["1 in 5", "1 in 20", "1 in 100"]
}
```

**Business Scenario.** A desktop operating system publishes preview builds to about {{preview_devices}} enrolled devices, {{builds_per_week}} times a week, before the changes reach general release. Opted-in devices send crash and hang reports: the process or kernel component that failed, the faulting module and its version, an exception code and a stack of addresses, plus the device's build, model and driver set. About {{reports}} reports arrive per day across preview and released builds. To save bandwidth, after a device sends the first report for a given failure on a day, it uploads further reports for it at {{upload_rate}}. Devices also send a daily usage heartbeat saying which build they ran and for how long. Engineering teams want crash rates per build, per component and per device model, crashes grouped into buckets so that one bug is one bucket, and an alert when a new preview build is less reliable than the one before it.

**Problem Statement.** Design the reliability analytics platform: ingestion of reports and heartbeats; symbolisation of stacks; bucketing; the crash-rate metrics (define numerator and denominator precisely); comparing a new build with the previous one; routing a regression to its owning team; and what is kept, for how long. Say how the metric for a build published this morning becomes trustworthy, and when.

**Constraints.** A regression on a new preview build should be detected within 24 hours of release where enough devices run it. Bucket identities must stay stable across builds, so a bug's history follows it. Reports are pseudonymous (a device id, no user identity) and raw stacks are kept for 30 days; aggregates may be kept longer. Devices that update first are not a random sample of the population.

**Assumptions.** All device counts, report volumes, rates and retention periods are hypothetical. Symbol files for each build are published to a symbol store by the build system. Reports and heartbeats can arrive days late from devices that were offline.

**Clarifications.**
- Q: Is the metric crashes per device-day or crashing devices per device-day? | A: Both are used; define each and say which one drives regression alerts, and why.
- Q: How are throttled reports counted? | A: The first report of a failure per device per day is always sent; later ones are sampled at {{upload_rate}}. Say how you estimate totals.
- Q: Who owns a bucket? | A: The team that owns the faulting module, from a module ownership list that is mostly but not entirely up to date.
- Q: Should the new build be compared with the previous preview build or with the released build? | A: Both are useful; say which question each answers.
- Q: Can you see which devices installed which drivers? | A: Yes, from the inventory each device sends with its heartbeat.

**Hints.**
1. The denominator is exposure: device-days (or usage hours) on that build, from heartbeats. A rate with crashes from reports and devices from installs counts the wrong thing.
2. A bucket key built from module names and function names (after symbolisation) survives a rebuild; one built from raw addresses or offsets does not.
3. Compare like with like: the same devices on the old and new build, or the new build's population re-weighted to the old one's mix of models and drivers.

**Follow-ups.**
1. Define the crash rate you alert on: numerator, denominator, grain, and how throttled reports and late heartbeats enter it.
2. What is your bucketing key, and what happens to it when a module is recompiled and every offset changes?
3. A build released this morning has 40,000 device-days by evening. How do you decide whether its crash rate is worse than the previous build's, and with what confidence?
4. The new build's early devices are mostly newer hardware. How does that bias the comparison, and how do you correct it?
5. A crash appears only with one driver version on one device model. How does the platform surface that combination without testing every pair?

**Follow-up rules.**
- when: crashes per device, crash count, total crashes → ask: One device in a crash loop sends 2,000 reports in a day. What does that do to your metric, and is that what engineers need to know?
- when: stack hash, hash of the stack, hash → ask: A module is recompiled and every address in it moves. Does your hash put the same bug in a new bucket?
- when: threshold, percent, percentage → ask: The new build has 900 device-days so far and 3 crashes in a component that had 1 the day before. Is that a regression? How does your rule decide?
- when: real-time, streaming, stream → ask: Heartbeats for today's device-days arrive over the next three days. What does your real-time rate show at 09:00 for a build released at 06:00?
- when: sample, sampling, sampled → ask: Reports after the first are uploaded at {{upload_rate}}. How do you estimate the total, and which metric does the sampling not affect?

**Production Reality Check.**
- The symbol store is unavailable for a day after a build is published; that day's reports cannot be symbolised, land in hundreds of new "unknown" buckets, and the build's existing buckets look healthier than they are.
- A preview build recompiles a common module; the bucketing key includes the faulting offset, so every crash in that module opens a new bucket, and the regression detector reports 300 "new" crashes in one morning.
- A new build's crash rate looks 40% worse than the previous build's in its first day; most of its first devices are a new hardware model whose graphics driver crashes on every build.
- Reports reach the platform hours before the same day's heartbeats do, so the crash rate for each new build starts very high every morning and falls through the day; owners have learned to ignore morning alerts.

**Evaluation Criteria.** Precise rate definitions with exposure denominators (device-days or usage hours) and crashing-devices as the robust primary metric; throttled reports estimated correctly; symbolisation as a retried stage with reprocessing; bucket keys from symbolised frames that survive rebuilds, with merge and split operations; regression detection that compares like with like, requires minimum exposure and reports uncertainty; late-arriving heartbeats handled by completeness watermarks; cohort analysis that finds model and driver interactions; ownership routing with a fallback; retention by tier; adapts to each incident with diagnosis, recovery and prevention.
