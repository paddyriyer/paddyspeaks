# Palantir · Loop 1 — evaluator notes (hidden from candidates)

## PLT-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH ranked AS (
  SELECT o.object_type, w.object_id, w.value, w.source,
         ROW_NUMBER() OVER (PARTITION BY w.object_id, w.property
                            ORDER BY w.written_at DESC,
                                     (w.source = 'edit') DESC,
                                     w.write_id DESC) AS rn
  FROM property_writes w
  JOIN objects o ON o.object_id = w.object_id
  WHERE w.written_at <= TIMESTAMPTZ '{{as_of}}'
    AND (o.deleted_at IS NULL OR o.deleted_at > TIMESTAMPTZ '{{as_of}}')
), current_values AS (
  SELECT object_type, object_id, source
  FROM ranked
  WHERE rn = 1 AND value IS NOT NULL
)
SELECT object_type,
       COUNT(DISTINCT object_id)                AS objects,
       COUNT(*)                                 AS properties,
       COUNT(*) FILTER (WHERE source = 'edit')  AS edit_held,
       ROUND(COUNT(*) FILTER (WHERE source = 'edit')::numeric / COUNT(*), 4) AS edit_share
FROM current_values
GROUP BY object_type
ORDER BY object_type;
```

**Explanation.** Resolve first, aggregate second. The report-instant filter and the deletion filter go in the WHERE clause, before ranking: a write after the instant does not exist yet and must not win. One `ROW_NUMBER` per (object, property) encodes the whole resolution rule in its ORDER BY: latest `written_at`, then `(source = 'edit') DESC` so the edit wins a same-instant tie, then `write_id DESC` for two writes of one source at one instant. The NULL test comes after ranking: a NULL that wins clears the property, so filtering NULLs out before ranking would bring an older value back. The aggregate counts surviving pairs per type, the edit-held ones with `FILTER`, and the objects with `COUNT(DISTINCT object_id)`, so an object whose every property was cleared disappears from `objects` as well.

**Complexity.** One sort (or hash partition plus sort) of the writes by (object_id, property, written_at) and a small aggregate: O(n log n). In production the resolved current values would be maintained by the indexing job, and this report would read them rather than re-rank history.

**Dialect notes** (described, not executed). BigQuery and Snowflake: `QUALIFY ROW_NUMBER() OVER (...) = 1` replaces the CTE; booleans sort with `false < true` there too, but `IF(source = 'edit', 1, 0) DESC` is clearer; `COUNTIF` / `COUNT_IF` replace `FILTER`. Spark SQL: `row_number()` in a subquery, `count_if`, and `CAST(... AS DECIMAL(10,4))` or `round` for the share. MySQL 8: `ROW_NUMBER()` in a CTE, `SUM(source = 'edit')`, and `ORDER BY source = 'edit' DESC` works because booleans are integers.

**Edge cases built into the data.** An edit and a sync at the same instant after every other write on the property; a sync that overrides an older edit; `write_id` assigned in arrival order, not time order. Hard: NULL writes, including one that wins, one that is later overwritten, two syncs at one instant where the higher `write_id` is the NULL, and an object whose every property is cleared. Very Hard: a report instant inside the data, with a write exactly at it (kept) and an edit just after it (ignored); objects deleted before, exactly at, and after the instant.

**Common mistakes.** "User edits always override" (a later sync must win); ties to the sync; ordering by `write_id`; `MAX(written_at)` joined back, which returns two rows on a tie; filtering NULLs before ranking; counting a cleared property; `RANK()` instead of `ROW_NUMBER()`; applying the report instant after ranking; keeping objects deleted exactly at the instant; integer division.

**Follow-up guidance.** (1) Keep the append-only write log partitioned by date and a resolved "current value" table; for history, either a slowly changing table of (object, property, value, valid_from, valid_to) built from the log, or periodic snapshots plus the log since the snapshot. Point lookups by object need clustering on object_id. (2) Stamping a resend with the resend time makes stale source values look newer than the edits. Carry the source system's own change time (or a snapshot version) and resolve on it, or mark the resend as a replay that cannot override edits newer than its source time; detect it with a sudden spike of syncs that change nothing. (3) A per-property policy table (edit wins, source wins, latest wins) joined into the ranking ORDER BY as a CASE; the report must then also show which policy each type uses. (4) Maintain per-(object, property) winners in a keyed store updated by each write (compare with the stored winner using the same rule), and per-type counters adjusted by the delta: a NULL winner decrements, an edit replacing a sync moves one count across. Late writes that lose change nothing.

**Rubric anchors.** 2: picks a latest write but gets one rule wrong (ties, NULL order, or `write_id` order). 3: matches the expected result. 4: also explains history storage and the resend problem credibly.

**Strong signals.** States the resolution rule back as an ORDER BY before writing anything; asks what a NULL means; notices `write_id` is arrival order. **Red flags.** Treating the rule as how a particular product works; deduplicating with `DISTINCT` on values; dropping NULLs early "to be safe".

## PLT-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH counted AS (                          -- reads of a dataset that was marked at the time
  SELECT r.read_id, r.user_id, r.dataset_id, r.purpose, r.read_at
  FROM reads r
  JOIN datasets d ON d.dataset_id = r.dataset_id
  WHERE d.marking IS NOT NULL
    AND d.marked_since <= r.read_at
), classified AS (                         -- every matching grant that had started by the read
  SELECT c.read_id, c.dataset_id, c.read_at,
         COUNT(g.grant_id)                                     AS started,
         COALESCE(bool_or(c.read_at < LEAST(g.expires_at, g.revoked_at)), false) AS covered,
         MAX(LEAST(g.expires_at, g.revoked_at))                AS last_end
  FROM counted c
  LEFT JOIN grants g
         ON g.user_id = c.user_id
        AND g.dataset_id = c.dataset_id
        AND g.purpose = c.purpose
        AND g.granted_at <= c.read_at
  GROUP BY c.read_id, c.dataset_id, c.read_at
)
SELECT dataset_id,
       date_trunc('month', read_at)::date                       AS read_month,
       COUNT(*)                                                 AS restricted_reads,
       COUNT(*) FILTER (WHERE started > 0 AND NOT covered)      AS after_expiry,
       COUNT(*) FILTER (WHERE started = 0)                      AS never_granted,
       ROUND(MAX(EXTRACT(EPOCH FROM read_at - last_end) / 3600)
             FILTER (WHERE started > 0 AND NOT covered), 1)     AS max_hours_late
FROM classified
GROUP BY dataset_id, date_trunc('month', read_at)::date
ORDER BY dataset_id, read_month;
```

