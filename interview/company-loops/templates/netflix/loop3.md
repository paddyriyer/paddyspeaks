# Netflix · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a global video
streaming service: membership plans, profiles, devices, a catalogue of films and
series, and recommendations. Every workload, number, schema and incident is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## NFX-L3-01: One catalogue, many countries — seasons, localised tracks and availability windows

| | |
|---|---|
| **Template ID** | NFX-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / title hierarchy, localised assets, rights windows per country, as-of availability |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "titles": {"1": ["6,000"], "2": ["18,000", "30,000"], "3": ["60,000", "90,000"]},
  "countries": [40, 120, 190],
  "languages": [20, 35, 50],
  "window_changes": ["2,000", "15,000", "40,000"]
}
```

**Business Scenario.** A streaming service offers about {{titles}} titles across {{countries}} countries. A title is a film or a series; a series has seasons and a season has episodes. Each title has an original language, localised names, synopses and artwork in up to {{languages}} languages, and each episode (or film) has its own set of audio tracks (original, dubs, audio description) and subtitle tracks (subtitles, closed captions for the deaf and hard of hearing, and forced narrative subtitles that translate on-screen text). What can be played where is governed by licences: a licence grants a set of seasons or a film in a set of countries for a window, a title can leave a country and come back under a new licence, and a few countries receive an edited version with a different runtime. The rights team changes about {{window_changes}} window rows a week, often days or weeks ahead of the date they take effect.

**Problem Statement.** Design the data model for the catalogue and its availability. Cover: the title hierarchy and its keys; localised metadata; playable versions (a cut of a film or episode) and their audio and subtitle tracks; licences and availability windows, and at which level they attach (title, season, episode, version); how a window change is recorded so that you can answer both "what was playable in country C at instant T" and "what did we believe on date D would be playable on date T"; and the analytical facts that answer "titles and hours available per country per day", "share of available hours with a dub or subtitles in language L, per country" and "titles arriving and leaving next month, per country". Write the availability check for one (episode, country, instant) in words or SQL.

**Constraints.** A window is a half-open interval [start, end) in UTC; in this scenario each country's window starts and ends at local midnight of a single catalogue time zone per country, converted when the window is stored. An episode is playable in a country only if a window covers it there and its version for that country has at least one audio track. Past availability must be reconstructable. Track availability is per version, never assumed from the title.

**Assumptions.** Title counts, countries, languages and change rates are hypothetical. Licence terms beyond countries, dates and seasons (fees, exclusivity) are out of scope. A version is identified by its own id and is immutable once published; a corrected encode is a new version.

**Clarifications.**
- Q: Can different seasons of one series be available in different countries? | A: Yes. A licence can cover seasons 1–3 in one set of countries and season 4 in another, or season 4 may not be licensed yet.
- Q: Is a dub available for a whole series? | A: Not necessarily. Season 1 may be dubbed into a language and season 2 not yet; tracks belong to the episode's version.
- Q: When a window is changed after it was published, do we need the old value? | A: Yes. Reports must show what was promised to a country at the time, and audits ask when a change was made.
- Q: Does a country ever get a different cut? | A: Yes, for a small number of titles. The cut has its own runtime and its own tracks.
- Q: Are window boundaries inclusive? | A: Start inclusive, end exclusive, in UTC after conversion from the country's local midnight.

**Hints.**
1. Separate what a title is (hierarchy, localised metadata) from what can be played (versions and their tracks) and from where and when it may be played (licences and windows).
2. Store windows at the lowest grain they apply to, or expand them to (episode, country) intervals in a derived table; decide which is the source and which is derived.
3. Two time axes: the window's validity in the world, and when the row was recorded or superseded.

**Follow-ups.**
1. Write the availability check for one (episode, country, instant), including a season covered by one licence and a later season by another.
2. A licence ends at local midnight on the last day of a month in a country whose catalogue time zone is UTC−5. What do you store, and what does the daily "titles available" fact for that day show?
3. With about {{window_changes}} window changes a week, how do you keep a daily (title, country) availability fact for {{countries}} countries current without rebuilding it from scratch?
4. Product asks: "on 1 March, what did we expect to have in Brazil on 1 April, versus what we actually had?" Which columns answer it?
5. A subtitle file is replaced after a translation error. How do versions, tracks and history reflect it, and what does an audit see?

**Follow-up rules.**
- when: is_available, available flag, boolean column → ask: A title leaves a country on the 31st and returns under a new licence two months later. How does a single flag answer "was it playable on the 15th of the gap month"?
- when: series level, title level, on the title → ask: Season 4 is dubbed into one language and seasons 1–3 are not. Where does your model say so, and what does a viewer in that country see on season 1?
- when: overwrite, update the window, update in place → ask: The rights team moved a window's end date twice last month. Which report needs the earlier values, and how do you get them back?
- when: local time, time zone, midnight → ask: How do you store a window that starts at local midnight in a country, and what does your daily fact use as its day?
- when: array of languages, languages column, json array → ask: How do you answer "share of available hours with a dub in language L per country" from that column, and what happens when one season's dub arrives later?

**Production Reality Check.**
- A licence renewal for one season was loaded with the end date treated as inclusive. In {{countries}} countries the season stayed playable one day after the licence ended, and the rights team asks for an exact list of affected countries and hours viewed.
- A dub was attached at series level by a metadata tool, so the app offered that audio language for every season. Viewers who chose it on seasons without the dub got the original audio, and support tickets spiked in two countries.
- A bulk import of about {{window_changes}} window changes overwrote rows in place. Last quarter's "titles available per country per day" changed in the next rebuild and no longer matches the figures already reported.

**Evaluation Criteria.** Title hierarchy, versions and tracks, and licences/windows modelled separately with clear keys; windows at the right grain (season or episode, country) and half-open in UTC with the local-midnight rule; tracks per version; a bitemporal or append-only history of window changes answering both "what was" and "what we believed"; a correct availability check; facts at stated grains (title × country × day availability, hours by track language) with an incremental build; each incident contained, quantified and guarded.

## NFX-L3-02: Accounts, profiles, households and devices — who watched, and under which rules

| | |
|---|---|
| **Template ID** | NFX-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / identity hierarchy, profile attribution, kids profiles, household rules, deletion |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "accounts": {"1": ["5 million"], "2": ["40 million"], "3": ["150 million", "250 million"]},
  "max_profiles": [4, 5],
  "devices_per_household": [3, 6, 10],
  "daily_plays": ["300 million", "1.5 billion", "4 billion"]
}
```

