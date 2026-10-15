# Google DeepMind · Loop 2 — evaluator notes (hidden from candidates)

Simulated practice scenarios; every structure, run, metric, count, volume and rule
is synthetic and "this exercise's rule; check current docs". Nothing here
describes the lab's research, releases, data or systems. Score designs on the
criteria, not on matching the reference.

## GDM-L2-01

**Reference solution**

```python reference
def residue_contacts(residues, cutoff, min_conf=0):
    # Cell list: bucket residues into cubes of side `cutoff`. Two residues within the
    # cutoff are in the same cube or in neighbouring cubes (26 around each), so each
    # cube is compared with itself and with 13 of its neighbours (each pair once).
    c = cutoff
    c2 = c * c
    grid = {}
    for res in residues:
        if res[4] >= min_conf:
            key = (res[1] // c, res[2] // c, res[3] // c)       # floor division, negatives too
            cell = grid.get(key)
            if cell is None:
                grid[key] = [res]
            else:
                cell.append(res)
    forward = [(dx, dy, dz) for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1)
               if (dx, dy, dz) > (0, 0, 0)]                     # 13 of the 26 neighbours
    out = []

    def check(a, b):
        ex, ey, ez = b[1] - a[1], b[2] - a[2], b[3] - a[3]
        if ex * ex + ey * ey + ez * ez <= c2:                   # exact, integers
            na, nb = a[0], b[0]
            if nb - na >= 3:
                out.append((na, nb))
            elif na - nb >= 3:
                out.append((nb, na))

    for (gx, gy, gz), cell in grid.items():
        m = len(cell)
        for i in range(m):
            for j in range(i + 1, m):
                check(cell[i], cell[j])
        for dx, dy, dz in forward:
            other = grid.get((gx + dx, gy + dy, gz + dz))
            if other is not None:
                for a in cell:
                    for b in other:
                        check(a, b)
    out.sort()
    return out
```

**Explanation.** Two atoms within the cutoff differ by at most one cutoff along every axis, so if space is cut into cubes of side `cutoff`, a residue's partners can only be in its own cube or in one of the 26 cubes around it. Bucketing every counted residue by `(x // cutoff, y // cutoff, z // cutoff)` in a dict takes one pass; then each cube is compared with itself (pairs `i < j`) and with 13 of its neighbours, one from each opposite pair (the offsets greater than `(0, 0, 0)` in tuple order), so each pair of residues is examined exactly once. The distance test is exact: squared integer distances against `cutoff * cutoff`, inclusive. The separation rule is applied to residue numbers, and the pair is written smaller number first, because cube order says nothing about residue order. Residues below `min_conf` never enter the grid, which removes them and every contact they were part of. Python's `//` floors negative coordinates, so a residue at `x = -1` lands in cube `-1`, next to cube `0`; truncation toward zero (`int(x / cutoff)`) would merge cubes `-1` and `0` into one double-width cube, which is still correct but slower, so it is not a bug here, only worth a question.

**Complexity.** O(n) to bucket and O(n · m) pair checks, where m is the number of residues in 14 cubes around a residue, so O(n + contacts) at protein-like densities; the final sort is O(c log c) for c contacts. The timing test (50 000 residues in a box about 37 cutoffs wide, about one residue per cube volume, about 86 000 to 100 000 contacts) takes about 0.6 to 0.7 s in CPython, and generating the input about 0.1 s. Visiting all 27 cubes and keeping only `b - a >= 3` (each pair seen from both sides) takes about 1.05 s and passes. Comparing every pair took 5.3 s at 6 000 residues; at 50 000 that is about 370 s, extrapolated, some 500 times the reference.

**The middle approach.** The likely middle answer sorts residues by `x` and, for each one, scans forward while the `x` difference is at most the cutoff, checking the full distance only for those. On an extended chain lying along `x` that is fast. On a compact fold it is not: each slab one cutoff wide holds about `n · cutoff / side` residues, about 1 300 here, so the scan is O(n² · cutoff / side), roughly n^(5/3) for a globule. Measured on the timing test it takes about 15 to 19 s (23 to 31 times the reference), well over the 8 s limit. A k-d tree (for example `scipy.spatial.cKDTree.query_pairs`, where SciPy is available) is another correct sublinear method and acceptable if the candidate handles the inclusive boundary (query with a radius a hair above the cutoff and filter with the exact integer test) and the separation rule; ask what it costs to build. Sorting by a space-filling curve and scanning a window is not exact without extra checks.

