# Meta · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a company that
runs social apps, messaging apps and an advertising business. Every workload,
number and schema is hypothetical, and nothing here describes how any company's
systems are actually built.

## MET-L4-01: Experiment scorecards for feed ranking changes, with network effects

| | |
|---|---|
| **Template ID** | MET-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Experimentation platform / metric pipelines, variance, interference on a social graph |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "daily_users": {"2": ["300 million", "800 million"], "3": ["2 billion", "3 billion"]},
  "experiments": [200, 1000, 3000],
  "metrics": [150, 600],
  "results_by": ["6 hours", "12 hours"]
}
```

**Business Scenario.** Teams that work on a social app's feed ranking run about {{experiments}} randomised experiments at once over {{daily_users}} daily users. A person is in many experiments at the same time, in different layers; within a layer, experiments do not overlap. Each experiment has a scorecard of {{metrics}} metrics (time spent, sessions, posts viewed, likes, comments, posts created, hides, reports, ratios such as likes per post viewed) for each arm, with confidence intervals, daily and cumulative since launch, ready within {{results_by}} after each UTC day ends. Because people interact, a change shown to the treatment arm can change what their friends in the control arm see and do: a ranking change that produces more comments also produces more replies from friends.

**Problem Statement.** Design the pipeline that produces these scorecards. Cover how assignment and exposure are recorded, how raw events become metrics without scanning raw logs once per experiment, how ratio metrics and confidence intervals are computed, cumulative results, variance reduction, data-quality gates, experiments randomised by clusters of connected people rather than by person, recomputation when a metric definition is fixed, and the cost at this scale.

**Constraints.** Every scorecard number must be reproducible from a versioned metric definition and the data. The raw event logs are too large to scan once per experiment. A scorecard must not be shown as decision-ready if the experiment fails a data-quality check. Teams look at results every day.

**Assumptions.** All volumes, counts and deadlines are hypothetical. Assignment is a deterministic hash of the person and a layer salt; the experiment's code path logs an exposure event when the person actually reaches it.

**Clarifications.**
- Q: Who is in an experiment's analysis? | A: People who were exposed (reached the changed code path) at least once, from their first exposure onward, in the arm they were assigned.
- Q: Are ratio metrics computed per post viewed? | A: They are defined as total numerator over total denominator within an arm, but the person is the randomisation unit.
- Q: How are cluster experiments randomised? | A: Groups of densely connected people are assigned together; you decide how the analysis treats them.
- Q: How often do metric definitions change? | A: Weekly. A fix to a definition sometimes needs past results recomputed.
- Q: Can a scorecard use data from before the experiment? | A: Yes, pre-experiment behaviour of the same people is available.

**Hints.**
1. Aggregate raw events once into a per-person-per-day metric table; every experiment then joins its exposures to that table. Cost then scales with people and metrics, not with experiments times raw events.
2. A confidence interval needs only a few sums per arm (count, sum, sum of squares, and cross-products for ratios). Decide where per-person values are still needed.
3. When the unit you randomise is not the unit you count, the variance must follow the randomisation unit.

**Follow-ups.**
1. How do you compute cumulative results since launch for {{experiments}} experiments without recomputing every person's full history each day?
2. Likes per post viewed is a ratio of two per-person sums. How do you compute its confidence interval, and why is treating every post view as independent wrong?
3. The split is configured 50/50, and an experiment with 100 million people shows 50.6% versus 49.4%. What does that mean, and what does the platform do?
4. How do you detect that control people are affected by treatment through their friends, and what does cluster randomisation cost in statistical power?
5. Teams check scorecards every day and ship when something looks significant. How does the platform keep false positives honest?

**Follow-up rules.**
- when: t-test, t test, p-value → ask: Likes per post viewed is a ratio of per-person sums. Which variance goes into your test, and what happens if you use post views as the units?
- when: per user per day, user-day, daily aggregate → ask: How many rows is that per day at {{daily_users}} users and {{metrics}} metrics, and how do you join it to {{experiments}} experiments without one scan per experiment?
- when: cuped, pre-period, covariate → ask: New people joined last week and have no pre-period data. What does your adjustment do for them?
- when: cluster, graph partition, community → ask: If you randomise a few hundred thousand clusters instead of hundreds of millions of people, what happens to the width of your intervals?
- when: exposure, trigger, triggered → ask: Exposure is logged by the app. If one app version drops exposure events in one arm only, what does every metric in that experiment show?

**Production Reality Check.**
- An app release stops logging exposures for the treatment arm on one platform. A large experiment shows 51.2% versus 48.8% and a +3% time-spent gain, and leadership has already seen the daily scorecard.
- The job that builds the per-person-per-day table is held up by a skewed partition: a few thousand automated accounts with millions of events each. Scorecards for all {{experiments}} experiments miss the {{results_by}} target.
- A comment-ranking experiment reports +4% comments in treatment, but control people's comments also rose compared with their own pre-period. Product asks whether the effect is real.

**Evaluation Criteria.** One aggregation pass into a per-person-day table with versioned metric definitions; experiments computed from exposures and sufficient statistics; correct variance for ratio metrics and for cluster randomisation; incremental cumulative results; variance reduction with pre-period data; automatic quality gates (sample ratio, exposure completeness) that block scorecards; a policy for daily peeking; interference detection; adapts to each incident with diagnosis, recovery and prevention.

## MET-L4-02: Spam signals for encrypted messaging, from metadata and reports

| | |
|---|---|
| **Template ID** | MET-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Real-time features and enforcement / sliding windows, labels and feedback, privacy without content |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ml-platform-engineer |

```params
{
  "daily_messages": {"2": ["20 billion", "60 billion"], "3": ["100 billion", "150 billion"]},
  "new_accounts": ["2 million", "10 million"],
  "act_within": ["30 seconds", "5 minutes"],
  "reviews": ["2,000", "20,000"]
}
```

**Business Scenario.** A messaging app carries about {{daily_messages}} messages a day, all end-to-end encrypted, so servers never see content. Spammers register accounts (about {{new_accounts}} new accounts of all kinds are registered per day) and send unsolicited bulk messages. What servers can see is metadata: account age and registration details, how many messages an account sends and to how many distinct recipients, whether a recipient has exchanged messages with the sender before, group creations and invitations, and how often recipients block or report the sender. When someone reports an account, the report can include recent messages that the reporting person chooses to share. The integrity team wants to act on a bulk-messaging account within {{act_within}} of the behaviour starting, while legitimate heavy users (community organisers, small businesses, new users inviting friends) are left alone. Human reviewers can look at about {{reviews}} cases a day.

**Problem Statement.** Design the system: the metadata events and features, how per-account features over sliding windows are computed in real time, scoring, the ladder of enforcement actions, the review and appeal loop, where labels come from and how they bias the model, how you measure precision and the prevalence of spam, how coordinated campaigns across many accounts are found, and how the data is minimised and retained.

**Constraints.** No message content, except what a reporting person shares in a report. Records that link a sender to a recipient are kept at most 72 hours. Every enforcement action stores the signals and the rule or model version that caused it, so an appeal can be decided. Automatic permanent bans must have a measured false-positive rate below an agreed target.

**Assumptions.** All volumes, rates and capacities are hypothetical. Registered business senders that use a separate business interface are out of scope.

**Clarifications.**
- Q: Does the server know whether two people have talked before? | A: Delivery metadata can tell whether a conversation already exists; how long you keep that knowledge is part of your design.
- Q: What actions are available? | A: Slowing an account's sending, requiring re-verification, temporary restrictions, and bans. Each has a different cost if wrong.
- Q: Where do labels come from? | A: Reviewer decisions, appeal outcomes and reports. Reports alone are noisy and can be abused.
- Q: Can reviewers see the account's messages? | A: Only messages shared in a report.

**Hints.**
1. Key the stream by sender and keep features for several window lengths; distinct recipients per window can be counted with a small sketch.
2. Spend certainty where it is cheap: soft actions at moderate scores, irreversible ones only at high confidence or after review.
3. Labels exist mostly for accounts you already acted on. Keep a random sample of reviews to measure what you miss.

**Follow-ups.**
1. Size the feature state: windows of 1 minute, 10 minutes, 1 hour and 1 day for every sending account, with distinct-recipient counts. How large is it, and how is it partitioned?
2. A campaign spreads sending across thousands of new accounts, each under every per-account threshold. What finds it?
3. How do you estimate precision, recall and the overall prevalence of spam when nearly all labels come from accounts you already restricted?
4. A community organiser messages 400 people who have not talked to them before, the evening before an event. Why does your system not ban them?
5. An appeal asks why the account was restricted. What can you show without teaching spammers your thresholds or revealing anything about other people?

**Follow-up rules.**
- when: classifier, machine learning, model → ask: Your labels come from accounts you already banned. What does the model learn, and how do you find spam it has never seen?
- when: ip address, device id, fingerprint → ask: Thousands of legitimate people can share one public address behind a carrier. What does acting on that signal alone do?
- when: ban, disable, suspend → ask: With {{reviews}} reviews a day, which actions happen without a human, and what false-positive rate do you accept for each?
- when: report, reports, reported → ask: A group can mass-report someone it dislikes. How do you weight reports so that cannot be used as a weapon?
- when: contact graph, who messaged, recipient list → ask: That store records who talks to whom. Why is that sensitive without content, and how long may it live?

**Production Reality Check.**
- A coordinated campaign spreads its sending across 40,000 new accounts, each staying under every per-account threshold. Reports rise sharply, but no account reaches the ban score.
- A threshold change restricts a wave of legitimate accounts in one country on a holiday when people traditionally message many contacts in an hour. Appeals exceed {{reviews}} a day within hours.
- The feature pipeline in one region falls 25 minutes behind. Scores are computed on stale features, and action within {{act_within}} silently stops there.

**Evaluation Criteria.** Content-free features from metadata with explicit retention for sender-recipient links; real-time sliding-window features keyed by sender; an action ladder matched to confidence and reversibility; labels, appeals and a random review sample with stated bias; precision and prevalence measured; cluster-level detection for coordinated campaigns; explainable, auditable actions; staleness monitoring; adapts to each incident with diagnosis, recovery and prevention.

## MET-L4-03: Ad conversion attribution with click and view windows

| | |
|---|---|
| **Template ID** | MET-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Ads measurement / windowed attribution joins, deduplication, restatement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_impressions": {"2": ["5 billion", "20 billion"], "3": ["60 billion", "150 billion"]},
  "daily_conversions": {"2": ["50 million", "200 million"], "3": ["600 million", "1.5 billion"]},
  "click_window": ["1 day", "7 days"],
  "dup_share": ["30%", "60%"],
  "late_share": ["5%", "15%"]
}
```

