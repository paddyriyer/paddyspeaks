# Microsoft · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a public cloud
(Azure), workplace software (Microsoft 365 and Teams), an operating system
(Windows) and a games platform (Xbox). Every workload, number, schema, rule and
incident is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MSF-L3-01: Recurring meeting series — occurrences, exceptions, and attendance on the right instance

| | |
|---|---|
| **Template ID** | MSF-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / recurrence rules, occurrence identity, exceptions, series splits, time zones |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_occurrences": {"1": ["4 million"], "2": ["30 million", "60 million"], "3": ["150 million", "300 million"]},
  "series_share": ["55%", "70%", "80%"],
  "dst_regions": ["North America and Europe", "Europe and Australia", "North America, Europe and Chile"],
  "horizon_months": [6, 12, 24]
}
```

**Business Scenario.** A workplace suite schedules meetings in its calendar and runs them as online meetings. About {{daily_occurrences}} meeting occurrences happen a day, and about {{series_share}} of them belong to a recurring series: daily stand-ups, weekly one-to-ones, a monthly review on the second Tuesday. An organiser defines a series in their own time zone, and many attendees live in {{dst_regions}}, where clocks change on different dates. Single occurrences are moved, cancelled or given a different agenda and attendee list; an organiser can also edit "this and all following occurrences", and a series can have no end date. In this exercise every occurrence of a series shares one online join link. Each online occurrence produces join and leave events per participant, and some produce a recording and a transcript. People want attendance per occurrence, no-show rates for one-to-ones, the recording of "last Tuesday's review", and how many meeting hours a person had last week.

**Problem Statement.** Design the data model for series and their occurrences, and for what happens in them. Cover: the series and its recurrence rule (with the time zone it is defined in); the identity of one occurrence, stable when it is moved; exceptions (modified and cancelled occurrences); how a "this and following" edit splits a series without losing the history of the past occurrences; how and how far ahead occurrences are materialised for a series with no end ({{horizon_months}} months in this exercise); how join and leave events and recordings are attributed to an occurrence when every occurrence shares one join link; and the facts with their grains that answer the questions above.

**Constraints.** An occurrence keeps its identity when its time changes, so attendance, chat and recordings stay attached to it. A recurring meeting's wall-clock time stays fixed in the organiser's time zone across daylight-saving changes. The calendar's state on a past date must be reconstructable (what the series said last month, before an edit). Join and leave events arrive at least once and can be late by hours from clients that were offline.

**Assumptions.** Volumes, shares, regions and the horizon are hypothetical. Recurrence rules follow the familiar iCalendar ideas (a rule, a start, a time zone, exception dates, and a recurrence id for each instance, its original start); you can say "RRULE" and "RECURRENCE-ID" and be understood. The meeting service gives each participant session a session id. People outside the tenant (guests) can join.

**Clarifications.**
- Q: Is a moved occurrence a new meeting? | A: No. It is the same occurrence with a new start. Its identity is the series plus its original start, which never changes.
- Q: How do I know which occurrence a join belongs to if the link is shared? | A: In this exercise the join event carries only the meeting's join link and a timestamp. You decide the attribution rule and say what happens to someone who joins early, or stays past the end.
- Q: What does "this and following" do to the past? | A: The organiser expects past occurrences, their attendance and recordings to be unchanged, and future ones to follow the new rule.
- Q: Which time zone is a series in? | A: The organiser's, chosen when the series is created. Attendees see it in their own zones.
- Q: Does a cancelled occurrence count as a no-show? | A: No. A cancelled occurrence has no expected attendees.

**Hints.**
1. Keep three things apart: the rule (series), the exceptions to it (keyed by original start), and the materialised occurrences you report on.
2. An occurrence key of (series id, original start in the series' time zone) survives moves; a key built from the actual start does not.
3. Attribute a join to the occurrence whose scheduled window (with a grace period either side) contains the join time, using the occurrence's actual start after any move, and record when no occurrence matched.

**Follow-ups.**
1. Walk a weekly 09:00 series in an organiser's zone across a daylight-saving change in {{dst_regions}}. What is stored, and what does an attendee in another zone see the week the clocks change?
2. The organiser moves next week's occurrence from Tuesday to Wednesday, then edits "this and all following" to Thursdays starting the week after. Show the rows that exist afterwards.
3. Two occurrences of a daily series both fall inside your grace window for one join (one ran late, the next was moved earlier). Which one gets the join, and how is that visible?
4. A series has no end. How far do you materialise, how do you extend the horizon, and what does "meeting hours next quarter" mean beyond {{horizon_months}} months?
5. At {{daily_occurrences}} occurrences a day, which tables are keyed and partitioned how, and what does a late exception (a cancellation entered after the occurrence was materialised) cost to apply?

**Follow-up rules.**
- when: start_time, start time, actual start → ask: The organiser moves an occurrence by an hour after three people accepted it. If the occurrence key includes the start time, what happens to the acceptances and to the recording link?
- when: utc, fixed offset → ask: You stored occurrences in UTC. A series is 09:00 in the organiser's zone; the clocks change next month. Which rows change, and who changes them?
- when: materialise, expand, expansion → ask: An occurrence was materialised, then cancelled as an exception a week later. How does your expansion apply that, and what did yesterday's report say?
- when: overlap, time window, join time → ask: Someone joins 20 minutes early for a daily stand-up and stays through the next day's occurrence slot by mistake. How many occurrences did they attend?
- when: split, new series, this and following → ask: After the split, how does a report of "this one-to-one's attendance for the year" find both halves?

**Production Reality Check.**
- The week clocks changed in {{dst_regions}}, recurring occurrences in the affected zones (series are about {{series_share}} of all meetings) were an hour off in the warehouse because they had been expanded once with a fixed UTC offset; joins fell outside every occurrence window and the no-show rate for one-to-ones doubled.
- An organiser's "this and all following" edit on a two-year weekly series re-keyed every past occurrence; their attendance and recordings now point at occurrence ids that no longer exist, and the series shows twice in the yearly report.
- Cancellations entered after the nightly materialisation of the next {{horizon_months}} months were not applied until the next full rebuild; cancelled occurrences showed as 100% no-shows for a week.

**Evaluation Criteria.** Series, exceptions and materialised occurrences kept apart; a stable occurrence key (series and original start in the series' zone) that survives moves; wall-clock rules with the time zone stored, expanded per occurrence; "this and following" as a split that freezes the past and links both halves; a materialisation horizon with incremental extension and exceptions applied on arrival; an explicit join attribution rule with a grace window and an unmatched bucket; at-least-once events deduplicated by session id; facts at stated grains (occurrence, participant session); each incident contained, corrected and guarded.

## MSF-L3-02: Device fleet updates — builds, rings, offers, install states and rollbacks over time

| | |
|---|---|
| **Template ID** | MSF-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / device identity, ring assignment history, install state machines, as-of build |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "devices": {"1": ["3 million"], "2": ["40 million", "80 million"], "3": ["400 million", "900 million"]},
  "rings": ["pilot, broad and slow", "preview, fast, broad and critical", "test, early, standard and late"],
  "deferral_days": [3, 7, 14],
  "rollback_share": ["0.3%", "1%", "2%"]
}
```

