# Pinterest · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a visual discovery
service: pins, boards and sections, saves, idea pins, visual search, shopping and product
pins, creators, ads and the home feed. Every pinner, number, rule and schema is
hypothetical, and nothing here describes how any company's systems, ranking or reporting
actually work. Ranking appears only as a scoring function you are given. Pinner data
appears only in aggregate, never as a profile of one person, and no sensitive attribute
is inferred from pins, boards, searches or images.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PIN-L2-01: Price-drop alerts on saved product pins

| | |
|---|---|
| **Template ID** | PIN-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Heaps / event sweep with a max-heap of pending thresholds per product |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | PIN-L2-01.mjs |

**Business Scenario.** Product pins show an item from a merchant's catalogue with its current price. When a pinner saves a product pin, they may want to hear when it gets cheaper. A daily job reads the catalogue's price history and every save of a product pin, and for each save it finds the day the product first became cheap enough to send one alert. Popular products are saved by many pinners on many different days, and catalogue prices move a little almost every day, so most saves wait a long time before anything happens.

**Problem Statement.** Implement `price_drop_alerts(saves, prices, pct=90)`. `saves` is a list of `(product, day)`, one per save, where `day` is an integer day number. `prices` is a list of `(product, day, price)` rows in any order, with `price` in integer cents. A row's price holds from its day until that product's next row, and a product has at most one row per day. The price on a save is the price in force on the save day, including a row dated that same day. A save alerts on the first day **after** the save day whose price is at most `pct` per cent of the price on the save. The comparison is exact: `100 × price ≤ pct × saved price`. Return one integer per save, in the order of `saves`: the alert day, or `-1` if the price never gets that low, or if the product had no price yet on the save day. {{pct_rule}} {{stock_rule}}

**Constraints.** Up to 150 000 saves and up to 80 000 price rows in the timing check, over 20 products with 4 000 days of history. Prices wobble by a few per cent, so most saves stay pending for thousands of days. A scan forward from each save through its product's later rows is O(s·d) and too slow. Something close to O((s + d) log s) is expected.

**Assumptions.** Products, prices, days and the alert percentage are hypothetical; the 90% default is this exercise's rule, so check current docs for how any real alert works. One save gets at most one alert. Days are whole days in one time zone, and price rows are already validated. Nothing about the pinner is needed beyond the save itself.

**Clarifications.**
- Q: Does a cheaper price on the save day itself trigger an alert? | A: No. A row dated the save day sets the saved price. Only later days can alert.
- Q: Is exactly `pct` per cent enough? | A: Yes. The rule is `100 × price ≤ pct × saved price`, in integers, so there is no rounding question.
- Q: Do I report the cheapest day or the first qualifying day? | A: The first qualifying day. The alert goes out as soon as the price is low enough.
- Q: What if the product has no price row on or before the save day? | A: There is no saved price, so that save never alerts: `-1`.
- Q: Are the rows sorted? | A: No. Rows for different products are interleaved and out of order.

**Hints.**
1. Process days in order. Within a day, apply that day's price rows before that day's saves, so a save never alerts on its own day.
2. For one product, which pending save alerts first when the price falls? The one with the highest threshold. Keep pending saves in a max-heap by `pct × saved price`.
3. When a price arrives, pop from that product's heap while the top threshold is at least `100 × price`. Every pop is an alert on that day, and each save is popped at most once.

**Follow-ups.**
1. Pinners save the same product more than once, on different boards. How would you send at most one alert per pinner and product, and which save's price would you use?
2. The job runs every day on the newest prices only. What state do you keep between runs, and how big does it get for a product saved by millions of pinners?
3. A merchant's feed sends a wrong price of one cent for an hour, then corrects it. How do you avoid a wave of false alerts, and what would you check before sending?
4. The catalogue changes currency for a region, so prices in one product's history are in two currencies. What breaks in your comparison, and how would you fix the data model?

