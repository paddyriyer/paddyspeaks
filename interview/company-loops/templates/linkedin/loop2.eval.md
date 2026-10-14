# LinkedIn · Loop 2 — evaluator notes (hidden from candidates)

## LNK-L2-01

**Reference solution**

```python reference
def learning_path(target, courses, known=None):
    have = set(known or ())
    need = sorted(set(target) - have)
    k = len(need)
    bit = {s: 1 << i for i, s in enumerate(need)}
    best_by_mask = {}                    # distinct useful skill masks -> fewest minutes
    for _cid, minutes, skills in courses:
        m = 0
        for s in skills:
            m |= bit.get(s, 0)
        if m and (m not in best_by_mask or minutes < best_by_mask[m]):
            best_by_mask[m] = minutes
    full = (1 << k) - 1
    cover = 0
    for m in best_by_mask:
        cover |= m
    if cover != full:
        return None
    SHIFT = 40                            # key = courses * 2^40 + minutes
    INF = 1 << 62
    dp = [INF] * (full + 1)
    dp[0] = 0
    opts = [(m, (1 << SHIFT) + w) for m, w in best_by_mask.items()]
    for mask in range(full + 1):
        v = dp[mask]
        if v == INF or mask == full:
            continue
        for m, w in opts:
            nm = mask | m
            if nm != mask:
                c = v + w
                if c < dp[nm]:
                    dp[nm] = c
    v = dp[full]
    return (v >> SHIFT, v & ((1 << SHIFT) - 1))
```

**Explanation.** Only the skills still needed matter, so remove `known` and duplicates first and number the rest. Each course becomes a bitmask of the needed skills it teaches; a course with an empty mask can never help and is dropped, and among courses with the same mask only the shortest can be in a best plan. `dp[mask]` is the best `(courses, minutes)` for a plan that teaches at least `mask`, packed into one integer (`courses · 2⁴⁰ + minutes`) so that one comparison orders by courses first and minutes second. Masks are processed in increasing order: every transition `mask → mask | m` goes to a larger mask (or stays put and is skipped), so each state is final when it is read. If the union of all course masks is not the full mask, some needed skill is taught nowhere and the answer is `None`. An empty set of needed skills gives `(0, 0)`.

**Complexity.** O(2ᵏ · u) for k needed skills and u distinct useful course masks (u ≤ n), plus O(n · s) to build the masks. For 16 skills and 80 courses the timing test runs in about 0.5–0.8 s in CPython. Trying combinations of growing size has to reach the minimum plan size, which is at least six courses in the timing tests: C(64, 6) is about 75 million combinations, and a bitmask version of that loop takes minutes. Enumerating all 2ⁿ subsets is hopeless.

**Dialect notes.** In Java, Scala or C++ the same DP uses an `int[]` or `long[]` of size 2ᵏ with packed keys; keep the sentinel far enough below the type's maximum that adding a course's key cannot overflow, or check for the sentinel first. Set cover is NP-hard in general; the DP is exponential only in the number of skills, which is small here. In SQL this is a recursive CTE over bitmasks, which is impractical beyond a few skills. Not executed here.

**Edge cases built into the tests.** One course teaches everything; a greedy trap (the course with the most skills is not in the best plan); a tie on course count broken by minutes; one long course beating three short ones; courses that teach only skills outside the target; an empty target; (Hard) a skill taught nowhere (`None`) and an empty catalogue; (Very Hard) known skills removed, every target skill already known (`(0, 0)`), a target skill listed twice, and a known skill outside the target.

**Common mistakes.** Greedy set cover (take the course with the most missing skills); minimising minutes first instead of courses; forgetting to remove known skills, or building masks over the full target so the DP is larger than needed; returning `None` instead of `(0, 0)` when nothing is left; counting a duplicated target skill twice; `float('inf')` sentinels; iterating combinations of courses.

