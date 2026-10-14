# Apple · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a company that
makes phones, watches and computers and runs an app store, subscriptions, a music
service and repair and trade-in programmes. Every workload, number, schema and
incident is hypothetical. Where a public product rule is used, it is stated as
this exercise's rule; check current documentation. Nothing here describes any
company's internal systems or what any device records.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## APL-L3-01: Subscription groups — levels, upgrades, downgrades, crossgrades, offers and family sharing

| | |
|---|---|
| **Template ID** | APL-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / subscription chains, billing periods versus entitlement, scheduled changes, offer eligibility, shared access |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "subscribers": {"1": ["2 million"], "2": ["15 million", "40 million"], "3": ["150 million", "400 million"]},
  "levels": [3, 4, 6],
  "storefronts": [40, 120, 175],
  "family_share": ["10%", "25%"]
}
```

**Business Scenario.** A developer sells auto-renewable subscriptions through an app store to about {{subscribers}} active subscribers in {{storefronts}} storefronts. Its products sit in one subscription group ranked into {{levels}} levels of service (level 1 is the highest). This exercise's rules, modelled on public store documentation (check current docs): a customer has at most one active subscription in a group; an upgrade to a higher level takes effect immediately and the unused part of the current period is refunded pro rata; a downgrade takes effect at the next renewal date; a crossgrade to another product of the same level takes effect immediately when the durations match and at the next renewal otherwise. An introductory offer (a free trial, pay as you go, or pay up front) can be redeemed once per customer per group; promotional offers are for current or lapsed subscribers. The developer has turned on family sharing, so a purchaser's subscription also gives access to family members; about {{family_share}} of entitled users are family members, not purchasers. The developer learns about all of this from the store's server notifications and its own app accounts; in this exercise every notification carries a unique id, a signed date and an original transaction id that stays the same for a customer's chain in the group.

**Problem Statement.** Design the data model the developer's data team builds from those notifications. Cover: the product catalogue (group, level, product, duration, price per storefront over time); the subscription chain per customer and group; billing periods (product, level, start, end, price, currency, offer applied) versus entitlement (what the customer could actually use at any instant); scheduled changes (a pending downgrade or crossgrade that is not yet effective); refunds and revocations; introductory and promotional offer redemptions and the eligibility decision for each; family-shared access. Then define the facts that answer "active paid subscribers by level and storefront per day", "trial-to-paid conversion by offer and storefront", "monthly moves between levels (upgrades, downgrades, crossgrades)", "family members versus purchasers" and "revenue per day by level", and say at which grain each lives.

**Constraints.** A chain's billing periods never overlap: at any instant a customer has at most one effective product in the group. A scheduled change is not effective until its date and can be cancelled before then. History must be reconstructable as it was known at any time. Money is integer minor units per currency; currencies are never added. Notifications arrive late, more than once and out of order. Any intro-offer eligibility decision can be explained from stored data.

**Assumptions.** Subscriber counts, levels, storefront counts and shares are hypothetical. The proration and offer rules are this exercise's, modelled on public documentation. Store commission and taxes are out of scope (another exercise covers proceeds). The developer sees only what the notifications and its own app accounts tell it; family members appear as their own entitlement records, marked as family-shared and linked to the purchaser's chain.

**Clarifications.**
- Q: Is a customer on a free trial a paid subscriber? | A: No. Report trials separately; define "paid" precisely.
- Q: What money moves on an upgrade in the middle of a month? | A: In this exercise, the unused part of the old period is refunded pro rata and the new level is charged for a full period from the upgrade instant, which also becomes the new renewal date.
- Q: Does a downgrade change today's access? | A: No. It is scheduled: the customer keeps the higher level until the renewal date, and can cancel the scheduled change before then.
- Q: Do family members count as subscribers? | A: Your choice, but they never carry revenue and must be reportable separately from purchasers.
- Q: What does a refund do to access? | A: In this exercise a refund revokes access from the refund time and returns that period's money; access before the refund was real and stays in the history.

**Hints.**
1. Separate three things: the chain (customer × group, keyed by the original transaction id), the billing periods (one row per period with its product and price), and the raw notifications as received.
2. Entitlement is derived: at an instant, the period whose [start, end) contains it, cut short by any revocation. A scheduled change is its own record that becomes a period only when it takes effect.
3. Eligibility is per customer per group, not per product: keep redemptions so any decision can be replayed.

**Follow-ups.**
1. Walk one customer: a free trial at level 3, converts to paid, upgrades to level 1 on day 10 of a monthly period, schedules a downgrade to level 2, renews. List the period rows, the scheduled-change row and every money movement.
2. Define "active paid subscribers by level on a date" precisely. A refund arrives 20 days after a period started: do you restate the past days' counts, and how is the report labelled?
3. Build the monthly level-move matrix. Does a crossgrade to a yearly product at the same level count as a move, and in which month: when it was chosen or when it took effect?
4. At {{subscribers}} subscribers, how do you build the daily active snapshot from the period table cheaply, and what does a notification that arrives three days late change?
5. The purchaser downgrades and later is refunded. What happens to each family member's access, to the "family members" count and to revenue per subscriber?

**Follow-up rules.**
- when: current_level, status column, overwrite, latest state → ask: The customer upgraded on the 10th and scheduled a downgrade for the 28th. With one current-level column, what did they have on the 12th, and what will they have on the 28th?
- when: free trial, trial → ask: Is a trial user a paid subscriber in your daily count? And can the same customer redeem another introductory offer on a different product in the same group?
- when: family, family sharing → ask: Who is charged, who is entitled, and what happens to a family member's access when the purchaser is refunded?
- when: notification, webhook → ask: A renewal notification arrives before the upgrade notification it follows. What do you store, and how does the period table end up right?
- when: prorate, proration, pro rata → ask: Where does the pro-rata refund live — on the old period, as a separate money event, or both — and how does revenue per day treat it?

**Production Reality Check.**
- Upgrade notifications delivered out of order created overlapping periods for some chains. Active subscribers summed over the {{levels}} levels exceeded total subscribers, and the overlap went unnoticed for a week.
- Customers who crossgraded within the group were offered an introductory offer a second time because redemptions were keyed by product, not group. It happened across all {{storefronts}} storefronts before support noticed.
- Revenue per subscriber dropped by about {{family_share}} the day family-shared entitlements were added to the subscriber denominator. Leadership read it as a pricing problem.

**Evaluation Criteria.** Chain, periods and notifications kept apart; non-overlapping periods enforced; entitlement derived from periods and revocations; scheduled changes as their own records; upgrade, downgrade and crossgrade timing exactly as stated; proration as money events; eligibility per customer per group with replayable redemptions; family-shared access without revenue; facts at stated grains with a precise paid-subscriber definition; late and out-of-order notifications handled idempotently; each incident contained, corrected and guarded.

## APL-L3-02: Device lifecycle — activation, transfers, repairs, part replacements and trade-ins, as of a date

| | |
|---|---|
| **Template ID** | APL-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / bitemporal intervals, serialised parts, ownership history, late records, data minimisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "devices": {"1": ["20 million"], "2": ["300 million"], "3": ["1 billion", "2 billion"]},
  "repairs_per_day": ["40,000", "250,000"],
  "late_record_days": [3, 14, 30],
  "markets": [30, 60]
}
```

