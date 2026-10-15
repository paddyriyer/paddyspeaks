# Google DeepMind · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public domain of an AI research lab whose
science and model work is published: experiment tracking and reproducibility
(runs, configs, seeds, checkpoints), and a public database of predicted protein
structures with per-residue confidence, releases aligned to a sequence catalogue,
bulk downloads and an API. Science products are described only from their public
documentation. Every run, structure, coordinate, confidence value, metric, count,
volume and rule is synthetic and "this exercise's rule; check current docs";
nothing here describes a real model result, experiment, release or internal
system. Protein topics are data and geometry only.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GDM-L2-01: Residue contacts in a predicted structure, at an exact cutoff

| | |
|---|---|
| **Template ID** | GDM-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Spatial hashing / 3D cell lists of cutoff-sized cubes, exact integer distances, sequence separation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | GDM-L2-01.mjs |

**Business Scenario.** A public database of predicted protein structures offers each prediction as a file of atom coordinates with a confidence score for every residue. Many people who download the files compute the same thing first: the residue contacts, the pairs of residues that sit close together in the predicted fold although they are far apart along the chain. The data team wants to ship a contact list with every entry in a derived bulk download, so that nobody has to recompute it, and the list must be exactly reproducible: the same file and the same cutoff always give the same pairs. The first entry to check is {{structure}}. Each residue is represented by one atom whose coordinates are given in thousandths of an ångström, as integers.

**Problem Statement.** Implement `residue_contacts(residues, cutoff, min_conf=0)`. `residues` is a list of `(residue_number, x, y, z, confidence)` tuples, one per residue, with `x, y, z` the integer coordinates of the residue's representative atom in thousandths of an ångström (they can be negative) and `confidence` an integer from 0 to 100. Residue numbers are unique. `cutoff` is a positive integer in the same units. Two residues `a < b` (by residue number) are a contact when both are counted, `b - a >= 3`, and the squared distance between their atoms is at most `cutoff * cutoff`: the boundary is inclusive and exact. A residue is counted when its confidence is at least `min_conf`. Return every contact as a tuple `(a, b)`, each pair once, sorted by `a` and then `b`. Return `[]` when there are none. {{level_rule}}

**Constraints.** The timing check is a compact synthetic globule of 50 000 residues (far more than one chain, so that the cost shows) about 296 ångströms across, with an 8 ångström cutoff. Comparing every pair is 1.25 billion distance checks. Sorting by `x` and scanning forward while `x` is within the cutoff does not save you here: in a compact fold every slab one cutoff wide still holds about 1 300 residues. Something close to O(n + contacts) is expected.

**Assumptions.** Structures, coordinates, confidence values and cutoffs are synthetic. Which atom represents a residue (often the beta carbon, or the alpha carbon for glycine), the cutoff and the confidence floor are this exercise's rules; check current docs for how contacts and confidence are defined and used. The contact list describes geometry only: nothing here draws a biological, medical or clinical conclusion from a prediction.

**Clarifications.**
- Q: Is a pair exactly at the cutoff a contact? | A: Yes. Compare `dx*dx + dy*dy + dz*dz <= cutoff*cutoff` in integers; no square roots, no floats.
- Q: Why leave out residues fewer than 3 apart in the chain? | A: Neighbours along the chain are always close because they are bonded to each other, so they say nothing about the fold. In this exercise `b - a` must be at least 3, counted in residue numbers.
- Q: Can coordinates be negative? | A: Yes. The origin is arbitrary, and a structure can sit on both sides of it.
- Q: Is a residue exactly at `min_conf` counted? | A: Yes. Only residues below it are left out, and every contact they were part of goes with them.
- Q: What if two residues are listed out of order, or numbers have gaps? | A: Only at Very Hard. Separation is always by residue number, never by position in the list.
- Q: What do I return for a structure with no contacts? | A: An empty list.

