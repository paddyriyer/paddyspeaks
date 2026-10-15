# TikTok · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a short-video
service: uploads and the in-app editor, sounds, duets and stitches, captions,
comments, LIVE with virtual gifts, creator programmes, screen-time and well-being
settings, safety and moderation, and transparency reporting. Every workload,
number, rule and schema is hypothetical, and nothing here describes how any
company's systems are actually built. Gift, reward, programme and default-setting
rules are this exercise's rules (check current docs). Wherever videos need
ordering, the order comes from a scoring function you are given; you are never
asked to design one. Moderation appears only as a process (queues, decisions,
appeals, aggregates), never with examples of content. Viewers appear only in
aggregates, except a person's own data shown to them; nothing here infers a
protected or sensitive trait from videos, sounds, comments or behaviour.

## TTK-L4-01: Comment moderation queues at scale — reports, priorities by language, SLAs, appeals and reviewer well-being

| | |
|---|---|
| **Template ID** | TTK-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Workflow systems / report deduplication, priority queues by language, SLAs, appeals, exposure limits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "comments_per_day": {"2": ["300 million", "800 million"], "3": ["2 billion", "5 billion"]},
  "reports_per_day": {"2": ["1 million", "3 million"], "3": ["12 million", "30 million"]},
  "languages": [20, 45, 70],
  "sla_hours": [4, 12, 24],
  "exposure_cap": [150, 250, 400]
}
```

**Business Scenario.** People post {{comments_per_day}} comments a day on videos and LIVE sessions, in {{languages}} languages. Anyone can report a comment, and reports arrive at {{reports_per_day}} a day; one comment can be reported by many people within minutes. A separate system gives each comment a priority score (a score you are given, with a version); you do not design it. Trained reviewers, each qualified in one or more languages, decide whether a reported comment stays up, is removed, or is limited, under a versioned set of community guidelines. The person who posted it, and the creator whose video it was posted on, can appeal a decision. In this exercise's rules, every report is decided within {{sla_hours}} hours, an appeal is decided by a different reviewer, and no reviewer handles more than {{exposure_cap}} cases a shift that the score marks as high severity.

**Problem Statement.** Design the moderation workflow system: intake of reports and scores; how many reports about one comment become one case; queues by language and priority, and how cases are routed to qualified reviewers; the SLA clock and what happens as it nears; decisions as records that every surface (the video page, LIVE, notifications, search) applies; appeals; and the reviewer experience, including how the exposure cap and breaks are enforced by the system rather than left to each reviewer. Describe the process only; you never need an example of content.

**Constraints.** A removed comment disappears from every surface within one minute of the decision. Each case is decided by someone qualified in its language. Every decision records who decided, under which guidelines version and which score version, and can be audited years later. Reporters are never shown to the reported person. Reviewer well-being is a requirement, not a preference: exposure caps, breaks and the option to step away from a case are enforced by the tooling.

**Assumptions.** All volumes, SLAs, caps and staffing figures are hypothetical, and the guidelines, appeal and SLA rules are this exercise's rules (check current docs). Reviewers work in shifts across several time zones. The score arrives within seconds of a comment or a report, and is sometimes missing.

**Clarifications.**
- Q: Does every report need a human decision? | A: In this exercise, yes, every case gets a human decision; the score sets only priority and the queue. Say what you would change if some cases could be decided automatically, and what that would need.
- Q: What if a comment's language cannot be determined? | A: It goes to a queue for undetermined language with reviewers who can triage and re-route it. Say how that queue avoids becoming a dumping ground.
- Q: Can a comment be reported again after a decision to keep it? | A: Yes. Decide when new reports reopen a case and when they are attached to the closed case.
- Q: Is the SLA from the first report or the latest? | A: From the first report that created the case.
- Q: Can reviewers see who reported? | A: They see how many reports a case has and their timing, not who made them.

**Hints.**
1. Separate reports (many, noisy, deduplicated) from cases (one per comment and open period) from decisions (append-only, versioned). Every surface consumes decisions, never reports.
2. A priority queue per language is simple until one language floods. Think about how priority, SLA age and reviewer capacity combine into the order cases are offered.
3. The exposure cap is a property of the assignment step: the system decides what a reviewer is offered next, so it can count, pause and rotate.

**Follow-ups.**
1. Walk one comment from its first report to a removal that every surface honours. Which records change, and where can a decision be lost?
2. How do you order work within a language queue when high-priority cases are fresh but low-priority cases are near their {{sla_hours}}-hour deadline?
3. One language's reports jump tenfold for a day while its reviewers are asleep. What does the system do automatically, and what needs a person?
4. How do you measure decision quality and consistency across {{languages}} languages without turning it into a ranking of individual reviewers?
5. The guidelines change on a date. What happens to open cases, to appeals of decisions made under the old version, and to the audit trail?

**Follow-up rules.**
- when: kafka, sqs, message queue, pubsub, pub/sub → ask: Thirty people report the same comment within two minutes. How many cases does your queue hold, and how do you keep it at one?
- when: fifo, first in first out, oldest first → ask: High-priority cases arrive all day. Under your ordering, how long does a low-priority case wait, and does it ever breach the SLA?
- when: auto-remove, automatic removal, auto-action, remove automatically → ask: The score's new version is wrong for one language for six hours. What has your automation done by the time anyone notices, and how do you undo it?
- when: dashboard, leaderboard, productivity, handle time → ask: Which of those measures could push reviewers to work past the exposure cap or skip breaks, and how does your design prevent that?
- when: delete, hard delete, purge → ask: An appeal arrives a month later. What does the second reviewer look at, and who else can see it?

**Production Reality Check.**
- A creator with a very large following is LIVE, and reports in one of the {{languages}} languages rise forty times in an hour. That language's queue passes {{sla_hours}} hours while queues for other languages are nearly empty.
- The score you are given moves to a new version overnight. The share of cases marked high severity doubles, reviewers reach the {{exposure_cap}}-case cap two hours into their shift, and high-severity cases stop being assigned.
- A decision service deploy writes removals to the case store but not to the stream the surfaces read. For three hours, removed comments still show on videos and in LIVE.
- An audit finds 4% of appeals were decided by the reviewer who made the original decision, after a routing change that grouped work by language and time zone.

**Evaluation Criteria.** Reports, cases and decisions as separate records with deduplication into one case per comment and open period; per-language queues with an ordering that combines priority and SLA age, overflow to qualified reviewers in other regions, and explicit handling of undetermined languages; decisions as an append-only, versioned log that every surface consumes with a freshness check; appeals routed away from the original reviewer by construction; exposure caps, breaks and stepping away enforced by the assignment step, with well-being measures that never rank individuals; score and guidelines versions recorded on every decision; adapts to each incident with diagnosis, recovery and prevention.

## TTK-L4-02: LIVE gifting at scale — coins, gifts, on-screen totals, creator rewards and reversals

| | |
|---|---|
| **Template ID** | TTK-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Virtual currency / balances, hot keys, approximate live totals over an exact ledger, reversals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "concurrent_lives": {"2": ["200,000", "500,000"], "3": ["2 million", "4 million"]},
  "peak_gifts": {"2": ["20,000", "60,000"], "3": ["300,000", "800,000"]},
  "top_live_share": ["5%", "10%", "20%"],
  "reversal_days": [30, 60, 90],
  "hold_days": [7, 14, 30]
}
```