**Business Scenario.** A device maker sells phones, tablets, laptops and watches in {{markets}} markets, with about {{devices}} devices in its records. Every device has a serial number. In this exercise: a device is activated by its first owner's account; it can change hands (sold, gifted, handed on in a company), and the next owner's activation starts a new ownership; it can be repaired by the maker or by independent and authorised repair providers, about {{repairs_per_day}} repairs a day, and a repair can replace parts (display, battery, camera, main board) that carry their own serials; a whole-unit replacement gives the customer a different device with a new serial and retires the old one; a trade-in returns the device for credit, after which it may be refurbished, with parts harvested or replaced, and sold again. Coverage plans attach to a device for a period. Records come from sales, activation, repair providers (whose records can arrive up to {{late_record_days}} days after the repair) and trade-in partners. Support, warranty, product quality and finance teams all ask "what was true about this device on a date".

**Problem Statement.** Design the data model. Cover: device identity (serial, model, configuration) and the link between a retired serial and its replacement; ownership intervals; part installations as intervals per device and part slot; coverage intervals; the lifecycle events (activation, transfer, repair, replacement, trade-in, refurbishment, resale) and how they relate to the intervals; how a correction or a late record is stored so that both "what was true on the 5th" and "what did we know on the 5th" can be answered. Define the facts that answer "battery replacements per 1,000 devices by model and device age", "share of repairs done under coverage", "refurbished devices resold per month" and "devices in use per model per month", and say what an analyst may and may not see about owners.

