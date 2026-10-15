# Google DeepMind · Loop 1 — evaluator notes

Simulated practice scenarios; every run, score, metric, confidence value, count and
budget is synthetic and "this exercise's rule; check current docs". Nothing here
describes a real model result, detector, release or allocation. Every expected
result is computed by the template's generator and proven against the reference
below.

## GDM-L1-01

**Reference solution** (PostgreSQL)

```sql reference
WITH latest AS (
  SELECT DISTINCT ON (file_hash, detector_version)
         file_hash, content_type, detector_version, checked_at, outcome, confidence
  FROM detection_checks
  WHERE outcome <> 'error'
  ORDER BY file_hash, detector_version, checked_at DESC, check_id DESC
)
SELECT date_trunc('week', checked_at)::date                                          AS week_start,
       content_type,
       detector_version,
       COUNT(*)                                                                      AS files,
       COUNT(*) FILTER (WHERE confidence <> 'low' AND outcome = 'watermarked')       AS watermarked,
       COUNT(*) FILTER (WHERE confidence <> 'low' AND outcome = 'partial')           AS partial,
       COUNT(*) FILTER (WHERE confidence <> 'low' AND outcome = 'not_watermarked')   AS not_watermarked,
       COUNT(*) FILTER (WHERE confidence = 'low')                                    AS low_confidence,
       ROUND(COUNT(*) FILTER (WHERE confidence <> 'low' AND outcome IN ('watermarked', 'partial'))::numeric
             / NULLIF(COUNT(*) FILTER (WHERE confidence <> 'low'), 0), 3)            AS watermarked_share
FROM latest
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

**Explanation.** The unit of the report is a file per detector version, not a check. `DISTINCT ON (file_hash, detector_version)` keeps the first row of each key in the `ORDER BY`, so ordering by `checked_at DESC, check_id DESC` keeps the latest check, with the greater id winning a tie at the same second (Very Hard). Error checks are removed in the `WHERE`, before `DISTINCT ON` chooses: filtering them afterwards would let an error hide the result before it and drop the file. The week comes from the chosen check, so a file re-checked across the week boundary counts once, in the later week. Low-confidence results go only into `low_confidence`; the three outcome columns and the share use the other files. `NULLIF` turns a group with no confident file into a NULL share instead of a division error, and the `::numeric` cast keeps the division exact before `ROUND`.

**Complexity.** One sort by (file, version, time) for `DISTINCT ON` and a hash aggregate: O(n log n) for n checks. In production keep a "latest result per (file, version)" table updated by upsert as checks arrive (only a later `checked_at`, or an equal one with a greater id, replaces a row) and aggregate weekly from it.

**Dialect notes** (described, not executed). Snowflake and BigQuery: no `DISTINCT ON`; use `QUALIFY ROW_NUMBER() OVER (PARTITION BY file_hash, detector_version ORDER BY checked_at DESC, check_id DESC) = 1`; `COUNT_IF` / `COUNTIF` for the filtered counts; `DIV0NULL` (Snowflake) or `SAFE_DIVIDE` (BigQuery) for the share; BigQuery's `DATE_TRUNC(…, WEEK)` starts on Sunday, so use `WEEK(MONDAY)`. Spark SQL: `ROW_NUMBER` in a subquery (or `max_by(struct, …)`), `count_if`, `date_trunc('week', …)` starts on Monday. MySQL 8: `ROW_NUMBER` in a derived table, `SUM(CASE …)`, and `NULLIF` for the share.

**Edge cases built into the data.** Files checked once and several times; a file whose latest check is low confidence after a high-confidence one; files checked by both versions and by one; groups with only some outcomes. Hard: a second week; an error check after a valid result (must not replace it); a file with only error checks (no result); a file re-checked in the next week. Very Hard: two checks of one file at the same second with different outcomes (the greater id wins); checks at 23:59:59 on Sunday and 00:00:00 on Monday; a pre-release detector version whose only results are low confidence (share NULL).

**Common mistakes.** Counting checks instead of files; `MAX(checked_at)` with a join back, which returns two rows on a tie; `MAX(check_id)` as "latest"; filtering errors after choosing the latest check; collapsing across detector versions; putting low-confidence results in the outcome counts or the denominator; integer division (a share of 0 or 1); grouping by the week of the first check.

**Follow-up guidance.** (1) A file's cross-version result needs a rule (the newest version that checked it, or the newest generally available version); adding the per-version rows double counts files checked by both. (2) Join each file's latest result under the old and the new version on `file_hash`, and count agreement and each kind of disagreement per content type and confidence level; only hashes and outcomes are needed, never content. (3) Upsert the latest-per-key table, then recompute only the weeks whose rows changed: a re-check moves a file out of one week and into another, so both weeks are recomputed. (4) Publish counts above a minimum group size and suppress or coarsen smaller cells; per-day numbers for a rare content type may point at individual files or requesters.

**Rubric anchors.** 2: right shape, but counts checks, lets errors replace results, or mixes low confidence into the outcomes. 3: matches the expected result. 4: also explains the filter-before-choose order and the tie-break, and gives sound answers on version disagreement and small groups.

**Strong signals.** Asks what the unit is (file, check, or file per version) before writing SQL; checks that `watermarked + partial + not_watermarked + low_confidence = files`. **Red flags.** Reports a share for a group with no confident results as 0; keeps or asks for file contents to "verify" outcomes.

## GDM-L1-02

**Reference solution** (PostgreSQL)

```sql reference
WITH scored AS (                        -- one row per residue with a score
  SELECT DISTINCT prediction_id, residue_index, plddt
  FROM residue_confidence
  WHERE plddt IS NOT NULL
), per_prediction AS (
  SELECT p.release, p.organism, p.prediction_id,
         COUNT(*)                                             AS residues,
         COUNT(*) FILTER (WHERE s.plddt >= 90)                AS very_high,
         COUNT(*) FILTER (WHERE s.plddt >= 70 AND s.plddt < 90) AS confident,
         COUNT(*) FILTER (WHERE s.plddt >= 50 AND s.plddt < 70) AS low,
         COUNT(*) FILTER (WHERE s.plddt < 50)                 AS very_low
  FROM predictions p
  JOIN scored s ON s.prediction_id = p.prediction_id
  WHERE NOT p.withdrawn
  GROUP BY p.release, p.organism, p.prediction_id
)
SELECT release,
       organism,
       COUNT(*)                                          AS predictions,
       SUM(residues)                                     AS residues,
       ROUND(100.0 * SUM(very_high) / SUM(residues), 1)  AS very_high_pct,
       ROUND(100.0 * SUM(confident) / SUM(residues), 1)  AS confident_pct,
       ROUND(100.0 * SUM(low) / SUM(residues), 1)        AS low_pct,
       ROUND(100.0 * SUM(very_low) / SUM(residues), 1)   AS very_low_pct,
       COUNT(*) FILTER (WHERE 2 * very_low > residues)   AS mostly_very_low