**Business Scenario.** A streaming service has about {{accounts}} member accounts. An account pays for a plan; it holds up to {{max_profiles}} profiles, each with its own viewing history, recommendations and settings, and a profile can be a kids profile with a maturity ceiling. Viewing happens on devices (TVs, phones, tablets, browsers, games consoles), about {{devices_per_household}} per household, and a person picks a profile on a "who's watching" screen before a play starts. In this exercise an account has one primary household, and in some countries an extra member can be added to an account for a fee and watches under their own login. A profile can be transferred to a new account of its own, taking its history with it, and a member can delete a profile at any time. There are about {{daily_plays}} plays a day.

**Problem Statement.** Design the data model for identity and attribution: accounts, plans held over time, profiles (type, maturity ceiling, language), extra members, households and the signals that place a device in one, devices and their sign-ins, and the play record that ties a view to a profile, device and account. Decide how a play is attributed and whether that attribution may ever change; how a profile transfer and a profile deletion affect history, personalisation data and aggregates; how kids profiles are protected in analytics; and which facts answer "active profiles and accounts per month", "minutes viewed on kids profiles by maturity rating" and "share of plays from devices outside the account's primary household".

**Constraints.** A play's profile is the one selected when it started. Monthly account metrics already published do not change unless a documented restatement says so. Data from kids profiles is used for personalisation of that profile and for aggregate reporting only. When a profile is deleted, its personal viewing history is removed from personalisation within a stated time, while aggregate counts already published stay as published.