**Constraints.** At any valid time a device has at most one owner and each part slot holds at most one part; a part serial is installed in at most one device at a time. Corrections never overwrite: they are new records with their own recorded time. Analysts never see owner identity, only a pseudonymous owner key that can be erased on request without breaking the device's history. Late records must not silently change a published monthly report.

**Assumptions.** Device counts, repair volumes, delays and market counts are hypothetical. The lifecycle rules are this exercise's. "In use" means activated and not retired, traded in or reported lost; it is not inferred from any device signal.

**Clarifications.**
- Q: Is the owner the purchaser? | A: Not necessarily: gifts, company-bought devices and second-hand sales all happen. Ownership here starts with an account's activation and ends with removal, transfer or trade-in.
- Q: Can a part move from one device to another? | A: Yes, during refurbishment a harvested part can be installed in another device. Its serial must not appear in two devices at once.
- Q: A repair record arrives weeks late and says the battery was replaced on the 2nd. Which date counts? | A: The repair happened on the 2nd (valid time). Reports produced before the record arrived did not know it (recorded time). You need both.
- Q: Can an analyst look up who owned a device? | A: No. Analysts see a pseudonymous owner key; support sees identity only within a customer case.
- Q: What does a whole-unit replacement do to the history? | A: The old serial is retired with a link to the new serial; the customer's coverage moves to the new device in this exercise.

**Hints.**
1. Keep the device (what it is) apart from intervals (who owned it, which part was in which slot, which coverage applied), each with valid_from and valid_to.
2. Add recorded_from and recorded_to to interval rows (bitemporal), so a late repair adds a row instead of rewriting one.
3. Events explain why an interval opened or closed; store them too, with keys from interval to event.

**Follow-ups.**
1. Show the rows for one serial: activated by owner A, battery replaced, sold to owner B, display replaced under coverage, traded in, display harvested into another device, refurbished with a new display and sold to owner C.
2. A repair record arrives {{late_record_days}} days late. What changes in last month's battery replacement rate, and how do you publish the restated number next to the original?
3. A whole-unit replacement retires serial X and issues serial Y. How do "devices in use", device age and the customer's repair history connect across the two serials?
4. Owner B asks for their data to be erased. What is deleted, what is kept, and what does the device's history look like afterwards for owner C's warranty claim?
5. At {{devices}} devices with several serialised parts each, estimate the part-interval history and show how "which parts were in this device on a date" stays fast.

**Follow-up rules.**
- when: owner_id, current_owner, owner column → ask: Owner B sold the device to owner C last month. With one owner column on the device row, who owned it when the display was replaced, and who sees that?
- when: scd, type 2, valid_from, effective date → ask: Is your valid_from the date the change happened or the date you learned about it? How do you reproduce last month's report exactly as published?
- when: erase, gdpr, delete the owner, right to be forgotten → ask: After erasure, how does the next owner's warranty claim still see that the device had a display replaced under coverage?
- when: event sourcing, event log, replay → ask: Support needs "parts in this device on the 3rd" in milliseconds. Do they replay every event, or is something materialised, and how is it kept equal to the log?
- when: serial as key, serial primary key, primary key serial → ask: A whole-unit replacement issues a new serial for the same customer case, and a harvested part carries its own serial. Which keys does your model use for the device, the part and the case?

**Production Reality Check.**
- A repair provider's feed was down for {{late_record_days}} days. The weekly battery replacement rate for one model dipped, a quality review used the low number, and the backfill then raised it above the trend.
- After a refurbishment batch, one display serial appears installed in two devices for overlapping periods: the harvest was recorded as an installation in the new device without closing the old one.
- An erasure request deleted owner rows instead of the identity behind the pseudonymous key. The device's ownership intervals disappeared, and the next owner's coverage check failed in {{markets}} markets' support tools.

**Evaluation Criteria.** Device identity separated from ownership, part and coverage intervals; bitemporal rows (valid and recorded time) so late records add rather than overwrite; non-overlap constraints per device, slot and part serial; events linked to the intervals they change; replacement serials linked; erasure that removes identity but keeps device history; facts with stated grains, denominators and a restatement policy; each incident contained, corrected and guarded.

## APL-L3-03: Music catalogue identity — one recording on many releases, plays counted once

