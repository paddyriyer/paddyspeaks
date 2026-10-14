# Meta · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a social media and
messaging company with an advertising business. Every workload, number and schema is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MET-L1-01: Ad frequency caps — impressions served over the cap

| | |
|---|---|
| **Template ID** | MET-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / rolling time windows, LAG with an offset, tie-breaking |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | MET-L1-01.mjs |

**Business Scenario.** Ad platforms let advertisers on some campaign types cap how often one person sees a campaign: at most N impressions in a rolling window of hours or days. Delivery enforces the cap from counters that can lag behind the impression log, so an audit job measures over-delivery after the fact from the log itself. Advertisers are not charged for over-cap impressions in this hypothetical policy, so the count has to be exact.

**Problem Statement.** Write one PostgreSQL query that returns `campaign_id, impressions, over_cap_impressions, users_over_cap` for every campaign in `campaigns`, ordered by `campaign_id`. Order a user's impressions of one campaign by `served_at`, then `impression_id`. An impression is **over the cap** when the number of that user's impressions of that campaign served in the half-open window `(served_at − window_hours, served_at]` and not after it in that order (so itself included) is greater than the campaign's `frequency_cap`. `impressions` counts the campaign's impressions, `over_cap_impressions` those over the cap, and `users_over_cap` the distinct users with at least one. {{cap_rule}} {{log_rule}}

**Constraints.** One SQL statement (CTEs allowed). The sample has {{impressions}} logged rows; production has billions of impressions a day, so a self-join per user and campaign is acceptable here but its cost should be discussed.

**Assumptions.** Hypothetical caps, windows and traffic. Over-cap impressions were still served and still count toward the window of later impressions: the audit measures exposure, not what delivery intended.

**Clarifications.**
- Q: Is an impression exactly `window_hours` older still inside the window? | A: No. The window is (served_at − window_hours, served_at]: one exactly a window earlier has left it.
- Q: With a cap of 3, is the third impression over the cap? | A: No. The cap is the number allowed; the fourth in a window is the first over it.
- Q: Two impressions in the same second? | A: Order them by impression_id; the smaller id was served first, so only the later one can be the one that crosses the cap.
- Q: Does an over-cap impression count toward the window of the next one? | A: Yes. It was shown, so the person saw it.
- Q: Campaigns with no impressions? | A: Report them with zeros.

**Hints.**
1. Clean the log first (one row per impression, valid rows only, where the level needs it), then join the campaign's cap and window.
2. Because a user's impressions are in a total order, the window ending at an impression is a contiguous run that ends at it. The impression is over the cap exactly when the impression `frequency_cap` places earlier is still inside its window.
3. `LAG(served_at, frequency_cap)` reads that impression directly. A window frame with `RANGE BETWEEN INTERVAL … PRECEDING` cannot take a per-campaign interval, and it treats same-second rows as peers.

**Follow-ups.**
1. The audit must refund over-cap impressions in near real time instead of nightly. What state per (user, campaign) do you keep, and how big is it?
2. Delivery enforces caps from a counter replicated across regions with a few seconds of lag. Estimate the over-delivery that lag allows and how you would bound it.
3. The cap moves from "per campaign" to "per advertiser across all its campaigns". What changes in the query and in the state you keep?
4. Impressions arrive up to six hours late. Which flags computed yesterday can change, and how do you recompute only those?

**Follow-up rules.**
- when: self-join, self join, correlated → ask: With a 7-day window and a user who sees thousands of impressions a week, what does the self-join cost, and what would you do instead?
- when: range between, interval preceding → ask: Two impressions share a served_at. What count does a RANGE frame give each of them, and which one is really over the cap?
- when: lag, row_number → ask: Prove that comparing with the impression frequency_cap places earlier is equivalent to counting the window.
- when: distinct on, row_number, dedup → ask: The client and server copies of an impression disagree on served_at by a second. Which do you keep, and could the choice flip a flag?

**Evaluation Criteria.** Correct half-open window and strict cap comparison; deterministic tie-breaking by impression_id; over-cap impressions still counted in later windows; campaigns with no impressions reported; at the Very Hard level, per-campaign windows, one row per impression and invalid traffic excluded. Explains the cost of the chosen approach at production volume.

## MET-L1-02: Conversion lift study — test versus holdout readout

| | |
|---|---|
| **Template ID** | MET-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / experiment readout, deduplication, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | MET-L1-02.mjs |

**Business Scenario.** A conversion lift study measures what an ad campaign caused rather than what it was credited with: people are randomly assigned to a test cell, which can see the campaign's ads, or a holdout (control) cell, which cannot, and the conversion rates of the two cells are compared. Ad platforms describe this kind of study publicly. Conversions arrive from a browser pixel and, increasingly, from the advertiser's server; public documentation for sending both asks for a shared event ID so the copies can be deduplicated. You are writing the readout for {{studies}} studies.

