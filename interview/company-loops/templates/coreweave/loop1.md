# CoreWeave · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a GPU cloud for
AI workloads: capacity reservations and contracts, on-demand GPU instances,
Kubernetes-based customer clusters, GPU-hour metering and billing, regions and
data centres with power constraints, customer-facing SLAs and planned maintenance.
Every price, capacity, power figure, SLA term, volume and schema is hypothetical and
"this exercise's rule; check current docs"; nothing here describes a real
customer, contract, data centre, supplier or internal system.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## CRW-L1-01: Time to ready — minutes from a cluster request to its last node ready, per region, GPU type and week

| | |
|---|---|
| **Template ID** | CRW-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / per-entity first events, ROW_NUMBER to the n-th, percentile_cont, FILTER |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | CRW-L1-01.mjs |

**Business Scenario.** Customers of a GPU cloud ask for a Kubernetes-based cluster of a given size in a region and GPU type. Nodes are allocated, imaged and health-checked, and each reports `ready` when it can take work. The provisioning team publishes a weekly view of how long customers wait for a whole cluster, per region and GPU type, and keeps clusters that never became fully ready visible next to it rather than letting them vanish from the averages.

**Problem Statement.** Write one PostgreSQL query that returns `week_start, region, gpu_type, ready_clusters, median_minutes, max_minutes, partial_clusters`, one row per (week, region, GPU type) that has at least one request that was not cancelled, ordered by `week_start, region, gpu_type`. `week_start` is the Monday (a date) of the UTC week of `requested_at`. Requests with a `cancelled_at` are excluded entirely. A node's ready time is its first `ready` event. A cluster is ready at the moment its `nodes_requested`-th distinct node first reported ready; its time to ready is the minutes from `requested_at` to that moment. `ready_clusters` counts ready clusters; `median_minutes` is `percentile_cont(0.5)` and `max_minutes` the maximum of their times to ready (both NULL when no cluster in the group is ready). `partial_clusters` counts requests that never had `nodes_requested` distinct ready nodes. {{week_rule}} {{flap_rule}} {{replace_rule}}

**Constraints.** One SQL statement (CTEs allowed). Timestamps are whole minutes. The sample has {{requests}} requests and {{events}} node events; production has many thousands of nodes a week.

**Assumptions.** Regions, GPU types, cluster sizes and timings are hypothetical. Node states are simplified to `provisioning`, `ready` and `not_ready`; a real provisioning pipeline has more steps. The data was extracted after every request in it had settled.

**Clarifications.**
- Q: Which week does a request belong to? | A: The UTC week (Monday start) of `requested_at`, even if its nodes became ready the next week.
- Q: A cancelled request had all its nodes ready before it was cancelled. Does it count? | A: No. Any request with a `cancelled_at` is excluded from every column.
- Q: A node reported `ready`, then `not_ready`, then `ready` again. When was it ready? | A: At its first `ready` event.
- Q: What if more nodes report ready than were requested? | A: The cluster was ready when the `nodes_requested`-th distinct node first became ready. Later nodes do not move it.
- Q: Do partial clusters count in the median? | A: No. They have no time to ready; they appear only in `partial_clusters`.

**Hints.**
1. Reduce events first: one row per (request, node) with `MIN(event_ts)` over `ready` events.
2. `ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY first_ready)` and a join on `k = nodes_requested` gives the moment the cluster became ready; a request with no such row is partial.
3. LEFT JOIN the ready times onto the non-cancelled requests, then aggregate with `percentile_cont(0.5) WITHIN GROUP (ORDER BY …)` and `COUNT(*) FILTER (WHERE … IS NULL)`.

**Follow-ups.**
1. Customers see "ready" on a status page. Should their clock start at the request, at quota approval, or at capacity being found? How would you report each without double counting?
2. Some clusters sit partial for days. Add a column for the age of the oldest partial cluster per group, and say what the query needs to know about "now".
3. At tens of thousands of nodes a week, how would you maintain this report incrementally as node events stream in, including events that arrive late?
4. A median hides a long tail. Which percentiles would you publish for a customer-facing commitment, and how many clusters does a group need before p95 means anything?

