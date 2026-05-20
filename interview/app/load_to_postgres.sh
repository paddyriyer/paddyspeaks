#!/usr/bin/env bash
# Load the interview/app/ datasets into Postgres.
#
# These 11 tables back the SQL examples in the interview HTML pages
# (Part7_Coding_Round.html, 05-sql-deep-dive.html, 08-interview-qa-scenarios.html)
# that are NOT already covered by interview/sample dataset/load_to_postgres.sh.
#
# Schemas created:
#   dim     -> dim.advertiser, dim.advertiser_rate
#   gold    -> gold.revenue_attributed
#   finance -> finance.ad_revenue_ledger
#   public  -> dim_subscription_history, fact_playback, fact_charges,
#              fact_click, fact_conversion, fact_daily_active, invoices
#
# Usage:
#   ./load_to_postgres.sh "postgres://user:pass@host:port/db?sslmode=require"
# Or set DATABASE_URL.

set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: pass a Postgres connection URL as arg 1, or set DATABASE_URL." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==> Creating schemas and tables (drop + create)"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS dim;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS finance;

DROP TABLE IF EXISTS dim.advertiser              CASCADE;
DROP TABLE IF EXISTS dim.advertiser_rate         CASCADE;
DROP TABLE IF EXISTS dim_subscription_history    CASCADE;
DROP TABLE IF EXISTS fact_playback               CASCADE;
DROP TABLE IF EXISTS fact_charges                CASCADE;
DROP TABLE IF EXISTS fact_click                  CASCADE;
DROP TABLE IF EXISTS fact_conversion             CASCADE;
DROP TABLE IF EXISTS fact_daily_active           CASCADE;
DROP TABLE IF EXISTS gold.revenue_attributed     CASCADE;
DROP TABLE IF EXISTS finance.ad_revenue_ledger   CASCADE;
DROP TABLE IF EXISTS invoices                    CASCADE;

-- Dimension: small static lookup of advertisers (anti-join demos)
CREATE TABLE dim.advertiser (
    advertiser_id INT PRIMARY KEY,
    name          VARCHAR(50) NOT NULL,
    is_active     BOOLEAN     NOT NULL
);

-- Dimension SCD Type 2: take rate history per advertiser
CREATE TABLE dim.advertiser_rate (
    advertiser_id  INT          NOT NULL,
    rate_pct       NUMERIC(6,4) NOT NULL,
    effective_from TIMESTAMP    NOT NULL,
    effective_to   TIMESTAMP             -- NULL => current row
);

-- Dimension SCD Type 2: subscription plan history per user (as-of join target)
CREATE TABLE dim_subscription_history (
    user_id     INT          NOT NULL,
    valid_from  TIMESTAMP    NOT NULL,
    valid_to    TIMESTAMP,               -- NULL => current row
    plan_name   VARCHAR(20)  NOT NULL,
    plan_price  NUMERIC(8,2) NOT NULL
);

-- Fact: video playback events (as-of join probe side)
CREATE TABLE fact_playback (
    user_id  INT       NOT NULL,
    event_ts TIMESTAMP NOT NULL
);

-- Fact: subscription / billing charges (running totals, window functions)
CREATE TABLE fact_charges (
    user_id  INT          NOT NULL,
    event_ts TIMESTAMP    NOT NULL,
    amount   NUMERIC(10,2) NOT NULL
);

-- Fact: ad clicks (last-click attribution input)
CREATE TABLE fact_click (
    user_id     INT       NOT NULL,
    campaign_id INT       NOT NULL,
    click_ts    TIMESTAMP NOT NULL
);

-- Fact: conversions (last-click attribution target)
CREATE TABLE fact_conversion (
    user_id        INT          NOT NULL,
    conversion_ts  TIMESTAMP    NOT NULL,
    conversion_usd NUMERIC(10,2) NOT NULL
);

