# Google DeepMind · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public domain of an AI research lab whose
science and model work is published: experiment tracking and reproducibility, a
public protein structure database with per-residue confidence, watermark detection
reporting with aggregated outcomes, and research compute allocation described
generally. Every run, score, metric, confidence value, count, budget and schema is
synthetic and "this exercise's rule; check current docs"; nothing here describes a
real model result, experiment, detector, allocation or internal system.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GDM-L1-01: Watermark detection outcomes — files with all, part or none of the watermark, per content type, detector version and week

| | |
|---|---|
| **Template ID** | GDM-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / latest row per key with DISTINCT ON, tie-breaks, FILTER, NULLIF shares |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer |
| **Generator** | GDM-L1-01.mjs |

**Business Scenario.** A research lab publishes a detector that checks whether an image, video, audio clip or piece of text carries an imperceptible watermark added by its generative models, and reports an outcome with a confidence level. The same file is often checked several times, sometimes by a newer detector version. The reporting team publishes a weekly summary per content type and detector version: how many distinct files carried the watermark throughout, in part, or not at all, with low-confidence results shown apart so they never inflate either side. Only outcomes are stored: a file is known by a hash, and no content is kept. The outcome categories and confidence levels are this exercise's rule; check current docs for any real detector.

**Problem Statement.** Write one PostgreSQL query over `detection_checks` that returns `week_start, content_type, detector_version, files, watermarked, partial, not_watermarked, low_confidence, watermarked_share`, one row per (week, content type, detector version) that has at least one file, ordered by `week_start, content_type, detector_version`. A file's result for a detector version is its latest check by that version (latest `checked_at`). The file then belongs to the week (Monday start, UTC, as a date) of that latest check. `files` counts the files in the group; `low_confidence` counts those whose result has confidence `low`; `watermarked`, `partial` and `not_watermarked` count the outcomes of the other files only. `watermarked_share` is `(watermarked + partial) / (files − low_confidence)` rounded to 3 decimals, NULL when no file in the group has a result above low confidence. {{week_rule}} {{error_rule}} {{tie_rule}}

**Constraints.** One SQL statement (CTEs allowed). `check_id` is unique but not in time order. The sample has {{checks}} checks; a public detector receives far more, so say how your query would scale.

**Assumptions.** Content types, detector versions, outcomes, confidence levels and counts are synthetic. The detector's internals are out of scope: this is reporting on outcomes it already produced. The data was extracted after the last week ended.

**Clarifications.**
- Q: A file was checked on Tuesday and again on Thursday by the same version. Which result counts? | A: Thursday's, the latest. The file counts once.
- Q: The same file was checked by two detector versions. | A: It has one result per version and counts once in each version's row.
- Q: The latest result is low confidence, but an earlier one was high. | A: The latest stands: the file counts only in `low_confidence`.
- Q: A file was checked on Sunday and again on Monday. | A: It belongs to the week of its latest check, Monday's week, and nowhere else.
- Q: What if every file in a group is low confidence? | A: The row still appears, with zero in the three outcome columns and a NULL share.

**Hints.**
1. Reduce to one row per (file, detector version) first: `DISTINCT ON (file_hash, detector_version) … ORDER BY file_hash, detector_version, checked_at DESC, …`.
2. Decide what to filter out before choosing the latest row, not after: a row you filter after `DISTINCT ON` has already hidden the one you wanted.
3. Aggregate with `COUNT(*) FILTER (WHERE …)`, and divide with `NULLIF(…, 0)` cast to numeric before rounding.

**Follow-ups.**
1. Product asks for the share of files with any watermark per content type, across versions. Which version's result should a file contribute, and why is adding the per-version rows wrong?
2. A new detector version rolls out over two weeks. How would you report the files where the two versions disagree, without keeping any content?
3. At hundreds of millions of checks a week, how would you keep this report up to date incrementally when a file is re-checked days later?
4. A partner wants per-day numbers for one content type with a small volume. What would you publish, and what would you hold back so that rare files cannot be singled out?