**Business Scenario.** An operating system ships a quality update every month and a feature update less often. Organisations that manage their devices put each device in an update ring (here: {{rings}}), and each ring sets a deferral: a quality update is offered to a device in a ring only once the ring's deferral has passed (for example {{deferral_days}} days). About {{devices}} devices report to the update service. A device moves through states for each update: offered, downloading, downloaded, installing, pending restart, installed, or failed with an error code; an installed update can be removed again, by a person or by an automatic rollback when the device fails to start, which happens to about {{rollback_share}} of installs for some builds. Devices separately send an inventory heartbeat with their current OS build. Devices can be offline for weeks, are reimaged, renamed, moved between rings, and occasionally move to another organisation. Admins and release teams ask: what share of each ring is on the latest build N days after release, how long from offer to installed, the failure rate by build and error code, and which devices were on build X on a given date.

**Problem Statement.** Design the data model. Cover: device identity (what survives a reimage, a rename and a hardware repair, and what does not); the ring assignment history and the ring's own settings over time; the build catalogue (version, build and revision numbers, quality versus feature updates, which build supersedes which); offers; install attempts and their state events; how you derive a device's installed build at any past time when heartbeats and install events disagree; and the facts and grains that answer the four questions, including what "on the latest build" means for a device that has been offline since before the release.

