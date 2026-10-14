# Google · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domains of a search,
video, maps, advertising and cloud company. Every workload, number, schema and
incident is hypothetical, and nothing here describes how any company's systems
are actually built.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GOO-L3-01: Search sessions and query refinements

| | |
|---|---|
| **Template ID** | GOO-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / event model, sessionization, nested versus flat facts, data contracts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_searches": {"1": ["300 million"], "2": ["2 billion", "4 billion"], "3": ["8 billion", "12 billion"]},
  "session_gap": ["10 minutes", "30 minutes"],
  "result_types": ["web results, ads, image packs and a direct-answer box", "web results, ads, a video carousel, a map pack and a direct-answer box"],
  "min_users": [20, 50, 100]
}
```

**Business Scenario.** A web search engine serves about {{daily_searches}} searches a day. Each results page shows a mix of {{result_types}}, and the mix changes as product teams add new result types. Search quality analysts want to study how people search: which queries are refined (rewritten, extended or corrected) and into what, how often a session ends in a click, how often a page ends with no click because the answer was already on the page, and where on the page clicks land. A search session here is a run of one user's searches with no gap longer than {{session_gap}}. Query text is sensitive: in this scenario a query string may appear in any shared table only if at least {{min_users}} distinct users issued it that day.

**Problem Statement.** Design the event model and the analytical model. Define the events the serving and client sides emit (search issued, results page served, results seen, click, back-to-results, query edited) and the contract that governs them. Define the analytical tables: the results page with what it showed and at which positions, the session, and the refinement relationship between consecutive searches. Decide whether a results page is stored as one row with a nested, repeated list of results or as one row per shown result, and say which questions each shape serves. Define "refinement", "click-through" and "answered on the page" precisely enough that two analysts get the same number.

**Constraints.** Clicks and client events arrive minutes to hours after the page was served; some never arrive (the user closed the tab). A page can be served twice for one search (a reload) and must not count twice. The model must absorb a new result type without breaking existing queries. Rare queries never appear as text in shared tables.

**Assumptions.** Volumes, the session gap and the privacy threshold are hypothetical. Users are identified by a pseudonymous key, signed-out users by a short-lived browser key; nothing joins either key to an identity. A results page has a server-assigned page id that the client echoes on every event.

**Clarifications.**
- Q: Does a spelling correction applied automatically count as a refinement? | A: No. A refinement is a new search the user issued; an automatic correction is an attribute of the page that was served.
- Q: Is a click on an ad a click-through? | A: Report organic and ad clicks separately and say what the combined metric means; analysts mostly want organic.
- Q: How do I know a result was seen and not just served? | A: The client sends a "results seen" event with the positions that entered the viewport. It can be missing.
- Q: Can a session span midnight? | A: Yes. Decide which day it belongs to and say why.
- Q: Who consumes these tables? | A: Quality analysts with SQL, experiment analysis, and dashboards for the search product teams.

**Hints.**
1. Separate the facts by grain: one row per search (the page served), one row per result shown on it, one row per interaction. The page id joins them.
2. A refinement is a relationship between two searches in one session. Store it as an edge (previous search → next search, with the kind of edit), derived after sessionization, not as a column on the click.
3. A nested, repeated "results" field keeps a page and its results together and scans cheaply for page-level questions; a flat result-impression table is easier to aggregate by position and result type. Either can be derived from the other.

**Follow-ups.**
1. Write the precise definition of "answered on the page" you would publish, including how you treat pages whose "results seen" event never arrived.
2. Sessionization with a {{session_gap}} gap: how do you compute it incrementally when late events keep arriving, and when is yesterday's session table final?
3. A new result type ships tomorrow. Show the schema change, the contract version, and what an analyst's existing query returns before and after.
4. Analysts want "the top refinements of query X". How do you serve it when X itself or most of its refinements fall under the {{min_users}}-user threshold?
5. At {{daily_searches}} searches a day, which table is partitioned and clustered on what, and which question does each choice make cheap?

**Follow-up rules.**
- when: nested, repeated, array, struct → ask: An analyst wants click-through by position and result type across a month. Walk through the query on your nested table and what it scans.
- when: one row per result, impression table, flat → ask: How many rows a day does that table hold at {{daily_searches}} searches, and what does a page-level question (did this page get any click?) cost on it?
- when: session id, sessionize, session_id → ask: A click for a page arrives three hours late. Does it change any session boundary, and which tables must be rewritten?
- when: query text, query string, raw query → ask: Where exactly is the {{min_users}}-user rule enforced, and how do you stop a rare query from leaking through a refinement edge or a join?
- when: dedup, reload, page_id → ask: The same search is served twice because of a reload, with two page ids. How do you decide it is one search?

**Production Reality Check.**
- A client release stops sending the "results seen" event on one platform; "answered on the page" jumps for that platform overnight and a product team celebrates a win that is a missing event.
- A new result type launched without a contract version bump; the client sends it with position 0, every organic result on those pages shifts by one position, and click-through by position for the top result drops sharply.
- A privacy review finds rare query strings in the refinement-edge table: each was common on the day it was issued, but its refinement target was issued by fewer than {{min_users}} users.

**Evaluation Criteria.** Clear grains (search/page, shown result, interaction) joined by page id; precise, reproducible definitions of refinement, click-through and answered-on-page, with missing-event handling; sessionization with a stated gap, late-data handling and a close; a reasoned choice between nested and flat shapes; contract versioning and additive evolution for new result types; the privacy threshold enforced at the point of publication, including derived tables; each incident diagnosed with a guardrail.

## GOO-L3-02: Recommendation impressions and feedback as training labels

| | |
|---|---|
| **Template ID** | GOO-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / point-in-time correctness, delayed labels, deletion propagation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "daily_impressions": {"1": ["500 million"], "2": ["5 billion", "10 billion"], "3": ["30 billion", "60 billion"]},
  "label_horizon": ["24 hours", "72 hours", "7 days"],
  "surfaces": ["the home feed and the up-next list", "the home feed, the up-next list and the short-video feed"],
  "deletion_sla": ["30 days", "60 days"]
}
```