**Follow-up guidance.** (1) Store the predecessor mask and course with each state, and reconstruct; for a deterministic plan on ties, compare the sorted course-id tuple as a third key. (2) Prerequisites make the order matter and the problem a covering problem with precedence. The DP state can carry the set of courses taken only when the catalogue is tiny; otherwise add each prerequisite's skills as implied requirements, or use an integer programme. (3) Weeks under a budget is bin packing on top of set cover: the state needs the minutes used in the current week, or a two-level DP; candidates should name why the objective is no longer additive. (4) Use greedy with a known log-factor bound, LP relaxation with rounding, or an ILP solver with a time limit; measure the gap with the LP lower bound, or against the exact DP on sampled small targets.

**Rubric anchors.** 2: greedy or combinations that pass only small cases, or the tie rule or `None`/`(0, 0)` wrong. 3: all tests pass with a subset DP over the needed skills. 4: also collapses duplicate masks, packs or compares the pair cleanly, explains why greedy fails with a concrete case, and answers the prerequisite and large-target follow-ups credibly.

**Strong signals.** Asks how many skills a member can ask for before choosing an approach; states the 2ᵏ · n bound up front; removes known skills before numbering. **Red flags.** Defending greedy as "good enough" with no counterexample considered; suggesting the system infer skills the member did not list.

## LNK-L2-02

**Reference solution**

```python reference
from bisect import bisect_left, bisect_right


def former_colleagues(positions, min_days, today, opted_out=None):
    skip = set(opted_out or ())
    stints = {}                              # (member, company) -> [start, end]
    for member, company, start, end in positions:
        if member in skip:
            continue
        if end is None:
            end = today
        s = stints.get((member, company))
        if s is None:
            stints[(member, company)] = [start, end]
        else:                                # a promotion: same stint, wider span
            if start < s[0]:
                s[0] = start
            if end > s[1]:
                s[1] = end
    out = {}
    by_company = {}
    for (member, company), (start, end) in stints.items():
        out.setdefault(member, {})[company] = 0
        if end - start + 1 >= min_days:      # shorter stints can never qualify
            by_company.setdefault(company, []).append((member, start, end - min_days + 1))
    # Overlap >= D  <=>  the shrunken intervals [start, end - D + 1] intersect.
    for company, rows in by_company.items():
        lo = sorted(a for _, a, _ in rows)
        hi = sorted(b for _, _, b in rows)
        for member, a, b in rows:
            out[member][company] = bisect_right(lo, b) - bisect_left(hi, a) - 1
    return out
```

**Explanation.** First merge each member's positions at a company into one stint `[min start, max end]` (a current position ends `today`), skipping opted-out members entirely. Every remaining member gets an entry with 0 for each of their companies. Overlap of two inclusive intervals is `min(e₁, e₂) − max(s₁, s₂) + 1`, and overlap ≥ D is the same as all four of `e₁ − s₁`, `e₂ − s₂`, `e₁ − s₂` and `e₂ − s₁` being at least D − 1. The first two say both stints last at least D days; a shorter stint never qualifies. For the others, the remaining two say that the shrunken intervals `[s, e − D + 1]` intersect. Two intervals intersect when one starts at or before the other's end and ends at or after the other's start. For stint i with shrunken `[a, b]`, the stints that start at or before `b` include every intersecting one plus those that end before `a`, and every interval ending before `a` also starts before `b`. So the count is `#(starts ≤ b) − #(ends < a) − 1` (minus itself), found with two sorted arrays and `bisect`.

**Complexity.** O(n log n) for sorting and one pair of binary searches per stint; O(n) memory. The timing tests (60 000–80 000 positions, about 45% at one company, stints of months to years) run in well under a second in CPython. Comparing every pair at the large company is about 10⁸–10⁹ pair checks; a sweep that sorts by start and stops at the first later start still visits every stint open at the same time (thousands), and takes minutes.

**Dialect notes.** A Fenwick tree over compressed coordinates is the general tool for 2-D dominance counting and is accepted; the shrink trick reduces this problem to two 1-D counts. In SQL the same count is `COUNT(*) FILTER (WHERE …)` in a self-join on company with the two inequalities, which is quadratic per company unless the engine uses a range join; a window approach counts starts ≤ b and ends < a with two ranked lists. In Spark, partition by company and handle the skewed large company by splitting the sorted arrays. Not executed here.

