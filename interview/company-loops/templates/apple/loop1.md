# Apple · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domains of a consumer devices
and services company: an app marketplace, auto-renewing subscriptions and a music
streaming service. Every workload, number, rule and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## APL-L1-01: Product page conversion by storefront and traffic source

| | |
|---|---|
| **Template ID** | APL-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first-event detection with ROW_NUMBER, last-touch attribution with LATERAL, distinct denominators |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | APL-L1-01.mjs |

**Business Scenario.** An app marketplace shows developers how well each app's product page converts: of the people who viewed the page, how many downloaded the app for the first time. Developers break the number down by storefront (the country or region store) and by traffic source: search, browse, a referring app or a referring website. Re-downloads, where someone reinstalls an app they already had, are not new customers and must not inflate the rate. You are writing the query behind the report.

**Problem Statement.** Write one PostgreSQL query that returns `app_id, storefront, source, viewers, downloads, conversion_rate`, ordered by `app_id, storefront, source`. `viewers` is the number of distinct `account_id`s with at least one `page_views` row for that app, storefront and source. A download is a **first-time download** if it is the account's earliest download of the app (earliest `downloaded_at`, then lowest `download_id`); every other download is a re-download and is ignored. A first-time download is credited to the `source` of the account's **last** view of that app's page in the download's storefront at or before `downloaded_at` (latest `viewed_at`, then highest `view_id`); a first-time download with no such view is unattributed and counts nowhere. `downloads` counts the first-time downloads credited to the group, and `conversion_rate = downloads / viewers`, rounded to 4 decimal places. {{window_rule}} {{redownload_rule}} {{floor_rule}}

**Constraints.** One SQL statement (CTEs allowed). Groups with viewers but no credited downloads appear with 0 downloads. A view in the same second as the download is "at or before" it. The sample has {{views}} page views and {{downloads}} downloads.

**Assumptions.** Hypothetical apps, accounts, storefront codes and traffic. The attribution rule is this exercise's simplification, not how any store's analytics attributes downloads. Accounts are pseudonymous identifiers; viewers who are not signed in are out of scope.