**Business Scenario.** A video platform recommends videos on {{surfaces}}, about {{daily_impressions}} recommendation impressions a day. Viewers respond in many ways: they click or ignore, watch for some seconds or to the end, like or dislike, choose "not interested" or "don't recommend this channel", or answer an occasional satisfaction survey. The recommendation team trains models on examples of the form "this video was shown to this viewer in this context; here is what happened", with labels measured over a {{label_horizon}} horizon after the impression. Viewers can delete items from their watch history or pause it, and in this scenario deletions must be honoured in every derived dataset within {{deletion_sla}}.

**Problem Statement.** Design the data model that turns impressions and feedback into training examples. Cover: the impression record (what was shown, where, in which position, by which model version, with which candidate set), the feedback events and how each attaches to the impression that caused it, the label definitions and when a label is final, the features joined to each example as of the moment of the impression (never later), and how a history deletion or pause flows through impressions, labels, features and already-built training sets.

**Constraints.** No feature value may come from after the impression (no leakage). A label is final only after its horizon has passed; a training run must know which labels are final. A watch can start from a surface other than the impression (the viewer searched for the video later); the model must say whether that counts. Training sets must be reproducible, except where a deletion requires a change.

**Assumptions.** Volumes, horizons and the deletion window are hypothetical. Viewers are identified by a pseudonymous key. The product's public controls (watch-history deletion and pause, "not interested", "don't recommend channel") are used in their general public meaning.