**Hints.**
1. Two atoms within the cutoff can be at most one cutoff apart along each axis. Which residues can never be partners of a given one?
2. Put every counted residue in a cube of side `cutoff`, keyed by `(x // cutoff, y // cutoff, z // cutoff)` in a dict. A residue's partners are in its own cube or one of the 26 cubes around it.
3. To check each pair once, compare a cube with itself and with 13 of its 26 neighbours (one of each opposite pair). Python's `//` rounds down for negative numbers too, which is what the keys need.

**Follow-ups.**
1. The contact list must be computed for every entry in a release, hundreds of millions of residues in all. How would you run it as a batch job, and how large is the output?
2. Users want contacts at several cutoffs, from 6 to 12 ångströms, from one pass. How would you size the cubes, and what would you store?
3. A new model version changes some predictions. How would you report, per entry, the contacts that appeared and disappeared, and what would you say about contacts between low-confidence residues?
4. Contacts between two chains of a predicted complex are needed too. What changes in the input, the separation rule and the output?

**Follow-up rules.**
- when: all pairs, every pair, nested loop, itertools.combinations → ask: How many pairs are there at 50 000 residues, and how long does that take at about ten million comparisons a second in Python?
- when: sort by x, sorted by x, slab, bisect → ask: After sorting by x, how many residues share a slab one cutoff wide in a fold about 37 cutoffs across? What does that make the cost per residue?
- when: grid, cell, cube, voxel, bucket → ask: Why must the cube side be at least the cutoff? What would you have to change if you made it half the cutoff?
- when: kd tree, kd-tree, kdtree, ckdtree, octree → ask: What does building and querying the tree cost here, and how do you make sure a pair exactly at the cutoff is included?
- when: sqrt, math.dist, float → ask: Two atoms are exactly one cutoff apart. Can your floating-point distance put them just beyond it? How do you keep the boundary exact?

**Evaluation Criteria.** Exact integer comparison of squared distances with an inclusive boundary; the separation rule by residue number, at least 3; residues below the confidence floor left out with all their contacts at Hard and Very Hard; gapped, unordered numbering handled at Very Hard; each pair once, sorted; negative coordinates bucketed correctly; a cell list (or a k-d tree argued carefully) close to O(n + contacts), with a clear argument for why the slab scan is still quadratic on a compact fold; sensible answers on batch runs, several cutoffs and comparing model versions.

## GDM-L2-02: Ablation pairs — runs in a sweep whose configs differ in exactly one hyperparameter

| | |
|---|---|
| **Template ID** | GDM-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing / one masked signature per key, grouping instead of pairwise comparison, config normalisation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | ml-platform-engineer, software-engineer, data-engineer, senior-data-engineer, ai-infra-engineer |
| **Generator** | GDM-L2-02.mjs |

**Business Scenario.** Researchers launch sweeps: many runs of one experiment with different hyperparameters. To read a sweep as an ablation they compare two runs whose configs differ in exactly one hyperparameter, so that a difference in results can be traced to that one change. The experiment tracker should list every such pair for {{sweep}}, with the hyperparameter that differs, as soon as the sweep's configs are known. Runs that repeat a config exactly are reruns, not ablations, and must not be listed.

**Problem Statement.** Implement `ablation_pairs(runs, ignore=(), defaults=None)`. `runs` is a list of `(run_id, config)`, where `config` is a dict from key to value. Run ids are unique strings of a fixed width. Keys in `ignore` are never compared. A run's effective config is its `config`, with any key it omits taken from `defaults`, and without the ignored keys. Two runs form an ablation pair on key `k` when their effective configs differ in `k` and agree on every other key. Return every pair as `(run_a, run_b, k)` with `run_a < run_b`, sorted by `run_a`, then `run_b`, then `k`. Runs whose effective configs are identical are never a pair. Return `[]` when there are no pairs. {{level_rule}}

