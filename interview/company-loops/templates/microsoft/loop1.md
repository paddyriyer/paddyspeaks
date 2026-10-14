# Microsoft · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domains of a large software and
cloud company: meetings and collaboration, operating-system updates, an AI assistant in
office apps, online games and spreadsheets. They are not questions from Microsoft's
interviews and describe no internal system; every table, number and rule is hypothetical.

## MSF-L1-01: Meeting join failures: first tries that failed, with quick retries collapsed

| | |
|---|---|
| **Template ID** | MSF-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps and islands with LAG and a running SUM, first-row attributes, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | MSF-L1-01.mjs |

**Business Scenario.** A meetings product logs every attempt a person makes to join a meeting, from desktop apps, the web and phones. The reliability team wants one number per customer organisation (tenant) and client platform: of the people who tried to join, how many could not get in on their first try? A failure followed straight away by a successful retry is a blip, not a failed join, so retries within two minutes of the previous attempt are collapsed into one **try**. The sample has {{attempts}} attempts in one table.

**Problem Statement.** Write one PostgreSQL query that returns `tenant_id, client_platform, participants, failed_first_try, recovered_later, failed_share`, one row per tenant and platform, ordered by `tenant_id, client_platform`. A **participant** is one `(meeting_id, user_id)`. Order a participant's attempts by `attempt_ts`, then `attempt_id`. A try starts at the first attempt and at every attempt **more than** 120 seconds after the participant's previous attempt; an attempt at most 120 seconds after the previous one belongs to the same try, so a chain of quick retries stays one try. The first try **failed** if none of its attempts has `outcome = 'succeeded'`. `recovered_later` counts participants whose first try failed and a later try succeeded. `failed_share` is `failed_first_try / participants`, rounded to 4 decimal places. A participant is counted once, on the `client_platform` of their first attempt. {{platform_rule}} {{cancel_rule}}

**Constraints.** One SQL statement (CTEs allowed). `tenant_id` is the meeting's tenant and is the same on every attempt of a meeting. The 120 seconds are exact, measured between `attempt_ts` values.

**Assumptions.** Tenants are fictional sample organisations; meetings, users, timings and outcomes are hypothetical. Real clients report richer error codes; the two outcomes and the two-minute rule are this exercise's definitions.

**Clarifications.**
- Q: Is the two-minute window measured from the first attempt of the try or from the previous attempt? | A: From the previous attempt. Three attempts 100 seconds apart are one try, although the last is 200 seconds after the first.
- Q: An attempt exactly 120 seconds after the previous one? | A: Same try. Only a gap of more than 120 seconds starts a new try.
- Q: The same person joins two meetings in one afternoon. | A: Two participants, each with their own first try.
- Q: The first attempt failed and a retry 30 seconds later succeeded. | A: The first try succeeded; this participant is not in `failed_first_try`.
- Q: The first try failed and the person never got in. | A: Counted in `failed_first_try`, not in `recovered_later`.

**Hints.**
1. `LAG(attempt_ts)` per `(meeting_id, user_id)` flags the attempts that start a new try; a running `SUM` of that flag numbers the tries (gaps and islands).
2. Reduce to one row per participant: the platform of row number 1, whether try 1 had a success, whether any later try had one. Then aggregate per tenant and platform.
3. `BOOL_OR(…) FILTER (WHERE …)` is NULL when the filter matches no row; wrap it in `COALESCE`.

**Follow-ups.**
1. The team also wants the median time from the first attempt to getting in, for participants whose first try failed. What would you add?
2. Client clocks can be minutes off and some attempts arrive a day late. How do try boundaries and the daily report change?
3. A tenant reports that their failure share doubled after a client update, but they had 12 participants. How would you show uncertainty, and when would you hold a group back?
4. At billions of attempts a day, how would you build tries incrementally when a try can straddle the boundary between two processing batches?

**Follow-up rules.**
- when: lag, lead → ask: Your LAG compares each attempt with the previous one. What is in its ORDER BY, and what happens when two attempts share a timestamp?
- when: row_number, first_value → ask: Someone fails on the web and gets in from the desktop app 20 seconds later. Which platform are they counted on, and which row does your query take it from?
- when: date_trunc, bucket, floor → ask: Fixed two-minute buckets put attempts at 10:01:59 and 10:02:01 into different tries. How does your rule avoid that?
- when: group by user_id, per user → ask: The same person joins two meetings. Are they one participant or two, and what does your GROUP BY say?
- when: cancelled, cancel → ask: A cancelled attempt sits between a failure and a success 200 seconds apart. Does it link them into one try in your query?