**Clarifications.**
- Q: Is an impression a video that was rendered, or one that was on screen? | A: Both are logged; you decide which one is a training example and say why.
- Q: How long after an impression can a watch be credited to it? | A: Within the {{label_horizon}} horizon, and only when the watch starts from that surface; other watches are a separate signal.
- Q: Can one impression produce several feedback events? | A: Yes: a click, a watch of some length, a like, and later a "not interested" on the same video.
- Q: Does "don't recommend this channel" affect old examples? | A: It is feedback on the impression where it was given, and a filter on future candidates; it does not rewrite history.
- Q: What does a history deletion remove? | A: The watch and everything derived from it: its labels, features computed from it, and the examples that contain it.

**Hints.**
1. Log the impression with a unique id at serving time and carry that id into every client event. Joining feedback by (viewer, video, time window) instead creates double attribution.
2. Store features as they were served (a feature snapshot logged with the impression) or as effective-dated rows with a point-in-time join; either way, never join "current" features.
3. Labels are a function of feedback within a window. Materialise them as a separate table keyed by impression id with a `final_at` time, not as columns on the impression row.

**Follow-ups.**
1. Define the watch-time label precisely: which watch counts, how a rewatch or a partial watch is treated, and the label's value for an impression that was never clicked.
2. A training run starts at noon. Which impressions can it use, given the {{label_horizon}} horizon, and how does the data model tell it?
3. A viewer deletes one video from their watch history. Trace the deletion through every table and every training set built in the last {{deletion_sla}}.
4. The team wants a feature "viewer's watch count for this channel in the last 7 days" for every example. How do you compute it point-in-time correctly at {{daily_impressions}} impressions a day?
5. Two models serve the same surface in an experiment. How do you keep their examples apart, and what bias appears if you train the next model only on the winner's impressions?

**Follow-up rules.**
- when: join on video_id, viewer_id and video_id, join by viewer → ask: The same video was recommended twice in one hour on two surfaces and watched once. Which impression gets the watch under your join?
- when: current features, feature table, latest features → ask: The feature table is updated hourly. Show me an example where your join leaks information from after the impression.
- when: label column, update the impression, update label → ask: A like arrives two days after the impression. Which row changes, and how does a training run that already read it stay reproducible?
- when: delete, deletion, tombstone, purge → ask: The deleted watch is inside a training set that a model was already trained on. What does your design do with the set, and with the model?
- when: survey, satisfaction → ask: Surveys reach a tiny fraction of impressions. How do you store them so they are usable as labels without biasing the rest?

**Production Reality Check.**
- A training run used impressions from the last hours, before their {{label_horizon}} horizon had passed; recent examples look like non-watches, and the new model quietly learns to under-rank fresh uploads.
- A client release drops the impression id from watch events on one surface; a fallback join on viewer and video credits each watch to every impression of that video that day, and watch-time labels for that surface inflate while the other surfaces look unchanged.
- An audit finds deleted watches still present in a feature table rebuilt from a backup taken before the deletions, beyond the {{deletion_sla}} commitment.

**Evaluation Criteria.** Impression id generated at serving and carried through every event; feedback attached by id with a stated surface rule; labels in their own table with explicit horizons and finality; point-in-time features (logged snapshot or effective-dated join) with leakage named; reproducible training sets with a defined change path for deletions; deletion propagation through raw, derived, features and training sets, including backups; experiment and selection bias named; each incident handled with containment and a guardrail.

## GOO-L3-03: Unique reach and frequency for ad campaigns

