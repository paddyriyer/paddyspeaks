# Meta · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a company that
runs social apps, messaging apps and an advertising business. These are not
questions from any company's interviews. Every workload, number, rate, policy
and schema is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MET-L2-01: Ad slots in a feed session — spacing, caps and advertiser alternation

| | |
|---|---|
| **Template ID** | MET-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / interval spacing, layered DP, best-two-of-different-colour |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | MET-L2-01.mjs |

**Business Scenario.** A social app's feed mixes organic posts with ads. For one scrolling session, a ranking system has already scored a candidate ad for every feed slot: the estimated value of showing that ad there, net of the estimated cost to the person's experience of displacing an organic post. A value can be negative. A hypothetical ad-load policy keeps ads apart so the feed does not feel like a catalogue. You are writing the routine that picks which slots get ads.

**Problem Statement.** Implement `best_ad_load(values, gap, max_ads=None, advertisers=None)`. `values[i]` is the integer net value of placing the candidate ad in slot `i` (slots are numbered in scrolling order from 0). Choose any set of slots such that any two chosen slots have at least `gap` organic slots between them: chosen slots `p < q` need `q − p ≥ gap + 1`. {{cap_rule}} {{advertiser_rule}} Return the largest possible total of the chosen values. Choosing no slots is allowed and gives 0.

**Constraints.** Up to 300 000 slots when there is no cap; up to 20 000 slots and `max_ads` ≤ 80 otherwise; `gap` ≥ 0; an empty feed is allowed; up to 500 distinct advertisers. Values are integers between −10⁶ and 10⁶. Expected: O(n) without a cap and O(n · `max_ads`) with one, independent of the number of advertisers.

**Assumptions.** Values, the spacing policy, the cap and the advertiser rule are hypothetical simplifications; real ad delivery also involves auctions, pacing and many other policies. Each slot has exactly one candidate ad, already chosen. The feed length is fixed for the session.

**Clarifications.**
- Q: Does `gap` count the organic slots between two ads, or the distance between them? | A: The organic slots between them. With gap 2, ads in slots 3 and 6 are allowed (slots 4 and 5 are organic); slots 3 and 5 are not.
- Q: Can I return an empty selection? | A: Yes. If every value is negative or zero, the answer is 0.
- Q: Is `max_ads` a maximum or an exact count? | A: A maximum. Fewer ads are fine.
- Q: With advertisers, may the same advertiser appear twice in the session? | A: Yes, as long as some other advertiser's ad is shown between the two. Only ads that are next to each other in the chosen sequence must differ.
- Q: Would the best answer ever include an ad with a negative value? | A: Your algorithm should not assume it never does. Work out whether any rule makes it worthwhile.
- Q: Do I need to return the chosen slots? | A: Only the total. Reconstructing the slots is a follow-up.

**Hints.**
1. Without a cap: let `best[i]` be the best total using only slots before `i`. Either slot `i − 1` is empty, or it holds an ad and the previous ad is at least `gap + 1` slots earlier.
2. With a cap, add the number of ads to the state: `best_j[i]` is the best total using at most `j` ads in slots before `i`. Each layer reads only the previous one.
3. With advertisers, "best before slot i" is not enough: you need the best earlier selection whose last ad is from a different advertiser. Track the best ending, its advertiser, and the best ending from any other advertiser.

**Follow-ups.**
1. Return the chosen slots as well. What do you store, and how do you choose among selections with the same total?
2. The feed is infinite: slots arrive as the person scrolls and you must decide each slot when it arrives. What does your offline answer become, and what would you measure to judge an online policy?
3. The policy changes to "at most `max_ads` ads in any window of 20 consecutive slots" instead of a session cap. How does the state change, and what does it cost?
4. Two different teams own the value model and the ad-load policy. How would you test that a policy change does not quietly shift value between advertisers?