**Business Scenario.** Viewers buy coins with money through the app's purchase channels and spend them on virtual gifts during a creator's LIVE session. At peak there are {{concurrent_lives}} LIVE sessions at once and {{peak_gifts}} gifts sent per second across all of them; during a big event one session receives {{top_live_share}} of all gifts. Each gift shows on screen, and the session shows a running gift total. In this exercise's rules, gifts a creator receives are converted into creator rewards at a stated rate, rewards stay pending for {{hold_days}} days, and a coin purchase that is refunded or charged back within {{reversal_days}} days reverses the rewards from gifts paid with those coins.

**Problem Statement.** Design the gifting system: coin purchases and coin balances; sending a gift during a LIVE; the on-screen gift animation and running totals; the creator's rewards, from pending to available; reversals after a purchase is refunded or charged back; and the creator-facing statement of gifts and rewards per session and per day. Say what must be exact, what may be approximate, and how one very busy session is handled.

**Constraints.** A viewer can never spend more coins than they hold, even with several devices sending at once. A gift appears on screen within one second of sending. A creator's statement must match the gifts recorded, gift by gift, after every reversal. Coins and rewards are whole units; any conversion to money is in integer minor units and rounds once, by this exercise's rule. Viewers appear to a creator only as the gifts they chose to send in that creator's session; nothing else about a viewer is shown or inferred.

