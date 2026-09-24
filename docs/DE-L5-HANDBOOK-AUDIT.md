# DE Interview Handbook — Senior/L5 Upgrade Audit (Stage 0)

_Audit date: 2026-09-24. Subject: `articles/data-engineering-interview-prep.html`
("Data Engineering Interview Prep — Senior / L5 Deep Dive"). This audit was completed
before any content was rewritten. What was actually changed is recorded in
[`DE-L5-HANDBOOK-CHANGES.md`](DE-L5-HANDBOOK-CHANGES.md); every claim flagged, with its exact
quote, problem and proposed wording, is in
[`DE-L5-HANDBOOK-AUDIT-CLAIMS.md`](DE-L5-HANDBOOK-AUDIT-CLAIMS.md)._

## How the audit was done

- The whole article (13 parts, ~973 KB, 272 code blocks) was read section by section, one
  auditor per part group. Each h2 was classified **KEEP / TIGHTEN / UPDATE / BEEF UP / ADD / VERIFY**
  with problem, proposed change, reason, size change and whether external verification is needed.
- Every strong claim (always / never / guaranteed / exactly-once / defaults / "X equivalent") was
  checked. Each flagged claim carries a verbatim quote confirmed unique in the file, a proposed
  replacement, and a confidence rating. Low-confidence items were not changed.
- Version assumptions were checked against official project pages and release registries (PyPI,
  Maven Central, project release notes, vendor docs). The container's egress proxy blocked direct
  fetches of several project sites; those facts were confirmed via official-domain search results
  and registry metadata, and anything still unconfirmed is marked **UNVERIFIED** below rather
  than asserted.

## Headline findings

| # | Finding | Severity | Action |
|---|---|---|---|
| 1 | **The article had drifted from its generator.** `scripts/combine_interview.py` rebuilds from `interview/html/*.html`, but Parts 10–12, the Kinesis section and other later edits exist only in the article. Re-running the script would silently delete ~600 lines. | P0 | Article made the single source of truth; generator retired (refuses to run); `interview/html/README.md` marks sources stale. |
| 2 | **Navigation was a flat chip bar of 13 parts** with no section-level contents. Local "Contents" lists in Parts 04–08 were hidden by CSS and missed every section appended later. | P0 | Hierarchical master contents generated from the headings (`scripts/handbook_build.py`); local lists removed (ids kept). |
| 3 | **Visible numbering had gaps and duplicates**: Part 01 has two "14."; Part 03 skips 15; Part 04 jumps 14→17; Part 05 skips 14; Part 06 12→15; Part 07 13→16. Sections appended after each chapter's "Next →" footer, after "Closing" sections, and missing from local TOCs. | P0 | Build script renumbers h2s sequentially (ids unchanged → deep links survive); stray mid-part footers removed. |
| 4 | **The Overview's Files table skipped Part 09**, listed `.md` filenames that don't exist on the page, and called Part 08 "the final file". | P0 | Overview rewritten. |
| 5 | **One global read time ("120 min") for a ~150K-word handbook.** | P0 | Per-part Quick / Study / Practice estimates derived from the page itself. |
| 6 | **"40+ real interview scenarios"**, "drawn from actual DE interview loops", "Prompt (verbatim)", and a list of named companies' loops as the source; invented statistics ("80% of rounds", "<50% at most committees"). None is supportable. | P0 | All removed/reframed as representative composites; banned-phrase check added. Also in meta tags, index cards, `article_metadata.json`. |
| 7 | **Version baseline "Python 3.11+, Spark 3.5+, Flink 1.18+"** is stale: Spark 4.x (ANSI on by default), Flink 2.x (DataSet/SourceFunction/`Time` removed), Kafka 4.x (ZooKeeper removed), Iceberg format v3, Delta 4.x, Airflow 3 (SLA callbacks removed, Datasets→Assets), GX Core 1.x, dbt 2.0. No section distinguished timeless concepts from version behaviour. | P0 | 2026 Interview Notes added where behaviour is version-specific; code labelled with version family. |
| 8 | **"Code samples are runnable"** — but of 272 blocks, many are illustrative, mixed-dialect or broken (e.g. Postgres partitioned-table PK, a no-engine OBT DDL, an Iceberg `replace-where` that would overwrite a whole table, GX 0.x API, Flink trigger extending a class with a private constructor, an empty as-of join block). | P0 | Every block labelled Engine / Dialect / Executable; small certain fixes applied; the rest labelled Illustrative. |
| 9 | **~350 questionable technical claims** across parts, roughly a third High confidence — e.g. nonexistent Snowflake `REQUIRE_PARTITION_FILTER`; BigQuery `TIMESTAMP` called naive; Spark's Kafka sink called transactional; watermark bound derived from end-to-end delay instead of out-of-orderness; HashMapStateBackend snapshots called synchronous; broadcast join "handles full outer"; Snowflake credit arithmetic off by 60×; S3 PUT price off 12.5×; GDPR territorial scope misstated. | P0 | See claims appendix; applied corrections logged in the changes doc. |
| 10 | **Heavy internal duplication**: Kafka exactly-once ×3, sessionization ×4, Tungsten ×2 (contradicting), sketches ×2 (contradicting error rates), catalogs ×2, feature matrix ×2, asyncio/packaging/pydantic/Polars ×2 each, feature-store design ×3, dashboard mismatch ×3, LAST_VALUE trap ×3. | TIGHTEN | Merged into the stronger twin; old ids preserved as anchors. |
| 11 | **Parts 10–12 are thin** (~1,500 words each vs 4,500–9,400 elsewhere), with no incidents, no interview Q&A and (Part 12) a code sample on a removed API. | BEEF UP | Rebuilt around interview reasoning (erasure in a lakehouse, cost reasoning, WAP/SLOs/reconciliation). |
| 12 | **Missing Senior/L5 capabilities**: distributed-systems foundations; cloud/security control plane; IaC/CI/CD/rollback; CDC end-to-end (only a thin, buggy §02-10); data contracts beyond a short YAML sketch; dbt beyond passing mentions; serving/NoSQL selection; warehouse architecture comparison; DE for AI systems; a reusable system-design framework and capacity toolkit; diagnose-first drills; self-assessment; cheat sheets. | ADD | Parts 13–20 (see plan below). |
| 13 | **System design**: no design followed requirements → numbers → model → architecture → failure → trade-offs → ops → evolution; data model and evolution skipped almost everywhere; only three designs had capacity math; the roadmap referenced a "volumes cheat sheet" and "five-step opener" that didn't exist. | BEEF UP | Part 18 framework + capacity toolkit; design scenarios annotated with the framework gaps. |
| 14 | **Behavioral**: good existing material; missing tech-debt prioritisation and architecture review; partial on stopping bad architecture, outage comms, incident leadership, cross-team ownership, migrations. | BEEF UP | Staff-signal behavioral section in Part 09. |
| 15 | **Interviewability**: no recurring end-of-chapter synthesis; almost no diagrams (7 decorative trees); answers shown only at one depth; incidents revealed their answers immediately. | ADD | L5 Interview Card per technical part; answer-depth, pushback, drill (hidden reveal) and failure-first blocks; architecture diagrams. |
| 16 | Minor structure bugs: 13 stray `</em>` in Part 09 §11; garbled testing-pyramid diagram; Markdown artefacts; ~60 h3s without ids; empty code block `p05-cb24`. No broken anchors, no duplicate ids. | P0 | Fixed; `scripts/check_handbook.py` now guards links, ids, numbering, cards, labels. |

## Plan: where new material goes (and why not elsewhere)

Existing part ids are stable deep-link targets (index cards and external links point at them), so
existing parts keep their numbers and new material is appended as Parts 13–20. Reading paths in the
Overview give a sensible order regardless of numbering.

| New part | Overlaps checked | Decision |
|---|---|---|
| 13 Distributed Systems for DEs | p03-7 delivery semantics, p03-9 Kafka ISR, p03-12 backpressure, p03-16 EOS, p02-8/17 partitioning, p04-7 skew | New unifying layer (replication, consistency, CAP/PACELC, consensus/fencing, partitioning, ordering, semantics, backpressure chain); mechanics stay in Part 03 and are linked. |
| 14 Production Platform — Cloud, Security, Release | p10-7 PII/tokenization, p08 cloud scenarios, p08 CI/CD Q, p06 packaging | Security control plane and "how do you safely change a production platform" were absent; governance obligations stay in Part 10. |
| 15 CDC, Contracts & Transformation (dbt) | p02-10 CDC, p01-13 contracts, p08 contract/schema Qs | p02-10 fixed and kept compact with a pointer; full CDC, compatibility semantics, the 14-consumer incident and dbt trade-offs live here. |
| 16 Serving Systems & Warehouse Architecture | p08 feature-store design, p08 row-store Q, p05-5 pruning, p11 vendor costs | Access-pattern-first storage selection and the conceptual warehouse comparison were absent. |
| 17 DE for AI Systems | p08 ML/feature-store scenarios, p05-10 as-of joins, p10 lineage | Only what changes for DEs: unstructured ingestion, chunking, embeddings, vector data, RAG quality, AI lineage, cost. |
| 18 System Design Framework & Capacity | p09-5 transcripts, p09-7 decision frameworks, p08 designs, p02-14/15 cost & parallelism math | One reusable framework + one capacity toolkit + failure-first catalogue + pushback catalogue; existing designs link to it. |
| 19 Debugging Lab | p08 incidents | Diagnose-before-solution drills with hidden reveals; p08 incidents converted to hide-then-reveal and linked. |
| 20 Self-Assessment & Cheat Sheets | — | Skills matrix tied to demonstrable abilities with links; one-page night-before sheets. |

## Version / technology audit (September 2026, official sources)


| Tech | Latest stable (date) | Supported / maintained lines | Headline change vs a 2024 handbook |
|---|---|---|---|
| Python | 3.14.7 (3.14.0 released 2025-10-07); 3.15.0 is at rc2, final scheduled 2026-10-01 | 3.14 (bugfix); 3.13 status UNVERIFIED; 3.10 security-only until Oct 2026; **3.9 EOL 2025-10-31** | Free-threaded build officially supported but optional in 3.14 (PEP 779); deferred annotations are the default; t-strings |
| Apache Spark | **4.2.0 (PyPI 2026-07-14)**; 4.1.0 (2025-12-16); 4.0.0 (2025-05-23) | 4.2.x, 4.1.x and 4.0.x (all patched Jul 2026); **3.5.x on extended LTS (security fixes only) until Nov 2027** | ANSI mode on by default; Java 17/21 and Scala 2.13 only; VARIANT type; Spark Declarative Pipelines (4.1) |
| Apache Flink | **2.3.0 (PyPI 2026-06-21; announced 2026-06-25)** | 2.3, 2.2 (2.2.1 May 2026), 2.1 (2.1.3 Jun 2026), 2.0 (2.0.2 May 2026); **1.20 LTS** (1.20.5 Jun 2026) | DataSet API, Scala APIs, SourceFunction/SinkFunction/SinkV1 removed; Java 11 minimum, Java 17 default; disaggregated state (ForSt) |
| Apache Kafka | **4.3.1 (announced 2026-06-25)**; 4.3.0 (announced 2026-05-22) | 4.3.x and 4.2.x (4.2.1 May 2026); formal EOL policy UNVERIFIED | ZooKeeper removed (KRaft only) in 4.0; KIP-848 GA in 4.0; share groups (KIP-932) production-ready in 4.2; transactions v2 (KIP-890) |
| Apache Iceberg | **1.11.0 (~May 2026, per Maven metadata; exact date UNVERIFIED)**; 1.10.0 (2025-09-11) | 1.11.x; 1.10.x (1.10.2 on 2026-05-18) | Format v3: deletion vectors, row lineage, default values, variant, nanosecond timestamps, geometry/geography |
| Delta Lake | **4.4.0 (PyPI 2026-08-20)**; 4.0.0 (2025-06-06) | 4.x line; 3.3.x still patched (3.3.3 on 2026-08-12) | 4.x targets Spark 4 (4.4 defaults to Spark 4.2); catalog-managed tables; UniForm alongside deletion vectors via IcebergCompatV3 (experimental) |
| Snowflake | SaaS | n/a | Iceberg tables GA (Jun 2024), Iceberg v3 GA (May 2026); Hybrid tables GA (Oct 2024); Gen2 warehouses GA (May 2025) and now the default; Dynamic Tables GA (Apr 2024) |
| BigQuery | SaaS | n/a | Editions (Standard / Enterprise / Enterprise Plus) replaced flat-rate, which could not be bought after 2023-07-05; Iceberg managed tables GA; history-based optimizations GA; continuous queries still **Pre-GA** overall |
| Databricks | SaaS | n/a | DLT → **Lakeflow Spark Declarative Pipelines** (not "Lakeflow Declarative Pipelines"); predictive optimization on by default; serverless GA; UC managed Iceberg tables |
| PostgreSQL | **18 (18.6 is the latest minor)**; 19 is at **Beta 4 (2026-09-24)** and not yet GA | 14–18 (14 ends 2026-11-12); **13 is EOL** | PG18: async I/O, uuidv7(), virtual generated columns (now the default), OAuth. PG17: failover logical slots, incremental backup, JSON_TABLE, MERGE…RETURNING |
| dbt | **dbt v2.0 released 2026-09-14** (PyPI `dbt` / `dbt-oss` 2.0.0; `dbt` at 2.0.6); dbt-core 1.12.5 (1.12.0 on 2026-07-16) | 1.12.x, 1.11.x and older 1.x lines still getting patches (Aug–Sep 2026) | Fusion is now "dbt"; Core v2 (Rust, Apache 2.0) is "dbt OSS"; ADBC adapters, no Python runtime; contracts came in **1.5** (not 1.8), unit tests in 1.8, microbatch in 1.9 |
| Apache Airflow | **3.3.2 (PyPI 2026-09-17)**; 3.0.0 (2025-04-22) | 3.x; **Airflow 2 EOL 2026-04-22** (from third-party sources; the official page did not confirm) | Assets (formerly Datasets); DAG versioning; Task SDK (`airflow.sdk`); execution_date and SubDAGs removed; catchup defaults to False |
| Great Expectations | **GX Core 1.23.1 (PyPI 2026-09-18)**; 1.0.0 (2024-08-22) | 1.x only; **0.18 and earlier sunset 2025-10-01** | Fluent data sources only; Validation Definitions + Checkpoints; typed Expectation classes; `context.<resource>.<method>` API |
| Debezium | **3.6.3.Final (2026-09-18)**; 3.6.0.Final (2026-07-01); 3.7.0.CR1 (Maven 2026-09-22) | 3.6.x current; others UNVERIFIED | Java 17 runtime baseline (Java 21 for Server, Operator and Quarkus Outbox); Kafka 4.x baseline in later 3.x releases; parallel single-table snapshot in 3.5 |


Per-technology notes and source URLs: see the claims appendix, section “Version research”.

## Section-by-section classification

Line numbers refer to the pre-upgrade article (commit 1a19d02).

### Parts 00–01 — Overview, Data Modeling