**Constraints.** The timing check is a sweep of 24 000 runs with ten hyperparameters of four values each. Comparing every pair is 288 million comparisons. Grouping by one hyperparameter first does not save you: with four values, each group still holds about 6 000 runs. Something close to O(n·k) dictionary operations (on signatures of length k) plus the size of the output is expected.

**Assumptions.** Runs, configs and values are synthetic. Values are numbers, strings or booleans, and the values of one key always have the same type, so `==` is the comparison. Configs are flat: nested configs are out of scope until the follow-ups. A pair says only that two configs differ in one key; whether one run per config supports a conclusion is not this function's question.

**Clarifications.**
- Q: If three runs differ only in the learning rate, how many pairs is that? | A: Three: every two of them.
- Q: Two runs have exactly the same config. Are they a pair? | A: No. They differ in no key; they are reruns.
- Q: Does the order of keys in a config matter? | A: No. A config is a dict: the same keys and values are the same config whatever the order.
- Q: Which run comes first in a pair? | A: The smaller run id as a string. Ids have a fixed width, so string order is the order you would expect.
- Q: Can the same pair appear twice with different keys? | A: No. A pair that differs in exactly one key has exactly one key to report.

**Hints.**
1. Two runs differ in exactly key `k` when they agree on every key except `k`, and disagree on `k`.
2. For each key `k`, build a signature from the run's values for every other key, in a fixed key order, and group runs by it. Inside a group, two runs with different values for `k` are a pair; two with the same value are identical configs.
3. Normalise each config once, before any signature: a fixed key order, defaults filled in, ignored keys dropped. Never fill a default with `or`.

**Follow-ups.**
1. Researchers also want pairs that differ in at most two keys. How does the signature approach extend, and what does it cost with ten keys?
2. One run logged a learning rate as `3e-4` and another as a value computed in code that prints as `0.00030000000000000003`. Should they match, and how would you normalise values without hiding real differences?
3. Configs become nested (`optimizer.beta2`, `model.layers`), with lists for some values. How would you flatten them, and what counts as one hyperparameter?
4. New runs join the sweep every few minutes. How would you keep the pairs up to date without recomputing them all?

**Follow-up rules.**
- when: all pairs, every pair, nested loop, itertools.combinations → ask: How many pairs of runs are there at 24 000 runs, and how many key comparisons does that make?
- when: group by, groupby, bucket, partition → ask: Which key do you group by first? With four values for it, how many runs share a group, and what do you do inside the group?
- when: signature, mask, masked, tuple → ask: How do you build the signature so the same config always gives the same key, whatever the order of keys in its dict?
- when: default, defaults → ask: A run sets `dropout` to `0.0` explicitly and the default is `0.1`. Walk through what your lookup returns.
- when: json, json.dumps, str, string → ask: You compare configs as strings. What happens to key order, and to `0.1` written as `0.10`?

**Evaluation Criteria.** Exactly one differing key per pair, identical configs excluded; every pair among several values of one key; pairs ordered within and sorted overall; ignored keys never compared at Hard and Very Hard; defaults filled for omitted keys without treating `0.0` or `False` as missing at Very Hard; masked signatures (or an equivalent hashing scheme) close to O(n·k) plus output, with a clear argument for why grouping by one key stays quadratic; sensible answers on two-key pairs, value normalisation, nested configs and incremental updates.

## GDM-L2-03: Debug the checkpoint retention planner

| | |
|---|---|
| **Template ID** | GDM-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Retention policies / per-run keep-last, metric direction, inclusive step rules, composite keys, deterministic ties |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | ml-platform-engineer, data-engineer, senior-data-engineer, software-engineer, ai-infra-engineer |
| **Generator** | GDM-L2-03.mjs |

**Business Scenario.** Training runs save checkpoints often, and checkpoint storage fills up. A nightly retention planner decides which checkpoints to delete under a policy: keep the most recent checkpoints of each run, the best ones by an evaluation metric, every Nth step as a sparse history of the run, and anything an evaluation still points at. Researchers have reported several problems. A team's short runs lost all their recent checkpoints on a night when another team's long run was in the same batch. For a loss metric, the planner kept the worst checkpoints as "best". The step-0 checkpoint, the starting point every ablation compares with, was deleted although the policy keeps every Nth step. A pin on one run's checkpoint kept the same step in every other run. And when two checkpoints have the same metric, the one kept as best changes from night to night. The planner below is the suspect.