**Dialect notes.** In Java or C++, pack the three cube coordinates into one 64-bit key for a hash map, or sort residues by cube key and binary-search neighbours; the squared distance fits in a 64-bit integer for coordinates below about 10⁹. NumPy can vectorise the per-cube-pair comparisons with broadcasting. In SQL, add integer cube columns and self-join on `b.cx BETWEEN a.cx - 1 AND a.cx + 1` (and the same for `cy`, `cz`) with `b.residue_number - a.residue_number >= 3` and the squared-distance test; PostGIS offers `ST_3DDWithin` with a spatial index. In Spark, emit each residue to its own cube and to the 13 forward neighbours, then join by cube key. Not executed here.

**Edge cases built into the tests.** A pair exactly at the cutoff, along an axis and on a 3-4-5 triangle (contact); one thousandth beyond the cutoff (not a contact); sequence separations of 1, 2 and 3; negative coordinates and a contact across zero; a contact across a cube corner, diagonal in all three axes (missed by anyone who checks only the 6 face neighbours); an extended strand with no contacts (`[]`). Hard adds a residue exactly at the confidence floor (counted) and one point below (left out), and a low-confidence residue whose contacts all disappear. Very Hard adds residue numbers out of list order, where separation is by number, and a numbering gap that makes list neighbours into contacts.

**Common mistakes.** `math.dist` or `sqrt` compared with the cutoff, which can misjudge the exact boundary; `< cutoff` instead of `<=`; separation by list position instead of residue number; pairs reported twice or as `(b, a)`; checking only face neighbours; cube side smaller than the cutoff with only one ring of neighbours; filtering low-confidence residues after finding contacts but forgetting one side of the pair; sorting the output by cube order instead of residue numbers.

**Follow-up guidance.** (1) Each entry is independent, so the job parallelises by entry; at an 8 Å cutoff a folded protein has a few to about ten contacts per residue, so the output is several times the residue count in pairs, best stored as two integer arrays per entry, compressed. (2) Bucket with the largest cutoff once and store the squared distance with each pair; smaller cutoffs are then a filter. Cubes of the smallest cutoff with a wider neighbourhood also work. (3) Diff the two sorted pair lists per entry; report added and removed contacts with the confidence of both residues, and say plainly that a contact between low-confidence residues is weakly supported by the prediction. Geometry only, no biological claim. (4) Residue identity becomes `(chain, number)`; the separation rule applies only within a chain (every inter-chain pair is eligible), and the output names both chains.

**Rubric anchors.** 2: all pairs, or a slab scan presented as fast, or a float distance with a wrong boundary. 3: all tests pass with a cell list (or a k-d tree with the exact boundary), separation by residue number, confidence floor handled. 4: also explains why the slab scan is still quadratic on a compact fold, why the cube side must be at least the cutoff, why 13 neighbours suffice, and answers the several-cutoffs and version-diff follow-ups concretely.

**Strong signals.** Asks whether the boundary is inclusive and whether coordinates can be negative before coding; estimates the number of residues per cube. **Red flags.** "Distances are floats, so compare with a small epsilon"; reporting contacts between bonded neighbours.

## GDM-L2-02

**Reference solution**

```python reference
def ablation_pairs(runs, ignore=(), defaults=None):
    # One masked signature per key: for key k, the run's values for every other
    # compared key. Two runs differ in exactly k when they share that signature and
    # their values for k differ; runs that also agree on k are identical configs.
    base = dict(defaults or {})
    skip = set(ignore)
    keys = set(base)
    for _, cfg in runs:
        keys.update(cfg)
    keys = sorted(k for k in keys if k not in skip)
    rows = []
    for run_id, cfg in runs:
        rows.append((run_id, tuple(cfg[k] if k in cfg else base[k] for k in keys)))   # never `or`
    out = []
    for i, key in enumerate(keys):
        groups = {}
        for run_id, values in rows:
            groups.setdefault(values[:i] + values[i + 1:], []).append((run_id, values[i]))
        for members in groups.values():
            if len(members) < 2:
                continue
            for a in range(len(members)):
                ra, va = members[a]
                for b in range(a + 1, len(members)):
                    rb, vb = members[b]
                    if va != vb:
                        out.append((ra, rb, key) if ra < rb else (rb, ra, key))
    out.sort()
    return out
```