**Follow-up rules.**
- when: max(, max of, last node → ask: A failed node is replaced and later recovers, so the cluster has one more ready node than it asked for. What does your MAX return, and when was the cluster actually usable?
- when: count(*), count of events, ready events → ask: A node flaps not_ready and back to ready. How many times does your count see it, and can a partial cluster look ready?
- when: avg, average, mean → ask: Why might the provisioning team prefer the median here, and what would you show next to it so the tail is not hidden?
- when: cancelled, where cancelled_at → ask: A customer cancels after every node became ready. Should that request count as a success in this report, and in a different report?
- when: date_trunc, week → ask: Which timestamp decides the week, and what happens to a request made at 23:50 on a Sunday?

**Evaluation Criteria.** Excludes cancelled requests entirely; first ready event per node; the `nodes_requested`-th distinct node rather than the last; partial clusters counted apart and kept out of the median; week of the request; a row per group even when nothing in it became ready; deterministic order; sensible answers on clock start, tails and incremental maintenance.

## CRW-L1-02: SLA credits — unavailable node-minutes per cluster and month, with maintenance announced in advance excluded

| | |
|---|---|
| **Template ID** | CRW-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / interval overlap, de-duplicating overlapping intervals, month splitting, tiered CASE |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | CRW-L1-02.mjs |

**Business Scenario.** A GPU cloud offers customers an availability commitment per cluster and month. When a node is unavailable, the minutes count against availability, except during planned maintenance that was announced far enough ahead. At month end the billing team needs, per cluster, the unavailable node-minutes, the availability, and the credit tier it earns under this exercise's SLA (hypothetical terms; check current docs for any real SLA).

**Problem Statement.** Write one PostgreSQL query that returns `month, cluster_id, customer_id, node_minutes, unavailable_node_minutes, availability_pct, credit_pct` for every cluster and every month of the report ({{report_months}}), ordered by `month, cluster_id`. `month` is the first day of the month (a date). `node_minutes` is `node_count` times the minutes in the month. A node is unavailable for each minute covered by one of its `node_outages` records (`started_at` inclusive, `ended_at` exclusive), except minutes inside a maintenance window of the same cluster (`starts_at` inclusive, `ends_at` exclusive) that was announced at least {{notice_hours}} hours before it started (`announced_at <= starts_at - {{notice_hours}} hours`). `availability_pct` is `100 × (node_minutes − unavailable) / node_minutes` rounded to 3 decimals. `credit_pct` is 0 when that availability (unrounded) is at least {{sla}}, 10 when it is at least 99.0, 25 when it is at least 95.0, and 50 otherwise. {{months_rule}} {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). Every timestamp is a whole minute, in UTC. The sample has {{outages}} outage records; a real fleet has many thousands of nodes per month.

**Assumptions.** The SLA target, notice period and credit tiers are this exercise's hypothetical rules, not any provider's terms; check current docs. A cluster's node count is constant over the report. Only outage records make a node unavailable; a maintenance window with no outage in it costs nothing.

**Clarifications.**
- Q: A window was announced exactly {{notice_hours}} hours before it started. Is that in advance? | A: Yes. At least the notice period, inclusive.
- Q: An outage starts before a maintenance window and ends inside it. | A: Only its minutes inside an advance-announced window are excluded; the rest count.
- Q: Two records cover the same minute on the same node. | A: That node-minute is unavailable once.
- Q: Does a maintenance window on one cluster excuse an outage on another? | A: No. Only the cluster's own windows apply.
- Q: Is availability exactly at {{sla}} a breach? | A: No. At least the target earns no credit; compare before rounding.

**Hints.**
1. The simplest correct shape is a minute grid: expand each outage into its minutes with `generate_series`, drop minutes inside a qualifying window, and `DISTINCT` on (node, minute).
2. Build the cluster × month grid separately and count each cluster's unavailable minutes inside each month's half-open range, so a cluster with no outages still gets a row.
3. Compare availability with the tiers as `100.0 * (node_minutes - unavailable) >= target * node_minutes` to stay exact.

**Follow-ups.**
1. The minute grid is fine for a sample. At 50 000 nodes and month-long outages it is not. Rewrite the unavailable total with interval arithmetic: merge each node's outages, then subtract maintenance overlaps.
2. A control-plane failure makes the whole cluster unusable while every node reports healthy. How do you model cluster-level unavailability so it is not double counted with node outages?
3. Credits are paid in the next invoice. An outage record arrives after the month was closed. What do you do with the credit?
4. Customers ask to audit the number. What do you publish to them, and what must stay out of it?

**Follow-up rules.**
- when: generate_series, minute grid, per minute → ask: How many rows does your grid produce for 50 000 nodes in a month with a 3% outage rate, and what would you do instead?
- when: sum(, sum of durations, ended_at - started_at → ask: Two monitors recorded the same failure with overlapping records. What does your sum report for that node, and how do you count each minute once?
- when: announced_at, notice → ask: Is a window announced exactly the notice period ahead in advance or late in your query? Point to the comparison.
- when: round(, rounded → ask: Do you choose the credit tier from the rounded or the unrounded availability, and when can the two disagree?
- when: date_trunc, month of → ask: An outage runs from 30 September 22:00 to 1 October 03:00. How many minutes does each month get in your query?

**Evaluation Criteria.** Minutes inside advance-announced windows of the same cluster excluded, inclusive notice; overlapping records counted once; outages split at month boundaries and clipped to the report; a cluster × month grid including clusters with no outages; exact tier comparison and an inclusive target; rounding to 3 decimals only for display; deterministic order; a credible plan for interval arithmetic at scale and late records.

## CRW-L1-03: Contracted power per data hall and day — peak draw, minutes above 90%, and halls with an hour of missing readings

| | |
|---|---|
| **Template ID** | CRW-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / DISTINCT ON de-duplication, local days with AT TIME ZONE, LAG with sentinels for gaps |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | CRW-L1-03.mjs |

**Business Scenario.** Each data hall in a GPU cloud draws power under a contract with a fixed contracted capacity (all figures in this exercise are hypothetical). Meters report a hall's average draw every half hour. The capacity team reviews every hall each day: how close the peak came to the contract, how long the hall ran above 90% of it, and which hall-days cannot be trusted because the meter went quiet for an hour or more.

**Problem Statement.** Write one PostgreSQL query that returns `day, hall_id, readings, peak_kw, peak_pct, minutes_above_90, data_gap`: one row for every hall and every day from {{first_day}} to {{last_day}}, ordered by `day, hall_id`. A reading at `reading_ts` (always on :00 or :30) is the hall's average draw over the 30 minutes that start then. A hall's day runs from midnight to midnight in its `site_tz`, and a reading belongs to the day of its `reading_ts` in that zone. `readings` counts the hall-day's readings; `peak_kw` is the highest `draw_kw`; `peak_pct` is `100 × peak_kw / contracted_kw` rounded to 1 decimal (both NULL with no readings). `minutes_above_90` is 30 for every reading whose draw is strictly greater than 90% of `contracted_kw`. `data_gap` is true when some stretch of 60 minutes or more of the day is covered by no reading, including at the start or end of the day. {{days_rule}} {{dup_rule}} {{tz_rule}}

**Constraints.** One SQL statement (CTEs allowed). A reading of exactly 90% is not above it. A single missing reading leaves 30 uncovered minutes, which is not a gap; two in a row is. The sample has {{readings}} readings.

**Assumptions.** Halls, contracts, draws and time zones are hypothetical. Draws are already in kW; meters never report a reading off the half hour. The report days are in mid-September, with no daylight-saving change.

**Clarifications.**
- Q: Is a draw of exactly 90% of the contract "above 90%"? | A: No. Strictly greater only.
- Q: The first reading of the day is at 01:00. Is that a gap? | A: Yes. 00:00 to 01:00 is 60 minutes with no reading covering it.
- Q: One reading is missing at 14:30. Gap? | A: No. That is 30 uncovered minutes.
- Q: What if a hall has no readings at all on a day? | A: It still gets a row: `readings` 0, `peak_kw` and `peak_pct` NULL, `minutes_above_90` 0, `data_gap` true.
- Q: The same reading appears twice with different values. | A: Keep the copy with the latest `received_at`; the meter re-sent a corrected value.

**Hints.**
1. De-duplicate first: `DISTINCT ON (hall_id, reading_ts) … ORDER BY hall_id, reading_ts, received_at DESC`.
2. `reading_ts AT TIME ZONE site_tz` gives local wall-clock time; its `::date` is the hall's day. Build the hall × day grid with `generate_series` and LEFT JOIN onto it.
3. For gaps, add two sentinel marks per hall-day, 30 minutes before midnight and at the next midnight, then look at `t - LAG(t)` over the reading starts: a difference of 90 minutes or more means at least 60 uncovered minutes.

**Follow-ups.**
1. The contract is measured on a 15-minute average, not a 30-minute one, and meters move to 1-minute readings. What changes in the query and in what you can claim about the peak?
2. Halls have two independent feeds whose draws add up, and one feed's meter goes quiet. How do you report the hall's draw honestly?
3. Turn the daily report into an alert that fires within minutes when a hall runs above 90% for half an hour, without paging on a single noisy reading.
4. A site in a zone with daylight saving has a 23-hour and a 25-hour day each year. What happens to your grid, your gap rule and `minutes_above_90` on those days?

**Follow-up rules.**
- when: lag, lead → ask: Your LAG compares consecutive readings. What does it say about a hall whose first reading of the day is at 01:30?
- when: >=, at least → ask: A reading is exactly 90% of the contract. Does your query count it, and which rule asks for?
- when: date(reading_ts, ::date, utc → ask: A hall is seven hours behind UTC. Which local day does its reading at 03:00 UTC belong to in your query?
- when: distinct on, row_number, received_at → ask: Two copies of a reading have the same received_at. Which one does your query keep, and is that deterministic?
- when: generate_series, grid → ask: Why does a hall-day with no readings need a grid, and what would your query return for it without one?

**Evaluation Criteria.** De-duplicates by latest `received_at`; groups by the hall's local day; a hall × day grid that keeps days with no readings; strict 90% comparison; gaps of 60 minutes or more detected at the edges as well as between readings, and a single missing reading not flagged; correct rounding; deterministic order; sensible answers on finer readings, dual feeds and DST days.

## CRW-L1-04: Maintenance slots — the fewest moments that fall inside every customer's allowed window

| | |
|---|---|
| **Template ID** | CRW-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy / interval stabbing by earliest end, bisect over merged freezes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | CRW-L1-04.mjs |

**Business Scenario.** A GPU cloud needs to apply a disruptive update to a shared component that every customer cluster in a region depends on. Each customer cluster has an allowed maintenance window, and the update can be applied at an instant (a "moment") that serves every cluster whose window contains it. Every moment costs a status-page announcement and on-call cover, so the operations team wants as few moments as possible, and, among equally small plans, the latest ones, to leave customers the most time.

**Problem Statement.** Implement `maintenance_moments(windows, freezes=())`. `windows` is a list of `(start, end)` integer minutes, inclusive at both ends, in any order. Return the moments as an ascending list of integers such that every window contains at least one moment, with as few moments as possible. If several smallest schedules exist, return the latest one: compare schedules moment by moment from the first, and the later moment wins at the first difference. Return `[]` when there are no windows. {{invalid_rule}} {{freeze_rule}}

**Constraints.** Up to 100 000 windows over a year of minutes (525 600) in the timing check, needing thousands of moments. Rebuilding the list of uncovered windows after each pick is O(n·k) and too slow; O(n log n) is expected.

**Assumptions.** Windows, freezes and minutes are hypothetical; a real maintenance plan also weighs duration, capacity and customer impact. A moment takes no time. Windows are independent of one another, and any minute is a possible moment unless a freeze forbids it.

**Clarifications.**
- Q: Do the windows include their end minute? | A: Yes. `(10, 20)` contains both 10 and 20, so `(10, 20)` and `(20, 30)` share the moment 20.
- Q: Are the windows sorted? | A: No. They come in any order and may repeat.
- Q: Which schedule do you want when several have the fewest moments? | A: The latest: the later first moment wins; if equal, the later second moment, and so on.
- Q: What do I return for an empty list of windows? | A: `[]`.
- Q: Can I raise an exception on bad input? | A: No. Return `None` for the cases the statement names.

**Hints.**
1. Look at the window that ends first. Some moment must be inside it, and no moment inside it can be later than its end.
2. Sort by end. Keep the last moment placed; a window whose start is at or before it is already served, otherwise place a new moment at its end.
3. With freezes, the latest allowed minute at or before an end is found by merging the freezes once and bisecting into their sorted starts.

**Follow-ups.**
1. Prove that the earliest-end greedy uses the fewest moments, and that it also gives the latest schedule.
2. Each customer now has two or three allowed windows and any one will do. What happens to the problem, and what would you do in practice?
3. Each moment can update at most `c` clusters at once. How does the greedy change, and is it still optimal?
4. Windows arrive as customers edit them during the week. How would you keep the plan up to date without recomputing it from scratch each time?

**Follow-up rules.**
- when: sort by start, sorted by start, earliest start → ask: Try (0, 500), (40, 80), (200, 260) with a start-ordered greedy. How many moments does it place, and where?
- when: list comprehension, remove, rebuild, filter → ask: After each pick you rebuild the list of remaining windows. How many window checks is that for 100 000 windows and 7 000 picks?
- when: set cover, np-hard, brute force → ask: General set cover is hard. What property of intervals on a line makes this case easy?
- when: bisect, merged, merge the freezes → ask: Why must touching freezes be merged before you step to the minute before one?
- when: heap, priority queue → ask: What does the heap give you here that one sort by end does not?

**Evaluation Criteria.** Earliest-end greedy with a correct "already served" test (start ≤ last moment); inclusive ends, touching windows sharing a moment; the latest schedule among the smallest; `[]` for no windows; at Hard, zero-length, duplicate and nested windows and `None` for an invalid window; at Very Hard, the latest allowed minute under merged freezes and `None` when a window has none; O(n log n) with a clear argument; an exchange-argument proof sketch.

## CRW-L1-05: Burst stretch — the run of consecutive hours where usage most exceeded the reservation

| | |
|---|---|
| **Template ID** | CRW-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Dynamic programming / maximum subarray (Kadane) with tie rules and resets |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer, ai-infra-engineer |
| **Generator** | CRW-L1-05.mjs |

**Business Scenario.** A customer of a GPU cloud reserves a number of GPUs and can burst above the reservation on demand. Hour by hour, usage sometimes exceeds the reservation and sometimes falls below it. When the account team proposes a larger reservation, they want the single stretch of consecutive hours where the customer's usage most exceeded what it had reserved, counting the quiet hours inside the stretch against it, so the proposal rests on one sustained burst rather than scattered spikes.

**Problem Statement.** Implement `burst_stretch(usage, reservation)`. `usage[h]` is the GPU-hours the customer used in hour `h` (hours are numbered from 0). `reservation` is a list of `(from_hour, gpus)` steps sorted by `from_hour`, at most one per hour; a step holds until the next one. The net of hour `h` is `usage[h]` minus the GPUs reserved in that hour. Return `(start_hour, end_hour, net)` for the run of consecutive hours, inclusive, whose total net is largest. If several runs share that total, return the shortest; if still tied, the earliest. Return `None` if no hour's usage exceeds its reservation. {{reservation_rule}} {{missing_rule}}

**Constraints.** Up to 52 560 hours (six years of hourly usage) in the timing check. Trying every start and end is O(n²), about 1.4 × 10⁹ pairs, and too slow even with prefix sums. One pass, O(n), is expected.

**Assumptions.** Reservations and usage are hypothetical; how a real contract prices bursts is not part of this exercise. Usage is whole GPU-hours. The run is chosen on net GPU-hours only, not on cost.

**Clarifications.**
- Q: Does an hour exactly at the reservation count as bursting? | A: No. Its net is 0. If no hour has a positive net, return `None`.
- Q: Should the run include zero-net hours at its edges? | A: Not if it does not have to: among runs with the same total, the shortest wins.
- Q: Two separate bursts have the same total and the same length. | A: The earlier one.
- Q: Can the run contain hours below the reservation? | A: Yes, if the hours on both sides make up for them; the total net is what is compared.
- Q: May I return a list instead of a tuple? | A: Return a tuple `(start_hour, end_hour, net)`, or `None`.

**Hints.**
1. Keep the best total of a run ending at the current hour: either extend the previous run or start fresh here.
2. Start fresh whenever the running total is zero or below. Restarting on zero, not only on a negative total, is what keeps the run as short as possible.
3. Update the answer only when the total is strictly larger, or equal and shorter; that keeps the earliest among equals.

**Follow-ups.**
1. Prove that the restart-on-non-positive rule gives, for each end hour, the shortest run with the best total ending there.
2. The account team wants the best stretch of at most 72 hours. What changes, and what is the complexity now?
3. Usage arrives as a stream, hour by hour, for 10 000 customers. What state do you keep per customer to report the best stretch so far?
4. The team now wants the top three non-overlapping stretches. How would you find them?

**Follow-up rules.**
- when: prefix sum, prefix sums, every start, nested loop → ask: How many (start, end) pairs is that for six years of hours, and what would let you skip all but one start per end?
- when: cur < 0, negative, reset when negative → ask: With nets 0, 0, 5, which run does your code return, and which does the tie rule ask for?
- when: max(, max of slice → ask: Your max over a slice runs in C. What is the total work over all starts, and roughly how long is that for 52 560 hours?
- when: -1, missing, none → ask: Why is treating a missing hour as zero usage wrong here, and what does your code do instead?
- when: dataframe, pandas, cumsum → ask: Write the vectorised version: which running minimum do you need alongside the cumulative sum, and how do you keep the tie rule?

**Evaluation Criteria.** Net per hour from the step in force, 0 before the first step; a one-pass maximum-subarray scan; restart on a non-positive total so ties go to the shortest run; strict improvement for the earliest; `None` when no hour bursts; at Very Hard, missing hours end every run; O(n) with a clear argument; good answers on bounded length, streaming and top-k.
