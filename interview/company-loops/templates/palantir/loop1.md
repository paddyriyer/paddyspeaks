# Palantir · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an enterprise data
integration and operational analytics platform: data connections and pipelines, an
ontology of objects, properties and links, access controls, and operational
applications. Every scenario is commercial and generic (a manufacturer, a utility, a
distributor); no customer or deployment is named or implied. Every object, dataset,
rule and number is hypothetical, and nothing here describes how any company's products
are built or enforce access. Rules used below are this exercise's model; check current
docs for the real ones. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## PLT-L1-01: User edits and pipeline syncs on the same object: current values and the share held by edits

| | |
|---|---|
| **Template ID** | PLT-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / latest-wins resolution with tie rules, as-of filtering, conditional aggregation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect, software-engineer |
| **Generator** | PLT-L1-01.mjs |

**Business Scenario.** A manufacturer's operations team works in an operational application built on an ontology of objects: machines, work orders, suppliers, shipments. Pipelines sync property values from the source systems on a schedule, and planners also edit properties directly in the application. Both kinds of write land in one log. The team wants to know, per object type, how much of what people currently see comes from user edits rather than from the systems of record: a high share means the application and the sources have drifted apart.

**Problem Statement.** Write one PostgreSQL query that returns `object_type, objects, properties, edit_held, edit_share`, one row per object type that has at least one current property value, ordered by `object_type`. Report the state as of `{{as_of}}` (the report instant): only writes with `written_at <=` that instant exist, and an object whose `deleted_at` is at or before it is left out entirely. {{delete_rule}} The current value of a property of an object comes from its winning write: the latest `written_at` wins, and at an equal `written_at` an `edit` beats a `sync` (this exercise's rule). If two writes of the same source share an instant, the higher `write_id` wins. {{tie_rule}} `write_id` is assigned on arrival, so it is not in `written_at` order. A write whose `value` is NULL clears the property: if it wins, the property has no current value and is not counted. {{null_rule}} `properties` counts the (object, property) pairs with a current value; `edit_held` counts those whose winning write is an `edit`; `objects` counts the objects of the type with at least one current value; `edit_share` is `edit_held / properties` rounded to 4 decimal places.

**Constraints.** One SQL statement (CTEs allowed). The report instant is inclusive for writes and for deletions. The sample has {{writes}} writes; assume billions of property writes across tens of millions of objects in production.

**Assumptions.** Hypothetical object types, properties, values and volumes. The resolution rule (latest wins, ties to the edit) is this exercise's model; real platforms let each object type configure how user edits and source updates combine, so check current docs. `written_at` is when the write took effect.

**Clarifications.**
- Q: If a sync arrives after a user edit, does the edit survive? | A: No. The latest write wins whatever its source; the edit wins only a tie at the same instant.
- Q: What does a NULL value mean? | A: The property was cleared. A winning NULL leaves no current value; an older non-NULL value does not come back.
- Q: Is `write_id` the order of the writes? | A: No. It is the order writes reached the log. Order by `written_at`; `write_id` only breaks a tie between two writes of the same source at the same instant, and the higher one wins.
- Q: Is a write exactly at the report instant included? | A: Yes. And an object deleted exactly at the report instant is gone.
- Q: Does an object type with no current values appear? | A: No. Only types with at least one current value.

**Hints.**
1. Rank the writes of each (object_id, property) with `ROW_NUMBER() OVER (PARTITION BY object_id, property ORDER BY written_at DESC, (source = 'edit') DESC, write_id DESC)` and keep rank 1.
2. Apply the report-instant filter before ranking and the NULL test after ranking. Swapping either one changes the answer.
3. `COUNT(*) FILTER (WHERE source = 'edit')`, and cast to numeric before dividing.

**Follow-ups.**
1. Product wants the value a user saw on any past date, for any object. How do you store and query "value as of t" over billions of writes so it stays cheap?
2. After an outage a source system resends yesterday's full snapshot, and the pipeline stamps every row with the resend time. What happens to the user edits made in between, and how would you change the model so a resend cannot override them?
3. Some properties must never be edited by users and others should always prefer the edit. How do you model per-property resolution rules and keep this report correct?
4. The share must update within a minute of each write across 50 million objects. How do you maintain it incrementally, including when a winning write is a NULL that clears a value?

**Follow-up rules.**
- when: max(written_at), max(, join back → ask: If you take MAX(written_at) per property and join back to the writes, how many rows come back when an edit and a sync share that instant?
- when: distinct on, row_number, rank → ask: Your ORDER BY decides every tie. Read it back: which write wins when two syncs share an instant, and why?
- when: is not null, coalesce, where value → ask: Is your NULL test applied before or after you pick the winner? Show an input where the order matters.
- when: write_id → ask: write_id is the arrival order. Why is ordering by it alone wrong here, and when is it the right tie-breaker?
- when: upsert, overwrite, merge → ask: If the sync pipeline upserted current values instead of appending writes, what could this report no longer tell you?

**Evaluation Criteria.** Filters by the report instant before choosing a winner and removes deleted objects; latest `written_at` wins, edits win ties, then the higher `write_id`; the NULL test comes after ranking; counts per type with a numeric, rounded share; deterministic order; can discuss as-of history and how to keep a resent snapshot from overriding edits.

## PLT-L1-02: Reads after expiry: restricted datasets read after the reader's purpose-based grant had ended

| | |
|---|---|
| **Template ID** | PLT-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / interval coverage with LEFT JOIN, NULL-aware LEAST, three-way classification |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | PLT-L1-02.mjs |

**Business Scenario.** A utility's data platform is moving to a stricter access model (this exercise's model): some datasets carry a restrictive marking, and reading one needs a grant for that user, that dataset and a stated purpose, with an expiry. Renewals are issued as new grants. Before the new rules are enforced, the governance team replays the read log against the grant history in a dry run, to see how many reads the rules would have flagged and why: because a grant had lapsed, or because there never was one.

**Problem Statement.** Write one PostgreSQL query that returns `dataset_id, read_month, restricted_reads, after_expiry, never_granted, max_hours_late`, one row per dataset and UTC month with at least one counted read, ordered by `dataset_id, read_month`. A read counts only when its dataset was restricted at the time: `marking` is not NULL and `marked_since <= read_at`. {{marked_rule}} A grant matches a read when it has the same `user_id`, `dataset_id` and `purpose`. {{purpose_rule}} A matching grant covers the read when `granted_at <= read_at < end`, where `end` is `expires_at`, or `revoked_at` if that is earlier. {{revoke_rule}} Renewals are separate grant rows; any covering grant is enough. Each counted read is exactly one of: **covered**; **after expiry**: not covered, but at least one matching grant had `granted_at <= read_at` (so every such grant had ended); **never granted**: no matching grant had started. `restricted_reads` counts all counted reads. `read_month` is the first day of the read's UTC month, as a DATE. `max_hours_late` is, over the month's after-expiry reads, the largest number of hours from the latest `end` among the read's matching started grants to the read, rounded to 1 decimal place; NULL when the month has none.

**Constraints.** One SQL statement (CTEs allowed). A read exactly at a grant's `end` is not covered by it; a read exactly at `granted_at` is. The sample has {{reads}} reads and {{grants}} grants; assume billions of reads a month in production.

**Assumptions.** Hypothetical datasets, markings, purposes and pseudonymous user ids. The marking, purpose and expiry rules are this exercise's model of purpose-based access, not a description of how any product enforces access; check current docs. All timestamps are UTC.

**Clarifications.**
- Q: A grant expired and was renewed two days later. What about a read in between? | A: After expiry. A read is covered only if some grant covers that instant.
- Q: The renewal was issued before the old grant expired. | A: Then they overlap, and a read in the overlap or after the old expiry (but inside the renewal) is covered.
- Q: Does a grant for another purpose cover the read? | A: No. The purpose is part of the match.
- Q: Which end do I measure the hours from? | A: The latest end among the matching grants that had started by the read.
- Q: What if a revocation was recorded after the grant had already expired? | A: The end is the earlier of the two, so it changes nothing.
- Q: Reads of datasets that are not marked? | A: Not counted, and they produce no rows.

**Hints.**
1. LEFT JOIN each counted read to its matching grants, with `granted_at <= read_at` in the join condition, so reads with no started grant survive; then aggregate per read.
2. Per read you need three things: how many matching grants had started, whether any covers it (`bool_or`), and the latest end (`MAX`).
3. In PostgreSQL `LEAST(expires_at, revoked_at)` ignores a NULL argument. `COALESCE(revoked_at, expires_at)` is not the same thing.

**Follow-ups.**
1. The review wants every after-expiry read listed with the approver of the grant that lapsed last. How do you produce it without duplicating reads that had several expired grants?
2. The read log is billions of rows a month. How would you compute this incrementally, and which sort order or index makes the per-read grant lookup cheap?
3. In this exercise's model markings are inherited by derived datasets. How would the query change if a derived dataset is restricted whenever any of its inputs is?
4. Before enforcement starts, how would you present these numbers to dataset owners so they lead to fixes rather than blame?

**Follow-up rules.**
- when: inner join, join grants → ask: What happens to a read whose user never had a grant on that dataset? Where does it appear in your output?
- when: coalesce → ask: COALESCE(revoked_at, expires_at) and LEAST(expires_at, revoked_at) differ for one kind of grant. Which kind, and which does the specification want?
- when: between → ask: BETWEEN is inclusive at both ends. Which read does that misclassify here?
- when: lead, lag, next grant → ask: You compare each grant with the next one. What happens when three grants overlap and the middle one ends last?
- when: exists, not exists → ask: An EXISTS test classifies the read. How do you also get the hours late without a second pass over the grants?

**Evaluation Criteria.** Counts only reads of datasets marked at the time; matches on user, dataset and purpose; half-open coverage where any grant is enough; the end as the earlier of expiry and revocation; a LEFT JOIN that keeps never-granted reads; hours from the latest end; UTC months as dates; deterministic order; can explain how to run the check incrementally.

## PLT-L1-03: First-pass yield per production line and shift, with night shifts that cross midnight

| | |
|---|---|
| **Template ID** | PLT-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first and last per group, shift calendars, time zones |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | PLT-L1-03.mjs |

**Business Scenario.** A manufacturer integrates end-of-line test results from its plants into one operational view. Every unit is tested; failures are reworked and retested, sometimes at a station on another line. Plant managers compare lines and shifts by first-pass yield, the share of units that pass their first test, and want retests counted by how they finally ended. Shifts run 06:00–14:00 (day), 14:00–22:00 (swing) and 22:00–06:00 (night) in plant local time, and a night shift belongs to the date it started.

**Problem Statement.** Write one PostgreSQL query that returns `line_id, shift_date, shift, units, first_pass, retested, final_pass, fpy`, one row per line, shift date and shift with at least one unit, ordered by `line_id, shift_date, shift`. A unit's attempts are its tests with `result` 'pass' or 'fail', ordered by `tested_at`, then `test_id`; a 'void' test is an aborted run and is not an attempt. {{void_rule}} A unit with no attempts is not counted. Each unit is counted once, under the line, shift date and shift of its first attempt, wherever its later attempts happened. `first_pass` counts units whose first attempt passed; `retested` counts units with more than one attempt; `final_pass` counts units whose last attempt passed; `fpy` is `first_pass / units` rounded to 4 decimal places. {{tz_rule}} The shifts are day [06:00, 14:00), swing [14:00, 22:00) and night [22:00, 06:00); a test before 06:00 belongs to the night shift of the previous date.

**Constraints.** One SQL statement (CTEs allowed). 06:00:00 opens the day shift, 14:00:00 the swing shift and 22:00:00 the night shift. `test_id` is the upload order, not the test order. The sample has {{tests}} test records.

**Assumptions.** Hypothetical lines, serial numbers and results. The shift pattern and the yield definitions are this exercise's. Retests can happen on a rework station attached to another line.

**Clarifications.**
- Q: A unit failed on one line and was retested on another. Which line gets it? | A: The line of its first attempt.
- Q: A unit passed, was sent back for a re-test and failed. | A: Its final outcome is fail: the last attempt decides. It still counts as a first pass.
- Q: Two attempts of a unit have the same tested_at. | A: The lower test_id came first.
- Q: Does a void count as a failed first attempt? | A: No. Voids are ignored entirely.
- Q: Which shift is a test at 02:00 on 16 September? | A: The night shift of 15 September.

**Hints.**
1. `ROW_NUMBER()` per unit in both directions gives the first and the last attempt; `COUNT(*) OVER (PARTITION BY unit_serial)` gives the number of attempts.
2. Remove voids in WHERE, before the window functions.
3. Convert to plant local time first (`tested_at AT TIME ZONE '…'` gives a local timestamp). Subtracting 6 hours and casting to date gives the shift date of every shift.

**Follow-ups.**
1. Managers also want rolled throughput yield across three test stations in sequence. How does it differ from first-pass yield, and what extra data does it need?
2. A plant changes clocks for daylight saving time during a night shift. How long is that shift, and what should the report show for it?
3. Results from some testers arrive up to two days late. When is a shift's yield final, and how do you correct one that was already published?
4. One line's yield jumps from 0.82 to 0.97 overnight. What would you check in the data before believing it?

**Follow-up rules.**
- when: date_trunc, ::date, cast → ask: Which shift_date does your query give a test at 02:30 local time, and which should it be?
- when: min(tested_at), min( → ask: MIN(tested_at) finds the first time. How do you get that attempt's result and line, and what if two attempts share it?
- when: utc → ask: Shifts are in plant local time. At a plant 5½ hours ahead of UTC, which shift does a test at 03:00 UTC belong to?
- when: bool_or, any pass, max(result) → ask: A unit passed and then failed a re-test. What does your final_pass say for it, and what should it say?
- when: void → ask: Where are voids removed in your query? What changes for a unit whose first test was void?

**Evaluation Criteria.** Ignores voids before ordering attempts; first and last attempt by `tested_at` then `test_id`; one row per unit, placed by its first attempt; correct local shift and shift date across midnight; final outcome from the last attempt; numeric, rounded yield; deterministic order; can discuss late data and daylight saving changes.

## PLT-L1-04: Pipeline cycles: the groups of datasets that depend on each other

| | |
|---|---|
| **Template ID** | PLT-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Graphs / strongly connected components, iterative depth-first search (O(V + E) versus a search from every dataset, O(V·(V + E))) |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | PLT-L1-04.mjs |

**Business Scenario.** An enterprise data platform builds datasets from other datasets: each dataset declares the inputs its transform reads. A build runs inputs before the datasets that read them, which is impossible when datasets depend on each other in a cycle, usually by accident (a cleaned table that reads a report built from it). Before the nightly build, a check lists every such group so their owners can break them.

**Problem Statement.** Implement `pipeline_cycles(inputs)`. `inputs` maps each declared dataset to the list of datasets it reads. An input that is not a key is a raw source, which reads nothing. Return every cycle group: a largest set of two or more datasets in which each one depends, directly or through other datasets, on every other one; or a single dataset that lists itself as an input. Each group is a list sorted ascending, and the groups are sorted by their first element. Return `[]` when there are none. {{self_rule}} {{depth_rule}}

**Constraints.** Up to 200 000 datasets and 400 000 declared inputs. Expected O(V + E) time and memory. Do not assume the search depth fits Python's default recursion limit.

**Assumptions.** Hypothetical dataset names and sizes. The order of keys and of inputs carries no meaning, and an input can be listed twice.

**Clarifications.**
- Q: Two cycles connected by a one-way dependency? | A: Two groups. A group needs paths in both directions between every pair.
- Q: Two cycles that share a dataset? | A: One group.
- Q: A dataset downstream of a cycle cannot build either. Is it in the group? | A: No. Only datasets on a cycle.
- Q: Can I use recursion? | A: You can, but pipelines can be long chains; check how deep your search goes.
- Q: What is returned? | A: A list of lists of strings, each sorted ascending, groups sorted by first element; `[]` if there are none.

**Hints.**
1. These are the strongly connected components of the graph. Tarjan's algorithm finds them all in one depth-first pass; Kosaraju's uses two, the second on the reversed graph.
2. A raw source has no inputs, so it is a component of one on its own and never a group; you can add it to the graph or skip it.
3. To avoid the recursion limit, keep an explicit stack of (dataset, iterator over its inputs) and update the parent's low-link when a child finishes.

**Follow-ups.**
1. Also report, for each group, the datasets downstream of it that therefore cannot build. How do you get that in linear time?
2. Propose the fewest declared inputs to remove so that no cycle remains. Why is that hard in general, and what would you do in practice?
3. Inputs change a few at a time during the day. How would you keep the check fast without recomputing the whole graph each time?
4. The build should start each dataset as soon as its inputs are ready, across 64 workers. How do the components and the DAG between them drive that scheduler?

**Follow-up rules.**
- when: recursion, recursive, setrecursionlimit → ask: What happens on a chain of 100 000 datasets? How would you make the search iterative?
- when: bfs, reachable, reachability, dfs from each → ask: What does a search from every dataset cost on 60 000 datasets, and which single-pass algorithm avoids it?
- when: topological, kahn, in-degree, indegree → ask: Kahn's algorithm shows that a cycle exists. How do you get from the datasets it leaves behind to the separate groups?
- when: union-find, union find, disjoint set → ask: Union-find merges along edges whatever their direction. Show two datasets it would wrongly put in one group.

**Evaluation Criteria.** Recognises strongly connected components; one linear pass (Tarjan or Kosaraju) that does not depend on the recursion limit; raw sources, self-loops and duplicate inputs handled; groups and members sorted as specified; can explain why reachability from every dataset is quadratic and how the condensation DAG supports build scheduling.

## PLT-L1-05: Supplier record matching: the same postcode and names within one edit

| | |
|---|---|
| **Template ID** | PLT-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hashing / blocking, string normalisation, linear within-one-edit check (O(Σ b²·L) with blocking versus O(n²·L) for every pair) |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | PLT-L1-05.mjs |

**Business Scenario.** A distributor integrating supplier lists from several purchasing systems finds the same supplier recorded many times with small differences: case, punctuation, "Ltd" versus "Ltd.", a typo. Before records are linked into one supplier object, a matching step proposes candidate pairs for a reviewer. Comparing every pair of tens of thousands of records is far too slow, and in this exercise only records at the same postcode can be the same supplier.

**Problem Statement.** Implement `match_suppliers(records, transpositions=False)`. Each record is `(record_id, name, postcode)`; `postcode` may be None. Normalise each name: lower-case it; turn every character other than a–z and 0–9 into a space; split into words; while the last word is one of `co, corp, gmbh, inc, limited, llc, ltd, plc`, drop it; join the words with single spaces. Normalise each postcode: upper-case it and remove spaces. Two records match when both normalised postcodes are non-empty and equal, both normalised names are non-empty, and the names are within one edit: equal, or one insertion, deletion or substitution of a single character apart (a space is a character). When `transpositions` is True, swapping two adjacent characters also counts as one edit. Return the matching pairs as `(smaller_id, larger_id)` tuples, sorted ascending. {{postcode_rule}} {{edit_rule}}

**Constraints.** Up to 40 000 records, names up to 60 characters, unique integer ids. Comparing every pair will not finish in time; compare only records that can match, and decide "within one edit" in time linear in the name length.

**Assumptions.** Hypothetical supplier names, postcodes and ids. Names are ASCII in this exercise. The legal-form list and the one-edit rule are this exercise's matching policy, not a recommendation for any real master-data process.

**Clarifications.**
- Q: Are legal-form words removed wherever they appear? | A: Only at the end, repeatedly: "Apex Co. Ltd" becomes "apex", but "Co Apex" keeps "co".
- Q: Do "Apex Fasteners" and "ApexFasteners" match? | A: Yes. Removing one space is one edit.
- Q: If A matches B and B matches C, do I report A–C? | A: Only if A and C match directly. Grouping is a later step.
- Q: A record without a postcode? | A: It never matches anything.
- Q: Do I need the exact edit distance? | A: No. Only whether it is at most one.

**Hints.**
1. Put records in a dict keyed by normalised postcode and compare pairs only inside each group.
2. Within one edit: if the lengths differ by more than one, no. Equal lengths: count the positions that differ. Lengths differ by one: walk both until the first difference, then the rest of the shorter must equal the rest of the longer after skipping one character.
3. A transposition is equal lengths with exactly two differing positions, adjacent, whose characters are swapped.

**Follow-ups.**
1. One industrial estate has 5 000 suppliers at a single postcode. What happens to your running time, and how would keys made by deleting one character from each name find within-one-edit pairs without comparing all pairs in the block?
2. Postcodes themselves have typos. How would you block so those pairs are not lost, and what does it cost?
3. The pairs go to a reviewer before records merge into one supplier object. How do you turn pairs into proposed groups, and what stops one bad pair from chaining two different suppliers together?
4. How would you measure the precision and recall of this matcher without labelling every pair?

**Follow-up rules.**
- when: levenshtein, edit distance, dynamic programming → ask: A full edit-distance table costs O(L²) per pair. You only need to know whether the distance is at most one. How do you decide that in O(L)?
- when: sort, sorted → ask: Sorting by postcode and scanning runs of equal postcodes is blocking too. How does it compare with a dict of lists?
- when: fuzzy, jaro, similarity score → ask: The rule here is exact: within one edit. What would a similarity threshold change for reviewers, and how would you choose it?
- when: union-find, transitive, cluster → ask: The task asks for direct pairs. If you grouped them transitively, what could chaining do to two different suppliers?

**Evaluation Criteria.** Normalises names and postcodes exactly as specified (trailing legal forms only, spaces as characters, empty values never match); blocks by postcode; a linear within-one-edit check including the transposition case; pairs ordered as specified; can explain the cost of large blocks and how deletion keys or better blocking keys address it.
