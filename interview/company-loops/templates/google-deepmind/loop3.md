# Google DeepMind · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public domain of an AI research lab
whose science and model work is public: experiment tracking and
reproducibility, training data snapshots described as manifests and counts, a
public database of predicted protein structures with per-residue confidence,
and watermark detection results with aggregated outcomes. Science products are
described only from their public documentation. Every run, score, count,
version, rule and threshold is hypothetical and this exercise's rule (check
current docs), and nothing here describes the lab's research results, data,
compute, partners or how its own systems are built. Protein topics are data and
geometry only, with no biological or medical conclusions; watermark topics are
about detection outcomes and reporting only, and no content is kept.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## GDM-L3-01: Experiments as data — projects, runs, layered configs, seeds, code versions, checkpoints, and a run's exact recipe as of a date

| | |
|---|---|
| **Template ID** | GDM-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / immutable content-addressed config layers, per-key provenance, effective-dated named recipes, append-only run metadata |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, software-engineer |

```params
{
  "runs_per_week": {"1": ["5,000"], "2": ["40,000"], "3": ["150,000", "400,000"]},
  "config_layers": [3, 5],
  "config_keys": ["400", "2,500", "10,000"],
  "checkpoints_per_run": [10, 50, 200]
}
```

**Business Scenario.** A research lab runs about {{runs_per_week}} experiment runs a week across many projects. A run's configuration is assembled from up to {{config_layers}} layers: a shared base, a project default, an experiment file, the values a sweep generated for that run, and command-line overrides, each later layer overriding keys set by earlier ones. A resolved config has up to {{config_keys}} keys. Every run also records its seeds (data order, initialisation, evaluation sampling), a code version (a commit plus a hash of any uncommitted changes), a container image, the id of the training data snapshot it read, and the checkpoints it writes, about {{checkpoints_per_run}} per run. Researchers keep named recipes, such as "the current baseline for project P", and repoint them as the work moves on. Two questions keep coming up and today neither has a reliable answer: exactly what did run X use, and what did "the baseline" mean on a given date, as recorded then?

**Problem Statement.** Design the data model for experiments. Cover projects, experiments and runs; config layers as stored documents; each run's resolved config with the layer that set each key; seeds; code version and environment; the data snapshot reference; checkpoints with step, location, checksum and retention state; named recipes and their history; and run metadata people edit later (status, tags, notes, a run marked invalid). Show how you answer: the exact recipe of run X; the difference between two runs' resolved configs, each difference attributed to its layer; what a named recipe pointed at on date D, both as recorded on D and as corrected since; and which runs used a shared layer that was later found to contain a mistake.

**Constraints.** A run's recipe never changes after the run starts: editing a shared base later must not change any past run's resolved config. Layers and resolved configs are stored in a canonical form (sorted keys, normalised numbers and booleans) so equal configs get equal hashes. Edits to run metadata are recorded with the editor's role and the time, never overwritten. Checkpoint files can be deleted by a retention policy, but their records stay. In this exercise a run that continues with a changed config is a new run that starts from the earlier run's checkpoint, linked to it.

**Assumptions.** Run volumes, layer counts, key counts and checkpoint counts are hypothetical. Metric points a run logs, and their ingestion, are out of scope (another exercise); so are accelerator scheduling and the training loop. Nothing here describes how any lab tracks its own experiments.

**Clarifications.**
- Q: Is a layer just a file in the repository? | A: It may start as one, but the tracker stores the exact content it resolved (or a content hash pointing at stored content). The file can change afterwards.
- Q: How are sweeps represented? | A: The sweep definition is stored once; each run gets a generated layer holding its swept values.
- Q: Does marking a run invalid delete it? | A: No. It is a metadata event with a reason and a time; reports filter on the run's status as of the report's date.
- Q: Who reads this model? | A: Researchers in notebooks and a comparison page, reproducibility checks, and write-ups that cite a run by id.
- Q: Can two layers set the same key? | A: Yes, that is the point of layering; the later layer wins, and the model must say which layer won for every key.

