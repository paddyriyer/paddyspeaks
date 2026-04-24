-- ============================================================
-- Data Engineer Interview Primer — MySQL FULL SETUP
-- ============================================================
-- Usage:
--   1. Place all CSV files in a directory
--   2. Update paths in LOAD DATA commands below
--   3. Run:  mysql -u root -p --local-infile=1 < setup_mysql.sql
--
-- NOTE: You may need to enable local_infile:
--   SET GLOBAL local_infile = 1;
-- ============================================================

CREATE DATABASE IF NOT EXISTS interview_prep;
USE interview_prep;

-- ============================================================
-- DROP TABLES (if re-running)
-- ============================================================
DROP TABLE IF EXISTS skewed_table;
DROP TABLE IF EXISTS product_dim;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS daily_metrics_gapped;
DROP TABLE IF EXISTS daily_metrics;
DROP TABLE IF EXISTS logins;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS clickstream;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS weekly_metrics;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS users;

-- ============================================================
-- CREATE TABLES
-- ============================================================

CREATE TABLE users (
    user_id     INT PRIMARY KEY,
    name        VARCHAR(50),
    email       VARCHAR(100),
    signup_date DATE,
    country     VARCHAR(5)
);

CREATE TABLE purchases (
    purchase_id      INT PRIMARY KEY,
    user_id          INT,
    amount           DECIMAL(10,2),
    purchase_date    DATE,
    product_category VARCHAR(30),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
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
    event_time DATETIME,
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
    manager_id  INT,
    department  VARCHAR(30),
    salary      INT,
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
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

-- ============================================================
-- LOAD DATA — Update '/path/to/' to your CSV directory
-- ============================================================
LOAD DATA LOCAL INFILE '/path/to/interview_datasets/users.csv'
INTO TABLE users
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/purchases.csv'
INTO TABLE purchases
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/user_profiles.csv'
INTO TABLE user_profiles
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/weekly_metrics.csv'
INTO TABLE weekly_metrics
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/sessions.csv'
INTO TABLE sessions
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/products.csv'
INTO TABLE products
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/clickstream.csv'
INTO TABLE clickstream
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/events.csv'
INTO TABLE events
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/logins.csv'
INTO TABLE logins
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/daily_metrics.csv'
INTO TABLE daily_metrics
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/daily_metrics_gapped.csv'
INTO TABLE daily_metrics_gapped
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;


LOAD DATA LOCAL INFILE '/path/to/interview_datasets/employees.csv'
INTO TABLE employees
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(employee_id, full_name, @manager_id, department, salary)
SET manager_id = NULLIF(@manager_id, '');

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/orders.csv'
INTO TABLE orders
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;


LOAD DATA LOCAL INFILE '/path/to/interview_datasets/product_dim.csv'
INTO TABLE product_dim
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(product_id, product_name, price, effective_date, @expiry_date, is_current)
SET expiry_date = NULLIF(@expiry_date, '');

LOAD DATA LOCAL INFILE '/path/to/interview_datasets/skewed_table.csv'
INTO TABLE skewed_table
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

-- ============================================================
-- VERIFY COUNTS
-- ============================================================
SELECT 'users' AS tbl, COUNT(*) AS cnt FROM users
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
