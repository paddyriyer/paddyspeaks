# Google DeepMind · Loop 3 — evaluator notes

Simulated practice scenarios; every run, count, version, rule and threshold is
hypothetical and "this exercise's rule; check current docs". Nothing here
describes the lab's research, data or systems. Score designs on the criteria,
not on matching the reference.

## GDM-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Projects, experiments, runs.** `projects (project_id, name)`, `experiments (experiment_id, project_id, name, created_at)`, `runs (run_id, experiment_id, started_at, ended_at NULL, parent_run_id NULL, parent_checkpoint_id NULL, sweep_id NULL, resolved_config_hash, code_commit, code_diff_hash NULL, image_digest, data_snapshot_id, launched_by_role)`. Everything that defines the recipe is written once, when the run starts, and never updated. A run continued with a changed config is a new run with `parent_run_id` and `parent_checkpoint_id` (this exercise's rule).
- **Layers.** `config_layers (layer_hash PK, kind base|project|experiment|sweep|cli, canonical_json, created_at, source_hint)`, content-addressed: the hash of the canonical form (sorted keys, normalised numbers such as `3e-4` and `0.0003` to one representation, booleans and nulls normalised). `run_layers (run_id, position, layer_hash)` keeps the order. Editing a file creates a new layer; old runs still point at the old hash.
- **Resolved config with provenance.** `resolved_configs (resolved_config_hash PK, canonical_json)` shared by runs with equal configs, plus `run_config_keys (run_id, key_path, value_json, set_by_position)` or, at {{config_keys}} keys per run, the same information as one compact provenance map per run (a key → position array stored next to the resolved JSON). Keys that queries filter on often (learning rate, batch size, model size) are promoted to typed columns or a secondary index.
- **Seeds and environment.** `run_seeds (run_id, purpose data_order|init|eval_sampling|other, seed)`; image digest, library lock-file hash, accelerator type and count recorded on the run.
- **Checkpoints.** `checkpoints (checkpoint_id, run_id, step, written_at, uri, bytes, checksum, retention_state kept|expired|deleted, deleted_at NULL)`; deleting a file updates the retention state through an event, never the row's identity.
- **Named recipes.** `named_recipes (recipe_id, project_id, name)` and `recipe_pointers (recipe_id, target_run_id or target_config_hash plus code/data pins, valid_from, valid_to NULL, recorded_at, superseded_at NULL)`: two time axes, so "pointed at on D, as recorded on D" filters `recorded_at <= D` and "as known now" ignores superseded rows.
- **Run metadata.** `run_metadata_events (run_id, field status|tag|note|invalid, value, reason, editor_role, recorded_at)`; the current view is the latest event per field, and any report can ask for the state as of its own date.
- **Queries.** Exact recipe: run row + `run_layers` + resolved JSON + seeds + checkpoints. Attributed diff: full outer join of two runs' key maps on `key_path`, with each side's `set_by_position` mapped to the layer kind. Affected runs for a bad key in layer L: runs whose `run_layers` contain L and whose provenance says L set that key (a later layer did not override it).

**Competing designs to accept.** One JSONB resolved config per run plus a provenance JSON, with GIN or extracted columns for the common filters. Event-sourced runs (a run-created event carrying the full recipe). Storing only layers and resolving on read, if the resolver is versioned and pinned, and the candidate explains how a resolver change could alter old results (and caches the resolved form anyway). A recipe pointer modelled as SCD type 2 is fine at 3 if the second time axis is missing; at 4 the candidate keeps both.

**Bottlenecks and failure modes.** Layers stored by file path (history lost); hashes over non-canonical JSON (equal configs, different hashes); a key-per-row table at {{config_keys}} keys × {{runs_per_week}} runs a week (billions of rows a year) with no compact alternative; a mutable status column; named recipes as a single current pointer; no record of uncommitted code changes; seeds recorded as one number when several random streams exist; checkpoints deleted with their rows, breaking lineage.

**Incident guidance.**
- *Re-rendered config does not match*: layers were stored by path. Recover the original content from the run's own logged resolved config (if logged) or from version control at the run's commit, store it as a content-addressed layer, and repoint `run_layers`; make content-addressed storage of every layer a precondition for a run to start.
- *Weekly report rewrote last month*: the join used the recipe's current target. Join each run to the pointer row in force at `started_at` (and recorded before the report's date for an as-recorded view); add a test that historical reports are stable when only the pointer moves.
- *Key-per-row table too large*: keep the resolved JSON and a compact provenance map per run, extract the frequently filtered keys into columns, and compute diffs on the fly from two documents; drop or archive the key-per-row table.