**Explanation.** Three steps. Keep only reads of datasets restricted at the read (`marked_since <= read_at`). LEFT JOIN each read to the grants with the same user, dataset and purpose that had started by the read; the join condition, not the WHERE clause, holds `granted_at <= read_at`, so reads with no started grant survive with NULLs. Per read, `COUNT(g.grant_id)` says whether any matching grant had started, `bool_or(read_at < end)` whether any covers it (half-open, so a read exactly at the end is not covered), and `MAX(end)` is when access last lapsed. `LEAST(expires_at, revoked_at)` is the end: PostgreSQL's `LEAST` ignores NULL arguments, so an unrevoked grant ends at expiry, and a revocation recorded after expiry changes nothing. The classification is then a pair of FILTERs, and the hours late are the maximum over after-expiry reads of the epoch difference divided by 3600.

**Complexity.** The join is per (user, dataset, purpose) and small per read; with an index or sort on (user_id, dataset_id, purpose, granted_at) it is O(R log G) for R reads and G grants. At billions of reads, precompute per (user, dataset, purpose) the merged coverage intervals once, then a sorted interval join (or an as-of join on interval start) classifies each read.

**Dialect notes** (described, not executed). Snowflake and BigQuery: `LEAST` returns NULL if any argument is NULL, so write `LEAST(expires_at, COALESCE(revoked_at, expires_at))`; `BOOLOR_AGG` (Snowflake) or `LOGICAL_OR` (BigQuery) replace `bool_or`; `DATE_TRUNC(DATE(read_at), MONTH)` in BigQuery; `TIMESTAMP_DIFF(..., MINUTE) / 60` for hours. Spark SQL: `least` skips NULLs like PostgreSQL; `bool_or` exists; `date_trunc('MONTH', ...)` returns a timestamp. MySQL 8: `LEAST` returns NULL with a NULL argument; `MAX(read_at < end)` stands in for `bool_or`; `TIMESTAMPDIFF(MINUTE, ...)`.