**Evaluation Criteria.** Participant grain is `(meeting_id, user_id)`; tries split on a gap of more than 120 seconds from the previous attempt (chained, inclusive at 120); a first try fails only if none of its attempts succeeded; `recovered_later` only from later tries; the platform of the first attempt with the `attempt_id` tie-break (Hard+); cancelled attempts removed before tries are built and the floor applied (Very Hard); correct rounding and order; can discuss clock skew, late data and incremental sessionisation.

## MSF-L1-02: Update ring compliance: installs within N days of the first offer

| | |
|---|---|
| **Template ID** | MSF-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-entity windows, EXISTS with inclusive bounds, point-in-time lookup, NULL-safe ratios |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | MSF-L1-02.mjs |

**Business Scenario.** An organisation's IT team rolls operating-system quality updates out in **rings**: a small preview or pilot group first, the broad population last. For each ring and OS build they track how many offered devices installed the update within a set number of days. A laptop that sat switched off in a drawer for the whole period says nothing about the rollout, so devices that were never online in the period are excluded from the rate rather than counted as failures. You have devices, their build history, offers, installs and check-ins for {{devices}} devices, and the report is for update `{{update_id}}` within {{days}} days.

**Problem Statement.** Write one PostgreSQL query that returns `ring, os_build, offered_devices, online_devices, compliant_devices, compliance_rate`, one row per `(ring, os_build)` with at least one device offered `{{update_id}}`, ordered by `ring, os_build`. Each offered device has a **window** from its first offer of `{{update_id}}` to exactly {{days}} days later, both ends inclusive. The device is **compliant** if it has an install of `{{update_id}}` in the window, and **online** if it has a check-in in the window or is compliant (an install proves it was online). `offered_devices` counts every offered device; `online_devices` and `compliant_devices` count those that were online and compliant. `os_build` is the device's build at its first offer: the `device_builds` row with the latest `effective_at` at or before that offer. `compliance_rate` is `compliant_devices / online_devices`, rounded to 4 decimal places, and NULL when no device in the group was online. {{offer_rule}} {{build_rule}}

**Constraints.** One SQL statement (CTEs allowed). The tables also hold offers and installs of other updates, and devices that were never offered this one. A check-in before the first offer or after the window does not make a device online.

**Assumptions.** Ring names, update ids, build numbers, dates and the compliance rule are hypothetical. Real update management adds deferrals, deadlines, pauses and restarts; they are out of scope here.

**Clarifications.**
- Q: A device was offered the update twice. Which offer starts the window? | A: The first. A re-offer does not restart the clock.
- Q: An install exactly N days after the first offer, to the second? | A: Compliant. Both ends of the window are inclusive.
- Q: A device installed in the window but has no check-in rows at all. | A: It was online: installing proves it.
- Q: A device checked in only before it was offered the update. | A: It counts in `offered_devices` but was not online in the window, so it is not in the rate's denominator.
- Q: Every device in a group was offline. | A: Report the row anyway, with `compliance_rate` NULL.

**Hints.**
1. Build one row per offered device first: `MIN(offered_at)` as the start and the start plus `INTERVAL '{{days}} days'` as the end.
2. `EXISTS` subqueries with `BETWEEN` decide "installed this update in the window" and "checked in in the window" without multiplying rows.
3. The build at the offer is a "latest row at or before" lookup: a correlated subquery with `ORDER BY effective_at DESC LIMIT 1`, a `LATERAL` join, or `DISTINCT ON`.
4. `NULLIF(online, 0)` keeps an all-offline group from dividing by zero.

**Follow-ups.**
1. The team wants a compliance curve: the cumulative share installed on day 0, 1, …, N after the offer, per ring. What changes?
2. Devices check in every few hours and some check-ins are lost. How would you estimate how many "never online" devices were in fact online?
3. A ring is paused for a week after a problem is found. Should paused days count against the N-day window, and how would you model the pause?
4. With tens of millions of devices and a check-in every few hours, which table dominates the cost, and what would you precompute so the report does not scan it each time?

