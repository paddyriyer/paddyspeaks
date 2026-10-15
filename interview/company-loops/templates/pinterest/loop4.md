# Pinterest · Loop 4 — High-Level System Design

Simulated practice scenarios set in the public product domain of a visual
discovery service: pins, boards and sections, saves, visual search, shopping and
product pins, creators, ads and analytics. Every workload, number, rule and schema
is hypothetical, and nothing here describes how any company's systems are actually
built. Wherever a home feed, related pins or search results need ordering, the
order comes from a scoring function you are given; you are never asked to design
one. Pinner data appears only in aggregates, except a pinner's or creator's own
data shown to them.

## PIN-L4-01: Impression logging from infinite-scroll grids: visibility thresholds, scroll-back and per-pin reporting

| | |
|---|---|
| **Template ID** | PIN-L4-01 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Client event logging / viewability rules, deduplication, late and skewed events, per-pin aggregates |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_impressions": {"2": ["20 billion", "40 billion"], "3": ["120 billion", "250 billion"]},
  "visible_pct": [50, 60, 75],
  "dwell_ms": [250, 500, 1000],
  "revisit_minutes": [10, 30, 60]
}
```

**Business Scenario.** Pins are shown in grids that scroll without end: the home feed, search results, the related pins under a closeup, and board pages. Each grid shows several pins of different heights at once, and a pinner often scrolls down quickly, stops, then scrolls back up to a pin they passed. Under this exercise's rule, an impression counts when at least {{visible_pct}}% of a pin's tile is on screen for at least {{dwell_ms}} ms, and the same pin seen again in the same grid within {{revisit_minutes}} minutes counts once. Apps on two mobile platforms and the web log about {{daily_impressions}} qualifying impressions a day. Creators see impressions per pin in their analytics, and promoted pins are billed per thousand impressions under the same rule, so the number must hold up when an advertiser questions it.

**Problem Statement.** Design impression logging end to end. Cover where and how the visibility rule is evaluated on the client, the impression event and its keys, how the scroll-back rule is applied and where, batching and upload from devices that go offline or are killed by the operating system, server-side ingestion, deduplication and validation, how late and clock-skewed events are placed in the right day, and the per-pin daily aggregates behind creator analytics and ad billing. Say how you would know the three clients count the same way.

**Constraints.** Creator analytics may be a few hours behind; billed impressions for a day close 48 hours after the day ends and must not change afterwards except through a recorded adjustment. Logging may not slow scrolling: no network call per impression. The impression event carries no image content and no free text, and per-pin reports show counts, never which pinners saw a pin.

**Assumptions.** All volumes, thresholds and windows are hypothetical and belong to this exercise; check current docs for any real product's rules. Each client already has a rendering layer that knows which tiles are laid out and where. Grid order comes from a scoring function you are given; the server records which pins it returned for each request.

**Clarifications.**
- Q: Does a pin that is only laid out off screen (pre-rendered for smooth scrolling) count? | A: No. Only on-screen time counts, under the {{visible_pct}}% and {{dwell_ms}} ms rule.
- Q: Is "the same grid" the same request? | A: Treat a grid as one feed, search or board view from when it opens until the pinner leaves it; a pull-to-refresh starts a new grid.
- Q: What if a pinner sees the same pin in the home feed and then in search? | A: Two impressions; the {{revisit_minutes}}-minute rule applies within one grid only.
- Q: Are promoted pins counted by the same code path? | A: Yes, by the same visibility rule; billing reads the same events through a stricter pipeline.
- Q: Can we trust the client clock? | A: Not fully. Some devices are hours or days off; you decide what the server stamps.

**Hints.**
1. Give every grid view a server-issued id and every tile a slot id; an impression is then "this pin, in this grid view, became visible", which makes deduplication a key problem rather than a time problem.
2. Decide which rules run on the device (visibility and dwell need the screen) and which run on the server (deduplication, validation, day assignment), and make the device rule versioned.
3. Separate the fast, approximate path for creator analytics from the closed, reconciled path for billing; both read the same raw events.

**Follow-ups.**
1. Walk one pin through a fast scroll down, a stop, and a scroll back up two minutes later. Which events are sent, which are counted, and where is that decided?
2. A device is offline for six hours and uploads a batch when it reconnects, with its clock 3 hours slow. Which day does each impression land in, and what happens if the billing day has already closed?
3. How do you show that the two mobile apps and the web count the same thing, and catch a client that drifts?
4. Billing closes 48 hours after the day. What is your process for an error found a week later, and what does the advertiser see?
5. Estimate the event volume, the size of the per-pin daily table, and the cost of keeping raw events for the billing audit period.

**Follow-up rules.**
- when: impression id, event id, uuid → ask: The app retries an upload after a timeout, and the server had already accepted the first batch. Show me the key that makes the second copy harmless.
- when: client timestamp, device time, device clock → ask: A device's clock is two days ahead. Which day does its impression count in, and what stops it from landing in a closed billing day?
- when: intersection observer, viewport, visibility → ask: A client release starts pre-rendering tiles just below the screen. How does your design notice that impressions changed for a reason other than pinners?
- when: kafka, stream, streaming → ask: The stream's consumer for billing falls six hours behind on a holiday. Do creators or advertisers see anything wrong, and when?
- when: sampling, sampled, sample → ask: Billing needs every impression. Where, if anywhere, is sampling acceptable in your design?

**Production Reality Check.**
- A new release of one mobile app lays out tiles slightly below the screen to make scrolling smoother; impressions from that app rise 35% overnight while saves and closeups do not move, and the {{visible_pct}}% rule is evaluated against the laid-out area instead of the visible one.
- One app version keeps impressions in memory and loses the batch when the operating system kills the app in the background; impressions from that version run 12% below the other clients for a week before anyone notices.
- After a grid redesign, tiles reflow when a pinner rotates the phone; the deduplication key includes the tile's position, so a pin seen again within {{revisit_minutes}} minutes after a rotation counts twice.
- About 0.3% of devices report clocks more than a day ahead, and their impressions land in tomorrow's partition, which the billing close for today never reads.

**Evaluation Criteria.** Evaluates visibility and dwell on the client with a versioned rule and a grid-view id plus slot id; applies the scroll-back rule deterministically by key; durable batching with retries and idempotent impression ids; server-side receive time and clock-offset correction for day assignment, with a late-data policy; separate approximate (creator) and closed, reconciled (billing) aggregates with recorded adjustments; cross-client consistency checks (golden scroll scripts, ratios of impressions to closeups by client version, canary gates); privacy-conscious event content; adapts to each incident with diagnosis, recovery and prevention.

## PIN-L4-02: Shop the look: products detected in pin images, linked to live catalogues, with outbound clicks measured

| | |
|---|---|
| **Template ID** | PIN-L4-02 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Catalogue matching / detections, embedding index refresh, catalogue changes, link lifecycle, click measurement |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "catalog_products": {"2": ["200 million", "500 million"], "3": ["2 billion", "4 billion"]},
  "merchants": {"2": ["50,000", "100,000"], "3": ["500,000", "1 million"]},
  "refresh_hours": [4, 12, 24],
  "linked_pins": {"2": ["150 million", "300 million"], "3": ["1 billion", "2 billion"]}
}
```