**Edge cases built into the data.** A read exactly at expiry (after expiry, 0.0 hours late), a read in the gap before a renewal, a read exactly at the renewal's start (covered), an overlapping renewal that covers a read after the first grant expired, a user with two expired grants (hours from the later end), reads either side of a month boundary, a read before the user's first grant (never granted), and reads of an unmarked dataset (not counted). Hard: several purposes, with a grant for the wrong purpose that covers nothing and an older grant of the right purpose that makes a read late rather than never granted. Very Hard: a revocation before expiry, a revocation recorded after expiry, and a dataset marked part-way through the period, with a read exactly at `marked_since`.

**Common mistakes.** `<=` at the end, or BETWEEN; checking only the latest or the first grant; ignoring purpose; `COALESCE(revoked_at, expires_at)`; an INNER JOIN that loses never-granted reads; putting `granted_at <= read_at` in WHERE after a LEFT JOIN (which turns it back into an inner join); measuring hours from the earliest end; counting reads before the marking; months taken from a local time zone.

**Follow-up guidance.** (1) Rank the started matching grants per after-expiry read by end descending (then grant_id) and keep one row per read. (2) Precompute merged coverage intervals per (user, dataset, purpose) whenever grants change; classify each day's new reads against them with a sorted join; late-arriving grants (backdated) mean reprocessing the affected keys, so keep the dry run idempotent per day. (3) A recursive walk of lineage, or a precomputed closure of markings over the dependency graph, decides restriction per dataset and time; marking changes upstream must propagate with their effective times. (4) Show patterns, not individuals: renewals that routinely arrive days late suggest the renewal process, not the readers, needs fixing; agree the definitions with owners before the numbers circulate.

**Rubric anchors.** 2: classifies most reads but loses never-granted reads or treats the end as inclusive. 3: matches the expected result. 4: also explains interval merging for scale and the NULL behaviour of `LEAST` across engines.

**Strong signals.** Draws the timeline of one user's grants before writing SQL; asks whether purpose is part of the match; checks the three categories add up to `restricted_reads`. **Red flags.** Presenting the dry-run numbers as proof of wrongdoing by named people; describing the model as how a real product enforces access.

## PLT-L1-03

**Reference solution** (PostgreSQL)

