## NFX-L1-01: Early abandonment by title and country, with a minimum-plays floor

| | |
|---|---|
| **Template ID** | NFX-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps and islands with LAG, conditional aggregation, HAVING floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | NFX-L1-01.mjs |

**Business Scenario.** A global video streaming service wants to know where viewers give up on a title almost as soon as they press play. A high early-stop rate in one country can point to a missing dub, poor subtitles or artwork that sets the wrong expectation. The player logs every play with how far into the title it got. Small counts are noisy, so a title and country pair is only reported once it has enough plays.

**Problem Statement.** Write one PostgreSQL query that returns `title_id, country, plays, early_stops, early_stop_rate`: one row per title and country with at least {{min_plays}} counted plays, ordered by `early_stop_rate` descending, then `title_id`, then `country`. A play is an **early stop** when its furthest playback position is below {{n_min}} minutes ({{n_sec}} seconds); a play that reaches exactly {{n_min}} minutes is not an early stop. For a single play, its furthest position is `end_position_s`. `early_stop_rate` is `early_stops / plays`, rounded to 4 decimal places. {{session_rule}} {{resume_rule}}

**Constraints.** One SQL statement (CTEs allowed). Positions are seconds into the title; `stopped_at − started_at` is wall-clock time and includes pauses, so it is not how far someone watched. The sample has {{plays}} rows in `plays`; production has billions of plays a day across every country the service operates in.

**Assumptions.** Titles, profiles, countries, thresholds and the session rule are hypothetical and simpler than any production definition. In this sample all of a profile's plays are in one country. `runtime_min` is there for context; the query does not need it.

**Clarifications.**
- Q: Can I use `stopped_at − started_at` as the time watched? | A: No. Wall-clock time includes pauses and buffering. Use the playback position, which says how far into the title the viewer got.
- Q: Is the floor inclusive? | A: Yes. A title and country with exactly the floor of counted plays is reported.
- Q: Is a play that reached exactly N minutes an early stop? | A: No. Early means strictly below N minutes.
- Q: Which country does a play belong to? | A: `plays.country`, where it was watched, not where the title was produced.
- Q: Should a title with no plays in a country appear with zeros? | A: No. Only pairs with at least the floor of counted plays appear.
- Q: How is the rate rounded? | A: `ROUND(early_stops::numeric / plays, 4)`, half away from zero; avoid integer division.

**Hints.**
1. At the simplest level this is one `GROUP BY title_id, country` with `COUNT(*) FILTER (WHERE …)` and a `HAVING` for the floor.
2. To build sessions, compare each play with the previous play of the same profile and title (`LAG(stopped_at)`), flag the plays that start a new session, and number the sessions with a running `SUM` of the flags (gaps and islands).
3. A session's furthest position is `MAX(end_position_s)`; its first play is the earliest by `started_at, play_id` (`(ARRAY_AGG(… ORDER BY …))[1]` or `ROW_NUMBER`).

**Follow-ups.**
1. Product wants the same report for the first 30 seconds and the first 5 minutes, by device type. What changes, and which rows would the floor hide in small countries?
2. For series, many viewers stop an episode early because they skip a recap or jump to the next episode. How would you separate that from abandonment?
3. At billions of plays a day, how would you build sessions incrementally when a session can cross the daily partition boundary at midnight?
4. A title's early-stop rate rises the week its artwork changed. What would you need before calling the artwork the cause?

**Follow-up rules.**
- when: lag, lead → ask: Your LAG compares a play with the previous one by start time. If two plays of one profile and title overlapped on two devices, is the previous play's stop still the right boundary for the gap?
- when: duration, wall-clock, stopped_at - started_at → ask: Someone paused for an hour at minute 1 and then stopped. What does a wall-clock duration say about how far they watched?
- when: having → ask: What does the floor protect against, and what would you show a product manager for the pairs it hides?
- when: avg, average → ask: Is the rate the average of per-profile rates or the ratio of the totals? Which one answers the product question, and do they differ here?
- when: row_number → ask: What is in the ORDER BY of your ROW_NUMBER, and what happens when two plays of a profile start in the same second?

**Evaluation Criteria.** Playback position, not wall-clock time; strict "below N minutes" and an inclusive floor; the ratio rounded without integer division; deterministic ordering. At Hard: previews removed before sessions are built; sessions by gaps and islands with the gap boundary inclusive; a session judged by its furthest position. At Very Hard: resumed sessions left out of both counts. Can discuss recap skipping, incremental sessionisation across partitions, and causality.

## NFX-L1-02: Rising titles: week-over-week share-of-viewing gain per country

