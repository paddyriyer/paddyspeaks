-- Health Intelligence Platform — canonical schema (PostgreSQL 16).
-- Shown on /interview.app/design/the-health-intelligence-problem.html (Round 3).
-- Verified with healthlab/sql/verify.sh against a local PostgreSQL 16.
-- Design rules: every measurement keeps its original value, unit, offset and source;
-- nothing is updated in place (corrections are new revisions); consent is a time window,
-- checked as-of the moment of use; patient-reported facts never become clinical facts.

CREATE SCHEMA IF NOT EXISTS hip;
SET search_path = hip;

CREATE TABLE subject (                      -- a person; demo profiles are flagged synthetic
  subject_id     uuid PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  is_synthetic   boolean NOT NULL DEFAULT false,
  residency      text NOT NULL,             -- data-residency region, e.g. 'us'
  deleted_at     timestamptz                -- deletion request accepted; purge job follows
);

CREATE TABLE data_source (                  -- one connected export, device feed or record API
  source_id      uuid PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subject,
  system         text NOT NULL CHECK (system IN ('apple_health_export','healthkit_app','device_api',
                    'device_csv','fhir_r4','user_entry')),
  display_name   text NOT NULL,
  connected_at   timestamptz NOT NULL,
  revoked_at     timestamptz
);

CREATE TABLE device (
  device_id      uuid PRIMARY KEY,
  source_id      uuid NOT NULL REFERENCES data_source,
  kind           text NOT NULL,             -- watch, phone, cuff, scale, cgm, ring
  model          text,
  regulatory     text NOT NULL DEFAULT 'unknown'
                 CHECK (regulatory IN ('wellness','fda_cleared_function','unknown'))
);

CREATE TABLE import_batch (                 -- every file or sync is a batch: replayable, auditable
  batch_id       uuid PRIMARY KEY,
  source_id      uuid NOT NULL REFERENCES data_source,
  received_at    timestamptz NOT NULL,
  file_sha256    text,
  kept int NOT NULL DEFAULT 0, duplicates int NOT NULL DEFAULT 0,
  rejected int NOT NULL DEFAULT 0, parser_version text NOT NULL
);

-- The fact. Append-only; partitioned by month of observation; hashed lookups by subject.
CREATE TABLE observation (
  obs_id         text NOT NULL,             -- sha1(source system, source type, start, raw value): re-imports collide
  subject_id     uuid NOT NULL,
  code           text NOT NULL,             -- canonical metric code (registry below)
  loinc          text,                      -- only where the mapping is certain
  method         text,                      -- e.g. 'SDNN' vs 'RMSSD' — different methods, different codes
  value          double precision NOT NULL, -- standard unit
  unit           text NOT NULL,             -- UCUM
  orig_value     text NOT NULL,
  orig_unit      text NOT NULL,
  observed_at    timestamptz NOT NULL,      -- the instant (stored UTC)
  utc_offset     interval,                  -- as recorded; NULL for date-only sources
  local_date     date NOT NULL,             -- the day as lived, for daily aggregation
  kind           text NOT NULL CHECK (kind IN ('measured','estimated','device','clinician_verified','patient_reported')),
  source_id      uuid NOT NULL,
  device_id      uuid,
  batch_id       uuid NOT NULL,
  flags          text[] NOT NULL DEFAULT '{}',
  revision       int NOT NULL DEFAULT 1,    -- a correction is a new row with revision+1
  supersedes     text,
  PRIMARY KEY (subject_id, obs_id, observed_at)
) PARTITION BY RANGE (observed_at);
CREATE TABLE observation_2026_11 PARTITION OF observation
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE observation_default PARTITION OF observation DEFAULT;
CREATE INDEX observation_series ON observation (subject_id, code, local_date);

CREATE TABLE workout (
  workout_id     text PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subject,
  activity       text NOT NULL,
  started_at     timestamptz NOT NULL, utc_offset interval, local_date date NOT NULL,
  duration_min   numeric(7,2) NOT NULL, distance_km numeric(8,3), avg_hr numeric(5,1),
  elevation_m    numeric(7,1), effort smallint CHECK (effort BETWEEN 1 AND 10),
  source_id      uuid NOT NULL REFERENCES data_source, batch_id uuid NOT NULL REFERENCES import_batch
);

