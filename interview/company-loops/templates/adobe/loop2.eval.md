# Adobe · Loop 2 — evaluator notes (hidden from candidates)

## ADB-L2-01

**Reference solution**

```python reference
def version_diff(old, new, max_edits=None):
    n, m = len(old), len(new)
    # A common start and end need no edits; trimming them is optional but cheap.
    lo = 0
    while lo < n and lo < m and old[lo] == new[lo]:
        lo += 1
    hi_o, hi_n = n, m
    while hi_o > lo and hi_n > lo and old[hi_o - 1] == new[hi_n - 1]:
        hi_o -= 1
        hi_n -= 1
    a, b = old[lo:hi_o], new[lo:hi_n]
    n, m = len(a), len(b)
    limit = n + m if max_edits is None else min(max_edits, n + m)
    off = limit + 1
    v = [0] * (2 * limit + 3)      # v[off + k]: furthest x reached on diagonal k = x - y
    for d in range(limit + 1):
        for k in range(-d, d + 1, 2):
            if k == -d or (k != d and v[off + k - 1] < v[off + k + 1]):
                x = v[off + k + 1]          # step down: insert b[y]
            else:
                x = v[off + k - 1] + 1      # step right: delete a[x]
            y = x - k
            while x < n and y < m and a[x] == b[y]:
                x += 1                      # follow the snake of equal paragraphs
                y += 1
            v[off + k] = x
            if x >= n and y >= m:
                return ((d + n - m) // 2, (d - n + m) // 2)
    return None
```

**Explanation.** This is Myers' greedy algorithm (1986) for the shortest edit script with insertions and deletions only. In the edit graph, x indexes `old` and y indexes `new`. A right step deletes, a down step inserts, and a diagonal step over equal paragraphs is free. For each number of edits d, `v[k]` holds the furthest x that any path with d edits reaches on diagonal k = x − y. Keeping only the furthest point is safe: from a point further along the same diagonal you can do everything a nearer point can, since the remaining sub-problem is a suffix of it. A d-edit path ends on a diagonal from −d to d with the parity of d. Each round extends every diagonal by one edit from its better neighbour, then follows free diagonal steps (the "snake") as far as they go. The first d whose path reaches (n, m) is the minimum D, and `deleted = (D + n − m) / 2`, `inserted = (D − n + m) / 2`, which equal `n − LCS` and `m − LCS`. With a cap, the loop simply stops after `max_edits` rounds and returns `None`. Trimming the common start and end is a standard speed-up and does not change the answer.

**Complexity.** O((n + m) · D) time in the worst case and O(n + m) memory (only the current `v`). On the timing test (30 000 paragraphs, about 80 edit sites spread through the document, so D ≈ 100 to 110) it does O(n + D²) work in practice because the hashes are mostly distinct, and it runs in about 0.01 s in CPython. The full LCS table is 9 × 10⁸ cells: extrapolated from measured runs at 1 500 and 3 000 paragraphs, about 110 s in CPython, and the table alone would not fit in memory if kept whole. A banded DP that only fills cells within D of the diagonal is also O((n + m) · D) but always fills the whole band; at this size it is several seconds in CPython and may miss the limit. Accept it in discussion as a correct output-sensitive idea. Hunt–Szymanski, which is fast when few pairs of paragraphs match, also passes here and is acceptable with a stated complexity.

**Dialect notes.** In Java or C++ the same loop uses an `int[]` of size 2·limit + 3; the GNU diff and git default diff are Myers variants with heuristics that may give up minimality on huge inputs. `difflib.SequenceMatcher` in Python is not a minimal edit-distance algorithm. In SQL, a minimal diff is impractical; a warehouse would compare versions by joining on paragraph id, which only works if paragraphs have stable ids. Not executed here.

**Edge cases built into the tests.** Identical versions; both empty; old empty; new empty; one rewritten paragraph; one moved paragraph; swapped neighbours; a reversed order; a common run that is not at the start; (Hard) repeated empty-paragraph hashes that must align correctly and a whole section moved; (Very Hard) exactly `max_edits`, one over the cap, a cap of 0 on identical and on different versions, and a cap larger than both versions.

