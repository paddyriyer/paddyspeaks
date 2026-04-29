-- ============================================================
-- Why "NOT IN (subquery)" is dangerous and LEFT JOIN ... IS NULL is safe
-- ============================================================
-- Run after load_to_postgres.sh has populated the schema:
--   psql "$DATABASE_URL" -f demo_anti_join_null_gotcha.sql
--
-- The two queries below are intended to compute the same thing —
-- "users who never made a purchase" — but they differ when the
-- right-hand side contains even a single NULL.
--
-- WHY:
--   x NOT IN (a, b, NULL) is rewritten as x<>a AND x<>b AND x<>NULL.
--   x<>NULL is UNKNOWN (three-valued logic), which makes the whole
--   AND chain UNKNOWN, so NO ROW satisfies the WHERE — the query
--   silently returns 0 rows. LEFT JOIN ... IS NULL has no such trap.
-- ============================================================

\echo
\echo '=== Step 1: baseline — purchases.user_id has NO NULLs ==='
\echo 'Both queries should agree.'
SELECT 'DANGEROUS  (NOT IN)        baseline' AS query, COUNT(*) AS rows
FROM users WHERE user_id NOT IN (SELECT user_id FROM purchases);

SELECT 'SAFE       (LEFT JOIN)     baseline' AS query, COUNT(*) AS rows
FROM users u
LEFT JOIN purchases p ON p.user_id = u.user_id
WHERE p.purchase_id IS NULL;

\echo
\echo '=== Step 2: inject ONE NULL user_id into purchases ==='
INSERT INTO purchases (purchase_id, user_id, amount, purchase_date, product_category)
VALUES (999999, NULL, 0, '2025-01-01', 'null-demo');

\echo
\echo '=== Step 3: re-run both queries ==='
\echo 'DANGEROUS now silently returns 0; SAFE still returns the real anti-join count.'
SELECT 'DANGEROUS  (NOT IN)        after NULL inject' AS query, COUNT(*) AS rows
FROM users WHERE user_id NOT IN (SELECT user_id FROM purchases);

SELECT 'SAFE       (LEFT JOIN)     after NULL inject' AS query, COUNT(*) AS rows
FROM users u
LEFT JOIN purchases p ON p.user_id = u.user_id
WHERE p.purchase_id IS NULL;

\echo
\echo '=== Step 4: clean up the injected row ==='
DELETE FROM purchases WHERE purchase_id = 999999;

\echo
\echo '=== Takeaway ==='
\echo 'NOT IN is unsafe whenever the subquery column is nullable. Prefer'
\echo 'LEFT JOIN ... IS NULL, or NOT EXISTS, both of which are NULL-safe.'