**Problem Statement.** Write one PostgreSQL query that returns, for every study, `study_id, test_users, test_converters, test_conversions, control_users, control_converters, control_conversions, lift`, ordered by `study_id`. A conversion counts for a user in a study when its `event_name` equals the study's `event_name` and its time is at or after the user's `assigned_at` and before the study's `ends_at`. `*_users` counts the users in the cell, `*_converters` those with at least one counted conversion, `*_conversions` the counted conversions. `lift = (test_rate − control_rate) / control_rate`, where each rate is converters / users, as a double precision value; it is NULL when the control cell has no converters. {{dedup_rule}} {{assign_rule}}

**Constraints.** One SQL statement (CTEs allowed). A user can be in several studies, and one conversion can count in each of them. Compute rates in floating point, not integer division.

**Assumptions.** Hypothetical studies, users and events; no statistical significance is required here. Assignment happens at or after `starts_at`.

**Clarifications.**
- Q: Does a conversion before the user was assigned count? | A: No. The user was not in the study yet. One exactly at assigned_at does count.
- Q: Is ends_at inclusive? | A: No. The window is [assigned_at, ends_at).
- Q: Do other event types count, for example AddToCart in a Purchase study? | A: No. Only the study's event_name.
- Q: What identifies one conversion? | A: The pair (event_name, event_id). Copies with the same pair are one conversion; its time is the earliest copy.
- Q: How should lift be returned when the control cell has no converters? | A: NULL; it is undefined, not zero or infinite.

**Hints.**
1. Reduce each input to its grain first: one row per (study, user) for assignments, one row per (event_name, event_id) for conversions.
2. Count per (study, user) with a LEFT JOIN, so users with no conversions still count as users, then aggregate per study with `COUNT(*) FILTER (WHERE …)`.
3. Cast before dividing: `test_converters::float8 / test_users`.

**Follow-ups.**
1. Add a 95% confidence interval for the difference in conversion rates. What do you compute per cell, and when does the normal approximation stop being reasonable?
2. The holdout is 10% of users and the study runs for weeks. How would you make the daily readout incremental instead of recomputing from raw events?
3. Some conversions are reported only by the server, days late. How does that bias a readout taken while the study is running, and in which direction?
4. A user is assigned on one device and converts on another while logged out. What does that do to the measured lift, and what can the data model do about it?

**Follow-up rules.**
- when: inner join, join conversions → ask: A test user with no conversions: does your join keep them in test_users? Show where.
- when: distinct, group by event_id → ask: Is event_id alone a safe deduplication key, or can two different events share one?
- when: avg, mean, rate → ask: Would averaging per-user conversion flags give the same rate as converters / users? What about averaging per-day rates?
- when: integer, cast, float → ask: Where exactly would integer division have silently produced 0 in your query?

**Evaluation Criteria.** Assignment and conversions reduced to the right grain before joining; users with no conversions kept; time window [assigned_at, ends_at) and the study's event only; deduplication on (event_name, event_id) with the earliest copy's time; at the Very Hard level, duplicate assignments collapsed and contaminated users excluded; lift NULL when undefined and computed in floating point.

## MET-L1-03: Group message delivery receipts — messages slower than the SLA

| | |
|---|---|
| **Template ID** | MET-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / interval membership joins, relational division, outer joins |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, software-engineer, analytics-engineer |
| **Generator** | MET-L1-03.mjs |

**Business Scenario.** A messaging app with end-to-end encryption never sees message content, but delivery metadata — which message, which recipient, when a delivered or read receipt came back — is what reliability teams can measure. A message to a group is only fully delivered when every member who should receive it has a device that acknowledged it. The reliability dashboard needs the messages sent between {{start}} and {{end}} that took longer than {{sla}} seconds to reach every recipient, or have not reached all of them.

**Problem Statement.** Write one PostgreSQL query that returns `message_id, chat_id, recipients, delivered_recipients, delivery_seconds` for messages with `sent_at` in `[{{start}}, {{end}})`, ordered by `message_id`. The **recipients** of a message are the chat's members at `sent_at` (`joined_at <= sent_at` and `left_at` NULL or later than `sent_at`), other than the sender. A recipient's delivery time is their earliest receipt of either type. `delivered_recipients` counts recipients with at least one receipt; `delivery_seconds` is the time from `sent_at` to the last recipient's delivery when all recipients have one, else NULL. Return only messages that have at least one recipient and either are not fully delivered or took more than {{sla}} seconds. {{member_rule}} {{receipt_rule}}

**Constraints.** One SQL statement (CTEs allowed). The tables hold metadata only; there is no content column and none is needed. Production has hundreds of billions of receipts a day.