**Constraints.** State events are delivered at least once, out of order, and stamped by device clocks that can be wrong by days; the service also stamps when it received each event. A device's build can go down (rollback). The ring a device was in, and the ring's deferral, must be known as of any past date. An admin sees only their organisation's devices.

**Assumptions.** Device counts, ring names, deferrals and rollback shares are hypothetical. Each device has a service-issued device id and a hardware id; a reimage issues a new device id in this exercise unless the device is re-registered with the same hardware id. Error codes are opaque strings.

**Clarifications.**
- Q: Which source is the truth for the current build, heartbeats or install events? | A: Neither alone. Heartbeats are periodic and say what is running; install events say what happened. You decide how to combine them and what wins when they disagree.
- Q: Can a device skip a monthly update? | A: Yes. Quality updates are cumulative, so a device that was offline installs only the latest one.
- Q: Does an offline device count in "share on the latest build"? | A: You decide, and say so. Admins want to see offline devices separately rather than as failures.
- Q: Can a ring's deferral change? | A: Yes. An admin can shorten it for an urgent fix or pause updates for the ring; past offers were made under the old setting.
- Q: What is a rollback in data terms? | A: An event that removes an installed update, after which the device runs the previous build.

**Hints.**
1. Separate desired state (ring, its settings, the offer), attempts (install attempt with its state events) and observed state (heartbeats). The device's build history is derived from attempts and observations.
2. A cumulative update makes "latest build" a comparison on the build order, not a match on one update id.
3. Keep device time and received time on every event; order by the device's own sequence number when there is one, and never trust the device clock alone for the order of events.

**Follow-ups.**
1. Write the state machine for one install attempt. Which transitions are legal, which event wins when two arrive out of order, and how do you store it?
2. A device installed the update, rolled back two days later, and was offered it again. Show its build history rows and how the "share on latest build" for that week counts it.
3. A device is reimaged and re-registers with the same hardware id. Which history is joined, and which is not?
4. An admin shortened the ring's deferral from {{deferral_days}} days to zero for one update. How does your model show which offers were early and why?
5. At {{devices}} devices with daily heartbeats, what is stored at full grain, for how long, and what is kept as daily snapshots or intervals?

**Follow-up rules.**
- when: current_build, current build, status column, overwrite → ask: A support ticket asks which build this device was on last Tuesday at 10:00, before a rollback. With a current-build column, can you answer?
- when: heartbeat → ask: The heartbeat says build 2 while an install-succeeded event for build 3 arrived an hour later with an earlier device timestamp. What is the device on, and when did it change?
- when: device clock, client timestamp, event time → ask: A device's clock was a week behind. Its events land in last week's partitions. What does that do to "time from offer to installed", and how do you detect it?
- when: hardware id, hardware_id, serial → ask: A refurbished device is sold to another organisation with the same hardware id. Whose history does it carry, and who may see it?
- when: scd, type 2, ring history → ask: What exactly is versioned: the device's ring, the ring's settings, or both? Which one decides whether an offer was on time?

**Production Reality Check.**
- A month after a feature update, {{rollback_share}} of devices had rolled back automatically, but the release dashboard still counted them on the new build because "install succeeded" events were never superseded by the later removal.
- An admin shortened a ring's deferral from {{deferral_days}} days to zero for an urgent fix. The ring settings table kept only the current value, so the compliance check flagged every earlier offer in that ring as late.
- After a mass reimage at a large organisation, its devices re-registered with new device ids; the fleet appeared to grow, ring coverage halved overnight, and every device's install history started again.

**Evaluation Criteria.** Device identity defined against reimage, rename and resale; ring membership and ring settings each versioned; a build catalogue with an order so cumulative updates and rollbacks compare correctly; install attempts as state machines with idempotent, order-tolerant events (device and received times kept); a derived build-interval history reconciling heartbeats and events; "on latest build" defined with offline devices shown apart; facts at stated grains with tenant-level access; each incident contained, corrected and guarded.

## MSF-L3-03: Cloud resource hierarchy — management groups, subscriptions, resource groups and tags over time