**Follow-up rules.**
- when: scan forward, for each save, nested loop → ask: A popular product has 10 000 pending saves and a price row every day for ten years. How many comparisons does your loop make?
- when: heapq, heap, priority queue → ask: Why is the top of the heap the right save to test first? What would you have to change if the threshold depended on the pinner, not only on the saved price?
- when: float, 0.9, multiply by → ask: Your threshold is computed with a float. Give a price where `price <= 0.9 * saved` and the integer rule disagree, or explain why they cannot.
- when: sort saves, sorted by day, bisect → ask: After sorting, what do you do with a save whose product drops on the same day it was saved?
- when: segment tree, sparse table, range minimum → ask: That finds the first cheap enough day for one save in log time. How does it compare with a sweep for memory and for a daily incremental run?

**Evaluation Criteria.** Saved price taken from the row in force on the save day, including a same-day row; alerts only on later days; the first qualifying day, not the cheapest; the exact integer comparison at the boundary; `-1` for saves before the first price; independent products; at Very Hard, out-of-stock days never alert and saves while out of stock return `-1`; an event sweep with a per-product max-heap (or another O(log) structure) rather than a scan per save; a clear complexity argument; sensible answers on deduplication, incremental runs and bad feed data.

## PIN-L2-02: Order agreement between shown pins and a given scoring function

| | |
|---|---|
| **Template ID** | PIN-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Divide and conquer / counting discordant pairs (inversions) with ties and duplicates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | PIN-L2-02.mjs |

**Business Scenario.** An offline evaluation compares two orderings of the same pins. One is the order in which a long list of pins was actually shown, taken from impression logs. The other is the order that a scoring function you are given would produce, where a higher score means the pin would be placed higher. The team wants one number that says how much the two disagree: the number of pairs of pins that were shown in the opposite order from the one the scoring function prefers. Lists for broad interests run to hundreds of thousands of pins, and the job runs for many of them.

**Problem Statement.** Implement `discordant_pairs(shown, scores, report_comparable=False)`. `shown` is a list of pin ids in the order they were shown, first position first. `scores` maps a pin id to its integer score. A pair of two different counted pins `a` and `b` is discordant when `a` was shown before `b` but `scores[a] < scores[b]`. Return the number of discordant pairs. {{data_rule}} {{return_rule}}

**Constraints.** Up to 380 000 shown pins in the timing check. Scores are integers and may be negative. Comparing every pair is about 10¹¹ comparisons. Something close to O(n log n) is expected.

**Assumptions.** Pin ids, scores and lists are hypothetical. The scoring function is given and treated as a black box: this exercise does not say how any real ranking is built, and it does not look at who saw the pins. The count can exceed 32 bits.

**Clarifications.**
- Q: Which direction is discordant? | A: The pin shown earlier has the lower score. If the earlier pin has the higher score, the pair agrees.
- Q: Do I need to produce the scoring function's order? | A: No. You need only the count of pairs where the two orders disagree.
- Q: What do I return when nothing is shown? | A: Zero, because there are no pairs (or `(0, 0)` when comparable pairs are reported too).
- Q: Are scores unique? | A: Only where the statement says so. Otherwise equal scores happen, and a pair with equal scores is not discordant.
- Q: Can the answer be large? | A: Yes, close to n²/2 for a reversed list. Python integers handle it. Say what you would use in a language with fixed-width integers.

**Hints.**
1. List the counted scores in shown order. A discordant pair is a pair of positions `i < j` with `v[i] < v[j]`. That is an inversion count with the comparison reversed.
2. Merge sort the list into descending order. When an element from the right half is placed before the remaining elements of the left half, each of those left elements was earlier and smaller.
3. With equal scores, take the left element first on a tie, so equal pairs are never counted. For comparable pairs, count all pairs and subtract the pairs inside each group of equal scores.

