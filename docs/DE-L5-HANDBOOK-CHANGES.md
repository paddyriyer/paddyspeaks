# DE Interview Handbook — 2026 Upgrade: What Changed

_Release: September 2026. Page: `articles/data-engineering-interview-prep.html`. The Stage 0 audit
that drove these changes is in [`DE-L5-HANDBOOK-AUDIT.md`](DE-L5-HANDBOOK-AUDIT.md) (flagged claims in
[`DE-L5-HANDBOOK-AUDIT-CLAIMS.md`](DE-L5-HANDBOOK-AUDIT-CLAIMS.md)). The per-part changelogs at the end of
this file record every applied correction as before → after, with its reason and confidence._

## 1. Change summary

The handbook is reorganised around **Explain → Calculate → Design → Debug → Defend → Operate**. Every part was
audited against current official documentation. Wrong or engine-specific claims were corrected or qualified,
and duplicate sections were merged. Every code block now states its engine, dialect and whether it runs as written.
Every technical part ends with an **L5 Interview Card**, and eight new parts cover the capabilities the audit found missing.

**Structure and navigation (P0.1)**
- The article is now the single source of truth. The old generator (`scripts/combine_interview.py`) rebuilt from stale sources and would have deleted Parts 10–12; it now refuses to run.
- A new build script, `scripts/handbook_build.py`, owns the navigation layer and is idempotent:
  - a hierarchical master contents: every part, every numbered section and the card link, collapsible per part;
  - sequential section numbering. Visible numbers only; ids never change, so all 24 external deep links in the repo still resolve;
  - previous/next/contents/top navigation at the end of every part;
  - the chip bar covering all 21 parts.
- Deep links now land correctly. The page lazy-renders parts (`content-visibility:auto`), which made far anchors land thousands of pixels off. A deep link now lays the page out once, then scrolls clear of the sticky bar. It also opens any collapsed reveal the target sits inside.
- Printing (Save as PDF) expands every reveal, hides the chrome, starts each part on a new page, and keeps the heading hierarchy for PDF bookmarks.
- `scripts/check_handbook.py` is wired into Validate Content. It checks:
  - unique ids and resolving in-page links;
  - balanced tags and contiguous part and section numbers;
  - every heading appears in the contents;
  - every technical part has a card with the eleven sections in order;
  - every code block is labelled;
  - banned phrasing ("real interview questions", "asked at Google" and the like);
  - the navigation layer is current.

**Reading time (P0.2).** The single "120 min read" is gone. Each part shows three estimates, and the contents show them per part with totals:
- **Quick refresh** — card, lede and notes.
- **Interview study** — prose at 200 wpm plus code at 90 wpm.
- **Deep practice** — drills, pushback rounds, answer-depth exercises and the card's prompts.

The Overview explains the three modes, seven reading paths and the 20-item quality gate.

**Versions (P0.3), claims (P0.4), labels (P0.5), metadata (P0.6)**
- Every part opens with a compact metadata block: last technically reviewed, what it covers, versions referenced, primary references (official docs only), and known implementation differences.
- 50 "2026 Interview Note" callouts separate the timeless concept from version-specific behaviour.
- 247 code labels:

| Executable | Blocks |
|---|---|
| Yes | 170 (many scoped, e.g. "Yes — Snowflake only", "Yes — Flink 1.x (1.20 LTS) only") |
| Illustrative | 64 |
| Pseudocode | 13 |

**Honesty.** Every "40+ real interview scenarios", "verbatim prompt" and "drawn from actual loops" claim is gone, along with the named-company sourcing and invented statistics. That covers the page, its meta tags, the homepage cards and `article_metadata.json`. Scenarios are now described as representative composites, and level labels are noted as company-specific.

## 2. Content added

| New part | What it gives a candidate |
|---|---|
| 13 Distributed Systems for Data Engineers | Replication and lag; consistency models with DE failures; CAP/PACELC in practice; consensus, quorums, fencing, KRaft; partitioning and consistent hashing; ordering; delivery semantics unified with the conditions that make exactly-once meaningful; the backpressure chain producer → broker → consumer → sink; clocks |
| 14 Production Data Platform — Cloud, Security & Release Engineering | AWS/GCP/Azure conceptual map; the security control plane (IAM, RBAC/ABAC, workload identity, KMS/envelope encryption, TLS, private endpoints, masking, row-level security, tokenization, PII zones, multi-tenancy, exfiltration); two full L5 security scenarios; IaC, environments, CI/CD, immutable deploys, rollback vs roll-forward for data, write-audit-publish, blue/green and shadow runs, expand/contract migrations |
| 15 CDC, Data Contracts & Transformation Engineering | CDC end to end (log vs polling vs timestamp, snapshots and bootstrap, tombstones, ordering by LSN, transaction boundaries, replication-slot risk); a full Postgres → lakehouse design; compatibility defined precisely; enforcement and ownership; the "one enum value broke 14 consumers" incident; dbt as architecture (why it's introduced, what it costs, when it's wrong) |
| 16 Serving Systems & Warehouse Architecture | Access-pattern-first storage selection (KV, wide-column, document, relational, search, cache); keys, hot keys, indexes, TTL, LSM vs B-tree, caching and stampedes, tail latency; a sub-100 ms serving-layer design; Snowflake / BigQuery / Databricks / Redshift / open Iceberg compared conceptually; why one model behaves differently per platform; choosing a platform from requirements |
| 17 Data Engineering for AI Systems | Unstructured ingestion with ACL propagation; chunking as a transformation; embedding pipelines with model-versioned indexes; vector data (ANN, filtering, freshness, re-embedding); RAG data quality; feature pipelines and skew taxonomy; answer-level lineage; AI pipeline cost with worked numbers |
| 18 System Design Framework & Capacity Planning | The 8-step framework with a 45-minute time budget; the capacity toolkit (100K ev/s × 800 B ≈ 80 MB/s ≈ 6.9 TB/day, through compression, replication, retention, partitions, workers, network, backfill, cost method); reference and multi-region architectures; a full worked 100K ev/s design; idempotent batch design; the canonical failure-first table; 9 interviewer-attack rounds; how to defend a trade-off |
| 19 Debugging Lab | Observe → hypothesize → measure → isolate → fix → prevent. 12 drills with hidden hints and diagnoses, including the Spark 21-minute task, Kafka lag at 35% CPU, the missing Airflow partition, the 20 s → 11 min query, duplicates after restart, 20K → 8M files, revenue 3.7% over Finance, the replication slot filling the primary, and SCD2 overlaps. Also a debugging scorecard |
| 20 Self-Assessment & Night-Before Cheat Sheets | A 16-row skills matrix (needs work / L4 / L5 ready / Staff+) where every cell is a demonstrable ability and the L5 cell links to the material; ten one-page cheat sheets (Know / Explain / Draw / Debug / Avoid); a last-hour checklist |

**Existing parts, substantially extended**
- **Part 09:** a new Staff-Signal Behavioral section with 14 scenarios, each with a Staff+ extension ending "How did this improve the organization after you left the project?". It includes a fully modelled disagreement-with-a-Staff-engineer answer where neither person looks foolish, answer depths and a checklist.
- **Part 10:** right-to-erasure in an immutable lakehouse (the full physical-deletion chain), column-level lineage, and a classification pipeline.
- **Part 11:** cost reasoning, BigQuery and Redshift coverage, unit economics, commitment break-even.
- **Part 12:** write-audit-publish, SLIs/SLOs with error budgets, reconciliation design, anomaly-detection trade-offs, incident comms.

**Interview features across the handbook**

| Feature | Count |
|---|---|
| Answer-depth blocks (30 s / 2 min / deep dive) | 30 |
| Interviewer-pushback blocks | 53 |
| Drills with hidden reveals | 43 |
| Failure-first tables | 14 |

The six incident scenarios in Part 08 now hide their answer skeletons until revealed.

## 3. Content compressed

Merged duplicates. Old ids were kept as anchors, so links still work.

| Part | Merged |
|---|---|
| 01 | Surrogate keys (§4 + second §14); accumulating snapshot (§17 → §5) |
| 03 | Kafka exactly-once ×3 → one place; stream-table duality cut to ~150 words; extra sessionization passes |
| 04 | Tungsten ×2 (they contradicted each other); broadcast ×2 |
| 05 | Sketches ×2 (contradictory error rates); CTEs ×2; the LAST_VALUE trap ×3 |
| 06 | asyncio, Polars/DuckDB/Arrow, pydantic and packaging, each ×2 |
| 07 | Feature matrix ×2; catalogs ×2; write amplification ×2 |
| 08 | Feature store ×3; dashboard mismatch ×3 |
| 12 | Testing (duplicated Part 06); contracts (duplicated Part 01) |

Cut or trimmed:

| Part | What went |
|---|---|
| 01 | 12-domain additivity table; ~50-row SCD attribute table (to 10 rows) |
| 02 | Partition table, NULL table, skew and DQ-tooling sections, now links to their home chapters |
| 04 | Five config tables → one |
| 06 | CPython bytecode and memory micro-numbers |
| 08 | Testing, contracts, quality, Lambda and behavioural sections |
| 09 | Roadmap and day-of sections |
| all | Local "Contents" lists (replaced by the master contents) |

**Measured effect.** Pre-existing prose shrank in most parts (typically 7–33%). Part 06's original material is 33% shorter, and Part 04's prose is 15% shorter. **Total length grew**, from ~77K to ~182K words:
- about 70K words are the eight new parts;
- the rest is the cards, drills, depth and pushback blocks, labels and notes added to existing parts.

The compression target of "more useful per page, not more pages" was met within sections, not for the page as a whole. See Remaining gaps.

## 4. Claims corrected (highlights — full list per part below)

| Area | Correction |
|---|---|
| Modeling | Snowflake has no `REQUIRE_PARTITION_FILTER`. BigQuery `TIMESTAMP` is an absolute instant, not naive. BigQuery `LAG` has no `IGNORE NULLS`. "A single MERGE can't do SCD2" was false (staged-union MERGE). Inferred members are overwritten in place, not versioned. Hash surrogate keys cluster badly. Postgres partitioned-table PKs must include the partition key. |
| Batch | Iceberg has no `replace-where` (a rerun could overwrite the whole table). `SET PARTITION SPEC` is not Iceberg SQL. The CDC MERGE ordered by `ts_ms` instead of the log position and didn't dedupe per key. Cross-region egress arithmetic fixed; the "600× swing" removed. Airflow 3 removed SLA callbacks. |
| Streaming | The watermark bound is out-of-orderness, not end-to-end delay. Spark's Kafka sink is at-least-once. The transaction coordinator writes control markers (not tombstones). Flink 2PC keeps offsets in the checkpoint. HashMapStateBackend snapshots asynchronously. KRaft-first Kafka text. Partition reassignment is online. |
| Spark | Broadcast joins can't do full outer. AQE coalesces contiguous partitions only. `parallelismFirst` defaults true. The Arrow config defaults to false in OSS and doesn't govern Pandas UDFs. The hash-shuffle diagram was pre-2.0. Push-based shuffle is YARN-only. Velox runs under Presto C++, not Trino. |
| SQL | The `SKEW` hint is Databricks-only. Invented BigQuery "hints" removed. The OR-join rewrite lost rows. Window-function choices corrected (RANK for ties, RANGE frames). Spark as-of joins don't use nested loops. |
| Python | Free-threaded Python is supported but not default in 3.14. pandas 3.0 copy-on-write. Polars streaming API change. Broken Dockerfile, Hypothesis and dataclass examples fixed. |
| Lakehouse | Delta defaults to WriteSerializable. Concurrent blind appends don't conflict. RESTORE writes a new commit. Column defaults are format v3. Glue is regional. Trino writes Delta. Orphan-file risk comes from in-flight writers. MOR deletes are logical until compaction plus expiry. |
| Governance / cost / quality | GDPR territorial scope and accountability. Invented retention figures and the k≥5 "legal test" removed. Delta CDF keeps erased PII. Snowflake credit math was off ~60× and its sizing rule was inverted. S3 PUT price was off 12.5×. Redshift WLM mis-described. Great Expectations 0.x API replaced with GX Core 1.x. |
| Scenarios | BigQuery flex slots retired. Snowflake has no "vacuum". Deleting S3 files that snapshots still reference. A timeout that exceeded its own latency budget. An invented regulation. The SQL bank's cohort, funnel, zero-day and median bugs. |

## 5. Version updates (checked against official release notes, September 2026)

| Technology | 2026 behaviour now reflected |
|---|---|
| Python | 3.14 current; free-threaded supported but optional; 3.9 EOL |
| Spark | 4.x current (ANSI on by default, Spark Connect, VARIANT, Java 17/21, Scala 2.13); 3.5 on extended support |
| Flink | 2.x current (DataSet API, SourceFunction and `Time` removed); 1.20 LTS |
| Kafka | 4.x KRaft only; KIP-848 rebalance protocol GA; share groups |
| Iceberg | 1.10/1.11; format v3 (deletion vectors, variant, row lineage, defaults) |
| Delta | 4.x (catalog-managed tables, liquid clustering, UniForm) |
| Snowflake | Iceberg tables, Gen2 warehouses |
| BigQuery | Editions (flat-rate retired) |
| Databricks | Lakeflow Spark Declarative Pipelines (formerly DLT); serverless |
| PostgreSQL | 18; failover slots in 17 |
| dbt | 1.8–1.12; dbt 2.0 shipped Sept 2026 |
| Airflow | 3.x (Assets, `logical_date`, SLA removed) |
| Great Expectations | GX Core 1.x |
| Debezium | 3.x |

The code was **not** rewritten wholesale to the newest syntax. Examples are labelled by version family, and notes explain what changes.

## 6. New interview cards

17 L5 Interview Cards, one at the end of each technical part: 01, 02, 03, 04, 05, 06, 07, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19.

- Each has the eleven sections in the fixed order: must know, explain, draw, code, debug, numbers, traps, 30-second answer, 2-minute answer, deep-dive and Staff+ follow-ups.
- Each is linked from the contents as "★ L5 Interview Card".
- No card for the Overview, Part 08 (scenario bank), Part 09 (prep program) or Part 20 (the self-assessment and cheat sheets are its equivalent).

## 7. New diagrams (62 total, text diagrams sized for phones)

| Part | Diagrams |
|---|---|
| 00 | Organising progression |
| 01 | Bus matrix; SCD2 versions with an as-of late fact |
| 02 | Rerun-safe batch pipeline with WAP; idempotent partition overwrite; linear DAG |
| 03 | Min-of-inputs watermark; tumbling and session windows; Flink checkpoint lifecycle; incremental checkpoint; partitions and consumer groups; log compaction; streaming architecture |
| 04 | Spark execution driver → executors; sort-based shuffle; executor memory; JVM↔Python hop |
| 05 | Logical order; build-small/probe-big |
| 06 | Arrow zero-copy vs copy; testing pyramid |
| 07 | Lakehouse commit model (Iceberg CAS vs Delta put-if-absent); position and equality delete files; Iceberg metadata hierarchy (existing tree, updated) |
| 08 | Exactly-once payments path |
| 10 | Erasure propagation chain; column-level lineage; classification pipeline |
| 11 | Five cost buckets |
| 12 | Data-quality loop |
| 13 | Quorum overlap; visibility-lag layers; fencing; consistent-hashing ring; backpressure chain |
| 14 | Reference platform with boundaries; workload identity federation; envelope encryption; PII zones; release pipeline with WAP |
| 15 | CDC hops and positions; long-transaction watermark trap; chunked snapshot; producer → contract → consumer; enforcement points; slim CI |
| 16 | Engine cost shapes; cache stampede; serving layer; warehouse shared shape; platform decision path |
| 17 | RAG data pipeline; feature store; AI erasure fan-out |
| 18 | 8-step card; capacity card; reference data platform; active-passive multi-region; 100K ev/s streaming architecture; idempotent batch with WAP |
| 19 | Debugging loop |

## 8. Remaining gaps (not pretending this is complete)

- **Length.** The page is ~182K words (1.7 MB). Per-part time estimates and reading paths make it navigable, but a dedicated compression pass on Parts 01, 03 and 09 (the three longest) would cut 15–25% more without losing interview value.
- **Unexecuted code.** Some code was executed during the upgrade: the Part 09 SQL bank on PostgreSQL 16, and the Part 06 Python on 3.13 with pandas 3 and Polars 1.44. Most corrected Snowflake, BigQuery, Databricks, dbt and Flink code was **not** run against those engines. It is labelled honestly, but "Yes" means "believed runnable on that engine", not "CI-tested".
- **Items hedged in the text but not confirmed against primary docs**, listed per part in the changelogs below. Among them:
  - Snowflake's default window frame and CTE reuse
  - GX 1.x API names
  - Iceberg v3 "GA" wording
  - Kinesis record and buffer limits
  - Airflow 3 backfill and Deadline Alert APIs
  - dbt 2.0 syntax parity
  - CPPA opt-out windows
  - whether delta-spark still needs the DynamoDB log store
- **Web access.** The container's egress proxy blocked several official sites. Version facts were confirmed through official-domain search results and package-registry metadata rather than full page reads.
- **Legacy line anchors.** 1,065 per-line code anchors (`pNN-cbN-M`) disappeared; every section, heading and code-block anchor survived where code blocks were rewritten. Nothing in the repo links to them; external links to individual code lines, if any exist, will land at the top of the page.
- **Trimmed material.** A reader pointed out that the three dimensions of boundedness (temporal, cardinality, completeness) had been cut from Part 02 §1. They were restored on 2026-09-25, next to the newer completeness contract. The pre-upgrade edition is archived, unchanged and `noindex`, at `archive/data-engineering-interview-prep-2026-04.html`, and the Overview links to it.
- **The source files in `interview/html/` are stale.** They are marked as such rather than regenerated.

## 9. Future backlog

- A compression pass on Parts 01, 03 and 09, and a shared glossary so later parts can drop re-definitions.
- A CI job that runs the "Executable: Yes" SQL against DuckDB/Postgres containers and the Python blocks under pytest, turning labels into guarantees.
- Interactive exercises beyond `<details>` reveals: a partition-key chooser, a Kafka partition estimator, EXPLAIN-plan reading, a cost estimator. This needs a small JS module and per-viewer progress.
- Persisting self-assessment progress per reader, which needs a storage decision (the site is static today).
- An SVG or print-quality version of the 15 core diagrams for the PDF export.
- A quarterly version-review ritual: re-run the version audit, bump the "Last technically reviewed" dates, and refresh the 2026 notes.

---

# Appendix — per-part changelogs

## Part 01



The part was rebuilt with `SCRATCH/w01/build.py` from the original extract (`SCRATCH/w01/part-01.orig.html`).

Word count (tags stripped): **9,424 before → 12,644 after**.
- About 3,100 of the new words are the new interview components (meta, lede, 2 depth, 4 attack, 1 drill, 1 failure table, 2 diagrams, 3 notes, the L5 card).
- About 36 code labels and about 550 words of new code (the SCD2 MERGE, invariant tests, the accumulating MERGE, the as-of join, the bridge test).
- Existing prose and code: about 4,600 original words were rewritten or cut, and the replacements are shorter. Net, the existing material is roughly 8% shorter.

### Claims corrected
All of these are High confidence unless marked otherwise.

**§1 Snowflake partition filter**
- Before: Snowflake `REQUIRE_PARTITION_FILTER`, plus a `QUERY_TAG`/resource-monitor "equivalent" in cb1.
- After: the partition-filter guard is BigQuery-only. Snowflake has no DDL equivalent, so the text points to `STATEMENT_TIMEOUT_IN_SECONDS`, resource monitors and date-forcing views. The bogus Snowflake lines in cb1 are deleted.

**§2 Foreign keys and HTAP**
- Before: "No FK constraints".
- After: FKs are declared but not enforced; declare them anyway (with `RELY` where supported) so optimizers can eliminate joins.
- HTAP list: CockroachDB removed; TiDB is now "with TiFlash". Medium-High.

**§2 Parquet stats**
- `distinct_count` is rarely written, and page indexes exist. Medium.

**§3 BCNF example**
- Before: a 2NF violation presented as the BCNF case.
- After: the correct `Enrollment(student, course, instructor)` example.