**Assumptions.** All volumes, rates, hold and reversal windows are hypothetical; the conversion and programme rules are this exercise's rules (check current docs). Purchase confirmations, refunds and chargebacks arrive from the purchase channels as events, sometimes days late and occasionally twice.

**Clarifications.**
- Q: Can a viewer send gifts from two devices at once? | A: Yes, and both may be offline briefly. Neither may overspend.
- Q: Which coins does a reversal take back if a viewer bought coins several times? | A: Your choice, stated as a rule (for example, coins spent first-in-first-out against purchases). Be ready to explain a statement under it.
- Q: What if the reversed coins were already spent and the creator's rewards already paid out? | A: This exercise's rule: rewards still pending are reversed; rewards already paid become a negative adjustment on the creator's next statement. Say what the creator sees.
- Q: Must the running total on screen be exact? | A: It must never go down except for a stated reason and must agree with the statement within a minute after the session ends.

**Hints.**
1. Find the consistency boundary. The coin balance is per viewer and contended only by that viewer's devices; the creator's totals are contended by everyone in the session but can lag.
2. Make the ledger append-only: purchases, gifts, conversions, holds, releases, reversals, each with an id that makes a retry harmless.
3. On-screen totals and statements are projections of the ledger. One is fast and approximate, the other exact and slower.

**Follow-ups.**
1. Walk one gift from the tap to the creator's statement. Which records are written synchronously, and which later?
2. The busiest session receives {{top_live_share}} of {{peak_gifts}} gifts per second. Where does that load land in your design, and what stops it hurting every other session?
3. A purchase is charged back on day {{reversal_days}}, after the coins funded gifts in four creators' sessions. Show the ledger entries and what each creator's statement shows.
4. How do you prove at month end that coins sold, coins spent, rewards created, reversed and paid all reconcile?
5. A region's purchase channel goes down for an hour during a big event. Do viewers keep gifting with coins they already hold, and what can go wrong when it returns?

**Follow-up rules.**
- when: counter, increment, redis, in-memory → ask: The node holding the busiest session's running total restarts. What does the screen show next, and how do you rebuild it?
- when: transaction, two-phase commit, 2pc, distributed transaction → ask: Which two records are in your transaction, and does the creator's side really need to be in it at {{peak_gifts}} gifts per second?
- when: retry, retries, idempotent, idempotency → ask: A gift request times out on a phone and is sent again. What key makes the second one harmless, and who generates it?
- when: float, double, decimal → ask: Where is the only place a fraction of a minor unit can appear in your design, and how is it rounded?
- when: negative balance, clawback, claw back → ask: A creator's next statement is negative after reversals. What does the creator see, and how do you explain each line?

**Production Reality Check.**
- During a big event the busiest session receives {{top_live_share}} of all gifts. The partition holding its running total falls behind by four minutes, and the on-screen total freezes while gifts keep animating.
- A purchase channel resends a day of refund events. Without deduplication, pending rewards (held for {{hold_days}} days) of thousands of creators are reversed twice.
- A deploy lets two devices of one viewer both pass the balance check within the same 50 ms; some viewers end the hour with negative coin balances.
- Chargebacks for one purchase channel arrive {{reversal_days}} days late in a single batch, and rewards already paid out must be adjusted on creators' next statements.

**Evaluation Criteria.** Identifies the per-viewer coin balance as the exact, contended-only-by-one-person boundary and the creator's totals as aggregated, lagging projections; an append-only ledger with idempotency keys from the client for gifts and from the channel for purchase events; conditional balance debits that cannot overspend across devices; a hot-session strategy (sharded or pre-aggregated totals, batched fan-out of on-screen events) isolated from other sessions; holds, reversals with a stated coin-matching rule, and negative adjustments shown clearly to creators; whole units and integer minor units with one rounding step; month-end reconciliation across purchases, spends, rewards and reversals; adapts to each incident with diagnosis, recovery and prevention.

## TTK-L4-03: Screen-time and well-being settings honoured on every device