**Follow-up rules.**
- when: max(checked_at), max(, group by file_hash → ask: MAX gives you the latest time, but how do you fetch that check's outcome and confidence, and what happens when two checks share that time?
- when: count(*), count(check_id), count of checks → ask: A file was checked three times by the same version. How many times does your query count it?
- when: max(check_id), latest id, highest id → ask: check_id is not in time order. Show a file where the greatest id is not the latest check.
- when: where outcome, error, <> 'error' → ask: Where in your query is the error filter: before or after you pick the latest check? Walk through a file whose latest check is an error.
- when: date_trunc, week → ask: Which check's timestamp decides the week for a file checked on Sunday and again on Monday?
- when: avg, average, divide, / → ask: What does your share return for a group where every file is low confidence, and why?

**Evaluation Criteria.** One result per file and detector version, chosen by `checked_at` with a deterministic tie-break; errors excluded before choosing; the week of the latest check; low-confidence results counted apart and kept out of the outcome columns and the share; NULL share with no confident file; correct rounding; deterministic order; sound answers on cross-version reporting, incremental maintenance and small groups.

## GDM-L1-02: Confidence bands in a protein structure release — residue shares per organism, and predictions mostly in the lowest band

| | |
|---|---|
| **Template ID** | GDM-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / band classification with CASE, two-level aggregation, residue-weighted shares, de-duplication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | GDM-L1-02.mjs |

**Business Scenario.** A public database of predicted protein structures gives every prediction a per-residue confidence score from 0 to 100, and its documentation groups the scores into four bands so readers know which parts of a structure to trust. Before a release, the data team checks each organism's predictions: what share of all residues falls in each band, and how many predictions are mostly in the lowest band and need a clear warning on their page. This exercise uses its own band edges; check current docs for the database's. It is a data check only: nothing here draws any biological or medical conclusion from a prediction.

**Problem Statement.** Write one PostgreSQL query that returns `release, organism, predictions, residues, very_high_pct, confident_pct, low_pct, very_low_pct, mostly_very_low`, one row per (release, organism) with at least one prediction counted, ordered by `release, organism`. This exercise's bands, by `plddt`: very high at 90 or above, confident at 70 or above and below 90, low at 50 or above and below 70, very low below 50. `predictions` counts the organism's predictions in the release; `residues` counts their residues. Each `_pct` is `100 × residues in the band / residues`, over all the organism's residues in the release (not an average of per-prediction shares), rounded to 1 decimal. `mostly_very_low` counts predictions with strictly more than half of their own residues in the very low band. {{release_rule}} {{null_rule}}

**Constraints.** One SQL statement (CTEs allowed). `plddt` is `NUMERIC(5,2)`, so a value can sit exactly on a band edge. The sample has {{predictions}} predictions and {{residue_rows}} residue rows; a full release has hundreds of millions of residues.

**Assumptions.** Accessions, organisms' predictions and every confidence value are synthetic; accessions use a made-up format. Band edges and the "mostly" rule are this exercise's rule; check current docs. Residue numbering starts at 1 within each prediction.

**Clarifications.**
- Q: Which band is a score of exactly 70.00? | A: Confident. Each band includes its lower edge.
- Q: Should the organism's percentage be the average of its predictions' percentages? | A: No. Count residues across all its predictions in the release, then divide.
- Q: A prediction has exactly half its residues below 50. Is it mostly very low? | A: No. Strictly more than half.
- Q: An accession appears in two releases. | A: Each release is reported on its own; it counts once in each.
- Q: Can the four percentages fail to add up to 100? | A: Yes, by rounding. Do not adjust them.

**Hints.**
1. Classify each residue once with a `CASE` on `plddt`, using `>=` on the lower edges, in a CTE.
2. Aggregate twice: per prediction (its band counts and its residue count, for `mostly_very_low`), then per release and organism from those counts.
3. Divide as numeric (`100.0 * …`) and round only the final value.

**Follow-ups.**
1. Long proteins are split into overlapping fragments, each its own prediction. How would you report an organism's residue shares without counting the overlap twice?
2. The documentation changes a band edge in a later release. How do you keep the old release's report reproducible and comparable?
3. The release has 200 million predictions. How would you compute this check, and which parts would you precompute when the residue files are written?
4. Readers want a per-residue confidence track on each entry page. What would you store per prediction so the page loads fast, and how would you keep it consistent with the bulk download files?

**Follow-up rules.**
- when: avg(, average of, mean → ask: Two predictions of 10 and 1 000 residues. What does an average of their shares say about the organism, and what does the residue-weighted share say?
- when: > 90, >90, > 70, >70, > 50, >50, between → ask: Which band does your query give a residue of exactly 90.00, and what does the exercise's rule say?
- when: >= 0.5, half, at least half → ask: A prediction has 6 of its 12 residues below 50. Is it mostly very low in your query?
- when: distinct, duplicate, count(distinct → ask: What exactly makes two residue rows duplicates, and what would your query do if a re-delivered row carried a different score?
- when: null, coalesce, is not null → ask: An unscored residue: is it a residue for the denominator, for the "mostly" half, both or neither in your query?

**Evaluation Criteria.** Inclusive lower band edges; residue-weighted percentages over the whole organism and release; "mostly" as strictly more than half of a prediction's own residues; withdrawn predictions excluded where present; unscored residues kept out of every count and duplicate rows counted once at Very Hard; correct rounding; deterministic order; sensible answers on fragments, changing band edges and scale.

## GDM-L1-03: Reruns that did not reproduce — same config, code, data snapshot and seed, but a different final metric, per project and month

| | |
|---|---|
| **Template ID** | GDM-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / composite keys with NULLs, FIRST_VALUE or ROW_NUMBER, tolerances, month bucketing |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | GDM-L1-03.mjs |

**Business Scenario.** A research lab's experiment tracker records every run: its project, config hash, code version, data snapshot, seed, start time, final status and final metric. Re-running a run with the same recipe should give the same result, within a small numerical tolerance. Each month the reproducibility working group reviews the reruns that did not reproduce, per project, to find nondeterminism before it reaches a published result. Every run, metric and project here is synthetic.

**Problem Statement.** Write one PostgreSQL query over `runs` that returns `month, project, reruns, not_reproduced, max_abs_diff`, one row per (month, project) with at least one rerun, ordered by `month, project`. A recipe is the combination of `project, config_hash, code_version, data_snapshot, seed`. Only runs with status `completed` and a `final_metric` count. The first run of a recipe is its earliest such run by `started_at`; every later one is a rerun. A rerun did not reproduce when `abs(final_metric − first run's final_metric)` is strictly greater than `{{tolerance}}`. `month` is the first day (a date) of the UTC month of the rerun's own `started_at`. `reruns` counts reruns, `not_reproduced` those that did not reproduce, and `max_abs_diff` is the largest absolute difference among the group's reruns. {{month_rule}} {{edge_rule}}

**Constraints.** One SQL statement (CTEs allowed). `final_metric` is `NUMERIC(8,4)`: compare it exactly, never as a float. `run_id`s are assigned in start order. The sample has {{runs}} runs; a tracker holds millions.

**Assumptions.** The tolerance, projects, hashes, code versions, snapshots, seeds and metrics are synthetic; what tolerance is right for a real metric is a judgement this exercise leaves out. A run's recipe never changes after it starts.

**Clarifications.**
- Q: A rerun differs from the first run by exactly the tolerance. | A: It reproduced. Only a difference strictly greater than `{{tolerance}}` counts.
- Q: Do I compare each rerun with the run before it, or with the first? | A: With the first completed run of the recipe.
- Q: The first attempt of a recipe failed. | A: Failed and cancelled runs never count, as the first run or as reruns. The first completed run is the first run.
- Q: The same config and code ran with a different seed. Is that a rerun? | A: No. A different seed or data snapshot is a different recipe.
- Q: Which month does a rerun belong to when its first run was in the month before? | A: The month of the rerun's own `started_at`.

**Hints.**
1. Filter to completed runs with a metric first, then find the first run per recipe with `FIRST_VALUE(final_metric) OVER (PARTITION BY … ORDER BY started_at, run_id)` or `ROW_NUMBER`.
2. A row whose `ROW_NUMBER` is 1 is the first run; every other row is a rerun.
3. Think about what `PARTITION BY` does with a NULL in one of the key columns.

**Follow-ups.**
1. Some nondeterminism is expected (for example, non-deterministic GPU kernels). How would you let a project declare its own tolerance, and keep this report honest when a project sets it very wide?
2. The working group wants to know which part of the recipe to suspect. What extra fields would you record per run, and how would you report reruns that differ only in hardware type or library versions?
3. A recipe has fifty reruns with a bimodal metric. Is "compared with the first run" still the right definition? Propose another and say what it reports.
4. The tracker holds millions of runs. How would you maintain this report incrementally as runs finish, including runs that finish out of start order?

**Follow-up rules.**
- when: lag(, previous run, prior run → ask: A recipe's metric drifts by half the tolerance on each rerun. What does comparing with the previous run report after four reruns, and what does the rule ask for?
- when: >=, at least → ask: A rerun differs by exactly the tolerance. Does your query count it as not reproduced?
- when: group by, partition by → ask: Two runs have the same config, code and snapshot but no recorded seed. Does your query treat them as the same recipe?
- when: min(started_at), min( → ask: Two runs of a recipe started in the same minute. Which is the first in your query, and is that deterministic?
- when: status, completed, failed → ask: Where in your query do failed and cancelled runs drop out: before you choose the first run, or after? Walk through a recipe whose first attempt failed.
- when: float, double, real → ask: Why compare NUMERIC metrics exactly here, and what could a float comparison do to a difference equal to the tolerance?

**Evaluation Criteria.** Completed runs with a metric only, filtered before choosing the first run; the recipe as all five fields; reruns compared with the first run, not the previous one; strict tolerance in exact numerics; the rerun's own month; deterministic tie-break on start time; NULL seeds excluded rather than grouped together at Very Hard; deterministic order; good answers on per-project tolerances, diagnosing causes and incremental maintenance.

## GDM-L1-04: Pareto front of runs — the runs no other run beats on both accelerator-hours and score

| | |
|---|---|
| **Template ID** | GDM-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sorting / skyline (Pareto front) by one sort and a running best, tie groups |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | GDM-L1-04.mjs |

**Business Scenario.** A research team runs a sweep of training runs and wants to show, on a run-comparison page, the runs worth looking at: those that no other run beats on both cost and quality. Cost is accelerator-hours (lower is better) and quality is an integer evaluation score (higher is better). Every run, hour and score here is synthetic; the page only compares numbers the tracker already holds.

**Problem Statement.** Implement `pareto_front(runs)`. `runs` is a list of `(run_id, accelerator_hours, score)` records in any order, with integer hours and scores. Run A beats run B when A's hours are at most B's, A's score is at least B's, and at least one of the two is strictly better. Return the ids of the runs that no other run beats, ordered by accelerator-hours ascending, then by `run_id` ascending. Two runs with the same hours and the same score do not beat each other: both are kept. Return `[]` when there are no runs. {{score_rule}} {{relog_rule}}

**Constraints.** Up to 80 000 runs in the timing check, most of them on the front. Comparing every pair is O(n²); keeping the front as a list and checking each run against all of it is O(n·f), and both are too slow when the front is large. O(n log n) is expected.

**Assumptions.** Hours and scores are synthetic integers. Only these two numbers decide the front; the page shows the other fields of a run but they play no part here.

**Clarifications.**
- Q: Two runs have the same hours, and one has a higher score. | A: The higher score beats the other.
- Q: Two runs have exactly the same hours and score. | A: Neither beats the other; both are on the front unless a third run beats them.
- Q: How should ties in the output order be broken? | A: By `run_id` ascending, as strings.
- Q: Is a run with fewer hours but a lower score beaten? | A: No. It is better on one and worse on the other.
- Q: May I raise an exception for bad input? | A: No. Return `None` in the cases the statement names.

**Hints.**
1. Sort by hours ascending. A run can only be beaten by a run that comes before it or shares its hours.
2. Process one hours value at a time: within a group only the top score can survive, and it survives when it is strictly above the best score of every cheaper run.
3. Keep that best score as a single number while you scan.

**Follow-ups.**
1. Prove that your scan keeps exactly the runs no other run beats, including equal pairs.
2. A third objective (peak memory, lower is better) is added. What happens to the one-sort approach, and what would you do for 80 000 runs?
3. Runs finish one at a time and the page must update live. Which structure keeps the front so that each new run is inserted or rejected in O(log f)?
4. The team wants the runs within 1% of the front, not only on it. How would you define that, and compute it?

**Follow-up rules.**
- when: for each pair, nested loop, all pairs → ask: How many comparisons is that for 80 000 runs, and roughly how long in Python?
- when: front list, check against the front, current front → ask: Most runs in the timing check are on the front. How many comparisons does checking each run against the whole front make?
- when: sort by score, sorted by score → ask: Sorting by score first can work too. Which tie rule on hours do you then need, and why?
- when: >=, strictly → ask: Two runs share hours and score. Walk through your comparison: does either remove the other?
- when: dict, last record, re-logged → ask: A run is logged twice and the second record has no score. Is it on the front in your code?

**Evaluation Criteria.** The correct beats relation with equal pairs both kept; one sort plus a running best handled per hours group; output ordered by hours then id; `[]` for no runs; at Hard, unscored runs ignored, zero hours allowed and `None` for negative hours; at Very Hard, the last record per run id; O(n log n) with a clear argument; good answers on a third objective and live updates.

## GDM-L1-05: Dividing a compute budget by max-min fairness — whole accelerator-hours, nobody above their request

| | |
|---|---|
| **Template ID** | GDM-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Greedy / max-min fair share (water-filling) by one sort, integer remainders, tie rules |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer, ml-platform-engineer |
| **Generator** | GDM-L1-05.mjs |

**Business Scenario.** A research lab shares a quarter's research compute among projects that each request a number of accelerator-hours. When requests exceed the budget, this exercise's rule is max-min fairness: small requests are met in full, and the rest of the budget is shared equally among the larger ones, in whole hours. The allocation is published to every project, so it must follow the rule exactly, including where the last few spare hours go. Every project, request and budget here is synthetic; how a real lab allocates compute is not described.

**Problem Statement.** Implement `allocate_hours(requests, budget, prefer="id")`. `requests` is a list of `(project_id, hours_requested)` in submission order; `budget` is a whole number of hours. If the budget is at least the total requested, every project gets its request. Otherwise let `L` be the largest whole number such that giving every project `min(request, L)` fits in the budget. Every project gets `min(request, L)`; the hours left over are fewer than the projects whose request is above `L`, and go one each to those projects in the order `prefer` names. Return `(project_id, hours_allocated)` for every project, in input order. Return `[]` when there are no projects. {{prefer_rule}} {{invalid_rule}} {{dup_rule}}

**Constraints.** Up to 50 000 projects and budgets of billions of hours in the timing check. Handing out one hour at a time is O(budget) and out of the question; capping one project per round and recomputing the share is O(n²) when requests are staggered. O(n log n) is expected.

**Assumptions.** Projects, requests and budgets are synthetic. Allocation is in whole hours. A project never receives more than it requested, and hours nobody requested stay unallocated.

**Clarifications.**
- Q: Can a project end up with more than its request? | A: Never. A project whose request is below the level gets exactly its request.
- Q: After equal shares there are 2 hours left for 5 uncapped projects. | A: They go to the first two of those projects in the order `prefer` names; the others get none of them.
- Q: Does a capped project take part in the spare hours? | A: No. Only projects whose request is above `L`.
- Q: Which order should the output be in? | A: The input order of the projects.
- Q: May I raise an exception on bad input? | A: No. Return `None` in the cases the statement names.

**Hints.**
1. Sort the projects by request. Walk through them, keeping the budget still to share and the number of projects still to serve.
2. If the smallest remaining request is at most an equal share of what is left, it is met in full; otherwise every remaining project is above the level, and `divmod` gives you `L` and the spare hours.
3. Sort only the uncapped projects by the `prefer` order to hand out the spare hours.

**Follow-ups.**
1. Prove that the `L` you compute is the largest level that fits, and that no project could get more without one that has no more getting less.
2. Projects now carry weights (a priority from a review). How does the sort-and-walk change for weighted max-min fairness?
3. Mid-quarter, two projects return unused hours. How would you redistribute them without changing anyone's allocation downwards?
4. The allocation is published to every project. What would you publish with it so that each project can check its own number?

**Follow-up rules.**
- when: while budget, one hour, round robin → ask: The budget is about 8 billion hours. How many loop iterations is that, and how long would it take?
- when: min(, remove(, smallest request each round → ask: Each round you find the smallest request and recompute the share. How many rounds for 50 000 staggered requests, and what does each cost?
- when: equal share, rounds, redistribute → ask: Your rounds cap every project at or below the share at once. How many rounds can that take, and can you prove it stops?
- when: float, round(, / len( → ask: Hours are whole numbers. Where can a float division give one project an hour too many or too few?
- when: sorted(, sort → ask: You sort by request. How do you still return the projects in input order, and how do you break ties for the spare hours?

**Evaluation Criteria.** Requests at or below the level met in full; the largest level that fits; spare hours fewer than the uncapped projects, given in the named order; output in input order; at Hard, `prefer="smaller"`, zero requests, budgets of 0 or above the total, and `None` for negative input; at Very Hard, repeated projects merged at their first position; O(n log n) with exact integer arithmetic; good answers on weights and redistribution.