**Business Scenario.** On a pin showing a room or an outfit, small dots mark the products in the picture: a lamp, a rug, a jacket. Tapping a dot shows similar products from merchants' catalogues, and tapping a product sends the pinner to the merchant's site (an outbound click). {{merchants}} merchants upload catalogues with {{catalog_products}} products in total; each catalogue is re-ingested every {{refresh_hours}} hours, and prices, stock and whole products change between uploads. About {{linked_pins}} pins carry at least one product link. An object detector you are given finds the products in an image and returns a box and a category, an embedding model you are given turns an image crop or a product photo into a vector, and a scoring function you are given orders candidate products.

**Problem Statement.** Design the system that creates, refreshes and measures these links. Cover catalogue ingestion and its validation, the product embedding index and how it stays current, detection and matching for new pins and for existing pins when catalogues change, how a link is stored and versioned, what the pinner sees when a linked product goes out of stock, changes price or disappears, and how outbound clicks are measured per link, merchant and catalogue version and reported back to merchants in aggregate.

**Constraints.** A pinner must never see a price or stock state more than {{refresh_hours}} hours older than the merchant's latest successful upload. A product removed by its merchant disappears from every link within one hour of the upload being processed. Merchants see clicks and impressions for their own products in aggregate, never which pinners clicked. The detector and embedding model are given; you design how they are run, versioned and replaced.