| | |
|---|---|
| **Template ID** | APL-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / entity resolution, work–recording–release–track, many-to-many credits, cluster merges and restatement |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "catalogue_tracks": ["100 million", "150 million"],
  "daily_plays": {"1": ["300 million"], "2": ["2 billion"], "3": ["10 billion", "20 billion"]},
  "sources": [60, 400],
  "dup_share": ["2%", "6%"]
}
```

**Business Scenario.** A music streaming service ingests catalogue deliveries from labels and distributors ({{sources}} sources here) into a catalogue of about {{catalogue_tracks}} tracks. A delivery describes a release (album, single, EP, compilation, deluxe edition, remaster) identified by a UPC, with its tracks; each track carries an ISRC identifying the recording, artist credits with roles (primary, featured, remixer), and, when known, the ISWC of the underlying musical work. The same recording appears on several releases: the single, the album, a compilation, a deluxe edition. In this exercise a remaster, a live version, a radio edit and the clean version of an explicit track are each a different recording. About {{dup_share}} of recordings arrive more than once from different sources with different identifiers or slightly different metadata, and occasionally two different audio files carry the same ISRC. Listeners play about {{daily_plays}} tracks a day. Charts, artist dashboards and the recommendation team all count plays: per recording, per "song" (all versions of a work by an artist), per release and per artist.

**Problem Statement.** Design the catalogue and play model. Cover: the entities (work, recording, release, track as release × disc × position, artist, credit) and their keys; how source identifiers (ISRC, UPC, ISWC, each source's own ids) are stored and why they are or are not primary keys; deliveries, updates and takedowns as versions; the identity clusters that group duplicate recordings, and the separate grouping of versions into a song; how a cluster merge or split is recorded and applied. Then define the play fact (grain, keys, what it stores at play time) and how plays roll up to recording, song, release and artist without counting a play twice or splitting one recording's plays across duplicates. Say when a month's counts are final and how a later merge is handled.

**Constraints.** Each play is counted exactly once at each level of the hierarchy. A play keeps what was played (the track) even if the catalogue later changes. Cluster merges and splits are reversible and auditable. Artist reports for a closed month change only through a documented restatement. A takedown removes availability, not history.

**Assumptions.** Catalogue sizes, play volumes, source counts and duplicate shares are hypothetical. ISRC, UPC and ISWC are the public industry identifiers for recordings, releases and works; how any streaming service uses them internally is not part of this exercise. Royalty calculation is out of scope.

**Clarifications.**
- Q: Is a remaster the same song? | A: It is a different recording. Artist dashboards want song totals that include remasters and live versions; charts may want recordings. Define both levels.
- Q: What does a play event identify? | A: The track the listener played (a position on a release). The recording, song and artists are derived.
- Q: Can an ISRC be wrong? | A: Yes. Two different audio files can arrive with the same ISRC, and the same audio with two. Treat identifiers as evidence.
- Q: How are plays split between a primary and a featured artist? | A: For artist play counts, each credited artist gets the full play; for anything summed across artists you must not add those up as if they were plays. Say how your model prevents it.
- Q: When is a month final? | A: When its artist reports are published, a few days after month end.

**Hints.**
1. Mint internal ids for recordings, releases and works; keep source identifiers as attributes with their source and confidence.
2. Store the track id on the play. Map track → recording → cluster → song through mapping tables that are versioned in time, so a merge changes the mapping, not the play log.
3. Credits are many-to-many. Joining plays to credits multiplies rows: decide which metrics allow it (per-artist counts) and which must count distinct plays.

**Follow-ups.**
1. Draw the rows for one song released as a single, on the album, on a compilation, and remastered on a deluxe edition. Ten plays are spread across the four. Give the counts per recording, per song and per release.
2. Two recordings from different sources are found to be duplicates and merged. What happens to last month's published artist report, and to this month's?
3. A track has one primary and two featured artists. What do the artist dashboards show, and what does a "total plays across all artists" query return?
4. At {{daily_plays}} plays a day, do you resolve the recording at ingestion, at query time, or both? How do you restate after a merge without rewriting the play log?
5. A distributor delivered a compilation whose tracks reuse the album's ISRCs but contain radio edits. How do you detect it, and how do you move the plays already counted?

**Follow-up rules.**
- when: isrc → ask: Two different audio files arrive with the same ISRC from two sources. Which recording do plays of each belong to, and what does your key structure do with the collision?
- when: merge, dedupe, deduplicate, duplicate → ask: After a merge of two recordings, last month's song totals change. Do you rewrite the published month, restate it, or only apply the merge going forward?
- when: credits, artist_id, featured → ask: Your artist rollup joins plays to credits. What does the sum of plays over all artists equal now, and which reports must never use that sum?
- when: denormalize, denormalized, one big table, wide table → ask: Your play table stores the song and artist at write time. A cluster merge happens. How many rows do you rewrite, and how do you reproduce last month's numbers?
- when: upc, release_id → ask: The same recording is on four releases. A chart wants the song's plays this week regardless of release. Which key do you group by, and where does it come from?

**Production Reality Check.**
- A batch of duplicate clusters (about {{dup_share}} of recordings) was merged mid-month. Artist dashboards for the previous, already published month changed overnight because the rollup read the current mapping.
- A distributor's compilation reused the album's ISRCs for its radio edits. With {{sources}} sources delivering and no check of audio against identifiers, plays of the edits were counted as the album versions, and the song chart moved.
- Artist-level totals summed in a label summary exceeded total plays by a third: featured-artist credits multiplied plays in a join, and the summary was published.

**Evaluation Criteria.** Work, recording, release and track separated with internal keys; source identifiers kept as evidence, not primary keys; duplicate clusters and version-to-song grouping as versioned mappings; plays stored at track grain and rolled up through mappings so a play is counted once at each level; credit fan-out understood and fenced off; merges and splits reversible with an explicit restatement policy for published months; each incident contained, corrected and guarded.

## APL-L3-04: App review submissions — builds, versions, decisions, resubmissions and time in review

| | |
|---|---|
| **Template ID** | APL-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / workflow state history, review episodes, durations from transitions, rates with clear denominators |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "submissions_per_week": {"1": ["20,000"], "2": ["100,000", "150,000"], "3": ["150,000", "300,000"]},
  "rejection_share": ["15%", "25%"],
  "platforms": ["phone and desktop", "phone, tablet, desktop, TV and watch"],
  "expedite_share": ["1%", "3%"]
}
```