**Assumptions.** Account, device and play volumes are hypothetical. Household placement in this exercise uses coarse signals (network and device activity) and produces a household id per device sign-in with a confidence; how those signals are computed is out of scope, and the model never stores precise location. Rules on extra members and households vary by country and change over time; check current public help pages rather than assuming any one rule.

**Clarifications.**
- Q: Is a profile always one person? | A: No. A profile is what was selected; analytics must not claim it is a person.
- Q: After a profile transfer, which account do its old plays belong to? | A: Your call, stated. Published account metrics must not change; the profile's own history moves with it.
- Q: Can a device belong to several accounts? | A: Yes, one sign-in at a time per app, but a TV can be signed out of one account and into another.
- Q: How long can deletion take? | A: Choose and state it. Personalisation and raw history must honour it; aggregates may keep anonymous counts.
- Q: What is an active profile? | A: Define it; for example, at least one play of at least a minute in the month.

**Hints.**
1. Keep the identity hierarchy as history: profile → account membership and device → account sign-ins are intervals, not current-state columns.
2. Freeze the attribution on the play (profile, account, device, household at play time) instead of looking it up later through current state.
3. Treat kids profiles and deletions as data-governance rules with owners, retention and tests, not as filters someone remembers to add.

**Follow-ups.**
1. Draw the keys from a play to profile, account, device and household, and say which of those links are copied onto the play and which are looked up.
2. A profile with three years of history is transferred to a new account. Show what changes in each table and what last year's "active accounts" report says afterwards.
3. Define "minutes viewed on kids profiles by maturity rating" so that it can be published without exposing an individual child's viewing.
4. A member deletes a profile. Walk through raw plays, personalisation features, a training snapshot taken last week and published aggregates.
5. At {{daily_plays}} plays a day, which attribution columns do you denormalise onto the play fact, and how do you handle a device that was re-assigned to another household mid-month?

**Follow-up rules.**
- when: current account, join to accounts, latest account → ask: A profile moved accounts in June. Which account does your join give its March plays, and what happens to March's published numbers?
- when: user_id, person, viewer → ask: Two people share one profile and one person uses two profiles. What does your "user" mean, and which metrics does that change?
- when: delete, hard delete, purge → ask: The profile's plays fed last week's recommendation training snapshot and last month's published totals. What exactly do you delete, and what do you keep?
- when: kids, maturity → ask: Who can query a kids profile's plays at row level, and what stops a join that re-identifies one child's viewing?
- when: ip address, location, geolocation → ask: What precision do you store for household placement, for how long, and why is that enough?

**Production Reality Check.**
- A TV app release sent the account's first profile id when the "who's watching" screen timed out. For a week, plays on those devices were attributed to that profile, minutes on kids profiles dropped, and recommendations for the affected profiles drifted.
- After profile transfers launched, monthly "active accounts" for earlier months changed on every rebuild because plays were joined to the profile's current account. Finance had already used those numbers.
- With about {{devices_per_household}} devices per household, a change in household placement moved a device family to a new household id for some accounts, and the share of plays outside the primary household tripled overnight for those accounts.

**Evaluation Criteria.** Account, profile, device, household and extra member as distinct entities with interval history; attribution frozen on the play at play time; transfer handled without restating published metrics; deletion traced through raw data, features, snapshots and aggregates with a stated deadline; kids-profile data restricted to aggregates with thresholds and access control; household signals coarse with retention; facts at stated grains with clear metric definitions; each incident contained, repaired and guarded.

## NFX-L3-03: Localisation deliverables — dubs and subtitles from order to approved, across vendors