**Follow-ups.**
1. The team wants a normalised number between −1 and 1 that is comparable across lists of different lengths. Which statistic would you report, and how do ties change its denominator?
2. Disagreements near the top of the list matter more than disagreements at position 40 000. How would you weight pairs by position, and does your algorithm still work?
3. Lists are now produced continuously, and the team wants the count for the last hour's impressions only. What would you keep incrementally?
4. The scoring function is run on a sample of pins only, and the rest have no score. How do the skipped pins bias the agreement number, and how would you report that?

**Follow-up rules.**
- when: bisect, insort → ask: Each `insort` shifts the elements after the insertion point. How many element moves does that make for 380 000 pins in random order?
- when: fenwick, binary indexed tree → ask: Your tree is indexed by score. Scores are large and may be negative. How do you map them to indexes, and what happens with equal scores?
- when: merge sort, mergesort, divide and conquer → ask: On a tie between a left and a right element, which do you take first, and what count goes wrong if you take the other one?
- when: nested loop, all pairs, itertools.combinations → ask: How long do 10¹¹ comparisons take in CPython? What is the largest list you could handle in the time limit?
- when: seen, first position, dict.fromkeys → ask: A pin appears at positions 3 and 900. Which position does your code keep, and why does that matter for the count?

**Evaluation Criteria.** Correct direction of disagreement; repeated pins counted once at their first position; unscored pins skipped; equal scores never counted as discordant; at Very Hard, comparable pairs counted as all pairs minus pairs within equal-score groups; an O(n log n) count by merge sort or a Fenwick tree over score ranks; a clear explanation of tie handling; awareness that the count can exceed 32 bits; sensible answers on normalisation, position weighting and incremental counting.

## PIN-L2-03: Debug the pin engagement rollup

| | |
|---|---|
| **Template ID** | PIN-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event aggregation / repin credit, visibility rules, deletions, units and week boundaries |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | PIN-L2-03.mjs |

**Business Scenario.** Creators see weekly impressions, saves and views for each pin they published. A save creates a repin on the saver's board, and the engagement a repin gets is credited to the original pin. Creators and analysts have raised several complaints about one weekly rollup. Pins saved through a chain of repins show engagement on someone else's repin instead of on the original. Pins that are popular with group boards look less saved than they should. A deleted pin still shows up in reports, while a pin whose repin was deleted loses engagement it really had. Video views look far too high next to the player's own numbers. Weekly totals do not match the UTC dashboards in the first hours of every Monday. The rollup below is the suspect.