**Common mistakes.** Counting a rewritten paragraph as one edit (that is Levenshtein with substitutions, a different metric); returning `None` when the edits equal the cap; using `difflib` and assuming minimality; positional comparison (`old[i] != new[i]`), which counts every paragraph after an insertion as changed; building the n × m table; assuming hashes are unique when the replay says they repeat; off-by-one in the diagonal offset when `max_edits` is 0.

**Follow-up guidance.** (1) Store `v` for every round (O(D²) memory, fine for small D) and backtrack, or use Myers' linear-space divide-and-conquer that finds the middle snake and recurses. (2) After the diff, match deleted and inserted paragraphs by hash: equal hashes in the two lists are moves; show them as moved with a link. Patience or histogram diff, which anchor on unique lines, also give more readable results. (3) Run a word-level diff within paired changed paragraphs, and fall back to "rewritten" when the word-level D exceeds a fraction of the length, using the same cap idea. (4) A three-way merge diffs each side against the common base; non-overlapping changes apply automatically, and overlapping ones go to the author as a conflict.

**Rubric anchors.** 2: a correct but O(n · m) DP, or positional comparison; the timing test fails. 3: Myers or another output-sensitive algorithm, all tests pass, complexity stated. 4: also explains why the furthest point per diagonal suffices, handles the cap cleanly as an early exit, and gives credible answers on recovering the script in linear space and on moves.

**Strong signals.** Asks whether moves count as one edit; estimates the n × m table before coding; notes that trimming the common start and end does not help when edits are spread out. **Red flags.** Insisting difflib is minimal; counting substitutions; ignoring memory.

## ADB-L2-02

**Reference solution**

```python reference
def break_lines(widths, line_width, space, forced):
    n = len(widths)
    for w in widths:
        if w > line_width:
            return None
    hard = set(forced)
    best = [0] * (n + 1)        # best[i]: least cost to lay out words i..n-1
    nxt = [n] * (n + 1)         # start of the line after the one that starts at i
    for i in range(n - 1, -1, -1):
        length = -space
        bc = -1
        bj = n
        j = i
        while j < n:
            length += space + widths[j]
            if length > line_width:
                break                           # no longer line can fit either
            if j == n - 1 or j in hard:
                c = best[j + 1]                 # a last line, or one ended by a forced break, is free
            else:
                s = line_width - length
                c = s * s + best[j + 1]
            if bc < 0 or c < bc:                # strict: on a tie keep the earlier break
                bc, bj = c, j + 1
            if j in hard:
                break                           # no line runs past a forced break
            j += 1
        best[i], nxt[i] = bc, bj
    starts = []
    i = 0
    while i < n:
        starts.append(i)
        i = nxt[i]
    return (best[0], starts)
```

**Explanation.** `best[i]` is the least cost of laying out words `i` to the end. The line starting at `i` ends at some `j`; its cost is the squared slack, or 0 if it is the last line (or, at Very Hard, ends at a forced break), plus `best[j + 1]`. Because widths and spaces are positive, the line's width only grows with `j`, so once it no longer fits the loop stops: that bounds the inner loop by the number of words that fit on a line. Filling from the end and keeping the earliest `j` on a strict tie gives the lexicographically smallest `starts` list: every candidate from `i` begins with `i`, then the next start `j` decides the comparison, and among equal `j` the rest is `best[j + 1]`'s own smallest list. (A proper prefix never ties: if the remaining words fit on one free line, any extra break adds a line with positive slack.) A word wider than the line makes every layout illegal, so the answer is `None`. Iteration rather than recursion avoids Python's recursion limit on 80 000 words.

**Complexity.** O(n · w) time, where w is the most words on a line, and O(n) memory. The timing test (80 000 words of 2 to 12 units, a 72-unit line, about 9 words a line) runs in about 0.25 s in CPython. Trying every later word as a line end, even with prefix sums for the widths, is O(n²): measured at about 1 s for 4 000 words and 4.2 s for 8 000, so about 7 minutes at 80 000.

