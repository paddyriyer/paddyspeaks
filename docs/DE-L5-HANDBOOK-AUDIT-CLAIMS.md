# DE Interview Handbook — Claims Audit Appendix

_Every questionable statement found in the Stage 0 audit (2026-09-24), with the verbatim quote, the problem, the proposed replacement and a confidence rating. Line numbers refer to the pre-upgrade article (commit 1a19d02). Which of these were applied is recorded per part in [DE-L5-HANDBOOK-CHANGES.md](DE-L5-HANDBOOK-CHANGES.md)._

## Parts 00–01 — Overview, Data Modeling — QUESTIONABLE CLAIMS

Format: line | exact quote (raw HTML, unique in file) | problem | replacement (raw HTML) | confidence

1. **L229** | `partition-prune-or-fail settings like Snowflake's <code>REQUIRE_PARTITION_FILTER</code>, BigQuery's` | Snowflake has no such parameter or DDL option. The partition-filter guard is BigQuery-only (Databricks/Spark have none natively either). | `partition-prune-or-fail settings such as BigQuery's` — also add after the closing `)`: ` Snowflake has no equivalent; use <code>STATEMENT_TIMEOUT_IN_SECONDS</code>, resource monitors and views that force a date predicate.` | High

2. **L244** | `-- Snowflake equivalent: rely on clustering + session param` (and L245 QUERY_TAG line, L246) | QUERY_TAG is only a label; it enforces nothing. Resource monitors cap credits, not partition filters. | Delete L244–246. If a note is wanted: `<span class="co">-- Snowflake: no DDL equivalent. Guard with STATEMENT_TIMEOUT_IN_SECONDS + clustered views.</span>` | High

3. **L103** | `Code samples are runnable (Spark/PySpark, Flink, SQL on Snowflake/BigQuery/Postgres, Python)` | Many blocks are pseudocode or mixed-dialect (see §6). | `Code samples are labelled by engine; most are runnable, and illustrative fragments are marked as such (Spark/PySpark, Flink, SQL on Snowflake/BigQuery/Postgres, Python)` | High

4. **L286** | `<li>No FK constraints; integrity is pipeline-enforced.</li>` | Outdated. Snowflake, BigQuery, Redshift and Databricks accept declared, unenforced PK/FK. BigQuery and Snowflake (`RELY`) use them for join elimination. | `<li>FK constraints are declared but not enforced (Snowflake/BigQuery/Databricks); declare them anyway (with <code>RELY</code> where supported) for join elimination and BI tools. Integrity is pipeline-tested.</li>` | High

5. **L290** | `New engines (TiDB, CockroachDB, SingleStore, Snowflake Hybrid Tables) offer row + column storage` | CockroachDB has no columnar replica (row KV storage with vectorized execution). TiDB (TiFlash) reads are consistent, not merely "asynchronous". | `New engines (TiDB with TiFlash, SingleStore, Snowflake Hybrid Tables) offer row + column storage` | Medium-High

6. **L311** | `<code>ClassRoom(course_id, instructor, room)</code> where <code>(course_id, instructor) → room</code> and <code>instructor → room</code>. BCNF requires <code>instructor</code> to be a candidate key; it isn't, so decompose.` | A non-prime attribute depending on part of the key is a 2NF violation, so this is not a BCNF-specific case. | `<code>Enrollment(student, course, instructor)</code> with key <code>(student, course)</code>, where <code>(student, course) → instructor</code> and <code>instructor → course</code>. It is in 3NF (course is prime) but not BCNF, because <code>instructor</code> is a determinant but not a candidate key; decompose into <code>(student, instructor)</code> and <code>(instructor, course)</code>.` | High

7. **L257** | `column stats (min/max/null_count/distinct_count)` | `distinct_count` exists in the spec but mainstream writers (parquet-mr, Arrow) don't populate it. Page-level column/offset indexes are omitted. | `column stats (min/max/null_count; distinct_count exists in the spec but is rarely written), plus optional page indexes` | Medium

8. **L413** | `    session_key        BIGINT <span class="kw">PRIMARY</span> <span class="kw">KEY</span>,          <span class="co">-- surrogate per session</span>` | With `PARTITION BY RANGE (dt)` (L436), Postgres rejects the statement: a unique constraint on a partitioned table must include the partition key. | `    session_key        BIGINT <span class="kw">NOT</span> <span class="kw">NULL</span>,          <span class="co">-- surrogate; PK is (session_key, dt) because PG requires the partition key</span>` and add `PRIMARY KEY (session_key, dt)` | High

9. **L427** | `max_bitrate_kbps   <span class="dt">INT</span>,                         <span class="co">-- non-additive (use avg)</span>` | Max rolls up with MAX, not AVG. | replace `-- non-additive (use avg)` in that line with `-- non-additive (roll up with MAX)` | High

10. **L442** | `You need both if you want to compute weighted averages at higher grains.` | Weighted averages need additive components (bitrate×duration and duration), not max+avg. | `To roll up a weighted average bitrate, also store the additive components (e.g. <code>bitrate_kbps_x_ms</code> and <code>watch_ms</code>) and divide at query time.` | High

11. **L430** | `<span class="co">-- Degenerate dimensions</span>` | `qoe_score` below it is a (non-additive) measure, not a degenerate dimension. | `<span class="co">-- Degenerate dimension (ended_reason) + non-additive measure (qoe_score)</span>` | Medium

12. **L347** | `<span class="co">-- maintained via view</span>` | A stored column can't be maintained by a view. It goes stale daily. | Remove the column. Or `<span class="co">-- do NOT store; compute in a view (goes stale daily)</span>` | High

13. **L470** | `<span class="co">-- Snowflake HASH(x1,...) -&gt; BIGINT</span>` | Snowflake `HASH` is a 64-bit non-cryptographic hash. By the birthday bound, around 1B keys gives a ~2.7% chance of at least one collision, so it's unsafe as a surrogate PK. Snowflake documents it as unsuitable for unique keys. | `<span class="co">-- Snowflake HASH() is 64-bit, non-cryptographic: collision risk at 1e9 keys. Prefer MD5/SHA2 (128+ bit) for keys</span>` | High (math) / Medium (doc wording)

14. **L480** | `Spark's built-in <code>hash()</code> isn't guaranteed stable across versions, but <code>sha2</code> and <code>md5</code> are.` | The real problem is that `hash()` is 32-bit Murmur3 (collisions are certain at scale). The cross-version point is secondary. `concat_ws` also skips NULLs, so `('a',NULL,'b')` and `('a','b',NULL)` hash the same. | `Spark's built-in <code>hash()</code> is 32-bit Murmur3 (collisions are certain at warehouse scale) and <code>xxhash64()</code> is 64-bit; use <code>sha2</code>/<code>md5</code> for keys. Note that <code>concat_ws</code> skips NULLs, so coalesce each part to an explicit token first.` | High

15. **L498** | `always aggregate via <code>AVG</code> across time and <code>SUM</code> across entity` | For balance/MRR the usual answer is period-end (last snapshot), not AVG. AVG answers a different question. | `aggregate across time with the period-end value (or <code>AVG</code> when the question is "average balance"), and <code>SUM</code> only across entities` | Medium

16. **L662** | `Use for typo corrections, GDPR erasure of PII.` | Overwriting the current row doesn't erase PII in SCD2 history rows, snapshots, time travel, or bronze. | `Use for typo corrections. For GDPR erasure, Type 1 alone is insufficient: purge every version row, then expire snapshots/time travel (Delta <code>VACUUM</code>, Iceberg <code>expire_snapshots</code>, Snowflake Time Travel/Fail-safe windows) and bronze copies.` | High