| | |
|---|---|
| **Template ID** | GOO-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / non-additive measures, mergeable sketches, privacy thresholds |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_impressions": {"2": ["3 billion", "8 billion"], "3": ["40 billion", "90 billion"]},
  "campaigns": ["200,000", "2 million"],
  "min_audience": [50, 100, 1000],
  "max_range_days": [92, 366]
}
```

**Business Scenario.** An advertising platform shows video and display ads, about {{daily_impressions}} impressions a day across {{campaigns}} active campaigns. Advertisers want **unique reach** (how many distinct people saw the campaign) and **frequency** (how many saw it once, twice, three or more times) for any date range up to {{max_range_days}} days, by campaign, ad group, country, device type and age bracket, and across a chosen set of campaigns ("how many people did my two campaigns reach together, and how many saw both?"). In this scenario a reach number below {{min_audience}} people is never shown.

**Problem Statement.** Design the data model that serves these numbers. Explain why reach cannot be stored as a daily count and summed, and choose what to store instead: exact per-person aggregates, mergeable cardinality sketches (for example HyperLogLog, which public analytical warehouses expose as aggregate functions that build and merge sketches), or a combination. Define the grain of each stored aggregate, how a date range, a dimension filter and a set of campaigns are answered, how frequency is answered (a cardinality sketch alone cannot), how accuracy is stated to advertisers, and how the privacy threshold is applied to every number, including differences between numbers.

**Constraints.** Arbitrary date ranges must answer in under 2 seconds. Totals in a report must not contradict each other in ways an advertiser notices (reach for two campaigns together never exceeds the sum of their reaches). Late impressions (up to 3 days) and invalid-traffic removals (up to 14 days later) change past days. Person identity is a pseudonymous key per signed-in user or device; cross-device matching is out of scope.

**Assumptions.** Volumes, thresholds and ranges are hypothetical, as is the dimension list. Sketch precision is a parameter you choose; quote its relative error as about 1.04/√m for m registers, as the HyperLogLog literature does.

**Clarifications.**
- Q: Is an approximate number acceptable? | A: Yes for reach, if you state the error and the report stays consistent; billing never uses reach.
- Q: Can an advertiser pick any combination of dimensions? | A: Any one or two of the listed dimensions, plus date range and campaign set.
- Q: Do invalid-traffic removals have to change reach? | A: Yes. Removed impressions must not count, including in past days already reported.
- Q: Is "people who saw both campaigns" required? | A: Yes, as an overlap figure, with the same threshold applied.
- Q: Which frequency buckets? | A: 1, 2, 3, 4–5, 6–10 and 11+, for the chosen range.

**Hints.**
1. Distinct counts are not additive across days, campaigns or dimensions. Sketches are mergeable: store one per (day, campaign, dimension slice) and union them at query time.
2. Intersections by inclusion–exclusion (|A| + |B| − |A ∪ B|) inherit the error of all three estimates; small overlaps can come out negative.
3. Frequency needs per-person counts over the range. Either keep a per-person, per-campaign, per-day count table and aggregate it for the range, or precompute fixed ranges; say which ranges you can afford exactly.

**Follow-ups.**
1. Choose the sketch precision and compute the storage for one year at your grain. What does doubling precision cost and buy?
2. Invalid-traffic removal arrives 14 days later for 0.4% of one day's impressions. Which stored objects do you rebuild, and how does an advertiser see the change?
3. An advertiser compares reach for "country = X" and "country = X and device = mobile" and subtracts them. How can that difference expose fewer than {{min_audience}} people, and what do you do about it?
4. Serve exact frequency buckets for a custom {{max_range_days}}-day range for a campaign with 300 million impressions. What do you precompute, and what is computed on demand?
5. Two campaigns' overlap is estimated as negative. What do you show, and how do you keep reach(A ∪ B) ≤ reach(A) + reach(B) on screen?

**Follow-up rules.**
- when: hyperloglog, hll, sketch, approx_count_distinct → ask: What precision do you pick, what relative error does it give, and how do you tell an advertiser the number is approximate without confusing them?
- when: count distinct, exact distinct, distinct users → ask: Run your exact query for a {{max_range_days}}-day range over {{daily_impressions}} impressions a day. What does it scan and how long does it take?
- when: sum of daily reach, daily reach, add up → ask: A person sees the campaign on Monday and Tuesday. How many times does your weekly reach count them?
- when: inclusion-exclusion, overlap, intersection → ask: Both campaigns reach about 40 million people and overlap by 30,000. What is the error on your overlap estimate compared with the overlap itself?
- when: threshold, k-anonymity, minimum audience → ask: Your threshold hides small cells. Show how an advertiser can recover a hidden cell by subtracting two visible ones, and how you stop it.

**Production Reality Check.**
- After a precision change in the sketch builder, sketches built before and after cannot be merged; reports whose ranges cross the change date fail, and a hurried fix that casts old sketches mixes precisions silently.
- Invalid-traffic removals for one day were applied to the daily impression totals but not to the stored sketches; reach for that day stays above the number of valid impressions for some small ad groups.
- A researcher shows that by querying overlapping country and device slices for a campaign whose total reach is just above {{min_audience}}, it is possible to isolate a group of fewer than ten people.

**Evaluation Criteria.** States why reach is non-additive before choosing storage; sketch grain and precision chosen with storage and error computed; date ranges, slices and campaign sets answered by merging; frequency solved separately with an honest cost; late data and invalid-traffic removal handled by rebuilding the affected grain; consistency rules on screen (no negative overlaps, union bounded); the threshold applied to published numbers and to differencing attacks; each incident traced to its cause with a guardrail.

## GOO-L3-04: Places that merge, close and move — a place-visit model

| | |
|---|---|
| **Template ID** | GOO-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / entity identity and merges, SCD type 2, privacy-thresholded aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "places": {"1": ["20 million"], "2": ["150 million", "250 million"], "3": ["300 million", "500 million"]},
  "daily_visits": {"1": ["50 million"], "2": ["400 million"], "3": ["1.5 billion", "3 billion"]},
  "min_visitors": [20, 50],
  "history_weeks": [12, 26, 52]
}
```