**Edge cases built into the tests.** Overlap of exactly `min_days` (counts) and `min_days − 1` (does not); single-day inclusive arithmetic; the same dates at different companies; a stint nested inside a longer one and one a day too short; colleagues counted at two companies; a member alone at a company (0); an empty input (`{}`); (Hard) two promotions that only together overlap enough, a colleague with two positions counted once, current positions running until `today`; (Very Hard) opted-out members neither counted nor listed, an opt-out for someone with no positions, and everyone opted out.

**Common mistakes.** Counting positions instead of stints, so promotions count a colleague twice or miss a combined overlap; an off-by-one in the inclusive overlap; forgetting `today` for current positions; counting the member themself; leaving out members or companies with 0; listing opted-out members with zeros; all-pairs or sweep solutions that time out.

**Follow-up guidance.** (1) A name may appear only if the colleague's own visibility settings allow the viewer to see that position, evaluated for this viewer; otherwise the count includes them only if the product's rule allows counting hidden members at all, and many designs exclude them. Candidates should treat visibility as the colleague's choice, not the viewer's. (2) Distinct counting across several stints: count per stint, then subtract pairs counted twice, or switch to producing candidate pairs for small companies and the counting trick only where each member has one stint; a strong candidate notes the cost of exact distinct counts and proposes a defensible rule. (3) Recompute per company when any of its positions change, or maintain sorted structures per company (a Fenwick tree over day buckets) and update counts incrementally; batch daily for large companies. (4) Choose a convention (first day of the start month, last day of the end month), state it to the member, and note that it can turn a short overlap into a qualifying one.

**Rubric anchors.** 2: all-pairs or position-level counting; boundary or promotion tests fail. 3: all tests pass with an O(n log n) method. 4: also derives the shrink argument (or a Fenwick-tree dominance count) cleanly, explains why merging is needed with an example, and handles visibility and returning employees with care for members' choices.

**Strong signals.** Writes the four inequalities before coding; asks about promotions and current positions; asks whose visibility setting applies. **Red flags.** Proposing to show colleagues' names regardless of their settings; inferring that two members know each other from overlap and acting on it without the members' say.

## LNK-L2-03

**Reference solution** (the fixed report)

```python reference
from datetime import date, timedelta

EPOCH = date(1970, 1, 1)


def creator_report(creator, offset_min, posts, events, deleted):
    deleted = set(deleted)
    rows = {}                                   # (day, post) -> [views, unique, reactions]
    seen = set()                                # (day, post, member) for unique viewers
    for ev in events:
        member = ev["member"]
        if member in deleted or member == creator:          # deletion honoured everywhere
            continue
        base = ev["post"].split("#")[0]                       # an edit keeps the post's identity
        post = posts.get(base)
        if post is None:
            continue
        original = post["reshare_of"] or base                 # a reshare is credited to the original
        if posts[original]["author"] != creator:
            continue
        day = (EPOCH + timedelta(days=(ev["ts"] + offset_min * 60) // 86400)).isoformat()
        row = rows.setdefault((day, original), [0, 0, 0])
        if ev["type"] == "view":
            row[0] += 1
            if (day, original, member) not in seen:         # unique per post and local day
                seen.add((day, original, member))
                row[1] += 1
        elif ev["type"] == "react":
            row[2] += 1
    return [[day, post, v, u, r] for (day, post), (v, u, r) in sorted(rows.items())]
```

**The planted bugs, their symptoms and their fixes.**
1. **The edit suffix survives into the row key.** The code looks the post up by its base id but keys the row by the raw id (`post["reshare_of"] or ev["post"]`). Symptom: an edited post appears as `p-1041` and `p-1041#v2`, with its views split between them. Fix: key by the base id.
2. **Authorship is checked on the reshare, not the original.** `post["author"] != creator` runs before the reshare is resolved. Symptom: views of other members' reshares of the creator's post disappear, and a creator who reshared someone else's post sees that post in their own report. Fix: resolve `reshare_of` first and check the original's author.
3. **Deleted accounts removed from unique viewers only.** Their views and reactions still count, and a row can exist only because of them. Symptom: deletion is not honoured in totals. Fix: drop the event before any counting.
4. **The offset is subtracted.** `ts - offset_min * 60` moves events the wrong way. Symptom: at UTC+05:30 a view at 20:00 UTC lands on the same UTC date instead of the next local date; at UTC−05:00 a view at 03:00 UTC lands on the wrong day. Fix: add the offset. Python's `//` floors, so negative offsets need nothing extra.
5. **Unique viewers per post, not per post and day.** `seen` is keyed by `(post, member)`. Symptom: a reader who comes back the next day is never counted again. Fix: key by `(day, post, member)`.