| | |
|---|---|
| **Template ID** | TTK-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Settings and usage sync / versioned settings with precedence, cross-device usage totals, offline enforcement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "accounts": {"2": ["50 million", "150 million"], "3": ["800 million", "1.5 billion"]},
  "devices": [2, 3, 5],
  "default_minutes": [40, 60, 90],
  "sync_seconds": [30, 60, 120],
  "offline_hours": [2, 6, 12]
}
```

**Business Scenario.** {{accounts}} accounts use the app on phones, tablets, web browsers and TV apps, with up to {{devices}} devices signed in to one account. Screen-time and well-being settings include a daily screen-time limit, reminders to take a break, a reminder at a chosen time each evening, and a time window when notifications are muted. In this exercise's rules, accounts whose declared age is under 18 start with a daily limit of {{default_minutes}} minutes and stricter defaults, set by declared age band; the account holder may change some of them, and a parent-linked account (described generally) may set and lock others. When the limit is reached, the app asks for a passcode to keep watching. Devices report usage time every {{sync_seconds}} seconds when online and can be offline for up to {{offline_hours}} hours.

**Problem Statement.** Design the system that stores these settings, applies the defaults for an account's declared age band, resolves who may change what, syncs settings to every device, adds up usage time across devices into a daily total, and enforces the limit and reminders on every device, online or offline. Cover the settings model and its versions, the precedence rules, the usage-time pipeline, the day boundary, enforcement on the device, and the audit of who changed what. Say what a parent-linked account can and cannot see.

**Constraints.** A locked setting changed by a parent-linked account reaches every online device within one minute, and an offline device applies it on reconnection before anything else. The daily total counts each second of use once, even when two devices play at the same time. Usage data is kept only as daily totals per account after this exercise's retention period, and never includes which videos were watched. A parent-linked account sees settings and daily totals, not viewing history, messages or comments.

**Assumptions.** All volumes, defaults, age bands and timings are hypothetical, and the defaults and parent-linking rules are this exercise's rules (check current docs). The declared age is the age on the account; how it was collected or verified is out of scope. An account has one home time zone, which the account holder can change.

**Clarifications.**
- Q: Is "a day" the device's local day or the account's? | A: The account's home time zone, in this exercise. Say what a traveller sees and what happens on the day the home time zone changes.
- Q: If two devices play at once, does that count as double time? | A: No. Screen time is the union of the intervals when any device was in use.
- Q: What happens when a declared age band changes, for example on a birthday? | A: The defaults for the new band apply from that local date; settings the account holder or a parent-linked account chose explicitly are kept unless this exercise's rules for the new band forbid them. Say how you schedule it.
- Q: Can the account holder turn off a setting a parent-linked account locked? | A: No. They can see that it is locked and by whom.
- Q: Does enforcement happen on the server or the device? | A: Both are possible; the device must enforce while offline.

**Hints.**
1. Store each setting as a value with a source (default, account holder, parent-linked account), a lock flag and a version; the effective value comes from a precedence rule, not from whichever write arrived last.
2. Usage time is a set of intervals per device. A daily total is the length of their union in the account's day, which tolerates late and overlapping reports.
3. Offline, a device knows the server's last total plus its own unsent intervals. Decide whether it errs towards stopping early or late, and say why.

**Follow-ups.**
1. Walk a parent-linked account lowering a locked daily limit while the teen is watching on a TV that is offline. What does each device do, and when?
2. How do you compute the daily total from {{devices}} devices whose reports arrive late, overlap and repeat?
3. A device has been offline for {{offline_hours}} hours. What limit does it enforce, and what happens when its usage arrives and the account is already over?
4. A declared age band changes at local midnight for a few million accounts on the same day. How do you apply new defaults without a thundering herd?
5. How would you show, a year later, exactly which settings were in effect on a given day and who set them?

**Follow-up rules.**
- when: last write wins, last-writer-wins, timestamp → ask: A parent-linked account locks a limit, then a teen's offline tablet syncs an older change to the same setting. Which value wins under your rule, and is that right?
- when: counter, sum of minutes, add up → ask: A phone and a TV both play for the same twenty minutes. How many minutes does your total show?
- when: push, push notification, websocket → ask: The device is offline when the locked setting changes. What does it do when it comes back, before anything else?
- when: utc, midnight utc, server time → ask: An account's home time zone is eight hours from UTC. When does its day reset under your design, and what does the account holder see?
- when: analytics, telemetry, logging, event stream → ask: Which usage fields leave the device, how long are they kept, and who can read them?

**Production Reality Check.**
- A settings-sync release makes devices apply the newest write by device clock. A teen's tablet with a clock set ahead overrides a parent-linked lock on {{devices}} devices for two days.
- A usage-ingest backlog delays reports by three hours. Devices that rely on the server total let accounts run well past their {{default_minutes}}-minute limit, and the evening reminder fires late.
- The daily total is computed as a sum of per-device minutes instead of a union. Accounts that cast to a TV while the phone stays open reach their limit in half the time, and support contacts spike.
- Daylight-saving time ends in one region; accounts there get a 25-hour day, and the limit resets an hour early for some devices and an hour late for others because devices and server disagree on the day boundary.

**Evaluation Criteria.** Settings as versioned values with source, lock and precedence rules, not last write wins by device clock; defaults derived from declared age band with scheduled band transitions that keep explicit choices; a settings sync that applies locked changes first on reconnection; usage as intervals per device, deduplicated and unioned per account day in the home time zone; device-side enforcement with a stated offline policy; minimal usage data with retention limits and no viewing history; parent-linked visibility limited to settings and totals; an audit log of every change; adapts to each incident with diagnosis, recovery and prevention.

## TTK-L4-04: Creator rewards programme — eligibility, qualified views, daily estimates, restatements and statements

| | |
|---|---|
| **Template ID** | TTK-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Earnings pipelines / eligibility as of a date, qualified-view counting, provisional vs final, restatements |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "creators": {"2": ["200,000", "600,000"], "3": ["3 million", "8 million"]},
  "daily_views": {"2": ["2 billion", "5 billion"], "3": ["30 billion", "60 billion"]},
  "min_followers": ["10,000", "50,000"],
  "min_seconds": [5, 10, 30],
  "review_days": [14, 30, 45]
}
```

