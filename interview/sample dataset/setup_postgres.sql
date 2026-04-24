-- ============================================================
-- Data Engineer Interview Primer — PostgreSQL FULL SETUP
-- ============================================================
-- Usage:
--   1. Place all CSV files in a directory (e.g., /tmp/interview_datasets/)
--   2. Update the path variable below
--   3. Run:  psql -d your_db -f setup_postgres.sql
--
-- Or from psql:  \i setup_postgres.sql
-- ============================================================

-- *** UPDATE THIS PATH to where your CSV files are ***
-- (Used in the \copy commands below)

-- ============================================================
-- DROP TABLES (if re-running)
-- ============================================================
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

-- ============================================================
-- CREATE TABLES
-- ============================================================

-- #1 Anti-Join, Cohort Retention
CREATE TABLE users (
    user_id     INT PRIMARY KEY,
    name        VARCHAR(50),
    email       VARCHAR(100),
    signup_date DATE,
    country     VARCHAR(5)
);

-- #1 Anti-Join
CREATE TABLE purchases (
    purchase_id      INT PRIMARY KEY,
    user_id          INT REFERENCES users(user_id),
    amount           DECIMAL(10,2),
    purchase_date    DATE,
    product_category VARCHAR(30)
);

-- #2 ROW_NUMBER Dedup (intentional duplicates)
CREATE TABLE user_profiles (
    user_id    INT,
    name       VARCHAR(50),
    city       VARCHAR(30),
    updated_at DATE
);

-- #3 WoW Growth
CREATE TABLE weekly_metrics (
    week_start DATE PRIMARY KEY,
    wau        INT
);

-- #4 CASE Pivot
CREATE TABLE sessions (
    session_id   INT PRIMARY KEY,
    user_id      INT,
    platform     VARCHAR(10),
    session_date DATE,
    duration_sec INT
);

-- #5 Top-N Per Group
CREATE TABLE products (
    product_id   INT PRIMARY KEY,
    product_name VARCHAR(30),
    category     VARCHAR(30),
    revenue      INT
);

-- #6 Sessionization
CREATE TABLE clickstream (
    user_id    INT,
    event_time TIMESTAMP,
    page       VARCHAR(20)
);

-- #7 Funnel Analysis
CREATE TABLE events (
    event_id   INT PRIMARY KEY,
    user_id    INT,
    event_type VARCHAR(20),
    event_date DATE
);

-- #8 Consecutive Streaks
CREATE TABLE logins (
    user_id    INT,
    login_date DATE
);

-- #9 Running Total, #14 Moving Average
CREATE TABLE daily_metrics (
    ds            DATE PRIMARY KEY,
    daily_revenue DECIMAL(12,2),
    daily_dau     INT
);

-- #13 Date Spine (has 15 dates removed)
CREATE TABLE daily_metrics_gapped (
    ds            DATE PRIMARY KEY,
    daily_revenue DECIMAL(12,2),
    daily_dau     INT
);

-- #11 Self-Join, #15 Recursive CTE
CREATE TABLE employees (
    employee_id INT PRIMARY KEY,
    full_name   VARCHAR(50),
    manager_id  INT REFERENCES employees(employee_id),
    department  VARCHAR(30),
    salary      INT
);

-- #12 Cumulative Distribution, #17 Correlated Subquery
CREATE TABLE orders (
    order_id   INT PRIMARY KEY,
    user_id    INT,
    order_date DATE,
    amount     DECIMAL(10,2)
);

-- #19 SCD Type 2
CREATE TABLE product_dim (
    product_id     INT,
    product_name   VARCHAR(30),
    price          DECIMAL(10,2),
    effective_date DATE,
    expiry_date    DATE,
    is_current     CHAR(1)
);

-- #18 Data Skew Detection
CREATE TABLE skewed_table (
    id        INT PRIMARY KEY,
    join_key  VARCHAR(20),
    value     INT
);