**Explanation.** Two runs differ in exactly key `k` when they agree on every other compared key and disagree on `k`. So for each key `k`, take each run's values for every other key, in one fixed (sorted) key order: that tuple is the run's masked signature for `k`. Runs that share a masked signature agree everywhere except possibly at `k`; inside such a group, two runs with different values at `k` are an ablation pair on `k`, and two runs with the same value are identical configs, which are skipped. A pair that differs in one key appears in exactly one key's grouping, so no pair is reported twice. Normalising first matters: one effective tuple per run, in sorted key order, with defaults filled by key presence (`cfg[k] if k in cfg else base[k]`), never by truthiness, so an explicit `0.0`, `0` or `False` stays a value, and with ignored keys dropped before any signature is built.

**Complexity.** O(n·k) dictionary operations on tuples of length k − 1, so O(n·k²) work to build the signatures, plus the size of each group squared, which the data keeps small: O(n·k² + output). The timing test (24 000 runs, ten hyperparameters with four values each, about 15 000 pairs) takes about 0.35 to 0.45 s in CPython, and generating it about 0.15 s. Comparing every pair took about 6 s at 4 000 runs; at 24 000 that is about 230 s, extrapolated, more than 500 times the reference.

**The middle approach.** The likely middle answer groups runs by the value of one key first and compares every pair inside each group key by key, plus a separate pass for pairs that differ only in that key. With four values for that key, each group holds about 6 000 runs, so it is still about n²/8 comparisons. Measured on the timing test it takes about 22 to 23 s (about 50 times the reference), well over the 8 s limit, whichever key is chosen, because every key has four values. Ask how big a group is before accepting it. Grouping by a whole-config hash first and then by masked signatures is the reference with an extra step and is fine. Building all k masked signatures as strings (for example `json.dumps` of the dict with one key removed and `sort_keys=True`) is also O(n·k²) and passes if the serialisation is canonical.

**Dialect notes.** In SQL, unpivot configs to `(run_id, key, value)`, then for each key compute a masked signature with `string_agg(key || '=' || value, ',' ORDER BY key) FILTER (WHERE key <> k)` per run, and self-join on `(k, signature)` with `a.run_id < b.run_id` and different values; or self-join on equal values and keep pairs where `count(*) = number of keys − 1`, which is quadratic. In Spark, `explode` one row per (run, masked key) and group by `(key, signature)`. Java and C++ need a canonical, hashable signature (an immutable list or a string built in key order). Not executed here.

**Edge cases built into the tests.** One key apart versus two keys apart; identical configs (not a pair) that each pair with a one-change variant; three values of one key (three pairs); ids out of order in the input; a string value and a boolean value; a single run (`[]`). Hard adds runs that differ only in an ignored seed (identical) and several ignored keys with a pair that also differs in one of them. Very Hard adds an omitted key equal to an explicit default and an explicit `0.0` that is not the default `0.1`.

**Common mistakes.** Reporting identical configs as pairs; reporting a pair once per key it differs in; comparing ignored keys; filling defaults with `cfg.get(k) or default`, which turns `0.0` into the default; serialising dicts without sorting keys; comparing ids numerically after stripping a prefix; forgetting that keys can be absent at Very Hard and raising `KeyError`.

**Follow-up guidance.** (1) For at most two differing keys, mask every pair of keys: k(k − 1)/2 signatures per run, 45 for ten keys, still linear in n; pairs found under several masks must be deduplicated, and the reported keys are those where the values differ. (2) Normalise numbers before comparing (for example round to a stated number of significant digits, or compare the config as written by the launcher rather than computed values) and record the rule, because over-normalising hides real differences. (3) Flatten to dotted paths; treat a list as one value (a tuple) unless the team decides each position is a hyperparameter; record the flattening rule with the sweep. (4) Keep the k signature maps; a new run is looked up in each one in O(k²), producing its new pairs, and is then added. Deletions remove it from each map.

**Rubric anchors.** 2: all pairs, or grouping by one key presented as fast, or identical configs reported. 3: all tests pass with masked signatures, defaults by presence, ignored keys dropped. 4: also argues why grouping by one key stays quadratic, extends to two-key pairs with the cost stated, and has a sensible normalisation and incremental story.

