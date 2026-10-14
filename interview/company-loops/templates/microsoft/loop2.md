# Microsoft · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a company that
runs a public cloud, a productivity and collaboration suite with an AI
assistant, a desktop operating system and a gaming network. Every workload,
number and schema is hypothetical, and nothing here describes how the company's
own systems are built. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## MSF-L2-01: Signature scan — every occurrence of many byte patterns in one pass

| | |
|---|---|
| **Template ID** | MSF-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Strings / multi-pattern matching (Aho–Corasick), overlapping and nested matches, streamed chunks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | MSF-L2-01.mjs |

**Business Scenario.** Desktop operating systems ship with built-in anti-malware protection, and one of the oldest techniques it can use is to look for known byte sequences, called signatures, inside files. This exercise imagines a much simplified signature stage. A signature set of many thousands of entries is updated several times a day. For every file it is given, the stage must report every place where any signature occurs. A later stage, which is not part of this exercise, weighs those occurrences together with other evidence. A missed occurrence is a missed detection, and a slow scan is felt by every user of the machine.

**Problem Statement.** Implement `scan(signatures, chunks)`. `signatures` is a list of `(sig_id, pattern)` pairs, and each `pattern` is a non-empty `bytes`. `chunks` is a list of `bytes`, the file's contents in the order they were read. Return a list of `(offset, sig_id)` for every occurrence of every signature in the whole file, which is the chunks one after another. `offset` is the position of the occurrence's first byte, counted from 0 at the start of the file. Occurrences may overlap, including two occurrences of the same signature. Sort the list by offset, then by `sig_id`. Return an empty list if nothing occurs. {{nesting_rule}} {{chunk_rule}}

**Constraints.** Up to 20 000 signatures of up to 64 bytes each, and files of up to 500 000 bytes in this exercise. Any byte value can appear. Something close to O(n + m + z) is expected for n file bytes, m total signature bytes and z occurrences. Searching the file once per signature is 20 000 passes and is not fast enough. Do not join the chunks into one buffer: a real file can be far larger than memory, so keep only what you need between chunks.

**Assumptions.** The signatures, files and sizes are hypothetical, and real anti-malware engines use far more than exact byte signatures. Signatures are exact bytes with no wildcards. `sig_id` values are unique strings.

**Clarifications.**
- Q: Do overlapping occurrences count separately? | A: Yes. `00 00` occurs twice in `00 00 00`, at offsets 0 and 1.
- Q: Can one signature's bytes appear inside another's, or can two signatures have identical bytes? | A: In general, yes, and each id is reported on its own. Ties at one offset are ordered by `sig_id`.
- Q: What is the offset of an occurrence that starts in one chunk and ends in the next? | A: The position of its first byte in the whole file.
- Q: Does the signature set change during a scan? | A: No. It changes a few times a day, so building an index once per update and then scanning many files with it is the expected shape.
- Q: Can a chunk be empty? | A: Yes. An empty chunk changes nothing.

**Hints.**
1. Put every signature into one trie. Walking the file through the trie finds the signatures that start where the walk started. What should a mismatch do, so that the walk never moves backwards in the file?
2. Give every trie node a failure link to the node for the longest proper suffix of its string that is also in the trie. Compute the links breadth-first, so a node's parent already has its link.
3. One node can complete several signatures: its own, and every signature that is a suffix of its string. Merge outputs along failure links when you build, or keep a link to the nearest node with an output, so you never walk the whole chain on every byte.
4. The automaton's current state is the only thing a scan needs to carry from one chunk to the next.

**Follow-ups.**
1. The signature set is updated several times a day. What do you rebuild, how long does it take for 20 000 signatures, and how does a scan already in progress switch to the new set?
2. Signatures gain wildcards: "any byte here", or "a gap of 0 to 8 bytes". How do you keep a single pass over the file, and what do you verify afterwards?
3. Most files contain no signature at all. How would you make that common case cheaper, and how would you show that your shortcut never misses an occurrence?
4. The scanner runs on millions of machines, and memory per process matters more than build time. How would you lay out the automaton (dicts, a dense 256-wide table, a compressed table), and what does each cost?

