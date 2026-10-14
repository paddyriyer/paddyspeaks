# Adobe · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of creative apps with
cloud documents, PDF and e-signature services, generative features with content
credentials, fonts, stock content, and marketing and analytics products. Every
workload, number, schema and incident is hypothetical, and nothing here describes
how any company builds its products. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ADB-L2-01: Comparing two saved versions of a cloud document

| | |
|---|---|
| **Template ID** | ADB-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Algorithms / shortest edit script, Myers' greedy diff, output-sensitive complexity |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | ADB-L2-01.mjs |

**Business Scenario.** A cloud document keeps its version history: autosaves, and versions the author names. A "compare versions" view puts two saved versions side by side and marks the paragraphs that were removed and the paragraphs that were added. In this exercise each paragraph is represented by a hash of its content, so the comparison works on short strings and never needs the text itself. Long documents, such as a manual with tens of thousands of paragraphs, usually change in only a few places between two versions, and the view must open quickly for them too.

**Problem Statement.** Implement `version_diff(old, new, max_edits=None)`. `old` and `new` are lists of paragraph hashes in document order. An edit deletes one paragraph of `old` or inserts one paragraph of `new`; there is no "change" operation, so a rewritten paragraph is one deletion and one insertion, and so is a moved one. Return `(deleted, inserted)` for an edit script with the fewest edits in total. That pair is the same for every shortest script: `deleted = len(old) − k` and `inserted = len(new) − k`, where `k` is the length of a longest common subsequence. {{dup_rule}} {{cap_rule}}

**Constraints.** Up to 30 000 paragraphs in each version. Two versions usually differ by at most a few hundred edits, spread through the document, not only at its start or end. Something close to O((n + m) · D) is expected, where D is the number of edits. A full n × m table is 9 × 10⁸ cells at this size, too slow and too large.

**Assumptions.** Document sizes and edit counts are hypothetical. Equal hashes mean equal paragraphs; in this exercise there are no collisions. The hash strings are opaque: compare them only for equality.

**Clarifications.**
- Q: Is a paragraph that moved one edit or two? | A: Two: one deletion where it was and one insertion where it is now. Detecting moves is a follow-up.
- Q: Do I return the edit script itself? | A: No, only `(deleted, inserted)`. That pair is unique even when several shortest scripts exist.
- Q: Can the same hash appear twice in one version? | A: It depends on the replay. When it can, every empty paragraph has the same hash, and a repeated heading has one hash too.
- Q: What if one version is empty? | A: Then every paragraph of the other version is an edit: `(len(old), 0)` or `(0, len(new))`.
- Q: What does `max_edits` mean? | A: A cap on the work. If the fewest edits needed is greater than it, return `None`. When it is `None` there is no cap.

**Hints.**
1. Draw the edit graph: x moves along `old`, y along `new`. A step right is a deletion, a step down an insertion, and a diagonal step, where the paragraphs are equal, is free.
2. For each number of edits d, keep only the furthest point you can reach on every diagonal k = x − y. A path with d edits ends on a diagonal between −d and d with the same parity as d.
3. After each edit, follow the free diagonal steps as far as they go. Stop as soon as a path reaches the end of both versions. That d is the answer, and with a cap you may stop early.

**Follow-ups.**
1. The view must show which paragraphs changed, not just how many. How do you recover the edit script without keeping every round's furthest points in memory?
2. Authors complain that a moved section shows as a long deletion and a long insertion. How would you detect moves, and what would you show?
3. Within a changed paragraph, the view should highlight the words that changed. What do you run at that level, and how do you stop it being slow on a paragraph that was entirely rewritten?
4. Two people edited the same base version on different devices. How would you use two diffs against the base to merge them, and where do you need the author to decide?