**Strong signals.** Rephrases "differ in exactly one key" as "agree on all but one" before coding; asks whether repeats count and how missing keys behave. **Red flags.** Comparing `str(config)`; `itertools.combinations` over 24 000 runs "because it is in C".

## GDM-L2-03

**Reference solution** (the fixed planner)

```python reference
def plan_deletions(checkpoints, policy, pins):
    """checkpoints: dicts {"run", "step", "metric"}, one per saved checkpoint.
    policy: {"keep_last", "keep_best", "metric_mode": "min" | "max", "every"}.
    pins: (run, step) pairs that an evaluation still points at.
    Return the (run, step) pairs to delete, sorted."""
    keep_last = policy["keep_last"]
    keep_best = policy["keep_best"]
    every = policy["every"]
    lower_is_better = policy["metric_mode"] == "min"                 # the policy says min or max

    by_run = {}
    for ck in checkpoints:
        by_run.setdefault(ck["run"], []).append(ck)

    keep = set()

    # 1. the most recent checkpoints of each run
    for run, cks in by_run.items():
        latest = sorted(cks, key=lambda ck: ck["step"], reverse=True)
        for ck in latest[:keep_last]:
            keep.add((run, ck["step"]))

    # 2. the best checkpoints of each run by its evaluation metric; ties to the earlier step
    for run, cks in by_run.items():
        if lower_is_better:
            ranked = sorted(cks, key=lambda ck: (ck["metric"], ck["step"]))
        else:
            ranked = sorted(cks, key=lambda ck: (-ck["metric"], ck["step"]))
        for ck in ranked[:keep_best]:
            keep.add((run, ck["step"]))

    # 3. every Nth step, as a sparse history of the run (step 0 included)
    for ck in checkpoints:
        if ck["step"] % every == 0:
            keep.add((ck["run"], ck["step"]))

    # 4. checkpoints that an evaluation still points at, matched by run and step
    pinned = set(pins)
    for ck in checkpoints:
        if (ck["run"], ck["step"]) in pinned:
            keep.add((ck["run"], ck["step"]))

    return sorted((ck["run"], ck["step"]) for ck in checkpoints
                  if (ck["run"], ck["step"]) not in keep)
```

**The planted bugs, their symptoms and their fixes.**
1. **The last k across all runs.** `latest` sorts every checkpoint of every run by step and keeps the first `keep_last`, so a long run's high steps take every slot. Symptom: a team's short runs lose all their recent checkpoints on a night when a long run is in the same batch. Fix: sort and slice inside the per-run loop.
2. **The metric direction is never "min".** `lower_is_better = policy["metric_mode"] == "lower"` compares with a value the policy never uses, so it is always `False` and every metric is ranked higher-is-better. Symptom: for a loss, the worst checkpoints are kept as "best". Fix: compare with `"min"`.
3. **Step 0 left out of the every-Nth rule.** `if ck["step"] and …` is false for step 0, whatever `every` is. Symptom: the starting checkpoint is deleted. Fix: test `ck["step"] % every == 0` alone.
4. **Pins matched by step only.** `pinned_steps` keeps the step and drops the run, so a pin protects that step in every run. Symptom: a pin on one run's checkpoint keeps the same step in all other runs, and storage is not freed. Fix: match `(run, step)` against a set of pairs.
5. **Ties broken by input order.** The sort key is the metric alone; Python's sort is stable (with `reverse=True` too), so equal metrics keep their input order, which changes from night to night. Symptom: the checkpoint kept as best changes between runs of the planner. Fix: sort by `(metric, step)` for "min" and `(-metric, step)` for "max", with no `reverse`.

Each bug has its own check in which the others do not show: two runs with very different steps, `keep_last = 2` and no other rule active (bug 1); one run with `metric_mode` "min", distinct metrics and no step 0 (bug 2); one run with step 0 and `keep_best = 0` (bug 3); two runs with the same steps, `keep_last = keep_best = 0` and a pin on one of them (bug 4); one run in "max" mode with two tied best metrics, the later step listed first (bug 5). The other checks (a checkpoint kept by two rules with `keep_last` larger than a run, a pin on a checkpoint already deleted, a tie in "min" mode, and every rule at once) also catch one or more of the bugs and stay as regression checks. Random samples can hit several bugs at once at Hard and Very Hard. At Medium they hold a single higher-is-better run with no pins, no step 0 and no ties, so they pass on the original code and the checks carry the signal, which is deliberate: the reported symptoms come from the cases the samples do not cover.