**Business Scenario.** An ads platform serves about {{daily_impressions}} ad impressions a day across its apps. Advertisers send conversion events (purchase, lead, sign-up) from their websites through a browser tag and from their own servers through a server-to-server API, with customer identifiers hashed before sending. About {{dup_share}} of conversions arrive through both routes; advertisers are asked to send the same event id on both so the two can be deduplicated. Around {{daily_conversions}} conversions arrive per day, and about {{late_share}} arrive more than a day after they happened. For this exercise the attribution rule is: credit the last click on the advertiser's ad within {{click_window}} before the conversion; if there is none, the last view within 1 day. Advertisers see conversions and conversion value per campaign, ad set and ad, by day, and the ad delivery system wants conversions quickly to optimise bids.

**Problem Statement.** Design the attribution system: conversion intake and deduplication, matching conversions to people, storing clicks and views for the window, the attribution join, which day a conversion is reported on, restating reports when late data arrives, the reporting store, a fast feed for delivery optimisation, and privacy in reporting.

**Constraints.** A conversion is counted once even if received twice, and credited to at most one ad. Attribution is deterministic: rerunning it on the same inputs gives the same answer. Advertisers see only aggregates, never which person converted, and small cells are suppressed. Reported days may change for 7 days after they end and are final afterwards.