| | |
|---|---|
| **Template ID** | NFX-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / work orders, versioned deliveries, QC results, source revisions, due dates from launches |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "titles_per_month": ["300", "800", "1,500"],
  "languages": [20, 35],
  "vendors": [12, 40, 90],
  "qc_fail_rate": ["4%", "10%"]
}
```

**Business Scenario.** A streaming service launches about {{titles_per_month}} new titles or seasons a month, each localised into up to {{languages}} languages before its launch date in each country. Localisation is ordered from about {{vendors}} external vendors: subtitle files, closed captions, forced narrative subtitles, dubbed audio and audio description, each per episode (or film) and language. Vendors upload deliveries; each delivery goes through automated checks (format, timing against the picture, reading speed) and, for some types, a human review; about {{qc_fail_rate}} of deliveries fail a check and come back as re-deliveries. The picture can still change after localisation starts: an editorial re-cut produces a new source version, and timed deliverables made against the old one may need to be conformed. Launch dates move, sometimes earlier.

**Problem Statement.** Design the data model that tracks localisation from order to approval: source versions of each episode, work orders (episode × language × deliverable type, against a source version, assigned to a vendor), deliveries as immutable versions, QC runs and their findings (severity, type, timecode), approvals, and due dates derived from each country's launch date. Define the status of a deliverable as derived from events, the invariant that an approved deliverable matches the current source version, and the facts that answer "on-time delivery rate by vendor and language", "first-pass QC yield by vendor and deliverable type", "cycle time from order to approval" and "deliverables at risk for launches in the next 14 days".

**Constraints.** Every delivered file is kept, identified by a checksum, and never overwritten. A QC result always names the delivery and the source version it was checked against. A due date changes when the launch date changes, and the history of both is kept. A vendor sees only its own orders and results.

**Assumptions.** Volumes, vendor counts and failure rates are hypothetical. Rates paid to vendors are out of scope. One work order is assigned to one vendor at a time; it can be re-assigned.

**Clarifications.**
- Q: Is a re-delivery a new work order? | A: No. It is a new delivery (version) on the same work order.
- Q: What does first-pass yield mean? | A: Define it. For example, the share of work orders whose first delivery passed every check, by the vendor who made it.
- Q: When a re-cut happens, does every deliverable fail? | A: Not automatically. Some deliverables only need their timings conformed; the model must say which source version each approval refers to.
- Q: Can the same file be uploaded twice? | A: Yes, by mistake or by a retried upload. It has the same checksum.
- Q: Who owns a due date? | A: It is derived: the earliest launch date of the countries that need that language, minus a lead time per deliverable type (your choice).

**Hints.**
1. Separate the order (what is needed, against which source version), the deliveries (what arrived), the checks (what was found) and the decisions (approved, rejected). Status is derived from them.
2. A source version is part of the key of everything timed; an approval for an older source version is not an approval for the current one.
3. Due dates are a function of launch dates; store the inputs and derive, or store each recalculation as a new row.

**Follow-ups.**
1. Write the status derivation for one work order: ordered, delivered, in QC, failed, re-delivered, approved, needs conform.
2. Define on-time delivery precisely when the due date moved earlier after the order was placed. Which due date is the vendor judged on?
3. A re-cut changes the picture of episode 4 after 30 languages were approved. Which rows are created, which approvals stop counting, and how does the at-risk report change?
4. With {{vendors}} vendors, how do you give each vendor a dashboard of its own orders and QC findings without copying the data?
5. At about {{titles_per_month}} launches a month, which facts do you keep at delivery grain, which at work-order grain, and for how long?

**Follow-up rules.**
- when: status column, update the status, current status → ask: A delivery failed, was re-delivered and then the picture was re-cut. What does your status column say, and how do you compute first-pass yield from it?
- when: overwrite, replace the file, latest file → ask: QC flagged a timing error on a file that has since been replaced. How does a reviewer see exactly what was checked?
- when: due_date, due date → ask: The launch moved a week earlier. Does the vendor's on-time record use the old or new due date, and how does your model show both?
- when: checksum, hash → ask: The same file is uploaded twice and the second upload fails a newer check. Is that one delivery or two, and which result counts for yield?
- when: re-cut, recut, source version → ask: Which deliverables need a conform after a re-cut and which do not? Where does your model hold that rule?

**Production Reality Check.**
- An editorial re-cut moved scenes in one episode after subtitles in {{languages}} languages had been approved. QC passed the re-check because it ran against the old source version, and the subtitles went live out of sync in several countries.
- A vendor's upload client retried every upload, so each file arrived twice with the same checksum. First-pass yield for that vendor halved on the dashboard and its account manager escalated.
- A launch moved two weeks earlier for one country, but due dates had been copied onto work orders at assignment. The at-risk report showed every deliverable on track until three days before launch.

**Evaluation Criteria.** Source versions, work orders, deliveries, QC runs/findings and approvals as separate entities; deliveries immutable and keyed by checksum; approvals tied to a source version; status derived from events; due dates derived from launch dates with history; precise yield, on-time and cycle-time definitions; vendor-level access; facts at stated grains; each incident contained, corrected and guarded.

## NFX-L3-04: Subscription lifecycle — plans, price changes, pauses, partner bundles and payment retries

| | |
|---|---|
| **Template ID** | NFX-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / SCD type 2 plan history, effective-dated prices, state machine, partner feeds, involuntary churn |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "members": {"1": ["8 million"], "2": ["40 million"], "3": ["120 million", "250 million"]},
  "partner_share": ["5%", "15%", "30%"],
  "retry_days": [7, 14, 30],
  "notice_days": [30, 60]
}
```