**Explanation.** A retention plan is a union of independent "keep" rules, each scoped to a run, followed by one subtraction. Every bug breaks either the scope of a rule (bugs 1 and 4: per run, and per checkpoint identity), its meaning (bug 2: direction; bug 3: step 0 is a multiple of every N), or its determinism (bug 5). Fixing them keeps the structure: group once by run, sort within each run, then match on `(run, step)`.

**Complexity.** O(n log n) for the per-run sorts and O(n + p) for the every-Nth rule and the pins. The timing test (50 000 or 100 000 checkpoints across 1 000 or 2 000 runs, 5 000 pins) takes about 0.2 to 0.45 s in CPython, and generating it about 0.1 to 0.2 s. A fix for bug 4 that scans the pin list for every checkpoint (`any(r == run and s == step for r, s in pins)`) is O(n·p), 500 million comparisons at the test size, and fails the timing check; so does building each run's list with a filter over all checkpoints (O(n · runs)).

**Dialect notes.** In SQL: `ROW_NUMBER() OVER (PARTITION BY run ORDER BY step DESC)` for the last k; `ROW_NUMBER() OVER (PARTITION BY run ORDER BY metric ASC, step ASC)` (or `metric DESC, step ASC` for "max") for the best n; `step % every = 0`; a join to the pins on both columns; deletions are the checkpoints where none holds. `NULLS FIRST/LAST` matters if a metric can be missing: PostgreSQL sorts NULLs last in ascending order, MySQL first. Spark's window functions behave the same as PostgreSQL's here. Not executed here.

**Edge cases built into the tests.** Two runs of very different lengths; a "min" metric; step 0; the same step in two runs with one pinned; tied metrics in both directions; `keep_last` larger than a run; a checkpoint kept by two rules; a pin on a checkpoint that no longer exists (and on a run that does not exist); all rules at once across three runs.

**Common mistakes.** Fixing bug 2 by flipping `reverse` for both modes; fixing bug 5 with `reverse=True` on a `(metric, step)` key, which puts the later step first among ties; fixing bug 3 with `step >= every`; matching pins with a string `f"{run}:{step}"` without checking for separators in run names; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Plan only over checkpoints marked complete (a manifest written last, or a commit marker), and treat the newest complete checkpoint as the latest; never let an in-progress one count towards `keep_last`. (2) Return, or log alongside the plan, the rules that kept each checkpoint, behind a new function or an optional argument so existing callers keep their output. (3) Re-read the pins and re-check the plan immediately before each deletion (or take a lease on the pin table), and make deletion move files to a short-lived trash first, so a late pin can still restore them. (4) Record per checkpoint `planned`, `deleting` and `deleted`, delete shards idempotently, mark a checkpoint deleted only when every shard is gone, and resume `deleting` ones on the next run; never count a half-deleted checkpoint as kept.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also groups the bugs by what they break (scope, meaning, determinism), adds a regression test per bug, keeps the fix linear, and answers the in-progress and late-pin follow-ups concretely.

**Strong signals.** Reads the policy's allowed values before reading the code; tests ties with the input in both orders. **Red flags.** "Ties do not matter, any best checkpoint is fine"; fixing the pin bug with a nested loop over the pins.