17. **L675** | `Implemented as two statements because a single MERGE can't both update and insert the same logical record.` | False. The standard single-MERGE SCD2 unions stage rows with a NULL merge key for changed records (Delta docs' SCD2 example; common in Snowflake). | `Shown as two statements for clarity. A single atomic MERGE is possible by staging changed rows twice (once with a NULL merge key to force the insert); if you keep two statements, wrap them in one transaction or a failure leaves users with no current row.` | High

18. **L721** | `You can't both close the old row and insert a new one in the same MERGE without duplication.` | Same as #17. | `A single MERGE can do both if the source is pre-unioned so that each changed key appears once to match (close) and once with a NULL key (insert).` | High

19. **L674** | `The MERGE pattern (dialect-independent)</h4>` | cb13 mixes `SHA2`+`CONCAT_WS` (Snowflake/Spark/MySQL), `::VARCHAR` (PG/Snowflake) and `nextval('seq')` (PG only). It runs on no single engine. | `The two-statement pattern (Snowflake-flavoured; adapt sequence syntax)</h4>` | High

20. **L720** | `Use SHA-256 (not MD5; collision-free enough for dim-change detection).` | Change detection is compared per key and is non-adversarial, so MD5 is fine. No hash is "collision-free". | `MD5 is sufficient here (non-adversarial, compared per key); SHA-256 is fine if it is your platform standard. Hash a NULL token, not '', so NULL and empty string differ.` | High

21. **L774** | `Production-grade with one file.` | Snapshots only see state at run time (intermediate changes are lost). The check strategy full-compares large tables. Hard deletes are ignored unless configured. The syntax shown is legacy (dbt ≥1.9 prefers YAML snapshot config; `target_schema` superseded by `schema`). | `Caveats: it only captures changes visible at run time (use CDC for every change), deletes need <code>hard_deletes</code> (dbt 1.9+), and on 1.9+ prefer YAML-defined snapshots.` | High (semantics) / Medium (exact 1.9 key names; verify)

22. **L899** | `Generate it once, populate 20 years of rows, never touch again.` | The code generates 2010–2040 (31 years). Holidays and fiscal calendars do change. | `Generate it once for a wide range (the example uses 2010–2040); only holiday and fiscal attributes get maintained.` | High

23. **L950** | `<code>TIMESTAMP</code> in Snowflake/BigQuery is naive — wrap consistently.` | BigQuery `TIMESTAMP` is an absolute UTC instant; `DATETIME` is the naive type. Snowflake `TIMESTAMP` maps to `TIMESTAMP_NTZ` by default via `TIMESTAMP_TYPE_MAPPING`. Postgres TIMESTAMPTZ stores a UTC instant, not a zone. | `In BigQuery use <code>TIMESTAMP</code> (an absolute instant; <code>DATETIME</code> is naive). In Snowflake, <code>TIMESTAMP</code> defaults to <code>TIMESTAMP_NTZ</code> (see <code>TIMESTAMP_TYPE_MAPPING</code>), so declare <code>TIMESTAMP_TZ</code>/<code>_LTZ</code> or store UTC in NTZ by convention. None of these store the original zone; keep it in a separate column if you need it.` | High

24. **L955** | `event_ts <span class="kw">AT</span> <span class="dt">TIME</span> <span class="dt">ZONE</span> <span class="st">&#39;UTC&#39;</span> <span class="kw">AT</span> <span class="dt">TIME</span> <span class="dt">ZONE</span> u.timezone <span class="kw">AS</span> local_ts` | Correct only if `event_ts` is naive `timestamp`. The chapter recommends TIMESTAMPTZ, and with that the double AT TIME ZONE gives wrong results. For TIMESTAMPTZ the correct form is `event_ts AT TIME ZONE u.timezone`. The code also uses the user's current tz, not the tz at event time. | Add a comment line: `<span class="co">-- assumes event_ts is naive UTC timestamp; if TIMESTAMPTZ use: event_ts AT TIME ZONE u.timezone</span>` | High

25. **L958** | `Use library functions (<code>pytz</code>, Java ZonedDateTime) that raise errors rather than silently shift.` | `ZonedDateTime.of/ofLocal` silently shifts gap times forward (`ofStrict` throws). pytz raises only with `is_dst=None`. Python's `zoneinfo` (3.9+ standard) never raises and uses `fold`. | `Defaults silently shift: Java <code>ZonedDateTime.of</code> moves gap times forward (use <code>ZonedDateTime.ofStrict</code> to throw); Python <code>zoneinfo</code> never raises (check round-trip or <code>fold</code>); pytz raises only with <code>is_dst=None</code>. Validate explicitly.` | High

26. **L992** | `as long as hubs are loaded before their sats` | The point of DV2.0 hash keys is that hubs, links and sats load in parallel with no lookup dependency (FKs typically not enforced). cb24's `REFERENCES` contradicts this. | `because hash keys are computed from business keys rather than looked up, so no load order is needed (keep FKs unenforced)` | High

27. **L1005** | `the vault survives upstream changes with zero refactor` | Overstated. Source changes still add or split satellites and change staging. | `upstream changes are absorbed additively (new satellites/links) instead of by reshaping existing tables` | Medium

28. **L1083** | `Compressed storage cost is often lower than the original star due to better dictionary encoding across a wider table.` | Encoding is per column chunk, and repeated dim attributes can't be smaller than the star. Usually OBT is larger but close. | `Compressed storage overhead vs the star is usually modest, because repeated dimension values dictionary- and RLE-encode well within each column chunk.` | Medium-High

29. **L1068** | `<span class="kw">CLUSTER</span> <span class="kw">BY</span> (user_country_code, title_genre_primary);` (with L1067 `PARTITIONED BY (dt)`) | No engine accepts this DDL as a whole. Databricks liquid clustering (`CLUSTER BY`) can't be combined with `PARTITIONED BY`. BigQuery uses `PARTITION BY dt CLUSTER BY a, b` (no parens) and has no VARCHAR/TIMESTAMPTZ. | Label it as Databricks and drop `PARTITIONED BY (dt)` (use `CLUSTER BY (dt, user_country_code, title_genre_primary)`), or rewrite it as BigQuery DDL. | High

30. **L1095** | `<li><strong>Silver</strong> = conformed star schema (dims + facts), Kimball-style.</li>` | This is presented as the norm. The common Databricks convention puts cleansed/conformed entities in silver and Kimball stars/aggregates in gold. | `<li><strong>Silver</strong> = cleansed, conformed entities (some teams put the Kimball star here; others in gold).</li>` | Medium

31. **L1102** | `Idempotent ingest by source event ID.` | cb29 is a plain append stream, which gives no per-event-ID idempotency. The checkpoint gives exactly-once for the sink commit only; producer duplicates remain. | `Ingest is replay-safe (checkpointed sink commits); duplicates from producers are kept and deduplicated by event ID in silver.` | High

32. **L1120** | `Contract: "we will deliver every source event exactly once, preserve schema, and never backfill by overwrite."` | Bronze is realistically at-least-once. Promising exactly-once is a classic interview red flag. | `Contract: "we will deliver every source event at least once with a stable dedup key, preserve schema, and never backfill by overwrite."` | High

33. **L1125** | `Iceberg's row-level DELETE/MERGE (v2) makes this feasible at real latencies.` | Incomplete for 2026: frequent streaming upserts create many delete files and need compaction. Spec v3 adds deletion vectors. Spark streaming MERGE requires `foreachBatch`. | `Iceberg's row-level deletes (v2 delete files; v3 deletion vectors) make this feasible, provided you run frequent compaction; Spark streaming upserts go through <code>foreachBatch</code> + MERGE.` | Medium-High (verify v3 engine support)

34. **L1131** | `<li><code>a.x IS NOT DISTINCT FROM b.x</code> (Postgres, Spark)</li>` | Snowflake and BigQuery also support it, and Spark has `<=>`. Postgres can't hash- or merge-join on it (nested loop, which is slow on large joins). | `<li><code>a.x IS NOT DISTINCT FROM b.x</code> (Postgres, Snowflake, BigQuery, Spark; Spark also <code>&lt;=&gt;</code>). Postgres cannot use it as a hash/merge join key.</li>` | High (support) / Medium (PG join note)

35. **L1133** | `<li><code>equal_null(a.x, b.x)</code> (Snowflake)</li>` | This implies it is Snowflake's only option. Also exists in Spark 3.4+. | `<li><code>EQUAL_NULL(a.x, b.x)</code> (Snowflake; Spark 3.4+ <code>equal_null</code>)</li>` | Medium

36. **L1148** | `<li>MySQL: NULLs sort FIRST in ASC.</li>` | Incomplete. The engines interviewers care about are missing: Spark and BigQuery put NULLS FIRST on ASC; Snowflake follows the Postgres behaviour (NULLs high, `DEFAULT_NULL_ORDERING`). | `<li>MySQL, Spark, BigQuery: NULLs sort FIRST in ASC. Snowflake: like Postgres by default (<code>DEFAULT_NULL_ORDERING</code>).</li>` | High (Spark/BQ), Medium (Snowflake param)

37. **L1154** | `<code>LAG(x) IGNORE NULLS</code> (Snowflake/BigQuery) skips NULLs and returns the last non-NULL value` | BigQuery's LAG doesn't support IGNORE NULLS. It supports IGNORE NULLS on FIRST_VALUE/LAST_VALUE/NTH_VALUE. | `<code>LAG(x) IGNORE NULLS</code> (Snowflake, Spark 3.2+, Oracle; in BigQuery use <code>LAST_VALUE(x IGNORE NULLS) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)</code>) skips NULLs and returns the previous non-NULL value` | High (BQ), Medium (Spark version)

38. **L1256** | `<p>Iceberg and Delta both support safe evolution:</p>` | The bullets are Iceberg semantics. In Delta, rename/drop are metadata-only only with column mapping (`delta.columnMapping.mode='name'`), and type widening is a newer table feature. | `<p>Iceberg (column-ID based) supports these natively; Delta supports rename/drop only with column mapping enabled (<code>delta.columnMapping.mode = 'name'</code>) and type widening via the newer type-widening table feature:</p>` | High (column mapping) / Medium (widening versions)

39. **L1290** | `<li><strong>TIMESTAMP without timezone.</strong> Analytics broken after the next DST change.</li>` | Naive UTC by convention is fine and common (Snowflake NTZ). The bug is naive *local* time. | `<li><strong>Naive local timestamps.</strong> Ambiguous across DST; store UTC (typed or by documented convention) plus the source zone.</li>` | Medium

40. **L1292** | `<li><strong>Soft-delete without a partial index.</strong> <code>WHERE deleted = FALSE</code> becomes a full scan on billions of rows.</li>` | Warehouses and lakehouses don't have partial indexes. This advice is OLTP-only in a warehouse list. | `<li><strong>Soft-delete flags consumers must remember.</strong> Expose a view that filters <code>is_deleted</code> (and in OLTP back it with a partial index).</li>` | Medium

41. **L1297** | `If a column has 8 distinct values, it's a mini-dim candidate, not a VARCHAR fact column.` | Low-cardinality flags are a junk-dimension case. Mini-dims are for volatile attributes. In columnar stores an 8-value VARCHAR is nearly free (the chapter's own §2/§10). | `Low-cardinality flags scattered across facts are junk-dimension candidates; in columnar stores keeping them inline is also acceptable.` | Medium

42. **L1277** | `<li><strong>Are slowly-changing fact attributes modeled as mini-dimensions?</strong> Not VARCHAR columns.</li>` | Mini-dims are for rapidly changing *dimension* attributes. | `<li><strong>Are rapidly-changing dimension attributes split into mini-dimensions?</strong> So SCD2 doesn't explode.</li>` | Medium

43. **L1313** | `Apply a collision-resistant hash (SHA-256, xxhash) to the natural key tuple` | xxhash is non-cryptographic and xxhash64 is only 64-bit, so it is neither collision-resistant nor 128+ bit. | `Apply a 128+ bit hash (MD5, SHA-256; not 64-bit xxhash64/HASH) to the natural key tuple` | High

44. **L1323** | `<tr><td>Clustered storage efficiency</td><td><strong>Best</strong></td><td>Good</td><td>Worst</td></tr>` | Hash keys are uniformly random, which is the same clustering and min/max behaviour as UUIDv4. This contradicts L1315. | `<tr><td>Clustered storage efficiency</td><td><strong>Best</strong></td><td>Poor (random)</td><td>Poor (v4) / Good (v7)</td></tr>` | High

45. **L1332** | `-- Snowflake / BigQuery / Spark all agree on this pattern` | BigQuery has no `CONCAT_WS` and its `MD5` returns BYTES (needs `TO_HEX`). NULLs behave differently: Snowflake `CONCAT_WS` returns NULL if any arg is NULL, while Spark's skips NULLs. `CAST(date/timestamp AS STRING)` formats differ. Result: different keys per engine. | `-- Snowflake / Spark (BigQuery: TO_HEX(MD5(ARRAY_TO_STRING([...], '|')))). COALESCE each part to a NULL token and format timestamps explicitly, or keys differ across engines` | High

46. **L1363** | `  weight          DECIMAL(6,4),  -- optional: allocate claim value across codes` | Contradicts L1367 "The weight column is not optional." | `  weight          DECIMAL(9,8) NOT NULL,  -- allocation; must SUM to 1 per claim_sk` | High

47. **L1398** | `When the full dim row arrives later, update in place (SCD Type 1) or issue a new version (SCD Type 2).` | Kimball: overwrite the inferred member row's attributes in place even for SCD2 dims. A new version would leave earlier facts pointing at the empty placeholder. | `When the full dim row arrives, overwrite the inferred row in place (even in an SCD2 dim, so earlier facts pick up the attributes); later changes create new versions normally.` | High

48. **L1400** | `Let the fact land with a NULL dim key. Never recommended — downstream SQL silently drops rows.` | Omits the standard alternative (unknown member). | `Let the fact land with a NULL dim key: inner joins silently drop rows. If you can't infer, point at a reserved <code>-1 'Unknown'</code> member and reprocess later.` | High

49. **L1012** | `<li><strong>Unqueryable directly</strong>.` | Overstated. The vault is queryable, just join-heavy. PIT/bridge tables exist for this. | `<li><strong>Awkward to query directly</strong>. PIT and bridge tables help, but BI usually reads an information mart on top.` (keep the remaining text) | Medium

---

## Part 02 — Batch Processing — QUESTIONABLE CLAIMS

Format: line · **exact quote** · what's wrong · proposed replacement (raw HTML) · confidence

1. **L1567** · `<code>f(f(x))(S_0) = f(x)(S_0)</code>` · Garbled notation (the job applied to itself). Idempotency means applying the job to the resulting state again is a no-op. · `<code>f(f(S_0)) = f(S_0)</code>` · High

2. **L1580** · `.option(<span class="st">&quot;replace-where&quot;</span>, <span class="ss">f&quot;dt = &#39;</span><span class="sc">{</span>ctx` · Iceberg has no `replace-where` write option. `replaceWhere` is a Delta option. With Iceberg, `.mode("overwrite")` via v1 `saveAsTable` replaces the **whole table** (dynamic overwrite needs `spark.sql.sources.partitionOverwriteMode=dynamic` or `overwritePartitions()`). Silent full-table overwrite risk. · Replace cb5 body with: `df.writeTo(<span class="st">&quot;warehouse.silver.playback_sessions&quot;</span>).overwritePartitions()  <span class="co"># Iceberg: dynamic overwrite of partitions present in df</span>` and add a Delta alternative: `.format(<span class="st">&quot;delta&quot;</span>).mode(<span class="st">&quot;overwrite&quot;</span>).option(<span class="st">&quot;replaceWhere&quot;</span>, <span class="ss">f&quot;dt = &#39;{ctx.logical_date}&#39;&quot;</span>)` · High

3. **L1582** · `<p>The <code>replace-where</code> clause scopes the overwrite to that one partition.` · Follows from #2. · `<p><code>overwritePartitions()</code> (Iceberg) or <code>replaceWhere</code> (Delta) scopes the overwrite to the partitions being written.` · High

4. **L1754** · `.option(<span class="st">&quot;replace-where&quot;</span>, <span class="ss">f&quot;dt = &#39;</span><span class="sc">{dt}</span>` · Same as #2. · Same fix: `processed.writeTo("silver.events").overwritePartitions()` · High

5. **L1742** · `Clock skew across producers can push HWM forward too fast. Fix: use event_ts not processing_ts.` · Backwards. Client clock skew lives *in* `event_ts`: one device with a future clock advances an event_ts-based HWM and skips everyone else. The fix is a server-assigned, monotonic ingestion timestamp or sequence/offset. · `Clock skew across producers can push an <code>event_ts</code>-based HWM forward too fast (one device with a future clock skips everyone else). Fix: drive the HWM from a server-assigned ingestion timestamp or a monotonic offset/sequence, and keep <code>event_ts</code> for business logic.` · High

6. **L1758** · `<p>Read only the changes to a source table since the last processed snapshot.</p>` · Iceberg incremental read (`start-snapshot-id`/`end-snapshot-id`) returns only rows from **append** snapshots. It errors or skips on overwrite/delete snapshots, so it doesn't return updates or deletes. Delta CDF must be enabled (`delta.enableChangeDataFeed=true`) before the versions read. · `<p>Read only what changed since the last processed snapshot. Iceberg's incremental read returns <em>appended</em> rows only (use the <code>create_changelog_view</code> procedure for updates/deletes); Delta CDF returns inserts, updates and deletes but only for versions written after <code>delta.enableChangeDataFeed</code> was set.</p>` · High

7. **L1479** · `<span class="co"># Iceberg incremental read — only snapshots since the last run</span>` · Same append-only caveat. · `<span class="co"># Iceberg incremental read — appended rows only, from snapshots since the last run</span>` · High

8. **L1787** · `streaming semantics (state, checkpoints, exactly-once)` · Exactly-once holds only end-to-end with a replayable source + idempotent/transactional sink. · `streaming semantics (state, checkpoints, exactly-once into transactional sinks like Iceberg/Delta)` · Medium

9. **L1673** · `updating 1% of rows in a 10 GB file still rewrites the whole 10 GB file` · Lakehouse data files are typically 128 MB–1 GB (Iceberg default target 512 MB). The real problem is 1% of rows spread across *many* files. · `updating 1% of rows scattered across 1,000 files of 512 MB can rewrite all 1,000 files (~500 GB)` · Medium

10. **L1674** · `Iceberg v2 and Delta support "merge-on-read" mode where deletes/updates are stored as separate delete files (positional or equality deletes), merged at read time.` · Delta doesn't use positional/equality delete files. It uses **deletion vectors**. Iceberg format v3 (2025) also replaces position-delete files with deletion vectors. · `Iceberg (format v2: position/equality delete files; v3: deletion vectors) and Delta (deletion vectors) support "merge-on-read", where deletes/updates are recorded separately and applied at read time.` · High

11. **L1678** · `Copy-on-write (default in Iceberg v1, Delta default):` · Iceberg v1 has no row-level deletes at all. COW is Iceberg's default `write.delete/update/merge.mode` in v2 too. Delta: deletion vectors are enabled by default for new tables on Databricks (recent DBR); OSS Delta defaults off. · `Copy-on-write (Iceberg default write.*.mode; Delta without deletion vectors):` · High (Iceberg) / Medium (Databricks default wording)

12. **L1684** · `Merge-on-read (Iceberg v2, Delta with deletion vectors):` · Needs an explicit table property. · `Merge-on-read (Iceberg v2+ with write.*.mode=merge-on-read; Delta with deletion vectors):` · Medium

13. **L1698** · `<p>Without the partition predicate in the ON clause, the engine scans all partitions.</p>` · Overstated. Also `t.dt = s.dt` alone prunes only through dynamic/runtime filtering (Databricks DFP, Spark runtime filters), not static planning. · `<p>Without a pruning predicate the engine may scan every target file. <code>t.dt = s.dt</code> prunes only via dynamic/runtime filtering; adding a literal bound (<code>AND t.dt &gt;= '2026-04-01'</code>) guarantees static pruning.</p>` · Medium

14. **L1722** · `Monitor <code>numOutputRows</code> vs <code>numTargetRowsUpdated</code>` · The write-amplification signal in Delta MERGE `operationMetrics` is `numTargetRowsCopied` (untouched rows rewritten) versus updated. · `Monitor <code>numTargetRowsCopied</code> vs <code>numTargetRowsUpdated</code> (from <code>DESCRIBE HISTORY</code>)` · Medium

15. **L1721** · `spark.databricks.delta.merge.repartitionBeforeWrite.enabled = true` · As far as I know this has defaulted to `true` in Delta OSS for years, so the tip is a no-op. VERIFY before changing. · If verified: `<li>Delta repartitions by partition columns before MERGE writes by default (<code>spark.databricks.delta.merge.repartitionBeforeWrite.enabled</code>); check it hasn't been disabled.</li>` · Medium

16. **L1843** · `airflow dags trigger backfill_playback -p '{"start":"2026-01-01","end":"2026-02-01"}'` · `airflow dags trigger` has no `-p`. Conf is passed via `-c/--conf`. The DAG also declares no `params`. Airflow 3 has native backfill. · `airflow dags trigger backfill_playback --conf '{"start":"2026-01-01","end":"2026-02-01"}'` (plus `params={"start": ..., "end": ...}` on `@dag`; mention `airflow backfill create --dag-id ... --from-date ... --to-date ...` in Airflow 3) · High

17. **L1848** · `a fact backfilled today joins to dim versions that were current on the backfill date, not today.` · Ambiguous: "backfill date" reads as the run date. It must be the fact's event time. · `a backfilled fact must join to the dim version valid at the fact's event time (<code>event_ts &gt;= valid_from AND event_ts &lt; valid_to</code>), not to the current row.` · Medium

18. **L1893** · `<strong>Row group size</strong>: 128 MB default.` · Writer-specific (parquet-java/Spark `parquet.block.size`). pyarrow defaults by row count; DuckDB and others differ. · `<strong>Row group size</strong>: 128 MB default in parquet-java/Spark (<code>parquet.block.size</code>); other writers (pyarrow, DuckDB) default by row count.` · Medium

19. **L1900** · `Bloom filters (Parquet 2.5+, optional)` · Bloom filters were added to parquet-format later (~2.7, with parquet-java 1.12 writing them). Spark writes them only when `parquet.bloom.filter.enabled` is set. · `Bloom filters (parquet-format 2.7+/parquet-java 1.12+, opt-in via <code>parquet.bloom.filter.enabled</code>)` · Medium (verify exact format version)

20. **L1904** · `<li>PLAIN — raw values, no compression.</li>` · PLAIN is an *encoding*. The page compression codec still applies. · `<li>PLAIN — values stored unencoded (the page codec still compresses them).</li>` · High

21. **L1914** · `<li>LZ4 — fastest decompression.</li>` · The legacy Parquet `LZ4` codec (Hadoop framing) is deprecated. `LZ4_RAW` is the interoperable one. · `<li>LZ4_RAW — very fast; avoid legacy <code>LZ4</code> (Hadoop framing, deprecated in the spec).</li>` · Medium

22. **L1921** · `apply predicates again at page level (if dictionary-filter eligible)` · Conflates dictionary filtering (row-group level) with page-level pruning, which uses the Page Index (ColumnIndex/OffsetIndex). · `prune further: dictionary filtering drops row groups whose dictionary lacks the value; the page index (ColumnIndex/OffsetIndex) skips pages by min/max` · Medium

23. **L1974** · `<span class="kw">SET</span> <span class="kw">PARTITION</span> SPEC (days(event_ts), bucket(<span class="dv">16</span>, user_id));` · Not valid Iceberg Spark SQL. Evolution uses `ADD/DROP/REPLACE PARTITION FIELD` (Trino uses `SET PROPERTIES partitioning = ARRAY[...]`). · `<span class="kw">ADD</span> <span class="kw">PARTITION</span> FIELD bucket(<span class="dv">16</span>, user_id);` · High

24. **L1980** · `sees partition spec <code>days(event_ts)</code> → partition column <code>dt</code>.` · Hidden partitioning has no `dt` column. The walkthrough mixes Hive and Iceberg. · `sees partition spec <code>days(event_ts)</code> and converts the <code>event_ts</code> range predicate into a day-partition range.` (and change the example query to `WHERE event_ts &gt;= '2026-04-19' AND event_ts &lt; '2026-04-20' AND country = 'US'`) · Medium

25. **L1989** · `<li>Function on partition column: <code>WHERE DATE(event_ts) = '2026-04-19'</code> — planner can't prove this matches partition <code>days(event_ts)=2026-04-19</code>.` · `event_ts` isn't the partition column. Whether a wrapped expression prunes is engine/version-specific. · `<li>Wrapping the source column in a function: <code>WHERE DATE(event_ts) = '2026-04-19'</code> may not be converted into a partition filter (engine/version-dependent), and on a Hive table partitioned by <code>dt</code> it never prunes.` · Medium

26. **L2009** · `event_ts <span class="kw">BETWEEN</span> <span class="st">&#39;2026-04-19&#39;</span> <span class="kw">AND</span> <span class="st">&#39;2026-04-20&#39;</span>` · BETWEEN is inclusive, so it includes `2026-04-20 00:00:00` and touches the 04-20 partition too. That contradicts the comment "matches 2026-04-19 partition", and it's the classic double-count bug. · `event_ts <span class="op">&gt;=</span> <span class="st">&#39;2026-04-19&#39;</span> <span class="kw">AND</span> event_ts <span class="op">&lt;</span> <span class="st">&#39;2026-04-20&#39;</span>` · High

27. **L1996** · `<p>Iceberg: partition derived from source column. User writes <code>WHERE event_ts BETWEEN ...</code>` · Same BETWEEN habit. · `<p>Iceberg: partition derived from source column. User writes <code>WHERE event_ts &gt;= ... AND event_ts &lt; ...</code>` · Medium

28. **L2035** · `Joins on that key can use bucketed joins (skip shuffle if both sides are bucketed identically).` · Iceberg bucket transforms aren't Hive/Spark buckets. Shuffle-free joins need storage-partitioned join (Spark 3.3+, `spark.sql.sources.v2.bucketing.enabled` and related configs). · `Joins on that key can avoid a shuffle via storage-partitioned join (Spark 3.3+ with <code>spark.sql.sources.v2.bucketing.enabled</code>) when both sides share the same bucket spec.` · Medium

29. **L2053** · `<code>spark.sql.adaptive.advisoryPartitionSizeInBytes = 128MB</code> — AQE coalesces output partitions to hit this target.` · AQE coalesces *post-shuffle* partitions only (default 64 MB). It affects file count only if the last stage before write is a shuffle. · `<code>spark.sql.adaptive.advisoryPartitionSizeInBytes</code> (default 64 MB) — AQE coalesces post-shuffle partitions; it shapes output files only when a shuffle (e.g. Iceberg <code>write.distribution-mode=hash</code>) precedes the write.` · High

30. **L2051** · `reduces file count without shuffle. Use N = target_data_size / target_file_size.` · Missing the trap: `coalesce` collapses the *upstream* stage to N tasks too, so a heavy transform runs on N cores. · `reduces file count without a shuffle, but also shrinks the upstream stage to N tasks; use <code>repartition</code> when the preceding work is heavy.` · Medium

31. **L2086** · `If compliance requires 7-year retention, configure accordingly.` · Using time travel for 7-year retention is an anti-pattern (Delta also bounds it by `logRetentionDuration`, default 30 days, and cost grows). · `Don't use time travel as a retention mechanism; for long-term audit, use Iceberg tags or an immutable archive/export.` · Medium

32. **L2105** · `<p>Pros: guaranteed correctness, no state.` · A parallel JDBC read (`numPartitions=20`) opens 20 connections at different moments, so it isn't a consistent point-in-time snapshot. · `<p>Pros: captures hard deletes, no CDC state. Caveat: parallel JDBC reads are not one consistent snapshot unless you read from a snapshot/replica.` · Medium

33. **L2121** · `Read from the database's write-ahead log (Postgres logical replication, MySQL binlog, SQL Server CDC).` · The binlog isn't a WAL. SQL Server connectors read CDC change tables, not the log directly. · `Read the database's change log (Postgres WAL via logical decoding, MySQL row-based binlog, SQL Server CDC change tables, Oracle redo via LogMiner).` · Medium

34. **L2127** · `<span class="st">&quot;0/30A3B8&quot;</span>` · Debezium Postgres `source.lsn` is numeric (long), not the `X/Y` text form. The envelope also omits `source.ts_ms` (commit time). · `<span class="dv">3187640</span><span class="fu">,</span> <span class="dt">&quot;ts_ms&quot;</span><span class="fu">:</span> <span class="dv">1713567889950</span>` · Medium

35. **L2129** · `<p>Ops: <code>c</code> (create/insert), <code>u</code> (update), <code>d</code> (delete), <code>r</code> (snapshot read).</p>` · Incomplete. There's also `t` (truncate), and a delete is followed by a Kafka **tombstone** (null value) by default. · `<p>Ops: <code>c</code> (insert), <code>u</code> (update), <code>d</code> (delete), <code>r</code> (snapshot read), <code>t</code> (truncate). After a delete, Debezium emits a tombstone (key, null value) for log compaction by default — your parser must skip nulls.</p>` · High

36. **L2132** · `<li>Sub-second lag.</li>` · Overstated. Debezium is typically seconds. Fivetran and DMS (listed in the heading) sync on schedules or at minutes-level latency. · `<li>Seconds-level lag with Debezium; managed tools (Fivetran, DMS) are typically minutes.</li>` · Medium

37. **L2135** · `<li>Works without touching the source.</li>` · False. It needs `wal_level=logical` + a replication slot (PG), `binlog_format=ROW`/`binlog_row_image=FULL` (MySQL), or CDC enabled per table (SQL Server). A stalled consumer pins WAL and can fill the source disk. · `<li>No query load on source tables — but not zero-touch: needs logical WAL + a replication slot / row-based binlog. A stalled consumer retains WAL and can fill the source disk.</li>` · High

38. **L2164** · `&quot;t.order_id = s.after.order_id OR (s.op = &#39;d&#39; AND t.order_id = s.before.order_id)&quot;` · (a) The OR in ON defeats the equi-join (nested-loop/broadcast-all, no pruning). (b) The micro-batch isn't deduped per key, so a MERGE multi-match error follows as soon as a key changes twice in 30 s. · Pre-compute `key = coalesce(after.order_id, before.order_id)`, keep the latest per key by LSN (`row_number() over (partition by key order by lsn desc) = 1`), then `&quot;t.order_id = s.key&quot;` · High

39. **L2167** · `.whenMatchedUpdateAll(condition<span class="op">=</span><span class="st">&quot;s.op = &#39;u&#39; AND s.ts_ms &gt; t.cdc_ts_ms&quot;</span>)` · `UpdateAll` maps by source column names (`op`, `after`, `before`, `ts_ms`), which don't match target columns, so it fails analysis. The envelope `ts_ms` is connector processing time, not commit order. Deletes have no ordering guard. `u` for a key not yet in the target (an `r` gap) is dropped. · Flatten `after.*` first and guard on LSN: `.whenMatchedUpdate(condition=&quot;s.op IN (&#39;u&#39;,&#39;c&#39;,&#39;r&#39;) AND s.lsn &gt; t.src_lsn&quot;, set={...})`. Add the same `s.lsn &gt; t.src_lsn` to the delete. Insert on `s.op != &#39;d&#39;`. · High

40. **L2184** · `<p>The <code>cdc_ts_ms &gt; t.cdc_ts_ms</code> guard prevents out-of-order CDC events from overwriting a newer state with an older one.</p>` · Doesn't match the code (`s.ts_ms`). Wrong ordering field. · `<p>The <code>s.lsn &gt; t.src_lsn</code> guard (on updates <em>and</em> deletes) makes replays and out-of-order events harmless. Order by source LSN/binlog position, not envelope <code>ts_ms</code>, which is when Debezium processed the event.</p>` · High

41. **L2295** · `values in (device_type) must be in [&#39;tv&#39;,&#39;mobile&#39;,&#39;tablet&#39;,&#39;web&#39;,&#39;other&#39;]` · Not SodaCL syntax. · `invalid_count(device_type) = 0:` followed by an indented `valid values: [&#39;tv&#39;, &#39;mobile&#39;, &#39;tablet&#39;, &#39;web&#39;, &#39;other&#39;]` · High

42. **L2272** · `ds <span class="op">=</span> context.sources.add_pandas(<span class="st">&quot;pd&quot;</span>)` · GX 0.17/0.18 fluent API. GX 1.x (2024+) uses `context.data_sources`, `ExpectationSuite` + `ValidationDefinition`/Checkpoint. `get_validator`/`save_expectation_suite` are gone. · Rewrite for GX 1.x, or drop the block and point to Part 12 · High (API change) / Medium (exact 1.x calls — verify)

43. **L2341** · `dataset-based scheduling (Airflow 2.4+)` · Renamed to **Assets** in Airflow 3.0. · `data-aware scheduling (Datasets in Airflow 2.4+, renamed Assets in Airflow 3)` · High

44. **L2343** · `<p><strong>Never</strong> use the same DAG for daily and backfill.` · Dated absolute. Airflow 3 backfills are scheduler-managed runs of the same DAG with their own concurrency limits. · `<p>Keep backfills from starving daily runs: Airflow 3 runs backfills of the same DAG through the scheduler (cap with <code>--max-active-runs</code>); otherwise use a separate DAG/pool.` · Medium

45. **L2362** · `<span class="st">&quot;sla&quot;</span>: timedelta(hours<span class="op">=</span><span class="dv">1</span>),` (and L2358 `sla_miss_callback`) · Task `sla` and `sla_miss_callback` were **removed in Airflow 3.0**. Deadline Alerts replace them (3.1+). · Label as "Airflow 2.x only". Add Airflow 3 Deadline Alerts, or recommend an external freshness monitor (table-level SLO) · High

46. **L2387** · `build the adjacency matrix, compute longest-path via topological sort + dynamic programming. O(V+E).` · An adjacency matrix gives O(V²). The shown code scans every edge per node, which is O(V·E). · `build an adjacency list, compute longest-path via topological sort + dynamic programming in O(V+E) (the sketch below scans the edge list per node for brevity).` · High

47. **L2416** · `For Glacier, ~1/10 of that.` · Imprecise across tiers. · `Glacier Instant/Flexible ~$0.004/GB-month (~1/6); Deep Archive ~$0.001 (~1/23), plus retrieval fees and minimum-duration charges.` · Medium (verify current list prices)

48. **L2424** · `Shuffle amplification typically 2–4x input — say 30 TB of shuffle.` · Shuffle is usually ≤ input after projection/filter/compression. 30 TB on 100 vCPU in 40 min isn't physically plausible (~12.5 GB/s sustained write + read on ~12 nodes' local disk). · `Shuffle is usually a fraction of input after projection and filtering — say 5 TB. Realistic runtime: ~1–2 h on 400 vCPUs.` (then recompute compute ≈ 400 × 1.5 × $0.02 ≈ $12, before the platform premium) · Medium

49. **L2430** · `<li>Egress: zero if same region, ~$900 if cross-region output</li>` · Arithmetic error: 2 TB output × ~$0.02/GB inter-region ≈ **$40**. $900 is 10 TB at internet-egress rates. · `<li>Egress: zero same-region; ~$40 to write the 2 TB output cross-region (~$0.02/GB); ~$200 to read the 10 TB input cross-region; ~$900 if 10 TB leaves AWS to the internet</li>` · High

50. **L2433** · `The answer "this job costs roughly $1.50 same-region, $900+ cross-region" is the senior-level answer. Notice the 600x swing just on egress` · Derived from #48/#49. It also omits the platform premium (EMR/Databricks DBU), S3 requests and EBS. · `A defensible answer: "~$10–20 of compute same-region (plus platform premium), and another ~$40–200 if the data crosses regions — egress can exceed compute by 10x." That is why lift-and-shift to another region is so often the wrong move.` · High

51. **L2453** · `(<code>key + '_' + RAND(10)</code>)` · In Spark SQL `RAND(10)` is a seeded uniform [0,1) double, not an int in 0–9. `+` isn't string concat. The small side must be replicated ×N. · `(<code>CONCAT(key, '_', CAST(FLOOR(RAND() * 10) AS INT))</code>, with the other side exploded over <code>salt IN 0..9</code>)` · High

52. **L2456** · `Configure <code>spark.sql.adaptive.skewJoin.enabled=true</code>, know what <code>skewedPartitionThresholdInBytes</code> controls.` · It's already on by default (AQE default since Spark 3.2). The detection rule and scope aren't given. · `Enabled by default with AQE (Spark 3.2+). A partition is skewed if it exceeds both <code>skewedPartitionFactor</code> (default 5) × median and <code>skewedPartitionThresholdInBytes</code> (default 256 MB). It splits sort-merge (and, 3.3+, shuffled-hash) join partitions only — not aggregations.` · Medium

53. **L2473** · `write to a temp location, validate, then atomic rename or commit.` · Object stores (S3/GCS) have no atomic directory rename (copy+delete). · `write to a temp location, validate, then commit atomically (table-format snapshot commit or metadata pointer swap) — object-store "rename" is copy+delete and is not atomic.` · High

54. **L2499** · `High volume; hourly grain keeps partitions under ~1 TB` · Contradicts §8 (hundreds of MB–few GB) and L2520 (~100 MB–~10 GB). · `High volume; hourly grain keeps partitions within the ~1–10 GB target at a few hundred GB/day` · Medium

55. **L2520** · `For a daily-partitioned 1 TB/day fact, that's ideal. For a 100 GB/day fact, daily is still fine. For a 10 TB/day fact, move to hourly.` · 1 TB/day is 100x the stated ~10 GB ceiling. 10 TB/day hourly is still ~420 GB per partition. The heuristic contradicts itself. · `Partitions don't need to be small — files do. Daily is fine from ~1 GB to multiple TB/day, provided files are 128 MB–1 GB and data is clustered within the partition. Go hourly only when queries are hour-bounded; under ~1 TB total, prefer no partitioning plus clustering.` · Medium

56. **L2551** · `Prefer a sentinel value over NULL: <code>-1</code> for scores, <code>'UNASSIGNED'</code> for enums` · A numeric `-1` sentinel poisons AVG/MIN/SUM. The enum sentinel is fine. · `Enums: a sentinel like <code>'UNASSIGNED'</code>. Numerics: keep NULL and add a reason column (<code>score_status='declined'</code>) — a <code>-1</code> sentinel silently corrupts AVG/MIN.` · Medium

57. **L1471** · `<span class="cf">assert</span> datetime.utcnow()` · `datetime.utcnow()` is deprecated since Python 3.12. `assert` is also stripped under `python -O`, so it's unsafe as a production guard. · `<span class="cf">if</span> datetime.now(timezone.utc)` … `raise` (use an explicit raise, not assert) · Medium

---

## Part 03 — Streaming Processing — QUESTIONABLE CLAIMS (all quoted strings verified unique in the file)

| Line | Exact raw-HTML text | What's wrong | Proposed replacement (raw HTML) | Conf. |
|---|---|---|---|---|
| 2606 | `<li>ET ≤ IT ≤ PT always (events can't be received before they happened; processing can't finish before receipt).</li>` | True causally, false for recorded timestamps: client clocks skew and `CreateTime` is producer-set, so ET &gt; IT is routine for mobile. | `<li>Causally ET ≤ IT ≤ PT — but the <em>recorded</em> timestamps violate it routinely (client clock skew; Kafka <code>CreateTime</code> is set by the producer). Validate and clamp future event times.</li>` | High |
| 2619 | `Setting a 1-minute lateness tolerance drops ~1% of events in most mobile datasets.` | Made-up universal statistic | `Measure your own tail before choosing a tolerance — mobile datasets commonly have a long tail of minutes-to-days.` | Medium |
| 2653 | `<p>Math: if <code>B = p99</code> lateness, ~1% of events are late (dropped or routed to side output).</p>` | B bounds out-of-orderness relative to max ET seen, not PT−ET delay. Also an event is dropped only if its *window* already fired (window end + allowed lateness ≤ watermark). | `<p>Math: B must bound <em>out-of-orderness</em> — <code>max_event_time_seen − event_time</code> at arrival — not end-to-end delay (<code>processing_time − event_time</code>, which explodes during backlog replay without making events late). If <code>B</code> = p99 of out-of-orderness, roughly 1% of events arrive behind the watermark; they are dropped only if their window has already fired.</p>` | High |
| 2677 | `<li>Use <code>WatermarkStrategy.forMonotonousTimestamps()</code> where applicable (no out-of-orderness expected).</li>` | Does nothing for a stalled or slow source (it only sets B=0). Listed as a fix for stalls. | `<li>Use <strong>watermark alignment</strong> (<code>WatermarkStrategy.withWatermarkAlignment(group, maxDrift)</code>, Flink 1.15+) so fast sources/splits pause instead of racing ahead and bloating state.</li>` | High |
| 2693 | `Flink supports this via <code>WatermarkGenerator</code> with <code>onEvent</code> advancing and <code>onPeriodicEmit</code> emitting.` | A punctuated generator emits watermarks *in* `onEvent`. `onPeriodicEmit` is the periodic style. | `Flink supports this via a <code>WatermarkGenerator</code> that calls <code>output.emitWatermark(...)</code> directly inside <code>onEvent</code> when it sees a marker (leaving <code>onPeriodicEmit</code> empty).` | High |
| 2784 | `implement a custom Trigger extending EventTimeTrigger` | `EventTimeTrigger` has a private constructor. You extend `Trigger<Object, TimeWindow>`. | `implement a custom Trigger&lt;Object, TimeWindow&gt; (or use ContinuousEventTimeTrigger / ContinuousProcessingTimeTrigger for periodic early firing)` | High |
| 2797 | `<h3 id="p03-strategy-1-drop-default-in-spark">Strategy 1: Drop (default in Spark)</h3>` | Spark guarantees only that data *within* the threshold is kept. Data beyond it "may or may not" be aggregated. | Keep the heading. Add after the following `<p>`: `<p>Spark nuance: data within the watermark delay is guaranteed to be aggregated; data beyond it <em>may</em> be dropped (not guaranteed) — don't rely on either for audit counts.</p>` | High |
| 2865 | `use a two-phase commit with a <code>commits/</code> log.` | Conflates the checkpoint commit log with the sink's idempotence mechanism. | `write files, then commit idempotently keyed by batchId (<code>_spark_metadata</code> log for the plain file sink; Delta <code>txnAppId/txnVersion</code>; Iceberg snapshot metadata) — so a re-executed batch is not committed twice.` | Medium |
| 2866 | `<li><strong>Kafka sink</strong>: uses Kafka transactions (<code>transactional.id</code>). Micro-batch produces within a transaction; transaction commits with the offset commit.</li>` | **Wrong.** The Structured Streaming Kafka sink is at-least-once. Spark does not do transactional Kafka writes. | `<li><strong>Kafka sink</strong>: <em>at-least-once only</em> — Spark does not use Kafka transactions; a re-executed micro-batch can re-publish. Dedupe downstream (key + idempotent consumer) or use Flink / Kafka Streams for transactional output.</li>` | High |
| 2874 | `<li>Kafka transactions disabled or misconfigured.</li>` | Follows from the above | `<li>Kafka as a sink (at-least-once by design).</li>` | High |
| (2851–2856) | `<p>Any one of these missing, and "exactly-once" fails.</p>` | Contradicts the idempotent-sink subsection (2927–2938): an idempotent sink replaces condition 3. | `<p>Condition 3 can be replaced by an idempotent / deduplicating sink (see below) — that is "effectively-once" without distributed transactions.</p>` (verify uniqueness before replacing; the string sits at L2856) | High |
| 2885 | `Flink uses the <strong>Chandy-Lamport algorithm</strong> (distributed snapshot)` | Flink uses Asynchronous Barrier Snapshotting, a Chandy-Lamport *variant* that needs no channel-state recording when aligned. | `Flink uses <strong>asynchronous barrier snapshotting</strong> (a Chandy-Lamport variant)` | Medium |
| 2892 | `<li>Sinks acknowledge completion. When all sinks ack, checkpoint <code>C</code> is globally complete.</li>` | Every task acks its snapshot to the CheckpointCoordinator, not only sinks | `<li>Every task acknowledges its snapshot to the CheckpointCoordinator (JobManager). When all tasks have acked, checkpoint <code>C</code> is complete and <code>notifyCheckpointComplete</code> lets sinks commit.</li>` | High |
| 2945 | `<li><strong>Dispatcher</strong>: receives jobs, spawns JobManagers per job.</li>` | It spawns a JobMaster per job, inside the JobManager process. | `<li><strong>Dispatcher</strong>: receives job submissions and starts a <strong>JobMaster</strong> per job (JobManager process = Dispatcher + ResourceManager + JobMasters).</li>` | High |
| 2983 | `Synchronous checkpoints (pauses JVM).` | HashMapStateBackend snapshots asynchronously (copy-on-write tables) | `Asynchronous full snapshots (no incremental; GC pressure grows with state).` | High |
| 3010 | `<li><strong>Schema evolution</strong> via Avro-serialized state (auto).</li>` | POJO types evolve too. Kryo does not. | `<li><strong>Schema evolution</strong>: automatic for POJO and Avro state types (add/remove fields); Kryo-serialized state cannot evolve — avoid it for long-lived state.</li>` | High |
| 3012 | `<li><strong>Keyed state type migration</strong>: limited; usually requires re-keying from scratch.</li>` | Vague. The tool is the State Processor API. | `<li><strong>State Processor API</strong>: read a savepoint as a DataSet/DataStream, transform (change types, re-key, bootstrap), write a new savepoint.</li>` | High |
| 3022 | `<p>Parallelism = number of partitions. One consumer per partition per consumer group is the maximum (more consumers than partitions → idle consumers).</p>` | True for classic/consumer groups. Share groups (KIP-932, Kafka 4.x) remove the limit. | Append: ` <em>(Kafka 4.x share groups — KIP-932 — let many consumers share a partition with per-record acks, at the cost of ordering.)</em>` | Medium (verify GA version) |
| 3026 | `<li><strong>Leader</strong>: handles reads and writes.</li>` | Consumers can fetch from followers since 2.4 (KIP-392, rack-aware) | `<li><strong>Leader</strong>: handles all writes and, by default, reads (consumers may fetch from a nearby follower since Kafka 2.4 — KIP-392).</li>` | High |
| 3033 | `<li><code>acks=1</code>: wait for leader to persist.` | The leader appends to the page cache. Kafka does not fsync per write. | `<li><code>acks=1</code>: wait for the leader to append (page cache, not fsync).` | High |
| 3034 | `<li><code>acks=all</code>: wait for all ISRs to persist. No loss within replication factor (assuming <code>min.insync.replicas &gt;= 2</code>).</li>` | Waits for the *current* ISR, which can shrink to 1. No-loss also needs unclean election off and no correlated failures. The default was omitted. | `<li><code>acks=all</code> (producer default since Kafka 3.0, with <code>enable.idempotence=true</code>): wait for every replica currently in the ISR. Durable only with <code>min.insync.replicas &gt;= 2</code> and unclean leader election disabled; otherwise the ISR can shrink to the leader alone.</li>` | High |
| 3037 | `<p>One broker is the <strong>controller</strong> (elected via ZooKeeper or KRaft).` | In KRaft (the only mode in 4.x), the active controller is the Raft leader of a dedicated controller quorum (or of combined-mode nodes), not "one broker". | `<p>The <strong>active controller</strong> is the Raft leader of the KRaft controller quorum (Kafka 4.x is KRaft-only; ZooKeeper-elected controllers exist only in ≤3.9 clusters).` | High |
| 3040 | `<li>Controller detects failure (ZooKeeper session expiry or KRaft heartbeat timeout).</li>` | ZooKeeper wording is legacy | `<li>Controller detects failure (missed broker heartbeats / session timeout to the KRaft quorum).</li>` | High |
| 3042 | `<li>Controller elects a new leader from surviving ISR (first in the ISR list).</li>` | Leader choice follows replica-assignment order, filtered to the live ISR | `<li>Controller elects a new leader: the first replica in the partition's assignment order that is alive and in the ISR (Kafka 4.x adds Eligible Leader Replicas, KIP-966).</li>` | Medium |
| 3043 | `<li>Controller propagates leadership change to all brokers and producers.</li>` | The controller does not push to clients. Clients refresh metadata after `NOT_LEADER_OR_FOLLOWER`. | `<li>Controller publishes the change to brokers via the metadata log; producers/consumers learn it by refreshing metadata after a <code>NOT_LEADER_OR_FOLLOWER</code> error.</li>` | High |
| 3047 | `<p>Kafka 3.x+ supports KRaft mode: the controller runs internally via Raft. No ZooKeeper.` | KRaft was production-ready in 3.3. ZooKeeper was removed in 4.0. | `<p>KRaft (production-ready since 3.3) runs cluster metadata in an internal Raft log; Kafka 4.0 (2025) removed ZooKeeper entirely — ZK→KRaft migration must be done on 3.x before upgrading.` | High |
| 3048 | `<p>Default in new deployments from 2024 onward.</p>` | Outdated | `<p>Kafka 4.x: KRaft is the only mode.</p>` | High |
| 3093 | `<p>Minimal disruption. Prefer in all modern deployments: <code>partition.assignment.strategy=CooperativeStickyAssignor</code>.</p>` | Omits the KIP-848 protocol (GA 4.0), under which this client setting is not used | `<p>Minimal disruption. On the classic protocol use <code>CooperativeStickyAssignor</code> plus static membership (<code>group.instance.id</code>). On Kafka 4.x prefer the next-gen protocol (<code>group.protocol=consumer</code>, KIP-848): the broker computes assignments incrementally, with no group-wide sync barrier; <code>partition.assignment.strategy</code> is ignored (server-side <code>group.remote.assignor</code>).</p>` | High |
| 3170 | `<li><strong>Full-snapshot</strong>: cleanup during checkpoint (exhaustive but costly).</li>` | It only filters expired entries out of full snapshots. Local state is not reduced, and it does not apply to incremental RocksDB. | `<li><strong>Full-snapshot</strong>: expired entries are filtered out of full snapshots only — local state is not shrunk; not effective with incremental RocksDB checkpoints.</li>` | High |
| 3225 | `HashMap backend wouldn't (100 GB heap is infeasible).` | State is spread across TaskManagers. The real limits are GC and snapshot cost. | `HashMap backend could only hold this spread across many TaskManagers, and GC pauses plus full (non-incremental) snapshots make it impractical.` | Medium |
| 3236 | `<li>Its downstream is the bottleneck.</li>` | Backpressure can cascade through several operators | `<li>Walk downstream to the first operator that is <em>not</em> backpressured but has high <code>busyTimeMsPerSecond</code> — that one is the bottleneck.</li>` | High |
| 3241 | `<li><code>inputQueueUsage</code>: same for inputs.</li>` | Not a real Flink metric | `<li><code>inPoolUsage</code> / <code>outPoolUsage</code>, <code>backPressuredTimeMsPerSecond</code>, <code>busyTimeMsPerSecond</code>: buffer saturation and where time is spent.</li>` | High |
| 3255 | `<p>Enable in production where backpressure is possible.</p>` | Too broad: unaligned checkpoints enlarge snapshots and slow restores. The hybrid option is missing. | `<p>Prefer aligned checkpoints with <code>execution.checkpointing.aligned-checkpoint-timeout</code> (switch to unaligned only when alignment stalls) plus buffer debloating (Flink 1.14+); unaligned checkpoints persist in-flight data, enlarging snapshots and restores.</p>` | Medium |
| 3439 | `<li><strong>Reasonable parallelism</strong> (distribution mode hash). Avoids skew on session IDs.</li>` | Iceberg `DistributionMode.HASH` shuffles by table *partition* key to reduce small files, and can concentrate skew | `<li><strong>Iceberg <code>DistributionMode.HASH</code></strong>: shuffles by table partition key so each partition is written by few writers (fewer small files) — watch for skew on hot partitions.</li>` | High |
| 3469 | `The producer writes a <em>transaction marker</em> to each affected partition's commit-coordinator.` | The transaction coordinator writes the markers | `On commit/abort, the <em>transaction coordinator</em> (the broker owning the <code>__transaction_state</code> partition for this <code>transactional.id</code>) writes a COMMIT/ABORT control marker into every partition the transaction touched.` | High |
| 3469 | `Aborted transactions leave tombstone markers.` | ABORT control records, not tombstones | `Aborted data stays in the log behind an ABORT control marker and is skipped by <code>read_committed</code> consumers.` | High |
| 3473 | `Flink's TwoPhaseCommit sink implements this pattern.` | Flink doesn't use `sendOffsetsToTransaction`. `TwoPhaseCommitSinkFunction` is removed in 2.0. | `Kafka Streams (<code>processing.guarantee=exactly_once_v2</code>) uses exactly this. Flink instead stores source offsets in its checkpoint and commits pre-committed Kafka transactions when the checkpoint completes (<code>KafkaSink</code> with <code>DeliveryGuarantee.EXACTLY_ONCE</code>).` | High |
| 3478 | `<li><strong>Zombie producers.</strong> A restarted producer with a new <code>transactional.id</code> epoch fences the old one.` | The epoch belongs to the id. Also missing: random ids means no fencing. | `<li><strong>Zombie producers.</strong> Re-initialising the <em>same</em> <code>transactional.id</code> bumps its epoch and fences the old instance; generating a random id per restart disables fencing entirely.` | Medium |
| 3516 | `use MATCH_RECOGNIZE on Flink SQL with a 30-minute watermark;` | Conflates the pattern window with watermark delay. A 30-minute watermark delays every alert by 30+ minutes. | `use MATCH_RECOGNIZE on Flink SQL with <code>WITHIN INTERVAL '30' MINUTE</code> and a watermark delay sized to out-of-orderness (seconds, not the pattern window);` | High |
| 3534 | `late arrivals produce retractions.` | Window/interval joins drop late rows. Retractions come from regular (unwindowed) outer joins. | `late rows are dropped by window/interval joins; regular (unwindowed) outer joins emit retractions and keep unbounded state without TTL.` | High |
| 3561 | `Kinesis Data Firehose is a fully managed delivery conveyor belt` | Renamed Amazon Data Firehose (Feb 2024) | `Amazon Data Firehose (formerly Kinesis Data Firehose) is a fully managed delivery conveyor belt` | High |
| 3565 | `and a data blob (max 1 MB)` | AWS raised KDS max record size to 10 MiB (2025). Needs external check. The 1,000 records/s/shard write limit is also missing. | `and a data blob (historically max 1 MB; verify current limit — raised to 10 MiB in 2025). Write limit per shard: 1 MB/s <em>or</em> 1,000 records/s` | Medium (VERIFY) |
| 3573 | `<td>Partition reassignment (offline or with Cruise Control)</td>` | Reassignment is online (throttled). Adding partitions remaps keys. | `<td>Online, throttled partition reassignment (kafka-reassign-partitions / Cruise Control); adding partitions changes key→partition mapping</td>` | High |
| 3576 | `<td>Brokers, ZK/KRaft, replication, monitoring</td>` | 4.x is KRaft-only | `<td>Brokers, KRaft controllers, replication, monitoring (or managed: MSK, Confluent Cloud)</td>` | High |
| 3583 | `At five consumers each polling 200 ms, you're already throughput-limited.` | The binding limit is 5 GetRecords calls/s per shard (shared), plus 2 MB/s | `The shard allows only 5 GetRecords calls/s shared by all consumers — five consumers polling every 200 ms already need 25 calls/s and get throttled.` | High |
| 3583 | `At &gt;2 consumers per shard, enhanced fan-out is worth the 1.5× cost premium.` | "1.5×" is not a pricing fact. EFO is billed per consumer-shard-hour plus per GB retrieved. | `Beyond ~2 consumers per shard, or when read latency matters, enhanced fan-out is usually worth its extra per-consumer-shard-hour and per-GB charges.` | Medium |
| 3587 | `Buffer size (1–128 MB) and buffer interval (60–900 s) trade throughput for latency. Not suitable when you need sub-minute delivery or fine-grained replay.` | The buffer interval can be 0 s (zero buffering, since late 2023) | `Buffer size and interval (0–900 s; zero-buffering available) trade file size for latency. Not suitable when you need replay or consumer-controlled offsets.` | Medium-High (VERIFY exact bounds) |
| 3591 | `relative to a Databricks or EMR Flink cluster.` | Databricks does not run Flink | `relative to self-managed Flink on EMR or Kubernetes.` | High |
| 3646 | `The outbox pattern is the only correct way to couple a relational write with an event publish without a distributed coordinator.` | Overstated: log-based CDC of the business table or event sourcing also work | `The outbox is the standard way to couple a relational write with an event publish without a distributed coordinator (alternatives: CDC directly on the business table, or event sourcing).` | Medium |
| cb35 (3388) | `<span class="kw">if</span> (acc.<span class="fu">startTs</span> == <span class="dv">0</span>) acc.<span class="fu">startTs</span> = ev.<span class="fu">eventTime</span>;` | Uses the first-*arriving* event's time, which is wrong for out-of-order input | `acc.<span class="fu">startTs</span> = acc.<span class="fu">startTs</span> == <span class="dv">0</span> ? ev.<span class="fu">eventTime</span> : <span class="bu">Math</span>.<span class="fu">min</span>(acc.<span class="fu">startTs</span>, ev.<span class="fu">eventTime</span>);` | High (check uniqueness before replacing) |

Also note at 2631: `Only achievable when you have metadata (e.g., Kafka producer timestamps with bounded clock skew and source-aware committed offsets). Rare.` The example is muddled: bounded skew makes a watermark *heuristic*. Perfect watermarks come from sources with complete knowledge (ordered ingest-time logs, static file sets, DB log sequence). Medium; suggested text: `Only achievable when the source has complete knowledge of its input (e.g., ingestion-time ordered logs, a finite set of files, a DB log with commit order). Rare.`

---

## Parts 04–05 — Spark Internals, SQL Deep Dive — Questionable claims

Format: line | exact raw snippet (verified unique in file) | problem | proposed raw replacement | confidence.

### Part 04

1. **3700**
   - Snippet: `<span class="co"># plan + cost statistics (post-AQE if enabled)</span>`
   - Problem: `explain()` before an action shows the initial plan; the AQE final plan appears only after execution (isFinalPlan=true). Cost mode shows logical-plan size/row stats.
   - Replace: `<span class="co"># optimized logical plan + size/row stats (pre-execution; AQE final plan only after an action)</span>`
   - Confidence: High
2. **3735**
   - Snippet: `<td><code>ResolveReferences</code>, <code>ResolveSubquery</code></td>`
   - Problem: these are Analyzer rules. The optimizer's "Finish Analysis" batch contains EliminateSubqueryAliases, ComputeCurrentTime, ReplaceExpressions and similar.
   - Replace: `<td><code>EliminateSubqueryAliases</code>, <code>ComputeCurrentTime</code>, <code>ReplaceExpressions</code></td>`
   - Confidence: High
3. **3736**
   - Snippet: `<td>resolves names, types</td>`
   - Problem: same as #2.
   - Replace: `<td>final clean-up after analysis (name/type resolution already happened in the Analyzer)</td>`
   - Confidence: High
4. **3761**
   - Snippet: `<td>promote decimals for overflow safety</td>`
   - Problem: DecimalAggregates rewrites SUM/AVG on small-precision decimals to unscaled Long arithmetic. It is a speed optimization, not a safety one.
   - Replace: `<td>runs SUM/AVG over small-precision decimals as unscaled longs (speed)</td>`
   - Confidence: High
5. **3766**
   - Snippet: `<td>fold static literals</td>`
   - Problem: ConvertToLocalRelation evaluates Project/Filter/Limit over a LocalRelation at plan time. Literal folding is ConstantFolding.
   - Replace: `<td>evaluates Project/Filter/Limit over in-memory <code>LocalRelation</code>s at plan time</td>`
   - Confidence: Medium
6. **3830**
   - Snippet: `CBO chooses BHJ pre-AQE`
   - Problem: the plan-time BHJ decision uses `sizeInBytes`, which exists without CBO. CBO only sharpens the estimate after filters and joins.
   - Replace: `the planner picks BHJ at plan time (size stats suffice; CBO column stats sharpen the post-filter estimate)`
   - Confidence: High
7. **3874**
   - Snippet: `<td><code>spark.sql.adaptive.localShuffleReader.enabled=true</code></td>`
   - Problem: SMJ→BHJ conversion is governed by `spark.sql.adaptive.autoBroadcastJoinThreshold` (3.2+, falls back to the global threshold). The local shuffle reader is the follow-on optimization.
   - Replace: `<td><code>spark.sql.adaptive.autoBroadcastJoinThreshold</code> (3.2+, falls back to <code>spark.sql.autoBroadcastJoinThreshold</code>); <code>localShuffleReader.enabled=true</code> then skips the reduce-side fetch</td>`
   - Confidence: High
8. **3882 and 3886**
   - Snippets: `sorted_partitions = sort_by_size(shuffle_map_output)` and `for p in sorted_partitions:`
   - Problem: AQE coalesces only *contiguous* partition-id ranges; it does not sort by size. The block's own last comment says "contiguous".
   - Replace: `partitions = shuffle_map_output  # in partition-id order; only contiguous ranges merge` and `for p in partitions:`
   - Confidence: High
9. **3895**
   - Snippet: `<p>Result: ~the right number of tasks at the right size, without user tuning.</p>`
   - Problem: `coalescePartitions.parallelismFirst=true` (default since 3.2) ignores the advisory size and only enforces minPartitionSize=1MB. You often do not get 64 MB partitions.
   - Replace: `<p>Result: fewer, bigger tasks. <strong>Trap:</strong> <code>spark.sql.adaptive.coalescePartitions.parallelismFirst=true</code> (default since 3.2) ignores the advisory size and only enforces <code>minPartitionSize</code> (1 MB) to preserve parallelism; set it <code>false</code> to actually get ~64 MB partitions.</p>`
   - Confidence: High (verified in source)
10. **3905**
    - Snippet: `one side's shuffle output is 40 MB (under broadcast threshold)`
    - Problem: 40 MB is above the 10 MB default.
    - Replace: `one side's shuffle output is 8 MB (under the 10 MB default, or <code>spark.sql.adaptive.autoBroadcastJoinThreshold</code>)`
    - Confidence: High
11. **3907**
    - Snippet: `<code>CustomShuffleReader</code>`
    - Problem: renamed `AQEShuffleRead` in Spark 3.2.
    - Replace: `<code>AQEShuffleRead</code> (called <code>CustomShuffleReader</code> before 3.2)`
    - Confidence: High
12. **3935**
    - Snippet: `Each map task writes N files (one per reducer).`
    - Problem: that describes hash shuffle, which was removed in Spark 2.0. The "writes 200 files" lines at 3927–3933 have the same issue.
    - Replace: `Each map task writes ONE data file + ONE index file (N byte ranges, one per reducer).`
    - Confidence: High
13. **3937**
    - Snippet: `Total files on disk: M × N (for sort-based shuffle: M × 1 file + M index files)`
    - Problem: same as #12.
    - Replace: `Total files on disk: 2M (the M × N layout was hash shuffle, removed in Spark 2.0); total blocks fetched is still M × N`
    - Confidence: High
14. **3950**
    - Snippet: `(or K8s daemonset)`
    - Problem: Apache Spark has no supported ESS on Kubernetes.
    - Replace: `(YARN aux-service or standalone Worker; OSS Spark has no supported ESS on Kubernetes — there use shuffle tracking, decommissioning with shuffle-block migration, or a remote shuffle service)`
    - Confidence: High
15. **3954**
    - Snippet: `5.3 Push-based shuffle (Magnet — Spark 3.2+)</h3>`
    - Problem: YARN-only, and it requires the ESS.
    - Replace: `5.3 Push-based shuffle (Magnet — Spark 3.2+, YARN only, requires ESS)</h3>`
    - Confidence: High
16. **3960**
    - Snippet: `typically 2–3× faster shuffle read for large jobs`
    - Problem: unsourced; LinkedIn's published gains are workload-specific.
    - Replace: `fewer, larger sequential reads and better locality (LinkedIn reported large shuffle-fetch wins; measure yours)`
    - Confidence: Medium (VERIFY)
17. **3978**
    - Snippet: `(Celeborn, Uniffle, Apache Spark SS on S3)`
    - Problem: Celeborn and Uniffle are worker clusters, not S3 writers. "Apache Spark SS on S3" does not exist.
    - Replace: `(e.g. Spark's decommission fallback storage <code>spark.storage.decommission.fallbackStorage.path</code>, or vendor S3 shuffle plugins)`
    - Confidence: High
18. **3979**
    - Snippet: `Celeborn (formerly Aliyun/RSS), Uber's Uniffle. Now dominant at large shops.`
    - Problem: Uniffle came from Tencent (Firestorm). Uber built its own RSS. "Dominant" is unsupported.
    - Replace: `Apache Celeborn (from Alibaba's RSS), Apache Uniffle (from Tencent's Firestorm); Uber built its own RSS. Common at very large shops, especially on Kubernetes.`
    - Confidence: High
19. **3988**
    - Snippet: `elif one side fits in memory and has less rows (estimated):  → ShuffledHashJoin (rare)`
    - Problem: SHJ requires preferSortMergeJoin=false plus size conditions, or a hint, or AQE conversion.
    - Replace: `elif preferSortMergeJoin=false and build side small enough per partition and ≥3× smaller:  → ShuffledHashJoin (also via SHUFFLE_HASH hint or AQE maxShuffledHashJoinLocalMapThreshold)`
    - Confidence: Medium
20. **3990**
    - Snippet: `else:  → BroadcastNestedLoopJoin  (correctness last resort)`
    - Problem: BNLJ is chosen for joins with no equi-keys, not after "keys not sortable". Inner joins can become CartesianProduct.
    - Replace: `else (no equi-join keys):  → BroadcastNestedLoopJoin if a side is broadcastable, else CartesianProduct (inner) / BNLJ`
    - Confidence: Medium
21. **4046**
    - Snippet: `FULL OUTER needs SMJ (or BHJ with specific conditions)`
    - Problem: BHJ never supports FULL OUTER.
    - Replace: `FULL OUTER: SMJ, SHJ (3.1+) or BNLJ — never BHJ. LEFT OUTER can broadcast only the right side, RIGHT OUTER only the left`
    - Confidence: High
22. **4101 and 4104**
    - Snippets: `.agg(<span class="bu">sum</span>(<span class="st">&quot;amount&quot;</span>).alias(<span class="st">&quot;sum_amt&quot;</span>)))` and `.agg(<span class="bu">sum</span>(<span class="st">&quot;sum_amt&quot;</span>).alias(<span class="st">&quot;total&quot;</span>))`
    - Problem: `sum` is never imported (cb20's import lacks it), so it resolves to Python's builtin and raises TypeError.
    - Replace: `.agg(F.<span class="bu">sum</span>(…))` in both places, plus `from pyspark.sql import functions as F` at the top of cb21.
    - Confidence: High
23. **4116**
    - Snippet: `<strong>Off-heap memory</strong> via <code>sun.misc.Unsafe</code> — Spark manages raw byte arrays outside the JVM heap.`
    - Problem: Tungsten pages are on-heap `long[]` by default. Off-heap only applies when `spark.memory.offHeap.enabled=true`.
    - Replace: `<strong>Explicit binary memory management</strong> via <code>sun.misc.Unsafe</code> — pages are on-heap <code>long[]</code> by default, off-heap only with <code>spark.memory.offHeap.enabled=true</code> (Spark 4 on Java 17/21 still uses Unsafe via <code>--add-opens</code>).`
    - Confidence: High
24. **4121**
    - Snippet: `~80 bytes packed`
    - Problem: an 8-byte null bitset plus 10×8-byte slots is 88 bytes. §17 says ~60, which contradicts this.
    - Replace: `~88 bytes (8-byte null bitset + 10 × 8-byte slots) for fixed-width fields`
    - Confidence: High
25. **4127**
    - Snippet: `Enables SIMD-friendly loops.`
    - Problem: a row format is not a SIMD format. SIMD gains come from columnar/vectorized paths.
    - Replace: `Cache-friendly; SIMD gains come from columnar/vectorized readers, not UnsafeRow.`
    - Confidence: Medium
26. **4145**
    - Snippet: `Too many operators in a stage: Spark falls back at ~8000 lines of generated code.`
    - Problem: the limits are `hugeMethodLimit`=65535 bytecode bytes and `maxFields`=100. 8000 bytes is HotSpot's JIT limit.
    - Replace: `Generated method exceeds <code>spark.sql.codegen.hugeMethodLimit</code> (65535 bytecode bytes) or the schema exceeds <code>spark.sql.codegen.maxFields</code> (100). Separately, HotSpot won't JIT methods &gt; 8000 bytecode bytes, so near-limit stages can run interpreted.`
    - Confidence: High (verified)
27. **4186**
    - Snippet: `<strong>Execution</strong> borrows from Storage freely (evicts cached blocks).`
    - Problem: execution can evict cached blocks only down to the storageFraction floor.
    - Replace: `<strong>Execution</strong> can evict cached blocks, but only until storage shrinks to the <code>storageFraction</code> floor; cache inside that floor is immune.`
    - Confidence: High
28. **4202**
    - Snippet: `Enable off-heap, increase <code>spark.memory.fraction</code> to 0.7.`
    - Problem: raising the fraction shrinks user memory and can worsen old-gen pressure.
    - Replace: `Fix the skew/over-caching first; then add heap or move Tungsten off-heap. Raising <code>spark.memory.fraction</code> shrinks user memory and can worsen old-gen pressure — change it only with GC logs in hand.`
    - Confidence: Medium
29. **4221**
    - Snippet: ``<span class="co"># OR (better): let AQE coalesce, and use `maxRecordsPerFile`</span>``
    - Problem: there is no shuffle for AQE to coalesce, and maxRecordsPerFile only splits files, never merges them.
    - Replace: `<span class="co"># OR: df.hint(&quot;rebalance&quot;) (REBALANCE, 3.2+) lets AQE size output files; maxRecordsPerFile only CAPS rows per file (splits, never merges)</span>`
    - Confidence: High
30. **4231**
    - Snippet: `co-locates all records for a given date in the same task.`
    - Problem: the consequence is skew, and it isn't stated.
    - Replace: `co-locates all records for a given date in the same task — so one task writes each date (1 date = 1 busy task + 199 empty). Prefer <code>REBALANCE(event_date)</code> or repartition on (event_date, salt).`
    - Confidence: High
31. **4268**
    - Snippet: `AQE handles this; pre-AQE it fails.`
    - Problem: AQE does not demote a BHJ that was planned from stale scan stats.
    - Replace: `AQE does NOT demote a BHJ planned from stale scan stats — it still broadcasts, then OOMs or times out. Refresh stats, lower the threshold or hint. AQE only helps in the SMJ→BHJ direction.`
    - Confidence: Medium
32. **4275**
    - Snippet: `A regular Python UDF serializes each row JVM → Python → JVM, one at a time. Throughput: ~10K rows/sec per executor. Terrible.`
    - Problem: rows are pickled in batches, the throughput figure is unsourced, and Arrow-optimized UDFs are omitted.
    - Replace: `A regular Python UDF pickles rows in small batches and calls your function once per row in a Python worker — per-row interpreter overhead dominates. Spark 3.5+ adds Arrow-optimized Python UDFs (<code>@udf(useArrow=True)</code> / <code>spark.sql.execution.pythonUDF.arrow.enabled</code>, default false).`
    - Confidence: High
33. **4276**
    - Snippet: `<strong>Apache Arrow</strong> zero-copy buffers. Throughput: ~1M rows/sec per executor. Essential.`
    - Problem: the JVM→Python hop is a serialized socket stream, not zero-copy. The throughput figure is unsourced.
    - Replace: `<strong>Apache Arrow</strong> columnar record batches (10,000 rows by default) streamed over a local socket — one Python call per batch. Not zero-copy across the boundary, but orders of magnitude less overhead.`
    - Confidence: High
34. **4285**
    - Snippet: `(s <span class="op">+</span> <span class="dv">1</span>).<span class="bu">map</span>(<span class="bu">float</span>).<span class="bu">map</span>(np.log)`
    - Problem: `np` is undefined, and `.map` runs a per-element Python loop, which is the exact anti-pattern §12.3 warns about.
    - Replace: `np.log1p(s)` and add `import numpy as np`.
    - Confidence: High
35. **4290 and 4292**
    - Snippets: `<span class="co"># loaded per executor, not per batch</span>` and `<span class="cf">yield</span> model.predict(s.values)`
    - Problem: the model is loaded once per task (per iterator), not per executor. The UDF must yield a pd.Series, and `Iterator` is never imported.
    - Replace: `<span class="co"># loaded once per task (partition), not per batch</span>` and `<span class="cf">yield</span> pd.Series(model.predict(s.values))`, plus `from typing import Iterator`.
    - Confidence: High
36. **4311 and 4547**
    - Snippets: `spark.sql.execution.arrow.pyspark.enabled = true` and `<td>Arrow for Pandas UDF and <code>toPandas()</code>.</td>`. The default cell at 4546 says true.
    - Problem: Pandas UDFs always use Arrow. This flag only affects `toPandas()`/`createDataFrame(pandas_df)`, and it defaults to false in OSS 3.x and 4.0.
    - Replace: `spark.sql.execution.arrow.pyspark.enabled = true  # toPandas()/createDataFrame only; default false in OSS` and `<td>Arrow for <code>toPandas()</code> / <code>createDataFrame(pdf)</code> only — Pandas UDFs always use Arrow. Default <strong>false</strong> in OSS 3.x/4.0 (Databricks sets true).</td>`
    - Confidence: High (verified)
37. **4318**
    - Snippet: `returning a DataFrame with different column order than the declared schema silently produces wrong data`
    - Problem: with string column labels, columns are matched by name (`assignColumnsByName=true` by default).
    - Replace: `returned columns are matched to the schema by NAME when labels are strings (default), by position only when they aren't — a misnamed column fails at runtime, a positional one silently mis-assigns`
    - Confidence: High (verified default)
38. **4365**
    - Snippet: `+- ShuffleQueryStage (coalesced from 200 to 50)`
    - Problem: not real plan output.
    - Replace: `+- AQEShuffleRead coalesced` on one line, then `+- ShuffleQueryStage 2` beneath it, and label the whole block "illustrative (3.5+/4.0 would also show WindowGroupLimit)". Numbered step 5 (4392) should describe the same thing.
    - Confidence: High
39. **4401**
    - Snippet: `If <code>event_date</code> filter uses a UDF like <code>date_trunc(event_date) &gt;= ...</code>, the partition filter doesn't push; you read all 7 × N files.`
    - Problem: `date_trunc` is built in, and any deterministic predicate over only partition columns still prunes. Pruning is lost only for UDFs or mixed predicates.
    - Replace: `Built-in functions on a partition column still prune (any deterministic predicate over only partition columns is evaluated against partition values). A Python/Scala UDF, or a predicate mixing partition and data columns, disables pruning and you scan every partition.`
    - Confidence: High
40. **4594**
    - Snippet: `Required for dynamic allocation (unless push-based shuffle or decommissioning).`
    - Problem: push-based shuffle itself *requires* the ESS. The real alternative is shuffle tracking, which defaults to true.
    - Replace: `Needed for DA unless <code>spark.dynamicAllocation.shuffleTracking.enabled</code> (default true) or decommissioning with shuffle migration is used. Push-based shuffle itself requires ESS.`
    - Confidence: High (verified)
41. **4616**
    - Snippet: `Before Tungsten (Spark 1.4, matured in 1.6+)`
    - Problem: whole-stage codegen arrived in 2.0.
    - Replace: `Before Tungsten (phase 1 in Spark 1.4–1.6: binary memory, UnsafeRow; phase 2 in 2.0: whole-stage codegen)`
    - Confidence: High
42. **4621**
    - Snippet: `a 10-column row in normal Java was ~200 bytes, UnsafeRow is ~60.`
    - Problem: contradicts §8.1.
    - Replace: `…UnsafeRow is ~88 bytes for 10 fixed-width fields.` Better still, delete §17 and keep §8.
    - Confidence: High
43. **4623**
    - Snippet: `10x–100x speedups on compute-bound stages.`
    - Problem: contradicts §8's "2–5×"; 100× is unsupported.
    - Replace: `large speedups on CPU-bound operator chains (Databricks' 2016 microbenchmarks showed up to ~10× on specific operators; end-to-end gains are smaller)`
    - Confidence: High
44. **4628**
    - Snippet: `Missing stars = missing codegen = 10x slower for no good reason.`
    - Problem: overstated. Non-codegen operators split stages rather than disabling codegen for the whole stage.
    - Replace: `Missing stars = that operator runs interpreted (Python UDFs, Window, some generators never codegen); it splits the stage rather than disabling it — measure before blaming it.`
    - Confidence: Medium
45. **4635**
    - Snippet: `Either raise memory or reduce shuffle partitions / partition key cardinality.`
    - Problem: backwards. *More* partitions mean smaller per-task hash maps.
    - Replace: `Either raise memory or INCREASE shuffle partitions (smaller per-task hash maps).`
    - Confidence: High
46. **4648**
    - Snippet: `Fix: enable the external shuffle service (on YARN) or persistent volumes (on Kubernetes). Without one of these, dynamic allocation is not safe to enable.`
    - Problem: on Kubernetes the answer is shuffle tracking (default true) or decommissioning with migration, not persistent volumes.
    - Replace: `Fix: on YARN, the external shuffle service. On Kubernetes, <code>spark.dynamicAllocation.shuffleTracking.enabled</code> (default true — executors holding live shuffle data aren't released, so scale-down is slower), plus <code>spark.decommission.enabled</code> with shuffle-block migration or a remote shuffle service (Celeborn).`
    - Confidence: High
47. **4660**
    - Snippet: `(Velox under Presto/Trino, RAPIDS for GPU)`
    - Problem: Trino does not use Velox.
    - Replace: `(Velox under Presto C++/Prestissimo and Apache Gluten for Spark, Apache DataFusion Comet for Spark, NVIDIA RAPIDS for GPU)`
    - Confidence: High
48. **4660**
    - Snippet: `2–3x faster at similar hardware cost`
    - Problem: Photon is billed at a higher DBU rate, and the multiplier is vendor-reported.
    - Replace: `often 2–3× faster (vendor-reported); Photon compute carries a higher DBU rate, so net cost must be measured per workload`
    - Confidence: Medium
49. **4684**
    - Snippet: `the Python client is just a thin wrapper issuing Catalyst plans`
    - Problem: omits Spark Connect.
    - Replace: `the Python client builds plans that run in the JVM — via Py4J (classic) or, with Spark Connect (3.4+, GA in 4.0), as unresolved plans sent over gRPC`
    - Confidence: High

### Part 05

50. **4745**
    - Snippet: `The biggest one — everything else is joined to it.`
    - Problem: in classic usage the "driving table" is the outer, most selective side.
    - Replace: `In OLTP it is the outer, most selective input; in a star-schema warehouse query it is the fact table everything probes into — say which you mean.`
    - Confidence: Medium
51. **4796**
    - Snippet: `- Right input: Seq Scan on fact_plays with event_date filter (partitioned index)`
    - Problem: Postgres builds the Hash on the inner (dim) input and probes with the outer (fact). "Partitioned index" is not a real scan type.
    - Replace: `- Outer (probe): scan of the pruned fact_plays partition for event_date (Hash node built on dim_user)`
    - Confidence: Medium
52. **4867 (row)**
    - Snippet: `<td>Zone Map Join</td>`
    - Problem: not a join algorithm.
    - Replace: `<td>Runtime filter / dynamic pruning (not a join algorithm — prunes the probe-side scan)</td>`
    - Confidence: High
53. **4852**
    - Snippet: `<td>equijoin, both sorted</td>`
    - Problem: the algorithm does the sorting itself unless inputs are already sorted.
    - Replace: `<td>equijoin, sortable keys (sorted by the algorithm unless already ordered)</td>`
    - Confidence: Medium
54. **4856**
    - Snippet: `<td>O(1) streaming</td>`
    - Problem: SMJ must buffer runs of duplicate keys.
    - Replace: `<td>O(largest duplicate-key run) buffered</td>`
    - Confidence: Medium
55. **4895**
    - Snippet: `(clustered index, clustering key in Snowflake, Z-ORDER in Delta)`
    - Problem: Z-ORDER and Snowflake clustering keys prune files but give the planner no sort guarantee.
    - Replace: `(clustered index in OLTP; in Spark only bucketed tables or storage-partitioned joins (3.3+) avoid the shuffle/sort — Z-ORDER and Snowflake clustering keys prune files but give the planner no sort guarantee)`
    - Confidence: High
56. **4916**
    - Snippet: `Used in: Oracle, DuckDB (generated on-the-fly), warehouse columnar engines (implicit).`
    - Problem: DuckDB has no bitmap indexes (it uses ART indexes and min-max zonemaps).
    - Replace: `Used in: Oracle (bitmap indexes); Postgres builds bitmaps at runtime (Bitmap Heap Scan) from B-trees; columnar engines get similar effects from dictionary encoding + zone maps.`
    - Confidence: High
57. **4966**
    - Snippet: `SEMI <span class="kw">JOIN</span> (<span class="kw">SELECT</span> <span class="kw">DISTINCT</span> user_id`
    - Problem: `SEMI JOIN` is not valid in Postgres/Snowflake/BigQuery, and DISTINCT is unnecessary for a semi join.
    - Replace: `<span class="kw">LEFT</span> SEMI <span class="kw">JOIN</span> (<span class="kw">SELECT</span> user_id`, and add a comment: `-- Spark SQL / Databricks syntax; DuckDB: SEMI JOIN; Postgres/Snowflake/BigQuery do this internally only`
    - Confidence: High
58. **5000**
    - Snippet: `= this group + previous group.</li>`
    - Problem: the GROUPS frame is unsupported in the three main warehouse engines.
    - Replace: `= this group + previous group. <em>GROUPS is Postgres 11+/SQLite/DuckDB only — not Spark, Snowflake or BigQuery.</em></li>`
    - Confidence: High
59. **5026**
    - Snippet: `In Spark this is a specific rule.`
    - Problem: the rule is unnamed and unversioned.
    - Replace: `In Spark 3.5+ this is <code>InferWindowGroupLimit</code> → <code>WindowGroupLimit</code> (row_number/rank/dense_rank with <code>rn &lt;= k</code>, k ≤ <code>spark.sql.optimizer.windowGroupLimitThreshold</code> = 1000).`
    - Confidence: High (verified)
60. **5122**
    - Snippet: `This is the exact pattern Flink's session window implements in its state machine`
    - Problem: Flink merges windows; this is a batch equivalent, not the same mechanism.
    - Replace: `This is the batch equivalent of a session window (Flink implements it by merging per-event windows in state, not with LAG)`
    - Confidence: Medium
61. **5137**
    - Snippet: `Spark uses BNLJ; Postgres uses merge join on <code>(user_id, valid_from)</code> if you have the right index.`
    - Problem: with an equi-key present, Spark uses SMJ/BHJ on that key and applies the range as a post-join filter.
    - Replace: `With the <code>user_id</code> equality present, Spark uses SMJ/BHJ on user_id and applies the range as a post-join filter (heavy users with many versions explode). BNLJ only happens for pure range joins; Databricks offers a <code>RANGE_JOIN</code> hint. Postgres typically hash-joins on user_id + filter, or nested-loops with an index on <code>(user_id, valid_from)</code>.`
    - Confidence: High
62. **5151**
    - Snippet: `<span class="co"># Using built-in asof via pandas UDF or explicit:</span>`
    - Problem: an empty stub labelled "Spark-native".
    - Replace: a real pattern. Union fact and dim rows, then `last(plan_name, ignorenulls=True).over(Window.partitionBy("user_id").orderBy("ts").rowsBetween(Window.unboundedPreceding, 0))`, then keep fact rows. Note `pyspark.pandas.merge_asof` as an option.
    - Confidence: High (stub). Medium, VERIFY: `pyspark.pandas.merge_asof`.
63. **5154**
    - Snippet: `Alternative: kdb+ / ClickHouse / DuckDB have real ASOF JOIN syntax.`
    - Problem: omits Snowflake's native ASOF JOIN.
    - Replace: `Alternative: Snowflake (<code>ASOF JOIN … MATCH_CONDITION(p.event_ts &gt;= d.valid_from) ON …</code>), DuckDB, ClickHouse and kdb+ have native as-of joins.`
    - Confidence: High
64. **5182**
    - Snippet: `Supported in Snowflake (<code>APPROX_COUNT_DISTINCT</code> uses HLL; Theta available via Java UDF or Datasketches).`
    - Problem: Snowflake has no native Theta sketch.
    - Replace: `Native in Apache Druid and via Apache DataSketches libraries (Hive/Spark/Java/Python UDFs). Snowflake and BigQuery have no native Theta: HLL sketches union cleanly, but intersection by inclusion–exclusion has large error.`
    - Confidence: Medium-High
65. **5197**
    - Snippet: `Rule: cost reduction is typically 100× for 1% error.`
    - Problem: unsourced.
    - Replace: `Rule: sketch state is fixed-size (KBs) and mergeable, so rollups re-aggregate sketches instead of raw rows — the saving grows with data volume.`
    - Confidence: Medium
66. **5208**
    - Snippet: `<span class="co">-- Bad: user_id is BIGINT, &#39;1234&#39; is VARCHAR → cast every row</span>`
    - Problem: backwards. Postgres and Snowflake coerce a quoted literal to the column type once. The damage happens when the column is the side that gets cast.
    - Replace: `<span class="co">-- Bad: the column side gets cast. E.g. user_id VARCHAR compared with 1234 (numeric) → cast per row, index/pruning lost. (A quoted literal vs a BIGINT column is coerced once in Postgres/Snowflake; in Spark 4.0 ANSI mode a non-numeric string cast throws.)</span>`
    - Confidence: High
67. **5221–5222**
    - Snippets: `<span class="kw">UNION</span></span>` and `<span class="kw">AND</span> a.x <span class="op">&lt;&gt;</span> b.x;</span>`
    - Problem: UNION drops legitimate duplicate rows, and `<>` drops rows where x is NULL.
    - Replace: `<span class="kw">UNION ALL</span></span>` and `<span class="kw">AND</span> a.x <span class="kw">IS DISTINCT FROM</span> b.x;</span>`, with a comment `-- Spark: NOT (a.x &lt;=&gt; b.x)`.
    - Confidence: High
68. **5228**
    - Snippet: `<span class="co">-- Bad: N × M</span>`
    - Problem: contradicts §6.1; modern optimizers decorrelate this.
    - Replace: `<span class="co">-- Bad only if the optimizer can't decorrelate (non-equality correlation, LIMIT); Spark/Snowflake/Postgres usually rewrite this to the LEFT JOIN below</span>`
    - Confidence: Medium
69. **5305**
    - Snippet: `<tr><td>Snowflake</td><td>Inlined always</td>`
    - Problem: Snowflake can compute a multi-reference CTE once and reuse it.
    - Replace: `<tr><td>Snowflake</td><td>Optimizer decides; a multiply-referenced CTE can be computed once and reused (WithClause/WithReference in Query Profile)</td>`
    - Confidence: Medium (VERIFY)
70. **5307**
    - Snippet: `<tr><td>Spark SQL</td><td>Inlined</td>`
    - Problem: omits exchange reuse, which avoids some duplicate work.
    - Replace: `<tr><td>Spark SQL</td><td>Inlined; duplicate shuffle subtrees are deduplicated via ReusedExchange, but scans/filters before the shuffle run twice</td>`
    - Confidence: Medium
71. **5325**
    - Snippet: `give 99% accuracy for 0.01% of the cost`
    - Problem: marketing figure, and it contradicts §11.
    - Replace: `trade a small, bounded standard error (≈0.5–2% typical) for fixed-size, mergeable state`
    - Confidence: High
72. **5329**
    - Snippet: `Uses ~16 KB of state per distinct-count regardless of input size. Answer within ~2% of exact.`
    - Problem: precision varies by engine; Spark's default relative SD is 5%. `APPROX_COUNT_DISTINCT` returns a number, not a sketch, so it is not what you merge.
    - Replace: `State is fixed (KBs) regardless of input. Error depends on precision: ≈0.8% at 2^14 registers; Spark <code>approx_count_distinct</code> defaults to rsd = 0.05 (5%). <code>APPROX_COUNT_DISTINCT</code> returns a number — to merge you need the sketch APIs: Snowflake <code>HLL_ACCUMULATE/HLL_COMBINE</code>, BigQuery <code>HLL_COUNT.INIT/MERGE</code>, Spark 3.5+ <code>hll_sketch_agg/hll_union_agg</code>.`
    - Confidence: High
73. **5333**
    - Snippet: `<code>APPROX_PERCENTILE()</code>. Stores a compressed histogram`
    - Problem: function names and algorithms differ per engine.
    - Replace: `Names and algorithms differ: Snowflake <code>APPROX_PERCENTILE</code> (t-digest), Trino <code>approx_percentile</code>, Spark <code>percentile_approx</code> (Greenwald–Khanna, accuracy = 10000), BigQuery <code>APPROX_QUANTILES</code>/<code>KLL_QUANTILES</code>. Each stores a compressed summary`
    - Confidence: Medium-High
74. **5361**
    - Snippet: `support incremental for aggregations and filters over a single base table.`
    - Problem: BigQuery incremental MVs also support joins.
    - Replace: `support incremental refresh for filters/aggregations, including INNER JOINs (with restrictions)`
    - Confidence: Medium (VERIFY)
75. **5375**
    - Snippet: `What exists: <code>USE_CACHED_RESULT=FALSE</code>, query tags, and clustering hints via <code>CLUSTER BY</code> at table DDL time.`
    - Problem: none of these are optimizer hints.
    - Replace: `Snowflake has no optimizer-hint syntax. <code>USE_CACHED_RESULT</code> and <code>QUERY_TAG</code> are session parameters and <code>CLUSTER BY</code> is DDL — useful levers, but not hints.`
    - Confidence: High
76. **5379**
    - Snippet: `Also minimal: <code>@@optimizer_mode</code>, <code>JOIN HASH</code> hint, <code>GROUP BY ROLLUP</code>.`
    - Problem: `GROUP BY ROLLUP` is grouping syntax, and BigQuery exposes essentially no user-facing join hints.
    - Replace: `BigQuery GoogleSQL exposes essentially no user-facing join/optimizer hints (<code>GROUP BY ROLLUP</code> is grouping syntax, not a hint). Levers: partition/cluster keys, filtering early, pre-aggregating, materializing intermediates into temp tables, BI Engine and search indexes.`
    - Confidence: High for ROLLUP. Medium for `@@optimizer_mode` (VERIFY).
77. **5383**
    - Snippet: `SKEW('t1','skewed_key', (1,2,3))`
    - Problem: the SKEW hint is Databricks-only (legacy, pre-AQE). OSS Spark's partition hints are missing from the list.
    - Replace: `REBALANCE(t1.key)` inside the same hint comment. Follow the paragraph with: `OSS join hints: BROADCAST (BROADCASTJOIN, MAPJOIN), MERGE (SHUFFLE_MERGE, MERGEJOIN), SHUFFLE_HASH, SHUFFLE_REPLICATE_NL — precedence in that order. Partition hints: COALESCE, REPARTITION, REPARTITION_BY_RANGE, REBALANCE (3.2+). <code>SKEW</code> is a Databricks-only legacy hint.`
    - Confidence: High
78. **5405**
    - Snippet: `<tr><td>Top-N with "include all tied at Nth"</td><td><code>DENSE_RANK()</code></td>`
    - Problem: `RANK() <= N` is the correct choice; `DENSE_RANK() <= N` returns the top N distinct *values*, which can be many more rows.
    - Replace: `<tr><td>Top-N with "include all tied at Nth"</td><td><code>RANK() &lt;= N</code> (or <code>FETCH FIRST N ROWS WITH TIES</code>)</td>`
    - Confidence: High
79. **5409**
    - Snippet: `<td><code>RANGE</code> frame</td><td>ROWS counts rows; RANGE counts values — with date gaps, RANGE gives different results</td>`
    - Problem: contradicts the next row. For calendar days, `RANGE … INTERVAL` is the correct frame.
    - Replace: `<td>calendar-day intent with a ROWS frame</td><td>ROWS 6 PRECEDING = last 7 <em>rows</em>; for 7 calendar days use <code>RANGE BETWEEN INTERVAL 6 DAYS PRECEDING AND CURRENT ROW</code> (Postgres/Spark/DuckDB) or a dense date grid (BigQuery: RANGE over <code>UNIX_DATE(d)</code>)</td>`
    - Confidence: High
80. **5412**
    - Snippet: `<td><code>PERCENT_RANK()</code> or <code>NTILE(100)</code></td>`
    - Problem: NTILE splits ties across buckets, which contradicts the row's own "ties" point.
    - Replace: `<td><code>PERCENT_RANK()</code> / <code>CUME_DIST()</code> (tie-aware); <code>NTILE</code> only for equal-size buckets — it splits ties</td>`
    - Confidence: High
81. **5415**
    - Snippet: `<td>HyperLogLog sketch + windowed merge</td>`
    - Problem: an exact one-pass method exists. HLL merge is not an analytic function in most engines, and Spark rejects DISTINCT window functions.
    - Replace: `<td>First-seen flag (<code>ROW_NUMBER() OVER (PARTITION BY key ORDER BY ts) = 1</code>) + running <code>SUM</code> — exact, one pass</td>`
    - Confidence: High
82. **5423**
    - Snippet: `The three functions that surprise people most are <code>LAST_VALUE</code>, <code>SUM OVER ORDER BY</code>, and <code>FIRST_VALUE</code>.`
    - Problem: FIRST_VALUE is correct under the default frame. SUM's surprise comes from RANGE summing tied rows.
    - Replace: `The two that surprise people are <code>LAST_VALUE</code> (default frame ends at the current row) and <code>SUM … OVER (ORDER BY ts)</code> (RANGE includes every row tied on ts, so duplicates get the same running total). <code>FIRST_VALUE</code> is fine with the default frame.`
    - Confidence: High
83. **5044**
    - Snippet: `the default for LAST_VALUE is "current row"`
    - Problem: loose wording. The frame ends at the current row *and its peers*.
    - Replace: `the default frame (with ORDER BY) ends at the current row and its ORDER BY peers`
    - Confidence: Medium

Not flagged but worth a glance:

- 4003: the "~3×" in-memory size rule of thumb.
- 4906: the B-tree levels math, which is loose but harmless.
- 4886: the 10M-row hash table estimate of 1–2 GB, which is really 0.5–2 GB.

---

## Parts 06–07 — Python, Lakehouse — QUESTIONABLE CLAIMS (exact raw-HTML quotes, each unique in the file)

| # | Line | Exact quote | What's wrong | Proposed replacement (raw HTML) | Conf |
|---|---|---|---|---|---|
| 1 | 5503 | `Python 3.13 ships an experimental <code>--disable-gil</code> build. Reference counting becomes biased + atomic; per-object locks replace the GIL. Real concurrency for pure Python. Performance overhead ~10–30% single-threaded.` | 3.13t penalty was ~40% (specializer disabled). 3.14 made it officially supported (PEP 779) at ~5–10% | `Python 3.13 shipped an <em>experimental</em> free-threaded build (<code>python3.13t</code>, ~40% single-thread penalty); Python 3.14 made it <strong>officially supported but still optional</strong> (PEP 779, ~5–10% penalty). Reference counting becomes biased + atomic; per-object locks replace the GIL. Importing a C extension not marked free-threading-safe re-enables the GIL at runtime (check <code>sys._is_gil_enabled()</code>).` | High |
| 2 | 5504 | `Free-threaded adoption is on the horizon but not yet default.` | Understates 2026 status | `The default build still has a GIL; free-threaded (<code>3.14t</code>) is supported and worth piloting for CPU-bound thread pools once every native dependency ships a <code>cp314t</code> wheel.` | High |
| 3 | 5501 | `The merge is in C. It releases the GIL for the duration.` | pandas releases the GIL only in some Cython kernels. Merge/groupby hold it for significant parts; thread scaling is poor | `Parts of the merge run in Cython kernels that release the GIL, but much of it (factorizing, object handling, result assembly) holds it — so thread scaling is modest.` | Medium |
| 4 | 5518 | `(~16 bytes on CPython 3.12) + type pointer + refcount` | The 16-byte header *is* the refcount + type pointer | `(16 bytes on 64-bit CPython: refcount + type pointer)` | High |
| 5 | 5518 | `A trivial <code>int</code> is 28 bytes. A 4-character string is 53 bytes. A 1-element list is 88 bytes.` | Verified: str is 53 B on 3.11 but 45 B on 3.12+; `[1]` is 64 B | `A small <code>int</code> is 28 bytes. A 4-character ASCII string is 45 bytes (3.12+). A 1-element list is 64 bytes (plus the element it points to).` | High |
| 6 | 5519 | `can use 2 GB of memory in object dtype but 80 MB as Arrow-backed strings` | Short strings: ~8 B pointer + ~45–60 B str ≈ 0.5–0.7 GB, not 2 GB. The ratio is overstated. pandas 3 defaults to Arrow strings anyway | `can use ~0.6 GB in object dtype (8-byte pointer + ~50-byte <code>str</code> per row) but ~100 MB as Arrow-backed strings (pandas 3.0 makes the Arrow-backed <code>str</code> dtype the default)` | High |
| 7 | 5526 | `Three generations (0, 1, 2).` | 3.14 GC is incremental (young + old). 3.13 default threshold0 = 2000 | `Up to 3.13: three generations (0, 1, 2; default thresholds <code>(700,10,10)</code>, <code>(2000,10,10)</code> in 3.13). 3.14: incremental collector with young/old generations.` | High |
| 8 | 5543 | `(<code>USDT</code>-style)` | py-spy reads process memory via `process_vm_readv`/ptrace, not USDT probes | `(it reads the target's memory from outside the process)` | High |
| 9 | 5543 | `Critical for Spark driver issues.` | The driver is JVM. py-spy sees only the PySpark Python process / Python workers | `Useful for the Python side of PySpark (driver process, Python workers); the JVM needs <code>jstack</code>/async-profiler.` | High |
| 10 | 5545 | `(~~250 bytes)` | Markdown strike artefact. Also stale: 3.11+ has lazy inline values, so the per-instance dict cost is much lower | `(materialized lazily since 3.11; still larger than slots)` | High |
| 11 | 5636 | `if it fits in RAM, Polars wins. If it doesn't, PySpark wins.` | Contradicts §4.2/§4.4: Polars streaming and DuckDB spill handle larger-than-RAM on one node | `if it fits on one machine — including out-of-core via Polars streaming or DuckDB spilling — single-node wins. Reach for Spark when data, concurrency or SLAs exceed one node, or the platform already runs Spark.` | High |
| 12 | 5639 | `might be a view, might be a copy — depends on memory layout` | A boolean mask always returns a copy. The ambiguity is chained assignment. Under pandas 3 CoW it always behaves as a copy | `boolean-mask selection: always a copy; pandas &lt;3 couldn&#39;t tell whether you meant to write through` | High |
| 13 | 5647 | `Pandas 2.0 introduced <code>Copy-on-Write</code> mode` | pandas 3.0: CoW is always on; the option is a deprecated no-op (verified: Pandas4Warning) | `Pandas 2.x offered opt-in <code>Copy-on-Write</code>; <strong>pandas 3.0 makes it mandatory</strong> (the <code>mode.copy_on_write</code> option is a deprecated no-op). Chained assignment like <code>df[mask][&#39;y&#39;] = …</code> never writes through.` (replaces the whole sentence up to `</p>`) | High |
| 14 | 6117 | `Are you copying when you don't need to?` | Same | `On pandas &lt;3, are you copying defensively? (pandas 3 is always Copy-on-Write.)` and drop the set_option | High |
| 15 | 5653 | `pl.col(<span class="st">&quot;event_date&quot;</span>) <span class="op">==</span> <span class="st">&quot;2026-04-15&quot;</span>)` | Raises `InvalidOperationError` on a Date column (verified, Polars 1.44) | `pl.col(<span class="st">&quot;event_date&quot;</span>) <span class="op">==</span> pl.date(<span class="dv">2026</span>, <span class="dv">4</span>, <span class="dv">15</span>))` | High |
| 16 | 5659 | `df.collect(streaming<span class="op">=</span><span class="va">True</span>)` | Deprecated since Polars 1.25 (verified) | `df.collect(engine<span class="op">=</span><span class="st">&quot;streaming&quot;</span>)` | High |
| 17 | 5697 | `Iceberg, Parquet (file formats are Arrow-compatible)` | Parquet is encoded/compressed and must be decoded (not zero-copy). Iceberg is a table format | `Parquet/ORC readers decode straight into Arrow (fast, but a decode — not zero-copy); Iceberg/Delta readers (PyIceberg, delta-rs) return Arrow` | High |
| 18 | 5705 | `zero copy back` | DuckDB materializes its result into Arrow once. The input scan is the zero-copy side | `DuckDB scanned pl_df zero-copy; the result is materialized once into Arrow and wrapped by Polars` | Medium |
| 19 | 5747 | `<span class="kw">def</span> batched(iterable, n):` | `itertools.batched` exists since 3.12 | Replace the block with `itertools.batched(iterable, n)  # 3.12+; strict=True in 3.13` and keep the recipe labelled "pre-3.12" | High |
| 20 | 5852 | `On Linux, the default start method is <code>fork</code>` | 3.14: default on POSIX (except macOS) is **forkserver**. 3.12+ warns on fork with threads | `On Linux the default was <code>fork</code> through 3.13 and is <code>forkserver</code> from 3.14 (3.12+ warns when forking a multi-threaded process)` | High |
| 21 | 5872 | `<code>frozen=True</code> makes it hashable + immutable.` | Shallow only. With a `dict` field, `hash(ev)` raises TypeError | `<code>frozen=True</code> blocks attribute reassignment (shallow — the <code>dict</code> field is still mutable, and <code>hash(ev)</code> raises because <code>dict</code> is unhashable).` | High |
| 22 | 5885 | `<span class="op">&gt;</span> datetime.utcnow():` | `utcnow()` is deprecated since 3.12. Comparing a naive value with an aware `v` raises TypeError | `<span class="op">&gt;</span> datetime.now(timezone.utc):` (+ `from datetime import datetime, timezone` and type `AwareDatetime`) | High |
| 23 | 5990 | `normalize_country_idempotent` (test) | This test **fails**: `normalize_country("a  b")` → `"A  "` → `"A"` (verified) | Add after the block: `<p>Run it and Hypothesis shrinks to <code>"a  b"</code>: <code>"A  "</code> then <code>"A"</code> — truncating after strip isn&#39;t idempotent. That&#39;s the point: property tests find what examples miss.</p>` | High |
| 24 | 5977 | `<a href="#p06-cb33-6" aria-hidden="true"></a><span class="at">        </span><span class="fu">tests</span>` (also line 5982, `#p06-cb33-11`) | dbt ≥1.8 key is `data_tests:` | `…<span class="fu">data_tests</span>` | High |
| 25 | 6052 | `Three approaches:` | Lists 4; items 3 and 4 are the same | `Three approaches:` stays, but delete the `PYSPARK_DRIVER_PYTHON` `<li>` (line 6056) and change `.egg` to `.whl`/`.zip` | High |
| 26 | 6042 | `&quot;pyspark==3.5.1&quot;,` | Don't ship pyspark as a runtime dep for cluster jobs. 3.5.1 is stale (Spark 4.x) | Move it to a `dev`/`test` extra as `&quot;pyspark&gt;=4.0,&lt;5&quot;`; the cluster provides Spark | Medium |
| 27 | 6062 | `spark.pyspark.driver.python=./environment/bin/python` | Per Spark docs, `./environment` exists on the driver only in cluster mode. In client mode, set only executor python | Add `<span class="co"># cluster mode only; omit in client mode</span>` | Medium |
| 28 | 6068 | `airflow.operators.python <span class="im">import</span> PythonOperator` | Airflow 3 (2025): `from airflow.sdk import DAG`; operator is in `airflow.providers.standard.operators.python` | Replace with Airflow 3 imports and note "Airflow 2: `airflow.operators.python`" | Medium |
| 29 | 6087 | `Use SnapStart on Java; Python equivalents are limited.` | Lambda SnapStart supports Python 3.12+ (Nov 2024) | `SnapStart now covers Python 3.12+ (and .NET) — watch for state restored across snapshots (random seeds, connections).` | High |
| 30 | 6140 | `<code>asyncio</code> is dramatically faster than threads and infinitely cheaper than processes` | Hyperbole. Threads give similar I/O concurrency up to hundreds of connections | `<code>asyncio</code> scales to thousands of concurrent requests more cheaply than threads, and far more cheaply than processes` | High |
| 31 | 6144 | `(~1 KB per coroutine vs ~1 MB per thread)` | Linux thread stacks *reserve* 8 MB virtual and commit far less | `(~1–2 KB per coroutine vs a reserved 8 MB virtual stack per OS thread on Linux, plus scheduler cost)` | Medium |
| 32 | 6164 | `# asyncio: ~80ms total for reasonable N*M (bounded by S3 throttle)` | Pagination within a prefix is sequential (each page needs the previous token), so total ≈ the slowest prefix's page count × latency | `# asyncio: ~ max(pages per prefix) x ~80ms — pages within a prefix are sequential; parallelism is across prefixes` | High |
| 33 | 6181 | `A 10 GB DataFrame handed from Pandas to DuckDB to Spark via Arrow costs zero CPU for the handoff.` | Spark is a separate JVM process (Arrow IPC = copy). NumPy-backed pandas → Arrow copies | `Within one process (Pandas-on-Arrow → DuckDB → Polars) the handoff is zero-copy; crossing into Spark&#39;s JVM is Arrow IPC — a byte copy, but no per-row object churn.` | High |
| 34 | 6251 | `Dependency resolution is weak; no lockfile; easy to drift.` | pip has a real resolver since 20.3. PEP 751 `pylock.toml` exists; `pip lock` is experimental | `No native lock workflow (pip-tools, or the experimental <code>pip lock</code> → PEP 751 <code>pylock.toml</code>); easy to drift.` | Medium |
| 35 | 6259 | `Still maturing on edge cases but rapidly becoming the default for new projects.` | Stale for 2026; "drop-in for Poetry" is also wrong | `The de-facto default for new projects by 2026 (<code>uv.lock</code>, <code>uv python</code>, <code>uv pip</code> for pip compatibility); Poetry projects need a migration, not a drop-in.` | Medium |
| 36 | 6278 | `RUN pip install uv &amp;&amp; uv sync --frozen` | Fails or installs the project before `src/` exists. CMD then uses system python, not `.venv` | `RUN pip install uv &amp;&amp; uv sync --frozen --no-install-project` + after COPY src: `RUN uv sync --frozen` and `ENV PATH=&quot;/app/.venv/bin:$PATH&quot;` | High |
| 37 | 6380 | `<code>format-version</code> (2 in modern usage)` | v3 is GA (Iceberg 1.10, Spark 4.0) | `<code>format-version</code> (2 is the safe default; 3 — deletion vectors, variant, row lineage, default values — is GA in Iceberg 1.10+ but check every reader)` | High |
| 38 | 6417 | `This is why Iceberg dominates.` | Delta uses the same file-stats pruning. Iceberg's edge is manifest-level partition pruning + hidden partitioning | `Delta does the same with log stats; Iceberg&#39;s extra lever is manifest-level pruning on partition summaries.` | Medium |
| 39 | 6427 | `On Nessie / Polaris / Unity: branch-aware semantics.` | Polaris/Unity do server-side CAS via REST commit requirements. Only Nessie is catalog-level branching | `On REST catalogs (Polaris, Unity, Glue REST): server-side compare-and-swap via commit requirements (<code>assert-ref-snapshot-id</code>); Nessie adds catalog-level branches.` | High |
| 40 | 6477 | `this is no longer required.)` | True for delta-rs ≥1.0. delta-spark still documents S3DynamoDBLogStore for multi-cluster S3 writes (GH #3596) | `delta-rs 1.0+ uses S3 conditional put and dropped DynamoDB; for delta-spark check your version — multi-cluster S3 writes historically required <code>S3DynamoDBLogStore</code>.)` | Medium (VERIFY) |
| 41 | 6482 | `achieve <strong>serializable</strong>` | Delta's default is WriteSerializable. Iceberg is configurable. Reads are SI | `achieve optimistic, snapshot-isolated commits — <strong>serializable</strong> where configured (Iceberg <code>isolation-level=serializable</code>, Delta <code>Serializable</code>), with Delta defaulting to the weaker <strong>WriteSerializable</strong>` | High |
| 42 | 6496 | `Both INSERT into the same partition with overlapping logic.` | Blind appends never conflict (Iceberg fast append; Delta append/append) | `Both read-then-rewrite the same files (e.g. two DELETE/UPDATE/MERGE touching one partition); pure blind appends never conflict, even into the same partition.` | High |
| 43 | 6529 | `or value mod N for ints` | truncate(W) on ints = `v - (v mod W)` (floor to multiple) | `or <code>v - (v % W)</code> (floor to a multiple of W) for ints/decimals` | High |
| 44 | 6534 | `<span class="kw">SET</span> <span class="kw">PARTITION</span> SPEC (days(event_ts));` | Not valid Iceberg Spark SQL | `REPLACE PARTITION FIELD hours(event_ts) WITH days(event_ts);` (keep kw spans) | High |
| 45 | 6559 | `<strong>Cost on write</strong>: write the new rows + the delete file. Cheap. <strong>Write amplification: 1×.</strong>` | Still scans to find matching positions; rewrite deferred to compaction | `<strong>Cost on write</strong>: still scan to locate matches, then write only new rows + a small delete file/DV. <strong>Near-1× bytes written</strong> — the rewrite is deferred to compaction.` | High |
| 46 | 6574 | `good (small delete files)` | Logical delete ≠ erasure. GDPR needs physical removal | `good for the write — but erasure needs compaction + <code>expire_snapshots</code> (Delta: <code>REORG … APPLY (PURGE)</code> + <code>VACUUM</code>)` | High |
| 47 | 6624 | `the operation is undefined and Iceberg/Delta will throw` | Self-contradictory | `the SQL standard requires an error, and Spark with Iceberg/Delta raises a cardinality violation` | Medium |
| 48 | 6646 | `Sorts within each output file.` | Iceberg sort rewrite range-partitions + sorts across the file group, so files get non-overlapping ranges (file-level pruning, not only row-group) | `Range-sorts each file group, so output files cover non-overlapping key ranges — tighter file-level min/max (skipping whole files) and row-group stats.` | High |
| 49 | 6651-2 | `A predicate on either column prunes a large fraction of files.` + `Math: on N columns, Z-order gives ~N^(1/N) selectivity per column…` | The math is wrong | `Rough math: with F files and N Z-ordered columns, each column is cut into ~F<sup>1/N</sup> ranges, so a filter on any one column reads ~F<sup>−1/N</sup> of files (F=10,000: N=2 → ~1%, N=4 → ~10%). A linear sort reads ~1/F for the lead column and ~all files for the rest.` | High |
| 50 | 6713 | `Atomic: just swap the current snapshot pointer.` | True for Iceberg only. Delta RESTORE writes a new commit re-adding files | `Iceberg: an atomic pointer move. Delta: <code>RESTORE</code> writes a new commit that re-adds the old files (it appears in history).` | High |
| 51 | 6720 | `default value if not in older files` | v2: reads as null. Defaults (`initial-default`) are v3 | `reads as NULL from older files (v3 adds <code>initial-default</code>/<code>write-default</code>)` | High |
| 52 | 6733 | `Older readers without ID support fall back to name-based mapping.` | Backwards: Iceberg reading files *without* IDs (migrated Hive/Parquet) uses `schema.name-mapping.default` | `Files written without IDs (e.g. migrated via <code>add_files</code>/<code>migrate</code>) are read through the table&#39;s <code>schema.name-mapping.default</code>.` | High |
| 53 | 6740 | `protocol versions ≥ 2` | Column mapping = reader v2 / writer v5 (or table features) | `column mapping (reader v2 / writer v5); Delta 4.0 adds type widening` | High |
| 54 | 6828 | `yes (with Nessie/Polaris/Iceberg V3)` | Branches/tags are in the table metadata (refs) since Iceberg 1.2 on v2; any catalog works | `yes (table-level refs since 1.2, any catalog; Nessie adds multi-table branches)` | High |
| 55 | 6873 | `multi-region. Good` | Glue Data Catalog is regional. Glue also serves Iceberg branches (they're in metadata) and exposes an Iceberg REST endpoint | `regional (replicate for DR). Good` and replace `No branches.` with `Iceberg branches work (they live in table metadata); also exposes an Iceberg REST endpoint and backs S3 Tables.` | High |
| 56 | 6891 | `Enable Iceberg's auto-compaction (write-side) if available.` | OSS Iceberg has none. It is managed-service or Delta `autoCompact`/`optimizeWrite` | `Use managed compaction where offered (Glue/S3 Tables, Databricks predictive optimization); on Delta enable <code>optimizeWrite</code>/<code>autoCompact</code>.` | High |
| 57 | 6895 | `an in-flight reader needed` | Readers only touch committed (referenced) files. The victims are in-flight **writers**' uncommitted files | `an in-flight writer or compaction had written but not yet committed` | High |
| 58 | 6900 | `you risk deleting files referenced by a snapshot you're about to expire but haven't yet.` | Referenced files are never orphans. Real risks: uncommitted writes; path scheme mismatch (`s3://` vs `s3a://`) marking live files orphaned | `you risk deleting files from writes still in flight — and a path-scheme mismatch (<code>s3://</code> vs <code>s3a://</code>) can make live files look orphaned; always dry-run first.` | High |
| 59 | 6908 | `Or use REST catalog with retry-with-backoff.` | Retries are client-side (`commit.retry.num-retries`, `min/max-wait-ms`), any catalog | `Or tune client commit retries (<code>commit.retry.num-retries</code>, backoff) — and shrink the conflict surface first.` | Medium |
| 60 | 6911 | `Replicate data files with S3 cross-region replication` | Metadata holds absolute paths, so replicated metadata points back to the source bucket | Append: `— but metadata stores absolute paths, so a replica is unreadable until paths are rewritten (<code>rewrite_table_path</code>, Iceberg 1.8+) or you use multi-region access points.` | High |
| 61 | 6913 | `who, when, what changed` | Delta `commitInfo` has user (on Databricks). Iceberg snapshot summary has engine/app id, not user identity | `when and what changed (Delta commitInfo can carry the user; Iceberg needs the catalog&#39;s audit log for who)` | Medium |
| 62 | 6945 | `(v1) or merge-on-read (v2)` | Mixes format version and write mode (COW is valid on v2/v3) | `Copy-on-write or merge-on-read (row-level deletes need v2+; v3 uses deletion vectors)` | High |
| 63 | 6949 | `Deletion vectors (since 3.0)` | DELETE with DVs in 2.4, UPDATE in 3.0, MERGE in 3.1 | `Deletion vectors (DELETE 2.4, UPDATE 3.0, MERGE 3.1)` | Medium (VERIFY) |
| 64 | 6950 | `Spark (native), Trino (read), others growing` | The Trino Delta connector writes (INSERT/UPDATE/DELETE/MERGE). delta-rs, Delta Kernel, DuckDB, Polars exist | `Spark (native), Trino (read/write), Flink, delta-rs/DuckDB/Polars via Kernel` | High |
| 65 | 6952 | `Good (compact-on-write)` | No OSS compact-on-write | `Good (Flink upserts via equality deletes; needs scheduled compaction)` | High |
| 66 | 6987 | `Still early but strategically significant.` | Polaris graduated to an Apache TLP on 19 Feb 2026, with monthly releases | `Apache top-level project since Feb 2026; Snowflake Open Catalog is its managed form.` | High |
| 67 | 6995 | `the entire partition gets rewritten` | COW rewrites touched files; the whole partition only when changes hit every file | `every data file containing a changed row is rewritten — with scattered keys that is effectively the whole partition` | High |
| 68 | 7003 | `updated to X` | Delete files only mark deletes. Updated rows go to new data files | `these rows are deleted" (updated rows are re-written as new rows in a new data file)` | High |
| 69 | 7008 | `doesn't touch overlays` | Rewriting a file applies its deletes/DVs | `absorbs deletes only for the files it happens to rewrite` | High |
| 70 | 7028 | `point the final-table catalog entries at the staging paths atomically` | HMS/Glue have no atomic multi-entry swap | `publish via a single atomic step — a view swap, an Iceberg WAP branch <code>fast_forward</code> per table, or a Nessie multi-table branch merge (only the last is atomic across tables)` | High |
| 71 | 7030 | `If dim is committed before fact, consumers can handle missing dim keys gracefully (inferred members).` | Contradictory: dim-first means no missing keys. Inferred members are for fact-before-dim | `Commit dims before facts so fact rows never reference missing keys; when facts must land first, insert inferred (placeholder) members and backfill.` | High |
| 72 | 7035 | `Iceberg (as of v1.4+) supports a <code>Transactions</code> API that commits against multiple tables atomically` | The REST spec's multi-table commit endpoint + Java API; server support varies; no Spark SQL syntax | `The Iceberg REST spec defines a multi-table commit (<code>POST …/transactions/commit</code>) exposed through the Java catalog API — no Spark SQL syntax, and server support varies` (also replace `Glue doesn't.` with `check your catalog.`) | Medium (VERIFY) |

---

## Parts 08–09 — Interview Scenarios, Prep Program — "REAL" / COMPANY CLAIMS (in scope, plus the related page-level meta outside scope)

| Line | Exact raw-HTML quote | Proposed replacement |
|---|---|---|
| 7039 | `<h1 class="part-title">Interview Q&amp;A — Real Scenarios</h1>` | `<h1 class="part-title">Interview Q&amp;A — Scenarios</h1>` |
| 95 | `<span class="chip-title">Interview Q&amp;A — Real Scenarios</span>` | `<span class="chip-title">Interview Q&amp;A — Scenarios</span>` |
| 7043 | `These are scenarios drawn from real Senior / L5 Data Engineering loops — Netflix, Stripe, Airbnb, Pinterest, Uber, Meta, DoorDash.` | `These are practice scenarios modelled on the kinds of problems senior / L5 data-engineering loops probe: incidents, design, internals, judgement. They are composites written for this guide, not questions reported from any specific company.` |
| 7043 | `Every scenario is something a real engineer faced at 3am or in a design review.` | `Each is the kind of situation a working data engineer meets on call or in a design review.` |
| 8035 | `These are the specific failure modes that show up in post-debrief scorecards` | `These are common failure modes that interviewers tend to write down` |
| 8135 | `Four "lean hires" is a statistical hire probability below 50% at most committees.` | `A loop made entirely of "lean hire" votes often fails to clear the bar.` |
| 8118 | `The bar raiser asks "why us specifically?"` | `The last interviewer asks "why us specifically?"` (bar raiser is Amazon-specific) |
| 8143 | `The interview loop for senior (L5), staff (L6), and principal (L7) uses the same rounds` | `Level numbers differ by company (one company's L5 is another's L6); this guide uses L4 mid, L5 senior, L6 staff, L7 principal as shorthand. The loop for senior, staff, and principal usually uses the same rounds` |
| 8251 | `These are the SQL problems that actually separate seniors from mid-level engineers in interview rounds.` | `These are SQL problems at the level that tends to separate senior from mid-level candidates.` |
| 8776, 8801, 8826, 8854 | `<h4>Prompt (verbatim)</h4>` **(×4)** | `<h4>Prompt</h4>` (replace all) |
| 9068 | `Interviewers ask this as an opener in 80% of rounds.` | `It is a common opener.` |
| 9143 | `11. Tricky Behavioral Scenarios — Real Data-Engineering Situations` | `11. Tricky Behavioral Scenarios — Data-Engineering Situations` (the id can stay) |
| 9145 | `The questions in this section are drawn from actual DE interview loops at senior and staff level.` | `The questions in this section are representative senior- and staff-level behavioral prompts, written for this guide. The first-person answers are illustrative composites, not transcripts.` |
| 9153… | `<h4>The real scenario</h4>` **(×8)** | `<h4>The scenario</h4>` (replace all) |
| 8885 | `Every senior loop includes at least one dedicated behavioral round` | `Most senior loops include a dedicated behavioral round` |
| 7854 | `Four weeks is the minimum a working engineer needs to credibly prepare for a senior loop at a top-tier company.` | `Four weeks is a realistic plan for a working engineer preparing for a senior loop.` |

**Outside scope, same claim (flag to the owner):**
- 12: `40+ real interview Q&amp;A scenarios` → `40+ interview Q&amp;A scenarios`
- 18, 40, 87: `40+ real scenarios` **(×3)** → `40+ scenarios`
- 44 (JSON-LD): `40+ real interview scenarios, a 4-week` → `40+ interview scenarios, a 4-week`
- 152: `40+ real interview scenarios with full answer skeletons` → `40+ interview scenarios with full answer skeletons`
- 102: `The final file is interview Q&amp;A built from real scenarios` → `Part 08 is interview Q&amp;A built around realistic scenarios` (Part 08 is not the final part)
- `index.html` 636 and 1889: "40+ real interview scenarios". `article_metadata.json` 196: "40+ real scenarios … full interview transcripts" ("transcripts" implies they are real; use "worked answer transcripts (illustrative)").

---

## Parts 08–09 — Interview Scenarios, Prep Program — QUESTIONABLE TECHNICAL CLAIMS

| Line | Exact quote | What's wrong | Replacement raw HTML | Conf |
|---|---|---|---|---|
| 7192 | `<span class="kw">WHERE</span> partition_event_date <span class="op">=</span>` | Iceberg `files` metadata table has a `partition` struct column, not `partition_event_date` | `<span class="kw">WHERE</span> partition.event_date <span class="op">=</span>` | High |
| 7198 | `<strong>Long-term</strong>: enable async compaction at write time, or reduce streaming commit frequency.` | Iceberg has no generic write-time async compaction (Delta has auto-compact; Iceberg relies on scheduled `rewrite_data_files` or engine-side table maintenance) | `<strong>Long-term</strong>: schedule compaction (e.g., hourly <code>rewrite_data_files</code> on recent partitions, or your platform's table-maintenance service), and reduce streaming commit frequency.` | Medium |
| 7210 | `a partition that fits Tue-Sun no longer fits Mon → AQE skew handling, salt, raise broadcast threshold, or split heavy hitters.` | Raising the broadcast threshold increases memory pressure; it is not an OOM fix | `a partition that fits Tue-Sun no longer fits Mon → AQE skew handling, salt, more shuffle partitions, or split heavy hitters (broadcast only if the small side genuinely fits).` | High |
| 7211 | `<strong>JVM OOM in Pandas UDF aggregation</strong>: Python worker exploding on a single mega-group` | Python-worker memory lives outside the JVM heap, so it shows up as a container kill (exit 137), not a JVM OOM | `<strong>Python-worker OOM in Pandas UDF aggregation</strong> (container kill, not heap): Python worker exploding on a single mega-group` | High |
| 7257 | `<strong>Cost</strong>: Kafka (compute + storage) &gt; Flink (CPU) &gt; S3 (storage); aim for 70/20/10 distribution.` | Invented target ratio | `<strong>Cost</strong>: at this rate Kafka retention and replication usually dominate (1 GB/s × 3 replicas × 7 days ≈ 1.8 PB on brokers unless tiered storage is on); estimate each tier explicitly.` | Medium |
| 7307 | `understanding that streaming is fundamentally probabilistic for metrics` | Streaming isn't probabilistic; it is incomplete until a watermark or finality point | `understanding that a streaming result is provisional until the data is final (late events can still change it)` | Medium |
| 7332 | `Reject events with source_ts_ms older than the dim's current row.` | `ts_ms` is commit wall-clock time and is not a strict order; use the log position | `Reject events whose source log position (LSN / binlog offset) is older than the one recorded on the dim's current row.` | Medium |
| 7379 | `this is <code>Dynamic Join Selection</code>.` | AQE converts SMJ→BHJ by re-planning with runtime stats (`spark.sql.adaptive.autoBroadcastJoinThreshold`, read locally). The `DynamicJoinSelection` rule mostly demotes broadcast or prefers SHJ | `this is AQE re-planning with runtime statistics (governed by <code>spark.sql.adaptive.autoBroadcastJoinThreshold</code>; the shuffle output is read locally).` | Medium |
| 7391 | `<strong>Disk</strong> → ESS disk full or slow. Push-based shuffle (Magnet) helps.` | Push-based shuffle is supported only on YARN with the external shuffle service | `<strong>Disk</strong> → ESS disk full or slow. On YARN, push-based shuffle (Magnet, Spark 3.2+) helps; on K8s consider a remote shuffle service.` | High |
| 7402 | `Function on indexed column: <code>WHERE date(ts) = ...</code> — doesn't push.` | Spark/Parquet have no indexes; the issue is that a function applied to the column can't be pushed to the source | `Function wrapping the column: <code>WHERE date(ts) = ...</code> — often doesn't push; rewrite as a range on <code>ts</code>.` | Medium |
| 7432 | `On conflict: discard the new metadata.json (the data files are orphan but that's fine for now), refresh to the latest snapshot, re-evaluate the changes, retry from step 2 (or just step 5 if changes still apply).` | On retry, Iceberg reuses the written data files and re-validates against the new base, then rewrites the manifest list and metadata. It does not rewrite data | `On conflict: refresh to the latest snapshot, validate that the change still applies (e.g., no conflicting deletes), and retry steps 4–6 reusing the already-written data files; only if validation fails does the commit abort, leaving orphan files for cleanup.` | High |
| 7445 | `with parallelism &gt; partitions, multiple source subtasks share partitions but the math holds — each subtask emits one watermark; downstream takes min.` | Each partition goes to exactly one subtask; the extra subtasks sit idle and can stall the watermark unless idleness is configured | `with parallelism &gt; partitions, some source subtasks get no partition at all; without <code>withIdleness</code> they can hold the downstream min watermark back.` | High |
| 7462 | `Snowflake/BigQuery execution prefers it.` | BigQuery guidance favors denormalized / nested-repeated schemas | `Snowflake handles star joins well; BigQuery often favors denormalized or nested-repeated schemas for large facts.` | Medium |
| 7504 | `If GDPR-driven hard delete: lakehouse MERGE-ON-READ with deletion vectors, applied on a per-user basis, with retention controls.` | Deletion vectors are logical deletes; the bytes remain until the files are rewritten and snapshots expired or vacuumed | `If GDPR-driven hard delete: DELETE (MoR or deletion vectors) for fast logical removal, then compaction/rewrite plus snapshot expiry (Iceberg) or VACUUM (Delta) so the bytes are physically gone within the deadline.` | High |
| 7514 | `Sub-second is 10–100× more expensive than 5-minute.` | Unsupported multiplier | `Sub-second is typically far more expensive than 5-minute: always-on compute, a serving store, more on-call.` | Medium |
| 7789 | `<em>error budget</em> (5% = 8.4 hours/week can miss target)` | Mixes a data-fraction target (95% of data) with a time budget | `<em>error budget</em> (5% of measurement intervals, ≈ 8.4 hours/week, may miss target)` | Medium |
| 7804 | `Did a table grow 5x because of a bad MERGE that didn't vacuum? Run <code>TABLE_STORAGE_METRICS</code>.` | Snowflake has no VACUUM; churned micro-partitions are kept by Time Travel and Fail-safe | `Did a table grow 5x because heavy MERGE churn is being retained in Time Travel / Fail-safe? Query <code>TABLE_STORAGE_METRICS</code>.` | High |
| 7813 | `use flex slots with off-peak pricing` | Flex slots were retired in 2023 with BigQuery Editions; there is no off-peak pricing | `use Editions autoscaling (baseline + autoscale slots) and schedule batch into off-hours reservations` | High |
| 7874 | `write <em>percentile_cont</em> by hand using <code>NTILE</code> and interpolation.` | NTILE buckets can't produce percentile_cont; you need row_number and count | `write <em>percentile_cont</em> by hand using <code>ROW_NUMBER</code>, <code>COUNT</code> and linear interpolation.` | High |
| 8077 | `Cardinality × retention / compaction target = files.` | Dimensionally wrong | `Partitions = key cardinality × time buckets retained; files ≈ partitions × (data per partition ÷ target file size, min 1).` | High |
| 8253 | `Every solution is written in ANSI-style SQL that runs on Snowflake, BigQuery, Redshift, and Postgres with minor dialect tweaks. Spark SQL equivalents are noted where they diverge.` | Q1–Q3 are Snowflake (`DATEDIFF('unit',…)`); Q4 uses Postgres-only `GENERATE_SERIES`; Q7/Q8 use the WINDOW clause (not in BigQuery's date-interval syntax; Snowflake support unverified); no Spark notes exist | `Each solution names its dialect (Snowflake or Postgres); porting to BigQuery/Spark needs date-function and interval changes, noted in the table below.` | High |
| 8261 | `Include month 0 (100% by definition). Go up to month 12.` | The solution emits only m0,1,2,3,6,12. m0 is not 100% by definition (it needs an event in the signup month). The inner JOIN drops cohorts with zero activity, which is the trap the text itself warns about | `Show months 0, 1, 2, 3, 6 and 12 (extend the pattern as needed). Month 0 is the share active in their signup month.` Also change `FROM retention r JOIN cohort_size s` so cohort_size drives it: `FROM cohort_size s LEFT JOIN retention r USING (signup_month)` | High |
| 8453 | `using broadcast hash joins if touches fits` | 10 B touches will not fit in a broadcast | `broadcasting only a pre-filtered slice of touches if it fits (it won't at 10 B rows), otherwise co-partitioning both sides by user_id and time bucket` | Medium |
| 8500 | `WHEN LAG(revenue) OVER (PARTITION BY product_id ORDER BY month) = 0 AND revenue &gt; 0 THEN 9999.0` | A sentinel percentage corrupts averages; the standard answer is NULL plus a flag | `WHEN LAG(revenue) OVER (PARTITION BY product_id ORDER BY month) = 0 AND revenue &gt; 0 THEN NULL` (+ note "growth from zero is undefined; flag it separately") | Medium |
| 8551 | `switch to <code>DENSE_RANK()</code> and filter on <code>dense_rank &lt;= 3</code>.` | "Top 3 with ties" (FETCH … WITH TIES) is RANK; DENSE_RANK ≤ 3 returns every product in the top 3 distinct revenue values | `switch to <code>RANK()</code> and filter on <code>rnk &lt;= 3</code> (use <code>DENSE_RANK</code> only if they want the top 3 distinct revenue values).` | High |
| 8601 | `Spark's <code>asOfJoin</code> can keep the history broadcast.` | No public Spark SQL/DataFrame as-of join; `pyspark.pandas.merge_asof` is rewritten by `RewriteAsOfJoin` into a correlated subquery (join + aggregate) with no broadcast guarantee | `Spark exposes as-of joins only via <code>pyspark.pandas.merge_asof</code>, which is rewritten into a join plus aggregate, so benchmark it; at scale, bucket by key and time range, or use a range join with broadcast of the smaller side.` | Medium (Ext: Y, checked) |
| 8630 | `CASE WHEN t_start &gt; t_view  AND t_start &lt;= t_visit + INTERVAL '24 hours' THEN t_start END AS t_start_ok,` | Uses raw `t_view`, not `t_view_ok`, so a user whose view preceded the visit can count at step 3 without reaching step 2. Also first-occurrence MIN over 30 days misses users who converted on a later visit | `CASE WHEN t_view  &gt; t_visit AND t_start &gt; t_view  AND t_start &lt;= t_visit + INTERVAL '24 hours' THEN t_start END AS t_start_ok,` (and the same chaining for `t_done_ok`). Add a note that the first-touch simplification is intentional | High |
| 8681 | `    ROWS BETWEEN 89 PRECEDING AND 1 PRECEDING` | `daily` has no rows for zero-transaction days, so 89 ROWS ≠ 89 days, and a drop to zero (the most important anomaly) is invisible | Build a dense merchant × date grid with `COALESCE(count,0)` first, or use `RANGE BETWEEN INTERVAL '89 days' PRECEDING AND INTERVAL '1 day' PRECEDING` (Postgres 11+). Also extend the source filter to 180 days so a 90-day baseline exists | High |
| 8712 | `The target engine does not have a <code>MEDIAN</code> function (assume older Postgres).` | Postgres never had MEDIAN but has had `percentile_cont` since 9.4 | `The target engine has neither <code>MEDIAN</code> nor <code>PERCENTILE_CONT</code> (in Postgres you would use <code>percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)</code>).` | High |
| 8795 | `I'd set a watermark of 2 hours on silver and emit late arrivals to a "late" side-table that the nightly batch re-incorporates.` | Spark Structured Streaming has no late-data side output (that's Flink), and a stateless bronze→silver projection never drops late rows | `I'd use event-time windows with a 2-hour watermark for the dashboard aggregates, and have the nightly batch recompute from bronze by event date so late arrivals land in the report.` | Medium |
| 8848 | `I keep the underlying S3 files for 90 days for forensic rollback, then delete.` | After `snapshot`, the Iceberg table references those same files; deleting them breaks Iceberg | `The historical files are still referenced by the Iceberg table, so they stay; I only drop the Hive metastore entry (and rewrite/expire them later through Iceberg itself).` | High |
| 8868 | `the regulatory constraint that declines cannot be retried on a different model version` | Invented regulation | `the audit requirement to pin the model version per decision so a retry can't produce a conflicting answer` | High |
| 8871 | `'Approve everything' is fraud-friendly; 'decline everything' is customer-friendly.` | "Decline everything" is customer-hostile; the wording is reversed | `'Approve everything' lets fraud through; 'decline everything' blocks every legitimate customer.` | High |
| 8874 | `The model is deployed as a gRPC service with per-request timeouts of 150 ms` | Contradicts its own 100 ms inference budget | `The model is deployed as a gRPC service with a per-request timeout of 100 ms (its budget)` | High |
| 8877 | `retained for 7 years. That's a compliance minimum in this industry.` | Unsupported; retention rules depend on jurisdiction and regime | `retained for the period your compliance team specifies (often multi-year).` | Medium |
| 8878 | `roughly $50-100K/month just for the online feature store at that request rate` | Unsourced number | `a meaningful monthly bill for the online store at 20K peak lookups/s; I'd size it from the provider's per-read pricing before committing` | Medium |
| 8965 | `streaming is roughly 3–10x the ops overhead of batch` | Unsupported multiplier | `streaming carries materially more ops overhead than batch (always-on, state, on-call)` | Medium |
| 8970 | `In a lakehouse, denormalized wide tables are almost always the right answer for analytics layers` | Contradicts p08-q20's heuristic | `In a lakehouse, denormalized wide tables are often the right answer for consumption marts (keep conformed dimensions underneath)` | Medium |
| 8983 | `high cost-per-GB at scale. Lakehouses (Iceberg/Delta on S3) win when data volume crosses ~100 TB` | Warehouse storage is priced near object storage; compute and lock-in are the real axes. ~100 TB is unsupported | `a cost model driven by compute, not storage. Lakehouses (Iceberg/Delta on S3) win when many engines must share the data or ML training reads it directly` | Medium |
| 9166 | `I wrote the MRR fix myself — the query became` | The fix uses a `paused_until` column on the dim, but the chosen Option B leaves the dim untouched | Rewrite the MRR fix against `fct_subscription_state_change` (e.g., exclude subscriptions whose latest state is `paused`) | Medium |
| 9168 | `event-sourced state changes is strictly better than a nullable column on a dim` | Overstated | `event-sourced state changes fit this case better than a nullable column on a dim` | Medium |
| 9182 | `salted joins or broadcast with a skew hint` | OSS Spark has no skew hint (it's a Databricks feature); AQE skew-join is the OSS mechanism | `salted joins or AQE skew-join handling` | High |
| 9182 | `let's call him the staff eng from the other pod` | Heading says "a senior engineer on your team" | `let's call him the staff engineer` (also align the heading) | Medium |
| 9210 | `written as bash scripts that call <code>snowflake</code> CLI` | Snowflake's CLIs are `snowsql` (legacy) and `snow` | `written as bash scripts that call <code>snowsql</code>` | High |
| 9218 | `our current airflow test framework covers 3 of the 6 categories dbt generic tests cover` | dbt ships four built-in generic tests (unique, not_null, accepted_values, relationships) | `our current airflow checks already covered 2 of dbt's 4 built-in generic tests (not_null, unique) but not accepted_values or relationships` | High |
| 9256 | `My manager took the pager to the product lead.` | Garbled | `My manager took the one-pager to the product lead.` | High |
| 9340 | `First, the loader now uses a dedicated <code>ingested_at</code> timestamp I added to the source contract` | The root cause was merging partial/delta rows over full rows. A new timestamp column doesn't fix that; incremental on `updated_at` is standard CDC | `First, the loader now re-reads the full current row for every changed order_id (not the delta) before MERGE, and the source contract documents which events bump <code>updated_at</code>` | Medium |
| 9365 | `they'd set <code>allowedLateness</code> to zero while reading from a multi-partition topic where one partition lagged by 8 seconds.` | With per-partition watermarks a lagging partition holds the watermark back and does not cause drops. Drops happen when the watermark is assigned after the source (interleaved partitions) with too-small out-of-orderness | `they'd assigned the watermark after the source with zero out-of-orderness, so one partition lagging 8 seconds behind the others had its records arrive behind the watermark; moving the <code>WatermarkStrategy</code> onto the Kafka source (per-partition) fixed it.` | Medium |
| 7411 | `See chapter 03, section 9. Crisp version:` | §9 is Kafka internals | `See <a href="#p03-8-flink-internals--dataflow-barriers-state">Part 03 §8</a>. Crisp version:` | High |
| 7460 | `<p>See chapter 01, section 11.</p>` | §11 is Medallion | `<p>See <a href="#p01-10-one-big-table--the-columnar-revolution">Part 01 §10</a> and §4.</p>` | High |
| 7175 | `As a last resort, increase Kafka partitions (rebalances, irreversible).` | Omits the key-ordering break | `As a last resort, increase Kafka partitions (irreversible; changes key→partition mapping, so per-key ordering breaks across the change).` | High |

---

## Parts 10–12 — Governance, Cost, Data Quality — QUESTIONABLE CLAIMS (exact raw HTML; each unique in file)

| Line | Exact quoted raw HTML | What's wrong | Proposed replacement raw HTML | Conf. |
|---|---|---|---|---|
| 9418 | `imposes obligations on any system processing personal data of EU residents, regardless of where the processor is located.` | Art. 3 scope covers data subjects *in the Union* (not "residents") and applies extraterritorially only when offering goods/services to them or monitoring their behaviour | `applies to controllers and processors established in the EU, and to non-EU organisations that offer goods or services to, or monitor the behaviour of, people in the EU (Art. 3) — location of the data subject, not citizenship or residency, is what counts.` | High |
| 9420 | `<h3 id="p10-gdpr-principles">The six Article 5 principles</h3>` | Art. 5 has seven: six in 5(1) plus **accountability** 5(2). Accountability is the one that drives audit trails (and P10 cites it at 9551) | `<h3 id="p10-gdpr-principles">The Article 5 principles (six in 5(1), plus accountability in 5(2))</h3>` and add `<li><strong>Accountability (5(2))</strong> — you must be able to <em>demonstrate</em> compliance: lineage, audit logs, DPIAs, records of processing.</li>` | High |
| 9434 | `<li>Expire old snapshots past the retention window so that historical data files without the row are the only ones accessible.</li>` | Garbled, and incomplete. With merge-on-read (Iceberg delete files, Delta deletion vectors) the *current* data file still physically contains the row. Expiry only unreferences old files; Delta needs `VACUUM` to delete them | `<li>Physically remove the row: rewrite affected files (Delta: <code>REORG TABLE t APPLY (PURGE)</code> when deletion vectors are on; Iceberg MOR: <code>rewrite_data_files</code>/<code>rewrite_position_delete_files</code>), then expire snapshots and delete unreferenced files (Iceberg <code>expire_snapshots</code> + <code>remove_orphan_files</code>; Delta <code>VACUUM</code>). Until then, time travel still returns the PII.</li>` | High |
| 9436 | `GDPR allows "reasonable" time for backup purge.` | Not in the GDPR text. Art. 12(3) sets one month (extendable by two); backup treatment ("beyond use") is regulator guidance, e.g. UK ICO | `GDPR requires a response within one month (extendable by two, Art. 12(3)); for backups, regulators such as the UK ICO accept putting data "beyond use" until the backup rotates out, provided restores re-apply the erasure queue — document it.` | High |
| 9440 | `True <strong>anonymization</strong> (k-anonymity ≥5, differential privacy) takes data out of GDPR scope entirely` | No numeric k threshold exists in law; the test is whether re-identification is "reasonably likely" (Recital 26). WP29 Opinion 05/2014 shows k-anonymity alone is vulnerable to linkage/homogeneity attacks | `True <strong>anonymization</strong> — where re-identification is no longer "reasonably likely" by any party (Recital 26) — takes data out of GDPR scope; k-anonymity alone rarely meets that bar (WP29 Opinion 05/2014), differential privacy with a tracked ε is stronger` | High |
| 9443 | `Some regulations require EU personal data to remain in EU-region storage.` | GDPR does not mandate EU storage. It restricts *transfers* outside the EEA (Chapter V: adequacy incl. EU–US Data Privacy Framework 2023, SCCs, BCRs). Localisation mandates come from sector/national laws or contracts. Also: a federated query that pulls EU rows to a non-EU coordinator is itself a transfer | `GDPR does not require EU storage; it restricts transfers outside the EEA (Chapter V — adequacy decisions such as the 2023 EU–US Data Privacy Framework, SCCs, BCRs). Hard residency usually comes from sector/national law or customer contracts.` | High |
| 9446 | `CCPA (effective 2020, strengthened by CPRA 2023)` | Imprecise. CPRA passed Nov 2020 (Prop 24), became operative 1 Jan 2023, created the CPPA regulator, and added "sharing", correction and "limit SPI" rights | `CCPA (effective 1 Jan 2020; amended by the CPRA, operative 1 Jan 2023, which created the California Privacy Protection Agency and added correction, "sharing" and limit-SPI rights)` | High |
| 9450 | `has extra restrictions; requires clear disclosure and opt-out mechanism.` | CPRA's SPI right is a "right to limit use and disclosure", not a generic opt-out; also missing: Global Privacy Control must be honoured as an opt-out signal (§7025), and access/deletion requests have 45 days (+45) | `carries a separate "Limit the Use of My Sensitive Personal Information" right. Pipelines must also treat a Global Privacy Control browser signal as an opt-out of sale/sharing, and answer access/deletion requests within 45 days (extendable once by 45).` | Medium-High |
| 9457 | `Ad-hoc production changes are a SOX violation.` | SOX doesn't prescribe change tickets; an unapproved change to an in-scope system is a **control deficiency/exception** that auditors report (and can escalate to a material weakness) | `Unapproved production changes to in-scope systems are ITGC exceptions that auditors report as control deficiencies; use a documented emergency-change path with after-the-fact approval.` | High |
| 9458 | `Immutable audit logs (CloudTrail, Snowflake ACCESS_HISTORY, Delta audit log).` | Delta has no "audit log". Its transaction-log history is bounded (`delta.logRetentionDuration`, default 30 days) and not tamper-proof. ACCESS_HISTORY is Enterprise Edition+ | `Audit logs shipped to write-once storage (CloudTrail with log-file validation, Snowflake ACCESS_HISTORY — Enterprise Edition+, copied out before its 365-day window; Delta <code>DESCRIBE HISTORY</code> is operational history bounded by <code>delta.logRetentionDuration</code>, not an audit log).` | High |
| 9469 | `<td>S3 lifecycle rule → Glacier after 30d → delete at 90d</td>` | Glacier Flexible has a 90-day minimum storage charge: 60 days in Glacier is billed as 90, plus per-object transition fees. Contradicts P11's own table | `<td>S3 lifecycle: Standard → delete at 90d (don't transition short-lived data to Glacier — 90-day minimum-duration charge and per-object transition fees)</td>` | High |
| 9470 | `<td>S3 Glacier Deep Archive; query via Athena on-demand</td>` | Athena cannot read Deep Archive/Flexible objects in place; they must be restored first (hours). Glacier Instant Retrieval *is* directly readable | `<td>Glacier Instant Retrieval if still queried (Athena reads it directly); Deep Archive only for data you will restore before querying (12–48h)</td>` | High |
| 9472 | `<td>7 years (SOX) / 3 years (GDPR)</td>` | GDPR sets no audit-log retention period (only storage limitation); "3 years" is invented. The 7-year figure stems from SOX §802 / SEC Rule 2-06 audit-record retention and is common practice, not a universal statute for all logs | `<td>Commonly 7 years for financial-control evidence (SOX §802 / SEC Rule 2-06 practice); GDPR sets no fixed period — justify and document one</td>` | High |
| 9477 | `<code>ALTER TABLE events DROP PARTITION (dt &lt; '2025-01-01')</code>` | Delta rejects `DROP PARTITION`; Iceberg's Spark DDL has no `DROP PARTITION` (only `DROP PARTITION FIELD`, which is spec evolution and deletes nothing). This is Hive syntax | `<code>DELETE FROM events WHERE dt &lt; '2025-01-01'</code> (a metadata-only delete when the predicate aligns with partition boundaries; files are physically removed only after snapshot expiry / <code>VACUUM</code>)` | High |
| 9483 | `Captured automatically by orchestration tools (Airflow, dbt) or query audit logs.` | Airflow captures no lineage by itself; it needs the OpenLineage provider plus operator support. dbt gives model-level lineage from `manifest.json` | `Captured from dbt's <code>manifest.json</code>, from Airflow via the OpenLineage provider (Airflow 2.7+, operator-dependent), or from warehouse query/access logs.` | Medium-High |
| 9489 | `dbt (dbt-openlineage)` | Package name is `openlineage-dbt` (run through the `dbt-ol` wrapper) | `dbt (<code>openlineage-dbt</code>, run via the <code>dbt-ol</code> wrapper)` | High |
| 9506 | `<td>Zero ops, native with Athena/Glue/EMR</td><td>AWS-only; no business metadata, no lineage</td>` | Overstated as of 2024–25: business glossary and lineage exist via Amazon DataZone / SageMaker Catalog on top of Glue | `<td>Zero ops, native with Athena/Glue/EMR; Iceberg REST endpoint</td><td>AWS-only; business glossary and lineage need DataZone/SageMaker Catalog on top</td>` | Medium |
| 9519 | `AWS Macie, Google DLP, and Presidio (open-source)` | Google Cloud DLP was renamed Sensitive Data Protection (2023); Macie scans S3 only | `AWS Macie (S3 only), Google Cloud Sensitive Data Protection (formerly Cloud DLP), and Microsoft Presidio (open-source)` | High |
| 9526 | `<tr><td>Pseudonymization (replace with token)</td><td>Yes (with key)</td>` | Depends on method. A keyed hash (HMAC) is joinable but *not* reversible; a mapping table or deterministic encryption is reversible | `<tr><td>Pseudonymization (keyed hash, mapping table or deterministic encryption)</td><td>HMAC: no (but joinable); mapping/encryption: yes</td>` | High |
| 9528 | `<tr><td>Encryption (AES-256 at rest)</td><td>Yes (with key)</td><td>Storage-level protection; key rotation needed</td></tr>` | At-rest encryption protects media and snapshots, **not** against authorised query users. Column/envelope encryption with KMS and crypto-shredding are the data-engineering-relevant options | `<tr><td>Encryption at rest (SSE-KMS) / column-level envelope encryption</td><td>Yes (with key)</td><td>At rest: disk/snapshot theft only — not a control against query users. Column-level with per-subject keys enables crypto-shredding for erasure</td></tr>` | High |
| 9548 | `Snowflake: <code>QUERY_HISTORY</code> and <code>ACCESS_HISTORY</code> views capture who queried what columns when.` | ACCESS_HISTORY needs Enterprise Edition+; ACCOUNT_USAGE views have latency (up to ~3h for ACCESS_HISTORY) and 365-day retention | `Snowflake: <code>ACCOUNT_USAGE.QUERY_HISTORY</code> and <code>ACCESS_HISTORY</code> (Enterprise Edition+; up to ~3h latency, 365-day retention — copy out for 7-year needs) capture who read which columns.` | High |
| 9548 | `Redshift: STL_QUERY + audit logging to S3.` | STL tables keep only a few days; `SYS_QUERY_HISTORY` is the current view (provisioned + Serverless); audit logs can go to S3 or CloudWatch | `Redshift: <code>SYS_QUERY_HISTORY</code> (STL tables keep only days) + audit logging to S3/CloudWatch.` | Medium-High |
| 9554 | `Delta Lake's <code>delta.enableChangeDataFeed</code> preserves row-level change history. Iceberg's metadata history is inherently append-only — older snapshots are immutable by the format's design.` | Neither is an immutability control. CDF files and old snapshots are deleted by VACUUM/expiry, and anyone with bucket write access can remove them. CDF also **retains pre-images of erased rows** (a GDPR hazard) | `Table-format history is <em>not</em> an immutability control: Delta Change Data Feed and Iceberg snapshots are removed by <code>VACUUM</code>/<code>expire_snapshots</code>, and anyone with bucket write access can delete them. CDF also keeps pre-images of erased rows — include <code>_change_data</code> in your erasure runbook.` | High |
| 9569 | `A Snowflake credit costs ~$2–4 depending on edition and region.` | Unqualified pricing | `On-demand list price is roughly $2 (Standard) / $3 (Enterprise) / $4 (Business Critical) per credit in US regions, higher elsewhere and discounted under capacity contracts — verify current pricing.` | Medium (verify) |
| 9569 | `a query that takes 4 minutes on M (16 credits total: 4 × 4) takes 2 minutes on L (16 credits total: 2 × 8) — same cost, half the wall time. Larger warehouses are justified only when queries don't parallelize well enough to see linear speedup.` | **Arithmetic is wrong** (it treats minutes as hours: 4 min on M = 4 × 4/60 ≈ 0.27 credits). The rule is **inverted**: upsizing pays off when the query *does* scale linearly or when it removes spilling; if it doesn't parallelise, upsizing just costs more. Also per-second billing with a 60 s minimum on each resume | `a query that takes 4 minutes on M (4 credits/h × 4/60 h ≈ 0.27 credits) takes ~2 minutes on L (8 × 2/60 ≈ 0.27 credits) — same cost, half the wall time, <em>if</em> it scales linearly. Upsize when queries parallelise or spill to remote storage; if they don't speed up, the bigger warehouse is pure waste. Billing is per second with a 60-second minimum each time a warehouse resumes.` | High |
| 9572 | `Set auto-suspend to 60 seconds for infrequent workloads; any longer and you pay for idle compute.` | Ignores the trade-off: suspending drops the warehouse's local disk cache, and every resume bills a 60 s minimum. For BI with queries every few minutes, a very short suspend can cost more and be slower | `Set auto-suspend to ~60 seconds for infrequent ETL; for BI warehouses queried every few minutes, a longer suspend keeps the local disk cache warm and avoids repeated 60-second resume minimums.` | High |
| 9575 | `Snowflake caches query results for 24 hours. Identical queries (exact SQL string, same data version) hit the cache at zero credit cost.` | Incomplete. Reuse also requires the same role privileges and no non-deterministic functions (e.g. `CURRENT_TIMESTAMP()`); the 24h window resets on each reuse, up to 31 days | `Snowflake reuses a persisted result for 24 hours (reset on each reuse, max 31 days) if the SQL text is identical, underlying data is unchanged, the role has the same privileges and the query has no non-deterministic functions like <code>CURRENT_TIMESTAMP()</code> — no warehouse credits consumed.` | High |
| 9578 | `Automatic clustering rerranges data` | Typo | `Automatic clustering rearranges data` | High |
| 9578 | `Use clustering on high-cardinality filter columns that do not match ingestion order` | Backwards per Snowflake guidance. Very high-cardinality keys (raw timestamps, IDs) cluster poorly and expensively; use a coarsened expression (`TO_DATE(ts)`), and only on large (multi-TB) tables with selective filters | `Cluster large (multi-TB) tables on frequently filtered columns with enough distinct values to prune — but not raw high-cardinality columns; coarsen them (<code>TO_DATE(event_ts)</code>, not <code>event_ts</code> or <code>user_id</code>)` | High |
| 9581 | `Materialized views refresh automatically on DML and serve pre-aggregated results at near-zero query cost.` | Snowflake MVs are Enterprise Edition+, single-table (no joins), and maintained by a billed serverless service; queries still use a warehouse. Dynamic Tables (GA 2024) are the multi-table option | `Materialized views (Enterprise Edition+, single-table, no joins) are maintained by a billed serverless service and can serve aggregates far cheaper than the base query; for joins or pipelines use Dynamic Tables with a target lag.` | High |
| 9586 | `Databricks bills in DBUs (Databricks Units, ~$0.07–0.50/DBU depending on tier and VM).` | DBU *price* depends on compute type (Jobs < SQL < All-purpose; serverless bundles VM cost), tier and cloud; the VM determines DBUs/hour. Classic compute is **two bills** (DBU + cloud VM) | `Databricks bills DBUs (price set by compute type — Jobs is cheapest, All-purpose far dearer — plus tier and cloud; the VM size sets DBUs/hour). Classic compute is two bills: DBUs to Databricks and VMs to your cloud; serverless bundles both. Verify current list prices.` | High (structure) |
| 9586 | `Autoscaling is useful for variable-load streaming jobs but adds spin-up latency` | Databricks advises against standard (classic) autoscaling for Structured Streaming; it's for batch. Streaming should use Enhanced Autoscaling in DLT/Lakeflow Declarative Pipelines | `Classic autoscaling suits variable batch load (not Structured Streaming — use enhanced autoscaling in Lakeflow Declarative Pipelines/DLT or a fixed size) but adds spin-up latency` | High |
| 9589 | `Enable graceful spot decommission (<code>spark.databricks.delta.retryCommit.enabled true</code>).` | Not a decommissioning setting. Graceful decommission uses `spark.decommission.enabled` plus `spark.storage.decommission.*` (Spark 3.1+, supported on Databricks) | `Enable graceful decommissioning (<code>spark.decommission.enabled true</code>, <code>spark.storage.decommission.enabled true</code>, <code>spark.storage.decommission.shuffleBlocks.enabled true</code>) so shuffle blocks migrate off a node before spot reclaim.` | High |
| 9592 | `It accelerates SQL-heavy workloads (aggregations, joins, scans) by 2–10×. A smaller cluster with Photon often costs less than a larger cluster without it.` | Contradicts P4 line 4660 ("2–3x"); omits that Photon compute is billed at a **higher DBU rate**, so it saves money only if the speedup exceeds the premium | `It typically speeds SQL/DataFrame-heavy workloads 2–3× (more on some scans/aggregations, nothing on Python UDFs — see <a href="#part-04">Part 4</a>). Photon compute is billed at a higher DBU rate, so it saves money only when the speedup exceeds that premium — measure per job.` | High |
| 9592 | `serverless scales to zero in seconds, charges only for active query time.` | False: serverless SQL warehouses start in seconds but bill while running, including the idle tail until auto-stop (configurable, minutes) | `serverless starts in seconds and auto-stops after a configurable idle period (minutes), so you pay for running time including that idle tail — far less than an always-on classic warehouse.` | High |
| 9595 | `<code>.cache()</code> in Spark caches in JVM heap/memory (evicted on cluster restart).` | `DataFrame.cache()` defaults to `MEMORY_AND_DISK`, not memory-only; also "Delta cache" is now called the **disk cache** | `<code>.cache()</code> on a DataFrame persists at <code>MEMORY_AND_DISK</code> inside the application (gone when it ends); the Databricks <em>disk cache</em> (formerly "Delta cache") keeps local SSD copies of remote Parquet files for that cluster's lifetime.` | High |
| 9607 | `<td>$0.03/GB, 3–5h</td>` | Glacier Flexible *standard* retrieval (3–5h) is ~$0.01/GB; $0.03/GB is Expedited (1–5 min); Bulk (5–12h) is free | `<td>Standard $0.01/GB (3–5h); Expedited $0.03/GB (1–5 min); Bulk free (5–12h)</td>` | Medium-High (verify) |
| 9604 | `<td>Standard-IA</td><td>$0.0125</td><td>$0.01/GB</td><td>30 days</td>` | Missing the 128 KB minimum billable object size (IA, One Zone-IA, Glacier IR). This is critical for small-file lakes | `<td>Standard-IA</td><td>$0.0125</td><td>$0.01/GB</td><td>30 days; 128 KB min object billed</td>` (and add a caption: "us-east-1 list prices; verify") | High |
| 9620 | `raw/<em> (longer retention) vs processed/</em> (shorter)` | Markdown artefact: `raw/*` became italics | `<code>raw/*</code> (longer retention) vs <code>processed/*</code> (shorter)` | High |
| 9620 | `at a monitoring fee of $0.0025/1,000 objects.` | Missing "per month" and the fact that objects < 128 KB aren't monitored or tiered | `at a monitoring fee of $0.0025 per 1,000 objects per month (objects under 128 KB are not monitored and stay in the frequent tier).` | High |
| 9623 | `($0.0004/1,000 PUT, $0.0004/1,000 GET for Standard)` | PUT/COPY/POST/LIST are $0.005 per 1,000 (12.5x the stated figure); GET is $0.0004 per 1,000 | `($0.005/1,000 PUT/COPY/POST/LIST, $0.0004/1,000 GET for Standard, us-east-1)` | High |
| 9631 | `WLM assigns queries to queues with CPU and memory limits.` | Manual WLM allocates concurrency slots and memory %, not CPU; auto WLM uses query priority | `WLM routes queries (by user group or query group) to queues with concurrency slots and memory shares; automatic WLM sizes these dynamically and uses query priorities.` | High |
| 9631 | `Configure: short-query queue (timeout 30s, auto-wlm)` | Short Query Acceleration is a separate feature, not a queue with a timeout | `Configure: Short Query Acceleration for sub-second/short queries` | High |
| 9631 | `Enable automatic WLM for Redshift to predict query duration and assign queues automatically.` | Auto WLM doesn't assign queues; SQA predicts runtime; queue routing is rule-based. Also Serverless has no WLM (it uses RPU base capacity + limits) | `Prefer automatic WLM with query priorities and query monitoring rules (abort/log runaway queries); on Redshift Serverless, control cost with base RPUs and usage limits instead.` | High |
| 9642 | `Cost saving: shuffle of a 10 TB fact table costs $X; broadcasting a 10 MB dimension costs near zero.` | Placeholder "$X" left in | delete the sentence, or: `Broadcasting a 10 MB dimension avoids shuffling the 10 TB fact side entirely.` | High |
| 9642 | `Always prefer broadcast for dimension tables in a star schema join.` | Trap: multi-GB dimensions (customer, SKU) OOM the driver/executors or hit broadcast timeouts; the hard 8 GB limit is not a target | `Broadcast small dimensions; for multi-GB dimensions a shuffle/sort-merge join (or bucketing) is safer than blowing driver memory — see <a href="#part-04">Part 4</a>.` | High |
| 9651 | `Enforce via AWS Tag Policies / Azure Policy / GCP Organization Policy.` | AWS Tag Policies standardise tag values but don't block untagged resources by themselves (you need SCPs with `aws:RequestTag` conditions). Warehouse/DBU spend is attributed with platform tags, not cloud tags | `Standardise with AWS Tag Policies, block untagged creates with SCP <code>aws:RequestTag</code> conditions / Azure Policy deny; attribute platform spend with Snowflake <code>QUERY_TAG</code> + object tags and Databricks <code>custom_tags</code> in <code>system.billing.usage</code>.` | Medium-High |
| 9657 | `Reserved instances (1 or 3 year) save 30–60%` | AWS quotes up to ~72% | `Reserved instances / Savings Plans (1 or 3 year) save roughly 30–70% depending on term and payment` | Medium |
| 9667 | `Staff-level interviews increasingly focus on reliability engineering for data` | The handbook targets Senior/L5 | `Senior (L5) interviews increasingly probe reliability engineering for data` | Medium |
| 9672 | `Great Expectations (GX) is the most widely deployed open-source data validation framework.` | Unverifiable superlative (dbt tests likely run on more tables); no version stated | `Great Expectations (GX Core 1.x since Aug 2024 — the 0.x API still in many codebases is incompatible) is a widely used open-source validation framework; dbt tests and Soda Core are the common alternatives.` | Medium |
| 9676 | `<li><strong>Expectation</strong>: a falsifiable assertion about data. <code>expect_column_values_to_not_be_null("user_id")</code>` | 0.x validator-method style | `<li><strong>Expectation</strong>: a falsifiable assertion about data. <code>gx.expectations.ExpectColumnValuesToNotBeNull(column="user_id")</code>` (and convert the other two to `ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=130)` and `ExpectTableRowCountToBeBetween(min_value=10000, max_value=50000000)`) | High |
| 9678 | `<li><strong>Checkpoint</strong>: a configured run of a suite against a Batch Request (a data source + query).` | GX 1.x: Checkpoint runs **Validation Definitions** (Batch Definition + Suite) and triggers Actions; Batch Requests / data connectors are 0.x | `<li><strong>Validation Definition / Checkpoint</strong> (GX 1.x): a Validation Definition pairs a Batch Definition with a Suite; a Checkpoint runs one or more of them and fires Actions (Slack, Data Docs).` | High |
| 9683–9703 | `results = context.run_checkpoint(` (whole block) | GX 0.x only: `run_checkpoint`, `data_connector_name`, `batch_spec_passthrough` (a CSV header option on a table!), `results["success"]`. **None of this runs on GX ≥1.0** | Replace the entire `<pre><code>…</code></pre>` with the GX 1.x block below | High |
| 9705 | `run GX checkpoints as the first step of the silver layer job.` | Validates the wrong thing. Validate the silver *output* before it is published (write-audit-publish); validate bronze input only for contract checks | `run validation on the silver <em>output</em> before publishing it — write to a staging branch/table (Iceberg branch, Delta staging table), validate, then publish (Write-Audit-Publish).` | High |
| 9717 | `<td>Distribution shift</td><td>Detect silent schema changes in numeric cols</td>` | KL divergence detects distribution drift, not schema changes | `<td>Distribution shift vs a reference</td><td>Detect drift (e.g. a unit change cents→dollars, a new default value)</td>` | High |
| 9739 | `<tr><td>re_data (open source)</td><td>Open source</td><td>dbt-native, profiles data in dbt runs, GitHub Actions friendly</td></tr>` | re_data is effectively unmaintained; recommending it in 2026 is a red flag | `<tr><td>Soda Core / platform-native (Snowflake Data Metric Functions, Databricks Lakehouse Monitoring)</td><td>Open source / built-in</td><td>Checks-as-code; native options avoid another vendor but lock you to the platform (edition gates apply)</td></tr>` | Medium-High |
| 9779 | `Streaming events will be available in silver within 5 minutes of ingestion.` | Measure from event time (or source commit), not ingestion; otherwise upstream lag is invisible | `Streaming events will be available in silver within 5 minutes (p99) of event time.` | Medium |
| 9794 | `<td>MD5(concat all columns) per row; compare sets</td>` | Naive: `CONCAT` returns NULL if any input is NULL (Snowflake, Postgres `||`), there are no delimiters (`'ab'+'c'` = `'a'+'bc'`), and types aren't normalised (float, timestamp tz, decimal scale) | `<td>Hash of delimited, NULL-coalesced, type-normalised columns per key (e.g. <code>MD5(CONCAT_WS('\|', COALESCE(CAST(c1 AS VARCHAR),'∅'), …))</code>); compare per-partition aggregates first, then drill to keys</td>` | High |
| 9830 | `dbt schema tests and Great Expectations are the practical implementation for data pipelines.` | Misses the actual contract mechanism: dbt model contracts (1.5+, `contract: {enforced: true}`), which fail the build on schema drift; "schema tests" is the pre-1.0 term | `dbt model contracts (<code>contract: {enforced: true}</code>, dbt 1.5+) enforce shape at build time; data tests (dbt, GX, Soda) enforce values. See <a href="#part-01">Part 1 §13</a> for contract design.` | High |
| 9876 | `Target: on-call engineer spends less than 10% of on-call week on toil` | Arbitrary figure presented as a standard (Google SRE's guidance is &lt;50% toil overall) | `Track toil explicitly and drive it down (Google SRE caps toil at 50% of an engineer's time; good data teams aim far lower)` | Medium |

**GX 1.x replacement block for 9683–9703** (raw HTML; no entities needed):
```
<pre><code># Great Expectations Core 1.x (API changed in 1.0, Aug 2024; 0.x run_checkpoint no longer exists)
import great_expectations as gx

context = gx.get_context()   # file-backed if a gx/ project dir exists, else ephemeral

ds = context.data_sources.add_spark(name="spark")
asset = ds.add_dataframe_asset(name="silver_fact_playback")
batch_def = asset.add_batch_definition_whole_dataframe("daily_partition")

suite = context.suites.add(gx.ExpectationSuite(name="fact_playback"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="user_id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeBetween(
    column="watch_ms", min_value=0, max_value=86_400_000))

vd = context.validation_definitions.add(
    gx.ValidationDefinition(name="fact_playback_vd", data=batch_def, suite=suite))
checkpoint = context.checkpoints.add(gx.Checkpoint(
    name="silver_fact_playback_checkpoint", validation_definitions=[vd],
    actions=[gx.checkpoint.UpdateDataDocsAction(name="update_docs")]))

df = spark.table("staging.fact_playback").where("dt = date_sub(current_date(), 1)")
result = checkpoint.run(batch_parameters={"dataframe": df})

if not result.success:   # block publish (WAP): don't swap staging into silver
    raise ValueError("Data quality validation failed — see Data Docs")</code></pre>
```
(Verify against the current GX docs before shipping. The `.add()` calls raise if the object already exists, so in production load existing objects with `context.checkpoints.get(...)`.)

**SQL block fixes (9746–9769), Medium-High:** (a) `WHERE dt >= CURRENT_DATE - 14 … d.dt = CURRENT_DATE` compares a *partial* today against complete days, so it false-alarms every morning. Evaluate `CURRENT_DATE - 1`. (b) `std_count` is computed but never used. Use `ABS(row_count - avg)/NULLIF(std,0) > 3`, or a same-weekday baseline for weekly seasonality. (c) The freshness query only sees tables that logged at least once. Drive it from an `expected_tables` registry with a `LEFT JOIN`, and alert on NULL. (d) Alias reuse in `HAVING minutes_stale` and `WHERE … pct_deviation` works on Snowflake but not on Postgres or BigQuery. Label the block "Snowflake".

**dbt YAML (9833–9853), Medium-High:** `tests:` → `data_tests:` (dbt 1.8+; the old key is still accepted). Under dbt 1.10+, generic-test arguments should be nested under `arguments:` (deprecation warning otherwise, verify). `dbt_expectations` from calogica is no longer maintained; the maintained fork is `metaplane/dbt_expectations` (verify). Add `config: {contract: {enforced: true}}` with column `data_type`s to show a real contract.
# Version research

## Summary table

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

---

## 1. Python

**Versions**
- **Latest stable: 3.14.7.**
  - https://www.python.org/downloads/release/python-3147/
  - https://docs.python.org/3/whatsnew/3.14.html
- **3.14.0 released 2025-10-07.**
  - https://www.python.org/downloads/release/python-3140/
  - https://blog.python.org/2025/10/python-3140-final-is-here/
  - https://peps.python.org/pep-0745/
- **3.15** is at rc2. PEP 790 schedules the final release for **2026-10-01**, one week after today.
  - https://blog.python.org/2026/09/python-3150-rc2/
  - https://peps.python.org/pep-0790/

**End of life**
- **3.9 reached EOL on 2025-10-31.** 3.9.25 was the final release.
  - https://www.python.org/downloads/release/python-3925/
  - https://devguide.python.org/versions/
- **3.10** takes security fixes only (source-only) until **October 2026**, so it ends in about one month.
  - https://devguide.python.org/versions/
  - https://peps.python.org/pep-0619/
- The exact current status of 3.11, 3.12 and 3.13 was not confirmed from the search summaries. **UNVERIFIED.** Normal policy suggests 3.13 is bugfix and 3.11/3.12 are security-only, but I did not confirm this.

**Free-threaded build (PEP 703 / PEP 779)**
- In 3.13 the free-threaded build was experimental and enabled with `--disable-gil`.
  - https://docs.python.org/3.13/howto/free-threading-python.html
- In 3.14 it is **officially supported but not the default**. This is Phase II. PEP 779 was accepted in June 2025.
  - https://peps.python.org/pep-0779/
  - https://docs.python.org/3/howto/free-threading-python.html
- The single-threaded slowdown is now about 5–10%.
  - https://docs.python.org/3/whatsnew/3.14.html
- Phase III (making free-threading the default) has **not** happened. For 3.15 the work was stable-ABI preparation (PEP 803, "abi3t").
  - https://peps.python.org/pep-0703/
  - https://peps.python.org/pep-0803/

**Changes a 2024 handbook would miss**
1. Annotations are evaluated lazily by default in 3.14 (PEP 649/749), and there is a new `annotationlib` module. Code that reads `__annotations__` eagerly behaves differently.
   - https://docs.python.org/3/library/annotationlib.html
2. Template strings (t-strings, PEP 750) arrived in 3.14.
   - https://docs.python.org/3/whatsnew/3.14.html
3. Multiple interpreters are now in the stdlib as `concurrent.interpreters`.
   - https://docs.python.org/3/library/concurrent.interpreters.html
4. 3.13 added a new colour REPL and an experimental JIT, off by default and enabled with `PYTHON_JIT=1`.
   - https://docs.python.org/3/whatsnew/3.13.html

## 2. Apache Spark

**Versions**
- **Latest: 4.2.0**, published to PyPI on 2026-07-14. It is the third release of the 4.x line.
  - https://spark.apache.org/releases/spark-release-4-2-0.html
  - https://spark.apache.org/news/spark-4-2-0-released.html
- Earlier 4.x releases (PyPI dates):
  - 4.1.0 on 2025-12-16: https://spark.apache.org/releases/spark-release-4.1.0.html
  - 4.0.0 on 2025-05-23: https://spark.apache.org/releases/spark-release-4-0-0.html

**Maintained lines**
- Patch releases were published in July 2026 for **4.2.0, 4.1.3, 4.0.4 and 3.5.9** (PyPI).
- **3.5.x is on an "extended" LTS that ends November 2027.** During this period it receives security fixes only.
  - https://spark.apache.org/versioning-policy.html
  - https://spark.apache.org/releases/spark-release-3-5-9.html

**Changes a 2024 handbook would miss**
1. **ANSI mode is on by default since 4.0** (`spark.sql.ansi.enabled=true`). Invalid casts and arithmetic overflow now raise errors instead of returning NULL.
   - https://spark.apache.org/docs/latest/sql-ref-ansi-compliance.html
   - https://spark.apache.org/docs/latest/sql-migration-guide.html
2. **4.0 dropped JDK 8/11 and Scala 2.12.** It runs on Java 17/21 with Scala 2.13.
   - https://spark.apache.org/releases/spark-release-4-0-0.html
3. **4.0 added the VARIANT type,** plus SQL UDFs, session variables, pipe syntax and collations. Spark Connect gained full Java-client API compatibility and a `spark.api.mode` switch.
   - https://spark.apache.org/releases/spark-release-4-0-0.html
4. **4.1 added Spark Declarative Pipelines** (the open-sourced DLT) and **Real-Time Mode** for Structured Streaming (sub-second latency).
   - https://spark.apache.org/releases/spark-release-4.1.0.html
   - https://spark.apache.org/docs/latest/declarative-pipelines-programming-guide.html
5. **4.2 added:**
   - GEOMETRY and GEOGRAPHY types
   - a SQL `CHANGES` clause for CDC reads
   - Auto CDC (SCD1) in declarative pipelines
   - Arrow-optimized Python UDFs, now on by default
   - https://spark.apache.org/releases/spark-release-4-2-0.html

## 3. Apache Flink

**Versions**
- **Latest: 2.3.0**, published to PyPI on 2026-06-21 and announced on 2026-06-25.
  - https://flink.apache.org/2026/06/25/apache-flink-2.3.0-release-announcement/
- Earlier .0 releases (PyPI dates): 2.2.0 on 2025-12-03, 2.1.0 on 2025-07-29, 2.0.0 on 2025-03-19.
  - https://flink.apache.org/2025/03/24/apache-flink-2.0.0-a-new-era-of-real-time-data-processing/

**Maintained lines**
- Recent patch releases:
  - 2.2.1 (May 2026): https://flink.apache.org/2026/05/15/apache-flink-2.2.1-release-announcement/
  - 2.1.3 (June 2026): https://flink.apache.org/2026/06/14/apache-flink-2.1.3-release-announcement/
  - 2.0.2 (May 2026): https://flink.apache.org/2026/05/11/apache-flink-2.0.2-release-announcement/
- **1.20 is the LTS for the 1.x line** (FLIP-458): bug and security fixes only, for two years. The latest patch is 1.20.5 (June 2026).
  - https://flink.apache.org/documentation/flink-lts/
  - https://cwiki.apache.org/confluence/display/FLINK/FLIP-458:+Long-Term+Support+for+the+Final+Release+of+Apache+Flink+1.x+Line
- An exact end date for the 1.20 LTS was not found. **UNVERIFIED.**

**Changes a 2024 handbook would miss**
1. **Removed in 2.0:**
   - the DataSet API (use DataStream or Table/SQL)
   - the Scala DataStream and DataSet APIs
   - SourceFunction, SinkFunction and SinkV1 (use Source/Sink V2)

   Connectors that still depend on the old interfaces do not work on 2.x.
   - https://nightlies.apache.org/flink/flink-docs-stable/release-notes/flink-2.0/
2. **Java 8 dropped.** The minimum is Java 11 and the default and recommended version is Java 17.
   - https://nightlies.apache.org/flink/flink-docs-stable/release-notes/flink-2.0/
3. **Disaggregated state management (2.0):** the ForSt backend uses remote storage (for example, S3) as primary state storage, with an asynchronous execution model.
   - https://nightlies.apache.org/flink/flink-docs-master/docs/ops/state/disaggregated_state/
4. **2.3 additions:**
   - `FROM_CHANGELOG` and `TO_CHANGELOG` SQL operators
   - materialized tables with full DDL
   - an experimental native S3 filesystem on AWS SDK v2
   - https://flink.apache.org/2026/06/25/apache-flink-2.3.0-release-announcement/

## 4. Apache Kafka

**Versions**
- **Latest: 4.3.1**, announced 2026-06-25.
  - https://kafka.apache.org/blog/2026/06/25/apache-kafka-4.3.1-release-announcement/
- Earlier releases:
  - 4.3.0, 2026-05-22 (25 KIPs): https://kafka.apache.org/blog/2026/05/22/apache-kafka-4.3.0-release-announcement/
  - 4.2.0, 2026-02-17: https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/
  - 4.1.0, 2025-09-04: https://kafka.apache.org/blog/2025/09/04/apache-kafka-4.1.0-release-announcement/
  - 4.0.0, 2025-03-18: https://kafka.apache.org/blog/2025/03/18/apache-kafka-4.0.0-release-announcement/
- Maven Central lists kafka-clients 4.2.1 (2026-05-12) and 4.3.1.

**Support policy:** the formal supported-lines / EOL policy was not confirmed. **UNVERIFIED.**

**Changes a 2024 handbook would miss**
1. **ZooKeeper is gone in 4.0.** Clusters run in KRaft mode only.
   - https://kafka.apache.org/blog/2025/03/18/apache-kafka-4.0.0-release-announcement/
2. **KIP-848 consumer rebalance protocol went GA in 4.0.**
   - It removes stop-the-world rebalances and moves assignment to the broker.
   - It is on by default on the server, but clients must opt in with `group.protocol=consumer`.
   - The Streams version (KIP-1071) was early access in 4.1 and is now production-ready for its core feature set.
   - https://kafka.apache.org/43/operations/consumer-rebalance-protocol/
   - https://kafka.apache.org/43/streams/developer-guide/streams-rebalance-protocol/
3. **Queues for Kafka (KIP-932, share groups):**
   - early access in 4.0, preview in 4.1, **production-ready in 4.2**
   - consumers process the same partitions cooperatively, with per-record acknowledgement and delivery counts
   - 4.3 adds more share-group configs (KIP-1240)
   - https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/
4. **Transactions v2 (KIP-890 phase 2):**
   - the producer epoch is bumped on every transaction, which defends against zombie and hanging transactions
   - controlled by the `transaction.version=2` feature flag, with 4.0+ clients
   - https://kafka.apache.org/40/operations/transaction-protocol/
5. **Java baselines in 4.0:** clients and Streams need Java 11+; brokers, Connect and tools need Java 17.
   - https://kafka.apache.org/40/getting-started/upgrade/

## 5. Apache Iceberg

**Versions**
- **Latest Java release: 1.11.0.**
  - https://iceberg.apache.org/blog/apache-iceberg-1.11.0-release/
  - https://iceberg.apache.org/releases/
  - The Maven metadata `lastUpdated` value is 2026-05-19, so the release was **about mid/late May 2026**. The exact announcement date is **UNVERIFIED**.
- 1.10.0 was released on 2025-09-11 (confirmed by the Maven `Last-Modified` header and the releases page). 1.10.2 followed on 2026-05-18.
- PyIceberg is at 0.12.0 (PyPI 2026-09-01).
  - https://iceberg.apache.org/blog/apache-iceberg-python-0.12.0-release/

**Format spec v3**
- The spec page defines the v3 features below. The search did not confirm whether v3 is formally "ratified/final" or which release first made writing v3 the default. **UNVERIFIED.**
- Snowflake calls Iceberg v3 support GA (May 2026), which is indirect evidence that the spec is stable.
- **v3 features** (https://iceberg.apache.org/spec/):
  - **Deletion vectors:** binary DVs (Puffin) replace v2 position-delete files, with at most one DV per data file.
  - **Row lineage:** `_row_id` and `_last_updated_sequence_number`.
  - **Default values:** `initial-default` and `write-default`.
  - **New types:** variant, nanosecond timestamp(tz), unknown, geometry and geography.
- **1.11.0 adds** geospatial bounding-box types with an INTERSECTS predicate, plus REST spec additions.
  - https://iceberg.apache.org/blog/apache-iceberg-1.11.0-release/
- Engine artifacts are split: `iceberg-spark-3.5_2.12` and `iceberg-spark-4.0_2.13`.
  - https://iceberg.apache.org/multi-engine-support/

## 6. Delta Lake

**Versions**
- **Latest: 4.4.0** (delta-spark on PyPI, 2026-08-20). It defaults to Spark 4.2 and adds:
  - identity and generated columns in DDL
  - UC metric views
  - Delta Flink on the UC Delta API

  Sources:
  - https://delta.io/blog/2026-08-20-simplifying-your-open-lakehouse-with-the-delta-kernel-and-the-uc-delta-apis/
  - https://github.com/delta-io/delta/releases
- Earlier releases (PyPI dates):
  - 4.3.0 on 2026-06-18: https://delta.io/blog/2026-06-22-delta-4-3-release/
  - 4.2.0 on 2026-04-10: https://delta.io/blog/2026-04-17-delta-4-2-released/
  - 4.1.0 on 2026-02-20: https://delta.io/blog/2026-03-01-delta-lake-4-1-0-released/
  - 4.0.0 on 2025-06-06: https://github.com/delta-io/delta/releases/tag/v4.0.0
- **3.3.x (Spark 3.5) is still patched:** 3.3.3 on 2026-08-12. A formal support policy was not found. **UNVERIFIED.**

**Changes a 2024 handbook would miss**
1. **4.0 targets Spark 4.0** and adds:
   - the Variant type
   - type widening (now GA)
   - Coordinated Commits (preview)
   - **catalog-managed tables (preview):** the catalog brokers every commit
   - https://github.com/delta-io/delta/releases/tag/v4.0.0
2. **Catalog-managed commits have since grown through the UC Delta API** (Unity Catalog OSS 0.5) in 4.3 and 4.4.
   - https://delta.io/blog/2026-06-22-delta-4-3-release/
3. **Liquid clustering has been GA since 3.2.** It replaces partitioning and Z-order.
   - https://delta.io/blog/delta-lake-3-2/
   - https://docs.delta.io/latest/delta-clustering.html
4. **Deletion vectors and UniForm:** older UniForm did not work with deletion vectors. The experimental IcebergCompatV3 allows the two together.
   - https://docs.delta.io/delta-uniform/

## 7. Snowflake (notable GA features)

- **Iceberg tables GA: 2024-06-10.**
  - https://docs.snowflake.com/en/release-notes/2024/other/2024-06-10-iceberg-tables
- **Other Iceberg GAs:**
  - Open Catalog GA, 2024-10-18: https://docs.snowflake.com/en/release-notes/2024/other/2024-10-18-snowflake-open-catalog-ga
  - External-engine writes and catalog-linked databases, 2025-10-17: https://docs.snowflake.com/en/release-notes/2025/other/2025-10-17-iceberg-external-writes-cld-ga
  - **Iceberg v3 support, 2026-05-07:** https://docs.snowflake.com/en/release-notes/2026/other/2026-05-07-iceberg-v3-ga
  - Snowflake storage for Iceberg, 2026-06-01: https://docs.snowflake.com/en/release-notes/2026/other/2026-06-01-iceberg-snowflake-storage-ga
- **Hybrid tables (Unistore) GA on AWS: 2024-10-30.** Azure followed on 2025-10-06.
  - https://docs.snowflake.com/en/release-notes/2024/other/2024-10-30-hybrid-tables-ga
  - https://docs.snowflake.com/en/release-notes/2025/other/2025-10-06-hybrid-tables-azure-ga
- **Gen2 standard warehouses GA: 2025-05-05.** Gen2 is the default for new standard warehouses under BCR 2026_03.
  - https://docs.snowflake.com/en/release-notes/2025/other/2025-05-05-gen2-standard-warehouses
  - https://docs.snowflake.com/en/release-notes/bcr-bundles/2026_03/bcr-2250
- **Dynamic Tables GA: 2024-04-29.** 2026 additions include:
  - SCHEDULER attribute
  - ADAPTIVE refresh mode (2026-07-30)
  - custom incremental (2026-07-27)
  - DML into frozen regions
  - https://docs.snowflake.com/en/release-notes/2024/other/2024-04-29-dynamic-tables
  - https://docs.snowflake.com/en/release-notes/2026/other/2026-07-30-dynamic-tables-adaptive-refresh-mode-ga
- **Snowpark:** the library is mature and has release notes for 2022–2026. Its original GA date was not confirmed from the search. **UNVERIFIED.**
  - https://docs.snowflake.com/en/release-notes/clients-drivers/snowpark-python

## 8. BigQuery

- **Editions replaced flat-rate pricing.** From 2023-07-05, new flat-rate and flex commitments could not be purchased. The editions are Standard, Enterprise and Enterprise Plus, with slot autoscaling.
  - https://cloud.google.com/blog/products/data-analytics/introducing-new-bigquery-pricing-editions
  - https://docs.cloud.google.com/bigquery/docs/editions-intro
  - https://cloud.google.com/bigquery/docs/reservations-details-legacy
- **Iceberg managed tables are GA.** They were formerly "BigLake tables for Apache Iceberg in BigQuery".
  - https://docs.cloud.google.com/bigquery/docs/biglake-iceberg-tables-in-bigquery
  - https://cloud.google.com/blog/products/data-analytics/biglake-support-for-building-apache-iceberg-lakehouses-is-now-ga
- **History-based optimizations are GA.**
  - https://cloud.google.com/bigquery/docs/history-based-optimizations
  - https://docs.cloud.google.com/bigquery/docs/release-notes
- **Continuous queries are still Pre-GA overall.** Some parts are GA: export to Spanner, and APPENDS inside a continuous query. Do not call the whole feature GA.
  - https://docs.cloud.google.com/bigquery/docs/continuous-queries-introduction
  - https://docs.cloud.google.com/bigquery/docs/release-notes

## 9. Databricks

- **Naming:** DLT is now **"Lakeflow Spark Declarative Pipelines"**. The docs page is titled "What happened to Delta Live Tables (DLT)?". The core framework was donated to Apache Spark 4.1 as SDP. Existing DLT code keeps working.
  - https://docs.databricks.com/aws/en/ldp/concepts/where-is-dlt
  - https://docs.databricks.com/aws/en/ldp/
  - The interim name "Lakeflow Declarative Pipelines" is out of date.
- **Predictive optimization:**
  - on by default for accounts created on or after 2024-11-11
  - rollout to existing accounts expected to finish by August 2026
  - runs OPTIMIZE, VACUUM and ANALYZE on UC managed Delta **and Iceberg** tables
  - https://docs.databricks.com/aws/en/optimizations/predictive-optimization
- **Serverless compute** for notebooks, jobs and pipelines is GA. It is the default compute for new jobs, and Photon and autoscaling are on automatically.
  - https://docs.databricks.com/aws/en/compute/serverless/
  - https://docs.databricks.com/aws/en/jobs/run-serverless-jobs
  - https://docs.databricks.com/aws/en/release-notes/serverless/
- **Unity Catalog:**
  - managed tables are the default and recommended type for both Delta and Iceberg
  - "catalog commits" are documented
  - https://docs.databricks.com/aws/en/tables/managed
  - https://docs.databricks.com/gcp/en/tables/features/catalog-commits
  - https://docs.databricks.com/aws/en/iceberg/

## 10. PostgreSQL

**Versions**
- **Latest GA major: 18.** The latest minor is 18.6, released alongside 17.11, 16.15, 15.19, 14.24 and 19 Beta 3.
  - https://www.postgresql.org/about/news/postgresql-18-released-3142/
  - https://www.postgresql.org/about/news/postgresql-186-1711-1615-1519-1424-and-19-beta-3-released-3365/
- **PostgreSQL 19 is not released.** Beta 4 came out on 2026-09-24, and the RC is expected in early October.
  - https://www.postgresql.org/about/news/postgresql-19-beta-4-released-3386/
  - Headline 19 features: SQL/PGQ property graphs, REPACK CONCURRENTLY, and logical replication of sequences.
  - https://www.postgresql.org/docs/19/release-19.html

**Supported lines**
- **14–18** are supported. **13 is EOL.** **14 ends on 2026-11-12.** Each major is supported for 5 years.
  - https://www.postgresql.org/support/versioning/

**Changes a 2024 handbook would miss**
1. **PG18 async I/O subsystem:** up to 3x faster for sequential scans, bitmap heap scans and vacuum.
   - https://www.postgresql.org/docs/release/18.0/
2. **PG18 `uuidv7()`,** which generates timestamp-ordered UUIDs.
   - https://www.postgresql.org/docs/release/18.0/
3. **PG18 virtual generated columns,** now the default kind of generated column.
   - https://www.postgresql.org/docs/current/ddl-generated-columns.html
4. **PG18 OAuth 2.0 authentication.**
   - https://www.postgresql.org/docs/release/18.0/
5. **PG17:**
   - failover-enabled logical replication slots (`failover` argument, `sync_replication_slots`)
   - incremental backup (`pg_basebackup --incremental` with `pg_combinebackup`)
   - `JSON_TABLE`
   - `MERGE … RETURNING`
   - https://www.postgresql.org/about/news/postgresql-17-released-2936/
   - https://www.postgresql.org/docs/17/logical-replication-failover.html

## 11. dbt

**The big news: dbt v2 shipped in September 2026**
- PyPI packages `dbt` and `dbt-oss` published 2.0.0 on **2026-09-14**. `dbt` is now at 2.0.6.
- **Renames:** the Fusion engine is now called **"dbt"**. **dbt Core v2**, the Apache-2.0 Rust implementation that lives in the dbt-core repo, is now **"dbt OSS"**.
  - https://docs.getdbt.com/blog/dbt-core-v2-is-here
  - https://docs.getdbt.com/blog/comparing-dbt-and-dbt-oss
- **What v2 changes:**
  - adapters use ADBC; dbt is a single binary with no Python runtime
  - SQL is statically analysed (a logical plan is built for every query)
  - built-in `dbt lint`
  - all deprecations become errors, including `--models`/`-m` and orphaned Jinja blocks
  - https://docs.getdbt.com/docs/dbt-versions/core-upgrade/upgrading-to-v2
  - https://docs.getdbt.com/reference/deprecations

**1.x line**
- dbt-core **1.12.5** (PyPI 2026-09-15). 1.12.0 came out on 2026-07-16 and added:
  - an opt-in `--use-v2-parser` (Rust parser, 5–10x faster)
  - private packages
  - a reworked `catalogs.yml`
  - https://docs.getdbt.com/docs/dbt-versions/core-upgrade/upgrading-to-v1.12
- 1.11.0 came out on 2025-12-19 and 1.10.0 on 2025-06-16.
- Patches continue on the 1.12, 1.11 and older 1.x lines.
- On the dbt platform, v1.3–v1.7 are deprecated on 2027-01-31.
  - https://docs.getdbt.com/docs/dbt-versions

**Feature history (corrects a common misconception)**
- **Model contracts came in 1.5, not 1.8.** 1.5 introduced contracts, model versions and access.
  - https://docs.getdbt.com/docs/dbt-versions/dbt-upgrade/Older%20versions/upgrading-to-v1.5
- **Unit tests:** native support in **1.8**.
  - https://docs.getdbt.com/docs/dbt-versions/dbt-upgrade/upgrading-to-v1.8
- **Microbatch incremental strategy: 1.9.** It uses `event_time`, `batch_size` and `lookback`, retries per batch, and runs batches in parallel.
  - https://docs.getdbt.com/docs/build/incremental-microbatch
- **state:modified / `--defer`:** unchanged in concept. Whether their v2 semantics changed was not researched in depth. **UNVERIFIED.**

## 12. Apache Airflow

**Versions**
- **Latest: 3.3.2** (PyPI 2026-09-17). Task SDK 1.3.2 was released the same day.
  - https://airflow.apache.org/docs/apache-airflow/stable/release_notes.html
- 3.3.0 came out on 2026-07-06. It added stateful tasks, multi-language tasks, and more asset partitioning.
  - The multi-language tasks run Java or Go through coordinators.
  - The state stores are `task_state_store` and `asset_state_store`.
  - The partition mappers include FanOutMapper.
  - https://airflow.apache.org/blog/airflow-3.3.0/
- Other .0 releases: 3.2.0 on 2026-04-07, 3.1.0 on 2025-09-25, 3.0.0 on 2025-04-22.
  - https://airflow.apache.org/blog/airflow-three-point-oh-is-here/

**Airflow 2 end of life**
- Limited maintenance from 2025-10-22, then **EOL on 2026-04-22**. The last release was 2.11.2 on 2026-03-14.
- These dates come from third-party sources (for example, https://www.astronomer.io/airflow-2-eol/).
- The official page lists them (https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html), but the search summary did not show the table. Treat the date as **not officially confirmed**.

**Changes a 2024 handbook would miss**
1. **Datasets are now Assets,** with an `@asset` decorator. Asset partitioning arrived in 3.2 and grew in 3.3.
   - https://airflow.apache.org/docs/apache-airflow/3.0.0/release_notes.html
2. **DAG versioning (AIP-66):** historical DAG structure is kept in the metadata database and shown in the UI and API.
   - https://airflow.apache.org/blog/airflow-three-point-oh-is-here/
3. **Task SDK and Task Execution API (AIP-72):**
   - DAGs import from the `airflow.sdk` namespace
   - workers talk to a new `airflow api-server` and no longer access the metadata database directly
   - https://airflow.apache.org/blog/airflow-three-point-oh-is-here/
4. **Breaking changes in 3.0:**
   - `execution_date` removed (use `logical_date`, which can be None for manually or asset-triggered runs)
   - SubDAGs removed
   - default schedule is None
   - `catchup_by_default=False`
   - https://airflow.apache.org/docs/apache-airflow/stable/installation/upgrading_to_airflow3.html

## 13. Great Expectations

- **Latest: GX Core 1.23.1** (PyPI 2026-09-18). GX Core 1.0.0 was released on 2024-08-22.
  - https://greatexpectations.io/blog/introducing-gx-core-1-0/
- **0.18 and earlier sunset on 2025-10-01.**
  - https://greatexpectations.io/blog/retiring-gx-0-18/

**1.x vs the legacy API**
- Block-config data sources were removed. Only Fluent data sources remain.
- Config version 3.0 became 4.0, with new `validation_definition_store` and `validation_results_store` stores.
- A **Validation Definition** binds a Batch Definition to an Expectation Suite. Checkpoints run lists of Validation Definitions and replace the old `validations` list.
- Expectations are typed classes, for example `gx.expectations.ExpectColumnValuesToNotBeNull(...)`.
- The API follows `context.<resource>.<method>`, for example `context.suites.add(...)`.
- Sources:
  - https://greatexpectations.io/blog/changes-to-know-for-gx-core-1-0/
  - https://docs.greatexpectations.io/docs/0.18/reference/learn/migration_guide/
  - https://docs.greatexpectations.io/docs/core/introduction/gx_overview/

## 14. Debezium

**Versions**
- **Latest: 3.6.3.Final** (2026-09-18).
  - https://debezium.io/blog/2026/09/18/debezium-3-6-3-final-released/
- 3.6.0.Final came out on 2026-07-01.
  - https://debezium.io/blog/2026/07/01/debezium-3-6-final-release/
- **3.7.0.CR1** was published to Maven on 2026-09-22, so 3.7 Final is imminent.
- Earlier finals:
  - 3.5.0, 2026-03-31: https://debezium.io/blog/2026/03/31/debezium-3-5-final-released/
  - 3.4.0, 2025-12-16: https://debezium.io/blog/2025/12/16/debezium-3-4-final-released/
  - 3.3.0, 2025-10-01: https://debezium.io/blog/2025/10/01/debezium-3-3-final-released/
  - 3.0.0, 2024-10-02: https://debezium.io/blog/2024/10/02/debezium-3-0-final-released/
- Which older lines are still maintained: **UNVERIFIED.**
  - https://debezium.io/releases/

**Changes a 2024 handbook would miss**
1. **3.0 baselines:** connectors need a **Java 17** runtime; Server, Operator and the Quarkus Outbox extension need Java 21. 3.0 built against Kafka 3.8.
   - https://debezium.io/releases/3.0/release-notes
2. **Later 3.x releases built and tested against Kafka 4.1.x.**
   - https://debezium.io/blog/2025/10/01/debezium-3-3-final-released/
3. **3.5 added parallel snapshotting of a single table** (chunked, multi-threaded).
   - https://debezium.io/blog/2026/03/31/debezium-3-5-final-released/
4. **3.x added:**
   - the Debezium Platform UI and management layer, with a monitoring REST API in 3.6
   - the Debezium Quarkus extension
   - OpenLineage integration
   - https://debezium.io/blog/2026/07/01/debezium-3-6-final-release/