**Assumptions.** Hypothetical chats, users and timings; device clocks are already corrected to UTC. A missing receipt means none had arrived when the extract was taken.

**Clarifications.**
- Q: Is a member who joined at exactly sent_at a recipient? | A: Yes: joined_at <= sent_at. A member whose left_at equals sent_at is not.
- Q: Does a read receipt count as delivery? | A: Yes. A message cannot be read before it is delivered, so a read is proof of delivery at that time.
- Q: A recipient has three receipts. Which time is their delivery time? | A: The earliest.
- Q: Exactly {{sla}} seconds? | A: Not slow. Only more than {{sla}} seconds is reported.
- Q: Is the window end inclusive? | A: No. A message sent exactly at {{end}} is outside it.

**Hints.**
1. Build the recipient set first: one row per (message, recipient) from an interval join of messages to memberships.
2. Collapse receipts to one earliest time per (message, recipient), then LEFT JOIN it to the recipient set so missing receipts stay visible as NULLs.
3. "Every recipient has a receipt" is `COUNT(delivered_at) = COUNT(*)` per message; the full delivery time is the `MAX` of the earliest times.

**Follow-ups.**
1. Report the p50 and p99 of full delivery time per hour for groups of size 2, 3–10 and 11+. Where would you store the raw distribution to make that cheap?
2. A group has 1 000 members. Is "every recipient delivered" still the right reliability metric? Propose one that is not dominated by the slowest phone.
3. Receipts arrive for days (a phone off on holiday). When can a message's numbers be final, and how do you keep the dashboard both fresh and correct?
4. Privacy review asks that no table keep (sender, recipient, time) triples longer than needed. Which aggregates would you keep after 30 days, and what can no longer be answered?