**Clarifications.**
- Q: Someone viewed the page from search, later from a referring website, then downloaded. Which source gets the download? | A: The website: the last view at or before the download.
- Q: Does a re-download after deleting the app count? | A: No. Only the account's first download of the app counts, ever.
- Q: A first-time download has no earlier view of the page in its storefront. | A: It is unattributed and counts in no group. The account can still be a viewer.
- Q: An account viewed the page only after downloading. Is it a viewer? | A: Yes. `viewers` counts every distinct account that viewed the page from that source.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` of downloads over viewers, half away from zero.

**Hints.**
1. Find first-time downloads with `ROW_NUMBER() OVER (PARTITION BY account_id, app_id ORDER BY downloaded_at, download_id)`. Think about what adding `storefront` to that partition would do.
2. For each first-time download pick exactly one view: a `LATERAL` subquery with `ORDER BY viewed_at DESC, view_id DESC LIMIT 1`, or `DISTINCT ON` over the joined candidates.
3. Build the denominator on its own (distinct accounts per app, storefront and source) and LEFT JOIN the credited downloads onto it, so groups without downloads survive.

**Follow-ups.**
1. Developers want the rate by day. Does a conversion belong to the day of the view or of the download, and what happens to a view on Monday that converts on Tuesday?
2. Last-view attribution gives all the credit to the final touch. How would you report a first-touch view alongside it, and how would you explain to a developer why the two disagree?
3. Many viewers are not signed in. How would you estimate their conversion without linking identities, and what minimum count would you require before showing a small storefront's rate?
4. At billions of page views a day, how would you find the credited view for each download without a join that touches every view?

**Follow-up rules.**
- when: partition by account_id, app_id, storefront → ask: An account downloaded the app in one storefront and later in another. Is the second download a first-time download in your query?
- when: count(*), count(view_id) → ask: An account viewed the page three times from search. How many viewers is that in your denominator?
- when: min(viewed_at), first view, first touch → ask: The rule credits the last view before the download. Which source does your query credit for someone who found the app in search and came back from a website?
- when: inner join, join downloads → ask: Where in your result does a source with viewers but no downloads go?
- when: < downloaded_at, strictly before → ask: A view and the download happen in the same second. Does your condition credit that view, and should it?

**Evaluation Criteria.** First-time downloads detected across storefronts with a deterministic tie-break; one credited view per download, the last at or before it in the same storefront; the attribution window inclusive (Hard+); distinct viewers as the denominator with zero rows kept; duplicate download rows collapsed, the view tie broken by `view_id` and the floor applied (Very Hard); correct rounding and order; can discuss date attribution, alternative credit models, signed-out viewers and scale.

## APL-L1-02: Billing retry recovery within N days, grace period included

| | |
|---|---|
| **Template ID** | APL-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / episodes from an event stream with a running-sum split, inclusive interval windows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | APL-L1-02.mjs |

**Business Scenario.** When an auto-renewing subscription's renewal payment fails, an app store keeps retrying the payment for a while (billing retry). A developer can also offer a billing grace period, during which the subscriber keeps access while the store retries. A developer dashboard reports, per plan and storefront, how many subscriptions entered billing retry, how many recovered (renewed successfully) within {{n_days}} days, and how many of those recovered during the grace period. The retry and grace rules here are this exercise's; check current documentation for any real store's.

**Problem Statement.** Write one PostgreSQL query that returns `plan_id, storefront, entered, recovered, recovered_in_grace, recovery_rate`: one row per plan and storefront with at least one counted episode, ordered by `plan_id, storefront`. Read each subscription's `billing_events` in `event_ts, event_id` order. A `renewal_failed` event while the subscription is not already in billing retry **opens an episode**; further `renewal_failed` events while it is open are retry attempts. The episode **closes** at the next `renewed` event (it recovered then) or `expired` event (it did not). An episode is **recovered** if it closed with `renewed` at most {{n_days}} days after it opened: the {{n_days}} days count from the failed renewal that opened it, grace period included. It is **recovered in grace** if it is recovered, its plan's `grace_days` is greater than 0, and the renewal came at most `grace_days` days after it opened. `entered` counts episodes; `recovery_rate = recovered / entered`, rounded to 4 decimal places. {{episode_rule}} {{plan_rule}}

**Constraints.** One SQL statement (CTEs allowed). Both windows are inclusive: exactly {{n_days}} days (or exactly `grace_days` days) after opening still counts. An episode still open in the data counts in `entered` and not as recovered. The tables are a snapshot taken at `{{as_of}}`. The sample has {{subs}} subscriptions and {{events}} billing events.

**Assumptions.** Hypothetical plans, grace periods, storefronts and events. A day is 24 hours in UTC. Price increases, refunds, family sharing and voluntary cancellations are out of scope.

**Clarifications.**
- Q: A renewal fails, fails again three days later, then succeeds. How many entries is that? | A: One episode, recovered. The second failure is a retry attempt inside the open episode.
- Q: Does the {{n_days}}-day window start when the grace period ends? | A: No. It starts at the failed renewal that opened the episode; the grace period is inside it.
- Q: A subscription renews {{n_days}} days and one second after entering retry. | A: That renewal closes the episode, but it is not a recovery within {{n_days}} days.
- Q: A plan has `grace_days = 0`. | A: It has no grace period, so none of its recoveries are in grace.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` of recovered over entered, half away from zero.

**Hints.**
1. A running `SUM(CASE WHEN event_type IN ('renewed', 'expired') THEN 1 ELSE 0 END)` over each subscription's events cuts its history into stretches, each ending at a closing event.
2. Within a stretch, the first `renewal_failed` opens the episode, and the episode's closing event is the one whose running count is one higher.
3. Compare timestamps with intervals (`start_ts + make_interval(days => grace_days)`), not dates, so that the boundaries are exact.

**Follow-ups.**
1. The dashboard shows this by month of entry. Why does the most recent month always look worse, and how would you present it honestly?
2. A developer lengthens the grace period. How would you measure whether recoveries rose because of it rather than because of the season?
3. Billing events arrive as notifications, sometimes late and sometimes twice. How do you keep the episode table idempotent when an old `renewed` arrives after an `expired`?
4. How would you maintain episodes incrementally each day for hundreds of millions of subscriptions without rescanning every history?