```sql reference
WITH attempts AS (                         -- voids are not attempts
  SELECT unit_serial, line_id, tested_at, result,
         ROW_NUMBER() OVER (PARTITION BY unit_serial ORDER BY tested_at, test_id)           AS nth,
         ROW_NUMBER() OVER (PARTITION BY unit_serial ORDER BY tested_at DESC, test_id DESC) AS nth_from_end,
         COUNT(*)     OVER (PARTITION BY unit_serial)                                       AS n_attempts
  FROM tests
  WHERE result IN ('pass', 'fail')
), units AS (                              -- one row per unit: its first and last attempt
  SELECT f.line_id,
         f.tested_at AT TIME ZONE '{{tz}}' AS local_ts,
         f.result = 'pass'                  AS first_pass,
         f.n_attempts > 1                   AS retested,
         l.result = 'pass'                  AS final_pass
  FROM attempts f
  JOIN attempts l ON l.unit_serial = f.unit_serial AND l.nth_from_end = 1
  WHERE f.nth = 1
), placed AS (
  SELECT line_id, first_pass, retested, final_pass,
         (local_ts - INTERVAL '6 hours')::date AS shift_date,
         CASE WHEN local_ts::time >= TIME '06:00' AND local_ts::time < TIME '14:00' THEN 'day'
              WHEN local_ts::time >= TIME '14:00' AND local_ts::time < TIME '22:00' THEN 'swing'
              ELSE 'night' END              AS shift
  FROM units
)
SELECT line_id, shift_date, shift,
       COUNT(*)                                  AS units,
       COUNT(*) FILTER (WHERE first_pass)        AS first_pass,
       COUNT(*) FILTER (WHERE retested)          AS retested,
       COUNT(*) FILTER (WHERE final_pass)        AS final_pass,
       ROUND(COUNT(*) FILTER (WHERE first_pass)::numeric / COUNT(*), 4) AS fpy
FROM placed
GROUP BY line_id, shift_date, shift
ORDER BY line_id, shift_date, shift;
```

**Explanation.** Remove voids first, in WHERE, so they never become a first or last attempt. Two `ROW_NUMBER`s per unit, one ascending and one descending on `(tested_at, test_id)`, pick the first and the last attempt, and a window `COUNT` gives the number of attempts; joining the first-attempt row to the last-attempt row gives one row per unit carrying the first attempt's line and time. Shifts are computed on local time: `tested_at AT TIME ZONE 'zone'` turns a timestamptz into the plant's wall-clock timestamp. Every shift starts at 06:00 + k·8 h, so `(local - interval '6 hours')::date` is the shift date of all three shifts, including a night shift after midnight; the shift name comes from the local time of day with half-open ranges. Then count per (line, shift date, shift).

**Complexity.** One sort of the attempts per unit for the window functions and a hash aggregate: O(n log n).

**Dialect notes** (described, not executed). Snowflake: `CONVERT_TIMEZONE('UTC', 'Europe/Berlin', tested_at)`, `DATEADD(hour, -6, local)::date`, `QUALIFY` for first and last, `COUNT_IF`. BigQuery: `DATETIME(tested_at, 'Europe/Berlin')`, `DATE(DATETIME_SUB(local, INTERVAL 6 HOUR))`, `COUNTIF`, and `ARRAY_AGG(... ORDER BY tested_at, test_id LIMIT 1)[OFFSET(0)]` as a first/last alternative. Spark SQL: `from_utc_timestamp(tested_at, 'Europe/Berlin')`, `max_by`/`min_by` over a struct of `(tested_at, test_id)`. MySQL 8: `CONVERT_TZ` needs the time zone tables loaded.

**Edge cases built into the data.** Tests exactly at 06:00:00, 13:59:59 and 22:00:00, at 05:59:59 and shortly after midnight (night of the previous date); a unit that passed and then failed a re-test (first pass, final fail); a retest in a later shift; `test_id` in upload order. Hard: voids before the first attempt, after the last attempt and units with only voids; retests on another line; a fail and a pass with the same `tested_at` decided by `test_id`. Very Hard: the plant's local zone is not UTC, with tests where UTC and local time disagree on the shift or the date.

**Common mistakes.** Calendar date for the night shift; ordering by `test_id`; counting voids as failures or taking a trailing void as the final outcome; `bool_or(result = 'pass')` for the final outcome; counting every test row under its own line and shift; `BETWEEN '06:00' AND '14:00'` (inclusive at both ends); assigning shifts in UTC; `AT TIME ZONE` applied twice, which converts back.

**Follow-up guidance.** (1) Rolled throughput yield multiplies first-pass yields across the stations a unit passes through; it needs the station sequence per unit and first attempts per station, and it is lower than any single station's FPY. (2) A night shift is 7 or 9 hours on a change night; report it with its real length (hours worked, units per hour) rather than forcing 8 hours; local-time arithmetic handles the date correctly if the conversion uses the zone, not a fixed offset. (3) Recompute a rolling window of recent shift dates on each run, mark a shift final after the late-data bound, and publish corrections as versioned restatements. (4) Check for a change in what counts as an attempt (new void codes, a tester that stopped uploading failures), duplicated passes, a line remapping, and the unit volume; a yield jump with a volume drop often means missing data.