| id | Class | Problem | Proposed change | Reason | Size | Ext verify |
|---|---|---|---|---|---|---|
| p00-how-to-use-this | UPDATE | L103 says "Code samples are runnable" (many are illustrative or mixed-dialect). Versions are stale: Spark 3.5+, Flink 1.18+. | Say samples are engine-labelled and marked runnable or illustrative. Bump to Spark 3.5/4.x and Flink 1.20/2.x. Add a line: "each chapter ends with an Interview Card". | Accuracy; 2026 currency | ±0 | Y (current Spark/Flink GA) |
| p00-files | UPDATE | Part 09 "The Prep Program" (L7844, the largest part) is missing. Legacy `.md` filenames are shown as link text. Part 08 says "40+"; it has 47 h2s. | Add row 09. Replace `NN-name.md` with chapter titles. | Nav correctness | +1 row | N |
| p00-reading-paths | TIGHTEN | Doesn't mention 09. | Put 09 first in the "cramming" path. | Consistency | ±0 | N |
| p00-what-deep-means-here | TIGHTEN/UPDATE | Talks about a "previous deep dive/version" that the reader never saw. | Replace with a statement of the bar: "for each topic: mechanism, failure mode, how you'd debug it, how you'd defend it". | Serves the new goal | -50% | N |
| p01-1-bounded-vs-unbounded-data-at-rest | UPDATE/TIGHTEN | False Snowflake `REQUIRE_PARTITION_FILTER` (L229). The cb1 "Snowflake equivalent" (QUERY_TAG, resource monitors) is nonsense. The table's "always" rows are absolutist. Overlaps Part 02 §1 (L1440). | Fix the Snowflake claim. Keep the BigQuery DDL and delete the Snowflake lines. Cut the concept text and link to p02-1. | Wrong claims; duplication | -40% | N |
| p01-2-oltp-vs-olap--the-physical-reality | UPDATE/TIGHTEN | "No FK constraints" is outdated (declared RELY constraints are used by optimizers). HTAP list includes CockroachDB, which has no column store. Parquet internals duplicate Part 07/04. | Fix the two claims. Cut the Parquet encoding list to 2 lines plus a link. Keep the "denormalize in columnar" argument, which is interview-relevant. | Accuracy; dup | -30% | N |
| p01-3-normalization-derived-from-functional-dependencies | UPDATE/TIGHTEN | The BCNF example is actually a 2NF violation. 4NF/5NF paragraph is filler. | Use the correct BCNF example (student, course, instructor). Collapse 4NF/5NF to 1 line. | Correctness | -25% | N |
| p01-4-dimensional-modeling--kimball-in-full | UPDATE/BEEF UP | cb2 fact DDL fails on Postgres (PK on a partitioned table must include `dt`). `days_from_today` is a table column but commented "maintained via view". The bitrate comments are wrong (max uses MAX; weighted avg needs sum components). `qoe_score` is labelled a degenerate dim but it's a measure. cb4 recommends 64-bit Snowflake `HASH` for keys (collision risk). Surrogate-key content duplicates §14 (L1305). | Fix the DDL (PK `(session_key, dt)`, or drop PK and the PARTITION clause). Remove `days_from_today`. Fix the measure comments. Move "Why surrogate keys" + cb4 into a single merged §14. Add one "defend the star vs OBT in 60s" box. | Correctness; dedupe | -15% net | N |
| p01-5-fact-table-grain-the-most-important-decision | TIGHTEN/BEEF UP | The domain additivity cheat sheet (L543–561, 12 domains) is padding. The "look additive but aren't" table is gold. The accumulating snapshot here duplicates §17. The MRR fix says "always AVG across time" (usually you want period-end). | Delete the domain cheat sheet or cut it to 3 rows. Keep the "look additive" table. Merge §17 into here. Add a debugging drill: "dashboard total is 2× — find the grain bug" (fan-out join, SCD2 join without an as-of predicate, bridge without weight). | Padding → debug skill | -35% | N |
| p01-6-dimensions--conformed-junk-degenerate-mini-role-playing | KEEP/TIGHTEN | Junk-dim row math is fuzzy ("2x2x2x(sources) = ~16"). The bus-matrix `<pre>` has no id (cb8 is missing in the sequence). | Minor fixes. Add 1 line: role-playing views vs aliases in the semantic layer (dbt semantic layer / metrics layer). | Minor | ±0 | N |
| p01-7-slowly-changing-dimensions--all-seven-types-with-code | UPDATE/BEEF UP/TIGHTEN | "A single MERGE can't" do SCD2 is false (the staged-union MERGE is the documented Delta/Snowflake pattern). The "dialect-independent" script mixes Snowflake SHA2, PG `::`, and PG `nextval()`. The two statements are non-atomic, and the text doesn't warn about it. `COALESCE(x,'')` conflates NULL and ''. `valid_to=CURRENT_TIMESTAMP` uses processing time, not source change time. There are no duplicate-in-stage guards. SHA-256 vs MD5 is framed as a collision issue. GDPR "Type 1" ignores history rows and time travel. dbt snapshot uses legacy pre-1.9 syntax, is labelled yaml, and has no hard-delete handling. The per-attribute table (L830–885, ~50 rows) is padding. | Replace cb13 with a single-dialect (Snowflake or Spark) staged-union MERGE in a transaction, with a dedup step and a NULL-sentinel hash. Add a "4 SCD2 bugs" box: dup stage rows, NULL/'' collision, processing-time `valid_from`, overlapping intervals and a test for them. Show dbt 1.9+ YAML snapshot with `hard_deletes`. Mention Databricks `AUTO CDC ... STORED AS SCD TYPE 2` (formerly APPLY CHANGES). Cut the attribute table to about 10 rows plus the red-flag list. | Most-asked L5 modeling topic; currently wrong in places | ±0 (swap volume for depth) | Y (dbt 1.9+ config keys; Databricks AUTO CDC naming) |
| p01-8-date--time-dimensions-done-right | UPDATE | BigQuery `TIMESTAMP` is called naive (wrong). The pytz/ZonedDateTime claim is wrong. cb22 double-converts when `event_ts` is TIMESTAMPTZ. ISO week is paired with calendar year (trap not mentioned). Says "20 years" but code does 2010–2040. User tz treated as static (it's SCD). | Fix the claims. Add `isoyear`. Add the tz-at-event-time note. | Correctness | +1 para | N |
| p01-9-data-vault-20--when-and-why | UPDATE/TIGHTEN | "Hubs before sats" contradicts DV2 hash-key parallel loading. FKs in DDL contradict parallel load. No business-key normalization before hashing. Concurrent-source hub race not mentioned. "Zero refactor" and "50+ sources" are absolutes. DV 2.1 exists. | Fix the claims. Add the BK normalization and race notes. Cut pros/cons to a 4-row decision table. | Accuracy | -25% | Y (DV 2.1 specifics) |
| p01-10-one-big-table--the-columnar-revolution | UPDATE/TIGHTEN | cb27 DDL is a no-engine hybrid (Spark `PARTITIONED BY` + `CLUSTER BY` + PG `TIMESTAMPTZ`; on Databricks, liquid `CLUSTER BY` can't be combined with partitioning). "OBT storage often lower than star" is overstated. Star-vs-OBT duplicates Part 08 L7459. | Pick one engine (Databricks liquid clustering OR BigQuery `PARTITION BY dt CLUSTER BY a,b`). Soften the claim. Link to p08. | Correctness | -20% | N |
| p01-11-medallion-architecture-bronzesilvergold | UPDATE | Bronze promises "exactly once" and "idempotent by event ID" while cb29 is plain append. cb29 uses `.option("path", s3)` + `.partitionBy` on an Iceberg sink (the table defines the partition spec; use `.toTable()`). "Silver = Kimball star" is stated as universal. "Always rebuild from bronze" ignores retention and snapshot expiry. Iceberg v2 only (v3 is ratified). | Bronze = at-least-once, dedup key recorded, dedup in silver. Fix cb29 to `.toTable("cat.bronze.events")`. Note that the silver/gold split varies by org. Mention v3 deletion vectors. | Correctness; common interview probe | ±0 | Y (Iceberg v3 engine support status) |
| p01-12-null-semantics--the-silent-source-of-bugs | UPDATE/TIGHTEN | BigQuery LAG has no IGNORE NULLS. Null-safe equality engine list is incomplete (Snowflake/BigQuery support `IS NOT DISTINCT FROM`; Spark `<=>`). NULL ordering omits Spark/BigQuery/Snowflake. cb30 syntax is BigQuery-only and unlabelled. `NOT IN` + NULL is missing here (it's in p05 12.6). Overlaps p02-18 (L2540). | Fix the claims. Add a per-engine NULL ordering row. Merge with p02-18 or cross-link. | Accuracy; dup | -20% | N |
| p01-13-data-contracts--schema-evolution | UPDATE/BEEF UP | Custom YAML; no mention of ODCS (Open Data Contract Standard) or dbt model contracts (`contract: enforced`). Compatibility table uses "Backward" without defining direction (BACKWARD/FORWARD/FULL as in Schema Registry). "Iceberg and Delta both" but the bullets are Iceberg-only (Delta rename/drop needs column mapping). Overlaps p07-9, p08 L7541/L7568. | Define compatibility direction. Add a Delta column-mapping line. Mention ODCS + dbt contracts. Add pushback: "rename is metadata-only, so why did the dashboard break?" (consumers bind by name). | 2026 currency; precision | +1 para | Y (ODCS current version) |
| p01-14-modeling-checklist--anti-patterns | TIGHTEN/UPDATE | Several anti-patterns are OLTP-only in a warehouse chapter (partial index for soft-delete). "8 distinct values → mini-dim" should be junk dim and contradicts the columnar argument. "TIMESTAMP without tz = broken after DST" is overstated. Chapter footer "Next →" (L1300) sits here, but §14–17 follow it. | Fix the claims. Move the footer to the end of the chapter. Turn the checklist into a "design review defense" list. | Structure | -15% | N |
| p01-14-surrogate-key-strategies-in-depth | UPDATE (merge w/ §4) | Duplicate "14". The decision table rates hash keys "Good" for clustering (they're random, like UUIDv4). xxhash is called "collision-resistant". "Snowflake / BigQuery / Spark all agree" is false (BigQuery has no CONCAT_WS and MD5 returns BYTES; Snowflake CONCAT_WS returns NULL on any NULL arg while Spark skips NULLs; timestamp→string formats differ). | Renumber and merge with §4 "Why surrogate keys". Fix the table and claims. Add a NULL-token + explicit-format pattern. | Correctness; dedupe | -20% net | N |
| p01-15-bridge-tables-and-many-to-many-dimensions | UPDATE/BEEF UP | DDL comment says weight "optional"; text says "not optional". Missing: weights must sum to 1 per claim (test it); the Kimball "impact report" (unweighted) is sometimes the correct answer. | Fix the contradiction. Add a weight-sum test query + 1 line on impact vs allocated. | Classic probe | +1 para | N |
| p01-16-late-arriving-facts-and-dimensions | BEEF UP/UPDATE | Missing the core L5 point: late facts vs SCD2 dims need an as-of join on event_ts within [valid_from, valid_to), not `is_current`. Inferred member → "issue a new version (SCD2)" is wrong (Kimball: overwrite the inferred row in place, else facts point at an empty version). The orphan option omits the standard -1/"Unknown" member. "Both tables exist" is overstated. Overlaps p08 L7217 and Part 03. | Add an as-of join snippet. Fix the inferred-member rule. Add the unknown-member key. | Most-probed modeling/debug topic | +2 para | N |
| p01-17-accumulating-snapshot-fact-tables | TIGHTEN (merge into §5) | Duplicates §5 cb6 with inconsistent naming (fact_/fct_, _key/_sk). "current_status makes recovery straightforward" is hand-wavy. Missing: out-of-order milestone events, which need a monotonic, idempotent MERGE (`COALESCE(t.x, s.x)` / `LEAST`). | Merge into §5 and keep only the MERGE idempotency point + code. | Dedupe | -60% | N |

---

### Part 02 — Batch Processing

| id | Verdict | Problem | Proposed change | Reason | Size Δ | Ext. verify |
|---|---|---|---|---|---|---|
| p02-1-mental-model-bounded-vs-unbounded-data-deep | TIGHTEN | Taxonomy ("3 dimensions of boundedness") is academic. cb2 claims an Iceberg incremental read gives "changes", but it only returns appends. `datetime.utcnow()` is deprecated in Python 3.12. | Cut the 3-dimension list to 2 lines. Keep "implicit watermark + safety buffer + assert". Fix the cb2 comment. Add a one-line interview framing: "How do you know yesterday is complete?" → `_SUCCESS`/manifest, upstream audit counts, grace window. | Interview value is the completeness contract, not the taxonomy | −30% | N |
| p02-2-anatomy-of-a-batch-job | KEEP, TIGHTEN | 11-stage list plus two skeletons is long. cb4 references `ctx.expected_min_rows` (not in RunContext) and `F`, which is never imported. Three `.count()` actions in validate means three full scans. | Keep the stage list. Merge cb3 and cb4 into one shorter block. Add a "cost of validation" note: cache or use one aggregate pass (`count`, `countDistinct`, `sum(isnull)` in a single `agg`). Say "WAP (write-audit-publish)" by name: Iceberg branches / `spark.wap.id`, Delta shallow clone, Snowflake zero-copy clone. | WAP is the 2026 term interviewers use | −10% | N |
| p02-3-idempotency--proofs-and-patterns | UPDATE, VERIFY | Pattern 1 uses the non-existent Iceberg option `replace-where`. The formal definition's notation is garbled. It doesn't cover *effectively-once* for non-deterministic sources (dim lookups at run time, `current_date`, reading a moving table without pinning a snapshot). | Fix cb5 (see §2). Fix the formula. Add "pin input snapshot/version id in the audit log so reruns read the same input". Add "idempotent ≠ deterministic" (MERGE is idempotent but non-deterministic if source dedupe ties on `updated_at`). | Classic senior follow-up: "your rerun reads a table that changed overnight" | +10% | N |
| p02-4-merge-under-the-hood | UPDATE, TIGHTEN, VERIFY | COW/MOR table mislabels versions ("default in Iceberg v1"). Delta described with positional/equality delete files (Delta uses deletion vectors). No Iceberg v3 deletion vectors. "10 GB file" is unrealistic. Partition-pruning claim is overstated. Metric name is wrong (`numOutputRows`). Duplicates Part 07 §6 (p07-6-merge-under-the-hood-cow-vs-mor) and §18. | Keep the logical model, multi-match rule and dedupe patterns (interview gold). Move COW/MOR internals into Part 07 and leave a 3-line summary + link. Fix version claims. Add "why MERGE is slow" debugging: full target scan (no pruning predicate), source not deduped, skewed join key, too many small target files. | Reduce duplication; fix facts | −25% | Y (Delta DV defaults, repartitionBeforeWrite default) |
| p02-5-incremental-processing-patterns | UPDATE, BEEF UP | The HWM clock-skew fix is backwards. HWM code appends after widening the window, so reruns produce duplicates. Iceberg incremental read is append-only, which isn't stated. `exactly-once` is unqualified. No coverage of the late-commit / long-transaction trap. | Fix claims (§2). Add a 4-line "HWM failure modes" box: (1) late commits with earlier `updated_at`, (2) ties at the boundary (`>` vs `>=`), (3) clock skew, (4) HWM stored separately from data. Add Iceberg `create_changelog_view` and Delta CDF (must be enabled first). Mention `Trigger.AvailableNow` needs Spark 3.3+. | Most-asked incremental question | +15% | N |
| p02-6-backfills--design-safety-and-throttling | UPDATE, VERIFY | `airflow dags trigger -p` isn't a real flag. No Airflow 3 native backfill (`airflow backfill create`, scheduler-managed, `--max-active-runs`, reprocess behavior). SCD2 sentence is ambiguous. ThreadPool driver duplicates what the orchestrator does. The "$50k" figure is unsourced. | Fix the CLI. Add Airflow 3 backfill. Keep the correctness bullets (they're the interview meat) and add "backfill writes must not trigger downstream dataset/asset events that fire prod consumers N times" and "freeze dims or use as-of joins". Drop or shorten the ThreadPool block. Overlaps Part 08 "Quality: How do you backfill safely?". | Airflow 3 GA since Apr 2025 | ±0 | Y (Airflow 3 backfill CLI flags) |
| p02-7-file-format-internals--parquet-orc-avro | TIGHTEN, UPDATE | Defaults are stated universally when they're parquet-java-specific. "PLAIN — no compression" is wrong. LZ4 vs LZ4_RAW isn't distinguished. Page index is missing. Bloom filter version is wrong. The ORC/Avro detail is low-yield for L5. | Keep Parquet anatomy + read path (high-yield: "why is SELECT * slow", "why doesn't my filter prune"). Fix defaults and name the writer. Add page index (ColumnIndex/OffsetIndex). Collapse ORC to 2 lines. Avro: keep only "row format + writer/reader schema resolution, used in Kafka + schema registry". | Fewer, correct facts | −25% | Y (Parquet bloom filter version, pyarrow row-group default) |
| p02-8-partition-design-math | UPDATE, VERIFY | Iceberg partition evolution syntax is invalid (Spark uses `ADD/DROP/REPLACE PARTITION FIELD`). The BETWEEN example contradicts its own pruning comment. The pruning walkthrough mixes a Hive `dt` column with Iceberg hidden partitioning. Nothing on Delta Liquid Clustering, Iceberg SPJ, BigQuery partition limits or Snowflake micro-partitions. Sizing guidance conflicts with §17. | Fix SQL (§2). Add a 2026 "don't partition small tables; <1 TB → cluster only" line (Databricks guidance). Liquid clustering replaces partition+ZORDER for new Delta tables. BigQuery: partition + cluster, per-table partition cap. Snowflake: no user partitions, clustering keys only. Merge §17's sizing heuristic here; keep one number range. | Correctness; the 2026 layout story is clustering-first | ±0 | Y (BQ partition limit, Databricks liquid guidance wording) |
| p02-9-small-files-and-compaction | UPDATE, BEEF UP | AQE claim is overstated (only affects post-shuffle partitions). The `coalesce` trap isn't stated. No Iceberg `write.distribution-mode`, `rewrite_manifests`, `remove_orphan_files` or `rewrite_position_delete_files`. Retention advice is poor. Duplicates Part 07 §7/§18. | Fix claims. Add "maintenance quartet" (compact data, compact deletes, rewrite manifests, expire snapshots + orphan cleanup) with one incident each. Point to Part 07 for Z-order/bin-pack internals. | High-frequency debug question: "reads got 10x slower over 3 months" | +5% | N |
| p02-10-cdc-change-data-capture-patterns | BEEF UP, UPDATE, VERIFY | The core CDC chapter for L5, and its code is wrong (see matrix below). | Rebuild as: (1) approaches matrix (full snapshot / timestamp polling / trigger-audit table / log-based / warehouse-native: Snowflake Streams, Delta CDF, BigQuery CDC upserts via `_CHANGE_TYPE`, Datastream), (2) bootstrap + snapshot-to-stream handoff, (3) ordering + idempotency (LSN, per-key partitioning, dedupe per micro-batch), (4) deletes/tombstones/soft-delete, (5) schema change, (6) transactions, (7) corrected foreachBatch MERGE, (8) reconciliation. Cut the prose pros/cons lists. | Most-probed L5 topic after modeling | +60% | Y (Debezium field semantics/config names) |
| p02-11-data-quality-in-batch-pipelines | UPDATE, TIGHTEN | GX code is the 0.17/0.18 API (GX 1.x since 2024 changed the API). SodaCL `values in (...) must be in` isn't valid syntax. dbt `tests:` is now `data_tests:` (1.8+). Heavy overlap with Part 12 (Data Quality) and Part 08 Observability. | Keep the taxonomy table and "what to check" list. Delete the GX and Soda blocks (or fix them and move to Part 12). Keep dbt YAML with `data_tests:`. Add blocking vs warning policy + where the check runs (pre-publish gate in WAP). | Stale tool APIs are the fastest way to lose credibility | −40% | Y (GX 1.x API, SodaCL syntax) |
| p02-12-orchestration-patterns-for-batch | UPDATE | Airflow SLA (`sla`, `sla_miss_callback`) was removed in Airflow 3.0 (Deadline Alerts arrive in 3.1). Datasets were renamed to Assets. The "Never same DAG" rule is dated. The sensor example uses poke mode (holds a worker slot for 4 h). The "Next:" footer is misplaced here. | Replace the SLA block with Airflow 3 Deadline Alerts / external freshness monitors. Datasets→Assets (`airflow.sdk.Asset`). Sensor: `mode="reschedule"` or `deferrable=True`. Dagster: mention partitions + asset checks. Move the "Next:" footer to the end of §18. | Airflow 3 is current | ±0 | Y (Airflow 3.1 Deadline Alerts API) |
| p02-13-dependency-graphs-and-critical-path | KEEP, TIGHTEN | Good interview framing. Says "adjacency matrix" but claims O(V+E). Code is actually O(V·E) (scans all edges per node, `pop(0)`). "Exactly which five tasks" is filler. h3s have no ids. | Fix the complexity text or the code (adjacency list + deque). Add: after you shorten the critical path, a *new* critical path emerges; the levers are also removing false dependencies and starting on data-readiness sensors instead of fixed cron. | Accuracy; stronger answer | ±0 | N |
| p02-14-batch-cost-model | UPDATE | Egress math is wrong (2 TB × $0.02 ≈ $40, not $900). "600x swing" comes from the wrong number. "Shuffle 2–4x input" is overstated. The runtime is implausible (30 TB shuffle on 100 vCPU in 40 min). It omits platform premium (DBU/EMR), S3 request costs and EBS. "Glacier ~1/10" is imprecise. Overlaps Part 11. | Recompute (§2). Present as a *method* (bytes scanned × passes; vCPU-h; platform multiplier; egress/requests) with a correct worked example. Label prices "us-east-1 list, 2026, verify". | Arithmetic errors are fatal in a senior interview | ±0 | Y (current AWS list prices) |
| p02-15-parallelism-math-and-the-skew-tax | UPDATE | `RAND(10)` salting is wrong (in Spark, 10 is the seed and the result is in [0,1)). The other side isn't replicated. AQE defaults and conditions aren't stated. Duplicates Part 04 §7 (p04-7-skew-detection-splitting-salting-aqe-handling). | Keep the skew-tax arithmetic (good). Fix salting. Replace mitigations with a link to Part 04 §7 plus 2 lines. | Dedupe; fix code | −40% | N |
| p02-16-checkpoint-and-restart-semantics | KEEP, UPDATE | "atomic rename" isn't atomic on S3/GCS. The "restart at noon" drill is excellent but lacks the key item: downstream jobs that already ran on missing/partial input must be re-triggered. | Fix the rename claim. Add to the drill: dependents that already consumed stale data, dedupe of downstream appends, communication. | High interview value | +10% | N |
| p02-17-partition-key-decision-examples | TIGHTEN | 18-row table is padding-ish. The sizing heuristic contradicts §8 (100 MB–10 GB vs "hourly keeps partitions under ~1 TB" vs "1 TB/day is ideal"). The "bucketed-id trick" duplicates §8 "Bucket partitioning" and the cb32 example. | Cut to ~8 rows (events, orders, ledger, CDC log, IoT, catalog, snapshots, features). Merge sizing into §8 with one consistent rule. Delete the duplicate bucket block. | Duplication + contradiction | −50% | N |
| p02-18-null-semantics-by-domain | TIGHTEN | Overlaps Part 01 §12 (p01-12-null-semantics--the-silent-source-of-bugs). The "-1 sentinel for scores" advice is risky (poisons AVG/MIN). The "Q4 in Part 09" reference is plain text, not a link (that h3 has no id). | Move the table into Part 01 §12 or trim to 5 rows. Fix the sentinel advice. Add an id to Part 09 Q4 and link it. | Duplication | −50% | N |

### CDC depth check (p02-10)

| Topic | Present? | Notes |
|---|---|---|
| Full snapshot | Yes | Claims "guaranteed correctness", but 20 parallel JDBC reads aren't a consistent snapshot |
| Timestamp/`updated_at` polling | Yes | Misses: late-commit/long-transaction trap, `>` vs `>=` ties, needs index on `updated_at`, updates to `updated_at` by triggers vs app |
| Trigger/audit-table CDC | **Missing** | Should be one line: write amplification on OLTP, but works where log access is denied |
| Log-based CDC | Partial | Postgres/MySQL/SQL Server named. No slot/WAL-retention risk, no `REPLICA IDENTITY FULL`, no `binlog_row_image=FULL`. Claims "without touching the source" (false) |
| Warehouse/lakehouse-native CDC (Delta CDF, Snowflake Streams, BigQuery `_CHANGE_TYPE`, Iceberg changelog view, DLT/Lakeflow `AUTO CDC`/`APPLY CHANGES`) | **Missing** (CDF only in §5) | 2026 interviews expect "I'd use APPLY CHANGES / Streams instead of hand-rolled MERGE, and here's what it does for ordering" |
| Snapshot / bootstrap | Minimal (`r` op mentioned) | Missing: initial snapshot + stream handoff (snapshot at LSN X, then stream from X), Debezium `snapshot.mode`, incremental snapshots via signal table (watermark-based, chunked, re-snapshot a single table), backfilling a new column |
| Schema changes | One bullet ("breaks pipelines") | Missing: schema registry compatibility modes, Debezium schema-history topic, additive vs breaking, Delta `mergeSchema`/`autoMerge`, Iceberg schema evolution by field id, column rename/type widening, PK changes (Debezium emits delete + create) |
| Deletes / tombstones | Partial | Hard deletes captured. Missing: Kafka tombstone (null value after `d`, for log compaction), which breaks `from_json` parsing. Soft-delete vs hard-delete in target. `t` truncate op. GDPR deletes propagating to history |
| Ordering | Partial, **wrong key** | Uses envelope `ts_ms` (connector processing time). Should use source LSN / binlog pos (+ `source.ts_ms` for display). Missing: per-key ordering via Kafka partition by PK, cross-partition/topic no order |
| Transaction boundaries | **Missing** | Debezium `provide.transaction.metadata` (BEGIN/END events, `transaction.id`, `data_collection_order`). Multi-table consistency (order + order_lines half-applied). Micro-batch boundary ≠ transaction boundary |
| Idempotency | Partial | ts guard on updates only. Missing: foreachBatch is at-least-once (replayed `batch_id`), dedupe within micro-batch (multi-match error), guard on deletes, Delta `txnAppId`/`txnVersion` for idempotent foreachBatch writes |
| TOAST / unchanged large columns | **Missing** | Postgres emits `__debezium_unavailable_value` placeholder when REPLICA IDENTITY isn't FULL. A classic silent-corruption incident |
| Reconciliation | **Missing** | Periodic count/checksum per PK range vs source. Proves CDC isn't silently dropping |
| CDC → SCD2 | 2 sentences | Link to Part 08 "Design: SCD Type 2 ingestion from Kafka CDC" (line ~7310). Don't duplicate |

---

### Part 03 — Streaming Processing

| # | h2 id (line) | Verdict | Problem | Proposed change | Reason | Est. size | Ext. verify |
|---|---|---|---|---|---|---|---|
| intro | (2571) | TIGHTEN | Says "This file", which is left over from the Markdown source. Promises "proofs". | Say "This part". Add one line on versions: "Examples use Flink 1.18–1.20 DataStream APIs unless marked; Kafka 4.x is KRaft-only." | Leftover wording; the version frame is missing everywhere else | +1 line | N |
| 1 | `p03-1-unbounded-data--what-actually-changes` (2574) | KEEP | Solid framing. The Beam What/Where/When/How block is good. | None, or cut "Naming them explicitly clarifies…" | — | −1 line | N |
| 2 | `p03-2-the-three-times-event-processing-ingestion` (2597) | UPDATE | "ET ≤ IT ≤ PT always" is false: producer clocks skew, and Kafka `CreateTime` is set by the client. The p99.9/p99.99 buckets and "drops ~1%" are made-up numbers presented as universal. | Replace the invariant with "Causally ET ≤ IT ≤ PT, but the timestamps you see can violate it (client clock skew, `CreateTime` vs `LogAppendTime`). Clamp future timestamps." Soften the percentile claims to "example distribution". | Clock skew is a classic interview probe | +2 lines | N |
| 3 | `p03-3-watermarks--math-and-mechanics` (2627) | UPDATE + BEEF UP | (a) Section 3 sizes B from `processing_time − event_time`, but B bounds *out-of-orderness* (`max_ET_seen − ET`), not end-to-end delay. During a backlog replay, PT−ET is hours while out-of-orderness stays small. (b) `forMonotonousTimestamps()` listed as a fix for a stalled source is wrong. (c) The punctuated-generator description has onEvent and onPeriodicEmit backwards. (d) Watermark alignment (`withWatermarkAlignment`, Flink 1.15+) is missing; it is the real fix for fast/slow source skew. (e) Flink actually emits `max − B − 1ms` (minor). (f) The "perfect watermark" example is dubious. | Fix (a)–(c). Add a 4-line "watermark alignment + idleness + per-split watermarks in FLIP-27 sources" block. Add "watermark does not advance with no data; idleness ≠ progress". | Most probed topic in the part; the core of the sizing advice is wrong | +8 lines | N |
| 4 | `p03-4-windows--types-state-and-trade-offs` (2694) | UPDATE | Every Flink snippet uses `Time.minutes(..)`. `org.apache.flink.streaming.api.windowing.time.Time` is deprecated in 1.19 and removed in 2.0; use `Duration`. Session-window state is stated as O(events), which only holds for `apply`/`process`, not `aggregate`. The sliding-window "emulate with tumbling + rollup" tip is good. | Switch to `Duration.ofMinutes(..)` or add a note "(Flink ≤1.x: `Time.minutes`)". Qualify session state. | Code does not compile on Flink 2.x | ~0 | N |
| 5 | `p03-5-triggers-and-emission-policy` (2767) | UPDATE | cb11 is a non-working snippet: `EventTimeTrigger` has a private constructor, so "custom Trigger extending EventTimeTrigger" is not possible. It does not name `ContinuousEventTimeTrigger` / `ContinuousProcessingTimeTrigger`, or Flink SQL `table.exec.emit.early-fire.*` (experimental), or Spark output modes (append / update / complete), which are Spark's equivalent of triggers. | Replace cb11 with a real `Trigger<Object,TimeWindow>` skeleton, or cut it to prose and name the built-ins. Map accumulation modes → Spark `update` / Flink changelog. | Candidate-visible bug | ±0 | N |
| 6 | `p03-6-late-data-strategies` (2795) | TIGHTEN | "Drop (default in Spark)": Spark only guarantees *not* dropping data inside the threshold; data beyond it "may or may not" be dropped. cb13 uses `addSink`, which is removed in Flink 2.0 (use `sinkTo`). "Measuring lateness" repeats section 3 with the same PT−ET conflation. The dual-path reconciliation duplicates section 13's "pragmatic middle". | Fix the Spark semantics. Merge "measuring lateness" into section 3 and show two metrics: delay (PT−ET) and out-of-orderness (maxET−ET). | Accuracy; dedupe | −6 lines | N |
| 7 | `p03-7-delivery-semantics-proved` (2837) | UPDATE + BEEF UP | (a) The claim "Spark Kafka sink uses Kafka transactions" is **wrong**: the Structured Streaming Kafka sink is at-least-once. (b) "Three necessary conditions … any one missing and EO fails" contradicts the idempotent-sink subsection 40 lines later, where an idempotent sink replaces the atomic commit. (c) The file sink "two-phase commit with a `commits/` log" conflates the checkpoint's `commits/` log with the sink's `_spark_metadata` / Delta `txnAppId+txnVersion` / Iceberg snapshot idempotence. (d) cb15 Iceberg `writeStream…start()` has no table identifier (needs `.toTable("db.t")`). (e) Flink checkpoint steps say "sinks ack". In fact *all tasks* ack to the CheckpointCoordinator, and barriers are injected at source tasks. (f) The ABS vs Chandy-Lamport nuance is missing. (g) There is no "WHEN is EO worth it" guidance. | Fix (a)–(e). Add a 6-row "When exactly-once is meaningful" table: stateful aggregates to an append sink = yes. Upsert by deterministic key = at-least-once is enough. External side effects (email, payments API) = EO impossible; use idempotency keys. Latency cost = output visible only per checkpoint. Duplicates upstream = EO doesn't dedupe. Non-deterministic logic = breaks replay. | Highest-value topic for L5; currently contains a factual error | +12 lines | N |
| 8 | `p03-8-flink-internals--dataflow-barriers-state` (2939) | UPDATE | (a) Architecture: "Dispatcher spawns JobManagers per job". The Dispatcher starts a **JobMaster** per job, inside the JobManager process. (b) "HashMapStateBackend: synchronous checkpoints (pauses JVM)" is **wrong**: it snapshots asynchronously (copy-on-write). (c) cb19 `env.addSource(kafkaSource)` would not compile with the FLIP-27 `KafkaSource`, and `addSource` is removed in 2.0 (cb34 already uses `fromSource`, so the part is internally inconsistent). (d) cb20 uses `open(Configuration)`, `Time.hours`, and the default-value `ValueStateDescriptor` constructor, all 1.x-only. (e) State migration omits the **State Processor API**, which is the actual tool. "Avro (auto)" should be "POJO and Avro types support schema evolution; Kryo does not". (f) Nothing on Flink 2.x: ForSt/disaggregated state, deprecated config setters. | Fix (a)–(e). Add a 3-line "Flink 2.x deltas" note. | Version accuracy | +4 lines | Y (2.x API names) |
| 9 | `p03-9-kafka-internals--isr-controllers-exactly-once` (3014) | UPDATE (major) | ZooKeeper-era framing: "one broker is the controller (elected via ZooKeeper or KRaft)", "ZooKeeper session expiry". The KRaft line "Default in new deployments from 2024 onward" is outdated: Kafka 4.0 (Mar 2025) removed ZooKeeper entirely. "Controller propagates … to producers" is wrong: clients discover leaders via metadata refresh after `NOT_LEADER_OR_FOLLOWER`. The claim "first in the ISR list" is imprecise (it is the first live, in-ISR replica in *assignment* order). acks=1/all "persist" means page cache, not fsync. "Leader handles reads" ignores follower fetching (KIP-392). Rebalance covers only eager and cooperative: it is **missing KIP-848** (`group.protocol=consumer`, GA in 4.0, where `partition.assignment.strategy` does not apply), static membership (`group.instance.id`), and the `max.poll.interval.ms` rebalance storms. Transaction content duplicates section 16. cb23 uses the `sendOffsetsToTransaction(Map,String)` overload, which is deprecated in favour of `consumer.groupMetadata()`. The catch-all `abortTransaction()` is wrong for `ProducerFencedException`, where you must close. | Rewrite the controller subsection KRaft-first, with a ZK note: "≤3.9 only". Add KIP-848 + static membership. Add "producer defaults since 3.0: `acks=all`, `enable.idempotence=true`". Move all EOS content into section 16. Mention ELR (KIP-966) and share groups (KIP-932) in one line each. | Explicit brief requirement (Kafka 4.x); most-outdated section | +10 lines, −15 (move EOS) | Y (KIP-848/932/966 GA versions; removal of String overload) |
| 10 | `p03-10-streaming-joins` (3118) | TIGHTEN | Good coverage. `Time` API again. The temporal join needs a versioned table (PK + watermark) and a time-attribute column. The lookup join (`FOR SYSTEM_TIME AS OF o.proc_time`) is not distinguished from the event-time temporal join. No mention of state TTL for regular (unbounded) SQL joins (`table.exec.state.ttl`). | Add 3 lines: temporal vs lookup join; regular-join state is unbounded without TTL. | Common production incident | +3 | N |
| 11 | `p03-11-state-management-at-scale` (3157) | TIGHTEN | "Full-snapshot cleanup" only filters expired entries out of the snapshot; it does not shrink local state and does not apply to incremental RocksDB. "100 GB heap is infeasible" ignores that state is spread across N TaskManagers (e.g. 50 TMs × 2 GB each is feasible; the real limits are GC and snapshot cost). cb30 never initialises its state handles, so it would throw an NPE. It also assumes in-order events. State-partitioning evolution should name the State Processor API. | Correct the claims; label cb30 "illustrative". | Accuracy | ±0 | N |
| 12 | `p03-12-backpressure-and-flow-control` (3227) | BEEF UP | Covers Flink only. The diagnosis rule "the operator showing HIGH, its downstream is the bottleneck" is incomplete: the bottleneck is the first downstream operator that is *not* backpressured but has high `busyTimeMsPerSecond`. `inputQueueUsage` is not a Flink metric (the real ones are `inPoolUsage`/`outPoolUsage`, `backPressuredTimeMsPerSecond`, `busyTimeMsPerSecond`). "Enable unaligned in production where backpressure is possible" is too broad. Missing: buffer debloating (1.14+), aligned-checkpoint timeout (hybrid), and the whole **producer → broker → consumer → sink** chain. Kafka *decouples* producers from consumers: backpressure turns into lag, and lag beyond `retention.ms` is silent data loss. | Add a chain table (see §1b below). Fix the metrics and the diagnosis rule. | Brief-listed coverage gap | +15 lines | N |
| 13 | `p03-13-lambda-vs-kappa-revisited` (3256) | TIGHTEN | Fine but generic. It overlaps section 6 (dual-path) and the Part 08 Q at L7633 ("Lambda architecture in 2026?"). | Cut to about 8 lines. Add Kappa's real cost: replay throughput and retention/tiered storage (KIP-405) or lakehouse replay. Cross-link L7633. | Dedupe | −8 | N |
| 14 | `p03-14-streaming-pipeline-example-end-to-end` (3287) | UPDATE | The diagram shows Iceberg bronze and Redis fed from Kafka(sessions), while the code writes Iceberg *silver* directly from Flink and has no Redis. `SessionAggregator.add` sets `startTs` from the *first-arriving* event, not `min(eventTime)`, which is wrong for out-of-order input. `IcebergSink.forRowData(...)` is fed `PlaybackSession`, not `RowData`. "distribution mode hash … avoids skew" is wrong: HASH clusters by the Iceberg partition key to cut small files and can *cause* skew. The EXACTLY_ONCE KafkaSink is shown without `transaction.timeout.ms` (must be > checkpoint interval + recovery time and ≤ broker `transaction.max.timeout.ms`, default 15 min), and without noting that read_committed consumers see output only once per checkpoint. The late-event sink has no delivery guarantee set. "Consumer lag (committed offset)": Flink commits offsets only on checkpoint, so use the source `pendingRecords` metric. `setStateBackend`/`setCheckpointStorage(String)` are deprecated in favour of config in 1.19+/2.x. | Fix the diagram, the `startTs` bug and the HASH claim. Add a 3-bullet "EO sink config traps" list. | High-visibility example | +5 | Y (KafkaSink default txn timeout; 2.x setter status) |
| (gap) | `p03-15` missing (3451–3456) | STRUCTURE | Section 14 ends with `<hr/>` and "Next: `04-spark-internals.md`" (a Markdown artifact). Sections 16–21 are then appended after it. No section 15. | Delete the "Next:" line (or move it to the end of the part) and renumber 16→15 … 21→20. | Reader-visible seam | −2 | N |
| 16 | `p03-16-idempotent-producers-and-eos-in-kafka` (3457) | UPDATE | "The producer writes a transaction marker to each affected partition's commit-coordinator": wrong. The **transaction coordinator** writes COMMIT/ABORT control markers to each partition. "Aborted transactions leave tombstone markers": wrong. They leave abort *control records*; "tombstone" means a null-value compaction record. "Flink's TwoPhaseCommit sink implements this pattern (sendOffsetsToTransaction)": wrong. Flink keeps source offsets in its checkpoint and commits pre-committed Kafka transactions on checkpoint-complete. Kafka Streams `exactly_once_v2` is what uses `sendOffsetsToTransaction`. The zombie bullet should also cover the opposite bug: a random `transactional.id` per restart means *no* fencing. Missing: LSO / hanging transactions stalling read_committed consumers, `transaction.timeout.ms`, KIP-890 (4.0) server-side defence. | Fix the claims. Absorb section 9's EOS subsection and section 7's "idempotent sink" here, or cross-link them. | 3 factual errors | +4 | Y (KIP-890 phase status in 4.x) |
| 17 | `p03-17-complex-event-processing-and-match-recognize` (3483) | TIGHTEN | CEP `within(Time…)` is 1.x. Flink MATCH_RECOGNIZE supports a `WITHIN INTERVAL '10' MINUTE` clause, which is cleaner than the DEFINE predicate and lets state be pruned. The ATO probe advises "a 30-minute watermark", which conflates the pattern window with watermark delay: every alert would be delayed 30+ minutes. | Use `WITHIN`. Change the probe to "pattern WITHIN 30 min; watermark delay sized to out-of-orderness (seconds)". | Wrong advice in a "strong answer" | ±0 | N |
| 18 | `p03-18-stream-table-duality-in-depth` (3518) | TIGHTEN | Duplicates section 10 (temporal join) and section 9 (compaction). "Stream-stream join … late arrivals produce retractions": wrong for window/interval joins, where late rows are dropped. Retractions come from *regular* (non-windowed) outer joins. | Merge into section 10, or cut to about 5 lines of the duality idea plus the KTable/Flink changelog modes (+I/−U/+U/−D). | Dedupe + accuracy | −6 | N |
| 19 | `p03-19-stateful-functions-and-application-patterns` (3541) | TIGHTEN / VERIFY | Flink Stateful Functions (StateFun) is effectively unmaintained (no release since 3.3 in 2023). Pattern A stores a "list of events", which contradicts section 14's O(1) incremental advice. | Drop the StateFun mention. Keep Patterns B and C (the state machine plus DLQ is good). Fix Pattern A. | Outdated reference | −2 | Y (StateFun status) |
| 20 | `p03-20-amazon-kinesis` (3559) | UPDATE | "Kinesis Data Firehose" was renamed **Amazon Data Firehose** (Feb 2024). The Firehose buffer interval now goes down to 0 s (zero-buffering), so "not suitable for sub-minute" is outdated. "Databricks or EMR Flink cluster": Databricks does not run Flink. The claim "at five consumers polling 200 ms … throughput-limited" has the wrong cause: the limit is **5 GetRecords calls/s/shard** (plus 2 MB/s). EFO "1.5× cost premium" is not a pricing fact. The 1,000 records/s/shard write limit is omitted. Max record size was raised to 10 MiB in 2025 (verify). "Partition reassignment (offline …)": Kafka reassignment is online. "ZK/KRaft" should be KRaft (4.x). Lambda `ParallelizationFactor` (up to 10) is missing from the lagging-Lambda probe. | Correct the table and prose. Add an on-demand vs provisioned note. | Explicitly flagged in brief (Kinesis limits) | +3 | Y (10 MiB record, EFO limits, Firehose 0 s) |
| 21 | `p03-21-event-driven-architecture` (3602) | TIGHTEN | Good content. "Outbox is the only correct way …" is overstated: log-based CDC on the business table itself (or event sourcing) also works. The relay "marks rows as sent" is not how Debezium's outbox router works (it tails the WAL; rows are deleted or left to be cleaned up). "Staff-level" is off-level for an L5 book. Testing: prefer Testcontainers over LocalStack for Kafka. | Soften "only". Add a Debezium outbox note. | Accuracy | ±0 | N |

### 1b. Coverage assessment (requested topics)

| Topic | Present | Missing |
|---|---|---|
| Delivery semantics | Definitions of at-most/at-least/exactly (2842–2844), the "effectively exactly-once" framing (2848), what EO does not guarantee (2920–2926), idempotent sink (2927) | **When EO is meaningful vs wasted** (upsert sinks, deterministic keys, the latency cost of per-checkpoint visibility). External side effects are covered only in section 16. The contradiction between the "3 necessary conditions" and the idempotent-sink section. The "effectively-once = at-least-once + idempotent/dedup" formula is stated but not contrasted with transactional EO (the cost trade-off). Kafka Streams `exactly_once_v2` and Spark `foreachBatch` + batchId idempotence are not covered. |
| Ordering guarantees | Per-partition/per-shard ordering (Kinesis table 3575, 2685), ordered vs unordered async I/O (3156), "EO ≠ ordering across keys" (2922) | Idempotent producer preserves order with `max.in.flight ≤ 5`. Without idempotence, retries reorder. Adding partitions remaps keys and breaks per-key order. `keyBy` keeps per-key order between two operators only. Parallel sink writes reorder. Rebalance/replay re-delivers old records after newer ones. Kinesis `SequenceNumberForOrdering`. **No dedicated subsection.** |
| Backpressure chain producer→broker→consumer→sink | Flink credit-based flow, UI diagnosis, unaligned checkpoints (3227–3255) | Producer (`buffer.memory`, `max.block.ms`, `linger.ms`/`batch.size`, `delivery.timeout.ms`); broker (quotas, request-queue saturation, ISR shrink under disk pressure); consumer (lag → retention loss; `max.poll.records` and `max.poll.interval.ms`); Spark `maxOffsetsPerTrigger` / admission control; sink (JDBC/warehouse throttling, Async Sink rate limiting); buffer debloating. **Key point to add: Kafka is the shock absorber, so backpressure turns into lag, not producer slowdown.** |
| Consumer-group rebalancing | Eager vs cooperative-sticky (3076–3093) | **KIP-848 next-gen protocol (GA Kafka 4.0)**, static membership, `session.timeout.ms` / `heartbeat.interval.ms` / `max.poll.interval.ms` failure modes, committing on `onPartitionsRevoked`, rebalance-induced duplicates. Also a trap: **Flink's KafkaSource does not use group rebalancing** (its split enumerator assigns partitions; `group.id` is only for committing offsets). Share groups (KIP-932) break "consumers ≤ partitions". |

---

### Parts 04–05 — Spark Internals, SQL Deep Dive

### Part 04 — Spark Internals (3663–4710)

| h2 id | Verdict | Problem | Proposed change | Reason | Est. size Δ | Ext. verify |
|---|---|---|---|---|---|---|
| p04-contents | UPDATE | Lists 1–14 only; omits 17–20 | Add 15–18 (after renumbering) | Nav completeness | +4 li | N |
| p04-1-the-layered-architecture… | KEEP/TIGHTEN | `explain(mode="cost")` "post-AQE" is wrong (3700) | Fix comment; add `EXPLAIN FORMATTED` SQL form | Correctness | ±0 | N |
| p04-2-catalyst… | UPDATE | Rule-batch table has wrong entries: "Finish Analysis" lists analyzer rules, DecimalAggregates is mis-described, ConvertToLocalRelation is vague. Push-down checklist is fine but misses DPP and runtime bloom filters | Fix three table rows. Add a 2.5 section on runtime pruning: DPP (3.0, default on) and runtime bloom-filter join (3.3, default on) | Correctness; DPP is a top L5 question and is absent from the whole file (grep: 0 hits) | +10 lines | N |
| p04-3-the-cost-model… | TIGHTEN | Claims CBO is needed for BHJ at plan time; it is not | One-sentence fix; note `cbo.joinReorder.enabled` is also off by default | Correctness | ±0 | N |
| p04-4-adaptive-query-execution… | UPDATE / BEEF UP | Coalesce pseudo-code sorts by size (wrong: only contiguous partitions merge). Omits `parallelismFirst=true`, the biggest AQE trap. Dynamic-join config is wrong. "40 MB under threshold" contradicts the 10 MB default. `CustomShuffleReader` was renamed in 3.2. Missing: AQE SMJ→SHJ (`maxShuffledHashJoinLocalMapThreshold`), REBALANCE hint, AQE doesn't apply to streaming | Rewrite 4.2 pseudo-code and add a parallelismFirst callout. Fix the table row. Add a 4.7 section on "What AQE can't do": un-broadcast, pre-shuffle skew, GROUP BY skew, full-outer skew, streaming | Highest-leverage Spark section | +12 lines | N |
| p04-5-shuffle… | UPDATE | Diagram describes hash shuffle, removed in 2.0. Says ESS runs as a K8s daemonset (not supported in OSS). Push-based shuffle is YARN-only. RSS lineage is wrong (Uniffle came from Tencent, not Uber). "Plugins that write to S3" misnames Celeborn/Uniffle. "2–3×" is unsourced | Fix diagram text lines. Rewrite 5.2 K8s clause, the 5.3 heading, and the 5.5 bullets | Factual errors | ±0 / +2 | Y (push-shuffle speedup figure) |
| p04-6-join-algorithms… | UPDATE / BEEF UP | Decision tree omits hint priority, the SHJ preconditions and CartesianProduct. Says full outer can use BHJ (never). Missing: 8 GB / 512M-row broadcast hard limit; build-side constraints per join type; SHJ full outer since 3.1 | Fix tree and 6.6; add a hard-limit bullet in 6.2 | Correctness plus a classic interview trap | +5 lines | N |
| p04-7-skew… | UPDATE | `sum` in cb21 resolves to the Python builtin, so it raises TypeError. Text says salting is for aggregations but the code shows join salting. Missing: rand()-salt nondeterminism on retry; AQE skew can't split both sides or full outer | Fix imports and F.sum; use a deterministic salt (`pmod(hash(pk), N)`) and give the reason | Runnable code; retry-correctness trap | +3 lines | N |
| p04-8-tungsten… | TIGHTEN / UPDATE | "Off-heap" is presented as the default (it's on-heap by default). "~8000 lines" codegen fallback is wrong. SIMD claim. Row-size number disagrees with §17 | Fix 4 sentences; merge §17 into here | Correctness plus a duplicate | ±0 (−§17) | N |
| p04-9-memory-model… | TIGHTEN | Says execution evicts storage "freely" (only down to the storageFraction floor). Advice to raise memory.fraction for GC overhead is dubious. Missing `spark.executor.pyspark.memory` and that off-heap is added to the container separately (3.0+) | Fix 2 sentences; add 2 bullets | Correctness | +2 lines | N |
| p04-10-partitioning… | UPDATE | "AQE coalesce + maxRecordsPerFile" as the "better" single-file fix is wrong: there is no shuffle, and the cap only splits files. `repartition(200,"event_date")` means one task per date, which is skew | Replace the cb28 comment with REBALANCE; add the skew warning on 10.2 | Classic write-path incident | +2 lines | N |
| p04-11-broadcast-internals… | TIGHTEN | Says AQE fixes a stale-stats broadcast (it does not demote a planned BHJ). Egress statement is muddled. Largely duplicates §6.2 | Fix 11.4 bullet; merge 11.1 with 6.2 | Duplication/correctness | −8 lines | N |
| p04-12-pandas-udfs… | UPDATE | Code bugs: np undefined and `.map(np.log)` defeats vectorization; Iterator not imported; `predict` returns ndarray not Series; "per executor" should be per task. The `arrow.pyspark.enabled` config does not govern Pandas UDFs. "Zero-copy" is overstated. The column-order claim is wrong (matched by name). Throughput numbers are unsourced. Missing Arrow Python UDFs (`useArrow=True`, 3.5+) | Fix code and text; add a 3-line 3.5/4.0 note | Runnable code; 2026 relevance | +3 lines | N (Y for throughput numbers → delete them) |
| p04-13-writing-the-plan-diff… | UPDATE | Plan is presented as real output but uses a made-up node label ("ShuffleQueryStage (coalesced from 200 to 50)"). Numbered steps 4–5 misplace the coalesce. Missing `WindowGroupLimit` (3.5+) for `rn <= 10`. Wrong claim that built-in functions on partition columns block pruning | Label "illustrative, Spark 3.5+/4.0"; use `AQEShuffleRead coalesced` + `ShuffleQueryStage`; add WindowGroupLimit nodes; fix failure-mode bullet | Plan literacy is the chapter's thesis | +3 lines | N |
| p04-14-configuration-cheat-sheet… | UPDATE / BEEF UP | `arrow.pyspark.enabled` default is shown as true (false in OSS 3.x/4.0). DA row is wrong ("unless push-based shuffle"). Missing rows: `spark.sql.ansi.enabled` (true in 4.0), `coalescePartitions.parallelismFirst`, `adaptive.autoBroadcastJoinThreshold`, `dynamicAllocation.shuffleTracking.enabled`, `optimizer.runtime.bloomFilter.enabled`, `dynamicPartitionPruning.enabled`, `sources.v2.bucketing.enabled` (SPJ) | Add a "Default (3.5 → 4.0)" column and ~7 rows | This is what interviewers probe | +30 lines | N |
| p04-closing-framework | KEEP | Good six-bucket frame | Move below §17–20 (currently mid-chapter) | Structure | ±0 | N |
| p04-17-tungsten-and-the-off-heap-memory-model | TIGHTEN (merge into §8) | Duplicates §8 with contradictory numbers (~60 vs ~80 bytes; 10–100× vs 2–5×). Wrong Spark version (WSCG came in 2.0). Spill advice is backwards | Delete; move the 3 debugging bullets (corrected) into §8/§9 | Duplicate + wrong | −20 lines | N |
| p04-18-dynamic-allocation… | UPDATE | K8s fix is wrong (the answer is shuffle tracking, default true, or decommission migration / RSS, not PVs). "Databricks" listed as a cluster manager | Rewrite the trap paragraph | Correctness | ±0 | N |
| p04-19-photon-and-native-accelerators | UPDATE | "Velox under Presto/Trino" is wrong (Trino does not use Velox). Omits Gluten+Velox and DataFusion Comet for OSS Spark. "Similar hardware cost" ignores Photon's DBU premium. Percentages are vendor numbers | Fix engine list; mark numbers as vendor-reported | Correctness | +1 line | Y (speedup %) |
| p04-20-pyspark-vs-scala-performance | UPDATE | No mention of Spark Connect (3.4+, GA in 4.0), which changes the "Py4J thin wrapper" story and driver-side debugging. Row-UDF "10–30×" is unsourced | Add Spark Connect paragraph; soften numbers | 2026 relevance | +4 lines | Y (multipliers) |

**Missing in Part 04 (BEEF UP, one new short section "Spark 4.0: what changed for DEs", ~15 lines):**

- ANSI on by default. Overflow, bad casts and divide-by-zero now throw. Use `try_cast` and `try_divide`. This changes the failure behavior of old jobs.
- Spark Connect.
- VARIANT type plus `parse_json` / `variant_get`.
- Collations.
- SQL pipe syntax `|>`.
- Python Data Source API.
- `transformWithState`.
- Java 17+ and Scala 2.13 only, which affects Scala 2.12 jar and library compatibility.
- Storage-partitioned join for Iceberg/Delta (3.3+, off by default).

### Part 05 — SQL Deep Dive (4711–5434)

| h2 id | Verdict | Problem | Proposed change | Reason | Est. Δ | Ext. |
|---|---|---|---|---|---|---|
| p05-contents | UPDATE | Lists 1–13 only | Add the appended sections | Nav | +5 li | N |
| p05-1-the-mental-model… | TIGHTEN | "Driving table = the biggest one" is wrong in classic usage (driving/outer = most selective) | Reword to "Which side is the probe (big) side vs build (small)?" | Terminology trap | ±0 | N |
| p05-2-logical-plan-processing-order… | BEEF UP | Order omits WINDOW/QUALIFY. Alias note should name BigQuery (no alias in WHERE), Spark 3.4+ lateral column alias (SELECT only), and Snowflake/DuckDB (allowed) | Add QUALIFY step (Snowflake, BigQuery, Databricks, DuckDB; not Postgres/OSS Spark ≤4.0) and a dialect line | Common screen question | +3 lines | Y (QUALIFY in OSS Spark 4.x) |
| p05-3-physical-plan-processing-order… | TIGHTEN | Postgres plan text is muddled: "Right input" is not Postgres terminology, and the Hash node sits on the inner (dim) side. BigQuery dry run reports bytes *processed* | Mark illustrative; fix 2 lines | Accuracy | ±0 | N |
| p05-4-join-algorithms-with-complexity-math | UPDATE / TIGHTEN | "Zone Map Join" isn't a join algorithm. SMJ memory is not O(1) (duplicate-key runs are buffered). Z-ORDER/Snowflake clustering don't let engines skip the sort. Duplicates Part 04 §6 | Replace the row with "runtime filter / dynamic pruning"; fix 4.3; cross-ref p04-joins instead of re-deriving | Correctness + duplicate | −5 lines | N |
| p05-5-indexes-zone-maps-bloom-filters… | TIGHTEN | DuckDB listed as a bitmap-index engine (it uses ART + min-max zonemaps). INCLUDE is PG11+/SQL Server syntax. Fix list omits Delta liquid clustering and Iceberg sort order/z-order | Fix 1 line; label dialect; add liquid clustering | Accuracy/currency | +1 line | N |
| p05-6-subquery-types… | UPDATE / BEEF UP | `SEMI JOIN` is not valid in Postgres/Snowflake/BigQuery (Spark: `LEFT SEMI JOIN`; DuckDB: `SEMI JOIN`). LATERAL+LIMIT support varies by engine. Missing the COUNT-bug on decorrelation (0 vs NULL) and Spark's null-aware anti join for NOT IN | Label dialects; add 2 trap bullets | Classic traps | +3 lines | N |
| p05-7-window-functions… | UPDATE | GROUPS frame is not supported in Spark/Snowflake/BigQuery. The §7.3 trap never says what the trap is (RANGE sums tied peers). Spark top-k rule is unnamed (WindowGroupLimit, 3.5+) | Add support matrix line; add a ties example; name the rule | Cross-engine correctness | +3 lines | Y (Snowflake default frame — see §3) |
| p05-8-gaps-and-islands… | KEEP / TIGHTEN | Correct. cb20 uses `generate_series`/`::date`, which are Postgres-only. LEAD without PARTITION BY runs as a single task in Spark | Label PostgreSQL; add Spark/BigQuery/Snowflake calendar equivalents (`sequence`+`explode`, `GENERATE_DATE_ARRAY`, `GENERATOR`) | Portability | +2 lines | N |
| p05-9-sessionization-without-windows… | TIGHTEN | Title contradicts the body (it uses window functions). "Exact pattern Flink implements" is wrong (Flink merges windows). The `BETWEEN '2026-04-15' AND '2026-04-15'` filter cuts sessions at midnight, a real bug worth naming. `EXTRACT(EPOCH …)` is Postgres-only | Retitle "Sessionization with LAG + running SUM"; fix Flink sentence; add midnight-boundary trap | Correctness | +1 line | N |
| p05-10-as-of-joins… | UPDATE | Says Spark uses BNLJ for equi+range (it doesn't). §10.3 code block is an empty stub. Omits Snowflake `ASOF JOIN … MATCH_CONDITION`. "Uber's Michelangelo" is unsourced | Fix 10.1 text; replace 10.3 with a working Spark pattern (union + `last(…, ignorenulls)` window) or `pyspark.pandas.merge_asof`; add Snowflake | Correctness | +6 lines | Y (pyspark.pandas.merge_asof availability; Michelangelo) |
| p05-11-sketches… | UPDATE | Claims Theta sketches are "supported in Snowflake" (no native Theta). Missing mergeable-sketch APIs: BigQuery HLL_COUNT.*, Spark `hll_sketch_agg` (3.5+). Spark `percentile_approx` is GK, not t-digest. "100× for 1%" is unsourced. Duplicates §16 | Merge §16 into here; add an engine function matrix | Duplicate + accuracy | net −10 lines | N |
| p05-12-anti-patterns… | UPDATE | 12.2 example is backwards (Postgres coerces a quoted literal once; the harmful case is a VARCHAR *column* vs a numeric literal). Also add Spark 4.0 ANSI: a bad string cast now throws. 12.5 rewrite is wrong (UNION drops legitimate duplicates; `<>` drops NULL rows). 12.8 contradicts 6.1 (engines decorrelate) | Fix 3 snippets | Correctness | +2 lines | N |
| p05-13-query-tuning-workflow | KEEP / TIGHTEN | Solid. Codec line should note ORC defaults to zstd in Spark 4.0 and Parquet to snappy | 1-line tweak | Currency | ±0 | N |
| p05-15-cte-materialization… | UPDATE | Says Snowflake always inlines (Snowflake can compute a multi-reference CTE once: WithClause/WithReference in Query Profile). Spark: identical shuffles deduplicate via ReusedExchange. The "20B rows" example is engine-dependent. Duplicates 12.7 | Fix 2 table rows; merge 12.7 | Correctness | ±0 | Y (Snowflake CTE reuse semantics) |
| p05-16-approximate-aggregations | TIGHTEN (merge into §11) | Contradicts §11 (2% vs 0.8%). "99% accuracy for 0.01% of the cost" is hype. APPROX_COUNT_DISTINCT itself isn't mergeable. Spark default rsd is 5%. Function names differ per engine | Merge; keep CMS + "when not to use" | Duplicate + wrong | −12 lines | N |
| p05-17-materialized-views… | BEEF UP | Missing Snowflake MVs (single table, no joins) vs Dynamic Tables, and Databricks MVs / Lakeflow Declarative Pipelines (DLT) incremental refresh. BigQuery MV join support is understated | Add 2 bullets | 2026 currency | +2 lines | Y (BigQuery incremental MV JOIN support) |
| p05-18-query-hints-per-engine | UPDATE | Snowflake "hints" are session params/DDL, not hints. BigQuery hint list is invented (`GROUP BY ROLLUP` is grouping syntax). Spark `SKEW` hint is Databricks-only. Spark partition hints (REPARTITION, REBALANCE…) are missing | Rewrite Snowflake/BigQuery paragraphs; fix Spark list | The section's whole purpose is correct grammar | +2 lines | Y (BigQuery `@@optimizer_mode`: I believe it doesn't exist) |
| p05-19-window-function-choice-examples | UPDATE | 4 wrong rows: top-N with ties should be RANK; the 7-day RANGE row contradicts the next row; NTILE splits ties; the cumulative-distinct fix should be a first-seen flag. Frame-trap paragraph wrongly includes FIRST_VALUE. Third copy of the LAST_VALUE trap (5044, 5411, 5423) | Fix rows; keep only one LAST_VALUE explanation | Correctness + triple duplicate | −6 lines | N |

**Missing in Part 05 (BEEF UP, ~12 lines total):**

- QUALIFY.
- `FETCH FIRST … WITH TIES`.
- `IS DISTINCT FROM` / Spark `<=>`.
- The ANSI-mode impact (Spark 4.0): casts, overflow, `try_*` functions.
- MERGE semantics and the duplicate-source-row error (arguably Part 07).
- A dialect legend for code blocks. Every SQL block is tagged `sql` with no engine.

---

### Parts 06–07 — Python, Lakehouse

### Part 06: Python for Data Engineering
| h2 id | Verdict | Problem | Proposed change | Reason | Est. size | Ext. verify |
|---|---|---|---|---|---|---|
| p06-contents | UPDATE | Lists only 1–12. Sections 15–18 are unreachable from the TOC, and the numbering jumps 12→15 | After consolidation (below), renumber and rebuild the TOC | Navigation | ±0 | N |
| p06-1-…execution-model | TIGHTEN | `dis` output is 3.11/3.12 only (3.13 gives `LOAD_FAST_LOAD_FAST`, 3.14 gives `LOAD_FAST_BORROW…`). "10–60%" has no version tag | Label it "3.12 output". Add a line on 3.13+ superinstructions and the 3.13/3.14 experimental JIT (off by default) | Version drift | +1 line | N |
| p06-2-the-gil | **UPDATE / BEEF UP** | §2.4 is out of date: 3.13t was *experimental* with a ~40% single-thread penalty (not 10–30%). 3.14 made free-threading **officially supported** (PEP 779, ~5–10% penalty), still optional and not the default. §2.3 overstates how much pandas releases the GIL. It never mentions that importing a C extension that is not free-threading-safe **re-enables the GIL** | Rewrite §2.4 as a "2026 GIL story" box covering 3.13t experimental → 3.14t supported; `python3.14t`; `sys._is_gil_enabled()`; `PYTHON_GIL=0`; the extension-wheel gate (NumPy, PyArrow and Polars publish cp31Xt wheels, but check every dependency); 3.14 `concurrent.interpreters` / `InterpreterPoolExecutor` (PEP 734). Soften §2.3 | Core Senior question in 2026 | +10 lines | Y (wheel coverage) |
| p06-3-memory | **UPDATE** | Wrong or stale numbers: a 1-element list is 64 B, not 88. A 4-char str is 53 B in 3.11 but 45 B in 3.12+. The "header + type pointer + refcount" phrasing is circular. "2 GB vs 80 MB" overstates the ratio. "Three generations" is stale for 3.14 (incremental GC). The default threshold is 2000 in 3.13. py-spy is not USDT-based. Stray `~~250` markdown artefact | Fix the numbers (see §2), add a 3.14 GC note, fix the py-spy description | Correctness | ±0 | N (verified locally) |
| p06-4-pandas-vs-polars-vs-pyspark | **UPDATE** | Pre-pandas-3 content: pandas 3.0 makes CoW mandatory (the option is a deprecated no-op) and uses the Arrow-backed `str` dtype by default. `collect(streaming=True)` has been deprecated since Polars 1.25. The date-vs-string filter raises `InvalidOperationError`. The rule "fits in RAM → Polars, else Spark" contradicts the page's own streaming claim. The view/copy comment is wrong for boolean masks | Update the table rows (Backing, String-heavy), §4.3, the §4.4 code, and the rule of thumb. Absorb §16 (DuckDB) here as a 4th column, "DuckDB" | Correctness + duplication | +8 lines (after merge −25) | N (verified) |
| p06-5-the-arrow-boundary | TIGHTEN | "Parquet/Iceberg are Arrow-compatible" is misleading (Parquet must be decoded). `.pl()` is described as zero-copy "back". JVM↔Python Arrow is IPC (copy, but no per-cell objects) | Separate *zero-copy in-process* (C Data Interface / PyCapsule `__arrow_c_stream__`) from *cheap IPC* (Spark, Flight). Merge the Arrow part of §16 here | Common interview trap | ±0 | N |
| p06-6-generators | UPDATE | Hand-rolled `batched` duplicates `itertools.batched` (3.12+, `strict=` in 3.13) | Replace with `itertools.batched`, keeping the recipe as a "pre-3.12" note | Version | −3 lines | N |
| p06-7-asyncawait | **BEEF UP + MERGE §15** | No `TaskGroup` (3.11), `asyncio.timeout` (3.11), or `asyncio.to_thread` (3.9). `gather` without error semantics. No backpressure / `Queue` producer-consumer | Merge §15's S3 example (fixed) into §7. Add TaskGroup and cancellation semantics, a bounded `asyncio.Queue` with N workers, retries with jittered backoff | Duplication; missing modern API | +10 / −20 (net −10) | N |
| p06-8-multiprocessing | **UPDATE** | The default start method on Linux is **forkserver since 3.14** (it was fork). 3.12+ warns on fork with threads. No `shm.close()/unlink()` | Fix the text and add cleanup | Version | +2 lines | N |
| p06-9-type-hints…validation | UPDATE + MERGE §17 | `datetime.utcnow()` is deprecated (3.12) and naive-vs-aware comparison raises. `frozen=True` + a `dict` field is not hashable (`hash()` raises). Missing import. `PlaybackEvent(**raw)` should be `model_validate`. No mention of batch validation (`TypeAdapter(list[Model])`) | Fix the code. Fold §17's "3 levels" framing (dataclass → pydantic → schema registry) in as a closing table | Duplication + correctness | net −15 | N |
| p06-10-testing-strategy | UPDATE | Pyramid diagram is garbled (box-drawing chars rendered as tree nodes). dbt `tests:` should be `data_tests:` (dbt ≥1.8). No mention of `pyspark.testing.assertDataFrameEqual` (Spark 3.5+). The Hypothesis idempotence test **fails** (`"a  b"` → `"A  "` → `"A"`), yet the prose implies it passes | Redraw the pyramid as a list. Rename to `data_tests:`. Add the built-in assert. Reframe the Hypothesis example as "this finds a real bug", which makes it a better example | Correctness | +3 lines | N (verified) |
| p06-11-packaging-and-deploying | **UPDATE + MERGE §18** | Says "Three approaches" but lists 4, and items 3 and 4 are the same approach. `.egg` is obsolete. `pyspark==3.5.1` is pinned as a runtime dep (Spark 4.x is current; the cluster should provide pyspark). `spark.pyspark.driver.python=./environment` is wrong in client mode. Airflow 2 imports (Airflow 3: `airflow.sdk`, `airflow.providers.standard…`). "SnapStart on Java only" is false (Python 3.12+ since Nov 2024) | Merge §18 (pip/Poetry/uv/Docker) into §11.1. Fix all of the above. Add Lambda limits (250 MB unzipped layer, 10 GB container image) and Spark Connect `addArtifacts` | Duplication + multiple errors | net −20 | Y (Airflow 3 import paths) |
| p06-12-performance-debugging | KEEP / TIGHTEN | Solid. "Critical for Spark driver issues" is misleading: py-spy sees only the Python side, not the JVM driver | Add "JVM side: `jstack` / async-profiler / Spark UI". Change the CoW bullet to "pandas ≥3 always CoW" | Accuracy | +1 | N |
| p06-closing-principle | KEEP | — | Move it to the end of the part, after the merged sections | Flow | 0 | N |
| p06-15-asyncio-for-io-bound-pipelines | **MERGE into §7** | Duplicates §7. "Infinitely cheaper", "dramatically faster than threads" and "~80 ms total" are all wrong. It creates an S3 client per task and has no semaphore, despite its own pitfall list | Delete after moving the corrected S3 example and pitfalls into §7 | Duplication | −30 lines | N |
| p06-16-duckdb-polars-and-arrow | **MERGE into §4/§5** | Duplicates §4.4 and §5.3. "10 GB Pandas→DuckDB→Spark via Arrow costs zero CPU" is false | Keep the composition example (it is good) inside §5.3. Drop the rest | Duplication | −20 lines | N |
| p06-17-pydantic-and-dataclass-contracts | **MERGE into §9** | Duplicates §9.1/9.2. Level 3 (schema registry) is the only new idea | Fold into §9 | Duplication | −25 lines | N |
| p06-18-packaging-pip-poetry-uv | **MERGE into §11** | Duplicates §11.1. pip "no lockfile" is stale (PEP 751 `pylock.toml`; `pip lock` is experimental in pip 25.1+). uv "still maturing" is stale. The Dockerfile is **broken** (`uv sync` before `src/` is copied; CMD uses system python, not `.venv`) | Fold in with the fixes | Duplication + bug | −15 lines | Y (pip lock status) |

### Part 07: Lakehouse (Iceberg & Delta)
| h2 id | Verdict | Problem | Proposed change | Reason | Est. size | Ext. verify |
|---|---|---|---|---|---|---|
| p07-contents | UPDATE | TOC stops at 13. §16–19 are unlisted, and the numbering jumps 13→16 | Renumber after consolidation | Nav | 0 | N |
| p07-1-why-open-table-formats | TIGHTEN | Fine. Missing the 2024–26 convergence story: Delta UniForm, Apache XTable, Databricks buying Tabular (2024), Iceberg v3 aligning DVs with Delta | Add one "2026 reality" paragraph | Context | +4 | N |
| p07-2-iceberg-on-disk | **UPDATE** | `format-version (2 in modern usage)`: v3 is GA in Iceberg 1.10 (DVs in Puffin, variant, row lineage, default values, nanosecond timestamps, geo). The catalog list omits REST. "branch-aware" for Polaris/Unity is wrong (they do CAS via REST requirements). "This is why Iceberg dominates" overclaims (Delta prunes with the same file stats). Metadata filenames are catalog-specific (`00042-<uuid>.metadata.json`) | Add a v3 box (5 bullets). Fix the commit-mechanism sentence. Soften the dominance line | Version | +8 | Y (v3 engine coverage) |
| p07-3-delta-on-disk | **UPDATE** | "DynamoDB … no longer required" is **engine-dependent**: true for delta-rs ≥1.0 (S3 conditional put), but delta-spark still documents S3DynamoDBLogStore for multi-cluster S3 writes (feature request #3596). Missing Delta 4.x items: V2 checkpoints / sidecars, log compaction, catalog-managed (coordinated) commits, row tracking, type widening, variant | Qualify the claim per engine. Add a Delta 4.x box | Correctness | +6 | **Y** |
| p07-4-snapshot-isolation | **UPDATE** | "Both achieve **serializable**" is wrong: Delta's default is **WriteSerializable**; Iceberg is configurable (`write.*.isolation-level`, serializable/snapshot); readers get snapshot isolation. The conflict rules are wrong: blind appends to the *same* partition do **not** conflict (Iceberg fast-append; Delta appends vs appends) | Rewrite §4.2 as a matrix (append/append = no conflict; append vs MERGE depends on isolation level and files read; MERGE/MERGE on the same files conflicts). Mention Delta row-level concurrency (DVs + row tracking) | Core interview topic | +4 | N |
| p07-5-hidden-partitioning | **UPDATE** | `SET PARTITION SPEC` is not valid Iceberg SQL (it is `REPLACE PARTITION FIELD … WITH …` / `ADD` / `DROP PARTITION FIELD`). The "hour→day" comment contradicts the CREATE, which used `days`. `truncate` on ints is floor-to-multiple, **not mod** | Fix the code and text | Code bug | ±0 | N |
| p07-6-merge-under-the-hood | **UPDATE** | "Write amplification 1×" ignores the scan needed to locate rows. The GDPR row "MOR good" is dangerous: delete files are *logical*, so physical erasure needs compaction + expire + orphan cleanup (Delta: `REORG … APPLY (PURGE)` + `VACUUM`). No v3 DV note. The multi-match text is self-contradictory | Fix the table, add a "GDPR = physical delete" callout, add the v3 note | Correctness + common trap | +4 | N |
| p07-7-compaction | **UPDATE / BEEF UP** | "Sorts within each output file" is wrong (the rewrite range-sorts across the file group, so files get non-overlapping ranges). The Z-order math `N^(1/N)` is wrong. Iceberg also supports `zorder(...)`. Delta **liquid clustering** (`CLUSTER BY`, incremental, replaces ZORDER/partitioning; incompatible with ZORDER) is missing | Fix the text and math. Add §7.3b Liquid clustering. Merge §18's write-amplification material here | Currency | +8 / merge −10 | N |
| p07-8-time-travel | UPDATE | Delta RESTORE is **not** a pointer swap (it writes a new commit re-adding files). "Long retention = huge cost" applies only to churned files. Delta defaults are missing (log 30 d, deleted files 7 d, VACUUM 7 d) | Fix it. Add a Delta-defaults line and Iceberg branches/tags/WAP (`write.wap.enabled`, `cherrypick_snapshot` / `fast_forward`) | Correctness | +4 | N |
| p07-9-schema-evolution | UPDATE | "Add column: default value" was v2-incorrect (nulls; defaults are **v3**). The name-mapping explanation is backwards (Iceberg uses `schema.name-mapping.default` for files *without* field IDs, e.g. migrated Hive). Delta column mapping is reader v2 / writer v5, not "protocol ≥2". Delta type widening (4.0) is missing | Fix | Correctness | +1 | N |
| p07-10-delete-files | UPDATE | v2-only view. In v3, position delete files are replaced by DVs (one Puffin bitmap per data file, max one DV per file), which fixes the "many small position-delete files" problem | Add a v3 paragraph | Version | +3 | N |
| p07-11-iceberg-vs-delta-vs-hudi | **MERGE with §16** | Two matrices that contradict each other. Errors: Iceberg branches/tags "with Nessie/Polaris/V3" (they are in the table spec since v2 / 1.2 and work with *any* catalog); Hudi catalog "HMS" only; no UniForm / XTable / delta-rs / Delta Kernel | One matrix, with rows added for v3 DVs, variant, row lineage, UniForm, liquid clustering, and REST catalog | Duplication + errors | −30 net | Y |
| p07-12-catalog-choices | **MERGE with §17 + BEEF UP** | Two catalog sections. Glue is described as "multi-region" (it is regional) and "no branches" (branches live in Iceberg metadata, so they work on Glue). Nessie/Polaris status is stale. No REST-spec features (credential vending, server-side CAS, multi-table commit, scan planning). Missing S3 Tables, Glue's Iceberg REST endpoint, OSS Unity Catalog (LF AI & Data), Snowflake Open Catalog, Polaris TLP (Feb 2026) | One section: *what a catalog does* → REST spec → implementations table (HMS, Glue/S3 Tables, Polaris, Unity OSS/Databricks, Nessie, Lakekeeper/Gravitino) → migration trap (keep §17's) | Duplication + currency | −15 net | Y |
| p07-13-operating-a-lakehouse | **UPDATE** | The orphan-file explanation is wrong (the risk is *uncommitted in-flight writes*, and scheme/authority mismatches such as `s3://` vs `s3a://` that make everything look orphaned, not readers). OSS Iceberg has no "write-side auto-compaction" (that is Delta `autoCompact` / `optimizeWrite`, or managed services). "REST catalog retry-with-backoff" confuses things: retries are client `commit.retry.*`. Cross-region S3 CRR breaks because **metadata holds absolute paths** (use `rewrite_table_path`, 1.8+). Iceberg does not record "who" | Fix each. Add the "20K → 8M files" incident as §13.1's worked example | Ops correctness | +5 | N |
| p07-closing-principle | KEEP | — | Move it to the end | — | 0 | N |
| p07-16-…feature-matrix | **MERGE into §11** | Duplicate. Wrong on its own terms: Delta "Trino (read)" (Trino writes Delta, including MERGE); Iceberg "compact-on-write" (not in OSS); "COW (v1) or MOR (v2)" conflates format version with write mode; Delta DVs "since 3.0" (DELETE with DVs landed in 2.4, UPDATE in 3.0, MERGE in 3.1) | Keep the decision heuristic (good) under the merged matrix | Dup | −20 | Y (DV version history) |
| p07-17-catalog-architectures | **MERGE into §12** | Duplicate. "REST backed by … Polaris" is confused: Polaris *is* a REST implementation. "Polaris still early" is stale (TLP since Feb 2026) | Keep "migration trap" | Dup | −20 | N |
| p07-18-write-amplification | **MERGE into §6/§7** | "COW … the entire partition gets rewritten" is wrong. COW rewrites *touched files*; it approaches the whole partition only when changes are scattered, which is why clustering matters. "Delete files … updated to X" is wrong (update = delete + new row in a data file). "Bin-pack doesn't touch overlays" is wrong (rewritten files have their deletes applied) and contradicts §7.6 | Keep the 5–10% delete-ratio rule of thumb | Dup + errors | −15 | N |
| p07-19-multi-table-transactions | **BEEF UP / VERIFY** | The staging "atomic rename of several catalog entries" does not exist in HMS/Glue. The 2PC "prepare" phase is not something table formats expose. The dim/fact ordering paragraph is self-contradictory. The "Iceberg v1.4+ Transactions API; REST does; Glue doesn't" claim is too crisp: the REST spec has `POST …/transactions/commit`, server support varies, and Spark SQL has no syntax for it | Rewrite around: (a) commit dims before facts, plus inferred members for late dims; (b) WAP via branches, then publish; (c) Nessie multi-table branch merge; (d) REST multi-table commit (Java API only; check your server); (e) consumer-side watermark table / "publish marker" | Senior design question | +5 | **Y** |

---

### Parts 08–09 — Interview Scenarios, Prep Program

Legend: K=KEEP, T=TIGHTEN, U=UPDATE, B=BEEF UP, V=VERIFY. "Ext" = external verification needed (Y/N).

### Part 08
| h2 id | Verdict | Problem | Proposed change | Reason | Size | Ext |
|---|---|---|---|---|---|---|
| (intro, 7038–7050) | U | Title "Real Scenarios"; intro attributes to Netflix/Stripe/Airbnb/Pinterest/Uber/Meta/DoorDash | Retitle "Interview Scenarios"; see §2 | Policy: no unsupported company or "real" claims | ~0 | N |
| p08-contents | U | TOC omits the 3 appended h2s (observability, cloud, ML). Anchor ids are off by one after `q7b`: item 8 = `q7b`, item 9 = `q8`, …, 42 = `q41`. Titles differ from the h2s | Add 3 TOC entries. Optionally rename anchors to match displayed numbers (all resolve today) | Navigation | +0.3 KB | N |
| p08-incident-the-pipeline-missed-sla--diagnose | K | Good triage frame | Add one line: "state the blast radius and which downstream SLAs are now at risk" | Incident leadership signal | +0.1 KB | N |
| p08-incident-the-dashboard-shows-half-the-revenue… | T | Overlaps Part 09 §5 Scenario B and the "KPI shows zero" h3 at 7791 | Merge the three into one debug ladder; cross-link | Triplicated | −1 KB | N |
| p08-incident-streaming-consumer-lag… | T | "rebalance, salt, or rebalance" is repeated. Adding partitions also breaks key→partition ordering, which isn't mentioned | Fix wording; add the ordering caveat | Accuracy | ~0 | N |
| p08-incident-iceberg-table-reads-are-10-slower… | U | Metadata query uses the non-existent column `partition_event_date`. "Async compaction at write time" isn't an Iceberg feature | See §3 | Code is wrong | ~0 | N |
| p08-incident-spark-job-ooms-only-on-mondays | U | Says "raise broadcast threshold" as an OOM fix. Calls a Python-worker blowup a "JVM OOM" | See §3 | Wrong advice | ~0 | N |
| p08-incident-late-arriving-data… | K | Solid | — | — | 0 | N |
| p08-design-a-clickstream-pipeline-at-1m-eventssec | B | Has capacity math. Missing: partition math (1 GB/s ÷ 100 partitions = 10 MB/s/partition; ×3 replication; 7 days of Kafka ≈ 1.8 PB before tiered storage), data model (event envelope, keys), and evolution. The 70/20/10 cost split is invented | Add partition/broker math and an envelope schema; drop 70/20/10 | This is the flagship design; the numbers must hold up | +1 KB | N |
| p08-design-a-feature-store-for-ml-serving | T | Duplicated by `p08-ml-and-feature-store-scenarios` and Part 09 Scenario D. No numbers | Merge with the later ML h2; add QPS/latency numbers | Duplication | −1 KB | N |
| p08-design-point-in-time-correct-training-data | K | Short pointer; fine | — | — | 0 | N |
| p08-design-a-daily-metric-that-must-be-100-accurate | U | "streaming is fundamentally probabilistic" overstates it | See §3 | Accuracy | ~0 | N |
| p08-design-scd-type-2-ingestion-from-kafka-cdc | U | Orders on `source_ts_ms`, which isn't a reliable ordering key. No ops section (small files and compaction after per-batch MERGE) | Order by LSN/binlog position; add a compaction note | Accuracy | +0.2 KB | N |
| p08-design-a-multi-region-data-warehouse | B | No numbers, no RPO/RTO, no region-failover failure mode, no egress $/GB | Add RPO/RTO clarifiers, an egress-cost line and a failover drill | Weakest design | +0.8 KB | N |
| p08-design-exactly-once-for-a-payments-counting-pipeline | K | Good. Ref "chapter 03 §7 and §14": §16 (idempotent producers) fits better | Add p03-16 | Cross-ref | ~0 | N |
| p08-internals-how-does-spark-decide-bhj-vs-smj… | U | Conflates the AQE SMJ→BHJ conversion with the `DynamicJoinSelection` rule. Omits SHJ and `spark.sql.adaptive.autoBroadcastJoinThreshold` | See §3 | Accuracy | ~0 | Y |
| p08-internals-why-is-your-shuffle-slow… | U | Push-based shuffle (Magnet) is YARN-only | See §3 | Version/platform-specific | ~0 | N |
| p08-internals-why-doesnt-this-filter-push-down | U | "indexed column" is the wrong term for Parquet/Spark | See §3 | Terminology | ~0 | N |
| p08-internals-walk-me-through-what-happens-during-a-flink-checkpoint | U | Cross-ref "chapter 03, section 9" points at Kafka internals; Flink barriers are §8 | Fix ref to §8 (#p03-8-…) and make it a link | Broken pointer | ~0 | N |
| p08-internals-walk-me-through-an-iceberg-commit… | U | Retry semantics are wrong (data files are reused on retry, not orphaned) | See §3 | Accuracy | ~0 | N |
| p08-internals-how-does-a-watermark-form… | U | "subtasks share partitions" is wrong | See §3 | Accuracy | ~0 | N |
| p08-internals-why-does-my-exactly_once… | K | Good | — | — | 0 | N |
| p08-modeling-star-schema-vs-obt--when-each | U | Ref "chapter 01, section 11" (Medallion); OBT is §10. BigQuery claim is wrong. Contradicts p09-7 "Normalize vs Denormalize" | Fix ref; reconcile with p09-7 | Internal contradiction | ~0 | N |
| p08-modeling-scd2-or-scd1… | K | — | — | — | 0 | N |
| p08-modeling-persist-this-silver-model… | K | — | — | — | 0 | N |
| p08-modeling-partition-by-user_id-or-by-date | K | — | — | — | 0 | N |
| p08-modeling-soft-deletes-in-a-fact-table | U | Deletion vectors are not a physical GDPR delete | See §3 | Compliance-wrong | +0.1 KB | N |
| p08-modeling-pm-asked-for-real-time… | T | "10–100×" is an unsupported number | Soften | Unsupported | ~0 | N |
| p08-quality-how-do-you-test-a-spark-transformation | T | Duplicates p06-10 and p12-5 | Keep 3 lines + link | Duplication | −0.2 KB | N |
| p08-quality-how-do-you-backfill-safely | K | — | — | — | 0 | N |
| p08-quality-how-do-you-design-a-data-contract | T | Duplicates p01-13 | Link | Dup | −0.2 KB | N |
| p08-quality-how-do-you-measure-pipeline-quality | T | Duplicates p12-2 | Link | Dup | −0.2 KB | N |
| p08-quality-schema-evolution… | K | — | — | — | 0 | N |
| p08-quality-cicd-for-a-data-warehouse | B | Missing slim CI (`dbt build --select state:modified+ --defer`), a data-diff gate and blue/green (swap/WAP) | Add 2 bullets | 2026 practice | +0.3 KB | N |
| p08-trade-offs-latency-vs-cost-vs-correctness… | K | — | — | — | 0 | N |
| p08-trade-offs-row-store-for-analytics | K | — | — | — | 0 | N |
| p08-trade-offs-when-not-to-use-iceberg | U | Snowflake bullet should acknowledge Snowflake-managed Iceberg tables; also mention Delta/UniForm | 1 clause | Currency | ~0 | Y |
| p08-trade-offs-lambda-architecture-in-2026 | T | Duplicates p03-13 | Link | Dup | −0.2 KB | N |
| p08-trade-offs-polars-or-spark--when-each | U | "Polars wins" heuristic leaves out DuckDB. RAM-fit isn't the only factor | Add DuckDB; soften | Currency | ~0 | N |
| p08-trade-offs-build-vs-buy | V | Vendor list ages fast (Dagster Cloud → Dagster+; Decodable ownership). Duplicates p09-7 Build vs Buy | Date-stamp the table ("as of 2026"); merge the heuristic with p09-7 | Currency | ~0 | Y |
| p08-behavioural-a-time-you-said-no-to-a-stakeholder | T | Duplicates p09-6 frame 6 | Link to p09-6 | Dup | −0.3 KB | N |
| p08-behavioural-a-pipeline-you-owned-caused-a-bad-metric | T | Duplicates p09-6 "Failure Owned" and 11.7 | Link | Dup | −0.3 KB | N |
| p08-behavioural-how-do-you-decide-what-not-to-build | K | — | — | — | 0 | N |
| p08-behavioural-how-do-you-onboard-the-next-engineer | K | — | — | — | 0 | N |
| p08-closing-meta-advice | U | A "closing" section followed by 3 more h2s | Move it to the end of Part 08 | Structure | 0 | N |
| p08-observability-and-data-quality | T | Overlaps p12-2/p12-3. SLO example mixes a data-fraction target with a time budget | Tighten; see §3 | Dup/accuracy | −0.5 KB | N |
| p08-cloud-specific-scenarios | U | Flex slots are retired; Snowflake has no "vacuum". Overlaps p11-1 | See §3 | Outdated | ~0 | Y |
| p08-ml-and-feature-store-scenarios | T | Second feature-store design in the same part | Merge with q7b | Dup | −1 KB | N |

### Part 09
| h2 id | Verdict | Problem | Proposed change | Reason | Size | Ext |
|---|---|---|---|---|---|---|
| p09-1-the-four-week-roadmap | U | Refs are valid (see §8). Gaps: no Python coding day (Part 06), no Kafka internals, never touches Parts 10–12, no data-modeling mock. "Five-step opener" and "volumes cheat sheet" are asked for but never supplied. "Four weeks is the minimum…top-tier" is unsupported | Add the Python/Part 10–12 touchpoints; supply the volumes table (see §4); soften the opener | Completeness | +1 KB | N |
| p09-2-how-candidates-lose-offers | T | Presented as "post-debrief scorecards" (unsupported). Invented statistic "<50% at most committees". "Bar raiser" is an Amazon term. C3 formula is wrong | See §2/§3 | Policy | ~0 | N |
| p09-3-what-changes-at-staff-and-principal | U | L4–L7 ladder is company-specific (e.g., Amazon L6 = Senior) and presented as universal | Add one caveat sentence | Policy | +0.2 KB | N |
| p09-4-the-sql-question-bank-senior-tier | U | Dialect claim is false (Q1–3 Snowflake, Q4/Q7/Q8/Q9 Postgres); promised "Spark SQL equivalents" never appear. Bugs in Q1, Q5 follow-up, Q7, Q8, Q9 prompt | See §3/§7; label a dialect per query | Code must run | +0.5 KB | N |
| p09-5-system-design-transcripts | U | "Prompt (verbatim)" ×4 implies real prompts. Technical errors in A (late side-table), C (deletes files still referenced), D (fallback wording, 150 ms vs 100 ms budget, invented regulation, cost number) | See §2/§3 | Accuracy | ~0 | N |
| p09-6-behavioral-star-frames | K | Strong. "Every senior loop includes…" is an overgeneralization | Soften | — | 0 | N |
| p09-7-decision-frameworks | U | Unsupported numbers (3–10×, ~100 TB). "Warehouse high cost-per-GB" is wrong. "Denormalize almost always" contradicts p08-q20 | See §3 | Accuracy | ~0 | N |
| p09-8-the-mock-interview-loop | K | Rubric is good | — | — | 0 | N |
| p09-9-the-pre-interview-checklist | T | "80% of rounds" is invented. "§F3 above" should read "§2 F3" | See §2 | Policy | ~0 | N |
| p09-10-day-of-playbook | T | Wellness padding with unsupported "measurably" claims (sleep, exercise, protein). "Next interviewer hasn't talked to the last" is not universal | Cut to ~6 bullets | Padding | −1.2 KB | N |
| p09-11-tricky-behavioral-questions | U | "drawn from actual DE interview loops" and 8× "The real scenario". 13 stray `</em>`. Technical errors in 11.1, 11.2, 11.3, 11.7, 11.8. Missing scenarios (§5) | See §2/§3/§6; add 3–4 scenarios | Policy + gaps | +3 KB | N |
| p09-closing | K | — | — | — | 0 | N |

---

### Parts 10–12 — Governance, Cost, Data Quality

Size check (words/KB/`<pre>`): P1 9,424w/38 code · P2 7,843/47 · P3 8,637/35 · P4 6,159/35 · P5 5,196/34 · P6 4,472/43 · P7 4,596/20 · P8 6,555/3 · P9 18,923/13 · **P10 1,542w/13KB/0 code · P11 1,525w/12KB/0 code · P12 1,594w/14KB/4 code**. **Verdict: these three chapters are about 1/3 to 1/6 the depth of chapters 1–7.** They read like a survey written in the voice of a Staff-level "architect" and hold almost no "debug / defend" material. Parts 10 and 11 contain zero code, zero incidents and zero interview Q&A. That is **too thin for L5**. Each needs about 2–3x its current size, spent on incidents, traps and working code, not on more prose.

**Security coverage.** Present: masking (the table at 9525), tokenization and pseudonymization (9526–9527), "encryption at rest" (one row), classification tiers, a single mention of "Row-level security" (9539), query audit logs, and S3 Object Lock. **Missing: IAM and least privilege (0 hits), RBAC/ABAC (0 hits in P10; mentions only at 4644/6877 in other contexts), KMS or envelope encryption, BYOK and key rotation (0 hits for "KMS"), and crypto-shredding (0).** Also missing: how row-level security is actually implemented (Snowflake row access policies, Databricks row filters and column masks, BigQuery row-level security and policy tags, Lake Formation LF-Tags); dynamic vs static masking; secrets management; PrivateLink and network isolation; DSAR workflow; GDPR Art. 33's 72-hour breach notification; DPIA; PCI DSS scope reduction via tokenization; the other US state privacy laws; India's DPDP Act.

| h2 id (line) | Verdict | Problem | Proposed change | Reason | Est. size Δ | Ext. verify |
|---|---|---|---|---|---|---|
| p10-1-gdpr (9416) | UPDATE + BEEF UP | Art. 3 scope misstated; "six" principles omits accountability (5(2)); erasure steps are wrong for merge-on-read/deletion vectors and never physically delete files (no VACUUM, remove_orphan_files, REORG PURGE); "reasonable time for backups" is not in the GDPR text; k≥5 anonymisation is not a legal test; residency is conflated with transfer rules | Fix the claims (sec. 2). Add an **erasure runbook**: erasure queue → DELETE → rewrite files (Delta `REORG TABLE … APPLY (PURGE)`, Iceberg `rewrite_position_delete_files`/`rewrite_data_files`) → expire snapshots / `VACUUM` → also purge CDF `_change_data`, Kafka topics (retention or compaction tombstones), ML feature stores, extracts and logs. Add crypto-shredding (a per-user key in KMS; delete the key). Add the Art. 12(3) deadline (1 month, +2 months) | Erasure is the #1 GDPR design question and the current steps would fail an audit | +60–80 lines | Y (Art. 3/5/12/17, Recital 26, WP29 05/2014, CJEU C-413/23 P) |
| p10-2-ccpa (9445) | UPDATE | CPRA dates are loose; SPI "opt-out" should be "right to limit"; no GPC; no 45-day DSAR deadline; the consent table is keyed per regime, not per purpose | Fix the claims. Remodel consent as an event log `(user_id, purpose, status, source, policy_version, effective_at)` with a derived current-state table; propagate via lineage; honour GPC signals | The per-regime boolean table is an L5 red flag | +15 lines | Y (Cal. Civ. Code 1798.x, CCPA regs §7026) |
| p10-3-sox (9454) | TIGHTEN + UPDATE | "violation" overstated; "Delta audit log" is not immutable; no ITGC vocabulary | Use ICFR/ITGC terms: change management, logical access, operations; emergency-change process; control evidence; reconciliation as a key control | Accuracy | ±0 / +5 | Y (light) |
| p10-4-data-retention (9463) | UPDATE | Glacier transition at 30d + delete at 90d triggers the 90-day minimum-duration charge; Athena can't read Deep Archive without a restore; "3 years (GDPR)" is invented; `DROP PARTITION` isn't supported on Delta or Iceberg | Fix the table and the SQL (sec. 2). Add legal hold (Object Lock legal hold beats retention delete) | Four factual errors in 12 lines | ±0 | Y (S3 pricing/docs) |
| p10-5-data-lineage (9479) | UPDATE | Airflow doesn't capture lineage "automatically"; package name `dbt-openlineage` is wrong; no mention of built-in lineage in UC/Snowflake/dbt | Name `apache-airflow-providers-openlineage` (Airflow 2.7+), `openlineage-dbt`/`dbt-ol`, `sqlglot.lineage`. Add the failure modes: dynamic SQL, `SELECT *`, UDFs and Python transforms break static lineage. Cross-link P8 7673/7780 | Currency | +8 | Y |
| p10-6-metadata-management (9491) | UPDATE / TIGHTEN | Catalog table is dated: Amundsen is largely dormant; no Apache Polaris / Snowflake Horizon, Dataplex, Purview, DataZone/SageMaker Catalog; UC OSS (2024) not mentioned; Glue cell overstated | Replace Amundsen with Polaris/Horizon and DataZone rows. Cross-link the P7 catalog section (6853–6981) instead of re-listing | Duplication with P7; staleness | ±0 | Y |
| p10-7-pii-handling (9510) | BEEF UP | Google DLP was renamed; the protection table blurs static vs dynamic masking, HMAC vs vault, and at-rest encryption vs column encryption; **no enforcement layer at all** | Add an "Access control" h2 (or fold one in here): RBAC vs ABAC/tag-based policies, row access policies, column masks, service principals, KMS envelope encryption and rotation, deterministic tokenization for joins, FPE. Include one Snowflake masking-policy SQL and one Databricks row-filter SQL | This is where the missing security topics belong | +50 lines | Y (edition gates) |
| p10-8-data-classification (9534) | TIGHTEN | "propagated automatically via lineage" assumes tooling that most stacks lack | "…propagated via lineage where the catalog supports tag propagation; otherwise enforce with a CI check on model PRs" | Honesty | ±0 | N |
| p10-9-auditability (9544) | UPDATE | ACCESS_HISTORY is Enterprise+ with up to ~3h latency; Redshift STL retains only days; Delta CDF / Iceberg history are not tamper-evident; CDF retains deleted PII | Fix the claims (sec. 2). Add "tamper-evident = WORM storage + separate account + hash chain" | Correctness | +3 | Y |
| p11-1-snowflake (9565) | UPDATE (High priority) | **The arithmetic is wrong** (4 min on M ≠ 16 credits); the sizing rule is **inverted**; auto-suspend ignores cache loss and the 60s minimum; clustering advice ("high-cardinality") is backwards; MVs are Enterprise+, single-table, serverless-maintained; no mention of cloud services (10% rule), Gen2 warehouses, Resource Monitors, QUERY_TAG / QUERY_ATTRIBUTION_HISTORY, Dynamic Tables, QAS; typo "rerranges" | Rewrite (sec. 2). Add a "bill tripled" triage checklist and cross-link P8 7799 | An interviewer will catch the math immediately | +20 | Y (pricing, Gen2 multiplier) |
| p11-2-databricks (9583) | UPDATE | DBU price range conflates tier and VM; ignores the two-bill (DBU + cloud VM) model; recommends standard autoscaling for streaming (Databricks advises against it); the decommission config is fabricated; Photon "2–10x" contradicts P4 4660 "2–3x" and omits Photon's higher DBU rate; serverless "charges only for active query time" is false; "Delta cache" was renamed disk cache | Fix the claims. Add `system.billing.usage` + `custom_tags` attribution, cluster policies, and serverless vs classic trade-offs. Qualify "list prices as of <date>, AWS, Premium" | Several false statements | +10 | Y |
| p11-3-s3 (9597) | UPDATE | PUT price is 12.5x understated; Glacier Flexible retrieval price mixes up tiers; Intelligent-Tiering fee is missing "/month" and the 128 KB floor; `raw/<em>` artefact; no 128 KB IA minimum, no ~40 KB Glacier per-object overhead, no transition request cost; **no NAT gateway / cross-AZ / egress** content (the most common surprise bill in data engineering) | Fix the claims. Add a "small files × lifecycle" trap and a data-transfer subsection. Label "us-east-1 list prices, verify" | Numbers are the whole point of this section | +10 | Y (S3 pricing page) |
| p11-4-redshift (9625) | UPDATE + BEEF UP | WLM description is wrong (it allocates slots and memory, not CPU; SQA is not a queue; auto WLM doesn't "assign queues"); interleaved sort keys aren't flagged as generally discouraged; **no RA3/managed storage, Serverless RPUs, concurrency scaling (free credits accrue about 1h/day), Spectrum $/TB, AUTO dist/sort, AutoMV** | Rewrite WLM; add the missing features with qualifiers ("verify current pricing") | The brief requires RA3/concurrency scaling, and both are absent | +12 | Y |
| p11-5-spark (9636) | TIGHTEN | Duplicates P4 (3830–4466 broadcast/shuffle/AQE, at deeper depth); a `$X` placeholder; "always broadcast dims" is a trap; `.cache()` level is wrong in 9595 | Cut to 4–5 lines of *cost* framing (spill → bigger nodes, skew → idle executors, tiny files → LIST/task overhead) + cross-link `#part-04` | Dedup; remove padding | −8 lines | N |
| p11-6-finops (9647) | BEEF UP | Generic cloud FinOps; ignores how data platforms actually attribute cost (warehouse/query tags, system tables); no unit economics; no BigQuery (on-demand $/TiB vs editions/slots, even though P8 7811 asks about slots) | Add "Attribution in data platforms": Snowflake QUERY_TAG + WAREHOUSE_METERING_HISTORY, Databricks system.billing.usage, BigQuery INFORMATION_SCHEMA.JOBS total_bytes_billed. Add unit cost (cost per TB processed / per pipeline run / per dashboard view) and commit discounts (Snowflake capacity, Databricks DBCU) | L5 "defend" answers live here | +25 | Y |
| p12-1-great-expectations (9671) | **UPDATE (critical)** | Whole section is GX 0.x (0.13–0.17): `run_checkpoint`, Batch Requests, data connectors, `results["success"]`, validator-style snake_case expectations. All removed or changed in GX Core 1.0 (Aug 2024). KL-divergence row is mislabelled. "Validate first step of silver" is backwards (validate *output* before publish) | Replace the code with GX 1.x (sec. 2). Add **Write-Audit-Publish** (0 hits in the file!) via Iceberg branches / Delta staging table + swap. Mention Soda Core, dbt tests, and platform-native options (Snowflake Data Metric Functions, Databricks Lakehouse Monitoring / DQX, Lakeflow/DLT expectations) as alternatives, with version labels | The code won't run on any GX release shipped since Aug 2024 | +15 | Y (GX docs) |
| p12-2-observability (9721) | UPDATE | re_data is effectively unmaintained; Metaplane is now part of Datadog (2025, verify); the SQL anomaly check computes STDDEV then ignores it, compares a *partial* today against full days, ignores weekly seasonality, and the freshness query can't alert on a table that never logs (an absent row means no alert) | Swap re_data for Soda/dbt-native tools; fix the SQL: compare yesterday, use a z-score or same-weekday baseline, drive freshness from an expected-tables registry LEFT JOIN | The code as written would page falsely every morning | ±0 / +5 | Y (vendor status) |
| p12-3-sla-slo (9771) | TIGHTEN | Time-based error budget (43 min) is the wrong unit for batch; latency measured from "ingestion" instead of event time | Express the batch SLO as "% of days landed by the deadline" (e.g. 99% ⇒ about 3–4 misses/yr) and the streaming SLO as p99 event-time lag | Classic pushback point | ±0 | N |
| p12-4-reconciliation (9785) | BEEF UP | Hash-diff is naive (NULL/delimiter/type normalization); no "same definition" guidance (timezone, booking vs event date, refunds, FX) for control totals | Fix the hash row; add a "definition drift" checklist; add an aggregate-first recon (per partition/day, then drill down) | This is exactly the "3.7% vs Finance" incident | +10 | N |
| p12-5-testing (9803) | TIGHTEN | Unit-test block duplicates P6 §10.3 (5946, uses chispa); contract tests duplicate P1 §13 (1167) and P8 7541; no dbt model contracts; `tests:` key predates dbt 1.8's `data_tests:`; dbt_expectations maintenance changed | Keep only the dbt YAML (updated) + a cross-link to `#p06-10-testing-strategy-for-data-pipelines` and `#part-01` contracts; add `contract: {enforced: true}` | Dedup + currency | −15 lines | Y (dbt 1.8/1.10 docs) |
| p12-6-incident (9856) | KEEP / TIGHTEN | Reasonable; "Staff+" framing; the 10%-toil number is arbitrary | Keep the severity table; add a data-specific first-15-minutes checklist (freeze publish, flag consumers, preserve evidence/snapshot IDs) | Actionability | +5 | N |
## Duplication and numbering findings

### Parts 00–01 — Overview, Data Modeling
Within range:
- **Two §14s**: `p01-14-modeling-checklist--anti-patterns` (L1268) and `p01-14-surrogate-key-strategies-in-depth` (L1305). §14–17 sit after the chapter footer "Next: 02-batch-processing.md" (L1300) and an `<hr>`, so they were appended later.
- **Surrogate keys** ×2: §4 "Why surrogate keys" + cb4 (L459–480) and §14 (L1305–1345). Contradictory advice (Snowflake 64-bit HASH vs "128+ bit").
- **Accumulating snapshot** ×2: §5 cb6 `fact_order_fulfillment` (L499–519) and §17 `fct_order_lifecycle` (L1403–1432). Naming conventions are inconsistent (`fact_`/`_key` vs `fct_`/`_sk`).
- **Bounded/unbounded**: §1 overlaps §2's partitioning bullets.
- **Hash-diff SQL** repeated twice inside cb13 (UPDATE and INSERT). Factor into a CTE/view.

Cross-chapter (obvious):
- §1 vs `p02-1-mental-model-bounded-vs-unbounded-data-deep` (L1440) and `p03-1` (L2574).
- §2 Parquet internals vs Part 07 / Part 04 file-format sections.
- §7 SCD2 MERGE vs `p02-cdc--scd2` (L2185), `p08-design-scd-type-2-ingestion-from-kafka-cdc` (L7310), `p08-modeling-scd2-or-scd1-for-this-dimension` (L7468).
- §10 OBT vs `p08-modeling-star-schema-vs-obt--when-each` (L7459).
- §12 NULLs vs `p02-18-null-semantics-by-domain` (L2540) and `p05-126-not-in-with-nullable-subquery` (L5223).
- §13 schema evolution/contracts vs `p07-9-schema-evolution-column-id-semantics` (L6716), `p07-94-delta-schema-evolution` (L6739), `p07-135-auditing--data-contracts` (L6912), p08 L7541/L7568, and Part 12.
- §16 late-arriving vs `p08-incident-late-arriving-data-corrupted-yesterdays-report` (L7217) and Part 03 watermark sections.
- §11 medallion + Iceberg MERGE vs Part 07 §6 (L6539).

Recommendation: Part 01 owns modeling semantics (grain, SCD, late dims, contracts as modeling). Link out for storage/engine mechanics (Parquet, MERGE internals, schema-evolution internals → 07; NULL SQL semantics → 05).

---

### Part 02 — Batch Processing
- h2 numbering 1–18 is contiguous with no duplicates. **But** the "Next: … `03-streaming-processing.md`" footer (L2366) plus `<hr />` sits after §12, and §13–18 follow it: an appended-later block. Move the footer to the end of §18, and drop the `.md` filename from the link text (leftover from the per-file markdown era).
- Internal duplication:
  - §8 "Bucket partitioning" (L2030–2040) ≈ §17 "The bucketed-id trick" (L2522–2538). Near-identical `PARTITIONED BY (…, bucket(32, user_id))`.
  - §8 "cardinality sweet spot" vs §17 "Sizing heuristic": **contradictory numbers**.
  - §1 cb2 and §5 cb23 are the same Iceberg incremental read.
  - §3 Pattern 1 (cb5) and §5 Pattern 2 (cb22) are the same partition overwrite.
  - §6 "Backfills" and §12 "Backfill separation".
- Cross-chapter duplication:
  - §4 MERGE/COW/MOR ↔ Part 07 §6 `p07-6-merge-under-the-hood-cow-vs-mor`, §18 `p07-18-write-amplification-and-compaction-strategy`
  - §8 hidden partitioning ↔ Part 07 §5 `p07-5-hidden-partitioning-icebergs-killer-feature` (same heading text)
  - §9 compaction ↔ Part 07 §7 `p07-7-compaction-bin-packing-sorting-z-order`
  - §9 coalesce/repartition ↔ Part 04 §10 `p04-10-partitioning-coalesce-repartition--when-each-is-wrong`
  - §15 skew ↔ Part 04 §7 `p04-7-skew-detection-splitting-salting-aqe-handling`
  - §14 cost ↔ Part 11 (Cost Optimization), Part 04 §3
  - §11 DQ ↔ Part 12 (Data Quality), Part 08 `p08-observability-and-data-quality`
  - §10 CDC→SCD2 ↔ Part 08 `p08-design-scd-type-2-ingestion-from-kafka-cdc`
  - §6 backfills ↔ Part 08 `p08-quality-how-do-you-backfill-safely`
  - §17 ↔ Part 08 `p08-modeling-partition-by-user_id-or-by-date`
  - §18 NULL ↔ Part 01 §12 `p01-12-null-semantics--the-silent-source-of-bugs`
- Recommendation: Part 02 owns *idempotency, incremental, backfill, CDC, restart*. Physical layout internals go to Part 07, skew to Part 04, DQ tooling to Part 12. Leave one-paragraph summaries + links.

### Part 03 — Streaming Processing
**Within Part 03**
- Kafka EOS appears **three times**: section 7 Spark bullet (2866), section 9 "Kafka exactly-once" + cb23 (3049–3075), and section 16 (3457–3481). Consolidate into section 16. Section 9 keeps one cross-link line.
- Idempotent sink appears in section 7 (2927) and implicitly in section 16. It belongs in the section 7 "when EO matters" table.
- Temporal join: section 10 (3134–3147) and section 18 (3537–3539). Compaction/changelog: section 9 (3094) and section 18 (3522–3528). Merge section 18 into sections 9 and 10, or reduce it to a 5-line concept box.
- Late-data reconciliation / "streaming + batch audit": section 6 (2820–2826) and section 13 (3278–3286).
- Measuring lateness: section 3 (2646–2653) and section 6 (2830–2836), with the same PT−ET conflation in both.
- Session windows / sessionization: section 4 (2720), section 11 cb30, section 14, section 19 Pattern A. Four treatments.

**With other parts**
- Part 08 (Q-bank): L7070/L7352 "Design exactly-once for a payments-counting pipeline"; L7254 clickstream at 1M eps; L7420 "Walk me through a Flink checkpoint" (duplicates section 8 barrier steps); L7437 "watermark across a Kafka topic with 12 partitions" (duplicates the section 3 partitions subsection); L7160 "consumer lag climbing" incident (overlaps section 12); L7221 late data incident; L7633 "Lambda architecture in 2026?" (overlaps section 13). Part 09+: L7930 drill, L8072 failure catalog ("We used Kafka exactly-once so there are no duplicates"), L9357 behavioral watermark scenario. **Recommendation:** Part 03 is the reference; Part 08 answers should link to the Part 03 anchors instead of re-explaining.
- Part 02 L1467 "watermark-as-promise applied to batch" and L1726 "high watermark incremental" use "watermark" in the batch/HWM sense. A one-line disambiguation in section 3 would help.

**Numbering**
- **Section 15 is missing.** Section 14 is followed at 3451–3452 by `<hr />` and `<p>Next: <a href="#part-04"><code>04-spark-internals.md</code></a> — …</p>`, a Markdown-conversion artifact placed mid-part. Sections 16–21 were then appended below it. The same artifact exists in Part 02 at L2366 ("Next: 03-streaming-processing.md").
- Sections 16–19 `<h3>` elements (3461–3553, 15 headings) have **no `id`**, unlike every other h3 in the part. Sections 20–21 h3s use a different id scheme (`p03-20-kds`, `p03-21-saga`) than sections 1–14 (slugified).
- Part 03 has no `p03-contents` h2, while parts 04–08 do (`p04-contents` L3669, `p05-contents` L4717, …). Inconsistent.

---

### Parts 04–05 — Spark Internals, SQL Deep Dive
**Within range:**

- **Tungsten:** §8 (4113) and §17 (4614), with contradictory numbers (80 vs 60 bytes; 2–5× vs 10–100×). Merge into §8.
- **Memory / overhead / OOM:** §9 (4150–4206), §12.3 (4316), §14.3 and §17 bullets. Keep §9 as the single home.
- **Broadcast:** §6.2 (3992–4017) and §11 (4238–4271). Lifecycle, driver collect and threshold are repeated; merge §11 into §6.2 as the "tuning & gotchas" part.
- **Join algorithms:** Part 04 §6 and Part 05 §4. Part 05 should stay engine-neutral and link to p04-joins for Spark.
- **Sketches:** §11 (5164) and §16 (5323), with contradictory error figures. Merge.
- **CTE fences:** §12.7 (5225) and §15 (5294). Merge into §15.
- **LAST_VALUE frame trap:** three times (5044, 5411, 5423–5432). Keep once, in §7.6.
- **NOT IN:** §6.3 and §12.6. This one is fine; §12.6 is already a pointer.
- **Python UDF cost:** §12 (4274) and §20 (4693–4699), both with unsourced multipliers.

**Other chapters:**

- **AQE, BHJ vs SMJ, shuffle:** Part 08 at 7375–7395 restates §4/§6 and repeats the "shuffled output as broadcast" point. That is OK as Q&A if it links back, but fix it together with claim #7.
- **Skew / salting:** Part 02 at 2450 and Part 08 at 7203 and 7168.
- **Sessionization:** Part 03 at 3289–3376 (streaming) and Part 09 Q2 at 8332. Part 05 §9 should link to Part 03 rather than claim Flink equivalence.
- **Gaps and islands:** Part 09 at 7873 and 8341.
- **Window NULLs:** Part 01 at 1153.
- **Photon:** Part 11 at 9591.
- **Shuffle partitions:** Part 11 at 9639, which says 200 is "almost always wrong" and calls the broadcast threshold "configurable up to ~8 GB". Align with §14.

**Numbering gaps:**

- Part 04 h2s go 1–14, then "Closing framework", then **17, 18, 19, 20**. 15 and 16 are missing, and the appended sections sit after the closing framework.
- Part 05 h2s go 1–13, then **15–19**. 14 is missing.
- Neither Contents list includes the appended sections.
- Fix: renumber to 15–18 (Part 04, after merging §17 it becomes 15–17) and 14–18 (Part 05, after merging §16 into §11). Move "Closing framework" to the end.

---

### Parts 06–07 — Python, Lakehouse
- Part 06 h2 numbering: 1–12, Closing principle, then **15, 16, 17, 18** (13–14 missing). The appended sections sit *after* "Closing principle" and are absent from the TOC.
- Part 07 h2 numbering: 1–13, Closing principle, then **16, 17, 18, 19** (14–15 missing). Same pattern.
- Duplicate pairs and consolidation:
  - P06 §7 ↔ §15 (asyncio) → merge into §7. Keep §15's corrected S3 example and pitfalls.
  - P06 §4/§5 ↔ §16 (Polars/DuckDB/Arrow) → keep the §16 composition example as §5.3b; drop the rest.
  - P06 §9 ↔ §17 (dataclass/pydantic) → merge; keep "Level 3: schema registry".
  - P06 §11 ↔ §18 (packaging) → merge into §11.1 "Tooling & lockfiles" + fixed Dockerfile.
  - P07 §11 ↔ §16 (feature matrix) → one corrected matrix + §16's decision heuristic.
  - P07 §12 ↔ §17 (catalogs) → one section. Keep §17's migration trap and add a REST-spec subsection.
  - P07 §6/§7 ↔ §18 (write amplification/compaction) → fold the quantification into §6.1 and the delete-ratio rule into §7.6.
  - P07 §19 (multi-table) is unique → keep, renumbered §14.
  - Cross-part: P07 §5 duplicates P02 L1994 "Hidden partitioning (Iceberg's killer feature)". P07 §13.1 overlaps P02 §9 "Small Files and Compaction" (L2041). Cross-link rather than repeat.
- Resulting numbering: Part 06 §1–12 (+ Closing). Part 07 §1–14 (+ Closing), with the TOC updated.

### Parts 08–09 — Interview Scenarios, Prep Program
**Duplication**
- Feature store appears 3×: p08-q7b, p08-ml-and-feature-store-scenarios, p09-5 D.
- Dashboard mismatch appears 3×: p08-q2, p08 "KPI shows zero" h3, p09-5 B.
- Build vs buy: p08-q37 and p09-7.
- Lambda/Kappa: p08-q35 and p03-13.
- Observability, freshness SLA and DQ dimensions: p08-observability, p08-q29 vs p12-2, p12-3.
- Snowflake cost: p08-cloud vs p11-1.
- Testing: p08-q26 vs p06-10, p12-5.
- Contracts: p08-q28 vs p01-13.
- Behavioral: p08-q38 vs p09-6 frame 6; p08-q39 vs p09-6 "Failure Owned" vs 11.7.
- SQL bank Q2 and Q6 overlap p05-9 and p05-10.
- Contradiction: p08-q20 (keep star, OBT for marts) vs p09-7 ("denormalize almost always").

**Numbering and structure**
- Part 08 h2s are unnumbered. The TOC shows 1–42 but the anchors (`p08-q1…q41`, `q7b`) are offset by one from #8 on.
- The TOC misses the 3 trailing h2s, and "Closing meta-advice" is not last.
- Cross-refs say "chapter NN" while the page uses "Part NN"; make them links.
- Wrong cross-refs at 7411 and 7460 (see §3). "§F3 above" at 9083 should read "§2 F3".
- Outside scope: duplicate/missing section numbers elsewhere (p01 has two "14."; p03 has no 15; p04 jumps 14→17; p05 has no 14; p06 and p07 jump 12/13→15/16).

**Anchors**
- All `href="#…"` in 7038–9409 resolve (checked every target, including `#p05-asof` and `#top`). No duplicate ids.

**Unbalanced tags**
- 13 stray `</em>`, all in p09-11.
- Five lines have 2 strays each: 9168, 9196, 9224, 9258, 9288. Each contains `[What I'd do differently]</em>` with no opener, and the paragraph closes with `"</em></p>`.
- Three lines have 1 stray each: 9316, 9342, 9371, where the final `"</em></p>` has no opener.
- Fix: replace `[What I'd do differently]</em>` with `<em>[What I'd do differently]</em>` (×8), and on those 8 lines change the closing `"</em></p>` to `"</p>`.
- All other tags are balanced.
- Minor: raw `&` in `<h2 id="p08-observability-and-data-quality">Observability & Data Quality Scenarios` and `ML & Feature Store Scenarios`. Valid HTML5, but inconsistent with the `&amp;` used elsewhere.

---

### Parts 10–12 — Governance, Cost, Data Quality
- **Data contracts**: P1 §13 (1167–1200) is the deep version; P8 7541 and 7780; P9 9299–9302. P12 9827–9830 repeats it shallowly. Replace it with a cross-link.
- **Testing strategy**: P6 §10 (5906–6003: pyramid, chispa, dbt tests, Hypothesis, data vs code tests) is deeper than P12 §5. The P12 pytest block (9807) duplicates P6 §10.3. Cut it and link `#p06-10-testing-strategy-for-data-pipelines`.
- **Great Expectations / Soda**: also at 1254, 2268–2290, 5999, 7678. P2 2268 labels GX "imperative + metadata". Keep one canonical treatment (P12) and point to it.
- **Lineage / observability**: P8 7673 ("OpenLineage + custom"), 7768–7795 ("Design a data-quality monitoring system", freshness SLAs, "KPI shows zero"). These overlap P10 §5 and P12 §2–3. Cross-link both ways.
- **Spark cost (P11 §5)**: duplicates P4 (broadcast 3830/3987/4014/4261/4466; shuffle partitions 3862–3972/4392–4421/4635; Photon §19 at 4658). **Contradiction: Photon "2–3x" (4660) vs "2–10×" (9592).**
- **Snowflake cost**: P8 7799–7810 ("bill tripled", AUTO_SUSPEND at 7803). Cross-link.
- **GDPR erasure / deletion vectors**: 662, 838, 2554, 6572, 7504, and P7 expire_snapshots (6674–6713). P10 §1 should link `#part-07` for the mechanics.
- **Catalogs**: P7 6853–6981 (Polaris, UC, Glue, REST) vs P10 §6 table. They overlap and are inconsistent in freshness.
- **Numbering**: h2s are numbered 1–9 / 1–6 / 1–6, restarting per part, which is consistent. P10 and P11 have no "Interview Q&A" or "Traps" subsection, unlike earlier parts.
- **Anchors**: script check found **0 broken `href="#…"`** across the file and **0 duplicate ids**. The only inbound links to Parts 10–12 are the chips (95) and the TOC (156/161/166). Parts 10–12 contain no outbound cross-links (only `#top`).
- **Tags**: balanced in scope. The only issues are the 9620 `<em>` artefact, unescaped `<`/`>` inside `<pre>` (9753–9769), and code blocks missing the `sourceCode` wrapper and language class.
## Version assumptions found in the text

### Parts 00–01 — Overview, Data Modeling
| Line | Assumption | Note |
|---|---|---|
| 103 | Python 3.11+, Spark 3.5+, Flink 1.18+ | Stale for 2026: Spark 4.0 (2025) and Flink 2.x exist. Verify current GA. |
| 241 | BigQuery `partition_expiration_days = 730` | Valid option |
| 252 | Postgres page 8 KB, MySQL/InnoDB 16 KB | Defaults; correct |
| 258, 262 | Parquet row group 128 MB, page 1 MB | parquet-mr/Spark defaults. Arrow/pyarrow writer defaults differ (row-count based). |
| 290 | Snowflake Hybrid Tables | GA 2024 (AWS). Verify region/cloud availability. |
| 674–719 | `nextval('seq')` PG syntax; `SHA2(...,256)` Snowflake/Spark | Mixed |
| 723–758 | Delta Lake Python API `DeltaTable.forName`, `whenMatchedUpdate` | Current. No Databricks AUTO CDC / APPLY CHANGES mention. |
| 761–773 | dbt snapshot Jinja block + `target_schema` | Legacy pre-1.9 style. dbt 1.9+ uses YAML snapshot config + `hard_deletes`. Verify. |
| 950 | Snowflake `TIMESTAMP` = NTZ | Only by default via `TIMESTAMP_TYPE_MAPPING` |
| 958 | DST 2026-03-08 US/Eastern gap | Correct (2nd Sunday of March 2026). `pytz` is legacy; `zoneinfo` is stdlib since 3.9. |
| 959+ | Data Vault 2.0 | DV 2.1 announced. Verify changes before citing. |
| 1125 | Iceberg format v2 | Spec v3 (deletion vectors, row lineage, variant, default values) is ratified. Engine support varies; verify. |
| 1147 | Postgres NULLs LAST on ASC | Correct |
| 1154 | LAG IGNORE NULLS | Spark 3.2+ (verify). Not supported in BigQuery. |
| 1172 | contract `version: 3.1.0` | Illustrative; not ODCS |
| 1262 | Iceberg promotions INT→LONG, FLOAT→DOUBLE | Also decimal precision widening (v1/v2). v3 adds more. Verify. |
| 1315 | UUIDv7 | RFC 9562 (2024). Native `uuidv7()` in Postgres 18. |

---

### Part 02 — Batch Processing
| Line | Statement | Note |
|---|---|---|
| 1674, 1678, 1684 | Iceberg v1/v2 COW/MOR, Delta DVs | No mention of Iceberg format v3 (deletion vectors, row lineage, variant); Databricks DV default-on |
| 1640 | `WHEN NOT MATCHED BY SOURCE` "some engines" | Delta 2.3+/Databricks, BigQuery, SQL Server, PostgreSQL 17+; not Snowflake. Name them |
| 1649 | `DISTINCT ON` in MERGE — "Postgres" | MERGE needs PostgreSQL 15+ |
| 1721 | `spark.databricks.delta.merge.repartitionBeforeWrite.enabled` | Delta config; default believed true — verify |
| 1776, 1784 | `Trigger.AvailableNow` | Spark 3.3+ |
| 1820–1828 | `airflow.decorators`, `max_active_tasks`, `.expand` | Airflow 2.3+; Airflow 3 prefers `airflow.sdk` imports |
| 1893–1895 | Row group 128 MB, page 1 MB, dictionary page 1 MB | parquet-java defaults, not universal |
| 1900 | "Parquet 2.5+" bloom filters | Likely wrong version (see §2 #19) |
| 1911–1912 | SNAPPY default; ZSTD "preferred in 2026" | Spark default is snappy; engine-specific |
| 1928 | ORC stripe 64 MB default | ORC default, OK |
| 2046 | implied `spark.sql.shuffle.partitions=200` | Spark default 200 |
| 2053 | advisoryPartitionSizeInBytes = 128MB | Default is 64 MB (Spark 3.x) |
| 2058, 2067 | Iceberg target file 128 MB / 512 MB | Iceberg default `write.target-file-size-bytes` = 512 MB |
| 2085 | `VACUUM RETAIN 168 HOURS` | Delta default retention 7 days; log retention 30 days |
| 2243–2262 | dbt `version: 2`, `tests:` | dbt 1.8+ uses `data_tests:` |
| 2269–2287 | Great Expectations fluent API | GX 0.17/0.18 only |
| 2291–2297 | Soda Core v3 SodaCL | Soda Core v4 (contracts) exists; keep v3 labelled |
| 2341 | "Airflow 2.4+" datasets | Assets in Airflow 3 |
| 2357–2364 | `sla`, `sla_miss_callback` | Removed in Airflow 3.0 |
| 2416–2419 | S3 $0.023, spot $0.01–0.02/vCPU-h, egress $0.02–0.09 | us-east-1 list, date-stamp them |
| 2456 | AQE skewJoin | Spark 3.0+; default on since 3.2 |

---

### Part 03 — Streaming Processing
| Line(s) | Assumption | 2026 status |
|---|---|---|
| 2711, 2728, 2779, 2803–2804, 2814, 3124, 3131, 3332–3333, 3489; TTL 2969, 3162 | Flink `Time.minutes/hours` (windows, allowedLateness, intervalJoin `between`, CEP `within`, `StateTtlConfig.newBuilder`) | Deprecated 1.19, **removed in Flink 2.0** → `Duration` |
| 2819 (`addSink`), 2950 (`addSource`) | SourceFunction/SinkFunction APIs | **Removed in 2.0** (use `fromSource` / `sinkTo`). cb19 would not compile even on 1.x with `KafkaSource`. |
| 2967 | `open(Configuration)` | 2.0: `open(OpenContext)` |
| 2968 | `ValueStateDescriptor(name, class, default)` | Deprecated for years; gone in 2.x → null-check |
| 2906, 3254, 3372 | `getCheckpointConfig().enableUnalignedCheckpoints()` | Setters deprecated in favour of config keys (`execution.checkpointing.*`) in 1.19/1.20; verify removal in 2.x |
| 2916, 3370 | `CheckpointingMode` (streaming package) | Moved to `org.apache.flink.core.execution.CheckpointingMode` in 1.20; old one removed in 2.0 (verify) |
| 3373–3374 | `setStateBackend(new EmbeddedRocksDBStateBackend(true))`, `setCheckpointStorage(String)` | Config-driven in 2.x (`state.backend.type`, `execution.checkpointing.dir`); verify |
| 2906, 3253 | "Unaligned (Flink 1.11+)" | OK; add buffer debloating 1.14+, alignment timeout |
| 3473 | Flink `TwoPhaseCommit` sink | `TwoPhaseCommitSinkFunction` removed in 2.0; the Sink V2 committer model replaces it |
| 3543 | Flink Stateful Functions | Dormant/unmaintained |
| 3037–3048, 3576 | ZooKeeper or KRaft; "KRaft default from 2024" | **Kafka 4.0 (Mar 2025): KRaft only** |
| 3078–3093 | Classic rebalance protocol only; "Cooperative sticky (Kafka 2.4+)" | KIP-848 consumer protocol GA in 4.0 |
| 3070 | `sendOffsetsToTransaction(offsets, String groupId)` | Deprecated since 2.5 (KIP-447) → `consumer.groupMetadata()`; verify removal in 4.0 |
| 3313 | `OffsetResetStrategy.LATEST` in Flink Kafka connector | Kafka 4.x clients deprecate `OffsetResetStrategy` (KIP-1106); connector-version-dependent. Verify. |
| 3022 | Consumers ≤ partitions | Share groups (KIP-932) in 4.x |
| 3034 | acks semantics, no mention of 3.0 defaults | Since 3.0 producers default to `acks=all` and `enable.idempotence=true` |
| 2866 | Spark Kafka sink transactional | Never true in any Spark version |
| 2835 | `F.unix_millis` | Spark 3.1+ |
| 3561, 3585 | "Kinesis Data Firehose"; "Kinesis Data Analytics (now MSF)" | Firehose renamed Amazon Data Firehose (2024); MSF rename (2023) is stated correctly |
| 3565 | KDS max record 1 MB | Raised to 10 MiB (2025). VERIFY. |
| 3587 | Firehose interval 60–900 s | 0–900 s (zero buffering). VERIFY. |

---

### Parts 04–05 — Spark Internals, SQL Deep Dive
- **3841 / 4425:** "AQE on by default 3.2+" is correct. Say "3.2+ (and 4.0)".
- **3907:** `CustomShuffleReader` is the 3.0/3.1 name.
- **3954:** push-based shuffle is 3.2+ and YARN-only; the YARN restriction is missing.
- **4038:** "default true in most Spark versions". It is true in all versions from 2.0 through 4.0; drop "most".
- **4275–4318, 4696:** pre-3.5 view of Python UDFs, with no Arrow-optimized UDFs.
- **4311 / 4546:** assumes the Databricks default (true), not OSS (false).
- **4349–4385:** plan predates 3.5's WindowGroupLimit.
- **4594 / 4648:** pre-3.0 view of dynamic allocation that ignores shuffle tracking.
- **4616:** Tungsten/WSCG version history is wrong.
- **4684:** pre-Spark-Connect (3.4+) architecture.
- **Whole Part 04:** no Spark 4.0 content.
  - No ANSI default (verified true in 4.0). This silently changes 2.4 item 5 (cast behavior), 5208 and any `CAST` failure; `try_cast` is never mentioned.
  - No Java 17/Scala 2.13 (verified in pom).
  - No VARIANT (grep "VARIANT" only hits "variant" words in gaps/islands).
  - No collations, pipe syntax, or Python data sources.
- **Absent everywhere in the file:** DPP (3.0), runtime bloom-filter join (3.3), and storage-partitioned join (3.3). grep: 0 hits.
- **5026:** "Spark rule" is unversioned; it arrived in 3.5.
- **5226 / 5303–5304:** the Postgres 12 CTE change is correctly versioned.
- **5269:** codec advice ignores ORC=zstd as the 4.0 default. Parquet is still snappy (verified).
- **5360–5362:** MV/Dynamic Tables are described circa 2023. No Databricks MVs/Lakeflow, no Snowflake MV restrictions.
- **Cross-engine SQL presented as runnable without a dialect:**
  - cb6 (`INCLUDE` is PG11+/SQL Server).
  - cb10 (`SEMI JOIN`).
  - cb13 / cb23 (LATERAL + LIMIT; Postgres/Trino).
  - cb14 (GROUPS).
  - cb20 (`generate_series`, `::date`: PostgreSQL/DuckDB).
  - cb21 (`INTERVAL '30 minutes'`, `EXTRACT(EPOCH …)`: PostgreSQL).
  - cb25 (DuckDB syntax, labelled "DuckDB / ClickHouse").
- **VERIFY (not checked):** Snowflake's default window frame for cumulative aggregates with ORDER BY. The Snowflake docs note a ROWS vs RANGE nuance. If it differs, 5010 and 5411 need an engine caveat.

---

### Parts 06–07 — Python, Lakehouse
- 5471–5476: `dis` output = 3.11/3.12; 3.13 fuses to `LOAD_FAST_LOAD_FAST`; 3.14 `LOAD_FAST_BORROW*`.
- 5491: switch interval 5 ms (unchanged since 3.2; fine).
- 5501, 5568, 5604, 5708: "pandas 1.x object strings" — pandas 3.0 (2026) defaults to Arrow `str`.
- 5502–5504: PEP 703 as 3.13-experimental; ignores 3.14 PEP 779.
- 5518: sizes are a mix of 3.11 and 3.12 values.
- 5523: `getrefcount` result can be lower on 3.14 (borrowed refs).
- 5526–5529: gc generations/thresholds pre-3.13/3.14.
- 5545: `__dict__` cost pre-3.11.
- 5587, 5659: Polars "1.0+ streaming", `streaming=True` (deprecated in 1.25).
- 5647, 6117: pandas 2 CoW opt-in.
- 5747: pre-3.12 `batched`.
- 5836: shared memory 3.8+ (fine). 5852: fork default (≤3.13).
- 5872: `slots=True` 3.10+ (fine). 5885: `utcnow` (deprecated 3.12).
- 5977: dbt `tests:` (pre-1.8 naming).
- 6040–6045: requires-python 3.11, pyspark 3.5.1, pyarrow≥15, pandas≥2.2 (stale for 2026: Spark 4.x, pandas 3).
- 6067–6076: Airflow 2 imports.
- 6087: pre-Nov-2024 Lambda SnapStart.
- 6251–6259: pre-PEP 751 pip; uv "maturing" (2024 view).
- 6274: `python:3.12-slim` (fine, but 3.13/3.14 current).
- 6380: Iceberg format v2 as "modern".
- 6477: Delta S3 commit (delta-rs vs delta-spark).
- 6606–6612: Delta DVs as opt-in (Databricks enables them by default on new tables; OSS default depends on version).
- 6647–6652: ZORDER as Delta's clustering answer (liquid clustering supersedes it).
- 6740: Delta column-mapping protocol numbers.
- 6743–6770: v2 delete files only (v3 DVs).
- 6828, 6873: branches tied to catalogs/V3.
- 6876–6879, 6983–6987: Polaris pre-graduation; OSS Unity barely mentioned.
- 7035: Iceberg "v1.4+" Transactions.

### Parts 10–12 — Governance, Cost, Data Quality
| Line | Assumption | Label needed |
|---|---|---|
| 9446 | CPRA dates | Operative 1 Jan 2023 |
| 9489 | OpenLineage package names | `apache-airflow-providers-openlineage` (Airflow ≥2.7), `openlineage-dbt`, `openlineage-spark` |
| 9502 | Unity Catalog "Databricks-centric" | UC OSS since Jun 2024; managed Iceberg / Iceberg REST (2025) |
| 9519 | "Google DLP" | Renamed Sensitive Data Protection (2023) |
| 9548 | Snowflake ACCESS_HISTORY | Enterprise Edition+ |
| 9569 | Credit $2–4; XS=1 … 2XL=32 | Standard (Gen1) warehouses; Gen2 and Snowpark-optimized warehouses bill at different rates (verify) |
| 9572 | Multi-cluster = Enterprise | Correct; add Standard/Economy scaling policy |
| 9581 | MVs / Search Optimization | Enterprise Edition+ |
| 9586–9595 | DBU price, SQL Warehouse types (Classic/Pro/Serverless), "Delta cache" | List-price date and cloud; "disk cache" name |
| 9601–9611, 9620, 9623 | S3 prices | us-east-1 list prices, date-stamp them |
| 9625–9634 | Redshift | Provisioned RA3 implied but not stated; Serverless differs (no WLM/VACUUM tuning) |
| 9639 | Shuffle partitions / AQE | AQE on by default since Spark 3.2 (P0 says Spark 3.5+) |
| 9676–9717 | GX | Currently 0.x (≤0.18); must be GX Core 1.x |
| 9833 | dbt YAML | dbt ≥1.8 `data_tests`; 1.10 `arguments:`; dbt_utils 1.x; dbt_expectations fork |
| 9807 | PySpark local | Spark 3.5 (Spark Connect / serverless: `.count()`/`.collect()` fine) |