**Hints.**
1. Treat every layer as an immutable, content-addressed document. A run references the ordered list of layer hashes it resolved and the hash of the resolved config.
2. Keep provenance per key: for each resolved key, the layer that set it last. Differences between runs then explain themselves.
3. A named recipe is a pointer that moves. Store its history as effective-dated rows with a recorded time, apart from the runs.

**Follow-ups.**
1. Write the query for "what did the baseline of project P point at on date D, as recorded on D" and "as we know it now". When do the two differ?
2. A mistake is found in one key of a shared base layer. Which runs are affected, and how do you leave out runs where a later layer overrode that key?
3. Two runs with the same resolved config hash, code version, data snapshot and seeds give different final metrics. What else would you have wanted recorded?
4. At {{runs_per_week}} runs a week with up to {{config_keys}} keys each, how do you store resolved configs so that both "show run X" and "all runs in project P where the learning rate came from a sweep" are fast?

**Follow-up rules.**
- when: json column, jsonb, config blob → ask: Someone asks for every run last month whose learning-rate schedule came from the project default rather than a sweep. Can your blob answer that, and how fast?
- when: file path, config path, path to the config → ask: The shared base file was edited after 3,000 runs used it. What does your model return for those runs' configs today?
- when: update the run, status column, overwrite → ask: A run was marked invalid by mistake and restored a week later. Which reports changed in between, and how does your model show that?
- when: hash, content hash, checksum → ask: Two configs differ only in key order and in writing 0.0003 versus 3e-4. Do they hash equal in your design, and should they?
- when: eav, key-value table, one row per key → ask: At {{config_keys}} keys per run and {{runs_per_week}} runs a week, how many rows is that in a year, and how do you rebuild one run's full config quickly?

**Production Reality Check.**
- A write-up cites a run whose resolved config, re-rendered from its stored layers, no longer matches what the run logged: layers had been stored by file path, and the shared base file was edited after the run.
- After a named recipe was repointed, a weekly report of "runs on the baseline" rewrote last month's numbers: it joined runs to the recipe's current target instead of the target in force when each run started.
- With up to {{config_keys}} keys per run, a key-per-row table of resolved configs grew to billions of rows, and the comparison page timed out on sweeps with many runs.

**Evaluation Criteria.** Immutable, content-addressed layers and a resolved config per run with per-key provenance; canonical hashing with its normalisation rules stated; seeds, code version (commit plus a hash of uncommitted changes), environment and data snapshot recorded per run; checkpoints with step, checksum and retention state; named recipes as effective-dated pointers with a recorded time; metadata edits append-only and queryable as of a date; queries for the exact recipe, attributed differences, the recipe on a date and runs affected by a bad layer; storage sized for the stated volumes; incidents explained by the model and fixed without rewriting history.

## GDM-L3-02: Training data snapshots as data — sources, licence records, filtering and deduplication passes, manifests, and which runs read which snapshot

| | |
|---|---|
| **Template ID** | GDM-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / source versions and licence records, pass runs with reconciling counts, immutable manifests, record-to-shard index, run consumption by shard |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer |

```params
{
  "sources": ["60", "400", "2,000"],
  "shards_per_snapshot": {"1": ["2,000"], "2": ["40,000"], "3": ["250,000"]},
  "snapshots_per_month": [4, 12, 30],
  "dedup_scope": ["exact matches across all sources in the snapshot", "exact and near matches across all sources in the snapshot"]
}
```

**Business Scenario.** A research lab builds training data snapshots from about {{sources}} sources. Each source arrives in versions, and each source version carries a licence record: the terms and the uses they permit, as the lab's reviewers recorded them. A snapshot is built by a pipeline of passes: format and language filters, a quality filter with a threshold you are given, deduplication of {{dedup_scope}}, and a mix with a weight per source. The output is about {{shards_per_snapshot}} shard files with checksums, and about {{snapshots_per_month}} snapshots are built a month. Training runs read snapshots by id. The catalogue never stores the documents themselves: it holds manifests, counts and checksums. It must answer: which runs read data from source S version V; what each pass removed, in counts; and, when a licence record is corrected or a source's owner withdraws some records, which snapshots and runs are affected and what the replacement snapshot contains.

