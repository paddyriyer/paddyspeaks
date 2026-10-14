# LinkedIn · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a professional
network: member profiles and skills, connections, jobs, recruiter search and
messaging, creator analytics, learning and company pages. Every workload, number
and schema is hypothetical, and nothing here describes how any company's systems
are built. Member data is personal: every output stays within the member's own
view or is an aggregate, and nothing infers a trait a member did not choose to
share. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## LNK-L2-01: Learning path — the fewest courses that teach a target skill set

| | |
|---|---|
| **Template ID** | LNK-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / set cover over skill bitmasks, lexicographic cost |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | LNK-L2-01.mjs |

**Business Scenario.** A member opens the learning catalogue and names the skills they want for their next role, say SQL, Airflow, Kafka and data modeling. Each course in the catalogue teaches a few skills and takes a known number of minutes. Members finish short plans and abandon long ones, so the product wants to suggest the plan with the fewest courses, and among plans with the same number of courses, the one with the fewest minutes. The member's goal is the input; nothing is inferred about the member beyond what they typed and what their own profile lists.

**Problem Statement.** Implement `learning_path(target, courses, known=None)`. `target` is a list of skill names. `courses` is a list of `(course_id, minutes, skills)`, where `skills` lists the skills the course teaches, some of which may be outside the target. A plan is a set of courses that together teach every target skill not in `known`. Return `(number_of_courses, total_minutes)` for the plan with the fewest courses, and the fewest total minutes among those. Return `(0, 0)` when nothing is left to learn. {{coverage_rule}} {{known_rule}}

**Constraints.** Up to 16 skills left to learn and 120 courses. Minutes are positive integers below 1 000. A course teaches at most 8 skills. Something close to O(2ᵏ · n) for k skills and n courses is expected. Trying every combination of courses is not fast enough: the best plan can need six or more courses.

**Assumptions.** The catalogue, its skills and the minutes are hypothetical. Skill names are already standardised, so two spellings of one skill do not occur. A course teaches every skill it lists to the level the member asked for, and the member takes courses in any order.

**Clarifications.**
- Q: Do I return the course ids? | A: No. Return the pair `(number_of_courses, total_minutes)`. It is unique even when several plans tie.
- Q: Does a course that teaches skills outside the target cost anything extra? | A: Only its minutes. The extra skills neither help nor hurt.
- Q: Is a plan of two long courses better than a plan of three short ones? | A: Yes. Fewer courses first, then fewer minutes.
- Q: Can I take the same course twice? | A: Taking it twice never helps, so a plan is a set of courses.
- Q: Can two courses have the same id? | A: No. Ids are unique, but two different courses can teach exactly the same skills.

**Hints.**
1. With 16 skills there are 65 536 subsets of skills. Number the skills that are still needed and turn each course into a bitmask.
2. Let `best[mask]` be the cheapest way to teach at least the skills in `mask`. Going from `mask` through a course reaches `mask | course_mask`.
3. Many courses have the same mask; keep only the shortest one per mask. Compare `(courses, minutes)` as a tuple, or pack the pair into one integer.

**Follow-ups.**
1. Members want to see the plan, not only its size. How do you return the courses, and which plan do you show when several tie?
2. Some courses require another course first. How does that change the problem, and does the subset DP still work?
3. The member also has a weekly time budget, and wants the fewest weeks rather than the fewest courses. What is the new objective, and what is the new state?
4. A member asks for 40 skills, and 2⁴⁰ states are out of reach. What would you do, and how would you tell how far your answer is from the best plan?

**Follow-up rules.**
- when: greedy, most skills first, largest course → ask: Give a target where taking the course that teaches the most missing skills first leads to three courses when two would do.
- when: itertools.combinations, combinations, brute force → ask: How many combinations of six courses are there in a catalogue of 80, and how long would your loop take in Python?
- when: lru_cache, memo, recursion → ask: How many states does your memo hold for 16 skills, and how many transitions does each state try? Write the total.
- when: float('inf'), math.inf → ask: Your sentinel is a float next to integer minutes. Where could a float reach the returned pair, and how would you keep it exact?
- when: frozenset, set of skills → ask: Hashing a frozenset per state works. What does a bitmask give you instead, and how much faster is it?