**Dialect notes.** In Java or C++ the same loop uses `long` costs (a 1 000-unit line squared is 10⁶ per line, and a long paragraph adds many lines). TeX's Knuth–Plass algorithm uses the same DP idea over feasible breakpoints, with badness, penalties and demerits instead of squared slack. Not executed here.

**Edge cases built into the tests.** An empty paragraph; everything on one free line; a word exactly as wide as the line; a line that fills exactly; a paragraph where first-fit is not optimal; one where the free last line changes the layout; (Hard) wider spaces, a tie broken by the smaller `starts` list, every word on its own line; (Very Hard) a word wider than the line (`None`), a forced break after the first word, a forced break after the last word, and two forced breaks.

**Common mistakes.** Greedy first-fit; charging the last line; counting a space after the last word of a line; an inner loop that `continue`s instead of `break`s when the line is too long (correct, quadratic); recursion that hits the recursion limit; returning the break after each line (`j`) instead of the start of each line; a tie rule implemented with `<=`, which keeps the later break; letting a line run past a forced break.

**Follow-up guidance.** (1) Carry the previous line's tightness class in the state (a few classes, as Knuth–Plass does), multiplying states by a small constant. (2) Recompute from the paragraph that changed; a layout from that paragraph onward stops changing once a line break coincides with the old layout at a point where the downstream state is the same, so relayout can stop there (paragraph-level independence makes this easy unless pages and columns interact). (3) Hyphenation points become extra candidate break positions inside words, with a fixed penalty added to the line cost. (4) The cost of a line as a function of its start and end has the Monge (quadrangle) property for convex functions of slack, which SMAWK or the Hirschberg–Larmore approach exploits for O(n) or O(n log n); squared slack is convex, but the infeasible-width cutoff needs care.

**Rubric anchors.** 2: greedy, or a correct DP that is O(n²) or recursive and fails the large test. 3: correct DP with the bounded inner loop, the tie rule and the special cases; all tests pass. 4: also proves the tie rule and the early break, avoids recursion deliberately, and gives a credible answer on incremental relayout or richer costs.

**Strong signals.** Asks whether the last line counts and how spaces are measured before coding; writes the counterexample to greedy unprompted. **Red flags.** "Greedy is how word processors do it" with no cost argument; floats for an integer cost.

## ADB-L2-03

**Reference solution** (the fixed report)

```python reference
from datetime import datetime, timezone


def _month(ts):
    # The month is the UTC calendar month of the event, not the local date in the string.
    return datetime.fromisoformat(ts).astimezone(timezone.utc).strftime("%Y-%m")


def font_usage_report(events):
    report = {}
    for ev in events:
        if ev["type"] != "activate":
            continue                                   # deactivations are never counted
        family, style = ev["font"].split("/", 1)
        style = style.split("@", 1)[0]                 # a variable-font instance is its style
        row = report.setdefault(_month(ev["ts"]), {}).setdefault(family, {
            "desktop_activations": 0,
            "desktop_accounts": set(),
            "styles": set(),
            "web_projects": set(),
        })
        if ev["surface"] == "web":
            row["web_projects"].add(ev["project"])
        else:
            row["desktop_activations"] += 1            # desktop only
            row["desktop_accounts"].add(ev["account"])  # per family, not per style
        row["styles"].add(style)
    return {
        month: {
            family: {
                "desktop_activations": row["desktop_activations"],
                "desktop_accounts": len(row["desktop_accounts"]),
                "styles": len(row["styles"]),
                "web_projects": len(row["web_projects"]),
            }
            for family, row in families.items()
        }
        for month, families in report.items()
    }
```

