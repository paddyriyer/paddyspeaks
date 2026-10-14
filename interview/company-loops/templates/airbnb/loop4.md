# Airbnb · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a marketplace
for stays and experiences, with hosts and guests, listings, calendars, bookings,
pricing, search, messaging and reviews. Every workload, number, rule and schema
is hypothetical, and nothing here describes how any company's systems are
actually built.

## ABB-L4-01: Search by date range: availability, total stay price, map area and guests

| | |
|---|---|
| **Template ID** | ABB-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Search serving / availability index, stay pricing, freshness from calendar changes |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "listings": {"2": ["2 million", "4 million"], "3": ["7 million", "10 million"]},
  "qps": {"2": ["3,000", "8,000"], "3": ["25,000", "50,000"]},
  "calendar_updates": ["2,000", "6,000", "15,000"],
  "staleness": ["10 seconds", "1 minute", "5 minutes"]
}
```

**Business Scenario.** Guests search a marketplace of {{listings}} active listings by drawing or moving a map area (or typing a place that resolves to one), choosing check-in and check-out dates and a number of guests, and narrowing by price range, property type and amenities. A result is useful only if the listing can actually be booked for that whole stay: every night free, check-in allowed on that day, the stay within the listing's minimum and maximum nights, inside its advance-notice and how-far-ahead windows, and room for the guests. Each result shows the total price of the stay, built from that listing's nightly prices (a base price, a weekend price, custom prices on particular dates), a length-of-stay discount and a cleaning fee. Searches peak at {{qps}} per second. Calendars and prices change all the time: bookings, cancellations, hosts blocking nights, prices edited by hosts, and calendars synced from channel managers and imported calendar feeds, about {{calendar_updates}} changes per second at peak.

**Problem Statement.** Design the search serving system. Cover the index (how listings are partitioned, and how a year of nightly availability and prices is stored per listing), how a query is answered (map area, guests and filters, then the date-range check, then the total price, then hand-off to ranking), the update path from a calendar or price change to the index within {{staleness}}, how search and booking stay honest with each other, and how map pins and result pages stay stable while the guest pans, zooms and pages.

**Constraints.** First-page search latency p99 under 400 ms, including ranking. A change to a listing's calendar or prices must be reflected in search within {{staleness}} at p99. Search may be slightly stale, but booking must check availability and price exactly against the listing's calendar. Stays of 1 to 90 nights, up to a year ahead. A listing's calendar dates are its own local dates.

**Assumptions.** All volumes, latencies and rules are hypothetical; the price rules (weekend price, custom per-date prices, a weekly discount from 7 nights and a monthly one from 28, a cleaning fee per stay) are this exercise's rules. A calendar service is the source of truth for each listing's nights and settings and emits a change event with a per-listing version for every change. A ranking model exists and takes up to a few thousand candidates with features; you design what reaches it, not the model. Taxes are added at checkout.

**Clarifications.**
- Q: Can search ever show a listing that is no longer available? | A: Only within {{staleness}} of the change. After that it is a bug. Booking re-checks either way.
- Q: Are flexible dates in scope ("a weekend in March")? | A: Not for the first design; it is a follow-up.
- Q: In which currency is the total shown? | A: The guest's. Exchange rates refresh daily; checkout recomputes in the listing's currency.
- Q: How many results does a query return? | A: A first page of 20 to 50 ranked listings, plus pins for up to a few hundred in the visible map area.
- Q: Does the price filter apply to the nightly price or the total? | A: Your choice; say which and why. Guests read it as "what will this stay cost me".

**Hints.**
1. Split the query into the cheap, slowly changing part (area, guests, property type, amenities) and the expensive, fast-changing part (nights and prices for the chosen dates). Keep the second in a compact per-listing structure you can check in constant time.
2. A year of nights fits in a few hundred bits per listing. A stay from day d for n nights is free if bits d to d+n−1 are all set; precomputing, for every day, the length of the free run that starts there makes that one lookup. The rules on check-in day, minimum nights and advance notice are separate checks.
3. A prefix sum over the nightly price array gives any stay's subtotal in one subtraction; the discount and fee are applied afterwards.

**Follow-ups.**
1. Walk me through one query for 3 guests and 5 nights over a dense city centre: which partitions are touched, what is filtered where, and how many candidates reach ranking?
2. A guest books a listing. Trace the change to the index, and say what keeps the update within {{staleness}} and what happens when the update path falls behind.
3. A guest sees one total in search and a higher one at checkout. Where can the two diverge, and how do you bound or explain the difference?
4. Add flexible dates ("any 3 nights in the next 6 weeks"). What changes in the index and the query cost?
5. The guest pans the map and goes to page 3 while availability changes underneath. How do you keep pages without duplicates or gaps, and what do the pins show?

**Follow-up rules.**
- when: elasticsearch, opensearch, lucene, inverted index, solr → ask: How do you store a year of nightly availability and prices per listing in that index, and what does one calendar change cost to apply at {{calendar_updates}} changes per second?
- when: geohash, quadtree, s2, h3, grid cell, geo shard → ask: One viewport over a dense city centre holds tens of thousands of listings and another over open countryside holds a dozen. How does your partitioning keep both fast and evenly loaded?
- when: cache, cached, caching → ask: What is the cache key when every guest picks different dates, guests and filters? What hit rate do you expect, and what happens to cached results when a calendar changes?
- when: bitmap, bitset, bit array, bit vector → ask: Show me the exact check for a 5-night stay starting on a day the listing does not allow check-in, 2 days from now with 3 days' advance notice. Which checks are not about the night bits at all?
- when: database, postgres, mysql, sql query → ask: How many listing-nights does one query over a city touch if availability is rows in a table, and can that meet 400 ms at {{qps}} searches per second?

**Production Reality Check.**
- During a holiday booking rush the index update path falls 40 minutes behind. Guests click listings that search shows as free, find the dates taken at booking, and failed booking attempts triple.
- A channel manager re-syncs the full calendars of 80,000 listings at once on top of the normal {{calendar_updates}} changes per second; ordinary hosts' bookings and blocks queue behind it and stop meeting the target of {{staleness}}.
- A change to the indexer converts each listing's local calendar dates through UTC timestamps. For listings east of UTC, every night shifts by one day: guests are shown free nights that are booked and miss nights that are free.
- After a currency-rate refresh fails, totals for guests paying in one currency are computed with a week-old rate, and the price filter drops listings that are inside the guest's range.

**Evaluation Criteria.** Separates the slowly changing filter attributes from per-listing nightly availability and prices held in compact arrays; a constant-time stay check (free-run lengths or bit masks) plus the separate check-in, length, notice and window rules; totals from prefix sums and the stated discount and fee rules; geo partitioning that copes with dense and sparse areas, with a candidate budget handed to ranking; an update path from versioned calendar events that is idempotent, coalesces per listing, isolates bulk syncs and is measured against {{staleness}}; booking as the exact check, with price differences explained to the guest; stable paging through a result snapshot; listing-local dates handled without time-zone conversion; adapts to each incident with diagnosis, recovery and prevention.

## ABB-L4-02: Demand signals for price suggestions: searches, views, booking pace and comparable listings

| | |
|---|---|
| **Template ID** | ABB-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Marketplace signals / demand by market and stay night, comparables, measuring suggestions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "markets": ["3,000", "8,000", "20,000"],
  "searches_per_day": {"2": ["150 million", "300 million"], "3": ["800 million", "1.5 billion"]},
  "horizon_days": [180, 365],
  "refresh": ["every hour", "every 6 hours", "once a day"]
}
```