**Follow-up rules.**
- when: lead(, next event → ask: The event after a failure is often another failure. How does your query find the event that actually closes the episode?
- when: after the grace period, end of grace, n_days + grace → ask: Where does your {{n_days}}-day window start, and why is the grace period not added on top of it?
- when: expired → ask: A subscription expires, is bought again and renews. Does your query count that renewal as a recovery?
- when: ::date, date_trunc, date( → ask: A renewal lands on the last day of the window but later in the day than the failure. Does comparing dates instead of timestamps change your answer?
- when: count(distinct subscription_id) → ask: A subscription entered billing retry twice in the period. How many entries does your count give it?
- when: latest plan, current plan, last_value → ask: A subscriber changed plans after an episode. Which plan does your query give that earlier episode?

**Evaluation Criteria.** Episodes opened only by the first failure and closed by the next renewal or expiry; the window counted from entering retry with the grace period inside it; inclusive boundaries on timestamps; ordinary renewals and renewals after expiry not counted as recoveries (Hard+); the episode's own plan and immature episodes left out (Very Hard); correct rounding and order; can discuss cohort maturity, measuring a grace-period change and late notifications.

## APL-L1-03: Library adds within seven days of a listener's first listen, per genre

| | |
|---|---|
| **Template ID** | APL-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-pair first events, exclusion before aggregation, bridge-table rollups with a distinct-count floor |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | APL-L1-03.mjs |

**Business Scenario.** A music streaming service wants to know which genres turn first listens into saved music: of the tracks a listener hears for the first time, how many do they add to their library within a week? Tracks the listener had saved before ever listening (from a recommendation or a shared playlist) are not evidence of a listen converting, so they are left out. Small genres are hidden until enough different listeners are behind the number.

**Problem Statement.** Write one PostgreSQL query that returns `genre, listeners, pairs, added, add_rate`, ordered by `add_rate` descending, then `genre`. A **pair** is a listener and a track with at least one listen; its **first listen** is the earliest listen's `played_at`. {{listen_rule}} Take the listener's **earliest** `library_adds` row for that track: if it is before the first listen, the pair is left out entirely; if it is at or after the first listen and no more than 7 days later, the pair is **added**; otherwise (later, or never added) the pair counts as not added. Per genre, `pairs` counts the pairs of its tracks, `added` the added ones, `listeners` the distinct listeners among those pairs, and `add_rate = added / pairs`, rounded to 4 decimal places. Return only genres with at least {{min_listeners}} listeners. {{genre_rule}}

**Constraints.** One SQL statement (CTEs allowed). The window is inclusive at both ends: an add in the same second as the first listen counts, and so does one exactly 7 days (`INTERVAL '7 days'`) later. Adds of tracks the listener never listened to are ignored. The sample has {{plays}} plays and {{adds}} library adds.

**Assumptions.** Hypothetical listeners, tracks, genres and thresholds; the listen rule is this exercise's, not any service's royalty or reporting rule. Removals from the library are not logged; the earliest add is the one that decides.

**Clarifications.**
- Q: A listener saved a track from a playlist, then listened to it a day later. | A: The pair is left out: the earliest add is before the first listen.
- Q: A track was added within the week, removed, and added again a month later. | A: Added. Only the earliest add matters.
- Q: Is the floor on listeners or on pairs? | A: Distinct listeners. One listener with six tracks in a genre is one listener.
- Q: An add exactly seven days after the first listen? | A: It counts: `added_at <= first_listen + INTERVAL '7 days'`.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` of added over pairs, half away from zero. Equal rates are ordered by genre.

**Hints.**
1. Reduce to one row per pair first: the earliest listen and, separately, the earliest add, joined on `(listener_id, track_id)` with a LEFT JOIN.
2. Drop pre-added pairs before aggregating; they belong in neither the numerator nor the denominator.
3. Join pairs to `track_genres` last, and use `COUNT(DISTINCT listener_id)` for the floor.

**Follow-ups.**
1. Product wants the same metric for albums. What is the pair, and what is a "first listen" of an album?
2. Plays from an offline device sync days later. What does that do to the first listen and the window, and how would you keep a published number stable?
3. Is a listener floor enough to protect privacy for a niche genre in a small storefront? What else would you add?
4. At billions of plays a day, how would you keep each pair's first listen and earliest add up to date without rescanning history?

**Follow-up rules.**
- when: max(added_at, latest add, last add → ask: A listener added a track within the week, removed it and added it again a month later. Which add does your query look at?
- when: having count(*), count(*) >= → ask: Your floor counts rows. How many listeners does a genre have if one person played six of its tracks?
- when: 7 days, interval '7 days' → ask: An add happens exactly seven days after the first listen, to the second. Does your comparison count it?
- when: where added_at >=, inner join library_adds → ask: Where does a pair whose track was saved before it was ever played drop out of your query, and does it leave the denominator too?
- when: ms_played → ask: A short preview came first and the real listen a day later. Which one starts your seven-day clock?
- when: track_genres → ask: A track belongs to two genres. How many times does its pair count, and what happens if someone sums your rows into an overall rate?

**Evaluation Criteria.** One row per pair from the earliest listen and earliest add; pre-added pairs excluded from both sides; inclusive 7-day window on timestamps; previews never starting the clock (Hard+); multi-genre tracks counted in each genre (Very Hard); a distinct-listener floor; correct rounding and ordering with the tie-break; can discuss album-level definitions, late offline plays, privacy floors and incremental computation.

## APL-L1-04: Time-synced lyrics: the line on screen at each playback position

| | |
|---|---|
| **Template ID** | APL-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Searching / sort once and binary search, half-open intervals, stable original indexes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | APL-L1-04.mjs |

**Business Scenario.** A music app shows lyrics line by line in time with the song. Each line has a start and an end time; during an instrumental break no line is highlighted. Listeners scrub, jump back to replay a chorus and skip ahead, so the app must find the line for any position quickly, not just the next one. The same lookup runs in batch over sampled playback positions to check lyric timing quality.

**Problem Statement.** Implement `current_lines(lines, positions, duration_ms=None)`. `lines` is a list of `(start_ms, end_ms)` with `0 <= start_ms < end_ms`; a line is on screen at position `p` when `start_ms <= p < end_ms`. {{order_rule}} Apart from corrections that share a start, lines never overlap. `positions` is a list of non-negative integers in the order they were sampled; each can be anywhere relative to the one before (seeks and replays). {{repeat_rule}} Return a list with, for each position, the index in `lines` of the line on screen, or `-1` when no line is.

**Constraints.** Up to 50 000 lines (a long live recording with a synced transcript) and 200 000 positions. Seeks are frequent, so the work per position must not grow with the number of lines.

**Assumptions.** Hypothetical timings. Word-level timing and translations exist in real lyric formats and are out of scope.

**Clarifications.**
- Q: A position equals a line's end. | A: That line is no longer on screen. If another line starts exactly there, it is; otherwise -1.
- Q: Can positions go backwards? | A: Yes, at any time: a listener replays a chorus or scrubs back to the start.
- Q: What if `lines` is empty? | A: Every position gets -1, and no positions gives `[]`.
- Q: Do I return the line's text? | A: No: the index into `lines` exactly as given.
- Q: Can two lines share a start? | A: Only where this round says so; then the one listed later replaces the earlier one completely.

**Hints.**
1. For any position, the only candidate is the line with the largest start at or before it; then check that the position is before that line's end.
2. Sort the starts once, keeping each line's original index, and use `bisect.bisect_right(starts, p) - 1`.
3. Resolve duplicate starts before sorting: a dict from start to index, filled in input order, keeps the last listing.

**Follow-ups.**
1. On a device, positions arrive many times a second during normal play. How would you make the common case O(1) while keeping a seek O(log n)?
2. In a duet, two singers' lines can be on screen at once. What structure returns every line covering a position, and at what cost?
3. A listener sets a sync offset of +300 ms for one song. Where do you apply it so that every boundary stays exact?
4. A batch job checks lyric timing against the audio for millions of songs. How would you distribute it, and what would you measure to flag a badly synced file?

**Follow-up rules.**
- when: for line in lines, linear scan, scan → ask: How many line checks does your solution make for 200 000 positions over 50 000 lines?
- when: pointer, two pointers → ask: What does your pointer do when the listener seeks back to the start of the song every few seconds?
- when: bisect, binary search → ask: Do you use bisect_left or bisect_right, and what does each give for a position exactly at a line's start?
- when: sorted(, sort → ask: After sorting, how do you return the line's index in the original list, and which of two lines with the same start do you keep?
- when: modulo, % duration_ms → ask: What is on screen at a position exactly equal to duration_ms?

**Evaluation Criteria.** Half-open intervals with gaps returning -1; one sort and a binary search per position rather than a scan or a resettable pointer; original indexes preserved; corrections with the same start resolved by the last listing (Hard+); repeat-one positions wrapped (Very Hard); empty inputs handled; a clear complexity argument; credible discussion of the playback fast path, overlapping lines and batch timing checks.

## APL-L1-05: Subscription renewal dates with upgrades and downgrades

| | |
|---|---|
| **Template ID** | APL-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Date arithmetic / month-index math with clamping, event ordering, O(1) jumps instead of simulation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | APL-L1-05.mjs |

**Business Scenario.** An app store sells auto-renewing subscriptions in plans of different service levels and lengths. A subscription renews on the same day of the month it was bought: one bought on 31 January renews on the last day of February, then on 31 March. Subscribers move between plans: in this exercise an upgrade takes effect at once and starts a new period, while a downgrade waits until the next renewal. These rules are this exercise's, loosely modelled on public descriptions of subscription upgrades and downgrades; check current documentation for any real store. Finance needs, for every subscription, the next renewal date and the plan that will renew on it.

**Problem Statement.** Implement `renewals(plans, subs, as_of)`. `plans` maps a plan name to `(tier, months)`: a higher `tier` is a higher service level (no two plans share a tier) and `months` is the plan's period length. Each element of `subs` is `(purchase_date, plan, changes)`, where `changes` is a list of `(date, new_plan)` in date order; all dates are `'YYYY-MM-DD'` strings. A subscription has an **anchor day** and a **period start**, both taken from the purchase date at first. Its renewals fall `months`, `2 × months`, … months after the period start, each on the anchor day or, in a shorter month, on that month's last day. A change to a plan with a higher tier than the plan in effect is an **upgrade**: the new plan is in effect from the change date, which becomes the new period start and anchor day. A change to a lower tier is a **downgrade**: it is pending until the first renewal strictly after the change date; at that renewal the new plan renews, and the next period (of the new plan's length) starts there, with the same anchor day. {{pending_rule}} {{change_rule}} Return a list with one entry per subscription: `(date, plan)`, the first renewal strictly after `as_of` and the plan that renews on it.

**Constraints.** Up to 150 000 subscriptions with a few changes each. The stress test uses synthetic purchase dates going back decades, so the work per subscription must not grow with the number of periods that have passed.

**Assumptions.** Hypothetical plans and tiers. Prices, proration, refunds, free trials and billing retry are out of scope. Dates are calendar dates with no time zone.

**Clarifications.**
- Q: Bought on 31 January on a monthly plan. When does it renew? | A: 28 February (29 in a leap year), then 31 March, 30 April, 31 May: the anchor stays 31, only the month's length clamps it.
- Q: A renewal falls exactly on `as_of`. | A: It is not after `as_of`; return the one after it.
- Q: An upgrade on 30 April from a plan anchored on the 31st. | A: The upgrade re-anchors: from then on the anchor day is 30.
- Q: A downgrade requested on a renewal day. | A: That day's renewal has already happened, so the downgrade waits for the next one.
- Q: A subscription bought on `as_of` itself. | A: Its first renewal, one period after the purchase.

**Hints.**
1. Work in month indexes (`year * 12 + month - 1`). Renewal k falls in month `start + k × months`, on `min(anchor_day, days_in_month)`.
2. The first renewal after a date t is renewal `k = max(1, (month_index(t) - start) // months)` or the one after it; check which.
3. Between changes nothing happens except renewals, so the schedule only needs evaluating at each change date and at `as_of`.

**Follow-ups.**
1. Finance wants every renewal in the next 90 days for all subscriptions, one row each. How would you generate them without stepping from the purchase date?
2. Suppose an upgrade refunds the unused part of the old period. How would you compute that proration, and which day count would you agree with finance?
3. Someone stores only the last renewal date and computes the next as "last renewal plus one month". What goes wrong, and when?
4. Subscribers in different time zones see the renewal on different local dates. Which time zone should the anchor live in, and what changes in this function?

**Follow-up rules.**
- when: timedelta(days=30, days=30, 30 days → ask: A monthly plan bought on 31 January: does adding 30 days give the right renewal in February, and in March?
- when: relativedelta → ask: Adding one month at a time to the previous renewal turns 31 January into 28 February and then 28 March. Where does your code keep the original anchor day?
- when: while, loop until → ask: How many iterations does your loop make for a monthly subscription bought decades before as_of, across 150 000 subscriptions?
- when: monthrange, calendar → ask: How does your clamp handle 29 February on an annual plan in a non-leap year, and does the next leap year get the 29th back?
- when: pending → ask: A downgrade is pending and the subscriber upgrades before it takes effect. What happens to the pending downgrade in your code?

**Evaluation Criteria.** Renewals anchored to the original day and clamped per month, never drifting; the first renewal strictly after `as_of`; upgrades re-anchoring immediately and downgrades taking effect at the next renewal (Hard+); pending downgrades cancelled or replaced correctly and renewals ordered before same-day changes (Very Hard); `None` for future purchases and future changes ignored; O(1) work per subscription plus O(1) per change; credible discussion of proration, materialising future renewals and time zones.