FROM per_prediction
GROUP BY release, organism
ORDER BY release, organism;
```

**Explanation.** Clean the residues first: drop unscored ones and count each (prediction, residue) once (Very Hard). Then aggregate twice. The per-prediction level gives each prediction's band counts, which "mostly very low" needs (`2 × very_low > residues` is "strictly more than half" in integers). The per-organism level sums residue counts and divides, which makes the percentages residue-weighted: a 1 000-residue prediction weighs a hundred times a 10-residue one, as it should when the question is "what share of this organism's residues is confident". Each band includes its lower edge, so 90.00, 70.00 and 50.00 fall in the higher band. Withdrawn predictions (Hard) are excluded before anything is counted; each release is grouped on its own.

**Complexity.** One pass over the residues with a distinct (a hash or sort on three columns), a hash aggregate per prediction, and a small one per organism: O(r) to O(r log r) for r residue rows. At release scale the per-prediction band counts are computed once when the confidence files are written and stored with the prediction, so this check reads one row per prediction.

**Dialect notes** (described, not executed). Snowflake: `COUNT_IF`, `IFF`; `DIV0` for safe division. BigQuery: `COUNTIF`, `SAFE_DIVIDE`, `ROUND(x, 1)`; `NUMERIC` keeps exact edges, `FLOAT64` would put 90.00 at risk only if it were computed rather than stored. Spark SQL: `count_if` or `SUM(CASE …)`, `DECIMAL(5,2)` for exact edges. MySQL 8: `SUM(CASE …)` instead of `FILTER`, `DECIMAL(5,2)`, and `ROUND` behaves the same on exact decimals.

**Edge cases built into the data.** Residues at exactly 90.00, 89.99, 70.00, 69.99, 50.00 and 49.99 in one prediction; a prediction mostly in the lowest band; organisms with predictions of different lengths, so weighted and unweighted shares differ. Hard: a second release with an organism new in it; an accession predicted in both releases with different confidence; a withdrawn prediction; a prediction with exactly half its residues below 50. Very Hard: unscored residues in several predictions; a prediction that is exactly half very low among scored residues but more than half if NULLs count as very low; residue rows delivered twice, one set of which would make a prediction look mostly very low.

**Common mistakes.** `>` instead of `>=` on the edges; averaging per-prediction percentages; `>= 0.5` for "mostly"; counting withdrawn predictions; `COUNT(*)` including NULL scores, or `ELSE 'very_low'` that sweeps NULLs into the lowest band; no de-duplication; rounding per prediction and then averaging; integer division.

**Follow-up guidance.** (1) Fragments overlap: either report per fragment (and say so), or map fragment residues to the full-length sequence and count each sequence position once, choosing which fragment's score to keep (for example the one where the position is furthest from a fragment end) and stating the rule. (2) Store band edges as versioned configuration with the release that used them, compute each release's report with its own edges, and recompute old releases under new edges only as a labelled comparison. (3) Compute per-prediction band counts when the confidence file is written, store them as columns, and aggregate per organism from those: a scan of one row per prediction instead of per residue. (4) Store the per-residue scores in a compact array per prediction (or a small binary file next to the structure file), served from the same release snapshot as the bulk archive, with a checksum both use.

**Rubric anchors.** 2: right shape, but band edges, weighting or the "mostly" rule are wrong. 3: matches the expected result. 4: also handles fragments and versioned band edges with clear rules, and moves the per-residue work to write time.

**Strong signals.** Asks whether the edges are inclusive and whether shares are residue-weighted before writing SQL; keeps the work to data quality and says nothing about what a low score means biologically. **Red flags.** Treats a NULL score as zero confidence; draws a medical or functional conclusion from a confidence band.

## GDM-L1-03

**Reference solution** (PostgreSQL; `{{tolerance}}` comes from the instance)

```sql reference
WITH counted AS (
  SELECT run_id, project, config_hash, code_version, data_snapshot, seed, started_at, final_metric
  FROM runs
  WHERE status = 'completed'
    AND final_metric IS NOT NULL
    AND seed IS NOT NULL
), ranked AS (
  SELECT project, started_at, final_metric,
         ROW_NUMBER()  OVER w AS rn,
         FIRST_VALUE(final_metric) OVER w AS first_metric
  FROM counted
  WINDOW w AS (PARTITION BY project, config_hash, code_version, data_snapshot, seed
               ORDER BY started_at, run_id)
), rerun_diffs AS (
  SELECT project,
         date_trunc('month', started_at)::date AS month,
         ABS(final_metric - first_metric)      AS diff
  FROM ranked
  WHERE rn > 1
)
SELECT month,
       project,
       COUNT(*)                                           AS reruns,
       COUNT(*) FILTER (WHERE diff > {{tolerance}})       AS not_reproduced,
       MAX(diff)                                          AS max_abs_diff
