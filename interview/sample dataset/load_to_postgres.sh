#!/usr/bin/env bash
# Load all interview sample-dataset CSVs into the target Postgres DB.
#
# Usage:
#   ./load_to_postgres.sh "postgres://user:pass@host:port/db?sslmode=require"
#
# If no URL is supplied, falls back to $DATABASE_URL.
# Run from any machine that has network access to the target host
# (Aiven services typically restrict inbound to "Allowed IP addresses").

set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: pass a Postgres connection URL as arg 1, or set DATABASE_URL." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==> Creating schema"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS weekly_metrics CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS clickstream CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS logins CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS daily_metrics_gapped CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_dim CASCADE;
DROP TABLE IF EXISTS skewed_table CASCADE;

CREATE TABLE users (
    user_id     INT PRIMARY KEY,
    name        VARCHAR(50),
    email       VARCHAR(100),
    signup_date DATE,
    country     VARCHAR(5)
);

-- NOTE: Several tables ship with intentional dirty data for SQL-practice
-- exercises (dedup, anti-join, etc.), so the schema below is relaxed
-- relative to setup_postgres.sql:
--   - purchases.purchase_id: PK dropped  (dup at id=6)
--   - purchases.user_id:     FK dropped  (orphans 99001, 99002 not in users)
--   - products.product_id:   PK dropped  (dup at id=1)
--   - daily_metrics.ds:      PK dropped  (dup at 2025-01-11)
--   - orders.order_id:       PK dropped  (dup at id=11)
CREATE TABLE purchases (
    purchase_id      INT,
    user_id          INT,
    amount           DECIMAL(10,2),
    purchase_date    DATE,
    product_category VARCHAR(30)
);

CREATE TABLE user_profiles (
    user_id    INT,
    name       VARCHAR(50),
    city       VARCHAR(30),
    updated_at DATE
);

CREATE TABLE weekly_metrics (
    week_start DATE PRIMARY KEY,
    wau        INT
);

CREATE TABLE sessions (
    session_id   INT PRIMARY KEY,
    user_id      INT,
    platform     VARCHAR(10),
    session_date DATE,
    duration_sec INT
);

CREATE TABLE products (
    product_id   INT,
    product_name VARCHAR(30),
    category     VARCHAR(30),
    revenue      INT
);

CREATE TABLE clickstream (
    user_id    INT,
    event_time TIMESTAMP,
    page       VARCHAR(20)
);

CREATE TABLE events (
    event_id   INT PRIMARY KEY,
    user_id    INT,
    event_type VARCHAR(20),
    event_date DATE
);

CREATE TABLE logins (
    user_id    INT,
    login_date DATE
);

CREATE TABLE daily_metrics (
    ds            DATE,
    daily_revenue DECIMAL(12,2),
    daily_dau     INT
);

CREATE TABLE daily_metrics_gapped (
    ds            DATE PRIMARY KEY,
    daily_revenue DECIMAL(12,2),
    daily_dau     INT
);

CREATE TABLE employees (
    employee_id INT PRIMARY KEY,
    full_name   VARCHAR(50),
    manager_id  INT REFERENCES employees(employee_id),
    department  VARCHAR(30),
    salary      INT
);

CREATE TABLE orders (
    order_id   INT,
    user_id    INT,
    order_date DATE,
    amount     DECIMAL(10,2)
);

CREATE TABLE product_dim (
    product_id     INT,
    product_name   VARCHAR(30),
    price          DECIMAL(10,2),
    effective_date DATE,
    expiry_date    DATE,
    is_current     CHAR(1)
);

CREATE TABLE skewed_table (
    id        INT PRIMARY KEY,
    join_key  VARCHAR(20),
    value     INT
);
SQL

