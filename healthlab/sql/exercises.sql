-- Round 3 exercises for /interview.app/design/the-health-intelligence-problem.html.
-- Run by healthlab/sql/verify.sh after schema.sql; the outputs shown on the page are
-- copied from that run, never typed.
SET search_path = hip;
SET client_min_messages = warning;

-- ---------------------------------------------------------------- seed (synthetic)
INSERT INTO subject VALUES ('00000000-0000-0000-0000-00000000000a', now(), true, 'us', NULL);
INSERT INTO data_source VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a',
  'apple_health_export', 'Apple Health export', '2026-01-01', NULL);
INSERT INTO import_batch VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
  '2026-11-15 16:00Z', NULL, 0, 0, 0, 'apple-xml-1.3');

-- 180 days of resting heart rate: 62 → 58 bpm, every third day missing in the earlier half
INSERT INTO observation (obs_id, subject_id, code, loinc, value, unit, orig_value, orig_unit, observed_at,
                         utc_offset, local_date, kind, source_id, batch_id)
SELECT md5('rhr' || d::text), '00000000-0000-0000-0000-00000000000a', 'resting_hr', '40443-4',
       CASE WHEN d < date '2026-08-18' THEN 62 ELSE 58 END + (extract(day FROM d)::int % 3) - 1,
       '/min', '60', 'count/min', d + time '07:00' - interval '-8 hours', interval '-8 hours', d,
       'measured', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1'
FROM generate_series(date '2026-05-20', date '2026-11-15', interval '1 day') AS g(d)
WHERE NOT (d < date '2026-08-18' AND extract(doy FROM d)::int % 3 = 0);

-- ---------------------------------------------------------------- E1 · idempotent re-import
-- The same export arrives again, plus 2 genuinely new readings. Load only what is new.
CREATE TEMP TABLE staging AS
SELECT obs_id, subject_id, code, loinc, value, unit, orig_value, orig_unit, observed_at,
       utc_offset, local_date, kind, source_id, batch_id
FROM observation WHERE local_date >= date '2026-11-10';
INSERT INTO staging SELECT md5('rhr-new' || n), '00000000-0000-0000-0000-00000000000a', 'resting_hr', '40443-4',
  57, '/min', '57', 'count/min', timestamptz '2026-11-16 15:00Z' + n * interval '1 day', interval '-8 hours',
  date '2026-11-16' + n, 'measured', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1'
FROM generate_series(0, 1) AS n;

\echo '-- E1 result'
WITH ins AS (
  INSERT INTO observation (obs_id, subject_id, code, loinc, value, unit, orig_value, orig_unit, observed_at,
                           utc_offset, local_date, kind, source_id, batch_id)
  SELECT * FROM staging
  ON CONFLICT (subject_id, obs_id, observed_at) DO NOTHING
  RETURNING 1
)
SELECT (SELECT count(*) FROM staging) AS received,
       (SELECT count(*) FROM ins)     AS inserted,
       (SELECT count(*) FROM staging) - (SELECT count(*) FROM ins) AS duplicates;

-- ---------------------------------------------------------------- E2 · 90 days against the 90 before
-- Median, coverage and a status that refuses to judge thin data.
\echo '-- E2 result'
WITH params AS (SELECT date '2026-11-15' AS as_of, 90 AS w, 3.0 AS threshold),
daily AS (
  SELECT local_date, avg(value) AS v
  FROM observation, params
  WHERE subject_id = '00000000-0000-0000-0000-00000000000a' AND code = 'resting_hr'
    AND local_date > as_of - 2 * w AND local_date <= as_of
  GROUP BY local_date
),
periods AS (
  SELECT CASE WHEN local_date > as_of - w THEN 'recent' ELSE 'earlier' END AS period, v
  FROM daily, params
),
stats AS (
  SELECT period, percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS median,
         count(*) AS days, round(count(*)::numeric / (SELECT w FROM params), 2) AS coverage
  FROM periods GROUP BY period
)
SELECT e.median AS earlier_median, r.median AS recent_median, r.median - e.median AS delta,
       e.coverage AS earlier_coverage, r.coverage AS recent_coverage,
       CASE WHEN e.coverage < 0.5 OR r.coverage < 0.5 THEN 'insufficient'
            WHEN abs(r.median - e.median) < (SELECT threshold FROM params) THEN 'stable'
            WHEN r.median < e.median THEN 'improving'          -- lower resting HR is better
            ELSE 'declining' END AS status
FROM stats e, stats r WHERE e.period = 'earlier' AND r.period = 'recent';

-- ---------------------------------------------------------------- E3 · what may this share contain?
-- A grant covers resting HR for 30 days of history, granted Nov 1, revoked Nov 12.
INSERT INTO consent_grant VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
  'org:synthetic-clinic', 'care', ARRAY['resting_hr'], 30,
  tstzrange('2026-11-01 00:00Z', '2026-12-01 00:00Z'), '2026-11-12 09:00Z');

\echo '-- E3 result'
SELECT s.share_at,
       (g.valid @> s.share_at AND (g.revoked_at IS NULL OR s.share_at < g.revoked_at)) AS allowed,
       count(o.obs_id) AS observations_shareable
FROM consent_grant g
CROSS JOIN (VALUES (timestamptz '2026-11-10 12:00Z'), (timestamptz '2026-11-14 12:00Z')) AS s(share_at)
LEFT JOIN observation o
  ON  g.valid @> s.share_at
  AND (g.revoked_at IS NULL OR s.share_at < g.revoked_at)       -- consent as of the moment of use
  AND o.subject_id = g.subject_id
  AND o.code = ANY (g.scope_codes)
  AND o.observed_at >  s.share_at - make_interval(days => g.period_days)
  AND o.observed_at <= s.share_at
WHERE g.grant_id = '00000000-0000-0000-0000-0000000000c1'
GROUP BY s.share_at, g.valid, g.revoked_at
ORDER BY s.share_at;