| | |
|---|---|
| **Template ID** | NFX-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / share of total with window sums, RANK with ties, half-open week ranges |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | NFX-L1-02.mjs |

**Business Scenario.** A global video streaming service wants a "rising this week" signal per country: titles that took a larger share of the country's viewing this week than last week. Share, not raw minutes, because a holiday week lifts every title at once. A minimum number of distinct viewers keeps one household's weekend binge from making a title look like it is rising.

**Problem Statement.** Write one PostgreSQL query that compares the week starting Monday {{week_start}} with the week starting {{prev_week_start}} (weeks are UTC and half-open: from Monday 00:00:00 up to, not including, the next Monday 00:00:00; a session belongs to the week that contains its `started_at`). A title's **share** in a country and week is `ROUND(100.0 × its minutes_viewed / all minutes_viewed in that country and week, 2)`, a percentage; a title with no sessions in the previous week has a previous share of 0. `gain_pts` is the current share minus the previous share (of the rounded shares). A title is a **candidate** in a country when it has at least {{min_viewers}} viewers there in the current week and `gain_pts > 0`. Rank candidates within each country by `gain_pts` descending with RANK semantics (equal gains share a rank, and the next rank skips), and return every candidate with rank {{top_k}} or better: `country, title_id, prev_share_pct, curr_share_pct, gain_pts, gain_rank`, ordered by `country, gain_rank, title_id`. {{viewer_rule}} {{week_rule}}

**Constraints.** One SQL statement (CTEs allowed). The denominator of a share is every minute viewed in the country that week, including titles that are not candidates. Ties are kept even when that returns more than {{top_k}} rows for a country. The sample has {{sessions}} sessions.

**Assumptions.** Titles, profiles, minutes and thresholds are hypothetical. Share of viewing here is a simplified metric for the exercise, not a published methodology. Countries are the session's country; a profile is one viewer.

**Clarifications.**
- Q: Is a session at Monday 00:00:00 in the old week or the new one? | A: The new one. Weeks are half-open: [Monday 00:00:00, next Monday 00:00:00).
- Q: Do titles below the viewer threshold still count in the denominator? | A: Yes. The share is of all viewing in the country that week.
- Q: A title had no viewing last week. Is it dropped? | A: No. Its previous share is 0, so all of its current share is gain.
- Q: Two titles tie for the last place in the top K. Which one goes? | A: Neither. Both share the rank and both are returned.
- Q: Do I rank on the rounded or the unrounded gain? | A: On `gain_pts`, the difference of the two rounded shares.
- Q: Does a profile that watched a title three times count three times toward the threshold? | A: No. It is one viewer.

**Hints.**
1. Aggregate minutes per (country, title, week) first; `SUM(minutes) OVER (PARTITION BY country, week)` then gives the denominator without a second pass.
2. Put the two weeks side by side with a LEFT JOIN from this week to last week (or conditional aggregation), and `COALESCE` the missing previous share to 0.
3. Count viewers from the raw sessions of the current week (`COUNT(DISTINCT profile_id)`, or group by profile first when a viewer needs a minimum), then filter, then rank with `RANK()`.

**Follow-ups.**
1. Viewers in Tokyo and São Paulo do not share a Monday. What changes if each country's week runs in its own local time, and which sessions move between weeks?
2. At billions of sessions a week, exact distinct viewers per title and country are expensive. Where would an approximate distinct count be acceptable, and where, near the threshold, would it not?
3. A new season launches on Friday. Is a week-over-week gain fair to it, and what would you compare against instead?
4. How would you make the weekly result reproducible when late-arriving sessions from offline downloads keep changing last week's numbers?

