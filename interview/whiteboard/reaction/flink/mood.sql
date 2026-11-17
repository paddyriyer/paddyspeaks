-- The live aggregation as one Flink SQL job. NOT EXECUTED for this page:
-- syntax follows the Apache Flink SQL documentation; check it against your
-- Flink version. Input is the edge's voice stream (one row per person per
-- media second, dominant emoji already chosen).
SET 'table.exec.mini-batch.enabled' = 'true';           -- buffer, then update state once
SET 'table.exec.mini-batch.allow-latency' = '250 ms';
SET 'table.exec.mini-batch.size' = '5000';
SET 'table.optimizer.agg-phase-strategy' = 'TWO_PHASE'; -- local pre-aggregate: defuses hot keys
SET 'table.exec.state.ttl' = '3 min';                   -- forget seconds nobody can still reach

CREATE TABLE voice_src (
    session_id   STRING,
    batch_seq    INT,
    match_id     INT,
    region       STRING,
    program_ms   BIGINT,       -- EXT-X-PROGRAM-DATE-TIME of the frame being watched
    emoji        STRING,
    media_sec AS program_ms / 1000,
    pt AS PROCTIME()
) WITH (
    'connector' = 'kafka',
    'topic' = 'reaction-voices',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'mood',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'json'
);

-- An upsert sink: every change to a (second, emoji) count is a new revision.
CREATE TABLE mood_revision (
    match_id   INT,
    region     STRING,
    media_sec  BIGINT,
    emoji      STRING,
    voices     BIGINT,
    PRIMARY KEY (match_id, region, media_sec, emoji) NOT ENFORCED
) WITH (
    'connector' = 'upsert-kafka',
    'topic' = 'mood-revisions',
    'properties.bootstrap.servers' = 'kafka:9092',
    'key.format' = 'json',
    'value.format' = 'json'
);

-- No window and no watermark: a window would hold the result until the
-- slowest viewer arrived. An updating GROUP BY emits as voices arrive, and
-- the state TTL bounds how long a second stays open.
INSERT INTO mood_revision
SELECT match_id, region, media_sec, emoji, COUNT(*) AS voices
FROM (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY session_id, media_sec ORDER BY pt ASC) AS rn
    FROM voice_src
)
WHERE rn = 1                       -- keep-first deduplication: one voice per person-second
GROUP BY match_id, region, media_sec, emoji;
