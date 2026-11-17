-- The green dashboard that lies. Customer 1's order was charged twice (the
-- app minted a NEW key on retry), customer 2's charge never happened. The
-- day's totals agree to the paisa; reconciliation is row by row, or it is
-- not reconciliation.
WITH expected AS (
    SELECT order_id, customer_id, amount_minor FROM orders WHERE order_date = DATE '2026-11-17'
), charged AS (
    SELECT order_id, sum(amount_minor) AS amount_minor
    FROM payment_intent GROUP BY order_id
)
SELECT 'totals' AS check_level,
       (SELECT sum(amount_minor) FROM expected) AS expected,
       (SELECT sum(amount_minor) FROM charged)  AS charged,
       NULL::bigint                             AS order_id
UNION ALL
SELECT 'row break', e.amount_minor, COALESCE(c.amount_minor, 0), e.order_id
FROM expected e
LEFT JOIN charged c USING (order_id)
WHERE e.amount_minor IS DISTINCT FROM c.amount_minor;
