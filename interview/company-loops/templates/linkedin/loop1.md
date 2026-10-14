# LinkedIn · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a professional
network: member profiles and skills, connection invitations, company pages and
their followers, jobs, recruiter messaging and salary insights. Every member, page,
number and schema is hypothetical, and nothing here describes how any company's
systems are actually built. Member data is personal: every result here is an
aggregate, or something the member would see about themselves, and nothing infers a
trait a member did not choose to share. Where a product rule is used, it is stated
as this exercise's rule; check current docs.

## LNK-L1-01: Invitation acceptance within 14 days, by sender region and month

| | |
|---|---|
| **Template ID** | LNK-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps-and-islands with LAG and a running sum, as-of joins, inclusive interval windows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | LNK-L1-01.mjs |

**Business Scenario.** A professional network's growth team watches how often connection invitations are accepted, by the sender's region, to spot regions where invitations go unanswered. The report is an aggregate: it never lists who invited whom. Senders can withdraw an invitation, and they sometimes send the same member another one later; the team wants one row per invitation a member actually had in front of them, not one per click.

**Problem Statement.** Write one PostgreSQL query that returns `month, region, invitations, accepted_14d, acceptance_rate`, one row per calendar month (UTC, as the first day of the month, a `date`) of the invitation's first send and the sender's region, ordered by `month, region`. `invitations` counts invitations whose outcome is not `withdrawn`; `accepted_14d` counts those whose outcome is `accepted` with `status_at` no more than 14 days after the invitation's first send (exactly 14 days counts); `acceptance_rate` is `accepted_14d / invitations` rounded to 4 decimal places. {{resend_rule}} {{region_rule}} {{floor_rule}}

**Constraints.** One SQL statement (CTEs allowed). `invitations` has {{invitation_rows}} rows: one per send, with the send's final `status` (`pending`, `accepted`, `ignored` or `withdrawn`) and the time it reached it (`status_at`, NULL while pending). `invitation_id` is not in time order.

**Assumptions.** Members, regions, the resend limit and every count are hypothetical; the resend and withdrawal rules are this exercise's rules, not a description of any product's limits (check current docs). All timestamps are UTC.

**Clarifications.**
- Q: Which month does an invitation belong to? | A: The UTC month of its first send, even if it was resent or accepted in the next month.
- Q: Is "within 14 days" inclusive? | A: Yes. `status_at <= first send + 14 days`; one second later is too late.
- Q: Does an ignored or pending invitation count? | A: Yes, in `invitations` and not in `accepted_14d`. Only `withdrawn` outcomes leave the denominator.
- Q: If an earlier send was withdrawn and the resend was accepted, what is the outcome? | A: The status of the latest send in the chain: accepted.
- Q: Can I output member ids to check my work? | A: While debugging, yes; the deliverable is the aggregate only.

**Hints.**
1. Order each sender–recipient pair's sends with `LAG(sent_at)`; a send that is the pair's first, or more than the resend limit after the previous send, starts a new invitation.
2. A running `SUM` of that "starts a new invitation" flag numbers the invitations; group by it to get the first send and the latest send's status.
3. Look up the region with a correlated subquery or `LATERAL … ORDER BY valid_from DESC LIMIT 1` at the first send, then apply the floor with `HAVING`.

**Follow-ups.**
1. The team wants the same rate by the recipient's region instead. Which joins change, and does anything about withdrawn invitations change?
2. Invitations sent in the last 14 days have not had their full window yet. How would you keep this month's number from looking artificially low on a live dashboard?
3. A region has 40 invitations in a month. How would you show its rate without implying more precision than it has?
4. At billions of invitations a year, how would you compute this incrementally each day, given that a resend can change last week's invitation?

**Follow-up rules.**
- when: row_number, rank → ask: Your ranking finds each pair's sends in order. How do you decide where one invitation ends and the next begins?
- when: distinct, group by sender_id, recipient_id → ask: The same member was invited again two months later. Is that one invitation or two in your query?
- when: current region, latest region, max(valid_from) → ask: A sender moved region after sending. Which region should their August invitation count for?
- when: < interval, less than 14 → ask: An acceptance exactly 14 days after the send: does your comparison count it?
- when: avg, average → ask: Is the regional rate the average of each sender's rate, or the ratio of the totals? Which one does the team want?