**Rubric anchors.** 2: right yield for day shifts but night shifts dated by calendar day, or voids mishandled. 3: matches the expected result. 4: also handles daylight saving changes and late data credibly.

**Strong signals.** Asks which date a night shift belongs to; spots `(local - 6 h)::date`; asks what a void means before writing SQL. **Red flags.** Converting with a fixed offset; ranking individual operators or shifts' people from yield (the data is about lines and shifts).

## PLT-L1-04

**Reference solution**

```python reference
def pipeline_cycles(inputs):
    graph = {}                                   # dataset -> the datasets it reads
    for ds, ins in inputs.items():
        graph.setdefault(ds, []).extend(ins)
        for i in ins:
            graph.setdefault(i, [])
    self_loop = {ds for ds, ins in inputs.items() if ds in ins}
    index, low = {}, {}
    on_stack, stack, groups = set(), [], []
    counter = 0
    for root in graph:                           # iterative Tarjan: no recursion limit
        if root in index:
            continue
        index[root] = low[root] = counter
        counter += 1
        stack.append(root)
        on_stack.add(root)
        work = [(root, iter(graph[root]))]
        while work:
            node, it = work[-1]
            descended = False
            for nxt in it:
                if nxt not in index:
                    index[nxt] = low[nxt] = counter
                    counter += 1
                    stack.append(nxt)
                    on_stack.add(nxt)
                    work.append((nxt, iter(graph[nxt])))
                    descended = True
                    break
                if nxt in on_stack and index[nxt] < low[node]:
                    low[node] = index[nxt]
            if descended:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                if low[node] < low[parent]:
                    low[parent] = low[node]
            if low[node] == index[node]:         # node is the root of a component
                comp = []
                while True:
                    w = stack.pop()
                    on_stack.discard(w)
                    comp.append(w)
                    if w == node:
                        break
                if len(comp) > 1 or node in self_loop:
                    groups.append(sorted(comp))
    groups.sort()
    return groups
```

**Explanation.** The cycle groups are exactly the strongly connected components (SCCs) with more than one dataset, plus single datasets with a self-loop. Tarjan's algorithm finds every SCC in one depth-first pass: each dataset gets a discovery index and a low-link (the smallest index reachable through the search tree plus one back edge to a dataset still on the stack); when a dataset's low-link equals its own index, it is the root of a component, and the stack above it is that component. The search is iterative: a work stack of (dataset, iterator over its inputs) replaces recursion, and when a dataset finishes its low-link is passed up to its parent. Raw sources are added as nodes with no inputs, so they become components of one and are never reported. A self-loop is detected from the declared inputs, because an SCC of size one is only a cycle if the dataset reads itself.

**Complexity.** O(V + E) time and memory. The timing tests (60 000 datasets, about 110 000 inputs, about 10 000 cycles; Very Hard: a 100 000-dataset cycle plus 30 000 others) take about 0.2–0.3 s and 0.65 s in CPython. A search from every dataset (O(V·(V + E))) and the likely middle approach, forward search ∩ backward search from each dataset not yet placed (O(components · (V + E)), and here almost every dataset is its own component), were stopped after 30 s and 40 s on the 60 000-dataset test without finishing. A recursive Tarjan passes the Hard timing test but raises RecursionError on the Very Hard deep tests (a cycle of about 2 500 datasets and the 100 000-dataset cycle) unless the limit is raised; raising it is acceptable only if the candidate can say why it is safe on their Python (3.11+ keeps pure-Python calls off the C stack; older versions can crash).