**Business Scenario.** On an app store's developer platform, developers upload builds (each with a build number unique within its version), create an app version with a marketing version string, attach a build per platform and metadata (screenshots, description, privacy details), and submit it for review. This exercise's process, modelled on public developer documentation (check current docs): a submission waits for review, is in review, and ends approved (released at once or held for the developer to release), rejected with one or more guideline references and a message, rejected for metadata only (fixable without a new build), or removed by the developer. A developer can reply, fix and resubmit, upload a new build, or request an expedited review. A submission can carry several items (the app version, in-app purchases, in-app events). There are about {{submissions_per_week}} submissions a week across {{platforms}} platforms; about {{rejection_share}} of first submissions of a version are rejected and about {{expedite_share}} of submissions are expedited. The platform publishes review-time statistics, and each developer sees their own history.

**Problem Statement.** Design the data model. Cover: app, platform, version and build; the submission and its items; the state history of each submission; review episodes (one pass through review, from entering the queue to a decision) and their decisions; guideline citations; messages between developer and reviewer (stored as references, not analysed); resubmission links; expedite requests. Then define, with exact start and stop events, "time waiting", "time in review" and "time from first submission to approval" per version; "first-pass approval rate"; "rejections by guideline"; "resubmissions per approved version"; and the weekly percentile published as "most submissions are reviewed within N hours". Say which views a developer sees and which only the platform sees.

**Constraints.** State history is append-only with timestamps in UTC. A version can be submitted many times; each submission has exactly one build per platform. Durations are computed from transitions, never typed in. Published weekly statistics are reproducible. Events can arrive late or twice. A developer sees only their own apps; reviewer identities are never exposed in developer views or in published statistics.

**Assumptions.** Volumes, shares and platform lists are hypothetical. State names are this exercise's. Message contents are out of scope for analytics. The review tools themselves are not part of the design.

**Clarifications.**
- Q: Does "time in review" include time in the queue? | A: No. Define waiting and in-review time separately; developers mostly care about the total.
- Q: Is a metadata-only rejection a new submission when fixed? | A: In this exercise, the fix continues the same submission with a new review episode. State how your rates treat it.
- Q: Is a submission the developer removed before review a rejection? | A: No. It is its own outcome. Decide whether it is in any denominator.
- Q: Can one rejection cite several guidelines? | A: Yes, often two or three.
- Q: Which week does a submission belong to in the published statistic? | A: Your choice: the week it entered the queue or the week it was decided. State it and why.