**Evaluation Criteria.** Correct `(courses, minutes)` with the fewest courses first; `None` when a needed skill is taught nowhere and `(0, 0)` when nothing is left; known skills and duplicates removed before planning; skills outside the target ignored; a subset DP over the needed skills with one state per mask; duplicate course masks collapsed; integer arithmetic; a clear complexity argument; sensible answers on prerequisites, time budgets and large targets.

## LNK-L2-02: Former colleagues — overlapping stints at the same company

| | |
|---|---|
| **Template ID** | LNK-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Intervals / overlap of at least D days, interval shrinking, sorting and binary search |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | LNK-L2-02.mjs |

**Business Scenario.** A member's profile lists positions: a company, a start date and an end date, or no end date for a role they still hold. A page that only the member sees tells them, for each company on their profile, how many other members worked there at the same time as them for at least {{min_days}} days. Short overlaps, such as a week's handover, are not counted. The numbers are computed offline for every member, so they have to be computed for millions of positions in one pass.

**Problem Statement.** Implement `former_colleagues(positions, min_days, today, opted_out=None)`. `positions` is a list of `(member, company, start_day, end_day)`. Days are integers and both ends are inclusive, so a position from day 10 to day 10 lasts one day. A member's positions at one company form one stint, from the earliest start to the latest end. Two stints at the same company, held by different members, overlap by `min(end) − max(start) + 1` days when that is positive. Return a dict `{member: {company: n}}` with an entry for every member and every company they held a position at, where `n` is the number of other members whose stint at that company overlapped theirs by at least `min_days` days (0 if none). An empty input returns `{}`. {{position_rule}} {{privacy_rule}}

**Constraints.** Up to 200 000 positions. Almost half of them can be at one large company, and many stints there last years. `min_days` is at least 1. Something close to O(n log n) is expected. Comparing every pair of stints at a company, even after sorting by start, is too slow when thousands of stints are open at the same time.

**Assumptions.** Members, companies and dates are hypothetical. Positions are already linked to one company page each, so renamed or merged companies are not a concern here. Every position starts on or before `today`, and every ended position ends on or before it. Only positions the member chose to show on their profile are in the input.

**Clarifications.**
- Q: Is the overlap counted in whole days, both ends included? | A: Yes. Two positions from day 1 to day 90 overlap by 90 days.
- Q: A colleague held two positions at the company during my stint. Do they count twice? | A: No. Their positions form one stint, and they count once.
- Q: Could two short positions overlap enough together when neither does alone? | A: Yes. That is why positions are merged into stints first.
- Q: Does a member count themself? | A: Never. Only other members are counted.
- Q: What does `today` do? | A: A position with no end date runs until `today`, inclusive.

**Hints.**
1. Overlap ≥ D means `min(e₁, e₂) − max(s₁, s₂) ≥ D − 1`. Write that as four inequalities. Which two hold for any stint of at least D days?
2. A stint shorter than D days can never qualify. For the others, shrink `[s, e]` to `[s, e − D + 1]`. When do two shrunken intervals intersect?
3. The intervals that intersect `[a, b]` are those that start at or before `b`, minus those that end before `a`. Two sorted arrays and `bisect` give both counts.

**Follow-ups.**
1. The page should show the colleagues' names, not only the count. Whose visibility settings decide which names may appear, and what do you do for a colleague who hides their connections or their positions?
2. A member who left a company and came back has two stints there. A colleague who overlapped both should still count once. How does your counting change?
3. Positions arrive all day as members edit their profiles. How would you keep the counts fresh without recomputing everything?
4. Positions are given in months, not days, on most profiles. How do you treat "March 2021 to May 2021", and how do you explain the rule to the member?