**Problem Statement.** Fix `plan_deletions(checkpoints, policy, pins)` so that it meets this specification. {{retention_rule}}
1. **Checkpoints.** `checkpoints` are dicts `{"run", "step", "metric"}`, one per saved checkpoint; `(run, step)` is unique. The list is in no particular order.
2. **Policy.** `policy` is `{"keep_last", "keep_best", "metric_mode", "every"}`: `keep_last` and `keep_best` are integers of 0 or more, `metric_mode` is `"min"` (lower is better, as for a loss) or `"max"` (higher is better, as for an accuracy), and `every` is a positive integer.
3. **What is kept.** A checkpoint is kept when any of these holds: it is among the `keep_last` highest steps **of its own run**; it is among the `keep_best` best metrics of its own run, where ties on the metric go to the earlier step; its step is a multiple of `every`, step 0 included; or `(run, step)` is in `pins`.
4. **Pins.** `pins` is a list of `(run, step)` pairs. A pin protects exactly that checkpoint. A pin on a checkpoint that is not in the list (already deleted) changes nothing.
5. **Output.** The `(run, step)` pairs of every checkpoint that is not kept, sorted by run and then step.

**Constraints.** Keep the function's name, arguments and output format. Up to 100 000 checkpoints and 5 000 pins, processed in close to linear time.

**Assumptions.** Runs, steps, metrics and pins are synthetic, and so is the policy; check current docs for any real tool's retention rules. The planner only produces a plan: deletion happens elsewhere, so the plan must be right before anything is removed.

**Clarifications.**
- Q: Is "most recent" by step or by the time the file was written? | A: By step.
- Q: Is step 0 a multiple of `every`? | A: Yes. `0 % every == 0`, so the starting checkpoint is kept by that rule.
- Q: Two checkpoints of a run tie for the best metric and `keep_best` is 1. Which is kept? | A: The earlier step, whatever order they arrive in.
- Q: A checkpoint is kept by two rules. Does it count twice towards anything? | A: No. The rules only decide whether it is kept; it is kept once.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Run the planner on two runs with very different step counts and `keep_last = 2`. Which run keeps what?
2. Print `lower_is_better` for a policy whose `metric_mode` is `"min"`.
3. What does `0 and anything` evaluate to in Python?
4. What identifies a checkpoint, and what does `pinned_steps` hold?
5. Python's sort is stable. When two metrics are equal, which checkpoint comes first, and why does that depend on the input?

**Follow-ups.**
1. A training job is still writing a checkpoint while the planner runs. How do you make sure a half-written checkpoint is never planned for deletion, or counted as the latest?
2. Researchers want a dry run that says, for every kept checkpoint, which rule kept it. How would you change the output without breaking existing callers?
3. A pin is added after the plan is computed and before the deletion runs. How do you make deletion safe?
4. Checkpoints are sharded over many files, and a deletion fails halfway through one. What state do you record, and what does the next night's run do?

**Follow-up rules.**
- when: sorted, stable, tie, ties → ask: Python's sort is stable. Why does that make ties depend on the input order, and which sort key makes the result independent of it?
- when: pin, pins, pinned → ask: What identifies a checkpoint? Show a pin that protects the wrong checkpoint in the original code.
- when: step 0, zero, falsy → ask: Where else in a data pipeline can a value of 0 be treated as missing, and how would a test catch it?
- when: globally, across runs, per run → ask: Which other rule in the policy is per run, and how would you test that it stays per run?
- when: delete, deletion, race → ask: The plan is computed at 01:00 and deletion runs at 03:00. What could change in between, and what does the deletion step check first?