## GDM-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Client library.** Metric calls append to an in-memory buffer and return at once; a background thread sends batches every few seconds or at a size limit. The buffer is bounded; when it fills, the client spills to local disk, and when that fills it drops points by a stated policy (oldest first, or keep every Nth step) and counts what it dropped, so training never blocks. Each batch carries `(run_id, attempt, client_seq)`; retries resend the same identity. Run metadata (config, seed, code version, environment) is sent once at start and is required before metric batches are accepted.
- **Write API.** Stateless servers validate a batch (size, number of new metric names, step ranges), append it to a durable log partitioned by `run_id`, record `(run_id, attempt, client_seq)` in a batch ledger, and acknowledge. A batch already in the ledger is acknowledged without being applied again. Per-run and per-project quotas reject a runaway job with a clear error the client surfaces in the job's own logs.
- **Resumes.** A resume calls `start_attempt(run_id, from_step)`, which records `attempt n+1` with the checkpoint step it resumed from. Points are stored keyed by `(run_id, metric_id, step, attempt)`. The value shown at a step is the one from the highest attempt that wrote it; lower attempts' points above the resume step are marked superseded, not deleted, and remain queryable for debugging. Late points from an older attempt therefore never replace a newer attempt's values.
- **Storage.** Run metadata in a relational store (runs, attempts, configs as immutable rows keyed by a content hash, checkpoints with step, path and status). Metric names are interned per project into ids. Points go to a time-series layout partitioned by run, clustered by `(metric_id, step)`, with columnar files compacted from the log, so one run's series is one sequential read.
- **Comparisons.** For every run and metric, a summary row (last value, best value and step, count, last step) and downsampled series at a few resolutions (for example 1 000 and 10 000 buckets by step), each bucket keeping first, last, min and max, so a spike survives. They are updated incrementally as points arrive and rebuilt for a run after a resume or late points. A comparison of {{compare_runs}} runs reads summaries plus one downsampled series per run.
- **Limits.** Caps on metric names per run, points per run per minute and batch size, enforced at the API with explicit errors and visible in the run page; the cap that triggered is recorded with the run.

**Competing designs to accept.** Writing points straight to a time-series database with upserts on `(run, metric, step)` plus an attempt column; a stream processor maintaining downsampled series instead of batch compaction; storing only the latest attempt's values and archiving superseded points to cold storage. All are fine if retries are harmless, the latest attempt wins per step, superseded values survive, and comparisons read summaries rather than raw points.

**Bottlenecks and failure modes.** Clients that block training on a slow tracker; last-write-wins by arrival, which lets late points from an old attempt win; metric-name explosions; hot partitions for a few huge runs; downsampling by averaging, which hides spikes; comparisons that scan raw points; configs edited after the run started.

**Incident guidance.**
- *Attempt 1's late points replaced attempt 2's values*: the store kept the last value written for a step instead of the value of the latest attempt. Store points per attempt, resolve the shown value by attempt number, rebuild the affected run's summaries and downsampled series, and add a check that alerts when a point arrives for an attempt lower than the run's current one (and counts them).
- *A metric per parameter group, millions of names in an hour*: there was no cap on metric names per run. Reject new names above a per-run cap with a clear error, quarantine the run's extra names, clean them from the shared names table, and give each project its own name space so one sweep cannot slow everyone else.
- *Write API down for forty minutes; some jobs dropped points, others stalled*: clients had unbounded or blocking send paths. Make sends asynchronous with bounded memory plus disk spill, a stated drop policy with counts reported when the API returns, jittered backoff so the backlog drains without a stampede, and a health signal so the client switches to spill early.

**Follow-up guidance.** (1) The client spills to disk and drains with jittered backoff and a rate cap; the API prioritises fresh points over backlog per run, and the batch ledger makes replays harmless. (2) A per-run name cap at the API; the job sees an error in its own logs and the run page says which cap was hit; the names already written stay readable. (3) Read {{compare_runs}} summary rows and {{compare_runs}} downsampled series of about 1 000 buckets each; never raw points, which are read only when someone zooms into a range of one run. (4) Overlay the attempts on the run page with the resume step marked, and compute the difference between attempts over the overlapping steps; the config and code version of each attempt are shown side by side.

**Rubric anchors.** 2: the job writes synchronously to the tracker, or points are overwritten by arrival, or comparisons scan raw points. 3: async bounded client, idempotent batches, per-attempt storage with the latest attempt shown, summaries and downsampled series. 4: also min/max-preserving downsampling, quotas with clear feedback, immutable configs, and a plan for each incident.

**Strong signals.** Asks what a resume does to steps before designing storage; separates "the value shown" from "the values stored". **Red flags.** "The client retries until the tracker accepts it" with no bound; "average the points into buckets".