| | |
|---|---|
| **Template ID** | MSF-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / changing hierarchies, closure tables, as-of rollups, tag history |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "subscriptions": {"1": ["3,000"], "2": ["40,000", "90,000"], "3": ["400,000", "1 million"]},
  "resources": {"1": ["6 million"], "2": ["80 million"], "3": ["800 million", "2 billion"]},
  "mg_depth": [3, 4, 6],
  "tag_change_share": ["1%", "4%", "10%"]
}
```

**Business Scenario.** Customers of a public cloud organise what they run in a hierarchy: a tree of management groups (here up to {{mg_depth}} levels below the root), subscriptions that each sit in exactly one management group, resource groups inside a subscription, and resources inside a resource group. Policies and access assignments made at any level apply to everything below it. Tags (name and value pairs) can be set on subscriptions, resource groups and resources; in this exercise a resource does not inherit tags from its resource group or subscription unless the organisation's own rule copies them. A large customer platform team reports across {{subscriptions}} subscriptions and {{resources}} resources: monthly cost by department (a management group) and by `cost-center` tag, policy scope ("which resources did this assignment cover on the 3rd"), and missing-owner reports. Subscriptions move between management groups when departments reorganise; resources move between resource groups and subscriptions; tags on about {{tag_change_share}} of resources change on a given day.

**Problem Statement.** Design the data model for the hierarchy, its changes and its tags. Cover: how the management-group tree is stored and versioned (adjacency, path or closure table, with validity intervals); how subscriptions, resource groups and resources are placed in it over time; a stable identity for a resource whose id path changes when it moves (in this exercise a move changes the resource's id; check current docs); tag history and the "effective tag" rule you choose (own tag, else resource group's, else subscription's); and the rollups: cost by management group as the hierarchy was on the usage date versus as it is today, cost by effective tag, and the resources an assignment at a given scope covered on a date.

**Constraints.** Hierarchy changes are rare but questions about the past are frequent and must give the same answer every time they are asked. Cost already invoiced to departments is not silently re-allocated when the tree changes. Tag names are treated case-insensitively and values case-sensitively in this exercise (check current docs). A resource's cost history must follow it across moves.

**Assumptions.** Counts, depth and change rates are hypothetical. Cost arrives daily per resource id and meter, and can be restated for a few days. The platform team receives hierarchy and tag changes as activity events plus a daily full snapshot; events can be missed, and the snapshot is the tiebreaker.

**Clarifications.**
- Q: Should a department's cost follow today's hierarchy or the one on the usage date? | A: Both are requested. Finance wants usage-date allocation for invoices; leadership wants today's structure for trends. Say which is the default and how the other is produced.
- Q: Can a management group move under another one? | A: Yes, with all its children. Depth stays within {{mg_depth}} levels in this exercise.
- Q: When a resource moves, is it a new resource? | A: Its id changes in this exercise, but the platform team wants one continuous history.
- Q: Who sets the tags? | A: Owners, deployment pipelines and a remediation policy that writes missing tags. All three can set the same tag on the same day.
- Q: Are deleted resources kept? | A: Their history is: past cost and past scope still need them.

**Hints.**
1. A closure table (ancestor, descendant, depth) with valid-from and valid-to answers "everything under this group on date D" with one join; rebuilding it on each tree change is cheap because the tree is small.
2. Give each resource a surrogate key and a mapping from every id path it ever had to that key, with intervals.
3. Store tags as rows (scope, name, value, valid from, valid to) rather than columns; derive effective tags per resource per day with your precedence rule.

**Follow-ups.**
1. A management group with 300 subscriptions moves under a different parent on the 15th. Show the closure rows that change and what the month's cost by department looks like under each allocation rule.
2. A resource moves from one subscription to another and its id changes. How does its cost history appear in each department's report for that month?
3. Write the "effective `cost-center` tag on date D" rule as a query sketch. What happens to cost when the tag is added on the 20th: is the first half of the month untagged or re-labelled?
4. Tags change on {{tag_change_share}} of resources a day, mostly by automation rewriting the same value. How do you keep tag history small without losing real changes?
5. The activity events missed a subscription move that the daily snapshot shows. What do you write, with which validity, and how do downstream reports learn of the correction?

**Follow-up rules.**
- when: parent_id, adjacency list, recursive cte, recursive → ask: The report needs every resource under one top-level group, as of each day of the month. How many recursive walks is that, and what would you precompute instead?
- when: current hierarchy, latest hierarchy, join on today → ask: Finance invoiced a department last month. A subscription moves out today. What does your rebuilt report now say last month cost them?
- when: resource_id, resource id → ask: The resource moved and its id changed. Which key do the cost rows join to, and how do the two ids become one history?
- when: tag column, wide table, json column → ask: An owner adds a new tag name that ten teams then misspell in different cases. What happens to your table, and how do reports group them?
- when: snapshot, daily snapshot → ask: The snapshot and the events disagree about when a move happened. Which do you trust for the validity interval, and how is that recorded?

**Production Reality Check.**
- A subscription with heavy spend moved to another management group mid-month. The chargeback report, rebuilt nightly from the current tree, moved the whole month's spend to the new department after invoices had been sent.
- A tag remediation policy rewrote the `cost-center` tag on every resource it covered in one night; the tag history recorded each rewrite as a change, the tag table tripled, and "tag changes per day", normally about {{tag_change_share}}, spiked to 60%.
- Resources moved between subscriptions in a clean-up got new ids; the cost report showed each as deleted and a new resource created, and their month split across two departments.

**Evaluation Criteria.** A hierarchy with validity intervals (closure or path table) and as-of rollups; both allocation rules defined, with invoiced months closed and changes shown as restatements; stable surrogate resource keys across moves; tags as rows with history, a stated precedence rule and case handling; change compaction for no-op rewrites; snapshot-versus-event reconciliation with corrections recorded; policy scope answerable as of a date; each incident contained, corrected and guarded.

## MSF-L3-04: Game entitlements — what a player could play on a date, and why

| | |
|---|---|
| **Template ID** | MSF-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / entitlement intervals, rotating catalogues, sharing rights, precedence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "players": {"1": ["4 million"], "2": ["30 million", "60 million"], "3": ["150 million"]},
  "catalogue_titles": ["300", "450", "600"],
  "leave_notice_days": [7, 14],
  "family_size": [4, 6]
}
```