**Follow-up rules.**
- when: nested loop, every pair, all pairs, for j in → ask: The largest company has 30 000 stints that last years. How many pairs is that, and how long would it run?
- when: sort by start, sweep, break when → ask: Your sweep stops at the first later start. How many open stints does each step still visit when stints last five years?
- when: fenwick, binary indexed tree, segment tree → ask: Is a tree needed here once every stint is shrunk by D − 1 days, or do two sorted arrays do? Explain which counting problem is left.
- when: group by company, dict of lists, defaultdict → ask: How do you merge one member's promotions at a company before counting, and what goes wrong if you do not?
- when: datetime, timedelta, date → ask: Profiles give months, not days. Which day would you pick for "started in March", and does that choice change who counts?

**Evaluation Criteria.** Inclusive day arithmetic with the exact `min_days` boundary; positions merged into one stint per member and company before counting; current positions running to `today`; opted-out members neither counted nor listed; every member and company present with 0 where nothing qualifies; stints shorter than `min_days` handled; an O(n log n) count by shrinking stints and binary search (or an equivalent sweep with a Fenwick tree), justified; output that is the member's own view only; credible answers on names and visibility, returning employees and freshness.

## LNK-L2-03: Debug the creator post analytics report

| | |
|---|---|
| **Template ID** | LNK-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / reshare attribution, edited posts, deletion, time zones, distinct counts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | LNK-L2-03.mjs |

**Business Scenario.** Members who post regularly see a daily report on their own posts: views, unique viewers and reactions per post and day. The report is shown only to the creator and holds counts, never a list of viewers. Creators have raised several complaints about one job. An edited post shows up as two posts. Views from members who reshared a post disappear, while a creator who reshared someone else's post sees that post in their report. A member who deleted their account still adds to view counts. Creators in Asia and the Americas see late-evening views on the wrong day. A reader who comes back the next day is never counted as a unique viewer again. The function below is the suspect.

**Problem Statement.** Fix `creator_report(creator, offset_min, posts, events, deleted)` so that it meets this specification. {{replay_rule}}
1. **`posts`** maps a post id to `{"author", "reshare_of"}`. `reshare_of` is `None` for an original post. For a reshare it names the original post, which is always an original and always in `posts`.
2. **`events`** are `{"type": "view" | "react", "post", "member", "ts"}`, with `ts` in Unix seconds (UTC). An event's post id may carry an edit suffix, as in `p-1041#v2`. An edit does not change the post's identity, so the event belongs to `p-1041`. Events for a post id that is not in `posts` are ignored.
3. **Attribution.** An event on a reshare is credited to the original post. Only events credited to a post whose author is `creator` are reported.
4. **Exclusions.** Events from members in `deleted` (deleted accounts) are dropped completely: they add to no count. The creator's own events are dropped too.
5. **Day.** Each event is counted on the creator's local date: `(ts + offset_min · 60) // 86400` days after 1970-01-01, written as `YYYY-MM-DD`. `offset_min` is the creator's offset from UTC in minutes, for example 330 for UTC+05:30 and −300 for UTC−05:00.
6. **Output.** One row `[day, post, views, unique_viewers, reactions]` for every local day and credited post with at least one counted event, sorted by day and then post id. `views` counts view events, `unique_viewers` counts distinct members who viewed that post on that local day, and `reactions` counts react events.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events, processed in linear time.

**Assumptions.** Event shapes, ids and offsets are hypothetical and simplified. Each event is delivered once. The creator's offset is fixed for the whole report; daylight-saving changes are out of scope here.

**Clarifications.**
- Q: Do views of a reshare count as views of the original post? | A: Yes. They are credited to the original, and its author sees them.
- Q: I reshared someone else's post. Do views of my reshare appear in my report? | A: No. They are credited to the original post, which is not yours.
- Q: Should a deleted account's views count in `views` but not in `unique_viewers`? | A: No. Deletion is honoured everywhere: the events add to no count.
- Q: Is a viewer unique per post, or per post and day? | A: Per post and local day. A reader who comes back the next day is unique on both days.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Run one view of `p-1#v2` and one of `p-1` through the code. How many rows come out?
2. Whose authorship does the code check for an event on a reshare: the resharer's or the original author's?
3. Take a creator at UTC+05:30 and a view at 20:00 UTC. What local date and time is that, and what does the code compute?
4. Follow a deleted member's view through every counter, not only one.