**Follow-up rules.**
- when: dense_rank → ask: Two titles tie for first place. With DENSE_RANK, which rank does the next title get, and how many titles end up in the top K?
- when: row_number → ask: Two titles have exactly the same gain at the cut-off. Which one does ROW_NUMBER keep, and is that a decision you want the database to make for you?
- when: date_trunc → ask: Which day does date_trunc('week', …) start on in PostgreSQL, and in which engines or settings would that differ?
- when: inner join → ask: Which titles disappear when this week is inner-joined to last week, and are they the ones a "rising" list most needs?
- when: count(distinct, distinct profile → ask: At this scale, would you count distinct viewers exactly? What happens to a title sitting exactly on the threshold if the count is approximate?
- when: between → ask: BETWEEN includes both ends. Which sessions does it put in two weeks at once?

**Evaluation Criteria.** Half-open UTC week ranges; shares over all viewing in the country, rounded as stated; previous share 0 for new titles (no inner join); the threshold on distinct viewers of the current week; gain strictly positive; RANK with ties kept at the cut-off; deterministic ordering. At Very Hard: per-viewer minutes summed across sessions before applying the minimum. Can discuss local weeks, approximate distinct counts near a threshold, launch-day bias and restatements.

## NFX-L1-03: Concurrent streams over the plan's limit, per plan and day

| | |
|---|---|
| **Template ID** | NFX-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / interval overlap, splitting intervals at day boundaries, self joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | NFX-L1-03.mjs |

**Business Scenario.** A streaming service's plans differ in how many screens can stream at the same time (`plans.max_streams`; the limits here are hypothetical). Playback checks the limit when a stream starts, but races, reconnecting players and clock edge cases mean the check is not perfect. An analytics job measures after the fact how many accounts on each plan actually had more streams playing at once than their plan allows, day by day.

**Problem Statement.** Write one PostgreSQL query that returns `stream_date, plan_name, accounts_over_limit, peak_streams`: one row per UTC day and plan on which at least one account of that plan had more streams playing at the same instant than its plan's `max_streams`, ordered by `stream_date, plan_name`. A stream is playing during `[started_at, ended_at)`: at the instant one stream ends and another starts, only the new one is playing. `accounts_over_limit` counts the accounts of that plan that were over the limit at some instant of that day. `peak_streams` is the largest number of streams any account of that plan had playing at once during that day. {{day_rule}} {{device_rule}}

**Constraints.** One SQL statement (CTEs allowed). Over the limit means strictly more than `max_streams`; exactly the limit is allowed. Each account keeps one plan for the whole sample. The sample has {{streams}} streams from {{first_day}} to {{last_day}}; production has hundreds of millions of streams a day.

**Assumptions.** Plans, limits, accounts and devices are hypothetical. Times are already on one clock (UTC); clock skew between devices is out of scope here. A stream's interval is never empty.

**Clarifications.**
- Q: One stream ends at 10:00:00 and another starts at 10:00:00. Were two playing at once? | A: No. Intervals are half-open, so at 10:00:00 only the new one is playing.
- Q: Is an account with exactly its limit playing over the limit? | A: No. Over means strictly more than `max_streams`.
- Q: Should a day with no account over the limit appear with zero? | A: No. Only (day, plan) pairs with at least one account over the limit appear.
- Q: Is `peak_streams` only for the accounts that were over? | A: It is the highest concurrency of any account of the plan that day. On every row returned, that is an account over the limit.
- Q: Which day does an instant belong to? | A: The UTC date of that instant: days run from 00:00:00 up to, not including, the next 00:00:00.

**Hints.**
1. The number of streams playing only goes up when a stream starts, so an account's peak in a day is reached at the start of one of its streams, or at 00:00:00 for streams already playing when the day began.
2. Cut every stream into one piece per UTC day it covers (`generate_series` over days), clipped to that day; then every question is per (account, day).
3. For each piece's start, count the account's pieces that day that cover it (a self join on `b.start <= a.start AND a.start < b.end`), or run a cumulative sum over +1/−1 events with ends ordered before starts at the same instant.

**Follow-ups.**
1. The self join is quadratic per account and day. When does that matter, and what would you write instead for an account with thousands of streams a day?
2. The playback service wants to block the extra stream in real time rather than measure it afterwards. What state does it need per account, and how do you keep it correct when a device disappears without sending a stop event?
3. Devices report times on their own clocks, and some are minutes off. How would that change the measurement, and what would you trust instead?
4. Product asks how often accounts on each plan would have exceeded a lower limit. How do you answer that from the same data, and what does it not tell you?

**Follow-up rules.**
- when: self join, self-join → ask: For an account with 300 streams in a day, how many row pairs does your join compare, and what would a sweep over start and end events cost instead?
- when: between, <= ended_at → ask: Your comparison includes the end instant. What happens when one stream ends at exactly the second another starts?
- when: started_at::date, date(started_at), group by day → ask: A stream starts at 23:30 and runs past midnight with others that started before midnight. Which day does your query say the account was over the limit?
- when: sum( over, running sum, cumulative → ask: At the same instant one stream ends and another starts. In which order do your +1 and −1 events have to be summed, and how did you make sure?
- when: count(*) → ask: A player reconnects and the old row stays open for a few seconds. How many streams does COUNT(*) see on that device, and is that what the plan limit is about?

**Evaluation Criteria.** Half-open intervals and a strict comparison with the plan's limit; concurrency evaluated at the right instants (stream starts, and day starts for streams already playing); per (account, day) peaks aggregated to (day, plan); deterministic ordering. At Hard: streams split at midnight and counted on every day they cover, with a stream ending at exactly 00:00:00 not reaching the next day. At Very Hard: concurrency counted in distinct devices, and open streams running until the snapshot. Can discuss sweep versus self join, real-time enforcement and device clock skew.

## NFX-L1-04: Home-page rows without repeated titles

| | |
|---|---|
| **Template ID** | NFX-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy algorithms / hash sets and counters, two orderings, all-or-nothing commits |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | NFX-L1-04.mjs |

**Business Scenario.** A streaming service's home page is a stack of rows ("Trending now", "Because you watched…", "New releases"), each backed by its own ranked list of candidate titles. Seeing the same title in three rows wastes the page, so a page assembler fills the rows greedily: the most important row picks first, and later rows skip what is already shown. A row that ends up nearly empty is not shown at all.

**Problem Statement.** Implement `fill_rows(rows, cap, min_fill, genres=None, row_genre_cap=None, page_genre_cap=None)`. `rows` is a list of `(row_id, priority, candidates)` in **display order** (top of the page first); `candidates` is a list of title ids in rank order and may repeat a title. Fill the rows in order of `priority` descending, ties by `row_id` ascending. A row takes its candidates in order, skipping a title that is already in this row or in a row kept earlier, until it holds `cap` titles or runs out of candidates. If it ends with fewer than `min_fill` titles it is **dropped**: its titles are not on the page and stay available to rows filled after it. {{genre_rule}} {{page_rule}} Return a list of `(row_id, titles)` for the kept rows, in display order; an empty list if no row is kept.

**Constraints.** Up to 3 000 rows of 150 candidates each in the timing check, from a catalogue of 200 000 titles; `1 ≤ min_fill ≤ cap`. Expected: time proportional to the total number of candidates (plus sorting the rows). Checking "already on the page" by scanning lists is far too slow.

**Assumptions.** Row names, priorities, title ids and genres are hypothetical. Real home pages are personalised by models; this exercise is only the deduplicating assembly step, with its rules stated here.

**Clarifications.**
- Q: Is the output in fill order or display order? | A: Display order: the order of `rows` as given. Priority only decides who picks first.
- Q: A row is dropped. Do its titles count as shown? | A: No. They go back and later rows may take them.
- Q: Does a title skipped by one row become unavailable? | A: No. Only titles in kept rows are unavailable.
- Q: Two rows have the same priority. | A: The one with the smaller `row_id` (string comparison) fills first.
- Q: A row ends with exactly `min_fill` titles. | A: It is kept.

**Hints.**
1. Sort row indices by `(-priority, row_id)` once; keep a set of titles on the page.
2. Build each row in temporary structures and commit them (to the page set and any counters) only if the row is kept. That makes "dropped rows release their titles" free.
3. For genre limits, keep a counter per genre for the row being filled and, at the hardest level, one for the page; both are O(1) per candidate.

**Follow-ups.**
1. Greedy by row priority can leave a lower row empty that a different assignment would have filled. How would you formulate a page-level optimum, and is it worth its cost per page view?
2. The page is assembled per profile at request time with a 50 ms budget, and each row's candidates come from a different service. What would you precompute, and what do you do when one service is slow?
3. Rows are also scrolled sideways: only the first 6 titles of a row are visible without scrolling. Should the deduplication care about that, and how would you change the rule?
4. How would you test this assembler offline so that a ranking change cannot silently empty the third row for a large share of profiles?

**Follow-up rules.**
- when: in result, list of used, used list, any( → ask: How long does "is this title already on the page" take with your structure when 2 000 rows are already filled?
- when: set, hash set, seen → ask: When does a title enter your set: when the row takes it, or when the row is known to be kept? What happens to a dropped row's titles?
- when: optimal, optimum, matching, hungarian → ask: Greedy is what the product rule says. When would you argue for an assignment formulation instead, and what would it cost per page view?
- when: sorted(, sort → ask: What is your sort key, and how do two rows with the same priority come out?
- when: recursion, backtrack → ask: The rule is greedy and never revisits a row. What would backtracking add here, and what would it cost?

**Evaluation Criteria.** Fill order by priority with the row_id tie-break, output in display order; duplicates within a row and across kept rows skipped; dropped rows release their titles; cap and min_fill boundaries exact; O(1) membership with sets. At Hard: per-row genre counts with skipped titles still available. At Very Hard: page-wide genre counts committed only for kept rows. Can discuss global optimisation, latency budgets and offline tests.

## NFX-L1-05: Subtitle cue repair after a frame-rate change

| | |
|---|---|
| **Template ID** | NFX-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sorting and intervals / integer rescaling with exact rounding, interval merging, gap closing |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | NFX-L1-05.mjs |

**Business Scenario.** A streaming service receives subtitle files from many localisation vendors. One delivery was {{rate_story}}, so every cue drifts further out of sync as the programme plays. A repair step rescales the times, applies the offset the vendor reported, and then cleans up the result: cues that now overlap are merged into one, and gaps too short to see as a blank are closed.

**Problem Statement.** Implement `repair_cues(cues, num, den, offset_ms, min_gap_ms, dedupe=False)`. `cues` is a list of `(start_ms, end_ms, text)` with `start_ms < end_ms`. In order: (1) replace every start and end time `t` by `t × num / den` rounded half up to a whole millisecond, then add `offset_ms`. {{offset_rule}} (2) Sort the cues by new start. (3) Merge overlapping cues: walking in that order, a cue whose start is strictly before the end of the current merged cue joins it (the merged end is the larger end, and its text gains the cue's text as a new line, separated by `"\n"`); a cue that starts exactly at the current end does not join. {{dedupe_rule}} (4) Between consecutive merged cues, a gap greater than 0 and shorter than `min_gap_ms` is closed by moving the earlier cue's end to the later cue's start; a gap of exactly `min_gap_ms` stays. Return the merged cues as `(start_ms, end_ms, text)` tuples, sorted by start. This delivery's rate change is `num / den = {{num}} / {{den}}`, and `min_gap_ms` is {{min_gap_ms}}.

**Constraints.** Up to 100 000 cues in the timing check, in a single feature-length file. Expected: O(n log n). Use integer arithmetic for the rescale; merging by repeatedly searching for any overlapping pair is far too slow.

**Assumptions.** Cue text, times, offsets and thresholds are hypothetical. Real subtitle formats carry styling and positions, and real style guides set their own minimum gaps and durations; this exercise keeps only times and plain text.

**Clarifications.**
- Q: How exactly is a time rounded? | A: Half up: `(2 × t × num + den) // (2 × den)` in integers. Python's `round()` rounds halves to even, and floats can land a hair below .5.
- Q: Are the offset and rounding applied before or after sorting? | A: Before. Sort, merge and close gaps on the new times.
- Q: Does closing a gap ever merge two cues? | A: No. The earlier cue ends exactly where the next starts; touching cues stay separate.
- Q: Can a merged cue end before one of its members? | A: No. Its end is the largest end of everything merged into it, which is not necessarily the last cue's end.
- Q: What should an empty list return? | A: An empty list.

**Hints.**
1. Rescale with integers only. With num = 1001 and den = 1000, a time of 1500 ms becomes 1501.5 and must round to 1502.
2. Sort once by `(new_start, input_position)`; then a single sweep with "current merged cue" state merges everything, chains included.
3. Keep each merged cue's lines in a list (and a set, if lines must not repeat) and join them at the end; repeated string concatenation in a long chain is quadratic.

**Follow-ups.**
1. Vendors deliver the same programme in 30 languages, and QC wants every file checked against the picture's shot changes so that no cue starts within two frames of a cut. How would you add that rule, and what data do you need from the video?
2. Merging two speakers into one cue can exceed the line-length and reading-speed limits a style guide sets. What would you do instead of merging blindly?
3. The rate change was detected because cues drifted. How would you detect the right `num / den` and offset automatically from a reference track, such as another language's well-timed file?
4. How would you test this function so that a change to the rounding rule cannot silently shift every cue by a millisecond?

**Follow-up rules.**
- when: round(, float → ask: What does Python's round(2.5) return, and what does 1501.5 become with your code? Show the exact arithmetic.
- when: sort, sorted( → ask: Two cues have the same new start. Which comes first in your sort, and does that change the merged text?
- when: nested loop, while changed, pairwise → ask: How many comparisons does that take for 100 000 cues, and what does sorting first let you avoid?
- when: += → ask: A chain of 500 overlapping cues builds one text by repeated concatenation. What does that cost, and what would you do instead?
- when: clamp, max(0 → ask: A cue starts before 0 and ends after it. What does the viewer see, and what should a cue that ends at exactly 0 do?

**Evaluation Criteria.** Exact integer rescaling with half-up rounding; offset applied before sorting; strict overlap (touching cues stay separate) with the merged end as the maximum; lines in start order; gap closing with the exact boundary; O(n log n). At Hard: negative offsets drop or clamp cues correctly, unsorted input with equal starts kept stable, chains merged. At Very Hard: repeated lines within a merged cue dropped. Can discuss shot-change rules, reading speed, automatic drift detection and regression tests.