**Business Scenario.** A maps product lists about {{places}} places (shops, restaurants, parks, stations), each with a name, category, location, opening hours and status (open, temporarily closed, permanently closed). Listings change constantly: owners edit hours, two duplicate listings are merged into one, a business moves to a new address, a place closes and a different business opens at the same spot. From users who have opted in to location history, the product infers about {{daily_visits}} place visits a day, and it publishes an hourly "how busy is it usually" profile per place, built from the last {{history_weeks}} weeks. In this scenario an hour's profile value is published only when at least {{min_visitors}} distinct visitors contribute to it over the window.

**Problem Statement.** Design the data model. Cover: the place entity and its identity (what a place id means, what happens to ids on a merge, a split or a move), the history of place attributes (which changes are type 2 history and which are corrections), the visit fact (grain, keys, the confidence of the inference, and which place version it refers to), and the busyness aggregate (grain, how it is rebuilt as visits age out of the {{history_weeks}}-week window, and how the privacy threshold is applied). Then show how an analyst answers "visits per week for this café for the last year" when the café was merged with a duplicate listing four months ago.

**Constraints.** A place id given to an external caller must keep working after a merge (it resolves to the surviving place). Visit history must follow a merge but must not follow a closure followed by a new business at the same location. Raw visits are kept for at most {{history_weeks}} weeks; only aggregates live longer. Opening-hours edits must not rewrite which hours visits happened in.

**Assumptions.** Counts, windows and thresholds are hypothetical. Visit inference (from location to a place, with a confidence score) exists upstream and is out of scope; it can be re-run with a better model. Public maps platforms document that a place's id can become obsolete and should be refreshed; that general behaviour is assumed here.

**Clarifications.**
- Q: When two listings merge, which id survives? | A: One of them, chosen by the listings team. The other becomes an alias that resolves to it.
- Q: Is a moved business the same place? | A: In this scenario yes, if the listing says it moved; a closure followed by a new business is a new place, even at the same address.
- Q: Can a merge be undone? | A: Yes, rarely (two listings were wrongly merged). Model it so that it is possible.
- Q: Do visits store coordinates? | A: No. A visit stores the place reference, the visit window rounded to the hour, a confidence, and a pseudonymous visitor key that rotates.
- Q: Does a temporarily closed place still get a busyness profile? | A: It keeps its history but publishes nothing while closed.