**Follow-up rules.**
- when: current members, left_at is null → ask: A member left an hour after the message. Should they be a recipient, and does your join say so?
- when: max(receipt, latest, last receipt → ask: A recipient's second device acknowledged 10 minutes after the first. Which time measures delivery to that person?
- when: inner join, join receipts → ask: A recipient whose phone is off has no receipt row. Where does your query count them?
- when: count(distinct, distinct → ask: What would double-count in your query if a member had two membership rows for one chat?

**Evaluation Criteria.** Recipients from membership at sent_at with the boundary rules; the sender excluded; earliest receipt per recipient, reads included; missing receipts kept by an outer join and reported as incomplete; strict SLA and half-open window; at the Very Hard level, receipts from non-recipients ignored and messages with no recipients excluded. Discusses finality and privacy of delivery metadata sensibly.

## MET-L1-04: "People you may know" — friend-of-friend suggestions

| | |
|---|---|
| **Template ID** | MET-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Graphs and hash maps / two-hop counting, heaps for top k |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | MET-L1-04.mjs |

**Business Scenario.** Social networks suggest people you may know, and the most common public explanation of a suggestion is the number of mutual friends. Candidate generation for those suggestions starts from the friendship graph: the friends of a person's friends, scored by how many mutual friends they share, with people already connected or blocked removed. You are writing that candidate generator for a batch of users.

**Problem Statement.** Implement `suggest(edges, queries, k, blocked=(), hidden=frozenset(), min_mutual=1)`. `edges` is a list of undirected friendships `(a, b)`. For each user `u` in `queries`, return a list of up to `k` pairs `(v, mutual)`: candidates `v` who are not `u` and not already `u`'s friends, where `mutual` is the number of users who are friends of both, and `mutual >= min_mutual`. Order by `mutual` descending, then `v` ascending. A user with no friends, or not in the graph, gets `[]`. Return one list per query, in order. {{edge_rule}} {{block_rule}} {{hidden_rule}}

**Constraints.** Up to 300 000 edges, 40 000 users and 2 500 queries in one call. User ids are non-negative integers. Expected: build the graph once, then work proportional to the two-hop neighbourhood of each query user, never to the number of users.

**Assumptions.** Hypothetical graph sizes. Real systems add many other signals; here the score is the mutual-friend count alone.

**Clarifications.**
- Q: Can a current friend be suggested if they have many mutual friends? | A: No. Existing friends and the user themself are never candidates.
- Q: Ties on mutual friends? | A: Smaller user id first.
- Q: What if fewer than k candidates qualify? | A: Return all of them.
- Q: A user id in queries that never appears in edges? | A: Return [] for it.
- Q: Does blocking work in both directions? | A: Yes. (a, b) in blocked means neither is suggested to the other.

**Hints.**
1. Build an adjacency map of sets once; sets make duplicate and reversed edges harmless and make "is v already a friend" O(1).
2. For a query user, walk friends of friends and count how often each candidate is reached: that count is the number of mutual friends.
3. You need only the best k of the counted candidates: `heapq.nsmallest(k, ((-mutual, v), …))` avoids sorting all of them.

**Follow-ups.**
1. One user has 5 000 friends and each of them has 5 000. What does a two-hop walk cost, and how would you cap or sample it?
2. Run this for every user every night on a graph with billions of edges. How would you express it as a distributed join, and where is the skew?
3. Rank by a weighted score that discounts mutual friends who have very many friends (an Adamic–Adar style weight). What changes in the counting?
4. A friendship is removed. Which users' suggestions can change, and how would you update them incrementally?

**Follow-up rules.**
- when: for every user, all users, for v in → ask: How many users does each query scan in the timing test, and how many does it need to?
- when: sort, sorted → ask: You sort every candidate. How many are there for a well-connected user, and what does a heap of size k save?
- when: set, adjacency → ask: How much memory does your adjacency map take for 300 000 edges, and what would you use for a billion?
- when: join, spark, mapreduce → ask: Which key is hot in the two-hop self-join, and how do you salt or split it?

**Evaluation Criteria.** Correct candidate set (no self, no friends, no blocked pairs in either order); mutual counts unaffected by duplicate, reversed or self edges; ordering and min_mutual boundary exact; at the Very Hard level, hidden users skipped as connectors but still suggestible; complexity proportional to the two-hop neighbourhood with a heap or partial sort for the top k.

## MET-L1-05: Peak concurrent viewers of a creator's live broadcast

| | |
|---|---|
| **Template ID** | MET-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sweep line / interval merging per key, sorting events |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | MET-L1-05.mjs |

**Business Scenario.** Creators who go live see how many people are watching, and after the broadcast their insights show the peak. The player logs a session for every device that watches: when it started and when it stopped. People switch devices, lose connection and come back, and scroll past for a second, so a raw count of open sessions overstates the audience. You are computing the post-broadcast peak from the session log.

**Problem Statement.** Implement `peak_viewers(sessions, min_ms=0)`. `sessions` is a list of `(viewer_id, start_ms, end_ms)` with `start_ms < end_ms`, in any order; a session covers the half-open interval `[start_ms, end_ms)`. Return `(peak, first_ms, ms_at_peak)`: the largest number of distinct viewers watching at the same instant, the earliest time that number is reached, and the total time (summed over every stretch) during which exactly that many are watching. If no viewer counts, return `(0, -1, 0)`. {{viewer_rule}} {{min_rule}}

**Constraints.** Up to 200 000 sessions over a two-hour broadcast (timestamps in milliseconds). Expected: O(n log n). Counting viewers separately at every boundary, or marking every millisecond, is far too slow.

**Assumptions.** Hypothetical traffic. Session times are already on one clock.

**Clarifications.**
- Q: One viewer leaves at exactly the millisecond another joins. Were both watching at once? | A: No. Intervals are half-open, so at that instant only the new viewer is watching.
- Q: The same viewer on a phone and a laptop at once? | A: At the Hard and Very Hard levels that can happen; they count once.
- Q: What exactly is ms_at_peak? | A: The total length of all stretches during which the count equals the peak, even if they are separated in time.
- Q: What if sessions is empty? | A: Return (0, -1, 0).

**Hints.**
1. Turn each counted interval into two events, +1 at its start and −1 at its end, sort them by time, and apply every event at the same time before reading the count.
2. The count after the events at time t holds until the next event time, which gives the length of each stretch.
3. To count a viewer once, first merge each viewer's sessions that overlap or touch; at the Very Hard level, apply `min_ms` to the merged intervals, not to raw sessions.

**Follow-ups.**
1. Show the live count every second during the broadcast instead of after it. What state do you keep, and how do you handle a device that disappears without a stop event?
2. Sessions arrive from three regions with up to 30 seconds of delay. How do you publish a live number that does not jump backwards?
3. Ten thousand broadcasts are live at once and you need the top 100 by current viewers every second. What data structure, and what does each update cost?
4. You need the number of distinct viewers who watched at any point, for a broadcast with 50 million sessions, within 1%. What do you use, and what does it cost in memory?

**Follow-up rules.**
- when: sort, sorted → ask: At one timestamp a viewer leaves and another joins. In what order do your events apply, and does it matter for the peak?
- when: merge, overlap → ask: Your merge treats touching sessions as one. What would change if a 1 ms gap also counted as continuous?
- when: heartbeat, every second → ask: If the player only sent heartbeats every 10 seconds, what is the error bound on your peak?
- when: hyperloglog, approximate, sketch → ask: Can a mergeable sketch answer the peak concurrent question, or only the distinct total? Why?

**Evaluation Criteria.** Correct half-open handling, with all events at one time applied before the count is read; viewers counted once via per-viewer merging of overlapping and touching sessions; min_ms applied after merging at the Very Hard level; correct first time and total time at the peak; O(n log n) with a clear argument.