**The planted bugs, their symptoms and their fixes.**
1. **Month from the local string.** `ts[:7]` takes the local date. Symptom: activations on the last evening of a month in the Americas, and the first morning of a month east of UTC, land in the wrong month. Fix: parse with the offset and convert to UTC before taking the month.
2. **Variable-font instances kept as styles.** The style keeps `@wght=…,wdth=…`, so each instance is a new style. Symptom: families with variable fonts appear to have hundreds of styles. Fix: take the part before `@`.
3. **Accounts counted per style.** The account set holds `(account, style)`. Symptom: an account that activated Regular and Bold counts twice, so desktop accounts exceed real users. Fix: add the account alone.
4. **Web additions counted as desktop activity.** Desktop counters are updated for every event. Symptom: desktop activations and accounts jump in months with big web launches. Fix: update them only for desktop events.
5. **Deactivations counted.** Nothing checks `type`. Symptom: switching a font off counts as using it, adds a web project when it is removed from one, and creates rows for families nobody activated. Fix: skip non-`activate` events at the top, before the row is created.

Each bug has its own check that fails on it alone: an evening in UTC−05:00 and a morning in UTC+05:30 at month ends (bug 1), two accounts on two instances of one variable style (bug 2), one account with two styles (bug 3), a desktop activation plus a web addition (bug 4), and an activation followed by a deactivation, plus a family that was only deactivated (bug 5). Bugs 2 and 3 interact: with bug 2 still present, one account activating two instances of one variable style is counted as two accounts by bug 3. Fixing bug 3 alone fixes that case; worth asking the candidate to explain.

**Explanation.** A usage report is a set of counters, each with a grain (per month and family), a filter (which event types and surfaces) and a distinctness key (accounts, styles or projects). Every bug here gets one of those three wrong, plus the time-zone rule that decides the month.

**Complexity.** O(n) time and O(distinct keys) memory. The timing test is 200 000 events and runs in about 0.8 s in CPython, mostly in timestamp parsing; caching the month per timestamp string helps when timestamps repeat.

**Dialect notes.** In SQL: `date_trunc('month', ts AT TIME ZONE 'UTC')` in PostgreSQL, `DATE_TRUNC('MONTH', CONVERT_TIMEZONE('UTC', ts))` in Snowflake, `DATE_TRUNC(DATE(ts, 'UTC'), MONTH)` in BigQuery; the distinct counts become `COUNT(DISTINCT account) FILTER (WHERE surface = 'desktop')` in PostgreSQL and `COUNT(DISTINCT IF(surface = 'desktop', account, NULL))` in BigQuery; `split_part(style, '@', 1)` reduces instances. Taking `substr(ts_string, 1, 7)` reproduces bug 1. Not executed here.

**Edge cases built into the tests.** Month-end evening west of UTC; month-start morning east of UTC; two instances of one variable style; one account with two styles; a desktop activation and a web addition; an activation then a deactivation; a family only deactivated; the same style activated twice by one account; two families.