**Follow-up rules.**
- when: max(offered_at), latest offer, last offer → ask: A device was offered the update on Monday and again on Thursday. Which day starts its window in your query, and what does the rule say?
- when: current_build → ask: The device moved to a newer build after the offer. Which build does your report use, and why would the rollout team care?
- when: left join, count(distinct → ask: Joining check-ins and installs onto devices multiplies rows. How do you make sure each device is counted once per group?
- when: half-open, exclusive, < interval → ask: Is an install at exactly the end of the window inside it in your query? Show the comparison you used.
- when: coalesce, zero → ask: In a group where every device was offline, what does your rate show, and is 0 the honest answer?

**Evaluation Criteria.** Window from the first offer of this update, inclusive at both ends; installs of this update only; online means a check-in in the window or an install in the window; never-online devices kept in `offered_devices` but out of the denominator; NULL rate for an all-offline group (Hard+); the build in effect at the first offer from the history (Very Hard); deterministic order; can discuss compliance curves, lost check-ins, pauses and scale.

## MSF-L1-03: Copilot suggestions kept: accepted and not undone within five minutes

| | |
|---|---|
| **Template ID** | MSF-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / event matching inside a time window, per-entity deduplication, LEFT JOIN denominators, HAVING floors |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer |
| **Generator** | MSF-L1-03.mjs |

**Business Scenario.** An AI assistant inside office apps offers inline suggestions: a rewritten sentence, a formula, a reply draft. Acceptance alone overstates how useful they are, because people accept a suggestion and press undo seconds later. The product team therefore tracks suggestions **kept**: accepted and not undone within five minutes. The report is per app and language, and small groups are noisy, so a group with fewer than {{min_shown}} suggestions shown is left out. The tables hold only event metadata: no prompt, suggestion or document text exists in them. The sample has {{suggestions}} suggestions.

**Problem Statement.** Write one PostgreSQL query that returns `app, language, shown, accepted, kept, accept_rate, keep_rate`, one row per `(app, language)` with at least {{min_shown}} suggestions shown, ordered by `app, language`. `shown` counts suggestions; `accepted` counts suggestions with at least one `accepted` event. A suggestion is **kept** if it was accepted and has no `undone` event after its last acceptance and at most 300 seconds after it (an undo exactly 300 seconds later is within five minutes). `accept_rate` is `accepted / shown` and `keep_rate` is `kept / accepted` (NULL when nothing was accepted), both rounded to 4 decimal places. `dismissed` events are not acceptances. {{accept_rule}} {{lang_rule}}

**Constraints.** One SQL statement (CTEs allowed). Within one suggestion no two events share a timestamp. A suggestion with no events at all was shown and ignored.

**Assumptions.** Apps, languages, users, counts and timings are hypothetical, and the five-minute "kept" rule is this exercise's definition, not a published product metric. Events are client logs with one row per user action.

**Clarifications.**
- Q: An undo exactly 300 seconds after the acceptance? | A: Within five minutes, so the suggestion is not kept.
- Q: An undo 20 minutes later? | A: Still kept. Only an undo within five minutes counts against it.
- Q: Is the floor on suggestions shown or on suggestions accepted? | A: Shown.
- Q: Is `keep_rate` over shown or over accepted? | A: Over accepted.
- Q: Does a dismissed suggestion count in `shown`? | A: Yes. Every row of `suggestions` was shown.

**Hints.**
1. Reduce the acceptance events to one row per suggestion first: its last acceptance time.
2. Start from `suggestions` with a `LEFT JOIN`, so suggestions with no events still count as shown, and test for an undo in `(accepted_at, accepted_at + 5 minutes]` with `NOT EXISTS`.
3. Apply the floor with `HAVING COUNT(*) >= …` on the per-suggestion rows, after grouping.

**Follow-ups.**
1. The team wants "kept" at 1, 5 and 30 minutes side by side. How would you compute all three in one pass?
2. Only some clients log undo events. How would that bias `keep_rate` between apps, and how would you report it?
3. Tenant admins see this report for their own organisation. Which groups could reveal one person's behaviour, and what would you add beyond a floor on `shown`?
4. Events arrive as a stream, and a suggestion's outcome is final only five minutes after its last acceptance. How would you publish a daily number on time and correct it later?

**Follow-up rules.**
- when: join suggestion_events, inner join → ask: Joining events to suggestions gives one row per event. A suggestion with two `accepted` events: how many times is it counted as accepted?
- when: min(event_ts), first acceptance, first accept → ask: Accepted, accepted again 3 seconds later, then undone 299 seconds after the second. Which acceptance does your clock start from, and is the suggestion kept?
- when: between → ask: BETWEEN includes both ends. Which end of the undo window must be inclusive here, and does the other end matter?
- when: is not null, where language → ask: What happens to suggestions with no detected language in your query?
- when: having → ask: Your floor is in HAVING. Is it counting suggestions shown, or rows produced by a join to events?

**Evaluation Criteria.** One row per suggestion before aggregating; the clock runs from the last acceptance; the undo window is after the acceptance and inclusive at 300 seconds; a LEFT JOIN keeps unaccepted suggestions in `shown`; the floor on `shown`; NULL `keep_rate` when nothing was accepted; duplicate acceptances counted once (Hard+); re-acceptance after an undo and `'und'` for a missing language (Very Hard); can discuss several windows at once, uneven client logging, small-group privacy and streaming corrections.

## MSF-L1-04: Lobby matchmaking: the most 1v1 pairs within a skill gap

| | |
|---|---|
| **Template ID** | MSF-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sorting and dynamic programming / matching on a line, sliding-window maximum with a deque, lexicographic tie-breaks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | MSF-L1-04.mjs |

**Business Scenario.** An online game's 1v1 mode keeps players in a lobby until it can pair them with an opponent of similar skill. Every few seconds the matchmaker takes a snapshot of the lobby and pairs as many players as it can, because every pair made is two people playing instead of waiting. When several pairings make equally many matches, it prefers the one that gets the people who have waited longest into a game. Whoever is not paired stays in the lobby for the next snapshot. {{region_rule}}

**Problem Statement.** Implement `match_lobby(players, max_gap)`. Each player is `(player_id, region, skill, wait_ms)`. Two players can be paired if they are in the same region and `abs(skill_a - skill_b) <= max_gap[region]`; each player is in at most one pair. Choose the pairing that (1) makes the most pairs and, among those, (2) has the largest total `wait_ms` of the paired players. Return `(pairs, left)`: the number of pairs, and the ids of the players left in the lobby, sorted ascending. All `wait_ms` values are distinct, which makes the set of players left unique; who plays whom may not be unique, so it is not returned.

**Constraints.** Up to 150 001 players in the timing check, with skills between 1 000 and 3 000, so thousands of players are inside any one player's gap. Expected: O(n log n) time, a sort followed by one linear pass. Searching for partners pair by pair, or scanning every earlier player in the gap for each player, is far too slow.

**Assumptions.** Skills, waits, regions and gaps are hypothetical. Real matchmakers also weigh rating uncertainty, network latency, parties and windows that widen with time; this snapshot rule is the exercise's own.

**Clarifications.**
- Q: Is a skill gap exactly equal to `max_gap` allowed? | A: Yes. The gap must be at most `max_gap`.
- Q: Should the longest-waiting player always be paired first? | A: Only if that does not cost a pair. The number of pairs comes first; the total wait of the paired players only breaks ties.
- Q: With `max_gap` 0, can two players with the same skill play? | A: Yes.
- Q: Do I return who plays whom? | A: No. Several pairings can be equally good; the set of players left waiting is unique, so return that.
- Q: Can players from different regions be paired? | A: Never.

**Hints.**
1. Sort a region's players by skill. If a ≤ b ≤ c ≤ d (by skill) are paired as (a, c) and (b, d), or as (a, d) and (b, c), then (a, b) and (c, d) are allowed too. So some best pairing pairs players who are next to each other among the paired players, in skill order.
2. Scanning in skill order, each player therefore either stays, or plays one earlier player j while everyone between j and them stays. Let `best[i]` be the best `(pairs, total paired wait)` over the first i players.
3. `best[i + 1] = max(best[i], best[j] + (1, wait[j] + wait[i]))` over the j inside the gap. Those j form a window that only slides forward, so a monotonic deque gives the maximum in O(1) amortised.
4. Python compares tuples lexicographically, which is exactly "pairs first, then wait". Record each player's choice so you can walk back and collect who stayed.

**Follow-ups.**
1. Why does pairing neighbours greedily from the lowest skill already maximise the number of pairs, and why does it not settle who is left waiting?
2. Each player's allowed gap widens the longer they wait. Does the sorted structure survive, and what breaks?
3. Groups of two must play another group of two (2v2), with the gap measured between the groups' average skills. How does the problem change?
4. Snapshots run every two seconds. How would you stop the same player being left out snapshot after snapshot, and how would you measure it from logs?

**Follow-up rules.**
- when: itertools, combinations, permutations, brute force → ask: How many possible pairings does a lobby of 150 000 players have? What does sorting by skill let you skip?
- when: greedy, adjacent, neighbours → ask: Skills 10, 20, 30 with a gap of 10: pairing from the lowest skill pairs (10, 20). When is that the wrong player to leave waiting?
- when: longest wait first, sort by wait, heap → ask: Players at skill 0, 20, 21 and 41 with a gap of 20, and the player at 21 has waited longest. Who do they play under your rule, and how many pairs do you make?
- when: blossom, hungarian, bipartite, max flow → ask: General matching works but costs far more than n log n. What property of "skill gap at most D" lets you avoid it?
- when: deque, sliding window → ask: Why can you drop a candidate from the back of your deque, and why does the front only ever move forward?

**Evaluation Criteria.** Same-region pairs only, inclusive gap; the number of pairs maximised before the wait; ties broken by the total wait of the paired players; the uncrossing argument that justifies working in skill order; O(n log n) with a deque or another monotone structure, not a scan of the gap per player; left list sorted; empty and single-player lobbies; can discuss widening gaps, groups and starvation across snapshots.

## MSF-L1-05: Spreadsheet selections: distinct cells under overlapping ranges

| | |
|---|---|
| **Template ID** | MSF-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sweep lines / A1 reference parsing, bijective base 26, coordinate compression, union area of rectangles |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer |
| **Generator** | MSF-L1-05.mjs |

**Business Scenario.** A spreadsheet app's status bar shows how many cells the current selection covers. People build selections from many ranges (Ctrl-click, or a saved list of references), and the ranges often overlap. A sheet has 1,048,576 rows and 16,384 columns (A to XFD), so one selection can cover billions of cells; the count has to be exact and instant, which rules out visiting cells. {{forms_rule}}

**Problem Statement.** Implement `cells_selected(selections)`. `selections` is a list of A1-style reference strings. Return the number of distinct cells covered by at least one of them. Column letters are bijective base 26 (A = 1, …, Z = 26, AA = 27, …, XFD = 16 384); rows are numbered from 1. {{extra_rule}}

**Constraints.** Up to 2 000 selections in the timing check, many covering millions of cells. Letters are upper case and there are no spaces or sheet names. Expected: O(n log n) with a sweep and a segment tree, or O(n²) after compressing the coordinates. Anything proportional to the number of cells is far too slow.

**Assumptions.** The grid size and the reference forms follow the publicly documented conventions of common spreadsheet apps (check current docs); the selections are hypothetical. Sheet names, named ranges, R1C1 notation and hidden rows are out of scope.

**Clarifications.**
- Q: Is `B2:D10` the same as `D10:B2`? | A: Yes. A range is the rectangle spanned by its two corners, in whatever order they are written.
- Q: What does `C:E` cover? | A: Every row of columns C to E: 3 × 1,048,576 cells.
- Q: A cell is in three selections. | A: It counts once.
- Q: How large can the answer be? | A: The whole sheet is 17,179,869,184 cells, more than 32 bits; Python integers are fine.
- Q: What if a reference is off the grid? | A: Return `-1`. This only occurs at the hardest level; otherwise every reference is valid.

**Hints.**
1. Parse every reference into an inclusive rectangle `(c1, c2, r1, r2)` first. Whole columns are rows 1 to 1,048,576; whole rows are columns 1 to 16,384.
2. Only the edges matter: the distinct values of `c1` and `c2 + 1` cut the sheet into column strips inside which the set of covering rectangles does not change.
3. Sweep the strips from left to right. In each, the covered rows are the union of the active rectangles' row intervals: sort and merge them, or keep a segment tree over the compressed row boundaries with a cover count per node.

**Follow-ups.**
1. The status bar should also show how many cells are covered by two or more selections. What changes in your sweep?
2. The status bar also shows the SUM of the selected values, and only a few million cells are non-empty. How would you add them up without double counting overlaps?
3. The user drags one range's corner 60 times a second. How would you update the count incrementally instead of recomputing it?
4. Co-authors each have their own selection in a shared workbook. How would you count the cells selected by anyone, on a service holding thousands of open workbooks?

**Follow-up rules.**
- when: set(, seen, for row in range, for col in range → ask: How many cells does `A:XFD` cover, and how long does your loop take to visit them?
- when: inclusion-exclusion, inclusion exclusion → ask: With 2 000 overlapping ranges, how many intersection terms does inclusion–exclusion need?
- when: ord(, base 26, base-26 → ask: What column numbers does your conversion give for `AA` and `XFD`? Is this ordinary base 26, and where does it differ?
- when: compress, compression, bisect → ask: A compressed grid has up to (2n)² cells. At 2 000 selections, how many is that, and can you avoid building it?
- when: segment tree → ask: When a node is fully covered by a rectangle, what is its covered length, and what happens to it when that rectangle ends?

**Evaluation Criteria.** Bijective base-26 columns; inclusive rectangles; overlaps counted once; corners in any order, whole columns and whole rows (Hard+); `$` markers, several areas per selection and the `-1` sentinel (Very Hard); an exact union by compression and a sweep, never per-cell work; arbitrary-precision counts; can discuss double coverage, sums over sparse values and incremental updates.
