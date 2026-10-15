# Pinterest · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a visual discovery
service: pins, boards and sections, saves, idea pins, visual search, shopping and product
pins, creators, ads and the home feed. Every pinner, number, rule and schema is
hypothetical, and nothing here describes how any company's systems, ranking or reporting
actually work. Pinner data appears only in aggregate, never as a profile of one person,
and no sensitive attribute is inferred from pins, boards, searches or images.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PIN-L1-01: Save rate per pin format and week, each saver of a pin counted once

| | |
|---|---|
| **Template ID** | PIN-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / distinct counting at the right grain, first-occurrence attribution, LEFT JOIN of two aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PIN-L1-01.mjs |

**Business Scenario.** A product analytics team compares how well each pin format earns saves: standard image pins, video pins, idea pins and product pins. Raw save counts flatter formats whose savers file the same pin onto several boards, so the agreed metric is **unique savers per thousand impressions**: how many distinct pinners saved each pin, summed over the format's pins, per thousand times those pins were shown. The impression job writes one daily count per pin; the save log has one row per save to a board. You are asked for the weekly table behind a format comparison chart.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, pin_format, impressions, pin_savers, savers_per_1k`, one row per week and format with impressions, ordered by `week_start, pin_format`. Weeks start on Monday at 00:00 UTC; `week_start` is that Monday's date. `impressions` is the sum of the format's daily pin impressions in the week. `pin_savers` counts distinct (pin, pinner) pairs saved in the week: a pinner who saves one pin to three boards is one saver of that pin, and a pinner who saves two different pins of the format is two. `savers_per_1k` is `1000 × pin_savers / impressions`, rounded to 2 decimal places. A format-week with impressions and no saves is a row with 0 savers. {{week_rule}} {{load_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{pins}} pins and {{saves}} save rows. Every format-week that has a save also has impressions.

**Assumptions.** Formats, counts and the metric are hypothetical and defined for this exercise only; they do not describe any product's reporting. The data holds no information about pinners beyond an opaque id, and the result is aggregated by format.

**Clarifications.**
- Q: Is a week Monday to Sunday in UTC? | A: Yes. A save at Sunday 23:59:59 UTC belongs to the earlier week, one at Monday 00:00:00 to the next.
- Q: One pinner saved the same pin to three boards. How many savers? | A: One.
- Q: One pinner saved two different video pins. How many savers? | A: Two. The unit is the pair (pin, pinner), not the pinner alone.
- Q: Impressions are per pin and day. Do I count distinct pins? | A: No. Sum the daily counts of every pin of the format in the week.
- Q: A format had impressions but nobody saved its pins that week. | A: Return it with `pin_savers = 0` and `savers_per_1k = 0`.
- Q: How do I round? | A: `ROUND(…, 2)` on a numeric, so half away from zero.

**Hints.**
1. Aggregate impressions and savers separately, then join them; joining saves to daily impressions before aggregating multiplies rows.
2. `COUNT(DISTINCT (pin_id, pinner_id))`, or reduce saves to one row per pair first, gives savers at the right grain.
3. Hard: reduce each pair to its first save with `MIN(saved_at)` before taking the week.
4. Very Hard: pick each pin-day's latest load with `DISTINCT ON (pin_id, impression_date) … ORDER BY …, loaded_at DESC` before summing.

**Follow-ups.**
1. The chart should also show the weekly change in `savers_per_1k`. Add it without a second pass over the data, and say what the first week shows.
2. Product pins are shown mostly on shopping surfaces. Why can comparing formats by one ratio still mislead, and what would you add to the table to make the comparison fair?
3. At billions of impressions and saves a week, how would you keep "first save of a pair" correct incrementally, when a pair's first save may have been months ago?
4. The impression job reloads days when late logs arrive. How would you make the weekly table restate only the weeks that changed, and show readers that a week was restated?

**Follow-up rules.**
- when: count(*), count(save_id) → ask: One pinner saves a pin to three boards. What does your count give for that pin, and what does the metric want?
- when: count(distinct pinner_id) → ask: Distinct over pinner alone: one pinner saves two different video pins in a week. How many savers does your query count, and how many should it?
- when: join, inner join → ask: Where does a format with impressions and no saves end up in your result, and in which order are you joining the two aggregates?
- when: avg, average → ask: Is the format's rate the average of per-pin rates, or total savers over total impressions? What happens to a pin with 20 impressions and 3 savers under each?
- when: min(saved_at), first save → ask: Your first save is computed inside the two weeks shown. What happens to a pair whose first save was before the window, and how would you fix that in production?