**Follow-up rules.**
- when: difflib, SequenceMatcher → ask: SequenceMatcher looks for long matching blocks and is not guaranteed to find the fewest edits. Give an input where its edit count is higher than the minimum, or explain how you would test for one.
- when: lcs table, dp table, dynamic programming, n*m → ask: How many cells is that table for two 30 000-paragraph versions, and how much memory and time would it take in Python?
- when: myers, snake, furthest, diagonal → ask: Why is it enough to keep only the furthest-reaching point on each diagonal? What would go wrong if you kept a point that is not the furthest?
- when: prefix, suffix, trim → ask: Trimming the common start and end helps when edits are clustered. What does it save when the edits are spread through the whole document?
- when: collision, same hash → ask: Two different paragraphs get the same hash. What does the view show, and how likely is that with the hash length you would choose?

**Evaluation Criteria.** Correct `(deleted, inserted)` with moves and rewrites counted as a deletion and an insertion; correct on empty versions and on repeated hashes; `None` exactly when the edits exceed `max_edits`; an algorithm whose cost grows with the number of edits (Myers' furthest-reaching paths, or an equivalent output-sensitive method) with a clear complexity argument; awareness of memory as well as time; sensible answers on recovering the script, moves and merges.

## ADB-L2-02: Breaking a paragraph into lines with even spacing

| | |
|---|---|
| **Template ID** | ADB-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / optimal line breaking, bounded inner loops, tie rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | ADB-L2-02.mjs |

**Business Scenario.** Layout and document apps set paragraphs of text in columns. Filling each line with as many words as fit, then moving on, can leave one line nearly empty in the middle of a paragraph, which looks like a hole in justified text. Typesetting systems instead choose all the break points of a paragraph together, so that the white space is spread evenly. In this exercise the layout engine gives you the width of every word, and you must choose the line breaks for paragraphs of any length, including very long ones in a large document.

**Problem Statement.** Implement `break_lines(widths, line_width, space, forced)`. `widths` are the word widths in layout units, in reading order. A line holding words `i..j` is `widths[i] + … + widths[j] + space · (j − i)` units wide, and it must be at most `line_width`. Its slack is `line_width` minus that width. The cost of a layout is the sum of the squared slack of every line except the last, which is free. Return `(cost, starts)` for a layout with the least cost, where `starts` lists the index of the first word of every line. If several layouts have the least cost, return the one whose `starts` list is smaller, compared element by element as Python compares lists. An empty paragraph returns `(0, [])`. {{width_rule}} {{forced_rule}}

**Constraints.** Up to 80 000 words in one call. Every width is a positive integer, `space` is at least 1, and a line holds a few dozen words at most. Something close to O(n · w) is expected, where w is the most words that fit on one line. Trying every later word as the end of each line is O(n²) and too slow.

**Assumptions.** Widths, line widths and spaces are hypothetical whole layout units. Hyphenation, kerning and stretchable spaces are outside this exercise. Squared slack is this exercise's cost rule; production typesetters use richer rules.

**Clarifications.**
- Q: Does the last line count? | A: No. The last line is free, whatever its slack, but it must still fit.
- Q: Is a line that fills the width exactly allowed? | A: Yes. Its slack is 0.
- Q: Which layout do I return when two cost the same? | A: The one with the smaller `starts` list, compared element by element. For example `[0, 3, 7]` comes before `[0, 4, 6]`.
- Q: Can a line hold one word? | A: Yes. A single word that fits is always a legal line.
- Q: Are the widths sorted or bounded? | A: Neither, beyond being positive integers. A word can be as wide as the whole line.

**Hints.**
1. Let `best[i]` be the least cost to lay out words `i` to the end. The line that starts at word `i` ends at some word `j`, and the rest is `best[j + 1]`.
2. Grow the line from word `i` one word at a time, keeping a running width. As soon as it no longer fits, no longer line fits either, so stop.
3. Fill `best` from the end of the paragraph backwards, and on a tie keep the earlier break. Then the `starts` list you read off from the front is the smallest one.

**Follow-ups.**
1. Typesetters also penalise a tight line next to a loose one. What does that add to your state, and what does it cost?
2. A paragraph is edited in the middle of a 300-page document. Which lines do you need to recompute, and how do you know when the new layout has rejoined the old one?
3. Words may be hyphenated at known points for a fixed penalty. How do you add that to the DP?
4. The inner loop is bounded by the words per line. For very narrow columns that is small, but for very wide ones it is not. What property of the cost lets an algorithm such as SMAWK do better, and does squared slack have it?

**Follow-up rules.**
- when: greedy, first fit, as many as fit → ask: Give a paragraph where filling each line as far as it goes costs more than the best layout. What does squared slack punish that greedy ignores?
- when: recursion, lru_cache, memo → ask: How deep does your recursion go on an 80 000-word paragraph, and what happens at Python's default recursion limit?
- when: prefix sum, prefix sums, cumulative → ask: Prefix sums give each line's width in O(1). Does your loop over line ends still stop early, or does it try every later word?
- when: float('inf'), math.inf, infinity → ask: Your costs are integers. Where could a float enter the answer, and what would the output then look like?
- when: tie, tiebreak, lexicographic → ask: Why does keeping the earlier break, when filling the table from the end, give the smallest `starts` list overall?

**Evaluation Criteria.** Correct cost with the last line free; correct width arithmetic with spaces between words only; the tie rule implemented and justified; `None` and `(0, [])` where specified; forced breaks handled where they apply; a DP whose inner loop stops at the line width, with a clear O(n · w) argument; no recursion-depth hazard; sensible answers on incremental relayout, hyphenation and richer cost rules.

## ADB-L2-03: Debug the monthly font usage report

| | |
|---|---|
| **Template ID** | ADB-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Event aggregation / time zones, distinct counts at the right grain, event-type filters |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | ADB-L2-03.mjs |

**Business Scenario.** A font service lets subscribers activate fonts for their desktop apps and add fonts to web projects that serve them on websites. Type designers and the font team read a monthly usage report per font family. The report has drawn complaints. Families with variable fonts appear to have hundreds of styles. A family's desktop account count is higher than the number of accounts that used it. Desktop activations jump in months with large web launches. Users who switched a font off are counted as using it. Activations from the last evening of a month in the Americas appear in the wrong month. The function below produces the report and is the suspect. The report reads only usage events: font, account, surface, project and time, never any document or web page.

**Problem Statement.** Fix `font_usage_report(events)` so that it meets this specification. Each event is a dict `{"type", "surface", "account", "project", "font", "ts"}`, in any order. {{replay_rule}}
1. **Events.** `type` is `"activate"` or `"deactivate"`. `surface` is `"desktop"` (a font activated for desktop apps, `project` is `None`) or `"web"` (a font added to a web project, named by `project`). Only `activate` events are counted anywhere. A deactivation never adds to a count and never creates a row.
2. **Fonts.** `font` is `"Family/Style"`, for example `"Harbor Serif/Bold Italic"`. A variable-font instance carries its axis settings after `@`, for example `"Lumen Sans/Roman@wght=650,wdth=85"`. It is an instance of the style before the `@` (`"Roman"`), not a style of its own.
3. **Months.** `ts` is ISO 8601 with a UTC offset, for example `"2026-04-30T21:15:00-05:00"`. An event belongs to the UTC calendar month of its instant (that example is in `"2026-05"`).
4. **Output.** `{month: {family: {"desktop_activations", "desktop_accounts", "styles", "web_projects"}}}`, with a row for every month and family that has at least one `activate` event. `desktop_activations` counts desktop `activate` events. `desktop_accounts` counts distinct accounts with a desktop activation of any style of the family. `styles` counts distinct styles activated on either surface. `web_projects` counts distinct web projects the family was added to.

**Constraints.** Keep the function's name and output format. Up to 200 000 events, processed in linear time.

**Assumptions.** Event names, families, accounts and projects are fictional, and the counting rules are this exercise's rules, not any product's published definitions. Each event is delivered once.

**Clarifications.**
- Q: Does a web-project addition count as a desktop activation? | A: No. Web additions count only towards `web_projects` and `styles`.
- Q: An account activates Regular and Bold of one family. How many desktop accounts is that? | A: One. Accounts are counted per family.
- Q: What about activating the same style twice in a month? | A: Two activations, one account, one style.
- Q: Which month is `"2026-06-01T03:00:00+05:30"` in? | A: May: that instant is 21:30 UTC on 31 May.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Take one event at a time and write down the month, family and style the code derives from it. Try an evening in UTC−05:00 on the last day of a month.
2. Which field identifies a style? Look at what the code does with everything after the slash.
3. For each counter, ask which event types and which surfaces may change it, and at what grain it is distinct.

**Follow-ups.**
1. Font designers want the number of accounts that had a family active at any point in the month, not just those who activated it during the month. What state do you need, and where does it come from?
2. The report runs daily over the month so far, and events arrive up to two days late. How do you make re-runs give the same answer and handle the late events?
3. Distinct accounts per family per month over billions of events is expensive. Where would an approximate distinct count be acceptable, and where not?
4. A family is renamed by its foundry halfway through the month. How do you report it, and what do you keep so last year's reports can still be explained?

**Follow-up rules.**
- when: [:7], slice, string month → ask: The string's date is the local date. Which events end up in the wrong month, and how many hours of each month can that affect?
- when: fromisoformat, astimezone, utc → ask: The report is in UTC months. A designer in Tokyo reads it. Is that the right choice for them, and what would you show instead?
- when: split('@'), partition('@'), variable → ask: A designer asks how many instances of the variable style were used. Where would you keep that, now that `styles` collapses them?
- when: approximate, hyperloglog, hll → ask: Which of these four counters could be approximate, and which must be exact for the people who read the report?
- when: test, regression → ask: Which single test would have caught each bug, and how would you keep it from passing by accident?

**Evaluation Criteria.** Finds and explains every bug with the complaint it causes; months from the UTC instant; variable-font instances reduced to their style; accounts distinct per family; desktop counters limited to desktop events; deactivations ignored, including for row creation; minimal, linear fixes; a test per bug; sound answers on active-state counts, late events and approximate counts.

## ADB-L2-04: Ingesting stock contributions from upload to search

| | |
|---|---|
| **Template ID** | ADB-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / review workflows, state machines, search indexing freshness |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "daily_uploads": {"2": ["40,000", "120,000"], "3": ["600,000", "1.5 million"]},
  "contributors": ["50,000", "300,000", "1 million"],
  "review_target": ["48 hours", "5 days"],
  "freshness": ["15 minutes", "1 hour"]
}
```

**Business Scenario.** A stock content marketplace accepts photos, illustrations, vectors and videos from {{contributors}} contributors and licenses them to customers. About {{daily_uploads}} files are uploaded a day. Each file goes through automated checks and a review before it can be sold, and contributors add a title, keywords and release documents for people or property shown. Contributors are promised a review decision within {{review_target}}. Once an asset is approved it must be findable in search within {{freshness}}, and once it is withdrawn or taken down it must leave search just as quickly.

**Problem Statement.** Design the pipeline from upload to search. Cover how uploads land and are identified, the states an asset moves through (uploaded, checks passed or failed, submitted, in review, approved, rejected with a reason, withdrawn, taken down) and how transitions are recorded, the automated checks and how their results are stored, keywords and titles and the edits contributors make after approval, licence types and release documents, how the search index is kept fresh, and the data contributors and the review team see: queue sizes, decision times and rejection reasons.

**Constraints.** A file can be uploaded twice, by the same contributor or another one. Contributors edit keywords after approval, and edits must reach search. A takedown must remove an asset from search and from new licensing within {{freshness}}, even while other updates are queued. Already-licensed copies keep their licence. Reviews are done by people working through queues, and the review target is measured per asset.

**Assumptions.** All volumes, targets and states are hypothetical; licence and review rules are this exercise's rules, not a statement of any marketplace's policy. You may use common building blocks: object storage, a queue or log, a relational store, a stream processor and a search engine.

**Clarifications.**
- Q: What identifies an asset: the file or the submission? | A: You decide, but a contributor can upload the same file twice and two contributors can upload visually identical files. Say how you detect and treat both.
- Q: Can an approved asset change? | A: Its title, keywords and categories can be edited. A new file is a new asset.
- Q: Who needs the review data? | A: The review team needs queue sizes, ages and decision times; contributors need their own assets' states and rejection reasons.
- Q: How fast must a takedown take effect? | A: Within {{freshness}} for search and new licences, and you must be able to prove when it happened.
- Q: Do automated checks decide on their own? | A: In this exercise, technical checks (format, resolution, corrupt files) can reject on their own. Anything else goes to human review.

**Hints.**
1. Model the asset as a state machine and store every transition as an append-only event with who, when and why. Current state is derived from it.
2. Separate the search index from the source of truth: the index is a projection that can always be rebuilt from the asset table and its events.
3. Give takedowns their own fast path into the index, or a version check that lets them overtake slower updates.

**Follow-ups.**
1. A contributor edits keywords on an asset while a takedown for it is still in flight. Walk through what each system sees, and how you guarantee the takedown wins.
2. The review queue grows faster than reviewers can clear it, and the {{review_target}} target is missed for a week. What data shows why, and what would you change?
3. The search index must be rebuilt from scratch after a mapping change. How do you do that without serving stale or missing assets meanwhile?
4. How would you detect that a newly uploaded file is a near-duplicate of an existing approved asset from another contributor, and what happens next?

**Follow-up rules.**
- when: status column, update status, current state → ask: A contributor disputes a rejection from three weeks ago. With your model, how do you show who decided, when, and on which version of the metadata?
- when: elasticsearch, opensearch, search index → ask: The index and the asset table disagree for one asset. Which one wins, and how do you find all such disagreements?
- when: cdc, change data capture, outbox → ask: What ordering do you rely on between a keyword edit and a takedown for the same asset, and where could that order be lost?
- when: hash, perceptual hash, phash, duplicate → ask: Two contributors upload visually identical files. Who keeps the asset, who decides, and what does the second contributor see?
- when: cron, nightly, batch reindex → ask: A takedown must leave search within {{freshness}}. How does a scheduled job meet that?

**Evaluation Criteria.** Immutable landing with content hashes and upload identity; an explicit asset state machine with append-only transitions and reasons; checks and reviews recorded as results tied to asset and metadata versions; metadata edits versioned and propagated; the search index treated as a rebuildable projection with a freshness target and monitoring; takedowns that cannot be overtaken by stale updates; licences already sold unaffected; queue and decision-time metrics per asset; credible answers on duplicates and reindexing.

## ADB-L2-05: Collecting page views and events from customers' websites

| | |
|---|---|
| **Template ID** | ADB-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / beacon collection, sessionisation, bot filtering, late hits |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "daily_hits": {"2": ["800 million", "2 billion"], "3": ["20 billion", "60 billion"]},
  "customers": ["1,200", "9,000", "30,000"],
  "late_window": ["24 hours", "72 hours"],
  "report_latency": ["5 minutes", "30 minutes"]
}
```