**Hints.**
1. Separate the version (what is being shipped), the build (the binary), the submission (a request to review) and the review episode (one pass through review). Durations come from the transitions.
2. Write each duration as a pair of events, and state what stops the clock (waiting on the developer is not review time).
3. Every rate needs a stated denominator and cohort; first pass means the first episode of a version, not of a submission.

**Follow-ups.**
1. Walk one version: build 41 submitted, rejected citing two guidelines, developer replies, build 42 uploaded and submitted, rejected for metadata only, metadata fixed, approved, held for developer release, released. List the rows and every duration.
2. Define the weekly "most submissions are reviewed within N hours" statistic: which percentile, which durations, which cohort, and when is a week final?
3. First-pass approval rate: what is the denominator when developers remove submissions before review, and when a version is approved only after a metadata fix?
4. At {{submissions_per_week}} submissions a week, how do you serve each developer's history and the platform-wide percentiles, and what is precomputed?
5. Expedited reviews (about {{expedite_share}}) jump the queue. How do you keep them from flattering the published waiting-time statistic, or should they?

**Follow-up rules.**
- when: status column, current_status, update status → ask: A submission was rejected, fixed and approved. With one status column, how do you compute how long it waited before each decision?
- when: average, avg, mean → ask: Review times are skewed. What does one submission stuck for nine days do to your weekly average, and what would you publish instead?
- when: rejection rate, approval rate → ask: What exactly is the denominator: submissions, review episodes or versions? Where do developer-removed submissions go?
- when: guideline → ask: One rejection cites three guidelines. Is that one rejection or three in "rejections by guideline", and what does the total across guidelines mean?
- when: resubmission, resubmit, resubmitted → ask: How is a resubmission linked to the rejected one when the developer uploads a new build, and when they only fix metadata?

**Production Reality Check.**
- The published median time in review doubled overnight: an upstream release renamed a state, and the duration job started counting waiting time as review time for {{platforms}} submissions alike.
- The first-pass rejection rate, usually about {{rejection_share}}, fell sharply overnight and the team celebrated: metadata-only fixes had started arriving as new submissions, and each approved fix was counted as the first pass of a version.
- In a holiday week, expedited reviews (normally about {{expedite_share}}) multiplied. The published waiting time improved while ordinary submissions waited longer than ever.

**Evaluation Criteria.** Version, build, submission and review episode modelled separately; an append-only, deduplicated state history; durations defined as pairs of events with clear clock-stops; rates with explicit denominators and cohorts; guideline citations as a many-to-many table with counting rules; resubmission links; percentiles over skewed durations with a stated finality; developer-scoped views without reviewer identity; each incident contained, corrected and guarded.

## APL-L3-05: Phased release adoption — devices on the new build, day by day

| | |
|---|---|
| **Template ID** | APL-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / date spine, state from an action log, running counts that skip paused days, device-day grain |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | APL-L3-05.mjs |

**Business Scenario.** A developer ships an update to {{app_count}} through an app store's phased release. This exercise's rule, modelled on public developer documentation (check current docs): an update reaches devices with automatic updates on over seven phase days, at the percentages in `phase_schedule` (phase day 1 is 1%, phase day 7 is 100%); the developer can pause and resume, and can release to everyone at any time; anyone can still update by hand from the store, so adoption can run ahead of the schedule. The developer's analytics team wants, for every day of each release, how much of the active device base is really running the new code. The model: `apps`, `app_builds` (every build with its version string and an increasing `build_number`), `phase_schedule`, `phased_release_log` (one row per action: `start`, `pause`, `resume`, `release_all`, at most one per app per date) and `app_sessions` (one row per session, with the version it ran). {{day_rule}}

**Problem Statement.** Write one PostgreSQL query that returns `app_id, activity_date, phase_day, release_state, release_pct, active_devices, devices_on_new, share_on_new`: one row per app and date, from the date of the app's `start` action through the date its phased release ends, but never after `{{report_end}}`, ordered by `app_id, activity_date`. A date's `release_state` comes from the latest log action on or before it: `start` or `resume` → `active`, `pause` → `paused`, `release_all` → `complete`. `phase_day` is the number of active dates from the start date through this date (a paused date does not advance it). `release_pct` is the `phase_schedule` percentage for `phase_day`, or 100 when the state is `complete`. The phased release ends on the first date whose `phase_day` is 7 or whose state is `complete`; that date is the last row. `active_devices` is the number of distinct devices with a session for the app on that date, and `devices_on_new` how many of them had at least one session that date on the build in the log (the phased build) or a later build of the same app (a higher `build_number`). `share_on_new` is `100 × devices_on_new / active_devices` rounded to 2 decimal places, or NULL when no device was active; such a date still appears, with 0 and 0.