**Business Scenario.** Hosts set their own nightly prices. The marketplace offers each host optional price suggestions for every future night up to {{horizon_days}} days ahead, refreshed {{refresh}}; a host can accept them, ignore them, or turn on automatic pricing within a minimum and maximum they choose. The suggestions are only as good as the signals behind them: search demand for each of {{markets}} markets and each future stay night (from about {{searches_per_day}} searches a day, many with dates), listing views and wishlist saves, booking pace (how much of a night's capacity is already booked at each lead time, against the same lead time a year earlier), remaining supply, and comparable listings with their prices and booking outcomes. The team is also asked to show whether suggestions help hosts and guests.

**Problem Statement.** Design the signal platform. Cover how raw search, view and booking events become demand per market × stay night × lead time; how repeated searches and automated traffic are kept from inflating demand; how comparable listings are chosen and summarised; how signals are kept point-in-time correct for training and served to the suggestion model {{refresh}}; how acceptance and outcomes are fed back; and how you would measure whether suggestions help, given that hosts in one market compete for the same guests.

**Constraints.** Suggestions are advice; the host's price is final. Training data must use only what was known when a suggestion was made. A host must never be able to see a particular competitor's prices or bookings through the comparables: only aggregates over at least 10 listings are shown. Search events carry a pseudonymous visitor id, not a person's identity, and are kept for 13 months in raw form.

**Assumptions.** All volumes, windows and thresholds are hypothetical. Search, listing-view, wishlist and booking events arrive on a durable event stream; each search with dates names a market (or a map area that maps to one or more markets), a check-in date, a check-out date and a guest count. Listing calendars and prices are available as daily snapshots and as change events.

**Clarifications.**
- Q: Is one search for 5 nights 5 units of demand? | A: Your call. Define demand per stay night and per check-in date, and say which question each answers.
- Q: Can we tell whether a search led to a booking? | A: Searches, views and bookings share the pseudonymous visitor id within a session; attribution beyond that is up to you.
- Q: How much of the search traffic is automated? | A: A meaningful share. Each session has a bot score that is useful but imperfect.
- Q: Can we test suggestions host by host? | A: You can randomise however you like; tell me what competition between nearby hosts does to the result.
- Q: Do hosts in a market all see the same suggestion? | A: No; each listing gets its own, but they share the market's demand signal.

**Hints.**
1. Deduplicate before counting: one visitor searching the same market and nights twenty times in a day is one unit of interest. Expand a date range into its nights, and count per (market, night, day observed).
2. Booking pace needs a baseline: booked share of capacity at lead time L this year against the same lead time last year, aligned by weekday and around holidays.
3. When treated and control hosts compete for the same guests, a host-level test measures a transfer, not a gain. Randomise by market, or alternate treatment over time, and accept the cost in statistical power.

**Follow-ups.**
1. Define "demand for market M on night D as known on day T". Show the table, its grain, and how a late or duplicate event changes it.
2. How do you build comparable listings, and how do you keep any host from inferring one competitor's prices or bookings from the aggregates?
3. A large event is announced for one city five months ahead. How quickly do your signals react, and what stops a short spike from moving prices for months?
4. How do you measure whether suggestions raise host earnings and bookings, given competition between hosts and markets of very different sizes?
5. Suggestions change prices, prices change booking pace, and booking pace feeds the next suggestion. How do you keep the model from learning its own suggestions back?

**Follow-up rules.**
- when: a/b test, ab test, experiment, randomize, randomise → ask: Treated hosts accept lower suggestions and take bookings from control hosts nearby. What does your listing-level test measure then, and how would you randomise instead?
- when: bot, bots, crawler, scraper, scraping → ask: Your bot filter removes sessions above a score threshold. How do you know what share of real guests it removes, and what happens to demand when a scraper learns to look human?
- when: streaming, real-time, real time, kafka, flink → ask: Which of your signals actually needs to be fresher than {{refresh}}, and what does running it in real time cost you?
- when: feature store, point-in-time, point in time, as-of, as of → ask: Show me how a training row for a suggestion made 60 days before the night gets the demand and booking pace values exactly as known that day.
- when: average price, median price, mean price → ask: Booked prices exist only for listings that sold. What bias does that put in your comparable-price signal, and how do you correct for it?

**Production Reality Check.**
- A scraper starts searching every date range in one city every few minutes. Demand for that city triples overnight and suggestions for 3,000 listings rise by 20% before anyone notices.
- The booking feed into the signal pipeline stalls for two days with no alarm. Booking pace in all {{markets}} markets reads as a collapse, and suggestions fall by up to 30% for hosts who use automatic pricing.
- A search-page change starts sending next weekend's dates by default when a guest browses the map without choosing dates. Demand for next-weekend nights jumps in every market at once.
- Suggestions are refreshed {{refresh}}, but a dashboard shows that hosts who accepted them earned less than hosts who did not; product asks whether to switch suggestions off.

**Evaluation Criteria.** Clear demand definitions per stay night and check-in date with deduplication by visitor; bot filtering whose error is measured; booking pace against a seasonal baseline; comparables chosen on attributes and location with k-anonymous aggregates (at least 10 listings); point-in-time correct signal tables (as known on day T) for training and serving; feedback of acceptance and outcomes with the suggestion logged; a measurement design that handles interference (market-level or time-based randomisation) and selection bias in observational comparisons; guards against feedback loops; freshness matched to need; adapts to each incident with diagnosis, recovery and prevention.

## ABB-L4-03: Fraud labels that arrive late and disagree: training sets and loss reporting

| | |
|---|---|
| **Template ID** | ABB-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Data quality / label ledger, label maturity, point-in-time training sets, restatements |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "bookings_per_day": ["400,000", "1 million", "2 million"],
  "dispute_window": [90, 120],
  "cadence": ["weekly", "every two weeks", "monthly"],
  "sources": {"2": [4, 5], "3": [6, 8]}
}
```

**Business Scenario.** A stays marketplace takes about {{bookings_per_day}} bookings a day. Risk models score bookings, accounts and listings for fraud: payments with stolen cards, taken-over accounts, fake listings, and requests to pay outside the platform. The models are retrained {{cadence}}, and leadership reads a monthly fraud-loss report. The labels both depend on come from {{sources}} sources that arrive late and disagree: card chargebacks up to {{dispute_window}} days after payment (this exercise's dispute window; check current card-network rules), each with a reason code; reports from guests and hosts; trust-team review decisions, some later reversed on appeal; refunds granted because a listing did not exist; and account-security events. One booking can collect several labels that conflict, and a label on an account may or may not apply to each of its bookings.

**Problem Statement.** Design the label platform. Cover how every label is recorded (source, entity, what it asserts, when it happened, when we learned it, and what superseded it); how conflicting labels are resolved into one outcome per entity, and how that rule is versioned; when a label is mature enough to train on or report; how training sets are built point-in-time correct and reproducibly; what you do about bookings the model blocked, which never get an outcome; how monthly loss reports are restated when late labels arrive; and which data-quality checks catch a source that silently changes.

**Constraints.** A training set must be rebuildable exactly, months later. A month's loss report, once published, changes only through a recorded restatement. Reviewers' free-text notes and messages never enter training sets; only coded outcomes do. A label on one account must not mark unrelated bookings, such as the bookings of a guest whose account was taken over, as fraud by that guest.

**Assumptions.** All volumes, windows and rates are hypothetical. Bookings, payments, refunds, chargebacks, reports and review decisions are available as event streams or daily extracts, each with its own event time. Model features are already stored point-in-time correct; this design is about labels.

**Clarifications.**
- Q: Which source wins when two disagree? | A: There is no agreed rule today; propose one, and say who owns it.
- Q: Does every chargeback mean fraud? | A: No. Reason codes separate fraud from "service not received" and other disputes, and a merchant can win a dispute later.
- Q: How long until we know a booking was clean? | A: Never with certainty. Most fraud chargebacks arrive within weeks; a few take nearly the whole {{dispute_window}}-day window.
- Q: Do blocked bookings get labels? | A: No outcome is ever observed for a booking that was blocked.
- Q: Who reads the loss report? | A: Finance and leadership, monthly, with quarter-end numbers used externally.

**Hints.**
1. Keep labels as an append-only ledger with two times per label: when the event happened and when you learned of it. "What we knew on date T" is then a filter, not a reconstruction.
2. A booking younger than its label window is not "clean"; it is not yet known. Train and evaluate only on mature bookings, or weight immature ones by how much of their outcome has usually arrived.
3. To learn anything about blocked traffic you need a small, random, logged allow-through (or a review queue) with known probabilities.

**Follow-ups.**
1. Show the label ledger's schema and the resolution query that turns it into one outcome per booking as known on a date.
2. The model retrained {{cadence}} looks better on recent bookings than on older ones. What is going on, and how do you evaluate it honestly?
3. How do you estimate the true fraud rate among bookings the model blocked?
4. A trust-team decision is reversed on appeal two months later. What changes in the ledger, the training sets already built, and the published reports?
5. How do you detect, within a day, that one of the {{sources}} label sources has silently changed what it sends?

**Follow-up rules.**
- when: update in place, updated in place, overwrite, upsert, latest label → ask: If labels are updated in place, how do you rebuild last quarter's training set exactly as it was, and explain why the old model behaved as it did?
- when: chargeback, chargebacks, dispute → ask: A chargeback for fraud arrives on day 110 for a booking already in a published report and in two training sets. Walk me through what changes where.
- when: negative sampling, negatives, label as clean, labelled clean, treat as clean, assume clean → ask: Bookings from the last two weeks have no chargebacks yet. If you label them clean, what does that do to the model and to its measured precision?
- when: account, accounts, account takeover, takeover → ask: An account is confirmed as taken over. Which of its bookings get a fraud label, and which are victims' bookings?
- when: blocked, declined, rejected → ask: The model blocks 2% of bookings and you never see their outcome. How does that bias the next model, and what does it cost to correct?

**Production Reality Check.**
- The payment processor changes its chargeback reason codes; one code that meant fraud is split in two, and for three weeks fraud chargebacks are mapped to "other". The month's reported fraud loss drops by a third and nobody questions it.
- A trust-team bulk action against a fraud ring labels 12,000 accounts; 2,000 of those labels are reversed on appeal a month later, after one of the retrains, run {{cadence}}, has already learned from them.
- The retrain uses bookings up to yesterday and treats those without labels as clean. Measured precision on recent bookings rises at each retrain while actual fraud losses climb.
- Guest reports arrive as free text and an extraction step turns them into coded labels. After a change to it, negated phrases such as "definitely not a scam" are read as fake-listing reports, and fake-listing labels double in one week.

**Evaluation Criteria.** An append-only label ledger with event time and knowledge time, source and supersession; a versioned, owned resolution rule per entity; label maturity tied to the {{dispute_window}}-day window, with immature bookings excluded or weighted rather than treated as clean; point-in-time, reproducible training sets built from ledger snapshots; a plan for blocked traffic (random allow-through or reviewed sample with logged probabilities); account labels propagated to bookings with care for victims; restatements recorded and explained, with as-published and as-restated views; source-level quality checks (code distributions, volume, lag) that alert; adapts to each incident with diagnosis, recovery and prevention.

## ABB-L4-04: Guest–host messaging: ordered delivery, translation, response metrics and safety scanning

| | |
|---|---|
| **Template ID** | ABB-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Messaging system / per-thread ordering, delivery receipts, translation, safety holds, metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "messages_per_day": {"2": ["15 million", "30 million"], "3": ["80 million", "150 million"]},
  "languages": [30, 60],
  "hold_budget": ["300 ms", "1 second", "3 seconds"],
  "response_window": ["24 hours", "12 hours"]
}
```