**Assumptions.** All volumes, windows and shares are hypothetical, and the attribution rule above is a simplified rule for this exercise. Identity matching returns a person id or nothing; some conversions never match.

**Clarifications.**
- Q: Is a conversion reported on the day of the conversion or the day of the ad interaction? | A: Both conventions exist. Choose one, say why, and say what it means for restatement.
- Q: Can a conversion be credited to another advertiser's ad? | A: No. Only the reporting advertiser's ads are candidates.
- Q: What if the browser event and the server event disagree on value? | A: Decide a precedence and make it deterministic.
- Q: How fast does delivery optimisation need conversions? | A: Within 30 minutes would help; it can accept a provisional signal that is corrected later.
- Q: Can an advertiser change the attribution setting? | A: Yes, per ad set, at any time. Decide what happens to history.

**Hints.**
1. Index ad interactions by (advertiser, person) and keep them only as long as the longest window; the conversion looks backwards into that index.
2. Deduplicate on a key the advertiser controls (data source, event name, event id) within a bounded window, and decide what an advertiser who never sends an event id gets.
3. Make attribution a pure function of the conversion and the interactions known at a cutoff, so a rerun after late data replaces earlier output rather than adding to it.

**Follow-ups.**
1. The browser event arrives at 10:00 and the server event for the same purchase at 13:00 with a different value. Which wins, and how long is your dedup window?
2. A click that happened six days before a conversion arrives late, after you already credited a view from yesterday. What changes, in which report, and what does the advertiser see?
3. An advertiser has ten campaigns that all reached the same person. How do you make sure the conversion is credited once across them, and what does each campaign's conversions column show?
4. An advertiser changes an ad set's click window from {{click_window}} to a different length mid-flight. Do you recompute history? What does that cost?
5. Delivery wants conversions within 30 minutes, but dedup and late matching need hours. How do you give delivery a signal now and correct it later without the bidder overreacting?