## GDM-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Pinned snapshot and diff.** The release starts from a numbered catalogue snapshot, copied into the pipeline's own store with its checksum. A diff against the previous release's snapshot, by accession and sequence checksum (and fragment for long sequences), classifies every entry: new, sequence changed, unchanged, withdrawn. A model-version change adds a fourth class, recomputed. The diff is a table kept with the release and drives every later step; its counts are part of the release notes.
- **Matching predictions.** The prediction job hands over each prediction with the sequence checksum it was computed for and the model version. A prediction is attached to an entry only if its checksum equals the snapshot's checksum for that accession and fragment; anything else is rejected and listed. Carried-over entries are matched the same way, against the old prediction's recorded checksum.
- **Immutable files.** Every file (structure in each format, confidence values, predicted aligned error) is stored under a name with entry id, model version and a content hash, write-once. A release is a manifest: entry → file names and checksums. Unchanged entries point at the files they already had, so nothing is copied; only {{changed_share}} of entries produce new files.
- **Validation gates.** Hard gates: every published entry's checksum matches the snapshot; every file exists, parses, and has a checksum equal to the manifest's; per-organism completeness (entries expected from the diff equals entries present); counts reconciled with the diff; per-residue confidence arrays as long as the sequence. Warnings: large shifts in confidence distributions per organism, unusually many withdrawals. A release goes live only after the hard gates pass and a named person signs off; both are recorded.
- **Archives.** Per-organism archives are built from the manifest; an archive whose set of entry files is unchanged since the last release is carried over by reference with its checksum. Each archive has a checksum file, and a release-wide manifest lists every archive and every file with checksums, so mirrors can verify and fetch only what changed.
- **Switch and rollback.** The website, the API and the download index all resolve "the live release" from one small, versioned pointer (a row or an object) and nothing else. Going live is one write of that pointer after everything is published and validated; rolling back is the same write with the previous release id. Past releases stay in the immutable store; withdrawn entries keep their old versions.

**Competing designs to accept.** Rebuilding every file each release if the candidate measures the cost at {{entries}} entries and argues for simplicity; separate pointers per surface switched by one orchestrated transaction with a verification step; per-organism staged go-live. All are fine if a prediction can never be published under the wrong sequence, files are immutable, and no surface can show a different release from the others.

**Bottlenecks and failure modes.** Matching by accession alone; rebuilding and re-uploading unchanged files and archives; mutable file names that change content; switches done surface by surface; a rollback that cannot find the previous files; archive checksums computed before the final bytes; gates that warn when they should fail.

**Incident guidance.**
- *Predictions published for accessions whose sequence had changed*: the match compared accessions, not sequence checksums. Withdraw the affected entries from the latest release (a new pointer, not edited files), publish a correction notice listing them, recompute them, and make the sequence-checksum match a hard gate with a test that injects a changed sequence.
- *Every per-organism archive rebuilt every release*: archives were built from scratch rather than from the manifest diff. Carry over archives whose content set is unchanged, rebuild only organisms with changes, deduplicate storage by content hash, and track per-release bytes written as a release metric with a budget.
- *The API moved and the website did not, for {{switch_minutes}} minutes*: each surface had its own notion of the live release. Put all three behind one pointer, read per request (or cached with a short bound and the release id carried in every response), and add a post-switch check that samples entries through every surface and compares release ids and file checksums.

**Follow-up guidance.** (1) Rebasing means re-running the diff; only accessions whose checksum changed between the two snapshots need new predictions, so the cost is that subset's compute plus revalidation. Decide by the size of that subset and the release date, and record which snapshot the release is aligned to. (2) That organism fails its hard gate: either exclude the affected entries (and say so in the notes) or hold the organism's archive, while releasing the rest if completeness rules allow; never publish them. (3) Publish a release manifest with per-archive and per-file checksums and stable names; mirrors diff manifests to fetch changes and verify each file. (4) Publish the fix as new files under new versioned names in a point release; old files and their checksums stay as they were, so citations still resolve, and the release notes explain the change.

**Rubric anchors.** 2: accession-only matching, or files overwritten in place, or surfaces switched separately. 3: pinned snapshot and diff, checksum matching, hard gates, immutable files with carry-over, archives with checksums, one release pointer. 4: also reconciled counts and sign-off, archive carry-over, a rollback that is one pointer write, mirror-friendly manifests, and a plan for each incident.

**Strong signals.** Asks how a prediction proves which sequence it was computed for; treats the release as a manifest over immutable files. **Red flags.** "Copy the new release over the old one"; "switch the API first, then the website".