**Evaluation Criteria.** Withdrawn outcomes removed before counting; the 14-day window inclusive and measured from the first send; months of the first send in UTC; (Hard+) resends collapsed by a gap rule into one invitation with the latest send's outcome, a later invitation beyond the limit counted separately, and the floor applied after withdrawals; (Very Hard) the region as of the first send; correct rounding and deterministic order; output stays aggregate; can discuss incomplete windows, small groups and incremental recomputation.

## LNK-L1-02: Company page follower growth per week, with quick refollows collapsed

| | |
|---|---|
| **Template ID** | LNK-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / LEAD and LAG pairing, a calendar spine with generate_series, end-of-window filters |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, analytics-engineer, senior-data-engineer, data-architect |
| **Generator** | LNK-L1-02.mjs |

**Business Scenario.** Company page admins on a professional network see how many followers their page gained each week. Members sometimes unfollow a page and follow it again a few days later (a mis-tap, or a cleanup of their feed), and the admins have said those round trips make the weekly numbers look noisy. The product rule for this report (this exercise's rule; check current docs): a quick round trip is not growth or loss, and small pages are left out of this report.

**Problem Statement.** Write one PostgreSQL query that returns `page_id, week_start, follows, unfollows, net_new` for the {{weeks}} weeks starting Monday `{{first_week}}` (`week_start` is the Monday of each week, a `date`; weeks run Monday 00:00 to Sunday 23:59:59 UTC). Count `follow` and `unfollow` events per page and week, and `net_new = follows - unfollows`. An `unfollow` followed by the same member's next event on the same page being a `follow` no more than 7 days later (exactly 7 days included) is a quick round trip: drop both events. Report every week of the window for each reported page, with zeros where nothing counted. Report only pages whose follower count at the end of the window — `followers_at_start` plus all follows minus all unfollows in the log — is at least {{min_followers}}. Order by `page_id, week_start`. {{dup_rule}}

**Constraints.** One SQL statement (CTEs allowed). `follow_events` has {{event_rows}} rows, all inside the window; for each member and page the events alternate between follow and unfollow (after duplicates are removed). `event_id` is not in time order.

**Assumptions.** Pages, members, the floor of {{min_followers}} followers and the 7-day rule are hypothetical. The report is per page and never lists who followed. `followers_at_start` is the count just before `{{first_week}}`.

**Clarifications.**
- Q: A round trip that starts on a Sunday and ends on Monday — which week loses a follower? | A: Neither. Both events are dropped, wherever they fall.
- Q: What about a follow followed by a quick unfollow? | A: That is a real follow and a real unfollow; both count. Only unfollow-then-refollow is collapsed.
- Q: Does collapsing change the floor? | A: No. A round trip nets to zero, so the end-of-window count is the same with or without it.
- Q: Should a page with no events in some week still have a row for it? | A: Yes, with zeros, for every week of the window.
- Q: Is the floor checked at the start of the window? | A: No, at the end: `followers_at_start` plus the window's net change.

**Hints.**
1. Use `LEAD(event_type)` and `LEAD(event_at)` over each (page, member) ordered by time to find unfollows that are undone, and `LAG` to find the refollows that undo them.
2. Build the week list with `generate_series` and `CROSS JOIN` it with the eligible pages before the `LEFT JOIN` to events.
3. `DATE_TRUNC('week', event_at)` returns the Monday in PostgreSQL; compare it with the spine as a date.

**Follow-ups.**
1. Admins in Tokyo want their weeks to start on Monday in their own time zone. What changes, and what happens to an event at 23:30 UTC on a Sunday?
2. The log can be delivered late by up to two days. How would you publish this week's number before then, and how would you correct it?
3. The rule changes to collapse round trips within 30 days. Which weeks of last quarter's published report would change, and how do you communicate that?
4. At millions of pages, how would you maintain this report incrementally instead of rescanning the log every day?

**Follow-up rules.**
- when: self join, self-join → ask: How does your join pick the refollow that belongs to an unfollow, rather than a later one?
- when: lead, lag → ask: Your LEAD looks at the next event. What happens when the same member does two round trips in a row?
- when: generate_series, calendar, spine → ask: Where does the list of weeks come from, and would your query still return a week in which no page had any events?
- when: followers_at_start → ask: Do you check the floor against the start or the end of the window, and why does that matter for a page that is shrinking?
- when: distinct → ask: What exactly makes two rows duplicates here, and could DISTINCT ever remove two genuinely different events?

**Evaluation Criteria.** Round trips found by pairing each unfollow with the same member's next event on the page; inclusive 7-day bound (Hard+); both events dropped even across a week boundary; a complete week spine with zeros; the floor applied to the end-of-window count; (Very Hard) duplicate deliveries removed before pairing and repeated cycles handled; Monday weeks in UTC; deterministic order; output is per page, never per member.

## LNK-L1-03: Recruiter message response rate per seat, bulk duplicates collapsed

| | |
|---|---|
| **Template ID** | LNK-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / gaps-and-islands chains, first-event lookups across a group, as-of cutoffs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, analytics-engineer, senior-data-engineer, data-architect |
| **Generator** | LNK-L1-03.mjs |

**Business Scenario.** Recruiters on a professional network message members from a paid seat, and a seat's response rate is shown to the recruiter's admin as a measure of outreach quality. Members can accept, decline or reply; a decline is still an answer, and the product counts it as one (this exercise's rule; check current docs). Bulk sends sometimes reach the same member more than once, and those copies should not make a seat look worse or better.

**Problem Statement.** Write one PostgreSQL query that returns `seat_id, messages, responses_7d, response_rate`, one row per seat with at least one counted message, ordered by `seat_id`. Messages from the same seat to the same member form a duplicate group when each is sent no more than {{dup_hours}} hours after the previous one (exactly {{dup_hours}} hours included); the group counts as one message, kept at its earliest `sent_at`. A **response** is an `accepted`, `declined` or `replied` event (`delivered` and `read` are not). `responses_7d` counts kept messages whose first response came no more than 7 days after the kept `sent_at` (exactly 7 days counts); `response_rate` is `responses_7d / messages` rounded to 4 decimal places. {{copy_rule}} {{asof_rule}} {{chain_rule}}

**Constraints.** One SQL statement (CTEs allowed). `messages` has {{message_rows}} rows; `message_events` holds the delivery, read and response events. Ids are not in time order. Message content is not in the data and is not needed.

**Assumptions.** Seats, members, the {{dup_hours}}-hour duplicate limit and every number are hypothetical. Timestamps are UTC. The rate is about a seat's outreach and is shown only in aggregate.

**Clarifications.**
- Q: Is a decline a response? | A: Yes. Accepting, declining and replying are all responses; a read is not.
- Q: Three copies arrive 5, 5 and 5 hours apart with a 6-hour limit. One group or two? | A: One: each copy is within the limit of the previous one.
- Q: Which copy's time starts the 7 days? | A: The kept (earliest) copy's `sent_at`.
- Q: Is a seat with messages but no responses reported? | A: Yes, with `responses_7d = 0`.
- Q: Should the output include members or messages? | A: No. One row per seat.

**Hints.**
1. Number duplicate groups with `LAG(sent_at)` per (seat, member) and a running `SUM` of "more than the limit after the previous message".
2. Map every message to its group, then take `MIN(event_at)` of response events across all of the group's messages.
3. Apply the as-of cutoff to the kept message, not to each copy.

**Follow-ups.**
1. A member blocks the recruiter instead of answering. Should that count as a response, and how would you add it without breaking last quarter's numbers?
2. The admin wants the rate per recruiter, and seats are reassigned when a recruiter leaves. What does the data need, and which recruiter gets a message sent before the transfer?
3. Members in some regions respond on weekends only. Is a 7-day window fair across regions, and how would you check?
4. At hundreds of millions of messages a month, how would you compute this daily without rescanning, given a response can arrive up to 7 days later?

**Follow-up rules.**
- when: distinct member_id, count(distinct → ask: A seat messaged the same member twice, a month apart. How many messages does your query count, and how many should it?
- when: first_value, min(sent_at) → ask: How do you decide which copies belong to the same group when they are more than the limit apart from the first but close to each other?
- when: read → ask: A member read the message within an hour and never answered. Is that a response in your query?
- when: message_id join, join on message_id → ask: The member replied to the second copy, not the first. Does your join still credit the kept message?
- when: now(), current_timestamp → ask: Your cutoff uses the clock. What does the same query return if it is rerun next week, and should it?

**Evaluation Criteria.** Duplicate groups by a chained gap rule (inclusive) with the earliest copy kept; declines counted and reads not; the first response across all copies, timed from the kept message, inclusive 7-day bound (Hard+); the as-of cutoff on the kept message, from the stated as-of time rather than the clock (Hard+); (Very Hard) three-copy chains and multiple response events; correct rounding; deterministic order; per-seat output only.

## LNK-L1-04: Skills coverage — how many members list every skill a job requires

| | |
|---|---|
| **Template ID** | LNK-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Data structures / inverted index as bitsets, set intersection, privacy thresholds on aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | LNK-L1-04.mjs |

**Business Scenario.** When a company drafts a job posting on a professional network, it sees an estimate of how many members list all of the skills the posting requires, so it can tell whether the requirements are realistic. The estimate is an aggregate count: it never identifies a member, and members who chose not to be included in such insights are left out (this exercise's rule; check current docs). The team needs to compute it for a batch of draft postings against a snapshot of profiles.

**Problem Statement.** Implement `skills_coverage(profiles, jobs, opted_out=None, min_count=None)`. `profiles[i]` is the list of skills member `i` lists on their profile (a skill may appear more than once); `jobs[j]` is the list of skills job `j` requires. Return a list with one integer per job, in job order: the number of members whose profile lists **every** required skill. A job with no required skills is matched by every counted member. {{norm_rule}} {{min_rule}}

**Constraints.** Up to 25 000 members with 3–14 skills each and 1 200 jobs with 1–4 required skills in the timing check, drawn from a vocabulary of a few hundred skills, some far more common than others. Checking every member against every job is tens of millions of subset tests and too slow; aim for work proportional to the skills involved, not to members × jobs.

**Assumptions.** Profiles, skills and jobs are hypothetical. Skills come only from what members chose to list on their profile; nothing is inferred. The result is used only as a count.

**Clarifications.**
- Q: Does a member need all required skills or any of them? | A: All of them.
- Q: A job lists the same skill twice. Does a member need it twice? | A: No. Requirements are a set; a repeated skill is one requirement.
- Q: Is a member with no skills counted for a job with no requirements? | A: Yes. An empty requirement set is met by every counted member.
- Q: Can I return the matching members as well? | A: No. Return counts only.
- Q: Are skill names ever misspelt or synonyms? | A: Not in this exercise; mapping synonyms is a follow-up.

**Hints.**
1. Build an inverted index once: for each skill, the members who list it.
2. Store each skill's members as a bitset (a Python `int` with bit `i` set for member `i`); a job's count is the popcount of the AND of its skills' bitsets.
3. Build each bitset with a `bytearray` and `int.from_bytes`, or AND the rarest skill first and stop as soon as the result is zero.

**Follow-ups.**
1. The vocabulary grows to 40 000 skills and the members to 900 million. How much memory do dense bitsets need, and what would you use instead?
2. Hiring teams want "members with at least 3 of these 5 skills". How does your structure change?
3. Skills have synonyms and a hierarchy ("PostgreSQL" implies "SQL"). Where do you apply the mapping, and how do you keep counts comparable when the taxonomy changes?
4. Two drafts that differ by one skill could reveal something about a small set of members by subtraction. How would you guard against that beyond a per-query minimum?

**Follow-up rules.**
- when: issubset, all(, for member in → ask: How many subset checks does that do for 1 200 jobs and 25 000 members, and how long will it take in CPython?
- when: bitset, bitmap, bit_count → ask: How do you build each skill's bitset without an O(members) operation for every single member you add?
- when: intersection, & → ask: In which order do you intersect a job's skills, and when can you stop early?
- when: lower(), strip() → ask: Do you normalise the job's skills the same way as the profiles' skills, and where would a mismatch show up?
- when: opted_out → ask: Do opted-out members ever enter your index, or do you subtract them at the end? Which is safer?

**Evaluation Criteria.** Correct "all skills" semantics with duplicates collapsed on both sides; the empty job and the empty profile right; an inverted index built once, with bitset or set intersection per job (not a scan of members per job); at Hard, consistent normalisation and opted-out members excluded before counting; at Very Hard, the minimum applied to the final count with the `-1` sentinel; can discuss memory at scale, threshold queries and differencing risks.

## LNK-L1-05: Salary insight medians that appear only once k reports exist

| | |
|---|---|
| **Template ID** | LNK-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Heaps / running median with two heaps, lazy deletion, minimum-group-size thresholds |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | LNK-L1-05.mjs |

**Business Scenario.** A professional network shows salary insights for a job title in a city, built from salaries members report. A median is shown only once a group has at least `k` reports, so that no single member's salary can be read off the page (this exercise's rule; check current docs). Reports stream in, and the insight must be current after every one.

**Problem Statement.** Implement `salary_medians(events, k, lo=None, hi=None)`. Each event is `("add", title, city, salary)` with an integer salary, or `("remove", i)`. Reports are grouped by (title, city). After each event, return the median salary of the group the event affects if that group has at least `k` reports, otherwise `None`. For an odd count the median is the middle salary; for an even count it is the mean of the two middle salaries rounded half up to a whole number (`(a + b + 1) // 2`). Return one value per event, in order. {{key_rule}} {{band_rule}} {{remove_rule}}

**Constraints.** Up to 120 000 events in the timing check, most of them in one large group; `k ≥ 1`. Sorting a group after every report is quadratic in the group size and too slow; aim for O(log n) per event.

**Assumptions.** Titles, cities, salaries, `k` and the band are hypothetical. Salaries are positive integers in one currency per year. The output is a group statistic only; individual reports are never returned.

**Clarifications.**
- Q: What does an event return when its group is below k? | A: `None`, even if other groups have medians.
- Q: How is an even count's median rounded? | A: The mean of the two middle salaries, rounded half up: 100 000 and 100 001 give 100 001.
- Q: Are equal salaries separate reports? | A: Yes. Two members reporting the same salary are two reports.
- Q: Is "Data Engineer" in Austin the same group as "Data Engineer" in Berlin? | A: No. A group is a (title, city) pair.

**Hints.**
1. Keep two heaps per group: a max-heap of the lower half and a min-heap of the upper half, with the lower half at most one larger.
2. After every insert, move one element across if the sizes are out of balance; the median is then read from the tops.
3. For removals, mark the report as gone and keep live counts per heap; discard gone elements only when they reach a top (lazy deletion). Store `(salary, index)` pairs so equal salaries stay distinct.

**Follow-ups.**
1. The page also shows the 25th and 75th percentiles. How do you extend your structure, and what does each event cost now?
2. There are 2 million (title, city) groups, most with a handful of reports. What is the memory cost of two heaps per group, and when would you not keep them in memory?
3. A median of exactly `k` reports can still reveal something if one report is added or removed between two page views. How would you limit that?
4. Reports are stored in a warehouse and the insight is recomputed nightly instead. Which SQL would you write, and when is a streaming structure worth it?

**Follow-up rules.**
- when: sorted(, sort(, .sort → ask: How many times does your code sort a 100 000-report group across 120 000 events?
- when: insort, bisect → ask: bisect finds the position in O(log n). What does inserting into the middle of a Python list cost, and how does that grow?
- when: heapq, two heaps → ask: Python's heapq is a min-heap. How do you keep the lower half, and how do you break ties between equal salaries?
- when: remove(, heapify → ask: Removing from the middle of a heap and re-heapifying is O(n). How would you avoid it?
- when: lazy, tombstone → ask: Your heaps contain removed reports. Which counts do you use to balance them, and when are the removed ones actually dropped?

**Evaluation Criteria.** Correct grouping, `None` below `k`, the even-count rounding rule; two heaps kept balanced with O(log n) per event; at Hard, consistent key normalisation and band rejection that leaves the group unchanged; at Very Hard, removals with lazy deletion, live counts used for balancing, and no-op removals of rejected or already removed reports; can discuss percentiles, memory at many groups, and differencing risks.