**Follow-up guidance.** (1) As recorded on D: pointer rows with `valid_from <= D < valid_to` and `recorded_at <= D_end`, latest `recorded_at` wins; as known now: the same with `superseded_at IS NULL`. They differ when a pointer was corrected or back-dated after D. (2) Runs containing layer L whose provenance attributes that key to L; runs where a later layer set the key are listed apart as "used the layer, not the bad value". (3) Library versions and lock files, accelerator type and count, non-deterministic kernels, data loader worker count and shard order, the evaluation set version, environment variables, and hardware faults; say honestly that some non-determinism cannot be pinned. (4) Resolved JSON stored once per distinct hash, typed columns for hot keys, and a provenance map; estimate bytes per run.

**Rubric anchors.** 2: a config blob or file path per run, editable runs, one current recipe pointer. 3: content-addressed layers, resolved config per run, seeds, code and data recorded, checkpoints, recipe history. 4: also per-key provenance and attributed diffs, canonical hashing rules, bitemporal recipe pointers and metadata, affected-run queries that honour overrides, storage sized and incident repairs that keep history.

**Strong signals.** Asks how equal configs are recognised; separates "what the run used" from "what the name meant". **Red flags.** Recomputing old runs' configs from today's files; deleting invalid runs; treating one seed as enough.

## GDM-L3-02

**Reference architecture (one defensible design).**
- **Definitions.** `sources (source_id, name, priority)`, `source_versions (source_version_id, source_id, version_label, ingested_at, record_count, manifest_checksum)`; source names can change, ids cannot. `licence_records (licence_record_id, source_version_id, permitted_uses, terms_ref, reviewer_role, valid_from, recorded_at, superseded_by NULL)`: reviewers' records, append-only, with a second time axis for corrections.
- **Passes.** `pass_definitions (pass_id, kind filter|quality|dedup|mix, version, params_json, params_hash)`. `snapshots (snapshot_id, built_at, status building|ready|superseded|withdrawn, supersedes_snapshot_id NULL, recipe_hash)`, where the recipe hash covers input source versions, the licence records read, and the ordered pass definitions with parameters (a different threshold is a different snapshot). `snapshot_inputs (snapshot_id, source_version_id, licence_record_id_read)`.
- **Pass runs and counts.** `pass_runs (pass_run_id, snapshot_id, position, pass_id, attempt, status, started_at, ended_at)`; `pass_counts (pass_run_id, source_version_id, records_in, records_removed, records_out)` written only for the attempt that succeeded (keyed by `(snapshot_id, position, source_version_id)` so a retry replaces, never appends). Cross-source deduplication adds `dedup_pair_counts (pass_run_id, kept_source_version_id, removed_source_version_id, records)`: how many records of one source were removed because another source's copy was kept under the priority rule.
- **Manifest.** `shards (snapshot_id, shard_no, uri, bytes, checksum, record_count)`, `shard_source_counts (snapshot_id, shard_no, source_version_id, records)`, and the withdrawal index `record_shard_index (record_id, snapshot_id, shard_no)` written with the manifest (opaque ids only, partitioned by snapshot, retained while any run that read the snapshot matters).
- **Consumption.** `run_reads (run_id, snapshot_id, shard_no, first_step, last_step)` or ranges of shards per run segment; checkpoints link to runs, so affected checkpoints are those written after the first read of an affected shard.
- **Withdrawals.** `withdrawals (withdrawal_id, source_version_id, scope all|records, received_at)`, `withdrawn_records (withdrawal_id, record_id)`. Impact: snapshots with that source version in `snapshot_inputs` (scope all) or with withdrawn record ids in `record_shard_index`; runs from `run_reads` on those shards; checkpoints by run and step.
- **Reconciliation.** Per snapshot and source version: first pass `records_in` = source version count; for each consecutive pass, `records_out` = next pass's `records_in`; `records_in = records_removed + records_out`; final `records_out` = Σ `shard_source_counts`. A failing snapshot never becomes `ready`.