**Business Scenario.** A creator rewards programme pays eligible creators for qualified views of their videos. In this exercise's rules, a creator is eligible on a date if their declared age is 18 or over, they have at least {{min_followers}} followers, their account is in good standing, and they live in a region where the programme is offered; a view is qualified if it lasts at least {{min_seconds}} seconds, on a video at least one minute long, posted while the creator was eligible, and is not later found to be invalid activity. Invalid activity is identified by a separate process (a list of view ids and a reason, delivered up to {{review_days}} days after the views). Rewards are a rate per 1,000 qualified views that varies by region and is restated monthly. {{creators}} creators are enrolled, and their videos receive {{daily_views}} views a day.

**Problem Statement.** Design the rewards system: eligibility as of each date; counting qualified views from view events; the daily estimate a creator sees the next morning; the monthly statement that becomes final after the {{review_days}}-day review; restatements when invalid activity, a late eligibility change or a rate correction arrives; and the creator-facing statements and their explanations. Say what a creator can see about their viewers (aggregates only) and what is never shown.

**Constraints.** The daily estimate is available by 09:00 in the creator's time zone. A final statement never changes; a later correction is a dated adjustment on a later statement, with its reason. Every amount on a statement can be traced to counts by video, day and region. Amounts are integer minor units, rounded once per statement line by this exercise's rule. A creator sees counts of qualified views and rewards for their own videos; nothing identifies an individual viewer or infers anything about viewers' traits.

**Assumptions.** All volumes, thresholds, windows and rates are hypothetical, and the eligibility, qualification and payment rules are this exercise's rules (check current docs). View events arrive within hours, occasionally days late from offline devices. The invalid-activity process is a given; you do not design it and do not need to know how it works.

**Clarifications.**
- Q: If a creator drops below {{min_followers}} followers mid-month, do earlier views still count? | A: Yes. Eligibility is evaluated per date; views on dates when the creator was eligible count.
- Q: Does a video posted before the creator became eligible ever earn? | A: Not in this exercise's rules. Say how you store that.
- Q: Is the daily estimate a promise? | A: No. It is labelled an estimate; the final number may be lower after review. Say how you show the difference.
- Q: Which region's rate applies: the creator's or the viewer's? | A: The viewer's region in this exercise, aggregated so no individual viewer is identifiable.
- Q: What if invalid activity is found after the statement is final? | A: A negative adjustment on the next statement, with the reason and the affected month.