**Hints.**
1. Separate the stable surrogate key from the externally visible ids. An alias (redirect) table maps every id ever issued to the current surviving key, with the time of the merge.
2. Attribute history (name, category, hours, location) is type 2 on the surrogate key; corrections of wrong data are a different operation from real changes and should be recorded as such.
3. Store visits against the place as it was identified when the visit was inferred, and resolve to the surviving entity at query time through the alias table, so a merge (or its reversal) never rewrites the visit fact.

**Follow-ups.**
1. Write the query shape for "visits per week for the last year" across a merge, and show what changes if the merge is reversed next week.
2. A place's category changes from "café" to "bakery". Which reports should see the old value for old visits, and which the new one for all visits?
3. The visit-inference model is improved and re-run over the last {{history_weeks}} weeks. How do you replace visits and aggregates without a period where both versions are counted?
4. How do you apply the {{min_visitors}}-visitor threshold when the visitor key rotates, and what does that do to the count of distinct visitors?
5. At {{places}} places and {{daily_visits}} visits a day, how do you partition the visit fact and keep the busyness rebuild incremental?

**Follow-up rules.**
- when: update place_id, rewrite visits, repoint → ask: The merge turns out to be wrong a week later. How many visit rows does your design rewrite twice, and what did reports show in between?
- when: scd, type 2, valid_from, effective → ask: A typo in a place's name is fixed. Does that create a new version in your history, and what does an analyst see when grouping by name?
- when: same address, location match, lat lng → ask: A café closes and a gym opens at the same address next month. Show how your model keeps their visit histories apart.
- when: distinct visitors, count distinct, visitor key → ask: The visitor key rotates daily. How does your threshold count distinct visitors over {{history_weeks}} weeks, and is the count an over- or under-estimate?
- when: alias, redirect, merged_into → ask: Place A was merged into B, then B into C. How does a lookup of A resolve, and how do you prevent a cycle?

**Production Reality Check.**
- A bulk merge job joined thousands of chain-store listings into one place per brand by name; their visits now resolve to a single place and its busyness profile shows a city-wide crowd.
- After a merge reversal, the alias table still sends the restored listing's old id to the other place, so an external integration shows the wrong opening hours for a week.
- A place with exactly {{min_visitors}} contributors in most hours published a profile computed with rotated visitor keys counted as distinct people, so the real number of contributors was far below the threshold.

**Evaluation Criteria.** Surrogate key distinct from external ids, an alias table with merge time, reversible merges and cycle protection; type 2 attribute history with corrections handled distinctly; visits referencing the identity at inference time and resolved through aliases at query time; closure-then-new-business modeled as a new place; a busyness aggregate with a rolling window, incremental rebuild and an honest distinct-visitor count under key rotation; retention of raw visits enforced; each incident traced with a guardrail.

## GOO-L3-05: Last-click conversion attribution, reported by click date

| | |
|---|---|
| **Template ID** | GOO-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / attribution windows, deduplication, counting rules, fan-out |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |
| **Generator** | GOO-L3-05.mjs |

**Business Scenario.** An advertiser runs search, display and video campaigns. Every ad click is recorded with the campaign and a pseudonymous `visitor_key`; the advertiser's site records conversions (purchases, sign-ups, quote requests) for the same keys and uploads them, sometimes more than once. Each conversion action has its own attribution window and counting setting in `conversion_actions`. This extract has the actions {{actions}}. The marketing team wants conversions per campaign **reported on the day of the click that earned them**, next to that day's clicks, so the cost and the result of a click land on the same day.

**Problem Statement.** Write one PostgreSQL query that returns `click_date, campaign_id, clicks, conversions, conversion_value_micros`: one row per UTC date and campaign with at least one click, ordered by `click_date, campaign_id`. The rules, applied in this order:
- **Duplicates.** {{dedup_rule}}
- **Attribution (last click).** A conversion is credited to the same visitor's click with `click_ts ≤ conv_ts ≤ click_ts + window_days` of the conversion's own action (both ends inclusive), choosing the latest such click; when two qualify at the same instant, the higher `click_id` wins. A conversion with no qualifying click is unattributed and appears nowhere.
- **Counting.** {{counting_rule}}
- **Reporting.** `click_date` is the UTC date of the credited click. `clicks` counts that date's clicks for the campaign; `conversions` counts the counted conversions credited to them, and `conversion_value_micros` sums their `value_micros` (0 when there are none).