**Competing designs to accept.** A lineage graph store (datasets as nodes, passes as edges) if counts per source still reconcile. Per-record lineage in columnar files outside the database, queried only for withdrawals. Replacement builds that rerun only deduplication and later passes, starting from cached filter outputs per source version, as long as deduplication is recomputed across all remaining sources.

**Bottlenecks and failure modes.** Matching by source name; contents or samples stored "for debugging"; retried passes appending counts; a single `snapshot_id` per run; mutable manifests; licence as a free-text column on the source; deduplication decisions reused after inputs change; the record index sized without thought ({{shards_per_snapshot}} shards × records per shard × {{snapshots_per_month}} snapshots a month).

**Incident guidance.**
- *Withdrawal matched by name*: match on `source_version_id`; rebuild the impact list from `snapshot_inputs` and `record_shard_index`; tell the owners of the wrongly flagged runs; add a test that a renamed source keeps its id.
- *Counts recorded twice after a retry*: make `pass_counts` keyed by the pass position and source version with the attempt that succeeded; delete the duplicate attempt's rows; block `ready` on reconciliation.
- *Replacement kept old dedup decisions*: deduplication is a function of all its inputs. Rerun the deduplication pass on the remaining source versions (cached filter outputs make this cheaper), let copies previously removed in favour of withdrawn records return, and show it in `dedup_pair_counts` of the new snapshot.

**Follow-up guidance.** (1) The equations above as a query with a failure list; failing snapshots stay `building` with a reason, never silently fixed. (2) Impact via the index and `run_reads`; replacement = same recipe minus withdrawn records (or source version), filters reused per source version, deduplication and mix recomputed; the new snapshot supersedes the old one. (3) Under the priority rule the other copy becomes the kept one, so the other source's count rises; the new `dedup_pair_counts` show it. With {{dedup_scope}} the near-match variant also changes cluster membership, so recompute rather than patch. (4) Records per snapshot × bytes per (record id, shard) entry; partition by snapshot; keep while any dependent run or checkpoint is retained.

**Rubric anchors.** 2: a snapshot table with a path and a source list; no counts per pass; contents kept to answer questions. 3: source versions, licence records, pass runs with reconciling counts, immutable manifests, run-to-snapshot links. 4: also licence history with what each build read, cross-source deduplication counts and correct replacement builds, shard-grain consumption, the record-to-shard index sized, and incident repairs.

**Strong signals.** Writes the reconciliation equation unprompted; sees that withdrawing a kept copy changes other sources' counts. **Red flags.** Storing samples of content; deciding licence questions in the pipeline; editing a ready snapshot.

## GDM-L3-03