Each bug has its own check: an edited post, reshares in both directions, a deleted account, two offset checks, and a returning viewer. Fixing any four leaves exactly the remaining bug's checks failing. The checks for the creator's own views and for a reactions-only row pass on the original code, and protect against over-correction.

**Explanation.** The report is a small pipeline per event: normalise the id (strip the edit), resolve attribution (reshare to original), filter (author, deletions, the creator's own events), bucket (local day), then count, with distinct viewers per post and day. Each step has to happen before the one after it; the bugs are all steps done in the wrong order or with the wrong key.

**Complexity.** O(n log r) for n events and r output rows (linear counting plus sorting the rows); O(r + distinct viewer-days) memory. The timing test is 200 000 events.

**Dialect notes.** In SQL: `split_part(post_id, '#', 1)` (PostgreSQL) or `SPLIT(post_id, '#')[OFFSET(0)]` (BigQuery) for the base id; a join to posts with `COALESCE(reshare_of, base_id)`; `(to_timestamp(ts) + offset_min * interval '1 minute')::date` for the local day; `COUNT(DISTINCT member) FILTER (WHERE type = 'view')`; and an anti-join on deleted members. Approximate distinct counts (HyperLogLog sketches) are what large systems use for unique viewers. Not executed here.

**Edge cases built into the tests.** Edits with `#v2` and `#v3`; another member's reshare; the creator's own reshare of another member's post; a deleted viewer's view and reaction; a positive half-hour offset and a negative offset across midnight; a viewer returning the next day; the creator's own views; a reactions-only row; an edited reshare.

**Common mistakes.** Fixing the author check by also accepting reshares authored by the creator (which keeps the second symptom); filtering deleted members in `views` but not `reactions`; using `rstrip` or a regex on the id that also eats digits of the base id; subtracting the offset for negative zones "to be symmetric"; rewriting the report rather than making minimal fixes; changing the output order.

**Follow-up guidance.** (1) Aggregate by `(creator, local day, original post)` with the creator's offset joined in, in one pass over the day's events plus the reshare map; the key must be the original post. (2) Recompute affected days for the posts the member viewed: store events by day so recomputation is bounded, and publish revised numbers with a note; aggregates that cannot be recomputed (sketches) need a design that allows deletion, such as recomputing from raw events within retention. (3) Past days keep the offset they were reported in, or are recomputed and labelled; either is acceptable if explained to the creator. (4) Weekly reach needs distinct counts over the week: keep per-day sketches that merge (HyperLogLog) or per-week sets with a retention limit; never sum daily uniques.

**Rubric anchors.** 2: finds two or three bugs; several checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also states the processing order explicitly, adds a regression test per bug, and answers the deletion and weekly-reach follow-ups with concrete recomputation and sketch choices.

**Strong signals.** Reproduces each complaint with a two-event case before editing; notices that the second reshare symptom (seeing someone else's post) comes from the same line. **Red flags.** Keeping deleted members' events "because the totals were already published"; proposing to show creators who viewed their posts beyond what the product's own viewer rules allow.

## LNK-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Saved-search store and index.** Saved searches are rows `(search_id, member_id, filters, cadence, channel, created_at, active)` in a key-value store, plus an inverted index from each search's most selective required field to search ids: normalised title, location (or "remote"), company. A search with a title and a location is indexed under one key (for example `title|location`), so a posting with title T in city C looks up `T|C`, `T|remote` and the company key, and gets a small candidate set. Remaining filters (seniority, salary floor, keywords) are checked on the candidates. Searches with no selective field go into a small "broad" bucket evaluated by a separate, batched path.
- **Matching.** New, edited and closed postings arrive as events. A stream processor partitioned by posting id looks up candidates, checks filters, calls the given scoring function, and emits `(member_id, posting_id, search_id, score, matched_at)` to a match topic partitioned by member id. Postings that match a very large share of searches are expanded in batches with back-pressure.
- **Per-member queues and scheduler.** A consumer keyed by member keeps pending matches per member (deduplicated by posting id). At each member's send time (instant, daily or weekly cadence, outside quiet hours), it reads the member's current notification settings and unsubscribes, revalidates every pending posting (still open, still matching after edits, not already alerted), ranks by score, applies the cap ({{cap}}), and sends.
- **Delivery and idempotency.** An `alerted(member_id, posting_id)` table is the source of truth, written in the same transaction as the outbox record for the message; the sender reads the outbox and uses the message id as an idempotency key with the email or push provider. Retention of `alerted` is at least the posting's lifetime.
- **Measurement.** A small random holdout of matches (for example 5%, by hash of member and posting) is recorded but not sent. Applications within {{attribution_window}} of the alert, or of the would-be alert time for held-out matches, are compared between groups, by cadence and channel, as aggregates with confidence intervals. The difference is the alert's effect; raw "alerted members apply 3× more" is selection.

**Competing designs to accept.** Batch matching every hour with a join of new postings to searches on the indexed keys (simpler, less fresh; accept if the cadence is digest-first); a search engine with percolator-style stored queries for matching; per-member pull at send time ("run my saved searches against postings since my last alert") for digest cadences, which avoids fan-out but costs one query per member per period. Each is fine with the trade-off explained.

**Bottlenecks and failure modes.** Fan-out from broad postings; hot member queues for members with many searches; caps enforced at match time (then settings changed later are ignored); duplicate sends after crashes; sending alerts for closed postings; measurement confounded by selection; inactive searches costing most of the matching work.

**Incident guidance.**
- *30 000 near-identical postings in ten minutes*: matching fan-out explodes. Collapse near-duplicates from one employer into one alert candidate per member (keyed by employer and normalised title), rate-limit the employer's postings in the matcher, and rely on per-member deduplication and caps so each member hears once. Watch match-topic lag; other employers' postings should keep flowing on their partitions.
- *Delivery worker crashes after sending, before recording*: with an outbox written before sending and provider idempotency keys, the restart resends with the same keys and the provider drops duplicates; without them, members get duplicates. Reconcile with the provider's delivery log, and fix by recording the intent first.
- *A posting closes after matching, while queued for members who get at most {{cap}}*: revalidation at send time drops it from every pending queue; nothing is sent. If digests were already rendered, re-render or skip the item, and track "closed before send" as a metric.

**Follow-up guidance.** (1) The posting's candidate set is huge; the matcher expands it in batches, member queues absorb it, caps limit what is sent, and ranking decides whether this posting makes each member's cut. (2) Re-match edited postings; searches that now match get new candidates; searches that no longer match drop the pending item; the digest shows the current salary. (3) `alerted(member, posting)` checked at send time across channels, written with the outbox. (4) Selection: members with saved searches are active job seekers. Report the holdout difference (incremental applications per thousand alerts). (5) Pause alerts for long-inactive searches after notifying the member, measure re-engagement on a holdout first, and stop matching paused searches.

**Rubric anchors.** 2: scans all searches per posting; caps at match time; no deduplication or measurement design. 3: inverted index on selective fields, matching separated from delivery, per-member queues with caps and settings at send time, idempotent sends, revalidation of closed postings. 4: also handles broad-posting fan-out, measures with a holdout reported as aggregates, and gives a specific plan for each incident.

**Strong signals.** Asks which filters are required versus optional before choosing the index key; brings up the holdout unprompted. **Red flags.** Inferring job-seeking status for members who did not save a search; reporting individual members' applications to anyone; "send everything and let the member unsubscribe".

## LNK-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** The player sends `(learner_id, device_id, video_id, session_id, seq, watched_intervals, position, event_time, licence_context)` in batches; the server adds `received_time`. A batch is identified by `(device_id, session_id, seq)`, so retries are recognised and dropped. Events land immutably in an append-only log.
- **Merged progress.** Per learner and video, the state is the union of watched intervals (a sorted list of disjoint intervals) plus the resume position from the session with the latest `event_time`, tie-broken by device and sequence. Union is commutative, associative and idempotent, so late, duplicate and out-of-order uploads converge to the same state. Watched share is the union length over the video's length. Device clock skew affects only the resume choice, which is bounded by rejecting event times far in the future relative to `received_time`.
- **Completion and certificates.** A completion evaluator runs when a learner's merged state changes, checks the completion rule (the learner {{completion_rule}}), and writes `completion(learner_id, course_id, completed_at)` with a unique key; the certificate is issued from that row by an idempotent job (the unique key makes concurrent runs harmless). Certificates are never revoked by late events; a later correction is a separate, audited decision with the learner told.
- **Licence context.** At ingestion each event is tagged with the licence it happened under (from the learner's active licence assignment for that course), so employer reports select by licence id and never infer. Personal-interest learning carries no employer licence.
- **Employer reports.** Built from licence-tagged state only: seats used, courses started and completed, pass/fail and dates where the licence terms allow. Reports for {{employer_seats}} seats are per licence; after the licence ends, identities follow the licence terms and deletion requests, and aggregates for the licence period may remain.
- **Learner view.** "Continue where you left off" reads the merged resume position; progress bars read watched share. Both are the learner's own data.
- **Deletion and licence end.** A deletion request removes the learner's events, merged state, completions and report rows (with recomputation of aggregates or suppression under a minimum group size), and is logged as done. Licence end stops new events being tagged to the licence at the cut-off, and reports generated after it reflect the terms.

**Competing designs to accept.** Storing raw intervals and computing progress on read for small scales; a streaming state store keyed by `(learner, video)` with periodic compaction to a table; keeping only furthest-position plus a watched bitmap of fixed-length segments (for example 5-second buckets), which is compact and also idempotent. Accept any where merges are order-independent and licence context is explicit.

**Bottlenecks and failure modes.** Last-write-wins by upload time sending learners backwards; max-position marking skipped videos as watched; interval lists that grow without compaction; double certificates from concurrent evaluators; employer reports that include personal learning because context was inferred at report time; deletion that misses derived aggregates.

**Incident guidance.**
- *A week of held offline progress arrives in a day, out of order*: the merge is order-independent, so state converges; the risk is load. Scale the consumers, process by learner partition, and expect a burst of completions and certificates, which must be idempotent. Monitor upload lag by app version.
- *A licence for {{employer_seats}} seats ends at midnight and the admin exports at 00:05*: the report must reflect the licence's end rules. Events after the cut-off are not tagged to the licence; the export shows the licence period. Make the cut-off time explicit (time zone) and log what the export contained.
- *Double-counted seconds marked 4% of learners complete wrongly*: with intervals, double counting cannot happen; with counters it can. Fix the computation, recompute completions from merged state, and decide with the product and legal owners what happens to certificates already issued; the learner is told plainly, and employer reports are corrected with a note.

**Follow-up guidance.** (1) Union of intervals: the learner's progress only grows; resume follows the latest session by event time, so the laptop's later session keeps the resume point. (2) Do not silently revoke; flag, recompute, and follow a documented correction policy with the learner informed. (3) Show "not started" for assigned learners under the licence, and nothing about personal learning or quiz answers beyond the terms. (4) Delete raw events, merged state and report rows, recompute aggregates, and keep a deletion log; certificates the learner shared publicly are removed from the profile. (5) Compact interval lists (merge adjacent intervals, cap fragmentation), or switch to fixed-length segment bitmaps per video.

**Rubric anchors.** 2: last-write-wins progress; furthest position as watched; licence inferred at report time. 3: idempotent uploads, interval union merge, resume by event time, exactly-once certificates, licence-tagged reports. 4: also handles clock skew, deletion through every output, licence-end semantics, compaction at scale, and a clear plan for each incident.

**Strong signals.** Separates "where to resume" from "what was watched" immediately; asks what the licence terms allow the employer to see. **Red flags.** Giving employers all of a learner's activity on the account; treating deletion as a flag that reports ignore.