FROM rerun_diffs
GROUP BY month, project
ORDER BY month, project;
```

**Explanation.** Filter first: only completed runs with a metric can be a first run or a rerun, so a failed first attempt (every level) or a cancelled run that carries a metric (Very Hard) never becomes the baseline. Runs without a seed are excluded explicitly: `PARTITION BY` and `GROUP BY` treat NULLs as equal, so two seedless runs would otherwise look like a recipe and its rerun (Very Hard). The window orders each recipe by `started_at, run_id`, so a tie in the same minute goes to the smaller id; `FIRST_VALUE` is the baseline every rerun is compared with (not the previous run, which lets slow drift hide). The difference is `NUMERIC`, so "strictly greater than the tolerance" is exact, and a difference equal to it reproduced. The month is the rerun's own.

**Complexity.** One window sort over the counted runs, partitioned by recipe, and a hash aggregate: O(n log n). Incrementally, keep a per-recipe baseline table (first run id and metric), insert-only except when a run that started earlier finishes later, and append rerun rows with their difference as runs complete.

**Dialect notes** (described, not executed). Snowflake: `QUALIFY` can filter `rn > 1`; `FIRST_VALUE` the same; `DATE_TRUNC('month', …)`; `COUNT_IF`. BigQuery: named `WINDOW` clauses work; `NUMERIC` for exact metrics; `COUNTIF`. Spark SQL: `first(final_metric) OVER w` (make sure the frame starts at the partition start, the default with `ORDER BY`), `DECIMAL(8,4)`. MySQL 8: named windows are supported; no `FILTER`, so `SUM(diff > tol)`; `DECIMAL(8,4)` keeps exactness. In every engine, a NULL in a partition key forms its own group, so the explicit `seed IS NOT NULL` is needed everywhere.

**Edge cases built into the data.** A recipe whose first attempt failed and whose last attempt failed; a rerun exactly the tolerance away (reproduced) and one well outside it; recipes with up to four runs, so comparing with the previous run differs from comparing with the first. Hard: a second month; a first run late in September with its rerun in October (reported in October); runs that differ only in seed, and only in data snapshot (different recipes). Very Hard: two runs of a recipe started in the same minute (the smaller id is the first); two runs with no seed and otherwise identical recipes (not a rerun); a cancelled run carrying a metric before the first completed run (ignored).

**Common mistakes.** `LAG` instead of the first run; `>=` for the tolerance; filtering status after ranking, so a failed run is the baseline; leaving seed (or snapshot) out of the key; grouping NULL seeds; `MIN(started_at)` with a join back that returns two rows on a tie; reporting a rerun in its recipe's first month; casting metrics to float.

**Follow-up guidance.** (1) A per-project (or per-metric) tolerance table joined on project, with an owner and a review date, and the report shows each project's tolerance next to its count, so a very wide one is visible rather than hidden. (2) Record environment fields (accelerator type, library versions, container digest, number of devices) and report reruns whose recipes match but environments differ separately from fully identical reruns; a difference there points at the environment, not the code. (3) With many reruns, compare with the recipe's median, or report the spread (range or standard deviation) per recipe, and flag recipes whose spread exceeds the tolerance; say that "first run" makes the baseline an accident of order. (4) Maintain the baseline per recipe on completion; a run that started earlier but finished later can replace the baseline, which changes earlier rows: recompute that recipe only.

**Rubric anchors.** 2: right shape, but compares with the previous run, includes failed runs, or misses part of the recipe. 3: matches the expected result. 4: also explains the NULL-key trap and the tie-break, and proposes credible per-project tolerances and environment diagnostics.

**Strong signals.** Asks what makes two runs "the same recipe" and what to do with a missing seed before writing SQL; treats non-reproduction as a signal to investigate, not a verdict. **Red flags.** Claims any real model or result is non-reproducible; compares floats with `=`.

## GDM-L1-04

**Reference solution**

```python reference
def pareto_front(runs):
    if any(hours < 0 for _, hours, _ in runs):
        return None
    last = {}
    for run_id, hours, score in runs:          # the last record of a run wins
        last[run_id] = (hours, score)
    items = sorted((hours, -score, run_id) for run_id, (hours, score) in last.items() if score is not None)
    out = []
    best = None                                # best score among strictly cheaper runs
    i, n = 0, len(items)
    while i < n:
        hours, neg_top = items[i][0], items[i][1]
        j = i
        while j < n and items[j][0] == hours and items[j][1] == neg_top:
            j += 1                             # runs equal to the group's top: an equal set
        if best is None or -neg_top > best:
            out.extend(items[k][2] for k in range(i, j))
            best = -neg_top
        while j < n and items[j][0] == hours:  # the rest of this hours group is beaten by its top
            j += 1
        i = j
    return out
