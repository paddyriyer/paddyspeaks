-- A well-meant fix that is a calculation error, not a definition: "net the
-- refunds out of Product's number". The join fans out — an order with two
-- refunds is counted twice — so the bridge's last line stops being zero.
WITH buggy AS (
    SELECT sum(o.subtotal + o.tax) - sum(COALESCE(r.amount, 0)) AS amount
    FROM orders o
    LEFT JOIN refunds r USING (order_id)
    WHERE o.ordered_at >= TIMESTAMPTZ '2026-10-01 00:00 UTC'
      AND o.ordered_at <  TIMESTAMPTZ '2026-11-01 00:00 UTC'
), correct AS (            -- aggregate refunds to the order's grain first
    SELECT sum(o.subtotal + o.tax) - sum(COALESCE(r.refunded, 0)) AS amount
    FROM orders o
    LEFT JOIN (SELECT order_id, sum(amount) AS refunded
               FROM refunds GROUP BY order_id) r USING (order_id)
    WHERE o.ordered_at >= TIMESTAMPTZ '2026-10-01 00:00 UTC'
      AND o.ordered_at <  TIMESTAMPTZ '2026-11-01 00:00 UTC'
), fanned_out AS (
    SELECT count(*) AS orders_counted_twice
    FROM (SELECT order_id FROM refunds GROUP BY order_id HAVING count(*) > 1) d
    JOIN orders o USING (order_id)
    WHERE o.ordered_at >= TIMESTAMPTZ '2026-10-01 00:00 UTC'
      AND o.ordered_at <  TIMESTAMPTZ '2026-11-01 00:00 UTC'
)
SELECT buggy.amount                  AS "as written",
       correct.amount                AS "refunds at order grain",
       buggy.amount - correct.amount AS "unexplained",
       orders_counted_twice
FROM buggy, correct, fanned_out;