**Assumptions.** All volumes, timings and rules are hypothetical and belong to this exercise; check current docs for any real product's rules. A catalogue upload is a file or feed with one row per product variant (id, title, price, currency, availability, image URL, link). Pin images are public pins; no pinner's own photo is used here.

**Clarifications.**
- Q: Is a link to an exact product or to similar products? | A: Both exist; a dot can show the exact product when a merchant tagged it, otherwise visually similar ones. Treat merchant-tagged links as more trusted.
- Q: How often do embedding models change? | A: A few times a year, and a new model's vectors cannot be compared with the old one's.
- Q: What if a merchant's upload fails validation? | A: You decide what is kept; say what pinners see for that merchant's products while the failure lasts.
- Q: Do we need links for every pin? | A: No. Prioritise by how often pins are seen; say how.
- Q: Can matching run when the pinner taps? | A: Only if it meets a 300 ms p95 for the products panel; otherwise precompute.

**Hints.**
1. Separate three things that change at different speeds: detections on a pin image (almost never), the candidate products for a detection (when the index or a catalogue changes), and price and stock (every upload).
2. Store a link as detection plus candidates plus the versions that produced them; resolve price and stock at serving time from a current offers store keyed by product.
3. Treat a catalogue upload as a diff against the previous one; only changed products touch the index and only affected links are refreshed.

**Follow-ups.**
1. A merchant's upload marks 30,000 products out of stock. Walk through which records change and what pinners see within the hour.
2. How do you move {{linked_pins}} linked pins and {{catalog_products}} products from one embedding model to the next without a period where matches get worse?
3. Which pins do you recompute candidates for when {{merchants}} merchants re-upload every {{refresh_hours}} hours, and what does that cost per day?
4. How would you measure whether a new matching version sends pinners to products they actually want, using outbound clicks, without crediting the version for clicks it did not cause?
5. Design the merchant-facing report: what it shows, at what grain, and how it stays consistent with what was billed for any promoted product pins.

**Follow-up rules.**
- when: nearest neighbour, ann, faiss, vector index → ask: Your vector index is rebuilt from scratch for every catalogue upload. With uploads every {{refresh_hours}} hours from {{merchants}} merchants, how long does a rebuild take, and what is served meanwhile?
- when: cache, cached → ask: A product's price changes in a new upload. Which caches hold the old price, and what bounds how long a pinner can see it?
- when: batch, nightly, daily job → ask: A large merchant removes a product line at noon. Your batch job runs at night. How do you meet the one-hour removal constraint?
- when: ctr, click-through, redirect → ask: One merchant's outbound clicks triple in an hour with no change in impressions. How does your pipeline tell a real surge from automated traffic, and what does the merchant report show meanwhile?
- when: model version, embedding version, re-embed → ask: Halfway through re-embedding, half the catalogue is in the new space and half in the old. What does a query vector get compared against?

**Production Reality Check.**
- A large merchant's export breaks and its upload marks every product out of stock; within the hour, product dots on millions of pins go empty, and the next good upload is {{refresh_hours}} hours away.
- A new embedding model is rolled out to the query side before the catalogue side finishes re-embedding; for two days, matches for half the categories are visibly unrelated and outbound clicks per products-panel open fall by 40%.
- A merchant changes its product ids in one upload without changing the products; every existing link to that merchant points at "removed" products, while the same items reappear as new ones with no links.
- Outbound clicks to one merchant jump tenfold for an hour from a small set of networks; the merchant's report and the promoted-pin bill both include them.

**Evaluation Criteria.** Separates detections, candidate matches and live offers by rate of change; catalogue ingestion as validated diffs with a quarantine for suspicious uploads (sudden mass out-of-stock or id churn) rather than blind application; incremental index updates with versioned embedding spaces and a dual-index migration; links stored with the versions that produced them and resolved against current offers at serving time; removal and price-freshness guarantees met by design; outbound clicks counted with dedup and invalid-traffic filtering, reported to merchants in aggregate and consistent with billing; adapts to each incident with diagnosis, recovery and prevention.

## PIN-L4-03: Board and save storage at scale: billions of saves, per-board ordering, followers and secret boards that never leak