```

**Explanation.** Sort by hours ascending, score descending, id ascending. A run can only be beaten by a run with no more hours, so after the sort every possible beater of a run is before it or in its own hours group. Within an hours group only the top score can survive (the others are beaten by it), and every run equal to that top survives together, since equal runs do not beat each other. The top survives exactly when its score is strictly above the best score of all cheaper runs: a cheaper run with an equal or higher score beats it. The running `best` is that maximum, and it only changes when a group survives (a group that does not survive has a top no higher than `best`). Output comes out in hours order and, within an equal set, in id order, as required. At Hard, unscored runs are dropped before the sort and a negative hours value anywhere returns `None`; at Very Hard the dictionary keeps each run's last record, including a last record without a score.

**Complexity.** O(n log n) for the sort and O(n) for the scan, O(n) memory. The timing test (80 000 runs, about 85% of them on the front) runs in about 0.2–0.3 s in CPython, and generating its data takes about 0.1 s.

**The middle approach.** The most likely middle solution keeps the current front as a list and, for each run, checks it against every member (and removes the members it beats). That is O(n·f) for a front of size f. The timing data is built so the front is large (scores rise with hours plus small noise), so it does about n·f/2 ≈ 3 × 10⁹ comparisons; when timed for this template, 10 000 runs of the same data already took 5.3 s in CPython and the full 80 000 would take several minutes, so it fails the 8 s limit clearly. Comparing every pair (O(n²)) is worse. Sorting by score descending and keeping the least hours seen so far is the mirror of the reference and passes; a balanced tree or `bisect` over the front for an online version also passes.

**Dialect notes.** In Java sort an array of records with a comparator on (hours, −score, id), or use `TreeMap` for the online variant. In SQL the front is a window query: a run is on it when its score is strictly above `MAX(score) OVER (ORDER BY hours RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)` and equal to the maximum score in its own hours group. Not executed here.

**Edge cases built into the tests.** No runs (`[]`); one run; same hours with a higher score; same score with fewer hours; a staircase where every run is on the front; one run beating all others; more hours for the same score; output order by hours rather than input, score or id. Hard: equal pairs kept in id order; unscored runs; no scored run at all (`[]`); zero hours; negative hours (`None`). Very Hard: a run re-logged with a better score, a worse one, no score, and a score after none; a re-logged run that becomes equal to another.

**Common mistakes.** Using strict `<` and `>` together, which keeps runs that a same-hours run with a higher score beats; dropping one of an equal pair; ordering the output by score or input order; not handling a group whose top equals the best so far (it is beaten); taking the first record of a re-logged run; raising on bad input instead of returning `None`.

**Follow-up guidance.** (1) Induction over the sorted order: the invariant is that `best` equals the best score among strictly cheaper runs, and the survival test is exactly "no cheaper run with an equal or higher score, and no same-hours run with a higher score". (2) With three objectives the front is no longer a staircase; sort by one objective and keep a 2D structure (a Fenwick or segment tree over a compressed second objective storing the best third) for O(n log² n) or a divide-and-conquer skyline; at 80 000 runs either is fine. (3) Keep the front in a sorted container keyed by hours; a new run is rejected if the predecessor's score is at least its own, otherwise inserted and its dominated successors (a contiguous range) removed, amortised O(log f). (4) An additive or multiplicative epsilon on the score (say within 1% of the best score available at that cost or less); compute it with the same scan by comparing against `best × 0.99`.

**Rubric anchors.** 2: an O(n·f) or O(n²) version, or the right idea with wrong ties. 3: all tests pass in O(n log n). 4: also proves the scan and handles the three-objective and online follow-ups well.

**Strong signals.** Asks how equal runs and same-hours runs are treated before coding; tests with a staircase and an equal pair. **Red flags.** Combines hours and score into one weighted number and sorts by it (that is a different question); assumes ids are unique when the statement says they may not be.

## GDM-L1-05

**Reference solution**

```python reference
def allocate_hours(requests, budget, prefer="id"):
    if budget < 0 or any(hours < 0 for _, hours in requests):
        return None
    total = {}
    for project, hours in requests:            # repeated projects add up, first position kept
        total[project] = total.get(project, 0) + hours
    projects = list(total)
    alloc = {}
    left = budget
    todo = sorted(projects, key=lambda p: total[p])
    k, n = 0, len(todo)
    # A request at most an equal share of what is left (r <= left // (n - k)) is met in full.
    while k < n and total[todo[k]] * (n - k) <= left:
        alloc[todo[k]] = total[todo[k]]
        left -= total[todo[k]]
        k += 1
    rest = todo[k:]
    if rest:                                   # every remaining request is above the level
        level, spare = divmod(left, len(rest))
        for p in rest:
            alloc[p] = level
        key = (lambda p: (total[p], p)) if prefer == "smaller" else None
        for p in sorted(rest, key=key)[:spare]:
            alloc[p] += 1
    return [(p, alloc[p]) for p in projects]