**Evaluation Criteria.** Savers counted as distinct (pin, pinner) pairs; impressions and savers aggregated separately and left-joined so zero-saver format-weeks stay; Monday-based UTC weeks; first-save attribution across weeks (Hard+); the latest load per pin-day (Very Hard); correct numeric rounding; deterministic order; can discuss the fairness of a single ratio and incremental first-save state.

## PIN-L1-02: Visual search success per entry point: a save or closeup within 10 minutes

| | |
|---|---|
| **Template ID** | PIN-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / time-bounded EXISTS, LEAD to end a window at the next event, counting entities not join rows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | PIN-L1-02.mjs |

**Business Scenario.** Visual search lets a pinner search with a picture instead of words, and it can be started three ways: the **camera**, a **crop** drawn on a pin they are looking at, or an **uploaded** image. The search team wants to know which entry point leads to searches that help, using a simple proxy agreed for this exercise: a search is **successful** if the same pinner saves a pin or opens one in closeup within 10 minutes of it. The search log records who searched, how and when, and for a crop the pin it was drawn on. It never stores the image itself, and nothing in this exercise needs it.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, entry_point, searches, successful_searches, success_rate`, one row per week and entry point with at least one search, ordered by `week_start, entry_point`. Weeks start on Monday at 00:00 UTC; `week_start` is that Monday's date, taken from `searched_at`. A search is successful if `pin_actions` has a `save` or `closeup` by the same pinner with `action_ts` at or after `searched_at` and at most 10 minutes after it (exactly 10:00 counts). `outbound_click` never counts. A search counts once however many actions follow it. `success_rate` is `successful_searches / searches` rounded to 4 decimal places. {{next_rule}} {{crop_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{searches}} searches and {{actions}} actions. No pinner has two searches at the same instant.

**Assumptions.** Entry points, the 10-minute window and the success proxy are hypothetical and chosen for this exercise; a save or closeup is not proof that a search helped. The tables carry opaque ids only. No image, image feature or inference about the pinner is stored or needed, and results are aggregated by entry point.

**Clarifications.**
- Q: Can an action by a different pinner make a search successful? | A: No. Same pinner only.
- Q: An action at exactly 10 minutes after the search? | A: It counts. One at 10 minutes and 1 second does not.
- Q: An action a minute before the search? | A: It does not follow the search, so it does not count.
- Q: Does an outbound click count? | A: No. Only `save` and `closeup`.
- Q: A search followed by a closeup and then a save? | A: One successful search.
- Q: How is the rate rounded? | A: `ROUND(…, 4)` on a numeric.

**Hints.**
1. Decide success per search first (one row per search with a boolean), then aggregate; a plain join to actions multiplies searches.
2. `EXISTS (SELECT 1 FROM pin_actions a WHERE a.pinner_id = s.pinner_id AND … )` with both window bounds is the simplest correct shape.
3. Hard: `LEAD(searched_at) OVER (PARTITION BY pinner_id ORDER BY searched_at)` gives each search's next search; the action must come strictly before it.

**Follow-ups.**
1. Product asks for the median time from search to first save per entry point. Change your query, and say what happens to searches with no save.
2. The 10-minute proxy is arbitrary. How would you choose the window from data, and how would you check that the comparison between entry points does not flip with it?
3. Camera searches are mostly on phones and uploads mostly on the web. How would you separate the effect of the entry point from the effect of the device?
4. At hundreds of millions of searches a week, the EXISTS becomes a large range join. How would you compute success in a stream, and what state does each pinner need?

**Follow-up rules.**
- when: left join, join pin_actions → ask: A search has a closeup and a save inside the window. How many rows does your join produce for it, and how do you count it once?
- when: between → ask: BETWEEN is inclusive on both ends. Which of your two bounds should be inclusive here, and does the next-search bound need to be exclusive?
- when: lead → ask: An action happens at exactly the same second as the pinner's next search. Which search does your query give it to?
- when: interval → ask: You add an interval to a timestamptz. Would anything change if the session time zone were not UTC, for the window or for the week?
- when: image, photo, embedding → ask: The success metric needs none of that. What would storing the pinner's image add to the risk, and what would you keep instead?

**Evaluation Criteria.** Success decided once per search with EXISTS or an equivalent semi-join; the window inclusive at both ends, same pinner, saves and closeups only; Monday-based UTC weeks from the search time; the window ended at the pinner's next search (Hard+); actions on a crop's source pin excluded (Very Hard); correct rounding and order; can discuss the proxy's limits and a streaming version.

## PIN-L1-03: Fresh-pin share of home feed impressions, a repin as old as its original

| | |
|---|---|
| **Template ID** | PIN-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / self-join to the original row, strict interval boundaries, deduplicating retried logs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PIN-L1-03.mjs |

**Business Scenario.** A home feed team wants to know how much of what pinners see is **fresh**: recently created ideas rather than pins that have circulated for years. Which pins the feed shows is decided by a scoring function you are given and is out of scope here; this question only measures what was shown. The catch is repins: when a pinner saves an existing pin, a new pin row is created that points to the original, so a repin made an hour ago can carry an idea that is two years old. For this exercise's rule (hypothetical, agreed with the team), a repin is as old as its original.

**Problem Statement.** Write one PostgreSQL query that returns `impression_date, country, impressions, fresh_impressions, fresh_share`, one row per UTC date of `impression_ts` and country, ordered by `impression_date, country`. An impression is **fresh** if it happened less than {{fresh_days}} days (exactly {{fresh_days}} × 24 hours) after the start of its pin's original: for an original pin (`original_pin_id` is NULL) that is the pin itself; for a repin it is the pin `original_pin_id` points to, which is always an original. An impression exactly {{fresh_days}} days after the start is not fresh. `fresh_share` is `fresh_impressions / impressions`, rounded to 4 decimal places. {{sched_rule}} {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{pins}} pins and {{logs}} impression log rows. `original_pin_id` never points to another repin.

**Assumptions.** Pins, countries, counts and the freshness rule are hypothetical; they do not describe how any feed ranks or reports. Country is the viewer's country as logged with the impression, used only for this aggregate; the data holds no information about who saw the pin.

**Clarifications.**
- Q: A repin created yesterday of a pin created last year: fresh? | A: No. It is as old as its original.
- Q: What exactly is the window? | A: Strictly less than {{fresh_days}} × 24 hours between the original's start and the impression. At exactly that difference it is no longer fresh.
- Q: Which day does an impression belong to? | A: The UTC date of `impression_ts`.
- Q: Can a repin point to another repin? | A: Not in this data: `original_pin_id` always names an original.
- Q: How is the share rounded? | A: `ROUND(…, 4)` on a numeric.

**Hints.**
1. Join each impression's pin to its original with `COALESCE(original_pin_id, pin_id)`, then compare times on the original.
2. Write the window as `impression_ts < start + INTERVAL '… days'`, so the boundary is exclusive by construction.
3. Hard: reduce the log to one row per `impression_id` before counting.
4. Very Hard: the original's start is `COALESCE(published_at, created_at)`.

**Follow-ups.**
1. The team also wants the share of impressions that showed a repin rather than an original, per country and day. Add it, and say why it is a different question from freshness.
2. Suppose `original_pin_id` could point to another repin (a chain of saves). What changes in your query, and how deep can chains get before it matters?
3. Freshness by creation time penalises an old idea that becomes relevant again each season. How would you define and measure "fresh to this pinner" without profiling anyone, using only aggregates?
4. The impression log is billions of rows a day and the pins table is billions of rows. How would you avoid joining the whole pins table every day?

**Follow-up rules.**
- when: p.created_at, created_at of the pin → ask: A repin made an hour ago of a pin from last year: which creation time does your query compare against, and what does the rule say?
- when: <=, between → ask: An impression lands exactly {{fresh_days}} days after the original's start. Does your query call it fresh, and should it?
- when: count(distinct impression_id) → ask: That fixes the total. Does your fresh count also dedupe, or can a retried fresh impression still be counted twice?
- when: interval → ask: Is adding a day-based interval to a timestamptz always 24 hours? When would it not be, and why is it safe here?
- when: recursive, with recursive → ask: The data guarantees one hop. What would a recursive CTE cost on a billion-row pins table, and how would you store the root instead?

**Evaluation Criteria.** Every impression dated by its original's start through `COALESCE(original_pin_id, pin_id)`; a strict upper bound at exactly {{fresh_days}} days; UTC dates from the impression; duplicates counted once by `impression_id` (Hard+); the scheduled publish time as the start (Very Hard); correct rounding and order; can discuss repin chains, seasonal relevance without profiling, and the join at scale.

## PIN-L1-04: Distinct savers of a pin over many date ranges

| | |
|---|---|
| **Template ID** | PIN-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Offline range queries / sorting queries by right end, last occurrence per key, Fenwick tree |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | PIN-L1-04.mjs |

**Business Scenario.** A creator looking at their own pin's analytics can pick any date range and see how many different pinners saved it in that range: a launch week, a holiday season, the months since a redesign. Saves are not unique per pinner (people save the same pin to several boards, or again a year later), so the number is a distinct count, and distinct counts do not add up across days. A nightly job precomputes the answers for the ranges creators look at most, tens of thousands of ranges over years of saves, and it has to finish in seconds.

**Problem Statement.** Implement `distinct_savers(saves, queries)`. Each save is `(pin_id, day, pinner_id)`; `day` is a whole day number. Each query is `(pin_id, first_day, last_day)`. Return a list with one integer per query, in query order: the number of distinct pinners who saved that pin on at least one day from `first_day` to `last_day`, both inclusive. {{order_rule}}

**Constraints.** Up to 200 000 saves, 50 000 queries and 3 000 distinct days; ranges are long (a third of the data on average). Building a set of pinners for each range is far too slow; aim for O((n + q) log n).

**Assumptions.** Pins, pinners, days and volumes are hypothetical. Pinner ids are opaque; the result is a count, shown only to the pin's own creator, and never says who saved.

**Clarifications.**
- Q: A pinner saved the pin three times in the range. | A: One pinner.
- Q: A pinner saved inside the range and again after it. Do they count? | A: Yes. One save inside the range is enough.
- Q: Are both ends inclusive? | A: Yes. `(pin, 5, 5)` asks about day 5 only.
- Q: Can I answer the queries in a different order than given? | A: Yes, as long as the returned list follows the input order.
- Q: Do I need to support new saves arriving between queries? | A: No. Everything is known up front; the job is offline.

**Hints.**
1. Distinct counts do not subtract: `count(1..b) − count(1..a−1)` is wrong, because a pinner can appear on both sides.
2. Sort the queries by `last_day` and sweep the saves in day order. For each pinner, only their latest save so far matters.
3. Mark each pinner's latest save day with a 1 (and remove the mark from their previous latest day). For a query ending at the current day, the answer is the number of marks on days ≥ `first_day`.
4. A Fenwick (binary indexed) tree over the distinct days gives both the update and the "marks before `first_day`" count in O(log D).

**Follow-ups.**
1. Prove that counting latest saves on days ≥ `first_day` gives exactly the distinct pinners in the range, once all saves up to `last_day` have been swept.
2. The dashboard is interactive: ranges arrive one at a time and must be answered immediately. What changes, and what does a persistent segment tree buy you?
3. Creators accept "about 12 400" for very large pins. How would an approximate distinct count (for example HyperLogLog sketches per day) answer arbitrary ranges, and how large is the error?
4. Saves can be deleted when a pinner removes a pin from a board. Should the count change, and how would your structure handle deletions?

**Follow-up rules.**
- when: set(, set per → ask: How many pinners does your set hold for an average range, and how many ranges are there? What is the total work?
- when: prefix count, prefix sums → ask: A pinner saved on day 3 and day 9. Your prefix counts for 1..9 and 1..4 both include them. What does subtracting give for the range 5..9?
- when: mo's, sqrt decomposition → ask: What is the cost of moving the window in your order, and how does it compare with a single sweep by right end?
- when: fenwick, binary indexed → ask: Your tree is indexed by what: save rows, day numbers or distinct days? What does that choice cost in memory over three years of saves?
- when: hyperloglog, approximate → ask: Can you merge sketches for an arbitrary range quickly, and what is the error for a range with 50 savers?

**Evaluation Criteria.** Recognises that distinct counts are not prefix-subtractable; offline sweep by right end with each pinner's latest save marked; a Fenwick tree (or segment tree) for the count; O((n + q) log n); inclusive bounds; answers returned in input order; repeated saves, empty ranges and unordered input handled (Hard); per-pin separation and unknown pins (Very Hard); can discuss online queries and approximate sketches.

## PIN-L1-05: Busier-day lookback: days back to the last day with more saves

| | |
|---|---|
| **Template ID** | PIN-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Stacks / previous strictly greater element with a monotonic stack, grouping and summing rows per key |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PIN-L1-05.mjs |

**Business Scenario.** A creator's analytics page annotates each day of a pin's history with a short note: "best day in 41 days", or "best day ever" when no earlier day beat it. Evergreen pins collect saves for years (recipes, home projects, seasonal ideas), so a pin's history can run to thousands of days, and the nightly job annotates every pin a creator owns. The annotation is the distance back to the most recent earlier day that had more saves.

**Problem Statement.** Implement `busier_lookback(rows)`. Each row is `(pin_id, day, saves)`: `day` is a whole day number and `saves` the number of saves that day. Return a dict mapping every pin to a list with one integer per listed day of that pin, in increasing day order: `day − d`, where `d` is the latest earlier listed day of the same pin with **strictly more** saves, or `0` if no earlier day had more. A day with the same number of saves is not busier. {{day_rule}}

**Constraints.** Up to 100 pins of 3 000 days each in one call. Many pins open with a busy launch day and then climb slowly, with long stretches of equal days, so scanning back from each day is quadratic; aim for O(n) after grouping (O(n log n) if you sort).

**Assumptions.** Pins and save counts are hypothetical. The result describes a pin, is shown only to that pin's own creator, and uses daily totals, never who saved.

**Clarifications.**
- Q: Two days with the same saves: is the earlier one busier? | A: No. Strictly more saves only.
- Q: What do I return for the first day of a pin? | A: 0: no earlier day exists.
- Q: Could the answer be 0 for a reason other than "no busier day"? | A: No. A busier day is always at least one day earlier, so 0 only ever means none.
- Q: Do pins affect each other? | A: No. Each pin's history is separate.
- Q: Is the output in day order? | A: Yes, one value per listed day of the pin, from its first day to its last.

**Hints.**
1. For each day, which earlier days can ever be the answer for a later day? A day followed by a day with at least as many saves can never be the answer again.
2. Keep a stack of (day, saves) whose saves strictly decrease from bottom to top. Pop while the top has saves ≤ today's; whatever is left on top is the busier day.
3. Each day is pushed and popped at most once, so the pass is linear per pin.
4. Hard and Very Hard: group rows per pin into a dict of day → summed saves first, then sort the days.

**Follow-ups.**
1. Prove the stack never discards a day that some later day needs.
2. Creators also want "best day in N days" for the next busier day forward ("held the record for 12 days"). How do you compute both in one or two passes?
3. Annotations are recomputed nightly for every pin. Most pins gain one new day. How would you update the stored stack incrementally instead of recomputing years of history?
4. The same lookback across all pins of a board (summing pins per day) is requested. What changes, and what breaks if pins are added to the board later?

**Follow-up rules.**
- when: while j, scan back, nested loop → ask: A pin has a launch spike on day 1 and then climbs slowly for six years. How many comparisons does your scan do for the last day, and in total?
- when: max(, running max → ask: A running maximum answers "best day ever". What does it tell you for a day that is not a record, and what do you still have to find?
- when: stack → ask: When you pop, is the condition `<` or `<=`? What goes wrong for equal days with the other one?
- when: index → ask: Is the lookback the difference in list positions or in day numbers? When are they different?
- when: sparse table, binary search → ask: That works in O(n log n). What does the stack give you that it does not, and is it worth the memory?

**Evaluation Criteria.** A monotonic stack per pin (or an equivalent amortised linear method) for the previous strictly greater day; `<=` when popping so equal days are skipped; 0 when the stack is empty; O(n) per pin after grouping; calendar-day differences with gaps (Hard+); summed duplicate days and unordered rows (Very Hard); pins kept separate; can prove the stack invariant and extend it forward and incrementally.