| | |
|---|---|
| **Template ID** | PIN-L4-03 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Storage design / partitioning, ordered collections, counters, visibility and access propagation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "saves": {"2": ["50 billion", "100 billion"], "3": ["300 billion", "500 billion"]},
  "peak_saves": {"2": ["20,000", "50,000"], "3": ["150,000", "300,000"]},
  "max_board_pins": ["10,000", "50,000", "200,000"],
  "visibility_minutes": [1, 5, 15]
}
```

**Business Scenario.** Pinners save pins to boards, and optionally to sections inside a board. A board is public or secret; secret boards are visible only to their owner and invited collaborators, and group boards let several pinners save to one board. The service holds {{saves}} saves and takes {{peak_saves}} saves per second at peak. A board can hold up to {{max_board_pins}} pins, shown newest first by default, and its owner can drag pins into any order. Pinners follow boards and profiles, and board pages, profiles, search, related pins and each pin's public save count are all built from this data.

**Problem Statement.** Design the storage and serving for boards and saves. Cover the data model (pins, boards, sections, saves, collaborators, follows), partitioning and the access patterns it serves (a board's pins in order, a pinner's boards, a pin's public save count, "is this pin already saved by me"), how manual ordering is stored so a drag does not rewrite the board, how follower and save counts are kept at scale, and how a secret board's saves are kept out of every public surface, including when a board changes from public to secret.

**Constraints.** A save appears on the pinner's own board immediately (read your own writes). When a board becomes secret, its pins disappear from every public surface (board page, profile, search, related pins, public save counts) within {{visibility_minutes}} minutes; when a collaborator is removed from a group board, they lose access within the same time. Board page reads p99 under 100 ms. Follower and save counts shown publicly may lag by a few minutes but must never count a save on a secret board.

**Assumptions.** All volumes, limits and timings are hypothetical and belong to this exercise; check current docs for any real product's rules. Search and related pins are built by other systems that consume change events from this one; their ordering is a scoring function you are given. A pin can be saved to many boards by many pinners; the original pin and its creator are recorded once.

**Clarifications.**
- Q: Do saves to secret boards count anywhere? | A: Only in the owner's own view of their boards. Never in public counts or public surfaces.
- Q: Does a pin's public save count need to be exact? | A: No, a few minutes behind is fine, but it must never go down and up again visibly for no reason, and never include secret saves.
- Q: Can two collaborators reorder a group board at the same time? | A: Yes. You decide what each sees afterwards.
- Q: What happens to saves when a pinner deletes a board? | A: They are deleted, and every downstream surface must stop showing them; say how fast.
- Q: Are boards public by default? | A: Under this exercise's rule, yes, unless created as secret.

**Hints.**
1. Partition saves by board (for board pages) and keep a second copy keyed by pinner and by pin for the other access patterns; decide which copy is the source of truth and how the others are derived.
2. Store manual order as a sortable rank key per save (fractional or lexicographic ranks), so moving one pin writes one row, and rebalance a board's keys when they grow long.
3. Make visibility a property every downstream consumer receives in the change stream, and build public surfaces from a public-only projection rather than filtering at each read.

**Follow-ups.**
1. Walk through one save to a public board: which rows are written, in what order, and which downstream consumers learn of it?
2. A board with {{max_board_pins}} pins is switched from public to secret. List every place its pins appear publicly and how each is cleared within {{visibility_minutes}} minutes.
3. A board gains two million followers in a day. How are follower counts kept without a hot row?
4. Two collaborators drag the same pin to different places at the same moment, and a third saves a new pin. What does everyone see afterwards?
5. How would you check, continuously, that no secret save has reached any public surface?

**Follow-up rules.**
- when: partition by user, shard by user, user id → ask: A board page needs a group board's pins saved by twenty different pinners in one order. With saves partitioned by pinner, how many partitions does one page read touch?
- when: counter, increment, sharded counter → ask: A viral pin takes thousands of saves a second. Where does its save count live, and how do secret saves stay out of it?
- when: cache, cdn, cached → ask: A board turns secret. Which cached copies of its pins exist, and what evicts each one within {{visibility_minutes}} minutes?
- when: position, offset, sort order → ask: The owner moves the last pin of a {{max_board_pins}}-pin board to the top. How many rows does your ordering scheme rewrite?
- when: event, cdc, change stream → ask: The search index consumer is down for an hour while a board turns secret. What does search show when it comes back, and in what order does it apply what it missed?

**Production Reality Check.**
- A pinner switches a board from public to secret; 40 minutes later its pins still appear on the board's public page from a cached copy and in search, well past the {{visibility_minutes}}-minute limit.
- A pin goes viral and takes 8,000 saves a second; writes to its public save count time out, retries pile up, and save latency for every pin on the same partition climbs to seconds.
- After months of drag-and-drop, the rank keys on some large boards have grown to hundreds of characters, and a board page read for those boards exceeds its 100 ms p99.
- A collaborator removed from a group board can still save to it from one app for 30 minutes, because that app reads permissions from a cache that is refreshed on login only.

**Evaluation Criteria.** A data model with clear sources of truth and derived copies per access pattern; partitioning by board with secondary indexes by pinner and pin; manual ordering by rank keys with rebalancing and a concurrency rule; sharded or aggregated counters fed only by public saves; visibility as data carried in change events, public surfaces built from a public-only projection, cache invalidation tied to visibility changes, and a continuous leak check; read-your-own-writes for the saver; numbers for storage and peak write rate; adapts to each incident with diagnosis, recovery and prevention.

## PIN-L4-04: Trend insights for advertisers and creators: search and save interest by region and week, from aggregates only

| | |
|---|---|
| **Template ID** | PIN-L4-04 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Aggregate analytics / distinct counting, minimum thresholds, normalised indexes, year-over-year alignment |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "regions": {"2": [20, 40], "3": [80, 150]},
  "min_pinners": [100, 500, 1000],
  "years": [2, 3, 5],
  "terms": {"2": ["5 million", "10 million"], "3": ["50 million", "100 million"]}
}
```