**Business Scenario.** A streaming service has about {{members}} paying members across many countries and currencies. Members choose among plans that differ in price, video quality, the number of simultaneous streams and whether ads are shown; they can change plan at any time. Prices are set per plan and country and change from time to time: in this exercise members are notified {{notice_days}} days ahead and the new price applies from their first billing date on or after the effective date. In this exercise a member may also pause their membership for a limited time instead of cancelling. About {{partner_share}} of members are billed by a partner (a telecom or TV provider) that bundles the service and sends activation, change and deactivation messages. When a payment fails, the membership goes on hold and payment is retried for up to {{retry_days}} days before it ends.

**Problem Statement.** Design the data model for the subscription lifecycle: plans and their versioned prices per country and currency, the member's subscription and its plan history as a slowly changing dimension (type 2) with effective dates, the state machine (active, on hold, paused, cancelled with access until period end, ended), billing periods and invoices, payment attempts and retries, partner-billed subscriptions and the partner message feed. Define how a plan change mid-period and a price change are dated, and the facts that answer "members and recurring revenue by plan and country as of any date", "net adds by day: gross adds, rejoins, voluntary and involuntary churn", "share of on-hold memberships recovered within {{retry_days}} days" and "price change impact by cohort".

**Constraints.** The plan and price a member had on any past date are reconstructable. Money is stored as integers in minor units per currency, and currencies are never added together without a stated conversion. A partner's messages can arrive late, out of order or more than once, and the partner's own reconciliation file is the record of what it billed. A member counts as churned only once per ended membership.

**Assumptions.** Member counts, shares, notice and retry periods, and the pause feature are hypothetical; check current public help pages for any real plan or pricing rule. Taxes are carried per invoice and out of scope for revenue. Billing dates are per member, not calendar months.

**Clarifications.**
- Q: Does a plan upgrade take effect immediately? | A: In this exercise, yes, with the price difference handled at the next billing date; a downgrade takes effect at the next billing date. Model both.
- Q: When does a member on hold count as churned? | A: Only when the retry period ends without a successful payment. A member who pays on day 5 of the hold never churned.
- Q: Is a paused member a member? | A: Your definition, stated. Most reports show paused separately from active.
- Q: How does a partner tell us about a plan change? | A: A message with the partner's subscriber reference, the new plan and an effective time; duplicates and out-of-order messages happen.
- Q: Which price does a member see on the effective date of a price change? | A: The old price until their first billing date on or after the effective date, and only if they were notified {{notice_days}} days ahead.

**Hints.**
1. Keep three histories apart: the price list (plan × country, effective-dated), the member's plan (SCD type 2 rows), and the member's state (a state machine with timestamped transitions).
2. Recurring revenue as of a date is a function of the plan row and the price row in effect for that member on that date, not of the latest invoice.
3. Partner messages are events with their own ids; apply them idempotently and in effective-time order, then reconcile against the partner's file.