**Evaluation Criteria.** Finds and explains every bug with its symptom for researchers; the last `keep_last` checkpoints kept in each run; the metric direction taken from `"min"` and `"max"`; ties on the metric broken by the earlier step whatever the input order; step 0 kept by the every-Nth rule; pins matched on `(run, step)`; minimal fixes that keep the output format and stay close to linear; a regression test per bug; sensible answers on in-progress checkpoints, dry runs and safe deletion.

## GDM-L2-04: Experiment tracker ingestion — runs, configs and metric points from many jobs, with resumed runs, late writes and fast comparisons

| | |
|---|---|
| **Template ID** | GDM-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Write paths / client batching, idempotent ingestion, step rewrites after resume, time-series layout and downsampling for comparisons |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | ml-platform-engineer, data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, ai-infra-engineer |

```params
{
  "active_runs": {"2": ["2 000", "6 000"], "3": ["40 000", "100 000"]},
  "metrics_per_step": [20, 100, 400],
  "log_interval": ["every step", "every 10 steps", "every 100 steps"],
  "compare_runs": [50, 200, 1000]
}
```

**Business Scenario.** A research lab's experiment tracker records every training and evaluation run: who launched it, its config and seed, its code version, the checkpoints it saved, and its metric points. At any moment about {{active_runs}} runs are writing, each logging {{metrics_per_step}} metrics {{log_interval}} through a client library inside the job. Jobs are pre-empted and resumed from their last checkpoint, so a resumed run writes steps it has already written. Some jobs buffer metrics when the network is slow and send them minutes or hours later. Researchers open a sweep and overlay a metric for up to {{compare_runs}} runs at once, and expect the chart and a table of final values to load in a few seconds.

**Problem Statement.** Design the tracker's ingestion and storage. Cover the client library (buffering, batching, retries, what happens when the tracker is down), the write API and how a batch is made idempotent, how a resume is recorded and which value of a rewritten step is shown, how late points land, the storage layout for metric points and for run metadata (config, seed, code version, checkpoints), how a comparison of {{compare_runs}} runs is served in seconds, and what the tracker does when a job writes far more than expected.

**Constraints.** A training job must never slow down or fail because the tracker is slow or down. A retried batch must never create duplicate points. After a resume, the chart must show one value per step, the one from the attempt that is still running, while the overwritten values stay available for debugging. A comparison must not read every raw point of every run. Configs and seeds are written once, when the run starts, and never changed afterwards.

**Assumptions.** Volumes, intervals and limits are hypothetical, and nothing here describes how the lab's own tools are built; check current docs for any real product's behaviour. Each job knows its run id, an attempt number that grows with every resume, and the step of each point. Clocks on training hosts can disagree by seconds.

**Clarifications.**
- Q: What is a step rewrite? | A: A job pre-empted at step 12 400 resumes from its checkpoint at step 12 000 and writes steps 12 001 to 12 400 again, with different values.
- Q: Which value of a rewritten step does the chart show? | A: The value from the latest attempt. Older values stay queryable, marked as superseded.
- Q: How late can points arrive? | A: Usually seconds; after a network problem, hours. Points for a run that has finished can still arrive.
- Q: Do researchers need every raw point in the chart? | A: No, but a spike or a divergence must stay visible after any downsampling.
- Q: Can one job write a huge number of metrics by mistake? | A: Yes. A bug can log one metric per parameter or per example; the tracker must survive it.

**Hints.**
1. Give every batch an identity (run, attempt, client sequence number) so that a retry is recognisable, and make writes upserts keyed by `(run, attempt, metric, step)`.
2. Store points per attempt and resolve "the value at this step" by the highest attempt that wrote it, instead of deleting the older attempt's points.
3. For comparisons, precompute per-run summaries (final value, best value) and downsampled series that keep the minimum and maximum of each bucket, so a spike survives.