**Constraints.** One SQL statement (CTEs allowed). PostgreSQL. The sample has {{clicks}} clicks and {{conversions}} conversion rows; production has billions of clicks a month, so say how your query would scale.

**Assumptions.** Hypothetical schema, campaigns, windows and values; money is in micros (millionths of the currency unit). Clicks and conversions are already joined to visitors by a pseudonymous key; how that key is built is out of scope. Timestamps are UTC.

**Clarifications.**
- Q: Is a conversion exactly window_days after the click still credited? | A: Yes. Both ends of the window are inclusive.
- Q: Can a click made after the conversion receive credit? | A: No. Only clicks at or before the conversion qualify.
- Q: A visitor clicked two campaigns before converting. Who gets the conversion? | A: The latest qualifying click only; this report does not split credit.
- Q: Should a campaign-day with clicks but no conversions appear? | A: Yes, with conversions 0 and value 0.
- Q: The conversion happened the day after the click. Which day is it reported on? | A: The click's day.

**Hints.**
1. Pick the credited click per conversion with `CROSS JOIN LATERAL (… ORDER BY click_ts DESC, click_id DESC LIMIT 1)`, or with `ROW_NUMBER()` over the joined candidate pairs.
2. Deduplicate before attributing, with `ROW_NUMBER()` over the duplicate key. Check what your partition does to rows whose `order_id` is NULL.
3. Aggregate clicks and conversions to (date, campaign) separately, then join: counting clicks after joining conversions multiplies them.

**Follow-ups.**
1. Rewrite the attribution without LATERAL (a range join plus `ROW_NUMBER()`). Which would you run over billions of clicks, and how would you partition or cluster the tables so the join stays local?
2. A conversion arrives 25 days after its click, inside a 30-day window. Which already-published click date changes, and how do you tell the marketing team when a day's numbers are final?
3. Replace last click with a rule that splits credit across all qualifying clicks (for example linearly). What changes in the model and in the query?
4. The advertiser also wants conversions reported by conversion date. Should that be a second table or a column on the first, and why do the two never sum to the same daily totals?

**Follow-up rules.**
- when: < click_ts +, conv_ts < → ask: A conversion lands exactly window_days after its click. Does your condition credit it, and should it?
- when: row_number, partition by order_id → ask: Two sign-ups have a NULL order_id. What does your partition do with them?
- when: count(*), count(c.click_id), left join conversions → ask: One click has three conversions. How many clicks does your query report for its campaign that day?
- when: conv_ts::date, date(conv_ts), conversion date → ask: Which day is a conversion reported on in your output, and which day should it be?
- when: min(click_ts), first click, order by click_ts asc → ask: The visitor clicked campaign A on Monday and campaign B on Tuesday, then bought on Wednesday. Who gets the credit under your query?

**Production Reality Check.**
- The site's tag fires twice on the confirmation page after a release, and every purchase is uploaded twice with the same order id but timestamps a few seconds apart; reported conversions double for campaigns whose query ignores order ids, and duplicates with a NULL order id cannot be caught at all.
- Last week's report by click date was sent on Monday; conversions that arrive during the rest of the attribution window keep raising last week's numbers, and the marketing team asks why the "same report" changes every day.

**Evaluation Criteria.** Deduplication before attribution with NULL order ids kept apart; an inclusive window per action and clicks only at or before the conversion; last click with a deterministic tie-break; the counting rule applied per click, not per visitor; reporting by click date over a click grid with zero rows kept and no fan-out; deterministic order; can discuss scale and the restatement that late conversions cause.