**§4 cb2 DDL**
- Fact PK is now `(session_key, dt)`; Postgres requires the partition key in the PK.
- `days_from_today` removed; stored, it goes stale.
- max bitrate rolls up with MAX, not AVG.
- Weighted average: store the additive components.
- `qoe_score` relabelled as a measure, not a degenerate dimension (Medium).
- `hash_diff` is now CHAR(32) MD5, consistent with §7.

**§4/old §14 surrogate keys**
- Removed Snowflake 64-bit `HASH` as a key; the birthday-bound math is given.
- Spark `hash()` is 32-bit, and `concat_ws` skips NULLs.
- xxhash is not "collision-resistant".
- Hash-key clustering changed from "Good" to "Poor (random)".
- "Snowflake/BigQuery/Spark all agree" was false: BigQuery has no CONCAT_WS and its MD5 returns BYTES, and NULL semantics differ. Replaced with a NULL-tokened, explicitly formatted Snowflake pattern plus Spark and BigQuery equivalents.

**§5 MRR**
- "always AVG across time" changed to the period-end value (AVG only for "average balance"). Medium.

**§7 Type 1 / GDPR**
- Type 1 alone doesn't erase history. You must purge all versions and expire snapshots/time travel (Delta VACUUM, Iceberg expire_snapshots, Snowflake Time Travel/Fail-safe) and bronze.

**§7 "A single MERGE can't do SCD2"** (said twice)
- This is false. Replaced by the staged-union (NULL merge key) single MERGE.
- Also notes that two statements must share one transaction.

**§7 "dialect-independent" script**
- It mixed Snowflake `SHA2`/`CONCAT_WS` with PG `::` and `nextval`, so it ran nowhere. Replaced with a single-dialect Snowflake MERGE that has:
  - stage dedup (QUALIFY ROW_NUMBER)
  - a NULL-token MD5 hash
  - source change time for `valid_from`/`valid_to` instead of CURRENT_TIMESTAMP
  - atomicity

**§7 SHA-256 vs MD5**
- MD5 is sufficient for non-adversarial per-key change detection. Hash a NULL token, not ''.

**§7 dbt snapshot**
- Before: legacy Jinja block labelled `yaml`, "production-grade with one file".
- After: dbt Core 1.9+ YAML snapshot with `hard_deletes`, plus caveats: run-time state only, check-strategy cost, deletes. Medium on exact key names; they are consistent with the 1.9 docs as I know them.

**§8 date dimension and time zones**
- "20 years" corrected to the 2010–2040 the code actually generates.
- BigQuery `TIMESTAMP` is an absolute instant (`DATETIME` is the naive type). Snowflake `TIMESTAMP` defaults to NTZ via `TIMESTAMP_TYPE_MAPPING`. TIMESTAMPTZ does not store the zone.
- cb22 double `AT TIME ZONE` is wrong for TIMESTAMPTZ; rewritten for TIMESTAMPTZ, with a comment giving the naive form.
- pytz / ZonedDateTime claim corrected: `ZonedDateTime.of` shifts silently and `ofStrict` throws; zoneinfo never raises; pytz raises only with `is_dst=None`.
- "Netflix fiscal year" comment removed (company claim).
- Added: ISO week must be paired with ISOYEAR, and user timezone should be taken as of the event.

**§9 Data Vault**
- "hubs before sats" corrected to parallel load via hash keys (FKs unenforced); `REFERENCES` removed from cb24.
- Business-key normalization added to cb26, plus the concurrent-insert race.
- "zero refactor" changed to "absorbed additively". Medium.
- "Unqueryable directly" changed to "awkward; PIT/bridge + info marts". Medium.

**§10 OBT**
- cb27 was hybrid DDL that ran nowhere. Rewritten as Databricks: liquid `CLUSTER BY` without `PARTITIONED BY`, STRING/TIMESTAMP types.
- "OBT storage often lower than star" changed to "overhead usually modest; usually larger". Medium-High.
- "Silver = Kimball star" presented as universal is now "varies by org". Medium.

**§11 Medallion**
- Bronze "exactly once" / "idempotent by event ID" changed to at-least-once with a stable dedup key, deduplicated in silver.
- cb29 `.option("path")` + `.partitionBy` on an Iceberg sink replaced with `.toTable()` and a concrete Kafka source.
- "Always rebuild from bronze" now carries a retention/snapshot-expiry caveat.
- Streaming upserts now mention `foreachBatch`, v3 deletion vectors, and compaction. Medium-High.

**§12 NULLs**
- `IS NOT DISTINCT FROM` engine list completed; Spark `<=>` added; PG hash-join caveat (Medium).
- `EQUAL_NULL` is also available in Spark 3.4+ (Medium).
- NULL ordering added for Spark, BigQuery and Snowflake.
- BigQuery LAG has no IGNORE NULLS; use `LAST_VALUE(x IGNORE NULLS)`.

**§13 Contracts**
- BACKWARD/FORWARD/FULL defined.
- "add optional col" changed to FULL-if-default; widening is backward only.
- "Iceberg and Delta both" changed: Delta needs column mapping for rename/drop, and type widening is a table feature.
- ODCS and dbt contracts (1.5+, per versions.md) mentioned.

**§14 checklist**
- "slowly-changing fact attributes as mini-dims" changed to rapidly-changing *dimension* attributes. Medium.
- "TIMESTAMP without tz" changed to naive *local* timestamps. Medium.
- Soft-delete partial index (OLTP-only) changed to a filtering view. Medium.
- "8 distinct values → mini-dim" changed to junk dim / inline OK. Medium.

**§15 Bridge**
- The DDL said the weight was "optional", contradicting the text. Now `DECIMAL(9,8) NOT NULL` and must sum to 1, with a test.
- Added allocated vs impact reporting.

**§16 Late-arriving**
- Inferred member "issue a new version (SCD2)" changed to overwrite the inferred row in place (Kimball).
- NULL-FK option now names the `-1` Unknown member.
- "Both tables exist" softened to a per-consumer decision.
- Added the core as-of join.

**§6 Junk dim math**
- "2x2x2x(sources) ≈ 16" changed to "at most 2×2×2×sources, 24 with 3".

### Compressed
- **Chapter intro paragraph** ("MERGE patterns you can actually run") replaced by the hb-lede.
- **§1**: concept text and the 5-row table (about 250 words) became one paragraph with a link to p02-1. Snowflake lines removed from cb1.
- **§2**: Parquet layout and encoding lists (about 200 words) became one paragraph with a link to p02-7. The PG page/TID paragraph was cut.
- **§3**: 4NF/5NF reduced to 2 sentences; the 1NF array paragraph tightened.
- **§4**: the four-step process was tightened (about 90 words). Non-essential dim_title/dim_device columns were cut from cb2.
- **§5**:
  - The 12-domain additivity cheat sheet was cut entirely (about 450 words).
  - The taxonomy table's measure lists were trimmed.
  - 3 of the 10 "look additive" rows were cut, and the "canonical mistake" paragraph was compressed.
- **§7**:
  - The ~50-row SCD per-attribute table was cut to 10 rows (about 600 words).
  - The PySpark/Delta two-step block (cb14, about 250 words) was replaced by one paragraph (Delta MERGE, Databricks AUTO CDC, Spark 4.2).
  - The duplicated hash-diff SQL is gone.
- **§9**: Pros / Cons / When-to-use (3 lists) merged into one 4-row decision table.
- **§10**: OBT cons tightened (the attack box carries the argument). Wide DDL cut from about 35 to 18 columns.
- **§12**: the NULL-in-aggregations list became one paragraph, cross-linked to p02-18 and p05-126.
- **§13**: the tests block was cut from the contract YAML. The Python contract-check block (cb33, Illustrative with undefined vars) was replaced by one sentence.
- **§14**: 3 lower-value anti-patterns cut. The mid-chapter "Next: 02-batch-processing.md" footer and both `<hr>`s were removed.
- **Merges**:
  - The second "14. Surrogate Key Strategies in Depth" was merged into §4's "Why surrogate keys"; `p01-14-surrogate-key-strategies-in-depth` is kept as a span anchor.
  - "17. Accumulating Snapshot" was merged into §5; `p01-17-accumulating-snapshot-fact-tables` is kept as a span anchor. Only the idempotent MERGE point plus code was kept.
  - The Data Vault ids `p01-cons` and `p01-when-to-use-it` are kept as spans.
- About 4,600 original words were rewritten or cut in total.

### Version notes added
1. §4 surrogate keys: engine hash return types differ; UUIDv7 (RFC 9562) and PG18 `uuidv7()`.
2. §7 dbt: 1.9 YAML snapshots (`relation`, `schema` replacing `target_schema`, `hard_deletes` replacing `invalidate_hard_deletes`, `dbt_valid_to_current`); legacy Jinja on 1.x; dbt v2 (Sept 2026) makes deprecations errors, so check the upgrade guide.
3. §11 medallion: Iceberg v3 (deletion vectors, row lineage, defaults, variant); engine support varies (Snowflake v3 GA May 2026).

Inline version-specific qualifiers were added throughout: Spark 3.4+ `equal_null`, Spark 3.2+ `LAG IGNORE NULLS`, dbt contracts 1.5+, Postgres 12+/15+, Databricks Lakeflow Spark Declarative Pipelines naming, Spark 4.2 Auto CDC (SCD1).

### Added
- **Chapter head**: hb-meta + hb-lede after `</header>`.
- **hb-depth**:
  - "What is the grain of this fact table, and why does it matter?" (§5, top)
  - "Explain SCD Type 2 without the jargon" (§7 Type 2). The 30-second answer uses no Kimball terms.
- **hb-diagram**:
  - SCD2 version timeline for one customer: valid_from/valid_to/is_current, with a late fact resolved as-of, contrasted with the is_current and natural-key joins (§7).
  - The bus matrix, converted from an unlabelled `<pre>` to a figure (§6).
- **hb-attack** (4):
  - hash surrogate keys: cross-engine mismatch and collisions (§4)
  - "SCD2 for everything" (§7)
  - "OBT instead of a star" (§10)
  - "rename is metadata-only" (§13)
- **hb-drill**: "Dashboard total is exactly 2× Finance's number after a dimension change" (§5, end). Covers the natural-key/no-as-of SCD2 join, duplicate current rows, and the unweighted bridge, with links to §7, §15 and §16.
- **hb-failure**: SCD2 load failure-first table (5 rows) plus invariant tests (one current row; no overlap/gap) (§7).
- **New code**:
  - idempotent, order-independent accumulating-snapshot MERGE (§5)
  - staged-union SCD2 MERGE (§7)
  - dbt 1.9+ YAML snapshot with `hard_deletes` (§7)
  - as-of lookup with `-1` Unknown member (§16)
  - bridge weight-sum test (§15)
  - NULL-tokened hash key (§4)
- **Cross-links**: p02-1, p02-7, p02-18, p05-126, p07-6, p07-9, p08 star-vs-OBT, the p08 late-data incident, and #part-03.
- **L5 Interview Card** `p01-l5-card` (central question: "How would you model this business process?"), placed before the final back-to-top.
- **h3 ids** added in §15/§16: `p01-bridge-denormalizing-problem`, `p01-bridge-table-pattern`, `p01-bridge-safe-aggregation`, `p01-late-arriving-facts`, `p01-late-arriving-dimensions`.

### Code labels
36 labels; every code block is labelled.

| Executable status | Count |
|---|---|
| Yes | 10 |
| Yes — PostgreSQL only / PostgreSQL 12+ only / PostgreSQL / Snowflake only | 8 |
| Yes — Snowflake only | 3 |
| Yes — BigQuery only | 2 |
| Yes — Databricks only | 2 |
| Yes — Snowflake / Databricks / PostgreSQL 15+ only | 1 |
| Yes — Spark 3.5+ / 4.x with Iceberg only | 1 |
| Yes — dbt Core 1.9+ only | 1 |
| Illustrative — adapt to your dialect | 5 |
| Pseudocode | 3 |

Code fixed or rewritten: cb1, cb2, cb4, cb13, cb15, cb22, cb24, cb26, cb27, cb29, the bridge DDL and aggregation, and the junk-dim comment in cb9.

### Left alone / needs external verification
- **dbt 1.9 snapshot keys** (`relation`, `schema`, `hard_deletes` values `ignore|invalidate|new_record`, `dbt_valid_to_current`): written from knowledge, not in versions.md. Also check whether dbt v2 still accepts legacy `{% snapshot %}` blocks.
- **Databricks `AUTO CDC … STORED AS SCD TYPE 2`** and whether `APPLY CHANGES INTO` is still accepted: the naming comes from the audit and versions.md; exact syntax not verified.
- **Data Vault 2.1**: mentioned only as "a 2.1 revision exists; verify specifics".
- **ODCS**: the current version is not cited.
- **Iceberg v3 ratification**: versions.md marks it UNVERIFIED; hedged as "defined in the spec; engine support varies".
- **Snowflake single-MERGE SCD2** (cb13): believed valid (QUALIFY in a CTE inside USING, NULL merge key in UNION ALL) but not executed. The same goes for the Postgres 15+ claim for the accumulating MERGE (LEAST/COALESCE).
- **Pandoc line anchors**: the line-level ids `p01-cbN-M` (201 of them) were dropped where blocks were rewritten or trimmed. They are self-links only; nothing outside part-01 links to them. Every block-level id `p01-cbN` and every h2/h3/h4 id is preserved (cb8 never existed).
- **Kept as-is**:
  - Postgres TIMESTAMPTZ types in the §4 DDL.
  - The Type 4/6 pseudo-DDL (labelled Pseudocode).
  - Leftover "Kimball in Full" / "All Seven Types" h2 titles. Not renamed, because the ids derive from them; retitling is optional.

## Part 02



Word count (tags stripped, code included): **7,843 → 8,920**.
- Existing prose: 5,599 → ~4,060.
- Existing code: 2,244 → ~1,480.
- New interview components, labels and meta: ~3,380.

### Claims corrected

Claims 1–29 are **High** confidence unless marked (Medium); claim 30 is Medium. Claims 31–35 are the Medium audit items, all accepted and applied, with the confidence of each shown in its heading.

### Idempotency and overwrite semantics (§1, §3)

1. **Idempotency formula.**
   - Before: `f(f(x))(S_0) = f(x)(S_0)`
   - After: `f(f(S_0)) = f(S_0)`
   - Added: "idempotent ≠ deterministic", and pin/log the input snapshot.
2. **Iceberg overwrite option (cb5, cb22).**
   - Before: `.option("replace-where", …)` on Iceberg. That option doesn't exist, and a v1 overwrite can replace the whole table.
   - After: Iceberg `writeTo(...).overwritePartitions()`, Delta `.option("replaceWhere", …)` (the engine is now explicit), and a Spark SQL `INSERT OVERWRITE` example with `partitionOverwriteMode=dynamic`.
   - Added warning: in static mode with no PARTITION clause, it replaces the whole table.
3. **cb1: `assert` / `datetime.utcnow()`.**
   - `utcnow()` is deprecated in Python 3.12, and `assert` is stripped under `-O`.
   - Now uses `datetime.now(timezone.utc)` with an explicit `raise`.
4. **cb2 / cb23: Iceberg incremental read.**
   - Before: "only the changes".
   - After: appended rows only; use `create_changelog_view` for updates and deletes.
   - Delta CDF only covers versions written after `delta.enableChangeDataFeed` was set.

### MERGE (§4)

5. **Write-amplification example.**
   - Before: "1% of rows in a 10 GB file".
   - After: 1% scattered over 1,000 × 512 MB files ≈ 500 GB rewritten. (Medium)
6. **Delta merge-on-read mechanism.**
   - Before: Delta uses "positional/equality delete files".
   - After: Delta uses deletion vectors. Iceberg v2 uses position/equality delete files; v3 uses deletion vectors.
7. **Copy-on-write default.**
   - Before: "COW default in Iceberg v1".
   - After: COW is Iceberg's default `write.*.mode`.
   - The Databricks and OSS DV default difference is now in a 2026 note. (Medium on the Databricks wording)
8. **Partition pruning in MERGE.**
   - Before: "without partition col in ON, scans all partitions".
   - After: `t.dt = s.dt` prunes only through runtime/dynamic filtering; a literal bound guarantees static pruning. (Medium)
9. **Delta metric name.**
   - Before: `numOutputRows`
   - After: `numTargetRowsCopied` vs `numTargetRowsUpdated`. (Medium)
10. **`repartitionBeforeWrite.enabled` tip.** Removed along with cb20; the audit believes it defaults to true.

### Incremental processing (§5)

11. **HWM clock-skew fix.** It was backwards ("use event_ts"). Now: drive the HWM from a server-assigned ingest time or an offset.
12. **HWM code (cb21).** It widened the window and then appended, which duplicates rows. Rewritten as overlap + dedupe + Delta MERGE, with the HWM derived from committed output.
13. **`exactly-once` claim (cb24).** Now qualified: it holds only with a replayable source and a transactional sink.
14. **cb24 Iceberg streaming write.** `.option("path", …)` replaced with `.toTable(...)`. Labelled Spark 3.3+.

### Backfills (§6)

15. **Airflow trigger flag.**
    - Before: `airflow dags trigger -p`
    - After: `--conf`, and the DAG now declares `params`.
    - Added Airflow 3's `airflow backfill create`, hedged with "check current docs".
16. **SCD2 backfill sentence.** It was ambiguous. Now: join the dim version valid at the fact's event time, with the half-open predicate.
17. **Unsourced "$50k" figure.** Removed. Replaced with an estimate method: one week × N.

### Parquet (§7)

18. **Defaults.** Row-group default attributed to parquet-java/Spark. pyarrow and DuckDB size by row count. (Medium)
19. **Bloom filters.** Before: "Parquet 2.5+". After: parquet-java 1.12+, opt-in via `parquet.bloom.filter.enabled`. The format-version number was dropped. (Medium)
20. **PLAIN encoding.** Before: "no compression". After: an encoding; the page codec still applies.
21. **LZ4.** Now LZ4_RAW; the legacy `LZ4` framing is deprecated. (Medium)
22. **Page-level pruning.** Dictionary filtering and the page index (ColumnIndex/OffsetIndex) are now distinguished. (Medium)

### Partitioning (§8)

23. **Partition evolution syntax.**
    - Before: `SET PARTITION SPEC (…)` (invalid).
    - After: `ADD PARTITION FIELD` / `REPLACE PARTITION FIELD … WITH …` (Iceberg Spark SQL extensions), plus the Trino equivalent in a comment.
24. **Pruning walkthrough.** It mixed a Hive `dt` column with Iceberg hidden partitioning. Rewritten on `event_ts` half-open ranges. The function-wrapping claim is now engine/version-dependent. (Medium)
25. **`BETWEEN` in cb30.** It double-counted midnight and contradicted its own comment. Now a half-open range, and `BETWEEN` is listed as a pruning/double-count trap.
26. **Bucketed joins.** Before: "skip shuffle". After: storage-partitioned join (Spark 3.3+, `spark.sql.sources.v2.bucketing.enabled`), identical specs required; Iceberg buckets are not Hive buckets. (Medium)
27. **Sizing heuristics.** §8 and §17 contradicted each other (100 MB–10 GB vs "1 TB/day ideal" vs "hourly under 1 TB"). Unified into one rule in §8: files 128 MB–1 GB; daily from ~1 GB to TBs per day; hourly only for hour-bounded queries; under ~1 TB, cluster only.

### Small files and retention (§9)

28. **AQE claim.** It is post-shuffle only, with a 64 MB default, and shapes files only when a shuffle precedes the write.
29. **Retention.** Before: "configure 7-year retention via time travel". After: don't use time travel as retention; use tags or an immutable export. (Medium)
30. **`coalesce` trap added.** Coalescing also shrinks the upstream stage to N tasks. (Medium)

### CDC (§10) — High