**Problem Statement.** Fix `weekly_engagement(events, pins)` so that it meets this specification. {{replay_rule}}
1. **Pins.** `pins` maps a pin id to `{"origin", "format", "deleted"}`. `origin` is the pin it was saved from, or `None` for an original pin. A repin's origin may itself be a repin, and its `format` (`"static"` or `"video"`) is the same as its original's. An event for a pin that is not in `pins` is ignored.
2. **Credit.** Every event is credited to its pin's **original**: follow `origin` until it is `None`. A deleted repin's events still count for the original. If the original is deleted, none of its events are reported.
3. **Metrics.** An `impression` adds 1 to `impressions`. A `save` adds 1 to `saves` unless `board` is `"secret"`: saves to public and group boards count. A `closeup` adds 1 to `views` when the original is static. A `video_view` adds 1 to `views` when the original is a video and `watched_ms` is at least 2 000 (2 seconds, this exercise's rule). A closeup on a video pin is not a view.
4. **Weeks.** `ts` is Unix seconds. A week starts on Monday at 00:00 UTC and is labelled by that Monday's date, `YYYY-MM-DD`.
5. **Output.** A dict keyed `"<original>|<week>"`, each value `{"impressions", "saves", "views"}`. A key appears only if at least one event counted for it.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events and 20 000 pins, processed in close to linear time.

**Assumptions.** Event types, fields and the 2-second rule are hypothetical and simplified; check current docs for how any real metric is defined. Events are already deduplicated. Secret-board saves are private to the pinner and never appear in creator metrics.

**Clarifications.**
- Q: Does a repin of a repin go to the middle pin or to the first one? | A: To the original, the first pin in the chain.
- Q: What about group boards? | A: They are not secret. Saves to group boards count like saves to public boards.
- Q: A repin was deleted. Do its earlier saves disappear from the original's numbers? | A: No. They happened, and they are credited to the original. Only a deleted original removes its rows.
- Q: Which time zone defines a week? | A: UTC. A week runs from Monday 00:00:00 to Sunday 23:59:59 UTC.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Draw a chain of three pins, original → repin → repin of repin, and put an event on the last one. Where does the code credit it?
2. List the board values a save can have, and the ones the code counts.
3. Read every unit and constant next to the comparison that uses it.
4. Take an impression at Monday 03:00 UTC and work out by hand which week the code gives it.

**Follow-ups.**
1. Creators can see their own pins' weekly numbers, but the same table feeds a public trends page. Which rows or counts must never reach the public page, and where would you enforce that?
2. A pin's original is deleted, and the creator asks for last month's report again. Should the old numbers change? What would you store to answer both ways?
3. Events arrive up to three days late. How would you rerun a week without double counting, and when would you call a week final?
4. Repin chains are long and the rollup follows them for every event. How would you precompute the original for every pin, and keep it current as pins are created and deleted?

**Follow-up rules.**
- when: while loop, follow origin, recursion → ask: A chain is 10 000 repins long. What does your code do, and how would you avoid walking it for every event?
- when: memo, cache, lru_cache → ask: Your cache maps a pin to its original. What must happen to it when an original pin is deleted, or when a new repin is created?
- when: timezone, utc, tzinfo → ask: Creators in different countries want weeks in their own time zone. What do you store so that both UTC and local weeks can be produced?
- when: group board, visibility, board type → ask: A new board type is added next quarter. Does your check count it or drop it by default, and which default is safer for creator metrics?
- when: milliseconds, watched_ms, 2000 → ask: Where else in a pipeline like this do seconds and milliseconds meet, and how would a test catch the next one?

**Evaluation Criteria.** Finds and explains every bug with its creator-facing symptom; credit follows the whole repin chain; secret saves excluded and group saves kept; deletion checked on the original, not on the event's pin; the view threshold compared in matching units; Monday weeks in UTC; minimal fixes that keep the output format; a regression test per bug.

## PIN-L2-04: Visual search request logging that never stores the pinner's photo

| | |
|---|---|
| **Template ID** | PIN-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Event logging / privacy by design, derived features only, joins to later actions |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "daily_searches": {"2": ["5 million", "15 million"], "3": ["60 million", "150 million"]},
  "entry_points": ["camera, crop on a pin and uploaded image", "crop on a pin and camera"],
  "retention": ["90 days", "13 months"],
  "followup_window": ["10 minutes", "30 minutes"]
}
```

**Business Scenario.** Visual search lets a pinner search with an image instead of words. The entry points are {{entry_points}}. The service detects objects in the image, the pinner can adjust a crop, and results are served as a grid of pins. There are about {{daily_searches}} visual searches a day. The product team wants to know which entry points and detected object kinds lead to useful results, measured by what the pinner did within {{followup_window}}: a closeup, a save or an outbound click. The rule for this log is strict: the pinner's photo, from the camera or uploaded, is never stored, not even briefly in a debug table.

**Problem Statement.** Design the logging and analytics pipeline for visual search. Cover the request event and what it may and may not contain, the crops and detected objects, the results served with their positions, the later actions and how they are joined to the request, how crops on public pins differ from the pinner's own photo, retention for {{retention}}, the aggregates the product team uses, and how you prove that no photo or photo-derived identifier is kept.

**Constraints.** No pixels, thumbnails or reversible image embeddings of the pinner's own photo may be logged or kept. Joins to later actions must not depend on a long-lived identifier of the pinner. Reports are aggregates by entry point, object kind, country and week, with small cells suppressed. Late and duplicate client events are normal. Logs older than {{retention}} are deleted.

**Assumptions.** Volumes, windows, retention and the list of entry points are hypothetical. Object detection returns a label from a fixed list (for example "chair", "lamp", "dress") with a bounding box and a confidence. Results are pins and product pins identified by public pin ids. Any real product's logging rules may differ; check current docs.

**Clarifications.**
- Q: May we keep an embedding of the photo to debug bad results? | A: Not of the pinner's own photo. An embedding can often be inverted or matched back to the image, so it counts as the photo. A crop on a public pin can be logged by pin id and box.
- Q: How do later actions find their search? | A: That is part of your design. A short-lived request id issued by the server and echoed by the client is one option.
- Q: Do we need per-pinner history? | A: No. The questions are about entry points and object kinds in aggregate, and nothing is inferred about the pinner.
- Q: What does "useful" mean? | A: A closeup, save or outbound click on a served result within {{followup_window}} of the results being shown.
- Q: Can the detected labels be sensitive? | A: The label list is fixed to objects and products. If a label could describe a person, it is not on the list and is never logged.

**Hints.**
1. Split the request into what came from the pinner (an image you must not keep) and what the service produced (labels, boxes, result ids). Log only the second kind.
2. Use a request id that is generated per search and expires with the {{followup_window}} join, rather than a pinner id.
3. Decide where the photo exists at all (memory on the serving path only) and write the rule as a test that scans the logged schema and samples.

**Follow-ups.**
1. A bug report says results are bad for chairs photographed in dim light. How do engineers investigate without the photos?
2. A client release starts sending the image hash with every search event. How do you detect it, stop it and delete what was written?
3. The team wants to know whether repeat users of visual search save more over a month. What would you need, and is it compatible with this log's rules?
4. Volume grows tenfold from {{daily_searches}} a day, and a new video-frame entry point is added. What changes in the pipeline and in the privacy checks?

**Follow-up rules.**
- when: embedding, feature vector, image hash → ask: You log a vector computed from the pinner's photo. How would someone match it back to the image, and what would you log instead?
- when: user_id, pinner id, device id → ask: Which question needs that identifier? Could a per-search request id that expires answer it instead?
- when: s3, blob storage, object storage → ask: What exactly is written to that bucket, who can read it, and how long does it live?
- when: join, session window, request id → ask: The save event arrives 40 minutes later because the phone was offline. Does it still join, and should it count?
- when: suppression, k-anonymity, threshold → ask: Which cells fall below your threshold most often, and how do you avoid revealing them by subtraction from totals?

**Production Reality Check.**
- A client release adds a base64 thumbnail to the error event of failed visual searches; it reaches the raw log for six hours before anyone notices.
- A client retry bug sends every results-served event twice for one day, so served results double for every entry point while actions do not.
- Deletion of logs older than {{retention}} fails silently for a week because a partition was renamed.

**Evaluation Criteria.** A schema that excludes the pinner's photo and anything reversible derived from it; crops on public pins logged by pin id and box; a short-lived request id rather than a pinner id for joins; a clear definition of useful with the {{followup_window}} window and late events; deduplication of client retries; aggregate reports with small-cell suppression; retention enforced and verified; automated checks on schema and samples that would catch a leak; a plan for each incident.

## PIN-L2-05: Saves from the browser extension and the mobile share sheet

| | |
|---|---|
| **Template ID** | PIN-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Event ingestion / client-generated ids, out-of-order and duplicate events, source attribution |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, analytics-engineer |

```params
{
  "daily_saves": {"2": ["3 million", "10 million"], "3": ["40 million", "120 million"]},
  "offline_hours": [6, 24, 72],
  "clients": ["browser extension and mobile share sheet", "browser extension, mobile share sheet and website save button"]
}
```

**Business Scenario.** Pinners save images from other websites through the {{clients}}. Each save creates a new pin that records the page it came from, and creators who claimed that website can later see saves from their pages. There are about {{daily_saves}} such saves a day. Mobile clients queue saves while offline for up to {{offline_hours}} hours and send them later, sometimes twice. Edits and deletes of a just-created pin can arrive before the save itself. Analysts want a clean table of saves from external pages, with the source page, the client and the time the pinner actually saved.

**Problem Statement.** Design the pipeline from the client's save request to the analytics table. Cover the identity of a save across retries, how out-of-order create, edit and delete events are applied, how the source page URL is normalised and recorded, which time is the save time, how late events from offline clients reach past days, what the analytics table looks like and how it is kept correct when a pin is deleted.

**Constraints.** A retried save must never create two pins or two analytics rows. A pin deleted by its pinner must disappear from the analytics table within a day. Source URLs can carry tracking parameters and session tokens that must not be stored. Client clocks can be wrong by hours. Daily reports must be re-runnable for any past day.

**Assumptions.** Volumes, offline periods and client list are hypothetical. Each client can generate a random id when the pinner taps save. The service records its own receive time. Any real product's behaviour may differ; check current docs.

**Clarifications.**
- Q: Which time is the save time, the phone's or the server's? | A: Analysts want when the pinner saved, but phone clocks can be wrong. You decide, and you must say how you handle a phone that is hours off.
- Q: Can a delete arrive before its create? | A: Yes, when the pinner deletes a pin created offline and the events are sent in a different order.
- Q: Which part of the URL is the source page? | A: The page without fragments, tracking parameters or session tokens. Decide how you normalise it, and keep the rule versioned.
- Q: Do creators see who saved? | A: No. Creators see counts of saves from their claimed pages, never the pinners.
- Q: What if the same image is saved from two different pages? | A: Those are two saves with two source pages.

**Hints.**
1. Let the client mint a save id when the pinner taps save, and make it the key for creating the pin, so a retry finds the existing pin.
2. Treat create, edit and delete as versions of one record keyed by save id, and keep a tombstone so that a create arriving after a delete stays deleted.
3. Record both the client time and the server receive time, and derive a save time with a rule you can explain.

**Follow-ups.**
1. A client bug reuses the same save id for every save made in one offline session. What do you see in the data, and how do you repair it?
2. A website changes its URL structure, and creators see their saves split across two pages. How does your normalisation handle it, and can you re-normalise history?
3. The daily report for a day 3 days ago changes because offline saves arrived late. How do you rerun it, and what do analysts see?
4. At {{daily_saves}} a day, the deduplication store becomes the bottleneck. How do you bound it, and what happens to a retry that arrives after the window?

**Follow-up rules.**
- when: uuid, client id, save id → ask: The client generates the id. What happens if two phones generate the same one, and how would you detect it?
- when: server time, receive time, ingestion time → ask: A save made on Saturday offline arrives on Monday. Which day's report does it belong to, and how do you justify that to analysts?
- when: upsert, merge, last write wins → ask: A delete with an older client timestamp arrives after an edit with a newer one. What does your merge decide, and is that right?
- when: url, query string, utm → ask: Which parts of the URL do you keep? Show one parameter that must be removed for privacy and one that may change the page.
- when: dedupe, dedup, exactly once → ask: Where exactly is the duplicate dropped: at the API, in the stream or in the table? What does each choice cost?

**Production Reality Check.**
- After a mobile release, offline queues of up to {{offline_hours}} hours flush at once and every save is sent twice.
- A browser extension version sends the full page URL with a session token in the query string for two days.
- Deletes for pins created offline arrive before their creates for one client version, and those pins reappear in the analytics table.

**Evaluation Criteria.** A client-minted save id used for idempotent creation; versioned records with tombstones so out-of-order deletes win; a defensible save-time rule with client and server times kept; URL normalisation that removes tracking and session parameters, versioned and re-runnable; late events written to their day with reruns that overwrite partitions; deletion propagated to analytics within a day; creator views in aggregate only; a bounded deduplication window; a plan for each incident.