**Business Scenario.** A games platform serves about {{players}} players on consoles, PC and cloud streaming. A player can own a game (a purchase, a code redemption, a bundle) and its add-ons; they can also hold a subscription in one of several tiers, each giving access to a rotating catalogue of about {{catalogue_titles}} titles. Titles join the catalogue on a date and leave on a date announced {{leave_notice_days}} days ahead, and a title can be in one tier, on one platform or in one region and not another. Subscribers can buy a catalogue title at a member discount, and then keep it when it leaves. Subscriptions lapse when a payment fails and resume later; purchases can be refunded. In this exercise a player can share their purchased games with a family group of up to {{family_size}} members under the platform's sharing rule, and a subscription's catalogue is not shared. Support agents need to answer "could this player play this title on this date, and through which right?"; the content team wants hours played per title split by right (owned, subscription, shared), and publishers are paid partly on subscription play.

**Problem Statement.** Design the entitlement model. Cover: the product catalogue (titles, editions, add-ons that require a base game, platforms); licence grants and revocations from purchases, redemptions and refunds; subscriptions with their periods, tier changes, lapses and resumes; catalogue availability windows by tier, platform and region; sharing grants that derive from another player's licences; a derived "access interval" per player, title and right; the precedence rule when several rights apply at once; and how play sessions are attributed to one right for the content and publisher reports.

**Constraints.** "Could they play it on date D" must give the same answer later, even after the catalogue changes or a refund. A play session is attributed to exactly one right. A refund revokes the licence and everything derived from it from the refund time, not retroactively. Regions and platforms are part of every availability rule.

**Assumptions.** Player counts, catalogue size, notice period and family size are hypothetical, and so are the sharing and tier rules described here; they are this exercise's rules, not a statement of any current product policy. Play sessions arrive from clients with a session id and can be uploaded late from offline consoles.

**Clarifications.**
- Q: If a player owns a title and it is also in their subscription, which right does play count against? | A: You choose the precedence and state it; publishers care because subscription play may be paid differently from owned play.
- Q: Does an add-on bought for a catalogue title still work after the title leaves the catalogue? | A: The add-on licence remains, but in this exercise it needs a base-game right to be playable.
- Q: What happens when a subscription lapses for three days and resumes? | A: No catalogue access during the gap. Saved games are out of scope.
- Q: Is a member-discount purchase different from a normal purchase? | A: It is a normal perpetual licence once bought; record the discount and the subscription that made it possible.
- Q: Can a shared game be played if the owner's account is banned or the purchase refunded? | A: No. Sharing rights end when the owner's licence does.