**Common mistakes.** Fixing the month with a fixed offset or the server's local zone; stripping `@…` only for desktop events; filtering deactivations after the row is created, which still leaves empty rows; fixing the desktop counters but also dropping web events from `styles`; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Activity at any point in the month needs state: each (account, font) active interval from activations and deactivations, carried across months from the previous month's open intervals; then count accounts whose interval overlaps the month. (2) Partition by event date, re-run the affected months idempotently (overwrite the month's rows), and accept events up to the lateness window; after that, either restate with a log or report them in the next run with a note. (3) Approximate distinct counts (HyperLogLog) are fine for dashboards and trends; payments to type designers, if they depend on usage, need exact counts or a documented approximation agreed with them. (4) Key families by a stable id, keep a name history with validity dates, and report by id with the name as of the report date; old reports show the name they used.

**Rubric anchors.** 2: finds two or three bugs, some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also states each counter's grain, filter and key, adds a test per bug, notices the interaction between bugs 2 and 3, and answers the active-state and late-event follow-ups concretely.

**Strong signals.** Tries a month-end timestamp in a negative offset first; asks what a "style" is for a variable font. **Red flags.** "Use the local month, the user sees local time" without noticing the report is defined in UTC; deleting deactivation events from storage.

## ADB-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Upload and landing.** Contributors upload through resumable uploads into object storage under an upload id. The service records `(upload_id, contributor_id, content_hash, size, media_type, uploaded_at)`. An exact duplicate (same contributor, same content hash) returns the existing asset instead of creating another. Near-duplicates across contributors are detected later by a perceptual-hash check, not at upload.
- **Asset and state machine.** `assets (asset_id, contributor_id, content_hash, media_type, current_state, current_metadata_version)` plus an append-only `asset_events (asset_id, seq, from_state, to_state, actor, reason_code, metadata_version, at)`. States: uploaded → checks_passed | checks_failed → submitted → in_review → approved | rejected; approved → withdrawn (by the contributor) | taken_down (by the marketplace). Transitions are validated against the allowed graph, and the state column is derived from the events in the same transaction.
- **Checks.** Automated checks (format, resolution, corruption, duplicate) write `check_results (asset_id, check, version, outcome, details, at)`. Technical failures may reject automatically with a reason code; everything else proceeds to human review.
- **Metadata.** `asset_metadata (asset_id, version, title, keywords[], categories, licence_type, edited_by, edited_at)` is versioned; review decisions reference the metadata version they saw. Releases for people or property are stored as documents with their own ids, linked to the asset; analytics read only their status and dates, never their contents.
- **Review queues.** Queues by media type and language, ordered by submission age. Each assignment and decision is an event. Decision time is measured per asset from submitted to decision, against {{review_target}}.
- **Search freshness.** Changes leave the database through a transactional outbox (or CDC) into a log keyed by `asset_id`, so updates for one asset stay in order. An indexer applies them to the search index with the asset's event sequence as the document version, and the index rejects writes older than the version it has. Takedowns and withdrawals are written to the same key and also to a small high-priority topic, so they are applied within {{freshness}} even when the main topic lags; because of versioning, a stale keyword edit can never re-add a taken-down asset. Licensing checks the asset table, not the index, so a takedown stops new licences immediately.
- **Rebuild.** The index is a projection: a full rebuild reads the asset table at a recorded log position, builds a new index, replays the log from that position, and switches an alias atomically.
- **Metrics.** Queue size and age per queue; decisions per hour; share of decisions within {{review_target}}; rejection reasons per category; index lag (event time to searchable) at percentiles, with a separate measure for takedowns; index-to-table disagreement counts from a daily reconciliation.

**Competing designs to accept.** A workflow engine that owns the state machine (accept if transitions and reasons are still recorded as data); a search index updated synchronously from the API (accept for low volume if failures are retried and reconciled); a periodic full reindex plus a fast delta path. Accept any design that keeps the index rebuildable and guarantees takedown ordering.

**Bottlenecks and failure modes.** A current-state column with no history, so rejections cannot be explained; out-of-order updates resurrecting a taken-down asset in search; a reindex that serves a half-built index; review queues dominated by one large contributor's batch; duplicate assets from retried uploads; release documents leaking into analytics.

**Incident guidance.** Not required for Loop 2; use the follow-ups. If the candidate raises incidents, look for: index lag alerts separate for takedowns, reconciliation between the index and the asset table, and a replayable log.

**Follow-up guidance.** (1) Both updates go through the same key with versions; the takedown has a higher version, so the keyword edit, if applied later, is rejected by the version check; the high-priority path only makes it faster. (2) Queue age and arrivals per queue, reviewer throughput, rejection mix; then rebalance queues, cap per-contributor daily submissions, add automated checks for the commonest rejection reasons. (3) Build a new index from a snapshot plus log replay, verify counts and samples, and switch the alias; the old index keeps serving until then. (4) Perceptual hashes with a similarity threshold, a candidate list for reviewers, and a policy decision (for example, the earlier approved asset keeps priority); the second contributor sees a reason code.

**Rubric anchors.** 2: an asset table with a status column and a nightly reindex; no history; takedowns not guaranteed. 3: append-only state transitions with reasons, versioned metadata, an ordered change log into a rebuildable index, and takedowns that cannot be overtaken. 4: also duplicate handling at upload and across contributors, licensing that does not depend on the index, review metrics against the target, and a zero-downtime rebuild.

**Strong signals.** Asks whether a takedown must also stop new licences; uses the event sequence as the index version. **Red flags.** "The search index is the source of truth"; deleting rejected assets with no record.

## ADB-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Collection endpoint.** Stateless edge collectors accept hits over HTTPS (and batched POSTs from apps), validate the tag id against the customer registry, check consent flags (a hit the visitor did not consent to is dropped before storage, and only a count of dropped hits is kept), stamp server receive time, derive device and coarse geography from the request, then discard or truncate the IP address. They write to the buffer and only then return success.
- **Hit identity.** `(tag_id, visitor_id, visit_id, seq)` from the tag, or a client-generated hit id. Retries carry the same identity. Deduplication happens downstream in the stream processor with a keyed state store whose TTL covers the retry horizon plus the late window for app batches, and again when finished days are built.
- **Buffer.** A partitioned log keyed by `(customer, visitor_id)`, so a visitor's hits stay in order and a customer spreads across partitions. Per-customer quotas and an overflow path protect others during a campaign; very large customers have dedicated partitions.
- **Processing.** Apply the customer's processing rules in effect at processing time, record which rule version was applied, map events to the customer's definitions, and sessionise per visitor: a visit ends after 30 minutes without a hit or at the end of the day in the customer's report time zone (this exercise's rule). Device time is used for ordering within a visit; if it disagrees with server time by more than a threshold, server time wins and the hit is flagged.
- **Bot filtering.** Known bot user agents and lists you are given, plus behaviour rules (implausible rates, no rendering events, monitoring patterns). Filtered hits go to a separate table with the rule id and version, never deleted, so customers can see what was removed and a rule can be reversed.
- **Layers.** Raw hits as received (immutable, partitioned by customer and receive date) → a real-time layer updated within {{report_latency}}, approximate and labelled as such → finished days built after the late window of {{late_window}} closes, from raw hits by a deterministic job that overwrites the day's partition. Later arrivals are stored in raw and listed in a late-hits table; adding them to a finished day is an explicit, logged re-run, not a silent change.
- **Isolation.** Customer id is in every key, path and query predicate; reports are served through a service that enforces it.
- **Completeness metrics.** Hits received, accepted, dropped (with reason: invalid tag, no consent, malformed), deduplicated, filtered as bots, processed; per customer and hour; lag per partition; late-hit volume by age. Optional: the tag sends a sequence number per visit, so gaps estimate hits lost between the browser and the collector.