**Hints.**
1. Treat eligibility as intervals per creator and a video's eligibility as fixed at posting; joining views to those intervals is an as-of question.
2. Keep counts at the grain of (video, view date, viewer region) with provisional and invalid counts separate. Estimates, statements and adjustments are all derived from that table.
3. A final statement is a snapshot. Corrections land in the next open period, never in the closed one.

**Follow-ups.**
1. Walk one view from the event to a line on a final statement. Which tables change, and when does the line stop changing?
2. How do you produce estimates for {{creators}} creators by 09:00 in every time zone without recomputing all of history daily?
3. Invalid activity for 3% of one day's views arrives on day {{review_days}}, after the month closed. Show what each affected creator sees, and how you keep totals consistent.
4. The region rate for last month was wrong by 2% for one region. How do you restate, and how do you explain it to creators?
5. A creator disputes a statement. What evidence can you show them, and what can you never show?

**Follow-up rules.**
- when: recompute, recalculate, full refresh, rebuild → ask: You recompute last month after the statement is final. What happens to the number the creator was already paid against?
- when: scd, type 2, history table, valid_from → ask: A creator's account standing changes, then is reversed on appeal a week later, backdated. How do your eligibility intervals record that?
- when: view_id, dedupe, deduplicate, distinct → ask: An offline device uploads the same views twice, three days late. Which day do they count on, and how many times?
- when: estimate, provisional, preliminary → ask: Estimates are 20% higher than finals for one region every month. What do you change, and what do you tell creators?
- when: viewer, audience, demographics → ask: What exactly does a creator see about the people who watched, and what stops it identifying anyone?

**Production Reality Check.**
- The invalid-activity list for one week arrives {{review_days}} days late, after statements were finalised. About 4% of qualified views in one region are removed, and thousands of creators get negative adjustments on their next statement.
- A change to the view pipeline counts views shorter than {{min_seconds}} seconds for two days. Daily estimates jump 30% and then drop back, and creators open support tickets about the drop.
- The eligibility job runs before a backdated standing reversal is recorded. A few thousand creators show no earnings for a week of dates they were eligible on.
- Estimates for creators in a time zone far east of UTC are ready at 14:00 local time, because the daily job waits for the UTC day to close.

**Evaluation Criteria.** Eligibility as dated intervals with backdated corrections, and video eligibility fixed at posting; deduplicated view events counted at the grain of video, date and viewer region with provisional and invalid counts separated; estimates computed incrementally per creator time zone and labelled as estimates; final statements as immutable snapshots with later corrections as dated adjustments with reasons; integer minor units with one rounding step per line; full traceability from amount to counts; viewer data shown only as aggregates with nothing inferred; adapts to each incident with diagnosis, recovery and prevention.

## TTK-L4-05: Transparency reporting — moderation actions by policy area and region, restated after appeals, small cells suppressed