**Problem Statement.** Design the data model for training data snapshots. Cover sources and source versions; licence records and their history; pass definitions with versions and parameters; a snapshot build as an ordered list of pass runs, with records in and out per source; deduplication outcomes in counts, including pairs whose copies come from two sources; the manifest of shards with checksums and per-source counts; snapshot status (building, ready, superseded, withdrawn) with reasons; and the link from training runs, and their checkpoints, to the snapshots and shards they read. Show the queries for: the per-source funnel of one snapshot; every run that read any record of source S version V; and the snapshots, runs and checkpoints affected by a withdrawal.

**Constraints.** No document contents, text, excerpts or samples are stored in the catalogue; records are identified by opaque ids assigned at ingestion. A snapshot is immutable once ready: a fix is a new snapshot that supersedes it. Counts must reconcile: per source, records in = records removed by each pass + records out. Licence records belong to the reviewers; the pipeline reads them and never edits them. In this exercise, when copies of one record come from several sources, deduplication keeps the copy from the source with the lowest priority number (this exercise's rule).

**Assumptions.** Source counts, shard counts, build frequency and the priority rule are hypothetical. Interpreting a licence is a reviewer's decision recorded as data; the model never decides it. Nothing here describes any lab's actual data, sources or licences.

**Clarifications.**
- Q: Does a run read a whole snapshot? | A: Not always. It reads shards in an order and may stop or switch mix part-way. Record which shards it actually read.
- Q: Can a withdrawal cover only part of a source version? | A: Yes. A withdrawal names a source version and either all of it or a list of record ids.
- Q: Are pass parameters part of a snapshot's identity? | A: Yes. Two builds from the same inputs with a different quality threshold are different snapshots.
- Q: Do we need lineage for every record? | A: Only enough to answer "which shards of which snapshots hold record R": an index from record id to shard, built with the manifest, never the content.
- Q: Does a licence correction change past snapshots? | A: The snapshots do not change; the model must show which licence record each build read and which record is in force now.

**Hints.**
1. Separate definitions (sources, versions, licence records, pass definitions) from builds (snapshots, pass runs with counts) and from consumption (runs reading shards).
2. Store counts in and out per pass and per source. The funnel and the reconciliation check both come from those rows.
3. A deduplication pass across sources needs one more count per pair of sources: records kept from one source whose duplicates in another were removed. That is what a withdrawal disturbs.

**Follow-ups.**
1. Write the reconciliation check for one snapshot. What do you do with a snapshot that fails it?
2. Source S withdraws 2% of its records. Which snapshots, runs and checkpoints are affected, and how do you build the replacement without rerunning every pass on every source?
3. With deduplication of {{dedup_scope}}, the withdrawn records had been the kept copies of many duplicate pairs. What happens to the other copies in the replacement snapshot, and how do the counts show it?
4. At {{snapshots_per_month}} snapshots a month with {{shards_per_snapshot}} shards each, how large is the record-to-shard index, and how long would you keep it?

**Follow-up rules.**
- when: store the text, documents, samples, content → ask: The catalogue keeps no contents. How do you answer "which shards hold record R" and "how many records of source S survived deduplication" without them?
- when: licence column, license column, licence field, license field → ask: A reviewer corrects a source version's licence record six months later. Which builds read the old record, and how does your model show what was believed when each snapshot was built?
- when: dedup, deduplication, duplicate → ask: A duplicate pair spans two sources and the kept copy's source is later withdrawn. Which copy should the replacement snapshot keep, and what in your model records that?
- when: snapshot_id on the run, one snapshot per run → ask: A run read 40% of one snapshot and then switched to another mix. What does your link record, and how do you find the runs that read a withdrawn record?
- when: update the manifest, edit the snapshot, mutable → ask: A snapshot is ready and five runs have read it. One shard turns out to be corrupt. What changes in your tables, and what stays?

**Production Reality Check.**
- A withdrawal for one source version was matched against snapshots by source name only: runs that read an older, unaffected version were flagged, and a snapshot built from the affected version under a renamed source was missed.
- A snapshot's per-source counts failed reconciliation by 0.4%: a filter pass was retried after a crash and its counts were recorded twice.
- With deduplication of {{dedup_scope}}, a replacement snapshot built after a withdrawal had fewer records from other sources than expected: the rebuild reused the old deduplication decisions, so copies removed as duplicates of the withdrawn records stayed removed.

**Evaluation Criteria.** Sources, versions and licence records kept apart, with licence history and the record each build read; pass runs with parameters and per-source counts that reconcile, checked; cross-source deduplication outcomes recorded in counts with the stated keep rule; immutable manifests with checksums and a superseding relation; a record-to-shard index for withdrawals with no content; run consumption at shard grain; withdrawal impact queries over snapshots, runs and checkpoints; incremental replacement builds that recompute deduplication correctly; sizes estimated; incidents explained by the model.

## GDM-L3-03: Predicted structures as data — entries by catalogue accession and sequence version, model versions, fragments, per-residue confidence, aligned-error files and releases

| | |
|---|---|
| **Template ID** | GDM-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / external identity versus entry versions, fragment residue ranges, per-residue arrays versus rows, files with checksums, release membership and carry-over |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "entries": {"1": ["2 million"], "2": ["50 million"], "3": ["200 million", "300 million"]},
  "releases_per_year": [2, 4],
  "fragment_rule": ["longer than 2,700 residues are predicted as fragments of 1,400 residues, a new fragment starting every 200 residues", "longer than 2,000 residues are predicted as fragments of 1,000 residues, a new fragment starting every 500 residues"],
  "median_length": [300, 450]
}
```

**Business Scenario.** A public database publishes predicted protein structures: in this exercise, one entry per sequence of a public sequence catalogue, about {{entries}} entries, with {{releases_per_year}} releases a year, each aligned to a snapshot of the catalogue. Each entry has a coordinates file, a per-residue confidence score from 0 to 100, and a predicted aligned error file: one value per pair of residues, so it grows with the square of the length (the median length is about {{median_length}} residues). In this exercise sequences {{fragment_rule}} (this exercise's rule; check current docs). Each entry is produced by a model version; a later release may recompute some entries, with a newer model version or because the catalogue changed a sequence, and carry the rest over unchanged. Researchers cite an entry by id and version, download single files, call an API, and download per-organism archives.

**Problem Statement.** Design the data model. Cover catalogue accessions and sequence versions, with organism; entries and entry versions (accession, sequence version, fragment, model version); fragments and their residue ranges; per-residue confidence; summary statistics per entry version (mean confidence, and the share of residues in each of this exercise's confidence bands); aligned-error files and the other files, with format, size, checksum and storage location; releases with their catalogue snapshot, the entry versions they contain and which of those were carried over; and per-organism archives. Show how you answer: which entry version a citation "entry E, version v" refers to; which entries in release R were computed for a sequence the catalogue has since changed; the confidence of residue i of accession A in release R when A is fragmented; and every file and archive a release contains.

**Constraints.** An entry version is immutable once released; a recomputation is a new version. Residue numbers follow the catalogue sequence version, and every fragment's residue range maps onto it. Per-residue values must be retrievable for every released version; aligned-error matrices are stored as files, not as rows. In this exercise, for a residue covered by two overlapping fragments, the value comes from the fragment in which the residue is furthest from either end, ties going to the lower fragment number (this exercise's rule). The database stores predictions and their stated confidence; it draws no biological, medical or clinical conclusion from them.

**Assumptions.** Entry counts, release cadence, the fragment rule, lengths and confidence bands are hypothetical (check current docs). Serving the website, files and API under load is out of scope (another exercise). Nothing here describes how any real database stores its data.

**Clarifications.**
- Q: Is one accession always one entry? | A: One per accession and sequence version, unless the sequence is fragmented; then one entry per fragment, all tied to that accession and sequence version.
- Q: When the catalogue changes a sequence, is the old entry deleted? | A: Not from released history. A later release recomputes it or leaves it out; the old version stays citable.
- Q: How big is per-residue data? | A: One small number per residue. The aligned-error data is length squared per entry, which is why it lives in files.
- Q: Are model versions compared anywhere? | A: Not in this model. It records which model version produced each entry version; comparisons are someone else's analysis.
- Q: What is in a per-organism archive? | A: The files of exactly the entry versions that belong to that release and organism, with a checksum per archive.

**Hints.**
1. Separate the catalogue's identity (accession, sequence version) from the database's (entry, entry version) and from release membership.
2. Store per-residue confidence compactly per entry version (an array column or a columnar file) and keep summary statistics as columns for filtering.
3. A release is a set of entry versions plus a catalogue snapshot. Carry-over is membership, not a copy.

**Follow-ups.**
1. Write the query for residue i of accession A in release R when A is fragmented under this exercise's rule.
2. A release recomputes 10% of the entries with a new model version and carries the rest. What rows are written, and what does each per-organism archive for that release contain?
3. The catalogue merges two accessions into one. What happens to their entries, to existing citations and to the next release?
4. At {{entries}} entries with a median length of {{median_length}}, estimate the bytes of per-residue confidence and of aligned-error files per release, and say where each lives.

**Follow-up rules.**
- when: one row per residue, residue table → ask: At {{entries}} entries of about {{median_length}} residues, how many rows is that per release, and which query actually needs residue-level rows?
- when: overwrite, replace the entry, update the entry → ask: A paper cites entry E as it was two releases ago. Where is that version in your model, and how is it served?
- when: accession as the key, primary key accession, keyed by accession → ask: The catalogue changes A's sequence and the residue numbering shifts. How does your key tell the old prediction from the new one?
- when: fragment, overlapping → ask: Under this exercise's rule, a residue lies in two fragments. Which value does your model return, and where is that rule recorded?
- when: archive, tarball, bulk download → ask: An archive for one organism in one release must never change after publication. What do you store about it, and how do users verify what they downloaded?

**Production Reality Check.**
- After a release recomputed some entries with a newer model version, a per-organism archive turned out to mix entry versions from two releases: the archive builder took the latest version of each entry instead of the release's members.
- Residue numbers in a fragmented entry's confidence file did not match the catalogue's numbering: fragment-local positions had been stored without the fragment's start offset.
- Summary statistics for {{entries}} entries were recomputed from per-residue values in every release, carried-over entries included, and the release missed its date.

**Evaluation Criteria.** Catalogue identity, entry versions and release membership kept apart; fragments with residue ranges mapped to the catalogue numbering and the overlap rule answerable; per-residue confidence stored compactly with summary statistics for filtering; aligned-error and other files as rows with checksums and locations, not matrices in tables; immutable, citable entry versions with model versions; releases as sets with carry-over by reference and archives built from membership; sizes estimated for the stated volume; no biological or medical claims drawn from predictions; incidents explained by the model.

## GDM-L3-04: Watermark detection results as data — detector versions, checked files by content type, segment-level results, confidence levels, and aggregates with no content kept

| | |
|---|---|
| **Template ID** | GDM-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned outcome definitions, content-free file descriptors, segment results and a derived file outcome, keyed hashes with a window, suppressed aggregates |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "checks_per_day": {"1": ["300,000"], "2": ["4 million"], "3": ["30 million"]},
  "content_types": ["images, audio and text", "images, video, audio and text"],
  "live_detector_versions": [2, 3],
  "min_cell": [20, 50, 100]
}
```