**Follow-ups.**
1. Write the SCD type 2 rows for a member who upgrades on the 10th, pauses on the 20th, resumes a month later and downgrades at the next billing date.
2. A price change is effective on the 1st. Show which members pay the new price in that month and how "revenue by plan as of the 15th" is computed.
3. Define gross adds, rejoins, voluntary churn and involuntary churn so that the daily net adds identity holds, including members who recover from hold.
4. A partner resends a month of messages, some out of order. How do your keys and ordering prevent double activations and wrong end dates?
5. At {{members}} members, how do you serve "members by plan and country as of any date" quickly without keeping a daily snapshot of every member forever?

**Follow-up rules.**
- when: plan column, current plan, update the plan → ask: Finance asks for revenue by plan on the 15th of last month for a member who changed plan twice since. How does a plan column on the subscription answer it?
- when: churn, churned → ask: A member's payment fails, they go on hold and pay on day 6. In your model, did they churn and rejoin? What does that do to gross adds and churn?
- when: price, prices → ask: The price change took effect on the 1st but the member's billing date is the 20th. Which price applies on the 10th, and where does your model encode the notice rule?
- when: partner, telco, bundle → ask: The partner's deactivation arrives two days after its reactivation for the same subscriber. Which state wins, and how do you know?
- when: snapshot, daily snapshot → ask: A daily snapshot of every member for years is large. What do you keep at full grain, and how do you answer an as-of question for a date between snapshots?

**Production Reality Check.**
- A price change was applied to every member from its effective date instead of from each member's first billing date after the {{notice_days}}-day notice. Recurring revenue jumped in the report for members still in a period billed at the old price.
- A partner covering about {{partner_share}} of members resent a month of activation messages after an outage. Each duplicate opened a new subscription row, gross adds doubled for that partner, and the next day's deactivations ended only one of each pair.
- Members recovered from hold on day {{retry_days}} were counted as involuntary churn and then as gross adds the next day, inflating both churn and acquisition for the month.

**Evaluation Criteria.** Price list, plan history (SCD type 2 with effective and recorded dates) and state transitions kept apart; the notice and billing-date rule encoded rather than assumed; on hold and paused as states with clear churn rules; money in minor units per currency; partner messages applied idempotently in effective order and reconciled; precise net-adds identity; as-of facts with partitioning and interval joins; each incident contained, corrected and guarded.

## NFX-L3-05: Binge sessions — episodes back to back, autoplay versus chosen, per season

| | |
|---|---|
| **Template ID** | NFX-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / gaps and islands, LAG with a gap threshold, distinct counts per session, views versus plays |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | NFX-L3-05.mjs |

**Business Scenario.** A streaming service records every play: the profile, the title (and the episode, for a series), when it started and when it stopped, and whether it started because the viewer chose it or because autoplay started the next episode after the previous one ended. The content team wants to see how each season is watched in runs: how many back-to-back runs reach {{min_episodes}} episodes, by how many profiles, and how much of each run comes from autoplay rather than the viewer choosing the next episode. {{view_rule}}

**Problem Statement.** Write one PostgreSQL query against `titles`, `episodes` and `plays` that returns `title_name, season_no, binge_sessions, binge_profiles, episodes_in_binges, autoplay_continuations, chosen_continuations`: one row per (title, season) that has at least one binge session, ordered by `title_name, season_no`. Take each profile's views in order of `started_at` (then `play_id`). A view continues the session of the view immediately before it when both are episodes of the same title and the same season and it starts no more than {{gap_minutes}} minutes after that previous view ended (`started_at − previous ended_at ≤ {{gap_minutes}} minutes`); otherwise it starts a new session. A film, or an episode of another title or season, in between therefore ends a session. A binge session is a session of episodes with at least {{min_episodes}} distinct episodes. Per (title, season): `binge_sessions` counts its binge sessions; `binge_profiles` counts the distinct profiles that had one; `episodes_in_binges` sums the distinct episodes of each binge session; `autoplay_continuations` and `chosen_continuations` count, over its binge sessions, the views after the first by `start_reason`. {{end_rule}} {{feed_rule}}