**Follow-up rules.**
- when: last touch, last click, last-click → ask: The click arrives after you have already credited a view. Does a rerun give the same answer as the live path, and which one is the truth?
- when: event_id, dedup, deduplicate → ask: An advertiser sends no event ids. What do you deduplicate on, and how many false merges does that create for a shop whose customers often buy the same item twice?
- when: stream join, interval join, join state → ask: How much click and view state must you hold for a {{click_window}} click window at {{daily_impressions}} impressions a day, and how is it partitioned?
- when: user-level, per user, list of users → ask: An advertiser asks for the list of people who converted. What do you return, and why?
- when: conversion date, impression date, reporting date → ask: Under your choice, which past days change when a conversion arrives five days late, and how far back can restatement reach?

**Production Reality Check.**
- After a deploy, a large advertiser's server integration sends every purchase twice with different event ids. Their reported conversions double overnight and automated bidding starts spending more on their campaigns.
- A regional outage delays conversion intake for 30 hours. When the backlog drains, yesterday's report, which many advertisers had already exported, rises by 12%; this week far more than the usual {{late_share}} of conversions arrive late.
- The matching service changes how it normalises hashed email addresses. The match rate jumps by 8% in one day, and attributed conversions jump with it for every advertiser.

**Evaluation Criteria.** Deterministic, idempotent attribution keyed on a stable conversion identity; bounded dedup with precedence and a policy for missing event ids; an interaction index with a TTL equal to the longest window; credit assigned once per conversion across the advertiser's ads; explicit reporting date and restatement period; separate provisional and final signals for delivery; aggregate-only reporting with small-cell suppression; adapts to each incident with diagnosis, recovery and prevention.

## MET-L4-04: Deletion propagation across the warehouse, streams and training data