-- ============================================================
-- LOAD DATA — Option A: \copy (run from psql client)
-- Update the path prefix to your CSV directory
-- ============================================================
\copy users FROM '/path/to/interview_datasets/users.csv' WITH (FORMAT csv, HEADER true);
\copy purchases FROM '/path/to/interview_datasets/purchases.csv' WITH (FORMAT csv, HEADER true);
\copy user_profiles FROM '/path/to/interview_datasets/user_profiles.csv' WITH (FORMAT csv, HEADER true);
\copy weekly_metrics FROM '/path/to/interview_datasets/weekly_metrics.csv' WITH (FORMAT csv, HEADER true);
\copy sessions FROM '/path/to/interview_datasets/sessions.csv' WITH (FORMAT csv, HEADER true);
\copy products FROM '/path/to/interview_datasets/products.csv' WITH (FORMAT csv, HEADER true);
\copy clickstream FROM '/path/to/interview_datasets/clickstream.csv' WITH (FORMAT csv, HEADER true);
\copy events FROM '/path/to/interview_datasets/events.csv' WITH (FORMAT csv, HEADER true);
\copy logins FROM '/path/to/interview_datasets/logins.csv' WITH (FORMAT csv, HEADER true);
\copy daily_metrics FROM '/path/to/interview_datasets/daily_metrics.csv' WITH (FORMAT csv, HEADER true);
\copy daily_metrics_gapped FROM '/path/to/interview_datasets/daily_metrics_gapped.csv' WITH (FORMAT csv, HEADER true);
\copy employees FROM '/path/to/interview_datasets/employees.csv' WITH (FORMAT csv, HEADER true);
\copy orders FROM '/path/to/interview_datasets/orders.csv' WITH (FORMAT csv, HEADER true);
\copy product_dim FROM '/path/to/interview_datasets/product_dim.csv' WITH (FORMAT csv, HEADER true);
\copy skewed_table FROM '/path/to/interview_datasets/skewed_table.csv' WITH (FORMAT csv, HEADER true);

-- ============================================================
-- LOAD DATA — Option B: COPY (run as superuser in SQL)
-- ============================================================
/*
COPY users FROM '/path/to/interview_datasets/users.csv' WITH (FORMAT csv, HEADER true);
COPY purchases FROM '/path/to/interview_datasets/purchases.csv' WITH (FORMAT csv, HEADER true);
COPY user_profiles FROM '/path/to/interview_datasets/user_profiles.csv' WITH (FORMAT csv, HEADER true);
COPY weekly_metrics FROM '/path/to/interview_datasets/weekly_metrics.csv' WITH (FORMAT csv, HEADER true);
COPY sessions FROM '/path/to/interview_datasets/sessions.csv' WITH (FORMAT csv, HEADER true);
COPY products FROM '/path/to/interview_datasets/products.csv' WITH (FORMAT csv, HEADER true);
COPY clickstream FROM '/path/to/interview_datasets/clickstream.csv' WITH (FORMAT csv, HEADER true);
COPY events FROM '/path/to/interview_datasets/events.csv' WITH (FORMAT csv, HEADER true);
COPY logins FROM '/path/to/interview_datasets/logins.csv' WITH (FORMAT csv, HEADER true);
COPY daily_metrics FROM '/path/to/interview_datasets/daily_metrics.csv' WITH (FORMAT csv, HEADER true);
COPY daily_metrics_gapped FROM '/path/to/interview_datasets/daily_metrics_gapped.csv' WITH (FORMAT csv, HEADER true);
COPY employees FROM '/path/to/interview_datasets/employees.csv' WITH (FORMAT csv, HEADER true);
COPY orders FROM '/path/to/interview_datasets/orders.csv' WITH (FORMAT csv, HEADER true);
COPY product_dim FROM '/path/to/interview_datasets/product_dim.csv' WITH (FORMAT csv, HEADER true);
COPY skewed_table FROM '/path/to/interview_datasets/skewed_table.csv' WITH (FORMAT csv, HEADER true);
*/

-- ============================================================
-- VERIFY COUNTS
-- ============================================================
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
UNION ALL SELECT 'skewed_table', COUNT(*) FROM skewed_table;

-- ============================================================
-- 🎉 DONE! You're ready to practice all 20 SQL examples.
-- ============================================================