**Constraints.** One SQL statement (CTEs allowed). The gap threshold is inclusive and exact to the second. The sample has {{plays}} rows in `plays` from {{profiles}} profiles; production has billions of plays a day across hundreds of millions of profiles. All timestamps are UTC.

**Assumptions.** Hypothetical schema, fictional titles, ids and times. `plays.title_id` is the series for an episode and the film for a film; `episode_id` is NULL for a film. Two different plays of one profile never overlap in time. Autoplay starts the next episode only after the previous one has stopped.

**Clarifications.**
- Q: Does a gap of exactly {{gap_minutes}} minutes continue the session? | A: Yes. No more than {{gap_minutes}} minutes, inclusive; one second more starts a new session.
- Q: Is the gap measured from the previous view's start or its end? | A: From the previous view's `ended_at` to this view's `started_at`.
- Q: A viewer watches episode 3, then episode 3 again. Is that two episodes? | A: One distinct episode and two views. It counts once towards the threshold and in episodes_in_binges; the second view is still a continuation.
- Q: The season 1 finale autoplays season 2 episode 1 within a minute. Same session? | A: No. A session never crosses a season. Season 2 episode 1 starts a new session and, as its first view, is not a continuation, whatever its start_reason.
- Q: A few minutes of another series between two episodes — does that end the session? | A: Yes, if that play is a view. Back to back means the view immediately before, across everything the profile watched.

**Hints.**
1. Gaps and islands: flag a view that starts a new session using LAG over the profile's views, then a running SUM of the flag numbers the sessions.
2. Clean the views before the window function (one row per play, its end, false starts removed), so that "the view immediately before" is the right one.
3. Aggregate per session first (COUNT(DISTINCT episode_id), continuations with FILTER), keep sessions that meet the threshold, then aggregate per title and season.

**Follow-ups.**
1. Sessions cross midnight and daily partitions. How do you compute them incrementally each day without cutting a session that started yesterday?
2. Plays from offline downloads arrive days later and can land in the middle of an existing session. What happens to this report, and how would you make it stable?
3. Product wants a binge rate per season: binge sessions per profile that started the season. Write the denominator precisely.
4. Autoplay continuations are much higher on TVs than on phones. What would you add to the model to tell an autoplayed episode the viewer watched from one that ran in an empty room?

**Follow-up rules.**
- when: profile_id, title_id, season_no → ask: If your window is partitioned by profile, title and season, what happens to a six-minute episode of another series watched between episode 3 and episode 4? Is that still back to back?
- when: lag(started_at → ask: Do you measure the gap from the previous view's start or from its end? What does start-to-start do for a 50-minute episode?
- when: extract(minute, date_part, datediff → ask: A view starts {{gap_minutes}} minutes and one second after the previous one ended. Does your comparison treat that as a break?
- when: count(episode_id, count(p.episode_id, count(*) as episodes → ask: Episode 3 was watched twice in a row. How many episodes does that session have in your query, and does it reach the threshold?
- when: received_at → ask: What does received_at tell you about a redelivered play, and why must it not decide the order of views?

**Production Reality Check.**
- After a TV app release, autoplayed episodes were sent with start_reason 'chosen'. This report's autoplay continuations for every season fell by half overnight, and a product team began investigating a drop in autoplay that never happened.
- Offline-download plays synchronised days late were inserted into the middle of sessions, but the daily job rebuilt sessions only within the new day's partition. The same season's binge sessions differed between yesterday's report and a full rebuild with a {{gap_minutes}}-minute threshold.

**Evaluation Criteria.** Views cleaned before ordering (and, at the hardest level, one row per play_id and the missing end derived from runtime); sessions built over all of a profile's views with LAG and a running sum; the gap measured end to start, inclusive and exact; season and title both part of the continuation rule; distinct episodes for the threshold and the total; continuations exclude each session's first view; deterministic ordering; can explain incremental sessionisation, late plays and a binge-rate denominator.