CREATE TABLE condition_record (             -- from FHIR Condition only; never inferred
  condition_id   uuid PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subject,
  snomed         text, text text NOT NULL,
  clinical_status text NOT NULL, verification text NOT NULL,
  onset          date, source_id uuid NOT NULL REFERENCES data_source
);

CREATE TABLE medication_record (            -- the record says; the person reports — both kept
  med_id         uuid PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subject,
  text           text NOT NULL,
  record_status  text,                      -- from the clinical record
  reported_status text,                     -- from the person; never overwrites record_status
  reported_on    date,
  source_id      uuid NOT NULL REFERENCES data_source
);

CREATE TABLE symptom_entry (
  entry_id       uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  entered_at     timestamptz NOT NULL, text text NOT NULL, severity text,
  urgent_terms   text[] NOT NULL DEFAULT '{}'   -- matched by the rules engine, if any
);

CREATE TABLE health_goal (
  goal_id        uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  goal_type      text NOT NULL, set_by text NOT NULL CHECK (set_by IN ('person','clinician')),
  target         jsonb, started_on date NOT NULL, ended_on date
);

CREATE TABLE reference_dataset (            -- published or illustrative, never confused
  ref_id         text PRIMARY KEY,
  name text NOT NULL, citation text NOT NULL, published date,
  provenance     text NOT NULL CHECK (provenance IN ('published','illustrative_synthetic')),
  measurement_method text NOT NULL          -- e.g. 'laboratory CPX', 'wrist estimate'
);

CREATE TABLE cohort_definition (
  cohort_id      text PRIMARY KEY, ref_id text NOT NULL REFERENCES reference_dataset,
  code           text NOT NULL, age_band int4range NOT NULL, sex_category text,
  condition      text,                      -- requires a confirmed condition_record to use
  n              int NOT NULL, percentiles jsonb NOT NULL
);

CREATE TABLE analytical_finding (           -- every computed statement, with its inputs
  finding_id     uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  kind           text NOT NULL CHECK (kind IN ('descriptive','inference','rule')),
  code           text, window_days int, status text,
  inputs         jsonb NOT NULL,            -- medians, n, coverage, thresholds, rule version
  rule_version   text NOT NULL, computed_at timestamptz NOT NULL
);

CREATE TABLE signal (
  signal_id      uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  tier           text NOT NULL CHECK (tier IN ('observed','context','discuss','urgent')),
  code           text, starts_on date NOT NULL, ends_on date,
  finding_id     uuid REFERENCES analytical_finding,
  acknowledged_at timestamptz
);

CREATE TABLE consent_grant (                -- a window, not a flag
  grant_id       uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  grantee        text NOT NULL,             -- e.g. a clinic's organization id
  purpose        text NOT NULL CHECK (purpose IN ('care','research','program')),
  scope_codes    text[] NOT NULL, period_days int NOT NULL,
  valid          tstzrange NOT NULL,        -- [granted, expires) ; closed early on revoke
  revoked_at     timestamptz
);

CREATE TABLE provider_share (
  share_id       uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES consent_grant,
  created_at     timestamptz NOT NULL, report_id uuid, fhir_bundle_sha256 text,
  delivered_at   timestamptz, reviewed_by_service boolean NOT NULL DEFAULT false   -- false = not monitored
);

CREATE TABLE generated_report (
  report_id      uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subject,
  kind           text NOT NULL, created_at timestamptz NOT NULL,
  finding_ids    uuid[] NOT NULL, text_sha256 text NOT NULL,
  ai_drafted     boolean NOT NULL, grounding_passed boolean NOT NULL
);

CREATE TABLE audit_event (                  -- append-only; who touched what, why, under which grant
  event_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  actor          text NOT NULL, subject_id uuid NOT NULL,
  action         text NOT NULL, object text NOT NULL, grant_id uuid, detail jsonb
);

CREATE TABLE insurance_program (
  program_id     text PRIMARY KEY, model text NOT NULL, sponsor text NOT NULL,
  rules_citation text NOT NULL, data_shared text NOT NULL,  -- program results only, never raw streams
  underwriting_use boolean NOT NULL DEFAULT false CHECK (underwriting_use = false)
);

-- Row-level security: a request carries the subject it acts for; nothing else is visible.
ALTER TABLE observation ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON observation
  USING (subject_id = current_setting('hip.subject_id', true)::uuid);