**Competing designs to accept.** A lambda-style design (stream for real-time, batch for finished days) or a kappa design (one stream job with replay for re-runs); a lakehouse table format with MERGE for late hits; sessionisation done in batch only (accept if real-time numbers are clearly labelled as visit-free counts). Accept designs that keep raw immutable and finished days reproducible.

**Bottlenecks and failure modes.** Hot partitions from one customer's campaign; a deduplication store too small for the app late window; storing hits before checking consent; IP addresses persisted; visits split by late hits; bot rules applied silently and irreversibly; finished days that keep changing; device clocks set years off.

**Incident guidance.** Not required for Loop 2; use the follow-ups. If the candidate raises incidents, look for per-customer lag alerts, a dropped-hit breakdown, and a re-run log for finished days.

**Follow-up guidance.** (1) Quotas and overflow at the edge, partitions keyed so the customer spreads; their lag rises, others' does not; real-time numbers for that customer are delayed and labelled. (2) Stored in raw and listed as late; finished days unchanged until an explicit re-run, which the customer sees in a change log with counts; real-time views never double count them. (3) Run the rule in shadow mode, compare filtered volumes and sample hits, review with the customer, then enable from a date with a note; never restate silently. (4) Per-customer completeness: received versus processed with reasons for every difference, and sequence gaps per visit as an estimate of loss before collection.

**Rubric anchors.** 2: a collector writing straight to a warehouse table; no hit identity; bots deleted; late hits appended to finished days. 3: durable buffer before acknowledgement, deduplication on hit identity, per-customer isolation, clear visit rule, bots recorded separately, raw / real-time / finished layers. 4: also consent before storage and IP handling, hot-customer handling, explicit late-hit and re-run policy, and completeness metrics a customer can audit.

**Strong signals.** Asks how long app batches can be delayed before choosing a deduplication window; separates "received" from "counted" in metrics. **Red flags.** Storing full IP addresses "for later"; filtering bots by deleting hits.