**Constraints.** One SQL statement (CTEs allowed). Each app has exactly one phased release in the log. Every session's `app_version` is listed in `app_builds`. The sample has {{sessions}} sessions; a production version of this report reads billions of session rows a day.

**Assumptions.** Hypothetical apps, versions, builds, devices and sessions; the seven-day schedule is this exercise's. `device_id` is a pseudonymous identifier from the developer's own analytics, meaningful only within this data set. Devices never go back to an older build.

**Clarifications.**
- Q: A device ran the old version in the morning and the new one after updating at noon. Is it on the new build that day? | A: Yes. At least one session on the phased build or later is enough.
- Q: Does a paused date appear? | A: Yes, with state `paused`, and the same `phase_day` and `release_pct` as the active date before it.
- Q: What is `phase_day` on the `release_all` date? | A: The number of active dates before it; that date is not active. Its `release_pct` is 100 and it is the last row.
- Q: Should dates with no sessions at all appear? | A: Yes, with `active_devices` 0, `devices_on_new` 0 and a NULL share. A missing date looks like a gap in the rollout chart.
- Q: Do sessions before the start date matter? | A: No row comes before the start date. They are in the table only because devices were active then.

**Hints.**
1. Build the dates first: `generate_series` from each app's start date to the report end. Attach the latest log action on or before each date (a LATERAL subquery with ORDER BY … LIMIT 1 works), then a running `COUNT(*) FILTER (WHERE …)` gives `phase_day`.
2. Reduce sessions to one row per app, date and device with `BOOL_OR(…)` before counting anything; then LEFT JOIN that to the dates.
3. The end date depends on the running count, so compute it in a window over the finished calendar (`MIN(date) FILTER (…) OVER (PARTITION BY app_id)`) and filter after it.

**Follow-ups.**
1. The developer paused because crash reports rose on the new build. What would you add to this query to compare crash-free sessions on the new and old builds per day, and why is a 1% phased cohort plus manual updaters not a random sample?
2. How much of `share_on_new` is the phased release and how much is people updating by hand? What can and can't this data tell you?
3. At billions of sessions a day, what daily rollup would you keep so this report runs in seconds, and what does a session that arrives two days late do to a day already published?
4. From this output, define "days to 90% adoption" per release so that releases with and without pauses can be compared fairly.

**Follow-up rules.**
- when: count(*) → ask: After your LEFT JOIN to the dates, what does COUNT(*) return for a date with no sessions, and does it count devices or sessions?
- when: row_number, rank, dense_rank, date difference → ask: If phase_day comes from numbering the dates since the start, what does a paused date do to it, and to the date the release ends?
- when: text, string, max(app_version) → ask: As text, how do '…9.6' and '…10.0' compare, and what happens when a hotfix build ships after the phased build?
- when: inner join → ask: Which dates disappear when the calendar is inner-joined to sessions, and why are those the dates a rollout chart most needs?
- when: utc, at time zone → ask: For an app that reports in Asia/Kolkata, which date does a session at 20:00 UTC belong to, and in which zone are the log's dates?

**Production Reality Check.**
- After a pause for a crash spike, a dashboard that numbered days since the start showed the release at 50% when the schedule had reached 5%. The go/no-go call for the next phase was made on that number.
- An analytics SDK update began sending versions with a build suffix for some sessions. Those sessions matched no row in `app_builds`, an inner join dropped them, and the share on the new build fell on the day a fix was being judged.

**Evaluation Criteria.** A date spine from the log so empty and paused dates appear; state from the latest action on or before each date; `phase_day` as a running count of active dates only; the end date from the first day 7 or `release_all`, capped by the report end; sessions reduced to the device-day grain with "any session on the phased build or later" by `build_number`; at the hardest level, dates in each app's report time zone and no text comparison of versions; numeric division with NULL for no devices; deterministic ordering; can discuss crash comparisons, manual updates and late data.
