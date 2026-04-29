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

CREATE TABLE purchases (
    purchase_id      INT PRIMARY KEY,
    user_id          INT REFERENCES users(user_id),
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
    product_id   INT PRIMARY KEY,
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
    ds            DATE PRIMARY KEY,
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
    order_id   INT PRIMARY KEY,
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

echo "==> Loading CSVs (parents before children for FK)"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
-- NULL '<NULL>' translates the literal token "<NULL>" in the CSVs (e.g. users.country)
-- into a SQL NULL, so columns like country VARCHAR(5) don't overflow.
\copy users              FROM 'users.csv'              WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy purchases          FROM 'purchases.csv'          WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy user_profiles      FROM 'user_profiles.csv'      WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy weekly_metrics     FROM 'weekly_metrics.csv'     WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy sessions           FROM 'sessions.csv'           WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy products           FROM 'products.csv'           WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy clickstream        FROM 'clickstream.csv'        WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy events             FROM 'events.csv'             WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy logins             FROM 'logins.csv'             WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy daily_metrics      FROM 'daily_metrics.csv'      WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy daily_metrics_gapped FROM 'daily_metrics_gapped.csv' WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy employees          FROM 'employees.csv'          WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy orders             FROM 'orders.csv'             WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy product_dim        FROM 'product_dim.csv'        WITH (FORMAT csv, HEADER true, NULL '<NULL>');
\copy skewed_table       FROM 'skewed_table.csv'       WITH (FORMAT csv, HEADER true, NULL '<NULL>');
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
