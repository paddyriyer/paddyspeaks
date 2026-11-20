-- A metric is a definition with an owner, not a column name. The catalogue is
-- data, so the dashboard can render the definition instead of a tooltip that
-- says "Revenue".
CREATE TABLE metric_definition (
    metric_key     TEXT PRIMARY KEY,
    display_name   TEXT NOT NULL UNIQUE,     -- never just "Revenue"
    purpose        TEXT NOT NULL,            -- the decision it is for
    owner_team     TEXT NOT NULL,
    owner_role     TEXT NOT NULL,            -- a role that answers questions, not a team alias
    time_basis     TEXT NOT NULL,            -- which timestamp decides the month
    time_zone      TEXT NOT NULL,
    includes       TEXT[] NOT NULL,
    excludes       TEXT[] NOT NULL,
    version        INT  NOT NULL,
    approved_by    TEXT NOT NULL,
    approved_on    DATE NOT NULL
);

-- What "Data Verified" was hiding: which checks, on which period, passed when.
CREATE TABLE metric_check (
    metric_key   TEXT        NOT NULL REFERENCES metric_definition,
    period       TEXT        NOT NULL,       -- '2026-10'
    check_name   TEXT        NOT NULL,
    passed       BOOLEAN     NOT NULL,
    detail       TEXT        NOT NULL,
    checked_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (metric_key, period, check_name)
);

INSERT INTO metric_definition VALUES
('gross_order_value', 'Gross Order Value',
 'Demand and conversion: how much customers tried to buy, and when',
 'Product Analytics', 'Product analytics lead', 'order placed', 'UTC',
 ARRAY['sales tax','test orders','orders later refunded'],
 ARRAY['nothing'], 1, 'VP Product', '2025-03-01'),
('recognized_revenue', 'Recognized Revenue',
 'Financial reporting, forecasts and the board: revenue earned in the period',
 'Finance', 'Revenue accounting manager', 'order fulfilled', 'America/New_York',
 ARRAY['fulfilled real orders','refunds netted in the month issued'],
 ARRAY['sales tax','test orders','orders not yet fulfilled'], 3, 'Controller', '2026-01-15');

INSERT INTO metric_check VALUES
('recognized_revenue', '2026-10', 'ties to general ledger',      true,  'difference 0.00',               '2026-11-04 09:00-05'),
('recognized_revenue', '2026-10', 'period closed',               true,  'October closed by the Controller','2026-11-04 09:00-05'),
('recognized_revenue', '2026-10', 'source row counts reconcile', true,  '3,200 orders, 182 refunds',     '2026-11-04 08:40-05'),
('gross_order_value',  '2026-10', 'pipeline ran on schedule',    true,  'loaded 2026-11-01 06:02 UTC',   '2026-11-01 06:02+00'),
('gross_order_value',  '2026-10', 'source row counts reconcile', true,  '3,200 orders',                  '2026-11-01 06:02+00'),
('gross_order_value',  '2026-10', 'test orders excluded',        false, 'not applied: 40 test orders included', '2026-11-01 06:02+00');