**Follow-ups.**
1. The report runs daily for every creator. How would you compute it for all creators in one pass, and what is the key you aggregate on?
2. A member deletes their account a month after viewing a post. Which already published daily numbers change, and how do you recompute them?
3. A creator moves from UTC−08:00 to UTC+01:00. Do past days move, and what would the creator expect to see?
4. Unique viewers per week cannot be summed from unique viewers per day. How would you report weekly reach without keeping every viewer id for ever?

**Follow-up rules.**
- when: rstrip, regex, re.sub, split("#") → ask: Post ids are opaque strings. What would your suffix handling do to an id that itself contains the characters you strip?
- when: pytz, zoneinfo, tz database → ask: The report takes a fixed offset. What changes if the creator's time zone has daylight saving time, and which offset applies to an event?
- when: set of viewers, distinct, len(set → ask: Your set holds viewer ids for each post and day. How large does it grow for a post with millions of views, and what would you use at that scale?
- when: deleted, deletion, gdpr, right to erasure → ask: The deletion arrives after yesterday's report was published. What do you recompute, and how do you prove the member's events no longer count?
- when: author check, posts[original], reshare_of → ask: Could a reshare of a reshare reach this function? What would you change if `reshare_of` could name another reshare?

**Evaluation Criteria.** Finds and explains every bug with the creator's symptom; edit suffix stripped before keying rows; reshares credited to the original and authorship checked on the original; deleted accounts excluded from every count; the offset added, not subtracted, with correct dates for negative offsets; unique viewers per post and local day; the creator's own events excluded; minimal, linear fixes; a regression test per bug.

## LNK-L2-04: Job alerts — matching new postings to saved searches

| | |
|---|---|
| **Template ID** | LNK-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / stream matching, frequency caps, delivery, measuring outcomes |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "saved_searches": {"2": ["8 million", "20 million"], "3": ["90 million", "200 million"]},
  "new_postings": {"2": ["150,000 a day", "400,000 a day"], "3": ["2 million a day", "5 million a day"]},
  "cap": ["one email a day", "three alerts a week", "one push notification a day and one email digest a week"],
  "attribution_window": ["7 days", "14 days"]
}
```

**Business Scenario.** Members save job searches: keywords, a title, a location or remote, seniority, a company list, and a minimum salary when the posting states one. When a new posting matches a saved search, the member can be alerted by email or push notification. There are about {{saved_searches}} saved searches and {{new_postings}} new postings. Members who receive too many alerts unsubscribe, so each member gets at most {{cap}}, and alerts must say something useful when they do arrive. The jobs team also wants to know whether alerts lead to applications, counting an application within {{attribution_window}} of the alert.

**Problem Statement.** Design the pipeline from a posting being published to an alert being delivered, and the measurement that follows. Cover how saved searches are stored and indexed so a posting finds its matching searches without testing all of them; how matches are collected per member and ranked with a scoring function you are given; how frequency caps, quiet hours and the member's notification settings are applied; how a posting that closes or is edited before the alert goes out is handled; deduplication, so a member never hears about the same posting twice; and how you measure applications that follow alerts without counting applications that would have happened anyway.

**Constraints.** A posting closed or removed before delivery must not be alerted. A member's notification settings and unsubscribes apply at send time, not at match time. Alerts must not reveal anything the poster restricted. Retries anywhere in the pipeline must not send an alert twice. Measurement uses aggregates; no report lists individual members' applications.

**Assumptions.** All volumes, caps and windows are hypothetical. The relevance scoring function is given to you as a black box that takes a posting and a saved search and returns a score; you do not design it. Postings are already normalised to a standard title, location and seniority.

**Clarifications.**
- Q: Must the alert go out the moment a posting is published? | A: Freshness matters, but members also chose a cadence: some want daily digests, others instant pushes. Design for both.
- Q: Can one posting match thousands of searches? | A: Yes. A broad title in a large city can match hundreds of thousands of searches. That is the main load problem.
- Q: What if a member has five saved searches that match the same posting? | A: They hear about it once.
- Q: How do we know an alert caused an application? | A: You do not, from correlation alone. Explain what you would compare against.
- Q: Who sees the measurement? | A: The jobs product team, as aggregates by cadence, channel and search type.

**Hints.**
1. Invert the problem: index saved searches by their most selective required field (title, location, company), so a posting looks up a small candidate set and only those are fully checked.
2. Separate matching from delivery. Matches go into a per-member queue; a scheduler applies caps, quiet hours and settings when it is time to send.
3. Hold out a small random share of matches from being sent, and compare their application rate with the alerted group's.

**Follow-ups.**
1. A popular title in a large city matches a quarter of all saved searches. Walk through what your matcher and your queues do with that posting.
2. A posting is edited to raise the salary after matching but before the digest is sent. Which searches does it now match, and what does the digest show?
3. How do you make "never alert the same posting twice" hold across retries, digests and push notifications?
4. The alerted group applies at 3 times the rate of non-alerted members. Why is that not the effect of alerts, and what number would you report instead?
5. At {{saved_searches}} saved searches, half belong to members who have not opened an alert in a year. What would you do, and what would you measure first?

**Follow-up rules.**
- when: for each saved search, scan all searches, every search → ask: How many comparisons is that per posting at {{saved_searches}} searches, and what index would cut it?
- when: inverted index, index by title, index by location → ask: Which field do you index a search under when it has a title, a location and a salary floor, and what is still checked after the lookup?
- when: kafka, queue, topic → ask: What is your partition key for the per-member alert queue, and why does it make the frequency cap easy to enforce?
- when: conversion rate, application rate, click-through → ask: Members who save searches are already looking hard. How do you separate the alert's effect from that, and what is your control group?
- when: dedupe, idempotency, already sent → ask: Where is the record of "already alerted" stored, keyed by what, and for how long?

**Production Reality Check.**
- A large employer bulk-publishes 30 000 near-identical postings in ten minutes, and each matches a large share of the {{saved_searches}} saved searches.
- A delivery worker crashes after sending a batch of emails but before recording them as sent, and restarts from its last checkpoint.
- A posting is closed ten minutes after matching, but it is already queued in thousands of members' pending alerts, and each of those members gets at most {{cap}}.

**Evaluation Criteria.** Saved searches indexed so a posting finds candidates without a full scan; matching separated from delivery with per-member queues; caps, quiet hours, settings and unsubscribes enforced at send time; closed or edited postings revalidated before sending; idempotent delivery keyed by member and posting; a holdout or randomised design for measuring applications, reported as aggregates; a plan for bulk postings and hot matches; a plan for each incident.

## LNK-L2-05: Learning progress from many devices

| | |
|---|---|
| **Template ID** | LNK-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / offline sync, merging progress, completions, employer reporting with privacy limits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "learners": {"2": ["3 million", "8 million"], "3": ["40 million", "90 million"]},
  "devices": ["a phone and a laptop", "a phone, a tablet and a laptop, often offline on the phone"],
  "completion_rule": ["watched at least 90% of every video and passed the quiz", "watched every video to the end and passed the final assessment"],
  "employer_seats": ["2,000", "50,000"]
}
```