**Reference architecture (one defensible design).**
- **Catalogue identity.** `catalogue_accessions (accession, organism_id)`, `catalogue_sequences (accession, sequence_version, length, sequence_checksum, effective_on)`; residue numbers are 1-based positions in a given sequence version.
- **Entries.** `entries (entry_id, accession, fragment_no)` (one per accession, or one per fragment), `entry_versions (entry_id, entry_version, sequence_version, model_version, residue_start, residue_end, computed_at, mean_confidence, share_very_high, share_confident, share_low, share_very_low)` (the bands are this exercise's), immutable once released. Fragment ranges follow {{fragment_rule}}, stored explicitly per fragment so the rule's version can change without rewriting history; `fragment_rules (rule_version, threshold, length, step)` referenced by the entry version.
- **Per-residue confidence.** One array per entry version (`confidence SMALLINT[]` or a compact blob, or one columnar file per release partitioned by organism). At {{entries}} entries × about {{median_length}} residues that is {{entries}} × {{median_length}} values per release (up to about a hundred billion at the largest sizes): fine as arrays or columnar files, painful as rows. Summary columns serve filters.
- **Files.** `entry_files (entry_id, entry_version, kind coordinates_cif|coordinates_pdb|confidence_json|aligned_error_json, format_version, bytes, checksum, uri)`. The aligned-error file is about length² values ({{median_length}}² values for a median-length entry, about 90,000 to 200,000), so it is never a table.
- **Releases.** `releases (release_id, released_on, catalogue_snapshot, notes_ref)`, `release_members (release_id, entry_id, entry_version, carried_over bool)`: carry-over is a membership row pointing at an older entry version, never a copy. `release_archives (release_id, organism_id, uri, bytes, checksum, member_count)` built only from `release_members`.
- **Queries.** Citation "E, v" → `entry_versions` by key. Behind the catalogue → membership joined to the sequence version in force now (the GDM-L3-05 query). Residue i of A in R → members of R for A, fragments whose range contains i; choose by the overlap rule (max of min(i − start, end − i), ties to the lower fragment number); read element i − start + 1 of that fragment's array.

**Competing designs to accept.** Per-residue data only in files, with summary statistics in the database. A document store per entry version with arrays inside. Releases modelled as snapshots of a manifest table instead of membership rows, if old releases stay reproducible and archives are built from them.

**Bottlenecks and failure modes.** Accession as the only key (sequence changes collide); fragment-local positions without offsets; residue rows at {{entries}} entries; recomputing summaries for carried-over entries; archives from "latest version" instead of membership; mutable entry rows that break citations; any column suggesting a biological or medical conclusion from confidence.

**Incident guidance.**
- *Archive mixed releases*: rebuild the archive from `release_members`, publish it with a new checksum and a notice listing the change; add a check that every file in an archive is a member of its release.
- *Fragment offsets missing*: store `residue_start` per fragment and map positions on read; republish affected files as a new entry version only if file contents change; add a test that every fragment's array length equals its range.
- *Summaries recomputed for carried entries*: summaries belong to the entry version and are computed once; carry-over adds membership rows only, so release work scales with recomputed entries, not {{entries}}.

**Follow-up guidance.** (1) The residue query above, with the tie rule written out. (2) New `entry_versions` for the recomputed 10%; membership rows for all members (old versions for carried ones); archives rebuilt per organism from membership, including unchanged files. (3) A catalogue merge maps two accessions to one: the old entries stay citable under their versions; the next release has one entry for the surviving accession and an `accession_redirects` table for the retired one. (4) Values × bytes per value for confidence; Σ length² × bytes for aligned-error (dominant); both in object storage, with summaries in the database.

**Rubric anchors.** 2: one row per accession updated in place; residue rows; no release membership. 3: identity, entry versions, fragments, files with checksums, releases with membership. 4: also the overlap rule made answerable, compact per-residue storage sized, carry-over by reference, archives from membership, citations stable, and incident repairs.

**Strong signals.** Separates the catalogue's versioning from the database's; estimates the length² growth. **Red flags.** Overwriting entries; storing aligned-error matrices as rows; drawing medical meaning from confidence.

## GDM-L3-04

**Reference architecture (one defensible design).**
- **Reference data.** `detector_versions (detector_version_id, content_type, released_at, retired_at NULL, withdrawn_at NULL, outcome_definitions_ref, confidence_thresholds_ref)`; `file_outcome_rules (rule_version, definition)` (this exercise's rule: part = at least one segment detected and at least one not detected).
- **Checks.** `checks (check_id, received_at, channel api|web|partner, requester_category, content_type, format, size_bucket, duration_bucket NULL, file_key NULL, detector_version_id)`. `file_key` is a keyed hash (HMAC with a rotating secret) kept for this exercise's window and stored only in the operational table; analytics tables never carry it. No identifiers beyond the category reach analytics.
- **Results.** `segment_results (check_id, segment_no, unit ms|token|region, start_pos, end_pos, outcome detected|not_detected|uncertain, confidence_level high|medium|low)`; `file_results (check_id, outcome all|part|none|inconclusive, confidence_level, rule_version, derived_at)`.
- **Repeated checks.** Reports count checks, and count files by `file_key` with the latest check in the window; after the window the key is dropped and files cannot be linked, which is stated in the report.
- **Rollouts.** During a rollout the service may run both versions on a sampled share of checks: `paired_results (check_id, version_a, outcome_a, level_a, version_b, outcome_b, level_b)`, no content needed because both results come from one check.
- **Aggregates.** `agg_daily (day, content_type, detector_version_id, outcome, confidence_level, requester_category, checks, files)` built from detail after late results have arrived (or rebuilt when they arrive), then suppression: cells under {{min_cell}} are withheld, and complementary cells are withheld too where a published total would reveal them. Suppression is a separate final step with its own version, so a rebuild reapplies it.
- **Retention.** Segment detail kept for a short window; file results longer; aggregates indefinitely. At {{checks_per_day}} checks a day the segment table dominates, so it is partitioned by day and content type.

**Competing designs to accept.** Aggregates kept as a cube with suppression applied at read time (only if every reader goes through it). Differential privacy noise on published counts instead of (or alongside) suppression, if the candidate explains the trade-off. Not linking repeated checks at all, if the report says it counts checks, not files.

**Bottlenecks and failure modes.** Storing content or thumbnails for debugging; unkeyed hashes that let anyone with the file find its check; requester ids in analytics; mixing versions in one series; suppression before late data or without complementary cells; raw scores compared across versions with different definitions; unbounded segment tables at {{checks_per_day}} checks a day. Any discussion of how detection works or how a watermark could be weakened is out of scope; steer back.

**Incident guidance.**
- *"Part" share jumped during the rollout*: version the file-outcome rule with the detector version, report per version (never one mixed series), and annotate the rollout; check the old rule against the new version's segment shapes before ramping.
- *A small cell was published*: rebuild the week's aggregates after late data and reapply suppression with complementary cells; retract the published table; make publishing depend on the final suppression step having run after the last merge.
- *Segment growth slowed the daily job*: partition detail by day, aggregate incrementally from the day's partition only, and shorten segment retention; the aggregate job never reads a month of detail.

**Follow-up guidance.** (1) Any detected and any not detected → part; all detected → all; none detected and none uncertain → none; otherwise inconclusive (or the candidate's stated variant, recorded as a rule version). (2) Paired results from one check, as above; agreement per content type and confidence level, with versions' different definitions acknowledged. (3) Differencing published totals; complementary suppression or publishing totals only at coarser grains. (4) Detail partitioned by day with short retention for segments; aggregates kept.

**Rubric anchors.** 2: one results table with a content reference or plain hash; per-requester reports; no suppression. 3: versions as reference data, content-free descriptors, segment and file results with a stated rule, suppressed daily aggregates. 4: also keyed hashes with a window outside analytics, complementary suppression after late data, paired rollout comparisons, rule versions, retention sized, and incident repairs.

**Strong signals.** States what is not kept before designing; versions the outcome rule. **Red flags.** Keeping content "just in case"; requester identities in analytics; drifting into how detection or removal works.

## GDM-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH listed AS (
  SELECT DISTINCT p.release_id, a.organism, p.accession, src.catalogue_snapshot
  FROM predictions p
  JOIN accessions a ON a.accession = p.accession
  JOIN releases src ON src.release_id = p.predicted_in
), computed AS (
  SELECT l.release_id, l.organism, l.accession, at_snap.sequence_version AS computed_version
  FROM listed l
  CROSS JOIN LATERAL (
    SELECT ev.sequence_version
    FROM entry_versions ev
    WHERE ev.accession = l.accession AND ev.effective_on <= l.catalogue_snapshot
    ORDER BY ev.effective_on DESC
    LIMIT 1
  ) AS at_snap
), staleness AS (
  SELECT c.release_id, c.organism, c.accession,
         DATE '{{as_of}}' - MIN(ev.effective_on) AS days_behind
  FROM computed c
  LEFT JOIN entry_versions ev
    ON ev.accession = c.accession
   AND ev.sequence_version > c.computed_version
   AND ev.effective_on <= DATE '{{as_of}}'
  GROUP BY c.release_id, c.organism, c.accession
)
SELECT release_id,
       organism,
       COUNT(*) AS accessions,
       COUNT(days_behind) AS behind,
       ROUND(100.0 * COUNT(days_behind) / COUNT(*), 1) AS behind_pct,
       ROUND(AVG(days_behind), 1) AS avg_days_behind,
       MAX(days_behind) AS max_days_behind
FROM staleness
GROUP BY release_id, organism
ORDER BY release_id, organism;
```

**Explanation.** Three steps. First, each listed prediction is reduced to one row per release and accession (fragments collapse here) and resolved to the release that computed it: the join to `releases` goes through `predicted_in`, so a carried-over prediction takes the earlier release's `catalogue_snapshot`. Second, the as-of join finds the sequence version in force on that snapshot date: the latest catalogue row with `effective_on <= catalogue_snapshot`, inclusive. Third, a LEFT JOIN to rows with a higher `sequence_version` that are effective on or before the report date finds the first change; `MIN` gives the date it became behind, and a NULL means current. Annotation-only rows never raise `sequence_version`, so they are ignored without a special case. The final aggregation counts all accessions with `COUNT(*)` and the behind ones with `COUNT(days_behind)`, so groups with nothing behind keep their row with NULL days.

**Complexity.** One as-of lookup per (release, accession) and one range probe for later versions; with an index on `entry_versions (accession, effective_on)` both are index seeks, so the cost is about (listed predictions) × log(catalogue rows). At production scale the as-of result per release is computed once at release time and stored (`release_members.computed_sequence_version`), and the daily report only probes for newer versions, or reads a per-accession "latest sequence version as of date" table maintained from the catalogue's change feed.

**Dialect notes.** `CROSS JOIN LATERAL … ORDER BY … LIMIT 1` is PostgreSQL; Snowflake's usual form is `QUALIFY ROW_NUMBER() OVER (PARTITION BY … ORDER BY effective_on DESC) = 1` after a join on `effective_on <= catalogue_snapshot`, BigQuery uses `ARRAY_AGG(sequence_version ORDER BY effective_on DESC LIMIT 1)[OFFSET(0)]` or `QUALIFY`, Spark SQL a window with `row_number()` (or `max_by(sequence_version, effective_on)`), MySQL 8 `LATERAL` or a correlated subquery. Date subtraction: `DATE - DATE` is PostgreSQL; Snowflake and Spark use `DATEDIFF`, BigQuery `DATE_DIFF(a, b, DAY)`, MySQL `DATEDIFF(a, b)`. `AVG` of integers is numeric in PostgreSQL (exact before `ROUND`) but FLOAT64 in BigQuery and DOUBLE in Spark, so cast to NUMERIC/DECIMAL there before rounding. `DISTINCT ON` is PostgreSQL only. None of these variants is executed here.

**Edge cases built into the data.** A sequence change effective exactly on a release's `catalogue_snapshot` (already in that release's prediction, so not behind there, but behind in earlier releases); a change between a release's snapshot and its `released_on` (behind, counted from the change); annotation-only updates that raise `entry_version` only; a change effective on `{{as_of}}` (behind by 0 days); a change dated after `{{as_of}}` (ignored). Hard adds a third release, carried-over predictions whose `predicted_in` names an earlier release (with one forced so that its sequence changed between the computing snapshot and the listing release's snapshot), and accessions that first appear in a later release. Very Hard adds fragmented accessions (several rows per accession) and an accession whose sequence changed twice after the snapshot. At every level many seeds also have a release and organism with nothing behind.

**Common mistakes.** Treating any new `entry_version` as a change; an exclusive as-of (`<`) at the snapshot; using `released_on` instead of `catalogue_snapshot`; comparing with the catalogue's latest row regardless of the report date; excluding a change on the report date; dropping groups with nothing behind (an inner join or a `WHERE behind`); (Hard) joining `releases` on `release_id` for carried-over rows; (Very Hard) counting fragment rows as predictions, and counting days from the latest change. Each has a diagnostic.

**Follow-up guidance.** (1) Replace the cut-off with the listing release's `released_on` (changes on or before it), giving "behind at publication"; note it can be non-zero because of the snapshot-to-release gap. (2) Add `recorded_at` to the catalogue rows and filter `recorded_at <= report time` as well as `effective_on <= as_of`: a bitemporal as-of. (3) Index `(accession, effective_on)` and store the computed sequence version on each release member at publication; maintain a "current sequence version" table from the catalogue's daily changes and compare by equality. (4) `SELECT … FROM release_members m WHERE EXISTS (newer sequence version) …`; after the release, rerun this report for the new release and assert that nothing behind predates its snapshot.

**Rubric anchors.** 2: compares the latest entry version with anything, or resolves snapshots through `release_id`. 3: matches the expected result. 4: also discusses bitemporal catalogue rows, indexing and pre-computing the as-of result at scale, and turning the report into the next release's recompute set.

**Strong signals.** Asks which release computed a carried-over prediction; asks whether entry versions and sequence versions differ. **Red flags.** "Current version" without a date; `COUNT(*)` over fragment rows; interpreting "behind" as a statement about the structure's correctness.