31. Full-snapshot "guaranteed correctness": 20 parallel JDBC reads aren't one consistent snapshot. (Medium)
32. "Read from the write-ahead log (… binlog, SQL Server CDC)": corrected per source (WAL logical decoding, row binlog, CDC change tables, LogMiner). (Medium)
33. Debezium `source.lsn`: now numeric, and `source.ts_ms` added. Ops now include `t`, plus the tombstone behavior. (Medium on the exact field types)
34. "Sub-second lag" → seconds (Debezium), minutes (managed tools). (Medium)
35. "Works without touching the source" → **false**. Now lists `wal_level=logical` + replication slot, `binlog_format=ROW`, per-table CDC, and the WAL-retention disk-fill risk.
36. **foreachBatch MERGE (cb39), replaced with a compact correct version.**
    - Skips null tombstones.
    - Derives `order_id = coalesce(after, before)`.
    - Dedupes per key inside the micro-batch by `src_lsn` using `row_number`.
    - Uses a key-only equi-join (no `OR`).
    - Guards both update and delete on `s.src_lsn > t.src_lsn`, and orders by LSN rather than envelope `ts_ms`.
    - Maps envelope fields to target columns explicitly (no `UpdateAll` on the envelope).
    - Notes the hard-delete resurrection gap (the soft-delete fix is in Part 15).
    - The guard-explanation paragraph was corrected to match.

### Data quality and orchestration (§11, §12)

37. **dbt `tests:`** changed to `data_tests:` (dbt 1.8+). GX 0.x (cb41) and invalid SodaCL (cb42) blocks deleted; the link now points to Part 12.
38. **Airflow datasets** "Airflow 2.4+" → Datasets in 2.4+, renamed Assets in Airflow 3.
39. **"Never use the same DAG for backfill"** → Airflow 3 scheduler-managed backfill with its own cap, or a separate DAG/pool. (Medium)
40. **SLA block (cb46).** Kept, labelled Airflow 2.x only. Text states that `sla`/`sla_miss_callback` were removed in 3.0 and that Deadline Alerts (3.1+) replace them (check docs). A table-level freshness monitor is recommended.
41. **Sensor (cb45).** Poke mode held a worker slot for 4 hours. Now `deferrable=True`, with `mode="reschedule"` mentioned.

### Critical path, cost, skew, restart (§13–§16)

42. **Critical-path complexity.** Before: "adjacency matrix … O(V+E)" (the code was O(V·E)). After: adjacency list + deque, genuinely O(V+E).
43. **Cost model.** Rebuilt with clearly labelled **illustrative** unit prices, not real vendor prices ($0.05/vCPU-h, +50% platform, $0.02/GB-month, $0.02/GB inter-region, $0.09/GB internet).
    - Shuffle: "2–4× input" → usually a fraction of input (~3 TB).
    - Runtime: 40 min on 100 vCPU → ~1.5 h on 400 vCPU.
    - Result: ~$45/run same-region; +$40 to write output cross-region; +$200 to read input cross-region; $900 only if 10 TB goes to the internet.
    - The **"600x swing" is removed**. It was derived from a wrong $900 figure; the correct range is ~1×–20× compute depending on the boundary.
    - Added the accumulating-storage point and the omitted platform premium.
44. **Glacier "~1/10".** Replaced with "archive tiers several times cheaper, plus retrieval and minimum-duration fees". No vendor prices asserted.
45. **Salting.** Before: `key + '_' + RAND(10)`. After: `CAST(FLOOR(RAND()*10) AS INT)` salt, with the other side replicated via `explode(sequence(0,9))`. The AQE skew-join default and detection rule are now stated (Spark 3.2+), and aggregations are noted as not covered.
46. **"Atomic rename" on S3/GCS.** Corrected: it's copy + delete. Use a table-format commit or pointer swap.

### Partition keys and NULLs (§17, §18)

47. **§17 clickstream row.** "Hourly keeps partitions under ~1 TB" removed with the table trim.
48. **§18 numeric `-1` sentinel.** Changed to NULL plus a reason column. Enum sentinels are kept.

### Compressed (~2,300 words of existing prose and code removed)

- **§1:** "three dimensions of boundedness" taxonomy replaced by the three-answer completeness contract. Implications merged into one paragraph.
- **§2:** 11-stage list tightened to 8. The cb3 skeleton was dropped (the diagram and stage list cover it). cb4 was rewritten as a single-pass aggregate: it removes three scans, the undefined `ctx.expected_min_rows` and the unimported `F`.
- **§3:** "Why it matters" list became one line, and the anti-pattern prose was tightened.
- **§4:** Lakehouse execution cut to 3 lines, with links to Part 07 §6 and §18. The COW/MOR bare `<pre>` became a 4-row table. The cb20 Delta MERGE demo was removed. The tips list became a "why is my MERGE slow" line.
- **§6:** ThreadPool driver (cb25) removed. Cost-aware backfills shortened to one sentence.
- **§7:** ORC collapsed to one sentence. Avro code (cb28) removed. Bullets merged.
- **§8:** Cardinality math plus §17's sizing heuristic merged into one rule. Clustering "when to" list cut. Pruning steps compressed. Link to Part 07 §5.
- **§9:** Causes turned into one line; prevention list tightened. Link to Part 04 §10 and Part 07 §7.
- **§10:** Pros/cons lists cut. The CDC depth was **not** expanded; there is a prominent callout to `#part-15`.
- **§11:** GX and Soda blocks deleted; the taxonomy table gained a Block/Warn policy column. Link to Part 12.
- **§12–§16:** Prose tightened.
- **§15:** Mitigations cut to 4 lines, with a link to Part 04 §7.
- **§17:** 18-row table cut to 8 rows (4 columns). The duplicate "bucketed-id trick" block and the contradictory sizing heuristic were removed. Link to Part 08.
- **§18:** 9-row table cut to 5 rows. Link to Part 01 §12. "Q4 in Part 09" is now a real link to `#p09-4-the-sql-question-bank-senior-tier`; Q4 itself has no id, and I can't edit Part 09.
- **Structure:** mid-part "Next: 03-streaming-processing.md" footer, stray `<hr>`s and the intro paragraph (replaced by the lede) removed.
- **Ids:** all h3s in §13–18 now have ids (e.g. `p02-modeling-the-graph`, `p02-the-four-costs`, `p02-skew-mitigations`). Every original id is preserved: as an h3, a `<p id>`, or an empty `<span id>` for removed blocks (cb3, cb20, cb25, cb28, cb41, cb42, and the GX/Soda/skeleton/dynamic-mapping h3s). Pandoc per-line anchors (`p02-cbN-M`) are gone only in rewritten blocks; they are self-links.

### Version notes added

- **§4 COW/MOR:** Iceberg v3 deletion vectors vs v2 delete files; Databricks enables DVs by default, OSS Delta does not.
- **§6 Airflow 3:**
  - 3.0 GA Apr 2025, 3.3 current
  - `execution_date` → `logical_date` (can be None)
  - Datasets → Assets
  - `sla`/`sla_miss_callback` removed; Deadline Alerts in 3.1
  - `airflow.sdk` imports
  - scheduler-managed backfill
  - `catchup` defaults to False
- **§8 layout:** Delta Liquid Clustering (GA since 3.2; Databricks advises not partitioning under ~1 TB), BigQuery partition cap, Snowflake micro-partitions, Iceberg sort order and SPJ.
- **§10 callout:** full CDC treatment in Part 15. This is a cross-link, not a version note.
- **Inline version labels:** Spark 3.3+ `AvailableNow`; PostgreSQL 15+ MERGE; `NOT MATCHED BY SOURCE` engine list (Delta, BigQuery, SQL Server, PG 17+; not Snowflake); dbt 1.8+ `data_tests`, dbt v2 hedge; AQE skew join Spark 3.2+.

### Added

- **hb-meta + hb-lede:** after the header.
- **hb-diagram:**
  - Batch WAP pipeline (sources → bronze → validate → transform → staged write → audit → publish → serve), §2.
  - Idempotent partition-overwrite flow, §3.
  - Linear DAG, §12 (converted from the bare `<pre>`).
- **hb-failure:** batch pipeline, §2. Rows: source unavailable, partial write, duplicate input, schema drift, late partition, storage/catalog unavailable.
- **New h3:** "Write-audit-publish (WAP)" (`p02-write-audit-publish`), §2.
- **hb-depth:**
  - "How do you make a batch job idempotent?", §3.
  - "How do you backfill two years of data safely?", §6.
- **hb-attack (3):**
  - "I'll just rerun the job" → append + unpinned input, §3.
  - `updated_at` guard vs re-sent content → content-hash guard, §4.
  - "Partition by hour" → small-files math (4,800 files/day, 1.75M/year, ~4 MB avg), §9.
- **hb-drill:** "A rerun of yesterday's job doubled yesterday's revenue", §3. Covers append vs overwrite and non-deterministic input, via the 2.00× vs 1.97× distinct-key diagnostic, rollback and re-triggering downstream.
- **CDC and restart additions:**
  - §10: the four upsert rules and the hard-delete resurrection caveat.
  - §16: the "restart at noon" drill now lists downstream jobs that already consumed partial input.
- **Maintenance quartet table**, §9.
- **L5 Interview Card** `p02-l5-card` at the end. Central question: "How do you design a batch pipeline that is safe to rerun?"

### Code labels

- 39 code blocks, all labelled:
  - 21 Yes (incl. "Yes — <engine> only" variants)
  - 17 Illustrative
  - 1 Pseudocode
- **Fixed/rewritten:** cb1, cb2, cb4, cb5, cb6, cb19, cb21, cb22, cb23, cb24, cb26, cb29, cb30, cb33, cb34 (added catalog prefix and `rewrite_manifests`), cb35 (added `remove_orphan_files`), cb38, cb39, cb40, cb45, plus the critical-path block.
- **Removed:** cb3, cb20, cb25, cb28, cb41, cb42.
- **Kept with original highlighting:** cb7–cb17, cb31, cb32, cb36, cb37, cb44, cb46.

### Left alone / needs external verification

- **Delta `replaceWhere`:** the claim that it fails by default when data falls outside the predicate (`replaceWhere.constraintCheck`). Verify it for OSS Delta 3.x/4.x.
- **Airflow 3 backfill CLI:** flag names (`--max-active-runs`, reprocess behavior) and the Deadline Alerts API are hedged "check current docs". versions.md doesn't cover Deadline Alerts or the CLI.
- **Iceberg WAP:** procedure names (`fast_forward`, `cherrypick_snapshot`) and the `spark.wap.branch` config should be verified against Iceberg 1.10/1.11 docs.
- **dbt v2 (Sept 2026):** confirm `data_tests:` syntax is unchanged. dbt 1.10+ also nests test args under `arguments:`, which is not applied here.
- **Databricks:** DV default-on wording and the "<1 TB don't partition" guidance wording.
- **Unused anchor:** Part 09 Q4 has no id. A Part 09 owner could add one; the link currently targets the SQL-bank h2.

## Part 03



The file was built reproducibly from the original extract by `w03/run.py`, which applies modules `s1.py` to `s9.py` with asserted exact-match replacements. The original extract is kept at `w03/part-03.orig.html`.

### Claims corrected

### High confidence

| Section | Before | After | Why |
|---|---|---|---|
| §2 | "ET ≤ IT ≤ PT always" | Holds causally, but recorded timestamps violate it (clock skew; `CreateTime` vs `LogAppendTime`). Clamp future timestamps. | Clock skew is routine for mobile clients. |
| §3 | B is sized from `processing_time − event_time`. "B = p99 lateness → ~1% dropped." | B bounds **out-of-orderness** (`max_ET_seen − ET`, per partition), not end-to-end delay. Worked replay example included. Late events are dropped only if their window has already fired. | Core error. Sizing B from delay holds every window open for hours after an outage. |
| §3 | `forMonotonousTimestamps()` listed as a fix for a stalled source | Watermark alignment (`withWatermarkAlignment`, Flink 1.15+) | The old advice did nothing for stalls. |
| §3 | Idleness presented as a fix, without qualification | Added: "idleness is not progress" | The watermark still does not advance without data. |
| §3 | Punctuated watermarks: "`onEvent` advancing and `onPeriodicEmit` emitting" | Emit inside `onEvent`; leave `onPeriodicEmit` empty | The original had the two roles backwards. |
| §6 / §3 | Lateness metric = `PT − ET` (cb14) | Two metrics: delay (`ingest − ET`) for freshness, and out-of-orderness (running `max ET − ET` in partition/offset order) for B. New cb14 computes both. §6's h3 moved into §3 with the same id. | Same conflation as above. |
| §5 | cb11: "custom Trigger extending EventTimeTrigger" | Real `Trigger<Object,TimeWindow>` with early, on-watermark and late firing. Built-in triggers named. Spark output modes and Flink SQL early-fire mapped. | `EventTimeTrigger`'s constructor is private. |
| §6 | "Drop (default in Spark)" | Added the nuance: data inside the delay is guaranteed; data beyond it *may* be dropped. | Matches Spark's documented semantics. |
| §7 | Spark Kafka sink "uses Kafka transactions" | At-least-once only. "Where it breaks" now says Kafka as a sink is at-least-once by design. | Factually wrong in every Spark version. |
| §7 | "Three necessary conditions… any one missing and EO fails" (condition 3 = atomic commit) | Replayable source + deterministic-or-checkpointed processing + a sink that is **either** transactional **or** idempotent (keyed upsert/overwrite). Cross-link to `#part-13`. | Resolves the contradiction with the idempotent-sink subsection. |
| §7 | "Sinks acknowledge completion" | Barriers are injected at source tasks. **Every task** acks to the CheckpointCoordinator. `notifyCheckpointComplete` triggers the sink commit. | Precision. |
| §7 | cb15 `.start()` with no table | `.toTable("lake.silver.events")` | The original would not write to a named Iceberg table. |
| §8 | "Dispatcher … spawns JobManagers per job" | The Dispatcher starts a **JobMaster** per job. The JobManager process = Dispatcher + ResourceManager + JobMasters. | Architecture error. |
| §8 | HashMapStateBackend: "synchronous checkpoints (pauses JVM)" | Asynchronous full snapshots (copy-on-write); not incremental. | Wrong. |
| §8 | cb19 `env.addSource(kafkaSource)` | `env.fromSource(kafkaSource, wm, "kafka")` | A FLIP-27 source does not compile with `addSource`. |
| §8 | Schema evolution "via Avro (auto)"; migration "re-key from scratch" | POJO and Avro evolve; Kryo does not. Tool named: State Processor API. | Accuracy. |
| §9 | ZooKeeper-era controller text | KRaft-first. Active controller = Raft leader of the controller quorum; metadata log. ZooKeeper removed in 4.0; migrate on 3.x. | Kafka 4.x (versions.md). |
| §9 | "Controller propagates … to producers" | Clients learn of the change via a metadata refresh after `NOT_LEADER_OR_FOLLOWER`. | Wrong. |
| §9 | "Leader handles reads and writes" | Follower fetching since 2.4 (KIP-392). | Accuracy. |
| §9 | acks=1 / all "persist"; "no loss within RF" | acks=1 means page cache, not fsync. acks=all waits for the *current* ISR and needs `min.insync.replicas ≥ 2` plus unclean election off. Durability comes from replication, not fsync. acks=all and idempotence are the defaults since 3.0. | Precision. |
| §9 | Rebalance: eager and cooperative only; "prefer CooperativeSticky everywhere" | Added the KIP-848 consumer protocol (GA 4.0, opt-in `group.protocol=consumer`; `partition.assignment.strategy` ignored), static membership, `max.poll.interval.ms` storms, and the trap that Flink `KafkaSource` does not use group rebalancing. | Kafka 4.x (versions.md). |
| §11 | Full-snapshot TTL cleanup "during checkpoint" | Filters only full snapshots; does not shrink local state; not effective with incremental RocksDB. | Wrong. |
| §12 | Diagnosis: "the operator showing HIGH — its downstream is the bottleneck" | Walk downstream to the first operator that is *not* backpressured but has high `busyTimeMsPerSecond`. | Incomplete for cascades. |
| §12 | Metric `inputQueueUsage` | `inPoolUsage`/`outPoolUsage`, `backPressuredTimeMsPerSecond`, `busyTimeMsPerSecond` | Invented metric name. |
| §14 | Diagram: Iceberg bronze and Redis fed from Kafka(sessions) | New diagram matches the code: Flink → Kafka sessions (EO), Iceberg silver, late topic (ALO). | Diagram contradicted the code. |
| §14 | `SessionAggregator.add`: `startTs` = time of the first-arriving event | `min(startTs, eventTime)` | Wrong for out-of-order input. |
| §14 | "distribution mode hash … avoids skew" | HASH clusters by table partition key (fewer small files) and can concentrate skew. | Wrong. |
| §14 | `IcebergSink.forRowData(...)` fed POJOs; no `transaction.timeout.ms`; late sink had no guarantee set | Map to `RowData` first; `FlinkSink.forRowData(...).append()`; `transaction.timeout.ms` set; late sink is `AT_LEAST_ONCE`. Three EO-sink traps listed (timeout vs broker max, per-checkpoint visibility, LSO pinning). | Illustrative code made coherent. |
| §15 (was 16) | "The producer writes a transaction marker to each affected partition's commit-coordinator" | The **transaction coordinator** writes COMMIT/ABORT control markers. | Wrong. |
| §15 | "Aborted transactions leave tombstone markers" | ABORT control records. A tombstone is a null-value compaction record. | Wrong term. |
| §15 | "Flink's TwoPhaseCommit sink implements this (sendOffsetsToTransaction)" | Kafka Streams `exactly_once_v2` uses `sendOffsetsToTransaction`. Flink stores offsets in its checkpoint and commits pre-committed transactions on checkpoint-complete. | Wrong. |
| §15 | cb23: `sendOffsetsToTransaction(Map, String)`; catch-all abort | `consumer.groupMetadata()` overload. Fatal exceptions (`ProducerFencedException` etc.) close the producer; abortable ones abort and rewind. | Deprecated overload; wrong fencing handling. |
| §16 (was 17) | ATO probe: "MATCH_RECOGNIZE … with a 30-minute watermark" | `WITHIN INTERVAL '30' MINUTE`, with the watermark delay sized to out-of-orderness (seconds). The SQL example uses `WITHIN`. | The original conflated the pattern window with watermark delay. |
| §17 (was 18) | "Stream-stream join … late arrivals produce retractions" | Window and interval joins drop late rows. Regular outer joins emit retractions and keep unbounded state without TTL. | Wrong. |
| §19 (was 20) | "Kinesis Data Firehose" | Amazon Data Firehose (formerly Kinesis Data Firehose) | Renamed in 2024. |
| §19 | "relative to a Databricks or EMR Flink cluster" | Self-managed Flink on EMR or Kubernetes | Databricks does not run Flink. |
| §19 | "Partition reassignment (offline …)" | Online, throttled reassignment; adding partitions remaps keys. | Wrong. |
| §19 | "ZK/KRaft" | KRaft controllers (or managed MSK / Confluent) | Kafka 4.x. |
| §19 | "Five consumers polling 200 ms → throughput-limited" | The binding limit is 5 GetRecords calls/s per shard, shared. | Wrong cause. |

### Medium confidence (applied after review)

- §3: the "perfect watermark" example now reads "the source has complete knowledge of its input…".
- §7: file sink "two-phase commit with a `commits/` log" now reads as a batchId-idempotent commit (`_spark_metadata`, Delta `txnAppId/txnVersion`, Iceberg snapshot metadata).
- §7: "Chandy-Lamport algorithm" now reads "asynchronous barrier snapshotting (a Chandy-Lamport variant)".
- §9: leader election now reads "first alive in-ISR replica in assignment order". ELR (KIP-966) is noted.
- §9: share-groups note added (KIP-932, production-ready in 4.2 per versions.md).
- §11: "100 GB heap infeasible" now says HashMap state spreads across TaskManagers, and the real limits are GC and full snapshots.
- §12: "Enable unaligned in production" replaced with: prefer aligned checkpoints plus `aligned-checkpoint-timeout` plus buffer debloating.
- §15: zombie bullet. Only the *same* `transactional.id` gets fencing; a random id per restart disables it.
- §19: EFO "1.5× premium" now reads "extra per-consumer-shard-hour and per-GB charges".
- §19: Firehose buffering is hedged: 0 s possible at time of writing; check docs.
- §20: "outbox is the only correct way" softened to "the standard way", with alternatives named. Added a Debezium outbox router note. LocalStack replaced with Testcontainers.
- §2: the made-up "~1% of events dropped" statistic removed. The distribution is labelled as a hypothetical example.

### Compressed

Word count, tags stripped: **8,637 → 12,498**.

- New components add 3,382 words: meta, lede, 2 depth, 2 attack, drill, 8 diagrams, failure table, 3 notes, card, 23 code labels.
- The remaining body is ~9,100 words. That includes ~800 words of new required inline material: the when-EO table, backpressure chain table, new cb14 and cb11, and KIP-848 / static membership / storms / Flink trap.
- The pre-existing text therefore shrank by roughly 300–400 words net, after absorbing the corrections.