| | |
|---|---|
| **Template ID** | MET-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Privacy engineering / deletion at scale in columnar storage, lineage, verification |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "account_deletions": {"2": ["100,000", "400,000"], "3": ["1 million", "3 million"]},
  "content_deletions": ["50 million", "200 million"],
  "tables": {"2": ["8,000", "20,000"], "3": ["80,000", "200,000"]},
  "window_days": [30, 90]
}
```

**Business Scenario.** People can delete posts, comments and whole accounts across the company's apps. About {{account_deletions}} accounts and {{content_deletions}} content items are deleted per day. The company commits that deleted data is removed from its systems within {{window_days}} days. Product databases handle their own deletion; your scope is everything downstream: event streams, a lakehouse with {{tables}} tables (raw events, derived tables, aggregates), feature tables and training datasets for ranking models, analysts' scratch tables and extracts, and backups.

**Problem Statement.** Design the deletion propagation system for this estate: how you know where a person's or a post's data lives, the deletion request log, how deletes are executed efficiently in large columnar tables, what happens to derived tables and aggregates, streams and their retention, training datasets and models already trained, backups and restores, verification with evidence per request, and how new tables are covered from the day they are created.

**Constraints.** Every request completes within {{window_days}} days, including physical removal from storage files. Completion must be verifiable per request. Rewriting every large table every day is not affordable. For this exercise, an aggregate may be kept after a deletion if each of its cells covers at least 100 people.

**Assumptions.** All volumes and counts are hypothetical. Tables use account ids, but some use device ids, hashed ids or ids nested inside semi-structured columns. Backups follow their own documented retention cycle.

**Clarifications.**
- Q: Do aggregates have to be recomputed? | A: Only cells that could identify someone under the 100-person rule; larger cells may stay.
- Q: What about models trained on deleted data? | A: For this exercise, training datasets must be purged before the next training run, and models are retrained on their regular cadence, which is shorter than {{window_days}} days. Say if you think that is not enough.
- Q: Who owns each table? | A: Thousands of teams. Many tables have no clear owner today.
- Q: How do analysts create tables? | A: Mostly through scheduled pipelines, but also by ad hoc queries that create tables from other tables.

**Hints.**
1. A deletion run is a join: the batch of requests against each table's identifier columns. Batch requests per table so each file is rewritten at most once per cycle.
2. Whether a delete touches ten files or ten thousand depends on how the table is laid out; date-only partitioning spreads one person across every partition.
3. You cannot delete what you cannot find. Classification has to happen when a table is created, with scanning to catch what slipped through.

**Follow-ups.**
1. A 200 TB event table is partitioned by date only. One day's batch of deletions touches every partition. What do you change in the layout or the method, and what does each option cost?
2. Some identifiers sit inside semi-structured columns, and some tables hold device ids linked to accounts. How do you find and delete those rows?
3. Show the evidence you would produce that request R is complete everywhere, including physical removal.
4. A ranking model was trained last week on data from accounts deleted since. What is required, and what would you push back on?
5. A backup from 20 days ago is restored after an accident. How do you guarantee that deleted data does not come back?

**Follow-up rules.**
- when: delete from, delete statement, row-level delete → ask: Each delete rewrites every file that holds a matching row. How many files does one day's batch touch in a date-partitioned table, and what does that cost?
- when: deletion vector, merge-on-read, tombstone → ask: The rows are hidden from readers but still inside the files until compaction. When are they physically gone, and does that meet {{window_days}} days?
- when: lineage, catalog, data catalog → ask: An analyst created a table from a registered one with an ad hoc query. Does your lineage see it, and who owns its deletion?
- when: crypto-shredding, per-user key, encryption key → ask: One key per person across {{tables}} tables: what does every query pay, and what about derived tables that combine many people?
- when: aggregate, rollup, summary table → ask: One cell of an aggregate counts 3 people, one of whom deleted their account. Does that cell stay?

**Production Reality Check.**
- The compaction job that physically removes deleted rows has been failing quietly in one storage region for three weeks. Rows are hidden from queries but still in the files, and the {{window_days}}-day deadline arrives for the oldest requests in nine days.
- A team created 40 tables from copies of registered tables through ad hoc queries; none was registered for deletion. It is discovered two months later.
- A backup restore after an accidental table drop brings back rows for 60,000 accounts deleted since the backup was taken.

**Evaluation Criteria.** Classification at creation plus scanning; a durable request log and batched deletes per table; layout chosen to bound rewrite cost; physical removal tracked to completion; aggregates handled by an explicit rule; streams retained within the window; datasets purged before training and a stated model policy; restores that replay deletions; per-request evidence; adapts to each incident with diagnosis, recovery and prevention.

## MET-L4-05: Social context on feed posts: which of your friends reacted

| | |
|---|---|
| **Template ID** | MET-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Social graph serving / fan-out on write versus read-time intersection, hot posts, freshness |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "daily_reactions": {"2": ["5 billion", "10 billion"], "3": ["30 billion", "60 billion"]},
  "renders": {"2": ["500,000", "1 million"], "3": ["5 million", "10 million"]},
  "avg_friends": [200, 400],
  "top_reactions": ["10 million", "80 million"],
  "latency": ["10 ms", "25 ms"]
}
```