**Business Scenario.** A detection service checks whether content carries an imperceptible watermark of the kind SynthID's public documentation describes. It accepts {{content_types}} and runs about {{checks_per_day}} checks a day. Each check returns an outcome for the whole file and, for long or composite content, for segments: time ranges in audio and video, spans in text, regions in images. In this exercise a segment's outcome is detected, not detected or uncertain, each with a confidence level of high, medium or low, and a file's outcome is all, part or none of it watermarked, or inconclusive (this exercise's outcomes; check current docs). During a rollout up to {{live_detector_versions}} detector versions run at once. Content is never kept: a check keeps only the metadata reporting needs. Product and policy teams read reports of outcomes by content type, detector version, confidence level and day, and no cell with fewer than {{min_cell}} checks is ever shown.

**Problem Statement.** Design the data model. Cover detector versions per content type, with their outcome definitions and confidence thresholds; checks (channel, requester category, time) with no identities in analytics; checked files described only by content type, format and a size or duration bucket; segment-level results; the file-level outcome derived by a stated rule, with the rule's version; repeated checks of the same file; and aggregate tables with small cells suppressed. Show how you answer: outcomes by content type, detector version and confidence level per day; the share of files with part of the content watermarked; and how results compare when the same files are checked by two detector versions during a rollout.