**Dialect notes.** Kosaraju's algorithm (finish order on the graph, then searches on the reversed graph in reverse finish order) is equally linear and accepted. In Java and C++ the recursion problem is the same (thread stack size); iterative versions are standard. On a cluster, SCCs of a very large graph are computed with forward-backward or coloring algorithms in Spark GraphX/GraphFrames (`stronglyConnectedComponents`), which take many iterations; dataset dependency graphs fit comfortably in one machine's memory. Not executed here.

**Edge cases built into the tests.** No inputs at all; a plain chain; two datasets reading each other with a reader outside; a cycle feeding datasets outside it; two cycles joined one way (two groups); a diamond (no cycle). Hard: self-loops (groups of one), undeclared raw sources and duplicate inputs, two cycles sharing a dataset (one group), and a cycle reached only through a chain. Very Hard: a cycle of about 2 500 datasets and a 2 500-dataset chain ending in a two-dataset cycle, both too deep for a recursive search at Python's default limit.

**Common mistakes.** Reporting every dataset that cannot build (downstream of a cycle) as part of it; union-find over undirected edges; Kahn's algorithm that reports leftovers as one group; missing self-loops or reporting every single dataset; KeyError on raw sources; recursion on deep pipelines; unsorted groups.

**Follow-up guidance.** (1) Build the condensation DAG (one node per component), mark the components that are cycles, and propagate "blocked" downstream with one topological pass: O(V + E). (2) Minimum feedback arc set is NP-hard; in practice show each group with its edges, suggest the edge the owners added most recently or the one whose removal breaks the most cycles, and let owners decide. (3) Adding an edge u → v can only create a cycle if v already reaches u; check with a bounded search (or maintain a topological order incrementally, as in Pearce–Kelly), and recompute fully overnight. (4) Each component is one scheduling unit (cycles are rejected before the build); the DAG between components is scheduled by in-degree with a ready queue across workers, with priority by longest remaining path.

**Rubric anchors.** 2: correct on small graphs but quadratic (a search per dataset) or crashes on deep inputs. 3: all tests pass with a linear, depth-safe algorithm. 4: also explains the condensation DAG and handles at least one follow-up (blocked datasets, incremental checks) concretely.

**Strong signals.** Names SCCs and a linear algorithm early; asks about depth before choosing recursion; treats raw sources explicitly. **Red flags.** Claims Kahn's algorithm finds the groups; "just raise the recursion limit" without understanding the risk.

## PLT-L1-05

**Reference solution**

```python reference
from collections import defaultdict

LEGAL = {"co", "corp", "gmbh", "inc", "limited", "llc", "ltd", "plc"}


def _name(raw):
    chars = [c if ("a" <= c <= "z" or "0" <= c <= "9") else " " for c in raw.lower()]
    words = "".join(chars).split()
    while words and words[-1] in LEGAL:         # only trailing legal-form words
        words.pop()
    return " ".join(words)


def _postcode(raw):
    return (raw or "").upper().replace(" ", "")


def _within_one(a, b, transpositions):
    if a == b:
        return True
    la, lb = len(a), len(b)
    if la == lb:
        diff = [i for i in range(la) if a[i] != b[i]]
        if len(diff) == 1:
            return True                          # one substitution
        return (transpositions and len(diff) == 2 and diff[1] == diff[0] + 1
                and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]])
    if abs(la - lb) != 1:
        return False
    if la > lb:
        a, b = b, a                              # a is the shorter one
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    return a[i:] == b[i + 1:]                    # one insertion into a


def match_suppliers(records, transpositions=False):
    blocks = defaultdict(list)                   # blocking: only same-postcode pairs can match
    for rid, name, postcode in records:
        pc, nm = _postcode(postcode), _name(name)
        if pc and nm:
            blocks[pc].append((rid, nm))
    pairs = []
    for recs in blocks.values():
        for i in range(len(recs)):
            ri, ni = recs[i]
            for j in range(i + 1, len(recs)):
                rj, nj = recs[j]
                if abs(len(ni) - len(nj)) <= 1 and _within_one(ni, nj, transpositions):
                    pairs.append((ri, rj) if ri < rj else (rj, ri))
    pairs.sort()
    return pairs
```