-- Fact: daily active flags (growth-accounting / cohort drills)
CREATE TABLE fact_daily_active (
    user_id     INT  NOT NULL,
    active_date DATE NOT NULL
);

-- Fact (append-only, bi-temporal): attribution credits with supersession
-- is_superseded=true => row was later corrected; consume only latest per conversion_id
CREATE TABLE gold.revenue_attributed (
    conversion_id        INT          NOT NULL,
    event_time           TIMESTAMP    NOT NULL,
    attribution_time     TIMESTAMP    NOT NULL,
    attributed_campaign  INT          NOT NULL,
    credited_usd         NUMERIC(10,2) NOT NULL,
    is_superseded        BOOLEAN      NOT NULL
);

-- Ledger: monthly finance rollup (reconciliation drill)
CREATE TABLE finance.ad_revenue_ledger (
    month                              DATE          PRIMARY KEY,
    invoiced_usd                       NUMERIC(14,2) NOT NULL,
    refunds_usd                        NUMERIC(14,2) NOT NULL,
    ivt_credits_usd                    NUMERIC(14,2) NOT NULL,
    partner_attribution_adjustment_usd NUMERIC(14,2) NOT NULL
);

-- Gap detection: sequential invoice numbers with intentional gaps (102, 105, 109, 111, 114)
CREATE TABLE invoices (
    invoice_num INT PRIMARY KEY
);
SQL

echo "==> Loading CSVs"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
\copy dim.advertiser              FROM 'dim_advertiser.csv'              WITH (FORMAT csv, HEADER true);
\copy dim.advertiser_rate         FROM 'dim_advertiser_rate.csv'         WITH (FORMAT csv, HEADER true);
\copy dim_subscription_history    FROM 'dim_subscription_history.csv'    WITH (FORMAT csv, HEADER true);
\copy fact_playback               FROM 'fact_playback.csv'               WITH (FORMAT csv, HEADER true);
\copy fact_charges                FROM 'fact_charges.csv'                WITH (FORMAT csv, HEADER true);
\copy fact_click                  FROM 'fact_click.csv'                  WITH (FORMAT csv, HEADER true);
\copy fact_conversion             FROM 'fact_conversion.csv'             WITH (FORMAT csv, HEADER true);
\copy fact_daily_active           FROM 'fact_daily_active.csv'           WITH (FORMAT csv, HEADER true);
\copy gold.revenue_attributed     FROM 'gold_revenue_attributed.csv'     WITH (FORMAT csv, HEADER true);
\copy finance.ad_revenue_ledger   FROM 'finance_ad_revenue_ledger.csv'   WITH (FORMAT csv, HEADER true);
\copy invoices                    FROM 'invoices.csv'                    WITH (FORMAT csv, HEADER true);
SQL

echo "==> Row counts"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'dim.advertiser'                      AS tbl, COUNT(*) FROM dim.advertiser
UNION ALL SELECT 'dim.advertiser_rate',              COUNT(*) FROM dim.advertiser_rate
UNION ALL SELECT 'dim_subscription_history',         COUNT(*) FROM dim_subscription_history
UNION ALL SELECT 'fact_playback',                    COUNT(*) FROM fact_playback
UNION ALL SELECT 'fact_charges',                     COUNT(*) FROM fact_charges
UNION ALL SELECT 'fact_click',                       COUNT(*) FROM fact_click
UNION ALL SELECT 'fact_conversion',                  COUNT(*) FROM fact_conversion
UNION ALL SELECT 'fact_daily_active',                COUNT(*) FROM fact_daily_active
UNION ALL SELECT 'gold.revenue_attributed',          COUNT(*) FROM gold.revenue_attributed
UNION ALL SELECT 'finance.ad_revenue_ledger',        COUNT(*) FROM finance.ad_revenue_ledger
UNION ALL SELECT 'invoices',                         COUNT(*) FROM invoices
ORDER BY tbl;
SQL

echo "==> Done."