**Constraints.** No content, thumbnail, transcript, excerpt or anything from which content could be rebuilt is stored. To recognise repeated checks of one file, a keyed hash of the file may be kept for a limited window (this exercise's rule) and never reaches analytics. Requesters appear in analytics only as a category. Cells below {{min_cell}} checks are suppressed, including cells that could be recovered by subtracting published cells from a published total. The model records outcomes and confidence levels only: how detection works, and anything about changing or removing watermarks, is out of scope.

**Assumptions.** Volumes, content types, outcome names, confidence levels, thresholds and the hash window are hypothetical. Nothing here describes how any watermarking system or detector works internally.

**Clarifications.**
- Q: Is an uncertain segment counted as watermarked? | A: No. It is its own outcome and is shown apart.
- Q: What makes a file "part"? | A: In this exercise: at least one segment detected and at least one not detected. Record the rule version that produced each file-level outcome.
- Q: The same file is checked three times in a day. What counts? | A: Keep every check. Reports count checks, and count files once by their latest check in the window.
- Q: Do detector versions share confidence thresholds? | A: No. Each version has its own definitions, which is why comparing versions needs care.
- Q: Can a result be corrected? | A: If a detector version is withdrawn, its results stay, marked with the withdrawal, and reports decide whether to include them.

**Hints.**
1. Separate the check (request metadata), the file descriptor (no content), segment results, and the derived file-level outcome with its rule version.
2. Detector versions and outcome rules are reference data with effective dates; every result row names one of each.
3. Build aggregates from the detail into cells keyed by day, content type, detector version, outcome and confidence level, and suppress small cells as the last step, complementary cells included.

**Follow-ups.**
1. Write the derivation of the file-level outcome from segment results under this exercise's rule. Where does an uncertain segment fit?
2. During a rollout the same files are checked by two versions. How do you pair the results so that agreement can be measured without keeping the files?
3. A cell with fewer than {{min_cell}} checks is suppressed, but the row total and the other cells are published. How could someone recover it, and how does your aggregate step prevent that?
4. At {{checks_per_day}} checks a day, with segment results for long content, which tables hold detail and for how long, and which aggregates are kept indefinitely?

**Follow-up rules.**
- when: store the file, thumbnail, file content, copy of the content → ask: The rule is that no content is kept. How do you investigate a reported wrong result without it, and what could you ask the reporter for instead?
- when: file hash, sha256, sha-256, hash of the file → ask: A plain hash of a public image lets anyone holding the image find its check. What do you key it with, how long do you keep it, and does analytics ever see it?
- when: user id, user_id, requester id, account id → ask: Analytics carry only a requester category. Which grain do your reports use, and where does the identifier stop?
- when: suppress, suppression, small cells → ask: A suppressed cell can be recovered as the row total minus the other cells. How does your aggregate step prevent that?
- when: raw score, probability, confidence score → ask: Each detector version defines its own confidence levels. Do you store a raw score at all, and can two versions' scores be compared?

**Production Reality Check.**
- When a new detector version reached half of the traffic, the daily share of images "part watermarked" rose sharply: the new version reported segments that the old file-level rule did not expect, and the report mixed both versions in one series.
- A weekly report published a cell below {{min_cell}} checks: suppression ran before a batch of late results was merged, and the merge split one cell into two smaller ones.
- Segment results for long audio made the detail table grow ten times faster than checks, and the daily aggregate job read every segment row since the start of the month.

**Evaluation Criteria.** Detector versions and outcome rules as versioned reference data; checks, content-free file descriptors, segment results and a derived file outcome kept apart, with the rule version recorded; uncertain and inconclusive kept as outcomes of their own; repeated checks handled with a keyed hash in a limited window that never reaches analytics; requesters only as categories; aggregates per day, content type, version, outcome and confidence level with suppression applied last, complementary cells included; version-aware comparisons during rollouts; retention and sizes for the stated volume; nothing about how detection works or how a watermark could be changed; incidents explained by the model.

## GDM-L3-05: Predictions behind the catalogue — published structures whose sequence changed after their snapshot, and days out of date, per release and organism

| | |
|---|---|
| **Template ID** | GDM-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of joins on catalogue versions, carried-over rows resolved to the computing release, entry versus sequence versions, report-date cut-offs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | GDM-L3-05.mjs |

**Business Scenario.** A public database of predicted protein structures publishes a release every few months. In this exercise each release is aligned to a snapshot of a public sequence catalogue: a prediction was computed for the sequence its accession had in the catalogue on the `catalogue_snapshot` date of the release that computed it, and the release went public later, on `released_on`. The catalogue keeps changing. An accession gets a new `entry_version` whenever its catalogue entry is updated, and its `sequence_version` goes up only when the sequence itself changes (this exercise's rule; check current docs for how a real catalogue versions its entries). {{carry_rule}} The curation team wants to know, per release and organism, how many published predictions are now behind the catalogue, and for how long. The report runs as of `{{as_of}}`.

**Problem Statement.** Write one PostgreSQL query that returns `release_id, organism, accessions, behind, behind_pct, avg_days_behind, max_days_behind`, one row per release and organism with predictions in that release, ordered by `release_id, organism`.
- The sequence version a prediction was computed for is the `sequence_version` of its accession's latest `entry_versions` row with `effective_on` on or before the `catalogue_snapshot` of the release named in `predicted_in` (an as-of join; a row effective on the snapshot date itself is included).
- A prediction is behind when its accession has a row with a higher `sequence_version` and `effective_on` on or before `{{as_of}}`. Rows effective after `{{as_of}}` are ignored, so the report can be reproduced. It became behind on the earliest such `effective_on`, and its days behind are `{{as_of}}` minus that date (0 when the change is effective on `{{as_of}}`). A new entry version whose `sequence_version` did not rise is not a change.
- {{fragment_rule}}
- `accessions` is the number of distinct accessions; `behind` how many of them are behind; `behind_pct` is 100 × behind ÷ accessions, rounded to 1 decimal; `avg_days_behind` is the mean of their days behind, rounded to 1 decimal, and `max_days_behind` the largest; both are NULL when nothing is behind.

**Constraints.** One SQL statement (CTEs allowed). Dates are stored as `DATE`; `DATE - DATE` is a whole number of days in PostgreSQL. Use `ROUND(numeric, n)`. The sample has {{release_count}} releases, {{prediction_rows}} prediction rows and {{catalogue_rows}} catalogue rows; a production database of this kind holds hundreds of millions of predictions, and the catalogue's history is far larger.

**Assumptions.** Accessions (`SYN…`), organisms, releases, versions and dates are synthetic and do not refer to real entries. "Behind" is a data-freshness measure only: it says nothing about whether a predicted structure is right or wrong, and nothing biological or medical.

**Clarifications.**
- Q: A catalogue row is effective on the snapshot date itself. Was the prediction computed for it? | A: Yes. The as-of join includes rows on or before `catalogue_snapshot`.
- Q: The sequence changed after the snapshot but before the release went public. Is that prediction behind? | A: Yes. It was already out of date on release day; its days are counted from the change.
- Q: What is `predicted_in`? | A: The release whose run computed the prediction. When it names an earlier release, the prediction was carried over unchanged and was computed for that release's snapshot.
- Q: What if the sequence changed twice after the snapshot? | A: The prediction is counted once, and its days run from the first change.
- Q: Should a release and organism with nothing behind still appear? | A: Yes, with `behind` 0, `behind_pct` 0.0 and NULL days.

**Hints.**
1. Resolve the computing snapshot first: join `predictions` to `releases` on `predicted_in`, not on `release_id`, and reduce to one row per release and accession.
2. The as-of lookup is "the latest row on or before a date": a `LATERAL` subquery with `ORDER BY effective_on DESC LIMIT 1`, or `DISTINCT ON`.
3. A LEFT JOIN to later rows with a higher `sequence_version`, up to `{{as_of}}`, with `MIN(effective_on)`, leaves NULL for predictions that are current; `COUNT(column)` then counts only the ones behind.

**Follow-ups.**
1. Add a column for how many predictions were already behind on the day their release went public. Which date replaces `{{as_of}}`?
2. The catalogue sometimes back-dates a row: it is recorded today with an `effective_on` last month. How would you make last month's report reproducible, and what extra column does that need?
3. At production scale, the as-of lookup runs over hundreds of millions of predictions. Which index or pre-computed table would you build, and how would you keep it current as the catalogue changes daily?
4. The next release should recompute exactly the predictions that are behind. Write the anti-join that lists them, and say how you would prove afterwards that none was missed.

**Follow-up rules.**
- when: released_on → ask: Which date fixes the sequence a prediction was computed for, and what does your query say about a sequence that changed between the snapshot and the public release?
- when: entry_version → ask: An annotation-only update raises `entry_version` without touching the sequence. Does your query call that prediction behind?
- when: max(effective_on), latest version, current version → ask: Your comparison uses the catalogue's latest row. What does it do with a row dated after the report date, and could you reproduce last month's report?
- when: inner join, having behind, where behind → ask: Which release and organism rows disappear when nothing in them is behind, and is that what the curation team wants to see?
- when: count(*) → ask: If a long sequence were listed as three fragment rows, what would your `COUNT(*)` count: accessions or rows?
- when: lateral, distinct on → ask: How does this as-of lookup behave on hundreds of millions of predictions, and what index turns it into a seek?

**Production Reality Check.**
- After a catalogue import, the share of predictions behind jumped from a few percent to about a third overnight: the import had copied the entry version into `sequence_version`, so every annotation update looked like a sequence change.
- A researcher reported that residue numbers in a carried-over prediction did not match the catalogue's current sequence, while this report said it was current: the report had checked carried-over predictions against the snapshot of the release that listed them, not the one that computed them.
- Rerunning last quarter's report gave different numbers each time: it compared each prediction with the catalogue's latest row instead of the rows effective on or before the report date.

**Evaluation Criteria.** The computing release resolved through `predicted_in` and its snapshot used for the as-of join, inclusive of the snapshot date; changes detected by `sequence_version`, not `entry_version`; the report date as an inclusive cut-off; days counted from the first change; accessions counted once, fragments included; every release and organism shown, with NULL days when nothing is behind; numeric rounding; deterministic order; can discuss back-dated catalogue rows, indexing the as-of lookup at scale, and driving the next release's recompute set from the same logic.