**Explanation.** Normalisation follows the specification literally: lower-case, non-alphanumerics to spaces, split, strip trailing legal-form words in a loop, join with single spaces; postcodes upper-cased with spaces removed. Records with an empty normalised name or postcode are dropped before blocking, since they can never match. Blocking puts records in a dict keyed by the normalised postcode, so only pairs inside one block are compared. The within-one-edit check is linear: equal lengths mean either exactly one differing position (substitution) or, with transpositions, exactly two adjacent differing positions whose characters are swapped; lengths that differ by one mean the shorter equals the longer with one character skipped at the first difference. A cheap length test runs before it.

**Complexity.** O(n·L) to normalise and block, plus O(Σ b²·L) for the pairs inside blocks of sizes b. The timing test (40 000 records, 2 000 postcodes, about 20 per block) takes about 0.35 s in CPython. Comparing every pair (8·10⁸ pairs) did not finish in 40 s. The likely middle approach, blocking correctly but deciding each pair with a full edit-distance table (O(L²) per pair), took about 12.5 s even with a length prefilter, so it fails the 8 s limit: the linear check is the point of the exercise, not a micro-optimisation.

**Dialect notes.** In SQL, blocking is a self-join on the normalised postcode with `a.record_id < b.record_id`; PostgreSQL's `fuzzystrmatch` offers `levenshtein(a, b) <= 1` (and `levenshtein_less_equal(a, b, 1)`, which stops early), Snowflake `EDITDISTANCE(a, b, 1)`, BigQuery `EDIT_DISTANCE` (newer releases); none of them count a transposition as one edit, so OSA distance needs a UDF. Spark: block with a join on the key, then a UDF. Not executed here.

**Edge cases built into the tests.** One substitution (match) and two (no match); an insertion at the end and at the start; the same name at different postcodes; case, punctuation and a trailing legal form; one missing space; a legal-form word that is not at the end (kept); a swap of two adjacent letters (two edits unless transpositions are on). Hard: postcodes in mixed case and spacing, missing and blank postcodes, names that are only legal forms, stacked legal forms. Very Hard (transpositions on): a swap plus a substitution (no match), a letter swapped with a space (match), two separate swaps (no match).

**Common mistakes.** Removing legal-form words anywhere in the name; treating "Ltd." differently from "Ltd" (punctuation is removed first); removing spaces from names; matching records with empty names or missing postcodes; returning unordered or duplicated pairs; a transposition check that accepts any two differences; reporting transitive pairs; full edit distance per pair.

**Follow-up guidance.** (1) A block of 5 000 is 12.5 million pairs. Within-one-edit pairs share a key among the "one character deleted" variants of each name (plus the name itself): index every variant (L + 1 per name) and compare only records that share a key, O(n·L) keys and few candidates; verify each candidate with the linear check. (2) Block on several keys (postcode, a phonetic or sorted-token key of the name, a postcode with the last character dropped) and union the candidate pairs; each key adds recall and cost, so measure both. (3) Turn pairs into groups with union-find, but cap group size or require that each new member matches several existing ones; a "bridge" pair joining two dense groups goes to review rather than merging. (4) Label a random sample of matched pairs for precision; for recall, label a sample of known duplicates (e.g. from past merges) and see how many the matcher proposes; stratify by block size.

**Rubric anchors.** 2: correct normalisation and pairs on small inputs but compares every pair or uses a full edit-distance table. 3: all tests pass with blocking and a linear check. 4: also handles large blocks (deletion keys) and the grouping risk credibly.

**Strong signals.** Clarifies what "one edit" includes; writes the one-edit check with early exits; asks what to do with records missing a postcode. **Red flags.** Suggesting the matcher can merge records automatically without review; normalising away information (all spaces, all digits) to inflate matches.