**Follow-ups.**
1. The tracker is down for an hour. What does the client do with an hour of points, and how does the backlog drain without overloading the tracker when it comes back?
2. A job logs a new metric name for every example, and the run reaches two million metric names. Where do you stop it, and what does the researcher see?
3. A researcher compares {{compare_runs}} runs that each have five million steps. Walk through the query and what it reads.
4. Two attempts of the same run disagree at step 12 300 by a large amount. How does the tracker help someone see that the resume changed the run's behaviour?

**Follow-up rules.**
- when: kafka, queue, stream → ask: Points for one run land on several partitions. How do you keep a resumed attempt's rewrite from being applied before the original points it replaces?
- when: overwrite, upsert, replace → ask: Attempt 1's late points for step 12 300 arrive after attempt 2 wrote the same step. Which value does the chart show, and why?
- when: downsample, downsampling, average, bucket → ask: A loss spike lasts three steps out of five million. Does it survive your downsampling into 1 000 points?
- when: timestamp, wall clock, clock → ask: Two hosts' clocks disagree by seconds. Which field orders the points, and where does the timestamp still matter?
- when: retry, retries, idempotent, idempotency → ask: A batch is retried after a timeout, but the first attempt was in fact stored. What makes the second one harmless?

**Production Reality Check.**
- A job resumed from step 12 000 after a pre-emption, but its buffered points from the first attempt arrived twenty minutes later and replaced the second attempt's values for steps 12 001 to 12 400 on the chart, so a learning-rate change looked as if it had done nothing.
- One sweep's runs logged a metric per parameter group by mistake, the metric names table grew by millions of rows in an hour, and comparisons slowed down for every team.
- The tracker's write API was down for forty minutes, client buffers filled, and some jobs dropped points silently while others stalled their training loop waiting to send.

**Evaluation Criteria.** A client that never blocks or fails training, with bounded buffers and an explicit policy when they fill; batch identities and upserts that make retries harmless; attempts recorded and the latest attempt's value shown per step, superseded values kept; late points landing in place; a storage layout split between immutable run metadata and time-series points; summaries and min/max-preserving downsampled series for comparisons of {{compare_runs}} runs; limits on metric names and points per run with clear feedback; a plan for each incident.

## GDM-L2-05: Structure database release pipeline — predictions aligned to a catalogue snapshot, per-organism archives with checksums, and one switch for the API and the website

