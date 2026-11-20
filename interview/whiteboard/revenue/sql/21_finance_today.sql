-- Finance's dashboard, as it is today. The tile also says "Revenue" and "Data Verified".
WITH earned AS (
    SELECT sum(subtotal) AS amount
    FROM orders
    WHERE NOT is_test
      AND fulfilled_at >= TIMESTAMPTZ '2026-10-01 00:00 America/New_York'
      AND fulfilled_at <  TIMESTAMPTZ '2026-11-01 00:00 America/New_York'
), refunded AS (
    SELECT sum(r.amount) AS amount
    FROM refunds r
    JOIN orders o USING (order_id)
    WHERE NOT o.is_test
      AND r.refunded_at >= TIMESTAMPTZ '2026-10-01 00:00 America/New_York'
      AND r.refunded_at <  TIMESTAMPTZ '2026-11-01 00:00 America/New_York'
)
SELECT to_char(earned.amount - refunded.amount, 'FM$9,999,999.00') AS "Revenue (Finance)"
FROM earned, refunded;