**Follow-up rules.**
- when: greedy, largest first, sort by value, sorted(values → ask: Give a small feed where taking the single highest-value slot first loses, and say what your greedy misses.
- when: itertools, combinations, subsets, brute force → ask: How many valid selections does a 20 000-slot feed have, and what structure lets you avoid enumerating them?
- when: for p in range, every earlier slot, scan back → ask: Your inner loop scans earlier slots. What is the total work at 20 000 slots and 80 ads, and which running maximum removes that loop?
- when: per advertiser, dict of advertisers, best_by_advertiser → ask: With 500 advertisers, what does taking the maximum over the other advertisers cost per slot? Do you need all of them?
- when: recursion, lru_cache, memo → ask: What is the recursion depth for 300 000 slots in CPython, and how would you write it bottom-up?

**Evaluation Criteria.** Correct spacing (`q − p ≥ gap + 1`) and empty selection; O(n) DP without a cap and O(n · max_ads) layered DP with one, each layer reading only the previous; at Very Hard, an ending-at-slot state with the best two endings of different advertisers, and the insight that a negative ad can be worth placing as a separator; no recursion-depth failures; can reconstruct the selection and discuss an online version.

## MET-L2-02: Degrees of separation on the friendship graph

| | |
|---|---|
| **Template ID** | MET-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Graphs / bidirectional breadth-first search, shortest-path counting |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | MET-L2-02.mjs |

**Business Scenario.** A social network stores friendships as an undirected graph. A product analytics team studies how closely people are connected — how many friendships separate two people — to understand how content can travel between communities. They have a snapshot of friendships and a list of pairs to measure, and they do not care about chains longer than a few steps.

**Problem Statement.** Implement `separation(friendships, queries, max_depth, inactive=None, count_paths=False)`. `friendships` is a list of `(user_a, user_b)` pairs of integer user ids; a friendship goes both ways and may appear more than once, in either order. For each `(u, v)` in `queries`, return the number of friendships on the shortest chain from `u` to `v`, or `-1` if there is no chain of at most `max_depth` friendships. A user is 0 friendships from themselves, even a user who appears in no friendship. {{inactive_rule}} {{count_rule}} Return one answer per query, in query order.

**Constraints.** Up to 60 000 users with 300 000 friendship rows and 600 queries in the timing check (the graph can be larger in the follow-ups); 1 ≤ `max_depth` ≤ 6. A search that reaches most of the graph for every query is too slow; aim to touch only the neighbourhoods needed.

**Assumptions.** User ids, the snapshot and the queries are hypothetical. The output is a distance and a count, never a list of the people on a chain. The friendship list never contains a pair of a user with themselves.

**Clarifications.**
- Q: Is a friendship directed? | A: No. If (a, b) is listed, a is b's friend and b is a's.
- Q: Is max_depth inclusive? | A: Yes. A chain of exactly max_depth friendships is reported; a longer one gives -1.
- Q: What about a query for a user who appears in no friendship? | A: That user has no friends: the answer is -1, unless the query asks for the distance from that user to themselves, which is 0.
- Q: Does a repeated friendship row create a second chain? | A: No. A chain is a sequence of distinct users; repeating a row changes nothing.
- Q: Can I precompute all distances? | A: Not for the graph sizes in the follow-ups: pairs grow with the square of the users.

**Hints.**
1. Run a breadth-first search from both ends at once and stop when the two searches meet. Each side only needs to go about half the distance.
2. Always grow the side whose current frontier is smaller. A frontier that includes a person with thousands of friends is expensive to expand.
3. Expand a whole layer at a time. When the new layer touches the other side's visited set, every touching user is the same distance from both ends.
4. For the count, carry the number of shortest ways to reach each user on each side; a meeting user contributes the product of the two.

**Follow-ups.**
1. One user in the graph has 5 million friends (a public figure followed as a friend). How does that change your choice of which side to expand, and what does it do to the worst case?
2. The graph is 3 billion users and does not fit in one machine's memory. How would you answer the same batch of queries with a distributed engine, and how many rounds of data shuffling does it take?
3. Instead of exact distances for pairs, the team wants the average distance across the whole network. How would you estimate it without running a search from every user?
4. The snapshot is refreshed daily while the analysis runs for a week. What do you version, and how do you make the results reproducible?

**Follow-up rules.**
- when: single bfs, deque, bfs from u, one-sided → ask: From one end, how many users does your search touch before it reaches a user 5 friendships away when the average person has 10 friends?
- when: dijkstra, heap, priority queue → ask: Every friendship has the same weight. What does the heap buy you here, and what does it cost per step?
- when: dfs, recursion, depth-first → ask: Does a depth-first search find the shortest chain first? How would you bound it, and what happens on a 60 000-user chain in CPython?
- when: floyd, all pairs, matrix, precompute → ask: How much memory do all-pairs distances need for 60 000 users, and for 3 billion?
- when: visited, seen, mark visited → ask: When counting shortest chains, a user can be reached twice in the same layer. Does your visited check drop the second way in?

**Evaluation Criteria.** Correct undirected adjacency with repeated rows collapsed; inclusive max_depth; distance 0 for the same user; bidirectional search expanding whole layers from the smaller frontier, stopping at the first meeting layer; at Hard, deactivated accounts excluded from chains and endpoints; at Very Hard, correct shortest-chain counts (layer counts, products at the meeting layer); explains why each meeting user is equidistant; O(neighbourhoods touched) per query rather than O(graph).

## MET-L2-03: Debug the feed dwell-time calculator

| | |
|---|---|
| **Template ID** | MET-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Debugging / interval reconstruction from client events, ordering, caps and thresholds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer, ml-platform-engineer |
| **Generator** | MET-L2-03.mjs |

**Business Scenario.** A social app's feed measures how long each post was on screen. The app logs a `start` event when a post becomes visible enough to count and a `stop` event when it no longer is, plus a `background` event when the app leaves the screen. Events are uploaded in batches. A job turns one session's events into dwell time per impression, which feeds engagement metrics and ranking labels. After a client update that changed how uploads are batched, dwell times for some posts became implausibly long, posts glanced at for a moment started counting as viewed, and long reads were cut short. The function below is the suspect.

**Problem Statement.** Fix `dwell_by_impression(events, min_visible_ms, cap_ms)` so that it meets this specification. Each event is a dict `{"imp", "kind", "ts"}`: `kind` is `"start"`, `"stop"` or `"background"` (whose `imp` is `None`), and `ts` is epoch milliseconds. {{upload_rule}}
1. **Order.** Process events in `ts` order. At the same `ts`, `stop` and `background` events come before `start` events.
2. **Intervals.** A `start` opens an interval for its impression; a `start` for an impression whose interval is already open is a repeat and changes nothing. A `stop` closes that impression's open interval (a `stop` with nothing open is ignored). A `background` closes **every** open interval at its `ts`. An interval still open after the last event closes at the largest `ts` in the list.
3. **Cap.** Each interval contributes at most `cap_ms`: the cap applies to every interval separately, not to the impression's total.
4. **Viewable.** An impression is viewable if at least one of its intervals lasted `min_visible_ms` or longer (before capping). Several short glances do not add up to a view.
5. **Output.** `{imp: dwell_ms}` for viewable impressions only, where `dwell_ms` is the sum of that impression's capped intervals.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events in a call; a sort plus one pass is expected. `cap_ms` ≥ `min_visible_ms`.

**Assumptions.** The event shape, the thresholds and every value are hypothetical, and the visibility rule that triggers `start` and `stop` is already applied on the device. Timestamps come from one device clock, so they are comparable within a session.

**Clarifications.**
- Q: Can two posts be visible at the same time? | A: Yes. On a large screen, or while scrolling, two posts can each be visible enough to count.
- Q: Why would the client send start twice for the same post? | A: For example after a layout change while the post stays visible. It is a repeat; the interval keeps its original start.
- Q: A stop and a start for the same post have the same ts. What happens? | A: The stop first, so one interval ends and a new one begins. Both count separately.
- Q: Is exactly min_visible_ms viewable? | A: Yes. The comparison is inclusive.
- Q: Does the cap apply before or after adding up intervals? | A: Before: each interval is capped on its own.
- Q: How many bugs are there? | A: Several, of different kinds. Each has a test that only it fails.

**Hints.**
1. Feed the function the events of two upload batches with the later batch first. What does a `stop` that arrives before its `start` do?
2. Put two posts on screen and send the app to the background. How many intervals end?
3. Start a post, send `start` again 300 ms later, then stop it. What start time does the code use?
4. Write down an impression with two 0.6 × `cap_ms` intervals, and one with two intervals of half `min_visible_ms`. What should each produce?

**Follow-ups.**
1. Write the smallest set of unit tests that would have caught every one of these bugs before the client update shipped.
2. The job moves into a streaming pipeline. When can you emit an impression's dwell, given that batches arrive late and out of order?
3. Device clocks jump (a user changes the time, or the phone syncs). How would you detect it in a session, and what would you do with the affected intervals?
4. The ranking team wants dwell as a label. Which of these bugs would have biased the label, in which direction, and for which kinds of posts?

**Follow-up rules.**
- when: sorted(, sort by ts, key=lambda → ask: Two events share a timestamp: a stop and a start for the same post. What does your sort key do with them, and what should happen?
- when: max(open_at, on screen, the post being looked at → ask: Is only one post ever on screen? What does backgrounding the app do to the others?
- when: open_at[imp] = ts, overwrite, reset the start → ask: The client repeats a start 300 ms after the first. Which start time should the interval keep, and what does your code keep?
- when: min(t, cap_ms), cap the total, min(total → ask: An impression has two intervals of 0.6 × cap_ms. What dwell does the specification give, and what does your code give?
- when: t >= min_visible_ms, total >= min, sum of intervals → ask: Five glances of 200 ms each: is that a view under the specification?

**Evaluation Criteria.** Finds and explains every bug with its symptom (arrival order instead of time order; backgrounding closes only one post; a repeated start resets the interval; cap on the total instead of per interval; viewability judged on the total); sorts with the stop-before-start tie rule; fixes each minimally without new bugs; keeps a sort plus one pass; proposes a regression test per bug.

## MET-L2-04: Ad account reports in every advertiser's time zone

| | |
|---|---|
| **Template ID** | MET-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / time-zone-aware rollups, restatement, late data, reconciliation with billing |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_impressions": {"2": ["5 billion", "20 billion"], "3": ["100 billion", "300 billion"]},
  "ad_accounts": {"2": ["500,000", "2 million"], "3": ["10 million", "20 million"]},
  "restate_days": ["3 days", "7 days", "28 days"],
  "freshness": ["15 minutes", "1 hour"]
}
```

**Business Scenario.** An advertising business serves about {{daily_impressions}} ad impressions a day for {{ad_accounts}} ad accounts. Each ad account has a reporting time zone and a currency, set when the account is created. Advertisers read reports in the ads manager and through a reporting API: impressions, clicks, spend and attributed conversions by day or hour, at campaign, ad set and ad level, with breakdowns such as placement, country and age range. They expect today's numbers within {{freshness}}. Numbers for a day keep changing for {{restate_days}}: conversions are attributed after the fact, and impressions and clicks judged invalid are removed and their charges reversed.

**Problem Statement.** Design the pipeline from delivery and billing events to these reports. Cover the storage grain that lets every account see its own days and hours, daylight-saving days, the near-real-time path and the settled path, how restatements flow into reports and exports, how spend in the reports reconciles with what the advertiser is billed, how large accounts are served, and how an advertiser who downloaded yesterday's numbers can tell that they changed.

**Constraints.** Every account's "day" is midnight to midnight in its own time zone, including zones whose offset from UTC is not a whole number of hours. Spend is in the account's currency, in minor units, and the settled daily spend must equal what billing charges for that day. Breakdowns by age range or country follow minimum-count rules, so no report reveals a handful of people. Reports must be consistent: totals equal the sum of their rows within one response.

**Assumptions.** Volumes and timings are hypothetical. Attribution and invalid-activity detection are separate systems that publish their results as events; you do not design them. Assume an account's time zone does not change after creation in this exercise.

**Clarifications.**
- Q: Which time zones must work? | A: All of them, including offsets of 30 and 45 minutes from UTC, and zones with daylight-saving time.
- Q: What does a report show for the hour that repeats when clocks go back? | A: Decide and state it: for example two rows labelled with their UTC offset, or one merged row with a note. The daily total must be right either way.
- Q: Is a conversion reported on the day of the conversion or the day of the ad impression or click? | A: Both views exist; the default is the day of the impression or click. Your design should support both without a separate pipeline.
- Q: Do reports need to match the invoice to the minor unit? | A: Settled daily spend does. Today's near-real-time spend is labelled as an estimate.
- Q: How large is the largest account? | A: About 1% of all impressions, with hundreds of thousands of ads.

**Hints.**
1. A UTC hour does not map to one local day for every zone. Choose a stored time grain that every offset in use divides.
2. Keep a near-real-time aggregate for today and a settled aggregate rebuilt from the full event history for days still inside the restatement window; serve the settled one when it exists.
3. Version settled days. An export carries the version it was taken from, so a later restatement is visible rather than silent.

**Follow-ups.**
1. Walk through how one impression at 23:50 UTC appears in the daily report of an account in UTC+05:30 and one in UTC−08:00, from event to report row.
2. An invalid-activity sweep removes 2% of an account's clicks from 5 days ago and reverses their charges. Which tables change, what does the advertiser see, and what happens to an export they downloaded last week?
3. The reporting API returns ad-level hourly rows with an age-range breakdown for an account with 300 000 ads. How do you make that response fast and consistent?
4. Finance reports that settled spend for one currency is 0.03% higher than billing every day. How do you find the cause?
5. Supporting a time zone change for an account becomes a product requirement. What breaks in your design, and what would you change?

**Follow-up rules.**
- when: hourly, utc hour, hour bucket → ask: An account is in UTC+05:45. Which UTC hours belong to its Tuesday, and how does an hourly UTC table answer that?
- when: local time, convert at ingest, local date column → ask: You store the local date per event. What happens when the same event must appear in reports for two views with different time zones, or when a zone's rules change?
- when: overwrite, update in place, upsert → ask: An advertiser exported Monday's numbers on Wednesday and again on Friday, and they differ. How do they find out what changed and why?
- when: float, double, decimal → ask: Spend is billed in minor units. Where does rounding happen in your pipeline, and how do you keep the daily total equal to billing?
- when: materialized view, cube, pre-aggregate every → ask: How many combinations of level, breakdown, grain and time zone does that produce for {{ad_accounts}} accounts, and which do you actually need to store?

**Production Reality Check.**
- On the night clocks go back in one region, advertisers in that region see 25 hours in Sunday's hourly report, and one reports that an hour of spend was charged twice.
- An invalid-activity sweep arrives a day after the {{restate_days}} restatement window closed, for spend that was already invoiced.
- A large advertiser's nightly API export of ad-level hourly rows with breakdowns starts timing out after it doubled its number of ads.

**Evaluation Criteria.** UTC event time stored at a grain every offset divides (15 minutes), with local days computed per account at query or rollup time; correct DST handling with an explicit rule for repeated and missing hours; near-real-time and settled paths with a clear handover; restatements as new versions within the window, and a defined policy after it; spend in minor units reconciled with billing per day and currency; breakdown thresholds; consistent responses for large accounts; capacity reasoning at {{daily_impressions}} impressions a day.

## MET-L2-05: Friendship-graph clusters for network experiments, rebuilt nightly

| | |
|---|---|
| **Template ID** | MET-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Batch graph processing / iterative Spark jobs, skew, stability across runs |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, data-engineer |

```params
{
  "users": {"2": ["200 million", "500 million"], "3": ["2 billion", "3 billion"]},
  "avg_friends": [150, 300],
  "cluster_size": ["5,000 people", "50,000 people"],
  "batch_window": ["4 hours", "8 hours"],
  "max_churn": ["1%", "5%"]
}
```

**Business Scenario.** A social network tests changes to features where one person's experience depends on their friends' — a new way to share, for example. If friends land in different experiment groups, the groups influence each other and the measured effect is biased. A common remedy, described in public research on network experiments, is to randomise whole clusters of closely connected people rather than individuals. The experimentation team wants a cluster assignment for the {{users}} people in the friendship graph (about {{avg_friends}} friends each on average), with clusters of roughly {{cluster_size}}, rebuilt every night within {{batch_window}} from the daily snapshot of the friendship table.

**Problem Statement.** Design the batch pipeline that produces `user → cluster` every night. Cover how the snapshot is read and prepared, the clustering algorithm and how it runs on a distributed engine, how you keep cluster sizes in range, how you handle very high-degree accounts and skew, iterations, checkpoints and failure recovery, how the assignment stays stable from night to night, what running experiments see when clusters change, new and deleted accounts, and the quality metrics you publish with each run.

**Constraints.** At most {{max_churn}} of people may change cluster from one night to the next. An experiment that has started must keep the assignment it started with. Deleted accounts must leave the assignment table within the platform's deletion period. The job shares the cluster with other nightly work and must finish within {{batch_window}}, including retries.

**Assumptions.** Volumes, sizes and limits are hypothetical. Friendships are undirected and stored once per pair in the snapshot. The connected components of a social graph are dominated by one giant component, so components alone are not useful clusters; you need a partitioning method.

**Clarifications.**
- Q: Why not use connected components? | A: Nearly everyone is in one giant component. The clusters need to be small and mostly closed: most friendships inside a cluster.
- Q: Must clusters be exactly the same size? | A: No. Roughly {{cluster_size}}, within a factor of two, so randomisation balances.
- Q: What quality measure matters most? | A: The share of friendships whose two ends are in the same cluster. Higher is better, subject to size limits.
- Q: Can the algorithm be randomised? | A: Yes, with a recorded seed, so a run can be reproduced exactly.
- Q: What happens to people who join after an experiment started? | A: Your design decides, and must explain how it avoids biasing that experiment.

**Hints.**
1. Label propagation fits a distributed engine: each person repeatedly adopts the label most common among their friends, subject to a capacity per label. Each iteration is one join and one aggregation.
2. Start from last night's labels instead of from scratch: it converges faster and keeps churn low.
3. Experiments read a frozen, versioned assignment taken when they start; the nightly job only changes the latest version.

**Follow-ups.**
1. An account with 5 million friend-like connections sits in the graph. What does it do to your joins and to the clustering, and what do you do with it?
2. A night's run dies in iteration 9 of 12. How do you resume, and how do you make sure the result equals an uninterrupted run?
3. How would you show the experimentation team that the clusters are good enough, and that they did not get worse after a change to the algorithm?
4. The friendship graph grows by 0.5% a day. Instead of a nightly rebuild, how could you update clusters incrementally, and what would that do to churn?
5. A person deletes their account. Which tables and versions hold their cluster assignment, and what happens to running experiments that included them?

**Follow-up rules.**
- when: connected components, union find, components → ask: What is the size of the largest component in a social graph, and what would randomising it achieve?
- when: graphx, graphframes, pregel → ask: How much shuffle does one iteration produce with {{users}} people and {{avg_friends}} friends each, and where do the most-connected accounts land?
- when: label propagation, lpa → ask: Without a capacity limit, what do labels do on a social graph after many iterations?
- when: from scratch, recompute everything, fresh run → ask: Two consecutive runs with different random seeds move how many people between clusters, against your {{max_churn}} limit?
- when: checkpoint, cache, persist → ask: Why does lineage grow with each iteration in Spark, and what does a checkpoint cost you per iteration at this size?

**Production Reality Check.**
- After a holiday, a burst of new friendships makes the nightly job need 3 more iterations to converge, and it overruns its nightly window of {{batch_window}}.
- A change to the snapshot export writes each friendship once in each direction for one night, doubling every person's degree.
- An experiment's analysts report that one test group has 40% more people than the other, although randomisation was by cluster.

**Evaluation Criteria.** Explains why components fail and why balanced partitioning is needed; a symmetric edge table prepared once; capacity-constrained label propagation (or a defended alternative) as iterative joins and aggregations; skew handling for very high-degree accounts; checkpointing and deterministic, seeded, resumable iterations; warm starts and an explicit churn limit; frozen, versioned assignments for running experiments; new and deleted accounts handled; published quality metrics (share of edges inside clusters, size distribution, churn) gating each run; finishes within {{batch_window}}, with capacity reasoning.