**Business Scenario.** Advertisers and creators want to plan ahead: when does interest in "autumn wreaths" or "small balcony ideas" start to rise, in which of {{regions}} regions, and is it earlier or later than last year? A trends tool shows, for a term or a topic, weekly interest from searches and from saves of related pins, by region, over the last {{years}} years, with a year-over-year comparison and a list of terms rising fastest this week. About {{terms}} distinct normalised terms appear in a year. Under this exercise's rule a (term, region, week) cell is shown only when at least {{min_pinners}} distinct pinners contributed to it, and the tool never shows anything about an individual pinner.

**Problem Statement.** Design the pipeline and the serving layer behind the tool. Cover how raw searches and saves are turned into weekly aggregates (term normalisation, mapping saves to topics, distinct pinners rather than raw events), how thresholds are applied and how you prevent small cells from being recovered by subtraction across overlapping filters, how interest is normalised so terms and regions can be compared, how weeks are aligned year over year, how "rising fastest" is computed robustly, and how the tool serves interactive queries.

**Constraints.** The tool is refreshed weekly, by a stated time after the week ends. Counts are distinct pinners per cell; raw query text from individual pinners never leaves the aggregation job. No breakdown by any sensitive or protected attribute is offered, and no attribute of that kind is inferred from searches, pins or boards. Terms that are personal names or on a sensitive-topics list (this exercise's rule) are excluded. A query in the tool answers in under 2 seconds.

**Assumptions.** All volumes, thresholds and rules are hypothetical and belong to this exercise; check current docs for any real product's rules. Region is derived from coarse location at the time of the event; a topic taxonomy that maps pins to topics is given and changes a few times a year.

**Clarifications.**
- Q: Is interest a count or an index? | A: You decide; most users want to compare shapes over time and between regions, not raw volumes. Say what the number means.
- Q: What is a week? | A: Your call, but it must line up year over year in a way advertisers understand, including years with 53 weeks.
- Q: Can a user filter by region and by topic at the same time? | A: Yes, within the fixed list of regions and topics; no free-form audience filters.
- Q: What about spikes from automated traffic? | A: They must not create a "rising" term; say how you detect and remove them.
- Q: Do we keep raw events for {{years}} years? | A: No; raw events are kept for a short period under this exercise's rule. Plan which aggregates you keep.

**Hints.**
1. Count distinct pinners per cell with an exact count where cells are near the threshold and a mergeable sketch elsewhere; decide what is stored so weeks and regions can be combined without double counting.
2. Thresholds applied cell by cell are not enough when users can request overlapping groupings; fix the groupings in advance, or suppress complements.
3. Normalise each series to its own range (for example 0 to 100 over the displayed period) and state it, so a small region's shape is comparable with a large one's.

**Follow-ups.**
1. Walk a search for "Autumn Wreaths!" through normalisation, region mapping and aggregation into a cell. What exactly is stored?
2. Show how a user could learn a below-threshold count by combining two allowed queries, and how your design prevents it.
3. Define "rising fastest this week" so that a term going from 3 to 30 pinners does not top the list and a holiday that moves dates is not mistaken for a trend.
4. The topic taxonomy splits one topic into three. How do year-over-year comparisons stay meaningful?
5. Estimate storage for {{terms}} terms × {{regions}} regions × {{years}} years of weekly cells, and what you would precompute versus compute on query.

**Follow-up rules.**
- when: hyperloglog, hll, sketch, approximate → ask: A cell's estimate is 2% above the {{min_pinners}}-pinner threshold. Is it shown, and how sure are you?
- when: k-anonymity, threshold, suppress, suppression → ask: Region A plus region B is allowed, and region A alone is allowed. What does that let a user compute about region B, and what do you do about it?
- when: iso week, week number, calendar week → ask: This year has 53 weeks and last year had 52. What does week 53 compare against, and what does week 1?
- when: raw query, query text, log → ask: Which job is allowed to see raw query text, for how long, and how do you prove nothing downstream holds it?
- when: z-score, growth rate, percent change → ask: A term goes from 2 searching pinners to 40 in a small region. Does your growth measure rank it first?

**Production Reality Check.**
- Year-over-year comparisons show every term up by about 15% for one week in January; the pipeline compared this year's week 1 against last year's week 1, but the two weeks cover different holidays and one starts in December.
- An automated client issues a few hundred thousand searches for one term from one region in a weekend, and the term tops the rising list on Monday despite the {{min_pinners}}-pinner threshold, because the count was of searches, not distinct pinners.
- A term near the threshold in a small region appears in one week and disappears the next, and an advertiser asks why their trend has gaps; a second team's dashboard shows the same cells without suppression.
- The topic taxonomy is updated mid-year; "home decor" is split into three topics, and the year-over-year view for each new topic shows a jump from zero.

**Evaluation Criteria.** Distinct pinners per cell with an exact path near the threshold; thresholds with fixed groupings or complement suppression that block differencing; normalised indexes with a stated meaning; a week definition aligned year over year (including 53-week years and moving holidays); a robust rising-terms measure with minimum volume and baselines; invalid-traffic removal before aggregation; raw query text confined to the aggregation job with short retention; no sensitive breakdowns or inferences; a storage and precompute plan; adapts to each incident with diagnosis, recovery and prevention.

## PIN-L4-05: Time to first impression for new pins: upload, processing and indexing to first distribution, measured stage by stage

| | |
|---|---|
| **Template ID** | PIN-L4-05 |
| **Loop** | 4 |
| **Kind** | design |
| **Topic** | Pipeline latency observability / stage timestamps, censored durations, per-segment percentiles, backlogs |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 50 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "new_pins": {"2": ["5 million", "10 million"], "3": ["30 million", "60 million"]},
  "target_minutes": [5, 15, 30],
  "video_share": ["10%", "20%", "35%"]
}
```

**Business Scenario.** Creators upload about {{new_pins}} new pins a day, {{video_share}} of them video. Before a new pin can be shown to anyone it goes through stages: upload received, media processed (image sizes, video transcoding), policy checks (automatic, with some pins queued for human review), feature extraction, and indexing into the stores that search, home feed and related pins draw candidates from. After that, whether and when it is shown depends on a scoring function you are given. Creators complain that new pins "take ages to show up", and the product goal is that 95% of new pins are eligible for distribution within {{target_minutes}} minutes of upload.

**Problem Statement.** Design how time to first impression is measured and how the pipeline is made to meet the goal. Cover the stage events and their keys, how stage timestamps from different services are put on one timeline, the per-pin lifecycle table, how you report percentiles per stage and per segment (image or video, creator size, region, client) including pins that have not finished, how you separate pipeline delay ("not yet eligible") from distribution ("eligible but not yet shown"), alerting on backlogs, and the changes to the pipeline you would make once you can see where time goes.

**Constraints.** The measurement must not add a synchronous call to the upload path. Policy checks may not be skipped to meet the goal. Stage durations shown to engineers are per pin and per stage; anything shown to a creator is about their own pins only. A pin that never becomes eligible must appear in the numbers, not vanish from them.

**Assumptions.** All volumes, targets and stages are hypothetical and belong to this exercise; check current docs for any real product's rules. Each stage is run by a separate service with its own queue and can emit events. The scoring function that decides distribution is given and out of scope.

**Clarifications.**
- Q: Is "first impression" the goal, or eligibility? | A: The goal is eligibility within {{target_minutes}} minutes; first impression is reported too, but it depends on demand and the scoring function. Keep the two apart.
- Q: Do pins sent to human review count against the goal? | A: Report them as their own segment; they still count in the overall number.
- Q: What if a pin is edited or its media replaced while processing? | A: You decide whether the clock restarts; say what the creator sees.
- Q: Are stage timestamps trustworthy? | A: Each service stamps with its own clock; clocks can be off by seconds, and replays can re-emit old events.
- Q: Do deleted pins count? | A: Pins deleted by the creator before eligibility leave the denominator from the moment of deletion; say how.

**Hints.**
1. Give every stage event the pin id, the stage, an attempt number and a monotonic sequence within the pin; build one lifecycle row per pin by folding the events, so retries and replays do not double count.
2. A median over finished pins hides the pins that are stuck. Treat unfinished pins as censored durations and report "share eligible within N minutes" alongside percentiles.
3. Overall percentiles hide segments: video, large uploads from one creator, and one region can each be slow while the total looks fine.

**Follow-ups.**
1. Walk one video pin through every stage. Which events are emitted, which clock stamps each, and how is the lifecycle row built?
2. Two services' clocks disagree, and some stage durations come out negative. How do you build a trustworthy timeline?
3. How do you report the 95%-within-{{target_minutes}}-minutes goal each hour when a fifth of today's pins have not finished?
4. You now see that most of the time is spent waiting in queues, not processing. What do you change in the pipeline, and how do you prove it helped?
5. A creator uploads 2,000 pins at once. How do you keep them from delaying everyone else's pins while still processing theirs promptly?

**Follow-up rules.**
- when: p95, p99, percentile, median → ask: Your p95 covers pins that finished. A thousand pins are stuck in review for a day. Are they in that number, and should they be?
- when: timestamp, event time, clock → ask: The transcoding service's clock is 20 seconds behind the upload service's. What does that do to your stage durations, and what do you use instead?
- when: queue, kafka, backlog → ask: One creator's batch of video pins fills the transcoding queue. What does every other creator's video pin experience, and what changes in your design?
- when: dashboard, alert, slo → ask: The overall number is green while video pins in one region are at three times the target. What alert would have caught that?
- when: retry, retries, replay → ask: A stage is replayed from yesterday's offsets after an outage. How does your lifecycle table avoid counting those pins twice or moving their timestamps backwards?

**Production Reality Check.**
- One large creator uploads thousands of video pins at once; video pins' 95th percentile time to eligibility rises to four hours while the overall figure, dominated by image pins, stays near {{target_minutes}} minutes.
- After a deploy, a fifth of stage durations from the feature-extraction service are negative, because it now stamps events when a batch is written instead of when each pin finishes.
- A weekend backlog in the human review queue leaves several thousand pins unfinished for 30 hours; the dashboard's median improves because those pins are not yet in it.
- The indexing stage is replayed from a stored checkpoint after an outage, and 3 million pins appear to become eligible twice, with the second timestamp hours later than the first.

**Evaluation Criteria.** Stage events keyed by pin, stage and attempt with a folded lifecycle table that is idempotent under retries and replays; a single timeline (ingest-time ordering per pin, server receive times, clock-skew handling) instead of trusting each service's clock; censored-duration reporting (share within target, survival curves) so stuck pins count; per-segment percentiles and alerts; eligibility separated from first impression and from the given scoring function; pipeline changes driven by queue-versus-work time (priorities, per-creator fairness, autoscaling, smaller batches) with a measured before and after; adapts to each incident with diagnosis, recovery and prevention.