**Business Scenario.** Learners watch course videos on {{devices}}. The player reports progress as it plays, and the phone keeps watching offline and uploads later. A course is complete when the learner has {{completion_rule}}, and a completion earns a certificate the learner can add to their profile. There are about {{learners}} active learners. Some learn through an employer licence with up to {{employer_seats}} seats, and the employer's learning admin sees progress reports for learning done under that licence.

**Problem Statement.** Design the pipeline from the player's progress events to three outputs: the learner's own "continue where you left off" and progress view, completions and certificates, and the employer admin's reports. Cover the event format and what makes an upload safe to retry; how progress from several devices, uploaded late and out of order, is merged into one state per learner and video; when a course becomes complete and how a certificate is issued exactly once; what the employer admin may see and what they may not; and how a learner's deletion request or the end of an employer licence is honoured in every output.

**Constraints.** Offline uploads can be days late. Progress must never go backwards because an old device uploads late. A certificate, once issued, is not revoked by a late or duplicate event. Employer reports cover only learning done under that employer's licence, and only what the licence terms allow. A deleted learner disappears from every report.

**Assumptions.** All volumes, rules and terms are hypothetical; check current product documentation for real rules. Each device has a stable id and a clock that can be wrong by minutes or hours. The player can report the set of seconds watched, not just a position.