**Follow-up rules.**
- when: .find(, str.find, bytes.find, per signature → ask: How many passes over the file is that with 20 000 signatures, and roughly how long does it take on a 500 KB file?
- when: re.finditer, regex, re.compile → ask: Does finditer report two overlapping occurrences, or two signatures at the same offset? What does a 20 000-way alternation cost per byte in a backtracking regex engine?
- when: rolling hash, rabin, by length, hash set → ask: How many distinct signature lengths can there be, how many hash lookups per file byte does that make, and what do you do on a hash collision?
- when: b"".join, join the chunks, concatenate → ask: The next file is 6 GB. What do you keep between chunks instead of the whole file?
- when: failure link, aho, automaton, trie → ask: One signature is a suffix of a longer one. When the scan completes the long one, how do you report the short one too, without walking every failure link on every byte?

**Evaluation Criteria.** Every occurrence reported, overlaps and nested signatures included, with identical patterns reported under each id; offsets counted from the start of the file across chunks; correct ordering and an empty list when nothing matches; one automaton built once, with failure links built breadth-first and outputs merged or linked; state carried between chunks without joining them; a clear O(n + m + z) argument; sensible answers on updates, wildcards, prefilters and memory layout.

## MSF-L2-02: Cheapest storage tier schedule for a blob, with early-deletion minimums

| | |
|---|---|
| **Template ID** | MSF-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / day-by-day states with a capped counter, early-deletion charges, tie-breaking |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |
| **Generator** | MSF-L2-02.mjs |

**Business Scenario.** Cloud object storage offers access tiers for blobs. Hotter tiers cost more to store and less to read. Cooler tiers cost less to store and more to read, and an archive tier is offline: a blob there must be brought back online (rehydrated) before it can be read. Cooler tiers also have a minimum stay: a blob that leaves them early is charged for the remaining days. A storage-cost team wants to judge its automatic lifecycle rules. For a sample of blobs it replays each blob's daily read trace and computes, in hindsight, the cheapest possible tier schedule. That cost is the lower bound every rule is measured against.

**Problem Statement.** Implement `cheapest_tiering(reads, tiers)`. `reads[d]` is the number of reads of the blob on day `d`, for `D = len(reads)` days, and `D ≥ 1`. `tiers` maps a tier name to `{"store", "read", "min_days", "enter", "leave"}`. The rules of this exercise are:
1. On every day the blob is in exactly one tier. On day 0 it is uploaded into any tier, with no fee.
2. A day in tier `t` costs `store + reads[d] × read`. A tier whose `read` is `None` is offline: the blob cannot be in it on a day with `reads[d] > 0`.
3. A move from tier `s` on day `d − 1` to a different tier `t` on day `d` costs `leave` of `s` plus `enter` of `t`, and counts as one tier change.
4. A stay is a run of consecutive days in one tier. When a stay of `k` days in tier `s` ends with `k < min_days` of `s`, it costs an extra `(min_days − k) × store` of `s`, the early-deletion charge. This applies whether the stay ends with a move or with the deletion in rule 5.
5. After the last day the blob is deleted. Rule 4 applies to the final stay, and no `leave` fee is charged.

Return `(total_cost, changes)` for the cheapest schedule. If several schedules cost the same, return the one with the fewest tier changes. {{tier_rule}}

**Constraints.** Up to 3 650 days (ten years) and four tiers in this exercise, with `min_days` up to 180. At least one tier is online, so a schedule always exists. All prices are non-negative integers. Something close to O(D · Σ min_days) is expected. Enumerating tier sequences is Tᴰ. Trying every start day of every stay is O(D² · T²) and is too slow at ten years.

**Assumptions.** All prices, minimums and traces are hypothetical. Prices are already for this blob's size, in integer micro-units per day or per read. Public cloud object stores publish their own tiers, minimum stays and early-deletion rules, and the rules here are this exercise's simplified version: check current docs before using them for anything real. Rehydration is instant in this exercise. Reads are known for the whole trace, because this is a replay.

**Clarifications.**
- Q: Is the upload on day 0 charged an enter fee? | A: No. The blob can start in any tier for free. Only later moves pay `leave` and `enter`.
- Q: Does deleting the blob after the last day pay the `leave` fee? | A: No. It pays only the early-deletion charge of the final stay, if that stay is shorter than its tier's minimum.
- Q: If the blob goes hot → cool → hot → cool, does each cool stay count separately against the minimum? | A: Yes. Each stay is counted from the day the blob enters the tier.
- Q: Can the blob sit in the archive between two days with reads? | A: Yes, if that is cheaper. It pays the archive's `leave` fee, which models rehydration, when it comes back online.
- Q: What if two schedules tie on cost and on changes? | A: The answer is only the pair `(total_cost, changes)`, so it is the same either way.

**Hints.**
1. Write a schedule's cost as a sum over days plus a charge when each stay ends. What do you need to know about the current stay to price its end?
2. Only the number of days in the current tier matters, and only up to that tier's minimum: after `min_days` days the stay owes nothing more. So a state is `(tier, min(days in tier, min_days))`.
3. A move into tier `t` on day `d` only needs, for each other tier, the cheapest way to end a stay there on day `d − 1`, including its early-deletion charge and `leave` fee. Compute that once per tier per day.
4. Compare `(cost, changes)` as a pair, or pack it into one integer such as `cost << 20 | changes`, so a single comparison orders both.

**Follow-ups.**
1. In production the reads are not known in advance. Propose a lifecycle rule, for example "move to cool after N days without a read", and explain how you would use this function to choose N.
2. Millions of blobs follow one rule. How would you evaluate a candidate rule across the fleet without replaying every blob, and what bias could your sample introduce?
3. Rehydration actually takes hours, so a read on day `d` needs the blob online from day `d − 1`. What changes in your programme?
4. Prices change on a known day in the middle of the trace. What changes in your states, and which price should an early-deletion charge use? State the rule you would choose and why.

**Follow-up rules.**
- when: itertools.product, every sequence, all schedules, brute force → ask: How many schedules are there for 3 650 days and four tiers? Estimate how long enumerating them would take.
- when: greedy, cheapest tier each day, cheapest per day → ask: Give a trace where choosing the cheapest tier for each day on its own is not the cheapest schedule. What do the minimum stay and the move fees do to a per-day choice?
- when: lru_cache, memo, recursion → ask: Python's default recursion limit is about 1 000 frames. What happens on a 3 650-day trace, and how would you turn your recursion into a loop?
- when: every start day, segment, each stay → ask: How many (start, end) pairs is that for ten years of days, times how many tier pairs, and how long will it take in Python?
- when: float('inf'), math.inf → ask: Where could a float sneak into your compared or packed costs, and how do you keep the answer an exact integer?

**Evaluation Criteria.** Correct `(cost, changes)` with the fewest changes on a cost tie; early-deletion charges at both moves and the final deletion, with no `leave` fee at deletion and none at an exact-minimum stay; offline tiers excluded on days with reads; free initial placement; a day-by-day programme over `(tier, capped days)` with the move cost computed once per tier per day; integer arithmetic; a clear complexity argument; credible answers on lifecycle rules, fleet evaluation and rehydration delay.

## MSF-L2-03: Debug the meeting attendance report

| | |
|---|---|
| **Template ID** | MSF-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event processing / sessions per device, interval union, time zones, identity keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | MSF-L2-03.mjs |

**Business Scenario.** Organisers of online meetings in a collaboration suite can download an attendance report: one row per attendee with when they first joined, when they last left and how long they were present. Organisers have raised several complaints about one report generator. People who dropped out and rejoined appear to have arrived late. Someone on a laptop and a phone at once shows 90 minutes in a 60-minute meeting. A late-evening meeting shows negative durations. An organiser on the west coast of North America sees join times seven or eight hours ahead of the clock on the wall. All the external guests appear as a single person called "guest". The generator below is the suspect.

**Problem Statement.** Fix `attendance_report(meeting, events)` so that it meets this specification. {{replay_rule}}
1. **Input.** `meeting` is `{"id", "start", "end", "tz_offset_min"}`. `events` is a list of `{"ts", "type", "user", "name", "device"}` in time order. Every `ts` is in Unix seconds (UTC), and `type` is `"join"` or `"leave"`.
2. **Attendee.** An attendee is identified by `user`. A guest has `user` set to `None` and is identified by `"guest:" + name`.
3. **Sessions.** A join opens a session for that attendee on that device. The next leave for the same attendee and device closes it. A leave with no open session is ignored. A device never joins twice without leaving. A session still open when the events end closes at `meeting["end"]`.
4. **Time present.** `seconds` is the total length of the union of the attendee's sessions over all devices. Time on two devices at once counts once, and the gap between leaving and rejoining does not count.
5. **Times shown.** `first_join` is the attendee's earliest join and `last_leave` is the latest end of any of their sessions. Both are shown in the organiser's local time, which is UTC plus `tz_offset_min` minutes, as `"YYYY-MM-DD HH:MM"`, with the seconds dropped.
6. **Output.** `{attendee: {"first_join", "last_leave", "seconds"}}`, with an entry for every attendee who has at least one session.

**Constraints.** Keep the function's shape and output format. Up to 200 000 events in one meeting, processed in O(n log n) time.

**Assumptions.** Event shapes, offsets and volumes are hypothetical and simplified. The organiser's offset is fixed for the whole meeting, so there is no daylight-saving change during it. Each event is delivered once, in time order. Every join is at or after `meeting["start"]`.

**Clarifications.**
- Q: Two guests have the same display name. Are they one attendee? | A: In this exercise, yes. The report has nothing else to tell them apart. A guest and a member with the same name are always different attendees.
- Q: Does the gap between leaving and rejoining count as time present? | A: No. Only time inside a session counts.
- Q: If someone is connected on a laptop and a phone at the same time, is that time counted twice? | A: No. Count the union once.
- Q: How are seconds dropped from the times shown? | A: Round down: 09:14:59 is shown as 09:14.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Write out the expected row for one person who joins at 09:00, leaves at 09:10, rejoins at 09:30 and leaves at 09:50. Then compare it with what the code reports.
2. What is 00:10 minus 23:50 when both are measured in seconds since midnight?
3. Sort one attendee's sessions by start and merge the ones that overlap before adding up their lengths.
4. Which key does a guest get, and which key does the second guest get?

**Follow-ups.**
1. Organisers want the report while the meeting is still running. What changes in how you store open sessions and compute `seconds`?
2. Events from several regions arrive late and out of order after an outage. Which parts of your fix still hold, and what would you change?
3. Organisers ask for a flag "present for at least 75% of the meeting". Is the denominator the scheduled length or the actual one, and what happens for people who joined from two devices?
4. Some organisations hide user names in usage reports. How would you keep guests distinct in the report without showing their names?

**Follow-up rules.**
- when: sum(, add up, sum of sessions → ask: A person is on a laptop and a phone for the same 30 minutes. What does your total say, and what should it say?
- when: % 86400, seconds since midnight, time of day → ask: What duration does your arithmetic give for a session from 23:50 to 00:10?
- when: zoneinfo, pytz, astimezone, daylight saving → ask: The specification gives one fixed offset for the meeting. When would a named time zone give a different answer, and which should the report use?
- when: display name, guest name → ask: Two different guests are both called "Alex". What does your key do, and what would you need from the meeting service to tell them apart?
- when: setdefault, earliest, min( → ask: After an outage, events arrive out of order. Does your first-join logic still hold?

**Evaluation Criteria.** Finds and explains every bug with its user-visible symptom; first join kept across rejoins; time on several devices merged as a union; durations computed on absolute timestamps, not clock times; times shown in the organiser's offset, including a date that rolls over; guests keyed by name and kept apart from members; the fix stays minimal and O(n log n); adds a test per bug.

## MSF-L2-04: Assistant usage reporting for tenant admins, without retaining prompt content

| | |
|---|---|
| **Template ID** | MSF-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / privacy-preserving usage telemetry, exact distinct users over rolling periods, pseudonymous reporting |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_actions": {"2": ["300 million", "800 million"], "3": ["4 billion", "9 billion"]},
  "tenants": {"2": ["8,000", "25,000"], "3": ["200,000", "450,000"]},
  "apps": [6, 9, 12],
  "periods": ["7, 30, 90 and 180 days", "7, 30 and 90 days"],
  "min_group": [5, 10, 25]
}
```

**Business Scenario.** A productivity suite includes an AI assistant inside {{apps}} apps: documents, spreadsheets, email, meetings, chat and others. The suite's admin centre already offers usage reports for its apps, with an option to conceal user names. Tenant admins now want the same for the assistant: actions per app, active users, and adoption trends over the last {{periods}}, so they can decide where to extend licences and where to train people. About {{tenants}} tenants generate {{daily_actions}} assistant actions a day. The prompts people type and the responses they get are customer content. The reporting pipeline must never store them, not even for a day.

**Problem Statement.** Design the pipeline from the client's usage event to the admin's report. Cover the event schema and how you keep content out of it, ingestion and deduplication, what makes a user "active", exact active-user counts per period, per-app and per-day aggregates, adoption trends against licensed users, the report's day boundary, concealed names, breakdowns by department with a minimum group size of {{min_group}} users, deletion of users who leave a tenant, data residency for tenants that require their data to stay in a geography, and how a metric definition change is restated.

**Constraints.** No prompt text, response text, file names or titles, or any other field derived from content, anywhere in the pipeline, including logs and error queues. Active-user counts must be exact per tenant, because admins compare them with licence counts. Reports are refreshed daily and may be up to two days behind. A user removed from the tenant's directory is removed from reports within 30 days in this exercise. One tenant can never see another tenant's data.

**Assumptions.** All volumes, periods, thresholds and windows are hypothetical. Clients emit one event per assistant action with the tenant id, the user's directory object id, the app, an action type from a fixed list, an outcome, the client version and a timestamp. Licence assignments come from a daily directory export per tenant. Department comes from the directory too.

**Clarifications.**
- Q: What counts as an active user? | A: A licensed user who performed at least one intentional assistant action in the period: a prompt submitted, a suggestion accepted, a summary generated. Opening the assistant's pane does not count.
- Q: Which day boundary does a report use? | A: UTC days in this exercise, and the report says so. Explain what you would do if admins asked for their own time zone.
- Q: Can I keep prompt text for a few days for debugging? | A: No. Not in this pipeline and not temporarily. Quality work on the assistant is a separate, governed process outside this design.
- Q: Do admins see individual users? | A: Yes, per-user rows are part of the report, unless the tenant turns on concealed names. Then users appear under pseudonyms that stay stable across the tenant's reports.
- Q: Can I sum daily active users to get 30-day active users? | A: No. A person active on 20 days would be counted 20 times.

**Hints.**
1. Write the event schema first, as an allow-list. Every field that is not on the list is dropped at the edge, before anything is stored.
2. Distinct users over 180 days cannot be summed from daily counts. Which small per-user table lets you answer every period exactly?
3. Decide where concealment and small-group suppression are applied, in storage or when serving, and justify it against the deletion requirement.

**Follow-ups.**
1. A client release starts sending a free-text error detail that sometimes contains a fragment of the user's prompt. How do you detect it, and what do you do about data already stored?
2. An admin asks for adoption by department, and one department has three users. What do you show, and how do you stop the hidden number being worked out from totals?
3. The definition of active changes: accepting a suggestion inside a document now counts. How do you restate history, and what do admins see?
4. A tenant's data has to move to another geography in the middle of a quarter. What happens to its history and its reports?
5. Product asks for cross-tenant benchmarks such as "tenants of your size". What can you publish, and what must you never publish?

**Follow-up rules.**
- when: hyperloglog, hll, approximate, sketch → ask: An admin sees 30-day active users 1% above the number of licences. How do you explain that, and where in your design do you need exact counts?
- when: dead letter, dlq, error queue, quarantine → ask: A malformed event lands in your error queue with its raw payload. What could be in that payload, and who can read it?
- when: hash, sha256, pseudonym → ask: The same hashed user id appears in every tenant's report. What can someone link with it, and how would you key or salt the hash?
- when: object id, user id, user_id → ask: A user is removed from the directory. Which of your tables still hold their identifier, and how do you remove it within 30 days?
- when: time zone, timezone, utc → ask: An admin in a tenant at UTC+13 sees Monday's usage split across two report days. What do you change, or how do you explain it?

**Production Reality Check.**
- A client release ships an error field that, for one day, carries fragments of prompt text in about 0.1% of {{daily_actions}} events.
- A directory sync failure marks every user in 300 tenants as unlicensed for a day, and their adoption charts drop to zero.
- One department in a large tenant has fewer than {{min_group}} users, and its numbers can be derived by subtracting the other departments from the tenant total.

**Evaluation Criteria.** An allow-listed event schema enforced at the edge, with content excluded from storage, logs and error queues; event ids and deduplication; a clear active-user definition; exact distinct users per period from a per-user activity table, not summed daily counts; licence-aware adoption; stable per-tenant pseudonyms and serving-time concealment; small-group suppression that also protects against subtraction; deletion within 30 days across every table; residency respected; versioned metric definitions with restatements; a plan for each incident.

## MSF-L2-05: Daily cloud resource inventory with change history from activity events

| | |
|---|---|
| **Template ID** | MSF-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / state reconstruction from events and snapshots, identity across moves, validity intervals |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "subscriptions": {"2": ["3,000", "12,000"], "3": ["150,000", "400,000"]},
  "resources": {"2": ["2 million", "8 million"], "3": ["120 million", "300 million"]},
  "daily_events": {"2": ["15 million", "40 million"], "3": ["900 million", "2 billion"]},
  "log_retention": ["90 days", "30 days"],
  "listing": ["a full listing once a day", "a full listing once a week"]
}
```

**Business Scenario.** A platform team runs a public cloud estate of {{subscriptions}} subscriptions and about {{resources}} resources. Every control-plane operation, such as a create, an update, a delete or a move, produces an activity event: about {{daily_events}} a day. In this exercise the activity log keeps events for {{log_retention}}. The team can also take {{listing}} of every resource through the cloud's resource API. Finance, security and compliance all ask versions of the same questions: what existed at the end of a given day, with which tags, location and size; who changed a resource and when; and which cost belongs to which team, even after resources were moved.

**Problem Statement.** Design the pipeline that builds a daily inventory and a change history from the activity events and the listings. Cover the sources and how each lands, the identity of a resource when its identifier changes, how an event that names an operation becomes a change in state, missed and late events, reconciliation against listings, deletions that cascade from a resource group to its contents, the history model and the daily inventory built from it, reruns and backfills, and how users can tell an observed change from an inferred one.

**Constraints.** The inventory for any past day must be reproducible. Events can be hours late, and some changes produce no event that reaches you. A listing takes hours to run, so it is not a single instant. Every change in the history must say whether it was observed in an event or inferred from a listing. Resource identifiers are case-insensitive.

**Assumptions.** All volumes, windows and schedules are hypothetical. An event carries an event id, the operation, the resource id, the caller, a status (started, succeeded or failed) and a timestamp. It does not carry the resource's properties after the change. In this exercise a move or a rename changes the resource id, and its event lists the old and the new id; check current docs for how a real cloud behaves. Deleting a resource group deletes everything in it, and in this exercise the contents may not each produce their own event.

**Clarifications.**
- Q: Does an event tell me the resource's new tags or size? | A: No. It tells you which operation ran on which id, by whom, when, and whether it succeeded. The resulting properties come from reading the resource, or from the next listing.
- Q: What does a move look like? | A: One succeeded event with the old id and the new id. The new id has a different resource group or subscription in its path.
- Q: Do failed operations appear? | A: Yes, with status failed. Only succeeded operations change state, and one operation can appear as started and then succeeded.
- Q: How complete is a listing? | A: Complete for every subscription the team can read, but it runs for hours, so two resources in it may have been read hours apart.
- Q: Are ids compared case-sensitively? | A: No. The same resource can appear with different capitalisation in different sources.

**Hints.**
1. Separate a resource's identity from its current id string. Give it a surrogate key, and keep a history of the id strings it has had.
2. Treat an event as evidence that something changed and when, and a listing as the truth at the time each resource was read. Record the source of every change.
3. Store history as validity intervals. The inventory for a day is then a query for the versions valid at the end of that day.

**Follow-ups.**
1. A listing shows 2 000 resources that no event ever mentioned. What do you write into the history, and with which timestamps?
2. A resource group with 500 resources is deleted, and you receive one event. What happens to the inventory and the history?
3. A resource moves to another subscription and its id changes. Cost records for the month are keyed by the id. How do you join cost to the inventory across the move?
4. The pipeline was down for longer than the activity log's {{log_retention}}. How do you rebuild, and what do you mark as unknown?
5. Auditors ask who changed a tag, and the change was made by an automated policy, not a person. What does your history show?

**Follow-up rules.**
- when: resource id, resourceid, primary key → ask: A move changes the id string. What does your primary key do, and how does the history follow the resource?
- when: listing, snapshot, full scan → ask: The listing takes four hours. A resource created and deleted during it appears in neither listing. Does that matter, and which source catches it?
- when: scd2, valid_from, valid_to, effective date → ask: A late event arrives for a change that happened before a listing already recorded the newer state. How do you insert it into intervals that are already closed?
- when: upsert, merge into, overwrite → ask: If you overwrite the current state, how do you answer "what existed on the 3rd of last month"?
- when: lower(, lowercase, case-insensitive → ask: You normalise ids to lower case for joins. What do you show to users, and could two different resources ever collide?

**Production Reality Check.**
- The event feed stalls for six hours. The next listing ({{listing}}) brings thousands of inferred changes with no caller, and security asks who made them.
- A reorganisation moves 400 resource groups to new subscriptions overnight. The next morning, cost allocated to the affected teams drops by a third because cost records use the new ids.
- A tagging policy rewrites a tag on every resource in {{subscriptions}} subscriptions within an hour, and the event volume is twenty times the usual {{daily_events}} a day rate for that hour.

**Evaluation Criteria.** Raw events and listings landed immutably with event-id deduplication; a surrogate resource key with an id-history table that survives moves and renames; succeeded operations turned into state changes, with properties read after the fact; validity-interval history with observed and inferred changes marked; reconciliation that infers missed creates and deletes from listings, with honest timestamps; cascade deletes handled; late events inserted correctly; reproducible daily inventories; case-insensitive identity; a plan for each incident.