**Business Scenario.** Guests and hosts message each other before booking (inquiries), after booking, during the stay and after it. A thread can include co-hosts and a host's team members. About {{messages_per_day}} messages a day are delivered to mobile apps (with push notifications), to the web and by email, where a reply by email must land in the right thread. Messages can be automatically translated between {{languages}} languages, always with the original one tap away. Messages are scanned for safety: requests to pay outside the platform, phishing links and harassment. Hosts' response rate and response time (the share of inquiries and booking requests answered within {{response_window}}, and the time to the first reply) are shown on listings and feed host standards.

**Problem Statement.** Design the messaging system. Cover how messages are stored and ordered within a thread, how they are delivered to every participant's devices with delivery and read receipts, how offline devices catch up, how email replies are matched to threads, where translation happens and how it is cached, how safety scanning works within a hold budget of {{hold_budget}} per message and what happens to a message found harmful after delivery, and how response-rate and response-time metrics are computed so that they are fair to hosts.

**Constraints.** Messages in a thread appear in the same order on every device. Sending must feel instant: the sender sees the message accepted within 200 ms. A message may be held for scanning for at most {{hold_budget}}; anything that needs longer is scanned after delivery. Translation must never block delivery. Before a booking is confirmed, phone numbers and email addresses in messages are masked (this exercise's rule). Messages are kept for the life of the reservation plus a retention period, and their text never enters analytics tables.

**Assumptions.** All volumes, budgets and rules are hypothetical. Push notifications go through the mobile platforms' public push services, which can delay or drop a notification. A translation service and a fast and a slow safety classifier exist; you decide how to call them.

**Clarifications.**
- Q: Do automatic replies and scheduled messages count as responses? | A: In this exercise, scheduled messages and automatic replies do not count as a response; a first personal reply does.
- Q: Who counts as "the host" for response metrics? | A: Any host, co-host or team member in the thread.
- Q: Can a message be edited or unsent? | A: No edits. A message can be removed by the safety team; the thread shows that a message was removed.
- Q: How long may a thread be? | A: Most have a few dozen messages; some long stays reach thousands.
- Q: Are messages end-to-end encrypted? | A: Not in this exercise; the platform reads them to scan and translate, under its terms.

**Hints.**
1. Give each thread a single writer for ordering (route by thread id) and assign a per-thread sequence number at accept time; devices sync "everything after sequence N".
2. Keep translation out of the send path: translate on first read into a language, cache by (message, target language), and show the original if translation is slow.
3. Two-stage scanning: a fast classifier inside the hold budget decides deliver, hold or mask; a slower one runs after delivery and can retract with a notice to the recipient.

**Follow-ups.**
1. Walk through a guest's message from send to the host's phone, the co-host's laptop and an email inbox. Which steps are synchronous?
2. A host's phone was offline for two days. How does it catch up without missing or reordering messages, and what do read receipts say?
3. The slow classifier flags a message an hour after delivery as a phishing link. What do the recipient, the sender and the metrics see?
4. How do you compute response rate (answered within {{response_window}}) and response time so that a push-service outage or an inquiry sent at 3 a.m. local time is fair to the host?
5. Long-stay threads reach thousands of messages and many photos. What changes in storage and sync?

**Follow-up rules.**
- when: websocket, websockets, long poll, push → ask: The push service drops a notification and the app's connection is closed. How does the host's device learn the message exists, and how quickly?
- when: kafka, queue, event stream, pub/sub → ask: How do you keep per-thread order through that queue when one thread has a burst of 50 messages and partitions are rebalanced?
- when: timestamp, timestamps, created_at, clock → ask: Two participants send at the same instant from devices whose clocks differ by 40 seconds. Which order does everyone see, and why is it the same everywhere?
- when: translate, translation, translated → ask: A thread with {{languages}} possible languages and 3 participants: how many translations do you compute per message, when, and what does a translation error cost?
- when: average, averaged, avg, mean response time → ask: Response time averaged per host is dominated by one inquiry answered after a week. What statistic and window would you show, and why?

**Production Reality Check.**
- The translation service slows to 4 seconds per request. Because translation was put in the delivery path, senders see messages stuck on "sending" and some resend, creating duplicates.
- A phishing campaign sends look-alike payment links to 50,000 guests. The fast classifier misses them; the slow one is updated six hours later, after most were delivered and opened.
- A push-notification outage lasting three hours in one region delays hosts' awareness of inquiries; that quarter's response metrics for hosts in the region drop, though nothing changed in their behaviour.
- The safety hold is raised from {{hold_budget}} to 10 seconds after an incident; inquiry-to-booking conversion falls noticeably and support contacts about "message not sent" rise.

**Evaluation Criteria.** Per-thread ordering through a single writer and server-assigned sequence numbers (not device clocks); durable accept within 200 ms, then fan-out to devices with idempotent display and sync by sequence; receipts as separate events; email replies matched with signed reply addresses; translation on read with caching and the original always available; two-stage safety scanning within {{hold_budget}}, retraction after delivery with notices; contact masking before booking; response metrics on server receipt times, with personal replies only, fair exclusions for platform outages and a robust statistic; message text kept out of analytics; adapts to each incident with diagnosis, recovery and prevention.

## ABB-L4-05: Quarterly host standards: assessment, progress, history and appeals

| | |
|---|---|
| **Template ID** | ABB-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Metrics pipeline / versioned definitions, as-of assessments, appeals and recomputation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "hosts": {"1": ["300,000", "800,000"], "2": ["2 million"], "3": ["4 million", "6 million"]},
  "window": ["the previous 12 months", "the previous quarter"],
  "min_stays": [5, 10],
  "appeal_days": [14, 30]
}
```

**Business Scenario.** Every quarter the marketplace assesses about {{hosts}} hosts against this exercise's host standard: a response rate of at least 90%, a host cancellation rate under 1% (cancellations covered by an approved extenuating-circumstances decision do not count), an overall rating of at least 4.8, and at least {{min_stays}} completed stays, all measured over {{window}}. Hosts who meet it get a badge on their listings and a search benefit for the next quarter. During the quarter, hosts see their progress. After an assessment, a host may appeal within {{appeal_days}} days, for example because a cancellation should have been excused. The inputs come from bookings, alterations and cancellations, messages, two-sided reviews (hidden until both sides submit or the review window closes, so ratings arrive after the stay), and extenuating-circumstance decisions that can be approved weeks after the event.

**Problem Statement.** Design the assessment platform. Cover how each metric is defined (with its version), which data cut-off an assessment uses, how the quarterly assessment is computed and published at the same moment for every host, how hosts' progress is shown during the quarter, how a host's status history and the inputs behind each assessment are kept, how an appeal or a late exception changes a past assessment without silently rewriting history, and how you would audit that the badge and the search benefit match the published assessment.

**Constraints.** An assessment must be reproducible from its recorded inputs and definition version. A host must be able to see why they did or did not meet the standard, down to the stays, cancellations and reviews counted. Results publish within 3 days of the quarter's end, at one time for all hosts. A change after an appeal takes effect immediately and is recorded as a new version of that assessment.

**Assumptions.** All counts, thresholds and timings are hypothetical, and the standard is this exercise's, not any current programme's; check current docs for real criteria. Bookings, cancellations (with who cancelled and why), messages, reviews and exception decisions are in the warehouse with event times.

**Clarifications.**
- Q: Does a cancellation by the guest count against the host? | A: No. Only cancellations by the host, or by the platform because of the host, count.
- Q: Which reviews count for a stay that ended on the quarter's last day? | A: Your call. The review window is still open at the assessment date; say what you do and how hosts learn about it.
- Q: What if a host has fewer than {{min_stays}} stays? | A: They do not meet the standard this quarter, and their progress view should say so plainly.
- Q: Can definitions change mid-year? | A: Yes, with notice. An assessment always records which version it used.
- Q: Does a co-host share the host's status? | A: Status is per host account; listings managed by several hosts are counted for the primary host in this exercise.

**Hints.**
1. Write each assessment as an immutable record: host, quarter, definition version, data cut-off, metric values, the ids of the counted inputs, and the result. Corrections are new versions that point to the old one.
2. A daily progress view and the quarterly assessment should run the same definitions on different cut-offs, not two codebases.
3. Late inputs need a rule decided in advance: either an assessment uses only what was known at the cut-off and late inputs count next time, or late inputs trigger a re-assessment. Both are defensible; mixing them is not.

**Follow-ups.**
1. Show the tables for metric definitions, assessments and status history, and the query that answers "what status did host H have on date D, and why?"
2. A booking was altered twice and then cancelled by the host after the guest asked to change dates. Is it a host cancellation, and how does your definition decide?
3. An extenuating-circumstance decision is approved three weeks after publication and would change 9,000 hosts' results. What runs, what changes for them, and what do they see?
4. How do you make sure the badge on listings and the search benefit switch at the publication moment and match the assessment exactly?
5. A definition change moves the cancellation threshold. How do you show hosts their progress under the new rule before it applies, and compare quarters fairly?

**Follow-up rules.**
- when: overwrite, update in place, recompute, rerun → ask: You re-run last quarter after an appeal and the output overwrites the table. How does a host, or support, see what the result was before the appeal and why it changed?
- when: snapshot, as-of, as of, cut-off, cutoff → ask: Reviews for stays near the quarter's end arrive after your cut-off. Do they count this quarter or next, and how does the host know which?
- when: dashboard, progress, daily → ask: The daily progress view says a host meets the standard; the quarterly assessment says they do not. What are the possible causes in your design, and how do you prevent them?
- when: appeal, appeals, override, manual → ask: Support manually overrides a result after an appeal. How does that override survive the next recomputation, and who can see it was manual?
- when: average rating, avg rating, mean rating → ask: How exactly is the overall rating computed: per review, per stay, rounded when? Show a host at 4.795 and say whether they pass.

**Production Reality Check.**
- A definition bug counts guest-requested date changes that end in a host-confirmed cancellation as host cancellations. After publication, 4% of hosts lose the badge, and appeals pile up faster than they can be handled within {{appeal_days}} days.
- Reviews for stays that ended in the last two weeks of the quarter arrive after the cut-off; hosts complain that a poor review "counted in the wrong quarter", and support gives different answers to different hosts.
- Severe weather closes a region and causes mass host cancellations. The extenuating-circumstances decision covering them is approved three weeks after the assessment was published.
- The search benefit is switched on from a copy of the assessment taken before a late correction run; for two days, 11,000 hosts who no longer meet the standard keep the benefit and 3,000 who now meet it do not get it.

**Evaluation Criteria.** Versioned metric definitions owned and shared by the progress view and the assessment; a clear cut-off rule for late inputs (reviews, exceptions), announced to hosts; immutable, reproducible assessment records with counted input ids and supersession for appeals and corrections; status history queryable as of any date; publication as one atomic switch (a published assessment version) that the badge and the search benefit both read; manual overrides as recorded inputs that survive recomputation; explanations a host can follow; checks that compare the assessment with its consumers; adapts to each incident with diagnosis, recovery and prevention.