**Clarifications.**
- Q: Is progress the furthest position reached? | A: No. A learner who skips to the end has not watched the video. Progress is the share of the video actually watched, across all devices.
- Q: Which device's position is used to resume? | A: The most recent session, by the time it happened, not the time it uploaded.
- Q: Can the employer admin see courses the learner took on their own, outside the licence? | A: No. Only learning under the licence.
- Q: What does the admin see after a learner leaves the employer? | A: Aggregates for the licence period may remain; the learner's identity in reports follows the licence terms and deletion requests.
- Q: Do quiz answers go to the employer? | A: Only pass or fail and the date, if the licence terms say so.

**Hints.**
1. Make progress a merge of watched intervals per learner and video: a union is commutative and idempotent, so late and duplicate uploads are harmless.
2. Keep "resume position" separate from "watched": the first is the latest session by event time, the second is the union of intervals.
3. Tag every event with the licence it happened under at ingestion, so employer reports never have to guess.

**Follow-ups.**
1. The phone uploads three days of offline viewing after the laptop has already moved on. Walk through what the learner sees on each device.
2. A completion is computed, the certificate is issued, and then a correction shows that one video was below the threshold. What do you do, and what do you tell the learner?
3. An employer wants a report of who has not started a required course. What can that report show, and what must it never show?
4. A learner asks for their data to be deleted. Which stores, aggregates and certificates change, and how do you show it was done?
5. At {{learners}} learners, the union of watched intervals per video is too large to rewrite on every event. How do you store and compact it?

**Follow-up rules.**
- when: last write wins, latest position, max position → ask: An old phone uploads a position from three days ago. What does last-write-wins by upload time do to resume, and what does max-position do to completion?
- when: crdt, union of intervals, interval merge → ask: Your merge is idempotent. Is resume position also safe to merge in any order, and which timestamp decides it?
- when: device clock, client timestamp, clock skew → ask: A device clock is two hours fast. Which outputs does that affect, and how do you bound the damage?
- when: employer, admin, licence, license → ask: A learner took a personal-interest course on the same account. Which field keeps it out of the employer's report, and where is it set?
- when: certificate, exactly once, idempotent → ask: Two completion jobs run at once for the same learner after a retry. What stops two certificates?

**Production Reality Check.**
- A mobile release holds offline progress for a week. After the next update, catch-up uploads from a large share of the {{learners}} learners arrive within one day, most of them out of order.
- An employer licence with {{employer_seats}} seats ends at midnight, and the admin exports a report at 00:05.
- A bug double-counted watched seconds for one day, and 4% of learners were marked complete for courses they had not finished.

**Evaluation Criteria.** Idempotent, retry-safe uploads with event and upload times kept separately; watched progress as a union of intervals merged in any order; resume position chosen by event time; completion evaluated from merged state with certificates issued exactly once; licence context attached at ingestion and employer reports limited to it and its terms; deletion and licence end honoured in every output; a plan for compacting interval state at scale; a plan for each incident.
