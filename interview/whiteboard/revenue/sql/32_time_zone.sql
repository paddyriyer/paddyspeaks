-- The time zone is part of the definition. The same rule, with the month
-- drawn in UTC instead of New York, moves real money between months.
WITH bounds AS (
    SELECT 'America/New_York' AS tz,
           TIMESTAMPTZ '2026-10-01 00:00 America/New_York' AS lo,
           TIMESTAMPTZ '2026-11-01 00:00 America/New_York' AS hi
    UNION ALL
    SELECT 'UTC', TIMESTAMPTZ '2026-10-01 00:00 UTC', TIMESTAMPTZ '2026-11-01 00:00 UTC'
)
SELECT b.tz AS month_drawn_in,
       (SELECT sum(subtotal) FROM orders
        WHERE NOT is_test AND fulfilled_at >= b.lo AND fulfilled_at < b.hi)
     - (SELECT sum(r.amount) FROM refunds r JOIN orders o USING (order_id)
        WHERE NOT o.is_test AND r.refunded_at >= b.lo AND r.refunded_at < b.hi)
       AS recognized_revenue
FROM bounds b
ORDER BY 1;