```

**Explanation.** Sort by request and walk upwards with the budget still to share (`left`) and the number of projects still to serve (`n − k`). If the smallest remaining request is at most an equal share of what is left, every remaining project could get at least that much, so the level is at least this request and it is met in full. The first time a request is above the equal share, every remaining request is too (they are sorted), so all of them get the level `L = left // (n − k)` and `left % (n − k)` hours are spare, fewer than the uncapped projects. That `L` is the largest level that fits: everyone capped so far is at or below it, and one more hour for each uncapped project would exceed the budget. The comparison is done as `r × (n − k) <= left` in integers, so no float can give a project an extra hour. Spare hours go to the uncapped projects in the `prefer` order. When the budget covers every request, the walk caps everyone and leaves the rest unallocated. Input order is restored from the dictionary, which keeps first-appearance order; at Very Hard it also adds up repeated projects.

**Complexity.** O(n log n) for the sorts, O(n) memory, and the arithmetic is exact for any budget. The timing test (50 000 staggered requests, a budget of about 7.9 × 10⁹ hours, about 90% of the projects capped) runs in about 0.15 s in CPython, plus about 0.07 s to generate.

**The middle approach.** Handing out one hour at a time (or a round-robin loop over projects) is O(budget): about 8 × 10⁹ steps here, hopeless. The likely middle solution is "rounds of equal shares". There are two common versions, and they behave very differently. (a) Each round finds the single smallest remaining request with `min()`, caps it if it fits the current equal share, removes it with `list.remove`, and recomputes the share: one project per round, so O(n²) when most projects are capped, which the staggered requests ensure. When timed for this template, 20 000 projects took 22 s in CPython, and the full 50 000 would take over two minutes, so it fails the 8 s limit clearly. (b) Each round gives every remaining project `min(share, need)` at once, so all projects at or below the share are capped together, and repeats until the share is zero, then hands out the spare hours by the tie rule. This version is correct (when it stops, every capped project is at or below the common amount and fewer hours than uncapped projects remain, which is exactly the level and remainder above), and it passes: the timing data needs only 5 rounds, about 0.05 s. It cannot be forced into many rounds with realistic integers, because each round's rise in the level is at most the surplus returned by newly capped projects divided among those left, which shrinks geometrically unless about half the projects are capped each time; we tried staggered, quadratic, geometric and harmonic requests and never saw more than 8 rounds. Accept version (b) if the candidate argues why it terminates and why the result is the same; it is O(n × rounds).