| | |
|---|---|
| **Template ID** | TTK-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Published statistics / counts from a decision ledger, versioned taxonomies, restatement, small-cell suppression |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "decisions_per_quarter": {"2": ["80 million", "200 million"], "3": ["1 billion", "3 billion"]},
  "regions": [30, 80, 150],
  "policy_areas": [8, 12, 20],
  "min_cell": [10, 20, 50],
  "appeal_days": [30, 90, 180]
}
```

**Business Scenario.** Every quarter the service publishes a transparency report: counts of moderation actions on videos, comments and accounts, by policy area, region and quarter, with how many were appealed and how many were restored after appeal, as tables and downloadable data files. Moderation decisions are recorded as they are made, about {{decisions_per_quarter}} a quarter, across {{regions}} regions and {{policy_areas}} policy areas. The policy areas are revised from time to time. In this exercise's rules, an appeal can be filed within {{appeal_days}} days of a decision, and any published cell with fewer than {{min_cell}} actions is suppressed.

**Problem Statement.** Design the reporting system: the decision ledger it reads from; exact definitions of each published count; how a quarter's numbers are frozen and published; how later appeals and corrections restate earlier quarters; how policy areas that change between quarters are compared; how small cells are suppressed so that no suppressed number can be worked out from the totals; and how the published files, the tables and internal dashboards are shown to agree.

**Constraints.** Every published number is reproducible from the ledger as of the report's cut-off date and is traceable to the decisions it counts. A published report never changes silently: restatements appear in the next report, marked, with the old and new values. Suppressed cells cannot be recovered by subtracting the published cells from a published total. Nothing published concerns an individual person, video or comment; the report contains only counts.

**Assumptions.** All volumes, regions, policy areas and thresholds are hypothetical, and the appeal window, suppression and publication rules are this exercise's rules (check current docs). A decision's region is the region of the account that posted the content, as recorded at decision time. Decisions can be reversed by appeal or by a later review, and both are events in the ledger.

**Clarifications.**
- Q: Is an action counted in the quarter it was taken or the quarter of the content? | A: The quarter of the decision, by its UTC timestamp, in this exercise.
- Q: If a decision is restored on appeal, is it still counted as an action? | A: It counts as an action in its quarter and as restored in the quarter the appeal was decided. Say how you present both.
- Q: Does a decision that is later moved to another policy area move between rows? | A: In this exercise it is restated in the next report, under its final policy area, with a note.
- Q: Are automated and human decisions shown separately? | A: Yes, as two columns; each decision records which it was.
- Q: Who checks the report before publication? | A: A review step with sign-off; your system should make the review easy and the numbers reproducible.

**Hints.**
1. Count from an append-only ledger with as-of semantics: the report for a quarter is a query over the ledger as of a cut-off timestamp, so it can always be rerun.
2. Map old policy areas to new ones with an explicit, versioned mapping; some old areas split, and a split cannot be reversed without the decision-level data.
3. Suppressing one cell in a row whose total is published reveals it by subtraction. Suppression has to consider rows, columns and totals together.

**Follow-ups.**
1. Define "actions restored after appeal" precisely. Which quarter does each restoration fall in, and why?
2. How do you freeze a quarter while appeals for it can still arrive for {{appeal_days}} days?
3. A policy area is split in two from next quarter. How do you present a year of trend for each half?
4. With {{regions}} regions and {{policy_areas}} policy areas, many cells fall below {{min_cell}}. How do you choose which extra cells to suppress so totals stay published and nothing can be recovered?
5. A regulator asks you to prove that a published number matches your decisions. What do you show them, and what do you not need to show?

**Follow-up rules.**
- when: dashboard, live query, materialized view, materialised view → ask: The quarter's published number and the dashboard differ by 0.3%. Which one is right, and how do you show it?
- when: suppress, suppression, below threshold, redact → ask: You suppress one region's cell for a policy area but publish the row total. How would a reader recover the suppressed value?
- when: noise, differential privacy, laplace → ask: The report must also agree exactly with its own totals. Which numbers get noise, and how do you keep totals consistent?
- when: overwrite, update in place, upsert → ask: Last quarter's file was downloaded thousands of times before you changed it. How does a reader learn what changed?
- when: mapping, crosswalk, taxonomy → ask: One old policy area became two new ones. How do you assign last year's decisions without guessing?

**Production Reality Check.**
- After publication, an audit finds that a pipeline change counted appeals restored by a later review twice for one quarter; the published restoration count for one region is 18% too high.
- A policy area is split in two mid-quarter. Decisions before the split are counted under the old area and later ones under the new areas, so the quarter's file shows all three side by side, and readers comparing with last quarter conclude that actions in the old area fell by half.
- A researcher shows that three suppressed cells for one region can be recovered from the published row and column totals, because suppression was applied per cell below {{min_cell}} without complementary cells.
- The decision ledger's region field was backfilled from current account regions instead of the region at decision time; about 2% of last year's actions move between regions when the report is rerun.

**Evaluation Criteria.** An append-only decision ledger with reversal events and as-of cut-offs so every report can be rerun; precise definitions of each count, including the quarter a restoration falls in; frozen quarterly snapshots with restatements published as marked old and new values in the next report; versioned policy-area mappings that handle splits from decision-level data; region recorded at decision time; complementary suppression across rows, columns and totals (or a stated alternative such as publishing ranges) with a check that suppressed cells cannot be recovered; one computation feeding files, tables and dashboards with reconciliation; only counts published; adapts to each incident with diagnosis, recovery and prevention.