**Business Scenario.** Under each post in a social app's feed, the app shows social context: "Priya, Sam and 14 other friends reacted". It names up to two friends of the viewer who reacted to or commented on the post, chosen by how close they are to the viewer, and counts the rest. People make about {{daily_reactions}} reactions and comments a day; the average person has {{avg_friends}} friends and nobody has more than 5,000; the most popular posts collect {{top_reactions}} reactions. The feed renders about {{renders}} posts per second at peak, and social context must be ready within {{latency}} at p99 per post, inside the feed's own budget.

**Problem Statement.** Design how social context is computed and served: the data each side holds (a person's friends, a post's reactors), whether you push each reaction to the reactor's friends when it happens or intersect at read time (or a hybrid), how names are chosen, how counts stay correct, how removals (un-reacting, unfriending, blocking, deleted accounts) take effect, caching, and cost.

**Constraints.** A removed reaction, an unfriending or a block is reflected within one minute. The count shown must never be higher than the true number. Never name a person the viewer has blocked or who has blocked the viewer, and never name a reaction the viewer is not allowed to see. p99 within {{latency}} per post.

**Assumptions.** All volumes, limits and budgets are hypothetical. Friend lists live in a sharded online store; reactions are written to a log and to a store keyed by post. A closeness score between two friends is available from another system.

**Clarifications.**
- Q: Must the count be exact? | A: It must never overstate. It may be capped in display (for example "99+ friends") and may briefly understate.
- Q: Which reactions count? | A: Reactions and comments, not shares.
- Q: Can I precompute per viewer? | A: Yes, if you account for the storage and the freshness.
- Q: What about very old posts? | A: Social context matters most in the first days of a post; older posts can be cheaper.

**Hints.**
1. There are two sides: a viewer with hundreds of friends and a post with up to millions of reactors. Iterate over the smaller side and probe the larger one.
2. Before choosing fan-out on write, compute how many writes it implies per day: reactions times the reactor's friends.
3. Probes into a very large reactor set can be screened cheaply (for example with a membership filter) and then confirmed.

**Follow-ups.**
1. What is the write amplification of pushing every reaction to every friend's index at {{daily_reactions}} reactions a day and {{avg_friends}} friends, and what happens when someone with 5,000 friends reacts to 300 posts in an hour?
2. For read-time intersection, how is a post's reactor set laid out so that probing {{avg_friends}} friends against {{top_reactions}} reactors fits in {{latency}}?
3. A feed page shows 20 posts. How many probes is that per page, and how do you batch them?
4. How does an un-react reach the viewer's feed within a minute in each design?
5. Which two friends do you name, and where is that decided so it stays within budget?

**Follow-up rules.**
- when: fan-out on write, fanout, push model → ask: How many index writes per day is that at {{daily_reactions}} reactions and {{avg_friends}} friends per reactor, and who pays when one person with 5,000 friends reacts to hundreds of posts?
- when: intersect, intersection, read time → ask: For a post with {{top_reactions}} reactions, which side do you iterate over, and how many lookups does one render cost?
- when: bloom filter, bloom, membership filter → ask: A false positive would name someone who did not react. What confirms a hit, and what false-positive rate do you choose?
- when: cache, cached, memcache → ask: A friend un-reacts. The cached social context still names them. What invalidates it within one minute?
- when: counter, count of friends, precomputed count → ask: The viewer blocks one of the counted friends. How does your count avoid overstating?

**Production Reality Check.**
- The reactor set of a post collecting {{top_reactions}} reactions lives on one storage shard. Render traffic for that post saturates the shard, and social context times out for 30% of feed renders in one region.
- A person blocks someone. For 20 minutes the blocked person's name still appears under posts in the feed, because social context was cached per viewer and post.
- After a major sports final, the fan-out queue is three hours behind. Friends' reactions are missing from social context and counts lag far behind.

**Evaluation Criteria.** Quantifies write amplification and read cost before choosing; picks the cheaper side per post (fetch a small reactor list and intersect with the viewer's friend set; for a large one, send the friend list to where the reactor set lives), or a fan-out design whose write cost is justified; screening with confirmation for very large sets; never-overstate counts; serving-time block and visibility checks; invalidation within a minute; hot-post replication; adapts to each incident with diagnosis, recovery and prevention.