**Hints.**
1. Model rights as intervals: (player, title, right type, source id, valid from, valid to, platform, region). Every question becomes an interval lookup.
2. Derive the intervals from immutable sources (orders, refunds, subscription periods, catalogue windows, sharing memberships) so they can be rebuilt; never edit an interval by hand.
3. A subscription right is the intersection of the player's subscription interval with the title's catalogue window for that tier, platform and region.

**Follow-ups.**
1. A player subscribes, plays a catalogue title, buys it at a member discount in its last {{leave_notice_days}} days, and the title then leaves. Show the access intervals and how each play session is attributed.
2. The owner of a family of {{family_size}} refunds a game a month after buying it. Which intervals close, from when, and what happens to the hours already played by the family?
3. A title leaves the catalogue at midnight. Midnight where? Show how regions and the session that started before midnight are handled.
4. A player upgrades to a higher tier mid-period, then downgrades. Which titles were available on each day, and what does the support agent see?
5. At {{players}} players, how large is the access-interval table, how is it partitioned and refreshed, and which questions do you answer from sources instead of intervals?

**Follow-up rules.**
- when: owns table, entitlements table, boolean → ask: A support agent asks whether the player could play the title last March. Your table says they own it now. Did they then, and through which right?
- when: delete, remove the row, catalogue table → ask: The title left the catalogue last month and its row was deleted. How do you now answer whether a subscriber could play it on the 10th of last month?
- when: refund, refunded → ask: The refund came after the family played for 40 hours. Are those hours re-attributed, and what does the publisher report for that month say?
- when: precedence, priority → ask: The player owns the base game through sharing and has the title in their subscription. Which right wins for attribution, and does the answer change if the sharing owner is refunded tomorrow?
- when: time zone, utc, region → ask: The catalogue window is defined per region. A session that started at 23:30 local continues past the leave time. Is it allowed, and how is it counted?

**Production Reality Check.**
- A nightly clean-up deleted catalogue rows for titles that had left; support could no longer say whether a subscriber could play a title last month, and the publisher report for a closed month changed on a rebuild.
- Play-time attribution counted sessions twice for players who bought a title at a member discount during its last {{leave_notice_days}} days in the catalogue: their sessions matched both the subscription right and the new licence.
- A refund revoked the buyer's licence, but sharing intervals derived from it stayed open; a family of {{family_size}} kept playing for weeks and that play was reported as owned.

**Evaluation Criteria.** Immutable sources (orders, refunds, subscription periods, catalogue windows, sharing memberships) with derived access intervals; subscription access as the intersection of membership and catalogue windows by tier, platform and region; add-on dependency on a base right; refunds and owner changes propagating to derived sharing rights from the right time; one stated precedence rule so each session gets exactly one right; time zones and region boundaries explicit; closed reporting periods restated, not rewritten; sizing and refresh strategy; each incident contained, corrected and guarded.

## MSF-L3-05: Policy compliance by day — carrying the latest evaluation forward

| | |
|---|---|
| **Template ID** | MSF-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of latest row, carry-forward across days, lifetimes, half-open days |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | MSF-L3-05.mjs |

**Business Scenario.** A cloud governance team assigns policies to the resources of a subscription (here {{policy_list}}) and wants a daily compliance trend per policy. The policy engine evaluates a resource when it is created or changed and on a periodic scan, and writes one row per evaluation to `policy_evaluations`; between evaluations nothing is written, so a resource can go days without a new row while its last state still stands. Resources are created and deleted over time and are listed in `resources`. {{lifecycle_rule}} `evaluation_id` is unique and assigned by the ingestion pipeline; it is not in time order.