echo "==> Pre-processing CSVs (clean known data-quality issues)"
# The source CSVs have two issues that break \copy against the schema:
#   1. The literal token "<NULL>" appears in users.country (1 row). It is
#      6 chars and overflows VARCHAR(5); it should be SQL NULL.
#   2. Several INT-typed columns are stored as floats with a ".0" suffix
#      (e.g. employees.salary "250000.0", sessions.duration_sec "388.0",
#      products.revenue "435.0", employees.manager_id "100.0"). Postgres
#      INT rejects "250000.0".
# We fix both by writing cleaned copies into a temp dir and \copy'ing from
# there. With cleaned files, default CSV null handling (unquoted empty
# field -> NULL) works for every other empty INT/DATE/DECIMAL field.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Generic transform: strip the literal "<NULL>" token everywhere.
for f in users.csv purchases.csv user_profiles.csv weekly_metrics.csv \
         sessions.csv products.csv clickstream.csv events.csv logins.csv \
         daily_metrics.csv daily_metrics_gapped.csv employees.csv \
         orders.csv product_dim.csv skewed_table.csv; do
  sed 's/<NULL>//g' "$f" > "$STAGE/$f"
done

# Per-file transforms: strip ".0" suffix on INT-typed columns.
# (CSVs contain no quoted fields, so awk -F, is safe.)
awk 'BEGIN{FS=OFS=","} NR==1{print;next} {sub(/\.0$/,"",$3); sub(/\.0$/,"",$5); print}' \
    "$STAGE/employees.csv" > "$STAGE/employees.csv.tmp" && mv "$STAGE/employees.csv.tmp" "$STAGE/employees.csv"
awk 'BEGIN{FS=OFS=","} NR==1{print;next} {sub(/\.0$/,"",$5); print}' \
    "$STAGE/sessions.csv"  > "$STAGE/sessions.csv.tmp"  && mv "$STAGE/sessions.csv.tmp"  "$STAGE/sessions.csv"
awk 'BEGIN{FS=OFS=","} NR==1{print;next} {sub(/\.0$/,"",$4); print}' \
    "$STAGE/products.csv"  > "$STAGE/products.csv.tmp"  && mv "$STAGE/products.csv.tmp"  "$STAGE/products.csv"

echo "==> Loading CSVs (parents before children for FK)"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
\copy users              FROM '$STAGE/users.csv'              WITH (FORMAT csv, HEADER true);
\copy purchases          FROM '$STAGE/purchases.csv'          WITH (FORMAT csv, HEADER true);
\copy user_profiles      FROM '$STAGE/user_profiles.csv'      WITH (FORMAT csv, HEADER true);
\copy weekly_metrics     FROM '$STAGE/weekly_metrics.csv'     WITH (FORMAT csv, HEADER true);
\copy sessions           FROM '$STAGE/sessions.csv'           WITH (FORMAT csv, HEADER true);
\copy products           FROM '$STAGE/products.csv'           WITH (FORMAT csv, HEADER true);
\copy clickstream        FROM '$STAGE/clickstream.csv'        WITH (FORMAT csv, HEADER true);
\copy events             FROM '$STAGE/events.csv'             WITH (FORMAT csv, HEADER true);
\copy logins             FROM '$STAGE/logins.csv'             WITH (FORMAT csv, HEADER true);
\copy daily_metrics      FROM '$STAGE/daily_metrics.csv'      WITH (FORMAT csv, HEADER true);
\copy daily_metrics_gapped FROM '$STAGE/daily_metrics_gapped.csv' WITH (FORMAT csv, HEADER true);
\copy employees          FROM '$STAGE/employees.csv'          WITH (FORMAT csv, HEADER true);
\copy orders             FROM '$STAGE/orders.csv'             WITH (FORMAT csv, HEADER true);
\copy product_dim        FROM '$STAGE/product_dim.csv'        WITH (FORMAT csv, HEADER true);
\copy skewed_table       FROM '$STAGE/skewed_table.csv'       WITH (FORMAT csv, HEADER true);
SQL

echo "==> Row counts"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'weekly_metrics', COUNT(*) FROM weekly_metrics
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'clickstream', COUNT(*) FROM clickstream
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'logins', COUNT(*) FROM logins
UNION ALL SELECT 'daily_metrics', COUNT(*) FROM daily_metrics
UNION ALL SELECT 'daily_metrics_gapped', COUNT(*) FROM daily_metrics_gapped
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'product_dim', COUNT(*) FROM product_dim
UNION ALL SELECT 'skewed_table', COUNT(*) FROM skewed_table
ORDER BY tbl;
SQL

echo "==> Done."