| | |
|---|---|
| **Template ID** | GDM-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Batch release pipelines / snapshot alignment, validation gates, content-addressed archives and manifests, an atomic release pointer |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "entries": {"2": ["20 million", "60 million"], "3": ["200 million", "300 million"]},
  "organisms": [48, 1000, 16000],
  "changed_share": ["5%", "20%", "60%"],
  "switch_minutes": [10, 30, 60]
}
```

**Business Scenario.** A public database of predicted protein structures publishes a new release a few times a year. Each release is aligned to one snapshot of a public sequence catalogue: an entry exists for a catalogue accession at a given sequence version, and its prediction must have been computed for exactly that sequence. A release holds about {{entries}} entries, each with a structure file, per-residue confidence values and a predicted aligned error file, and offers bulk archives for {{organisms}} organisms, each with checksums. Between two releases about {{changed_share}} of entries change: new sequences, sequences whose catalogue version changed, entries recomputed by a newer model version, and sequences withdrawn from the catalogue. When a release goes live, the website, the API and the bulk download index must move to it together, within {{switch_minutes}} minutes, and nobody may see one entry's files from two releases.

**Problem Statement.** Design the pipeline that turns a catalogue snapshot and a set of computed predictions into a published release. Cover how the snapshot is pinned and compared with the previous one to decide which entries are new, unchanged, recomputed or withdrawn; how each prediction is matched to the exact sequence it was computed for; the validation gates a release must pass before it can go live; how files are named and stored so unchanged entries are not copied; how per-organism archives and their checksums and manifests are built; how the website, the API and the download index switch to the release together; and how a bad release is rolled back.

**Constraints.** A prediction computed for an older sequence version must never be published under a newer one. Unchanged entries keep their files byte for byte and are not recomputed or re-uploaded. Every archive has a checksum that users can verify, and the manifest lists every file with its checksum. The switch to a release completes within {{switch_minutes}} minutes, and a rollback to the previous release is just as fast. Files of past releases stay available.

**Assumptions.** Entry counts, organism counts, change rates and the switch window are hypothetical; how the real database is built and published is not described here, so check current docs. The sequence catalogue publishes numbered snapshots with a sequence version per accession. Predictions are computed by a separate job and handed over with the sequence checksum they were computed for. The data is predictions only: nothing here draws a medical or clinical conclusion from them.

**Clarifications.**
- Q: How do you know a prediction matches the catalogue's sequence? | A: Each prediction records a checksum of the sequence it was computed for; the snapshot has the current sequence for every accession. They must be equal.
- Q: What happens to an entry whose accession was withdrawn from the catalogue? | A: It leaves the new release, its old versions stay available, and the release notes list it.
- Q: Are long proteins one entry? | A: In this exercise, long sequences are predicted as overlapping fragments, each its own entry with a fragment number.
- Q: Is the serving layer part of this design? | A: Only the switch: what you publish, and the single change that makes the website, the API and the download index use the new release. Caching and traffic are another exercise.
- Q: Who decides that a release can go live? | A: The validation gates, then a person who signs it off; record both.

**Hints.**
1. Diff the new catalogue snapshot against the previous one by accession and sequence checksum: the diff decides which entries need new predictions, which are carried over and which are withdrawn.
2. Name every file by entry, version and content hash in an immutable store; a release is then a manifest that points at files, and carried-over entries point at the files they already had.
3. Make "the live release" one small pointer that the website, the API and the download index all read, and change only that pointer when the release goes live.

**Follow-ups.**
1. Two days before a release, the catalogue publishes a newer snapshot. Do you rebase on it? What does the diff tell you, and what does it cost?
2. A validation gate finds that 0.4% of predictions in one organism were computed for an older sequence version. What do you do with that organism and with the release?
3. A research group mirrors every per-organism archive. How do you let them download only what changed, and prove that their copy is complete?
4. A bug is found in a released file format after release. How do you publish a fix without changing files that people have already cited and checksummed?

**Follow-up rules.**
- when: copy, copies, re-upload, upload → ask: {{changed_share}} of entries changed. How much data does your release move, and how do you avoid copying the rest?
- when: checksum, md5, sha256, hash → ask: Who computes the checksum, from which bytes, and how does a user check an archive against the manifest?
- when: cutover, switch, pointer, alias → ask: The API switched and the website did not. What does a user see in that minute, and how does your design make that impossible?
- when: validation, validate, gate, gates → ask: Which gates are hard failures and which only warn? Give one of each and say who can override it.
- when: rollback, roll back, revert → ask: You roll back after the download index was published. What happens to someone halfway through downloading an archive of the bad release?

**Production Reality Check.**
- A release went live with predictions for a few thousand accessions whose sequence had changed in the catalogue snapshot, because the matching step compared accessions without sequence checksums.
- The per-organism archives for {{organisms}} organisms were rebuilt for every release, although most entries were unchanged, and the release took days longer than planned and doubled the storage bill.
- During a switch, the API moved to the new release while the website's entry pages still read the old one, and for {{switch_minutes}} minutes users saw structures that did not match the confidence values on the page.

**Evaluation Criteria.** A pinned catalogue snapshot diffed against the previous one by accession and sequence checksum; predictions matched to the exact sequence they were computed for; hard validation gates (sequence match, file integrity, completeness per organism, counts reconciled with the diff) and recorded sign-off; immutable content-addressed files with unchanged entries carried over by reference; per-organism archives with checksums and a manifest, rebuilt only when they change; one release pointer read by the website, the API and the download index, switched and rolled back within {{switch_minutes}} minutes; past releases kept; a plan for each incident.