**Dialect notes.** In Java or C++ use 64-bit integers (budgets of billions overflow 32-bit) and sort indices by request. In SQL, the level can be found with a window: order by request, compute `budget - SUM(request) OVER (ROWS UNBOUNDED PRECEDING)` before each row and the count of rows after it, and the first row whose request exceeds `left / remaining` gives the level; the spare hours need a `ROW_NUMBER` over the prefer order. Not executed here.

**Edge cases built into the tests.** No projects (`[]`); one project with a budget above its request; an even split; one small request met in full; spare hours by id; requests exactly at the level; output in input order. Hard: spare hours to the smaller request first, and among equal requests by id; a budget above the total; a budget of 0; a request of 0; a negative request and a negative budget (`None`). Very Hard: a project listed twice (requests add up); one listed twice appearing once at its first position; two small entries that only exceed the level when added together.

**Common mistakes.** Float division (`left / n`) and rounding, which over- or under-allocates by an hour; giving spare hours to capped projects; handing spare hours in input order instead of the named order; returning projects in sorted order; letting a project exceed its request when the budget is large; treating a repeated project as two projects; raising on bad input instead of returning `None`.

**Follow-up guidance.** (1) For a level `L`, `f(L) = Σ min(r, L)` is non-decreasing, so the largest `L` with `f(L) ≤ budget` is unique; the walk computes it because every capped request satisfies `r ≤ L` and `f(L + 1) > budget`. Max-min fairness: raising any project would need an hour from a project with no more hours, since every uncapped project is at `L` or `L + 1`. (2) Weighted: sort by `request / weight` and walk with the remaining weight instead of the remaining count, `level = left / remaining_weight`, allocating `weight × level`; integer hours then need a remainder rule (largest fractional part first), which a strong candidate raises. (3) Re-run the computation over the projects still below their request with the returned hours as the budget: allocations only go up, because the level only rises. (4) Publish every project's request and allocation, the budget, the level `L`, the number of spare hours and the order they went in, so any project can recompute its own line; avoid publishing anything about a project beyond what the process already shares.

**Rubric anchors.** 2: one hour at a time, a one-cap-per-round loop, or floats that miss by an hour. 3: all tests pass in O(n log n) (or version (b) above with a sound termination argument). 4: also proves the level is maximal and handles weights and redistribution cleanly.

**Strong signals.** Asks what happens to spare hours and to unused budget before coding; checks that the allocations add up to `min(budget, total requested)`. **Red flags.** Allocates in proportion to requests (a different rule) without noticing; gives a project more than it asked for.