**Business Scenario.** A web analytics product lets {{customers}} customer organisations put a tag on their websites and apps. The tag sends a hit for every page view and for events the customer defines, such as a sign-up or a video start. Together they send about {{daily_hits}} hits a day. Customers expect today's numbers in their reports within {{report_latency}}, and they expect yesterday's numbers to stop changing. Mobile apps batch hits while offline and can send them up to {{late_window}} later. Bots and monitoring tools also load customers' pages.

**Problem Statement.** Design the collection pipeline from the tag to report-ready data. Cover the collection endpoint and what a hit carries, how a hit is made safe to retry, the buffer and how it is partitioned, validation and enrichment (device and geography from the request, the customer's own processing rules), how visitors and visits are identified and how visits are cut, bot filtering and how its decisions are recorded, hits that arrive late or out of order, what reports read, and the metrics that show the pipeline is complete.

**Constraints.** One customer's data never mixes with another's. A customer's traffic can spike ten times during a campaign. Visitors' consent choices on a site are honoured: hits a visitor did not consent to are not stored. The IP address is used for enrichment and then discarded or truncated. Hits from offline apps arrive up to {{late_window}} late. Any day must be re-processable from raw hits. Restating months of history after a rule change is out of scope here.

**Assumptions.** All volumes, windows and targets are hypothetical; visit and bot rules are this exercise's rules. Each hit carries the customer's tag id, a visitor identifier from the tag, a timestamp from the device, a sequence number within the visit, the page or event, and any consent flags the site set.

**Clarifications.**
- Q: Which time counts, the device's or the server's? | A: Reports use the hit's own time, but device clocks can be wrong. Record both and say how you reconcile them.
- Q: What ends a visit? | A: In this exercise, 30 minutes without a hit, or the end of the day in the customer's report time zone.
- Q: How are bots identified? | A: From known bot user agents and lists you are given, plus behaviour rules you design. Filtered hits are kept apart, not deleted.
- Q: Can a customer change processing rules? | A: Yes, but in this question a rule change applies from the moment it is made. Restating history is a separate problem.
- Q: How late is too late? | A: A hit older than {{late_window}} is stored but not added to finished days.

**Hints.**
1. Give every hit an identity from the tag (visitor, visit and sequence number) so a retried request can be recognised later, not just at the edge.
2. Partition by customer for isolation, but think about what one customer's campaign does to its partitions.
3. Keep raw, real-time and finished views separate: real-time numbers can be approximate and revised; a finished day changes only through an explicit, logged re-run.

**Follow-ups.**
1. A customer's campaign sends ten times their usual traffic for two hours. What happens at each stage, and what do other customers notice?
2. An app releases a batch of hits {{late_window}} late, after the day was finished. Where do they go, what do reports show, and what does the customer see changing?
3. A new bot rule would remove 8% of one customer's page views. How do you test it, roll it out and explain it to the customer?
4. How do you show a customer that every hit their site sent was received and processed, or how many were not?

**Follow-up rules.**
- when: kafka, kinesis, partition key → ask: You partition by customer. One customer's campaign makes one partition ten times hotter. What changes in your key or your consumers?
- when: cookie, visitor id, device id → ask: A visitor clears cookies and blocks third-party storage. What does your visitor count do, and how do you explain that to the customer?
- when: user agent, bot list, ip list → ask: A monitoring tool uses a normal browser's user agent. What behaviour rule would catch it, and how would you measure the rule's mistakes?
- when: watermark, allowed lateness, late data → ask: Your watermark closes the day after {{late_window}}. What do customers see in today's real-time numbers when a large late batch arrives?
- when: dedupe, dedup, idempotent, exactly once → ask: How long do you remember hit identities, and what does that window cost at {{daily_hits}} a day?

**Evaluation Criteria.** A lean collection endpoint that acknowledges after a durable write; hit identity and deduplication beyond the edge; partitioning with per-customer isolation and a plan for hot customers; consent honoured before storage and IP addresses discarded after enrichment; visits cut by a clear rule with late hits handled; bot filtering recorded, reversible and measured; raw, real-time and finished layers with explicit re-runs; completeness metrics a customer can trust; credible answers on campaign spikes, late batches and new bot rules.