Cuts and merges:

- **Kafka EOS**, previously in 3 places (§7 Spark bullet, §9 + cb23, §16): mechanics consolidated in §15 (id `p03-16-…`, which other parts already link to). §9 keeps a one-line cross-link. cb23 moved and rewritten there (id kept). About −200 words.
- **Measuring lateness**: §6 copy removed. The h3 id moved into §3 and the §6 text became a pointer.
- **Dual-path reconciliation** (§6) folded into §13's "pragmatic middle".
- **§13 Lambda/Kappa** cut to 3 short paragraphs, adding the replay cost (KIP-405 / lakehouse). Cross-linked to Part 08.
- **§17 (was 18) stream-table duality** cut from ~250 to ~150 words. Temporal-join and compaction duplicates removed; cross-links to §9 and §10.
- **§18 (was 19)**: StateFun mention dropped. Pattern A now points at §14 and §11 instead of a fourth sessionization treatment.
- Code removed and replaced by prose, block ids kept as `<span>`:
  - cb10: calendar WindowAssigner.
  - cb17: checkpoint setters, which duplicated cb34.
  - cb20: CountByUserFn.
  - cb30: the bounded-session KeyedProcessFunction. It was illustrative and would NPE.
- Code shortened: cb35 (boilerplate trimmed, bug fixed).
- Converted to prose: the sliding-window one-liner `pre` and the `state_size` formula `pre`.
- Tightened throughout: §1 consequences, §2 processing-time list, §4 window-state-size list, §5 trigger list and accumulation modes, §7 definitions, impossibility footnote and Spark mechanism, §8 architecture, chaining, keyed state and RocksDB internals, §9 topic basics and compaction, §11 budgeting, §19 Kinesis intro, MSF and Firehose, §20 EDA intro, choreography, saga and CQRS.
- One probe removed from Kinesis ("When would you pick Kinesis over Kafka?"); the new hb-attack replaces it.
- Structure: the mid-part `<hr />` + "Next: `04-spark-internals.md`" artifact and the stray `<hr>`s removed. h2 text renumbered 1–20 (16→15 … 21→20), ids unchanged. All 15 id-less h3s in old §16–19 were given `p03-…` ids.

### Version notes added

1. **§4 — Flink 1.x vs 2.x APIs.** `Time` → `Duration`; `SourceFunction`/`addSource` and `SinkFunction`/`addSink` → Source/Sink V2; `open(Configuration)` → `open(OpenContext)`; `TwoPhaseCommitSinkFunction` → Sink V2 committers. Explains the "Yes — Flink 1.x (1.20 LTS) only" labels.
2. **§8 — Flink 2.x deltas.** DataSet, Scala and SourceFunction removed; ForSt disaggregated state; config keys replace env setters.
3. **§9 — Kafka 4.x.** KRaft-only; KIP-848 opt-in; share groups; 4.3 is the current line.

The hb-meta block also carries the version frame.

### Added