**Problem Statement.** Write one PostgreSQL query that returns `day, policy_id, assessed_resources, compliant, non_compliant, compliance_pct` for every UTC day from {{start_day}} to {{end_day}} inclusive ({{days}} days). For a day D and a policy, a resource counts if it still exists at the end of D (its `deleted_at` is NULL or at or after the next midnight) and it has at least one evaluation for that policy made before the next midnight (`evaluated_at < D + 1 day`). Its state that day is its latest such evaluation, carried forward from earlier days when it was not re-evaluated on D. {{state_rule}} `assessed_resources` = `compliant` + `non_compliant`; `compliance_pct` is `ROUND(100.0 * compliant / assessed_resources, 1)`. Return one row per day and policy with at least one assessed resource, ordered by `day, policy_id`.

**Constraints.** One SQL statement (CTEs allowed). Days are half-open in UTC: an evaluation exactly at midnight belongs to the new day, and a resource deleted exactly at midnight existed for the whole of the day before. The sample has {{resource_rows}} resource rows and {{evaluation_rows}} evaluations; production has hundreds of millions of evaluations a day across many subscriptions.

**Assumptions.** Hypothetical schema, policy names, resource names and states. Evaluations are never written for a resource outside its lifetime. The report covers one subscription, so there is no tenant column.

**Clarifications.**
- Q: Does a resource evaluated before the first reported day count on that day? | A: Yes. Its latest evaluation before the next midnight is its state, however old.
- Q: A resource was created on D but not evaluated until D + 1. Does it count on D? | A: No. It has no state yet for any policy.
- Q: Do evaluations after {{end_day}} matter? | A: No. They are after the end of every reported day.
- Q: What if the latest evaluation is for a different policy? | A: Each policy has its own state for a resource; take the latest per resource and policy.
- Q: Should days with no new evaluations at all still appear? | A: Yes, if any resource still has a carried-forward state for the policy.

**Hints.**
1. Build the calendar of days with `generate_series`, then join each day to every evaluation made before its end.
2. `DISTINCT ON (day, policy_id, resource_id …) … ORDER BY …, evaluated_at DESC, evaluation_id DESC` keeps the latest evaluation per resource, policy and day.
3. Decide whether a resource exists at the end of the day after picking its latest state, using the lifetime the evaluation belongs to.

**Follow-ups.**
1. This query re-reads every evaluation for every day. At hundreds of millions of evaluations a day, what would you store instead so the daily trend is cheap (a state-change interval table, or a daily snapshot), and how is it kept correct?
2. The engine sometimes re-evaluates a resource and writes the same state again. How would you compute the number of real state changes per policy and day?
3. The dashboard shows 92% compliant. Which resources are not in the denominator at all, and should the dashboard say so?
4. A resource's state is three weeks old because the periodic scan skipped it. How would you flag stale states, and should they still count?

**Follow-up rules.**
- when: max(evaluation_id), order by evaluation_id → ask: evaluation_id is assigned on ingestion and is not in time order. Which evaluation does MAX(evaluation_id) pick for a resource scanned late, and what should decide "latest"?
- when: evaluated_at::date, date_trunc, cast as date → ask: An evaluation at exactly 00:00:00 changes a resource's state. Which day does your expression give it, and which day's row does it change?
- when: lag, lead, window function, row_number → ask: Your window picks the latest row per resource overall. How does a day in the middle of the range see the state the resource had on that day, not today's?
- when: deleted_at → ask: A resource is deleted at exactly midnight. Show the comparison you wrote and the two days around the deletion.
- when: exempt → ask: The latest evaluation is exempt but the one before was non-compliant. Did you filter exempt rows before or after picking the latest, and what does each give?

**Production Reality Check.**
- A version of this report that counted only each day's evaluations showed compliance swinging between 40% and 95% day to day across {{policy_list}}: the periodic scan covered a different set of resources each day, and resources not scanned that day dropped out of the denominator.
- After a clean-up deleted hundreds of resources, the trend still counted them as non-compliant for weeks, because the query ignored `deleted_at` and carried their last state forward.

**Evaluation Criteria.** A calendar of days joined to evaluations before each day's end; latest evaluation per resource, policy and day by `evaluated_at` (ties as stated), carried forward; existence at the end of the day with half-open boundaries; at Hard and above, exempt chosen as the latest state and then excluded, and ties by `evaluation_id`; at Very Hard, evaluations attached to the lifetime they fall in so a re-created resource starts with no state; correct rounding and deterministic ordering; can explain a state-change interval table, staleness and the denominator.