- **hb-meta + hb-lede** after the header.
- **hb-diagram** (8):
  - §3: min-of-inputs watermark.
  - §4: tumbling and session windows.
  - §7: **Flink checkpoint lifecycle** (required #3).
  - §8: incremental checkpoint.
  - §9: **Kafka partition / consumer-group model** (required #2) and log compaction.
  - §14: **streaming architecture** (required #1): clients → Kafka → Flink → Kafka EO / Iceberg / late topic → serving, BI/ML, reconcile.
- **hb-depth** (2):
  - §3: "What is a watermark?" (audit's 30s / 2 min / deep outline).
  - §9: "What ordering guarantees does Kafka give you?" Covers per-partition order only, key → partition, and the four things that break it: retries without idempotence, partition-count change, multiple producers, and consumer parallelism within a partition.
- **hb-attack** (2):
  - §7: "exactly-once end to end" → "your sink is an HTTP API".
  - §19: "I would use Kafka" → "Why not Kinesis?", answered from fan-out, semantics, replay, and ops/cost.
- **hb-drill** (1), §6: "Window results for 02:00–03:00 keep changing for hours". Observe → Prevent, with a finality contract (provisional/final).
- **hb-failure** (1), §14: stuck watermark, checkpoint timeouts, EO sink txn-timeout loss, lag beyond retention, unbounded state.
- **New subsections:**
  - §7 "When exactly-once is worth its cost": 7-row table plus attack.
  - §12 "The chain: producer → broker → consumer → sink": table, plus the lag-beyond-retention = silent-loss point and a `#part-13` link.
  - §10: temporal vs lookup join; `table.exec.state.ttl` for regular joins.
  - §19: provisioned vs on-demand capacity; Lambda `ParallelizationFactor`.
- **L5 Interview Card** `p03-l5-card` at the end. Central question: "How do you guarantee correct results from a streaming pipeline when events arrive late, out of order, or twice?"

### Code labels

23 labelled blocks:

| Executable status | Count |
|---|---|
| Yes | 5 |
| Yes — Flink 1.x (1.20 LTS) only | 8 |
| Yes — Flink 1.19+ (incl. 2.x) only | 1 |
| Yes — Flink SQL only | 2 |
| Yes — Spark 3.1+ only | 1 |
| Yes — Spark 3.1+ with the Iceberg runtime only | 1 |
| Yes — PostgreSQL 9.5+ only | 1 |
| Illustrative — adapt to your dialect | 4 (cb19, cb23, cb34, outbox SQL) |

Code fixed:

- cb11: new real trigger.
- cb14: new out-of-orderness measurement.
- cb15: `.toTable`.
- cb18: concrete `ON CONFLICT DO NOTHING` / `DO UPDATE` with `$n` params.
- cb19: `fromSource`.
- cb23: groupMetadata and fatal vs abortable handling.
- cb34: RowData mapping, `FlinkSink`, txn timeout, late-sink guarantee; the redundant `EventTimeTrigger` and the blanket unaligned setting removed.
- cb35: `startTs` min.
- MATCH_RECOGNIZE: `WITHIN`, `AFTER MATCH SKIP`.

Eight text `pre`s were converted to hb-diagram figures (two re-wrapped to fit 64 columns). Two were inlined as prose.

Pandoc per-line anchors (`p03-cbN-M`, 222 ids) disappear for rewritten or removed blocks. They are self-anchors only; the whole article, frags included, was grepped and no link targets them. Block-level `p03-cbN` ids are all kept.

### Left alone / needs external verification

- **KDS maximum record size.** Text is hedged ("1 MiB historically; AWS has raised the limit since — check current docs"). The audit's "10 MiB (2025)" was not confirmed from an official source.
- **Firehose zero-buffering (0 s)** and the **EFO ~70 ms** figure. Both are hedged as time-of-writing / AWS docs.
- **`transaction.max.timeout.ms` default of 15 minutes.** Stated with "at time of writing; check current docs".
- **Flink 2.x.** Whether `CheckpointConfig` setters and `setStateBackend` are removed or only deprecated. Hedged as "2.x prefers config keys". cb17/cb32/cb34 are labelled 1.x.
- **`OffsetResetStrategy`** in the Flink Kafka connector with Kafka 4.x clients (KIP-1106 deprecation) is left in cb34, which is Illustrative.
- **Flink SQL `table.exec.emit.early-fire.*`** is described as experimental; it is undocumented in some versions.
- **"Watermarks are not restored from checkpoints"** (watermark depth deep dive) is from the audit. Confirm against current Flink docs for FLIP-27 sources with alignment.
- **Lambda `ParallelizationFactor` up to 10** is from memory, consistent with the audit.
- **Deliberately not rewritten:** all Flink code to 2.x syntax (per brief: label, don't rewrite); cb12/cb13 `addSink`/`Time`; §20 EDA structure. Part 08 answers that duplicate §3/§7/§8 are outside this file; the audit recommends they link to the Part 03 anchors.

## Part 04



Word count (tags stripped): **6159 → 8300** total.
- Existing material: 6159 → ~5380 (−13%). Prose alone: 4821 → 4074 (−15.5%). Code and plan output: 1338 → 1305. Code stays roughly flat because the corrected plan outputs are slightly longer.
- New interview material: ~2900 words (meta/lede, diagram, depth ×2, attack ×2, drill, 3.5-vs-4.x note, runtime pruning, SPJ, AQE limits, L5 card).

Defaults were checked against the local `SQLConf.scala` (branch-4.0) and the verified list in the audit. Version and support facts come from `audit/versions.md`.

### Claims corrected

All High-confidence Part 04 items from `audit/part-04-05.md` §2 are applied, and so are most Medium items. The numbers below are audit numbers.

**Plan layers, Catalyst and CBO**
- **#1** `explain(mode="cost")`: the "post-AQE" comment was wrong. It now reads "optimized logical plan + size/row stats (pre-execution); the AQE final plan appears only after an action". §4.5 now says `explain()` before an action shows `isFinalPlan=false`. (High)
- **#2–3** The Finish Analysis row listed Analyzer rules. It now lists EliminateSubqueryAliases, ComputeCurrentTime and ReplaceExpressions. (High)
- **#4–5** The DecimalAggregates and ConvertToLocalRelation rows were wrong. Both rows were removed during compression rather than corrected. They are beyond what an L5 interview needs. (High / Medium)
- **#6** "CBO chooses BHJ pre-AQE" was wrong. It now says: size stats alone drive BHJ, and CBO only sharpens the post-filter estimate. Also added: `cbo.joinReorder.enabled` is off by default. (High)

**AQE**
- **#7** The dynamic-join config was wrong. It is now `spark.sql.adaptive.autoBroadcastJoinThreshold` (3.2+, falls back to the global threshold), with localShuffleReader as the follow-on optimization. Also added `maxShuffledHashJoinLocalMapThreshold`. (High)
- **#8** The coalesce pseudocode sorted partitions by size. It now merges contiguous partition-id ranges only. (High)
- **#9** Added the `parallelismFirst=true` trap. The wording was refined against the SQLConf doc: it computes a smaller target from default parallelism, bounded below by `minPartitionSize` (1 MB). The config doc itself recommends `false` on busy clusters. (High)
- **#10** "40 MB under the threshold" changed to 8 MB, under the 10 MB default. (High)
- **#11** `CustomShuffleReader` changed to `AQEShuffleRead`, noting the old name was used before 3.2. (High)
- **AQE skew split description:** removed "AQE won't split if the cost is worse". Replaced with the real rule: it skips the split if it would add an extra shuffle, unless `forceOptimizeSkewedJoin` is set (verified in SQLConf). (Medium)

**Shuffle**
- **#12–13** The shuffle diagram described hash shuffle. It is now sort-based: 1 data + 1 index file per map task, 2M files on disk, M×N blocks fetched. The old viz-schema list was converted to an hb-diagram. (High)
- **#14** ESS "K8s daemonset" was wrong. OSS Spark has no supported ESS on Kubernetes; the text now names shuffle tracking, decommission migration or RSS instead. (High)
- **#15** Push-based shuffle is now labelled "3.2+, YARN only, requires ESS". (High)
- **#16** The unsourced "2–3× faster" claim was removed. It now points to LinkedIn-reported wins and says to measure your own. (Medium)
- **#17–18** Fixed the shuffle-on-object-storage bullets. Celeborn comes from Alibaba RSS and Uniffle from Tencent Firestorm; Uber built its own RSS. "Dominant" was dropped. The fallback-storage config is now named. (High)

**Joins and broadcast**
- **#19–20** The decision tree now covers:
  - hint precedence
  - SHJ preconditions
  - no-equi-key → BNLJ/CartesianProduct
  - AQE conversions

  (Medium, agreed)
- **#21** FULL OUTER is never BHJ; SHJ supports it since 3.1. Added build-side limits per join type. (High)
- Added the broadcast hard limits: 8 GB or ~512M rows. (High, per audit)
- **#31** "AQE handles stale broadcast" was wrong. It now says AQE never demotes a BHJ planned from stale scan stats. (Medium, agreed)

**Skew**
- **#22** In cb21, builtin `sum` raised a TypeError. Fixed to `F.sum` with the import added. (High)
- **cb20 / cb21 salt:** `floor(rand()*N)` replaced with a deterministic `pmod(xxhash64("event_id"), N)`. Added the explanation that a rand() salt is unsafe on task retry. (High, per audit)
- **§7.2:** removed the unsourced "handles ~80% of skew cases".
- **§7.4:** added the nuance that map-side partial aggregation already covers sum/count hot keys, so two-stage aggregation mainly matters for non-partial aggregates. (Medium; the partial-aggregation behaviour is well established)

**Tungsten**
- **#23** Off-heap was presented as the default. Tungsten pages are on-heap `long[]` by default; off-heap applies only with `offHeap.enabled`. Also notes that Spark 4 on Java 17/21 still uses Unsafe via `--add-opens`. (High)
- **#24 / #42** Row size had two figures (~80 in §8, ~60 in §17). Now one figure: ~88 bytes for 10 fixed-width fields. (High)
- **#25** The SIMD claim moved from UnsafeRow to the columnar/vectorized readers. (Medium, agreed)
- **#26** "~8000 lines" codegen fallback was wrong. Now: `hugeMethodLimit` 65535 bytecode bytes, `maxFields` 100, and the separate HotSpot 8000-byte JIT limit. (High)
- **#41** Tungsten history corrected: phase 1 in 1.4–1.6, whole-stage codegen in 2.0. (High)
- **#43** "10–100×" (in §17) and "2–5×" (in §8) contradicted each other. Replaced by "up to ~10× on specific operators in Databricks' 2016 microbenchmarks; end-to-end gains are smaller". (High)
- **#44** "Missing stars = 10× slower" was overstated. Now: the operator runs interpreted and splits the stage. (Medium, agreed)

**Memory**
- **#27** "Execution evicts storage freely" was wrong. It can evict only down to the `storageFraction` floor. (High)
- **#28** GC advice was to raise `memory.fraction` to 0.7. Now: fix the cause first, and change `memory.fraction` only with GC logs in hand. (Medium, agreed)
- **#45** Spill advice was backwards. Fixed to INCREASE shuffle partitions. (High)
- Added `spark.executor.pyspark.memory`, and that off-heap size is added to the container on top of overhead (3.0+).

**Partitioning**
- **#29** The cb28 comment claimed "AQE coalesce + maxRecordsPerFile". Now REBALANCE (3.2+), and maxRecordsPerFile only caps (it splits, never merges). Added the REBALANCE bullet to the §10 list. (High)
- **#30** Added the skew warning for `repartition(200, "event_date")`: one date means one busy task. (High)

**Python UDFs and Arrow**
- **#32** Row UDF text: removed the per-row "10K rows/s" figure. It now describes pickled batches with a per-row call. Added Arrow Python UDFs, with versions verified in SQLConf: the config is 3.4.0 and `useArrow` is 3.5. Default false through 4.1; `versions.md` says 4.2 turns it on by default, hedged "check current docs". (High)
- **#33** "Zero-copy, ~1M rows/s" replaced by "serialized Arrow batches (10,000 rows) over a socket". (High)
- **#34–35** Fixed cb32:
  - `np` import and `np.log1p` added
  - `Iterator` import added
  - `pd.Series` returned
  - "once per task" instead of "per executor"

  (High)
- **#36** `arrow.pyspark.enabled` default is **false** in OSS and governs only `toPandas()`/`createDataFrame`. Fixed in both §11 and §13. (High)
- **#37** The applyInPandas column-order claim was wrong: columns match by name when labels are strings. (High)

**Plan walkthrough**
- **#38** The fake plan node "ShuffleQueryStage (coalesced from 200 to 50)" was replaced by `AQEShuffleRead coalesced` + `ShuffleQueryStage`. Added WindowGroupLimit Partial/Final (3.5+). The block is labelled illustrative, and the numbered steps were rewritten to match. (High)
- **#39** `date_trunc` does not block partition pruning. Only UDFs or predicates mixing partition and data columns do. (High)
- The §2.3 plan output now shows the `isnotnull` filters real output adds. (Audit code-table note)

**Configs and dynamic allocation**
- **#40** The dynamic-allocation/ESS row claimed "unless push-based shuffle". Fixed: shuffle tracking is on by default, and push-based shuffle itself needs ESS. (High)
- **#46** The K8s dynamic-allocation fix recommended persistent volumes. Now: shuffle tracking, decommission migration or Celeborn. (High)
- Removed "Databricks" from the list of cluster managers.
- Streaming dynamic-allocation claim softened.

**Native engines and PySpark**
- **#47** "Velox under Presto/Trino" was wrong. Now: Presto C++/Prestissimo and Gluten for Spark, plus DataFusion Comet and RAPIDS. (High)
- **#48** Photon "similar hardware cost" was wrong. Now: vendor-reported speedups, a higher DBU rate, and cost must be measured per workload. (Medium, agreed)
- **#49** Added Spark Connect: 3.4+, GA in 4.0, no RDD/SparkContext, and it changes driver-side debugging. (High)
- Row-UDF "10–30×", Pandas "3–10×/within 2×" and "5–10 ms per call" were unsourced multipliers. Softened to orders of magnitude.

### Compressed
- **Contents:** removed the local Contents h2 and list (~90 words). `<span id="p04-contents">` is kept.
- **Tungsten:** §17 was merged into §8. The two figures that contradicted each other are resolved, and the corrected spill/overhead bullets moved to §9. `<span id="p04-17-…">` is kept as an anchor. Net about −250 words.
- **Broadcast:** §11 was merged into §6.2 (lifecycle, why 10 MB, raising the threshold, gotchas). All five §11 ids (`p04-broadcast`, `p04-11-…`, `p04-111…114`) are kept as spans at the merge point. About −200 words.
- **Config cheat sheet:** five tables became one table with an "OSS default (3.5 / 4.x)" column.
  - Dropped these rows: executor.memory, min/maxExecutors, idleTimeout, codegen.wholeStage, offHeap.size, coalescePartitions.enabled, adaptive.enabled, broadcastTimeout, preferSortMergeJoin, memory.fraction, dynamicAllocation.enabled, maxResultSize. All of them are covered in prose elsewhere.
  - Added these rows: parallelismFirst, adaptive.autoBroadcastJoinThreshold, ansi.enabled, DPP, runtime bloom filter, v2.bucketing (SPJ), pythonUDF.arrow, shuffleTracking.
  - Sub-ids 141–145 are kept as spans.
  - Net about −15% words for the section.
- **Catalyst rule table:** 7 rows → 5.
- **Plan walkthrough:** the optimized logical plan was removed (the physical plan carries the lesson), and the numbered steps went from 9 to 4.
- **Memory:** the viz-tree was replaced by one hb-diagram that also shows overhead and off-heap.
- **Tightened across the chapter:** §3 bullets became one sentence; the AQE, shuffle, SMJ/SHJ/BNLJ, skew, partitioning, Photon and PySpark prose was tightened.
- **Pointers instead of repeats:** small files now link to `#p02-9-small-files-and-compaction`, Arrow outside Spark to `#p06-5-…`, and the Monday-OOM incident to `#p08-incident-spark-job-ooms-only-on-mondays`. The 999-task drill links to `#part-19`.
- **Renumbering:**
  - h2s renumbered 1–18. "Closing framework" moved last and is numbered 18.
  - h3 labels were renumbered to match; ids are unchanged.
  - Appended sections got h3 ids: p04-181/182, p04-191/192, p04-201/202.

### Version notes added
- **Main hb-note, §17 "Spark 3.5 LTS vs 4.x — what changes in an interview":** a compact table covering:
  - ANSI on by default: invalid cast, overflow and divide-by-zero now raise; use `try_*`
  - Spark Connect
  - VARIANT
  - Java 17/21 and Scala 2.13 only
  - Python: Arrow UDFs, Python Data Source API
  - pipe syntax, collations, Declarative Pipelines (4.1)

  It also says 3.5 is on extended support (security fixes until November 2027) and separates the timeless concepts from version-specific behaviour.
- **§13 config table:** labelled "open-source Spark default (3.5/4.x) — Databricks and other distributions may differ".
- **Inline version qualifiers:** AQE 3.2+; AQEShuffleRead rename in 3.2; REBALANCE 3.2+; WindowGroupLimit 3.5+; SHJ full outer 3.1+; DPP 3.0; runtime bloom filters 3.3 (on in 4.x source; hedged for 3.x minors); SPJ 3.3+ (off by default); ANSI note in the §2.4 pushdown checklist.

### Added
- **hb-meta and hb-lede** after the header.
- **hb-diagram:** Spark execution (§1), covering driver plan layers → DAG scheduler cut at Exchange → tasks per partition → shuffle write/read → AQE re-plan at boundaries. The shuffle, memory and Arrow text diagrams were also converted to hb-diagram.
- **New §2.5:** runtime pruning (DPP and runtime bloom-filter joins), one short paragraph each.
- **New §4.7:** what AQE can't do.
- **New §6.7:** storage-partitioned join, one short hedged paragraph.
- **hb-depth:**
  - "Why does one Spark task take 20× longer than the others?" (§7, quality-gate item)
  - "Broadcast hash join vs sort-merge join — how does Spark pick?" (§6.2)
- **hb-attack:**
  - "set shuffle partitions to 2000" (§4)
  - "I'd just salt the key" (§7)
- **hb-drill:** "Spark 4 upgrade: job now fails with a cast error" (ANSI, §17). I chose it over the Monday-OOM drill because Part 08 already has that incident, so I cross-linked to it instead.
- **L5 Interview Card** `p04-l5-card`, with all 11 sections. Central question: "Walk me through what Spark does with your query, and where it goes wrong at scale."

### Code labels
28 labelled blocks:
- **Yes (16):** PySpark cb1, cb2, cb5, cb12, cb17, cb19, cb20, cb21, cb29, cb30, cb31, cb35; Spark SQL cb8; and three Spark-config blocks.
- **Illustrative — adapt to your dialect (9):** Scala cb4, cb22, Java cb24, cb27, cb28, cb32 (`load_model_once` is a placeholder), and three EXPLAIN-output blocks.
- **Pseudocode (3):** coalesce, skew detection, join decision tree.

Code fixed:
- **cb21:** `F.sum`, import added, deterministic salt.
- **cb20:** deterministic salt; unused imports removed.
- **cb32:** numpy and Iterator imports, `np.log1p`, `pd.Series` return, per-task comment.
- **cb1:** comment.
- **cb28:** comment.

Pandoc line ids are preserved. New lines got new ids: `p04-cb21-0`, `p04-cb32-4b`, `p04-cb32-4c`.

### Left alone / needs external verification
- **Runtime bloom filter default for a given 3.x minor.** Source shows `true` in branch-4.0 (config version 3.3.0), so the text is hedged.
- **4.2 Arrow-optimized Python UDF default.** Taken from `versions.md` (release-notes summary) and hedged "check current docs".
- **Spark Connect details:** `spark.api.mode` and the "GA in 4.0" wording come from `versions.md` and the audit.
- **LinkedIn push-shuffle gains.** Kept qualitative.
- **Photon "2–3×".** Kept as vendor-reported.
- **Illustrative plan shapes.** The WindowGroupLimit Partial-before-Exchange shape in the §12 plan is labelled illustrative. Confirm it against a real 3.5+/4.x `EXPLAIN` if exact node text matters.
- **Starting-point rules of thumb:** "20–30% overhead for Pandas-UDF jobs" and "100–200 MB per partition" are kept but framed as starting points, not constants.

## Part 05



Built from `p05build/` (template + build.py, which re-inserts untouched pandoc code blocks verbatim and re-renders rewritten ones with their original `p05-cbN` / `p05-cbN-k` ids). Original backed up at `SCRATCH/part-05.orig.html`.

### Claims corrected
- §1 "Driving table = the biggest one" → build/probe framing; "driving" = selective outer input (OLTP) vs fact table (star schema). Medium. Engine-neutral.
- §2 Logical order lacked WINDOW/QUALIFY → added both (QUALIFY: Snowflake, BigQuery, Databricks, DuckDB; not Postgres; OSS Spark 3.x no — "check current docs" for 4.x). Alias-in-WHERE line now names dialects (Snowflake/DuckDB allow; Postgres/BigQuery don't; Spark 3.4+ lateral alias in SELECT only). High.
- §3 Postgres plan: "Right input … (partitioned index)" → outer/probe = pruned fact scan, Hash (build) on dim_user; marked as paraphrase. BigQuery dry run → bytes *processed*. Medium.
- §4 table: "Zone Map Join" row → "Runtime filter / dynamic pruning (not a join algorithm)". SMJ memory O(1) → O(largest duplicate-key run). SMJ precondition "both sorted" → sortable keys. 4.3: Z-ORDER / Snowflake clustering give no sort guarantee; only clustered index / bucketing / SPJ (3.3+) skip the sort. Hash-join 10M rows 1–2 GB → 0.5–2 GB. High/Medium.
- §5.3 DuckDB listed as bitmap-index engine → Oracle persistent; Postgres runtime bitmaps; columnar = dictionary + zone maps. High.
- §5.5 layout fix list adds Delta liquid clustering. 5.6 "10–100× speedup" (unsourced) → qualitative. 5.7 adds runtime/dynamic pruning.
- §6.2 `SEMI JOIN (SELECT DISTINCT …)` → `LEFT SEMI JOIN` labelled Spark/Databricks; DuckDB `SEMI JOIN`; Postgres/Snowflake/BigQuery have no syntax. DISTINCT removed. High.
- §6 added COUNT bug (0 vs NULL on decorrelation) and Spark null-aware anti join note.
- §7.1 GROUPS: Postgres 11+/SQLite/DuckDB only — not Spark/Snowflake/BigQuery. High.
- §7.3 never said what the trap was → ties example (RANGE sums peers) with ROWS + tiebreaker fix. High.
- §7.4 unnamed Spark rule → Spark 3.5+ `WindowGroupLimit` (threshold `spark.sql.optimizer.windowGroupLimitThreshold`=1000, verified by audit). High.
- §7.6 LAST_VALUE wording "default is current row" → "frame ends at current row and its peers". Medium.
- §9 title "without windows (Flink-style)" (it uses windows) → "Sessionization with LAG + running SUM" (id kept). "Exact pattern Flink implements" → batch equivalent; Flink merges windows in state. Added midnight-boundary bug. Medium/High.
- §10.1 "Spark uses BNLJ" → SMJ/BHJ on user_id + post-join range filter; BNLJ only for pure range joins; Databricks `RANGE_JOIN` hint. High. Added half-open interval / far-future valid_to note.
- §10.3 empty "Spark-native AS OF" stub (cb24) → working Spark SQL union + `last(plan_name, true)` fill-forward with `is_fact` tiebreak for >= semantics. `pyspark.pandas.merge_asof` NOT mentioned (not confident). High.
- §10 added Snowflake `ASOF JOIN … MATCH_CONDITION`. Removed unsourced "Uber's Michelangelo". High.
- §11 (merged with §16): Theta "supported in Snowflake" → no native Theta in Snowflake/BigQuery (check docs); Druid/DataSketches. Error-rate contradiction (§11 0.8% vs §16 "~2%") resolved: 1.04/√m, 0.8% at 2^14; Spark default rsd 5%. "APPROX_COUNT_DISTINCT is mergeable" → it returns a number; merge sketches (Snowflake HLL_ACCUMULATE/COMBINE, BigQuery HLL_COUNT.INIT/MERGE, Spark 3.5+ hll_sketch_agg/hll_union_agg, Trino approx_set/merge). "100× for 1% error" and "99% accuracy for 0.01% of the cost" removed. Quantile function names per engine (Spark percentile_approx is GK-family, not t-digest). High.
- §12.2 implicit-cast example was backwards → the harmful case is the column side being cast (VARCHAR column vs numeric literal); Spark 4.0 ANSI can make it fail. High.
- §12.5 OR-join rewrite used UNION (drops legit duplicates) and `a.x <> b.x` (drops NULL rows) → UNION ALL + `WHERE NOT COALESCE(a.x = b.x, FALSE)`. NOTE: the audit's suggested `IS DISTINCT FROM` is itself wrong when both x are NULL (pair never matched in branch 1 but would be excluded); used the exact "not matched" predicate and explained why. High.
- §12.8 "Bad: N × M" → bad only if the optimizer can't decorrelate; COALESCE comment names COUNT bug. Medium.
- §13 codec line: Spark 4.0 defaults Parquet snappy, ORC zstd (audit-verified).
- §15→14 CTE table: Snowflake "Inlined always" → optimizer decides; multi-ref CTE can be computed once (WithClause/WithReference) — Medium, VERIFY. BigQuery → non-recursive CTEs executed once per reference. Spark → inlined, ReusedExchange dedupes identical shuffle subtrees. Removed invalid identifier `10B_row_fact`.
- §17→15 MVs: Snowflake MVs single-table/no joins vs Dynamic Tables (GA 2024); BigQuery joins with restrictions (check docs); Databricks MVs via Lakeflow Spark Declarative Pipelines (name per versions.md).
- §18→16 hints: Snowflake "hints" are session params/DDL, not hints. BigQuery invented hint list (`@@optimizer_mode`, `JOIN HASH`, `GROUP BY ROLLUP`) removed → essentially no user-facing hints (check docs). Spark `SKEW(...)` → Databricks-only; full OSS join-hint list with precedence and partition hints (COALESCE, REPARTITION, REPARTITION_BY_RANGE, REBALANCE 3.2+). High.
- §19→17 window table: top-N with ties DENSE_RANK → `RANK() <= N` / `FETCH FIRST … WITH TIES` (PG13+/Oracle). 7-day ROWS/RANGE contradiction → RANGE INTERVAL for calendar days (BigQuery: RANGE over UNIX_DATE), ROWS as the wrong pick. NTILE removed as percentile answer (splits ties) → PERCENT_RANK/CUME_DIST. Cumulative distinct: HLL windowed merge → exact first-seen flag + running SUM. Frame-trap paragraph wrongly including FIRST_VALUE removed. High.

### Compressed
- Removed local Contents h2 + list (kept `<span id="p05-contents"></span>`); removed unattributed opening blockquote + intro paragraph (replaced by hb-lede).
- Merged §16 Approximate Aggregations into §11 (anchor `p05-16-approximate-aggregations` kept at §11). ~230 words removed.
- Merged §12.7 CTE fence into §14 CTE (anchor `p05-127-massive-ctes-that-dont-inline` kept at §14).
- LAST_VALUE frame trap ×3 → once (§7.6); §7.3 now explains RANGE ties instead; §17 row links to 7.6; §19 "frame-clause trap" h3 + pre removed.
- §4 join table cut from 6 columns to 4; §3.1 "common elements" list → one line; §13.2 triage pre folded into the hb-depth; §13 workflow shortened; §8/§9/§10/§11/§15/§16 prose tightened; dropped trivial window-table rows (LEAD duplicate, `LAG(col, N)` vs nested LAG).
- Prose outside new components: 3,907 → 3,371 words (−13.7%). Code words 1,289 → 1,467 (corrected/added runnable examples). Non-component total 5,196 → 4,838 (−6.9%).
- h2 text renumbered 15/17/18/19 → 14/15/16/17 (ids unchanged).

### Version notes added
- §2.1: "The same SQL is not the same query across engines" (NULL ordering, integer division, QUALIFY availability, Spark 4.0 ANSI default + try_cast/try_divide, DATEDIFF argument order).
- §14: CTE fence was Postgres ≤11 only; changed in PG12 (2019).
- Inline version qualifiers: Spark 3.5+ WindowGroupLimit, Spark 3.4+ lateral alias, Spark 3.3+ SPJ, DPP 3.0+, REBALANCE 3.2+, hll_sketch_agg 3.5+, PG 11+ INCLUDE/GROUPS, PG 13+ WITH TIES, Spark 4.0 codec defaults.

### Added
- hb-meta + hb-lede after header.
- hb-diagram: logical order (§2), Postgres plan paraphrase (§3) — both converted from `<pre>`.
- hb-attack: "I'd add an index" → columnar warehouse (§5.5); "add DISTINCT" → fan-out root cause (§12.4).
- hb-depth: "Explain window frames: ROWS vs RANGE" (§7.6); "How do you tune a slow query?" (§13.2).
- hb-drill: "Fix this broken SQL" — LEFT JOIN turned inner by a WHERE on the right table, with NOT IN sibling (§12); "Inspect this EXPLAIN plan" — Spark plan with `PartitionFilters: []` + SMJ that should be broadcast / AQE isFinalPlan=false (§13). Pointer to Part 19 for the 20s→11min drill.
- hb-failure: correct-looking-SQL failures (§12).
- New content: COUNT bug, null-aware anti join, QUALIFY, FETCH WITH TIES, IS DISTINCT FROM pitfall, Spark 4 ANSI, Snowflake ASOF JOIN, Spark as-of pattern, midnight sessionization bug.
- L5 Interview Card `p05-l5-card` at end; central question "How does a SQL engine execute your query, and how do you make it fast and correct?"
- Cross-links: #p04-joins, #p04-skew, #p04-aqe, #p04-2-…, #p03-session-window, #p07-6-merge-…, #p09-4-the-sql-question-bank-senior-tier, #part-19.
- h3 ids added to all 13 formerly id-less h3s (p05-15-*, p05-17-*, p05-18-*).

### Code labels
- 32 labelled blocks: Yes 18 plain + 9 "Yes — <engine> only/qualified" (incl. "Yes (and wrong)" drill input) ; Illustrative 4 (3 "adapt to your dialect", 1 plan output); Pseudocode 2.
- Rewritten: cb10 (LEFT SEMI JOIN), cb15 (ties demo), cb24 (was empty; Spark SQL fill-forward), cb26 (Snowflake HLL sketch store/merge + other engines), cb29 (implicit cast), cb30 (OR-join), cb31 (comments), §14 CTE block. All original ids (incl. line anchors) preserved.
- 2 text diagrams converted to hb-diagram; 1 tiny `<pre>` inside the L5 card (diagram, not code).

### Left alone / needs external verification
- Snowflake default window frame when ORDER BY is given without a frame (label on 7.3 tells readers to check).
- Snowflake CTE reuse (WithClause/WithReference) semantics.
- BigQuery incremental MV join support details; absence of BigQuery optimizer hints and native Theta.
- QUALIFY in OSS Spark 4.x (stated as "check current docs").
- Spark RANGE frame with INTERVAL on DATE order keys (stated "check version").
- `pyspark.pandas.merge_asof` deliberately not mentioned.
- Parquet bloom writer option and Iceberg property name kept from original (not re-verified).

## Part 06



Word count (tags stripped): **4472 → 5231 total**. The original material dropped to **2986 words (−33%)**. The **2245 words of new material** are the hb-meta, lede, 7 notes, 2 depth, 2 attack, 1 drill, 2 diagrams, code labels and the L5 card.
Verified locally in a scratch venv (Python 3.13, pandas 3.0.6, Polars 1.44.2, DuckDB 1.5.5, Pydantic 2.13, Hypothesis 6.168). Ran: the pandas CoW snippet, the Polars lazy + `engine="streaming"` snippet, the DuckDB↔Polars handoff, the generator + `itertools.batched` pipeline, the asyncio TaskGroup/Semaphore/retry code (with a fake client; peak in-flight = 20), the shared-memory pool, the frozen-dataclass trap, the Pydantic model + TypeAdapter, and the Hypothesis property. The property fails as written (falsified); the `.rstrip()` fix passes 20,000 examples.

### Claims corrected
| Before | After | Why | Conf | Engine/version |
|---|---|---|---|---|
| 3.13 `--disable-gil` build, "~10–30% overhead", "assume the GIL; free-threading on the horizon" | 3.13t experimental; 3.14t officially supported but optional (PEP 779), ~5–10% single-thread cost per the 3.14 docs; an unsafe C extension re-enables the GIL (`sys._is_gil_enabled()`); not the default in 3.14/3.15; subinterpreters mentioned | Out of date | High | CPython 3.13/3.14 |
| "The merge is in C. It releases the GIL for the duration… pandas + threads can scale" | pandas releases the GIL only in some Cython kernels; merge/groupby largely hold it; modest thread scaling | Overstated | Medium (agreed) | pandas |
| "header (~16 bytes) + type pointer + refcount"; str 53 B; list 88 B; "2 GB vs 80 MB" | 16-byte header = refcount + type pointer; ~30–60 B/value for object columns vs payload + 4–8 B offsets; 10M strings ≈ 0.6 GB vs ~100 MB. Micro-numbers (int/str/list sizes) cut per brief | Wrong/stale numbers | High | CPython 64-bit |
| "Three generations (0,1,2)", `set_threshold(700,10,10)` | Three generations through 3.13 (defaults changed); 3.14 incremental GC with young/old generations; re-check tuning | Stale for 3.14 | High | CPython 3.13/3.14 |
| py-spy "(USDT-style)… Critical for Spark driver issues" | Reads target memory from outside the process; sees Python frames only (PySpark Python driver/workers); JVM needs jstack/async-profiler/Spark UI | Wrong | High | — |
| `__dict__` "(~~250 bytes)" artefact | "lazily materialized since 3.11" | Artefact + stale | High | CPython 3.11+ |
| "if it fits in RAM, Polars wins. If it doesn't, PySpark wins." | Fits one machine *including out-of-core* (Polars streaming, DuckDB spill) → single-node; Spark when data/concurrency/SLA exceed a node | Contradicted the page | High | — |
| "might be a view, might be a copy — depends on memory layout" | Boolean mask always a new object; chained assignment never writes through (pandas 3) | Wrong | High | pandas 3.0 |
| "Pandas 2.0 introduced CoW mode… turn it on" + perf-checklist `set_option` | pandas 3.0 makes CoW mandatory (the option is a deprecated no-op); Arrow-backed `str` default | Stale | High | pandas 3.0 |
| Polars `pl.col("event_date") == "2026-04-15"` | `== pl.date(2026, 4, 15)` (the string compare raises `InvalidOperationError`) | Broken code | High | Polars 1.44 verified |
| `collect(streaming=True)` | `collect(engine="streaming")` (deprecated in 1.25) | Deprecated API | High | Polars 1.25+ |
| "Iceberg, Parquet (file formats are Arrow-compatible)" | Parquet/ORC readers *decode* into Arrow (not zero-copy); PyIceberg/delta-rs return Arrow | Misleading | High | — |
| `.pl()` "zero copy back" | Result materialized once as Arrow; the *input* scan of a Polars frame is the zero-copy side | Inaccurate | Medium (agreed) | DuckDB 1.x |
| "10 GB DataFrame Pandas → DuckDB → Spark via Arrow costs zero CPU" | Zero-copy in-process only; into Spark's JVM is Arrow IPC (a byte copy, no per-cell objects) | False | High | — |
| Hand-rolled `batched` | `itertools.batched` (3.12+; `strict=` in 3.13); recipe noted as pre-3.12 | Version | High | CPython 3.12+ |
| Linux default start method `fork` | `fork` through 3.13, `forkserver` from 3.14; 3.12+ warns on fork with threads | Version | High | CPython 3.14 |
| `frozen=True` "makes it hashable + immutable" (with a `dict` field) | Shallow; `hash()` raises TypeError (shown in code and verified) | Wrong | High | stdlib |
| `datetime.utcnow()` in validator; `PlaybackEvent(**raw)` | `datetime.now(timezone.utc)`, `AwareDatetime`, `model_validate`, `TypeAdapter(list[…])` for batches | Deprecated/naive; raises vs aware | High | Pydantic 2.x, CPython 3.12+ |
| Hypothesis test presented as passing | Presented as failing on purpose (it finds a real bug); `.rstrip()` fix given | Test fails (verified) | High | Hypothesis 6.x |
| dbt `tests:` | `data_tests:` (dbt ≥1.8) | Renamed key | High | dbt 1.8+ |
| "Three approaches" listing 4 (items 3/4 duplicate); `.egg` | Three approaches; `.zip`/`.whl`; plus Spark Connect `addArtifacts` | Wrong count, obsolete | High | — |
| `pyspark==3.5.1` runtime dep; `pyarrow>=15`, `pandas>=2.2`, `>=3.11`, no build-system | pyspark `>=4.0,<5` moved to the dev extra ("the cluster provides pyspark"); `[build-system]` added; `requires-python >=3.12` | Stale / bad practice | Medium (agreed) | Spark 4.x |
| `spark.pyspark.driver.python=./environment/bin/python` | Removed; `--deploy-mode cluster` + a comment that `./environment` exists only on executors in client mode | Wrong in client mode | Medium (agreed) | Spark docs |
| Airflow 2 imports | Airflow 3: `airflow.sdk.DAG`, `airflow.providers.standard.operators.python`; Airflow 2 paths noted in the label | Version | Medium (agreed) | Airflow 3.x |
| "SnapStart on Java; Python equivalents are limited" | SnapStart covers Python 3.12+; snapshot-state caveats; 250 MB / 10 GB limits flagged "at time of writing — check docs" | False | High | AWS Lambda |
| asyncio "dramatically faster than threads and infinitely cheaper", "~1 KB vs ~1 MB per thread" | Scales to thousands more cheaply; ~1–2 KB vs a multi-MB reserved virtual stack (8 MB default on Linux); threads comparable below a few hundred connections | Hyperbole | High/Medium | — |
| "# asyncio: ~80ms total" | Pages within a prefix are sequential; total ≈ slowest prefix's pages × latency | Wrong | High | — |
| aioboto3 example: client per task, no semaphore | Stated as the tempting-but-wrong version; fix described (one shared client, semaphore) | Contradicted its own pitfall list | High | — |
| pip "resolution weak; no lockfile" | Real resolver; no native lock workflow (pip-tools / experimental `pip lock` → PEP 751 `pylock.toml`) | Stale | Medium (agreed) | pip 25.x |
| uv "still maturing… drop-in for Poetry" | Common default for new projects; migrating from Poetry is a migration, not a drop-in | Stale | Medium (agreed) | uv |
| Dockerfile: `uv sync --frozen` before `src/`; CMD uses system python; `src.main` | `--no-install-project` deps layer → copy src → `uv sync`; `ENV PATH=/app/.venv/bin:$PATH`; `-m my_pipeline.main` | Broken | High | uv |
| shared memory: no `close()`/`unlink()` | Close/unlink discipline described (code block cut; see Compressed) | Leak | High | stdlib |

### Compressed
Original material went from 4472 to 2986 words (−33%, ~1490 words removed).
- **Merged §15 → §7 (asyncio).** Kept the mental model with corrected numbers, the pitfalls (in 7.2/7.3/7.5) and the S3-inventory lesson as corrected prose. Dropped the aioboto3 code block (~130 words); the TaskGroup/Semaphore/retry block covers the pattern. The id `p06-15-asyncio-for-io-bound-pipelines` is kept as a span at the top of §7.
- **Merged §16 → §4 (DuckDB column in the comparison table) and §5.3** (composition example, with the Polars→DuckDB in-place scan added). "Zero-copy trinity" marketing prose dropped. The id `p06-16-…` is kept at §5.3.
- **Merged §17 → §9.3** as a "three levels of contract" table (dataclass/attrs → Pydantic → schema registry, cross-linked to Part 15). §17's duplicate dataclass/Order code dropped. The id `p06-17-…` is kept at the top of §9.
- **Merged §18 → §11.1** as one tooling paragraph plus the fixed Dockerfile. The id `p06-18-packaging-pip-poetry-uv` is kept at the top of §11 (the inbound link from Part 00 still resolves).
- Removed the local Contents h2 + ol (kept `<span id="p06-contents"></span>`). The `p06-exec`/`p06-gil`/… anchors are kept.
- Moved the Closing principle to the end (h2 "13."), before the L5 card.
- Cut the `dis` bytecode block, the switch-interval and `time.sleep` code blocks, the refcount/`gc` code, the `__slots__` code, object micro-sizes, the pandas `dtype_backend` block, the itertools demo, the async-generator block, `run_in_executor`/sync-vs-async blocks, the ProcessPool block, the shared-memory block (turned into prose), the mypy bash block, and four separate profiler blocks (merged into one). Also cut the project-structure tree viz (one line now), the separate §2.1/§2.2/§2.3 h3s (merged; ids kept as spans), and the Hypothesis h3 (merged into §10.2; id kept).
- Speed-math bullets are one sentence. The 10-row comparison table is down to 6 rows with 4 engines.
- The garbled testing-pyramid tree viz and the broken "Spark JVM  serialize" / "&gt; Python" viz are replaced by hb-diagrams.
- Pandoc per-line code anchors (`p06-cbN-M`, 298 ids) were dropped with the rewritten blocks. No href anywhere in parts/frag targets them (checked). Every block-level `p06-cbN` id is kept as a span.

### Version notes added (hb-note "2026 Interview Note")
1. §1: the 3.11 specializing interpreter and the 3.13 experimental JIT versus the timeless "loops are slow" point.
2. §2.2: free-threaded 3.13t → 3.14t (PEP 779), the extension gate, `cp314t` wheels, not default in 3.14/3.15, subinterpreters.
3. §3.1: GC three generations through 3.13 → incremental young/old in 3.14; re-check tuning.
4. §4.3: pandas 3.0 mandatory CoW + Arrow-backed `str` default; the pandas <3 caveat.
5. §4.4: Polars `streaming=True` → `engine="streaming"` (1.25).
6. §8.3: multiprocessing default `fork` → `forkserver` in 3.14 on Linux; 3.12+ fork-with-threads warning.
7. (Version facts are also inline in labels and text: `itertools.batched` 3.12, `TaskGroup`/`asyncio.timeout` 3.11, `assertDataFrameEqual` Spark 3.5, dbt `data_tests` 1.8, Airflow 3 imports, SnapStart Python 3.12+.)

### Added
- hb-meta + hb-lede (chapter head).
- hb-depth "Does the GIL matter for data engineering?" — §2.
- hb-depth "When would you use Polars/DuckDB instead of Spark?" — §4.
- hb-attack "I'd use multiprocessing to speed up this S3 download" (it's I/O-bound) — §2.
- hb-attack "pandas is fine, it's only 40 GB" — §4.
- hb-drill "memory grows until OOM-killed after ~6 hours": accumulation, generators, pandas concat copies, leaked references, retry buffering, fragmentation. In §3.
- hb-diagram: testing pyramid (fixed) — §10.1. hb-diagram: Arrow zero-copy vs IPC — §5.1.
- L5 Interview Card `p06-l5-card` at the end. Central question: "How do you write Python data pipelines that are correct, testable, and fast enough?" "Must be able to code" lists the three problems from the brief.
- New content: TaskGroup + Semaphore + jittered-backoff retry code; `TypeAdapter` batch validation; `pyspark.testing.assertDataFrameEqual`; the fork+threads deadlock explanation; Spark Connect `addArtifacts`.
- Cross-links: `#p04-pandas-udf`, `#p04-12-pandas-udfs-arrow-and-the-jvmpython-boundary`, `#p12-5-testing`, `#part-15`, internal `#p06-12…` / `#p06-3…`. All resolve.

### Code labels
17 code blocks, all labelled (plus 2 hb-diagrams and 1 tiny pre in the card, which are not code).
- **Yes** (unqualified or with a stated precondition): 14. They are tracemalloc, pandas CoW, Polars lazy (S3 creds or a local path), generator+batched, asyncio retry, dataclass trap, Pydantic, pytest+Hypothesis (fails on purpose), PySpark test, dbt YAML (≥1.8), pyproject, Dockerfile, spark-submit (cluster mode), profilers bash.
- **Yes — Airflow 3.x only**: 1 (Airflow DAG).
- **Illustrative**: 2 (concurrent.futures with user functions; DuckDB-on-S3 composition needing creds/`regions`).
- Code fixed: Polars date filter + streaming API; pandas CoW semantics; `batched`; dataclass (trap made explicit); Pydantic (`AwareDatetime`, `now(timezone.utc)`, `model_validate`, `TypeAdapter`); Hypothesis (fails + fix); dbt `data_tests`; pyproject; spark-submit; Airflow 3 imports; Dockerfile uv order + `.venv` PATH.

### Left alone / needs external verification
- The exact 3.14 GC threshold semantics are stated only as "changed; re-check". The 3.13 default of 2000 was dropped rather than asserted.
- Free-threaded wheel coverage (NumPy/PyArrow/Polars `cp314t`) is not asserted per package; the text says "check every native dependency".
- The Lambda limits (250 MB unzipped zip incl. layers, 10 GB image) are carried from the audit and flagged "at time of writing — check current docs".
- Airflow 3 import paths (`airflow.sdk`, `airflow.providers.standard.operators.python`) come from the audit (marked "Y (verify)"). They weren't run locally; the Airflow 2 equivalents are in the label.
- `pip lock` is stated as experimental (pip 25.1+ per the audit); not re-verified.
- The aioboto3 paginator API was not run (no AWS); only prose remains.
- The Dockerfile, spark-submit and PySpark test were not executed here (no Docker/Spark in the sandbox). The uv flags `--frozen --no-dev --no-install-project` match the uv docs pattern.

## Part 07



### Claims corrected
- Iceberg `format-version (2 in modern usage)` → v2 safe default; v3 (DVs, variant, row lineage, defaults) available in Iceberg 1.10+, check every reader. High. Iceberg 1.10/1.11.
- "This is why Iceberg dominates" → Delta does the same file skipping with log stats; Iceberg's extra lever is manifest-level pruning. Medium.
- "On Nessie / Polaris / Unity: branch-aware semantics" → per-catalog CAS (HMS lock, Glue version, JDBC conditional UPDATE, REST server-side CAS via `assert-ref-snapshot-id`); Hadoop catalog unsafe on S3. High.
- Delta "DynamoDB no longer required" → engine-dependent: delta-rs 1.0+ uses S3 conditional put; delta-spark has documented S3DynamoDBLogStore for multi-cluster S3. Medium (VERIFY).
- "Both achieve serializable" → readers get SI; Iceberg row-level ops default `serializable` (configurable to `snapshot`); Delta defaults to WriteSerializable. High.
- "Both INSERT into same partition conflict" → blind appends never conflict; conflict matrix added (append/MERGE depends on isolation level; MERGE/MERGE overlap conflicts; compaction vs streaming MERGE). High.
- `truncate` ints "mod N" → `v - (v % W)`. High.
- `SET PARTITION SPEC (days(...))` (invalid) → `REPLACE PARTITION FIELD days(event_ts) WITH hours(event_ts)`; example now consistent with the CREATE (days → hours). High.
- MOR "write amplification 1×" → still scans to find matches; near-1× bytes, rewrite deferred to compaction. High.
- GDPR row "MOR good" → logical delete; erasure needs rewrite + expire_snapshots (Delta REORG PURGE + VACUUM); hb-note added. High.
- Multi-match "undefined and will throw" → SQL standard requires an error; Spark raises. Medium.
- Sort compaction "sorts within each output file" → range-sorts across the file group, non-overlapping file ranges. High.
- Z-order math `N^(1/N)` → F files, N cols: ~F^(-1/N) of files per single-column filter (F=10k: N=2 ~1%, N=4 ~10%). High.
- Rollback "atomic pointer swap" for both → Iceberg pointer move; Delta RESTORE writes a new commit. High.
- Retention "long = huge cost" → only churned files cost; Delta defaults (log 30d, deleted files 7d) added with "at time of writing". High.
- Schema: add column "default value" → NULL in v2; defaults are v3 (`initial-default`/`write-default`). High.
- Name mapping backwards → `schema.name-mapping.default` for files without field IDs (migrate/add_files). High.
- Delta column mapping "protocol ≥2" → reader v2 / writer v5; type widening GA in 4.0. High.
- Matrix: Iceberg branches "with Nessie/Polaris/V3" → table refs since 1.2, any catalog. High.
- Matrix: Delta "Trino (read)" → Trino reads/writes incl. MERGE. High.
- Matrix: Iceberg "compact-on-write" → none in OSS; Flink equality deletes + scheduled compaction. High.
- Matrix: "COW (v1) or MOR (v2)" → COW or MOR per operation; row-level deletes need v2+; v3 DVs. High.
- Matrix: Delta DVs "since 3.0" → staged: DELETE 2.4, UPDATE/MERGE through 3.x. Medium (hedged).
- Glue "multi-region", "no branches" → regional; Iceberg branches work (in metadata); REST endpoint. High.
- Polaris "still early" → Apache TLP since Feb 2026; managed as Snowflake Open Catalog. High.
- "REST backed by … Polaris" → Polaris is a REST implementation. High.
- "Enable Iceberg's auto-compaction (write-side)" → no OSS Iceberg write-side compaction; managed services or Delta optimizeWrite/autoCompact. High.
- Orphan-file risk "in-flight reader" / "snapshot about to expire" → uncommitted in-flight writers + s3/s3a scheme mismatch; dry run, equal_schemes, prefix_mismatch_mode. High.
- "REST catalog with retry-with-backoff" → client `commit.retry.*`, any catalog; shrink conflict surface first. Medium.
- Cross-region CRR → metadata has absolute paths; `rewrite_table_path` (1.8+, hedged) or MRAPs; register in DR catalog. High.
- "who, when, what changed" → Iceberg has no user identity; Delta commitInfo can carry user; use catalog audit log. Medium.
- COW "entire partition rewritten" → touched files; whole partition only when scattered; clustering on merge key. High.
- Delete files "updated to X" → update = delete + new row in a new data file. High.
- "Bin-pack doesn't touch overlays" → absorbs deletes only for files it rewrites. High.
- Multi-table: staging "atomic rename of catalog entries" (doesn't exist in HMS/Glue) removed; dim/fact contradiction fixed (dims first; inferred members when facts land first); "Iceberg v1.4+ Transactions API; REST does; Glue doesn't" → REST spec multi-table commit endpoint via Java API, no Spark SQL syntax, server support varies. High/Medium.

### Compressed
- Removed local Contents h2 + 13-item list (kept `<span id="p07-contents"></span>`) and the redundant intro paragraph (replaced by hb-lede).
- Merged §16 feature matrix into §11 (one corrected matrix + decision heuristic as §11.1); id `p07-16-…` kept as span.
- Merged §17 catalogs into §12: one REST-spec subsection + one implementations table (HMS, Glue, S3 Tables, Polaris, Unity, Nessie, others) + migration trap; ids `p07-17-…`, `p07-121`…`p07-125` kept as spans.
- Folded §18 write amplification into §6.1 (quantification) and §7.6 (delete-ratio rule); id kept as span at §6.1.
- §5 and §13.1 cross-link Part 02 (hidden partitioning; small files) instead of re-explaining; 20K→8M incident linked to Part 19.
- Tightened every section's prose (lists collapsed, repeated explanations removed). Non-component prose ~4,600 → ~4,550 words despite added corrections, 2 new code blocks and 20 code labels; ~1,400 words of original/duplicated prose removed net.

### Version notes added
- One consolidated "what's version-specific in this chapter" hb-note table after §1 (row-level deletes/DVs, Iceberg v3 extras, catalog-managed Delta commits, liquid clustering GA 3.2, UniForm + IcebergCompatV3 experimental, REST/Polaris TLP/OSS Unity/S3 Tables), with current releases from versions.md (Iceberg 1.11/1.10, Delta 4.4, 3.3.x patched).
- §6: "deletion is not erasure" note. §7: procedure-call qualification (catalog prefix; Trino ALTER TABLE EXECUTE; managed services).

### Added
- hb-meta + hb-lede (chapter head).
- hb-diagram: lakehouse commit model (Iceberg CAS vs Delta put-if-absent) in §2.3. Existing viz-tree kept as the metadata-hierarchy diagram (updated: REST catalogs, `00042-<uuid>` names, refs, delete files/DVs) — not duplicated.
- hb-diagram: two delete-file layouts in §10 converted from bare `<pre>` to figures.
- hb-depth: "Walk me through an Iceberg commit end-to-end" (§2.3); "Copy-on-write vs merge-on-read — which and when?" (§6.4).
- hb-attack: "Iceberg gives us ACID so concurrent MERGEs are fine" (§4.2); "Delta + UniForm so Trino can write as Iceberg" (§11.1).
- hb-drill: "Reads 10× slower after switching to MOR" (§6); "FileNotFoundException after orphan cleanup removed a backfill's pre-commit files" (§13.2).
- hb-failure: lakehouse commits/maintenance (conflict/retry storm, partial write, commit-state-unknown, orphan cleanup, snapshot expiry, catalog unavailable, compaction racing writes) at end of §13.
- New content: §4.2 conflict matrix; §7.3 Iceberg zorder + Delta liquid clustering; §8 WAP/branches + Delta defaults; §10 v3 DVs; §12.1 REST spec; §14 rewritten (order, WAP, publish marker, catalog-level atomicity).
- L5 Interview Card `p07-l5-card` (central question: "Why do open table formats exist and what do they cost you?"). Closing principle moved to the end, before the card.

### Code labels
- 20 labelled blocks: Yes 12; Yes — qualified 5 (Iceberg extensions; decimal scale; not on liquid-clustered tables; Delta 3.2+ liquid-clustered; orphan params vary by version); Illustrative 2 (Hive trap, CREATE with `...`); Pseudocode 1 (Delta JSON log).
- Fixed: cb7 invalid `SET PARTITION SPEC` → `REPLACE PARTITION FIELD`; cb6 `events` → `silver.events`; cb15 orphan comment now states default `older_than` and the in-flight-writer constraint. New: Iceberg zorder/liquid clustering block; safe orphan-cleanup dry-run block.
- Text layouts (2 delete-file examples) converted to hb-diagram figures, not labelled.

### Left alone / needs external verification
- Exact Iceberg release where v3 became "GA"/write-default (versions.md: UNVERIFIED) — hedged as "available in 1.10+, check every reader".
- Delta DV per-operation version history (DELETE 2.4, UPDATE 3.0, MERGE 3.1) — hedged as "through 3.x".
- delta-spark S3 multi-cluster commit (S3DynamoDBLogStore still needed?) — hedged, "check your version".
- `rewrite_table_path` introduction version (1.8) and REST server-side scan planning — hedged.
- S3 Tables / Glue REST endpoint capabilities — framed as AWS product, "check features per region".
- Delta OSS availability of optimizeWrite/autoCompact by version — hedged.
- viz-tree structure (flat top-level nodes) kept as-is apart from text updates.

## Part 08



### Claims corrected
- Title "Interview Q&A — Real Scenarios" → "Interview Scenarios — Incidents, Designs, Internals, Judgment". Policy. High.
- Intro "drawn from real Senior / L5 loops — Netflix, Stripe, Airbnb, Pinterest, Uber, Meta, DoorDash … something a real engineer faced" → the lede calls them representative composites of common production incidents and design prompts, not attributed to any company. There is also a note that level labels vary by company. Policy. High.
- Q3 lag: "rebalance, salt, or rebalance" → salt the hot key or change the partitioner. The partition-increase bullet now notes the key→partition remap that breaks per-key ordering. Consumers must be ≤ partitions. High.
- Q4 Iceberg: `partition_event_date` → `partition.event_date` (files metadata table, partition struct). High. "enable async compaction at write time" → scheduled `rewrite_data_files` / table-maintenance service, and Iceberg has no write-time auto-compaction (Delta auto-compact is the exception). Medium, agreed.
- Q5 Monday OOM: "raise broadcast threshold" removed as an OOM fix. "JVM OOM in Pandas UDF" → Python-worker OOM, which is a container kill, not heap. Added `spark.executor.pyspark.memory`. High.
- Q7 clickstream: invented "70/20/10" cost split → Kafka retention/replication math (1 GB/s × 3 × 7 d ≈ 1.8 PB). Added partition math (1 GB/s ÷ 100 = 10 MB/s per partition; size 2–3× for headroom, then benchmark). Medium.
- Q9: "streaming is fundamentally probabilistic" → a streaming result is provisional until the data is final. Medium.
- Q10 SCD2: ordering/dedup on `source_ts_ms` → source log position (LSN / binlog offset). Added a compaction ops step. Medium.
- Q12: "chapter 03, sections 7 and 14" → links to p03-7 and p03-16. High.
- Q13 AQE: "Dynamic Join Selection" mislabel → AQE re-planning governed by `spark.sql.adaptive.autoBroadcastJoinThreshold` (Spark 3.2+), with a local shuffle read. `DynamicJoinSelection` is now described correctly (it demotes broadcast or prefers SHJ). Added SHJ at plan time. Medium, agreed.
- Q14: push-based shuffle (Magnet) → YARN-only, Spark 3.2+. On K8s the alternative is a remote shuffle service. High.
- Q15: "indexed column" → "function wrapping the column; rewrite as a range". Medium.
- Q16: wrong ref "chapter 03, section 9" (Kafka) → Part 03 §8 link. High.
- Q17 Iceberg commit retry: "discard metadata, data files orphaned, retry from step 2" → refresh, re-validate, retry steps 4–6 reusing the written data files. Files are orphaned only if validation fails. High.
- Q18 watermark bonus: "multiple source subtasks share partitions" → each partition goes to exactly one subtask. Extra subtasks idle and can hold the min watermark back without `withIdleness`. Per-partition watermarks require the strategy on `fromSource`. High.
- Q20: wrong ref "chapter 01, section 11" (Medallion) → Part 01 §10 + §4 links. "Snowflake/BigQuery execution prefers it" → Snowflake handles star joins well, while BigQuery often favors denormalized or nested schemas. Reconciled with p09-7 (for consumption marts). Medium/High.
- Q24 GDPR: "MoR with deletion vectors" as a hard delete → logical only until files are rewritten AND snapshots are expired (Iceberg) or VACUUMed (Delta). Linked p10-1. High.
- Q25: "Sub-second is 10–100× more expensive" → "typically far more expensive: always-on compute, a serving store, on-call". Medium.
- Freshness SLO: error budget → "5% of measurement intervals, ≈ 8.4 h/week". Medium.
- Snowflake: "bad MERGE that didn't vacuum" → MERGE churn retained by Time Travel / Fail-safe, and Snowflake has no VACUUM. High.
- BigQuery: "flex slots with off-peak pricing" → Editions baseline + autoscaling and a separate off-hours batch reservation. Flex/flat-rate retired July 2023 (versions.md §8). High.
- Q34: added Snowflake/BigQuery managed Iceberg tables and the Delta/UniForm option. Medium (verify).
- Q36: added DuckDB. Replaced the "r6i.16xlarge 512 GB → Polars wins" constant with a softer heuristic plus other axes. Medium.
- Q37: table date-stamped "as of 2026". Dagster Cloud → Dagster+. Dropped Decodable (ownership changed; unverified). Medium.
- ML: "a surprising fraction of model issues are infra bugs" softened to "a common cause". "Shadow training" → "shadow scoring" (what the step actually describes).
- Closing: "L5 is judgment" → "At senior level, judgment is the product". "Use real numbers" → "concrete numbers, even hypothetical".
- NOT IN THIS FILE: Scenario C (deleting snapshot-referenced files) and Scenario D (fallback wording, 150 vs 100 ms timeout, invented regulation) live in Part 09 §5 (p09-5-system-design-transcripts). They are the Part 09 agent's to fix. Part 08 contains no "verbatim", "80% of rounds" or "bar raiser" text.

### Compressed
- Deleted the local Contents h2 + 7 h3 group lists (~400 words). `p08-contents` and all 7 group-h3 ids are kept as `<span>` anchors at the start of each group.
- Dedup, dashboard mismatch ×2 in-part: kept Q2 (incident) as the canonical one and folded in the enum/casing root cause and the row-count-floor system fix. "KPI shows zero" h3 → a 2-line cross-link (new id p08-kpi-shows-zero). Q2 links Part 09 §5 Scenario B.
- Dedup, feature store ×2 in-part: kept Q7b as canonical and merged in Pattern A/B + anti-pattern from the ML section. The ML h3 is now a cross-link (id p08-feature-store-parity). Q7b links Part 09 §5 Scenario D.
- Q26 testing, Q28 contracts, Q29 quality dims, Q35 Lambda, Q38/Q39 behavioural → 2–4 line summaries plus links (p06-10, p12-5, p01-13, part-15, p12-2, p03-13, p09-6, p09-11).
- Observability/DQ and Snowflake sections tightened with links to p12-2, p12-3 and p11-1. Intro format list folded into one sentence.
- Approx. 1,800–2,000 words of legacy text removed or compressed. Net part word count still rose (6,555 → 8,455) because of the required additions below.

### Version notes added
- Q14 shuffle: push-based shuffle is Spark 3.2+ and YARN-only; K8s uses a remote shuffle service.
- Q18 watermarks: WatermarkStrategy/withIdleness in Flink 1.x and 2.x; SourceFunction removed in 2.0.
- Q24 soft deletes: Iceberg v2 delete files vs v3 / Delta deletion vectors — all logical until rewrite + expiry.
- BigQuery slots: flex/flat-rate retired July 2023 → Editions autoscaling; there is no off-peak price.
- (Group note, not a version note) Design-scenarios framework note linking #part-18.

### Added
- hb-meta + hb-lede after the header.
- 6 incident drills (Q1–Q6): each has a concrete prompt, `p.hb-stop` and a `<details>` "Reveal the answer skeleton" wrapping the existing answer. Group intro links #part-19. Q1 adds a blast-radius step.
- Design group: a framework note linking #part-18. A "Framework gaps to fill in the room:" line on all 7 designs plus the DQ-monitoring design.
- Capacity numbers (hypothetical, arithmetic checked) in 2 designs. Feature store: 10K req/s × 2 keys = 20K reads/s; 2 KB → 40 MB/s; 55M entities × 2 KB ≈ 110 GB (330 GB at RF3); 110 GB × 365 ≈ 40 TB/yr. Multi-region: 20 TB/day × 30 = 600 TB/mo × $0.02/GB ≈ $12K/mo, assumed rate flagged. Multi-region also gained RPO/RTO clarifiers and a failover drill.
- Q32 CI/CD: slim CI (`state:modified+ --defer`), data-diff gate, blue/green / WAP promotion, link #part-14.
- 2 hb-attack blocks in Trade-offs: after Q32 (budget cut, which corner gives) and after Q36 (Polars fits today but grows 3×/yr).
- EOS pipeline text diagram converted to `figure.hb-diagram`.
- All h2s numbered "N. " (1–46). Ids added to the 9 id-less h3s. "Closing meta-advice" moved to the end.
- No L5 card (per brief).

### Code labels
- 2 code blocks, both labelled. p08-cb1: "Yes — Spark with an Iceberg catalog" (fixed the column). p08-cb2: "Yes — Spark with Iceberg SQL extensions, run in the Iceberg catalog".
- 1 `<pre>` text diagram → hb-diagram (not labelled). The viz-tree div was left as is.

### Left alone / needs external verification
- Q34 Snowflake/BigQuery managed Iceberg phrasing (versions.md confirms both are GA). Q37 vendor list currency.
- $0.02/GB inter-region rate is an explicit assumption, flagged "check current pricing".
- Kafka per-partition throughput (~10 MB/s "high end") is a rule of thumb, told to benchmark.
- Q8 "BETWEEN join + LATERAL" wording kept as "range join + LATERAL".
- Outside scope: page-level "40+ real scenarios" strings (article head, index.html, article_metadata.json) listed in audit §2; Part 09 scenario C/D fixes.

## Part 09



Words (tags stripped): 18,923 before → 22,068 after. The existing text shrank to about 18,600. New material is about 3,450 words: the §12 Staff-signal section is 3,150, and the rest is the meta block, lede, dialect table, §5 step table and 2026 note.

### Claims corrected
| Before | After | Why | Conf |
|---|---|---|---|
| "Four weeks is the minimum … top-tier company" | "a realistic plan for a working engineer" | Unsupported | High (policy) |
| "failure modes that show up in post-debrief scorecards" | "common failure modes that interviewers tend to write down" | Unsupported provenance | High |
| "Four lean hires … below 50% at most committees" | "A loop of only 'lean hire' votes often fails to clear the bar" | Invented statistic | High |
| "The bar raiser asks…" | "The last interviewer asks…" | Amazon-specific term | High |
| C3 "Cardinality × retention / compaction target = files" | partitions = cardinality × time buckets; files ≈ partitions × max(1, data/partition ÷ target) | Dimensionally wrong | High |
| L5/L6/L7 presented as universal | Caveat: level numbers differ by company; the guide uses shorthand | Company-specific ladders | High |
| Day 2 drill: percentile_cont via NTILE | via ROW_NUMBER, COUNT, and linear interpolation | NTILE can't produce it | High |
| "SQL problems that actually separate seniors…" and "runs on Snowflake, BigQuery, Redshift, Postgres … Spark equivalents noted" | Neutral wording; each query labelled with its dialect; porting table added (Snowflake/PG/BigQuery/Spark) | False portability claim; Spark notes never existed | High |
| Q1: "month 0 (100% by definition), up to month 12"; inner join drops cohorts with no activity | Prompt lists months 0/1/2/3/6/12 and says m0 is not 100%. Solution: `cohort_size × offsets` LEFT JOIN retention, with offsets restricted to elapsed months (NULL = not yet observable, 0 = zero retained) | Logic bug and wrong prompt | High (logic tested on a PG translation) |
| Q3 follow-up: "broadcast hash joins if touches fits" | Broadcast only a pre-filtered slice; won't fit at 10B; co-partition otherwise | Accuracy | Medium |
| Q4: 25-month series; sentinel 9999% for growth from zero | 24 months including the current partial one; NULL plus a `grew_from_zero` flag; `LAG` computed once in a CTE | Sentinel corrupts aggregates | Medium |
| Q5 follow-up: DENSE_RANK for "all ties included" | RANK (WITH TIES semantics); DENSE_RANK only for the top-3 distinct values | Wrong function | High |
| Q6: "Spark has a native as-of join… asOfJoin can keep history broadcast" | No as-of clause in Spark SQL; pandas-on-Spark `merge_asof` is rewritten to join+aggregate; bucket or range join | Accuracy (audit Ext-checked) | Medium |
| Q7: step 3 compared against raw t_view (not qualified); per-user MIN | Rewritten as a chained LEFT JOIN (each step after the *qualifying* previous step, within 24h of the visit). First-visit anchoring stated as intentional; per-visit instance in follow-up. MATCH_RECOGNIZE follow-up names engines | Wrong funnel logic | High (tested PG16 with adversarial users) |
| Q8: ROWS 89 PRECEDING over sparse daily rows; 90-day source filter | Date spine (180 complete days, starting at each merchant's first txn), explicit zeros, prior-90-day window, output limited to last 90 days | Zero-transaction days invisible; baseline too short | High (tested PG16: detects drop to zero) |
| Q9: "no MEDIAN (assume older Postgres)" | Assume neither MEDIAN nor PERCENTILE_CONT; PG has percentile_cont since 9.4 | Wrong premise | High |
| §5 "Prompt (verbatim)" ×4 | "Prompt" | Implied real prompts | High |
| A: late rows to a "late side-table" on silver | Event-time windows with a 2h watermark for the dashboard; the nightly batch recomputes from bronze by event date | Spark SS has no late side output | Medium |
| A: "~$2,000/year" for three tiers | ~21 TB uncompressed worst case, a few hundred $/month at object-storage list prices (check current pricing) | Arithmetic was off | Medium |
| C: "keep S3 files 90 days … then delete" | The files are still referenced by Iceberg after `snapshot`; drop only the HMS entry, clean up through Iceberg | Would corrupt the table | High |
| D: "regulatory constraint that declines cannot be retried…" | Audit requirement to pin the model version per decision | Invented regulation | High |
| D: "decline everything is customer-friendly" | "blocks every legitimate customer" | Reversed | High |
| D: 150 ms timeout vs 100 ms budget | 100 ms (its budget) | Self-contradiction | High |
| D: "7 years … compliance minimum in this industry" | Period set by compliance; often multi-year, depends on regime | Unsupported | Medium |
| D: "$50–100K/month" | Size from the provider's per-read pricing | Unsourced | Medium |
| "Every senior loop includes…" | "Most senior loops include…" | Overgeneralization | High |
| §7: streaming "3–10x ops overhead" | "materially more ops overhead" | Unsupported number | Medium |
| §7: denormalize "almost always" | "often, for consumption marts; keep conformed dims underneath" + link to p08 star-vs-OBT | Contradicted Part 08 | Medium |
| §7: warehouse "high cost-per-GB", lakehouse wins at "~100 TB" | Storage priced near object storage; the axes are compute and lock-in; lakehouse wins for multi-engine/ML access | Wrong / unsupported | Medium |
| §9: "opener in 80% of rounds"; "§F3 above"; "most candidates crash at hour 3"; "performance drops measurably below 7 hours" | "a common opener"; link to §2 F3; plan the breaks; sleep line cut | Invented stats | High |
| §10: "measurably improves cognitive performance", protein, "next interviewer hasn't talked to the last" | Section cut to 7 bullets, wellness claims removed | Padding / unsupported | High |
| §11 title "Real…"; "drawn from actual DE interview loops"; "The real scenario" ×8 | Neutral title; "representative prompts … illustrative composites, not transcripts"; "The scenario" | Policy | High |
| §11.1 MRR fix used `paused_until` on the dim that Option B left untouched | MRR fix against `fct_subscription_state_change` (latest state = paused); "strictly better" softened | Internal inconsistency | Medium |
| §11.2 "broadcast with a skew hint"; "staff eng from the other pod" vs "on your team" | "AQE skew-join handling or salting"; "A staff engineer on your team" | OSS Spark has no skew hint; inconsistency | High/Medium |
| §11.3 `snowflake` CLI; "3 of the 6 categories dbt generic tests" | `snowsql`; dbt has four built-in generic tests (2 overlapped) | Factual | High |
| §11.4 "took the pager" | "took the one-pager" | Typo | High |
| §11.7 fix: new `ingested_at` column | Re-read the full current row per changed order_id before MERGE; the contract documents what bumps `updated_at` | The original fix didn't address the root cause | Medium |
| §11.8 cause: allowedLateness=0 on multi-partition topic | Watermark assigned after the source with zero out-of-orderness; moved WatermarkStrategy onto the Kafka source (per-partition) | A lagging partition holds the watermark back; it doesn't drop records | Medium |

### Compressed
- §1 roadmap rewritten as four day-tables (1,474 → 904 words). Every day links to its Part.
- §2 E1–E4 merged into one list pointing to the §6 anti-patterns (≈200 words).
- §3 Principal signals folded into three bullets (≈120 words).
- §10 Day-of cut from 5 subsections and 18 bullets to 3 subsections and 7 bullets (324 → 152).
- §11 "What the interviewer hears" lists trimmed to two bullets each (8 lists, ≈350 words).
- Stale "Elegance is for Twitter" and committee-flavoured phrasing removed; triple blank lines collapsed.

### Version notes added
- SQL bank: 2026 Interview Note separating the timeless parts (dense spine, tie semantics, the cohort-driven join) from version-specific ones (PG `percentile_cont` 9.4+, PG 11+ RANGE interval frames, Spark median/percentile in newer releases, Snowflake DATEDIFF boundary semantics).
- hb-meta: versions referenced (PG 9.4+ / PG16 tested, Snowflake SaaS) and official doc links (PostgreSQL, Snowflake, BigQuery).

### Added
- hb-meta and hb-lede after the header, plus an honest-framing sentence (composites, not transcripts).
- §1: Python round (Part 06) in the Week 1 weekend. Scheduled Parts 10/11/12 (Day 15), 13 (Day 10), 14 (Days 14, 18), 15 (Day 5), 16 (Day 12), 17 (Week 3 weekend), 18 (Day 11; replaces the nonexistent "five-step opener" and "volumes cheat sheet"), 19 (Week 2 weekend, Day 18), 20 (the night before).
- §4: dialect porting table and per-query labels.
- §5: intro paragraph linking the Part 18 framework, with a table of the steps each strong answer shows and the step to add in practice.
- **§12 Staff-Signal Behavioral Scenarios** (id `p09-staff-signal-behavioral`, ≈3,150 words). 14 cards (h3 ids `p09-ss-*`): disagreeing with a Staff engineer (fully modelled, both people competent), influencing without authority, migration strategy, stopping bad architecture, changing direction, platform adoption, communicating outages, tech-debt prioritization, saying no to product, mentorship, cross-team ownership, architecture review, incident leadership, delivery vs reliability. Each card has: prompt, what's probed, L5 answer shape (example numbers labelled hypothetical), common failure, and a Staff+ extension ending with "How did this improve the organization after you left the project?". Also: an hb-note, an hb-depth ("Tell me about a disagreement with a senior engineer", 30s/2min/deep), an hb-attack ("So you were wrong?"), and a Behavioral answer checklist box (hb-failure styled, 8 checks).
- The §6 worked example links to §12.1. §9 links to the new id `p09-2-f3-reverse-questions` (on the F3 h4).
- Closing h2 renumbered "13. Closing Note" (id unchanged).
- The 45 id-less h3s now have `p09-…` ids. No existing id was removed.
- No L5 Interview Card (per brief).

### Code labels
13 blocks, 13 labels.
- Illustrative (schema sketches): 3.
- Yes — Snowflake only: 3 (Q1–Q3).
- Yes — PostgreSQL only: 3 (Q4, Q7, Q8).
- Yes: 4 (Q5, Q6, Q9, Q10; portable, tested on PG16).
- Rewritten: Q1, Q4 (tail), Q7, Q8. Run on PostgreSQL 16 with test data: Q4–Q10. Q1 was logic-tested via a PG translation.

### Left alone / needs external verification
- Q1–Q3 Snowflake syntax (`FROM VALUES`, `DATEADD(month, …)`, `DATEDIFF('second', …)`, `CAST(… AS STRING)`) was not executed on Snowflake.
- Porting-table cells for BigQuery/Spark are from memory of the docs; they are hedged with "check current docs" and "version-dependent".
- The Part 18 eight-step names are taken from the audit (requirements, numbers, data model, architecture, failure modes, trade-offs, operations, evolution). **Part 18's author must use the same eight names**, or §5's intro and table need re-syncing.
- Scenario B still overlaps Part 08 q2 and the "KPI shows zero" h3 (audit: triplicated). Left in place because it's the only debugging transcript; the merge belongs to the Part 08 owner.
- §11 transcripts still carry example numbers (11 fires / 9 true, timelines). They are now framed as illustrative composites.
- "Build vs Buy" 80%/20% heuristic kept as a heuristic, not a statistic.

## Part 10



Word count (tags stripped): 1,542 → ~6,240. This includes ~700 words of code/diagrams and ~120 of hb-meta, so prose is about 5,400. This is a BEEF UP. The brief's target was ~4,000–5,000; I ran two compression passes and stopped at this size to keep all required components.

### Claims corrected
| Before | After | Why | Conf. |
|---|---|---|---|
| GDPR applies to "any system processing personal data of EU residents, regardless of where the processor is located" | Art. 3: EU-established controllers/processors, plus non-EU orgs offering goods/services to, or monitoring, people in the EU; subject's location counts, not residency | Territorial scope misstated | High |
| "The six Article 5 principles" | Six in 5(1) + accountability 5(2), in a principle→mechanism table | Accountability omitted | High |
| Erasure steps: DELETE + "expire old snapshots…" | Full chain: DELETE → purge (Delta `REORG … APPLY (PURGE)`, Iceberg `rewrite_data_files` with `delete-file-threshold`) → expire snapshots → VACUUM / remove_orphan_files → beyond-table copies → backups → verification → erasure log | DVs/MOR delete files leave PII in current files; expiry alone does not delete Delta files | High (Delta 3.x/4.x, Iceberg 1.x) |
| "GDPR allows 'reasonable' time for backup purge" | Art. 12(3) one month (+2); backups "beyond use" per regulator guidance (UK ICO), restores re-apply the queue | Not in GDPR text | High |
| Anonymization = "k-anonymity ≥5, differential privacy" | Recital 26 "reasonably likely" test; no numeric k in law; WP29 05/2014 on k-anonymity weaknesses | Invented threshold | High |
| "Some regulations require EU data to remain in EU storage" | GDPR restricts transfers (Ch. V: adequacy incl. 2023 DPF, SCCs, BCRs); localisation comes from sector/national law or contracts; federated coordinator = transfer | Conflation | High |
| "CCPA (effective 2020, strengthened by CPRA 2023)" | CCPA 1 Jan 2020; CPRA operative 1 Jan 2023, created CPPA, added correct / sharing opt-out / limit-SPI | Imprecise | High |
| SPI "requires … opt-out mechanism" | "Right to limit use of SPI"; GPC must be honoured as an opt-out; 45 (+45) days for access/deletion; kept 15 business days for opt-outs (CPPA regs) | Wording | Medium-High |
| Consent table `consent_gdpr, consent_ccpa` | Per-purpose consent event log + current-state view, fail-closed join | Per-regime booleans are an L5 red flag | Medium (design) |
| "Ad-hoc production changes are a SOX violation" | ITGC exception reported as a control deficiency; emergency-change path | Overstated | High |
| "Immutable audit logs (… Delta audit log)" | Delta DESCRIBE HISTORY is operational, bounded by logRetentionDuration; not an audit log | Wrong | High |
| Retention "Glacier after 30d → delete at 90d" | Standard → delete; no Glacier for short-lived data (90-day minimum + transition fees) | Cost error | High |
| "Deep Archive; query via Athena on-demand" | Glacier IR is directly readable; Deep Archive needs a restore (hours) | Wrong | High |
| "7 years (SOX) / 3 years (GDPR)" | Commonly 7y for financial-control evidence (SOX §802 / SEC 2-06 practice); GDPR sets no fixed period. The whole table is relabelled "illustrative" | Invented figure | High |
| `ALTER TABLE events DROP PARTITION (dt < …)` on Iceberg/Delta | `DELETE` aligned to partition boundaries (metadata-only); bytes gone after expiry/VACUUM | Hive syntax, unsupported | High |
| Airflow/dbt capture lineage "automatically" | dbt manifest.json; Airflow via `apache-airflow-providers-openlineage` (2.7+, operator-dependent) | Overstated | Medium-High |
| `dbt-openlineage` | `openlineage-dbt` via `dbt-ol` | Wrong package name | High |
| Glue "no business metadata, no lineage"; Amundsen row | Glue + DataZone/SageMaker Catalog; Amundsen replaced by Snowflake Horizon; Dataplex/Purview noted | Stale | Medium |
| "Google DLP" | Google Cloud Sensitive Data Protection (formerly Cloud DLP); Macie is S3-only | Renamed | High |
| Pseudonymization "Reversible: Yes (with key)" | HMAC: not reversible but joinable; mapping/deterministic encryption reversible; static vs dynamic masking split | Method-dependent | High |
| "Encryption (AES-256 at rest)" | At rest protects media only, not against query users; per-subject envelope encryption → crypto-shredding | Misleading | High |
| Snowflake ACCESS_HISTORY unqualified | Enterprise Edition+, ~3h latency, 365-day retention | Edition/latency | High |
| Redshift STL_QUERY | SYS_QUERY_HISTORY (STL keeps days) + audit logging to S3/CloudWatch | Current | Medium-High |
| Delta CDF / Iceberg history as immutability | Not immutability controls; CDF retains erased pre-images → in erasure chain; tamper-evident = WORM + separate account + integrity validation | Wrong + GDPR hazard | High |
| Classification "propagated automatically via lineage" | Only where the catalog supports it; otherwise enforce in CI | Honesty | Medium |
| Markdown italics artefact `raw/<em>…</em>` | Not present in this part (audit located it in Part 11). No action here | — | — |

### Compressed
- Old four-bullet erasure list, tier list (merged into one sentence), catalog table (tier column dropped, Amundsen removed), detection prose, SOX bullets. Rows cut from the "beyond the table" and failure tables. Two tightening passes, ~1,100 words removed from the first draft.
- Duplication avoided: IAM/RBAC/ABAC, KMS hierarchy, masking/row-policy SQL and tokenization architecture now point to `#part-14`. The table-format catalog role points to `#p07-12-…`. OCC points to `#p07-4-…`. S3 lifecycle costs point to `#p11-s3-lifecycle`. Trained models point to `#part-17`.

### Version notes added
- Head note: timeless (logical ≠ physical, isolate identifiers, tags → policies) vs version-specific (REORG PURGE, rewrite_data_files, VACUUM, edition gates).
- Retention note: history retention ≤ data retention; knob names per engine (Delta, Iceberg, Snowflake) and Databricks predictive optimization.
- Inline: Snowflake Time Travel / Fail-safe, BigQuery time travel + fail-safe ("check current docs"); Delta/Iceberg stats-column properties hedged.

### Added
- hb-meta, hb-lede (includes "not legal advice" and the Part 14 scope split).
- New h2 §2 "Right to Erasure in an Immutable Lakehouse" (`p10-2-erasure`) with h3s locate / design-for-erasure (1 PB cost arithmetic) / delete-purge-expire-remove (Delta and Iceberg code) / beyond the table / proof / crypto-shredding (trade-off table).
- hb-diagram: erasure propagation chain (§2); data lineage with column edges and impact path (§6); classification pipeline scanner → tags → policies (§9).
- hb-depth: "How do you delete one user's data from a petabyte lakehouse?" (§2).
- hb-attack ×2: "SHA-256(email) is anonymous" (§1 pseudonymization); "we have deletion vectors, so the user is gone" (§2).
- hb-drill: erasure "completed" but email visible via time travel on last month's snapshot (§2).
- hb-failure: erasure pipeline, 6 rows (§2).
- Lineage: static-parse vs runtime-event capture table; OpenLineage events and facets; recursive-CTE impact query.
- Retention: policy-as-data enforcement; legal hold precedence.
- Auditability: Snowflake "who read EMAIL" query; central audit table; tamper-evidence; PII in audit logs.
- New h2 §11 "Compliance Without Blocking Analysts" (`p10-10-analyst-friendly`).
- L5 Interview Card `p10-l5-card`. Central question: "How do you make a data platform compliant without stopping analysts from working?"

### Code labels
6 code blocks, all labelled: Yes ×1 (Delta, with DV caveat), Yes — PostgreSQL ×2 (consent, lineage CTE; needs PG14+ for CYCLE), Yes — adapt names ×1 (retention DELETE), Yes — Snowflake Enterprise+ ×1 (ACCESS_HISTORY), Illustrative ×1 (Iceberg procedures). The part had no code before. Three text diagrams are wrapped as hb-diagram. The card holds one tiny `<pre>`, which the SPEC allows.

### Left alone / needs external verification
- CPPA 15-business-day opt-out window and GPC requirement (CCPA regs §7025/§7026). Check against the current regulation text.
- Delta `delta.dataSkippingStatsColumns` and Iceberg `write.metadata.metrics.column.<col>` names. Hedged "check current docs".
- Regulator acceptance of crypto-shredding as erasure. Stated as a legal judgement to sign off.
- Snowflake ACCESS_HISTORY latency/retention and BigQuery fail-safe duration. Stated "at time of writing".
- No link targets inside parts 13–20 are used below part level (`#part-14`, `#part-17` only).

## Part 11



Word count (tags stripped): before 1,470 → after ~5,890 (~5,400 excluding code; includes the L5 card, ~700 words, and hb-meta). The chapter was rebuilt around cost reasoning. Price lists became ratios and mechanisms.

### Claims corrected
- Snowflake sizing: "4 min on M = 16 credits (4×4)" → 4 credits/h × 4/60 h ≈ 0.27 credits; on L, 8 × 2/60 ≈ 0.27. Arithmetic had treated minutes as hours. High.
- Inverted sizing rule: "larger justified only when queries don't parallelize" → upsize when the query parallelises or spills (it can be cost-neutral or cheaper); don't upsize when it doesn't speed up; queueing needs multi-cluster, not size. Added per-second billing with a 60 s minimum per resume. High.
- Credit price "$2–4" → "a few dollars depending on edition/region/contract (illustrative — check current pricing)"; reason in credits. Gen1 vs Gen2/Snowpark-optimized rate caveat. Medium.
- Auto-suspend "60 s everywhere" → trade-off (cache loss, resume minimum); longer for BI. High.
- Result cache conditions: added role privileges, no non-deterministic functions, 24 h reset up to 31 days. High.
- Clustering: "use high-cardinality columns" → large tables only; enough distinct values to prune but coarsen raw high-cardinality columns (TO_DATE(ts), not ts/user_id); churn cost. Fixed "rerranges" typo. High.
- MVs: Enterprise+, single-table, serverless-billed maintenance; Dynamic Tables for joins. High.
- Databricks DBU: price set by compute type/tier/cloud, VM sets DBUs/h; classic = two bills; serverless bundles. High.
- Autoscaling for streaming → classic autoscaling for batch only; streaming uses enhanced autoscaling in Lakeflow Spark Declarative Pipelines (name per versions.md) or a fixed size. High.
- Decommission config `spark.databricks.delta.retryCommit.enabled` (unrelated to decommissioning) → spark.decommission.enabled + spark.storage.decommission.enabled + shuffleBlocks.enabled; best-effort. High.
- Photon "2–10×" → 2–3× typical, consistent with Part 04 §19, plus a higher DBU rate so it must beat the premium. High.
- Serverless "charges only for active query time" → bills running time including the idle tail until auto-stop. High.
- "Delta cache" → disk cache (formerly Delta cache); `.cache()` = MEMORY_AND_DISK, not heap-only. High.
- S3 PUT "$0.0004/1k" → PUT/COPY/POST/LIST ≈ 10× GET (illustrative $0.005 vs $0.0004, us-east-1). High.
- Glacier Flexible retrieval "$0.03/GB, 3–5h" → Expedited 1–5 min (priciest) / Standard 3–5 h / Bulk 5–12 h (free at time of writing); Deep Archive Standard 12 h / Bulk 48 h. Medium-High.
- Added a 128 KB minimum billable object for IA / One Zone-IA / Glacier IR and a ~40 KB per-object overhead for Glacier Flexible/Deep Archive; Intelligent-Tiering fee is per month and skips objects under 128 KB. High.
- Storage-class $ column → storage price relative to Standard (ratios), labelled illustrative. Removed hard dollar rates.
- `raw/<em>` Markdown artefact → `<code>raw/*</code>` / `<code>processed/*</code>`. High.
- Redshift WLM: "CPU and memory limits" → concurrency slots + memory shares; SQA is a feature, not a queue with a timeout; auto WLM doesn't assign queues (priorities + QMR instead); Serverless has no WLM. Interleaved sort keys flagged as discouraged; AUTO dist/sort mentioned. High.
- Spark: removed the `$X` placeholder; "always broadcast dims" → multi-GB dims use SMJ/bucketing. High.
- Tagging: Tag Policies don't block untagged resources → SCP aws:RequestTag / Azure Policy deny; platform tags for platform spend. Medium-High.
- RI savings "30–60%" → roughly 30–70% (illustrative). Medium.

### Compressed
- Spark section (3 h3s, ~250 words) → one 4-bullet cost-translation list cross-linked to Part 04 (AQE, skew, broadcast, Photon). The three h3 ids are kept as `<span>` anchors.
- Redshift VACUUM, dist/sort, Snowflake MV/search-optimisation and S3 lifecycle prose tightened. The S3 price table became a ratio table.
- Showback/chargeback merged into a single short paragraph. The generic FinOps anomaly-tool list was shortened.
- Architecture comparison is not duplicated: a one-line link to #part-16.

### Version notes added
- Vendor pricing is time-sensitive (chapter-level hb-note).
- Snowflake Gen2 standard warehouses (GA May 2025; default for new standard warehouses under BCR 2026_03) at a higher per-hour rate; same premium test as Photon.
- Databricks serverless GA and the default for new jobs, with Photon and autoscaling on automatically.
- In-text: BigQuery Editions replaced flat-rate (no new flat-rate/flex purchases after July 2023); Lakeflow Spark Declarative Pipelines naming; S3 lifecycle 128 KB default (hedged).

### Added
- §1 Where the Money Goes: hb-diagram of the five buckets (storage / compute / egress / API calls / people) and a cost-model-per-platform table (what you pay for / what makes it spike / the one lever), cross-linking #part-16.
- §2 Estimating Cost: unit economics (per TB, per run, per query/view, per business unit), an estimation method with a worked dashboard example, and attribution (QUERY_TAG, custom_tags, labels) with a Snowflake metering/attribution SQL block and the idle-cost gap.
- §3 Snowflake: new h3 on guardrails (resource monitor SQL; monitors cover warehouses only; cloud-services 10% rule).
- §4 Databricks: system.billing.usage × list_prices cost query; cluster policies; hb-attack "Move everything to spot".
- §5 BigQuery (new): on-demand vs Editions/slot autoscaling, partition + cluster DDL with require_partition_filter, bq dry run / maximum_bytes_billed, INFORMATION_SCHEMA.JOBS attribution, MV/BI Engine (hedged), long-term and physical storage billing.
- §6 Redshift: new h3 on RA3 / Serverless (base RPU, usage limits) / concurrency scaling (hedged free credits) / Spectrum.
- §7 S3: lifecycle JSON with ObjectSizeGreaterThan, per-object transition cost, and a new h3 on data transfer (NAT gateway vs S3 gateway endpoint, cross-AZ, cross-region).
- §9 FinOps: break-even utilisation formula (1 − d); hb-attack "Just buy reserved capacity"; hb-drill "warehouse bill doubled overnight" (auto-refresh on XL + CURRENT_TIMESTAMP cache/prune defeat; alternatives listed: dropped cluster key, backfill, retries, upsize, serverless churn).
- §10 (new): hb-depth "cut this platform's cost by 30% without hurting SLAs".
- L5 Interview Card p11-l5-card, central question "Where does the money go on a data platform, and how do you control it?"
- hb-meta and hb-lede.

### Code labels
7 code blocks, all labelled. All are "Yes — <engine> only" variants: Snowflake SQL ×2, Databricks SQL ×1, GoogleSQL ×2, bq bash ×1, S3 lifecycle JSON ×1. One text diagram converted to hb-diagram. The original part had no code.

### Left alone / needs external verification
- Relative storage-class ratios, the PUT/GET illustrative rates, Redshift concurrency-scaling free-credit accrual (~1 h/day), and Serverless minimum billing are all hedged "check current docs".
- Snowflake Gen2 per-hour premium is stated only as "higher" (no multiplier given).
- BigQuery dry-run upper bound for clustered tables and the S3 128 KB lifecycle default (Sept 2024 change) are stated from memory and hedged.
- The word count is over the 4,500 target by roughly 900 words of prose (the card and the required components account for most of it).

## Part 12



Words (tags stripped): 1,594 → 5,780 total (≈5,020 excluding code/diagram `<pre>`). Brief asked for a moderate beef-up (~4–5k).

### Claims corrected
- "Staff-level interviews increasingly focus…" → "Senior (L5) interviews increasingly probe…" (handbook targets L5). Medium.
- "GX is the most widely deployed…" → "GX Core 1.x since Aug 2024 … a widely used framework; dbt tests, Soda Core, Deequ/PyDeequ, platform-native as alternatives". Medium. GX Core 1.x / versions.md.
- Expectation examples: 0.x snake_case validator methods → 1.x typed classes (`gx.expectations.ExpectColumnValuesToNotBeNull(column=…)` etc.). High.
- Checkpoint "runs a suite against a Batch Request" → Validation Definition (Batch Definition + Suite) run by a Checkpoint with Actions; Fluent data sources only. High.
- GX 0.x code block (`run_checkpoint`, `data_connector_name`, `batch_spec_passthrough`, `results["success"]`) → GX Core 1.x block (audit's version, with a comment that validation runs on staged output). High.
- "Run GX checkpoints as the first step of the silver layer job" → validate the silver OUTPUT in staging before publish (WAP); input only for contract checks. High.
- KL-divergence row "Detect silent schema changes" → "distribution drift vs a reference (cents→dollars, new default)". High.
- Tools table: re_data (unmaintained) removed → Soda Core / Snowflake DMFs / Databricks Lakehouse Monitoring; Metaplane "now part of Datadog — verify". Medium-High.
- Monitoring SQL: partial-today compare → yesterday's complete day; unused STDDEV → z-score vs same-weekday baseline; freshness driven from `ops.expected_tables` LEFT JOIN (absent tables alert); date spine so a missing day alerts; alias reuse in WHERE/HAVING removed; `<`/`>` escaped. Medium-High. Labelled Snowflake.
- Streaming latency SLA "within 5 minutes of ingestion" → p99 from event time (or source commit). Medium.
- Error budget "0.1% monthly ≈ 43 minutes" → batch budget counted in days (97% over 90 days ≈ 2 late days) and streaming in minutes (99.5% of minutes over 28 days ≈ 200 min). High (unit error).
- Hash-diff "MD5(concat all columns)" → delimited, NULL-coalesced, type-normalised hash; aggregates first, then keys. High.
- "dbt schema tests and GX are the practical implementation" for contracts → dbt model contracts (`contract: {enforced: true}`, dbt 1.5+) enforce shape; data tests enforce values. High.
- dbt YAML: `tests:` → `data_tests:` (1.8+); generic-test args under `arguments:` (1.10+); dropped calogica `dbt_expectations` for `dbt_utils.accepted_range`; added enforced contract, `data_type`, `constraints`, `severity`/`warn_if`/`error_if`. Medium-High.
- "Target: <10% toil" → "Google SRE caps toil at 50%; good data teams aim far lower". Medium.
- Severity table: fixed response minutes → labelled illustrative; severity defined by consumer impact.

### Compressed
- Five-pillars bullets (5 paragraphs) → one sentence (~130 words cut).
- Testing section: PySpark pytest unit test (duplicate of P6 §10.3), integration-test paragraph and contract-test paragraph removed → testing-pyramid table + cross-links to `#p06-10-testing-strategy-for-data-pipelines`, `#p01-13-data-contracts--schema-evolution`, `#part-15` (~300 words cut). Ids `p12-test-unit`, `p12-test-integration` kept as spans.
- Removed intro "tools, frameworks, design patterns" filler, Data Docs bullet, regex/pair expectation rows, RI/boundary rows from recon table (they are gate checks), DIY tools row, runbook paragraph tightened, on-call paragraph tightened.

### Version notes added
- §2 GX: 0.x vs GX Core 1.x (0.18 sunset Oct 2025); concept = declarative expectations at a gate, fail-closed vs warn; alternatives named.
- §7 dbt: `data_tests` (1.8), `arguments:` (1.10), dbt 2.0 (Sep 2026) — check docs; durable idea = per-test severity.

### Added
- New §1 "The Data-Quality Pipeline" (h2 `p12-dq-pipeline`): hb-diagram (ingest → contract → DLQ → transform/stage → gate → block/warn/publish → monitors → alert → incident → post-mortem → new test), prevent/detect + fail-closed/warn framing, hb-depth "How do you know your data is correct?", hb-failure table (6 rows) for the DQ pipeline itself.
- §2: hb-attack "We have 2,000 dbt tests" (which block, who looks).
- New §3 Write-Audit-Publish (`p12-wap`): stage → audit → atomic publish; engine table (Iceberg branch + fast_forward, Delta staging + single commit/RESTORE, Snowflake clone + SWAP WITH, view swap); Iceberg WAP Spark SQL and Snowflake code; hb-attack "why not publish then time-travel back".
- §4: h3 `p12-anomaly` static vs seasonal vs ML trade-off table + tiering/routing; hb-attack "alert on every anomaly" (fatigue arithmetic).
- §5: SLI table (freshness batch/streaming, completeness, correctness), error-budget worked example with policy.
- §6: reconciliation design (definition first, aggregate then drill, explicit tolerance + settle period, "slice until it breaks", placement), control-total recon SQL, hb-drill "Revenue is 3.7% higher than Finance" with reveal; link to `#part-19`.
- §8: first-15-minutes checklist (`p12-incident-first15`), comms template (`p12-incident-comms`), post-mortem → new check tied back to diagram.
- L5 Interview Card `p12-l5-card`, central question "How do you make data trustworthy — and prove it?".

### Code labels
- 6 code blocks labelled: Yes — engine-only ×2 (GX Core 1.x Python; Snowflake monitors), Illustrative ×4 (Iceberg WAP Spark SQL, Snowflake clone/swap, recon SQL, dbt YAML). 0 Pseudocode.
- Fixed: GX block rewritten; monitor SQL rewritten; dbt YAML updated. PySpark pytest block removed (dup of P6).

### Left alone / needs external verification
- GX 1.x API names (`data_sources.add_spark`, `add_batch_definition_whole_dataframe`, `gx.checkpoint.UpdateDataDocsAction`, `checkpoint.run(batch_parameters={"dataframe": df})`) — matches GX Core 1.x docs to my knowledge; verify against 1.23.
- Iceberg `fast_forward` procedure minimum version (stated "newer 1.x", code labelled 1.4+); Snowflake grant behaviour on SWAP; Metaplane/Datadog acquisition; dbt 1.10 `arguments:` for `dbt_utils.recency`/`accepted_range` and `config` placement under dbt 2.0.
- Severity response times are illustrative by design.
